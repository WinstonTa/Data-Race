"use client";

import { useEffect, useState } from "react";
import {
  buildSampleCsv,
  SAMPLE_FILE_NAME,
  SAMPLE_SETTINGS,
} from "@/data/sampleDataset";
import { hydrateImages } from "@/lib/assets";
import { loadCsvText } from "@/lib/loadCsv";
import { useProjectStore } from "@/stores/useProjectStore";

let bootPromise: Promise<void> | null = null;

/**
 * Restore the auto-saved project from IndexedDB (or load the sample on a
 * first visit), then decode any stored images.
 *
 * Runs exactly once per page load. React StrictMode mounts effects twice in
 * development; a second concurrent `rehydrate()` would resolve early with an
 * empty store and clobber the saved project with the sample.
 */
export function bootProject(): Promise<void> {
  if (!bootPromise) {
    bootPromise = (async () => {
      try {
        await useProjectStore.persist.rehydrate();
      } catch {
        // Private mode / blocked storage: fall through with in-memory state.
      }
      if (!useProjectStore.getState().dataset) {
        loadCsvText(buildSampleCsv(), SAMPLE_FILE_NAME);
        useProjectStore.getState().updateSettings(SAMPLE_SETTINGS);
      }
      const ids = new Set(
        useProjectStore
          .getState()
          .dataset!.entities.flatMap((e) => (e.imageId ? [e.imageId] : [])),
      );
      try {
        await hydrateImages(ids);
      } catch {
        // Images are optional; the chart still renders without them.
      }
    })();
  }
  return bootPromise;
}

/** Returns true once the project is restored and ready to render. */
export function useProjectBoot(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void bootProject().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}
