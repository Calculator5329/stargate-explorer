import * as THREE from "three";
import { mulberry32 } from "@/core/random";
import { glowMaterial, toonMaterial } from "@/render/toon";
import { outlineShell } from "@/render/outline";
import { noEdge } from "@/render/layers";
import { CapitalSoup, PY, triangleCount, type CapitalSlot } from "@/combat/capital-geo";

/**
 * Ha'tak-style mothership: a square pyramid on a shallow underside hull, sitting
 * inside a flat ring superstructure with radial struts and three outer lobes.
 * Turrets ride the ring (which turns slowly), three shield nodes sit on a collar
 * near the apex. Everything is toon + inverted-hull outline; only the window /
 * rune strips and the shield nodes use glow material.
 *
 * Axes follow the ships: local +Z forward (the hangar face), +Y up.
 */

export interface Turret {
  /** world position of the part's hit centre, refreshed by `update()` */
  pos: THREE.Vector3;
  /** world orientation of the aiming head (+Z = barrel), refreshed by `update()` */
  quat: THREE.Quaternion;
  /** world barrel direction, unit, refreshed by `update()` */
  dir: THREE.Vector3;
  alive: boolean;
  hp: number;
  mesh: THREE.Object3D;
  /** hit radius, metres (world) */
  radius: number;
}

interface Part extends Turret {
  head: THREE.Object3D | null;
  live: THREE.Object3D[];
  stub: THREE.Object3D;
  baseRadius: number;
}

// palette (diffuse stays under 1.0 linear once the key+fill land on it: 0x9a7a3c lit ≈ 0.63)
const GOLD = 0x9a7a3c;
const BRONZE = 0x6e5426;
const DARK = 0x2a2118;
const GLOW = 0xffc25a;
const SCORCH = 0x120d0b;

// proportions, metres
const BASE = 60; // pyramid half-width (120 m base)
const HEIGHT = 78;
const UNDER = 22; // depth of the inverted underside hull
const RING_IN = 88;
const RING_OUT = 108;
const RING_Y0 = 0;
const RING_Y1 = 12;
const LOBE_IN = 104;
const LOBE_OUT = 126;
const LOBE_ARC = (52 * Math.PI) / 180;
const COLLAR_Y = HEIGHT * 0.68;
const TURRET_R = 98;
const TURRET_HP = 40;
const WEAK_HP = 80;
const BARREL_LEN = 9;
const DEATH_T = 2.5;
const DEATH_BURSTS = 11;

const _p = new THREE.Vector3();
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const ZERO = new THREE.Vector3();
const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), D = new THREE.Vector3(), N = new THREE.Vector3();

/** Point on the pyramid face at yaw angle `face` (0 = +Z face), height fraction `t` (0 base, 1 apex), lateral fraction `u` (-1..1 across the face). */
function facePoint(out: THREE.Vector3, face: number, t: number, u: number, push = 0): THREE.Vector3 {
  const half = BASE * (1 - t);
  const slope = Math.hypot(HEIGHT, BASE); // face normal = (0, BASE, HEIGHT)/slope in the +Z-face frame
  const ny = BASE / slope, nz = HEIGHT / slope;
  const x = u * half, y = HEIGHT * t + ny * push, z = half + nz * push;
  const c = Math.cos(face), s = Math.sin(face);
  return out.set(x * c + z * s, y, -x * s + z * c);
}

function faceNormal(out: THREE.Vector3, face: number): THREE.Vector3 {
  const slope = Math.hypot(HEIGHT, BASE);
  const ny = BASE / slope, nz = HEIGHT / slope;
  const c = Math.cos(face), s = Math.sin(face);
  return out.set(nz * s, ny, nz * c);
}

export class Capital {
  readonly group = new THREE.Group();
  readonly turrets: Turret[] = [];
  readonly weakPoints: Turret[] = [];
  hp = 600;
  alive = true;
  /** bounding sphere radius, world metres */
  radius: number;
  /** turret slew rate, rad/s */
  turnRate = 1.6;
  /** world points that should trail smoke this frame (dead parts, then hull wounds as hp drops); `smokeCount` are valid */
  readonly smokePoints: THREE.Vector3[] = [];
  smokeCount = 0;
  /** rendered triangles, including outline shells */
  readonly triangles: number;

  private readonly ring = new THREE.Group();
  private readonly windowMat: THREE.MeshBasicMaterial;
  private readonly nodeMat: THREE.MeshBasicMaterial;
  private readonly glowBase = new THREE.Color();
  private readonly nodeBase = new THREE.Color();
  private readonly scale: number;
  private readonly rnd: () => number;
  private readonly burstLocal: Float32Array;
  private readonly burstScale: Float32Array;
  private t = 0;
  private deathT = -1;
  private burstsFired = 0;
  private readonly parts: Part[] = [];

  constructor(opts: { turrets?: number; scale?: number } = {}) {
    const turretCount = opts.turrets ?? 6;
    this.scale = opts.scale ?? 1;
    this.rnd = mulberry32(0x4a7a);
    this.group.name = "capital";
    this.group.scale.setScalar(this.scale);

    const mats: Record<CapitalSlot, THREE.Material> = {
      gold: toonMaterial(GOLD),
      bronze: toonMaterial(BRONZE),
      dark: toonMaterial(DARK),
      glow: glowMaterial(GLOW, 2.2),
    };
    this.windowMat = mats.glow as THREE.MeshBasicMaterial;
    this.glowBase.copy(this.windowMat.color);
    this.nodeMat = glowMaterial(GLOW, 2.8);
    this.nodeBase.copy(this.nodeMat.color);

    // ── pyramid + underside + collar (static) ──
    const body = new CapitalSoup();
    this.buildPyramid(body);
    this.buildUnderside(body);
    this.buildCollar(body);
    this.buildHangar(body);
    this.buildRunes(body);
    this.emit(body, mats, this.group);
    this.group.add(this.pyramidSeams());

    // ── ring superstructure (rotates) ──
    const ring = new CapitalSoup();
    this.buildRing(ring);
    this.buildLobes(ring);
    this.buildStruts(ring);
    this.buildWindows(ring);
    this.emit(ring, mats, this.ring);
    this.group.add(this.ring);

    // ── turrets on the ring, shield nodes on the collar ──
    for (let i = 0; i < turretCount; i++) {
      const a = (i / turretCount) * Math.PI * 2 + Math.PI / turretCount;
      const part = this.buildTurret(TURRET_R * Math.cos(a), RING_Y1, TURRET_R * Math.sin(a), a);
      this.ring.add(part.mesh);
      this.turrets.push(part);
      this.parts.push(part);
    }
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 2 + (i * Math.PI * 2) / 3;
      const r = BASE * (1 - COLLAR_Y / HEIGHT) + 4.5;
      const part = this.buildNode(r * Math.cos(a), COLLAR_Y + 3, r * Math.sin(a));
      this.group.add(part.mesh);
      this.weakPoints.push(part);
      this.parts.push(part);
    }
    for (let i = 0; i < this.parts.length + 4; i++) this.smokePoints.push(new THREE.Vector3());

    // death sub-explosions: fixed local positions, chosen once
    this.burstLocal = new Float32Array(DEATH_BURSTS * 3);
    this.burstScale = new Float32Array(DEATH_BURSTS);
    for (let i = 0; i < DEATH_BURSTS; i++) {
      const onRing = i % 2 === 0;
      const a = this.rnd() * Math.PI * 2;
      const r = onRing ? RING_IN + this.rnd() * (LOBE_OUT - RING_IN) : this.rnd() * BASE * 0.7;
      const y = onRing ? RING_Y0 + this.rnd() * RING_Y1 : this.rnd() * HEIGHT * 0.8;
      this.burstLocal.set([r * Math.cos(a), y, r * Math.sin(a)], i * 3);
      this.burstScale[i] = i === DEATH_BURSTS - 1 ? 3.0 : 0.8 + this.rnd() * 1.0;
    }

    this.radius = Math.hypot(LOBE_OUT, RING_Y1) * this.scale;
    this.group.updateMatrixWorld(true);
    this.triangles = triangleCount(this.group);
    this.update(0);
  }

  // ─────────────────────────── geometry ───────────────────────────

  private emit(soup: CapitalSoup, mats: Record<CapitalSlot, THREE.Material>, into: THREE.Object3D): void {
    for (const slot of ["gold", "bronze", "dark", "glow"] as CapitalSlot[]) {
      const geo = soup.geometry(slot);
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, mats[slot]);
      mesh.name = slot;
      mesh.castShadow = slot !== "glow";
      mesh.receiveShadow = slot !== "glow";
      if (slot === "glow") noEdge(mesh);
      into.add(mesh);
    }
    for (const shell of soup.solids) into.add(outlineShell(shell));
  }

  /** Four faces, each split down a slightly raised central spine (two facets) and into three colour bands. */
  private buildPyramid(s: CapitalSoup): void {
    s.begin();
    const bands = [0, 0.34, 0.62, 1];
    const bulge = [0, 1.8, 0, 0]; // band boundaries pushed off the ideal plane so adjacent bands catch the light differently
    const slots: CapitalSlot[] = ["gold", "bronze", "gold"];
    const SPINE = 2.2;
    for (let f = 0; f < 4; f++) {
      const face = (f * Math.PI) / 2;
      faceNormal(N, face);
      for (let b = 0; b < 3; b++) {
        const t0 = bands[b]!, t1 = bands[b + 1]!;
        const p0 = bulge[b]!, p1 = bulge[b + 1]!;
        const slot = slots[b]!;
        for (const side of [-1, 1]) {
          // outer edge at u=side, spine at u=0 pushed out
          facePoint(A, face, t0, side, p0);
          facePoint(B, face, t0, 0, p0 + SPINE * (1 - t0 * 0.6));
          facePoint(C, face, t1, 0, t1 < 1 ? p1 + SPINE * (1 - t1 * 0.6) : 0);
          facePoint(D, face, t1, side, p1);
          if (t1 >= 1) s.tri(A, B, D, N, slot);
          else s.quad(A, B, C, D, N, slot);
        }
      }
    }
    // base plate (only the rim shows past the underside)
    A.set(-BASE, 0, -BASE); B.set(BASE, 0, -BASE); C.set(BASE, 0, BASE); D.set(-BASE, 0, BASE);
    s.quad(A, B, C, D, PY, "dark");
  }

  /** Shallow inverted frustum below the base: the hull the pyramid stands on. */
  private buildUnderside(s: CapitalSoup): void {
    s.begin();
    const lower = BASE * 0.42;
    for (let f = 0; f < 4; f++) {
      const c = Math.cos((f * Math.PI) / 2), sn = Math.sin((f * Math.PI) / 2);
      const rot = (x: number, z: number, out: THREE.Vector3, y: number) => out.set(x * c + z * sn, y, -x * sn + z * c);
      rot(-BASE, BASE, A, 0); rot(BASE, BASE, B, 0); rot(lower, lower, C, -UNDER); rot(-lower, lower, D, -UNDER);
      N.set(0, -lower, UNDER).normalize();
      _v.set(N.x * c + N.z * sn, N.y, -N.x * sn + N.z * c);
      s.quad(A, B, C, D, _v, "bronze");
    }
    A.set(-lower, -UNDER, -lower); B.set(lower, -UNDER, -lower); C.set(lower, -UNDER, lower); D.set(-lower, -UNDER, lower);
    N.set(0, -1, 0);
    s.quad(A, B, C, D, N, "dark");
    // a dark keel disc under the centre
    s.begin();
    s.sector(0.01, lower * 0.55, -UNDER - 5, -UNDER, 0, Math.PI * 2, 8, "dark", "dark");
  }

  /** Dark collar around the upper pyramid that the shield nodes sit on. */
  private buildCollar(s: CapitalSoup): void {
    s.begin();
    const half = BASE * (1 - COLLAR_Y / HEIGHT);
    s.sector(half * 0.9, half + 6.5, COLLAR_Y - 2.5, COLLAR_Y + 1, 0, Math.PI * 2, 12, "dark", "bronze");
  }

  /** Hangar mouth at the foot of the +Z face: bronze gate frame standing off the face, black throat inside it, glow lip around the throat. */
  private buildHangar(s: CapitalSoup): void {
    faceNormal(N, 0);
    const T0 = 0.02, T1 = 0.27;
    // frame: a trapezoid slab pushed 2.2 m off the face, drawn as a bronze border around the throat
    s.begin();
    const frame = (uo: number, ui: number, ta: number, tb: number) => {
      facePoint(A, 0, ta, uo, 2.2); facePoint(B, 0, ta, ui, 2.2); facePoint(C, 0, tb, ui, 2.2); facePoint(D, 0, tb, uo, 2.2);
      s.quad(A, B, C, D, N, "bronze");
    };
    frame(-0.36, -0.28, T0, T1); // left post
    frame(0.28, 0.36, T0, T1); // right post
    frame(-0.36, 0.36, T1 - 0.03, T1); // lintel
    // frame sides (depth), so the slab reads as standing proud of the face
    for (const u of [-0.36, 0.36]) {
      facePoint(A, 0, T0, u, 0); facePoint(B, 0, T0, u, 2.2); facePoint(C, 0, T1, u, 2.2); facePoint(D, 0, T1, u, 0);
      _v.set(Math.sign(u), 0, 0);
      s.quad(A, B, C, D, _v, "dark");
    }
    facePoint(A, 0, T1, -0.36, 0); facePoint(B, 0, T1, 0.36, 0); facePoint(C, 0, T1, 0.36, 2.2); facePoint(D, 0, T1, -0.36, 2.2);
    s.quad(A, B, C, D, PY, "bronze");
    // throat: black quad recessed behind the frame
    s.begin(false);
    facePoint(A, 0, T0, -0.28, 0.3); facePoint(B, 0, T0, 0.28, 0.3); facePoint(C, 0, T1 - 0.03, 0.28, 0.3); facePoint(D, 0, T1 - 0.03, -0.28, 0.3);
    s.quad(A, B, C, D, N, "dark");
    // glow lip on the inner edge of the frame
    const lip = (ua: number, ub: number, ta: number, tb: number) => {
      facePoint(A, 0, ta, ua, 2.4); facePoint(B, 0, ta, ub, 2.4); facePoint(C, 0, tb, ub, 2.4); facePoint(D, 0, tb, ua, 2.4);
      s.quad(A, B, C, D, N, "glow");
    };
    lip(-0.285, -0.27, T0, T1 - 0.03);
    lip(0.27, 0.285, T0, T1 - 0.03);
    lip(-0.285, 0.285, T1 - 0.04, T1 - 0.03);
  }

  /** Sparse rune strips on the faces: short glow bands sitting a hair above the surface. */
  private buildRunes(s: CapitalSoup): void {
    s.begin(false);
    for (let f = 0; f < 4; f++) {
      const face = (f * Math.PI) / 2;
      faceNormal(N, face);
      const strips = f === 0 ? [[0.36, 0.45], [0.36, -0.45], [0.64, 0.25]] : [[0.36, -0.5], [0.36, 0.5], [0.64, -0.3], [0.64, 0.3]];
      for (const [t, u] of strips) {
        const w = 0.16 * (1 - t!), h = 0.012;
        facePoint(A, face, t!, u! - w, 0.5); facePoint(B, face, t!, u! + w, 0.5); facePoint(C, face, t! + h, u! + w * 0.9, 0.5); facePoint(D, face, t! + h, u! - w * 0.9, 0.5);
        s.quad(A, B, C, D, N, "glow");
      }
    }
  }

  private buildRing(s: CapitalSoup): void {
    s.begin();
    s.sector(RING_IN, RING_OUT, RING_Y0, RING_Y1, 0, Math.PI * 2, 36, "gold", "bronze", "dark");
    // raised inner lip, dark
    s.begin();
    s.sector(RING_IN, RING_IN + 4, RING_Y1, RING_Y1 + 2.5, 0, Math.PI * 2, 36, "dark", "dark");
    // outer trim, dark, lower
    s.begin();
    s.sector(RING_OUT - 3, RING_OUT + 1.5, RING_Y0 - 1.5, RING_Y0 + 3, 0, Math.PI * 2, 36, "dark", "dark");
  }

  /** Three outer lobes, 120° apart, one straight ahead. Thicker than the ring so they read as separate hull segments. */
  private buildLobes(s: CapitalSoup): void {
    for (let i = 0; i < 3; i++) {
      const centre = Math.PI / 2 + (i * Math.PI * 2) / 3; // sin(centre)=1 → +Z for i=0
      s.begin();
      s.sector(LOBE_IN, LOBE_OUT, RING_Y0 - 3, RING_Y1 + 3, centre - LOBE_ARC / 2, centre + LOBE_ARC / 2, 7, "gold", "bronze", "dark");
      s.begin();
      s.sector(LOBE_OUT - 6, LOBE_OUT + 2, RING_Y0 + 1, RING_Y1 - 1, centre - LOBE_ARC / 2 + 0.05, centre + LOBE_ARC / 2 - 0.05, 7, "dark", "dark");
    }
  }

  /** Eight radial struts from the base slab out to the ring's inner wall. */
  private buildStruts(s: CapitalSoup): void {
    s.begin();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const c = Math.cos(a), sn = Math.sin(a);
      const r0 = i % 2 === 0 ? BASE - 4 : BASE * Math.SQRT2 - 6;
      const r1 = RING_IN + 2;
      const rm = (r0 + r1) / 2, len = r1 - r0;
      const w = 5, h = 5;
      // box along the radial direction, hand-rotated
      const put = (out: THREE.Vector3, dr: number, dy: number, dw: number) => out.set((rm + dr) * c - dw * sn, RING_Y0 + 2.5 + dy, (rm + dr) * sn + dw * c);
      const hl = len / 2, hw = w / 2, hh = h / 2;
      put(A, -hl, hh, -hw); put(B, hl, hh, -hw); put(C, hl, hh, hw); put(D, -hl, hh, hw);
      s.quad(A, B, C, D, PY, "bronze");
      put(A, -hl, -hh, -hw); put(B, hl, -hh, -hw); put(C, hl, -hh, hw); put(D, -hl, -hh, hw);
      N.set(0, -1, 0);
      s.quad(A, B, C, D, N, "dark");
      N.set(sn, 0, -c); // side toward -w
      put(A, -hl, -hh, -hw); put(B, hl, -hh, -hw); put(C, hl, hh, -hw); put(D, -hl, hh, -hw);
      s.quad(A, B, C, D, N, "bronze");
      N.set(-sn, 0, c);
      put(A, -hl, -hh, hw); put(B, hl, -hh, hw); put(C, hl, hh, hw); put(D, -hl, hh, hw);
      s.quad(A, B, C, D, N, "bronze");
    }
  }

  /** Sparse window strips on the ring's outer wall and the lobes. */
  private buildWindows(s: CapitalSoup): void {
    s.begin(false);
    const rnd = mulberry32(77);
    const strip = (r: number, a: number, y: number, len: number, h: number) => {
      const da = len / r / 2;
      const c0 = Math.cos(a - da), s0 = Math.sin(a - da), c1 = Math.cos(a + da), s1 = Math.sin(a + da);
      A.set(r * c0, y - h / 2, r * s0); B.set(r * c1, y - h / 2, r * s1); C.set(r * c1, y + h / 2, r * s1); D.set(r * c0, y + h / 2, r * s0);
      N.set(Math.cos(a), 0, Math.sin(a));
      s.quad(A, B, C, D, N, "glow");
    };
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + rnd() * 0.15;
      if (rnd() < 0.25) continue; // gaps keep it sparse
      strip(RING_OUT + 0.4, a, RING_Y0 + 6.5 + (rnd() - 0.5) * 2, 4 + rnd() * 5, 0.9);
    }
    for (let i = 0; i < 3; i++) {
      const centre = Math.PI / 2 + (i * Math.PI * 2) / 3;
      strip(LOBE_OUT + 0.4, centre - 0.13, RING_Y0 + 9, 7, 1.0);
      strip(LOBE_OUT + 0.4, centre + 0.13, RING_Y0 + 9, 7, 1.0);
    }
  }

  /** Dark seam lines along the pyramid's edges, spines and band boundaries. */
  private pyramidSeams(): THREE.LineSegments {
    const pts: number[] = [];
    const push = (a: THREE.Vector3, b: THREE.Vector3) => pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    for (let f = 0; f < 4; f++) {
      const face = (f * Math.PI) / 2;
      facePoint(A, face, 0, 1, 0.15); facePoint(B, face, 1, 0, 0.15); push(A, B); // corner edge
      facePoint(A, face, 0, 0, 2.4); facePoint(B, face, 0.985, 0, 0.3); push(A, B); // spine ridge
      for (const t of [0.34, 0.62]) {
        for (const side of [-1, 1]) {
          facePoint(A, face, t, side, 0.15); facePoint(B, face, t, 0, 2.2 * (1 - t * 0.6) + 0.15); push(A, B);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x0a0a0c }));
    lines.name = "seams";
    return noEdge(lines);
  }

  private buildTurret(x: number, y: number, z: number, yaw: number): Part {
    const mount = new THREE.Group();
    mount.name = "turret";
    mount.position.set(x, y, z);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(4.2, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed(), toonMaterial(BRONZE));
    dome.geometry.computeVertexNormals();
    dome.castShadow = true;
    const domeShell = outlineShell(dome.geometry.getAttribute("position").array);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.6, 1.6, 10).toNonIndexed(), toonMaterial(DARK));
    skirt.geometry.computeVertexNormals();
    skirt.position.y = 0.8;
    const head = new THREE.Group();
    head.position.y = 3.6;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(2.1, 8, 5).toNonIndexed(), toonMaterial(DARK));
    cap.geometry.computeVertexNormals();
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, BARREL_LEN, 8).toNonIndexed(), toonMaterial(GOLD));
    barrel.geometry.computeVertexNormals();
    barrel.rotation.x = Math.PI / 2; // along +Z
    barrel.position.z = BARREL_LEN / 2 + 1;
    const barrelShell = outlineShell(barrel.geometry.getAttribute("position").array);
    barrelShell.rotation.copy(barrel.rotation);
    barrelShell.position.copy(barrel.position);
    const muzzle = new THREE.Mesh(new THREE.CircleGeometry(0.55, 8), this.windowMat);
    muzzle.position.z = BARREL_LEN + 1.05;
    noEdge(muzzle);
    head.add(cap, barrel, barrelShell, muzzle);
    // start facing radially outward, level
    _v.set(Math.cos(yaw), 0, Math.sin(yaw));
    _m.lookAt(_v, ZERO, PY);
    head.quaternion.setFromRotationMatrix(_m);
    const stub = new THREE.Mesh(new THREE.SphereGeometry(3.4, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed(), toonMaterial(SCORCH));
    stub.geometry.computeVertexNormals();
    stub.scale.y = 0.45;
    stub.visible = false;
    mount.add(dome, domeShell, skirt, head, stub);
    return {
      pos: new THREE.Vector3(), quat: new THREE.Quaternion(), dir: new THREE.Vector3(0, 0, 1),
      alive: true, hp: TURRET_HP, mesh: mount, radius: 6 * this.scale, baseRadius: 6,
      head, live: [dome, domeShell, skirt, head], stub,
    };
  }

  private buildNode(x: number, y: number, z: number): Part {
    const mount = new THREE.Group();
    mount.name = "shield-node";
    mount.position.set(x, y, z);
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 3.2, 6).toNonIndexed(), toonMaterial(DARK));
    pedestal.geometry.computeVertexNormals();
    pedestal.position.y = -1.6;
    const cage = new THREE.Mesh(new THREE.OctahedronGeometry(3.6, 0), toonMaterial(BRONZE));
    cage.position.y = 1.8;
    cage.scale.set(1, 1.25, 1);
    const cageShell = outlineShell(cage.geometry.getAttribute("position").array);
    cageShell.position.copy(cage.position);
    cageShell.scale.copy(cage.scale);
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 1), this.nodeMat);
    orb.position.y = 1.8;
    noEdge(orb);
    const stub = new THREE.Mesh(new THREE.OctahedronGeometry(2.4, 0), toonMaterial(SCORCH));
    stub.position.y = 0.4;
    stub.scale.set(1, 0.6, 1);
    stub.visible = false;
    mount.add(pedestal, cage, cageShell, orb, stub);
    return {
      pos: new THREE.Vector3(), quat: new THREE.Quaternion(), dir: new THREE.Vector3(0, 1, 0),
      alive: true, hp: WEAK_HP, mesh: mount, radius: 4.5 * this.scale, baseRadius: 4.5,
      head: null, live: [pedestal, cage, cageShell, orb], stub,
    };
  }

  // ─────────────────────────── runtime ───────────────────────────

  setPose(pos: THREE.Vector3, quat: THREE.Quaternion): void {
    this.group.position.copy(pos);
    this.group.quaternion.copy(quat);
  }

  /** Slew every live turret toward `target` (world) at `turnRate` rad/s; barrels never dip below the ring plane. */
  aimAt(target: THREE.Vector3, dt: number): void {
    for (const t of this.turrets) {
      const part = t as Part;
      if (!part.alive || !part.head) continue;
      const mount = part.mesh;
      mount.updateWorldMatrix(true, false);
      _p.copy(target);
      mount.worldToLocal(_p);
      _p.y -= part.head.position.y;
      if (_p.y < 0) _p.y = 0;
      if (_p.lengthSq() < 1e-6) continue;
      _p.normalize();
      _m.lookAt(_p, ZERO, PY);
      _q.setFromRotationMatrix(_m);
      part.head.quaternion.rotateTowards(_q, this.turnRate * dt);
    }
  }

  /** Per frame: ring turns at 0.03 rad/s, windows flicker, world transforms of parts refresh, smoke points collect. */
  update(dt: number): void {
    this.t += dt;
    if (this.deathT < 0) this.ring.rotation.y += 0.03 * dt;
    // window flicker: mostly steady, with a slow beat and a rare dip
    const beat = 0.92 + 0.08 * Math.sin(this.t * 1.7) + (Math.sin(this.t * 23.1) > 0.97 ? -0.35 : 0);
    this.windowMat.color.copy(this.glowBase).multiplyScalar(this.deathT < 0 ? beat : Math.max(0, 1 - this.deathT * 1.5));
    const pulse = 0.85 + 0.15 * Math.sin(this.t * 3.3);
    this.nodeMat.color.copy(this.nodeBase).multiplyScalar(pulse);

    this.group.updateMatrixWorld(true);
    let smoke = 0;
    for (const part of this.parts) {
      part.radius = part.baseRadius * this.scale;
      const anchor = part.head ?? part.mesh;
      anchor.getWorldPosition(part.pos);
      anchor.getWorldQuaternion(part.quat);
      part.dir.set(0, 0, 1).applyQuaternion(part.quat);
      if (part.head === null) part.dir.set(0, 1, 0).applyQuaternion(part.quat);
      if (!part.alive) this.smokePoints[smoke++]!.copy(part.pos);
    }
    // hull wounds appear as core hp drops: up to four fixed spots on the pyramid
    const wounds = Math.min(4, Math.floor((1 - Math.max(0, this.hp) / 600) * 5));
    for (let i = 0; i < wounds; i++) {
      const face = (i * Math.PI) / 2 + 0.4;
      facePoint(_p, face, 0.25 + i * 0.12, 0.3 - i * 0.2, 1);
      this.smokePoints[smoke++]!.copy(_p).applyMatrix4(this.group.matrixWorld);
    }
    this.smokeCount = smoke;
  }

  /** Damage a turret or shield node; on death hides its live parts and shows a scorched stub. Returns true when it dies now. */
  damagePart(part: Turret, amount: number): boolean {
    const p = part as Part;
    if (!p.alive) return false;
    p.hp -= amount;
    if (p.hp > 0) return false;
    p.hp = 0;
    p.alive = false;
    for (const o of p.live) o.visible = false;
    p.stub.visible = true;
    return true;
  }

  /**
   * Death sequence: staged sub-explosions over 2.5 s (`onBurst(worldPos, scale)` per burst, the last one large),
   * windows go dark, the ring stops, then the hull collapses and the group hides. Returns true once finished.
   */
  die(dt: number, onBurst: (pos: THREE.Vector3, scale: number) => void): boolean {
    if (this.deathT < 0) {
      this.deathT = 0;
      this.alive = false;
      this.hp = 0;
    }
    if (!this.group.visible) return true;
    this.deathT += dt;
    while (this.burstsFired < DEATH_BURSTS && this.deathT >= (this.burstsFired / DEATH_BURSTS) * (DEATH_T - 0.3)) {
      const i = this.burstsFired++;
      _p.set(this.burstLocal[i * 3]!, this.burstLocal[i * 3 + 1]!, this.burstLocal[i * 3 + 2]!).applyMatrix4(this.group.matrixWorld);
      onBurst(_p, this.burstScale[i]! * this.scale);
    }
    // shudder, then collapse over the last 0.4 s
    const k = this.deathT > DEATH_T - 0.4 ? Math.max(0, (DEATH_T - this.deathT) / 0.4) : 1;
    this.group.scale.setScalar(this.scale * k);
    if (k === 1) {
      const j = Math.sin(this.deathT * 41) * 0.6 * this.deathT;
      this.group.position.x += j * dt;
      this.group.position.y -= j * dt * 0.5;
    }
    if (this.deathT >= DEATH_T) {
      this.group.visible = false;
      return true;
    }
    return false;
  }

  /**
   * Signed clearance (local metres, negative inside) of a local point from the solid hull: the pyramid,
   * its inverted underside and the ring band. Sets `n` to the outward normal of the nearest face.
   */
  private clearance(p: THREE.Vector3, n: THREE.Vector3): number {
    const ax = Math.abs(p.x), az = Math.abs(p.z);
    let d: number;
    if (p.y >= 0) {
      // faces x + k y = BASE (and z), normal (1, k, 0) / |.|
      const k = BASE / HEIGHT, inv = 1 / Math.hypot(1, k);
      const dx = (ax + k * p.y - BASE) * inv, dz = (az + k * p.y - BASE) * inv;
      if (dx > dz) (d = dx), n.set(Math.sign(p.x) || 1, k, 0).multiplyScalar(inv);
      else (d = dz), n.set(0, k, Math.sign(p.z) || 1).multiplyScalar(inv);
      const top = p.y - HEIGHT;
      if (top > d) (d = top), n.set(0, 1, 0);
    } else {
      const k = BASE / UNDER, inv = 1 / Math.hypot(1, k);
      const dx = (ax - k * p.y - BASE) * inv, dz = (az - k * p.y - BASE) * inv;
      if (dx > dz) (d = dx), n.set(Math.sign(p.x) || 1, -k, 0).multiplyScalar(inv);
      else (d = dz), n.set(0, -k, Math.sign(p.z) || 1).multiplyScalar(inv);
      const bottom = -UNDER - p.y;
      if (bottom > d) (d = bottom), n.set(0, -1, 0);
    }
    // the ring band: an annulus RING_IN..LOBE_OUT between RING_Y0 and RING_Y1
    const rr = Math.hypot(p.x, p.z);
    const ry = Math.max(RING_Y0 - p.y, p.y - RING_Y1), rrad = Math.max(RING_IN - rr, rr - LOBE_OUT);
    const dr = Math.max(ry, rrad);
    if (dr < d) {
      d = dr;
      if (ry > rrad) n.set(0, p.y > (RING_Y0 + RING_Y1) / 2 ? 1 : -1, 0);
      else n.set(p.x, 0, p.z).multiplyScalar((rr < (RING_IN + LOBE_OUT) / 2 ? -1 : 1) / (rr || 1));
    }
    return d;
  }

  /** True when the world point is inside the solid hull (pyramid, underside or ring band). */
  contains(world: THREE.Vector3): boolean {
    _v.copy(world);
    this.group.worldToLocal(_v);
    return this.clearance(_v, _p) < 0;
  }

  /** A round travelled a→b this tick: sample the segment against the solid. */
  hitBy(a: THREE.Vector3, b: THREE.Vector3): boolean {
    for (let i = 0; i <= 4; i++) {
      _v.copy(a).lerp(b, i / 4);
      this.group.worldToLocal(_v);
      if (this.clearance(_v, _p) < 0) return true;
    }
    return false;
  }

  /**
   * Keep a sphere of `margin` (world metres) around `pos` out of the hull: moves `pos` along the nearest
   * face and returns that normal in `n`, or null when clear. Replaces the one big bounding sphere that
   * kept the player 30 m away from the shield nodes.
   */
  pushOut(pos: THREE.Vector3, margin: number, n: THREE.Vector3): boolean {
    _v.copy(pos);
    this.group.worldToLocal(_v);
    const m = margin / this.scale;
    const d = this.clearance(_v, n);
    if (d >= m) return false;
    _v.addScaledVector(n, m - d);
    this.group.localToWorld(_v);
    pos.copy(_v);
    n.applyQuaternion(this.group.quaternion).normalize();
    return true;
  }

  /** Debug: dump the hp / alive state of every part. */
  describe(): string {
    return `capital hp=${this.hp} alive=${this.alive} turrets=${this.turrets.filter((t) => t.alive).length}/${this.turrets.length} nodes=${this.weakPoints.filter((t) => t.alive).length}/3 tris=${this.triangles}`;
  }
}
