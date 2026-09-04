import * as THREE from "three";
import { T } from "@/core/tunables";
import { NOISE_GLSL } from "@/world/noise";
import { noEdge } from "@/render/layers";
import { grade, type Grade } from "@/render/gradepass";

export interface SkyPreset {
  base: THREE.Color;
  col1: THREE.Color;
  dir1: THREE.Vector3;
  col2: THREE.Color;
  dir2: THREE.Vector3;
  /** hot core where both lobes overlap */
  core: THREE.Color;
  nebula: number;
  grade: Grade;
}

interface PresetIn {
  base: number;
  c1: number;
  d1: [number, number, number];
  c2: number;
  d2: [number, number, number];
  core: number;
  nebula: number;
  grade: Grade;
}

const preset = (p: PresetIn): SkyPreset => ({
  base: new THREE.Color(p.base),
  col1: new THREE.Color(p.c1),
  dir1: new THREE.Vector3(...p.d1).normalize(),
  col2: new THREE.Color(p.c2),
  dir2: new THREE.Vector3(...p.d2).normalize(),
  core: new THREE.Color(p.core),
  nebula: p.nebula,
  grade: p.grade,
});

/** `?sky=abydos|deepSpace|chulak`. Placeholder franchise names, see DECISIONS.md. */
export const SKY_PRESETS = {
  // Ethan's reference frame: vivid orange + purple lobes, hot pink core.
  abydos: preset({ base: 0x06040a, c1: 0xe8712c, d1: [0.35, 0.15, 0.9], c2: 0x6a2bb0, d2: [-0.6, -0.1, 0.5], core: 0xffb08a, nebula: 1.0, grade: grade(0xf2ecff, 0xfff4e6) }),
  deepSpace: preset({ base: 0x020308, c1: 0x1e2c8a, d1: [0.2, 0.7, 0.1], c2: 0x4a1a6e, d2: [-0.5, -0.3, 0.6], core: 0x8fb4ff, nebula: 0.7, grade: grade(0xe8ecff, 0xf4f6ff) }),
  chulak: preset({ base: 0x030603, c1: 0x2b8a44, d1: [0.6, 0.1, 0.5], c2: 0xb07a20, d2: [-0.3, 0.6, -0.6], core: 0xe8ffb0, nebula: 0.9, grade: grade(0xecf5e6, 0xfff8dc) }),
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
uniform vec3 uBase, uCol1, uCol2, uCore, uDir1, uDir2;
uniform float uNebula, uStars;
varying vec3 vDir;
${NOISE_GLSL}
// One star per grid cell above a brightness threshold; the biggest layer gets a 4-point flare.
vec3 starLayer(vec3 d, float scale, float thresh, float size, float flare) {
  vec3 p = d * scale;
  vec3 c = floor(p);
  vec3 h = hash33(c);
  vec3 sp = c + 0.2 + h * 0.6;
  vec3 off = p - sp;
  float dist = length(off);
  float on = step(thresh, h.x) * (0.4 + 0.6 * hash31(c + 7.7));
  vec3 tint = mix(vec3(1.0, 0.88, 0.75), vec3(0.75, 0.86, 1.0), h.y);
  float core = smoothstep(size, size * 0.3, dist);
  vec3 t1 = normalize(cross(d, vec3(0.0, 1.0, 0.0)));
  vec3 t2 = cross(d, t1);
  float fx = abs(dot(off, t1)), fy = abs(dot(off, t2));
  float cross4 = (smoothstep(size * 4.0, 0.0, fx) * smoothstep(size * 0.35, 0.0, fy)
                + smoothstep(size * 4.0, 0.0, fy) * smoothstep(size * 0.35, 0.0, fx)) * flare * 0.55;
  return tint * on * (core + cross4);
}
float posterize(float x, float n) { return floor(clamp(x, 0.0, 0.999) * n) / (n - 1.0); }
void main() {
  vec3 d = normalize(vDir);
  float n1 = fbm(d * 2.1 + vec3(3.1));
  float n2 = fbm(d * 3.1 + vec3(-8.2, 1.4, 5.5));
  float swirl = fbm(d * 5.5 + n1 * 1.8);
  float m1 = smoothstep(-0.3, 0.85, dot(d, uDir1));
  float m2 = smoothstep(-0.2, 0.85, dot(d, uDir2));
  // sparse lobes: only the fbm peaks survive. Mostly banded (hard steps) with a little smooth
  // gradation underneath so the clouds read as lit volumes, not paper cut-outs.
  float a = clamp((n1 - 0.53 + 0.10 * swirl) * 4.5, 0.0, 1.0) * m1;
  float b = clamp((n2 - 0.55 + 0.08 * swirl) * 4.5, 0.0, 1.0) * m2;
  float pa = mix(posterize(a, 5.0), a, 0.35);
  float pb = mix(posterize(b, 5.0), b, 0.35);
  float hot = posterize(min(a, b) * 1.4, 3.0);
  float grain = 0.86 + 0.14 * swirl;
  vec3 neb = (uCol1 * mix(0.12, 0.9, pa) * step(0.06, a) + uCol2 * mix(0.12, 0.85, pb) * step(0.06, b)) * grain + uCore * hot * 0.45;
  neb = min(neb, vec3(0.92));
  vec3 s = starLayer(d, 55.0, 0.88, 0.10, 1.0) * 1.7
         + starLayer(d, 140.0, 0.93, 0.06, 0.0) * 0.8
         + starLayer(d, 330.0, 0.96, 0.05, 0.0) * 0.4;
  vec3 col = uBase + neb * uNebula + s * uStars * (1.0 - 0.35 * (pa + pb));
  gl_FragColor = vec4(col, 1.0);
}`;

/** Single-draw-call procedural sky: 3 star layers + 2 posterised fbm nebula lobes with a hot core. */
export class Skybox {
  readonly mesh: THREE.Mesh;
  private readonly u;
  private readonly nebulaBase: number;

  constructor(name: SkyName) {
    const p = SKY_PRESETS[name];
    this.u = {
      uBase: { value: p.base },
      uCol1: { value: p.col1 },
      uDir1: { value: p.dir1 },
      uCol2: { value: p.col2 },
      uDir2: { value: p.dir2 },
      uCore: { value: p.core },
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
    this.mesh = noEdge(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
    this.nebulaBase = p.nebula;
  }

  update(): void {
    this.u.uNebula.value = this.nebulaBase * T.sky.nebulaStrength;
    this.u.uStars.value = T.sky.starDensity;
  }
}
