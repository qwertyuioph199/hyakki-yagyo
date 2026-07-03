import type { PassiveDef } from './types';

/**
 * Passive item tables (MECHANICS.md §5). Functional mirrors of the VS
 * passives that gate our evolutions, re-themed:
 *   Spinach→神饌の米, Empty Tome→写経, Hollow Heart→勾玉, Pummarola→薬湯,
 *   Candelabrador→大提灯, Bracer→絵馬, Spellbinder→注連縄, Duplicator→分身の術,
 *   Attractorb→磁鉄鉱, Clover→招き猫, Crown→冠, Stone Mask→能面, Skull→呪詛.
 */
export const PASSIVES = {
  sacredRice: {
    name: '神饌の米',
    desc: '与ダメージ +10%',
    sprite: 'item_rice',
    stat: 'might',
    perLevel: 0.1,
    maxLevel: 5,
    weight: 100,
  },
  sutra: {
    name: '写経',
    desc: 'クールダウン -8%',
    sprite: 'item_sutra',
    stat: 'cooldown',
    perLevel: -0.08,
    maxLevel: 5,
    weight: 100,
  },
  magatama: {
    name: '勾玉',
    desc: '最大HP +20%',
    sprite: 'item_magatama',
    stat: 'maxHp',
    perLevel: 0.2,
    maxLevel: 3,
    weight: 100,
  },
  herbalTea: {
    name: '薬湯',
    desc: '毎秒HP回復 +0.2',
    sprite: 'item_tea',
    stat: 'recovery',
    perLevel: 0.2,
    maxLevel: 5,
    weight: 100,
  },
  grandLantern: {
    name: '大提灯',
    desc: '攻撃範囲 +10%',
    sprite: 'item_lantern',
    stat: 'area',
    perLevel: 0.1,
    maxLevel: 5,
    weight: 100,
  },
  ema: {
    name: '絵馬',
    desc: '弾速 +10%',
    sprite: 'item_ema',
    stat: 'speed',
    perLevel: 0.1,
    maxLevel: 5,
    weight: 100,
  },
  shimenawa: {
    name: '注連縄',
    desc: '効果時間 +10%',
    sprite: 'item_shimenawa',
    stat: 'duration',
    perLevel: 0.1,
    maxLevel: 5,
    weight: 100,
  },
  bunshin: {
    name: '分身の術',
    desc: '投射物 +1',
    sprite: 'item_bunshin',
    stat: 'amount',
    perLevel: 1,
    maxLevel: 2,
    weight: 100,
  },
  lodestone: {
    name: '磁鉄鉱',
    desc: '取得範囲 +50%',
    sprite: 'item_lodestone',
    stat: 'magnet',
    perLevel: 0.5,
    maxLevel: 5,
    weight: 100,
  },
  manekiNeko: {
    name: '招き猫',
    desc: '運 +10%',
    sprite: 'item_maneki',
    stat: 'luck',
    perLevel: 0.1,
    maxLevel: 5,
    weight: 100,
  },
  kanmuri: {
    name: '冠',
    desc: '経験値 +8%',
    sprite: 'item_kanmuri',
    stat: 'growth',
    perLevel: 0.08,
    maxLevel: 5,
    weight: 100,
  },
  nohMask: {
    name: '能面',
    desc: '金 +10%',
    sprite: 'item_noh',
    stat: 'greed',
    perLevel: 0.1,
    maxLevel: 5,
    weight: 100,
  },
  juso: {
    name: '呪詛',
    desc: '呪い +10%(敵が強くなる)',
    sprite: 'item_juso',
    stat: 'curse',
    perLevel: 0.1,
    maxLevel: 5,
    weight: 100,
  },
} as const satisfies Record<string, PassiveDef>;

export type PassiveId = keyof typeof PASSIVES;

export const PASSIVE_IDS = Object.keys(PASSIVES) as PassiveId[];
