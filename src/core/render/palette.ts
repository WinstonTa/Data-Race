/** Categorical palette tuned to stay distinct on a white background. */
export const DEFAULT_PALETTE: readonly string[] = [
  "#4f46e5", // indigo
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // red
  "#3b82f6", // blue
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#8b5cf6", // violet
  "#84cc16", // lime
  "#06b6d4", // cyan
  "#e11d48", // rose
  "#a16207", // yellow-800
  "#0ea5e9", // sky
  "#d946ef", // fuchsia
  "#22c55e", // green
  "#6366f1", // indigo-500
  "#fb7185", // rose-400
  "#0d9488", // teal-600
  "#c026d3", // fuchsia-600
];

/**
 * Assign a color to each entity. Entities sharing a category share a color;
 * uncategorised entities each get the next palette color.
 */
export function assignColors(
  entities: { category?: string }[],
  palette: readonly string[] = DEFAULT_PALETTE,
): string[] {
  const byCategory = new Map<string, string>();
  let next = 0;
  const take = () => palette[next++ % palette.length];

  return entities.map((e) => {
    const cat = e.category?.trim();
    if (!cat) return take();
    let c = byCategory.get(cat);
    if (!c) {
      c = take();
      byCategory.set(cat, c);
    }
    return c;
  });
}
