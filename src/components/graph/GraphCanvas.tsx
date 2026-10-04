"use client";

import { createNodeBorderProgram } from "@sigma/node-border";
import { UndirectedGraph } from "graphology";
import FA2Layout from "graphology-layout-forceatlas2/worker";
import { inferSettings } from "graphology-layout-forceatlas2";
import { Loader2, Maximize, Minus, Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import Sigma from "sigma";
import type { EdgeDisplayData, NodeDisplayData } from "sigma/types";
import { Button } from "@/components/ui/button";
import {
  nodeLabel,
  type GraphAnalysis,
  type GraphData,
} from "@/core/graph/types";
import { OTHER_COLOR } from "@/core/graph/metrics";
import { mulberry32 } from "@/core/random";
import {
  useGraphStore,
  type GraphState,
  type NodePositions,
} from "@/stores/useGraphStore";
import { getActiveSigma, setActiveSigma } from "./sigmaRegistry";

/** Id of the visual-only "You" node. Not a valid snowflake, so no clashes. */
export const EGO_ID = "__ego__";

const DIM_NODE = "#e5e7eb";
const EDGE_COLOR = "rgba(100, 116, 139, 0.4)";
const EDGE_FOCUS = "rgba(31, 41, 55, 0.65)";
const EGO_EDGE = "rgba(148, 163, 184, 0.10)";
const BRIDGE_BORDER = "#111827";
const MAX_FORCED_LABELS = 40;

interface NodeAttrs {
  x: number;
  y: number;
  size: number;
  color: string;
  label: string;
  degree: number;
  type: "circle" | "border";
  borderColor?: string;
  fixed?: boolean;
  ego?: boolean;
}

interface EdgeAttrs {
  size: number;
  color: string;
  ego?: boolean;
}

type DisplayGraph = UndirectedGraph<NodeAttrs, EdgeAttrs>;

/** Seed positions: one blob per community on a circle, isolates on an outer ring. */
function seedPositions(
  data: GraphData,
  analysis: GraphAnalysis,
): NodePositions {
  const rand = mulberry32(1);
  const n = data.nodes.length;
  const radius = Math.max(10, Math.sqrt(n) * 12);
  const groups = Math.max(1, analysis.communities.length);
  const out: NodePositions = {};
  for (const node of data.nodes) {
    const m = analysis.metrics[node.id];
    const a = rand() * Math.PI * 2;
    if (!m || m.community === null) {
      const r = radius * (1.6 + rand() * 0.2);
      out[node.id] = [Math.cos(a) * r, Math.sin(a) * r];
      continue;
    }
    const c = analysis.communities[m.community];
    const angle = (m.community / groups) * Math.PI * 2;
    const spread = Math.sqrt(c.size) * 3 * Math.sqrt(rand());
    out[node.id] = [
      Math.cos(angle) * radius + Math.cos(a) * spread,
      Math.sin(angle) * radius + Math.sin(a) * spread,
    ];
  }
  return out;
}

function buildDisplayGraph(
  data: GraphData,
  analysis: GraphAnalysis,
  positions: NodePositions | null,
): { graph: DisplayGraph; seeded: boolean } {
  const graph: DisplayGraph = new UndirectedGraph();
  const complete =
    positions !== null && data.nodes.every((n) => positions[n.id]);
  const pos = complete ? positions : seedPositions(data, analysis);
  const maxDegree = Math.max(
    1,
    ...Object.values(analysis.metrics).map((m) => m.degree),
  );
  for (const node of data.nodes) {
    const m = analysis.metrics[node.id];
    const community =
      m && m.community !== null ? analysis.communities[m.community] : null;
    const [x, y] = pos[node.id];
    graph.addNode(node.id, {
      x,
      y,
      size: 3 + 14 * Math.sqrt((m?.degree ?? 0) / maxDegree),
      color: community?.color ?? OTHER_COLOR,
      label: nodeLabel(node),
      degree: m?.degree ?? 0,
      type: m?.isBridge ? "border" : "circle",
      borderColor: m?.isBridge ? BRIDGE_BORDER : undefined,
    });
  }
  for (const e of data.edges) {
    if (graph.hasNode(e.source) && graph.hasNode(e.target))
      graph.mergeEdge(e.source, e.target, { size: 1, color: EDGE_COLOR });
  }
  return { graph, seeded: !complete };
}

function readPositions(graph: DisplayGraph): NodePositions {
  const out: NodePositions = {};
  graph.forEachNode((id, a) => {
    if (!a.ego) out[id] = [a.x, a.y];
  });
  return out;
}

function syncEgo(graph: DisplayGraph, show: boolean) {
  if (!show) {
    if (graph.hasNode(EGO_ID)) graph.dropNode(EGO_ID);
    return;
  }
  if (graph.hasNode(EGO_ID)) return;
  let sx = 0;
  let sy = 0;
  graph.forEachNode((_, a) => {
    sx += a.x;
    sy += a.y;
  });
  const n = Math.max(1, graph.order);
  const friends = graph.nodes();
  graph.addNode(EGO_ID, {
    x: sx / n,
    y: sy / n,
    size: 12,
    color: "#111827",
    label: "You",
    degree: Infinity,
    type: "circle",
    fixed: true,
    ego: true,
  });
  for (const f of friends)
    graph.addEdge(EGO_ID, f, { size: 0.5, color: EGO_EDGE, ego: true });
}

export function GraphCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const data = useGraphStore((s) => s.data);
  const analysis = useGraphStore((s) => s.analysis);
  const analyzing = useGraphStore((s) => s.analyzing);
  const layoutRunning = useGraphStore((s) => s.layoutRunning);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !data || !analysis) return;

    const store = useGraphStore.getState();
    const { graph, seeded } = buildDisplayGraph(
      data,
      analysis,
      store.positions,
    );
    syncEgo(graph, store.settings.showEgo);

    let hovered: string | null = null;
    const focusNode = () => {
      const f = hovered ?? useGraphStore.getState().selectedId;
      return f && graph.hasNode(f) ? f : null;
    };

    const sigma = new Sigma<NodeAttrs, EdgeAttrs>(graph, container, {
      nodeProgramClasses: {
        border: createNodeBorderProgram({
          borders: [
            { size: { value: 0.22 }, color: { attribute: "borderColor" } },
            { size: { fill: true }, color: { attribute: "color" } },
          ],
        }),
      },
      labelFont: "ui-sans-serif, system-ui, sans-serif",
      labelSize: 12,
      labelRenderedSizeThreshold: 9,
      zIndex: true,
      minCameraRatio: 0.03,
      maxCameraRatio: 6,
      nodeReducer: (node, attrs) => {
        const s = useGraphStore.getState();
        const res: Partial<NodeDisplayData> & Partial<NodeAttrs> = {
          ...attrs,
        };
        if (!attrs.ego && attrs.degree < s.settings.minDegree) {
          res.hidden = true;
          return res;
        }
        const focus = focusNode();
        if (!focus) return res;
        if (node === focus) {
          res.highlighted = true;
          res.forceLabel = true;
          res.zIndex = 2;
        } else if (graph.areNeighbors(node, focus) && !(focus === EGO_ID)) {
          res.zIndex = 1;
          res.forceLabel = graph.degree(focus) <= MAX_FORCED_LABELS;
        } else if (!attrs.ego) {
          res.color = DIM_NODE;
          res.borderColor = DIM_NODE;
          res.label = "";
          res.zIndex = 0;
        }
        return res;
      },
      edgeReducer: (edge, attrs) => {
        const res: Partial<EdgeDisplayData> = { ...attrs };
        const focus = focusNode();
        if (!focus) return res;
        if (graph.hasExtremity(edge, focus) && !attrs.ego) {
          res.color = EDGE_FOCUS;
          res.size = 1.5;
          res.zIndex = 1;
        } else {
          res.hidden = true;
        }
        return res;
      },
    });
    setActiveSigma(sigma as unknown as Sigma);
    const refresh = () => sigma.refresh({ skipIndexation: true });
    // Sigma only listens to window resizes; the grid cell can change size
    // on its own (scrollbars, breakpoints, side panel content).
    const resizeObserver = new ResizeObserver(() => {
      sigma.resize(true);
      sigma.refresh();
    });
    resizeObserver.observe(container);

    // --- force layout --------------------------------------------------
    let layout: FA2Layout | null = null;
    let layoutTimer: ReturnType<typeof setTimeout> | undefined;
    const stopLayout = (save: boolean) => {
      clearTimeout(layoutTimer);
      if (!layout) return;
      layout.kill();
      layout = null;
      useGraphStore.getState().setLayoutRunning(false);
      if (save) useGraphStore.getState().setPositions(readPositions(graph));
    };
    const runLayout = () => {
      stopLayout(false);
      const { repulsion } = useGraphStore.getState().settings;
      graph.forEachNode((id, a) => {
        if (!a.ego) graph.setNodeAttribute(id, "fixed", false);
      });
      layout = new FA2Layout(graph, {
        settings: {
          ...inferSettings(graph),
          scalingRatio: repulsion,
          gravity: 1,
          slowDown: 4,
          barnesHutOptimize: graph.order > 300,
        },
        getEdgeWeight: (_e, attrs) => (attrs.ego ? 0 : 1),
      });
      layout.start();
      useGraphStore.getState().setLayoutRunning(true);
      layoutTimer = setTimeout(
        () => stopLayout(true),
        Math.min(10_000, 2000 + graph.order * 8),
      );
    };
    if (seeded) runLayout();

    // --- interactions --------------------------------------------------
    let dragged: string | null = null;
    let dragMoved = false;

    sigma.on("enterNode", ({ node }) => {
      hovered = node;
      refresh();
    });
    sigma.on("leaveNode", () => {
      hovered = null;
      refresh();
    });
    sigma.on("downNode", ({ node }) => {
      if (node === EGO_ID) return;
      // A running layout would snap the node straight back.
      stopLayout(true);
      dragged = node;
      dragMoved = false;
      if (!sigma.getCustomBBox()) sigma.setCustomBBox(sigma.getBBox());
    });
    sigma.on("moveBody", ({ event }) => {
      if (!dragged) return;
      const p = sigma.viewportToGraph(event);
      graph.mergeNodeAttributes(dragged, { x: p.x, y: p.y, fixed: true });
      dragMoved = true;
      event.preventSigmaDefault();
      event.original.preventDefault();
      event.original.stopPropagation();
    });
    const endDrag = () => {
      if (dragged && dragMoved)
        useGraphStore.getState().setPositions(readPositions(graph));
      dragged = null;
    };
    sigma.on("upNode", endDrag);
    sigma.on("upStage", endDrag);
    sigma.on("clickNode", ({ node }) => {
      if (dragMoved) {
        dragMoved = false;
        return;
      }
      if (node === EGO_ID) return;
      const { selectedId, select } = useGraphStore.getState();
      select(selectedId === node ? null : node);
    });
    sigma.on("clickStage", () => {
      if (dragMoved) {
        dragMoved = false;
        return;
      }
      useGraphStore.getState().select(null);
    });

    // --- store → canvas -----------------------------------------------
    let repulsionTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useGraphStore.subscribe(
      (s: GraphState, prev: GraphState) => {
        if (
          s.selectedId !== prev.selectedId ||
          s.settings.minDegree !== prev.settings.minDegree
        )
          refresh();
        if (s.settings.showEgo !== prev.settings.showEgo) {
          syncEgo(graph, s.settings.showEgo);
        }
        if (s.layoutNonce !== prev.layoutNonce) runLayout();
        if (s.settings.repulsion !== prev.settings.repulsion) {
          clearTimeout(repulsionTimer);
          repulsionTimer = setTimeout(runLayout, 250);
        }
        if (
          s.focusNonce !== prev.focusNonce &&
          s.selectedId &&
          graph.hasNode(s.selectedId)
        ) {
          const d = sigma.getNodeDisplayData(s.selectedId);
          const camera = sigma.getCamera();
          if (d)
            void camera.animate(
              { x: d.x, y: d.y, ratio: Math.min(camera.ratio, 0.6) },
              { duration: 500 },
            );
        }
      },
    );

    return () => {
      resizeObserver.disconnect();
      unsubscribe();
      clearTimeout(repulsionTimer);
      stopLayout(false);
      setActiveSigma(null);
      sigma.kill();
    };
  }, [data, analysis]);

  const camera = (fn: (s: Sigma) => void) => () => {
    const s = getActiveSigma();
    if (s) fn(s);
  };

  return (
    <div className="relative h-[70vh] min-h-[420px] w-full overflow-hidden rounded-lg border bg-white">
      <div ref={containerRef} className="absolute inset-0" />
      {analyzing || !analysis ? (
        <div className="text-muted-foreground absolute inset-0 flex items-center justify-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> Analyzing graph…
        </div>
      ) : null}
      {layoutRunning ? (
        <div className="text-muted-foreground absolute top-2 left-2 flex items-center gap-1.5 rounded-md bg-white/80 px-2 py-1 text-xs">
          <Loader2 className="size-3 animate-spin" /> Laying out…
        </div>
      ) : null}
      <div className="absolute right-2 bottom-2 flex flex-col gap-1">
        <Button
          size="icon"
          variant="outline"
          aria-label="Zoom in"
          onClick={camera((s) => void s.getCamera().animatedZoom(1.5))}
        >
          <Plus />
        </Button>
        <Button
          size="icon"
          variant="outline"
          aria-label="Zoom out"
          onClick={camera((s) => void s.getCamera().animatedUnzoom(1.5))}
        >
          <Minus />
        </Button>
        <Button
          size="icon"
          variant="outline"
          aria-label="Fit graph"
          onClick={camera((s) => void s.getCamera().animatedReset())}
        >
          <Maximize />
        </Button>
      </div>
    </div>
  );
}

