"use client";

import { useEffect, useState } from "react";
import {
  buildSampleFriendCsv,
  SAMPLE_GRAPH_FILE_NAME,
} from "@/data/sampleFriendGraph";
import { loadEdgeListText } from "@/lib/loadEdgeList";
import { useGraphStore } from "@/stores/useGraphStore";

let bootPromise: Promise<void> | null = null;

/**
 * Restore the auto-saved friend graph from IndexedDB, or load the sample on a
 * first visit. Runs once per page load: like `bootProject()`, a second
 * concurrent `rehydrate()` under StrictMode would clobber the saved graph.
 */
export function bootGraph(): Promise<void> {
  if (!bootPromise) {
    bootPromise = (async () => {
      try {
        await useGraphStore.persist.rehydrate();
      } catch {
        // Private mode / blocked storage: fall through with in-memory state.
      }
      if (!useGraphStore.getState().data) {
        loadEdgeListText(buildSampleFriendCsv(), SAMPLE_GRAPH_FILE_NAME);
      }
    })();
  }
  return bootPromise;
}

/** Returns true once the graph is restored and ready to render. */
export function useGraphBoot(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void bootGraph().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}
