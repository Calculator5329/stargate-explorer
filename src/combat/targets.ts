import type * as THREE from "three";
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
  /**
   * Optional exact hit test for a round that travelled a→b this tick (a missile passes its position twice).
   * Without it the `radius` sphere is the hit shape. The Ha'tak hull uses it: its bounding sphere swallowed
   * every round aimed at the shield nodes that sit inside it (Ethan, 2026-09-06: "the top three things, I
   * can't blow them up even after I've blown up everything else").
   */
  hits?(a: THREE.Vector3, b: THREE.Vector3): boolean;
}
