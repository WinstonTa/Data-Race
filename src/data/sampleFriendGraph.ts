import Papa from "papaparse";
import { EDGE_LIST_HEADERS } from "@/core/graph/parseEdgeList";
import { mulberry32 } from "@/core/random";

/**
 * Fictional Discord friend export so /graph renders something on first load.
 * Deterministic (seeded PRNG). Five friend groups with different densities,
 * a few people who bridge groups, and some friends with no mutuals.
 * Every mutual pair is listed from both sides, like a real export.
 */
const GROUPS: { names: string[]; density: number }[] = [
  {
    // school
    names: [
      "Avery", "Blake", "Casey", "Dakota", "Emerson", "Finley", "Harper",
      "Indigo", "Jules", "Kendall", "Logan", "Marlowe", "Noel", "Sam",
    ],
    density: 0.45,
  },
  {
    // gaming
    names: [
      "Pixel", "Nova", "Quill", "Raven", "Sable", "Talon", "Umber", "Vex",
      "Wren", "Xeno", "Yuki", "Zephyr", "Riley", "Onyx", "Kestrel", "Lumen",
    ],
    density: 0.35,
  },
  {
    // work
    names: [
      "Jordan", "Priya", "Marcus", "Elena", "Theo", "Aisha", "Gabe", "Ines",
      "Kofi", "Lena",
    ],
    density: 0.5,
  },
  {
    // family
    names: ["Mom", "Dad", "Nana", "Uncle Ray", "Aunt Bea", "Cousin Mia", "Cousin Leo", "Sis"],
    density: 0.75,
  },
  {
    // online art community
    names: [
      "Inkwell", "Sketchy", "Hue", "Gouache", "Charcoal", "Sienna", "Vellum",
      "Pastel", "Umbra",
    ],
    density: 0.4,
  },
];

const ISOLATES = ["Trader Tom", "Old Roommate", "Bot Tester", "Con Buddy"];

/** Hand-placed cross-group ties: [person, group index, how many ties]. */
const BRIDGES: [string, number, number][] = [
  ["Sam", 1, 5], // school friend who games
  ["Jordan", 0, 4], // coworker from school
  ["Riley", 4, 4], // gamer who draws
  ["Sis", 0, 3], // sibling knows school friends
];

function makeId(rand: () => number): string {
  let s = String(1 + Math.floor(rand() * 9));
  while (s.length < 18) s += Math.floor(rand() * 10);
  return s;
}

const handle = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "_") + "_";

export function buildSampleFriendCsv(): string {
  const rand = mulberry32(20261003);
  const people = new Map<string, { id: string; group: number }>();
  const used = new Set<string>();
  const add = (name: string, group: number) => {
    let id = makeId(rand);
    while (used.has(id)) id = makeId(rand);
    used.add(id);
    people.set(name, { id, group });
  };
  GROUPS.forEach((g, gi) => g.names.forEach((n) => add(n, gi)));
  ISOLATES.forEach((n) => add(n, -1));

  const adj = new Map<string, Set<string>>();
  for (const n of people.keys()) adj.set(n, new Set());
  const link = (a: string, b: string) => {
    if (a === b) return;
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };

  for (const g of GROUPS) {
    for (let i = 0; i < g.names.length; i++)
      for (let j = i + 1; j < g.names.length; j++)
        if (rand() < g.density) link(g.names[i], g.names[j]);
    // Keep each group connected: chain everyone to the next member.
    for (let i = 1; i < g.names.length; i++)
      if (adj.get(g.names[i])!.size === 0) link(g.names[i], g.names[i - 1]);
  }
  for (const [person, group, count] of BRIDGES) {
    const pool = GROUPS[group].names.filter((n) => n !== person);
    for (let k = 0; k < count; k++)
      link(person, pool[Math.floor(rand() * pool.length)]);
  }

  const rows: string[][] = [[...EDGE_LIST_HEADERS]];
  for (const [name, { id }] of people) {
    const mutuals = [...adj.get(name)!];
    if (mutuals.length === 0) {
      rows.push([id, handle(name), name, "", "", ""]);
      continue;
    }
    for (const m of mutuals)
      rows.push([id, handle(name), name, people.get(m)!.id, handle(m), m]);
  }
  return Papa.unparse(rows, { newline: "\n" });
}

export const SAMPLE_GRAPH_FILE_NAME = "sample-discord-friends.csv";
