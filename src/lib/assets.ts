import { createStore, del, entries, get, set } from "idb-keyval";
import { useAssetStore, type LoadedAsset } from "@/stores/useAssetStore";

/** Image blobs live in their own IndexedDB store, keyed by imageId. */
const assetDb = createStore("data-race-assets", "images");

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
/** Icons are drawn at most ~70px tall in 1080p; keep decoded bitmaps small. */
const MAX_DIMENSION = 256;

export function newImageId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 12);
}

async function decode(blob: Blob): Promise<LoadedAsset> {
  const bitmap = await createImageBitmap(blob, {
    resizeWidth: MAX_DIMENSION,
    resizeHeight: MAX_DIMENSION,
    resizeQuality: "high",
  });
  return { bitmap, url: URL.createObjectURL(blob) };
}

/** Persist an uploaded image, decode it, and register it for rendering. */
export async function addImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/"))
    throw new Error("Please choose an image file.");
  if (file.size > MAX_IMAGE_BYTES)
    throw new Error("Images must be smaller than 4 MB.");
  const id = newImageId();
  const asset = await decode(file);
  await set(id, file, assetDb);
  useAssetStore.getState().set(id, asset);
  return id;
}

export async function removeImage(id: string): Promise<void> {
  useAssetStore.getState().remove(id);
  await del(id, assetDb);
}

export async function getImageBlob(id: string): Promise<Blob | undefined> {
  return get<Blob>(id, assetDb);
}

export async function putImageBlob(id: string, blob: Blob): Promise<void> {
  await set(id, blob, assetDb);
  useAssetStore.getState().set(id, await decode(blob));
}

/** Load every stored image into the asset store (call once on boot). */
export async function hydrateImages(keepIds: Set<string>): Promise<void> {
  const all = await entries<string, Blob>(assetDb);
  const loaded = new Map<string, LoadedAsset>();
  await Promise.all(
    all.map(async ([id, blob]) => {
      if (!keepIds.has(id)) {
        await del(id, assetDb); // orphaned by a deleted/replaced dataset
        return;
      }
      try {
        loaded.set(id, await decode(blob));
      } catch {
        await del(id, assetDb);
      }
    }),
  );
  useAssetStore.getState().replaceAll(loaded);
}
