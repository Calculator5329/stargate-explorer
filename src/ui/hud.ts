/** DOM HUD: speed readout, throttle bar, click-to-fly hint. */
export class Hud {
  private readonly speedEl: HTMLElement;
  private readonly barEl: HTMLElement;
  private readonly hintEl: HTMLElement;
  private lastSpeed = -1;
  private lastThrottle = -1;

  constructor(root: HTMLElement) {
    this.speedEl = must(root.querySelector<HTMLElement>(".speed .v"));
    this.barEl = must(root.querySelector<HTMLElement>(".throttle > i"));
    this.hintEl = must(root.querySelector<HTMLElement>(".hint"));
  }

  hideHint(): void {
    this.hintEl.classList.add("hidden");
  }

  update(speed: number, throttle: number, locked: boolean): void {
    const s = Math.round(speed);
    if (s !== this.lastSpeed) {
      this.speedEl.textContent = String(s);
      this.lastSpeed = s;
    }
    if (throttle !== this.lastThrottle) {
      this.barEl.style.width = `${(throttle * 100).toFixed(1)}%`;
      this.lastThrottle = throttle;
    }
    this.hintEl.classList.toggle("hidden", locked);
  }
}

function must<T>(v: T | null): T {
  if (v === null) throw new Error("HUD element missing from index.html");
  return v;
}
