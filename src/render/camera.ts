import { Quaternion, Vector3, type PerspectiveCamera } from "three";
import { T } from "@/core/tunables";

const _desired = new Vector3();
const _target = new Vector3();
const _up = new Vector3();
const _off = new Vector3();
const _fwd = new Vector3();
const _acc = new Vector3();

/**
 * Spring-damped chase camera. Sits behind/above the ship, sways opposite the
 * stick so the ship slides toward the turn, follows the ship's up vector, and
 * widens FOV with speed. The spring acts on the camera's *offset from the ship*,
 * not on its world position: a world-space spring lags by speed × damping /
 * stiffness (25 m at 100 m/s, 100+ m on boost), which is what made the ship
 * shrink into the distance as it sped up. Only rotation sways now.
 */
export class ChaseCamera {
  private readonly off = new Vector3();
  private readonly vel = new Vector3();
  private boostFrac = 0;
  private fov = T.camera.fovBase;
  private initialised = false;
  /** the camera's own attitude, chasing the ship's with a lag so manoeuvres read on screen */
  private readonly frame = new Quaternion();
  private rollFrac = 0;

  constructor(readonly cam: PerspectiveCamera) {}

  update(frameDt: number, shipPos: Vector3, shipQuat: Quaternion, speed: number, stick: { x: number; y: number }, boost: boolean, sinceHit: number, size = 1, rolling = false): void {
    const c = T.camera;
    const dt = Math.min(frameDt, 1 / 30); // keep the spring stable on hitches
    this.boostFrac += ((boost ? 1 : 0) - this.boostFrac) * (1 - Math.exp(-3 * dt));
    this.rollFrac += ((rolling ? 1 : 0) - this.rollFrac) * (1 - Math.exp(-(rolling ? 10 : 3) * dt));
    if (!this.initialised) this.frame.copy(shipQuat);
    // the frame chases the ship's attitude; during a barrel roll it chases slower, so the hull spins on screen
    this.frame.slerp(shipQuat, 1 - Math.exp(-(rolling ? c.barrelFollow : c.followRate) * dt));

    _off.set(stick.x * c.swayYaw, (c.height - stick.y * c.swayPitch) * size, (-c.distance - c.distanceBoost * this.boostFrac - c.barrelDistance * this.rollFrac) * size); // +X is port
    _desired.copy(_off).applyQuaternion(this.frame);
    if (!this.initialised) {
      this.off.copy(_desired);
      this.initialised = true;
    }
    // a = k (desired - off) - d v ; semi-implicit Euler, in the ship-relative frame
    _acc.subVectors(_desired, this.off).multiplyScalar(c.stiffness).addScaledVector(this.vel, -c.damping);
    this.vel.addScaledVector(_acc, dt);
    this.off.addScaledVector(this.vel, dt);
    this.cam.position.copy(shipPos).add(this.off);
    const shake = c.hitShake * Math.exp(-sinceHit * 5) + c.boostShake * this.boostFrac;
    if (shake > 1e-3) this.cam.position.addScaledVector(_up.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5), shake * 2);

    _fwd.set(0, 0, 1).applyQuaternion(this.frame);
    _target.copy(shipPos).addScaledVector(_fwd, c.lookAhead);
    // up comes straight from the lagged frame. Lerping the up vector separately passed through zero
    // half-way round a barrel roll and lookAt flipped the picture (Ethan, 2026-09-05: "it flips the screen
    // instead of following the whole roll"); the frame's slerp already carries the lag.
    this.cam.up.copy(_up.set(0, 1, 0).applyQuaternion(this.frame));
    this.cam.lookAt(_target);

    const targetFov = c.fovBase + c.fovSpeed * Math.min(1, speed / T.flight.boostSpeed) + c.barrelFov * this.rollFrac; // boost = full swing, never past it
    this.fov += (targetFov - this.fov) * (1 - Math.exp(-4 * dt));
    if (Math.abs(this.cam.fov - this.fov) > 0.01) {
      this.cam.fov = this.fov;
      this.cam.updateProjectionMatrix();
    }
  }
}
