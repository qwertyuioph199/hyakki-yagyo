import type { EnemyDef } from './types';

/**
 * Enemy roster (MECHANICS.md §2). VS-style escalation: each minute band
 * introduces tougher TYPES (stats live here, not on a global curve);
 * Curse scales HP/quantity at spawn. xp = gem value dropped.
 */
export const ENEMIES = {
  // Overall tuning (v1.1.7): regular enemies ~15% weaker HP and ~13% slower,
  // to support a much denser "swarm" feel without spiking incoming DPS.
  // --- minutes 0-4: the night begins
  hitodama: { name: '人魂', sprite: 'enemy_hitodama', hp: 3, speed: 37, damage: 3, radius: 8, xp: 1, knockbackResist: 0 },
  chochin: { name: '提灯お化け', sprite: 'enemy_chochin', hp: 7, speed: 30, damage: 5, radius: 10, xp: 1, knockbackResist: 0 },
  // --- minutes 2-8
  kasa: { name: '傘お化け', sprite: 'enemy_kasa', hp: 10, speed: 48, damage: 6, radius: 9, xp: 2, knockbackResist: 0 },
  yosuzume: { name: '夜雀', sprite: 'enemy_yosuzume', hp: 2, speed: 65, damage: 4, radius: 7, xp: 1, knockbackResist: 0 },
  hitotsume: { name: '一つ目小僧', sprite: 'enemy_hitotsume', hp: 21, speed: 33, damage: 8, radius: 11, xp: 2, knockbackResist: 0.1 },
  // --- minutes 5-12
  gaikotsu: { name: '骸骨', sprite: 'enemy_gaikotsu', hp: 30, speed: 38, damage: 9, radius: 10, xp: 3, knockbackResist: 0.1 },
  onibi: { name: '鬼火', sprite: 'enemy_onibi', hp: 15, speed: 76, damage: 7, radius: 8, xp: 2, knockbackResist: 0 },
  kappa: { name: '河童', sprite: 'enemy_kappa', hp: 51, speed: 35, damage: 11, radius: 11, xp: 4, knockbackResist: 0.2 },
  // --- minutes 10-19
  tsuchigumo: { name: '土蜘蛛', sprite: 'enemy_tsuchigumo', hp: 76, speed: 45, damage: 13, radius: 13, xp: 5, knockbackResist: 0.2 },
  hannya: { name: '般若', sprite: 'enemy_hannya', hp: 110, speed: 50, damage: 15, radius: 11, xp: 6, knockbackResist: 0.3 },
  nurikabe: { name: '塗壁', sprite: 'enemy_nurikabe', hp: 340, speed: 20, damage: 17, radius: 16, xp: 10, knockbackResist: 0.8 },
  // --- minutes 15-24
  tengu: { name: '天狗', sprite: 'enemy_tengu', hp: 170, speed: 63, damage: 17, radius: 12, xp: 8, knockbackResist: 0.3 },
  omukade: { name: '大百足', sprite: 'enemy_omukade', hp: 300, speed: 42, damage: 21, radius: 15, xp: 12, knockbackResist: 0.5 },
  // --- minutes 21-30
  nue: { name: '鵺', sprite: 'enemy_nue', hp: 470, speed: 54, damage: 25, radius: 14, xp: 16, knockbackResist: 0.5 },
  oni: { name: '鬼', sprite: 'enemy_oni', hp: 765, speed: 48, damage: 30, radius: 16, xp: 25, knockbackResist: 0.6 },
  // --- minibosses (wave `boss` field; drop a chest). Fast enough to stay
  // on the player — VS elites are pushers, not stragglers.
  gashadokuro: { name: 'がしゃどくろ', sprite: 'boss_gashadokuro', hp: 860, speed: 110, damage: 20, radius: 24, xp: 50, knockbackResist: 1 },
  shuten: { name: '酒呑童子', sprite: 'boss_shuten', hp: 2450, speed: 112, damage: 52, radius: 22, xp: 100, knockbackResist: 1 },
  // --- stage 2 雪女の峠 exclusives
  yukinko: { name: '雪ん子', sprite: 'enemy_yukinko', hp: 5, speed: 59, damage: 5, radius: 8, xp: 1, knockbackResist: 0 },
  yukionna: { name: '雪女', sprite: 'boss_yukionna', hp: 1550, speed: 110, damage: 29, radius: 20, xp: 80, knockbackResist: 1 },
  // --- the dawn sweeper (minute 30, unkillable — VS Reaper mirror)
  akatsuki: { name: '夜明けの光', sprite: 'boss_akatsuki', hp: 655350, speed: 160, damage: 9999, radius: 20, xp: 0, knockbackResist: 1 },
} as const satisfies Record<string, EnemyDef>;

export type EnemyId = keyof typeof ENEMIES;

export const ENEMY_IDS = Object.keys(ENEMIES) as EnemyId[];

/** Dense array view for index-based sim access (typeIdx fields). */
export const ENEMY_LIST: readonly EnemyDef[] = ENEMY_IDS.map((id) => ENEMIES[id]);
