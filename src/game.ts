import * as THREE from "three";
import type { Input } from "@/core/input";
import type { Flight } from "@/sim/flight";
import type { World } from "@/world/world";
import type { Hud } from "@/ui/hud";
import { Enemies } from "@/combat/enemies";
import { Combat } from "@/combat/combat";
import type { Mission } from "@/mission/mission";
import { createMission } from "@/mission/index";
import type { LevelDef } from "@/mission/levels";
import { Audio } from "@/audio/audio";
import { PALETTES } from "@/ships/palettes";
import { T } from "@/core/tunables";
import { writeSave, type Save } from "@/core/save";
import { Replay } from "@/replay/replay";
import { Gate } from "@/travel/gate";
import { Minimap } from "@/ui/minimap";

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
  readonly replay = new Replay();
  /** the way home; opens ahead of the ship when a mission ends well */
  readonly gate = new Gate();
  /** the ship flew through the gate */
  onGate: (() => void) | null = null;
  private lastStick = { x: 0, y: 0 };
  private flight: Flight;
  private cam: THREE.PerspectiveCamera | null = null;
  private readonly map: Minimap;

  constructor(scene: THREE.Scene, world: World, ship: THREE.Object3D, canvas: HTMLCanvasElement, flight: Flight, private readonly save: Save, level: LevelDef) {
    this.enemies = new Enemies(world.asteroids, world.system.faction ? PALETTES[world.system.faction] : undefined);
    this.combat = new Combat(this.enemies, world.asteroids, ship, this.audio);
    this.combat.setShip(flight);
    this.flight = flight;
    this.combat.onKill = (pos, vel) => this.replay.markKill(pos, vel, this.flight, this.lastStick);
    this.combat.onFire = (pos, vel) => this.replay.markShot(pos, vel);
    this.mission = createMission(level, { combat: this.combat, rocks: world.asteroids, audio: this.audio, flight });
    this.audio.setKey(level.system);
    this.map = new Minimap(document.querySelector<HTMLCanvasElement>("#hud .map")!, world.asteroids);
    scene.add(this.combat.group, this.mission.group, this.gate.group, this.replay.tracers.group);
    canvas.addEventListener("click", () => this.audio.unlock());
    window.addEventListener("keydown", (e) => {
      if (this.replay.playing) {
        if (e.code === "KeyV" || e.code === "Escape") this.replay.stop(this.cam!, this.enemies.list);
        return;
      }
      if (e.code === "KeyR" && this.mission.done) location.reload();
      if (e.code === "KeyV" && this.mission.done && this.cam) this.replay.play(this.cam);
    });
  }

  /** Start the highlight replay if there is one (pause menu button, end card). */
  playReplay(): boolean {
    return this.cam ? this.replay.play(this.cam) : false;
  }

  tick(dt: number, flight: Flight, input: Input): void {
    this.lastStick.x = input.stick.x;
    this.lastStick.y = input.stick.y;
    this.combat.tick(dt, flight, input);
    this.replay.record(dt, flight, this.enemies.list);
    this.mission.tick(dt);
    if (this.mission.phase === "complete" && !this.mission.recorded) this.record();
    if (this.gate.alive && this.gate.crossed(flight.pos) && this.onGate) {
      this.gate.alive = false;
      this.onGate();
    }
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
    this.openGate();
  }

  /** The gate appears well ahead of the ship, facing it, nudged off any rock. */
  private openGate(): void {
    const f = this.flight;
    _fwd.set(0, 0, 1).applyQuaternion(f.quat);
    _p.copy(f.pos).addScaledVector(_fwd, 700);
    const R = this.enemies.rocks;
    for (let tries = 0; tries < 8; tries++) {
      let clear = true;
      for (let i = 0; i < R.count; i++) {
        const dx = R.centers[i * 3]! - _p.x, dy = R.centers[i * 3 + 1]! - _p.y, dz = R.centers[i * 3 + 2]! - _p.z;
        const keep = R.radii[i]! + 70;
        if (dx * dx + dy * dy + dz * dz < keep * keep) (clear = false), (i = R.count);
      }
      if (clear) break;
      _p.addScaledVector(_fwd, 120);
    }
    this.gate.open(_p, _fwd);
    this.mission.marker = this.gate;
  }

  render(alpha: number, dt: number, cam: THREE.PerspectiveCamera, hud: Hud, flight: Flight): void {
    this.cam = cam;
    this.combat.render(alpha, dt, cam.position);
    this.mission.render(dt, alpha);
    this.gate.render(dt);
    this.audio.update(flight.speed / T.flight.boostSpeed, flight.boosting);
    if (!this.mission.done) this.audio.setMood(this.enemies.aliveCount > 0 ? "combat" : "calm");
    hud.updateCombat(this.combat, this.mission, cam, this.combat.player.vel, this.replay.hasHighlight, this.gate.alive);
    this.map.update(flight, this.enemies.list, this.mission.marker);
    const playing = this.replay.playing && this.replay.update(dt, cam, this.combat.ship, this.enemies.list, (p, v, s) => this.combat.burst(p, v, s, 0.6));
    hud.setReplay(playing);
  }
}

const _fwd = new THREE.Vector3();
const _p = new THREE.Vector3();
