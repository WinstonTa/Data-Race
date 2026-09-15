import { describe, expect, it } from "vitest";
import { isBlank, parseNumber } from "./parseNumber";

describe("parseNumber", () => {
  it.each([
    ["42", 42],
    [" 3.5 ", 3.5],
    ["1,234,567", 1234567],
    ["$1,200.50", 1200.5],
    ["€99", 99],
    ["45%", 45],
    ["(300)", -300],
    ["-12", -12],
    ["−12", -12],
    ["1.2e6", 1_200_000],
    [".5", 0.5],
    ["0", 0],
  ])("parses %j → %d", (raw, expected) => {
    expect(parseNumber(raw)).toBe(expected);
  });

  it.each(["", "  ", "-", "n/a", "NA", "null", "NaN", undefined, null])(
    "treats %j as blank",
    (raw) => {
      expect(isBlank(raw)).toBe(true);
      expect(parseNumber(raw)).toBeNull();
    },
  );

  it.each(["abc", "12abc", "1.2.3", "1,2,3.4.5", "Infinity", "--5"])(
    "rejects %j as non-numeric (not blank)",
    (raw) => {
      expect(isBlank(raw)).toBe(false);
      expect(parseNumber(raw)).toBeNull();
    },
  );
});
