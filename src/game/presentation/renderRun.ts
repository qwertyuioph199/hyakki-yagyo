import { PAL } from '../../art/palette';
import type { Camera } from '../../engine/camera';
import type { Renderer } from '../../engine/renderer';
import { Ev } from '../sim/events';
import type { World } from '../sim/world';

/**
 * Draws the world and owns all presentation-only state (floating damage
 * numbers, death poofs). Reads the sim, never mutates it.
 */

interface FloatText {
  x: number;
  y: number;
  value: number;
  ttl: number;
  gold: boolean;
}

interface Poof {
  x: number;
  y: number;
  ttl: number;
}

const TEXT_CAP = 120;
const POOF_CAP = 96;
const TEXT_TTL = 32;
const POOF_TTL = 14;

export class RunPresenter {
  private readonly texts: FloatText[] = [];
  private readonly poofs: Poof[] = [];

  constructor(
    private readonly renderer: Renderer,
    private readonly camera: Camera,
  ) {}

  /** Drain this tick's sim events into presentation effects. */
  consumeEvents(world: World): void {
    for (let i = 0; i < world.events.count; i++) {
      const e = world.events.get(i);
      switch (e.type) {
        case Ev.DamageDealt:
          if (this.texts.length < TEXT_CAP) {
            this.texts.push({ x: e.x, y: e.y - 10, value: Math.round(e.a), ttl: TEXT_TTL, gold: e.a >= 50 });
          }
          break;
        case Ev.EnemyDied:
          if (this.poofs.length < POOF_CAP) this.poofs.push({ x: e.x, y: e.y, ttl: POOF_TTL });
          break;
        case Ev.PlayerHurt:
          this.camera.addShake(0.35);
          break;
        default:
          break;
      }
    }
  }

  render(world: World, alpha: number): void {
    const r = this.renderer;
    const p = world.player;
    const camX = p.px + (p.x - p.px) * alpha + this.camera.offsetX;
    const camY = p.py + (p.y - p.py) * alpha + this.camera.offsetY;
    r.begin(camX, camY, PAL.ground);
    const atlas = r.atlas;

    // Ground decals: deterministic dot pattern keyed on world cell coords.
    const GRID = 56;
    const x0 = Math.floor((camX - r.viewW / 2) / GRID) - 1;
    const x1 = Math.floor((camX + r.viewW / 2) / GRID) + 1;
    const y0 = Math.floor((camY - r.viewH / 2) / GRID) - 1;
    const y1 = Math.floor((camY + r.viewH / 2) / GRID) + 1;
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const h = ((gx * 73856093) ^ (gy * 19349663)) >>> 0;
        if ((h & 7) < 3) {
          r.blit(atlas.frame('ground_dot', h & 1), gx * GRID + (h % GRID), gy * GRID + ((h >> 3) % GRID));
        }
      }
    }

    // Gems under everything else.
    const gemF0 = atlas.frame('gem', (world.tick >> 4) & 1);
    for (let i = 0; i < world.gems.count; i++) {
      const g = world.gems.items[i]!;
      r.blit(gemF0, g.px + (g.x - g.px) * alpha, g.py + (g.y - g.py) * alpha);
    }

    // Enemies (per-type batches when more types exist).
    for (let i = 0; i < world.enemies.count; i++) {
      const e = world.enemies.items[i]!;
      const frame =
        e.hitFlash > 0
          ? atlas.frame('enemy_hitodama', 2)
          : atlas.frame('enemy_hitodama', ((world.tick + e.uid * 7) >> 3) & 1);
      r.blit(frame, e.px + (e.x - e.px) * alpha, e.py + (e.y - e.py) * alpha);
    }

    // Player (blink while invulnerable).
    if (p.iframes === 0 || (world.tick & 3) < 2) {
      const moving = p.x !== p.px || p.y !== p.py;
      const heroFrame = atlas.frame('hero', moving ? (world.tick >> 3) & 1 : 0);
      r.blit(heroFrame, camX - this.camera.offsetX, camY - this.camera.offsetY);
    }

    // Projectiles.
    for (let i = 0; i < world.projectiles.count; i++) {
      const proj = world.projectiles.items[i]!;
      const frame = atlas.frame('shot_ofuda', (world.tick >> 2) & 1);
      r.blit(frame, proj.px + (proj.x - proj.px) * alpha, proj.py + (proj.y - proj.py) * alpha);
    }

    // Death poofs.
    for (let i = this.poofs.length - 1; i >= 0; i--) {
      const poof = this.poofs[i]!;
      poof.ttl--;
      if (poof.ttl <= 0) {
        this.poofs[i] = this.poofs[this.poofs.length - 1]!;
        this.poofs.pop();
        continue;
      }
      const f = 2 - Math.floor((poof.ttl / POOF_TTL) * 3);
      r.blit(atlas.frame('poof', Math.min(2, Math.max(0, f))), poof.x, poof.y);
    }

    // Floating damage numbers (digit blits).
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i]!;
      t.ttl--;
      t.y -= 0.7;
      if (t.ttl <= 0) {
        this.texts[i] = this.texts[this.texts.length - 1]!;
        this.texts.pop();
        continue;
      }
      const s = String(t.value);
      const totalW = s.length * 7;
      for (let c = 0; c < s.length; c++) {
        const d = s.charCodeAt(c) - 48;
        if (d < 0 || d > 9) continue;
        r.blit(atlas.frame(`digit_${d}`, t.gold ? 1 : 0), t.x - totalW / 2 + c * 7, t.y);
      }
    }
  }
}
