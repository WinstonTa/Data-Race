import type Sigma from "sigma";

/**
 * The live Sigma renderer, so components outside GraphCanvas (PNG export,
 * zoom buttons) can reach it without threading refs through React.
 */
let current: Sigma | null = null;

export function setActiveSigma(sigma: Sigma | null): void {
  current = sigma;
}

export function getActiveSigma(): Sigma | null {
  return current;
}
