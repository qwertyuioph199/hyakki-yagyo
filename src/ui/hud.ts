import { TICK_RATE } from '../engine/loop';
import type { World } from '../game/sim/world';

/**
 * DOM overlay HUD: run timer, level, XP bar, HP bar, kills, gold.
 * Updates are change-driven and cheap — never touches the canvas frame budget.
 */
export class Hud {
  private readonly el: HTMLDivElement;
  private readonly xpFill: HTMLDivElement;
  private readonly hpFill: HTMLDivElement;
  private readonly timer: HTMLDivElement;
  private readonly level: HTMLDivElement;
  private readonly counters: HTMLDivElement;
  private lastSecond = -1;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.innerHTML = `
      <style>
        .hy-hud { position:absolute; inset:0; pointer-events:none; font-family:Consolas,monospace; }
        .hy-xpbar { position:absolute; top:0; left:0; right:0; height:14px; background:#16161f; border-bottom:1px solid #000; }
        .hy-xpfill { height:100%; width:0%; background:#4aa3d8; transition:width .15s; }
        .hy-level { position:absolute; top:1px; right:8px; color:#f2ead8; font-size:11px; }
        .hy-timer { position:absolute; top:22px; left:50%; transform:translateX(-50%); color:#f2ead8; font-size:22px; text-shadow:0 2px 0 #000; }
        .hy-hpbar { position:absolute; left:12px; bottom:12px; width:180px; height:12px; background:#16161f; border:1px solid #000; }
        .hy-hpfill { height:100%; width:100%; background:#d84545; transition:width .1s; }
        .hy-counters { position:absolute; right:12px; bottom:12px; color:#f2ead8; font-size:12px; text-align:right; text-shadow:0 1px 0 #000; }
      </style>
      <div class="hy-hud">
        <div class="hy-xpbar"><div class="hy-xpfill"></div></div>
        <div class="hy-level">Lv 1</div>
        <div class="hy-timer">0:00</div>
        <div class="hy-hpbar"><div class="hy-hpfill"></div></div>
        <div class="hy-counters"></div>
      </div>`;
    root.appendChild(this.el);
    this.xpFill = this.el.querySelector('.hy-xpfill')!;
    this.hpFill = this.el.querySelector('.hy-hpfill')!;
    this.timer = this.el.querySelector('.hy-timer')!;
    this.level = this.el.querySelector('.hy-level')!;
    this.counters = this.el.querySelector('.hy-counters')!;
  }

  update(world: World): void {
    const p = world.player;
    const second = Math.floor(world.tick / TICK_RATE);
    if (second !== this.lastSecond) {
      this.lastSecond = second;
      const m = Math.floor(second / 60);
      const s = second % 60;
      this.timer.textContent = `${m}:${String(s).padStart(2, '0')}`;
      this.counters.textContent = `倒した数 ${p.kills}  金 ${p.gold}`;
    }
    this.xpFill.style.width = `${Math.min(100, (p.xp / p.xpNeeded) * 100)}%`;
    this.hpFill.style.width = `${Math.max(0, (p.hp / p.stats.maxHp) * 100)}%`;
    this.level.textContent = `Lv ${p.level}`;
  }

  destroy(): void {
    this.el.remove();
  }
}
