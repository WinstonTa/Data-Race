"use client";

import { ScrubControls } from "./ScrubControls";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { usePlayback } from "./usePlayback";
import { Viewport } from "./Viewport";

export function Player() {
  usePlayback();
  useKeyboardShortcuts();
  return (
    <div className="flex flex-col gap-3">
      <Viewport />
      <ScrubControls />
    </div>
  );
}
