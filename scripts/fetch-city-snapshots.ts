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

/** POST a query, backing off on rate limits / gateway timeouts. */
async function query(ql: string, label: string): Promise<OverpassResponse> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "DataRace-CityPoC/0.1 (snapshot script)",
      },
      body: new URLSearchParams({ data: ql }),
    });
    if (res.ok) return (await res.json()) as OverpassResponse;
    const retryable = [429, 502, 503, 504].includes(res.status);
    if (!retryable || attempt >= 5)
      throw new Error(`${label}: HTTP ${res.status}`);
    const wait = 20_000 * attempt;
    process.stdout.write(`HTTP ${res.status}, retrying in ${wait / 1000}s… `);
    await sleep(wait);
  }
}

async function main() {
  const only = new Set(process.argv.slice(2));
  const presets = CITY_PRESETS.filter((p) => !only.size || only.has(p.id));
  await mkdir(OUT_DIR, { recursive: true });

  for (const [i, preset] of presets.entries()) {
    if (i > 0) await sleep(PAUSE_MS);
    const bbox = bboxAround(preset.center, preset.halfSizeM);
    process.stdout.write(`${preset.name}… `);
    const json = await query(buildOverpassQuery(bbox, 120), preset.id);
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
