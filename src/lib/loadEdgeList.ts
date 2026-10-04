import { parseEdgeList } from "@/core/graph/parseEdgeList";
import { parseGrid } from "@/core/parser/grid";
import { useGraphStore } from "@/stores/useGraphStore";

/** Parse a friend edge-list CSV and load it into the graph store. Throws on bad input. */
export function loadEdgeListText(text: string, fileName: string): void {
  const { data, warnings } = parseEdgeList(parseGrid(text));
  if (data.nodes.length === 0) throw new Error("The file has no friend rows.");
  useGraphStore.getState().loadGraph(data, warnings, fileName);
}
