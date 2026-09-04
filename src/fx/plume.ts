import * as THREE from "three";
import { T } from "@/core/tunables";
import type { EngineDef } from "@/ships/defs";
import { noEdge } from "@/render/layers";

// Unit cone along −Z: radius 1 at the nozzle, tapering toward the tip. The
// vertex shader applies length/width; `t` (0 nozzle → 1 tip) comes from z.
const VERT = /* glsl */ `
uniform float uLength, uWidth, uRadius;
varying float vT, vAng;
void main() {
  vec3 p = position;
  vT = -p.z;
  vAng = atan(p.y, p.x);
  p.xy *= uWidth * uRadius;
  p.z *= uLength;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

// Hard-banded plume: three brightness bands along the length, angled chevron
// notches, a flickering end. The core cone (uCoreCone = 1) is plain and hot.
const FRAG = /* glsl */ `
uniform vec3 uColor, uCore;
uniform float uBoost, uTime, uFlicker, uCoreCone;
varying float vT, vAng;
void main() {
  float t = vT;
  float end = 1.0 - uFlicker * (0.5 + 0.5 * sin(uTime * 37.0 + vAng * 2.0));
  float body = step(t, end);
  float chev = mix(step(0.16, fract(t * 3.0 + 0.3 * abs(sin(vAng * 1.5)))), 1.0, uCoreCone);
  float band = 1.0 - 0.3 * step(0.45, t) - 0.3 * step(0.8, t);
  vec3 col = mix(uColor * band, uCore, max(uCoreCone, step(t, 0.12 + 0.2 * uBoost)));
  float a = body * chev * (0.55 + 0.25 * uCoreCone);
  gl_FragColor = vec4(col * a, a);
}`;

function cone(tipRadius: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(tipRadius, 1, 1, 18, 3, true);
  g.rotateX(-Math.PI / 2); // +Y (tip) → −Z
  g.translate(0, 0, -0.5); // base at z = 0
  return g;
}

/** Engine plumes for one ship: a banded outer cone plus a hot inner core; length follows throttle, boost widens the core. */
export class Plume {
  readonly group = new THREE.Group();
  private readonly outer;
  private readonly inner;
  private length = 0;
  private time = 0;

  constructor(engines: EngineDef[], glow: number) {
    const shared = {
      uLength: { value: 1 },
      uWidth: { value: 1 },
      uColor: { value: new THREE.Color(glow).multiplyScalar(1.7) },
      uCore: { value: new THREE.Color(0xf4f8ff).multiplyScalar(2.2) },
      uBoost: { value: 0 },
      uTime: { value: 0 },
      uFlicker: { value: T.plume.flicker },
    };
    const mat = (coreCone: number, radius: number) =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { ...shared, uCoreCone: { value: coreCone }, uRadius: { value: radius } },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
    this.outer = shared;
    this.inner = { uLength: { value: 1 }, uBoost: shared.uBoost };
    const outerGeo = cone(0.22);
    const innerGeo = cone(0.1);
    for (const e of engines) {
      const o = noEdge(new THREE.Mesh(outerGeo, mat(0, 1)));
      const i = noEdge(new THREE.Mesh(innerGeo, mat(1, 0.45)));
      // the inner cone has its own length uniform (shorter) but shares everything else
      (i.material as THREE.ShaderMaterial).uniforms.uLength = this.inner.uLength;
      for (const m of [o, i]) {
        m.position.set(e.pos[0], e.pos[1], e.pos[2] - e.length / 2 - 0.3);
        m.scale.setScalar(e.radius);
        m.scale.z = 1; // length stays in metres
        m.frustumCulled = false;
        m.renderOrder = 5;
        this.group.add(m);
      }
    }
  }

  update(dt: number, throttle: number, boost: boolean): void {
    this.time += dt;
    const p = T.plume;
    const target = boost ? p.boostLength : p.length * (0.35 + 0.65 * throttle);
    this.length += (target - this.length) * Math.min(1, dt * 6);
    this.outer.uLength.value = this.length;
    this.inner.uLength.value = this.length * 0.72;
    this.outer.uWidth.value = p.width;
    this.outer.uFlicker.value = p.flicker;
    this.outer.uTime.value = this.time;
    const b = this.outer.uBoost.value;
    this.outer.uBoost.value = b + ((boost ? 1 : 0) - b) * Math.min(1, dt * 8);
  }
}
