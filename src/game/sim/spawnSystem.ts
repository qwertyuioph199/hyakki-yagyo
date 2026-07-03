import { ENEMIES, ENEMY_IDS, type EnemyId } from '../../data/enemies';
import { DESPAWN_RADIUS, SPAWN_RING_RADIUS, STAGE_WAVES } from '../../data/waves';
import { TICK_RATE } from '../../engine/loop';
import { Ev } from './events';
import type { World } from './world';

/**
 * Wave-table interpreter (MECHANICS.md §2):
 * - Each minute reads its WaveDef row (last row repeats past 30 for overtime).
 * - Every `interval` ticks, if alive < minAlive × curse, spawn a batch to
 *   close 1/4 of the deficit (spawn pressure ramps instead of popping).
 * - Minute boundaries fire one-shot swarm/boss events.
 * - Enemies farther than DESPAWN_RADIUS teleport back onto the spawn ring
 *   (VS's recycling trick — the horde never falls behind).
 */
export function spawnSystem(world: World): void {
  const minute = Math.floor(world.tick / (TICK_RATE * 60));
  const wave = STAGE_WAVES[Math.min(minute, STAGE_WAVES.length - 1)]!;

  // One-shot minute-boundary events.
  if (minute !== world.waveMinute) {
    world.waveMinute = minute;
    if (wave.swarm) {
      if (wave.swarm.formation === 'ring') {
        for (let i = 0; i < wave.swarm.count; i++) {
          const ang = (i / wave.swarm.count) * Math.PI * 2;
          spawnEnemyAt(world, wave.swarm.enemy as EnemyId, ang);
        }
      } else {
        // Wall: a line of enemies at the ring distance, sweeping inward.
        const theta = world.rng.float(0, Math.PI * 2);
        const cx = world.player.x + Math.cos(theta) * SPAWN_RING_RADIUS;
        const cy = world.player.y + Math.sin(theta) * SPAWN_RING_RADIUS;
        const perpX = -Math.sin(theta);
        const perpY = Math.cos(theta);
        for (let i = 0; i < wave.swarm.count; i++) {
          const off = (i - wave.swarm.count / 2) * 26;
          spawnEnemyAtPos(world, wave.swarm.enemy as EnemyId, cx + perpX * off, cy + perpY * off);
        }
      }
      world.events.emit(Ev.SwarmEvent, world.player.x, world.player.y, 0, 0);
    }
    if (wave.boss) {
      spawnEnemyAt(world, wave.boss as EnemyId, world.rng.float(0, Math.PI * 2), true);
      world.events.emit(Ev.BossSpawned, world.player.x, world.player.y, 0, 0);
    }
  }

  // Steady-state top-up.
  if (world.spawnTimer > 0) {
    world.spawnTimer--;
  } else {
    world.spawnTimer = wave.interval;
    const target = Math.round(wave.minAlive * world.player.stats.curse);
    const deficit = target - world.enemies.count;
    if (deficit > 0) {
      const batch = Math.max(1, Math.ceil(deficit / 4));
      for (let i = 0; i < batch; i++) {
        if (!spawnEnemyAt(world, world.rng.pick(wave.pool) as EnemyId, world.rng.float(0, Math.PI * 2))) break;
      }
    }
  }

  // Recycle far-away enemies back onto the ring.
  const p = world.player;
  for (let i = 0; i < world.enemies.count; i++) {
    const e = world.enemies.items[i]!;
    if (e.boss) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    if (dx * dx + dy * dy > DESPAWN_RADIUS * DESPAWN_RADIUS) {
      const ang = world.rng.float(0, Math.PI * 2);
      e.x = e.px = p.x + Math.cos(ang) * SPAWN_RING_RADIUS;
      e.y = e.py = p.y + Math.sin(ang) * SPAWN_RING_RADIUS;
    }
  }
}

export function spawnEnemyAt(world: World, id: EnemyId, angle: number, isBoss = false): boolean {
  const p = world.player;
  return spawnEnemyAtPos(
    world,
    id,
    p.x + Math.cos(angle) * SPAWN_RING_RADIUS,
    p.y + Math.sin(angle) * SPAWN_RING_RADIUS,
    isBoss,
  );
}

export function spawnEnemyAtPos(world: World, id: EnemyId, x: number, y: number, isBoss = false): boolean {
  const def = ENEMIES[id] ?? ENEMIES[ENEMY_IDS[0]!];
  const e = world.enemies.alloc();
  if (!e) return false;
  e.uid = world.nextEnemyUid++;
  e.x = e.px = x;
  e.y = e.py = y;
  e.kx = 0;
  e.ky = 0;
  e.hp = e.maxHp = def.hp * world.player.stats.curse;
  e.typeIdx = ENEMY_IDS.indexOf(id);
  e.speed = def.speed;
  e.damage = def.damage;
  e.radius = def.radius;
  e.xp = def.xp;
  e.knockbackResist = isBoss ? 1 : def.knockbackResist;
  e.hitFlash = 0;
  e.boss = isBoss;
  e.hitUntil.fill(0); // recycled slot must not inherit re-hit gates
  return true;
}
