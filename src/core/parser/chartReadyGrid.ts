import type { ColumnMapping, Grid } from "../types";
import { normalizeMapping } from "./columnMapping";
import { isBlank, parseNumber } from "./parseNumber";

/**
 * Project a mapped grid down to the wide layout this app reads without any
 * guessing: `Name, [Category], period, period, …`. Period cells are
 * normalised to plain numbers; blanks and unparsable cells become "".
 * Rows above the header and rows with a blank name are dropped.
 */
export function toChartReadyGrid(grid: Grid, rawMapping: ColumnMapping): Grid {
  const mapping = normalizeMapping(grid, rawMapping);
  const header = grid[mapping.headerRow] ?? [];
  const textCols = [
    mapping.nameCol,
    ...(mapping.categoryCol !== undefined ? [mapping.categoryCol] : []),
  ];
  const out: Grid = [
    [
      "Name",
      ...(mapping.categoryCol !== undefined ? ["Category"] : []),
      ...mapping.periodCols.map((c) => (header[c] ?? "").trim()),
    ],
  ];
  for (let r = mapping.headerRow + 1; r < grid.length; r++) {
    const row = grid[r];
    if (isBlank(row[mapping.nameCol])) continue;
    out.push([
      ...textCols.map((c) => (row[c] ?? "").trim()),
      ...mapping.periodCols.map((c) => {
        const n = parseNumber(row[c]);
        return n === null ? "" : String(n);
      }),
    ]);
  }
  return out;
}
