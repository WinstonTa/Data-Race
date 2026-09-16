import type {
  ColumnMapping,
  Dataset,
  Entity,
  Grid,
  HealthWarning,
} from "../types";
import { assignColors } from "../render/palette";
import { normalizeMapping, profileColumns } from "./columnMapping";
import { parseNumber } from "./parseNumber";
import { sanitize, type RawRow } from "./sanitize";

export interface BuildOptions {
  /**
   * Previous dataset built from the same grid. Entities are matched by
   * `sourceRow` and keep their id, color, icon and Show toggle, so remapping
   * columns or editing a cell never loses user edits.
   */
  prev?: Dataset | null;
  /** Injected for deterministic tests. Receives the grid row index. */
  idFactory?: (sourceRow: number) => string;
  /** True when `mapping` is an unreviewed auto-suggestion; adds a nudge. */
  uncertain?: boolean;
}

function defaultId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 12);
}

function quoteList(items: string[]): string {
  return items.map((s) => `"${s}"`).join(", ");
}

/**
 * Turn a raw grid plus a column mapping into a Dataset. Never throws on bad
 * data; problems surface as warnings.
 */
export function buildDataset(
  grid: Grid,
  rawMapping: ColumnMapping,
  opts: BuildOptions = {},
): Dataset {
  const mapping = normalizeMapping(grid, rawMapping);
  const idFactory = opts.idFactory ?? defaultId;
  const header = grid[mapping.headerRow] ?? [];
  const periods = mapping.periodCols.map((c) => (header[c] ?? "").trim());

  const prevByRow = new Map<number, Entity>();
  for (const e of opts.prev?.entities ?? []) {
    if (e.sourceRow !== undefined) prevByRow.set(e.sourceRow, e);
  }

  const rawRows: RawRow[] = [];
  for (let r = mapping.headerRow + 1; r < grid.length; r++) {
    const row = grid[r];
    const name = (row[mapping.nameCol] ?? "").trim();
    if (name === "") continue;

    const rawValues = mapping.periodCols.map((c) => row[c] ?? "");
    const mappedCategory =
      mapping.categoryCol !== undefined
        ? (row[mapping.categoryCol] ?? "").trim() || undefined
        : undefined;
    const prev = prevByRow.get(r);

    const entity: Entity = {
      id: prev?.id ?? idFactory(r),
      name,
      category:
        mapping.categoryCol !== undefined ? mappedCategory : prev?.category,
      color: prev?.color ?? "", // filled in below for new rows
      imageId: prev?.imageId,
      values: rawValues.map(parseNumber),
      included: prev?.included ?? true,
      sourceRow: r,
    };
    rawRows.push({ entity, rawValues });
  }

  const entities = rawRows.map((r) => r.entity);
  const palette = assignColors(entities);
  entities.forEach((e, i) => {
    if (!e.color) e.color = palette[i];
  });

  const warnings: HealthWarning[] = [];
  if (mapping.headerRow > 0) {
    const n = mapping.headerRow;
    warnings.push({
      kind: "rows-above-header",
      message: `${n} row${n === 1 ? "" : "s"} above the header row ${n === 1 ? "is" : "are"} ignored.`,
    });
  }
  const assigned = new Set([
    mapping.nameCol,
    ...(mapping.categoryCol !== undefined ? [mapping.categoryCol] : []),
    ...mapping.periodCols,
  ]);
  const unused = profileColumns(grid, mapping.headerRow)
    .filter((p) => p.nonBlank > 0 && !assigned.has(p.index))
    .map((p) => p.header || `column ${p.index + 1}`);
  if (unused.length > 0) {
    warnings.push({
      kind: "unused-columns",
      message: `${unused.length} column${unused.length === 1 ? " is" : "s are"} not used in the chart: ${quoteList(unused)}. Tick a column's "Period" box in the table to include it.`,
    });
  }
  if (opts.uncertain) {
    warnings.push({
      kind: "mapping-uncertain",
      message:
        "The header row and column roles were guessed. Check the column setup in the table below.",
    });
  }
  warnings.push(...sanitize(rawRows, periods));

  return { periods, entities, warnings };
}
