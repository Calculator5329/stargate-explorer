import type { Flight } from "@/sim/flight";
import type { Input } from "@/core/input";
import { T } from "@/core/tunables";

const HINTS = {
  arcade: "click to fly · mouse steers · W pull up / S dive · A/D roll (double-tap: barrel roll) · Shift boost · Space brake · C classic controls · ` tuning",
  classic: "click to fly · mouse steers · W/S throttle · A/D roll (double-tap: barrel roll) · Space drift · Shift boost · C arcade controls · ` tuning",
};

/** DOM HUD: speed readout, throttle/speed bar, hint per control scheme, arena warning, hit flash. */
export class Hud {
  private readonly speedEl: HTMLElement;
  private readonly barEl: HTMLElement;
  private readonly hintEl: HTMLElement;
  private readonly warnEl: HTMLElement;
  private readonly flashEl: HTMLElement;
  private readonly schemeEl: HTMLElement;
  private lastSpeed = -1;
  private lastBar = -1;
  private lastScheme = "";

  constructor(root: HTMLElement) {
    this.speedEl = must(root.querySelector<HTMLElement>(".speed .v"));
    this.barEl = must(root.querySelector<HTMLElement>(".throttle > i"));
    this.hintEl = must(root.querySelector<HTMLElement>(".hint"));
    this.warnEl = must(root.querySelector<HTMLElement>(".warn"));
    this.flashEl = must(root.querySelector<HTMLElement>(".flash"));
    this.schemeEl = must(root.querySelector<HTMLElement>(".scheme"));
  }

  hideHint(): void {
    this.hintEl.classList.add("hidden");
  }

  update(flight: Flight, input: Input, outside: boolean): void {
    const scheme = input.scheme;
    if (scheme.name !== this.lastScheme) {
      this.lastScheme = scheme.name;
      this.hintEl.textContent = HINTS[scheme.name];
      this.schemeEl.textContent = `${scheme.name.toUpperCase()} CONTROLS`;
    }
    this.schemeEl.style.opacity = String(Math.max(0, Math.min(1, 2.5 - scheme.sinceSwitch)));
    this.warnEl.classList.toggle("hidden", !outside);
    this.flashEl.style.opacity = String(Math.max(0, 0.55 - flight.sinceHit * 1.6));
    const s = Math.round(flight.speed);
    if (s !== this.lastSpeed) {
      this.speedEl.textContent = String(s);
      this.lastSpeed = s;
    }
    // classic: throttle setting; arcade: speed as a fraction of boost
    const bar = scheme.arcade ? flight.speed / T.flight.boostSpeed : flight.throttle;
    if (bar !== this.lastBar) {
      this.barEl.style.width = `${(Math.min(1, bar) * 100).toFixed(1)}%`;
      this.lastBar = bar;
    }
    this.hintEl.classList.toggle("hidden", input.locked);
  }
}

function must<T>(v: T | null): T {
  if (v === null) throw new Error("HUD element missing from index.html");
  return v;
}
