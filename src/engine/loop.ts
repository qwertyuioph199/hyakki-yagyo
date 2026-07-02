export const TICK_RATE = 60;
export const TICK_DT = 1 / TICK_RATE;

/** Longest wall-clock gap we try to catch up on; beyond this, time is dropped. */
const MAX_FRAME_TIME = 0.25;
/** Hard cap on ticks per frame so extreme timeScale can't spiral the tab. */
const MAX_TICKS_PER_FRAME = 240;

export interface LoopHooks {
  /** Advance the simulation by exactly TICK_DT. */
  tick(): void;
  /** Draw, interpolating between previous and current sim state by alpha in [0,1). */
  render(alpha: number): void;
}

/**
 * Fixed-timestep loop (60 Hz) with an accumulator and render interpolation.
 * Determinism contract: the sim only ever advances in whole TICK_DT steps,
 * so `same seed + same per-tick inputs` replays identically at any frame rate
 * or timeScale.
 */
export class GameLoop {
  timeScale = 1;
  running = false;
  private accum = 0;
  private last = -1;
  private rafId = 0;

  constructor(private readonly hooks: LoopHooks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = -1;
    this.accum = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.frame);
    if (this.last < 0) this.last = now;
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > MAX_FRAME_TIME) dt = MAX_FRAME_TIME;
    this.accum += dt * this.timeScale;

    let steps = 0;
    while (this.accum >= TICK_DT) {
      this.hooks.tick();
      this.accum -= TICK_DT;
      if (++steps >= MAX_TICKS_PER_FRAME) {
        this.accum = 0;
        break;
      }
    }
    this.hooks.render(this.accum / TICK_DT);
  };
}
