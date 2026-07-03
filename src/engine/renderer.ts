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

  /** camX/camY = world coords of the view CENTER. */
  begin(camX: number, camY: number, bg: string): void {
    this.camX = camX - this.viewW / 2;
    this.camY = camY - this.viewH / 2;
    this.drawCalls = 0;
    this.culled = 0;
    this.ctx.fillStyle = bg;
    this.ctx.fillRect(0, 0, this.viewW, this.viewH);
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

  worldToScreenX(wx: number): number {
    return wx - this.camX;
  }

  worldToScreenY(wy: number): number {
    return wy - this.camY;
  }
}
