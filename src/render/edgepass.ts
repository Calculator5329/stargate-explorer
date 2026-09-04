import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { T } from "@/core/tunables";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
#include <packing>
uniform sampler2D tDiffuse, tNormal, tDepth;
uniform vec2 uTexel;
uniform float uNear, uFar, uWidth, uDepthT, uNormalT, uFadeNear, uFadeFar;
uniform vec3 uColor;
varying vec2 vUv;
float depthAt(vec2 uv) {
  return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar);
}
vec3 normalAt(vec2 uv) {
  return texture2D(tNormal, uv).xyz * 2.0 - 1.0;
}
void main() {
  vec4 col = texture2D(tDiffuse, vUv);
  vec2 o = uTexel * uWidth;
  float d0 = depthAt(vUv);
  vec3 n0 = normalAt(vUv);
  float dEdge = 0.0;
  float nEdge = 0.0;
  vec2 offs[4];
  offs[0] = vec2(o.x, 0.0); offs[1] = vec2(-o.x, 0.0); offs[2] = vec2(0.0, o.y); offs[3] = vec2(0.0, -o.y);
  for (int i = 0; i < 4; i++) {
    vec2 uv = vUv + offs[i];
    float d = depthAt(uv);
    dEdge = max(dEdge, abs(d - d0) / min(d, d0));
    nEdge = max(nEdge, 1.0 - dot(n0, normalAt(uv)));
  }
  float fade = 1.0 - smoothstep(uFadeNear, uFadeFar, d0);
  float e = max(step(uDepthT, dEdge), step(uNormalT, nEdge) * fade);
  gl_FragColor = vec4(mix(col.rgb, uColor, e), col.a);
}`;

/**
 * Screen-space outline pass. First renders layer 0 of the scene with a
 * MeshNormalMaterial override into a normal+depth target, then draws the
 * incoming colour buffer with a line wherever depth or normal changes hard.
 * Silhouettes (depth) never fade; creases (normal) fade with distance so far
 * asteroids don't turn into black blobs.
 */
export class EdgePass extends Pass {
  private readonly target: THREE.WebGLRenderTarget;
  private readonly normalMat = new THREE.MeshNormalMaterial({ blending: THREE.NoBlending });
  private readonly fsq: FullScreenQuad;
  private readonly u;
  private readonly clearColor = new THREE.Color();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
  ) {
    super();
    const depth = new THREE.DepthTexture(1, 1);
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      depthTexture: depth,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
    });
    this.u = {
      tDiffuse: { value: null as THREE.Texture | null },
      tNormal: { value: this.target.texture },
      tDepth: { value: depth },
      uTexel: { value: new THREE.Vector2(1, 1) },
      uNear: { value: camera.near },
      uFar: { value: camera.far },
      uWidth: { value: 1 },
      uDepthT: { value: 0.05 },
      uNormalT: { value: 0.45 },
      uFadeNear: { value: 500 },
      uFadeFar: { value: 4000 },
      uColor: { value: new THREE.Color(0x0a0a0c) },
    };
    this.fsq = new FullScreenQuad(new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.u }));
  }

  override setSize(w: number, h: number): void {
    this.target.setSize(w, h);
    this.u.uTexel.value.set(1 / w, 1 / h);
  }

  override render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    const prevMask = this.camera.layers.mask;
    const prevOverride = this.scene.overrideMaterial;
    const prevAlpha = renderer.getClearAlpha();
    renderer.getClearColor(this.clearColor);

    this.camera.layers.set(0);
    this.scene.overrideMaterial = this.normalMat;
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(0x808080, 1);
    renderer.clear();
    renderer.render(this.scene, this.camera);

    this.scene.overrideMaterial = prevOverride;
    this.camera.layers.mask = prevMask;
    renderer.setClearColor(this.clearColor, prevAlpha);

    const o = T.outline;
    this.u.tDiffuse.value = readBuffer.texture;
    this.u.uNear.value = this.camera.near;
    this.u.uFar.value = this.camera.far;
    this.u.uWidth.value = o.edgeWidth;
    this.u.uDepthT.value = o.depthThreshold;
    this.u.uNormalT.value = o.normalThreshold;
    this.u.uFadeNear.value = o.fadeNear;
    this.u.uFadeFar.value = o.fadeFar;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.clear) renderer.clear();
    this.fsq.render(renderer);
  }

  override dispose(): void {
    this.target.dispose();
    this.normalMat.dispose();
    this.fsq.dispose();
  }
}
