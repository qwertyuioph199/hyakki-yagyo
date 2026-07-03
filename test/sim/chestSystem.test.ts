import { describe, expect, it } from 'vitest';
import { chestRolls, eligibleEvolution, openChest } from '../../src/game/sim/chestSystem';
import { TICK_RATE } from '../../src/engine/loop';
import { createRun } from '../../src/game/sim/world';

/** MECHANICS.md §7 — treasure chest algorithm. */
describe('chest algorithm (RE §7)', () => {
  it('power count scales 1..5 with elapsed time', () => {
    const world = createRun({ seed: 123 });
    const at = (minute: number) => {
      world.tick = minute * 60 * TICK_RATE;
      return chestRolls(world);
    };
    expect(at(0)).toBe(1);
    expect(at(5)).toBe(1);
    expect(at(6)).toBe(2);
    expect(at(12)).toBe(3);
    expect(at(18)).toBe(4);
    expect(at(24)).toBe(5);
    expect(at(30)).toBe(5); // capped
  });

  it('luck can grant one extra power (capped at 5)', () => {
    const world = createRun({ seed: 321 });
    world.tick = 12 * 60 * TICK_RATE; // base 3
    world.player.stats.luck = 1.5; // 50% chance of +1
    let extra = 0;
    const N = 10000;
    for (let i = 0; i < N; i++) if (chestRolls(world) === 4) extra++;
    expect(extra / N).toBeGreaterThan(0.45);
    expect(extra / N).toBeLessThan(0.55);
    // At max time, luck can't push past 5.
    world.tick = 30 * 60 * TICK_RATE;
    world.player.stats.luck = 3;
    for (let i = 0; i < 200; i++) expect(chestRolls(world)).toBe(5);
  });

  it('gold scales with elapsed time', () => {
    const early = createRun({ seed: 7 });
    early.player.weapons = [{ id: 'ofuda', level: 1, cooldown: 0, state: 0 }];
    early.tick = 1 * 60 * TICK_RATE;
    const late = createRun({ seed: 7 });
    late.player.weapons = [{ id: 'ofuda', level: 1, cooldown: 0, state: 0 }];
    late.tick = 20 * 60 * TICK_RATE;
    expect(openChest(late).gold).toBeGreaterThan(openChest(early).gold);
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
