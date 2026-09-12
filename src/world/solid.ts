import * as THREE from 'three';

/** First contact of a moving sphere: center at contact, outward normal and fraction along a→b. */
export interface SolidHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  fraction: number;
  /** Set by a field so damage can use the first contact without a second floating-point sweep. */
  solid?: Solid | undefined;
}

/** Mission geometry shared by ship collision, weapon occlusion and AI avoidance. */
export interface Solid {
  sweep(a: THREE.Vector3, b: THREE.Vector3, radius: number, hit: SolidHit): boolean;
}

export function solidHit(): SolidHit {
  return { point: new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0), fraction: 1 };
}

/** Find the first contact across a mission's actual surfaces without allocating per query. */
export class SolidField implements Solid {
  readonly items: Solid[] = [];
  private readonly candidate = solidHit();

  sweep(a: THREE.Vector3, b: THREE.Vector3, radius: number, hit: SolidHit): boolean {
    let found = false;
    hit.fraction = Infinity;
    hit.solid = undefined;
    for (const solid of this.items) {
      if (!solid.sweep(a, b, radius, this.candidate) || this.candidate.fraction >= hit.fraction) continue;
      found = true;
      hit.solid = solid;
      hit.fraction = this.candidate.fraction;
      hit.point.copy(this.candidate.point);
      hit.normal.copy(this.candidate.normal);
    }
    return found;
  }
}
