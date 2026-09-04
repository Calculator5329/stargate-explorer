import * as THREE from "three";
import { mulberry32 } from "@/core/random";
import { toonMaterial } from "@/render/toon";
import { outlineGeometry, outlineMaterial } from "@/render/outline";
import { noEdge } from "@/render/layers";

export interface AsteroidOptions {
  count: number;
  seed: number;
  inner: number;
  outer: number;
  /** vertical half-thickness of the belt */
  thickness: number;
  shapes: number;
}

// Ethan's 2026-09-04 reference: plum bodies whose sun-facing facets go rust-orange. The warm key
// lights a terracotta albedo; a flat violet emissive owns the shadow side.
const TINTS = [0x8a4a32, 0x7a4030, 0x925438, 0x6e3c3a];
const ROCK_GLOW = 0x140a2a;
const _obj = new THREE.Object3D();
const _axis = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();

/**
 * One faceted rock: icosahedron with per-vertex radial jitter and a y squash.
 * `IcosahedronGeometry` is already non-indexed, so every jitter value is keyed
 * by position and reused for each occurrence of a vertex; otherwise facets tear
 * apart and the shell shows through every edge as a hairline (2026-09-03).
 */
function rockGeometry(rnd: () => number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const pos = g.getAttribute("position");
  const seen = new Map<string, [number, number]>();
  for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i);
    const key = `${_v.x.toFixed(3)},${_v.y.toFixed(3)},${_v.z.toFixed(3)}`;
    let j = seen.get(key);
    if (j === undefined) {
      j = [0.72 + rnd() * 0.55, 0.65 + rnd() * 0.05];
      seen.set(key, j);
    }
    _v.multiplyScalar(j[0]);
    pos.setXYZ(i, _v.x, _v.y * j[1], _v.z);
  }
  g.computeVertexNormals();
  return g;
}

const CREASE_DEG = 55;
// Crease lines: facet edges sharper than CREASE_DEG, drawn as instanced line segments that share
// the rock's instanceMatrix. Pushed out a hair so they win the depth test.
const LINE_VERT = /* glsl */ `
attribute mat4 instanceMatrix;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position * 1.004, 1.0);
}`;
const LINE_FRAG = /* glsl */ `
uniform vec3 uColor;
void main() { gl_FragColor = vec4(uColor, 1.0); }`;
const lineMaterial = new THREE.ShaderMaterial({ vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, uniforms: { uColor: { value: new THREE.Color(0x0a0a0c) } } });

function creaseLines(rock: THREE.BufferGeometry, instanceMatrix: THREE.InstancedBufferAttribute, count: number): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(rock, CREASE_DEG);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", edges.getAttribute("position"));
  g.setAttribute("instanceMatrix", instanceMatrix);
  g.instanceCount = count;
  const lines = new THREE.LineSegments(g, lineMaterial);
  lines.frustumCulled = false;
  return noEdge(lines);
}

/**
 * Faceted asteroid belt: `shapes` base rocks, one InstancedMesh each plus an
 * instanced outline shell and instanced crease lines, slow per-instance tumble.
 * `centers`/`radii` expose every rock's bounding sphere for collision.
 */
export class Asteroids {
  readonly group = new THREE.Group();
  readonly count: number;
  readonly centers: Float32Array;
  readonly radii: Float32Array;
  private readonly meshes: THREE.InstancedMesh[] = [];
  private readonly rates: Float32Array[] = [];
  private readonly axes: Float32Array[] = [];

  constructor(o: AsteroidOptions) {
    const rnd = mulberry32(o.seed);
    const per = Math.ceil(o.count / o.shapes);
    this.count = per * o.shapes;
    this.centers = new Float32Array(this.count * 3);
    this.radii = new Float32Array(this.count);
    for (let s = 0; s < o.shapes; s++) {
      const rock = rockGeometry(rnd);
      const mesh = new THREE.InstancedMesh(rock, toonMaterial(TINTS[s % TINTS.length]!, { emissive: ROCK_GLOW, emissiveIntensity: 1.3 }), per);
      const rates = new Float32Array(per);
      const axes = new Float32Array(per * 3);
      for (let i = 0; i < per; i++) {
        const r = o.inner + (o.outer - o.inner) * Math.sqrt(rnd());
        const th = rnd() * Math.PI * 2;
        _obj.position.set(r * Math.cos(th), (rnd() * 2 - 1) * o.thickness * (0.3 + 0.7 * rnd()), r * Math.sin(th));
        _obj.quaternion.setFromEuler(new THREE.Euler(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28));
        const big = rnd() < 0.12;
        const scale = big ? 22 + rnd() * 40 : 3 + rnd() * rnd() * 12;
        _obj.scale.setScalar(scale);
        _obj.updateMatrix();
        mesh.setMatrixAt(i, _obj.matrix);
        const gi = s * per + i;
        this.centers.set([_obj.position.x, _obj.position.y, _obj.position.z], gi * 3);
        this.radii[gi] = scale * 1.05;
        rates[i] = (0.03 + rnd() * 0.25) * (big ? 0.35 : 1);
        _axis.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
        axes.set([_axis.x, _axis.y, _axis.z], i * 3);
      }
      mesh.castShadow = false;
      mesh.frustumCulled = false;
      const shell = noEdge(new THREE.InstancedMesh(outlineGeometry(rock.getAttribute("position").array), outlineMaterial, per));
      shell.instanceMatrix = mesh.instanceMatrix;
      shell.frustumCulled = false;
      this.meshes.push(mesh);
      this.rates.push(rates);
      this.axes.push(axes);
      this.group.add(mesh, shell, creaseLines(rock, mesh.instanceMatrix, per));
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
