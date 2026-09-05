import * as THREE from "three";
import { T, clamp } from "@/core/tunables";
import { Flight } from "@/sim/flight";
import { D } from "@/core/difficulty";
import { ENEMY_KINDS, type EnemyKind, type EnemyStats } from "@/combat/enemy-kinds";
import { ShipRig } from "@/ships/rig";
import type { ShipPalette } from "@/ships/defs";
import type { Projectiles } from "@/combat/projectiles";

export type EnemyState = "pursue" | "break" | "evade" | "saddle" | "flinch";

export interface Enemy {
  kind: EnemyKind;
  /** the kind's table in `T` */
  stats: EnemyStats;
  rig: ShipRig;
  alive: boolean;
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  prevPos: THREE.Vector3;
  prevQuat: THREE.Quaternion;
  vel: THREE.Vector3;
  speed: number;
  hp: number;
  state: EnemyState;
  /** seconds left in the current state */
  stateT: number;
  /** direction held during break/evade */
  hold: THREE.Vector3;
  fireCd: number;
  /** seconds until the glider may flinch out of the target's fire cone again */
  flinchCd: number;
  /** which flank the saddle point sits on (+1 target's port) */
  side: number;
  /** seconds since last damage, for the hit flash */
  sinceHit: number;
  /** body materials, for the hit flash */
  mats: THREE.MeshToonMaterial[];
  /** hit radius (Tracked) */
  radius: number;
  /** index into `Enemies.targets`, assigned round-robin at spawn */
  tgt: number;
}

export interface Target {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  alive: boolean;
  /** nose direction; absent for targets that cannot shoot back (escorts) */
  fwd?: THREE.Vector3;
}

export interface RockSpheres {
  count: number;
  centers: Float32Array;
  radii: Float32Array;
}

const UP = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _to = new THREE.Vector3();
const _lead = new THREE.Vector3();
const _want = new THREE.Vector3();
const _right = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _tmp = new THREE.Vector3();
const _tf = new THREE.Vector3();
const _tr = new THREE.Vector3();

/** Rotation with +Z along `dir` and +Y as near world-up as possible. */
function facing(dir: THREE.Vector3, out: THREE.Quaternion): THREE.Quaternion {
  _m.lookAt(dir, ZERO, Math.abs(dir.y) > 0.98 ? _tmp.set(0, 0, 1) : UP);
  return out.setFromRotationMatrix(_m);
}

/**
 * Enemy fighters: kinematic like the player (turn toward a wanted direction at
 * a capped rate, speed eases toward a target) with a three-state brain:
 * pursue (chase the lead point, fire when lined up) → break (peel off when too
 * close) → pursue; any hit → evade (jink sideways for a moment). Two dogfight
 * states (2026-09-04, Ethan: "it should feel more like a dogfight, not turn
 * around and go straight at each other"): a glider inside `saddleDist` that the
 * target is looking at does not accept the head-on pass, it goes to `saddle`
 * and steers for a point behind and beside the target until it is on the tail
 * or the clock runs out; and a glider sitting in the target's fire cone at
 * close range `flinch`es out of it before the shot comes, on a cooldown, rather
 * than only reacting after a hit. Rocks and the
 * arena edge push the wanted direction around. Poses are kept per tick so the
 * renderer interpolates them like the player's.
 */
export class Enemies {
  readonly group = new THREE.Group();
  readonly list: Enemy[] = [];
  /** what gliders go after; [0] is always the player, missions may append an escort (listed twice = two thirds of spawns) */
  readonly targets: Target[] = [];
  private spawned = 0;
  /** set by combat: crash dust at a rock scrape */
  onCrash: ((pos: THREE.Vector3, normal: THREE.Vector3, speed: number) => void) | null = null;

  /** `palette` recolours every hull spawned here (the system's faction); undefined keeps each def's own. */
  constructor(readonly rocks: RockSpheres, private readonly palette?: ShipPalette) {}

  get aliveCount(): number {
    let n = 0;
    for (const e of this.list) if (e.alive) n++;
    return n;
  }

  spawn(pos: THREE.Vector3, toward: THREE.Vector3, kind: EnemyKind = "glider"): Enemy {
    const K = ENEMY_KINDS[kind];
    let e = this.list.find((x) => !x.alive && x.kind === kind);
    if (!e) {
      const rig = new ShipRig(this.palette ? { ...K.def, palette: this.palette } : K.def);
      const mats: THREE.MeshToonMaterial[] = [];
      rig.root.traverse((o) => {
        if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial && o.name !== "canopy") mats.push(o.material);
      });
      e = {
        kind, stats: K.stats, rig, alive: false, pos: new THREE.Vector3(), quat: new THREE.Quaternion(), prevPos: new THREE.Vector3(), prevQuat: new THREE.Quaternion(),
        vel: new THREE.Vector3(), speed: 0, hp: 0, state: "pursue", stateT: 0, hold: new THREE.Vector3(0, 0, 1), fireCd: 0, flinchCd: 0, side: 1, sinceHit: 99, mats, radius: T.enemy.radius, tgt: 0,
      };
      this.list.push(e);
      this.group.add(rig.root);
    }
    const a = K.stats;
    e.alive = true;
    e.rig.root.visible = true;
    e.pos.copy(pos);
    _to.subVectors(toward, pos).normalize();
    facing(_to, e.quat);
    e.prevPos.copy(pos);
    e.prevQuat.copy(e.quat);
    e.speed = a.cruise * D.enemySpeed;
    e.vel.copy(_to).multiplyScalar(e.speed);
    e.hp = a.hp * D.enemyHp;
    e.state = "pursue";
    e.stateT = 0;
    e.fireCd = 1 + Math.random();
    e.flinchCd = 0;
    e.side = Math.random() < 0.5 ? 1 : -1;
    e.sinceHit = 99;
    e.radius = a.radius;
    e.tgt = this.spawned++;
    return e;
  }

  /** Called by combat when a round lands. Returns true if this hit destroyed it. */
  damage(e: Enemy, amount: number): boolean {
    e.hp -= amount;
    e.sinceHit = 0;
    if (e.state !== "evade" && Math.random() < 0.6) {
      e.state = "evade";
      e.stateT = 0.9 + Math.random() * 0.6;
      _right.set(-1, 0, 0).applyQuaternion(e.quat);
      _fwd.set(0, 0, 1).applyQuaternion(e.quat);
      e.hold.copy(_fwd).addScaledVector(_right, Math.random() < 0.5 ? 1.4 : -1.4).addScaledVector(UP, (Math.random() - 0.5) * 1.2).normalize();
    }
    if (e.hp > 0) return false;
    e.alive = false;
    e.rig.root.visible = false;
    return true;
  }

  tick(dt: number, player: Target, shots: Projectiles): void {
    const w = T.weapons;
    const n = this.targets.length;
    for (const e of this.list) {
      if (!e.alive) continue;
      const a = e.stats;
      let tgt = n ? this.targets[e.tgt % n]! : player;
      if (!tgt.alive) tgt = player;
      e.prevPos.copy(e.pos);
      e.prevQuat.copy(e.quat);
      e.sinceHit += dt;
      e.fireCd -= dt;
      e.flinchCd -= dt;
      e.stateT -= dt;
      _fwd.set(0, 0, 1).applyQuaternion(e.quat);
      _to.subVectors(tgt.pos, e.pos);
      const dist = _to.length();
      _to.multiplyScalar(1 / Math.max(1e-3, dist));

      // where the target's nose points; a target that cannot shoot is treated as looking along its velocity
      if (tgt.fwd) _tf.copy(tgt.fwd);
      else if (tgt.vel.lengthSq() > 1) _tf.copy(tgt.vel).normalize();
      else _tf.copy(_to).negate();
      // cos of the angle between the target's nose and the line from it to this glider
      const noseOn = -_tf.dot(_to);
      // brain
      if (e.state !== "pursue" && e.stateT <= 0) e.state = "pursue";
      if (a.dogfight > 0 && (e.state === "pursue" || e.state === "saddle") && tgt.alive && tgt.fwd && dist < a.flinchDist && noseOn > Math.cos(a.flinchCone) && e.flinchCd <= 0 && Math.random() < a.flinchChance) {
        // it is looking straight down our throat: get out of the cone before the shot, not after
        e.state = "flinch";
        e.stateT = a.flinchT;
        e.flinchCd = a.flinchCd + Math.random() * 0.8;
        _right.set(-1, 0, 0).applyQuaternion(e.quat);
        e.hold.copy(_fwd).addScaledVector(_right, Math.random() < 0.5 ? 1.2 : -1.2).addScaledVector(UP, Math.random() < 0.5 ? 1.0 : -1.0).normalize();
      }
      if (a.dogfight > 0 && e.state === "pursue" && tgt.alive && tgt.fwd && dist < a.saddleDist && dist > a.breakDist && noseOn > Math.cos(a.noseCone)) {
        // the target is facing us: refuse the joust, go for its tail
        e.state = "saddle";
        e.stateT = a.saddleMax;
        _tr.crossVectors(UP, _tf).normalize(); // target's port-ish side
        e.side = _tr.dot(_tmp.copy(e.pos).sub(tgt.pos)) >= 0 ? 1 : -1;
      }
      if (e.state === "saddle") {
        // on its tail (the target's nose points away from us and we sit behind it), or drifted out of range: back to pursuit
        if (!tgt.alive || _tf.dot(_to) > 0.5 || dist > a.saddleDist * 1.5) e.state = "pursue";
        else if (dist < a.breakDist * 0.6) (e.state = "break"), (e.stateT = 1.0 + Math.random() * 0.6), e.hold.copy(_fwd).addScaledVector(_right.set(-1, 0, 0).applyQuaternion(e.quat), e.side).normalize();
      }
      if (e.state === "pursue" && dist < a.breakDist && tgt.alive) {
        e.state = "break";
        e.stateT = 1.6 + Math.random() * 1.2;
        _right.set(-1, 0, 0).applyQuaternion(e.quat);
        e.hold.copy(_fwd).addScaledVector(_right, Math.random() < 0.5 ? 1.0 : -1.0).addScaledVector(UP, (Math.random() - 0.5) * 0.8).normalize();
      }
      let targetSpeed = a.cruise;
      if (e.state === "pursue" && tgt.alive) {
        // lead the target by the round's flight time
        const tof = dist / w.enemyMuzzleSpeed;
        _lead.copy(tgt.pos).addScaledVector(tgt.vel, tof).sub(e.pos).normalize();
        _want.copy(_lead);
        targetSpeed = dist > 400 ? a.dash : a.cruise;
        if (dist < w.range * 0.6 && _fwd.dot(_lead) > Math.cos(a.fireCone) && e.fireCd <= 0) {
          e.fireCd = 1 / (w.enemyFireRate * a.fireRate * D.enemyFireRate);
          _tmp.copy(_lead).addScaledVector(_right.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5), w.enemySpread * a.spread * D.enemySpread * 2).normalize();
          shots.fire("enemy", _lead.copy(e.pos).addScaledVector(_fwd, a.radius), _tmp, e.vel, a.damage);
        }
      } else if (e.state === "saddle") {
        // aim for a point behind and beside the target, on the flank we are already on
        _tr.crossVectors(UP, _tf).normalize();
        _want.copy(tgt.pos).addScaledVector(_tf, -a.saddleBehind).addScaledVector(_tr, e.side * a.saddleSide).sub(e.pos).normalize();
        targetSpeed = a.cruise; // at cruise a turning player can still bring guns round on it
      } else {
        _want.copy(e.hold);
        targetSpeed = a.dash;
      }
      if (!tgt.alive) _want.copy(_fwd);

      // rocks ahead push the wanted direction away; the arena edge pulls it home
      const R = this.rocks;
      for (let i = 0; i < R.count; i++) {
        const cx = R.centers[i * 3]! - e.pos.x, cy = R.centers[i * 3 + 1]! - e.pos.y, cz = R.centers[i * 3 + 2]! - e.pos.z;
        const reach = R.radii[i]! + a.avoidDist;
        const d2 = cx * cx + cy * cy + cz * cz;
        if (d2 > reach * reach) continue;
        const d = Math.sqrt(d2);
        if (cx * _fwd.x + cy * _fwd.y + cz * _fwd.z < -R.radii[i]!) continue; // behind
        const k = (1 - d / reach) * 3;
        _want.addScaledVector(_tmp.set(-cx / d, -cy / d, -cz / d), k);
      }
      const out = e.pos.length() - T.arena.radius * 0.85;
      if (out > 0) _want.addScaledVector(_tmp.copy(e.pos).normalize(), -clamp(out / 200, 0, 1) * 3);
      _want.normalize();

      // steer and move
      facing(_want, _q);
      e.quat.rotateTowards(_q, a.turnRate * dt);
      // bank into the turn: roll about local Z by how far the wanted direction sits off the nose sideways
      _right.set(-1, 0, 0).applyQuaternion(e.quat);
      const side = _want.dot(_right);
      e.quat.multiply(_q.setFromAxisAngle(_tmp.set(0, 0, 1), side * a.bank * dt));
      targetSpeed *= D.enemySpeed;
      e.speed += clamp(targetSpeed - e.speed, -a.accel * dt, a.accel * dt);
      _fwd.set(0, 0, 1).applyQuaternion(e.quat);
      e.vel.lerp(_tmp.copy(_fwd).multiplyScalar(e.speed), 1 - Math.exp(-6 * dt));
      e.pos.addScaledVector(e.vel, dt);
      this.rockHit(e);
    }
  }

  /** Gliders that flew into a rock this tick; the combat layer drains this for the explosion. */
  readonly crashed: Enemy[] = [];

  /** Sphere test against the belt: bounce, and take the same impact damage the player does. */
  private rockHit(e: Enemy): void {
    const R = this.rocks;
    for (let i = 0; i < R.count; i++) {
      const r = R.radii[i]! * 0.8 + e.radius;
      const dx = e.pos.x - R.centers[i * 3]!, dy = e.pos.y - R.centers[i * 3 + 1]!, dz = e.pos.z - R.centers[i * 3 + 2]!;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= r * r) continue;
      const d = Math.sqrt(d2) || 1;
      _tmp.set(dx / d, dy / d, dz / d);
      const into = -e.vel.dot(_tmp);
      e.pos.addScaledVector(_tmp, r - d + 0.1);
      if (into > 5 && this.onCrash) this.onCrash(_lead.copy(e.pos).addScaledVector(_tmp, -e.radius), _tmp, into);
      if (into > 0) e.vel.addScaledVector(_tmp, 2 * into).multiplyScalar(0.5);
      e.speed *= 0.5;
      const dmg = Flight.impactDamage(into) * e.stats.hp * D.enemyHp;
      if (dmg > 0 && this.damage(e, dmg)) this.crashed.push(e);
      return;
    }
  }

  /** Interpolate poses into the rigs; drive plumes and the hit flash. */
  render(alpha: number, dt: number): void {
    for (const e of this.list) {
      if (!e.alive) continue;
      e.rig.root.position.lerpVectors(e.prevPos, e.pos, alpha);
      e.rig.root.quaternion.slerpQuaternions(e.prevQuat, e.quat, alpha);
      e.rig.update(dt, e.speed / e.stats.dash, e.state !== "pursue");
      const flash = e.sinceHit < 0.09 ? 1 : 0;
      for (const m of e.mats) {
        if (m.emissiveIntensity === flash) continue;
        m.emissive.setScalar(1);
        m.emissiveIntensity = flash;
      }
    }
  }
}
