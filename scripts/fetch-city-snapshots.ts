/**
 * Regenerate the bundled city snapshots in public/cities/ from OpenStreetMap.
 *
 *   pnpm city:snapshots            # every preset
 *   pnpm city:snapshots boston     # just one (ids from src/data/cityPresets.ts)
 *
 * Data © OpenStreetMap contributors, ODbL. Queries run one at a time with a
 * pause between them to stay polite to the public Overpass instance.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { bboxAround } from "../src/core/city/geo";
import {
  buildOverpassQuery,
  parseOverpass,
  type OverpassResponse,
} from "../src/core/city/osm";
import { CITY_PRESETS } from "../src/data/cityPresets";

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const OUT_DIR = join(process.cwd(), "public", "cities");
const PAUSE_MS = 5_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const only = new Set(process.argv.slice(2));
  const presets = CITY_PRESETS.filter((p) => !only.size || only.has(p.id));
  await mkdir(OUT_DIR, { recursive: true });

  for (const [i, preset] of presets.entries()) {
    if (i > 0) await sleep(PAUSE_MS);
    const bbox = bboxAround(preset.center, preset.halfSizeM);
    process.stdout.write(`${preset.name}… `);
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "DataRace-CityPoC/0.1 (snapshot script)",
      },
      body: new URLSearchParams({ data: buildOverpassQuery(bbox, 120) }),
    });
    if (!res.ok) throw new Error(`${preset.id}: HTTP ${res.status}`);
    const json = (await res.json()) as OverpassResponse;
    const city = parseOverpass(json, {
      id: preset.id,
      name: `${preset.name} · ${preset.area}`,
      center: preset.center,
      bbox,
      source: "snapshot",
      fetchedAt: new Date().toISOString(),
    });
    const text = JSON.stringify(city);
    await writeFile(join(OUT_DIR, `${preset.id}.json`), text);
    console.log(
      `${city.buildings.length} buildings, ${city.roads.length} roads, ${(text.length / 1024).toFixed(0)} KB`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
