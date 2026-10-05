import {
  pathLengthM,
  pointInRing,
  ringAreaM2,
  roundCoord,
} from "./geo";
import type {
  BBox,
  BuildingEntity,
  CityData,
  EntityProperties,
  HeightSource,
  LngLat,
  Polygon,
  RoadEntity,
  Ring,
} from "./types";

/* ---------------------------------------------------------------- query -- */

/** `highway=*` values rendered as roads (drivable + pedestrian streets). */
export const ROAD_CLASSES = [
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "motorway_link",
  "trunk_link",
  "primary_link",
  "secondary_link",
  "tertiary_link",
  "residential",
  "unclassified",
  "living_street",
  "pedestrian",
  "service",
] as const;

/** Overpass bbox order is (south, west, north, east). */
function overpassBbox([w, s, e, n]: BBox): string {
  return `${s},${w},${n},${e}`;
}

/**
 * Overpass QL for every building and road in `bbox`. Buildings come back
 * whole (a footprint cut at the edge would be wrong); roads are clipped to
 * the box with `geom(bbox)`, which leaves `null` gaps in their geometry.
 */
export function buildOverpassQuery(bbox: BBox, timeoutS = 60): string {
  const b = overpassBbox(bbox);
  return [
    `[out:json][timeout:${timeoutS}];`,
    `(way["building"](${b});relation["building"]["type"="multipolygon"](${b}););`,
    `out body geom;`,
    `way["highway"~"^(${ROAD_CLASSES.join("|")})$"](${b});`,
    `out tags geom(${b});`,
  ].join("\n");
}

/* ------------------------------------------------------- overpass types -- */

type OsmPoint = { lat: number; lon: number } | null;

interface OsmWay {
  type: "way";
  id: number;
  tags?: Record<string, string>;
  geometry?: OsmPoint[];
}

interface OsmRelation {
  type: "relation";
  id: number;
  tags?: Record<string, string>;
  members?: { type: string; ref: number; role: string; geometry?: OsmPoint[] }[];
}

export interface OverpassResponse {
  osm3s?: { timestamp_osm_base?: string };
  elements: ({ type: string; id: number } & Partial<OsmWay & OsmRelation>)[];
}

/* ------------------------------------------------------------- numbers -- */

/**
 * OSM length → metres. Handles "12", "12 m", "12,5", "40'", "40 ft",
 * "12'6\"". Returns null for anything else.
 */
export function parseLength(raw: string | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase().replace(",", ".");
  const feet = /^(\d+(?:\.\d+)?)\s*(?:'|ft|feet)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in))?$/.exec(s);
  if (feet) return round1(Number(feet[1]) * 0.3048 + Number(feet[2] ?? 0) * 0.0254);
  const metres = /^(\d+(?:\.\d+)?)\s*(?:m|meters?|metres?)?$/.exec(s);
  if (metres) return round1(Number(metres[1]));
  return null;
}

/** First number in a tag value ("4", "3;4" → 3, "4.5"). */
function parseNumberTag(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = /\d+(?:[.,]\d+)?/.exec(raw);
  return m ? Number(m[0].replace(",", ".")) : null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/* -------------------------------------------------------------- height -- */

export const METRES_PER_LEVEL = 3.2;
const MIN_HEIGHT_M = 2;

/** Typical heights for footprints with no height/levels tags. */
const DEFAULT_HEIGHT_BY_TYPE: Record<string, number> = {
  house: 7,
  detached: 7,
  semidetached_house: 7,
  terrace: 9,
  bungalow: 4,
  garage: 3,
  garages: 3,
  carport: 3,
  shed: 3,
  hut: 3,
  kiosk: 3,
  roof: 5,
  retail: 6,
  supermarket: 7,
  industrial: 8,
  warehouse: 8,
  commercial: 12,
  office: 15,
  apartments: 15,
  hotel: 18,
  church: 20,
  cathedral: 35,
};
const DEFAULT_HEIGHT_M = 9;

/** Building height in metres and how confident we are about it. */
export function estimateHeight(tags: Record<string, string>): {
  height: number;
  source: HeightSource;
} {
  const h = parseLength(tags.height ?? tags["building:height"]);
  if (h !== null && h > 0) return { height: Math.max(h, MIN_HEIGHT_M), source: "height" };
  const levels = parseNumberTag(tags["building:levels"]);
  if (levels !== null && levels > 0) {
    const roof = parseNumberTag(tags["roof:levels"]) ?? 0;
    return {
      height: round1(Math.max((levels + roof) * METRES_PER_LEVEL, MIN_HEIGHT_M)),
      source: "levels",
    };
  }
  return {
    height: DEFAULT_HEIGHT_BY_TYPE[tags.building ?? ""] ?? DEFAULT_HEIGHT_M,
    source: "default",
  };
}

/** Base of the extrusion. Untagged `building=roof` becomes a 1 m canopy slab. */
function estimateMinHeight(tags: Record<string, string>, height: number): number {
  const explicit =
    parseLength(tags.min_height) ??
    (parseNumberTag(tags["building:min_level"]) ?? 0) * METRES_PER_LEVEL;
  if (explicit > 0) return Math.min(explicit, height - 0.5);
  if (tags.building === "roof") return Math.max(height - 1, 0);
  return 0;
}

/* --------------------------------------------------------------- roads -- */

const LANE_WIDTH_M = 3.3;
const DEFAULT_WIDTH_BY_CLASS: Record<string, number> = {
  motorway: 14,
  trunk: 12,
  primary: 11,
  secondary: 9,
  tertiary: 8,
  residential: 6,
  unclassified: 6,
  living_street: 5,
  pedestrian: 5,
  service: 3.5,
};

/** Carriageway width: `width` tag → lanes × 3.3 m → class default. */
export function estimateRoadWidth(tags: Record<string, string>): number {
  const w = parseLength(tags.width);
  if (w !== null && w > 0) return w;
  const lanes = parseNumberTag(tags.lanes);
  if (lanes !== null && lanes > 0) return round1(lanes * LANE_WIDTH_M);
  const cls = tags.highway ?? "";
  if (cls.endsWith("_link")) return 5;
  return DEFAULT_WIDTH_BY_CLASS[cls] ?? 6;
}

/* --------------------------------------------------------------- names -- */

function address(tags: Record<string, string>): string | null {
  const num = tags["addr:housenumber"];
  const street = tags["addr:street"] ?? tags["addr:place"];
  if (num && street) return `${num} ${street}`;
  return street ?? null;
}

const pretty = (s: string) => s.replace(/_/g, " ");

/** Display name: name → address/ref → "Unnamed …". */
export function entityName(
  kind: "building" | "road",
  tags: Record<string, string>,
): string {
  if (tags.name) return tags.name;
  if (kind === "building") return address(tags) ?? "Unnamed building";
  if (tags.ref) return tags.ref;
  return `Unnamed ${pretty(tags.highway ?? "road")}`;
}

/* ---------------------------------------------------------------- tags -- */

/** Tag keys that are editor bookkeeping, not attributes. */
const NOISE_TAG = /^(source|note|fixme|check_date|created_by|survey)(:|$)/i;
/** Localised names balloon snapshots (Moscow, Paris landmarks); keep English. */
const LOCALISED_NAME = /^(name|alt_name|old_name|official_name|short_name):(?!en$)/;

export function cleanTags(tags: Record<string, string> | undefined) {
  const out: Record<string, string> = {};
  if (!tags) return out;
  for (const [k, v] of Object.entries(tags)) {
    if (NOISE_TAG.test(k) || LOCALISED_NAME.test(k)) continue;
    out[k] = v;
  }
  return out;
}

function yearBuilt(tags: Record<string, string>): number | null {
  const raw =
    tags.start_date ?? tags["building:start_date"] ?? tags.construction_date;
  const m = raw ? /\b(1[0-9]{3}|20[0-9]{2})\b/.exec(raw) : null;
  return m ? Number(m[1]) : null;
}

/** Drop empty/null entries so the property bag only holds real values. */
function compact(
  entries: [string, string | number | boolean | null | undefined][],
): EntityProperties {
  const out: EntityProperties = {};
  for (const [k, v] of entries) if (v !== null && v !== undefined && v !== "") out[k] = v;
  return out;
}

const yes = (v: string | undefined) => v === "yes" || v === "true" || v === "1";

/* ------------------------------------------------------------ geometry -- */

function toLngLat(p: { lat: number; lon: number }): LngLat {
  return [roundCoord(p.lon), roundCoord(p.lat)];
}

/** Split clipped geometry at `null` gaps into runs of ≥ 2 points. */
export function splitRuns(geometry: OsmPoint[] | undefined): LngLat[][] {
  const runs: LngLat[][] = [];
  let run: LngLat[] = [];
  for (const p of geometry ?? []) {
    if (p) run.push(toLngLat(p));
    else {
      if (run.length >= 2) runs.push(run);
      run = [];
    }
  }
  if (run.length >= 2) runs.push(run);
  return runs;
}

const samePoint = (a: LngLat, b: LngLat) => a[0] === b[0] && a[1] === b[1];
const isClosed = (r: LngLat[]) => r.length >= 4 && samePoint(r[0], r[r.length - 1]);

/**
 * Join multipolygon member ways into closed rings by matching endpoints
 * (members may be split anywhere along a ring and in either direction).
 * Unclosable leftovers are dropped.
 */
export function assembleRings(segments: LngLat[][]): Ring[] {
  const rings: Ring[] = [];
  const open = segments.filter((s) => s.length >= 2).map((s) => s.slice());
  while (open.length) {
    let ring = open.shift()!;
    let grew = true;
    while (!isClosed(ring) && grew) {
      grew = false;
      const end = ring[ring.length - 1];
      for (let i = 0; i < open.length; i++) {
        const seg = open[i];
        if (samePoint(seg[0], end)) ring = ring.concat(seg.slice(1));
        else if (samePoint(seg[seg.length - 1], end))
          ring = ring.concat(seg.slice(0, -1).reverse());
        else continue;
        open.splice(i, 1);
        grew = true;
        break;
      }
    }
    if (isClosed(ring)) rings.push(ring);
  }
  return rings;
}

/** Outer rings each become a polygon; inner rings go to the outer containing them. */
function relationPolygons(rel: OsmRelation): Polygon[] {
  const outers: LngLat[][] = [];
  const inners: LngLat[][] = [];
  for (const m of rel.members ?? []) {
    if (m.type !== "way") continue;
    const runs = splitRuns(m.geometry);
    if (m.role === "inner") inners.push(...runs);
    else outers.push(...runs); // "outer" or legacy empty role
  }
  const polygons: Polygon[] = assembleRings(outers).map((r) => [r]);
  for (const hole of assembleRings(inners)) {
    const owner = polygons.find((p) => pointInRing(hole[0], p[0]));
    if (owner) owner.push(hole);
  }
  return polygons;
}

/* --------------------------------------------------------------- build -- */

function buildBuilding(
  id: string,
  rawTags: Record<string, string>,
  polygons: Polygon[],
): BuildingEntity {
  const tags = cleanTags(rawTags);
  const { height, source } = estimateHeight(rawTags);
  const minHeight = estimateMinHeight(rawTags, height);
  const footprint = polygons.reduce(
    (sum, p) =>
      sum + ringAreaM2(p[0]) - p.slice(1).reduce((h, r) => h + ringAreaM2(r), 0),
    0,
  );
  return {
    kind: "building",
    id,
    name: entityName("building", rawTags),
    polygons,
    height,
    minHeight: round1(minHeight),
    heightSource: source,
    properties: compact([
      ["building_type", rawTags.building === "yes" ? "unspecified" : rawTags.building],
      ["levels", parseNumberTag(rawTags["building:levels"])],
      ["year_built", yearBuilt(rawTags)],
      ["address", address(rawTags)],
      ["footprint_m2", Math.round(footprint)],
      ["use", rawTags.amenity ?? rawTags.shop ?? rawTags.office ?? rawTags.tourism],
      ["architect", rawTags.architect],
      ["operator", rawTags.operator],
      ["wikidata", rawTags.wikidata],
    ]),
    tags,
  };
}

function buildRoad(way: OsmWay, paths: LngLat[][]): RoadEntity {
  const raw = way.tags ?? {};
  const lengthM = Math.round(paths.reduce((s, p) => s + pathLengthM(p), 0));
  return {
    kind: "road",
    id: `way/${way.id}`,
    name: entityName("road", raw),
    paths,
    width: estimateRoadWidth(raw),
    lengthM,
    roadClass: raw.highway ?? "road",
    properties: compact([
      ["road_class", raw.highway],
      ["ref", raw.ref],
      ["lanes", parseNumberTag(raw.lanes)],
      ["oneway", raw.oneway ? yes(raw.oneway) : null],
      ["maxspeed", raw.maxspeed],
      ["surface", raw.surface],
      ["bridge", raw.bridge ? raw.bridge !== "no" : null],
      ["tunnel", raw.tunnel ? raw.tunnel !== "no" : null],
    ]),
    tags: cleanTags(raw),
  };
}

/**
 * Below-ground footprints (garages, station halls) would render as a second
 * solid prism over the real building, so they're skipped.
 */
function isUnderground(tags: Record<string, string>): boolean {
  return (
    tags.location === "underground" ||
    tags.building === "underground" ||
    Number.parseFloat(tags.layer ?? "") < 0
  );
}

export interface CityMeta {
  id: string;
  name: string;
  center: LngLat;
  bbox: BBox;
  source: CityData["source"];
  /** Fallback when the response carries no OSM timestamp. */
  fetchedAt: string;
}

/**
 * Overpass JSON → typed entities. Ids are `way/<n>` / `relation/<n>` strings.
 * Duplicate elements (same id twice in a response) are kept once; output is
 * sorted by id so snapshots diff cleanly.
 */
export function parseOverpass(json: OverpassResponse, meta: CityMeta): CityData {
  const buildings = new Map<string, BuildingEntity>();
  const roads = new Map<string, RoadEntity>();

  for (const el of json.elements) {
    const tags = el.tags ?? {};
    const id = `${el.type}/${el.id}`;
    const isBuilding = !!tags.building && tags.building !== "no";
    if (isBuilding && isUnderground(tags)) continue;
    if (el.type === "way" && isBuilding) {
      const ring = splitRuns(el.geometry)[0];
      if (ring && ring.length >= 3) buildings.set(id, buildBuilding(id, tags, [[ring]]));
    } else if (el.type === "relation" && isBuilding) {
      const polygons = relationPolygons(el as OsmRelation);
      if (polygons.length) buildings.set(id, buildBuilding(id, tags, polygons));
    } else if (el.type === "way" && tags.highway) {
      const paths = splitRuns(el.geometry);
      if (paths.length) roads.set(id, buildRoad(el as OsmWay, paths));
    }
  }

  const byId = (a: { id: string }, b: { id: string }) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  return {
    ...meta,
    fetchedAt: json.osm3s?.timestamp_osm_base ?? meta.fetchedAt,
    buildings: [...buildings.values()].sort(byId),
    roads: [...roads.values()].sort(byId),
  };
}
