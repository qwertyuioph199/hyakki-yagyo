import { TICK_RATE } from '../../engine/loop';
import type { WeaponLevelDelta } from '../../data/types';
import { WEAPONS, type WeaponId } from '../../data/weapons';
import { Ev } from './events';
import type { World } from './world';

/**
 * Fires weapons when their cooldown elapses. P2 implements the
 * aimedProjectile archetype; the other 7 behaviors land in P4.
 * Cooldown formula (RE, MECHANICS.md §4): base * cooldownMult, floored at
 * 20% of base. Projectile count = weapon amount + Amount stat.
 */
export function weaponSystem(world: World): void {
  const p = world.player;
  for (let w = 0; w < p.weapons.length; w++) {
    const inst = p.weapons[w]!;
    if (inst.cooldown > 0) {
      inst.cooldown--;
      continue;
    }
    const def = WEAPONS[inst.id as WeaponId];
    const lv = collectLevels(inst.id as WeaponId, inst.level);
    const cooldownTicks = Math.max(
      def.cooldown * 0.2 * TICK_RATE,
      def.cooldown * p.stats.cooldown * TICK_RATE,
    );
    inst.cooldown = Math.round(cooldownTicks);

    const count = def.amount + lv.amount + p.stats.amount;
    switch (def.behavior) {
      case 'aimedProjectile':
        fireAimed(world, w, count, lv.damage, lv.area, def);
        break;
      default:
        // Remaining archetypes are implemented in P4.
        break;
    }
    world.events.emit(Ev.WeaponFired, p.x, p.y, w, 0);
  }
}

interface LevelTotals {
  damage: number;
  amount: number;
  area: number;
  speed: number;
  duration: number;
  pierce: number;
}

/** Sum level deltas up to `level` (level 1 = base, levels[0] applies at 2). */
export function collectLevels(id: WeaponId, level: number): LevelTotals {
  const def = WEAPONS[id];
  const t: LevelTotals = { damage: 0, amount: 0, area: 0, speed: 0, duration: 0, pierce: 0 };
  for (let i = 0; i < level - 1 && i < def.levels.length; i++) {
    const d: WeaponLevelDelta = def.levels[i]!;
    t.damage += d.damage ?? 0;
    t.amount += d.amount ?? 0;
    t.area += d.area ?? 0;
    t.speed += d.speed ?? 0;
    t.duration += d.duration ?? 0;
    t.pierce += d.pierce ?? 0;
  }
  return t;
}

const PROJECTILE_BASE_SPEED = 420;
/** Successive projectiles in one volley fan out by this angle. */
const VOLLEY_SPREAD = 0.16;

/** VS Magic Wand rule: auto-aim the nearest enemy, else the facing dir. */
function nearestEnemyAngle(world: World): number {
  const p = world.player;
  let best = Infinity;
  let bx = 0;
  let by = 0;
  for (let i = 0; i < world.enemies.count; i++) {
    const e = world.enemies.items[i]!;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < best) {
      best = d2;
      bx = dx;
      by = dy;
    }
  }
  if (best === Infinity) return Math.atan2(p.dirY, p.dirX);
  return Math.atan2(by, bx);
}

function fireAimed(
  world: World,
  weaponIdx: number,
  count: number,
  bonusDamage: number,
  _bonusArea: number,
  def: (typeof WEAPONS)[WeaponId],
): void {
  const p = world.player;
  const baseAngle = nearestEnemyAngle(world);
  for (let i = 0; i < count; i++) {
    const proj = world.projectiles.alloc();
    if (!proj) return;
    // Fan: 0, +s, -s, +2s, -2s...
    const k = ((i + 1) >> 1) * (i % 2 === 1 ? 1 : -1);
    const ang = baseAngle + k * VOLLEY_SPREAD;
    const speed = PROJECTILE_BASE_SPEED * def.speed * p.stats.speed;
    proj.x = proj.px = p.x;
    proj.y = proj.py = p.y;
    proj.vx = Math.cos(ang) * speed;
    proj.vy = Math.sin(ang) * speed;
    proj.damage = (def.baseDamage + bonusDamage) * p.stats.might;
    proj.pierce = def.pierce;
    proj.knockback = def.knockback;
    proj.ttl = Math.round(def.duration * p.stats.duration * 60);
    proj.weaponIdx = weaponIdx;
    proj.spriteIdx = 0;
    proj.hit0 = proj.hit1 = proj.hit2 = proj.hit3 = -1;
    proj.hitCount = 0;
  }
}
