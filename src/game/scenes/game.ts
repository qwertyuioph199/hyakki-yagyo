import { loadOverrides, OVERRIDABLE_IDS, spritesWithOverrides } from '../../art/overrides';
import { SPRITES } from '../../art/spriteDefs';
import { spawnEnemyAtPos } from '../sim/spawnSystem';
import { ACHIEVEMENTS, ACHIEVEMENT_IDS, evaluateAchievements, type AchievementId } from '../../data/achievements';
import { CHARACTERS, CHARACTER_IDS, type CharacterId } from '../../data/characters';
import { ENEMIES, ENEMY_IDS } from '../../data/enemies';
import { POWERUPS, POWERUP_IDS, type PowerUpId } from '../../data/shop';
import { STAGES, STAGE_IDS, type StageId } from '../../data/stages';
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
  /** Per-run bestiary tally, merged into the save at run end. */
  private runBestiary = new Map<string, number>();
  private runEvolutions = 0;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly uiRoot: HTMLElement,
  ) {
    this.renderer = new Renderer(canvas, VIEW_W, VIEW_H);
    this.renderer.setAtlas(buildAtlas(SPRITES));
    // AI-art sprite overrides load in the background; the atlas is rebuilt
    // once they arrive (procedural art shows until then). Drop transparent
    // PNGs at public/assets/sprites/<id>.png — see ASSETS_GPTIMAGE2.md.
    void loadOverrides().then((ov) => {
      if (ov.size === 0) return;
      this.renderer.setAtlas(buildAtlas(spritesWithOverrides(ov)));
      this.hud?.setAtlas(this.renderer.atlas);
      // eslint-disable-next-line no-console
      console.log(`[hyakki] AI sprite overrides loaded: ${[...ov.keys()].join(', ')}`);
    });
    // AI-generated ground textures load in the background; runs started
    // before they arrive just show the flat stage color.
    for (const id of STAGE_IDS) {
      const img = new Image();
      img.onload = () => this.renderer.registerGroundTexture(id, img, STAGES[id].bg + '99');
      img.src = STAGES[id].groundTexture;
    }
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
      // Print which AI-art slots exist and which currently have a PNG.
      listAssetSlots: async () => {
        const ov = await loadOverrides();
        return OVERRIDABLE_IDS.map((id) => `${ov.has(id) ? '✔' : '·'} ${id}`).join('\n');
      },
      // Fabricate a dense horde around the player (rAF-independent test aid).
      stressSpawn: (n: number) => this.debugStressSpawn(n),
      // Time N render() calls synchronously — measures per-frame render cost
      // regardless of background rAF throttling.
      benchRender: (frames = 300) => this.debugBenchRender(frames),
    };

    this.showTitle();
  }

  // ---------- run lifecycle ----------

  private startRun(characterId: CharacterId, stageId: StageId): void {
    this.disposeRunUi();
    this.runBestiary.clear();
    this.runEvolutions = 0;
    const seed = (0x9e3779b9 ^ (this.save.stats.totalRuns * 0x85ebca6b)) >>> 0;
    this.world = createRun({ seed, characterId, stageId, powerUpBonuses: powerUpBonuses(this.save.powerUps) });
    this.presenter = new RunPresenter(this.renderer, this.camera);
    this.hud = new Hud(this.uiRoot, this.renderer.atlas);
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
    if (w.victory) {
      this.save.stats.victories++;
      if (w.stageId === 'toge') this.save.stats.togeVictories++;
    }
    this.save.stats.bestSurvivalTicks = Math.max(this.save.stats.bestSurvivalTicks, w.tick);
    this.save.stats.maxLevel = Math.max(this.save.stats.maxLevel, w.player.level);
    this.save.stats.bestKills = Math.max(this.save.stats.bestKills, w.player.kills);
    this.save.stats.evolutionsSeen += this.runEvolutions;
    this.save.stats.maxWeaponsHeld = Math.max(this.save.stats.maxWeaponsHeld, w.player.weapons.length);
    for (const [id, n] of this.runBestiary) {
      this.save.bestiary[id] = (this.save.bestiary[id] ?? 0) + n;
    }
    const earned = evaluateAchievements(this.save);
    persistSave(this.save);
    this.music.stop();
    this.showResults(w, earned);
  }

  private tick(): void {
    // Read one-shot keys BEFORE sample() clears the pressed set.
    const escPressed = this.input.wasPressed('Escape');
    const f3Pressed = this.input.wasPressed('F3');
    const snapshot = this.input.sample();
    if (f3Pressed) this.perf.toggle();
    if (!this.world || this.resultShown) return;

    if (escPressed && !this.world.gameOver) {
      this.paused = !this.paused;
      if (this.paused) this.showPause();
      else this.screen.style.display = 'none';
    }
    if (this.paused) return;

    const t0 = performance.now();
    const tickBefore = this.world.tick;
    stepRun(this.world, snapshot);
    // The sim freezes during drafts/game-over without clearing its event
    // buffer — draining it again would replay the same SFX every tick.
    if (this.world.tick !== tickBefore) {
      this.presenter?.consumeEvents(this.world);
      this.bindSfx(this.world);
    }
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

  private debugStressSpawn(n: number): number {
    const w = this.world;
    if (!w) return 0;
    let spawned = 0;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const dist = 40 + (i % 200);
      if (spawnEnemyAtPos(w, 'oni', w.player.x + Math.cos(ang) * dist, w.player.y + Math.sin(ang) * dist)) {
        spawned++;
      }
    }
    return spawned;
  }

  private debugBenchRender(frames: number): unknown {
    const times: number[] = [];
    for (let f = 0; f < frames; f++) {
      const t0 = performance.now();
      this.render(1);
      this.renderer.ctx.getImageData(0, 0, 1, 1); // force raster flush
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const pick = (p: number) => times[Math.min(frames - 1, Math.floor(frames * p))]!;
    return {
      p50: +pick(0.5).toFixed(2),
      p95: +pick(0.95).toFixed(2),
      p99: +pick(0.99).toFixed(2),
      mean: +(times.reduce((a, b) => a + b, 0) / frames).toFixed(2),
      frames,
      enemies: this.world?.enemies.count ?? 0,
      projectiles: this.world?.projectiles.count ?? 0,
    };
  }

  private bindSfx(world: World): void {
    for (let i = 0; i < world.events.count; i++) {
      const e = world.events.get(i);
      switch (e.type) {
        case Ev.DamageDealt:
          this.sfx.play('hit', 0.7);
          break;
        case Ev.EnemyDied: {
          this.sfx.play('kill');
          const id = ENEMY_IDS[e.a];
          if (id) this.runBestiary.set(id, (this.runBestiary.get(id) ?? 0) + 1);
          break;
        }
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
          this.runEvolutions++;
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
    this.screen.style.background =
      'linear-gradient(rgba(11,11,18,.55), rgba(11,11,18,.88)), url(../assets/bg_title.jpg) center/cover no-repeat #0b0b12';
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
    menu.appendChild(this.btn(`実績 (${this.save.achievements.length}/${ACHIEVEMENT_IDS.length})`, () => this.showAchievements(), '#f5c542'));
    menu.appendChild(this.btn('図鑑', () => this.showBestiary(), '#8a6fc9'));
    menu.appendChild(this.btn('設定', () => this.showOptions(), '#9fb8c9'));
    this.screen.style.display = 'flex';
  }

  private showAchievements(): void {
    const rows = ACHIEVEMENT_IDS.map((id) => {
      const def = ACHIEVEMENTS[id];
      const got = this.save.achievements.includes(id);
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:7px 10px;border-bottom:1px solid #22222e;${got ? '' : 'opacity:.45;'}">
          <div style="font-size:18px;">${got ? '🏮' : '○'}</div>
          <div style="width:130px;color:${got ? '#f5c542' : '#9fb8c9'};font-size:13px;">${def.name}</div>
          <div style="flex:1;color:#9fb8c9;font-size:11px;text-align:left;">${def.desc}</div>
        </div>`;
    }).join('');
    this.screen.innerHTML = `
      <div style="text-align:center;max-width:640px;max-height:92vh;overflow:auto;">
        <h2 style="color:#f5c542;letter-spacing:.3em;margin:10px 0;">実績 ${this.save.achievements.length}/${ACHIEVEMENT_IDS.length}</h2>
        <div>${rows}</div>
        <div class="hy-menu" style="margin:14px 0;"></div>
      </div>`;
    this.screen.querySelector('.hy-menu')!.appendChild(this.btn('戻る', () => this.showTitle(), '#9fb8c9'));
    this.screen.style.display = 'flex';
  }

  private showBestiary(): void {
    const cells = ENEMY_IDS.filter((id) => id !== 'akatsuki').map((id) => {
      const def = ENEMIES[id];
      const kills = this.save.bestiary[id] ?? 0;
      const known = kills > 0;
      return `
        <div style="width:118px;padding:10px 6px;background:#16161f;border:1px solid ${known ? '#3a3a45' : '#22222e'};text-align:center;${known ? '' : 'opacity:.4;'}">
          <canvas data-sprite="${def.sprite}" width="40" height="40" style="image-rendering:pixelated;"></canvas>
          <div style="font-size:12px;color:${known ? '#e8a33d' : '#5a5a6a'};">${known ? def.name : '???'}</div>
          <div style="font-size:10px;color:#9fb8c9;">討伐 ${kills}</div>
        </div>`;
    }).join('');
    this.screen.innerHTML = `
      <div style="text-align:center;max-width:820px;max-height:92vh;overflow:auto;">
        <h2 style="color:#8a6fc9;letter-spacing:.3em;margin:10px 0;">妖怪図鑑</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">${cells}</div>
        <div class="hy-menu" style="margin:14px 0;"></div>
      </div>`;
    // Draw enemy sprites from the atlas into the mini canvases.
    const atlas = this.renderer.atlas;
    this.screen.querySelectorAll<HTMLCanvasElement>('canvas[data-sprite]').forEach((cv) => {
      const frame = atlas.frame(cv.dataset['sprite']!, 0);
      const ctx = cv.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      const scale = Math.min(40 / frame.w, 40 / frame.h, 2);
      ctx.drawImage(
        atlas.source,
        frame.sx,
        frame.sy,
        frame.w,
        frame.h,
        (40 - frame.w * scale) / 2,
        (40 - frame.h * scale) / 2,
        frame.w * scale,
        frame.h * scale,
      );
    });
    this.screen.querySelector('.hy-menu')!.appendChild(this.btn('戻る', () => this.showTitle(), '#9fb8c9'));
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
        `position:relative;width:200px;padding:0 0 12px;overflow:hidden;background:#16161f;border:2px solid ${unlocked ? '#e8a33d' : affordable ? '#5fd3c4' : '#3a3a45'};` +
        `color:#f2ead8;cursor:pointer;font-family:inherit;text-align:center;${unlocked || affordable ? '' : 'opacity:.55;'}`;
      // Full-bleed AI portrait (falls back to a flat panel if absent).
      const locked = !unlocked;
      card.innerHTML = `
        <div style="height:230px;background:linear-gradient(rgba(11,11,18,0) 55%, #16161f), url(../assets/portraits/${id}.jpg) center top/cover no-repeat #0b0b12;${locked ? 'filter:grayscale(.8) brightness(.5);' : ''}"></div>
        <div style="color:#e8a33d;font-size:16px;margin:-6px 0 6px;text-shadow:0 1px 3px #000;">${def.name}</div>
        <div style="font-size:11px;opacity:.85;min-height:44px;padding:0 10px;">${def.desc}</div>
        ${unlocked ? '' : `<div style="margin-top:6px;font-size:12px;color:${affordable ? '#f5c542' : '#666'};">解放: ${def.unlockCost} 文</div>`}`;
      card.onclick = () => {
        this.sfx.play('click');
        if (unlocked) {
          this.showStageSelect(id);
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

  private showStageSelect(characterId: CharacterId): void {
    const bestMin = this.save.stats.bestSurvivalTicks / (TICK_RATE * 60);
    this.screen.innerHTML = `
      <div style="text-align:center;max-width:720px;">
        <h2 style="color:#e8a33d;letter-spacing:.3em;margin-bottom:18px;">何処の夜へ?</h2>
        <div class="hy-stages" style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;"></div>
        <div class="hy-back" style="margin-top:18px;"></div>
      </div>`;
    const grid = this.screen.querySelector('.hy-stages')!;
    for (const id of STAGE_IDS) {
      const def = STAGES[id];
      const unlocked = bestMin >= def.unlockMinutes;
      const card = document.createElement('button');
      card.style.cssText =
        `width:250px;padding:18px 14px;background:${def.bg};border:2px solid ${unlocked ? '#e8a33d' : '#3a3a45'};` +
        `color:#f2ead8;cursor:pointer;font-family:inherit;text-align:center;${unlocked ? '' : 'opacity:.55;'}`;
      card.innerHTML = `
        <div style="color:#e8a33d;font-size:16px;margin-bottom:8px;">${def.name}</div>
        <div style="font-size:11px;opacity:.85;min-height:48px;">${def.desc}</div>`;
      card.onclick = () => {
        this.sfx.play('click');
        if (unlocked) this.startRun(characterId, id);
      };
      grid.appendChild(card);
    }
    this.screen.querySelector('.hy-back')!.appendChild(this.btn('戻る', () => this.showCharSelect(), '#9fb8c9'));
    this.screen.style.display = 'flex';
  }

  private showPause(): void {
    this.screen.style.background = 'rgba(11,11,18,.85)';
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

  private showResults(w: World, earned: AchievementId[] = []): void {
    const minutes = Math.floor(w.tick / (TICK_RATE * 60));
    const seconds = Math.floor(w.tick / TICK_RATE) % 60;
    const title = w.victory ? '夜 明 け' : '力尽きた…';
    const color = w.victory ? '#f5c542' : '#b03a3a';
    const earnedHtml = earned.length
      ? `<div style="margin-top:14px;font-size:13px;color:#f5c542;">実績解除: ${earned.map((id) => `「${ACHIEVEMENTS[id].name}」`).join(' ')}</div>`
      : '';
    this.screen.style.background = 'rgba(11,11,18,.92)';
    this.screen.innerHTML = `
      <div style="text-align:center;">
        <div style="font-size:44px;color:${color};letter-spacing:.35em;margin-bottom:16px;">${title}</div>
        ${w.victory ? '<div style="color:#9fb8c9;font-size:13px;margin-bottom:14px;">百鬼の夜を生き延びた。朝日が全てを浄化する——</div>' : ''}
        <div style="font-size:14px;line-height:2;color:#f2ead8;">
          ${STAGES[w.stageId].name} ・ 生存時間 <b>${minutes}:${String(seconds).padStart(2, '0')}</b><br/>
          討伐数 <b>${w.player.kills}</b> ・ 到達レベル <b>${w.player.level}</b><br/>
          獲得 <b style="color:#f5c542;">${w.player.gold} 文</b>(合計 ${this.save.gold} 文)
        </div>
        ${earnedHtml}
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
