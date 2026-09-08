import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import { Vector3, type PerspectiveCamera } from "three";
import type { Game } from "@/game";
import type { Flight } from "@/sim/flight";
import type { Input } from "@/core/input";
import type { Travel } from "@/travel/travel";
import { systemOf } from "@/travel/travel";
import type { Save } from "@/core/save";
import { writeSave } from "@/core/save";
import type { Audio } from "@/audio/audio";

interface Scene { game: Game; flight: Flight; input: Input; camera: PerspectiveCamera }

/** Explicitly labelled scripted previews, using the game's real travel/combat/replay paths. No mission progress writes. */
export class SceneReview {
  paused = true;
  private step = 0;
  private readonly readout = document.createElement("output");
  private readonly gui = new GUI({ title: "Scene evaluation", width: 260 });

  constructor(private readonly getScene: () => Scene, private readonly reset: () => void, private readonly travel: Travel, save: Save, private readonly audio: Audio) {
    const actions = {
      dial: () => this.gate("dial", .8),
      opening: () => this.gate("opening", .2),
      entry: () => this.gate("enter", .45),
      tunnel: () => this.gate("tunnel", .3),
      arrival: () => this.gate("arrive", .7),
      trip: () => { this.reset(); this.audio.unlock(); this.travel.depart(systemOf("abydos"), new URLSearchParams("review=1&mission=proving-ground&lock=free")); this.paused = false; },
      fighter: () => this.fighter(),
      approach: () => this.replayAt(.68),
      impact: () => this.replayAt(.73),
      aftermath: () => this.replayAt(.78),
      replay: () => { this.replayAt(0); this.audio.unlock(); this.paused = false; },
      step: () => { this.paused = true; this.step = .1; },
    };
    const gate = this.gui.addFolder("Gate trip");
    for (const key of ["dial", "opening", "entry", "tunnel", "arrival"] as const) gate.add(actions, key).name(key[0]!.toUpperCase() + key.slice(1));
    gate.add(actions, "trip").name("Play whole gate trip");
    const kill = this.gui.addFolder("Scripted fighter encounter");
    kill.add(actions, "fighter").name("Build encounter");
    kill.add(actions, "approach").name("Before impact");
    kill.add(actions, "impact").name("Breakup");
    kill.add(actions, "aftermath").name("Debris");
    kill.add(actions, "replay").name("Play whole replay");
    this.gui.add(this as { paused: boolean }, "paused").name("Freeze picture").listen();
    this.gui.add(actions, "step").name("Advance 0.1 seconds");
    this.gui.add(save.settings, "eventLighting").name("Event lighting").onChange(() => writeSave(save));
    this.readout.id = "scene-evaluation-status";
    this.readout.setAttribute("aria-label", "Measured scene state");
    this.readout.style.cssText = "position:fixed;left:14px;bottom:14px;max-width:430px;padding:8px 12px;background:#08121ee6;color:#d5e5ec;font:12px/1.5 monospace;pointer-events:none;white-space:pre-wrap;z-index:1000";
    document.body.append(this.readout);
  }

  frameDt(dt: number): number {
    if (!this.paused) return dt;
    const step = this.step;
    this.step = 0;
    return step;
  }

  report(mode: string): void {
    const { game, flight } = this.getScene();
    this.readout.textContent = `SCRIPTED EVALUATION · ${this.paused ? "frozen" : "playing"}\nScene: ${mode} · gate: ${this.travel.phase}\nMission clock: ${game.mission.clock.toFixed(3)} s · kills: ${game.combat.player.kills}\nReplay: ${game.replay.playing ? (game.replay.progress * 100).toFixed(1) + "%" : "stopped"} · rate: ${game.replay.playbackRate.toFixed(2)}\nFlight position: ${flight.pos.x.toFixed(2)}, ${flight.pos.y.toFixed(2)}, ${flight.pos.z.toFixed(2)}`;
  }

  private gate(phase: Travel["phase"], elapsed: number): void {
    this.reset();
    this.travel.depart(systemOf("abydos"), new URLSearchParams("review=1&mission=proving-ground&lock=free"));
    this.silenceScrub();
    const { camera } = this.getScene();
    for (let i = 0; i < 1200 && (this.travel.phase !== phase || this.travel.elapsed < elapsed); i++) this.travel.update(1 / 60, camera);
    this.paused = true;
  }

  private fighter(): void {
    this.reset();
    this.silenceScrub();
    const { game, flight, input, camera } = this.getScene();
    const e = game.enemies.spawn(new Vector3(0, 8000, 120), new Vector3(0, 8000, 10000));
    e.hp = game.combat.gunDamage;
    e.steer = new Vector3(0, 8000, 10000);
    e.steerSpeed = 90;
    input.locked = true;
    // Predetermined flight path, real gun emission and collision. Avoid the mission runner/save entirely.
    for (let frame = 0; frame < 690; frame++) {
      const t = frame / 60;
      flight.pos.set(0, 8000, t * 90);
      flight.quat.identity();
      flight.velDir.set(0, 0, 1);
      flight.speed = 90;
      e.fireCd = 1000;
      if (e.alive) {
        e.prevPos.copy(e.pos);
        e.pos.set(0, 8000, t * 90 + 120);
        e.vel.set(0, 0, 90);
      }
      input.fire = t > 7.5 && e.alive;
      game.replay.beginTick(1 / 60);
      game.combat.tick(1 / 60, flight, input);
      game.replay.record(1 / 60, flight, game.enemies.list);
    }
    input.fire = false;
    game.combat.fx.clear();
    flight.reset();
    game.replay.cutNow();
    game.replay.play(camera);
    this.paused = true;
  }

  private replayAt(progress: number): void {
    this.silenceScrub();
    const { game, camera } = this.getScene();
    if (!game.replay.hasHighlight) this.fighter();
    const scene = this.getScene();
    scene.game.replay.stop(camera, scene.game.enemies.list);
    scene.game.replay.play(scene.camera);
    for (let i = 0; i < 1800 && scene.game.replay.playing && scene.game.replay.progress < progress; i++) {
      scene.game.replay.update(1 / 60, scene.camera, scene.game.combat.ship, scene.game.enemies.list);
    }
    this.paused = true;
  }

  private silenceScrub(): void {
    this.audio.setScene("hub");
    this.audio.setScene("paused");
  }
}
