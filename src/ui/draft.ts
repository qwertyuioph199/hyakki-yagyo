import { PASSIVES, type PassiveId } from '../data/passives';
import { WEAPONS, type WeaponId } from '../data/weapons';
import type { WeaponDef } from '../data/types';
import type { Atlas } from '../engine/atlas';
import {
  applyDraftChoice,
  banishChoice,
  currentDraft,
  rerollDraft,
  skipDraft,
} from '../game/sim/levelUpSystem';
import type { DraftChoice, World } from '../game/sim/world';

/**
 * Level-up draft overlay, driven entirely by sim state: the sim freezes
 * while pendingLevelUps > 0; choices come from the deterministic generator
 * in levelUpSystem (world.rng), so bot and UI runs replay identically.
 * Each choice shows its actual weapon/passive illustration from the atlas.
 */
export class DraftUi {
  private readonly el: HTMLDivElement;
  private world: World | null = null;
  private banishMode = false;

  constructor(
    root: HTMLElement,
    private atlas: Atlas,
  ) {
    this.el = document.createElement('div');
    this.el.style.cssText =
      'position:absolute;inset:0;display:none;align-items:center;justify-content:center;' +
      'background:radial-gradient(ellipse at 50% 42%, rgba(30,22,42,.6), rgba(11,11,18,.9));' +
      'z-index:10;font-family:Consolas,"Yu Gothic",monospace;';
    root.appendChild(this.el);
  }

  setAtlas(atlas: Atlas): void {
    this.atlas = atlas;
  }

  sync(world: World): void {
    this.world = world;
    const draft = currentDraft(world);
    const shown = this.el.style.display !== 'none';
    if (draft && !shown) {
      this.banishMode = false;
      this.render(draft);
    } else if (!draft && shown) {
      this.el.style.display = 'none';
    }
  }

  destroy(): void {
    this.el.remove();
  }

  private spriteOf(c: DraftChoice): string {
    switch (c.kind) {
      case 'weapon':
        return WEAPONS[c.id as WeaponId].sprite;
      case 'passive':
        return PASSIVES[c.id as PassiveId].sprite;
      case 'gold':
        return 'pickup_coin';
      case 'food':
        return 'pickup_food';
    }
  }

  private icon(spriteId: string, size: number): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    const f = this.atlas.frame(spriteId, 0);
    const s = Math.min((size - 8) / f.w, (size - 8) / f.h);
    ctx.drawImage(this.atlas.source, f.sx, f.sy, f.w, f.h, (size - f.w * s) / 2, (size - f.h * s) / 2, f.w * s, f.h * s);
    cv.style.filter = 'drop-shadow(0 2px 4px #000)';
    return cv;
  }

  private label(c: DraftChoice): { title: string; tag: string; desc: string } {
    switch (c.kind) {
      case 'weapon': {
        const def = WEAPONS[c.id as WeaponId];
        return { title: def.name, tag: c.toLevel > 1 ? `Lv${c.toLevel}` : '新', desc: def.desc };
      }
      case 'passive': {
        const def = PASSIVES[c.id as PassiveId];
        return { title: def.name, tag: c.toLevel > 1 ? `Lv${c.toLevel}` : '新', desc: def.desc };
      }
      case 'gold':
        return { title: '金', tag: `+${c.toLevel}`, desc: '路銀の足しに。' };
      case 'food':
        return { title: '御饌', tag: '回復', desc: `HP +${c.toLevel}` };
    }
  }

  private render(draft: DraftChoice[]): void {
    const w = this.world!;
    const s = w.player.stats;
    const accent = this.banishMode ? '#b03a3a' : '#e8a33d';
    this.el.innerHTML = `
      <div style="text-align:center;">
        <h2 style="color:${accent};letter-spacing:.35em;font-size:30px;margin-bottom:6px;text-shadow:0 2px 8px #000;">力を選べ</h2>
        <div style="color:#9fb8c9;font-size:14px;min-height:20px;margin-bottom:16px;" class="hy-banish-hint"></div>
        <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;" class="hy-cards"></div>
        <div style="margin-top:22px;display:flex;gap:14px;justify-content:center;" class="hy-tools"></div>
      </div>`;
    const cards = this.el.querySelector('.hy-cards')!;
    const tools = this.el.querySelector('.hy-tools')!;
    const hint = this.el.querySelector('.hy-banish-hint') as HTMLElement;
    hint.textContent = this.banishMode ? '祓う対象を選べ(バニッシュ)' : '';

    for (const choice of draft) {
      const { title, tag, desc } = this.label(choice);
      const isEvo = choice.kind === 'weapon' && (WEAPONS[choice.id as WeaponId] as WeaponDef).evolutionOnly === true;
      const card = document.createElement('button');
      card.style.cssText =
        `width:210px;padding:20px 14px 18px;background:linear-gradient(#1b1b26,#131319);border:2px solid ${accent};border-radius:8px;` +
        'color:#f2ead8;cursor:pointer;text-align:center;font-family:inherit;transition:transform .08s;box-shadow:0 4px 18px rgba(0,0,0,.5);';
      card.onpointerenter = () => (card.style.transform = 'translateY(-4px)');
      card.onpointerleave = () => (card.style.transform = 'translateY(0)');

      const slot = document.createElement('div');
      slot.style.cssText =
        `width:88px;height:88px;margin:0 auto 12px;position:relative;border:1px solid ${accent}55;border-radius:8px;` +
        'background:radial-gradient(circle, rgba(232,163,61,.10), rgba(0,0,0,0));display:flex;align-items:center;justify-content:center;';
      slot.appendChild(this.icon(this.spriteOf(choice), 84));
      card.appendChild(slot);

      const titleEl = document.createElement('div');
      titleEl.style.cssText = `color:${accent};font-size:20px;margin-bottom:4px;text-shadow:0 1px 2px #000;`;
      titleEl.innerHTML = `${title} <span style="font-size:14px;color:${isEvo ? '#5fd3c4' : '#9fb8c9'};">${tag}</span>`;
      card.appendChild(titleEl);

      const descEl = document.createElement('div');
      descEl.style.cssText = 'font-size:14px;line-height:1.4;opacity:.88;min-height:40px;';
      descEl.textContent = desc;
      card.appendChild(descEl);

      card.onclick = () => {
        if (!this.world) return;
        if (this.banishMode) {
          if (banishChoice(this.world, choice)) {
            this.banishMode = false;
            const next = currentDraft(this.world);
            if (next) this.render(next);
          }
        } else {
          applyDraftChoice(this.world, choice);
          this.sync(this.world);
        }
      };
      cards.appendChild(card);
    }

    const tool = (label: string, count: number, fn: () => void) => {
      const b = document.createElement('button');
      b.style.cssText =
        'padding:10px 22px;background:#0b0b12;border:1px solid #5fd3c4;border-radius:5px;color:#5fd3c4;cursor:pointer;font-family:inherit;font-size:15px;';
      b.textContent = `${label} (${count})`;
      if (count <= 0) {
        b.style.opacity = '0.35';
        b.style.cursor = 'default';
      } else {
        b.onclick = fn;
      }
      tools.appendChild(b);
    };
    tool('リロール', s.reroll, () => {
      if (this.world && rerollDraft(this.world)) {
        const next = currentDraft(this.world);
        if (next) this.render(next);
      }
    });
    tool('スキップ', s.skip, () => {
      if (this.world && skipDraft(this.world)) this.sync(this.world);
    });
    tool('バニッシュ', s.banish, () => {
      this.banishMode = !this.banishMode;
      const cur = currentDraft(this.world!);
      if (cur) this.render(cur);
    });

    this.el.style.display = 'flex';
  }
}
