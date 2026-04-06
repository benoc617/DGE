/**
 * Seedable PRNG using mulberry32.
 * Every random call in the game goes through this so simulations are reproducible.
 * Call `setSeed(n)` before a run to get deterministic results.
 * Call `setSeed(null)` to revert to true randomness (default for production).
 */

let state: number | null = null;

export function setSeed(seed: number | null): void {
  state = seed !== null ? seed >>> 0 : null;
}

export function getSeed(): number | null {
  return state;
}

function mulberry32(): number {
  if (state === null) return Math.random();
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Drop-in replacement for Math.random() — seedable when a seed is set. */
export function random(): number {
  return mulberry32();
}

/** Random integer in [min, max] inclusive. */
export function randomInt(min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

/** Random float in [min, max). */
export function randomFloat(min: number, max: number): number {
  return min + random() * (max - min);
}

/** True with probability p (0..1). */
export function chance(p: number): boolean {
  return random() < p;
}

/** Shuffle an array in place (Fisher-Yates). */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
