import * as THREE from "three";
import { mulberry32 } from "@/core/random";

export interface DebrisOptions {
  count: number;
  seed: number;
  inner: number;
  outer: number;
}

const _obj = new THREE.Object3D();
const _axis = new THREE.Vector3();
const _q = new THREE.Quaternion();

/**
 * Placeholder asteroid field: one InstancedMesh of flat icosahedra with a slow
 * tumble. Replaced by the M1 asteroid pass (varied shapes, outlines).
 */
export class Debris {
  readonly mesh: THREE.InstancedMesh;
  private readonly rates: Float32Array;
  private readonly axes: Float32Array;

  constructor(o: DebrisOptions) {
    const rnd = mulberry32(o.seed);
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x6b655c, roughness: 0.95, metalness: 0.05, flatShading: true });
    this.mesh = new THREE.InstancedMesh(geo, mat, o.count);
    this.rates = new Float32Array(o.count);
    this.axes = new Float32Array(o.count * 3);
    for (let i = 0; i < o.count; i++) {
      const r = o.inner + (o.outer - o.inner) * Math.cbrt(rnd());
      const th = rnd() * Math.PI * 2;
      const ph = Math.acos(2 * rnd() - 1);
      _obj.position.set(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.35, r * Math.sin(ph) * Math.sin(th));
      _obj.quaternion.setFromEuler(new THREE.Euler(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28));
      _obj.scale.setScalar(2 + rnd() * rnd() * 14);
      _obj.updateMatrix();
      this.mesh.setMatrixAt(i, _obj.matrix);
      this.rates[i] = 0.05 + rnd() * 0.4;
      _axis.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
      this.axes.set([_axis.x, _axis.y, _axis.z], i * 3);
    }
  }

  tick(dt: number): void {
    const n = this.mesh.count;
    for (let i = 0; i < n; i++) {
      this.mesh.getMatrixAt(i, _obj.matrix);
      _obj.matrix.decompose(_obj.position, _obj.quaternion, _obj.scale);
      _axis.set(this.axes[i * 3] ?? 0, this.axes[i * 3 + 1] ?? 0, this.axes[i * 3 + 2] ?? 1);
      _q.setFromAxisAngle(_axis, (this.rates[i] ?? 0) * dt);
      _obj.quaternion.premultiply(_q);
      _obj.updateMatrix();
      this.mesh.setMatrixAt(i, _obj.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
