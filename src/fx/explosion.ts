import * as THREE from "three";
import { noEdge } from "@/render/layers";
import { glowMaterial, toonMaterial } from "@/render/toon";
import { HIDDEN, Z_AXIS, dragDist, faceted, fadeOut, popIn, randInCone, randUnit, rr } from "@/fx/fx-util";

// Pools. When a pool is full the oldest live entry is recycled.
const BURSTS = 12;
const SPARKS = 24;
const CRASHES = 6;
// Per-entry instance budgets (a burst may use fewer chunks / streaks than its budget).
const CHUNKS = 20;
const EMBERS = 6; // the first EMBERS chunks trail an ember streak
const STREAKS = 10;
const BLOBS = 5;
const PUFFS = 4;
const SP_STREAKS = 3;
const CHIPS = 10;
const CRASH_PUFFS = 2;

const BURST_LIFE = 1.6;
const SPARK_LIFE = 0.2;
const CRASH_LIFE = 0.9;
const CHUNK_DRAG = 1.4;
const CHIP_DRAG = 2.2;

// Instance ranges in the shared meshes.
const FLASH_SPARK0 = BURSTS;
const FLASH_CRASH0 = BURSTS + SPARKS;
const FLASH_N = BURSTS + SPARKS + CRASHES;
const STREAK_EMBER0 = BURSTS * STREAKS;
const STREAK_SPARK0 = STREAK_EMBER0 + BURSTS * EMBERS;
const STREAK_N = STREAK_SPARK0 + SPARKS * SP_STREAKS;
const TETRA_CHIP0 = BURSTS * CHUNKS;
const TETRA_N = TETRA_CHIP0 + CRASHES * CHIPS;
const PUFF_CRASH0 = BURSTS * PUFFS;
const PUFF_N = PUFF_CRASH0 + CRASHES * CRASH_PUFFS;

const COL_SHIP = 0x2a2226;
const COL_ROCK = [0x8a4a32, 0x6e3c3a];
const COL_EMBER = new THREE.Color(0xffa040);
const COL_SPARK = new THREE.Color(0xfff0b0);
const COL_FLASH_BURST = new THREE.Color(0xfff4dc);
const COL_FLASH_SPARK = new THREE.Color(0xfff1c0);
const COL_FLASH_CRASH = new THREE.Color(0xffe0b8);
const COL_SMOKE = new THREE.Color(0x5b575f);
const COL_DUST = new THREE.Color(0x8a7d98);

const _obj = new THREE.Object3D();
const _p = new THREE.Vector3();
const _v = new THREE.Vector3();
const _d = new THREE.Vector3();
const _c = new THREE.Color();

interface Burst {
  t: number; // >= BURST_LIFE means idle
  live: boolean; // instances written since last hide
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  scale: number;
  nChunk: number;
  nStreak: number;
  chunkVel: Float32Array; // radial launch velocity, decays with CHUNK_DRAG
  chunkSpin: Float32Array; // two euler rates per chunk
  chunkSize: Float32Array;
  blobOff: Float32Array;
  blobR: Float32Array;
  streakVel: Float32Array;
  streakLen: Float32Array;
  puffOff: Float32Array;
  puffR: Float32Array;
}

interface Spark {
  t: number;
  live: boolean;
  pos: THREE.Vector3;
  vel: Float32Array; // SP_STREAKS * 3
}

interface Crash {
  t: number;
  live: boolean;
  pos: THREE.Vector3;
  normal: THREE.Vector3;
  k: number; // speed / 150
  nChip: number;
  chipVel: Float32Array;
  chipSpin: Float32Array;
  chipSize: Float32Array;
}

/**
 * Pooled cel explosions. Three staged effects share eight instanced meshes, so
 * the whole system costs at most eight draw calls however many bursts are live:
 *   flash discs (billboard, glow) · shockwave rings (billboard, glow, stepped fade)
 *   fireball cores (glow) · fireball rims (back-face shell, flat orange)
 *   streaks (stretched glow boxes: sparks and chunk embers, tinted per instance)
 *   tetrahedra (toon, tinted: dark ship chunks and rust rock chips)
 *   smoke puffs (toon dark grey, lit in bands) · dust cones (toon grey-violet).
 * `spawn` is the full staged burst, `spark` a 0.2 s hit pop, `crash` a rock impact.
 */
export class Explosions {
  readonly group = new THREE.Group();

  private readonly bursts: Burst[] = [];
  private readonly sparks: Spark[] = [];
  private readonly crashes: Crash[] = [];

  private readonly flash: THREE.InstancedMesh;
  private readonly ring: THREE.InstancedMesh;
  private readonly core: THREE.InstancedMesh;
  private readonly rim: THREE.InstancedMesh;
  private readonly streak: THREE.InstancedMesh;
  private readonly tetra: THREE.InstancedMesh;
  private readonly puff: THREE.InstancedMesh;
  private readonly cone: THREE.InstancedMesh;
  private flashTintDirty = false;

  constructor() {
    const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number): THREE.InstancedMesh => {
      const m = noEdge(new THREE.InstancedMesh(geo, mat, n));
      m.frustumCulled = false;
      m.visible = false;
      for (let i = 0; i < n; i++) m.setMatrixAt(i, HIDDEN);
      this.group.add(m);
      return m;
    };

    this.flash = inst(new THREE.CircleGeometry(1, 20), glowMaterial(0xffffff, 3.0), FLASH_N);
    for (let i = 0; i < FLASH_N; i++) this.flash.setColorAt(i, COL_FLASH_BURST);

    this.ring = inst(new THREE.RingGeometry(0.88, 1, 28), glowMaterial(0xffa040, 2.4), BURSTS);
    for (let i = 0; i < BURSTS; i++) this.ring.setColorAt(i, _c.set(0xffffff));

    const blob = new THREE.IcosahedronGeometry(1, 1);
    this.core = inst(blob, glowMaterial(0xffd27a, 2.3), BURSTS * BLOBS);
    const rimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff7a2a).multiplyScalar(0.95), side: THREE.BackSide });
    rimMat.toneMapped = false;
    this.rim = inst(blob, rimMat, BURSTS * BLOBS);

    this.streak = inst(new THREE.BoxGeometry(1, 1, 1), glowMaterial(0xffffff, 2.6), STREAK_N);
    for (let i = 0; i < STREAK_N; i++) this.streak.setColorAt(i, i < STREAK_EMBER0 || i >= STREAK_SPARK0 ? COL_SPARK : COL_EMBER);

    this.tetra = inst(new THREE.TetrahedronGeometry(1, 0), toonMaterial(0xffffff), TETRA_N);
    for (let i = 0; i < TETRA_N; i++) this.tetra.setColorAt(i, _c.set(i < TETRA_CHIP0 ? COL_SHIP : COL_ROCK[i % 2]!));

    this.puff = inst(faceted(new THREE.IcosahedronGeometry(1, 1)), toonMaterial(0xffffff), PUFF_N);
    for (let i = 0; i < PUFF_N; i++) this.puff.setColorAt(i, i < PUFF_CRASH0 ? COL_SMOKE : COL_DUST);

    // cone: apex at the origin, opening along +Z (the impact normal)
    const coneGeo = new THREE.ConeGeometry(1, 1, 7, 1, true);
    coneGeo.translate(0, -0.5, 0);
    coneGeo.rotateX(-Math.PI / 2);
    this.cone = inst(faceted(coneGeo), toonMaterial(0x7d7089), CRASHES);

    for (let i = 0; i < BURSTS; i++) {
      this.bursts.push({
        t: BURST_LIFE, live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), scale: 1, nChunk: 0, nStreak: 0,
        chunkVel: new Float32Array(CHUNKS * 3), chunkSpin: new Float32Array(CHUNKS * 2), chunkSize: new Float32Array(CHUNKS),
        blobOff: new Float32Array(BLOBS * 3), blobR: new Float32Array(BLOBS),
        streakVel: new Float32Array(STREAKS * 3), streakLen: new Float32Array(STREAKS),
        puffOff: new Float32Array(PUFFS * 3), puffR: new Float32Array(PUFFS),
      });
    }
    for (let i = 0; i < SPARKS; i++) this.sparks.push({ t: SPARK_LIFE, live: false, pos: new THREE.Vector3(), vel: new Float32Array(SP_STREAKS * 3) });
    for (let i = 0; i < CRASHES; i++) {
      this.crashes.push({
        t: CRASH_LIFE, live: false, pos: new THREE.Vector3(), normal: new THREE.Vector3(0, 0, 1), k: 1, nChip: 0,
        chipVel: new Float32Array(CHIPS * 3), chipSpin: new Float32Array(CHIPS * 2), chipSize: new Float32Array(CHIPS),
      });
    }
  }

  /** `scale` ≈ victim radius in metres; `vel` is the victim's velocity, inherited by debris and smoke. */
  spawn(pos: THREE.Vector3, vel: THREE.Vector3, scale: number): void {
    const bi = oldest(this.bursts, BURST_LIFE);
    const b = this.bursts[bi]!;
    b.t = 0;
    b.pos.copy(pos);
    b.vel.copy(vel);
    b.scale = scale;
    b.nChunk = 12 + Math.floor(Math.random() * (CHUNKS - 12 + 1));
    b.nStreak = 6 + Math.floor(Math.random() * (STREAKS - 6 + 1));
    for (let i = 0; i < CHUNKS; i++) {
      randUnit(_v).multiplyScalar(rr(9, 24) * scale * 0.45);
      b.chunkVel[i * 3] = _v.x; b.chunkVel[i * 3 + 1] = _v.y; b.chunkVel[i * 3 + 2] = _v.z;
      b.chunkSpin[i * 2] = rr(-7, 7);
      b.chunkSpin[i * 2 + 1] = rr(-7, 7);
      b.chunkSize[i] = rr(0.2, 0.4);
    }
    for (let i = 0; i < BLOBS; i++) {
      randUnit(_v).multiplyScalar(i === 0 ? 0 : rr(0.4, 0.85));
      b.blobOff[i * 3] = _v.x; b.blobOff[i * 3 + 1] = _v.y; b.blobOff[i * 3 + 2] = _v.z;
      b.blobR[i] = i === 0 ? 1.15 : rr(0.6, 0.95);
    }
    for (let i = 0; i < STREAKS; i++) {
      randUnit(_v).multiplyScalar(rr(30, 55) * scale * 0.3);
      b.streakVel[i * 3] = _v.x; b.streakVel[i * 3 + 1] = _v.y; b.streakVel[i * 3 + 2] = _v.z;
      b.streakLen[i] = rr(0.6, 1.3);
    }
    for (let i = 0; i < PUFFS; i++) {
      randUnit(_v).multiplyScalar(rr(0.35, 0.75));
      b.puffOff[i * 3] = _v.x; b.puffOff[i * 3 + 1] = _v.y; b.puffOff[i * 3 + 2] = _v.z;
      b.puffR[i] = rr(0.6, 0.95);
    }
    this.flash.setColorAt(bi, COL_FLASH_BURST);
    this.flashTintDirty = true;
  }

  /** Small 0.2 s hit pop: a flash and three tiny streaks. Cheap; safe to call many times a second. */
  spark(pos: THREE.Vector3): void {
    const i = oldest(this.sparks, SPARK_LIFE);
    const s = this.sparks[i]!;
    s.t = 0;
    s.pos.copy(pos);
    for (let k = 0; k < SP_STREAKS; k++) {
      randUnit(_v).multiplyScalar(rr(22, 42));
      s.vel[k * 3] = _v.x; s.vel[k * 3 + 1] = _v.y; s.vel[k * 3 + 2] = _v.z;
    }
    this.flash.setColorAt(FLASH_SPARK0 + i, COL_FLASH_SPARK);
    this.flashTintDirty = true;
  }

  /** Rock impact at `pos`: chips and a dust cone leave along unit `normal`; `speed` (m/s) sets the size. */
  crash(pos: THREE.Vector3, normal: THREE.Vector3, speed: number): void {
    const i = oldest(this.crashes, CRASH_LIFE);
    const c = this.crashes[i]!;
    c.t = 0;
    c.pos.copy(pos);
    c.normal.copy(normal).normalize();
    c.k = Math.min(2.5, Math.max(0.3, speed / 150));
    c.nChip = 6 + Math.floor(Math.random() * (CHIPS - 6 + 1));
    for (let j = 0; j < CHIPS; j++) {
      randInCone(_v, c.normal, 0.55).multiplyScalar(rr(16, 38) * (0.55 + 0.45 * c.k));
      c.chipVel[j * 3] = _v.x; c.chipVel[j * 3 + 1] = _v.y; c.chipVel[j * 3 + 2] = _v.z;
      c.chipSpin[j * 2] = rr(-9, 9);
      c.chipSpin[j * 2 + 1] = rr(-9, 9);
      c.chipSize[j] = rr(0.6, 1.2) * (0.7 + 0.3 * c.k);
    }
    this.flash.setColorAt(FLASH_CRASH0 + i, COL_FLASH_CRASH);
    this.flashTintDirty = true;
  }

  update(dt: number, camPos: THREE.Vector3): void {
    let anyBurst = false, anySpark = false, anyCrash = false;
    let ringDirty = false;

    for (let k = 0; k < BURSTS; k++) {
      const b = this.bursts[k]!;
      if (b.t >= BURST_LIFE) {
        if (b.live) this.hideBurst(k);
        continue;
      }
      b.live = anyBurst = true;
      b.t += dt;
      const t = b.t, s = b.scale;

      // 1. flash: pops to full in 25 ms, hard cut to a smaller step at 80 ms, gone at 130 ms
      const fr = t < 0.08 ? 2.6 * popIn(t, 0, 0.025) : t < 0.13 ? 1.1 : 0;
      this.billboard(this.flash, k, b.pos, camPos, fr * s);

      // 2. shockwave ring: expands fast, brightness steps down, gone at 0.45 s
      if (t < 0.45) {
        const u = t / 0.45;
        this.billboard(this.ring, k, b.pos, camPos, s * (0.6 + 2.6 * (1 - (1 - u) * (1 - u))));
        const lv = t < 0.18 ? 1 : t < 0.32 ? 0.5 : 0.28;
        this.ring.setColorAt(k, _c.setScalar(lv));
        ringDirty = true;
      } else this.ring.setMatrixAt(k, HIDDEN);

      // 3. fireball: overlapping blobs, glow core inside a flat orange back-face rim. The core dies first
      //    so the ball turns orange as it collapses; blobs drift apart and ride 30 % of the victim's velocity.
      for (let i = 0; i < BLOBS; i++) {
        const id = k * BLOBS + i;
        if (t < 0.05 || t >= 0.5) {
          this.core.setMatrixAt(id, HIDDEN);
          this.rim.setMatrixAt(id, HIDDEN);
          continue;
        }
        // three hard size steps on the way up, then a smooth collapse
        const grow = t < 0.09 ? 0.6 : t < 0.14 ? 0.85 : 1;
        const r = b.blobR[i]! * s * grow;
        _p.set(b.blobOff[i * 3]!, b.blobOff[i * 3 + 1]!, b.blobOff[i * 3 + 2]!).multiplyScalar(s * (0.8 + 2.2 * t)).add(b.pos).addScaledVector(b.vel, 0.3 * t);
        _obj.position.copy(_p);
        _obj.rotation.set(i * 0.9, i * 1.7, 0);
        _obj.scale.setScalar(r * 0.7 * fadeOut(t, 0.26, 0.42));
        _obj.updateMatrix();
        this.core.setMatrixAt(id, _obj.matrix);
        _obj.scale.setScalar(r * fadeOut(t, 0.34, 0.5));
        _obj.updateMatrix();
        this.rim.setMatrixAt(id, _obj.matrix);
      }

      // 4. debris chunks: inherit vel, radial spread decays under drag, tumble, shrink out over the last 0.6 s
      const dd = dragDist(t, CHUNK_DRAG);
      const decay = Math.exp(-CHUNK_DRAG * t);
      for (let i = 0; i < CHUNKS; i++) {
        const id = k * CHUNKS + i;
        if (i >= b.nChunk) {
          this.tetra.setMatrixAt(id, HIDDEN);
          continue;
        }
        _v.set(b.chunkVel[i * 3]!, b.chunkVel[i * 3 + 1]!, b.chunkVel[i * 3 + 2]!);
        _p.copy(b.pos).addScaledVector(b.vel, t).addScaledVector(_v, dd);
        _obj.position.copy(_p);
        _obj.rotation.set(b.chunkSpin[i * 2]! * t, b.chunkSpin[i * 2 + 1]! * t, 0);
        _obj.scale.setScalar(b.chunkSize[i]! * s * fadeOut(t, 1.0, BURST_LIFE));
        _obj.updateMatrix();
        this.tetra.setMatrixAt(id, _obj.matrix);

        // 5. embers: the first few chunks trail a glowing streak along their current velocity for 0.7 s
        if (i < EMBERS) {
          const eid = STREAK_EMBER0 + k * EMBERS + i;
          if (t >= 1.0) {
            this.streak.setMatrixAt(eid, HIDDEN);
            continue;
          }
          _d.copy(b.vel).addScaledVector(_v, decay);
          const sp = _d.length();
          if (sp < 1e-3) {
            this.streak.setMatrixAt(eid, HIDDEN);
            continue;
          }
          _d.multiplyScalar(1 / sp);
          const len = Math.min(2.6 * s, Math.max(0.4 * s, sp * 0.08)) * fadeOut(t, 0.6, 1.0);
          this.streakAt(eid, _p, _d, len, 0.2 * s * (t < 0.45 ? 1 : 0.55));
        }
      }

      // 6. spark streaks: straight lines, gone in 0.3 s
      for (let i = 0; i < STREAKS; i++) {
        const id = k * STREAKS + i;
        if (i >= b.nStreak || t >= 0.3) {
          this.streak.setMatrixAt(id, HIDDEN);
          continue;
        }
        _d.set(b.streakVel[i * 3]!, b.streakVel[i * 3 + 1]!, b.streakVel[i * 3 + 2]!);
        _p.copy(b.pos).addScaledVector(_d, t);
        _d.normalize();
        this.streakAt(id, _p, _d, b.streakLen[i]! * s * fadeOut(t, 0.2, 0.3), 0.1 * s);
      }

      // 7. smoke puffs: dark toon spheres, appear as the fireball collapses, drift, shrink to nothing by 1.45 s
      for (let i = 0; i < PUFFS; i++) {
        const id = k * PUFFS + i;
        if (t < 0.22 || t >= 1.45) {
          this.puff.setMatrixAt(id, HIDDEN);
          continue;
        }
        const g = popIn(t, 0.22, 0.36) * fadeOut(t, 0.7, 1.45);
        _p.set(b.puffOff[i * 3]!, b.puffOff[i * 3 + 1]!, b.puffOff[i * 3 + 2]!).multiplyScalar(s * (1 + 1.2 * t)).add(b.pos).addScaledVector(b.vel, 0.3 * t);
        _obj.position.copy(_p);
        _obj.rotation.set(i * 1.3, t * 0.6, i * 0.7);
        _obj.scale.setScalar(b.puffR[i]! * s * g);
        _obj.updateMatrix();
        this.puff.setMatrixAt(id, _obj.matrix);
      }
    }

    for (let k = 0; k < SPARKS; k++) {
      const sp = this.sparks[k]!;
      if (sp.t >= SPARK_LIFE) {
        if (sp.live) this.hideSpark(k);
        continue;
      }
      sp.live = anySpark = true;
      sp.t += dt;
      const t = sp.t;
      this.billboard(this.flash, FLASH_SPARK0 + k, sp.pos, camPos, t < 0.07 ? 1.2 : t < 0.13 ? 0.55 : 0);
      for (let i = 0; i < SP_STREAKS; i++) {
        _d.set(sp.vel[i * 3]!, sp.vel[i * 3 + 1]!, sp.vel[i * 3 + 2]!);
        _p.copy(sp.pos).addScaledVector(_d, t);
        _d.normalize();
        this.streakAt(STREAK_SPARK0 + k * SP_STREAKS + i, _p, _d, 0.9 * fadeOut(t, 0.13, SPARK_LIFE), 0.09);
      }
    }

    for (let k = 0; k < CRASHES; k++) {
      const c = this.crashes[k]!;
      if (c.t >= CRASH_LIFE) {
        if (c.live) this.hideCrash(k);
        continue;
      }
      c.live = anyCrash = true;
      c.t += dt;
      const t = c.t, kk = c.k;
      this.billboard(this.flash, FLASH_CRASH0 + k, c.pos, camPos, t < 0.06 ? 3.2 * kk : t < 0.11 ? 1.5 * kk : 0);

      // dust cone: length pops out along the normal, base widens, then the whole cone collapses by 0.6 s
      if (t < 0.6) {
        const die = fadeOut(t, 0.4, 0.6);
        _obj.position.copy(c.pos);
        _obj.quaternion.setFromUnitVectors(Z_AXIS, c.normal);
        const rad = 3.6 * kk * popIn(t, 0, 0.35) * die;
        _obj.scale.set(rad, rad, 7 * kk * popIn(t, 0, 0.1) * die);
        _obj.updateMatrix();
        this.cone.setMatrixAt(k, _obj.matrix);
        // two dust puffs ride out along the normal behind the cone's mouth
        for (let j = 0; j < CRASH_PUFFS; j++) {
          const g = popIn(t, 0.04, 0.16) * die;
          _obj.position.copy(c.pos).addScaledVector(c.normal, (6 + 3.5 * j) * kk * (0.8 + 0.5 * t));
          _obj.rotation.set(j * 1.1, t, 0);
          _obj.scale.setScalar((1.9 - 0.5 * j) * kk * g);
          _obj.updateMatrix();
          this.puff.setMatrixAt(PUFF_CRASH0 + k * CRASH_PUFFS + j, _obj.matrix);
        }
      } else {
        this.cone.setMatrixAt(k, HIDDEN);
        for (let j = 0; j < CRASH_PUFFS; j++) this.puff.setMatrixAt(PUFF_CRASH0 + k * CRASH_PUFFS + j, HIDDEN);
      }

      const dd = dragDist(t, CHIP_DRAG);
      for (let j = 0; j < CHIPS; j++) {
        const id = TETRA_CHIP0 + k * CHIPS + j;
        if (j >= c.nChip) {
          this.tetra.setMatrixAt(id, HIDDEN);
          continue;
        }
        _v.set(c.chipVel[j * 3]!, c.chipVel[j * 3 + 1]!, c.chipVel[j * 3 + 2]!);
        _obj.position.copy(c.pos).addScaledVector(_v, dd);
        _obj.rotation.set(c.chipSpin[j * 2]! * t, c.chipSpin[j * 2 + 1]! * t, 0);
        _obj.scale.setScalar(c.chipSize[j]! * fadeOut(t, 0.5, CRASH_LIFE));
        _obj.updateMatrix();
        this.tetra.setMatrixAt(id, _obj.matrix);
      }
    }

    const anyFlash = anyBurst || anySpark || anyCrash;
    this.flash.visible = anyFlash;
    this.ring.visible = this.core.visible = this.rim.visible = anyBurst;
    this.puff.visible = anyBurst || anyCrash;
    this.streak.visible = anyBurst || anySpark;
    this.tetra.visible = anyBurst || anyCrash;
    this.cone.visible = anyCrash;
    if (anyFlash) {
      this.flash.instanceMatrix.needsUpdate = true;
      if (this.flashTintDirty && this.flash.instanceColor) {
        this.flash.instanceColor.needsUpdate = true;
        this.flashTintDirty = false;
      }
    }
    if (anyBurst) {
      this.ring.instanceMatrix.needsUpdate = true;
      if (ringDirty && this.ring.instanceColor) this.ring.instanceColor.needsUpdate = true;
      this.core.instanceMatrix.needsUpdate = true;
      this.rim.instanceMatrix.needsUpdate = true;
    }
    if (anyBurst || anyCrash) this.puff.instanceMatrix.needsUpdate = true;
    if (anyBurst || anySpark) this.streak.instanceMatrix.needsUpdate = true;
    if (anyBurst || anyCrash) this.tetra.instanceMatrix.needsUpdate = true;
    if (anyCrash) this.cone.instanceMatrix.needsUpdate = true;
  }

  /** Camera-facing disc of radius `r` (0 hides it). */
  private billboard(mesh: THREE.InstancedMesh, id: number, pos: THREE.Vector3, camPos: THREE.Vector3, r: number): void {
    if (r <= 0) {
      mesh.setMatrixAt(id, HIDDEN);
      return;
    }
    _obj.position.copy(pos);
    _obj.lookAt(camPos);
    _obj.scale.setScalar(r);
    _obj.updateMatrix();
    mesh.setMatrixAt(id, _obj.matrix);
  }

  /** Glow box of length `len` ending at `head`, pointing along unit `dir`. */
  private streakAt(id: number, head: THREE.Vector3, dir: THREE.Vector3, len: number, width: number): void {
    if (len <= 0) {
      this.streak.setMatrixAt(id, HIDDEN);
      return;
    }
    _obj.position.copy(head).addScaledVector(dir, -len * 0.5);
    _obj.quaternion.setFromUnitVectors(Z_AXIS, dir);
    _obj.scale.set(width, width, len);
    _obj.updateMatrix();
    this.streak.setMatrixAt(id, _obj.matrix);
  }

  private hideBurst(k: number): void {
    const b = this.bursts[k]!;
    b.live = false;
    this.flash.setMatrixAt(k, HIDDEN);
    this.ring.setMatrixAt(k, HIDDEN);
    for (let i = 0; i < BLOBS; i++) {
      this.core.setMatrixAt(k * BLOBS + i, HIDDEN);
      this.rim.setMatrixAt(k * BLOBS + i, HIDDEN);
    }
    for (let i = 0; i < CHUNKS; i++) this.tetra.setMatrixAt(k * CHUNKS + i, HIDDEN);
    for (let i = 0; i < EMBERS; i++) this.streak.setMatrixAt(STREAK_EMBER0 + k * EMBERS + i, HIDDEN);
    for (let i = 0; i < STREAKS; i++) this.streak.setMatrixAt(k * STREAKS + i, HIDDEN);
    for (let i = 0; i < PUFFS; i++) this.puff.setMatrixAt(k * PUFFS + i, HIDDEN);
    this.flash.instanceMatrix.needsUpdate = this.ring.instanceMatrix.needsUpdate = this.core.instanceMatrix.needsUpdate = true;
    this.rim.instanceMatrix.needsUpdate = this.tetra.instanceMatrix.needsUpdate = this.streak.instanceMatrix.needsUpdate = this.puff.instanceMatrix.needsUpdate = true;
  }

  private hideSpark(k: number): void {
    this.sparks[k]!.live = false;
    this.flash.setMatrixAt(FLASH_SPARK0 + k, HIDDEN);
    for (let i = 0; i < SP_STREAKS; i++) this.streak.setMatrixAt(STREAK_SPARK0 + k * SP_STREAKS + i, HIDDEN);
    this.flash.instanceMatrix.needsUpdate = this.streak.instanceMatrix.needsUpdate = true;
  }

  private hideCrash(k: number): void {
    this.crashes[k]!.live = false;
    this.flash.setMatrixAt(FLASH_CRASH0 + k, HIDDEN);
    this.cone.setMatrixAt(k, HIDDEN);
    for (let j = 0; j < CHIPS; j++) this.tetra.setMatrixAt(TETRA_CHIP0 + k * CHIPS + j, HIDDEN);
    for (let j = 0; j < CRASH_PUFFS; j++) this.puff.setMatrixAt(PUFF_CRASH0 + k * CRASH_PUFFS + j, HIDDEN);
    this.flash.instanceMatrix.needsUpdate = this.cone.instanceMatrix.needsUpdate = this.tetra.instanceMatrix.needsUpdate = this.puff.instanceMatrix.needsUpdate = true;
  }
}

/** Index of the first idle entry (t >= life), else the oldest live one. */
function oldest(pool: { t: number }[], life: number): number {
  let best = 0, bestT = -1;
  for (let i = 0; i < pool.length; i++) {
    const t = pool[i]!.t;
    if (t >= life) return i;
    if (t > bestT) {
      bestT = t;
      best = i;
    }
  }
  return best;
}
