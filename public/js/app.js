// ═══════════════════════════════════════════════════════════
//  GREEN H2 PLANT DIGITAL TWIN — ENGINE
// ═══════════════════════════════════════════════════════════
const T = {};  // public namespace for buttons

const canvas = document.getElementById('c');
const W=()=>innerWidth, H=()=>innerHeight;
const renderer = new THREE.WebGLRenderer({canvas,antialias:true,logarithmicDepthBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(W(),H());
renderer.shadowMap.enabled=true;

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x080e1a);
scene.fog=new THREE.FogExp2(0x080e1a,0.0015);
const camera=new THREE.PerspectiveCamera(46,W()/H(),0.5,2000);

// ---- Lights (day/night switchable) ----
const sun=new THREE.DirectionalLight(0xfff3d0,1.1);
sun.position.set(120,250,100);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
['left','right','top','bottom'].forEach((k,i)=>sun.shadow.camera[k]=[-220,220,220,-220][i]);
scene.add(sun);
const amb=new THREE.AmbientLight(0x5a6e99,0.65);scene.add(amb);
const hemi=new THREE.HemisphereLight(0x7080aa,0x2a4030,0.4);scene.add(hemi);
const h2fill=new THREE.PointLight(0x3b82f6,1.2,110);h2fill.position.set(-15,10,30);scene.add(h2fill);

// site lights (visible at night)
const siteLights=[];
[[125,100],[70,150],[200,150],[70,40],[200,40],[236,66]].forEach(([x,y])=>{
  const pl=new THREE.PointLight(0xffd27a,0,60);
  pl.position.set(x-125,14,-(y-100));
  scene.add(pl); siteLights.push(pl);
});

const P=(x,y,z=0)=>new THREE.Vector3(x-125,z,-(y-100));

// ---- Materials ----
function mat(c,r=.6,m=0){return new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});}
const M={
  ground:mat(0x1a2618,1),road:mat(0x252d3a,.95),bldg:mat(0xb0b8c2,.65),
  dark:mat(0x2e3d52,.5,.35),steel:mat(0x7a8290,.4,.75),wind:mat(0xedf0f3,.3),
  solar:mat(0x1e3a8a,.2,.8),frame:mat(0x64748b,.45,.65),
  glass:new THREE.MeshStandardMaterial({color:0x38bdf8,roughness:.05,metalness:.7,transparent:true,opacity:.55}),
  h2:mat(0x1d4ed8,.25,.6),
  h2glow:new THREE.MeshStandardMaterial({color:0x2563eb,emissive:0x1e40af,emissiveIntensity:.9,roughness:.25}),
  o2:mat(0xd4d8dc,.4,.5),water:mat(0x0d9488,.35,.4),
  heat:new THREE.MeshStandardMaterial({color:0xea580c,emissive:0xc2410c,emissiveIntensity:.4,roughness:.4}),
  elec:new THREE.MeshStandardMaterial({color:0xca8a04,emissive:0x92400e,emissiveIntensity:.5,roughness:.4}),
  bess:mat(0x78450f,.55),red:mat(0xb91c1c,.5),cool:mat(0x3d5566,.7),
};

// ---- geometry helpers ----
const pickables=[],ZONES={};
const flowMeshes=[],pipeMeshes=[];
function addPick(m,z){if(z){m.userData.zone=z;pickables.push(m);}}
function box(w,d,h,x,y,z,mt,zone){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mt);m.position.copy(P(x,y,z+h/2));m.castShadow=m.receiveShadow=true;addPick(m,zone);scene.add(m);return m;}
function cyl(r,h,x,y,z,mt,zone,ax){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r*.94,h,20),mt);if(ax==='x')m.rotation.z=Math.PI/2;if(ax==='z')m.rotation.x=Math.PI/2;m.position.copy(P(x,y,ax?z:z+h/2));m.castShadow=m.receiveShadow=true;addPick(m,zone);scene.add(m);return m;}
function pipe(pts,r,mt,zone){const v=pts.map(([x,y,z])=>P(x,y,z??5));const cv=new THREE.CatmullRomCurve3(v);const g=new THREE.TubeGeometry(cv,Math.max(8,pts.length*4),r,8,false);const m=new THREE.Mesh(g,mt);addPick(m,zone);scene.add(m);pipeMeshes.push(m);return cv;}
function arrow(p1,p2,s,mt){const d=new THREE.Vector3().subVectors(p2,p1).normalize();const c=new THREE.Mesh(new THREE.ConeGeometry(s,s*2.5,12),mt);c.position.copy(new THREE.Vector3().addVectors(p2,d.clone().multiplyScalar(-s*1.5)));c.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d);scene.add(c);flowMeshes.push(c);}

// ═══════════════════════════════════════════════
//  BUILD PLANT (compact)
// ═══════════════════════════════════════════════
box(252,202,.4,125,100,-.2,M.ground);
[[125,5],[125,195]].forEach(([x,y])=>box(244,6,.3,x,y,0,M.road));
[[5,100],[245,100]].forEach(([x,y])=>box(6,188,.3,x,y,0,M.road));
box(230,6,.3,125,97,0,M.road);box(6,180,.3,122,100,0,M.road);

ZONES.solar='Solar Farm — 4.0 MWp bifacial, 20° tilt. Daily 19,200 kWh';
for(let r=0;r<8;r++)for(let c=0;c<6;c++){const x=19+c*9.5,y=112+r*8.5;const pm=new THREE.Mesh(new THREE.BoxGeometry(8,.12,3),M.solar);pm.position.copy(P(x,y,1.8));pm.rotation.x=.35;pm.userData.zone='solar';pm.castShadow=true;pickables.push(pm);scene.add(pm);cyl(.1,1.5,x,y,0,M.frame);}

ZONES.wind='Wind Turbine — 1 MW, 80m hub, 60m rotor. 3 units, daily 21,600 kWh';
const rotors=[];[62,84,106].forEach(x=>{cyl(1.2,58,x,168,0,M.wind,'wind');box(5,2.5,2.5,x,168,58,M.wind,'wind');const rg=new THREE.Group();rg.position.copy(P(x,166.5,59));rg.add(new THREE.Mesh(new THREE.SphereGeometry(1.1,12,12),M.frame));for(let i=0;i<3;i++){const bl=new THREE.Mesh(new THREE.BoxGeometry(.5,20,1.2),M.wind);bl.position.y=10.5;const a=new THREE.Group();a.rotation.z=i*2.094;a.add(bl);rg.add(a);}scene.add(rg);rotors.push(rg);});

ZONES.bess='BESS — 4× LiFePO₄, 12.5 MWh / 2.5 MW, 10 MWh usable';
for(let i=0;i<4;i++){box(8,18,3.2,137+i*10,168,0,M.bess,'bess');box(8,18,.2,137+i*10,168,3.2,M.elec);}

ZONES.substation='Substation — 33kV/0.4kV transformer, rectifiers for DC supply';
box(35,25,5.5,152,137,0,M.steel,'substation');for(let i=0;i<3;i++)cyl(.45,4,142+i*8,137,5.5,M.steel);

ZONES.control='AI Control Centre — 9 AI modules, SCADA, SIS, OPC UA server';
box(46,29,8,207,169,0,M.bldg,'control');const gf=new THREE.Mesh(new THREE.BoxGeometry(46,5,.3),M.glass);gf.position.copy(P(207,155.5,4));gf.userData.zone='control';pickables.push(gf);scene.add(gf);box(48,31,.6,207,169,8,M.steel);

ZONES.wtp='Water Treatment — MMF→ACF→2-pass RO→EDI→UV. 416 L/h DM water <0.1 µS/cm';
box(40,30,6.5,35,70,0,M.dark,'wtp');
ZONES.dmtank='DM Water Tank — 5 m³ SS316L, N₂ blanketed, LT-601 radar level';
cyl(3,8.5,68,70,0,M.water,'dmtank');
ZONES.hx='HX-01 — Plate HX, recovers 200-300 kW, preheats feed 15→50°C, +2-3% efficiency';
cyl(1.1,9,87,73,1.5,M.heat,'hx','x');cyl(1.1,9,87,68,1.5,M.heat,'hx','x');box(3,3,8,87,70,0,M.steel);

ZONES.electrolyzer='PEM Electrolyzer — 2×1.1 MW stacks, 30 bar, 52 kWh/kg, 467 Nm³/h, turndown 5-100%';
box(56,34,9,127,71,0,M.dark,'electrolyzer');box(58,36,.5,127,71,9,M.steel);
box(11,9,6.5,109,54,0,M.h2glow,'electrolyzer');box(11,9,6.5,131,54,0,M.h2glow,'electrolyzer');

ZONES.separator='Gas-Liquid Separator — removes entrained water from wet H₂';
cyl(2,8,175,71,0,M.steel,'separator');cyl(2.4,1.5,175,71,8,M.steel);
ZONES.deox='Catalytic Deoxidiser — Pd catalyst, O₂ recombination, <1 ppm O₂ out';
box(14,8,9,197,71,0,M.dark,'deox');
ZONES.dryer='PSA Dryer — twin-tower molecular sieve, dewpoint <-65°C, <5 ppm moisture';
box(8,8,11,215,75,0,M.dark,'dryer');box(8,8,11,215,67,0,M.dark,'dryer');
ZONES.compressor='H₂ Compressor — 3-stage oil-free diaphragm, 30→200/350 bar, 180 kW';
box(36,28,7.5,207,69,0,M.dark,'compressor');for(let i=0;i<3;i++)cyl(2,4,196+i*9,69,3,M.steel,'compressor');
ZONES.h2storage='H₂ Storage — 3 banks × 2 vessels, 200 bar, 500 kg, PRV+burst disc';
for(let r=0;r<3;r++)for(let c=0;c<2;c++)cyl(1.35,9,232+c*7,66,1.8+r*3.2,M.h2,'h2storage','z');box(18,11,.5,235,66,0,M.steel);
[[226,60],[246,60],[226,72],[246,72]].forEach(([x,y])=>cyl(.18,2.8,x,y,0,M.frame));
ZONES.o2system='O₂ System — 2-stage comp 2→15 bar, 2×10 m³ storage, CGA G-4.1 clean';
box(20,16,4,200,37,0,M.steel,'o2system');cyl(2.7,7,231,37,0,M.o2,'o2system');cyl(2.7,7,243,37,0,M.o2,'o2system');
ZONES.cooling='Cooling Tower — FRP induced-draft, 580 kW, 50 m³/h, 25/35°C';
cyl(8,12,210,20,0,M.cool,'cooling');cyl(6.5,2,210,20,12,M.cool);
const fanG=new THREE.Group();fanG.position.copy(P(210,20,13.5));for(let i=0;i<4;i++){const b=new THREE.Mesh(new THREE.BoxGeometry(12,.18,1.4),M.wind);b.rotation.y=i*Math.PI/4;fanG.add(b);}scene.add(fanG);
ZONES.dispatch='Dispatch — tube trailer loading 350 bar, cylinder filling, weighbridge';
box(46,26,.3,150,32,0,M.road,'dispatch');box(3.5,2.8,3.2,134,38,0,M.red,'dispatch');box(11,2.5,.6,142,38,.6,M.steel,'dispatch');for(let i=0;i<3;i++)cyl(.4,10,142,37.2+i*.9,1.8,M.h2,'dispatch','z');box(16,16,.4,162,32,5.5,M.steel);[[156,26],[168,26],[156,38],[168,38]].forEach(([x,y])=>cyl(.22,5.5,x,y,0,M.frame));
ZONES.fire='Fire Protection — 200 m³ tank, deluge, FM-200 in control room';
cyl(5.5,9,26,30,0,M.red,'fire');box(20,14,4.5,48,30,0,M.bldg);
ZONES.vent='Vent Stack — 15m SS316L, PSV relief, flame arrester, NE downwind';
cyl(.55,16,238,105,0,M.steel,'vent');cyl(.9,.6,238,105,16,M.steel);
box(28,19,5.5,79,31,0,M.bldg);
for(let x=0;x<=250;x+=20){cyl(.12,2.4,x,0,0,M.frame);cyl(.12,2.4,x,200,0,M.frame);}
for(let y=0;y<=200;y+=20){cyl(.12,2.4,0,y,0,M.frame);cyl(.12,2.4,250,y,0,M.frame);}

// ═══════════════════════════════════════════════
//  PROCESS PIPING
// ═══════════════════════════════════════════════
pipe([[68,70,5],[80,70,5],[80,70,2],[87,70,2]],.3,M.water,'dmtank');
pipe([[87,70,2],[100,70,2],[100,65,2],[120,65,2]],.3,M.heat,'hx');
pipe([[152,137,3],[152,100,3],[127,100,3],[127,87,3]],.35,M.elec,'substation');
pipe([[155,71,6],[165,71,6],[175,71,6]],.45,M.h2glow,'electrolyzer');
pipe([[175,71,7],[186,71,7]],.4,M.h2glow,'separator');
pipe([[204,71,7],[208,71,8]],.38,M.h2glow,'deox');
pipe([[215,71,8],[215,69,8],[190,69,8],[190,69,5]],.38,M.h2glow,'dryer');
pipe([[225,69,5],[236,69,5],[236,66,4]],.55,M.h2,'compressor');
pipe([[236,60,4],[236,50,4],[185,50,4],[185,38,4],[162,38,4]],.4,M.h2,'h2storage');
pipe([[127,55,5],[127,45,5],[190,45,5],[190,37,5]],.3,M.o2,'electrolyzer');
pipe([[210,37,4],[220,37,4],[231,37,4]],.3,M.o2,'o2system');
pipe([[210,25,3],[210,55,3],[135,55,3]],.35,M.water,'cooling');
pipe([[120,71,3],[100,71,3],[100,78,3],[87,78,3]],.3,M.heat,'hx');
const ventMat=new THREE.MeshStandardMaterial({color:0x94a3b8,roughness:.6,transparent:true,opacity:.6});
pipe([[207,75,9],[207,85,9],[238,85,9],[238,105,9]],.2,ventMat);
const aiMat=new THREE.MeshStandardMaterial({color:0x06b6d4,emissive:0x0891b2,emissiveIntensity:.8,transparent:true,opacity:.7,roughness:.3});
pipe([[207,155,9],[127,155,9],[127,87,9]],.15,aiMat);
pipe([[230,155,9],[230,80,9]],.15,aiMat);
pipe([[185,165,9],[185,20,9],[210,20,9]],.15,aiMat);

// ═══════════════════════════════════════════════
//  FLOW PARTICLES
// ═══════════════════════════════════════════════
const pSystems=[];
function parts(pts,n,col,spd,sz=.55){const cv=new THREE.CatmullRomCurve3(pts.map(([x,y,z])=>P(x,y,z??5)));const mt=new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:1.2});const ps=[];for(let i=0;i<n;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(sz,8,8),mt);m.userData.t=i/n;scene.add(m);ps.push(m);flowMeshes.push(m);}pSystems.push({cv,ps,spd});}
parts([[130,71,6],[155,71,6],[175,71,6],[186,71,7],[204,71,7],[215,71,8],[215,69,8],[190,69,5]],12,0x93c5fd,.055,.7);
parts([[225,69,5],[236,69,5],[236,66,4]],6,0x60a5fa,.05,.6);
parts([[236,60,4],[236,50,4],[185,50,4],[185,38,4],[162,38,4]],5,0x3b82f6,.04,.5);
parts([[68,70,5],[87,70,2],[100,65,2],[120,65,2]],7,0x22d3ee,.04,.45);
parts([[127,55,5],[127,45,5],[190,45,5],[231,37,4]],5,0xc8ccd0,.035,.4);
parts([[210,25,3],[210,55,3],[135,55,3]],4,0x4ade80,.03,.4);
parts([[120,71,3],[100,78,3],[87,78,3]],4,0xf97316,.03,.4);
parts([[207,155,9],[127,155,9],[127,87,9]],8,0x06b6d4,.12,.35);
parts([[152,137,3],[152,100,3],[127,100,3],[127,87,3]],5,0xfacc15,.08,.4);

// ═══════════════════════════════════════════════
//  SENSOR / INSTRUMENT ICONS  (billboarded sprites)
// ═══════════════════════════════════════════════
// tag => {type, x,y,z(plant), sim key}
const SENSORS=[
  {tag:'TT-201',type:'T',x:127,y:63,z:11,key:'stackT',zone:'electrolyzer'},
  {tag:'PT-201',type:'P',x:160,y:71,z:9,key:'h2P',zone:'electrolyzer'},
  {tag:'FT-201',type:'F',x:170,y:66,z:9,key:'h2Flow',zone:'electrolyzer'},
  {tag:'AT-202',type:'A',x:186,y:76,z:9,key:'o2inh2',zone:'separator'},
  {tag:'AT-301',type:'A',x:215,y:80,z:13,key:'purity',zone:'dryer'},
  {tag:'PT-404',type:'P',x:220,y:69,z:9,key:'compP',zone:'compressor'},
  {tag:'VT-401',type:'V',x:200,y:74,z:8,key:'vib',zone:'compressor'},
  {tag:'PT-501',type:'P',x:236,y:74,z:12,key:'storeP',zone:'h2storage'},
  {tag:'TT-601',type:'T',x:210,y:30,z:14,key:'cwT',zone:'cooling'},
  {tag:'FT-101',type:'F',x:80,y:70,z:7,key:'waterF',zone:'dmtank'},
  {tag:'IT-202',type:'E',x:127,y:78,z:11,key:'current',zone:'electrolyzer'},
  {tag:'AT-101',type:'A',x:52,y:70,z:8,key:'cond',zone:'wtp'},
];
const sensorSprites=[];
function makeSensorSprite(s){
  const cv=document.createElement('canvas');cv.width=cv.height=128;
  const ctx=cv.getContext('2d');
  const colors={T:'#f97316',P:'#3b82f6',F:'#22c55e',A:'#a855f7',V:'#eab308',E:'#facc15'};
  const col=colors[s.type]||'#06b6d4';
  ctx.beginPath();ctx.arc(64,64,40,0,7);ctx.fillStyle='rgba(8,14,26,.85)';ctx.fill();
  ctx.lineWidth=5;ctx.strokeStyle=col;ctx.stroke();
  ctx.fillStyle=col;ctx.font='bold 30px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(s.type,64,52);
  ctx.font='bold 15px system-ui';ctx.fillStyle='#cbd5e1';
  ctx.fillText(s.tag,64,84);
  const tex=new THREE.CanvasTexture(cv);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));
  sp.position.copy(P(s.x,s.y,s.z));
  sp.scale.set(7,7,1);
  sp.userData={sensor:s,baseCol:col};
  scene.add(sp);sensorSprites.push(sp);
  // leader line to equipment
  const lg=new THREE.BufferGeometry().setFromPoints([P(s.x,s.y,s.z-3.5),P(s.x,s.y,s.z)]);
  const ll=new THREE.Line(lg,new THREE.LineBasicMaterial({color:col,transparent:true,opacity:.5}));
  scene.add(ll);sensorSprites.push(ll);
}
SENSORS.forEach(makeSensorSprite);

// live value labels (canvas sprites updated each tick)
const sensorLabels={};
SENSORS.forEach(s=>{
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({transparent:true,depthTest:false}));
  sp.position.copy(P(s.x+6,s.y,s.z));sp.scale.set(11,3,1);
  scene.add(sp);sensorLabels[s.tag]=sp;sensorSprites.push(sp);
});
function updateSensorLabel(tag,val,unit,alarm){
  const sp=sensorLabels[tag];if(!sp)return;
  const cv=document.createElement('canvas');cv.width=256;cv.height=64;
  const ctx=cv.getContext('2d');
  ctx.fillStyle=alarm?'rgba(127,29,29,.9)':'rgba(8,14,26,.8)';
  ctx.strokeStyle=alarm?'#ef4444':'#334155';ctx.lineWidth=2;
  ctx.roundRect(2,2,252,60,10);ctx.fill();ctx.stroke();
  ctx.fillStyle=alarm?'#fecaca':'#e2e8f0';ctx.font='bold 30px system-ui';
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(val+' '+unit,128,32);
  sp.material.map=new THREE.CanvasTexture(cv);sp.material.needsUpdate=true;
}

// ═══════════════════════════════════════════════
//  RELOCATABLE LEAK VISUALIZATION (multi-location)
// ═══════════════════════════════════════════════
function leakTexture(rgb){
  const cv=document.createElement('canvas');cv.width=cv.height=64;const ctx=cv.getContext('2d');
  const g=ctx.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,`rgba(${rgb},.6)`);g.addColorStop(.5,`rgba(${rgb},.28)`);g.addColorStop(1,`rgba(${rgb},0)`);
  ctx.fillStyle=g;ctx.fillRect(0,0,64,64);return new THREE.CanvasTexture(cv);
}
const leakTex={ h2:leakTexture('239,68,68'), o2:leakTexture('226,232,240'), water:leakTexture('74,222,128') };
const leakGroup=new THREE.Group(); scene.add(leakGroup);
const leakParticles=[];
for(let i=0;i<44;i++){
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:leakTex.h2,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
  s.userData={spread:(Math.random()-.5)*4,life:Math.random()};
  s.scale.setScalar(2+Math.random()*3);
  leakGroup.add(s);leakParticles.push(s);
}
leakGroup.visible=false;
const ringGeo=new THREE.RingGeometry(6,7,32);
const ringMat=new THREE.MeshBasicMaterial({color:0xef4444,transparent:true,opacity:.6,side:THREE.DoubleSide});
const leakRing=new THREE.Mesh(ringGeo,ringMat);
leakRing.rotation.x=-Math.PI/2;leakRing.visible=false;scene.add(leakRing);
// relocate + recolor leak visuals to a given leak key
function positionLeak(key){
  if(!key||!LEAKS[key]){leakGroup.visible=false;leakRing.visible=false;return;}
  const L=LEAKS[key];const[px,py,pz]=L.pos;
  leakGroup.position.copy(P(px,py,pz));
  leakRing.position.copy(P(px,py,.3));
  const tex=leakTex[L.fluid];
  const rc = L.fluid==='h2'?0xef4444 : L.fluid==='o2'?0xe2e8f0 : 0x4ade80;
  leakParticles.forEach(s=>{s.material.map=tex;s.material.needsUpdate=true;s.userData.life=Math.random();});
  ringMat.color.setHex(rc);
  leakGroup.visible=true;leakRing.visible=true;
}

// ═══════════════════════════════════════════════
//  ELECTRICITY CABLES + ANIMATED POWER PARTICLES
//  Solar → Battery → Substation → Electrolyzer ; Wind → Battery
// ═══════════════════════════════════════════════
const cableMat=new THREE.MeshStandardMaterial({color:0xca8a04,emissive:0x92610e,emissiveIntensity:.5,roughness:.4,metalness:.3});
// pole route helper for cables (raised on pylons ~z=6)
function cable(pts,r=0.28){return pipe(pts,r,cableMat);}
// Solar farm (~55,145) → BESS (~155,168)
cable([[55,145,6],[100,150,6],[130,168,6],[152,168,6]]);
// Wind farm (~84,168) → BESS
cable([[84,160,6],[110,168,6],[135,168,6]]);
// BESS → Substation (152,137)
cable([[152,168,6],[152,150,6],[152,137,6]]);
// Substation → Electrolyzer (127,71)
cable([[152,137,6],[152,105,6],[127,105,6],[127,87,6]]);

// power flow particle systems (separately tracked so weather can scale intensity)
const powerFlows=[];
function powerParticles(pts,n,col,spd,tag){
  const cv=new THREE.CatmullRomCurve3(pts.map(([x,y,z])=>P(x,y,z??6)));
  const mt=new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:1.6});
  const ps=[];for(let i=0;i<n;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(.5,8,8),mt);m.userData.t=i/n;scene.add(m);ps.push(m);}
  const sys={cv,ps,spd,tag,baseN:n,mat:mt};powerFlows.push(sys);return sys;
}
const pfSolar=powerParticles([[55,145,6],[100,150,6],[130,168,6],[152,168,6]],8,0xfacc15,.09,'solar');
const pfWind =powerParticles([[84,160,6],[110,168,6],[135,168,6]],6,0x38bdf8,.09,'wind');
const pfBattOut=powerParticles([[152,168,6],[152,137,6]],5,0xa78bfa,.09,'battOut');
const pfSub  =powerParticles([[152,137,6],[152,105,6],[127,105,6],[127,87,6]],7,0xfde047,.1,'sub');

// battery glow shell (over BESS containers)
const battGlowMat=new THREE.MeshBasicMaterial({color:0x4ade80,transparent:true,opacity:0.0,side:THREE.BackSide});
const battGlow=new THREE.Mesh(new THREE.BoxGeometry(46,7,22),battGlowMat);
battGlow.position.copy(P(155.5,168,1.6));scene.add(battGlow);
const battLight=new THREE.PointLight(0x4ade80,0,40);battLight.position.copy(P(155.5,168,6));scene.add(battLight);

// ═══════════════════════════════════════════════
//  WEATHER VISUALS — rain, clouds, lightning
// ═══════════════════════════════════════════════
// Rain particle field (points) over site
const rainCount=1400;
const rainGeo=new THREE.BufferGeometry();
const rainPos=new Float32Array(rainCount*3);
for(let i=0;i<rainCount;i++){
  rainPos[i*3]  =(Math.random()-.5)*260;
  rainPos[i*3+1]=Math.random()*120;
  rainPos[i*3+2]=(Math.random()-.5)*220;
}
rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPos,3));
const rainMat=new THREE.PointsMaterial({color:0x93c5fd,size:.9,transparent:true,opacity:.5});
const rain=new THREE.Points(rainGeo,rainMat);rain.visible=false;scene.add(rain);

// Cloud layer (soft sprites drifting high)
const cloudTex=(()=>{const cv=document.createElement('canvas');cv.width=cv.height=128;const ctx=cv.getContext('2d');
  const g=ctx.createRadialGradient(64,64,10,64,64,64);g.addColorStop(0,'rgba(200,210,225,.55)');g.addColorStop(1,'rgba(200,210,225,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return new THREE.CanvasTexture(cv);})();
const clouds=[];
for(let i=0;i<14;i++){
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudTex,transparent:true,opacity:0,depthWrite:false}));
  s.position.set((Math.random()-.5)*260,70+Math.random()*25,(Math.random()-.5)*220);
  s.scale.setScalar(40+Math.random()*40);
  s.userData.drift=.4+Math.random()*.5;
  scene.add(s);clouds.push(s);
}
// Lightning flash light
const lightningLight=new THREE.PointLight(0xdbeafe,0,600);
lightningLight.position.set(0,180,0);scene.add(lightningLight);
let lightningTimer=2+Math.random()*4;

console.log('Plant built. Pickables:',pickables.length,'Sensors:',SENSORS.length,'PowerFlows:',powerFlows.length);

// ═══════════════════════════════════════════════════════════
//  LIVE WEATHER — real data from Open-Meteo (no API key needed)
//  Data © Open-Meteo.com, CC BY 4.0
// ═══════════════════════════════════════════════════════════
const LIVE = {
  on:false,
  data:null,          // {temp, wind10, windHub, irradiance, cloud, precip, isDay, code, time}
  place:'Nagpur',
  lat:21.1458, lon:79.0882,
  status:'off',       // off | loading | ok | error
  lastFetch:0,
  err:null,
  located:false,      // has the user's real location been resolved yet?
  how:'default',      // GPS | network / IP | manual entry | default
};

// Real 1 MW turbine power curve (kW output for a given hub-height wind speed in m/s)
// cut-in 3 m/s · rated 12 m/s · cut-out 25 m/s — standard for a utility turbine
function turbinePower(v){
  if(v<3) return 0;                       // below cut-in
  if(v>=25) return 0;                     // cut-out (safety shutdown)
  if(v>=12) return 1000;                  // rated power
  // cubic power law between cut-in and rated: P ∝ v³
  return Math.round(1000 * Math.pow((v-3)/(12-3), 3) * 0.95);
}

// Extrapolate 10 m wind to 80 m hub height (wind shear power law, α≈0.14 open terrain)
function hubWind(v10){ return v10 * Math.pow(80/10, 0.14); }

// Map Open-Meteo WMO weather code → our internal weather mode + label
function codeToWeather(code, cloud, precip){
  if(code>=95) return {mode:'storm',  label:'🌩 Thunderstorm'};
  if(code>=80 || (precip>0.5)) return {mode:'rainy', label:'🌧 Rain showers'};
  if(code>=51 && code<=67) return {mode:'rainy', label:'🌧 Rain / drizzle'};
  if(code>=71 && code<=79) return {mode:'rainy', label:'🌨 Snow'};
  if(code>=45 && code<=48) return {mode:'cloudy',label:'🌫 Fog'};
  if(cloud>60) return {mode:'cloudy', label:'☁ Cloudy'};
  if(cloud>25) return {mode:'cloudy', label:'⛅ Partly cloudy'};
  return {mode:'sunny', label:'☀ Clear'};
}

async function fetchLiveWeather(){
  LIVE.status='loading'; LIVE.err=null; updateLiveBadge();
  try{
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${LIVE.lat}&longitude=${LIVE.lon}`
      +`&current=temperature_2m,wind_speed_10m,cloud_cover,precipitation,weather_code,is_day,shortwave_radiation`
      +`&timezone=auto`;
    const r=await fetch(url);
    if(!r.ok) throw new Error('HTTP '+r.status);
    const j=await r.json();
    const c=j.current;
    const w10=c.wind_speed_10m/3.6;      // API returns km/h → m/s
    LIVE.data={
      temp:c.temperature_2m,
      wind10:w10,
      windHub:hubWind(w10),
      irradiance:c.shortwave_radiation ?? 0,
      cloud:c.cloud_cover,
      precip:c.precipitation,
      isDay:c.is_day===1,
      code:c.weather_code,
      time:c.time,
      tz:j.timezone,
    };
    LIVE.status='ok'; LIVE.lastFetch=Date.now();
    // drive the twin's visual weather + day/night from reality
    const wmap=codeToWeather(LIVE.data.code, LIVE.data.cloud, LIVE.data.precip);
    LIVE.label=wmap.label;
    applyLiveWeatherVisuals(wmap.mode, LIVE.data);
    pushLog(`🛰 Live data: ${LIVE.place} · ${LIVE.data.temp.toFixed(1)}°C · wind ${LIVE.data.wind10.toFixed(1)} m/s · ${LIVE.data.cloud}% cloud · ${wmap.label}`,'info');
  }catch(e){
    LIVE.status='error'; LIVE.err=e.message;
    pushLog('⚠ Live weather fetch failed ('+e.message+') — reverting to simulation.','warn');
    LIVE.on=false;
    const b=document.getElementById('bLive'); if(b){b.classList.remove('on');b.textContent='🛰 Live Mode';}
  }
  updateLiveBadge();
}

// apply real conditions to the visual layer (rain, clouds, night, storm banner)
function applyLiveWeatherVisuals(mode, d){
  SIM.weather=mode;
  const w=WEATHER[mode];
  // visuals only — solar/wind numbers come from real data, not these multipliers
  SIM.wxTarget={solarMul:w.solarMul, windMul:w.windMul, cloud:d.cloud/100, rain:(d.precip>0.1||mode==='rainy')?1:0, storm:mode==='storm'?1:0};
  rain.visible = SIM.wxTarget.rain>0;
  const banner=document.getElementById('wxBanner');
  if(mode==='storm'){banner.classList.add('show');document.getElementById('wxBannerTxt').textContent='LIVE STORM at '+LIVE.place+' — unstable renewable generation';}
  else banner.classList.remove('show');
  // real day/night
  SIM.dayTarget = d.isDay ? 1 : 0;
  nightOn = !d.isDay;
  document.body.classList.toggle('night', nightOn);
  siteLights.forEach(l=>l.intensity = nightOn?1.5:0);
  const nb=document.getElementById('bNight');
  if(nb){nb.classList.toggle('on',nightOn); nb.textContent=nightOn?'☀ Day':'🌙 Night';}
  // reflect the weather dropdown selection
  document.querySelectorAll('#ddWx .dd-item').forEach(it=>it.classList.toggle('active',it.dataset.wx===mode));
}

function updateLiveBadge(){
  const el=document.getElementById('liveBadge');
  if(!el) return;
  if(!LIVE.on){ el.style.display='none'; return; }
  el.style.display='block';
  const d=LIVE.data;
  if(LIVE.status==='loading'){ el.innerHTML='<b>🛰 Connecting…</b>'; return; }
  if(LIVE.status==='error'){ el.innerHTML='<b style="color:#fca5a5">⚠ Live feed error</b><br><span style="font-size:9px">'+(LIVE.err||'')+'</span>'; return; }
  if(!d) return;
  const age=Math.round((Date.now()-LIVE.lastFetch)/1000);
  el.innerHTML=`
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span class="aix-live-dot"></span><b style="font-size:11px">LIVE · ${LIVE.place}</b>
    </div>
    <div class="lv-row"><span>Condition</span><span>${LIVE.label||''}</span></div>
    <div class="lv-row"><span>Temperature</span><span><b>${d.temp.toFixed(1)} °C</b></span></div>
    <div class="lv-row"><span>Wind (10 m)</span><span><b>${d.wind10.toFixed(1)} m/s</b></span></div>
    <div class="lv-row"><span>Wind (80 m hub)</span><span>${d.windHub.toFixed(1)} m/s</span></div>
    <div class="lv-row"><span>Irradiance</span><span><b>${Math.round(d.irradiance)} W/m²</b></span></div>
    <div class="lv-row"><span>Cloud cover</span><span>${d.cloud}%</span></div>
    <div class="lv-row"><span>Local time</span><span>${(d.time||'').replace('T',' ')}</span></div>
    <div class="lv-row"><span>Daylight</span><span>${d.isDay?'☀ Day':'🌙 Night'}</span></div>
    <div style="margin-top:7px;padding-top:6px;border-top:1px solid #1e293b;font-size:8.5px;color:#475569">
      📍 via ${LIVE.how} · updated ${age}s ago · refresh 10 min<br>Data © Open-Meteo.com (CC BY 4.0)
    </div>`;
}

// ═══════════════════════════════════════════════════════════
//  SIMULATION STATE
// ═══════════════════════════════════════════════════════════
const SIM={
  t:0,
  // renewables (kW)
  solar:0, wind:0, bess:0, load:0, grid:0, aux:330,
  soc:62,             // battery state of charge %
  battState:'idle',   // charging | discharging | idle
  // process sensors
  stackT:68, h2P:30, h2Flow:467, o2inh2:0.4, purity:99.999,
  compP:200, vib:4.2, storeP:185, cwT:35, waterF:416, current:4200, cond:0.08,
  // extra sensors for O2 + cooling leaks
  o2P:15, o2Level:78, cwFlow:50,
  // KPI accumulators
  h2Today:0, o2Today:0,
  // weather
  weather:'sunny',
  // day/night — manual control. daylight 1=full day, 0=night. dayTarget is what the button sets; daylight eases toward it.
  daylight:1, dayTarget:1,
  wx:{solarMul:1.0, windMul:0.6, cloud:0, rain:0, storm:0}, // current (eased)
  wxTarget:{solarMul:1.0, windMul:0.6, cloud:0, rain:0, storm:0},
  // leak: which location (null = none)
  leak:null,
  // equipment health (RUL in days, fault prob %)
  health:{
    'H₂ Compressor':{rul:180,fault:8,trend:-0.04},
    'PEM Stack A':{rul:520,fault:5,trend:-0.02},
    'PEM Stack B':{rul:495,fault:6,trend:-0.02},
    'RO Membrane':{rul:240,fault:12,trend:-0.05},
    'CW Pump 01':{rul:95,fault:22,trend:-0.09},
    'Dryer PSA Valve':{rul:310,fault:7,trend:-0.03},
  },
  alarms:[], maintAlerts:[],
};

// ── Weather presets: renewable multipliers + visual params ──
const WEATHER={
  sunny: {solarMul:1.0,  windMul:0.55, cloud:0.0, rain:0, storm:0, sky:0x080e1a, label:'☀ Sunny'},
  cloudy:{solarMul:0.45, windMul:0.6,  cloud:0.7, rain:0, storm:0, sky:0x1a2230, label:'⛅ Cloudy'},
  rainy: {solarMul:0.15, windMul:0.8,  cloud:0.9, rain:1, storm:0, sky:0x141c28, label:'🌧 Rainy'},
  storm: {solarMul:0.05, windMul:1.0,  cloud:1.0, rain:1, storm:1, sky:0x0a0f1a, label:'🌩 Storm'},
};

// ── Leak configuration per location ──
// fluid: h2 | o2 | water ; pos: plant coords for cloud; sensor effects applied in stepSim
const LEAKS={
  electrolyzer:{fluid:'h2', pos:[127,71,9],  gd:'GD-701', name:'Electrolyzer H₂ leak'},
  separator:   {fluid:'h2', pos:[175,71,8],  gd:'GD-717', name:'H₂ Separator leak'},
  dryer:       {fluid:'h2', pos:[215,71,11], gd:'GD-718', name:'PSA Dryer H₂ leak'},
  compressor:  {fluid:'h2', pos:[207,69,7],  gd:'GD-705', name:'H₂ Compressor leak'},
  h2storage:   {fluid:'h2', pos:[236,66,7],  gd:'GD-707', name:'H₂ Storage leak'},
  o2storage:   {fluid:'o2', pos:[237,37,5],  gd:'GD-O2',  name:'O₂ Storage leak'},
  cooling:     {fluid:'water', pos:[210,20,4],gd:'FT-601', name:'Cooling Water leak'},
};

// time-of-day drives solar; weather modifies renewables; leaks affect local sensors
function stepSim(dt){
  SIM.t+=dt;
  const n=()=>(Math.random()-0.5);

  // ── ease weather params toward target ──
  const wx=SIM.wx, wt=SIM.wxTarget, ez=Math.min(1,dt*0.6);
  wx.solarMul+=(wt.solarMul-wx.solarMul)*ez;
  wx.windMul +=(wt.windMul -wx.windMul )*ez;
  wx.cloud   +=(wt.cloud   -wx.cloud   )*ez;
  wx.rain    +=(wt.rain    -wx.rain    )*ez;
  wx.storm   +=(wt.storm   -wx.storm   )*ez;

  // ── ease day/night toward manual target (dusk→dark ramp) ──
  SIM.daylight += (SIM.dayTarget - SIM.daylight) * Math.min(1, dt*0.5);
  if(Math.abs(SIM.dayTarget-SIM.daylight)<0.005) SIM.daylight=SIM.dayTarget;

  // ── renewables ──
  if(LIVE.on && LIVE.data){
    // ===== REAL WEATHER MODE =====
    // Solar from measured shortwave irradiance: 4 MWp array at 1000 W/m² STC, 85% system derate
    const irr = LIVE.data.irradiance;                       // W/m²
    SIM.solar = Math.round(4000 * Math.min(1.15, irr/1000) * 0.85);
    // Wind from measured hub-height wind speed via a real turbine power curve (3 × 1 MW)
    SIM.wind = Math.round(turbinePower(LIVE.data.windHub) * 3);
    // small live jitter so it doesn't look frozen between 10-min refreshes
    SIM.solar = Math.max(0, Math.round(SIM.solar*(1+0.02*Math.sin(SIM.t*0.7))));
    SIM.wind  = Math.max(0, Math.round(SIM.wind *(1+0.05*Math.sin(SIM.t*1.1))));
  } else {
    // ===== SIMULATED MODE (unchanged) =====
    SIM.solar=Math.round(4000*SIM.daylight*wx.solarMul*(0.9+0.1*Math.sin(SIM.t*0.3)));
    const windNoise=wx.storm>0.3 ? (0.4*Math.sin(SIM.t*1.4)+0.3*Math.sin(SIM.t*3.1)) : (0.4*Math.sin(SIM.t*0.17+1)+0.1*Math.sin(SIM.t*0.9));
    SIM.wind=Math.max(150,Math.round(3000*wx.windMul*(0.6+windNoise)));
  }

  const avail=SIM.solar+SIM.wind;

  // ── AI-driven electrolyzer load target — reacts to weather, night, leaks AND battery reserve ──
  let loadCap=2170;
  if(SIM.weather==='rainy') loadCap=1600;    // AI trims load on poor solar
  if(SIM.weather==='storm') loadCap=1300;    // AI holds safe/steady in storm
  // battery reserve protection: as SoC falls, AI caps load to survive
  if(SIM.soc<15)      loadCap=Math.min(loadCap,600);   // near-minimum survival
  else if(SIM.soc<30) loadCap=Math.min(loadCap,1100);  // conservative
  else if(SIM.soc<45) loadCap=Math.min(loadCap,1700);  // cautious
  // baseline target follows what's available (renewables + reasonable battery support)
  let targetLoad=Math.min(loadCap,Math.max(500, avail*0.9 + Math.max(0,(SIM.soc-40))*8));
  // leaks that cut H2 production also drop load
  if(SIM.leak && LEAKS[SIM.leak] && LEAKS[SIM.leak].fluid==='h2') targetLoad*=0.82;
  SIM.load+=(targetLoad-SIM.load)*Math.min(1,dt*0.8);

  // ── battery: charge on surplus, discharge on deficit (clamped to 2.5 MW rating) ──
  const BMAX=2500;                     // kW inverter rating
  const net=avail-SIM.load-SIM.aux;    // + surplus / − deficit
  SIM.grid=0;                          // off-grid design
  if(net>=0){
    const charge=Math.min(net*0.9, BMAX);      // clamp to rating; rest is curtailed
    SIM.bess=-Math.round(charge);              // negative = flowing INTO battery (charging)
    SIM.battState = charge>40 ? 'charging' : 'idle';
    SIM.curtail=Math.max(0,Math.round(net-charge));  // surplus renewable curtailed
    SIM.soc=Math.min(100,SIM.soc+ (charge/12500)*dt*100*0.5);
  } else {
    let deficit=-net;
    SIM.curtail=0;
    if(SIM.soc>3){
      const dis=Math.min(deficit, BMAX);
      SIM.bess=Math.round(dis);        // positive = OUT of battery (discharging)
      SIM.battState='discharging';
      SIM.soc=Math.max(0,SIM.soc-(dis/12500)*dt*100*0.5);
    } else {
      SIM.bess=0; SIM.battState='idle'; // battery exhausted — load already forced to minimum above
    }
  }

  // ── H2 / O2 production ──
  const h2rate=SIM.load/52;
  SIM.h2Flow=Math.round(h2rate*11.2);
  SIM.h2Today+=h2rate*dt*0.36;
  SIM.o2Today=SIM.h2Today*8;

  // ── active leak descriptor ──
  const L = SIM.leak ? LEAKS[SIM.leak] : null;
  const isH2  = L && L.fluid==='h2';
  const isO2  = L && L.fluid==='o2';
  const isCW  = L && L.fluid==='water';

  // ── base sensor dynamics ──
  // stack runs hotter on hot days: cooling tower approach limits how cold the coolant can get
  const ambT = (LIVE.on && LIVE.data) ? LIVE.data.temp : 25;
  SIM.stackT = 68 + (SIM.load/2170)*10 + n()*0.8 + (ambT-25)*0.30;
  SIM.h2P    = 30 + n()*0.4;
  SIM.compP  = 200 + n()*3 + (SIM.health['H₂ Compressor'].fault>30?n()*8:0);
  SIM.storeP = Math.min(230, 185 + Math.sin(SIM.t*0.05)*15 + n());
  SIM.vib    = 4.2 + (30-SIM.health['H₂ Compressor'].rul/6)*0.04 + n()*0.3 + (SIM.health['H₂ Compressor'].fault>25?Math.random()*3:0);
  // Cooling water return temp: rises with load, and in live mode with real ambient temperature
  // (a cooling tower can only approach ambient — hot days = warmer cooling water = hotter stack)
  const ambient = (LIVE.on && LIVE.data) ? LIVE.data.temp : 25;
  SIM.cwT    = 35 + n()*0.6 + (SIM.load/2170)*2 + (ambient-25)*0.45;
  SIM.waterF = Math.round(h2rate*10 + n()*3);
  SIM.current= Math.round(SIM.load*1.93 + n()*20);
  SIM.purity = 99.999 - Math.random()*0.002;
  SIM.o2inh2 = 0.4 + n()*0.05;
  SIM.cond   = 0.08 + n()*0.01;
  SIM.o2P    = 15 + n()*0.2;
  SIM.o2Level= Math.max(0, Math.min(100, SIM.o2Level + (isO2? -dt*3 : dt*0.2)));  // slowly refills otherwise
  if(SIM.o2Level>78 && !isO2) SIM.o2Level=78;
  SIM.cwFlow = 50 + n()*1.5;

  // ── HYDROGEN LEAK effects (location-specific sensor hit) ──
  if(isH2){
    SIM.leakSev=Math.min(1,(SIM.leakSev||0)+dt*0.25);
    const sev=SIM.leakSev;
    // pressure decreases & flow reduces at the affected point
    if(SIM.leak==='h2storage'){ SIM.storeP=Math.max(120,185-sev*70+n()); }
    if(SIM.leak==='compressor'){ SIM.compP=Math.max(120,200-sev*70+n()*4); SIM.vib+=sev*6; }
    if(SIM.leak==='electrolyzer'||SIM.leak==='separator'){ SIM.h2P=Math.max(15,30-sev*13+n()); SIM.o2inh2=0.4+sev*1.4; }
    if(SIM.leak==='dryer'){ SIM.purity=99.999-sev*0.9; SIM.h2P=Math.max(18,29-sev*10); }
    SIM.h2Flow=Math.round(SIM.h2Flow*(1-sev*0.4));
    SIM.purity=Math.min(SIM.purity,99.999-sev*0.6);
    // health impact on nearest asset
    SIM.health['H₂ Compressor'].fault=Math.min(99,SIM.health['H₂ Compressor'].fault+dt*3);
  }
  // ── OXYGEN LEAK effects ──
  else if(isO2){
    SIM.leakSev=Math.min(1,(SIM.leakSev||0)+dt*0.25);
    const sev=SIM.leakSev;
    SIM.o2P=Math.max(3,15-sev*11+n()*0.3);       // O2 pressure falls
    // o2Level handled above (falling)
  }
  // ── COOLING WATER LEAK effects ──
  else if(isCW){
    SIM.leakSev=Math.min(1,(SIM.leakSev||0)+dt*0.2);
    const sev=SIM.leakSev;
    SIM.cwFlow=Math.max(8,50-sev*40+n());          // cooling flow drops
    SIM.stackT=68+(SIM.load/2170)*10 + sev*22 + n()*0.8;  // stack overheats
    SIM.cwT=35+sev*15;
    SIM.health['CW Pump 01'].fault=Math.min(99,SIM.health['CW Pump 01'].fault+dt*4);
  } else {
    SIM.leakSev=Math.max(0,(SIM.leakSev||0)-dt*0.4); // recover when cleared
  }

  // ── health degradation ──
  for(const k in SIM.health){
    const h=SIM.health[k];
    h.rul=Math.max(0,h.rul+h.trend*dt*2);
    h.fault=Math.min(99,Math.max(0,h.fault-h.trend*dt*3));
  }
}

// ═══════════════════════════════════════════════
//  ALARM LOGIC
// ═══════════════════════════════════════════════
function checkAlarms(){
  const A=[];
  const L = SIM.leak ? LEAKS[SIM.leak] : null;
  // leak alarm first (location + fluid specific)
  if(L){
    if(L.fluid==='h2') A.push({t:`⚠ HYDROGEN LEAK — ${L.gd} — ${L.name} — Zone 40% LEL · ESD armed`,lvl:'red'});
    else if(L.fluid==='o2') A.push({t:`⚠ OXYGEN LEAK — ${L.gd} — ${L.name} · enrichment hazard`,lvl:'red'});
    else if(L.fluid==='water') A.push({t:`⚠ COOLING WATER LEAK — ${L.gd} — flow loss · overheat risk`,lvl:'amber'});
  }
  if(SIM.stackT>82) A.push({t:'Electrolyzer stack temp HIGH — TT-201',lvl:'red'});
  else if(SIM.stackT>78) A.push({t:'Stack temp elevated — TT-201',lvl:'amber'});
  if(SIM.o2inh2>1.0) A.push({t:'O₂-in-H₂ HIGH — AT-202 — SIL-2 trip armed',lvl:'red'});
  else if(SIM.o2inh2>0.8) A.push({t:'O₂-in-H₂ rising — AT-202',lvl:'amber'});
  if(SIM.purity<99.9) A.push({t:'H₂ purity below spec — AT-301',lvl:'amber'});
  if(SIM.vib>12) A.push({t:'Compressor vibration HIGH — VT-401',lvl:'red'});
  else if(SIM.vib>8) A.push({t:'Compressor vibration elevated — VT-401',lvl:'amber'});
  if(SIM.storeP>225) A.push({t:'H₂ storage pressure high — PT-501',lvl:'amber'});
  if(L&&L.fluid==='h2'&&SIM.storeP<150) A.push({t:'H₂ pressure dropping — leak-down detected — PT-501',lvl:'red'});
  if(SIM.o2P<8) A.push({t:'O₂ storage pressure LOW — PT-O2',lvl:'red'});
  if(SIM.o2Level<40) A.push({t:'O₂ storage level falling — LT-O2',lvl:'amber'});
  if(SIM.cwFlow<25) A.push({t:'Cooling water flow LOW — FT-601 — overheat risk',lvl:'red'});
  return A;
}

// ═══════════════════════════════════════════════
//  DASHBOARD RENDERING
// ═══════════════════════════════════════════════
function ringSVG(pct,col){
  const r=15,c=2*Math.PI*r,off=c*(1-pct/100);
  return `<svg width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="${r}" fill="none" stroke="#1e293b" stroke-width="3"/><circle cx="18" cy="18" r="${r}" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 18 18)"/></svg>`;
}

const GAUGES=[
  {tag:'TT-201',lbl:'Stack Temp',key:'stackT',unit:'°C',min:40,max:90,col:'#f97316'},
  {tag:'PT-201',lbl:'H₂ Pressure',key:'h2P',unit:'bar',min:0,max:50,col:'#3b82f6'},
  {tag:'FT-201',lbl:'H₂ Flow',key:'h2Flow',unit:'Nm³/h',min:0,max:600,col:'#22c55e'},
  {tag:'AT-301',lbl:'H₂ Purity',key:'purity',unit:'%',min:99,max:100,col:'#a855f7'},
  {tag:'AT-202',lbl:'O₂ in H₂',key:'o2inh2',unit:'%',min:0,max:2,col:'#eab308'},
  {tag:'PT-404',lbl:'Comp Disch',key:'compP',unit:'bar',min:0,max:250,col:'#3b82f6'},
  {tag:'VT-401',lbl:'Comp Vib',key:'vib',unit:'mm/s',min:0,max:20,col:'#eab308'},
  {tag:'PT-501',lbl:'Storage P',key:'storeP',unit:'bar',min:0,max:250,col:'#60a5fa'},
  {tag:'IT-202',lbl:'Stack Current',key:'current',unit:'A',min:0,max:5000,col:'#facc15'},
];

function renderDash(){
  const alarmKeys={stackT:SIM.stackT>78,o2inh2:SIM.o2inh2>0.8,purity:SIM.purity<99.9,vib:SIM.vib>8,storeP:SIM.storeP>225};
  document.getElementById('gauges').innerHTML=GAUGES.map(g=>{
    const v=SIM[g.key];
    const pct=Math.max(0,Math.min(100,(v-g.min)/(g.max-g.min)*100));
    const al=alarmKeys[g.key];
    const disp=g.key==='purity'?v.toFixed(3):(g.key==='o2inh2'?v.toFixed(2):(g.key==='vib'?v.toFixed(1):Math.round(v)));
    return `<div class="gauge"><div class="gauge-ring">${ringSVG(pct,al?'#ef4444':g.col)}</div>
      <div class="gauge-info"><div class="gauge-val" style="color:${al?'#fca5a5':'#e2e8f0'}">${disp} <span style="font-size:8px;color:#64748b">${g.unit}</span></div>
      <div class="gauge-lbl">${g.lbl}</div><div class="gauge-tag">${g.tag}</div></div></div>`;
  }).join('');
}

function renderKPI(){
  // live production from current electrolyzer load
  const h2rate = SIM.load/52;                 // kg/h at 52 kWh/kg stack
  const daily = Math.round(h2rate*24);
  document.getElementById('k-h2').textContent=daily;
  document.getElementById('k-h2rate').textContent=h2rate.toFixed(1)+' kg/h current';
  // live system specific energy: stack (52) + BOP spread over actual production.
  // BOP (330 kW) is largely fixed, so at part load it costs more per kg → efficiency drops.
  const bopPerKg = h2rate>0.5 ? (SIM.aux)/h2rate : 999;
  const secKwh = 52 + bopPerKg;               // kWh/kg system, live
  const effPct = Math.max(0, Math.round(39.4/secKwh*100));   // HHV basis
  document.getElementById('k-eff').textContent=effPct+'%';
  document.getElementById('k-sec').textContent=secKwh.toFixed(0)+' kWh/kg system';
  document.getElementById('k-co2').textContent=Math.round(daily*10).toLocaleString();
  document.getElementById('k-o2').textContent=Math.round(daily*8).toLocaleString();
}

function renderEnergy(){
  const cap={solar:4000,wind:3000,bess:2500,load:2170};
  const set=(id,v,c)=>{document.getElementById('e-'+id).textContent=Math.round(v)+' kW';document.getElementById('ef-'+id).style.width=Math.min(100,Math.abs(v)/c*100)+'%';};
  set('solar',SIM.solar,cap.solar);set('wind',SIM.wind,cap.wind);
  // battery: SIM.bess >0 = discharging (out), <0 = charging (in)
  const bessEl=document.getElementById('e-bess');
  bessEl.textContent=(SIM.bess>0?'−':(SIM.bess<0?'+':''))+Math.abs(Math.round(SIM.bess))+' kW';
  document.getElementById('ef-bess').style.width=Math.min(100,Math.abs(SIM.bess)/cap.bess*100)+'%';
  document.getElementById('ef-bess').style.background=SIM.battState==='charging'?'#4ade80':(SIM.battState==='discharging'?'#60a5fa':'#64748b');
  // status pill
  const pill=document.getElementById('b-stat');
  pill.className='bstat '+SIM.battState;
  pill.textContent=SIM.battState.toUpperCase();
  document.getElementById('b-soc').textContent=Math.round(SIM.soc)+'%';
  set('load',SIM.load,cap.load);
  const renew=Math.min(100,Math.round((SIM.solar+SIM.wind)/(SIM.load+SIM.aux)*100));
  document.getElementById('e-renew').textContent=renew+'%';
}

function renderEbal(){
  document.getElementById('eb-solar').textContent=Math.round(SIM.solar)+' kW';
  document.getElementById('eb-wind').textContent=Math.round(SIM.wind)+' kW';
  const b=document.getElementById('eb-bess');
  b.textContent=(SIM.bess>0?'−':(SIM.bess<0?'+':''))+Math.abs(Math.round(SIM.bess))+' kW';
  b.style.color=SIM.battState==='charging'?'#4ade80':(SIM.battState==='discharging'?'#60a5fa':'#94a3b8');
  document.getElementById('eb-grid').textContent=Math.round(SIM.grid)+' kW';
  document.getElementById('eb-load').textContent=Math.round(SIM.load)+' kW';
  document.getElementById('eb-aux').textContent=Math.round(SIM.aux)+' kW';
  const renew=Math.min(100,Math.round((SIM.solar+SIM.wind)/(SIM.load+SIM.aux)*100));
  document.getElementById('eb-renew').textContent=renew+'%';
  document.getElementById('eb-wx').textContent=WEATHER[SIM.weather].label.split(' ')[0];
}

// ── AI Decision Log (ring buffer) ──
const aiLog=[];
function pushLog(txt,lvl='info'){
  const hr=Math.floor((6+SIM.t*0.15)%24), mn=Math.floor(((6+SIM.t*0.15)%1)*60);
  const stamp=`${String(hr).padStart(2,'0')}:${String(mn).padStart(2,'0')}`;
  // avoid duplicate consecutive entries
  if(aiLog.length && aiLog[0].txt===txt) return;
  aiLog.unshift({txt,lvl,stamp});
  if(aiLog.length>6) aiLog.pop();
  renderAILog();
}
function renderAILog(){
  const el=document.getElementById('log-list');
  if(!el) return;
  el.innerHTML=aiLog.map(l=>`<div class="log-item ${l.lvl}">${l.txt}<div class="log-time">${l.stamp} · AI optimizer</div></div>`).join('')
    || `<div class="log-item">System nominal — monitoring all subsystems<div class="log-time">AI optimizer</div></div>`;
}

function renderAI(){
  const arr=Object.entries(SIM.health).sort((a,b)=>a[1].rul-b[1].rul);
  document.getElementById('rul-list').innerHTML=arr.map(([name,h])=>{
    const rulPct=Math.min(100,h.rul/365*100);
    const col=h.rul<60?'#ef4444':h.rul<120?'#f59e0b':'#22c55e';
    const faultCol=h.fault>30?'#ef4444':h.fault>15?'#f59e0b':'#64748b';
    return `<div class="rul"><div class="rul-top"><span class="rul-name">${name}</span>
      <span class="rul-days" style="color:${col}">${Math.round(h.rul)}d</span></div>
      <div class="rul-bar"><div class="rul-fill" style="width:${rulPct}%;background:${col}"></div></div>
      <div class="rul-fault">RUL · fault probability <span style="color:${faultCol};font-weight:600">${Math.round(h.fault)}%</span></div></div>`;
  }).join('');
}

function renderMaint(){
  const alerts=[];
  for(const [name,h] of Object.entries(SIM.health)){
    if(h.rul<60) alerts.push({icon:'🔴',txt:`${name}: RUL ${Math.round(h.rul)}d — schedule replacement`,crit:true,time:'Work order auto-generated'});
    else if(h.fault>25) alerts.push({icon:'🟠',txt:`${name}: fault probability ${Math.round(h.fault)}% — inspect`,crit:false,time:'Recommended within 7 days'});
  }
  if(SIM.leak && LEAKS[SIM.leak]){
    const L=LEAKS[SIM.leak];
    const msg = L.fluid==='water'
      ? `${L.name}: flow loss at ${L.gd} — isolate & repair, watch stack temp`
      : `${L.name}: leak signature at ${L.gd} — dispatch team NOW`;
    alerts.unshift({icon:'⚠️',txt:msg,crit:true,time:'Immediate'});
  }
  const box=document.getElementById('maint');
  if(alerts.length===0){box.classList.add('hidden');return;}
  box.classList.remove('hidden');
  document.getElementById('maint-list').innerHTML=alerts.slice(0,4).map(a=>
    `<div class="malert ${a.crit?'crit':''}"><span class="micon">${a.icon}</span>
    <div><div class="mtext">${a.txt}</div><div class="mtime">${a.time}</div></div></div>`).join('');
}

function renderAlarms(){
  const A=checkAlarms();
  document.getElementById('alarms').innerHTML=A.slice(0,3).map(a=>
    `<div class="alarm ${a.lvl==='amber'?'amber':''}"><span class="alarm-dot"></span>${a.t}</div>`).join('');
}

// ═══════════════════════════════════════════════
//  P&ID MODE  (flatten to schematic top-view + show tags)
// ═══════════════════════════════════════════════
let pidMode=false;
function applyPID(on){
  document.body.classList.toggle('pidmode',on);
  scene.fog.density=on?0.0003:0.0015;
  scene.background=new THREE.Color(on?0x0a1428:0x080e1a);
  // in P&ID mode: force top view, boost sensor sprites, dim 3D materials
  pipeMeshes.forEach(m=>{if(m.material)m.material.opacity=on?1:(m.material.opacity||1);});
  if(on){T.setView('top');sShow(true);}
}

// ═══════════════════════════════════════════════
//  ORBIT CONTROLS
// ═══════════════════════════════════════════════
let th=-0.6,ph=0.75,rad=290,autoRot=true;
const tgt=new THREE.Vector3(0,5,0);let drag=false,lx=0,ly=0;
function updateCam(){camera.position.set(tgt.x+rad*Math.sin(ph)*Math.sin(th),tgt.y+rad*Math.cos(ph),tgt.z+rad*Math.sin(ph)*Math.cos(th));camera.lookAt(tgt);}
updateCam();
canvas.addEventListener('mousedown',e=>{drag=true;lx=e.clientX;ly=e.clientY;autoRot=false;document.getElementById('bRot').classList.remove('on');});
addEventListener('mouseup',()=>drag=false);
const m2=new THREE.Vector2(-9,-9);
canvas.addEventListener('mousemove',e=>{if(drag){th-=(e.clientX-lx)*.005;ph=Math.max(.04,Math.min(1.5,ph-(e.clientY-ly)*.005));lx=e.clientX;ly=e.clientY;updateCam();}const r=canvas.getBoundingClientRect();m2.x=((e.clientX-r.left)/r.width)*2-1;m2.y=-((e.clientY-r.top)/r.height)*2+1;doHover();});
canvas.addEventListener('wheel',e=>{e.preventDefault();rad=Math.max(40,Math.min(700,rad+e.deltaY*.3));updateCam();},{passive:false});
canvas.addEventListener('touchstart',e=>{if(e.touches.length===1){drag=true;lx=e.touches[0].clientX;ly=e.touches[0].clientY;autoRot=false;}},{passive:true});
canvas.addEventListener('touchmove',e=>{if(drag&&e.touches.length===1){th-=(e.touches[0].clientX-lx)*.005;ph=Math.max(.04,Math.min(1.5,ph-(e.touches[0].clientY-ly)*.005));lx=e.touches[0].clientX;ly=e.touches[0].clientY;updateCam();}},{passive:true});
canvas.addEventListener('touchend',()=>drag=false);

const raycaster=new THREE.Raycaster();const tip=document.getElementById('tip');let lastZ=null;
function doHover(){raycaster.setFromCamera(m2,camera);const hits=raycaster.intersectObjects(pickables,false);const zone=hits.length?hits[0].object.userData.zone:null;if(zone!==lastZ){lastZ=zone;if(zone&&ZONES[zone]){const nm=zone.charAt(0).toUpperCase()+zone.slice(1).replace(/([A-Z])/g,' $1');tip.innerHTML=`<b>${nm}</b> — ${ZONES[zone]}`;tip.classList.add('on');}else{tip.innerHTML='Hover equipment for details · Toggle P&ID mode for schematic view';tip.classList.remove('on');}canvas.style.cursor=zone?'pointer':'grab';}}

// ═══════════════════════════════════════════════
//  PUBLIC BUTTON HANDLERS
// ═══════════════════════════════════════════════
function sShow(v){sensorSprites.forEach(s=>s.visible=v);}
T.toggleRot=()=>{autoRot=!autoRot;document.getElementById('bRot').classList.toggle('on',autoRot);};
T.togglePID=()=>{pidMode=!pidMode;document.getElementById('bPid').classList.toggle('on',pidMode);applyPID(pidMode);};
T.toggleSensors=()=>{const b=document.getElementById('bSensor');const on=!b.classList.contains('on');b.classList.toggle('on',on);ssVisible=on;sShow(on);};
let ssVisible=true;
T.toggleFlow=()=>{const b=document.getElementById('bFlow');const on=!b.classList.contains('on');b.classList.toggle('on',on);flowMeshes.forEach(m=>m.visible=on);};
// ── dropdown open/close ──
T.dd=(id)=>{
  const el=document.getElementById(id);const wasOpen=el.classList.contains('open');
  document.querySelectorAll('.dd').forEach(d=>d.classList.remove('open'));
  if(!wasOpen) el.classList.add('open');
};
document.addEventListener('click',e=>{if(!e.target.closest('.dd'))document.querySelectorAll('.dd').forEach(d=>d.classList.remove('open'));});

// ── leak selection ──
T.setLeak=(key)=>{
  SIM.leak = (key==='none')?null:key;
  SIM.leakSev = 0;
  positionLeak(SIM.leak);
  // button visual + menu active state
  document.getElementById('bLeak').classList.toggle('on',!!SIM.leak);
  document.querySelectorAll('#ddLeak .dd-item').forEach(it=>it.classList.toggle('active',it.dataset.leak===(SIM.leak||'none')));
  document.getElementById('ddLeak').classList.remove('open');
  // AI reacts to leak
  if(SIM.leak){
    const L=LEAKS[SIM.leak];
    if(L.fluid==='h2'){ pushLog(`🚨 ${L.name} detected (${L.gd}). Initiating shutdown sequence, isolating section, dispatching maintenance.`,'crit'); }
    else if(L.fluid==='o2'){ pushLog(`🚨 ${L.name} (${L.gd}). Isolating O₂ storage, enrichment-hazard protocol, dispatch team.`,'crit'); }
    else { pushLog(`⚠ ${L.name} (${L.gd}). Reducing electrolyzer load, predicting stack overheat, dispatch repair.`,'warn'); }
  } else {
    pushLog('✓ Leak cleared. Restoring normal operation, resetting affected loops.','info');
  }
};

// ── weather selection ──
T.setWeather=(mode)=>{
  // manual weather selection takes control back from live mode
  if(LIVE.on){
    LIVE.on=false; LIVE.data=null; LIVE.status='off'; updateLiveBadge();
    const lb=document.getElementById('bLive'); if(lb){lb.classList.remove('on');lb.textContent='🛰 Live Mode';}
    pushLog('Manual weather selected — live mode switched off.','info');
  }
  SIM.weather=mode;
  const w=WEATHER[mode];
  SIM.wxTarget={solarMul:w.solarMul,windMul:w.windMul,cloud:w.cloud,rain:w.rain,storm:w.storm};
  document.querySelectorAll('#ddWx .dd-item').forEach(it=>it.classList.toggle('active',it.dataset.wx===mode));
  document.getElementById('bWx').textContent=w.label;
  document.getElementById('ddWx').classList.remove('open');
  // storm banner
  const banner=document.getElementById('wxBanner');
  if(mode==='storm'){banner.classList.add('show');document.getElementById('wxBannerTxt').textContent='STORM WARNING — unstable renewable generation · battery at maximum';}
  else banner.classList.remove('show');
  // rain visibility
  rain.visible = (mode==='rainy'||mode==='storm');
  // AI reaction
  const react={
    sunny:'☀ Sunny forecast — increasing electrolyzer load, charging battery from solar surplus.',
    cloudy:'⛅ Cloudy — solar reduced, battery on standby assist, holding H₂ output.',
    rainy:'🌧 Rainy — solar low, reducing electrolyzer load, discharging battery to cover deficit.',
    storm:'🌩 Storm — renewables unstable. Maintaining safe steady load, battery at max, advisory issued.',
  };
  pushLog(react[mode], mode==='storm'?'warn':'info');
};

// ── single-line diagram build + refs ──
const SLD_NODES=[
  {id:'solar',lbl:'Solar Farm',y:16,col:'#facc15'},
  {id:'wind', lbl:'Wind Farm', y:56,col:'#38bdf8'},
  {id:'bess', lbl:'Battery ESS',y:100,col:'#a78bfa'},
  {id:'tx',   lbl:'Transformer',y:144,col:'#94a3b8'},
  {id:'sub',  lbl:'Substation', y:188,col:'#e2e8f0'},
  {id:'rect', lbl:'Rectifier',  y:232,col:'#f97316'},
  {id:'pem',  lbl:'PEM Electrolyzer',y:284,col:'#3b82f6'},
];
function buildSLD(){
  const svg=document.getElementById('sldSvg');
  let h='';
  // connecting lines with dash-flow
  for(let i=0;i<SLD_NODES.length-1;i++){
    const y1=SLD_NODES[i].y+22, y2=SLD_NODES[i+1].y;
    h+=`<line class="sldline" x1="65" y1="${y1}" x2="65" y2="${y2}" stroke="#facc15" stroke-width="2" stroke-dasharray="4 4"/>`;
    h+=`<polygon points="65,${y2} 61,${y2-6} 69,${y2-6}" fill="#facc15"/>`;
  }
  // nodes
  SLD_NODES.forEach(nd=>{
    h+=`<rect x="8" y="${nd.y}" width="114" height="22" rx="5" fill="#0f172a" stroke="${nd.col}" stroke-width="1.5"/>`;
    h+=`<text x="65" y="${nd.y+15}" text-anchor="middle" fill="${nd.col}" font-size="9" font-family="system-ui" font-weight="600">${nd.lbl}</text>`;
  });
  svg.innerHTML=h;
}
buildSLD();
let sldOn=true;
T.toggleSLD=()=>{sldOn=!sldOn;document.getElementById('bSLD').classList.toggle('on',sldOn);document.getElementById('sld').style.display=sldOn?'block':'none';
  // also toggle 3D cables + power particles
  powerFlows.forEach(sys=>sys.ps.forEach(p=>p.visible=sldOn));
  pipeMeshes.forEach(m=>{if(m.material===cableMat)m.visible=sldOn;});
};

T.toggleLeak=()=>{}; // legacy no-op (button replaced by dropdown)
let nightOn=false;
T.toggleNight=()=>{
  nightOn=!nightOn;
  SIM.dayTarget = nightOn?0:1;              // <<< real driver: night ramps solar toward 0
  document.body.classList.toggle('night',nightOn);
  document.getElementById('bNight').classList.toggle('on',nightOn);
  document.getElementById('bNight').textContent=nightOn?'☀ Day':'🌙 Night';
  // AI announces the cascade it's about to manage
  if(nightOn) pushLog('🌙 Nightfall — solar output ramping to zero. Switching to wind + battery, trimming electrolyzer load to protect state-of-charge.','warn');
  else pushLog('☀ Daybreak — solar returning. Ramping electrolyzer load back up, resuming battery charging.','info');
};
// central lighting resolver — follows smooth daylight value + weather
function applyLighting(){
  const w=SIM.wx, dl=SIM.daylight;         // dl: 1 day → 0 night
  // site flood-lights fade in as it gets dark
  siteLights.forEach(l=>l.intensity=(1-dl)*1.5);
  // sun/ambient scale with daylight, dimmed further by cloud cover
  const cloudDim = 1 - w.cloud*0.7;
  sun.intensity = (0.12 + dl*0.98) * cloudDim;
  amb.intensity = (0.22 + dl*0.43) * (1 - w.cloud*0.25);
  hemi.intensity= (0.12 + dl*0.28);
  // background sky blends night ↔ weather-day sky by daylight
  const wxSky=new THREE.Color(WEATHER[SIM.weather].sky);
  const nightSky=new THREE.Color(0x030712);
  const sky = nightSky.clone().lerp(wxSky, dl);
  if(!pidMode) scene.background.copy(sky);
  // fog thicker in rain/storm
  scene.fog.density = pidMode?0.0003 : (0.0015 + w.rain*0.001 + w.storm*0.001);
}
// ── LIVE MODE handlers ──
T.toggleLive=async()=>{
  LIVE.on=!LIVE.on;
  const b=document.getElementById('bLive');
  b.classList.toggle('on',LIVE.on);
  b.textContent = LIVE.on ? '🛰 LIVE' : '🛰 Live Mode';
  if(LIVE.on){
    if(!LIVE.located){
      // first activation: try to find where the user actually is
      LIVE.located=true;
      pushLog('🛰 Live mode ON — detecting your location…','info');
      return T.useMyLocation();
    }
    await fetchLiveWeather();
    pushLog('🛰 Live mode ON — solar and wind driven by real measured weather at '+LIVE.place+'.','info');
  }else{
    LIVE.data=null; LIVE.status='off'; updateLiveBadge();
    document.getElementById('wxBanner').classList.remove('show');
    pushLog('Live mode OFF — reverted to simulated weather control.','info');
  }
};

// ── Reverse-geocode coordinates → readable place name (best effort, never fatal) ──
async function reverseGeocode(lat,lon){
  try{
    const r=await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
    if(!r.ok) throw 0;
    const j=await r.json();
    const name=j.city||j.locality||j.principalSubdivision;
    if(name) return name+(j.countryCode?', '+j.countryCode:'');
  }catch(e){/* fall through */}
  return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;   // graceful fallback
}

async function applyLocation(lat,lon,label,how){
  LIVE.lat=lat; LIVE.lon=lon;
  LIVE.place=label;
  LIVE.how=how;
  LIVE.located=true;
  document.getElementById('ddLoc').classList.remove('open');
  pushLog(`📍 Location set via ${how}: ${LIVE.place} (${lat.toFixed(3)}, ${lon.toFixed(3)}).`,'info');
  // turn live mode on automatically once we know where we are
  if(!LIVE.on){
    LIVE.on=true;
    const b=document.getElementById('bLive');
    b.classList.add('on'); b.textContent='🛰 LIVE';
  }
  await fetchLiveWeather();
}

// ── 1. Browser GPS (most accurate; needs permission + secure context) ──
T.useMyLocation=()=>{
  document.getElementById('ddLoc').classList.remove('open');
  if(!navigator.geolocation){
    pushLog('⚠ This browser has no geolocation support — trying network detection instead.','warn');
    return T.detectByIP();
  }
  pushLog('🛰 Requesting GPS location — please allow the browser permission prompt…','info');
  navigator.geolocation.getCurrentPosition(
    async pos=>{
      const {latitude:lat, longitude:lon, accuracy}=pos.coords;
      const label=await reverseGeocode(lat,lon);
      await applyLocation(lat,lon,label,`GPS (±${Math.round(accuracy)} m)`);
    },
    err=>{
      // Common cause: file:// is not a secure origin, so Chrome blocks GPS. Fall back silently.
      const why = err.code===1 ? 'permission denied'
                : err.code===2 ? 'position unavailable (browsers block GPS on file:// pages)'
                : 'timed out';
      pushLog(`⚠ GPS unavailable — ${why}. Falling back to network detection.`,'warn');
      T.detectByIP();
    },
    {enableHighAccuracy:true, timeout:8000, maximumAge:300000}
  );
};

// ── 2. IP-based detection (works even on file:// pages, city-level accuracy) ──
T.detectByIP=async()=>{
  document.getElementById('ddLoc').classList.remove('open');
  pushLog('🌐 Detecting location from network address…','info');
  const providers=[
    {url:'https://ipapi.co/json/',       pick:j=>({lat:j.latitude, lon:j.longitude, name:(j.city||j.region)+(j.country_code?', '+j.country_code:'')})},
    {url:'https://ipwho.is/',            pick:j=>({lat:j.latitude, lon:j.longitude, name:(j.city||j.region)+(j.country_code?', '+j.country_code:'')})},
  ];
  for(const p of providers){
    try{
      const r=await fetch(p.url); if(!r.ok) continue;
      const j=await r.json();
      const g=p.pick(j);
      if(typeof g.lat==='number' && typeof g.lon==='number'){
        await applyLocation(g.lat,g.lon,g.name||'Detected location','network / IP');
        return;
      }
    }catch(e){/* try next provider */}
  }
  pushLog('⚠ Network detection failed (offline or blocked) — enter a city name instead.','warn');
};

// ── 3. Manual city entry (always works, no permissions) ──
T.enterCity=async()=>{
  document.getElementById('ddLoc').classList.remove('open');
  const city=prompt('Enter a city name for live weather:', LIVE.place);
  if(!city) return;
  try{
    const geo=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
    const gj=await geo.json();
    if(!gj.results || !gj.results.length){ alert('City not found: '+city); return; }
    const r=gj.results[0];
    await applyLocation(r.latitude, r.longitude, r.name+(r.country_code?', '+r.country_code:''), 'manual entry');
  }catch(e){ alert('Location lookup failed: '+e.message); }
};

// legacy alias
T.changeLocation=()=>T.enterCity();

T.setView=v=>{if(v==='top'){th=0;ph=.04;rad=340;}else if(v==='side'){th=0;ph=1.1;rad=320;}else{th=-.6;ph=.75;rad=290;pidMode&&(pidMode=false,document.getElementById('bPid').classList.remove('on'),applyPID(false));}updateCam();};

// ═══════════════════════════════════════════════
//  OVERLAY VIEWS — open / close
// ═══════════════════════════════════════════════
let activeView=null;
T.openView=(id)=>{
  document.querySelectorAll('.overlay').forEach(o=>o.classList.remove('show'));
  document.getElementById(id).classList.add('show');
  activeView=id;
  if(id==='hiw') HIW.start();
  if(id==='aiexp') AIX.start();
};
T.closeView=()=>{
  document.querySelectorAll('.overlay').forEach(o=>o.classList.remove('show'));
  activeView=null; HIW.stop(); AIX.stop();
};
document.addEventListener('keydown',e=>{if(e.key==='Escape')T.closeView();});

// ═══════════════════════════════════════════════
//  PROCESS FLOW DIAGRAM (animated SVG)
// ═══════════════════════════════════════════════
(function buildPFD(){
  const NS='http://www.w3.org/2000/svg';
  const svg=document.getElementById('pfdSvg');
  const COL={water:'#22d3ee',h2:'#3b82f6',o2:'#e2e8f0',heat:'#f97316',elec:'#facc15',box:'#1e2b3f',stroke:'#475569',txt:'#cbd5e1'};
  function el(tag,attrs){const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);return e;}
  function unit(x,y,w,h,label,sub){
    const g=el('g',{});
    g.appendChild(el('rect',{x,y,width:w,height:h,rx:7,fill:COL.box,stroke:COL.stroke,'stroke-width':1.3}));
    const t=el('text',{x:x+w/2,y:y+h/2-(sub?4:0),'text-anchor':'middle',fill:COL.txt,'font-size':11,'font-weight':600,'font-family':'Segoe UI,system-ui'});
    t.textContent=label; g.appendChild(t);
    if(sub){const s=el('text',{x:x+w/2,y:y+h/2+11,'text-anchor':'middle',fill:'#64748b','font-size':8.5,'font-family':'Segoe UI,system-ui'});s.textContent=sub;g.appendChild(s);}
    svg.appendChild(g);
  }
  function flow(pts,color,label){
    const d=pts.map((p,i)=>`${i?'L':'M'}${p[0]},${p[1]}`).join(' ');
    svg.appendChild(el('path',{d,fill:'none',stroke:color,'stroke-width':3,'stroke-linecap':'round','stroke-linejoin':'round',class:'pfd-flow'}));
    // arrowhead at last segment
    const [x2,y2]=pts[pts.length-1],[x1,y1]=pts[pts.length-2];
    const ang=Math.atan2(y2-y1,x2-x1);
    const a1=ang+2.7,a2=ang-2.7,s=7;
    svg.appendChild(el('path',{d:`M${x2},${y2} L${x2+s*Math.cos(a1)},${y2+s*Math.sin(a1)} M${x2},${y2} L${x2+s*Math.cos(a2)},${y2+s*Math.sin(a2)}`,stroke:color,'stroke-width':2.5,fill:'none','stroke-linecap':'round'}));
    if(label){const mx=(x1+x2)/2,my=(y1+y2)/2;const t=el('text',{x:mx,y:my-6,'text-anchor':'middle',fill:color,'font-size':8,'font-weight':600,'font-family':'system-ui'});t.textContent=label;svg.appendChild(t);}
  }
  // ---- Power row (top) ----
  unit(20,15,90,44,'Solar 4MWp','+ Wind 3MW');
  unit(150,15,80,44,'Battery','10 MWh');
  unit(270,15,90,44,'Rectifier','AC→DC');
  flow([[110,37],[150,37]],COL.elec);
  flow([[230,37],[270,37]],COL.elec);
  flow([[315,59],[315,120]],COL.elec,'DC power');
  // ---- Water row (left) ----
  unit(20,120,90,44,'Raw Water','521 L/h');
  unit(150,120,90,44,'Treatment','RO + EDI');
  unit(280,120,70,44,'DM Tank','417 L/h');
  flow([[110,142],[150,142]],COL.water,'S-01');
  flow([[240,142],[280,142]],COL.water,'S-02');
  // HX preheat
  unit(280,205,70,40,'HX-01','preheat');
  flow([[315,164],[315,205]],COL.water,'S-04');
  // ---- Electrolyzer (center) ----
  unit(400,120,120,130,'PEM','ELECTROLYZER');
  flow([[350,225],[400,225]],COL.heat,'S-05 50°C');
  flow([[360,140],[400,140]],COL.elec,'2167kW');
  // ---- H2 train ----
  unit(560,120,80,44,'Separator','G/L split');
  unit(670,120,80,44,'Deoxidiser','Pd cat.');
  unit(780,120,80,44,'PSA Dryer','<5ppm');
  unit(890,120,90,44,'Compressor','30→200bar');
  unit(890,205,90,44,'H₂ Storage','200bar');
  unit(890,290,90,44,'Dispatch','350bar');
  flow([[520,150],[560,150]],COL.h2,'S-07 wet H₂');
  flow([[640,142],[670,142]],COL.h2);
  flow([[750,142],[780,142]],COL.h2,'S-09');
  flow([[860,142],[890,142]],COL.h2,'S-10 dry');
  flow([[935,164],[935,205]],COL.h2,'S-12');
  flow([[935,249],[935,290]],COL.h2,'S-13');
  // ---- O2 train (bottom) ----
  unit(560,290,80,44,'O₂ Separator','');
  unit(670,290,80,44,'O₂ Comp','2→15bar');
  unit(780,290,80,44,'O₂ Storage','15bar');
  flow([[460,250],[460,312],[560,312]],COL.o2,'S-08 O₂');
  flow([[640,312],[670,312]],COL.o2);
  flow([[750,312],[780,312]],COL.o2,'S-14');
  // ---- Heat recovery return ----
  flow([[400,235],[360,235],[360,270],[315,270],[315,245]],COL.heat,'S-17 65°C');
  // ---- Cooling ----
  unit(400,300,120,40,'Cooling Tower','580 kW');
  flow([[460,300],[460,250]],COL.water);
  // ---- vent ----
  unit(1010,120,70,40,'Vent Stack','15m');
  flow([[935,120],[935,100],[1045,100],[1045,120]],'#94a3b8','PSV');
  // title footer
  const cap=el('text',{x:560,y:445,'text-anchor':'middle',fill:'#475569','font-size':10,'font-family':'system-ui'});
  cap.textContent='Animated dashes show live flow direction · all streams at full-load steady state';
  svg.appendChild(cap);
})();

// ═══════════════════════════════════════════════
//  HOW IT WORKS — 2D step animation engine
// ═══════════════════════════════════════════════
const HIW=(function(){
  const NS='http://www.w3.org/2000/svg';
  const svg=document.getElementById('hiwSvg');
  const C={water:'#22d3ee',h2:'#3b82f6',o2:'#e2e8f0',heat:'#f97316',elec:'#facc15',ai:'#06b6d4',dim:'#1a2536',lit:'#233449',stroke:'#3a4a63',txt:'#cbd5e1'};
  const nodes={}; // id -> {group, rect}
  function el(t,a){const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);return e;}
  function node(id,x,y,w,h,label,sub){
    const g=el('g',{});
    const r=el('rect',{x,y,width:w,height:h,rx:8,fill:C.dim,stroke:C.stroke,'stroke-width':1.5});
    g.appendChild(r);
    const t=el('text',{x:x+w/2,y:y+h/2-(sub?5:0),'text-anchor':'middle',fill:C.txt,'font-size':12,'font-weight':600,'font-family':'Segoe UI,system-ui'});
    t.textContent=label;g.appendChild(t);
    if(sub){const s=el('text',{x:x+w/2,y:y+h/2+12,'text-anchor':'middle',fill:'#64748b','font-size':9,'font-family':'system-ui'});s.textContent=sub;g.appendChild(s);}
    svg.appendChild(g); nodes[id]={g,r,x,y,w,h,cx:x+w/2,cy:y+h/2}; return nodes[id];
  }
  function link(a,b,color){
    const A=nodes[a],B=nodes[b];
    let x1=A.cx,y1=A.cy,x2=B.cx,y2=B.cy;
    const p=el('path',{d:`M${x1},${y1} L${x2},${y2}`,stroke:color,'stroke-width':3,fill:'none','stroke-linecap':'round',opacity:.25});
    svg.insertBefore(p,svg.firstChild);
    return {p,A,B,color};
  }
  // Build simplified schematic
  node('solar',40,40,150,54,'Solar + Wind','4 MW + 3 MW');
  node('bess',40,150,150,54,'Battery','10 MWh buffer');
  node('water',40,300,150,54,'Water Treatment','RO + EDI');
  node('hx',40,410,150,48,'Heat Recovery','preheat feed');
  node('pem',300,200,180,110,'PEM ELECTROLYZER','2 × 1.1 MW stacks');
  node('sep',560,120,140,50,'Separator','remove water');
  node('dry',560,210,140,50,'Purify + Dry','deoxidise, <5ppm');
  node('comp',560,300,140,50,'Compressor','30 → 200 bar');
  node('store',830,300,150,54,'H₂ Storage','200 bar, 500 kg');
  node('disp',830,410,150,48,'Dispatch','tube trailers');
  node('o2',560,410,140,48,'O₂ Storage','byproduct sale');
  node('ai',830,120,150,54,'AI + SCADA','supervisory control');
  // links
  const links=[
    link('solar','bess',C.elec),link('bess','pem',C.elec),link('water','pem',C.water),
    link('hx','pem',C.heat),link('pem','sep',C.h2),link('sep','dry',C.h2),
    link('dry','comp',C.h2),link('comp','store',C.h2),link('store','disp',C.h2),
    link('pem','o2',C.o2),link('ai','store',C.ai),link('pem','hx',C.heat),
  ];
  // moving particles layer
  const parts=[];
  function spawn(a,b,color){
    const dot=el('circle',{r:4,fill:color,opacity:0});
    svg.appendChild(dot); parts.push({dot,A:nodes[a],B:nodes[b],t:Math.random(),color});
  }
  // steps definition
  const STEPS=[
    {id:'solar',lit:['solar'],flows:[],title:'Renewable Power Generation',
      text:'Solar panels (4 MWp) and wind turbines (3 MW) generate clean electricity. Because sun and wind vary, output is never constant — this is the core challenge the rest of the plant is built around.',
      tech:'Combined ≈ 40,800 kWh/day at 20% solar & 30% wind capacity factors.'},
    {id:'bess',lit:['solar','bess'],flows:[['solar','bess']],title:'Smart Energy Management + Battery',
      text:'A 10 MWh lithium battery smooths out the ups and downs. When generation exceeds demand it charges; when the sun drops or wind dies it discharges. The AI decides the split moment to moment.',
      tech:'Battery buffers ±2.5 MW, enabling steady electrolyzer operation without a grid connection.'},
    {id:'water',lit:['water'],flows:[],title:'Water Treatment & Demineralisation',
      text:'Ordinary water contains salts and minerals that would poison the electrolyzer membrane. Reverse osmosis followed by electrodeionisation strips these out to produce ultra-pure demineralised water.',
      tech:'Output conductivity < 0.1 µS/cm · 521 L/h raw in → 417 L/h pure out (80% recovery).'},
    {id:'hx',lit:['hx','pem'],flows:[['hx','pem'],['pem','hx']],title:'Feed-Water Preheating (Heat Recovery)',
      text:'The electrolyzer runs warm (65 °C) and rejects heat. Instead of wasting it, a heat exchanger uses that heat to warm the incoming water from 15 °C to 50 °C — so the stack spends less energy heating water itself.',
      tech:'Recovers 200–300 kW of otherwise-wasted heat → +2–3% overall efficiency.'},
    {id:'pem',lit:['pem','water','bess','hx'],flows:[['bess','pem'],['water','pem'],['hx','pem']],title:'PEM Electrolysis — The Core Reaction',
      text:'DC electricity is passed through the pure water across a Proton Exchange Membrane. The energy splits water into hydrogen (at the cathode) and oxygen (at the anode). This is where green hydrogen is actually born.',
      tech:'2 H₂O → 2 H₂ + O₂ · 52 kWh/kg H₂ · 2,167 kW · 464 Nm³/h H₂ · 30 bar, 65 °C.'},
    {id:'sep',lit:['pem','sep'],flows:[['pem','sep']],title:'Gas–Liquid Separation',
      text:'The hydrogen leaving the stack is wet — it carries entrained water droplets. A separator vessel knocks these out and returns the water to the loop, leaving a cleaner gas stream.',
      tech:'Removes bulk moisture before purification; recovered water recycled to feed loop.'},
    {id:'dry',lit:['sep','dry'],flows:[['sep','dry']],title:'Purification & Drying',
      text:'A catalytic deoxidiser removes trace oxygen, then a twin-tower dryer adsorbs the remaining moisture. This lifts the gas to fuel-cell-grade purity so it can be stored and sold.',
      tech:'Output: 99.999% H₂, dewpoint < −65 °C, < 5 ppm moisture, < 1 ppm O₂.'},
    {id:'comp',lit:['dry','comp'],flows:[['dry','comp']],title:'Compression',
      text:'Hydrogen is very light, so at 30 bar it still takes up a lot of space. A three-stage oil-free compressor squeezes it to 200 bar for storage — and up to 350 bar for filling tube trailers.',
      tech:'3-stage diaphragm compressor · 180 kW · intercooled between stages.'},
    {id:'store',lit:['comp','store','disp'],flows:[['comp','store'],['store','disp']],title:'Storage & Dispatch',
      text:'Compressed hydrogen is held in a bank of steel vessels — about 500 kg, roughly half a day of production. From there it is dispensed into tube trailers for delivery to industrial customers.',
      tech:'500 kg at 200 bar · ~12 h buffer · pressure-relief + burst-disc protected.'},
    {id:'o2',lit:['pem','o2','ai'],flows:[['pem','o2'],['ai','store']],title:'Oxygen Byproduct & AI Supervision',
      text:'The oxygen produced alongside hydrogen is captured and sold, improving economics. Overseeing everything, the AI + SCADA layer forecasts weather, optimises the electrolyzer, predicts maintenance and watches for leaks — without replacing human operators.',
      tech:'7,937 kg/day O₂ recovered · AI communicates with PLCs via OPC UA (advisory, SIL-2 safety stays independent).'},
  ];
  let step=0,playing=false,timer=null,animRAF=null;
  function paint(){
    // dim all
    for(const id in nodes){nodes[id].r.setAttribute('fill',C.dim);nodes[id].r.setAttribute('stroke',C.stroke);nodes[id].r.setAttribute('stroke-width',1.5);}
    links.forEach(l=>l.p.setAttribute('opacity',.12));
    // clear particles
    parts.forEach(p=>{p.dot.remove();});parts.length=0;
    const s=STEPS[step];
    s.lit.forEach(id=>{if(nodes[id]){nodes[id].r.setAttribute('fill',C.lit);nodes[id].r.setAttribute('stroke',C.ai);nodes[id].r.setAttribute('stroke-width',2.5);}});
    // active flow links + particles
    s.flows.forEach(([a,b])=>{
      const lk=links.find(l=>(l.A===nodes[a]&&l.B===nodes[b])||(l.A===nodes[b]&&l.B===nodes[a]));
      const color=lk?lk.color:C.h2;
      if(lk) lk.p.setAttribute('opacity',.9);
      for(let i=0;i<4;i++) spawn(a,b,color);
    });
    // caption
    document.getElementById('hiwNum').textContent=step+1;
    document.getElementById('hiwTitle').textContent=s.title;
    document.getElementById('hiwText').textContent=s.text;
    document.getElementById('hiwTech').textContent=s.tech;
    document.getElementById('hiwStepLabel').textContent=`Step ${step+1} / ${STEPS.length}`;
    document.getElementById('hiwProg').style.width=((step+1)/STEPS.length*100)+'%';
    // dots
    const dots=document.getElementById('hiwDots');
    dots.innerHTML=STEPS.map((_,i)=>`<div class="hiw-dot ${i===step?'active':''}" onclick="HIW.go(${i})"></div>`).join('');
  }
  function tick(){
    animRAF=requestAnimationFrame(tick);
    parts.forEach(p=>{
      p.t=(p.t+0.012)%1;
      const x=p.A.cx+(p.B.cx-p.A.cx)*p.t, y=p.A.cy+(p.B.cy-p.A.cy)*p.t;
      p.dot.setAttribute('cx',x);p.dot.setAttribute('cy',y);
      p.dot.setAttribute('opacity', Math.sin(p.t*Math.PI));
    });
  }
  function go(i){step=(i+STEPS.length)%STEPS.length;paint();}
  return {
    start(){paint();if(!animRAF)tick();},
    stop(){playing=false;clearInterval(timer);document.getElementById('hiwPlay').innerHTML='▶ Play';if(animRAF){cancelAnimationFrame(animRAF);animRAF=null;}},
    next(){go(step+1);},prev(){go(step-1);},go(i){go(i);},
    toggle(){
      playing=!playing;
      const btn=document.getElementById('hiwPlay');
      if(playing){btn.innerHTML='⏸ Pause';timer=setInterval(()=>{if(step===STEPS.length-1){go(0);}else{go(step+1);}},4500);}
      else{btn.innerHTML='▶ Play';clearInterval(timer);}
    }
  };
})();

// ═══════════════════════════════════════════════
//  AI EXPLAINED — sensor→AI pipeline + live anomaly chart
// ═══════════════════════════════════════════════
const AIX=(function(){
  const NS='http://www.w3.org/2000/svg';
  function el(t,a){const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);return e;}

  // ---- selectable live sensors, each maps to a SIM field + its health asset ----
  const SENSORS_AIX=[
    {id:'vib',  lbl:'Compressor Vibration', unit:'mm/s', get:()=>SIM.vib,    healthKey:'H₂ Compressor', warn:8,  crit:12, range:[0,20]},
    {id:'stackT',lbl:'Stack Temperature',   unit:'°C',   get:()=>SIM.stackT, healthKey:'PEM Stack A',   warn:78, crit:82, range:[50,95]},
    {id:'cwFlow',lbl:'Cooling Water Flow',  unit:'L/h',  get:()=>SIM.cwFlow, healthKey:'CW Pump 01',    warn:35, crit:25, range:[0,55], invert:true},
    {id:'storeP',lbl:'H₂ Storage Pressure', unit:'bar',  get:()=>SIM.storeP, healthKey:'H₂ Compressor', warn:225,crit:150,range:[100,240]},
  ];
  let activeSensor=SENSORS_AIX[0];
  const history=[]; const HIST_LEN=80;
  let baseline=null, baselineSpread=1;

  // ---- build sensor selector buttons ----
  const selDiv=document.getElementById('aixSelect');
  function buildSelector(){
    selDiv.innerHTML='';
    SENSORS_AIX.forEach(s=>{
      const b=document.createElement('button');
      b.className='aix-sbtn'+(s.id===activeSensor.id?' active':'');
      b.textContent=s.lbl;
      b.onclick=()=>{activeSensor=s;history.length=0;baseline=null;buildSelector();};
      selDiv.appendChild(b);
    });
  }
  buildSelector();

  // ---- live chart render ----
  const chartSvg=document.getElementById('aixChart');
  const CW=560,CH=200,PAD=28;
  function drawChart(){
    chartSvg.innerHTML='';
    const [lo,hi]=activeSensor.range;
    const xAt=i=>PAD+ (i/(HIST_LEN-1))*(CW-PAD-10);
    const yAt=v=>CH-PAD-((v-lo)/(hi-lo))*(CH-PAD-14);
    // gridlines
    for(let g=0;g<=4;g++){
      const gy=PAD+g*(CH-PAD-14)/4;
      chartSvg.appendChild(el('line',{x1:PAD,y1:gy,x2:CW-8,y2:gy,stroke:'#1e293b','stroke-width':1}));
    }
    // warn/crit threshold lines
    const warnY=yAt(activeSensor.warn), critY=yAt(activeSensor.crit);
    chartSvg.appendChild(el('line',{x1:PAD,y1:warnY,x2:CW-8,y2:warnY,stroke:'#f59e0b','stroke-width':1,'stroke-dasharray':'4 3'}));
    chartSvg.appendChild(el('line',{x1:PAD,y1:critY,x2:CW-8,y2:critY,stroke:'#ef4444','stroke-width':1,'stroke-dasharray':'4 3'}));
    // baseline band (learned normal range)
    if(baseline!==null){
      const bTop=yAt(baseline+baselineSpread), bBot=yAt(baseline-baselineSpread);
      chartSvg.appendChild(el('rect',{x:PAD,y:bTop,width:CW-PAD-18,height:Math.max(1,bBot-bTop),fill:'#22c55e',opacity:.08}));
      chartSvg.appendChild(el('line',{x1:PAD,y1:yAt(baseline),x2:CW-8,y2:yAt(baseline),stroke:'#22c55e','stroke-width':1,opacity:.5}));
    }
    // data polyline
    if(history.length>1){
      const pts=history.map((v,i)=>`${xAt(i+HIST_LEN-history.length)},${yAt(v)}`).join(' ');
      chartSvg.appendChild(el('polyline',{points:pts,fill:'none',stroke:'#38bdf8','stroke-width':2,'stroke-linejoin':'round'}));
      // current point dot, colored by anomaly state
      const last=history[history.length-1];
      const dev=Math.abs(last-(baseline??last));
      const anomalous = dev>baselineSpread*2.2;
      const dot=el('circle',{cx:xAt(HIST_LEN-1),cy:yAt(last),r:4,fill:anomalous?'#ef4444':'#38bdf8'});
      chartSvg.appendChild(dot);
    }
    // axis labels
    const t1=el('text',{x:6,y:PAD+3,'font-size':8,fill:'#64748b'});t1.textContent=hi.toFixed(0);chartSvg.appendChild(t1);
    const t2=el('text',{x:6,y:CH-PAD+4,'font-size':8,fill:'#64748b'});t2.textContent=lo.toFixed(0);chartSvg.appendChild(t2);
    const t3=el('text',{x:CW-8,y:warnY-3,'font-size':7,fill:'#f59e0b','text-anchor':'end'});t3.textContent='warn';chartSvg.appendChild(t3);
    const t4=el('text',{x:CW-8,y:critY-3,'font-size':7,fill:'#ef4444','text-anchor':'end'});t4.textContent='critical';chartSvg.appendChild(t4);
  }

  function tick(){
    const v=activeSensor.get();
    history.push(v); if(history.length>HIST_LEN) history.shift();
    // learn baseline as slow rolling mean once enough samples exist
    if(history.length>=10){
      const mean=history.reduce((a,b)=>a+b,0)/history.length;
      baseline = baseline===null ? mean : baseline*0.97+mean*0.03;
      const variance=history.reduce((a,b)=>a+(b-baseline)**2,0)/history.length;
      baselineSpread=Math.max(0.3,Math.sqrt(variance));
    }
    const dev = baseline!==null ? Math.abs(v-baseline)/baselineSpread : 0;
    const anomalyScore = Math.min(100,Math.round(dev*22));
    const h = SIM.health[activeSensor.healthKey] || {rul:0,fault:0};
    document.getElementById('aixVal').textContent = v.toFixed(1)+' '+activeSensor.unit;
    document.getElementById('aixScore').textContent = anomalyScore+'%';
    document.getElementById('aixScore').style.color = anomalyScore>55?'#ef4444':(anomalyScore>25?'#f59e0b':'#a855f7');
    document.getElementById('aixRul').textContent = Math.round(h.rul)+'d';
    document.getElementById('aixFault').textContent = Math.round(h.fault)+'%';
    drawChart();
  }

  // ---- Pipeline step diagram ----
  const psvg=document.getElementById('aixPipeSvg');
  const PNODES=[
    {id:'sensor',x:10, lbl:'Field Sensor',sub:'TT / PT / FT / VT'},
    {id:'plc',   x:165,lbl:'PLC',sub:'4–20mA → digital'},
    {id:'scada', x:320,lbl:'SCADA',sub:'Level 2 HMI'},
    {id:'opcua', x:475,lbl:'OPC UA',sub:'IEC 62541 bridge'},
    {id:'ai',    x:630,lbl:'AI Layer',sub:'baseline + anomaly'},
    {id:'decide',x:785,lbl:'Decision',sub:'RUL · fault prob'},
    {id:'action',x:930,lbl:'Alert / Work Order',sub:'operator reviews'},
  ];
  const pnodeEls={};
  function buildPipeline(){
    psvg.innerHTML='';
    const y=45,w=135,h=54;
    PNODES.forEach((n,i)=>{
      const g=el('g',{});
      const r=el('rect',{x:n.x,y,width:w,height:h,rx:8,fill:'#1a2536',stroke:'#3a4a63','stroke-width':1.5});
      g.appendChild(r);
      const t1=el('text',{x:n.x+w/2,y:y+h/2-4,'text-anchor':'middle',fill:'#cbd5e1','font-size':11,'font-weight':600,'font-family':'Segoe UI,system-ui'});
      t1.textContent=n.lbl; g.appendChild(t1);
      const t2=el('text',{x:n.x+w/2,y:y+h/2+12,'text-anchor':'middle',fill:'#64748b','font-size':8.5,'font-family':'system-ui'});
      t2.textContent=n.sub; g.appendChild(t2);
      psvg.appendChild(g);
      pnodeEls[n.id]={r};
      if(i<PNODES.length-1){
        const x1=n.x+w, x2=PNODES[i+1].x;
        psvg.appendChild(el('line',{x1,y1:y+h/2,x2,y2:y+h/2,stroke:'#334155','stroke-width':2}));
        psvg.appendChild(el('polygon',{points:`${x2},${y+h/2} ${x2-7},${y+h/2-5} ${x2-7},${y+h/2+5}`,fill:'#334155'}));
      }
    });
  }
  buildPipeline();

  const STEPS=[
    {lit:'sensor',title:'Field Sensor Reads the Process',
     text:'A physical instrument — a thermocouple, pressure transmitter, or vibration accelerometer — continuously measures a real physical quantity on the plant, exactly like the ones already placed on the 3D model.',
     tech:'Example: VT-401 accelerometer on the H₂ compressor, sampling continuously in mm/s.'},
    {lit:'plc',title:'PLC Digitises the Signal',
     text:'The sensor sends a raw analogue signal (typically 4–20 mA) to a PLC, which converts it into an engineering-unit value the rest of the system can use.',
     tech:'Standard HART-overlaid 4–20 mA loop; PLC scan cycle typically 10–100 ms.'},
    {lit:'scada',title:'SCADA Aggregates the Plant',
     text:'The PLC publishes the value to SCADA, which collects readings from every instrument across the plant into one live operating picture for human operators.',
     tech:'Level 2 of the ISA-95 hierarchy — this is what a conventional plant stops at.'},
    {lit:'opcua',title:'OPC UA Bridges to the AI Layer',
     text:'A secure, read-first OPC UA connection exposes SCADA data to the AI layer sitting above it. This is a supervisory bridge — the AI subscribes to data, it does not command field devices directly.',
     tech:'IEC 62541 standard · publisher-subscriber model · isolated from the safety network.'},
    {lit:'ai',title:'AI Learns a Baseline, Then Watches for Drift',
     text:'Instead of a single fixed threshold, the AI learns what "normal" looks like for this exact sensor at the current operating point, then scores every new reading by how far it deviates from that learned pattern — this is the live chart on the left.',
     tech:'Rolling-mean baseline + standard deviation band ≈ simplified Isolation Forest behaviour.'},
    {lit:'decide',title:'Anomaly Trend Becomes a Prediction',
     text:'A single noisy spike is not a failure. The AI tracks the deviation trend across many samples over time and projects it forward to estimate Remaining Useful Life and a fault probability — this is what feeds the RUL panel and maintenance alerts elsewhere in the twin.',
     tech:'Trend extrapolation ≈ simplified Weibull survival-curve concept.'},
    {lit:'action',title:'Human-Reviewed Action',
     text:'If fault probability or RUL crosses a limit, the AI logs a decision and raises a maintenance alert or work order. Safety-critical trips are never decided by the AI — those stay hardwired in the independent Safety Instrumented System.',
     tech:'SIL-2 SIS remains fully independent of the AI layer at all times — by design, not by accident.'},
  ];
  let step=0, playing=false, timer=null;
  function paint(){
    for(const id in pnodeEls) pnodeEls[id].r.setAttribute('stroke','#3a4a63'), pnodeEls[id].r.setAttribute('fill','#1a2536'), pnodeEls[id].r.setAttribute('stroke-width',1.5);
    const s=STEPS[step];
    if(pnodeEls[s.lit]){pnodeEls[s.lit].r.setAttribute('fill','#0e2a3a');pnodeEls[s.lit].r.setAttribute('stroke','#06b6d4');pnodeEls[s.lit].r.setAttribute('stroke-width',2.5);}
    document.getElementById('aixNum').textContent=step+1;
    document.getElementById('aixTitle').textContent=s.title;
    document.getElementById('aixText').textContent=s.text;
    document.getElementById('aixTech').textContent=s.tech;
    document.getElementById('aixStepLabel').textContent=`Step ${step+1} / ${STEPS.length}`;
    document.getElementById('aixProg').style.width=((step+1)/STEPS.length*100)+'%';
    const dots=document.getElementById('aixDots');
    dots.innerHTML=STEPS.map((_,i)=>`<div class="hiw-dot ${i===step?'active':''}" onclick="AIX.go(${i})"></div>`).join('');
  }
  function go(i){step=(i+STEPS.length)%STEPS.length;paint();}

  // ---- 9 AI modules grid ----
  const MODULES=[
    {name:'Renewable Power Forecaster',trl:'high',trlLbl:'TRL 7–8',desc:'LSTM + XGBoost ensemble predicts solar/wind output 15min–24h ahead from weather data.'},
    {name:'Electrolyzer Optimizer',trl:'mid',trlLbl:'TRL 4–5',desc:'Physics-informed model recommends optimal current density & temperature setpoints.'},
    {name:'Battery Optimizer (MPC)',trl:'high',trlLbl:'TRL 7–8',desc:'Model-predictive control schedules charge/discharge to maximise electrolyzer uptime.'},
    {name:'Hydrogen Demand Predictor',trl:'mid',trlLbl:'TRL 5–6',desc:'Time-series forecasting (Prophet-style) predicts 7-day dispatch demand.'},
    {name:'Predictive Maintenance Engine',trl:'high',trlLbl:'TRL 7–8',desc:'Isolation Forest anomaly detection + Weibull RUL — the engine shown live above.'},
    {name:'Leak Prediction Module',trl:'mid',trlLbl:'TRL 3–4',desc:'Statistical process control on gas-detector trend data, ahead of the LEL alarm threshold.'},
    {name:'Compressor Optimizer',trl:'high',trlLbl:'TRL 7–8',desc:'Physics-based model + RL tunes compressor loading sequence and intercooler targets.'},
    {name:'Central Energy Orchestrator',trl:'mid',trlLbl:'TRL 3–5',desc:'NSGA-II multi-objective optimizer resolves conflicts across all modules above.'},
    {name:'Automated Report Generator',trl:'high',trlLbl:'TRL 9',desc:'Compiles daily production, efficiency and maintenance reports without operator effort.'},
  ];
  document.getElementById('aixModules').innerHTML = MODULES.map(m=>
    `<div class="aix-mod"><h4>${m.name}</h4><p>${m.desc}</p><span class="trl ${m.trl}">${m.trlLbl}</span></div>`
  ).join('');

  let rafId=null, aixClock=null, aixAccum=0;
  function loop(){
    rafId=requestAnimationFrame(loop);
    const now=performance.now();
    const dt = aixClock===null ? 0 : (now-aixClock)/1000;
    aixClock=now; aixAccum+=dt;
    if(aixAccum>0.12){ aixAccum=0; tick(); }  // ~8 updates/sec — smooth but light
  }
  return {
    start(){ paint(); if(!rafId) loop(); },
    stop(){ playing=false; clearInterval(timer); const b=document.getElementById('aixPlay'); if(b)b.innerHTML='▶ Play'; if(rafId){cancelAnimationFrame(rafId);rafId=null;} },
    next(){go(step+1);}, prev(){go(step-1);}, go(i){go(i);},
    toggle(){
      playing=!playing;
      const btn=document.getElementById('aixPlay');
      if(playing){btn.innerHTML='⏸ Pause'; timer=setInterval(()=>{go(step===STEPS.length-1?0:step+1);},4800);}
      else{btn.innerHTML='▶ Play'; clearInterval(timer);}
    }
  };
})();

// ═══════════════════════════════════════════════
//  MAIN LOOP
// ═══════════════════════════════════════════════
const clk=new THREE.Clock();let uiTick=0;let aiTick=0;
const sldSvg=document.getElementById('sldSvg');
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(0.05,clk.getDelta()),t=clk.getElapsedTime();
  stepSim(dt);
  applyLighting();

  // ── turbine speed scales with wind (faster in storm) ──
  const windSpeedFactor=0.5+SIM.wind/1500;
  rotors.forEach((r,i)=>r.rotation.z+=dt*(1.2+i*.2)*windSpeedFactor);
  fanG.rotation.y+=dt*2.5;

  // ── process flow particles (existing) ──
  pSystems.forEach(ps=>ps.ps.forEach(p=>{p.userData.t=(p.userData.t+dt*ps.spd)%1;ps.cv.getPointAt(p.userData.t,p.position);p.position.y+=.4;}));
  h2fill.intensity=.9+.5*Math.sin(t*1.6);

  // ── ELECTRICITY power-flow particles, intensity scaled by source ──
  const solarFrac=SIM.solar/4000, windFrac=SIM.wind/3000;
  const chargingBatt=SIM.battState==='charging', dischargingBatt=SIM.battState==='discharging';
  powerFlows.forEach(sys=>{
    let active=1, spd=sys.spd;
    if(sys.tag==='solar'){active=solarFrac; spd=sys.spd*(0.5+solarFrac);}
    else if(sys.tag==='wind'){active=windFrac; spd=sys.spd*(0.5+windFrac);}
    else if(sys.tag==='battOut'){active=dischargingBatt?1:0.15; spd=sys.spd*(dischargingBatt?1.4:0.5);}
    else if(sys.tag==='sub'){active=Math.min(1,SIM.load/2170); spd=sys.spd;}
    sys.ps.forEach((p,i)=>{
      p.userData.t=(p.userData.t+dt*spd)%1;
      sys.cv.getPointAt(p.userData.t,p.position);
      const vis = sldOn && (i/sys.ps.length < Math.max(0.12,active));
      p.visible=vis;
      p.scale.setScalar(0.4+active*0.5);
    });
    // battOut reverses direction when charging (flows INTO battery)
    if(sys.tag==='battOut'){
      sys.ps.forEach(p=>{
        if(chargingBatt){/* reverse visual: recompute along reversed param */
          const rt=1-p.userData.t; sys.cv.getPointAt(rt,p.position);
        }
      });
    }
  });

  // ── BATTERY glow: green when charging, blue when discharging ──
  let bTargetOp=0, bCol=0x4ade80, bLight=0;
  if(chargingBatt){bTargetOp=0.18;bCol=0x4ade80;bLight=1.2;}
  else if(dischargingBatt){bTargetOp=0.18;bCol=0x60a5fa;bLight=1.2;}
  battGlowMat.opacity+=(bTargetOp-battGlowMat.opacity)*Math.min(1,dt*4);
  battGlowMat.color.setHex(bCol);
  battLight.color.setHex(bCol);
  battLight.intensity+=(bLight-battLight.intensity)*Math.min(1,dt*4);
  battGlowMat.opacity*=(0.9+0.1*Math.sin(t*3)); // subtle pulse

  // ── LEAK particles (relocatable) ──
  if(SIM.leak){
    const sev=SIM.leakSev||0;
    const fluid=LEAKS[SIM.leak].fluid;
    const rise = fluid==='water'?4:12;       // water pools low, gases rise
    leakParticles.forEach(p=>{
      p.userData.life+=dt*(0.4+sev*0.4);
      if(p.userData.life>1){p.userData.life=0;p.userData.spread=(Math.random()-.5)*4;}
      p.position.y=p.userData.life*rise;
      p.position.x=p.userData.spread*(1+p.userData.life);
      p.position.z=(p.userData.spread*0.6)*(1+p.userData.life);
      p.material.opacity=(1-p.userData.life)*0.7*Math.min(1,sev*1.5);
      p.scale.setScalar((2+p.userData.life*4)*(0.6+sev*0.6));
    });
    leakRing.material.opacity=(0.3+0.3*Math.sin(t*6))*Math.min(1,sev*2);
    leakRing.scale.setScalar(1+0.12*Math.sin(t*6));
  }

  // ── RAIN ──
  if(rain.visible){
    const pos=rain.geometry.attributes.position.array;
    const fall=(SIM.weather==='storm'?90:55)*dt;
    for(let i=1;i<pos.length;i+=3){pos[i]-=fall;if(pos[i]<0)pos[i]=120;}
    rain.geometry.attributes.position.needsUpdate=true;
    rainMat.opacity=0.25+SIM.wx.rain*0.35;
  }

  // ── CLOUDS drift + fade with cloud cover ──
  clouds.forEach(c=>{
    c.position.x+=c.userData.drift*dt*3;
    if(c.position.x>140)c.position.x=-140;
    c.material.opacity+=(SIM.wx.cloud*0.6 - c.material.opacity)*Math.min(1,dt*2);
  });

  // ── LIGHTNING (storm only) ──
  if(SIM.wx.storm>0.4){
    lightningTimer-=dt;
    if(lightningTimer<=0){
      lightningTimer=2+Math.random()*5;
      // flash
      lightningLight.position.set((Math.random()-.5)*200,150,(Math.random()-.5)*160);
      flashLightning();
    }
  }
  lightningLight.intensity*=Math.pow(0.02,dt); // decay

  if(autoRot&&!drag&&!pidMode){th+=dt*.055;updateCam();}

  // ── SLD dash-flow animation (offset stroke) ──
  if(sldOn){
    const off=-(t*12)%8;
    sldSvg.querySelectorAll('.sldline').forEach(l=>l.setAttribute('stroke-dashoffset',off));
  }

  // ── UI updates ~6/sec ──
  uiTick+=dt;
  if(uiTick>0.16){
    uiTick=0;
    renderDash();renderKPI();renderEnergy();renderEbal();renderAI();renderMaint();renderAlarms();
    // live weather: refresh badge, and re-fetch real data every 10 minutes
    if(LIVE.on){
      updateLiveBadge();
      if(LIVE.status==='ok' && Date.now()-LIVE.lastFetch > 600000) fetchLiveWeather();
    }
    updateSensorLabel('TT-201',Math.round(SIM.stackT),'°C',SIM.stackT>78);
    updateSensorLabel('PT-201',SIM.h2P.toFixed(1),'bar',SIM.h2P<20);
    updateSensorLabel('FT-201',Math.round(SIM.h2Flow),'Nm³/h',false);
    updateSensorLabel('AT-202',SIM.o2inh2.toFixed(2),'%O₂',SIM.o2inh2>0.8);
    updateSensorLabel('AT-301',SIM.purity.toFixed(2),'%',SIM.purity<99.9);
    updateSensorLabel('PT-404',Math.round(SIM.compP),'bar',SIM.compP<150);
    updateSensorLabel('VT-401',SIM.vib.toFixed(1),'mm/s',SIM.vib>8);
    updateSensorLabel('PT-501',Math.round(SIM.storeP),'bar',SIM.storeP>225||SIM.storeP<150);
    updateSensorLabel('TT-601',Math.round(SIM.cwT),'°C',SIM.cwT>45);
    updateSensorLabel('FT-101',Math.round(SIM.waterF),'L/h',false);
    updateSensorLabel('IT-202',Math.round(SIM.current),'A',false);
    updateSensorLabel('AT-101',SIM.cond.toFixed(2),'µS',false);
    const tod = SIM.daylight>0.6?'☀ Daytime':(SIM.daylight>0.15?'🌆 Dusk/Dawn':'🌙 Night');
    let mode;
    if(SIM.soc<15) mode='⚠ CRITICAL SoC — survival load';
    else if(SIM.battState==='charging') mode='Renewable surplus — charging';
    else if(SIM.battState==='discharging') mode='Battery assist';
    else mode='Balanced';
    const src = LIVE.on && LIVE.data ? `🛰 LIVE ${LIVE.place} ${LIVE.data.temp.toFixed(0)}°C` : 'Simulated';
    document.getElementById('clock').textContent=`${tod} · ${WEATHER[SIM.weather].label} · ${mode} · SoC ${Math.round(SIM.soc)}% · ${src}`;
  }

  // ── AI periodic advisory (every ~8s) — reflects the full cascade state ──
  aiTick+=dt;
  if(aiTick>8){
    aiTick=0;
    if(SIM.leak){/* leak logs handled on trigger */}
    else if(SIM.soc<15) pushLog(`⚠ Battery critically low (SoC ${Math.round(SIM.soc)}%) — electrolyzer forced to survival minimum until generation recovers.`,'crit');
    else if(SIM.soc<30 && SIM.battState==='discharging') pushLog(`Low battery (SoC ${Math.round(SIM.soc)}%) — AI reducing electrolyzer load to extend reserve.`,'warn');
    else if(SIM.daylight<0.15 && SIM.battState==='discharging') pushLog(`Night operation — solar zero, running on wind + battery (SoC ${Math.round(SIM.soc)}%), H₂ output trimmed.`,'warn');
    else if(SIM.weather==='storm') pushLog('Renewable output unstable — battery buffering, load held steady for safety.','warn');
    else if(SIM.battState==='charging') pushLog(`Surplus ${Math.round(SIM.solar+SIM.wind-SIM.load-SIM.aux)} kW — charging battery (SoC ${Math.round(SIM.soc)}%).`,'info');
    else if(SIM.battState==='discharging') pushLog(`Deficit covered by battery (SoC ${Math.round(SIM.soc)}%) — no grid import.`,'info');
    else pushLog(`Electrolyzer at ${Math.round(SIM.load)} kW · renewable ${Math.min(100,Math.round((SIM.solar+SIM.wind)/(SIM.load+SIM.aux)*100))}% · system nominal.`,'info');
  }

  renderer.render(scene,camera);
}
// lightning flash helper (screen + light)
const lightningEl=document.getElementById('lightning');
function flashLightning(){
  lightningLight.intensity=400;
  lightningEl.style.transition='none';lightningEl.style.opacity='0.5';
  requestAnimationFrame(()=>{lightningEl.style.transition='opacity .5s';lightningEl.style.opacity='0';});
}

// initialise defaults
T.setWeather('sunny');
renderAILog();
animate();
addEventListener('resize',()=>{camera.aspect=W()/H();camera.updateProjectionMatrix();renderer.setSize(W(),H());});
