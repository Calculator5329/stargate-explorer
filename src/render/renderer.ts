import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { T } from "@/core/tunables";
import { EdgePass } from "@/render/edgepass";
import { GradePass, type Grade } from "@/render/gradepass";
import { updateToonRamp } from "@/render/toon";
import { updateOutlineUniforms } from "@/render/outline";
import { LAYER_NO_EDGE } from "@/render/layers";

export type Quality = "low" | "med" | "high";

export interface QualityTier {
  dpr: number;
  bloom: boolean;
  /** screen-space edge pass; off everywhere since 2026-09-03 (angle-dependent flicker on rocks), shells + baked lines outline instead */
  edges: boolean;
  /** shadow map size, 0 = off */
  shadows: number;
  msaa: number;
  planetSegments: number;
}

/** `?quality=` tiers. Low is the fallback for integrated GPUs. */
export const QUALITY = {
  low: { dpr: 1, bloom: false, edges: false, shadows: 0, msaa: 0, planetSegments: 32 },
  med: { dpr: 1.5, bloom: true, edges: false, shadows: 1024, msaa: 4, planetSegments: 64 },
  high: { dpr: 2, bloom: true, edges: false, shadows: 2048, msaa: 4, planetSegments: 96 },
} satisfies Record<Quality, QualityTier>;

export function parseQuality(v: string | null): Quality {
  return v === "low" || v === "high" ? v : "med";
}

const _size = new THREE.Vector2();

/**
 * WebGL renderer + post stack: RenderPass (MSAA, HalfFloat) → EdgePass →
 * UnrealBloom (HDR threshold, emissives only) → GradePass → OutputPass (ACES).
 */
export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(T.camera.fovBase, 1, 0.5, 30000);
  readonly composer: EffectComposer;
  readonly tier: QualityTier;
  private readonly bloom: UnrealBloomPass | null;
  private readonly edges: EdgePass | null;
  private readonly grade = new GradePass();
  private readonly output = new OutputPass();

  constructor(canvas: HTMLCanvasElement, quality: Quality) {
    const q = (this.tier = QUALITY[quality]);
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: q.msaa === 0, powerPreference: "high-performance" });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio, q.dpr));
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.info.autoReset = false; // the perf overlay reads whole-frame counts across passes
    this.gl.shadowMap.enabled = q.shadows > 0;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.camera.layers.enable(LAYER_NO_EDGE);

    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: q.msaa });
    this.composer = new EffectComposer(this.gl, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.edges = q.edges ? new EdgePass(this.scene, this.camera) : null;
    if (this.edges) this.composer.addPass(this.edges);
    this.bloom = q.bloom ? new UnrealBloomPass(new THREE.Vector2(1, 1), T.render.bloomStrength, T.render.bloomRadius, T.render.bloomThreshold) : null;
    if (this.bloom) this.composer.addPass(this.bloom);
    this.composer.addPass(this.grade);
    this.composer.addPass(this.output);

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  setGrade(g: Grade): void {
    this.grade.setGrade(g);
  }

  /** Black-on-white ship silhouette for the readability test (`&silhouette=1`). */
  setSilhouette(on: boolean): void {
    if (this.edges) this.edges.enabled = !on;
    if (this.bloom) this.bloom.enabled = !on;
    this.grade.enabled = !on;
    this.output.enabled = !on;
    this.scene.background = on ? new THREE.Color(0xffffff) : null;
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
    this.grade.sync();
    updateToonRamp();
    updateOutlineUniforms(this.camera, this.gl.getDrawingBufferSize(_size).y);
    this.composer.render();
  }
}
