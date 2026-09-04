import * as THREE from "three";
import { T } from "@/core/tunables";

/**
 * One shared 4-texel gradient ramp for every MeshToonMaterial: two shadow
 * texels, one mid, one lit. MeshToonMaterial maps dot(N,L) from -1..1 across
 * the ramp, so the visible bands are shadow / half-lit / lit. Lit brightness
 * is albedo × keyIntensity / π; keep albedo × (key + fill) / π under 1.0 or
 * the hull will bloom (threshold in T.render.bloomThreshold).
 */
const RAMP_W = 4;
const rampData = new Uint8Array(RAMP_W);
const ramp = new THREE.DataTexture(rampData, RAMP_W, 1, THREE.RedFormat);
ramp.minFilter = THREE.NearestFilter;
ramp.magFilter = THREE.NearestFilter;
ramp.generateMipmaps = false;
let rampKey = NaN;

export function updateToonRamp(): void {
  const key = T.toon.shadowStep * 1000 + T.toon.midStep;
  if (key === rampKey) return;
  rampKey = key;
  const s = Math.round(T.toon.shadowStep * 255);
  rampData[0] = s;
  rampData[1] = s;
  rampData[2] = Math.round(T.toon.midStep * 255);
  rampData[3] = 255;
  ramp.needsUpdate = true;
}
updateToonRamp();

export interface ToonOptions {
  emissive?: number;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
}

export function toonMaterial(color: number, o: ToonOptions = {}): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: ramp });
  if (o.emissive !== undefined) {
    m.emissive.set(o.emissive);
    m.emissiveIntensity = o.emissiveIntensity ?? 1;
  }
  if (o.transparent) {
    m.transparent = true;
    m.opacity = o.opacity ?? 1;
  }
  return m;
}

/** Unlit HDR colour for glow discs, plume cores and anything that must bloom. */
export function glowMaterial(color: number, intensity = 2.5): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) });
  m.toneMapped = false;
  return m;
}
