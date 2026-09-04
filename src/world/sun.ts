import * as THREE from "three";

const GLARE_DISTANCE = 9000;

function glareTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  if (!g) throw new Error("2d canvas unavailable");
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.08, "rgba(255,244,220,0.9)");
  grad.addColorStop(0.3, "rgba(255,200,140,0.25)");
  grad.addColorStop(1, "rgba(255,180,120,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/** Key light + fills + a glare sprite that stays pinned at "infinity" along the sun direction. */
export class Sun {
  readonly dir: THREE.Vector3;
  readonly light: THREE.DirectionalLight;
  private readonly glare: THREE.Sprite;

  constructor(scene: THREE.Scene, dir: THREE.Vector3) {
    this.dir = dir.clone().normalize();
    this.light = new THREE.DirectionalLight(0xfff1dc, 2.4);
    this.light.position.copy(this.dir).multiplyScalar(100);
    scene.add(this.light, new THREE.HemisphereLight(0x6a86b8, 0x241a12, 0.55), new THREE.AmbientLight(0x202838, 0.35));

    const mat = new THREE.SpriteMaterial({
      map: glareTexture(),
      color: 0xffe9c0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      transparent: true,
    });
    mat.toneMapped = false;
    this.glare = new THREE.Sprite(mat);
    this.glare.scale.setScalar(1800);
    this.glare.renderOrder = -0.5;
    scene.add(this.glare);
  }

  update(camPos: THREE.Vector3): void {
    this.glare.position.copy(this.dir).multiplyScalar(GLARE_DISTANCE).add(camPos);
  }
}
