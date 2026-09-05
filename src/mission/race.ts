import * as THREE from "three";
import { RunMission } from "@/mission/run";
import { fmt } from "@/mission/mission";
import type { MissionCtx } from "@/mission/mission";
import type { RaceLevel } from "@/mission/levels";
import { ShipRig } from "@/ships/rig";
import { RACER } from "@/ships/racer-def";
import { T } from "@/core/tunables";

interface Racer {
  name: string;
  rig: ShipRig;
  pos: THREE.Vector3;
  prevPos: THREE.Vector3;
  quat: THREE.Quaternion;
  prevQuat: THREE.Quaternion;
  vel: THREE.Vector3;
  speed: number;
  /** ring index it is flying for */
  next: number;
  /** personal lane inside the hoop, in the gate plane */
  lane: THREE.Vector3;
  /** speed multiplier, fixed per racer */
  skill: number;
  /** 0 = still racing, else finishing order */
  place: number;
  /** grid slot during the intro (ship-local x) */
  slot: number;
}

const NAMES = ["SKAARA", "TOBAY", "NABEH", "SHA'URI", "KASUF"];
const UP = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Vector3();
const _want = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _to = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _tmp = new THREE.Vector3();
const _prev = new THREE.Vector3();
const _rel = new THREE.Vector3();
const _hit = new THREE.Vector3();

function facing(dir: THREE.Vector3, out: THREE.Quaternion): THREE.Quaternion {
  _m.lookAt(dir, ZERO, Math.abs(dir.y) > 0.98 ? _tmp.set(0, 0, 1) : UP);
  return out.setFromRotationMatrix(_m);
}

function ordinal(n: number): string {
  return `${n}${n === 1 ? "ST" : n === 2 ? "ND" : n === 3 ? "RD" : "TH"}`;
}

/**
 * "The ring race": the gauntlet's gate chain with rivals in it. `racers` AI
 * craft line up beside the player during the intro, then fly the same gates
 * (their own lane inside each hoop, rock avoidance like the gliders'). Each has
 * a fixed skill and a rubber band: behind the player it presses, two gates
 * ahead it eases. Any finish completes the mission; the card says where you
 * placed and the clock is the best-time record, so the race is replayable
 * for position rather than pass/fail.
 */
export class RaceMission extends RunMission {
  /** public for headless tests */
  readonly racers: Racer[] = [];
  private finished = 0;
  private playerPlace = 0;

  constructor(override readonly def: RaceLevel, ctx: MissionCtx) {
    super(def, ctx);
    this.winTitle = "ACROSS THE LINE";
    for (let i = 0; i < def.racers; i++) {
      const rig = new ShipRig(RACER);
      const lane = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, 0).normalize().multiplyScalar(def.ringRadius * (0.25 + Math.random() * 0.4));
      const slot = (i + 1) * (i % 2 ? 1 : -1) * 22; // 22 m apart, alternating sides, none dead ahead
      this.racers.push({
        name: NAMES[i % NAMES.length]!, rig, pos: new THREE.Vector3(), prevPos: new THREE.Vector3(), quat: new THREE.Quaternion(), prevQuat: new THREE.Quaternion(),
        vel: new THREE.Vector3(), speed: 0, next: 0, lane, skill: 1 + (Math.random() * 2 - 1) * def.racerVar, place: 0, slot,
      });
      this.group.add(rig.root);
    }
    this.grid();
  }

  /** Intro: hold the grid beside the player, nose along the player's. */
  private grid(): void {
    const f = this.ctx.flight;
    for (const r of this.racers) {
      _tmp.set(r.slot, -2, 6).applyQuaternion(f.quat);
      r.pos.copy(f.pos).add(_tmp);
      r.prevPos.copy(r.pos);
      r.quat.copy(f.quat);
      r.prevQuat.copy(r.quat);
      r.speed = f.speed;
      r.vel.copy(f.velDir).multiplyScalar(f.speed);
    }
  }

  override tick(dt: number): void {
    if (this.phase === "intro") this.grid();
    super.tick(dt);
  }

  protected override run(dt: number): void {
    const before = this.next;
    super.run(dt);
    if (this.done) return;
    if (this.next > before && this.next >= this.rings.length) return; // super already won (cannot happen: we win below)
    this.steer(dt);
    // the HUD line: place, gate
    const place = this.currentPlace();
    this.line = `P${place} of ${this.racers.length + 1}  ·  Gate ${this.next + 1} of ${this.def.rings}  ·  ${fmt(this.clock)}`;
  }

  /** The player's live position: racers ahead by gates, or by distance to the same gate, rank higher. */
  private currentPlace(): number {
    const f = this.ctx.flight;
    const ring = this.rings[Math.min(this.next, this.rings.length - 1)]!;
    const myD = f.pos.distanceToSquared(ring.pos);
    let ahead = 0;
    for (const r of this.racers) {
      if (r.place > 0) ahead++;
      else if (r.next > this.next) ahead++;
      else if (r.next === this.next && r.pos.distanceToSquared(this.rings[r.next]!.pos) < myD) ahead++;
    }
    return ahead + 1;
  }

  private steer(dt: number): void {
    const d = this.def, n = this.rings.length;
    for (const r of this.racers) {
      r.prevPos.copy(r.pos);
      r.prevQuat.copy(r.quat);
      _fwd.set(0, 0, 1).applyQuaternion(r.quat);
      if (r.place > 0) {
        // finished: fly on straight, easing off
        r.speed += (d.racerSpeed * 0.6 - r.speed) * Math.min(1, dt * 0.8);
      } else {
        const ring = this.rings[r.next]!;
        _tmp.copy(r.lane).applyQuaternion(ring.mesh.quaternion);
        _want.copy(ring.pos).add(_tmp).sub(r.pos);
        const dist = _want.length();
        _want.multiplyScalar(1 / Math.max(1e-3, dist));
        // rubber band against the player's gate count
        const gap = r.next - this.next;
        let target = d.racerSpeed * r.skill * (gap < 0 ? 1.12 : gap >= 2 ? 0.9 : 1);
        if (dist < 140) target *= 0.92; // settle into the hoop
        this.avoid(r.pos, _fwd, _want);
        r.speed += Math.max(-d.racerAccel * dt, Math.min(d.racerAccel * dt, target - r.speed));
      }
      facing(_want.lengthSq() > 0.5 ? _want : _fwd, _q);
      r.quat.rotateTowards(_q, d.racerTurn * dt);
      // bank into the turn
      _to.set(-1, 0, 0).applyQuaternion(r.quat);
      r.quat.multiply(_q.setFromAxisAngle(_tmp.set(0, 0, 1), _want.dot(_to) * 2.2 * dt));
      _fwd.set(0, 0, 1).applyQuaternion(r.quat);
      r.vel.lerp(_tmp.copy(_fwd).multiplyScalar(r.speed), 1 - Math.exp(-7 * dt));
      r.pos.addScaledVector(r.vel, dt);
      if (r.place > 0) continue;
      // gate crossing, either way through
      const ring = this.rings[r.next]!;
      _prev.copy(r.prevPos).sub(ring.pos);
      _rel.copy(r.pos).sub(ring.pos);
      const a = _prev.dot(ring.normal), b = _rel.dot(ring.normal);
      if ((a <= 0 && b > 0) || (a >= 0 && b < 0)) {
        const t = a / (a - b);
        _hit.copy(_prev).lerp(_rel, t);
        if (_hit.lengthSq() < ring.radius * ring.radius * 1.1) {
          r.next++;
          if (r.next >= n) r.place = ++this.finished;
        }
      }
    }
  }

  /** Rocks ahead push the wanted direction away (same shape as the glider brain). */
  private avoid(pos: THREE.Vector3, fwd: THREE.Vector3, want: THREE.Vector3): void {
    const R = this.ctx.rocks, reachPad = T.enemy.avoidDist;
    for (let i = 0; i < R.count; i++) {
      const cx = R.centers[i * 3]! - pos.x, cy = R.centers[i * 3 + 1]! - pos.y, cz = R.centers[i * 3 + 2]! - pos.z;
      const reach = R.radii[i]! + reachPad;
      const d2 = cx * cx + cy * cy + cz * cz;
      if (d2 > reach * reach) continue;
      const dd = Math.sqrt(d2);
      if (cx * fwd.x + cy * fwd.y + cz * fwd.z < -R.radii[i]!) continue;
      want.addScaledVector(_tmp.set(-cx / dd, -cy / dd, -cz / dd), (1 - dd / reach) * 3);
    }
    want.normalize();
  }

  /** The player crossed the last gate: place, then complete. */
  protected override win(): void {
    this.playerPlace = this.finished + 1;
    this.winTitle = `${ordinal(this.playerPlace)} ACROSS THE LINE`;
    super.win();
  }

  override render(dt: number, alpha = 1): void {
    super.render(dt);
    for (const r of this.racers) {
      r.rig.root.position.lerpVectors(r.prevPos, r.pos, alpha);
      r.rig.root.quaternion.slerpQuaternions(r.prevQuat, r.quat, alpha);
      r.rig.update(dt, Math.min(1, r.speed / this.def.racerSpeed), r.speed > this.def.racerSpeed * 1.05);
    }
  }

  override summary(): string {
    const order = [...this.racers].sort((a, b) => (a.place || 99) - (b.place || 99));
    const ahead = order.filter((r) => r.place > 0 && r.place < this.playerPlace).map((r) => r.name);
    return `place ${ordinal(this.playerPlace)} of ${this.racers.length + 1}\ntime ${fmt(this.clock)}\n${ahead.length ? `beaten by ${ahead.join(", ")}` : "clean sweep"}\ngates ${this.rings.length}/${this.rings.length}${this.rocksLine()}`;
  }

  protected override deathLine(): string {
    return `Gate ${this.next + 1} of ${this.def.rings}, running P${this.currentPlace()}. The belt took you.`;
  }
}
