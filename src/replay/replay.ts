import * as THREE from "three";
import type { Flight } from "@/sim/flight";
import type { Enemy, RockSpheres } from "@/combat/enemies";
import { Projectiles } from "@/combat/projectiles";
import { T } from "@/core/tunables";
import { Explosions } from "@/fx/explosion";

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
const KEEP = 42;
const FRAMES = KEEP * 60;
/** clip window around the kill, in seconds of sim time, and the playback rate */
/** seconds kept before and after the kill (Ethan, 2026-09-05: "more time before + a little after the kill") */
const PRE = 7;
const POST = 3;
/** playback rate, and the slower rate inside ±SLOW_WIN s of the kill */
const RATE = 1;
const SLOW_RATE = 0.3;
const SLOW_WIN = 0.45;
/** player rounds remembered: t + pos + vel, enough for the maximum capture window at the cannon's rate */
const SHOTS = 2800;
const SSTRIDE = 7;

interface Burst {
  t: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  scale: number;
  /** an enemy death (a rock break otherwise); deaths define the sequence */
  kill: boolean;
  seed: number;
  victimId: number;
}

interface Highlight {
  frames: Float32Array;
  count: number;
  bursts: Burst[];
  /** player rounds in the window, chronological, SSTRIDE floats each */
  shots: Float32Array;
  camA: THREE.Vector3;
  kills: { event: Burst; view: THREE.Vector3; anchor: THREE.Vector3; radius: number }[];
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
const _offset = new THREE.Vector3();

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
 * window from the first selected kill minus PRE through the latest kill plus POST
 * is copied out. At most N kills inside X seconds are retained. `play()` then drives the ship, the gliders and the camera from the
 * clip with a parked approach, paired kill framing and player follow-through.
 */
export class Replay {
  private readonly ring = new Float32Array(FRAMES * STRIDE);
  private head = 0;
  private count = 0;
  private t = 0;
  private eventTime = 0;
  private readonly bursts: Burst[] = [];
  private readonly shotRing = new Float32Array(SHOTS * SSTRIDE);
  private shotHead = 0;
  private shotCount = 0;
  private shotIdx = 0;
  /** visual-only tracer pool the clip re-emits into; nothing resolves hits against it. `game.ts` adds the group to the scene. */
  readonly tracers = new Projectiles(128);
  /** Replay has its own visual pools: playing a clip never mutates the live combat effects. */
  readonly fx = new Explosions();
  readonly group = new THREE.Group();
  readonly velocity = new THREE.Vector3();
  onShot: ((rate: number) => void) | null = null;
  onBurst: ((scale: number, rate: number) => void) | null = null;
  private pending: { at: number } | null = null;
  private highlight: Highlight | null = null;
  private clip: Highlight | null = null;
  private clipT = 0;
  private burstIdx = 0;
  private savedFov = 60;
  /** the belt, for parking the cameras somewhere they can see from (game.ts sets it) */
  rocks: RockSpheres | null = null;

  constructor() { this.group.add(this.tracers.group, this.fx.group); }

  get playbackRate(): number {
    if (!this.clip) return 1;
    let nearest = Infinity;
    for (const { event } of this.clip.kills) nearest = Math.min(nearest, Math.abs(this.clipT - event.t));
    const u = Math.min(1, Math.max(0, (nearest - SLOW_WIN) / .4));
    return SLOW_RATE + (RATE - SLOW_RATE) * u * u * (3 - 2 * u);
  }

  cueProgress(offset: number): number {
    const c = this.highlight;
    if (!c) return 0;
    const first = c.frames[0]!, last = c.frames[(c.count - 1) * STRIDE]!;
    return Math.min(.98, Math.max(0, (c.kills[c.kills.length - 1]!.event.t + offset - first) / (last - first)));
  }

  get highlightKills(): number { return (this.clip ?? this.highlight)?.kills.length ?? 0; }

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

  /** Combat runs before the pose sample; stamp its events with that tick's end time. */
  beginTick(dt: number): void { this.eventTime = this.t + dt; }

  record(dt: number, flight: Flight, enemies: Enemy[]): void {
    this.t += dt;
    this.eventTime = this.t;
    const o = this.head * STRIDE, r = this.ring;
    r[o] = this.eventTime;
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
    r[o] = this.eventTime;
    r[o + 1] = pos.x; r[o + 2] = pos.y; r[o + 3] = pos.z;
    r[o + 4] = vel.x; r[o + 5] = vel.y; r[o + 6] = vel.z;
    this.shotHead = (this.shotHead + 1) % SHOTS;
    if (this.shotCount < SHOTS) this.shotCount++;
  }

  /** A rock broke (combat's rock burst): the clip re-emits it, so an asteroid kill shows the rock going too. */
  markBurst(pos: THREE.Vector3, scale: number, seed = 1): void {
    this.bursts.push({ t: this.eventTime, pos: pos.clone(), vel: new THREE.Vector3(), scale, kill: false, seed, victimId: -1 });
  }

  /** A glider went down: extend the latest sequence and schedule its cut. */
  markKill(pos: THREE.Vector3, vel: THREE.Vector3, _flight: Flight, _stick: { x: number; y: number }, scale = 5, seed = 1, victimId = -1): void {
    this.bursts.push({ t: this.eventTime, pos: pos.clone(), vel: vel.clone(), scale, kill: true, seed, victimId });
    this.pending = { at: this.eventTime };
  }

  private cut(): void {
    const P = this.pending!;
    this.pending = null;
    // The latest N deaths within X seconds form one continuous highlight. Earlier
    // completed clips can grow when another kill lands inside the same window.
    const limit = Math.max(1, Math.min(8, Math.round(T.replay.maxKills)));
    const window = Math.max(0, Math.min(30, T.replay.windowSeconds));
    const deaths = this.bursts.filter(b => b.kill && b.t <= P.at);
    const selected = deaths.filter(b => b.t >= P.at - window - 1e-6).slice(-limit);
    const first = selected[0]?.t ?? P.at;
    const previous = deaths[deaths.length - selected.length - 1];
    const from = Math.max(first - PRE, previous ? previous.t + 1 / 60 : -Infinity), to = P.at + POST;
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
    const shots = new Float32Array(this.shotCount * SSTRIDE);
    let m = 0;
    for (let i = 0; i < this.shotCount; i++) {
      const idx = ((this.shotHead - this.shotCount + i) % SHOTS + SHOTS) % SHOTS, o = idx * SSTRIDE;
      const t = this.shotRing[o]!;
      if (t < from || t > to) continue;
      shots.set(this.shotRing.subarray(o, o + SSTRIDE), m * SSTRIDE);
      m++;
    }
    // Shot A: beside the path a third of the way in; the mirror side or overhead when the belt is in the way
    const oa2 = Math.floor(k * 0.3) * STRIDE;
    const pa = new THREE.Vector3(frames[oa2 + 1]!, frames[oa2 + 2]!, frames[oa2 + 3]!);
    _q.set(frames[oa2 + 4]!, frames[oa2 + 5]!, frames[oa2 + 6]!, frames[oa2 + 7]!);
    const sideA = _side.set(-1, 0, 0).applyQuaternion(_q), fwdA = _fwd.set(0, 0, 1).applyQuaternion(_q);
    const oa3 = Math.floor(k * 0.45) * STRIDE;
    _b.set(frames[oa3 + 1]!, frames[oa3 + 2]!, frames[oa3 + 3]!);
    const camA = this.park(pa, fwdA, sideA, [[8, 24, 7], [8, -24, 7], [-6, 0, 30], [-6, 0, -26], [8, 36, 20], [8, -36, 20]], [pa, _b]);
    const kills = selected.map(event => {
      let frame = 0;
      for (let i = 1; i < k; i++) if (Math.abs(frames[i * STRIDE]! - event.t) < Math.abs(frames[frame * STRIDE]! - event.t)) frame = i;
      const o = frame * STRIDE;
      _q.set(frames[o + 4]!, frames[o + 5]!, frames[o + 6]!, frames[o + 7]!);
      const player = new THREE.Vector3(frames[o + 1]!, frames[o + 2]!, frames[o + 3]!);
      return { event, view: new THREE.Vector3(-1, .45, -.35).applyQuaternion(_q).normalize(),
        anchor: player.clone().lerp(event.pos, .5), radius: player.distanceTo(event.pos) * .5 };
    });
    this.highlight = { frames, count: k, bursts, kills, shots: shots.subarray(0, m * SSTRIDE), camA };
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
    this.fx.clear();
    this.tracers.clear();
    this.tracers.update();
    this.group.visible = true;
    return true;
  }

  stop(cam: THREE.PerspectiveCamera, enemies: Enemy[]): void {
    if (!this.clip) return;
    this.clip = null;
    this.tracers.clear();
    this.tracers.update();
    this.fx.clear();
    this.group.visible = false;
    for (const e of enemies) {
      e.rig.root.visible = e.alive;
      e.rig.root.position.copy(e.pos);
      e.rig.root.quaternion.copy(e.quat);
    }
    cam.fov = this.savedFov;
    cam.updateProjectionMatrix();
  }

  /** Drive ship, gliders and camera from the clip; call after the normal render pass. Returns false when the clip ends. */
  update(dt: number, cam: THREE.PerspectiveCamera, ship: THREE.Object3D, enemies: Enemy[]): boolean {
    const c = this.clip;
    if (!c) return false;
    const F = c.frames, n = c.count;
    const t1 = F[(n - 1) * STRIDE]!;
    // slow motion around the kill, normal speed elsewhere
    const rate = this.playbackRate;
    const previousTime = this.clipT;
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
    this.velocity.set(F[ob + 1]! - F[oa + 1]!, F[ob + 2]! - F[oa + 2]!, F[ob + 3]! - F[oa + 3]!).multiplyScalar(1 / Math.max(1e-6, tb - ta));
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
      e.rig.update(dt * rate, .65, false);
      if (b < 0) e.rig.root.position.set(F[a + 2]!, F[a + 3]!, F[a + 4]!), e.rig.root.quaternion.set(F[a + 5]!, F[a + 6]!, F[a + 7]!, F[a + 8]!);
      else pose(a + 2, b + 2, e.rig.root.position, e.rig.root.quaternion);
    }
    // the player's rounds, re-emitted into the visual pool at the clip's rate
    const S = c.shots;
    const ttl = T.weapons.range / T.weapons.muzzleSpeed;
    this.tracers.tick(this.clipT - previousTime);
    while (this.shotIdx * SSTRIDE < S.length && S[this.shotIdx * SSTRIDE]! <= this.clipT) {
      const o = this.shotIdx++ * SSTRIDE;
      const age = this.clipT - S[o]!;
      _v.set(S[o + 4]!, S[o + 5]!, S[o + 6]!);
      this.tracers.spawn("player", _a.set(S[o + 1]!, S[o + 2]!, S[o + 3]!).addScaledVector(_v, age), _v, Math.max(0, ttl - age));
      this.onShot?.(rate);
    }
    this.tracers.update();
    // Keep the parked approach shot, then frame both participants at every kill.
    // Fit both padded subjects against the horizontal and vertical frustum planes.
    _p.copy(ship.position);
    let beat = c.kills[0]!;
    for (let j = 1; j < c.kills.length; j++) {
      const next = c.kills[j]!;
      if (this.clipT <= beat.event.t + Math.min(T.replay.followDelay, (next.event.t - beat.event.t) * .5)) break;
      beat = next;
    }
    if (this.clipT < c.kills[0]!.event.t - 3.2) {
      cam.position.copy(c.camA);
      cam.fov = 66;
      _fwd.set(0, 0, 1).applyQuaternion(ship.quaternion);
      _look.copy(_p).addScaledVector(_fwd, 24);
    } else {
      cam.fov = 62;
      const event = beat.event, victim = enemies[event.victimId];
      const after = Math.max(0, this.clipT - event.t);
      if (this.clipT < event.t && victim?.rig.root.visible) _a.copy(victim.rig.root.position);
      else _a.copy(event.pos).addScaledVector(event.vel, after);
      const blend = Math.min(1, Math.max(0, (after - T.replay.followDelay) / Math.max(.1, T.replay.followBlend)));
      const follow = blend * blend * (3 - 2 * blend);
      _look.copy(_p).lerp(_a, .5 * (1 - follow));
      const padding = Math.max(T.replay.pairPadding, event.scale * 3);
      const halfVertical = THREE.MathUtils.degToRad(cam.fov * .5);
      const tanV = Math.tan(halfVertical), tanH = tanV * cam.aspect;
      const halfAngle = Math.min(halfVertical, Math.atan(tanH));
      // Park in world space. Translating the camera with the pair erased all
      // motion in a straight pursuit, even though the replay clock was running.
      cam.position.copy(beat.anchor).addScaledVector(beat.view, (beat.radius + padding) / Math.sin(halfAngle) * 1.08);
      _a.lerp(_p, follow);
      _offset.subVectors(cam.position, _look);
      const parkedDistance = _offset.length();
      _offset.normalize();
      const radius = Math.max(_p.distanceTo(_look), _a.distanceTo(_look)) + padding;
      cam.position.copy(_look).addScaledVector(_offset, Math.max(parkedDistance, radius / Math.sin(halfAngle)));

    }
    cam.up.copy(Y);
    cam.lookAt(_look);
    cam.updateProjectionMatrix();
    // Split the FX clock at recorded events, preserving exact burst age even on a slow render frame.
    let fxTime = previousTime;
    while (this.burstIdx < c.bursts.length && c.bursts[this.burstIdx]!.t <= this.clipT) {
      const b = c.bursts[this.burstIdx++]!;
      this.fx.update(Math.max(0, b.t - fxTime), cam.position);
      this.fx.spawn(b.pos, b.vel, b.scale, b.seed, b.kill ? "ship" : "rock");
      fxTime = Math.max(fxTime, b.t);
      this.onBurst?.(b.scale, rate);
    }
    this.fx.update(Math.max(0, this.clipT - fxTime), cam.position);
    return true;
  }
}
