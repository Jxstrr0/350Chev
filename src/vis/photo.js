/* ===========================================================================
   PHOTO MODE — a free camera on whatever the 3D view is showing, lighting and backdrop presets, and a still frame out.
   ENGINE_VIS.photoStart() takes over the view (the app hides its own UI, app/photo.js): on the engine stand the orbit camera
   is free (zoom, pan, any angle) and the lights / backdrop can be swapped; on a venue (strip, pull, salt, bog, boats, road,
   hill) the venue's own director keeps following the action and the photo camera is an offset on top of it (spin, tilt,
   zoom, slide), applied only for the render call and undone after, so no event code sees it. Nothing here touches the sim.
   photoGrab(scale) renders one frame at that pixel ratio and hands back a 2D canvas copy; photoShot(w,h) is a studio-lit
   three-quarter picture of the engine alone, whatever scene is up (the build sheet's photo).
   ==========================================================================*/
var PH={ on:false, scene:"", light:"asis", back:"garage", saved:null, group:null, yaw:0, pitch:0, zoom:1, pan:{x:0,y:0}, D:0, dKey:"", exMul:1,
         rr:null, glights:null, camSave:null };
function phSceneOfCam(c){ return !c?"":c===STRIP.cam?"strip":c===PULL.cam?"pull":c===SALT.cam?"salt":c===BOG.cam?"bog":c===BOAT.cam?"boat":c===ROAD.cam?"road":c===HILL.cam?"hill":c===OVAL.cam?"oval":""; }
function phCamOf(s){ return s==="strip"?STRIP.cam:s==="pull"?PULL.cam:s==="salt"?SALT.cam:s==="bog"?BOG.cam:s==="boat"?BOAT.cam:s==="road"?ROAD.cam:s==="hill"?HILL.cam:s==="oval"?OVAL.cam:null; }
/* stand lights: [hemi sky, hemi ground, hemi i] [key colour, i, x, y, z] [fill ...] [rim ...]; venues only take the exposure multiplier */
var PH_LIGHT={
  studio:{ h:[0xffffff,0xb9bec8,0.65], k:[0xffffff,1.9,12,30,18], f:[0xe4ecff,1.5,-14,10,12], r:[0xffffff,1.3,-16,12,-20], ex:0.95, gl:0.25, vex:1.08 },
  golden:{ h:[0xffd9a8,0x3a2a1a,0.5], k:[0xffa95a,2.8,26,9,10], f:[0xff7a3a,1.6,-13,8,12], r:[0xffe0b0,1.7,-18,10,-16], ex:1.05, gl:0.3, vex:1.04 },
  night: { h:[0x3a4a78,0x07080c,0.30], k:[0x7f9bff,0.9,-8,26,10], f:[0xff7a2a,3.2,-9,7,12], r:[0x4cc0ff,2.4,-16,12,-20], ex:0.95, gl:0.12, vex:0.62 }
};
/* backdrops: the seamless-paper look (a lit floor fading into a flat colour); the garage hides and the stand stands on its own */
var PH_BACK={ grey:{bg:0x7d838a,fl:0x8f959b,em:0.15}, white:{bg:0xe0e2e5,fl:0x9a9da2,em:0.0}, black:{bg:0x060607,fl:0x16181c,em:0}, dusk:{bg:0x4b3a52,fl:0x6a5060,em:0.15} };

function phLightGet(l){ return l?{c:l.color.clone(), g:l.groundColor?l.groundColor.clone():null, i:l.intensity, p:l.position.clone()}:null; }
function phLightPut(l, s){ if(!l||!s) return; l.color.copy(s.c); if(s.g&&l.groundColor) l.groundColor.copy(s.g); l.intensity=s.i; l.position.copy(s.p); }
function phSnapStand(){
  var gl=[]; if(garageRoot) garageRoot.traverse(function(o){ if(o.isLight) gl.push([o, o.intensity]); });
  return { h:phLightGet(hemi), k:phLightGet(keyLight), f:phLightGet(fillLight), r:phLightGet(rimLight), ex:renderer.toneMappingExposure,
           bg:scene.background, fog:scene.fog?{c:scene.fog.color.clone(), n:scene.fog.near, f:scene.fog.far}:null, gv:garageRoot?garageRoot.visible:true, gl:gl };
}
function phRestoreStand(s){
  if(!s) return;
  phLightPut(hemi,s.h); phLightPut(keyLight,s.k); phLightPut(fillLight,s.f); phLightPut(rimLight,s.r);
  renderer.toneMappingExposure=s.ex; scene.background=s.bg;
  if(s.fog&&scene.fog){ scene.fog.color.copy(s.fog.c); scene.fog.near=s.fog.n; scene.fog.far=s.fog.f; }
  if(garageRoot) garageRoot.visible=s.gv;
  s.gl.forEach(function(p){ p[0].intensity=p[1]; });
  if(PH.group) PH.group.visible=false;
}
function phApplyLight(k, s){
  var P=PH_LIGHT[k];
  if(!P){ phRestoreStandLights(s); return; }
  function put(l,a,hasPos){ if(!l) return; l.color.setHex(a[0]); l.intensity=a[1]; if(hasPos) l.position.set(a[2],a[3],a[4]); }
  hemi.color.setHex(P.h[0]); hemi.groundColor.setHex(P.h[1]); hemi.intensity=P.h[2];
  put(keyLight,P.k,true); put(fillLight,P.f,true); put(rimLight,P.r,true);
  renderer.toneMappingExposure=P.ex;
  s.gl.forEach(function(p){ p[0].intensity=p[1]*P.gl; });
}
function phRestoreStandLights(s){
  phLightPut(hemi,s.h); phLightPut(keyLight,s.k); phLightPut(fillLight,s.f); phLightPut(rimLight,s.r);
  renderer.toneMappingExposure=s.ex; s.gl.forEach(function(p){ p[0].intensity=p[1]; });
}
/* a floor on its own, and in the test cell the dyno bedplate (the garage group is hidden for any backdrop but "garage"; the stand is
   not in it, api.js fitStand keeps it under the engine either way) */
function phBuildGroup(){
  var sb=!!lastOwned.sandbox;
  if(PH.group && PH.group.userData.sb===sb) return PH.group;
  if(PH.group){ disposeTree(PH.group); scene.remove(PH.group); }
  var g=new THREE.Group(), B=new Builder();
  g.userData.sb=sb;
  if(sb) buildDynoBed(B);
  B.flush(g, {}, true);
  var fl=new THREE.Mesh(new THREE.CircleGeometry(150, 48), new THREE.MeshStandardMaterial({color:0x888888, roughness:0.9, metalness:0}));
  fl.rotation.x=-PI/2; fl.receiveShadow=true; fl.name="photoFloor"; g.add(fl);
  g.visible=false; scene.add(g); PH.group=g; return g;
}
function phApplyBack(k, s){
  if(!PH_BACK[k]){
    if(garageRoot) garageRoot.visible=s.gv;
    if(PH.group) PH.group.visible=false;
    scene.background=s.bg; if(s.fog&&scene.fog){ scene.fog.color.copy(s.fog.c); scene.fog.near=s.fog.n; scene.fog.far=s.fog.f; }
    return;
  }
  var B=PH_BACK[k], g=phBuildGroup(), comp=(GFX!=="lite"&&!!composer);   /* the clear colour and the fog sit in the target's colour space: linear for the composer, raw for the screen */
  if(garageRoot) garageRoot.visible=false;
  g.visible=true;
  var fl=g.getObjectByName("photoFloor"); fl.material.color.copy(sc(B.fl)); fl.material.emissive.copy(sc(B.fl)).multiplyScalar(B.em); fl.material.needsUpdate=true;
  var c=comp?sc(B.bg):new THREE.Color(B.bg);
  scene.background=c.clone();
  if(scene.fog){ scene.fog.color.copy(c); scene.fog.near=k==="white"?55:42; scene.fog.far=k==="white"?150:120; }
}

/* ---- venue camera: an offset on the director's, applied around the render call ---- */
var _phV=new THREE.Vector3(), _phF=new THREE.Vector3(), _phT=new THREE.Vector3(), _phR=new THREE.Vector3(), _phU=new THREE.Vector3();
function phSync(){   /* the scene under the photo camera can change (a race night goes strip -> pits); follow it */
  var es=ENGINE_VIS.eventScene(), ns=(es==="pits"||es==="trophy")?"x":es;
  if(ns===PH.scene) return;
  var was=PH.scene; PH.scene=ns;
  if(ns===""&&was!==""&&PH.saved){ phApplyLight(PH.light, PH.saved); phApplyBack(PH.back, PH.saved); }
}
function phVenueRender(sc2, cam, args){
  var key=PH.scene;
  var p0=cam.position.clone(), q0=cam.quaternion.clone();
  cam.updateMatrixWorld();
  _phF.set(0,0,-1).applyQuaternion(cam.quaternion);
  if(PH.dKey!==key){   /* how far the subject is: first thing under the middle of the picture (the car), else a stock distance */
    PH.dKey=key; PH.D=12;
    try{
      var rc=new THREE.Raycaster(), hits; rc.setFromCamera({x:0,y:0}, cam);
      hits=rc.intersectObjects(sc2.children, true);
      for(var i=0;i<hits.length;i++){ var o=hits[i].object; if(!o.isMesh||o.isInstancedMesh||o.isSprite||o.isPoints) continue; if(o.material&&(o.material.side===THREE.BackSide||o.material.depthWrite===false)) continue;
        if(hits[i].distance>2.5 && hits[i].distance<70){ PH.D=hits[i].distance; break; } }
    }catch(e){}
  }
  var D=PH.D;
  _phT.copy(p0).addScaledVector(_phF, D);
  _phV.copy(p0).sub(_phT);                                   /* subject -> director camera */
  var len=_phV.length()*PH.zoom, el0=Math.asin(clamp(_phV.y/Math.max(1e-4,_phV.length()),-1,1)), az0=Math.atan2(_phV.x,_phV.z);
  var minEl=Math.asin(clamp((0.5-_phT.y)/Math.max(1,len),-1,1));   /* keep the lens above the ground */
  var el=clamp(el0+PH.pitch, Math.min(minEl,el0), 1.45), az=az0+PH.yaw, ce=Math.cos(el);
  _phV.set(len*ce*Math.sin(az), len*Math.sin(el), len*ce*Math.cos(az));
  _phR.set(Math.cos(az),0,-Math.sin(az)); _phU.set(0,1,0);   /* screen-right and up at the new heading, for the slide */
  _phT.addScaledVector(_phR, PH.pan.x).addScaledVector(_phU, PH.pan.y);
  cam.position.copy(_phT).add(_phV);
  cam.lookAt(_phT);
  var ex=renderer.toneMappingExposure; renderer.toneMappingExposure=ex*PH.exMul;
  try{ return PH.rr.apply(renderer, args); }
  finally{ renderer.toneMappingExposure=ex; cam.position.copy(p0); cam.quaternion.copy(q0); }
}
function phHook(){
  if(PH.rr) return;
  PH.rr=renderer.render;
  renderer.render=function(sc2, cam){
    if(PH.on){ var vs=phSceneOfCam(cam); if(vs){ PH.scene=vs; return phVenueRender(sc2, cam, arguments); } }
    return PH.rr.apply(this, arguments);
  };
}
function phUnhook(){ if(!PH.rr) return; renderer.render=PH.rr; PH.rr=null; }   /* r128 keeps render as an own method of the instance */

function phSizeTo(w, h, pr){ RSZ.k="";
  renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
  if(composer){ var ds=renderer.getDrawingBufferSize(new THREE.Vector2()); composer.setSize(ds.x, ds.y); if(bloomPass) bloomPass.setSize(ds.x/2, ds.y/2); if(composer.aoPass) composer.aoPass.setSize(ds.x, ds.y); }
  camera.aspect=w/h; camera.updateProjectionMatrix();
  [STRIP.cam,PULL.cam,BOG.cam,BOAT.cam,ROAD.cam,HILL.cam,SALT.cam,OVAL.cam].forEach(function(c){ if(c){ c.aspect=w/h; c.updateProjectionMatrix(); } });
}
function phRenderNow(){
  var s=PH.scene;
  if(s==="road") roadRender(); else if(s==="hill") hillRender(); else if(s==="salt") saltRender(); else if(s==="bog") bogRender();
  else if(s==="boat") boatRender(); else if(s==="pull") pullRender(); else if(s==="strip") stripRender(); else if(s==="oval") ovalRender();
  else { if(GFX!=="lite"&&composer) composer.render(); else renderer.render(scene, camera); }
}
function phCopy(){ var o=document.createElement("canvas"); o.width=canvasEl.width; o.height=canvasEl.height; o.getContext("2d").drawImage(canvasEl,0,0); return o; }
function phCamPlace(){   /* the orbit camera where the camState says (the frame loop does this each tick; a grab can't wait for it) */
  camera.position.set(camState.target.x+camState.r*Math.sin(camState.phi)*Math.sin(camState.theta), camState.target.y+camState.r*Math.cos(camState.phi), camState.target.z+camState.r*Math.sin(camState.phi)*Math.cos(camState.theta));
  camera.lookAt(camState.target);
}
function phCamKeep(){ return {t:camState.theta, p:camState.phi, r:camState.r, tg:camState.target.clone(), a:camState.auto}; }
function phCamBack(k){ camState.theta=k.t; camState.phi=k.p; camState.r=k.r; camState.target.copy(k.tg); camState.auto=k.a; }

ENGINE_VIS.photoStart=function(){
  if(!renderer||!scene) return {ok:false, scene:"none"};
  var es=ENGINE_VIS.eventScene();
  if(es==="trophy"||es==="pits") return {ok:false, scene:es};
  if(PH.on) return {ok:true, scene:PH.scene};
  PH.on=true; PH.scene=es; PH.light="asis"; PH.back="garage"; PH.yaw=0; PH.pitch=0; PH.zoom=1; PH.pan.x=PH.pan.y=0; PH.dKey=""; PH.exMul=1;
  PH.saved=phSnapStand(); PH.camSave=phCamKeep(); PH.autoForce=camState.autoForce;
  camState.autoForce=false; camState.auto=false;
  phHook();
  return {ok:true, scene:es};
};
ENGINE_VIS.photoStop=function(){
  if(!PH.on) return;
  PH.on=false; phUnhook();
  if(PH.saved) phRestoreStand(PH.saved);
  camState.autoForce=PH.autoForce===undefined?null:PH.autoForce;
  if(PH.camSave) phCamBack(PH.camSave);
  PH.saved=null; PH.camSave=null; PH.exMul=1; PH.scene="";
  if(PH.group){ disposeTree(PH.group); scene.remove(PH.group); PH.group=null; }
};
ENGINE_VIS.photoLight=function(k){
  if(!PH.on) return null; PH.light=PH_LIGHT[k]?k:"asis";
  if(!PH.scene) phApplyLight(PH.light, PH.saved); else PH.exMul=PH_LIGHT[PH.light]?PH_LIGHT[PH.light].vex:1;
  return PH.light;
};
ENGINE_VIS.photoBack=function(k){
  if(!PH.on) return null; PH.back=PH_BACK[k]?k:"garage"; if(!PH.scene) phApplyBack(PH.back, PH.saved); return PH.back;
};
/* camera moves in screen pixels: orbit [dx,dy], zoom factor, pan [dx,dy]; reset puts the shot back */
ENGINE_VIS.photoView=function(o){
  if(!PH.on||!o) return;
  phSync(); if(PH.scene==="x") return;
  var h=canvasEl.clientHeight||600;
  if(!PH.scene){
    camState.idle=0; camState.auto=false;
    if(o.reset){ frameEngine(); camState.theta=0.72; camState.phi=1.06; return; }
    if(o.orbit){ camState.theta-=o.orbit[0]*0.0085; camState.phi=clamp(camState.phi-o.orbit[1]*0.0065, 0.12, 1.53); }
    if(o.zoom) camState.r=clamp(camState.r*o.zoom, 3.5, 32);
    if(o.pan){ var k=2*camState.r*Math.tan(camera.fov*Math.PI/360)/h, th=camState.theta, ph=camState.phi, cp=Math.cos(ph), T=camState.target, dx=o.pan[0], dy=o.pan[1];
      T.x=clamp(T.x-dx*k*Math.cos(th)-dy*k*cp*Math.sin(th), -9, 9); T.y=clamp(T.y+dy*k*Math.sin(ph), 0.5, 16); T.z=clamp(T.z+dx*k*Math.sin(th)-dy*k*cp*Math.cos(th), -9, 9); }
  } else {
    if(o.reset){ PH.yaw=PH.pitch=0; PH.zoom=1; PH.pan.x=PH.pan.y=0; return; }
    if(o.orbit){ PH.yaw-=o.orbit[0]*0.0085; PH.pitch=clamp(PH.pitch+o.orbit[1]*0.0065, -0.9, 1.2); }
    if(o.zoom) PH.zoom=clamp(PH.zoom*o.zoom, 0.2, 3.2);
    if(o.pan){ var cam=phCamOf(PH.scene), k2=2*PH.D*PH.zoom*Math.tan((cam?cam.fov:45)*Math.PI/360)/h; PH.pan.x=clamp(PH.pan.x-o.pan[0]*k2, -40, 40); PH.pan.y=clamp(PH.pan.y+o.pan[1]*k2, -20, 20); }
  }
};
ENGINE_VIS.photoState=function(){ return {on:PH.on, scene:PH.scene, light:PH.light, back:PH.back, yaw:+PH.yaw.toFixed(3), pitch:+PH.pitch.toFixed(3), zoom:+PH.zoom.toFixed(3), D:+PH.D.toFixed(2), garageHidden:garageRoot?!garageRoot.visible:null, hooked:!!PH.rr, r:+camState.r.toFixed(2), th:+camState.theta.toFixed(3), ph:+camState.phi.toFixed(3), auto:camState.autoForce}; };
ENGINE_VIS.photoSpin=function(on){ camState.autoForce=on?true:false; camState.auto=!!on; camState.idle=0; };
/* one frame at `scale` x CSS pixels (capped to what the card can hold), copied to a 2D canvas */
ENGINE_VIS.photoGrab=function(scale){
  if(!renderer||!PH.on) return null;
  phSync(); if(PH.scene==="x") return null;
  var host=canvasEl.parentElement, w=host?host.clientWidth:canvasEl.clientWidth, h=host?host.clientHeight:canvasEl.clientHeight;
  var cap=Math.min(renderer.capabilities.maxTextureSize||4096, 6000), pr=Math.max(0.5, Math.min(+scale||1, cap/Math.max(w,h), Math.sqrt(16e6/(w*h))));
  var keep=phCamKeep(), out=null;
  try{
    phSizeTo(w, h, pr);
    if(!PH.scene) phCamPlace();
    phRenderNow();
    out=phCopy();
  } finally {
    ENGINE_VIS.resize(); phCamBack(keep);
  }
  return out;
};
/* a studio picture of the engine on its stand, whatever is on screen */
ENGINE_VIS.photoShot=function(w, h){
  if(!renderer||!scene||!engineRoot) return null;
  var host=canvasEl.parentElement, vw=host?host.clientWidth:canvasEl.clientWidth, vh=host?host.clientHeight:canvasEl.clientHeight;
  var snap=phSnapStand(), keep=phCamKeep(), fxv=fxRoot?fxRoot.visible:true, out=null, hadGroup=!!PH.group, gvis=hadGroup&&PH.group.visible;
  try{
    phSizeTo(w, h, 1);
    if(fxRoot) fxRoot.visible=false;
    phApplyLight("studio", snap); phApplyBack("grey", snap);
    frameEngine(); camState.theta=0.62; camState.phi=1.14; camState.r=Math.min(camState.r*0.84, 24);
    phCamPlace();
    if(GFX!=="lite"&&composer) composer.render(); else renderer.render(scene, camera);
    out=phCopy();
  } finally {
    if(fxRoot) fxRoot.visible=fxv;
    phRestoreStand(snap);
    if(!hadGroup&&PH.group){ disposeTree(PH.group); scene.remove(PH.group); PH.group=null; } else if(PH.group) PH.group.visible=gvis;
    ENGINE_VIS.resize(); phCamBack(keep);
  }
  return out;
};
