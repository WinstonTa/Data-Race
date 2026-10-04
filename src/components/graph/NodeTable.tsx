"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { nodeLabel } from "@/core/graph/types";
import { cn } from "@/lib/utils";
import { useGraphStore } from "@/stores/useGraphStore";
import { communityName, fmtDec } from "./graphHooks";

const PAGE_SIZE = 50;

type SortKey =
  "name" | "username" | "degree" | "betweenness" | "clustering" | "community";

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "name", label: "Display name" },
  { key: "username", label: "Username" },
  { key: "degree", label: "Mutuals", numeric: true },
  { key: "betweenness", label: "Betweenness", numeric: true },
  { key: "clustering", label: "Clustering", numeric: true },
  { key: "community", label: "Group" },
];

/** Every friend with all metrics; sortable, filterable, click to select. */
export function NodeTable() {
  const data = useGraphStore((s) => s.data);
  const analysis = useGraphStore((s) => s.analysis);
  const selectedId = useGraphStore((s) => s.selectedId);
  const select = useGraphStore((s) => s.select);

  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "degree",
    desc: true,
  });
  const [requestedPage, setPage] = useState(0);

  const rows = useMemo(() => {
    if (!data || !analysis) return [];
    const q = filter.trim().toLowerCase();
    const list = data.nodes
      .filter(
        (n) =>
          !q ||
          n.displayName.toLowerCase().includes(q) ||
          n.username.toLowerCase().includes(q) ||
          n.id.includes(q),
      )
      .map((n) => {
        const m = analysis.metrics[n.id];
        const community =
          m?.community != null ? analysis.communities[m.community] : null;
        return { n, m, community };
      })
      .filter((r) => r.m);
    const value = (r: (typeof list)[number]): number | string => {
      switch (sort.key) {
        case "name":
          return nodeLabel(r.n).toLowerCase();
        case "username":
          return r.n.username.toLowerCase();
        case "community":
          // Isolates sort after every real group.
          return r.community ? r.community.id : Number.MAX_SAFE_INTEGER;
        default:
          return r.m[sort.key];
      }
    };
    return list.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb));
      return (sort.desc ? -cmp : cmp) || a.n.id.localeCompare(b.n.id);
    });
  }, [data, analysis, filter, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pages - 1);
  const shown = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (!analysis) return null;

  const toggleSort = (key: SortKey, numeric?: boolean) =>
    setSort((s) =>
      s.key === key ? { key, desc: !s.desc } : { key, desc: !!numeric },
    );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">All friends</h2>
        <div className="flex items-center gap-2">
          <Input
            className="w-56"
            placeholder="Filter by name or id…"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
          />
          <span className="text-muted-foreground text-sm tabular-nums">
            {rows.length} friends
          </span>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-3 py-2 font-medium",
                    c.numeric ? "text-right" : "text-left",
                  )}
                >
                  <button
                    type="button"
                    className="hover:text-foreground inline-flex items-center gap-1"
                    onClick={() => toggleSort(c.key, c.numeric)}
                  >
                    {c.label}
                    {sort.key === c.key ? (
                      sort.desc ? (
                        <ArrowDown className="size-3" />
                      ) : (
                        <ArrowUp className="size-3" />
                      )
                    ) : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map(({ n, m, community }) => (
              <tr
                key={n.id}
                onClick={() => select(n.id, { focus: true })}
                className={cn(
                  "hover:bg-muted/60 cursor-pointer border-t",
                  selectedId === n.id && "bg-primary/10",
                )}
              >
                <td className="max-w-56 truncate px-3 py-1.5 font-medium">
                  {nodeLabel(n)}
                  {m.isBridge ? (
                    <span className="text-muted-foreground ml-1.5 text-xs">
                      bridge
                    </span>
                  ) : null}
                </td>
                <td className="text-muted-foreground max-w-48 truncate px-3 py-1.5">
                  {n.username}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {m.degree}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {fmtDec(m.betweenness)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {fmtDec(m.clustering, 2)}
                </td>
                <td className="px-3 py-1.5">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{
                        backgroundColor: community?.color ?? "#9ca3af",
                      }}
                    />
                    {communityName(community)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            variant="outline"
            size="icon-xs"
            aria-label="Previous page"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="tabular-nums">
            Page {page + 1} / {pages}
          </span>
          <Button
            variant="outline"
            size="icon-xs"
            aria-label="Next page"
            disabled={page >= pages - 1}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      ) : null}
    </section>
  );
}
