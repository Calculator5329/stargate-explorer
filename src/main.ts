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
import { disposeTree } from "@/render/dispose";
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
import { Audio } from "@/audio/audio";
import { parseLevel, type LevelDef } from "@/mission/levels";
import { Travel, systemOf } from "@/travel/travel";

const boot = new URLSearchParams(location.search);
const save = loadSave(), S = save.settings;
const quality = boot.has("quality") ? parseQuality(boot.get("quality")) : S.quality;
setDifficulty(S.difficulty);
const view = parseView(boot.get("view"));
const canvas = document.body.appendChild(document.createElement("canvas"));
const r = new Renderer(canvas, quality);
const scheme = new Scheme(boot.has("controls") ? parseScheme(boot.get("controls")) : S.scheme, S.assist);
const input = new Input(canvas, scheme, view === null, boot.get("lock") === "free"), flight = new Flight();
const chase = new ChaseCamera(r.camera);
const hud = new Hud(document.getElementById("hud")!);
const perf = new PerfOverlay(document.querySelector<HTMLElement>("#hud .perf")!);
const audio = new Audio();

/** Everything that belongs to one system + sortie. Gate travel disposes it and builds the next behind the wormhole. */
interface Sortie {
  level: LevelDef;
  world: World;
  rig: ShipRig;
  hazards: Hazards;
  game: Game | null;
  inspect: InspectView | null;
}

function build(params: URLSearchParams): Sortie {
  const level = parseLevel(params.get("mission"));
  const system = { ...parseSystem(params.get("system") ?? level.system) };
  if (params.has("sky")) system.sky = parseSkyPreset(params.get("sky"));
  if (level.beltScale !== undefined) system.belt = { ...system.belt, count: Math.max(1, Math.round(system.belt.count * level.beltScale)) }; // the duel wants open space
  r.setGrade(SKY_PRESETS[system.sky].grade);
  const world = new World(r.scene, { system, ...(params.has("planet") ? { planet: parsePlanetPreset(params.get("planet")) } : {}), planetSegments: QUALITY[quality].planetSegments, shadowMap: r.tier.shadows });
  const ship = parseShip(params.get("ship") ?? save.progress.ship), rig = new ShipRig(HULLS[params.get("hull") ?? ""] ?? pickVariant(ship.def, params));
  r.scene.add(rig.root);
  world.sun.follow(rig.root);
  flight.reset();
  flight.stats = ship.stats;
  chase.reset();
  const inspect = view ? new InspectView(r.camera, rig.root, view, params.get("spin") !== "0", Number(params.get("dist") ?? 1) || 1) : null;
  if (params.get("silhouette") === "1") (r.setSilhouette(true), rig.setSilhouette(true), (world.root.visible = false));
  if (inspect) world.asteroids.group.visible = world.dust.lines.visible = false; // the belt would sit on top of the ship
  if (inspect) hud.hideAll();
  hud.reset();
  const game = inspect ? null : new Game(r.scene, world, rig.root, canvas, flight, save, level, audio);
  if (game) {
    // the way home: through the gate that opens when a mission is won, or G on the end card
    game.onGate = () => {
      const q = new URLSearchParams(location.search);
      q.set("hub", "1");
      travel?.depart(systemOf(level.system), q);
    };
  }
  hub?.setCurrent(level);
  menu?.setMission(level.title);
  Object.assign(window, { __game: game, __rocks: world.asteroids, __world: world });
  return { level, world, rig, hazards: new Hazards(world.asteroids), game, inspect };
}

function teardown(s: Sortie): void {
  s.game?.dispose();
  r.scene.remove(s.rig.root);
  disposeTree(s.rig.root);
  s.world.dispose(r.scene);
}

let hub: Hub | null = null, menu: Menu | null = null, travel: Travel | null = null;
let sortie = build(boot);
travel = sortie.game ? new Travel(document.getElementById("dial")!, r.scene, audio) : null;
if (travel) {
  // the system swap happens behind the wormhole, in this page: audio, pointer lock and settings all carry over
  travel.onSwap = (q) => {
    teardown(sortie);
    sortie = build(q);
    // a `?hub=1` destination opens the console once the tunnel has thinned out
    travel!.onArrived = q.get("hub") === "1" ? () => hub?.show() : null;
  };
}
hub = new Hub(document.getElementById("hub")!, save, sortie.level, () => undefined, (lvl, shipId) => {
  const q = new URLSearchParams(location.search);
  q.set("mission", lvl.id);
  q.set("ship", shipId);
  q.delete("system");
  q.delete("hub");
  q.delete("arrive");
  menu?.close();
  travel?.depart(systemOf(lvl.system), q);
});
if (sortie.game) {
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyG" && sortie.game?.mission.done && !sortie.game.replay.playing) hub?.show();
  });
  if (boot.get("arrive") === "1") travel?.arrive();
  if (boot.get("hub") === "1") hub.show();
}
menu = new Menu(document.getElementById("menu")!, canvas, save, {
  apply: (s) => {
    scheme.arcade = s.scheme === "arcade";
    scheme.assist = s.assist;
    scheme.assistStrength = s.assistStrength;
    scheme.speedTurn = s.speedTurn;
    input.sens = s.sens;
    input.invertY = s.invertY;
    input.binds = s.binds;
    input.steer = boot.has("steer") ? parseSteer(boot.get("steer")) : s.steer;
    setRawMouse(s.rawMouse);
    setDifficulty(s.difficulty);
    r.dynamic = s.dynamicRes;
    audio.setMute(s.mute);
  },
  restart: () => location.reload(),
  hub: () => hub?.show(),
  replay: () => {
    if (sortie.game?.playReplay()) lockPointer(canvas);
  },
  hasReplay: () => sortie.game?.replay.hasHighlight ?? false,
}, sortie.game !== null && !input.freeLock, sortie.level.title);
Object.assign(window, { __flight: flight, __input: input, __travel: travel, __hub: hub, __T: T, __renderer: r, __audio: audio });
// headless tests (scripts/_*.mjs) drive the game through these
createDebugPanel();

const _p = new Vector3(), _v = new Vector3(), _q = new Quaternion();
const loop = new Loop({
  sim(dt) {
    const { inspect, game, hazards, world } = sortie;
    if (inspect || menu?.open || game?.replay.playing) return;
    input.tick(dt);
    if (travel?.holding) return; // dialing, in the wormhole or fading in: nothing moves yet
    flight.tick(dt, input);
    hazards.tick(flight, dt);
    world.tick(dt);
    game?.tick(dt, flight, input);
  },
  render(alpha, dt) {
    const { inspect, game, hazards, world, rig } = sortie;
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
      if (menu?.open) hud.hideHint();
      hud.setTravel(travel?.holding ?? false);
      game?.render(alpha, dt, r.camera, hud, flight);
      travel?.update(dt, r.camera);
    }
    world.update(r.camera, r.gl, r.tier.bakeSize);
    r.adapt(dt, loop.fps);
    r.render();
    perf.update(dt, loop, r.gl.info, r);
  },
});
Object.assign(window, { __loop: loop });
loop.start();
