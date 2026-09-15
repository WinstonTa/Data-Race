"use client";

import { AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { HealthWarning, HealthWarningKind } from "@/core/types";
import { useProjectStore } from "@/stores/useProjectStore";

const TITLES: Record<HealthWarningKind, string> = {
  "empty-row": "Rows without data were excluded",
  "non-numeric": "Some cells could not be read as numbers",
  "duplicate-name": "Duplicate names",
  "no-period-columns": "No period columns found",
  "no-rows": "No data rows",
  "image-column-ignored": "Image column ignored",
};

const BLOCKING: HealthWarningKind[] = ["no-period-columns", "no-rows"];
const NO_WARNINGS: HealthWarning[] = [];

export function HealthAlerts() {
  const warnings = useProjectStore((s) => s.dataset?.warnings ?? NO_WARNINGS);
  if (warnings.length === 0) return null;

  const groups = new Map<HealthWarningKind, HealthWarning[]>();
  for (const w of warnings)
    groups.set(w.kind, [...(groups.get(w.kind) ?? []), w]);

  return (
    <div className="flex flex-col gap-2">
      {[...groups.entries()].map(([kind, items]) => {
        const blocking = BLOCKING.includes(kind);
        return (
          <Alert key={kind} variant={blocking ? "destructive" : "default"}>
            {blocking ? <AlertTriangle /> : <Info />}
            <AlertTitle>
              {TITLES[kind]}
              {items.length > 1 ? ` (${items.length})` : ""}
            </AlertTitle>
            <AlertDescription>
              <ul className="max-h-32 list-disc overflow-y-auto pl-4">
                {items.slice(0, 20).map((w, i) => (
                  <li key={i}>{w.message}</li>
                ))}
                {items.length > 20 ? (
                  <li>…and {items.length - 20} more</li>
                ) : null}
              </ul>
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}
