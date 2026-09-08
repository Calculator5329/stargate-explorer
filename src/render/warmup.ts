import * as THREE from "three";
import type { Renderer } from "@/render/renderer";

const _target = new THREE.WebGLRenderTarget(4, 4);
let _generation = 0;

/**
 * Shader warm-up (2026-09-08). Every material a sortie can show is linked, and drawn once, before play
 * instead of on the frame it first appears. Measured on the RTX 5070 Ti (`scripts/stutter-probe.mjs`):
 * a program that links mid-fight freezes the frame for 50-130 ms, because Three's first use of it calls
 * `getProgramInfoLog`, which waits for the driver to finish linking. A blockade sortie linked four of them
 * in its first fifteen seconds: the explosion pools, the tracer and fragment instancing variants, the sun
 * flare sprite, and the gate on the win frame. Those were the stutters Ethan saw at every quality tier.
 *
 * `compileAsync` links every material in the scene (hidden ones included) in the background through
 * KHR_parallel_shader_compile. The draw into a 4x4 target afterwards, with everything shown for that one
 * frame, makes the driver build its pipelines and the shadow-depth variants that `compile` does not cover.
 * It must be a render target: the real frames draw into the post stack's target, and tone mapping and the
 * output colour space are part of the program cache key, so a draw to the canvas links variants the real
 * frames never use (measured 2026-09-08: tracer, muzzle-flash and flare programs re-linked mid-fight, one
 * for 32 ms). Lights, and the groups holding them, keep their visibility for the same reason: the light
 * count is in the key, and the event-lighting group is hidden in play. Pools sit at count 0, so nothing is
 * actually drawn. Enemy hulls must already exist for this to reach
 * them: `Enemies.prewarm` builds the level's kinds first.
 */
export async function warmPrograms(r: Renderer): Promise<void> {
  const gen = ++_generation;
  const gl = r.gl, scene = r.scene, cam = r.camera;
  try {
    await gl.compileAsync(scene, cam);
  } catch {
    return; // a lost context: nothing to warm
  }
  if (gen !== _generation) return; // gate travel replaced the sortie; its own warm-up follows
  const keep = new Set<THREE.Object3D>();
  scene.traverse((o) => {
    if (!(o as THREE.Light).isLight) return;
    for (let p: THREE.Object3D | null = o; p; p = p.parent) keep.add(p);
  });
  const restore: { o: THREE.Object3D; visible: boolean; culled: boolean }[] = [];
  scene.traverse((o) => {
    if (keep.has(o)) return;
    restore.push({ o, visible: o.visible, culled: o.frustumCulled });
    o.visible = true;
    o.frustumCulled = false;
  });
  const prev = gl.getRenderTarget();
  gl.setRenderTarget(_target);
  gl.render(scene, cam);
  gl.setRenderTarget(prev);
  for (const e of restore) {
    e.o.visible = e.visible;
    e.o.frustumCulled = e.culled;
  }
}
