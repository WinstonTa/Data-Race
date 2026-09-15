import type { Entity, Keyframe, KeyframeEntry } from "../types";

/**
 * Precompute, for every period, each included entity's retained value and
 * integer rank.
 *
 * Last-value retention: an entity is absent until its first non-null value,
 * then carries its most recent value forward through any later gaps.
 * Ranks cover *all* present entities (not only the top N) so that bars
 * entering or leaving the visible window slide from/to a real position.
 */
export function buildKeyframes(
  entities: Entity[],
  periodCount: number,
): Keyframe[] {
  const included = entities.filter((e) => e.included);
  const retained = new Map<string, number>();
  const keyframes: Keyframe[] = [];

  for (let p = 0; p < periodCount; p++) {
    const present: { id: string; name: string; value: number }[] = [];

    for (const e of included) {
      const v = e.values[p];
      if (v !== null && v !== undefined) retained.set(e.id, v);
      const r = retained.get(e.id);
      if (r !== undefined) present.push({ id: e.id, name: e.name, value: r });
    }

    // Highest value first; ties broken by name for deterministic output.
    present.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

    const entries = new Map<string, KeyframeEntry>();
    present.forEach((x, rank) => entries.set(x.id, { value: x.value, rank }));

    keyframes.push({
      periodIndex: p,
      entries,
      maxValue: present.length ? present[0].value : 0,
    });
  }

  return keyframes;
}
