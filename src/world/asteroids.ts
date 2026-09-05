import * as THREE from "three";
import { mulberry32 } from "@/core/random";
import { toonMaterial } from "@/render/toon";
import { outlineGeometry, outlineMaterial } from "@/render/outline";
import { noEdge } from "@/render/layers";

/** what the belt is made of: faceted rock, ice shards, or derelict wreckage */
export type BeltStyle = "rock" | "ice";

export interface AsteroidOptions {
  count: number;
  style?: BeltStyle;
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

interface StyleDef {
  tints: number[];
  glow: number;
  glowIntensity: number;
  geometry(shape: number, rnd: () => number): THREE.BufferGeometry;
  /** chance a piece is one of the big ones, and the two scale ranges [min, spread] */
  bigChance: number;
  big: [number, number];
  small: [number, number];
  tumble: number;
}

// Ice: pale blue-green shards, a cold teal shadow side. Kept mid-tone so the albedo stays under the bloom threshold.
const STYLES: Record<BeltStyle, StyleDef> = {
  rock: { tints: TINTS, glow: ROCK_GLOW, glowIntensity: 1.3, geometry: (_s, rnd) => rockGeometry(rnd), bigChance: 0.12, big: [22, 40], small: [3, 12], tumble: 1 },
  ice: { tints: [0x7fb8d2, 0x6ea9c6, 0x93c7dc, 0x5f9dbb], glow: 0x08222e, glowIntensity: 1.6, geometry: (_s, rnd) => shardGeometry(rnd), bigChance: 0.08, big: [26, 34], small: [3, 14], tumble: 1.4 },
};
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

/**
 * An ice shard: a jittered icosahedron stretched along one axis and pinched
 * across another, then normalised so its farthest vertex sits at 1. Still
 * convex, so the rock collision path handles it unchanged.
 */
function shardGeometry(rnd: () => number): THREE.BufferGeometry {
  const g = rockGeometry(rnd);
  const pos = g.getAttribute("position");
  const stretch = 1.7 + rnd() * 0.9, pinch = 0.55 + rnd() * 0.25;
  let max = 0;
  for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i);
    _v.set(_v.x * pinch, _v.y * stretch, _v.z);
    // a chisel tip: the far end narrows
    const tip = 1 - 0.35 * Math.max(0, _v.y / stretch);
    pos.setXYZ(i, _v.x * tip, _v.y, _v.z * tip);
    max = Math.max(max, Math.hypot(_v.x * tip, _v.y, _v.z * tip));
  }
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) / max, pos.getY(i) / max, pos.getZ(i) / max);
  g.computeVertexNormals();
  return g;
}

/** Radius of the smallest origin-centred sphere holding every vertex. */
function boundRadius(g: THREE.BufferGeometry): number {
  const pos = g.getAttribute("position");
  let max = 0;
  for (let i = 0; i < pos.count; i++) max = Math.max(max, _v.fromBufferAttribute(pos, i).length());
  return max;
}

/**
 * Face planes of one unit rock, packed (nx, ny, nz, d) with n·x = d on the face.
 * Collision treats the rock as the convex hull of its facets: a point is inside
 * when it is behind every plane. The icosahedron with mild radial jitter is
 * convex enough for a fighter-sized probe (2026-09-04, close fly-bys used to
 * bounce off the bounding sphere).
 */
function facePlanes(rock: THREE.BufferGeometry): Float32Array {
  const pos = rock.getAttribute("position");
  const out = new Float32Array((pos.count / 3) * 4);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let f = 0; f < pos.count / 3; f++) {
    a.fromBufferAttribute(pos, f * 3);
    b.fromBufferAttribute(pos, f * 3 + 1);
    c.fromBufferAttribute(pos, f * 3 + 2);
    n.subVectors(b, a).cross(c.clone().sub(a)).normalize();
    out.set([n.x, n.y, n.z, n.dot(a)], f * 4);
  }
  return out;
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
  /** per base shape: packed face planes of the unit rock (see `facePlanes`) */
  readonly planes: Float32Array[] = [];
  /** per base shape: bounding radius of the unit geometry, so `radii[gi] / bounds[shape]` is the instance scale */
  readonly bounds: Float32Array;
  readonly style: BeltStyle;
  /** instances per shape; global index gi → shape gi / per, slot gi % per */
  readonly per: number;
  private readonly meshes: THREE.InstancedMesh[] = [];
  private readonly rates: Float32Array[] = [];
  private readonly axes: Float32Array[] = [];

  constructor(o: AsteroidOptions) {
    const rnd = mulberry32(o.seed);
    const style = STYLES[o.style ?? "rock"];
    this.style = o.style ?? "rock";
    const per = Math.ceil(o.count / o.shapes);
    this.per = per;
    this.count = per * o.shapes;
    this.centers = new Float32Array(this.count * 3);
    this.radii = new Float32Array(this.count);
    this.bounds = new Float32Array(o.shapes);
    for (let s = 0; s < o.shapes; s++) {
      const rock = style.geometry(s, rnd);
      this.planes.push(facePlanes(rock));
      const bound = boundRadius(rock) * 1.02;
      this.bounds[s] = bound;
      const mesh = new THREE.InstancedMesh(rock, toonMaterial(style.tints[s % style.tints.length]!, { emissive: style.glow, emissiveIntensity: style.glowIntensity }), per);
      const rates = new Float32Array(per);
      const axes = new Float32Array(per * 3);
      for (let i = 0; i < per; i++) {
        const r = o.inner + (o.outer - o.inner) * Math.sqrt(rnd());
        const th = rnd() * Math.PI * 2;
        _obj.position.set(r * Math.cos(th), (rnd() * 2 - 1) * o.thickness * (0.3 + 0.7 * rnd()), r * Math.sin(th));
        _obj.quaternion.setFromEuler(new THREE.Euler(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28));
        const big = rnd() < style.bigChance;
        const scale = big ? style.big[0] + rnd() * style.big[1] : style.small[0] + rnd() * rnd() * style.small[1];
        _obj.scale.setScalar(scale);
        _obj.updateMatrix();
        mesh.setMatrixAt(i, _obj.matrix);
        const gi = s * per + i;
        this.centers.set([_obj.position.x, _obj.position.y, _obj.position.z], gi * 3);
        this.radii[gi] = scale * bound;
        rates[i] = (0.03 + rnd() * 0.25) * (big ? 0.35 : 1) * style.tumble;
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

  /** World matrix of rock `gi` (position, tumble, uniform scale). */
  matrixAt(gi: number, out: THREE.Matrix4): void {
    this.meshes[Math.floor(gi / this.per)]!.getMatrixAt(gi % this.per, out);
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
