import { describe, expect, it } from "vitest";
import { detectColumns } from "./detectColumns";

describe("detectColumns", () => {
  it("treats every non-first column as a period by default", () => {
    const m = detectColumns(["Name", "2000", "2001", "2002"]);
    expect(m.nameIndex).toBe(0);
    expect(m.periodIndices).toEqual([1, 2, 3]);
    expect(m.periods).toEqual(["2000", "2001", "2002"]);
    expect(m.categoryIndex).toBeUndefined();
    expect(m.imageIndex).toBeUndefined();
  });

  it("finds category and image columns case-insensitively, anywhere", () => {
    const m = detectColumns(["Country", "2000", "Category", "2001", "FLAG"]);
    expect(m.categoryIndex).toBe(2);
    expect(m.imageIndex).toBe(4);
    expect(m.periods).toEqual(["2000", "2001"]);
  });

  it("skips blank trailing headers", () => {
    const m = detectColumns(["Name", "Q1", "Q2", "", ""]);
    expect(m.periods).toEqual(["Q1", "Q2"]);
  });

  it("only claims the first matching category column", () => {
    const m = detectColumns(["Name", "Group", "Category"]);
    expect(m.categoryIndex).toBe(1);
    expect(m.periods).toEqual(["Category"]);
  });
});
