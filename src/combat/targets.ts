import type { Vector3 } from "three";

/** Anything the HUD can box, a missile can chase and the lock cone can pick. */
export interface Tracked {
  pos: Vector3;
  vel: Vector3;
  alive: boolean;
  /** hit radius, m */
  radius: number;
}

/** A Tracked that rounds and missiles can hurt. `damage` returns true when this hit destroyed it. */
export interface Lockable extends Tracked {
  damage(amount: number): boolean;
}
