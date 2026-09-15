/// <reference lib="webworker" />

import {
  exportVideo,
  type VideoExportJob,
  type VideoExportProgress,
} from "@/core/export/exportVideo";
import { loadChartFonts } from "@/core/render/fonts";

/** Messages from the main thread. */
export type ExportWorkerRequest =
  | {
      type: "start";
      job: VideoExportJob;
      images: [id: string, bitmap: ImageBitmap][];
    }
  | { type: "cancel" };

/** Messages to the main thread. */
export type ExportWorkerResponse =
  | { type: "progress"; progress: VideoExportProgress }
  | { type: "done"; blob: Blob }
  | { type: "error"; message: string; cancelled: boolean };

const scope = self as unknown as DedicatedWorkerGlobalScope;
const post = (msg: ExportWorkerResponse) => scope.postMessage(msg);

let abort: AbortController | null = null;
let fontsLoaded: Promise<void> | null = null;

scope.onmessage = async (ev: MessageEvent<ExportWorkerRequest>) => {
  const msg = ev.data;

  if (msg.type === "cancel") {
    abort?.abort();
    return;
  }

  abort = new AbortController();
  const assets = new Map(msg.images);

  try {
    // Same font files the preview uses, so text renders identically.
    fontsLoaded ??= loadChartFonts(scope.fonts, scope.location.origin).catch(
      () => {
        fontsLoaded = null;
      },
    );
    await fontsLoaded;

    const canvas = new OffscreenCanvas(msg.job.width, msg.job.height);
    const blob = await exportVideo(
      canvas,
      msg.job,
      assets,
      (progress) => post({ type: "progress", progress }),
      abort.signal,
    );
    post({ type: "done", blob });
  } catch (e) {
    const cancelled = e instanceof DOMException && e.name === "AbortError";
    post({
      type: "error",
      cancelled,
      message: cancelled
        ? "Export cancelled."
        : e instanceof Error
          ? e.message
          : String(e),
    });
  } finally {
    for (const bmp of assets.values()) bmp.close();
    abort = null;
  }
};
