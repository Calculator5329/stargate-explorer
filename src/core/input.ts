import { T, clamp } from "@/core/tunables";
import { Scheme, type SchemeName } from "@/core/scheme";

/**
 * Pointer-lock mouse + keyboard. Mouse motion accumulates between sim ticks and
 * is folded into a self-centering virtual stick in `tick()`, so the flight
 * model only ever sees a [-1, 1] stick regardless of frame rate.
 *
 *   stick.x   +1 = nose right      stick.y  +1 = nose up
 *   roll      +1 = roll right (D)  -1 = roll left (A)
 *   barrel    ±1 for one tick when A or D is double-tapped
 *   pitchKey  W − S: throttle delta in classic, snap pull-up/dive in arcade
 *   space     Space held: drift in classic, brake in arcade
 *
 * Which meaning applies is `scheme` (C toggles it; see core/scheme.ts).
 */
export class Input {
  readonly stick = { x: 0, y: 0 };
  readonly scheme: Scheme;
  pitchKey = 0;
  roll = 0;
  /** −1 / +1 on the tick a double-tap lands, else 0 */
  barrel = 0;
  space = false;
  boost = false;
  /** LMB held (only while pointer-locked) */
  fire = false;
  locked = false;

  private mdx = 0;
  private mdy = 0;
  private readonly keys = new Set<string>();
  private lastTap = { code: "", t: -1 };
  private pendingBarrel = 0;

  /**
   * `freeLock` (`?lock=free`) treats the pointer as locked from the first frame, so headless
   * captures and automated tests can fly and fire without a real pointer lock.
   */
  constructor(el: HTMLElement, scheme: SchemeName, enabled = true, freeLock = false) {
    this.scheme = new Scheme(scheme);
    if (!enabled) return;
    this.locked = freeLock;
    el.addEventListener("click", () => {
      if (!this.locked) el.requestPointerLock();
    });
    document.addEventListener("pointerlockchange", () => {
      if (freeLock) return;
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
      if (e.code === "Space") e.preventDefault();
      if (e.repeat) return;
      if (e.code === "KeyC") this.scheme.toggle();
      if (e.code === "KeyX") this.scheme.toggleAssist();
      if (e.code === "KeyA" || e.code === "KeyD") {
        const now = performance.now();
        if (this.lastTap.code === e.code && now - this.lastTap.t < T.flight.doubleTapMs) {
          this.pendingBarrel = e.code === "KeyD" ? 1 : -1;
          this.lastTap.t = -1;
        } else this.lastTap = { code: e.code, t: now };
      }
      this.keys.add(e.code);
    });
    document.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
  }

  /** Once per sim tick: integrate mouse motion into the stick, decay it, read keys. */
  tick(dt: number): void {
    const f = T.flight;
    this.scheme.sinceSwitch += dt;
    const decay = Math.exp(-f.stickReturn * dt);
    this.stick.x = clamp((this.stick.x + this.mdx * f.stickGain) * decay, -1, 1);
    this.stick.y = clamp((this.stick.y - this.mdy * f.stickGain) * decay, -1, 1);
    this.mdx = this.mdy = 0;

    const k = this.keys;
    this.pitchKey = (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0);
    this.roll = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0);
    this.space = k.has("Space");
    this.boost = k.has("ShiftLeft") || k.has("ShiftRight");
    this.barrel = this.pendingBarrel;
    this.pendingBarrel = 0;
  }
}
