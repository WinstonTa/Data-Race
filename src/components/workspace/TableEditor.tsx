"use client";

import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toChartReadyGrid } from "@/core/parser/chartReadyGrid";
import {
  isPeriodCandidate,
  profileColumns,
  suggestMapping,
} from "@/core/parser/columnMapping";
import type { Entity } from "@/core/types";
import { baseName } from "@/lib/download";
import { downloadCsv } from "@/lib/projectFile";
import { useProjectStore } from "@/stores/useProjectStore";
import { GridTable } from "./GridTable";

const PAGE_SIZE = 50;
const HEADER_CHOICES = 25;
const NONE = "__none__";

function preview(row: string[], max = 60): string {
  const text = row
    .map((c) => c.trim())
    .filter(Boolean)
    .join(", ");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function TableEditor() {
  const source = useProjectStore((s) => s.source);
  const dataset = useProjectStore((s) => s.dataset);
  const sourceName = useProjectStore((s) => s.sourceName);
  const setMapping = useProjectStore((s) => s.setMapping);
  const setIncludedMany = useProjectStore((s) => s.setIncludedMany);

  const [filter, setFilter] = useState("");
  const [requestedPage, setPage] = useState(0);

  const grid = source?.grid;
  const mapping = source?.mapping;

  const profiles = useMemo(
    () => (grid && mapping ? profileColumns(grid, mapping.headerRow) : []),
    [grid, mapping],
  );

  const entityByRow = useMemo(() => {
    const m = new Map<number, Entity>();
    for (const e of dataset?.entities ?? [])
      if (e.sourceRow !== undefined) m.set(e.sourceRow, e);
    return m;
  }, [dataset]);

  // Data rows (below the header) that match the name filter.
  const dataRows = useMemo(() => {
    if (!grid || !mapping) return [];
    const q = filter.trim().toLowerCase();
    const out: number[] = [];
    for (let r = mapping.headerRow + 1; r < grid.length; r++) {
      if (q && !(grid[r][mapping.nameCol] ?? "").toLowerCase().includes(q))
        continue;
      out.push(r);
    }
    return out;
  }, [grid, mapping, filter]);

  const pageCount = Math.max(1, Math.ceil(dataRows.length / PAGE_SIZE));
  // Clamp instead of resetting in an effect: the grid can shrink under us.
  const page = Math.min(requestedPage, pageCount - 1);

  if (!grid || !mapping || !dataset) return null;

  const contextRows = Array.from(
    { length: mapping.headerRow + 1 },
    (_, i) => i,
  );
  const pageRows = dataRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const rows = [...contextRows, ...pageRows];

  const matchingEntities = dataRows
    .map((r) => entityByRow.get(r))
    .filter((e): e is Entity => !!e);
  const emptyRows = dataset.entities.filter(
    (e) => !e.values.some((v) => v !== null),
  ).length;
  const unusedCount = profiles.filter(
    (p) =>
      p.nonBlank > 0 &&
      p.index !== mapping.nameCol &&
      p.index !== mapping.categoryCol &&
      !mapping.periodCols.includes(p.index),
  ).length;

  const columnOptions = profiles.map((p) => ({
    value: String(p.index),
    label: p.header || `Column ${p.index + 1}`,
  }));

  const stem = baseName(sourceName);

  return (
    <div className="flex flex-col gap-3" id="column-setup">
      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="header-row">Header row</Label>
            <Select
              value={String(mapping.headerRow)}
              onValueChange={(v) =>
                setMapping(
                  suggestMapping(grid, { headerRow: Number(v) }).mapping,
                )
              }
            >
              <SelectTrigger id="header-row" className="w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {grid.slice(0, HEADER_CHOICES).map((row, i) => (
                  <SelectItem key={i} value={String(i)}>
                    Row {i + 1}: {preview(row)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name-col">Name column</Label>
            <Select
              value={String(mapping.nameCol)}
              onValueChange={(v) =>
                setMapping({ ...mapping, nameCol: Number(v) })
              }
            >
              <SelectTrigger id="name-col" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columnOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category-col">Category column</Label>
            <Select
              value={
                mapping.categoryCol === undefined
                  ? NONE
                  : String(mapping.categoryCol)
              }
              onValueChange={(v) =>
                setMapping({
                  ...mapping,
                  categoryCol: v === NONE ? undefined : Number(v),
                })
              }
            >
              <SelectTrigger id="category-col" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {columnOptions
                  .filter((o) => o.value !== String(mapping.nameCol))
                  .map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Period columns</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm tabular-nums">
                {mapping.periodCols.length} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setMapping({
                    ...mapping,
                    periodCols: profiles
                      .filter(isPeriodCandidate)
                      .map((p) => p.index),
                  })
                }
              >
                Select numeric columns
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={mapping.periodCols.length === 0}
                onClick={() => setMapping({ ...mapping, periodCols: [] })}
              >
                Clear
              </Button>
            </div>
          </div>
        </div>

        <p className="text-muted-foreground text-sm">
          {mapping.headerRow > 0
            ? `${mapping.headerRow} row${mapping.headerRow === 1 ? "" : "s"} above the header ignored · `
            : ""}
          {dataset.entities.length} entities · {dataset.periods.length} periods
          {unusedCount > 0
            ? ` · ${unusedCount} column${unusedCount === 1 ? "" : "s"} unused`
            : ""}
          {emptyRows > 0
            ? ` · ${emptyRows} row${emptyRows === 1 ? "" : "s"} with no data`
            : ""}
          . Tick a column&apos;s Period box to use it; click any cell to edit
          it.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="h-8 w-56"
              placeholder="Filter rows by name…"
              value={filter}
              onChange={(ev) => {
                setFilter(ev.target.value);
                setPage(0);
              }}
              aria-label="Filter rows by name"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={matchingEntities.length === 0}
              onClick={() =>
                setIncludedMany(
                  matchingEntities.map((e) => e.id),
                  false,
                )
              }
            >
              Hide {matchingEntities.length} matching
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={matchingEntities.length === 0}
              onClick={() =>
                setIncludedMany(
                  matchingEntities.map((e) => e.id),
                  true,
                )
              }
            >
              Show {matchingEntities.length} matching
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {dataRows.length > PAGE_SIZE ? (
              <div className="flex items-center gap-1 text-sm">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft />
                </Button>
                <span className="text-muted-foreground tabular-nums">
                  Rows {page * PAGE_SIZE + 1}–
                  {Math.min((page + 1) * PAGE_SIZE, dataRows.length)} of{" "}
                  {dataRows.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage(page + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight />
                </Button>
              </div>
            ) : (
              <span className="text-muted-foreground text-sm tabular-nums">
                {dataRows.length} rows
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCsv(grid, `${stem}-edited`)}
            >
              <Download /> Edited CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={mapping.periodCols.length === 0}
              onClick={() =>
                downloadCsv(
                  toChartReadyGrid(grid, mapping),
                  `${stem}-chart-ready`,
                )
              }
            >
              <Download /> Chart-ready CSV
            </Button>
          </div>
        </div>
      </div>

      <GridTable
        grid={grid}
        mapping={mapping}
        profiles={profiles}
        entityByRow={entityByRow}
        rows={rows}
        onTogglePeriod={(col, on) =>
          setMapping({
            ...mapping,
            periodCols: on
              ? [...mapping.periodCols, col]
              : mapping.periodCols.filter((c) => c !== col),
          })
        }
      />
    </div>
  );
}
