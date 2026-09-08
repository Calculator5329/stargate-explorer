import { T, clamp } from "@/core/tunables";
import type { Scheme, SteerMode } from "@/core/scheme";
import { DEFAULT_BINDS, type Binds } from "@/core/binds";
import { DEFAULT_MOVE_BINDS, type MoveBinds } from "@/core/move-binds";
import { MOVES, type MoveDef } from "@/sim/moves";
import type { MoveDir } from "@/sim/moves";

/** Ask for raw (unaccelerated) mouse motion when locking; a setting, so the menu can turn it off. */
let rawMouse = true;
export function setRawMouse(v: boolean): void {
  rawMouse = v;
}

/**
 * Pointer lock with `unadjustedMovement` (bypasses the OS pointer acceleration curve, which
 * otherwise multiplies straight into the turn rate). Chromium rejects the promise where raw
 * motion is unsupported; then, and on browsers that return nothing, fall back to a plain lock.
 */
export function lockPointer(el: HTMLElement): void {
  const p: unknown = rawMouse ? el.requestPointerLock({ unadjustedMovement: true }) : el.requestPointerLock();
  if (p instanceof Promise) p.catch(() => void el.requestPointerLock());
}

/** dead zone then a power curve, sign kept: pad sticks and the steer cursor share it */
function shape(v: number, dead: number, curve: number): number {
  const a = Math.abs(v);
  if (a < dead) return 0;
  return Math.sign(v) * Math.pow((a - dead) / (1 - dead), curve);
}

/**
 * Pointer-lock mouse + keyboard, plus the first connected gamepad. Mouse motion
 * accumulates between sim ticks and becomes a [-1, 1] stick in `tick()`, so the
 * flight model never sees pixels or frame rate. Two steer modes (`steer`, see
 * core/scheme.ts): `cursor` moves an on-screen aim cursor and the stick is its
 * offset (a still mouse holds a turn); `relative` pumps a self-centering stick
 * with mouse speed. A pad's left stick writes that same stick directly.
 *
 *   stick.x   +1 = nose right      stick.y  +1 = nose up
 *   roll      +1 = roll right (D)  -1 = roll left (A)
 *   barrel    ±1 for one tick when A or D is double-tapped (or a bumper is hit)
 *   pitchKey  W − S: throttle delta in classic, snap pull-up/dive in arcade
 *   space     Space held: drift in classic, brake in arcade
 *   move      the chord that landed this tick (`moveFired`): a trigger key from `moveKeys`, then a direction
 *             (the pull-up/dive/roll binds) inside the double-tap window, or the key alone once it closes
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
  /** strafe thrusters, -1 (starboard) .. 1 (port, +X) */
  strafe = 0;
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
  /** mouse sensitivity multiplier: on T.flight.stickGain (relative) or on cursor pixels per mouse pixel (cursor) */
  sens = 1;
  /** how the mouse steers (settings, `?steer=`) */
  steer: SteerMode = "cursor";
  /** cursor steer: aim cursor offset from screen centre in mouse pixels, clamped to T.flight.cursorRadius; +y is down */
  readonly cursor = { x: 0, y: 0 };
  /** a gamepad has produced input since load (HUD swaps its hint) */
  padActive = false;
  /** trigger keys that arm a move chord (sim/moves.ts `moveKeys`); content, so set from outside */
  moveKeys: Set<string> = new Set();
  moveBinds: MoveBinds = { ...DEFAULT_MOVE_BINDS };
  moveTable: readonly MoveDef[] = MOVES;
  /** true for the one tick a chord resolves; `move` then names it */
  moveFired = false;
  readonly move: { key: string; dir: MoveDir } = { key: "", dir: "none" };
  private armed = { key: "", t: -1 };
  private pendingMove = { key: "", dir: "none" as MoveDir, on: false };

  private mdx = 0;
  private mdy = 0;
  private readonly keys = new Set<string>();
  private lastTap = { code: "", t: -1 };
  private pendingBarrel = 0;
  private padButtons: boolean[] = [];
  private enabled = true;

  /** Scene changes discard held and queued flight actions, so a cinematic cannot queue a shot or manoeuvre. */
  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.keys.clear();
    this.fire = this.alt = this.altPending = this.boost = this.space = this.moveFired = false;
    this.pendingMove.on = false;
    this.armed.t = this.lastTap.t = -1;
    this.pendingBarrel = this.barrel = this.pitchKey = this.roll = this.strafe = 0;
    this.mdx = this.mdy = this.cursor.x = this.cursor.y = this.stick.x = this.stick.y = 0;
  }

  /**
   * `freeLock` (`?lock=free`) treats the pointer as locked from the first frame, so headless
   * captures and automated tests can fly and fire without a real pointer lock.
   */
  constructor(el: HTMLElement, scheme: Scheme, enabled = true, readonly freeLock = false) {
    this.scheme = scheme;
    if (!enabled) return;
    this.locked = freeLock;
    el.addEventListener("click", () => {
      if (!this.locked) lockPointer(el);
    });
    document.addEventListener("pointerlockchange", () => {
      if (freeLock) return;
      this.locked = document.pointerLockElement === el;
      if (!this.locked) this.mdx = this.mdy = 0;
    });
    document.addEventListener("mousemove", (e) => {
      if (!this.locked || !this.enabled) return;
      if (this.steer === "cursor") {
        // the aim cursor moves at mouse-event rate, not sim rate: integrating it at 60 Hz made the cursor
        // step visibly on a 144 Hz mouse/display and read as jitter (Ethan, 2026-09-06)
        const c = this.cursor, R = T.flight.cursorRadius;
        c.x = clamp(c.x + e.movementX * this.sens, -R, R);
        c.y = clamp(c.y + e.movementY * this.sens, -R, R);
      } else {
        this.mdx += e.movementX;
        this.mdy += e.movementY;
      }
    });
    document.addEventListener("mousedown", (e) => {
      if (!this.enabled) return;
      if (this.locked && e.button === 0) this.fire = true;
      if (this.locked && e.button === 2) this.altPending = true;
    });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.fire = false;
    });
    document.addEventListener("keydown", (e) => {
      if (!this.enabled) return;
      if (e.code === "Backquote") return; // debug panel toggle, not flight input
      if (e.code === "Space" || e.code === "Tab") e.preventDefault();
      if (e.repeat) return;
      const direct = this.moveTable.find(m => this.moveBinds[m.id] === e.code);
      if (direct) {
        e.preventDefault();
        this.armed.t = -1;
        this.fireMove(direct.trigger.key, direct.trigger.dir);
        return;
      }
      const b = this.binds;
      if (e.code === b.scheme) this.scheme.toggle();
      if (e.code === b.assist) this.scheme.toggleAssist();
      if (this.moveKeys.has(e.code)) {
        this.armed = { key: e.code, t: performance.now() };
        this.keys.add(e.code);
        return;
      }
      if (this.armed.t >= 0 && performance.now() - this.armed.t < T.flight.doubleTapMs) {
        // a direction inside the window completes the chord; the tap is the move's, not a roll or a pull
        const dir: MoveDir | null = e.code === b.pullUp ? "up" : e.code === b.dive ? "down" : e.code === b.rollLeft ? "left" : e.code === b.rollRight ? "right" : null;
        if (dir) {
          this.fireMove(this.armed.key, dir);
          this.armed.t = -1;
          this.lastTap.t = -1;
          return;
        }
      }
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

  private fireMove(key: string, dir: MoveDir): void {
    this.pendingMove.key = key;
    this.pendingMove.dir = dir;
    this.pendingMove.on = true;
  }

  /** Once per sim tick: integrate mouse motion into the stick, decay it, read keys, poll the pad. */
  tick(dt: number): void {
    this.alt = this.altPending;
    this.altPending = false;
    const f = T.flight;
    // a chord left open past the window is the plain move on its key; either way it lands for one tick
    if (this.armed.t >= 0 && performance.now() - this.armed.t >= f.doubleTapMs) {
      this.fireMove(this.armed.key, "none");
      this.armed.t = -1;
    }
    this.moveFired = this.pendingMove.on;
    if (this.pendingMove.on) {
      this.move.key = this.pendingMove.key;
      this.move.dir = this.pendingMove.dir;
      this.pendingMove.on = false;
    }
    this.scheme.sinceSwitch += dt;
    const ySign = this.invertY ? 1 : -1;
    if (this.steer === "cursor") {
      const c = this.cursor, R = f.cursorRadius;
      if (f.cursorReturn > 0) {
        const k = Math.exp(-f.cursorReturn * dt);
        c.x *= k;
        c.y *= k;
      }
      this.stick.x = shape(c.x / R, f.cursorDead, f.cursorCurve);
      this.stick.y = ySign * shape(c.y / R, f.cursorDead, f.cursorCurve);
    } else {
      const decay = Math.exp(-f.stickReturn * dt);
      const gain = f.stickGain * this.sens;
      this.stick.x = clamp((this.stick.x + this.mdx * gain) * decay, -1, 1);
      this.stick.y = clamp((this.stick.y + ySign * this.mdy * gain) * decay, -1, 1);
    }
    this.mdx = this.mdy = 0;

    const k = this.keys, b = this.binds;
    this.pitchKey = (k.has(b.pullUp) ? 1 : 0) - (k.has(b.dive) ? 1 : 0);
    this.roll = (k.has(b.rollRight) ? 1 : 0) - (k.has(b.rollLeft) ? 1 : 0);
    this.strafe = (k.has(b.strafeLeft) ? 1 : 0) - (k.has(b.strafeRight) ? 1 : 0);
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
    const f = T.flight;
    const curve = (v: number): number => shape(v, f.padDead, f.padCurve);
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
