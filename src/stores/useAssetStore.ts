import { create } from "zustand";

export interface LoadedAsset {
  bitmap: ImageBitmap;
  /** Object URL for thumbnails in the editor. */
  url: string;
}

/**
 * Decoded entity images (icons/flags) keyed by `Entity.imageId`.
 * Blobs are persisted separately (see lib/assetDb); this store only holds
 * what the renderer and editor need right now.
 */
export interface AssetState {
  /** Renderer input; a new Map instance on every change so memoization works. */
  bitmaps: ReadonlyMap<string, ImageBitmap>;
  urls: ReadonlyMap<string, string>;
  set: (id: string, asset: LoadedAsset) => void;
  remove: (id: string) => void;
  replaceAll: (assets: Map<string, LoadedAsset>) => void;
}

function release(
  bitmaps: ReadonlyMap<string, ImageBitmap>,
  urls: ReadonlyMap<string, string>,
  id: string,
) {
  bitmaps.get(id)?.close();
  const url = urls.get(id);
  if (url) URL.revokeObjectURL(url);
}

export const useAssetStore = create<AssetState>()((set) => ({
  bitmaps: new Map(),
  urls: new Map(),

  set: (id, asset) =>
    set((s) => {
      release(s.bitmaps, s.urls, id);
      const bitmaps = new Map(s.bitmaps).set(id, asset.bitmap);
      const urls = new Map(s.urls).set(id, asset.url);
      return { bitmaps, urls };
    }),

  remove: (id) =>
    set((s) => {
      if (!s.bitmaps.has(id)) return s;
      release(s.bitmaps, s.urls, id);
      const bitmaps = new Map(s.bitmaps);
      const urls = new Map(s.urls);
      bitmaps.delete(id);
      urls.delete(id);
      return { bitmaps, urls };
    }),

  replaceAll: (assets) =>
    set((s) => {
      for (const id of s.bitmaps.keys())
        if (!assets.has(id)) release(s.bitmaps, s.urls, id);
      return {
        bitmaps: new Map([...assets].map(([id, a]) => [id, a.bitmap])),
        urls: new Map([...assets].map(([id, a]) => [id, a.url])),
      };
    }),
}));
