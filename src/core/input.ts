import { T, clamp } from "@/core/tunables";
import type { Scheme } from "@/core/scheme";
import { DEFAULT_BINDS, type Binds } from "@/core/binds";

/**
 * Pointer-lock mouse + keyboard, plus the first connected gamepad. Mouse motion
 * accumulates between sim ticks and is folded into a self-centering virtual stick
 * in `tick()`, so the flight model only ever sees a [-1, 1] stick regardless of
 * frame rate. A pad's left stick writes that same stick directly.
 *
 *   stick.x   +1 = nose right      stick.y  +1 = nose up
 *   roll      +1 = roll right (D)  -1 = roll left (A)
 *   barrel    ±1 for one tick when A or D is double-tapped (or a bumper is hit)
 *   pitchKey  W − S: throttle delta in classic, snap pull-up/dive in arcade
 *   space     Space held: drift in classic, brake in arcade
 *
 * Which meaning applies is `scheme` (C toggles it; see core/scheme.ts). Which
 * key does what is `binds` (core/binds.ts, the menu edits it).
 *
 * Gamepad (standard mapping): left stick steer, right stick X roll / Y pull-dive,
 * RT fire, LT missile, A boost, B brake, X scheme, Y assist, LB/RB barrel roll.
 */
export class Input {
  readonly stick = { x: 0, y: 0 };
  readonly scheme: Scheme;
  binds: Binds = { ...DEFAULT_BINDS };
  invertY = false;
  pitchKey = 0;
  roll = 0;
  /** −1 / +1 on the tick a double-tap lands, else 0 */
  barrel = 0;
  space = false;
  boost = false;
  /** LMB held (only while pointer-locked) */
  fire = false;
  /** RMB pressed this tick (edge), for the secondary */
  alt = false;
  private altPending = false;
  locked = false;
  /** mouse sensitivity multiplier on T.flight.stickGain (settings) */
  sens = 1;
  /** a gamepad has produced input since load (HUD swaps its hint) */
  padActive = false;

  private mdx = 0;
  private mdy = 0;
  private readonly keys = new Set<string>();
  private lastTap = { code: "", t: -1 };
  private pendingBarrel = 0;
  private padButtons: boolean[] = [];

  /**
   * `freeLock` (`?lock=free`) treats the pointer as locked from the first frame, so headless
   * captures and automated tests can fly and fire without a real pointer lock.
   */
  constructor(el: HTMLElement, scheme: Scheme, enabled = true, readonly freeLock = false) {
    this.scheme = scheme;
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
      if (this.locked && e.button === 2) this.altPending = true;
    });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.fire = false;
    });
    document.addEventListener("keydown", (e) => {
      if (e.code === "Backquote") return; // debug panel toggle, not flight input
      if (e.code === "Space" || e.code === "Tab") e.preventDefault();
      if (e.repeat) return;
      const b = this.binds;
      if (e.code === b.scheme) this.scheme.toggle();
      if (e.code === b.assist) this.scheme.toggleAssist();
      if (e.code === b.rollLeft || e.code === b.rollRight) {
        const now = performance.now();
        if (this.lastTap.code === e.code && now - this.lastTap.t < T.flight.doubleTapMs) {
          this.pendingBarrel = e.code === b.rollRight ? 1 : -1;
          this.lastTap.t = -1;
        } else this.lastTap = { code: e.code, t: now };
      }
      this.keys.add(e.code);
    });
    document.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
  }

  /** Once per sim tick: integrate mouse motion into the stick, decay it, read keys, poll the pad. */
  tick(dt: number): void {
    this.alt = this.altPending;
    this.altPending = false;
    const f = T.flight;
    this.scheme.sinceSwitch += dt;
    const decay = Math.exp(-f.stickReturn * dt);
    const gain = f.stickGain * this.sens;
    const ySign = this.invertY ? 1 : -1;
    this.stick.x = clamp((this.stick.x + this.mdx * gain) * decay, -1, 1);
    this.stick.y = clamp((this.stick.y + ySign * this.mdy * gain) * decay, -1, 1);
    this.mdx = this.mdy = 0;

    const k = this.keys, b = this.binds;
    this.pitchKey = (k.has(b.pullUp) ? 1 : 0) - (k.has(b.dive) ? 1 : 0);
    this.roll = (k.has(b.rollRight) ? 1 : 0) - (k.has(b.rollLeft) ? 1 : 0);
    this.space = k.has(b.brake);
    this.boost = k.has(b.boost) || (b.boost === "ShiftLeft" && k.has("ShiftRight"));
    this.barrel = this.pendingBarrel;
    this.pendingBarrel = 0;
    this.pollPad();
  }

  private pollPad(): void {
    const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : null;
    if (!pads) return;
    let pad: Gamepad | null = null;
    for (const p of pads) {
      if (!p || !p.connected) continue;
      if (!pad || (pad.mapping !== "standard" && p.mapping === "standard")) pad = p;
    }
    if (!pad) return;
    const f = T.flight, dead = f.padDead;
    const curve = (v: number): number => {
      const a = Math.abs(v);
      if (a < dead) return 0;
      const n = (a - dead) / (1 - dead);
      return Math.sign(v) * Math.pow(n, f.padCurve);
    };
    const ax = curve(pad.axes[0] ?? 0), ay = curve(pad.axes[1] ?? 0);
    const rx = curve(pad.axes[2] ?? 0), ry = curve(pad.axes[3] ?? 0);
    const btn = (i: number): boolean => pad.buttons[i]?.pressed ?? false;
    const prev = this.padButtons, now: boolean[] = [];
    for (let i = 0; i < 12; i++) now[i] = btn(i);
    const rose = (i: number): boolean => (now[i] ?? false) && !(prev[i] ?? false);
    this.padButtons = now;
    const any = ax !== 0 || ay !== 0 || rx !== 0 || ry !== 0 || now.some(Boolean);
    if (any) this.padActive = true;
    if (!this.padActive) return;
    // the pad stick writes the virtual stick directly (no decay: it self-centers on its own)
    if (ax !== 0) this.stick.x = ax;
    if (ay !== 0) this.stick.y = this.invertY ? ay : -ay;
    if (rx !== 0) this.roll = rx;
    if (ry !== 0) this.pitchKey = -ry;
    if (now[7]) this.fire = true;
    else if (prev[7]) this.fire = false;
    if (rose(6)) this.alt = true;
    if (now[0]) this.boost = true;
    if (now[1]) this.space = true;
    if (rose(2)) this.scheme.toggle();
    if (rose(3)) this.scheme.toggleAssist();
    if (rose(4)) this.barrel = -1;
    if (rose(5)) this.barrel = 1;
  }
}
