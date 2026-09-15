"use client";

import { useEffect } from "react";
import { usePlaybackStore } from "@/stores/usePlaybackStore";
import { useProjectStore } from "@/stores/useProjectStore";

/**
 * Drives the playhead with requestAnimationFrame while `playing` is true.
 * Mount once (in the player container). Uses wall-clock deltas so preview
 * speed is independent of frame rate; the exporter steps deterministically
 * instead.
 */
export function usePlayback(): void {
  const playing = usePlaybackStore((s) => s.playing);

  useEffect(() => {
    if (!playing) return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); // clamp after tab switches
      last = now;

      const { secondsPerPeriod } = useProjectStore.getState().settings;
      const periods = useProjectStore.getState().dataset?.periods.length ?? 0;
      const end = Math.max(0, periods - 1);
      const pb = usePlaybackStore.getState();

      const next = pb.t + (dt / Math.max(0.01, secondsPerPeriod)) * pb.speed;
      if (next >= end) {
        usePlaybackStore.setState({ t: end, playing: false });
        return;
      }
      usePlaybackStore.setState({ t: next });
      raf = requestAnimationFrame(tick);
    };

    // Restart from the beginning when play is pressed at the end.
    const pb = usePlaybackStore.getState();
    const periods = useProjectStore.getState().dataset?.periods.length ?? 0;
    if (pb.t >= Math.max(0, periods - 1)) usePlaybackStore.setState({ t: 0 });

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
}
