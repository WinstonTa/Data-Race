import { describe, expect, it } from "vitest";
import type { Entity } from "../types";
import { buildKeyframes } from "./buildKeyframes";
import { frameAt, indexEntities, totalDurationSeconds } from "./frameAt";

function entity(
  id: string,
  values: (number | null)[],
  extra: Partial<Entity> = {},
): Entity {
  return {
    id,
    name: id.toUpperCase(),
    color: "#000",
    values,
    included: true,
    ...extra,
  };
}

describe("buildKeyframes", () => {
  it("ranks by value desc with name tie-break", () => {
    const kf = buildKeyframes(
      [entity("b", [5]), entity("a", [5]), entity("c", [9])],
      1,
    );
    expect(kf[0].entries.get("c")).toEqual({ value: 9, rank: 0 });
    expect(kf[0].entries.get("a")).toEqual({ value: 5, rank: 1 });
    expect(kf[0].entries.get("b")).toEqual({ value: 5, rank: 2 });
    expect(kf[0].maxValue).toBe(9);
  });

  it("applies last-value retention through gaps and is absent before first value", () => {
    const kf = buildKeyframes(
      [entity("a", [null, 3, null, null]), entity("b", [1, 1, 1, 1])],
      4,
    );
    expect(kf[0].entries.has("a")).toBe(false);
    expect(kf[1].entries.get("a")?.value).toBe(3);
    expect(kf[2].entries.get("a")?.value).toBe(3);
    expect(kf[3].entries.get("a")?.value).toBe(3);
    expect(kf[0].maxValue).toBe(1);
    expect(kf[3].maxValue).toBe(3);
  });

  it("ignores excluded entities", () => {
    const kf = buildKeyframes(
      [entity("a", [1]), entity("b", [2], { included: false })],
      1,
    );
    expect([...kf[0].entries.keys()]).toEqual(["a"]);
  });

  it("returns an empty keyframe when nobody is present", () => {
    const kf = buildKeyframes([entity("a", [null, 1])], 2);
    expect(kf[0].entries.size).toBe(0);
    expect(kf[0].maxValue).toBe(0);
  });
});

describe("frameAt", () => {
  const entities = [
    entity("a", [10, 30]),
    entity("b", [20, 20]),
    entity("c", [null, 5]),
  ];
  const ctx = {
    keyframes: buildKeyframes(entities, 2),
    periods: ["2000", "2001"],
    entitiesById: indexEntities(entities),
    topN: 10,
  };

  it("reproduces keyframe values exactly at integer t", () => {
    const f0 = frameAt(ctx, 0);
    expect(f0.bars.map((b) => [b.entityId, b.value, b.rank])).toEqual([
      ["b", 20, 0],
      ["a", 10, 1],
    ]);
    const f1 = frameAt(ctx, 1);
    expect(f1.bars.map((b) => [b.entityId, b.value, b.rank])).toEqual([
      ["a", 30, 0],
      ["b", 20, 1],
      ["c", 5, 2],
    ]);
  });

  it("lerps value, rank and xMax halfway", () => {
    const f = frameAt(ctx, 0.5);
    const a = f.bars.find((b) => b.entityId === "a")!;
    const b = f.bars.find((b) => b.entityId === "b")!;
    expect(a.value).toBe(20);
    expect(a.rank).toBe(0.5);
    expect(b.rank).toBe(0.5);
    expect(f.xMax).toBe(25);
    expect(f.periodIndex).toBe(0);
    expect(f.periodProgress).toBe(0.5);
  });

  it("slides an entering entity in from the slot below topN, growing from 0", () => {
    const f = frameAt(ctx, 0.5);
    const c = f.bars.find((b) => b.entityId === "c")!;
    expect(c.rank).toBe((10 + 2) / 2);
    expect(c.value).toBe(2.5);
    expect(c.opacity).toBe(1); // rank 6 is well inside top 10
  });

  it("clamps opacity at the visible boundary and drops bars past it", () => {
    const small = { ...ctx, topN: 2 };
    const f = frameAt(small, 0.5);
    // c slides from rank 2 (absent → topN) to rank 2 at k1: never visible.
    expect(f.bars.map((b) => b.entityId).sort()).toEqual(["a", "b"]);
    expect(frameAt(small, 1).bars.every((b) => b.opacity === 1)).toBe(true);

    const ents = [
      entity("x", [1, 3]),
      entity("y", [2, 2]),
      entity("z", [3, 1]),
    ];
    const c3 = {
      keyframes: buildKeyframes(ents, 2),
      periods: ["a", "b"],
      entitiesById: indexEntities(ents),
      topN: 2,
    };
    // z goes rank 0 → 2 (out of view): visible with fading opacity mid-way.
    const mid = frameAt(c3, 0.75);
    const z = mid.bars.find((b) => b.entityId === "z")!;
    expect(z.rank).toBe(1.5);
    expect(z.opacity).toBe(0.5);
  });

  it("clamps t to the dataset range", () => {
    expect(frameAt(ctx, -5).t).toBe(0);
    expect(frameAt(ctx, 99).t).toBe(1);
    expect(frameAt(ctx, 99).bars[0].value).toBe(30);
  });

  it("switches the period label at the midpoint", () => {
    expect(frameAt(ctx, 0.49).periodLabel).toBe("2000");
    expect(frameAt(ctx, 0.51).periodLabel).toBe("2001");
  });

  it("returns bars sorted by rank", () => {
    const f = frameAt(ctx, 0.3);
    const ranks = f.bars.map((b) => b.rank);
    expect(ranks).toEqual([...ranks].sort((p, q) => p - q));
  });

  it("handles an empty dataset", () => {
    const f = frameAt(
      { keyframes: [], periods: [], entitiesById: new Map(), topN: 10 },
      0,
    );
    expect(f.bars).toEqual([]);
  });
});

describe("totalDurationSeconds", () => {
  it("is (periods - 1) * secondsPerPeriod, never negative", () => {
    expect(totalDurationSeconds(5, 0.5)).toBe(2);
    expect(totalDurationSeconds(1, 0.5)).toBe(0);
    expect(totalDurationSeconds(0, 0.5)).toBe(0);
  });
});
