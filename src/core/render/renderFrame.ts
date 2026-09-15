import { format as d3format } from "d3-format";
import { scaleLinear } from "d3-scale";
import type { ChartSettings, FrameState } from "../types";
import { drawCircularImage, roundedRectPath, type Ctx2D } from "./drawBar";
import {
  barFonts,
  computeLayout,
  FONTS,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
} from "./layout";
import { TextMeasurer } from "./textCache";

/** Decoded images keyed by `Entity.imageId`. */
export type RenderAssets = ReadonlyMap<string, CanvasImageSource>;

export interface Renderer {
  render(
    frame: FrameState,
    settings: ChartSettings,
    assets: RenderAssets,
  ): void;
  /** Drop cached text metrics (call after fonts finish loading). */
  invalidate(): void;
}

const formatterCache = new Map<string, (n: number) => string>();

function formatter(spec: string): (n: number) => string {
  let f = formatterCache.get(spec);
  if (!f) {
    try {
      f = d3format(spec);
    } catch {
      f = d3format(",.0f");
    }
    formatterCache.set(spec, f);
  }
  return f;
}

/**
 * Create a renderer bound to a 2D context. The caller owns the transform:
 * set it so that the logical 1920x1080 space maps onto the target surface
 * before calling `render`. Everything drawn here is pure Canvas2D and runs
 * unchanged inside the export worker.
 */
export function createRenderer(ctx: Ctx2D): Renderer {
  const measurer = new TextMeasurer(ctx);

  function render(
    frame: FrameState,
    settings: ChartSettings,
    assets: RenderAssets,
  ): void {
    const fmt = formatter(settings.numberFormat);
    const { bars } = frame;

    ctx.save();
    ctx.textBaseline = "alphabetic";

    // Background
    ctx.fillStyle = settings.background;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Layout depends on the widest visible name.
    const probeFonts = barFonts(
      (LOGICAL_HEIGHT / Math.max(1, settings.topN)) * 0.78,
    );
    let gutter = 0;
    for (const b of bars)
      gutter = Math.max(gutter, measurer.width(probeFonts.label, b.name));
    const layout = computeLayout(settings, gutter);
    const fonts = barFonts(layout.barHeight);

    // Title block
    ctx.fillStyle = settings.textColor;
    ctx.textAlign = "left";
    if (layout.titleY) {
      ctx.font = FONTS.title;
      ctx.fillText(settings.title, layout.labelGutter.x, layout.titleY);
    }
    if (layout.subtitleY) {
      ctx.font = FONTS.subtitle;
      ctx.globalAlpha = 0.7;
      ctx.fillText(settings.subtitle, layout.labelGutter.x, layout.subtitleY);
      ctx.globalAlpha = 1;
    }

    // Axis: smooth domain (no .nice()) so the scale never jumps between frames.
    const domainMax = Math.max(frame.xMax, Number.EPSILON) * 1.05;
    const x = scaleLinear()
      .domain([0, domainMax])
      .range([0, layout.bars.width]);
    const ticks = x.ticks(6);

    ctx.font = FONTS.tick;
    ctx.textAlign = "center";
    ctx.lineWidth = 1;
    for (const tick of ticks) {
      const tx = layout.bars.x + x(tick);
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = settings.textColor;
      ctx.beginPath();
      ctx.moveTo(tx, layout.bars.y - 6);
      ctx.lineTo(tx, layout.bars.y + layout.bars.height);
      ctx.stroke();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = settings.textColor;
      ctx.fillText(fmt(tick), tx, layout.bars.y - 12);
    }
    ctx.globalAlpha = 1;

    // Bars
    const labelRight = layout.labelGutter.x + layout.labelGutter.width;
    const imageDiameter = layout.barHeight * 0.9;
    const textDy = fonts.size * 0.36; // visually centre alphabetic baseline

    for (const b of bars) {
      const y =
        layout.bars.y +
        b.rank * layout.rowHeight +
        (layout.rowHeight - layout.barHeight) / 2;
      const w = Math.max(0, x(Math.max(0, b.value)));
      const cy = y + layout.barHeight / 2;

      ctx.globalAlpha = b.opacity;

      ctx.fillStyle = b.color;
      roundedRectPath(
        ctx,
        layout.bars.x,
        y,
        w,
        layout.barHeight,
        settings.barCornerRadius,
      );
      ctx.fill();

      ctx.fillStyle = settings.textColor;
      ctx.font = fonts.label;
      ctx.textAlign = "right";
      ctx.fillText(
        measurer.fit(fonts.label, b.name, layout.labelGutter.width),
        labelRight,
        cy + textDy,
      );

      let valueX = layout.bars.x + w + 14;
      const image = b.imageId ? assets.get(b.imageId) : undefined;
      if (image) {
        const inside = w >= imageDiameter + 16;
        const cx = inside
          ? layout.bars.x + w - imageDiameter / 2 - 6
          : layout.bars.x + w + imageDiameter / 2 + 6;
        drawCircularImage(
          ctx,
          image,
          cx,
          cy,
          imageDiameter,
          inside ? settings.background : undefined,
        );
        if (!inside) valueX = cx + imageDiameter / 2 + 12;
      }

      ctx.font = fonts.value;
      ctx.textAlign = "left";
      ctx.fillText(fmt(b.value), valueX, cy + textDy);
    }
    ctx.globalAlpha = 1;

    // Big period label
    ctx.font = FONTS.period;
    ctx.textAlign = "right";
    ctx.fillStyle = settings.textColor;
    ctx.globalAlpha = 0.22;
    ctx.fillText(frame.periodLabel, layout.periodLabel.x, layout.periodLabel.y);
    ctx.globalAlpha = 1;

    // Source line
    if (settings.source.trim()) {
      ctx.font = FONTS.source;
      ctx.textAlign = "left";
      ctx.globalAlpha = 0.6;
      ctx.fillText(settings.source, layout.labelGutter.x, layout.sourceY);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  return { render, invalidate: () => measurer.clear() };
}
