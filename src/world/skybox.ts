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
  abydos: preset({ base: 0x09051a, c1: 0xe8712c, d1: [0.35, 0.15, 0.9], c2: 0x6a2bb0, d2: [-0.6, -0.1, 0.5], core: 0xffb08a, nebula: 1.0, grade: grade(0xf2ecff, 0xfff4e6) }),
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
uniform vec3 uBase, uCol1, uCol2, uCore, uDir1, uDir2, uBandN;
uniform float uNebula, uStars;
varying vec3 vDir;
${NOISE_GLSL}
// One star per grid cell above a brightness threshold (band lowers the
// threshold inside the milky-way band). Most stars are faint 1 px points with a
// warm/white/blue temperature spread; a few in the coarse layer are bright and
// carry a short 4-point flare. Sizes are chosen so no star is sub-pixel.
vec3 starLayer(vec3 d, float scale, float thresh, float size, float flare, float band) {
  vec3 p = d * scale;
  vec3 c = floor(p);
  vec3 h = hash33(c);
  vec3 sp = c + 0.1 + h * 0.8;
  vec3 off = p - sp;
  float dist = length(off);
  float bright = hash31(c + 7.7);
  float on = step(thresh - band, h.x);
  float mag = 0.12 + 0.88 * bright * bright * bright;
  float sz = size * (0.55 + 1.0 * bright * bright);
  vec3 tint = mix(mix(vec3(1.0, 0.80, 0.60), vec3(1.0, 0.97, 0.92), smoothstep(0.0, 0.45, h.y)), vec3(0.70, 0.80, 1.0), smoothstep(0.55, 1.0, h.y));
  float core = smoothstep(sz, sz * 0.25, dist);
  float big = step(0.94, bright) * flare;
  vec3 t1 = normalize(cross(d, vec3(0.0, 1.0, 0.0)));
  vec3 t2 = cross(d, t1);
  float fx = abs(dot(off, t1)), fy = abs(dot(off, t2));
  float cross4 = (smoothstep(sz * 3.2, 0.0, fx) * smoothstep(sz * 0.3, 0.0, fy)
                + smoothstep(sz * 3.2, 0.0, fy) * smoothstep(sz * 0.3, 0.0, fx)) * big * 0.45;
  return tint * on * mag * (core * (1.0 + 0.8 * big) + cross4);
}
float posterize(float x, float n) { return floor(clamp(x, 0.0, 0.999) * n) / (n - 1.0); }
void main() {
  vec3 d = normalize(vDir);
  float n1 = fbm(d * 2.1 + vec3(3.1));
  float n2 = fbm(d * 3.1 + vec3(-8.2, 1.4, 5.5));
  float swirl = fbm(d * 5.5 + n1 * 1.8);
  float m1 = smoothstep(-0.3, 0.85, dot(d, uDir1));
  float m2 = smoothstep(-0.2, 0.85, dot(d, uDir2));
  // Ethan's 2026-09-04 reference: broad soft clouds with a painterly stipple, a few hard bands
  // inside them, and a dim violet wash so the sky never drops to pure black near a lobe.
  float a = clamp((n1 - 0.51 + 0.10 * swirl) * 3.8, 0.0, 1.0) * m1;
  float b = clamp((n2 - 0.49 + 0.08 * swirl) * 3.6, 0.0, 1.0) * m2;
  float pa = mix(posterize(a, 5.0), a, 0.65);
  float pb = mix(posterize(b, 5.0), b, 0.65);
  float hot = posterize(min(a, b) * 1.4, 3.0);
  float fine = vnoise(d * 160.0) + 0.5 * vnoise(d * 330.0 + 3.0);
  float grain = 0.80 + 0.20 * swirl + 0.16 * (fine - 0.75);
  vec3 wash = (uCol2 * m2 * (0.35 + 0.65 * n2) * 0.14 + uCol1 * m1 * n1 * 0.02);
  vec3 neb = (uCol1 * mix(0.12, 0.9, pa) * smoothstep(0.02, 0.14, a) + uCol2 * mix(0.12, 0.85, pb) * smoothstep(0.02, 0.14, b)) * grain + uCore * hot * 0.28 + wash;
  neb = min(neb, vec3(0.92));
  float mw = exp(-pow(dot(d, uBandN), 2.0) * 20.0);
  vec3 s = starLayer(d, 45.0, 0.90, 0.10, 1.0, 0.0) * 1.5
         + starLayer(d, 120.0, 0.92, 0.22, 0.0, 0.06 * mw) * 0.9
         + starLayer(d, 300.0, 0.955, 0.45, 0.0, 0.12 * mw) * 0.5;
  vec3 haze = vec3(0.42, 0.48, 0.66) * mw * (0.045 + 0.04 * swirl);
  vec3 col = uBase + neb * uNebula + (s + haze) * uStars * (1.0 - 0.35 * (pa + pb));
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
      uBandN: { value: new THREE.Vector3(0.3, 0.85, 0.35).normalize() },
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
