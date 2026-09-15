import { describe, expect, it } from "vitest";
import type { Dataset } from "../types";
import { datasetToGrid, gridToCsv, parseGrid } from "./grid";

describe("parseGrid", () => {
  it("keeps every row verbatim, including preambles", () => {
    const g = parseGrid('"Data Source","WDI",\n\n"Name","2000"\n"A","1"\n');
    expect(g).toEqual([
      ["Data Source", "WDI", ""],
      ["Name", "2000", ""],
      ["A", "1", ""],
    ]);
  });

  it("strips a BOM, handles CRLF and pads ragged rows", () => {
    const g = parseGrid("\uFEFFName,2000,2001\r\nA,1\r\nB,3,4,5\r\n");
    expect(g).toEqual([
      ["Name", "2000", "2001", ""],
      ["A", "1", "", ""],
      ["B", "3", "4", "5"],
    ]);
  });

  it("drops fully blank lines but keeps blank cells", () => {
    const g = parseGrid("Name,2000\n\n  \n,5\nA,\n");
    expect(g).toEqual([
      ["Name", "2000"],
      ["", "5"],
      ["A", ""],
    ]);
  });
});

describe("gridToCsv", () => {
  it("round-trips quoting", () => {
    const grid = [
      ["Name", "2000"],
      ['Smith, "John"', "1,234"],
    ];
    expect(parseGrid(gridToCsv(grid))).toEqual(grid);
  });
});

describe("datasetToGrid", () => {
  it("writes Name, Category and periods with nulls as blanks", () => {
    const ds: Dataset = {
      periods: ["2000", "2001"],
      entities: [
        {
          id: "a",
          name: "A",
          category: "X",
          color: "#000",
          values: [1, null],
          included: true,
        },
        { id: "b", name: "B", color: "#000", values: [2, 3], included: true },
      ],
      warnings: [],
    };
    const { grid, mapping } = datasetToGrid(ds);
    expect(grid).toEqual([
      ["Name", "Category", "2000", "2001"],
      ["A", "X", "1", ""],
      ["B", "", "2", "3"],
    ]);
    expect(mapping).toEqual({
      headerRow: 0,
      nameCol: 0,
      categoryCol: 1,
      periodCols: [2, 3],
    });
  });

  it("omits the category column when no entity has one", () => {
    const ds: Dataset = {
      periods: ["Q1"],
      entities: [{ id: "a", name: "A", color: "#000", values: [1], included: true }],
      warnings: [],
    };
    const { grid, mapping } = datasetToGrid(ds);
    expect(grid[0]).toEqual(["Name", "Q1"]);
    expect(mapping.categoryCol).toBeUndefined();
    expect(mapping.periodCols).toEqual([1]);
  });
});
