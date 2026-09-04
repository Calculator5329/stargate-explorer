import * as THREE from "three";
import { T, clamp } from "@/core/tunables";
import { Flight } from "@/sim/flight";
import type { Input } from "@/core/input";
import { Projectiles, type Shot } from "@/combat/projectiles";
import { Enemies, type Enemy, type RockSpheres } from "@/combat/enemies";
import { Explosions } from "@/fx/explosion";
import { Missiles } from "@/combat/missiles";
import type { Audio } from "@/audio/audio";
import { noEdge } from "@/render/layers";
import { glowMaterial } from "@/render/toon";

/** Ship-local gun muzzles (port, starboard), under the nose chines. */
const GUNS: [number, number, number][] = [
  [1.9, -0.05, 4.2],
  [-1.9, -0.05, 4.2],
];

export interface PlayerState {
  hp: number;
  alive: boolean;
  kills: number;
  fired: number;
  hits: number;
  /** velocity for lead computation and debris */
  vel: THREE.Vector3;
  pos: THREE.Vector3;
  sinceHit: number;
}

const _p = new THREE.Vector3();
const _d = new THREE.Vector3();
const _prev = new THREE.Vector3();
const _seg = new THREE.Vector3();
const _n = new THREE.Vector3();
const _fwdv = new THREE.Vector3();
const ZEROV = new THREE.Vector3();

/** Closest approach of the segment a→b to point c, squared. */
function segDist2(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): number {
  _seg.subVectors(b, a);
  const L2 = _seg.lengthSq();
  const t = L2 < 1e-6 ? 0 : clamp(_n.subVectors(c, a).dot(_seg) / L2, 0, 1);
  return _n.copy(a).addScaledVector(_seg, t).sub(c).lengthSq();
}

/**
 * The shooting half of the game: player cannons, enemy rounds, swept hit tests
 * against enemies, the player and rocks, damage and destruction. Owns the
 * projectile pool and the explosion pool; `Enemies` owns the brains.
 */
export class Combat {
  readonly group = new THREE.Group();
  readonly shots = new Projectiles();
  readonly fx = new Explosions();
  readonly missiles = new Missiles();
  /** nearest glider inside the lock cone, and how far along the lock is (0..1) */
  target: Enemy | null = null;
  lock = 0;
  ammo = T.missile.count;
  private missileCd = 0;
  readonly player: PlayerState = { hp: T.player.hp, alive: true, kills: 0, fired: 0, hits: 0, vel: new THREE.Vector3(), pos: new THREE.Vector3(), sinceHit: 99 };
  private fireAcc = 0;
  private gun = 0;
  private readonly muzzle: THREE.Mesh[] = [];
  private muzzleT = 0;

  constructor(readonly enemies: Enemies, private readonly rocks: RockSpheres, private readonly ship: THREE.Object3D, private readonly audio: Audio) {
    this.group.add(this.shots.group, this.fx.group, enemies.group, this.missiles.group);
    const geo = new THREE.CircleGeometry(0.55, 10);
    for (const g of GUNS) {
      const m = noEdge(new THREE.Mesh(geo, glowMaterial(0xdff2ff, 3)));
      m.position.set(g[0], g[1], g[2] + 0.4);
      m.visible = false;
      this.muzzle.push(m);
      ship.add(m);
    }
  }

  tick(dt: number, flight: Flight, input: Input): void {
    const P = this.player;
    P.sinceHit += dt;
    P.pos.copy(flight.pos);
    P.vel.copy(flight.velDir).multiplyScalar(flight.speed);
    if (P.alive && P.sinceHit > T.player.regenDelay) P.hp = Math.min(T.player.hp, P.hp + T.player.regen * dt);
    if (flight.lastImpact > 0) {
      const dmg = Flight.impactDamage(flight.lastImpact) * T.player.hp;
      flight.lastImpact = 0;
      if (dmg > 0 && P.alive) {
        P.hp -= dmg;
        P.sinceHit = 0;
        this.audio.damage();
        if (P.hp <= 0) this.die(flight);
      }
    }

    // player cannons: alternate guns at fireRate
    if (P.alive && input.fire && input.locked) {
      this.fireAcc += dt * T.weapons.fireRate;
      while (this.fireAcc >= 1) {
        this.fireAcc -= 1;
        const g = GUNS[this.gun]!;
        this.gun = 1 - this.gun;
        _p.set(g[0], g[1], g[2]).applyQuaternion(flight.quat).add(flight.pos);
        _d.set((Math.random() - 0.5) * T.weapons.spread * 2, (Math.random() - 0.5) * T.weapons.spread * 2, 1).normalize().applyQuaternion(flight.quat);
        if (this.shots.fire("player", _p, _d, P.vel)) {
          P.fired++;
          this.muzzleT = 0.05;
          this.audio.cannon();
        }
      }
    } else this.fireAcc = Math.min(this.fireAcc, 0.999);
    this.muzzleT -= dt;
    this.lockAndLaunch(dt, flight, input);

    this.enemies.tick(dt, P, this.shots);
    for (const e of this.enemies.crashed) this.destroy(e, false);
    this.enemies.crashed.length = 0;
    // move rounds, then test the swept segment of each against its targets
    for (const s of this.shots.shots) {
      if (!s.alive) continue;
      _prev.copy(s.pos);
      s.ttl -= dt;
      if (s.ttl <= 0) {
        s.alive = false;
        continue;
      }
      s.pos.addScaledVector(s.vel, dt);
      if (s.side === "player") this.hitEnemies(s);
      else this.hitPlayer(s, flight);
      if (s.alive) this.hitRocks(s);
    }
  }

  /** Track the nearest glider inside the lock cone; RMB launches once the lock is full. */
  private lockAndLaunch(dt: number, flight: Flight, input: Input): void {
    const M = T.missile;
    this.missileCd -= dt;
    _fwdv.set(0, 0, 1).applyQuaternion(flight.quat);
    let best: Enemy | null = null, bd = Infinity;
    const cosCone = Math.cos(M.lockCone);
    for (const e of this.enemies.list) {
      if (!e.alive) continue;
      _d.subVectors(e.pos, flight.pos);
      const d = _d.length();
      if (d > M.lockRange || d < 1e-3 || _d.dot(_fwdv) / d < cosCone) continue;
      if (d < bd) (bd = d), (best = e);
    }
    if (best !== this.target) this.lock = 0;
    this.target = best;
    if (best) {
      const was = this.lock;
      this.lock = Math.min(1, this.lock + dt / M.lockTime);
      if (was < 1 && this.lock >= 1) this.audio.lock();
    }
    if (input.alt && this.player.alive && this.ammo > 0 && this.missileCd <= 0 && best && this.lock >= 1) {
      _p.set(0, -0.6, 2.0).applyQuaternion(flight.quat).add(flight.pos);
      if (this.missiles.fire(_p, _fwdv, this.player.vel, best)) {
        this.ammo--;
        this.missileCd = M.cooldown;
        this.audio.launch();
      }
    }
    this.missiles.tick(dt);
    for (const m of this.missiles.list) {
      if (!m.alive) continue;
      for (const e of this.enemies.list) {
        if (!e.alive) continue;
        const r = T.enemy.radius + M.fuse;
        if (m.pos.distanceToSquared(e.pos) > r * r) continue;
        m.alive = false;
        this.fx.spawn(m.pos, e.vel, 3);
        this.audio.explosion(0.6);
        if (this.enemies.damage(e, M.damage)) this.destroy(e);
        break;
      }
      if (m.alive) {
        for (let i = 0; i < this.rocks.count; i++) {
          const dx = m.pos.x - this.rocks.centers[i * 3]!, dy = m.pos.y - this.rocks.centers[i * 3 + 1]!, dz = m.pos.z - this.rocks.centers[i * 3 + 2]!;
          const r = this.rocks.radii[i]! * 0.9;
          if (dx * dx + dy * dy + dz * dz < r * r) {
            m.alive = false;
            this.fx.spawn(m.pos, ZEROV, 2.5);
            break;
          }
        }
      }
    }
  }

  /** Called by the mission at each wave: back to a full rack. */
  restock(): void {
    this.ammo = T.missile.count;
  }

  private hitEnemies(s: Shot): void {
    const r2 = T.enemy.radius * T.enemy.radius;
    for (const e of this.enemies.list) {
      if (!e.alive || segDist2(_prev, s.pos, e.pos) > r2) continue;
      this.shots.kill(s);
      this.player.hits++;
      this.fx.spark(s.pos);
      this.audio.hit();
      if (this.enemies.damage(e, T.weapons.damage)) this.destroy(e);
      return;
    }
  }

  private hitPlayer(s: Shot, flight: Flight): void {
    const r = T.arena.shipRadius * 0.8;
    if (!this.player.alive || segDist2(_prev, s.pos, flight.pos) > r * r) return;
    this.shots.kill(s);
    this.fx.spark(s.pos);
    this.player.hp -= T.weapons.enemyDamage;
    this.player.sinceHit = 0;
    flight.sinceHit = 0.25; // a light shake and flash, not the rock-hit slam
    this.audio.damage();
    if (this.player.hp <= 0) this.die(flight);
  }

  private die(flight: Flight): void {
    this.player.hp = 0;
    this.player.alive = false;
    this.fx.spawn(flight.pos, this.player.vel, 6);
    this.audio.explosion(1);
    this.ship.visible = false;
  }

  private hitRocks(s: Shot): void {
    const R = this.rocks;
    for (let i = 0; i < R.count; i++) {
      const dx = s.pos.x - R.centers[i * 3]!, dy = s.pos.y - R.centers[i * 3 + 1]!, dz = s.pos.z - R.centers[i * 3 + 2]!;
      const r = R.radii[i]! * 0.9;
      if (dx * dx + dy * dy + dz * dz > r * r) continue;
      this.shots.kill(s);
      this.fx.spark(s.pos);
      return;
    }
  }

  private destroy(e: Enemy, byPlayer = true): void {
    if (byPlayer) this.player.kills++;
    this.fx.spawn(e.pos, e.vel, 5);
    this.audio.explosion(0.8);
  }

  render(alpha: number, dt: number, camPos: THREE.Vector3): void {
    void alpha;
    this.shots.update();
    this.missiles.update();
    this.enemies.render(alpha, dt);
    this.fx.update(dt, camPos);
    const on = this.muzzleT > 0;
    for (const m of this.muzzle) {
      m.visible = on;
      if (on) m.lookAt(camPos);
    }
  }
}
