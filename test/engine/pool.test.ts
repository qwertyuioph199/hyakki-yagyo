import { describe, expect, it } from 'vitest';
import { Pool } from '../../src/engine/pool';

interface Thing {
  id: number;
  active: boolean;
}

describe('Pool', () => {
  it('allocates up to capacity then returns null', () => {
    const pool = new Pool<Thing>(3, () => ({ id: 0, active: false }));
    expect(pool.alloc()).not.toBeNull();
    expect(pool.alloc()).not.toBeNull();
    expect(pool.alloc()).not.toBeNull();
    expect(pool.full).toBe(true);
    expect(pool.alloc()).toBeNull();
  });

  it('never allocates new objects (recycles the same instances)', () => {
    const pool = new Pool<Thing>(2, () => ({ id: 0, active: false }));
    const a = pool.alloc()!;
    const b = pool.alloc()!;
    pool.free(0);
    pool.free(0);
    const c = pool.alloc()!;
    const d = pool.alloc()!;
    expect([a, b]).toContain(c);
    expect([a, b]).toContain(d);
    expect(c).not.toBe(d);
  });

  it('swap-remove keeps items[0..count-1] dense', () => {
    const pool = new Pool<Thing>(5, () => ({ id: 0, active: false }));
    for (let i = 0; i < 5; i++) pool.alloc()!.id = i;
    // Free the middle item; the last live item must take its slot.
    pool.free(1);
    expect(pool.count).toBe(4);
    const liveIds = new Set<number>();
    for (let i = 0; i < pool.count; i++) liveIds.add(pool.items[i]!.id);
    expect(liveIds).toEqual(new Set([0, 2, 3, 4]));
  });

  it('backwards iteration with frees visits every live item exactly once', () => {
    const pool = new Pool<Thing>(10, () => ({ id: 0, active: false }));
    for (let i = 0; i < 10; i++) pool.alloc()!.id = i;
    const visited: number[] = [];
    for (let i = pool.count - 1; i >= 0; i--) {
      const item = pool.items[i]!;
      visited.push(item.id);
      if (item.id % 2 === 0) pool.free(i);
    }
    expect(visited).toHaveLength(10);
    expect(new Set(visited).size).toBe(10);
    expect(pool.count).toBe(5);
  });
});
