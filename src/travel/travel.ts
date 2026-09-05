import * as THREE from "three";
import { Tunnel } from "@/travel/tunnel";
import type { Audio } from "@/audio/audio";
import type { SystemDef } from "@/world/systems";
import { SYSTEMS } from "@/world/systems";
import { Gate, CHEVRON_T, BURST_T, CHEVRON_ORDER } from "@/travel/gate";
import { addressMarkup, scriptSvg, systemAddress } from "@/ui/glyphs";
import { noEdge } from "@/render/layers";

type Stage = "idle" | "dial" | "tunnel" | "arrive";

// Local presentation constants: this lane does not own core/tunables.ts.
const CHEVRONS = 7;
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
    this.gate.group.scale.setScalar(.012);
    scene.add(this.gate.group, this.tunnel.mesh);
  }

  /** a departure is in progress (dial or tunnel); a second depart() is ignored */
  get busy(): boolean {
    return this.stage === "dial" || this.stage === "tunnel";
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
    this.stage = "dial";
    this.t = 0;
    this.lit = 0;
    query.set("arrive", "1");
    this.dest = query.toString();
    this.nameEl.innerHTML = `${scriptSvg(system.name)}<span>${system.name}</span>`;
    const address = systemAddress(system.id);
    this.addressEl.innerHTML = addressMarkup(address);
    this.glyphEls.length = 0;
    this.glyphEls.push(...this.addressEl.querySelectorAll<HTMLElement>(".glyph"));
    this.gate.beginDial(address);
    this.tunnel.fade = 0;
    this.lineEl.textContent = "DIALING";
    for (const c of this.chevEls) c.classList.remove("on");
    this.el.classList.add("on");
    this.audio.ui();
  }

  /** Call once on load when the page was reached through a gate. */
  arrive(): void {
    this.gate.group.visible = false;
    this.el.classList.remove("on");
    this.stage = "arrive";
    this.t = 0;
    this.tunnel.fade = 1;
  }

  update(dt: number, cam: THREE.PerspectiveCamera): void {
    this.tunnel.update(dt, cam.aspect);
    if (this.gate.group.visible) {
      // Camera-space presentation using a scratch vector; +X remains port in the sim.
      // Fit the ring above the address console on narrow viewports as well.
      const distance = Math.max(1.65, .82 / (Math.tan(cam.fov * Math.PI / 360) * cam.aspect));
      _gateOffset.set(0, .10, -distance).applyQuaternion(cam.quaternion);
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
      if (this.t > CHEVRONS * CHEVRON_T + BURST_T) {
        this.stage = "tunnel";
        this.t = 0;
        this.audio.launch();
      }
    } else if (this.stage === "tunnel") {
      this.tunnel.fade = Math.min(1, this.t / 0.35);
      if (this.t > 0.5) {
        this.el.classList.remove("on");
        this.gate.group.visible = false;
      }
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

const _gateOffset = new THREE.Vector3();
const WORDS = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN"];

export function systemOf(id: string): SystemDef {
  return SYSTEMS.find((s) => s.id === id) ?? SYSTEMS[0]!;
}
