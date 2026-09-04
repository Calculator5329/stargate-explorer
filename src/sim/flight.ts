import { Quaternion, Vector3 } from "three";
import { T, clamp, lerp, moveToward } from "@/core/tunables";
import type { Input } from "@/core/input";

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
/** Ship right is −X: right-handed frame, right = forward × up = Z × Y. */
const RIGHT = new Vector3(-1, 0, 0);
const _q = new Quaternion();
const _fwd = new Vector3();
const _right = new Vector3();
const _n = new Vector3();

/**
 * Kinematic arcade-sim flight. The nose (+Z) is steered by the stick; the
 * velocity direction `velDir` chases the nose with a little inertia, freezes
 * while drifting (Space), and gets reflected by collisions. Roll is manual
 * (A/D) plus bank-into-turn and a soft-horizon auto-level; a double-tap on A/D
 * fires a fast 360° barrel roll with a sideways hop.
 * Keeps the previous tick's pose so render can interpolate via `sample()`.
 */
export class Flight {
  readonly pos = new Vector3();
  readonly quat = new Quaternion();
  readonly prevPos = new Vector3();
  readonly prevQuat = new Quaternion();
  readonly velDir = new Vector3(0, 0, 1);
  speed = T.flight.minSpeed;
  throttle = 0.5;
  boosting = false;
  drifting = false;
  /** remaining barrel-roll angle (signed, rad); 0 when not rolling */
  barrelLeft = 0;
  /** seconds since the last collision, for camera shake / HUD flash */
  sinceHit = 99;

  tick(dt: number, input: Input): void {
    this.prevPos.copy(this.pos);
    this.prevQuat.copy(this.quat);
    const f = T.flight;
    this.sinceHit += dt;

    this.throttle = clamp(this.throttle + input.throttleDelta * f.throttleRate * dt, 0, 1);
    this.boosting = input.boost;
    this.drifting = input.drift;
    const targetSpeed = this.boosting ? f.boostSpeed : lerp(f.minSpeed, f.maxSpeed, this.throttle);
    this.speed = moveToward(this.speed, targetSpeed, (this.boosting ? f.boostAccel : this.drifting ? f.driftDecel : f.accel) * dt);

    if (input.barrel !== 0 && this.barrelLeft === 0) this.barrelLeft = input.barrel * Math.PI * 2;

    _right.copy(RIGHT).applyQuaternion(this.quat);
    _fwd.copy(Z).applyQuaternion(this.quat);
    // Soft horizon: steer right.y toward the bank the turn asks for (right stick =
    // right wing down). Off near vertical (no horizon), while rolling by hand, and mid-barrel.
    const nearVertical = Math.abs(_fwd.y) > 0.95;
    const targetBank = clamp(-input.stick.x * f.bankIntoTurn, -1, 1);
    const levelRoll = nearVertical || input.roll !== 0 || this.barrelLeft !== 0 ? 0 : (_right.y - targetBank) * f.autoLevel;

    // Rotations below are about local axes; signs follow from +X being port:
    //   +X rotation drops the nose, +Y rotation yaws the nose to port, +Z rotation rolls right.
    const pitch = -input.stick.y * f.pitchRate * dt;
    const yaw = -input.stick.x * f.yawRate * dt;
    let roll = (input.roll * f.rollRate + levelRoll) * dt;
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
      const k = 1 - Math.exp(-f.velFollow * dt);
      this.velDir.lerp(_fwd, k).normalize();
    }
    this.pos.addScaledVector(this.velDir, this.speed * dt);
  }

  /** Bounce off a surface with outward normal `n`: reflect velocity, bleed speed, nose follows. */
  bounce(n: Vector3): void {
    _n.copy(n);
    this.velDir.addScaledVector(_n, -2 * this.velDir.dot(_n)).normalize();
    this.speed = Math.max(T.flight.minSpeed * 0.6, this.speed * T.flight.bounceKeep);
    this.sinceHit = 0;
  }

  /** Interpolated pose for rendering. Render code must use this, never pos/quat. */
  sample(alpha: number, outPos: Vector3, outQuat: Quaternion): void {
    outPos.lerpVectors(this.prevPos, this.pos, alpha);
    outQuat.slerpQuaternions(this.prevQuat, this.quat, alpha);
  }
}
