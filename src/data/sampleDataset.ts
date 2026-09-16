import type { ChartSettings } from "@/core/types";

/**
 * Fictional demo data so the app renders something on first load.
 * Deterministic (seeded PRNG) so the sample never changes between builds.
 */
const SHOPS: [name: string, category: string, start: number][] = [
  ["Brewtopia", "West", 2010],
  ["Bean There", "West", 2010],
  ["Latte Da", "East", 2010],
  ["Grounds Zero", "East", 2010],
  ["Daily Grind", "North", 2010],
  ["Java Junction", "North", 2010],
  ["Mocha Motion", "South", 2011],
  ["Espresso Express", "South", 2010],
  ["Roast & Toast", "West", 2013],
  ["Steam Dream", "East", 2010],
  ["Perk Place", "North", 2015],
  ["Drip Drop", "South", 2012],
  ["Cuppa Co", "West", 2017],
  ["Froth Factory", "East", 2019],
];

const YEARS = Array.from({ length: 15 }, (_, i) => 2010 + i);

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSampleCsv(): string {
  const rand = mulberry32(20260913);
  const lines = ["Name,Category," + YEARS.join(",")];
  for (const [name, category, start] of SHOPS) {
    let value = 40 + rand() * 120;
    const growth = 0.85 + rand() * 0.45;
    const cells = YEARS.map((y) => {
      if (y < start) return "";
      value = Math.max(5, value * (growth + (rand() - 0.5) * 0.5));
      return Math.round(value * 1000).toString();
    });
    lines.push([`"${name}"`, category, ...cells].join(","));
  }
  return lines.join("\n");
}

export const SAMPLE_FILE_NAME = "sample-coffee-chains.csv";

export const SAMPLE_SETTINGS: Partial<ChartSettings> = {
  title: "Cups sold per year by coffee chain",
  subtitle: "Fictional sample data — replace it with your own CSV",
  source: "Source: generated sample",
};
