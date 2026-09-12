import * as THREE from 'three';
import { Mission, fmt, type MissionCtx } from '@/mission/mission';
import type { DeckLevel } from '@/mission/levels';
import { FleetCraft, Defenders } from '@/mission/fleet';
import { StrikeDeck } from '@/world/strike-deck';
import { solidHit } from '@/world/solid';
import type { Tracked } from '@/combat/targets';
import { HULLS } from '@/ships/hulls';
import { toonMaterial, glowMaterial } from '@/render/toon';
import { T } from '@/core/tunables';

/** Cross the jump corridor, attack the exposed cooling vent, turn out and escape. */
export class DeckMission extends Mission {
  readonly deck = new StrikeDeck();
  readonly vent: FleetCraft;
  readonly turrets: FleetCraft[] = [];
  readonly defenders: Defenders;
  stage: 'approach' | 'jump' | 'attack' | 'escape' = 'approach';
  stageClock = 0;
  private spawnClock: number;
  private spawned = 0;
  private readonly hit = solidHit();
  private readonly jumpFrom = new THREE.Vector3();
  private readonly jumpRing: THREE.Mesh;
  private readonly escapeRing: THREE.Mesh;
  private readonly jumpMarker: Tracked;
  private readonly escapeMarker: Tracked;
  private readonly jumpRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

  constructor(override readonly def: DeckLevel, ctx: MissionCtx) {
    super(def, ctx);
    this.spawnClock = def.interval;
    this.winTitle = 'SUPERWEAPON DISABLED';
    this.group.add(this.deck.group);
    ctx.combat.solids.items.push(this.deck);
    ctx.combat.enemies.terrain = ctx.combat.solids;
    this.vent = new FleetCraft({ name: 'COOLING VENT', model: ventModel(), size: 100, hp: def.ventHp, pos: this.deck.ventPos.toArray() as [number, number, number] }, ctx.combat);
    this.vent.shielded = true;
    this.group.add(this.vent.root); ctx.combat.extras.push(this.vent); ctx.combat.solids.items.push(this.vent);
    for (const pos of this.deck.turretPositions) {
      const turret = new FleetCraft({ name: 'DECK GUN', model: turretModel(), size: 58, hp: def.turretHp, pos: pos.toArray() as [number, number, number] }, ctx.combat);
      turret.fireCd = 1 + this.turrets.length * .3;
      this.turrets.push(turret); this.group.add(turret.root); ctx.combat.extras.push(turret); ctx.combat.solids.items.push(turret);
    }
    this.defenders = new Defenders(ctx.combat, this.deck, this.vent);
    for (let i = 0; i < def.defenders; i++) {
      const ally = new FleetCraft({ name: `F-302 / ${i + 1}`, model: HULLS.f11!, size: 28, hp: 160, pos: [i % 2 ? 300 : -300, 440, 1880], yaw: Math.PI }, ctx.combat);
      this.defenders.craft.push(ally); this.group.add(ally.root); ctx.combat.friendlies.push(ally); ctx.combat.enemies.targets.push(ally); ctx.combat.solids.items.push(ally);
    }
    this.jumpRing = new THREE.Mesh(new THREE.TorusGeometry(100, 3, 6, 48), glowMaterial(0x6fd9ff, 2));
    this.jumpRing.position.copy(this.deck.approach);
    this.escapeRing = new THREE.Mesh(new THREE.TorusGeometry(150, 4, 6, 48), glowMaterial(0x80ffbf, 2));
    this.escapeRing.position.copy(this.deck.escapePos); this.escapeRing.visible = false;
    this.group.add(this.jumpRing, this.escapeRing);
    this.jumpMarker = { pos: this.deck.approach, vel: ZERO, alive: true, radius: 100 };
    this.escapeMarker = { pos: this.deck.escapePos, vel: ZERO, alive: true, radius: 160 };
    this.marker = this.jumpMarker;
  }

  protected begin(): void { this.phase = 'run'; this.reinforce(this.def.escorts); this.ctx.audio.ui(); }
  override get holdsFlight(): boolean { return (this.phase === 'intro' || this.stage === 'jump') && !this.done; }

  override beforeCombat(dt: number): void {
    const f = this.ctx.flight, C = this.ctx.combat;
    C.inTransit = this.stage === 'jump' && !this.done;
    if (C.inTransit) {
      f.prevPos.copy(f.pos); f.prevQuat.copy(f.quat);
      const t = Math.min(1, (this.stageClock + dt) / T.episode.jumpSeconds);
      f.pos.lerpVectors(this.jumpFrom, this.deck.jumpExit, t * t * (3 - 2 * t));
      f.quat.copy(this.jumpRotation); f.vel.set(0, 0, -90); f.velDir.set(0, 0, -1); f.speed = 90;
      f.move = null; f.moveThrust = false; f.lastImpact = 0;
      return;
    }
    if (this.phase !== 'intro' && !this.done) this.defenders.tick(dt);
    if (C.solids.sweep(f.prevPos, f.pos, T.arena.shipRadius * f.stats.size, this.hit)) {
      f.pos.copy(this.hit.point).addScaledVector(this.hit.normal, T.episode.contactMargin);
      f.bounce(this.hit.normal); C.impactCause = 'hull';
    }
  }

  protected run(dt: number): void {
    this.stageClock += dt;
    const f = this.ctx.flight, C = this.ctx.combat;
    if (this.stage !== 'escape' && this.clock > this.def.timeLimit) { this.fail('The firing window closed before the cooling system was disabled.', 'STRIKE WINDOW LOST'); return; }
    if (this.stage === 'approach') {
      this.line = `JUMP CORRIDOR · ${Math.round(f.pos.distanceTo(this.deck.approach))} m · cross the blue ring`;
      // Swept crossing: a boosted ship cannot skip the entry between two sim ticks.
      const dz = f.pos.z - f.prevPos.z;
      const t = dz ? (this.deck.approach.z - f.prevPos.z) / dz : -1;
      if (t >= 0 && t <= 1 && _cross.lerpVectors(f.prevPos, f.pos, t).distanceTo(this.deck.approach) < 100 && dz < 0) {
        this.stage = 'jump'; this.stageClock = 0; this.jumpFrom.copy(f.pos); C.inTransit = true; this.ctx.audio.ui();
      }
    } else if (this.stage === 'jump') {
      this.line = 'HYPERSPACE HOP · crossing the shield';
      this.jumpRing.scale.setScalar(1 + this.stageClock * 2);
      if (this.stageClock >= T.episode.jumpSeconds) {
        this.stage = 'attack'; this.stageClock = 0; this.jumpRing.visible = false; this.vent.shielded = false; C.inTransit = false;
        f.prevPos.copy(f.pos); this.marker = this.vent; C.restock(); this.ctx.audio.ui();
      }
    } else if (this.stage === 'attack') {
      this.line = `COOLING VENT ${this.vent.hullPercent}% · guns and torpedoes both work\nDeck guns ${this.turrets.filter(t => t.alive).length} · ${Math.ceil(this.def.timeLimit - this.clock)} s to disable the weapon`;
      if (!this.vent.alive) {
        this.stage = 'escape'; this.stageClock = 0; this.escapeRing.visible = true; this.marker = this.escapeMarker; this.ctx.audio.ui();
      }
    } else {
      const distance = f.pos.distanceTo(this.deck.escapePos);
      this.line = `ESCAPE · ${Math.ceil(this.def.escapeSeconds - this.stageClock)} s · green beacon ${Math.round(distance)} m\nCooling system destroyed · turn away from the bulkhead and climb`;
      if (distance < 160) { this.win(); return; }
      if (this.stageClock > this.def.escapeSeconds) { this.fail('The vent was destroyed, but you did not clear the mothership before its defenses recovered.', 'ESCAPE FAILED'); return; }
    }
    if (this.stage !== 'jump') {
      if ((this.spawnClock -= dt) <= 0) { this.spawnClock = this.def.interval; this.reinforce(2); }
      this.fireTurrets(dt);
    }
  }

  private reinforce(count: number): void {
    const C = this.ctx.combat;
    for (let i = 0; i < count && C.enemies.aliveCount < this.def.maxAlive; i++) {
      const n = this.spawned++;
      _spawn.set(n % 2 ? 750 : -750, 650 + n % 3 * 80, 1300 + n % 4 * 90);
      const target = n % 3 && this.defenders.craft.length ? 1 + n % this.defenders.craft.length : 0;
      const enemy = C.enemies.spawn(_spawn, C.enemies.targets[target]?.pos ?? C.player.pos, this.def.kinds[n % this.def.kinds.length]!);
      enemy.tgt = target;
    }
  }

  private fireTurrets(dt: number): void {
    const C = this.ctx.combat;
    for (const turret of this.turrets) {
      if (!turret.alive || (turret.fireCd -= dt) > 0) continue;
      _aim.subVectors(this.ctx.flight.pos, turret.pos);
      const range = _aim.length();
      if (range > 1500 || range < 1) continue;
      _aim.addScaledVector(C.player.vel, range / T.weapons.enemyMuzzleSpeed).normalize();
      _spawn.copy(turret.pos).addScaledVector(_aim, turret.radius + 2);
      if (this.deck.sweep(_spawn, this.ctx.flight.pos, 0, this.hit)) continue;
      C.shots.fire('enemy', _spawn, _aim, ZERO, .8);
      turret.fireCd = 2.2;
    }
  }

  override render(dt: number, alpha = 1): void { for (const ally of this.defenders.craft) ally.render(dt, alpha); }
  override placeReturnGate(pos: THREE.Vector3): void { pos.y = Math.max(pos.y, 650); }
  override summary(): string { return `${super.summary()}\nCooling vent destroyed · deck guns ${this.turrets.filter(t => !t.alive).length}/${this.turrets.length}\nEscaped in ${fmt(this.stageClock)}`; }
}

function ventModel(): THREE.Group {
  const group = new THREE.Group();
  const core = new THREE.Mesh(new THREE.BoxGeometry(100, 76, 14), toonMaterial(0x315d64)); group.add(core);
  const light = glowMaterial(0x77f4ea, 1);
  for (let i = 0; i < 5; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(88, 5, 3), light); bar.position.set(0, -28 + i * 14, 9); group.add(bar);
  }
  return group;
}
function turretModel(): THREE.Group {
  const group = new THREE.Group(), gold = toonMaterial(0x998058), dark = toonMaterial(0x354442);
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(22, 29, 20, 8), gold));
  const top = new THREE.Mesh(new THREE.BoxGeometry(30, 20, 35), dark); top.position.y = 17; group.add(top);
  for (const x of [-10, 10]) { const gun = new THREE.Mesh(new THREE.BoxGeometry(7, 7, 43), gold); gun.position.set(x, 20, 18); group.add(gun); }
  return group;
}
const ZERO = new THREE.Vector3(), _cross = new THREE.Vector3(), _spawn = new THREE.Vector3(), _aim = new THREE.Vector3();
