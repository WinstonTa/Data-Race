"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { nodeLabel } from "@/core/graph/types";
import { useGraphStore } from "@/stores/useGraphStore";

const MAX_RESULTS = 8;

/** Type-ahead over display names, usernames and ids; picks select + center. */
export function FriendSearch() {
  const data = useGraphStore((s) => s.data);
  const select = useGraphStore((s) => s.select);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !data) return [];
    return data.nodes
      .filter(
        (n) =>
          n.displayName.toLowerCase().includes(q) ||
          n.username.toLowerCase().includes(q) ||
          n.id === q,
      )
      .slice(0, MAX_RESULTS);
  }, [data, query]);

  const pick = (id: string) => {
    select(id, { focus: true });
    setQuery("");
  };

  return (
    <div className="relative">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        className="pl-8"
        placeholder="Find a friend…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) pick(results[0].id);
          if (e.key === "Escape") setQuery("");
        }}
      />
      {query.trim() ? (
        <ul className="bg-popover absolute z-10 mt-1 w-full overflow-hidden rounded-md border text-sm shadow-md">
          {results.length ? (
            results.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className="hover:bg-muted flex w-full items-baseline gap-2 px-3 py-1.5 text-left"
                  onClick={() => pick(n.id)}
                >
                  <span className="truncate font-medium">{nodeLabel(n)}</span>
                  {n.username && n.username !== nodeLabel(n) ? (
                    <span className="text-muted-foreground truncate text-xs">
                      @{n.username}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          ) : (
            <li className="text-muted-foreground px-3 py-1.5">No matches</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
