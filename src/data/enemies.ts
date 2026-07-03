import type { EnemyDef } from './types';

/**
 * Enemy roster (MECHANICS.md §2). VS-style escalation: each minute band
 * introduces tougher TYPES (stats live here, not on a global curve);
 * Curse scales HP/quantity at spawn. xp = gem value dropped.
 */
export const ENEMIES = {
  // --- minutes 0-4: the night begins
  hitodama: { name: '人魂', sprite: 'enemy_hitodama', hp: 3, speed: 42, damage: 3, radius: 8, xp: 1, knockbackResist: 0 },
  chochin: { name: '提灯お化け', sprite: 'enemy_chochin', hp: 8, speed: 34, damage: 5, radius: 10, xp: 1, knockbackResist: 0 },
  // --- minutes 2-8
  kasa: { name: '傘お化け', sprite: 'enemy_kasa', hp: 12, speed: 55, damage: 6, radius: 9, xp: 2, knockbackResist: 0 },
  yosuzume: { name: '夜雀', sprite: 'enemy_yosuzume', hp: 2, speed: 75, damage: 4, radius: 7, xp: 1, knockbackResist: 0 },
  hitotsume: { name: '一つ目小僧', sprite: 'enemy_hitotsume', hp: 25, speed: 38, damage: 8, radius: 11, xp: 2, knockbackResist: 0.1 },
  // --- minutes 5-12
  gaikotsu: { name: '骸骨', sprite: 'enemy_gaikotsu', hp: 35, speed: 44, damage: 9, radius: 10, xp: 3, knockbackResist: 0.1 },
  onibi: { name: '鬼火', sprite: 'enemy_onibi', hp: 18, speed: 88, damage: 7, radius: 8, xp: 2, knockbackResist: 0 },
  kappa: { name: '河童', sprite: 'enemy_kappa', hp: 60, speed: 40, damage: 11, radius: 11, xp: 4, knockbackResist: 0.2 },
  // --- minutes 10-19
  tsuchigumo: { name: '土蜘蛛', sprite: 'enemy_tsuchigumo', hp: 90, speed: 52, damage: 13, radius: 13, xp: 5, knockbackResist: 0.2 },
  hannya: { name: '般若', sprite: 'enemy_hannya', hp: 130, speed: 58, damage: 16, radius: 11, xp: 6, knockbackResist: 0.3 },
  nurikabe: { name: '塗壁', sprite: 'enemy_nurikabe', hp: 400, speed: 22, damage: 18, radius: 16, xp: 10, knockbackResist: 0.8 },
  // --- minutes 15-24
  tengu: { name: '天狗', sprite: 'enemy_tengu', hp: 200, speed: 72, damage: 18, radius: 12, xp: 8, knockbackResist: 0.3 },
  omukade: { name: '大百足', sprite: 'enemy_omukade', hp: 350, speed: 48, damage: 22, radius: 15, xp: 12, knockbackResist: 0.5 },
  // --- minutes 21-30
  nue: { name: '鵺', sprite: 'enemy_nue', hp: 550, speed: 62, damage: 26, radius: 14, xp: 16, knockbackResist: 0.5 },
  oni: { name: '鬼', sprite: 'enemy_oni', hp: 900, speed: 55, damage: 32, radius: 16, xp: 25, knockbackResist: 0.6 },
  // --- minibosses (wave `boss` field; drop a chest). Fast enough to stay
  // on the player — VS elites are pushers, not stragglers.
  gashadokuro: { name: 'がしゃどくろ', sprite: 'boss_gashadokuro', hp: 900, speed: 120, damage: 20, radius: 24, xp: 50, knockbackResist: 1 },
  shuten: { name: '酒呑童子', sprite: 'boss_shuten', hp: 2600, speed: 121, damage: 55, radius: 22, xp: 100, knockbackResist: 1 },
  // --- the dawn sweeper (minute 30, unkillable — VS Reaper mirror)
  akatsuki: { name: '夜明けの光', sprite: 'boss_akatsuki', hp: 655350, speed: 160, damage: 9999, radius: 20, xp: 0, knockbackResist: 1 },
} as const satisfies Record<string, EnemyDef>;

export type EnemyId = keyof typeof ENEMIES;

export const ENEMY_IDS = Object.keys(ENEMIES) as EnemyId[];

/** Dense array view for index-based sim access (typeIdx fields). */
export const ENEMY_LIST: readonly EnemyDef[] = ENEMY_IDS.map((id) => ENEMIES[id]);
