// CPU simulation only: actual Game/Combat paths with DOM, storage and world stubs.
// Positions and shortened mission schedules below are test setup, not playability evidence.
import { build } from 'esbuild';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const cache = join(homedir(), '.cache', 'tmp', 'stargate-explorer');
await mkdir(cache, { recursive: true });
const output = join(await mkdtemp(join(cache, 'episode-compat-')), 'check.mjs');
await build({ stdin: { resolveDir: root, contents: `
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Game } from '@/game';
import { Flight } from '@/sim/flight';
import { LEVELS } from '@/mission/levels';
import { loadSave } from '@/core/save';
import { solidHit } from '@/world/solid';
const noop=()=>{};
const context=new Proxy({},{get:()=>noop});
const canvas=()=>Object.assign(new EventTarget(),{style:{},getContext:()=>context});
globalThis.document={createElement:canvas,querySelector:canvas};
globalThis.window=Object.assign(new EventTarget(),{devicePixelRatio:1});
globalThis.location={search:'',reload:noop};
const storage=new Map();let writes=0;
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>{writes++;storage.set(key,value);}};
const audio=new Proxy({},{get:()=>noop});
const input={stick:{x:0,y:0},fire:false,alt:false,locked:true};
const dt=1/60;
function fixture(id,overrides={}){
 storage.clear();writes=0;
 const def=Object.assign(structuredClone(LEVELS.find(level=>level.id===id)),overrides);
 const flight=new Flight();flight.pos.set(...(def.start?.pos??[0,0,0]));flight.prevPos.copy(flight.pos);
 flight.quat.setFromAxisAngle(new THREE.Vector3(0,1,0),def.start?.yaw??0);flight.prevQuat.copy(flight.quat);
 const rocks={count:0,centers:new Float32Array(),radii:new Float32Array(),broken:0};
 const save=loadSave();
 const game=new Game(new THREE.Scene(),{asteroids:rocks,system:{}},new THREE.Group(),canvas(),flight,save,def,audio);
 let opens=0;const open=game.gate.open.bind(game.gate);game.gate.open=(...args)=>{opens++;open(...args);};
 const tick=(n=1)=>{for(let i=0;i<n;i++){flight.prevPos.copy(flight.pos);game.tick(dt,flight,input);}};
 return {game,flight,save,def,tick,opens:()=>opens};
}
function completion(f){
 const {game,save,def,tick}=f;
 assert.equal(game.mission.phase,'complete',def.id+' completed through Game.tick');
 assert(game.mission.recorded);assert.equal(save.progress.missions[def.id].completions,1);
 assert(save.progress.missions[def.id].bestTime>0);assert.equal(writes,1,'one persisted completion');
 assert.equal(loadSave().progress.missions[def.id].completions,1,'completion survives storage read');
 assert(game.gate.alive);assert.equal(game.mission.marker,game.gate);assert.equal(f.opens(),1);
 assert(!game.combat.solids.sweep(game.gate.pos,game.gate.pos,60,solidHit()),'return gate aperture clear of mission solids');
 const gatePos=game.gate.pos.clone();tick(120);
 assert.equal(writes,1,'later ticks do not save again');assert.equal(f.opens(),1,'later ticks do not reopen gate');
 assert.equal(save.progress.missions[def.id].completions,1);assert(game.gate.pos.equals(gatePos));
 return {id:def.id,clock:game.mission.clock,gate:gatePos.toArray(),writes};
}
// Shortened schedules and no hostile spawns isolate completion/persistence from combat balance.
const polar=fixture('antarctic-defense',{escortSpeed:10000,defenseSeconds:.1,droneSeconds:.1,firstDelay:99999,maxAlive:0,defenders:0});
assert(polar.game.combat.player.pos.equals(polar.flight.pos),'paused arrival HUD starts at the real flight position');
const camera=new THREE.PerspectiveCamera(),hud=new Proxy({},{get:()=>noop});
polar.game.setPresentation('travel');polar.game.render(1,0,camera,hud,polar.flight);
assert(!polar.game.mission.group.visible,'travel hides mission');
const timerBefore=polar.game.mission.timer;
polar.game.setPresentation('paused');polar.game.render(1,1/60,camera,hud,polar.flight);
assert(polar.game.mission.group.visible&&polar.game.combat.group.visible,'paused arrival restores scenery');
assert.equal(polar.game.mission.timer,timerBefore,'paused presentation does not advance mission');
polar.game.setPresentation('flight');
polar.game.mission.timer=0;
for(let i=0;i<1200&&!polar.game.mission.done;i++)polar.tick();
assert(polar.game.mission.attackers.every(c=>!c.alive),'real salvo finished');
const polarResult=completion(polar);polar.game.dispose();
const deck=fixture('superweapon-strike',{escorts:0,maxAlive:0,defenders:0});
deck.game.mission.timer=0;deck.tick();
// Cross the actual approach plane; subsequent Game ticks perform the authored jump.
deck.flight.prevPos.set(0,250,1820);deck.flight.pos.set(0,250,1780);
deck.game.tick(dt,deck.flight,input);assert.equal(deck.game.mission.stage,'jump');
deck.tick(100);assert.equal(deck.game.mission.stage,'attack');
deck.game.combat.practice=true;deck.flight.pos.set(0,250,1150);deck.flight.prevPos.copy(deck.flight.pos);
deck.flight.vel.set(0,0,0);deck.flight.speed=0;
input.fire=true;for(let i=0;i<600&&deck.game.mission.vent.alive;i++)deck.tick();input.fire=false;
assert(!deck.game.mission.vent.alive,'normal cannon path destroys vent');
assert.equal(deck.game.mission.stage,'escape');
deck.flight.pos.copy(deck.game.mission.deck.escapePos);deck.tick();
const deckResult=completion(deck);deck.game.dispose();
// Preserve the older capital target's sphere-based gun damage path.
const old=fixture('hatak');const node=old.game.mission.nodes[0];assert(node.alive);
const origin=node.pos.clone().add(new THREE.Vector3(0,100,0));
let rounds=0;
for(;rounds<100&&node.alive;rounds++){
 old.game.combat.shots.fire('player',origin,new THREE.Vector3(0,-1,0),new THREE.Vector3());
 for(let i=0;i<12;i++)old.game.combat.tick(dt,old.flight,input);
}
assert(!node.alive,'legacy Ha’tak node dies from gun projectiles');assert(old.game.combat.player.hits>0);
old.game.dispose();
// Combat owns prevPos; renderer interpolation must not mutate either simulation endpoint.
const tracer=fixture('belt-clear');const C=tracer.game.combat;
const shot=C.shots.fire('player',new THREE.Vector3(100,200,300),new THREE.Vector3(0,0,1),new THREE.Vector3());
const start=shot.pos.clone();C.tick(dt,tracer.flight,input);
assert(shot.prevPos.equals(start));assert(shot.pos.distanceTo(start)>0);
const first=shot.pos.clone();C.tick(dt,tracer.flight,input);assert(shot.prevPos.equals(first));
const previous=shot.prevPos.clone(),current=shot.pos.clone(),matrix=new THREE.Matrix4();
C.shots.update(.25);C.shots.group.children[0].getMatrixAt(0,matrix);const quarter=new THREE.Vector3().setFromMatrixPosition(matrix);
C.shots.update(.75);C.shots.group.children[0].getMatrixAt(0,matrix);const threeQuarter=new THREE.Vector3().setFromMatrixPosition(matrix);
assert(threeQuarter.sub(quarter).distanceTo(current.clone().sub(previous).multiplyScalar(.5))<1e-4,'tracer advances between simulation ticks');
assert(shot.prevPos.equals(previous)&&shot.pos.equals(current),'render preserves simulation endpoints');
C.shots.kill(shot);
// Use live allied/player rounds, not direct damage calls; only the player gets kill/hit credit.
let killCallbacks=0;C.onKill=()=>killCallbacks++;
function shootEnemy(side){
 const enemy=C.enemies.spawn(new THREE.Vector3(0,0,100),tracer.flight.pos,'glider');enemy.hp=1;
 C.shots.fire(side,new THREE.Vector3(0,0,90),new THREE.Vector3(0,0,1),new THREE.Vector3());
 C.tick(dt,tracer.flight,input);assert(!enemy.alive,side+' projectile kills enemy');
}
shootEnemy('ally');assert.equal(C.player.kills,0);assert.equal(C.player.hits,0);assert.equal(killCallbacks,0);
shootEnemy('player');assert.equal(C.player.kills,1);assert.equal(C.player.hits,1);assert.equal(killCallbacks,1);
tracer.game.dispose();
console.log(JSON.stringify({passed:true,evidence:'CPU simulation with stub DOM/storage; not browser or flight-feel evidence',completions:[polarResult,deckResult],legacyNodeGunRounds:rounds,checks:['paused arrival scene and target position','Game persistence exactly once','actual return gates clear','legacy Ha’tak gun damage','projectile prevPos and render interpolation','allied kill attribution']}));
` }, absWorkingDir:root, tsconfig:'tsconfig.json', bundle:true, write:true, outfile:output, format:'esm',platform:'node',define:{'import.meta.env.DEV':'false'},logLevel:'silent'});
await import(pathToFileURL(output).href);
