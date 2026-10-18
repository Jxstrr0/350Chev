/* ---------------------------------------------------------------------------
   DRAG CARS (v1.5) — procedural car models for the strip.
   Bodies are lofted from cross-sections (sc_loft), tyres are lathed, rims /
   wings / scoops are extruded 2D shapes. Units metres, +x forward, y up,
   +z to the car's right. Geometry is cached per body + tyre size and shared
   by both lanes; only paint, lamps and door decals are per car.
   stripCarAnim() animates wheels, tyre wrinkle, pitch, chute and lamps.
   -------------------------------------------------------------------------*/
var SC = { geo:{}, tex:{}, mat:null, paint:{}, env:null };
var SC_F = ["zb","ys","yt","w","wt","cr"];
var _scA=new THREE.Vector3(), _scB=new THREE.Vector3(), _scC=new THREE.Vector3(), _scX=new THREE.Vector3(1,0,0), _scY=new THREE.Vector3(0,1,0), _scO=new THREE.Vector3();
function stripCar(body, color, tyreIn, hw){
  if(!SC_BODY_TYRE[body]) body="street";
  var tIn=clamp(+tyreIn||SC_BODY_TYRE[body], 20, 40);
  var H=sc_hw(hw, body);
  var P=sc_pack(body, Math.round(tIn*4)/4, H), M=sc_mats(), me=P.meta;
  var paint=sc_paint(color===undefined?0xa32a26:color);
  var tail=new THREE.MeshStandardMaterial({color:sc(0x4a0707), roughness:0.25, metalness:0.1, emissive:new THREE.Color(0xff1a0a), emissiveIntensity:0});
  var head=new THREE.MeshStandardMaterial({color:sc(0xc9ced4), roughness:0.12, metalness:0.55, emissive:new THREE.Color(0xfff1d8), emissiveIntensity:0});
  var g=new THREE.Group(); g.name="stripCar";
  var bodyG=new THREE.Group(); bodyG.position.set(me.xr, me.rr-scRide(me, body), 0); g.add(bodyG);   /* scRide: the fix pack's lower ride height */
  var inner=new THREE.Group(); inner.position.set(-me.xr, -me.rr, 0); bodyG.add(inner);
  var k, mesh;
  for(k in P.parts){
    var mat = k==="paint"?paint : (M[k]||M.black);
    mesh=new THREE.Mesh(P.parts[k], mat); mesh.name="sc_"+k; mesh.castShadow=(k!=="glass"); mesh.receiveShadow=true; inner.add(mesh);
  }
  /* v3: a flip-up body (funny car) is its own group hinged at the back, so the pits can lift it (userData.flip) */
  var flip=null;
  if(P.flip){ flip=new THREE.Group(); flip.name="sc_flip"; flip.position.copy(me.hinge); inner.add(flip);
    var fi=new THREE.Group(); fi.position.copy(me.hinge).negate(); flip.add(fi);
    for(k in P.flip){ mesh=new THREE.Mesh(P.flip[k], k==="paint"?paint:(M[k]||M.black)); mesh.name="sc_f"+k; mesh.castShadow=(k!=="glass"); mesh.receiveShadow=true; fi.add(mesh); } }
  var lights={brake:[], head:[]};
  if(P.tail){ mesh=new THREE.Mesh(P.tail, tail); inner.add(mesh); lights.brake.push(mesh); }
  if(P.head){ mesh=new THREE.Mesh(P.head, head); inner.add(mesh); lights.head.push(mesh); }
  /* door number + sponsor decals: number is picked from the paint so the two lanes differ */
  var num=String(((color>>>0)%89)+11), dm=sc_decalMat(num, color, "door"), bm=sc_decalMat("", color, "banner");
  var liv={num:num, color:color, dm:dm, bm:bm, door:[], banner:[], hood:null, key:""};   /* sponsor livery (stripLivery) */
  for(var d=0; d<P.decals.length; d++){ mesh=new THREE.Mesh(P.decals[d].g, P.decals[d].kind==="banner"?bm:dm); mesh.renderOrder=2; (flip&&P.decals[d].flip?flip.children[0]:inner).add(mesh); (P.decals[d].kind==="banner"?liv.banner:liv.door).push(mesh); }
  if(P.hood){ liv.hood=new THREE.Mesh(P.hood, dm); liv.hood.visible=false; liv.hood.renderOrder=3; (flip?flip.children[0]:inner).add(liv.hood); }
  /* wheels: carrier (squash / lift) -> tyre holder (never spins, tyres are round) + spin group (rim, lettering) */
  var wheels=[], carriers=[];
  for(var w=0; w<me.wheels.length; w++){
    var ws=me.wheels[w], car=sc_wheel(ws, M);
    car.position.set(ws.x, ws.r, ws.z); g.add(car); carriers.push(car); wheels.push(car.userData.spin);
  }
  /* parachute */
  var chute=sc_chute(me, M); chute.position.copy(me.anchor); chute.visible=false; inner.add(chute);
  var tips=[], dirs=[], tipR=[], dirR=[];
  for(var t=0;t<me.tips.length;t++){ tips.push(me.tips[t].clone()); dirs.push(me.dirs[t].clone()); tipR.push(me.tips[t].clone().add(inner.position)); dirR.push(me.dirs[t].clone()); }
  /* v3: header flame anchors (every primary of a nitro car; body frame, follow the pitch like the exhaust tips) */
  var fl=me.flames||[], fT=[], fD=[], fTR=[], fDR=[];
  for(t=0;t<fl.length;t++){ fT.push(fl[t].p.clone()); fD.push(fl[t].d.clone()); fTR.push(fl[t].p.clone().add(inner.position)); fDR.push(fl[t].d.clone()); }
  g.userData={ body:body, hw:H, rr:me.rr, fr:me.fr, wheels:wheels, carriers:carriers, chute:chute, exhaustTips:tips, exhaustDirs:dirs, flameTips:fT, flameDirs:fD, flip:flip,
    enginePos:me.eng?me.eng.clone():undefined, style:H?H.style:"",
    chuteAnchor:me.anchor.clone(), lights:lights, bodyGroup:bodyG, meta:me, paint:paint, lampMats:{tail:tail, head:head}, liv:liv,
    anim:{ pitch:0, pv:0, sq:0, sqv:0, roll:0, lastV:0, accF:0, shifting:false, chT:0, chC:0, chS:0, tailI:-1, headI:-1,
      tipRest:tipR, dirRest:dirR, flameRest:fTR, flameDirRest:fDR, anchorRest:me.anchor.clone().add(inner.position) } };
  g.traverse(function(q){ if(q.geometry) q.geometry.__cached=true; });   /* shared by both lanes + later rebuilds: disposeTree must skip them */
  return g;
}

/* --- per-frame animation (no allocations) --------------------------------- */
/* the setup sheet's lean on a road / hill car (after stripCarAnim): su = {dive, lf, lr} from ENGINE_SIM.setupVis, lateral and
   longitudinal g. Soft cars dive harder under braking and squat more on the power; a stiff axle lifts its inside wheel when
   it is pushed past about 0.8 g. Stock (su null) leaves the car exactly as stripCarAnim made it. S = the caller's smoothing state. */
function stripSetupLean(car, su, ayg, axg, S, dt){
  if(!su) return;
  var U=car.userData, B=U.bodyGroup, i, k=Math.min(1,dt*6);
  S.dv+=(clamp(axg,-1.4,0.6)*0.03*(su.dive-1)-S.dv)*k; B.rotation.z+=S.dv;
  var m=clamp((Math.abs(ayg)-0.8)/0.7,0,1)*0.10, inner=ayg>=0?-1:1;
  S.lf+=(su.lf*m-S.lf)*k; S.lr+=(su.lr*m-S.lr)*k;
  for(i=0;i<U.carriers.length;i++){ var Cw=U.carriers[i]; if(Cw.position.z*inner>0) Cw.position.y+=Cw.userData.rear?S.lr:S.lf; }
  B.updateMatrix();
}
function stripCarAnim(car, o, dt, isPlayer){
  var U=car&&car.userData, A=U&&U.anim; if(!A||!o) return;
  if(!(dt>0)) dt=0; if(dt>0.1) dt=0.1;
  var me=U.meta, i;
  var v = isPlayer ? (o.v||0) : (o.ov||0);
  var acc;
  if(isPlayer) acc=o.acc||0;
  else if(o.oacc!==undefined) acc=o.oacc;
  else { if(dt>0){ var ea=(v-A.lastV)/dt; if(ea>60) ea=60; if(ea<-60) ea=-60; A.accF+=(ea-A.accF)*Math.min(1,dt*5); } acc=A.accF; }
  A.lastV=v;
  var spin = isPlayer ? !!o.spin : !!o.ospin;
  var burn = isPlayer ? !!o.burnout : !!o.oburn;
  /* wheels */
  var wr=v/U.rr*(spin?1.4:1), wf=v/me.fr;
  if(burn && wr<75) wr=75;
  if(spin && v<3 && wr<30) wr=30;
  for(i=0;i<U.carriers.length;i++){
    var C=U.carriers[i], S=C.userData.spin, rot=S.rotation.y-(C.userData.rear?wr:wf)*dt;
    if(rot<-TAU||rot>TAU) rot=rot%TAU;
    S.rotation.y=rot;
  }
  /* tyre wrinkle: hard launch squashes the tall sidewalls, damped spring back */
  var wt=me.wrinkle*clamp((acc-4)/12,0,1)*clamp(1-v/16,0,1);
  if(burn) wt=Math.max(wt, me.wrinkle*0.35);
  var n=Math.min(12, Math.ceil(dt/0.012)), h=n?dt/n:0, s;
  var ptT=0, pitchMax=U.wbar?U.maxPitch:me.maxPitch;
  var lift=isPlayer ? (o.lift||0) : (o.olift!==undefined ? o.olift : clamp((acc-12)/18,0,1)*0.6);
  var onBars=isPlayer ? !!o.onBars : !!o.oOnBars;
  ptT=clamp(lift,0,1)*pitchMax;
  if((me.bars||U.wbar) && onBars) ptT=pitchMax;
  ptT += clamp(acc/25,-0.5,1)*me.squat;
  var sh=isPlayer ? !!o.shifting : !!o.oshifting;
  if(sh && !A.shifting) A.pv -= me.shiftKick;
  A.shifting=sh;
  if(sh) ptT -= me.squat*0.8;
  var om=me.pitchW, ze=0.42, om2=15, ze2=0.3;
  for(s=0;s<n;s++){
    A.pv += (om*om*(ptT-A.pitch) - 2*ze*om*A.pv)*h; A.pitch += A.pv*h;
    A.sqv += (om2*om2*(wt-A.sq) - 2*ze2*om2*A.sqv)*h; A.sq += A.sqv*h;
  }
  if(A.pitch>pitchMax+0.02) { A.pitch=pitchMax+0.02; if(A.pv>0) A.pv=0; }
  if((me.bars||U.wbar) && A.pitch>pitchMax){ A.pitch=pitchMax; if(A.pv>0) A.pv*=-0.25; }
  if(A.pitch<-0.035){ A.pitch=-0.035; if(A.pv<0) A.pv=0; }
  var sq=clamp(A.sq,-0.4,1.2);
  A.roll += (clamp(acc/30,-0.3,1)*0.010 - A.roll)*Math.min(1,dt*6);
  /* tyres: squash about the contact patch, bulge the sidewall out, lean a touch */
  var sy=1-0.08*sq, sz=1+0.06*sq, sx=1+0.035*sq;
  for(i=0;i<U.carriers.length;i++){
    var Cw=U.carriers[i], d=Cw.userData;
    if(d.rear){
      d.hold.scale.set(sx, sz, sy);
      d.letters.position.y=d.hw*(sz-1);
      Cw.position.y=d.r*sy; Cw.rotation.x=d.side*0.035*sq;
    } else {
      var rise=(me.xf-me.xr)*Math.sin(A.pitch)-me.droop;
      Cw.position.y=d.r+(rise>0?rise:0);
    }
  }
  var B=U.bodyGroup;
  B.rotation.z=A.pitch; B.rotation.x=A.roll;
  B.position.y=me.rr - (me.ride||0) - me.rr*0.08*sq - clamp(acc/25,0,1)*me.squatDrop;
  B.updateMatrix();
  for(i=0;i<A.tipRest.length;i++){ U.exhaustTips[i].copy(A.tipRest[i]).applyMatrix4(B.matrix); U.exhaustDirs[i].copy(A.dirRest[i]).transformDirection(B.matrix); }
  for(i=0;i<A.flameRest.length;i++){ U.flameTips[i].copy(A.flameRest[i]).applyMatrix4(B.matrix); U.flameDirs[i].copy(A.flameDirRest[i]).transformDirection(B.matrix); }
  U.chuteAnchor.copy(A.anchorRest).applyMatrix4(B.matrix);
  /* lamps */
  var brake=isPlayer ? !!o.brake : (o.obrake!==undefined ? !!o.obrake : ((o.ox||0)>402.336 && v>1));
  var night=!!o.night, ti=brake?2.6:(night?0.9:0), hi=night?2.4:0;
  if(ti!==A.tailI){ U.lampMats.tail.emissiveIntensity=ti; A.tailI=ti; }
  if(hi!==A.headI){ U.lampMats.head.emissiveIntensity=hi; A.headI=hi; }
  /* parachute: bag out -> lines taut -> blossom with overshoot -> sway -> collapse under 10 m/s */
  var ch=U.chute, on=isPlayer ? !!o.chute : (o.ochute!==undefined ? !!o.ochute : (!!o.chute && (o.ox||0)>402.336));
  if(on && !ch.visible){ ch.visible=true; A.chT=0; A.chC=0; }
  else if(!on && ch.visible) ch.visible=false;
  if(ch.visible) sc_chuteAnim(ch, A, me, v, dt);
}
function sc_chuteAnim(ch, A, me, v, dt){
  A.chT+=dt; A.chS+=dt*(1.8+Math.min(v,100)*0.03);
  var U=ch.userData, cn=U.canopy, t=A.chT;
  var ext=smoothstep(0,0.3,t), b=clamp((t-0.2)/0.5,0,1), c1=1.9, bloom=0.08+0.92*(1+(c1+1)*Math.pow(b-1,3)+c1*Math.pow(b-1,2));
  A.chC += ((v<10?1:0)-A.chC)*Math.min(1,dt*1.4);
  var c=A.chC, sway=(0.05+Math.min(v,100)*0.0024)*(1-c)*ext;
  ch.rotation.z=-A.pitch;
  var D=me.chuteLen*(0.08+0.92*ext)*(1-0.3*c);
  cn.position.set(-D, me.chuteRise*ext*(1-c) + c*(0.28-me.anchor.y) + Math.sin(A.chS*1.3)*sway, Math.sin(A.chS*0.83+1.1)*sway*1.5);
  _scA.copy(cn.position).negate().normalize();
  cn.quaternion.setFromUnitVectors(_scX, _scA);
  var rad=bloom*(1-0.6*c)*(1+0.035*Math.sin(A.chS*4.1)*(1-c));
  if(U.fl) U.fl.value.set(A.chS%600, ext*(1-c)*(0.35+0.65*Math.min(1,v/30)));   /* fabric flutter: hard at speed, gone once it falls in */
  cn.scale.set(bloom*(1+0.5*c), rad, rad*(1-0.25*c));
  cn.updateMatrix();
  _scB.copy(cn.position).multiplyScalar(0.28);                 /* confluence point */
  sc_setLine(U.bridle, _scO, _scB);
  for(var i=0;i<U.lines.length;i++){
    var L=U.lines[i];
    _scA.set(0, U.rc*L.userData.cy, U.rc*L.userData.cz).applyMatrix4(cn.matrix);
    sc_setLine(L, _scB, _scA);
  }
}
function sc_setLine(m, a, b){
  m.position.copy(a); _scC.subVectors(b,a); var len=_scC.length()||1e-4; _scC.multiplyScalar(1/len);
  m.quaternion.setFromUnitVectors(_scY, _scC); m.scale.set(1,len,1);
}

/* --- materials ------------------------------------------------------------ */
function sc_env(){
  if(STRIP.scene && STRIP.scene.environment) return null;      /* the strip's own environment wins */
  if(SC.env || !renderer) return SC.env;
  var s=new THREE.Scene(), g=new THREE.SphereGeometry(50, 32, 16), p=g.attributes.position, col=[], c=new THREE.Color();
  for(var i=0;i<p.count;i++){
    var y=p.getY(i)/50, x=p.getX(i)/50;
    if(y>=0){ var f=Math.pow(y,0.5); c.setRGB(lerp(1.05,0.22,f), lerp(1.08,0.42,f), lerp(1.12,0.85,f)); }
    else { var f2=Math.min(1,-y*3); c.setRGB(lerp(0.50,0.13,f2), lerp(0.52,0.15,f2), lerp(0.46,0.11,f2)); }
    if(y>0.02 && y<0.14) c.multiplyScalar(0.72+0.2*Math.abs(Math.sin(x*9)));   /* distant horizon clutter */
    col.push(c.r,c.g,c.b);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(col,3));
  s.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({vertexColors:true, side:THREE.BackSide})));
  var sun=new THREE.Mesh(new THREE.SphereGeometry(3.5,12,8), new THREE.MeshBasicMaterial({color:new THREE.Color(9,8.4,7.4)})); sun.position.set(-22,32,26); s.add(sun);
  var pan=new THREE.Mesh(new THREE.PlaneGeometry(40,6), new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,1.6,1.6), side:THREE.DoubleSide})); pan.position.set(0,26,-30); pan.lookAt(0,0,0); s.add(pan);
  var rt=new THREE.WebGLCubeRenderTarget(128,{format:THREE.RGBAFormat, generateMipmaps:true, minFilter:THREE.LinearMipmapLinearFilter});
  var cam=new THREE.CubeCamera(0.1,120,rt); cam.update(renderer,s);
  var pm=new THREE.PMREMGenerator(renderer); pm.compileCubemapShader(); SC.env=pm.fromCubemap(rt.texture).texture; pm.dispose(); rt.dispose();
  g.dispose(); return SC.env;
}
function sc_mats(){
  if(SC.mat) return SC.mat;
  var env=sc_env();
  function m(c, r, mt, ei, o){ var q=new THREE.MeshStandardMaterial({color:sc(c), roughness:r, metalness:mt, envMapIntensity:ei===undefined?1:ei}); if(env) q.envMap=env; if(o) for(var k in o) q[k]=o[k]; return q; }
  var M={};
  M.rubber=m(0x18181a, 0.82, 0.0, 0.45);
  M.well=m(0x0a0a0b, 1.0, 0.0, 0.2);
  M.black=m(0x1c1d20, 0.6, 0.1, 0.6);
  M.satin=m(0x111214, 0.42, 0.35, 0.9);
  M.glass=m(0x0c131a, 0.05, 0.75, 1.5, {polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1});
  M.seam=m(0x0a0a0b, 1.0, 0.0, 0.2, {polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2});
  M.chrome=m(0xf0f0f0, 0.09, 1.0, 1.25);
  M.alu=m(0xcfd3d8, 0.2, 1.0, 1.15);
  M.barrel=m(0x7b8087, 0.45, 0.9, 0.8);
  M.rimBlack=m(0x1e2023, 0.35, 0.6, 0.9);
  M.tube=m(0xaeb3b9, 0.32, 0.85, 1.0);
  M.engine=m(0x1a1b1e, 0.5, 0.3, 0.8);
  M.bag=m(0x1b1c20, 0.8, 0.0, 0.4);
  M.lineM=m(0xe6e2d8, 0.85, 0.0, 0.3);
  M.visor=m(0x1a2530, 0.08, 0.8, 1.4);
  M.carbon=m(0xffffff, 0.24, 0.3, 1.35, {map:sc_carbonTex(), polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1});
  M.carbonS=m(0xffffff, 0.24, 0.3, 1.35, {map:M.carbon.map});   /* v3: carbon as a solid part (wings, funny-car body), no decal offset */
  M.rotor=m(0x8b8f95, 0.38, 0.95, 0.9);
  M.caliper=m(0xb3261e, 0.35, 0.25, 1.0);
  M.chromeT=m(0xf4f4f4, 0.07, 1.0, 1.35, {polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2});   /* chrome trim strips on the body */
  M.canopy=m(0xffffff, 0.85, 0.0, 0.4, {map:sc_stripeTex(), side:THREE.DoubleSide});
  M.letters=new THREE.MeshStandardMaterial({map:sc_letterTex(), transparent:true, depthWrite:false, roughness:0.85, polygonOffset:true, polygonOffsetFactor:-2});
  if(env) M.letters.envMap=env;
  SC.mat=M; return M;
}
function sc_paint(color){
  var cc=GFX!=="lite", key=String(color>>>0)+(cc?"c":""); if(SC.paint[key]) return SC.paint[key];
  var c=new THREE.Color(color).convertSRGBToLinear(), lum=0.2126*c.r+0.7152*c.g+0.0722*c.b;
  /* v3: Full / Ultra paint is a clear coat over a satin base (a second, sharp highlight); Lite keeps the single-lobe paint */
  var q=cc?new THREE.MeshPhysicalMaterial({color:c, roughness:0.42, metalness:lum<0.02?0.3:0.12, envMapIntensity:lum<0.02?1.45:1.1, clearcoat:1, clearcoatRoughness:0.06})
    :new THREE.MeshStandardMaterial({color:c, roughness:0.2, metalness:lum<0.02?0.35:0.22, envMapIntensity:lum<0.02?1.5:1.15});
  var env=sc_env(); if(env) q.envMap=env;
  SC.paint[key]=q; return q;
}
function sc_canvas(w,h){ var c=document.createElement("canvas"); c.width=w; c.height=h; return c; }
function sc_ctex(c, srgb){ var t=new THREE.CanvasTexture(c); if(srgb!==false) t.encoding=THREE.sRGBEncoding; t.anisotropy=4; return t; }
/* v3: 2x2 twill weave: each tow is a rounded ribbon (sheen across it, dark at the edges), alternating direction on the twill diagonal */
function sc_carbonTex(){
  var c=sc_canvas(128,128), x=c.getContext("2d"), i, j, s=16;
  x.fillStyle="#0c0d0f"; x.fillRect(0,0,128,128);
  for(i=0;i<8;i++) for(j=0;j<8;j++){ var on=(((i+j)%4)<2), x0=i*s, y0=j*s;
    var gr=on?x.createLinearGradient(x0,y0,x0,y0+s):x.createLinearGradient(x0,y0,x0+s,y0);
    gr.addColorStop(0,"#101114"); gr.addColorStop(0.18,on?"#2c3036":"#1b1d21"); gr.addColorStop(0.5,on?"#454a52":"#2a2d33"); gr.addColorStop(0.82,on?"#2c3036":"#1b1d21"); gr.addColorStop(1,"#0f1013");
    x.fillStyle=gr; x.fillRect(x0+0.5,y0+0.5,s-1,s-1);
    x.strokeStyle="rgba(0,0,0,0.35)"; x.lineWidth=1; for(var q=1;q<4;q++){ x.beginPath(); if(on){ x.moveTo(x0+q*s/4,y0); x.lineTo(x0+q*s/4,y0+s); } else { x.moveTo(x0,y0+q*s/4); x.lineTo(x0+s,y0+q*s/4); } x.stroke(); } }
  var t=sc_ctex(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(5,5); return t;
}
function sc_stripeTex(){
  var c=sc_canvas(128,16), x=c.getContext("2d");
  for(var i=0;i<8;i++){ x.fillStyle=i%2?"#f2eee4":"#e5562b"; x.fillRect(i*16,0,16,16); }
  x.fillStyle="rgba(0,0,0,0.15)"; x.fillRect(0,13,128,3);
  return sc_ctex(c);
}
function sc_letterTex(){
  var c=sc_canvas(512,512), x=c.getContext("2d");
  function arc(txt, r, a0, span, size){
    x.font="bold "+size+"px 'Barlow Condensed','Arial Narrow',Arial,sans-serif";
    var tw=0, i, ws=[]; for(i=0;i<txt.length;i++){ ws.push(x.measureText(txt[i]).width); tw+=ws[i]; }
    var a=a0-span/2;
    for(i=0;i<txt.length;i++){ var da=ws[i]/tw*span; x.save(); x.translate(256,256); x.rotate(a+da/2+PI/2); x.fillText(txt[i], -ws[i]/2, -r); x.restore(); a+=da; }
  }
  x.fillStyle="rgba(240,236,226,0.95)"; x.textBaseline="middle";
  arc("SECTION LINE", 204, -PI/2, 1.25, 46); arc("SECTION LINE", 204, PI/2, 1.25, 46);
  x.fillStyle="rgba(240,236,226,0.7)";
  arc("DRAG · RADIAL · 15", 204, 0, 0.9, 26); arc("DRAG · RADIAL · 15", 204, PI, 0.9, 26);
  return sc_ctex(c);
}
function sc_decalMat(num, color, kind){
  var key=kind+"|"+num+"|"+(color>>>0); if(SC.tex[key]) return SC.tex[key];
  var c0=new THREE.Color(color), lum=0.2126*c0.r+0.7152*c0.g+0.0722*c0.b;
  var fg=lum>0.55?"#15171a":"#f3efe4", ac="#3f7fd0";
  var c, x;
  if(kind==="banner"){
    c=sc_canvas(512,64); x=c.getContext("2d");
    x.fillStyle="rgba(12,16,22,0.92)"; x.fillRect(0,0,512,64);
    x.fillStyle="#e9e4d6"; x.font="bold 40px 'Barlow Condensed','Arial Narrow',Arial,sans-serif"; x.textAlign="center"; x.textBaseline="middle"; x.fillText("LONGLIGHT INTERACTIVE", 256, 34, 480);
  } else {
    c=sc_canvas(512,200); x=c.getContext("2d");
    x.fillStyle="#f3efe4"; x.beginPath(); x.arc(118,96,78,0,TAU); x.fill();
    x.lineWidth=6; x.strokeStyle=ac; x.stroke();
    x.fillStyle="#141518"; x.font="bold 104px 'Barlow Condensed','Arial Narrow',Arial,sans-serif"; x.textAlign="center"; x.textBaseline="middle"; x.fillText(num, 118, 102);
    x.textAlign="left"; x.fillStyle=fg; x.font="bold 46px 'Barlow Condensed','Arial Narrow',Arial,sans-serif"; x.fillText("LONGLIGHT", 216, 74, 284);
    x.font="bold 30px 'Barlow Condensed','Arial Narrow',Arial,sans-serif"; x.fillText("INTERACTIVE · RACING", 218, 116, 280);
    x.fillStyle=ac; x.fillRect(216,142,280,9); x.fillStyle=fg; x.fillRect(216,158,210,5);
  }
  var q=new THREE.MeshStandardMaterial({map:sc_ctex(c), transparent:true, depthWrite:false, roughness:0.3, metalness:0.05, polygonOffset:true, polygonOffsetFactor:-3});
  var env=sc_env(); if(env) q.envMap=env;
  SC.tex[key]=q; return q;
}

/* --- SPONSOR LIVERY (career sponsors, fictional brands) ----------------------
   LIVERY {key, hood, sides:[...]} comes from the app (ENGINE_VIS.setLivery); a sponsor is {id, name, tag, shape, c1 plate, c2 mark, c3 word}.
   Each logo is drawn once per sponsor on a canvas and cached (spLogoCanvas also feeds the app's cards and slips). The strip
   car keeps its own decal meshes and only swaps materials; the pull and salt vehicles get a hood plane and a few side planes. */
var LIVERY={key:"", hood:null, sides:[]}, LIV_CV={}, LIV_MAT={}, LIV_PG=null;
function spRRect(x, x0, y0, w, h, r){ x.beginPath(); x.moveTo(x0+r,y0); x.lineTo(x0+w-r,y0); x.quadraticCurveTo(x0+w,y0,x0+w,y0+r); x.lineTo(x0+w,y0+h-r); x.quadraticCurveTo(x0+w,y0+h,x0+w-r,y0+h); x.lineTo(x0+r,y0+h); x.quadraticCurveTo(x0,y0+h,x0,y0+h-r); x.lineTo(x0,y0+r); x.quadraticCurveTo(x0,y0,x0+r,y0); x.closePath(); }
function spShape(x, shape, cx, cy, r, col, bg){
  var i, a, q; x.save(); x.translate(cx, cy); x.fillStyle=col; x.strokeStyle=col; x.lineJoin="round"; x.beginPath();
  if(shape==="drop"){ x.moveTo(0,-r); x.bezierCurveTo(r*0.5,-r*0.4, r*0.78,r*0.0, r*0.78,r*0.3); x.arc(0,r*0.3,r*0.78,0,PI); x.bezierCurveTo(-r*0.78,r*0.0,-r*0.5,-r*0.4,0,-r); x.fill(); }
  else if(shape==="ring"){ x.lineWidth=r*0.34; x.arc(0,0,r*0.8,0,TAU); x.stroke(); x.beginPath(); x.arc(0,0,r*0.3,0,TAU); x.fill(); }
  else if(shape==="gear"){ for(i=0;i<16;i++){ a=i/16*TAU; q=(i%2)?r*0.76:r; x.lineTo(Math.cos(a)*q, Math.sin(a)*q); x.lineTo(Math.cos(a+TAU/16)*q, Math.sin(a+TAU/16)*q); } x.closePath(); x.fill(); x.fillStyle=bg; x.beginPath(); x.arc(0,0,r*0.36,0,TAU); x.fill(); }
  else if(shape==="diamond"){ x.moveTo(0,-r); x.lineTo(r*0.8,0); x.lineTo(0,r); x.lineTo(-r*0.8,0); x.closePath(); x.fill(); x.fillStyle=bg; x.beginPath(); x.moveTo(0,-r*0.45); x.lineTo(r*0.36,0); x.lineTo(0,r*0.45); x.lineTo(-r*0.36,0); x.closePath(); x.fill(); }
  else if(shape==="leaf"){ x.moveTo(0,r); x.quadraticCurveTo(-r*1.05,0,0,-r); x.quadraticCurveTo(r*1.05,0,0,r); x.fill(); x.strokeStyle=bg; x.lineWidth=r*0.12; x.beginPath(); x.moveTo(0,r*0.85); x.lineTo(0,-r*0.7); x.stroke(); }
  else if(shape==="shield"){ x.moveTo(-r*0.8,-r*0.85); x.lineTo(r*0.8,-r*0.85); x.lineTo(r*0.8,0); x.quadraticCurveTo(r*0.7,r*0.7,0,r); x.quadraticCurveTo(-r*0.7,r*0.7,-r*0.8,0); x.closePath(); x.fill(); x.fillStyle=bg; x.fillRect(-r*0.12,-r*0.6,r*0.24,r*1.1); x.fillRect(-r*0.5,-r*0.25,r,r*0.24); }
  else if(shape==="bolt"){ x.moveTo(r*0.25,-r); x.lineTo(-r*0.6,r*0.12); x.lineTo(-r*0.02,r*0.12); x.lineTo(-r*0.3,r); x.lineTo(r*0.62,-r*0.2); x.lineTo(r*0.04,-r*0.2); x.closePath(); x.fill(); }
  else if(shape==="wing"){ for(i=0;i<3;i++){ x.beginPath(); x.moveTo(-r,-r*0.55+i*r*0.5); x.lineTo(r*0.95,-r*0.55+i*r*0.5); x.lineTo(r*0.65-i*r*0.3,-r*0.2+i*r*0.5); x.lineTo(-r*0.85+i*r*0.1,-r*0.2+i*r*0.5); x.closePath(); x.fill(); } }
  else { for(i=0;i<10;i++){ a=-PI/2+i/10*TAU; q=(i%2)?r*0.42:r; x.lineTo(Math.cos(a)*q, Math.sin(a)*q); } x.closePath(); x.fill(); }   /* star */
  x.restore();
}
/* the logo: a plate in the brand colour, the mark on the left, the wordmark and a tag line */
function spLogoCanvas(sp, w, h){
  w=w||512; h=h||192; var key=sp.id+"|"+w+"x"+h; if(LIV_CV[key]) return LIV_CV[key];
  var c=newCanvas(w,h), x=c.getContext("2d"), F="'Barlow Condensed','Arial Narrow',Arial,sans-serif", m=Math.round(h*0.05), r=h*0.16;
  x.clearRect(0,0,w,h); spRRect(x, m, m, w-2*m, h-2*m, r); x.fillStyle=sp.c1; x.fill();
  x.lineWidth=Math.max(2,h*0.03); x.strokeStyle=sp.c2; spRRect(x, m*2.4, m*2.4, w-4.8*m, h-4.8*m, r*0.7); x.stroke();
  spShape(x, sp.shape, h*0.52, h*0.5, h*0.27, sp.c2, sp.c1);
  var tx=h*0.92, tw=w-tx-h*0.18, word=String(sp.name||"").toUpperCase();
  x.textAlign="left"; x.textBaseline="alphabetic"; x.fillStyle=sp.c3; x.font="italic 700 "+Math.round(h*0.4)+"px "+F; x.fillText(word, tx, h*0.6, tw);
  x.fillStyle=sp.c2; x.font="600 "+Math.round(h*0.15)+"px "+F; x.fillText(String(sp.tag||"").toUpperCase(), tx+2, h*0.8, tw);
  LIV_CV[key]=c; return c;
}
function livMat(sp){
  if(LIV_MAT[sp.id]) return LIV_MAT[sp.id];
  var t=new THREE.CanvasTexture(spLogoCanvas(sp,512,192)); t.encoding=THREE.sRGBEncoding; t.anisotropy=MAXANISO;
  var q=new THREE.MeshStandardMaterial({map:t, transparent:true, depthWrite:false, roughness:0.32, metalness:0.05, polygonOffset:true, polygonOffsetFactor:-3, polygonOffsetUnits:-3});
  var env=sc_env(); if(env) q.envMap=env;
  LIV_MAT[sp.id]=q; return q;
}
/* the strip car's door decal: the race number, with the side sponsors where the studio name (Longlight Interactive) went (one, or two stacked) */
function livDoorMat(num, color){
  var key="door|"+num+"|"+LIVERY.key; if(LIV_MAT[key]) return LIV_MAT[key];
  var c=sc_canvas(512,200), x=c.getContext("2d"), L=LIVERY.sides.length?LIVERY.sides.slice(0,2):[LIVERY.hood];
  x.fillStyle="#f3efe4"; x.beginPath(); x.arc(118,96,78,0,TAU); x.fill(); x.lineWidth=6; x.strokeStyle=L[0].c1; x.stroke();
  x.fillStyle="#141518"; x.font="bold 104px 'Barlow Condensed','Arial Narrow',Arial,sans-serif"; x.textAlign="center"; x.textBaseline="middle"; x.fillText(num, 118, 102);
  if(L.length===1) x.drawImage(spLogoCanvas(L[0],512,192), 206, 40, 300, 112.5);
  else L.forEach(function(sp,i){ x.drawImage(spLogoCanvas(sp,512,192), 214, 6+i*96, 250, 94); });
  var q=new THREE.MeshStandardMaterial({map:sc_ctex(c), transparent:true, depthWrite:false, roughness:0.3, metalness:0.05, polygonOffset:true, polygonOffsetFactor:-3});
  var env=sc_env(); if(env) q.envMap=env;
  LIV_MAT[key]=q; return q;
}
/* windshield banner in the primary sponsor's colours */
function livBannerMat(sp){
  var key="ban|"+sp.id; if(LIV_MAT[key]) return LIV_MAT[key];
  var c=sc_canvas(512,64), x=c.getContext("2d");
  x.fillStyle=sp.c1; x.fillRect(0,0,512,64); x.fillStyle=sp.c2; x.fillRect(0,56,512,8);
  spShape(x, sp.shape, 40, 30, 20, sp.c2, sp.c1);
  x.fillStyle=sp.c3; x.font="italic bold 40px 'Barlow Condensed','Arial Narrow',Arial,sans-serif"; x.textAlign="center"; x.textBaseline="middle"; x.fillText(String(sp.name).toUpperCase(), 270, 31, 420);
  var q=new THREE.MeshStandardMaterial({map:sc_ctex(c), transparent:true, depthWrite:false, roughness:0.3, metalness:0.05, polygonOffset:true, polygonOffsetFactor:-3});
  var env=sc_env(); if(env) q.envMap=env;
  LIV_MAT[key]=q; return q;
}
/* the player's strip car (and the salt Altered, which is one): swap the door / banner materials, show the hood patch */
function stripLivery(car){
  var L=car && car.userData && car.userData.liv; if(!L) return; var key=LIVERY.key; if(L.key===key) return; L.key=key;
  var on=!!(key && LIVERY.hood), i;
  for(i=0;i<L.door.length;i++) L.door[i].material=on?livDoorMat(L.num, L.color):L.dm;
  for(i=0;i<L.banner.length;i++) L.banner[i].material=on?livBannerMat(LIVERY.hood):L.bm;
  if(L.hood){ L.hood.visible=on; if(on) L.hood.material=livMat(LIVERY.hood); }
}
/* logo planes for the pull and salt vehicles: spots [{role:"hood"|"side", w, h, p:[x,y,z], u:[..], v:[..]}] (u = along the text, v = up the logo) */
var _livU=new THREE.Vector3(), _livV=new THREE.Vector3(), _livN=new THREE.Vector3();
function livPlanes(parent, U, spots){
  var key=LIVERY.key+"|"+GFX; if(U.livKey===key) return; U.livKey=key;
  if(U.livG){ parent.remove(U.livG); U.livG=null; }
  if(!LIVERY.key || !LIVERY.hood) return;
  var G=new THREE.Group(); if(!LIV_PG){ LIV_PG=new THREE.PlaneGeometry(1,1); LIV_PG.__cached=true; }
  spots.forEach(function(s){
    var sp=s.role==="hood"?LIVERY.hood:(LIVERY.sides.length?LIVERY.sides[(s.i||0)%LIVERY.sides.length]:null);
    if(!sp || (s.role!=="hood" && GFX==="lite")) return;   /* Lite: the hood logo only */
    var m=new THREE.Mesh(LIV_PG, livMat(sp)); _livU.fromArray(s.u); _livV.fromArray(s.v); _livN.crossVectors(_livU,_livV);
    m.matrix.makeBasis(_livU, _livV, _livN); m.matrix.scale(_livN.set(s.w, s.h, 1)); m.matrix.setPosition(s.p[0], s.p[1], s.p[2]); m.matrixAutoUpdate=false; m.renderOrder=3;
    G.add(m); });
  parent.add(G); U.livG=G;
}

/* --- body loft ------------------------------------------------------------ */
/* keys: [{x,zb,ys,yt,w,wt,cr}] rear->front: bottom, beltline, top centre, side half-width, top half-width, crown.
   PCHIP interpolation (no overshoot); arches carve the sill; rake/lift shift every height. */
function sc_def(rows, o){
  var keys=rows.map(function(r){ return {x:r[0], zb:r[1], ys:r[2], yt:r[3], w:r[4], wt:r[5], cr:r[6]}; });
  var n=keys.length; keys.m={};
  SC_F.forEach(function(f){
    var m=[], s=[], h=[], i;
    for(i=0;i<n-1;i++){ h[i]=keys[i+1].x-keys[i].x; s[i]=(keys[i+1][f]-keys[i][f])/h[i]; }
    m[0]=s[0]; m[n-1]=s[n-2];
    for(i=1;i<n-1;i++){ if(s[i-1]*s[i]<=0) m[i]=0; else { var w1=2*h[i]+h[i-1], w2=h[i]+2*h[i-1]; m[i]=(w1+w2)/(w1/s[i-1]+w2/s[i]); } }
    keys.m[f]=m;
  });
  var D={keys:keys, arches:o.arches||[], rake:o.rake||0, rakeX:o.rakeX||0, lift:o.lift||0, sub:o.sub||2, flares:o.flares||[]};
  D.X=sc_stations(D);
  return D;
}
function sc_params(D, x, out){
  var K=D.keys, n=K.length, i=0, f, j;
  if(x<=K[0].x){ for(j=0;j<6;j++){ f=SC_F[j]; out[f]=K[0][f]; } }
  else if(x>=K[n-1].x){ for(j=0;j<6;j++){ f=SC_F[j]; out[f]=K[n-1][f]; } }
  else {
    while(i<n-2 && x>K[i+1].x) i++;
    var h=K[i+1].x-K[i].x, t=(x-K[i].x)/h, t2=t*t, t3=t2*t, h00=2*t3-3*t2+1, h10=t3-2*t2+t, h01=-2*t3+3*t2, h11=t3-t2;
    for(j=0;j<6;j++){ f=SC_F[j]; out[f]=h00*K[i][f]+h10*h*K.m[f][i]+h01*K[i+1][f]+h11*h*K.m[f][i+1]; }
  }
  var dy=D.lift+(x-D.rakeX)*D.rake; out.zb+=dy; out.ys+=dy; out.yt+=dy;
  for(j=0;j<D.flares.length;j++){ var F=D.flares[j], u=(x-F.x)/F.span; if(u>-1&&u<1){ var cb=Math.cos(u*PI/2); out.w+=F.amt*cb*cb; out.ys+=F.up*cb*cb; } }
  for(j=0;j<D.arches.length;j++){ var a=D.arches[j], dx=x-a.x; if(dx>-a.R && dx<a.R){ var ay=a.y+Math.sqrt(a.R*a.R-dx*dx); if(ay>out.zb) out.zb=ay; } }
  if(out.zb>out.ys-0.045) out.zb=out.ys-0.045;
  return out;
}
function sc_ring(p, R){
  var zb=p.zb, ys=p.ys, h=ys-zb, w=p.w, wt=p.wt, top=p.yt-p.cr, z5=w*0.975, j;
  var Y=[zb, zb, zb+Math.min(0.055,h*0.2), zb+h*0.45, zb+h*0.8, ys, lerp(ys,top,0.36), lerp(ys,top,0.7), top, p.yt-p.cr*0.2, p.yt];
  var Z=[0, w*0.8, w*0.955, w, w*0.995, z5, lerp(z5,wt,0.36)+0.006, lerp(z5,wt,0.7)+0.004, wt, wt*0.56, 0];
  for(j=0;j<=10;j++){ R[2*j]=Y[j]; R[2*j+1]=Z[j]; }
  for(j=11;j<20;j++){ R[2*j]=Y[20-j]; R[2*j+1]=-Z[20-j]; }
  return R;
}
function sc_stations(D){
  var K=D.keys, xs=[], i, s;
  for(i=0;i<K.length-1;i++) for(s=0;s<D.sub;s++) xs.push(lerp(K[i].x,K[i+1].x,s/D.sub));
  xs.push(K[K.length-1].x);
  D.arches.forEach(function(a){ for(var j=0;j<=8;j++) xs.push(a.x+a.R*Math.cos(PI*j/8)); xs.push(a.x+a.R+0.008, a.x-a.R-0.008); });
  xs=xs.filter(function(x){ return x>=K[0].x && x<=K[K.length-1].x; }).sort(function(a,b){ return a-b; });
  var out=[xs[0]]; for(i=1;i<xs.length;i++) if(xs[i]-out[out.length-1]>0.004) out.push(xs[i]);
  out[out.length-1]=K[K.length-1].x;
  return out;
}
function sc_pt(D, x, k, out, P, R){
  sc_params(D, x, P); sc_ring(P, R);
  k=((k%20)+20)%20; var k0=Math.floor(k), f=k-k0, k1=(k0+1)%20;
  return out.set(x, lerp(R[2*k0],R[2*k1],f), lerp(R[2*k0+1],R[2*k1+1],f));
}
/* returns {paint, well, capF:{x,p}, capR} ; the underside (k 19->0->1) is the dark wheel-well / floor */
function sc_loft(D){
  var X=D.X, nX=X.length, NS=20, pos=[], iP=[], iW=[], P={}, R=new Float32Array(40), i, k;
  for(i=0;i<nX;i++){ sc_params(D,X[i],P); sc_ring(P,R); for(k=0;k<NS;k++) pos.push(X[i], R[2*k], R[2*k+1]); }
  for(i=0;i<nX-1;i++) for(k=0;k<NS;k++){
    var kn=(k+1)%NS, a=i*NS+k, b=(i+1)*NS+k, c=(i+1)*NS+kn, d=i*NS+kn, dst=(k===0||k===NS-1)?iW:iP;
    dst.push(a,b,c, a,c,d);
  }
  function cap(ii, front){
    sc_params(D,X[ii],P); sc_ring(P,R); var base=pos.length/3, cy=(P.zb+P.yt)/2;
    pos.push(X[ii], cy, 0); for(k=0;k<NS;k++) pos.push(X[ii], R[2*k], R[2*k+1]);
    for(k=0;k<NS;k++){ var p0=base+1+k, p1=base+1+(k+1)%NS; if(front) iP.push(base,p1,p0); else iP.push(base,p0,p1); }
    return {x:X[ii], zb:P.zb, ys:P.ys, yt:P.yt, w:P.w, wt:P.wt};
  }
  var capR=cap(0,false), capF=cap(nX-1,true);
  var full=new THREE.BufferGeometry(); full.setAttribute("position", new THREE.Float32BufferAttribute(pos,3)); full.setIndex(iP.concat(iW)); full.computeVertexNormals();
  var gP=new THREE.BufferGeometry(), gW=new THREE.BufferGeometry();
  gP.setAttribute("position", full.attributes.position); gP.setAttribute("normal", full.attributes.normal); gP.setIndex(iP);
  gW.setAttribute("position", full.attributes.position); gW.setAttribute("normal", full.attributes.normal); gW.setIndex(iW);
  return {paint:gP, well:gW, capF:capF, capR:capR};
}
/* overlay patch on the loft surface (glass, decals, carbon hood), pushed out along the normal */
function sc_patch(D, x0, x1, k0, k1, off, uvMode, kStep){
  var xs=[x0], ks=[k0], i, j, P={}, R=new Float32Array(40), p=new THREE.Vector3(), a=new THREE.Vector3(), b=new THREE.Vector3(), nn=new THREE.Vector3(), du=new THREE.Vector3(), dk=new THREE.Vector3();
  D.X.forEach(function(x){ if(x>x0+0.004 && x<x1-0.004) xs.push(x); }); xs.push(x1);
  var st=kStep||1; for(var kk=Math.floor(k0/st)*st+st; kk<k1-0.02; kk+=st) ks.push(kk); ks.push(k1);
  var pos=[], nor=[], uv=[], idx=[], nk=ks.length;
  for(i=0;i<xs.length;i++) for(j=0;j<nk;j++){
    var x=xs[i], k=ks[j];
    sc_pt(D,x,k,p,P,R);
    sc_pt(D,x+0.01,k,a,P,R); sc_pt(D,x-0.01,k,b,P,R); du.subVectors(a,b);
    sc_pt(D,x,k+0.2,a,P,R); sc_pt(D,x,k-0.2,b,P,R); dk.subVectors(a,b);
    nn.crossVectors(du,dk).normalize();
    pos.push(p.x+nn.x*off, p.y+nn.y*off, p.z+nn.z*off); nor.push(nn.x,nn.y,nn.z);
    var fu=(x-x0)/(x1-x0), fk=(k-k0)/(k1-k0);
    if(uvMode==="L") uv.push(1-fu, 1-fk); else if(uvMode==="K") uv.push(fk, 1-fu); else uv.push(fu, fk);
  }
  for(i=0;i<xs.length-1;i++) for(j=0;j<nk-1;j++){ var A0=i*nk+j, B0=(i+1)*nk+j, C0=(i+1)*nk+j+1, D0=i*nk+j+1; idx.push(A0,B0,C0, A0,C0,D0); }
  var g=new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos,3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor,3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx);
  return g;
}

/* --- small shape helpers ---------------------------------------------------- */
function sc_rr(w,h,r){ var s=new THREE.Shape(), x=-w/2, y=-h/2; r=Math.min(r,w/2,h/2);
  s.moveTo(x+r,y); s.lineTo(x+w-r,y); s.quadraticCurveTo(x+w,y,x+w,y+r); s.lineTo(x+w,y+h-r); s.quadraticCurveTo(x+w,y+h,x+w-r,y+h); s.lineTo(x+r,y+h); s.quadraticCurveTo(x,y+h,x,y+h-r); s.lineTo(x,y+r); s.quadraticCurveTo(x,y,x+r,y); return s; }
/* beveled box, w along x, h along y, d along z, centred */
function sc_rbox(w,h,d,b){
  if(SC.lite){ var kl="rbL"+[w,h,d].map(r3).join("_"); return SC.geo[kl]||(SC.geo[kl]=new THREE.BoxGeometry(w,h,d)); }   /* v3: Lite strip cars use plain boxes */
  var key="rb"+[w,h,d,b].map(r3).join("_"); if(SC.geo[key]) return SC.geo[key];
  b=Math.min(b, w*0.3, h*0.3, d*0.3);
  var g=new THREE.ExtrudeGeometry(sc_rr(w-2*b,h-2*b,b*1.2), {depth:Math.max(0.001,d-2*b), bevelEnabled:true, bevelThickness:b, bevelSize:b, bevelSegments:1, curveSegments:2});
  g.translate(0,0,-(d-2*b)/2); return (SC.geo[key]=g);
}
/* side profile (x,y points) extruded across z */
function sc_prof(pts, d, b){
  if(SC.lite) b=0;   /* v3: Lite: no bevels */
  var s=new THREE.Shape(); s.moveTo(pts[0][0],pts[0][1]); for(var i=1;i<pts.length;i++) s.lineTo(pts[i][0],pts[i][1]);
  var g=new THREE.ExtrudeGeometry(s, {depth:Math.max(0.001,d-2*(b||0)), bevelEnabled:!!b, bevelThickness:b||0, bevelSize:b||0, bevelSegments:2, curveSegments:4});
  g.translate(0,0,-(d-2*(b||0))/2); return g;
}
/* inverted airfoil (leading edge +x), span along z */
function sc_foil(chord, thick, span, b){
  var pts=[], N=9, i, u, yt;
  for(i=0;i<=N;i++){ u=(1-Math.cos(PI*i/N))/2; yt=5*thick*(0.2969*Math.sqrt(u)-0.126*u-0.3516*u*u+0.2843*u*u*u-0.1036*u*u*u*u); pts.push([chord/2-u*chord, -yt*1.35+0.02*chord*Math.sin(PI*u)]); }
  for(i=N-1;i>0;i--){ u=(1-Math.cos(PI*i/N))/2; yt=5*thick*(0.2969*Math.sqrt(u)-0.126*u-0.3516*u*u+0.2843*u*u*u-0.1036*u*u*u*u); pts.push([chord/2-u*chord, yt*0.55+0.02*chord*Math.sin(PI*u)]); }
  pts.reverse();
  return sc_prof(pts, span, SC.lite?0:(b||0.004));
}
/* r6: bolt-on wheelie bars for a shell that has none (drag setup). A handful of rods + two skid wheels on the body frame;
   U.wbar makes the pitch code treat it like a bars body (lower pitch stop, rides the bars). Same look as the factory bars above. */
function stripAddBars(car){
  var U=car.userData, me=U.meta, inner=U.bodyGroup.children[0], M=sc_mats(), br=0.065, maxP=deg(5);
  var bb=new THREE.Box3().setFromObject(car), cs=U.chute; if(cs&&cs.parent===car) bb.expandByObject(cs);
  var bx0=me.xr-0.05, bx1=Math.min(bb.min.x-0.12, me.xr-1.15), rr=me.rr, dxB=bx1-me.xr, cy=(br-rr-dxB*Math.sin(maxP))/Math.cos(maxP)+rr;
  var g=new THREE.Group(); g.name="sc_wbar";
  function add(geo, mat, m){ var me2=new THREE.Mesh(geo, mat); me2.applyMatrix4(m); me2.matrixAutoUpdate=false; me2.castShadow=true; g.add(me2); }
  [-1,1].forEach(function(sd){
    var a=new THREE.Vector3(bx0, 0.3, sd*0.36), b=new THREE.Vector3(bx1, cy, sd*0.3);
    add(sc_cyl(0.022,8), M.tube, sc_rodM(a,b));
    add(sc_cyl(0.014,6), M.tube, sc_rodM(new THREE.Vector3(bx0, 0.46, sd*0.36), b));
    add(new THREE.CylinderGeometry(br,br,0.045,SC.lite?8:14), M.rubber, sc_M(bx1, cy, sd*0.3, PI/2,0,0));
  });
  add(sc_cyl(0.018,8), M.tube, sc_rodM(new THREE.Vector3(bx1+0.05, cy, -0.3), new THREE.Vector3(bx1+0.05, cy, 0.3)));
  inner.add(g); U.wbar=true; U.maxPitch=Math.min(me.maxPitch, maxP);
}
function sc_rodM(a, b){ /* matrix mapping a unit Y cylinder (centre origin, h=1) onto segment a->b */
  var d=new THREE.Vector3().subVectors(b,a), L=d.length(), q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), d.clone().normalize());
  return new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a,b).multiplyScalar(0.5), q, new THREE.Vector3(1,L,1));
}
function sc_cyl(r, seg){ if(SC.lite){ var kl="cyL"+r3(r)+"_"+Math.min(seg||8,6); return SC.geo[kl]||(SC.geo[kl]=new THREE.CylinderGeometry(r,r,1,Math.min(seg||8,6),1,true)); }   /* v3: Lite rods: 6 sides, no caps */
  var key="cy"+r3(r)+"_"+seg; return SC.geo[key]||(SC.geo[key]=new THREE.CylinderGeometry(r,r,1,seg||8,1,false)); }
function sc_M(x,y,z,rx,ry,rz,sx,sy,sz){ return mkM(x,y,z,rx,ry,rz,sx,sy,sz); }
function sc_bin(){ var B={}; B.add=function(k,g,m){ (B[k]||(B[k]=[])).push({g:g, m:m||new THREE.Matrix4()}); }; return B; }
function sc_merge(list){ return mergeGeos(list); }

/* --- wheels -------------------------------------------------------------- */
function sc_tyreGeo(r, w, rimR){
  var key="ty"+[r,w,rimR].map(r3).join("_"); if(SC.geo[key]) return SC.geo[key];
  var hw=w/2, sh=Math.min(0.055,(r-rimR)*0.3), pr=[
    [rimR+0.004, 0.86], [lerp(rimR,r,0.34), 1], [lerp(rimR,r,0.74), 1], [r-sh, 0.965], [r-sh*0.22, 0.82]], pts=[], i;
  for(i=0;i<pr.length;i++) pts.push(new THREE.Vector2(pr[i][0], -hw*pr[i][1]));
  for(i=pr.length-1;i>=0;i--) pts.push(new THREE.Vector2(pr[i][0], hw*pr[i][1]));
  return (SC.geo[key]=new THREE.LatheGeometry(pts, 18));
}
function sc_rimGeo(rimR, w, style, brk){
  var key="rim"+[rimR,w].map(r3).join("_")+style+(brk?"b":""); if(SC.geo[key]) return SC.geo[key];
  var n=style==="star"?5:style==="wire"?12:style==="bead"?8:10, spk=style==="star"?0.44:style==="wire"?0.1:style==="bead"?0.3:0.22;
  var fr=rimR*0.9, rin=rimR*(style==="wire"?0.3:0.34), rout=rimR*(style==="star"?0.8:0.78), hw=w/2;
  var s=new THREE.Shape(); s.absarc(0,0,fr,0,TAU,false);
  for(var i=0;i<n;i++){
    var a0=i*TAU/n+spk/2, a1=(i+1)*TAU/n-spk/2, hp=new THREE.Path(), j, m=3;
    for(j=0;j<=m;j++){ var a=lerp(a0,a1,j/m); if(j===0) hp.moveTo(Math.cos(a)*rout, Math.sin(a)*rout); else hp.lineTo(Math.cos(a)*rout, Math.sin(a)*rout); }
    var ai0=a0+(style==="star"?0.12:0.04), ai1=a1-(style==="star"?0.12:0.04);
    for(j=2;j>=0;j--){ var b=lerp(ai0,ai1,j/2); hp.lineTo(Math.cos(b)*rin, Math.sin(b)*rin); }
    s.holes.push(hp);
  }
  var face=new THREE.ExtrudeGeometry(s, {depth:0.016, bevelEnabled:false, curveSegments:6});
  face.rotateX(-PI/2); face.translate(0, hw*0.78, 0);
  var lip=new THREE.LatheGeometry([new THREE.Vector2(rimR*0.86, hw*0.8), new THREE.Vector2(rimR*0.9, hw*0.9), new THREE.Vector2(rimR*1.02, hw*0.92), new THREE.Vector2(rimR*1.04, hw*0.84)], 16);
  var cap=new THREE.CylinderGeometry(rimR*0.17, rimR*0.23, 0.05, 8); cap.translate(0, hw*0.78+0.03, 0);
  var parts=[{g:face,m:new THREE.Matrix4()},{g:lip,m:new THREE.Matrix4()},{g:cap,m:new THREE.Matrix4()}];
  if(style==="bead"){ var ring=new THREE.LatheGeometry([new THREE.Vector2(rimR*0.9, hw*0.92), new THREE.Vector2(rimR*0.92, hw+0.012), new THREE.Vector2(rimR*1.06, hw+0.012), new THREE.Vector2(rimR*1.08, hw*0.9)], 16); parts.push({g:ring,m:new THREE.Matrix4()}); }
  var rimG=mergeGeos(parts);
  /* barrel (inside, seen through the windows) + dark hub backing so you can't see through the wheel */
  var barrel=new THREE.LatheGeometry([new THREE.Vector2(rimR*0.95, -hw*0.8), new THREE.Vector2(rimR*0.9, hw*0.3), new THREE.Vector2(rimR*0.88, hw*0.8)], 12);
  var back=new THREE.CircleGeometry(rimR*0.92, 12); back.rotateX(-PI/2); back.translate(0, -hw*0.1, 0);
  var hub=new THREE.CylinderGeometry(rimR*0.3, rimR*0.3, hw*0.8, 8, 1, true); hub.translate(0, hw*0.35, 0);
  var inL=[{g:barrel,m:new THREE.Matrix4()},{g:back,m:new THREE.Matrix4()},{g:hub,m:new THREE.Matrix4()}];
  if(brk){   /* v3: brake rotor + hat behind the spokes (merged into the barrel, so no extra draw call) */
    var ro=new THREE.CylinderGeometry(rimR*0.8, rimR*0.8, 0.026, 22, 1, false); ro.translate(0, hw*0.28, 0);
    var hat=new THREE.CylinderGeometry(rimR*0.36, rimR*0.4, hw*0.3, 10, 1, true); hat.translate(0, hw*0.42, 0);
    inL.push({g:ro,m:new THREE.Matrix4()},{g:hat,m:new THREE.Matrix4()});
  }
  var inG=mergeGeos(inL);
  return (SC.geo[key]={rim:rimG, inner:inG});
}
function sc_ringGeo(r, rimR){ var key="lr"+r3(r)+"_"+r3(rimR); if(SC.geo[key]) return SC.geo[key];
  var ri=lerp(rimR,r,0.36), ro=lerp(rimR,r,0.73), g=new THREE.RingGeometry(ri, ro, 40, 1), p=g.attributes.position, uv=g.attributes.uv;
  for(var i=0;i<p.count;i++){ var x=p.getX(i), y=p.getY(i), rr=Math.sqrt(x*x+y*y), a=Math.atan2(y,x), t=(rr-ri)/(ro-ri), R=0.3125+t*(0.4648-0.3125); uv.setXY(i, 0.5+Math.cos(a)*R, 0.5+Math.sin(a)*R); }
  g.rotateX(-PI/2); return (SC.geo[key]=g); }
function sc_wheel(ws, M){
  var car=new THREE.Group(), hold=new THREE.Group(), spin=new THREE.Group(), cont=new THREE.Group();
  hold.rotation.x=PI/2; spin.rotation.x=PI/2; cont.rotation.x=ws.z<0?PI:0;
  var ty=new THREE.Mesh(sc_tyreGeo(ws.r, ws.w, ws.rimR), M.rubber); ty.castShadow=true; ty.receiveShadow=true; hold.add(ty);
  var rg=sc_rimGeo(ws.rimR, ws.w, ws.style, ws.brake), rim=new THREE.Mesh(rg.rim, M[ws.rimMat]||M.alu), inn=new THREE.Mesh(rg.inner, ws.brake?M.rotor:M.barrel);
  rim.castShadow=true; cont.add(rim); cont.add(inn);
  var lt=new THREE.Group(), lm=new THREE.Mesh(sc_ringGeo(ws.r, ws.rimR), M.letters); lm.position.y=ws.w/2+0.0035; lm.renderOrder=2; lt.add(lm); if(ws.letters) cont.add(lt);
  spin.add(cont); car.add(hold); car.add(spin);
  car.userData={spin:spin, hold:hold, letters:lt, r:ws.r, hw:ws.w/2, rear:!!ws.rear, side:ws.z<0?-1:1};
  return car;
}

/* --- parachute ------------------------------------------------------------ */
function sc_chute(me, M){
  /* fix pack: a cross-form drag chute (four arms around a centre square, domed), shroud lines from each arm tip to the
     confluence, the fabric flutters in the vertex shader. Canopy axis along local +x (towards the car), rim at x=0. */
  var g=new THREE.Group(), rc=me.chuteR, A=0.375, key="xcano2"+r3(rc), geo=SC.geo[key];
  if(!geo){ var N=20, pos=[], uv=[], idx=[], i, j, DEP=0.34*rc, RA=1.12*rc;
    for(j=0;j<=N;j++) for(i=0;i<=N;i++){ var u=-1+2*i/N, v=-1+2*j/N, r2=Math.min(1,(u*u+v*v)/(1+A*A)), au=Math.abs(u), av=Math.abs(v);
      var puff=0.09*rc*(av<=A?Math.cos(PI/2*v/A):0)*Math.sin(PI*Math.max(0,au-A)/(1-A))+0.09*rc*(au<=A?Math.cos(PI/2*u/A):0)*Math.sin(PI*Math.max(0,av-A)/(1-A));   /* each arm bellies out between its seams */
      pos.push(-DEP*(1-r2)-puff, (u-v)*RA*0.7071, (u+v)*RA*0.7071);   /* set as an X, the way it reads from the chase cams */ uv.push((u+1)/2, (v+1)/2); }
    for(j=0;j<N;j++) for(i=0;i<N;i++){ var uc=-1+2*(i+0.5)/N, vc=-1+2*(j+0.5)/N; if(Math.abs(uc)>A && Math.abs(vc)>A) continue;
      var q=j*(N+1)+i; idx.push(q, q+1, q+N+1, q+1, q+N+2, q+N+1); }
    geo=new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos,3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv,2));
    geo.setIndex(idx); geo.computeVertexNormals(); SC.geo[key]=geo; }
  var mat=sc_chuteMat(M), cn=new THREE.Mesh(geo, mat); cn.castShadow=true; g.add(cn);
  var lg=SC.geo.chuteLine2||(SC.geo.chuteLine2=new THREE.CylinderGeometry(0.009,0.009,1,4,1,true).translate(0,0.5,0));
  var bg=SC.geo.chuteBridle||(SC.geo.chuteBridle=new THREE.CylinderGeometry(0.018,0.018,1,5,1,true).translate(0,0.5,0));
  var lines=[]; for(var k=0;k<4;k++) for(var s2=-1;s2<=1;s2+=2){ var l=new THREE.Mesh(lg, M.lineM), ca=Math.cos(k*PI/2+PI/4), sa=Math.sin(k*PI/2+PI/4);
    l.userData={cy:(ca*0.98-sa*s2*A)*1.12, cz:(sa*0.98+ca*s2*A)*1.12}; g.add(l); lines.push(l); }   /* the two corners of each arm tip */
  var br=new THREE.Mesh(bg, M.lineM); g.add(br);
  g.userData={canopy:cn, lines:lines, bridle:br, rc:rc, fl:mat.userData.fl};
  return g;
}
/* the canopy: white nylon, a coloured band across each arm tip, dark seams; fluttering arms (uFl = time, amount) */
function sc_chuteTex(){
  if(SC.tex.xchute) return SC.tex.xchute;
  var c=sc_canvas(128,128), x=c.getContext("2d"), A=0.375*64, m=64;
  x.fillStyle="#efebe2"; x.fillRect(0,0,128,128);
  x.fillStyle="#e5562b"; x.fillRect(0,m-A,22,2*A); x.fillRect(106,m-A,22,2*A); x.fillRect(m-A,0,2*A,22); x.fillRect(m-A,106,2*A,22);
  x.fillStyle="#1b1c20"; x.fillRect(0,m-A,8,2*A); x.fillRect(120,m-A,8,2*A); x.fillRect(m-A,0,2*A,8); x.fillRect(m-A,120,2*A,8);
  x.strokeStyle="rgba(40,36,30,0.45)"; x.lineWidth=1.5;
  [m-A, m+A].forEach(function(p){ x.beginPath(); x.moveTo(p,0); x.lineTo(p,128); x.moveTo(0,p); x.lineTo(128,p); x.stroke(); });
  x.strokeStyle="rgba(40,36,30,0.25)"; x.beginPath(); x.moveTo(m,0); x.lineTo(m,128); x.moveTo(0,m); x.lineTo(128,m); x.stroke();
  return (SC.tex.xchute=sc_ctex(c));
}
function sc_chuteMat(M){
  var env=M.canopy.envMap||null, fl={value:new THREE.Vector2(0,0)};
  var q=new THREE.MeshStandardMaterial({color:0xffffff, map:sc_chuteTex(), roughness:0.82, metalness:0, envMapIntensity:0.4, side:THREE.DoubleSide}); if(env) q.envMap=env;
  q.userData.fl=fl;
  q.onBeforeCompile=function(sh){ sh.uniforms.uFl=fl;
    sh.vertexShader=sh.vertexShader.replace("#include <common>", "#include <common>\nuniform vec2 uFl;").replace("#include <begin_vertex>",
      "#include <begin_vertex>\nfloat flR=length(position.yz), flA=atan(position.z,position.y);\n"+
      "transformed.x+=uFl.y*flR*flR*(0.07*sin(uFl.x*17.0+flA*2.0+flR*6.0)+0.06*sin(uFl.x*29.0-flR*9.0+flA*3.0));\n"+
      "transformed.yz*=1.0+uFl.y*0.035*sin(uFl.x*21.0+flA*4.0);"); };
  q.customProgramCacheKey=function(){ return "scChuteFl"; };
  return q;
}

/* --- v2: what the car carries -----------------------------------------------
   hw (optional, from setStrip): {asp:"na"|"turbo"|"twin"|"blower"|"centri", ic, als, n2o, diesel, style}
   style (door cars): "coupe" (the 90s shell, default) | "muscle" | "hatch" | "truck". No hw = the v1.5 cars exactly. */
function sc_hw(hw, body){
  if(!hw || typeof hw!=="object") return null;
  var a=String(hw.asp||"na"); if(!/^(na|turbo|twin|blower|centri)$/.test(a)) a="na";
  var st=sc_styleFor(body, String(hw.style||""), !!hw.diesel);   /* v3: per-class shell (strip-cars-shells.js) */
  var H={asp:a, ic:!!hw.ic && a!=="na" && a!=="blower", als:!!hw.als && (a==="turbo"||a==="twin"), n2o:!!hw.n2o, diesel:!!hw.diesel, style:st, lite:GFX==="lite"};
  H.boost=a!=="na"; H.turbo=(a==="turbo"||a==="twin");
  H.key=[a, H.ic?1:0, H.diesel?1:0, st, H.lite?1:0].join(",");
  return H;
}
/* door-car shells: loft rows (see sc_def) + where the glass, wheels and hood hardware go */
var SC_STYLE={
  coupe:{xr:-1.28, xf:1.27, roofF:0.18, cowl:0.98, roofR:-0.5, deck:-1.62, dG0:-0.52, qG0:-1.12, hx:1.3},
  muscle:{xr:-1.32, xf:1.42, roofF:0.06, cowl:0.72, roofR:-0.6, deck:-1.12, dG0:-0.42, qG0:-0.95, hx:1.36, rows:[
    [-2.36,.30,.85,.89,.86,.82,.02],[-2.28,.24,.92,.965,.89,.85,.02],[-1.85,.21,.93,.985,.90,.86,.03],[-1.42,.20,.935,1.0,.905,.82,.04],
    [-1.08,.19,.935,1.16,.905,.70,.05],[-0.62,.19,.935,1.285,.905,.645,.05],[0.06,.19,.935,1.295,.905,.645,.05],[0.46,.19,.935,1.09,.905,.77,.04],
    [0.72,.19,.93,.975,.905,.845,.03],[1.40,.20,.92,.96,.90,.86,.02],[2.02,.22,.90,.935,.89,.85,.02],[2.30,.25,.84,.875,.86,.82,.02],[2.40,.31,.73,.76,.80,.76,.02]]},
  hatch:{xr:-1.2, xf:1.2, roofF:0.06, cowl:0.84, roofR:-1.42, deck:-1.86, dG0:-0.42, qG0:-1.3, hx:1.24, spoilerRoof:true, rows:[
    [-1.98,.33,.84,.93,.80,.74,.02],[-1.92,.26,.88,1.04,.84,.77,.03],[-1.78,.22,.89,1.17,.85,.71,.04],[-1.45,.20,.90,1.29,.86,.645,.05],
    [-0.60,.20,.91,1.33,.865,.625,.05],[0.06,.20,.91,1.30,.865,.64,.05],[0.55,.20,.905,1.06,.86,.74,.04],[0.84,.20,.89,.93,.855,.80,.03],
    [1.35,.21,.85,.885,.85,.80,.03],[1.82,.24,.74,.765,.82,.76,.02],[1.98,.30,.62,.64,.76,.70,.02]]},
  truck:{xr:-1.42, xf:1.36, roofF:0.14, cowl:0.86, roofR:-0.52, deck:-0.74, dG0:-0.4, qG0:null, hx:1.4, bed:true, rows:[
    [-2.30,.36,.86,.90,.84,.80,.02],[-2.24,.30,.90,.95,.86,.83,.02],[-1.90,.26,.91,.955,.87,.84,.02],[-0.86,.24,.915,.955,.87,.84,.02],
    [-0.70,.23,.92,1.36,.87,.60,.04],[-0.55,.22,.92,1.41,.87,.62,.05],[0.14,.21,.92,1.41,.87,.62,.05],[0.55,.20,.915,1.14,.87,.74,.04],
    [0.86,.20,.905,.985,.865,.81,.03],[1.40,.21,.89,.95,.86,.82,.03],[1.95,.24,.82,.855,.85,.80,.02],[2.16,.30,.72,.74,.82,.76,.02]]}
};
/* a forward-facing compressor inlet (turbo / centrifugal through the grille) */
function sc_bell(B, x, y, z, r){
  B.add("chrome", new THREE.CylinderGeometry(r, r*0.82, 0.16, 16, 1, true), sc_M(x, y, z, 0,0,-PI/2));
  B.add("chrome", new THREE.TorusGeometry(r*1.02, r*0.12, 6, 18), sc_M(x+0.08, y, z, 0,PI/2,0));
  B.add("well", new THREE.CircleGeometry(r*0.9, 14), sc_M(x+0.02, y, z, 0,PI/2,0));
}
/* front-mount intercooler in the lower grille */
function sc_ic(B, x, y, w, h){
  B.add("alu", sc_rbox(0.05, h, w, 0.008), sc_M(x+0.02, y, 0));
  B.add("satin", sc_rbox(0.03, h*0.92, w*0.11, 0.008), sc_M(x+0.035, y, w*0.47));
  B.add("satin", sc_rbox(0.03, h*0.92, w*0.11, 0.008), sc_M(x+0.035, y, -w*0.47));
  for(var i=0;i<3;i++) B.add("black", sc_rbox(0.012, 0.006, w*0.8, 0.002), sc_M(x+0.047, y-h*0.3+i*h*0.3, 0));
}

/* --- body packs (cached geometry per body + tyre) --------------------------- */
function sc_pack(body, tIn, H){
  var key=body+"|"+tIn+(H?"|"+H.key:""); if(SC.geo[key]) return SC.geo[key];
  var rr=tIn*0.0254/2, B=sc_bin(), me, res={parts:{}, decals:[], tail:null, head:null};
  var tails=[], heads=[]; SC.lite=!!(H && H.lite);
  if(body==="rail") me=H?sc_tfrail(B, rr, tails, heads, res, H):sc_rail(B, rr, tails, heads, res, H);
  else if(body==="funny") me=sc_funny(B, rr, tails, heads, res, H||sc_hw({asp:"blower"}, "funny"));
  else me=sc_door(B, body, rr, tails, heads, res, H, tIn);
  if(body!=="rail") sc_skirt(B, me);   /* fix pack: side skirts under the sill (strip-ground.js) */
  SC.lite=false;
  if(H && H.lite) [B, res.flipB].forEach(sc_liteBins);   /* v3: Lite folds the extra trim materials into their base ones (no extra draw calls) */
  for(var k in B) if(k!=="add" && B[k].length) res.parts[k]=sc_merge(B[k]);
  if(res.flipB){ res.flip={}; for(k in res.flipB) if(k!=="add" && res.flipB[k].length) res.flip[k]=sc_merge(res.flipB[k]); delete res.flipB; }
  if(tails.length) res.tail=sc_merge(tails);
  if(heads.length) res.head=sc_merge(heads);
  res.meta=me; SC.geo[key]=res; return res;
}
function sc_decal(res, g, kind){ res.decals.push({g:g, kind:kind||"door"}); }

/* v2 hood by aspiration: blower through the hood; NA street = cowl induction, outlaw = scoop, promod = tall scoop;
   boosted = a low bulge (street / outlaw) or a flat carbon hood (promod: the turbos show in the grille) */
function sc_hoodKind(H, body){
  if(!H) return body==="outlaw"?"scoop":body==="promod"?"blower":"none";
  if(body==="prostock") return H.asp==="na"?"pstock":H.asp==="blower"?"blower":"none";   /* v3: the pro stock's tall hood scoop */
  if(body==="gasser") return H.asp==="na"?"stacks":H.asp==="blower"?"blower":"bulge";      /* v3: injector stacks through the hood */
  if(H.asp==="blower") return "blower";
  if(H.asp==="na") return body==="street"?"cowl":body==="outlaw"?"scoop":"tall";
  return body==="promod"?"none":"bulge";
}
function sc_doorHw(B, D, H, kind, body, hx, hood, slope, cowl, cF, gates){
  var P={}, st=body==="street", pm=body==="promod", hat=null, i;
  if(kind==="blower"){
    B.add("alu", sc_rbox(0.62,0.2,0.34,0.03), sc_M(hx, hood+0.06, 0));
    B.add("satin", sc_rbox(0.66,0.04,0.38,0.012), sc_M(hx, hood+0.17, 0));
    B.add("black", sc_rbox(0.5,0.03,0.4,0.01), sc_M(hx, hood-0.02, 0));
    for(i=0;i<5;i++) B.add("satin", sc_rbox(0.012,0.12,0.36,0.004), sc_M(hx-0.24+i*0.12, hood+0.07, 0));   /* case ribs */
    B.add(pm?"carbon":"alu", sc_prof([[0.2,0],[0.24,0.26],[0.08,0.3],[-0.22,0.24],[-0.22,0]], 0.3, 0.015), sc_M(hx+0.02, hood+0.19, 0));
    B.add("well", sc_rbox(0.02,0.18,0.22,0.01), sc_M(hx+0.235, hood+0.33, 0, 0,0,0.15));
    hat=new THREE.Vector3(hx+0.05, hood+0.5, 0);
  } else if(kind==="scoop"){
    B.add("paint", sc_prof([[0.45,0],[0.3,0.07],[0.0,0.12],[-0.42,0.13],[-0.5,0.02],[-0.5,0]], 0.66, 0.02), sc_M(hx, hood-0.01, 0, 0,0,slope));
    B.add("well", sc_rbox(0.02,0.09,0.54,0.01), sc_M(hx-0.515, hood+0.065, 0, 0,0,slope));
  } else if(kind==="tall"){
    B.add("carbon", sc_prof([[0.34,0],[0.26,0.3],[-0.12,0.33],[-0.36,0.05],[-0.36,0]], 0.34, 0.02), sc_M(hx, hood-0.01, 0));
    B.add("well", sc_rbox(0.02,0.16,0.26,0.01), sc_M(hx+0.3, hood+0.2, 0, 0,0,0.27));
    hat=new THREE.Vector3(hx+0.2, hood+0.38, 0);
  } else if(kind==="pstock" || kind==="stacks"){
    hat=sc_hoodX(B, D, kind, hx, hood, slope, cowl);
  } else if(kind==="cowl" || kind==="bulge"){
    var cx=cowl+(kind==="cowl"?0.42:0.5); sc_params(D, cx, P); var cy=P.yt, hgt=kind==="cowl"?0.075:0.05;
    B.add("paint", sc_prof([[0.5,0],[0.25,hgt*0.8],[-0.25,hgt],[-0.38,hgt*0.9],[-0.4,0]], kind==="cowl"?0.56:0.74, 0.02), sc_M(cx, cy-0.012, 0, 0,0,slope*0.5));
    if(kind==="cowl") B.add("well", sc_rbox(0.015,hgt*0.7,0.46,0.006), sc_M(cx-0.395, cy+hgt*0.45, 0, 0,0,slope*0.5));
  }
  if(H.ic){ var icy=lerp(cF.zb,cF.ys,pm?0.42:0.36); sc_ic(B, cF.x, icy, pm?0.62:0.52, pm?0.13:0.15); }
  if(!st && (H.turbo || H.asp==="centri")){   /* outlaw / promod: the compressor inlets stick out through the grille */
    var by=lerp(cF.zb,cF.ys,0.66), n=H.asp==="twin"?2:1;
    for(i=0;i<n;i++) sc_bell(B, cF.x+0.04, by, n>1?(i?0.22:-0.22):0.2, pm?0.1:0.09);
  }
  if(H.turbo){   /* wastegate dumps (screamer pipes) poke up through the hood: the flutter puffs come out of these */
    var gx=cowl+0.3; sc_params(D, gx, P);
    (H.asp==="twin"?[-1,1]:[1]).forEach(function(sd){ var z=sd*Math.min(0.36, P.wt*0.55), a=new THREE.Vector3(gx, P.yt-0.04, z), b=new THREE.Vector3(gx-0.05, P.yt+0.13, z+sd*0.02);
      B.add("chrome", sc_cyl(0.03,10), sc_rodM(a,b)); B.add("well", new THREE.CircleGeometry(0.026,10), sc_M(b.x, b.y+0.001, b.z, -PI/2,0,0));
      gates.push({p:b.clone(), d:new THREE.Vector3(-0.25,1,0).normalize()}); });
  }
  return {hat:hat};
}
/* door cars: street (90s coupe), outlaw (radial car), promod */
function sc_door(B, body, rr, tails, heads, res, H, tIn){
  var I=new THREE.Matrix4(), gs=body==="gasser", ps=body==="prostock", st=body==="street"||gs, ol=body==="outlaw", pm=body==="promod"||ps;
  var SY=H?sc_shell(body, H.style):null;   /* v2: the rival's (or your) shell; null = the v1.5 car (v3: every class has shells, pm "modern" = null) */
  var rr0=SY&&SY.rr0?SY.rr0:st?0.343:ol?0.381:0.419, lift=(rr-rr0)*0.7;
  var fr=SY&&SY.fr?(SY.fr<0?rr:SY.fr):st?clamp(rr*0.94,0.3,0.335):0.335, xr=SY?SY.xr:pm?-1.34:-1.28, xf=SY?SY.xf:pm?1.40:1.27, rows;
  /* v2 tyre-size cue: the rear tyre gets wider with its height, and a fat tyre on a street car gets flared tubs */
  var rwH=H?(st?clamp(0.2+(tIn-24)*0.025,0.2,0.37):ol?clamp(0.28+(tIn-28)*0.025,0.28,0.42):clamp(0.36+(tIn-31)*0.025,0.36,0.46)):0;
  if(SY && SY.rows) rows=SY.rows.map(function(r){ return r.slice(); });
  else if(pm) rows=[
    [-2.42,.36,.84,.90,.86,.82,.02],[-2.32,.28,.95,1.0,.94,.88,.02],[-1.95,.22,.985,1.03,.97,.90,.03],[-1.50,.20,.975,1.07,.97,.78,.05],
    [-0.90,.19,.935,1.19,.965,.665,.05],[-0.20,.19,.91,1.215,.96,.645,.05],[0.22,.185,.90,1.12,.958,.72,.05],[0.64,.18,.885,.945,.955,.84,.04],
    [1.10,.17,.87,.915,.95,.87,.03],[1.80,.16,.80,.84,.94,.86,.03],[2.30,.165,.68,.72,.90,.82,.02],[2.52,.19,.56,.59,.80,.72,.02]];
  else rows=[
    [-2.28,.34,.80,.85,.82,.78,.02],[-2.20,.27,.88,.94,.875,.83,.02],[-1.95,.22,.90,.97,.895,.84,.03],[-1.55,.20,.91,1.02,.90,.78,.04],
    [-1.05,.19,.915,1.17,.905,.69,.05],[-0.50,.19,.92,1.305,.905,.645,.05],[0.18,.19,.92,1.315,.905,.64,.05],[0.62,.19,.915,1.12,.905,.73,.05],
    [0.98,.19,.905,.97,.90,.81,.04],[1.40,.20,.875,.93,.895,.835,.03],[1.95,.22,.78,.82,.88,.82,.03],[2.18,.26,.67,.70,.835,.78,.02],[2.29,.32,.59,.61,.77,.71,.02]];
  if(ol) rows.forEach(function(r){ if(r[3]>1.1) r[3]-=0.055*clamp((r[3]-1.1)/0.2,0,1); });   /* chopped roof */
  var xR=rows[0][0], xF=rows[rows.length-1][0];
  var gapR=SY&&SY.gapR?SY.gapR:pm?0.045:0.05, gapF=0.05;
  var flares=[]; if(!st) flares.push({x:xr, span:pm?0.75:0.6, amt:pm?0.035:0.025, up:0.03});
  if(H && st && rwH>0.285) flares.push({x:xr, span:0.62, amt:(rwH-0.26)*0.75, up:0.025});
  if(SY && SY.flares) flares=flares.concat(SY.flares);
  if(SY && SY.gapF) gapF=SY.gapF;
  var rake=SY&&SY.rake!=null?SY.rake:ol?-0.012:pm?-0.006:0;
  var D=sc_def(rows, {arches:[{x:xr, y:rr, R:rr+gapR},{x:xf, y:fr, R:fr+gapF}], rake:rake, rakeX:xr, lift:lift+(ol?0.02:0)+(SY&&SY.lift||0), flares:flares, sub:(H && !H.lite)?3:2});
  var L=sc_loft(D);
  B.add("paint", L.paint); B.add("well", L.well);
  var P={}, R=new Float32Array(40), v=new THREE.Vector3();
  /* glass: windshield, backlight, door + quarter glass both sides */
  var roofF=SY?SY.roofF:pm?-0.2:0.18, cowl=SY?SY.cowl:pm?0.64:0.98, roofR=SY?SY.roofR:pm?-0.9:-0.5, deck=SY?SY.deck:pm?-1.5:-1.62;
  B.add("glass", sc_patch(D, roofF+0.03, cowl-0.03, 8.28, 11.72, 0.006));
  if(roofR-deck>0.1) B.add("glass", sc_patch(D, deck+0.06, roofR-0.03, 8.28, 11.72, 0.006));
  var dG0=SY?SY.dG0:pm?-0.62:-0.52, dG1=cowl-0.06, qG0=SY?SY.qG0:pm?-1.05:-1.12, qG1=dG0-0.07;
  [[dG0,dG1],[qG0,qG1]].forEach(function(r){ if(r[0]==null) return; B.add("glass", sc_patch(D, r[0], r[1], 5.42, 7.7, 0.006)); B.add("glass", sc_patch(D, r[0], r[1], 12.3, 14.58, 0.006, "L")); });
  /* door shut lines */
  [dG1+0.02, dG0-0.1].concat(SY&&SY.seams||[]).forEach(function(x){ B.add("seam", sc_patch(D, x, x+0.009, 1.6, 5.2, 0.002)); B.add("seam", sc_patch(D, x, x+0.009, 14.8, 18.4, 0.002)); });
  /* door decals + windshield banner */
  var dx0=SY&&SY.door?SY.door[0]:pm?-0.5:-0.42, dx1=SY&&SY.door?SY.door[1]:pm?0.5:0.58;
  sc_decal(res, sc_patch(D, dx0, dx1, 2.3, 4.75, 0.004, null, 0.5)); sc_decal(res, sc_patch(D, dx0, dx1, 15.25, 17.7, 0.004, "L", 0.5));
  sc_decal(res, sc_patch(D, roofF+0.02, roofF+0.17, 8.3, 11.7, 0.009, "K", 0.5), "banner");
  var hoodK=sc_hoodKind(H, body);   /* v2: what sits on the hood (scoop, blower, cowl...) */
  var hdF=rows[rows.length-1][0];
  res.hood=SY&&SY.hood?sc_patch(D, SY.hood[0], SY.hood[1], 8.45, 11.55, 0.012, "K", 0.5):pm?sc_patch(D, 1.45, 2.12, 8.45, 11.55, 0.012, "K", 0.5):(ol||(H && st && hoodK!=="none"))?sc_patch(D, hdF-0.5, hdF-0.1, 8.5, 11.5, 0.012, "K", 0.5):sc_patch(D, cowl+0.12, cowl+0.68, 8.45, 11.55, 0.012, "K", 0.5);
  if(SY && SY.bed) B.add("well", sc_patch(D, rows[0][0]+0.12, deck-0.1, 8.3, 11.7, 0.004));   /* pickup bed */   /* primary sponsor on the hood, clear of the outlaw scoop / promod blower (hidden until there is one) */
  if(pm && !(SY && SY.noCarbonHood)) B.add("carbon", sc_patch(D, cowl+0.02, hdF-0.24, 7.4, 12.6, 0.003));
  /* front + rear caps: lamps, grille, bumpers (v3: a shell with its own fascia, bumpers and mirrors dresses itself) */
  var cF=L.capF, cR=L.capR, hy=lerp(cF.zb,cF.ys,0.72), ly=lerp(cF.zb,cF.ys,0.3);
  if(SY && SY.dress) SY.dress({B:B, D:D, cF:cF, cR:cR, tails:tails, heads:heads, H:H, body:body, cowl:cowl, xR:xR, xF:xF, xr:xr, xf:xf, rr:rr, fr:fr, SY:SY, deck:deck, roofR:roofR, roofF:roofF, dG0:dG0, qG0:qG0});
  else {
  var hl=sc_rbox(0.03, pm?0.08:0.1, pm?0.26:0.3, 0.012);
  [-1,1].forEach(function(sd){
    heads.push({g:hl, m:sc_M(cF.x, hy, sd*cF.w*0.56)});
    if(!pm) B.add("black", sc_rbox(0.03,0.05,0.12,0.01), sc_M(cF.x+0.004, hy-0.075, sd*cF.w*0.8));
  });
  B.add("black", sc_rbox(0.04, pm?0.07:0.09, cF.w*(pm?1.2:0.95), 0.02), sc_M(cF.x, ly, 0));
  if(!pm) B.add("satin", sc_rbox(0.03, 0.06, cF.w*0.5, 0.012), sc_M(cF.x+0.005, hy, 0));
  B.add(pm?"carbon":"black", sc_prof([[0,0],[0.32,0],[0.34,0.035],[0,0.05]], cF.w*2*0.98, 0.006), sc_M(cF.x-0.3, cF.zb-0.035, 0));
  var ty=lerp(cR.zb,cR.ys,0.74);
  tails.push({g:sc_rbox(0.03, 0.11, cR.w*(st?1.85:0.55), 0.015), m:sc_M(cR.x-0.004, ty, 0)});
  if(!st) [-1,1].forEach(function(sd){ tails.push({g:sc_rbox(0.03,0.09,0.36,0.015), m:sc_M(cR.x-0.004, ty, sd*cR.w*0.68)}); });
  B.add("black", sc_rbox(0.05, 0.12, cR.w*1.9, 0.025), sc_M(cR.x+0.01, lerp(cR.zb,cR.ys,0.22), 0));
  /* mirrors */
  sc_params(D, cowl-0.04, P);
  [-1,1].forEach(function(sd){
    B.add("paint", sc_prof([[0.07,0.01],[0.0,-0.01],[-0.06,0.0],[-0.065,0.075],[0.0,0.085],[0.06,0.06]], 0.13, 0.012), sc_M(cowl-0.05, P.ys+0.06, sd*(P.w+0.1)));
    B.add("glass", sc_rbox(0.008,0.06,0.1,0.003), sc_M(cowl-0.117, P.ys+0.097, sd*(P.w+0.1)));
    B.add("black", sc_rbox(0.05,0.025,0.1,0.008), sc_M(cowl-0.03, P.ys+0.045, sd*(P.w+0.04)));
  });
  }
  /* inner wheel-well liners (stop see-through under the arches) */
  [[xr,rr+gapR,rr],[xf,fr+gapF,fr]].forEach(function(a){ var s=new THREE.Shape(); s.absarc(0,0,a[1],0,PI,false); s.lineTo(-a[1],0);
    var lg=new THREE.ShapeGeometry(s,8); [-1,1].forEach(function(sd){ B.add("well", lg, sc_M(a[0], a[2], sd*0.36, 0, sd>0?0:PI, 0)); }); });
  /* wheels */
  var rw=H?rwH:st?0.26:ol?0.34:0.43, fw=SY&&SY.fw?(SY.fw<0?rw:SY.fw):st?0.225:0.115;
  sc_params(D, xr, P); var zr=P.w-(st?0.015:0.05)-rw/2; sc_params(D, xf, P); var zf=SY&&SY.fz!=null?P.w-SY.fz-fw/2:st?P.w-0.02-fw/2:P.w-0.11-fw/2;
  var wh=[], brk=!!(H && !H.lite);
  [-1,1].forEach(function(sd){
    wh.push({x:xr, z:sd*zr, r:rr, w:rw, rimR:pm?0.205:0.19, style:SY&&SY.rimR?SY.rimR:st?"star":pm?"bead":"weld", rimMat:SY&&SY.rimMat?SY.rimMat:pm?"rimBlack":"alu", rear:true, letters:true, brake:brk});
    wh.push({x:xf, z:sd*zf, r:fr, w:fw, rimR:0.19, style:SY&&SY.rimF?SY.rimF:st?"star":"weld", rimMat:SY&&SY.rimMat?SY.rimMat:pm?"rimBlack":"alu", rear:false, letters:SY&&SY.lettersF!=null?SY.lettersF:st, brake:brk});
  });
  if(brk) sc_calipers(B, wh);
  if(SY && SY.chassis) SY.chassis({B:B, D:D, H:H, xr:xr, xf:xf, rr:rr, fr:fr, zf:zf, zr:zr, fw:fw, rw:rw, cF:cF, cR:cR});
  /* hood: outlaw scoop, promod blower + injector hat */
  var hx=SY?SY.hx:pm?1.05:1.3; sc_params(D, hx, P); var hood=P.yt;
  sc_params(D, hx+0.35, P); var slope=Math.atan2(P.yt-hood, 0.35);
  var gates=[], hat=null;
  if(H){ var hwr=sc_doorHw(B, D, H, hoodK, body, hx, hood, slope, cowl, L.capF, gates); hat=hwr.hat; }
  else if(ol){
    B.add("paint", sc_prof([[0.45,0],[0.3,0.07],[0.0,0.12],[-0.42,0.13],[-0.5,0.02],[-0.5,0]], 0.66, 0.02), sc_M(hx, hood-0.01, 0, 0,0,slope));
    B.add("well", sc_rbox(0.02,0.09,0.54,0.01), sc_M(hx-0.515, hood+0.065, 0, 0,0,slope));
  }
  if(pm && !H){
    B.add("alu", sc_rbox(0.62,0.2,0.34,0.03), sc_M(hx, hood+0.06, 0));
    B.add("satin", sc_rbox(0.66,0.04,0.38,0.012), sc_M(hx, hood+0.17, 0));
    B.add("carbon", sc_prof([[0.2,0],[0.24,0.26],[0.08,0.3],[-0.22,0.24],[-0.22,0]], 0.3, 0.015), sc_M(hx+0.02, hood+0.19, 0));
    B.add("well", sc_rbox(0.02,0.18,0.22,0.01), sc_M(hx+0.235, hood+0.33, 0, 0,0,0.15));
  }
  /* rear: spoiler (street/outlaw) or big wing (promod) */
  sc_params(D, xR+0.2, P); var dk=P.yt;
  if(SY && SY.rear) SY.rear({B:B, D:D, xR:xR, dk:dk, tails:tails, H:H, body:body, roofR:roofR});   /* v3: the shell's own spoiler / wing / nothing */
  else if(SY && SY.bed){}   /* pickup: no deck spoiler */
  else if(!pm){
    B.add("paint", sc_foil(0.24, 0.06, 1.5), sc_M(xR+0.14, dk+0.1, 0, 0,0,-0.08));
    [-0.6,0.6].forEach(function(z){ B.add("paint", sc_rbox(0.12,0.1,0.05,0.015), sc_M(xR+0.16, dk+0.045, z)); });
    tails.push({g:sc_rbox(0.03,0.025,0.34,0.008), m:sc_M(xR+0.02, dk+0.105, 0)});
  } else {
    var wy=SY&&SY.wingY?SY.wingY:1.46, wx=xR+0.22;
    B.add("carbon", sc_foil(0.54, 0.12, 1.78), sc_M(wx, wy, 0, 0,0,-0.24));
    B.add("carbon", sc_rbox(0.03,0.06,1.78,0.006), sc_M(wx-0.27, wy+0.09, 0));
    [-1,1].forEach(function(sd){
      B.add("carbon", sc_prof([[0.32,-0.14],[0.34,0.12],[-0.36,0.2],[-0.38,-0.14]], 0.014, 0.003), sc_M(wx, wy, sd*0.9));
      B.add("tube", sc_cyl(0.02,8), sc_rodM(new THREE.Vector3(wx-0.02, dk-0.02, sd*0.42), new THREE.Vector3(wx+0.03, wy-0.06, sd*0.42)));
      B.add("tube", sc_cyl(0.012,6), sc_rodM(new THREE.Vector3(wx-0.28, dk-0.02, sd*0.42), new THREE.Vector3(wx+0.02, wy-0.05, sd*0.42)));
    });
  }
  /* exhaust */
  var tips=[], dirs=[];
  if(SY && SY.exhaust) SY.exhaust({B:B, D:D, H:H, tips:tips, dirs:dirs, xR:xR, xf:xf, cR:cR, deck:deck, body:body});
  else if(H && H.diesel && SY && SY.bed){
    [-1,1].forEach(function(sd){ var x0=deck+0.02, z0=sd*0.62, y1=1.84;
      B.add("chrome", sc_cyl(0.06,12), sc_rodM(new THREE.Vector3(x0, 0.86, z0), new THREE.Vector3(x0, y1, z0)));
      B.add("well", new THREE.CircleGeometry(0.055,12), sc_M(x0, y1+0.002, z0, -PI/2,0,0));
      tips.push(new THREE.Vector3(x0, y1+0.02, z0)); dirs.push(new THREE.Vector3(-0.15,1,0).normalize()); });
  } else if(H && H.diesel && st){
    var pD=new THREE.Vector3(xR-0.04, cR.zb-0.04, 0.5);
    B.add("chrome", new THREE.CylinderGeometry(0.065,0.065,0.24,14,1,true), sc_M(pD.x+0.1, pD.y, pD.z, 0,0,PI/2));
    B.add("well", new THREE.CircleGeometry(0.06,14), sc_M(pD.x+0.03, pD.y, pD.z, 0,-PI/2,0));
    tips.push(pD); dirs.push(new THREE.Vector3(-1,-0.08,0).normalize());
  } else if(st){
    [-1,1].forEach(function(sd){ var p=new THREE.Vector3(xR-0.04, cR.zb-0.06, sd*0.52);
      B.add("chrome", new THREE.CylinderGeometry(0.045,0.045,0.22,12,1,true), sc_M(p.x+0.1, p.y, p.z, 0,0,PI/2));
      B.add("well", new THREE.CircleGeometry(0.04,12), sc_M(p.x+0.03, p.y, p.z, 0,-PI/2,0));
      tips.push(p); dirs.push(new THREE.Vector3(-1,0,0)); });
  } else {
    var nP=pm?4:2, ex0=pm?0.66:0.62;
    [-1,1].forEach(function(sd){
      sc_params(D, ex0, P);
      for(var i=0;i<nP;i++){
        var x0=ex0+i*(pm?0.075:0.1), y0=pm?0.5:0.42, a=new THREE.Vector3(x0+0.06, y0, sd*(P.w-0.1)), b=new THREE.Vector3(x0+0.02, y0+0.03, sd*(P.w+0.05));
        var c=pm?new THREE.Vector3(x0-0.16, y0+0.2+i*0.012, sd*(P.w+0.16)):new THREE.Vector3(x0-0.12, y0-0.06, sd*(P.w+0.13));
        B.add("alu", TUBE([a,b,c], pm?0.028:0.034, 5, 6));
        if(pm?(i===1||i===2):true){ tips.push(c.clone()); dirs.push(c.clone().sub(b).normalize()); }
      }
    });
  }
  /* wheelie bars + chute pack */
  var bars=!st, anchor, maxP=gs?deg(14):st?deg(12):ol?deg(5):deg(4);
  if(bars){
    var bx0=xR+0.1, bx1=xR-(pm?1.55:1.35), br=0.065;
    var dxB=bx1-xr, cy=(br-rr-dxB*Math.sin(maxP))/Math.cos(maxP)+rr;
    [-1,1].forEach(function(sd){
      var a=new THREE.Vector3(bx0, 0.3, sd*0.36), b=new THREE.Vector3(bx1, cy, sd*0.3);
      B.add("tube", sc_cyl(0.022,8), sc_rodM(a,b));
      B.add("tube", sc_cyl(0.014,6), sc_rodM(new THREE.Vector3(bx0, 0.46, sd*0.36), b));
      B.add("rubber", new THREE.CylinderGeometry(br,br,0.045,14), sc_M(bx1, cy, sd*0.3, PI/2,0,0));
      B.add("alu", new THREE.CylinderGeometry(br*0.55,br*0.55,0.05,10), sc_M(bx1, cy, sd*0.3, PI/2,0,0));
    });
    B.add("tube", sc_cyl(0.018,8), sc_rodM(new THREE.Vector3(bx1+0.05, cy, -0.3), new THREE.Vector3(bx1+0.05, cy, 0.3)));
    B.add("tube", sc_cyl(0.018,8), sc_rodM(new THREE.Vector3(lerp(bx0,bx1,0.5), lerp(0.3,cy,0.5), -0.33), new THREE.Vector3(lerp(bx0,bx1,0.5), lerp(0.3,cy,0.5), 0.33)));
    var py=lerp(cR.zb,cR.ys,0.45);
    B.add("bag", sc_rbox(0.2, 0.26, 0.4, 0.05), sc_M(xR-0.09, py, 0));
    B.add("satin", sc_rbox(0.05, 0.3, 0.44, 0.012), sc_M(xR+0.0, py, 0));
    B.add("paint", sc_rbox(0.03, 0.2, 0.3, 0.012), sc_M(xR-0.2, py, 0));
    anchor=new THREE.Vector3(xR-0.2, py, 0);
  } else anchor=new THREE.Vector3(xR-0.05, cR.zb+0.05, 0);
  return { rr:rr, fr:fr, xr:xr, xf:xf, wheels:wh, tips:tips, dirs:dirs, anchor:anchor, bars:bars, maxPitch:maxP, gates:gates, hat:hat,
    squat:st?deg(1.6):deg(0.7), squatDrop:st?0.035:0.015, shiftKick:st?0.22:0.12, pitchW:st?6.5:8.5, droop:st?0.07:0.04, wrinkle:st?0.55:1,
    chuteLen:pm?5.2:4.4, chuteRise:pm?0.45:0.35, chuteR:pm?0.95:0.8, flames:SY&&SY.flames?tips.map(function(t,i){ return {p:t.clone(), d:dirs[i].clone()}; }):null,
    headers:SY&&(SY.flames||ps)?tips.map(function(t,i){ return {p:t.clone(), d:dirs[i].clone()}; }):undefined };   /* v3: night header flames (dragfx) for gassers + pro stock */
}

/* rear-engine dragster */
function sc_rail(B, rr, tails, heads, res, H){
  var xr=-2.7, xf=3.3, fr=0.29, V=function(x,y,z){ return new THREE.Vector3(x,y,z); };
  var D=sc_def([
    [-1.40,.17,.46,.58,.30,.27,.03],[-0.95,.16,.48,.60,.30,.25,.04],[-0.45,.15,.48,.63,.29,.24,.05],[0.30,.15,.42,.52,.24,.2,.04],
    [1.30,.15,.36,.44,.19,.16,.03],[2.60,.16,.31,.37,.14,.12,.03],[3.70,.17,.26,.30,.10,.085,.02],[4.02,.2,.23,.25,.05,.04,.01]], {sub:3});
  var L=sc_loft(D); B.add("paint", L.paint); B.add("well", L.well);
  sc_decal(res, sc_patch(D, -0.1, 0.6, 2.3, 5.4, 0.004, null, 0.5)); sc_decal(res, sc_patch(D, -0.1, 0.6, 14.6, 17.7, 0.004, "L", 0.5));
  res.hood=sc_patch(D, 1.45, 2.65, 8.4, 11.6, 0.008, null, 0.5);
  /* cockpit opening (dark) + driver */
  B.add("well", sc_patch(D, -1.33, -0.55, 8.6, 11.4, 0.004, null, 0.5));
  B.add("paint", new THREE.SphereGeometry(0.155, 16, 12), sc_M(-1.02, 0.86, 0));
  B.add("visor", new THREE.SphereGeometry(0.157, 12, 8, -0.9, 1.8, 1.2, 0.7), sc_M(-1.02, 0.86, 0, 0, PI, 0));
  B.add("satin", new THREE.CylinderGeometry(0.2, 0.26, 0.28, 12), sc_M(-1.08, 0.62, 0));
  /* roll cage */
  [-1,1].forEach(function(sd){
    B.add("tube", sc_cyl(0.022,8), sc_rodM(V(-1.3,0.5,sd*0.26), V(-1.22,1.1,sd*0.2)));
    B.add("tube", sc_cyl(0.02,8), sc_rodM(V(-1.22,1.1,sd*0.2), V(-0.62,0.62,sd*0.25)));
    B.add("tube", sc_cyl(0.018,8), sc_rodM(V(-1.22,1.1,sd*0.2), V(-1.55,0.62,sd*0.26)));
  });
  B.add("tube", sc_cyl(0.022,8), sc_rodM(V(-1.22,1.1,-0.2), V(-1.22,1.1,0.2)));
  /* chromoly chassis behind the body */
  [-1,1].forEach(function(sd){
    B.add("tube", sc_cyl(0.026,8), sc_rodM(V(-1.35,0.2,sd*0.29), V(-2.98,0.24,sd*0.27)));
    B.add("tube", sc_cyl(0.022,8), sc_rodM(V(-1.35,0.55,sd*0.29), V(-2.95,0.56,sd*0.25)));
    B.add("tube", sc_cyl(0.018,6), sc_rodM(V(-2.0,0.21,sd*0.28), V(-2.5,0.56,sd*0.26)));
    B.add("tube", sc_cyl(0.018,6), sc_rodM(V(-2.98,0.24,sd*0.27), V(-2.95,0.56,sd*0.25)));
  });
  B.add("satin", sc_cyl(0.06,12), sc_rodM(V(xr,rr,-0.42), V(xr,rr,0.42)));
  B.add("satin", sc_rbox(0.34,0.3,0.34,0.05), sc_M(xr, rr, 0));
  B.add("tube", sc_cyl(0.028,8), sc_rodM(V(xf,fr,-0.52), V(xf,fr,0.52)));
  /* engine behind the driver */
  var ex=-1.95;
  B.add("engine", sc_rbox(0.78,0.42,0.4,0.03), sc_M(ex, 0.5, 0));
  [-1,1].forEach(function(sd){ B.add("alu", sc_rbox(0.74,0.1,0.2,0.03), sc_M(ex, 0.78, sd*0.2, sd*-0.55,0,0)); B.add("engine", sc_rbox(0.76,0.2,0.16,0.02), sc_M(ex, 0.66, sd*0.19, sd*-0.55,0,0)); });
  var gates=[], hat=null, ra=H?H.asp:"blower";
  if(ra==="blower"){
  B.add("alu", sc_rbox(0.66,0.22,0.3,0.035), sc_M(ex, 0.93, 0));
  B.add("satin", sc_rbox(0.7,0.04,0.34,0.012), sc_M(ex, 1.05, 0));
  B.add("paint", sc_prof([[0.18,0],[0.22,0.28],[0.06,0.32],[-0.2,0.25],[-0.2,0]], 0.3, 0.015), sc_M(ex+0.05, 1.06, 0));
  B.add("well", sc_rbox(0.02,0.2,0.22,0.01), sc_M(ex+0.265, 1.21, 0, 0,0,0.15));
  hat=V(ex+0.08, 1.38, 0);
  } else if(ra==="na"){   /* v2: injector hat straight on the intake, no blower case */
    B.add("satin", sc_rbox(0.6,0.06,0.3,0.012), sc_M(ex, 0.85, 0));
    B.add("paint", sc_prof([[0.18,0],[0.22,0.28],[0.06,0.32],[-0.2,0.25],[-0.2,0]], 0.3, 0.015), sc_M(ex+0.05, 0.87, 0));
    B.add("well", sc_rbox(0.02,0.2,0.22,0.01), sc_M(ex+0.265, 1.02, 0, 0,0,0.15));
    hat=V(ex+0.08, 1.2, 0);
  } else {   /* v2: turbos hung off the headers, inlets forward, wastegates up */
    B.add("satin", sc_rbox(0.6,0.06,0.3,0.012), sc_M(ex, 0.85, 0));
    (ra==="twin"||ra==="turbo"?[-1,1]:[1]).forEach(function(sd){
      B.add("alu", new THREE.CylinderGeometry(0.15,0.15,0.13,16), sc_M(ex+0.12, 0.98, sd*0.36, PI/2,0,0));
      B.add("barrel", new THREE.TorusGeometry(0.15,0.035,6,16), sc_M(ex+0.12, 0.98, sd*0.36));
      sc_bell(B, ex+0.3, 0.98, sd*0.36, 0.085);
      if(ra!=="centri"){ var a=V(ex-0.12, 0.9, sd*0.34), b=V(ex-0.2, 1.22, sd*0.38); B.add("chrome", sc_cyl(0.028,10), sc_rodM(a,b)); gates.push({p:b.clone(), d:V(-0.3,1,sd*0.1).normalize()}); }
    });
  }
  /* zoomie headers, up and back */
  var tips=[], dirs=[];
  [-1,1].forEach(function(sd){ for(var i=0;i<4;i++){
    var x0=ex+0.27-i*0.18, a=V(x0,0.66,sd*0.3), b=V(x0-0.02,0.74,sd*0.44), c=V(x0-0.26,1.08,sd*0.52);
    B.add("alu", TUBE([a,b,c], 0.026, 5, 6));
    if(i===1||i===2){ tips.push(c.clone()); dirs.push(c.clone().sub(b).normalize()); }
  } });
  /* rear wing + front wing */
  var wx=-3.12, wy=1.62;
  B.add("paint", sc_foil(0.62, 0.12, 1.36), sc_M(wx, wy, 0, 0,0,-0.3));
  [-1,1].forEach(function(sd){
    B.add("carbon", sc_prof([[0.36,-0.2],[0.38,0.14],[-0.4,0.26],[-0.42,-0.2]], 0.014, 0.003), sc_M(wx, wy, sd*0.69));
    B.add("tube", sc_cyl(0.022,8), sc_rodM(V(-2.95,0.56,sd*0.25), V(wx+0.05,wy-0.08,sd*0.3)));
    B.add("tube", sc_cyl(0.016,6), sc_rodM(V(-2.6,0.56,sd*0.26), V(wx+0.1,wy-0.06,sd*0.3)));
  });
  B.add("paint", sc_foil(0.26, 0.1, 0.96), sc_M(4.0, 0.36, 0, 0,0,-0.12));
  [-1,1].forEach(function(sd){ B.add("carbon", sc_prof([[0.16,-0.08],[0.16,0.08],[-0.16,0.1],[-0.16,-0.08]], 0.01, 0.002), sc_M(4.0, 0.36, sd*0.48)); B.add("tube", sc_cyl(0.012,6), sc_rodM(V(3.92,0.25,sd*0.06), V(3.97,0.33,sd*0.3))); });
  /* wheelie bars, chute pack, brake light */
  var maxP=deg(4), bx0=-2.95, bx1=-4.55, br=0.06, dxB=bx1-xr, cy=(br-rr-dxB*Math.sin(maxP))/Math.cos(maxP)+rr;
  [-1,1].forEach(function(sd){ var b=V(bx1,cy,sd*0.2);
    B.add("tube", sc_cyl(0.02,8), sc_rodM(V(bx0,0.24,sd*0.22), b)); B.add("tube", sc_cyl(0.013,6), sc_rodM(V(bx0,0.52,sd*0.22), b));
    B.add("rubber", new THREE.CylinderGeometry(br,br,0.04,14), sc_M(bx1,cy,sd*0.2, PI/2,0,0)); B.add("alu", new THREE.CylinderGeometry(br*0.55,br*0.55,0.045,10), sc_M(bx1,cy,sd*0.2, PI/2,0,0)); });
  B.add("tube", sc_cyl(0.016,8), sc_rodM(V(bx1+0.05,cy,-0.2), V(bx1+0.05,cy,0.2)));
  B.add("bag", sc_rbox(0.24,0.26,0.36,0.05), sc_M(-3.08, 0.44, 0));
  B.add("paint", sc_rbox(0.03,0.2,0.28,0.012), sc_M(-3.21, 0.44, 0));
  tails.push({g:sc_rbox(0.03,0.04,0.26,0.01), m:sc_M(-3.22, 0.6, 0)});
  var wh=[];
  [-1,1].forEach(function(sd){
    wh.push({x:xr, z:sd*0.6, r:rr, w:H?clamp(0.34+(rr*2/0.0254-32)*0.022,0.34,0.46):0.43, rimR:0.205, style:"bead", rimMat:"alu", rear:true, letters:true});
    wh.push({x:xf, z:sd*0.56, r:fr, w:0.075, rimR:0.215, style:"wire", rimMat:"alu", rear:false, letters:false});
  });
  return { rr:rr, fr:fr, xr:xr, xf:xf, wheels:wh, tips:tips, dirs:dirs, anchor:V(-3.23,0.44,0), bars:true, maxPitch:maxP, gates:gates, hat:hat,
    squat:deg(0.5), squatDrop:0.01, shiftKick:0.1, pitchW:9, droop:0.03, wrinkle:1, chuteLen:5.4, chuteRise:0.5, chuteR:0.9 };
}
