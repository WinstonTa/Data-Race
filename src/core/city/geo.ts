import type { BBox, LngLat, Ring } from "./types";

/** Mean Earth radius, metres. */
const EARTH_RADIUS_M = 6_371_008.8;
const DEG = Math.PI / 180;
/** Metres per degree of latitude (and of longitude at the equator). */
const M_PER_DEG = EARTH_RADIUS_M * DEG;

/** Great-circle distance between two positions, metres. */
export function haversineM(a: LngLat, b: LngLat): number {
  const dLat = (b[1] - a[1]) * DEG;
  const dLng = (b[0] - a[0]) * DEG;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * DEG) * Math.cos(b[1] * DEG) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Sum of segment lengths along a path, metres. */
export function pathLengthM(path: readonly LngLat[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += haversineM(path[i - 1], path[i]);
  return total;
}

/** Square box of ±`halfM` metres around `center`. */
export function bboxAround(center: LngLat, halfM: number): BBox {
  const dLat = halfM / M_PER_DEG;
  const dLng = halfM / (M_PER_DEG * Math.cos(center[1] * DEG));
  return [
    roundCoord(center[0] - dLng),
    roundCoord(center[1] - dLat),
    roundCoord(center[0] + dLng),
    roundCoord(center[1] + dLat),
  ];
}

export function bboxContains(bbox: BBox, p: LngLat): boolean {
  return p[0] >= bbox[0] && p[0] <= bbox[2] && p[1] >= bbox[1] && p[1] <= bbox[3];
}

/** Round to 6 decimal places (≈ 10 cm) — keeps snapshots compact. */
export function roundCoord(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Web-map zoom that shows roughly `altitudeM` metres of ground vertically in
 * an ~800 px tall viewport (what Google's `@lat,lng,500m` URLs encode).
 */
export function zoomFromAltitudeM(altitudeM: number, lat: number): number {
  const z = Math.log2(
    (78_271.517 * Math.cos(lat * DEG) * 800) / Math.max(altitudeM, 1),
  );
  return Math.min(20, Math.max(1, Math.round(z * 10) / 10));
}

/** Ring without the repeated closing vertex. */
function openRing(ring: Ring): Ring {
  const n = ring.length;
  if (n > 1 && ring[0][0] === ring[n - 1][0] && ring[0][1] === ring[n - 1][1])
    return ring.slice(0, -1);
  return ring;
}

/** Vertex average of a ring — good enough as a label/join anchor. */
export function ringCentroid(ring: Ring): LngLat {
  const pts = openRing(ring);
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
  }
  const n = Math.max(pts.length, 1);
  return [roundCoord(x / n), roundCoord(y / n)];
}

/** Planar area of a ring in m² (local equirectangular projection). */
export function ringAreaM2(ring: Ring): number {
  const pts = openRing(ring);
  if (pts.length < 3) return 0;
  const kx = M_PER_DEG * Math.cos(pts[0][1] * DEG);
  const ky = M_PER_DEG;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += a[0] * kx * (b[1] * ky) - b[0] * kx * (a[1] * ky);
  }
  return Math.abs(sum) / 2;
}

/** Even-odd point-in-ring test (planar, fine at city scale). */
export function pointInRing(p: LngLat, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
