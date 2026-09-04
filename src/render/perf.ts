import type { WebGLInfo } from "three";
import type { Loop } from "@/core/loop";

/** fps / sim ms / render ms / draw calls / triangles, refreshed 4x a second. */
export class PerfOverlay {
  private t = 0;
  constructor(private readonly el: HTMLElement) {}

  update(dt: number, loop: Loop, info: WebGLInfo): void {
    this.t += dt;
    if (this.t < 0.25) return;
    this.t = 0;
    const r = info.render;
    this.el.textContent =
      `${loop.fps.toFixed(0)} fps\n` +
      `sim ${loop.simMs.toFixed(2)} ms\n` +
      `render ${loop.renderMs.toFixed(2)} ms\n` +
      `${r.calls} calls  ${(r.triangles / 1000).toFixed(1)}k tris`;
  }
}
