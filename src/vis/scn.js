/* ===========================================================================
   EVENT SCENES, CORE HALF: what the page needs before the event scenes arrive.
   The nine event scenes (strip, pits, pull, bog, boat, road, salt, hill, oval: vis/strip.js to vis/oval.js) are not in index.html.
   build.js writes them to scenes.js, and the page fetches that file in the background once the garage is up, so a first visit
   downloads about a quarter less before the workshop shows. This file holds what must be there from the start:
     - each scene's state object (STRIP, PULL ...), so every "is the strip on?" check works before the scenes load;
     - the sponsor logo painter (the career's sponsor cards draw with it) and slEngOf (the Test tab reads a car's engine with it);
     - SCN_NAMES: the scene functions the core calls (the frame loop, vis/api.js, photo mode). build.js checks the list, see below;
     - the loader: scnLoad fetches scenes.js and runs it inside this closure, so the scene code sees every core variable exactly
       as it did when it was part of the page; scnNeed is the gate each ENGINE_VIS.setStrip / setPull / ... passes through.
   Adding a call from the core to a scene function: add its name to SCN_NAMES. build.js stops with the two lines to paste if the
   var line or scnTake below fall out of step with it, or if the core uses a scene name that is not listed.
   ==========================================================================*/
function stripInit(){ return { on:false, scene:null, cam:null, built:false, sun:null, hemi:null, cars:{}, tree:null, smoke:[], lastX:0,
  camPos:new THREE.Vector3(), camTgt:new THREE.Vector3(), t:0,
  shot:null, shotT:0, cutT:9, runT:0, shake:0, cheer:0, night:null, tier:null, prev:{},
  fx:null, fxAdd:null, marks:null, board:null, tm:null, sky:null, env:{}, spots:[], poles:[], mats:{}, composer:null, heatPass:null,
  flash:null, fog:null, crowd:null, halos:[], exposure:0.95 }; }
var STRIP=stripInit();   /* phones: vis/api.js takes a fresh one when Lite frees the scene */
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
/* the logo: a plate in the brand colour, the brand's emblem (sponsors/<id>.png, ElevenLabs image art picked by Kelbo, credits in
   sponsors/CREDITS.md) on a light badge at the left, the name in the game's display font and the tag line. The emblem is fetched the
   first time a logo is drawn; until it (and the font) arrive the old drawn mark stands in, then every cached logo canvas is redrawn
   in place and its textures and the composites built from it (door decals) are refreshed. Wild Oat's art carries its own name, so it
   is drawn whole on a dark plate with no wordmark. */
var SP_EMB={}, SP_FULL={wildoat:1}, LIV_FX=[], spFontOk=false;
function spEmblem(id){
  var e=SP_EMB[id]; if(e) return e.ok?e.img:null;
  if(typeof Image==="undefined") return null;
  e=SP_EMB[id]={img:new Image(), ok:false}; e.img.decoding="async";
  e.img.onload=function(){ e.ok=true; livRedraw(); };
  e.img.onerror=function(){ if(console.debug) console.debug("[sponsors] emblem unavailable:", id); };
  e.img.src="sponsors/"+id+".png";
  if(!spFontOk && typeof document!=="undefined" && document.fonts && document.fonts.load){ spFontOk=true; document.fonts.load("700 40px 'Chakra Petch'").then(livRedraw, function(){}); }
  return null;
}
var livRedrawT=0;
function livRedraw(){ if(livRedrawT) return; livRedrawT=setTimeout(function(){ livRedrawT=0;
  Object.keys(LIV_CV).forEach(function(k){ var c=LIV_CV[k]; spLogoDraw(c, c.__sp); });
  Object.keys(LIV_MAT).forEach(function(k){ var m=LIV_MAT[k]; if(m && m.map) m.map.needsUpdate=true; });
  LIV_FX.forEach(function(f){ try{ f(); }catch(e){} });
  if(typeof window!=="undefined" && typeof window.spLogosChanged==="function") window.spLogosChanged(); }, 60); }
function spLogoDraw(c, sp){
  var w=c.width, h=c.height, x=c.getContext("2d"), F="'Barlow Condensed','Arial Narrow',Arial,sans-serif", D="'Chakra Petch','Barlow Condensed','Arial Narrow',Arial,sans-serif",
    m=Math.round(h*0.05), r=h*0.16, img=spEmblem(sp.id), full=img && SP_FULL[sp.id];
  x.clearRect(0,0,w,h); spRRect(x, m, m, w-2*m, h-2*m, r); x.fillStyle=full?"#1d1f22":sp.c1; x.fill();
  x.lineWidth=Math.max(2,h*0.03); x.strokeStyle=full?sp.c1:sp.c2; spRRect(x, m*2.4, m*2.4, w-4.8*m, h-4.8*m, r*0.7); x.stroke();
  if(full){ var fk=Math.min((w-10*m)/img.width, (h-5.6*m)/img.height), fw=img.width*fk, fh=img.height*fk; x.drawImage(img, (w-fw)/2, (h-fh)/2, fw, fh); return; }
  var tx;
  if(img){
    var k=Math.min(h*0.95/img.width, h*0.56/img.height), iw=img.width*k, ih=img.height*k, pad=h*0.07, bx=m*3.6, bw=iw+2*pad, bh=Math.max(ih+2*pad, h*0.5), by=(h-bh)/2;
    x.fillStyle="#f4f1e8"; spRRect(x, bx, by, bw, bh, h*0.08); x.fill();
    x.drawImage(img, bx+pad, (h-ih)/2, iw, ih); tx=bx+bw+h*0.14;
  }else{ spShape(x, sp.shape, h*0.52, h*0.5, h*0.27, sp.c2, sp.c1); tx=h*0.92; }
  var tw=w-tx-h*0.18, word=String(sp.name||"").toUpperCase();
  x.textAlign="left"; x.textBaseline="alphabetic"; x.fillStyle=sp.c3; x.font=(img?"700 "+Math.round(h*0.34)+"px "+D:"italic 700 "+Math.round(h*0.4)+"px "+F); x.fillText(word, tx, h*0.58, tw);
  x.fillStyle=sp.c2; x.font="600 "+Math.round(h*0.15)+"px "+F; x.fillText(String(sp.tag||"").toUpperCase(), tx+2, h*0.8, tw);
}
function spLogoCanvas(sp, w, h){
  w=w||512; h=h||192; var key=sp.id+"|"+w+"x"+h; if(LIV_CV[key]) return LIV_CV[key];
  var c=newCanvas(w,h); c.__sp=sp; spLogoDraw(c, sp);
  LIV_CV[key]=c; return c;
}
var PITS={ on:false, built:false, scene:null, cam:null, car:null, carKey:"", props:null, models:null, mTier:null, crew:[], fx:null, spot:null, hemi:null, lamp:null, bg:null,
  mats:{}, t:0, heat:0, nightK:-1, dirty:2, seen:-1, renders:0, work:{}, wind:new THREE.Vector3(-0.25,0,-0.3), tier:null, stats:null,
  fit:{L:4.6, hw:0.95, H:1.3, rearX:-1.5, rearZ:0.8, rr:0.35, frontX:1.4, tw:0.35} };
function pullInit(){ return { on:false, built:false, scene:null, cam:null, sun:null, hemi:null, flood:null, sky:null, fog:null, mats:{}, geo:{},
  veh:{}, cur:null, sled:null, chain:null, board:null, crowd:null, poles:[], spots:[], fx:null, fxDirt:null, fxConf:null,
  camPos:new THREE.Vector3(), camTgt:new THREE.Vector3(), fov:44, shot:null, shotT:0, cutT:9, snap:true, relOn:false, skip:false,
  t:0, pullT:0, doneT:0, cheer:0, night:null, tier:null, prev:{}, x0:null, lastT:0, composer:null, exposure:0.92, stats:null,
  flags:[], wheel:null, props:null, ruts:null, horLin:null, sunDir:null, tension:0, shake:0, fixX:0 }; }
var PULL=pullInit();   /* phones: vis/api.js takes a fresh one when Lite frees the scene */
function bogInit(){ return { on:false, built:false, scene:null, cam:null, sun:null, hemi:null, flood:null, sky:null, fog:null, mats:{}, veh:{}, cur:null, curKey:"",
  mud:null, mudKey:"", mudCv:null, mudTex:null, mudGeo:null, mudBase:null, ruts:null, rutDirty:0, paintAt:-1, paintX:-1e9, crowd:null, poles:[], spots:[], fx:null, fxSpray:null,
  camPos:new THREE.Vector3(), camTgt:new THREE.Vector3(), fov:46, shot:null, shotT:0, cutT:9, snap:true, relOn:false, skip:false,
  t:0, doneT:0, cheer:0, night:null, tier:null, prev:{}, lastT:0, composer:null, exposure:0.92, stats:null, horLin:null, sunDir:null, shake:0, fixX:0, coat:0, slapT:0, pitch:0, pv:0, roll:0 }; }
var BOG=bogInit();   /* phones: vis/api.js takes a fresh one when Lite frees the scene */
function boatInit(){ return { on:false, built:false, scene:null, cam:null, sun:null, hemi:null, sky:null, fog:null, mats:{}, water:null, wMat:null, boats:{}, me:null, opp:null, fx:null, fxMist:null,
  tree:null, lamps:null, boards:[], crowd:null, buoys:null, camPos:new THREE.Vector3(), camTgt:new THREE.Vector3(), fov:45, shot:null, shotT:0, snap:true, relOn:false, skip:false,
  t:0, doneT:0, cheer:0, tier:null, prev:{}, lastT:0, composer:null, exposure:0.9, stats:null, horLin:null, sunDir:null, shake:0, fixX:0, night:null, st:{me:{}, opp:{}} }; }
var BOAT=boatInit();   /* phones: vis/api.js takes a fresh one when Lite frees the scene */
var ROAD={ on:false, worlds:{}, W:null, cam:null, cars:{}, car:null, carKey:"", camPos:new THREE.Vector3(), camTgt:new THREE.Vector3(), fov:50, shot:null, shotT:0, cutT:9,
  snap:true, skip:false, night:null, tier:null, exposure:0.92, composer:null, stats:null, lastT:0, st:-1, chP:new THREE.Vector3(), chT:new THREE.Vector3(), roll:0, steer:0, mode:"auto" };
var LSR_MILE_V=1609.344, SALT_PUSH_COL=0x56707e;   /* the push truck: weathered slate, clear of every class colour */
function saltInit(){ var o={ on:false, built:false, scene:null, cam:null, sun:null, hemi:null, sky:null, ground:null, mats:{}, cars:{}, cur:null, curKey:"", push:null,
  camPos:new THREE.Vector3(), camTgt:new THREE.Vector3(), fov:46, shot:null, shotT:0, cutT:9, snap:true, relOn:false, skip:false, horLin:null,
  t:0, runT:0, doneT:0, prev:{}, composer:null, shimmer:null, exposure:0.74, stats:null, tier:null, fx:null, flags:[], fixX:0, fixZ:0, seq:0,
  course:null, crowd:null, shake:0, pushX:0, pushZ:0, pushV:0 };
  o.course={x0:LSR_MILE_V, x1:2*LSR_MILE_V, k0:1.5*LSR_MILE_V-500, k1:1.5*LSR_MILE_V+500, xEnd:3.5*LSR_MILE_V}; return o; }
var SALT=saltInit();   /* phones: vis/api.js takes a fresh one when Lite frees the scene */
/* what the car's engine shows, read off a build cfg */
function slEngOf(cfg, layoutObj){
  cfg=cfg||{}; var SIMO=(typeof ENGINE_SIM!=="undefined")?ENGINE_SIM:null;
  var LO=layoutObj || (SIMO && SIMO.LAYOUTS && SIMO.LAYOUTS[cfg.layout]) || null, L=normLayout(cfg, LO);
  var a=String(cfg.asp||"na"), asp=a==="na"?"na":(a==="roots"||a==="screw")?"blower":a==="centrifugal"?"centri":(a==="twin_turbo"||a==="compound")?"twin":"turbo";
  var rot=isRotaryCfg(cfg), two=!rot && isTwoStrokeCfg(cfg), dsl=isDieselCfg(cfg), fuel=String(cfg.fuel||"");
  var kind=rot?"rotary":two?"two":L.banks>1?(L.boxer?"flat":"v"):"i";
  var rotors=rot?(+String(cfg.layout||"R2").slice(1)||2):0;
  var inj=asp==="na" && !dsl && (cfg.intake==="itb" || /meth|e85|nitro|ethan/.test(fuel));
  return {kind:kind, n:Math.max(1,L.n||4), rotors:rotors, asp:asp, screw:a==="screw", diesel:dsl, inj:inj, carb:cfg.intake==="carb",
    ic:!!cfg.ic && cfg.ic!=="none", n2o:!!cfg.nitrous && cfg.nitrous!=="none", cover:(COVER_COLORS[cfg.cover]||COVER_COLORS.red)};
}
var HILL={ on:false, W:null, cam:null, cars:{}, car:null, carKey:"", camPos:new THREE.Vector3(), camTgt:new THREE.Vector3(), fov:50, shot:null, shotT:0, snap:true, lastT:0, stats:null, st:-1,
  chP:new THREE.Vector3(), chT:new THREE.Vector3(), roll:0, steer:0, heliA:0, tier:null };
var OVAL={ on:false, built:false, scene:null, cam:null, sun:null, hemi:null, flood:null, sky:null, fog:null, mats:{}, cars:{}, list:[], fx:null, G:null, gkey:"",
  camPos:new THREE.Vector3(), camTgt:new THREE.Vector3(), fov:50, shot:null, shotT:0, cutT:0, snap:true, relOn:false, t:0, night:null, tier:null, prev:{}, lastT:0,
  composer:null, exposure:0.92, stats:null, horLin:null, sunDir:null, shake:0, crowd:null, poles:[], spots:[], board:null, lane:{}, flagMesh:null, flagKey:"", cheer:0, lapSeen:0, tvA:0 };
/* --- the scene functions the core calls: empty until scenes.js has run --- */
var SCN_NAMES="roadRender hillRender ovalRender saltRender bogRender boatRender pullRender stripPostStep stripRender pitsRender _sbP _sbS stripBandRead saltBandRead stripPostEnd stripReset buildStripScene stripUpdate stripPostStart stripPostLeft stripPostLeave stripPostEnter pitsUpdate pitsAnchors pullReset buildPullScene pullUpdate bogReset buildBogScene bogUpdate boatReset buildBoatScene boatUpdate roadFieldHide roadUpdate hillUpdate ovalUpdate saltReset buildSaltScene saltRebuild saltUpdate saltRivalLook saltSetLook".split(" ");
var roadRender, hillRender, ovalRender, saltRender, bogRender, boatRender, pullRender, stripPostStep, stripRender, pitsRender, _sbP, _sbS, stripBandRead, saltBandRead, stripPostEnd, stripReset, buildStripScene, stripUpdate, stripPostStart, stripPostLeft, stripPostLeave, stripPostEnter, pitsUpdate, pitsAnchors, pullReset, buildPullScene, pullUpdate, bogReset, buildBogScene, bogUpdate, boatReset, buildBoatScene, boatUpdate, roadFieldHide, roadUpdate, hillUpdate, ovalUpdate, saltReset, buildSaltScene, saltRebuild, saltUpdate, saltRivalLook, saltSetLook;
function scnTake(o){ roadRender=o.roadRender; hillRender=o.hillRender; ovalRender=o.ovalRender; saltRender=o.saltRender; bogRender=o.bogRender; boatRender=o.boatRender; pullRender=o.pullRender; stripPostStep=o.stripPostStep; stripRender=o.stripRender; pitsRender=o.pitsRender; _sbP=o._sbP; _sbS=o._sbS; stripBandRead=o.stripBandRead; saltBandRead=o.saltBandRead; stripPostEnd=o.stripPostEnd; stripReset=o.stripReset; buildStripScene=o.buildStripScene; stripUpdate=o.stripUpdate; stripPostStart=o.stripPostStart; stripPostLeft=o.stripPostLeft; stripPostLeave=o.stripPostLeave; stripPostEnter=o.stripPostEnter; pitsUpdate=o.pitsUpdate; pitsAnchors=o.pitsAnchors; pullReset=o.pullReset; buildPullScene=o.buildPullScene; pullUpdate=o.pullUpdate; bogReset=o.bogReset; buildBogScene=o.buildBogScene; bogUpdate=o.bogUpdate; boatReset=o.boatReset; buildBoatScene=o.buildBoatScene; boatUpdate=o.boatUpdate; roadFieldHide=o.roadFieldHide; roadUpdate=o.roadUpdate; hillUpdate=o.hillUpdate; ovalUpdate=o.ovalUpdate; saltReset=o.saltReset; buildSaltScene=o.buildSaltScene; saltRebuild=o.saltRebuild; saltUpdate=o.saltUpdate; saltRivalLook=o.saltRivalLook; saltSetLook=o.saltSetLook; }
/* --- the loader. ENGINE_VIS.scenes(url, tag, cb) names the file; tag is the first bytes it must start with (build.js writes the version
   there), so a stale copy from a cache or a half-finished deploy is fetched again, not run against the wrong page.
   cb("wait") the first time an event asks before the scenes are in, cb("ok") when they are, cb("fail") when the fetch failed (the next
   ask tries again after 3 s). The scene code runs through a direct eval so it joins this closure; its last line hands back the
   SCN_NAMES functions (build.js writes that line). */
var SCNL={ok:false, st:0, url:"", tag:"", cb:null, t:0, asked:false, look:undefined};
function scnSay(s){ try{ if(SCNL.cb) SCNL.cb(s); }catch(e){} }
function scnRun(txt){ scnTake(eval(txt)); }
function scnLoad(){
  if(SCNL.ok || SCNL.st===1 || !SCNL.url || typeof fetch!=="function") return;
  if(SCNL.st===2 && performance.now()-SCNL.t<3000) return;
  SCNL.st=1;
  var get=function(fresh){
    return fetch(SCNL.url, fresh?{cache:"reload"}:{}).then(function(r){ if(!r.ok) throw new Error("scenes.js "+r.status); return r.text(); }).then(function(t){
      if(SCNL.tag && t.slice(0, SCNL.tag.length)!==SCNL.tag){ if(!fresh) return get(true); throw new Error("scenes.js is from another version"); }
      return t; });
  };
  get(false).then(function(t){
    scnRun(t); SCNL.ok=true; SCNL.st=0;
    if(SCNL.look!==undefined){ var lk=SCNL.look; SCNL.look=undefined; try{ ENGINE_VIS.saltLook(lk); }catch(e){} }
    scnSay("ok");
  }).catch(function(e){ SCNL.st=2; SCNL.t=performance.now(); if(typeof console!=="undefined") console.error("[scenes]", e); scnSay("fail"); });
}
function scnNeed(){ if(SCNL.ok) return true; if(!SCNL.asked || SCNL.st===2){ SCNL.asked=true; scnSay("wait"); } scnLoad(); return false; }
