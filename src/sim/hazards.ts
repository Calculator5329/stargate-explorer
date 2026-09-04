import { Matrix3, Matrix4, Quaternion, Vector3 } from "three";
import { T, clamp } from "@/core/tunables";
import type { Flight } from "@/sim/flight";

export interface RockField {
  count: number;
  /** xyz per rock, world space (bounding spheres, broad phase) */
  centers: Float32Array;
  radii: Float32Array;
  /** per base shape, packed (nx, ny, nz, d) face planes of the unit rock (narrow phase) */
  planes: Float32Array[];
  per: number;
  matrixAt(gi: number, out: Matrix4): void;
}

const _n = new Vector3();
const _m = new Matrix4();
const _inv = new Matrix4();
const _nm = new Matrix3();
const _q3 = new Vector3();
const _fwd = new Vector3();
const _q = new Quaternion();
const Z = new Vector3(0, 0, 1);

/**
 * Things the sim pushes back on: rock collisions and the arena edge (a soft
 * current that turns the ship back toward the centre, getting firmer the
 * further out it is). Runs after `Flight.tick`.
 *
 * Collision is two-phase: bounding sphere, then the ship (a point with radius
 * `shipRadius`) against the rock's face planes in rock space. The old
 * sphere-only test fired on close fly-bys because the sphere circumscribes a
 * rock that is squashed to ~0.68 in one axis (Ethan, 2026-09-04).
 */
export class Hazards {
  /** true while the ship is past the arena radius */
  outside = false;

  constructor(private readonly rocks: RockField) {}

  tick(flight: Flight, dt: number): void {
    const p = flight.pos;
    const R = T.arena.shipRadius;
    for (let i = 0; i < this.rocks.count; i++) {
      const r = (this.rocks.radii[i] ?? 0) + R;
      const cx = this.rocks.centers[i * 3] ?? 0, cy = this.rocks.centers[i * 3 + 1] ?? 0, cz = this.rocks.centers[i * 3 + 2] ?? 0;
      const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
      if (dx * dx + dy * dy + dz * dz >= r * r) continue;
      this.narrow(flight, i, r - R);
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
    const sp = flight.vel.length();
    flight.velDir.lerp(_n, clamp(f * T.arena.turnRate * dt, 0, 1)).normalize();
    flight.vel.copy(flight.velDir).multiplyScalar(sp);
  }

  /** Face-plane test in rock space; `scale` is the rock's uniform scale (its sphere radius / 1.05). */
  private narrow(flight: Flight, gi: number, scale: number): void {
    const s = scale / 1.05;
    this.rocks.matrixAt(gi, _m);
    _inv.copy(_m).invert();
    _q3.copy(flight.pos).applyMatrix4(_inv);
    const planes = this.rocks.planes[Math.floor(gi / this.rocks.per)]!;
    const margin = T.arena.shipRadius / s;
    let best = -Infinity, bi = 0;
    for (let f = 0; f < planes.length; f += 4) {
      const d = (planes[f]! * _q3.x + planes[f + 1]! * _q3.y + planes[f + 2]! * _q3.z) - planes[f + 3]!;
      if (d > best) (best = d), (bi = f);
    }
    if (best >= margin) return; // outside every face by more than the ship radius: a fly-by
    _nm.getNormalMatrix(_m);
    _n.set(planes[bi]!, planes[bi + 1]!, planes[bi + 2]!).applyMatrix3(_nm).normalize();
    flight.pos.addScaledVector(_n, (margin - best) * s + 0.05);
    flight.bounce(_n);
  }
}
