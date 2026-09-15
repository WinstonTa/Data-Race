import { createStore, del, get, set } from "idb-keyval";
import type { StateStorage } from "zustand/middleware";

const store = createStore("data-race", "project");

/**
 * zustand `persist` storage backed by IndexedDB. localStorage's ~5 MB cap is
 * too small for real datasets, and IndexedDB keeps writes off the main
 * thread's synchronous path.
 */
export const idbStorage: StateStorage = {
  getItem: async (name) => (await get<string>(name, store)) ?? null,
  setItem: async (name, value) => {
    await set(name, value, store);
  },
  removeItem: async (name) => {
    await del(name, store);
  },
};
