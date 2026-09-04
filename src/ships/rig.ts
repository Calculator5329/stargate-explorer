import * as THREE from "three";
import type { ShipDef } from "@/ships/defs";
import { buildShip } from "@/ships/builder";
import { Plume } from "@/fx/plume";

const SILHOUETTE_MAT = new THREE.MeshBasicMaterial({ color: 0x000000 });

/** A built ship plus its per-frame effects (plumes). `root` is what goes in the scene. */
export class ShipRig {
  readonly root: THREE.Group;
  readonly plume: Plume;

  constructor(def: ShipDef) {
    this.root = buildShip(def);
    this.plume = new Plume(def.engines, def.palette.glow, def.plumeScale ?? 1);
    this.root.add(this.plume.group);
  }

  update(dt: number, throttle: number, boost: boolean): void {
    this.plume.update(dt, throttle, boost);
  }

  /** Black shape only: no outlines, plumes or decals. */
  setSilhouette(on: boolean): void {
    if (!on) return;
    this.plume.group.visible = false;
    this.root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      if (o.name === "outline" || o.name === "decal") o.visible = false;
      else o.material = SILHOUETTE_MAT;
    });
  }
}
