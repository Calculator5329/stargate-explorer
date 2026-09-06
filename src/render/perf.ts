import type { WebGLInfo } from "three";
import type { Loop } from "@/core/loop";
import type { Renderer } from "@/render/renderer";

/** fps / sim ms / render ms / draw calls / triangles, refreshed 4x a second. */
export class PerfOverlay {
  private t = 0;
  constructor(private readonly el: HTMLElement) {}

  update(dt: number, loop: Loop, info: WebGLInfo, rend?: Renderer): void {
    this.t += dt;
    if (this.t < 0.25) return;
    this.t = 0;
    const r = info.render;
    this.el.textContent =
      `${loop.fps.toFixed(0)} fps\n` +
      `sim ${loop.simMs.toFixed(2)} ms\n` +
      `render ${loop.renderMs.toFixed(2)} ms\n` +
      (rend && rend.gpuMs > 0 ? `gpu ${rend.gpuMs.toFixed(2)} ms\n` : "") +
      (rend && rend.scale < 1 ? `res ${Math.round(rend.scale * 100)}%\n` : "") +
      `${r.calls} calls  ${(r.triangles / 1000).toFixed(1)}k tris`;
  }
}
