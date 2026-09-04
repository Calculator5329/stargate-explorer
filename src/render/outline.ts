import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { T } from "@/core/tunables";
import { noEdge } from "@/render/layers";

const VERT = /* glsl */ `
uniform float uPixelScale;
uniform float uWidth;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  mv.xyz += n * (uWidth * uPixelScale * -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
void main() { gl_FragColor = vec4(uColor, 1.0); }`;

const uniforms = {
  uPixelScale: { value: 0.001 },
  uWidth: { value: T.outline.hullWidth },
  uColor: { value: new THREE.Color(0x0a0a0c) },
};

/** One shared back-face shell material; width is constant in screen pixels. */
export const outlineMaterial = new THREE.ShaderMaterial({
  vertexShader: VERT,
  fragmentShader: FRAG,
  uniforms,
  side: THREE.BackSide,
});

/** Call once per frame before rendering so the shell width tracks fov / resolution. */
export function updateOutlineUniforms(camera: THREE.PerspectiveCamera, viewportHeightPx: number): void {
  uniforms.uPixelScale.value = (2 * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, viewportHeightPx);
  uniforms.uWidth.value = T.outline.hullWidth;
}

/**
 * Inverted-hull shell for a flat-shaded triangle soup. Positions are welded
 * so the shell gets smooth normals (inflating along per-face normals would
 * split at every crease). Returns a mesh to add as a sibling of the part.
 */
export function outlineShell(positions: ArrayLike<number>): THREE.Mesh {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(Array.from(positions), 3));
  const welded = mergeVertices(g, 1e-3);
  g.dispose();
  welded.computeVertexNormals();
  const mesh = new THREE.Mesh(welded, outlineMaterial);
  mesh.name = "outline";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return noEdge(mesh);
}
