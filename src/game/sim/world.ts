import { CHARACTERS, type CharacterId } from '../../data/characters';
import { STAGES, type StageId } from '../../data/stages';
import type { CharacterDef, Stats, WaveDef } from '../../data/types';
import { xpToNext } from '../../data/xp';
import { Pool } from '../../engine/pool';
import { Rng } from '../../engine/rng';
import { SpatialHash } from '../../engine/spatialHash';
import { EventQueue } from './events';
import { aggregateStats } from './statSystem';

/**
 * RunState + createRun/stepRun are the frozen heart of the game. This module
 * (and everything under src/game/sim) is headless: no DOM, no renderer, no
 * audio, no Math.random — vitest and the bot harness step full 30-minute
 * runs in Node.
 */

export const CAP = {
  enemies: 600,
  projectiles: 400,
  gems: 300,
  pickups: 64,
} as const;

export interface Enemy {
  uid: number;
  x: number;
  y: number;
  px: number;
  py: number;
  /** Knockback velocity (decays). */
  kx: number;
  ky: number;
  hp: number;
  maxHp: number;
  typeIdx: number;
  speed: number;
  damage: number;
  radius: number;
  xp: number;
  knockbackResist: number;
  /** Ticks of white hit-flash remaining (read by presentation). */
  hitFlash: number;
  /** Minibosses drop a chest and ignore knockback/despawn recycling. */
  boss: boolean;
  /**
   * Per-weapon-slot re-hit gate (VS "hitbox delay"): persistent weapons
   * (orbit/aura/zone/whip) may damage this enemy again only when
   * world.tick >= hitUntil[weaponIdx]. Fixed 6 slots = MAX_WEAPONS.
   */
  hitUntil: Int32Array;
}

export const enum ProjKind {
  /** Ballistic: straight line, dies after `pierce` distinct enemies. */
  Ballistic = 0,
  /** Falls with gravity (axe-like); ballistic hit rules. */
  ArcLob = 1,
  /** Orbits the player; persistent hit rules (enemy.hitUntil). */
  Orbit = 2,
  /** Flies out then returns (cross-like); persistent hit rules. */
  Boomerang = 3,
  /** Stationary damage zone ticking on an interval. */
  Zone = 4,
  /** Instant melee arc snapshot (whip-like); persistent hit rules. */
  Slash = 5,
  /** Visual-only bolt (randomStrike damage is applied on spawn). */
  Bolt = 6,
}

export interface Projectile {
  kind: ProjKind;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  damage: number;
  pierce: number;
  knockback: number;
  /** Remaining lifetime in ticks. */
  ttl: number;
  /** Hit radius in px (scaled by Area at spawn). */
  radius: number;
  weaponIdx: number;
  spriteIdx: number;
  /** Kind-specific: orbit angle / boomerang phase / zone tick timer. */
  aux1: number;
  aux2: number;
  /** Ticks between damage applications for persistent kinds. */
  hitInterval: number;
  /** uids of enemies already hit (ballistic kinds only). */
  hit0: number;
  hit1: number;
  hit2: number;
  hit3: number;
  hitCount: number;
}

export interface Gem {
  x: number;
  y: number;
  px: number;
  py: number;
  value: number;
  /** True once inside magnet radius — then it flies to the player. */
  magnetized: boolean;
}

export const enum PickupKind {
  Chest = 0,
  Food = 1,
  Coin = 2,
  Vacuum = 3,
  Bomb = 4,
}

export interface Pickup {
  x: number;
  y: number;
  kind: PickupKind;
  /** Food heal amount / coin value. */
  value: number;
}

export interface DraftChoice {
  kind: 'weapon' | 'passive' | 'gold' | 'food';
  id: string;
  /** Resulting level if taken (1 = new item). */
  toLevel: number;
}

export interface ChestRevealItem {
  sprite: string;
  name: string;
  sub: string;
}

/** Pending treasure-chest opening (freezes the sim until dismissed). */
export interface ChestReveal {
  items: ChestRevealItem[];
  gold: number;
  /** 1–5 — number of powers, drives the fanfare intensity. */
  tier: number;
}

export interface WeaponInstance {
  id: string;
  level: number;
  /** Ticks until the next firing cycle. */
  cooldown: number;
  /** Intra-cycle state (burst index, orbit angle...). */
  state: number;
}

export interface PassiveInstance {
  id: string;
  level: number;
}

export interface PlayerState {
  x: number;
  y: number;
  px: number;
  py: number;
  hp: number;
  level: number;
  /** XP accumulated toward the next level. */
  xp: number;
  xpNeeded: number;
  gold: number;
  kills: number;
  /** Last non-zero movement direction (aim for aimed weapons). */
  dirX: number;
  dirY: number;
  /** Ticks of post-hit invulnerability remaining. */
  iframes: number;
  /** Fractional HP regen accumulator. */
  regenAcc: number;
  stats: Stats;
  weapons: WeaponInstance[];
  passives: PassiveInstance[];
  /** Level-ups earned but not yet resolved by the draft UI. */
  pendingLevelUps: number;
}

export interface World {
  tick: number;
  rng: Rng;
  player: PlayerState;
  enemies: Pool<Enemy>;
  projectiles: Pool<Projectile>;
  gems: Pool<Gem>;
  pickups: Pool<Pickup>;
  enemyHash: SpatialHash;
  events: EventQueue;
  /** Shared neighbor-query scratch buffer. */
  scratch: Int32Array;
  nextEnemyUid: number;
  gameOver: boolean;
  victory: boolean;
  /** Ticks between spawn batches (wave interpreter state). */
  spawnTimer: number;
  /** Last minute whose one-shot events (swarm/boss) fired. */
  waveMinute: number;
  /** Current level-up draft (generated lazily while pendingLevelUps > 0). */
  draft: DraftChoice[] | null;
  /** Pending chest opening; freezes the sim until the UI/bot dismisses it. */
  chestReveal: ChestReveal | null;
  /** Item ids banished from this run's draft pool. */
  banished: string[];
  /** Stat-source config, needed whenever stats are recomputed mid-run. */
  charDef: CharacterDef;
  powerUpBonuses: Partial<Stats> | null;
  /** Stage identity + its wave table (presentation looks colors up by id). */
  stageId: StageId;
  waves: readonly WaveDef[];
}

export function baseStats(): Stats {
  return {
    might: 1,
    armor: 0,
    maxHp: 100,
    recovery: 0,
    cooldown: 1,
    area: 1,
    speed: 1,
    duration: 1,
    amount: 0,
    moveSpeed: 1,
    magnet: 40,
    luck: 1,
    growth: 1,
    greed: 1,
    curse: 1,
    revival: 0,
    reroll: 0,
    skip: 0,
    banish: 0,
  };
}

export interface RunConfig {
  seed: number;
  /** Playable character (default: onmyoji). */
  characterId?: CharacterId;
  /** Aggregated PowerUp stat bonuses from the meta shop. */
  powerUpBonuses?: Partial<Stats>;
  /** Stage (default: mori). */
  stageId?: StageId;
}

export function createRun(config: RunConfig): World {
  const charDef = CHARACTERS[config.characterId ?? 'onmyoji'];
  const stageId = config.stageId ?? 'mori';
  const powerUps = config.powerUpBonuses ?? null;
  const stats = aggregateStats(charDef, [], powerUps);
  return {
    tick: 0,
    rng: new Rng(config.seed),
    player: {
      x: 0,
      y: 0,
      px: 0,
      py: 0,
      hp: stats.maxHp,
      level: 1,
      xp: 0,
      xpNeeded: xpToNext(1),
      gold: 0,
      kills: 0,
      dirX: 1,
      dirY: 0,
      iframes: 0,
      regenAcc: 0,
      stats,
      weapons: [{ id: charDef.startingWeapon, level: 1, cooldown: 30, state: 0 }],
      passives: [],
      pendingLevelUps: 0,
    },
    enemies: new Pool<Enemy>(CAP.enemies, () => ({
      uid: 0,
      x: 0,
      y: 0,
      px: 0,
      py: 0,
      kx: 0,
      ky: 0,
      hp: 1,
      maxHp: 1,
      typeIdx: 0,
      speed: 0,
      damage: 0,
      radius: 8,
      xp: 1,
      knockbackResist: 0,
      hitFlash: 0,
      boss: false,
      hitUntil: new Int32Array(6),
    })),
    projectiles: new Pool<Projectile>(CAP.projectiles, () => ({
      kind: 0 as Projectile['kind'],
      x: 0,
      y: 0,
      px: 0,
      py: 0,
      vx: 0,
      vy: 0,
      damage: 0,
      pierce: 0,
      knockback: 0,
      ttl: 0,
      radius: 10,
      weaponIdx: 0,
      spriteIdx: 0,
      aux1: 0,
      aux2: 0,
      hitInterval: 0,
      hit0: -1,
      hit1: -1,
      hit2: -1,
      hit3: -1,
      hitCount: 0,
    })),
    gems: new Pool<Gem>(CAP.gems, () => ({ x: 0, y: 0, px: 0, py: 0, value: 1, magnetized: false })),
    pickups: new Pool<Pickup>(CAP.pickups, () => ({ x: 0, y: 0, kind: PickupKind.Chest, value: 0 })),
    enemyHash: new SpatialHash(48, CAP.enemies),
    events: new EventQueue(),
    scratch: new Int32Array(64),
    nextEnemyUid: 1,
    gameOver: false,
    victory: false,
    spawnTimer: 0,
    waveMinute: -1,
    draft: null,
    chestReveal: null,
    banished: [],
    charDef,
    powerUpBonuses: powerUps,
    stageId,
    waves: STAGES[stageId].waves,
  };
}
