import * as THREE from "three";
import { Skybox } from "@/world/skybox";
import type { SystemDef } from "@/world/systems";
import { PLANET_PRESETS, Planet } from "@/world/planet";
import { Sun } from "@/world/sun";
import { Asteroids } from "@/world/asteroids";
import { Dust } from "@/fx/dust";
import { T } from "@/core/tunables";
import { disposeTree } from "@/render/dispose";

export interface WorldOptions {
  system: SystemDef;
  /** overrides the system's planet preset (`?planet=` preview) */
  planet?: string;
  planetSegments: number;
  shadowMap: number;
}

/** One star system: sky, sun, a planet, an asteroid belt, from a SystemDef. Everything visible hangs off `root`; lights go on the scene. */
export class World {
  readonly root = new THREE.Group();
  readonly sky: Skybox;
  readonly sun: Sun;
  readonly planet: Planet;
  readonly asteroids: Asteroids;
  readonly dust = new Dust();
  readonly system: SystemDef;

  constructor(scene: THREE.Scene, o: WorldOptions) {
    const S = o.system;
    this.system = S;
    this.sky = new Skybox(S.sky);
    this.sun = new Sun(scene, new THREE.Vector3(...S.sunDir).normalize(), o.shadowMap);
    const pp = PLANET_PRESETS[o.planet ?? S.planet] ?? PLANET_PRESETS.desert!;
    this.planet = new Planet({ radius: 1800, segments: o.planetSegments, seed: pp.seed, sunDir: this.sun.dir, palette: pp.palette, ...(pp.ring ? { ring: pp.ring } : {}) });
    this.planet.group.position.set(...S.planetPos);
    this.asteroids = new Asteroids({ ...S.belt });
    // the arena is a per-system size; T stays the live-tunable copy every consumer (hazards, minimap, enemy AI) reads
    T.arena.radius = S.arena ?? 1500;
    this.root.add(this.sky.mesh, this.sun.glare, this.planet.group, this.asteroids.group, this.dust.lines);
    scene.add(this.root);
  }

  tick(dt: number): void {
    this.asteroids.tick(dt);
  }

  /** Gate travel swaps systems in place: drop everything this world put in the scene and on the GPU. */
  dispose(scene: THREE.Scene): void {
    scene.remove(this.root);
    this.sun.dispose(scene);
    this.sky.dispose();
    this.planet.dispose();
    disposeTree(this.root);
  }

  /** Once per render frame, before `render()`: sun glare, the sky and planet bakes (no-ops once baked), belt culling. */
  update(camera: THREE.Camera, gl: THREE.WebGLRenderer, bakeSize: number): void {
    this.sun.update(camera.position);
    this.sky.update(gl, bakeSize);
    this.planet.update(gl, bakeSize);
    this.asteroids.cull(this.asteroids.group.visible ? camera : null);
  }
}
