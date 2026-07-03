import { PASSIVES, type PassiveId } from '../data/passives';
import { WEAPONS, type WeaponId } from '../data/weapons';
import type { Atlas } from '../engine/atlas';
import { TICK_RATE } from '../engine/loop';
import type { World } from '../game/sim/world';

const WEAPON_MAX = 6;
const PASSIVE_MAX = 6;
const SLOT = 42;

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
        /* Fully transparent HUD — no opaque panels; legibility comes from
           shadows/glows/faint borders so the game view shows through. */
        .hy-hud { position:absolute; inset:0; pointer-events:none; font-family:Consolas,'Yu Gothic',monospace; }
        .hy-xpbar { position:absolute; top:0; left:0; right:0; height:18px; background:rgba(13,13,20,.35); border-bottom:2px solid rgba(0,0,0,.5); }
        .hy-xpfill { height:100%; width:0%; background:linear-gradient(#7fccf5,#4aa3d8); transition:width .12s; box-shadow:0 0 10px rgba(74,163,216,.8); }
        .hy-level { position:absolute; top:2px; right:14px; color:#f5c542; font-size:17px; font-weight:bold; text-shadow:0 1px 3px #000,0 0 5px #000; }
        .hy-timer { position:absolute; top:26px; left:50%; transform:translateX(-50%); color:#f2ead8; font-size:32px; letter-spacing:.06em; text-shadow:0 2px 0 #000,0 0 12px rgba(0,0,0,.95); }
        .hy-inv { position:absolute; top:30px; left:14px; display:flex; flex-direction:column; gap:7px; }
        .hy-row { display:flex; gap:6px; }
        .hy-slot { position:relative; width:${SLOT}px; height:${SLOT}px; border:1px solid rgba(232,163,61,.22); border-radius:5px; }
        .hy-slot.pass { border-color:rgba(138,111,201,.22); }
        .hy-slot canvas { position:absolute; inset:0; margin:auto; image-rendering:pixelated; filter:drop-shadow(0 0 2px #000) drop-shadow(0 1px 1px #000); }
        .hy-lv { position:absolute; right:2px; bottom:0; font-size:14px; font-weight:bold; color:#f5c542; text-shadow:0 1px 2px #000,1px 0 2px #000,-1px 0 2px #000,0 -1px 2px #000; }
        .hy-lv.max { color:#5fd3c4; }
        .hy-botbar { position:absolute; left:0; right:0; bottom:0; display:flex; align-items:flex-end; justify-content:space-between; padding:0 18px 14px; }
        .hy-hpwrap { width:280px; }
        .hy-hpbar { position:relative; width:100%; height:20px; background:rgba(13,13,20,.4); border:1px solid rgba(0,0,0,.6); border-radius:3px; }
        .hy-hpfill { height:100%; width:100%; background:linear-gradient(#ec7373,#c23a3a); transition:width .1s; }
        .hy-hptext { position:absolute; inset:0; text-align:center; color:#fff; font-size:14px; font-weight:bold; line-height:20px; text-shadow:0 1px 2px #000,0 0 4px #000; }
        .hy-stats { color:#f2ead8; font-size:19px; text-align:right; text-shadow:0 1px 3px #000,0 0 5px #000; line-height:1.5; }
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
