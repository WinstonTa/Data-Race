import { describe, expect, it } from "vitest";
import type { ColumnMapping } from "../types";
import { buildDataset } from "./buildDataset";
import { parseGrid } from "./grid";

const rowIds = (r: number) => `r${r}`;

const grid = parseGrid(
  [
    "Name,Code,2000,2001,2002",
    "A,aa,1,2,3",
    "B,bb,4,abc,6",
    "C,cc,,,",
    ",dd,7,8,9",
  ].join("\n"),
);
const mapping: ColumnMapping = {
  headerRow: 0,
  nameCol: 0,
  periodCols: [2, 3, 4],
};

describe("buildDataset", () => {
  it("builds entities from the mapped columns only", () => {
    const ds = buildDataset(grid, mapping, { idFactory: rowIds });
    expect(ds.periods).toEqual(["2000", "2001", "2002"]);
    expect(ds.entities.map((e) => [e.id, e.name, e.sourceRow])).toEqual([
      ["r1", "A", 1],
      ["r2", "B", 2],
      ["r3", "C", 3],
    ]);
    expect(ds.entities[1].values).toEqual([4, null, 6]);
    expect(ds.entities[2].included).toBe(false);
    expect(ds.warnings.map((w) => w.kind)).toEqual([
      "unused-columns",
      "non-numeric",
      "empty-row",
    ]);
    expect(ds.warnings[0].message).toContain('"Code"');
  });

  it("reads a category column and ignores rows above the header", () => {
    const g = parseGrid(
      ["junk,,", "Name,Group,2000", "A,X,1", "B,X,2", "C,Y,3"].join("\n"),
    );
    const ds = buildDataset(
      g,
      { headerRow: 1, nameCol: 0, categoryCol: 1, periodCols: [2] },
      { idFactory: rowIds },
    );
    expect(ds.entities.map((e) => e.category)).toEqual(["X", "X", "Y"]);
    expect(ds.entities[0].color).toBe(ds.entities[1].color);
    expect(ds.entities[2].color).not.toBe(ds.entities[0].color);
    expect(ds.warnings[0]).toMatchObject({ kind: "rows-above-header" });
    expect(ds.warnings[0].message).toContain("1 row above");
  });

  it("carries id, color, icon, Show and category over by sourceRow", () => {
    const first = buildDataset(grid, mapping, { idFactory: rowIds });
    const edited = {
      ...first,
      entities: first.entities.map((e) =>
        e.name === "B"
          ? {
              ...e,
              color: "#123456",
              imageId: "img-1",
              included: false,
              category: "manual",
            }
          : e,
      ),
    };
    // Remap without 2001; a fresh id factory proves B's id was reused.
    const next = buildDataset(
      grid,
      { ...mapping, periodCols: [2, 4] },
      { prev: edited, idFactory: (r) => `new${r}` },
    );
    const b = next.entities.find((e) => e.name === "B")!;
    expect(b).toMatchObject({
      id: "r2",
      color: "#123456",
      imageId: "img-1",
      included: false,
      category: "manual",
      values: [4, 6],
    });
    expect(next.entities[0].id).toBe("r1");
  });

  it("forces Show off when a carried-over row loses all its data", () => {
    const first = buildDataset(grid, mapping, { idFactory: rowIds });
    const next = buildDataset(
      grid,
      { ...mapping, periodCols: [3] }, // B only has "abc" in 2001
      { prev: first, idFactory: rowIds },
    );
    const b = next.entities.find((e) => e.name === "B")!;
    expect(b.values).toEqual([null]);
    expect(b.included).toBe(false);
  });

  it("drops a carried-over category once a category column is mapped", () => {
    const first = buildDataset(grid, mapping, { idFactory: rowIds });
    const prev = {
      ...first,
      entities: first.entities.map((e) => ({ ...e, category: "manual" })),
    };
    const next = buildDataset(
      grid,
      { ...mapping, categoryCol: 1 },
      { prev, idFactory: rowIds },
    );
    expect(next.entities.map((e) => e.category)).toEqual(["aa", "bb", "cc"]);
  });

  it("adds the mapping-uncertain nudge only when asked", () => {
    const ds = buildDataset(grid, mapping, {
      idFactory: rowIds,
      uncertain: true,
    });
    expect(ds.warnings.map((w) => w.kind)).toContain("mapping-uncertain");
    const quiet = buildDataset(grid, mapping, { idFactory: rowIds });
    expect(quiet.warnings.map((w) => w.kind)).not.toContain(
      "mapping-uncertain",
    );
  });

  it("reports no-period-columns when nothing is mapped", () => {
    const ds = buildDataset(grid, { ...mapping, periodCols: [] });
    expect(ds.periods).toEqual([]);
    expect(ds.warnings.map((w) => w.kind)).toContain("no-period-columns");
    expect(ds.entities.every((e) => !e.included)).toBe(true);
  });
});
