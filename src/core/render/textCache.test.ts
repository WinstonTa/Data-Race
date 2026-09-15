import { describe, expect, it, vi } from "vitest";
import { TextMeasurer } from "./textCache";

/** Fake context: every character is 10px wide. */
function fakeCtx() {
  const measureText = vi.fn(
    (text: string) => ({ width: text.length * 10 }) as TextMetrics,
  );
  return { font: "", measureText };
}

describe("TextMeasurer", () => {
  it("measures once per font+text pair", () => {
    const ctx = fakeCtx();
    const m = new TextMeasurer(ctx);
    expect(m.width("10px a", "hello")).toBe(50);
    expect(m.width("10px a", "hello")).toBe(50);
    expect(m.width("20px a", "hello")).toBe(50);
    expect(ctx.measureText).toHaveBeenCalledTimes(2);
  });

  it("sets the font before measuring", () => {
    const ctx = fakeCtx();
    const m = new TextMeasurer(ctx);
    m.width("bold 12px x", "a");
    expect(ctx.font).toBe("bold 12px x");
  });

  it("fits text with an ellipsis", () => {
    const m = new TextMeasurer(fakeCtx());
    expect(m.fit("f", "abcdef", 60)).toBe("abcdef");
    expect(m.fit("f", "abcdef", 50)).toBe("abcd…");
    expect(m.fit("f", "abcdef", 5)).toBe("");
  });

  it("clear() forces re-measurement", () => {
    const ctx = fakeCtx();
    const m = new TextMeasurer(ctx);
    m.width("f", "x");
    m.clear();
    m.width("f", "x");
    expect(ctx.measureText).toHaveBeenCalledTimes(2);
  });
});
