import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/engine/rng';

describe('Rng (mulberry32)', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    for (let i = 0; i < 1000; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('produces different streams for different seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    let same = 0;
    for (let i = 0; i < 100; i++) {
      if (a.next() === b.next()) same++;
    }
    expect(same).toBeLessThan(3);
  });

  it('stays in [0, 1) with sane mean', () => {
    const rng = new Rng(777);
    let sum = 0;
    const n = 10_000;
    for (let i = 0; i < n; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / n).toBeGreaterThan(0.48);
    expect(sum / n).toBeLessThan(0.52);
  });

  it('int(n) covers [0, n) uniformly enough', () => {
    const rng = new Rng(42);
    const counts = new Array(10).fill(0);
    for (let i = 0; i < 10_000; i++) counts[rng.int(10)]++;
    for (const c of counts) {
      expect(c).toBeGreaterThan(800);
      expect(c).toBeLessThan(1200);
    }
  });

  it('weighted() respects weights statistically', () => {
    const rng = new Rng(99);
    const counts = [0, 0, 0];
    for (let i = 0; i < 10_000; i++) {
      const k = rng.weighted([1, 2, 7]);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    expect(counts[0]).toBeGreaterThan(700);
    expect(counts[0]).toBeLessThan(1300);
    expect(counts[2]).toBeGreaterThan(6500);
    expect(counts[2]).toBeLessThan(7500);
  });

  it('weighted() never picks zero-weight entries when others exist', () => {
    const rng = new Rng(5);
    for (let i = 0; i < 1000; i++) {
      expect(rng.weighted([0, 1, 0])).toBe(1);
    }
  });
});
