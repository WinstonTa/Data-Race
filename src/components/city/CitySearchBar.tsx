"use client";

import { AlertCircle, Loader2, MapPin, RotateCw, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseLocationInput } from "@/core/city/geoParsers";
import { CITY_PRESETS } from "@/data/cityPresets";
import { findPreset, openLocation, openPreset } from "@/lib/loadCity";
import { useCityStore } from "@/stores/useCityStore";

/** Preset picker + "paste a Google Maps link or lat, lng" input. */
export function CitySearchBar() {
  const presetId = useCityStore((s) => s.presetId);
  const status = useCityStore((s) => s.status);
  const [text, setText] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseLocationInput(text);
    if (!parsed.ok) {
      setInputError(parsed.reason);
      return;
    }
    setInputError(null);
    void openLocation([parsed.longitude, parsed.latitude], parsed.zoom);
  };

  return (
    <div className="pointer-events-auto flex w-full max-w-md flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-2 shadow-lg backdrop-blur-md">
      <div className="flex gap-2">
        <Select
          value={presetId ?? ""}
          onValueChange={(id) => {
            const preset = findPreset(id);
            if (preset) void openPreset(preset);
          }}
        >
          <SelectTrigger
            aria-label="City preset"
            className="w-40 shrink-0 border-slate-800 bg-slate-900/60"
          >
            <MapPin className="text-slate-400" />
            <SelectValue placeholder="Custom" />
          </SelectTrigger>
          <SelectContent className="dark">
            {CITY_PRESETS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
                <span className="text-muted-foreground text-xs">{p.area}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <form onSubmit={submit} className="flex min-w-0 flex-1 gap-1">
          <Input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (inputError) setInputError(null);
            }}
            placeholder="Google Maps URL or lat, lng"
            aria-label="Google Maps URL or coordinates"
            aria-invalid={inputError ? true : undefined}
            className="min-w-0 border-slate-800 bg-slate-900/60"
          />
          <Button
            type="submit"
            size="icon"
            variant="secondary"
            aria-label="Go to location"
          >
            <Search />
          </Button>
        </form>
      </div>

      {inputError ? (
        <p className="text-destructive flex items-start gap-1.5 px-1 text-xs">
          <AlertCircle className="mt-px size-3.5 shrink-0" />
          {inputError}
        </p>
      ) : status.state === "loading" ? (
        <p className="flex items-center gap-1.5 px-1 text-xs text-slate-400">
          <Loader2 className="size-3.5 animate-spin" />
          {status.message}
        </p>
      ) : status.state === "error" ? (
        <div className="text-destructive flex items-start gap-1.5 px-1 text-xs">
          <AlertCircle className="mt-px size-3.5 shrink-0" />
          <span className="flex-1">{status.message}</span>
          {status.retry ? (
            <Button
              size="xs"
              variant="outline"
              onClick={() => void openLocation(status.retry!)}
            >
              <RotateCw /> Retry
            </Button>
          ) : null}
        </div>
      ) : status.state === "ready" ? (
        <p className="truncate px-1 text-xs text-slate-400">{status.message}</p>
      ) : null}
    </div>
  );
}
