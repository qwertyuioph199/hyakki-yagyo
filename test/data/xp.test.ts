import { describe, expect, it } from 'vitest';
import { xpToNext } from '../../src/data/xp';

/**
 * MECHANICS.md §1 — experience curve, table-driven against the RE'd values.
 */
describe('XP curve (RE §1)', () => {
  it('matches the documented requirements at key levels', () => {
    expect(xpToNext(1)).toBe(5);
    expect(xpToNext(2)).toBe(15);
    expect(xpToNext(3)).toBe(25);
    expect(xpToNext(10)).toBe(95);
    expect(xpToNext(19)).toBe(185);
  });

  it('applies the one-time +600 jump at level 20', () => {
    // 19→20 costs 185; 20→21 costs 185 + 13 + 600.
    expect(xpToNext(20)).toBe(798);
    expect(xpToNext(21)).toBe(811);
  });

  it('uses +13 increments through the 20s and 30s', () => {
    for (let lv = 21; lv < 39; lv++) {
      expect(xpToNext(lv + 1) - xpToNext(lv)).toBe(13);
    }
  });

  it('applies the one-time +2400 jump at level 40', () => {
    const at39 = xpToNext(39);
    expect(xpToNext(40)).toBe(at39 + 16 + 2400);
  });

  it('uses +16 increments past 40', () => {
    for (let lv = 41; lv < 60; lv++) {
      expect(xpToNext(lv + 1) - xpToNext(lv)).toBe(16);
    }
  });

  it('is monotonically increasing and finite up to level 200', () => {
    for (let lv = 1; lv < 200; lv++) {
      const cur = xpToNext(lv);
      expect(Number.isFinite(cur)).toBe(true);
      expect(xpToNext(lv + 1)).toBeGreaterThan(cur);
    }
  });
});
