/** One owner for controls, camera, HUD and sound. Travel always finishes before another screen can take over. */
export type Presentation = "flight" | "travel" | "replay" | "paused" | "hub";

export function presentation(flags: { travel: boolean; paused: boolean; hub: boolean; replay: boolean }): Presentation {
  if (flags.travel) return "travel";
  if (flags.paused) return "paused";
  if (flags.hub) return "hub";
  return flags.replay ? "replay" : "flight";
}
