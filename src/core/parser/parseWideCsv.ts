import Papa from "papaparse";
import type { Dataset, Entity } from "../types";
import { assignColors } from "../render/palette";
import { detectColumns } from "./detectColumns";
import { parseNumber } from "./parseNumber";
import { sanitize, type RawRow } from "./sanitize";

export interface ParseOptions {
  /** Injected for deterministic tests. */
  idFactory?: () => string;
}

function defaultId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 12);
}

/**
 * Parse a wide-format CSV (`Name, [Category], [Image], period, period, …`)
 * into a Dataset. Never throws on bad data; problems surface as warnings.
 */
export function parseWideCsv(
  csvText: string,
  opts: ParseOptions = {},
): Dataset {
  const idFactory = opts.idFactory ?? defaultId;

  const result = Papa.parse<string[]>(csvText.replace(/^﻿/, ""), {
    header: false,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });

  const rows = result.data.filter((r) => r.some((c) => c.trim() !== ""));
  const headers = (rows[0] ?? []).map((h) => h.trim());
  const columns = detectColumns(headers);

  const rawRows: RawRow[] = [];
  for (const row of rows.slice(1)) {
    const name = (row[columns.nameIndex] ?? "").trim();
    if (name === "") continue;

    const rawValues = columns.periodIndices.map((i) => row[i] ?? "");
    const category =
      columns.categoryIndex !== undefined
        ? (row[columns.categoryIndex] ?? "").trim() || undefined
        : undefined;

    const entity: Entity = {
      id: idFactory(),
      name,
      category,
      color: "#000000", // assigned below
      values: rawValues.map(parseNumber),
      included: true,
    };
    rawRows.push({ entity, rawValues });
  }

  const entities = rawRows.map((r) => r.entity);
  assignColors(entities).forEach((c, i) => (entities[i].color = c));

  const warnings = sanitize(rawRows, columns.periods);
  if (columns.imageIndex !== undefined) {
    warnings.push({
      kind: "image-column-ignored",
      message: `The "${headers[columns.imageIndex]}" column was ignored. Upload icons per row in the table instead.`,
    });
  }

  return { periods: columns.periods, entities, warnings };
}
