import type {
  VideoExportJob,
  VideoExportProgress,
} from "@/core/export/exportVideo";
import type {
  ExportWorkerRequest,
  ExportWorkerResponse,
} from "@/workers/export.worker";

export interface VideoExportHandle {
  /** Resolves with the encoded file; rejects on error or cancel. */
  result: Promise<Blob>;
  cancel: () => void;
}

/**
 * Run a video export in a dedicated worker so encoding never stalls the UI.
 * Bitmaps are cloned before transfer because transferring detaches the
 * originals the preview is still drawing with.
 */
export function startVideoExport(
  job: VideoExportJob,
  bitmaps: ReadonlyMap<string, ImageBitmap>,
  onProgress: (p: VideoExportProgress) => void,
): VideoExportHandle {
  const worker = new Worker(
    new URL("../workers/export.worker.ts", import.meta.url),
    {
      type: "module",
    },
  );

  let settled = false;
  const result = new Promise<Blob>((resolve, reject) => {
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
      worker.terminate();
    };

    worker.onmessage = (ev: MessageEvent<ExportWorkerResponse>) => {
      const msg = ev.data;
      if (msg.type === "progress") onProgress(msg.progress);
      else if (msg.type === "done") finish(() => resolve(msg.blob));
      else {
        const err = new Error(msg.message);
        if (msg.cancelled) err.name = "AbortError";
        finish(() => reject(err));
      }
    };
    worker.onerror = (ev) =>
      finish(() => reject(new Error(ev.message || "Export worker failed.")));

    (async () => {
      const needed = new Set(
        job.dataset.entities.flatMap((e) => (e.imageId ? [e.imageId] : [])),
      );
      const images: [string, ImageBitmap][] = [];
      for (const [id, bmp] of bitmaps) {
        if (needed.has(id)) images.push([id, await createImageBitmap(bmp)]);
      }
      const request: ExportWorkerRequest = { type: "start", job, images };
      worker.postMessage(
        request,
        images.map(([, bmp]) => bmp),
      );
    })().catch((e) => finish(() => reject(e)));
  });

  return {
    result,
    cancel: () => {
      const request: ExportWorkerRequest = { type: "cancel" };
      worker.postMessage(request);
    },
  };
}
