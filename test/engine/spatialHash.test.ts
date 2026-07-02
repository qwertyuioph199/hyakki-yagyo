import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/engine/rng';
import { SpatialHash } from '../../src/engine/spatialHash';

function bruteForce(
  points: { x: number; y: number }[],
  qx: number,
  qy: number,
  r: number,
): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < points.length; i++) {
    const dx = points[i]!.x - qx;
    const dy = points[i]!.y - qy;
    if (dx * dx + dy * dy <= r * r) out.add(i);
  }
  return out;
}

describe('SpatialHash', () => {
  it('matches brute force over random points and queries', () => {
    const rng = new Rng(31337);
    const hash = new SpatialHash(48, 1000);
    const out = new Int32Array(1000);

    for (let trial = 0; trial < 20; trial++) {
      const points: { x: number; y: number }[] = [];
      hash.clear();
      for (let i = 0; i < 500; i++) {
        const p = { x: rng.float(-2000, 2000), y: rng.float(-2000, 2000) };
        points.push(p);
        hash.insert(i, p.x, p.y);
      }
      for (let q = 0; q < 10; q++) {
        const qx = rng.float(-2000, 2000);
        const qy = rng.float(-2000, 2000);
        const r = rng.float(10, 300);
        const n = hash.query(qx, qy, r, out);
        const got = new Set<number>();
        for (let i = 0; i < n; i++) got.add(out[i]!);
        expect(got).toEqual(bruteForce(points, qx, qy, r));
      }
    }
  });

  it('handles far-apart coordinates (hash collisions stay correct)', () => {
    const hash = new SpatialHash(48, 10);
    const out = new Int32Array(10);
    hash.insert(0, 0, 0);
    hash.insert(1, 100_000, -50_000);
    hash.insert(2, 5, 5);
    expect(hash.query(0, 0, 20, out)).toBe(2);
    const ids = [out[0], out[1]].sort();
    expect(ids).toEqual([0, 2]);
  });

  it('respects the out-buffer cap without crashing', () => {
    const hash = new SpatialHash(48, 100);
    const out = new Int32Array(5);
    for (let i = 0; i < 100; i++) hash.insert(i, i % 10, (i / 10) | 0);
    expect(hash.query(5, 5, 50, out)).toBe(5);
  });

  it('returns nothing after clear()', () => {
    const hash = new SpatialHash(48, 10);
    const out = new Int32Array(10);
    hash.insert(0, 1, 1);
    hash.clear();
    expect(hash.query(1, 1, 10, out)).toBe(0);
  });
});
