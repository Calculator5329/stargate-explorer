import * as THREE from "three";
import { T } from "@/core/tunables";
import type { EngineDef } from "@/ships/defs";
import { noEdge } from "@/render/layers";

const VERT = /* glsl */ `
uniform float uLength, uWidth;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  float t = -p.z;
  p.xy *= uWidth * mix(1.0, 0.3, t);
  p.z *= uLength;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

// Hard-edged chevron plume: V notches every third of the length, a white core that widens on boost.
const FRAG = /* glsl */ `
uniform vec3 uColor, uCore;
uniform float uBoost, uTime, uFlicker;
varying vec2 vUv;
void main() {
  float t = vUv.y;
  float x = abs(vUv.x - 0.5) * 2.0;
  float end = 1.0 - uFlicker * (0.5 + 0.5 * sin(uTime * 37.0 + t * 21.0));
  float body = step(t, end) * step(x, 1.0 - 0.12 * t);
  float chev = step(0.14, fract(t * 3.0 + x * 0.9));
  float core = step(x, 0.32 + 0.45 * uBoost) * step(t, 0.7 * end);
  vec3 col = mix(uColor, uCore, core);
  float a = body * chev;
  gl_FragColor = vec4(col * a, a);
}`;

/** Two crossed quads per engine, unit-sized; the vertex shader applies length and width. */
function crossQuads(): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const quad = (ax: number, ay: number) => {
    // corners: (−1,0) (1,0) (1,−1) (−1,−1) in (across, along)
    const c = [
      [-1, 0],
      [1, 0],
      [1, -1],
      [-1, -1],
    ] as const;
    const idx = [0, 1, 2, 0, 2, 3];
    for (const i of idx) {
      const [s, z] = c[i]!;
      pos.push(s * ax, s * ay, z);
      uv.push((s + 1) / 2, -z);
    }
  };
  quad(1, 0);
  quad(0, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/** Engine plumes for one ship: length follows throttle, boost adds a wide white core. */
export class Plume {
  readonly group = new THREE.Group();
  private readonly u;
  private length = 0;
  private time = 0;

  constructor(engines: EngineDef[], glow: number) {
    this.u = {
      uLength: { value: 1 },
      uWidth: { value: 1 },
      uColor: { value: new THREE.Color(glow).multiplyScalar(1.7) },
      uCore: { value: new THREE.Color(0xf4f8ff).multiplyScalar(2.2) },
      uBoost: { value: 0 },
      uTime: { value: 0 },
      uFlicker: { value: T.plume.flicker },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.u,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const geo = crossQuads();
    for (const e of engines) {
      const m = noEdge(new THREE.Mesh(geo, mat));
      m.position.set(e.pos[0], e.pos[1], e.pos[2] - e.length / 2 - 0.3);
      m.scale.set(e.radius, e.radius, 1); // length stays in metres
      m.frustumCulled = false;
      m.renderOrder = 5;
      this.group.add(m);
    }
  }

  update(dt: number, throttle: number, boost: boolean): void {
    this.time += dt;
    const p = T.plume;
    const target = boost ? p.boostLength : p.length * (0.35 + 0.65 * throttle);
    this.length += (target - this.length) * Math.min(1, dt * 6);
    this.u.uLength.value = this.length;
    this.u.uWidth.value = p.width;
    this.u.uFlicker.value = p.flicker;
    this.u.uTime.value = this.time;
    const b = this.u.uBoost.value as number;
    this.u.uBoost.value = b + ((boost ? 1 : 0) - b) * Math.min(1, dt * 8);
  }
}
