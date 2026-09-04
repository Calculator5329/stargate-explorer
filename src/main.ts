import { Quaternion, Vector3 } from "three";
import { Loop } from "@/core/loop";
import { Input } from "@/core/input";
import { Flight } from "@/sim/flight";
import { QUALITY, Renderer, parseQuality } from "@/render/renderer";
import { ChaseCamera } from "@/render/camera";
import { InspectView, parseView } from "@/render/inspect";
import { PerfOverlay } from "@/render/perf";
import { World } from "@/world/world";
import { SKY_PRESETS, parseSkyPreset } from "@/world/skybox";
import { ShipRig } from "@/ships/rig";
import { F11_HALBERD } from "@/ships/defs";
import { Hud } from "@/ui/hud";
import { createDebugPanel } from "@/ui/debug";
const params = new URLSearchParams(location.search), quality = parseQuality(params.get("quality"));
const view = parseView(params.get("view")), sky = parseSkyPreset(params.get("sky"));
const canvas = document.body.appendChild(document.createElement("canvas"));
const r = new Renderer(canvas, quality);
r.setGrade(SKY_PRESETS[sky].grade);
const world = new World(r.scene, { sky, planetSegments: QUALITY[quality].planetSegments, shadowMap: r.tier.shadows });
const rig = new ShipRig(F11_HALBERD);
r.scene.add(rig.root);
world.sun.follow(rig.root);
const input = new Input(canvas, view === null), flight = new Flight();
const chase = new ChaseCamera(r.camera);
const inspect = view ? new InspectView(r.camera, rig.root, view, params.get("spin") !== "0", Number(params.get("dist") ?? 1) || 1) : null;
const silhouette = params.get("silhouette") === "1";
if (silhouette) (r.setSilhouette(true), rig.setSilhouette(true), (world.root.visible = false));
const hud = new Hud(document.getElementById("hud")!);
const perf = new PerfOverlay(document.querySelector<HTMLElement>("#hud .perf")!);
if (inspect) hud.hideHint();
createDebugPanel();

const _p = new Vector3(), _q = new Quaternion();
const loop = new Loop({
  sim(dt) {
    if (inspect) return;
    input.tick(dt);
    flight.tick(dt, input);
    world.tick(dt);
  },
  render(alpha, dt) {
    r.gl.info.reset();
    if (inspect) (inspect.update(dt), rig.update(dt, 0.7, false));
    else {
      flight.sample(alpha, _p, _q);
      rig.root.position.copy(_p);
      rig.root.quaternion.copy(_q);
      rig.update(dt, flight.throttle, input.boost);
      chase.update(dt, _p, _q, flight.speed, input.stick);
      hud.update(flight.speed, flight.throttle, input.locked);
    }
    world.update(r.camera.position);
    r.render();
    perf.update(dt, loop, r.gl.info);
  },
});
loop.start();