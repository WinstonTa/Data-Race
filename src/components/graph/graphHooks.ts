"use client";

import { useMemo } from "react";
import type { CommunityInfo, FriendNode } from "@/core/graph/types";
import { useGraphStore } from "@/stores/useGraphStore";

const EMPTY_NODES = new Map<string, FriendNode>();

/** id → FriendNode for the loaded graph. */
export function useNodeIndex(): Map<string, FriendNode> {
  const data = useGraphStore((s) => s.data);
  return useMemo(
    () => (data ? new Map(data.nodes.map((n) => [n.id, n])) : EMPTY_NODES),
    [data],
  );
}

/** "Group 3" / "Other" / "No mutuals". */
export function communityName(c: CommunityInfo | null): string {
  if (!c) return "No mutuals";
  return c.other ? "Other (small groups)" : `Group ${c.id + 1}`;
}

export const fmtInt = (n: number) => n.toLocaleString();
export const fmtDec = (n: number, digits = 3) =>
  Number.isFinite(n) ? n.toFixed(digits) : "–";
export const fmtPct = (n: number) =>
  Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : "–";
