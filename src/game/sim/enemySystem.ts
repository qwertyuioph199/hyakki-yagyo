import { TICK_DT } from '../../engine/loop';
import { Ev } from './events';
import type { World } from './world';

const SEPARATION_RADIUS = 18;
const MAX_SEPARATION_NEIGHBORS = 4;
const KNOCKBACK_DECAY = 0.82;
const PLAYER_RADIUS = 10;

/**
 * Chase + separation + contact damage. Separation runs on half the pool per
 * tick (staggered by parity) — visually indistinguishable in a horde, halves
 * the hidden O(n²) hotspot.
 */
export function enemySystem(world: World): void {
  const p = world.player;
  const parity = world.tick & 1;

  for (let i = 0; i < world.enemies.count; i++) {
    const e = world.enemies.items[i]!;
    e.px = e.x;
    e.py = e.y;
    if (e.hitFlash > 0) e.hitFlash--;

    let dx = p.x - e.x;
    let dy = p.y - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= dist;
    dy /= dist;

    if ((i & 1) === parity) {
      const n = world.enemyHash.query(e.x, e.y, SEPARATION_RADIUS, world.scratch);
      let pushed = 0;
      for (let k = 0; k < n && pushed < MAX_SEPARATION_NEIGHBORS; k++) {
        const j = world.scratch[k]!;
        if (j === i || j >= world.enemies.count) continue;
        const o = world.enemies.items[j]!;
        const sx = e.x - o.x;
        const sy = e.y - o.y;
        const d2 = sx * sx + sy * sy;
        if (d2 > 0.01 && d2 < SEPARATION_RADIUS * SEPARATION_RADIUS) {
          const inv = 1 / Math.sqrt(d2);
          dx += sx * inv * 0.55;
          dy += sy * inv * 0.55;
          pushed++;
        }
      }
    }

    e.x += dx * e.speed * TICK_DT + e.kx * TICK_DT;
    e.y += dy * e.speed * TICK_DT + e.ky * TICK_DT;
    e.kx *= KNOCKBACK_DECAY;
    e.ky *= KNOCKBACK_DECAY;

    // Contact damage.
    if (p.iframes === 0) {
      const cx = p.x - e.x;
      const cy = p.y - e.y;
      const touch = PLAYER_RADIUS + e.radius;
      if (cx * cx + cy * cy < touch * touch) {
        const dmg = Math.max(1, e.damage - p.stats.armor);
        p.hp -= dmg;
        p.iframes = 24; // 0.4s of post-hit invulnerability
        world.events.emit(Ev.PlayerHurt, p.x, p.y, dmg, 0);
        if (p.hp <= 0) {
          if (p.stats.revival > 0) {
            p.stats.revival--;
            p.hp = p.stats.maxHp / 2;
            p.iframes = 120;
            world.events.emit(Ev.PlayerRevived, p.x, p.y, 0, 0);
          } else {
            world.gameOver = true;
            world.events.emit(Ev.PlayerDied, p.x, p.y, 0, 0);
          }
        }
      }
    }
  }
}
