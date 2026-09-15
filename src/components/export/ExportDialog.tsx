"use client";

import { Download } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { probeExportPlan, type ExportPlan } from "@/core/export/codecSupport";
import { exportPng } from "@/core/export/exportPng";
import {
  videoFrameCount,
  type VideoExportProgress,
} from "@/core/export/exportVideo";
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from "@/core/render/layout";
import { totalDurationSeconds } from "@/core/timeline/frameAt";
import { useFrameContext } from "@/components/player/useFrameContext";
import { baseName, downloadBlob } from "@/lib/download";
import { startVideoExport, type VideoExportHandle } from "@/lib/exportClient";
import { useAssetStore } from "@/stores/useAssetStore";
import { usePlaybackStore } from "@/stores/usePlaybackStore";
import { useProjectStore } from "@/stores/useProjectStore";

type Fps = 30 | 60;

export function ExportDialog() {
  const [open, setOpen] = useState(false);
  const dataset = useProjectStore((s) => s.dataset);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!dataset}>
          <Download /> Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
          <DialogDescription>
            Rendered at {LOGICAL_WIDTH}×{LOGICAL_HEIGHT}, entirely in your
            browser.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <Tabs defaultValue="video">
            <TabsList className="w-full">
              <TabsTrigger value="video" className="flex-1">
                Video
              </TabsTrigger>
              <TabsTrigger value="png" className="flex-1">
                PNG snapshot
              </TabsTrigger>
            </TabsList>
            <TabsContent value="video" className="pt-4">
              <VideoTab />
            </TabsContent>
            <TabsContent value="png" className="pt-4">
              <PngTab />
            </TabsContent>
          </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PngTab() {
  const frameCtx = useFrameContext();
  const settings = useProjectStore((s) => s.settings);
  const sourceName = useProjectStore((s) => s.sourceName);
  const bitmaps = useAssetStore((s) => s.bitmaps);
  const t = usePlaybackStore((s) => s.t);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = frameCtx.periods[Math.round(t)] ?? "";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Saves the frame currently shown in the preview ({label || "—"}). Scrub
        the timeline to pick a different moment.
      </p>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const blob = await exportPng(frameCtx, settings, bitmaps, t);
            downloadBlob(
              blob,
              `${baseName(sourceName)}-${label || "frame"}.png`,
            );
          } catch (e) {
            setError(e instanceof Error ? e.message : "PNG export failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Download /> Download PNG
      </Button>
    </div>
  );
}

function VideoTab() {
  const dataset = useProjectStore((s) => s.dataset);
  const settings = useProjectStore((s) => s.settings);
  const sourceName = useProjectStore((s) => s.sourceName);
  const bitmaps = useAssetStore((s) => s.bitmaps);

  const [fps, setFps] = useState<Fps>(30);
  const [plan, setPlan] = useState<ExportPlan | null | undefined>(undefined);
  const [progress, setProgress] = useState<VideoExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<VideoExportHandle | null>(null);

  useEffect(() => {
    let cancelled = false;
    probeExportPlan(LOGICAL_WIDTH, LOGICAL_HEIGHT).then((p) => {
      if (!cancelled) setPlan(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Cancel a running export if the dialog closes.
  useEffect(() => () => handleRef.current?.cancel(), []);

  const seconds = dataset
    ? totalDurationSeconds(dataset.periods.length, settings.secondsPerPeriod)
    : 0;
  const frames = useMemo(
    () => (dataset ? videoFrameCount({ dataset, settings, fps }) : 0),
    [dataset, settings, fps],
  );
  const running = progress !== null;

  const start = async () => {
    if (!dataset || !plan) return;
    setError(null);
    setProgress({ frame: 0, totalFrames: frames });
    const handle = startVideoExport(
      {
        dataset,
        settings,
        fps,
        width: LOGICAL_WIDTH,
        height: LOGICAL_HEIGHT,
        plan,
      },
      bitmaps,
      setProgress,
    );
    handleRef.current = handle;
    try {
      const blob = await handle.result;
      downloadBlob(blob, `${baseName(sourceName)}-${fps}fps.${plan.extension}`);
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError")) {
        setError(e instanceof Error ? e.message : "Video export failed.");
      }
    } finally {
      handleRef.current = null;
      setProgress(null);
    }
  };

  if (plan === undefined) {
    return (
      <p className="text-muted-foreground text-sm">
        Checking video encoder support…
      </p>
    );
  }

  if (plan === null) {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <p className="font-medium">
          Video export isn&apos;t available in this browser.
        </p>
        <p className="text-muted-foreground">
          It needs the WebCodecs API with an H.264 or VP9 encoder. Open this
          page in Chrome or Edge to export an MP4. PNG snapshots and the preview
          work everywhere.
        </p>
      </div>
    );
  }

  const pct = progress
    ? Math.round((progress.frame / progress.totalFrames) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex flex-col gap-1.5">
          <Label className="text-muted-foreground text-xs">Frame rate</Label>
          <Select
            value={String(fps)}
            onValueChange={(v) => setFps(Number(v) as Fps)}
            disabled={running}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 fps</SelectItem>
              <SelectItem value="60">60 fps</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-muted-foreground text-xs">Output</Label>
          <div className="flex h-9 items-center">{plan.label}</div>
        </div>
      </div>

      <p className="text-muted-foreground text-sm">
        {seconds.toFixed(1)} s · {frames.toLocaleString()} frames · 1080p
        {plan.container === "webm"
          ? " · H.264 isn't available here, so this will be a WebM file."
          : ""}
      </p>

      {progress ? (
        <div className="flex flex-col gap-2">
          <Progress value={pct} />
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>
              Frame {progress.frame.toLocaleString()} /{" "}
              {progress.totalFrames.toLocaleString()}
            </span>
            <span>{pct}%</span>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      {running ? (
        <Button variant="outline" onClick={() => handleRef.current?.cancel()}>
          Cancel
        </Button>
      ) : (
        <Button onClick={start} disabled={!dataset || frames < 2}>
          <Download /> Render {plan.extension.toUpperCase()}
        </Button>
      )}
    </div>
  );
}
