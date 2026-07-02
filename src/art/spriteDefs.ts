import type { AtlasEntry, PainterCtx } from '../engine/atlas';
import { PAL } from './palette';

/**
 * Sprite registry (contract frozen end of P3): every drawable id, its frame
 * size/count and painter. P2 ships readable placeholders; the P4 art pass
 * upgrades painters without touching ids or callers.
 *
 * Convention: enemy sprites reserve their LAST frame as the all-white hit
 * flash (renderRun picks it while hitFlash > 0).
 */

const DIGIT_PATTERNS: readonly string[] = [
  '111101101101111', // 0
  '010110010010111', // 1
  '111001111100111', // 2
  '111001111001111', // 3
  '101101111001001', // 4
  '111100111001111', // 5
  '111100111101111', // 6
  '111001010010010', // 7
  '111101111101111', // 8
  '111101111001111', // 9
];

function paintDigit(ctx: PainterCtx, digit: number, scale: number, color: string): void {
  const pat = DIGIT_PATTERNS[digit]!;
  ctx.fillStyle = color;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 3; c++) {
      if (pat[r * 3 + c] === '1') ctx.fillRect(c * scale, r * scale, scale, scale);
    }
  }
}

export const SPRITES: readonly AtlasEntry[] = [
  {
    id: 'hero',
    w: 24,
    h: 28,
    frames: 2,
    paint: (ctx, f, w, h) => {
      const bob = f; // 2-frame walk bob
      ctx.fillStyle = PAL.bone;
      ctx.fillRect(6, 4 + bob, w - 12, h - 12);
      ctx.fillStyle = PAL.blood;
      ctx.fillRect(6, h - 10 + bob, w - 12, 6 - bob);
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(9, 10 + bob, 2, 3);
      ctx.fillRect(w - 11, 10 + bob, 2, 3);
    },
  },
  {
    id: 'enemy_hitodama',
    w: 20,
    h: 20,
    frames: 3, // 0,1 anim / 2 white flash
    paint: (ctx, f, w, h) => {
      const flash = f === 2;
      const wob = f === 1 ? 1 : 0;
      ctx.fillStyle = flash ? PAL.white : PAL.spirit;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2 + wob, 7, 0, Math.PI * 2);
      ctx.fill();
      // trailing wisp tail
      ctx.beginPath();
      ctx.moveTo(w / 2 - 6, h / 2 + wob);
      ctx.quadraticCurveTo(2, h - 3 - wob, 4, h - 2);
      ctx.quadraticCurveTo(w / 2 - 2, h - 4, w / 2 + 2, h / 2 + 5);
      ctx.fill();
      if (!flash) {
        ctx.fillStyle = PAL.ink;
        ctx.fillRect(w / 2 - 4, h / 2 - 2 + wob, 2, 4);
        ctx.fillRect(w / 2 + 2, h / 2 - 2 + wob, 2, 4);
      }
    },
  },
  {
    id: 'shot_ofuda',
    w: 14,
    h: 14,
    frames: 2,
    paint: (ctx, f, w, h) => {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(f === 1 ? 0.5 : 0);
      ctx.fillStyle = PAL.paper;
      ctx.fillRect(-3, -6, 6, 12);
      ctx.fillStyle = PAL.blood;
      ctx.fillRect(-2, -4, 4, 2);
      ctx.restore();
    },
  },
  {
    id: 'gem',
    w: 10,
    h: 10,
    frames: 2,
    paint: (ctx, f, w, h) => {
      ctx.fillStyle = f === 0 ? PAL.xpBlue : PAL.spirit;
      ctx.beginPath();
      ctx.moveTo(w / 2, 1);
      ctx.lineTo(w - 1, h / 2);
      ctx.lineTo(w / 2, h - 1);
      ctx.lineTo(1, h / 2);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    id: 'poof',
    w: 20,
    h: 20,
    frames: 3,
    paint: (ctx, f, w, h) => {
      ctx.strokeStyle = PAL.ghost;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 3 + f * 3, 0, Math.PI * 2);
      ctx.stroke();
    },
  },
  {
    id: 'ground_dot',
    w: 6,
    h: 6,
    frames: 2,
    paint: (ctx, f) => {
      ctx.fillStyle = PAL.groundDot;
      if (f === 0) {
        ctx.fillRect(2, 2, 2, 2);
      } else {
        ctx.fillRect(1, 2, 4, 1);
        ctx.fillRect(2, 1, 1, 4);
      }
    },
  },
  // Damage-number glyphs (world layer never uses fillText).
  ...Array.from({ length: 10 }, (_, d) => ({
    id: `digit_${d}`,
    w: 6,
    h: 10,
    frames: 2, // 0 = white (normal), 1 = gold (crit/big)
    paint: (ctx: PainterCtx, f: number) => {
      paintDigit(ctx, d, 2, f === 0 ? PAL.white : PAL.gold);
    },
  })),
];
