import * as THREE from "three";
import type { Flight } from "@/sim/flight";
import type { Enemy, RockSpheres } from "@/combat/enemies";
import { Projectiles } from "@/combat/projectiles";
import { T } from "@/core/tunables";

/**
 * enemy slots recorded per frame. Slots hold whichever enemies are alive that tick, by id, so a sortie that
 * spawns thirty over its life still replays every one that mattered; more than SLOTS alive at once and the
 * rest are not replayed (the old list-index scheme lost every enemy past the tenth spawned, so a late kill
 * played as a bare explosion; Ethan, 2026-09-06: "making sure they show everything, including the kill")
 */
const SLOTS = 16;
/** floats per slot: alive, id, 3 pos, 4 quat */
const SS = 9;
/** floats per frame: t + player (3 pos, 4 quat) + SLOTS × SS */
const STRIDE = 8 + SLOTS * SS;
/** seconds of history kept (at the 60 Hz sim step) */
const KEEP = 12;
const FRAMES = KEEP * 60;
/** clip window around the kill, in seconds of sim time, and the playback rate */
/** seconds kept before and after the kill (Ethan, 2026-09-05: "more time before + a little after the kill") */
const PRE = 7;
const POST = 3;
/** playback rate, and the slower rate inside ±SLOW_WIN s of the kill */
const RATE = 0.7;
const SLOW_RATE = 0.3;
const SLOW_WIN = 0.45;
/** player rounds remembered: t + pos + vel, enough for ~13 s at the cannon's rate */
const SHOTS = 800;
const SSTRIDE = 7;

interface Burst {
  t: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  scale: number;
  /** an enemy death (a rock break otherwise); only these can be the scored kill */
  kill: boolean;
}

interface Highlight {
  frames: Float32Array;
  count: number;
  bursts: Burst[];
  /** player rounds in the window, chronological, SSTRIDE floats each */
  shots: Float32Array;
  /** where and when the scored kill happened; the second camera is parked beside it */
  kill: THREE.Vector3;
  killT: number;
  /** the two parked cameras, chosen at the cut from a list of candidates: clear of every rock, with a sight line to the kill */
  camA: THREE.Vector3;
  camB: THREE.Vector3;
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
const _look = new THREE.Vector3();
const _v = new THREE.Vector3();
const _sd = new THREE.Vector3();

/** squared distance from point `c` to segment ab */
function segDist2(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): number {
  _sd.subVectors(b, a);
  const l2 = _sd.lengthSq();
  let t = l2 > 0 ? ((c.x - a.x) * _sd.x + (c.y - a.y) * _sd.y + (c.z - a.z) * _sd.z) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = a.x + _sd.x * t - c.x, dy = a.y + _sd.y * t - c.y, dz = a.z + _sd.z * t - c.z;
  return dx * dx + dy * dy + dz * dz;
}

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
  private readonly shotRing = new Float32Array(SHOTS * SSTRIDE);
  private shotHead = 0;
  private shotCount = 0;
  private shotIdx = 0;
  /** visual-only tracer pool the clip re-emits into; nothing resolves hits against it. `game.ts` adds the group to the scene. */
  readonly tracers = new Projectiles(128);
  private pending: { at: number; score: number } | null = null;
  private highlight: Highlight | null = null;
  private clip: Highlight | null = null;
  private clipT = 0;
  private burstIdx = 0;
  private savedFov = 60;
  /** seconds since the last barrel roll, for the style score */
  sinceBarrel = 99;
  /** the belt, for parking the cameras somewhere they can see from (game.ts sets it) */
  rocks: RockSpheres | null = null;

  get hasHighlight(): boolean {
    return this.highlight !== null;
  }
  get playing(): boolean {
    return this.clip !== null;
  }
  /** playback position as a fraction of the clip (0 before, 1 after); the headless replay test times its probes on it */
  get progress(): number {
    const c = this.clip;
    if (!c) return this.highlight ? 0 : 2;
    const t0 = c.frames[0]!, t1 = c.frames[(c.count - 1) * STRIDE]!;
    return (this.clipT - t0) / (t1 - t0);
  }

  record(dt: number, flight: Flight, enemies: Enemy[]): void {
    this.t += dt;
    this.sinceBarrel = flight.barrelLeft !== 0 ? 0 : this.sinceBarrel + dt;
    const o = this.head * STRIDE, r = this.ring;
    r[o] = this.t;
    r[o + 1] = flight.pos.x; r[o + 2] = flight.pos.y; r[o + 3] = flight.pos.z;
    r[o + 4] = flight.quat.x; r[o + 5] = flight.quat.y; r[o + 6] = flight.quat.z; r[o + 7] = flight.quat.w;
    let s = 0;
    for (const e of enemies) {
      if (!e.alive || s >= SLOTS) continue;
      const b = o + 8 + s * SS;
      r[b] = 1; r[b + 1] = e.id;
      r[b + 2] = e.pos.x; r[b + 3] = e.pos.y; r[b + 4] = e.pos.z;
      r[b + 5] = e.quat.x; r[b + 6] = e.quat.y; r[b + 7] = e.quat.z; r[b + 8] = e.quat.w;
      s++;
    }
    for (; s < SLOTS; s++) r[o + 8 + s * SS] = 0;
    this.head = (this.head + 1) % FRAMES;
    if (this.count < FRAMES) this.count++;
    // bursts older than the buffer fall off
    while (this.bursts.length && this.bursts[0]!.t < this.t - KEEP) this.bursts.shift();
    if (this.pending && this.t >= this.pending.at + POST) this.cut();
  }

  /** A player round left the gun (combat's onFire). */
  markShot(pos: THREE.Vector3, vel: THREE.Vector3): void {
    const o = this.shotHead * SSTRIDE, r = this.shotRing;
    r[o] = this.t;
    r[o + 1] = pos.x; r[o + 2] = pos.y; r[o + 3] = pos.z;
    r[o + 4] = vel.x; r[o + 5] = vel.y; r[o + 6] = vel.z;
    this.shotHead = (this.shotHead + 1) % SHOTS;
    if (this.shotCount < SHOTS) this.shotCount++;
  }

  /** A rock broke (combat's rock burst): the clip re-emits it, so an asteroid kill shows the rock going too. */
  markBurst(pos: THREE.Vector3, scale: number): void {
    this.bursts.push({ t: this.t, pos: pos.clone(), vel: new THREE.Vector3(), scale, kill: false });
  }

  /** A glider went down: score the moment and schedule the cut. */
  markKill(pos: THREE.Vector3, vel: THREE.Vector3, flight: Flight, stick: { x: number; y: number }, scale = 5): void {
    this.bursts.push({ t: this.t, pos: pos.clone(), vel: vel.clone(), scale, kill: true });
    let score = 1 + Math.min(1, Math.hypot(stick.x, stick.y)) + Math.min(1, flight.speed / 300);
    if (this.sinceBarrel < 3) score += 2.5;
    if (flight.boosting) score += 0.5;
    // the latest kill is the one on offer (Ethan, 2026-09-05: "press v at any point ... to show the last kill")
    this.pending = { at: this.t, score };
  }

  private cut(): void {
    const P = this.pending!;
    this.pending = null;
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
    const bursts = this.bursts.filter((b) => b.t >= from && b.t <= to);
    // the scored kill is the enemy death nearest the mark
    let kill: Burst | undefined;
    for (const b of bursts) if (b.kill && (!kill || Math.abs(b.t - P.at) < Math.abs(kill.t - P.at))) kill = b;
    const shots = new Float32Array(this.shotCount * SSTRIDE);
    let m = 0;
    for (let i = 0; i < this.shotCount; i++) {
      const idx = ((this.shotHead - this.shotCount + i) % SHOTS + SHOTS) % SHOTS, o = idx * SSTRIDE;
      const t = this.shotRing[o]!;
      if (t < from || t > to) continue;
      shots.set(this.shotRing.subarray(o, o + SSTRIDE), m * SSTRIDE);
      m++;
    }
    const killT = kill ? kill.t : P.at;
    // ship pose at the kill: the frame nearest killT
    let kf = 0;
    for (let i = 0; i < k; i++) if (Math.abs(frames[i * STRIDE]! - killT) < Math.abs(frames[kf * STRIDE]! - killT)) kf = i;
    const ko = kf * STRIDE;
    _q.set(frames[ko + 4]!, frames[ko + 5]!, frames[ko + 6]!, frames[ko + 7]!);
    const killSide = _side.set(-1, 0, 0).applyQuaternion(_q);
    const killFwd = _fwd.set(0, 0, 1).applyQuaternion(_q);
    const killPos = kill ? kill.pos.clone() : new THREE.Vector3(frames[k * STRIDE - STRIDE + 1], frames[k * STRIDE - STRIDE + 2], frames[k * STRIDE - STRIDE + 3]);
    // Shot B: parked near the kill. The first choice sits past the kill point along the ship's heading and off to
    // starboard, looking back down the approach; when that is inside a rock (an asteroid kill: the victim died
    // on the rock's face, straight ahead of the ship) the next candidates swing round the kill until one is in
    // clear space with a sight line to the kill and to the ship a couple of seconds before it.
    const ship2 = _a.set(frames[ko + 1]!, frames[ko + 2]!, frames[ko + 3]!);
    let kf2 = kf;
    while (kf2 > 0 && frames[kf2 * STRIDE]! > killT - 2) kf2--;
    _b.set(frames[kf2 * STRIDE + 1]!, frames[kf2 * STRIDE + 2]!, frames[kf2 * STRIDE + 3]!);
    const camB = this.park(killPos, killFwd, killSide, [[40, 20, 9], [40, -20, 9], [10, 45, 12], [10, -45, 12], [-45, 15, 18], [-45, -15, 18], [0, 0, 55], [0, 0, -55]], [killPos, _b, ship2]);
    // Shot A: beside the path a third of the way in; the mirror side or overhead when the belt is in the way
    const oa2 = Math.floor(k * 0.3) * STRIDE;
    const pa = new THREE.Vector3(frames[oa2 + 1]!, frames[oa2 + 2]!, frames[oa2 + 3]!);
    _q.set(frames[oa2 + 4]!, frames[oa2 + 5]!, frames[oa2 + 6]!, frames[oa2 + 7]!);
    const sideA = _side.set(-1, 0, 0).applyQuaternion(_q), fwdA = _fwd.set(0, 0, 1).applyQuaternion(_q);
    const oa3 = Math.floor(k * 0.45) * STRIDE;
    _b.set(frames[oa3 + 1]!, frames[oa3 + 2]!, frames[oa3 + 3]!);
    const camA = this.park(pa, fwdA, sideA, [[8, 24, 7], [8, -24, 7], [-6, 0, 30], [-6, 0, -26], [8, 36, 20], [8, -36, 20]], [pa, _b]);
    this.highlight = { frames, count: k, bursts, shots: shots.subarray(0, m * SSTRIDE), kill: killPos, killT, camA, camB, score: P.score };
  }

  /**
   * Pick a camera spot: `base + fwd·o[0] + side·o[1] + up·o[2]` for the first offset that is outside every
   * rock and has a clear line to each of `sees`. Falls back to the first offset when nothing is clear.
   */
  private park(base: THREE.Vector3, fwd: THREE.Vector3, side: THREE.Vector3, offsets: [number, number, number][], sees: THREE.Vector3[]): THREE.Vector3 {
    const R = this.rocks;
    const out = new THREE.Vector3();
    for (const [f, s, u] of offsets) {
      out.copy(base).addScaledVector(fwd, f).addScaledVector(side, s).addScaledVector(Y, u);
      if (!R) return out;
      let ok = true;
      for (let i = 0; i < R.count && ok; i++) {
        const r = R.radii[i]!;
        if (r <= 0) continue;
        _v.set(R.centers[i * 3]!, R.centers[i * 3 + 1]!, R.centers[i * 3 + 2]!);
        const keep = r + 8;
        if (_v.distanceToSquared(out) < keep * keep) ok = false;
        for (const p of sees) if (ok && segDist2(out, p, _v) < r * r * 0.81) ok = false;
      }
      if (ok) return out;
    }
    return out.copy(base).addScaledVector(fwd, offsets[0]![0]).addScaledVector(side, offsets[0]![1]).addScaledVector(Y, offsets[0]![2]);
  }

  /** Cut the pending kill now instead of waiting POST seconds (V pressed mid-sortie). */
  cutNow(): void {
    if (this.pending) this.cut();
  }

  play(cam: THREE.PerspectiveCamera): boolean {
    if (!this.highlight || this.clip) return false;
    this.clip = this.highlight;
    this.clipT = this.clip.frames[0]!;
    this.burstIdx = 0;
    this.shotIdx = 0;
    this.savedFov = cam.fov;
    return true;
  }

  stop(cam: THREE.PerspectiveCamera, enemies: Enemy[]): void {
    if (!this.clip) return;
    this.clip = null;
    this.tracers.clear();
    this.tracers.update();
    for (const e of enemies) e.rig.root.visible = e.alive;
    cam.fov = this.savedFov;
    cam.updateProjectionMatrix();
  }

  /** 1 while the kill point lies at least `fade` m ahead of the ship, 0 once it is behind (uses _p and _fwd as set by update). */

  /** Drive ship, gliders and camera from the clip; call after the normal render pass. Returns false when the clip ends. */
  update(dt: number, cam: THREE.PerspectiveCamera, ship: THREE.Object3D, enemies: Enemy[], burst: (pos: THREE.Vector3, vel: THREE.Vector3, scale: number) => void): boolean {
    const c = this.clip;
    if (!c) return false;
    const F = c.frames, n = c.count;
    const t1 = F[(n - 1) * STRIDE]!;
    // slow motion around the kill, normal speed elsewhere
    const rate = Math.abs(this.clipT - c.killT) < SLOW_WIN ? SLOW_RATE : RATE;
    this.clipT += dt * rate;
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
    for (const e of enemies) e.rig.root.visible = false;
    for (let s = 0; s < SLOTS; s++) {
      const a = oa + 8 + s * SS;
      if (F[a]! < 0.5) break;
      const e = enemies[F[a + 1]!];
      if (!e) continue;
      // the same enemy's slot in the next frame may differ once another dies; find it by id
      let b = -1;
      for (let s2 = 0; s2 < SLOTS; s2++) {
        const c = ob + 8 + s2 * SS;
        if (F[c]! < 0.5) break;
        if (F[c + 1] === F[a + 1]) (b = c), (s2 = SLOTS);
      }
      e.rig.root.visible = true;
      if (b < 0) e.rig.root.position.set(F[a + 2]!, F[a + 3]!, F[a + 4]!), e.rig.root.quaternion.set(F[a + 5]!, F[a + 6]!, F[a + 7]!, F[a + 8]!);
      else pose(a + 2, b + 2, e.rig.root.position, e.rig.root.quaternion);
    }
    while (this.burstIdx < c.bursts.length && c.bursts[this.burstIdx]!.t <= this.clipT) {
      const b = c.bursts[this.burstIdx++]!;
      burst(b.pos, b.vel, b.scale);
    }
    // the player's rounds, re-emitted into the visual pool at the clip's rate
    const S = c.shots;
    const ttl = T.weapons.range / T.weapons.muzzleSpeed;
    while (this.shotIdx * SSTRIDE < S.length && S[this.shotIdx * SSTRIDE]! <= this.clipT) {
      const o = this.shotIdx++ * SSTRIDE;
      this.tracers.spawn("player", _a.set(S[o + 1]!, S[o + 2]!, S[o + 3]!), _v.set(S[o + 4]!, S[o + 5]!, S[o + 6]!), ttl);
    }
    this.tracers.tick(dt * rate);
    this.tracers.update();
    // Camera: two cameras parked in the world, each tracking the ship. Nothing is attached to the ship, so its
    // speed reads as the pan rate and the parallax of the pass (Ethan, 2026-09-05: "it looked like I was a
    // stationary ship moving a tiny bit to the right and left"). Shot A sits beside the path a third of the way
    // in: the ship comes at it, whips past, runs on. Shot B sits beside the kill point: the ship comes at it,
    // the kill goes off close, the ship passes and recedes into the debris.
    _p.copy(ship.position);
    if (this.clipT < c.killT - 3.2) {
      // lead room: the frame looks a little ahead of the ship along its heading, so whatever it is chasing sits
      // in the picture with it instead of off the edge (the victim was out of frame in every shot A, 2026-09-06)
      cam.position.copy(c.camA);
      cam.fov = 66;
      _fwd.set(0, 0, 1).applyQuaternion(ship.quaternion);
      _look.copy(_p).addScaledVector(_fwd, 24);
    } else {
      // parked near the kill point (see `cut` for how the spot is chosen), looking back down the approach: the
      // victim is in front of the lens with the ship closing behind it, the burst goes off close, then the ship
      // passes and the camera swings after it (Ethan, 2026-09-05: "showing the enemy ship getting blown up")
      cam.position.copy(c.camB);
      cam.fov = 62;
      // after the kill the look settles between the ship and the wreck rather than on the ship alone, so the
      // debris (or the rock, on an asteroid kill) stays in the picture while the ship recedes
      const after = Math.min(1, Math.max(0, (this.clipT - c.killT) / 0.8));
      _look.copy(_p).lerp(c.kill, 0.5 - 0.2 * after);
    }
    cam.up.copy(Y);
    cam.lookAt(_look);
    cam.updateProjectionMatrix();
    return true;
  }
}
