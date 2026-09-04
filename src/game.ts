import * as THREE from "three";
import type { Input } from "@/core/input";
import type { Flight } from "@/sim/flight";
import type { World } from "@/world/world";
import type { Hud } from "@/ui/hud";
import { Enemies } from "@/combat/enemies";
import { Combat } from "@/combat/combat";
import { GLIDER } from "@/combat/glider-def";
import type { Mission } from "@/mission/mission";
import { createMission } from "@/mission/index";
import type { LevelDef } from "@/mission/levels";
import { Audio } from "@/audio/audio";
import { T } from "@/core/tunables";
import { writeSave, type Save } from "@/core/save";

/**
 * The game layer above flight: enemies, weapons, the mission script, sound and
 * the combat HUD. `main.ts` stays wiring; everything that knows what a "wave"
 * or a "kill" is lives here or below. Also the only writer of mission progress.
 */
export class Game {
  readonly audio = new Audio();
  readonly enemies: Enemies;
  readonly combat: Combat;
  readonly mission: Mission;

  constructor(scene: THREE.Scene, world: World, ship: THREE.Object3D, canvas: HTMLCanvasElement, flight: Flight, private readonly save: Save, level: LevelDef) {
    this.enemies = new Enemies(GLIDER, world.asteroids);
    this.combat = new Combat(this.enemies, world.asteroids, ship, this.audio);
    this.combat.setShip(flight);
    this.mission = createMission(level, { combat: this.combat, rocks: world.asteroids, audio: this.audio, flight });
    scene.add(this.combat.group, this.mission.group);
    canvas.addEventListener("click", () => this.audio.unlock());
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyR" && this.mission.done) location.reload();
    });
  }

  tick(dt: number, flight: Flight, input: Input): void {
    this.combat.tick(dt, flight, input);
    this.mission.tick(dt);
    if (this.mission.phase === "complete" && !this.mission.recorded) this.record();
  }

  /** First completion unlocks; every completion keeps the best clock. */
  private record(): void {
    const m = this.mission, P = this.save.progress;
    m.recorded = true;
    const rec = P.missions[m.def.id] ?? { bestTime: 0, completions: 0 };
    rec.completions++;
    if (rec.bestTime === 0 || m.clock < rec.bestTime) rec.bestTime = m.clock;
    P.missions[m.def.id] = rec;
    if (m.def.unlocks && !P.unlocked.includes(m.def.unlocks)) P.unlocked.push(m.def.unlocks);
    writeSave(this.save);
  }

  render(alpha: number, dt: number, cam: THREE.PerspectiveCamera, hud: Hud, flight: Flight): void {
    this.combat.render(alpha, dt, cam.position);
    this.mission.render(dt);
    this.audio.update(flight.speed / T.flight.boostSpeed, flight.boosting);
    hud.updateCombat(this.combat, this.mission, cam, this.combat.player.vel);
  }
}
