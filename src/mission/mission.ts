import * as THREE from "three";
import type { Combat } from "@/combat/combat";
import type { Audio } from "@/audio/audio";
import type { RockSpheres } from "@/combat/enemies";
import { T } from "@/core/tunables";

export interface Wave {
  count: number;
  /** seconds after the previous wave clears (or after the intro) */
  delay: number;
  /** spawn distance band from the player (m) */
  near: number;
  far: number;
}

export interface MissionDef {
  title: string;
  intro: string[];
  waves: Wave[];
  /** shown while the last wave is up */
  finaleLine: string;
}

/** "Clear the field": three waves of gliders, the last one heavier. Everything a designer would tune is here, not in code. */
export const CLEAR_THE_FIELD: MissionDef = {
  title: "CLEAR THE FIELD",
  intro: ["Gliders inbound through the belt.", "Clear them before they reach the gate."],
  waves: [
    { count: 2, delay: 4, near: 700, far: 900 },
    { count: 3, delay: 5, near: 800, far: 1000 },
    { count: 5, delay: 5, near: 800, far: 1100 },
  ],
  finaleLine: "Last wave. All of them.",
};

export type Phase = "intro" | "wait" | "wave" | "complete" | "lost";

const _dir = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _q = new THREE.Quaternion();

/**
 * Mission state machine: intro → (wait → wave)* → complete, or lost when the
 * player dies. Waves spawn in a cone ahead of the player so the first contact
 * is on screen. Timing and outcome are exposed for the HUD cards.
 */
export class Mission {
  phase: Phase = "intro";
  wave = 0;
  timer = 0;
  /** mission clock, seconds since intro ended */
  clock = 0;
  /** one-line status for the HUD */
  line = "";

  constructor(readonly def: MissionDef, private readonly combat: Combat, private readonly rocks: RockSpheres, private readonly audio: Audio) {
    this.timer = 4;
    this.line = def.intro.join("  ");
  }

  tick(dt: number, playerPos: THREE.Vector3, playerQuat: THREE.Quaternion): void {
    const P = this.combat.player;
    if (this.phase === "complete" || this.phase === "lost") return;
    if (!P.alive) {
      this.phase = "lost";
      this.line = "";
      return;
    }
    this.timer -= dt;
    if (this.phase !== "intro") this.clock += dt;
    switch (this.phase) {
      case "intro":
        if (this.timer <= 0) this.toWait(playerPos);
        break;
      case "wait":
        if (this.timer <= 0) this.spawnWave(playerPos, playerQuat);
        break;
      case "wave":
        if (this.combat.enemies.aliveCount === 0) {
          if (this.wave >= this.def.waves.length) {
            this.phase = "complete";
            this.line = "";
            this.audio.ui();
          } else this.toWait(playerPos);
        }
        break;
    }
  }

  private toWait(_p: THREE.Vector3): void {
    const w = this.def.waves[this.wave]!;
    this.phase = "wait";
    this.timer = w.delay;
    this.line = this.wave === 0 ? "Contact soon." : `Wave ${this.wave} clear. ${this.def.waves.length - this.wave} to go.`;
    this.audio.ui();
  }

  /** True when no rock sphere (padded by the avoid distance) contains `p`. */
  private clear(p: THREE.Vector3): boolean {
    const R = this.rocks;
    for (let i = 0; i < R.count; i++) {
      const dx = p.x - R.centers[i * 3]!, dy = p.y - R.centers[i * 3 + 1]!, dz = p.z - R.centers[i * 3 + 2]!;
      const r = R.radii[i]! + T.enemy.avoidDist * 0.5;
      if (dx * dx + dy * dy + dz * dz < r * r) return false;
    }
    return true;
  }

  private spawnWave(playerPos: THREE.Vector3, playerQuat: THREE.Quaternion): void {
    const w = this.def.waves[this.wave]!;
    this.wave++;
    this.phase = "wave";
    this.combat.restock();
    _fwd.set(0, 0, 1).applyQuaternion(playerQuat);
    for (let i = 0; i < w.count; i++) {
      // within ~50° of the nose, spread around it; re-roll up to 8 times if the spot is inside a rock
      for (let tries = 0; tries < 8; tries++) {
        _q.setFromAxisAngle(_dir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), (Math.random() * 0.9 - 0.45) * 2);
        _dir.copy(_fwd).applyQuaternion(_q).normalize();
        _pos.copy(playerPos).addScaledVector(_dir, w.near + Math.random() * (w.far - w.near));
        if (this.clear(_pos)) break;
      }
      this.combat.enemies.spawn(_pos, playerPos);
    }
    const last = this.wave === this.def.waves.length;
    this.line = last ? this.def.finaleLine : `Wave ${this.wave} of ${this.def.waves.length}: ${w.count} gliders.`;
    this.audio.ui();
  }
}
