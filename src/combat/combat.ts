import * as THREE from "three";
import type { Asteroids } from "@/world/asteroids";
import { T, clamp } from "@/core/tunables";
import { Flight } from "@/sim/flight";
import { D } from "@/core/difficulty";
import type { Input } from "@/core/input";
import { Projectiles, type Shot } from "@/combat/projectiles";
import { Enemies, type Enemy } from "@/combat/enemies";
import { Explosions } from "@/fx/explosion";
import { Missiles } from "@/combat/missiles";
import type { Audio } from "@/audio/audio";
import type { Lockable, Tracked } from "@/combat/targets";
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
  /** seconds left in the death sequence; 0 when not dying */
  dying: number;
  /** nose direction, so gliders can tell whether they are being looked at */
  fwd: THREE.Vector3;
}

const _p = new THREE.Vector3();
const _d = new THREE.Vector3();
const _seg = new THREE.Vector3();
const _n = new THREE.Vector3();
const _fwdv = new THREE.Vector3();
const ZEROV = new THREE.Vector3();
/** seconds between hull failure and the final burst */
const DEATH_T = 1.6;

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
  /** a glider the player destroyed (pos, vel); the replay hooks this */
  onKill: ((pos: THREE.Vector3, vel: THREE.Vector3, scale: number, seed: number, victimId: number) => void) | null = null;
  /** a rock broke (the replay records it) */
  onRockBurst: ((pos: THREE.Vector3, scale: number, seed: number) => void) | null = null;
  /** a player round left the gun: world position and velocity (the replay records them) */
  onFire: ((pos: THREE.Vector3, vel: THREE.Vector3) => void) | null = null;
  readonly missiles = new Missiles();
  /** nearest glider inside the lock cone, and how far along the lock is (0..1) */
  target: Tracked | null = null;
  lock = 0;
  /** mission-owned things the player can shoot and lock (turrets, shield nodes, a hull) */
  readonly extras: Lockable[] = [];
  /** mission-owned things enemy rounds can hurt (an escort) */
  readonly friendlies: Lockable[] = [];
  ammo = T.missile.count;
  /** rack size and hull points for the current ship (stats × T) */
  maxAmmo = T.missile.count;
  maxHp = T.player.hp;
  gunDamage = T.weapons.damage;
  private missileCd = 0;
  /** seconds into rebuilding the next torpedo (T.missile.reload) */
  private reloadT = 0;
  readonly player: PlayerState = { hp: T.player.hp, alive: true, kills: 0, fired: 0, hits: 0, vel: new THREE.Vector3(), pos: new THREE.Vector3(), sinceHit: 99, dying: 0, fwd: new THREE.Vector3(0, 0, 1) };
  practice = false;
  private fireAcc = 0;
  private gun = 0;
  private readonly muzzle: THREE.Mesh[] = [];
  private muzzleT = 0;

  constructor(readonly enemies: Enemies, private readonly rocks: Asteroids, readonly ship: THREE.Object3D, private readonly audio: Audio) {
    this.group.add(this.shots.group, this.fx.group, enemies.group, this.missiles.group);
    enemies.targets.push(this.player);
    enemies.onCrash = (pos, n, speed) => this.fx.crash(pos, n, speed);
    const geo = new THREE.CircleGeometry(0.55, 10);
    for (const g of GUNS) {
      const m = noEdge(new THREE.Mesh(geo, glowMaterial(0xdff2ff, 3)));
      m.name = "muzzle-flash";
      m.position.set(g[0], g[1], g[2] + 0.4);
      m.visible = false;
      this.muzzle.push(m);
      ship.add(m);
    }
  }

  /** Apply the hull's multipliers; called once at start and whenever the ship changes. */
  setShip(flight: Flight): void {
    const S = flight.stats;
    this.maxHp = T.player.hp * S.hull;
    this.maxAmmo = S.missiles;
    this.gunDamage = T.weapons.damage * S.guns;
    this.player.hp = this.maxHp;
    this.ammo = this.maxAmmo;
  }

  tick(dt: number, flight: Flight, input: Input): void {
    const P = this.player;
    P.sinceHit += dt;
    P.pos.copy(flight.pos);
    P.vel.copy(flight.velDir).multiplyScalar(flight.speed);
    P.fwd.set(0, 0, 1).applyQuaternion(flight.quat);
    if (P.alive && P.sinceHit > T.player.regenDelay) P.hp = Math.min(this.maxHp, P.hp + T.player.regen * dt * flight.stats.hull);
    if (flight.lastImpact > 0) {
      // a crash hurts the same fraction of hull whatever the ship: a big hull is not a crash licence
      const dmg = Flight.impactDamage(flight.lastImpact) * this.maxHp;
      _p.copy(flight.pos).addScaledVector(flight.lastImpactNormal, -T.arena.shipRadius * flight.stats.size * 0.8);
      this.fx.crash(_p, flight.lastImpactNormal, flight.lastImpact);
      flight.lastImpact = 0;
      if (dmg > 0) this.hurt(dmg, flight);
    }
    if (P.dying > 0) this.dieTick(dt, flight);

    // player cannons: alternate guns at fireRate
    if (P.alive && P.dying === 0 && input.fire && input.locked) {
      this.fireAcc += dt * T.weapons.fireRate;
      while (this.fireAcc >= 1) {
        this.fireAcc -= 1;
        const g = GUNS[this.gun]!, sz = flight.stats.size;
        this.gun = 1 - this.gun;
        _p.set(g[0] * sz, g[1] * sz, g[2] * sz).applyQuaternion(flight.quat).add(flight.pos);
        _d.set((Math.random() - 0.5) * T.weapons.spread * 2, (Math.random() - 0.5) * T.weapons.spread * 2, 1).normalize().applyQuaternion(flight.quat);
        const shot = this.shots.fire("player", _p, _d, P.vel);
        if (shot) {
          P.fired++;
          this.muzzleT = 0.05;
          this.audio.cannon();
          this.onFire?.(shot.pos, shot.vel);
        }
      }
    } else this.fireAcc = Math.min(this.fireAcc, 0.999);
    this.muzzleT -= dt;
    this.lockAndLaunch(dt, flight, input);

    this.enemies.tick(dt, P, this.shots);
    // every rock crash is the player's kill: chased into a rock or hit by a fragment alike (Ethan, 2026-09-05)
    for (const e of this.enemies.crashed) this.destroy(e, true);
    this.enemies.crashed.length = 0;
    // move rounds, then test the swept segment of each against its targets. The segment start is the shot's
    // own `prevPos`, which the renderer also interpolates from: a second local copy of it here is what made
    // tracers draw back at the muzzle for a whole sortie (Ethan, 2026-09-08: "it's like the blaster shoots
    // backwards"). One field, written once a tick, is the fix.
    for (const s of this.shots.shots) {
      if (!s.alive) continue;
      s.prevPos.copy(s.pos);
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
    if (this.ammo < this.maxAmmo) {
      this.reloadT += dt;
      if (this.reloadT >= M.reload) (this.reloadT = 0), this.ammo++;
    } else this.reloadT = 0;
    _fwdv.set(0, 0, 1).applyQuaternion(flight.quat);
    let best: Tracked | null = null, bd = Infinity;
    const cosCone = Math.cos(M.lockCone);
    const consider = (e: Tracked) => {
      if (!e.alive) return;
      _d.subVectors(e.pos, flight.pos);
      const d = _d.length();
      if (d > M.lockRange || d < 1e-3 || _d.dot(_fwdv) / d < cosCone) return;
      if (d < bd) (bd = d), (best = e);
    };
    for (const e of this.enemies.list) consider(e);
    for (const x of this.extras) consider(x);
    if (best !== this.target) this.lock = 0;
    this.target = best;
    if (best) {
      const was = this.lock;
      this.lock = Math.min(1, this.lock + dt / M.lockTime);
      if (was < 1 && this.lock >= 1) this.audio.lock();
    }
    if (input.alt && this.player.alive && this.player.dying === 0 && this.ammo > 0 && this.missileCd <= 0 && best && this.lock >= 1) {
      _p.set(0, -0.6 * flight.stats.size, 2.0 * flight.stats.size).applyQuaternion(flight.quat).add(flight.pos);
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
        const r = e.radius + M.fuse;
        if (m.pos.distanceToSquared(e.pos) > r * r) continue;
        m.alive = false;
        this.fx.spawn(m.pos, e.vel, 3, undefined, "impact");
        this.audio.explosion(0.6);
        if (this.enemies.damage(e, M.damage)) this.destroy(e);
        break;
      }
      if (m.alive)
        for (const x of this.extras) {
          if (!x.alive) continue;
          const r = x.radius + M.fuse;
          if (x.hits ? !x.hits(m.pos, m.pos) : m.pos.distanceToSquared(x.pos) > r * r) continue;
          m.alive = false;
          this.fx.spawn(m.pos, ZEROV, 3, undefined, "impact");
          this.audio.explosion(0.6);
          x.damage(M.damage);
          break;
        }
      if (m.alive) {
        for (let i = 0; i < this.rocks.count; i++) {
          const dx = m.pos.x - this.rocks.centers[i * 3]!, dy = m.pos.y - this.rocks.centers[i * 3 + 1]!, dz = m.pos.z - this.rocks.centers[i * 3 + 2]!;
          const r = this.rocks.radii[i]! * 0.9;
          if (dx * dx + dy * dy + dz * dz < r * r) {
            m.alive = false;
            const R = this.rocks.radii[i]!;
            if (this.rocks.damage(i, M.damage, m.vel)) this.rockBurst(m.pos, R);
            else this.fx.spawn(m.pos, ZEROV, 2.5, undefined, "impact");
            break;
          }
        }
      }
    }
  }

  /** Called by the mission at each wave: back to a full rack. */
  restock(): void {
    this.ammo = this.maxAmmo;
    this.reloadT = 0;
  }

  private hitEnemies(s: Shot): void {
    for (const e of this.enemies.list) {
      if (!e.alive || segDist2(s.prevPos, s.pos, e.pos) > e.radius * e.radius) continue;
      this.shots.kill(s);
      this.player.hits++;
      this.fx.spark(s.pos);
      this.audio.hit();
      if (this.enemies.damage(e, this.gunDamage)) this.destroy(e);
      return;
    }
    for (const x of this.extras) {
      if (!x.alive || (x.hits ? !x.hits(s.prevPos, s.pos) : segDist2(s.prevPos, s.pos, x.pos) > x.radius * x.radius)) continue;
      this.shots.kill(s);
      this.player.hits++;
      this.fx.spark(s.pos);
      this.audio.hit();
      x.damage(this.gunDamage);
      return;
    }
  }

  private hitPlayer(s: Shot, flight: Flight): void {
    for (const x of this.friendlies) {
      if (!x.alive || segDist2(s.prevPos, s.pos, x.pos) > x.radius * x.radius) continue;
      this.shots.kill(s);
      this.fx.spark(s.pos);
      x.damage(T.weapons.enemyDamage * s.dmg * D.enemyDamage);
      return;
    }
    const r = T.arena.shipRadius * 0.8 * flight.stats.size;
    if (!this.player.alive || segDist2(s.prevPos, s.pos, flight.pos) > r * r) return;
    this.shots.kill(s);
    this.fx.spark(s.pos);
    flight.sinceHit = Math.max(flight.sinceHit, 0.25); // a light shake and flash, not the rock-hit slam
    this.hurt(T.weapons.enemyDamage * s.dmg * D.enemyDamage, flight);
  }

  /** Every source of player damage comes through here; a dying ship takes no more. */
  hurt(amount: number, flight: Flight): void {
    if (this.practice) return;
    const P = this.player;
    if (!P.alive || P.dying > 0) return;
    P.hp -= amount;
    P.sinceHit = 0;
    this.audio.damage();
    if (P.hp <= 0) this.die(flight);
  }

  /** Hull failure: controls die, the ship tumbles and burns for `DEATH_T` seconds, then the big burst. */
  private die(flight: Flight): void {
    const P = this.player;
    P.hp = 0;
    P.dying = DEATH_T;
    flight.dead = true;
    this.fx.spawn(flight.pos, P.vel, 2, undefined, "impact");
    this.audio.explosion(0.7);
  }

  private dieTick(dt: number, flight: Flight): void {
    const P = this.player;
    const was = P.dying;
    P.dying -= dt;
    // a small burst every quarter second somewhere on the hull
    if (Math.floor(was * 4) !== Math.floor(P.dying * 4)) {
      _p.set((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 8).multiplyScalar(flight.stats.size).applyQuaternion(flight.quat).add(flight.pos);
      this.fx.spawn(_p, P.vel, 1.2 * flight.stats.size, undefined, "impact");
      this.audio.explosion(0.35);
    }
    if (P.dying <= 0) {
      P.dying = 0;
      P.alive = false;
      this.fx.spawn(flight.pos, P.vel, 6 * flight.stats.size);
      this.audio.explosion(1);
      this.ship.visible = false;
    }
  }

  private hitRocks(s: Shot): void {
    const R = this.rocks;
    for (let i = 0; i < R.count; i++) {
      const dx = s.pos.x - R.centers[i * 3]!, dy = s.pos.y - R.centers[i * 3 + 1]!, dz = s.pos.z - R.centers[i * 3 + 2]!;
      const r = R.radii[i]! * 0.9;
      if (dx * dx + dy * dy + dz * dz > r * r) continue;
      this.shots.kill(s);
      // only the player's rounds chip rocks; a broken rock bursts and its pieces fly on with the shot
      if (s.side === "player" && R.damage(i, this.gunDamage, s.vel)) this.rockBurst(s.pos, r);
      else this.fx.spark(s.pos);
      return;
    }
  }

  /** A rock of `radius` breaking at `pos`: debris burst plus the crunch, both scaled by size. */
  private rockBurst(pos: THREE.Vector3, radius: number): void {
    const scale = 1.5 + radius * 0.12;
    const seed = this.fx.spawn(pos, ZEROV, scale, undefined, "rock");
    this.onRockBurst?.(pos, scale, seed);
    this.audio.crunch(radius / 10);
  }

  /** Public so missions can blow up their own things with the same look and sound. */
  burst(pos: THREE.Vector3, vel: THREE.Vector3, scale: number, loud = 0.8): void {
    this.fx.spawn(pos, vel, scale);
    this.audio.explosion(loud);
  }

  private destroy(e: Enemy, byPlayer = true): void {
    // Burst scale and seed are recorded verbatim so replay reconstructs this breakup.
    const big = e.radius / T.enemy.radius;
    const scale = 5 * Math.sqrt(big);
    const seed = this.fx.spawn(e.pos, e.vel, scale);
    if (byPlayer) {
      this.player.kills++;
      this.onKill?.(e.pos, e.vel, scale, seed, e.id);
    }
    this.audio.explosion(Math.min(1, 0.8 * Math.sqrt(big)));
  }

  render(alpha: number, dt: number, camPos: THREE.Vector3): void {
    this.shots.update(alpha);
    this.missiles.update(alpha);
    this.enemies.render(alpha, dt);
    this.fx.update(dt, camPos);
    const on = this.muzzleT > 0;
    for (const m of this.muzzle) {
      m.visible = on;
      if (on) m.lookAt(camPos);
    }
  }
}
