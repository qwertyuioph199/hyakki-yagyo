import { describe, expect, it } from 'vitest';
import { aggregateStats, recomputeStats } from '../../src/game/sim/statSystem';

/** MECHANICS.md §3 — stat aggregation: additive contributions, caps. */
describe('stat aggregation (RE §3)', () => {
  it('starts from the documented base stats', () => {
    const s = aggregateStats(null, [], null);
    expect(s.might).toBe(1);
    expect(s.cooldown).toBe(1);
    expect(s.maxHp).toBe(100);
    expect(s.amount).toBe(0);
    expect(s.curse).toBe(1);
  });

  it('passive levels contribute additively', () => {
    const s = aggregateStats(null, [
      { id: 'sacredRice', level: 3 }, // might +0.1/level
      { id: 'grandLantern', level: 2 }, // area +0.1/level
    ], null);
    expect(s.might).toBeCloseTo(1.3);
    expect(s.area).toBeCloseTo(1.2);
  });

  it('maxHp passives scale the character base as a percentage', () => {
    const s = aggregateStats({ bonuses: {}, baseHp: 120 }, [{ id: 'magatama', level: 2 }], null);
    expect(s.maxHp).toBe(Math.round(120 * 1.4));
  });

  it('character bonuses, powerups and passives stack additively', () => {
    const s = aggregateStats(
      { bonuses: { might: 0.2 }, baseHp: 100 },
      [{ id: 'sacredRice', level: 1 }],
      { might: 0.25 },
    );
    expect(s.might).toBeCloseTo(1.55);
  });

  it('cooldown reductions stack and floor at the 10% cap', () => {
    const s = aggregateStats(
      { bonuses: { cooldown: -0.5 }, baseHp: 100 },
      [{ id: 'sutra', level: 5 }], // -0.4
      { cooldown: -0.4 },
    );
    expect(s.cooldown).toBe(0.1); // -1.3 total would go negative without the floor
  });

  it('recompute heals by the max-HP delta when max grows', () => {
    const player = {
      stats: aggregateStats(null, [], null),
      hp: 100,
      passives: [] as { id: string; level: number }[],
    };
    player.passives.push({ id: 'magatama', level: 1 }); // +20%
    recomputeStats(player, null, null);
    expect(player.stats.maxHp).toBe(120);
    expect(player.hp).toBe(120);
  });
});
