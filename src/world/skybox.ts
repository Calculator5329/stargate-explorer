import * as THREE from "three";
import { T } from "@/core/tunables";
import { NOISE_GLSL } from "@/world/noise";

export interface SkyPreset {
  base: THREE.Color;
  col1: THREE.Color;
  dir1: THREE.Vector3;
  col2: THREE.Color;
  dir2: THREE.Vector3;
  nebula: number;
}

const preset = (base: number, c1: number, d1: [number, number, number], c2: number, d2: [number, number, number], nebula: number): SkyPreset => ({
  base: new THREE.Color(base),
  col1: new THREE.Color(c1),
  dir1: new THREE.Vector3(...d1).normalize(),
  col2: new THREE.Color(c2),
  dir2: new THREE.Vector3(...d2).normalize(),
  nebula,
});

/** `?sky=abydos|deepSpace|chulak`. Placeholder franchise names, see DECISIONS.md. */
export const SKY_PRESETS = {
  abydos: preset(0x030204, 0x8c5220, [0.3, 0.2, 0.9], 0x145a66, [-0.7, -0.2, -0.4], 1.0),
  deepSpace: preset(0x010204, 0x1a2060, [0.2, 0.7, 0.1], 0x40144d, [-0.5, -0.3, 0.6], 0.7),
  chulak: preset(0x020402, 0x1f6630, [0.6, 0.1, 0.5], 0x805e18, [-0.3, 0.6, -0.6], 0.9),
} satisfies Record<string, SkyPreset>;
export type SkyName = keyof typeof SKY_PRESETS;

export function parseSkyPreset(v: string | null): SkyName {
  return v !== null && v in SKY_PRESETS ? (v as SkyName) : "abydos";
}

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const FRAG = /* glsl */ `
uniform vec3 uBase, uCol1, uCol2, uDir1, uDir2;
uniform float uNebula, uStars;
varying vec3 vDir;
${NOISE_GLSL}
// One star per grid cell above a brightness threshold; cells are on the unit sphere scaled up.
vec3 starLayer(vec3 d, float scale, float thresh, float size) {
  vec3 p = d * scale;
  vec3 c = floor(p);
  vec3 h = hash33(c);
  vec3 sp = c + 0.2 + h * 0.6;
  float dist = length(p - sp);
  float on = step(thresh, h.x) * (0.4 + 0.6 * hash31(c + 7.7));
  vec3 tint = mix(vec3(1.0, 0.88, 0.75), vec3(0.75, 0.86, 1.0), h.y);
  return tint * on * smoothstep(size, 0.0, dist);
}
void main() {
  vec3 d = normalize(vDir);
  float n1 = fbm(d * 2.3 + vec3(3.1));
  float n2 = fbm(d * 3.7 + vec3(-8.2, 1.4, 5.5));
  float m1 = smoothstep(-0.2, 0.9, dot(d, uDir1));
  float m2 = smoothstep(-0.1, 0.9, dot(d, uDir2));
  vec3 neb = uCol1 * pow(n1, 1.6) * m1 * 1.6 + uCol2 * pow(n2, 1.8) * m2 * 1.4;
  vec3 s = starLayer(d, 60.0, 0.82, 0.09) * 1.4
         + starLayer(d, 140.0, 0.90, 0.06) * 0.8
         + starLayer(d, 320.0, 0.94, 0.05) * 0.45;
  vec3 col = uBase + neb * uNebula + s * uStars * (1.0 + 0.5 * neb.r);
  gl_FragColor = vec4(col, 1.0);
}`;

/** Single-draw-call procedural sky: 3 star layers + 2 fbm nebula lobes. */
export class Skybox {
  readonly mesh: THREE.Mesh;
  private readonly u;

  constructor(name: SkyName) {
    const p = SKY_PRESETS[name];
    this.u = {
      uBase: { value: p.base },
      uCol1: { value: p.col1 },
      uDir1: { value: p.dir1 },
      uCol2: { value: p.col2 },
      uDir2: { value: p.dir2 },
      uNebula: { value: p.nebula },
      uStars: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.u,
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
    this.nebulaBase = p.nebula;
  }
  private readonly nebulaBase: number;

  update(): void {
    this.u.uNebula.value = this.nebulaBase * T.sky.nebulaStrength;
    this.u.uStars.value = T.sky.starDensity;
  }
}
