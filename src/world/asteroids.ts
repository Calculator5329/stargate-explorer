import * as THREE from "three";
import { mulberry32 } from "@/core/random";
import { toonMaterial } from "@/render/toon";
import { outlineGeometry, outlineMaterial } from "@/render/outline";
import { noEdge } from "@/render/layers";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { DERELICT_KINDS, derelictGeometry } from "@/world/derelict-geo";
import { T } from "@/core/tunables";

/** what the belt is made of: faceted rock, ice shards, or derelict wreckage */
export type BeltStyle = "rock" | "ice" | "wreck";

export interface AsteroidOptions {
  count: number;
  style?: BeltStyle;
  seed: number;
  inner: number;
  outer: number;
  /** vertical half-thickness of the belt */
  thickness: number;
  shapes: number;
  /** layout: `clusters` dense knots of about `clusterR` across take `clusterShare` of the rocks */
  clusters?: number;
  clusterR?: number;
  clusterShare?: number;
  /** a ring band at radius `band`, half-width `bandW`, takes `bandShare` of the rocks; the rest scatter over the annulus */
  band?: number;
  bandW?: number;
  bandShare?: number;
  /** spare fragment slots per shape (default 40) */
  frags?: number;
  /** per-belt look: one tint per base shape (cycled), so a belt can mix grey and plum rock; overrides the style's */
  tints?: number[];
  /** per-belt size mix: chance of a big piece and the [min, spread] scale ranges; overrides the style's */
  bigChance?: number;
  big?: [number, number];
  small?: [number, number];
  /** `voids` empty pockets of radius about `voidR` where no rock is placed: density varies instead of reading as one even fog */
  voids?: number;
  voidR?: number;
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
  /** concave shapes collide against their convex hull instead of their own facets */
  hull?: boolean;
}

// Ice: pale blue-green shards, a cold teal shadow side. Kept mid-tone so the albedo stays under the bloom threshold.
const STYLES: Record<BeltStyle, StyleDef> = {
  rock: { tints: TINTS, glow: ROCK_GLOW, glowIntensity: 1.3, geometry: (_s, rnd) => rockGeometry(rnd), bigChance: 0.12, big: [22, 40], small: [3, 12], tumble: 1 },
  ice: { tints: [0x7fb8d2, 0x6ea9c6, 0x93c7dc, 0x5f9dbb], glow: 0x08222e, glowIntensity: 1.6, geometry: (_s, rnd) => shardGeometry(rnd), bigChance: 0.08, big: [26, 34], small: [3, 14], tumble: 1.4 },
  // Wreckage: torn warship pieces (world/derelict-geo.ts, Astra). Gunmetal plates, a cold blue shadow side, slow tumble.
  wreck: { tints: [0x5a616b, 0x4b525c, 0x656c76, 0x555a66], glow: 0x0a0d18, glowIntensity: 1.4, geometry: (s, rnd) => derelictGeometry(s % DERELICT_KINDS, rnd), bigChance: 0.1, big: [30, 30], small: [6, 18], tumble: 0.35, hull: true },
};

/** Collision planes for a concave shape: the faces of its convex hull. */
function hullPlanes(g: THREE.BufferGeometry): Float32Array {
  const pos = g.getAttribute("position");
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i));
  const hull = new ConvexGeometry(pts);
  const planes = facePlanes(hull);
  hull.dispose();
  return planes;
}
const _obj = new THREE.Object3D();
const _pv = new THREE.Matrix4();
const _frustum = new THREE.Frustum();
const _sphere = new THREE.Sphere();
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

/** Cleaved crystal prisms: broad flat fractures and asymmetric chisel ends.
 * A real convex hull supplies both visible facets and collision planes.
 */
function shardGeometry(rnd: () => number): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  const length = 1.6 + rnd() * 1.3, width = 0.45 + rnd() * 0.4;
  const sides = 5 + Math.floor(rnd() * 3);
  for (let ring = 0; ring < 2; ring++) {
    for (let i = 0; i < sides; i++) {
      const angle = i / sides * Math.PI * 2;
      const x = Math.cos(angle) * width;
      const z = Math.sin(angle) * (0.55 + rnd() * 0.15);
      // Each end is a coherent oblique fracture plane, not a radial rock jitter.
      points.push(new THREE.Vector3(x + ring * 0.12, (ring - 0.5) * length + x * (ring ? 0.7 : -0.3), z));
    }
  }
  const g = new ConvexGeometry(points);
  g.center();
  const radius = boundRadius(g);
  g.scale(1 / radius, 1 / radius, 1 / radius);
  g.computeVertexNormals();
  const pos = g.getAttribute("position"), normal = g.getAttribute("normal");
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const cleave = Math.abs(normal.getY(i));
    const value = 0.7 + cleave * 0.55;
    colors[i * 3] = value * 0.86;
    colors[i * 3 + 1] = value * 0.96;
    colors[i * 3 + 2] = value;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
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

/** Gaussian sample from two uniforms (Box-Muller). */
function gauss(rnd: () => number): number {
  const u = Math.max(1e-9, rnd()), v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185 * v);
}

const FAR = 1e6;

/**
 * Faceted asteroid belt: `shapes` base rocks, one InstancedMesh each plus an
 * instanced outline shell and instanced crease lines, slow per-instance tumble.
 * `centers`/`radii` expose every rock's bounding sphere for collision.
 *
 * Every rock is destructible (2026-09-04, Ethan: "blow apart asteroids"):
 * `damage()` takes hull points off a rock and, when it breaks, spawns fragments
 * from spare instance slots at the end of each shape's pool. Fragments fly,
 * tumble fast, keep colliding like rocks, and shrink away after `fragLife`.
 * Dead slots sit at `FAR` with radius 0, so every consumer's sphere test skips them for free.
 *
 * Layout (`clusters`/`band`): a share of the rocks pile into dense knots and a
 * ring band instead of an even scatter, so a belt has lanes, walls and open sky.
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
  /** 1 while the slot holds a rock or fragment */
  readonly alive: Uint8Array;
  /** hull points left */
  readonly hp: Float32Array;
  /** xyz velocity per slot; zero for belt rocks, set for fragments */
  readonly vel: Float32Array;
  /** seconds left for a fragment; 0 = a permanent belt rock */
  readonly ttl: Float32Array;
  /** 1 for fragments of a rock the player broke: an enemy they hit is the player's kill */
  readonly playerMade: Uint8Array;
  /** rocks broken by the player this session (HUD/stat) */
  broken = 0;
  private readonly meshes: THREE.InstancedMesh[] = [];
  private readonly shells: THREE.InstancedMesh[] = [];
  private readonly lines: THREE.LineSegments[] = [];
  /** instances submitted to the GPU after the last `cull()` (perf overlay / tests) */
  drawn = 0;
  private readonly quats: Float32Array;
  private readonly scales: Float32Array;
  private readonly rates: Float32Array;
  /** radius at spawn, for the fragment shrink-out */
  private readonly fullR: Float32Array;
  private readonly axes: Float32Array;
  /** fragment slots live in the last `frags` slots of each shape; a ring cursor per shape */
  private readonly frags: number;
  private readonly fragHead: number[] = [];

  constructor(o: AsteroidOptions) {
    const rnd = mulberry32(o.seed);
    const base = STYLES[o.style ?? "rock"];
    const style: StyleDef = { ...base, tints: o.tints ?? base.tints, bigChance: o.bigChance ?? base.bigChance, big: o.big ?? base.big, small: o.small ?? base.small };
    this.style = o.style ?? "rock";
    this.frags = o.frags ?? 40;
    const live = Math.ceil(o.count / o.shapes);
    const per = live + this.frags;
    this.per = per;
    this.count = per * o.shapes;
    this.centers = new Float32Array(this.count * 3);
    this.radii = new Float32Array(this.count);
    this.bounds = new Float32Array(o.shapes);
    this.alive = new Uint8Array(this.count);
    this.hp = new Float32Array(this.count);
    this.vel = new Float32Array(this.count * 3);
    this.ttl = new Float32Array(this.count);
    this.playerMade = new Uint8Array(this.count);
    this.quats = new Float32Array(this.count * 4);
    this.scales = new Float32Array(this.count);
    this.rates = new Float32Array(this.count);
    this.fullR = new Float32Array(this.count);
    this.axes = new Float32Array(this.count * 3);
    // layout: cluster centres sit in the middle of the annulus, never on the start
    const nClusters = o.clusters ?? (this.style === "rock" ? 0 : 6), clusterR = o.clusterR ?? 250;
    const clusterShare = nClusters > 0 ? o.clusterShare ?? 0.55 : 0;
    const bandShare = o.band !== undefined ? o.bandShare ?? 0.4 : 0;
    const bandW = o.bandW ?? 120;
    const cl: number[] = [];
    for (let c = 0; c < nClusters; c++) {
      const r = o.inner + (o.outer - o.inner) * (0.3 + 0.6 * rnd()), th = rnd() * Math.PI * 2;
      cl.push(r * Math.cos(th), (rnd() * 2 - 1) * o.thickness * 0.5, r * Math.sin(th));
    }
    // voids: pockets of empty space; a candidate that lands in one is re-rolled (a few tries, then kept)
    const nVoids = o.voids ?? 0, voidR = o.voidR ?? 220;
    const vd: number[] = [];
    for (let v = 0; v < nVoids; v++) {
      const r = o.inner + (o.outer - o.inner) * (0.25 + 0.65 * rnd()), th = rnd() * Math.PI * 2;
      vd.push(r * Math.cos(th), (rnd() * 2 - 1) * o.thickness * 0.4, r * Math.sin(th), voidR * (0.7 + 0.6 * rnd()));
    }
    const inVoid = (): boolean => {
      for (let v = 0; v < vd.length; v += 4) {
        const dx = _obj.position.x - vd[v]!, dy = _obj.position.y - vd[v + 1]!, dz = _obj.position.z - vd[v + 2]!, r = vd[v + 3]!;
        if (dx * dx + dy * dy + dz * dz < r * r) return true;
      }
      return false;
    };
    const place = (): void => {
      const u = rnd();
      if (u < clusterShare) {
        const k = Math.floor(rnd() * nClusters) * 3;
        _obj.position.set(cl[k]! + gauss(rnd) * clusterR * 0.5, cl[k + 1]! + gauss(rnd) * clusterR * 0.3, cl[k + 2]! + gauss(rnd) * clusterR * 0.5);
      } else if (u < clusterShare + bandShare) {
        const r = o.band! + (rnd() + rnd() - 1) * bandW, th = rnd() * Math.PI * 2;
        _obj.position.set(r * Math.cos(th), (rnd() * 2 - 1) * o.thickness * 0.35, r * Math.sin(th));
      } else {
        const r = o.inner + (o.outer - o.inner) * Math.sqrt(rnd());
        const th = rnd() * Math.PI * 2;
        _obj.position.set(r * Math.cos(th), (rnd() * 2 - 1) * o.thickness * (0.3 + 0.7 * rnd()), r * Math.sin(th));
      }
      // keep everything inside the annulus, and off the start
      const rr = Math.hypot(_obj.position.x, _obj.position.z);
      if (rr < o.inner) _obj.position.multiplyScalar(o.inner / Math.max(1, rr));
      else if (rr > o.outer) (_obj.position.x *= o.outer / rr), (_obj.position.z *= o.outer / rr);
    };
    for (let s = 0; s < o.shapes; s++) {
      const rock = style.geometry(s, rnd);
      this.planes.push(style.hull ? hullPlanes(rock) : facePlanes(rock));
      const bound = boundRadius(rock) * 1.02;
      this.bounds[s] = bound;
      const material = toonMaterial(style.tints[s % style.tints.length]!, { emissive: style.glow, emissiveIntensity: style.glowIntensity });
      material.vertexColors = rock.hasAttribute("color");
      const mesh = new THREE.InstancedMesh(rock, material, per);
      this.meshes.push(mesh);
      this.fragHead.push(0);
      for (let i = 0; i < per; i++) {
        const gi = s * per + i;
        if (i >= live) {
          // spare fragment slot: parked far away, invisible
          this.centers[gi * 3 + 1] = FAR;
          this.quats[gi * 4 + 3] = 1;
          continue;
        }
        for (let tries = 0; tries < 6; tries++) {
          place();
          if (!inVoid()) break;
        }
        _obj.quaternion.setFromEuler(new THREE.Euler(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28));
        // A few large identifiable remains anchor the smaller debris in each knot.
        const landmark = this.style !== "rock" && i === 0 && s < nClusters;
        if (landmark) {
          _obj.position.set(cl[s * 3]!, cl[s * 3 + 1]!, cl[s * 3 + 2]!);
          if (inVoid()) place();
        }
        const big = rnd() < style.bigChance || landmark;
        const scale = big ? style.big[0] + rnd() * style.big[1] : style.small[0] + rnd() * rnd() * style.small[1];
        this.centers.set([_obj.position.x, _obj.position.y, _obj.position.z], gi * 3);
        this.quats.set([_obj.quaternion.x, _obj.quaternion.y, _obj.quaternion.z, _obj.quaternion.w], gi * 4);
        this.scales[gi] = scale;
        this.radii[gi] = scale * bound;
        this.alive[gi] = 1;
        this.hp[gi] = this.radii[gi]! * T.rocks.hpPerMetre;
        this.rates[gi] = (0.03 + rnd() * 0.25) * (big ? 0.35 : 1) * style.tumble;
        _axis.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
        this.axes.set([_axis.x, _axis.y, _axis.z], gi * 3);
      }
      mesh.castShadow = false;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const shell = noEdge(new THREE.InstancedMesh(outlineGeometry(rock.getAttribute("position").array), outlineMaterial, per));
      shell.instanceMatrix = mesh.instanceMatrix;
      shell.frustumCulled = false;
      const lines = creaseLines(rock, mesh.instanceMatrix, per);
      this.shells.push(shell);
      this.lines.push(lines);
      this.group.add(mesh, shell, lines);
    }
    this.cull(null);
  }

  /**
   * Pack the rocks the camera can see into the front of each shape's instance buffer and draw
   * only those (2026-09-06 perf pass). The sim arrays keep their fixed `gi` layout; only the GPU
   * side is compacted, and only the used range is uploaded. A null camera draws everything, which
   * the inspect views and the first frame use. Rocks off-screen still collide and tumble.
   */
  cull(camera: THREE.Camera | null): void {
    if (camera) {
      _pv.multiplyMatrices(camera.projectionMatrix, _pv.copy(camera.matrixWorld).invert());
      _frustum.setFromProjectionMatrix(_pv);
    }
    const per = this.per;
    let drawn = 0;
    for (let s = 0; s < this.meshes.length; s++) {
      const mesh = this.meshes[s]!;
      let k = 0;
      for (let i = 0; i < per; i++) {
        const gi = s * per + i;
        if (!this.alive[gi]) continue;
        if (camera) {
          _sphere.center.set(this.centers[gi * 3]!, this.centers[gi * 3 + 1]!, this.centers[gi * 3 + 2]!);
          _sphere.radius = this.radii[gi]!;
          if (!_frustum.intersectsSphere(_sphere)) continue;
        }
        this.matrixAt(gi, _obj.matrix);
        mesh.setMatrixAt(k++, _obj.matrix);
      }
      mesh.count = k;
      this.shells[s]!.count = k;
      (this.lines[s]!.geometry as THREE.InstancedBufferGeometry).instanceCount = k;
      const attr = mesh.instanceMatrix;
      attr.clearUpdateRanges();
      if (k > 0) attr.addUpdateRange(0, k * 16);
      attr.needsUpdate = true;
      drawn += k;
    }
    this.drawn = drawn;
  }

  /** World matrix of rock `gi` (position, tumble, uniform scale). */
  matrixAt(gi: number, out: THREE.Matrix4): void {
    const s = this.scales[gi]!;
    _obj.position.set(this.centers[gi * 3]!, this.centers[gi * 3 + 1]!, this.centers[gi * 3 + 2]!);
    _obj.quaternion.set(this.quats[gi * 4]!, this.quats[gi * 4 + 1]!, this.quats[gi * 4 + 2]!, this.quats[gi * 4 + 3]!);
    out.compose(_obj.position, _obj.quaternion, _obj.scale.setScalar(s));
  }

  /** Take `amount` off rock `gi`; true when it broke. `dir` (any length) pushes the fragments along the shot. */
  damage(gi: number, amount: number, dir?: THREE.Vector3, byPlayer = true): boolean {
    if (!this.alive[gi]) return false;
    this.hp[gi] = this.hp[gi]! - amount;
    if (this.hp[gi]! > 0) return false;
    this.break(gi, dir, byPlayer);
    return true;
  }

  private break(gi: number, dir: THREE.Vector3 | undefined, byPlayer: boolean): void {
    const R = T.rocks;
    const radius = this.radii[gi]!, shape = Math.floor(gi / this.per);
    const cx = this.centers[gi * 3]!, cy = this.centers[gi * 3 + 1]!, cz = this.centers[gi * 3 + 2]!;
    const vx = this.vel[gi * 3]!, vy = this.vel[gi * 3 + 1]!, vz = this.vel[gi * 3 + 2]!;
    if (byPlayer) this.broken++;
    this.retire(gi);
    if (radius < R.fragMin) return;
    const n = Math.max(2, Math.min(6, Math.round(radius / R.fragPer)));
    if (dir) _v.copy(dir).normalize().multiplyScalar(R.fragPush);
    else _v.set(0, 0, 0);
    for (let k = 0; k < n; k++) {
      const slot = this.per - this.frags + (this.fragHead[shape]! % this.frags);
      this.fragHead[shape] = this.fragHead[shape]! + 1;
      const fi = shape * this.per + slot;
      _axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const fr = radius * R.fragScale * (0.75 + Math.random() * 0.5);
      this.centers.set([cx + _axis.x * radius * 0.5, cy + _axis.y * radius * 0.5, cz + _axis.z * radius * 0.5], fi * 3);
      const sp = R.fragSpeed * (0.6 + Math.random() * 0.8);
      this.vel.set([vx + _axis.x * sp + _v.x, vy + _axis.y * sp + _v.y, vz + _axis.z * sp + _v.z], fi * 3);
      _q.setFromEuler(new THREE.Euler(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28));
      this.quats.set([_q.x, _q.y, _q.z, _q.w], fi * 4);
      const bound = this.bounds[shape]!;
      this.scales[fi] = fr / bound;
      this.radii[fi] = fr;
      this.hp[fi] = fr * R.hpPerMetre;
      this.fullR[fi] = fr;
      this.ttl[fi] = R.fragLife * (0.8 + Math.random() * 0.4);
      this.alive[fi] = 1;
      this.playerMade[fi] = byPlayer ? 1 : 0;
      this.rates[fi] = (0.5 + Math.random()) * R.fragTumble;
      _axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      this.axes.set([_axis.x, _axis.y, _axis.z], fi * 3);
    }
  }

  /** Empty a slot: parked at FAR with radius 0 so no sphere test can reach it. */
  private retire(gi: number): void {
    this.alive[gi] = 0;
    this.radii[gi] = 0;
    this.scales[gi] = 0;
    this.ttl[gi] = 0;
    this.hp[gi] = 0;
    this.playerMade[gi] = 0;
    this.centers.set([0, FAR, 0], gi * 3);
    this.vel.set([0, 0, 0], gi * 3);
  }

  tick(dt: number): void {
    const N = this.count;
    for (let gi = 0; gi < N; gi++) {
      if (!this.alive[gi]) continue;
      _axis.set(this.axes[gi * 3]!, this.axes[gi * 3 + 1]!, this.axes[gi * 3 + 2]!);
      _q.setFromAxisAngle(_axis, this.rates[gi]! * dt);
      _obj.quaternion.set(this.quats[gi * 4]!, this.quats[gi * 4 + 1]!, this.quats[gi * 4 + 2]!, this.quats[gi * 4 + 3]!).premultiply(_q);
      const oq = _obj.quaternion;
      this.quats[gi * 4] = oq.x;
      this.quats[gi * 4 + 1] = oq.y;
      this.quats[gi * 4 + 2] = oq.z;
      this.quats[gi * 4 + 3] = oq.w;
      const t = this.ttl[gi]!;
      if (t > 0) {
        // a fragment: drift, then shrink out over the last half second
        this.centers[gi * 3] = this.centers[gi * 3]! + this.vel[gi * 3]! * dt;
        this.centers[gi * 3 + 1] = this.centers[gi * 3 + 1]! + this.vel[gi * 3 + 1]! * dt;
        this.centers[gi * 3 + 2] = this.centers[gi * 3 + 2]! + this.vel[gi * 3 + 2]! * dt;
        const left = t - dt;
        if (left <= 0) {
          this.retire(gi);
          continue;
        }
        this.ttl[gi] = left;
        if (left < 0.5) {
          const shape = Math.floor(gi / this.per), k = left / 0.5;
          const full = this.fullR[gi]!;
          this.radii[gi] = full * k;
          this.scales[gi] = (full * k) / this.bounds[shape]!;
        }
      }
    }
  }
}
