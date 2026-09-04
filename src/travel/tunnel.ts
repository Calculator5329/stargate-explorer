import * as THREE from "three";
import { noEdge } from "@/render/layers";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// Posterised wormhole: three ring bands racing at the viewer, nine spoke streaks, a hot core. HDR whites so bloom takes them.
const FRAG = /* glsl */ `
uniform float uT, uFade, uAspect;
varying vec2 vUv;
void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  float r = length(p) + 1e-3;
  float a = atan(p.y, p.x);
  float depth = 0.35 / r - uT * 2.2;                 // rings fly outward = we fly in
  float band = floor(fract(depth) * 3.0);            // 3 hard steps per ring
  float spoke = step(0.55, fract(a * 9.0 / 6.2831853 + r * 1.5 - uT * 0.7));
  vec3 deep = vec3(0.05, 0.12, 0.45);
  vec3 mid = vec3(0.16, 0.42, 0.95);
  vec3 hot = vec3(1.4, 1.7, 2.2);
  vec3 c = band < 1.0 ? deep : (band < 2.0 ? mid : hot);
  c = mix(c, hot, spoke * 0.35);
  float core = smoothstep(0.32, 0.08, r);
  c = mix(c, hot * 1.3, floor(core * 3.0) / 3.0);
  gl_FragColor = vec4(c, uFade);
}`;

/**
 * Full-screen wormhole quad drawn over the scene while the gate carries the
 * ship between systems. `fade` is the only control: 0 hidden, 1 opaque.
 */
export class Tunnel {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;
  private t = 0;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uT: { value: 0 }, uFade: { value: 0 }, uAspect: { value: 1 } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = noEdge(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 999;
    this.mesh.visible = false;
  }

  set fade(v: number) {
    this.mat.uniforms.uFade!.value = v;
    this.mesh.visible = v > 0.002;
  }

  get fade(): number {
    return this.mat.uniforms.uFade!.value as number;
  }

  update(dt: number, aspect: number): void {
    if (!this.mesh.visible) return;
    this.t += dt;
    this.mat.uniforms.uT!.value = this.t;
    this.mat.uniforms.uAspect!.value = aspect;
  }
}
