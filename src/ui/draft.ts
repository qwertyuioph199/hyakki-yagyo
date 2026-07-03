import { PASSIVES, type PassiveId } from '../data/passives';
import { WEAPONS, type WeaponId } from '../data/weapons';
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
 */
export class DraftUi {
  private readonly el: HTMLDivElement;
  private world: World | null = null;
  private banishMode = false;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText =
      'position:absolute;inset:0;display:none;align-items:center;justify-content:center;' +
      'background:rgba(11,11,18,.82);z-index:10;font-family:Consolas,monospace;';
    root.appendChild(this.el);
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

  private label(c: DraftChoice): { title: string; desc: string } {
    switch (c.kind) {
      case 'weapon': {
        const def = WEAPONS[c.id as WeaponId];
        return {
          title: `${def.name}${c.toLevel > 1 ? ` Lv${c.toLevel}` : ' (新)'}`,
          desc: def.desc,
        };
      }
      case 'passive': {
        const def = PASSIVES[c.id as PassiveId];
        return {
          title: `${def.name}${c.toLevel > 1 ? ` Lv${c.toLevel}` : ' (新)'}`,
          desc: def.desc,
        };
      }
      case 'gold':
        return { title: `金 +${c.toLevel}`, desc: '路銀の足しに。' };
      case 'food':
        return { title: '御饌', desc: `HP +${c.toLevel} 回復` };
    }
  }

  private render(draft: DraftChoice[]): void {
    const w = this.world!;
    const s = w.player.stats;
    this.el.innerHTML = `
      <div style="text-align:center;">
        <h2 style="color:#e8a33d;letter-spacing:.3em;margin-bottom:6px;">力を選べ</h2>
        <div style="color:#9fb8c9;font-size:11px;margin-bottom:14px;" class="hy-banish-hint"></div>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;" class="hy-cards"></div>
        <div style="margin-top:16px;display:flex;gap:10px;justify-content:center;" class="hy-tools"></div>
      </div>`;
    const cards = this.el.querySelector('.hy-cards')!;
    const tools = this.el.querySelector('.hy-tools')!;
    const hint = this.el.querySelector('.hy-banish-hint') as HTMLElement;
    hint.textContent = this.banishMode ? '祓う対象を選べ(バニッシュ)' : '';

    for (const choice of draft) {
      const { title, desc } = this.label(choice);
      const card = document.createElement('button');
      card.style.cssText =
        `width:170px;padding:18px 12px;background:#16161f;border:2px solid ${this.banishMode ? '#b03a3a' : '#e8a33d'};` +
        'color:#f2ead8;cursor:pointer;text-align:center;font-family:inherit;';
      card.innerHTML = `<div style="color:${this.banishMode ? '#b03a3a' : '#e8a33d'};font-size:15px;margin-bottom:8px;">${title}</div><div style="font-size:12px;opacity:.8;">${desc}</div>`;
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
        'padding:8px 16px;background:#0b0b12;border:1px solid #5fd3c4;color:#5fd3c4;cursor:pointer;font-family:inherit;font-size:12px;';
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
