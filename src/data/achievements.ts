import type { SaveData } from '../game/meta/save';
import { CHARACTER_IDS } from './characters';
import { ENEMY_IDS } from './enemies';

/**
 * Achievements (v1.1). `check` runs against the save AFTER a run is banked;
 * run-scoped facts (evolution seen, weapons held...) are folded into
 * save.stats by the run-end hook before evaluation.
 */
export interface AchievementDef {
  name: string;
  desc: string;
  check(save: SaveData): boolean;
}

/** Enemy types that count for the bestiary-complete achievement. */
export const BESTIARY_TARGETS = ENEMY_IDS.filter((id) => id !== 'akatsuki');

export const ACHIEVEMENTS = {
  firstNight: {
    name: '初陣',
    desc: '初めて夜に出撃した',
    check: (s) => s.stats.totalRuns >= 1,
  },
  tenMinutes: {
    name: '夜半まで',
    desc: '10分間生き延びた',
    check: (s) => s.stats.bestSurvivalTicks >= 10 * 60 * 60,
  },
  dawn: {
    name: '夜明け',
    desc: '30分を生き延び、朝日を見た',
    check: (s) => s.stats.victories >= 1,
  },
  firstEvolution: {
    name: '開眼',
    desc: '武器を進化させた',
    check: (s) => s.stats.evolutionsSeen >= 1,
  },
  hundredKills: {
    name: '百鬼討伐',
    desc: '一夜で100体討伐',
    check: (s) => s.stats.bestKills >= 100,
  },
  thousandKills: {
    name: '千鬼討伐',
    desc: '一夜で1000体討伐',
    check: (s) => s.stats.bestKills >= 1000,
  },
  fullArsenal: {
    name: '六道具足',
    desc: '一夜で武器6種を携えた',
    check: (s) => s.stats.maxWeaponsHeld >= 6,
  },
  richMan: {
    name: '長者',
    desc: '5000文を所持した',
    check: (s) => s.gold + s.goldSpent >= 5000,
  },
  allCharacters: {
    name: '皆伝',
    desc: '全ての夜行者を解放した',
    check: (s) => CHARACTER_IDS.every((id) => s.unlockedCharacters.includes(id)),
  },
  bestiaryComplete: {
    name: '図鑑完成',
    desc: '全ての妖を少なくとも一体討伐した(夜明けの光を除く)',
    check: (s) => BESTIARY_TARGETS.every((id) => (s.bestiary[id] ?? 0) > 0),
  },
  togeDawn: {
    name: '峠越え',
    desc: '雪女の峠で夜明けを見た',
    check: (s) => s.stats.togeVictories >= 1,
  },
} as const satisfies Record<string, AchievementDef>;

export type AchievementId = keyof typeof ACHIEVEMENTS;

export const ACHIEVEMENT_IDS = Object.keys(ACHIEVEMENTS) as AchievementId[];

/** Returns newly earned achievement ids (also appends them to the save). */
export function evaluateAchievements(save: SaveData): AchievementId[] {
  const earned: AchievementId[] = [];
  for (const id of ACHIEVEMENT_IDS) {
    if (save.achievements.includes(id)) continue;
    if (ACHIEVEMENTS[id].check(save)) {
      save.achievements.push(id);
      earned.push(id);
    }
  }
  return earned;
}
