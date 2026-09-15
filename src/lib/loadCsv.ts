import { parseGrid } from "@/core/parser/grid";
import { usePlaybackStore } from "@/stores/usePlaybackStore";
import { useProjectStore } from "@/stores/useProjectStore";

/**
 * Parse CSV text into the project store (grid + auto-detected mapping +
 * dataset) and rewind playback. Shared by the dropzone, the sample button
 * and first-visit boot.
 */
export function loadCsvText(text: string, fileName: string): void {
  const grid = parseGrid(text);
  usePlaybackStore.setState({ t: 0, playing: false });
  useProjectStore.getState().loadSource(grid, fileName);
}
