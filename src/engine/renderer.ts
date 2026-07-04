import type { Atlas, SpriteFrame } from './atlas';

const CULL_MARGIN = 48;

/**
 * The Canvas2D performance contract lives here: every world draw is an
 * unscaled, unrotated drawImage from the boot-time atlas at integer coords.
 * No save/restore, no setTransform, no fillText in the world layer.
 */
export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  drawCalls = 0;
  culled = 0;
  private _atlas: Atlas | null = null;
  private camX = 0;
  private camY = 0;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly viewW: number,
    readonly viewH: number,
  ) {
    canvas.width = viewW;
    canvas.height = viewH;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.ctx.imageSmoothingEnabled = false;
  }

  setAtlas(atlas: Atlas): void {
    this._atlas = atlas;
  }

  get atlas(): Atlas {
    if (!this._atlas) throw new Error('Renderer has no atlas');
    return this._atlas;
  }

  private readonly groundTiles = new Map<string, HTMLCanvasElement>();

  /**
   * Register a tileable ground texture. The image is baked once onto a
   * plain canvas (pre-decoded, wash pre-applied) so begin() can tile it
   * with a few plain drawImage calls — pattern fills with per-frame
   * matrix transforms proved janky on some GPUs.
   */
  registerGroundTexture(key: string, image: HTMLImageElement, wash: string): void {
    const tile = document.createElement('canvas');
    tile.width = image.naturalWidth;
    tile.height = image.naturalHeight;
    const tctx = tile.getContext('2d')!;
    tctx.drawImage(image, 0, 0);
    tctx.fillStyle = wash;
    tctx.fillRect(0, 0, tile.width, tile.height);
    this.groundTiles.set(key, tile);
  }

  /** camX/camY = world coords of the view CENTER. */
  begin(camX: number, camY: number, bg: string, textureKey?: string): void {
    this.camX = camX - this.viewW / 2;
    this.camY = camY - this.viewH / 2;
    this.drawCalls = 0;
    this.culled = 0;
    this.ctx.fillStyle = bg;
    this.ctx.fillRect(0, 0, this.viewW, this.viewH);
    if (textureKey) {
      const tile = this.groundTiles.get(textureKey);
      if (tile) {
        // Tile the pre-baked texture with plain integer-offset blits.
        const tw = tile.width;
        const th = tile.height;
        const ox = -(((this.camX % tw) + tw) % tw) | 0;
        const oy = -(((this.camY % th) + th) % th) | 0;
        for (let y = oy; y < this.viewH; y += th) {
          for (let x = ox; x < this.viewW; x += tw) {
            this.ctx.drawImage(tile, x, y);
          }
        }
      }
    }
  }

  /** Blit a frame anchored at world position (wx, wy). */
  blit(frame: SpriteFrame, wx: number, wy: number): void {
    const dx = (wx - this.camX - frame.ox) | 0;
    const dy = (wy - this.camY - frame.oy) | 0;
    if (dx + frame.w < -CULL_MARGIN || dy + frame.h < -CULL_MARGIN || dx > this.viewW + CULL_MARGIN || dy > this.viewH + CULL_MARGIN) {
      this.culled++;
      return;
    }
    this.ctx.drawImage(this._atlas!.source, frame.sx, frame.sy, frame.w, frame.h, dx, dy, frame.w, frame.h);
    this.drawCalls++;
  }

  /**
   * Blit with procedural motion: a vertical bounce (bobY), a small sway
   * rotation (rot, radians), and a horizontal facing flip. Pivots around the
   * sprite's anchor so rotation/flip look natural. Costs a save/restore per
   * call — used only for the ~hundreds of actors (enemies + player), well
   * within budget.
   */
  blitMotion(
    frame: SpriteFrame,
    wx: number,
    wy: number,
    flipX: boolean,
    bobY: number,
    rot: number,
    scale = 1,
  ): void {
    const cx = (wx - this.camX) | 0;
    const cy = (wy - this.camY + bobY) | 0;
    const half = Math.max(frame.w, frame.h) * scale;
    if (cx + half < -CULL_MARGIN || cy + half < -CULL_MARGIN || cx - half > this.viewW + CULL_MARGIN || cy - half > this.viewH + CULL_MARGIN) {
      this.culled++;
      return;
    }
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(cx, cy);
    if (rot !== 0) ctx.rotate(rot);
    if (scale !== 1 || flipX) ctx.scale(flipX ? -scale : scale, scale);
    ctx.drawImage(this._atlas!.source, frame.sx, frame.sy, frame.w, frame.h, -frame.ox, -frame.oy, frame.w, frame.h);
    ctx.restore();
    this.drawCalls++;
  }

  /** Blit with transient alpha (used sparingly — alpha changes break batching). */
  blitAlpha(frame: SpriteFrame, wx: number, wy: number, alpha: number): void {
    this.ctx.globalAlpha = alpha;
    this.blit(frame, wx, wy);
    this.ctx.globalAlpha = 1;
  }

  /**
   * Scaled blit — reserved for the few variable-radius effects (auras,
   * zones). Everything else stays on the unscaled fast path.
   */
  blitScaled(frame: SpriteFrame, wx: number, wy: number, scale: number): void {
    const w = frame.w * scale;
    const h = frame.h * scale;
    const dx = (wx - this.camX - frame.ox * scale) | 0;
    const dy = (wy - this.camY - frame.oy * scale) | 0;
    if (dx + w < -CULL_MARGIN || dy + h < -CULL_MARGIN || dx > this.viewW + CULL_MARGIN || dy > this.viewH + CULL_MARGIN) {
      this.culled++;
      return;
    }
    this.ctx.drawImage(this._atlas!.source, frame.sx, frame.sy, frame.w, frame.h, dx, dy, w, h);
    this.drawCalls++;
  }

  /** Tiny world-space bar (player HP, boss HP) — two rects, cheap. */
  barWorld(wx: number, wy: number, w: number, h: number, frac: number, back: string, front: string): void {
    const dx = (wx - this.camX - w / 2) | 0;
    const dy = (wy - this.camY) | 0;
    if (dx + w < 0 || dy + h < 0 || dx > this.viewW || dy > this.viewH) return;
    this.ctx.fillStyle = back;
    this.ctx.fillRect(dx, dy, w, h);
    this.ctx.fillStyle = front;
    this.ctx.fillRect(dx, dy, Math.round(w * Math.max(0, Math.min(1, frac))), h);
  }

  worldToScreenX(wx: number): number {
    return wx - this.camX;
  }

  worldToScreenY(wy: number): number {
    return wy - this.camY;
  }
}
