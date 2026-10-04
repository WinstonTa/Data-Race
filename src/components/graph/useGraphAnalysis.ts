"use client";

import { useEffect } from "react";
import { analyzeInWorker } from "@/lib/graphAnalysisClient";
import { useGraphStore } from "@/stores/useGraphStore";

/** Recompute metrics in the worker whenever the loaded graph changes. */
export function useGraphAnalysis(enabled: boolean): void {
  const data = useGraphStore((s) => s.data);

  useEffect(() => {
    if (!enabled || !data) return;
    const { setAnalysis, setAnalyzing } = useGraphStore.getState();
    const job = analyzeInWorker(data);
    // A superseded job must not touch the store after its replacement starts.
    let active = true;
    setAnalyzing(true);
    job.result.then(
      (analysis) => {
        if (!active) return;
        setAnalysis(analysis);
        setAnalyzing(false);
      },
      (e: Error) => {
        if (!active) return;
        setAnalysis(null, e.message);
        setAnalyzing(false);
      },
    );
    return () => {
      active = false;
      job.cancel();
    };
  }, [enabled, data]);
}
