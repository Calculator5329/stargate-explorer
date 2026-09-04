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
  /** night-side tint (the dark side is coloured, not black) */
  night: number;
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
  /** Number of repeating latitude bands; omitted for continents. */
  bands?: number;
  /** Overrides the global sea level, including during debug-panel updates. */
  seaLevel?: number;
}

/** Ethan's 2026-09-04 reference frame: saturated orange land, two-tone blue sea, indigo night side, pale limb. No caps (T.planet.iceLine ≥ 1). */
export const PALETTE_DESERT: PlanetPalette = {
  deep: 0x1b3d9e,
  shallow: 0x2f66d8,
  low: 0xe4803a,
  mid: 0xc4602a,
  high: 0x8f3f1c,
  ice: 0xf3efe6,
  rim: 0x9fdcff,
  night: 0x2a1d5c,
};

/** A named planet: palette, noise seed, optional ring and surface overrides. Systems pick one; `?planet=<key>` previews it. */
export interface PlanetPreset {
  palette: PlanetPalette;
  seed: number;
  ring?: RingDef;
  /** Number of repeating latitude bands; omitted for continents. */
  bands?: number;
  /** Overrides the global sea level, including during debug-panel updates. */
  seaLevel?: number;
}

export const PLANET_PRESETS: Record<string, PlanetPreset> = {
  desert: { palette: PALETTE_DESERT, seed: 4.2 },
  ice: {
    palette: { deep: 0x071d52, shallow: 0x124eab, low: 0xf2faff, mid: 0x97dcff, high: 0x238fdf, ice: 0xffffff, rim: 0x52dfff, night: 0x102c63 },
    seed: 12.7,
  },
  lava: {
    palette: { deep: 0xe62d08, shallow: 0xff8c12, low: 0x171322, mid: 0x29203d, high: 0x49305c, ice: 0xffb52b, rim: 0xff510c, night: 0x410f2b },
    seed: 28.3,
  },
  jungle: {
    palette: { deep: 0x064b86, shallow: 0x08d8bd, low: 0x087c37, mid: 0x07532d, high: 0x123928, ice: 0xd5fff0, rim: 0x2cf5ca, night: 0x092f46 },
    seed: 43.9,
  },
  gasGiant: {
    palette: { deep: 0xa54512, shallow: 0xe88b16, low: 0xffc344, mid: 0xd66b13, high: 0x8b3216, ice: 0xffde83, rim: 0xffba38, night: 0x3d1d4f },
    seed: 61.4,
    bands: 7,
    seaLevel: -0.04,
    ring: { inner: 2300, outer: 3600, tilt: 0.38, color: 0xf6ac32 },
  },
  moon: {
    palette: { deep: 0x303746, shallow: 0x535e70, low: 0xbcc5cf, mid: 0x7c899d, high: 0x46536b, ice: 0xdbe4ed, rim: 0x779bd4, night: 0x201e42 },
    seed: 87.6,
    // fbm is nonnegative: hh cannot fall below -0.86.
    seaLevel: -1,
  },
};

export function parsePlanetPreset(v: string | null): string {
  return v !== null && v in PLANET_PRESETS ? v : "desert";
}

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
uniform vec3 uSunDir, uDeep, uShallow, uLow, uMid, uHigh, uIce, uNight;
uniform float uSeaLevel, uTerrainLevel, uIceLine, uSeed, uBands;
varying vec3 vN;
varying vec3 vObj;
${NOISE_GLSL}
void main() {
  vec3 n = normalize(vObj);
  float h = fbm(n * 2.4 + vec3(uSeed)) * 1.6 - 0.8;
  float detail = fbm(n * 9.0 + vec3(uSeed * 1.7));
  float hh = h + 0.12 * (detail - 0.5);
  if (uBands > 0.0) {
    // Latitude replaces terrain height; palette selection remains hard-stepped.
    hh = fract((n.y * 0.5 + 0.5) * uBands + uSeed) * 1.6 - 0.8;
  }
  float land = step(uSeaLevel, hh);
  vec3 sea = mix(uDeep, uShallow, step(uSeaLevel - 0.16, hh));
  vec3 ground = mix(uLow, uMid, step(uTerrainLevel + 0.13, hh));
  ground = mix(ground, uHigh, step(uTerrainLevel + 0.30, hh));
  vec3 alb = mix(sea, ground, land);
  float ice = step(uIceLine, abs(n.y) + 0.06 * (detail - 0.5));
  alb = mix(alb, uIce, ice);
  float ndl = dot(normalize(vN), uSunDir);
  float day = smoothstep(-0.03, 0.03, ndl);
  float lit = 0.5 + 0.45 * smoothstep(0.36, 0.42, ndl);
  vec3 night = uNight * mix(0.55, 0.9, land);
  gl_FragColor = vec4(mix(night, alb * lit, day), 1.0);
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
  private readonly seaLevel: number | undefined;

  constructor(o: PlanetOptions) {
    const p = o.palette;
    // Legacy callers forward palette/seed individually, so recover named defaults here.
    const preset = Object.values(PLANET_PRESETS).find((p) => p.palette === o.palette && p.seed === o.seed);
    this.seaLevel = o.seaLevel ?? preset?.seaLevel;
    const c = (v: number) => ({ value: new THREE.Color(v) });
    this.surfaceU = {
      uSunDir: { value: o.sunDir },
      uSeaLevel: { value: this.seaLevel ?? T.planet.seaLevel },
      uTerrainLevel: { value: T.planet.seaLevel },
      uBands: { value: o.bands ?? preset?.bands ?? 0 },
      uIceLine: { value: T.planet.iceLine },
      uSeed: { value: o.seed },
      uDeep: c(p.deep),
      uShallow: c(p.shallow),
      uLow: c(p.low),
      uMid: c(p.mid),
      uHigh: c(p.high),
      uIce: c(p.ice),
      uNight: c(p.night),
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
    this.surfaceU.uSeaLevel.value = this.seaLevel ?? T.planet.seaLevel;
    this.surfaceU.uTerrainLevel.value = T.planet.seaLevel;
    this.surfaceU.uIceLine.value = T.planet.iceLine;
    this.atmoU.uStrength.value = T.planet.atmosphereStrength;
    this.atmoU.uRimWidth.value = T.planet.rimWidth;
  }
}
