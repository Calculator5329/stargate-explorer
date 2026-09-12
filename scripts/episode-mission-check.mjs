// Actual mission/combat/flight code in a CPU-only harness; browser captures verify rendering separately.
import { build } from 'esbuild';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const cache = join(homedir(), '.cache', 'tmp', 'stargate-explorer');
await mkdir(cache, { recursive: true });
const output = join(await mkdtemp(join(cache, 'episode-missions-')), 'check.mjs');
await build({ stdin: { resolveDir: root, contents: `
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mulberry32 } from '@/core/random';
import { Flight } from '@/sim/flight';
import { Enemies } from '@/combat/enemies';
import { Combat } from '@/combat/combat';
import { createMission } from '@/mission/index';
import { LEVELS } from '@/mission/levels';
import { FleetCraft } from '@/mission/fleet';
import { solidHit } from '@/world/solid';
Math.random=mulberry32(0x0e9150de);globalThis.location={search:''};const noop=()=>{};globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:()=>noop})})};
const audio=new Proxy({},{get:()=>noop});
const rocks={count:0,centers:new Float32Array(),radii:new Float32Array(),broken:0};
const input={fire:false,alt:false,locked:true};
function fixture(id){
 const def=structuredClone(LEVELS.find(l=>l.id===id));
 const flight=new Flight();flight.pos.set(...def.start.pos);flight.prevPos.copy(flight.pos);flight.quat.setFromAxisAngle(new THREE.Vector3(0,1,0),def.start.yaw);flight.prevQuat.copy(flight.quat);
 const enemies=new Enemies(rocks),combat=new Combat(enemies,rocks,new THREE.Group(),audio);
 combat.player.pos.copy(flight.pos); const mission=createMission(def,{combat,flight,audio,rocks});
 const tick=(n=1)=>{for(let i=0;i<n;i++){flight.prevPos.copy(flight.pos);mission.beforeCombat(1/60);combat.tick(1/60,flight,input);mission.tick(1/60);mission.render(1/60,1);}};
 return {def,flight,enemies,combat,mission,tick};
}
const passive=fixture('antarctic-defense');passive.combat.practice=true;for(let i=0;i<60*240&&!passive.mission.done;i++)passive.tick();console.log('PASSIVE BALANCE PROBE '+JSON.stringify({phase:passive.mission.phase,clock:passive.mission.clock,cargo:passive.mission.cargo.hp,site:passive.mission.site.hp,carrier:passive.mission.carrier.hp,defenders:passive.mission.defenders.craft.filter(c=>c.alive).length}));
const a=fixture('antarctic-defense');a.tick(301);
assert.equal(a.mission.stage,'escort');
const originalCargo=a.mission.cargo.pos.clone();a.tick(600);
assert(a.mission.cargo.pos.distanceTo(originalCargo)>250,'cargo follows route');
assert(a.enemies.list.some(e=>e.kind==='bomber'&&e.tgt===1),'bomber prioritizes cargo');
assert(a.combat.shots.shots.some(s=>s.side==='ally'),'allies fire actual rounds');
assert(a.mission.defenders.craft.some(c=>c.pos.distanceTo(c.prevPos)>0),'defenders fly');
a.combat.practice=true;
while(a.mission.stage==='escort'&&!a.mission.done)a.tick(60);
assert.equal(a.mission.stage,'defend','cargo arrives and activates defense stage');a.tick(120);
assert(a.enemies.list.filter(e=>e.alive&&e.kind==='bomber').every(e=>e.tgt===3),'bombers switch to outpost');
const statusAtDefense={cargo:a.mission.cargo.hp,carrier:a.mission.carrier.hp,site:a.mission.site.hp};
// Scripted test removes hostile fighters so the real clock can reach the finale deterministically.
while(!a.mission.done&&a.mission.clock<240){for(const e of a.enemies.list)if(e.alive)a.combat.damageEnemy(e,e.hp+1,false);a.tick(60);}
assert.equal(a.mission.phase,'complete');assert(a.mission.attackers.every(c=>!c.alive),'drone salvo destroys real capital targets');
const lost=fixture('antarctic-defense');lost.tick(301);lost.mission.site.damage(99999);lost.tick();assert.equal(lost.mission.phase,'lost');
// Actual geometry contact changes flight and feeds lethal impact through normal combat.
const crash=fixture('antarctic-defense');crash.flight.prevPos.set(0,100,0);crash.flight.pos.set(0,-400,0);crash.flight.vel.set(0,-600,0);crash.flight.velDir.set(0,-1,0);crash.flight.speed=600;
crash.mission.beforeCombat(1/60);assert(crash.flight.lastImpact>0);crash.combat.tick(1/60,crash.flight,input);assert.equal(crash.combat.player.cause,'terrain');assert(crash.combat.player.hp<100);
// Environment blocks both teams' rounds before they can damage a target behind it.
const d=fixture('superweapon-strike');d.tick(301);assert.equal(d.mission.stage,'approach');
const vent=d.mission.vent;vent.damage(1000);assert.equal(vent.hp,d.def.ventHp,'vent protected before hop');
d.flight.prevPos.set(0,250,1820);d.flight.pos.set(0,250,1780);d.mission.tick(1/60);assert.equal(d.mission.stage,'jump');assert(d.mission.holdsFlight);
d.tick(80);assert.equal(d.mission.stage,'attack');assert(!d.combat.inTransit);assert.equal(vent.shielded,false);
assert(!d.mission.deck.sweep(d.flight.pos,vent.pos,6,solidHit()),'exit and target line clear');
// Fire real cannon projectiles from the approach, not direct damage calls, to disable the vent.
d.combat.practice=true;d.flight.pos.set(0,250,1150);d.flight.prevPos.copy(d.flight.pos);d.flight.vel.set(0,0,0);d.flight.speed=0;
input.fire=true;for(let i=0;i<600&&vent.alive;i++)d.tick();input.fire=false;
assert.equal(vent.alive,false,'normal guns destroy vent');assert.equal(d.mission.stage,'escape');
d.mission.clock=d.def.timeLimit-0.01; d.tick(2); assert.equal(d.mission.stage,'escape'); assert.equal(d.mission.done,false,'escape retains its own full deadline');
d.flight.pos.copy(d.mission.deck.escapePos);d.tick();assert.equal(d.mission.phase,'complete');
const timeout=fixture('superweapon-strike');timeout.tick(301);timeout.mission.clock=timeout.def.timeLimit;timeout.tick(2);assert.equal(timeout.mission.phase,'lost');
const blocked=fixture('superweapon-strike');blocked.mission.vent.shielded=false;
const hp=blocked.mission.vent.hp;blocked.combat.shots.fire('player',new THREE.Vector3(0,250,650),new THREE.Vector3(0,0,1),new THREE.Vector3());blocked.tick(30);
assert.equal(blocked.mission.vent.hp,hp,'bulkhead blocks cannon fire from behind');
const contactFixture=fixture('superweapon-strike');
const box=new THREE.Group();box.add(new THREE.Mesh(new THREE.BoxGeometry(20,20,20),new THREE.MeshToonMaterial()));
const target=new FleetCraft({name:'contact regression',model:box,size:20,hp:100000,pos:[750,525,1800],yaw:.37},contactFixture.combat);
contactFixture.combat.solids.items.length=0;contactFixture.combat.solids.items.push(target);contactFixture.combat.extras.length=0;contactFixture.combat.extras.push(target);
for(const e of contactFixture.enemies.list)e.alive=false;
for(let i=0;i<1000;i++){
 const angle=i*2.399963,dir=new THREE.Vector3(Math.cos(angle),Math.sin(i*.13)*.7,Math.sin(angle)).normalize();
 const origin=target.pos.clone().addScaledVector(dir,40),hp=target.hp;
 const shot=contactFixture.combat.shots.fire('player',origin,dir.negate(),new THREE.Vector3());shot.vel.copy(dir).multiplyScalar(3600);
 contactFixture.combat.tick(1/60,contactFixture.flight,input);
 assert.equal(target.hp,hp-contactFixture.combat.gunDamage,'first mesh contact always damages rotated hull '+i);
}
console.log(JSON.stringify({passed:true,polar:{phase:a.mission.phase,clock:a.mission.clock,statusAtDefense,capitalKills:a.mission.attackers.filter(c=>!c.alive).length},deck:{phase:d.mission.phase,shots:d.combat.player.fired,hits:d.combat.player.hits},checks:['escort arrival','ally flight and rounds','attack priorities','drone fleet destruction','objective loss','terrain crash damage','jump transition','gun damage on vent','escape victory','strike timeout','solid weapon occlusion']}));
` }, absWorkingDir:root, tsconfig:'tsconfig.json', bundle:true, write:true, outfile:output, format:'esm',platform:'node',define:{'import.meta.env.DEV':'false'},logLevel:'silent'});
await import(pathToFileURL(output).href);
