import { PASSIVES, type PassiveId } from '../data/passives';
import { WEAPONS, type WeaponId } from '../data/weapons';
import type { Atlas } from '../engine/atlas';
import { TICK_RATE } from '../engine/loop';
import type { World } from '../game/sim/world';

const WEAPON_MAX = 6;
const PASSIVE_MAX = 6;
const SLOT = 30;

/**
 * DOM overlay HUD: XP bar, run timer, level, HP bar, gold/kills, and the
 * weapon + passive inventory rows (VS-style icon slots with level pips).
 * Updates are change-driven; the inventory rows only re-render when the
 * loadout signature changes, so this never touches the canvas frame budget.
 */
export class Hud {
  private readonly el: HTMLDivElement;
  private readonly xpFill: HTMLDivElement;
  private readonly hpFill: HTMLDivElement;
  private readonly hpText: HTMLDivElement;
  private readonly timer: HTMLDivElement;
  private readonly level: HTMLDivElement;
  private readonly gold: HTMLSpanElement;
  private readonly kills: HTMLSpanElement;
  private readonly weaponRow: HTMLDivElement;
  private readonly passiveRow: HTMLDivElement;
  private lastSecond = -1;
  private lastLoadout = '';

  constructor(
    root: HTMLElement,
    private atlas: Atlas,
  ) {
    this.el = document.createElement('div');
    this.el.innerHTML = `
      <style>
        .hy-hud { position:absolute; inset:0; pointer-events:none; font-family:Consolas,'Yu Gothic',monospace; }
        .hy-xpbar { position:absolute; top:0; left:0; right:0; height:16px; background:#0d0d14; border-bottom:2px solid #000; }
        .hy-xpfill { height:100%; width:0%; background:linear-gradient(#6fc0ee,#4aa3d8); transition:width .12s; box-shadow:0 0 6px rgba(74,163,216,.6); }
        .hy-level { position:absolute; top:1px; right:10px; color:#f5c542; font-size:12px; font-weight:bold; text-shadow:0 1px 2px #000; }
        .hy-timer { position:absolute; top:22px; left:50%; transform:translateX(-50%); color:#f2ead8; font-size:24px; letter-spacing:.05em; text-shadow:0 2px 0 #000,0 0 8px rgba(0,0,0,.8); }
        .hy-inv { position:absolute; top:24px; left:10px; display:flex; flex-direction:column; gap:4px; }
        .hy-row { display:flex; gap:3px; }
        .hy-slot { position:relative; width:${SLOT}px; height:${SLOT}px; background:rgba(13,13,20,.72); border:1px solid #2a2a38; border-radius:3px; }
        .hy-slot.pass { border-color:#3a3550; }
        .hy-slot canvas { position:absolute; inset:0; margin:auto; image-rendering:pixelated; }
        .hy-lv { position:absolute; right:1px; bottom:0; font-size:9px; color:#f5c542; text-shadow:0 1px 1px #000,1px 0 1px #000; }
        .hy-lv.max { color:#5fd3c4; }
        .hy-botbar { position:absolute; left:0; right:0; bottom:0; display:flex; align-items:flex-end; justify-content:space-between; padding:0 12px 10px; }
        .hy-hpwrap { width:220px; }
        .hy-hpbar { position:relative; width:100%; height:14px; background:#0d0d14; border:1px solid #000; box-shadow:0 1px 3px rgba(0,0,0,.6); }
        .hy-hpfill { height:100%; width:100%; background:linear-gradient(#e05555,#c23a3a); transition:width .1s; }
        .hy-hptext { position:absolute; inset:0; text-align:center; color:#fff; font-size:10px; line-height:14px; text-shadow:0 1px 1px #000; }
        .hy-stats { color:#f2ead8; font-size:13px; text-align:right; text-shadow:0 1px 2px #000; line-height:1.5; }
        .hy-stats .g { color:#f5c542; }
        .hy-stats .k { color:#9fb8c9; }
      </style>
      <div class="hy-hud">
        <div class="hy-xpbar"><div class="hy-xpfill"></div></div>
        <div class="hy-level">Lv 1</div>
        <div class="hy-timer">0:00</div>
        <div class="hy-inv">
          <div class="hy-row hy-weapons"></div>
          <div class="hy-row hy-passives"></div>
        </div>
        <div class="hy-botbar">
          <div class="hy-hpwrap">
            <div class="hy-hpbar"><div class="hy-hpfill"></div><div class="hy-hptext"></div></div>
          </div>
          <div class="hy-stats"><span class="g">◈ 0</span><br/><span class="k">倒 0</span></div>
        </div>
      </div>`;
    root.appendChild(this.el);
    this.xpFill = this.el.querySelector('.hy-xpfill')!;
    this.hpFill = this.el.querySelector('.hy-hpfill')!;
    this.hpText = this.el.querySelector('.hy-hptext')!;
    this.timer = this.el.querySelector('.hy-timer')!;
    this.level = this.el.querySelector('.hy-level')!;
    this.weaponRow = this.el.querySelector('.hy-weapons')!;
    this.passiveRow = this.el.querySelector('.hy-passives')!;
    this.gold = this.el.querySelector('.hy-stats .g')!;
    this.kills = this.el.querySelector('.hy-stats .k')!;
  }

  update(world: World): void {
    const p = world.player;
    const second = Math.floor(world.tick / TICK_RATE);
    if (second !== this.lastSecond) {
      this.lastSecond = second;
      const m = Math.floor(second / 60);
      const s = second % 60;
      this.timer.textContent = `${m}:${String(s).padStart(2, '0')}`;
      this.gold.textContent = `◈ ${p.gold}`;
      this.kills.textContent = `倒 ${p.kills}`;
    }
    this.xpFill.style.width = `${Math.min(100, (p.xp / p.xpNeeded) * 100)}%`;
    const hpFrac = Math.max(0, p.hp / p.stats.maxHp);
    this.hpFill.style.width = `${hpFrac * 100}%`;
    this.hpText.textContent = `${Math.max(0, Math.ceil(p.hp))} / ${Math.round(p.stats.maxHp)}`;
    this.level.textContent = `Lv ${p.level}`;

    // Inventory rows only rebuild when the loadout changes.
    const sig =
      p.weapons.map((w) => `${w.id}${w.level}`).join(',') + '|' + p.passives.map((x) => `${x.id}${x.level}`).join(',');
    if (sig !== this.lastLoadout) {
      this.lastLoadout = sig;
      this.rebuildInventory(world);
    }
  }

  private rebuildInventory(world: World): void {
    const p = world.player;
    this.weaponRow.replaceChildren();
    for (let i = 0; i < WEAPON_MAX; i++) {
      const inst = p.weapons[i];
      if (inst) {
        const def = WEAPONS[inst.id as WeaponId];
        const max = def.levels.length + 1;
        this.weaponRow.appendChild(this.slot(def.sprite, inst.level, max, false));
      } else {
        this.weaponRow.appendChild(this.emptySlot(false));
      }
    }
    this.passiveRow.replaceChildren();
    for (let i = 0; i < PASSIVE_MAX; i++) {
      const inst = p.passives[i];
      if (inst) {
        const def = PASSIVES[inst.id as PassiveId];
        this.passiveRow.appendChild(this.slot(def.sprite, inst.level, def.maxLevel, true));
      } else {
        this.passiveRow.appendChild(this.emptySlot(true));
      }
    }
  }

  private emptySlot(passive: boolean): HTMLDivElement {
    const slot = document.createElement('div');
    slot.className = passive ? 'hy-slot pass' : 'hy-slot';
    return slot;
  }

  private slot(spriteId: string, level: number, maxLevel: number, passive: boolean): HTMLDivElement {
    const slot = this.emptySlot(passive);
    const cv = document.createElement('canvas');
    cv.width = SLOT;
    cv.height = SLOT;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const frame = this.atlas.frame(spriteId, 0);
    const scale = Math.min((SLOT - 6) / frame.w, (SLOT - 6) / frame.h, 2);
    ctx.drawImage(
      this.atlas.source,
      frame.sx,
      frame.sy,
      frame.w,
      frame.h,
      (SLOT - frame.w * scale) / 2,
      (SLOT - frame.h * scale) / 2,
      frame.w * scale,
      frame.h * scale,
    );
    slot.appendChild(cv);
    const lv = document.createElement('div');
    const maxed = level >= maxLevel;
    lv.className = maxed ? 'hy-lv max' : 'hy-lv';
    lv.textContent = maxed ? '★' : String(level);
    slot.appendChild(lv);
    return slot;
  }

  /** Swap the icon source (e.g. after AI-art overrides load) and refresh. */
  setAtlas(atlas: Atlas): void {
    this.atlas = atlas;
    this.lastLoadout = '';
  }

  destroy(): void {
    this.el.remove();
  }
}
