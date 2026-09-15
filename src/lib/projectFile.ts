import {
  DEFAULT_SETTINGS,
  type ChartSettings,
  type Dataset,
} from "@/core/types";
import { usePlaybackStore } from "@/stores/usePlaybackStore";
import { useProjectStore } from "@/stores/useProjectStore";
import {
  getImageBlob,
  hydrateImages,
  newImageId,
  putImageBlob,
} from "./assets";
import { baseName, downloadBlob } from "./download";

/** Portable project file: everything needed to reopen a project elsewhere. */
export interface ProjectFile {
  app: "data-race";
  version: 1;
  sourceName: string;
  settings: ChartSettings;
  dataset: Dataset;
  /** imageId → data URL */
  images: Record<string, string>;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function saveProjectFile(): Promise<void> {
  const { dataset, settings, sourceName } = useProjectStore.getState();
  if (!dataset) return;

  const images: Record<string, string> = {};
  for (const e of dataset.entities) {
    if (!e.imageId) continue;
    const blob = await getImageBlob(e.imageId);
    if (blob) images[e.imageId] = await blobToDataUrl(blob);
  }

  const file: ProjectFile = {
    app: "data-race",
    version: 1,
    sourceName,
    settings,
    dataset,
    images,
  };
  downloadBlob(
    new Blob([JSON.stringify(file)], { type: "application/json" }),
    `${baseName(sourceName)}.datarace.json`,
  );
}

function isProjectFile(x: unknown): x is ProjectFile {
  if (!x || typeof x !== "object") return false;
  const p = x as Partial<ProjectFile>;
  return (
    p.app === "data-race" &&
    p.version === 1 &&
    !!p.dataset &&
    Array.isArray(p.dataset.periods) &&
    Array.isArray(p.dataset.entities)
  );
}

export async function openProjectFile(file: File): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  if (!isProjectFile(parsed))
    throw new Error("That file is not a Data Race project.");

  // Re-key images so a project opened twice never collides with existing assets.
  const idMap = new Map<string, string>();
  for (const [oldId, dataUrl] of Object.entries(parsed.images ?? {})) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const id = newImageId();
      await putImageBlob(id, blob);
      idMap.set(oldId, id);
    } catch {
      // Skip broken images; the entity simply loses its icon.
    }
  }

  const dataset: Dataset = {
    ...parsed.dataset,
    warnings: parsed.dataset.warnings ?? [],
    entities: parsed.dataset.entities.map((e) => ({
      ...e,
      imageId: e.imageId ? idMap.get(e.imageId) : undefined,
    })),
  };

  usePlaybackStore.setState({ t: 0, playing: false });
  useProjectStore.getState().loadProject({
    dataset,
    settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
    sourceName: parsed.sourceName || file.name,
  });
  await hydrateImages(
    new Set(dataset.entities.flatMap((e) => (e.imageId ? [e.imageId] : []))),
  );
}
