/** Reusable scenery for the episode art studies. These are compositions, not mission runners. */
import * as THREE from 'three';
import { toonMaterial, glowMaterial } from '@/render/toon';
import { mulberry32 } from '@/core/random';
import { Planet, PLANET_PRESETS, type PlanetPalette } from '@/world/planet';

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Group, x=0, y=0, z=0): THREE.Mesh {
  const part = new THREE.Mesh(geometry, material);
  part.position.set(x,y,z); parent.add(part); return part;
}

/** Faceted ice shelf, pressure ridges and the exposed drilling site. Arena units, not geography. */
export function buildPolarSet(): THREE.Group {
  const group = new THREE.Group(); group.name = 'Antarctic ice shelf · art study';
  const snow = toonMaterial(0xd4e5ed), ice = toonMaterial(0x73b0cd), dark = toonMaterial(0x335a73);
  const rand = mulberry32(711);
  const surface = new THREE.PlaneGeometry(1800, 1600, 32, 28);
  surface.rotateX(-Math.PI/2);
  const p = surface.getAttribute('position');
  for(let i=0;i<p.count;i++) p.setY(i, (rand()-.5)*7-52);
  surface.computeVertexNormals(); mesh(surface,snow,group);
  for(let i=0;i<44;i++) {
    const x=(rand()-.5)*680, z=(rand()-.5)*580;
    if(Math.hypot(x,z)<80) continue;
    const shard=mesh(new THREE.ConeGeometry(12+rand()*27, 9+rand()*23, 4),i%3===0?ice:snow,group,x,-45,z);
    shard.scale.set(1+rand()*2,.65,1); shard.rotation.y=rand()*Math.PI;
  }
  const pit=mesh(new THREE.CylinderGeometry(32,25,4,32),dark,group,0,-48,0);
  pit.name='Drilling site';
  mesh(new THREE.CylinderGeometry(22,22,2,24),ice,group,0,-45,0);
  const platform=mesh(new THREE.CylinderGeometry(9,13,5,8),toonMaterial(0x788a96),group,0,-42,0);
  platform.name='Outpost excavation · interpretive prop';
  for(let i=0;i<6;i++) {
    const angle=i*Math.PI/3;
    mesh(new THREE.BoxGeometry(2,8,2),dark,group,Math.cos(angle)*15,-41,Math.sin(angle)*15);
  }
  return group;
}

/** Individual dark gate segments around an unobstructed opening; optional event horizon. */
export function buildSupergate(active=true): THREE.Group {
  const group=new THREE.Group(); group.name='Supergate';
  const metal=toonMaterial(0x727781), inset=toonMaterial(0x303743), light=glowMaterial(0x739cc3,.9);
  const geo=new THREE.BoxGeometry(13,22,11), innerGeo=new THREE.BoxGeometry(8,3,12);
  for(let i=0;i<48;i++) {
    const a=i*Math.PI*2/48;
    const segment=mesh(geo,metal,group,Math.cos(a)*112,Math.sin(a)*112,0);
    segment.rotation.z=a-Math.PI/2;
    const stripe=mesh(innerGeo,i%4===0?light:inset,group,Math.cos(a)*108,Math.sin(a)*108,1);
    stripe.rotation.z=a-Math.PI/2;
  }
  if(active) {
    const disk=mesh(new THREE.CircleGeometry(102,96),new THREE.MeshBasicMaterial({color:0x387dba,transparent:true,opacity:.19,side:THREE.DoubleSide,depthWrite:false}),group);
    disk.name='Event horizon';
    for(let i=0;i<8;i++) {
      const ripple=mesh(new THREE.RingGeometry(15+i*12,15.6+i*12,96),new THREE.MeshBasicMaterial({color:0x8dd6ed,transparent:true,opacity:.11,side:THREE.DoubleSide,depthWrite:false}),group,0,0,.2);
      ripple.rotation.z=i*.43;
    }
  }
  return group;
}

/** Gold curved drone tracks, composed as a frozen instant for visual review. */
export function buildDronePaths(): THREE.Group {
  const group=new THREE.Group(); group.name='Ancient drone salvo · static study';
  const trail=new THREE.MeshBasicMaterial({color:0xffa91f,transparent:true,opacity:.5});
  const hot=glowMaterial(0xffe3a0,1.5);
  for(let i=0;i<17;i++) {
    const side=i%2?1:-1, spread=(i/17)*75;
    const points=[new THREE.Vector3(side*2,-38,0),new THREE.Vector3(side*(9+spread*.4),-8,12),new THREE.Vector3(side*(20+spread),45,22-i*6),new THREE.Vector3(side*(56+spread*.4),95+i*2,-75-i*3)];
    const curve=new THREE.CatmullRomCurve3(points);
    mesh(new THREE.TubeGeometry(curve,36,.16,4,false),trail,group);
    const tip=curve.getPoint(1), drone=mesh(new THREE.SphereGeometry(.7,6,4),hot,group,tip.x,tip.y,tip.z);
    drone.scale.set(.65,.65,3); drone.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),curve.getTangent(1));
  }
  return group;
}

/** Use the game's baked surfaces and atmosphere so the studies share its visual language. */
export function createWorldGlobe(kind:'earth'|'red'|'blue'|'gas',renderer:THREE.WebGLRenderer): {group:THREE.Group;dispose:()=>void} {
  if(kind==='red') {
    const group=new THREE.Group();group.name='Destabilized star · art study';
    mesh(new THREE.SphereGeometry(160,48,24),glowMaterial(0xd95017,1),group);
    for(let i=0;i<4;i++) {
      const ring=mesh(new THREE.TorusGeometry(164+i*2,.8,5,90),glowMaterial(0xff9a35,.8),group);
      ring.rotation.set(.4+i*.7,i*.6,i*.3);
    }
    return {group,dispose:()=>{}};
  }
  const earth:PlanetPalette={deep:0x10325e,shallow:0x1f638c,low:0x547453,mid:0x73815b,high:0x9b9778,ice:0xe8f1f2,rim:0x74b9ec,night:0x101f3b};
  const gas:PlanetPalette={deep:0x845b47,shallow:0xb98b69,low:0xd0b68f,mid:0xf0dbc0,high:0xab755a,ice:0xf5e3c9,rim:0xd7b693,night:0x342d3b};
  const planet=new Planet({radius:160,segments:64,seed:kind==='earth'?37.2:kind==='blue'?12.7:61.4,
    palette:kind==='earth'?earth:kind==='gas'?gas:PLANET_PRESETS.ice!.palette,
    sunDir:new THREE.Vector3(.55,.5,.85).normalize(),...(kind==='gas'?{bands:9,seaLevel:-.04}:{seaLevel:kind==='earth'?.12:.1})});
  planet.update(renderer,512);
  planet.group.name=kind==='earth'?'Earth · illustrative geography':kind==='gas'?'Jupiter · illustrative banded globe':'Orilla · illustrated ice world';
  return {group:planet.group,dispose:()=>planet.dispose()};
}

export function buildStars(): THREE.Points {
  const rand=mulberry32(919), vertices=[];
  for(let i=0;i<700;i++) {
    const a=rand()*Math.PI*2,z=rand()*2-1,r=Math.sqrt(1-z*z);
    vertices.push(Math.cos(a)*r*1800,z*1800,Math.sin(a)*r*1800);
  }
  return new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)),new THREE.PointsMaterial({color:0xb4c7db,size:1.4,sizeAttenuation:false,depthWrite:false}));
}
