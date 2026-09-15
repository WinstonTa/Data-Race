/**
 * Shared data model for Data Race.
 *
 * Everything in `src/core` is pure TypeScript with no DOM or React imports so
 * the same code runs on the main thread (preview) and inside the export worker.
 */

/** One row of the wide CSV: an entity racing over time. */
export interface Entity {
  /** Stable id (survives renames). */
  id: string;
  name: string;
  category?: string;
  /** Hex color; auto-assigned from the palette, user-overridable. */
  color: string;
  /** Key into the asset store (uploaded icon/flag). */
  imageId?: string;
  /** Raw parsed values, one per period, before last-value retention. */
  values: (number | null)[];
  /** false = excluded from the chart (auto for all-null rows; user-toggleable). */
  included: boolean;
}

export type HealthWarningKind =
  | "empty-row"
  | "non-numeric"
  | "duplicate-name"
  | "no-period-columns"
  | "no-rows"
  | "image-column-ignored";

export interface HealthWarning {
  kind: HealthWarningKind;
  message: string;
  entityId?: string;
  period?: string;
}

export interface Dataset {
  /** Period labels in file order (raw header strings). */
  periods: string[];
  entities: Entity[];
  warnings: HealthWarning[];
}

export interface ChartSettings {
  title: string;
  subtitle: string;
  source: string;
  /** Number of bars shown. */
  topN: number;
  /** Real-time seconds spent moving from one period to the next. */
  secondsPerPeriod: number;
  /** d3-format specifier for value labels and axis ticks. */
  numberFormat: string;
  background: string;
  textColor: string;
  barCornerRadius: number;
}

export const DEFAULT_SETTINGS: ChartSettings = {
  title: "",
  subtitle: "",
  source: "",
  topN: 10,
  secondsPerPeriod: 0.5,
  numberFormat: ",.0f",
  background: "#ffffff",
  textColor: "#18181b",
  barCornerRadius: 6,
};

/** Precomputed state of every present entity at one period. */
export interface KeyframeEntry {
  value: number;
  /** 0 = top bar. Integer at keyframes. */
  rank: number;
}

export interface Keyframe {
  periodIndex: number;
  entries: Map<string, KeyframeEntry>;
  /** Largest value among present entities (0 when nobody is present). */
  maxValue: number;
}

/** One bar, ready to draw. */
export interface BarState {
  entityId: string;
  name: string;
  color: string;
  imageId?: string;
  value: number;
  /** Fractional between keyframes; bars slide along it. */
  rank: number;
  /** 1 inside the top N, fading to 0 as the bar slides past the last slot. */
  opacity: number;
}

/** Everything the renderer needs for one frame. */
export interface FrameState {
  /** Continuous time in period units, 0 .. periods.length - 1. */
  t: number;
  periodIndex: number;
  /** 0..1 progress from periodIndex to periodIndex + 1. */
  periodProgress: number;
  periodLabel: string;
  bars: BarState[];
  /** Interpolated maximum value; the renderer derives a nice axis from it. */
  xMax: number;
}
