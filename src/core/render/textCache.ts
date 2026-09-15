type MeasuringContext = Pick<CanvasRenderingContext2D, "measureText"> & {
  font: string;
};

const MAX_ENTRIES = 4000;

/**
 * Memoizes `measureText` widths keyed by font + string. Measuring is the most
 * expensive Canvas2D text call and label sets barely change frame to frame.
 */
export class TextMeasurer {
  private cache = new Map<string, number>();

  constructor(private ctx: MeasuringContext) {}

  width(font: string, text: string): number {
    const key = font + " " + text;
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit;

    if (this.cache.size >= MAX_ENTRIES) this.cache.clear();
    this.ctx.font = font;
    const w = this.ctx.measureText(text).width;
    this.cache.set(key, w);
    return w;
  }

  /** Truncate `text` with an ellipsis so it fits within `maxWidth`. */
  fit(font: string, text: string, maxWidth: number): string {
    if (this.width(font, text) <= maxWidth) return text;
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.width(font, text.slice(0, mid) + "…") <= maxWidth) lo = mid;
      else hi = mid - 1;
    }
    return lo === 0 ? "" : text.slice(0, lo) + "…";
  }

  clear(): void {
    this.cache.clear();
  }
}
