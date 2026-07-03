import { EVOLUTIONS } from '../../data/evolutions';
import { PASSIVES, type PassiveId } from '../../data/passives';
import { WEAPONS, type WeaponId } from '../../data/weapons';
import { TICK_RATE } from '../../engine/loop';
import { Ev } from './events';
import { recomputeStats } from './statSystem';
import type { World } from './world';

/**
 * Treasure chest algorithm (MECHANICS.md §7).
 * 1. If any owned weapon is evolution-eligible (max level, partner passive
 *    owned, evolution not owned, minute gate passed), the chest GRANTS the
 *    evolution as its first item — evolutions never come from level-ups.
 * 2. Otherwise the chest levels up 1–5 owned, non-maxed items ("力"). The
 *    count scales with ELAPSED TIME (deeper into the night = more items),
 *    with a luck-driven chance of one extra.
 * 3. Items that can't be applied (everything maxed) convert to gold.
 * 4. Gold scales with elapsed time: (25 + 8·minute + 12·items) × greed.
 */

const GOLD_BASE = 25;
const GOLD_PER_MINUTE = 8;
const GOLD_PER_ITEM = 12;
/** Every this-many minutes raises the base item count by one (capped 1–5). */
const MINUTES_PER_ROLL = 6;
const MAX_ROLLS = 5;

export interface ChestItem {
  kind: 'weapon' | 'passive' | 'evolution';
  id: string;
  toLevel: number;
}

export interface ChestResult {
  items: ChestItem[];
  gold: number;
  /** 1–5 — how many powers this chest grants (presentation fanfare tier). */
  rolls: number;
}

/** Time+luck scaled number of powers a chest grants (1–5). */
export function chestRolls(world: World): number {
  const minute = world.tick / (TICK_RATE * 60);
  let rolls = Math.min(MAX_ROLLS, 1 + Math.floor(minute / MINUTES_PER_ROLL));
  // Luck: a chance at one extra power (capped at 5).
  if (world.rng.next() < Math.min(Math.max(0, world.player.stats.luck - 1), 0.5)) {
    rolls = Math.min(MAX_ROLLS, rolls + 1);
  }
  return rolls;
}

function weaponMaxLevel(id: WeaponId): number {
  return WEAPONS[id].levels.length + 1;
}

/** First evolution-eligible weapon, or null. */
export function eligibleEvolution(world: World): (typeof EVOLUTIONS)[number] | null {
  const p = world.player;
  const minute = world.tick / (TICK_RATE * 60);
  for (const evo of EVOLUTIONS) {
    if (minute < evo.minMinute) continue;
    if (p.weapons.some((w) => w.id === evo.into)) continue;
    const base = p.weapons.find((w) => w.id === evo.weapon);
    if (!base || base.level < weaponMaxLevel(evo.weapon as WeaponId)) continue;
    if (!p.passives.some((x) => x.id === evo.requires)) continue;
    return evo;
  }
  return null;
}

export function openChest(world: World): ChestResult {
  const p = world.player;
  const rolls = chestRolls(world);

  const items: ChestItem[] = [];

  const evo = eligibleEvolution(world);
  if (evo) {
    // Replace the base weapon with the evolved one at level 1.
    const base = p.weapons.find((w) => w.id === evo.weapon)!;
    base.id = evo.into;
    base.level = 1;
    base.cooldown = 0;
    base.state = 0;
    items.push({ kind: 'evolution', id: evo.into, toLevel: 1 });
    world.events.emit(Ev.EvolutionUnlocked, p.x, p.y, 0, 0);
  }

  let wastedItems = 0;
  while (items.length < rolls) {
    // Chests only level OWNED items — never grant new ones.
    const upgradable: ChestItem[] = [];
    for (const w of p.weapons) {
      const id = w.id as WeaponId;
      if (WEAPONS[id] && w.level < weaponMaxLevel(id)) {
        upgradable.push({ kind: 'weapon', id: w.id, toLevel: w.level + 1 });
      }
    }
    for (const x of p.passives) {
      const def = PASSIVES[x.id as PassiveId];
      if (def && x.level < def.maxLevel) {
        upgradable.push({ kind: 'passive', id: x.id, toLevel: x.level + 1 });
      }
    }
    if (upgradable.length === 0) {
      wastedItems = rolls - items.length;
      break;
    }
    const pick = upgradable[world.rng.int(upgradable.length)]!;
    if (pick.kind === 'weapon') {
      p.weapons.find((w) => w.id === pick.id)!.level = pick.toLevel;
    } else {
      p.passives.find((x) => x.id === pick.id)!.level = pick.toLevel;
      recomputeStats(p, world.charDef, world.powerUpBonuses);
    }
    items.push(pick);
  }

  const minute = Math.floor(world.tick / (TICK_RATE * 60));
  // Wasted rolls (everything maxed) still pay their gold value.
  const paidItems = items.length + wastedItems;
  const gold = Math.round(
    (GOLD_BASE + GOLD_PER_MINUTE * minute + GOLD_PER_ITEM * paidItems) * p.stats.greed,
  );
  p.gold += gold;
  world.events.emit(Ev.GoldGained, p.x, p.y, gold, 0);
  world.events.emit(Ev.ChestOpened, p.x, p.y, rolls, items.length);
  return { items, gold, rolls };
}

/** Convert a chest result into display data for the opening animation. */
export function buildChestReveal(result: ChestResult): import('./world').ChestReveal {
  const items = result.items.map((it) => {
    if (it.kind === 'passive') {
      const def = PASSIVES[it.id as PassiveId];
      return { sprite: def.sprite, name: def.name, sub: `Lv${it.toLevel}` };
    }
    const def = WEAPONS[it.id as WeaponId];
    return {
      sprite: def.sprite,
      name: def.name,
      sub: it.kind === 'evolution' ? '進化!' : `Lv${it.toLevel}`,
    };
  });
  return { items, gold: result.gold, tier: result.rolls };
}
