export interface ColumnMap {
  /** Index of the entity-name column (always the first column). */
  nameIndex: number;
  categoryIndex?: number;
  imageIndex?: number;
  /** Indices of period columns in file order. */
  periodIndices: number[];
  /** Header labels for the period columns, same order as `periodIndices`. */
  periods: string[];
}

const CATEGORY_HEADERS = /^(category|group|type|sector|region|continent)$/i;
const IMAGE_HEADERS = /^(image|img|icon|flag|logo|picture|photo|image\s*url)$/i;

/**
 * Wide-format layout: first column is the entity name, optional
 * Category / Image columns anywhere, every other non-blank header is a period.
 */
export function detectColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = { nameIndex: 0, periodIndices: [], periods: [] };

  for (let i = 1; i < headers.length; i++) {
    const h = (headers[i] ?? "").trim();
    if (h === "") continue; // trailing empty columns from spreadsheet exports
    if (map.categoryIndex === undefined && CATEGORY_HEADERS.test(h)) {
      map.categoryIndex = i;
    } else if (map.imageIndex === undefined && IMAGE_HEADERS.test(h)) {
      map.imageIndex = i;
    } else {
      map.periodIndices.push(i);
      map.periods.push(h);
    }
  }
  return map;
}
