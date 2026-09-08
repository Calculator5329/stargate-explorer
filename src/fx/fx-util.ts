import * as THREE from "three";

/** Instance matrix for a hidden (zero-scale) slot. */
export const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
export const Z_AXIS = new THREE.Vector3(0, 0, 1);

const _h = new THREE.Vector3();
const _t1 = new THREE.Vector3();
const _t2 = new THREE.Vector3();

/** Uniform random unit vector, written into `out`. */
export function randUnit(out: THREE.Vector3, random = Math.random): THREE.Vector3 {
  const z = random() * 2 - 1;
  const a = random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return out.set(r * Math.cos(a), r * Math.sin(a), z);
}

/** Random unit vector inside the cone of `halfAngle` radians around unit `axis`. */
export function randInCone(out: THREE.Vector3, axis: THREE.Vector3, halfAngle: number): THREE.Vector3 {
  _h.set(Math.abs(axis.x) < 0.9 ? 1 : 0, Math.abs(axis.x) < 0.9 ? 0 : 1, 0);
  _t1.crossVectors(axis, _h).normalize();
  _t2.crossVectors(axis, _t1);
  const th = Math.random() * halfAngle;
  const ph = Math.random() * Math.PI * 2;
  const s = Math.sin(th);
  return out.copy(axis).multiplyScalar(Math.cos(th)).addScaledVector(_t1, s * Math.cos(ph)).addScaledVector(_t2, s * Math.sin(ph));
}

/** 1 until `from`, linear to 0 at `to`, clamped. */
export function fadeOut(t: number, from: number, to: number): number {
  return t < from ? 1 : Math.max(0, 1 - (t - from) / (to - from));
}

/** 0 at `from`, 1 at `to`, clamped. */
export function popIn(t: number, from: number, to: number): number {
  return Math.min(1, Math.max(0, (t - from) / (to - from)));
}

/** Drag-limited outward travel: distance factor for unit speed after `t` seconds with drag `k`. */
export function dragDist(t: number, k: number): number {
  return (1 - Math.exp(-k * t)) / k;
}

/** Random in [a, b). */
export function rr(a: number, b: number, random = Math.random): number {
  return a + random() * (b - a);
}

/** Flat-shaded copy of a geometry (one normal per face) so toon bands step per facet. */
export function faceted<G extends THREE.BufferGeometry>(g: G): THREE.BufferGeometry {
  const f = g.index ? g.toNonIndexed() : g;
  f.computeVertexNormals();
  if (f !== g) g.dispose();
  return f;
}
