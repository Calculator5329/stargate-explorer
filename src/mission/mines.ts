import * as THREE from "three";
import type { Lockable } from "@/combat/targets";
import type { MissionCtx } from "@/mission/mission";
import { glowMaterial, toonMaterial } from "@/render/toon";
import { noEdge } from "@/render/layers";
import { outlineShell } from "@/render/outline";

const ZERO = new THREE.Vector3();
const _d = new THREE.Vector3();
const TRIGGER = 24;
const BLAST = 60;
const DAMAGE = 45;

interface Mine extends Lockable {
  mesh: THREE.Group;
  core: THREE.Mesh;
  phase: number;
}

/**
 * Proximity mines: a dark faceted shell with a pulsing red core. Fly within
 * `TRIGGER` and it goes off for a big chunk of hull; shoot it (10 hp) and it
 * goes off where it sits, hurting any glider inside the blast. Missions lay
 * them where a sloppy line would take you: gate rims, the ring around the hull.
 */
export class Mines {
  readonly group = new THREE.Group();
  readonly list: Mine[] = [];
  private readonly shellGeo = new THREE.IcosahedronGeometry(4.2, 0);
  private readonly coreGeo = new THREE.IcosahedronGeometry(2.0, 1);
  private readonly shellMat = toonMaterial(0x3a2a30);
  private t = 0;

  constructor(private readonly ctx: MissionCtx) {}

  add(pos: THREE.Vector3): void {
    const mesh = new THREE.Group();
    const shell = new THREE.Mesh(this.shellGeo, this.shellMat);
    const core = noEdge(new THREE.Mesh(this.coreGeo, glowMaterial(0xff4a2a, 3.0)));
    mesh.add(shell, outlineShell(this.shellGeo.attributes.position!.array), core);
    mesh.position.copy(pos);
    mesh.quaternion.random();
    this.group.add(mesh);
    const self = this;
    const m: Mine = {
      mesh, core, phase: Math.random() * 6.28, pos: mesh.position, vel: ZERO, alive: true, radius: 5,
      damage(amount) {
        void amount; // one hit is enough
        if (!this.alive) return false;
        self.explode(this);
        return true;
      },
    };
    this.list.push(m);
    this.ctx.combat.extras.push(m);
  }

  private explode(m: Mine): void {
    m.alive = false;
    m.mesh.visible = false;
    const C = this.ctx.combat;
    C.burst(m.pos, ZERO, 4, 0.9);
    // the player inside the blast takes the hit; so does any glider
    if (m.pos.distanceTo(this.ctx.flight.pos) < BLAST) C.hurt(DAMAGE, this.ctx.flight);
    for (const e of C.enemies.list) if (e.alive && e.pos.distanceTo(m.pos) < BLAST) C.enemies.damage(e, DAMAGE * 2);
  }

  tick(): void {
    const f = this.ctx.flight, R = TRIGGER + f.stats.size * 3;
    for (const m of this.list) {
      if (!m.alive) continue;
      if (_d.subVectors(m.pos, f.pos).lengthSq() < R * R) this.explode(m);
    }
  }

  render(dt: number): void {
    this.t += dt;
    for (const m of this.list) {
      if (!m.alive) continue;
      m.core.scale.setScalar(0.85 + 0.35 * Math.max(0, Math.sin(this.t * 4 + m.phase)));
      m.mesh.rotation.y += dt * 0.4;
    }
  }
}
