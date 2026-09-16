import Papa from "papaparse";
import type { ColumnMapping, Dataset, Grid } from "../types";

/**
 * Read CSV text into a rectangular grid of raw cells. Nothing is interpreted
 * here: the header row and column roles are chosen later by a ColumnMapping,
 * so the table editor can show the file exactly as it was written.
 * Fully blank lines are dropped; ragged rows are padded with "".
 */
export function parseGrid(csvText: string): Grid {
  const result = Papa.parse<string[]>(csvText.replace(/^\uFEFF/, ""), {
    header: false,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });
  const rows = result.data.filter((r) => r.some((c) => c.trim() !== ""));
  const width = rows.reduce((w, r) => Math.max(w, r.length), 0);
  return rows.map((r) => {
    const row = r.slice(0, width);
    while (row.length < width) row.push("");
    return row;
  });
}

/** Serialise a grid back to CSV (RFC 4180 quoting, CRLF line endings). */
export function gridToCsv(grid: Grid): string {
  return Papa.unparse(grid, { newline: "\r\n" });
}

/**
 * Rebuild a grid from a Dataset that has no source grid (sample data, v1
 * project files, pre-mapping persisted state). Header row is
 * `Name, [Category], …periods`; entity rows are written in dataset order and
 * the returned dataset has `sourceRow` set so later rebuilds carry edits over.
 */
export function datasetToGrid(dataset: Dataset): {
  grid: Grid;
  mapping: ColumnMapping;
  dataset: Dataset;
} {
  const hasCategory = dataset.entities.some((e) => e.category);
  const header = [
    "Name",
    ...(hasCategory ? ["Category"] : []),
    ...dataset.periods,
  ];
  const grid: Grid = [header];
  for (const e of dataset.entities) {
    grid.push([
      e.name,
      ...(hasCategory ? [e.category ?? ""] : []),
      ...e.values.map((v) => (v === null ? "" : String(v))),
    ]);
  }
  const firstPeriod = hasCategory ? 2 : 1;
  return {
    grid,
    dataset: {
      ...dataset,
      entities: dataset.entities.map((e, i) => ({ ...e, sourceRow: i + 1 })),
    },
    mapping: {
      headerRow: 0,
      nameCol: 0,
      categoryCol: hasCategory ? 1 : undefined,
      periodCols: dataset.periods.map((_, i) => firstPeriod + i),
    },
  };
}
