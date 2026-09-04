import type { ShipDef } from "@/ships/defs";
import { PLAYER_HULL } from "@/ships/variants";
import { PROMETHEUS } from "@/ships/prometheus-def";

/**
 * Flyable player hulls by id (`?ship=`), with the per-hull flight multipliers.
 * Stats scale the shared `T.flight` numbers so the tuning panel still rules.
 */
export interface ShipStats {
  /** cruise / max / boost speed multiplier */
  speed: number;
  /** pitch / yaw / roll rate multiplier */
  agility: number;
  /** max hull points multiplier */
  hull: number;
  /** cannon damage multiplier */
  guns: number;
  missiles: number;
  /** hull size relative to the fighter: scales the chase camera offset and the collision radius */
  size: number;
}

export interface PlayerShip {
  id: string;
  def: ShipDef;
  stats: ShipStats;
  /** one line for the hangar card */
  blurb: string;
}

export const SHIPS: Record<string, PlayerShip> = {
  f11: { id: "f11", def: PLAYER_HULL, stats: { speed: 1, agility: 1, hull: 1, guns: 1, missiles: 6, size: 1 }, blurb: "Space-superiority fighter. Fast, nimble, six missiles." },
  prometheus: { id: "prometheus", def: PROMETHEUS, stats: { speed: 0.7, agility: 0.45, hull: 6, guns: 2.2, missiles: 16, size: 5 }, blurb: "Deep-space carrier. Slow, armoured, heavy rail guns and a full magazine." },
};

export function parseShip(v: string | null): PlayerShip {
  return SHIPS[v ?? ""] ?? SHIPS.f11!;
}
