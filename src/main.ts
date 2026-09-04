import { Quaternion, Vector3 } from "three";
import { Loop } from "@/core/loop";
import { Input } from "@/core/input";
import { Flight } from "@/sim/flight";
import { QUALITY, Renderer, parseQuality } from "@/render/renderer";
import { ChaseCamera } from "@/render/camera";
import { InspectView, parseView } from "@/render/inspect";
import { PerfOverlay } from "@/render/perf";
import { World } from "@/world/world";
import { parseSkyPreset } from "@/world/skybox";
import { buildShip } from "@/ships/builder";
import { F11_HALBERD } from "@/ships/defs";
import { Hud } from "@/ui/hud";
import { createDebugPanel } from "@/ui/debug";

const params = new URLSearchParams(location.search);
const quality = parseQuality(params.get("quality"));
const view = parseView(params.get("view"));

const canvas = document.body.appendChild(document.createElement("canvas"));
const r = new Renderer(canvas, quality);
const world = new World(r.scene, { sky: parseSkyPreset(params.get("sky")), planetSegments: QUALITY[quality].planetSegments });
const ship = buildShip(F11_HALBERD);
r.scene.add(ship);

const input = new Input(canvas, view === null);
const flight = new Flight();
const chase = new ChaseCamera(r.camera);
const inspect = view ? new InspectView(r.camera, ship, view, params.get("spin") !== "0") : null;
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
    if (inspect) {
      inspect.update(dt);
    } else {
      flight.sample(alpha, _p, _q);
      ship.position.copy(_p);
      ship.quaternion.copy(_q);
      chase.update(dt, _p, _q, flight.speed, input.stick);
      hud.update(flight.speed, flight.throttle, input.locked);
    }
    world.update(r.camera.position);
    r.render();
    perf.update(dt, loop, r.gl.info);
  },
});
loop.start();
