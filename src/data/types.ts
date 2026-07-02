/**
 * Content-schema contract (frozen at end of P3). Pure types — no logic.
 * All content tables in src/data satisfy these shapes with
 * `as const satisfies`, so IDs become literal unions checked at compile time.
 */

/** The full VS-faithful player stat model (MECHANICS.md §3). */
export interface Stats {
  /** Damage multiplier. 1 = +0%. */
  might: number;
  /** Flat damage reduction per hit. */
  armor: number;
  maxHp: number;
  /** HP regenerated per second. */
  recovery: number;
  /** Weapon cooldown multiplier. 0.9 = 10% faster. */
  cooldown: number;
  /** Area/size multiplier. */
  area: number;
  /** Projectile speed multiplier. */
  speed: number;
  /** Effect duration multiplier. */
  duration: number;
  /** Extra projectiles added to every weapon (flat). */
  amount: number;
  /** Movement speed multiplier. */
  moveSpeed: number;
  /** Pickup attraction radius in px. */
  magnet: number;
  luck: number;
  /** XP gain multiplier. */
  growth: number;
  /** Gold gain multiplier. */
  greed: number;
  /** Enemy speed/hp/quantity multiplier (more risk, more reward). */
  curse: number;
  /** Times the player revives on death. */
  revival: number;
  reroll: number;
  skip: number;
  banish: number;
}

export type StatKey = keyof Stats;

/** The 8 weapon behavior archetypes every weapon maps onto. */
export type WeaponBehavior =
  | 'aimedProjectile'
  | 'orbit'
  | 'aura'
  | 'arcLob'
  | 'boomerang'
  | 'randomStrike'
  | 'zone'
  | 'familiar';

/** Per-level upgrade delta, declared exactly like the VS wiki tables. */
export interface WeaponLevelDelta {
  damage?: number;
  amount?: number;
  cooldown?: number;
  area?: number;
  speed?: number;
  duration?: number;
  pierce?: number;
  knockback?: number;
}

export interface WeaponDef {
  name: string;
  desc: string;
  behavior: WeaponBehavior;
  sprite: string;
  baseDamage: number;
  /** Seconds between firing cycles at cooldown multiplier 1. */
  cooldown: number;
  /** Projectiles per cycle before the Amount stat. */
  amount: number;
  /** Enemies hit before a projectile expires (Infinity = never). */
  pierce: number;
  area: number;
  speed: number;
  /** Seconds a projectile/zone lives (0 = instant or until off-screen). */
  duration: number;
  knockback: number;
  /** Deltas applied when the weapon levels up: levels[0] = level 2. */
  levels: readonly WeaponLevelDelta[];
}

export interface PassiveDef {
  name: string;
  desc: string;
  sprite: string;
  stat: StatKey;
  /** Added to the stat per level. */
  perLevel: number;
  maxLevel: number;
}

export interface EnemyDef {
  name: string;
  sprite: string;
  hp: number;
  speed: number;
  /** Contact damage per hit. */
  damage: number;
  radius: number;
  xp: number;
  knockbackResist: number;
}

export interface CharacterDef {
  name: string;
  desc: string;
  sprite: string;
  startingWeapon: string;
  /** Stat overrides/bonuses relative to base. */
  bonuses: Partial<Stats>;
  baseHp: number;
  baseMoveSpeed: number;
}
