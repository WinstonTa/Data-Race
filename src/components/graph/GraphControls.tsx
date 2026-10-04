"use client";

import { RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useGraphStore } from "@/stores/useGraphStore";

export function GraphControls() {
  const settings = useGraphStore((s) => s.settings);
  const analysis = useGraphStore((s) => s.analysis);
  const layoutRunning = useGraphStore((s) => s.layoutRunning);
  const updateSettings = useGraphStore((s) => s.updateSettings);
  const rerunLayout = useGraphStore((s) => s.rerunLayout);

  const { maxDegree, visible } = useMemo(() => {
    const metrics = analysis ? Object.values(analysis.metrics) : [];
    return {
      maxDegree: Math.max(1, ...metrics.map((m) => m.degree)),
      visible: metrics.filter((m) => m.degree >= settings.minDegree).length,
    };
  }, [analysis, settings.minDegree]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>
          Minimum connections: {settings.minDegree}
          <span className="text-muted-foreground font-normal">
            ({visible} shown)
          </span>
        </Label>
        <Slider
          min={0}
          max={maxDegree}
          step={1}
          value={[Math.min(settings.minDegree, maxDegree)]}
          onValueChange={([v]) => updateSettings({ minDegree: v })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Repulsion: {settings.repulsion.toFixed(1)}</Label>
        <Slider
          min={0.5}
          max={20}
          step={0.5}
          value={[settings.repulsion]}
          onValueChange={([v]) => updateSettings({ repulsion: v })}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="flex items-center gap-2">
          <Switch
            checked={settings.showEgo}
            onCheckedChange={(v) => updateSettings({ showEgo: v })}
          />
          Show me
        </Label>
        <Button
          variant="outline"
          size="sm"
          onClick={rerunLayout}
          disabled={!analysis}
        >
          <RefreshCw className={layoutRunning ? "animate-spin" : undefined} />
          Re-run layout
        </Button>
      </div>
    </div>
  );
}
