import { create } from "zustand";

export interface PlaybackState {
  /** Continuous time in period units. */
  t: number;
  playing: boolean;
  /** Multiplier on top of `settings.secondsPerPeriod`. */
  speed: number;

  setT: (t: number) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setSpeed: (speed: number) => void;
}

export const usePlaybackStore = create<PlaybackState>()((set) => ({
  t: 0,
  playing: false,
  speed: 1,

  setT: (t) => set({ t }),
  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  toggle: () => set((s) => ({ playing: !s.playing })),
  setSpeed: (speed) => set({ speed }),
}));
