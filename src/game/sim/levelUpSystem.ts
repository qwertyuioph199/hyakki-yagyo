import { PASSIVES, PASSIVE_IDS } from '../../data/passives';
import type { WeaponDef } from '../../data/types';
import { WEAPONS, WEAPON_IDS, type WeaponId } from '../../data/weapons';
import { recomputeStats } from './statSystem';
import type { DraftChoice, World } from './world';

/**
 * Level-up draft generation (MECHANICS.md §6). RE'd VS rules:
 * - Candidate pool: owned items below max level, plus new items while a
 *   slot is free (6 weapon slots, 6 passive slots). Banished ids excluded.
 * - Weighted sampling without replacement by item rarity weight.
 * - 3 choices base; Luck grants a chance of a 4th: P = min(luck - 1, 0.3).
 * - Empty pool falls back to gold (+25) and food (+30 HP) consolation picks.
 * - Reroll regenerates the draft; Skip closes it; Banish removes an item
 *   from the run's pool permanently. Charges live on player stats.
 */

export const MAX_WEAPONS = 6;
export const MAX_PASSIVES = 6;
const FOURTH_SLOT_LUCK_CAP = 0.3;
const FALLBACK_GOLD = 25;
const FALLBACK_FOOD_HEAL = 30;

interface Candidate {
  choice: DraftChoice;
  weight: number;
}

function weaponMaxLevel(id: WeaponId): number {
  return WEAPONS[id].levels.length + 1;
}

function collectCandidates(world: World): Candidate[] {
  const p = world.player;
  const out: Candidate[] = [];

  for (const id of WEAPON_IDS) {
    if (world.banished.includes(id)) continue;
    const def: WeaponDef = WEAPONS[id];
    if (def.evolutionOnly) continue;
    const owned = p.weapons.find((w) => w.id === id);
    if (owned) {
      if (owned.level < weaponMaxLevel(id)) {
        out.push({ choice: { kind: 'weapon', id, toLevel: owned.level + 1 }, weight: def.weight });
      }
    } else if (p.weapons.length < MAX_WEAPONS) {
      out.push({ choice: { kind: 'weapon', id, toLevel: 1 }, weight: def.weight });
    }
  }

  for (const id of PASSIVE_IDS) {
    if (world.banished.includes(id)) continue;
    const def = PASSIVES[id];
    const owned = p.passives.find((x) => x.id === id);
    if (owned) {
      if (owned.level < def.maxLevel) {
        out.push({ choice: { kind: 'passive', id, toLevel: owned.level + 1 }, weight: def.weight });
      }
    } else if (p.passives.length < MAX_PASSIVES) {
      out.push({ choice: { kind: 'passive', id, toLevel: 1 }, weight: def.weight });
    }
  }

  return out;
}

export function generateDraft(world: World): DraftChoice[] {
  const pool = collectCandidates(world);
  const luck = world.player.stats.luck;
  let slots = 3;
  if (world.rng.next() < Math.min(Math.max(0, luck - 1), FOURTH_SLOT_LUCK_CAP)) slots = 4;

  const picks: DraftChoice[] = [];
  while (picks.length < slots && pool.length > 0) {
    const idx = world.rng.weighted(pool.map((c) => c.weight));
    picks.push(pool[idx]!.choice);
    pool.splice(idx, 1);
  }

  if (picks.length === 0) {
    picks.push({ kind: 'gold', id: 'gold', toLevel: FALLBACK_GOLD });
    picks.push({ kind: 'food', id: 'food', toLevel: FALLBACK_FOOD_HEAL });
  }
  return picks;
}

export function applyDraftChoice(world: World, choice: DraftChoice): void {
  const p = world.player;
  switch (choice.kind) {
    case 'weapon': {
      const owned = p.weapons.find((w) => w.id === choice.id);
      if (owned) owned.level = choice.toLevel;
      else p.weapons.push({ id: choice.id, level: 1, cooldown: 0, state: 0 });
      break;
    }
    case 'passive': {
      const owned = p.passives.find((x) => x.id === choice.id);
      if (owned) owned.level = choice.toLevel;
      else p.passives.push({ id: choice.id, level: 1 });
      recomputeStats(p, null, null);
      break;
    }
    case 'gold':
      p.gold += Math.round(choice.toLevel * p.stats.greed);
      break;
    case 'food':
      p.hp = Math.min(p.stats.maxHp, p.hp + choice.toLevel);
      break;
  }
  p.pendingLevelUps--;
  world.draft = null;
}

/** Returns false when no reroll charges remain. */
export function rerollDraft(world: World): boolean {
  if (world.player.stats.reroll <= 0) return false;
  world.player.stats.reroll--;
  world.draft = generateDraft(world);
  return true;
}

/** Skip this level-up entirely (consumes the pending level). */
export function skipDraft(world: World): boolean {
  if (world.player.stats.skip <= 0) return false;
  world.player.stats.skip--;
  world.player.pendingLevelUps--;
  world.draft = null;
  return true;
}

/** Remove an item from this run's draft pool forever. */
export function banishChoice(world: World, choice: DraftChoice): boolean {
  if (world.player.stats.banish <= 0) return false;
  if (choice.kind !== 'weapon' && choice.kind !== 'passive') return false;
  world.player.stats.banish--;
  world.banished.push(choice.id);
  world.draft = generateDraft(world);
  return true;
}

/** Lazily generate the current draft (UI/bot call this each frame). */
export function currentDraft(world: World): DraftChoice[] | null {
  if (world.player.pendingLevelUps <= 0) return null;
  if (!world.draft) world.draft = generateDraft(world);
  return world.draft;
}
