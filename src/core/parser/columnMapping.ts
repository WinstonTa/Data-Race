import type { ColumnMapping, Grid } from "../types";
import { isBlank, parseNumber } from "./parseNumber";

export const CATEGORY_HEADERS = /^(category|group|type|sector|region|continent)$/i;
export const IMAGE_HEADERS =
  /^(image|img|icon|flag|logo|picture|photo|image\s*url)$/i;
const NAME_HEADERS =
  /^(name|country|entity|label|title|company|team|player|item|brand|city|state)/i;

/** How many leading rows are considered when guessing the header row. */
const HEADER_SEARCH_ROWS = 25;
/** A column is a period candidate when this share of its non-blank cells parse. */
const PERIOD_NUMERIC_RATIO = 0.8;
/** Above this share of unparsable period cells the suggestion is flagged. */
const UNCERTAIN_BAD_CELL_RATIO = 0.05;

/** Per-column statistics over the rows below the header. */
export interface ColumnProfile {
  index: number;
  header: string;
  nonBlank: number;
  numeric: number;
  unique: number;
}

export interface MappingSuggestion {
  mapping: ColumnMapping;
  /** false → the UI should ask the user to check the column setup. */
  confident: boolean;
}

function width(grid: Grid): number {
  return grid[0]?.length ?? 0;
}

function nonBlankCount(row: string[]): number {
  return row.reduce((n, c) => n + (isBlank(c) ? 0 : 1), 0);
}

export function profileColumns(grid: Grid, headerRow: number): ColumnProfile[] {
  const profiles: ColumnProfile[] = [];
  const header = grid[headerRow] ?? [];
  for (let c = 0; c < width(grid); c++) {
    let nonBlank = 0;
    let numeric = 0;
    const seen = new Set<string>();
    for (let r = headerRow + 1; r < grid.length; r++) {
      const raw = grid[r][c] ?? "";
      if (isBlank(raw)) continue;
      nonBlank++;
      seen.add(raw.trim().toLowerCase());
      if (parseNumber(raw) !== null) numeric++;
    }
    profiles.push({
      index: c,
      header: (header[c] ?? "").trim(),
      nonBlank,
      numeric,
      unique: seen.size,
    });
  }
  return profiles;
}

export function isPeriodCandidate(p: ColumnProfile): boolean {
  return (
    p.numeric >= 1 &&
    p.numeric / p.nonBlank >= PERIOD_NUMERIC_RATIO &&
    !CATEGORY_HEADERS.test(p.header)
  );
}

/** The row with the most non-blank cells among the first few; ties → earliest. */
export function guessHeaderRow(grid: Grid): number {
  let best = 0;
  let bestCount = -1;
  const limit = Math.min(grid.length, HEADER_SEARCH_ROWS);
  for (let r = 0; r < limit; r++) {
    const n = nonBlankCount(grid[r]);
    if (n > bestCount) {
      best = r;
      bestCount = n;
    }
  }
  return best;
}

/**
 * Guess which row is the header and which columns are the entity name, the
 * category and the periods. Deterministic; the caller may pin the header row
 * (e.g. after the user picks one) and get fresh column guesses for it.
 */
export function suggestMapping(
  grid: Grid,
  opts: { headerRow?: number } = {},
): MappingSuggestion {
  if (grid.length === 0 || width(grid) === 0) {
    return {
      mapping: { headerRow: 0, nameCol: 0, periodCols: [] },
      confident: false,
    };
  }
  const headerRow = Math.min(
    Math.max(opts.headerRow ?? guessHeaderRow(grid), 0),
    grid.length - 1,
  );
  const profiles = profileColumns(grid, headerRow);

  const periodCols = profiles.filter(isPeriodCandidate).map((p) => p.index);
  const periodSet = new Set(periodCols);
  const textCols = profiles.filter(
    (p) => !periodSet.has(p.index) && p.nonBlank > 0,
  );

  let nameCol =
    textCols.find((p) => NAME_HEADERS.test(p.header))?.index ??
    textCols.reduce<ColumnProfile | undefined>((best, p) => {
      if (!best) return p;
      return p.unique / p.nonBlank > best.unique / best.nonBlank ? p : best;
    }, undefined)?.index;
  if (nameCol === undefined) {
    // Everything numeric (or empty): fall back to column 0 as the name.
    nameCol = 0;
    periodSet.delete(0);
  }

  const categoryCol = textCols.find(
    (p) => p.index !== nameCol && CATEGORY_HEADERS.test(p.header),
  )?.index;

  const mapping = normalizeMapping(grid, {
    headerRow,
    nameCol,
    categoryCol,
    periodCols: [...periodSet],
  });

  return { mapping, confident: assessConfidence(profiles, mapping) };
}

function assessConfidence(
  profiles: ColumnProfile[],
  mapping: ColumnMapping,
): boolean {
  if (mapping.headerRow > 0) return false;
  if (mapping.periodCols.length === 0) return false;
  const assigned = new Set([
    mapping.nameCol,
    ...(mapping.categoryCol !== undefined ? [mapping.categoryCol] : []),
    ...mapping.periodCols,
  ]);
  if (profiles.some((p) => p.nonBlank > 0 && !assigned.has(p.index)))
    return false;
  let nonBlank = 0;
  let numeric = 0;
  for (const c of mapping.periodCols) {
    nonBlank += profiles[c].nonBlank;
    numeric += profiles[c].numeric;
  }
  return nonBlank === 0 || 1 - numeric / nonBlank <= UNCERTAIN_BAD_CELL_RATIO;
}

/**
 * Clamp indices into the grid, drop duplicates, and keep the name/category
 * columns out of the period list. Always returns a fresh object.
 */
export function normalizeMapping(
  grid: Grid,
  mapping: ColumnMapping,
): ColumnMapping {
  const w = width(grid);
  const inRange = (i: number) => Number.isInteger(i) && i >= 0 && i < w;
  const headerRow = Math.min(
    Math.max(mapping.headerRow, 0),
    Math.max(grid.length - 1, 0),
  );
  const nameCol = inRange(mapping.nameCol) ? mapping.nameCol : 0;
  const categoryCol =
    mapping.categoryCol !== undefined &&
    inRange(mapping.categoryCol) &&
    mapping.categoryCol !== nameCol
      ? mapping.categoryCol
      : undefined;
  const periodCols = [...new Set(mapping.periodCols)]
    .filter((c) => inRange(c) && c !== nameCol && c !== categoryCol)
    .sort((a, b) => a - b);
  return { headerRow, nameCol, categoryCol, periodCols };
}
