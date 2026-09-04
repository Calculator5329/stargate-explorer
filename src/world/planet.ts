import * as THREE from "three";
import { T } from "@/core/tunables";
import { NOISE_GLSL } from "@/world/noise";
import { noEdge } from "@/render/layers";

export interface PlanetPalette {
  deep: number;
  shallow: number;
  low: number;
  mid: number;
  high: number;
  ice: number;
  rim: number;
}

export interface RingDef {
  inner: number;
  outer: number;
  tilt: number;
  color: number;
}

export interface PlanetOptions {
  radius: number;
  segments: number;
  seed: number;
  sunDir: THREE.Vector3;
  palette: PlanetPalette;
  ring?: RingDef;
}

/** Ethan's reference frame: orange land, two-tone blue sea, white caps, blue limb. */
export const PALETTE_DESERT: PlanetPalette = {
  deep: 0x163f8f,
  shallow: 0x2d6ccc,
  low: 0xe0a24a,
  mid: 0xc4762a,
  high: 0x84401a,
  ice: 0xf3efe6,
  rim: 0x5fb6ff,
};

const SURFACE_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vObj;
void main() {
  vObj = position;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Hard steps everywhere: land/sea, 3 land tones, 2 sea tones, 3 light steps.
const SURFACE_FRAG = /* glsl */ `
uniform vec3 uSunDir, uDeep, uShallow, uLow, uMid, uHigh, uIce;
uniform float uSeaLevel, uIceLine, uSeed;
varying vec3 vN;
varying vec3 vObj;
${NOISE_GLSL}
void main() {
  vec3 n = normalize(vObj);
  float h = fbm(n * 2.4 + vec3(uSeed)) * 1.6 - 0.8;
  float detail = fbm(n * 9.0 + vec3(uSeed * 1.7));
  float hh = h + 0.12 * (detail - 0.5);
  float land = step(uSeaLevel, hh);
  vec3 sea = mix(uDeep, uShallow, step(uSeaLevel - 0.16, hh));
  vec3 ground = mix(uLow, uMid, step(uSeaLevel + 0.13, hh));
  ground = mix(ground, uHigh, step(uSeaLevel + 0.30, hh));
  vec3 alb = mix(sea, ground, land);
  float ice = step(uIceLine, abs(n.y) + 0.06 * (detail - 0.5));
  alb = mix(alb, uIce, ice);
  float ndl = dot(normalize(vN), uSunDir);
  float lit = 0.12 + 0.38 * smoothstep(-0.03, 0.03, ndl) + 0.45 * smoothstep(0.36, 0.42, ndl);
  gl_FragColor = vec4(alb * lit, 1.0);
}`;

const ATMO_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vView;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

// Crisp limb line + a faint soft halo; both fade on the night side.
const ATMO_FRAG = /* glsl */ `
uniform vec3 uColor, uSunDir;
uniform float uStrength, uRimWidth;
varying vec3 vN;
varying vec3 vView;
void main() {
  float f = 1.0 - max(dot(vN, vView), 0.0);
  // shell is 1.02R, so the planet's own edge sits at f ≈ 0.80 on it; the line lives just outside that
  float line = smoothstep(0.81, 0.81 + uRimWidth * 0.25, f) - smoothstep(0.90, 0.90 + uRimWidth * 0.25, f);
  float halo = smoothstep(0.55, 0.95, f) * 0.12;
  float lit = 0.12 + 0.88 * smoothstep(-0.35, 0.25, dot(vN, uSunDir));
  gl_FragColor = vec4(uColor * (line * 0.9 + halo) * uStrength * lit, 1.0);
}`;

const RING_VERT = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const RING_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uInner, uOuter;
varying vec2 vP;
void main() {
  float r = (length(vP) - uInner) / (uOuter - uInner);
  float band = step(0.06, fract(r * 4.0 + 0.2)) * (0.55 + 0.45 * step(0.5, fract(r * 2.0)));
  float edge = step(0.0, r) * step(r, 1.0);
  gl_FragColor = vec4(uColor * 0.8, band * edge * 0.85);
}`;

/** Posterised planet (hard-edged continents, stepped light) with a crisp limb shell and an optional banded ring. */
export class Planet {
  readonly group = new THREE.Group();
  private readonly surfaceU;
  private readonly atmoU;

  constructor(o: PlanetOptions) {
    const p = o.palette;
    const c = (v: number) => ({ value: new THREE.Color(v) });
    this.surfaceU = {
      uSunDir: { value: o.sunDir },
      uSeaLevel: { value: T.planet.seaLevel },
      uIceLine: { value: T.planet.iceLine },
      uSeed: { value: o.seed },
      uDeep: c(p.deep),
      uShallow: c(p.shallow),
      uLow: c(p.low),
      uMid: c(p.mid),
      uHigh: c(p.high),
      uIce: c(p.ice),
    };
    const surface = new THREE.Mesh(
      new THREE.SphereGeometry(o.radius, o.segments, Math.max(8, o.segments >> 1)),
      new THREE.ShaderMaterial({ vertexShader: SURFACE_VERT, fragmentShader: SURFACE_FRAG, uniforms: this.surfaceU }),
    );
    this.atmoU = {
      uColor: c(p.rim),
      uSunDir: { value: o.sunDir },
      uStrength: { value: T.planet.atmosphereStrength },
      uRimWidth: { value: T.planet.rimWidth },
    };
    const atmo = noEdge(
      new THREE.Mesh(
        new THREE.SphereGeometry(o.radius * 1.02, o.segments, Math.max(8, o.segments >> 1)),
        new THREE.ShaderMaterial({
          vertexShader: ATMO_VERT,
          fragmentShader: ATMO_FRAG,
          uniforms: this.atmoU,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );
    this.group.add(surface, atmo);
    if (o.ring) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(o.ring.inner, o.ring.outer, 96, 1),
        new THREE.ShaderMaterial({
          vertexShader: RING_VERT,
          fragmentShader: RING_FRAG,
          uniforms: { uColor: c(o.ring.color), uInner: { value: o.ring.inner }, uOuter: { value: o.ring.outer } },
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.rotation.set(Math.PI / 2 + o.ring.tilt, 0, 0.3);
      this.group.add(ring);
    }
  }

  update(): void {
    this.surfaceU.uSeaLevel.value = T.planet.seaLevel;
    this.surfaceU.uIceLine.value = T.planet.iceLine;
    this.atmoU.uStrength.value = T.planet.atmosphereStrength;
    this.atmoU.uRimWidth.value = T.planet.rimWidth;
  }
}
