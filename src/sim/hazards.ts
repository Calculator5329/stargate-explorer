import { Quaternion, Vector3 } from "three";
import { T, clamp } from "@/core/tunables";
import type { Flight } from "@/sim/flight";

export interface SphereField {
  count: number;
  /** xyz per sphere, world space */
  centers: Float32Array;
  radii: Float32Array;
}

const _n = new Vector3();
const _c = new Vector3();
const _fwd = new Vector3();
const _q = new Quaternion();
const Z = new Vector3(0, 0, 1);

/**
 * Things the sim pushes back on: rock collisions (sphere vs sphere, bounce) and
 * the arena edge (a soft current that turns the ship back toward the centre,
 * getting firmer the further out it is). Runs after `Flight.tick`.
 */
export class Hazards {
  /** true while the ship is past the arena radius */
  outside = false;

  constructor(private readonly rocks: SphereField) {}

  tick(flight: Flight, dt: number): void {
    const p = flight.pos;
    const R = T.arena.shipRadius;
    for (let i = 0; i < this.rocks.count; i++) {
      const r = (this.rocks.radii[i] ?? 0) + R;
      const cx = this.rocks.centers[i * 3] ?? 0, cy = this.rocks.centers[i * 3 + 1] ?? 0, cz = this.rocks.centers[i * 3 + 2] ?? 0;
      const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= r * r) continue;
      _n.set(dx, dy, dz).normalize();
      _c.set(cx, cy, cz);
      p.copy(_c).addScaledVector(_n, r + 0.05);
      flight.bounce(_n);
    }

    const dist = p.length();
    const over = dist - T.arena.radius;
    this.outside = over > 0;
    if (!this.outside) return;
    const f = clamp(over / (T.arena.radius * 0.2), 0, 1);
    _fwd.copy(Z).applyQuaternion(flight.quat);
    _n.copy(p).multiplyScalar(-1 / dist); // toward centre
    if (_fwd.dot(_n) > 0.98) return;
    _q.setFromUnitVectors(_fwd, _n);
    _q.slerp(new Quaternion(), 1 - clamp(f * T.arena.turnRate * dt, 0, 1)); // partial rotation toward centre
    flight.quat.premultiply(_q).normalize();
    flight.velDir.lerp(_n, clamp(f * T.arena.turnRate * dt, 0, 1)).normalize();
  }
}
