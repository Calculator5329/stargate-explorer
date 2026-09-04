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

/**
 * Kinematic arcade-sim flight: velocity always tracks the nose (+Z). The stick
 * commands pitch/yaw rates; roll is manual (Q/E) plus bank-into-turn and a
 * soft-horizon auto-level that pulls the wings toward a target bank.
 * Keeps the previous tick's pose so render can interpolate via `sample()`.
 */
export class Flight {
  readonly pos = new Vector3();
  readonly quat = new Quaternion();
  readonly prevPos = new Vector3();
  readonly prevQuat = new Quaternion();
  speed = T.flight.minSpeed;
  throttle = 0.5;
  boosting = false;

  tick(dt: number, input: Input): void {
    this.prevPos.copy(this.pos);
    this.prevQuat.copy(this.quat);
    const f = T.flight;

    this.throttle = clamp(this.throttle + input.throttleDelta * f.throttleRate * dt, 0, 1);
    this.boosting = input.boost;
    const targetSpeed = this.boosting ? f.boostSpeed : lerp(f.minSpeed, f.maxSpeed, this.throttle);
    this.speed = moveToward(this.speed, targetSpeed, (this.boosting ? f.boostAccel : f.accel) * dt);

    _right.copy(RIGHT).applyQuaternion(this.quat);
    _fwd.copy(Z).applyQuaternion(this.quat);
    // Soft horizon: steer right.y toward the bank the turn asks for (right stick =
    // right wing down). Off near vertical (no horizon) and while rolling by hand.
    const nearVertical = Math.abs(_fwd.y) > 0.95;
    const targetBank = clamp(-input.stick.x * f.bankIntoTurn, -1, 1);
    const levelRoll = nearVertical || input.roll !== 0 ? 0 : (_right.y - targetBank) * f.autoLevel;

    // Rotations below are about local axes; signs follow from +X being port:
    //   +X rotation drops the nose, +Y rotation yaws the nose to port, +Z rotation rolls right.
    const pitch = -input.stick.y * f.pitchRate * dt;
    const yaw = -input.stick.x * f.yawRate * dt;
    const roll = (input.roll * f.rollRate + levelRoll) * dt;
    this.quat.multiply(_q.setFromAxisAngle(X, pitch));
    this.quat.multiply(_q.setFromAxisAngle(Y, yaw));
    this.quat.multiply(_q.setFromAxisAngle(Z, roll));
    this.quat.normalize();

    _fwd.copy(Z).applyQuaternion(this.quat);
    this.pos.addScaledVector(_fwd, this.speed * dt);
  }

  /** Interpolated pose for rendering. Render code must use this, never pos/quat. */
  sample(alpha: number, outPos: Vector3, outQuat: Quaternion): void {
    outPos.lerpVectors(this.prevPos, this.pos, alpha);
    outQuat.slerpQuaternions(this.prevQuat, this.quat, alpha);
  }
}
