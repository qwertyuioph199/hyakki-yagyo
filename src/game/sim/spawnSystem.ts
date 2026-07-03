import { ENEMIES, ENEMY_IDS, type EnemyId } from '../../data/enemies';
import { DESPAWN_RADIUS, SPAWN_RING_RADIUS } from '../../data/waves';
import { TICK_RATE } from '../../engine/loop';
import { Ev } from './events';
import { PickupKind, type World } from './world';

/**
 * Wave-table interpreter (MECHANICS.md §2):
 * - Each minute reads its WaveDef row (last row repeats past 30 for overtime).
 * - Every `interval` ticks, if alive < minAlive × curse, spawn a batch to
 *   close 1/4 of the deficit (spawn pressure ramps instead of popping).
 * - Minute boundaries fire one-shot swarm/boss events.
 * - Enemies farther than DESPAWN_RADIUS teleport back onto the spawn ring
 *   (VS's recycling trick — the horde never falls behind).
 */
const DAWN_TICK = 30 * 60 * TICK_RATE; // 30:00 — tick 108,000
const SWEEPER_INTERVAL = 8 * TICK_RATE;
/** Ticks between field drops (coin/food/utility near the player). */
const FIELD_DROP_INTERVAL = 40 * TICK_RATE;

export function spawnSystem(world: World): void {
  const minute = Math.floor(world.tick / (TICK_RATE * 60));

  // Dawn (MECHANICS.md §2): victory at exactly 30:00, then the unkillable
  // First Light floods in on a fixed interval — the Reaper mirror.
  if (world.tick >= DAWN_TICK) {
    if (!world.victory) {
      world.victory = true;
      world.events.emit(Ev.DawnBreaks, world.player.x, world.player.y, 0, 0);
    }
    if (world.tick % SWEEPER_INTERVAL === 0) {
      spawnEnemyAt(world, 'akatsuki', world.rng.float(0, Math.PI * 2), true);
    }
    return; // normal waves end at dawn
  }

  const wave = world.waves[Math.min(minute, world.waves.length - 1)]!;

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

  // Field drops (the VS brazier/light-source mirror): every ~40s something
  // useful appears near the player — mostly coins, sometimes food/utility.
  if (world.tick > 0 && world.tick % FIELD_DROP_INTERVAL === 0) {
    const item = world.pickups.alloc();
    if (item) {
      const ang = world.rng.float(0, Math.PI * 2);
      const dist = world.rng.float(180, 380);
      item.x = world.player.x + Math.cos(ang) * dist;
      item.y = world.player.y + Math.sin(ang) * dist;
      const roll = world.rng.weighted([5, 3, 1, 1]);
      if (roll === 0) {
        item.kind = PickupKind.Coin;
        item.value = 8 + world.rng.int(8);
      } else if (roll === 1) {
        item.kind = PickupKind.Food;
        item.value = 30;
      } else if (roll === 2) {
        item.kind = PickupKind.Vacuum;
        item.value = 0;
      } else {
        item.kind = PickupKind.Bomb;
        item.value = 0;
      }
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
