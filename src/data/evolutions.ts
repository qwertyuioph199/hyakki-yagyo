import type { EvolutionDef } from './types';

/**
 * Evolution recipes (MECHANICS.md §7): base weapon at max level + partner
 * passive owned (any level) → a chest after the minute gate grants the
 * evolution. Mirrors the VS evolution matrix 1:1 in structure.
 */
export const EVOLUTIONS = [
  { weapon: 'ofuda', requires: 'sutra', into: 'hyakkiSeal', minMinute: 10 },
  { weapon: 'kunai', requires: 'ema', into: 'senbonKunai', minMinute: 10 },
  { weapon: 'haraigushi', requires: 'magatama', into: 'oharai', minMinute: 10 },
  { weapon: 'juzu', requires: 'shimenawa', into: 'bonnou108', minMinute: 10 },
  { weapon: 'kekkai', requires: 'herbalTea', into: 'yataNoJin', minMinute: 10 },
  { weapon: 'masakari', requires: 'grandLantern', into: 'kikokuzan', minMinute: 10 },
  { weapon: 'tomoe', requires: 'manekiNeko', into: 'sanshu', minMinute: 10 },
  { weapon: 'rakurai', requires: 'bunshin', into: 'raijin', minMinute: 10 },
  { weapon: 'omiki', requires: 'lodestone', into: 'deiganNoNuma', minMinute: 10 },
  { weapon: 'kitsunebi', requires: 'sacredRice', into: 'kyubiGoka', minMinute: 10 },
] as const satisfies readonly EvolutionDef[];
