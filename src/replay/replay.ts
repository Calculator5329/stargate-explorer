import * as THREE from "three";
import type { Flight } from "@/sim/flight";
import type { Enemy } from "@/combat/enemies";

/** enemy slots recorded per frame (list index); more than this many gliders are simply not replayed */
const SLOTS = 10;
/** floats per frame: t + player (3 pos, 4 quat) + SLOTS × (alive, 3 pos, 4 quat) */
const STRIDE = 8 + SLOTS * 8;
/** seconds of history kept (at the 60 Hz sim step) */
const KEEP = 10;
const FRAMES = KEEP * 60;
/** clip window around the kill, in seconds of sim time, and the playback rate */
const PRE = 4.5;
const POST = 1.6;
const RATE = 0.55;

interface Burst {
  t: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  scale: number;
}

interface Highlight {
  frames: Float32Array;
  count: number;
  bursts: Burst[];
  score: number;
}

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _side = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

/**
 * Kill replay. Every sim tick records the player's and each glider's pose into
 * a ring buffer. A kill marks a highlight: once `POST` seconds have passed the
 * window `[kill - PRE, kill + POST]` is copied out (the best-scoring kill of the
 * sortie is kept; a barrel roll or a hard turn just before the kill scores
 * higher). `play()` then drives the ship, the gliders and the camera from the
 * clip in slow motion with two shots: a drone parked off the player's line,
 * then a close orbit through the kill.
 */
export class Replay {
  private readonly ring = new Float32Array(FRAMES * STRIDE);
  private head = 0;
  private count = 0;
  private t = 0;
  private readonly bursts: Burst[] = [];
  private pending: { at: number; score: number } | null = null;
  private highlight: Highlight | null = null;
  private clip: Highlight | null = null;
  private clipT = 0;
  private burstIdx = 0;
  private savedFov = 60;
  /** seconds since the last barrel roll, for the style score */
  sinceBarrel = 99;

  get hasHighlight(): boolean {
    return this.highlight !== null;
  }
  get playing(): boolean {
    return this.clip !== null;
  }

  record(dt: number, flight: Flight, enemies: Enemy[]): void {
    this.t += dt;
    this.sinceBarrel = flight.barrelLeft !== 0 ? 0 : this.sinceBarrel + dt;
    const o = this.head * STRIDE, r = this.ring;
    r[o] = this.t;
    r[o + 1] = flight.pos.x; r[o + 2] = flight.pos.y; r[o + 3] = flight.pos.z;
    r[o + 4] = flight.quat.x; r[o + 5] = flight.quat.y; r[o + 6] = flight.quat.z; r[o + 7] = flight.quat.w;
    for (let s = 0; s < SLOTS; s++) {
      const e = enemies[s], b = o + 8 + s * 8;
      if (!e || !e.alive) { r[b] = 0; continue; }
      r[b] = 1;
      r[b + 1] = e.pos.x; r[b + 2] = e.pos.y; r[b + 3] = e.pos.z;
      r[b + 4] = e.quat.x; r[b + 5] = e.quat.y; r[b + 6] = e.quat.z; r[b + 7] = e.quat.w;
    }
    this.head = (this.head + 1) % FRAMES;
    if (this.count < FRAMES) this.count++;
    // bursts older than the buffer fall off
    while (this.bursts.length && this.bursts[0]!.t < this.t - KEEP) this.bursts.shift();
    if (this.pending && this.t >= this.pending.at + POST) this.cut();
  }

  /** A glider went down: score the moment and schedule the cut. */
  markKill(pos: THREE.Vector3, vel: THREE.Vector3, flight: Flight, stick: { x: number; y: number }, scale = 5): void {
    this.bursts.push({ t: this.t, pos: pos.clone(), vel: vel.clone(), scale });
    let score = 1 + Math.min(1, Math.hypot(stick.x, stick.y)) + Math.min(1, flight.speed / 300);
    if (this.sinceBarrel < 3) score += 2.5;
    if (flight.boosting) score += 0.5;
    // a later kill replaces an earlier one unless the earlier was clearly better
    if (!this.pending || score >= this.pending.score * 0.8) this.pending = { at: this.t, score };
  }

  private cut(): void {
    const P = this.pending!;
    this.pending = null;
    if (this.highlight && P.score < this.highlight.score * 0.8) return;
    const from = P.at - PRE, to = P.at + POST;
    const n = Math.min(this.count, FRAMES);
    const frames = new Float32Array(n * STRIDE);
    let k = 0;
    for (let i = 0; i < n; i++) {
      const idx = ((this.head - n + i) % FRAMES + FRAMES) % FRAMES, o = idx * STRIDE;
      const t = this.ring[o]!;
      if (t < from || t > to) continue;
      frames.set(this.ring.subarray(o, o + STRIDE), k * STRIDE);
      k++;
    }
    if (k < 30) return;
    this.highlight = { frames, count: k, bursts: this.bursts.filter((b) => b.t >= from && b.t <= to), score: P.score };
  }

  play(cam: THREE.PerspectiveCamera): boolean {
    if (!this.highlight || this.clip) return false;
    this.clip = this.highlight;
    this.clipT = this.clip.frames[0]!;
    this.burstIdx = 0;
    this.savedFov = cam.fov;
    return true;
  }

  stop(cam: THREE.PerspectiveCamera, enemies: Enemy[]): void {
    if (!this.clip) return;
    this.clip = null;
    for (const e of enemies) e.rig.root.visible = e.alive;
    cam.fov = this.savedFov;
    cam.updateProjectionMatrix();
  }

  /** Drive ship, gliders and camera from the clip; call after the normal render pass. Returns false when the clip ends. */
  update(dt: number, cam: THREE.PerspectiveCamera, ship: THREE.Object3D, enemies: Enemy[], burst: (pos: THREE.Vector3, vel: THREE.Vector3, scale: number) => void): boolean {
    const c = this.clip;
    if (!c) return false;
    const F = c.frames, n = c.count;
    const t0 = F[0]!, t1 = F[(n - 1) * STRIDE]!;
    this.clipT += dt * RATE;
    if (this.clipT > t1) {
      this.stop(cam, enemies);
      return false;
    }
    // frame pair around clipT (frames are monotonic in t)
    let i = 0;
    while (i < n - 2 && F[(i + 1) * STRIDE]! < this.clipT) i++;
    const oa = i * STRIDE, ob = (i + 1) * STRIDE;
    const ta = F[oa]!, tb = F[ob]!, u = tb > ta ? Math.min(1, Math.max(0, (this.clipT - ta) / (tb - ta))) : 0;
    const pose = (o0: number, o1: number, pos: THREE.Vector3, quat: THREE.Quaternion) => {
      pos.set(F[o0]!, F[o0 + 1]!, F[o0 + 2]!).lerp(_b.set(F[o1]!, F[o1 + 1]!, F[o1 + 2]!), u);
      quat.set(F[o0 + 3]!, F[o0 + 4]!, F[o0 + 5]!, F[o0 + 6]!).slerp(_q2.set(F[o1 + 3]!, F[o1 + 4]!, F[o1 + 5]!, F[o1 + 6]!), u);
    };
    pose(oa + 1, ob + 1, ship.position, ship.quaternion);
    ship.visible = true;
    for (let s = 0; s < SLOTS; s++) {
      const e = enemies[s];
      if (!e) break;
      const alive = F[oa + 8 + s * 8]! > 0.5;
      e.rig.root.visible = alive;
      if (alive) pose(oa + 9 + s * 8, ob + 9 + s * 8, e.rig.root.position, e.rig.root.quaternion);
    }
    while (this.burstIdx < c.bursts.length && c.bursts[this.burstIdx]!.t <= this.clipT) {
      const b = c.bursts[this.burstIdx++]!;
      burst(b.pos, b.vel, b.scale);
    }
    // camera: shot A, a drone parked off the player's opening line; shot B, a close orbit through the kill
    const frac = (this.clipT - t0) / (t1 - t0);
    _p.copy(ship.position);
    _fwd.set(0, 0, 1).applyQuaternion(ship.quaternion);
    if (frac < 0.5) {
      // the drone sits beside the point the ship reaches a third of the way in: it comes at you, passes close, runs on toward the kill
      const oa2 = Math.floor(n * 0.33) * STRIDE;
      _a.set(F[oa2 + 1]!, F[oa2 + 2]!, F[oa2 + 3]!);
      _q.set(F[oa2 + 4]!, F[oa2 + 5]!, F[oa2 + 6]!, F[oa2 + 7]!);
      _side.set(1, 0, 0).applyQuaternion(_q);
      cam.position.copy(_a).addScaledVector(_side, 26).addScaledVector(Y, 9);
      cam.fov = 50;
    } else {
      const ang = (frac - 0.5) * 2 * Math.PI * 0.9 + 0.6;
      _side.crossVectors(_fwd, Y).normalize();
      if (_side.lengthSq() < 0.1) _side.set(1, 0, 0);
      cam.position.copy(_p).addScaledVector(_side, Math.cos(ang) * 30).addScaledVector(_fwd, Math.sin(ang) * 30 - 6).addScaledVector(Y, 9);
      cam.fov = 58;
    }
    cam.up.copy(Y);
    cam.lookAt(_p);
    cam.updateProjectionMatrix();
    return true;
  }
}
