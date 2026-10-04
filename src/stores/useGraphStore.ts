import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  GraphAnalysis,
  GraphData,
  GraphWarning,
} from "@/core/graph/types";
import { idbStorage } from "@/lib/idbStorage";

export interface GraphSettings {
  /** Hide nodes with fewer connections than this (visibility only). */
  minDegree: number;
  /** ForceAtlas2 scalingRatio: higher spreads nodes further apart. */
  repulsion: number;
  /** Draw a visual-only "You" node linked to every friend. */
  showEgo: boolean;
}

export const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
  minDegree: 0,
  repulsion: 4,
  showEgo: false,
};

export type NodePositions = Record<string, [x: number, y: number]>;

export interface GraphState {
  data: GraphData | null;
  warnings: GraphWarning[];
  sourceName: string;
  /** Last settled layout; null means "run the layout". */
  positions: NodePositions | null;
  settings: GraphSettings;

  // --- session only (not persisted) ---
  /** Derived from `data` by the analysis worker. */
  analysis: GraphAnalysis | null;
  analysisError: string | null;
  analyzing: boolean;
  selectedId: string | null;
  /** Bumped when the camera should center on `selectedId`. */
  focusNonce: number;
  /** Bumped to restart the force layout. */
  layoutNonce: number;
  layoutRunning: boolean;

  loadGraph: (
    data: GraphData,
    warnings: GraphWarning[],
    sourceName: string,
  ) => void;
  setAnalysis: (analysis: GraphAnalysis | null, error?: string) => void;
  setAnalyzing: (analyzing: boolean) => void;
  select: (id: string | null, opts?: { focus?: boolean }) => void;
  setPositions: (positions: NodePositions | null) => void;
  updateSettings: (patch: Partial<GraphSettings>) => void;
  rerunLayout: () => void;
  setLayoutRunning: (running: boolean) => void;
}

export const useGraphStore = create<GraphState>()(
  persist(
    (set) => ({
      data: null,
      warnings: [],
      sourceName: "",
      positions: null,
      settings: DEFAULT_GRAPH_SETTINGS,
      analysis: null,
      analysisError: null,
      analyzing: false,
      selectedId: null,
      focusNonce: 0,
      layoutNonce: 0,
      layoutRunning: false,

      loadGraph: (data, warnings, sourceName) =>
        set((s) => ({
          data,
          warnings,
          sourceName,
          positions: null,
          analysis: null,
          analysisError: null,
          selectedId: null,
          settings: { ...s.settings, minDegree: 0 },
        })),

      setAnalysis: (analysis, error) =>
        set({ analysis, analysisError: error ?? null }),

      setAnalyzing: (analyzing) => set({ analyzing }),

      select: (id, opts) =>
        set((s) => ({
          selectedId: id,
          focusNonce:
            opts?.focus && id !== null ? s.focusNonce + 1 : s.focusNonce,
        })),

      setPositions: (positions) => set({ positions }),

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),

      rerunLayout: () => set((s) => ({ layoutNonce: s.layoutNonce + 1 })),

      setLayoutRunning: (layoutRunning) => set({ layoutRunning }),
    }),
    {
      name: "data-race-graph",
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        data: s.data,
        warnings: s.warnings,
        sourceName: s.sourceName,
        positions: s.positions,
        settings: s.settings,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<GraphState>;
        return {
          ...current,
          data: p.data ?? null,
          warnings: p.warnings ?? [],
          sourceName: p.sourceName ?? "",
          positions: p.positions ?? null,
          settings: { ...DEFAULT_GRAPH_SETTINGS, ...(p.settings ?? {}) },
        };
      },
      // Static export prerenders on the server; only touch IndexedDB in the
      // browser. Hydration is triggered by bootGraph().
      skipHydration: true,
    },
  ),
);
