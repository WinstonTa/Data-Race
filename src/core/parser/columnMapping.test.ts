import { describe, expect, it } from "vitest";
import { buildSampleCsv } from "@/data/sampleDataset";
import { parseGrid } from "./grid";
import {
  guessHeaderRow,
  normalizeMapping,
  profileColumns,
  suggestMapping,
} from "./columnMapping";
import { WORLD_BANK_CSV } from "./worldbank.fixture";

describe("suggestMapping on a World Bank export", () => {
  const grid = parseGrid(WORLD_BANK_CSV);
  const { mapping, confident } = suggestMapping(grid);

  it("skips the preamble and finds the real header row", () => {
    expect(guessHeaderRow(grid)).toBe(2);
    expect(mapping.headerRow).toBe(2);
  });

  it("picks Country Name, no category, and only the year columns", () => {
    expect(grid[mapping.headerRow][mapping.nameCol]).toBe("Country Name");
    expect(mapping.categoryCol).toBeUndefined();
    expect(mapping.periodCols).toEqual([4, 5, 6, 7, 8, 9]);
  });

  it("leaves the trailing all-blank column unchecked", () => {
    const trailing = profileColumns(grid, 2).at(-1)!;
    expect(trailing.nonBlank).toBe(0);
    expect(mapping.periodCols).not.toContain(trailing.index);
  });

  it("is not confident (header not first, text columns unused)", () => {
    expect(confident).toBe(false);
  });
});

describe("suggestMapping on the bundled sample", () => {
  const grid = parseGrid(buildSampleCsv());
  const { mapping, confident } = suggestMapping(grid);

  it("maps Name, Category and every year with confidence", () => {
    expect(mapping).toEqual({
      headerRow: 0,
      nameCol: 0,
      categoryCol: 1,
      periodCols: Array.from({ length: 15 }, (_, i) => 2 + i),
    });
    expect(confident).toBe(true);
  });
});

describe("suggestMapping edge cases", () => {
  it("honours a pinned header row", () => {
    const grid = parseGrid(WORLD_BANK_CSV);
    const { mapping } = suggestMapping(grid, { headerRow: 0 });
    expect(mapping.headerRow).toBe(0);
  });

  it("falls back to the most-unique text column when no header matches", () => {
    const grid = parseGrid(
      ["Kind,Who,2000,2001", "x,A,1,2", "x,B,3,4", "y,C,5,6"].join("\n"),
    );
    const { mapping } = suggestMapping(grid);
    expect(mapping.nameCol).toBe(1);
    expect(mapping.periodCols).toEqual([2, 3]);
  });

  it("ignores a mostly-numeric column whose header says Category", () => {
    const grid = parseGrid(["Name,Category,2000", "A,1,10", "B,2,20"].join("\n"));
    const { mapping } = suggestMapping(grid);
    expect(mapping.categoryCol).toBe(1);
    expect(mapping.periodCols).toEqual([2]);
  });

  it("is not confident when many period cells are unparsable", () => {
    const rows = ["Name,2000,2001"];
    for (let i = 0; i < 10; i++) rows.push(`E${i},${i},${i < 2 ? "abc" : i}`);
    const { mapping, confident } = suggestMapping(parseGrid(rows.join("\n")));
    expect(mapping.periodCols).toEqual([1, 2]);
    expect(confident).toBe(false);
  });

  it("handles an empty grid", () => {
    expect(suggestMapping([])).toEqual({
      mapping: { headerRow: 0, nameCol: 0, periodCols: [] },
      confident: false,
    });
  });
});

describe("normalizeMapping", () => {
  const grid = parseGrid(["Name,Category,2000,2001", "A,X,1,2"].join("\n"));

  it("removes name/category from periods, dedupes and sorts", () => {
    const m = normalizeMapping(grid, {
      headerRow: 0,
      nameCol: 0,
      categoryCol: 1,
      periodCols: [3, 1, 0, 2, 3, 9],
    });
    expect(m.periodCols).toEqual([2, 3]);
  });

  it("clamps out-of-range indices", () => {
    const m = normalizeMapping(grid, {
      headerRow: 42,
      nameCol: 7,
      categoryCol: 7,
      periodCols: [2],
    });
    expect(m).toEqual({
      headerRow: 1,
      nameCol: 0,
      categoryCol: undefined,
      periodCols: [2],
    });
  });
});
