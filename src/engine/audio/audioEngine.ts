/**
 * WebAudio engine (frozen contract): context + master/sfx/music buses.
 * Context unlocks on first user gesture. All sound is synthesized —
 * zero audio assets.
 */
export class AudioEngine {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  readonly sfxBus: GainNode;
  readonly musicBus: GainNode;
  private unlocked = false;

  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.master.gain.value = 0.8;
    this.musicBus.gain.value = 0.7;
  }

  /** Call from a user-gesture handler; resumes the suspended context. */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    void this.ctx.resume();
  }

  setMasterVolume(v: number): void {
    this.master.gain.value = v;
  }

  setMusicVolume(v: number): void {
    this.musicBus.gain.value = v;
  }

  get now(): number {
    return this.ctx.currentTime;
  }
}
