import { Color, Quaternion, Vector3 } from "three";
import { Loop } from "@/core/loop";
import { T } from "@/core/tunables";
import { Input, lockPointer, setRawMouse } from "@/core/input";
import { Scheme, parseScheme, parseSteer } from "@/core/scheme";
import { loadSave, writeSave } from "@/core/save";
import { presentation } from "@/core/presentation";
import { EventLighting } from "@/render/event-lighting";
import type { SceneReview } from "@/render/scene-review";
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
import type { EditorHandle } from "@/editor/index";
import { MOVES, moveKeys } from "@/sim/moves";

const boot = new URLSearchParams(location.search);
const save = loadSave(), S = save.settings;
const quality = boot.has("quality") ? parseQuality(boot.get("quality")) : S.quality;
setDifficulty(S.difficulty);
const view = parseView(boot.get("view"));
const canvas = document.body.appendChild(document.createElement("canvas"));
const r = new Renderer(canvas, quality);
const scheme = new Scheme(boot.has("controls") ? parseScheme(boot.get("controls")) : S.scheme, S.assist);
const input = new Input(canvas, scheme, view === null, boot.get("lock") === "free"), flight = new Flight();
input.moveKeys = moveKeys(MOVES);
const chase = new ChaseCamera(r.camera);
const hud = new Hud(document.getElementById("hud")!);
const perf = new PerfOverlay(document.querySelector<HTMLElement>("#hud .perf")!);
const audio = new Audio();
audio.setMute(S.mute);
audio.onMuteChanged = (muted) => { S.mute = muted; menu?.syncMute(muted); writeSave(save); };
const eventLighting = new EventLighting(r.scene);

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
  flight.sample(1, rig.root.position, rig.root.quaternion);
  chase.update(0, rig.root.position, rig.root.quaternion, flight.speed, input.stick, false, 99, flight.stats.size);
  const inspect = view ? new InspectView(r.camera, rig.root, view, params.get("spin") !== "0", Number(params.get("dist") ?? 1) || 1) : null;
  if (params.get("silhouette") === "1") (r.setSilhouette(true), rig.setSilhouette(true), (world.root.visible = false));
  if (inspect) world.asteroids.group.visible = world.dust.lines.visible = false; // the belt would sit on top of the ship
  if (inspect) hud.hideAll();
  hud.reset();
  const game = inspect ? null : new Game(r.scene, world, rig.root, canvas, flight, save, level, audio);
  if (game) {
    game.onWeapon = (pos) => eventLighting.weapon(pos);
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

let hub: Hub | null = null, menu: Menu | null = null, travel: Travel | null = null, editor: EditorHandle | null = null;
let review: SceneReview | null = null;
const edit = boot.get("edit") === "1";
let sortie = build(boot);
travel = sortie.game ? new Travel(document.getElementById("dial")!, r.scene, audio) : null;
if (travel) {
  travel.onDepart = () => {
    sortie.game?.prepareTravel();
    input.setEnabled(false);
    eventLighting.clear();
    menu?.close();
    hub?.hide();
    hud.setTravel(true);
  };
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
  audio.unlock();
  lockPointer(canvas);
  travel?.depart(systemOf(lvl.system), q);
});
if (sortie.game) {
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyG" && !travel?.holding && sortie.game?.mission.done && !sortie.game.replay.playing) hub?.show();
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
  hub: () => { menu?.close(); hub?.show(); },
  replay: () => {
    if (sortie.game?.playReplay()) { menu?.close(); lockPointer(canvas); }
  },
  hasReplay: () => sortie.game?.replay.hasHighlight ?? false,
  canOpen: () => !travel?.holding && !hub?.active,
}, sortie.game !== null && !input.freeLock && !edit, sortie.level.title);
Object.assign(window, { __flight: flight, __input: input, __travel: travel, __hub: hub, __T: T, __renderer: r, __audio: audio });
// headless tests (scripts/_*.mjs) drive the game through these
createDebugPanel();
if (edit && sortie.game) {
  // the game designer (src/editor/): code-split, mounted over the game; the sim holds while it is up
  void import("@/editor/index").then((m) => {
    editor = m.mountEditor({
      currentLevelId: sortie.level.id,
      currentShipId: parseShip(boot.get("ship") ?? save.progress.ship).id,
      flyHere: () => lockPointer(canvas),
      tryMove: (table, id) => {
        // the designer's working copy becomes the live table, unsaved; the move starts as soon as the sim resumes
        flight.moves = table;
        input.moveKeys = moveKeys(table);
        flight.startMove(id);
        lockPointer(canvas);
      },
      flyOther: (levelId, shipId) => {
        const q = new URLSearchParams(location.search);
        q.set("mission", levelId);
        q.set("ship", shipId);
        q.set("fly", "1");
        q.delete("system");
        q.delete("hub");
        location.search = q.toString();
      },
    });
    if (boot.get("fly") === "1") editor.hide(); // parked after a "fly it": click the game to fly, release the pointer to get the designer back
    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement === null && editor && !editor.active) editor.show();
    });
    Object.assign(window, { __editor: editor });
  });
}

const _p = new Vector3(), _v = new Vector3(), _q = new Quaternion();
const _lightPos = new Vector3();
const travelGrade = { shadow: new Color(1, 1, 1), highlight: new Color(1, 1, 1) };
const white = new Color(1, 1, 1);
function currentMode() {
  if (document.hidden) return "paused" as const;
  return presentation({
    travel: travel?.holding ?? false,
    paused: !!(menu?.open || editor?.active || (!input.locked && !input.freeLock && !hub?.active && !sortie.game?.replay.playing)),
    hub: hub?.active ?? false,
    replay: sortie.game?.replay.playing ?? false,
  });
}
const loop = new Loop({
  sim(dt) {
    const { inspect, game, hazards, world } = sortie;
    const mode = currentMode();
    input.setEnabled(mode === "flight" && !review?.paused);
    game?.setPresentation(mode);
    if (inspect || mode !== "flight" || review?.paused) return;
    input.tick(dt);
    flight.tick(dt, input);
    hazards.tick(flight, dt);
    world.tick(dt);
    game?.tick(dt, flight, input);
  },
  render(alpha, dt) {
    const realDt = dt;
    dt = review?.frameDt(dt) ?? dt;
    let mode = currentMode();
    audio.setScene(review?.paused ? "paused" : mode);
    // Travel can replace the entire sortie. Resolve its new objects before rendering anything beneath it.
    if (mode === "travel") travel?.update(dt, r.camera);
    mode = currentMode();
    audio.setScene(review?.paused ? "paused" : mode);
    const { inspect, game, hazards, world, rig } = sortie;
    input.setEnabled(mode === "flight" && !review?.paused);
    game?.setPresentation(mode);
    r.gl.info.reset();
    if (inspect) (inspect.update(dt), rig.update(dt, 0.7, false));
    else {
      if (mode === "flight") {
        flight.sample(alpha, _p, _q);
        rig.root.position.copy(_p);
        rig.root.quaternion.copy(_q);
        rig.root.visible = game?.combat.player.alive ?? true;
        rig.update(dt, flight.throttle, flight.boosting);
        chase.update(dt, _p, _q, flight.speed, input.stick, flight.boosting, flight.sinceHit, flight.stats.size, flight.barrelLeft !== 0 || flight.move !== null);
        world.dust.update(_p, _v.copy(flight.velDir).multiplyScalar(flight.speed), flight.speed);
        hud.update(flight, input, hazards.outside);
      } else if (mode === "travel" || mode === "hub") {
        rig.root.visible = mode === "travel" && travel?.phase === "arrive";
        if (rig.root.visible) rig.update(dt, .35, false);
      }
      if (mode === "paused" && !game?.replay.playing) {
        hud.update(flight, input, hazards.outside);
        hud.updateCombat(game!.combat, game!.mission, r.camera, game!.combat.player.vel, game!.replay.hasHighlight, game!.gate.alive);
        if (menu?.open || editor?.active) hud.hideHint();
      }
      world.dust.lines.visible = mode === "flight";
      game?.render(alpha, dt, r.camera, hud, flight);
      if (mode === "replay" && game) rig.update(dt * game.replay.playbackRate, Math.min(1, game.replay.velocity.length() / T.flight.boostSpeed), false);
      const g = SKY_PRESETS[world.system.sky].grade;
      const reveal = travel?.reveal ?? 1;
      travelGrade.shadow.copy(white).lerp(g.shadow, reveal);
      travelGrade.highlight.copy(white).lerp(g.highlight, reveal);
      r.setGrade(travelGrade);
      if (mode !== "paused") {
        const gate = game?.gate;
        let glow = 0;
        if (mode === "travel" && travel) {
          _lightPos.set(0, 1, -2).applyQuaternion(r.camera.quaternion).add(r.camera.position);
          glow = travel.gateGlow;
        } else if (mode === "flight" && gate?.alive) {
          _lightPos.copy(gate.pos).addScaledVector(gate.normal, 8);
          glow = 1;
        }
        eventLighting.update(S.eventLighting, mode === "replay" ? dt * (game?.replay.playbackRate ?? 1) : dt,
          mode === "replay" ? game?.replay.fx ?? null : mode === "flight" ? game?.combat.fx ?? null : null, _lightPos, glow);
      }
    }
    world.update(r.camera, r.gl, r.tier.bakeSize);
    r.adapt(realDt, loop.fps);
    r.render();
    perf.update(realDt, loop, r.gl.info, r);
    review?.report(mode);
  },
});
Object.assign(window, { __loop: loop });
loop.start();
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    audio.setScene("paused");
    input.setEnabled(false);
    loop.stop();
  } else loop.start();
});

if (boot.get("review") === "1" && travel && sortie.game) {
  void import("@/render/scene-review").then(({ SceneReview }) => {
    review = new SceneReview(() => ({ game: sortie.game!, flight, input, camera: r.camera }), () => {
      travel!.cancel();
      menu?.close();
      hub?.hide();
      eventLighting.clear();
      teardown(sortie);
      sortie = build(new URLSearchParams("mission=proving-ground"));
    }, travel!, save, audio);
  });
}
