import { SPRITES } from '../../art/spriteDefs';
import { CHARACTERS, CHARACTER_IDS, type CharacterId } from '../../data/characters';
import { POWERUPS, POWERUP_IDS, type PowerUpId } from '../../data/shop';
import { AudioEngine } from '../../engine/audio/audioEngine';
import { Music } from '../../engine/audio/music';
import { Sfx } from '../../engine/audio/synth';
import { buildAtlas } from '../../engine/atlas';
import { Camera } from '../../engine/camera';
import { Input } from '../../engine/input';
import { GameLoop, TICK_RATE } from '../../engine/loop';
import { Renderer } from '../../engine/renderer';
import { PerfHud } from '../../debug/perfHud';
import { buyRank, nextRankPrice, powerUpBonuses } from '../meta/shop';
import { exportSave, importSave, loadSave, persistSave, type SaveData } from '../meta/save';
import { RunPresenter } from '../presentation/renderRun';
import { Ev } from '../sim/events';
import { stepRun } from '../sim/step';
import { createRun, type World } from '../sim/world';
import { DraftUi } from '../../ui/draft';
import { Hud } from '../../ui/hud';

const VIEW_W = 960;
const VIEW_H = 540;

/**
 * Scene controller: title → character select → run → results, plus the
 * PowerUp shop and options. All menus are DOM overlays; the run itself is
 * the canvas + sim underneath.
 */
export class Game {
  private readonly renderer: Renderer;
  private readonly camera = new Camera();
  private readonly input = new Input();
  private readonly audio = new AudioEngine();
  private readonly sfx = new Sfx(this.audio);
  private readonly music = new Music(this.audio);
  private readonly screen: HTMLDivElement;
  private save: SaveData;
  private world: World | null = null;
  private presenter: RunPresenter | null = null;
  private hud: Hud | null = null;
  private draft: DraftUi | null = null;
  private perf: PerfHud;
  private paused = false;
  private resultShown = false;
  private simMs = 0;
  private lastFrame = performance.now();

  constructor(
    canvas: HTMLCanvasElement,
    private readonly uiRoot: HTMLElement,
  ) {
    this.renderer = new Renderer(canvas, VIEW_W, VIEW_H);
    this.renderer.setAtlas(buildAtlas(SPRITES));
    this.input.attach(window);
    this.save = loadSave();
    this.audio.setMasterVolume(this.save.settings.masterVolume);
    this.audio.setMusicVolume(this.save.settings.musicVolume);
    this.camera.shakeEnabled = this.save.settings.screenShake;

    this.screen = document.createElement('div');
    this.screen.style.cssText =
      'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(11,11,18,.92);z-index:20;font-family:Consolas,"Hiragino Sans","Yu Gothic",monospace;color:#f2ead8;';
    uiRoot.appendChild(this.screen);

    window.addEventListener('pointerdown', () => this.audio.unlock(), { once: true });
    window.addEventListener('keydown', () => this.audio.unlock(), { once: true });

    this.perf = new PerfHud(uiRoot);
    if (location.hash !== '#debug') this.perf.toggle();

    const loop = new GameLoop({
      tick: () => this.tick(),
      render: (alpha) => this.render(alpha),
    });
    loop.start();
    (window as unknown as Record<string, unknown>)['__hyakki'] = {
      game: this,
      loop,
      setTimeScale: (x: number) => {
        loop.timeScale = x;
      },
      getWorld: () => this.world,
    };

    this.showTitle();
  }

  // ---------- run lifecycle ----------

  private startRun(characterId: CharacterId): void {
    this.disposeRunUi();
    const seed = (0x9e3779b9 ^ (this.save.stats.totalRuns * 0x85ebca6b)) >>> 0;
    this.world = createRun({ seed, characterId, powerUpBonuses: powerUpBonuses(this.save.powerUps) });
    this.presenter = new RunPresenter(this.renderer, this.camera);
    this.hud = new Hud(this.uiRoot);
    this.draft = new DraftUi(this.uiRoot);
    this.resultShown = false;
    this.paused = false;
    this.screen.style.display = 'none';
    this.music.start();
    this.music.setIntensity(0.1);
  }

  private disposeRunUi(): void {
    this.hud?.destroy();
    this.hud = null;
    this.draft?.destroy();
    this.draft = null;
  }

  private endRun(): void {
    const w = this.world;
    if (!w) return;
    // Bank the run.
    this.save.gold += w.player.gold;
    this.save.stats.totalRuns++;
    this.save.stats.totalKills += w.player.kills;
    if (w.victory) this.save.stats.victories++;
    this.save.stats.bestSurvivalTicks = Math.max(this.save.stats.bestSurvivalTicks, w.tick);
    this.save.stats.maxLevel = Math.max(this.save.stats.maxLevel, w.player.level);
    persistSave(this.save);
    this.music.stop();
    this.showResults(w);
  }

  private tick(): void {
    const snapshot = this.input.sample();
    if (this.input.wasPressed('F3')) this.perf.toggle();
    if (!this.world || this.resultShown) return;

    if (this.input.wasPressed('Escape') && !this.world.gameOver) {
      this.paused = !this.paused;
      if (this.paused) this.showPause();
      else this.screen.style.display = 'none';
    }
    if (this.paused) return;

    const t0 = performance.now();
    stepRun(this.world, snapshot);
    this.presenter?.consumeEvents(this.world);
    this.bindSfx(this.world);
    this.camera.tick();
    this.simMs = performance.now() - t0;

    const minute = this.world.tick / (TICK_RATE * 60);
    this.music.setIntensity(Math.min(1, minute / 30) * 0.55 + Math.min(0.45, this.world.enemies.count / 400));

    if (this.world.gameOver && !this.resultShown) {
      this.resultShown = true;
      this.endRun();
    }
  }

  private render(alpha: number): void {
    const t0 = performance.now();
    if (this.world && this.presenter) {
      this.presenter.render(this.world, alpha);
      this.hud?.update(this.world);
      this.draft?.sync(this.world);
    }
    const now = performance.now();
    this.perf.record(now - this.lastFrame, this.simMs, now - t0);
    this.lastFrame = now;
  }

  private bindSfx(world: World): void {
    for (let i = 0; i < world.events.count; i++) {
      const e = world.events.get(i);
      switch (e.type) {
        case Ev.DamageDealt:
          this.sfx.play('hit', 0.7);
          break;
        case Ev.EnemyDied:
          this.sfx.play('kill');
          break;
        case Ev.GemPicked:
          this.sfx.play('pickup');
          break;
        case Ev.GoldGained:
          this.sfx.play('coin');
          break;
        case Ev.LevelUp:
          this.sfx.play('levelup');
          break;
        case Ev.ChestOpened:
          this.sfx.play('chest');
          break;
        case Ev.EvolutionUnlocked:
          this.sfx.play('evolution');
          break;
        case Ev.PlayerHurt:
          this.sfx.play('hurt');
          break;
        case Ev.SwarmEvent:
          this.sfx.play('swarm');
          break;
        case Ev.BossSpawned:
          this.sfx.play('boss');
          break;
        case Ev.DawnBreaks:
          this.sfx.play('dawn');
          break;
        default:
          break;
      }
    }
  }

  // ---------- screens ----------

  private btn(label: string, onClick: () => void, accent = '#e8a33d'): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText =
      `display:block;margin:6px auto;padding:10px 34px;background:#16161f;border:2px solid ${accent};` +
      `color:${accent};cursor:pointer;font-family:inherit;font-size:15px;letter-spacing:.15em;min-width:240px;`;
    b.onclick = () => {
      this.sfx.play('click');
      onClick();
    };
    return b;
  }

  private showTitle(): void {
    const s = this.save;
    this.screen.innerHTML = `
      <div style="text-align:center;">
        <div style="font-size:56px;color:#e8a33d;letter-spacing:.35em;text-shadow:0 0 24px rgba(232,163,61,.4);margin-bottom:2px;">百鬼夜行</div>
        <div style="font-size:13px;color:#9fb8c9;letter-spacing:.5em;margin-bottom:26px;">HYAKKI YAGYO — 夜明けまで生き延びろ</div>
        <div class="hy-menu"></div>
        <div style="margin-top:22px;font-size:12px;color:#9fb8c9;">
          所持金 <span style="color:#f5c542;">${s.gold}</span> 文 ・ 討伐 ${s.stats.totalKills} ・ 出撃 ${s.stats.totalRuns} ・ 夜明け ${s.stats.victories} 回
        </div>
        <div style="margin-top:10px;font-size:11px;color:#5a5a6a;">WASD/矢印: 移動 ・ Esc: ポーズ ・ 武器は自動で戦う</div>
      </div>`;
    const menu = this.screen.querySelector('.hy-menu')!;
    menu.appendChild(this.btn('出撃', () => this.showCharSelect()));
    menu.appendChild(this.btn('強化(護符)', () => this.showShop(), '#5fd3c4'));
    menu.appendChild(this.btn('設定', () => this.showOptions(), '#9fb8c9'));
    this.screen.style.display = 'flex';
  }

  private showCharSelect(): void {
    this.screen.innerHTML = `
      <div style="text-align:center;max-width:860px;">
        <h2 style="color:#e8a33d;letter-spacing:.3em;margin-bottom:18px;">誰で夜を征く?</h2>
        <div class="hy-chars" style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;"></div>
        <div class="hy-back" style="margin-top:18px;"></div>
      </div>`;
    const grid = this.screen.querySelector('.hy-chars')!;
    for (const id of CHARACTER_IDS) {
      const def = CHARACTERS[id];
      const unlocked = this.save.unlockedCharacters.includes(id);
      const affordable = this.save.gold >= def.unlockCost;
      const card = document.createElement('button');
      card.style.cssText =
        `width:190px;padding:14px 10px;background:#16161f;border:2px solid ${unlocked ? '#e8a33d' : affordable ? '#5fd3c4' : '#3a3a45'};` +
        `color:#f2ead8;cursor:pointer;font-family:inherit;text-align:center;${unlocked || affordable ? '' : 'opacity:.55;'}`;
      card.innerHTML = `
        <div style="color:#e8a33d;font-size:15px;margin-bottom:6px;">${def.name}</div>
        <div style="font-size:11px;opacity:.85;min-height:44px;">${def.desc}</div>
        ${unlocked ? '' : `<div style="margin-top:8px;font-size:12px;color:${affordable ? '#f5c542' : '#666'};">解放: ${def.unlockCost} 文</div>`}`;
      card.onclick = () => {
        this.sfx.play('click');
        if (unlocked) {
          this.startRun(id);
        } else if (affordable) {
          this.save.gold -= def.unlockCost;
          this.save.unlockedCharacters.push(id);
          persistSave(this.save);
          this.sfx.play('chest');
          this.showCharSelect();
        }
      };
      grid.appendChild(card);
    }
    this.screen.querySelector('.hy-back')!.appendChild(this.btn('戻る', () => this.showTitle(), '#9fb8c9'));
    this.screen.style.display = 'flex';
  }

  private showPause(): void {
    this.screen.innerHTML = `
      <div style="text-align:center;">
        <h2 style="color:#e8a33d;letter-spacing:.3em;margin-bottom:18px;">小休止</h2>
        <div class="hy-menu"></div>
      </div>`;
    const menu = this.screen.querySelector('.hy-menu')!;
    menu.appendChild(this.btn('再開', () => {
      this.paused = false;
      this.screen.style.display = 'none';
    }));
    menu.appendChild(this.btn('設定', () => this.showOptions(true), '#9fb8c9'));
    menu.appendChild(
      this.btn('夜を諦める', () => {
        if (this.world) {
          this.world.gameOver = true;
          this.paused = false;
          this.resultShown = true;
          this.endRun();
        }
      }, '#b03a3a'),
    );
    this.screen.style.display = 'flex';
  }

  private showResults(w: World): void {
    const minutes = Math.floor(w.tick / (TICK_RATE * 60));
    const seconds = Math.floor(w.tick / TICK_RATE) % 60;
    const title = w.victory ? '夜 明 け' : '力尽きた…';
    const color = w.victory ? '#f5c542' : '#b03a3a';
    this.screen.innerHTML = `
      <div style="text-align:center;">
        <div style="font-size:44px;color:${color};letter-spacing:.35em;margin-bottom:16px;">${title}</div>
        ${w.victory ? '<div style="color:#9fb8c9;font-size:13px;margin-bottom:14px;">百鬼の夜を生き延びた。朝日が全てを浄化する——</div>' : ''}
        <div style="font-size:14px;line-height:2;color:#f2ead8;">
          生存時間 <b>${minutes}:${String(seconds).padStart(2, '0')}</b><br/>
          討伐数 <b>${w.player.kills}</b> ・ 到達レベル <b>${w.player.level}</b><br/>
          獲得 <b style="color:#f5c542;">${w.player.gold} 文</b>(合計 ${this.save.gold} 文)
        </div>
        <div class="hy-menu" style="margin-top:22px;"></div>
      </div>`;
    const menu = this.screen.querySelector('.hy-menu')!;
    menu.appendChild(this.btn('タイトルへ', () => {
      this.world = null;
      this.disposeRunUi();
      this.showTitle();
    }));
    this.screen.style.display = 'flex';
  }

  private showShop(): void {
    const rows = POWERUP_IDS.map((id) => this.shopRow(id)).join('');
    this.screen.innerHTML = `
      <div style="text-align:center;max-width:760px;max-height:92vh;overflow:auto;">
        <h2 style="color:#5fd3c4;letter-spacing:.3em;margin:10px 0 4px;">護符強化</h2>
        <div style="font-size:12px;color:#9fb8c9;margin-bottom:10px;">買うたびに全品が1割ずつ値上がる。高い護符から買うのが知恵。<br/>所持金 <span style="color:#f5c542;" class="hy-gold">${this.save.gold}</span> 文</div>
        <div class="hy-shop" style="text-align:left;">${rows}</div>
        <div class="hy-menu" style="margin:14px 0;"></div>
      </div>`;
    const menu = this.screen.querySelector('.hy-menu')!;
    menu.appendChild(
      this.btn('全て返金', () => {
        this.save.gold += this.save.goldSpent;
        this.save.goldSpent = 0;
        this.save.powerUps = {};
        persistSave(this.save);
        this.showShop();
      }, '#b03a3a'),
    );
    menu.appendChild(this.btn('戻る', () => this.showTitle(), '#9fb8c9'));
    this.screen.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((b) => {
      b.onclick = () => {
        const id = b.dataset['buy'] as PowerUpId;
        const result = buyRank(id, this.save.powerUps, this.save.gold);
        if (result) {
          this.save.powerUps = result.ranks;
          this.save.gold = result.goldLeft;
          this.save.goldSpent += result.spent;
          persistSave(this.save);
          this.sfx.play('coin');
          this.showShop();
        }
      };
    });
    this.screen.style.display = 'flex';
  }

  private shopRow(id: PowerUpId): string {
    const def = POWERUPS[id];
    const rank = this.save.powerUps[id] ?? 0;
    const price = nextRankPrice(id, this.save.powerUps);
    const pips = Array.from({ length: def.maxRank }, (_, i) => (i < rank ? '●' : '○')).join('');
    const buyable = price !== null && price <= this.save.gold;
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-bottom:1px solid #22222e;font-size:13px;">
        <div style="width:120px;color:#e8a33d;">${def.name}</div>
        <div style="flex:1;color:#9fb8c9;font-size:11px;">${def.desc}</div>
        <div style="width:70px;color:#5fd3c4;">${pips}</div>
        <div style="width:120px;text-align:right;">
          ${price === null ? '<span style="color:#666;">極</span>' : `<button data-buy="${id}" style="background:#16161f;border:1px solid ${buyable ? '#f5c542' : '#3a3a45'};color:${buyable ? '#f5c542' : '#666'};cursor:${buyable ? 'pointer' : 'default'};padding:3px 10px;font-family:inherit;">${price} 文</button>`}
        </div>
      </div>`;
  }

  private showOptions(fromPause = false): void {
    const s = this.save.settings;
    this.screen.innerHTML = `
      <div style="text-align:center;max-width:520px;">
        <h2 style="color:#9fb8c9;letter-spacing:.3em;margin-bottom:16px;">設定</h2>
        <div style="font-size:13px;line-height:2.6;text-align:left;">
          <label style="display:flex;justify-content:space-between;align-items:center;">音量
            <input class="hy-vol" type="range" min="0" max="100" value="${Math.round(s.masterVolume * 100)}" /></label>
          <label style="display:flex;justify-content:space-between;align-items:center;">音楽
            <input class="hy-mus" type="range" min="0" max="100" value="${Math.round(s.musicVolume * 100)}" /></label>
          <label style="display:flex;justify-content:space-between;align-items:center;">画面振動
            <input class="hy-shake" type="checkbox" ${s.screenShake ? 'checked' : ''} /></label>
        </div>
        <div style="margin-top:14px;font-size:11px;color:#9fb8c9;">セーブの持ち出し(コピーして保管):</div>
        <textarea class="hy-export" style="width:100%;height:56px;background:#16161f;color:#5fd3c4;border:1px solid #3a3a45;font-size:10px;"></textarea>
        <div class="hy-menu" style="margin-top:14px;"></div>
      </div>`;
    const vol = this.screen.querySelector<HTMLInputElement>('.hy-vol')!;
    const mus = this.screen.querySelector<HTMLInputElement>('.hy-mus')!;
    const shake = this.screen.querySelector<HTMLInputElement>('.hy-shake')!;
    const exportBox = this.screen.querySelector<HTMLTextAreaElement>('.hy-export')!;
    exportBox.value = exportSave(this.save);
    vol.oninput = () => {
      s.masterVolume = Number(vol.value) / 100;
      this.audio.setMasterVolume(s.masterVolume);
      persistSave(this.save);
    };
    mus.oninput = () => {
      s.musicVolume = Number(mus.value) / 100;
      this.audio.setMusicVolume(s.musicVolume);
      persistSave(this.save);
    };
    shake.onchange = () => {
      s.screenShake = shake.checked;
      this.camera.shakeEnabled = s.screenShake;
      persistSave(this.save);
    };
    const menu = this.screen.querySelector('.hy-menu')!;
    menu.appendChild(
      this.btn('セーブ読込(上の欄に貼り付け)', () => {
        const imported = importSave(exportBox.value);
        if (imported) {
          this.save = imported;
          persistSave(this.save);
          this.audio.setMasterVolume(this.save.settings.masterVolume);
          this.audio.setMusicVolume(this.save.settings.musicVolume);
          this.sfx.play('chest');
          this.showOptions(fromPause);
        }
      }, '#5fd3c4'),
    );
    menu.appendChild(
      this.btn('戻る', () => {
        if (fromPause) this.showPause();
        else this.showTitle();
      }, '#9fb8c9'),
    );
    this.screen.style.display = 'flex';
  }
}

export function startGame(canvas: HTMLCanvasElement, uiRoot: HTMLElement): void {
  new Game(canvas, uiRoot);
}
