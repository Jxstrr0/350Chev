/* ===========================================================================
   9. PARTICLES (exhaust haze, smoke, sparks)
   ==========================================================================*/
var SPRITE_SOFT=null, SPRITE_SPARK=null;
function softSprite(){
  if(SPRITE_SOFT) return SPRITE_SOFT;
  var c=newCanvas(64,64), x=c.getContext("2d");
  var g=x.createRadialGradient(32,32,1,32,32,31);
  g.addColorStop(0,"rgba(255,255,255,0.95)");
  g.addColorStop(0.45,"rgba(255,255,255,0.42)");
  g.addColorStop(1,"rgba(255,255,255,0)");
  x.fillStyle=g; x.fillRect(0,0,64,64);
  SPRITE_SOFT=new THREE.CanvasTexture(c);
  return SPRITE_SOFT;
}
function sparkSprite(){
  if(SPRITE_SPARK) return SPRITE_SPARK;
  var c=newCanvas(32,32), x=c.getContext("2d");
  var g=x.createRadialGradient(16,16,0,16,16,15);
  g.addColorStop(0,"rgba(255,244,200,1)");
  g.addColorStop(0.3,"rgba(255,170,50,0.85)");
  g.addColorStop(1,"rgba(255,80,0,0)");
  x.fillStyle=g; x.fillRect(0,0,32,32);
  SPRITE_SPARK=new THREE.CanvasTexture(c);
  return SPRITE_SPARK;
}
var PKIND = {
  smokeBlue: {color:0x7d9ccf, opacity:0.42, life:2.8, scale:1.5, vy:3.6, grow:3.0},
  smokeGrey: {color:0x8d8f93, opacity:0.50, life:2.4, scale:1.4, vy:4.0, grow:3.2},
  steam:     {color:0xf2f4f6, opacity:0.55, life:1.4, scale:0.8, vy:7.5, grow:3.8},
  flame:     {color:0xffb040, opacity:1.0,  life:0.28, scale:1.1, vy:2.0, grow:1.8, add:true, spark:true},
  oil:       {color:0x0c0a08, opacity:0.95, life:1.6, scale:0.16, vy:3.0, grow:0.9, drop:true, spread:4.5},
  smokeBlack:{color:0x0a0a0b, opacity:0.62, life:2.6, scale:0.9, vy:3.0, grow:3.4},
  coolant:   {color:0x59d98a, opacity:0.85, life:1.5, scale:0.13, vy:5.0, grow:0.9, drop:true, spread:5.0},
  purge:     {color:0xffffff, opacity:0.72, life:0.75, scale:0.30, vy:0.0, grow:7.5, spread:2.2}
};
/* nitrous purge in the engine view: a white jet from the purge nozzle that blooms and is gone in under a second */
var N2O_FX = {t:0, acc:0}, _n2oA = new THREE.Vector3(), _n2oB = new THREE.Vector3();
function n2oPurgeStep(dt){
  if(N2O_FX.t<=0 || !N2O_PURGE || !N2O_PURGE.parent){ N2O_FX.t=0; return; }
  N2O_FX.t-=dt; N2O_FX.acc+=dt*(GFX==="lite"?38:70);
  N2O_PURGE.updateMatrixWorld(true); N2O_PURGE.getWorldPosition(_n2oA);
  _n2oB.copy(N2O_PURGE.userData.n2oPurge).transformDirection(N2O_PURGE.parent.matrixWorld);
  while(N2O_FX.acc>=1){ N2O_FX.acc-=1; emit("purge", _n2oA); var q=particles[particles.length-1], u=q.userData, sp=9+Math.random()*7;
    u.vx=_n2oB.x*sp+(Math.random()-0.5)*2.2; u.vy=_n2oB.y*sp+(Math.random()-0.5)*1.6; u.vz=_n2oB.z*sp+(Math.random()-0.5)*2.2; u.life=0.45+Math.random()*0.45; }
}
/* anti-lag in the engine view: irregular fireballs out of the exhaust tip while it fires (lift-off, shifts, staging) */
var ALS_FX = {amt:0, n:0}, _alsP = new THREE.Vector3();
function alsStep(dt){
  var a=ALS_FX.amt; if(a<=0.02 || !fxRoot || run.fail) return;
  if(Math.random() > dt*(GFX==="lite"?7:11)*a) return;
  _alsP.copy(exhaustPoint()); ALS_FX.n++;
  var k=0.6+0.6*Math.random()*a, nn=GFX==="lite"?4:8;
  for(var i=0;i<nn;i++){ _tmpV2.copy(_alsP); _tmpV2.x+=(Math.random()-0.5)*0.25; _tmpV2.z+=(Math.random()-0.5)*0.25; emit("flame", _tmpV2);
    var q=particles[particles.length-1]; if(q){ var u=q.userData; u.s0*=1.0+k; u.life*=0.8+0.6*Math.random(); u.vx*=2.2; u.vz*=2.2; u.vy*=1.4; } }
  if(Math.random()<0.5) emit("smokeGrey", _alsP);
  flashAt(_alsP, 0xff8a30, 1.8+2.6*k*a);
  if(camState) camState.shake=Math.max(camState.shake, 0.04*a);
}
function emit(kind, pos){
  var mat, life, scale, vy;
  var K2 = PKIND[kind];
  if(K2){
    mat=new THREE.SpriteMaterial({map:K2.spark?sparkSprite():softSprite(), color:K2.color, transparent:true, opacity:K2.opacity, depthWrite:false,
         blending:K2.add?THREE.AdditiveBlending:THREE.NormalBlending});
    var sp=new THREE.Sprite(mat); sp.position.copy(pos); sp.scale.set(K2.scale,K2.scale,K2.scale);
    var spread=K2.spread||1.6;
    sp.userData={t:0, life:K2.life, vy:K2.vy*(0.7+Math.random()*0.7), vx:(Math.random()-0.5)*spread, vz:(Math.random()-0.5)*spread,
                 s0:K2.scale, kind:kind, op:K2.opacity, grow:K2.grow, drop:!!K2.drop};
    fxRoot.add(sp); particles.push(sp); return;
  }
  if(kind==="haze"){
    mat=new THREE.SpriteMaterial({map:softSprite(), color:0xb8bcc4, transparent:true,
         opacity:0.11, depthWrite:false, blending:THREE.NormalBlending});
    life=1.5; scale=0.9; vy=3.4;
  } else if(kind==="smoke"){
    mat=new THREE.SpriteMaterial({map:softSprite(), color:0x1b1c1e, transparent:true,
         opacity:0.55, depthWrite:false});
    life=2.6; scale=1.6; vy=4.2;
  } else {
    mat=new THREE.SpriteMaterial({map:sparkSprite(), color:0xffffff, transparent:true,
         opacity:1.0, depthWrite:false, blending:THREE.AdditiveBlending});
    life=0.55; scale=0.34; vy=6.0;
  }
  var s=new THREE.Sprite(mat);
  s.position.copy(pos);
  s.scale.set(scale,scale,scale);
  s.userData={t:0, life:life, vy:vy*(0.7+Math.random()*0.7),
              vx:(Math.random()-0.5)*(kind==="spark"?8:1.6),
              vz:(Math.random()-0.5)*(kind==="spark"?8:1.6),
              s0:scale, kind:kind, op:mat.opacity};
  fxRoot.add(s); particles.push(s);
}
function stepParticles(dt){
  for(var i=particles.length-1;i>=0;i--){
    var s=particles[i], u=s.userData;
    u.t+=dt;
    var k=u.t/u.life;
    if(k>=1){ fxRoot.remove(s); s.material.dispose(); particles.splice(i,1); continue; }
    if(u.kind==="spark") u.vy-=22*dt;
    if(u.drop){ u.vy-=40*dt; if(s.position.y<0.08){ s.position.y=0.08; u.vy=0; u.vx*=0.2; u.vz*=0.2; } }
    s.position.x+=u.vx*dt; s.position.y+=u.vy*dt; s.position.z+=u.vz*dt;
    if(!u.drop){ u.vx*=(1-dt*1.2); u.vz*=(1-dt*1.2); }
    var gr = u.kind==="spark" ? (1-k*0.6) : u.grow!==undefined ? (u.drop ? 1 : 1+k*u.grow) : (1+k*(u.kind==="smoke"?3.4:2.2));
    s.scale.set(u.s0*gr, u.s0*gr, u.s0*gr);
    s.material.opacity = u.op*(1-k)*(u.kind==="haze"?(1-k):1);
  }
}

/* ===========================================================================
   9b. FAILURE FX — what a specific failure mode looks like from the outside
   ==========================================================================*/
var failFx = { kind:null, t:0, started:false, debris:[], decal:null, ejected:null, glow:0, rattle:0, crack:null };
var DEBRIS_GEO = null;
function debrisChunk(pos, vel, size, matKey){
  if(!DEBRIS_GEO) DEBRIS_GEO = new THREE.BoxGeometry(1,0.55,0.35);
  var m=new THREE.Mesh(DEBRIS_GEO, MAT[matKey||"steel"]||MAT.steel);
  m.position.copy(pos); m.scale.set(size, size, size); m.castShadow=true;
  m.rotation.set(Math.random()*TAU, Math.random()*TAU, 0);
  m.userData={v:vel.clone(), w:new THREE.Vector3((Math.random()-0.5)*18,(Math.random()-0.5)*18,(Math.random()-0.5)*18), rest:false, t:0};
  fxRoot.add(m); failFx.debris.push(m); return m;
}
function stepDebris(dt){
  for(var i=0;i<failFx.debris.length;i++){
    var m=failFx.debris[i], u=m.userData; u.t+=dt;
    if(u.rest) continue;
    u.v.y -= 60*dt;
    m.position.addScaledVector(u.v, dt);
    m.rotation.x += u.w.x*dt; m.rotation.y += u.w.y*dt; m.rotation.z += u.w.z*dt;
    var fl = 0.06*m.scale.y+0.02;
    if(m.position.y < fl){ m.position.y = fl; u.v.y = -u.v.y*0.32; u.v.x*=0.55; u.v.z*=0.55; u.w.multiplyScalar(0.45);
      if(Math.abs(u.v.y)<1.2){ u.rest=true; u.v.set(0,0,0); m.rotation.x=Math.round(m.rotation.x/(PI/2))*(PI/2); } }
  }
}
function enginePoint(fx, fy, fz){  /* fractions of the engine's world box */
  return _tmpV.set(engBox.min.x+(engBox.max.x-engBox.min.x)*fx, engBox.min.y+(engBox.max.y-engBox.min.y)*fy, engBox.min.z+(engBox.max.z-engBox.min.z)*fz);
}
function turboPoint(){
  if(anim.turbos.length){ anim.turbos[0].getWorldPosition(_tmpV); return _tmpV; }
  return exhaustPoint();
}
function burst(kind, pos, n, spread){
  for(var i=0;i<n;i++){ _tmpV2.copy(pos); _tmpV2.x+=(Math.random()-0.5)*spread; _tmpV2.y+=(Math.random()-0.5)*spread*0.6; _tmpV2.z+=(Math.random()-0.5)*spread; emit(kind,_tmpV2); }
}
function startFail(kind){
  cleanupFail();
  failFx.kind = kind||"rod"; failFx.t=0; failFx.started=true; failFx.glow=0; failFx.rattle=0;
  var side = Math.random()<0.5?1:-1, p, v, i;
  camState.shake=Math.max(camState.shake, 0.32);
  if(kind==="rod"){
    /* a rod through the side of the block: window, shrapnel, oil */
    p=enginePoint(0.35+Math.random()*0.3, 0.30, side>0?1.0:0.0).clone();
    var dec=new THREE.Mesh(new THREE.PlaneGeometry(0.62,0.48), new THREE.MeshBasicMaterial({color:0x07080a}));
    dec.position.copy(p); dec.position.z += side*0.012; dec.rotation.y = side>0?0:PI; fxRoot.add(dec); failFx.decal=dec;
    for(i=0;i<7;i++){ v=new THREE.Vector3((Math.random()-0.5)*6, 5+Math.random()*9, side*(9+Math.random()*10)); debrisChunk(p, v, 0.22+Math.random()*0.25, i<2?"steel":"iron"); }
    burst("spark", p, 26, 0.6); burst("oil", p, 18, 0.5); burst("smokeGrey", p, 5, 0.6); burst("flame", p, 10, 0.9); flashAt(p, 0xffb060, 14); oilPoolStart();
  } else if(kind==="crank"){
    /* torsional / fatigue: the crank lets go at the nose and the damper leaves */
    var d=null; for(i=0;i<anim.spin.length;i++) if(anim.spin[i].o.userData.isDamper) d=anim.spin[i].o;
    if(d){ d.getWorldPosition(_tmpV2); failFx.ejected={o:d, parent:d.parent, pos:d.position.clone(), rot:d.rotation.clone()};
      d.parent.remove(d); fxRoot.add(d); d.position.copy(_tmpV2);
      d.userData.v=new THREE.Vector3(14+Math.random()*6, 6+Math.random()*4, (Math.random()-0.5)*6);
      d.userData.w=new THREE.Vector3(30,(Math.random()-0.5)*4,(Math.random()-0.5)*4); d.userData.rest=false; d.userData.t=0; failFx.debris.push(d); }
    p=enginePoint(1.0,0.45,0.5).clone(); burst("spark", p, 30, 0.5); burst("smokeGrey", p, 4, 0.5); flashAt(p, 0xfff0c0, 10); oilPoolStart();
    for(i=0;i<3;i++) debrisChunk(p, new THREE.Vector3(8+Math.random()*8, 4+Math.random()*6, (Math.random()-0.5)*8), 0.12+Math.random()*0.12, "steel");
  } else if(kind==="valve"){
    p=enginePoint(0.3+Math.random()*0.4, 1.0, 0.5).clone(); burst("spark", p, 14, 0.9);
  } else if(kind==="turbo"){
    p=turboPoint().clone(); burst("spark", p, 22, 0.4);
    for(i=0;i<4;i++) debrisChunk(p, new THREE.Vector3((Math.random()-0.5)*10, 6+Math.random()*8, (Math.random()-0.5)*10), 0.08+Math.random()*0.08, "steel");
  } else if(kind==="knock"){
    failFx.rattle=1;
  } else if(kind==="seize"){
    failFx.glow=0.2; oilPoolStart();
  } else if(kind==="steam"){
    p=enginePoint(0.5,0.62,0.5).clone(); burst("steam", p, 22, 2.8); burst("coolant", p, 14, 1.2);
  } else if(kind==="lean"){
    /* lean on the bottle: it rattles, then the crown lets go — the knock sequence */
    failFx.kind="knock"; failFx.rattle=1;
  } else if(kind==="backfire"){
    /* intake backfire on nitrous: a ball of flame out of the throttle and the burst panel, then smoke */
    if(N2O_PURGE && N2O_PURGE.parent){ N2O_PURGE.getWorldPosition(_n2oA); p=_n2oA.clone(); } else p=enginePoint(0.5,1.0,0.5).clone();
    burst("flame", p, 18, 1.2); burst("smokeGrey", p, 6, 1.0); burst("spark", p, 10, 0.8); flashAt(p, 0xffa040, 16); camState.shake=Math.max(camState.shake, 0.45);
  } else if(kind==="manifold"){
    /* cracked exhaust manifold: a glowing split in the collector, gas and sparks jetting out of it, the hot side
       flaring, then soot spreading round the crack */
    startCrack();
    p=crackWorld(); burst("spark", p, 16, 0.25); burst("flame", p, 5, 0.3); flashAt(p, 0xff8a30, 9);
    failFx.glow=0.6;
  }
}
var _ckP=new THREE.Vector3(), _ckD=new THREE.Vector3();
function crackHost(){ var G=engineRoot && engineRoot.children[0]; return (G && G.userData.crack) ? G : null; }
function crackWorld(){
  var G=crackHost();
  if(!G){ _ckD.set(0,0.3,1).normalize(); return _ckP.copy(exhaustPoint()); }
  var c=G.userData.crack; G.updateMatrixWorld(true);
  _ckP.copy(c.pt); G.localToWorld(_ckP);
  _ckD.copy(c.dir).transformDirection(G.matrixWorld);
  return _ckP;
}
/* the crack itself lives in the engine group (it shakes with the block); soot fades in round it */
function startCrack(){
  var G=crackHost(); if(!G) return;
  var c=G.userData.crack, d=c.dir, t=V3(0,1,0).cross(d); if(t.lengthSq()<1e-4) t.set(1,0,0); t.normalize();
  var bn=d.clone().cross(t).normalize(), pts=[], n=9, i;
  for(i=0;i<=n;i++){ var f=i/n-0.5, j=(i%2?1:-1)*c.len*0.07*(0.5+Math.random()); pts.push(c.pt.clone().addScaledVector(t, f*c.len).addScaledVector(bn, j+f*c.len*0.25).addScaledVector(d, c.len*0.03)); }
  var core=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, c.len*0.028, 5), new THREE.MeshBasicMaterial({color:0xfff6d8, toneMapped:false}));
  var halo=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, c.len*0.09, 6),
            new THREE.MeshBasicMaterial({color:0xffb040, transparent:true, opacity:0.55, blending:THREE.AdditiveBlending, depthWrite:false, toneMapped:false}));
  /* soot: a soft dark stain that grows round the crack */
  var sc2=newCanvas(64,64), x=sc2.getContext("2d"), gr=x.createRadialGradient(32,32,2,32,32,31);
  gr.addColorStop(0,"rgba(8,7,6,0.95)"); gr.addColorStop(0.5,"rgba(12,10,8,0.6)"); gr.addColorStop(1,"rgba(12,10,8,0)");
  x.fillStyle=gr; x.fillRect(0,0,64,64);
  var st=new THREE.CanvasTexture(sc2);
  var soot=new THREE.Mesh(new THREE.PlaneGeometry(c.len*1.25, c.len*0.95),
            new THREE.MeshBasicMaterial({map:st, transparent:true, opacity:0, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-4}));
  soot.position.copy(c.pt).addScaledVector(d, c.len*0.05); soot.quaternion.setFromUnitVectors(V3(0,0,1), d); soot.rotateZ(Math.random()*0.6-0.3);   /* engine-local: G carries the shake */
  soot.renderOrder=2; core.renderOrder=3; halo.renderOrder=4;
  G.add(soot); G.add(core); G.add(halo);
  failFx.crack={core:core, halo:halo, soot:soot, tex:st};
}
function stepFail(dt){
  var t = failFx.t += dt, k=failFx.kind, p, i;
  if(oilPool){ oilPool.userData.t+=dt; var sp=Math.min(2.6, 0.05+oilPool.userData.t*0.9); oilPool.scale.set(sp, sp*0.8, sp); }
  if(flashLight && flashLight.intensity>0.01) flashLight.intensity*=Math.max(0, 1-dt*9);
  var ch=function(rate){ return Math.random() < Math.min(0.95, rate*dt); };   /* frame-rate independent emission */
  var cool = Math.max(0, 1-t*0.35);          /* everything calms down over ~3 s */
  if(k==="rod"){
    p=failFx.decal?failFx.decal.position:enginePoint(0.5,0.3,1.0);
    if(t<1.6 && ch(42)) { _tmpV2.copy(p); emit("oil",_tmpV2); }
    if(ch((0.55*cool+0.15)*60)) { _tmpV2.copy(p); _tmpV2.y+=0.2; emit(t<0.6?"smokeGrey":"smoke",_tmpV2); }
    if(t<0.5 && ch(36)) { _tmpV2.copy(p); emit("spark",_tmpV2); }
    camState.shake=Math.max(camState.shake, 0.22*cool);
  } else if(k==="crank"){
    p=enginePoint(1.0,0.45,0.5);
    if(t<1.0 && ch(48)) { _tmpV2.copy(p); emit("spark",_tmpV2); }
    if(ch((0.35*cool+0.1)*60)) { _tmpV2.copy(p); emit("smokeGrey",_tmpV2); }
    camState.shake=Math.max(camState.shake, 0.26*cool);
  } else if(k==="knock"){
    /* rattle first, then the piston lets go: bang, backfire, then it smokes hard */
    var ep=exhaustPoint();
    if(t<1.2){ failFx.rattle=1; if(ch(30)){ _tmpV2.copy(ep); emit("smokeGrey",_tmpV2);} camState.shake=Math.max(camState.shake,0.06); }
    else {
      if(!failFx.banged){ failFx.banged=true; _tmpV2.copy(ep); burst("flame",_tmpV2,8,0.8); burst("spark",_tmpV2,24,0.8); burst("smoke",_tmpV2,8,1.2); camState.shake=0.34;
        p=enginePoint(0.5,1.0,0.5); burst("smokeGrey",p,6,1.5); }
      failFx.rattle=0.3*cool;
      if(ch(45)){ _tmpV2.copy(ep); emit("smoke",_tmpV2); }
      if(ch(21)){ p=enginePoint(0.3+Math.random()*0.4,1.0,0.5); emit("smokeGrey",p); }
    }
  } else if(k==="steam"){
    /* head gasket / overheat: steam out of the deck seam, coolant on the floor */
    for(i=0;i<2;i++) if(ch(48)){ p=enginePoint(0.15+Math.random()*0.7, 0.62, Math.random()<0.5?0.02:0.98); emit("steam",p); }
    if(t<2.5 && ch(30)){ p=enginePoint(0.15+Math.random()*0.7, 0.60, Math.random()<0.5?0.0:1.0); emit("coolant",p); }
    if(ch(15)){ _tmpV2.copy(exhaustPoint()); emit("steam",_tmpV2); }
    failFx.rattle=0.15;
  } else if(k==="valve"){
    p=enginePoint(0.3+Math.random()*0.4, 1.0, 0.5);
    if(t<0.9){ failFx.rattle=0.8; if(ch(30)) emit("spark",p); }
    else { if(!failFx.banged){ failFx.banged=true; camState.shake=0.3; burst("spark",p,18,1.0); burst("smokeGrey",p,6,1.2);
        for(i=0;i<3;i++) debrisChunk(p, new THREE.Vector3((Math.random()-0.5)*6, 7+Math.random()*6, (Math.random()-0.5)*6), 0.08+Math.random()*0.08, "steel"); }
      failFx.rattle=0; if(ch(24)) emit("smokeGrey",p); }
  } else if(k==="seize"){
    /* oil starvation: headers go orange, blue smoke, then it locks solid */
    var ep2=exhaustPoint();
    failFx.glow=Math.min(1.6, failFx.glow+dt*0.9);
    if(ch(42)){ _tmpV2.copy(ep2); emit("smokeBlue",_tmpV2); }
    if(t>1.6 && !failFx.banged){ failFx.banged=true; camState.shake=0.4; p=enginePoint(0.5,0.4,0.5); burst("smokeGrey",p,6,2.0); }
    failFx.rattle = t<1.6 ? 0.25 : 0;
  } else if(k==="manifold"){
    /* the split breathes with every exhaust pulse: gas + sparks jet out along the face normal */
    p=crackWorld();
    var pulse=0.55+0.45*Math.sin(t*(run.rpm>0?run.rpm/60*TAU*0.25:9));
    failFx.glow = t<0.5 ? Math.min(1.3, failFx.glow+dt*3.0) : Math.max(0.62, failFx.glow-dt*0.30);
    var CK=failFx.crack;
    if(CK){ CK.core.material.color.setRGB(1, 0.80+0.20*pulse, 0.50+0.45*pulse); CK.halo.material.opacity=0.30+0.40*pulse*cool+0.15;
      CK.soot.material.opacity=Math.min(0.92, t*0.35); var gs=Math.min(1.35, 0.6+t*0.25); CK.soot.scale.set(gs,gs,1); }
    var jet=function(kind, sp, spread){ emit(kind, p); var q=particles[particles.length-1]; if(!q) return; var u=q.userData;
      u.vx=_ckD.x*sp+(Math.random()-0.5)*spread; u.vy=_ckD.y*sp+(Math.random()-0.5)*spread+1.0; u.vz=_ckD.z*sp+(Math.random()-0.5)*spread; };
    if(ch(60*(0.5+pulse))) jet("haze", 7.5, 1.5);
    if(t<3.0 && ch(34*pulse)) jet("spark", 11, 3.5);
    if(ch(10*cool+3)) jet("smokeGrey", 5, 1.2);
    if(t<1.2 && ch(14)) jet("flame", 6, 1.0);
    if(flashLight && ch(20)){ flashLight.position.copy(p); flashLight.color.setHex(0xff7a28); flashLight.intensity=Math.max(flashLight.intensity, 2.2+3.0*pulse*cool); }
    camState.shake=Math.max(camState.shake,0.05*cool);
  } else if(k==="turbo"){
    p=turboPoint();
    failFx.glow=Math.min(2.2, failFx.glow+dt*2.5);
    if(t<1.5 && ch(51)) emit("spark",p);
    if(ch(30)) emit(t<1.0?"smokeGrey":"smoke",p);
    camState.shake=Math.max(camState.shake,0.08*cool);
  } else {
    if(ch(30)){ p=enginePoint(0.5,0.9,0.5); emit("smoke",p); }
    camState.shake=Math.max(camState.shake,0.15*cool);
  }
  stepDebris(dt);
}
function cleanupFail(){
  if(!failFx.started) return;
  var i;
  for(i=0;i<failFx.debris.length;i++){ var m=failFx.debris[i]; if(failFx.ejected && m===failFx.ejected.o) continue; fxRoot.remove(m); }
  failFx.debris=[];
  if(failFx.decal){ fxRoot.remove(failFx.decal); failFx.decal.geometry.dispose(); failFx.decal.material.dispose(); failFx.decal=null; }
  if(failFx.ejected){ var e=failFx.ejected; fxRoot.remove(e.o); if(e.parent){ e.parent.add(e.o); e.o.position.copy(e.pos); e.o.rotation.copy(e.rot); } failFx.ejected=null; }
  if(failFx.crack){ var CK=failFx.crack; [CK.core, CK.halo, CK.soot].forEach(function(m){ if(m.parent) m.parent.remove(m); m.geometry.dispose(); m.material.dispose(); }); CK.tex.dispose(); failFx.crack=null; }
  failFx.kind=null; failFx.started=false; failFx.banged=false; failFx.glow=0; failFx.rattle=0; failFx.t=0;
  if(oilPool){ fxRoot.remove(oilPool); oilPool.geometry.dispose(); oilPool.material.dispose(); oilPool=null; }
  if(flashLight) flashLight.intensity=0;
}
var _tmpV2 = new THREE.Vector3();
var oilPool=null, flashLight=null;
function oilPoolStart(){
  if(oilPool){ fxRoot.remove(oilPool); }
  oilPool=new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshStandardMaterial({color:0x090806, roughness:0.12, metalness:0.2, transparent:true, opacity:0.92}));
  oilPool.rotation.x=-PI/2; oilPool.position.set(engineRoot.position.x+(Math.random()-0.5)*2, 1.22, engineRoot.position.z+(Math.random()-0.5)*2);
  oilPool.scale.set(0.05,0.05,0.05); oilPool.userData.t=0; fxRoot.add(oilPool);
}
function flashAt(pos, color, intensity){
  if(!flashLight){ flashLight=new THREE.PointLight(0xffa040, 0, 40, 2.0); scene.add(flashLight); }
  flashLight.position.copy(pos); flashLight.color.setHex(color||0xffa040); flashLight.intensity=intensity||8;
}

