import type { Grid } from "../types";
import type { GraphAnalysis, GraphData } from "./types";

export const METRICS_CSV_HEADER = [
  "ID",
  "Username",
  "DisplayName",
  "Degree",
  "Betweenness",
  "Clustering",
  "Community",
  "Bridge",
];

/**
 * Per-node metrics table, sorted by degree (desc). Community is 1-based to
 * match the UI; "Other" for the tiny-community bucket, blank for isolates.
 */
export function metricsToGrid(data: GraphData, analysis: GraphAnalysis): Grid {
  const rows = data.nodes
    .map((n) => ({ n, m: analysis.metrics[n.id] }))
    .filter((r) => r.m)
    .sort((a, b) => b.m.degree - a.m.degree || a.n.id.localeCompare(b.n.id));
  return [
    METRICS_CSV_HEADER,
    ...rows.map(({ n, m }) => {
      const c = m.community === null ? null : analysis.communities[m.community];
      return [
        n.id,
        n.username,
        n.displayName,
        String(m.degree),
        m.betweenness.toFixed(6),
        m.clustering.toFixed(6),
        c === null ? "" : c.other ? "Other" : String(c.id + 1),
        m.isBridge ? "yes" : "no",
      ];
    }),
  ];
}
