import { EVOLUTIONS } from '../../data/evolutions';
import { PASSIVES, type PassiveId } from '../../data/passives';
import { WEAPONS, type WeaponId } from '../../data/weapons';
import { TICK_RATE } from '../../engine/loop';
import { Ev } from './events';
import { recomputeStats } from './statSystem';
import type { World } from './world';

/**
 * Treasure chest algorithm (MECHANICS.md §7). RE'd VS behavior:
 * 1. If any owned weapon is evolution-eligible (max level, partner passive
 *    owned, evolution not owned, minute gate passed), the chest GRANTS the
 *    evolution as its first item — evolutions never come from level-ups.
 * 2. Otherwise the chest levels up owned, non-maxed items:
 *      P(5 items) = 0.004 × luck, P(3 items) = 0.036 × luck, else 1 item.
 * 3. Items that can't be applied (everything maxed) convert to gold.
 * 4. Gold: base 30 + 15 per extra item + 1 per run-minute, × greed.
 */

const P5_BASE = 0.004;
const P3_BASE = 0.036;
const GOLD_BASE = 30;
const GOLD_PER_EXTRA_ITEM = 15;

export interface ChestItem {
  kind: 'weapon' | 'passive' | 'evolution';
  id: string;
  toLevel: number;
}

export interface ChestResult {
  items: ChestItem[];
  gold: number;
  /** 1 | 3 | 5 — presentation uses this for fanfare tiers. */
  rolls: number;
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
  const luck = p.stats.luck;

  const r = world.rng.next();
  let rolls = 1;
  if (r < P5_BASE * luck) rolls = 5;
  else if (r < (P5_BASE + P3_BASE) * luck) rolls = 3;

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
  const gold = Math.round(
    (GOLD_BASE + GOLD_PER_EXTRA_ITEM * (rolls - 1 + wastedItems) + minute) * p.stats.greed,
  );
  p.gold += gold;
  world.events.emit(Ev.GoldGained, p.x, p.y, gold, 0);
  world.events.emit(Ev.ChestOpened, p.x, p.y, rolls, items.length);
  return { items, gold, rolls };
}
