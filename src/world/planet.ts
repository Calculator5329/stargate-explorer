import * as THREE from "three";
import { T } from "@/core/tunables";
import { NOISE_GLSL } from "@/world/noise";

export interface PlanetOptions {
  radius: number;
  segments: number;
  seed: number;
  sunDir: THREE.Vector3;
}

const SURFACE_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vObj;
void main() {
  vObj = position;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SURFACE_FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform float uSeaLevel, uIceLine, uSeed;
varying vec3 vN;
varying vec3 vObj;
${NOISE_GLSL}
void main() {
  vec3 n = normalize(vObj);
  float h = fbm(n * 2.6 + vec3(uSeed)) * 1.6 - 0.8;
  float ridge = fbm(n * 7.0 + vec3(uSeed * 1.7));
  float land = smoothstep(uSeaLevel - 0.01, uSeaLevel + 0.01, h);
  vec3 sea = mix(vec3(0.02, 0.08, 0.22), vec3(0.05, 0.25, 0.42), smoothstep(-0.5, uSeaLevel, h));
  vec3 ground = mix(vec3(0.16, 0.32, 0.12), vec3(0.45, 0.36, 0.24), smoothstep(uSeaLevel, uSeaLevel + 0.35, h));
  ground = mix(ground, vec3(0.9), smoothstep(0.32, 0.42, h));
  ground *= 0.85 + 0.3 * ridge;
  vec3 alb = mix(sea, ground, land);
  float ice = smoothstep(uIceLine, uIceLine + 0.06, abs(n.y) + 0.08 * ridge);
  alb = mix(alb, vec3(0.92, 0.95, 1.0), ice);
  float lit = smoothstep(-0.08, 0.25, dot(normalize(vN), uSunDir));
  gl_FragColor = vec4(alb * (0.03 + lit * 1.1), 1.0);
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

const ATMO_FRAG = /* glsl */ `
uniform vec3 uColor, uSunDir;
uniform float uStrength;
varying vec3 vN;
varying vec3 vView;
void main() {
  float f = pow(1.0 - max(dot(vN, vView), 0.0), 3.0);
  float lit = smoothstep(-0.3, 0.3, dot(vN, uSunDir));
  gl_FragColor = vec4(uColor * f * uStrength * lit, 1.0);
}`;

/** fbm land/sea + ice caps, lit by the sun direction, with a fresnel atmosphere shell. */
export class Planet {
  readonly group = new THREE.Group();
  private readonly surfaceU;
  private readonly atmoU;

  constructor(o: PlanetOptions) {
    this.surfaceU = {
      uSunDir: { value: o.sunDir },
      uSeaLevel: { value: T.planet.seaLevel },
      uIceLine: { value: T.planet.iceLine },
      uSeed: { value: o.seed },
    };
    const surface = new THREE.Mesh(
      new THREE.SphereGeometry(o.radius, o.segments, Math.max(8, o.segments >> 1)),
      new THREE.ShaderMaterial({ vertexShader: SURFACE_VERT, fragmentShader: SURFACE_FRAG, uniforms: this.surfaceU }),
    );
    this.atmoU = {
      uColor: { value: new THREE.Color(0x4f9cff) },
      uSunDir: { value: o.sunDir },
      uStrength: { value: T.planet.atmosphereStrength },
    };
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(o.radius * 1.04, o.segments, Math.max(8, o.segments >> 1)),
      new THREE.ShaderMaterial({
        vertexShader: ATMO_VERT,
        fragmentShader: ATMO_FRAG,
        uniforms: this.atmoU,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.group.add(surface, atmo);
  }

  update(): void {
    this.surfaceU.uSeaLevel.value = T.planet.seaLevel;
    this.surfaceU.uIceLine.value = T.planet.iceLine;
    this.atmoU.uStrength.value = T.planet.atmosphereStrength;
  }
}
