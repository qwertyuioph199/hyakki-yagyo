export type PainterCtx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface SpriteFrame {
  sx: number;
  sy: number;
  w: number;
  h: number;
  /** Anchor offset from the frame's top-left; blit() draws at (x-ox, y-oy). */
  ox: number;
  oy: number;
}

export interface AtlasEntry {
  id: string;
  w: number;
  h: number;
  frames: number;
  /** Paint one frame into a ctx already translated to the frame's top-left. */
  paint: (ctx: PainterCtx, frame: number, w: number, h: number) => void;
  /** Anchor relative to top-left; defaults to the center. */
  anchorX?: number;
  anchorY?: number;
}

export class Atlas {
  constructor(
    readonly source: CanvasImageSource,
    private readonly frames: ReadonlyMap<string, readonly SpriteFrame[]>,
  ) {}

  frame(id: string, i = 0): SpriteFrame {
    const list = this.frames.get(id);
    if (!list) throw new Error(`Unknown sprite id: ${id}`);
    return list[i % list.length]!;
  }

  frameCount(id: string): number {
    return this.frames.get(id)?.length ?? 0;
  }

  get ids(): string[] {
    return [...this.frames.keys()];
  }
}

/**
 * Pack all sprite frames into one texture at boot (shelf packing) and paint
 * them via their painter functions. Everything the world layer draws comes
 * from this single source — one image, no per-frame rasterization, ever.
 */
export function buildAtlas(entries: readonly AtlasEntry[], width = 1024, padding = 1): Atlas {
  // Shelf packing: place frames left-to-right, wrap to a new shelf when full.
  let x = padding;
  let y = padding;
  let shelfH = 0;
  const placements: { entry: AtlasEntry; frame: number; x: number; y: number }[] = [];
  for (const entry of entries) {
    for (let f = 0; f < entry.frames; f++) {
      if (x + entry.w + padding > width) {
        x = padding;
        y += shelfH + padding;
        shelfH = 0;
      }
      placements.push({ entry, frame: f, x, y });
      x += entry.w + padding;
      shelfH = Math.max(shelfH, entry.h);
    }
  }
  const height = nextPow2(y + shelfH + padding);

  const canvas: OffscreenCanvas | HTMLCanvasElement =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement('canvas'), { width, height });
  const ctx = canvas.getContext('2d') as PainterCtx;
  ctx.imageSmoothingEnabled = false;

  const map = new Map<string, SpriteFrame[]>();
  for (const p of placements) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.beginPath();
    ctx.rect(0, 0, p.entry.w, p.entry.h);
    ctx.clip();
    p.entry.paint(ctx, p.frame, p.entry.w, p.entry.h);
    ctx.restore();
    let list = map.get(p.entry.id);
    if (!list) {
      list = [];
      map.set(p.entry.id, list);
    }
    list[p.frame] = {
      sx: p.x,
      sy: p.y,
      w: p.entry.w,
      h: p.entry.h,
      ox: p.entry.anchorX ?? p.entry.w / 2,
      oy: p.entry.anchorY ?? p.entry.h / 2,
    };
  }
  return new Atlas(canvas, map);
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}
