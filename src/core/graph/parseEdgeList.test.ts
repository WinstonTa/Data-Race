import { describe, expect, it } from "vitest";
import { parseGrid } from "../parser/grid";
import { isEdgeListGrid, parseEdgeList } from "./parseEdgeList";

const HEADER =
  "Friend_ID,Friend_Username,Friend_DisplayName,Mutual_ID,Mutual_Username,Mutual_DisplayName";

const parse = (lines: string[]) =>
  parseEdgeList(parseGrid([HEADER, ...lines].join("\n")));

describe("parseEdgeList", () => {
  it("collapses A–B / B–A into one undirected edge", () => {
    const { data, warnings } = parse([
      "1,ann,Ann,2,bob,Bob",
      "2,bob,Bob,1,ann,Ann",
    ]);
    expect(data.edges).toEqual([{ source: "1", target: "2" }]);
    expect(data.nodes.map((n) => n.id).sort()).toEqual(["1", "2"]);
    // Listing a pair from both sides is normal for an export: no warning.
    expect(warnings.find((w) => w.kind === "duplicate-edges")).toBeUndefined();
  });

  it("reports exact repeated rows", () => {
    const { data, warnings } = parse([
      "1,ann,Ann,2,bob,Bob",
      "1,ann,Ann,2,bob,Bob",
    ]);
    expect(data.edges).toHaveLength(1);
    expect(warnings.find((w) => w.kind === "duplicate-edges")?.count).toBe(1);
  });

  it("drops self-loops and keeps the node", () => {
    const { data, warnings } = parse(["1,ann,Ann,1,ann,Ann"]);
    expect(data.edges).toEqual([]);
    expect(data.nodes).toHaveLength(1);
    expect(warnings.find((w) => w.kind === "self-loops")?.count).toBe(1);
  });

  it("preserves friends with no mutuals as isolates", () => {
    const { data } = parse(["1,ann,Ann,2,bob,Bob", "3,cy,Cy,,,"]);
    expect(data.nodes.map((n) => n.id)).toContain("3");
    expect(data.edges).toHaveLength(1);
  });

  it("keeps snowflake ids exact (no number conversion)", () => {
    const a = "123456789012345678";
    const b = "987654321098765432";
    const { data } = parse([`${a},ann,Ann,${b},bob,Bob`]);
    expect(data.nodes.map((n) => n.id).sort()).toEqual([a, b]);
    expect(data.edges[0]).toEqual({ source: a, target: b });
  });

  it("matches headers case- and separator-insensitively", () => {
    const grid = parseGrid(
      "friend id,friend username,friend displayname,mutual id\n1,ann,Ann,2",
    );
    expect(isEdgeListGrid(grid)).toBe(true);
    const { data } = parseEdgeList(grid);
    expect(data.edges).toHaveLength(1);
    expect(data.nodes.find((n) => n.id === "2")).toEqual({
      id: "2",
      username: "",
      displayName: "",
    });
  });

  it("throws a readable error when required columns are missing", () => {
    const grid = parseGrid("Name,2000\nA,1");
    expect(isEdgeListGrid(grid)).toBe(false);
    expect(() => parseEdgeList(grid)).toThrow(/Friend_ID/);
  });

  it("fills missing metadata from later rows and counts conflicts", () => {
    const { data, warnings } = parse([
      "1,ann,Ann,2,,",
      "2,bob,Bob,1,ann,Ann",
      "1,ann2,Ann,3,cy,Cy",
    ]);
    expect(data.nodes.find((n) => n.id === "2")?.username).toBe("bob");
    expect(data.nodes.find((n) => n.id === "1")?.username).toBe("ann");
    expect(warnings.find((w) => w.kind === "name-conflict")?.count).toBe(1);
    expect(warnings.find((w) => w.kind === "mutual-not-friend")?.count).toBe(1);
  });

  it("skips rows without a Friend_ID", () => {
    const { data, warnings } = parse([",,,2,bob,Bob", "1,ann,Ann,,,"]);
    expect(data.nodes.map((n) => n.id)).toEqual(["1"]);
    expect(warnings.find((w) => w.kind === "blank-ids")?.count).toBe(1);
  });
});
