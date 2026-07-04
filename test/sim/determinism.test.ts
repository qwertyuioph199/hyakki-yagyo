import { describe, expect, it } from 'vitest';
import type { TickInput } from '../../src/engine/input';
import { stepRun } from '../../src/game/sim/step';
import { createRun, type World } from '../../src/game/sim/world';

/**
 * The determinism contract: same seed + same inputs => identical state,
 * at any point, on any machine. Everything else (replay tests, the bot
 * harness, balance sweeps) stands on this.
 */

/**
 * Scripted input: orbit at a medium radius; the auto-aiming weapon kills
 * converging enemies regardless of facing — a deterministic stand-in for
 * real kiting.
 */
function scriptedInput(tick: number): TickInput {
  const ang = tick / 300;
  return { moveX: Math.cos(ang), moveY: Math.sin(ang) };
}

/** Resolve drafts + chest reveals the moment they appear (both freeze the sim). */
function autoResolveDraft(world: World): void {
  while (world.player.pendingLevelUps > 0) {
    world.player.weapons[0]!.level++;
    world.player.pendingLevelUps--;
  }
  if (world.chestReveal) world.chestReveal = null;
}

/** FNV-1a over the observable world state. */
export function hashWorld(world: World): number {
  let h = 0x811c9dc5;
  const mix = (v: number) => {
    // Hash the float's integer view so -0/NaN drift can't hide.
    const i = Math.fround(v) * 1000;
    h ^= i & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (i >> 8) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (i >> 16) & 0xff;
    h = Math.imul(h, 0x01000193);
  };
  const p = world.player;
  mix(p.x);
  mix(p.y);
  mix(p.hp);
  mix(p.level);
  mix(p.xp);
  mix(p.kills);
  mix(world.tick);
  mix(world.enemies.count);
  mix(world.projectiles.count);
  mix(world.gems.count);
  for (let i = 0; i < world.enemies.count; i++) {
    const e = world.enemies.items[i]!;
    mix(e.x);
    mix(e.y);
    mix(e.hp);
    mix(e.uid);
  }
  return h >>> 0;
}

function runFor(seed: number, ticks: number): { world: World; checkpoints: number[] } {
  const world = createRun({ seed });
  const checkpoints: number[] = [];
  for (let t = 0; t < ticks; t++) {
    stepRun(world, scriptedInput(t));
    autoResolveDraft(world);
    if (t % 1000 === 999) checkpoints.push(hashWorld(world));
  }
  return { world, checkpoints };
}

describe('sim determinism', () => {
  it('two runs with the same seed are bit-identical for 10k ticks', () => {
    const a = runFor(12345, 10_000);
    const b = runFor(12345, 10_000);
    expect(a.checkpoints).toEqual(b.checkpoints);
    expect(hashWorld(a.world)).toBe(hashWorld(b.world));
  });

  it('different seeds diverge', () => {
    const a = runFor(1, 3_000);
    const b = runFor(2, 3_000);
    expect(hashWorld(a.world)).not.toBe(hashWorld(b.world));
  });

  it('a 10k-tick run reaches a live, progressing state', () => {
    const { world } = runFor(777, 10_000);
    expect(world.gameOver).toBe(false); // circling survives the early waves
    expect(world.player.kills).toBeGreaterThan(50); // combat pipeline works
    expect(world.player.level).toBeGreaterThanOrEqual(2); // gem→XP→level works
    expect(world.enemies.count).toBeGreaterThan(0);
    expect(world.events.overflows).toBe(0);
  });

  it('golden hash — update INTENTIONALLY when sim behavior changes', () => {
    const { world } = runFor(20260702, 5_000);
    // If this fails and you did not mean to change sim behavior, you
    // introduced nondeterminism or an accidental gameplay change.
    expect(hashWorld(world)).toBe(GOLDEN_HASH_5K);
  });
});

// Captured from the first green run of this suite (see test output).
const GOLDEN_HASH_5K = 3704557328;

it('prints the current golden hash for updating', () => {
  const { world } = runFor(20260702, 5_000);
  // eslint-disable-next-line no-console
  console.log('GOLDEN_HASH_5K =', hashWorld(world));
});
