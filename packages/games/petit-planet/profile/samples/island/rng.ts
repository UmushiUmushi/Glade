// A small seeded random source (mulberry32), so the same seed always makes the same island.

export interface Rng {
  /** A number in [0, 1). */
  next(): number;
  /** A whole number in [lo, hi]. */
  int(lo: number, hi: number): number;
  /** A number in [lo, hi). */
  range(lo: number, hi: number): number;
  pick<T>(list: readonly T[]): T;
  /** A copy of the list in random order. */
  shuffle<T>(list: readonly T[]): T[];
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  return {
    next,
    int,
    range: (lo, hi) => lo + next() * (hi - lo),
    pick: (list) => list[Math.floor(next() * list.length)],
    shuffle(list) {
      const out = [...list];
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i);
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}
