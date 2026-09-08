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

/** Resolution floor for the dynamic-resolution controller. Below this the picture stops being worth it. */
const MIN_SCALE = 0.35;

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
  private adaptT = -1.2; // the first frames are load hitches, not a verdict
  private goodT = 0;
  /** frame times in milliseconds since the last adaptation reading; `nearlyWorst()` judges them */
  private readonly frameMs: number[] = [];
  /** 0 = every effect on, 1 = bloom dropped because the resolution floor was not enough (see `adapt`) */
  relief = 0;
  /** how many adaptation readings have been taken; 0 means we do not yet know what this machine can afford */
  private readings = 0;
  /** the bake size settled on after the first reading, 0 before it (see `bakeSize`) */
  private bakeLatch = 0;
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
    if (this.bloom) this.bloom.enabled = !on && this.relief === 0;
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
    return Math.max(0.35, d * this.scale);
  }

  /**
   * Once a frame: step the resolution scale on how long recent frames actually took. Coming down is
   * fast and proportional, going back up is slow and cautious, because a player notices ten seconds of
   * 30 fps far more than a slightly soft picture.
   *
   * It judges the **95th-percentile frame time of the window, with the single worst frame discarded**,
   * not the mean frame rate, and that choice is the point of the 2026-09-08 retune. Ethan's report was
   * "drops to 30 FPS sometimes", and a mean hides exactly that: frames alternating 16.7 and 33.3 ms
   * average to a respectable 40 fps while the picture visibly hitches. A mean is also wrecked from the
   * other side by the one-off load stall, which would otherwise cost resolution for the rest of the
   * sortie. Discarding the worst frame and reading the next worst answers the question the player is
   * actually asking, "how bad are my bad frames", while staying deaf to any single hitch: at the roughly
   * thirty frames in a window it catches one bad frame in ten and ignores one bad frame outright.
   *
   * The old controller waited three seconds, then stepped down 0.15 every 1.5 s to a floor of 0.55, so a
   * machine that needed the floor spent about nine seconds below rate first; on a GPU-starved proxy it
   * took ten seconds to reach 35 fps. It now takes its first reading at 0.6 s and jumps straight to the
   * scale the measurement implies, so one bad reading is enough. `implied/target` is the right ratio
   * because the cost this controller governs is fill, linear in pixels, while `scale` is linear in each
   * axis: hence the square root.
   *
   * The floor is 0.35 rather than 0.55, since a laptop that cannot hold 60 at 0.55 was previously left at
   * 30 with no further help. Scale is quantised to 0.05 so small corrections do not trigger a `resize()`,
   * which reallocates the composer and every bloom mip and is itself expensive on a weak GPU.
   *
   * `fps` is accepted but no longer consulted; it stays in the signature because the perf overlay and the
   * probes pass it, and because a frame-rate reading is the obvious thing for a caller to have to hand.
   */
  adapt(dt: number, _fps?: number): void {
    if (!this.dynamic) {
      if (this.scale !== 1) (this.scale = 1), this.resize();
      return;
    }
    if (this.frameMs.length < 600) this.frameMs.push(dt * 1000);
    this.adaptT += dt;
    const cooling = this.scale < 1;
    // react quickly while we are still above the rate we want, then settle
    if (this.adaptT < (cooling ? 1 : 0.6)) return;
    const window_ = this.adaptT;
    this.adaptT = 0;
    const slow = this.nearlyWorst();
    this.frameMs.length = 0;
    if (slow <= 0) return;
    this.readings++;
    const TARGET = 60;
    const implied = 1000 / slow;
    if (implied < 55) {
      // aim straight at the scale this frame time can afford, with a little headroom, in one step
      const want = this.quantise(this.scale * Math.sqrt(implied / TARGET) * 0.97);
      if (want < this.scale) {
        this.scale = want;
        this.goodT = 0;
        this.resize();
      } else if (this.scale <= MIN_SCALE) {
        this.goodT = 0;
        this.setRelief(1); // out of pixels to give: drop the effect rather than sit at 30 fps
      }
    } else if (implied >= 58 && (this.scale < 1 || this.relief > 0)) {
      // climb back only after a sustained good stretch, and one step at a time
      this.goodT += window_;
      if (this.goodT >= 4) {
        this.goodT = 0;
        if (this.relief > 0) this.setRelief(this.relief - 1); // effects come back first, then pixels
        else {
          this.scale = this.quantise(Math.min(1, this.scale + 0.05));
          this.resize();
        }
      }
    } else this.goodT = 0;
  }

  /**
   * Last resort, once the resolution floor is not enough: switch the bloom pass off, and switch it back on
   * before any resolution is given back.
   *
   * Bloom is the single largest fill cost of the medium and high tiers, five mip levels of separable blur
   * over the whole frame, and skipping the pass costs nothing to change: the pass is disabled, no scene
   * material is touched, so nothing relinks and the switch itself does not stutter. That is what rules out
   * the other obvious candidate, shadows, whose `shadowMap.enabled` is part of every program's cache key
   * and would relink the whole scene mid-fight, the exact stall `render/warmup.ts` exists to prevent.
   *
   * A machine that needs this looks worse than one that does not, and that is the intended trade: the
   * standing requirement for this game is a steady 60, and a plainer picture at 60 beats a pretty one at 30.
   */
  private setRelief(level: number): void {
    const want = Math.max(0, Math.min(1, level));
    if (want === this.relief) return;
    this.relief = want;
    if (this.bloom) this.bloom.enabled = want === 0;
  }

  /**
   * The 95th-percentile frame time of the window, never the single worst frame. Clamping the rank to
   * `n - 2` is what makes one load stall, one garbage collection or one alt-tab cost nothing: whatever
   * the window's worst frame was, the controller reads the one below it. Returns 0 for a window too
   * short to say anything.
   */
  private nearlyWorst(): number {
    const n = this.frameMs.length;
    if (n < 4) return 0;
    const sorted = this.frameMs.slice().sort((a, b) => a - b);
    return sorted[Math.min(n - 2, Math.ceil(0.95 * n) - 1)] ?? 0;
  }

  /**
   * Size for the one-off sky cube and planet surface bakes, which the world re-runs whenever this changes.
   *
   * The first bake happens inside the first rendered frame, before anything has measured the machine, and
   * at a tier's full size it is one of the most expensive things the game ever does: six cube faces plus an
   * equirect surface, all procedural shaders. So the first one is deliberately small, and the real size is
   * chosen once the resolution controller has a reading. A machine that reads low keeps a smaller sky for
   * the rest of the sortie, which is both the cheap thing and the honest one, because it is not resolving
   * that detail anyway.
   *
   * The second size is latched, not tracked. `World.update` re-bakes whenever this number changes, and the
   * controller's 0.05 steps straddle the power-of-two boundaries: a scale drifting between 0.70 and 0.75
   * would otherwise flip the medium tier between a 512 and a 1024 sky and re-bake six cube faces and an
   * equirect surface on each crossing, which is far more expensive than the sharper sky is worth.
   */
  bakeSize(): number {
    const full = this.tier.bakeSize;
    if (this.readings === 0) return Math.min(256, full);
    if (this.bakeLatch === 0) {
      const want = full * (this.dynamic ? this.scale : 1);
      const pow2 = 2 ** Math.round(Math.log2(Math.max(1, want)));
      this.bakeLatch = Math.max(256, Math.min(full, pow2));
    }
    return this.bakeLatch;
  }

  /** 0.05 steps between the floor and 1: fewer distinct scales means fewer `resize()` reallocations. */
  private quantise(v: number): number {
    return Math.min(1, Math.max(MIN_SCALE, Math.round(v * 20) / 20));
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
