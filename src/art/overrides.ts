import type { AtlasEntry, PainterCtx } from '../engine/atlas';
import { SPRITES } from './spriteDefs';

/**
 * AI-art override layer. Any sprite id can be replaced by dropping a
 * transparent PNG at `public/assets/sprites/<id>.png`. If the file is
 * missing (404) the procedural painter in spriteDefs.ts is kept, so the
 * game always renders — overrides are purely additive.
 *
 * The override keeps the sprite's ORIGINAL frame box (w/h/anchor) so
 * gameplay geometry, hitboxes and layout never shift; only the pixels
 * change. Enemy/boss sprites keep their white hit-flash (last frame).
 */
export const ASSET_BASE = '../assets/sprites/';

/** Sprite ids that accept an AI-art override (text glyphs & ground excluded). */
export const OVERRIDABLE_IDS: readonly string[] = SPRITES.map((s) => s.id).filter(
  (id) => !id.startsWith('digit_') && !id.startsWith('ground_'),
);

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Fetch every available override PNG; missing files resolve to nothing. */
export async function loadOverrides(base = ASSET_BASE): Promise<Map<string, HTMLImageElement>> {
  const out = new Map<string, HTMLImageElement>();
  await Promise.all(
    OVERRIDABLE_IDS.map((id) =>
      loadImage(`${base}${id}.png`).then((img) => {
        if (img) out.set(id, img);
      }),
    ),
  );
  return out;
}

function isEnemyId(id: string): boolean {
  return id.startsWith('enemy_') || id.startsWith('boss_');
}

/** Draw the whole PNG contain-fit into the sprite's box (aspect preserved). */
function paintOverride(ctx: PainterCtx, img: HTMLImageElement, entry: AtlasEntry, frame: number): void {
  ctx.imageSmoothingEnabled = true;
  const s = Math.min(entry.w / img.naturalWidth, entry.h / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  ctx.drawImage(img, (entry.w - dw) / 2, (entry.h - dh) / 2, dw, dh);
  ctx.imageSmoothingEnabled = false;
  // Preserve the white hit-flash convention (enemy's last frame).
  if (isEnemyId(entry.id) && frame === entry.frames - 1) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, entry.w, entry.h);
    ctx.globalCompositeOperation = 'source-over';
  }
}

/**
 * Return the sprite entry list with painters swapped for any loaded
 * override image. Feed the result to buildAtlas() and swap the atlas in.
 */
export function spritesWithOverrides(overrides: Map<string, HTMLImageElement>): readonly AtlasEntry[] {
  if (overrides.size === 0) return SPRITES;
  return SPRITES.map((entry) => {
    const img = overrides.get(entry.id);
    if (!img) return entry;
    return {
      ...entry,
      paint: (ctx, frame) => paintOverride(ctx, img, entry, frame),
    } satisfies AtlasEntry;
  });
}
