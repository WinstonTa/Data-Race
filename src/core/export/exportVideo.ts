import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  WebMOutputFormat,
} from "mediabunny";
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from "../render/layout";
import { createRenderer, type RenderAssets } from "../render/renderFrame";
import { buildKeyframes } from "../timeline/buildKeyframes";
import {
  frameAt,
  indexEntities,
  totalDurationSeconds,
} from "../timeline/frameAt";
import type { ChartSettings, Dataset } from "../types";
import type { ExportPlan } from "./codecSupport";

export interface VideoExportJob {
  dataset: Pick<Dataset, "periods" | "entities">;
  settings: ChartSettings;
  fps: 30 | 60;
  width: number;
  height: number;
  plan: ExportPlan;
}

export interface VideoExportProgress {
  frame: number;
  totalFrames: number;
}

/** Bitrate for 1080p; scaled by pixel count for other sizes. */
const BITRATE_1080P = 12_000_000;

export function videoFrameCount(
  job: Pick<VideoExportJob, "dataset" | "settings" | "fps">,
): number {
  const seconds = totalDurationSeconds(
    job.dataset.periods.length,
    job.settings.secondsPerPeriod,
  );
  return Math.round(seconds * job.fps) + 1; // inclusive of the final keyframe
}

/**
 * Deterministic frame-stepped export: render frame N, hand it to the encoder,
 * wait for backpressure, then render frame N+1. Never samples the wall clock,
 * so the same project always produces the same file. Runs on the main thread
 * or inside a worker (OffscreenCanvas) — it only touches Canvas2D + WebCodecs.
 */
export async function exportVideo(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  job: VideoExportJob,
  assets: RenderAssets,
  onProgress: (p: VideoExportProgress) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const { dataset, settings, fps, width, height, plan } = job;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d") as
    OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (!ctx) throw new Error("Could not create a 2D canvas context.");

  const renderer = createRenderer(ctx);
  const frameCtx = {
    keyframes: buildKeyframes(dataset.entities, dataset.periods.length),
    periods: dataset.periods,
    entitiesById: indexEntities(dataset.entities),
    topN: settings.topN,
  };

  const bitrate = Math.round(
    (BITRATE_1080P * (width * height)) / (1920 * 1080),
  );
  const output = new Output({
    format:
      plan.container === "mp4"
        ? new Mp4OutputFormat({ fastStart: "in-memory" })
        : new WebMOutputFormat(),
    target: new BufferTarget(),
  });
  const source = new CanvasSource(canvas, { codec: plan.codec, bitrate });
  output.addVideoTrack(source, { frameRate: fps });
  await output.start();

  const totalFrames = videoFrameCount(job);
  const scale = Math.min(width / LOGICAL_WIDTH, height / LOGICAL_HEIGHT);
  const ox = (width - LOGICAL_WIDTH * scale) / 2;
  const oy = (height - LOGICAL_HEIGHT * scale) / 2;

  try {
    for (let f = 0; f < totalFrames; f++) {
      if (signal?.aborted)
        throw new DOMException("Export cancelled", "AbortError");

      const t = f / fps / settings.secondsPerPeriod;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = settings.background;
      ctx.fillRect(0, 0, width, height);
      ctx.setTransform(scale, 0, 0, scale, ox, oy);
      renderer.render(frameAt(frameCtx, t), settings, assets);

      await source.add(f / fps, 1 / fps);
      onProgress({ frame: f + 1, totalFrames });
    }
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => {});
    throw e;
  }

  const buffer = output.target.buffer;
  if (!buffer) throw new Error("Encoder produced no output.");
  return new Blob([buffer], { type: plan.mimeType });
}
