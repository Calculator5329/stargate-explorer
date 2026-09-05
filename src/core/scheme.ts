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

/**
 * How the mouse steers (Ethan, 2026-09-05: "kind of weird flying with the mouse").
 *   cursor    the mouse moves an aim cursor on screen; the nose turns toward it, faster the further out it sits.
 *             A still mouse holds a turn, OS acceleration barely matters, and the cursor shows where the nose is going.
 *   relative  the original: mouse *speed* pumps a self-centering stick, so a still mouse flies straight.
 */
export type SteerMode = "cursor" | "relative";

export function parseSteer(v: string | null | undefined): SteerMode {
  return v === "relative" ? "relative" : "cursor";
}

export function parseScheme(v: string | null): SchemeName {
  return v === "classic" ? "classic" : "arcade";
}

export class Scheme {
  arcade: boolean;
  /** seconds since the last switch (HUD shows the new name briefly) */
  sinceSwitch = 99;

  constructor(name: SchemeName, assist = true) {
    this.arcade = name === "arcade";
    this.assist = assist;
  }

  get name(): SchemeName {
    return this.arcade ? "arcade" : "classic";
  }

  /** flight assist: velocity follows the nose. Off = drift mode (X toggles). */
  assist: boolean;
  /** how hard assist works while on (0.2..1): scales `latDamp` and the soft-horizon `autoLevel` (Ethan, 2026-09-05: helps, "not quite as strong") */
  assistStrength = 1;
  toggleAssist(): void {
    this.assist = !this.assist;
    this.sinceSwitch = 0;
  }

  toggle(): void {
    this.arcade = !this.arcade;
    this.sinceSwitch = 0;
  }
}
