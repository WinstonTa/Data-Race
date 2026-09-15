import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_SETTINGS,
  type ChartSettings,
  type Dataset,
  type Entity,
} from "@/core/types";
import { idbStorage } from "@/lib/idbStorage";

export interface ProjectState {
  dataset: Dataset | null;
  settings: ChartSettings;
  /** Original file name, for display and default export names. */
  sourceName: string;

  loadDataset: (dataset: Dataset, sourceName: string) => void;
  loadProject: (project: {
    dataset: Dataset;
    settings: ChartSettings;
    sourceName: string;
  }) => void;
  updateEntity: (
    id: string,
    patch: Partial<Omit<Entity, "id" | "values">>,
  ) => void;
  updateSettings: (patch: Partial<ChartSettings>) => void;
  clear: () => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      dataset: null,
      settings: DEFAULT_SETTINGS,
      sourceName: "",

      loadDataset: (dataset, sourceName) => set({ dataset, sourceName }),

      loadProject: ({ dataset, settings, sourceName }) =>
        set({
          dataset,
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

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),

      clear: () =>
        set({ dataset: null, settings: DEFAULT_SETTINGS, sourceName: "" }),
    }),
    {
      name: "data-race-project",
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        dataset: s.dataset,
        settings: s.settings,
        sourceName: s.sourceName,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ProjectState>;
        return {
          ...current,
          dataset: p.dataset ?? null,
          settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
          sourceName: p.sourceName ?? "",
        };
      },
      // Static export prerenders on the server; only touch IndexedDB in the browser.
      skipHydration: true,
    },
  ),
);
