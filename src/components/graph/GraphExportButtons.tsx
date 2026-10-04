"use client";

import { FileSpreadsheet, ImageDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { metricsToGrid } from "@/core/graph/metricsCsv";
import { gridToCsv } from "@/core/parser/grid";
import { baseName, downloadBlob } from "@/lib/download";
import { useGraphStore } from "@/stores/useGraphStore";
import { getActiveSigma } from "./sigmaRegistry";

export function GraphExportButtons() {
  const analysis = useGraphStore((s) => s.analysis);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = () => baseName(useGraphStore.getState().sourceName || "graph");

  const exportPng = async () => {
    const sigma = getActiveSigma();
    if (!sigma) return;
    setBusy(true);
    setError(null);
    try {
      // Imported lazily: it touches the DOM and is only needed on click.
      const { toBlob } = await import("@sigma/export-image");
      const blob = await toBlob(sigma, {
        format: "png",
        backgroundColor: "#ffffff",
      });
      downloadBlob(blob, `${name()}-graph.png`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PNG export failed.");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const { data, analysis } = useGraphStore.getState();
    if (!data || !analysis) return;
    const csv = gridToCsv(metricsToGrid(data, analysis));
    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `${name()}-metrics.csv`,
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error ? <span className="text-destructive text-sm">{error}</span> : null}
      <Button
        variant="outline"
        onClick={exportPng}
        disabled={!analysis || busy}
      >
        <ImageDown /> PNG
      </Button>
      <Button variant="outline" onClick={exportCsv} disabled={!analysis}>
        <FileSpreadsheet /> Metrics CSV
      </Button>
    </div>
  );
}
