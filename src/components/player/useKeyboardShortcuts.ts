"use client";

import { useEffect } from "react";
import { usePlaybackStore } from "@/stores/usePlaybackStore";
import { useProjectStore } from "@/stores/useProjectStore";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.closest("[role=dialog]") !== null
  );
}

/**
 * Space: play/pause · ←/→: previous/next period · Home/End: jump to start/end.
 * Ignored while typing in a field or when a dialog is open.
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (isTypingTarget(ev.target)) return;

      const periods = useProjectStore.getState().dataset?.periods.length ?? 0;
      if (periods === 0) return;
      const end = periods - 1;
      const pb = usePlaybackStore.getState();

      switch (ev.key) {
        case " ":
          ev.preventDefault();
          pb.toggle();
          break;
        case "ArrowLeft":
          ev.preventDefault();
          pb.pause();
          pb.setT(Math.max(0, Math.ceil(pb.t - 1e-6) - 1));
          break;
        case "ArrowRight":
          ev.preventDefault();
          pb.pause();
          pb.setT(Math.min(end, Math.floor(pb.t + 1e-6) + 1));
          break;
        case "Home":
          ev.preventDefault();
          pb.pause();
          pb.setT(0);
          break;
        case "End":
          ev.preventDefault();
          pb.pause();
          pb.setT(end);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
