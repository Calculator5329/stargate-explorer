import type { Group } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Escape hatch for authored hulls (direction B, deferred). Unused and untested
 * against a real file. A glTF must be exported +Z forward / +Y up, or rotated
 * here; see DECISIONS.md "Ship-local +Z forward".
 */
export async function loadShipGLTF(url: string): Promise<Group> {
  const gltf = await new GLTFLoader().loadAsync(url);
  return gltf.scene;
}
