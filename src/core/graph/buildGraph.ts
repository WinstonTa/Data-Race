import { UndirectedGraph } from "graphology";
import type { GraphData } from "./types";

/** Build a graphology graph (no attributes) from parsed friend data. */
export function toGraphology(data: GraphData): UndirectedGraph {
  const g = new UndirectedGraph();
  for (const n of data.nodes) g.mergeNode(n.id);
  for (const e of data.edges) {
    if (e.source === e.target) continue;
    g.mergeNode(e.source);
    g.mergeNode(e.target);
    g.mergeEdge(e.source, e.target);
  }
  return g;
}
