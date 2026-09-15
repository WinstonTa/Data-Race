"use client";

import { useMemo } from "react";
import { buildKeyframes } from "@/core/timeline/buildKeyframes";
import { indexEntities, type FrameContext } from "@/core/timeline/frameAt";
import { useProjectStore } from "@/stores/useProjectStore";

const EMPTY: FrameContext = {
  keyframes: [],
  periods: [],
  entitiesById: new Map(),
  topN: 10,
};

/** Memoized keyframes + lookup for the current dataset; recomputed on data edits only. */
export function useFrameContext(): FrameContext {
  const dataset = useProjectStore((s) => s.dataset);
  const topN = useProjectStore((s) => s.settings.topN);

  return useMemo(() => {
    if (!dataset) return { ...EMPTY, topN };
    return {
      keyframes: buildKeyframes(dataset.entities, dataset.periods.length),
      periods: dataset.periods,
      entitiesById: indexEntities(dataset.entities),
      topN,
    };
  }, [dataset, topN]);
}
