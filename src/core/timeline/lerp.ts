export function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}
