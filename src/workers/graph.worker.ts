/// <reference lib="webworker" />

import { analyzeGraph } from "@/core/graph/metrics";
import type { GraphAnalysis, GraphData } from "@/core/graph/types";

/** Messages from the main thread. */
export type GraphWorkerRequest = { type: "analyze"; data: GraphData };

/** Messages to the main thread. */
export type GraphWorkerResponse =
  | { type: "done"; analysis: GraphAnalysis }
  | { type: "error"; message: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;
const post = (msg: GraphWorkerResponse) => scope.postMessage(msg);

scope.onmessage = (ev: MessageEvent<GraphWorkerRequest>) => {
  try {
    post({ type: "done", analysis: analyzeGraph(ev.data.data) });
  } catch (e) {
    post({
      type: "error",
      message: e instanceof Error ? e.message : "Graph analysis failed.",
    });
  }
};
