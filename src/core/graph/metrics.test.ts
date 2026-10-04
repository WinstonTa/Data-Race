import { describe, expect, it } from "vitest";
import { buildSampleFriendCsv } from "@/data/sampleFriendGraph";
import { parseGrid } from "../parser/grid";
import { toGraphology } from "./buildGraph";
import { analyzeGraph, localClustering } from "./metrics";
import { METRICS_CSV_HEADER, metricsToGrid } from "./metricsCsv";
import { parseEdgeList } from "./parseEdgeList";
import type { GraphData } from "./types";

function graph(ids: string[], pairs: [string, string][]): GraphData {
  return {
    nodes: ids.map((id) => ({ id, username: id, displayName: "" })),
    edges: pairs.map(([a, b]) =>
      a < b ? { source: a, target: b } : { source: b, target: a },
    ),
  };
}

/** Two 4-cliques (a*, b*) joined only through "x". */
function twoCliques(): GraphData {
  const a = ["a1", "a2", "a3", "a4"];
  const b = ["b1", "b2", "b3", "b4"];
  const pairs: [string, string][] = [];
  for (const g of [a, b])
    for (let i = 0; i < g.length; i++)
      for (let j = i + 1; j < g.length; j++) pairs.push([g[i], g[j]]);
  pairs.push(["x", "a1"], ["x", "b1"]);
  return graph([...a, ...b, "x", "lonely"], pairs);
}

describe("localClustering", () => {
  it("is 1 inside a triangle and 0 at the center of a star", () => {
    const tri = localClustering(
      toGraphology(graph(["a", "b", "c"], [["a", "b"], ["b", "c"], ["a", "c"]])),
    );
    expect(tri).toEqual({ a: 1, b: 1, c: 1 });
    const star = localClustering(
      toGraphology(graph(["h", "a", "b", "c"], [["h", "a"], ["h", "b"], ["h", "c"]])),
    );
    expect(star.h).toBe(0);
    expect(star.a).toBe(0);
  });

  it("handles a partially closed neighborhood", () => {
    // h has neighbors a,b,c; only a–b are linked → 1 of 3 pairs.
    const c = localClustering(
      toGraphology(
        graph(["h", "a", "b", "c"], [["h", "a"], ["h", "b"], ["h", "c"], ["a", "b"]]),
      ),
    );
    expect(c.h).toBeCloseTo(1 / 3);
  });
});

describe("analyzeGraph", () => {
  it("computes degree and normalized betweenness on a path", () => {
    const { metrics } = analyzeGraph(graph(["a", "b", "c"], [["a", "b"], ["b", "c"]]));
    expect(metrics.b.degree).toBe(2);
    expect(metrics.b.betweenness).toBeCloseTo(1);
    expect(metrics.a.betweenness).toBe(0);
  });

  it("finds two communities and the bridge between them", () => {
    const { metrics, communities, summary } = analyzeGraph(twoCliques());
    const ca = metrics.a2.community;
    const cb = metrics.b2.community;
    expect(ca).not.toBeNull();
    expect(cb).not.toBeNull();
    expect(ca).not.toBe(cb);
    expect(summary.communities).toBe(2);
    expect(communities.filter((c) => !c.other)).toHaveLength(2);
    expect(metrics.x.isBridge).toBe(true);
    expect(metrics.a2.isBridge).toBe(false);
    expect(metrics.lonely.community).toBeNull();
    expect(summary.isolates).toBe(1);
    expect(summary.largestComponent).toBe(9);
    expect(summary.modularity).toBeGreaterThan(0.3);
  });

  it("is deterministic for the same seed", () => {
    const data = twoCliques();
    expect(analyzeGraph(data, { seed: 7 })).toEqual(
      analyzeGraph(data, { seed: 7 }),
    );
  });

  it("copes with graphs that have no edges", () => {
    const { summary, metrics } = analyzeGraph(graph(["a", "b"], []));
    expect(summary.edges).toBe(0);
    expect(summary.modularity).toBe(0);
    expect(summary.density).toBe(0);
    expect(metrics.a.community).toBeNull();
  });

  it("orders communities largest first and buckets tiny ones", () => {
    const data = graph(
      ["a", "b", "c", "d", "p", "q"],
      [["a", "b"], ["b", "c"], ["a", "c"], ["c", "d"], ["a", "d"], ["p", "q"]],
    );
    const { communities, metrics } = analyzeGraph(data);
    expect(communities[0].size).toBeGreaterThanOrEqual(3);
    const pq = communities[metrics.p.community!];
    expect(pq.other).toBe(true);
    expect(metrics.q.community).toBe(metrics.p.community);
  });
});

describe("metricsToGrid", () => {
  it("writes one row per node with the expected columns", () => {
    const data = twoCliques();
    const grid = metricsToGrid(data, analyzeGraph(data));
    expect(grid[0]).toEqual(METRICS_CSV_HEADER);
    expect(grid).toHaveLength(data.nodes.length + 1);
    const x = grid.find((r) => r[0] === "x")!;
    expect(x[3]).toBe("2");
    expect(x[7]).toBe("yes");
    const lonely = grid.find((r) => r[0] === "lonely")!;
    expect(lonely[6]).toBe("");
  });
});

describe("sample friend graph", () => {
  it("parses into groups, bridges and isolates", () => {
    const csv = buildSampleFriendCsv();
    expect(csv).toBe(buildSampleFriendCsv());
    const { data, warnings } = parseEdgeList(parseGrid(csv));
    expect(data.nodes.length).toBe(61);
    // Every mutual pair is listed from both sides.
    expect(warnings.find((w) => w.kind === "duplicate-edges")?.count).toBe(
      data.edges.length,
    );
    const { summary } = analyzeGraph(data);
    expect(summary.isolates).toBe(4);
    expect(summary.communities).toBeGreaterThanOrEqual(4);
    expect(summary.bridges).toBeGreaterThan(0);
  });
});
