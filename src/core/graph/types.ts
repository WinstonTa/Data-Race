/**
 * Friend graph model. Ids are Discord snowflakes kept as strings: they exceed
 * 2^53, so they must never go through `Number`.
 */
export interface FriendNode {
  id: string;
  username: string;
  displayName: string;
}

/** Undirected edge in canonical order (`source < target`). */
export interface FriendEdge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: FriendNode[];
  edges: FriendEdge[];
}

export type GraphWarningKind =
  | "self-loops"
  | "duplicate-edges"
  | "blank-ids"
  | "mutual-not-friend"
  | "name-conflict"
  | "no-rows";

export interface GraphWarning {
  kind: GraphWarningKind;
  count: number;
  message: string;
}

export interface NodeMetrics {
  degree: number;
  /** Normalized betweenness centrality, 0–1. */
  betweenness: number;
  /** Local clustering coefficient, 0–1 (0 when degree < 2). */
  clustering: number;
  /** Index into `GraphAnalysis.communities`; null for isolates. */
  community: number | null;
  /** High betweenness and neighbors in more than one community. */
  isBridge: boolean;
}

export interface CommunityInfo {
  /** 0-based, ordered by size (largest first). */
  id: number;
  size: number;
  color: string;
  /** True for the shared bucket of tiny (≤ 2 member) communities. */
  other: boolean;
}

export interface GraphSummary {
  nodes: number;
  edges: number;
  density: number;
  avgClustering: number;
  modularity: number;
  /** Communities with more than two members. */
  communities: number;
  isolates: number;
  largestComponent: number;
  bridges: number;
}

export interface GraphAnalysis {
  metrics: Record<string, NodeMetrics>;
  communities: CommunityInfo[];
  summary: GraphSummary;
}

/** Best human label for a friend. */
export function nodeLabel(n: FriendNode): string {
  return n.displayName || n.username || n.id;
}
