import type { BarState, Entity, FrameState, Keyframe } from "../types";
import { clamp, lerp } from "./lerp";

export interface FrameContext {
  keyframes: Keyframe[];
  periods: string[];
  /** Lookup for name/color/image; only included entities need to be here. */
  entitiesById: Map<string, Entity>;
  topN: number;
}

/**
 * Compute the fully interpolated state at continuous time `t` (in period
 * units). This is the single entry point shared by the live preview and the
 * deterministic video exporter, so identical `t` → identical pixels.
 */
export function frameAt(ctx: FrameContext, t: number): FrameState {
  const { keyframes, periods, entitiesById, topN } = ctx;
  const last = keyframes.length - 1;

  if (last < 0) {
    return {
      t: 0,
      periodIndex: 0,
      periodProgress: 0,
      periodLabel: "",
      bars: [],
      xMax: 0,
    };
  }

  t = clamp(t, 0, last);
  const i = Math.min(Math.floor(t), last);
  const f = t - i;
  const k0 = keyframes[i];
  const k1 = keyframes[Math.min(i + 1, last)];

  const ids = new Set<string>([...k0.entries.keys(), ...k1.entries.keys()]);
  const bars: BarState[] = [];

  for (const id of ids) {
    const e0 = k0.entries.get(id);
    const e1 = k1.entries.get(id);
    // An entity absent on one side grows from / shrinks to zero while sliding
    // in from / out to the slot just below the visible window.
    const rank = lerp(e0?.rank ?? topN, e1?.rank ?? topN, f);
    if (rank >= topN) continue;

    const entity = entitiesById.get(id);
    if (!entity) continue;

    bars.push({
      entityId: id,
      name: entity.name,
      color: entity.color,
      imageId: entity.imageId,
      value: lerp(e0?.value ?? 0, e1?.value ?? 0, f),
      rank,
      opacity: clamp(topN - rank, 0, 1),
    });
  }

  bars.sort((a, b) => a.rank - b.rank);

  return {
    t,
    periodIndex: i,
    periodProgress: f,
    periodLabel: periods[Math.round(t)] ?? "",
    bars,
    xMax: lerp(k0.maxValue, k1.maxValue, f),
  };
}

/** Build the lookup map `frameAt` needs; call once per dataset change. */
export function indexEntities(entities: Entity[]): Map<string, Entity> {
  return new Map(entities.map((e) => [e.id, e]));
}

/** Seconds of animation for the whole dataset. */
export function totalDurationSeconds(
  periodCount: number,
  secondsPerPeriod: number,
): number {
  return Math.max(0, periodCount - 1) * secondsPerPeriod;
}
