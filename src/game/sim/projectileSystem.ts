import { TICK_DT } from '../../engine/loop';
import { Ev } from './events';
import { PickupKind, ProjKind, type Enemy, type World } from './world';

/**
 * Projectile motion + collision (MECHANICS.md §4).
 * Two hit disciplines:
 * - Ballistic kinds (Ballistic/ArcLob) hit each enemy once (uid ring) and
 *   die after `pierce` distinct enemies.
 * - Persistent kinds (Orbit/Boomerang/Zone/Slash) damage through the
 *   enemy.hitUntil[weaponIdx] re-hit gate and never consume pierce.
 * - Bolt is visual-only (its damage was applied on spawn).
 */
const ARC_GRAVITY = 900;

export function projectileSystem(world: World): void {
  const projs = world.projectiles;
  const p = world.player;

  for (let i = projs.count - 1; i >= 0; i--) {
    const proj = projs.items[i]!;
    proj.px = proj.x;
    proj.py = proj.y;
    proj.ttl--;
    if (proj.ttl <= 0) {
      projs.free(i);
      continue;
    }

    switch (proj.kind) {
      case ProjKind.Ballistic:
        proj.x += proj.vx * TICK_DT;
        proj.y += proj.vy * TICK_DT;
        break;
      case ProjKind.ArcLob:
        proj.vy += ARC_GRAVITY * TICK_DT;
        proj.x += proj.vx * TICK_DT;
        proj.y += proj.vy * TICK_DT;
        break;
      case ProjKind.Orbit: {
        // Reposition around the player each tick.
        proj.aux1 += 3.4 * TICK_DT;
        proj.x = p.x + Math.cos(proj.aux1) * proj.aux2;
        proj.y = p.y + Math.sin(proj.aux1) * proj.aux2;
        break;
      }
      case ProjKind.Boomerang: {
        // Linear velocity reversal over the lifetime: out, stall, return.
        const t = 1 - proj.ttl / Math.max(1, proj.aux1); // 0 → 1
        const factor = 1 - 2 * t;
        proj.x += proj.vx * factor * TICK_DT;
        proj.y += proj.vy * factor * TICK_DT;
        break;
      }
      case ProjKind.Zone:
      case ProjKind.Slash:
      case ProjKind.Bolt:
        break;
    }

    if (proj.kind === ProjKind.Bolt) continue;

    const isBallistic = proj.kind === ProjKind.Ballistic || proj.kind === ProjKind.ArcLob;
    // Persistent kinds check every tick, but the per-enemy hitUntil gate
    // limits actual damage frequency to hitInterval.
    const n = world.enemyHash.query(proj.x, proj.y, proj.radius + 24, world.scratch);
    let died = false;
    for (let k = 0; k < n; k++) {
      const ei = world.scratch[k]!;
      if (ei >= world.enemies.count) continue;
      const enemy = world.enemies.items[ei]!;
      const dx = enemy.x - proj.x;
      const dy = enemy.y - proj.y;
      const hitR = proj.radius + enemy.radius;
      if (dx * dx + dy * dy > hitR * hitR) continue;

      if (isBallistic) {
        if (alreadyHit(proj, enemy.uid)) continue;
        rememberHit(proj, enemy.uid);
        damageEnemyContact(world, ei, enemy, proj.damage, proj.weaponIdx, proj.knockback, 0);
        if (proj.hitCount >= proj.pierce) {
          projs.free(i);
          died = true;
          break;
        }
      } else {
        if (world.tick < enemy.hitUntil[proj.weaponIdx]!) continue;
        enemy.hitUntil[proj.weaponIdx] = world.tick + proj.hitInterval;
        damageEnemyContact(world, ei, enemy, proj.damage, proj.weaponIdx, proj.knockback, 0);
      }
    }
    if (died) continue;
  }
}

function alreadyHit(p: { hit0: number; hit1: number; hit2: number; hit3: number }, uid: number): boolean {
  return p.hit0 === uid || p.hit1 === uid || p.hit2 === uid || p.hit3 === uid;
}

function rememberHit(
  p: { hit0: number; hit1: number; hit2: number; hit3: number; hitCount: number },
  uid: number,
): void {
  const slot = p.hitCount % 4;
  if (slot === 0) p.hit0 = uid;
  else if (slot === 1) p.hit1 = uid;
  else if (slot === 2) p.hit2 = uid;
  else p.hit3 = uid;
  p.hitCount++;
}

/**
 * Shared damage entry point for projectiles, auras and strikes.
 * Handles hit flash, knockback, death (gems / boss chests), and events.
 */
export function damageEnemyContact(
  world: World,
  enemyIdx: number,
  enemy: Enemy,
  damage: number,
  weaponIdx: number,
  knockback: number,
  _flags: number,
): void {
  enemy.hp -= damage;
  enemy.hitFlash = 6;
  world.events.emit(Ev.DamageDealt, enemy.x, enemy.y, damage, weaponIdx);

  if (knockback > 0 && enemy.knockbackResist < 1) {
    const dx = enemy.x - world.player.x;
    const dy = enemy.y - world.player.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const kb = 90 * knockback * (1 - enemy.knockbackResist);
    enemy.kx += (dx / d) * kb;
    enemy.ky += (dy / d) * kb;
  }

  if (enemy.hp <= 0) {
    world.events.emit(Ev.EnemyDied, enemy.x, enemy.y, enemy.typeIdx, 0);
    world.player.kills++;
    if (enemy.boss) {
      const chest = world.pickups.alloc();
      if (chest) {
        chest.x = enemy.x;
        chest.y = enemy.y;
        chest.kind = PickupKind.Chest;
        chest.value = 0;
        world.events.emit(Ev.ChestSpawned, enemy.x, enemy.y, 0, 0);
      }
    } else {
      spawnGem(world, enemy.x, enemy.y, enemy.xp);
      rollEnemyDrop(world, enemy.x, enemy.y);
    }
    world.enemies.free(enemyIdx);
  }
}

const COIN_DROP_CHANCE = 0.02;
const FOOD_DROP_CHANCE = 0.008;
const CHEST_DROP_CHANCE = 0.0025;

/**
 * On a trash-enemy kill, roll (once, luck-scaled) for a bonus drop:
 * coin > food (回復) > treasure chest. Bosses always drop a chest instead.
 */
function rollEnemyDrop(world: World, x: number, y: number): void {
  const luck = world.player.stats.luck;
  const r = world.rng.next();
  if (r < CHEST_DROP_CHANCE * luck) {
    const chest = world.pickups.alloc();
    if (chest) {
      chest.x = x;
      chest.y = y;
      chest.kind = PickupKind.Chest;
      chest.value = 0;
      world.events.emit(Ev.ChestSpawned, x, y, 0, 0);
    }
  } else if (r < (CHEST_DROP_CHANCE + FOOD_DROP_CHANCE) * luck) {
    const food = world.pickups.alloc();
    if (food) {
      food.x = x;
      food.y = y;
      food.kind = PickupKind.Food;
      food.value = Math.max(30, Math.round(world.player.stats.maxHp * 0.3));
    }
  } else if (r < (CHEST_DROP_CHANCE + FOOD_DROP_CHANCE + COIN_DROP_CHANCE) * luck) {
    const coin = world.pickups.alloc();
    if (coin) {
      coin.x = x;
      coin.y = y;
      coin.kind = PickupKind.Coin;
      coin.value = 1 + world.rng.int(3);
    }
  }
}

export function spawnGem(world: World, x: number, y: number, value: number): void {
  const gem = world.gems.alloc();
  if (!gem) {
    // Pool exhausted: fold the value into an existing gem (RE §1 merge rule,
    // simplified to the first slot).
    if (world.gems.count > 0) world.gems.items[0]!.value += value;
    return;
  }
  gem.x = gem.px = x;
  gem.y = gem.py = y;
  gem.value = value;
  gem.magnetized = false;
  world.events.emit(Ev.GemSpawned, x, y, value, 0);
}
