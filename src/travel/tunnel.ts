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
uniform float uT, uFade, uAspect, uEntry;
varying vec2 vUv;
void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  // A curved passage with restrained silver-blue ribs; the portal and tunnel share a palette.
  p -= vec2(sin(uT * .65), cos(uT * .47)) * .045;
  float r = max(length(p), .025);
  float a = atan(p.y, p.x);
  float depth = .55 / r - uT * 1.45;
  float ripple = sin(depth * 6.283 + sin(a * 5.0 + depth * .3) * .65);
  float bands = floor((ripple * .5 + .5) * 5.0) / 5.0;
  vec3 c = mix(vec3(.018, .055, .095), vec3(.22, .49, .67), bands);
  float ribs = pow(max(0.0, sin(a * 13.0 + depth * .2)), 18.0);
  c += vec3(.16, .35, .46) * ribs * smoothstep(.1, .7, r);
  c *= smoothstep(.018, .15, r);
  c += vec3(.4, .65, .8) * exp(-abs(r - .09) * 65.0);
  float iris = 1.0 - smoothstep(uEntry * (uAspect + 1.2), uEntry * (uAspect + 1.2) + .08, length(p));
  // Open a clear exit through the vanishing point instead of cross-fading two busy scenes together.
  float exitRadius = pow(1.0 - uFade, .9) * (uAspect + 1.3);
  float exitMask = smoothstep(exitRadius - .035, exitRadius + .035, length(p));
  gl_FragColor = vec4(c, iris * exitMask * step(.001, uEntry));
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
      uniforms: { uT: { value: 0 }, uFade: { value: 0 }, uAspect: { value: 1 }, uEntry: { value: 0 } },
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

  set entry(v: number) { this.mat.uniforms.uEntry!.value = v; }

  reset(): void { this.t = 0; this.entry = 0; this.fade = 0; }

  update(dt: number, aspect: number): void {
    if (!this.mesh.visible) return;
    this.t += dt;
    this.mat.uniforms.uT!.value = this.t;
    this.mat.uniforms.uAspect!.value = aspect;
  }
}
