"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type { ChartSettings } from "@/core/types";
import { useProjectStore } from "@/stores/useProjectStore";

const NUMBER_FORMATS: { value: string; label: string }[] = [
  { value: ",.0f", label: "1,234" },
  { value: ",.1f", label: "1,234.5" },
  { value: ",.2f", label: "1,234.56" },
  { value: "$,.0f", label: "$1,234" },
  { value: "$,.2f", label: "$1,234.56" },
  { value: ".3s", label: "1.23k / 1.23M" },
  { value: ".1%", label: "12.3%" },
];

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      {children}
    </div>
  );
}

export function SettingsPanel() {
  const settings = useProjectStore((s) => s.settings);
  const update = useProjectStore((s) => s.updateSettings);
  const set = <K extends keyof ChartSettings>(
    key: K,
    value: ChartSettings[K],
  ) => update({ [key]: value } as Pick<ChartSettings, K>);

  return (
    <div className="flex flex-col gap-4">
      <Field label="Title">
        <Input
          value={settings.title}
          onChange={(e) => set("title", e.target.value)}
        />
      </Field>
      <Field label="Subtitle">
        <Input
          value={settings.subtitle}
          onChange={(e) => set("subtitle", e.target.value)}
        />
      </Field>
      <Field label="Source / caption">
        <Input
          value={settings.source}
          onChange={(e) => set("source", e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={`Bars shown: ${settings.topN}`}>
          <Slider
            min={3}
            max={25}
            step={1}
            value={[settings.topN]}
            onValueChange={([v]) => set("topN", v)}
          />
        </Field>
        <Field
          label={`Seconds per period: ${settings.secondsPerPeriod.toFixed(2)}`}
        >
          <Slider
            min={0.1}
            max={3}
            step={0.05}
            value={[settings.secondsPerPeriod]}
            onValueChange={([v]) => set("secondsPerPeriod", v)}
          />
        </Field>
      </div>

      <Field label="Number format">
        <Select
          value={settings.numberFormat}
          onValueChange={(v) => set("numberFormat", v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NUMBER_FORMATS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Background">
          <Input
            type="color"
            className="h-9 p-1"
            value={settings.background}
            onChange={(e) => set("background", e.target.value)}
          />
        </Field>
        <Field label="Text">
          <Input
            type="color"
            className="h-9 p-1"
            value={settings.textColor}
            onChange={(e) => set("textColor", e.target.value)}
          />
        </Field>
        <Field label={`Corner radius: ${settings.barCornerRadius}`}>
          <Slider
            className="mt-3"
            min={0}
            max={30}
            step={1}
            value={[settings.barCornerRadius]}
            onValueChange={([v]) => set("barCornerRadius", v)}
          />
        </Field>
      </div>
    </div>
  );
}
