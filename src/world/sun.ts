import * as THREE from "three";
import { T } from "@/core/tunables";
import { noEdge } from "@/render/layers";

const GLARE_DISTANCE = 9000;
const SHADOW_HALF = 16;
const SHADOW_STANDOFF = 80;

/** Flat stepped disc: hard core, two pale rings, no gradient (row A reads as paper cut-outs). */
function glareTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  if (!g) throw new Error("2d canvas unavailable");
  const disc = (r: number, fill: string) => {
    g.beginPath();
    g.arc(128, 128, r, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
  };
  disc(120, "rgba(255,190,130,0.10)");
  disc(78, "rgba(255,214,160,0.22)");
  disc(44, "rgba(255,238,210,0.75)");
  disc(26, "rgba(255,255,255,1)");
  return new THREE.CanvasTexture(c);
}

/** Key light (+shadow) and cool fill, plus a glare disc pinned at "infinity" along the sun direction. */
export class Sun {
  readonly dir: THREE.Vector3;
  readonly light: THREE.DirectionalLight;
  readonly fill: THREE.HemisphereLight;
  readonly glare: THREE.Sprite;
  private focus: THREE.Object3D | null = null;
  private readonly _p = new THREE.Vector3();

  constructor(scene: THREE.Scene, dir: THREE.Vector3, shadowMap: number) {
    this.dir = dir.clone().normalize();
    this.light = new THREE.DirectionalLight(0xfff1dc, T.toon.keyIntensity);
    this.light.position.copy(this.dir).multiplyScalar(SHADOW_STANDOFF);
    this.fill = new THREE.HemisphereLight(0x6f8fc4, 0x2a1e18, T.toon.fillIntensity);
    scene.add(this.light, this.light.target, this.fill);

    if (shadowMap > 0) {
      this.light.castShadow = true;
      this.light.shadow.mapSize.set(shadowMap, shadowMap);
      const cam = this.light.shadow.camera;
      cam.left = cam.bottom = -SHADOW_HALF;
      cam.right = cam.top = SHADOW_HALF;
      cam.near = 1;
      cam.far = SHADOW_STANDOFF * 2;
      this.light.shadow.bias = -0.0015;
      this.light.shadow.normalBias = 0.03;
    }

    const mat = new THREE.SpriteMaterial({
      map: glareTexture(),
      color: new THREE.Color(0xffe9c0).multiplyScalar(1.6),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      transparent: true,
    });
    mat.toneMapped = false;
    this.glare = noEdge(new THREE.Sprite(mat));
    this.glare.scale.setScalar(1500);
    this.glare.renderOrder = -0.5;
  }

  /** The shadow frustum follows this object (the player ship). */
  follow(obj: THREE.Object3D): void {
    this.focus = obj;
  }

  update(camPos: THREE.Vector3): void {
    this.glare.position.copy(this.dir).multiplyScalar(GLARE_DISTANCE).add(camPos);
    this.light.intensity = T.toon.keyIntensity;
    this.fill.intensity = T.toon.fillIntensity;
    if (this.focus) {
      this.focus.getWorldPosition(this._p);
      this.light.target.position.copy(this._p);
      this.light.position.copy(this.dir).multiplyScalar(SHADOW_STANDOFF).add(this._p);
    }
  }
}
