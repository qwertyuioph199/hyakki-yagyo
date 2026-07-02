/**
 * Snapshot of player intent for one sim tick. The sim consumes ONLY this
 * struct (never the Input class), so headless bots can inject inputs and
 * replays stay deterministic.
 */
export interface TickInput {
  moveX: number;
  moveY: number;
}

const MOVE_KEYS: Readonly<Record<string, readonly [number, number]>> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export class Input {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();
  private readonly snapshot: TickInput = { moveX: 0, moveY: 0 };

  attach(target: Window): void {
    target.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
      if (e.code in MOVE_KEYS || e.code === 'Space' || e.code === 'Escape') e.preventDefault();
    });
    target.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });
    target.addEventListener('blur', () => {
      this.down.clear();
    });
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** True once per physical key press; cleared when sample() is called. */
  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  /** Build the per-tick input snapshot and clear one-shot presses. */
  sample(): TickInput {
    let mx = 0;
    let my = 0;
    for (const code in MOVE_KEYS) {
      if (this.down.has(code)) {
        const dir = MOVE_KEYS[code]!;
        mx += dir[0];
        my += dir[1];
      }
    }
    // Normalize so diagonals aren't faster; clamp per-axis stacking (W+Up).
    mx = mx < 0 ? -1 : mx > 0 ? 1 : 0;
    my = my < 0 ? -1 : my > 0 ? 1 : 0;
    if (mx !== 0 && my !== 0) {
      const inv = Math.SQRT1_2;
      this.snapshot.moveX = mx * inv;
      this.snapshot.moveY = my * inv;
    } else {
      this.snapshot.moveX = mx;
      this.snapshot.moveY = my;
    }
    this.pressed.clear();
    return this.snapshot;
  }
}
