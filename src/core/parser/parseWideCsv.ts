import type { Dataset } from "../types";
import { buildDataset } from "./buildDataset";
import { suggestMapping } from "./columnMapping";
import { parseGrid } from "./grid";

export interface ParseOptions {
  /** Injected for deterministic tests. */
  idFactory?: (sourceRow: number) => string;
}

/**
 * One-shot convenience: parse CSV text into a Dataset using the auto-detected
 * column mapping. The app itself keeps the grid + mapping around (see
 * `useProjectStore.loadSource`) so the user can correct the guess.
 */
export function parseWideCsv(
  csvText: string,
  opts: ParseOptions = {},
): Dataset {
  const grid = parseGrid(csvText);
  const { mapping, confident } = suggestMapping(grid);
  return buildDataset(grid, mapping, {
    idFactory: opts.idFactory,
    uncertain: !confident,
  });
}
