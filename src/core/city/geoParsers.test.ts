import { describe, expect, it } from "vitest";
import { parseLocationInput } from "./geoParsers";

function ok(input: string) {
  const r = parseLocationInput(input);
  if (!r.ok) throw new Error(`expected ok for ${input}: ${r.reason}`);
  return r;
}

describe("parseLocationInput", () => {
  it("reads the @lat,lng,zoom viewport of a map URL", () => {
    expect(
      ok("https://www.google.com/maps/@37.7749,-122.4194,16z"),
    ).toEqual({ ok: true, latitude: 37.7749, longitude: -122.4194, zoom: 16 });
  });

  it("converts a 3D-view altitude (500m) into a zoom", () => {
    const r = ok("https://www.google.com/maps/@52.5096,13.376,500m/data=!3m1!1e3");
    expect(r.latitude).toBe(52.5096);
    expect(r.zoom).toBeGreaterThan(15);
    expect(r.zoom).toBeLessThan(18);
  });

  it("prefers a place's !3d/!4d pin over the viewport centre", () => {
    const r = ok(
      "https://www.google.com/maps/place/Eiffel+Tower/@48.8583701,2.2919064,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d48.8583701!4d2.2944813",
    );
    expect(r).toMatchObject({ latitude: 48.8583701, longitude: 2.2944813, zoom: 17 });
  });

  it("reads ?q= / ll= / query= parameters", () => {
    expect(ok("https://maps.google.com/?q=42.3555,-71.0565")).toMatchObject({
      latitude: 42.3555,
      longitude: -71.0565,
    });
    expect(ok("https://maps.google.com/maps?ll=34.05,-118.25&z=15")).toMatchObject({
      latitude: 34.05,
      longitude: -118.25,
    });
    expect(
      ok("https://www.google.com/maps/search/?api=1&query=55.7494%2C37.5395"),
    ).toMatchObject({ latitude: 55.7494, longitude: 37.5395 });
  });

  it("reads coordinates in the path", () => {
    expect(
      ok("https://www.google.com/maps/search/33.7683,+-118.1923"),
    ).toMatchObject({ latitude: 33.7683, longitude: -118.1923 });
  });

  it("accepts plain pairs, with or without a comma, and N/S/E/W", () => {
    expect(ok("48.8584, 2.2945")).toMatchObject({ latitude: 48.8584, longitude: 2.2945 });
    expect(ok("  -33.86 151.21 ")).toMatchObject({ latitude: -33.86, longitude: 151.21 });
    expect(ok("37.7749° N, 122.4194° W")).toMatchObject({
      latitude: 37.7749,
      longitude: -122.4194,
    });
  });

  it("explains why short links can't be used", () => {
    const r = parseLocationInput("https://maps.app.goo.gl/AbCdEf123");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/short links/i);
  });

  it("rejects out-of-range coordinates", () => {
    const r = parseLocationInput("95, 10");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/latitude/i);
    expect(parseLocationInput("10, 200").ok).toBe(false);
  });

  it("rejects text and links with no coordinates", () => {
    expect(parseLocationInput("").ok).toBe(false);
    expect(parseLocationInput("downtown paris").ok).toBe(false);
    const r = parseLocationInput("https://www.google.com/maps/place/Louvre");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/no coordinates/i);
  });
});
