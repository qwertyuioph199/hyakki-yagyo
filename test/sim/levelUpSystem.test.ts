import { describe, expect, it } from 'vitest';
import { PASSIVE_IDS } from '../../src/data/passives';
import {
  applyDraftChoice,
  banishChoice,
  currentDraft,
  generateDraft,
  MAX_PASSIVES,
  MAX_WEAPONS,
  rerollDraft,
  skipDraft,
} from '../../src/game/sim/levelUpSystem';
import { createRun } from '../../src/game/sim/world';

/** MECHANICS.md §6 — level-up draft rules. */
describe('level-up draft (RE §6)', () => {
  it('generates 3 choices at base luck, no duplicates', () => {
    const world = createRun({ seed: 1 });
    for (let i = 0; i < 200; i++) {
      const draft = generateDraft(world);
      expect(draft.length).toBe(3);
      const keys = draft.map((c) => `${c.kind}:${c.id}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('offers a 4th slot with probability min(luck-1, 0.3)', () => {
    const world = createRun({ seed: 42 });
    world.player.stats.luck = 1.2; // 20% chance of 4 slots
    let fours = 0;
    const N = 5000;
    for (let i = 0; i < N; i++) {
      if (generateDraft(world).length === 4) fours++;
    }
    expect(fours / N).toBeGreaterThan(0.17);
    expect(fours / N).toBeLessThan(0.23);
  });

  it('never offers new weapons when weapon slots are full', () => {
    const world = createRun({ seed: 7 });
    world.player.weapons = [
      { id: 'ofuda', level: 1, cooldown: 0, state: 0 },
      { id: 'w2', level: 1, cooldown: 0, state: 0 },
      { id: 'w3', level: 1, cooldown: 0, state: 0 },
      { id: 'w4', level: 1, cooldown: 0, state: 0 },
      { id: 'w5', level: 1, cooldown: 0, state: 0 },
      { id: 'w6', level: 1, cooldown: 0, state: 0 },
    ];
    expect(world.player.weapons.length).toBe(MAX_WEAPONS);
    for (let i = 0; i < 100; i++) {
      for (const c of generateDraft(world)) {
        if (c.kind === 'weapon') {
          // Only level-ups of owned weapons may appear.
          expect(world.player.weapons.some((w) => w.id === c.id)).toBe(true);
        }
      }
    }
  });

  it('falls back to gold + food when everything is maxed/banished', () => {
    const world = createRun({ seed: 9 });
    world.player.weapons = [{ id: 'ofuda', level: 8, cooldown: 0, state: 0 }]; // max (7 deltas + 1)
    // Fill passive slots with maxed passives so no new passives fit.
    world.player.passives = PASSIVE_IDS.slice(0, MAX_PASSIVES).map((id) => ({ id, level: 5 }));
    world.player.passives.forEach((p) => {
      if (p.id === 'magatama') p.level = 3;
    });
    world.player.weapons.push(
      ...['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, level: 99, cooldown: 0, state: 0 })),
    );
    const draft = generateDraft(world);
    expect(draft.map((c) => c.kind).sort()).toEqual(['food', 'gold']);
  });

  it('applying a new passive recomputes stats immediately', () => {
    const world = createRun({ seed: 3 });
    applyDraftChoice(world, { kind: 'passive', id: 'sacredRice', toLevel: 1 });
    expect(world.player.stats.might).toBeCloseTo(1.1);
  });

  it('reroll consumes a charge and regenerates; skip consumes the level-up', () => {
    const world = createRun({ seed: 5 });
    world.player.pendingLevelUps = 1;
    world.player.stats.reroll = 1;
    world.player.stats.skip = 1;
    const first = currentDraft(world)!;
    expect(rerollDraft(world)).toBe(true);
    expect(world.player.stats.reroll).toBe(0);
    expect(rerollDraft(world)).toBe(false);
    const second = currentDraft(world)!;
    expect(second).not.toBe(first);
    expect(skipDraft(world)).toBe(true);
    expect(world.player.pendingLevelUps).toBe(0);
    expect(currentDraft(world)).toBeNull();
  });

  it('banish removes the item from this run permanently', () => {
    const world = createRun({ seed: 11 });
    world.player.pendingLevelUps = 1;
    world.player.stats.banish = 1;
    const draft = currentDraft(world)!;
    const target = draft.find((c) => c.kind === 'passive') ?? draft[0]!;
    expect(banishChoice(world, target)).toBe(true);
    expect(world.banished).toContain(target.id);
    for (let i = 0; i < 100; i++) {
      for (const c of generateDraft(world)) {
        expect(c.id).not.toBe(target.id);
      }
    }
  });
});
