"use client";

import {
  Building2,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Route,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { indexEntities, toSelectedView } from "@/core/city/selection";
import { cn } from "@/lib/utils";
import { useCityStore } from "@/stores/useCityStore";

function KeyValueList({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-1 text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="truncate font-mono text-slate-400" title={k}>
            {k}
          </dt>
          <dd className="break-words text-slate-200">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function CopyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard?.writeText(id).then(
          () => setCopied(true),
          () => undefined,
        )
      }
      className="group flex max-w-full items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/60 px-2 py-1 font-mono text-xs text-slate-300 hover:border-slate-700 hover:text-slate-50"
      aria-label={`Copy id ${id}`}
    >
      <span className="truncate">{id}</span>
      {copied ? (
        <Check className="size-3.5 shrink-0 text-emerald-400" />
      ) : (
        <Copy className="size-3.5 shrink-0 text-slate-500 group-hover:text-slate-300" />
      )}
    </button>
  );
}

/** Floating drawer describing the selected building or road. */
export function CityInspectionPanel({ id }: { id: string }) {
  const order = useCityStore((s) => s.order);
  const cities = useCityStore((s) => s.cities);
  const select = useCityStore((s) => s.select);

  const index = useMemo(
    () => indexEntities(order.map((cid) => cities[cid])),
    [order, cities],
  );
  const entity = index.get(id);
  const view = useMemo(() => (entity ? toSelectedView(entity) : null), [entity]);
  if (!view) return null;

  const isBuilding = view.kind === "building";
  const Icon = isBuilding ? Building2 : Route;

  return (
    <aside
      aria-label="Entity details"
      className="pointer-events-auto flex max-h-full w-80 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950/75 text-slate-200 shadow-2xl backdrop-blur-md"
    >
      <header className="flex items-start gap-2 border-b border-slate-800 p-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Badge
            variant="outline"
            className={cn(
              "gap-1",
              isBuilding
                ? "border-blue-500/40 text-blue-300"
                : "border-amber-500/40 text-amber-300",
            )}
          >
            <Icon className="size-3" />
            {view.kindLabel}
          </Badge>
          <h2 className="text-sm leading-snug font-semibold text-slate-50">
            {view.name}
          </h2>
          <CopyId id={view.id} />
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close details"
          onClick={() => select(null)}
          className="text-slate-400 hover:bg-slate-800 hover:text-slate-50"
        >
          <X />
        </Button>
      </header>

      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-3">
        <section className="grid grid-cols-2 gap-2">
          {view.physical.map((p) => (
            <div
              key={p.label}
              className="rounded-lg border border-slate-800 bg-slate-900/50 px-2.5 py-2"
            >
              <div className="text-[11px] tracking-wide text-slate-400 uppercase">
                {p.label}
              </div>
              <div className="text-sm font-medium text-slate-100 tabular-nums">
                {p.value}
              </div>
            </div>
          ))}
        </section>

        {view.properties.length ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-slate-400">Properties</h3>
            <KeyValueList rows={view.properties} />
          </section>
        ) : null}

        {view.tags.length ? (
          <details className="group flex flex-col gap-2">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-200">
              <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
              All OSM tags ({view.tags.length})
            </summary>
            <div className="mt-2">
              <KeyValueList rows={view.tags} />
            </div>
          </details>
        ) : null}

        {view.osmUrl ? (
          <a
            href={view.osmUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-100"
          >
            <ExternalLink className="size-3.5" />
            View on OpenStreetMap
          </a>
        ) : null}
      </div>
    </aside>
  );
}
