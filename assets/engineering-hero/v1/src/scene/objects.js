import * as THREE from 'three';
import { box, cylinder, ring, tube, wire } from './materials.js';
function electron(group,mat,radius=.065){const o=new THREE.Mesh(new THREE.SphereGeometry(radius,12,8),mat);group.add(o);return o;}
function battery(group,m) {
  group.scale.setScalar(.85);
  const assembly=new THREE.Group();group.add(assembly);assembly.rotation.set(.10,-.35,.05);
  const coords=[[0,0],[-.68,0],[.68,0],[-.34,-.59],[.34,-.59],[-.34,.59],[.34,.59]];
  coords.forEach(([x,z],i)=>{
    cylinder(assembly,m.dark,.286,2.18,x,-.05,z);
    cylinder(assembly,m.metal,.292,.12,x,1.07,z);cylinder(assembly,m.metal,.292,.11,x,-1.12,z);
    cylinder(assembly,i%2?m.blue:m.orange,.19,.055,x,1.15,z);
    const band=ring(assembly,i%2?m.blue:m.orange,.291,.015,x,.50,z);band.rotation.x=Math.PI/2;
    box(assembly,m.white,.035,.32,.024,x,.80,z+.29);
  });
  box(assembly,m.metal,1.93,.075,.10,0,1.28,0);
  const shell=box(assembly,m.glass,2.25,2.65,1.75,0,0,0,.22);shell.material=m.glass.clone();shell.material.roughness=.2;shell.material.transmission=.96;shell.material.thickness=.12;
  const orbital=ring(group,m.blue,1.96,.016);orbital.rotation.set(.40,.55,.08);orbital.scale.y=.82;
  const orbit2=ring(group,m.orange,2.15,.012);orbit2.rotation.set(-.5,.82,-.4);
  const packets=[electron(group,m.orange),electron(group,m.blue),electron(group,m.orange)];
  wire(group,[[-2.13,-1.45,0],[-2.13,1.42,0],[-1.78,1.42,0]],'#6a8097',.45);
  return t=>{
    assembly.rotation.y=-.35+.10*Math.sin(t*.4);orbital.rotation.z=.08+.1*Math.sin(t*.5);
    packets.forEach((o,i)=>{const a=t*.72+i*2.094;o.position.set(Math.cos(a)*2.12,Math.sin(a)*1.62,Math.sin(a+.5)*.95);});
  };
}
function racks(group,m){
  const assembly=new THREE.Group();assembly.rotation.set(.08,-.37,0);group.add(assembly);const leds=[];
  [-1.13,0,1.13].forEach((x,j)=>{
    box(assembly,m.dark,.94,2.65,.9,x,-.04,0,.06);
    box(assembly,m.metal,.98,.075,.97,x,1.33,0);box(assembly,m.metal,.98,.075,.97,x,-1.39,0);
    for(let k=0;k<7;k++){
      box(assembly,m.metal,.78,.255,.06,x,1.02-k*.34,.49,.025);
      box(assembly,m.dark,.64,.16,.04,x,1.02-k*.34,.54,.01);
      for(let b=0;b<4;b++)box(assembly,m.dark,.04,.08,.02,x-.25+b*.13,1.02-k*.34,.57);
      const led=box(assembly,(k+j)%3===0?m.orange:m.blue,.035,.09,.02,x+.30,1.02-k*.34,.58);leds.push(led);
    }
    tube(assembly,[[x,1.5,0],[x,1.84,0],[0,1.84,0],[0,2.15,0]],j===1?m.orange:m.blue,.026);
  });
  box(assembly,m.glass,3.92,.50,1.30,0,-1.63,0,.10);
  const halo=ring(group,m.blue,2.22,.015,0,-1.75,0);halo.rotation.x=Math.PI/2;halo.scale.y=.75;
  const pulse=electron(assembly,m.orange,.075);
  return t=>{assembly.rotation.y=-.37+.10*Math.sin(t*.32);pulse.position.set(Math.sin(t*.7)*1.13,1.85,0);
    leds.forEach((o,i)=>{o.scale.y=.70+.30*Math.sin(t*2.3+i*.9);});};
}
function acceptance(group,m){
  const assembly=new THREE.Group();assembly.rotation.set(.09,-.40,0);group.add(assembly);
  box(assembly,m.dark,3.9,1.90,1.75,0,-.43,0,.10);
  box(assembly,m.metal,4.01,.09,1.85,0,.57,0);box(assembly,m.metal,4.05,.12,1.91,0,-1.46,0);
  for(let i=0;i<8;i++){
    const x=-1.72+i*.49;box(assembly,m.metal,.43,1.72,.025,x,-.45,.90,.018);
    box(assembly,m.dark,.33,1.52,.035,x,-.43,.922,.012);
    for(let j=0;j<6;j++)box(assembly,m.metal,.23,.019,.02,x,.12-j*.095,.95);
    box(assembly,i<5?m.green:m.orange,.04,.12,.026,x+.10,-.99,.961);
  }
  const plate=box(assembly,m.glass,1.27,.47,.12,0,.93,.50,.08);
  const shield=new THREE.Group();shield.position.set(.65,1.70,1);assembly.add(shield);
  const shape=new THREE.Shape();shape.moveTo(0,.54);shape.lineTo(.48,.30);shape.lineTo(.40,-.22);shape.lineTo(0,-.58);shape.lineTo(-.4,-.22);shape.lineTo(-.48,.30);shape.closePath();
  const shieldMesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.08,bevelEnabled:true,bevelSegments:2,bevelSize:.035,bevelThickness:.025,steps:1}),m.dark);shield.add(shieldMesh);
  tube(shield,[[-.48,.3,.14],[0,.54,.14],[.48,.3,.14],[.4,-.22,.14],[0,-.58,.14],[-.4,-.22,.14],[-.48,.3,.14]],m.green,.022);
  tube(shield,[[-.20,0,.18],[-.045,-.17,.18],[.24,.18,.18]],m.green,.035);
  const orbit=ring(group,m.green,2.26,.012,0,-1.70,0);orbit.rotation.x=Math.PI/2;orbit.scale.y=.60;
  return t=>{assembly.rotation.y=-.40+.08*Math.sin(t*.3);shield.position.y=1.64+.07*Math.sin(t*.8);plate.position.y=.94+.035*Math.sin(t*.65);};
}
function gridIsland(group,m){
  const island=new THREE.Group();island.rotation.set(.19,-.42,0);group.add(island);
  box(island,m.dark,4.55,.20,3.55,0,-1.63,0,.16);
  box(island,m.metal,4.58,.035,3.58,0,-1.51,0,.14);
  // Turbine: stationary tower, analytic rotor rotation about its front-facing hub.
  const tower=new THREE.Mesh(new THREE.CylinderGeometry(.065,.12,2.30,16),m.white);tower.position.set(-1.48,-.36,-.78);island.add(tower);
  const rotor=new THREE.Group();rotor.position.set(-1.48,.86,-.59);island.add(rotor);
  electron(rotor,m.orange,.11);
  for(let j=0;j<3;j++){
    const blade=new THREE.Shape();blade.moveTo(-.048,.09);blade.lineTo(.035,.96);blade.lineTo(.15,.40);blade.lineTo(.105,.13);blade.closePath();
    const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(blade,{depth:.035,bevelEnabled:false}),m.white);mesh.rotation.z=j*Math.PI*2/3;rotor.add(mesh);
  }
  // Solar cells on an inclined support.
  const solar=new THREE.Group();solar.position.set(-.7,-.88,1.00);solar.rotation.x=-.36;island.add(solar);
  box(solar,m.dark,1.57,.89,.08,0,0,0,.04);
  for(let x=0;x<4;x++)for(let y=0;y<3;y++)box(solar,m.solar,.335,.242,.022,-.56+x*.373,-.28+y*.28,.057);
  box(island,m.dark,1.02,1.34,1.06,.62,-.82,-.63,.07);
  for(let i=0;i<4;i++){box(island,m.metal,.18,1.14,.025,.29+i*.22,-.81,-.084,.015);box(island,m.green,.09,.05,.025,.29+i*.22,-.31,-.064);}
  box(island,m.dark,.78,.99,.78,1.46,-1.0,.94,.06);
  for(let i=0;i<3;i++)for(let j=0;j<2;j++)box(island,m.orange,.10,.13,.025,1.24+i*.21,-.75-j*.29,1.342);
  const nodes=[[-1.48,-1.38,-.78],[-.68,-1.38,.95],[.62,-1.38,-.63],[1.46,-1.38,.94]];
  const routes=[[nodes[0],[-1,-1.38,-.1],[.62,-1.38,-.1],nodes[2]],
    [nodes[1],[.12,-1.38,.95],[.12,-1.38,-.63],nodes[2]],
    [nodes[2],[1.46,-1.38,-.63],nodes[3]]];
  const curves=routes.map((p,i)=>{tube(island,p,i===2?m.orange:m.blue,.021);return new THREE.CatmullRomCurve3(p.map(v=>new THREE.Vector3(...v)),false,'catmullrom',.10);});
  const packets=curves.map((_,i)=>electron(island,i===2?m.orange:m.blue,.062));
  const orbit=ring(group,m.orange,2.45,.012,0,-1.8,0);orbit.rotation.x=Math.PI/2;orbit.scale.y=.68;
  return t=>{island.rotation.y=-.42+.06*Math.sin(t*.37);rotor.rotation.z=-t*.85;packets.forEach((o,i)=>o.position.copy(curves[i].getPoint(((t*.22+i*.31)%1+1)%1)));};
}
export function createHeroObject(index,group,materials) {
  return [battery,racks,acceptance,gridIsland][index](group,materials);
}
