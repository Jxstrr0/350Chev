/* ===========================================================================
   7e. FRONT ACCESSORY DRIVE
   One serpentine plane (beltX) in front of the timing cover (tcF); accessory bodies
   live between the two. Every pulley on the loop is on the belt's ribbed side, so it
   turns the same way as the crank at k = crank belt radius / its belt radius.
   ==========================================================================*/
function buildFAD(B, p, extras){
  var bore=p.bore, bankLen=p.bankLen, caseW=p.caseW, caseH=p.caseH, L=p.L, deckH=p.deckH;
  var ve=L.vee, bx=L.boxer, ca=Math.cos(p.a);
  var tcF   = bankLen*0.5 + bore*0.16;      /* timing-cover front face */
  var beltX = bankLen*0.5 + bore*0.78;      /* the serpentine plane */
  var bt    = bore*0.045;                   /* belt tube radius */
  var cool  = pick(p.cfg.cooling,"std");
  var i, j;

  /* ---- crank nose + harmonic damper on the crank axis ---- */
  var dR, dW;
  if(p.damper==="none"){ dR=bore*0.42; dW=bore*0.16; }
  else if(p.damper==="viscous"){ dR=bore*0.72; dW=bore*0.34; }
  else { dR=bore*0.58; dW=bore*0.24; }
  var dBack = beltX - dW*0.5;
  B.add("steel", CYL(bore*0.17,bore*0.17, dBack-tcF+bore*0.04, 16), (dBack+tcF)/2, 0, 0, 0,0,PI/2);
  var damper=new THREE.Group(), steelItems=[{g:CYL(dR,dR,dW,30,false,2.4), m:new THREE.Matrix4().makeRotationZ(PI/2)}];
  if(p.damper!=="none"){
    steelItems.push({g:CYL(dR*0.52,dR*0.52,dW*1.30,24,false,2.4), m:new THREE.Matrix4().compose(V3(dW*0.12,0,0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,PI/2)), V3(1,1,1))});
  }
  if(p.damper==="viscous"){
    /* sealed inertia-ring housing: machined rings on the front face */
    for(i=0;i<3;i++) steelItems.push({g:TOR(dR*(0.66+i*0.10), dW*0.035, 5, 30, 2.4),
      m:new THREE.Matrix4().compose(V3(dW*0.5,0,0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0,PI/2,0)), V3(1,1,1))});
  }
  if(DET){
    /* hub bolts, keyway nut and a timing mark on the rim */
    var nDb = p.damper==="none" ? 3 : 6, rDb = dR*(p.damper==="none"?0.55:0.36);
    for(i=0;i<nDb;i++){ var aDb=i/nDb*TAU; steelItems.push({g:CYL(bore*0.036,bore*0.036,bore*0.03,6,false,6), m:mkM(dW*0.5+(p.damper!=="none"?dW*0.15:0)+bore*0.012, Math.cos(aDb)*rDb, Math.sin(aDb)*rDb, 0,0,PI/2)}); }
    steelItems.push({g:CYL(bore*0.075,bore*0.075,bore*0.05,6,false,6), m:mkM(dW*0.5+(p.damper!=="none"?dW*0.15:0)+bore*0.025,0,0,0,0,PI/2)});
    steelItems.push({g:BOX(dW*0.7, bore*0.012, bore*0.03, 8), m:mkM(0, dR+bore*0.004, 0)});
    /* grooved crank belt track round the rim */
    for(i=0;i<4;i++) steelItems.push({g:TOR(dR, bore*0.008, 4, 36, 4), m:mkM(-dW*0.30+i*dW*0.2, 0,0, 0,PI/2,0)});
  }
  damper.add(new THREE.Mesh(mergeGeos(steelItems), MAT.steel));
  if(p.damper==="rubber"){
    /* the bonded elastomer ring shows as a black line between hub and inertia ring */
    var rub=new THREE.Mesh(TOR(dR*0.60, dW*0.10, 6, 30, 2.4), MAT.rubberFlat); rub.rotation.y=PI/2; rub.position.x=dW*0.5; damper.add(rub);
  }
  damper.traverse(function(o){ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
  damper.position.set(beltX, 0, 0); damper.userData.isDamper=true;
  extras.push(damper); anim.spin.push({o:damper, axis:"x", k:1});
  var Rc=dR+bt;                               /* belt pitch radius on the crank */
  var serp=[{y:0, z:0, r:dR, side:1}];
  function spinK(r){ return Rc/(r+bt); }

  /* ---- layout of the serpentine ---- */
  var altY = (ve||bx) ? caseH*1.15 : deckH*0.62;
  var altZ = -(caseW*0.52 + bore*0.28);                     /* intake side on an inline */
  var wpR  = (cool==="std") ? bore*0.36 : bore*0.30;
  var wpZ  = (ve||bx) ? 0 : bore*0.12;
  var wpY  = Math.max(ve ? deckH*ca*0.62 : bx ? caseH*1.05 : deckH*0.45, dR + wpR + bore*0.14);
  var tnR  = bore*0.17;
  var tnZ  = caseW*0.40 + bore*0.18, tnY = (ve||bx) ? caseH*0.55 : deckH*0.22;

  /* alternator: pulley on the belt plane, body behind it against the front cover */
  var altLen = Math.max(bore*0.40, beltX - bore*0.10 - tcF);
  var altCx  = beltX - bore*0.10 - altLen/2;
  B.add("calu", CYL(bore*0.40,bore*0.40,altLen*0.84,20,false,2.2), altCx+altLen*0.08, altY, altZ, 0,0,PI/2);
  var nF=Math.max(3, Math.round(altLen/(bore*0.11)));
  for(i=0;i<nF;i++) B.add("calu", TOR(bore*0.41, bore*0.028, 5, 20, 2.4), altCx-altLen*0.30+i*(altLen*0.70/(nF-1)), altY, altZ, 0, PI/2, 0);
  B.add("blackPlast", CYL(bore*0.30,bore*0.30,altLen*0.16,14), altCx-altLen*0.42, altY, altZ, 0,0,PI/2);   /* rear cap */
  if(DET){
    /* vented rear housing, B+ stud with its boot, and the regulator plug */
    for(i=0;i<8;i++){ var av=i/8*TAU; B.add("dark", BOX(altLen*0.30, bore*0.05, bore*0.022), altCx-altLen*0.24, altY+Math.cos(av)*bore*0.405, altZ+Math.sin(av)*bore*0.405, av,0,0); }
    B.add("wireRed", CYL(bore*0.045,bore*0.06,bore*0.10,8), altCx-altLen*0.52, altY+bore*0.14, altZ-bore*0.12, 0,0,PI/2);
    B.add("connGrey", BOX(bore*0.10,bore*0.12,bore*0.16), altCx-altLen*0.50, altY-bore*0.12, altZ-bore*0.10);
    B.hw("hex", tcF+bore*0.09, altY-bore*0.10, altZ*0.40, 0,0,-PI/2, bore*0.11);
  }
  B.add("steel", CYL(bore*0.10,bore*0.10,bore*0.12,10), beltX-bore*0.08, altY, altZ, 0,0,PI/2);             /* shaft nose */
  B.add("calu", BOX(bore*0.08, bore*0.26, Math.abs(altZ)*0.55), tcF+bore*0.04, altY-bore*0.10, altZ*0.62);  /* mounting ear */
  var altP=pulleyMesh(bore*0.22, bore*0.14, null, {fan:true}); altP.position.set(beltX, altY, altZ);
  extras.push(altP); anim.spin.push({o:altP, axis:"x", k:spinK(bore*0.22)});
  serp.push({y:altY, z:altZ, r:bore*0.22, side:1});

  /* water pump on the centreline above the crank (race pack = electric pump, an idler keeps the belt shape) */
  if(cool!=="race"){
    B.add("calu", CYL(bore*0.28,bore*0.34,beltX-bore*0.10-tcF,18,false,2.2), (beltX-bore*0.10+tcF)/2, wpY, wpZ, 0,0,PI/2);
    B.add("calu", CYL(bore*0.11,bore*0.11,bore*0.42,10), tcF+bore*0.20, wpY+bore*0.30, wpZ+bore*0.18, 0,0,0);   /* outlet neck */
    if(DET){
      /* thermostat housing on the neck, two bolts; an inline gets its upper hose stub, clamped, capped for the dyno cart */
      var thY=wpY+bore*0.52;
      B.add("calu", CYL(bore*0.15,bore*0.15,bore*0.09,14), tcF+bore*0.20, thY, wpZ+bore*0.18);
      B.add("calu", BOX(bore*0.40,bore*0.04,bore*0.14), tcF+bore*0.20, thY-bore*0.05, wpZ+bore*0.18);
      B.hw("hex", tcF+bore*0.03, thY-bore*0.03, wpZ+bore*0.18, 0,0,0, bore*0.08); B.hw("hex", tcF+bore*0.37, thY-bore*0.03, wpZ+bore*0.18, 0,0,0, bore*0.08);
      B.add("calu", CYL(bore*0.08,bore*0.09,bore*0.12,12), tcF+bore*0.20, thY+bore*0.10, wpZ+bore*0.18);
      ENGD.pump={tcF:tcF, wpY:wpY, wpZ:wpZ, thY:thY, ve:ve, bx:bx};   /* the hoses themselves are laid by engineDetail (every layout) */
    }
    var pitems=[{g:CYL(wpR,wpR,bore*0.15,28,false,1.6), m:new THREE.Matrix4().makeRotationZ(PI/2)},
                {g:CYL(wpR*0.50,wpR*0.50,bore*0.26,20,false,1.6), m:new THREE.Matrix4().makeRotationZ(PI/2)}];
    for(i=0;i<3;i++) pitems.push({g:TOR(wpR*(0.62+i*0.10), bore*0.012, 6, 28, 1.6),
        m:new THREE.Matrix4().compose(V3(bore*0.075,0,0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0,PI/2,0)), V3(1,1,1))});
    var wpp=new THREE.Mesh(mergeGeos(pitems), MAT.steel); wpp.castShadow=true; wpp.receiveShadow=true;
    wpp.position.set(beltX, wpY, wpZ); extras.push(wpp); anim.spin.push({o:wpp, axis:"x", k:spinK(wpR)});
    serp.push({y:wpY, z:wpZ, r:wpR, side:1});
  } else {
    wpR=bore*0.20;
    B.add("calu", CYL(bore*0.12,bore*0.12,beltX-tcF,10), (beltX+tcF)/2-bore*0.05, wpY, wpZ, 0,0,PI/2);
    var wpi=pulleyMesh(wpR, bore*0.13); wpi.position.set(beltX, wpY, wpZ);
    extras.push(wpi); anim.spin.push({o:wpi, axis:"x", k:spinK(wpR)});
    serp.push({y:wpY, z:wpZ, r:wpR, side:1});
    B.add("dark", CYL(bore*0.24,bore*0.24,bore*0.55,14), bankLen*0.30, bx? p.panTop-bore*0.35 : p.panTop+bore*0.55, bx? caseW*0.30 : caseW*0.5+bore*0.30, 0,0,PI/2);  /* electric pump */
  }

  /* centrifugal head unit: pulley on the belt, step-up gearbox, volute behind with the inlet facing forward */
  var cd = p.aspInfo && p.aspInfo.crankDriven;
  if(cd && cd.kind==="centri"){
    var s=bore*0.92, hz=caseW*0.44+bore*0.34, hy=altY, cpR=bore*0.26;
    var vx=tcF+s*0.22, vy=hy+cpR+bore*0.12+s*0.56;
    B.add("malu", RBOX(bore*0.30, vy-hy+bore*0.40, bore*0.66, 0.04), beltX-bore*0.24, (vy+hy)/2, hz);   /* gearbox */
    B.add("malu", BOX(bore*0.08, bore*0.30, hz*0.55), tcF+bore*0.04, hy, hz*0.62);                       /* bracket to the front cover */
    var sOut=buildCompressorSnail(B, extras, p, vx, vy, hz, s, "palu", 1, -1);
    if(cd.cout) cd.cout.push(sOut);
    var cp=pulleyMesh(cpR, bore*0.15); cp.position.set(beltX, hy, hz);
    extras.push(cp); anim.spin.push({o:cp, axis:"x", k:spinK(cpR)});
    serp.push({y:hy, z:hz, r:cpR, side:1});
  } else {
    /* spring tensioner on the exhaust side */
    var pvY=tnY+bore*0.34, pvZ=tnZ-bore*0.30;
    B.add("calu", CYL(bore*0.12,bore*0.12,beltX-tcF-bore*0.06,12), (beltX-bore*0.06+tcF)/2, pvY, pvZ, 0,0,PI/2);
    var dy=tnY-pvY, dz=tnZ-pvZ, al=Math.sqrt(dy*dy+dz*dz);
    B.add("calu", BOX(bore*0.07, bore*0.14, al), beltX-bore*0.11, (pvY+tnY)/2, (pvZ+tnZ)/2, Math.atan2(-dy,dz),0,0);
    if(DET){
      /* the torsion spring coiled round the pivot, its anchor tang, and the pivot bolt */
      var spR=bore*0.15, spPts=[], nTurn=3.2, sx0=tcF+bore*0.10, sx1=beltX-bore*0.18;
      for(i=0;i<=40;i++){ var fs=i/40, as=fs*nTurn*TAU; spPts.push(V3(sx0+(sx1-sx0)*fs, pvY+Math.cos(as)*spR, pvZ+Math.sin(as)*spR)); }
      B.addW("steel", TUBE(spPts, bore*0.018, 90, 5));
      B.add("calu", CYL(bore*0.20,bore*0.20,bore*0.04,16), sx1+bore*0.03, pvY, pvZ, 0,0,PI/2);
      B.add("calu", BOX(bore*0.05,bore*0.12,bore*0.05), sx0+bore*0.02, pvY-spR-bore*0.04, pvZ);
      B.hw("hex", beltX-bore*0.06, pvY, pvZ, 0,0,-PI/2, bore*0.10);
    }
    var idl=pulleyMesh(tnR, bore*0.13); idl.position.set(beltX, tnY, tnZ);
    extras.push(idl); anim.spin.push({o:idl, axis:"x", k:spinK(tnR)});
    serp.push({y:tnY, z:tnZ, r:tnR, side:1});
  }
  extras.push(beltMesh(beltX, serp, bt, bt, {w:bore*0.12}));

  /* ---- Roots / screw blower: its own cogged belt in a plane ahead of the damper ---- */
  if(cd && cd.kind==="blower"){
    var xB=beltX+dW*0.62+bore*0.16, rCB=bore*0.50, rB=Math.max(bore*0.15, rCB/cd.ratio), rI=bore*0.15;
    B.add("steel", CYL(bore*0.22,bore*0.22, xB-(beltX+dW*0.5), 14), (xB+beltX+dW*0.5)/2, 0, 0, 0,0,PI/2);   /* pulley spacer */
    var cbp=pulleyMesh(rCB, bore*0.20, null, {cog:true, bolts:6}); cbp.position.set(xB,0,0); extras.push(cbp); anim.spin.push({o:cbp, axis:"x", k:1});
    if(xB>cd.snoutX) B.add("malu", CYL(bore*0.16,bore*0.20, xB-cd.snoutX, 14), (xB+cd.snoutX)/2-bore*0.06, cd.y, cd.z, 0,0,PI/2);  /* snout extension */
    var bpl=pulleyMesh(rB, bore*0.20, null, {cog:true}); bpl.position.set(xB, cd.y, cd.z); extras.push(bpl); anim.spin.push({o:bpl, axis:"x", k:rCB/rB});
    var iy=cd.y*0.52, iz=cd.z*0.5 + (rCB+rB)*0.5 + bore*0.30;
    B.add("malu", BOX(bore*0.08, cd.y-iy+bore*0.20, bore*0.26), xB-bore*0.16, (cd.y+iy)/2, (cd.z+iz)/2+bore*0.05);   /* idler bracket off the snout */
    var bil=pulleyMesh(rI, bore*0.18, null, {cog:true, bolts:0}); bil.position.set(xB, iy, iz); extras.push(bil); anim.spin.push({o:bil, axis:"x", k:rCB/rI});
    extras.push(beltMesh(xB, [{y:0,z:0,r:rCB,side:1},{y:cd.y,z:cd.z,r:rB,side:1},{y:iy,z:iz,r:rI,side:1}], bore*0.02, bore*0.055, {w:bore*0.17, t:bore*0.045, cog:bore*0.06}));
  }

  /* ---- dry sump: pump stack along the crank axis, low on the intake side, cog-belt driven off the nose ---- */
  if(p.oilSys==="dry"){
    var pY = bx ? p.panTop-bore*0.44 : p.panTop+bore*0.34;
    var pZ = bx ? -caseW*0.22 : -(caseW*0.5+bore*0.24);
    var pr=bore*0.19, nSt=4, stL=bore*0.20, pFront=tcF-bore*0.04;
    for(i=0;i<nSt;i++){
      B.add("malu", CYL(pr,pr,stL,16), pFront-stL*(i+0.5), pY, pZ, 0,0,PI/2);
      B.add("malu", BOX(bore*0.04, pr*2.3, pr*2.3), pFront-stL*i, pY, pZ);
    }
    var xD=tcF+bore*0.14, rPD=bore*0.24;
    B.add("steel", CYL(bore*0.08,bore*0.08,xD-pFront+bore*0.04,10), (xD+pFront)/2, pY, pZ, 0,0,PI/2);
    var dcp=pulleyMesh(bore*0.26, bore*0.12, null, {cog:true, bolts:0}); dcp.position.set(xD,0,0); extras.push(dcp); anim.spin.push({o:dcp, axis:"x", k:1});
    var dpp=pulleyMesh(rPD, bore*0.12, null, {cog:true}); dpp.position.set(xD,pY,pZ); extras.push(dpp); anim.spin.push({o:dpp, axis:"x", k:(bore*0.26)/rPD});
    extras.push(beltMesh(xD, [{y:0,z:0,r:bore*0.26,side:1},{y:pY,z:pZ,r:rPD,side:1}], bore*0.02, bore*0.04, {w:bore*0.10, t:bore*0.04, cog:bore*0.06}));
    /* remote tank + lines */
    var tX = bx ? -(bankLen*0.5+bore*0.95) : -bankLen*0.12;
    var tZ = bx ? -bore*1.55 : -(caseW*0.72+bore*0.42);
    var tB = p.panTop - (bx? bore*0.10 : 0), tH = p.stroke*1.35;
    B.add("malu", CYL(bore*0.38,bore*0.38,tH,20), tX, tB+tH*0.5, tZ);
    B.add("malu", CYL(bore*0.40,bore*0.40,bore*0.05,20), tX, tB+tH+bore*0.02, tZ);
    B.add("dark", CYL(bore*0.10,bore*0.10,bore*0.09,10), tX, tB+tH+bore*0.08, tZ);
    var pBack=pFront-stL*nSt;
    extras.push(hoseMesh([ V3(pBack+stL*0.5, pY-pr, pZ), V3((pBack+tX)/2, pY-pr-bore*0.25, (pZ+tZ)/2), V3(tX, tB+tH*0.30, tZ+(tZ<0?bore*0.38:-bore*0.38)) ], bore*0.07));
    extras.push(hoseMesh([ V3(tX, tB+tH*0.85, tZ+(tZ<0?bore*0.36:-bore*0.36)), V3((pBack+tX)/2, pY+bore*0.45, (pZ+tZ)/2), V3(pBack+stL*1.5, pY+pr, pZ) ], bore*0.07));
  }

  /* ---- single central timing cover for a cam-in-block V (buildBank skips its per-bank one) ---- */
  if(ve && (p.head==="pushrod2v" || p.head==="billet_hemi")){
    var tTop=deckH*ca*0.62+bore*0.30, tBot=-caseH*0.62;
    B.add("calu", RBOX(bore*0.16, tTop-tBot, bore*1.50, 0.04), bankLen*0.5+bore*0.08, (tTop+tBot)/2, 0);
  }
}

/* ===========================================================================
   7f. FIDELITY DETAIL (Full / Ultra): cast lettering, tags, wiring trunk, PCV,
       throttle actuators. Lite never reaches this code (DET = 0).
   ==========================================================================*/
function PLANE(w,h){
  var key=gkey("pl",r3(w),r3(h));
  if(!GEO[key]) cache(key, new THREE.PlaneGeometry(w,h));
  return GEO[key];
}
function DISC(r){   /* flat disc facing +Z, uv 0..1 across it (turned faces) */
  var key=gkey("dk",r3(r));
  if(!GEO[key]) cache(key, new THREE.CircleGeometry(r, 28));
  return GEO[key];
}
/* screw-on filler cap: turned top, rolled rim, six grip lugs (y = top of the cap) */
function capDetail(B, x, y, z, r, bore){
  B.add("turned", DISC(r*0.80), x, y+0.002, z, -PI/2,0,0);
  B.add("malu", TOR(r*0.88, bore*0.018, 5, 22), x, y-bore*0.004, z, PI/2,0,0);
  for(var i=0;i<6;i++){ var a=i/6*TAU; B.add("malu", BOX(r*0.24, bore*0.05, r*0.16), x+Math.cos(a)*r*0.98, y-bore*0.03, z+Math.sin(a)*r*0.98, 0,-a,0); }
}
var FIRING = { I3:"1-2-3", I4:"1-3-4-2", I5:"1-2-4-5-3", I6:"1-5-3-6-2-4", V6:"1-2-3-4-5-6", V8:"1-8-4-3-6-5-7-2",
               V8F:"1-5-4-8-6-3-7-2", V10:"1-6-5-10-2-7-3-8-4-9", V12:"1-7-5-11-3-9-6-12-2-8-4-10", F4:"1-3-2-4", F6:"1-6-2-4-3-5" };
function decalMat(base, mask, o){
  var m=base.clone(); m.userData={hi:true, perBuild:!!o.perBuild};
  m.alphaMap=mask.mask; m.alphaTest=0.5; m.normalMap=mask.normal; m.normalScale=new THREE.Vector2(o.ns||1.4, o.ns||1.4);
  m.polygonOffset=true; m.polygonOffsetFactor=-2; m.polygonOffsetUnits=-2;
  if(o.color!==undefined) m.color=sc(o.color);
  if(o.perBuild && !o.sharedMaps) m.userData.ownMaps=[mask.mask, mask.normal];
  return m;
}
var LOGO_MAT=null;
function heavyFont(px){ return "900 "+Math.round(px)+"px Impact, 'Arial Black', 'Helvetica Neue', Arial, sans-serif"; }
/* raised, machined "PRAIRIE ENGINE WORKS" cast into the cam cover */
function logoMat(){
  if(LOGO_MAT) return LOGO_MAT;
  var mk=castMaskMaps(1024,136,function(x,w,h){
    x.font=heavyFont(h*0.70); x.textAlign="center"; x.textBaseline="middle";
    x.fillText("PRAIRIE  ENGINE  WORKS", w/2, h*0.54, w*0.84);
    x.fillRect(w*0.01, h*0.40, w*0.055, h*0.22); x.fillRect(w*0.935, h*0.40, w*0.055, h*0.22);
  }, 3.5);
  LOGO_MAT=decalMat(MATHI.malu, mk, {ns:1.6});
  return LOGO_MAT;
}
/* riveted firing-order tag (stamped text on brushed aluminium); texture cached per string */
function plateMat(fo, sub){
  var t=lruGet("plate|"+fo+"|"+sub, function(){ return [plateTex(fo, sub)]; })[0];
  var m=new THREE.MeshStandardMaterial({map:t, roughness:0.42, metalness:0.75, envMapIntensity:1.1, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2});
  m.userData={hi:true, perBuild:true};
  return m;
}
function plateTex(fo, sub){
  var c=newCanvas(384,160), x=c.getContext("2d"), w=384, h=160, i;
  var g=x.createLinearGradient(0,0,w,0); g.addColorStop(0,"#b9bdc1"); g.addColorStop(0.5,"#d6d9dc"); g.addColorStop(1,"#b3b7bb");
  x.fillStyle=g; x.fillRect(0,0,w,h);
  x.globalAlpha=0.18; for(i=0;i<160;i+=2){ x.fillStyle=i%4?"#ffffff":"#7a7e82"; x.fillRect(0,i,w,1); } x.globalAlpha=1;
  x.strokeStyle="#4a4e52"; x.lineWidth=5; x.strokeRect(10,10,w-20,h-20);
  x.fillStyle="#6d7176"; [[24,24],[w-24,24],[24,h-24],[w-24,h-24]].forEach(function(q){ x.beginPath(); x.arc(q[0],q[1],7,0,TAU); x.fill(); });
  x.fillStyle="#1d2024"; x.textAlign="center"; x.textBaseline="middle";
  x.font="700 19px 'Arial Narrow', Arial, sans-serif"; x.fillText("PRAIRIE ENGINE WORKS  ·  FIRING ORDER", w/2, 36, w-70);
  x.font=heavyFont(fo.length>14?40:54); x.fillText(fo, w/2, 86, w-60);
  x.font="700 17px 'Arial Narrow', Arial, sans-serif"; x.fillText(sub, w/2, 130, w-70);
  var t=tex(c,true); t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
  return t;
}
/* per-string texture cache (a slider drag rebuilds the engine every step; the text only changes per 0.1 L).
   The previous engine is disposed before the next is built, so evicting any entry but the newest is safe. */
var TEXT_LRU=[];
function lruGet(key, make){
  for(var i=0;i<TEXT_LRU.length;i++) if(TEXT_LRU[i].k===key){ var e=TEXT_LRU.splice(i,1)[0]; TEXT_LRU.push(e); return e.v; }
  var v=make(); TEXT_LRU.push({k:key, v:v});
  while(TEXT_LRU.length>8){ var old=TEXT_LRU.shift(); old.v.forEach(function(t){ t.dispose(); }); }
  return v;
}
/* foundry mark + displacement cast into the crankcase side, in the block's own material */
function blockMarkMat(blockKey, disp){
  var mk=lruGet("mark|"+disp, function(){ var q=castMaskMaps(320,80,function(x,w,h){
    x.lineWidth=h*0.075; x.beginPath(); x.ellipse(h*0.70, h*0.5, h*0.58, h*0.38, 0, 0, TAU); x.stroke();
    x.font=heavyFont(h*0.36); x.textAlign="center"; x.textBaseline="middle"; x.fillText("PEW", h*0.70, h*0.53);
    x.font=heavyFont(h*0.66); x.fillText(disp, w*0.66, h*0.54, w*0.58);
  }, 3.0); return [q.mask, q.normal]; });
  return decalMat(MATHI[blockKey]||MATHI.iron, {mask:mk[0], normal:mk[1]}, {ns:1.3, perBuild:true, sharedMaps:true});
}
/* part number cast into the other crankcase flank (a different string for each block material, so no two blocks share it) */
function castNumMat(blockKey){
  var no={iron:"3 7 4 8 0 2", calu:"5 5 2 1 1 9", cgi:"8 8 0 6 4 1"}[blockKey]||"3 7 4 8 0 2";
  var mk=lruGet("castno|"+no, function(){ var q=castMaskMaps(320,56,function(x,w,h){
    x.font=heavyFont(h*0.62); x.textAlign="left"; x.textBaseline="middle"; x.fillText("PEW", w*0.02, h*0.52, w*0.2);
    x.font=heavyFont(h*0.62); x.fillText(no, w*0.27, h*0.52, w*0.70);
  }, 2.6); return [q.mask, q.normal]; });
  return decalMat(MATHI[blockKey]||MATHI.iron, {mask:mk[0], normal:mk[1]}, {ns:1.2, perBuild:true, sharedMaps:true});
}
/* little oil-grade sticker on the valve cover (printed, not cast; texture cached) */
function stickerMat(){
  var t=lruGet("sticker|oil", function(){
    var c=newCanvas(192,128), x=c.getContext("2d"), w=192, h=128;
    x.fillStyle="#d8b24a"; x.fillRect(0,0,w,h);
    x.strokeStyle="#2a2418"; x.lineWidth=6; x.strokeRect(5,5,w-10,h-10);
    x.fillStyle="#2a2418"; x.textAlign="center"; x.textBaseline="middle";
    x.font="700 17px 'Arial Narrow', Arial, sans-serif"; x.fillText("SYNTHETIC ONLY", w/2, 28, w-24);
    x.font=heavyFont(50); x.fillText("5W-30", w/2, 70, w-26);
    x.font="700 14px 'Arial Narrow', Arial, sans-serif"; x.fillText("CHECK OIL EVERY FILL-UP", w/2, 106, w-24);
    var tx=tex(c,true); tx.wrapS=tx.wrapT=THREE.ClampToEdgeWrapping; return [tx];
  })[0];
  var m=new THREE.MeshStandardMaterial({map:t, roughness:0.55, metalness:0.05, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2});
  m.userData={hi:true, perBuild:true};
  return m;
}
/* cast name on the cover's outboard wall, and the firing-order tag behind it (bank space) */
function coverDecor(B, p, c){
  var bore=p.bore, zs=c.zs, covY=c.covY, covW=c.covW, covL=c.covL, coverH=c.coverH, wallZ, wy, wh;
  if(p.pushrod){ wallZ=covW*0.5; wy=covY+coverH*0.44; wh=coverH*0.30; }
  else if(p.sohc){ wallZ=covW*0.5; wy=covY+coverH*0.27; wh=coverH*0.28; }
  else if(p.head==="billet_hemi"){ wallZ=covW*0.49; wy=covY+coverH*0.22; wh=coverH*0.18; }
  else { wallZ=covW*0.5; wy=covY+coverH*0.27; wh=coverH*0.27; }
  var ry=zs>0?0:PI, wz=function(d){ return (wallZ+d)*zs; };
  DECALS.decalLogo=logoMat();
  var lw=Math.min(covL*0.52, wh*7.53), lx=covL*0.10;
  B.add("decalLogo", PLANE(lw, lw/7.53), lx, wy, wz(0.004), 0, ry, 0);
  if(p.pushrod){   /* and across the crown */
    var cw=covL*0.42;
    B.add("decalLogo", PLANE(cw, cw/7.53), 0, covY+coverH*1.04+0.004, 0, -PI/2, 0, zs>0?0:PI);   /* reads from the outboard side */
  }
  /* firing-order tag toward the flywheel end */
  var D=DCTX, fo=FIRING[D.L.key]||FIRING.I4, disp=(D.n*PI/4*Math.pow(pick(D.cfg.bore,86),2)*pick(D.cfg.stroke,86)/1e6);
  var pw=clamp(covL*0.17, bore*0.55, bore*0.85), ph=Math.min(pw*0.42, coverH*0.40), px=-covL*0.48+pw*0.55;
  B.add("palu", BOX(pw, ph, bore*0.014), px, wy, wz(0.007), 0, 0, 0);
  DECALS.decalPlate=DECALS.decalPlate||plateMat(fo, D.n+" CYL  ·  "+disp.toFixed(1)+" L  ·  SASKATOON SK");
  B.add("decalPlate", PLANE(pw*0.98, ph*0.98), px, wy, wz(0.0145), 0, ry, 0);
  if(DET>=2) [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(q){ B.hw("rivet", px+q[0]*pw*0.42, wy+q[1]*ph*0.34, wz(0.014), 0,0,0, bore*0.028); });
  /* oil-grade sticker toward the front end of the same wall (clear of the cast name, which ends near 0.36 of the cover) */
  var sw=Math.min(covL*0.11, wh*1.15, bore*0.8), sh=sw*0.667;
  DECALS.decalSticker=DECALS.decalSticker||stickerMat();
  B.add("decalSticker", PLANE(sw, sh), covL*0.425, wy, wz(0.005), 0, ry, 0);
}
/* after intake / aspiration / FAD: harness trunk + main connector, PCV, throttle actuator, crankcase mark */
function buildDetailPost(B, c){
  var bore=c.bore, L=c.L, bankLen=c.bankLen, i, bi;
  setZone(0);
  /* ---- harness: every loom tail joins a trunk at the back of the engine, ending in the main connector ---- */
  var mc = L.boxer ? V3(-bankLen*0.5-bore*0.25, bore*1.30, 0)
         : L.vee   ? V3(-bankLen*0.5-bore*0.25, c.deckH*Math.cos(c.a)*0.66, 0)
                   : V3(-bankLen*0.5-bore*0.25, c.deckH*0.66, -c.bankW*0.30);
  var ends=[];
  for(i=0;i<c.bankInfo.length;i++){ bi=c.bankInfo[i]; if(bi.coilLoomEnd) ends.push(bi.coilLoomEnd); if(bi.injLoomEnd) ends.push(bi.injLoomEnd); }
  if(ends.length){
    for(i=0;i<ends.length;i++){
      var e=ends[i], mid=V3((e.x+mc.x)*0.5-bore*0.08, Math.max(e.y, mc.y)+bore*0.05, (e.z+mc.z)*0.5);
      B.addW("loom", uvByLength(TUBE([e, mid, mc.clone().add(V3(0, bore*0.10, 0))], bore*(i?0.034:0.042), 18, 6), 1/1.4));
    }
    B.add("connGrey", RBOX(bore*0.20, bore*0.26, bore*0.34, 0.02), mc.x, mc.y, mc.z);
    B.add("connGrey", RBOX(bore*0.22, bore*0.10, bore*0.36, 0.02), mc.x-bore*0.12, mc.y, mc.z);
    B.add("dark", BOX(bore*0.05, bore*0.20, bore*0.06), mc.x-bore*0.06, mc.y+bore*0.03, mc.z+bore*0.20);
    B.add("steel", BOX(bore*0.36, bore*0.03, bore*0.30), mc.x+bore*0.18, mc.y-bore*0.15, mc.z);   /* bracket to the block's rear face */
    B.add("steel", BOX(bore*0.03, bore*0.22, bore*0.30), mc.x+bore*0.35, mc.y-bore*0.05, mc.z);
    B.hw("hex", mc.x+bore*0.26, mc.y-bore*0.13, mc.z, 0,0,0, bore*0.08);
    /* chassis-side pigtail out of the connector, dropping toward the bulkhead */
    B.addW("loom", uvByLength(TUBE([mc.clone().add(V3(-bore*0.20,0,0)), mc.clone().add(V3(-bore*0.24,-bore*0.18,0)), mc.clone().add(V3(-bore*0.20,-bore*0.60,0))], bore*0.045, 10, 6), 1/1.4));
  }
  /* ---- PCV: valve in the bank-0 cover, hose to the plenum (or a breather filter when there is none) ---- */
  bi=c.bankInfo[0];
  if(bi){
    var zsP=bi.zs, covTopL=bi.covTop, pcvL=V3(-bankLen*0.34, covTopL-bore*0.02, -zsP*bi.covW*0.22);
    if(c.pushrod) pcvL.y=bi.covY+bi.coverH*0.82; else if(c.sohc) pcvL.y=bi.covY+bi.coverH*0.55; else if(c.head!=="billet_hemi") pcvL.y=bi.covY+bi.coverH*0.48+bore*0.02;
    if(c.head==="billet_hemi"){ pcvL.y=bi.covY+bi.coverH*0.36; pcvL.z=-zsP*bi.covW*0.47; }
    var pv=pcvL.clone().applyMatrix4(bi.matrix), up=V3(0,1,0).transformDirection(bi.matrix);
    B.add("rubberFlat", CYL(bore*0.075,bore*0.075,bore*0.05,12), pv.x, pv.y+bore*0.01, pv.z);
    B.add("blackPlast", CYL(bore*0.045,bore*0.055,bore*0.14,10), pv.x, pv.y+bore*0.09, pv.z);
    var pl=LAST_PLEN, a0=V3(pv.x, pv.y+bore*0.16, pv.z), tgt;
    var blownP=(c.asp==="roots"||c.asp==="screw");
    if(pl && blownP){
      /* the blower sits on the manifold roof: tee into the manifold's side */
      tgt=V3(pl.x-pl.len*0.30, (pl.top+pl.bot)*0.5, pl.z-zsP*(pl.w*0.5+bore*0.03));
      B.add("blackPlast", CYL(bore*0.05,bore*0.05,bore*0.10,10), tgt.x, tgt.y, tgt.z+zsP*bore*0.02, PI/2,0,0);
      hoseMesh([a0, V3(a0.x, a0.y+bore*0.20, a0.z), V3(tgt.x, tgt.y+bore*0.25, tgt.z-zsP*bore*0.20), V3(tgt.x, tgt.y, tgt.z-zsP*bore*0.08)], bore*0.058);
    } else if(pl && c.intake!=="itb"){
      tgt=V3(pl.x-pl.len*0.30, pl.top+bore*0.02, pl.z + (Math.abs(pl.z)>bore*0.2 ? 0 : -zsP*pl.w*0.25));
      B.add("blackPlast", CYL(bore*0.05,bore*0.05,bore*0.08,10), tgt.x, tgt.y+bore*0.03, tgt.z);
      hoseMesh([a0, V3(a0.x, Math.max(a0.y,tgt.y)+bore*0.22, (a0.z+tgt.z)*0.5), V3(tgt.x, tgt.y+bore*0.18, tgt.z), V3(tgt.x, tgt.y+bore*0.06, tgt.z)], bore*0.058);
    } else {
      /* ITB / no plenum: vented to a little breather filter */
      tgt=V3(a0.x-bore*0.30, a0.y+bore*0.14, a0.z);
      hoseMesh([a0, V3(a0.x-bore*0.08, a0.y+bore*0.14, a0.z), tgt], bore*0.058);
      B.add("dark", CYL(bore*0.11,bore*0.11,bore*0.20,12), tgt.x-bore*0.08, tgt.y, tgt.z, 0,0,PI/2);
      B.add("chrome", CYL(bore*0.115,bore*0.115,bore*0.03,12), tgt.x-bore*0.19, tgt.y, tgt.z, 0,0,PI/2);
    }
  }
  /* ---- throttle actuator: drive-by-wire motor on a throttle body, cable drum on carbs ---- */
  var tb = (c.aspInfo && c.aspInfo.tb) || LAST_TB;
  if(tb && c.intake!=="carb" && Math.abs(tb.dir.y)<0.5){   /* not on a blower hat / upright inlet */
    var d=tb.dir, side=(Math.abs(d.x)>0.5) ? V3(0,0,1) : V3(1,0,0), q=tb.pt.clone().addScaledVector(d, -bore*0.20);
    var mp=q.clone().addScaledVector(side, bore*0.36);
    B.add("dark", RBOX(Math.abs(d.x)>0.5?bore*0.18:bore*0.26, bore*0.20, Math.abs(d.x)>0.5?bore*0.26:bore*0.18, 0.02), mp.x, mp.y+bore*0.02, mp.z);
    B.add("connGrey", BOX(bore*0.10, bore*0.08, bore*0.10), mp.x, mp.y+bore*0.16, mp.z);
    if(DET>=2) B.addW("wireBlk", TUBE([V3(mp.x, mp.y+bore*0.20, mp.z), V3(mp.x-bore*0.20, mp.y+bore*0.36, mp.z), V3(mp.x-bore*0.60, mp.y+bore*0.30, mp.z*0.8)], bore*0.013, 10, 4));
  }
  /* ---- the foundry mark on the -Z crankcase flank ---- */
  if(!L.boxer){
    setZone(2);
    var disp=(c.cfg && c.per) ? (DCTX.n*PI/4*Math.pow(pick(c.cfg.bore,86),2)*pick(c.cfg.stroke,86)/1e6) : 2.0;
    DECALS.decalBlock=blockMarkMat(c.blockKey, disp.toFixed(1)+" L");
    var mh=bore*0.34, mw=mh*4, caseSpan=c.caseTop-c.caseBot;
    B.add("decalBlock", PLANE(mw, mh), -bankLen*0.28, c.caseBot+caseSpan*0.66, -(c.caseW*0.5+0.004), 0, PI, 0);
    /* casting number on the opposite flank, low and toward the rear */
    DECALS.decalCastNo=castNumMat(c.blockKey);
    var nh=bore*0.13;
    B.add("decalCastNo", PLANE(nh*5.7, nh), -bankLen*0.22, c.caseBot+caseSpan*0.30, c.caseW*0.5+0.004, 0, 0, 0);
  }
  setZone(0);
  engineDetail(B, c, mc);
}

