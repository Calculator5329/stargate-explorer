/**
 * Control scheme switch (Ethan, 2026-09-04: "have it as a switcher so we could
 * try this mode out and then potentially go back").
 *
 *   arcade   constant cruise speed; W = hard pull-up, S = hard dive; Shift boost; Space brake
 *   classic  W/S throttle; Space drift
 *
 * Mouse steering, A/D roll and the double-tap barrel roll are the same in both.
 * `?controls=classic|arcade` picks the start scheme, C toggles live.
 */
export type SchemeName = "arcade" | "classic";

export function parseScheme(v: string | null): SchemeName {
  return v === "classic" ? "classic" : "arcade";
}

export class Scheme {
  arcade: boolean;
  /** seconds since the last switch (HUD shows the new name briefly) */
  sinceSwitch = 99;

  constructor(name: SchemeName) {
    this.arcade = name === "arcade";
  }

  get name(): SchemeName {
    return this.arcade ? "arcade" : "classic";
  }

  toggle(): void {
    this.arcade = !this.arcade;
    this.sinceSwitch = 0;
  }
}
