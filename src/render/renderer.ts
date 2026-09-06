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
  /** drawing-buffer pixel cap: dpr is lowered until w*h*dpr² fits (a 4K display at "high" would otherwise render 33 MP) */
  maxPixels: number;
  /** cube face size of the baked sky, equirect width of the baked planet */
  bakeSize: number;
}

/** `?quality=` tiers. Low is the fallback for integrated GPUs. */
export const QUALITY = {
  low: { dpr: 1, bloom: false, edges: false, shadows: 0, msaa: 0, planetSegments: 32, maxPixels: 2.1e6, bakeSize: 512 },
  med: { dpr: 1.5, bloom: true, edges: false, shadows: 1024, msaa: 2, planetSegments: 64, maxPixels: 3.7e6, bakeSize: 1024 },
  high: { dpr: 2, bloom: true, edges: false, shadows: 2048, msaa: 4, planetSegments: 96, maxPixels: 8.3e6, bakeSize: 1024 },
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
  /** smoothed GPU time per frame from EXT_disjoint_timer_query_webgl2 (0 where the extension is missing) */
  gpuMs = 0;
  /** dynamic resolution: the drawing buffer shrinks in steps while the frame rate is under 50 and grows back once it holds 58+ */
  dynamic = true;
  /** current dynamic-resolution factor on the tier's pixel ratio, 0.55..1 */
  scale = 1;
  private adaptT = -3; // the first three seconds are load hitches, not a verdict
  private goodT = 0;
  private readonly timerExt: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  private readonly queries: WebGLQuery[] = [];

  constructor(canvas: HTMLCanvasElement, quality: Quality) {
    const q = (this.tier = QUALITY[quality]);
    // no canvas antialias: the composer's OutputPass draws one quad to the canvas, so default-framebuffer MSAA only cost memory
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.gl.setPixelRatio(this.pixelRatio());
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

    this.timerExt = this.gl.getContext().getExtension("EXT_disjoint_timer_query_webgl2");
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  /** Read back finished GPU queries (they complete a few frames late) and start one for this frame. */
  private beginGpuTimer(): void {
    const ext = this.timerExt;
    if (!ext) return;
    const gl = this.gl.getContext() as WebGL2RenderingContext;
    while (this.queries.length > 0) {
      const q = this.queries[0]!;
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT) as number;
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) this.gpuMs += (ns / 1e6 - this.gpuMs) * 0.1;
      gl.deleteQuery(this.queries.shift()!);
    }
    if (this.queries.length < 8) {
      const q = gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      this.queries.push(q);
    } else this.queries.push(null as unknown as WebGLQuery); // never happens in practice; keeps begin/end paired
  }

  private endGpuTimer(): void {
    const ext = this.timerExt;
    if (!ext || this.queries.length === 0) return;
    const gl = this.gl.getContext() as WebGL2RenderingContext;
    if (this.queries[this.queries.length - 1]) gl.endQuery(ext.TIME_ELAPSED_EXT);
    else this.queries.pop();
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

  /** the tier's pixel ratio, capped by the display, by `maxPixels`, and by the dynamic-resolution scale */
  pixelRatio(): number {
    const q = this.tier;
    let d = Math.min(window.devicePixelRatio || 1, q.dpr);
    const px = window.innerWidth * window.innerHeight * d * d;
    if (px > q.maxPixels) d *= Math.sqrt(q.maxPixels / px);
    return Math.max(0.5, d * this.scale);
  }

  /**
   * Once a frame: step the resolution scale on sustained frame-rate readings. Down by 0.15 per
   * 1.5 s window under 50 fps (floor 0.55); up by 0.1 after six seconds at 58+ (ceiling 1).
   * Hysteresis keeps it from hunting; the 60 Hz targets are deliberate (a 144 Hz display that
   * runs at 90 is not a problem to solve by blurring the picture).
   */
  adapt(dt: number, fps: number): void {
    if (!this.dynamic) {
      if (this.scale !== 1) (this.scale = 1), this.resize();
      return;
    }
    this.adaptT += dt;
    if (this.adaptT < 1.5) return;
    this.adaptT = 0;
    if (fps > 0 && fps < 50 && this.scale > 0.55) {
      this.scale = Math.max(0.55, +(this.scale - 0.15).toFixed(2));
      this.goodT = 0;
      this.resize();
    } else if (fps >= 58 && this.scale < 1) {
      this.goodT += 1.5;
      if (this.goodT >= 6) (this.goodT = 0), (this.scale = Math.min(1, +(this.scale + 0.1).toFixed(2))), this.resize();
    } else this.goodT = 0;
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w === 0 || h === 0) return; // hidden tab: a zero-size framebuffer only produces GL warnings
    const pr = this.pixelRatio();
    this.gl.setPixelRatio(pr);
    this.composer.setPixelRatio(pr);
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
    this.beginGpuTimer();
    this.composer.render();
    this.endGpuTimer();
  }
}
