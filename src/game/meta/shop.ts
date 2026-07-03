import { POWERUPS, POWERUP_IDS, type PowerUpId } from '../../data/shop';
import type { Stats } from '../../data/types';

/**
 * PowerUp pricing (MECHANICS.md §8). RE'd VS escalation rule — the source
 * of the famous "buy order matters" optimization:
 *
 *   price(rank r of item, T total ranks already bought overall)
 *     = round(baseCost × (r + 1) × (1 + 0.10 × T))
 *
 * Refunds return every coin spent (tracked, not recomputed).
 */
const ESCALATION_PER_RANK = 0.1;

export type PowerUpRanks = Partial<Record<PowerUpId, number>>;

export function totalRanks(ranks: PowerUpRanks): number {
  let t = 0;
  for (const id of POWERUP_IDS) t += ranks[id] ?? 0;
  return t;
}

/** Price of the NEXT rank of `id` given current ownership. */
export function nextRankPrice(id: PowerUpId, ranks: PowerUpRanks): number | null {
  const def = POWERUPS[id];
  const current = ranks[id] ?? 0;
  if (current >= def.maxRank) return null;
  return Math.round(def.baseCost * (current + 1) * (1 + ESCALATION_PER_RANK * totalRanks(ranks)));
}

export interface PurchaseResult {
  ranks: PowerUpRanks;
  goldLeft: number;
  spent: number;
}

/** Returns null if unaffordable or maxed. */
export function buyRank(id: PowerUpId, ranks: PowerUpRanks, gold: number): PurchaseResult | null {
  const price = nextRankPrice(id, ranks);
  if (price === null || price > gold) return null;
  return {
    ranks: { ...ranks, [id]: (ranks[id] ?? 0) + 1 },
    goldLeft: gold - price,
    spent: price,
  };
}

/** Aggregate stat bonuses granted by owned PowerUp ranks. */
export function powerUpBonuses(ranks: PowerUpRanks): Partial<Stats> {
  const out: Partial<Record<keyof Stats, number>> = {};
  for (const id of POWERUP_IDS) {
    const r = ranks[id] ?? 0;
    if (r === 0) continue;
    const def = POWERUPS[id];
    out[def.stat] = (out[def.stat] ?? 0) + def.perRank * r;
  }
  return out;
}
