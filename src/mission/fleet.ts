import * as THREE from 'three';
import type { Lockable } from '@/combat/targets';
import type { Combat } from '@/combat/combat';
import type { Enemy } from '@/combat/enemies';
import type { ShipDef } from '@/ships/defs';
import { ShipRig } from '@/ships/rig';
import { MeshSolid } from '@/world/mesh-solid';
import type { Solid, SolidHit } from '@/world/solid';
import { solidHit } from '@/world/solid';
import { T, clamp } from '@/core/tunables';

export interface FleetCraftOptions {
  name: string;
  model: THREE.Group | ShipDef;
  size: number;
  hp: number;
  pos: [number, number, number];
  yaw?: number;
}

/** One mission craft: geometry, target, damage and interpolated pose share the same object. */
export class FleetCraft implements Lockable, Solid {
  readonly root = new THREE.Group();
  readonly pos = new THREE.Vector3();
  readonly prevPos = new THREE.Vector3();
  readonly quat = new THREE.Quaternion();
  readonly prevQuat = new THREE.Quaternion();
  readonly vel = new THREE.Vector3();
  readonly fwd = new THREE.Vector3(0, 0, 1);
  readonly visPos = this.root.position;
  readonly radius: number;
  readonly label: string;
  readonly maxHp: number;
  private readonly collider: MeshSolid;
  private readonly rig: ShipRig | null;
  private readonly localA = new THREE.Vector3();
  private readonly localB = new THREE.Vector3();
  private readonly inverse = new THREE.Quaternion();
  private readonly contact = solidHit();
  hp: number;
  alive = true;
  shielded = false;
  fireCd = 0;
  kills = 0;

  constructor(options: FleetCraftOptions, private readonly combat: Combat) {
    this.label = options.name;
    this.hp = this.maxHp = options.hp;
    this.rig = options.model instanceof THREE.Group ? null : new ShipRig(options.model);
    const visual = this.rig?.root ?? options.model as THREE.Group;
    const bounds = new THREE.Box3().setFromObject(visual), size = bounds.getSize(new THREE.Vector3());
    const scale = options.size / Math.max(size.x, size.y, size.z);
    const center = bounds.getCenter(new THREE.Vector3());
    visual.scale.multiplyScalar(scale);
    visual.position.addScaledVector(center, -scale);
    this.root.add(visual);
    this.radius = bounds.getBoundingSphere(new THREE.Sphere()).radius * scale;
    this.root.name = options.name;
    this.collider = new MeshSolid(this.root);
    this.pos.set(...options.pos);
    this.prevPos.copy(this.pos);
    this.quat.setFromAxisAngle(UP, options.yaw ?? 0);
    this.prevQuat.copy(this.quat);
    this.render(0, 1);
  }

  get hullPercent(): number { return Math.max(0, Math.round(this.hp / this.maxHp * 100)); }

  damage(amount: number): boolean {
    if (!this.alive || this.shielded) return false;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp > 0) return false;
    this.alive = false;
    this.root.visible = false;
    this.combat.burst(this.pos, this.vel, Math.min(60, this.radius * .35));
    return true;
  }

  hits(a: THREE.Vector3, b: THREE.Vector3): boolean { return this.sweep(a, b, 0, this.contact); }

  sweep(a: THREE.Vector3, b: THREE.Vector3, radius: number, hit: SolidHit): boolean {
    if (!this.alive) return false;
    this.inverse.copy(this.quat).invert();
    this.localA.subVectors(a, this.pos).applyQuaternion(this.inverse);
    this.localB.subVectors(b, this.pos).applyQuaternion(this.inverse);
    if (!this.collider.sweep(this.localA, this.localB, radius, hit)) return false;
    hit.point.applyQuaternion(this.quat).add(this.pos);
    hit.normal.applyQuaternion(this.quat);
    return true;
  }

  beginTick(): void {
    this.prevPos.copy(this.pos);
    this.prevQuat.copy(this.quat);
    this.fwd.set(0, 0, 1).applyQuaternion(this.quat);
  }

  /** Stop exactly at a waypoint; the mission decides when that arrival advances its phase. */
  moveTo(destination: THREE.Vector3, speed: number, dt: number): boolean {
    _dir.subVectors(destination, this.pos);
    const distance = _dir.length();
    if (distance < T.episode.routeArrival) { this.vel.set(0, 0, 0); return true; }
    _dir.multiplyScalar(1 / distance);
    this.vel.copy(_dir).multiplyScalar(Math.min(speed, distance / dt));
    this.pos.addScaledVector(this.vel, dt);
    _q.setFromUnitVectors(FORWARD, _dir);
    this.quat.rotateTowards(_q, T.episode.allyTurnRate * dt);
    return false;
  }

  render(dt: number, alpha: number): void {
    this.root.visible = this.alive;
    this.root.position.lerpVectors(this.prevPos, this.pos, alpha);
    this.root.quaternion.slerpQuaternions(this.prevQuat, this.quat, alpha);
    if (this.alive) this.rig?.update(dt, this.vel.lengthSq() > 1 ? .7 : .15, false);
  }
}

/** Defenders prioritize attackers approaching the protected craft; shots use normal combat resolution. */
export class Defenders {
  readonly craft: FleetCraft[] = [];
  private readonly hit = solidHit();
  private clock = 0;

  constructor(private readonly combat: Combat, private readonly terrain: Solid, private readonly protectedCraft: FleetCraft) {}

  tick(dt: number): void {
    this.clock += dt;
    for (let i = 0; i < this.craft.length; i++) {
      const ally = this.craft[i]!;
      if (!ally.alive) continue;
      ally.beginTick();
      ally.fireCd -= dt;
      const target = this.pickTarget(ally);
      if (target) {
        _dir.copy(target.pos).addScaledVector(target.vel, ally.pos.distanceTo(target.pos) / T.weapons.muzzleSpeed).sub(ally.pos);
        if (_dir.length() < T.episode.allyBreakDistance) _dir.set(i % 2 ? -1 : 1, .6, -1);
      } else {
        const angle = this.clock * .17 + i * Math.PI * 2 / Math.max(1, this.craft.length);
        _dir.copy(this.protectedCraft.pos).add(_orbit.set(Math.cos(angle) * 320, 130 + i * 25, Math.sin(angle) * 320)).sub(ally.pos);
      }
      _dir.normalize();
      _look.copy(ally.pos).addScaledVector(_dir, T.episode.allySpeed * T.episode.avoidSeconds);
      if (this.terrain.sweep(ally.pos, _look, ally.radius + T.episode.avoidMargin, this.hit)) _dir.addScaledVector(this.hit.normal, T.episode.avoidStrength).normalize();
      _q.setFromUnitVectors(FORWARD, _dir);
      ally.quat.rotateTowards(_q, T.episode.allyTurnRate * dt);
      ally.fwd.set(0, 0, 1).applyQuaternion(ally.quat);
      const speed = ally.vel.length() + clamp(T.episode.allySpeed - ally.vel.length(), -T.episode.allyAccel * dt, T.episode.allyAccel * dt);
      ally.vel.copy(ally.fwd).multiplyScalar(speed);
      ally.pos.addScaledVector(ally.vel, dt);
      if (this.terrain.sweep(ally.prevPos, ally.pos, ally.radius, this.hit)) {
        ally.pos.copy(this.hit.point).addScaledVector(this.hit.normal, T.episode.contactMargin);
        const impact = -ally.vel.dot(this.hit.normal);
        if (impact > T.rocks.crashKill) ally.damage(ally.maxHp);
        else if (impact > 0) ally.vel.addScaledVector(this.hit.normal, impact * 1.5);
      }
      if (!target || !ally.alive || ally.fireCd > 0) continue;
      _aim.copy(target.pos).addScaledVector(target.vel, ally.pos.distanceTo(target.pos) / T.weapons.muzzleSpeed).sub(ally.pos);
      if (_aim.length() > T.episode.allyRange || _aim.normalize().dot(ally.fwd) < Math.cos(T.episode.allyFireCone)) continue;
      _muzzle.copy(ally.pos).addScaledVector(ally.fwd, ally.radius + 2);
      if (this.terrain.sweep(_muzzle, target.pos, 0, this.hit)) continue;
      this.combat.shots.fire('ally', _muzzle, _aim, ally.vel, T.episode.allyDamage);
      ally.fireCd = T.episode.allyFireInterval;
    }
  }

  private pickTarget(ally: FleetCraft): Enemy | null {
    let best: Enemy | null = null, score = Infinity;
    for (const enemy of this.combat.enemies.list) {
      if (!enemy.alive) continue;
      const distance = enemy.pos.distanceToSquared(ally.pos);
      if (distance > T.episode.allyRange * T.episode.allyRange * 4) continue;
      const danger = enemy.pos.distanceToSquared(this.protectedCraft.pos) * (enemy.kind === 'bomber' ? .2 : .65) + distance * .35;
      if (danger < score) { best = enemy; score = danger; }
    }
    return best;
  }
}

/** Broadside defense: a carrier can track independently of its forward heading. */
export function fireCarrier(carrier: FleetCraft, combat: Combat, dt: number): void {
  if (!carrier.alive || (carrier.fireCd -= dt) > 0) return;
  let nearest: Enemy | null = null, distance = T.episode.carrierRange ** 2;
  for (const enemy of combat.enemies.list) {
    if (!enemy.alive) continue;
    const d = enemy.pos.distanceToSquared(carrier.pos);
    if (d < distance) { distance = d; nearest = enemy; }
  }
  if (!nearest) return;
  _aim.copy(nearest.pos).addScaledVector(nearest.vel, Math.sqrt(distance) / T.weapons.muzzleSpeed).sub(carrier.pos).normalize();
  _muzzle.copy(carrier.pos).addScaledVector(_aim, carrier.radius + 8);
  combat.shots.fire('ally', _muzzle, _aim, carrier.vel, T.episode.carrierDamage);
  carrier.fireCd = T.episode.carrierFireInterval;
}

const FORWARD = new THREE.Vector3(0, 0, 1), UP = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3(), _orbit = new THREE.Vector3(), _aim = new THREE.Vector3(), _look = new THREE.Vector3(), _muzzle = new THREE.Vector3();
const _q = new THREE.Quaternion();
