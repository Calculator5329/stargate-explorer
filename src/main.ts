import { Quaternion, Vector3 } from "three";
import { Loop } from "@/core/loop";
import { Input } from "@/core/input";
import { parseScheme } from "@/core/scheme";
import { Flight } from "@/sim/flight";
import { Hazards } from "@/sim/hazards";
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
import { Game } from "@/game";
const params = new URLSearchParams(location.search), quality = parseQuality(params.get("quality"));
const view = parseView(params.get("view")), sky = parseSkyPreset(params.get("sky"));
const canvas = document.body.appendChild(document.createElement("canvas"));
const r = new Renderer(canvas, quality);
r.setGrade(SKY_PRESETS[sky].grade);
const world = new World(r.scene, { sky, planetSegments: QUALITY[quality].planetSegments, shadowMap: r.tier.shadows });
const rig = new ShipRig(F11_HALBERD);
r.scene.add(rig.root);
world.sun.follow(rig.root);
const input = new Input(canvas, parseScheme(params.get("controls")), view === null, params.get("lock") === "free"), flight = new Flight(), hazards = new Hazards(world.asteroids);
const chase = new ChaseCamera(r.camera);
const inspect = view ? new InspectView(r.camera, rig.root, view, params.get("spin") !== "0", Number(params.get("dist") ?? 1) || 1) : null;
if (params.get("silhouette") === "1") (r.setSilhouette(true), rig.setSilhouette(true), (world.root.visible = false));
if (inspect) world.asteroids.group.visible = world.dust.lines.visible = false; // the belt would sit on top of the ship
const hud = new Hud(document.getElementById("hud")!);
const perf = new PerfOverlay(document.querySelector<HTMLElement>("#hud .perf")!);
if (inspect) hud.hideAll();
const game = inspect ? null : new Game(r.scene, world, rig.root, canvas);
Object.assign(window, { __game: game, __flight: flight }); // headless tests (scripts/_*.mjs) drive the game through these
createDebugPanel();

const _p = new Vector3(), _v = new Vector3(), _q = new Quaternion();
const loop = new Loop({
  sim(dt) {
    if (inspect) return;
    input.tick(dt);
    flight.tick(dt, input);
    hazards.tick(flight, dt);
    world.tick(dt);
    game?.tick(dt, flight, input);
  },
  render(alpha, dt) {
    r.gl.info.reset();
    if (inspect) (inspect.update(dt), rig.update(dt, 0.7, false));
    else {
      flight.sample(alpha, _p, _q);
      rig.root.position.copy(_p);
      rig.root.quaternion.copy(_q);
      rig.update(dt, flight.throttle, flight.boosting);
      chase.update(dt, _p, _q, flight.speed, input.stick, flight.boosting, flight.sinceHit);
      world.dust.update(_p, _v.copy(flight.velDir).multiplyScalar(flight.speed), flight.speed);
      hud.update(flight, input, hazards.outside);
      game?.render(alpha, dt, r.camera, hud, flight);
    }
    world.update(r.camera.position);
    r.render();
    perf.update(dt, loop, r.gl.info);
  },
});
loop.start();