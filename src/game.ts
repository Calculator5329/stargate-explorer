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
import { enemyKindsOf } from "@/mission/levels";
import type { Audio } from "@/audio/audio";
import { disposeTree } from "@/render/dispose";
import { PALETTES } from "@/ships/palettes";
import { T } from "@/core/tunables";
import { writeSave, type Save } from "@/core/save";
import { Replay } from "@/replay/replay";
import { Gate } from "@/travel/gate";
import { Minimap } from "@/ui/minimap";
import type { Presentation } from "@/core/presentation";

/**
 * The game layer above flight: enemies, weapons, the mission script, sound and
 * the combat HUD. `main.ts` stays wiring; everything that knows what a "wave"
 * or a "kill" is lives here or below. Also the only writer of mission progress.
 */
export class Game {
  readonly enemies: Enemies;
  readonly combat: Combat;
  readonly mission: Mission;
  readonly replay = new Replay();
  /** the way home; opens ahead of the ship when a mission ends well */
  readonly gate = new Gate();
  /** the ship flew through the gate */
  onGate: (() => void) | null = null;
  onWeapon: ((position: THREE.Vector3) => void) | null = null;
  private presentation: Presentation = "flight";
  private lastStick = { x: 0, y: 0 };
  private flight: Flight;
  private cam: THREE.PerspectiveCamera | null = null;
  private readonly map: Minimap;
  private readonly ac = new AbortController();

  constructor(private readonly scene: THREE.Scene, world: World, ship: THREE.Object3D, canvas: HTMLCanvasElement, flight: Flight, private readonly save: Save, level: LevelDef, readonly audio: Audio) {
    this.enemies = new Enemies(world.asteroids, world.system.faction ? PALETTES[world.system.faction] : undefined);
    this.combat = new Combat(this.enemies, world.asteroids, ship, this.audio);
    this.combat.setShip(flight);
    this.combat.player.pos.copy(flight.pos);
    this.combat.player.vel.copy(flight.vel);
    this.combat.player.fwd.set(0, 0, 1).applyQuaternion(flight.quat);
    this.flight = flight;
    this.replay.rocks = world.asteroids;
    this.combat.onKill = (pos, vel, scale, seed, victimId) => this.replay.markKill(pos, vel, this.flight, this.lastStick, scale, seed, victimId);
    this.combat.onFire = (pos, vel) => { this.replay.markShot(pos, vel); this.onWeapon?.(pos); };
    this.combat.onRockBurst = (pos, scale, seed) => this.replay.markBurst(pos, scale, seed);
    this.replay.onShot = (rate) => { this.audio.replayShot(rate); this.onWeapon?.(this.combat.ship.position); };
    this.replay.onBurst = (scale, rate) => this.audio.replayExplosion(Math.min(1.4, scale / 6), rate);
    this.mission = createMission(level, { combat: this.combat, rocks: world.asteroids, audio: this.audio, flight });
    this.enemies.prewarm(enemyKindsOf(level)); // hulls exist before the first frame: no build or shader link on a spawn tick
    this.audio.setKey(level.system);
    this.map = new Minimap(document.querySelector<HTMLCanvasElement>("#hud .map")!, world.asteroids);
    scene.add(this.combat.group, this.mission.group, this.gate.group, this.replay.group);
    canvas.addEventListener("click", () => this.audio.unlock(), { signal: this.ac.signal });
    window.addEventListener("keydown", (e) => {
      if (this.replay.playing) {
        if (e.code === "KeyV" || e.code === "Escape") this.replay.stop(this.cam!, this.enemies.list);
        return;
      }
      if (this.presentation !== "flight") return;
      if (e.code === "KeyR" && this.mission.done) location.reload();
      // V at any point replays the last kill (the sim holds while it plays; Ethan, 2026-09-05)
      if (e.code === "KeyV" && this.cam) {
        this.replay.cutNow();
        this.replay.play(this.cam);
      }
    }, { signal: this.ac.signal });
  }

  /** Gate travel swapped the system: everything this game put in the scene goes, listeners with it. */
  dispose(): void {
    this.ac.abort();
    for (const g of [this.combat.group, this.mission.group, this.gate.group, this.replay.group]) {
      this.scene.remove(g);
      disposeTree(g);
    }
  }

  /** Start the highlight replay if there is one (pause menu button, end card). */
  playReplay(): boolean {
    return this.cam ? this.replay.play(this.cam) : false;
  }

  prepareTravel(): void {
    if (this.cam) this.replay.stop(this.cam, this.enemies.list);
    this.setPresentation("travel");
  }

  setPresentation(mode: Presentation): void {
    this.presentation = mode;
  }

  tick(dt: number, flight: Flight, input: Input): void {
    this.lastStick.x = input.stick.x;
    this.lastStick.y = input.stick.y;
    this.replay.beginTick(dt);
    this.mission.beforeCombat(dt);
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
    this.mission.placeReturnGate(_p);
    this.gate.open(_p, _fwd);
    this.mission.marker = this.gate;
  }

  render(alpha: number, dt: number, cam: THREE.PerspectiveCamera, hud: Hud, flight: Flight): void {
    this.cam = cam;
    const mode = this.presentation;
    hud.setTravel(mode === "travel" || mode === "hub");
    hud.setReplay(mode === "replay");
    const replaying = mode === "replay", flightVisible = mode === "flight" || mode === "paused";
    this.combat.group.visible = flightVisible || replaying;
    this.combat.shots.group.visible = this.combat.fx.group.visible = this.combat.missiles.group.visible = flightVisible;
    this.mission.group.visible = flightVisible || replaying;
    this.gate.group.visible = flightVisible && this.gate.alive;
    // Arrival can end without pointer lock. Restore the scene before freezing animation.
    if (mode === "paused") return;
    if (replaying) {
      for (const child of this.combat.ship.children) if (child.name === "muzzle-flash") child.visible = false;
      this.audio.setReplayRate(this.replay.playbackRate);
      this.replay.update(dt, cam, this.combat.ship, this.enemies.list);
      return;
    }
    if (!flightVisible) return;
    this.combat.render(alpha, dt, cam.position);
    this.mission.render(dt, alpha);
    this.gate.render(dt);
    this.audio.move(flight.move?.id ?? null);
    this.audio.update(flight.speed / T.flight.boostSpeed, flight.boosting || flight.moveThrust);
    if (!this.mission.done) this.audio.setMood(this.enemies.aliveCount > 0 ? "combat" : "calm");
    hud.updateCombat(this.combat, this.mission, cam, this.combat.player.vel, this.replay.hasHighlight, this.gate.alive);
    this.map.update(flight, this.enemies.list, this.mission.marker, dt, this.combat.friendlies);
  }
}

const _fwd = new THREE.Vector3();
const _p = new THREE.Vector3();
