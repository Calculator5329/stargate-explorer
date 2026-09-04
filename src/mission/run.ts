import * as THREE from "three";
import { Mission, fmt } from "@/mission/mission";
import type { MissionCtx } from "@/mission/mission";
import type { RunLevel } from "@/mission/levels";
import { glowMaterial } from "@/render/toon";
import { noEdge } from "@/render/layers";
import type { Tracked } from "@/combat/targets";
import { Mines } from "@/mission/mines";

interface Ring extends Tracked {
  mesh: THREE.Mesh;
  normal: THREE.Vector3;
}

const _rel = new THREE.Vector3();
const _prev = new THREE.Vector3();
const _hit = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _side = new THREE.Vector3();
const ZERO = new THREE.Vector3();

/**
 * "The gauntlet": a chain of glowing gates laid through the belt ahead of the
 * player. Fly through each in order before the clock runs out; the next gate is
 * amber, the rest are dim. Gliders join the chase at `harassAt`.
 */
export class RunMission extends Mission {
  /** public for headless tests (scripts/_*.mjs) */
  readonly rings: Ring[] = [];
  next = 0;
  private left: number;
  private readonly active: THREE.Material;
  private readonly idle: THREE.Material;
  private readonly passed: THREE.Material;
  private harassed = false;
  private pulse = 0;
  private readonly mines: Mines;

  constructor(override readonly def: RunLevel, ctx: MissionCtx) {
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

  /** Gates start ahead of the ship and wander sideways / up per gate, nudged off any rock. */
  private layRings(): void {
    const f = this.ctx.flight, d = this.def;
    const geo = new THREE.TorusGeometry(d.ringRadius, 1.6, 8, 28);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(f.quat);
    // the intro alone carries the ship ~600 m at cruise: the first gate must sit beyond that
    const p = f.pos.clone().addScaledVector(fwd, 750);
    const dir = fwd.clone();
    const side0 = new THREE.Vector3(-fwd.z, 0, fwd.x).normalize(), up0 = new THREE.Vector3().crossVectors(fwd, side0).normalize();
    const ph = Math.random() * 6.28, ph2 = Math.random() * 6.28;
    for (let i = 0; i < d.rings; i++) {
      // a slow S-curve around the original heading plus a little jitter: the chain stays broadly forward
      const w = d.wander / d.spacing;
      dir.copy(fwd).addScaledVector(side0, Math.sin(i * 0.55 + ph) * w + (Math.random() - 0.5) * w * 0.5).addScaledVector(up0, Math.sin(i * 0.4 + ph2) * w * 0.7 + (Math.random() - 0.5) * w * 0.4).normalize();
      _side.set(-dir.z, 0, dir.x).normalize();
      for (let tries = 0; tries < 10 && !this.clear(_hit.copy(p).addScaledVector(dir, d.spacing), 60 + d.ringRadius); tries++) {
        dir.add(_side.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.3)).normalize();
      }
      p.addScaledVector(dir, d.spacing);
      const mesh = noEdge(new THREE.Mesh(geo, i === 0 ? this.active : this.idle));
      mesh.position.copy(p);
      mesh.quaternion.copy(_q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir));
      this.group.add(mesh);
      this.rings.push({ mesh, pos: mesh.position, vel: ZERO, alive: true, radius: d.ringRadius, normal: dir.clone() });
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
    const a = _prev.dot(ring.normal), b = _rel.dot(ring.normal);
    if (a <= 0 && b > 0) {
      const t = a / (a - b);
      _hit.copy(_prev).lerp(_rel, t);
      if (_hit.lengthSq() < ring.radius * ring.radius) this.pass();
    }
    if (this.next < this.rings.length) this.line = `Gate ${this.next + 1} of ${d.rings}  ·  ${fmt(this.left)} left`;
    if (!this.harassed && d.harassAt > 0 && this.next >= d.harassAt) {
      this.harassed = true;
      this.spawnCone(d.harass, 500, 700, 1.2);
      this.ctx.audio.ui();
    }
  }

  private pass(): void {
    const ring = this.rings[this.next]!;
    ring.mesh.material = this.passed;
    ring.alive = false;
    this.next++;
    this.ctx.audio.lock();
    if (this.next >= this.rings.length) {
      this.win();
      return;
    }
    const n = this.rings[this.next]!;
    n.mesh.material = this.active;
    this.marker = n;
  }

  override render(dt: number): void {
    this.pulse += dt;
    this.mines.render(dt);
    const n = this.rings[this.next];
    if (n) n.mesh.scale.setScalar(1 + 0.06 * Math.sin(this.pulse * 5));
  }

  override summary(): string {
    return `time ${fmt(this.clock)}\nmargin ${fmt(Math.max(0, this.left))}\ngates ${this.rings.length}/${this.rings.length}\nkills ${this.ctx.combat.player.kills}`;
  }

  protected override deathLine(): string {
    return `Gate ${this.next + 1} of ${this.def.rings}. The belt took you.`;
  }
}
