import type { PowerUpDef } from './types';

/**
 * PowerUp shop matrix (MECHANICS.md §8) — functional mirror of the VS
 * PowerUp list (ranks/percentages/base costs), re-themed as 護符 (charms).
 */
export const POWERUPS = {
  might: { name: '力の護符', desc: '与ダメージ +5%/位', stat: 'might', perRank: 0.05, maxRank: 5, baseCost: 200, order: 1 },
  armor: { name: '鉄の護符', desc: '被ダメージ -1/位', stat: 'armor', perRank: 1, maxRank: 3, baseCost: 600, order: 2 },
  maxHp: { name: '命の護符', desc: '最大HP +10%/位', stat: 'maxHp', perRank: 0.1, maxRank: 3, baseCost: 200, order: 3 },
  recovery: { name: '癒しの護符', desc: '毎秒回復 +0.1/位', stat: 'recovery', perRank: 0.1, maxRank: 5, baseCost: 300, order: 4 },
  cooldown: { name: '風の護符', desc: 'クールダウン -2.5%/位', stat: 'cooldown', perRank: -0.025, maxRank: 2, baseCost: 900, order: 5 },
  area: { name: '炎の護符', desc: '攻撃範囲 +5%/位', stat: 'area', perRank: 0.05, maxRank: 2, baseCost: 300, order: 6 },
  speed: { name: '矢の護符', desc: '弾速 +10%/位', stat: 'speed', perRank: 0.1, maxRank: 2, baseCost: 300, order: 7 },
  duration: { name: '刻の護符', desc: '効果時間 +15%/位', stat: 'duration', perRank: 0.15, maxRank: 2, baseCost: 300, order: 8 },
  amount: { name: '影の護符', desc: '投射物 +1', stat: 'amount', perRank: 1, maxRank: 1, baseCost: 5000, order: 9 },
  moveSpeed: { name: '脚の護符', desc: '移動速度 +5%/位', stat: 'moveSpeed', perRank: 0.05, maxRank: 2, baseCost: 300, order: 10 },
  magnet: { name: '磁の護符', desc: '取得範囲 +25%/位', stat: 'magnet', perRank: 0.25, maxRank: 2, baseCost: 300, order: 11 },
  luck: { name: '運の護符', desc: '運 +10%/位', stat: 'luck', perRank: 0.1, maxRank: 3, baseCost: 600, order: 12 },
  growth: { name: '智の護符', desc: '経験値 +3%/位', stat: 'growth', perRank: 0.03, maxRank: 5, baseCost: 900, order: 13 },
  greed: { name: '富の護符', desc: '金 +10%/位', stat: 'greed', perRank: 0.1, maxRank: 5, baseCost: 200, order: 14 },
  curse: { name: '呪の護符', desc: '呪い +10%/位(敵強化・報酬増)', stat: 'curse', perRank: 0.1, maxRank: 5, baseCost: 1666, order: 15 },
  revival: { name: '蘇りの護符', desc: '復活 +1', stat: 'revival', perRank: 1, maxRank: 1, baseCost: 10000, order: 16 },
  reroll: { name: '巡りの護符', desc: 'リロール +1/位', stat: 'reroll', perRank: 1, maxRank: 2, baseCost: 5000, order: 17 },
  skip: { name: '見送りの護符', desc: 'スキップ +1/位', stat: 'skip', perRank: 1, maxRank: 2, baseCost: 1000, order: 18 },
  banish: { name: '祓いの護符', desc: 'バニッシュ +1/位', stat: 'banish', perRank: 1, maxRank: 2, baseCost: 3000, order: 19 },
} as const satisfies Record<string, PowerUpDef>;

export type PowerUpId = keyof typeof POWERUPS;

export const POWERUP_IDS = Object.keys(POWERUPS) as PowerUpId[];
