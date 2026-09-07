export type Mood = "calm" | "combat" | "win" | "lost";

/**
 * Chord per mood as semitone offsets from the key's root. The pad plays these
 * as four slow detuned voices; combat drops the fifth for a tense sus2 and adds
 * a low pulse, win goes major, lost goes minor and low.
 */
const CHORDS: Record<Mood, number[]> = {
  calm: [0, 7, 12, 19],
  combat: [0, 2, 7, 14],
  win: [0, 4, 7, 12],
  lost: [-12, -5, 0, 3],
};

/**
 * Minimal synthesized sound (no assets, per the code-driven content pillar):
 * an engine drone that follows speed, cannon pops, impact clicks, filtered-noise
 * explosions, a boost whoosh, and a four-voice ambient pad whose chord follows
 * the mission mood (the "music stub"). Everything hangs off one master gain; M
 * mutes. The context is created on the first pointer-lock click (autoplay policy).
 */
export class Audio {
  private pad: OscillatorNode[] = [];
  private padGain!: GainNode;
  private padFilter!: BiquadFilterNode;
  private pulseGain!: GainNode;
  private pulse!: OscillatorNode;
  private mood: Mood = "calm";
  /** MIDI note of the key's root; systems pick one so each has its own colour */
  private root = 45;
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private engine!: OscillatorNode;
  private engine2!: OscillatorNode;
  private engineGain!: GainNode;
  private engineFilter!: BiquadFilterNode;
  private noise!: AudioBuffer;
  private boostGain!: GainNode;
  /** 1 in flight, ~0 during gate travel: scales the engine and boost beds so the wormhole has the room */
  private duckLevel = 1;
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

    // pad: four triangle voices, slow attack, through a gently moving lowpass
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = "lowpass";
    this.padFilter.frequency.value = 520;
    this.padFilter.Q.value = 0.6;
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0;
    this.padFilter.connect(this.padGain).connect(this.master);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(this.padFilter.frequency);
    lfo.start();
    for (let i = 0; i < 4; i++) {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.detune.value = (i - 1.5) * 6;
      const g = ctx.createGain();
      g.gain.value = 0.25;
      o.connect(g).connect(this.padFilter);
      o.start();
      this.pad.push(o);
    }
    // combat pulse: a low sine gated by a square LFO at ~100 bpm
    this.pulse = ctx.createOscillator();
    this.pulse.type = "sine";
    const gate = ctx.createOscillator();
    gate.type = "square";
    gate.frequency.value = 1.7;
    const gateGain = ctx.createGain();
    gateGain.gain.value = 0.5;
    const gateBias = ctx.createConstantSource();
    gateBias.offset.value = 0.5;
    this.pulseGain = ctx.createGain();
    this.pulseGain.gain.value = 0;
    const gated = ctx.createGain();
    gated.gain.value = 0;
    gate.connect(gateGain).connect(gated.gain);
    gateBias.connect(gated.gain);
    this.pulse.connect(gated).connect(this.pulseGain).connect(this.master);
    gate.start();
    gateBias.start();
    this.pulse.start();
    this.applyMood(true);
    this.padGain.gain.setTargetAtTime(0.09, ctx.currentTime, 2.5);
  }

  /** Pick the key from a string (the system id), so every system hums in its own colour. */
  setKey(seed: string): void {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    this.root = 41 + (Math.abs(h) % 8); // F2 .. C3
    if (this.ctx) this.applyMood(true);
  }

  /** Mission mood; the pad glides to the new chord over a couple of seconds. */
  setMood(m: Mood): void {
    if (m === this.mood) return;
    this.mood = m;
    if (this.ctx) this.applyMood(false);
  }

  private applyMood(now: boolean): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, glide = now ? 0.01 : 1.8;
    const chord = CHORDS[this.mood];
    for (let i = 0; i < this.pad.length; i++) {
      const midi = this.root + 12 + (chord[i] ?? 0);
      const hz = 440 * Math.pow(2, (midi - 69) / 12);
      this.pad[i]!.frequency.setTargetAtTime(hz, t, glide);
    }
    this.pulse.frequency.setTargetAtTime(440 * Math.pow(2, (this.root - 69) / 12), t, 0.1);
    this.pulseGain.gain.setTargetAtTime(this.mood === "combat" ? 0.11 : 0, t, this.mood === "combat" ? 1.2 : 0.8);
    this.padFilter.frequency.setTargetAtTime(this.mood === "lost" ? 300 : this.mood === "win" ? 900 : 520, t, 1.5);
    this.padGain.gain.setTargetAtTime(this.mood === "lost" ? 0.07 : this.mood === "win" ? 0.12 : 0.09, t, 2);
  }

  setMute(v: boolean): void {
    if (v !== this.muted) this.toggleMute();
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
    this.boostGain.gain.setTargetAtTime(boosting && this.duckLevel > 0.5 ? 0.18 : 0, t, boosting ? 0.15 : 0.4);
    this.engineGain.gain.setTargetAtTime(0.12 * this.duckLevel, t, 0.25);
  }

  /** Gate travel: the engine bed and the pad step back for the wormhole, then return on arrival. */
  duck(on: boolean): void {
    this.duckLevel = on ? 0.15 : 1;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.padGain.gain.setTargetAtTime(on ? 0.03 : 0.09, t, on ? 0.6 : 2);
    this.pulseGain.gain.setTargetAtTime(on ? 0 : this.mood === "combat" ? 0.11 : 0, t, 0.6);
  }

  /**
   * The wormhole: a wide noise wash whose colour rises through the crossing, a sub swell under it and a
   * slow shimmer on top, `dur` seconds long with the tail folded into the arrival fade. Replaces the
   * missile launch sound that used to stand in for it (Ethan, 2026-09-06: "in transitions, the sound is bad").
   */
  wormhole(dur: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 1.4;
    lp.frequency.setValueAtTime(180, t);
    lp.frequency.exponentialRampToValueAtTime(2600, t + dur * 0.45);
    lp.frequency.exponentialRampToValueAtTime(320, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.42, t + 0.35);
    g.gain.setValueAtTime(0.42, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
    // the sub: a sine that dips under the crossing and rises out of it
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(38, t + dur * 0.5);
    o.frequency.exponentialRampToValueAtTime(64, t + dur);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.3, t + 0.5);
    og.gain.setValueAtTime(0.3, t + dur * 0.7);
    og.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(og).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
    // the shimmer: two detuned triangles a fifth apart, gliding up, quiet
    for (const [f0, f1] of [[220, 440], [330, 660]] as const) {
      const s = ctx.createOscillator();
      s.type = "triangle";
      s.frequency.setValueAtTime(f0, t);
      s.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.5);
      s.frequency.exponentialRampToValueAtTime(f0 * 1.5, t + dur);
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0.0001, t);
      sg.gain.exponentialRampToValueAtTime(0.045, t + 0.6);
      sg.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.connect(sg).connect(this.master);
      s.start(t);
      s.stop(t + dur + 0.05);
    }
  }

  /** The event horizon opens: a bass thump and a splash of noise. */
  kawoosh(): void {
    this.burst(240, 0.9, 0.5, 0.7, "lowpass");
    this.blip(55, 0.25, 0.6, "sine");
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

  /** A rock breaking: a dull low crack, a gravel rattle, no fireball. `size` ~ radius / 10. */
  crunch(size: number): void {
    const s = Math.min(2.5, Math.max(0.3, size));
    this.burst(90 + 40 / s, 0.9, 0.45 + 0.15 * s, 0.22 + 0.12 * s, "lowpass");
    this.burst(1600, 4, 0.16, 0.12 + 0.06 * s, "bandpass");
    // the rattle: three quick clicks trailing off
    for (let k = 1; k <= 3; k++) setTimeout(() => this.burst(2400 - k * 400, 8, 0.09 / k, 0.05, "bandpass"), 40 * k + Math.random() * 30);
  }

  lock(): void {
    this.blip(1320, 0.12, 0.09, "square");
    setTimeout(() => this.blip(1320, 0.12, 0.09, "square"), 90);
  }

  launch(): void {
    this.burst(600, 0.8, 0.4, 0.5, "bandpass");
    this.blip(220, 0.15, 0.4, "sawtooth");
  }

  ui(): void {
    this.blip(880, 0.08, 0.12, "sine");
  }

  /** A short rising tone pair for each note of the root triad, staggered: the ring pass. */
  ring(): void {
    const base = 440 * Math.pow(2, (this.root + 24 - 69) / 12);
    this.tone(base, 0.1, 0.16);
    setTimeout(() => this.tone(base * 1.5, 0.1, 0.22), 70);
  }

  /** Mission won: an ascending arpeggio of the win chord. */
  win(): void {
    this.setMood("win");
    const chord = CHORDS.win;
    chord.forEach((semi, i) => setTimeout(() => this.tone(440 * Math.pow(2, (this.root + 24 + semi - 69) / 12), 0.14, 0.5), i * 110));
  }

  /** Mission lost: two low descending tones and the pad goes dark. */
  lose(): void {
    this.setMood("lost");
    const r = 440 * Math.pow(2, (this.root + 12 - 69) / 12);
    this.tone(r, 0.16, 0.7, "sawtooth");
    setTimeout(() => this.tone(r * 0.84, 0.16, 1.1, "sawtooth"), 420);
  }

  /** Gate dial: a chevron encodes (rising click), the seventh locks (heavier). */
  chevron(index: number, last: boolean): void {
    this.blip(420 + index * 40, 0.06, 0.08, "triangle");
    this.burst(last ? 260 : 1400, 2, last ? 0.3 : 0.07, last ? 0.35 : 0.05, last ? "lowpass" : "bandpass");
  }

  /** A held tone with a soft attack (unlike `blip`, no pitch drop). */
  private tone(freq: number, gain: number, dur: number, type: OscillatorType = "sine"): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    const t = ctx.currentTime;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}
