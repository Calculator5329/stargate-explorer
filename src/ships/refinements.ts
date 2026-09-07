import type { AirfoilDef, ArmorDef, EngineDef, ShipDef } from '@/ships/defs';

/** Bevelled plates share the builder's existing material batches. */
function plate(x: number, z: number, w: number, l: number, y: number, t = 0.08, slot: ArmorDef['slot'] = 'body', mirror = true): ArmorDef {
  const c = Math.min(w, l) * 0.12;
  return { points: [[x-w/2+c,z-l/2],[x+w/2-c,z-l/2],[x+w/2,z-l/2+c],[x+w/2,z+l/2-c],[x+w/2-c,z+l/2],[x-w/2+c,z+l/2],[x-w/2,z+l/2-c],[x-w/2,z-l/2+c]], y, thickness:t, topScale:Math.max(0.7,1-t/Math.min(w,l)), slot, mirror };
}

export function fighterRevision(base: ShipDef): ShipDef {
  return { ...base, canopyGlow:0.04,
    wings:base.wings.map(w=>({...w,span:w.span*1.18})),
    // Keep the selected Facet panels, restore circular intakes and reduce the extra tail fins.
    engines: base.engines.map(e => ({ ...e, radius:0.76, aspect:[1,1], boxiness:2, segments:16 })),
    fins: base.fins.map((f,i) => i < 2 ? {...f,root:[Math.sign(f.root[0])*(1.05+(Math.abs(f.root[0])-1.05)*1.18),f.root[1],f.root[2]]} : {...f,height:0.95,rootChord:1.5,tipChord:0.5}),
    pods: [...base.pods ?? [],
      ...[-1,1].flatMap(side => [3.3,4.4].map(x => ({pos:[side*x,-0.48,-3.8],radius:0.16,length:3.1,segments:8} satisfies EngineDef)))],
    armor: [...(base.armor ?? []).map(a=>({...a,points:a.points.map(([x,z])=>[Math.abs(x)>=2.8?Math.sign(x)*(1.05+(Math.abs(x)-1.05)*1.18):x,z] as [number,number])})),
      plate(3.3,-3.7,0.35,1.3,-0.53,0.3,'dark'), plate(4.4,-4.4,0.35,1.3,-0.53,0.3,'dark')],
    palette: {...base.palette,body:0x92989c,accent:0x606770,canopy:0x17232b},
  };
}

/** Connected stations describe the glider's falling crescent in both plan and front view. */
export function gliderRevision(base: ShipDef): ShipDef {
  const stations = [
    {x:0.85,y:-0.12,le:2.65,chord:4.8},
    {x:2.4,y:-0.32,le:3.0,chord:3.6},
    {x:3.9,y:-0.9,le:2.8,chord:2.8},
    {x:5.3,y:-1.85,le:1.85,chord:1.7},
    {x:6.4,y:-3.0,le:0.15,chord:0.65},
    {x:6.8,y:-3.7,le:-1.25,chord:0.12},
  ];
  const wings: AirfoilDef[] = stations.slice(0,-1).map((a,i) => {
    const b = stations[i+1]!;
    return {root:[a.x,a.y,a.le-a.chord/2],span:Math.hypot(b.x-a.x,b.y-a.y),rootChord:a.chord,tipChord:b.chord,sweep:a.le-b.le,dihedral:Math.atan2(b.y-a.y,b.x-a.x),thickness:0.23-i*0.035};
  });
  return { ...base, canopyGlow:0.025, wings,
    hull:base.hull.map(s=>({...s,z:s.z*0.77,w:s.w*1.2})),
    ...(base.canopy ? {canopy: {...base.canopy,sections:base.canopy.sections.map(s=>({...s,w:s.w*1.35,h:s.h*0.88}))}} : {}),
    // Long staff cannons under the inner wings, rather than an unarmed bird silhouette.
    pods: [-1,1].map(side=>({pos:[side*2.75,-0.9,2.25],radius:0.19,length:3.4,intake:true,segments:10})),
    engines:base.engines.map(e=>({...e,pos:[e.pos[0],e.pos[1],-2.6],length:1.8,radius:0.3})),
    armor:[plate(0,0.0,0.5,2.6,0.82,0.08,'accent',false)],
    palette:{body:0x74756b,accent:0x8a7956,dark:0x25282a,glow:0xffb46b,canopy:0x282c2e},
  };
}

export function bomberRevision(base: ShipDef): ShipDef {
  return { ...base, canopyGlow:0.03,
    // Saucer-like shoulder, pointed bow and central pyramid: the Al'kesh read.
    hull:[{z:-9.4,w:3.6,h:0.65,n:2.7},{z:-7.4,w:6.8,h:1.25,n:2.7},{z:-3.8,w:7.4,h:1.65,n:2.7},{z:0,w:6.2,h:1.55,n:2.7},{z:4,w:4.3,h:1.1,n:2.6},{z:8,w:2.0,h:0.62,n:2.5},{z:10,w:0.16,h:0.15,n:2.4}],
    stripes:[], panels:[{ring:1,seg:0,depth:0.14,mirror:true},{ring:2,seg:1,depth:0.12,mirror:true},{ring:4,seg:0,depth:0.12,mirror:true}],
    canopy: {sections:[{z:-3.3,w:1.8,h:0.4,n:3,yOff:2},{z:-1.9,w:2.5,h:0.45,n:3,yOff:2},{z:0,w:1.1,h:0.25,n:3,yOff:2}],frameBands:[1]},
    wings:[{root:[5.3,-0.4,-2.8],span:4.5,rootChord:9.5,tipChord:1.1,sweep:6.9,dihedral:-0.15,thickness:0.8}],
    armor:[
      {points:[[-3.3,-5.7],[3.3,-5.7],[3.3,0.9],[-3.3,0.9]],y:1.35,thickness:0.45,slot:'accent'},
      {points:[[-3.2,-5.6],[3.2,-5.6],[3.2,0.8],[-3.2,0.8]],y:1.8,thickness:3.5,topScale:0.015,slot:'body'},
      plate(4.6,-4.4,1.3,4.1,1.35,0.13,'accent'),
      plate(2.8,3.1,0.5,3.8,0.98,0.1,'accent'),
    ],
    fins:[],
    engines:[-5.1,-2.1,2.1,5.1].map(x=>({pos:[x,-0.15,-8.0],radius:0.57,length:2.4,aspect:[1,0.82],segments:12})),
    pods:[{pos:[0,-1.8,1],radius:0.85,length:2,aspect:[1,0.8],segments:12},...[-1,1].map(s=>({pos:[s*0.48,-2.1,2.4],radius:0.16,length:3.2,intake:true,segments:8} satisfies EngineDef))],
    hatches:[{pos:[0,-1.65,-2.2],size:[1.6,2.2],face:'bottom'}],
    palette:{body:0x797c70,accent:0x97947b,dark:0x292d2c,glow:0x87bfff,canopy:0x252f36},
  };
}

export function carrierRevision(base: ShipDef): ShipDef {
  const armor = [...base.armor ?? []];
  // Smaller layered plates and repeated ribbing make a large hull read at ship scale.
  for(const z of [-25,-20,-15,-10]) {
    armor.push(plate(4.7,z,1.45,3.5,3.75,0.24,'body'));
    armor.push(plate(6.25,z,1.0,0.55,-1.4,3.0,'body'));
  }
  for(const z of [5,10,15,20]) armor.push(plate(10.2,z,7.0,3.7,3.92,0.12,'body'));
  armor.push(plate(0,28,3.0,5.5,3.12,0.12,'body',false));
  return {...base,canopyGlow:0.02,armor,
    // The strong cyan bars made the hangars look like solid engines facing forward.
    decals:base.decals.map(d=>({...d,size:d.size[0]>6?[d.size[0],0.13]:d.size})),
    palette:{...base.palette,body:0x899095,accent:0x606970,canopy:0x263943},
  };
}

/** Original gameplay hulls stay original; borrow construction details, not invented canon names. */
export function auxiliaryRevision(base: ShipDef, kind: 'heavy'|'dart'|'lancer'|'interceptor'|'gunboat'|'racer'): ShipDef {
  const armor = [...base.armor ?? []];
  const engines = base.engines.map(e=>({...e}));
  let palette = {...base.palette};
  if(kind==='heavy') {
    armor.push(plate(1.75,-3,0.9,4.0,0.84,0.1),plate(4.5,-5.2,1.2,2.6,-0.15,0.16));
    palette={...palette,accent:0x68717a};
  } else if(kind==='dart') {
    armor.push(plate(0,-2.1,0.6,1.7,0.67,0.09,'accent',false));
    armor.push({points:[[1.2,-0.4],[3.95,0.7],[3.95,-0.1],[1.2,-1.5]],y:-0.12,thickness:0.12,slot:'body',mirror:true});
    palette={...palette,accent:0x737e87};
  } else if(kind==='lancer') {
    armor.push(plate(1.5,-2.5,0.8,3.2,1.06,0.14),plate(4.0,0.3,1.0,3.6,-0.6,0.65,'accent'));
    palette={...palette,accent:0x626c76};
  } else if(kind==='interceptor') {
    armor.push(plate(0,-0.5,0.28,1.2,0.38,0.1,'accent',false));
    palette={...palette,body:0x74756b,accent:0x978258};
  } else if(kind==='gunboat') {
    for(const x of [3.6,6.7]) for(const z of [-5,-0.6,4]) armor.push(plate(x,z,1.6,3.5,0.99,0.16,'body'));
    armor.push(plate(0,-1.2,3.5,5.2,3.12,0.2,'accent',false));
    palette={...palette,body:0x686b60,accent:0x8f805d,glow:0xffb46b};
  } else {
    // Civilian racer: retain its mint livery and distinct outriggers.
    for(const x of [-2.92,2.92]) armor.push(plate(x,-0.5,0.6,3.6,0.83,0.1,'body',false));
    palette={...palette,body:0xc7c9c1,accent:0x4c8a82};
  }
  return {...base,canopyGlow:0.04,armor,engines,palette};
}
