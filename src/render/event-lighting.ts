import * as THREE from "three";
import { T } from "@/core/tunables";
import type { Explosions } from "@/fx/explosion";

/** Three bounded, shadow-free local lights. Off by default; toggling never changes the simulation. */
export class EventLighting {
  readonly group = new THREE.Group();
  private readonly explosion = new THREE.PointLight(0xffb16a, 0, 100, 0);
  private readonly gate = new THREE.PointLight(0x79cfff, 0, 160, 0);
  private readonly muzzle = new THREE.PointLight(0xbedfff, 0, 32, 0);
  private muzzleLeft = 0;

  constructor(scene: THREE.Scene) {
    this.group.name = "event-lighting";
    this.group.add(this.explosion, this.gate, this.muzzle);
    this.group.visible = false;
    scene.add(this.group);
  }

  weapon(pos: THREE.Vector3): void {
    this.muzzle.position.copy(pos);
    this.muzzleLeft = T.eventLight.weaponSeconds;
  }

  clear(): void { this.muzzleLeft = 0; this.group.visible = false; }

  update(enabled: boolean, dt: number, fx: Explosions | null, gatePos: THREE.Vector3 | null, gateGlow: number): void {
    this.group.visible = enabled;
    this.muzzleLeft = Math.max(0, this.muzzleLeft - dt);
    if (!enabled) return;
    const p = T.eventLight;
    const strength = fx?.strongestLight(this.explosion.position) ?? 0;
    this.explosion.intensity = p.explosionIntensity * Math.min(1.5, strength / 5);
    this.explosion.distance = p.explosionRange;
    this.gate.intensity = p.gateIntensity * gateGlow;
    this.gate.distance = p.gateRange;
    if (gatePos) this.gate.position.copy(gatePos);
    this.muzzle.intensity = p.weaponIntensity * Math.min(1, this.muzzleLeft / p.weaponSeconds);
    this.muzzle.distance = p.weaponRange;
  }
}
