import { create } from "zustand";
import type { CityData, LngLat } from "@/core/city/types";

export type CityStatus =
  | { state: "idle" }
  | { state: "loading"; message: string }
  | { state: "error"; message: string; retry?: LngLat }
  | { state: "ready"; message: string };

/** Where the camera should go next; `nonce` makes repeat requests distinct. */
export interface CameraTarget {
  center: LngLat;
  zoom?: number;
  bearing?: number;
  pitch?: number;
  nonce: number;
}

/**
 * City 3D workspace state. Session-only (not persisted): the presets are
 * static files and live areas are cheap to refetch, so there is no boot path.
 */
export interface CityState {
  /** Every loaded area, by id. All of them stay on screen. */
  cities: Record<string, CityData>;
  /** Load order — layers and exports iterate this. */
  order: string[];
  /** Preset the selector shows; null after jumping to a pasted location. */
  presetId: string | null;
  status: CityStatus;
  selectedId: string | null;
  camera: CameraTarget | null;

  addCity: (city: CityData) => void;
  setPresetId: (id: string | null) => void;
  setStatus: (status: CityStatus) => void;
  select: (id: string | null) => void;
  flyTo: (target: Omit<CameraTarget, "nonce">) => void;
}

export const useCityStore = create<CityState>()((set) => ({
  cities: {},
  order: [],
  presetId: null,
  status: { state: "idle" },
  selectedId: null,
  camera: null,

  addCity: (city) =>
    set((s) => ({
      cities: { ...s.cities, [city.id]: city },
      order: s.order.includes(city.id) ? s.order : [...s.order, city.id],
    })),
  setPresetId: (presetId) => set({ presetId }),
  setStatus: (status) => set({ status }),
  select: (selectedId) => set({ selectedId }),
  flyTo: (target) =>
    set((s) => ({ camera: { ...target, nonce: (s.camera?.nonce ?? 0) + 1 } })),
}));
