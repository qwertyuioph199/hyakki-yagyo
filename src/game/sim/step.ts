import type { TickInput } from '../../engine/input';
import { enemySystem } from './enemySystem';
import { pickupSystem } from './pickupSystem';
import { playerSystem } from './playerSystem';
import { projectileSystem } from './projectileSystem';
import { spawnSystem } from './spawnSystem';
import { weaponSystem } from './weaponSystem';
import type { World } from './world';

/**
 * Advance the simulation by exactly one 60Hz tick. Pure with respect to its
 * inputs: (world, input) → mutated world + events. No DOM, no rendering, no
 * wall-clock, no Math.random.
 *
 * While a level-up draft is pending the sim freezes (VS pauses during the
 * draft); the UI resolves pendingLevelUps then stepping resumes. Victory
 * (dawn at 30:00) does NOT freeze the sim — the sweeper hunts you through
 * the sunrise, exactly like the original's Reaper.
 */
export function stepRun(world: World, input: TickInput): void {
  // Sim freezes during a level-up draft and during a chest-opening reveal
  // (both are dismissed by the UI or the headless bot).
  if (world.gameOver || world.player.pendingLevelUps > 0 || world.chestReveal !== null) return;

  world.tick++;
  world.events.clear();

  playerSystem(world, input);
  spawnSystem(world);
  enemySystem(world);

  // Rebuild the spatial index AFTER movement so weapon/projectile queries
  // see current-tick positions.
  world.enemyHash.clear();
  for (let i = 0; i < world.enemies.count; i++) {
    const e = world.enemies.items[i]!;
    world.enemyHash.insert(i, e.x, e.y);
  }

  weaponSystem(world);
  projectileSystem(world);
  pickupSystem(world);
}
