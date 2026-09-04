import type { Object3D } from "three";

/**
 * Layer 1 = "no edge detection". The post edge pass renders layer 0 only into
 * its normal+depth target, so anything here (sky, glare, plumes, atmosphere,
 * inverted-hull shells, glow discs) never produces an outline and never
 * occludes something that should.
 */
export const LAYER_NO_EDGE = 1;

export function noEdge<O extends Object3D>(obj: O): O {
  obj.layers.set(LAYER_NO_EDGE);
  return obj;
}
