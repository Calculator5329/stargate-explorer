/**
 * Minimal synthesized sound (no assets, per the code-driven content pillar):
 * an engine drone that follows speed, cannon pops, impact clicks, filtered-noise
 * explosions and a boost whoosh. Everything hangs off one master gain; M mutes.
 * The context is created on the first pointer-lock click (autoplay policy).
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private engine!: OscillatorNode;
  private engine2!: OscillatorNode;
  private engineGain!: GainNode;
  private engineFilter!: BiquadFilterNode;
  private noise!: AudioBuffer;
  private boostGain!: GainNode;
  muted = false;

  constructor() {
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyM") this.toggleMute();
    });
  }

  /** Create the graph; safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const ctx = (this.ctx = new AudioContext());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(ctx.destination);

    // noise buffer for explosions/whoosh
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // engine: two detuned saws through a lowpass
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.value = 300;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.12;
    this.engine = ctx.createOscillator();
    this.engine.type = "sawtooth";
    this.engine2 = ctx.createOscillator();
    this.engine2.type = "sawtooth";
    this.engine.connect(this.engineFilter);
    this.engine2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain).connect(this.master);
    this.engine.start();
    this.engine2.start();

    // boost: looped noise through a bandpass, gain ramps
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    bp.Q.value = 0.7;
    this.boostGain = ctx.createGain();
    this.boostGain.gain.value = 0;
    src.connect(bp).connect(this.boostGain).connect(this.master);
    src.start();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
  }

  /** Per frame: engine pitch/brightness from speed (0..1 of boost), boost whoosh level. */
  update(speedFrac: number, boosting: boolean): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = 42 + 90 * speedFrac;
    this.engine.frequency.setTargetAtTime(f, t, 0.1);
    this.engine2.frequency.setTargetAtTime(f * 1.007 + 1.5, t, 0.1);
    this.engineFilter.frequency.setTargetAtTime(220 + 900 * speedFrac, t, 0.15);
    this.boostGain.gain.setTargetAtTime(boosting ? 0.18 : 0, t, boosting ? 0.15 : 0.4);
  }

  private burst(freq: number, q: number, gain: number, dur: number, type: BiquadFilterType = "bandpass"): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.frequency.value = freq;
    flt.Q.value = q;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(flt).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  private blip(freq: number, gain: number, dur: number, type: OscillatorType = "square"): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * 0.3), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  cannon(): void {
    this.blip(620 + Math.random() * 80, 0.18, 0.07);
    this.burst(2400, 1.2, 0.12, 0.06, "highpass");
  }

  hit(): void {
    this.burst(1800, 3, 0.2, 0.08);
  }

  damage(): void {
    this.burst(400, 1, 0.35, 0.18, "lowpass");
    this.blip(140, 0.2, 0.15, "sine");
  }

  explosion(size: number): void {
    this.burst(180 * size, 0.6, 0.7, 0.9 + 0.4 * size, "lowpass");
    this.burst(900, 1.5, 0.3, 0.25);
  }

  ui(): void {
    this.blip(880, 0.08, 0.12, "sine");
  }
}
