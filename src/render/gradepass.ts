import * as THREE from "three";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { T } from "@/core/tunables";

/** Per-sky colour grade: shadows and highlights each get a tint, applied in linear HDR before tone mapping. */
export interface Grade {
  shadow: THREE.Color;
  highlight: THREE.Color;
}

export const grade = (shadow: number, highlight: number): Grade => ({
  shadow: new THREE.Color(shadow),
  highlight: new THREE.Color(highlight),
});

const FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uVignette, uSaturation;
uniform vec3 uShadow, uHighlight;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  c.rgb = mix(vec3(l), c.rgb, uSaturation);
  c.rgb *= mix(uShadow, uHighlight, smoothstep(0.0, 0.8, l));
  vec2 q = vUv - 0.5;
  c.rgb *= 1.0 - uVignette * smoothstep(0.2, 0.95, dot(q, q) * 2.4);
  gl_FragColor = c;
}`;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export class GradePass extends ShaderPass {
  constructor() {
    super({
      uniforms: {
        tDiffuse: { value: null },
        uVignette: { value: T.render.vignette },
        uSaturation: { value: T.render.saturation },
        uShadow: { value: new THREE.Color(1, 1, 1) },
        uHighlight: { value: new THREE.Color(1, 1, 1) },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
  }

  setGrade(g: Grade): void {
    (this.uniforms["uShadow"]!.value as THREE.Color).copy(g.shadow);
    (this.uniforms["uHighlight"]!.value as THREE.Color).copy(g.highlight);
  }

  sync(): void {
    this.uniforms["uVignette"]!.value = T.render.vignette;
    this.uniforms["uSaturation"]!.value = T.render.saturation;
  }
}
