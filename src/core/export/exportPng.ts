import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from "../render/layout";
import { createRenderer, type RenderAssets } from "../render/renderFrame";
import type { FrameContext } from "../timeline/frameAt";
import { frameAt } from "../timeline/frameAt";
import type { ChartSettings } from "../types";

/** Render the frame at `t` to a PNG at the given resolution (default 1080p). */
export async function exportPng(
  frameCtx: FrameContext,
  settings: ChartSettings,
  assets: RenderAssets,
  t: number,
  width = LOGICAL_WIDTH,
  height = LOGICAL_HEIGHT,
): Promise<Blob> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create a 2D canvas context.");

  const scale = Math.min(width / LOGICAL_WIDTH, height / LOGICAL_HEIGHT);
  ctx.fillStyle = settings.background;
  ctx.fillRect(0, 0, width, height);
  ctx.setTransform(
    scale,
    0,
    0,
    scale,
    (width - LOGICAL_WIDTH * scale) / 2,
    (height - LOGICAL_HEIGHT * scale) / 2,
  );
  createRenderer(ctx).render(frameAt(frameCtx, t), settings, assets);

  return canvas.convertToBlob({ type: "image/png" });
}
