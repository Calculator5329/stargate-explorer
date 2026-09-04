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
 * widens FOV with speed.
 */
export class ChaseCamera {
  private readonly vel = new Vector3();
  private fov = T.camera.fovBase;
  private initialised = false;

  constructor(readonly cam: PerspectiveCamera) {}

  update(frameDt: number, shipPos: Vector3, shipQuat: Quaternion, speed: number, stick: { x: number; y: number }): void {
    const c = T.camera;
    const dt = Math.min(frameDt, 1 / 30); // keep the spring stable on hitches

    _off.set(stick.x * c.swayYaw, c.height - stick.y * c.swayPitch, -c.distance); // +X is port
    _desired.copy(_off).applyQuaternion(shipQuat).add(shipPos);
    if (!this.initialised) {
      this.cam.position.copy(_desired);
      this.initialised = true;
    }
    // a = k (desired - pos) - d v ; semi-implicit Euler
    _acc.subVectors(_desired, this.cam.position).multiplyScalar(c.stiffness).addScaledVector(this.vel, -c.damping);
    this.vel.addScaledVector(_acc, dt);
    this.cam.position.addScaledVector(this.vel, dt);

    _fwd.set(0, 0, 1).applyQuaternion(shipQuat);
    _target.copy(shipPos).addScaledVector(_fwd, c.lookAhead);
    _up.set(0, 1, 0).applyQuaternion(shipQuat);
    this.cam.up.lerp(_up, 1 - Math.exp(-c.upFollow * dt)).normalize();
    this.cam.lookAt(_target);

    const targetFov = c.fovBase + c.fovSpeed * (speed / T.flight.maxSpeed);
    this.fov += (targetFov - this.fov) * (1 - Math.exp(-4 * dt));
    if (Math.abs(this.cam.fov - this.fov) > 0.01) {
      this.cam.fov = this.fov;
      this.cam.updateProjectionMatrix();
    }
  }
}
