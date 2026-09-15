import { describe, expect, it } from "vitest";
import { parseWideCsv } from "./parseWideCsv";

const ids = () => {
  let n = 0;
  return () => `e${n++}`;
};

describe("parseWideCsv", () => {
  it("parses a clean wide CSV", () => {
    const ds = parseWideCsv(
      ["Name,2000,2001,2002", "A,1,2,3", "B,4,5,6"].join("\n"),
      { idFactory: ids() },
    );
    expect(ds.periods).toEqual(["2000", "2001", "2002"]);
    expect(ds.entities).toHaveLength(2);
    expect(ds.entities[0]).toMatchObject({
      id: "e0",
      name: "A",
      values: [1, 2, 3],
      included: true,
    });
    expect(ds.entities[1].values).toEqual([4, 5, 6]);
    expect(ds.warnings).toEqual([]);
  });

  it("handles a BOM, CRLF line endings and quoted names with commas", () => {
    const ds = parseWideCsv(
      '﻿Name,2000,2001\r\n"Smith, John",1,2\r\nB,3,4\r\n',
      { idFactory: ids() },
    );
    expect(ds.entities.map((e) => e.name)).toEqual(["Smith, John", "B"]);
    expect(ds.entities[0].values).toEqual([1, 2]);
  });

  it("assigns shared colors per category and unique colors otherwise", () => {
    const ds = parseWideCsv(
      ["Name,Category,2000", "A,X,1", "B,X,2", "C,Y,3", "D,,4"].join("\n"),
      { idFactory: ids() },
    );
    const [a, b, c, d] = ds.entities;
    expect(a.category).toBe("X");
    expect(a.color).toBe(b.color);
    expect(c.color).not.toBe(a.color);
    expect(d.category).toBeUndefined();
    expect(new Set([a.color, c.color, d.color]).size).toBe(3);
  });

  it("flags non-numeric cells and treats them as missing", () => {
    const ds = parseWideCsv(["Name,2000,2001", "A,abc,2"].join("\n"), {
      idFactory: ids(),
    });
    expect(ds.entities[0].values).toEqual([null, 2]);
    expect(ds.warnings).toEqual([
      expect.objectContaining({
        kind: "non-numeric",
        entityId: "e0",
        period: "2000",
      }),
    ]);
  });

  it("excludes all-empty rows with a warning", () => {
    const ds = parseWideCsv(["Name,2000,2001", "A,,", "B,1,2"].join("\n"), {
      idFactory: ids(),
    });
    expect(ds.entities[0].included).toBe(false);
    expect(ds.entities[1].included).toBe(true);
    expect(ds.warnings).toEqual([
      expect.objectContaining({ kind: "empty-row", entityId: "e0" }),
    ]);
  });

  it("warns once per duplicate name", () => {
    const ds = parseWideCsv(["Name,2000", "A,1", "a,2", "B,3"].join("\n"), {
      idFactory: ids(),
    });
    const dups = ds.warnings.filter((w) => w.kind === "duplicate-name");
    expect(dups).toHaveLength(1);
    expect(ds.entities).toHaveLength(3);
  });

  it("warns when there are no period columns", () => {
    const ds = parseWideCsv("Name\nA\n", { idFactory: ids() });
    expect(ds.periods).toEqual([]);
    expect(ds.warnings.map((w) => w.kind)).toContain("no-period-columns");
  });

  it("warns when an image column is present and ignores it", () => {
    const ds = parseWideCsv(
      ["Name,Image,2000", "A,https://x/y.png,1"].join("\n"),
      { idFactory: ids() },
    );
    expect(ds.periods).toEqual(["2000"]);
    expect(ds.entities[0].values).toEqual([1]);
    expect(ds.warnings.map((w) => w.kind)).toContain("image-column-ignored");
  });

  it("skips rows with a blank name and fully blank lines", () => {
    const ds = parseWideCsv(
      ["Name,2000", "", ",5", "A,1", "  ", ""].join("\n"),
      { idFactory: ids() },
    );
    expect(ds.entities.map((e) => e.name)).toEqual(["A"]);
  });
});
