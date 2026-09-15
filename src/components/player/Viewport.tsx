"use client";

import { useEffect, useRef } from "react";
import { chartFont } from "@/core/render/fonts";
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from "@/core/render/layout";
import { createRenderer, type Renderer } from "@/core/render/renderFrame";
import { frameAt } from "@/core/timeline/frameAt";
import { useAssetStore } from "@/stores/useAssetStore";
import { usePlaybackStore } from "@/stores/usePlaybackStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { useFrameContext } from "./useFrameContext";

/**
 * 16:9 canvas that draws the current frame in the fixed 1920x1080 logical
 * space, scaled to the container and the device pixel ratio. Playback frames
 * are drawn from a store subscription so React never re-renders per frame.
 */
export function Viewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const frameCtx = useFrameContext();

  const settings = useProjectStore((s) => s.settings);
  const bitmaps = useAssetStore((s) => s.bitmaps);

  // Keep the latest inputs in a ref so the draw closure is stable.
  const inputs = useRef({ frameCtx, settings, bitmaps });
  const drawRef = useRef<() => void>(() => {});

  // Redraw when data, settings or images change.
  useEffect(() => {
    inputs.current = { frameCtx, settings, bitmaps };
    drawRef.current();
  }, [frameCtx, settings, bitmaps]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    rendererRef.current = createRenderer(ctx);

    const draw = () => {
      const { frameCtx, settings, bitmaps } = inputs.current;
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;
      const bw = Math.round(w * dpr);
      const bh = Math.round(h * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }

      const scale = Math.min(bw / LOGICAL_WIDTH, bh / LOGICAL_HEIGHT);
      const ox = (bw - LOGICAL_WIDTH * scale) / 2;
      const oy = (bh - LOGICAL_HEIGHT * scale) / 2;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, bw, bh);
      ctx.setTransform(scale, 0, 0, scale, ox, oy);

      const frame = frameAt(frameCtx, usePlaybackStore.getState().t);
      rendererRef.current?.render(frame, settings, bitmaps);
    };
    drawRef.current = draw;

    const ro = new ResizeObserver(draw);
    ro.observe(container);

    const unsub = usePlaybackStore.subscribe((s, prev) => {
      if (s.t !== prev.t) draw();
    });

    // Text metrics measured before the font arrived are wrong; redraw once it lands.
    let cancelled = false;
    document.fonts
      .load(chartFont(600, 20), "Ag")
      .then(() => document.fonts.ready)
      .then(() => {
        if (cancelled) return;
        rendererRef.current?.invalidate();
        draw();
      });

    draw();
    return () => {
      cancelled = true;
      ro.disconnect();
      unsub();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative aspect-video w-full overflow-hidden rounded-lg bg-black"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
