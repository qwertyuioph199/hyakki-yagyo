import type { Atlas } from '../engine/atlas';
import type { SfxId } from '../engine/audio/synth';
import type { World } from '../game/sim/world';

/**
 * Treasure-chest opening animation (開封演出). Shows while world.chestReveal
 * is set (the sim is frozen). Runs in real time via CSS/timers — it does not
 * depend on sim ticks. Click or press Space/Enter to dismiss, which clears
 * world.chestReveal and resumes the sim.
 */
export class ChestUi {
  private readonly el: HTMLDivElement;
  private world: World | null = null;
  private showing = false;
  private canDismiss = false;
  private timers: number[] = [];
  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      this.dismiss();
    }
  };

  constructor(
    root: HTMLElement,
    private atlas: Atlas,
    private readonly playSfx: (id: SfxId) => void,
  ) {
    this.el = document.createElement('div');
    this.el.style.cssText =
      'position:absolute;inset:0;display:none;align-items:center;justify-content:center;' +
      'background:radial-gradient(ellipse at 50% 45%, rgba(40,28,10,.55), rgba(11,11,18,.92));' +
      'z-index:15;font-family:Consolas,"Yu Gothic",monospace;';
    this.el.addEventListener('pointerdown', () => this.dismiss());
    root.appendChild(this.el);
  }

  setAtlas(atlas: Atlas): void {
    this.atlas = atlas;
  }

  sync(world: World): void {
    this.world = world;
    const reveal = world.chestReveal;
    if (reveal && !this.showing) this.open();
    else if (!reveal && this.showing) this.hide();
  }

  private icon(spriteId: string, size: number): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    const f = this.atlas.frame(spriteId, 0);
    const s = Math.min((size - 6) / f.w, (size - 6) / f.h);
    ctx.drawImage(this.atlas.source, f.sx, f.sy, f.w, f.h, (size - f.w * s) / 2, (size - f.h * s) / 2, f.w * s, f.h * s);
    cv.style.filter = 'drop-shadow(0 2px 4px #000)';
    return cv;
  }

  private open(): void {
    const reveal = this.world!.chestReveal!;
    this.showing = true;
    this.canDismiss = false;
    const tier = reveal.tier;
    const rays = 8 + tier * 3;
    this.el.innerHTML = `
      <style>
        @keyframes hy-chest-shake { 0%,100%{transform:translateX(0) rotate(0)} 20%{transform:translateX(-4px) rotate(-3deg)} 40%{transform:translateX(4px) rotate(3deg)} 60%{transform:translateX(-3px) rotate(-2deg)} 80%{transform:translateX(3px) rotate(2deg)} }
        @keyframes hy-burst { 0%{transform:scale(.2);opacity:.9} 100%{transform:scale(2.6);opacity:0} }
        @keyframes hy-pop { 0%{transform:translateY(16px) scale(.6);opacity:0} 60%{transform:translateY(-4px) scale(1.08)} 100%{transform:translateY(0) scale(1);opacity:1} }
        @keyframes hy-glow { 0%,100%{filter:drop-shadow(0 0 6px #f5c542)} 50%{filter:drop-shadow(0 0 18px #f5c542)} }
        .hy-c-wrap{ text-align:center; }
        .hy-c-title{ color:#f5c542; letter-spacing:.35em; font-size:22px; text-shadow:0 2px 6px #000; margin-bottom:6px; opacity:0; transition:opacity .4s; }
        .hy-c-chest{ position:relative; width:132px; height:132px; margin:0 auto 6px; }
        .hy-c-chest canvas{ position:absolute; inset:0; margin:auto; animation:hy-chest-shake .16s linear 4; }
        .hy-c-burst{ position:absolute; inset:0; margin:auto; width:120px; height:120px; border-radius:50%;
                     background:radial-gradient(circle, rgba(245,197,66,.9), rgba(245,197,66,0) 70%); opacity:0; }
        .hy-c-gold{ color:#f5c542; font-size:20px; text-shadow:0 2px 4px #000; margin-bottom:14px; opacity:0; transition:opacity .3s; }
        .hy-c-items{ display:flex; gap:12px; justify-content:center; flex-wrap:wrap; min-height:96px; }
        .hy-c-item{ width:104px; opacity:0; }
        .hy-c-item.show{ animation:hy-pop .45s cubic-bezier(.2,1.3,.4,1) forwards; }
        .hy-c-slot{ width:64px;height:64px;margin:0 auto 4px;position:relative;border:1px solid rgba(245,197,66,.3);border-radius:6px;background:rgba(13,13,20,.4); }
        .hy-c-slot canvas{ position:absolute; inset:0; margin:auto; }
        .hy-c-name{ color:#f2ead8; font-size:12px; text-shadow:0 1px 2px #000; }
        .hy-c-sub{ color:#5fd3c4; font-size:11px; }
        .hy-c-sub.evo{ color:#e8a33d; font-weight:bold; }
        .hy-c-cont{ margin-top:16px; color:#9fb8c9; font-size:12px; letter-spacing:.1em; opacity:0; transition:opacity .3s; }
      </style>
      <div class="hy-c-wrap">
        <div class="hy-c-title">宝 箱</div>
        <div class="hy-c-chest"><div class="hy-c-burst"></div></div>
        <div class="hy-c-gold"></div>
        <div class="hy-c-items"></div>
        <div class="hy-c-cont">クリック / Space で続ける</div>
      </div>`;
    const chestBox = this.el.querySelector('.hy-c-chest')!;
    chestBox.insertBefore(this.icon('pickup_chest', 96), chestBox.firstChild);
    const burst = this.el.querySelector('.hy-c-burst') as HTMLElement;
    const title = this.el.querySelector('.hy-c-title') as HTMLElement;
    const goldEl = this.el.querySelector('.hy-c-gold') as HTMLElement;
    const itemsEl = this.el.querySelector('.hy-c-items')!;
    const contEl = this.el.querySelector('.hy-c-cont') as HTMLElement;

    // Build (hidden) item cards.
    for (const it of reveal.items) {
      const card = document.createElement('div');
      card.className = 'hy-c-item';
      const slot = document.createElement('div');
      slot.className = 'hy-c-slot';
      slot.appendChild(this.icon(it.sprite, 60));
      card.appendChild(slot);
      const name = document.createElement('div');
      name.className = 'hy-c-name';
      name.textContent = it.name;
      const sub = document.createElement('div');
      sub.className = it.sub === '進化!' ? 'hy-c-sub evo' : 'hy-c-sub';
      sub.textContent = it.sub;
      card.appendChild(name);
      card.appendChild(sub);
      itemsEl.appendChild(card);
    }

    this.el.style.display = 'flex';
    window.addEventListener('keydown', this.onKey);
    this.playSfx('chest');
    title.style.opacity = '1';

    // Burst rays scaled by tier.
    for (let i = 0; i < rays; i++) {
      const ray = document.createElement('div');
      const ang = (i / rays) * 360;
      ray.style.cssText =
        `position:absolute;left:50%;top:50%;width:3px;height:70px;background:linear-gradient(#f5c542,rgba(245,197,66,0));` +
        `transform-origin:top center;transform:rotate(${ang}deg);opacity:0;`;
      chestBox.appendChild(ray);
      this.after(360, () => {
        ray.style.transition = 'opacity .5s, height .5s';
        ray.style.opacity = '0.9';
        ray.style.height = `${70 + tier * 14}px`;
        this.after(500, () => (ray.style.opacity = '0'));
      });
    }

    // Timeline.
    this.after(360, () => {
      burst.style.animation = 'hy-burst .55s ease-out forwards';
      const chestCanvas = chestBox.querySelector('canvas') as HTMLElement;
      if (chestCanvas) chestCanvas.style.animation = 'hy-glow 1.2s ease-in-out infinite';
    });
    this.after(560, () => {
      goldEl.textContent = `◈ ${reveal.gold} 文`;
      goldEl.style.opacity = '1';
      this.playSfx('coin');
    });
    const cards = [...itemsEl.querySelectorAll('.hy-c-item')] as HTMLElement[];
    cards.forEach((card, idx) => {
      this.after(700 + idx * 170, () => {
        card.classList.add('show');
        this.playSfx(idx === cards.length - 1 && tier >= 4 ? 'evolution' : 'levelup');
      });
    });
    this.after(700 + cards.length * 170 + 200, () => {
      this.canDismiss = true;
      contEl.style.opacity = '1';
    });
    // Safety: always dismissable shortly after opening even with no items.
    this.after(900, () => (this.canDismiss = true));
  }

  private after(ms: number, fn: () => void): void {
    this.timers.push(window.setTimeout(fn, ms));
  }

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  private dismiss(): void {
    if (!this.showing || !this.canDismiss) return;
    if (this.world) this.world.chestReveal = null;
    this.hide();
  }

  private hide(): void {
    this.showing = false;
    this.clearTimers();
    window.removeEventListener('keydown', this.onKey);
    this.el.style.display = 'none';
  }

  destroy(): void {
    this.hide();
    this.el.remove();
  }
}
