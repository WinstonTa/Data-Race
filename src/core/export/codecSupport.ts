import { canEncodeVideo } from "mediabunny";

export interface ExportPlan {
  codec: "avc" | "vp9";
  container: "mp4" | "webm";
  extension: "mp4" | "webm";
  mimeType: string;
  /** Human-readable, e.g. "MP4 (H.264)". */
  label: string;
}

const PLANS: ExportPlan[] = [
  {
    codec: "avc",
    container: "mp4",
    extension: "mp4",
    mimeType: "video/mp4",
    label: "MP4 (H.264)",
  },
  {
    codec: "vp9",
    container: "webm",
    extension: "webm",
    mimeType: "video/webm",
    label: "WebM (VP9)",
  },
];

/**
 * Pick the best video export the current browser can encode, or null when
 * WebCodecs is unavailable. H.264 support depends on OS/hardware, so this
 * must be probed at runtime rather than inferred from the user agent.
 */
export async function probeExportPlan(
  width: number,
  height: number,
): Promise<ExportPlan | null> {
  if (typeof VideoEncoder === "undefined") return null;
  for (const plan of PLANS) {
    try {
      if (await canEncodeVideo(plan.codec, { width, height })) return plan;
    } catch {
      // Treat probe failures as unsupported and keep looking.
    }
  }
  return null;
}
