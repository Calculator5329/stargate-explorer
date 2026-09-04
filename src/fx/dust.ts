import * as THREE from "three";
import { T } from "@/core/tunables";
import { noEdge } from "@/render/layers";
import { mulberry32 } from "@/core/random";

const VERT = /* glsl */ `
attribute float aEnd;
uniform vec3 uStreak;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position - uStreak * aEnd, 1.0);
}`;
const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
void main() { gl_FragColor = vec4(uColor * uAlpha, uAlpha); }`;

/**
 * Speed dust: a box of motes that rides along with the camera (wrapping at the
 * faces) and streaks each mote backwards along the velocity vector. Invisible
 * when slow, so it reads purely as "you are going fast".
 */
export class Dust {
  readonly lines: THREE.LineSegments;
  private readonly pos: Float32Array;
  private readonly u = { uStreak: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color(0xbfd6ff) }, uAlpha: { value: 0 } };
  private readonly box: number;

  constructor(count = T.fx.dustCount, box = T.fx.dustBox) {
    this.box = box;
    const rnd = mulberry32(99);
    this.pos = new Float32Array(count * 6);
    const end = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const x = (rnd() - 0.5) * box, y = (rnd() - 0.5) * box, z = (rnd() - 0.5) * box;
      this.pos.set([x, y, z, x, y, z], i * 6);
      end[i * 2 + 1] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.u, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.lines = noEdge(new THREE.LineSegments(g, mat));
    this.lines.frustumCulled = false;
  }

  /** `vel` is the ship's world velocity (m/s). Motes wrap around `center`. */
  update(center: THREE.Vector3, vel: THREE.Vector3, speed: number): void {
    const b = this.box, h = b / 2, p = this.pos;
    for (let i = 0; i < p.length; i += 6) {
      for (let k = 0; k < 3; k++) {
        const c = k === 0 ? center.x : k === 1 ? center.y : center.z;
        let v = p[i + k]! - c;
        v = ((((v + h) % b) + b) % b) - h;
        p[i + k] = p[i + k + 3] = v + c;
      }
    }
    (this.lines.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    this.u.uStreak.value.copy(vel).multiplyScalar(T.fx.streakSec);
    this.u.uAlpha.value = Math.min(T.fx.dustAlpha, Math.max(0, (speed - T.fx.dustFrom) / 160) * T.fx.dustAlpha);
  }
}
