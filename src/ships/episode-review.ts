import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildShip } from '@/ships/builder';
import { HULLS } from '@/ships/hulls';
import { CARRIER_SHIP, CARGO_SHIP, RACE_TRANSPORT_SHIP } from '@/ships/episode-earth';
import { buildAncientWarship, buildHammerCruiser, buildFlagship, buildSuperweapon, buildScienceCruiser } from '@/ships/episode-alien';
import { buildMachineShip, buildInfestation } from '@/ships/episode-machine';
import { buildPolarSet, buildSupergate, buildDronePaths, createWorldGlobe, buildStars } from '@/ships/episode-scenes';
import { Capital } from '@/combat/capital';
import { disposeTree } from '@/render/dispose';
import { updateOutlineUniforms } from '@/render/outline';

type Craft = {name:string; kind:string; build:()=>THREE.Group; shape:string; canon:string; source:string};
const productionSource='https://josephmallozzi.com/2018/03/12/march-12-2018-ships-of-stargate-sg-1/';
const craft:Record<string,Craft>={
  carrier:{name:'BC-304',kind:'New · Earth battlecruiser',build:()=>buildShip(CARRIER_SHIP),shape:'A narrow forward deck leading into a broad armored carrier body. Two long hangar shoulders, four stern engines and a low stepped bridge distinguish it from Prometheus.',canon:'Odyssey and Korolev join the allied fleet at the Supergate. These share one class silhouette; individual paint schemes and loadouts can come later.',source:productionSource},
  cargo:{name:'Tel’tak',kind:'New · Goa’uld cargo ship',build:()=>buildShip(CARGO_SHIP),shape:'A compact bronze cargo hull with a raised faceted roof, blunt nose and shoulders that flare toward the engines.',canon:'A cargo ship carries the team to Antarctica. The same craft family also supports rescue, infiltration and escape stories.',source:'https://rdanderson.com/stargate/lexicon/entries/teltac.htm'},
  hammer:{name:'Asgard O’Neill class',kind:'New · Asgard battleship',build:buildHammerCruiser,shape:'A wedge-shaped bow, narrow connecting neck, forked dorsal towers and a broad silver-blue aft crescent. The silhouette is intentionally unlike Earth naval blocks.',canon:'The O’Neill is used as a decoy against Replicator-controlled ships in Small Victories. Different Asgard classes should retain their own shapes.',source:productionSource},
  science:{name:'Daniel Jackson class',kind:'New · Asgard science vessel',build:buildScienceCruiser,shape:'Two long separate hulls end in wedge noses. Curved aft bridges connect the split body between tall rectangular fins, leaving a deep open corridor through the front.',canon:'Thor’s Daniel Jackson is the Asgard science vessel in New Order. This study uses its screen silhouette; the individual surface panels remain a stylized interpretation.',source:'https://www.rdanderson.com/stargate/lexicon/entries/jacksonthedaniel.htm'},
  ring:{name:'Ori warship',kind:'New · Ori capital ship',build:buildAncientWarship,shape:'An open oval cream-colored hull, luminous inner structure, rounded forward wall and paired rear engine legs. Inspect from above to read the opening.',canon:'Four Ori warships emerge through the Supergate in Camelot. The large central aperture is a key recognition feature.',source:'https://rdanderson.com/stargate/lexicon/entries/oriwarship.htm'},
  flagship:{name:'Anubis’s flagship',kind:'New · Lost City command ship',build:buildFlagship,shape:'A tall three-sided pyramid over a layered triangular command hull. Dark bronze, gold facets and recessed machinery give the Antarctic threat its own silhouette.',canon:'The pyramid-bearing Lost City flagship is a separate study from the flat superweapon mothership in Fallen. The episode distinction is referenced; this layout is a stylized approximation.',source:'https://www.stargate-sg1-solutions.com/wiki/Ha%27tak'},
  superweapon:{name:'Anubis’s superweapon ship',kind:'New · Fallen mothership',build:buildSuperweapon,shape:'A broad flat radial disk with concentric machinery, projecting docking arms and a recessed approach channel. The cooling grille supplies a visible endpoint for the fighter-scale study.',canon:'Fallen and Homecoming use the earlier circular mothership. The cooling-vent attack is from the episode; this exposed approach corridor is an interpretive gameplay composition.',source:'https://www.rdanderson.com/stargate/episodes/episodes/07-01fallen.htm'},
  civilian:{name:'Seberus',kind:'New · Space Race transport',build:()=>buildShip(RACE_TRANSPORT_SHIP),shape:'A blunt industrial forebody, broad thin swept vanes with upright endplates, an exposed central spine and three blue exhausts. A civilian silhouette in muted green metal.',canon:'Carter joins Warrick aboard Seberus for the Loop of Kon Garat. This new study follows production concepts and episode stills rather than renaming the existing racer.',source:'https://www.rdanderson.com/stargate/lexicon/entries/seberus.htm'},
  machine:{name:'Replicator craft study',kind:'New · interpreted machine hull',build:buildMachineShip,shape:'A dense, rounded center built from individual metal blocks, broken by long irregular protrusions and sparse cold seams. The repeated parts are instanced for later fleet use.',canon:'New Order establishes the Replicator escape and approach to Orilla. This model explores that machine-built character; its exact screen silhouette is unverified. It is distinct from hijacked Asgard or Goa’uld ships.',source:'https://www.rdanderson.com/stargate/episodes/episodes/08-01neworder.htm'},
  fighter:{name:'F-302',kind:'Existing · Earth fighter',build:()=>buildShip(HULLS.f11!),shape:'The current selected fighter: swept delta wing, twin engines and a slender central cockpit. Included to judge fighter-to-capital readability.',canon:'F-302s intercept the attacking craft above Antarctica and escort the team’s cargo ship.',source:productionSource},
  glider:{name:'Death Glider',kind:'Existing · Goa’uld fighter',build:()=>buildShip(HULLS.glider!),shape:'The previously preferred curved-wing fighter, retained unchanged.',canon:'The familiar small-craft opponent for Goa’uld fleet engagements.',source:productionSource},
  bomber:{name:'Al’kesh',kind:'Existing · Goa’uld bomber',build:()=>buildShip(HULLS.bomber!),shape:'The previously selected bomber model, retained unchanged. Its heavier silhouette contrasts with Death Gliders.',canon:'Al’kesh support the Goa’uld attack at Antarctica.',source:productionSource},
  prometheus:{name:'Prometheus',kind:'Existing · Earth capital ship',build:()=>buildShip(HULLS.prometheus!),shape:'The selected procedural Prometheus, with forward hangar boxes, a long central hull and stepped command tower.',canon:'Prometheus participates in Lost City. The later BC-304 class is not substituted into this battle.',source:'https://josephmallozzi.com/2018/03/13/march-13-2018-the-prometheus-in-depth-and-a-few-stargate-related-links/'},
  pyramid:{name:'Ha’tak',kind:'Existing · Goa’uld mothership',build:()=>new Capital().group,shape:'A pyramid within a segmented outer ring. Included at deliberately compressed scale so the scene remains readable.',canon:'The established Goa’uld mothership family supports blockade, escape and fleet-defense concepts.',source:productionSource},
  prototype:{name:'X-301 game variant',kind:'Existing · captured glider lineage',build:()=>buildShip(HULLS.lancer!),shape:'The existing captured-glider role variant with Earth missile rails. This is a game adaptation of the X-301 lineage, not a separately exact replica.',canon:'Tangent centers on an experimental human-modified Death Glider sent away by its hidden recall system.',source:'https://rdanderson.com/stargate/lexicon/entries/x301.htm'},
};

// Include every current game-role hull alongside the episode ships; legacy alternatives stay in the hull inspector.
const represented = new Set(['f11', 'glider', 'bomber', 'prometheus', 'lancer', 'cargo', 'carrier', 'civilian']);
for (const [key, def] of Object.entries(HULLS)) {
  if (represented.has(key) || key === 'original' || key.startsWith('old-')) continue;
  craft[key] = { name: def.name, kind: 'Existing · game-role hull', build: () => buildShip(def), shape: 'Current in-game geometry. Compare its nose, wings, engines and profile from all four inspection views.', canon: 'This is a gameplay role variant. Its loadout and silhouette are game adaptations, not a claim of a separate canonical ship class.', source: productionSource };
}

type Episode={id:string;name:string;episode:string;summary:string;idea:string;visual:string;canon:string;source:string;fleet:string[];scene:'polar'|'gate'|'star'|'rescue'|'asgard'|'strike'|'asteroid'|'fleet'|'race'|'machine'};
const episodes:Episode[]=[
  {id:'new-order',name:'The fragments still matter',episode:'New Order · S8 E1–2',summary:'Destroying the approaching ship does not end the danger: its pieces can reach the planet.',idea:'Intercept surviving machine fragments above Orilla. This could turn the usual victory explosion into the start of a second visual beat. Decide later whether we preserve the episode outcome or mark the sortie as an alternate scenario.',visual:'A jagged machine hull against a cold planet, followed by distinct clumps of metallic fragments. The split hull of Thor’s Daniel Jackson-class vessel gives the pursuing side a different silhouette from the machine craft.',canon:'The Replicator ship is destroyed near Orilla, but fragments seed the planet. A successful player interception would change that outcome. The machine model here is an interpretation, not an exact screen replica.',source:'https://www.rdanderson.com/stargate/episodes/episodes/08-01neworder.htm',fleet:['machine','science'],scene:'machine'},
  {id:'space-race',name:'The Loop of Kon Garat',episode:'Space Race · S7 E8',summary:'A civilian race through a solar limb, attack drones and an asteroid course.',idea:'A race with a rescue choice: leave the ideal line to help a sabotaged competitor, then fight back through the field. Seberus gives this a different mood from military sorties.',visual:'Green industrial hull, three bright exhausts, warm solar light and a readable chain of course markers. The gates and rival positions are proposed race graphics.',canon:'Carter races with Warrick aboard Seberus. Attack drones, a coronasphere, asteroids and sabotage are episode beats; these gold course rings are a game adaptation.',source:'https://www.rdanderson.com/stargate/episodes/episodes/07-08spacerace.htm',fleet:['civilian'],scene:'race'},
  {id:'antarctica',name:'The Antarctic defense',episode:'Lost City, Part 2 · S7 E22',summary:'A low-altitude battle with an enormous fleet hanging above the ice. This is the centerpiece.',idea:'Escort the cargo ship to the drilling site, peel attackers off Prometheus, then hold the airspace long enough for the drone salvo. Now playable as one connected sortie: escort, outpost defense, then drone launch.',visual:'Blue-white pressure ridges, a dark ship wall overhead, F-302s crossing the foreground and a rising fan of gold drone trails. The excavation and placements here are interpretive scenery.',canon:'The team reaches the Antarctic outpost in a cargo ship; Prometheus and F-302s defend it against Anubis’s forces. Ancient drones decide the battle. Our fighter objectives are proposed adaptations.',source:'https://rdanderson.com/stargate/episodes/episodes/07-21lost.htm',fleet:['fighter','cargo','prometheus','glider','bomber','pyramid','flagship'],scene:'polar'},
  {id:'camelot',name:'The Supergate opens',episode:'Camelot · S9 E20',summary:'An allied fleet waits before an enormous ring. Then the scale of the threat changes.',idea:'Begin with a formation approach and reconnaissance around the gate; shift to protecting evacuation routes when the Ori ships arrive. Survival and rescue could make a more faithful objective than destroying the whole enemy fleet.',visual:'A segmented Supergate, a blue event horizon, white Ori hulls emerging through the opening and smaller Earth/Goa’uld ships scattered in front.',canon:'The allied fleet confronts four Ori warships at P3Y-229. The fleet loses; a triumphant wipeout objective would change the episode’s outcome.',source:'https://rdanderson.com/stargate/episodes/episodes/09-20camelot.htm',fleet:['carrier','ring','pyramid'],scene:'gate'},
  {id:'unending',name:'The last gift',episode:'Unending · S10 E20',summary:'Odyssey leaves the Asgard homeworld carrying something irreplaceable.',idea:'A departure-and-pursuit concept: get clear of the planet, screen Odyssey’s departure and escape converging fire. Keep the time-dilation device as a possible visual transition until we discuss how it should play.',visual:'A cold blue world behind the BC-304, with ivory enemy hulls cutting across the departure line. Strong blue-versus-warm-white faction contrast.',canon:'Odyssey receives the Asgard legacy at Orilla and is pursued by Ori ships. The episode’s core time-dilation story is not a conventional fighter battle.',source:'https://rdanderson.com/stargate/episodes/episodes/10-20unending.htm',fleet:['carrier','ring'],scene:'asgard'},
  {id:'fallen',name:'Under the shield',episode:'Fallen · S7 E1',summary:'Make a capital ship feel like terrain: deck trenches, pylons and a small target at the end of a dangerous approach.',idea:'A precision pass along Anubis’s hull toward the superweapon’s vulnerable cooling vent. Now playable: cross the jump ring, disable the cooling vent and escape to the beacon. The powered reversal helps turn out of the attack run.',visual:'The flagship’s radial arms become canyons at fighter height. Gold plates and deep black recesses provide a much different route than another asteroid belt.',canon:'The F-302 attack uses a short hyperspace jump to bypass the ship’s shields and strike the cooling vent. A flyable trench course would be our adaptation.',source:'https://rdanderson.com/stargate/episodes/episodes/07-01fallen.htm',fleet:['fighter','superweapon'],scene:'strike'},
  {id:'small-victories',name:'The unfinished decoy',episode:'Small Victories · S4 E1',summary:'An Asgard battleship becomes the bait in a trap.',idea:'Draw pursuing Replicator-controlled ships onto the decoy’s route and escape before detonation. Tension can come from managing distance rather than an oversized health bar.',visual:'One silver hammer-shaped ship isolated against darkness; the pursuers arrive as separate threatening silhouettes. This study only stages the decoy, not an invented enemy class.',canon:'The unfinished O’Neill is sacrificed to destroy Replicator-controlled ships. Those are not the later block-built Replicator spacecraft.',source:'https://rdanderson.com/stargate/episodes/episodes/04-01victories.htm',fleet:['hammer'],scene:'asgard'},
  {id:'tangent',name:'Beyond the rescue window',episode:'Tangent · S4 E12',summary:'A small craft, immense Jupiter and a rescue ship trying to arrive in time.',idea:'A navigation-and-rendezvous mission: conserve thrust, reach a narrow interception corridor and match velocity with the rescue craft. This could be a quiet break from combat.',visual:'The X-301 glider lineage against banded Jupiter, a bronze cargo ship arriving from the side, and lots of negative space to sell isolation.',canon:'The X-301’s hidden recall device strands O’Neill and Teal’c; the rescue involves a cargo ship. The survival/navigation rules would be game additions.',source:'https://rdanderson.com/stargate/episodes/episodes/04-12tangent.htm',fleet:['prototype','cargo'],scene:'rescue'},
  {id:'exodus',name:'Outrun the star',episode:'Exodus · S4 E22',summary:'The escape route turns into a race against a changing sun.',idea:'Cover the captured Ha’tak, intercept the Al’kesh and reach the escape corridor as the star destabilizes. An expanding light front and navigation pressure would give us a different finale from a capital-ship kill.',visual:'A red-orange stellar disk behind dark Goa’uld hulls, a thin safe corridor and a final white-out transition. These are proposed VFX treatments.',canon:'The team uses a Stargate connected to a black hole to destabilize Vorash’s sun. The resulting supernova destroys the enemy fleet.',source:'https://rdanderson.com/stargate/episodes/episodes/04-22exodus.htm',fleet:['bomber','pyramid','glider'],scene:'star'},
  {id:'enemies',name:'A ship that is no longer ours',episode:'Enemies · S5 E1',summary:'An escape centered on a captured Ha’tak and the threat growing inside it.',idea:'Protect the escape craft while parts of the mothership go dark, then leave before the sabotaged mothership crashes. We can emphasize rescue and timed departure rather than turn every Replicator story into dogfighting.',visual:'The familiar pyramid silhouette with patchy cold light and a cargo ship dwarfed in its shadow. Interior infestation would need a separate prop/VFX pass.',canon:'Replicators infest the captured Ha’tak after the events of Exodus. The external escort sequence here is an adaptation.',source:'https://rdanderson.com/stargate/episodes/episodes/05-01enemies.htm',fleet:['pyramid','cargo'],scene:'fleet'},
  {id:'fail-safe',name:'The asteroid that will not break',episode:'Fail Safe · S5 E17',summary:'A giant obstacle approaches Earth, and conventional fire is not the answer.',idea:'A close survey through fragments, then a precision delivery or extraction at the asteroid. Save the hyperspace solution for the finale rather than making the rock another target to grind down.',visual:'The cargo ship near a dark faceted mass, Earth filling the distant background and a tight corridor of tumbling fragments.',canon:'An asteroid containing naquadah threatens Earth; the team uses a cargo ship’s hyperdrive to move it through the planet. Proposed survey/extraction beats adapt that story.',source:'https://rdanderson.com/stargate/episodes/episodes/05-17failsafe.htm',fleet:['cargo'],scene:'asteroid'},
  {id:'reckoning',name:'Hold above Dakara',episode:'Reckoning · S8 E16–17',summary:'A fleet defense where the ground-side solution matters more than winning every duel.',idea:'Keep an escape corridor open while rival fleets converge. A changing ally/enemy map could matter more than simply adding more waves.',visual:'Multiple Ha’tak silhouettes at different depths, a planet’s limb and a bright horizon event. This is a fleet composition study; the Dakara installation is not modeled yet.',canon:'The Replicator attack, Jaffa struggle and Dakara weapon intersect in this two-part story. A player-led fighter corridor is our proposal.',source:'https://rdanderson.com/stargate/episodes/episodes/08-16reckoning.htm',fleet:['pyramid','glider'],scene:'fleet'},
];

function element<T extends HTMLElement>(id:string):T {return document.getElementById(id) as T;}
const viewport=element('viewport');
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x0b1521); scene.add(buildStars());
scene.add(new THREE.HemisphereLight(0xd9eafa,0x425165,1.6));
const keyLight=new THREE.DirectionalLight(0xffefcf,2.7); keyLight.position.set(150,220,180); scene.add(keyLight);
const fill=new THREE.DirectionalLight(0x8abbe8,1.5); fill.position.set(-180,80,-120); scene.add(fill);
const camera=new THREE.PerspectiveCamera(38,1,.1,5000);
camera.layers.enable(1); // The game's outline shells and engine glow discs live on this layer.
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
// Review-only canvas; game resolution remains owned by Renderer.pixelRatio().
renderer.setPixelRatio(1); renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.outputColorSpace=THREE.SRGBColorSpace;
viewport.prepend(renderer.domElement);
const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=false;orbit.maxDistance=1500;orbit.minDistance=15;
let assembly=new THREE.Group(); scene.add(assembly);
let worldDisposers:(()=>void)[]=[];
let mode:'episodes'|'ships'='episodes',selected='antarctica',silhouette=false,rotating=false,extent=180;
let choicesMode:'episodes'|'ships'|''='';
const center=new THREE.Vector3();
const savedMaterials=new Map<THREE.Mesh,THREE.Material|THREE.Material[]>();
const black=new THREE.MeshBasicMaterial({color:0x111820});
let notes:Record<string,string>={};
try{const parsed:unknown=JSON.parse(localStorage.getItem('sg1-episode-art-notes')??'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)) notes=Object.fromEntries(Object.entries(parsed).filter((entry):entry is [string,string]=>typeof entry[1]==='string'));}catch{/* Local notes are optional. */}

function render():void {
  updateOutlineUniforms(camera,viewport.clientHeight);
  renderer.render(scene,camera);
  element('render-state').textContent=`${renderer.info.render.triangles.toLocaleString()} triangles · ${renderer.info.render.calls} draws · static art study`;
}
function resize():void {
  const w=viewport.clientWidth,h=viewport.clientHeight;
  if(renderer.domElement.width!==w||renderer.domElement.height!==h) {renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
  render();
}
let resizeFrame=0;
new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(resize);}).observe(viewport);
orbit.addEventListener('change',render);

function addCraft(id:string,size:number,pos:[number,number,number],yaw=0):THREE.Group {
  const group=craft[id]!.build();
  const bounds=new THREE.Box3().setFromObject(group),dimensions=bounds.getSize(new THREE.Vector3());
  const localCenter=bounds.getCenter(new THREE.Vector3());
  group.position.sub(localCenter);
  const wrapper=new THREE.Group();wrapper.add(group);wrapper.scale.setScalar(size/Math.max(dimensions.x,dimensions.y,dimensions.z));wrapper.position.set(...pos);wrapper.rotation.y=yaw;assembly.add(wrapper);return wrapper;
}
function resetCamera():void {
  const view=element<HTMLSelectElement>('angle').value;
  const direction=view==='top'?new THREE.Vector3(0,1,.001):view==='side'?new THREE.Vector3(1,0,0):view==='front'?new THREE.Vector3(0,0,1):view==='rear'?new THREE.Vector3(0,0,-1):new THREE.Vector3(1,.65,1.25).normalize();
  camera.up.set(0,1,0);if(view==='top')camera.up.set(0,0,1);
  const fov=camera.fov*Math.PI/180,fit=Math.min(fov,2*Math.atan(Math.tan(fov/2)*camera.aspect));
  let distance=extent/Math.sin(fit/2);
  if(mode==='ships') {
    // Fit projected bounds rather than a sphere: flat ships should still fill the studio.
    const right=new THREE.Vector3().crossVectors(camera.up,direction).normalize();
    const up=new THREE.Vector3().crossVectors(direction,right).normalize();
    const bounds=new THREE.Box3().setFromObject(assembly),offset=new THREE.Vector3();
    let required=0;
    for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]) {
      offset.set(x,y,z).sub(center);
      required=Math.max(required,Math.abs(offset.dot(right))/Math.tan(fov/2)/camera.aspect+offset.dot(direction),Math.abs(offset.dot(up))/Math.tan(fov/2)+offset.dot(direction));
    }
    distance=required*1.23;
  }
  camera.position.copy(center).addScaledVector(direction,distance);orbit.target.copy(center);orbit.update();render();
}
function globe(kind:'earth'|'blue'|'gas'|'red'):THREE.Group {
  const world=createWorldGlobe(kind,renderer);worldDisposers.push(world.dispose);return world.group;
}
function compose(e:Episode):void {
  if(e.scene==='polar') {
    assembly.add(buildPolarSet(),buildDronePaths());
    addCraft('prometheus',108,[-70,0,30],.25);addCraft('cargo',16,[6,-29,16],-.4);
    addCraft('flagship',170,[20,155,-155]);
    addCraft('pyramid',66,[-145,112,-118]);addCraft('pyramid',58,[158,120,-120]);
    addCraft('fighter',23,[55,-13,90],-.55);addCraft('fighter',18,[85,9,40],-.55);
    addCraft('glider',18,[-48,35,72],2.4);addCraft('bomber',25,[50,53,-20],2.8);
    center.set(0,38,0);extent=177;
  } else if(e.scene==='gate') {
    const gate=buildSupergate();gate.position.set(0,35,-95);assembly.add(gate);
    addCraft('ring',90,[12,22,-55],-.08);addCraft('ring',67,[-125,55,0],-.25);addCraft('ring',63,[138,20,-25],.3);addCraft('ring',52,[80,82,-130],.1);
    addCraft('carrier',66,[-42,-27,96],Math.PI);addCraft('carrier',56,[70,-13,105],Math.PI);addCraft('pyramid',70,[-140,-15,90]);
    center.set(0,17,0);extent=190;
  } else if(e.scene==='machine') {
    const planet=globe('blue');planet.position.set(-145,-100,-290);assembly.add(planet);
    addCraft('machine',137,[-5,7,0]);addCraft('science',72,[-100,-15,85],.65);
    for(let i=0;i<5;i++) {const debris=buildInfestation();debris.scale.setScalar(.35+i*.08);debris.position.set(75+i*13,-25-i*8,-35-i*18);debris.rotation.set(.3*i,.7*i,.5*i);assembly.add(debris);}
    center.set(0,0,0);extent=155;
  } else if(e.scene==='race') {
    const star=globe('red');star.position.set(-160,15,-360);assembly.add(star);
    addCraft('civilian',58,[0,0,50],-.45);
    for(let i=0;i<6;i++) {
      const ring=new THREE.Mesh(new THREE.TorusGeometry(28,1.1,6,48),new THREE.MeshBasicMaterial({color:0xe7ba64}));
      ring.position.set(Math.sin(i*.75)*65,Math.sin(i*.6)*25,-i*55);assembly.add(ring);
      const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(9+i%3*5,0),new THREE.MeshStandardMaterial({color:0x636167,roughness:1,flatShading:true}));
      rock.position.set((i%2?1:-1)*(85+i*4),-20+i*8,-i*40);assembly.add(rock);
    }
    center.set(0,0,-40);extent=175;
  } else if(e.scene==='strike') {
    addCraft('superweapon',285,[0,0,0]);addCraft('fighter',15,[27,28,102],Math.PI);addCraft('fighter',12,[51,31,120],Math.PI);
    center.set(0,16,0);extent=155;
  } else if(e.scene==='rescue'||e.scene==='asteroid') {
    const earth=globe(e.scene==='rescue'?'gas':'earth');earth.position.set(-125,-45,-265);assembly.add(earth);
    addCraft('cargo',e.scene==='rescue'?35:23,[42,-8,30],-.8);
    if(e.scene==='rescue')addCraft('prototype',27,[-15,10,67],.3);
    else {
      const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(90,1),new THREE.MeshStandardMaterial({color:0x514f51,roughness:1,flatShading:true}));rock.scale.set(1.2,.7,1);rock.position.set(-25,0,-15);assembly.add(rock);
      for(let i=0;i<9;i++){const shard=new THREE.Mesh(new THREE.IcosahedronGeometry(3+i%4,0),rock.material);shard.position.set(Math.sin(i*8)*110,Math.cos(i*4)*35,30+Math.sin(i)*60);assembly.add(shard);}
    }
    center.set(0,0,0);extent=160;
  } else if(e.scene==='star') {
    const star=globe('red');star.position.set(-95,0,-250);assembly.add(star);
    addCraft('pyramid',100,[-25,5,0],.25);addCraft('bomber',30,[68,-3,82],-.25);addCraft('glider',21,[105,20,42],-.25);
    center.set(0,0,0);extent=185;
  } else if(e.scene==='asgard') {
    if(e.id==='small-victories'){addCraft('hammer',150,[0,0,0]);extent=100;center.set(0,0,0);}
    else{const planet=globe('blue');planet.position.set(-140,-80,-245);assembly.add(planet);addCraft('carrier',86,[0,0,60],-.4);addCraft('ring',80,[-95,68,-10],.2);addCraft('ring',70,[145,32,-45],-.2);center.set(0,10,0);extent=190;}
  } else {
    const planet=globe('blue');planet.position.set(-170,-110,-290);assembly.add(planet);
    addCraft('pyramid',150,[-32,16,-10]);addCraft(e.id==='enemies'?'cargo':'glider',24,[85,-3,80],-.4);
    if(e.id==='enemies')for(let i=0;i<4;i++){const patch=buildInfestation();patch.position.set(-60+i*16,20,-4+i*3);patch.scale.setScalar(.65);assembly.add(patch);}
    if(e.id==='reckoning'){addCraft('pyramid',70,[128,35,-112]);addCraft('pyramid',65,[-142,10,-90]);}
    center.set(0,0,0);extent=175;
  }
}

function sourceLink(url:string):void {const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Episode / production reference ↗';element('source').replaceChildren(a);}
function paintChoices():void {
  element('episodes-tab').setAttribute('aria-pressed',String(mode==='episodes'));element('ships-tab').setAttribute('aria-pressed',String(mode==='ships'));
  if(choicesMode===mode) {
    for(const button of element('choices').querySelectorAll('button')) button.setAttribute('aria-pressed',String(button.dataset.id===selected));
    return;
  }
  choicesMode=mode;
  element('choices').replaceChildren();
  const arranged=[...episodes.filter(e=>e.id==='antarctica'),...episodes.filter(e=>e.id!=='antarctica')];
  const items=mode==='episodes'?arranged.map(e=>({id:e.id,name:e.name,sub:e.episode})):Object.entries(craft).map(([id,c])=>({id,name:c.name,sub:c.kind}));
  for(const item of items){const b=document.createElement('button');b.dataset.id=item.id;b.textContent=item.name;b.setAttribute('aria-pressed',String(selected===item.id));const small=document.createElement('small');small.textContent=item.sub;b.append(small);b.onclick=()=>select(mode,item.id);element('choices').append(b);}
}
function setSilhouette(value:boolean):void {
  silhouette=value;element('silhouette').setAttribute('aria-pressed',String(value));
  const polar=mode==='episodes'&&selected==='antarctica';
  scene.background=new THREE.Color(value?0xe4e9ed:polar?0x496986:0x0b1521);
  scene.fog=polar&&!value?new THREE.Fog(0x496986,700,1750):null;
  assembly.traverse(o=>{if(o instanceof THREE.Mesh){if(value){savedMaterials.set(o,o.material);o.material=black;}else if(savedMaterials.has(o)){o.material=savedMaterials.get(o)!;}}});
  if(!value)savedMaterials.clear();render();
}
function select(nextMode:typeof mode,id:string):void {
  setSilhouette(false);rotating=false;element('spin').setAttribute('aria-pressed','false');
  scene.remove(assembly);for(const dispose of worldDisposers)dispose();worldDisposers=[];disposeTree(assembly);assembly=new THREE.Group();scene.add(assembly);mode=nextMode;selected=id;
  element<HTMLSelectElement>('angle').value='perspective';element<HTMLButtonElement>('spin').disabled=mode!=='ships';
  const fleet=element('fleet');fleet.replaceChildren();
  if(mode==='episodes') {
    const e=episodes.find(v=>v.id===id)!;compose(e);
    element('title').textContent=e.name;element('episode-number').textContent=e.episode;element('description').textContent=e.summary;element('idea-heading').textContent='The playable idea';element('idea').textContent=e.idea;element('visual').textContent=e.visual;element('canon').textContent=e.canon;sourceLink(e.source);
    for(const key of e.fleet){const b=document.createElement('button');b.textContent=craft[key]!.name;b.onclick=()=>select('ships',key);fleet.append(b);}
  } else {
    const c=craft[id]!;addCraft(id,100,[0,0,0]);center.set(0,0,0);extent=68;
    element('title').textContent=c.name;element('episode-number').textContent=c.kind;element('description').textContent=c.shape;element('idea-heading').textContent='Where it fits';element('idea').textContent=episodes.filter(e=>e.fleet.includes(id)).map(e=>e.name).join(' · ') || 'Current gameplay hull: available in the game’s combat or flight roster.';element('visual').textContent='Use the top, side and rear views to judge the silhouette and construction. Drag to inspect freely; silhouette mode removes the material colors.';element('canon').textContent=c.canon;sourceLink(c.source);
  }
  element('scene-title').textContent=element('title').textContent;element('scene-kicker').textContent=mode==='episodes'?'Staged episode concept':'Procedural ship study';
  element<HTMLTextAreaElement>('notes').value=notes[`${mode}:${selected}`]??'';element('note-status').textContent='';
  const query=new URLSearchParams({mode,id});history.replaceState(null,'',`${location.pathname}?${query}`);
  paintChoices();setSilhouette(false);resize();resetCamera();viewport.scrollIntoView({block:'nearest'});document.body.dataset.ready='true';
}
element('episodes-tab').onclick=()=>select('episodes','antarctica');element('ships-tab').onclick=()=>select('ships','carrier');
element('reset').onclick=resetCamera;element<HTMLSelectElement>('angle').onchange=resetCamera;
element('silhouette').onclick=()=>setSilhouette(!silhouette);
element('spin').onclick=()=>{rotating=!rotating;element('spin').setAttribute('aria-pressed',String(rotating));};
function download(blob:Blob,filename:string):void {const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
element('capture').onclick=()=>{render();renderer.domElement.toBlob(blob=>{if(blob)download(blob,`sg1-${mode}-${selected}.png`);});};
element<HTMLTextAreaElement>('notes').oninput=()=>{notes[`${mode}:${selected}`]=element<HTMLTextAreaElement>('notes').value;try{localStorage.setItem('sg1-episode-art-notes',JSON.stringify(notes));element('note-status').textContent='Saved in this browser.';}catch{element('note-status').textContent='Storage unavailable. Export notes to keep them.';}};
element('export-notes').onclick=()=>download(new Blob([JSON.stringify(notes,null,2)],{type:'application/json'}),'sg1-episode-art-notes.json');
let previous=0;
renderer.setAnimationLoop((time:number)=>{if(rotating&&mode==='ships'&&!document.hidden){assembly.rotation.y+=Math.min((time-previous)/1000,.05)*.3;render();}previous=time;});
window.addEventListener('error',event=>{const error=element('error');error.hidden=false;error.textContent=`The study could not render: ${event.message}`;});
const query=new URLSearchParams(location.search),initialMode=query.get('mode')==='ships'?'ships':'episodes',initialId=query.get('id')??'antarctica';
select(initialMode,initialMode==='ships'?(craft[initialId]?initialId:'carrier'):(episodes.some(e=>e.id===initialId)?initialId:'antarctica'));
