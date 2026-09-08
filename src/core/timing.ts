/**
 * Load-time attribution: how long a named step of the boot path took on the main thread.
 *
 * **CPU only.** WebGL is asynchronous, so wrapping a draw or a bake measures how long it took to hand
 * the commands to the driver, which is near zero, not how long the GPU spent on them. That was measured
 * on 2026-09-08: the sky and planet bakes, several hundred milliseconds of real work on a starved GPU,
 * both reported 0 ms through here. Use `Renderer.gpuMs` or `scripts/load-probe.mjs`'s long-task records
 * for anything the GPU does; use this only for work the main thread genuinely performs, which on the
 * boot path is building the sortie: the world's rock layout, the parametric ship, the mission graph.
 *
 * `window.__marks` exposes the list to headless scripts.
 */
export interface Mark {
  name: string;
  /** milliseconds since navigation start, when the step began */
  at: number;
  ms: number;
}

const marks: Mark[] = [];

export function timed<T>(name: string, fn: () => T): T {
  const at = performance.now();
  try {
    return fn();
  } finally {
    const ms = performance.now() - at;
    marks.push({ name, at: +at.toFixed(0), ms: +ms.toFixed(1) });
    if (marks.length > 200) marks.shift();
  }
}

export function marksSoFar(): readonly Mark[] {
  return marks;
}

if (typeof window !== "undefined") Object.assign(window, { __marks: marks });
