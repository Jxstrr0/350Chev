/* ===========================================================================
   10. ORBIT CONTROLS (touch + mouse, no examples/)
   ==========================================================================*/
function setupOrbit(cv){
  var ptrs={}, nptr=0, lastDist=0, idleTimer=0, pan=false;
  function markActive(){ camState.idle=0; camState.auto=false; }
  /* mouse pan: right / middle drag (or shift + drag) slides the target across the screen plane, a pixel per pixel
     at the target's distance; kept within reach of the engine so it can't be lost off-screen */
  function panBy(dx,dy){
    var k=2*camState.r*Math.tan(camera.fov*Math.PI/360)/(cv.clientHeight||600), th=camState.theta, ph=camState.phi, cp=Math.cos(ph), T=camState.target;
    T.x=clamp(T.x-dx*k*Math.cos(th)-dy*k*cp*Math.sin(th), -7, 7);
    T.y=clamp(T.y+dy*k*Math.sin(ph), 1, 15);
    T.z=clamp(T.z+dx*k*Math.sin(th)-dy*k*cp*Math.cos(th), -7, 7);
  }
  function pos(e){ return {x:e.clientX, y:e.clientY}; }
  cv.style.touchAction="none";

  cv.addEventListener("pointerdown", function(e){
    if(!ptrs[e.pointerId]) nptr++;
    ptrs[e.pointerId]=pos(e); camState.dragging=true; markActive();
    pan = e.pointerType==="mouse" && (e.button===1 || e.button===2 || e.shiftKey);
    if(e.button===1) e.preventDefault();
    try{ cv.setPointerCapture(e.pointerId); }catch(err){}
  });
  cv.addEventListener("pointermove", function(e){
    var p=ptrs[e.pointerId]; if(!p) return;
    var np=pos(e);
    if(nptr===1 && pan) panBy(np.x-p.x, np.y-p.y);
    else if(nptr===1){
      camState.theta -= (np.x-p.x)*0.0085;
      camState.phi    = clamp(camState.phi - (np.y-p.y)*0.0065, 0.22, 1.52);
    }
    ptrs[e.pointerId]=np;
    if(nptr>=2){
      var ids=Object.keys(ptrs);
      var A=ptrs[ids[0]], Bp=ptrs[ids[1]];
      var d=Math.hypot(A.x-Bp.x, A.y-Bp.y);
      if(lastDist) camState.r = clamp(camState.r*(lastDist/d), 7, 30);
      lastDist=d;
    }
    markActive();
  });
  function up(e){
    if(ptrs[e.pointerId]){ delete ptrs[e.pointerId]; nptr=Math.max(0,nptr-1); }
    if(nptr<2) lastDist=0;
    if(nptr===0) camState.dragging=false;
    camState.idle=0;
  }
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);
  cv.addEventListener("pointerleave", up);
  cv.addEventListener("wheel", function(e){
    camState.r=clamp(camState.r*(1+e.deltaY*0.0012), 7, 30);
    camState.idle=0; camState.auto=false;
    e.preventDefault();
  }, {passive:false});
  cv.addEventListener("contextmenu", function(e){ e.preventDefault(); });
  cv.addEventListener("dblclick", function(){ frameEngine(); camState.idle=0; camState.auto=false; });
}

/* ===========================================================================
   11. FRAME LOOP
   ==========================================================================*/
var _tmpV=new THREE.Vector3();
function tick(dt, t){
  /* --- camera --- */
  if(camState.autoForce===true) camState.auto=true;
  else if(camState.autoForce===false) camState.auto=false;
  else {
    if(!camState.dragging){
      camState.idle+=dt;
      if(camState.idle>6) camState.auto=true;
    }
  }
  if(camState.auto) camState.theta += dt*0.13;

  var sh=camState.shake;
  camera.position.set(
    camState.target.x + camState.r*Math.sin(camState.phi)*Math.sin(camState.theta),
    camState.target.y + camState.r*Math.cos(camState.phi),
    camState.target.z + camState.r*Math.sin(camState.phi)*Math.cos(camState.theta));
  if(sh>0.0001){
    camera.position.x += Math.sin(t*61)*sh;
    camera.position.y += Math.sin(t*83)*sh*0.7;
    camera.position.z += Math.cos(t*47)*sh;
  }
  camera.lookAt(camState.target);
  camState.shake *= Math.max(0, 1-dt*3.2);

  /* --- running parts --- */
  var frac = run.on ? clamp(run.rpm/Math.max(1000, run.redline), 0, 1.25) : 0;
  var spin = run.on ? (run.rpm/60)*TAU*dt : 0;
  var i;
  for(i=0;i<anim.spin.length;i++){
    var sp=anim.spin[i]; sp.o.rotation.x += spin*sp.k*0.16;
  }
  for(i=0;i<anim.turbos.length;i++) anim.turbos[i].rotation.x += spin*(1.4+frac*5.0)*0.16;
  if(anim.internals){
    var IN=anim.internals; IN.theta += spin*0.16; IN.crank.rotation.x = IN.theta;
    /* rotary: each rotor rides its eccentric lobe and turns at a third of shaft speed (that is what makes the apexes trace the housing) */
    if(XRAY && IN.ports) for(var pi2=0; pi2<IN.ports.length; pi2++){   /* two-stroke: a port window glows while the crown is below its top edge */
      var po=IN.ports[pi2], cy2=po.cyl, f2=IN.theta+cy2.phase, ca2=Math.cos(cy2.ang), sa2=Math.sin(cy2.ang), py2=IN.r*Math.cos(f2), pz2=IN.r*Math.sin(f2), ly2=ca2*py2+sa2*pz2, lz2=-sa2*py2+ca2*pz2, crown=ly2+Math.sqrt(Math.max(0, IN.L*IN.L-lz2*lz2))+IN.ch;
      var open=crown<po.top-1e-4; po.m.material.opacity=open?(po.kind==="e"?0.95:0.85):0.18;
    }
    if(IN.op){   /* opposed pistons (the Deltic): each crank turns its own way; a piston rides its crank's pin along its cylinder */
      for(var cr=0; cr<IN.cranks.length; cr++){ var ck=IN.cranks[cr]; ck.g.rotation.x=ck.sign*IN.theta+ck.off; }
      if(XRAY){ var _Yo=new THREE.Vector3(0,1,0), _do=new THREE.Vector3(), _po=new THREE.Vector3(), _qo=new THREE.Vector3();
        for(var oi=0; oi<IN.op.length; oi++){
          var o=IN.op[oi], phi=o.c.sign*IN.theta+o.c.off+o.phase, py=IN.r*Math.cos(phi), pz=IN.r*Math.sin(phi);
          var au=py*o.u.y+pz*o.u.z, bv=-py*o.u.z+pz*o.u.y, sp=au+Math.sqrt(Math.max(0, IN.L*IN.L-bv*bv));
          _po.set(o.x, o.C.y+py, o.C.z+pz); _qo.set(o.x, o.C.y+o.u.y*sp, o.C.z+o.u.z*sp);
          var cc=sp+IN.ch-IN.pistonH/2; o.piston.position.set(o.x, o.C.y+o.u.y*cc, o.C.z+o.u.z*cc); o.piston.quaternion.setFromUnitVectors(_Yo, _do.set(0,o.u.y,o.u.z));
          _do.subVectors(_qo,_po); o.rod.position.copy(_po).addScaledVector(_do,0.5); o.rod.quaternion.setFromUnitVectors(_Yo, _do.normalize());
        }
      }
    }
    if(IN.rotors) for(var ri=0; ri<IN.rotors.length; ri++){ var ro=IN.rotors[ri], th=IN.theta+ro.phase; ro.g.position.set(ro.x, IN.e*Math.cos(th), IN.e*Math.sin(th)); ro.g.rotation.x=th/3; }
    if(XRAY){
      var _Y=new THREE.Vector3(0,1,0), _d=new THREE.Vector3(), _p=new THREE.Vector3(), _q=new THREE.Vector3();
      for(i=0;i<IN.cyls.length;i++){
        var cy=IN.cyls[i], f=IN.theta+cy.phase, ca=Math.cos(cy.ang), sa=Math.sin(cy.ang);
        var py=IN.r*Math.cos(f), pz=IN.r*Math.sin(f);
        var ly= ca*py + sa*pz, lz=-sa*py + ca*pz;
        var yp= ly + Math.sqrt(Math.max(0, IN.L*IN.L - lz*lz));
        _p.set(cy.px, py, pz);
        _q.set(cy.x, ca*yp, sa*yp);
        var yc = yp + IN.ch - IN.pistonH/2;
        cy.piston.position.set(cy.x, ca*yc, sa*yc); cy.piston.rotation.set(cy.ang,0,0);
        _d.subVectors(_q,_p); cy.rod.position.copy(_p).addScaledVector(_d,0.5);
        cy.rod.quaternion.setFromUnitVectors(_Y, _d.normalize());
      }
    }
  }
  GRIME_UNIFORM.value = clamp(run.wear||0, 0, 1.2);
  for(i=0;i<anim.fans.length;i++) anim.fans[i].rotation.x += spin*0.55*0.16;

  /* --- shake: the block sits on rubber mounts, so what you see is
         (a) residual 1st/2nd-order shaking force from the reciprocating masses (buzz, tiny),
         (b) mean torque reaction rolling the block against the mounts (blips rock it),
         (c) per-cycle torque ripple: lumpy idle on a big cam, worse with few cylinders,
         (d) a failure = something inside is now out of balance.
         Units: 1 = 100 mm. A rough four buzzes ~2 mm; a cammed V8 rolls a few degrees at idle. --- */
  var smooth = clamp(run.smooth===undefined?70:run.smooth, 0, 100);
  var rpm = run.on ? Math.max(0, run.rpm) : 0;
  var fHz = rpm/60;
  var F0 = 12.0, ZETA = 0.25;                       /* mount natural frequency (translation) */
  function trans(f){ var r=f/F0; return 1/Math.sqrt(Math.pow(1-r*r,2)+Math.pow(2*ZETA*r,2)); }
  var mScale = (run.stroke||86)/86;                 /* reciprocating mass × radius */
  var w2 = (rpm/1000)*(rpm/1000);
  var rough = clamp((1-smooth/100)/0.5, 0.15, 2.2);  /* computed smoothness (damper, stroke...) scales it all */
  var x1 = run.first  * mScale * w2 * trans(fHz)   * 0.055;                     /* rocking couple, 1× */
  var x2 = run.second * mScale * (1.7/(run.rodRatio||1.7)) * w2 * trans(2*fHz) * 0.060; /* 2× vertical */
  var xc = 0.0018 * clamp(run.load,0,1.2) * (1-smooth/100);                     /* combustion roughness floor */
  var VIS = 4.0;                                    /* on a phone 1 mm is half a pixel: exaggerate translation, keep the ratios */
  x1*=rough*VIS; x2*=rough*VIS; xc*=VIS;
  /* render: real sine below ~15 Hz (you can see it), smoothed noise above (a buzz at 60 fps) */
  function osc(f, k, phase){ var wgt=clamp((f-10)/8,0,1); var sn=Math.sin(TAU*f*t+phase);
    mnt.nz[k] += ((Math.random()*2-1) - mnt.nz[k]) * 0.75; return sn*(1-wgt) + mnt.nz[k]*wgt; }
  var vee = run.angle||0, ang = deg(vee/2);
  /* 2nd-order force acts along the cylinder axes: vertical for inlines, split along both banks for a vee, cancels to lateral for a boxer */
  var s2y = x2 * osc(2*fHz,0,0) * (vee>=170 ? 0.15 : Math.cos(ang));
  var s2z = x2 * osc(2*fHz,1,1.1) * (vee>=170 ? 0.8 : Math.sin(ang)*0.7);
  var s1  = x1 * osc(fHz,2,2.3);                    /* 1st-order couple → pitch/yaw about the mounts */
  var rc  = xc * (Math.random()*2-1);
  /* torque reaction: mean torque leans the block; spring-damper so it rocks and settles */
  var nCyl = run.n||4, frac = run.on ? clamp(rpm/Math.max(1000, run.redline), 0, 1.25) : 0;
  var load = run.on ? clamp(run.load,0,1.2) : 0;
  var lean = deg(2.6) * load * (0.45+0.55*Math.min(1,frac*1.4)) * Math.sqrt(4/nCyl) * (vee>=170?0.6:1);
  /* idle lope: per-cycle variation, grows with overlap, fades with rpm, and a triple/four pulses harder than a twelve */
  var cycleHz = Math.max(0.5, rpm/120);
  mnt.lopeT += dt;
  if(mnt.lopeT > 1/cycleHz){ mnt.lopeT = 0; var overlap = clamp(((run.cam||40)-45)/55, 0, 1);
    var lopeAmp = deg(0.9) * (1+0.5*(run.wear||0)) * (0.25+overlap) * Math.pow(Math.max(0,1-frac*1.8),2) * (4/nCyl) * (run.on?1:0);
    mnt.lope = (Math.random()*2-1) * lopeAmp; }
  var target = run.on ? (lean + mnt.lope) : 0;
  var kR = Math.pow(TAU*6.0,2), cR = 2*0.35*TAU*6.0;   /* ~6 Hz roll mode on the mounts, ζ 0.35 */
  var steps = Math.max(1, Math.ceil(dt/0.006)), h = dt/steps;  /* semi-implicit Euler, sub-stepped: stable on slow frames */
  for(i=0;i<steps;i++){ mnt.rollV += (kR*(target - mnt.roll) - cR*mnt.rollV)*h; mnt.roll += mnt.rollV*h; }
  if(!isFinite(mnt.roll)||Math.abs(mnt.roll)>0.5){ mnt.roll=0; mnt.rollV=0; }
  /* failure: a rod, a piston or a valve is now loose in there */
  var fy=0, fz=0, fr=0;
  if(run.fail){
    if(!failFx.started) startFail(run.failKind);
    var sev = failFx.kind==="rod"||failFx.kind==="crank" ? 1.0 : failFx.kind==="valve"||failFx.kind==="seize" ? 0.6 : 0.25;
    var calm = Math.max(0.15, 1-failFx.t*0.4);
    fy=(Math.random()*2-1)*0.045*sev*calm; fz=(Math.random()*2-1)*0.035*sev*calm; fr=(Math.random()*2-1)*deg(2.5)*sev*calm;
    if(failFx.rattle>0){ fy+=(Math.random()*2-1)*0.012*failFx.rattle; fz+=(Math.random()*2-1)*0.010*failFx.rattle; }
  } else if(failFx.started) cleanupFail();
  if(engineShake){
    engineShake.position.set(rc*0.6, s2y + rc + fy, s2z + rc*0.8 + fz);
    engineShake.rotation.set(mnt.roll + fr, s1*0.9, s1*0.5);
  }
  if(heatZones){ var pulse=0.5+0.5*Math.sin(t*5.0); for(i=0;i<heatZones.length;i++){ var hz=heatZones[i]; if(hz.pulse&&hz.zone<16) HEAT_UNIFORM.value[hz.zone].w = hz.amount*(0.7+0.3*pulse); } }
  /* --- header glow --- */
  var glow = run.on ? clamp(frac*frac*1.7*clamp(run.load,0,1.2), 0, 1.35) : 0;
  if(run.fail) glow = Math.max(glow, failFx.glow);
  for(i=0;i<anim.glowMats.length;i++){
    var m=anim.glowMats[i];
    var target = glow*(i===0?1.0:(i===1?0.62:0.80));
    if(run.fail && failFx.kind==="turbo") target = i===2 ? failFx.glow : glow*0.5;
    if(run.fail && failFx.kind==="seize") target = i===2 ? glow*0.5 : failFx.glow;
    m.emissiveIntensity += (target-m.emissiveIntensity)*Math.min(1, dt*2.4);
  }

  /* --- particles --- */
  if(fxRoot){
    var ep=exhaustPoint();
    if(run.on && frac>0.10 && Math.random() < clamp(frac*0.9,0,0.85)){
      _tmpV.copy(ep); _tmpV.x+=(Math.random()-0.5)*1.4; _tmpV.z+=(Math.random()-0.5)*1.4;
      emit("haze", _tmpV);
    }
    /* diesel black smoke: rate and puff size follow the opacity; capped for phones */
    smokeP.copy(ep);
    if(run.on && run.smoke>0.03 && !run.fail && particles.length<(GFX==="lite"?260:520)){
      smokeAcc += dt*(10+70*run.smoke*run.smoke)*Math.min(1,frac*2.2+0.3);
      while(smokeAcc>=1){
        smokeAcc-=1; _tmpV2.copy(smokeP); _tmpV2.x+=(Math.random()-0.5)*0.5; _tmpV2.z+=(Math.random()-0.5)*0.5;
        emit("smokeBlack", _tmpV2);
        var bs=particles[particles.length-1], bk=0.55+run.smoke*1.2;
        bs.userData.s0*=bk; bs.userData.op*=0.45+run.smoke*0.55; bs.userData.vy*=1+run.smoke*0.4;
      }
    } else smokeAcc=0;
    if(run.fail) stepFail(dt);
    else if(failFx.debris.length) stepDebris(dt);
    n2oPurgeStep(dt);
    alsStep(dt);
    stepParticles(dt);
  }
}
var exhaustTipW=null, smokeAcc=0, smokeP=new THREE.Vector3();
function exhaustPoint(){
  if(exhaustTipW) return _tmpV.copy(exhaustTipW);
  return _tmpV.set(camState.target.x-2.2, camState.target.y-2.4, camState.target.z+3.4);
}

/* frame pacing. rAF fires at the display rate: 120 Hz on a ProMotion iPad or a gaming phone.
   With a cap set, a vsync that comes too soon after the last drawn frame is skipped and the clock
   keeps running, so the next frame's dt covers the gap. The drawn frames follow a 1/cap grid, so a
   90 or 144 Hz screen still averages the cap instead of dropping to half. Every rAF loop that asks
   in the same vsync gets the same answer (they share the timestamp), so the app's tick skips with it. */
var viewOff=false, capMs=0, gateT=-1, gateOk=true, lastDraw=0, fpsWin={t0:0, last:0, n:0}, fpsStat={fps:0, ms:0};
function frameDue(now){
  if(now===gateT) return gateOk;
  gateT=now; var el=now-lastDraw;
  gateOk = !capMs || el<0 || el>=capMs-1;
  if(gateOk) lastDraw = (!capMs || el<0 || el>2*capMs) ? now : Math.min(now, lastDraw+capMs);
  return gateOk;
}
/* fps meter: drawn frames over ~0.5 s of rAF timestamps; a gap over 3 s (hidden tab) restarts it */
function fpsCount(now){
  var w=fpsWin;
  if(!w.t0 || now<w.last || now-w.last>3000){ w.t0=w.last=now; w.n=0; return; }
  w.n++; w.last=now;
  if(now-w.t0>=500){ fpsStat={fps:w.n*1000/(now-w.t0), ms:(now-w.t0)/w.n}; w.t0=now; w.n=0; }
}

function loop(now){
  rafId=requestAnimationFrame(loop);
  if(!renderer) return;
  now = now>0 ? now : performance.now();
  if(!frameDue(now)) return;
  if(viewOff){ clock.getDelta(); return; }
  fpsCount(now);
  var dt=Math.min(clock.getDelta(), 0.05);
  if(TROPHY.on && TROPHY.built){ trophyFrame(now); return; }   /* trophy room: its own scene, drawn only when something moved */
  tick(dt, clock.elapsedTime);
  if(TD.on) tdStep(dt, clock.elapsedTime);   /* teardown view: pulse the failed part */
  if(ROAD.on && ROAD.W){ if(ROAD.minMs && now-ROAD.lastR<ROAD.minMs && now>=ROAD.lastR) return; ROAD.lastR=now; roadRender(); return; }
  if(SALT.on && SALT.built){ saltRender(); return; }
  if(BOG.on && BOG.built){ bogRender(); return; }
  if(BOAT.on && BOAT.built){ boatRender(); return; }
  if(PULL.on && PULL.built){ pullRender(); return; }
  if(STRIP.on && STRIP.built){ if(STRIP.post) stripPostStep(); stripRender(); return; }
  if(PITS.on && PITS.built && !TD.on){ pitsRender(dt); return; }   /* race night: the pits between rounds */
  if(GFX!=="lite"&&composer) composer.render(); else renderer.render(scene, camera);
}

/* ===========================================================================
   12. FRAMING
   ==========================================================================*/
function frameEngine(){
  if(TD.on){ tdFrame(true); return; }   /* teardown view frames the failed part instead */
  if(!engineRoot) return;
  engineBounds.setFromObject(engineRoot);
  if(engineBounds.isEmpty()) return;
  var c=engineBounds.getCenter(new THREE.Vector3());
  var sz=engineBounds.getSize(new THREE.Vector3());
  camState.target.set(0, c.y, 0);
  var vfov=deg(camera.fov);
  var aspect=camera.aspect||1;
  var hfov=2*Math.atan(Math.tan(vfov/2)*aspect);
  var needV=(sz.y*0.62)/Math.tan(vfov/2);
  var needH=(Math.max(sz.x,sz.z)*0.60)/Math.tan(hfov/2);
  camState.r=clamp(Math.max(needV, needH)*1.62, 8, 26);
}

/* ===========================================================================
   13. PUBLIC API
   ==========================================================================*/
