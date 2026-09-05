import * as THREE from "three";
import type { Tracked } from "@/combat/targets";
import { glowMaterial, toonMaterial } from "@/render/toon";
import { noEdge } from "@/render/layers";
import { outlineShell } from "@/render/outline";
import { GLYPH_COUNT, glyphStrip, systemAddress } from "@/ui/glyphs";

// Local geometry/timing constants: this lane does not own core/tunables.ts.
export const GATE_RADIUS = 40;
export const CHEVRON_T = 0.32;
export const BURST_T = 0.5;
export const CHEVRON_ORDER = [1, 2, 3, 6, 7, 8, 0] as const;
const APERTURE = GATE_RADIUS - 6;
const TAU = Math.PI * 2;
const DEFAULT_ADDRESS = systemAddress("local-return");

const PUDDLE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
// Diffuse event horizon is entirely below 1.0 linear; only chevron inserts glow.
const PUDDLE_FRAG = /* glsl */ `
uniform float uT;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  float wave = sin(r * 48.0 - uT * 3.0 + sin(vUv.x * 19.0 + uT) * 1.8);
  float band = floor((wave * 0.5 + 0.5) * 3.0) / 3.0;
  vec3 c = mix(vec3(0.035, 0.10, 0.19), vec3(0.32, 0.58, 0.78), band);
  gl_FragColor = vec4(c, 0.96);
}`;

const BURST_VERT = /* glsl */ `
uniform float uBurst;
varying float vBand;
void main() {
  vec3 p = position;
  float r = length(p.xy) / 34.0;
  float envelope = sin(uBurst * 3.14159265);
  p.xy *= 0.85 + 0.15 * sin(r * 19.0 + uBurst * 8.0);
  p.z = pow(max(0.0, 1.0 - r), 1.4) * 60.0 * envelope;
  vBand = r;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const BURST_FRAG = /* glsl */ `
varying float vBand;
void main() {
  float band = floor(fract(vBand * 7.0) * 3.0) / 3.0;
  gl_FragColor = vec4(mix(vec3(0.12, 0.28, 0.46), vec3(0.62, 0.83, 0.95), band), 0.96);
}`;

/** Annulus with one horizontal texture cell per symbol. No per-frame texture redraw. */
function glyphBand(): THREE.BufferGeometry {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let i = 0; i <= GLYPH_COUNT; i++) {
    const a = i / GLYPH_COUNT * TAU;
    for (const r of [APERTURE + .8, GATE_RADIUS - .6]) positions.push(Math.cos(a) * r, Math.sin(a) * r, 0);
    // Texture tops point radially outward.
    uvs.push(i / GLYPH_COUNT, 0, i / GLYPH_COUNT, 1);
    if (i < GLYPH_COUNT) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices); g.computeVertexNormals();
  return g;
}

function chevronGeometry(inset: boolean): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const points = inset ? [[-2.6, 2.6], [0, .1], [2.6, 2.6], [2.6, .4], [0, -2.3], [-2.6, .4]] :
    [[-4.3, 4.5], [0, 1.5], [4.3, 4.5], [4.3, -.5], [0, -5], [-4.3, -.5]];
  points.forEach((p, i) => i ? shape.lineTo(p[0]!, p[1]!) : shape.moveTo(p[0]!, p[1]!));
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: inset ? .7 : 7, bevelEnabled: false });
}

/** Heavy ring gate shared by the return marker and the travel dial presentation. */
export class Gate implements Tracked {
  readonly group = new THREE.Group();
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  alive = false;
  readonly radius = GATE_RADIUS;
  readonly normal = new THREE.Vector3(0, 0, 1);
  private readonly puddle: THREE.ShaderMaterial;
  private readonly horizon: THREE.Mesh;
  private readonly rotor = new THREE.Group();
  private readonly burst: THREE.Mesh;
  private readonly burstMat: THREE.ShaderMaterial;
  private readonly chevrons: THREE.MeshBasicMaterial[] = [];
  private t = 0;
  private lastSide = 0;
  private controlled = false;
  private address: readonly number[] = DEFAULT_ADDRESS;

  constructor() {
    this.group.name = "ring-gate";
    const shape = new THREE.Shape();
    shape.absarc(0, 0, GATE_RADIUS + 3, 0, TAU, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, APERTURE, 0, TAU, true); shape.holes.push(hole);
    const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: 6, bevelEnabled: false, curveSegments: 52 });
    bodyGeo.translate(0, 0, -3);
    this.group.add(new THREE.Mesh(bodyGeo, toonMaterial(0x46505b)), outlineShell(bodyGeo.attributes.position!.array));
    for (const r of [GATE_RADIUS + 2.5, APERTURE + .2]) {
      const rail = new THREE.TorusGeometry(r, .75, 6, 78);
      for (const z of [-3.2, 3.2]) {
        const m = new THREE.Mesh(rail, toonMaterial(0x89929b)); m.position.z = z;
        this.group.add(m);
      }
    }
    this.rotor.name = "glyph-ring";
    const band = glyphBand();
    const bandMat = new THREE.MeshBasicMaterial({ map: glyphStrip(), color: 0xcfe9ff, side: THREE.DoubleSide });
    for (const sign of [-1, 1]) {
      const face = new THREE.Mesh(band, bandMat); face.position.z = sign * 3.15;
      // Mirror the back UV view physically so its writing remains readable.
      if (sign < 0) face.rotation.y = Math.PI;
      this.rotor.add(face);
    }
    this.group.add(this.rotor);
    const housing = chevronGeometry(false), insert = chevronGeometry(true);
    const metal = toonMaterial(0x59616a);
    for (let k = 0; k < 9; k++) {
      const a = Math.PI / 2 - k * TAU / 9;
      const unit = new THREE.Group(); unit.name = `chevron-${k}`;
      unit.position.set(Math.cos(a) * GATE_RADIUS, Math.sin(a) * GATE_RADIUS, -3.5);
      unit.rotation.z = a - Math.PI / 2;
      unit.add(new THREE.Mesh(housing, metal), outlineShell(housing.attributes.position!.array));
      const light = glowMaterial(0xffd9a8, .12);
      this.chevrons.push(light);
      for (const sign of [-1, 1]) {
        const m = noEdge(new THREE.Mesh(insert, light)); m.position.z = sign > 0 ? 7.1 : -.8;
        unit.add(m);
      }
      this.group.add(unit);
    }
    this.puddle = new THREE.ShaderMaterial({ vertexShader: PUDDLE_VERT, fragmentShader: PUDDLE_FRAG, uniforms: { uT: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.horizon = noEdge(new THREE.Mesh(new THREE.CircleGeometry(APERTURE, 78), this.puddle));
    this.group.add(this.horizon);
    this.burstMat = new THREE.ShaderMaterial({ vertexShader: BURST_VERT, fragmentShader: BURST_FRAG, uniforms: { uBurst: { value: 0 } }, side: THREE.DoubleSide });
    // Many radial rings let the vertex shader form a short unstable funnel.
    this.burst = noEdge(new THREE.Mesh(new THREE.RingGeometry(.01, APERTURE, 78, 16), this.burstMat));
    this.burst.frustumCulled = false;
    this.group.add(this.burst);
    this.group.visible = false;
  }

  /** Place a return gate. Its ring encodes automatically as it opens. */
  open(pos: THREE.Vector3, normal: THREE.Vector3): void {
    this.pos.copy(pos); this.normal.copy(normal).normalize();
    this.group.position.copy(pos); this.group.quaternion.setFromUnitVectors(_z, this.normal);
    this.group.visible = this.alive = true;
    this.lastSide = this.t = 0; this.controlled = false;
    this.applyDial(0, 0);
  }

  /** Travel owns the clock/audio; a return gate keeps its own visual clock. */
  beginDial(address: readonly number[]): void {
    this.address = address; this.controlled = true; this.t = 0;
    this.alive = this.group.visible = true; this.applyDial(0, 0);
  }

  setDial(elapsed: number, lit: number): void {
    this.t = elapsed; this.applyDial(elapsed, lit);
  }

  /** Same crossing semantics, either direction, now bounded by the visible aperture. */
  crossed(shipPos: THREE.Vector3): boolean {
    if (!this.alive) return false;
    _d.subVectors(shipPos, this.pos);
    const side = _d.dot(this.normal);
    const hit = this.lastSide !== 0 && Math.sign(side) !== Math.sign(this.lastSide) && _d.addScaledVector(this.normal, -side).lengthSq() < APERTURE ** 2;
    this.lastSide = side;
    return hit;
  }

  render(dt: number): void {
    if (!this.alive) return;
    if (!this.controlled) {
      this.t += dt;
      this.applyDial(this.t, Math.min(7, Math.floor(this.t / CHEVRON_T)));
    }
    this.puddle.uniforms.uT!.value = this.t;
  }

  private applyDial(elapsed: number, lit: number): void {
    const step = Math.min(lit, 6);
    const target = Math.PI / 2 - (this.address[step]! + .5) * TAU / GLYPH_COUNT;
    const previous = step === 0 ? 0 : Math.PI / 2 - (this.address[step - 1]! + .5) * TAU / GLYPH_COUNT;
    const direction = step % 2 === 0 ? 1 : -1;
    const distance = direction * (((direction * (target - previous)) % TAU + TAU) % TAU + TAU);
    const fraction = Math.min(1, Math.max(0, (elapsed / CHEVRON_T - step) / .8));
    this.rotor.rotation.z = lit >= 7 ? target : previous + distance * fraction * fraction * (3 - 2 * fraction);
    for (let k = 0; k < 9; k++) {
      const order = CHEVRON_ORDER.indexOf(k as typeof CHEVRON_ORDER[number]);
      this.chevrons[k]!.color.copy(_cream).multiplyScalar(order >= 0 && order < lit ? 1.7 : .12);
    }
    this.horizon.visible = lit >= 7;
    const burstTime = (elapsed - 7 * CHEVRON_T) / BURST_T;
    this.burst.visible = burstTime > 0 && burstTime < 1;
    this.burstMat.uniforms.uBurst!.value = Math.max(0, Math.min(1, burstTime));
  }
}

const _z = new THREE.Vector3(0, 0, 1);
const _d = new THREE.Vector3();
const _cream = new THREE.Color(0xffd9a8);
