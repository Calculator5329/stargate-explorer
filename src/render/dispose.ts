import * as THREE from "three";

/**
 * Free the GPU side of a subtree: geometries, materials and the textures they
 * hold. Used when a system is swapped in place during gate travel (the old
 * world, rigs and combat pools go away without a page reload). Shared
 * geometries are disposed once; three re-uploads on the next use if a survivor
 * still references one, so only pass subtrees that are really going away.
 */
export function disposeTree(root: THREE.Object3D): void {
  const seen = new Set<object>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry && !seen.has(m.geometry)) {
      seen.add(m.geometry);
      m.geometry.dispose();
    }
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      if (seen.has(mat)) continue;
      seen.add(mat);
      for (const v of Object.values(mat as unknown as Record<string, unknown>)) {
        if (v instanceof THREE.Texture && !seen.has(v)) (seen.add(v), v.dispose());
      }
      const u = (mat as THREE.ShaderMaterial).uniforms;
      if (u) for (const k of Object.keys(u)) {
        const v = u[k]?.value;
        if (v instanceof THREE.Texture && !seen.has(v)) (seen.add(v), v.dispose());
      }
      mat.dispose();
    }
  });
}
