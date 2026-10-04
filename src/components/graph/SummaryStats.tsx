"use client";

import { useGraphStore } from "@/stores/useGraphStore";
import { communityName, fmtDec, fmtInt, fmtPct } from "./graphHooks";

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border p-3" title={hint}>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function SummaryStats() {
  const analysis = useGraphStore((s) => s.analysis);

  if (!analysis) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="bg-muted h-[62px] animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  const s = analysis.summary;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Tile label="Friends" value={fmtInt(s.nodes)} hint="Nodes in the graph" />
        <Tile
          label="Connections"
          value={fmtInt(s.edges)}
          hint="Mutual friendships between your friends"
        />
        <Tile
          label="Density"
          value={fmtPct(s.density)}
          hint="Share of all possible friend pairs that are connected"
        />
        <Tile
          label="Avg clustering"
          value={fmtDec(s.avgClustering, 2)}
          hint="How often a friend's friends also know each other (0–1)"
        />
        <Tile
          label="Modularity"
          value={fmtDec(s.modularity, 2)}
          hint="How cleanly the graph splits into groups (above ~0.3 is strong)"
        />
        <Tile
          label="Groups"
          value={fmtInt(s.communities)}
          hint="Communities with 3 or more members (Louvain)"
        />
        <Tile
          label="Bridges"
          value={fmtInt(s.bridges)}
          hint="High-betweenness friends who connect different groups"
        />
        <Tile
          label="No mutuals"
          value={fmtInt(s.isolates)}
          hint={`Friends with no mutual connections. Largest connected cluster: ${fmtInt(s.largestComponent)} friends.`}
        />
      </div>
      {analysis.communities.length ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {analysis.communities.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ backgroundColor: c.color }}
              />
              {communityName(c)}{" "}
              <span className="text-muted-foreground">({c.size})</span>
            </span>
          ))}
          <span className="text-muted-foreground flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full border-2 border-gray-900" />
            ringed = bridge
          </span>
        </div>
      ) : null}
    </div>
  );
}
