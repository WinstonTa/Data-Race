import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { buildDataset } from "@/core/parser/buildDataset";
import { normalizeMapping, suggestMapping } from "@/core/parser/columnMapping";
import { datasetToGrid } from "@/core/parser/grid";
import {
  DEFAULT_SETTINGS,
  type ChartSettings,
  type ColumnMapping,
  type Dataset,
  type Entity,
  type Grid,
} from "@/core/types";
import { idbStorage } from "@/lib/idbStorage";

/** The raw CSV cells plus the user's column choices; `dataset` derives from it. */
export interface ProjectSource {
  grid: Grid;
  mapping: ColumnMapping;
}

export interface ProjectState {
  /** Raw grid + mapping. Always present when `dataset` is. */
  source: ProjectSource | null;
  dataset: Dataset | null;
  settings: ChartSettings;
  /** Original file name, for display and default export names. */
  sourceName: string;

  /** Load a freshly parsed grid, auto-detect the mapping and build the dataset. */
  loadSource: (grid: Grid, sourceName: string) => void;
  /** Replace the column mapping and rebuild, keeping per-entity edits. */
  setMapping: (mapping: ColumnMapping) => void;
  /** Edit one raw cell and rebuild, keeping per-entity edits. */
  setCell: (row: number, col: number, value: string) => void;
  loadProject: (project: {
    dataset: Dataset;
    source?: ProjectSource | null;
    settings: ChartSettings;
    sourceName: string;
  }) => void;
  updateEntity: (
    id: string,
    patch: Partial<Omit<Entity, "id" | "values" | "sourceRow">>,
  ) => void;
  /** Flip the Show toggle for many entities at once (rows without data stay hidden). */
  setIncludedMany: (ids: Iterable<string>, included: boolean) => void;
  updateSettings: (patch: Partial<ChartSettings>) => void;
  clear: () => void;
}

/** Give a dataset that has no grid (sample, v1 files, old saves) a synthetic one. */
function withSource(
  dataset: Dataset,
  source: ProjectSource | null | undefined,
): { dataset: Dataset; source: ProjectSource } {
  if (source) return { dataset, source };
  const synth = datasetToGrid(dataset);
  // Rebuild so warnings describe the synthetic grid; `prev` keeps every
  // id, colour, icon and Show toggle.
  return {
    dataset: buildDataset(synth.grid, synth.mapping, { prev: synth.dataset }),
    source: { grid: synth.grid, mapping: synth.mapping },
  };
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      source: null,
      dataset: null,
      settings: DEFAULT_SETTINGS,
      sourceName: "",

      loadSource: (grid, sourceName) => {
        const { mapping, confident } = suggestMapping(grid);
        set({
          source: { grid, mapping },
          dataset: buildDataset(grid, mapping, { uncertain: !confident }),
          sourceName,
        });
      },

      setMapping: (mapping) =>
        set((s) => {
          if (!s.source) return s;
          const next = normalizeMapping(s.source.grid, mapping);
          return {
            source: { ...s.source, mapping: next },
            dataset: buildDataset(s.source.grid, next, { prev: s.dataset }),
          };
        }),

      setCell: (row, col, value) =>
        set((s) => {
          if (!s.source) return s;
          const { grid, mapping } = s.source;
          if (row < 0 || row >= grid.length || col < 0 || col >= grid[0].length)
            return s;
          if (grid[row][col] === value) return s;
          const nextGrid = grid.slice();
          nextGrid[row] = grid[row].slice();
          nextGrid[row][col] = value;
          // Editing a cell is not reviewing the mapping: keep the nudge.
          const uncertain =
            s.dataset?.warnings.some((w) => w.kind === "mapping-uncertain") ??
            false;
          return {
            source: { grid: nextGrid, mapping },
            dataset: buildDataset(nextGrid, mapping, {
              prev: s.dataset,
              uncertain,
            }),
          };
        }),

      loadProject: ({ dataset, source, settings, sourceName }) =>
        set({
          ...withSource(dataset, source),
          settings: { ...DEFAULT_SETTINGS, ...settings },
          sourceName,
        }),

      updateEntity: (id, patch) =>
        set((s) => {
          if (!s.dataset) return s;
          return {
            dataset: {
              ...s.dataset,
              entities: s.dataset.entities.map((e) =>
                e.id === id ? { ...e, ...patch } : e,
              ),
            },
          };
        }),

      setIncludedMany: (ids, included) =>
        set((s) => {
          if (!s.dataset) return s;
          const wanted = new Set(ids);
          return {
            dataset: {
              ...s.dataset,
              entities: s.dataset.entities.map((e) => {
                if (!wanted.has(e.id)) return e;
                const hasData = e.values.some((v) => v !== null);
                return { ...e, included: included && hasData };
              }),
            },
          };
        }),

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),

      clear: () =>
        set({
          source: null,
          dataset: null,
          settings: DEFAULT_SETTINGS,
          sourceName: "",
        }),
    }),
    {
      name: "data-race-project",
      version: 2,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        source: s.source,
        dataset: s.dataset,
        settings: s.settings,
        sourceName: s.sourceName,
      }),
      // v1 saves have no `source`; `merge` synthesises one from the dataset.
      migrate: (persisted) => persisted as Partial<ProjectState>,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ProjectState>;
        const loaded = p.dataset ? withSource(p.dataset, p.source) : null;
        return {
          ...current,
          source: loaded?.source ?? null,
          dataset: loaded?.dataset ?? null,
          settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
          sourceName: p.sourceName ?? "",
        };
      },
      // Static export prerenders on the server; only touch IndexedDB in the browser.
      skipHydration: true,
    },
  ),
);
