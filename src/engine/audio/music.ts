import type { AudioEngine } from './audioEngine';

/**
 * Procedural night-parade music: a pentatonic (in-yo scale) pluck
 * sequencer over a low drone with taiko-style noise hits. setIntensity(0..1)
 * (driven by run-minute + nearby enemy density) raises tempo, register and
 * percussion drive. Fully synthesized.
 */
const IN_SCALE = [0, 1, 5, 7, 8]; // 陰音階 (semitones from root)
const ROOT = 110; // A2

export class Music {
  private timer: number | null = null;
  private step = 0;
  private intensity = 0;
  private droneOsc: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;

  constructor(private readonly engine: AudioEngine) {}

  start(): void {
    if (this.timer !== null) return;
    const ctx = this.engine.ctx;
    this.droneOsc = ctx.createOscillator();
    this.droneOsc.type = 'sawtooth';
    this.droneOsc.frequency.value = ROOT / 2;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 140;
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.05;
    this.droneOsc.connect(filter).connect(this.droneGain).connect(this.engine.musicBus);
    this.droneOsc.start();
    this.schedule();
  }

  stop(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.droneOsc?.stop();
    this.droneOsc = null;
    this.droneGain?.disconnect();
    this.droneGain = null;
  }

  setIntensity(x: number): void {
    this.intensity = Math.max(0, Math.min(1, x));
  }

  private schedule(): void {
    const stepMs = 300 - this.intensity * 140;
    this.timer = window.setTimeout(() => {
      this.tickStep();
      this.schedule();
    }, stepMs);
  }

  private tickStep(): void {
    const ctx = this.engine.ctx;
    if (ctx.state !== 'running') {
      this.step++;
      return;
    }
    const s = this.step++;

    // Pluck melody: sparse at low intensity, busier at high.
    const density = 0.35 + this.intensity * 0.4;
    if ((s % 2 === 0 && Math.random() < density) || s % 8 === 0) {
      const octave = Math.random() < this.intensity * 0.5 ? 4 : 2;
      const degree = IN_SCALE[Math.floor(Math.random() * IN_SCALE.length)]!;
      const freq = ROOT * octave * Math.pow(2, degree / 12);
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.09, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      osc.connect(g).connect(this.engine.musicBus);
      osc.start();
      osc.stop(ctx.currentTime + 0.55);
    }

    // Taiko: beat 0 always, extra hits with intensity.
    if (s % 4 === 0 || (this.intensity > 0.5 && s % 4 === 2) || (this.intensity > 0.8 && s % 2 === 1 && Math.random() < 0.3)) {
      const len = Math.floor(ctx.sampleRate * 0.12);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 120 + this.intensity * 180;
      const g = ctx.createGain();
      g.gain.value = 0.22 + this.intensity * 0.12;
      src.connect(filter).connect(g).connect(this.engine.musicBus);
      src.start();
    }

    // Drone swells with intensity.
    if (this.droneGain) this.droneGain.gain.value = 0.04 + this.intensity * 0.05;
  }
}
