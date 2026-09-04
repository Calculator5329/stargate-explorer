import * as THREE from "three";
import type { Tracked } from "@/combat/targets";
import { glowMaterial, toonMaterial } from "@/render/toon";
import { noEdge } from "@/render/layers";
import { outlineShell } from "@/render/outline";

const PUDDLE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Toon "event horizon": concentric hard-stepped ripples drifting outward, brighter toward the rim.
const PUDDLE_FRAG = /* glsl */ `
uniform float uT;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  float rip = floor(fract(r * 6.0 - uT * 0.9) * 3.0) / 3.0;
  vec3 deep = vec3(0.05, 0.14, 0.42);
  vec3 lit = vec3(0.35, 0.7, 1.4);
  vec3 c = mix(deep, lit, rip * 0.7 + r * 0.3);
  gl_FragColor = vec4(c, 0.92);
}`;

export const GATE_RADIUS = 40;

/**
 * The return gate: a heavy ring with nine lit chevrons and a rippling
 * event-horizon disc. Spawned ahead of the player when a mission ends; flying
 * through the disc takes the ship home. Tracked so the HUD can point at it.
 */
export class Gate implements Tracked {
  readonly group = new THREE.Group();
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  alive = false;
  readonly radius = GATE_RADIUS;
  /** disc normal (the direction the player was flying when it appeared) */
  readonly normal = new THREE.Vector3(0, 0, 1);
  private readonly puddle: THREE.ShaderMaterial;
  private readonly chevrons: THREE.Mesh[] = [];
  private t = 0;
  private lastSide = 0;

  constructor() {
    const ring = new THREE.TorusGeometry(GATE_RADIUS, 3.4, 10, 48);
    const body = new THREE.Mesh(ring, toonMaterial(0x3a3f48));
    this.group.add(body, outlineShell(ring.attributes.position!.array));
    const inner = new THREE.TorusGeometry(GATE_RADIUS - 4.5, 1.2, 8, 48);
    this.group.add(new THREE.Mesh(inner, toonMaterial(0x23262c)));
    const chev = new THREE.BoxGeometry(4.2, 7, 4.4);
    for (let k = 0; k < 9; k++) {
      const a = Math.PI / 2 + (k * Math.PI * 2) / 9;
      const m = noEdge(new THREE.Mesh(chev, glowMaterial(0xff9a3a, 1.6)));
      m.position.set(Math.cos(a) * (GATE_RADIUS + 1.5), Math.sin(a) * (GATE_RADIUS + 1.5), 0);
      m.rotation.z = a - Math.PI / 2;
      this.group.add(m);
      this.chevrons.push(m);
    }
    this.puddle = new THREE.ShaderMaterial({ vertexShader: PUDDLE_VERT, fragmentShader: PUDDLE_FRAG, uniforms: { uT: { value: 0 } }, transparent: true, side: THREE.DoubleSide });
    this.group.add(noEdge(new THREE.Mesh(new THREE.CircleGeometry(GATE_RADIUS - 4, 48), this.puddle)));
    this.group.visible = false;
  }

  /** Place the gate at `pos` facing `normal` and switch it on. */
  open(pos: THREE.Vector3, normal: THREE.Vector3): void {
    this.pos.copy(pos);
    this.normal.copy(normal).normalize();
    this.group.position.copy(pos);
    this.group.quaternion.setFromUnitVectors(_z, this.normal);
    this.group.visible = true;
    this.alive = true;
    this.lastSide = 0;
  }

  /** True on the tick the player crosses the disc (either direction) inside the rim. */
  crossed(shipPos: THREE.Vector3): boolean {
    if (!this.alive) return false;
    _d.subVectors(shipPos, this.pos);
    const side = _d.dot(this.normal);
    const hit = this.lastSide !== 0 && Math.sign(side) !== Math.sign(this.lastSide) && _d.addScaledVector(this.normal, -side).lengthSq() < (GATE_RADIUS - 4) ** 2;
    this.lastSide = side;
    return hit;
  }

  render(dt: number): void {
    if (!this.alive) return;
    this.t += dt;
    this.puddle.uniforms.uT!.value = this.t;
    for (let k = 0; k < this.chevrons.length; k++) {
      const m = this.chevrons[k]!.material as THREE.MeshBasicMaterial;
      // chevrons breathe in sequence so the ring reads as alive from far off
      m.color.setScalar(1.6 + 0.9 * Math.max(0, Math.sin(this.t * 2.5 - k * 0.7))).multiply(_orange);
    }
  }
}

const _z = new THREE.Vector3(0, 0, 1);
const _d = new THREE.Vector3();
const _orange = new THREE.Color(0xff9a3a);
