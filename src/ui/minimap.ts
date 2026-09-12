import { Vector3 } from "three";
import type { Flight } from "@/sim/flight";
import type { Enemy } from "@/combat/enemies";
import type { Tracked } from "@/combat/targets";
import type { Asteroids } from "@/world/asteroids";
import { T } from "@/core/tunables";

const SIZE = 180;
const ROCK_TINT = { rock: "#c9825c", ice: "#9fd3e6", wreck: "#8f98a3" } as const;

/**
 * Top-down mini-map (2026-09-04, Ethan). Ship at the centre, heading up: the
 * world is rotated by the ship's yaw (its nose projected on the XZ plane), so
 * port is on the left. Rocks are dots sized by radius and faded by how far
 * above or below the ship they sit; fragments glow; enemies are red; the
 * mission marker or gate is gold. The arena edge draws as a ring.
 */
export class Minimap {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly px: number;
  private sinceDraw = 1;

  constructor(canvas: HTMLCanvasElement, private readonly rocks: Asteroids) {
    this.px = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = canvas.height = SIZE * this.px;
    this.ctx = canvas.getContext("2d")!;
  }

  /** Redrawn at 30 Hz: the sim it shows moves at 60, and a 180 px map does not need 240 canvas passes a second. */
  update(flight: Flight, enemies: Enemy[], marker: Tracked | null, dt = 1, friendlies: readonly Tracked[] = []): void {
    this.sinceDraw += dt;
    if (this.sinceDraw < 1 / 30) return;
    this.sinceDraw = 0;
    const c = this.ctx, px = this.px, half = (SIZE * px) / 2;
    const range = T.rocks.mapRange, k = half / range;
    _f.set(0, 0, 1).applyQuaternion(flight.quat);
    const yaw = Math.atan2(_f.x, _f.z), cs = Math.cos(yaw), sn = Math.sin(yaw);
    const P = flight.pos;
    // world offset (dx, dz) → canvas: rotate by -yaw so the nose points up, then mirror x (port is +X)
    const sx = (dx: number, dz: number) => half - (dx * cs - dz * sn) * k;
    const sy = (dx: number, dz: number) => half - (dx * sn + dz * cs) * k;
    c.clearRect(0, 0, SIZE * px, SIZE * px);
    c.save();
    c.beginPath();
    c.arc(half, half, half - px, 0, Math.PI * 2);
    c.clip();
    // arena edge
    c.strokeStyle = "rgba(127,212,255,.35)";
    c.lineWidth = px;
    c.beginPath();
    c.arc(sx(-P.x, -P.z), sy(-P.x, -P.z), T.arena.radius * k, 0, Math.PI * 2);
    c.stroke();
    // rocks
    const R = this.rocks, tint = ROCK_TINT[R.style];
    const lim = range * 1.15;
    for (let i = 0; i < R.count; i++) {
      const r = R.radii[i]!;
      if (r <= 0) continue;
      const dx = R.centers[i * 3]! - P.x, dy = R.centers[i * 3 + 1]! - P.y, dz = R.centers[i * 3 + 2]! - P.z;
      if (Math.abs(dx) > lim || Math.abs(dz) > lim) continue;
      const fade = Math.max(0.18, 1 - Math.abs(dy) / 420);
      c.globalAlpha = fade;
      c.fillStyle = R.ttl[i]! > 0 ? "#ffd9a8" : tint;
      const d = Math.max(1.1 * px, r * k);
      c.beginPath();
      c.arc(sx(dx, dz), sy(dx, dz), d, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    c.fillStyle = "#72e2d0";
    for (const ally of friendlies) {
      if (!ally.alive) continue;
      const x = sx(ally.pos.x - P.x, ally.pos.z - P.z), y = sy(ally.pos.x - P.x, ally.pos.z - P.z);
      c.fillRect(x - 2.5 * px, y - 2.5 * px, 5 * px, 5 * px);
    }
    // enemies
    c.fillStyle = "#ff5a4a";
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.pos.x - P.x, dz = e.pos.z - P.z;
      const x = sx(dx, dz), y = sy(dx, dz);
      c.beginPath();
      c.arc(x, y, 2.4 * px, 0, Math.PI * 2);
      c.fill();
    }
    // marker: a diamond, clamped to the rim when out of range
    if (marker && marker.alive) {
      let dx = marker.pos.x - P.x, dz = marker.pos.z - P.z;
      const d = Math.hypot(dx, dz);
      if (d > range * 0.96) (dx *= (range * 0.96) / d), (dz *= (range * 0.96) / d);
      const x = sx(dx, dz), y = sy(dx, dz), s = 4 * px;
      c.fillStyle = "#ffd15a";
      c.beginPath();
      c.moveTo(x, y - s);
      c.lineTo(x + s, y);
      c.lineTo(x, y + s);
      c.lineTo(x - s, y);
      c.closePath();
      c.fill();
    }
    // the ship: a small triangle pointing up
    c.fillStyle = "#e8f6ff";
    c.beginPath();
    c.moveTo(half, half - 6 * px);
    c.lineTo(half + 4 * px, half + 5 * px);
    c.lineTo(half, half + 2.5 * px);
    c.lineTo(half - 4 * px, half + 5 * px);
    c.closePath();
    c.fill();
    c.restore();
  }
}

const _f = new Vector3();
