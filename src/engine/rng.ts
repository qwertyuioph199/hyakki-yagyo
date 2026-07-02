/**
 * Deterministic PRNG (mulberry32). Every random decision in the sim flows
 * through an Rng instance owned by the world — Math.random is banned in
 * src/game/sim and src/data (enforced by test/simPurity.test.ts).
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [0, n). */
  int(n: number): number {
    return (this.next() * n) | 0;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)]!;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  /**
   * Weighted pick: weights[i] >= 0, returns index. Total weight of 0 falls
   * back to uniform.
   */
  weighted(weights: readonly number[]): number {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i]!;
    if (total <= 0) return this.int(weights.length);
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i]!;
      if (r < 0) return i;
    }
    return weights.length - 1;
  }

  /** In-place Fisher-Yates shuffle. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = tmp;
    }
    return arr;
  }

  /** Derive an independent stream (e.g. separate visual-only rng). */
  fork(): Rng {
    return new Rng((this.next() * 0xffffffff) >>> 0);
  }
}
