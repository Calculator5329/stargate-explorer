/** Sim tick length. The sim never sees any other dt. */
export const TICK = 1 / 60;
const MAX_STEPS = 5;

export interface LoopHooks {
  sim(dt: number): void;
  /** alpha = fraction of the next tick already elapsed, for interpolation. */
  render(alpha: number, frameDt: number): void;
}

/**
 * Fixed-step sim, variable-rate render. Exposes smoothed timings for the perf
 * overlay: `simMs` is the whole sim phase of a frame (all steps), `renderMs`
 * the render hook.
 */
export class Loop {
  fps = 0;
  simMs = 0;
  renderMs = 0;

  private acc = 0;
  private last = 0;
  private raf = 0;
  private frames = 0;
  private fpsT = 0;

  constructor(private readonly hooks: LoopHooks) {}

  start(): void {
    this.acc = 0;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  private readonly frame = (now: number): void => {
    const dt = Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt;

    const t0 = performance.now();
    let steps = 0;
    while (this.acc >= TICK && steps < MAX_STEPS) {
      this.hooks.sim(TICK);
      this.acc -= TICK;
      steps++;
    }
    if (steps === MAX_STEPS) this.acc = 0; // fell too far behind: drop time rather than spiral
    const t1 = performance.now();
    this.hooks.render(this.acc / TICK, dt);
    const t2 = performance.now();

    this.simMs += (t1 - t0 - this.simMs) * 0.1;
    this.renderMs += (t2 - t1 - this.renderMs) * 0.1;
    this.frames++;
    this.fpsT += dt;
    if (this.fpsT >= 0.5) {
      this.fps = this.frames / this.fpsT;
      this.frames = 0;
      this.fpsT = 0;
    }
    this.raf = requestAnimationFrame(this.frame);
  };
}
