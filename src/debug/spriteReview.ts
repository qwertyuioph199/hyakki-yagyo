import { SPRITES } from '../art/spriteDefs';
import { buildAtlas } from '../engine/atlas';
import { PAL } from '../art/palette';

/** /play/#sprites — renders every atlas frame in a labeled grid for art QA. */
export function startSpriteReview(canvas: HTMLCanvasElement): void {
  document.body.style.overflow = 'auto';
  const stage = document.getElementById('stage');
  if (stage) {
    stage.style.position = 'static';
    stage.style.alignItems = 'flex-start';
  }
  const atlas = buildAtlas(SPRITES);
  canvas.width = 1280;
  canvas.height = 1400;
  canvas.style.width = '1280px';
  canvas.style.height = '1400px';
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = PAL.ground;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let x = 10;
  let y = 26;
  let rowH = 0;
  ctx.font = '9px Consolas, monospace';
  for (const id of atlas.ids) {
    const frames = atlas.frameCount(id);
    const f0 = atlas.frame(id, 0);
    const groupW = (f0.w + 6) * frames + 40;
    if (x + groupW > canvas.width - 10) {
      x = 10;
      y += rowH + 26;
      rowH = 0;
    }
    ctx.fillStyle = PAL.ghost;
    ctx.fillText(id, x, y - 4);
    for (let f = 0; f < frames; f++) {
      const fr = atlas.frame(id, f);
      ctx.drawImage(atlas.source, fr.sx, fr.sy, fr.w, fr.h, x + f * (fr.w + 6), y, fr.w, fr.h);
    }
    rowH = Math.max(rowH, f0.h);
    x += groupW;
  }
}
