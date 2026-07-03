import { describe, expect, it } from 'vitest';
import { eligibleEvolution, openChest } from '../../src/game/sim/chestSystem';
import { createRun } from '../../src/game/sim/world';

/** MECHANICS.md §7 — treasure chest algorithm. */
describe('chest algorithm (RE §7)', () => {
  it('roll distribution matches P(5)=0.004·luck, P(3)=0.036·luck', () => {
    const world = createRun({ seed: 123 });
    world.player.weapons = [{ id: 'ofuda', level: 1, cooldown: 0, state: 0 }];
    const counts = { 1: 0, 3: 0, 5: 0 };
    const N = 20000;
    for (let i = 0; i < N; i++) {
      // Fresh upgrade room each time (reset weapon level).
      world.player.weapons[0]!.level = 1;
      const result = openChest(world);
      counts[result.rolls as 1 | 3 | 5]++;
    }
    expect(counts[5] / N).toBeGreaterThan(0.002);
    expect(counts[5] / N).toBeLessThan(0.006);
    expect(counts[3] / N).toBeGreaterThan(0.03);
    expect(counts[3] / N).toBeLessThan(0.043);
  });

  it('luck scales the 3/5 roll chances', () => {
    const world = createRun({ seed: 321 });
    world.player.stats.luck = 3;
    world.player.weapons = [{ id: 'ofuda', level: 1, cooldown: 0, state: 0 }];
    let multi = 0;
    const N = 10000;
    for (let i = 0; i < N; i++) {
      world.player.weapons[0]!.level = 1;
      if (openChest(world).rolls > 1) multi++;
    }
    // 3 × (0.004 + 0.036) = 12%
    expect(multi / N).toBeGreaterThan(0.10);
    expect(multi / N).toBeLessThan(0.14);
  });

  it('evolution requires max weapon + partner passive + minute gate', () => {
    const world = createRun({ seed: 55 });
    // Not eligible: level too low.
    world.player.weapons = [{ id: 'ofuda', level: 3, cooldown: 0, state: 0 }];
    world.player.passives = [{ id: 'sutra', level: 1 }];
    world.tick = 15 * 60 * 60; // minute 15
    expect(eligibleEvolution(world)).toBeNull();
    // Max level but missing the passive.
    world.player.weapons[0]!.level = 8;
    world.player.passives = [];
    expect(eligibleEvolution(world)).toBeNull();
    // Max level + passive but before the minute gate.
    world.player.passives = [{ id: 'sutra', level: 1 }];
    world.tick = 5 * 60 * 60;
    expect(eligibleEvolution(world)).toBeNull();
    // All conditions met.
    world.tick = 10 * 60 * 60;
    expect(eligibleEvolution(world)?.into).toBe('hyakkiSeal');
  });

  it('an eligible chest grants the evolution and replaces the base weapon', () => {
    const world = createRun({ seed: 77 });
    world.player.weapons = [{ id: 'ofuda', level: 8, cooldown: 5, state: 2 }];
    world.player.passives = [{ id: 'sutra', level: 1 }];
    world.tick = 12 * 60 * 60;
    const result = openChest(world);
    expect(result.items[0]).toEqual({ kind: 'evolution', id: 'hyakkiSeal', toLevel: 1 });
    expect(world.player.weapons.some((w) => w.id === 'hyakkiSeal')).toBe(true);
    expect(world.player.weapons.some((w) => w.id === 'ofuda')).toBe(false);
    // Evolved weapons never re-evolve.
    expect(eligibleEvolution(world)).toBeNull();
  });

  it('chests only level owned items and pay gold for unusable rolls', () => {
    const world = createRun({ seed: 99 });
    world.player.weapons = [{ id: 'hyakkiSeal', level: 1, cooldown: 0, state: 0 }]; // maxed (no levels)
    world.player.passives = [];
    const goldBefore = world.player.gold;
    const result = openChest(world);
    expect(result.items.length).toBe(0);
    expect(world.player.gold).toBeGreaterThan(goldBefore);
  });

  it('greed multiplies chest gold', () => {
    const a = createRun({ seed: 5 });
    const b = createRun({ seed: 5 });
    b.player.stats.greed = 2;
    const ga = openChest(a).gold;
    const gb = openChest(b).gold;
    expect(gb).toBe(ga * 2);
  });
});
