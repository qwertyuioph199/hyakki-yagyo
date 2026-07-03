import type { AtlasEntry, PainterCtx } from '../engine/atlas';
import { PAL } from './palette';

/**
 * Sprite registry (frozen contract): drawable ids, frame sizes/counts and
 * painters. Style guide: chunky silhouettes readable at 20px on dark
 * ground, one accent color per enemy family, 2px ink shadows, and every
 * enemy's LAST frame is its all-white hit flash.
 */

// ---------- shared painter helpers ----------

function blob(ctx: PainterCtx, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function eyes(ctx: PainterCtx, cx: number, cy: number, spread: number, color: string = PAL.ink): void {
  ctx.fillStyle = color;
  ctx.fillRect(cx - spread - 1, cy - 2, 2, 4);
  ctx.fillRect(cx + spread - 1, cy - 2, 2, 4);
}

function cyclops(ctx: PainterCtx, cx: number, cy: number, r: number): void {
  blob(ctx, cx, cy, r, PAL.white);
  blob(ctx, cx, cy, Math.max(1, r - 2), PAL.ink);
}

function whiteout(paint: (ctx: PainterCtx, f: number, w: number, h: number) => void) {
  return (ctx: PainterCtx, f: number, w: number, h: number): void => {
    paint(ctx, f, w, h);
    // Flash frame: repaint silhouette in white via composite.
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = PAL.white;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  };
}

/** Standard enemy entry: frames 0..1 anim + last frame white flash. */
function enemy(
  id: string,
  w: number,
  h: number,
  paint: (ctx: PainterCtx, f: number, w: number, h: number) => void,
): AtlasEntry {
  return {
    id,
    w,
    h,
    frames: 3,
    paint: (ctx, f, ww, hh) => {
      if (f === 2) whiteout(paint)(ctx, 0, ww, hh);
      else paint(ctx, f, ww, hh);
    },
  };
}

/** Simple item icon frame with a paper card backing. */
function item(id: string, draw: (ctx: PainterCtx, w: number, h: number) => void): AtlasEntry {
  return {
    id,
    w: 18,
    h: 18,
    frames: 1,
    paint: (ctx, _f, w, h) => {
      ctx.fillStyle = PAL.inkSoft;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = PAL.lanternDeep;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      draw(ctx, w, h);
    },
  };
}

const DIGIT_PATTERNS: readonly string[] = [
  '111101101101111',
  '010110010010111',
  '111001111100111',
  '111001111001111',
  '101101111001001',
  '111100111001111',
  '111100111101111',
  '111001010010010',
  '111101111101111',
  '111101111001111',
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

/** Character body painter (used for hero sprites + select portraits). */
function robed(
  ctx: PainterCtx,
  w: number,
  h: number,
  f: number,
  robe: string,
  trim: string,
  hat?: 'eboshi' | 'ribbon' | 'straw' | 'hood' | 'ears' | 'topknot',
): void {
  const bob = f % 2;
  // robe
  ctx.fillStyle = robe;
  ctx.fillRect(5, 8 + bob, w - 10, h - 12 - bob);
  // sleeves
  ctx.fillRect(3, 12 + bob, 3, 8);
  ctx.fillRect(w - 6, 12 + bob, 3, 8);
  // face
  ctx.fillStyle = PAL.bone;
  ctx.fillRect(7, 4 + bob, w - 14, 7);
  eyes(ctx, w / 2, 7 + bob, 3);
  // trim
  ctx.fillStyle = trim;
  ctx.fillRect(5, h - 6, w - 10, 3);
  switch (hat) {
    case 'eboshi':
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(w / 2 - 3, bob, 6, 5);
      break;
    case 'ribbon':
      ctx.fillStyle = PAL.blood;
      ctx.fillRect(6, 2 + bob, w - 12, 3);
      break;
    case 'straw':
      ctx.fillStyle = PAL.lanternDeep;
      ctx.beginPath();
      ctx.moveTo(2, 5 + bob);
      ctx.lineTo(w / 2, bob - 2);
      ctx.lineTo(w - 2, 5 + bob);
      ctx.closePath();
      ctx.fill();
      break;
    case 'hood':
      ctx.fillStyle = robe;
      ctx.fillRect(6, 1 + bob, w - 12, 5);
      break;
    case 'ears':
      ctx.fillStyle = PAL.fox;
      ctx.beginPath();
      ctx.moveTo(7, 4 + bob);
      ctx.lineTo(9, -1 + bob);
      ctx.lineTo(12, 4 + bob);
      ctx.moveTo(w - 12, 4 + bob);
      ctx.lineTo(w - 9, -1 + bob);
      ctx.lineTo(w - 7, 4 + bob);
      ctx.fill();
      break;
    case 'topknot':
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(w / 2 - 1, bob - 1, 3, 4);
      break;
  }
}

// ---------- the registry ----------

export const SPRITES: readonly AtlasEntry[] = [
  // ===== characters (2 walk frames each) =====
  { id: 'char_onmyoji', w: 24, h: 28, frames: 2, paint: (c, f, w, h) => robed(c, w, h, f, PAL.paper, PAL.violet, 'eboshi') },
  { id: 'char_miko', w: 24, h: 28, frames: 2, paint: (c, f, w, h) => robed(c, w, h, f, PAL.bone, PAL.blood, 'ribbon') },
  { id: 'char_ronin', w: 24, h: 28, frames: 2, paint: (c, f, w, h) => robed(c, w, h, f, PAL.spiritDeep, PAL.ink, 'topknot') },
  { id: 'char_sohei', w: 24, h: 28, frames: 2, paint: (c, f, w, h) => robed(c, w, h, f, PAL.lanternDeep, PAL.bone, 'hood') },
  { id: 'char_kitsune', w: 24, h: 28, frames: 2, paint: (c, f, w, h) => robed(c, w, h, f, PAL.fox, PAL.bone, 'ears') },
  { id: 'char_kugutsu', w: 24, h: 28, frames: 2, paint: (c, f, w, h) => robed(c, w, h, f, PAL.violet, PAL.gold, 'straw') },

  // ===== enemies =====
  enemy('enemy_hitodama', 20, 20, (ctx, f, w, h) => {
    const wob = f;
    blob(ctx, w / 2, h / 2 + wob, 6, PAL.spirit);
    ctx.fillStyle = PAL.spirit;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 5, h / 2 + wob);
    ctx.quadraticCurveTo(2, h - 2 - wob, 4, h - 2);
    ctx.quadraticCurveTo(w / 2, h - 5, w / 2 + 3, h / 2 + 4);
    ctx.fill();
    eyes(ctx, w / 2, h / 2 + wob, 2);
  }),
  enemy('enemy_chochin', 22, 24, (ctx, f, w, h) => {
    const sway = f === 0 ? -1 : 1;
    ctx.fillStyle = PAL.lantern;
    ctx.beginPath();
    ctx.ellipse(w / 2 + sway, h / 2, 8, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PAL.lanternDeep;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(w / 2 + sway, h / 2 + i * 4, 8, 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // one big eye + lolling tongue
    cyclops(ctx, w / 2 + sway, h / 2 - 2, 3);
    ctx.fillStyle = PAL.blood;
    ctx.fillRect(w / 2 + sway - 1, h / 2 + 4, 3, 6);
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(w / 2 + sway - 4, h - 3, 8, 2);
  }),
  enemy('enemy_kasa', 20, 26, (ctx, f, w, h) => {
    const hop = f === 1 ? -2 : 0;
    // umbrella cap
    ctx.fillStyle = PAL.violet;
    ctx.beginPath();
    ctx.moveTo(2, 12 + hop);
    ctx.quadraticCurveTo(w / 2, hop - 2, w - 2, 12 + hop);
    ctx.closePath();
    ctx.fill();
    cyclops(ctx, w / 2, 8 + hop, 3);
    // single leg
    ctx.fillStyle = PAL.bone;
    ctx.fillRect(w / 2 - 1, 14 + hop, 3, 9 - hop);
    ctx.fillRect(w / 2 - 4, h - 3, 9, 2);
  }),
  enemy('enemy_yosuzume', 16, 14, (ctx, f, w, h) => {
    ctx.fillStyle = PAL.ghost;
    blob(ctx, w / 2, h / 2, 4, PAL.ghost);
    // flapping wings
    ctx.beginPath();
    if (f === 0) {
      ctx.moveTo(w / 2 - 3, h / 2);
      ctx.lineTo(1, 2);
      ctx.lineTo(w / 2 - 2, h / 2 - 3);
      ctx.moveTo(w / 2 + 3, h / 2);
      ctx.lineTo(w - 1, 2);
      ctx.lineTo(w / 2 + 2, h / 2 - 3);
    } else {
      ctx.moveTo(w / 2 - 3, h / 2);
      ctx.lineTo(1, h - 2);
      ctx.lineTo(w / 2 - 2, h / 2 + 3);
      ctx.moveTo(w / 2 + 3, h / 2);
      ctx.lineTo(w - 1, h - 2);
      ctx.lineTo(w / 2 + 2, h / 2 + 3);
    }
    ctx.fill();
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(w / 2 - 1, h / 2 - 1, 2, 2);
  }),
  enemy('enemy_hitotsume', 22, 24, (ctx, f, w, h) => {
    const bob = f;
    ctx.fillStyle = PAL.spiritDeep;
    ctx.fillRect(4, 6 + bob, w - 8, h - 10 - bob);
    cyclops(ctx, w / 2, 12 + bob, 4);
    ctx.fillStyle = PAL.bone;
    ctx.fillRect(6, h - 4, 4, 2);
    ctx.fillRect(w - 10, h - 4, 4, 2);
  }),
  enemy('enemy_gaikotsu', 20, 26, (ctx, f, w, h) => {
    const bob = f;
    blob(ctx, w / 2, 7 + bob, 6, PAL.bone);
    eyes(ctx, w / 2, 7 + bob, 3);
    ctx.fillStyle = PAL.bone;
    ctx.fillRect(w / 2 - 1, 12 + bob, 3, 8);
    for (let i = 0; i < 3; i++) ctx.fillRect(w / 2 - 5, 13 + i * 3 + bob, 11, 1);
    ctx.fillRect(w / 2 - 4, h - 4, 3, 3);
    ctx.fillRect(w / 2 + 2, h - 4 + (f ? -1 : 0), 3, 3);
  }),
  enemy('enemy_onibi', 18, 18, (ctx, f, w, h) => {
    blob(ctx, w / 2, h / 2, 6, f === 0 ? PAL.ember : PAL.lantern);
    blob(ctx, w / 2, h / 2 - 1, 3, PAL.gold);
    eyes(ctx, w / 2, h / 2, 2);
  }),
  enemy('enemy_kappa', 24, 24, (ctx, f, w, h) => {
    const bob = f;
    ctx.fillStyle = PAL.fox;
    ctx.fillRect(5, 8 + bob, w - 10, h - 12);
    // shell lines
    ctx.strokeStyle = PAL.spiritDeep;
    ctx.strokeRect(7.5, 11.5 + bob, w - 15, h - 18);
    // head plate (sara)
    ctx.fillStyle = PAL.spirit;
    ctx.beginPath();
    ctx.ellipse(w / 2, 6 + bob, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    eyes(ctx, w / 2, 10 + bob, 3);
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(w / 2 - 2, 12 + bob, 4, 2); // beak
  }),
  enemy('enemy_tsuchigumo', 28, 22, (ctx, f, w, h) => {
    blob(ctx, w / 2, h / 2, 7, PAL.ink);
    blob(ctx, w / 2, h / 2, 6, '#3a2f4a');
    eyes(ctx, w / 2, h / 2 - 1, 2, PAL.ember);
    // legs
    ctx.strokeStyle = '#3a2f4a';
    ctx.lineWidth = 2;
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 3; i++) {
        const ly = 6 + i * 5 + (f === 1 && i % 2 ? 1 : 0);
        ctx.beginPath();
        ctx.moveTo(w / 2 + side * 5, h / 2);
        ctx.lineTo(w / 2 + side * 12, ly);
        ctx.stroke();
      }
    }
    ctx.lineWidth = 1;
  }),
  enemy('enemy_hannya', 22, 26, (ctx, f, w, h) => {
    const bob = f;
    // mask face
    ctx.fillStyle = PAL.bone;
    ctx.beginPath();
    ctx.moveTo(4, 6 + bob);
    ctx.lineTo(w - 4, 6 + bob);
    ctx.lineTo(w / 2, h - 4);
    ctx.closePath();
    ctx.fill();
    // horns
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(5, bob, 2, 7);
    ctx.fillRect(w - 7, bob, 2, 7);
    eyes(ctx, w / 2, 11 + bob, 4, PAL.ember);
    ctx.fillStyle = PAL.blood;
    ctx.fillRect(w / 2 - 3, 16 + bob, 7, 2); // grin
  }),
  enemy('enemy_nurikabe', 30, 26, (ctx, f, w, h) => {
    ctx.fillStyle = '#5a5344';
    ctx.fillRect(2, 4 + (f ? 1 : 0), w - 4, h - 8);
    ctx.fillStyle = '#6b6353';
    ctx.fillRect(4, 6 + (f ? 1 : 0), w - 8, 4);
    eyes(ctx, w / 2, h / 2 + 1, 5);
    // stubby feet
    ctx.fillStyle = '#4a4438';
    ctx.fillRect(6, h - 4, 6, 3);
    ctx.fillRect(w - 12, h - 4, 6, 3);
  }),
  enemy('enemy_tengu', 24, 26, (ctx, f, w, h) => {
    const bob = f;
    ctx.fillStyle = PAL.blood;
    ctx.fillRect(6, 5 + bob, w - 12, 9); // red face
    eyes(ctx, w / 2, 8 + bob, 3, PAL.white);
    ctx.fillStyle = PAL.lanternDeep;
    ctx.fillRect(w / 2 - 1, 10 + bob, 3, 6); // long nose
    // wings
    ctx.fillStyle = PAL.ink;
    ctx.beginPath();
    ctx.moveTo(4, 14 + bob);
    ctx.lineTo(-1 + (f ? 2 : 0), 6);
    ctx.lineTo(8, 16);
    ctx.moveTo(w - 4, 14 + bob);
    ctx.lineTo(w + 1 - (f ? 2 : 0), 6);
    ctx.lineTo(w - 8, 16);
    ctx.fill();
    ctx.fillStyle = '#2a2a35';
    ctx.fillRect(7, 14 + bob, w - 14, h - 18);
  }),
  enemy('enemy_omukade', 30, 20, (ctx, f, _w, h) => {
    // segmented centipede
    for (let i = 0; i < 5; i++) {
      const sx = 4 + i * 5.5;
      const sy = h / 2 + Math.sin(i * 1.4 + f * 0.9) * 3;
      blob(ctx, sx, sy, 4, i === 0 ? PAL.ember : '#7a3226');
    }
    eyes(ctx, 4, h / 2 - 1, 1.5, PAL.gold);
    ctx.strokeStyle = '#7a3226';
    for (let i = 0; i < 5; i++) {
      const sx = 4 + i * 5.5;
      ctx.beginPath();
      ctx.moveTo(sx, h / 2 - 4);
      ctx.lineTo(sx + (f ? 1 : -1), h / 2 - 7);
      ctx.moveTo(sx, h / 2 + 4);
      ctx.lineTo(sx - (f ? 1 : -1), h / 2 + 7);
      ctx.stroke();
    }
  }),
  enemy('enemy_nue', 28, 26, (ctx, f, w, h) => {
    const bob = f;
    // chimera: monkey face, tiger body, snake tail
    ctx.fillStyle = PAL.lanternDeep;
    ctx.fillRect(5, 10 + bob, w - 12, h - 15);
    ctx.strokeStyle = PAL.ink;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(8 + i * 5, 11 + bob);
      ctx.lineTo(8 + i * 5, h - 6);
      ctx.stroke();
    }
    blob(ctx, w / 2, 7 + bob, 5, PAL.bone);
    eyes(ctx, w / 2, 7 + bob, 2, PAL.ember);
    // snake tail
    ctx.strokeStyle = PAL.fox;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w - 7, 14 + bob);
    ctx.quadraticCurveTo(w - 1, 8 + (f ? 3 : 0), w - 3, 4);
    ctx.stroke();
    ctx.lineWidth = 1;
  }),
  enemy('enemy_oni', 26, 30, (ctx, f, w, h) => {
    const bob = f;
    ctx.fillStyle = PAL.blood;
    ctx.fillRect(5, 6 + bob, w - 10, h - 10 - bob);
    // horns
    ctx.fillStyle = PAL.bone;
    ctx.fillRect(7, bob, 3, 7);
    ctx.fillRect(w - 10, bob, 3, 7);
    eyes(ctx, w / 2, 11 + bob, 4, PAL.gold);
    // fangs + tiger belt
    ctx.fillStyle = PAL.bone;
    ctx.fillRect(w / 2 - 4, 16 + bob, 2, 3);
    ctx.fillRect(w / 2 + 2, 16 + bob, 2, 3);
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(5, h - 8, w - 10, 3);
  }),
  enemy('boss_gashadokuro', 40, 44, (ctx, f, w) => {
    const bob = f;
    // giant skull
    blob(ctx, w / 2, 14 + bob, 12, PAL.bone);
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(w / 2 - 8, 10 + bob, 5, 7);
    ctx.fillRect(w / 2 + 3, 10 + bob, 5, 7);
    ctx.fillStyle = PAL.bone;
    ctx.fillRect(w / 2 - 9, 24 + bob, 18, 3); // jaw
    for (let i = 0; i < 4; i++) ctx.fillRect(w / 2 - 8 + i * 5, 22 + bob, 2, 4);
    // ribs
    for (let i = 0; i < 3; i++) ctx.fillRect(w / 2 - 10, 29 + i * 4 + bob, 20, 2);
  }),
  enemy('boss_shuten', 40, 44, (ctx, f, w, h) => {
    const bob = f;
    ctx.fillStyle = '#8a1e1e';
    ctx.fillRect(7, 9 + bob, w - 14, h - 14 - bob);
    ctx.fillStyle = PAL.bone;
    ctx.fillRect(11, bob, 4, 10);
    ctx.fillRect(w - 15, bob, 4, 10);
    eyes(ctx, w / 2, 16 + bob, 6, PAL.gold);
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(w / 2 - 6, 24 + bob, 12, 3); // scowl
    // sake gourd
    blob(ctx, w - 8, h - 12, 5, PAL.lanternDeep);
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(5, h - 9, w - 10, 4);
  }),
  enemy('boss_akatsuki', 44, 44, (ctx, f, w, h) => {
    // the dawn light — a blinding radiant orb
    const r = 14 + f * 2;
    const grad = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, r + 6);
    grad.addColorStop(0, PAL.white);
    grad.addColorStop(0.5, PAL.gold);
    grad.addColorStop(1, 'rgba(245,197,66,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = PAL.white;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + f * 0.3;
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
      ctx.lineTo(w / 2 + Math.cos(a) * (r + 6), h / 2 + Math.sin(a) * (r + 6));
      ctx.stroke();
    }
  }),

  // ===== weapon projectiles =====
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
      ctx.fillRect(-1, -1, 2, 4);
      ctx.restore();
    },
  },
  {
    id: 'shot_hyakki_seal',
    w: 20,
    h: 20,
    frames: 2,
    paint: (ctx, f, w, h) => {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(f === 1 ? 0.4 : -0.2);
      ctx.fillStyle = PAL.gold;
      ctx.fillRect(-4, -9, 8, 18);
      ctx.fillStyle = PAL.blood;
      ctx.fillRect(-3, -6, 6, 3);
      ctx.fillRect(-2, -1, 4, 6);
      ctx.restore();
    },
  },
  {
    id: 'shot_kunai',
    w: 12,
    h: 12,
    frames: 1,
    paint: (ctx, _f, w, h) => {
      ctx.fillStyle = PAL.ghost;
      ctx.beginPath();
      ctx.moveTo(w - 1, h / 2);
      ctx.lineTo(4, h / 2 - 3);
      ctx.lineTo(4, h / 2 + 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PAL.blood;
      ctx.fillRect(1, h / 2 - 1, 3, 2);
    },
  },
  {
    id: 'shot_kunai_evo',
    w: 14,
    h: 14,
    frames: 1,
    paint: (ctx, _f, w, h) => {
      ctx.fillStyle = PAL.gold;
      ctx.beginPath();
      ctx.moveTo(w - 1, h / 2);
      ctx.lineTo(4, h / 2 - 4);
      ctx.lineTo(4, h / 2 + 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PAL.ember;
      ctx.fillRect(1, h / 2 - 1, 3, 2);
    },
  },
  {
    id: 'shot_juzu',
    w: 12,
    h: 12,
    frames: 1,
    paint: (ctx, _f, w, h) => {
      blob(ctx, w / 2, h / 2, 4, PAL.violet);
      blob(ctx, w / 2 - 1, h / 2 - 1, 1.5, PAL.bone);
    },
  },
  {
    id: 'shot_juzu_evo',
    w: 14,
    h: 14,
    frames: 1,
    paint: (ctx, _f, w, h) => {
      blob(ctx, w / 2, h / 2, 5, PAL.gold);
      blob(ctx, w / 2 - 1, h / 2 - 1, 2, PAL.white);
    },
  },
  {
    id: 'shot_masakari',
    w: 18,
    h: 18,
    frames: 2,
    paint: (ctx, f, w, h) => {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(f * 1.5);
      ctx.fillStyle = PAL.lanternDeep;
      ctx.fillRect(-1, -8, 3, 16);
      ctx.fillStyle = PAL.ghost;
      ctx.beginPath();
      ctx.moveTo(1, -8);
      ctx.quadraticCurveTo(9, -6, 8, 1);
      ctx.lineTo(1, -2);
      ctx.fill();
      ctx.restore();
    },
  },
  {
    id: 'shot_masakari_evo',
    w: 22,
    h: 22,
    frames: 2,
    paint: (ctx, f, w, h) => {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(f * 1.5 + 0.4);
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(-1, -10, 3, 20);
      ctx.fillStyle = PAL.ember;
      ctx.beginPath();
      ctx.moveTo(1, -10);
      ctx.quadraticCurveTo(12, -7, 10, 2);
      ctx.lineTo(1, -2);
      ctx.fill();
      ctx.restore();
    },
  },
  {
    id: 'shot_tomoe',
    w: 16,
    h: 16,
    frames: 2,
    paint: (ctx, f, w, h) => {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(f * 0.8);
      ctx.strokeStyle = PAL.spirit;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        blob(ctx, Math.cos(a) * 4, Math.sin(a) * 4, 2, PAL.spirit);
      }
      ctx.restore();
      ctx.lineWidth = 1;
    },
  },
  {
    id: 'shot_tomoe_evo',
    w: 20,
    h: 20,
    frames: 2,
    paint: (ctx, f, w, h) => {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(f * 0.8 + 0.3);
      ctx.strokeStyle = PAL.gold;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        blob(ctx, Math.cos(a) * 5, Math.sin(a) * 5, 2.5, PAL.gold);
      }
      ctx.restore();
      ctx.lineWidth = 1;
    },
  },
  {
    id: 'shot_kitsunebi',
    w: 16,
    h: 16,
    frames: 2,
    paint: (ctx, f, w, h) => {
      blob(ctx, w / 2, h / 2, 5 + f, PAL.spirit);
      blob(ctx, w / 2, h / 2 - 1, 2.5, PAL.white);
    },
  },
  {
    id: 'shot_kitsunebi_evo',
    w: 20,
    h: 20,
    frames: 2,
    paint: (ctx, f, w, h) => {
      blob(ctx, w / 2, h / 2, 7 + f, PAL.ember);
      blob(ctx, w / 2, h / 2 - 1, 3.5, PAL.gold);
      blob(ctx, w / 2, h / 2 - 2, 1.5, PAL.white);
    },
  },

  // ===== weapon FX (slashes, zones, auras, bolts) =====
  {
    id: 'fx_slash',
    w: 64,
    h: 64,
    frames: 2, // 0 = right, 1 = left
    paint: (ctx, f, w, h) => {
      ctx.strokeStyle = PAL.bone;
      ctx.lineWidth = 5;
      ctx.beginPath();
      if (f === 0) ctx.arc(6, h / 2, 26, -1.1, 1.1);
      else ctx.arc(w - 6, h / 2, 26, Math.PI - 1.1, Math.PI + 1.1);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = PAL.paper;
      ctx.beginPath();
      if (f === 0) ctx.arc(6, h / 2, 20, -0.9, 0.9);
      else ctx.arc(w - 6, h / 2, 20, Math.PI - 0.9, Math.PI + 0.9);
      ctx.stroke();
      ctx.lineWidth = 1;
    },
  },
  {
    id: 'fx_slash_evo',
    w: 72,
    h: 72,
    frames: 2,
    paint: (ctx, f, w, h) => {
      ctx.strokeStyle = PAL.gold;
      ctx.lineWidth = 6;
      ctx.beginPath();
      if (f === 0) ctx.arc(7, h / 2, 30, -1.2, 1.2);
      else ctx.arc(w - 7, h / 2, 30, Math.PI - 1.2, Math.PI + 1.2);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = PAL.blood;
      ctx.beginPath();
      if (f === 0) ctx.arc(7, h / 2, 23, -1.0, 1.0);
      else ctx.arc(w - 7, h / 2, 23, Math.PI - 1.0, Math.PI + 1.0);
      ctx.stroke();
      ctx.lineWidth = 1;
    },
  },
  {
    id: 'fx_kekkai',
    w: 128,
    h: 128,
    frames: 2,
    paint: (ctx, f, w, h) => {
      const r = w / 2 - 3;
      ctx.strokeStyle = 'rgba(95,211,196,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(95,211,196,0.10)';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.fill();
      // shide papers around the rim
      ctx.fillStyle = 'rgba(242,234,216,0.8)';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + f * 0.15;
        ctx.fillRect(w / 2 + Math.cos(a) * (r - 4) - 1, h / 2 + Math.sin(a) * (r - 4) - 3, 3, 7);
      }
      ctx.lineWidth = 1;
    },
  },
  {
    id: 'fx_kekkai_evo',
    w: 128,
    h: 128,
    frames: 2,
    paint: (ctx, f, w, h) => {
      const r = w / 2 - 3;
      ctx.strokeStyle = 'rgba(245,197,66,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(245,197,66,0.12)';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(224,86,46,0.6)';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r - 8 - f * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    },
  },
  {
    id: 'fx_zone',
    w: 96,
    h: 96,
    frames: 2,
    paint: (ctx, f, w, h) => {
      ctx.fillStyle = 'rgba(95,211,196,0.22)';
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, w / 2 - 4, h / 2 - 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(95,211,196,0.7)';
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, w / 2 - 4, h / 2 - 10, 0, 0, Math.PI * 2);
      ctx.stroke();
      // bubbles
      for (let i = 0; i < 5; i++) {
        const a = i * 1.3 + f * 0.5;
        blob(ctx, w / 2 + Math.cos(a) * (12 + i * 4), h / 2 + Math.sin(a) * (6 + i * 2), 2, 'rgba(242,234,216,0.5)');
      }
    },
  },
  {
    id: 'fx_zone_evo',
    w: 96,
    h: 96,
    frames: 2,
    paint: (ctx, f, w, h) => {
      ctx.fillStyle = 'rgba(138,111,201,0.28)';
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, w / 2 - 4, h / 2 - 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(138,111,201,0.8)';
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, w / 2 - 4, h / 2 - 10, 0, 0, Math.PI * 2);
      ctx.stroke();
      // the eye of the swamp
      cyclops(ctx, w / 2, h / 2, 5 + f);
    },
  },
  {
    id: 'fx_bolt',
    w: 20,
    h: 56,
    frames: 2,
    paint: (ctx, f, w, h) => {
      ctx.strokeStyle = f === 0 ? PAL.gold : PAL.white;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w / 2 + 3, 0);
      ctx.lineTo(w / 2 - 4, h * 0.4);
      ctx.lineTo(w / 2 + 2, h * 0.55);
      ctx.lineTo(w / 2 - 3, h - 6);
      ctx.stroke();
      blob(ctx, w / 2 - 3, h - 5, 4, f === 0 ? PAL.gold : PAL.white);
      ctx.lineWidth = 1;
    },
  },
  {
    id: 'fx_bolt_evo',
    w: 26,
    h: 64,
    frames: 2,
    paint: (ctx, f, w, h) => {
      ctx.strokeStyle = f === 0 ? PAL.spirit : PAL.white;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(w / 2 + 4, 0);
      ctx.lineTo(w / 2 - 5, h * 0.35);
      ctx.lineTo(w / 2 + 3, h * 0.5);
      ctx.lineTo(w / 2 - 4, h - 7);
      ctx.stroke();
      blob(ctx, w / 2 - 4, h - 6, 5, f === 0 ? PAL.spirit : PAL.white);
      ctx.lineWidth = 1;
    },
  },

  // ===== passive item icons =====
  item('item_rice', (ctx, w, h) => {
    ctx.fillStyle = PAL.bone;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2 + 2, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    blob(ctx, w / 2 - 2, h / 2 - 2, 2, PAL.bone);
    blob(ctx, w / 2 + 2, h / 2 - 3, 2, PAL.bone);
  }),
  item('item_sutra', (ctx, w, h) => {
    ctx.fillStyle = PAL.paper;
    ctx.fillRect(4, 4, w - 8, h - 8);
    ctx.strokeStyle = PAL.ink;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(6 + i * 3, 6);
      ctx.lineTo(6 + i * 3, h - 6);
      ctx.stroke();
    }
  }),
  item('item_magatama', (ctx, w, h) => {
    ctx.fillStyle = PAL.spirit;
    ctx.beginPath();
    ctx.arc(w / 2 + 1, h / 2 - 1, 5, 0.5, Math.PI * 1.7);
    ctx.arc(w / 2 - 2, h / 2 + 2, 2, Math.PI * 1.7, 0.5, true);
    ctx.fill();
    blob(ctx, w / 2 + 2, h / 2 - 3, 1.2, PAL.ink);
  }),
  item('item_tea', (ctx, w) => {
    ctx.fillStyle = PAL.fox;
    ctx.fillRect(5, 8, w - 10, 6);
    ctx.fillStyle = PAL.inkSoft;
    ctx.fillRect(5, 6, w - 10, 3);
    ctx.strokeStyle = PAL.bone;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 2, 5);
    ctx.quadraticCurveTo(w / 2, 2, w / 2 + 2, 5);
    ctx.stroke();
  }),
  item('item_lantern', (ctx, w, h) => {
    ctx.fillStyle = PAL.lantern;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PAL.lanternDeep;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, 5, 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(w / 2 - 3, 3, 6, 2);
  }),
  item('item_ema', (ctx, w, h) => {
    ctx.fillStyle = PAL.lanternDeep;
    ctx.beginPath();
    ctx.moveTo(3, 8);
    ctx.lineTo(w / 2, 3);
    ctx.lineTo(w - 3, 8);
    ctx.lineTo(w - 4, h - 4);
    ctx.lineTo(4, h - 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PAL.blood;
    ctx.fillRect(w / 2 - 2, 9, 4, 4);
  }),
  item('item_shimenawa', (ctx, w) => {
    ctx.strokeStyle = PAL.lanternDeep;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(3, 7);
    ctx.quadraticCurveTo(w / 2, 12, w - 3, 7);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = PAL.paper;
    for (let i = 0; i < 3; i++) ctx.fillRect(5 + i * 4, 9 + (i % 2), 2, 5);
  }),
  item('item_bunshin', (ctx) => {
    ctx.fillStyle = 'rgba(159,184,201,0.5)';
    ctx.fillRect(4, 5, 5, 8);
    ctx.fillStyle = PAL.ghost;
    ctx.fillRect(8, 5, 5, 8);
    eyes(ctx, 10.5, 8, 1.2);
  }),
  item('item_lodestone', (ctx) => {
    ctx.fillStyle = PAL.blood;
    ctx.fillRect(4, 4, 4, 7);
    ctx.fillStyle = PAL.ghost;
    ctx.fillRect(10, 4, 4, 7);
    ctx.fillStyle = PAL.inkSoft;
    ctx.fillRect(4, 10, 10, 3);
  }),
  item('item_maneki', (ctx, w, h) => {
    blob(ctx, w / 2, h / 2 + 1, 5, PAL.bone);
    // ears + raised paw
    ctx.fillStyle = PAL.bone;
    ctx.fillRect(w / 2 - 5, 3, 2, 3);
    ctx.fillRect(w / 2 + 3, 3, 2, 3);
    ctx.fillRect(w / 2 + 4, 7, 2, 4);
    eyes(ctx, w / 2, h / 2, 2);
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(w / 2 - 2, h / 2 + 3, 4, 2);
  }),
  item('item_kanmuri', (ctx, w) => {
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(4, 8, w - 8, 5);
    ctx.beginPath();
    ctx.moveTo(4, 8);
    ctx.lineTo(7, 4);
    ctx.lineTo(w / 2, 8);
    ctx.lineTo(w - 7, 4);
    ctx.lineTo(w - 4, 8);
    ctx.fill();
  }),
  item('item_noh', (ctx, w, h) => {
    ctx.fillStyle = PAL.bone;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    eyes(ctx, w / 2, h / 2 - 1, 2);
    ctx.strokeStyle = PAL.blood;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 + 2, 2, 0.3, Math.PI - 0.3);
    ctx.stroke();
  }),
  item('item_juso', (ctx, w) => {
    ctx.fillStyle = PAL.paper;
    ctx.fillRect(5, 3, 8, 12);
    ctx.fillStyle = PAL.blood;
    ctx.fillRect(7, 5, 4, 1);
    ctx.fillRect(8, 7, 2, 5);
    // nail
    ctx.strokeStyle = PAL.ink;
    ctx.beginPath();
    ctx.moveTo(w / 2, 2);
    ctx.lineTo(w / 2, 8);
    ctx.stroke();
  }),

  // ===== pickups =====
  {
    id: 'pickup_chest',
    w: 22,
    h: 18,
    frames: 2,
    paint: (ctx, f, w, h) => {
      ctx.fillStyle = f === 0 ? PAL.lanternDeep : PAL.lantern;
      ctx.fillRect(2, 5, w - 4, h - 7);
      ctx.fillStyle = PAL.gold;
      ctx.fillRect(2, 8, w - 4, 2);
      ctx.fillRect(w / 2 - 2, 5, 4, 8);
      ctx.strokeStyle = PAL.ink;
      ctx.strokeRect(2.5, 5.5, w - 5, h - 8);
    },
  },
  {
    id: 'pickup_food',
    w: 16,
    h: 14,
    frames: 1,
    paint: (ctx, _f, w, h) => {
      // steamed bun
      blob(ctx, w / 2, h / 2 + 1, 6, PAL.bone);
      ctx.fillStyle = PAL.paper;
      blob(ctx, w / 2, h / 2, 5, PAL.paper);
      ctx.fillStyle = PAL.blood;
      ctx.fillRect(w / 2 - 1, h / 2 - 2, 3, 2);
    },
  },
  {
    id: 'pickup_coin',
    w: 12,
    h: 12,
    frames: 2,
    paint: (ctx, f, w, h) => {
      // koban coin
      ctx.fillStyle = f === 0 ? PAL.gold : '#ffe084';
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, 5, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PAL.lanternDeep;
      ctx.strokeRect(w / 2 - 1.5, h / 2 - 1.5, 3, 3);
    },
  },
  {
    id: 'pickup_vacuum',
    w: 16,
    h: 16,
    frames: 2,
    paint: (ctx, f, w, h) => {
      ctx.strokeStyle = f === 0 ? PAL.spirit : PAL.white;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 2 + i * 2.4, i, i + Math.PI * 1.4);
        ctx.stroke();
      }
      ctx.lineWidth = 1;
    },
  },
  {
    id: 'pickup_bomb',
    w: 16,
    h: 16,
    frames: 2,
    paint: (ctx, f, w, h) => {
      blob(ctx, w / 2, h / 2 + 2, 5, PAL.ink);
      blob(ctx, w / 2 - 1, h / 2 + 1, 4, '#2a2a35');
      ctx.strokeStyle = PAL.lanternDeep;
      ctx.beginPath();
      ctx.moveTo(w / 2 + 2, h / 2 - 2);
      ctx.quadraticCurveTo(w / 2 + 4, 2, w / 2 + 1, 2);
      ctx.stroke();
      if (f === 1) blob(ctx, w / 2 + 1, 2, 2, PAL.gold);
    },
  },

  // ===== misc world =====
  {
    id: 'gem',
    w: 10,
    h: 10,
    frames: 3, // blue / green / red by value tier
    paint: (ctx, f, w, h) => {
      ctx.fillStyle = f === 0 ? PAL.xpBlue : f === 1 ? PAL.fox : PAL.ember;
      ctx.beginPath();
      ctx.moveTo(w / 2, 1);
      ctx.lineTo(w - 1, h / 2);
      ctx.lineTo(w / 2, h - 1);
      ctx.lineTo(1, h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(w / 2 - 1, 3, 2, 2);
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
      ctx.lineWidth = 1;
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
  ...Array.from({ length: 10 }, (_, d) => ({
    id: `digit_${d}`,
    w: 6,
    h: 10,
    frames: 2,
    paint: (ctx: PainterCtx, f: number) => {
      paintDigit(ctx, d, 2, f === 0 ? PAL.white : PAL.gold);
    },
  })),
];
