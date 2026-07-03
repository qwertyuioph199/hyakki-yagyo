import { ENEMY_LIST } from '../../data/enemies';
import { STAGES } from '../../data/stages';
import { WEAPONS, type WeaponId } from '../../data/weapons';
import type { Camera } from '../../engine/camera';
import type { Renderer } from '../../engine/renderer';
import { Ev } from '../sim/events';
import { collectLevels } from '../sim/weaponSystem';
import { PickupKind, ProjKind, type World } from '../sim/world';

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
            this.texts.push({ x: e.x, y: e.y - 10, value: Math.round(e.a), ttl: TEXT_TTL, gold: e.a >= 60 });
          }
          break;
        case Ev.EnemyDied:
          if (this.poofs.length < POOF_CAP) this.poofs.push({ x: e.x, y: e.y, ttl: POOF_TTL });
          break;
        case Ev.PlayerHurt:
          this.camera.addShake(0.35);
          break;
        case Ev.ChestOpened:
        case Ev.EvolutionUnlocked:
          this.camera.addShake(0.25);
          break;
        case Ev.BossSpawned:
          this.camera.addShake(0.5);
          break;
        default:
          break;
      }
    }
  }

  render(world: World, alpha: number): void {
    const r = this.renderer;
    const p = world.player;
    const stage = STAGES[world.stageId];
    const camX = p.px + (p.x - p.px) * alpha + this.camera.offsetX;
    const camY = p.py + (p.y - p.py) * alpha + this.camera.offsetY;
    r.begin(camX, camY, stage.bg);
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
          r.blit(atlas.frame(stage.groundSprite, h & 1), gx * GRID + (h % GRID), gy * GRID + ((h >> 3) % GRID));
        }
      }
    }

    // Ground zones (under everything).
    for (let i = 0; i < world.projectiles.count; i++) {
      const proj = world.projectiles.items[i]!;
      if (proj.kind !== ProjKind.Zone) continue;
      const def = this.weaponDef(world, proj.weaponIdx);
      const frame = atlas.frame(def?.sprite ?? 'fx_zone', (world.tick >> 4) & 1);
      r.blitScaled(frame, proj.x, proj.y, (proj.radius * 2) / frame.w);
    }

    // Aura rings (kekkai-family weapons draw directly from ownership).
    for (let w = 0; w < p.weapons.length; w++) {
      const inst = p.weapons[w]!;
      const def = WEAPONS[inst.id as WeaponId];
      if (!def || def.behavior !== 'aura') continue;
      const lv = collectLevels(inst.id as WeaponId, inst.level);
      const radius = 68 * (def.area + lv.area) * p.stats.area;
      const frame = atlas.frame(def.sprite, (world.tick >> 4) & 1);
      r.blitScaled(frame, camX - this.camera.offsetX, camY - this.camera.offsetY, (radius * 2) / frame.w);
    }

    // Gems (tier by value: 1 / <10 / >=10).
    for (let i = 0; i < world.gems.count; i++) {
      const g = world.gems.items[i]!;
      const tier = g.value >= 10 ? 2 : g.value > 1 ? 1 : 0;
      r.blit(atlas.frame('gem', tier), g.px + (g.x - g.px) * alpha, g.py + (g.y - g.py) * alpha);
    }

    // Pickups.
    for (let i = 0; i < world.pickups.count; i++) {
      const item = world.pickups.items[i]!;
      const id =
        item.kind === PickupKind.Chest
          ? 'pickup_chest'
          : item.kind === PickupKind.Food
            ? 'pickup_food'
            : item.kind === PickupKind.Coin
              ? 'pickup_coin'
              : item.kind === PickupKind.Vacuum
                ? 'pickup_vacuum'
                : 'pickup_bomb';
      r.blit(atlas.frame(id, (world.tick >> 4) & 1), item.x, item.y);
    }

    // Enemies (typeIdx → sprite id; last frame = hit flash).
    for (let i = 0; i < world.enemies.count; i++) {
      const e = world.enemies.items[i]!;
      const def = ENEMY_LIST[e.typeIdx];
      const spriteId = def?.sprite ?? 'enemy_hitodama';
      const animFrames = atlas.frameCount(spriteId) - 1;
      const frame =
        e.hitFlash > 0
          ? atlas.frame(spriteId, animFrames)
          : atlas.frame(spriteId, ((world.tick + e.uid * 7) >> 3) % Math.max(1, animFrames));
      r.blit(frame, e.px + (e.x - e.px) * alpha, e.py + (e.y - e.py) * alpha);
    }

    // Player (blink while invulnerable).
    if (p.iframes === 0 || (world.tick & 3) < 2) {
      const moving = p.x !== p.px || p.y !== p.py;
      const heroFrame = atlas.frame(world.charDef.sprite, moving ? (world.tick >> 3) & 1 : 0);
      r.blit(heroFrame, camX - this.camera.offsetX, camY - this.camera.offsetY);
    }

    // Projectiles (non-zone kinds).
    for (let i = 0; i < world.projectiles.count; i++) {
      const proj = world.projectiles.items[i]!;
      if (proj.kind === ProjKind.Zone) continue;
      const def = this.weaponDef(world, proj.weaponIdx);
      const spriteId = def?.sprite ?? 'shot_ofuda';
      const ix = proj.px + (proj.x - proj.px) * alpha;
      const iy = proj.py + (proj.y - proj.py) * alpha;
      if (proj.kind === ProjKind.Slash) {
        r.blit(atlas.frame(spriteId, proj.spriteIdx), ix, iy);
      } else if (proj.kind === ProjKind.Bolt) {
        const frame = atlas.frame(spriteId, (world.tick >> 2) & 1);
        r.blitAlpha(frame, ix, iy - 20, Math.min(1, proj.ttl / 6));
      } else {
        const frames = atlas.frameCount(spriteId);
        r.blit(atlas.frame(spriteId, frames > 1 ? (world.tick >> 2) % frames : 0), ix, iy);
      }
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

  private weaponDef(world: World, weaponIdx: number) {
    const inst = world.player.weapons[weaponIdx];
    return inst ? WEAPONS[inst.id as WeaponId] : undefined;
  }
}
