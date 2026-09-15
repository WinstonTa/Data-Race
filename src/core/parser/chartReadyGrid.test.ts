import { describe, expect, it } from "vitest";
import { toChartReadyGrid } from "./chartReadyGrid";
import { suggestMapping } from "./columnMapping";
import { parseGrid } from "./grid";
import { WORLD_BANK_CSV } from "./worldbank.fixture";

describe("toChartReadyGrid", () => {
  it("keeps only Name + periods, normalises numbers, drops the preamble", () => {
    const grid = parseGrid(WORLD_BANK_CSV);
    const out = toChartReadyGrid(grid, suggestMapping(grid).mapping);
    expect(out[0]).toEqual([
      "Name",
      "1960",
      "1961",
      "1962",
      "1963",
      "1964",
      "1965",
    ]);
    expect(out).toHaveLength(10);
    expect(out[1]).toEqual([
      "Aruba",
      "",
      "",
      "",
      "405586592.178771",
      "487709497.206704",
      "596648044.692737",
    ]);
    // Reloading the result needs no guessing.
    expect(suggestMapping(out).confident).toBe(true);
  });

  it("includes a mapped category column and blanks unparsable cells", () => {
    const grid = parseGrid(
      ["Name,Group,2000,2001", 'A,X,"1,000",abc', ",Y,1,2"].join("\n"),
    );
    const out = toChartReadyGrid(grid, {
      headerRow: 0,
      nameCol: 0,
      categoryCol: 1,
      periodCols: [2, 3],
    });
    expect(out).toEqual([
      ["Name", "Category", "2000", "2001"],
      ["A", "X", "1000", ""],
    ]);
  });
});
