import type { Grid } from "../types";
import type { FriendEdge, FriendNode, GraphData, GraphWarning } from "./types";

export const EDGE_LIST_HEADERS = [
  "Friend_ID",
  "Friend_Username",
  "Friend_DisplayName",
  "Mutual_ID",
  "Mutual_Username",
  "Mutual_DisplayName",
] as const;

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, "");

/** Column index per expected header, or -1 when absent. */
function findColumns(header: string[]) {
  const index = new Map(header.map((h, i) => [norm(h), i]));
  const col = (name: string) => index.get(norm(name)) ?? -1;
  return {
    friendId: col("Friend_ID"),
    friendUsername: col("Friend_Username"),
    friendDisplayName: col("Friend_DisplayName"),
    mutualId: col("Mutual_ID"),
    mutualUsername: col("Mutual_Username"),
    mutualDisplayName: col("Mutual_DisplayName"),
  };
}

/** True when the grid's first row looks like a friend edge list. */
export function isEdgeListGrid(grid: Grid): boolean {
  if (grid.length === 0) return false;
  const c = findColumns(grid[0]);
  return c.friendId >= 0 && c.mutualId >= 0;
}

/**
 * Turn a Discord friends edge-list grid into an undirected simple graph.
 * Row 0 is the header. Each non-empty Mutual_ID is an edge Friend–Mutual;
 * rows with an empty Mutual_ID still contribute the friend as a node, so
 * isolates are preserved. Self-loops are dropped and (A,B)/(B,A) collapse.
 */
export function parseEdgeList(grid: Grid): {
  data: GraphData;
  warnings: GraphWarning[];
} {
  if (grid.length === 0) throw new Error("The file is empty.");
  const c = findColumns(grid[0]);
  if (c.friendId < 0 || c.mutualId < 0) {
    throw new Error(
      `This doesn't look like a friend edge list. Expected a header row with ${EDGE_LIST_HEADERS.join(", ")}.`,
    );
  }

  const nodes = new Map<string, FriendNode>();
  const friendIds = new Set<string>();
  const edgeKeys = new Set<string>();
  const rowKeys = new Set<string>();
  const edges: FriendEdge[] = [];
  let selfLoops = 0;
  let duplicates = 0;
  let blankIds = 0;
  let nameConflicts = 0;

  const cell = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");

  const upsert = (id: string, username: string, displayName: string) => {
    const existing = nodes.get(id);
    if (!existing) {
      nodes.set(id, { id, username, displayName });
      return;
    }
    if (username && existing.username && username !== existing.username)
      nameConflicts++;
    if (!existing.username) existing.username = username;
    if (!existing.displayName) existing.displayName = displayName;
  };

  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    const friendId = cell(row, c.friendId);
    const mutualId = cell(row, c.mutualId);
    if (!friendId) {
      if (mutualId || row.some((v) => v.trim() !== "")) blankIds++;
      continue;
    }
    friendIds.add(friendId);
    upsert(
      friendId,
      cell(row, c.friendUsername),
      cell(row, c.friendDisplayName),
    );
    if (!mutualId) continue;
    upsert(
      mutualId,
      cell(row, c.mutualUsername),
      cell(row, c.mutualDisplayName),
    );
    if (mutualId === friendId) {
      selfLoops++;
      continue;
    }
    // Exports list each pair from both sides (A→B and B→A); only an exact
    // repeat of the same row is worth reporting.
    const rowKey = `${friendId}>${mutualId}`;
    if (rowKeys.has(rowKey)) duplicates++;
    rowKeys.add(rowKey);
    const [source, target] =
      friendId < mutualId ? [friendId, mutualId] : [mutualId, friendId];
    const key = `${source}|${target}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    edges.push({ source, target });
  }

  const notFriends = [...nodes.keys()].filter((id) => !friendIds.has(id));
  const warnings: GraphWarning[] = [];
  const warn = (kind: GraphWarning["kind"], count: number, message: string) => {
    if (count > 0) warnings.push({ kind, count, message });
  };
  warn("no-rows", nodes.size === 0 ? 1 : 0, "The file has no friend rows.");
  warn(
    "self-loops",
    selfLoops,
    `${selfLoops} row(s) list a friend as their own mutual; ignored.`,
  );
  warn(
    "duplicate-edges",
    duplicates,
    `${duplicates} row(s) repeat an earlier friend–mutual pair; merged.`,
  );
  warn(
    "blank-ids",
    blankIds,
    `${blankIds} row(s) have no Friend_ID; skipped.`,
  );
  warn(
    "mutual-not-friend",
    notFriends.length,
    `${notFriends.length} mutual friend(s) never appear as a Friend_ID; added from their mutual rows.`,
  );
  warn(
    "name-conflict",
    nameConflicts,
    `${nameConflicts} row(s) give a different username for an id already seen; kept the first.`,
  );

  return { data: { nodes: [...nodes.values()], edges }, warnings };
}
