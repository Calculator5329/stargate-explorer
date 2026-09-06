import * as THREE from "three";
import { Mission, fmt } from "@/mission/mission";
import type { MissionCtx } from "@/mission/mission";
import type { RunLevel, RaceLevel, HuntLevel } from "@/mission/levels";
import { glowMaterial } from "@/render/toon";
import { noEdge } from "@/render/layers";
import type { Tracked } from "@/combat/targets";
import { Mines } from "@/mission/mines";

interface Ring extends Tracked {
  mesh: THREE.Group;
  parts: THREE.Mesh[];
  normal: THREE.Vector3;
}

const _rel = new THREE.Vector3();
const _prev = new THREE.Vector3();
const _hit = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _side = new THREE.Vector3();
const _cand = new THREE.Vector3();
const _best = new THREE.Vector3();
const ZERO = new THREE.Vector3();
/** candidate headings tried per gate, and the rock-density radius that makes a gate "in the rock" */
const CANDIDATES = 14;
const POCKET = 240;

/**
 * "The gauntlet": a chain of glowing gates laid through the belt ahead of the
 * player, each one dropped into the densest rock pocket it can find so the run
 * is an obstacle course rather than a slalom. Fly through each in order, from
 * either side, before the clock runs out; the next gate is amber, the rest are
 * dim. Gliders join the chase at `harassAt`.
 */
export class RunMission extends Mission {
  /** public for headless tests (scripts/_*.mjs) */
  readonly rings: Ring[] = [];
  next = 0;
  private left: number;
  protected readonly active: THREE.Material;
  private readonly idle: THREE.Material;
  protected readonly passed: THREE.Material;
  private harassed = false;
  private pulse = 0;
  protected readonly mines: Mines;

  constructor(override readonly def: RunLevel | RaceLevel | HuntLevel, ctx: MissionCtx) {
    super(def, ctx);
    this.left = def.timeLimit;
    this.winTitle = "WINDOW MADE";
    this.active = glowMaterial(0xffc25a, 2.6);
    this.idle = glowMaterial(0x6a86a8, 1.1);
    this.passed = glowMaterial(0x4a6a4a, 0.6);
    this.mines = new Mines(ctx);
    this.group.add(this.mines.group);
    this.layRings();
    this.marker = this.rings[0]!;
  }

  /** Rocks within `POCKET` of `p`, none of them closer than the hoop itself needs (-1 if one is). */
  private pocket(p: THREE.Vector3, keep: number): number {
    const R = this.ctx.rocks;
    let n = 0;
    for (let i = 0; i < R.count; i++) {
      const dx = p.x - R.centers[i * 3]!, dy = p.y - R.centers[i * 3 + 1]!, dz = p.z - R.centers[i * 3 + 2]!;
      const d2 = dx * dx + dy * dy + dz * dz, r = R.radii[i]!;
      if (d2 < (r + keep) * (r + keep)) return -1;
      if (d2 < (r + POCKET) * (r + POCKET)) n += 1 + Math.min(3, r / 12); // big rocks count for more: they are what you weave around
    }
    return n;
  }

  /**
   * Gates start ahead of the ship. Each next gate is the best of `CANDIDATES`
   * headings fanned around the current one (up to `wander` sideways per
   * `spacing`): the one sitting in the most rock while still leaving the hoop
   * clear. The chain steers back toward the arena centre as it nears the edge.
   */
  private layRings(): void {
    const f = this.ctx.flight, d = this.def;
    const geo = new THREE.TorusGeometry(d.ringRadius, 1.6, 8, 28);
    const bar = new THREE.BoxGeometry(2.6, 9, 2.6);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(f.quat);
    // the intro alone carries the ship ~600 m at cruise: the first gate must sit beyond that
    const p = f.pos.clone().addScaledVector(fwd, 750 - d.spacing); // the loop steps `spacing` before placing the first gate
    const dir = fwd.clone();
    const turn = Math.atan(d.wander / d.spacing);
    const keep = d.ringRadius + 22;
    for (let i = 0; i < d.rings; i++) {
      // steer home when the chain nears the edge, so the course loops through the belt instead of leaving it
      if (p.length() > 900) dir.addScaledVector(_side.copy(p).normalize(), -1.2).normalize();
      let bestScore = -Infinity;
      _best.copy(p).addScaledVector(dir, d.spacing);
      for (let k = 0; k < CANDIDATES; k++) {
        _q.setFromAxisAngle(_side.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), (Math.random() * 2 - 1) * turn);
        _hit.copy(dir).applyQuaternion(_q).normalize();
        _cand.copy(p).addScaledVector(_hit, d.spacing);
        if (_cand.length() > 1350) continue;
        const score = this.pocket(_cand, keep);
        if (score > bestScore) (bestScore = score), _best.copy(_cand);
      }
      if (bestScore === -Infinity) _best.copy(p).addScaledVector(_side.copy(p).multiplyScalar(-1).normalize(), d.spacing); // every candidate left the arena: head for the centre
      if (bestScore < 0) for (let tries = 0; tries < 12 && !this.clear(_best, keep); tries++) _best.add(_side.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(80));
      dir.subVectors(_best, p).normalize();
      p.copy(_best);
      const mat = i === 0 ? this.active : this.idle;
      const mesh = new THREE.Group();
      const parts: THREE.Mesh[] = [noEdge(new THREE.Mesh(geo, mat))];
      // four short pylons on the rim give the hoop a frame you can read edge-on
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        const b = noEdge(new THREE.Mesh(bar, mat));
        b.position.set(Math.cos(a) * (d.ringRadius + 3), Math.sin(a) * (d.ringRadius + 3), 0);
        b.rotation.z = a - Math.PI / 2;
        parts.push(b);
      }
      mesh.add(...parts);
      mesh.position.copy(p);
      mesh.quaternion.copy(_q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir));
      this.group.add(mesh);
      this.rings.push({ mesh, parts, pos: mesh.position, vel: ZERO, alive: true, radius: d.ringRadius, normal: dir.clone() });
      // mines just outside the rim, in the gate plane
      for (let k = 0; k < d.minesPerGate; k++) {
        const a = Math.random() * Math.PI * 2, rr = d.ringRadius + 16 + Math.random() * 12;
        _hit.set(Math.cos(a) * rr, Math.sin(a) * rr, 0).applyQuaternion(mesh.quaternion).add(p);
        this.mines.add(_hit);
      }
    }
    // fail-safe: gates that drift past the arena edge are pulled back inside
    const R = 1400;
    for (const r of this.rings) if (r.pos.length() > R) r.pos.multiplyScalar(R / r.pos.length());
  }

  protected begin(): void {
    this.phase = "run";
    this.marker = this.rings[0]!;
    this.ctx.audio.ui();
  }

  protected run(dt: number): void {
    const f = this.ctx.flight, d = this.def;
    this.mines.tick();
    this.left -= dt;
    if (this.left <= 0) {
      this.fail("The window closed with you still in the belt.", "WINDOW MISSED");
      return;
    }
    const ring = this.rings[this.next]!;
    // crossing test: the ship's segment this tick crosses the gate plane inside the hoop
    _prev.copy(f.prevPos).sub(ring.pos);
    _rel.copy(f.pos).sub(ring.pos);
    // either way through counts: any crossing of the gate plane inside the hoop
    const a = _prev.dot(ring.normal), b = _rel.dot(ring.normal);
    if ((a <= 0 && b > 0) || (a >= 0 && b < 0)) {
      const t = a / (a - b);
      _hit.copy(_prev).lerp(_rel, t);
      if (_hit.lengthSq() < ring.radius * ring.radius) this.pass();
    }
    if (this.next < this.rings.length) this.line = `Gate ${this.next + 1} of ${d.rings}  ·  ${fmt(this.left)} left`;
    if (!this.harassed && d.harassAt > 0 && this.next >= d.harassAt) {
      this.harassed = true;
      this.spawnCone(d.harass, 500, 700, 1.2, d.harassKinds);
      this.ctx.audio.ui();
    }
  }

  private pass(): void {
    const ring = this.rings[this.next]!;
    for (const m of ring.parts) m.material = this.passed;
    ring.alive = false;
    this.next++;
    this.ctx.audio.ring();
    if (this.next >= this.rings.length) {
      this.win();
      return;
    }
    const n = this.rings[this.next]!;
    for (const m of n.parts) m.material = this.active;
    this.marker = n;
  }

  override render(dt: number, _alpha = 1): void {
    this.pulse += dt;
    this.mines.render(dt);
    const n = this.rings[this.next];
    if (n) n.mesh.scale.setScalar(1 + 0.06 * Math.sin(this.pulse * 5));
  }

  override summary(): string {
    return `time ${fmt(this.clock)}\nmargin ${fmt(Math.max(0, this.left))}\ngates ${this.rings.length}/${this.rings.length}\nkills ${this.ctx.combat.player.kills}${this.rocksLine()}`;
  }

  protected override deathLine(): string {
    return `Gate ${this.next + 1} of ${this.def.rings}. The belt took you.`;
  }
}
