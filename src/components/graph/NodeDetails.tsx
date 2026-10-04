"use client";

import { X } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { nodeLabel } from "@/core/graph/types";
import { useGraphStore } from "@/stores/useGraphStore";
import { communityName, fmtDec, useNodeIndex } from "./graphHooks";

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="min-w-0 truncate text-right tabular-nums">
        {children}
      </span>
    </div>
  );
}

/** Side drawer content for the selected friend. */
export function NodeDetails({ id }: { id: string }) {
  const data = useGraphStore((s) => s.data);
  const analysis = useGraphStore((s) => s.analysis);
  const select = useGraphStore((s) => s.select);
  const nodes = useNodeIndex();

  const mutuals = useMemo(() => {
    if (!data) return [];
    const ids = data.edges.flatMap((e) =>
      e.source === id ? [e.target] : e.target === id ? [e.source] : [],
    );
    return ids
      .map((m) => nodes.get(m))
      .filter((n) => n !== undefined)
      .sort(
        (a, b) =>
          (analysis?.metrics[b.id]?.degree ?? 0) -
            (analysis?.metrics[a.id]?.degree ?? 0) ||
          nodeLabel(a).localeCompare(nodeLabel(b)),
      );
  }, [data, analysis, nodes, id]);

  const node = nodes.get(id);
  if (!node) return null;
  const m = analysis?.metrics[id];
  const community =
    m && m.community !== null && analysis
      ? analysis.communities[m.community]
      : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold">
            {nodeLabel(node)}
          </div>
          {node.username ? (
            <div className="text-muted-foreground truncate text-sm">
              @{node.username}
            </div>
          ) : null}
        </div>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="Close details"
          onClick={() => select(null)}
        >
          <X />
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="gap-1.5">
          <span
            className="inline-block size-2 rounded-full"
            style={{ backgroundColor: community?.color ?? "#9ca3af" }}
          />
          {communityName(community)}
        </Badge>
        {m?.isBridge ? <Badge>Bridge</Badge> : null}
      </div>

      <div className="flex flex-col gap-1">
        <Row label="ID">
          <code className="text-xs">{node.id}</code>
        </Row>
        <Row label="Display name">{node.displayName || "–"}</Row>
        <Row label="Mutual friends">{m?.degree ?? "–"}</Row>
        <Row label="Betweenness">{m ? fmtDec(m.betweenness) : "–"}</Row>
        <Row label="Clustering">{m ? fmtDec(m.clustering, 2) : "–"}</Row>
      </div>

      <div className="flex flex-col gap-1">
        <div className="text-sm font-medium">
          Mutual friends ({mutuals.length})
        </div>
        {mutuals.length ? (
          <ul className="max-h-64 overflow-y-auto rounded-md border text-sm">
            {mutuals.map((n) => {
              const c = analysis?.metrics[n.id]?.community;
              const color =
                c !== null && c !== undefined
                  ? analysis!.communities[c].color
                  : "#9ca3af";
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    className="hover:bg-muted flex w-full items-center gap-2 px-2 py-1 text-left"
                    onClick={() => select(n.id, { focus: true })}
                  >
                    <span
                      className="inline-block size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate">{nodeLabel(n)}</span>
                    <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                      {analysis?.metrics[n.id]?.degree ?? ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No mutual friends in this list.
          </p>
        )}
      </div>
    </div>
  );
}
