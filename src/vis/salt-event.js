/* ===========================================================================
   SALT FLATS · SPEED WEEK — the busy event around the run: the pit town at the
   start (rigs, haulers, motorhomes, EZ-Ups, golf carts, scooters, tool carts,
   feather flags, people), the return road and a spectator line behind the
   cones; the push truck (a real pickup with a crew member riding the bed) and
   the safety truck; spins (lift, roll, yaw, skid and scuff marks on the salt,
   salt dust); and the parachute's salt-only extras (thick shroud lines, a
   tether, a pilot chute that pulls the main, a salt puff, a cut to the heli).
   Visual only: everything here reads what setSalt is fed and never feeds back.
   Full/Ultra: the town is InstancedMeshes (one draw call per shape+material,
   culled by town bounds and distance). Lite: the same prefabs, fewer of them,
   merged into the scene's existing static batches (no extra draw calls).
   Hooks into vis/salt.js: buildSaltScene (saltPitTown, saltPickup), saltUpdate
   (saltSpinPose, saltEventUpdate), saltDirect (the SALT.cue line).
   ==========================================================================*/
var SALT_PUSH_PAL=[0xf2c12e, 0xc8331f, 0xff6a14, 0x1f4f9a, 0x2a8a4a];   /* never white or black: it has to read against the salt as well as the car */
var _seM=new THREE.Matrix4(), _seL=new THREE.Matrix4(), _seE=new THREE.Euler(), _seQ=new THREE.Quaternion(), _seP=new THREE.Vector3(), _seS=new THREE.Vector3(),
  _seA=new THREE.Vector3(), _seB=new THREE.Vector3(), _seC=new THREE.Vector3(), _seX=new THREE.Vector3(1,0,0), _seCol=new THREE.Color();
function seRng(s){ var t=Math.sin(s*12.9898+78.233)*43758.5453; return t-Math.floor(t); }
/* extra unit shapes, registered beside StripBatch's own so either path can use them */
function seGeo(){
  var G=sbGeo(); if(G.sePyr) return G;
  function ni(g){ return g.index ? g.toNonIndexed() : g; }
  G.sePyr=ni(new THREE.CylinderGeometry(0,0.7071,1,4,1).rotateY(PI/4).translate(0,0.5,0));   /* square pyramid, base 1×1 at y 0 */
  G.seHead=ni(new THREE.IcosahedronGeometry(0.5,0));
  G.seWheel=ni(new THREE.CylinderGeometry(0.5,0.5,1,8).rotateX(PI/2));                       /* axle along z */
  G.seWheelL=ni(new THREE.CylinderGeometry(0.5,0.5,1,6).rotateX(PI/2));
  G.seFlat=ni(new THREE.PlaneGeometry(1,1).rotateX(-PI/2));                                     /* flat on the ground */
  return G;
}
/* --- a kit of unit shapes placed in a prefab's frame: merged into StripBatch keys (Lite) or collected for instancing --- */
function SeKit(B, inst){ this.B=B; this.inst=inst; this.I={}; this.base=new THREE.Matrix4(); this.n=0; }
SeKit.prototype.at=function(x,z,yaw){ this.base.makeRotationY(yaw||0); this.base.setPosition(x,0,z); return this; };
/* key: gloss | solid | metal | cloth | skin | blob */
SeKit.prototype.put=function(key, gn, lx,ly,lz, sx,sy,sz, col, rx,ry,rz){
  _seE.set(rx||0,ry||0,rz||0); _seQ.setFromEuler(_seE); _seL.compose(_seP.set(lx,ly,lz), _seQ, _seS.set(sx,sy,sz));
  var m=new THREE.Matrix4().multiplyMatrices(this.base,_seL); this.n++;
  if(!this.inst){ var bk={gloss:"solid", solid:"solid", skin:"solid", metal:"metal", cloth:"cloth"}[key]; if(!bk) return;
    (this.B.b[bk]||(this.B.b[bk]=[])).push({g:seGeo()[gn], m:m, c:col}); }
  else (this.I[key+"|"+gn]||(this.I[key+"|"+gn]=[])).push({m:m, c:col});
};
SeKit.prototype.build=function(scene){
  var out=[], G=seGeo(), M=seMats(), c=new THREE.Color(), bb=new THREE.Box3(), v=new THREE.Vector3();
  for(var k in this.I){ var it=this.I[k], p=k.split("|"), mat=M[p[0]], geo=G[p[1]]; if(!mat||!geo) continue;
    var g=geo.clone(), im=new THREE.InstancedMesh(g, mat, it.length); bb.makeEmpty();
    for(var i=0;i<it.length;i++){ im.setMatrixAt(i, it[i].m); im.setColorAt(i, c.set(it[i].c==null?0xffffff:it[i].c).convertSRGBToLinear()); bb.expandByPoint(v.setFromMatrixPosition(it[i].m)); }
    var sp=new THREE.Sphere(); bb.getBoundingSphere(sp); sp.radius+=16; g.boundingSphere=sp; im.frustumCulled=true;   /* r128 turns culling off for InstancedMesh; with the town's sphere on the geometry it culls right */
    im.instanceMatrix.needsUpdate=true; im.castShadow=false; im.receiveShadow=(p[0]!=="blob"); im.matrixAutoUpdate=false; im.updateMatrix();
    if(p[0]==="blob") im.renderOrder=1;
    scene.add(im); out.push(im); }
  return out;
};
function seMats(){
  var M=SALT.mats; if(M.iSolid) return M.iMap;
  M.iSolid=new THREE.MeshStandardMaterial({roughness:0.82});
  M.iGloss=new THREE.MeshStandardMaterial({roughness:0.32, metalness:0.25});
  M.iMetal=new THREE.MeshStandardMaterial({roughness:0.4, metalness:0.65});
  M.iCloth=new THREE.MeshStandardMaterial({roughness:0.88, side:THREE.DoubleSide});
  M.iSkin=new THREE.MeshStandardMaterial({roughness:0.7});
  var cv=newCanvas(64,64), x=cv.getContext("2d"), gr=x.createRadialGradient(32,32,2,32,32,31); gr.addColorStop(0,"rgba(0,0,0,0.55)"); gr.addColorStop(0.6,"rgba(0,0,0,0.3)"); gr.addColorStop(1,"rgba(0,0,0,0)");
  x.fillStyle=gr; x.fillRect(0,0,64,64);
  M.iBlob=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv), transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-2});
  M.iMap={solid:M.iSolid, gloss:M.iGloss, metal:M.iMetal, cloth:M.iCloth, skin:M.iSkin, blob:M.iBlob};
  return M.iMap;
}

/* --- prefabs: local x along the vehicle (front +x), y up, z across; all stand on y 0 --- */
var SE_LIV=[0xe9e6dc,0x1b1d20,0x9e2a22,0x22488f,0xd0d3d6,0x2c6b3a,0xd9a52b,0x6b2d6b,0x2a7d8c,0xc85a17];
var SE_SHIRT=[0xff7a1a,0x1d4787,0xf4efe2,0xb7261d,0x2c6b3a,0x3b3f45,0xd9a52b,0x7fb3d5,0xe36f8b,0x8a8f96];
var SE_PANTS=[0x2f3e5c,0x9c8a66,0x1d1f22,0x4a4f56,0x2f3e5c];
var SE_SKIN=[0xe0b48f,0xc89a78,0x9a6a4a,0x6e4a33,0xf0c8a8];
function seAxle(k, x, r, tw, lite, col){ if(lite) k.put("solid","box", x, r*0.8, 0, r*1.7, r*1.6, tw, col||0x18181a); else k.put("solid","seWheelL", x, r, 0, r*2, r*2, tw, col||0x18181a); }
function seBlob(k, x, z, l, w){ k.put("blob","seFlat", x, 0.015, z, l, 1, w, 0xffffff); }
/* a race rig: conventional tractor, enclosed trailer, the side door down as a ramp, an awning */
function sePfRig(k, s, lite, sides){
  var c=SE_LIV[Math.floor(seRng(s)*SE_LIV.length)], c2=SE_LIV[Math.floor(seRng(s+1)*SE_LIV.length)], DK=0x232528, CH=0xc9ccd0;
  k.put("gloss","box", 0, 2.3, 0, 13.4, 2.8, 2.55, c); k.put("solid","box", 0, 0.62, 0, 12.8, 0.42, 2.2, DK);
  if(!lite){ k.put("gloss","box", 0, 0.98, 1.28, 13.2, 0.18, 0.02, c2); k.put("gloss","box", 0, 0.98, -1.28, 13.2, 0.18, 0.02, c2); }
  seAxle(k, -5.2, 0.5, 2.4, lite); seAxle(k, -4.0, 0.5, 2.4, lite);
  /* tractor */
  k.put("solid","box", 8.6, 0.72, 0, 5.4, 0.36, 1.1, DK); k.put("gloss","box", 7.65, 2.25, 0, 1.6, 2.2, 2.4, c2);
  k.put("gloss","box", 9.5, 1.55, 0, 2.1, 1.05, 2.2, c2); if(!lite) k.put("gloss","box", 8.48, 2.75, 0, 0.06, 0.8, 2.2, 0x1a2128, 0, 0, 0.25);
  if(!lite) k.put("metal","box", 10.58, 1.45, 0, 0.08, 0.8, 1.2, CH); k.put("metal","box", 10.7, 0.75, 0, 0.18, 0.3, 2.4, CH);
  if(!lite){ k.put("metal","cyl6", 6.75, 3.0, 1.0, 0.16, 3.0, 0.16, CH); k.put("metal","cyl6", 6.75, 3.0, -1.0, 0.16, 3.0, 0.16, CH); }
  seAxle(k, 9.8, 0.5, 2.3, lite); seAxle(k, 7.2, 0.5, 2.4, lite); if(!lite) seAxle(k, 6.0, 0.5, 2.4, lite);
  if(sides!==0){ var sd=sides||-1, aw=SE_SHIRT[Math.floor(seRng(s+2)*SE_SHIRT.length)];
    k.put("cloth","box", 1.0, 3.1, sd*3.55, 7.0, 0.06, 4.6, aw, sd*0.09, 0, 0);
    k.put("metal","cyl6", -2.4, 1.5, sd*5.7, 0.06, 3.0, 0.06, 0x8d9296); k.put("metal","cyl6", 4.4, 1.5, sd*5.7, 0.06, 3.0, 0.06, 0x8d9296);
    k.put("solid","box", -3.2, 0.5, sd*2.2, 2.2, 0.06, 1.9, 0x8d9296, sd*0.42, 0, 0); }
  if(!lite) seBlob(k, 2.5, 0, 18, 4.2);
}
/* a pickup or dually towing an open car trailer, a race car on it */
function sePfHauler(k, s, lite){
  var c=SE_LIV[Math.floor(seRng(s+4)*SE_LIV.length)], car=SE_SHIRT[Math.floor(seRng(s+5)*SE_SHIRT.length)];
  sePfPickupBody(k, 3.6, c, lite);
  k.put("solid","box", -2.6, 0.62, 0, 6.2, 0.14, 2.2, 0x3b3f45); k.put("metal","box", 0.9, 0.55, 0, 1.4, 0.1, 0.12, 0x8d9296);
  seAxle(k, -2.4, 0.36, 2.3, lite); seAxle(k, -3.3, 0.36, 2.3, lite);
  sePfRaceCar(k, -2.6, 0.7, car, lite);
  if(!lite) seBlob(k, 0.5, 0, 13, 3.2);
}
/* the pickup shell used by the haulers and the parked cars (the real push truck is saltPickup) */
function sePfPickupBody(k, x, c, lite){
  k.put("gloss","box", x+0.8, 1.0, 0, 1.6, 0.45, 1.8, c); k.put("gloss","box", x-0.5, 1.15, 0, 1.2, 0.75, 1.8, c);
  k.put("gloss","box", x-0.48, 1.72, 0, 1.0, 0.45, 1.68, 0x1a2128); k.put("gloss","box", x-2.0, 0.98, 0, 1.9, 0.5, 1.8, c);
  k.put("metal","box", x+1.65, 0.65, 0, 0.12, 0.18, 1.85, 0xc9ccd0);
  seAxle(k, x+1.1, 0.38, 1.9, lite); seAxle(k, x-2.1, 0.38, 1.9, lite);
}
/* a low race car: a slab-sided hull, a cockpit hump, a roll hoop */
function sePfRaceCar(k, x, y, c, lite){
  k.put("gloss","box", x, y+0.42, 0, 4.2, 0.45, 1.05, c); k.put("gloss","cone", x+2.4, y+0.42, 0, 0.6, 0.8, 0.9, c, 0, PI/4, -PI/2);
  k.put("gloss","box", x-0.6, y+0.78, 0, 0.9, 0.3, 0.6, 0x1a2128);
  seAxle(k, x-1.3, 0.34, 1.5, lite); seAxle(k, x+1.4, 0.32, 1.5, lite);
}
/* a motorhome: cab-over front, stripe, window band, roof unit, a striped awning out on one side */
function sePfMotorhome(k, s, lite){
  var c=[0xf1efe8,0xe9e3d4,0xdcdcd8][Math.floor(seRng(s)*3)], st=[0x9e2a22,0x22488f,0x7a5a2a,0x2a7d8c,0x3b3f45][Math.floor(seRng(s+1)*5)];
  k.put("gloss","box", -0.4, 1.95, 0, 8.8, 2.9, 2.5, c); k.put("gloss","box", 4.4, 1.15, 0, 1.2, 1.3, 2.4, c);
  k.put("gloss","box", 4.95, 1.55, 0, 0.06, 0.62, 2.2, 0x1a2128, 0, 0, 0.3); k.put("gloss","box", 3.9, 3.0, 0, 1.4, 0.8, 2.4, c);
  k.put("gloss","box", 0, 1.35, 0, 10.1, 0.22, 2.53, st); k.put("gloss","box", -1.2, 2.45, 0, 6.0, 0.5, 2.53, 0x1a2128);
  if(!lite){ k.put("solid","box", -2.2, 3.5, 0, 1.0, 0.25, 0.8, 0xd0d3d6); k.put("cloth","box", -1.0, 2.9, 2.6, 4.8, 0.04, 2.6, st, -0.12, 0, 0);
    k.put("metal","cyl6", -3.3, 1.4, 3.85, 0.05, 2.8, 0.05, 0x8d9296); k.put("metal","cyl6", 1.3, 1.4, 3.85, 0.05, 2.8, 0.05, 0x8d9296);
    seBlob(k, 0, 0, 12, 3.6); }
  seAxle(k, 3.3, 0.48, 2.3, lite); seAxle(k, -2.6, 0.48, 2.3, lite);
}
/* an EZ-Up: four legs, valance, peaked top; a table and chairs under it */
function sePfEzUp(k, s, lite, sz){
  var c=SE_SHIRT[Math.floor(seRng(s+9)*SE_SHIRT.length)], h=sz/2-0.05;
  for(var q=0;q<4;q++) k.put("metal","box", (q>>1)?h:-h, 1.2, (q&1)?h:-h, 0.05, 2.4, 0.05, 0x8d9296);
  k.put("cloth","box", 0, 2.4, 0, sz, 0.24, sz, c); k.put("cloth","sePyr", 0, 2.52, 0, sz, 0.62, sz, c);
  k.put("solid","box", 0, 0.72, 0, 1.8, 0.05, 0.7, 0xeeeae0); if(!lite) for(q=0;q<2;q++) k.put("solid","box", 0, 0.38, (q?1:-1)*0.75, 0.75, 0.75, 0.5, 0x1d4787);
  if(!lite) seBlob(k, 0, 0, sz+0.6, sz+0.6);
}
function sePfGolfCart(k, s, lite){
  var c=[0xf1efe8,0x2c6b3a,0xc8331f,0x1f4f9a,0xd9a52b][Math.floor(seRng(s)*5)];
  k.put("gloss","box", 0, 0.55, 0, 2.3, 0.45, 1.15, c); k.put("solid","box", -0.35, 0.95, 0, 0.12, 0.55, 1.05, 0x1d1f22);
  k.put("gloss","box", -0.1, 1.95, 0, 2.0, 0.06, 1.25, 0xf1efe8);
  [[0.75,0.55],[0.75,-0.55],[-0.8,0.55],[-0.8,-0.55]].forEach(function(p){ k.put("metal", lite?"box":"cyl6", p[0], 1.3, p[1], 0.04, 1.3, 0.04, 0x8d9296); });
  seAxle(k, 0.75, 0.22, 1.05, lite); seAxle(k, -0.75, 0.22, 1.05, lite);
}
function sePfScooter(k, s, lite){
  var c=SE_SHIRT[Math.floor(seRng(s+3)*SE_SHIRT.length)];
  k.put("gloss","box", 0, 0.3, 0, 1.15, 0.16, 0.36, c); k.put("solid","box", -0.25, 0.62, 0, 0.45, 0.12, 0.3, 0x1d1f22);
  k.put("metal","box", 0.52, 0.65, 0, 0.05, 0.85, 0.05, 0x8d9296, 0, 0, -0.2); k.put("metal","box", 0.6, 1.05, 0, 0.05, 0.05, 0.6, 0x1d1f22);
  if(!lite){ k.put("solid","seWheelL", 0.48, 0.18, 0, 0.36, 0.36, 0.1, 0x18181a); k.put("solid","seWheelL", -0.45, 0.18, 0, 0.36, 0.36, 0.1, 0x18181a); }
}
function sePfToolCart(k, s, lite){
  var c=[0xb7261d,0x1d1f22,0x1d4787,0xc85a17][Math.floor(seRng(s+6)*4)];
  k.put("gloss","box", 0, 0.62, 0, 0.95, 0.85, 0.55, c); if(!lite) for(var q=0;q<3;q++) k.put("metal","box", 0.48, 0.42+q*0.24, 0, 0.02, 0.03, 0.4, 0xc9ccd0);
  k.put("metal","box", -0.56, 1.0, 0, 0.04, 0.04, 0.5, 0xc9ccd0); k.put("solid","box", 0, 0.12, 0, 0.8, 0.16, 0.45, 0x18181a);
}
function sePfFeather(k, s){
  var c=[0xff7a1a,0x1d4787,0xd9a52b,0xb7261d,0x2c6b3a][Math.floor(seRng(s)*5)];
  k.put("metal","cyl6", 0, 2.1, 0, 0.04, 4.2, 0.04, 0x8d9296); k.put("cloth","plane", 0.38, 2.6, 0, 0.72, 3.0, 1, c);
}
/* a person: legs, torso, head, maybe a cap; seated ones sit lower with their legs out */
function sePfPerson(k, s, lite, seated){
  var sh=SE_SHIRT[Math.floor(seRng(s)*SE_SHIRT.length)], pa=SE_PANTS[Math.floor(seRng(s+1)*SE_PANTS.length)], sk=SE_SKIN[Math.floor(seRng(s+2)*SE_SKIN.length)], ht=0.92+seRng(s+3)*0.16;
  if(lite){ k.put("solid","box", 0, ht*0.75, 0, 0.3, ht*1.5, 0.42, sh); k.put("solid","box", 0, ht*1.63, 0, 0.22, 0.24, 0.2, sk); return; }
  if(seated){ k.put("solid","box", 0.25, 0.5, 0, 0.55, 0.18, 0.34, pa); k.put("solid","box", 0.5, 0.25, 0, 0.14, 0.5, 0.3, pa);
    k.put("solid","cyl6", 0, 0.92, 0, 0.4, 0.62, 0.3, sh); k.put("skin","seHead", 0, 1.38, 0, 0.23, 0.26, 0.23, sk);
    k.put("solid","box", 0.05, 0.3, 0, 0.5, 0.6, 0.5, 0x1d4787); return; }
  k.put("solid","box", 0, ht*0.43, 0, 0.22, ht*0.86, 0.3, pa); k.put("solid","cyl6", 0, ht*1.17, 0, 0.42, ht*0.62, 0.3, sh);
  k.put("skin","seHead", 0, ht*1.62, 0, 0.23, 0.26, 0.23, sk);
  if(seRng(s+4)<0.4) k.put("solid","cyl6", 0.04, ht*1.62+0.12, 0, 0.26, 0.07, 0.26, [0xf4efe2,0xff7a1a,0x1d1f22,0x1d4787][Math.floor(seRng(s+5)*4)]);
}

/* --- the town: rows of pits behind the start, a return road, spectators behind the cones --- */
function saltPitTown(B, lite){
  var ult=(GFX==="ultra"), inst=!lite, pits=new SeKit(B, inst), line=new SeKit(B, inst), road=new SeKit(B, inst), i, k, x, z, s=11;
  SALT.town=[];
  /* rows of pits, aisles along x between them: rigs nose toward the line, EZ-Ups and carts in the gaps */
  var rows=lite?[{z:-54, n:4},{z:-78, n:3}]:[{z:-54, n:ult?8:7},{z:-78, n:ult?7:6},{z:-102, n:ult?8:5}];
  rows.forEach(function(r, ri){ var span=330/r.n;
    for(i=0;i<r.n;i++){ x=-232+span*(i+0.5)+(seRng(s)-0.5)*span*0.25; z=r.z+(seRng(s+1)-0.5)*3; var yaw=(seRng(s+2)-0.5)*0.12, kind=seRng(s+3);
      pits.at(x, z, yaw);
      if(kind<0.55) sePfRig(pits, s, lite, -1); else if(kind<0.8) sePfHauler(pits, s, lite); else sePfMotorhome(pits, s, lite);
      /* the pit around it: an EZ-Up with the car work under it, a tool cart, people */
      if(!lite || i%2===0){ var ex=x+(seRng(s+4)-0.5)*6, ez=z-8.5-seRng(s+5)*2; pits.at(ex, ez, (seRng(s+6)-0.5)*0.3); sePfEzUp(pits, s, lite, 3);
        if(!lite && seRng(s+7)<0.6){ pits.at(ex, ez, PI*(seRng(s+8)<0.5?0:1)); sePfRaceCar(pits, 0, 0.0, SE_SHIRT[Math.floor(seRng(s+8)*SE_SHIRT.length)], lite); }
        pits.at(ex+2.4, ez+1.2, seRng(s+9)*TAU); sePfToolCart(pits, s, lite);
        if(!lite){ var np=1+Math.floor(seRng(s+10)*(ult?3.5:2)); for(k=0;k<np;k++){ pits.at(ex+(seRng(s+11+k)-0.5)*5, ez+(seRng(s+15+k)-0.5)*4, seRng(s+19+k)*TAU); sePfPerson(pits, s*7+k, lite, false); } } }
      s+=23; }
  });
  /* the back row: motorhomes and haulers' living quarters */
  var nm=lite?1:(ult?11:6);
  for(i=0;i<nm;i++){ pits.at(-226+i*(330/nm)+seRng(s)*6, lite?-100:-122, (seRng(s+1)-0.5)*0.1+(i%2?PI:0)); sePfMotorhome(pits, s, lite); s+=7; }
  /* golf carts and scooters parked in the aisles, feather flags at pit corners */
  var ng=lite?2:(ult?14:10);
  for(i=0;i<ng;i++){ x=-220+seRng(s)*320; z=[-66,-90,-112][i%(lite?1:3)]+(seRng(s+1)-0.5)*3; pits.at(x, z, seRng(s+2)*TAU);
    if(i%3===2) sePfScooter(pits, s, lite); else sePfGolfCart(pits, s, lite);
    if(!lite && i%2===0){ pits.at(x+1.6, z+0.8, seRng(s+3)*TAU); sePfPerson(pits, s+5, lite, false); }
    s+=5; }
  if(!lite) for(i=0;i<(ult?14:9);i++){ pits.at(-228+i*(330/(ult?14:9))+seRng(s)*8, -44.5-seRng(s+1)*2, -PI/2); sePfFeather(pits, s); s+=3; }
  /* walkers in the aisles (Full/Ultra) */
  if(!lite) for(i=0;i<(ult?36:12);i++){ pits.at(-225+seRng(s)*325, [-66,-90,-112,-44][i%4]+(seRng(s+1)-0.5)*5, seRng(s+2)*TAU); sePfPerson(pits, s, lite, false); s+=3; }
  /* the start: a handful of officials and crew well off the line, clear of the push and stage cameras */
  pits.at(-22, -21, 0.4); sePfGolfCart(pits, 991, lite); pits.at(-16, -22.5, 0); sePfToolCart(pits, 992, lite);
  if(!lite) [[-19,-19.5],[-13,-21.5],[-24,-23],[-10,-24]].forEach(function(p,q){ pits.at(p[0], p[1], 1.2+q); sePfPerson(pits, 500+q, lite, false); });
  /* spectators along the course behind the left cones, folding chairs, EZ-Ups and their cars and pickups behind them */
  var x1=lite?320:(ult?900:560), st=lite?22:(ult?2.6:4.6);
  for(x=40; x<x1; x+=st*(0.7+seRng(s)*0.6)){ s+=3; if(seRng(s+1)<0.12) continue;
    var seat=seRng(s+2)<0.35; line.at(x, -21.2-seRng(s+3)*1.5, seat?-PI/2:(-PI/2+(seRng(s+4)-0.5)*1.2)); sePfPerson(line, s, lite, seat); }
  for(x=46; x<x1; x+=(lite?90:15)+seRng(s)*10){ s+=5; var kz=-28.5-seRng(s+1)*2.5;
    if(seRng(s+2)<0.35 && !lite){ line.at(x, -25.2, 0); sePfEzUp(line, s, lite, 3); }
    line.at(x+4, kz, (seRng(s+3)<0.5?0:PI)+(seRng(s+4)-0.5)*0.2);
    if(seRng(s+5)<0.5) sePfPickupBody(line, 0, SE_LIV[Math.floor(seRng(s+6)*SE_LIV.length)], lite); else sePfMotorhome(line, s, lite); }
  /* traffic on the return road: crews driving back to the pits */
  [[420,0],[260,1],[1300,1],[2600,0],[3900,1],[6200,0]].slice(0, lite?1:6).forEach(function(p, q){ road.at(p[0], -37.8+(p[1]?1.6:-1.6), p[1]?PI:0); sePfPickupBody(road, 0, SE_LIV[(q*3)%SE_LIV.length], lite); });
  if(inst){ var a=pits.build(SALT.scene), b=line.build(SALT.scene); road.build(SALT.scene);   /* the road's few trucks span the course: tiny, never dropped */
    SALT.town.push({ms:a, c:new THREE.Vector3(-60,0,-85)}, {ms:b, c:new THREE.Vector3(300,0,-26)}); }
  saltReturnRoad();
}
/* the return road: a graded lane beside the course, two darker wheel tracks, soft edges */
function saltReturnRoad(){
  var cv=newCanvas(16,128), x=cv.getContext("2d"), y, a;
  for(y=0;y<128;y++){ var u=y/127, edge=Math.min(1, Math.min(u, 1-u)*6), tr=Math.exp(-Math.pow((u-0.3)/0.06,2))+Math.exp(-Math.pow((u-0.7)/0.06,2));
    a=edge*(0.22+0.32*tr); x.fillStyle="rgba(120,112,100,"+a.toFixed(3)+")"; x.fillRect(0,y,16,1); }
  var t=new THREE.CanvasTexture(cv); t.wrapS=THREE.RepeatWrapping;
  var L=12600, g=new THREE.PlaneGeometry(L, 8).rotateX(-PI/2);
  var m=new THREE.Mesh(g, new THREE.MeshBasicMaterial({map:t, transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-3}));
  m.position.set(70+L/2, 0.01, -37.8); m.renderOrder=1; SALT.scene.add(m); SALT.road=m;
}

/* --- the push truck: a 60s-style pickup, two-tone, padded push bar, a crew member riding the bed. o: {crew, beacon, roof, stripe} --- */
function saltPickup(col, o){
  o=o||{}; seGeo(); var lite=(GFX==="lite"), g=new THREE.Group(), B=new StripBatch(), DK=0x1d1f22, CH=0xc9ccd0, GL=0x182028, roof=o.roof!=null?o.roof:0xf1efe8;
  var paint=new THREE.MeshStandardMaterial({color:sc(col), roughness:0.3, metalness:0.25});
  function P(key, x,y,z, w,h,d, c, rz, gn){ B.add(key, gn||"box", [x,y,z], [w,h,d], c, rz?[0,0,rz]:null); }
  /* paint ("p", the material colour) */
  P("p", -0.45, 1.0, 0, 1.75, 0.42, 1.8, 0xffffff); P("p", -1.975, 1.02, 0, 1.35, 0.46, 1.86, 0xffffff);
  P("p", -3.75, 1.02, 0.9, 2.2, 0.48, 0.06, 0xffffff); P("p", -3.75, 1.02, -0.9, 2.2, 0.48, 0.06, 0xffffff); P("p", -4.83, 1.02, 0, 0.06, 0.48, 1.8, 0xffffff);
  P("p", -1.42, 1.5, 0.84, 0.07, 0.6, 0.07, 0xffffff, 0.4); P("p", -1.42, 1.5, -0.84, 0.07, 0.6, 0.07, 0xffffff, 0.4);
  P("p", -2.52, 1.52, 0.84, 0.09, 0.56, 0.08, 0xffffff); P("p", -2.52, 1.52, -0.84, 0.09, 0.56, 0.08, 0xffffff);
  /* the rest ("g": vertex colours) */
  P("g", -2.05, 1.83, 0, 1.18, 0.08, 1.76, roof); P("g", -2.0, 1.52, 0, 1.0, 0.54, 1.68, GL); P("g", -1.42, 1.5, 0, 0.05, 0.6, 1.62, GL, 0.4);
  P("g", 0.44, 0.92, 0, 0.06, 0.34, 1.5, CH); P("g", 0.47, 0.92, 0, 0.02, 0.24, 1.2, DK); P("g", 0.47, 0.93, 0.66, 0.04, 0.16, 0.18, 0xf4f1e0); P("g", 0.47, 0.93, -0.66, 0.04, 0.16, 0.18, 0xf4f1e0);
  P("g", 0.55, 0.62, 0, 0.14, 0.18, 1.9, CH); P("g", -4.92, 0.62, 0, 0.12, 0.16, 1.9, CH);
  P("g", -4.87, 1.12, 0.84, 0.04, 0.18, 0.1, 0xb01c14); P("g", -4.87, 1.12, -0.84, 0.04, 0.18, 0.1, 0xb01c14);
  P("g", -2.2, 1.12, 0.935, 5.2, 0.07, 0.01, o.stripe!=null?o.stripe:roof); P("g", -2.2, 1.12, -0.935, 5.2, 0.07, 0.01, o.stripe!=null?o.stripe:roof);
  P("s", -1.9, 0.52, 0, 5.0, 0.18, 1.0, DK); P("s", -3.75, 0.8, 0, 2.2, 0.06, 1.74, 0x2a2b2e);
  P("s", 0.68, 0.85, 0.45, 0.12, 0.62, 0.1, DK); P("s", 0.68, 0.85, -0.45, 0.12, 0.62, 0.1, DK); P("s", 0.7, 0.6, 0, 0.1, 0.1, 1.0, DK);
  P("s", 0.82, 0.88, 0, 0.16, 0.36, 1.3, 0x121314);
  P("s", -1.33, 1.42, 1.0, 0.05, 0.16, 0.13, DK); P("s", -1.33, 1.42, -1.0, 0.05, 0.16, 0.13, DK);
  if(o.crew){ /* standing in the bed behind the cab, hands on the roof */
    var cx=-2.95, cz=0.42, fl=0.83; P("s", cx, fl+0.43, cz, 0.3, 0.86, 0.26, 0x1d1f22, 0, "cyl6"); P("g", cx, fl+1.17, cz, 0.44, 0.64, 0.32, 0xff6a14, 0, "cyl6");
    P("s", cx, fl+1.63, cz, 0.23, 0.26, 0.23, 0xc89a78, 0, "seHead"); P("g", cx+0.03, fl+1.76, cz, 0.27, 0.08, 0.27, 0xf1efe8, 0, "cyl6");
    [-1,1].forEach(function(sd){ B.add("g","box",[cx+0.24, fl+1.2, cz+sd*0.22],[0.55,0.09,0.09],0xff6a14,[0,0,-0.62]); });
    if(!lite){ P("s", -1.95, 1.5, -0.35, 0.36, 0.5, 0.3, 0x2a2b2e, 0, "cyl6"); P("s", -1.95, 1.74, -0.35, 0.2, 0.22, 0.2, 0x6e4a33, 0, "seHead"); } }
  if(o.beacon) P("b", -1.98, 1.93, 0, 0.26, 0.1, 1.3, 0xffffff);
  var WP=[[-3.5,-0.82],[-3.5,0.82],[-0.3,-0.82],[-0.3,0.82]], stat=lite&&!!o.beacon;   /* Lite's safety truck: tyres merged into the body, they don't need to roll */
  if(stat) WP.forEach(function(p){ B.add("s","cyl",[p[0],0.38,p[1]],[0.76,0.24,0.76],0x18181a,[PI/2,0,0]); });
  var keep=STRIP.scene; STRIP.scene=g;
  var mp=B.build("p", paint, !lite), mg=B.build("g", SALT.mats.solid.clone(), !lite), ms=B.build("s", SALT.mats.solid, !lite), mb=null;
  mg.material.roughness=0.35; mg.material.metalness=0.3;
  if(o.beacon){ var bm=new THREE.MeshStandardMaterial({color:sc(0xff8a1a), emissive:sc(0xff6a00), emissiveIntensity:2, roughness:0.4}); mb=B.build("b", bm, false); }
  /* wheels: Full rolls real ones; Lite merges tyre and hub into one mesh per wheel */
  var wh=[], M=sc_mats();
  WP.forEach(function(p){ if(stat) return;
    if(!lite){ var w=sc_wheel({x:p[0], z:p[1], r:0.38, w:0.24, rimR:0.2, style:"star", rimMat:"alu"}, M); w.position.set(p[0],0.38,p[1]); g.add(w); wh.push(w.userData.spin); return; }
    var spin=new THREE.Group(); spin.rotation.x=PI/2; spin.position.set(p[0],0.38,p[1]); var wb=new StripBatch();
    wb.add("w","cyl",[0,0,0],[0.76,0.24,0.76],0x18181a); wb.add("w","cyl6",[0,0,0],[0.42,0.26,0.42],0xc9ccd0); wb.add("w","box",[0,0,0],[0.08,0.27,0.4],0x5a5d62);
    STRIP.scene=spin; wb.build("w", SALT.mats.solid, false); g.add(spin); wh.push(spin); });
  STRIP.scene=keep;
  g.userData={wheels:wh, front:0.9, paint:paint, beacon:mb, col:col};
  return g;
}
/* what colour the push truck wears: a colour vis/salt.js sets (SALT.pushColor, or a repaint of saltPushTruck), else whatever stands out from the car */
function saltPushCol(carCol){
  if(typeof SALT.pushColor==="number") return SALT.pushColor;
  if(SALT.pushFixed===undefined){ SALT.pushFixed=null;
    try{ var g=saltPushTruck(), c=null; g.traverse(function(q){ if(!c && q.isMesh && q.material && q.material.color) c=q.material.color; });
      var old=sc(0x2c6b3a); if(c && Math.abs(c.r-old.r)+Math.abs(c.g-old.g)+Math.abs(c.b-old.b)>0.02) SALT.pushFixed=c.clone().convertLinearToSRGB().getHex(); }catch(e){} }
  if(SALT.pushFixed!=null) return SALT.pushFixed;
  var cc=new THREE.Color(carCol==null?0xd9a52b:carCol), best=SALT_PUSH_PAL[0], bd=-1;
  SALT_PUSH_PAL.forEach(function(h){ _seCol.set(h); var d=Math.pow(_seCol.r-cc.r,2)*0.3+Math.pow(_seCol.g-cc.g,2)*0.59+Math.pow(_seCol.b-cc.b,2)*0.11+Math.abs((_seCol.r+_seCol.g+_seCol.b)-(cc.r+cc.g+cc.b))*0.05; if(d>bd){ bd=d; best=h; } });
  return best;
}

/* --- spins: the car lifts, rolls a little, swaps ends and slides off line; the pose holds once it stops --- */
function saltSpinPose(V, o, dt, ph){
  var P=SALT.sp||(SALT.sp={on:false, t:0, yaw:0, z:0});
  if(ph!=="spin" && !(ph==="done" && P.on)){ if(P.on){ P.on=false; } V.rotation.set(0,0,0); V.position.y=0; V.position.z=0; return; }
  var v=Math.max(0,+o.v||0);
  if(!P.on){ P.on=true; P.t=0; P.yaw=0; P.z=0; P.v0=v; P.side=(Math.floor(Math.abs(+o.x||0)*0.37)%2)?1:-1; P.landed=false; P.start=true; }
  if(ph==="spin"){ P.t+=dt; var w=clamp(v/13,0.25,3.4)*smoothstep(0,0.45,P.t); P.yaw+=P.side*w*dt;
    P.z=clamp(P.z+P.side*v*0.045*smoothstep(0.2,1.2,P.t)*Math.abs(Math.sin(P.yaw*0.5+0.3))*dt, -18, 18); }
  var t=P.t, A=clamp(P.v0/110,0.12,1), lift=0, nose=0;
  if(P.v0>30){ if(t<0.9){ lift=A*0.62*Math.sin(PI*t/0.9); nose=A*0.1*Math.sin(PI*t/0.9); } else if(t<1.3) lift=A*0.12*Math.sin(PI*(t-0.9)/0.4); }
  if(t>=0.9 && !P.landed){ P.landed=true; P.land=P.v0>30; }
  var roll=P.side*A*0.3*Math.sin(PI*clamp(t/1.3,0,1)) - 0.07*clamp(v/50,0,1)*Math.sin(P.yaw);
  V.rotation.order="YXZ"; V.rotation.set(roll, P.yaw, nose); V.position.y=lift; V.position.z=P.z;
}
/* skid and scuff marks: instanced quads in a ring buffer, laid along each tyre's path */
function seMarks(){
  if(SALT.mk) return SALT.mk;
  var cap=GFX==="lite"?240:(GFX==="ultra"?1400:720), g=new THREE.PlaneGeometry(1,1); g.rotateX(-PI/2);
  var m=new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.6, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-4}), cap);
  m.setColorAt(0, _seCol.setRGB(1,1,1)); m.count=0; m.visible=false; m.frustumCulled=false; m.renderOrder=2;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.instanceColor.setUsage(THREE.DynamicDrawUsage); SALT.scene.add(m);
  return (SALT.mk={mesh:m, cap:cap, i:0, n:0, last:null});
}
function seMark(ax, az, bx, bz, w, shade){
  var K=seMarks(), dx=bx-ax, dz=bz-az, len=Math.sqrt(dx*dx+dz*dz); if(len<0.05) return;
  _seQ.setFromAxisAngle(_seP.set(0,1,0), Math.atan2(-dz, dx));
  _seM.compose(_seA.set((ax+bx)/2, 0.014, (az+bz)/2), _seQ, _seS.set(len+w*0.4, 1, w));
  K.mesh.setMatrixAt(K.i, _seM); K.mesh.setColorAt(K.i, _seCol.setRGB(0.2+0.55*shade, 0.185+0.55*shade, 0.17+0.55*shade));
  K.i=(K.i+1)%K.cap; K.n=Math.min(K.cap, K.n+1); K.mesh.count=K.n; K.mesh.visible=true; K.mesh.instanceMatrix.needsUpdate=true; K.mesh.instanceColor.needsUpdate=true;
}
function seMarksClear(){ var K=SALT.mk; if(!K) return; K.i=0; K.n=0; K.mesh.count=0; K.mesh.visible=false; K.last=null; }
/* the car's tyre contact points, car-local [x, z, rear?] */
function seContacts(U){
  if(U.seCt) return U.seCt; var me=U.me, L=[];
  if(U.wheels && U.wheels.length) U.wheels.forEach(function(W){ var p=W.s.parent.position; L.push([p.x, p.z, !!W.rear, W.r]); });
  else { var tw=U.strip?0.78:0.7; L=[[0,tw,true,0.34],[0,-tw,true,0.34],[me.wb||2.6,tw,false,0.32],[me.wb||2.6,-tw,false,0.32]]; }
  return (U.seCt=L);
}
function seMarksUpdate(o, V, ph){
  var U=V.userData, v=Math.max(0,+o.v||0), slip=clamp(+o.slip||0,0,1), P=SALT.sp, spin=(P&&P.on&&ph==="spin"), K=seMarks(), C=seContacts(U);
  var cur={x:V.position.x, z:V.position.z, yaw:V.rotation.y}, run=(ph==="run"||ph==="shutdown");
  var lay=(spin && V.position.y<0.03 && v>1.2) || (run && slip>0.28 && v>6);
  if(!lay || !K.last){ K.last=lay?cur:null; return; }
  var L=K.last, d=Math.abs(cur.x-L.x)+Math.abs(cur.z-L.z)+Math.abs(cur.yaw-L.yaw)*2.5; if(d<0.6) return;
  var n=Math.min(24, Math.max(1, Math.ceil(d/1.2))), i, j, sh=spin?0.0:0.55;
  for(j=0;j<C.length;j++){ if(!spin && !C[j][2]) continue; var w=clamp(C[j][3]*0.75,0.18,0.34);
    var px=null, pz=null;
    for(i=0;i<=n;i++){ var f=i/n, x=lerp(L.x,cur.x,f), z=lerp(L.z,cur.z,f), y=lerp(L.yaw,cur.yaw,f), cs=Math.cos(y), sn=Math.sin(y);
      var wx=x+C[j][0]*cs+C[j][1]*sn, wz=z-C[j][0]*sn+C[j][1]*cs;
      if(px!==null) seMark(px, pz, wx, wz, w, sh+(spin?0.25*Math.abs(Math.cos(y)):0)); px=wx; pz=wz; } }
  K.last=cur;
}
/* salt dust: billowing clouds while it slides, a ring when it lands from the lift */
function seSpinDust(o, dt, V){
  var P=SALT.sp, FX=SALT.fx, lite=GFX==="lite", R=Math.random, v=Math.max(0,+o.v||0), i;
  if(!P || !P.on || !FX) return;
  if(P.land){ P.land=false; for(i=0;i<(lite?10:26);i++){ var a=i/(lite?10:26)*TAU; FX.emit(V.position.x+Math.cos(a)*1.5, 0.3, V.position.z+Math.sin(a)*1.5, Math.cos(a)*6+v*0.3, 0.8+R(), Math.sin(a)*6, 2.5+R()*2, 1.2, 6+R()*4, 0.95, 0.95, 0.93, 0.42, {drag:1.2, buoy:0.1, fin:0.05, spin:0.4}); } }
  if(v<1.5 || V.position.y>0.05) return;
  var nc=(lite?0.5:1)*clamp(v/20,0.3,3)*30*dt, n=Math.floor(nc)+(R()<nc%1?1:0), C=seContacts(V.userData), cs=Math.cos(V.rotation.y), sn=Math.sin(V.rotation.y);
  for(i=0;i<n;i++){ var c=C[Math.floor(R()*C.length)], wx=V.position.x+c[0]*cs+c[1]*sn, wz=V.position.z-c[0]*sn+c[1]*cs;
    FX.emit(wx, 0.25+R()*0.3, wz, v*(0.2+R()*0.3), 0.5+R()*1.4, (R()-0.5)*4, 3+R()*3, 0.8, 5+R()*5+v*0.04, 0.95, 0.95, 0.93, 0.36, {drag:0.75, buoy:0.12, fin:0.1, spin:0.35}); }
}
/* the safety truck: rolls from the next station down the course to the stopped car, beacon going */
function seSafety(o, dt, V){
  var P=SALT.sp, T=SALT.safety;
  if(!P || !P.on){ if(T) T.visible=false; return; }
  if(!T){ T=SALT.safety=saltPickup(0xf1efe8, {beacon:true, stripe:0xff6a14, roof:0xff6a14}); SALT.scene.add(T); }
  var u=T.userData, v=Math.max(0,+o.v||0);
  if(P.start || !u.st){ P.start=false; var side=-P.side; u.st={x:V.position.x+v*v/(2*7)+50, z:V.position.z+side*20, yaw:PI, v:0, wait:0.5, side:side};   /* from the station just past where the car will stop (salt plus the chute pulls ~0.7 g) */ }
  var S=u.st; S.wait-=dt;
  if(S.wait<0){ var tx=V.position.x-4, tz=V.position.z+S.side*6.5, dx=tx-S.x, dz=tz-S.z, d=Math.sqrt(dx*dx+dz*dz);
    var want=Math.min(30, d*0.7), hd=Math.atan2(-dz, dx), dy=((hd-S.yaw+PI*3)%TAU)-PI;
    if(d>1.2){ S.yaw+=clamp(dy, -1.4*dt, 1.4*dt)*Math.min(1, S.v/3+0.3); } else want=0;
    S.v+=clamp(want-S.v, -8*dt, 5*dt); S.x+=Math.cos(S.yaw)*S.v*dt; S.z-=Math.sin(S.yaw)*S.v*dt; }
  T.position.set(S.x, 0, S.z); T.rotation.y=S.yaw; T.visible=true;
  for(var i=0;i<u.wheels.length;i++) u.wheels[i].rotation.y=(u.wheels[i].rotation.y-S.v/0.38*dt)%TAU;
  if(u.beacon) u.beacon.material.emissiveIntensity=(Math.sin(SALT.t*13)>0.2)?3.2:0.25;
}

/* --- the chute, salt only: thick shroud lines in a colour that reads on salt, a dark tether, a pilot chute that pulls the main out --- */
var SE_PILOT=0.45;
function seChuteList(U){
  if(U.strip){ var cu=U.car&&U.car.userData; return (cu&&cu.chute)?[{ch:cu.chute, A:cu.anim, me:cu.meta}]:[]; }
  var L=[]; for(var i=0;i<U.chutes.length;i++) L.push({ch:U.chutes[i], A:U.A[i], me:U.me}); return L;
}
function seChuteRig(ch){
  var u=ch.userData; if(u.se) return u.se; var M=SALT.mats;
  if(!M.seLine){ M.seLine=new THREE.MeshStandardMaterial({color:sc(0xe0582c), roughness:0.8}); M.seTether=new THREE.MeshStandardMaterial({color:sc(0x26282c), roughness:0.7}); }
  u.lines.forEach(function(l){ l.material=M.seLine; }); u.bridle.material=M.seTether;
  var pc=new THREE.Mesh(u.canopy.geometry, u.canopy.material); pc.castShadow=false; pc.visible=false; ch.add(pc);
  var pl=new THREE.Mesh(SC.geo.chuteLine, M.seLine); pl.visible=false; ch.add(pl);
  return (u.se={pilot:pc, pline:pl, t:-1, bloom:false});
}
function seChutes(o, dt, V, ph){
  var U=V.userData, L=seChuteList(U), FX=SALT.fx, lite=GFX==="lite", R=Math.random, v=Math.max(0,+o.v||0), P=SALT.sp;
  for(var i=0;i<L.length;i++){ var it=L[i], ch=it.ch, me=it.me, A=it.A; if(!ch || !A) continue; var se=seChuteRig(ch), u=ch.userData, cn=u.canopy;
    if(!ch.visible){ se.t=-1; se.bloom=false; se.pilot.visible=se.pline.visible=false; continue; }
    var first=(se.t<0); se.t=first?0:se.t+dt;
    if(se.t<SE_PILOT) A.chT=0;            /* the main stays in its bag until the pilot has pulled it out */
    ch.rotation.y=(P&&P.on)?-V.rotation.y:0;   /* in a spin the chute streams back down the course, whichever way the car points */
    for(var j=0;j<u.lines.length;j++){ u.lines[j].scale.x=u.lines[j].scale.z=4.5; } u.bridle.scale.x=u.bridle.scale.z=3;
    /* pilot */
    var pc=se.pilot, pl=se.pline, rc=me.chuteR||0.9, bob=Math.sin(SALT.t*7+i)*0.08;
    if(se.t<SE_PILOT){ var f=smoothstep(0,SE_PILOT,se.t); _seA.set(-(0.3+me.chuteLen*0.8*f), (me.chuteRise||0.5)*0.9*f+bob, bob*0.6);
      _seB.copy(_seA).negate().normalize(); pc.quaternion.setFromUnitVectors(_seX, _seB); pc.scale.setScalar(0.32*Math.min(1, 0.25+se.t/0.12));
      _seC.copy(cn.position); }
    else { _seB.copy(cn.position).normalize(); var ap=rc*0.62*cn.scale.x;
      _seC.copy(cn.position).addScaledVector(_seB, ap); _seA.copy(_seC).addScaledVector(_seB, 1.6+bob); _seA.y+=bob*0.5;
      pc.quaternion.copy(cn.quaternion); pc.scale.setScalar(0.32*(1-0.45*(A.chC||0))); }
    pc.position.copy(_seA); pc.visible=true; sc_setLine(pl, _seC, _seA); pl.scale.x=pl.scale.z=3.5; pl.visible=true;
    if(!FX) continue;
    /* deploy: the bag kicks a puff of salt off the tail; the main's blossom blasts more off the salt below it */
    if(first){ ch.localToWorld(_seA.set(0,0,0)); for(var q=0;q<(lite?8:20);q++) FX.emit(_seA.x-R()*1.5, 0.2+R()*0.6, _seA.z+(R()-0.5)*1.6, v*0.6, 0.3+R()*1.2, (R()-0.5)*3, 1.5+R()*2, 0.6, 3.5+R()*3, 0.95, 0.95, 0.93, 0.4, {drag:1.0, buoy:0.12, fin:0.05, spin:0.5});
      if(ph==="shutdown" && !SALT.cueDone){ SALT.cue="heli"; SALT.cueDone=true; SALT.cueBack=SALT.t+3.4; } }
    if(!se.bloom && se.t>SE_PILOT+0.3){ se.bloom=true; ch.localToWorld(_seA.copy(cn.position)); for(q=0;q<(lite?8:22);q++){ var a=R()*TAU; FX.emit(_seA.x+Math.cos(a)*rc, 0.2, _seA.z+Math.sin(a)*rc, v*0.5+Math.cos(a)*3, 0.4+R()*0.8, Math.sin(a)*3, 2+R()*2, 1.0, 5+R()*4, 0.95, 0.95, 0.93, 0.34, {drag:0.9, buoy:0.1, fin:0.08, spin:0.4}); } }
  }
  if(SALT.cueBack && SALT.t>SALT.cueBack){ SALT.cueBack=0; if(SALT.shot==="heli" && ph==="shutdown") SALT.cue="chute"; }
}

/* --- per frame, from saltUpdate after the car is posed --- */
function saltEventUpdate(o, dt, V, ph){
  var E=SALT.ev||(SALT.ev={ph:null});
  if(ph==="stage" && E.ph!=="stage"){ seMarksClear(); SALT.cue=null; SALT.cueDone=false; SALT.cueBack=0; if(SALT.safety){ SALT.safety.visible=false; SALT.safety.userData.st=null; } }
  E.ph=ph;
  /* the push truck stands out from whatever the car is painted */
  var pu=SALT.push&&SALT.push.userData; if(pu && pu.paint){ var pc=saltPushCol(o.color); if(pc!==pu.col){ pu.col=pc; pu.paint.color.copy(sc(pc)); } }
  seMarksUpdate(o, V, ph); seSpinDust(o, dt, V); seSafety(o, dt, V); seChutes(o, dt, V, ph);
  /* the town drops out once the camera is miles away from it */
  if(SALT.town && SALT.cam) for(var i=0;i<SALT.town.length;i++){ var T=SALT.town[i], on=SALT.camPos.distanceTo(T.c)<3200; if(T.on!==on){ T.on=on; T.ms.forEach(function(m){ m.visible=on; }); } }
}
