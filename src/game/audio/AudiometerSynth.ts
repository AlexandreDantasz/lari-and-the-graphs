/**
 * AudiometerSynth — sintetizador nativo via Web Audio API.
 * Tons puros reais (OscillatorNode, sem arquivos externos) + SFX retrô 8-bit.
 */
export class AudiometerSynth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  unlock(): void {
    this.ensure();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  }

  /** Tom puro de audiometria (pure tone) com envelope suave. */
  playPureTone(freq: number, duration = 0.45, gain = 0.22): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.setValueAtTime(gain, t + duration * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  /** Varredura de frequências (usada na intro da Fase 1). */
  playSweep(fromHz = 250, toHz = 8000, duration = 1.1): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(fromHz, t);
    osc.frequency.exponentialRampToValueAtTime(toHz, t + duration);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  private blip(
    type: OscillatorType,
    from: number,
    to: number,
    duration: number,
    gain = 0.18,
    when = 0,
  ): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.linearRampToValueAtTime(to, t + duration);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private noiseBurst(duration: number, gain = 0.2): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;
    const t = ctx.currentTime;
    const frames = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.master);
    src.start(t);
  }

  jump(): void {
    this.blip('square', 320, 660, 0.14, 0.14);
  }

  doubleJumpBoost(): void {
    this.blip('square', 440, 880, 0.12, 0.16);
    this.blip('square', 660, 1320, 0.14, 0.14, 0.08);
  }

  dive(): void {
    this.blip('sawtooth', 280, 120, 0.22, 0.1);
  }

  hitThreshold(freq: number): void {
    this.playPureTone(freq, 0.18, 0.18);
    this.blip('square', 880, 1760, 0.1, 0.12, 0.02);
  }

  miss(): void {
    this.blip('square', 220, 110, 0.22, 0.14);
  }

  shield(): void {
    this.blip('triangle', 520, 1040, 0.16, 0.16);
    this.blip('triangle', 780, 1560, 0.18, 0.12, 0.06);
  }

  waveBlocked(): void {
    this.noiseBurst(0.12, 0.16);
    this.blip('square', 980, 640, 0.1, 0.1);
  }

  waveHit(): void {
    this.noiseBurst(0.25, 0.24);
    this.blip('sawtooth', 200, 60, 0.3, 0.16);
  }

  land(): void {
    this.blip('triangle', 180, 90, 0.08, 0.1);
  }

  phaseComplete(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => this.blip('square', f, f, 0.14, 0.15, i * 0.11));
    this.blip('square', 1046.5, 1046.5, 0.4, 0.13, notes.length * 0.11);
  }

  gameComplete(): void {
    const notes = [523.25, 523.25, 523.25, 698.46, 659.25, 587.33, 523.25];
    notes.forEach((f, i) => this.blip('square', f, f, 0.16, 0.15, i * 0.14));
    this.blip('triangle', 1046.5, 1046.5, 0.55, 0.13, notes.length * 0.14 + 0.1);
  }

  gameOver(): void {
    const notes = [392, 349.23, 311.13, 261.63];
    notes.forEach((f, i) => this.blip('square', f, f, 0.2, 0.15, i * 0.18));
  }

  uiClick(): void {
    this.blip('square', 700, 900, 0.06, 0.1);
  }
}
