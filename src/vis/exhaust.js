/* ===========================================================================
   7b. EXHAUST
   ==========================================================================*/
function buildExhaust(B, p, extras, exhZ, headY, headH, Z){
  var per=p.per, bore=p.bore, bspace=p.bspace, bankLen=p.bankLen;
  var exh=p.exh, zs=p.zs, tFeed=p.turboFeed||0, boxer=p.L.boxer, vee=p.L.vee;
  var portY = headY + headH*0.48;
  var i, x;
  /* a turbo feed flange, recorded in engine space for buildAspiration */
  function feed(px, py, pz, dx, dy, dz, r){
    EXH_COLL.push({ pt:B.pt(px,py,pz), dir:V3(dx,dy,dz).transformDirection(B.top()).normalize(),
                    bank:p.bankIdx, r:r, cast:(exh.indexOf("cast")===0) });
  }

  if(exh==="cast_log" || exh==="cast_tubular"){
    var thick = exh==="cast_log" ? bore*0.30 : bore*0.20;
    var logZ  = exhZ + Z(bore*0.34);
    /* the log itself */
    if(exh==="cast_log"){
      B.add("castexh", RBOX(bankLen*0.92, thick*1.55, thick*1.5, 0.03), 0, portY, logZ);
    } else {
      B.add("castexh", CYL(thick*0.8, thick*0.8, bankLen*0.92, 14, false, 2.4), 0, portY, logZ, 0,0,PI/2);
    }
    for(i=0;i<per;i++){
      x=-bankLen/2 + bspace*(i+0.5);
      B.add("castexh", CYL(bore*0.155,bore*0.175,bore*0.36,12,false,2.4), x, portY, exhZ+Z(bore*0.18), (PI/2)*zs, 0,0);
      /* port flange */
      B.add("castexh", BOX(bspace*0.44, headH*0.5, bore*0.05), x, portY, exhZ+Z(bore*0.02));
      if(DET) exhPortHW(B, x, portY, exhZ, Z, zs, bspace, headH, bore);
    }
    var cz = logZ + Z(bore*0.34);
    if(p.bankIdx===0){   /* where a cracked manifold splits: round the neck of the (first) outlet, clear of the heat shield */
      var ckx = (tFeed>1) ? -bankLen/2 + bspace*(per/4) : -bankLen*0.10;
      CRACK={ pt:B.pt(ckx, portY+bore*0.205, cz+Z(bore*0.10)), dir:V3(0,1,0.35*zs).transformDirection(B.top()).normalize(), len:bore*0.56 };
    }
    if(DET){
      /* stamped heat shield over the manifold: a crowned top sheet and an outboard lip, split round every outlet */
      var shTop = portY + (exh==="cast_log" ? thick*0.78 : thick*0.80) + bore*0.07;
      var shZ0 = exhZ + Z(bore*0.14), shZ1 = logZ + Z((exh==="cast_log"?thick*0.75:thick*0.80) + bore*0.035);
      var shL = bankLen*0.84, outs=[];
      if(tFeed){ for(var to=0; to<tFeed; to++) outs.push((tFeed===1) ? -bankLen*0.10 : -bankLen/2 + bspace*(to*per/2 + per/4)); } else outs.push(-bankLen*0.10);
      B.add("shield", BOX(shL, bore*0.014, Math.abs(shZ1-shZ0)), 0, shTop, (shZ0+shZ1)/2);
      B.add("shield", BOX(shL, bore*0.014, bore*0.10), 0, shTop-bore*0.02, shZ0 - Z(bore*0.03), 0.45*zs,0,0);
      var segs=[[-shL/2, shL/2]];
      outs.forEach(function(ox){ var nsg=[]; segs.forEach(function(sg){ if(ox-bore*0.34>sg[0]) nsg.push([sg[0], Math.min(sg[1], ox-bore*0.34)]); if(ox+bore*0.34<sg[1]) nsg.push([Math.max(sg[0], ox+bore*0.34), sg[1]]); }); segs=nsg; });
      segs.forEach(function(sg){ var sl=sg[1]-sg[0]; if(sl>bore*0.15) B.add("shield", BOX(sl, bore*0.20, bore*0.014), (sg[0]+sg[1])/2, shTop-bore*0.10, shZ1+Z(bore*0.01), -0.25*zs,0,0); });
      for(var sk=-1; sk<=1; sk+=2){ B.add("steel", CYL(bore*0.03,bore*0.03,bore*0.10,6), sk*shL*0.40, shTop-bore*0.05, (shZ0+shZ1)/2);
        B.hw("hex", sk*shL*0.40, shTop+bore*0.007, (shZ0+shZ1)/2, 0,0,0, bore*0.075); }
      if(!tFeed) o2Sensor(B, V3(-bankLen*0.10+bore*0.26, portY+bore*0.16, cz), V3(0.35,1,0).normalize(), bore, zs);
    }
    if(tFeed){
      /* turbo manifold: an outlet stub and turbine flange per turbo, facing outboard */
      for(var tg=0; tg<tFeed; tg++){
        var tx = (tFeed===1) ? -bankLen*0.10 : -bankLen/2 + bspace*(tg*per/2 + per/4);
        B.add("castexh", CYL(bore*0.22,bore*0.24,bore*0.44,14,false,2.4), tx, portY, cz, (PI/2)*zs,0,0);
        B.add("castexh", BOX(bore*0.58, bore*0.58, bore*0.07), tx, portY, cz+Z(bore*0.23));
        feed(tx, portY, cz+Z(bore*0.27), 0,0,zs, bore*0.21);
      }
      if(tFeed===2) B.add("castexh", BOX(bore*0.05, thick*1.62, thick*1.56), 0, portY, logZ);   /* divided log */
    } else {
      /* collector + downpipe */
      B.add("castexh", CYL(bore*0.22,bore*0.22,bore*0.44,14,false,2.4), -bankLen*0.10, portY, cz, (PI/2)*zs,0,0);
      var dnP=[
        V3(-bankLen*0.10, portY, cz+Z(bore*0.20)),
        V3(-bankLen*0.14, portY-p.deckH*0.35, cz+Z(bore*0.55)),
        V3(-bankLen*0.30, portY-p.deckH*0.95, cz+Z(bore*0.45))
      ];
      extras.push(pipeMesh(B, dnP, bore*0.21, "castexh"));
      exhTail(B, dnP, bore*0.21);
    }
  } else {
    /* tubular headers */
    var equal = (exh==="headers_equal");
    var prim = bore*0.135;
    var groups = tFeed ? tFeed : (per>=5 ? 2 : 1);   /* 6+ cylinders (or an inline twin) -> two collectors */
    var gsize  = Math.ceil(per/groups);
    var zk = (tFeed||boxer) ? 0.62 : 1, yk = tFeed ? 0.55 : 1;   /* turbo / boxer primaries stay tucked in */
    var collZ = exhZ + Z(bore*(tFeed ? 0.95 : boxer ? 0.62 : (equal?1.30:0.90)));
    var collY = portY - p.deckH*(tFeed ? 0.50 : (equal?1.02:0.66));
    for(i=0;i<per;i++){
      x=-bankLen/2 + bspace*(i+0.5);
      /* flange */
      B.add("stainless", BOX(bspace*0.46, headH*0.52, bore*0.05), x, portY, exhZ+Z(bore*0.02));
      if(DET) exhPortHW(B, x, portY, exhZ, Z, zs, bspace, headH, bore);
      var gi = Math.min(groups-1, Math.floor(i/gsize));
      var gStart = gi*gsize, gEnd = Math.min(per, gStart+gsize);
      var collX = (-bankLen/2 + bspace*((gStart+gEnd)/2)) - bspace*0.5;
      var t=(i-gStart)/Math.max(1,(gEnd-gStart-1));
      var pts;
      if(equal){
        /* long, swept, equal-length primaries with a lazy S */
        var loop = 0.28 + (1-Math.abs(t-0.5)*2)*0.55;
        pts=[
          V3(x, portY, exhZ+Z(bore*0.06)),
          V3(x, portY+bore*0.10, exhZ+Z(bore*0.52)),
          V3(x + (collX-x)*0.18, portY - p.deckH*0.10*yk, exhZ+Z(bore*(0.95+loop*0.5)*zk)),
          V3(x + (collX-x)*0.52, portY - p.deckH*(0.30+loop*0.16)*yk, exhZ+Z(bore*(1.15+loop*0.7)*zk)),
          V3(x + (collX-x)*0.82, portY - p.deckH*(0.56+loop*0.10)*yk, exhZ+Z(bore*(1.28+loop*0.25)*zk)),
          V3(collX, collY+bore*0.16, collZ)
        ];
      } else {
        pts=[
          V3(x, portY, exhZ+Z(bore*0.06)),
          V3(x, portY+bore*0.04, exhZ+Z(bore*0.40)),
          V3(x + (collX-x)*0.45, portY - p.deckH*0.18*yk, exhZ+Z(bore*0.72*zk)),
          V3(collX, collY+bore*0.14, collZ)
        ];
      }
      extras.push(pipeMesh(B, pts, prim, "stainless", equal?26:18));
    }
    /* merge collector(s) */
    for(var gj=0; gj<groups; gj++){
      var gS=gj*gsize, gE=Math.min(per,gS+gsize);
      var cX=(-bankLen/2 + bspace*((gS+gE)/2)) - bspace*0.5;
      var nP=gE-gS, cr=prim*Math.sqrt(nP)*0.92;
      if(equal){
        B.add("stainless", CONE(cr, cr*0.66, bore*0.34, 16, 1.0), cX, collY, collZ, 0,0,0);
        B.add("stainless", CYL(cr*0.72, cr*0.72, bore*0.34, 16, false, 1.0), cX, collY-bore*0.32, collZ);
      } else {
        B.add("stainless", CONE(cr*0.66, cr, bore*0.48, 16, 1.0), cX, collY-bore*0.12, collZ, 0,0,0);
      }
      var cBot = collY - bore*(equal?0.49:0.36);
      if(p.bankIdx===0 && gj===0) CRACK={ pt:B.pt(cX, collY-bore*0.10, collZ+Z(cr*0.86)), dir:V3(0,0.2,zs).transformDirection(B.top()).normalize(), len:bore*0.40 };
      if(DET && !tFeed) o2Sensor(B, V3(cX, collY-bore*(equal?0.26:0.18), collZ+Z(cr*0.80)), V3(0,0.45,zs).normalize(), bore, zs);
      if(DET && equal){ B.add("stainless", TOR(cr*0.72, bore*0.018, 5, 18), cX, collY-bore*0.45, collZ, PI/2,0,0); }    /* slip-joint collar */
      if(tFeed){
        /* turbine flange straight off the merge */
        B.add("stainless", BOX(cr*1.9, bore*0.06, cr*1.9), cX, cBot, collZ);
        feed(cX, cBot-bore*0.03, collZ, 0,-1,0, cr*0.72);
      } else {
        /* tail: on a V the bank tilt already carries it low, so it runs back instead of down */
        var tlP=[
          V3(cX, collY-bore*0.46, collZ),
          V3(cX-bore*0.34, collY-bore*(vee?0.25:1.15), collZ+Z(bore*0.10)),
          V3(-bankLen*0.52, collY-bore*(vee?0.30:1.55), collZ-Z(bore*0.05))
        ];
        extras.push(pipeMesh(B, tlP, cr*0.62, "stainless"));
        exhTail(B, tlP, cr*0.62);
      }
    }
  }
}

/* ===========================================================================
   7b'. EXHAUST SYSTEM after the manifold / turbine: pipe(s) of the chosen size, cutout, cat (heat shield),
   muffler can (shape by type) and tips. The stock system lives in the car, so nothing is drawn for it.
   Everything stays at or above the sump so the engine still rests on the stand exactly where it did:
   the run comes down beside the block, then goes back behind the bell housing.
   ==========================================================================*/
var EXH_TAILS=[];   /* collector / downpipe ends, engine space: {pt, dir, r} (filled by buildExhaust / buildAspiration) */
function exhTail(B, localPts, r){
  var n=localPts.length, a=localPts[n-2].clone().applyMatrix4(B.top()), b=localPts[n-1].clone().applyMatrix4(B.top());
  EXH_TAILS.push({ pt:b, dir:b.clone().sub(a).normalize(), r:r });
}
/* a pipe tube with world-scaled uvs, so the steel grain keeps its pitch instead of smearing into a braid */
function exTube(B, g){ if(DET) tubeUV(g, g.parameters.radius); B.addW("steel", g); }
function buildExhSystem(B, p, extras){
  var cfg=p.cfg, SIMx=(typeof ENGINE_SIM!=="undefined")?ENGINE_SIM:null;
  var pipe=pick(cfg.pipe,"stock"), muf=pick(cfg.muffler,"stock"), cat=pick(cfg.cat,"none"), cut=pick(cfg.cutout,"none");
  var catO=SIMx&&SIMx.OPT.cat[cat], dz=isDieselCfg(cfg);
  if(!catO || (catO.fam && catO.fam!==(dz?"ci":"si"))) cat="none";
  if(pipe==="stock" && muf==="stock" && cat==="none" && cut==="none") return null;
  if(!EXH_TAILS.length || !SIMx) return null;
  var bore=p.bore, bankLen=p.bankLen, L=p.L, yLow=p.panBot, i, j, k;
  var tails=EXH_TAILS.slice(), info=SIMx.exhaustInfo(cfg);
  var out={ tip:null };

  /* ---- open headers: a short zoomie off every collector, turned out and up, nothing after it ---- */
  if(pipe==="open"){
    for(i=0;i<tails.length;i++){
      var T=tails[i], sd=T.pt.z>=0?1:-1, r0=T.r;
      var z1=T.pt.clone().addScaledVector(T.dir, bore*0.30);
      var z2=z1.clone().add(V3(-bore*0.30, bore*0.06, sd*bore*0.30));
      var z3=z2.clone().add(V3(-bore*0.30, bore*0.16, sd*bore*0.42));
      exTube(B, TUBE([T.pt, z1, z2, z3], r0, 20, 12));
      var dZ=z3.clone().sub(z2).normalize(), qZ=new THREE.Quaternion().setFromUnitVectors(_UP, dZ);
      B.addM("chrome", TOR(r0*1.0, bore*0.022, 6, 18), new THREE.Matrix4().compose(z3, qZ.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(PI/2,0,0))), new THREE.Vector3(1,1,1)));
      if(DET) B.addM("dark", CYL(r0*0.96, r0*0.96, bore*0.01, 16), new THREE.Matrix4().compose(z3.clone().addScaledVector(dZ, -bore*0.04), qZ, new THREE.Vector3(1,1,1)));
      if(!out.tip) out.tip=z3.clone();
    }
    return out;
  }

  /* ---- sizes: the pipe in scene units (1 = 100 mm); the stock pipe's area comes from the sim ---- */
  var dia = (SIMx.OPT.pipe[pipe]||{}).dia, stockRuns = Math.max(1, Math.min(2, p.banks));
  var runs = dia ? (SIMx.OPT.pipe[pipe].runs||1) : stockRuns;
  var rp = dia ? dia*0.127 : Math.sqrt(info.flow100/0.54/100/stockRuns/PI)*10;   /* A = m/(rho v); m^2 -> units */
  rp = clamp(rp, bore*0.17, bore*0.62);
  var muffD = {
    stock:     { L:bore*2.6, h:bore*0.42, w:bore*0.70, kind:"oval" },
    chambered: { L:bore*2.1, h:bore*0.34, w:bore*0.62, kind:"box" },
    glasspack: { L:bore*2.4, h:rp*1.55, w:rp*1.55, kind:"round" },
    turbo:     { L:bore*2.3, h:bore*0.40, w:bore*0.64, kind:"oval" },
    straight:  null
  }[muf];
  if(muffD){ muffD.h=Math.max(muffD.h, rp*1.25); muffD.w=Math.max(muffD.w, rp*1.30); }
  var catD = cat==="none" ? null : cat==="dpf" ? { L:bore*2.4, r:Math.max(rp*1.85, bore*0.36) } : { L:bore*1.25, r:Math.max(rp*1.6, bore*0.28) };
  var hMax = Math.max(rp, muffD?muffD.h:0, catD?catD.r*(cat==="dpf"?1:0.82):0);
  var yRun = yLow + hMax + bore*0.05;                     /* the whole system runs at one height, its bottom just above the sump */
  var halfW = p.caseW*(L.boxer?0.48:0.5);
  var zLane = halfW + Math.max(rp, (muffD?muffD.w:0), catD?catD.r:0)*0.55 + bore*0.16;
  var xG = -bankLen*0.5 - bore*0.62;
  for(i=0;i<tails.length;i++) xG=Math.min(xG, tails[i].pt.x - bore*0.45);

  /* ---- phase A: every collector / downpipe comes down to its side's lane and back to the bell housing ---- */
  var sides={};
  for(i=0;i<tails.length;i++){ var sg=tails[i].pt.z>=0?1:-1; (sides[sg]||(sides[sg]=[])).push(tails[i]); }
  var sKeys=Object.keys(sides).map(Number).sort(function(a,b){ return b-a; });
  var G={};
  for(i=0;i<sKeys.length;i++){
    var s=sKeys[i], list=sides[s], zl=s*zLane, gp=V3(xG, yRun, zl);
    G[s]=gp;
    for(j=0;j<list.length;j++){
      var T2=list[j], t0=T2.pt, t1=t0.clone().addScaledVector(T2.dir, Math.max(T2.r*1.6, bore*0.22));
      t1.y=Math.max(t1.y, yRun);
      var mid=V3(Math.min(t1.x-bore*0.30, (t1.x+xG)/2), yRun+(t1.y-yRun)*0.30, zl+(t1.z-zl)*0.30);
      var pts=[t0, t1, mid];
      if(mid.x-xG > bore*0.55) pts.push(V3(Math.max(xG+bore*0.30, mid.x-bore*0.6), yRun, zl));
      pts.push(gp);
      exTube(B, TUBE(pts, Math.min(rp, T2.r*1.15), 10*pts.length+8, 12));
    }
    if(list.length>1) B.add("steel", CONE(rp*1.15, rp*1.30, bore*0.30, 16), xG, yRun, zl, 0,0,PI/2);   /* merge collector */
  }

  /* ---- phase B: behind the engine. Merge both sides into one pipe, split one side into two, or carry on ---- */
  var starts=[], xS=xG-bore*0.95;
  var sA=sKeys[0], sB=sKeys[sKeys.length-1];
  if(runs===1 && sKeys.length===2){
    var zm=0, mp=V3(xS, yRun, zm);
    for(i=0;i<2;i++){ var gq=G[sKeys[i]]; exTube(B, TUBE([gq, V3(gq.x-bore*0.30, yRun, gq.z*0.85), V3(xS+bore*0.25, yRun, zm+gq.z*0.20), mp], rp, 26, 12)); }
    B.add("steel", SPH(rp*1.18, 14), mp.x, mp.y, mp.z);
    starts.push(mp);
  } else if(runs===2 && sKeys.length===1){
    var g0=G[sA], zz=[zLane, -zLane];
    for(i=0;i<2;i++){ var sp=V3(xS, yRun, zz[i]); exTube(B, TUBE([g0, V3(g0.x-bore*0.30, yRun, g0.z+(zz[i]-g0.z)*0.12), V3(xS+bore*0.30, yRun, zz[i]-(zz[i]-g0.z)*0.12), sp], rp, 26, 12)); starts.push(sp); }
    B.add("steel", SPH(rp*1.18, 14), g0.x, g0.y, g0.z);
  } else {
    for(i=0;i<sKeys.length;i++){ var gs=G[sKeys[i]], sp2=V3(xS, yRun, gs.z); B.add("steel", CYL(rp, rp, gs.x-xS, 16, true), (gs.x+xS)/2, yRun, gs.z, 0,0,PI/2); starts.push(sp2); }
  }

  /* straight pipe along -x */
  var run=function(x0, x1, y, z, r){ if(x0-x1>1e-3) B.add("steel", CYL(r, r, x0-x1, 18, true), (x0+x1)/2, y, z, 0,0,PI/2); };
  var band=function(x, y, z, r){ B.add("steel", TOR(r*1.04, bore*0.018, 6, 18), x, y, z, 0,PI/2,0); };

  for(k=0;k<starts.length;k++){
    var S0=starts[k], y=S0.y, z=S0.z, x=S0.x, sd2=z>=0?1:-1;
    if(Math.abs(z)<1e-3) sd2=1;
    /* electric cutout: a Y off the pipe, butterfly body, motor and its lead */
    if(cut!=="none"){
      var cx0=x-bore*0.35; run(x, cx0-bore*0.40, y, z, rp);
      var cd=V3(-0.55, 0.25, sd2*0.80).normalize(), c1=V3(cx0, y, z).addScaledVector(cd, rp*0.6), c2=V3(cx0, y, z).addScaledVector(cd, rp+bore*0.42);
      exTube(B, TUBE([V3(cx0+bore*0.10, y, z), c1, c2], rp*0.92, 12, 12));
      var qc=new THREE.Quaternion().setFromUnitVectors(_UP, cd);
      B.addM("steel", CYL(rp*1.22, rp*1.22, bore*0.07, 18), new THREE.Matrix4().compose(c2, qc, new THREE.Vector3(1,1,1)));        /* valve flange */
      var c3=c2.clone().addScaledVector(cd, bore*0.09);
      B.addM("calu", CYL(rp*1.05, rp*1.05, bore*0.12, 18), new THREE.Matrix4().compose(c3, qc, new THREE.Vector3(1,1,1)));          /* butterfly body */
      var mo=c3.clone().add(V3(0, rp*1.05+bore*0.10, 0));
      B.add("dark", BOX(bore*0.26, bore*0.18, bore*0.20), mo.x, mo.y, mo.z);                                                            /* motor */
      B.add("dark", CYL(bore*0.07, bore*0.07, bore*0.16, 12), mo.x-bore*0.18, mo.y, mo.z, 0,0,PI/2);
      if(cut==="open"){ var c4=c3.clone().addScaledVector(cd, bore*0.10); B.addM("dark", CYL(rp*0.80, rp*0.80, bore*0.01, 14), new THREE.Matrix4().compose(c4, qc, new THREE.Vector3(1,1,1))); }
      else { var c5=c3.clone().addScaledVector(cd, bore*0.08); B.addM("steel", CYL(rp*1.10, rp*1.10, bore*0.04, 18), new THREE.Matrix4().compose(c5, qc, new THREE.Vector3(1,1,1))); }   /* cap plate */
      if(DET){
        B.addW("wireBlk", TUBE([V3(mo.x+bore*0.13, mo.y, mo.z), V3(mo.x+bore*0.35, mo.y+bore*0.10, mo.z-sd2*bore*0.10), V3(p.bankLen*-0.5+bore*0.05, p.caseBot+bore*0.10, sd2*(p.caseW*0.5+bore*0.02))], bore*0.018, 16, 5));
      }
      x=cx0-bore*0.40;
    }
    /* catalyst / DOC + DPF with its heat shield */
    if(catD){
      var xc0=x-bore*0.22, xc1=xc0-catD.L, rc=catD.r;
      run(x, xc0, y, z, rp);
      var sq = cat==="dpf" ? 1 : 0.82;               /* a cat is a flattened oval; a DPF a fat round can */
      B.add("steel", CONE(rp, rc*0.92, bore*0.28, 20), xc0-bore*0.14, y, z, 0,0,PI/2);
      B.add("steel", CYL(1, 1, catD.L-bore*0.56, 24), (xc0+xc1)/2, y, z, 0,0,PI/2, rc*sq, 1, rc);
      B.add("steel", CONE(rc*0.92, rp, bore*0.28, 20), xc1+bore*0.14, y, z, 0,0,PI/2);
      if(cat==="dpf"){ band((xc0+xc1)/2+bore*0.25, y, z, rc); }
      if(DET){
        /* stamped heat shield over the top and outboard side, standing off the shell */
        B.add("shield", CYL(1, 1, catD.L-bore*0.70, 24, true), (xc0+xc1)/2, y+bore*0.02, z, 0,0,PI/2, rc*sq+bore*0.06, 1, rc+bore*0.06);
        band(xc0-bore*0.30, y, z, rc*sq*0.98); band(xc1+bore*0.30, y, z, rc*sq*0.98);
        o2Sensor(B, V3(xc0-bore*0.06, y+rp*0.75, z), V3(0,1,0), bore, sd2);
        if(cat==="dpf"){
          /* differential pressure sensor: two pick-up tubes either side of the filter to a sensor box */
          var sb=V3((xc0+xc1)/2, y+rc+bore*0.30, z);
          B.add("dark", BOX(bore*0.30, bore*0.14, bore*0.20), sb.x, sb.y, sb.z);
          exTube(B, TUBE([V3(xc0-bore*0.20, y+rc*0.8, z), V3(xc0-bore*0.25, sb.y, z), V3(sb.x+bore*0.15, sb.y, z)], bore*0.025, 12, 6));
          exTube(B, TUBE([V3(xc1+bore*0.20, y+rc*0.8, z), V3(xc1+bore*0.25, sb.y, z), V3(sb.x-bore*0.15, sb.y, z)], bore*0.025, 12, 6));
        }
      }
      x=xc1;
    }
    /* muffler */
    var xm0=x-bore*0.28;
    run(x, xm0, y, z, rp);
    if(muffD){
      var xm1=xm0-muffD.L, mc=(xm0+xm1)/2;
      if(muffD.kind==="box"){
        B.add("steel", RBOX(muffD.L, muffD.h*2, muffD.w*2, bore*0.08), mc, y, z);
        if(DET) for(i=0;i<3;i++) B.add("steel", BOX(bore*0.03, muffD.h*2.02, muffD.w*2.02), xm0-muffD.L*(0.2+i*0.3), y, z);   /* chamber seams */
      } else {
        B.add("steel", CYL(1, 1, muffD.L, 28), mc, y, z, 0,0,PI/2, muffD.h, 1, muffD.w);
      }
      if(DET){
        /* rolled end-cap rims and a stamped part label */
        if(muffD.kind!=="box"){
          B.add("steel", TOR(1, bore*0.02/Math.max(muffD.h,muffD.w), 6, 28), xm0-bore*0.02, y, z, 0,PI/2,0, muffD.w*0.99, muffD.h*0.99, 1);
          B.add("steel", TOR(1, bore*0.02/Math.max(muffD.h,muffD.w), 6, 28), xm1+bore*0.02, y, z, 0,PI/2,0, muffD.w*0.99, muffD.h*0.99, 1);
        }
        if(muf==="glasspack") for(i=1;i<=3;i++) B.add("steel", TOR(muffD.h*1.0, bore*0.012, 5, 22), xm0-muffD.L*i/4, y, z, 0,PI/2,0);
        if(DET>=2 && muf!=="glasspack") B.add("connGrey", BOX(bore*0.50, bore*0.012, bore*0.24), mc, y+muffD.h*(muffD.kind==="box"?1.0:0.99)+bore*0.006, z);
      }
      x=xm1;
    } else {
      run(xm0, xm0-bore*1.2, y, z, rp);      /* straight pipe: tube all the way */
      if(DET) band(xm0-bore*0.6, y, z, rp);
      x=xm0-bore*1.2;
    }
    /* tail pipe and tip */
    var xt0=x-bore*0.30;
    run(x, xt0, y, z, rp);
    var tipR=rp*(dia && dia>=3 ? 1.22 : 1.32), tipL=bore*0.62;
    B.add("chrome", CYL(tipR, tipR*0.96, tipL, 22, true), xt0-tipL/2, y, z, 0,0,PI/2);
    B.add("chrome", CONE(rp*1.02, tipR*0.96, bore*0.10, 22), xt0+bore*0.02, y, z, 0,0,PI/2);
    if(DET){
      B.add("dark", CYL(tipR*0.94, tipR*0.94, bore*0.01, 18), xt0-tipL*0.55, y, z, 0,0,PI/2);   /* looking down the bore */
      if(DET>=2) B.add("chrome", TOR(tipR*0.98, bore*0.02, 6, 24), xt0-tipL, y, z, 0,PI/2,0);   /* rolled lip */
    }
    if(!out.tip) out.tip=V3(xt0-tipL, y, z);
  }
  return out;
}

/* Full / Ultra: two studs + nuts on a port flange (diagonal), and a gasket edge showing round it on Ultra */
function exhPortHW(B, x, y, exhZ, Z, zs, bspace, headH, bore){
  B.hw("stud", x-bspace*0.15, y+headH*0.16, exhZ+Z(bore*0.045), zs*PI/2,0,0, bore*0.10);
  B.hw("stud", x+bspace*0.15, y-headH*0.16, exhZ+Z(bore*0.045), zs*PI/2,0,0, bore*0.10);
  if(DET>=2) B.add("gasket", BOX(bspace*0.49, headH*0.56, bore*0.012), x, y, exhZ+Z(bore*0.004));
}
/* oxygen sensor in a weld boss: boss, hex, body, pigtail to a clipped connector. pt/dir in builder space */
function o2Sensor(B, pt, dir, bore, zs){
  var q=new THREE.Quaternion().setFromUnitVectors(V3(0,1,0), dir), e=new THREE.Euler().setFromQuaternion(q);
  var at=function(d){ return pt.clone().addScaledVector(dir, d); };
  var p1=at(bore*0.02), p2=at(bore*0.08), p3=at(bore*0.17);
  B.add("stainless", CYL(bore*0.07,bore*0.075,bore*0.06,10), p1.x,p1.y,p1.z, e.x,e.y,e.z);
  B.add("steel", CYL(bore*0.058,bore*0.058,bore*0.05,6), p2.x,p2.y,p2.z, e.x,e.y,e.z);
  B.add("steel", CYL(bore*0.035,bore*0.04,bore*0.12,8), p3.x,p3.y,p3.z, e.x,e.y,e.z);
  var t0=B.pt(p3.x+dir.x*bore*0.06, p3.y+dir.y*bore*0.06, p3.z+dir.z*bore*0.06);
  var tEnd=at(bore*0.22).add(V3(-bore*0.26, bore*0.30, -zs*bore*0.30)), tE=B.pt(tEnd.x,tEnd.y,tEnd.z), tM=B.pt(p3.x+dir.x*bore*0.20, p3.y+dir.y*bore*0.20+bore*0.12, p3.z+dir.z*bore*0.20-zs*bore*0.08);   /* pigtail leans back toward the block */
  B.addW("wireBlk", TUBE([t0, tM, tE], bore*0.016, 10, 5));
  B.add("connGrey", BOX(bore*0.12, bore*0.07, bore*0.08), tEnd.x-bore*0.04, tEnd.y, tEnd.z);
}

/* pipe in the current builder space, emitted as a separate live-material mesh */
var LAST_PIPE_END=null, CRACK=null;   /* CRACK: {pt, dir, len} engine space, bank 0 manifold (failure FX) */
function pipeMesh(B, localPts, rad, matKey, seg){
  var world=[], i;
  for(i=0;i<localPts.length;i++) world.push(localPts[i].clone().applyMatrix4(B.top()));
  LAST_PIPE_END = world[world.length-1].clone();
  PIPE_LOG.push({pts:world, rad:rad});
  if(CUR_B){
    var tg=TUBE(world, rad, seg||18, 10);
    if(DET && (matKey==="palu" || matKey==="castexh")) tubeUV(tg, rad);   /* stainless keeps u 0..1: its heat tint runs from the flange */
    else if(DET){ var tuv=tg.attributes.uv, kv=Math.max(1, Math.round(TAU*rad*TK*2)); for(var ti=0;ti<tuv.count;ti++) tuv.setY(ti, tuv.getY(ti)*kv); }   /* finer grain round the pipe */
    CUR_B.addW(matKey, tg); return null;                                   /* the bucket gets the live material */
  }
  var m=new THREE.Mesh(TUBE(world, rad, seg||18, 10), MAT[matKey]);
  m.userData.liveKey = matKey;
  m.castShadow=true; m.receiveShadow=true;
  return m;
}

