import * as THREE from "three";
import { Skybox, type SkyName } from "@/world/skybox";
import { Planet } from "@/world/planet";
import { Sun } from "@/world/sun";
import { Debris } from "@/world/debris";

export interface WorldOptions {
  sky: SkyName;
  planetSegments: number;
}

/** The one system we have: sky, sun, a planet, a placeholder debris field. */
export class World {
  readonly sky: Skybox;
  readonly sun: Sun;
  readonly planet: Planet;
  readonly debris: Debris;

  constructor(scene: THREE.Scene, o: WorldOptions) {
    this.sky = new Skybox(o.sky);
    this.sun = new Sun(scene, new THREE.Vector3(0.6, 0.35, -0.7));
    this.planet = new Planet({ radius: 1800, segments: o.planetSegments, seed: 4.2, sunDir: this.sun.dir });
    this.planet.group.position.set(-2600, -900, 3800);
    this.debris = new Debris({ count: 120, seed: 1337, inner: 250, outer: 1400 });
    scene.add(this.sky.mesh, this.planet.group, this.debris.mesh);
  }

  tick(dt: number): void {
    this.debris.tick(dt);
  }

  update(camPos: THREE.Vector3): void {
    this.sun.update(camPos);
    this.sky.update();
    this.planet.update();
  }
}
