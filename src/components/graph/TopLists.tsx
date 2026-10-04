"use client";

import { useMemo } from "react";
import { nodeLabel, type FriendNode } from "@/core/graph/types";
import { useGraphStore } from "@/stores/useGraphStore";
import { fmtDec, useNodeIndex } from "./graphHooks";

const TOP = 8;

function List({
  title,
  hint,
  items,
}: {
  title: string;
  hint: string;
  items: { node: FriendNode; value: string }[];
}) {
  const select = useGraphStore((s) => s.select);
  return (
    <div className="flex flex-col gap-1">
      <div className="text-sm font-medium" title={hint}>
        {title}
      </div>
      {items.length ? (
        <ol className="text-sm">
          {items.map(({ node, value }) => (
            <li key={node.id}>
              <button
                type="button"
                className="hover:bg-muted flex w-full items-baseline gap-2 rounded px-1.5 py-0.5 text-left"
                onClick={() => select(node.id, { focus: true })}
              >
                <span className="truncate">{nodeLabel(node)}</span>
                <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                  {value}
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-muted-foreground px-1.5 text-sm">None</p>
      )}
    </div>
  );
}

/** Shown in the side panel when nothing is selected. */
export function TopLists() {
  const analysis = useGraphStore((s) => s.analysis);
  const nodes = useNodeIndex();

  const lists = useMemo(() => {
    if (!analysis) return null;
    const rows = Object.entries(analysis.metrics).flatMap(([id, m]) => {
      const node = nodes.get(id);
      return node ? [{ node, m }] : [];
    });
    const byName = (a: FriendNode, b: FriendNode) =>
      nodeLabel(a).localeCompare(nodeLabel(b));
    return {
      connected: rows
        .filter((r) => r.m.degree > 0)
        .sort((a, b) => b.m.degree - a.m.degree || byName(a.node, b.node))
        .slice(0, TOP)
        .map((r) => ({ node: r.node, value: String(r.m.degree) })),
      bridges: rows
        .filter((r) => r.m.isBridge)
        .sort((a, b) => b.m.betweenness - a.m.betweenness)
        .slice(0, TOP)
        .map((r) => ({ node: r.node, value: fmtDec(r.m.betweenness) })),
      isolates: rows
        .filter((r) => r.m.degree === 0)
        .sort((a, b) => byName(a.node, b.node))
        .map((r) => ({ node: r.node, value: "" })),
    };
  }, [analysis, nodes]);

  if (!lists) return null;
  return (
    <div className="flex flex-col gap-4">
      <List
        title="Most connected"
        hint="Friends with the most mutual friends"
        items={lists.connected}
      />
      <List
        title="Top bridges"
        hint="High betweenness: they sit on the shortest paths between groups"
        items={lists.bridges}
      />
      <List
        title={`No mutuals (${lists.isolates.length})`}
        hint="Friends who share no mutual friends with anyone else in the list"
        items={lists.isolates}
      />
    </div>
  );
}
