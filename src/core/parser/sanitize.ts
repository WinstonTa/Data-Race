import type { Entity, HealthWarning } from "../types";
import { isBlank, parseNumber } from "./parseNumber";

export interface RawRow {
  entity: Entity;
  /** Raw period cells, used to distinguish blank from unparsable. */
  rawValues: string[];
}

/**
 * Audit parsed rows: flag unparsable cells, exclude rows with no data at all,
 * and warn on duplicate names. Mutates `entity.included` for empty rows.
 */
export function sanitize(rows: RawRow[], periods: string[]): HealthWarning[] {
  const warnings: HealthWarning[] = [];

  if (periods.length === 0) {
    warnings.push({
      kind: "no-period-columns",
      message:
        "No period columns found. Expected a header row like: Name, 2000, 2001, 2002 …",
    });
  }
  if (rows.length === 0) {
    warnings.push({ kind: "no-rows", message: "The file has no data rows." });
  }

  const seen = new Map<string, number>();
  for (const { entity, rawValues } of rows) {
    let hasValue = false;
    rawValues.forEach((raw, i) => {
      if (isBlank(raw)) return;
      if (parseNumber(raw) === null) {
        warnings.push({
          kind: "non-numeric",
          entityId: entity.id,
          period: periods[i],
          message: `"${entity.name}" has a non-numeric value "${raw}" in ${periods[i]}; treated as missing.`,
        });
      } else {
        hasValue = true;
      }
    });

    if (!hasValue) {
      entity.included = false;
      warnings.push({
        kind: "empty-row",
        entityId: entity.id,
        message: `"${entity.name}" has no numeric values and was excluded from the chart.`,
      });
    }

    const key = entity.name.trim().toLowerCase();
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }

  for (const { entity } of rows) {
    const key = entity.name.trim().toLowerCase();
    if ((seen.get(key) ?? 0) > 1) {
      warnings.push({
        kind: "duplicate-name",
        entityId: entity.id,
        message: `"${entity.name}" appears more than once; both rows are shown as separate bars.`,
      });
      seen.set(key, 0); // report once per name
    }
  }

  return warnings;
}
