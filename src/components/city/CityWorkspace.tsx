"use client";

import { FileSpreadsheet } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { entitiesToGrid } from "@/core/city/entitiesCsv";
import { gridToCsv } from "@/core/parser/grid";
import { DEFAULT_CITY_ID } from "@/data/cityPresets";
import { downloadBlob } from "@/lib/download";
import { findPreset, openPreset } from "@/lib/loadCity";
import { useCityStore } from "@/stores/useCityStore";

// WebGL / window access must never run during static prerendering.
const CityViewer = dynamic(
  () => import("./CityViewer").then((m) => m.CityViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full animate-pulse items-center justify-center bg-slate-900 text-sm text-slate-500">
        Starting 3D viewer…
      </div>
    ),
  },
);

function exportEntitiesCsv() {
  const { order, cities, presetId } = useCityStore.getState();
  const loaded = order.map((id) => cities[id]);
  if (!loaded.length) return;
  const csv = gridToCsv(entitiesToGrid(loaded));
  const name = loaded.length === 1 ? (presetId ?? "area") : "areas";
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    `city-${name}-entities.csv`,
  );
}

export function CityWorkspace() {
  const hasData = useCityStore((s) => s.order.length > 0);

  useEffect(() => {
    if (useCityStore.getState().order.length) return;
    const preset = findPreset(DEFAULT_CITY_ID);
    if (preset) void openPreset(preset);
  }, []);

  return (
    <div className="dark flex h-dvh min-h-[560px] flex-col bg-slate-950 text-slate-200">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-6 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-50">
              Data Race
            </h1>
            <p className="text-sm text-slate-400">
              City entities in 3D · buildings and roads from OpenStreetMap
            </p>
          </div>
          <AppNav />
        </div>
        <Button
          variant="outline"
          onClick={exportEntitiesCsv}
          disabled={!hasData}
          title="One row per building and road, keyed by OSM id"
        >
          <FileSpreadsheet /> Entities CSV
        </Button>
      </header>
      <div className="relative min-h-0 flex-1">
        <CityViewer />
      </div>
    </div>
  );
}
