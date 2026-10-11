const ENGINE_VIS = {

  init: function(canvas){
    if(renderer) return ENGINE_VIS;
    canvasEl = (typeof canvas==="string") ? document.getElementById(canvas) : canvas;
    if(!canvasEl) throw new Error("ENGINE_VIS.init: canvas not found");
    /* perf: no drawing while the 3D view is scrolled out of sight (an embedded page, a squeezed layout) */
    if(window.IntersectionObserver){ try{ new IntersectionObserver(function(es){ viewOff=!es[es.length-1].isIntersecting; }).observe(canvasEl); }catch(e){} }

    renderer=new THREE.WebGLRenderer({canvas:canvasEl, antialias:true, alpha:false,
                                      powerPreference:"high-performance"});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
    renderer.outputEncoding=THREE.sRGBEncoding;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=0.95;
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    try{ MAXANISO=Math.min(8, renderer.capabilities.getMaxAnisotropy()); }catch(e){ MAXANISO=4; }

    scene=new THREE.Scene();
    scene.background=sc(0x0d0f12);
    scene.fog=new THREE.Fog(0x0d0f12, 62, 130);

    camera=new THREE.PerspectiveCamera(40, 1, 0.2, 260);

    buildMaterials();
    envMap=buildEnvMap(renderer);
    scene.environment=envMap;

    hemi=new THREE.HemisphereLight(0xa8b6c8, 0x1c1712, 0.34); scene.add(hemi);
    keyLight=new THREE.DirectionalLight(0xfff0d8, 1.45);
    keyLight.position.set(14, 30, 16);
    keyLight.castShadow=true;
    keyLight.shadow.mapSize.set(1024,1024);
    var shc=keyLight.shadow.camera;
    shc.left=-26; shc.right=26; shc.top=26; shc.bottom=-16; shc.near=1; shc.far=90;
    keyLight.shadow.bias=-0.0009; keyLight.shadow.normalBias=0.03;
    scene.add(keyLight); scene.add(keyLight.target);
    keyLight.target.position.set(0,7,0);

    fillLight=new THREE.PointLight(0xffb075, 0.60, 55, 2.0);
    fillLight.position.set(-13, 11, 11); scene.add(fillLight);

    rimLight=new THREE.DirectionalLight(0x7fa8d8, 0.75);
    rimLight.position.set(-16, 12, -20); scene.add(rimLight);

    garageRoot=new THREE.Group(); scene.add(garageRoot);
    engineShake=new THREE.Group(); scene.add(engineShake);
    engineRoot=new THREE.Group(); engineRoot.position.y=6.85; engineShake.add(engineRoot);
    fxRoot=new THREE.Group(); scene.add(fxRoot);

    clock=new THREE.Clock();
    setupOrbit(canvasEl);
    ENGINE_VIS.buildGarage(lastOwned);
    ENGINE_VIS.resize();
    if(typeof window!=="undefined") window.addEventListener("resize", ENGINE_VIS.resize);
    running=true;
    loop();
    return ENGINE_VIS;
  },

  reframe: function(){ frameEngine(); },
  /* heat map: zones = [{zone, r,g,b, amount, pulse}] or null to clear */
  setHeat: function(zones){
    heatZones = zones||null;
    for(var i=0;i<16;i++) HEAT_UNIFORM.value[i].set(0,0,0,0);
    if(!zones) return;
    for(i=0;i<zones.length;i++){ var z=zones[i]; if(z.zone>0&&z.zone<16) HEAT_UNIFORM.value[z.zone].set(z.r,z.g,z.b,z.amount); }
  },
  /* which zone is under a screen point (0 = none) */
  zoneAt: function(px, py){
    if(!renderer||!engineRoot||(PITS.on&&!TD.on)) return 0;
    var r=canvasEl.getBoundingClientRect();
    _ndc.set(((px-r.left)/r.width)*2-1, -((py-r.top)/r.height)*2+1);
    _ray.setFromCamera(_ndc, camera);
    var hits=_ray.intersectObject(engineRoot, true);
    for(var i=0;i<hits.length;i++){ var h=hits[i]; var g=h.object.geometry; var za=g&&g.attributes&&g.attributes.zone; if(!za) continue; var idx=h.face?h.face.a:0; if(g.index) idx=g.index.getX(idx); return Math.round(za.getX(idx)); }
    return 0;
  },
  resize: function(){
    if(!renderer||!canvasEl) return;
    var host=canvasEl.parentElement;
    var w = host? host.clientWidth : canvasEl.clientWidth;
    var h = host? host.clientHeight : canvasEl.clientHeight;
    if(!w||!h){ w=canvasEl.clientWidth||400; h=canvasEl.clientHeight||340; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, GFX!=="lite"?2:1.5));
    renderer.setSize(w, h, false);
    if(composer){ var ds=renderer.getDrawingBufferSize(new THREE.Vector2()); composer.setSize(ds.x, ds.y); if(bloomPass) bloomPass.setSize(ds.x/2, ds.y/2); if(composer.aoPass) composer.aoPass.setSize(ds.x, ds.y); }
    camera.aspect=w/h;
    camera.updateProjectionMatrix();
    if(STRIP.cam){ STRIP.cam.aspect=w/h; STRIP.cam.updateProjectionMatrix(); STRIP.viewH=h; stripBandRead(); }
    if(PULL.cam){ PULL.cam.aspect=w/h; PULL.cam.updateProjectionMatrix(); }
    if(BOG.cam){ BOG.cam.aspect=w/h; BOG.cam.updateProjectionMatrix(); }
    if(BOAT.cam){ BOAT.cam.aspect=w/h; BOAT.cam.updateProjectionMatrix(); }
    if(ROAD.cam){ ROAD.cam.aspect=w/h; ROAD.cam.updateProjectionMatrix(); }
    if(HILL.cam){ HILL.cam.aspect=w/h; HILL.cam.updateProjectionMatrix(); }
    if(SALT.cam){ SALT.cam.aspect=w/h; SALT.cam.updateProjectionMatrix(); SALT.viewH=h; saltBandRead(); }
    if(PITS.cam) PITS.dirty=2;
    frameEngine();
  },
  setQuality: function(q){
    var want = (q==="ultra") ? "ultra" : (q==="full") ? "full" : "lite";
    if(!renderer){ GFX=want; return; }
    if(want!=="lite" && THREE.EffectComposer && THREE.UnrealBloomPass && (!composer || composer.userData_tier!==want)){
      try{
        if(composer){ composer.passes.forEach(function(ps){ if(ps.dispose) ps.dispose(); }); composer=null; bloomPass=null; }
        composer=new THREE.EffectComposer(renderer); composer.userData_tier=want;
        var ds=renderer.getDrawingBufferSize(new THREE.Vector2());
        if(want==="ultra" && THREE.SSAOPass){
          var ao=new THREE.SSAOPass(scene, camera, ds.x, ds.y);
          ao.kernelRadius=0.9; ao.minDistance=0.0008; ao.maxDistance=0.06; ao.output=THREE.SSAOPass.OUTPUT.Default;
          composer.addPass(ao); composer.aoPass=ao;
        } else composer.addPass(new THREE.RenderPass(scene, camera));
        bloomPass=new THREE.UnrealBloomPass(new THREE.Vector2(ds.x/2, ds.y/2), 0.55, 0.45, 0.80);
        composer.addPass(bloomPass);
        if(THREE.GammaCorrectionShader) composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
      }catch(e){ composer=null; bloomPass=null; want="lite"; }
    }
    var tierChanged = (GFX !== want);
    GFX = want;
    if(tierChanged && lastCfg && engineRoot) ENGINE_VIS.buildEngine(lastCfg, lastLayout);   /* v1.6: model detail follows the tier */
    if(keyLight){ keyLight.shadow.mapSize.set(GFX!=="lite"?2048:1024, GFX!=="lite"?2048:1024); if(keyLight.shadow.map){ keyLight.shadow.map.dispose(); keyLight.shadow.map=null; } }
    ENGINE_VIS.resize();
  },
  /* run view: the band (CSS px up from the view's bottom edge) an event's live HUD covers, and the view's height; the pull, bog,
     road / 24 h cameras lift the picture clear of it (bandLens), salt reads VBAND itself. No argument: report. */
  setBand: function(px, h){ VBAND.px=Math.max(0,+px||0); if(h>0) VBAND.h=+h; return ENGINE_VIS.band(); },
  band: function(){ return {px:VBAND.px, h:VBAND.h}; },
  setStrip: function(o){
    if(!renderer) return;
    if(!o || o.on===false){ if(STRIP.on){ stripPostEnd(); STRIP.on=false; STRIP.honour=0; STRIP.rec=null; STRIP.recPre=null; stripReset(); } document.documentElement.classList.remove("onstrip"); return; }
    if(!STRIP.on){ STRIP.on=true; document.documentElement.classList.add("onstrip"); if(!STRIP.built) buildStripScene(); STRIP.shot=null; STRIP.snap=true; ENGINE_VIS.resize(); }
    if(STRIP.post){ if(o.phase==="done") return STRIP.stats||null; stripPostEnd(); }
    if(STRIP.rn) for(var rk in STRIP.rn) if(o[rk]===undefined) o[rk]=STRIP.rn[rk];   /* race night extras: round, dials, the other lane's tree/RT/ET, win */
    var rdt=Math.max(0, +o.dt||0.016); stripUpdate(o, Math.min(0.1, rdt), Math.min(0.5, rdt));
    if(o.phase==="done" && !STRIP.post && STRIP.prev.phase==="done" && o.noPost!==true) stripPostStart(o);
    return STRIP.stats||null;
  },
  /* after the pass: seconds left in the board / replay / lap-of-honour show (0 = nothing playing); stripSkip() cuts to the board */
  stripBusy: function(){ return STRIP.on ? stripPostLeft() : 0; },
  stripSkip: function(){ var R=STRIP.post; if(!R||R.seg==="board") return false; R.replay=false; R.honourDone=true; stripPostLeave(); stripPostEnter("board"); return true; },
  stripPost: function(){ var R=STRIP.post; return R?{seg:R.seg, t:+R.t.toFixed(2), angle:R.angle, replay:R.replay, frames:(STRIP.rec||[]).length, left:+stripPostLeft().toFixed(2)}:null; },   /* harness */
  /* a personal best on this pass: PB on the board, the stands come up and the camera cuts to them (1 = this engine, 2 = all-time) */
  stripPb: function(k){ if(k!==undefined){ STRIP.pb=k||0; STRIP.pbCut=0; if(k) STRIP.cheer=Math.max(STRIP.cheer, k>1?2.4:1.7); }
    return {pb:STRIP.pb||0, shot:STRIP.shot, cheer:+STRIP.cheer.toFixed(2)}; },   /* no argument: just report (harness) */
  purge: function(sec){ N2O_FX.t=Math.max(N2O_FX.t, sec==null?0.6:+sec); },
  als: function(a){ if(a!==undefined) ALS_FX.amt=Math.max(0,Math.min(1,+a||0)); return {amt:ALS_FX.amt, bursts:ALS_FX.n}; },   /* engine view anti-lag: 0..1 while it fires; no argument just reports */
  stripN2O: function(s){ STRIP.n2oSt=s||null; },   /* strip car nitrous: {purge 0..1, n2o 0..1, cut, phase} */   /* engine view: puff the nitrous purge for sec seconds */
  hasPurge: function(){ return !!(N2O_PURGE && N2O_PURGE.parent); },
  skipCut: function(){ if(STRIP.shot==="crowd") STRIP.pbCut=2; },   /* a tap during the crowd cut goes back to the car */
  /* race night: extra fields merged into every setStrip frame {round, nightK (v2: 0 dusk at Q1 .. 1 dark at the final), pdial, odial, otree:{a1,a2,a3,green}, ort, oet, omph, ofoul, win}; null clears */
  stripRace: function(x){ STRIP.rn=x||null; },
  stripWin: function(){ STRIP.win=1; STRIP.pbCut=0; STRIP.cheer=Math.max(STRIP.cheer, 2.6); STRIP.honour=1; STRIP.honourT=0; STRIP.flashT=Math.max(STRIP.flashT||0, 9); },   /* won the night: the stands come up, the camera cuts to them, honour starts */
  /* v2: STRIP.honour is 1 from "WON THE NIGHT" until the next burnout or leaving the strip (STRIP.honourT counts seconds); C's camera reads it.
     No argument: report (harness). */
  stripHonour: function(){ return {honour:STRIP.honour||0, t:+(STRIP.honourT||0).toFixed(2), wave:!!(STRIP.crowd&&STRIP.crowd.wave), flashT:+(STRIP.flashT||0).toFixed(2), dusk:STRIP.dusk==null?null:+STRIP.dusk.toFixed(3)}; },
  /* race night pits, between rounds: {on, body, color, tyreIn, nightK 0..1 (dusk to full dark), heat 0..1 (hot-tyre smoke, fades by itself),
     poke ("launch"|"first"|"final"|"psi"|"shocks"|"wear"|"dial": the crew works on that end)}; {on:false} leaves. Lite draws a still. */
  setPits: function(o){
    if(!renderer) return null;
    if(!o || o.on===false){ if(PITS.on){ PITS.on=false; if(PITS.fx) PITS.fx.clear(); } return null; }
    if(!PITS.on){ PITS.on=true; PITS.dirty=2; PITS.fitKey=""; }
    pitsUpdate(o); return PITS.stats;
  },
  /* fix pack: which event scene owns the canvas ("" = the engine stand, where orbiting works); the app hides the orbit hint otherwise */
  eventScene: function(){ return (TROPHY.on&&TROPHY.built)?"trophy":(ROAD.on&&ROAD.W)?"road":(HILL.on&&HILL.W)?"hill":(BOAT.on&&BOAT.built)?"boat":(SALT.on&&SALT.built)?"salt":(BOG.on&&BOG.built)?"bog":(PULL.on&&PULL.built)?"pull":(STRIP.on&&STRIP.built)?"strip":(PITS.on&&PITS.built&&!TD.on)?"pits":""; },
  pitsAnchors: function(){ return pitsAnchors(); },   /* {w, h, launch|wear|gear|psi|shocks|dial: [x, y, inFront]} in canvas CSS px */
  pitsState: function(){ return {on:PITS.on, built:PITS.built, renders:PITS.renders, stats:PITS.stats, nightK:PITS.nightK, heat:+PITS.heat.toFixed(2), car:PITS.carKey,
    cam:PITS.cam?PITS.cam.position.toArray().map(function(v){ return Math.round(v*100)/100; }):null}; },   /* harness */
  /* DIESEL pulling scene: fed every frame {on, phase:"stage"|"pull"|"done", x, v, boxFrac, slip, hop, smoke, rpm, vehicle, full, night, cls, distFt, color?, dt?,
     track?:{moist 0..1, cut 0..1} (dirt tint + dust), runaway?: 0..1 (grey-white stack torrent + shake), killed?: bool (stack goes quiet)}; {on:false} leaves */
  setPull: function(o){
    if(!renderer) return;
    if(!o || o.on===false){ if(PULL.on){ PULL.on=false; pullReset(); } return; }
    var now=performance.now(); if(!PULL.on){ PULL.on=true; if(!PULL.built) buildPullScene(); pullReset(); PULL.snap=true; PULL.lastT=now; ENGINE_VIS.resize(); }
    var rdt=o.dt!=null ? +o.dt : (now-PULL.lastT)/1000; PULL.lastT=now; pullUpdate(o, clamp(rdt||0, 0, 0.1));
    return PULL.stats||null;
  },
  pullSkip: function(){ if(PULL.on) PULL.skip=true; },
  /* MUD BOG: fed every frame {on, phase:"stage"|"runup"|"pit"|"done", x (front axle, m from the pit's near edge), v, wspd (tyre surface speed), slip, sink, y, vy,
     dFront, dRear (mud depth under each axle), rpm, throttle, smoke, cls, tyre, color?, night, len, cons, pit:{seed, len, cons} (builds the night's mud), mudKg,
     slap (a splash this frame, 0..1.5), cleared, failed, shot? (force a camera), dt?}; {on:false} leaves */
  setBog: function(o){
    if(!renderer) return;
    if(!o || o.on===false){ if(BOG.on){ BOG.on=false; bogReset(); } return; }
    var now=performance.now(); if(!BOG.on){ BOG.on=true; if(!BOG.built) buildBogScene(); bogReset(); BOG.snap=true; BOG.lastT=now; ENGINE_VIS.resize(); }
    var rdt=o.dt!=null ? +o.dt : (now-BOG.lastT)/1000; BOG.lastT=now; bogUpdate(o, clamp(rdt||0, 0, 0.1));
    return BOG.stats||null;
  },
  bogSkip: function(){ if(BOG.on) BOG.skip=true; },
  /* BOAT DRAGS: fed every frame {on, phase:"tree"|"run"|"done", cls, hull, drive, night, water:{wind, chop}, tree:{pre, stage, amb (0..3), green, redMe, redOpp},
     me / opp: {x (m from the start buoys), v, rpm, thr, bow (deg), pl (0..1 planing), porp, walk, hop, air, flip, hook, failed, color, smoke},
     meEt, meMph, oppEt, oppMph (the boards), won, shot? (force a camera), dt?}; {on:false} leaves */
  setBoat: function(o){
    if(!renderer) return;
    if(!o || o.on===false){ if(BOAT.on){ BOAT.on=false; boatReset(); } return; }
    var now=performance.now(); if(!BOAT.on){ BOAT.on=true; if(!BOAT.built) buildBoatScene(); boatReset(); BOAT.snap=true; BOAT.lastT=now; ENGINE_VIS.resize(); }
    var rdt=o.dt!=null ? +o.dt : (now-BOAT.lastT)/1000; BOAT.lastT=now; boatUpdate(o, clamp(rdt||0, 0, 0.1));
    return BOAT.stats||null;
  },
  boatSkip: function(){ if(BOAT.on) BOAT.skip=true; },
  boatState: function(){ return {on:BOAT.on, built:BOAT.built, shot:BOAT.shot, tier:BOAT.tier, parts:BOAT.fx?BOAT.fx.P.length+(BOAT.fxMist?BOAT.fxMist.P.length:0):0, mist:!!BOAT.fxMist, stats:BOAT.stats,
    cam:BOAT.cam?BOAT.cam.position.toArray().map(function(v){ return Math.round(v*100)/100; }):null, me:BOAT.me?{x:+BOAT.me.position.x.toFixed(1), y:+BOAT.me.position.y.toFixed(2), bow:+(BOAT.me.userData.bow*180/PI).toFixed(1)}:null,
    wake:BOAT.wakeMe?BOAT.wakeMe.geometry.drawRange.count:0}; },   /* harness */
  bogState: function(){ return {on:BOG.on, built:BOG.built, shot:BOG.shot, mudKey:BOG.mudKey, parts:BOG.fx?BOG.fx.P.length+(BOG.fxSpray?BOG.fxSpray.P.length:0):0, spray:!!BOG.fxSpray, stats:BOG.stats,
    cam:BOG.cam?BOG.cam.position.toArray().map(function(v){ return Math.round(v*100)/100; }):null, ruts:BOG.mudGeo?Math.round(-Math.min.apply(null, Array.prototype.filter.call(BOG.mudGeo.attributes.position.array, function(v,i){ return i%3===1; }))*100)/100:0}; },   /* harness */
  /* career sponsors on the cars: {hood:sp, sides:[sp...]} (sp: {id, name, tag, shape, c1, c2, c3}); null = the shop's own colours */
  setLivery: function(L){ var h=L&&L.hood||null, sd=(L&&L.sides||[]).filter(Boolean); LIVERY.hood=h; LIVERY.sides=h?sd:[]; LIVERY.key=h?[h.id].concat(sd.map(function(q){ return q.id; })).join(","):""; return LIVERY.key; },
  livery: function(){ return {key:LIVERY.key, hood:LIVERY.hood&&LIVERY.hood.id, sides:LIVERY.sides.map(function(q){ return q.id; })}; },   /* harness */
  logoCanvas: function(sp, w, h){ return spLogoCanvas(sp, w, h); },   /* the app's sponsor cards and slips draw the same cached logo */   /* cut straight to the stop framing (sled + board) */
  /* ROAD COURSE: fed every frame {on, track (ENGINE_SIM.roadTrack), s (m from the line), v (m/s), g, rpm, thr, brk, ax, ay (g), slip, ch (chassis id), night, cam:"auto"|"chase"|"side"|"onboard", pre (approaching the line)}; {on:false} leaves */
  setRoad: function(o){
    if(!renderer) return;
    if(!o || o.on===false){ if(ROAD.on){ ROAD.on=false; ROAD.minMs=0; if(ROAD.W && ROAD.W.fx) ROAD.W.fx.clear(); if(ROAD.W) roadFieldHide(ROAD.W); } return; }
    ROAD.minMs=+o.minMs||0;   // time-lapse: the app asks for a few frames a second
    var now=performance.now();
    if(!ROAD.on){ ROAD.on=true; ROAD.snap=true; ROAD.shot=null; ROAD.lastT=now; if(!ROAD.cam) ROAD.cam=new THREE.PerspectiveCamera(50, 1, 0.3, 5200); ENGINE_VIS.resize(); }
    var rdt=o.dt!=null ? +o.dt : (now-ROAD.lastT)/1000; ROAD.lastT=now; roadUpdate(o, clamp(rdt||0, 0, 0.1));
    return ROAD.stats||null;
  },
  /* PIKES PEAK: fed every frame {on, course (ENGINE_SIM.hillCourse), s, v, d (lateral m), g, rpm, thr, brk, lat, off, dnf, ev, ch, aero, color, cam:"auto"|"chase"|"heli"|"onboard", pre, done, dt}; {on:false} leaves */
  setHill: function(o){
    if(!renderer) return;
    if(!o || o.on===false){ if(HILL.on){ HILL.on=false; if(HILL.W && HILL.W.fx) HILL.W.fx.clear(); } return; }
    var now=performance.now();
    if(!HILL.on){ HILL.on=true; HILL.snap=true; HILL.shot=null; HILL.lastT=now; if(!HILL.cam) HILL.cam=new THREE.PerspectiveCamera(50, 1, 0.3, 14000); ENGINE_VIS.resize(); }
    var rdt=o.dt!=null ? +o.dt : (now-HILL.lastT)/1000; HILL.lastT=now; hillUpdate(o, clamp(rdt||0, 0, 0.4));
    return HILL.stats||null;
  },
  hillState: function(){ return {on:HILL.on, built:!!HILL.W, shot:HILL.shot, stats:HILL.stats, cam:HILL.cam?HILL.cam.position.toArray().map(function(v){ return Math.round(v); }):null}; },   /* harness */
  /* BONNEVILLE salt flats: fed every frame {on, phase:"stage"|"push"|"run"|"shutdown"|"spin"|"done", x, v, acc, slip, rpm, throttle, body, aero, color?, chute, chutes, chuteBlown,
     failed, smoke, course:{x0,x1,k0,k1,xEnd}, shot? (force a camera), dt?}; {on:false} leaves */
  setSalt: function(o){
    if(!renderer) return;
    if(!o || o.on===false){ if(SALT.on){ SALT.on=false; saltReset(); } return; }
    var now=performance.now(); if(!SALT.on){ SALT.on=true; if(!SALT.built) buildSaltScene(); saltReset(); SALT.snap=true; SALT.lastT=now; ENGINE_VIS.resize(); }
    if(SALT.tier!==GFX && SALT.built){ saltRebuild(); ENGINE_VIS.resize(); }   /* a new quality tier: build the flats again at it */
    var rdt=o.dt!=null ? +o.dt : (now-SALT.lastT)/1000; SALT.lastT=now; saltUpdate(o, clamp(rdt||0, 0, 0.1));
    return SALT.stats||null;
  },
  /* the player's car for the next run: {color, num, cls, cfg} (or {rival:seed, body} for any other car); null clears */
  saltLook: function(o){ if(!renderer) return null; if(o && o.rival!=null && o.rival!==true) return (SALT.look=saltRivalLook(o.rival, o.body)); return saltSetLook(o); },
  saltSkip: function(){ if(SALT.on) SALT.skip=true; },   /* cut straight to the stopped car */
  saltState: function(){ return {on:SALT.on, built:SALT.built, shot:SALT.shot, cam:SALT.cam?SALT.cam.position.toArray().map(function(v){ return Math.round(v*100)/100; }):null, cars:Object.keys(SALT.cars), parts:SALT.fx?SALT.fx.P.length:0, fx:SALT.fx?SALT.fx.mesh:null}; },   /* harness */
  setXray: function(on){
    XRAY=!!on;
    if(!engineRoot) return;
    engineRoot.traverse(function(o){
      if(!o.isMesh || !o.material) return;
      var inInternals=false; for(var q=o; q; q=q.parent){ if(q.name==="internals"){ inInternals=true; break; } }
      if(inInternals) return;
      if(XRAY){
        if(!o.userData.solidMat) o.userData.solidMat=o.material;
        if(!o.userData.xrayMat){ var xm=o.userData.solidMat.clone(); xm.userData={}; xm.transparent=true; xm.opacity=0.22; xm.depthWrite=false; xm.side=THREE.FrontSide; xm.envMapIntensity=(xm.envMapIntensity||1)*0.5; heatPatch(xm); o.userData.xrayMat=xm; }
        o.material=o.userData.xrayMat;
      } else if(o.userData.solidMat) o.material=o.userData.solidMat;
    });
    if(anim.internals) anim.internals.group.visible=XRAY;
  },

  buildEngine: function(cfg, layoutObj){
    lastCfg=cfg; lastLayout=layoutObj;
    if(!renderer) return;
    disposeTree(engineRoot);
    anim={ spin:[], turbos:[], belts:[], hot:[], fans:[], glowMats:[], internals:null };
    var G=buildEngineMesh(cfg, layoutObj);
    engineRoot.position.set(0,0,0);
    engineRoot.add(G);
    engineRoot.updateMatrixWorld(true);
    /* rest the engine on the stand pads */
    var bb=new THREE.Box3().setFromObject(G);
    engineRoot.position.y = 7.05 - bb.min.y;
    engineRoot.updateMatrixWorld(true);
    engBox.setFromObject(G);
    if(G.userData.exhaustTip){ exhaustTipW = G.userData.exhaustTip.clone(); G.localToWorld(exhaustTipW); } else exhaustTipW=null;
    cleanupFail();
    frameEngine();
    if(XRAY) ENGINE_VIS.setXray(true);
    return G.userData.buildMs;
  },

  setMood: function(week){
    if(!keyLight) return;
    var m=[[0xfff0d8,1.45,0.34],[0xfff7ea,1.65,0.40],[0xdfe6ee,1.05,0.46],[0xffc88a,1.30,0.28],[0xfff0d8,1.45,0.34],[0xf2f6ff,1.20,0.44],[0xffd9a8,1.35,0.30],[0xe8ecf0,1.10,0.40]][((week||1)-1)%8];
    keyLight.color.setHex(m[0]); keyLight.intensity=m[1]; if(hemi) hemi.intensity=m[2];
  },
  buildGarage: function(owned){
    lastOwned = owned || {};
    if(owned && owned.week) ENGINE_VIS.setMood(owned.week);
    if(!renderer) return;
    disposeTree(garageRoot);
    var G=buildGarageMesh(lastOwned);
    garageRoot.add(G);
    var W=G.userData.roomW;
    scene.fog.near = W*1.05; scene.fog.far = W*2.2;
    scene.background = sc(lastOwned.sandbox?0x161a1e:0x0d0f12);
    return G;
  },

  setRun: function(s){
    s=s||{};
    if(s.on!==undefined) run.on=!!s.on;
    if(s.rpm!==undefined) run.rpm=s.rpm;
    if(s.load!==undefined) run.load=s.load;
    if(s.fail!==undefined) run.fail=!!s.fail;
    if(s.failKind!==undefined) run.failKind=s.failKind;
    if(s.redline!==undefined) run.redline=s.redline;
    if(s.smooth!==undefined) run.smooth=s.smooth;
    if(s.first!==undefined) run.first=s.first;
    if(s.second!==undefined) run.second=s.second;
    if(s.n!==undefined) run.n=s.n;
    if(s.angle!==undefined) run.angle=s.angle;
    if(s.stroke!==undefined) run.stroke=s.stroke;
    if(s.rodRatio!==undefined) run.rodRatio=s.rodRatio;
    if(s.cam!==undefined) run.cam=s.cam;
    if(s.wear!==undefined) run.wear=s.wear;
    if(s.smoke!==undefined) run.smoke=clamp(+s.smoke||0,0,1);    /* diesel exhaust opacity 0..1 */
    if(!run.on){ run.rpm=0; run.load=0; }
  },

  setAutoRotate: function(b){
    camState.autoForce = (b===undefined||b===null) ? null : !!b;
    if(b===false){ camState.auto=false; camState.idle=0; }
    if(b===true) camState.auto=true;
  },

  frame: function(dt){
    /* the module runs its own rAF loop; this is a no-op hook for external ticks */
    if(!renderer) return;
    if(running) return;
    tick(dt||0.016, (clock?clock.elapsedTime:0));
    if(GFX!=="lite"&&composer) composer.render(); else renderer.render(scene,camera);
  },

  focus: function(part){
    var b=engineBounds;
    if(b.isEmpty()) return;
    var c=b.getCenter(new THREE.Vector3());
    var presets={
      engine:{th:0.72, ph:1.02, y:c.y,  rk:1.00},
      intake:{th:2.30, ph:0.80, y:b.max.y-1.6, rk:0.72},
      exhaust:{th:-0.75,ph:1.05, y:c.y-0.6, rk:0.72},
      turbo:{th:-0.55, ph:1.15, y:c.y-1.4, rk:0.62},
      front:{th:1.57, ph:1.05, y:c.y, rk:0.70},
      top:{th:0.72, ph:0.28, y:c.y, rk:0.92},
      garage:{th:0.90, ph:1.15, y:c.y+2, rk:2.2}
    };
    var p=presets[part]||presets.engine;
    camState.theta=p.th; camState.phi=p.ph;
    camState.target.set(0,p.y,0);
    frameEngine();
    camState.r*=p.rk;
    camState.auto=false; camState.idle=0;
  },

  /* extras (not in the contract, handy for the host page) */
  _cam: function(theta, phi, rk){
    camState.autoForce=false; camState.auto=false;
    if(theta!==undefined) camState.theta=theta;
    if(phi!==undefined) camState.phi=phi;
    if(rk!==undefined) camState.r=clamp(camState.r*rk, 7, 30);
  },
  _debug: function(){
    var b=new THREE.Box3().setFromObject(engineRoot);
    return { min:b.min.toArray().map(function(v){return +v.toFixed(2);}),
             max:b.max.toArray().map(function(v){return +v.toFixed(2);}),
             size:b.getSize(new THREE.Vector3()).toArray().map(function(v){return +v.toFixed(2);}),
             r:+camState.r.toFixed(2), target:camState.target.toArray().map(function(v){return +v.toFixed(2);}),
             cam:camera.position.toArray().map(function(v){return +v.toFixed(2);}),
             aspect:+camera.aspect.toFixed(3),
             mats:(function(){ var o=[]; engineRoot.traverse(function(m){
                if(m.material&&m.name) o.push(m.name+"="+m.material.color.getHexString()); }); return o; })() };
  },
  start: function(){ if(!running){ running=true; clock.getDelta(); loop(); } },
  stop:  function(){ running=false; if(rafId) cancelAnimationFrame(rafId); rafId=0; },
  /* frame-rate cap (0 = whatever the display runs); frameDue(t) lets another rAF loop skip the same vsyncs */
  setFpsCap: function(f){ capMs = f>0 ? 1000/f : 0; },
  frameDue: function(t){ return frameDue(t); },
  fps: function(){ return fpsStat; },
  info:  function(){
    var tris=0, calls=0;
    scene.traverse(function(o){
      if(o.isMesh||o.isInstancedMesh){
        calls += o.isInstancedMesh?1:1;
        var g=o.geometry;
        if(g && g.attributes && g.attributes.position){
          var t=(g.index?g.index.count:g.attributes.position.count)/3;
          tris += t*(o.isInstancedMesh?o.count:1);
        }
      }
    });
    return {drawCalls:calls, triangles:Math.round(tris),
            rendererCalls: renderer?renderer.info.render.calls:0,
            rendererTris: renderer?renderer.info.render.triangles:0};
  }
};

Object.defineProperty(ENGINE_VIS,"_root",{get:function(){return scene;}});
ENGINE_VIS._state=function(){return {gfx:GFX,xray:XRAY,grime:GRIME_UNIFORM.value,wear:run.wear,composer:!!composer,hot:anim.hot?anim.hot.length:0,glow:anim.glowMats?anim.glowMats.map(function(m){return +m.emissiveIntensity.toFixed(2);}):null};};
Object.defineProperty(ENGINE_VIS,"_shake",{get:function(){return engineShake;}});
