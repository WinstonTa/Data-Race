"use client";

import { Pause, Play, SkipBack } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { totalDurationSeconds } from "@/core/timeline/frameAt";
import { usePlaybackStore } from "@/stores/usePlaybackStore";
import { useProjectStore } from "@/stores/useProjectStore";

const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 4];
const NO_PERIODS: string[] = [];

export function ScrubControls() {
  const periods = useProjectStore((s) => s.dataset?.periods ?? NO_PERIODS);
  const secondsPerPeriod = useProjectStore((s) => s.settings.secondsPerPeriod);
  const t = usePlaybackStore((s) => s.t);
  const playing = usePlaybackStore((s) => s.playing);
  const speed = usePlaybackStore((s) => s.speed);
  const { setT, toggle, pause, setSpeed } = usePlaybackStore.getState();

  const end = Math.max(0, periods.length - 1);
  const disabled = periods.length === 0;
  const label = periods[Math.round(t)] ?? "—";
  const total = totalDurationSeconds(periods.length, secondsPerPeriod) / speed;
  const elapsed = end === 0 ? 0 : (t / end) * total;

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="icon"
        aria-label="Restart"
        title="Home"
        disabled={disabled}
        onClick={() => {
          pause();
          setT(0);
        }}
      >
        <SkipBack />
      </Button>
      <Button
        size="icon"
        aria-label={playing ? "Pause" : "Play"}
        title="Space"
        disabled={disabled}
        onClick={toggle}
      >
        {playing ? <Pause /> : <Play />}
      </Button>

      <Slider
        aria-label="Timeline"
        title="← / → step one period"
        className="flex-1"
        min={0}
        max={end}
        step={0.01}
        value={[t]}
        disabled={disabled}
        onValueChange={([v]) => {
          pause();
          setT(v);
        }}
      />

      <div className="w-28 text-right font-mono text-sm tabular-nums">
        <span className="font-semibold">{label}</span>
        <span className="text-muted-foreground"> · {elapsed.toFixed(1)}s</span>
      </div>

      <Select value={String(speed)} onValueChange={(v) => setSpeed(Number(v))}>
        <SelectTrigger className="w-24" aria-label="Playback speed">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SPEEDS.map((s) => (
            <SelectItem key={s} value={String(s)}>
              {s}×
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
