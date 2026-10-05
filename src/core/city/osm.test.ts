import { describe, expect, it } from "vitest";
import { entitiesToGrid, ENTITIES_CSV_HEADER } from "./entitiesCsv";
import { pathLengthM } from "./geo";
import {
  assembleRings,
  buildOverpassQuery,
  estimateHeight,
  estimateRoadWidth,
  parseLength,
  parseOverpass,
  type OverpassResponse,
} from "./osm";
import { indexEntities, toSelectedView } from "./selection";
import type { BBox, LngLat } from "./types";

const BBOX: BBox = [13.37, 52.5, 13.38, 52.51];
const META = {
  id: "test",
  name: "Test",
  center: [13.375, 52.505] as LngLat,
  bbox: BBOX,
  source: "live" as const,
  fetchedAt: "2026-01-01T00:00:00Z",
};

const pt = (lon: number, lat: number) => ({ lat, lon });
/** Closed square ring of side `d` degrees at (x, y). */
const square = (x: number, y: number, d: number) => [
  pt(x, y),
  pt(x + d, y),
  pt(x + d, y + d),
  pt(x, y + d),
  pt(x, y),
];

const FIXTURE: OverpassResponse = {
  osm3s: { timestamp_osm_base: "2026-10-05T04:00:00Z" },
  elements: [
    {
      type: "way",
      id: 1,
      tags: { building: "office", height: "42 m", name: "Tower", start_date: "c. 1998" },
      geometry: square(13.371, 52.501, 0.001),
    },
    {
      type: "way",
      id: 2,
      tags: { building: "yes", "building:levels": "5", "roof:levels": "1" },
      geometry: square(13.373, 52.501, 0.0005),
    },
    {
      type: "way",
      id: 3,
      tags: { building: "house", "addr:housenumber": "7", "addr:street": "Main St" },
      geometry: square(13.375, 52.501, 0.0002),
    },
    // Underground garage under the tower: skipped.
    {
      type: "way",
      id: 4,
      tags: { building: "yes", layer: "-1" },
      geometry: square(13.371, 52.501, 0.001),
    },
    // Courtyard block: outer ring split into two member ways, one reversed.
    {
      type: "relation",
      id: 10,
      tags: { type: "multipolygon", building: "apartments", "building:levels": "6" },
      members: [
        {
          type: "way",
          ref: 100,
          role: "outer",
          geometry: [pt(13.376, 52.502), pt(13.378, 52.502), pt(13.378, 52.504)],
        },
        {
          type: "way",
          ref: 101,
          role: "outer",
          geometry: [pt(13.376, 52.502), pt(13.376, 52.504), pt(13.378, 52.504)],
        },
        { type: "way", ref: 102, role: "inner", geometry: square(13.3765, 52.5025, 0.0005) },
      ],
    },
    // Two separate outers: still one entity.
    {
      type: "relation",
      id: 11,
      tags: { type: "multipolygon", building: "roof", height: "8" },
      members: [
        { type: "way", ref: 110, role: "outer", geometry: square(13.371, 52.508, 0.0003) },
        { type: "way", ref: 111, role: "outer", geometry: square(13.372, 52.508, 0.0003) },
      ],
    },
    // Road leaving and re-entering the bbox → two runs.
    {
      type: "way",
      id: 20,
      tags: { highway: "primary", name: "Potsdamer Straße", lanes: "3", oneway: "yes" },
      geometry: [pt(13.371, 52.505), pt(13.372, 52.505), null, null, pt(13.374, 52.505), pt(13.375, 52.505)],
    },
    {
      type: "way",
      id: 21,
      tags: { highway: "residential" },
      geometry: [pt(13.371, 52.506), pt(13.372, 52.506)],
    },
    // Single point after clipping: no usable geometry.
    { type: "way", id: 22, tags: { highway: "service" }, geometry: [pt(13.371, 52.507), null] },
  ],
};

describe("parseLength", () => {
  it.each([
    ["12", 12],
    ["12 m", 12],
    ["12,5", 12.5],
    ["40'", 12.2],
    ["40 ft", 12.2],
    ["12'6\"", 3.8],
  ])("%s → %d m", (raw, metres) => expect(parseLength(raw)).toBe(metres));

  it("rejects junk", () => {
    expect(parseLength("tall")).toBeNull();
    expect(parseLength(undefined)).toBeNull();
  });
});

describe("estimateHeight / estimateRoadWidth", () => {
  it("prefers height, then levels × 3.2 m, then a per-type default", () => {
    expect(estimateHeight({ building: "yes", height: "30", "building:levels": "2" })).toEqual({
      height: 30,
      source: "height",
    });
    expect(estimateHeight({ building: "yes", "building:levels": "4" })).toEqual({
      height: 12.8,
      source: "levels",
    });
    expect(estimateHeight({ building: "house" })).toEqual({ height: 7, source: "default" });
    expect(estimateHeight({ building: "yes" }).source).toBe("default");
  });

  it("uses width, then lanes × 3.3 m, then the class default", () => {
    expect(estimateRoadWidth({ highway: "primary", width: "15" })).toBe(15);
    expect(estimateRoadWidth({ highway: "primary", lanes: "2" })).toBe(6.6);
    expect(estimateRoadWidth({ highway: "service" })).toBe(3.5);
    expect(estimateRoadWidth({ highway: "primary_link" })).toBe(5);
  });
});

describe("assembleRings", () => {
  it("joins split, reversed segments and drops unclosable ones", () => {
    const a: LngLat = [0, 0];
    const b: LngLat = [1, 0];
    const c: LngLat = [1, 1];
    const d: LngLat = [0, 1];
    const rings = assembleRings([
      [a, b, c],
      [a, d, c], // reversed relative to the ring direction
      [[5, 5], [6, 6]], // dangling
    ]);
    expect(rings).toHaveLength(1);
    expect(rings[0]).toEqual([a, b, c, d, a]);
  });
});

describe("buildOverpassQuery", () => {
  it("uses Overpass (s,w,n,e) order and clips only roads", () => {
    const q = buildOverpassQuery(BBOX);
    expect(q).toContain('way["building"](52.5,13.37,52.51,13.38)');
    expect(q).toContain("out body geom;");
    expect(q).toContain("out tags geom(52.5,13.37,52.51,13.38);");
  });
});

describe("parseOverpass", () => {
  const city = parseOverpass(FIXTURE, META);
  const byId = indexEntities([city]);

  it("keeps OSM ids as type/number strings, sorted", () => {
    expect(city.buildings.map((b) => b.id)).toEqual([
      "relation/10",
      "relation/11",
      "way/1",
      "way/2",
      "way/3",
    ]);
    expect(city.roads.map((r) => r.id)).toEqual(["way/20", "way/21"]);
    expect(city.fetchedAt).toBe("2026-10-05T04:00:00Z");
  });

  it("skips underground footprints", () => {
    expect(byId.has("way/4")).toBe(false);
  });

  it("derives heights, names and curated properties", () => {
    const tower = byId.get("way/1");
    expect(tower).toMatchObject({
      kind: "building",
      name: "Tower",
      height: 42,
      heightSource: "height",
      minHeight: 0,
    });
    expect(tower?.properties).toMatchObject({ building_type: "office", year_built: 1998 });
    expect(tower?.properties.footprint_m2).toBeGreaterThan(7000);

    expect(byId.get("way/2")).toMatchObject({ height: 19.2, heightSource: "levels" });
    expect(byId.get("way/2")?.properties.building_type).toBe("unspecified");
    expect(byId.get("way/3")).toMatchObject({ name: "7 Main St", height: 7 });
  });

  it("assembles a courtyard multipolygon with its hole", () => {
    const block = byId.get("relation/10");
    if (block?.kind !== "building") throw new Error("missing");
    expect(block.polygons).toHaveLength(1);
    expect(block.polygons[0]).toHaveLength(2); // outer + hole
    expect(block.height).toBeCloseTo(19.2);
  });

  it("keeps a multi-outer relation as one entity; roofs float as slabs", () => {
    const roof = byId.get("relation/11");
    if (roof?.kind !== "building") throw new Error("missing");
    expect(roof.polygons).toHaveLength(2);
    expect(roof.minHeight).toBe(7);
  });

  it("splits clipped roads into runs and measures only what's inside", () => {
    const road = byId.get("way/20");
    if (road?.kind !== "road") throw new Error("missing");
    expect(road.paths).toHaveLength(2);
    const expected = road.paths.reduce((s, p) => s + pathLengthM(p), 0);
    expect(road.lengthM).toBe(Math.round(expected));
    expect(road.lengthM).toBeGreaterThan(100);
    expect(road.lengthM).toBeLessThan(160);
    expect(road).toMatchObject({ width: 9.9, roadClass: "primary" });
    expect(road.properties).toMatchObject({ lanes: 3, oneway: true });
    expect(byId.get("way/21")?.name).toBe("Unnamed residential");
    expect(byId.has("way/22")).toBe(false);
  });
});

describe("toSelectedView", () => {
  const city = parseOverpass(FIXTURE, META);
  const byId = indexEntities([city]);

  it("formats a building", () => {
    const v = toSelectedView(byId.get("way/1")!);
    expect(v).toMatchObject({
      kindLabel: "Building",
      id: "way/1",
      osmUrl: "https://www.openstreetmap.org/way/1",
    });
    expect(v.physical[0]).toEqual({ label: "Height", value: "42.0 m (tagged)" });
    expect(v.tags.map(([k]) => k)).toEqual(["building", "height", "name", "start_date"]);
  });

  it("formats a road", () => {
    const v = toSelectedView(byId.get("way/20")!);
    expect(v.kindLabel).toBe("Road");
    expect(v.physical.map((p) => p.label)).toEqual(["Width", "Length", "Class"]);
    expect(v.properties).toContainEqual(["oneway", "yes"]);
  });
});

describe("entitiesToGrid", () => {
  it("writes one row per entity with string ids, deduped across areas", () => {
    const city = parseOverpass(FIXTURE, META);
    const grid = entitiesToGrid([city, { ...city, id: "again" }]);
    expect(grid[0]).toEqual(ENTITIES_CSV_HEADER);
    expect(grid).toHaveLength(1 + 5 + 2);
    const tower = grid.find((r) => r[0] === "way/1")!;
    const col = (name: string) => tower[ENTITIES_CSV_HEADER.indexOf(name)];
    expect(col("kind")).toBe("building");
    expect(col("height_m")).toBe("42");
    expect(col("year_built")).toBe("1998");
    expect(Number(col("centroid_lat"))).toBeCloseTo(52.5015, 3);
    const road = grid.find((r) => r[0] === "way/20")!;
    expect(road[ENTITIES_CSV_HEADER.indexOf("road_class")]).toBe("primary");
  });
});
