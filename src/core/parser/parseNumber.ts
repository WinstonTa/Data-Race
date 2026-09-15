/** True when a CSV cell carries no data at all (treated as missing, not an error). */
export function isBlank(raw: string | null | undefined): boolean {
  if (raw == null) return true;
  const s = raw.trim().toLowerCase();
  return (
    s === "" ||
    s === "-" ||
    s === "—" ||
    s === "n/a" ||
    s === "na" ||
    s === "null" ||
    s === "nan" ||
    s === "none"
  );
}

/**
 * Parse a human-formatted number cell: "1,234.5", "$12", "45%", "(300)", "1.2e6".
 * Returns null for blank or unparsable input; callers use `isBlank` to tell
 * the two apart.
 */
export function parseNumber(raw: string | null | undefined): number | null {
  if (isBlank(raw)) return null;
  let s = raw!.trim();

  // Accounting-style negatives: (1,234) → -1234
  let negative = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    negative = true;
    s = s.slice(1, -1);
  }

  // Strip currency symbols, thousands separators, percent signs, spaces.
  s = s.replace(/[$€£¥₹,%\s]/g, "");
  // Unicode minus → ASCII
  s = s.replace(/^[−–]/, "-");

  if (s === "" || !/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s))
    return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}
