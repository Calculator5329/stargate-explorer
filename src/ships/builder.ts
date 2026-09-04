import * as THREE from "three";
import type { AirfoilDef, CanopyDef, DecalDef, EngineDef, FinDef, HatchDef, HullSection, PaletteSlot, ShipDef, Vec3 } from "@/ships/defs";
import { glowMaterial, toonMaterial } from "@/render/toon";
import { outlineShell } from "@/render/outline";
import { noEdge } from "@/render/layers";

/**
 * Parametric ship builder. Every solid is a triangle soup with outward
 * orientation fixed geometrically (so mirrored parts never end up inside-out),
 * bucketed by palette slot into one mesh per slot, plus one inverted-hull
 * outline shell per solid. Non-indexed → flat shading from computeVertexNormals().
 */
export function buildShip(def: ShipDef): THREE.Group {
  const g = new THREE.Group();
  g.name = def.name;
  const soup = new Soup();

  hull(soup, def);
  for (const w of def.wings) {
    airfoil(soup, w, false);
    if (w.mirror !== false) airfoil(soup, w, true);
  }
  for (const f of def.fins) fin(soup, f);
  for (const e of def.engines) engine(soup, e);
  for (const e of def.pods ?? []) pod(soup, e);
  if (def.canopy) canopy(soup, def.canopy);
  for (const h of def.hatches) {
    hatch(soup, h, false);
    if (h.mirror) hatch(soup, h, true);
  }

  const p = def.palette;
  const mats: Record<PaletteSlot, THREE.Material> = {
    body: toonMaterial(p.body),
    accent: toonMaterial(p.accent),
    dark: toonMaterial(p.dark),
    glow: glowMaterial(p.glow),
    canopy: toonMaterial(p.canopy, { emissive: p.glow, emissiveIntensity: 0.25 }),
  };
  for (const [slot, tris] of soup.buckets) {
    if (tris.length === 0) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(tris, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mats[slot]);
    mesh.name = slot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  for (const shell of soup.solids) g.add(outlineShell(shell));

  for (const e of def.engines) {
    const glow = noEdge(new THREE.Mesh(new THREE.CircleGeometry(e.radius * 0.5, 16), mats.glow));
    glow.rotation.y = Math.PI; // face −Z
    glow.position.set(e.pos[0], e.pos[1], e.pos[2] - e.length / 2 - 0.2);
    g.add(glow);
  }
  for (const d of def.decals) {
    g.add(decal(d, p, false));
    if (d.mirror) g.add(decal(d, p, true));
  }
  return g;
}

// ───────────────────────────── triangle soup ─────────────────────────────

type SlotFn = (n: THREE.Vector3, centroid: THREE.Vector3, ring: number, seg: number) => PaletteSlot;

class Soup {
  readonly buckets = new Map<PaletteSlot, number[]>([
    ["body", []],
    ["accent", []],
    ["dark", []],
    ["glow", []],
    ["canopy", []],
  ]);
  /** one position list per solid, for its outline shell */
  readonly solids: number[][] = [];
  private current: number[] = [];

  begin(): void {
    this.current = [];
    this.solids.push(this.current);
  }

  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, slot: PaletteSlot): void {
    const out = this.buckets.get(slot)!;
    out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    this.current.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
}

const _ab = new THREE.Vector3();
const _ac = new THREE.Vector3();
const _n = new THREE.Vector3();
const _cen = new THREE.Vector3();
const _ref = new THREE.Vector3();

/**
 * Emit a triangle wound so its normal agrees with `ref`: when `refIsDir`, ref is
 * the desired outward direction; otherwise ref is an interior point the normal
 * must face away from. `inward` flips the rule (throat interiors).
 */
function oriented(
  soup: Soup,
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  ref: THREE.Vector3,
  refIsDir: boolean,
  slotFn: SlotFn,
  ring: number,
  seg: number,
  inward = false,
): void {
  _n.crossVectors(_ab.subVectors(b, a), _ac.subVectors(c, a));
  if (_n.lengthSq() < 1e-12) return;
  _n.normalize();
  _cen.addVectors(a, b).add(c).multiplyScalar(1 / 3);
  const dir = refIsDir ? ref : _ref.subVectors(_cen, ref);
  let flip = _n.dot(dir) < 0;
  if (inward) flip = !flip;
  if (flip) {
    _n.negate();
    soup.tri(a, c, b, slotFn(_n, _cen, ring, seg));
  } else {
    soup.tri(a, b, c, slotFn(_n, _cen, ring, seg));
  }
}

function mean(ring: THREE.Vector3[]): THREE.Vector3 {
  const c = new THREE.Vector3();
  for (const p of ring) c.add(p);
  return c.multiplyScalar(1 / ring.length);
}

interface LoftOptions {
  /** cap offsets along the loft axis beyond the first/last ring; undefined = open */
  capStart?: number;
  capEnd?: number;
  /** recessed cells keyed `${ring},${seg}` → depth */
  insets?: Map<string, number>;
  inward?: boolean;
}

/** Loft consecutive rings (all the same vertex count) into quads, with optional caps and recessed cells. */
function loft(soup: Soup, rings: THREE.Vector3[][], slotFn: SlotFn, o: LoftOptions = {}): void {
  const centers = rings.map(mean);
  const inward = o.inward ?? false;
  for (let k = 0; k + 1 < rings.length; k++) {
    const A = rings[k]!;
    const B = rings[k + 1]!;
    const n = A.length;
    const c = centers[k]!.clone().add(centers[k + 1]!).multiplyScalar(0.5);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const depth = o.insets?.get(`${k},${i}`);
      if (depth === undefined) {
        oriented(soup, A[i]!, A[j]!, B[j]!, c, false, slotFn, k, i, inward);
        oriented(soup, A[i]!, B[j]!, B[i]!, c, false, slotFn, k, i, inward);
      } else {
        inset(soup, [A[i]!, A[j]!, B[j]!, B[i]!], depth, c, slotFn, k, i);
      }
    }
  }
  const capOf = (ring: THREE.Vector3[], center: THREE.Vector3, neighbour: THREE.Vector3, offset: number) => {
    const axis = center.clone().sub(neighbour).normalize();
    const tip = center.clone().addScaledVector(axis, offset);
    for (let i = 0; i < ring.length; i++) {
      oriented(soup, ring[i]!, ring[(i + 1) % ring.length]!, tip, axis, true, slotFn, -1, i, inward);
    }
  };
  if (o.capStart !== undefined) capOf(rings[0]!, centers[0]!, centers[1]!, o.capStart);
  if (o.capEnd !== undefined) {
    const last = rings.length - 1;
    capOf(rings[last]!, centers[last]!, centers[last - 1]!, o.capEnd);
  }
}

const INSET_MARGIN = 0.14;

/** Recessed cell: floor pushed in along the face normal, four walls facing the recess centre. */
function inset(soup: Soup, P: THREE.Vector3[], depth: number, interior: THREE.Vector3, slotFn: SlotFn, ring: number, seg: number): void {
  const qc = mean(P);
  const N = new THREE.Vector3().crossVectors(_ab.subVectors(P[1]!, P[0]!), _ac.subVectors(P[3]!, P[0]!)).normalize();
  if (N.dot(_ref.subVectors(qc, interior)) < 0) N.negate();
  const Q = P.map((p) => p.clone().lerp(qc, INSET_MARGIN).addScaledVector(N, -depth));
  oriented(soup, Q[0]!, Q[1]!, Q[2]!, interior, false, slotFn, ring, seg);
  oriented(soup, Q[0]!, Q[2]!, Q[3]!, interior, false, slotFn, ring, seg);
  for (let m = 0; m < 4; m++) {
    const m1 = (m + 1) % 4;
    // wall normal must point toward the recess centre
    _cen.addVectors(P[m]!, P[m1]!).add(Q[m1]!).add(Q[m]!).multiplyScalar(0.25);
    const dir = qc.clone().sub(_cen);
    oriented(soup, P[m]!, P[m1]!, Q[m1]!, dir, true, slotFn, ring, seg);
    oriented(soup, P[m]!, Q[m1]!, Q[m]!, dir, true, slotFn, ring, seg);
  }
}

// ───────────────────────────── sections ─────────────────────────────

/** Superellipse ring for one section; CCW seen from +Z, starting at +X (port). */
function ring(s: HullSection, n: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const e = 2 / s.n;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const c = Math.cos(t);
    const si = Math.sin(t);
    pts.push(new THREE.Vector3(Math.sign(c) * Math.abs(c) ** e * s.w, Math.sign(si) * Math.abs(si) ** e * s.h + (s.yOff ?? 0), s.z));
  }
  return pts;
}

/** Six-point airfoil in the plane x = const; z is chord (LE at +z), y thickness. */
function airfoilSection(x: number, zLE: number, chord: number, t: number): THREE.Vector3[] {
  const zTE = zLE - chord;
  return [
    new THREE.Vector3(x, 0, zLE),
    new THREE.Vector3(x, t * 0.5, zLE - chord * 0.3),
    new THREE.Vector3(x, t * 0.32, zLE - chord * 0.72),
    new THREE.Vector3(x, 0, zTE),
    new THREE.Vector3(x, -t * 0.32, zLE - chord * 0.72),
    new THREE.Vector3(x, -t * 0.5, zLE - chord * 0.3),
  ];
}

// ───────────────────────────── parts ─────────────────────────────

const underside = (n: THREE.Vector3): PaletteSlot => (n.y < -0.4 ? "dark" : "body");

function hull(soup: Soup, def: ShipDef): void {
  soup.begin();
  const n = def.ringVerts;
  const sections = [...def.hull].sort((a, b) => a.z - b.z);
  const rings = sections.map((s) => ring(s, n));
  const mirrorSeg = (seg: number) => (((n / 2 - 1 - seg) % n) + n) % n;
  const insets = new Map<string, number>();
  for (const p of def.panels) {
    insets.set(`${p.ring},${p.seg}`, p.depth ?? 0.06);
    if (p.mirror) insets.set(`${p.ring},${mirrorSeg(p.seg)}`, p.depth ?? 0.06);
  }
  const stripes = new Set<string>();
  for (const s of def.stripes) {
    for (let k = s.ringFrom; k < s.ringTo; k++) {
      stripes.add(`${k},${s.seg}`);
      if (s.mirror) stripes.add(`${k},${mirrorSeg(s.seg)}`);
    }
  }
  loft(soup, rings, (nrm, _c, k, i) => (stripes.has(`${k},${i}`) ? "accent" : underside(nrm)), { capStart: 0.3, capEnd: 0.4, insets });
}

function transformed(pts: THREE.Vector3[], q: THREE.Quaternion, offset: THREE.Vector3, mirror: boolean): THREE.Vector3[] {
  return pts.map((p) => {
    const v = p.clone().applyQuaternion(q).add(offset);
    if (mirror) v.x = -v.x;
    return v;
  });
}

const Z_AXIS = new THREE.Vector3(0, 0, 1);
/** Leading-edge faces and the tip cap take the accent slot. */
const wingSlot = (n: THREE.Vector3, _c: THREE.Vector3, k: number): PaletteSlot => (n.z > 0.6 || (k === -1 && Math.abs(n.x) > 0.5) ? "accent" : "body");

function airfoil(soup: Soup, w: AirfoilDef, mirror: boolean): void {
  soup.begin();
  const q = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, w.dihedral);
  const root = new THREE.Vector3(...w.root);
  const a = airfoilSection(0, w.rootChord / 2, w.rootChord, w.thickness);
  const b = airfoilSection(w.span, w.rootChord / 2 - w.sweep, w.tipChord, w.thickness * 0.4);
  loft(soup, [transformed(a, q, root, mirror), transformed(b, q, root, mirror)], wingSlot, { capStart: 0, capEnd: 0.02 });
}

function fin(soup: Soup, f: FinDef): void {
  soup.begin();
  const q = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, f.angle);
  const root = new THREE.Vector3(...f.root);
  const a = airfoilSection(0, f.rootChord / 2, f.rootChord, f.thickness);
  const b = airfoilSection(f.height, f.rootChord / 2 - f.sweep, f.tipChord, f.thickness * 0.4);
  loft(soup, [transformed(a, q, root, false), transformed(b, q, root, false)], (n, _c, k) => (n.z > 0.6 || k === -1 ? "accent" : "body"), { capStart: 0, capEnd: 0.02 });
}

/** Nacelle body (boxy-round loft), a stack of nozzle rings, and an inward throat. */
function engine(soup: Soup, e: EngineDef): void {
  const [x, y, z] = e.pos;
  const r = e.radius;
  const L = e.length;
  const sec = (dz: number, k: number, n = 2.6): HullSection => ({ z: z + dz, w: r * k, h: r * k, n, yOff: y });
  const shift = (rings: THREE.Vector3[][]) => rings.map((rg) => rg.map((p) => p.setX(p.x + x)));

  soup.begin();
  const front = e.intake ? [sec(L / 2 - 0.6, 1, 3.4), sec(L / 2, 1.0, 3.6)] : [sec(L / 2 - 0.7, 1), sec(L / 2, 0.78)];
  loft(soup, shift([sec(-L / 2, 0.92), sec(-L / 2 + 0.5, 1), ...front].map((s) => ring(s, 12))), underside, e.intake ? {} : { capEnd: 0.3 });
  if (e.intake) {
    soup.begin();
    const lip = [sec(L / 2, 0.98, 3.6), sec(L / 2 + 0.08, 1.02, 3.6), sec(L / 2, 0.86, 3.6)];
    loft(soup, shift(lip.map((s) => ring(s, 12))), () => "dark");
    soup.begin();
    loft(soup, shift([sec(L / 2, 0.86, 3.6), sec(L / 2 - 0.9, 0.5, 3.0)].map((s) => ring(s, 12))), () => "dark", { inward: true });
  }

  soup.begin();
  const rear = -L / 2;
  const nozzle = [sec(rear, 0.92, 2.2), sec(rear - 0.12, 1.08, 2.2), sec(rear - 0.28, 0.94, 2.2), sec(rear - 0.42, 1.04, 2.2), sec(rear - 0.56, 0.82, 2.2)];
  loft(soup, shift(nozzle.map((s) => ring(s, 12))), () => "dark");

  soup.begin();
  const throat = [sec(rear - 0.56, 0.8, 2.2), sec(rear - 0.1, 0.52, 2.2)];
  loft(soup, shift(throat.map((s) => ring(s, 12))), () => "dark", { inward: true });
}

/** Plume-less nacelle: body-coloured tube, dark rear cap, pointed nose. */
function pod(soup: Soup, e: EngineDef): void {
  const [x, y, z] = e.pos;
  const r = e.radius;
  const L = e.length;
  const sec = (dz: number, k: number): HullSection => ({ z: z + dz, w: r * k, h: r * k, n: 2.4, yOff: y });
  soup.begin();
  const rings = [sec(-L / 2, 0.85), sec(-L / 2 + 0.3, 1), sec(L / 2 - 1.0, 1), sec(L / 2, 0.6)].map((s) => ring(s, 12).map((p) => p.setX(p.x + x)));
  loft(soup, rings, (n, _c, k) => (k === -1 && n.z < -0.5 ? "dark" : underside(n)), { capStart: 0.05, capEnd: 0.7 });
}

function canopy(soup: Soup, c: CanopyDef): void {
  soup.begin();
  const sections = [...c.sections].sort((a, b) => a.z - b.z);
  loft(soup, sections.map((s) => ring(s, 12)), () => "canopy", { capStart: 0.05, capEnd: 0.1 });
  for (const idx of c.frameBands) {
    const s = sections[idx];
    if (!s) continue;
    soup.begin();
    const band = (dz: number): HullSection => ({ z: s.z + dz, w: s.w * 1.06, h: s.h * 1.06, n: s.n, yOff: s.yOff ?? 0 });
    loft(soup, [ring(band(-0.07), 12), ring(band(0.07), 12)], () => "dark");
  }
}

const FACE_ROT: Record<HatchDef["face"], number> = { top: 0, bottom: Math.PI, port: -Math.PI / 2, starboard: Math.PI / 2 };
const MIRROR_FACE: Record<HatchDef["face"], HatchDef["face"]> = { top: "top", bottom: "bottom", port: "starboard", starboard: "port" };

/** Thin plate sitting on the hull surface; its face normal is set by `face`. */
function hatch(soup: Soup, h: HatchDef, mirror: boolean): void {
  soup.begin();
  const face = mirror ? MIRROR_FACE[h.face] : h.face;
  const box = new THREE.BoxGeometry(h.size[0], 0.05, h.size[1]).toNonIndexed();
  box.rotateZ(FACE_ROT[face]);
  box.translate(mirror ? -h.pos[0] : h.pos[0], h.pos[1], h.pos[2]);
  const pos = box.getAttribute("position");
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    soup.tri(a, b, c, "dark");
  }
  box.dispose();
}

// ───────────────────────────── decals ─────────────────────────────

const decalCache = new Map<string, THREE.CanvasTexture>();

function decalTexture(d: DecalDef, color: number): THREE.CanvasTexture {
  const key = `${d.kind}:${d.text ?? ""}:${color}`;
  const hit = decalCache.get(key);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 128;
  const g = cv.getContext("2d");
  if (!g) throw new Error("2d canvas unavailable");
  g.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
  if (d.kind === "chevron") {
    cv.height = 256;
    for (const y0 of [40, 120]) {
      g.beginPath();
      g.moveTo(24, y0 + 90);
      g.lineTo(128, y0);
      g.lineTo(232, y0 + 90);
      g.lineTo(232, y0 + 40);
      g.lineTo(128, y0 - 48);
      g.lineTo(24, y0 + 40);
      g.closePath();
      g.fill();
    }
  } else if (d.kind === "number") {
    g.font = "bold 104px 'Arial Narrow', Arial, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(d.text ?? "", 128, 68);
  } else {
    g.fillRect(0, 40, 256, 48);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  decalCache.set(key, tex);
  return tex;
}

function decal(d: DecalDef, palette: ShipDef["palette"], mirror: boolean): THREE.Mesh {
  const color = palette[d.slot ?? (d.kind === "number" ? "dark" : "accent")];
  const mat = new THREE.MeshBasicMaterial({ map: decalTexture(d, color), transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(d.size[0], d.size[1]), mat);
  const p: Vec3 = mirror ? [-d.pos[0], d.pos[1], d.pos[2]] : d.pos;
  const r: Vec3 = mirror ? [d.rot[0], -d.rot[1], -d.rot[2]] : d.rot;
  m.position.set(...p);
  m.rotation.set(...r);
  m.castShadow = false;
  m.name = "decal";
  return m;
}
