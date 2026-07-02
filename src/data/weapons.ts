import type { WeaponDef } from './types';

/**
 * Weapon tables (P2: ofuda only — P4 fills all 10 + evolutions).
 * Numbers mirror the RE'd original stats documented in MECHANICS.md §4;
 * levels[] are per-level deltas exactly like the wiki tables.
 */
export const WEAPONS = {
  // Whip-equivalent: a talisman slash fired toward the aim direction.
  ofuda: {
    name: '御札',
    desc: '狙った方向へ札を放つ。敵を貫通する。',
    behavior: 'aimedProjectile',
    sprite: 'shot_ofuda',
    baseDamage: 10,
    cooldown: 1.35,
    amount: 1,
    pierce: 3,
    area: 1,
    speed: 1,
    duration: 0.6,
    knockback: 1,
    levels: [
      { amount: 1 },
      { damage: 5 },
      { damage: 5 },
      { damage: 5, area: 0.1 },
      { amount: 1 },
      { damage: 5 },
      { damage: 5, area: 0.1 },
    ],
  },
} as const satisfies Record<string, WeaponDef>;

export type WeaponId = keyof typeof WEAPONS;

export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];
