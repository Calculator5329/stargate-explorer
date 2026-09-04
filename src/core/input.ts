import { T, clamp } from "@/core/tunables";

/**
 * Pointer-lock mouse + keyboard. Mouse motion accumulates between sim ticks and
 * is folded into a self-centering virtual stick in `tick()`, so the flight
 * model only ever sees a [-1, 1] stick regardless of frame rate.
 *
 *   stick.x  +1 = nose right      stick.y  +1 = nose up
 *   roll     +1 = roll right (E)  -1 = roll left (Q)
 */
export class Input {
  readonly stick = { x: 0, y: 0 };
  throttleDelta = 0;
  roll = 0;
  boost = false;
  /** Tracked for M2; nothing consumes it yet. */
  fire = false;
  locked = false;

  private mdx = 0;
  private mdy = 0;
  private readonly keys = new Set<string>();

  constructor(el: HTMLElement, enabled = true) {
    if (!enabled) return;
    el.addEventListener("click", () => {
      if (!this.locked) el.requestPointerLock();
    });
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === el;
      if (!this.locked) this.mdx = this.mdy = 0;
    });
    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.mdx += e.movementX;
      this.mdy += e.movementY;
    });
    document.addEventListener("mousedown", (e) => {
      if (this.locked && e.button === 0) this.fire = true;
    });
    document.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.fire = false;
    });
    document.addEventListener("keydown", (e) => {
      if (e.code === "Backquote") return; // debug panel toggle, not flight input
      this.keys.add(e.code);
    });
    document.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
  }

  /** Once per sim tick: integrate mouse motion into the stick, decay it, read keys. */
  tick(dt: number): void {
    const f = T.flight;
    const decay = Math.exp(-f.stickReturn * dt);
    this.stick.x = clamp((this.stick.x + this.mdx * f.stickGain) * decay, -1, 1);
    this.stick.y = clamp((this.stick.y - this.mdy * f.stickGain) * decay, -1, 1);
    this.mdx = this.mdy = 0;

    const k = this.keys;
    this.throttleDelta = (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0);
    this.roll = (k.has("KeyE") ? 1 : 0) - (k.has("KeyQ") ? 1 : 0);
    this.boost = k.has("ShiftLeft") || k.has("ShiftRight");
  }
}
