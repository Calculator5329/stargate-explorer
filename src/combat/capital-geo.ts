import * as THREE from "three";

/**
 * Geometry helpers for the capital ship: a tiny triangle soup that buckets
 * flat-shaded triangles by material slot and keeps one position list per solid
 * so `outlineShell` can wrap each solid separately. Winding is fixed against an
 * explicit outward normal per quad, the same idea as `ships/builder.ts`, so
 * nothing ends up inside-out whichever way a sector is traced.
 */
export type CapitalSlot = "gold" | "bronze" | "dark" | "glow";

const _ab = new THREE.Vector3();
const _ac = new THREE.Vector3();
const _n = new THREE.Vector3();

export class CapitalSoup {
  readonly buckets = new Map<CapitalSlot, number[]>([
    ["gold", []],
    ["bronze", []],
    ["dark", []],
    ["glow", []],
  ]);
  /** one position list per solid, for its outline shell */
  readonly solids: number[][] = [];
  private current: number[] = [];
  private shelled = true;

  /** Start a new solid. `shell=false` keeps it out of the outline pass (glow strips, recess quads). */
  begin(shell = true): void {
    this.current = [];
    this.shelled = shell;
    if (shell) this.solids.push(this.current);
  }

  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, out: THREE.Vector3, slot: CapitalSlot): void {
    _n.crossVectors(_ab.subVectors(b, a), _ac.subVectors(c, a));
    if (_n.lengthSq() < 1e-9) return;
    const flip = _n.dot(out) < 0;
    const list = this.buckets.get(slot)!;
    if (flip) list.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
    else list.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    if (this.shelled) {
      const n = list.length;
      for (let i = n - 9; i < n; i++) this.current.push(list[i]!);
    }
  }

  /** a,b,c,d traced around the quad; `out` is the side the face must show. */
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, out: THREE.Vector3, slot: CapitalSlot): void {
    this.tri(a, b, c, out, slot);
    this.tri(a, c, d, out, slot);
  }

  /** Axis-aligned box, all six faces one slot. */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, slot: CapitalSlot): void {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    const p = BOX_P;
    p[0].set(x0, y0, z0); p[1].set(x1, y0, z0); p[2].set(x1, y1, z0); p[3].set(x0, y1, z0);
    p[4].set(x0, y0, z1); p[5].set(x1, y0, z1); p[6].set(x1, y1, z1); p[7].set(x0, y1, z1);
    this.quad(p[0], p[1], p[2], p[3], NZ, slot);
    this.quad(p[4], p[5], p[6], p[7], PZ, slot);
    this.quad(p[0], p[4], p[7], p[3], NX, slot);
    this.quad(p[1], p[5], p[6], p[2], PX, slot);
    this.quad(p[3], p[2], p[6], p[7], PY, slot);
    this.quad(p[0], p[1], p[5], p[4], NY, slot);
  }

  /**
   * Annular sector about +Y: radii rIn..rOut, y0..y1, angles a0..a1 (radians about Y, x = r cos a, z = r sin a).
   * Emits top, bottom, inner and outer walls and, when the arc is partial, the two end caps.
   */
  sector(rIn: number, rOut: number, y0: number, y1: number, a0: number, a1: number, segs: number, top: CapitalSlot, wall: CapitalSlot, bottom = wall): void {
    const full = Math.abs(a1 - a0 - Math.PI * 2) < 1e-6;
    const p = SEC_P;
    for (let i = 0; i < segs; i++) {
      const t0 = a0 + ((a1 - a0) * i) / segs, t1 = a0 + ((a1 - a0) * (i + 1)) / segs;
      const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
      p[0].set(rIn * c0, y1, rIn * s0); p[1].set(rOut * c0, y1, rOut * s0); p[2].set(rOut * c1, y1, rOut * s1); p[3].set(rIn * c1, y1, rIn * s1);
      p[4].set(rIn * c0, y0, rIn * s0); p[5].set(rOut * c0, y0, rOut * s0); p[6].set(rOut * c1, y0, rOut * s1); p[7].set(rIn * c1, y0, rIn * s1);
      this.quad(p[0], p[1], p[2], p[3], PY, top);
      this.quad(p[4], p[5], p[6], p[7], NY, bottom);
      _out.set(c0 + c1, 0, s0 + s1);
      this.quad(p[1], p[2], p[6], p[5], _out, wall);
      _in.set(-(c0 + c1), 0, -(s0 + s1));
      this.quad(p[0], p[3], p[7], p[4], _in, wall);
      if (!full && i === 0) {
        _out.set(s0, 0, -c0); // tangent at a0, pointing toward decreasing angle
        this.quad(p[0], p[1], p[5], p[4], _out, wall);
      }
      if (!full && i === segs - 1) {
        _out.set(-s1, 0, c1);
        this.quad(p[3], p[2], p[6], p[7], _out, wall);
      }
    }
  }

  /** Convert one bucket to a flat-shaded geometry (null when empty). */
  geometry(slot: CapitalSlot): THREE.BufferGeometry | null {
    const tris = this.buckets.get(slot)!;
    if (tris.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(tris, 3));
    geo.computeVertexNormals();
    return geo;
  }
}

type Eight = [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];
const eight = (): Eight => [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const BOX_P = eight();
const SEC_P = eight();
const _out = new THREE.Vector3();
const _in = new THREE.Vector3();
export const PX = new THREE.Vector3(1, 0, 0);
export const NX = new THREE.Vector3(-1, 0, 0);
export const PY = new THREE.Vector3(0, 1, 0);
export const NY = new THREE.Vector3(0, -1, 0);
export const PZ = new THREE.Vector3(0, 0, 1);
export const NZ = new THREE.Vector3(0, 0, -1);

/** Sum of rendered triangles under `root` (indexed or soup). */
export function triangleCount(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    const g = m.geometry;
    n += g.index ? g.index.count / 3 : g.getAttribute("position").count / 3;
  });
  return n;
}
