export type AudioScene = "flight" | "travel" | "replay" | "paused" | "hub";
type SoundBus = "flight" | "travel" | "replay" | "ui";
type Voice = { source: AudioScheduledSourceNode; gain: GainNode; nodes: AudioNode[]; bus: SoundBus;
  remaining: number; at: number; rate: number; level: number; pitch: AudioParam | undefined };

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
  private scene: AudioScene = "hub";
  private pausedFrom: AudioScene | null = null;
  private buses!: Record<SoundBus, GainNode>;
  private voices = new Set<Voice>();
  private replayRate = 1;
  muted = false;
  onMuteChanged?: (muted: boolean) => void;

  constructor() {
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyM") this.toggleMute();
    });
  }

  /** Create the graph; safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended" && this.scene !== "paused") void this.ctx.resume();
      return;
    }
    const ctx = (this.ctx = new AudioContext());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(ctx.destination);
    this.buses = { flight: ctx.createGain(), travel: ctx.createGain(), replay: ctx.createGain(), ui: ctx.createGain() };
    for (const [name, bus] of Object.entries(this.buses)) {
      bus.gain.value = name === "ui" || name === (this.scene === "paused" ? this.pausedFrom : this.scene) ? 1 : 0;
      bus.connect(this.master);
    }

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
    this.engineFilter.connect(this.engineGain).connect(this.buses.flight);
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
    src.connect(bp).connect(this.boostGain).connect(this.buses.flight);
    src.start();

    // pad: four triangle voices, slow attack, through a gently moving lowpass
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = "lowpass";
    this.padFilter.frequency.value = 520;
    this.padFilter.Q.value = 0.6;
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0;
    this.padFilter.connect(this.padGain).connect(this.buses.flight);
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
    this.pulse.connect(gated).connect(this.pulseGain).connect(this.buses.flight);
    gate.start();
    gateBias.start();
    this.pulse.start();
    this.applyMood(true);
    this.padGain.gain.setTargetAtTime(0.09, ctx.currentTime, 2.5);
    if (this.scene === "paused") void ctx.suspend();
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
    this.onMuteChanged?.(this.muted);
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
  }

  private lastSpeedFrac = -1;
  private lastBoosting = false;

  /** Per frame: engine pitch/brightness from speed (0..1 of boost), boost whoosh level. Same inputs as last frame queue nothing. */
  update(speedFrac: number, boosting: boolean): void {
    if (!this.ctx) return;
    if (Math.abs(speedFrac - this.lastSpeedFrac) < 0.002 && boosting === this.lastBoosting) return;
    this.lastSpeedFrac = speedFrac;
    this.lastBoosting = boosting;
    const t = this.ctx.currentTime;
    const f = 42 + 90 * speedFrac;
    this.engine.frequency.setTargetAtTime(f, t, 0.1);
    this.engine2.frequency.setTargetAtTime(f * 1.007 + 1.5, t, 0.1);
    this.engineFilter.frequency.setTargetAtTime(220 + 900 * speedFrac, t, 0.15);
    this.boostGain.gain.setTargetAtTime(boosting ? 0.18 : 0, t, boosting ? 0.15 : 0.4);
    this.engineGain.gain.setTargetAtTime(0.12, t, 0.25);
  }

  /** One scene owns sound at a time; cancel outgoing tails as well as silencing beds. */
  setScene(scene: AudioScene): void {
    if (scene === this.scene) return;
    const previous = this.scene;
    this.scene = scene;
    if (scene === "paused") {
      this.pausedFrom = previous;
      // Suspending freezes AudioContext time, including envelopes and scheduled stops.
      // Replay/travel visuals can pause on the same frame without losing their tails.
      if (this.ctx) void this.ctx.suspend();
      return;
    }
    if (previous === "paused") {
      if (this.ctx) void this.ctx.resume();
      const resuming = this.pausedFrom === scene;
      this.pausedFrom = null;
      if (resuming) return;
    }
    if (!this.ctx) return;
    for (const voice of [...this.voices]) {
      if (voice.bus !== scene) this.stopVoice(voice);
    }
    const t = this.ctx.currentTime;
    for (const bus of ["flight", "travel", "replay"] as const) {
      this.buses[bus].gain.cancelScheduledValues(t);
      // Silence immediately on departure; gently introduce the new scene.
      this.buses[bus].gain.setValueAtTime(0, t);
      if (bus === scene) this.buses[bus].gain.linearRampToValueAtTime(1, t + 0.08);
    }
  }

  /** Compatibility for Travel's start/end notifications. */
  duck(on: boolean): void { this.setScene(on ? "travel" : "flight"); }

  setReplayRate(rate: number): void {
    const next = Math.max(0.05, Math.min(2, rate));
    if (next === this.replayRate) return;
    this.replayRate = next;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const voice of this.voices) {
      if (voice.bus !== "replay") continue;
      const elapsed = Math.max(0, t - voice.at) * voice.rate;
      voice.level *= Math.pow(0.001 / voice.level, Math.min(1, elapsed / voice.remaining));
      voice.remaining = Math.max(0.001, voice.remaining - elapsed);
      voice.at = t;
      voice.rate = next;
      voice.gain.gain.cancelScheduledValues(t);
      voice.gain.gain.setValueAtTime(Math.max(0.001, voice.level), t);
      voice.gain.gain.exponentialRampToValueAtTime(0.001, t + voice.remaining / next);
      voice.pitch?.setValueAtTime(1200 * Math.log2(next), t);
      voice.source.stop(t + voice.remaining / next + 0.02);
    }
  }

  replayShot(rate = 1): void {
    this.setReplayRate(rate);
    this.blip(660, 0.18, 0.07, "square", "replay");
    this.burst(2400, 1.2, 0.12, 0.06, "highpass", "replay");
  }

  replayExplosion(size: number, rate = 1): void {
    this.setReplayRate(rate);
    this.burst(180 * size, 0.6, 0.7, 0.9 + 0.4 * size, "lowpass", "replay");
    this.burst(900, 1.5, 0.3, 0.25, "bandpass", "replay");
  }

  private stopVoice(voice: Voice): void {
    voice.source.stop();
    voice.source.disconnect();
    for (const node of voice.nodes) node.disconnect();
    this.voices.delete(voice);
  }

  private track(source: AudioScheduledSourceNode, gain: GainNode, nodes: AudioNode[], bus: SoundBus,
    duration: number, level: number, at: number, pitch?: AudioParam): void {
    const rate = bus === "replay" ? this.replayRate : 1;
    const voice: Voice = { source, gain, nodes, bus, remaining: duration, at, rate, level, pitch };
    this.voices.add(voice);
    source.onended = () => {
      source.disconnect();
      for (const node of nodes) node.disconnect();
      this.voices.delete(voice);
    };
    pitch?.setValueAtTime(1200 * Math.log2(rate), at);
  }

  /**
   * The wormhole: a wide noise wash whose colour rises through the crossing, a sub swell under it and a
   * slow shimmer on top, `dur` seconds long with the tail folded into the arrival fade. Replaces the
   * missile launch sound that used to stand in for it (Ethan, 2026-09-06: "in transitions, the sound is bad").
   */
  wormhole(dur: number): void {
    if (!this.ctx || this.scene !== "travel") return;
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
    src.connect(lp).connect(g).connect(this.buses.travel);
    this.track(src, g, [lp, g], "travel", dur, 0.42, t);
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
    o.connect(og).connect(this.buses.travel);
    this.track(o, og, [og], "travel", dur, 0.3, t);
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
      s.connect(sg).connect(this.buses.travel);
      this.track(s, sg, [sg], "travel", dur, 0.045, t);
      s.start(t);
      s.stop(t + dur + 0.05);
    }
  }

  /** The event horizon opens: a bass thump and a splash of noise. */
  kawoosh(): void {
    this.burst(240, 0.9, 0.5, 0.7, "lowpass", "travel");
    this.blip(55, 0.25, 0.6, "sine", "travel");
  }

  private burst(freq: number, q: number, gain: number, dur: number, type: BiquadFilterType = "bandpass", bus: SoundBus = "flight", delay = 0): void {
    if (!this.ctx || this.scene === "paused" || (bus !== "ui" && this.scene !== bus)) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.frequency.value = freq;
    flt.Q.value = q;
    const g = ctx.createGain();
    const t = ctx.currentTime + delay;
    const rate = bus === "replay" ? this.replayRate : 1;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur / rate);
    src.connect(flt).connect(g).connect(this.buses[bus]);
    this.track(src, g, [flt, g], bus, dur, gain, t, src.detune);
    src.start(t, Math.random());
    src.stop(t + dur / rate + 0.05);
  }

  private blip(freq: number, gain: number, dur: number, type: OscillatorType = "square", bus: SoundBus = "flight", delay = 0): void {
    if (!this.ctx || this.scene === "paused" || (bus !== "ui" && this.scene !== bus)) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    const t = ctx.currentTime + delay;
    const rate = bus === "replay" ? this.replayRate : 1;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * 0.3), t + dur / rate);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur / rate);
    o.connect(g).connect(this.buses[bus]);
    this.track(o, g, [g], bus, dur, gain, t, o.detune);
    o.start(t);
    o.stop(t + dur / rate + 0.02);
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
    for (let k = 1; k <= 3; k++) this.burst(2400 - k * 400, 8, 0.09 / k, 0.05, "bandpass", "flight", 0.04 * k + Math.random() * 0.03);
  }

  lock(): void {
    this.blip(1320, 0.12, 0.09, "square");
    this.blip(1320, 0.12, 0.09, "square", "flight", 0.09);
  }

  launch(): void {
    this.burst(600, 0.8, 0.4, 0.5, "bandpass");
    this.blip(220, 0.15, 0.4, "sawtooth");
  }

  ui(): void {
    this.blip(880, 0.08, 0.12, "sine", "ui");
  }

  /** A short rising tone pair for each note of the root triad, staggered: the ring pass. */
  ring(): void {
    const base = 440 * Math.pow(2, (this.root + 24 - 69) / 12);
    this.tone(base, 0.1, 0.16);
    this.tone(base * 1.5, 0.1, 0.22, "sine", 0.07);
  }

  /** Mission won: an ascending arpeggio of the win chord. */
  win(): void {
    this.setMood("win");
    const chord = CHORDS.win;
    chord.forEach((semi, i) => this.tone(440 * Math.pow(2, (this.root + 24 + semi - 69) / 12), 0.14, 0.5, "sine", i * 0.11));
  }

  /** Mission lost: two low descending tones and the pad goes dark. */
  lose(): void {
    this.setMood("lost");
    const r = 440 * Math.pow(2, (this.root + 12 - 69) / 12);
    this.tone(r, 0.16, 0.7, "sawtooth");
    this.tone(r * 0.84, 0.16, 1.1, "sawtooth", 0.42);
  }

  /** Gate dial: a chevron encodes (rising click), the seventh locks (heavier). */
  chevron(index: number, last: boolean): void {
    this.blip(420 + index * 40, 0.06, 0.08, "triangle", "travel");
    this.burst(last ? 260 : 1400, 2, last ? 0.3 : 0.07, last ? 0.35 : 0.05, last ? "lowpass" : "bandpass", "travel");
  }

  /** A held tone with a soft attack (unlike `blip`, no pitch drop). */
  private tone(freq: number, gain: number, dur: number, type: OscillatorType = "sine", delay = 0): void {
    if (!this.ctx || this.scene !== "flight") return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    const t = ctx.currentTime + delay;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.buses.flight);
    this.track(o, g, [g], "flight", dur, gain, t);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}
