import { describe, expect, it } from 'vitest';
import { botInput, botResolveDrafts } from '../../bot/policy';
import { TICK_RATE } from '../../src/engine/loop';
import { stepRun } from '../../src/game/sim/step';
import { CAP, createRun } from '../../src/game/sim/world';

const DAWN_TICK = 30 * 60 * TICK_RATE;

/**
 * MECHANICS.md §2/§9 — the complete-run integration proof, headless.
 * God-mode bot survives to dawn; asserts the victory boundary lands on
 * exactly tick 108,000, pools never overflow, and no NaN leaks into state.
 */
describe('full 30-minute run (headless integration)', () => {
  it(
    'reaches dawn at exactly 30:00, victory flagged, pools within caps, state finite',
    () => {
      const t0 = performance.now();
      const world = createRun({ seed: 424242 });
      let dawnSeenAt = -1;

      const overtime = 20 * TICK_RATE; // ride the sunrise a little
      while (world.tick < DAWN_TICK + overtime && !world.gameOver) {
        stepRun(world, botInput(world));
        botResolveDrafts(world);
        // God mode: this test proves systems integration, not balance.
        world.player.hp = world.player.stats.maxHp;
        if (dawnSeenAt < 0 && world.victory) dawnSeenAt = world.tick;

        if (world.tick % 7200 === 0) {
          expect(world.enemies.count).toBeLessThanOrEqual(CAP.enemies);
          expect(world.projectiles.count).toBeLessThanOrEqual(CAP.projectiles);
          expect(world.gems.count).toBeLessThanOrEqual(CAP.gems);
          expect(Number.isFinite(world.player.x)).toBe(true);
          expect(Number.isFinite(world.player.y)).toBe(true);
          expect(Number.isFinite(world.player.hp)).toBe(true);
        }
      }

      const wallClock = performance.now() - t0;

      expect(world.victory).toBe(true);
      expect(dawnSeenAt).toBe(DAWN_TICK);
      expect(world.events.overflows).toBe(0);
      expect(world.player.level).toBeGreaterThan(5);
      expect(world.player.kills).toBeGreaterThan(300);
      expect(world.player.gold).toBeGreaterThan(0);
      // Sim-cost canary: a full 30-min run must stay far under real time.
      expect(wallClock).toBeLessThan(60_000);
      // eslint-disable-next-line no-console
      console.log(
        `full run: ${(wallClock / 1000).toFixed(1)}s wall-clock, level ${world.player.level}, ` +
          `kills ${world.player.kills}, gold ${world.player.gold}, enemies at dawn ${world.enemies.count}`,
      );
    },
    { timeout: 120_000 },
  );

  it('without god mode the fresh-save bot dies eventually but not instantly', () => {
    const world = createRun({ seed: 777 });
    while (!world.gameOver && world.tick < DAWN_TICK) {
      stepRun(world, botInput(world));
      botResolveDrafts(world);
    }
    const minutes = world.tick / (TICK_RATE * 60);
    // Balance gates proper live in the bot harness; this is the sanity band.
    expect(minutes).toBeGreaterThan(1);
    // eslint-disable-next-line no-console
    console.log(`fresh-save bot died at ${minutes.toFixed(1)} min, level ${world.player.level}, kills ${world.player.kills}`);
  }, { timeout: 120_000 });
});
