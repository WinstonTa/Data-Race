import { bboxAround, bboxContains } from "@/core/city/geo";
import {
  buildOverpassQuery,
  parseOverpass,
  type OverpassResponse,
} from "@/core/city/osm";
import type { CityData, LngLat } from "@/core/city/types";
import { CITY_PRESETS, snapshotUrl, type CityPreset } from "@/data/cityPresets";
import { useCityStore } from "@/stores/useCityStore";

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
/** Live areas are ±500 m (≈ 1 km square): a few seconds on Overpass. */
const LIVE_HALF_SIZE_M = 500;
const LIVE_TIMEOUT_MS = 30_000;
const DEFAULT_PITCH = 50;

const count = (c: CityData) =>
  `${c.buildings.length.toLocaleString("en-US")} buildings · ${c.roads.length.toLocaleString("en-US")} roads`;

/** Only the newest request may write status; older ones are aborted. */
let inflight: AbortController | null = null;
function begin(): AbortController {
  inflight?.abort();
  inflight = new AbortController();
  return inflight;
}
const isCurrent = (c: AbortController) => inflight === c && !c.signal.aborted;

/** Show a preset: fly immediately, fetch its snapshot if it isn't loaded. */
export async function openPreset(preset: CityPreset): Promise<void> {
  const store = useCityStore.getState();
  store.setPresetId(preset.id);
  store.select(null);
  store.flyTo({
    center: preset.center,
    zoom: preset.zoom,
    bearing: preset.bearing,
    pitch: DEFAULT_PITCH,
  });

  const loaded = store.cities[preset.id];
  if (loaded) {
    store.setStatus({
      state: "ready",
      message: `${loaded.name} · ${count(loaded)}`,
    });
    return;
  }
  const ctl = begin();
  store.setStatus({ state: "loading", message: `Loading ${preset.name}…` });
  try {
    const res = await fetch(snapshotUrl(preset.id), { signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const city = (await res.json()) as CityData;
    store.addCity(city);
    if (isCurrent(ctl))
      store.setStatus({
        state: "ready",
        message: `${city.name} · ${count(city)}`,
      });
  } catch (err) {
    if (!isCurrent(ctl)) return;
    store.setStatus({
      state: "error",
      message: `Couldn't load the ${preset.name} snapshot (${(err as Error).message}).`,
    });
  }
}

/**
 * Go to an arbitrary point. Inside an already-loaded area we just fly;
 * otherwise we fetch a ~1 km square around it from Overpass.
 */
export async function openLocation(
  center: LngLat,
  zoom?: number,
): Promise<void> {
  const store = useCityStore.getState();
  store.setPresetId(null);
  store.flyTo({ center, zoom: zoom ?? 16.5, pitch: DEFAULT_PITCH });

  const covering = store.order
    .map((id) => store.cities[id])
    .find((c) => bboxContains(c.bbox, center));
  if (covering) {
    store.setStatus({
      state: "ready",
      message: `${covering.name} · ${count(covering)}`,
    });
    return;
  }

  const ctl = begin();
  store.setStatus({
    state: "loading",
    message: "Loading buildings from OpenStreetMap…",
  });
  const timer = setTimeout(() => ctl.abort("timeout"), LIVE_TIMEOUT_MS);
  try {
    const city = await fetchLiveArea(center, ctl.signal);
    if (!isCurrent(ctl)) return;
    store.addCity(city);
    store.setStatus({
      state: "ready",
      message: city.buildings.length
        ? `${city.name} · ${count(city)}`
        : `No buildings mapped here in OpenStreetMap · ${count(city)}`,
    });
  } catch (err) {
    // Superseded by a newer request: stay quiet. Our own timeout still reports.
    if (inflight !== ctl) return;
    const timedOut = ctl.signal.reason === "timeout";
    store.setStatus({
      state: "error",
      message: timedOut
        ? "OpenStreetMap (Overpass) took too long to answer."
        : (err as Error).message,
      retry: center,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Query Overpass for the ±500 m box around `center`. */
export async function fetchLiveArea(
  center: LngLat,
  signal?: AbortSignal,
): Promise<CityData> {
  const bbox = bboxAround(center, LIVE_HALF_SIZE_M);
  const res = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    body: new URLSearchParams({ data: buildOverpassQuery(bbox, 25) }),
    signal,
  });
  if (res.status === 429 || res.status === 504)
    throw new Error(
      "OpenStreetMap (Overpass) is busy. Wait a minute and retry.",
    );
  if (!res.ok) throw new Error(`Overpass error: HTTP ${res.status}`);
  const json = (await res.json()) as OverpassResponse;
  const label = `${center[1].toFixed(4)}, ${center[0].toFixed(4)}`;
  return parseOverpass(json, {
    id: `live:${label}`,
    name: `Live area · ${label}`,
    center,
    bbox,
    source: "live",
    fetchedAt: new Date().toISOString(),
  });
}

export const findPreset = (id: string) => CITY_PRESETS.find((p) => p.id === id);
