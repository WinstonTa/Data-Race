/** [longitude, latitude] in degrees — deck.gl / GeoJSON order. */
export type LngLat = [lng: number, lat: number];
/** A closed or open ring of positions. */
export type Ring = LngLat[];
/** One polygon: outer ring first, then holes. */
export type Polygon = Ring[];
/** [west, south, east, north] in degrees. */
export type BBox = [west: number, south: number, east: number, north: number];

/** Values in an entity's join-ready property bag. */
export type PropertyValue = string | number | boolean;
export type EntityProperties = Record<string, PropertyValue>;

/** Where a building's height came from (best → worst). */
export type HeightSource = "height" | "levels" | "default";

/**
 * A building footprint extruded to `height` metres. The id is the OSM element
 * (`way/123`, `relation/456`): a STRING, stable across fetches and the key
 * downstream datasets join on. A multipolygon with several outer rings stays
 * one entity with several polygons.
 */
export interface BuildingEntity {
  kind: "building";
  id: string;
  name: string;
  polygons: Polygon[];
  /** Top of the building above ground, metres. */
  height: number;
  /** Bottom of the extrusion (OSM `min_height`), metres; 0 for most. */
  minHeight: number;
  heightSource: HeightSource;
  /** Curated, typed fields (year_built, levels, address…). */
  properties: EntityProperties;
  /** Raw OSM tags (noise such as `source:*` stripped). */
  tags: Record<string, string>;
}

/**
 * A road way. `paths` has several runs when the way leaves and re-enters the
 * fetched area (Overpass clips geometry to the bbox).
 */
export interface RoadEntity {
  kind: "road";
  id: string;
  name: string;
  paths: LngLat[][];
  /** Carriageway width, metres. */
  width: number;
  /** Length of the (clipped) geometry, metres. */
  lengthM: number;
  /** OSM `highway` value, e.g. "primary". */
  roadClass: string;
  properties: EntityProperties;
  tags: Record<string, string>;
}

export type CityEntity = BuildingEntity | RoadEntity;
export type EntityKind = CityEntity["kind"];

/** One loaded area: a bundled preset snapshot or a live Overpass fetch. */
export interface CityData {
  id: string;
  name: string;
  center: LngLat;
  bbox: BBox;
  source: "snapshot" | "live";
  /** ISO timestamp of the underlying OSM data / fetch. */
  fetchedAt: string;
  buildings: BuildingEntity[];
  roads: RoadEntity[];
}

/** Normalized view model for the inspection panel. */
export interface SelectedEntityView {
  kind: EntityKind;
  kindLabel: "Building" | "Road";
  id: string;
  name: string;
  osmUrl: string | null;
  /** Physical attributes, already formatted ("42.0 m"). */
  physical: { label: string; value: string }[];
  /** Curated properties as [key, display value]. */
  properties: [string, string][];
  /** Raw OSM tags, sorted by key. */
  tags: [string, string][];
}
