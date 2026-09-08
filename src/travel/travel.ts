import * as THREE from "three";
import { Tunnel } from "@/travel/tunnel";
import type { Audio } from "@/audio/audio";
import type { SystemDef } from "@/world/systems";
import { SYSTEMS } from "@/world/systems";
import { Gate, CHEVRON_T, BURST_T, CHEVRON_ORDER } from "@/travel/gate";
import { addressMarkup, scriptSvg, systemAddress } from "@/ui/glyphs";
import { noEdge } from "@/render/layers";
import { T } from "@/core/tunables";
import "@/travel/travel.css";

type Stage = "idle" | "dial" | "opening" | "enter" | "tunnel" | "arrive";

// Local presentation constants: this lane does not own core/tunables.ts.
const CHEVRONS = 7;
/** into the tunnel, the world behind the wormhole is swapped at this point (fully covered) */
const SWAP_T = 0.6;

/**
 * Gate travel between systems. `depart()` runs the dial (seven chevrons light
 * in turn on the DOM overlay) then the wormhole tunnel over the scene; once the
 * tunnel covers everything `onSwap(query)` rebuilds the world behind it in the
 * same page (main.ts), the URL is rewritten to match, and the tunnel thins out
 * over the new system. Until 2026-09-06 the swap was a page reload, which cut
 * the audio mid-drone, dropped the pointer lock and put the start menu over the
 * arrival (Ethan: "the sound is bad and I still have text while I'm going
 * through the portal"). `arrive()` is still the entry for a page loaded with
 * `arrive=1` (a bookmark, the old links).
 */
export class Travel {
  readonly tunnel = new Tunnel();
  private readonly gate = new Gate();
  private stage: Stage = "idle";
  private t = 0;
  private lit = 0;
  private dest = "";
  private readonly el: HTMLElement;
  private readonly chevEls: HTMLElement[] = [];
  private readonly glyphEls: HTMLElement[] = [];
  private readonly addressEl: HTMLElement;
  private readonly lineEl: HTMLElement;
  private readonly nameEl: HTMLElement;
  private swapped = false;
  /** rebuild the game for `query` behind the wormhole; main.ts wires it */
  onSwap: ((query: URLSearchParams) => void) | null = null;
  /** the arrival fade finished */
  onArrived: (() => void) | null = null;
  private pendingQuery: URLSearchParams | null = null;
  /** Synchronous scene handoff: stop input, replay and live effects before the next sim tick. */
  onDepart: (() => void) | null = null;

  constructor(root: HTMLElement, scene: THREE.Scene, private readonly audio: Audio) {
    this.el = root;
    const ring = root.querySelector<HTMLElement>(".ring")!;
    for (let k = 0; k < 9; k++) {
      const c = document.createElement("i");
      ring.appendChild(c);
      this.chevEls.push(c);
    }
    this.addressEl = root.querySelector<HTMLElement>(".address")!;
    this.lineEl = root.querySelector<HTMLElement>(".line")!;
    this.nameEl = root.querySelector<HTMLElement>(".dest")!;
    const backing = noEdge(new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshBasicMaterial({ color: 0x0c1020 })));
    backing.position.z = -10;
    this.gate.group.add(backing);
    this.gate.group.scale.setScalar(T.travel.gateScale);
    scene.add(this.gate.group, this.tunnel.mesh);
  }

  /** a departure is in progress (dial or tunnel); a second depart() is ignored */
  get busy(): boolean {
    return this.holding;
  }

  get phase(): Stage { return this.stage; }
  get elapsed(): number { return this.t; }

  /** Reset the presentation when rebuilding a scene in the evaluation tools. */
  cancel(): void {
    this.stage = "idle";
    this.t = 0;
    this.pendingQuery = null;
    this.onArrived = null;
    this.gate.group.visible = false;
    this.tunnel.reset();
    this.el.classList.remove("on");
    this.el.dataset.phase = "idle";
  }

  /** Arrival reveals a prepared, stationary destination before flight resumes. */
  get reveal(): number { return this.stage === "idle" ? 1 : this.stage === "arrive" ? 1 - this.tunnel.fade : 0; }

  get gateGlow(): number {
    return this.stage === "opening" ? Math.sin(Math.min(1, this.t / BURST_T) * Math.PI) : this.stage === "enter" ? 1 : 0;
  }

  /**
   * The sim holds still while this is true: through the dial, the tunnel and the
   * arrival fade. Ethan, 2026-09-05: "it lets me start playing while it's dialing
   * ... the game starts before it should". Only the input ticks, so the aim cursor
   * can be placed but nothing moves and the mission clock does not start.
   */
  get holding(): boolean {
    return this.stage !== "idle";
  }

  /** Dial `system`, then load `query` (a full search string without the `?`). */
  depart(system: SystemDef, query: URLSearchParams): void {
    if (this.busy) return;
    this.onDepart?.();
    this.stage = "dial";
    this.t = 0;
    this.lit = 0;
    this.swapped = false;
    this.pendingQuery = query;
    this.dest = query.toString();
    this.nameEl.innerHTML = `${scriptSvg(system.name)}<span>${system.name}</span>`;
    const address = systemAddress(system.id);
    this.addressEl.innerHTML = addressMarkup(address);
    this.glyphEls.length = 0;
    this.glyphEls.push(...this.addressEl.querySelectorAll<HTMLElement>(".glyph"));
    this.gate.beginDial(address);
    this.gate.group.scale.setScalar(T.travel.gateScale);
    this.tunnel.reset();
    this.tunnel.fade = 0;
    this.lineEl.textContent = "DIALING";
    for (const c of this.chevEls) c.classList.remove("on");
    this.el.classList.add("on");
    this.audio.setScene("travel");
    this.el.dataset.phase = "dial";
  }

  /** Call once on load when the page was reached through a gate. */
  arrive(): void {
    this.gate.group.visible = false;
    this.el.classList.remove("on");
    this.stage = "arrive";
    this.t = 0;
    this.tunnel.fade = 1;
    this.tunnel.entry = 1;
    this.audio.setScene("travel");
    this.audio.wormhole(T.travel.arrivalSeconds);
  }

  update(dt: number, cam: THREE.PerspectiveCamera): void {
    this.tunnel.update(dt, cam.aspect);
    if (this.gate.group.visible) {
      // Camera-space presentation using a scratch vector; +X remains port in the sim.
      // Fit the ring above the address console on narrow viewports as well.
      const distance = Math.max(1.65, .82 / (Math.tan(cam.fov * Math.PI / 360) * cam.aspect));
      _gateOffset.set(0, 0, -distance).applyQuaternion(cam.quaternion);
      this.gate.group.position.copy(cam.position).add(_gateOffset);
      this.gate.group.quaternion.copy(cam.quaternion);
    }
    if (this.stage === "idle") return;
    this.t += dt;
    if (this.stage === "dial") {
      const want = Math.min(CHEVRONS, Math.floor(this.t / CHEVRON_T));
      while (this.lit < want) {
        this.chevEls[CHEVRON_ORDER[this.lit]!]!.classList.add("on");
        this.glyphEls[this.lit]!.classList.add("on");
        this.lit++;
        this.audio.chevron(this.lit, this.lit === CHEVRONS);
        this.lineEl.textContent = this.lit < CHEVRONS ? `CHEVRON ${WORDS[this.lit]} ENCODED` : "CHEVRON SEVEN LOCKED";
      }
      this.gate.setDial(this.t, this.lit);
      this.gate.render(0);
      if (this.t >= CHEVRONS * CHEVRON_T) {
        this.stage = "opening";
        this.t = 0;
        this.audio.kawoosh();
      }
    } else if (this.stage === "opening") {
      this.gate.setDial(CHEVRONS * CHEVRON_T + this.t, CHEVRONS);
      this.gate.render(0);
      if (this.t >= BURST_T) {
        this.stage = "enter";
        this.t = 0;
        this.el.classList.remove("on");
        this.tunnel.fade = 1;
        this.audio.wormhole(T.travel.entrySeconds + T.travel.tunnelSeconds + T.travel.arrivalSeconds);
      }
    } else if (this.stage === "enter") {
      const u = smooth(this.t / T.travel.entrySeconds);
      this.gate.group.scale.setScalar(T.travel.gateScale * (1 + T.travel.entryZoom * u));
      this.gate.setDial(CHEVRONS * CHEVRON_T + BURST_T + this.t, CHEVRONS);
      this.gate.render(0);
      this.tunnel.entry = smooth((u - 0.12) / 0.72);
      if (this.t >= T.travel.entrySeconds) {
        this.stage = "tunnel";
        this.t = 0;
        this.gate.group.visible = false;
        this.tunnel.entry = 1;
      }
    } else if (this.stage === "tunnel") {
      this.tunnel.fade = 1;
      if (this.t > SWAP_T && !this.swapped) {
        this.swapped = true;
        const q = this.pendingQuery;
        this.pendingQuery = null;
        if (q && this.onSwap) {
          history.replaceState(null, "", `?${this.dest}`);
          this.onSwap(q);
        } else location.search = this.dest; // no swap wired: the old reload path
      }
      if (this.t > T.travel.tunnelSeconds) {
        this.stage = "arrive";
        this.t = 0;
      }
    } else {
      // arrive: hold, then the tunnel thins out
      this.tunnel.fade = 1 - smooth((this.t - 0.2) / (T.travel.arrivalSeconds - 0.2));
      if (this.t > T.travel.arrivalSeconds) {
        this.stage = "idle";
        this.onArrived?.();
      }
    }
    this.el.dataset.phase = this.stage;
  }
}

function smooth(v: number): number { const u = Math.min(1, Math.max(0, v)); return u * u * (3 - 2 * u); }

const _gateOffset = new THREE.Vector3();
const WORDS = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN"];

export function systemOf(id: string): SystemDef {
  return SYSTEMS.find((s) => s.id === id) ?? SYSTEMS[0]!;
}
