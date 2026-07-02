import type { EnemyDef } from './types';

/** Enemy tables (P2: one wisp — P4 fills ~15 types + minibosses + sweeper). */
export const ENEMIES = {
  hitodama: {
    name: '人魂',
    sprite: 'enemy_hitodama',
    hp: 10,
    speed: 42,
    damage: 5,
    radius: 9,
    xp: 1,
    knockbackResist: 0,
  },
} as const satisfies Record<string, EnemyDef>;

export type EnemyId = keyof typeof ENEMIES;

export const ENEMY_IDS = Object.keys(ENEMIES) as EnemyId[];

/** Dense array view for index-based sim access (typeIdx fields). */
export const ENEMY_LIST: readonly EnemyDef[] = ENEMY_IDS.map((id) => ENEMIES[id]);
