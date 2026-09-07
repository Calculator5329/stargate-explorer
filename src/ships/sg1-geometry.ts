import type { ArmorDef, EngineDef, ShipDef, Vec3 } from '@/ships/defs';
import { PLAYER_REVISED } from '@/ships/variants';
import { GLIDER_REVISED } from '@/combat/glider-def';

function plate(x:number,z:number,w:number,l:number,y:number,t:number,slot:ArmorDef['slot']='body',mirror=false,topScale=0.88):ArmorDef {
  const c=Math.min(w,l)*0.12;
  return {points:[[x-w/2+c,z-l/2],[x+w/2-c,z-l/2],[x+w/2,z-l/2+c],[x+w/2,z+l/2-c],[x+w/2-c,z+l/2],[x-w/2+c,z+l/2],[x-w/2,z+l/2-c],[x-w/2,z-l/2+c]],y,thickness:t,slot,mirror,topScale};
}

/** Scale the complete visible assembly together, including plumes and attached details. */
function scaled(base:ShipDef,k:number):ShipDef {
  const pos=([x,y,z]:Vec3):Vec3=>[x*k,y*k,z*k];
  const engine=(e:EngineDef):EngineDef=>({...e,pos:pos(e.pos),radius:e.radius*k,length:e.length*k});
  return {...base,hull:base.hull.map(s=>({...s,z:s.z*k,w:s.w*k,h:s.h*k,yOff:(s.yOff??0)*k})),
    ...(base.canopy?{canopy:{...base.canopy,sections:base.canopy.sections.map(s=>({...s,z:s.z*k,w:s.w*k,h:s.h*k,yOff:(s.yOff??0)*k}))}}:{}),
    wings:base.wings.map(w=>({...w,root:pos(w.root),span:w.span*k,rootChord:w.rootChord*k,tipChord:w.tipChord*k,sweep:w.sweep*k,thickness:w.thickness*k})),
    fins:base.fins.map(f=>({...f,root:pos(f.root),height:f.height*k,rootChord:f.rootChord*k,tipChord:f.tipChord*k,sweep:f.sweep*k,thickness:f.thickness*k})),
    engines:base.engines.map(engine),...(base.pods?{pods:base.pods.map(engine)}:{}),
    ...(base.armor?{armor:base.armor.map(a=>({...a,points:a.points.map(([x,z]):[number,number]=>[x*k,z*k]),y:a.y*k,thickness:a.thickness*k}))}:{}),
    hatches:base.hatches.map(h=>({...h,pos:pos(h.pos),size:[h.size[0]*k,h.size[1]*k]})),
    decals:base.decals.map(d=>({...d,pos:pos(d.pos),size:[d.size[0]*k,d.size[1]*k]})),plumeScale:(base.plumeScale??1)*k};
}

/** Role names/loadouts are game inventions; their underlying craft come from SG-1. */
export function roleVariant(original:ShipDef,kind:'heavy'|'dart'|'lancer'|'interceptor'|'gunboat'|'racer'):ShipDef {
  if(kind==='gunboat') {
    const ship=alkeshGeometry(original);
    return {...ship,name:original.name,palette:{...ship.palette,accent:0x897447}};
  }
  const earth=kind==='heavy'||kind==='dart';
  let ship=scaled(earth?PLAYER_REVISED:GLIDER_REVISED,kind==='heavy'?1.04:kind==='dart'?0.76:kind==='interceptor'?0.57:kind==='racer'?0.8:0.95);
  ship={...ship,name:original.name};
  if(kind==='dart') return {...ship,pods:[],palette:{...ship.palette,accent:0x7c8795}};
  if(kind==='interceptor') return {...ship,palette:{...ship.palette,body:0x60665e,accent:0x706749}};
  if(kind==='heavy') return {...ship,armor:[...ship.armor??[],plate(1.4,-1.7,0.65,4,0.76,0.16,'accent',true)],palette:{...ship.palette,body:0x7c848b}};
  // X-301: recovered glider airframe with human missile rails and test-aircraft finish.
  const missilePods:EngineDef[]=[-1,1].flatMap(side=>[2.1,3.0].map(x=>({pos:[side*x,-0.55,0.5],radius:0.13,length:2.5,segments:8})));
  return {...ship,pods:[...ship.pods??[],...missilePods],armor:[...ship.armor??[],plate(2.55,0,1.5,2.2,-0.4,0.13,'dark',true)],
    palette:{...ship.palette,body:kind==='racer'?0x929c9d:0x80868a,accent:kind==='racer'?0x638381:0x59636e,canopy:0x1c282e}};
}

/** Continuous curved delta and a broad dorsal pyramid, from rear and ventral screen stills. */
export function alkeshGeometry(base:ShipDef):ShipDef {
  const armor:ArmorDef[]=[];
  // A triangular upper shell, rather than a little pyramid placed on an unrelated fighter.
  armor.push({points:[[-8,-7.3],[8,-7.3],[0,8.4]],y:0.7,thickness:3.3,topScale:0.02,slot:'body'});
  for(const side of [-1,1]) for(let i=0;i<5;i++) {
    const z=-5+i*1.8,x=side*(6.6-i*0.72);
    armor.push(plate(x,z,0.18,1.35,0.87,0.04,'accent'));
  }
  return {...base,ringVerts:24,canopyGlow:0.025,
    hull:[{z:-9.3,w:5.0,h:0.48,n:2.5},{z:-8,w:8.8,h:0.8,n:2.8},{z:-5,w:9.3,h:1.25,n:2.8},{z:-1,w:7.8,h:1.6,n:2.8},{z:3,w:5.6,h:1.25,n:2.6},{z:6.8,w:3.1,h:0.8,n:2.5},{z:9.4,w:0.45,h:0.3,n:2.4}],
    panels:[{ring:1,seg:1,depth:0.1,mirror:true},{ring:2,seg:0,depth:0.1,mirror:true},{ring:3,seg:1,depth:0.1,mirror:true}],stripes:[],wings:[],fins:[],armor,
    canopy:{sections:[{z:5.1,w:0.65,h:0.35,n:4,yOff:1.45},{z:4,w:0.8,h:0.4,n:4,yOff:1.6},{z:3.4,w:0.6,h:0.3,n:4,yOff:1.8}],frameBands:[1]},
    engines:[-6.3,-4.7,4.7,6.3].map(x=>({pos:[x,-0.1,-8.1],radius:0.38,length:1.8,segments:12})),
    pods:[{pos:[0,-1.3,0],radius:1.25,length:4,aspect:[1,0.65],segments:16},...[-1,1].map(side=>({pos:[side*0.42,-2,2],radius:0.13,length:3.5,intake:true,segments:8} satisfies EngineDef))],
    hatches:[{pos:[0,-1.58,-3],size:[2.8,4.2],face:'bottom'}],decals:[],
    palette:{body:0x697167,accent:0x899181,dark:0x242c2b,canopy:0x202d31,glow:0x72baff}};
}

/** Long forebody, tall aft bridge and aft side pods, checked against licensed model photos. */
export function prometheusGeometry(base:ShipDef):ShipDef {
  const armor:ArmorDef[]=[
    plate(0,-7,10.6,34,2.6,1.1),
    plate(0,24,8.5,12,1.3,3.0,'body',false,0.7),
    plate(0,-18,9,14,3.7,3.0,'body',false,0.67),
    plate(0,-19,6.3,9,6.7,5.4,'body',false,1.13),
    plate(0,-17.8,8.8,10.5,12.1,2.4,'body',false,0.82),
    plate(0,-19,6.3,7.8,14.5,1.6,'body',false,0.65),
    plate(0,-17.7,8.9,10.6,12.35,0.18,'canopy'),
    plate(0,-10.7,5,3.2,4.0,2.3,'body',false,0.75),
    // Raised shoulder decks on either side of the tower, with layered turret seats.
    plate(9.1,-20,7.8,15,4.5,1.6,'body',true),
    plate(9.1,-19,6.2,11.5,6.1,0.8,'accent',true),
    plate(9.1,-18.5,4.5,7.5,6.9,1.0,'body',true),
    // Narrow structural booms connect the lower side pods to the hull.
    plate(7.6,-10,7.5,3,-1.4,1.2,'dark',true),
  ];
  // Bridge window courses and inset roof channels break up the large clean faces.
  for(const y of [8.1,9.6,12.8,13.45]) for(const x of [-2.4,-1.6,-0.8,0,0.8,1.6,2.4])
    armor.push(plate(x,y<12?-14.45:-12.7,0.35,0.1,y,0.16,'canopy'));
  for(const z of [-6,0,6,12]) {
    armor.push(plate(4.65,z,0.7,4,0.7,0.65,'accent',true));
    armor.push(plate(2.6,z,1.3,3.5,z<10?3.72:2.82,0.1,'accent',true));
  }
  for(const z of [-23,-18,-13]) armor.push(plate(11.2,z,3.3,3.2,-0.6,0.14,'body',true));
  return {...base,canopyGlow:0.015,ringVerts:16,
    hull:[{z:-33,w:4.8,h:2.3,n:6},{z:-29,w:5.5,h:2.8,n:6},{z:-13,w:5.3,h:2.7,n:6},{z:8,w:4.8,h:2.5,n:6},{z:19,w:4.7,h:2.3,n:6},{z:29,w:5.9,h:1.9,n:5},{z:34,w:5.2,h:1.2,n:5}],
    wings:[],fins:[],armor,stripes:[{seg:2,ringFrom:1,ringTo:5,mirror:true}],panels:[{ring:2,seg:0,depth:0.23,mirror:true},{ring:3,seg:0,depth:0.23,mirror:true}],
    engines:[-3.2,3.2].map(x=>({pos:[x,0,-33.7],radius:1.35,length:3.2,aspect:[1.4,1],boxiness:6,segments:16})),
    pods:[...[-1,1].map(side=>({pos:[side*10.5,-2,-16],radius:2.1,length:20,aspect:[1.25,0.78],boxiness:7,segments:16,intake:true} satisfies EngineDef)),
      ...[-1,1].flatMap(side=>[-2,5].map(z=>({pos:[side*5.4,-0.65,z],radius:0.21,length:2.8,segments:8} satisfies EngineDef)))],
    hatches:[...[-19,-12,-5,2,9,16].map(z=>({pos:[5.12,0.1,z] as Vec3,size:[0.7,3.2] as [number,number],face:'port' as const,mirror:true})),{pos:[0,2.83,0],size:[1.2,24],face:'top'}],
    decals:[],palette:{...base.palette,body:0x899095,accent:0x626a70,canopy:0x26343e}};
}
