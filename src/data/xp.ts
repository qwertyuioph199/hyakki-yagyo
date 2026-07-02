/**
 * RE: Vampire Survivors experience curve (MECHANICS.md §1).
 *
 * XP required to go from level n to n+1:
 *   - 1→2: 5
 *   - each level through 19→20: previous + 10
 *   - 20→21: previous + 13, plus a one-time +600 jump
 *   - each level through 39→40: previous + 13
 *   - 40→41: previous + 16, plus a one-time +2400 jump
 *   - beyond: previous + 16
 */
export function xpToNext(level: number): number {
  if (level < 1) return 0;
  if (level === 1) return 5;
  if (level <= 19) return 5 + 10 * (level - 1);
  const at19 = 5 + 10 * 18; // 185
  if (level === 20) return at19 + 13 + 600;
  if (level <= 39) return at19 + 13 * (level - 19) + 600;
  const at39 = at19 + 13 * 20 + 600; // 1045
  if (level === 40) return at39 + 16 + 2400;
  return at39 + 16 * (level - 39) + 2400;
}
