import { Quaternion, Vector3 } from "three";
import { Loop } from "@/core/loop";
import { Input } from "@/core/input";
import { Scheme, parseScheme } from "@/core/scheme";
import { loadSave } from "@/core/save";
import { setDifficulty } from "@/core/difficulty";
import { Menu } from "@/ui/menu";
import { Flight } from "@/sim/flight";
import { Hazards } from "@/sim/hazards";
import { QUALITY, Renderer, parseQuality } from "@/render/renderer";
import { ChaseCamera } from "@/render/camera";
import { InspectView, parseView } from "@/render/inspect";
import { PerfOverlay } from "@/render/perf";
import { World } from "@/world/world";
import { SKY_PRESETS, parseSkyPreset } from "@/world/skybox";
import { ShipRig } from "@/ships/rig";
import { parseShip } from "@/ships/registry";
import { Hud } from "@/ui/hud";
import { createDebugPanel } from "@/ui/debug";
import { Game } from "@/game";
const params = new URLSearchParams(location.search), quality = parseQuality(params.get("quality"));
const save = loadSave(), S = save.settings;
setDifficulty(S.difficulty);
const view = parseView(params.get("view")), sky = parseSkyPreset(params.get("sky"));
const canvas = document.body.appendChild(document.createElement("canvas"));
const r = new Renderer(canvas, quality);
r.setGrade(SKY_PRESETS[sky].grade);
const world = new World(r.scene, { sky, planetSegments: QUALITY[quality].planetSegments, shadowMap: r.tier.shadows });
const ship = parseShip(params.get("ship") ?? save.progress.ship), rig = new ShipRig(ship.def);
r.scene.add(rig.root);
world.sun.follow(rig.root);
const scheme = new Scheme(params.has("controls") ? parseScheme(params.get("controls")) : S.scheme, S.assist);
const input = new Input(canvas, scheme, view === null, params.get("lock") === "free"), flight = new Flight(), hazards = new Hazards(world.asteroids);
flight.stats = ship.stats;
const chase = new ChaseCamera(r.camera);
const inspect = view ? new InspectView(r.camera, rig.root, view, params.get("spin") !== "0", Number(params.get("dist") ?? 1) || 1) : null;
if (params.get("silhouette") === "1") (r.setSilhouette(true), rig.setSilhouette(true), (world.root.visible = false));
if (inspect) world.asteroids.group.visible = world.dust.lines.visible = false; // the belt would sit on top of the ship
const hud = new Hud(document.getElementById("hud")!);
const perf = new PerfOverlay(document.querySelector<HTMLElement>("#hud .perf")!);
if (inspect) hud.hideAll();
const game = inspect ? null : new Game(r.scene, world, rig.root, canvas, flight);
const menu = new Menu(document.getElementById("menu")!, canvas, save, {
  apply: (s) => ((scheme.arcade = s.scheme === "arcade"), (scheme.assist = s.assist), (input.sens = s.sens), setDifficulty(s.difficulty), game?.audio.setMute(s.mute)),
  restart: () => location.reload(),
}, game !== null && !input.freeLock);
Object.assign(window, { __game: game, __flight: flight, __rocks: world.asteroids });
// dev hook for the capital-ship authoring pass: `?capital=1` drops one 400 m ahead (module loaded lazily so a missing file only fails when asked for)
const capitalModule = "/src/combat/capital.ts"; // string kept out of the literal so tsc does not resolve it
if (params.get("capital")) void import(/* @vite-ignore */ capitalModule).then((m) => { const c = new m.Capital(); c.setPose(new Vector3(0, 0, 400), new Quaternion()); r.scene.add(c.group); Object.assign(window, { __capital: c }); }); // headless tests (scripts/_*.mjs) drive the game through these
createDebugPanel();

const _p = new Vector3(), _v = new Vector3(), _q = new Quaternion();
const loop = new Loop({
  sim(dt) {
    if (inspect || menu.open) return;
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
      chase.update(dt, _p, _q, flight.speed, input.stick, flight.boosting, flight.sinceHit, flight.stats.size);
      world.dust.update(_p, _v.copy(flight.velDir).multiplyScalar(flight.speed), flight.speed);
      hud.update(flight, input, hazards.outside);
      if (menu.open) hud.hideHint();
      game?.render(alpha, dt, r.camera, hud, flight);
    }
    world.update(r.camera.position);
    r.render();
    perf.update(dt, loop, r.gl.info);
  },
});
loop.start();