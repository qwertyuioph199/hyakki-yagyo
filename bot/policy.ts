import type { TickInput } from '../src/engine/input';
import { applyDraftChoice, currentDraft } from '../src/game/sim/levelUpSystem';
import type { World } from '../src/game/sim/world';

/**
 * Headless bot policy (MECHANICS.md §10 / balance harness).
 * Movement: danger-field kiting — inverse-square repulsion from nearby
 * enemies + weak attraction to gems/pickups; move along the resultant.
 * Draft: greedy priority — evolve-track weapons first, then new weapons,
 * then passives.
 */
const DANGER_RADIUS = 300;
const GEM_PULL_RADIUS = 420;

const scratchInput: TickInput = { moveX: 0, moveY: 0 };

export function botInput(world: World): TickInput {
  const p = world.player;
  let fx = 0;
  let fy = 0;

  for (let i = 0; i < world.enemies.count; i++) {
    const e = world.enemies.items[i]!;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > DANGER_RADIUS * DANGER_RADIUS || d2 < 1) continue;
    const w = (e.boss ? 3 : 1) / d2;
    fx += dx * w;
    fy += dy * w;
  }

  // Normalize the danger vector so gem/pickup attraction is on a comparable
  // scale: a real player weaves through the swarm to vacuum XP rather than
  // just fleeing. Danger flee gets the larger share; loot pulls it around.
  const dmag = Math.hypot(fx, fy);
  if (dmag > 1e-9) {
    fx = (fx / dmag) * 1.0;
    fy = (fy / dmag) * 1.0;
  }

  // Always pull toward the nearest chest/food/utility pickup (strong).
  let bestPickup = Infinity;
  let px = 0;
  let py = 0;
  for (let i = 0; i < world.pickups.count; i++) {
    const item = world.pickups.items[i]!;
    const dx = item.x - p.x;
    const dy = item.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestPickup) {
      bestPickup = d2;
      px = dx;
      py = dy;
    }
  }
  if (bestPickup < Infinity) {
    const d = Math.sqrt(bestPickup) || 1;
    fx += (px / d) * 0.7;
    fy += (py / d) * 0.7;
  }

  // Always drift toward the nearest gem cluster (moderate) so the bot levels
  // up in a dense swarm instead of leaving XP behind.
  let best = GEM_PULL_RADIUS * GEM_PULL_RADIUS;
  let gx = 0;
  let gy = 0;
  let found = false;
  for (let i = 0; i < world.gems.count; i++) {
    const g = world.gems.items[i]!;
    const dx = g.x - p.x;
    const dy = g.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < best) {
      best = d2;
      gx = dx;
      gy = dy;
      found = true;
    }
  }
  if (found) {
    const d = Math.sqrt(best) || 1;
    fx += (gx / d) * 0.5;
    fy += (gy / d) * 0.5;
  }

  const len = Math.hypot(fx, fy);
  if (len < 1e-9) {
    // Idle drift keeps the bot from standing in spawn rings.
    scratchInput.moveX = Math.cos(world.tick / 200);
    scratchInput.moveY = Math.sin(world.tick / 200);
  } else {
    scratchInput.moveX = fx / len;
    scratchInput.moveY = fy / len;
  }
  return scratchInput;
}

/** Resolve all pending drafts with a greedy priority heuristic. */
export function botResolveDrafts(world: World): void {
  let guard = 0;
  while (world.player.pendingLevelUps > 0 && guard++ < 20) {
    const draft = currentDraft(world);
    if (!draft || draft.length === 0) {
      world.player.pendingLevelUps--;
      world.draft = null;
      continue;
    }
    const score = (c: (typeof draft)[number]): number => {
      if (c.kind === 'weapon') return c.toLevel > 1 ? 100 + c.toLevel : 80;
      if (c.kind === 'passive') return c.toLevel > 1 ? 60 + c.toLevel : 50;
      if (c.kind === 'food') return 10;
      return 5;
    };
    let best = draft[0]!;
    for (const c of draft) if (score(c) > score(best)) best = c;
    applyDraftChoice(world, best);
  }
  // A chest reveal also freezes the sim; the bot instantly dismisses it.
  if (world.chestReveal) world.chestReveal = null;
}
