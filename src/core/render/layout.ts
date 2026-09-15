import type { ChartSettings } from "../types";
import { chartFont } from "./fonts";

/** Every frame is laid out in this fixed logical space and scaled to fit. */
export const LOGICAL_WIDTH = 1920;
export const LOGICAL_HEIGHT = 1080;

export const PADDING = 64;

export const FONTS = {
  title: chartFont(700, 52),
  subtitle: chartFont(400, 28),
  source: chartFont(400, 22),
  period: chartFont(800, 128),
  tick: chartFont(500, 22),
} as const;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ChartLayout {
  titleY: number;
  subtitleY: number;
  /** Area in which bars (not labels) are drawn. */
  bars: Rect;
  /** Right-aligned name labels sit in this gutter left of `bars`. */
  labelGutter: Rect;
  rowHeight: number;
  barHeight: number;
  sourceY: number;
  periodLabel: { x: number; y: number };
}

/** Bar label / value fonts scale with the row height. */
export function barFonts(barHeight: number) {
  const size = Math.round(Math.max(14, Math.min(34, barHeight * 0.5)));
  return { label: chartFont(600, size), value: chartFont(500, size), size };
}

/**
 * Compute the frame layout. `labelGutterWidth` is measured by the caller from
 * the current bar names so the gutter is as narrow as the data allows.
 */
export function computeLayout(
  settings: ChartSettings,
  labelGutterWidth: number,
): ChartLayout {
  let top = PADDING;
  let titleY = 0;
  let subtitleY = 0;

  if (settings.title.trim()) {
    titleY = top + 52;
    top += 52 + 12;
  }
  if (settings.subtitle.trim()) {
    subtitleY = top + 28;
    top += 28 + 12;
  }
  if (titleY || subtitleY) top += 28;

  // Tick labels sit above the bars.
  top += 32;

  const hasSource = settings.source.trim() !== "";
  const bottom = LOGICAL_HEIGHT - PADDING - (hasSource ? 22 + 16 : 0);

  const gutterWidth = Math.min(Math.max(labelGutterWidth, 80), 420);
  const gutterGap = 20;
  const valueReserve = 220; // room for value labels past the longest bar

  const barsX = PADDING + gutterWidth + gutterGap;
  const bars: Rect = {
    x: barsX,
    y: top,
    width: LOGICAL_WIDTH - PADDING - valueReserve - barsX,
    height: bottom - top,
  };

  const rowHeight = bars.height / Math.max(1, settings.topN);
  const barHeight = rowHeight * 0.78;

  return {
    titleY,
    subtitleY,
    bars,
    labelGutter: {
      x: PADDING,
      y: top,
      width: gutterWidth,
      height: bars.height,
    },
    rowHeight,
    barHeight,
    sourceY: LOGICAL_HEIGHT - PADDING + 8,
    periodLabel: {
      x: LOGICAL_WIDTH - PADDING,
      y: LOGICAL_HEIGHT - PADDING - (hasSource ? 40 : 0),
    },
  };
}
