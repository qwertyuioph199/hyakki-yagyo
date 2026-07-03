import { TICK_RATE } from '../../engine/loop';
import type { WeaponDef, WeaponLevelDelta } from '../../data/types';
import { WEAPONS, type WeaponId } from '../../data/weapons';
import { Ev } from './events';
import { damageEnemyContact } from './projectileSystem';
import { ProjKind, type World } from './world';

/**
 * Weapon firing (MECHANICS.md §4). Each weapon maps onto one behavior
 * archetype; per-cycle projectile count = weapon amount + level deltas +
 * the Amount stat; damage = (base + deltas) × Might; cooldown = base ×
 * Cooldown stat (floored at 20% of base). Persistent weapons re-hit
 * enemies through enemy.hitUntil gates instead of pierce.
 */
export function weaponSystem(world: World): void {
  const p = world.player;
  for (let w = 0; w < p.weapons.length; w++) {
    const inst = p.weapons[w]!;
    const def: WeaponDef = WEAPONS[inst.id as WeaponId];
    if (!def) continue;
    const lv = collectLevels(inst.id as WeaponId, inst.level);

    if (def.behavior === 'aura') {
      auraTick(world, w, def, lv);
      continue;
    }
    if (def.behavior === 'orbit') {
      orbitControl(world, w, inst, def, lv);
      continue;
    }

    if (inst.cooldown > 0) {
      inst.cooldown--;
      continue;
    }
    inst.cooldown = cooldownTicks(def, lv, p.stats.cooldown);

    const count = def.amount + lv.amount + p.stats.amount;
    switch (def.behavior) {
      case 'aimedProjectile':
        fireAimed(world, w, count, def, lv);
        break;
      case 'directional':
        fireDirectional(world, w, count, def, lv);
        break;
      case 'whipSlash':
        fireSlash(world, w, count, inst, def, lv);
        break;
      case 'arcLob':
        fireArcLob(world, w, count, def, lv);
        break;
      case 'boomerang':
        fireBoomerang(world, w, count, def, lv);
        break;
      case 'randomStrike':
        fireRandomStrike(world, w, count, def, lv);
        break;
      case 'zone':
        fireZone(world, w, count, def, lv);
        break;
      default:
        break;
    }
    world.events.emit(Ev.WeaponFired, p.x, p.y, w, 0);
  }
}

export interface LevelTotals {
  damage: number;
  amount: number;
  area: number;
  speed: number;
  duration: number;
  pierce: number;
  cooldown: number;
  knockback: number;
}

/** Sum level deltas up to `level` (level 1 = base, levels[0] applies at 2). */
export function collectLevels(id: WeaponId, level: number): LevelTotals {
  const def = WEAPONS[id];
  const t: LevelTotals = { damage: 0, amount: 0, area: 0, speed: 0, duration: 0, pierce: 0, cooldown: 0, knockback: 0 };
  for (let i = 0; i < level - 1 && i < def.levels.length; i++) {
    const d: WeaponLevelDelta = def.levels[i]!;
    t.damage += d.damage ?? 0;
    t.amount += d.amount ?? 0;
    t.area += d.area ?? 0;
    t.speed += d.speed ?? 0;
    t.duration += d.duration ?? 0;
    t.pierce += d.pierce ?? 0;
    t.cooldown += d.cooldown ?? 0;
    t.knockback += d.knockback ?? 0;
  }
  return t;
}

function cooldownTicks(def: WeaponDef, lv: LevelTotals, statMult: number): number {
  const base = Math.max(0.05, def.cooldown + lv.cooldown);
  return Math.round(Math.max(base * 0.2, base * statMult) * TICK_RATE);
}

function dmg(world: World, def: WeaponDef, lv: LevelTotals): number {
  return (def.baseDamage + lv.damage) * world.player.stats.might;
}

function areaScale(world: World, def: WeaponDef, lv: LevelTotals): number {
  return (def.area + lv.area) * world.player.stats.area;
}

const BASE_PROJ_SPEED = 420;
const VOLLEY_SPREAD = 0.16;
/** Default re-hit gate for persistent weapons (0.5s, VS-like hitbox delay). */
const DEFAULT_HIT_INTERVAL = 30;
const VIEW_RADIUS = 560;

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
  if (best === Infinity) return Math.atan2(world.player.dirY, world.player.dirX);
  return Math.atan2(by, bx);
}

interface SpawnOpts {
  kind: ProjKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  radius: number;
  aux1?: number;
  aux2?: number;
  hitInterval?: number;
  pierceOverride?: number;
  spriteIdx?: number;
}

function spawn(world: World, weaponIdx: number, def: WeaponDef, lv: LevelTotals, o: SpawnOpts): void {
  const proj = world.projectiles.alloc();
  if (!proj) return;
  proj.kind = o.kind;
  proj.x = proj.px = o.x;
  proj.y = proj.py = o.y;
  proj.vx = o.vx;
  proj.vy = o.vy;
  proj.damage = dmg(world, def, lv);
  proj.pierce = o.pierceOverride ?? def.pierce + lv.pierce;
  proj.knockback = def.knockback + lv.knockback;
  proj.ttl = o.ttl;
  proj.radius = o.radius;
  proj.weaponIdx = weaponIdx;
  proj.spriteIdx = o.spriteIdx ?? 0;
  proj.aux1 = o.aux1 ?? 0;
  proj.aux2 = o.aux2 ?? 0;
  proj.hitInterval = o.hitInterval ?? DEFAULT_HIT_INTERVAL;
  proj.hit0 = proj.hit1 = proj.hit2 = proj.hit3 = -1;
  proj.hitCount = 0;
}

function fireAimed(world: World, w: number, count: number, def: WeaponDef, lv: LevelTotals): void {
  const p = world.player;
  let baseAngle: number;
  if (def.aimRandom && world.enemies.count > 0) {
    const e = world.enemies.items[world.rng.int(world.enemies.count)]!;
    baseAngle = Math.atan2(e.y - p.y, e.x - p.x);
  } else {
    baseAngle = nearestEnemyAngle(world);
  }
  const speed = BASE_PROJ_SPEED * (def.speed + lv.speed) * p.stats.speed;
  for (let i = 0; i < count; i++) {
    const k = ((i + 1) >> 1) * (i % 2 === 1 ? 1 : -1);
    const ang = baseAngle + k * VOLLEY_SPREAD;
    spawn(world, w, def, lv, {
      kind: ProjKind.Ballistic,
      x: p.x,
      y: p.y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      ttl: Math.round((def.duration + lv.duration) * p.stats.duration * TICK_RATE),
      radius: 10 * areaScale(world, def, lv),
    });
  }
}

function fireDirectional(world: World, w: number, count: number, def: WeaponDef, lv: LevelTotals): void {
  const p = world.player;
  const baseAngle = Math.atan2(p.dirY, p.dirX);
  const speed = BASE_PROJ_SPEED * (def.speed + lv.speed) * p.stats.speed;
  for (let i = 0; i < count; i++) {
    // Knife-style: slight parallel offset + tiny stagger, not a fan.
    const side = ((i + 1) >> 1) * (i % 2 === 1 ? 1 : -1);
    const ox = -Math.sin(baseAngle) * side * 10;
    const oy = Math.cos(baseAngle) * side * 10;
    spawn(world, w, def, lv, {
      kind: ProjKind.Ballistic,
      x: p.x + ox,
      y: p.y + oy,
      vx: Math.cos(baseAngle) * speed,
      vy: Math.sin(baseAngle) * speed,
      ttl: Math.round((def.duration + lv.duration) * p.stats.duration * TICK_RATE),
      radius: 8 * areaScale(world, def, lv),
    });
  }
}

function fireSlash(
  world: World,
  w: number,
  count: number,
  inst: { state: number },
  def: WeaponDef,
  lv: LevelTotals,
): void {
  const p = world.player;
  const facing = p.dirX >= 0 ? 1 : -1;
  const r = 55 * areaScale(world, def, lv);
  for (let i = 0; i < count; i++) {
    // Alternate sides per slash in the volley (VS whip: front, then back...).
    const side = (inst.state + i) % 2 === 0 ? 1 : -1;
    spawn(world, w, def, lv, {
      kind: ProjKind.Slash,
      x: p.x + side * facing * (30 + r * 0.5),
      y: p.y - 6,
      vx: 0,
      vy: 0,
      ttl: 10,
      radius: r,
      hitInterval: DEFAULT_HIT_INTERVAL,
      pierceOverride: Number.MAX_SAFE_INTEGER,
      spriteIdx: side * facing > 0 ? 0 : 1,
    });
  }
  inst.state = (inst.state + count) % 2;
}

function orbitControl(
  world: World,
  w: number,
  inst: { cooldown: number; state: number; level: number; id: string },
  def: WeaponDef,
  lv: LevelTotals,
): void {
  // state 1 = orbs deployed; wait for them to expire, then run cooldown.
  if (inst.state === 1) {
    let alive = 0;
    for (let i = 0; i < world.projectiles.count; i++) {
      const proj = world.projectiles.items[i]!;
      if (proj.kind === ProjKind.Orbit && proj.weaponIdx === w) alive++;
    }
    if (alive === 0) {
      inst.state = 0;
      inst.cooldown = cooldownTicks(def, lv, world.player.stats.cooldown);
    }
    return;
  }
  if (inst.cooldown > 0) {
    inst.cooldown--;
    return;
  }
  const p = world.player;
  const count = def.amount + lv.amount + p.stats.amount;
  const ttl = Math.round((def.duration + lv.duration) * p.stats.duration * TICK_RATE);
  for (let i = 0; i < count; i++) {
    spawn(world, w, def, lv, {
      kind: ProjKind.Orbit,
      x: p.x,
      y: p.y,
      vx: 0,
      vy: 0,
      ttl,
      radius: 14 * areaScale(world, def, lv),
      aux1: (i / count) * Math.PI * 2, // phase offset
      aux2: 90 * areaScale(world, def, lv), // orbit radius
      hitInterval: Math.round((def.tickRate ?? 0.4) * TICK_RATE),
      pierceOverride: Number.MAX_SAFE_INTEGER,
    });
  }
  inst.state = 1;
  world.events.emit(Ev.WeaponFired, p.x, p.y, w, 0);
}

function auraTick(world: World, w: number, def: WeaponDef, lv: LevelTotals): void {
  const p = world.player;
  const inst = p.weapons[w]!;
  if (inst.cooldown > 0) {
    inst.cooldown--;
    return;
  }
  inst.cooldown = Math.round((def.tickRate ?? 0.45) * TICK_RATE * Math.max(0.2, p.stats.cooldown));
  const r = 68 * areaScale(world, def, lv);
  const n = world.enemyHash.query(p.x, p.y, r + 20, world.scratch);
  const damage = dmg(world, def, lv);
  for (let k = 0; k < n; k++) {
    const ei = world.scratch[k]!;
    if (ei >= world.enemies.count) continue;
    const e = world.enemies.items[ei]!;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    if (dx * dx + dy * dy > (r + e.radius) * (r + e.radius)) continue;
    damageEnemyContact(world, ei, e, damage, w, def.knockback + lv.knockback, 0);
  }
}

function fireArcLob(world: World, w: number, count: number, def: WeaponDef, lv: LevelTotals): void {
  const p = world.player;
  for (let i = 0; i < count; i++) {
    const dir = world.rng.chance(0.5) ? 1 : -1;
    spawn(world, w, def, lv, {
      kind: ProjKind.ArcLob,
      x: p.x,
      y: p.y,
      vx: dir * world.rng.float(60, 160) * (def.speed + lv.speed) * p.stats.speed,
      vy: -world.rng.float(380, 460),
      ttl: Math.round(2.2 * TICK_RATE),
      radius: 16 * areaScale(world, def, lv),
    });
  }
}

function fireBoomerang(world: World, w: number, count: number, def: WeaponDef, lv: LevelTotals): void {
  const p = world.player;
  const baseAngle = nearestEnemyAngle(world);
  const speed = 520 * (def.speed + lv.speed) * p.stats.speed;
  for (let i = 0; i < count; i++) {
    const ang = baseAngle + i * 0.35;
    const ttl = Math.round(1.6 * (def.duration + lv.duration) * p.stats.duration * TICK_RATE);
    spawn(world, w, def, lv, {
      kind: ProjKind.Boomerang,
      x: p.x,
      y: p.y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      ttl,
      radius: 14 * areaScale(world, def, lv),
      aux1: ttl, // full lifetime (for the reversal curve)
      hitInterval: 18,
      pierceOverride: Number.MAX_SAFE_INTEGER,
    });
  }
}

function fireRandomStrike(world: World, w: number, count: number, def: WeaponDef, lv: LevelTotals): void {
  const p = world.player;
  const damage = dmg(world, def, lv);
  const candidates: number[] = [];
  for (let i = 0; i < world.enemies.count; i++) {
    const e = world.enemies.items[i]!;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    if (dx * dx + dy * dy < VIEW_RADIUS * VIEW_RADIUS) candidates.push(i);
  }
  for (let s = 0; s < count && candidates.length > 0; s++) {
    const pick = world.rng.int(candidates.length);
    const ei = candidates[pick]!;
    candidates.splice(pick, 1);
    if (ei >= world.enemies.count) continue;
    const e = world.enemies.items[ei]!;
    const strikeR = 42 * areaScale(world, def, lv);
    // Bolt visual + splash damage around the strike point.
    spawn(world, w, def, lv, {
      kind: ProjKind.Bolt,
      x: e.x,
      y: e.y,
      vx: 0,
      vy: 0,
      ttl: 12,
      radius: strikeR,
    });
    const n = world.enemyHash.query(e.x, e.y, strikeR + 20, world.scratch);
    for (let k = 0; k < n; k++) {
      const j = world.scratch[k]!;
      if (j >= world.enemies.count) continue;
      const o = world.enemies.items[j]!;
      const dx = o.x - e.x;
      const dy = o.y - e.y;
      if (dx * dx + dy * dy > (strikeR + o.radius) * (strikeR + o.radius)) continue;
      damageEnemyContact(world, j, o, damage, w, def.knockback + lv.knockback, 0);
    }
  }
}

function fireZone(world: World, w: number, count: number, def: WeaponDef, lv: LevelTotals): void {
  const p = world.player;
  for (let i = 0; i < count; i++) {
    // Land near a random on-screen enemy, else a random offset.
    let tx = p.x + world.rng.float(-260, 260);
    let ty = p.y + world.rng.float(-180, 180);
    if (world.enemies.count > 0 && world.rng.chance(0.7)) {
      const e = world.enemies.items[world.rng.int(world.enemies.count)]!;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy < VIEW_RADIUS * VIEW_RADIUS) {
        tx = e.x + world.rng.float(-30, 30);
        ty = e.y + world.rng.float(-30, 30);
      }
    }
    spawn(world, w, def, lv, {
      kind: ProjKind.Zone,
      x: tx,
      y: ty,
      vx: 0,
      vy: 0,
      ttl: Math.round((def.duration + lv.duration) * p.stats.duration * TICK_RATE),
      radius: 52 * areaScale(world, def, lv),
      hitInterval: Math.round((def.tickRate ?? 0.4) * TICK_RATE),
      pierceOverride: Number.MAX_SAFE_INTEGER,
    });
  }
}
