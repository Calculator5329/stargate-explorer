import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { T } from "@/core/tunables";

export type Quality = "low" | "med" | "high";

/** `?quality=` tiers. Low drops bloom and the DPR cap; planet tessellation scales too. */
export const QUALITY = {
  low: { dpr: 1, bloom: false, planetSegments: 32 },
  med: { dpr: 1.5, bloom: true, planetSegments: 64 },
  high: { dpr: 2, bloom: true, planetSegments: 96 },
} satisfies Record<Quality, { dpr: number; bloom: boolean; planetSegments: number }>;

export function parseQuality(v: string | null): Quality {
  return v === "low" || v === "high" ? v : "med";
}

/** WebGL renderer + post stack (ACES tone map, optional UnrealBloom). */
export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(T.camera.fovBase, 1, 0.5, 30000);
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass | null;

  constructor(canvas: HTMLCanvasElement, quality: Quality) {
    const q = QUALITY[quality];
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio, q.dpr));
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.info.autoReset = false; // the perf overlay reads whole-frame counts across passes

    this.composer = new EffectComposer(this.gl);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = q.bloom
      ? new UnrealBloomPass(new THREE.Vector2(1, 1), T.render.bloomStrength, T.render.bloomRadius, T.render.bloomThreshold)
      : null;
    if (this.bloom) this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w === 0 || h === 0) return; // hidden tab: a zero-size framebuffer only produces GL warnings
    this.gl.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.gl.toneMappingExposure = T.render.exposure;
    if (this.bloom) {
      this.bloom.strength = T.render.bloomStrength;
      this.bloom.radius = T.render.bloomRadius;
      this.bloom.threshold = T.render.bloomThreshold;
    }
    this.composer.render();
  }
}
