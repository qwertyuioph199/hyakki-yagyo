import type { World } from '../game/sim/world';

/**
 * Level-up draft overlay. P2 stub: three fixed choices proving the
 * pause→choose→resume plumbing (the sim freezes itself while
 * pendingLevelUps > 0). P3 replaces the choice list with the RE'd
 * weighted draft generator + reroll/skip/banish.
 */
interface DraftChoice {
  title: string;
  desc: string;
  apply(world: World): void;
}

const STUB_CHOICES: DraftChoice[] = [
  {
    title: '御札 強化',
    desc: '御札のレベル +1',
    apply(world) {
      const w = world.player.weapons.find((x) => x.id === 'ofuda');
      if (w) w.level++;
    },
  },
  {
    title: '体力増強',
    desc: '最大HP +10、HP +10',
    apply(world) {
      world.player.stats.maxHp += 10;
      world.player.hp = Math.min(world.player.stats.maxHp, world.player.hp + 10);
    },
  },
  {
    title: '健脚',
    desc: '移動速度 +5%',
    apply(world) {
      world.player.stats.moveSpeed += 0.05;
    },
  },
];

export class DraftUi {
  private readonly el: HTMLDivElement;
  private world: World | null = null;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText =
      'position:absolute;inset:0;display:none;align-items:center;justify-content:center;' +
      'background:rgba(11,11,18,.82);z-index:10;font-family:Consolas,monospace;';
    root.appendChild(this.el);
  }

  /** Call every frame; shows itself whenever the sim has pending level-ups. */
  sync(world: World): void {
    this.world = world;
    const shouldShow = world.player.pendingLevelUps > 0 && !world.gameOver;
    const shown = this.el.style.display !== 'none';
    if (shouldShow && !shown) this.show();
    else if (!shouldShow && shown) this.el.style.display = 'none';
  }

  private show(): void {
    this.el.innerHTML = `
      <div style="text-align:center;">
        <h2 style="color:#e8a33d;letter-spacing:.3em;margin-bottom:16px;">力を選べ</h2>
        <div style="display:flex;gap:12px;justify-content:center;"></div>
      </div>`;
    const row = this.el.querySelector('div > div')!;
    for (const choice of STUB_CHOICES) {
      const card = document.createElement('button');
      card.style.cssText =
        'width:170px;padding:18px 12px;background:#16161f;border:2px solid #e8a33d;color:#f2ead8;' +
        'cursor:pointer;text-align:center;font-family:inherit;';
      card.innerHTML = `<div style="color:#e8a33d;font-size:15px;margin-bottom:8px;">${choice.title}</div><div style="font-size:12px;opacity:.8;">${choice.desc}</div>`;
      card.onclick = () => {
        const w = this.world;
        if (!w) return;
        choice.apply(w);
        w.player.pendingLevelUps--;
        this.sync(w);
      };
      row.appendChild(card);
    }
    this.el.style.display = 'flex';
  }
}
