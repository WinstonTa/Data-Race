import { zoomFromAltitudeM } from "./geo";

export type LocationParse =
  | {
      ok: true;
      latitude: number;
      longitude: number;
      /** Only when the input encoded one (Google `16z` / `500m`). */
      zoom?: number;
    }
  | { ok: false; reason: string };

/** Web Mercator can't show the poles. */
const MAX_LAT = 85.0511;

const NUM = String.raw`[-+]?\d{1,3}(?:\.\d+)?`;
const AT_RE = new RegExp(
  String.raw`@(${NUM}),(${NUM})(?:,(\d+(?:\.\d+)?)(z|m|a))?`,
);
const PLACE_RE = new RegExp(String.raw`!3d(${NUM})!4d(${NUM})`);
const PAIR_RE = new RegExp(String.raw`^\s*(${NUM})\s*(?:,|\s)\s*(${NUM})\s*$`);
/** `37.7749° N, 122.4194° W` style. */
const HEMI_RE = new RegExp(
  String.raw`^\s*(\d{1,2}(?:\.\d+)?)\s*°?\s*([NS])\s*,?\s*(\d{1,3}(?:\.\d+)?)\s*°?\s*([EW])\s*$`,
  "i",
);
const SHORT_LINK_RE = /(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)/i;
const QUERY_KEYS = ["q", "ll", "query", "center", "destination"];

function build(
  lat: number,
  lng: number,
  zoom?: number,
): LocationParse {
  if (!Number.isFinite(lat) || !Number.isFinite(lng))
    return { ok: false, reason: "Those coordinates aren't numbers." };
  if (Math.abs(lat) > MAX_LAT)
    return {
      ok: false,
      reason: `Latitude must be between −${MAX_LAT} and ${MAX_LAT} (got ${lat}).`,
    };
  if (Math.abs(lng) > 180)
    return {
      ok: false,
      reason: `Longitude must be between −180 and 180 (got ${lng}).`,
    };
  return zoom === undefined
    ? { ok: true, latitude: lat, longitude: lng }
    : { ok: true, latitude: lat, longitude: lng, zoom };
}

/** Plain `lat, lng` / `lat lng` / `37.77° N, 122.41° W`. */
function parsePair(text: string): LocationParse | null {
  const m = PAIR_RE.exec(text);
  if (m) return build(Number(m[1]), Number(m[2]));
  const h = HEMI_RE.exec(text);
  if (h) {
    const lat = Number(h[1]) * (h[2].toUpperCase() === "S" ? -1 : 1);
    const lng = Number(h[3]) * (h[4].toUpperCase() === "W" ? -1 : 1);
    return build(lat, lng);
  }
  return null;
}

function zoomFrom(value: string | undefined, unit: string | undefined, lat: number) {
  if (value === undefined || unit === undefined) return undefined;
  const n = Number(value);
  if (unit === "z") return Math.min(22, Math.max(0, n));
  return zoomFromAltitudeM(n, lat); // "m" (3D view) and "a" (Earth) are metres
}

/**
 * Google Maps URL or raw coordinates → a camera target.
 *
 * Understands `…/@lat,lng,16z`, `…/@lat,lng,500m`, place links
 * (`!3dLAT!4dLNG`, preferred over the `@` viewport when both exist),
 * `?q=` / `ll=` / `query=` / `center=` parameters, coordinates in the path
 * (`/maps/search/37.77,+-122.41`) and plain pairs. Short links can't be
 * resolved client-side (the redirect isn't readable cross-origin).
 */
export function parseLocationInput(input: string): LocationParse {
  const text = input.trim();
  if (!text)
    return { ok: false, reason: "Paste a Google Maps link or lat, lng." };

  const pair = parsePair(text);
  if (pair) return pair;

  if (SHORT_LINK_RE.test(text))
    return {
      ok: false,
      reason:
        "Short links can't be opened here. Open it in your browser and paste the full URL from the address bar.",
    };

  let decoded = text;
  try {
    decoded = decodeURIComponent(text);
  } catch {
    // Malformed escapes: match against the raw text.
  }

  const at = AT_RE.exec(decoded);
  const place = PLACE_RE.exec(decoded);
  if (place) {
    const lat = Number(place[1]);
    return build(lat, Number(place[2]), zoomFrom(at?.[3], at?.[4], lat));
  }
  if (at) {
    const lat = Number(at[1]);
    return build(lat, Number(at[2]), zoomFrom(at[3], at[4], lat));
  }

  let url: URL | null = null;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    url = null;
  }
  if (url) {
    for (const key of QUERY_KEYS) {
      const v = url.searchParams.get(key);
      const p = v ? parsePair(v.replace(/\+/g, " ")) : null;
      if (p) return p;
    }
    for (const segment of url.pathname.split("/")) {
      const p = parsePair(decodeSafe(segment).replace(/\+/g, " "));
      if (p) return p;
    }
  }

  return {
    ok: false,
    reason: /^(https?:\/\/|www\.|google\.|maps\.)/i.test(text)
      ? "No coordinates found in that link. Use a Google Maps URL that contains @lat,lng."
      : "Not recognised. Paste a Google Maps URL or coordinates like 48.8584, 2.2945.",
  };
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
