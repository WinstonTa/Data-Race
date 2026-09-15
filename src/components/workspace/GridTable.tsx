"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ColumnProfile } from "@/core/parser/columnMapping";
import { isBlank, parseNumber } from "@/core/parser/parseNumber";
import type { ColumnMapping, Entity, Grid } from "@/core/types";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/stores/useProjectStore";
import { IconCell } from "./IconCell";

type Role = "name" | "category" | "period" | "unused";
type RowKind = "above" | "header" | "data";

export interface GridTableProps {
  grid: Grid;
  mapping: ColumnMapping;
  profiles: ColumnProfile[];
  entityByRow: Map<number, Entity>;
  /** Grid row indices to render, in order. */
  rows: number[];
  onTogglePeriod: (col: number, on: boolean) => void;
}

/*
 * Only the name column is frozen while scrolling sideways. Every sticky cell
 * becomes its own compositor layer, so pinning the row-number and control
 * cells too (3 × rows) made painting a 100-row page visibly stall.
 */
const LEFT_NAME = "0";

function columnLabel(header: string, index: number): string {
  return header || `Column ${index + 1}`;
}

/**
 * The raw CSV as a table. Rows above the header are dimmed and read-only,
 * the header row is highlighted, data rows carry the per-entity controls.
 * Click a cell to edit it; Enter/blur commits, Escape cancels.
 */
export function GridTable({
  grid,
  mapping,
  profiles,
  entityByRow,
  rows,
  onTogglePeriod,
}: GridTableProps) {
  const setCell = useProjectStore((s) => s.setCell);
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null);

  const periodSet = new Set(mapping.periodCols);
  const roleOf = (c: number): Role =>
    c === mapping.nameCol
      ? "name"
      : c === mapping.categoryCol
        ? "category"
        : periodSet.has(c)
          ? "period"
          : "unused";
  const kindOf = (r: number): RowKind =>
    r < mapping.headerRow
      ? "above"
      : r === mapping.headerRow
        ? "header"
        : "data";

  const commit = (r: number, c: number, value: string) => {
    setEditing(null);
    setCell(r, c, value);
  };

  return (
    <div className="max-h-[70vh] overflow-auto rounded-lg border">
      <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
        <thead className="bg-background sticky top-0 z-20">
          <tr>
            <th className="bg-background text-muted-foreground w-10 min-w-10 border-b px-2 py-2 text-left text-xs font-normal">
              #
            </th>
            <th className="bg-background text-muted-foreground w-[7.5rem] min-w-[7.5rem] border-b px-2 py-2 text-left text-xs font-normal">
              Show · Color · Icon
            </th>
            {profiles.map((p) => {
              const role = roleOf(p.index);
              return (
                <th
                  key={p.index}
                  className={cn(
                    "bg-background border-b px-2 py-2 text-left align-top font-normal",
                    role === "name" && "sticky z-30 min-w-44",
                    role === "period" && "min-w-28",
                    role === "unused" && "text-muted-foreground",
                  )}
                  style={role === "name" ? { left: LEFT_NAME } : undefined}
                >
                  <div
                    className="max-w-56 truncate font-medium"
                    title={columnLabel(p.header, p.index)}
                  >
                    {columnLabel(p.header, p.index)}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    {role === "name" ? (
                      <Badge>Name</Badge>
                    ) : role === "category" ? (
                      <Badge variant="secondary">Category</Badge>
                    ) : (
                      <label className="flex cursor-pointer items-center gap-1.5">
                        <Checkbox
                          checked={role === "period"}
                          onCheckedChange={(v) =>
                            onTogglePeriod(p.index, v === true)
                          }
                          aria-label={`Use ${columnLabel(p.header, p.index)} as a period`}
                        />
                        Period
                      </label>
                    )}
                    <span className="text-muted-foreground tabular-nums">
                      {p.nonBlank === 0
                        ? "empty"
                        : `${p.numeric}/${p.nonBlank} numeric`}
                    </span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const kind = kindOf(r);
            const entity = kind === "data" ? entityByRow.get(r) : undefined;
            const row = grid[r];
            const dim = entity ? !entity.included : kind === "above";
            return (
              <tr
                key={r}
                className={cn(
                  "group",
                  kind === "header" && "bg-muted",
                  dim && "opacity-50",
                )}
              >
                <td className="text-muted-foreground border-b px-2 py-1 text-xs tabular-nums">
                  {r + 1}
                </td>
                <td className="border-b px-2 py-1">
                  <RowControls kind={kind} entity={entity} />
                </td>
                {profiles.map((p) => {
                  const c = p.index;
                  const role = roleOf(c);
                  const raw = row[c] ?? "";
                  const isEditing = editing?.r === r && editing.c === c;
                  const editable = kind !== "above";
                  return (
                    <td
                      key={c}
                      className={cn(
                        "border-b px-2 py-1",
                        role === "name" && "sticky z-10 font-medium",
                        role === "name" &&
                          (kind === "header" ? "bg-muted" : "bg-background"),
                        role === "unused" && "text-muted-foreground",
                        kind === "above" && "text-muted-foreground italic",
                        kind === "header" && "font-semibold",
                        editable &&
                          !isEditing &&
                          "hover:bg-muted/60 cursor-text",
                      )}
                      style={role === "name" ? { left: LEFT_NAME } : undefined}
                      onClick={() => {
                        if (editable && !isEditing) setEditing({ r, c });
                      }}
                    >
                      {isEditing ? (
                        <Input
                          autoFocus
                          defaultValue={raw}
                          className="h-7 min-w-24 px-1 text-sm"
                          onBlur={(ev) => commit(r, c, ev.currentTarget.value)}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter") {
                              commit(r, c, ev.currentTarget.value);
                            } else if (ev.key === "Escape") {
                              setEditing(null);
                            }
                          }}
                        />
                      ) : (
                        <CellView raw={raw} role={role} kind={kind} />
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RowControls({
  kind,
  entity,
}: {
  kind: RowKind;
  entity: Entity | undefined;
}) {
  const update = useProjectStore((s) => s.updateEntity);
  if (kind === "above")
    return <span className="text-muted-foreground text-xs">ignored</span>;
  if (kind === "header")
    return (
      <Badge variant="outline" className="text-xs">
        Header
      </Badge>
    );
  if (!entity)
    return <span className="text-muted-foreground text-xs">no name</span>;

  const hasData = entity.values.some((v) => v !== null);
  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Switch
              checked={entity.included}
              disabled={!hasData}
              onCheckedChange={(v) => update(entity.id, { included: v })}
              aria-label={`Show ${entity.name}`}
            />
          </span>
        </TooltipTrigger>
        {!hasData ? (
          <TooltipContent>No numeric values in this row</TooltipContent>
        ) : null}
      </Tooltip>
      <input
        type="color"
        className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
        value={entity.color}
        onChange={(ev) => update(entity.id, { color: ev.target.value })}
        aria-label={`Color for ${entity.name}`}
      />
      <IconCell entity={entity} />
    </div>
  );
}

function CellView({
  raw,
  role,
  kind,
}: {
  raw: string;
  role: Role;
  kind: RowKind;
}) {
  if (kind === "data" && role === "period") {
    if (isBlank(raw))
      return <span className="text-muted-foreground block text-right">·</span>;
    const n = parseNumber(raw);
    if (n === null)
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="bg-destructive/10 text-destructive block max-w-40 truncate rounded px-1 text-right font-mono text-xs">
              {raw}
            </span>
          </TooltipTrigger>
          <TooltipContent>Not a number — treated as missing</TooltipContent>
        </Tooltip>
      );
    return (
      <span className="block text-right font-mono text-xs tabular-nums">
        {n.toLocaleString()}
      </span>
    );
  }
  const text = raw.trim();
  if (text === "")
    return <span className="text-muted-foreground block min-w-6">·</span>;
  return (
    <span className="block max-w-56 truncate" title={text}>
      {text}
    </span>
  );
}
