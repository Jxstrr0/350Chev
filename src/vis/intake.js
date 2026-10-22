/* ===========================================================================
   7c. INTAKE
   ==========================================================================*/
function buildIntake(B, p, extras){
  var L=p.L, per=p.per, banks=p.banks, bore=p.bore, bankLen=p.bankLen;
  var bspace=p.bspace, intake=p.intake, a=p.a;
  var bi0=p.bankInfo[0];
  if(!bi0) return;

  /* Where the intake lives: inline -> -Z flank; V -> the valley; boxer -> above */
  var vee = L.vee, boxer = L.boxer;
  var blown = (p.asp==="roots" || p.asp==="screw"), boosted = (p.asp!=="na");
  if(blown && intake==="itb") intake = "plenum_short";     /* a blower needs a manifold under it */
  if(boxer && boosted && intake==="itb") intake = "plenum_short";   /* boxer stacks sit on two separate heads: no single boost box */
  var valleyY = boxer ? bore*0.85 : (p.deckH + p.headH*0.92)*Math.cos(a);

  if(intake==="itb" && (vee||boxer)){
    /* V / boxer: stacks stand vertically out of the valley, runners curve down to the ports */
    /* stacks stand clear above the valley-side ports (vee) or straight up off each head (boxer) */
    var pY0 = new THREE.Vector3(0, bi0.headY+p.headH*0.55, -bi0.zs*(bi0.headW*0.52)).applyMatrix4(new THREE.Matrix4().makeRotationX(a)).y;
    var vTop = boxer ? pY0 + bore*0.60 : Math.max(valleyY + bore*0.30, pY0 + bore*0.55);
    for(var vb=0; vb<banks; vb++){
      var vbi=p.bankInfo[vb], vzs=vbi.zs;
      var bmv=new THREE.Matrix4().makeRotationX(banks===1?0:(vb===0? a : -a));
      for(var vc=0; vc<per; vc++){
        var vx=-bankLen/2 + bspace*(vc+0.5);
        /* runner: out of the port along its axis, then up into the stack */
        var port = new THREE.Vector3(vx, vbi.headY+p.headH*0.55, -vzs*(vbi.headW*0.52)).applyMatrix4(bmv);
        var pDir = new THREE.Vector3(0,0,-vzs).applyMatrix4(bmv);
        var stZ  = boxer ? port.z : vzs*bore*0.46;
        var mid  = port.clone().addScaledVector(pDir, bore*0.28);
        var top  = V3(vx, vTop-bore*0.06, stZ);
        extras.push(meshB(TUBE([port,mid,top], bore*0.165, 16, 10), MAT.anod));
        /* throttle body + velocity stack */
        B.add("anod", CYL(bore*0.205,bore*0.205,bore*0.20,16,false,2.2), vx, vTop+bore*0.08, stZ);
        B.add("malu", CONE(bore*0.31,bore*0.19,bore*0.26,18,2.2), vx, vTop+bore*0.31, stZ);
        B.add("malu", TOR(bore*0.31, bore*0.028, 6, 20, 2.2), vx, vTop+bore*0.44, stZ, PI/2,0,0);
      }
      /* throttle linkage shaft down the bank */
      B.add("steel", CYL(bore*0.026,bore*0.026,bankLen*0.96,8,false,3.0), 0, vTop-bore*0.02, boxer ? stZ+vzs*bore*0.30 : stZ*1.55, 0,0,PI/2);
    }
    /* optional shared airbox: a slim open frame around the trumpets */
    if(per>=5){
      var abY=vTop+bore*0.56, abW=(boxer?bi0.headW*0.55:bore*0.80)+bore*0.30;
      var abK = DET ? "carbon" : "anod";   /* race airbox: carbon at Full / Ultra */
      B.add(abK, BOX(bankLen*1.02, bore*0.09, bore*0.14), 0, abY,  abW);
      B.add(abK, BOX(bankLen*1.02, bore*0.09, bore*0.14), 0, abY, -abW);
      B.add(abK, BOX(bore*0.14, bore*0.09, abW*2.1), bankLen*0.51, abY, 0);
      B.add(abK, BOX(bore*0.14, bore*0.09, abW*2.1), -bankLen*0.51, abY, 0);
    }
    if(boosted){
      /* boost box: a sealed plenum over the trumpets, throttle on its nose */
      var bxW = 2*(boxer ? bi0.headW*0.34 : bore*0.46) + bore*0.95;
      B.add("anod", RBOX(bankLen*1.0, bore*0.80, bxW, 0.06), 0, vTop+bore*0.40, 0);
      B.add("malu", CYL(bore*0.30,bore*0.30,bore*0.28,18), bankLen*0.5+bore*0.14, vTop+bore*0.40, 0, 0,0,PI/2);
      LAST_TB = {pt:V3(bankLen*0.5+bore*0.30, vTop+bore*0.40, 0), dir:V3(1,0,0)};
    }
    return;
  }

  if(intake==="itb"){
    /* per-cylinder throttle bodies + velocity stacks */
    for(var bk=0; bk<banks; bk++){
      var bi=p.bankInfo[bk];
      var bm=new THREE.Matrix4().makeRotationX(banks===1?0:(bk===0? a : -a));
      B.push(bm);
      var zs=bi.zs;
      var stackZ = -zs*(bi.headW*0.50 + bore*0.30);
      for(var i=0;i<per;i++){
        var x=-bankLen/2 + bspace*(i+0.5);
        /* runner from the port */
        B.add("malu", CYL(bore*0.17,bore*0.17,bore*0.30,14,false,2.2), x, bi.headY+p.headH*0.55, -zs*(bi.headW*0.50+bore*0.14), -zs*PI/2,0,0);
        /* throttle body */
        B.add("anod", CYL(bore*0.21,bore*0.21,bore*0.16,16,false,2.2), x, bi.headY+p.headH*0.55, stackZ, -zs*PI/2,0,0);
        /* velocity stack (flared trumpet) */
        B.add("malu", CONE(bore*0.30,bore*0.19,bore*0.24,18,2.2), x, bi.headY+p.headH*0.55, stackZ-zs*bore*0.20, -zs*PI/2,0,0);
        B.add("malu", TOR(bore*0.30, bore*0.028, 6, 20, 2.2), x, bi.headY+p.headH*0.55, stackZ-zs*bore*0.32, 0,0,0);
        /* linkage rod */
        if(i===0) B.add("steel", CYL(bore*0.022,bore*0.022,bankLen*0.95,8,false,3.0), 0, bi.headY+p.headH*0.30, stackZ, 0,0,PI/2);
        if(DET){ B.add("steel", BOX(bore*0.03, bore*0.14, bore*0.03), x+bore*0.05, bi.headY+p.headH*0.42, stackZ); }   /* throttle arm per stack */
      }
      if(DET){
        /* bell-crank + cable drum at the front of the shaft */
        B.add("steel", CYL(bore*0.11,bore*0.11,bore*0.03,16), bankLen*0.49, bi.headY+p.headH*0.30, stackZ, 0,0,PI/2);
        B.add("steel", BOX(bore*0.03, bore*0.22, bore*0.04), bankLen*0.50, bi.headY+p.headH*0.30-bore*0.10, stackZ);
      }
      B.pop();
    }
    if(boosted){
      /* boost box around the stacks (inline), throttle on its nose */
      var sZ = -(bi0.headW*0.50 + bore*0.52);
      B.add("anod", RBOX(bankLen*1.0, bore*0.85, bore*0.80, 0.06), 0, bi0.headY+p.headH*0.55, sZ);
      B.add("malu", CYL(bore*0.28,bore*0.28,bore*0.26,18), bankLen*0.5+bore*0.13, bi0.headY+p.headH*0.55, sZ, 0,0,PI/2);
      LAST_TB = {pt:V3(bankLen*0.5+bore*0.28, bi0.headY+p.headH*0.55, sZ), dir:V3(1,0,0)};
    }
    /* optional shared airbox: a slim open tray around the trumpets */
    if(vee && per>=5){
      var abY=valleyY+bore*0.62, abW=bi0.headW*1.02;
      var abK2 = DET ? "carbon" : "anod";
      B.add(abK2, BOX(bankLen*1.02, bore*0.10, bore*0.16), 0, abY,  abW);
      B.add(abK2, BOX(bankLen*1.02, bore*0.10, bore*0.16), 0, abY, -abW);
      B.add(abK2, BOX(bore*0.16, bore*0.10, abW*2), bankLen*0.51, abY, 0);
      B.add(abK2, BOX(bore*0.16, bore*0.10, abW*2), -bankLen*0.51, abY, 0);
    }
    return;
  }

  if(intake==="carb"){
    var carbY, carbZ=0;
    if(vee || boxer){ carbY = valleyY + bore*0.30; }
    else { carbY = Math.max(bi0.headY + p.headH + p.coverH*0.20, bi0.covTop - bore*0.40); carbZ = -(bi0.headW*0.55 + bore*0.42); }   /* cleaner base clears the cam cover it overhangs */
    /* intake manifold body */
    if(vee||boxer){
      /* tall single-plane manifold that lets the V read */
      B.add("calu", RBOX(bankLen*0.80, bore*0.30, bi0.headW*1.06, 0.05), 0, carbY-bore*0.42, 0);
      B.add("calu", RBOX(bankLen*0.50, bore*0.34, bi0.headW*0.72, 0.05), 0, carbY-bore*0.14, 0);
      /* runners fanning out to each head */
      for(var rb=0; rb<banks; rb++){
        var rbi=p.bankInfo[rb], rzs=rbi.zs;
        var rM=new THREE.Matrix4().makeRotationX(banks===1?0:(rb===0?a:-a));
        for(var rc=0; rc<per; rc++){
          var rxp=-bankLen/2+bspace*(rc+0.5);
          var rPort=new THREE.Vector3(rxp, rbi.headY+p.headH*0.50, -rzs*(rbi.headW*0.50)).applyMatrix4(rM);
          var rTop=V3(rxp*0.85, carbY-bore*0.42, rzs*bi0.headW*0.30);
          extras.push(meshB(TUBE([rTop, V3(rxp, (rTop.y+rPort.y)*0.5+bore*0.06, (rTop.z+rPort.z)*0.5), rPort], bore*0.15, 12, 9), MAT.calu));
        }
      }
    }
    else {
      /* inline: log manifold along the head with a runner into every port, riser up to the carb pad */
      var lgZ = -(bi0.headW*0.50 + bore*0.46), lgY = bi0.headY + p.headH*0.45;
      B.add("calu", RBOX(bankLen*0.80, bore*0.34, bore*0.42, 0.05), 0, lgY, lgZ);
      for(var lk=0; lk<per; lk++){
        var lkx=-bankLen/2 + bspace*(lk+0.5);
        extras.push(meshB(TUBE([V3(lkx*0.8, lgY+bore*0.04, lgZ+bore*0.12), V3(lkx, bi0.headY+p.headH*0.50, -(bi0.headW*0.50+bore*0.14)), V3(lkx, bi0.headY+p.headH*0.50, -(bi0.headW*0.50))], bore*0.14, 10, 9), MAT.calu));
      }
      B.add("calu", RBOX(bore*0.50, Math.max(bore*0.2, carbY-lgY), bore*0.50, 0.04), 0, (carbY+lgY)*0.5-bore*0.02, carbZ);
      B.add("calu", RBOX(bankLen*0.40, bore*0.30, bore*0.30, 0.04), 0, lgY, (lgZ+carbZ)*0.5);
    }
    LAST_PLEN = (vee||boxer) ? {x:0, z:0, top:carbY+bore*0.03, bot:carbY-bore*0.57, len:bankLen*0.50, w:bi0.headW*0.72}
                             : {x:0, z:carbZ, top:carbY+bore*0.03, bot:carbY-bore*0.27, len:bankLen*0.66, w:bore*0.75};
    if(blown) return;   /* the blower carries the hat instead */
    LAST_PLEN = null;
    if(boosted) LAST_TB = {pt:V3(bore*1.40, carbY+bore*0.62, carbZ), dir:V3(1,0,0)};   /* blow-through hat: side inlet on the cleaner */
    /* carb body + air cleaner */
    B.add("malu", RBOX(bore*0.52, bore*0.34, bore*0.52, 0.03), 0, carbY+bore*0.16, carbZ);
    if(DET){
      /* throttle linkage on the carb's front face: cable drum, return spring, cable bracket */
      B.add("steel", CYL(bore*0.10,bore*0.10,bore*0.03,16), bore*0.29, carbY+bore*0.12, carbZ-bore*0.08, 0,0,PI/2);
      B.add("steel", BOX(bore*0.02, bore*0.16, bore*0.05), bore*0.31, carbY+bore*0.05, carbZ-bore*0.12, 0.6,0,0);
      B.add("steel", BOX(bore*0.03, bore*0.05, bore*0.30), bore*0.30, carbY+bore*0.02, carbZ+bore*0.10);
      var spr=[]; for(var ks=0; ks<=24; ks++){ var fk=ks/24; spr.push(B.pt(bore*0.33, carbY+bore*0.10-fk*bore*0.14, carbZ-bore*0.12+fk*bore*0.20+Math.sin(fk*TAU*5)*bore*0.012)); }
      B.addW("steel", TUBE(spr, bore*0.008, 48, 4));
      hoseMesh([B.pt(bore*0.30, carbY+bore*0.02, carbZ+bore*0.25), B.pt(bore*0.50, carbY-bore*0.05, carbZ+bore*0.40), B.pt(bore*0.95, carbY-bore*0.25, carbZ+bore*0.45)], bore*0.018, MAT.dark);
      B.add("brass", CYL(bore*0.03,bore*0.03,bore*0.12,8), -bore*0.30, carbY+bore*0.10, carbZ, 0,0,PI/2);   /* fuel inlet */
    }
    B.add("malu", CYL(bore*0.24,bore*0.24,bore*0.14,16), -bore*0.13, carbY+bore*0.38, carbZ);
    B.add("malu", CYL(bore*0.24,bore*0.24,bore*0.14,16),  bore*0.13, carbY+bore*0.38, carbZ);
    /* chrome air cleaner lid + filter element */
    B.add("blackPlast", CYL(bore*1.32,bore*1.32,bore*0.30,30,true,2.0), 0, carbY+bore*0.62, carbZ);
    B.add("chrome", CYL(bore*1.38,bore*1.10,bore*0.11,32), 0, carbY+bore*0.80, carbZ);
    B.add("chrome", CYL(bore*1.38,bore*1.38,bore*0.05,32), 0, carbY+bore*0.46, carbZ);
    B.add("chrome", CYL(bore*0.09,bore*0.09,bore*0.12,10), 0, carbY+bore*0.90, carbZ);
    return;
  }

  /* plenum-based intakes: single_tb / plenum_long / plenum_short */
  var longR = (intake==="plenum_long");
  var shortR= (intake==="plenum_short");
  var plenR = shortR ? bore*0.52 : bore*0.40;

  if(vee || boxer){
    if(blown){ longR=false; shortR=false; }
    var py = blown ? valleyY + bore*0.20 : valleyY + (longR? bore*0.95 : bore*0.55);
    var plenL = bankLen*0.86;
    var plW = blown ? bi0.headW*1.0 : bi0.headW*(shortR?1.40:1.15), plH = blown ? bore*0.36 : bore*(shortR?0.62:0.46);
    if(vee){
      /* a 60° valley is too narrow for this plenum at deck height: lift it until its underside clears
         bank 0's inner head / cam-cover profile inside the plenum footprint (bank 1 mirrors it) */
      var sa=Math.sin(a), ca=Math.cos(a), hw=plW*0.5+bore*0.04, clr=-1e9;
      var prof=[[bi0.headY,-bi0.headW*0.5],[bi0.covY,-bi0.headW*0.5],[bi0.covY,-bi0.covW*0.55],[bi0.covY+bi0.coverH*1.10,-bi0.covW*0.55],[bi0.covY+bi0.coverH*1.10,0]];
      var W=prof.map(function(q){ return [q[0]*ca - q[1]*sa, q[0]*sa + q[1]*ca]; });
      for(var qi=0; qi<W.length; qi++){
        if(W[qi][1] <= hw) clr=Math.max(clr, W[qi][0]);
        if(qi && (W[qi-1][1]-hw)*(W[qi][1]-hw) < 0){ var tq=(hw-W[qi-1][1])/(W[qi][1]-W[qi-1][1]); clr=Math.max(clr, W[qi-1][0]+tq*(W[qi][0]-W[qi-1][0])); }
      }
      py = Math.max(py, clr + plH*0.5 + bore*0.04);
      /* long runners on a valley too narrow to arch over: stand the plenum higher so the drops themselves are long */
      var pre0 = new THREE.Vector3(0, bi0.headY+p.headH*0.55, -bi0.zs*bi0.headW*0.52).applyMatrix4(new THREE.Matrix4().makeRotationX(a)).z - Math.cos(a)*bore*0.30;
      if(longR && Math.abs(pre0) <= plW*0.5 + bore*0.15) py += bore*0.55;
    }
    if(blown){
      /* low blower manifold: the case bolts straight onto its flat top */
      B.add("anod", RBOX(plenL, bore*0.36, bi0.headW*1.0, 0.05), 0, py, 0);
      LAST_PLEN = {x:0, z:0, top:py+bore*0.18, bot:py-bore*0.18, len:plenL, w:bi0.headW*1.0};
    } else if(shortR){
      B.add("anod", RBOX(plenL, bore*0.62, bi0.headW*1.40, 0.06), 0, py, 0);
    } else {
      B.add("anod", RBOX(plenL, bore*0.46, bi0.headW*1.15, 0.06), 0, py, 0);
    }
    /* runners diving into each head */
    for(var bk2=0; bk2<banks; bk2++){
      var bii=p.bankInfo[bk2];
      var zs2=bii.zs;
      for(var j=0;j<per;j++){
        var xx=-bankLen/2 + bspace*(j+0.5);
        var bmR = new THREE.Matrix4().makeRotationX(banks===1?0:(bk2===0?a:-a));
        var portP = new THREE.Vector3(xx, bii.headY+p.headH*0.55, -bii.zs*(bii.headW*0.52)).applyMatrix4(bmR);
        var pre = portP.clone().addScaledVector(new THREE.Vector3(0,0,-bii.zs).applyMatrix4(bmR), bore*0.30);   /* straight out of the port face */
        var top, mid;
        if(longR && Math.abs(pre.z) > plW*0.5 + bore*0.15){
          /* long runner: leaves the plenum roof, arches up and outboard, drops into the port */
          top = V3(xx, py + plH*0.30, zs2*plW*0.22);
          mid = V3(xx, Math.max(py + plH*0.5, pre.y) + bore*0.45, (top.z + pre.z)*0.5);
        } else {
          /* short / single-TB (and long on a narrow valley): out of the plenum floor, sweep down into the port */
          top = V3(xx, py - plH*0.20, zs2*Math.min(plW*0.36, Math.abs(pre.z)*0.9));
          mid = top.clone().lerp(pre, 0.5).add(V3(0, bore*0.06, 0));
        }
        extras.push(meshB(TUBE([top,mid,pre,portP], bore*0.155, 16, 9), MAT.anod));
      }
    }
    if(!blown){
      LAST_PLEN = {x:0, z:0, top:py+bore*(shortR?0.31:0.23), bot:py-bore*(shortR?0.31:0.23), len:plenL, w:bi0.headW*(shortR?1.40:1.15)};
      /* throttle body on the front face of the plenum */
      B.add("malu", CYL(bore*0.30,bore*0.30,bore*0.28,18), plenL*0.5+bore*0.14, py, 0, 0,0,PI/2);
      B.add("blackPlast", CYL(bore*0.20,bore*0.20,bore*0.12,14), plenL*0.5+bore*0.32, py, 0, 0,0,PI/2);
      LAST_TB = {pt:V3(plenL*0.5+bore*0.38, py, 0), dir:V3(1,0,0)};
    }
  } else {
    /* inline: plenum on the -Z flank */
    var zs3=bi0.zs;
    var pz = -(bi0.headW*0.52 + (longR? bore*1.05 : bore*0.72));
    var pyi = bi0.headY + p.headH*(shortR?0.55:0.95) + (longR? bore*0.30:0);
    if(shortR){
      B.add("anod", CYL(plenR, plenR, bankLen*0.94, 24, false, 2.0), 0, pyi, pz, 0,0,PI/2);
      B.add("anod", SPH(plenR,16,2.0), bankLen*0.47, pyi, pz);
      B.add("anod", SPH(plenR,16,2.0), -bankLen*0.47, pyi, pz);
    } else {
      B.add("anod", RBOX(bankLen*0.92, bore*0.46, bore*0.62, 0.05), 0, pyi, pz);
    }
    for(var k=0;k<per;k++){
      var kx=-bankLen/2 + bspace*(k+0.5);
      var pA = V3(kx, pyi + (shortR?plenR*0.4:bore*0.20), pz + bore*0.10);
      var pB2= longR ? V3(kx, pyi+bore*0.62, pz+bore*0.55) : V3(kx, pyi+bore*0.10, pz+bore*0.30);
      var pC = V3(kx, bi0.headY+p.headH*0.62, -(bi0.headW*0.50));
      extras.push(meshB(TUBE(longR?[pA,pB2,pC]:[pA,pC], bore*0.15, longR?18:12, 9), MAT.anod));
    }
    LAST_PLEN = {x:0, z:pz, top:pyi+(shortR?plenR:bore*0.23), bot:pyi-(shortR?plenR:bore*0.23), len:bankLen*0.92, w:shortR?plenR*2:bore*0.62};
    if(!blown){
      /* throttle body at the front of the plenum */
      B.add("malu", CYL(bore*0.28,bore*0.28,bore*0.26,18), bankLen*0.46+bore*0.16, pyi, pz, 0,0,PI/2);
      B.add("blackPlast", CYL(bore*0.19,bore*0.19,bore*0.12,14), bankLen*0.46+bore*0.34, pyi, pz, 0,0,PI/2);
      LAST_TB = {pt:V3(bankLen*0.46+bore*0.40, pyi, pz), dir:V3(1,0,0)};
    }
  }
}

/* ===========================================================================
   7d. ASPIRATION (turbo / twin / compound / roots / screw / centrifugal + intercooler)
   ==========================================================================*/
var PIPE_LOG=[];          /* every pipe built so far this engine (world points + radius): turbos are placed clear of the headers */
var EXH_COLL=[];          /* turbo feed flanges, engine space: {pt, dir, bank, r, cast} (filled by buildExhaust) */
var LAST_TB=null;         /* throttle inlet {pt, dir(upstream)} (filled by buildIntake) */
var N2O_PURGE=null;       /* nitrous purge nozzle marker (an Object3D in the engine group; userData.n2oPurge = local spray direction) */
var LAST_PLEN=null;       /* plenum / blower-manifold box {x, z, top, bot, len, w} (filled by buildIntake) */
var TURBO_MM = { small:46, medium:54, large:64, s66:66, huge:76, f88:88, f98:98 };        /* compressor inducer, mm */
var FLOW_LB  = { small:26, medium:40, large:58, s66:115, huge:84, f88:125, f98:165 };      /* OPT.turboSize maxFlow */
function turboScale(tsz){ return (TURBO_MM[tsz]||54)*0.019; }   /* housing unit s (scene units): compressor cover OD = 1.6 s, absolute size */

/* a pipe must not run through a cone filter or a compressor cover: sample its route, push every sample out of each
   obstacle cylinder (axis a-b, radius r + gap), smooth, and push again so the pipe arcs round it instead of cutting it */
function clearOfFilters(pts, flts, gap){
  if(!flts || !flts.length) return pts;
  var cv=new THREE.CatmullRomCurve3(pts, false, "centripetal"), n=Math.max(32, pts.length*10), q=[], k, m, f, hit=false;
  for(k=0;k<=n;k++) q.push(cv.getPoint(k/n));
  var p0=pts[0], push=function(v){
    for(m=0;m<flts.length;m++){ f=flts[m];
      if(f.co && p0.distanceTo(f.co)<f.s*0.25 && v.distanceTo(f.co)<f.s*0.85) continue;   /* a charge pipe leaving this compressor's own outlet */
      var ab=f.b.clone().sub(f.a), t=clamp(v.clone().sub(f.a).dot(ab)/ab.lengthSq(), 0, 1), c=f.a.clone().addScaledVector(ab, t), d=v.clone().sub(c), L2=d.length(), need=f.r+gap;
      if(L2<need){ if(L2<1e-4) d.set(0,1,0); else d.multiplyScalar(1/L2); v.copy(c).addScaledVector(d, need); hit=true; } } };
  for(k=1;k<n;k++) push(q[k]);
  if(!hit) return pts;
  for(var it=0; it<3; it++){
    for(k=1;k<n;k++) q[k].lerpVectors(q[k], q[k-1].clone().add(q[k+1]).multiplyScalar(0.5), 0.5);
    for(k=1;k<n;k++) push(q[k]);
  }
  return q;
}
/* does a compressor scroll (turbo centre T, scale s, inlet toward cdir*x) sit on any pipe already built? */
function cmpHits(T, s, cdir){
  var a=V3(T.x+cdir*s*0.62, T.y, T.z), b=V3(T.x+cdir*s*1.08, T.y, T.z), ab=b.clone().sub(a), L2=ab.lengthSq(), i, k;
  for(i=0;i<PIPE_LOG.length;i++){
    var P=PIPE_LOG[i], cv=new THREE.CatmullRomCurve3(P.pts, false, "centripetal"), q=cv.getSpacedPoints(40);
    for(k=1;k<q.length-1;k++){
      var t=q[k].clone().sub(a).dot(ab)/L2; if(t<0||t>1) continue;
      if(q[k].distanceTo(a.clone().addScaledVector(ab,t)) < s*0.80+P.rad) return true;
    }
  }
  return false;
}
function buildAspiration(B, p, extras){
  var asp=p.asp, bore=p.bore, bankLen=p.bankLen, L=p.L;
  var out = { crankDriven:null, pulleys:[], cout:[], tb:p.tb, tip:null, rc:bore*0.20 };
  if(asp==="na") return out;

  if(asp==="turbo" || asp==="twin_turbo" || asp==="compound"){
    var s0 = turboScale(p.tsz), cmpd = (asp==="compound"), ext = (TURBO_MM[p.tsz]||54) >= 76;
    var yF = p.panBot, cols = EXH_COLL.slice(), units = [], q;
    var kF = clamp(Math.sqrt((FLOW_LB[p.tsz]||40)*(asp==="twin_turbo"?1.6:1)/40), 0.85, 2.0);
    var fmicZ = Math.min(bankLen*1.05, bore*3.2*kF)*0.52 + bore*0.30;
    out.rc = Math.max(bore*0.17, (TURBO_MM[p.tsz]||54)*0.0047);
    var colOf = function(b){ for(var k=0;k<cols.length;k++) if(cols[k].bank===b) return cols[k]; return cols[0]; };
    if(!cols.length) return out;
    if(L.banks>1){
      if(asp==="twin_turbo"){ units.push({C:colOf(0), side:1}); units.push({C:colOf(1), side:-1}); }
      else units.push({C:colOf(0), side:1, X:colOf(1)});           /* single / compound: the other bank crosses over */
    } else for(q=0;q<cols.length;q++) units.push({C:cols[q], side:1});

    var upPipe = function(C, t, key){
      var d=C.pt.distanceTo(t.ti), k=Math.min(bore*0.45, Math.max(bore*0.22, d*0.34));
      extras.push(pipeMesh(B, clearOfFilters([C.pt, C.pt.clone().addScaledVector(C.dir,k), t.ti.clone().addScaledVector(t.tiDir,k), t.ti], out.filt, C.r+bore*0.04), C.r, key, 18));
    };
    var extWG = function(C, t, sd){   /* external wastegate teed off the feed pipe, with a screamer pipe */
      var M0=C.pt.clone().lerp(t.ti, 0.5), dW=(L.boxer ? V3(0,-0.55,sd*0.83) : V3(0,0.6,sd*0.8)).normalize(), ang=Math.atan2(dW.z,dW.y);
      var c1=M0.clone().addScaledVector(dW, C.r+bore*0.16), c2=M0.clone().addScaledVector(dW, C.r+bore*0.43);
      B.add("stainless", CYL(bore*0.16,bore*0.18,bore*0.34,16,false,2.0), c1.x,c1.y,c1.z, ang,0,0);
      B.add("anod", CYL(bore*0.25,bore*0.25,bore*0.18,18,false,2.0), c2.x,c2.y,c2.z, ang,0,0);
      extras.push(pipeMesh(B, [c1, c1.clone().add(V3(-bore*0.34,0,0)), c1.clone().add(V3(-bore*0.80,0,0)).addScaledVector(dW,bore*0.55)], bore*0.08, "stainless", 12));
    };
    var cross = function(X, C, key){  /* crossover from the far bank into this bank's feed pipe */
      var m=C.pt.clone().addScaledVector(C.dir, bore*0.40), a0=X.pt.clone().addScaledVector(X.dir, bore*0.40), pts;
      if(L.boxer){
        var yb=Math.min(X.pt.y, C.pt.y)-bore*0.12;
        pts=[X.pt, a0, V3(X.pt.x-bore*0.25, yb, X.pt.z*0.45), V3(C.pt.x-bore*0.25, yb, C.pt.z*0.45), m];
      } else {
        var yX=Math.max(yF+X.r, p.caseBot-bore*0.35), rx=-bankLen*0.5-bore*0.55;
        pts=[X.pt, a0, V3(-bankLen*0.40, yX, X.pt.z*0.72), V3(rx, yX, X.pt.z*0.30), V3(rx, yX, C.pt.z*0.30), V3(-bankLen*0.40, yX, C.pt.z*0.72), m];
      }
      extras.push(pipeMesh(B, pts, X.r, key, 48));
    };

    var dps=[], ups=[];
    for(var u=0; u<units.length; u++){
      var U=units[u], C=U.C, sd=U.side, s1=cmpd ? s0*0.72 : s0, cdir=1, T;
      if(L.boxer){
        /* boxer: behind the head at the flywheel end, fed by an up-pipe (Subaru EJ / Porsche 930 style) */
        cdir=-1; T=V3(-bankLen*0.505 - s1*0.62 - bore*0.10, yF + s1*1.35, sd*(p.deckH + p.headH*0.5));
      } else {
        /* hung off the manifold flange, outboard and a little low; never below the sump */
        T=C.pt.clone().add(V3(0, -s1*0.55, sd*(s1*0.95 + bore*0.15)));
        T.y=Math.max(T.y, yF + s1*0.95);
        /* big turbos on a vee: the compressor scroll can land on the header runners. Step the turbo outboard until it clears */
        for(var nud=0; nud<8 && cmpHits(T, s1, cdir); nud++) T.z += sd*bore*0.08;
        var tipX = T.x + s1*2.35, zIn = Math.abs(T.z) - s1*0.6;
        if((p.ic==="air_air" && tipX > bankLen*0.5 + bore*1.05 && zIn < fmicZ) ||
           (tipX > bankLen*0.5 + bore*0.10 && zIn < p.caseW*0.52 + bore*0.70)) cdir=-1;   /* filter would hit the FMIC / belt drive: inlet to the rear */
      }
      var coD = L.boxer ? V3(0,1,0) : V3(0,0.82,sd*0.57);
      var t1 = buildTurbo(B, extras, p, T, s1, cdir, C.pt, coD, {side:sd, filter:!cmpd, extWG:ext, downpipe:!cmpd});
      var hk = C.cast ? "castexh" : "stainless";
      if(ext) extWG(C, t1, sd);
      if(U.X) cross(U.X, C, hk);
      if(cmpd){
        /* compound: the small HP turbine exhausts into the big LP turbine; the LP compressor feeds the HP compressor */
        var T2 = L.boxer ? V3(T.x - s1*0.20, yF + s0*1.35, T.z + sd*(s1*0.90 + s0*0.95))
                         : T.clone().add(V3(-s0*0.10, 0, sd*(s1*0.90 + s0*0.95)));
        T2.y = Math.max(T2.y, yF + s0*0.95);
        var t2 = buildTurbo(B, extras, p, T2, s0, cdir, t1.to, coD, {side:sd, filter:true, extWG:ext});
        extras.push(pipeMesh(B, [t1.to, t1.to.clone().addScaledVector(t1.toDir, bore*0.30), t2.ti.clone().addScaledVector(t2.tiDir, bore*0.40), t2.ti], s1*0.30, "stainless", 18));
        var hp = t1.ci.clone().addScaledVector(t1.ciDir, bore*0.35);
        extras.push(pipeMesh(B, [t2.co, t2.co.clone().addScaledVector(t2.coDir, bore*0.55),
          V3(hp.x + t1.ciDir.x*bore*0.55, Math.max(t2.co.y, hp.y) + bore*0.45, (t2.co.z + hp.z)/2), hp, t1.ci], s1*0.26, "tubeAlu", 24));
        t1.tip = t2.tip;
      }
      out.cout.push({pt:t1.co, dir:t1.coDir});
      dps.push(t1); if(t1.filt) (out.filt=out.filt||[]).push(t1.filt); out.filt=(out.filt||[]).concat(t1.cmp); ups.push([C, t1, hk]);
      if(cmpd){ dps.push(t2); if(t2.filt) out.filt.push(t2.filt); out.filt=out.filt.concat(t2.cmp); }
      if(!out.tip) out.tip = t1.tip;
    }
    for(q=0;q<ups.length;q++) upPipe(ups[q][0], ups[q][1], ups[q][2]);
    for(q=0;q<dps.length;q++) if(dps[q].dp){ var dq=dps[q].dp, dqp=clearOfFilters(dq.pts, out.filt, dq.rad+0.04); extras.push(pipeMesh(B, dqp, dq.rad, "stainless", 18)); exhTail(B, dqp, dq.rad); }
    addIntercooler(B,p,extras,true,out);
    return out;
  }

  if(asp==="roots" || asp==="screw"){
    /* positive-displacement blower seated on its manifold; a screw (and any inline blower) breathes through the rear end */
    var screw=(asp==="screw"), inl=!(L.vee||L.boxer), pl=p.plen;
    var caseL = bankLen*(screw?0.86:0.72)*(inl?0.80:1), caseW2 = bore*(screw?1.42:1.55), caseH2 = bore*(screw?0.98:0.86);
    var lid = (p.ic!=="none" && !inl) ? bore*0.30 : 0;       /* intercooled lid between the case and the hat */
    var cx=0, cz, vy;
    if(inl){
      /* inline: on the intake flank under the plenum (Jaguar AJ16 / Mercedes Kompressor), short neck up into it */
      cz = pl ? pl.z : -(p.bankInfo[0].headW*0.52 + bore*0.72);
      var plBot = pl ? pl.bot : p.bankInfo[0].headY + p.headH*0.6, icB = (p.ic!=="none") ? bore*0.36 : 0;
      vy = plBot - bore*0.20 - icB - caseH2*0.5;
      B.add("malu", RBOX(caseL*0.45, bore*0.28, caseW2*0.50, 0.03), cx, plBot - bore*0.11, cz);
      if(icB){
        /* charge-cooler brick between the discharge and the plenum neck */
        B.add("malu", RBOX(caseL*0.86, icB, caseW2*0.92, 0.03), cx, vy+caseH2*0.5+icB*0.5, cz);
        for(var fb=0; fb<6; fb++) B.add("malu", BOX(caseL*0.84, icB*0.8, bore*0.04), cx, vy+caseH2*0.5+icB*0.5, cz-caseW2*0.40+fb*caseW2*0.16);
        out.lidPorts=[V3(cx+caseL*0.43, vy+caseH2*0.5+icB*0.5, cz+caseW2*0.25), V3(cx+caseL*0.43, vy+caseH2*0.5+icB*0.5, cz-caseW2*0.25)];
        lid=icB;
      }
    } else {
      cz = 0;
      vy = (pl ? pl.top : (p.deckH + p.headH*0.92)*Math.cos(p.a) + bore*0.55) + caseH2*0.5 - bore*0.02;
    }
    if(screw) B.add("palu", RBOX(caseL, caseH2, caseW2, 0.05), cx, vy, cz);
    else {
      /* Roots: a figure-8 case round the two side-by-side rotor bores, thicker end plates, ribbed flanks */
      var rr=caseH2*0.5, rz=caseW2*0.5-rr, sg=DET?28:18, ept=bore*0.09;
      B.add("malu", CYL(rr,rr,caseL-ept*2,sg,false,2.0), cx, vy, cz+rz, 0,0,PI/2);
      B.add("malu", CYL(rr,rr,caseL-ept*2,sg,false,2.0), cx, vy, cz-rz, 0,0,PI/2);
      B.add("malu", BOX(caseL-ept*2, caseH2*0.86, rz*2, 2.0), cx, vy, cz);
      for(var ep=-1; ep<=1; ep+=2){                       /* end plates, a little proud of the case all round */
        var ex2=cx+ep*(caseL*0.5-ept*0.5);
        B.add("malu", CYL(rr*1.07,rr*1.07,ept,sg,false,2.0), ex2, vy, cz+rz, 0,0,PI/2);
        B.add("malu", CYL(rr*1.07,rr*1.07,ept,sg,false,2.0), ex2, vy, cz-rz, 0,0,PI/2);
        B.add("malu", BOX(ept, caseH2*1.0, rz*2, 2.0), ex2, vy, cz);
      }
      if(DET) for(var rb=0; rb<3; rb++){ var rh=(rb-1)*rr*0.52, rzo=rz+Math.sqrt(rr*rr-rh*rh);   /* longitudinal ribs on both flanks */
        B.add("malu", RBOX(caseL-ept*2.4, bore*0.035, bore*0.06, 0.012), cx, vy+rh, cz+rzo);
        B.add("malu", RBOX(caseL-ept*2.4, bore*0.035, bore*0.06, 0.012), cx, vy+rh, cz-rzo); }
      if(!inl) B.add("malu", RBOX(caseL*1.02, bore*0.08, caseW2*1.06, 0.02), cx, vy-caseH2*0.5-bore*0.02, cz);   /* manifold adapter plate */
    }
    var topY = vy + caseH2*0.5;
    if(lid && !inl){
      B.add("malu", RBOX(caseL*0.92, lid, caseW2*0.96, 0.03), cx, topY + lid*0.5, cz);
      out.lidPorts=[V3(cx+caseL*0.38, topY+lid*0.5, cz+caseW2*0.30), V3(cx+caseL*0.38, topY+lid*0.5, cz-caseW2*0.30)];
      topY += lid;
    }
    if(!inl) for(var r=0;r<8;r++) B.add("malu", BOX(caseL*0.96, bore*0.05, bore*0.09), cx, topY+bore*0.02, cz-caseW2*0.40+r*caseW2*0.115);
    /* bypass valve + vacuum actuator at the inlet end */
    B.add("malu", CYL(bore*0.12,bore*0.12,bore*0.22,12), cx-caseL*0.38, topY+bore*0.11, cz-caseW2*0.34);
    B.add("dark", CYL(bore*0.16,bore*0.16,bore*0.10,14), cx-caseL*0.38, topY+bore*0.26, cz-caseW2*0.34);
    if(screw) B.add("anod", RBOX(bore*0.42, bore*0.06, bore*0.42, 0.02), cx+caseL*0.28, topY+bore*0.03, cz+caseW2*0.26);  /* burst panel */
    if(DET){
      /* end-plate bolts round both ends of the rotor case */
      for(var eb=0; eb<10; eb++){ var ae=eb/10*TAU;
        var ey=vy+Math.cos(ae)*caseH2*0.40, ez=cz+Math.sin(ae)*caseW2*0.42;
        B.hw("hex", cx+caseL*0.5, ey, ez, 0,0,-PI/2, bore*0.085); B.hw("hex", cx-caseL*0.5, ey, ez, 0,0,PI/2, bore*0.085); }
    }
    /* snout: points forward (+X) to the blower belt plane in buildFAD */
    var snX = caseL*0.5 + bore*0.34;
    if(screw) B.add("malu", RBOX(bore*0.70, bore*0.42, bore*0.44, 0.04), cx+snX-bore*0.05, vy, cz);
    else {
      /* Roots gear case: an oval cover on the front plate, then a tapered snout to the pulley bearing */
      B.add("malu", RBOX(bore*0.20, caseH2*0.84, caseW2*0.78, 0.05), cx+caseL*0.5+bore*0.10, vy, cz);
      B.add("malu", CONE(bore*0.17, bore*0.27, bore*0.44, DET?20:14, 2.0), cx+caseL*0.5+bore*0.42, vy, cz, 0,0,-PI/2);
      B.add("malu", CYL(bore*0.19,bore*0.19,bore*0.06,DET?20:14,false,2.0), cx+snX+bore*0.22, vy, cz, 0,0,PI/2);
      if(DET) for(var gb=0; gb<6; gb++){ var ag=gb/6*TAU;
        B.hw("hex", cx+caseL*0.5+bore*0.21, vy+Math.cos(ag)*caseH2*0.34, cz+Math.sin(ag)*caseW2*0.33, 0,0,-PI/2, bore*0.07); }
    }
    out.crankDriven={ kind:"blower", y:vy, z:cz, snoutX:cx+snX+bore*0.30, ratio:(screw?3.2:2.6) };
    var rearIn = screw || inl, rx0 = cx-caseL*0.5, iy = vy+caseH2*0.08;
    if(p.intake==="carb"){
      /* carb(s) on a hat: on top of a V Roots, on a riser at the rear inlet otherwise */
      var hx = rearIn ? rx0-bore*0.45 : cx-bore*0.10, hy = rearIn ? topY+bore*0.30 : topY+bore*0.14;
      if(rearIn) B.add("malu", RBOX(bore*0.80, hy-vy, bore*0.80, 0.04), hx+bore*0.08, (hy+vy)/2, cz);
      B.add("malu", RBOX(bore*0.95, bore*0.26, bore*1.10, 0.04), hx, hy, cz);
      var ah = hy+bore*0.42;
      B.add("blackPlast", CYL(bore*1.15,bore*1.15,bore*0.26,28,true,2.0), hx, ah, cz);
      B.add("chrome", CYL(bore*1.20,bore*0.98,bore*0.10,30), hx, ah+bore*0.16, cz);
      B.add("chrome", CYL(bore*1.20,bore*1.20,bore*0.05,30), hx, ah-bore*0.14, cz);
      B.add("chrome", CYL(bore*0.08,bore*0.08,bore*0.11,10), hx, ah+bore*0.25, cz);
      out.tb = {pt:V3(hx, hy+bore*0.14, cz), dir:V3(0,1,0)};
    } else if(rearIn){
      B.add("malu", CYL(bore*0.44,bore*0.50,bore*0.30,20), rx0-bore*0.15, iy, cz, 0,0,PI/2);       /* inlet adapter */
      B.add("anod", CYL(bore*0.40,bore*0.40,bore*0.26,20), rx0-bore*0.43, iy, cz, 0,0,PI/2);       /* throttle body */
      B.add("blackPlast", CYL(bore*0.30,bore*0.30,bore*0.10,16), rx0-bore*0.61, iy, cz, 0,0,PI/2);
      out.tb = {pt:V3(rx0-bore*0.56, iy, cz), dir:V3(-1,0,0)};
    } else {
      /* twin throttle bodies on a hat */
      B.add("anod", RBOX(bore*0.95, bore*0.26, bore*1.10, 0.04), cx-bore*0.10, topY+bore*0.16, cz);
      B.add("malu", CYL(bore*0.28,bore*0.28,bore*0.18,18), cx-bore*0.40, topY+bore*0.36, cz);
      B.add("malu", CYL(bore*0.28,bore*0.28,bore*0.18,18), cx+bore*0.20, topY+bore*0.36, cz);
      out.tb = {pt:V3(cx-bore*0.10, topY+bore*0.30, cz), dir:V3(0,1,0)};
    }
    if(lid) addIntercooler(B,p,extras,true,out);
    return out;
  }

  if(asp==="centrifugal"){
    /* head unit, bracket and pulley are built in buildFAD, which also fills cd.cout (the discharge) */
    out.crankDriven={ kind:"centri", ratio:3.4, cout:out.cout };
    out.rc = bore*0.26;
    addIntercooler(B,p,extras,true,out);
    return out;
  }
  return out;
}

function buildCompressorSnail(B, extras, p, x, y, z, s, matKey, zs, dir){
  var d=(dir===undefined)?1:dir, e=-d;   /* d = 1: inlet toward -X; -1: inlet facing forward. e points out of the inlet */
  var VT=DET?44:26, VR=DET?14:9, SW=PI*1.86, cR=s*0.62, cr=s*0.27, al=PI/2+SW;
  /* back plate on the drive side, then the scroll; turned half round so it leaves straight up on the outboard side */
  B.add(matKey, CYL(s*0.62,s*0.62,s*0.10,24,false,2.0), x-e*s*0.20, y, z, 0,0,PI/2);
  B.add(matKey, VOLUTE(s*0.50, cR, s*0.11, cr, SW, VT, VR, 2.0), x, y, z, al, PI, 0);
  B.add(matKey, CYL(s*0.46,s*0.46,s*0.28,26,false,2.0), x, y, z, 0,0,PI/2);
  B.add(matKey, SPH(s*0.11, 10, 2.0), x, y+s*0.50*Math.cos(al), z+s*0.50*Math.sin(al));
  /* stepped open inlet with the wheel inside, as on the turbo compressor */
  B.add(matKey, CYL(s*0.50,s*0.54,s*0.16,26,false,2.0), x+e*s*0.22, y, z, 0,0,PI/2);
  B.add(matKey, CONE(s*0.46,s*0.48,s*0.26,24,2.0), x+e*s*0.43, y, z, 0,0,e*PI/2);
  B.add(matKey, CONE(s*0.49,s*0.49,s*0.06,24,2.0), x+e*s*0.50, y, z, 0,0,PI/2);
  B.add(matKey, RING(s*0.46,s*0.49,24,2.0), x+e*s*0.53, y, z, 0,e*PI/2,0);
  B.add(matKey, RING(s*0.46,s*0.49,24,2.0), x+e*s*0.47, y, z, 0,-e*PI/2,0);
  B.add(matKey, CONE(s*0.44,s*0.48,s*0.17,24,2.0), x+e*s*0.615, y, z, 0,0,-e*PI/2);
  B.add(matKey, BORE(s*0.37, s*0.30, 24, 2.0), x+e*s*0.55, y, z, 0,0,PI/2);
  B.add(matKey, BORE(s*0.33, s*0.16, 24, 2.0), x+e*s*0.34, y, z, 0,0,PI/2);
  B.add(matKey, RING(s*0.33,s*0.37,24,2.0), x+e*s*0.40, y, z, 0,e*PI/2,0);
  B.add(matKey, RING(s*0.37,s*0.44,24,2.0), x+e*s*0.70, y, z, 0,e*PI/2,0);
  B.add(matKey, TOR(s*0.405, s*0.03, 6, 24, 2.0), x+e*s*0.70, y, z, 0,PI/2,0);
  /* tangential discharge climbing off the scroll, with a hose bead */
  var dL=s*0.70;
  B.add(matKey, CYL(cr,cr*1.02,dL,18,false,2.0), x, y+dL*0.5, z+cR);
  B.add(matKey, TOR(cr*0.98, s*0.035, 6, 18, 2.0), x, y+dL*0.86, z+cR, PI/2,0,0);
  /* compressor wheel (spins), nose toward the inlet */
  var wheel=makeWheelMesh(s*0.32, 6, MAT.palu);
  wheel.position.copy(B.pt(x+e*s*0.39, y, z)); wheel.rotation.z=d*PI/2;
  extras.push(wheel); anim.turbos.push(wheel);
  return {pt:V3(x, y+dL, z+cR), dir:V3(0,1,0)};
}

/* one impeller blade along the wheel axis (Y, nose at +Y): root on the hub, tip out to the shroud line, the
   leading edge swept round like a real compressor inducer. `len` < 1 makes a shorter splitter blade. */
function BLADE(r, len, nU){
  var key=gkey("bl",r3(r),r3(len),nU);
  if(GEO[key]) return GEO[key];
  var nV=3, th=r*0.045, pos=[], idx=[], sides=[1,-1], q, i, j;
  var y0=-r*0.42, y1=y0+(r*0.86)*len;
  for(q=0;q<2;q++){
    var base=pos.length/3;
    for(i=0;i<=nU;i++){
      var u=i/nU, y=y0+(y1-y0)*u;
      var hubR=r*(0.62-0.40*Math.pow(u*len,1.1)), tipR=r*(1.0-0.30*Math.pow(u*len,1.4));
      var phi=0.95*Math.pow(u*len,2.0);              /* inducer sweep */
      for(j=0;j<=nV;j++){
        var rr=hubR+(tipR-hubR)*(j/nV), a=phi+sides[q]*th/(2*rr);
        pos.push(Math.cos(a)*rr, y, Math.sin(a)*rr);
      }
    }
    for(i=0;i<nU;i++) for(j=0;j<nV;j++){
      var A=base+i*(nV+1)+j, B2=A+nV+1;
      if(q===0) idx.push(A,B2,A+1, B2,B2+1,A+1); else idx.push(A,A+1,B2, B2,A+1,B2+1);
    }
  }
  var g=new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos,3));
  g.setIndex(idx); g.computeVertexNormals();
  var uv=new Float32Array(pos.length/3*2); g.setAttribute("uv", new THREE.BufferAttribute(uv,2));
  return cache(key,g);
}
function makeWheelMesh(r, blades, mat){
  var nU=DET?7:4, half=DET?blades:Math.max(5,blades-3);
  var items=[{g:CONE(r*0.24, r*0.66, r*0.86, 16, 3.0), m:new THREE.Matrix4()},
             {g:CYL(r*0.70, r*0.70, r*0.10, 18, false, 3.0), m:mkM(0,-r*0.46,0)},
             {g:SPH(r*0.13, 10, 3.0), m:mkM(0,r*0.45,0)}];                       /* back disc + nose nut */
  for(var i=0;i<half;i++){
    var ang=i/half*TAU;
    items.push({g:BLADE(r, 1.0, nU), m:mkM(0,0,0, 0,-ang,0)});
    if(DET) items.push({g:BLADE(r, 0.62, nU), m:mkM(0,0,0, 0,-ang-PI/half,0)});  /* splitter */
  }
  var mesh=new THREE.Mesh(mergeGeos(items), mat);
  mesh.castShadow=true;
  return mesh;
}

/* One turbocharger, in engine space. T = turbine-wheel centre. The shaft runs along X with the compressor toward
   cdir (+1 front, -1 rear): turbine housing, centre housing and compressor cover are coaxial. The turbine inlet
   flange faces the point `aim` (the manifold flange, or the HP turbine outlet on a compound); the compressor
   discharge leaves tangentially along coDir. Returns the plumbing ports in engine space. */
function buildTurbo(B, extras, p, T, s, cdir, aim, coDir, o){
  o=o||{};
  var bore=p.bore, hot="turbine";          /* Ni-resist and Inconel hot sides both use the glowing turbine material */
  var M=new THREE.Matrix4().makeTranslation(T.x,T.y,T.z);
  if(cdir<0) M.multiply(new THREE.Matrix4().makeRotationY(PI));
  B.push(M);
  var loc=function(d){ return V3(0, d.y, cdir<0 ? -d.z : d.z); };
  var di=V3(0, aim.y-T.y, aim.z-T.z); if(di.lengthSq()<1e-8) di.set(0,1,0); di.normalize();
  var dO=coDir.clone().setX(0).normalize();
  var li=loc(di), lo=loc(dO), ai=Math.atan2(li.z, li.y), ao=Math.atan2(lo.z, lo.y);
  /* turbine housing (hot side) with its inlet neck + flange aimed at the manifold */
  var VT=DET?44:26, VR=DET?14:9, SW=PI*1.86;
  /* scroll winds down from the inlet neck: fat where the exhaust enters, tight where it reaches the tongue */
  B.add(hot, VOLUTE(s*0.40, s*0.50, s*0.10, s*0.27, SW, VT, VR, 2.0), 0,0,0, ai-SW,0,0);
  B.add(hot, CYL(s*0.36,s*0.36,s*0.30,26,false,2.0), 0,0,0, 0,0,PI/2);
  B.add(hot, SPH(s*0.10, 10, 2.0), 0, s*0.40*Math.cos(ai-SW), s*0.40*Math.sin(ai-SW));
  B.add(hot, CYL(s*0.27,s*0.36,s*0.62,18,false,2.0), 0, li.y*s*0.67, li.z*s*0.67, ai,0,0);
  B.add(hot, SQFLANGE(s*0.66, s*0.40, s*0.08, 2.0), 0, li.y*s*1.01, li.z*s*1.01, ai,0,0);
  if(DET){                                   /* four studs and nuts on the flange corners */
    for(var fq=0; fq<4; fq++){
      var ex=(fq&1?1:-1)*s*0.245, et=(fq&2?1:-1)*s*0.245;
      B.hw("hex", ex, -li.z*et + li.y*s*1.08, li.y*et + li.z*s*1.08, ai,0,0, s*0.09);
    }
  }
  /* axial turbine outlet + v-band */
  B.add(hot, CYL(s*0.36,s*0.34,s*0.34,18,false,2.0), -s*0.36,0,0, 0,0,PI/2);
  B.add(hot, TOR(s*0.37, s*0.045, 6, 20, 2.0), -s*0.53,0,0, 0,PI/2,0);
  /* internal wastegate: flapper lever on the turbine housing, actuator can bracketed off the compressor cover */
  if(!o.extWG){
    /* actuator can: two pressed dishes crimped together, a boost nipple on the cap */
    B.add("steel", CYL(s*0.20,s*0.20,s*0.10,20,false,2.4), s*0.61, -s*0.72, 0, 0,0,PI/2);
    B.add("steel", CYL(s*0.13,s*0.20,s*0.10,20,false,2.4), s*0.72, -s*0.72, 0, 0,0,-PI/2);
    B.add("steel", TOR(s*0.205, s*0.022, 5, 22, 2.4), s*0.665, -s*0.72, 0, 0,PI/2,0);
    B.add("steel", CYL(s*0.035,s*0.035,s*0.10,8,false,2.4), s*0.81, -s*0.72, 0, 0,0,PI/2);
    B.add("steel", CYL(s*0.03,s*0.03,s*0.56,8), s*0.28, -s*0.72, 0, 0,0,PI/2);
    B.add("steel", BOX(s*0.06, s*0.26, s*0.06), 0.0, -s*0.62, 0);
    B.add("malu", BOX(s*0.06, s*0.20, s*0.12), s*0.70, -s*0.56, 0);
  }
  /* centre housing, oil feed + drain toward the block */
  B.add("malu", CYL(s*0.24,s*0.24,s*0.44,18,false,2.4), s*0.42,0,0, 0,0,PI/2);
  for(var f=0;f<3;f++) B.add("malu", TOR(s*0.25, s*0.03, 5, 18, 2.4), s*(0.30+f*0.11),0,0, 0,PI/2,0);
  var inb=loc(V3(0,0,-(o.side||1))).z;
  extras.push(hoseMesh([B.pt(s*0.42,s*0.24,0), B.pt(s*0.42,s*0.62,inb*s*0.20), B.pt(s*0.32,s*0.90,inb*s*0.70)], bore*0.03, MAT.steel));
  extras.push(hoseMesh([B.pt(s*0.42,-s*0.24,0), B.pt(s*0.42,-s*0.55,inb*s*0.18), B.pt(s*0.30,-s*0.80,inb*s*0.62)], bore*0.05));
  if(DET){
    /* water-cooled CHRA: coolant in and out on banjo lines toward the block */
    B.add("malu", CYL(s*0.07,s*0.07,s*0.10,8), s*0.34, 0, inb*s*0.25, PI/2,0,0);
    B.add("malu", CYL(s*0.07,s*0.07,s*0.10,8), s*0.52, 0, inb*s*0.25, PI/2,0,0);
    extras.push(hoseMesh([B.pt(s*0.34,0,inb*s*0.30), B.pt(s*0.28,-s*0.10,inb*s*0.60), B.pt(s*0.18,-s*0.30,inb*s*0.95)], bore*0.022, MAT.steel));
    extras.push(hoseMesh([B.pt(s*0.52,0,inb*s*0.30), B.pt(s*0.58,s*0.14,inb*s*0.62), B.pt(s*0.62,s*0.40,inb*s*0.95)], bore*0.022, MAT.steel));
    /* casting parting line round the turbine volute, and the compressor back-plate bolts */
    B.add(hot, TOR(s*0.36, s*0.022, 5, 30, 2.0), s*0.16,0,0, 0,PI/2,0);
    for(var cb=0; cb<6; cb++){ var ac=cb/6*TAU+0.26; B.hw("hex", s*0.60, Math.cos(ac)*s*0.56, Math.sin(ac)*s*0.56, 0,0,PI/2, s*0.10); }
    if(!o.extWG){
      /* boost reference line: a hard copper line off the cover that loops round the compressor to the can */
      var rl=[], a0=-0.45, a1=PI+0.15, nA=9;
      rl.push(B.pt(s*1.00, Math.cos(a0)*s*0.62, Math.sin(a0)*s*0.62));
      for(var ra=0; ra<=nA; ra++){ var aa=a0+(a1-a0)*ra/nA, rr2=s*0.70;
        rl.push(B.pt(s*1.14, Math.cos(aa)*rr2, Math.sin(aa)*rr2)); }
      rl.push(B.pt(s*1.00, -s*0.78, -s*0.06)); rl.push(B.pt(s*0.86, -s*0.72, 0));
      extras.push(hoseMesh(rl, s*0.035, MAT.copper));
      B.add("palu", CYL(s*0.05,s*0.06,s*0.08,8), s*0.98, Math.cos(a0)*s*0.62, Math.sin(a0)*s*0.62, 0,0,PI/2);
    }
    if(!o.extWG){ B.add("steel", CYL(s*0.05,s*0.05,s*0.05,8), s*0.02,-s*0.72,0, 0,0,PI/2); B.add("steel", BOX(s*0.04,s*0.10,s*0.10), -s*0.02,-s*0.66,0); }  /* rod end + clip */
  }
  /* compressor cover (cold side), inlet facing away from the turbine */
  /* back plate, then the scroll: it grows round the wheel and leaves tangentially along the discharge direction */
  B.add("palu", CYL(s*0.62,s*0.62,s*0.10,24,false,2.0), s*0.66,0,0, 0,0,PI/2);
  var cE=Math.atan2(-lo.y, lo.z), cA=cE-SW, cR=s*0.62, cr=s*0.25;
  B.add("palu", VOLUTE(s*0.50, cR, s*0.11, cr, SW, VT, VR, 2.0), s*0.86,0,0, cA,0,0);
  B.add("palu", CYL(s*0.46,s*0.46,s*0.28,26,false,2.0), s*0.86,0,0, 0,0,PI/2);
  B.add("palu", SPH(s*0.11, 10, 2.0), s*0.86, s*0.50*Math.cos(cA), s*0.50*Math.sin(cA));
  /* stepped inlet: shroud, a raised ring and a rolled lip like a cast cover */
  B.add("palu", CYL(s*0.50,s*0.54,s*0.16,26,false,2.0), s*1.08,0,0, 0,0,PI/2);
  B.add("palu", CONE(s*0.46,s*0.48,s*0.26,24,2.0), s*1.29,0,0, 0,0,PI/2);
  B.add("palu", CONE(s*0.49,s*0.49,s*0.06,24,2.0), s*1.36,0,0, 0,0,PI/2);
  B.add("palu", RING(s*0.46,s*0.49,24,2.0), s*1.39,0,0, 0,PI/2,0);
  B.add("palu", RING(s*0.46,s*0.49,24,2.0), s*1.33,0,0, 0,-PI/2,0);
  B.add("palu", CONE(s*0.44,s*0.48,s*0.17,24,2.0), s*1.475,0,0, 0,0,-PI/2);
  /* open inlet: the bore, a step ring part way down and the wheel sitting inside it */
  B.add("palu", BORE(s*0.37, s*0.30, 24, 2.0), s*1.41,0,0, 0,0,PI/2);
  B.add("palu", BORE(s*0.33, s*0.16, 24, 2.0), s*1.20,0,0, 0,0,PI/2);
  B.add("palu", RING(s*0.33,s*0.37,24,2.0), s*1.26,0,0, 0,PI/2,0);
  B.add("palu", RING(s*0.37,s*0.44,24,2.0), s*1.56,0,0, 0,PI/2,0);
  B.add("palu", TOR(s*0.405, s*0.03, 6, 24, 2.0), s*1.56,0,0, 0,PI/2,0);
  if(DET){ for(var bs=0; bs<3; bs++){ var ab=cA+0.9+bs*1.7;          /* cast bosses on the cover face */
    B.add("palu", CYL(s*0.045,s*0.05,s*0.05,10,false,2.0), s*1.05, Math.cos(ab)*s*0.60, Math.sin(ab)*s*0.60, 0,0,PI/2); } }
  /* tangential discharge: straight off the end of the scroll, with a hose bead */
  var cEy=Math.cos(cE)*cR, cEz=Math.sin(cE)*cR, dL=s*0.50;
  B.add("palu", CYL(cr,cr*1.02,dL,18,false,2.0), s*0.86, cEy+lo.y*dL*0.5, cEz+lo.z*dL*0.5, ao,0,0);
  B.add("palu", TOR(cr*0.98, s*0.035, 6, 18, 2.0), s*0.86, cEy+lo.y*dL*0.86, cEz+lo.z*dL*0.86, ao-PI/2,0,0);
  if(o.filter){
    /* cone filter: rubber coupler and clamp over the inlet lip, moulded base, pleated cotton element, capped tip */
    B.add("rubberFlat", CYL(s*0.495,s*0.50,s*0.20,24,false,2.0), s*1.58,0,0, 0,0,PI/2);
    if(DET){ B.add("steel", TOR(s*0.505, s*0.018, 6, 28, 2.4), s*1.53,0,0, 0,PI/2,0);
             B.add("steel", BOX(s*0.06, s*0.07, s*0.11, 2.4), s*1.53, s*0.53, 0); }
    B.add("blackPlast", CYL(s*0.55,s*0.55,s*0.06,26,false,2.0), s*1.71,0,0, 0,0,PI/2);
    B.add("filterRed", PLEATCONE(s*0.55, s*0.40, s*0.52, DET?30:16, s*0.045), s*2.00,0,0, 0,0,-PI/2);
    B.add("blackPlast", CYL(s*0.41,s*0.43,s*0.05,24,false,2.0), s*2.28,0,0, 0,0,PI/2);
    B.add("chrome", CYL(s*0.17,s*0.17,s*0.02,18,false,2.0), s*2.31,0,0, 0,0,PI/2);
  }
  /* wheels (turbine first, so turboPoint() lands on the hot side) */
  var tw=makeWheelMesh(s*0.30, 10, MAT.steel);
  tw.position.copy(B.pt(-s*0.08,0,0)); tw.rotation.z=cdir*PI/2;
  extras.push(tw); anim.turbos.push(tw);
  var cw=makeWheelMesh(s*0.32, 6, MAT.palu);
  cw.position.copy(B.pt(s*1.25,0,0)); cw.rotation.z=-cdir*PI/2;
  extras.push(cw); anim.turbos.push(cw);
  var r = {
    ti:B.pt(0, li.y*s*1.05, li.z*s*1.05), tiDir:di.clone(),
    to:B.pt(-s*0.56,0,0),  toDir:V3(-cdir,0,0),
    ci:B.pt(s*1.60,0,0),   ciDir:V3(cdir,0,0),
    co:B.pt(s*0.86, cEy+lo.y*dL, cEz+lo.z*dL), coDir:dO.clone(), tip:null,
    filt:o.filter ? {a:B.pt(s*1.68,0,0), b:B.pt(s*2.32,0,0), r:s*0.55} : null
  };
  r.cmp=[{a:B.pt(s*0.62,0,0), b:B.pt(s*1.08,0,0), r:s*0.80, co:r.co, s:s},
         {a:B.pt(s*1.08,0,0), b:B.pt(s*1.58,0,0), r:s*0.52, co:r.co, s:s}];
  B.pop();
  if(o.downpipe!==false){
    var xd=-cdir, y0=r.to.y, yF=(p.panBot===undefined?-1e9:p.panBot)+s*0.32, zo=(o.side||1)*s*0.75, pts;
    var st=s*0.55;                          /* straight stub out of the v-band: the bend must start clear of the housing */
    var x2=Math.max(bore*0.30, st+bore*0.08), x3=Math.max(bore*0.62, x2+bore*0.16), x4=Math.max(bore*1.40, x3+bore*0.30);
    if(cdir>0) pts=[ r.to, V3(r.to.x+xd*st, y0, r.to.z),
                     V3(r.to.x+xd*x2, y0-s*0.40, r.to.z),
                     V3(r.to.x+xd*x3, Math.max(yF, y0-s*1.1), r.to.z+zo*0.5),
                     V3(r.to.x+xd*x4, Math.max(yF, y0-s*1.8), r.to.z+zo) ];
    else       pts=[ r.to, V3(r.to.x+bore*0.14, y0-s*0.30, r.to.z),
                     V3(r.to.x-bore*0.05, Math.max(yF, y0-s*1.05), r.to.z+zo*0.5),
                     V3(r.to.x-bore*1.40, Math.max(yF, y0-s*1.45), r.to.z+zo) ];
    r.dp={pts:pts, rad:s*0.30};          /* built once every filter is known, so it can keep clear of the neighbour's */
    r.tip=pts[pts.length-1].clone();
    if(DET){
      /* wideband O2 in the downpipe, square to the pipe and leaning up */
      var dpc=new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.25), tq=0.34, dp=dpc.getPointAt(tq), dt=dpc.getTangentAt(tq);
      var nUp=V3(0,1,0).addScaledVector(dt, -dt.y).normalize(); if(nUp.lengthSq()<0.1) nUp.set(0,0,o.side||1);
      o2Sensor(B, dp.clone().addScaledVector(nUp, s*0.27), nUp, bore, o.side||1);
    }
  }
  return r;
}

/* Charge coolers. Air-to-air: a front-mounted core sized by compressor flow. Liquid-to-air: a core seated on the
   plenum (or the blower lid), coolant piped to a front heat exchanger (water_air) or an ice chest on the stand. */
function addIntercooler(B, p, extras, boosted, out){
  if(!boosted || p.ic==="none") return;
  var bore=p.bore, bankLen=p.bankLen, L=p.L;
  var flow = (p.asp==="centrifugal"||p.asp==="roots"||p.asp==="screw") ? 60
           : (FLOW_LB[p.tsz]||40)*((p.asp==="twin_turbo")?1.6:1);
  var k = clamp(Math.sqrt(flow/40), 0.85, 2.0);
  var fx = bankLen*0.5 + bore*((p.asp==="roots"||p.asp==="screw") ? 1.60 : 1.30);   /* clear of the blower's cog belt */
  var frontCore = function(hK, tK, tanks){
    var ch=bore*1.10*hK, cw=Math.min(bankLen*1.05, bore*3.2*hK), ct=bore*tK, y0=p.panTop+bore*0.85, i;
    B.add("malu", BOX(ct, ch, cw, 1.8), fx, y0+ch*0.5, 0);
    var fins=Math.min(34, Math.round(cw/(bore*0.14)));
    for(i=0;i<fins;i++) B.add("malu", BOX(ct*1.10, ch*0.86, bore*0.035, 3.0), fx, y0+ch*0.5, -cw*0.48 + i*(cw*0.96/(fins-1)));
    if(tanks){
      B.add("palu", RBOX(ct*1.25, ch*1.05, bore*0.48, 0.04), fx, y0+ch*0.5,  cw*0.52);
      B.add("palu", RBOX(ct*1.25, ch*1.05, bore*0.48, 0.04), fx, y0+ch*0.5, -cw*0.52);
    }
    return {x:fx, y0:y0, h:ch, w:cw, t:ct};
  };
  if(p.ic==="air_air"){ out.fmic=frontCore(k, 0.30+0.08*k, true); return; }

  /* ---- liquid-to-air ---- */
  var pa, pb, pl=p.plen;
  if(out.lidPorts){ pa=out.lidPorts[0]; pb=out.lidPorts[1]; }
  else if(pl){
    var cwid=(L.vee||L.boxer) ? Math.min(bore*1.55, pl.w) : bore*1.20, chh=bore*0.44*Math.sqrt(k);
    var cy=pl.top + chh*0.5 - bore*0.02;
    B.add("malu", RBOX(pl.len*0.80, chh, cwid, 0.05), pl.x, cy, pl.z);
    for(var f=0; f<7; f++) B.add("malu", BOX(pl.len*0.76, bore*0.04, bore*0.05), pl.x, cy+chh*0.5+bore*0.02, pl.z-cwid*0.40+f*cwid*0.133);
    pa=V3(pl.x+pl.len*0.40, cy, pl.z+cwid*0.28); pb=V3(pl.x+pl.len*0.40, cy, pl.z-cwid*0.28);
  } else {
    /* no plenum to sit on (carb / ITB): an in-line brick ahead of the engine, piped like an air-to-air core */
    out.fmic=frontCore(k*0.8, 0.45, true);
    pa=V3(fx, out.fmic.y0+out.fmic.h, out.fmic.w*0.20); pb=V3(fx, out.fmic.y0+out.fmic.h, -out.fmic.w*0.20);
  }
  B.add("palu", CYL(bore*0.09,bore*0.09,bore*0.24,12), pa.x+bore*0.12, pa.y, pa.z, 0,0,PI/2);
  B.add("palu", CYL(bore*0.09,bore*0.09,bore*0.24,12), pb.x+bore*0.12, pb.y, pb.z, 0,0,PI/2);
  pa=pa.clone().add(V3(bore*0.24,0,0)); pb=pb.clone().add(V3(bore*0.24,0,0));
  var fxH=fx+bore*0.30;                     /* hoses drop ahead of the belt planes (serpentine + blower belt) */
  if(p.ic==="water_air"||p.ic==="a2w_race"||p.ic==="wmi"){
    var hx=out.fmic ? null : frontCore(0.70, 0.22, false);
    if(hx){
      var hT=hx.y0+hx.h;
      B.add("palu", CYL(bore*0.09,bore*0.09,bore*0.20,12), hx.x, hT+bore*0.08, hx.w*0.35);
      B.add("palu", CYL(bore*0.09,bore*0.09,bore*0.20,12), hx.x, hT+bore*0.08, -hx.w*0.35);
      extras.push(hoseMesh([pa, V3(fxH, pa.y, pa.z), V3(fxH, hT+bore*0.60, hx.w*0.35), V3(hx.x, hT+bore*0.16, hx.w*0.35)], bore*0.07));
      extras.push(hoseMesh([pb, V3(fxH, pb.y, pb.z), V3(fxH, hT+bore*0.60, -hx.w*0.35), V3(hx.x, hT+bore*0.16, -hx.w*0.35)], bore*0.07));
      B.add("dark", CYL(bore*0.16,bore*0.16,bore*0.40,12), hx.x-hx.t-bore*0.20, hx.y0+bore*0.20, hx.w*0.36, 0,0,PI/2);   /* pump */
    }
  } else {
    /* ice chest resting on the intake-side rail of the stand (pads are at z = +/-2.34), pump on its end */
    var bw=bore*1.9, bh=bore*1.25, bl=bore*1.5, bxX=bankLen*0.15, bz=-2.14, bY=p.panBot+bh*0.5;
    B.add("blackPlast", RBOX(bl, bh, bw, 0.08), bxX, bY, bz);
    B.add("dark", BOX(bl*0.95, bore*0.06, bw*0.96), bxX, bY+bh*0.52, bz);
    B.add("steel", CYL(bore*0.10,bore*0.10,bore*0.30,10), bxX+bl*0.30, bY+bh*0.58, bz-bw*0.25);
    B.add("malu", CYL(bore*0.20,bore*0.20,bore*0.30,14), bxX+bl*0.5+bore*0.14, bY-bh*0.20, bz, 0,0,PI/2);   /* pump */
    var zD=-(p.caseW*0.52+bore*1.05), top=bY+bh*0.5;
    var hxA=Math.min(pa.x, bankLen*0.45);
    extras.push(hoseMesh([pa, V3(hxA, pa.y+bore*0.10, (pa.z+zD)*0.5), V3(hxA, pa.y-bore*0.20, zD), V3(bxX+bl*0.30, top+bore*0.50, zD), V3(bxX+bl*0.30, top+bore*0.10, bz+bw*0.25), V3(bxX+bl*0.30, top, bz+bw*0.25)], bore*0.07));
    extras.push(hoseMesh([pb, V3(hxA+bore*0.25, pb.y+bore*0.10, (pb.z+zD)*0.5), V3(hxA+bore*0.25, pb.y-bore*0.40, zD-bore*0.2), V3(bxX+bl*0.5+bore*0.45, bY+bore*0.3, zD-bore*0.1), V3(bxX+bl*0.5+bore*0.30, bY, bz), V3(bxX+bl*0.5+bore*0.29, bY-bh*0.20, bz)], bore*0.07));
  }
}

/* Charge pipes, built after buildFAD so the centrifugal head unit's discharge is known:
   compressor discharge -> (front core inlet tank -> outlet tank) -> throttle, with a BOV near the throttle. */
function buildChargeAir(B, p, extras, ai){
  if(!ai || !ai.cout || !ai.cout.length || !ai.tb) return;
  var bore=p.bore, bankLen=p.bankLen, rc=ai.rc, F=ai.fmic, i, c, a, pts;
  var fx=bankLen*0.5+bore*0.45;
  var tIn=ai.tb.pt.clone(), tA=tIn.clone().addScaledVector(ai.tb.dir, bore*0.55), tB=tIn.clone().addScaledVector(ai.tb.dir, bore*1.10);
  var flts=ai.filt||[], clear=function(pts){ return clearOfFilters(pts, flts, rc+bore*0.06); };
  var pipe=function(pts){ pts=clear(pts); extras.push(pipeMesh(B, pts, rc, "tubeAlu", Math.max(24, pts.length*(pts.length>20?2:10)))); };
  if(F){
    var top=F.y0+F.h+bore*0.10, lo=F.y0-bore*0.50, fr=F.x+F.t*0.5+bore*0.55;
    var both=false, pos=false, neg=false;
    for(i=0;i<ai.cout.length;i++){ if(ai.cout[i].pt.z>bore*0.5) pos=true; else if(ai.cout[i].pt.z<-bore*0.5) neg=true; }
    both = pos && neg;
    var neck=function(v){ B.add("palu", CYL(rc*1.05,rc*1.05,bore*0.16,14), v.x, v.y-bore*0.04, v.z); };
    var usedTop={}, outT;
    for(i=0;i<ai.cout.length;i++){
      c=ai.cout[i]; a=c.pt.clone().addScaledVector(c.dir, bore*0.55);
      var sg = both ? (c.pt.z<0?-1:1) : 1, inT=V3(F.x, top, sg*F.w*0.52);
      if(!usedTop[sg]){
        /* into the outer face of the end tank on this side: the hot pipe runs low along the flank, not over the engine */
        usedTop[sg]=true;
        var tankMid=F.y0+F.h*0.55, zOut=sg*(F.w*0.52+bore*0.24), inS=V3(F.x, tankMid, zOut);
        B.add("palu", CYL(rc*1.05,rc*1.05,bore*0.16,14), inS.x, inS.y, inS.z-sg*bore*0.04, PI/2,0,0);
        var zRun=sg*Math.max(Math.abs(a.z), F.w*0.52+bore*0.55), yRun=Math.min(a.y, tankMid+bore*0.6);
        pipe([c.pt, a, V3(fx, yRun, zRun), V3(F.x+bore*0.35, tankMid, zRun), inS]);
      } else {
        /* second pipe on the same side (inline twin): into the bottom of the same tank */
        var inB=V3(F.x, F.y0-bore*0.10, sg*F.w*0.52);
        B.add("palu", CYL(rc*1.05,rc*1.05,bore*0.16,14), inB.x, inB.y+bore*0.04, inB.z);
        pipe([c.pt, a, V3(fx, a.y, a.z), V3(fr, lo, sg*Math.max(Math.abs(a.z), F.w*0.62)), V3(F.x, lo, inB.z), inB]);
      }
    }
    if(both){
      /* dual-inlet core: both end tanks are inlets, the cold side leaves from a centre box on top */
      B.add("palu", RBOX(F.t*1.3, bore*0.30, bore*0.95, 0.04), F.x, F.y0+F.h+bore*0.12, 0);
      outT=V3(F.x, top+bore*0.18, 0); neck(outT);
    } else { outT=V3(F.x, top, -F.w*0.52); neck(outT); }
    var sgT=(tB.z<0?-1:1), zC=sgT*Math.max(Math.abs(tB.z), F.w*0.52, bore*1.2), yC=Math.max(tB.y, outT.y+bore*0.45);
    pipe([outT, V3(outT.x, outT.y+bore*0.45, outT.z), V3(fx, yC, zC), V3((fx+tB.x)*0.5, tB.y, zC), tB, tA, tIn]);
  } else {
    for(i=0;i<ai.cout.length;i++){
      c=ai.cout[i]; a=c.pt.clone().addScaledVector(c.dir, bore*0.55);
      var h2=Math.max(a.y, tB.y);
      pipe(i===0 ? [c.pt, a, V3(fx, h2, a.z), tB, tA, tIn] : [c.pt, a, V3(fx, h2, a.z), tB]);
    }
  }
  /* blow-off valve on the cold pipe, just ahead of the throttle */
  B.add("malu", CYL(bore*0.12,bore*0.14,bore*0.26,12), tA.x, tA.y+rc+bore*0.11, tA.z);
  B.add("dark", CYL(bore*0.16,bore*0.16,bore*0.09,12), tA.x, tA.y+rc+bore*0.28, tA.z);
}

/* ---- belt loop: straight tangent spans + wrap arcs, all in the plane x ----
   pl: [{y,z,r,side}] side +1 = belt runs round the outside (pulley inside the loop),
   -1 = backside idler outside the loop. Points run counter-clockwise in (z,y). */
function beltLoop(x, pl, bt){
  var n=pl.length, i, j, out=[], tn=[];
  for(i=0;i<n;i++){
    var A=pl[i], C=pl[(i+1)%n];
    var ra=(A.r+bt)*A.side, rc=(C.r+bt)*C.side;
    var du=C.z-A.z, dv=C.y-A.y, Ln=Math.sqrt(du*du+dv*dv)||1e-6; du/=Ln; dv/=Ln;
    var c=clamp((ra-rc)/Ln,-0.999,0.999), s=Math.sqrt(1-c*c);
    var nu=du*c+dv*s, nv=dv*c-du*s;            /* span normal, pointing out of the loop */
    tn.push({a:[A.z+nu*ra, A.y+nv*ra], b:[C.z+nu*rc, C.y+nv*rc]});
  }
  for(i=0;i<n;i++){
    var P=pl[i], tin=tn[(i+n-1)%n].b, tout=tn[i].a, R=P.r+bt;
    var a0=Math.atan2(tin[1]-P.y, tin[0]-P.z), a1=Math.atan2(tout[1]-P.y, tout[0]-P.z), da=a1-a0;
    if(P.side>0){ while(da<0) da+=TAU; } else { while(da>0) da-=TAU; }
    var st=Math.max(2, Math.ceil(Math.abs(da)/0.16));
    for(j=0;j<=st;j++){ var t=a0+da*j/st; out.push(V3(x, P.y+Math.sin(t)*R, P.z+Math.cos(t)*R)); }
    var nb=tn[i].b;
    for(j=1;j<=3;j++){ var f=j/4; out.push(V3(x, tout[1]+(nb[1]-tout[1])*f, tout[0]+(nb[0]-tout[0])*f)); }
  }
  return out;
}
/* sort pulleys counter-clockwise round their centroid (valid when every pulley is on the convex hull) */
function ccwOrder(pl){
  var cy=0, cz=0, i;
  for(i=0;i<pl.length;i++){ cy+=pl[i].y; cz+=pl[i].z; }
  cy/=pl.length; cz/=pl.length;
  return pl.slice().sort(function(A,C){ return Math.atan2(A.y-cy,A.z-cz)-Math.atan2(C.y-cy,C.z-cz); });
}
function beltMesh(x, pl, bt, rad, o){
  if(DET && CUR_B){ CUR_B.addW("beltFlat", flatBeltGeo(x, pl, o||{})); return null; }
  var pts=beltLoop(x, ccwOrder(pl), bt);
  var curve=new THREE.CatmullRomCurve3(pts, true, "centripetal");
  var g=new THREE.TubeGeometry(curve, Math.max(96, pts.length*2), rad, 6, true);
  beltUvU(g.attributes.uv, curve.getLength(), pl[0].r+bt);
  if(CUR_B){ CUR_B.addW("belt", g); return null; }
  var m=new THREE.Mesh(g, MAT.belt);
  m.castShadow=true; return m;
}
/* Full / Ultra: a real flat belt. Back is plain fabric-backed rubber; the inside carries poly-V ribs (serpentine) or
   square cogs (blower / dry-sump drive). o: {w width, t thickness, ribs, cog pitch} in scene units. */
function flatBeltGeo(x, pl, o){
  var b=DCTX.bore, t=o.t||b*0.05, w=o.w||b*0.13, ribs=o.ribs===undefined?(o.cog?0:5):o.ribs, cog=o.cog||0;
  var P=beltLoop(x, ccwOrder(pl), t*0.5);
  var curve=new THREE.CatmullRomCurve3(P, true, "centripetal"), len=curve.getLength();
  var N=Math.max(120, Math.min(420, Math.ceil(len/(cog?cog*0.25:t*0.9))));
  /* cross-section (a across the width, d outward from the pulleys), closed loop */
  var prof=[], i, j, rd=t*0.32;
  prof.push([-w/2, t*0.5],[w/2, t*0.5],[w/2,-t*0.5]);
  if(ribs){ for(i=0;i<ribs;i++){ var a0=w/2-(i+0.5)*w/ribs; prof.push([a0,-t*0.5-rd],[a0-w/ribs*0.5,-t*0.5]); } }
  prof.push([-w/2,-t*0.5]);
  var M=prof.length, pos=[], uv=[], idx=[], tan=new THREE.Vector3(), nrm=new THREE.Vector3(), X=new THREE.Vector3(1,0,0);
  for(j=0;j<=N;j++){                                    /* N+1 rings: the last sits on the first, so u runs 0..1 with no seam */
    var u=j/N, c=curve.getPointAt(u%1); curve.getTangentAt(u, tan);
    nrm.set(0, -tan.z, tan.y).normalize();               /* outward, in the belt plane (loop runs ccw in z,y) */
    var tooth = cog ? (((u%1)*len/cog)%1 < 0.5 ? 1 : 0) : 0;
    for(i=0;i<M;i++){
      var d=prof[i][1]; if(cog && d<0) d-=tooth*t*0.55;
      pos.push(c.x+prof[i][0], c.y+nrm.y*d, c.z+nrm.z*d);
      uv.push(u, i===0?0:0.5+0.5*(i-1)/(M-2));   /* the back face gets v 0..0.5 (where the print runs), the ribs the rest */
    }
  }
  for(j=0;j<N;j++) for(i=0;i<M;i++){
    var a=j*M+i, bb=(j+1)*M+i, c2=(j+1)*M+(i+1)%M, d2=j*M+(i+1)%M;
    idx.push(a,d2,bb, bb,d2,c2);
  }
  var g=new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx); g.computeVertexNormals();
  beltUvU(g.attributes.uv, len, pl[0].r+t*0.5);
  return g;
}
/* belt texture u counts crank-pulley angle (BELT_UV per radian at the pulley it is cut for, pl[0], the crank in every caller),
   rounded to whole repeats so the loop has no seam: scrolling the map by BELT_UV x crank angle (loop.js) then moves every belt
   at its own surface speed, give or take the rounding. u in: 0..1 round the loop. */
var BELT_UV = 1.5;
function beltUvU(a, len, R0){
  var rep=Math.max(1, Math.round(len/R0*BELT_UV)), i, n=a.count;
  for(i=0;i<n;i++) a.setX(i, a.getX(i)*rep);
  a.needsUpdate=true;
}
/* a spinning pulley on the X axis: plain disc with a flange lip each side */
function pulleyMesh(r, w, mat, o){
  if(DET) return pulleyHi(r, w, mat, o||{});
  var items=[{g:CYL(r,r,w,26,false,2.4), m:new THREE.Matrix4().makeRotationZ(PI/2)},
             {g:CYL(r*1.10,r*1.10,w*0.12,26,false,2.4), m:new THREE.Matrix4().compose(V3( w*0.47,0,0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,PI/2)), V3(1,1,1))},
             {g:CYL(r*1.10,r*1.10,w*0.12,26,false,2.4), m:new THREE.Matrix4().compose(V3(-w*0.47,0,0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,PI/2)), V3(1,1,1))},
             {g:CYL(r*0.30,r*0.30,w*1.3,12,false,2.4), m:new THREE.Matrix4().makeRotationZ(PI/2)}];
  var m=new THREE.Mesh(mergeGeos(items), mat||MAT.steel); m.castShadow=true; m.receiveShadow=true; return m;
}
/* Full / Ultra pulley: lathe-turned body with flanges, poly-V grooves (or cog teeth) where the belt runs, a hub boss
   and bolt heads (they spin with it). o: {cog, bolts, fan} */
function pulleyHi(r, w, mat, o){
  var b=DCTX.bore, V2=function(x,y){ return new THREE.Vector2(x,y); }, i, pr=[], ribs=o.cog?0:5, gd=Math.min(r*0.05, b*0.012);
  pr.push(V2(0.001, w*0.62), V2(r*0.30, w*0.62), V2(r*0.34, w*0.50), V2(r*0.80, w*0.50), V2(r*0.86, w*0.44),
          V2(r*1.09, w*0.44), V2(r*1.09, w*0.36));
  if(ribs){ for(i=0;i<=ribs*2;i++){ var yy=w*0.36-i*(w*0.72/(ribs*2)); pr.push(V2(i%2 ? r-gd : r, yy)); } }
  else pr.push(V2(r, w*0.36), V2(r, -w*0.36));
  pr.push(V2(r*1.09, -w*0.36), V2(r*1.09, -w*0.44), V2(r*0.86, -w*0.44), V2(r*0.80, -w*0.50), V2(r*0.34,-w*0.50), V2(r*0.30,-w*0.62), V2(0.001,-w*0.62));
  pr.reverse();                                         /* lathe faces point outward for a bottom-to-top profile */
  var lathe=new THREE.LatheGeometry(pr, 30); lathe.rotateZ(-PI/2);
  var items=[{g:lathe, m:new THREE.Matrix4()}];
  if(o.cog){ var nT=Math.max(14, Math.round(TAU*r/(b*0.06)));
    for(i=0;i<nT;i++){ var an=i/nT*TAU; items.push({g:BOX(w*0.72, b*0.022, b*0.028, 6), m:mkM(0, Math.cos(an)*(r+b*0.008), Math.sin(an)*(r+b*0.008), an,0,0)}); } }
  var nb=o.bolts===undefined ? (r>b*0.3?4:3) : o.bolts;
  for(i=0;i<nb;i++){ var ab=i/nb*TAU+0.3, rb=r*(r>b*0.3?0.44:0.52);
    items.push({g:CYL(b*0.034,b*0.034,b*0.03,6,false,6), m:mkM(w*0.62+b*0.012, Math.cos(ab)*rb, Math.sin(ab)*rb, 0,0,PI/2)}); }
  items.push({g:CYL(b*0.05,b*0.05,b*0.04,6,false,6), m:mkM(w*0.62+b*0.02, 0,0, 0,0,PI/2)});   /* centre nut */
  if(o.fan){ /* alternator cooling fan between pulley and case */
    var nf=10; for(i=0;i<nf;i++){ var af=i/nf*TAU; items.push({g:BOX(b*0.022, b*0.12, b*0.028, 6), m:mkM(-w*0.62-b*0.016, Math.cos(af)*r*1.08, Math.sin(af)*r*1.08, af+0.35,0,0)}); }
    items.push({g:CYL(r*0.62,r*0.62,b*0.012,20,false,6), m:mkM(-w*0.62-b*0.016,0,0,0,0,PI/2)}); }
  var m=new THREE.Mesh(mergeGeos(items), mat||MAT.steel); m.castShadow=true; m.receiveShadow=true; return m;
}

