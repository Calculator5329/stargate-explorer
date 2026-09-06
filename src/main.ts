import { Quaternion, Vector3 } from "three";
import { Loop } from "@/core/loop";
import { T } from "@/core/tunables";
import { Input, lockPointer, setRawMouse } from "@/core/input";
import { Scheme, parseScheme, parseSteer } from "@/core/scheme";
import { loadSave } from "@/core/save";
import { setDifficulty } from "@/core/difficulty";
import { Menu } from "@/ui/menu";
import { Hub } from "@/ui/hub";
import { Flight } from "@/sim/flight";
import { Hazards } from "@/sim/hazards";
import { QUALITY, Renderer, parseQuality } from "@/render/renderer";
import { ChaseCamera } from "@/render/camera";
import { InspectView, parseView } from "@/render/inspect";
import { PerfOverlay } from "@/render/perf";
import { World } from "@/world/world";
import { SKY_PRESETS, parseSkyPreset } from "@/world/skybox";
import { parseSystem } from "@/world/systems";
import { ShipRig } from "@/ships/rig";
import { parseShip } from "@/ships/registry";
import { pickVariant } from "@/ships/variants";
import { HULLS } from "@/ships/hulls";
import { parsePlanetPreset } from "@/world/planet";
import { Hud } from "@/ui/hud";
import { createDebugPanel } from "@/ui/debug";
import { Game } from "@/game";
import { parseLevel } from "@/mission/levels";
import { Travel, systemOf } from "@/travel/travel";
const params = new URLSearchParams(location.search);
const save = loadSave(), S = save.settings;
const quality = params.has("quality") ? parseQuality(params.get("quality")) : S.quality;
setDifficulty(S.difficulty);
const view = parseView(params.get("view"));
const level = parseLevel(params.get("mission"));
const system = { ...parseSystem(params.get("system") ?? level.system) };
if (params.has("sky")) system.sky = parseSkyPreset(params.get("sky"));
if (level.beltScale !== undefined) system.belt = { ...system.belt, count: Math.max(1, Math.round(system.belt.count * level.beltScale)) }; // the duel wants open space
const sky = system.sky;
const canvas = document.body.appendChild(document.createElement("canvas"));
const r = new Renderer(canvas, quality);
r.setGrade(SKY_PRESETS[sky].grade);
const world = new World(r.scene, { system, ...(params.has("planet") ? { planet: parsePlanetPreset(params.get("planet")) } : {}), planetSegments: QUALITY[quality].planetSegments, shadowMap: r.tier.shadows });
const ship = parseShip(params.get("ship") ?? save.progress.ship), rig = new ShipRig(HULLS[params.get("hull") ?? ""] ?? pickVariant(ship.def, params));
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
const game = inspect ? null : new Game(r.scene, world, rig.root, canvas, flight, save, level);
const travel = game ? new Travel(document.getElementById("dial")!, r.scene, game.audio) : null;
const hub = new Hub(document.getElementById("hub")!, save, level, () => undefined, (lvl, shipId) => {
  const q = new URLSearchParams(location.search);
  q.set("mission", lvl.id);
  q.set("ship", shipId);
  q.delete("system");
  q.delete("hub");
  menu.close();
  travel?.depart(systemOf(lvl.system), q);
});
if (game) {
  // the way home: through the gate that opens when a mission is won, or G on the end card
  game.onGate = () => {
    const q = new URLSearchParams(location.search);
    q.set("hub", "1");
    travel?.depart(systemOf(level.system), q);
  };
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyG" && game.mission.done && !game.replay.playing) hub.show();
  });
  if (params.get("arrive") === "1") travel?.arrive();
  if (params.get("hub") === "1") hub.show();
}
const menu = new Menu(document.getElementById("menu")!, canvas, save, {
  apply: (s) => {
    scheme.arcade = s.scheme === "arcade";
    scheme.assist = s.assist;
    scheme.assistStrength = s.assistStrength;
    scheme.speedTurn = s.speedTurn;
    input.sens = s.sens;
    input.invertY = s.invertY;
    input.binds = s.binds;
    input.steer = params.has("steer") ? parseSteer(params.get("steer")) : s.steer;
    setRawMouse(s.rawMouse);
    setDifficulty(s.difficulty);
    r.dynamic = s.dynamicRes;
    game?.audio.setMute(s.mute);
  },
  restart: () => location.reload(),
  hub: () => hub.show(),
  replay: () => {
    if (game?.playReplay()) lockPointer(canvas);
  },
  hasReplay: () => game?.replay.hasHighlight ?? false,
}, game !== null && !input.freeLock, level.title);
Object.assign(window, { __game: game, __flight: flight, __input: input, __rocks: world.asteroids, __travel: travel, __hub: hub, __T: T, __renderer: r });
// headless tests (scripts/_*.mjs) drive the game through these
createDebugPanel();

const _p = new Vector3(), _v = new Vector3(), _q = new Quaternion();
const loop = new Loop({
  sim(dt) {
    if (inspect || menu.open || game?.replay.playing) return;
    input.tick(dt);
    if (travel?.holding) return; // dialing, in the wormhole or fading in: nothing moves yet
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
      chase.update(dt, _p, _q, flight.speed, input.stick, flight.boosting, flight.sinceHit, flight.stats.size, flight.barrelLeft !== 0);
      world.dust.update(_p, _v.copy(flight.velDir).multiplyScalar(flight.speed), flight.speed);
      hud.update(flight, input, hazards.outside);
      if (menu.open) hud.hideHint();
      game?.render(alpha, dt, r.camera, hud, flight);
      travel?.update(dt, r.camera);
    }
    world.update(r.camera, r.gl, r.tier.bakeSize);
    r.adapt(dt, loop.fps);
    r.render();
    perf.update(dt, loop, r.gl.info, r);
  },
});
Object.assign(window, { __loop: loop, __world: world });
loop.start();