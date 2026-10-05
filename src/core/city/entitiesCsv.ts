import type { Grid } from "../types";
import { ringCentroid } from "./geo";
import type { CityData, LngLat } from "./types";

export const ENTITIES_CSV_HEADER = [
  "id",
  "kind",
  "name",
  "height_m",
  "min_height_m",
  "height_source",
  "width_m",
  "length_m",
  "road_class",
  "centroid_lat",
  "centroid_lng",
  "building_type",
  "levels",
  "year_built",
  "footprint_m2",
  "address",
  "area",
];

const str = (v: string | number | boolean | undefined) =>
  v === undefined ? "" : String(v);

/** Midpoint vertex of the longest run — a stable anchor for a road. */
function roadAnchor(paths: LngLat[][]): LngLat {
  const longest = paths.reduce(
    (a, b) => (b.length > a.length ? b : a),
    paths[0],
  );
  return longest[Math.floor(longest.length / 2)];
}

/**
 * One row per building and road across the given areas. `id` (`way/123`) is
 * the join key for downstream datasets; it stays a string. Entities shared by
 * overlapping areas are written once.
 */
export function entitiesToGrid(cities: readonly CityData[]): Grid {
  const rows: Grid = [ENTITIES_CSV_HEADER];
  const seen = new Set<string>();
  for (const city of cities) {
    for (const b of city.buildings) {
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      const [lng, lat] = ringCentroid(b.polygons[0][0]);
      const p = b.properties;
      rows.push([
        b.id,
        "building",
        b.name,
        String(b.height),
        String(b.minHeight),
        b.heightSource,
        "",
        "",
        "",
        String(lat),
        String(lng),
        str(p.building_type),
        str(p.levels),
        str(p.year_built),
        str(p.footprint_m2),
        str(p.address),
        city.name,
      ]);
    }
    for (const r of city.roads) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      const [lng, lat] = roadAnchor(r.paths);
      rows.push([
        r.id,
        "road",
        r.name,
        "",
        "",
        "",
        String(r.width),
        String(r.lengthM),
        r.roadClass,
        String(lat),
        String(lng),
        "",
        "",
        "",
        "",
        "",
        city.name,
      ]);
    }
  }
  return rows;
}
