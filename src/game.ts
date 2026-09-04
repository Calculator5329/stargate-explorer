import * as THREE from "three";
import type { Input } from "@/core/input";
import type { Flight } from "@/sim/flight";
import type { World } from "@/world/world";
import type { Hud } from "@/ui/hud";
import { Enemies } from "@/combat/enemies";
import { Combat } from "@/combat/combat";
import { GLIDER } from "@/combat/glider-def";
import { Mission, CLEAR_THE_FIELD } from "@/mission/mission";
import { Audio } from "@/audio/audio";
import { T } from "@/core/tunables";

/**
 * The game layer above flight: enemies, weapons, the mission script, sound and
 * the combat HUD. `main.ts` stays wiring; everything that knows what a "wave"
 * or a "kill" is lives here or below.
 */
export class Game {
  readonly audio = new Audio();
  readonly enemies: Enemies;
  readonly combat: Combat;
  readonly mission: Mission;

  constructor(scene: THREE.Scene, world: World, ship: THREE.Object3D, canvas: HTMLCanvasElement) {
    this.enemies = new Enemies(GLIDER, world.asteroids);
    this.combat = new Combat(this.enemies, world.asteroids, ship, this.audio);
    this.mission = new Mission(CLEAR_THE_FIELD, this.combat, world.asteroids, this.audio);
    scene.add(this.combat.group);
    canvas.addEventListener("click", () => this.audio.unlock());
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyR" && (this.mission.phase === "complete" || this.mission.phase === "lost")) location.reload();
    });
  }

  tick(dt: number, flight: Flight, input: Input): void {
    this.combat.tick(dt, flight, input);
    this.mission.tick(dt, flight.pos, flight.quat);
  }

  render(alpha: number, dt: number, cam: THREE.PerspectiveCamera, hud: Hud, flight: Flight): void {
    this.combat.render(alpha, dt, cam.position);
    this.audio.update(flight.speed / T.flight.boostSpeed, flight.boosting);
    hud.updateCombat(this.combat, this.mission, cam, this.combat.player.vel);
  }
}
