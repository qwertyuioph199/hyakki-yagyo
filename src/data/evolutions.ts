import type { EvolutionDef } from './types';

/**
 * Evolution recipes (MECHANICS.md §7): base weapon at max level + the
 * partner passive owned (any level) → a chest after the minute gate grants
 * the evolved weapon. P4/W-A fills the full set of ~10.
 */
export const EVOLUTIONS = [
  {
    weapon: 'ofuda',
    requires: 'sacredRice',
    into: 'hyakkiSeal',
    minMinute: 10,
  },
] as const satisfies readonly EvolutionDef[];
