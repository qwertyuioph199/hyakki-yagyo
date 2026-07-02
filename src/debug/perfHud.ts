const SAMPLE_WINDOW = 600;

/**
 * Frame-time percentile HUD. record() every frame; the DOM view refreshes
 * every 30 frames. window.__perfResult is set after each full sample window
 * so automated checks (preview_eval / CI docs) can read objective numbers.
 */
export class PerfHud {
  private readonly el: HTMLDivElement;
  private readonly frames = new Float32Array(SAMPLE_WINDOW);
  private readonly sims = new Float32Array(SAMPLE_WINDOW);
  private readonly renders = new Float32Array(SAMPLE_WINDOW);
  private idx = 0;
  private filled = 0;
  private extra: () => string = () => '';
  visible = true;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText =
      'position:absolute;top:8px;left:8px;color:#7fda89;background:rgba(0,0,0,.65);' +
      'font:12px/1.5 Consolas,monospace;padding:6px 10px;white-space:pre;z-index:99;pointer-events:none;';
    root.appendChild(this.el);
  }

  setExtra(fn: () => string): void {
    this.extra = fn;
  }

  record(frameMs: number, simMs: number, renderMs: number): void {
    this.frames[this.idx] = frameMs;
    this.sims[this.idx] = simMs;
    this.renders[this.idx] = renderMs;
    this.idx = (this.idx + 1) % SAMPLE_WINDOW;
    if (this.filled < SAMPLE_WINDOW) this.filled++;

    if (this.idx % 30 === 0 && this.visible) this.refresh();
    if (this.idx === 0 && this.filled === SAMPLE_WINDOW) {
      (window as unknown as Record<string, unknown>)['__perfResult'] = {
        p50: percentile(this.frames, this.filled, 0.5),
        p95: percentile(this.frames, this.filled, 0.95),
        p99: percentile(this.frames, this.filled, 0.99),
        simP95: percentile(this.sims, this.filled, 0.95),
        renderP95: percentile(this.renders, this.filled, 0.95),
        cpuP95: percentile(this.sims, this.filled, 0.95) + percentile(this.renders, this.filled, 0.95),
        dropRate: this.dropRate(),
        samples: this.filled,
      };
    }
  }

  /** Share of frames that missed a 60Hz vsync (inter-frame delta > 25ms). */
  private dropRate(): number {
    let drops = 0;
    for (let i = 0; i < this.filled; i++) if (this.frames[i]! > 25) drops++;
    return drops / Math.max(1, this.filled);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? 'block' : 'none';
  }

  private refresh(): void {
    const n = this.filled;
    if (n === 0) return;
    const p50 = percentile(this.frames, n, 0.5);
    const p95 = percentile(this.frames, n, 0.95);
    const sim = percentile(this.sims, n, 0.95);
    const ren = percentile(this.renders, n, 0.95);
    // Inter-frame deltas are vsync-quantized (~16.7ms at 60Hz even when
    // perfectly smooth), so the gate is CPU cost + dropped-frame rate.
    const drop = this.dropRate();
    const ok = sim + ren <= 16.7 && drop <= 0.005 ? '✓' : '✗';
    this.el.textContent =
      `frame p50 ${p50.toFixed(2)}ms  p95 ${p95.toFixed(2)}ms  drop ${(drop * 100).toFixed(2)}% ${ok}\n` +
      `cpu: sim p95 ${sim.toFixed(2)}ms + render p95 ${ren.toFixed(2)}ms   n=${n}\n` +
      this.extra();
  }
}

function percentile(buf: Float32Array, n: number, p: number): number {
  const copy = Array.from(buf.subarray(0, n)).sort((a, b) => a - b);
  return copy[Math.min(n - 1, Math.floor(n * p))]!;
}
