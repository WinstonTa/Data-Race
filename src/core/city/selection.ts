import type { CityData, CityEntity, SelectedEntityView } from "./types";

const HEIGHT_SOURCE_LABEL = {
  height: "tagged",
  levels: "from levels",
  default: "estimated",
} as const;

const m = (n: number) => `${n.toFixed(1)} m`;

function display(v: string | number | boolean): string {
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") return v.toLocaleString("en-US");
  return v;
}

/** `way/123` → https://www.openstreetmap.org/way/123 */
export function osmUrl(id: string): string | null {
  return /^(node|way|relation)\/\d+$/.test(id)
    ? `https://www.openstreetmap.org/${id}`
    : null;
}

/** Entity → what the inspection panel shows. */
export function toSelectedView(entity: CityEntity): SelectedEntityView {
  const physical =
    entity.kind === "building"
      ? [
          {
            label: "Height",
            value: `${m(entity.height)} (${HEIGHT_SOURCE_LABEL[entity.heightSource]})`,
          },
          ...(entity.minHeight > 0
            ? [{ label: "Base height", value: m(entity.minHeight) }]
            : []),
        ]
      : [
          { label: "Width", value: m(entity.width) },
          {
            label: "Length",
            value: `${entity.lengthM.toLocaleString("en-US")} m`,
          },
          { label: "Class", value: entity.roadClass.replace(/_/g, " ") },
        ];
  return {
    kind: entity.kind,
    kindLabel: entity.kind === "building" ? "Building" : "Road",
    id: entity.id,
    name: entity.name,
    osmUrl: osmUrl(entity.id),
    physical,
    properties: Object.entries(entity.properties).map(([k, v]) => [
      k,
      display(v),
    ]),
    tags: Object.entries(entity.tags).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    ),
  };
}

/** id → entity across every loaded area (later areas win on duplicates). */
export function indexEntities(
  cities: readonly CityData[],
): Map<string, CityEntity> {
  const index = new Map<string, CityEntity>();
  for (const c of cities) {
    for (const b of c.buildings) index.set(b.id, b);
    for (const r of c.roads) index.set(r.id, r);
  }
  return index;
}
