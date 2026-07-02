import { TICK_DT } from '../../engine/loop';
import { xpToNext } from '../../data/xp';
import { Ev } from './events';
import type { World } from './world';

const GEM_FLY_SPEED = 480;
const COLLECT_RADIUS = 12;

export function pickupSystem(world: World): void {
  const p = world.player;
  const magnetR = p.stats.magnet;

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
