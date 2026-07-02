import { TICK_RATE } from '../../engine/loop';
import { ENEMY_LIST } from '../../data/enemies';
import type { World } from './world';

/**
 * P2 placeholder spawner: ring-spawn a wisp at a shrinking interval.
 * Replaced by the RE'd per-minute wave-table interpreter in P3.
 */
const SPAWN_RING_RADIUS = 620;

export function spawnSystem(world: World): void {
  if (world.spawnTimer > 0) {
    world.spawnTimer--;
    return;
  }
  const minute = world.tick / (TICK_RATE * 60);
  const interval = Math.max(8, 45 - minute * 12);
  world.spawnTimer = Math.round(interval);

  spawnEnemy(world, 0);
}

export function spawnEnemy(world: World, typeIdx: number): boolean {
  const def = ENEMY_LIST[typeIdx]!;
  const e = world.enemies.alloc();
  if (!e) return false;
  const ang = world.rng.float(0, Math.PI * 2);
  const p = world.player;
  e.uid = world.nextEnemyUid++;
  e.x = e.px = p.x + Math.cos(ang) * SPAWN_RING_RADIUS;
  e.y = e.py = p.y + Math.sin(ang) * SPAWN_RING_RADIUS;
  e.kx = 0;
  e.ky = 0;
  e.hp = e.maxHp = def.hp * world.player.stats.curse;
  e.typeIdx = typeIdx;
  e.speed = def.speed;
  e.damage = def.damage;
  e.radius = def.radius;
  e.xp = def.xp;
  e.knockbackResist = def.knockbackResist;
  e.hitFlash = 0;
  return true;
}
