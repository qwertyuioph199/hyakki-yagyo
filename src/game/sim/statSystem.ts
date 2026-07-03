import { PASSIVES, type PassiveId } from '../../data/passives';
import type { CharacterDef, Stats } from '../../data/types';
import { baseStats } from './world';
import type { PassiveInstance } from './world';

/**
 * Stat aggregation (MECHANICS.md §3). VS rule: character bonuses, PowerUp
 * ranks and passive-item levels all contribute ADDITIVELY to each stat's
 * base, then caps apply. Multiplier stats sit on a base of 1, flat stats
 * on 0, maxHp is a base value scaled by percentage bonuses.
 */

/** Multiplier floor: cooldown can never drop below 10% of base (RE §3). */
const COOLDOWN_FLOOR = 0.1;

const MULTIPLIER_STATS = [
  'might',
  'area',
  'speed',
  'duration',
  'moveSpeed',
  'magnet',
  'luck',
  'growth',
  'greed',
  'curse',
] as const;

const FLAT_STATS = ['armor', 'recovery', 'amount', 'revival', 'reroll', 'skip', 'banish'] as const;

export function aggregateStats(
  character: Pick<CharacterDef, 'bonuses' | 'baseHp'> | null,
  passives: readonly PassiveInstance[],
  powerUpBonuses: Partial<Stats> | null,
): Stats {
  const out = baseStats();

  // Collect additive contributions per stat from passives.
  const add = (key: keyof Stats, v: number) => {
    (out as Record<keyof Stats, number>)[key] += v;
  };

  for (const stat of MULTIPLIER_STATS) {
    if (character?.bonuses[stat] !== undefined) add(stat, character.bonuses[stat]);
    if (powerUpBonuses?.[stat] !== undefined) add(stat, powerUpBonuses[stat]);
  }
  for (const stat of FLAT_STATS) {
    if (character?.bonuses[stat] !== undefined) add(stat, character.bonuses[stat]);
    if (powerUpBonuses?.[stat] !== undefined) add(stat, powerUpBonuses[stat]);
  }

  // Cooldown is a multiplier with NEGATIVE contributions.
  if (character?.bonuses.cooldown !== undefined) add('cooldown', character.bonuses.cooldown);
  if (powerUpBonuses?.cooldown !== undefined) add('cooldown', powerUpBonuses.cooldown);

  // Max HP: character base scaled by percentage bonuses.
  const hpBase = character?.baseHp ?? out.maxHp;
  let hpPct = 0;
  if (powerUpBonuses?.maxHp !== undefined) hpPct += powerUpBonuses.maxHp;

  for (const inst of passives) {
    const def = PASSIVES[inst.id as PassiveId];
    if (!def) continue;
    const contribution = def.perLevel * inst.level;
    if (def.stat === 'maxHp') hpPct += contribution;
    else add(def.stat, contribution);
  }

  out.maxHp = Math.round(hpBase * (1 + hpPct));
  if (out.cooldown < COOLDOWN_FLOOR) out.cooldown = COOLDOWN_FLOOR;
  if (out.curse < 1) out.curse = 1;
  return out;
}

/**
 * Recompute after any passive change. If max HP grew, the player heals by
 * the delta (VS behavior when leveling 勾玉); current HP is always clamped.
 */
export function recomputeStats(
  player: { stats: Stats; hp: number; passives: PassiveInstance[] },
  character: Pick<CharacterDef, 'bonuses' | 'baseHp'> | null,
  powerUpBonuses: Partial<Stats> | null,
): void {
  const prevMax = player.stats.maxHp;
  const next = aggregateStats(character, player.passives, powerUpBonuses);
  player.stats = next;
  if (next.maxHp > prevMax) player.hp += next.maxHp - prevMax;
  if (player.hp > next.maxHp) player.hp = next.maxHp;
}
