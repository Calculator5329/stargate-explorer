import type * as THREE from "three";
import { Tunnel } from "@/travel/tunnel";
import type { Audio } from "@/audio/audio";
import type { SystemDef } from "@/world/systems";
import { SYSTEMS } from "@/world/systems";

type Stage = "idle" | "dial" | "tunnel" | "arrive";

const CHEVRONS = 7;
const CHEVRON_T = 0.32;
const TUNNEL_T = 1.7;
const ARRIVE_T = 1.1;

/**
 * Gate travel between systems. `depart()` runs the dial (seven chevrons light
 * in turn on the DOM overlay) then the wormhole tunnel over the scene, then
 * reloads into the destination with `arrive=1`; on that load `arrive()` plays
 * the tunnel out so the reload reads as coming through the gate. The reload is
 * the system swap: a World is built once per page, deliberately.
 */
export class Travel {
  readonly tunnel = new Tunnel();
  private stage: Stage = "idle";
  private t = 0;
  private lit = 0;
  private dest = "";
  private readonly el: HTMLElement;
  private readonly chevEls: HTMLElement[] = [];
  private readonly lineEl: HTMLElement;
  private readonly nameEl: HTMLElement;

  constructor(root: HTMLElement, scene: THREE.Scene, private readonly audio: Audio) {
    this.el = root;
    const ring = root.querySelector<HTMLElement>(".ring")!;
    for (let k = 0; k < 9; k++) {
      const c = document.createElement("i");
      const a = -90 + k * 40;
      c.style.transform = `rotate(${a}deg) translateY(-92px)`;
      ring.appendChild(c);
      this.chevEls.push(c);
    }
    this.lineEl = root.querySelector<HTMLElement>(".line")!;
    this.nameEl = root.querySelector<HTMLElement>(".dest")!;
    scene.add(this.tunnel.mesh);
  }

  get busy(): boolean {
    return this.stage === "dial" || this.stage === "tunnel";
  }

  /** Dial `system`, then load `query` (a full search string without the `?`). */
  depart(system: SystemDef, query: URLSearchParams): void {
    if (this.busy) return;
    this.stage = "dial";
    this.t = 0;
    this.lit = 0;
    query.set("arrive", "1");
    this.dest = query.toString();
    this.nameEl.textContent = system.name;
    this.lineEl.textContent = "DIALING";
    for (const c of this.chevEls) c.classList.remove("on");
    this.el.classList.add("on");
    this.audio.ui();
  }

  /** Call once on load when the page was reached through a gate. */
  arrive(): void {
    this.stage = "arrive";
    this.t = 0;
    this.tunnel.fade = 1;
  }

  update(dt: number, cam: THREE.PerspectiveCamera): void {
    this.tunnel.update(dt, cam.aspect);
    if (this.stage === "idle") return;
    this.t += dt;
    if (this.stage === "dial") {
      const want = Math.min(CHEVRONS, Math.floor(this.t / CHEVRON_T));
      while (this.lit < want) {
        this.chevEls[this.lit]!.classList.add("on");
        this.lit++;
        this.audio.ui();
        this.lineEl.textContent = this.lit < CHEVRONS ? `CHEVRON ${WORDS[this.lit]} ENCODED` : "CHEVRON SEVEN LOCKED";
      }
      if (this.t > CHEVRONS * CHEVRON_T + 0.5) {
        this.stage = "tunnel";
        this.t = 0;
        this.audio.launch();
      }
    } else if (this.stage === "tunnel") {
      this.tunnel.fade = Math.min(1, this.t / 0.35);
      if (this.t > 0.5) this.el.classList.remove("on");
      if (this.t > TUNNEL_T) {
        this.stage = "idle";
        location.search = this.dest;
      }
    } else {
      // arrive: hold, then the tunnel thins out
      this.tunnel.fade = Math.max(0, 1 - Math.max(0, this.t - 0.25) / (ARRIVE_T - 0.25));
      if (this.t > ARRIVE_T) this.stage = "idle";
    }
  }
}

const WORDS = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN"];

export function systemOf(id: string): SystemDef {
  return SYSTEMS.find((s) => s.id === id) ?? SYSTEMS[0]!;
}
