import { Box3, Vector3, type Object3D, type PerspectiveCamera } from "three";

export type ViewMode = "side" | "top" | "front" | "rear";
const MODES: readonly ViewMode[] = ["side", "top", "front", "rear"];

export function parseView(v: string | null): ViewMode | null {
  return (MODES as readonly string[]).includes(v ?? "") ? (v as ViewMode) : null;
}

const _size = new Vector3();

/**
 * `?view=side|top|front|rear`: static camera framed on the ship at the origin,
 * ship turntables slowly (`&spin=0` to hold it still for repeatable captures;
 * `&dist=0.5` halves the framing distance for close-ups).
 * Flight input is disabled in this mode.
 */
export class InspectView {
  private readonly spin: boolean;

  constructor(cam: PerspectiveCamera, private readonly ship: Object3D, mode: ViewMode, spin = true, dist = 1) {
    this.spin = spin;
    new Box3().setFromObject(ship).getSize(_size);
    const d = Math.max(_size.x, _size.y, _size.z) * 1.7 * dist;
    cam.up.set(0, 1, 0);
    switch (mode) {
      case "side":
        cam.position.set(d, 0, 0); // port side (+X), the side the sun lights
        break;
      case "top":
        cam.position.set(0, d, 0);
        cam.up.set(0, 0, 1); // nose points up the screen
        break;
      case "front":
        cam.position.set(0, 0, d);
        break;
      case "rear":
        cam.position.set(0, 0, -d);
        break;
    }
    cam.lookAt(0, 0, 0);
  }

  update(dt: number): void {
    if (this.spin) this.ship.rotation.y += 0.3 * dt;
  }
}
