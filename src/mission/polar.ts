import * as THREE from 'three';
import { Mission, fmt, type MissionCtx } from '@/mission/mission';
import type { PolarLevel } from '@/mission/levels';
import { FleetCraft, Defenders, fireCarrier } from '@/mission/fleet';
import { PolarTerrain } from '@/world/polar-terrain';
import { HULLS } from '@/ships/hulls';
import { buildFlagship } from '@/ships/episode-alien';
import { Capital } from '@/combat/capital';
import { toonMaterial, glowMaterial } from '@/render/toon';
import { DroneSalvo } from '@/fx/drone-salvo';
import { T } from '@/core/tunables';
import { solidHit } from '@/world/solid';

/** Escort → defend the drilling site → the real drone salvo clears the attacking fleet. */
export class PolarMission extends Mission {
  readonly terrain = new PolarTerrain();
  readonly cargo: FleetCraft;
  readonly carrier: FleetCraft;
  readonly site: FleetCraft;
  readonly defenders: Defenders;
  readonly attackers: FleetCraft[] = [];
  readonly salvo: DroneSalvo;
  stage: 'escort' | 'defend' | 'drones' = 'escort';
  stageClock = 0;
  private spawnClock: number;
  private spawned = 0;
  private docked = false;
  private readonly cargoDestination = new THREE.Vector3(0, -105, 40);
  private readonly carrierDestination = new THREE.Vector3(-450, 180, -200);
  private readonly hit = solidHit();
  private capitalFire = 4;
  private readonly allies: FleetCraft[];
  private readonly movingAllies: FleetCraft[];

  constructor(override readonly def: PolarLevel, ctx: MissionCtx) {
    super(def, ctx);
    this.spawnClock = def.firstDelay;
    this.winTitle = 'EARTH HOLDS';
    this.group.add(this.terrain.group);
    ctx.combat.solids.items.push(this.terrain);
    ctx.combat.enemies.terrain = ctx.combat.solids;
    this.site = new FleetCraft({ name: 'OUTPOST', model: outpost(), size: 140, hp: def.siteHp, pos: [0, -156, 0] }, ctx.combat);
    this.cargo = new FleetCraft({ name: 'TEL’TAK', model: HULLS.cargo!, size: 45, hp: def.escortHp, pos: [220, 200, -1550] }, ctx.combat);
    this.carrier = new FleetCraft({ name: 'PROMETHEUS', model: HULLS.prometheus!, size: 380, hp: def.carrierHp, pos: [-450, 180, -1050] }, ctx.combat);
    this.defenders = new Defenders(ctx.combat, this.terrain, this.cargo);
    this.allies = [this.cargo, this.carrier, this.site];
    for (const ally of this.allies) {
      this.group.add(ally.root); ctx.combat.friendlies.push(ally); ctx.combat.enemies.targets.push(ally); ctx.combat.solids.items.push(ally);
    }
    for (let i = 0; i < def.defenders; i++) {
      const ally = new FleetCraft({ name: `F-302 / ${i + 1}`, model: HULLS.f11!, size: 28, hp: 110, pos: [i % 2 ? 190 : -190, 100 + i * 40, -1750 + i * 70] }, ctx.combat);
      this.defenders.craft.push(ally); this.group.add(ally.root); ctx.combat.friendlies.push(ally); ctx.combat.enemies.targets.push(ally); ctx.combat.solids.items.push(ally);
    }
    this.movingAllies = [...this.allies, ...this.defenders.craft];
    const positions: [number, number, number][] = [[350, 1450, 700], [-1650, 1100, 550], [1600, 1200, -150]];
    for (let i = 0; i < positions.length; i++) {
      const hostile = new FleetCraft({ name: i === 0 ? 'ANUBIS · SHIELDED FLAGSHIP' : 'HA’TAK · SHIELDED', model: i === 0 ? buildFlagship() : new Capital().group, size: i === 0 ? 1050 : 620, hp: 1500, pos: positions[i]!, yaw: Math.PI }, ctx.combat);
      hostile.shielded = true; this.attackers.push(hostile); this.group.add(hostile.root); ctx.combat.extras.push(hostile); ctx.combat.solids.items.push(hostile);
    }
    this.salvo = new DroneSalvo(new THREE.Vector3(0, -124, 0));
    this.group.add(this.salvo.group);
    this.marker = this.cargo;
  }

  override get holdsFlight(): boolean { return this.phase === 'intro'; }

  protected begin(): void { this.phase = 'run'; this.ctx.audio.ui(); }

  override beforeCombat(dt: number): void {
    const f = this.ctx.flight, C = this.ctx.combat;
    for (const craft of this.allies) craft.beginTick();
    if (!this.done && this.phase !== 'intro') {
      if (this.stage === 'escort') {
        this.docked = this.cargo.moveTo(this.cargoDestination, this.def.escortSpeed, dt);
        this.carrier.moveTo(this.carrierDestination, this.def.escortSpeed * .7, dt);
      }
      this.defenders.tick(dt);
      fireCarrier(this.carrier, C, dt);
      for (const enemy of C.enemies.list) if (enemy.alive && enemy.kind === 'bomber') enemy.tgt = this.stage === 'escort' ? 1 : 3;
    }
    if (C.solids.sweep(f.prevPos, f.pos, T.arena.shipRadius * f.stats.size, this.hit)) {
      f.pos.copy(this.hit.point).addScaledVector(this.hit.normal, T.episode.contactMargin);
      f.bounce(this.hit.normal); C.impactCause = 'terrain';
    }
  }

  protected run(dt: number): void {
    if (!this.cargo.alive || !this.site.alive || !this.carrier.alive) {
      const lost = !this.cargo.alive ? 'Tel’tak' : !this.site.alive ? 'outpost' : 'Prometheus';
      this.fail(`The ${lost} was destroyed before the drones could secure the sky.`, 'DEFENSE BROKEN'); return;
    }
    this.stageClock += dt;
    if (this.stage === 'escort' && this.docked) {
      this.stage = 'defend'; this.stageClock = 0; this.ctx.combat.restock(); this.ctx.audio.ui();
    }
    if (this.stage === 'defend' && this.stageClock >= this.def.defenseSeconds) {
      this.stage = 'drones'; this.stageClock = 0;
      this.salvo.launch(this.attackers.map(craft => ({ pos: craft.pos, strike: () => { craft.shielded = false; craft.damage(craft.maxHp); } })));
      this.ctx.audio.win();
    }
    if (this.stage !== 'drones') {
      this.spawnClock -= dt;
      if (this.spawnClock <= 0) { this.spawnClock = this.def.interval; this.reinforce(); }
      this.fireFlagship(dt);
    } else {
      this.salvo.tick(dt);
      // The salvo also sweeps fighter-sized attackers out of the defended airspace, one burst at a time.
      if (Math.floor(this.stageClock * 3) !== Math.floor((this.stageClock - dt) * 3)) {
        const enemy = this.ctx.combat.enemies.list.find(e => e.alive);
        if (enemy) this.ctx.combat.damageEnemy(enemy, enemy.hp + 1, false);
      }
      if (this.stageClock >= this.def.droneSeconds && this.salvo.complete && this.attackers.every(c => !c.alive)) { this.win(); return; }
    }
    this.marker = this.stage === 'escort' ? this.cargo : this.site;
    const task = this.stage === 'escort' ? `ESCORT · ${Math.round(this.cargo.pos.distanceTo(this.cargoDestination))} m to outpost` : this.stage === 'defend' ? `DEFEND · drones ready in ${Math.ceil(this.def.defenseSeconds - this.stageClock)} s · bombers attack the outpost` : 'DRONES AWAY · hold clear of the rising salvo';
    this.line = `${task}\nTel’tak ${this.cargo.hullPercent}% · Prometheus ${this.carrier.hullPercent}% · Outpost ${this.site.hullPercent}%`;
  }

  private reinforce(): void {
    const C = this.ctx.combat;
    for (let i = 0; i < this.def.groupSize && C.enemies.aliveCount < this.def.maxAlive; i++) {
      const kind = this.def.kinds[this.spawned % this.def.kinds.length]!;
      const angle = this.spawned * 2.399963;
      const anchor = this.stage === 'escort' ? this.cargo.pos : this.site.pos;
      _spawn.copy(anchor).add(_offset.set(Math.sin(angle) * 700, 300 + i * 50, 650 + Math.cos(angle) * 200));
      _spawn.y = Math.max(_spawn.y, this.terrain.heightAt(_spawn.x, _spawn.z) + 200);
      const target = kind === 'bomber' ? (this.stage === 'escort' ? 1 : 3) : kind === 'interceptor' && this.defenders.craft.length ? 4 + this.spawned % this.defenders.craft.length : this.spawned % 3 === 0 ? 0 : 2;
      const toward = C.enemies.targets[target]?.pos ?? C.player.pos;
      const enemy = C.enemies.spawn(_spawn, toward, kind); enemy.tgt = target;
      this.spawned++;
    }
  }

  private fireFlagship(dt: number): void {
    if ((this.capitalFire -= dt) > 0 || !this.carrier.alive) return;
    this.capitalFire = 3.2;
    const cap = this.attackers[0]!;
    _aim.subVectors(this.carrier.pos, cap.pos).normalize();
    _spawn.copy(cap.pos).addScaledVector(_aim, cap.radius + 12);
    this.ctx.combat.shots.fire('enemy', _spawn, _aim, cap.vel, 1.8);
  }

  override render(dt: number, alpha = 1): void {
    for (const craft of this.movingAllies) craft.render(dt, alpha);
    this.salvo.render(alpha);
  }

  override placeReturnGate(pos: THREE.Vector3): void { pos.y = Math.max(pos.y, this.terrain.heightAt(pos.x, pos.z) + 350); }
  override summary(): string { return `${super.summary()}\nOutpost ${this.site.hullPercent}% · Tel’tak ${this.cargo.hullPercent}%\nPrometheus ${this.carrier.hullPercent}% · ${this.attackers.filter(c => !c.alive).length} capital ships destroyed by drones\nDefense held ${fmt(this.def.defenseSeconds)}`; }
}

function outpost(): THREE.Group {
  const group = new THREE.Group(), steel = toonMaterial(0x626f79), dark = toonMaterial(0x203844), ice = toonMaterial(0x7bc3d9), gold = toonMaterial(0xb9a472), light = glowMaterial(0x7fe5e6, 1.8);
  const add = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => { const mesh = new THREE.Mesh(g, m); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); };
  add(new THREE.CylinderGeometry(65, 70, 10, 32), dark, 0, -18, 0);
  add(new THREE.CylinderGeometry(48, 52, 8, 24), ice, 0, -11, 0);
  add(new THREE.CylinderGeometry(25, 33, 12, 8), steel, 0, -2, 0);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, x = Math.cos(a) * 39, z = Math.sin(a) * 39;
    add(new THREE.BoxGeometry(9, 34, 9), steel, x, 9, z);
    add(new THREE.BoxGeometry(10, 5, 10), gold, x, 28, z);
    add(new THREE.BoxGeometry(2, 16, 2), light, x, 12, z + 5);
  }
  add(new THREE.CylinderGeometry(8, 11, 30, 8), gold, 0, 17, 0);
  add(new THREE.SphereGeometry(7, 10, 6), light, 0, 36, 0);
  return group;
}
const _spawn = new THREE.Vector3(), _offset = new THREE.Vector3(), _aim = new THREE.Vector3();
