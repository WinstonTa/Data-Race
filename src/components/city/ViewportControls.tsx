"use client";

import type { MapViewState } from "@deck.gl/core";
import { Box, Compass, Minus, Plus, Square } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  viewState: MapViewState;
  onZoom: (delta: number) => void;
  onResetNorth: () => void;
  onTogglePitch: () => void;
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={onClick}
          className="text-slate-300 hover:bg-slate-800 hover:text-slate-50"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Zoom, reset north/tilt, 2D/3D — bottom-left of the viewer. */
export function ViewportControls({
  viewState,
  onZoom,
  onResetNorth,
  onTogglePitch,
}: Props) {
  const flat = viewState.pitch === 0;
  return (
    <div className="pointer-events-auto flex w-fit flex-col gap-1 self-start rounded-xl border border-slate-800 bg-slate-950/70 p-1 shadow-lg backdrop-blur-md">
      <ControlButton label="Zoom in" onClick={() => onZoom(1)}>
        <Plus />
      </ControlButton>
      <ControlButton label="Zoom out" onClick={() => onZoom(-1)}>
        <Minus />
      </ControlButton>
      <ControlButton label="Reset north and tilt" onClick={onResetNorth}>
        <Compass
          style={{ transform: `rotate(${-(viewState.bearing ?? 0)}deg)` }}
        />
      </ControlButton>
      <ControlButton
        label={flat ? "Switch to 3D" : "Switch to 2D"}
        onClick={onTogglePitch}
      >
        {flat ? <Box /> : <Square />}
      </ControlButton>
    </div>
  );
}
