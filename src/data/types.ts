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
  /** Pickup attraction radius multiplier (base radius in pickupSystem). */
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

/** The weapon behavior archetypes every weapon maps onto. */
export type WeaponBehavior =
  | 'aimedProjectile' // fires at the nearest enemy (VS Magic Wand rule)
  | 'directional' // fires along the facing direction (VS Knife rule)
  | 'whipSlash' // instant melee arc, alternating sides (VS Whip rule)
  | 'orbit' // orbs circle the player for a duration (VS King Bible)
  | 'aura' // persistent damage field around the player (VS Garlic)
  | 'arcLob' // heavy projectile thrown upward, falls with gravity (VS Axe)
  | 'boomerang' // flies out and returns (VS Cross)
  | 'randomStrike' // strikes random on-screen enemies (VS Lightning Ring)
  | 'zone'; // lobbed flask leaves a damage zone (VS Santa Water)

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
  /** Draft rarity weight (100 = common). */
  weight: number;
  /** Evolved weapons never appear in the draft. */
  evolutionOnly?: boolean;
  /** aimedProjectile only: target a random enemy instead of the nearest. */
  aimRandom?: boolean;
  /** Seconds between damage ticks for aura/zone behaviors. */
  tickRate?: number;
}

export interface PassiveDef {
  name: string;
  desc: string;
  sprite: string;
  stat: StatKey;
  /** Added to the stat per level. */
  perLevel: number;
  maxLevel: number;
  /** Draft rarity weight (100 = common). */
  weight: number;
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
  /** Gold cost to unlock (0 = starter). */
  unlockCost: number;
}

export interface EvolutionDef {
  /** Base weapon that evolves (must be max level). */
  weapon: string;
  /** Passive that must be owned (any level). */
  requires: string;
  /** The evolved weapon id. */
  into: string;
  /** Earliest run-minute a chest may grant this evolution. */
  minMinute: number;
}

/** One per-minute row of a stage's spawn table. */
export interface WaveDef {
  /** The spawner keeps at least this many enemies alive. */
  minAlive: number;
  /** Ticks between spawn batches. */
  interval: number;
  /** Enemy ids spawning this minute (uniform pick). */
  pool: readonly string[];
  /** Optional one-shot swarm event fired at the start of the minute. */
  swarm?: { enemy: string; count: number; formation: 'wall' | 'ring' };
  /** Optional miniboss spawned at the start of the minute (drops a chest). */
  boss?: string;
}

/** Meta-progression PowerUp (gold shop), mirrors the VS PowerUp matrix. */
export interface PowerUpDef {
  name: string;
  desc: string;
  stat: StatKey;
  perRank: number;
  maxRank: number;
  /** Gold cost of rank 1 (escalation rule in meta/shop.ts). */
  baseCost: number;
  /** Display/purchase order — price escalation counts total ranks bought. */
  order: number;
}
