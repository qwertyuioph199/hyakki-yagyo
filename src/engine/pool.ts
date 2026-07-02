/**
 * Dense fixed-capacity pool with swap-remove.
 *
 * Invariant: items[0..count-1] are the live entities. free(i) swaps the last
 * live item into slot i, so iteration while freeing must run BACKWARDS
 * (`for (let i = pool.count - 1; i >= 0; i--)`), and entity references must
 * never be held across ticks — always re-index.
 *
 * All objects are allocated once up front: zero GC pressure in steady state,
 * and every slot has the same hidden class.
 */
export class Pool<T> {
  readonly items: T[] = [];
  count = 0;

  constructor(
    readonly capacity: number,
    factory: () => T,
  ) {
    for (let i = 0; i < capacity; i++) this.items.push(factory());
  }

  /** Returns a recycled object to initialize, or null when the pool is full. */
  alloc(): T | null {
    if (this.count >= this.capacity) return null;
    return this.items[this.count++]!;
  }

  free(i: number): void {
    const last = --this.count;
    const tmp = this.items[i]!;
    this.items[i] = this.items[last]!;
    this.items[last] = tmp;
  }

  clear(): void {
    this.count = 0;
  }

  get full(): boolean {
    return this.count >= this.capacity;
  }
}
