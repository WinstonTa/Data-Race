"use client";

import { ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Entity } from "@/core/types";
import { addImage, removeImage } from "@/lib/assets";
import { useAssetStore } from "@/stores/useAssetStore";
import { useProjectStore } from "@/stores/useProjectStore";

/** Upload / replace / remove the icon drawn inside an entity's bar. */
export function IconCell({ entity }: { entity: Entity }) {
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
