import type { CharacterDef } from './types';

/** Playable characters: starting weapon + stat identity + unlock cost. */
export const CHARACTERS = {
  onmyoji: {
    name: '安倍 晴光',
    desc: '陰陽師。バランス型。開始武器: 御札',
    sprite: 'char_onmyoji',
    startingWeapon: 'ofuda',
    bonuses: {},
    baseHp: 100,
    baseMoveSpeed: 1,
    unlockCost: 0,
  },
  miko: {
    name: '祓乃 みこと',
    desc: '巫女。与ダメージ+10%。開始武器: 払串',
    sprite: 'char_miko',
    startingWeapon: 'haraigushi',
    bonuses: { might: 0.1 },
    baseHp: 90,
    baseMoveSpeed: 1,
    unlockCost: 200,
  },
  ronin: {
    name: '疾風 甚八',
    desc: '浪人。移動速度+15%、防御+1。開始武器: 苦無',
    sprite: 'char_ronin',
    startingWeapon: 'kunai',
    bonuses: { moveSpeed: 0.15, armor: 1 },
    baseHp: 95,
    baseMoveSpeed: 1,
    unlockCost: 500,
  },
  sohei: {
    name: '鉄壁 弁誉',
    desc: '僧兵。最大HP+30%、毎秒回復+0.5。開始武器: 結界',
    sprite: 'char_sohei',
    startingWeapon: 'kekkai',
    bonuses: { recovery: 0.5 },
    baseHp: 130,
    baseMoveSpeed: 0.95,
    unlockCost: 500,
  },
  kitsune: {
    name: '玉藻 こはく',
    desc: '狐憑き。運+30%。開始武器: 狐火',
    sprite: 'char_kitsune',
    startingWeapon: 'kitsunebi',
    bonuses: { luck: 0.3 },
    baseHp: 85,
    baseMoveSpeed: 1.05,
    unlockCost: 1000,
  },
  kugutsu: {
    name: '傀儡 十兵衛',
    desc: '傀儡師。投射物+1、ただしクールダウン+10%。開始武器: 数珠',
    sprite: 'char_kugutsu',
    startingWeapon: 'juzu',
    bonuses: { amount: 1, cooldown: 0.1 },
    baseHp: 90,
    baseMoveSpeed: 1,
    unlockCost: 5000,
  },
} as const satisfies Record<string, CharacterDef>;

export type CharacterId = keyof typeof CHARACTERS;

export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[];
