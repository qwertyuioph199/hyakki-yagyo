import type { AudioEngine } from './audioEngine';

/**
 * SFX recipes — small synthesized gestures. Each call builds a short
 * node graph that self-disconnects. Rate-limited per id to survive hordes.
 */
export type SfxId =
  | 'hit'
  | 'kill'
  | 'pickup'
  | 'levelup'
  | 'chest'
  | 'evolution'
  | 'hurt'
  | 'swarm'
  | 'boss'
  | 'dawn'
  | 'click'
  | 'coin';

const MIN_INTERVAL: Record<SfxId, number> = {
  hit: 0.045,
  kill: 0.06,
  pickup: 0.03,
  levelup: 0.2,
  chest: 0.3,
  evolution: 0.5,
  hurt: 0.15,
  swarm: 1,
  boss: 1,
  dawn: 2,
  click: 0.03,
  coin: 0.05,
};

export class Sfx {
  private last: Partial<Record<SfxId, number>> = {};

  constructor(private readonly engine: AudioEngine) {}

  play(id: SfxId, intensity = 1): void {
    const t = this.engine.now;
    if (t - (this.last[id] ?? -1) < MIN_INTERVAL[id]) return;
    this.last[id] = t;
    const ctx = this.engine.ctx;
    const out = this.engine.sfxBus;
    switch (id) {
      case 'hit':
        this.thump(ctx, out, 180 + Math.random() * 60, 0.05, 0.12 * intensity, 'square');
        break;
      case 'kill':
        this.noiseBurst(ctx, out, 0.09, 0.14 * intensity, 900);
        this.thump(ctx, out, 90, 0.1, 0.1 * intensity, 'sine');
        break;
      case 'pickup':
        this.blip(ctx, out, 880, 1320, 0.05, 0.06);
        break;
      case 'coin':
        this.blip(ctx, out, 1200, 1600, 0.06, 0.07);
        break;
      case 'levelup':
        this.arp(ctx, out, [523, 659, 784, 1047], 0.07, 0.12);
        break;
      case 'chest':
        this.arp(ctx, out, [392, 494, 587, 784, 988], 0.09, 0.14);
        break;
      case 'evolution':
        this.arp(ctx, out, [262, 330, 392, 523, 659, 784], 0.1, 0.18);
        this.noiseBurst(ctx, out, 0.5, 0.08, 2400);
        break;
      case 'hurt':
        this.thump(ctx, out, 70, 0.18, 0.3, 'sawtooth');
        break;
      case 'swarm':
        this.sweep(ctx, out, 700, 150, 0.7, 0.12);
        break;
      case 'boss':
        this.thump(ctx, out, 45, 0.7, 0.3, 'sawtooth');
        this.sweep(ctx, out, 120, 60, 0.8, 0.15);
        break;
      case 'dawn':
        this.arp(ctx, out, [523, 659, 784, 1047, 1319, 1568], 0.16, 0.2);
        break;
      case 'click':
        this.blip(ctx, out, 600, 500, 0.03, 0.05);
        break;
    }
  }

  private env(ctx: AudioContext, dur: number, gain: number): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    return g;
  }

  private thump(ctx: AudioContext, out: AudioNode, freq: number, dur: number, gain: number, type: OscillatorType): void {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * 0.4), ctx.currentTime + dur);
    const g = this.env(ctx, dur, gain);
    osc.connect(g).connect(out);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  private blip(ctx: AudioContext, out: AudioNode, f0: number, f1: number, dur: number, gain: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f0, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(f1, ctx.currentTime + dur);
    const g = this.env(ctx, dur, gain);
    osc.connect(g).connect(out);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  private sweep(ctx: AudioContext, out: AudioNode, f0: number, f1: number, dur: number, gain: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), ctx.currentTime + dur);
    const g = this.env(ctx, dur, gain);
    osc.connect(g).connect(out);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  private arp(ctx: AudioContext, out: AudioNode, freqs: number[], step: number, gain: number): void {
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = ctx.createGain();
      const t0 = ctx.currentTime + i * step;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + step * 2);
      osc.connect(g).connect(out);
      osc.start(t0);
      osc.stop(t0 + step * 2 + 0.05);
    });
  }

  private noiseBurst(ctx: AudioContext, out: AudioNode, dur: number, gain: number, cutoff: number): void {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const g = this.env(ctx, dur, gain);
    src.connect(filter).connect(g).connect(out);
    src.start();
  }
}
