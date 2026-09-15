"use client";

import { ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Entity } from "@/core/types";
import { addImage, removeImage } from "@/lib/assets";
import { useAssetStore } from "@/stores/useAssetStore";
import { useProjectStore } from "@/stores/useProjectStore";

export function TableEditor() {
  const dataset = useProjectStore((s) => s.dataset);
  if (!dataset) return null;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="text-sm">
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Show</TableHead>
            <TableHead className="w-12">Color</TableHead>
            <TableHead className="min-w-44">Name</TableHead>
            <TableHead className="min-w-32">Category</TableHead>
            <TableHead className="w-24">Icon</TableHead>
            {dataset.periods.map((p) => (
              <TableHead key={p} className="text-right font-mono text-xs">
                {p}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {dataset.entities.map((e) => (
            <EntityRow key={e.id} entity={e} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EntityRow({ entity }: { entity: Entity }) {
  const update = useProjectStore((s) => s.updateEntity);
  const hasData = entity.values.some((v) => v !== null);

  return (
    <TableRow className={entity.included ? "" : "opacity-50"}>
      <TableCell>
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
      </TableCell>
      <TableCell>
        <input
          type="color"
          className="size-7 cursor-pointer rounded border-0 bg-transparent p-0"
          value={entity.color}
          onChange={(ev) => update(entity.id, { color: ev.target.value })}
          aria-label={`Color for ${entity.name}`}
        />
      </TableCell>
      <TableCell>
        <Input
          className="h-8"
          value={entity.name}
          onChange={(ev) => update(entity.id, { name: ev.target.value })}
        />
      </TableCell>
      <TableCell>
        <Input
          className="h-8"
          value={entity.category ?? ""}
          placeholder="—"
          onChange={(ev) =>
            update(entity.id, { category: ev.target.value || undefined })
          }
        />
      </TableCell>
      <TableCell>
        <IconCell entity={entity} />
      </TableCell>
      {entity.values.map((v, i) => (
        <TableCell
          key={i}
          className="text-muted-foreground text-right font-mono text-xs tabular-nums"
        >
          {v === null ? "·" : v.toLocaleString()}
        </TableCell>
      ))}
    </TableRow>
  );
}

function IconCell({ entity }: { entity: Entity }) {
  const update = useProjectStore((s) => s.updateEntity);
  const url = useAssetStore((s) =>
    entity.imageId ? s.urls.get(entity.imageId) : undefined,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const previous = entity.imageId;
      const id = await addImage(file);
      update(entity.id, { imageId: id });
      if (previous) await removeImage(previous);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load image.");
    }
  };

  const onRemove = async () => {
    if (!entity.imageId) return;
    const id = entity.imageId;
    update(entity.id, { imageId: undefined });
    await removeImage(id);
  };

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(ev) => {
          void onFile(ev.target.files?.[0]);
          ev.target.value = "";
        }}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => inputRef.current?.click()}
            aria-label={`Upload icon for ${entity.name}`}
          >
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element -- object URL, not an optimizable asset
              <img
                src={url}
                alt=""
                className="size-6 rounded-full object-cover"
              />
            ) : (
              <ImagePlus className="text-muted-foreground" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {error ?? (url ? "Replace icon" : "Upload icon (PNG/JPG/SVG)")}
        </TooltipContent>
      </Tooltip>
      {url ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={onRemove}
          aria-label={`Remove icon for ${entity.name}`}
        >
          <X className="size-3" />
        </Button>
      ) : null}
    </div>
  );
}
