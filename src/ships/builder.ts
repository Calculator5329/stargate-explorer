import * as THREE from "three";
import type { FinDef, HullSection, ShipDef, WingDef } from "@/ships/defs";

/**
 * Parametric ship builder: superellipse-lofted hull, tapered slab wings/fins,
 * cylinder nacelles with emissive glow discs. Everything is non-indexed so
 * flat shading falls out of computeVertexNormals().
 */
export function buildShip(def: ShipDef): THREE.Group {
  const g = new THREE.Group();
  g.name = def.name;
  const p = def.palette;
  const body = solid(p.body);
  const accent = solid(p.accent);
  const dark = solid(p.dark);

  g.add(new THREE.Mesh(loftHull(def.hull, def.ringVerts), body));
  for (const w of def.wings) {
    g.add(new THREE.Mesh(slab(w, false), accent), new THREE.Mesh(slab(w, true), accent));
  }
  for (const f of def.fins) g.add(new THREE.Mesh(fin(f), accent));
  for (const e of def.engines) {
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(e.radius, e.radius * 0.85, e.length, 12), dark);
    nacelle.rotation.x = Math.PI / 2;
    nacelle.position.set(...e.pos);
    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(p.glow).multiplyScalar(2.5) });
    glowMat.toneMapped = false;
    const glow = new THREE.Mesh(new THREE.CircleGeometry(e.radius * 0.8, 16), glowMat);
    glow.rotation.y = Math.PI; // face −Z
    glow.position.set(e.pos[0], e.pos[1], e.pos[2] - e.length / 2 - 0.02);
    g.add(nacelle, glow);
  }
  return g;
}

function solid(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, flatShading: true });
}

function fromTriangles(tris: number[]): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(tris, 3));
  geo.computeVertexNormals();
  return geo;
}

const pushTri = (out: number[], a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
  out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);

/** Superellipse ring for one section; CCW seen from +Z. */
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

/** Sections are given nose-first (descending z); loft consecutive rings and cap both ends. */
function loftHull(sections: HullSection[], n: number): THREE.BufferGeometry {
  const rings = [...sections].sort((a, b) => a.z - b.z).map((s) => ring(s, n));
  const tris: number[] = [];
  for (let k = 0; k + 1 < rings.length; k++) {
    const A = rings[k]!;
    const B = rings[k + 1]!;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      pushTri(tris, A[i]!, A[j]!, B[i]!);
      pushTri(tris, A[j]!, B[j]!, B[i]!);
    }
  }
  const tail = rings[0]!;
  const nose = rings[rings.length - 1]!;
  const tailC = new THREE.Vector3(0, tail[0]!.y - (sections.find((s) => s.z === tail[0]!.z)?.h ?? 0), tail[0]!.z - 0.25);
  const noseC = new THREE.Vector3(0, 0, nose[0]!.z + 0.35);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    pushTri(tris, tail[j]!, tail[i]!, tailC);
    pushTri(tris, nose[i]!, nose[j]!, noseC);
  }
  return fromTriangles(tris);
}

/**
 * Eight-corner tapered slab, root at origin spanning +X. Corner order:
 * 0 root LE, 1 root TE, 2 tip TE, 3 tip LE (top), 4–7 the same on the bottom.
 */
function slabCorners(span: number, rootChord: number, tipChord: number, sweep: number, thickness: number): THREE.Vector3[] {
  const rLE = rootChord / 2;
  const rTE = -rootChord / 2;
  const tLE = rLE - sweep;
  const tTE = tLE - tipChord;
  const t = thickness / 2;
  const tt = t * 0.4;
  return [
    new THREE.Vector3(0, t, rLE), new THREE.Vector3(0, t, rTE), new THREE.Vector3(span, tt, tTE), new THREE.Vector3(span, tt, tLE),
    new THREE.Vector3(0, -t, rLE), new THREE.Vector3(0, -t, rTE), new THREE.Vector3(span, -tt, tTE), new THREE.Vector3(span, -tt, tLE),
  ];
}

// Quads with outward winding for the corner order above.
const SLAB_QUADS: readonly [number, number, number, number][] = [
  [0, 3, 2, 1], // top
  [4, 5, 6, 7], // bottom
  [0, 4, 7, 3], // leading edge
  [1, 2, 6, 5], // trailing edge
  [3, 7, 6, 2], // tip
  [0, 1, 5, 4], // root
];

function slabTriangles(corners: THREE.Vector3[], mirrorX: boolean): number[] {
  const tris: number[] = [];
  for (const [a, b, c, d] of SLAB_QUADS) {
    const A = corners[a]!, B = corners[b]!, C = corners[c]!, D = corners[d]!;
    if (mirrorX) {
      pushTri(tris, C, B, A);
      pushTri(tris, D, C, A);
    } else {
      pushTri(tris, A, B, C);
      pushTri(tris, A, C, D);
    }
  }
  if (mirrorX) for (let i = 0; i < tris.length; i += 3) tris[i] = -tris[i]!;
  return tris;
}

function slab(w: WingDef, mirrorX: boolean): THREE.BufferGeometry {
  const corners = slabCorners(w.span, w.rootChord, w.tipChord, w.sweep, w.thickness);
  const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), w.dihedral);
  const root = new THREE.Vector3(...w.root);
  for (const c of corners) c.applyQuaternion(rot).add(root); // pivot at the root, not the origin
  return fromTriangles(slabTriangles(corners, mirrorX));
}

function fin(f: FinDef): THREE.BufferGeometry {
  const corners = slabCorners(f.height, f.rootChord, f.tipChord, f.sweep, f.thickness);
  const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), f.angle);
  const root = new THREE.Vector3(...f.root);
  for (const c of corners) c.applyQuaternion(rot).add(root);
  return fromTriangles(slabTriangles(corners, false));
}
