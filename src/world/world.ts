import * as THREE from "three";
import { Skybox, type SkyName } from "@/world/skybox";
import { PLANET_PRESETS, Planet } from "@/world/planet";
import { Sun } from "@/world/sun";
import { Asteroids } from "@/world/asteroids";
import { Dust } from "@/fx/dust";

export interface WorldOptions {
  sky: SkyName;
  /** key into PLANET_PRESETS */
  planet: string;
  planetSegments: number;
  shadowMap: number;
}

/** The one system we have: sky, sun, a planet, an asteroid belt. Everything visible hangs off `root`; lights go on the scene. */
export class World {
  readonly root = new THREE.Group();
  readonly sky: Skybox;
  readonly sun: Sun;
  readonly planet: Planet;
  readonly asteroids: Asteroids;
  readonly dust = new Dust();

  constructor(scene: THREE.Scene, o: WorldOptions) {
    this.sky = new Skybox(o.sky);
    this.sun = new Sun(scene, new THREE.Vector3(0.6, 0.35, -0.7), o.shadowMap);
    const pp = PLANET_PRESETS[o.planet] ?? PLANET_PRESETS.desert!;
    this.planet = new Planet({ radius: 1800, segments: o.planetSegments, seed: pp.seed, sunDir: this.sun.dir, palette: pp.palette, ...(pp.ring ? { ring: pp.ring } : {}) });
    this.planet.group.position.set(-2600, -900, 3800);
    this.asteroids = new Asteroids({ count: 900, seed: 1337, inner: 60, outer: 1400, thickness: 420, shapes: 6 });
    this.root.add(this.sky.mesh, this.sun.glare, this.planet.group, this.asteroids.group, this.dust.lines);
    scene.add(this.root);
  }

  tick(dt: number): void {
    this.asteroids.tick(dt);
  }

  update(camPos: THREE.Vector3): void {
    this.sun.update(camPos);
    this.sky.update();
    this.planet.update();
  }
}
