import type { GraphAnalysis, GraphData } from "@/core/graph/types";
import type {
  GraphWorkerRequest,
  GraphWorkerResponse,
} from "@/workers/graph.worker";

export interface GraphAnalysisHandle {
  /** Resolves with the metrics; rejects on error or cancel. */
  result: Promise<GraphAnalysis>;
  cancel: () => void;
}

/**
 * Compute graph metrics in a dedicated worker. Betweenness is O(V·E), which
 * for a full Discord friend list would freeze the page on the main thread.
 */
export function analyzeInWorker(data: GraphData): GraphAnalysisHandle {
  const worker = new Worker(
    new URL("../workers/graph.worker.ts", import.meta.url),
    { type: "module" },
  );

  let settled = false;
  let rejectFn: (e: Error) => void = () => {};
  const result = new Promise<GraphAnalysis>((resolve, reject) => {
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
      worker.terminate();
    };
    rejectFn = (e) => finish(() => reject(e));

    worker.onmessage = (ev: MessageEvent<GraphWorkerResponse>) => {
      const msg = ev.data;
      if (msg.type === "done") finish(() => resolve(msg.analysis));
      else finish(() => reject(new Error(msg.message)));
    };
    worker.onerror = (ev) =>
      finish(() =>
        reject(new Error(ev.message || "Graph analysis worker failed.")),
      );

    const request: GraphWorkerRequest = { type: "analyze", data };
    worker.postMessage(request);
  });

  return {
    result,
    cancel: () => {
      const err = new Error("Analysis cancelled.");
      err.name = "AbortError";
      rejectFn(err);
    },
  };
}
