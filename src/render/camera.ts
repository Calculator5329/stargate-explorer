import { Matrix4, Quaternion, Vector3, type PerspectiveCamera } from "three";
import { T } from "@/core/tunables";

const _desired = new Vector3();
const _target = new Vector3();
const _up = new Vector3();
const _off = new Vector3();
const _fwd = new Vector3();
const _acc = new Vector3();
const _m = new Matrix4();
const _qt = new Quaternion();
const ZERO = new Vector3();

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
  /** clock for the boost rumble */
  private shakeT = 0;
  private stuntFrac = 0;
  private readonly anchor = new Vector3();

  constructor(readonly cam: PerspectiveCamera) {}

  /** Snap to the ship on the next update (the ship was moved to a new system). */
  reset(): void {
    this.initialised = false;
    this.vel.set(0, 0, 0);
    this.stuntFrac = 0;
  }

  update(frameDt: number, shipPos: Vector3, shipQuat: Quaternion, speed: number, stick: { x: number; y: number }, boost: boolean, sinceHit: number, size = 1, rolling = false, moveProgress = -1): void {
    const c = T.camera;
    const dt = Math.min(frameDt, 1 / 30); // keep the spring stable on hitches
    this.boostFrac += ((boost ? 1 : 0) - this.boostFrac) * (1 - Math.exp(-3 * dt));
    this.rollFrac += ((rolling ? 1 : 0) - this.rollFrac) * (1 - Math.exp(-(rolling ? 10 : 3) * dt));
    const stunt = moveProgress >= 0;
    this.stuntFrac += ((stunt ? 1 : 0) - this.stuntFrac) * (1 - Math.exp(-(stunt ? 7 : 3) * dt));
    if (!this.initialised) { this.frame.copy(shipQuat); this.anchor.copy(shipPos); }
    this.anchor.lerp(shipPos, 1 - Math.exp(-c.stuntLag * dt));
    _off.subVectors(this.anchor, shipPos).clampLength(0, c.stuntLagMax * size);
    this.anchor.copy(shipPos).add(_off);
    if (stunt) {
      // Hold the entry attitude through the trick. Only start following the nose on the exit;
      // otherwise a 180° reversal rotates the whole screen and hides the actual manoeuvre.
      if (moveProgress > .65) {
        _fwd.set(0, 0, 1).applyQuaternion(shipQuat);
        _up.set(0, 1, 0).applyQuaternion(this.frame);
        _m.lookAt(_fwd, ZERO, _up);
        this.frame.slerp(_qt.setFromRotationMatrix(_m), 1 - Math.exp(-c.stuntFollow * dt));
      }
    } else if (rolling) {
      // barrel roll: the camera keeps its own up and only follows the nose, so the hull spins in front of a steady
      // horizon (Ethan, 2026-09-05: "I should see my ship spin instead of the whole camera spinning"). A full roll
      // ends where it started, so the frame is already aligned when normal following resumes: no snap.
      _fwd.set(0, 0, 1).applyQuaternion(shipQuat);
      _up.set(0, 1, 0).applyQuaternion(this.frame);
      _m.lookAt(_fwd, ZERO, _up); // +Z of the result points along fwd
      _qt.setFromRotationMatrix(_m);
      this.frame.slerp(_qt, 1 - Math.exp(-c.barrelFollow * dt));
    } else this.frame.slerp(shipQuat, 1 - Math.exp(-(c.followRate * (1 - this.stuntFrac) + c.stuntFollow * this.stuntFrac) * dt));

    _off.set(stick.x * c.swayYaw * (1 - this.stuntFrac), (c.height - stick.y * c.swayPitch * (1 - this.stuntFrac)) * size, (-c.distance - c.distanceBoost * this.boostFrac - c.barrelDistance * this.rollFrac - c.stuntDistance * this.stuntFrac) * size * Math.max(1, c.referenceAspect / this.cam.aspect)); // +X is port
    _desired.copy(_off).applyQuaternion(this.frame);
    if (!this.initialised) {
      this.off.copy(_desired);
      this.initialised = true;
    }
    // a = k (desired - off) - d v ; semi-implicit Euler, in the ship-relative frame
    _acc.subVectors(_desired, this.off).multiplyScalar(c.stiffness).addScaledVector(this.vel, -c.damping);
    this.vel.addScaledVector(_acc, dt);
    this.off.addScaledVector(this.vel, dt);
    _target.copy(shipPos).lerp(this.anchor, this.stuntFrac);
    this.cam.position.copy(_target).add(this.off);
    const hit = c.hitShake * Math.exp(-sinceHit * 5);
    if (hit > 1e-3) this.cam.position.addScaledVector(_up.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5), hit * 2);
    // boost rumble: a sum of sines, not per-frame noise. White noise under a still aim cursor read as the
    // cursor jittering whenever Shift was held (Ethan, 2026-09-06); this hums instead of stutters.
    const rumble = c.boostShake * this.boostFrac;
    if (rumble > 1e-3) {
      const t = (this.shakeT += dt);
      _up.set(Math.sin(t * 31) * Math.sin(t * 7.3), Math.sin(t * 27 + 1) * Math.sin(t * 9.1), Math.sin(t * 23 + 2) * Math.sin(t * 5.7));
      this.cam.position.addScaledVector(_up, rumble);
    }

    _fwd.set(0, 0, 1).applyQuaternion(this.frame);
    _target.addScaledVector(_fwd, c.lookAhead * (1 - this.stuntFrac) + c.stuntLookAhead * this.stuntFrac);
    // up comes straight from the lagged frame. Lerping the up vector separately passed through zero
    // half-way round a barrel roll and lookAt flipped the picture (Ethan, 2026-09-05: "it flips the screen
    // instead of following the whole roll"); the frame's slerp already carries the lag.
    this.cam.up.copy(_up.set(0, 1, 0).applyQuaternion(this.frame));
    this.cam.lookAt(_target);

    const targetFov = c.fovBase + c.fovSpeed * Math.min(1, speed / T.flight.boostSpeed) + c.barrelFov * this.rollFrac + c.stuntFov * this.stuntFrac;
    this.fov += (targetFov - this.fov) * (1 - Math.exp(-4 * dt));
    if (Math.abs(this.cam.fov - this.fov) > 0.01) {
      this.cam.fov = this.fov;
      this.cam.updateProjectionMatrix();
    }
  }
}
