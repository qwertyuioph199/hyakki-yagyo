import { buildAtlas, type AtlasEntry } from '../engine/atlas';
import { GameLoop, TICK_DT } from '../engine/loop';
import { Pool } from '../engine/pool';
import { Renderer } from '../engine/renderer';
import { Rng } from '../engine/rng';
import { SpatialHash } from '../engine/spatialHash';
import { PerfHud } from './perfHud';

/**
 * /play/#perf — the Phase 1 performance gate. Simulates the real workload
 * shape before any game content exists: 600 wandering enemies with
 * spatial-hash separation queries + 400 moving projectiles with hit queries,
 * all atlas-blitted. Pass = p95 frame time <= 16.7ms over 600 frames.
 */
const ENEMIES = 600;
const PROJECTILES = 400;
const VIEW_W = 960;
const VIEW_H = 540;
// Worst case: keep the whole horde inside the 960x540 view so culling can't
// help (real gameplay concentrates enemies around the player anyway).
const WORLD_R = 260;

interface Mob {
  x: number;
  y: number;
  px: number;
  py: number;
  phase: number;
  speed: number;
  kind: number;
}

const placeholderEntries: AtlasEntry[] = [
  {
    id: 'mob0',
    w: 24,
    h: 24,
    frames: 2,
    paint: (ctx, f, w, h) => {
      ctx.fillStyle = '#5fd3c4';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2 - 2 - f, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0b0b12';
      ctx.fillRect(w / 2 - 5, h / 2 - 3, 3, 4);
      ctx.fillRect(w / 2 + 2, h / 2 - 3, 3, 4);
    },
  },
  {
    id: 'mob1',
    w: 28,
    h: 28,
    frames: 2,
    paint: (ctx, f, w, h) => {
      ctx.fillStyle = '#e8a33d';
      ctx.fillRect(3, 3 + f, w - 6, h - 6 - f);
      ctx.fillStyle = '#0b0b12';
      ctx.fillRect(w / 2 - 6, h / 2 - 4, 4, 5);
      ctx.fillRect(w / 2 + 2, h / 2 - 4, 4, 5);
    },
  },
  {
    id: 'shot',
    w: 12,
    h: 12,
    frames: 1,
    paint: (ctx, _f, w, h) => {
      ctx.fillStyle = '#f2ead8';
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w, h / 2);
      ctx.lineTo(w / 2, h);
      ctx.lineTo(0, h / 2);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    id: 'hero',
    w: 28,
    h: 32,
    frames: 1,
    paint: (ctx, _f, w, h) => {
      ctx.fillStyle = '#f2ead8';
      ctx.fillRect(6, 4, w - 12, h - 8);
      ctx.fillStyle = '#b03a3a';
      ctx.fillRect(6, h - 12, w - 12, 8);
    },
  },
];

export function startStress(canvas: HTMLCanvasElement, uiRoot: HTMLElement): void {
  const renderer = new Renderer(canvas, VIEW_W, VIEW_H);
  renderer.setAtlas(buildAtlas(placeholderEntries));
  const hud = new PerfHud(uiRoot);
  const rng = new Rng(2026);

  const mobs = new Pool<Mob>(ENEMIES, () => ({ x: 0, y: 0, px: 0, py: 0, phase: 0, speed: 0, kind: 0 }));
  const shots = new Pool<Mob>(PROJECTILES, () => ({ x: 0, y: 0, px: 0, py: 0, phase: 0, speed: 0, kind: 0 }));
  const hash = new SpatialHash(48, ENEMIES);
  const neighbors = new Int32Array(32);

  for (let i = 0; i < ENEMIES; i++) {
    const m = mobs.alloc()!;
    m.x = m.px = rng.float(-WORLD_R, WORLD_R);
    m.y = m.py = rng.float(-WORLD_R, WORLD_R);
    m.phase = rng.float(0, Math.PI * 2);
    m.speed = rng.float(30, 70);
    m.kind = rng.int(2);
  }
  for (let i = 0; i < PROJECTILES; i++) {
    const s = shots.alloc()!;
    s.x = s.px = rng.float(-WORLD_R, WORLD_R);
    s.y = s.py = rng.float(-WORLD_R, WORLD_R);
    s.phase = rng.float(0, Math.PI * 2);
    s.speed = rng.float(180, 320);
  }

  let simMs = 0;
  let renderMs = 0;
  let lastFrameStart = performance.now();
  let t = 0;

  const hooks = {
    tick() {
      const t0 = performance.now();
      t += TICK_DT;

      hash.clear();
      for (let i = 0; i < mobs.count; i++) {
        const m = mobs.items[i]!;
        hash.insert(i, m.x, m.y);
      }

      for (let i = 0; i < mobs.count; i++) {
        const m = mobs.items[i]!;
        m.px = m.x;
        m.py = m.y;
        // Wander toward the center with a per-entity oscillation.
        const ang = m.phase + t * 0.6;
        let vx = Math.cos(ang) * 0.6 - m.x / WORLD_R;
        let vy = Math.sin(ang) * 0.6 - m.y / WORLD_R;
        // Separation: push away from up to 4 grid neighbors (the real
        // per-tick workload of the horde sim).
        const n = hash.query(m.x, m.y, 20, neighbors);
        let pushed = 0;
        for (let k = 0; k < n && pushed < 4; k++) {
          const j = neighbors[k]!;
          if (j === i) continue;
          const o = mobs.items[j]!;
          const dx = m.x - o.x;
          const dy = m.y - o.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > 0.01 && d2 < 400) {
            const inv = 1 / Math.sqrt(d2);
            vx += dx * inv * 0.8;
            vy += dy * inv * 0.8;
            pushed++;
          }
        }
        const vlen = Math.sqrt(vx * vx + vy * vy) || 1;
        m.x += (vx / vlen) * m.speed * TICK_DT;
        m.y += (vy / vlen) * m.speed * TICK_DT;
      }

      for (let i = 0; i < shots.count; i++) {
        const s = shots.items[i]!;
        s.px = s.x;
        s.py = s.y;
        s.x += Math.cos(s.phase) * s.speed * TICK_DT;
        s.y += Math.sin(s.phase) * s.speed * TICK_DT;
        // Hit query (workload only — nothing dies in the stress scene).
        hash.query(s.x, s.y, 14, neighbors);
        if (s.x < -WORLD_R || s.x > WORLD_R || s.y < -WORLD_R || s.y > WORLD_R) {
          s.phase += Math.PI + 0.4;
        }
      }
      simMs = performance.now() - t0;
    },
    render(alpha) {
      const t0 = performance.now();
      renderer.begin(0, 0, '#0b0b12');
      const atlas = renderer.atlas;
      for (let i = 0; i < mobs.count; i++) {
        const m = mobs.items[i]!;
        const frame = atlas.frame(m.kind === 0 ? 'mob0' : 'mob1', ((t * 4) | 0) % 2);
        renderer.blit(frame, m.px + (m.x - m.px) * alpha, m.py + (m.y - m.py) * alpha);
      }
      const shotFrame = atlas.frame('shot');
      for (let i = 0; i < shots.count; i++) {
        const s = shots.items[i]!;
        renderer.blit(shotFrame, s.px + (s.x - s.px) * alpha, s.py + (s.y - s.py) * alpha);
      }
      renderer.blit(atlas.frame('hero'), 0, 0);
      renderMs = performance.now() - t0;

      const now = performance.now();
      hud.record(now - lastFrameStart, simMs, renderMs);
      lastFrameStart = now;
    },
  };

  const loop = new GameLoop(hooks);
  hud.setExtra(() => `mobs ${mobs.count}  shots ${shots.count}  draws ${renderer.drawCalls}  culled ${renderer.culled}`);
  loop.start();

  // Synchronous benchmark for automation: rAF is throttled to zero in hidden
  // tabs, so drive tick+render directly and force a raster flush each frame
  // via getImageData — a conservative upper bound on real frame cost.
  (window as unknown as Record<string, unknown>)['__runPerfBench'] = (frames = 600) => {
    const times: number[] = [];
    const simTimes: number[] = [];
    const drawTimes: number[] = [];
    const flushTimes: number[] = [];
    for (let f = 0; f < frames; f++) {
      const t0 = performance.now();
      hooks.tick();
      const t1 = performance.now();
      hooks.render(1);
      const t2 = performance.now();
      renderer.ctx.getImageData(0, 0, 1, 1);
      const t3 = performance.now();
      times.push(t3 - t0);
      simTimes.push(t1 - t0);
      drawTimes.push(t2 - t1);
      flushTimes.push(t3 - t2);
    }
    const pick = (arr: number[], p: number) => {
      const s = [...arr].sort((a, b) => a - b);
      return s[Math.min(frames - 1, Math.floor(frames * p))]!;
    };
    return {
      p50: pick(times, 0.5),
      p95: pick(times, 0.95),
      p99: pick(times, 0.99),
      simP95: pick(simTimes, 0.95),
      drawP95: pick(drawTimes, 0.95),
      flushP95: pick(flushTimes, 0.95),
      mean: times.reduce((a, b) => a + b, 0) / frames,
      frames,
      draws: renderer.drawCalls,
      culled: renderer.culled,
      forcedFlush: true,
    };
  };
}
