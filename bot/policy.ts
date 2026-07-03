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
const GEM_PULL_RADIUS = 220;

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

  // When not fleeing hard: pull toward chests/pickups (strong) and gems (weak).
  const danger = Math.hypot(fx, fy);
  if (danger < 0.004) {
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
      fx += (px / d) * 0.01;
      fy += (py / d) * 0.01;
    } else {
      let best = GEM_PULL_RADIUS * GEM_PULL_RADIUS;
      let gx = 0;
      let gy = 0;
      for (let i = 0; i < world.gems.count; i++) {
        const g = world.gems.items[i]!;
        const dx = g.x - p.x;
        const dy = g.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < best) {
          best = d2;
          gx = dx;
          gy = dy;
        }
      }
      fx += gx * 0.00001;
      fy += gy * 0.00001;
    }
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
