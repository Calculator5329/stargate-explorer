import * as THREE from "three";
import { mulberry32 } from "@/core/random";
import { toonMaterial } from "@/render/toon";

export interface AsteroidOptions {
  count: number;
  seed: number;
  inner: number;
  outer: number;
  /** vertical half-thickness of the belt */
  thickness: number;
  shapes: number;
}

const TINTS = [0x6f6976, 0x7a6d60, 0x5e626c, 0x716a5e];
const _obj = new THREE.Object3D();
const _axis = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();

/** One faceted rock: jittered icosahedron, squashed, non-indexed so every facet is flat. */
function rockGeometry(rnd: () => number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const pos = g.getAttribute("position");
  const seen = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i);
    const key = `${_v.x.toFixed(3)},${_v.y.toFixed(3)},${_v.z.toFixed(3)}`;
    let s = seen.get(key);
    if (s === undefined) {
      s = 0.72 + rnd() * 0.55;
      seen.set(key, s);
    }
    _v.multiplyScalar(s);
    pos.setXYZ(i, _v.x, _v.y * (0.65 + rnd() * 0.05), _v.z);
  }
  const flat = g.toNonIndexed();
  g.dispose();
  flat.computeVertexNormals();
  return flat;
}

/**
 * Faceted asteroid belt: `shapes` base rocks, one InstancedMesh each, slow
 * per-instance tumble. Outlines come from the post edge pass.
 */
export class Asteroids {
  readonly group = new THREE.Group();
  private readonly meshes: THREE.InstancedMesh[] = [];
  private readonly rates: Float32Array[] = [];
  private readonly axes: Float32Array[] = [];

  constructor(o: AsteroidOptions) {
    const rnd = mulberry32(o.seed);
    const per = Math.ceil(o.count / o.shapes);
    for (let s = 0; s < o.shapes; s++) {
      const mesh = new THREE.InstancedMesh(rockGeometry(rnd), toonMaterial(TINTS[s % TINTS.length]!), per);
      const rates = new Float32Array(per);
      const axes = new Float32Array(per * 3);
      for (let i = 0; i < per; i++) {
        const r = o.inner + (o.outer - o.inner) * Math.sqrt(rnd());
        const th = rnd() * Math.PI * 2;
        _obj.position.set(r * Math.cos(th), (rnd() * 2 - 1) * o.thickness * (0.3 + 0.7 * rnd()), r * Math.sin(th));
        _obj.quaternion.setFromEuler(new THREE.Euler(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28));
        const big = rnd() < 0.12;
        _obj.scale.setScalar(big ? 22 + rnd() * 40 : 3 + rnd() * rnd() * 12);
        _obj.updateMatrix();
        mesh.setMatrixAt(i, _obj.matrix);
        rates[i] = (0.03 + rnd() * 0.25) * (big ? 0.35 : 1);
        _axis.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
        axes.set([_axis.x, _axis.y, _axis.z], i * 3);
      }
      mesh.castShadow = false;
      this.meshes.push(mesh);
      this.rates.push(rates);
      this.axes.push(axes);
      this.group.add(mesh);
    }
  }

  tick(dt: number): void {
    for (let m = 0; m < this.meshes.length; m++) {
      const mesh = this.meshes[m]!;
      const rates = this.rates[m]!;
      const axes = this.axes[m]!;
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, _obj.matrix);
        _obj.matrix.decompose(_obj.position, _obj.quaternion, _obj.scale);
        _axis.set(axes[i * 3] ?? 0, axes[i * 3 + 1] ?? 0, axes[i * 3 + 2] ?? 1);
        _q.setFromAxisAngle(_axis, (rates[i] ?? 0) * dt);
        _obj.quaternion.premultiply(_q);
        _obj.updateMatrix();
        mesh.setMatrixAt(i, _obj.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
