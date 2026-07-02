/**
 * Hashed uniform grid for an unbounded world. Rebuilt every tick:
 * `clear()` then `insert(id, x, y)` for each live entity, then `query(...)`.
 *
 * Zero allocation in steady state: buckets are head/next linked lists in
 * Int32Arrays. Hash collisions merely put far-apart cells in one bucket —
 * the distance check in query() filters them out.
 */
export class SpatialHash {
  private readonly heads: Int32Array;
  private readonly nexts: Int32Array;
  private readonly xs: Float32Array;
  private readonly ys: Float32Array;
  private readonly scratch: Int32Array;
  private readonly mask: number;

  constructor(
    readonly cellSize: number,
    capacity: number,
    tableSize = 4096,
  ) {
    if ((tableSize & (tableSize - 1)) !== 0) throw new Error('tableSize must be a power of 2');
    this.heads = new Int32Array(tableSize).fill(-1);
    this.nexts = new Int32Array(capacity);
    this.xs = new Float32Array(capacity);
    this.ys = new Float32Array(capacity);
    this.scratch = new Int32Array(64);
    this.mask = tableSize - 1;
  }

  clear(): void {
    this.heads.fill(-1);
  }

  private bucketOf(cx: number, cy: number): number {
    return ((Math.imul(cx, 92837111) ^ Math.imul(cy, 689287499)) >>> 0) & this.mask;
  }

  insert(id: number, x: number, y: number): void {
    const cs = this.cellSize;
    const b = this.bucketOf(Math.floor(x / cs), Math.floor(y / cs));
    this.xs[id] = x;
    this.ys[id] = y;
    this.nexts[id] = this.heads[b]!;
    this.heads[b] = id;
  }

  /**
   * Collect ids within radius r of (x, y) into `out`. Returns the count
   * (capped at out.length). Positions used are those passed to insert().
   */
  query(x: number, y: number, r: number, out: Int32Array): number {
    const cs = this.cellSize;
    const cx0 = Math.floor((x - r) / cs);
    const cx1 = Math.floor((x + r) / cs);
    const cy0 = Math.floor((y - r) / cs);
    const cy1 = Math.floor((y + r) / cs);
    const r2 = r * r;
    let n = 0;
    let seen = 0;
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const b = this.bucketOf(cx, cy);
        // Two cells in range can hash to one bucket; visiting it twice would
        // duplicate ids. The scratch list dedupes (query spans are small).
        let dup = false;
        for (let i = 0; i < seen; i++) {
          if (this.scratch[i] === b) {
            dup = true;
            break;
          }
        }
        if (dup) continue;
        if (seen < this.scratch.length) this.scratch[seen++] = b;
        for (let id = this.heads[b]!; id !== -1; id = this.nexts[id]!) {
          const dx = this.xs[id]! - x;
          const dy = this.ys[id]! - y;
          if (dx * dx + dy * dy <= r2) {
            if (n >= out.length) return n;
            out[n++] = id;
          }
        }
      }
    }
    return n;
  }
}
