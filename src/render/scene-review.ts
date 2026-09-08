import { T } from "@/core/tunables";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import { Vector3, type PerspectiveCamera } from "three";
import type { Game } from "@/game";
import type { Flight } from "@/sim/flight";
import type { Input } from "@/core/input";
import type { Travel } from "@/travel/travel";
import type { Save } from "@/core/save";
import { writeSave } from "@/core/save";
import type { Audio } from "@/audio/audio";

interface Scene { game: Game; flight: Flight; input: Input; camera: PerspectiveCamera }

/** Explicitly labelled scripted previews, using the game's real travel/combat/replay paths. No mission progress writes. */
export class SceneReview {
  paused = true;
  private step = 0;
  private running = false;
  private readonly readout = document.createElement("output");
  private readonly gui = new GUI({ title: "Scene evaluation", width: 260 });

  constructor(private readonly getScene: () => Scene, private readonly reset: () => void, _travel: Travel, save: Save, private readonly audio: Audio) {
    const actions = {
      fighter: () => this.fighter(),
      multi: () => { this.fighter(Math.max(1, Math.min(8, Math.round(T.replay.maxKills)))); this.playFrom(0); },
      follow: () => { if (!this.getScene().game.replay.hasHighlight) this.fighter(); this.playFrom(this.getScene().game.replay.cueProgress(.85)); },
      approach: () => this.freezeAt(-.2),
      impact: () => this.freezeAt(.25),
      aftermath: () => this.freezeAt(.9),
      replay: () => this.playFrom(0),
      step: () => { this.paused = true; this.step = .1; },
    };
    const kill = this.gui.addFolder("Scripted fighter encounter");
    kill.add(actions, "fighter").name("Build single-kill clip");
    kill.add(actions, "approach").name("Freeze before impact");
    kill.add(actions, "impact").name("Freeze breakup");
    kill.add(actions, "aftermath").name("Freeze debris");
    kill.add(actions, "replay").name("Play whole replay");
    kill.add(actions, "follow").name("Play player follow-through");
    kill.add(actions, "multi").name("Play multi-kill encounter");
    kill.add(T.replay, "maxKills", 1, 8, 1).name("Maximum kills");
    kill.add(T.replay, "windowSeconds", 0, 30, 1).name("Kill window (seconds)");
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
    if (this.running && !game.replay.playing) { this.running = false; this.paused = true; }
    this.readout.textContent = `SCRIPTED EVALUATION · ${this.paused ? "frozen" : "playing"}\nScene: ${mode}\nMission clock: ${game.mission.clock.toFixed(3)} s · kills: ${game.combat.player.kills}\nReplay: ${game.replay.playing ? (game.replay.progress * 100).toFixed(1) + "%" : "stopped"} · rate: ${game.replay.playbackRate.toFixed(2)} · captured kills: ${game.replay.highlightKills}\nFlight position: ${flight.pos.x.toFixed(2)}, ${flight.pos.y.toFixed(2)}, ${flight.pos.z.toFixed(2)}`;
  }

  private freezeAt(offset: number): void {
    if (!this.getScene().game.replay.hasHighlight) this.fighter();
    this.replayAt(this.getScene().game.replay.cueProgress(offset));
  }

  private playFrom(progress: number): void {
    this.replayAt(progress);
    this.audio.unlock();
    this.running = true;
    this.paused = false;
  }

  private fighter(killCount = 1): void {
    this.reset();
    this.silenceScrub();
    const { game, flight, input, camera } = this.getScene();
    // Spawn the full formation once. Flight and enemy steering integrate every
    // pose; no recycled victim teleport or per-frame placement on the gun line.
    for (let i = 0; i < killCount; i++) {
      const e = game.enemies.spawn(new Vector3(0, 8000, 600 + i * 180), new Vector3(0, 8000, 10000));
      e.hp = game.combat.gunDamage;
      e.steer = new Vector3(0, 0, 1);
      e.steerSpeed = 90;
    }
    flight.pos.set(0, 8000, 0);
    flight.prevPos.copy(flight.pos);
    flight.vel.set(0, 0, 150);
    flight.velDir.set(0, 0, 1);
    flight.speed = 150;
    input.locked = true;
    let tail = 0;
    const arenaRadius = T.arena.radius;
    T.arena.radius = 20000; // The isolated fixture sits above the belt.
    try {
      for (let frame = 0; frame < 2400; frame++) {
        const t = frame / 60;
        const finished = game.combat.player.kills >= killCount;
        input.fire = t > 7.5 + game.combat.player.kills * 2.2 && game.combat.player.fired <= game.combat.player.kills && !finished;
        input.stick.x = finished ? .16 : 0;
        input.stick.y = 0;
        flight.tick(1 / 60, input);
        game.replay.beginTick(1 / 60);
        game.combat.tick(1 / 60, flight, input);
        game.replay.record(1 / 60, flight, game.enemies.list);
        if (finished && (tail += 1 / 60) > 3.1) break;
      }
    } finally { T.arena.radius = arenaRadius; }
    input.stick.x = input.stick.y = 0;
    input.fire = false;
    game.combat.fx.clear();
    flight.reset();
    game.replay.cutNow();
    game.replay.play(camera);
    this.paused = true;
  }

  private replayAt(progress: number): void {
    this.running = false;
    this.silenceScrub();
    const { game } = this.getScene();
    if (!game.replay.hasHighlight) this.fighter();
    const scene = this.getScene();
    scene.game.replay.stop(scene.camera, scene.game.enemies.list);
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
