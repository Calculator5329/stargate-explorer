import { Quaternion, Vector3 } from "three";
import { T, clamp, lerp, moveToward } from "@/core/tunables";
import type { Input } from "@/core/input";
import type { ShipStats } from "@/ships/registry";

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
/** Ship right is −X: right-handed frame, right = forward × up = Z × Y. */
const RIGHT = new Vector3(-1, 0, 0);
const _q = new Quaternion();
const _fwd = new Vector3();
const _right = new Vector3();
const _n = new Vector3();
const _lat = new Vector3();

/**
 * Kinematic arcade-sim flight with momentum. The nose (+Z) is steered by the
 * stick; the velocity `vel` is a real vector: its forward component chases the
 * target speed at `accel` (or coasts down at `coastDecel`), its lateral
 * component decays at `latDamp`, so a hard turn slides and a released boost
 * carries. Flight assist off (X) drops the damping to `latDampOff` and speed
 * changes only by thrust (Shift) and retro (Space). `speed`/`velDir` are
 * derived from `vel` every tick for consumers. Drift (classic Space) freezes
 * `vel`; collisions reflect it. Roll is
 * manual (A/D) plus bank-into-turn and a soft-horizon auto-level; a double-tap
 * on A/D fires a fast 360° barrel roll with a sideways hop.
 *
 * Two control schemes share this model (`input.scheme`, see core/scheme.ts):
 * classic drives speed from a W/S throttle; arcade holds `cruiseSpeed`, W/S are
 * a hard pull-up / dive on top of the mouse, and Space is a brake.
 * Keeps the previous tick's pose so render can interpolate via `sample()`.
 */
export class Flight {
  readonly pos = new Vector3();
  readonly quat = new Quaternion();
  readonly prevPos = new Vector3();
  readonly prevQuat = new Quaternion();
  readonly velDir = new Vector3(0, 0, 1);
  readonly vel = new Vector3(0, 0, T.flight.minSpeed);
  speed = T.flight.minSpeed;
  /** normal impact speed of the last rock hit (m/s) and its surface normal; consumers read and clear the speed */
  lastImpact = 0;
  readonly lastImpactNormal = new Vector3(0, 1, 0);
  throttle = 0.5;
  boosting = false;
  /** 0..1, drains while boosting; boost cannot re-engage below `boostMinEngage` (Ethan: "not overpowered") */
  boostEnergy = 1;
  drifting = false;
  braking = false;
  /** remaining barrel-roll angle (signed, rad); 0 when not rolling */
  barrelLeft = 0;
  /** seconds since the last collision, for camera shake / HUD flash */
  sinceHit = 99;
  /** set by combat when the hull fails: controls go dead, the ship tumbles on its last velocity */
  dead = false;
  /** per-hull multipliers on the shared T.flight numbers (ships/registry.ts) */
  stats: ShipStats = { speed: 1, agility: 1, hull: 1, guns: 1, missiles: 6, size: 1 };

  /** top speed this hull can hold (boost) */
  get topSpeed(): number {
    return T.flight.boostSpeed * this.stats.speed;
  }

  tick(dt: number, input: Input): void {
    this.prevPos.copy(this.pos);
    this.prevQuat.copy(this.quat);
    const f = T.flight;
    this.sinceHit += dt;
    if (this.dead) {
      this.quat.multiply(_q.setFromAxisAngle(_n.set(0.6, 0.3, 1).normalize(), 2.2 * dt)).normalize();
      this.vel.multiplyScalar(Math.exp(-0.5 * dt));
      this.speed = this.vel.length();
      this.pos.addScaledVector(this.vel, dt);
      this.boosting = false;
      return;
    }

    const arcade = input.scheme.arcade;
    if (!arcade) this.throttle = clamp(this.throttle + input.pitchKey * f.throttleRate * dt, 0, 1);
    const canBoost = this.boostEnergy > 0 && (this.boosting || this.boostEnergy >= f.boostMinEngage);
    this.boosting = input.boost && canBoost;
    this.boostEnergy = clamp(this.boostEnergy + (this.boosting ? -f.boostDrain : f.boostRecharge) * dt, 0, 1);
    this.drifting = !arcade && input.space;
    this.braking = arcade && input.space && !this.boosting;
    const S = this.stats;
    let targetSpeed = lerp(f.minSpeed, f.maxSpeed, this.throttle);
    let rate = this.drifting ? f.driftDecel : f.accel;
    if (arcade) (targetSpeed = this.braking ? f.brakeSpeed : f.cruiseSpeed), (rate = this.braking ? f.brakeDecel : f.accel);
    if (this.boosting) (targetSpeed = f.boostSpeed), (rate = f.boostAccel);
    targetSpeed *= S.speed;
    rate *= S.speed;
    const snap = arcade ? input.pitchKey * f.snapPitchRate * S.agility : 0;

    if (input.barrel !== 0 && this.barrelLeft === 0) this.barrelLeft = input.barrel * Math.PI * 2;

    _right.copy(RIGHT).applyQuaternion(this.quat);
    _fwd.copy(Z).applyQuaternion(this.quat);
    // Soft horizon: steer right.y toward the bank the turn asks for (right stick =
    // right wing down). Off near vertical (no horizon), while rolling by hand, and mid-barrel.
    const nearVertical = Math.abs(_fwd.y) > 0.95;
    const targetBank = clamp(-input.stick.x * f.bankIntoTurn, -1, 1);
    const assistK = input.scheme.assistStrength;
    const levelRoll = nearVertical || input.roll !== 0 || this.barrelLeft !== 0 ? 0 : (_right.y - targetBank) * f.autoLevel * assistK;

    // Rotations below are about local axes; signs follow from +X being port:
    //   +X rotation drops the nose, +Y rotation yaws the nose to port, +Z rotation rolls right.
    const pitch = -(input.stick.y * f.pitchRate * S.agility + snap) * dt;
    const yaw = -input.stick.x * f.yawRate * S.agility * dt;
    let roll = (input.roll * f.rollRate * S.agility + levelRoll) * dt;
    if (this.barrelLeft !== 0) {
      const step = clamp(this.barrelLeft, -f.barrelRate * dt, f.barrelRate * dt);
      this.barrelLeft -= step;
      if (Math.abs(this.barrelLeft) < 1e-4) this.barrelLeft = 0;
      roll += step;
      // sideways hop in the roll direction, strongest mid-roll
      this.pos.addScaledVector(_right, Math.sign(step) * f.barrelHop * Math.sin(Math.abs(this.barrelLeft) / 2) * dt);
    }
    this.quat.multiply(_q.setFromAxisAngle(X, pitch));
    this.quat.multiply(_q.setFromAxisAngle(Y, yaw));
    this.quat.multiply(_q.setFromAxisAngle(Z, roll));
    this.quat.normalize();

    _fwd.copy(Z).applyQuaternion(this.quat);
    if (!this.drifting) {
      const assist = input.scheme.assist;
      // split velocity into along-nose and lateral parts
      let vf = this.vel.dot(_fwd);
      _lat.copy(this.vel).addScaledVector(_fwd, -vf);
      if (assist) {
        // coasting down (boost released, brake off) is slower than accelerating: momentum
        const decel = vf > targetSpeed && !this.braking && !this.drifting ? f.coastDecel : rate;
        vf = moveToward(vf, targetSpeed, (vf > targetSpeed ? decel : rate) * dt);
        // a hard pull leaves the velocity behind for a moment, so the ship visibly slides through the turn
        _lat.multiplyScalar(Math.exp(-f.latDamp * assistK * (snap !== 0 ? f.snapSlide : 1) * dt));
      } else {
        // drift mode: the nose is free, velocity only changes by thrust
        if (input.boost && this.boostEnergy > 0) vf += f.thrust * 2 * dt;
        else if (input.space) vf = moveToward(vf, 0, f.thrust * dt), _lat.multiplyScalar(Math.exp(-f.thrust * 0.02 * dt));
        else if (!arcade) vf += input.pitchKey * f.thrust * dt;
        vf = clamp(vf, -f.maxSpeed * 0.5, this.topSpeed);
        _lat.multiplyScalar(Math.exp(-f.latDampOff * dt));
      }
      this.vel.copy(_fwd).multiplyScalar(vf).add(_lat);
      const total = this.vel.length();
      if (total > this.topSpeed) this.vel.multiplyScalar(this.topSpeed / total);
    }
    this.speed = this.vel.length();
    if (this.speed > 1e-3) this.velDir.copy(this.vel).divideScalar(this.speed);
    this.pos.addScaledVector(this.vel, dt);
  }

  /** Bounce off a surface with outward normal `n`: reflect velocity, bleed speed, nose follows. */
  bounce(n: Vector3): void {
    _n.copy(n);
    const into = -this.vel.dot(_n); // normal impact speed, positive when moving into the face
    if (into >= this.lastImpact) this.lastImpactNormal.copy(_n);
    this.lastImpact = Math.max(this.lastImpact, into);
    if (into > 0) this.vel.addScaledVector(_n, 2 * into);
    const speed = this.vel.length();
    const keep = Math.max(T.flight.minSpeed * 0.6, speed * T.flight.bounceKeep);
    if (speed > 1e-3) this.vel.multiplyScalar(keep / speed);
    this.speed = keep;
    this.velDir.copy(this.vel).normalize();
    this.sinceHit = 0;
  }

  /** Damage fraction (0..1) for a rock impact at `into` m/s normal speed; 1 = certain death. */
  static impactDamage(into: number): number {
    const f = T.flight;
    const x = clamp((into - f.grazeSpeed) / (f.killSpeed - f.grazeSpeed), 0, 1);
    return x * x;
  }

  /** Interpolated pose for rendering. Render code must use this, never pos/quat. */
  sample(alpha: number, outPos: Vector3, outQuat: Quaternion): void {
    outPos.lerpVectors(this.prevPos, this.pos, alpha);
    outQuat.slerpQuaternions(this.prevQuat, this.quat, alpha);
  }
}
