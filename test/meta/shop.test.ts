import { describe, expect, it } from 'vitest';
import { buyRank, nextRankPrice, powerUpBonuses, totalRanks } from '../../src/game/meta/shop';

/** MECHANICS.md §8 — PowerUp pricing & the buy-order mechanic. */
describe('powerup shop (RE §8)', () => {
  it('first rank costs the base price', () => {
    expect(nextRankPrice('might', {})).toBe(200);
    expect(nextRankPrice('curse', {})).toBe(1666);
  });

  it('each owned rank of the SAME item multiplies its next rank', () => {
    // rank 2 of might with only might(1) owned: 200 × 2 × 1.1 = 440
    expect(nextRankPrice('might', { might: 1 })).toBe(440);
  });

  it('every rank bought ANYWHERE escalates all prices by 10% — buy order matters', () => {
    // Buying greed first makes might more expensive:
    expect(nextRankPrice('might', { greed: 5 })).toBe(Math.round(200 * 1 * 1.5));
    // The classic optimization: expensive items first.
    const cheapFirst = [
      nextRankPrice('might', {})!, // 200
      nextRankPrice('amount', { might: 1 })!, // 5000 × 1.1
    ].reduce((a, b) => a + b);
    const expensiveFirst = [
      nextRankPrice('amount', {})!, // 5000
      nextRankPrice('might', { amount: 1 })!, // 200 × 1.1
    ].reduce((a, b) => a + b);
    expect(expensiveFirst).toBeLessThan(cheapFirst);
  });

  it('buyRank enforces gold and max rank', () => {
    expect(buyRank('might', {}, 100)).toBeNull(); // can't afford
    const r1 = buyRank('might', {}, 1000)!;
    expect(r1.goldLeft).toBe(800);
    let ranks = r1.ranks;
    for (let i = 0; i < 10; i++) {
      const r = buyRank('might', ranks, 1_000_000);
      if (!r) break;
      ranks = r.ranks;
    }
    expect(ranks.might).toBe(5); // maxRank respected
    expect(buyRank('might', ranks, 1_000_000)).toBeNull();
  });

  it('bonuses aggregate rank × perRank per stat', () => {
    const b = powerUpBonuses({ might: 3, cooldown: 2, armor: 2 });
    expect(b.might).toBeCloseTo(0.15);
    expect(b.cooldown).toBeCloseTo(-0.05);
    expect(b.armor).toBe(2);
    expect(totalRanks({ might: 3, cooldown: 2, armor: 2 })).toBe(7);
  });
});
