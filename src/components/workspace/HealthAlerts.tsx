"use client";

import { AlertTriangle, Info, TableProperties } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { HealthWarning, HealthWarningKind } from "@/core/types";
import { useProjectStore } from "@/stores/useProjectStore";

const TITLES: Record<HealthWarningKind, string> = {
  "mapping-uncertain": "Check the column setup",
  "no-period-columns": "No period columns selected",
  "no-rows": "No data rows",
  "non-numeric": "Some cells could not be read as numbers",
  "empty-row": "Rows without data are hidden",
  "duplicate-name": "Duplicate names",
  "rows-above-header": "Rows above the header are ignored",
  "unused-columns": "Unused columns",
};

/** Display order: blocking first, then things to act on, then FYI. */
const ORDER: HealthWarningKind[] = [
  "no-period-columns",
  "no-rows",
  "mapping-uncertain",
  "non-numeric",
  "duplicate-name",
  "empty-row",
  "unused-columns",
  "rows-above-header",
];

const BLOCKING: HealthWarningKind[] = ["no-period-columns", "no-rows"];
/** Kinds that carry one message per affected row/cell. */
const PER_ITEM: HealthWarningKind[] = [
  "non-numeric",
  "empty-row",
  "duplicate-name",
];
const MAX_LISTED = 50;
const NO_WARNINGS: HealthWarning[] = [];

const SUMMARY: Partial<Record<HealthWarningKind, (n: number) => string>> = {
  "non-numeric": (n) =>
    `${n} cell${n === 1 ? "" : "s"} in period columns ${n === 1 ? "is" : "are"} not numeric and count${n === 1 ? "s" : ""} as missing. They are highlighted in the table; click a cell to fix it.`,
  "empty-row": (n) =>
    `${n} row${n === 1 ? " has" : "s have"} no numeric values in the selected period columns and ${n === 1 ? "is" : "are"} hidden from the chart.`,
  "duplicate-name": (n) =>
    `${n} name${n === 1 ? "" : "s"} appear${n === 1 ? "s" : ""} more than once; each row is shown as its own bar.`,
};

function scrollToSetup() {
  document
    .getElementById("column-setup")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function HealthAlerts() {
  const warnings = useProjectStore((s) => s.dataset?.warnings ?? NO_WARNINGS);
  if (warnings.length === 0) return null;

  const groups = new Map<HealthWarningKind, HealthWarning[]>();
  for (const w of warnings)
    groups.set(w.kind, [...(groups.get(w.kind) ?? []), w]);

  return (
    <div className="flex flex-col gap-2">
      {ORDER.filter((k) => groups.has(k)).map((kind) => {
        const items = groups.get(kind)!;
        const blocking = BLOCKING.includes(kind);
        const perItem = PER_ITEM.includes(kind);
        return (
          <Alert key={kind} variant={blocking ? "destructive" : "default"}>
            {blocking ? <AlertTriangle /> : <Info />}
            <AlertTitle>
              {TITLES[kind]}
              {perItem && items.length > 1 ? ` (${items.length})` : ""}
            </AlertTitle>
            <AlertDescription>
              {perItem ? (
                <details>
                  <summary className="cursor-pointer">
                    {SUMMARY[kind]?.(items.length)}
                  </summary>
                  <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-4">
                    {items.slice(0, MAX_LISTED).map((w, i) => (
                      <li key={i}>{w.message}</li>
                    ))}
                    {items.length > MAX_LISTED ? (
                      <li>…and {items.length - MAX_LISTED} more</li>
                    ) : null}
                  </ul>
                </details>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span>{items.map((w) => w.message).join(" ")}</span>
                  {kind === "mapping-uncertain" ||
                  kind === "no-period-columns" ? (
                    <Button variant="outline" size="sm" onClick={scrollToSetup}>
                      <TableProperties /> Open column setup
                    </Button>
                  ) : null}
                </div>
              )}
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}
