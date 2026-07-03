import { TICK_DT } from '../../engine/loop';
import { xpToNext } from '../../data/xp';
import { openChest } from './chestSystem';
import { Ev } from './events';
import { PickupKind, type World } from './world';

const GEM_FLY_SPEED = 480;
const COLLECT_RADIUS = 12;
/** Base pickup attraction radius in px (multiplied by the Magnet stat). */
const BASE_MAGNET_RADIUS = 34;
/** Bombs hit everything within this range of the player. */
const BOMB_RADIUS = 520;
const BOMB_DAMAGE = 200;

export function pickupSystem(world: World): void {
  const p = world.player;
  const magnetR = BASE_MAGNET_RADIUS * p.stats.magnet;

  for (let i = world.gems.count - 1; i >= 0; i--) {
    const gem = world.gems.items[i]!;
    gem.px = gem.x;
    gem.py = gem.y;
    const dx = p.x - gem.x;
    const dy = p.y - gem.y;
    const d2 = dx * dx + dy * dy;

    if (!gem.magnetized && d2 < magnetR * magnetR) gem.magnetized = true;

    if (gem.magnetized) {
      const d = Math.sqrt(d2) || 1;
      gem.x += (dx / d) * GEM_FLY_SPEED * TICK_DT;
      gem.y += (dy / d) * GEM_FLY_SPEED * TICK_DT;
    }

    if (d2 < COLLECT_RADIUS * COLLECT_RADIUS) {
      gainXp(world, gem.value);
      world.events.emit(Ev.GemPicked, gem.x, gem.y, gem.value, 0);
      world.gems.free(i);
    }
  }

  // Map pickups (chest/food/coin/vacuum/bomb) — touch to collect.
  const touchR = Math.max(magnetR, 20);
  for (let i = world.pickups.count - 1; i >= 0; i--) {
    const item = world.pickups.items[i]!;
    const dx = p.x - item.x;
    const dy = p.y - item.y;
    if (dx * dx + dy * dy > touchR * touchR) continue;
    switch (item.kind) {
      case PickupKind.Chest:
        openChest(world);
        break;
      case PickupKind.Food:
        p.hp = Math.min(p.stats.maxHp, p.hp + item.value);
        break;
      case PickupKind.Coin:
        p.gold += Math.round(item.value * p.stats.greed);
        world.events.emit(Ev.GoldGained, item.x, item.y, item.value, 0);
        break;
      case PickupKind.Vacuum:
        for (let g = 0; g < world.gems.count; g++) world.gems.items[g]!.magnetized = true;
        break;
      case PickupKind.Bomb: {
        for (let e = world.enemies.count - 1; e >= 0; e--) {
          const enemy = world.enemies.items[e]!;
          const bx = enemy.x - p.x;
          const by = enemy.y - p.y;
          if (bx * bx + by * by < BOMB_RADIUS * BOMB_RADIUS && !enemy.boss) {
            enemy.hp -= BOMB_DAMAGE;
            enemy.hitFlash = 6;
            if (enemy.hp <= 0) {
              world.events.emit(Ev.EnemyDied, enemy.x, enemy.y, enemy.typeIdx, 0);
              p.kills++;
              world.enemies.free(e);
            }
          }
        }
        break;
      }
    }
    world.events.emit(Ev.PickupTaken, item.x, item.y, item.kind, 0);
    world.pickups.free(i);
  }
}

export function gainXp(world: World, value: number): void {
  const p = world.player;
  p.xp += value * p.stats.growth;
  while (p.xp >= p.xpNeeded) {
    p.xp -= p.xpNeeded;
    p.level++;
    p.xpNeeded = xpToNext(p.level);
    p.pendingLevelUps++;
    world.events.emit(Ev.LevelUp, p.x, p.y, p.level, 0);
  }
}
