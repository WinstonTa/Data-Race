import type { UndirectedGraph } from "graphology";
import louvain from "graphology-communities-louvain";
import betweennessCentrality from "graphology-metrics/centrality/betweenness";
import { undirectedDensity } from "graphology-metrics/graph/density";
import { mulberry32 } from "../random";
import { DEFAULT_PALETTE } from "../render/palette";
import { toGraphology } from "./buildGraph";
import type {
  CommunityInfo,
  GraphAnalysis,
  GraphData,
  NodeMetrics,
} from "./types";

export const DEFAULT_ANALYSIS_SEED = 20261003;
/** Color of isolates and the shared bucket of tiny communities. */
export const OTHER_COLOR = "#9ca3af";
/** Share of nodes (by betweenness) eligible to be called a bridge. */
const BRIDGE_TOP_SHARE = 0.1;

/** Local clustering coefficient for every node (0 when degree < 2). */
export function localClustering(g: UndirectedGraph): Record<string, number> {
  const neighbors = new Map<string, Set<string>>();
  g.forEachNode((n) => neighbors.set(n, new Set(g.neighbors(n))));
  const out: Record<string, number> = {};
  for (const [n, ns] of neighbors) {
    const k = ns.size;
    if (k < 2) {
      out[n] = 0;
      continue;
    }
    let links = 0;
    for (const u of ns) {
      const nu = neighbors.get(u)!;
      const [small, big] = nu.size < k ? [nu, ns] : [ns, nu];
      for (const w of small) if (big.has(w)) links++;
    }
    // Every link between two neighbors was counted from both ends.
    out[n] = links / 2 / ((k * (k - 1)) / 2);
  }
  return out;
}

/** Size of the largest connected component. */
export function largestComponentSize(g: UndirectedGraph): number {
  const seen = new Set<string>();
  let best = 0;
  g.forEachNode((start) => {
    if (seen.has(start)) return;
    seen.add(start);
    const stack = [start];
    let size = 0;
    while (stack.length) {
      const n = stack.pop()!;
      size++;
      g.forEachNeighbor(n, (m) => {
        if (!seen.has(m)) {
          seen.add(m);
          stack.push(m);
        }
      });
    }
    best = Math.max(best, size);
  });
  return best;
}

/**
 * Compute every per-node metric and the graph summary. Louvain runs with a
 * seeded RNG so communities (and therefore colors) are stable across runs.
 * Communities are renumbered largest-first; communities of ≤ 2 members share
 * one grey "other" bucket and isolates get no community at all.
 */
export function analyzeGraph(
  data: GraphData,
  { seed = DEFAULT_ANALYSIS_SEED }: { seed?: number } = {},
): GraphAnalysis {
  const g = toGraphology(data);
  const nodes = g.nodes();
  const clustering = localClustering(g);
  const betweenness =
    g.order > 2 ? betweennessCentrality(g, { normalized: true }) : {};

  // --- communities -------------------------------------------------------
  const detailed =
    g.size > 0 ? louvain.detailed(g, { rng: mulberry32(seed) }) : null;
  const groups = new Map<number, string[]>();
  for (const n of nodes) {
    if (!detailed || g.degree(n) === 0) continue;
    const c = detailed.communities[n];
    let members = groups.get(c);
    if (!members) groups.set(c, (members = []));
    members.push(n);
  }
  const ordered = [...groups.values()].sort((a, b) => b.length - a.length);
  const big = ordered.filter((m) => m.length > 2);
  const tiny = ordered.filter((m) => m.length <= 2);

  const communities: CommunityInfo[] = big.map((members, i) => ({
    id: i,
    size: members.length,
    color: DEFAULT_PALETTE[i % DEFAULT_PALETTE.length],
    other: false,
  }));
  const communityOf = new Map<string, number>();
  big.forEach((members, i) => members.forEach((n) => communityOf.set(n, i)));
  if (tiny.length) {
    const id = communities.length;
    const members = tiny.flat();
    communities.push({
      id,
      size: members.length,
      color: OTHER_COLOR,
      other: true,
    });
    members.forEach((n) => communityOf.set(n, id));
  }

  // --- bridges -----------------------------------------------------------
  const ranked = nodes.map((n) => betweenness[n] ?? 0).sort((a, b) => b - a);
  const cutoffIndex = Math.max(1, Math.ceil(nodes.length * BRIDGE_TOP_SHARE));
  const cutoff = ranked[cutoffIndex - 1] ?? Infinity;

  const metrics: Record<string, NodeMetrics> = {};
  let bridges = 0;
  for (const n of nodes) {
    const b = betweenness[n] ?? 0;
    const community = communityOf.get(n) ?? null;
    let isBridge = false;
    if (b > 0 && b >= cutoff) {
      const touched = new Set<number>();
      if (community !== null) touched.add(community);
      g.forEachNeighbor(n, (m) => {
        const c = communityOf.get(m);
        if (c !== undefined) touched.add(c);
      });
      isBridge = touched.size >= 2;
    }
    if (isBridge) bridges++;
    metrics[n] = {
      degree: g.degree(n),
      betweenness: b,
      clustering: clustering[n] ?? 0,
      community,
      isBridge,
    };
  }

  const avgClustering = nodes.length
    ? nodes.reduce((s, n) => s + (clustering[n] ?? 0), 0) / nodes.length
    : 0;

  return {
    metrics,
    communities,
    summary: {
      nodes: g.order,
      edges: g.size,
      density: g.order > 1 ? undirectedDensity(g) : 0,
      avgClustering,
      modularity:
        detailed && Number.isFinite(detailed.modularity)
          ? detailed.modularity
          : 0,
      communities: big.length,
      isolates: nodes.filter((n) => g.degree(n) === 0).length,
      largestComponent: largestComponentSize(g),
      bridges,
    },
  };
}
