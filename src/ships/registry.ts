import type { ShipDef } from "@/ships/defs";
import { PLAYER_HULL } from "@/ships/variants";
import { PROMETHEUS } from "@/ships/prometheus-def";
import { HEAVY } from "@/ships/heavy-def";
import { DART } from "@/ships/dart-def";
import { LANCER } from "@/ships/lancer-def";
import { GLIDER } from "@/combat/glider-def";

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
  heavy: { id: "heavy", def: HEAVY, stats: { speed: 0.88, agility: 0.7, hull: 2.2, guns: 1.6, missiles: 10, size: 1.35 }, blurb: "Heavy strike fighter. Slower and wider, twice the hull, heavier guns, ten missiles." },
  prometheus: { id: "prometheus", def: PROMETHEUS, stats: { speed: 0.7, agility: 0.45, hull: 6, guns: 2.2, missiles: 16, size: 5 }, blurb: "Deep-space carrier. Slow, armoured, heavy rail guns and a full magazine." },
  dart: { id: "dart", def: DART, stats: { speed: 1.25, agility: 1.3, hull: 0.55, guns: 0.85, missiles: 2, size: 0.8 }, blurb: "Light interceptor. Fastest thing in the hangar, turns on a coin, paper hull, two missiles." },
  lancer: { id: "lancer", def: LANCER, stats: { speed: 0.92, agility: 0.8, hull: 1.5, guns: 0.75, missiles: 18, size: 1.2 }, blurb: "Torpedo boat. Light guns, eighteen torpedoes in two tubes. Built for gunboats and motherships." },
  glider: { id: "glider", def: GLIDER, stats: { speed: 1.05, agility: 1.15, hull: 0.8, guns: 1.1, missiles: 0, size: 0.95 }, blurb: "Captured death glider, rewired. Quick and hard-hitting up close. No missiles; fly what they fly." },
};

/** Unlock hint for a locked hangar card: the mission that hands the hull over, or nothing when no mission does. */
export function unlockedBy(shipId: string, levels: readonly { id: string; title: string; unlocks?: string }[]): string | null {
  const l = levels.find((x) => x.unlocks === shipId);
  return l ? l.title.toLowerCase() : null;
}

export function parseShip(v: string | null): PlayerShip {
  return SHIPS[v ?? ""] ?? SHIPS.f11!;
}
