/* ===========================================================================
   7. ENGINE BUILDER
   ==========================================================================*/
var K = 0.01;   /* mm -> scene units (1 unit = 100 mm) */

function buildEngineMesh(cfg, layoutObj){
  var t0 = (typeof performance!=="undefined")?performance.now():0;
  cfg = cfg||{};
  var L  = normLayout(cfg, layoutObj);
  var n=L.n, banks=L.banks, per=Math.max(1, Math.round(n/banks));

  var bore   = pick(cfg.bore,86)*K;
  var stroke = pick(cfg.stroke,86)*K;
  var rr     = pick(cfg.rodRatio,1.65);
  var head   = pick(cfg.head,"dohc4v");
  var intake = pick(cfg.intake,"single_tb");
  var asp    = pick(cfg.asp,"na");
  var exh    = pick(cfg.exhaust,"cast_log");
  var oilSys = pick(cfg.oilSystem,"wet");
  var blockMat = pick(cfg.blockMat,"grey_iron");
  var headMat  = pick(cfg.headMat,"alu");
  var ic     = pick(cfg.ic,"none");
  var damper = pick(cfg.damper,"rubber");
  var tsz    = pick(cfg.turboSize,"medium");
  var coverCol = COVER_COLORS[pick(cfg.cover,"red")] || COVER_COLORS.red;

  var pushrod = (head==="pushrod2v");
  var sohc    = (head==="sohc2v");
  var dohc    = (head.indexOf("dohc")===0);
  var vvt     = (head==="dohc4v_vvt"||head==="dohc4v_vvl");
  var vvl     = (head==="dohc4v_vvl");

  /* --- key dimensions (derived, so a 6.2 V8 dwarfs a 1.0 I3) --- */
  var bspace  = bore*1.24 + 0.10;                 /* bore spacing        */
  var bankLen = per*bspace + bore*0.46;
  var deckH   = stroke*0.5 + stroke*rr + bore*0.34;   /* crank axis -> deck */
  var bankW   = bore*1.62;
  var headH   = pushrod ? bore*0.80 : (sohc ? bore*0.92 : bore*1.02);
  var coverH  = pushrod ? bore*0.66 : (sohc ? bore*0.50 : bore*0.58);
  var caseH   = stroke*0.55 + bore*0.42;          /* crank axis -> case bottom */
  var caseW   = L.vee ? bankW*1.55 : bore*1.94;
  var caseBot = -caseH;
  var caseTop = L.vee ? bore*0.46 : bore*0.62;    /* where the barrels start */
  var skirt   = caseTop;

  var blockKey = (blockMat==="cgi"||blockMat==="cgi_filled") ? "cgi" : (blockMat.indexOf("alu")===0 ? "calu" : "iron");
  var headKey  = (headMat==="iron") ? "iron" : "calu";
  var liner    = (blockMat==="alu_nikasil") ? "nikasil" : "steel";

  var B = new Builder();
  DET = (GFX==="ultra") ? 2 : (GFX==="full") ? 1 : 0;   /* 0 Lite = the v1.5 model, 1 Full = medium detail, 2 Ultra = everything */
  if(DET) buildHiMaterials();
  HW = DET ? {} : null; CUR_B = B; DCTX = { cfg:cfg, L:L, bore:bore, stroke:stroke, per:per, n:n }; ENGD = {};
  var G = new THREE.Group();               /* engine assembly group        */
  var extras = [];                         /* separately-animated meshes   */
  ZONE_MARKS=[]; ZONE_EXTRAS=extras; setZone(1);   /* 1 crankcase: rods, crank, bearings */
  var boltXf = [];                         /* instanced bolt transforms    */
  var a = deg(L.angle/2);
  if(isRotaryCfg(cfg)) return buildRotaryMesh(cfg, L, B, G, extras, t0);   /* Wankel: housings and rotors, no block at all */
  if(isTwoStrokeCfg(cfg)) return buildTwoStrokeMesh(cfg, L, B, G, extras, t0);   /* two-stroke: ported barrels, pipes, reeds or a blower */

  /* ---------- crankcase / block skirt ---------- */
  var caseSpan = caseTop - caseBot;
  var caseMid  = (caseTop + caseBot)/2;
  if(L.boxer){
    /* boxer: a single wide central crankcase, banks come out sideways */
    B.add(blockKey, RBOX(bankLen+bore*0.28, bore*1.5, caseW*0.95, 0.04), 0, 0, 0);
    B.add(blockKey, BOX(bore*0.16, bore*1.7, caseW), -(bankLen+bore*0.28)/2-bore*0.06, 0, 0);
  } else {
    B.add(blockKey, RBOX(bankLen+bore*0.26, caseSpan, caseW, 0.035), 0, caseMid, 0);
    /* bell-housing flange at the rear */
    B.add(blockKey, BOX(bore*0.16, caseSpan*1.06, caseW*1.06), -(bankLen+bore*0.26)/2-bore*0.06, caseMid, 0);
    /* tapered skirt below the pan rail */
    B.add(blockKey, BOX(bankLen*0.98, bore*0.10, caseW*1.04), 0, caseBot+bore*0.05, 0);
  }
  /* main-cap webbing ribs on the sides of the crankcase */
  var ci, rx;
  for(ci=0; ci<=per; ci++){
    rx = -bankLen/2 + ci*bspace;
    B.add(blockKey, BOX(bore*0.14, caseSpan*0.55, caseW*1.05, TK), rx, caseBot+caseSpan*0.30, 0);
  }
  /* ---- cast-in block detail: motor-mount pads, freeze plugs, boss ribs ---- */
  var sideZ = caseW*0.5;
  for(var sgn=-1; sgn<=1; sgn+=2){
    /* motor mount pad */
    B.add(blockKey, BOX(bore*0.62, bore*0.42, bore*0.10), -bankLen*0.06, caseBot+caseSpan*0.55, sgn*sideZ);
    boltXf.push(new THREE.Matrix4().makeTranslation(-bankLen*0.06-bore*0.18, caseBot+caseSpan*0.55, sgn*(sideZ+bore*0.05))
      .multiply(new THREE.Matrix4().makeRotationX(sgn*PI/2)));
    boltXf.push(new THREE.Matrix4().makeTranslation(-bankLen*0.06+bore*0.18, caseBot+caseSpan*0.55, sgn*(sideZ+bore*0.05))
      .multiply(new THREE.Matrix4().makeRotationX(sgn*PI/2)));
  }
  /* oil filter canister + adapter (the only filter): low on the +Z side; a boxer hangs it under the bank-0 barrel beside the sump */
  if(!L.boxer){
    var ofZ = caseW*0.52+bore*0.24, ofY = caseBot+caseSpan*0.34;
    B.add("calu", CYL(bore*0.22,bore*0.22,bore*0.14,14,false,2.4), bankLen*0.16, ofY, caseW*0.5+bore*0.06, PI/2,0,0);
    B.add("paintBlue", CYL(bore*0.32,bore*0.32,bore*0.62,20,false,1.8), bankLen*0.16, ofY, ofZ+bore*0.14, PI/2,0,0);
    B.add("paintBlue", CYL(bore*0.30,bore*0.30,bore*0.05,20,false,1.8), bankLen*0.16, ofY, ofZ+bore*0.46, PI/2,0,0);
  } else {
    var obZ = caseW*0.43+bore*0.36, obY = -bankW*0.5;
    B.add("calu", CYL(bore*0.22,bore*0.22,bore*0.12,14,false,2.4), bankLen*0.30, obY-bore*0.06, obZ);
    B.add("paintBlue", CYL(bore*0.32,bore*0.32,bore*0.62,20,false,1.8), bankLen*0.30, obY-bore*0.43, obZ);
  }
  /* starter (the only one): bolted to the bell-housing flange, motor forward along the block with the solenoid piggy-backed
     and the nose through the flange to the ring gear; a boxer carries it on the transmission side, above the flywheel */
  var sdir = L.boxer ? -1 : 1;
  var stX = L.boxer ? -(bankLen/2) - bore*0.28 : -(bankLen/2) - bore*0.11;
  var stY = L.boxer ? bore*0.78 : caseBot + caseSpan*0.24;
  var stZ = L.boxer ? -bore*1.00 : -(caseW*0.5 + bore*0.22);
  B.add("dark",  CYL(bore*0.25,bore*0.25,bore*0.70,16,false,2.0), stX + sdir*bore*0.37, stY, stZ, 0,0,PI/2);
  B.add("steel", CYL(bore*0.13,bore*0.13,bore*0.44,12,false,2.4), stX + sdir*bore*0.30, stY + bore*0.33, stZ, 0,0,PI/2);
  B.add("calu",  CYL(bore*0.17,bore*0.21,bore*0.14,14,false,2.4), stX - sdir*bore*0.05, stY, stZ, 0,0,PI/2);
  /* knock sensor + oil pressure sender */
  B.add("dark", CYL(bore*0.09,bore*0.09,bore*0.10,10,false,3.0), bankLen*0.02, caseBot+caseSpan*0.62, -sideZ-bore*0.05, PI/2,0,0);
  B.add("steel", CYL(bore*0.07,bore*0.07,bore*0.16,8,false,3.0), -bankLen*0.30, caseBot+caseSpan*0.66, sideZ+bore*0.08, PI/2,0,0);
  if(DET){
    /* bell-housing bolt bosses cast round the rear flange, bolt heads facing forward */
    var flF = -(bankLen+bore*(L.boxer?0.28:0.26))/2 + bore*0.02, bb, bossL=bore*0.16;
    var bossAt = L.boxer ? [[bore*0.80,-bore*0.40],[bore*0.80,bore*0.40],[-bore*0.80,-bore*0.40],[-bore*0.80,bore*0.40]]
                         : [[caseMid+caseSpan*0.30,1],[caseMid-caseSpan*0.05,1],[caseMid-caseSpan*0.38,1],[caseMid+caseSpan*0.30,-1],[caseMid-caseSpan*0.05,-1],[caseMid-caseSpan*0.38,-1]];
    for(bb=0; bb<bossAt.length; bb++){
      var byb=bossAt[bb][0], bzb = L.boxer ? bossAt[bb][1] : bossAt[bb][1]*(caseW*0.5+bore*0.035);
      B.add(blockKey, CYL(bore*0.075,bore*0.085,bossL,10), flF+bossL*0.5-bore*0.02, byb, bzb, 0,0,PI/2);
      B.hw("hex", flF+bossL-bore*0.02, byb, bzb, 0,0,-PI/2, bore*0.12);
    }
    /* motor-mount bosses through the pads */
    for(sgn=-1; sgn<=1; sgn+=2) B.add(blockKey, CYL(bore*0.12,bore*0.15,bore*0.10,14), -bankLen*0.06, caseBot+caseSpan*0.55, sgn*(sideZ+bore*0.09), PI/2,0,0);
  }

  /* ---------- oil pan / sump ---------- */
  setZone(6);
  var panH, panKey;
  if(oilSys==="dry"){ panH = bore*0.26; panKey="malu"; }
  else if(oilSys==="baffled"){ panH = stroke*0.95; panKey="calu"; }
  else { panH = stroke*0.88; panKey="steel"; }
  var panTop = L.boxer ? -bore*0.72 : caseBot;
  B.add(panKey, RBOX(bankLen*0.94, panH, caseW*0.86, 0.03), 0, panTop - panH/2, 0);
  /* sump plug + rail flange */
  B.add("steel", CYL(bore*0.075,bore*0.075,0.04,10), bankLen*0.28, panTop-panH+0.01, caseW*0.20);
  if(oilSys==="baffled"){
    /* windage tray lip + external kickout */
    B.add("calu", BOX(bankLen*0.5, panH*0.42, caseW*0.30), -bankLen*0.16, panTop-panH*0.78, caseW*0.44);
  }
  /* dry-sump pump, drive and tank: see buildFAD */
  if(DET>=2 && !L.boxer){
    /* pan gasket line and the rail bolts along both sides */
    B.add("gasket", BOX(bankLen*0.945, bore*0.016, caseW*0.866), 0, panTop-bore*0.008, 0);
    var nPb=Math.max(4, Math.floor(bankLen*0.92/(bore*0.62)));
    for(var pb=0; pb<nPb; pb++){ var pbx=-bankLen*0.44 + pb*(bankLen*0.88/(nPb-1));
      B.hw("hex", pbx, caseBot-0.003, caseW*0.475, PI,0,0, bore*0.09); B.hw("hex", pbx, caseBot-0.003, -caseW*0.475, PI,0,0, bore*0.09); }
    B.hw("hex", bankLen*0.28, panTop-panH-0.002, caseW*0.20, PI,0,0, bore*0.13);    /* drain plug head */
  }

  /* ---------- banks ---------- */
  setZone(2);
  var bankInfo=[];
  EXH_COLL=[]; EXH_TAILS=[]; PIPE_LOG=[]; CRACK=null;
  var tFeed = (asp==="turbo"||asp==="twin_turbo"||asp==="compound") ? ((banks===1 && asp==="twin_turbo") ? 2 : 1) : 0;
  for(var bk=0; bk<banks; bk++){
    var zs = (bk===0) ? 1 : -1;
    var ang = (banks===1) ? 0 : (bk===0 ? a : -a);
    var bm=new THREE.Matrix4().makeRotationX(ang);
    B.push(bm); setZone(2);
    var info = buildBank(B, {
      zs:zs, per:per, bore:bore, stroke:stroke, bankLen:bankLen, bankW:bankW,
      deckH:deckH, skirt:skirt, headH:headH, coverH:coverH, bspace:bspace,
      blockKey:blockKey, headKey:headKey, liner:liner,
      head:head, pushrod:pushrod, sohc:sohc, dohc:dohc, vvt:vvt, vvl:vvl,
      intake:intake, asp:asp, exh:exh, L:L, cfg:cfg, bankIdx:bk, boltXf:boltXf, turboFeed:tFeed,
      matrix:B.top().clone()
    }, extras);
    bankInfo.push(info);
    B.pop();
  }

  if(isDieselCfg(cfg)){ setZone(0); dieselFuel(B, { cfg:cfg, L:L, bore:bore, bankLen:bankLen, bankW:bankW, deckH:deckH, skirt:skirt, bspace:bspace, per:per }, bankInfo, extras); }
  if(isGasCfg(cfg)){ setZone(0); gasHardware(B, { cfg:cfg, bore:bore, bankLen:bankLen, caseW:caseW, deckH:deckH, floorY:panTop-panH }); }

  /* ---------- internals: crank, rods, pistons (X-ray) ---------- */
  setZone(1);
  (function(){
    var r = stroke/2, ch = bore*0.34, Lr = Math.max(r*1.6, deckH - r - ch);   /* rod length that puts TDC at the deck */
    var nT = per;
    var ph = nT===1?[0]:nT===2?[0,180]:nT===3?[0,120,240]:nT===4?((L.vee&&cfg.layout!=="V8F")?[0,90,270,180]:[0,180,180,0]):nT===5?[0,144,288,72,216]:nT===6?[0,120,240,240,120,0]:null;
    if(!ph){ ph=[]; for(var q=0;q<nT;q++) ph.push(q*360/nT); }
    var IG = new THREE.Group(); IG.name="internals"; IG.visible=false;
    var crank = new THREE.Group();
    var journal = new THREE.Mesh(CYL(bore*0.19, bore*0.19, bankLen+bore*0.30, 18), MAT.steel);
    journal.rotation.z = PI/2; crank.add(journal);
    var throws=[];
    for(var ti=0; ti<nT; ti++){
      var tx = -bankLen/2 + bspace*(ti+0.5), f0 = deg(ph[ti]);
      /* a true boxer gives each opposed cylinder its own pin 180° apart, so opposite pistons reach TDC together */
      for(var pn=0; pn<(L.boxer?2:1); pn++){
        var fp = f0 + pn*PI, pxo = L.boxer ? (pn? 1 : -1)*bspace*0.12 : 0;
        var pin = new THREE.Mesh(CYL(bore*0.15, bore*0.15, bspace*(L.boxer?0.22:0.46), 14), MAT.palu);
        pin.rotation.z = PI/2; pin.position.set(tx+pxo, r*Math.cos(fp), r*Math.sin(fp)); crank.add(pin);
      }
      for(var wsd=-1; wsd<=1; wsd+=2){
        var web = new THREE.Mesh(BOX(bore*0.10, r+bore*0.36, bore*0.60), MAT.steel);
        web.position.set(tx + wsd*bspace*0.30, 0, 0); web.rotation.x = f0; web.translateY((r+bore*0.36)/2 - bore*0.18); crank.add(web);
        var cw = new THREE.Mesh(BOX(bore*0.10, r*0.9+bore*0.20, bore*0.72), MAT.steel);
        cw.position.set(tx + wsd*bspace*0.30, 0, 0); cw.rotation.x = f0 + PI; cw.translateY((r*0.9+bore*0.20)/2 - bore*0.05); crank.add(cw);
      }
      throws.push({x:tx, phase:f0});
    }
    IG.add(crank);
    var cyls=[];
    for(var bk2=0; bk2<banks; bk2++){
      var ang2 = (banks===1) ? 0 : (bk2===0 ? a : -a);
      for(var ci2=0; ci2<per; ci2++){
        var piston = new THREE.Mesh(CYL(bore*0.485, bore*0.485, bore*0.56, 24), MAT.palu);
        var rod = new THREE.Mesh(BOX(bore*0.15, Lr, bore*0.09), MAT.steel);
        IG.add(piston); IG.add(rod);
        var bxo = L.boxer ? (bk2 ? 1 : -1)*bspace*0.12 : 0;
        cyls.push({ang:ang2, x:throws[ci2].x, px:throws[ci2].x+bxo, phase:throws[ci2].phase + (L.boxer && bk2 ? PI : 0), piston:piston, rod:rod});
      }
    }
    G.add(IG);
    anim.internals = {group:IG, crank:crank, r:r, L:Lr, ch:ch, cyls:cyls, theta:0, pistonH:bore*0.56};
  })();

  /* ---------- intake ---------- */
  setZone(0);
  LAST_TB=null; LAST_PLEN=null;
  buildIntake(B, {
    L:L, per:per, banks:banks, bore:bore, bankLen:bankLen, bankW:bankW, deckH:deckH,
    headH:headH, coverH:coverH, bspace:bspace, intake:intake, asp:asp, a:a,
    pushrod:pushrod, dohc:dohc, bankInfo:bankInfo, boltXf:boltXf
  }, extras);

  /* ---------- aspiration ---------- */
  setZone(5);
  var aspInfo = buildAspiration(B, {
    L:L, per:per, banks:banks, bore:bore, stroke:stroke, bankLen:bankLen, bankW:bankW,
    deckH:deckH, headH:headH, coverH:coverH, caseH:caseH, caseW:caseW, panTop:panTop,
    asp:asp, tsz:tsz, ic:ic, turbineMat:pick(cfg.turbineMat,"cast_iron"),
    intake:intake, a:a, bankInfo:bankInfo, exh:exh,
    panBot:panTop-panH, caseBot:caseBot, tb:LAST_TB, plen:LAST_PLEN
  }, extras);

  /* ---------- front accessory drive ---------- */
  setZone(7);
  buildFAD(B, {
    L:L, bore:bore, stroke:stroke, bankLen:bankLen, bankW:bankW, caseW:caseW, caseH:caseH,
    deckH:deckH, damper:damper, a:a, cfg:cfg, aspInfo:aspInfo, head:head,
    panTop:panTop, oilSys:oilSys
  }, extras);

  /* ---------- charge pipes (after the FAD so a centrifugal head unit's discharge is known) ---------- */
  setZone(5);
  buildChargeAir(B, { bore:bore, bankLen:bankLen }, extras, aspInfo);

  /* ---------- exhaust system after the manifold / turbine (nothing for the stock system) ---------- */
  setZone(4);
  var exSys = buildExhSystem(B, { cfg:cfg, L:L, bore:bore, bankLen:bankLen, caseW:caseW, panBot:panTop-panH, caseBot:caseBot, deckH:deckH, banks:banks }, extras);

  /* ---------- flywheel / flexplate ---------- */
  setZone(1);
  var fwX = -(bankLen/2) - bore*0.36;
  var fwR = bore*0.92;
  var fw = new THREE.Mesh(mergeGeos([
      {g:CYL(fwR,fwR,bore*0.11,30,false,1.6), m:new THREE.Matrix4().makeRotationZ(PI/2)},
      {g:TOR(fwR*0.99, bore*0.055, 8, 34, 1.6),
       m:new THREE.Matrix4().compose(new THREE.Vector3(bore*0.05,0,0),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0,PI/2,0)), new THREE.Vector3(1,1,1))}
    ]), MAT.steel);
  fw.position.set(fwX,0,0); fw.castShadow=true; fw.receiveShadow=true;
  extras.push(fw); anim.spin.push({o:fw, axis:"x", k:1});

  /* ---------- nitrous: bottle(s) strapped down on a stand rail, solenoids at the throttle, lines to a plate or port nozzles ---------- */
  setZone(3);
  var n2o = pick(cfg.nitrous,"none"); N2O_PURGE=null;
  if(n2o!=="none"){
    var nk = (typeof ENGINE_SIM!=="undefined" && ENGINE_SIM.OPT.nitrous[n2o]) || {};
    var big = (n2o==="prog400"||n2o==="prog700"), two=(n2o==="prog700"), wet=(n2o==="wet150")||!!nk.plate, dry=(nk.kind==="dry"||nk.kind==="diesel");
    var bR = bore*(big?0.36:0.30), bL = bore*(big?2.1:1.7), nBot = panTop-panH;
    /* stand pads run along X at z = +/-2.34 and x = +/-3.4 (buildStand); a boxer's exhausts fill the rails under the heads, so its bottle goes ahead of the engine */
    var bX = L.boxer ? Math.min(bankLen*0.5 + bL*0.5 + bore*0.6, 3.3 - bL*0.5) : -Math.min(bankLen*0.30, 3.3 - bL*0.5);
    var bY = nBot + bR + bore*0.06, bZ = 2.34 + bR*0.9;
    var vX = bX + bL*0.5 + bR*0.75;
    for(var nb=0; nb<(two?2:1); nb++){
      var zz = bZ + nb*bR*2.3;
      B.add("anod", CYL(bR, bR, bL, 22), bX, bY, zz, 0,0,PI/2);
      B.add("anod", CYL(bR*0.98, bR*0.55, bR*0.6, 22), bX+bL*0.5+bR*0.28, bY, zz, 0,0,PI/2);
      B.add("chrome", CYL(bR*0.22, bR*0.22, bR*0.5, 10), vX, bY, zz, 0,0,PI/2);
      B.add("dark", BOX(bore*0.10, bR*2.1, bR*2.3), bX-bL*0.28, bY, zz);
      B.add("dark", BOX(bore*0.10, bR*2.1, bR*2.3), bX+bL*0.28, bY, zz);
      /* heater blanket round the middle of the bottle, its thermostat box, and a pressure gauge on the valve */
      B.add("rubberFlat", CYL(bR*1.06, bR*1.06, bL*0.36, 22, true), bX, bY, zz, 0,0,PI/2);
      B.add("wireRed", BOX(bR*0.55, bR*0.30, bR*0.40), bX, bY+bR*1.12, zz);
      B.add("chrome", CYL(bR*0.36, bR*0.36, bR*0.16, 16), vX+bR*0.05, bY+bR*0.62, zz, PI/2,0,0);
      B.add("blackPlast", CYL(bR*0.30, bR*0.30, bR*0.17, 16), vX+bR*0.05, bY+bR*0.62, zz+bR*0.01, PI/2,0,0);
    }
    var ntb = (aspInfo && aspInfo.tb) || LAST_TB;
    var sP;
    if(ntb){
      sP = ntb.dir.y>0.5 ? V3(ntb.pt.x+bore*0.75, ntb.pt.y-bore*0.10, ntb.pt.z)
                         : ntb.pt.clone().addScaledVector(ntb.dir, -bore*0.25).add(V3(0, bore*0.45, 0));
    } else sP = V3(-(bankLen/2)+bore*0.4, deckH + headH*0.9, -(caseW*0.5 + bore*0.1));
    B.add("anod", BOX(bore*0.22, bore*0.30, bore*0.22), sP.x, sP.y, sP.z-bore*0.16);
    if(!dry) B.add("anod", BOX(bore*0.22, bore*0.30, bore*0.22), sP.x, sP.y, sP.z+bore*0.16);   /* a dry kit has no fuel solenoid */
    /* purge solenoid on a tee off the feed, and its nozzle pointing up and out of the bay */
    var pgP = V3(sP.x, sP.y+bore*0.42, sP.z-bore*0.42);
    B.add("chrome", BOX(bore*0.16, bore*0.20, bore*0.16), pgP.x, pgP.y, pgP.z);
    B.add("steel", CYL(bore*0.025, bore*0.025, bore*0.34, 8), pgP.x, pgP.y+bore*0.10, pgP.z-bore*0.16, -0.75,0,0);
    var pgM = new THREE.Object3D(); pgM.position.set(pgP.x, pgP.y+bore*0.24, pgP.z-bore*0.30); pgM.userData.n2oPurge = V3(0, 0.75, -0.66); extras.push(pgM); N2O_PURGE = pgM;
    /* feed line: up in front of the heads, or behind them when the throttle is at the back */
    var xUp = (sP.x > 0) ? Math.max(bankLen*0.5 + bore*0.45, vX + bore*0.3) : Math.min(sP.x, -bankLen*0.5) - bore*0.45;
    extras.push(hoseMesh([ V3(vX, bY, bZ), V3(vX+bore*0.25, bY+bore*0.30, bZ), V3(xUp, bY+bore*0.50, bZ),
                           V3(xUp, sP.y+bore*0.50, bZ*0.9), V3(sP.x+(sP.x>0?bore*0.6:-bore*0.3), sP.y+bore*0.50, sP.z), V3(sP.x, sP.y+bore*0.15, sP.z+bore*0.16) ], bore*0.035, MAT.steel));
    if(ntb && dry){
      /* dry kit (or a diesel kit): one nozzle in the intake tube ahead of the throttle, nitrous only */
      var dp = ntb.pt.clone().addScaledVector(ntb.dir, bore*0.55), dax = Math.abs(ntb.dir.x)>0.5;
      B.add("chrome", CYL(bore*0.05, bore*0.05, bore*0.20, 10), dp.x, dp.y+(dax?bore*0.30:0), dp.z+(dax?0:bore*0.30), dax?0:PI/2, 0, 0);
      B.add("anod", BOX(bore*0.09, bore*0.09, bore*0.09), dp.x, dp.y+(dax?bore*0.40:0), dp.z+(dax?0:bore*0.40));
      extras.push(hoseMesh([ V3(sP.x, sP.y+bore*0.15, sP.z-bore*0.16), V3((sP.x+dp.x)/2, Math.max(sP.y, dp.y)+bore*0.55, (sP.z+dp.z)/2), V3(dp.x, dp.y+(dax?bore*0.42:0), dp.z+(dax?0:bore*0.42)) ], bore*0.03, MAT.steel));
    } else if(ntb && wet){
      /* fogger plate sandwiched under the throttle */
      var fp = ntb.pt.clone().addScaledVector(ntb.dir, -bore*0.40);
      var ax = Math.abs(ntb.dir.x)>0.5;
      B.add("anod", ax ? BOX(bore*0.05, bore*0.78, bore*0.78) : BOX(bore*0.78, bore*0.05, bore*0.78), fp.x, fp.y, fp.z);
      if(nk.stages===2){ var fp2 = fp.clone().addScaledVector(ntb.dir, -bore*0.09);   /* the second stage's plate stacked under the first */
        B.add("anod", ax ? BOX(bore*0.05, bore*0.82, bore*0.82) : BOX(bore*0.82, bore*0.05, bore*0.82), fp2.x, fp2.y, fp2.z);
        extras.push(hoseMesh([ V3(sP.x, sP.y-bore*0.10, sP.z+bore*0.16), V3((sP.x+fp2.x)/2, (sP.y+fp2.y)/2, sP.z+bore*0.40), V3(fp2.x, fp2.y, fp2.z+bore*0.40) ], bore*0.03, MAT.steel)); }
      extras.push(hoseMesh([ V3(sP.x, sP.y-bore*0.10, sP.z-bore*0.16), V3((sP.x+fp.x)/2, (sP.y+fp.y)/2, sP.z-bore*0.40), V3(fp.x, fp.y, fp.z-bore*0.40) ], bore*0.03, MAT.steel));
    } else {
      /* direct port: a nozzle in every runner, fed by a distribution line per bank */
      for(var nbk=0; nbk<bankInfo.length; nbk++){
        var bI=bankInfo[nbk], nz=[];
        for(var nc=per-1; nc>=0; nc--){
          var nx=-bankLen/2 + bspace*(nc+0.5);
          var pN=new THREE.Vector3(nx, bI.headY+headH*0.66, -bI.zs*(bI.headW*0.52+bore*0.20)).applyMatrix4(bI.matrix);
          B.add("steel", CYL(bore*0.045,bore*0.045,bore*0.16,8), pN.x, pN.y, pN.z);
          nz.push(pN.clone().add(V3(0,bore*0.10,0)));
        }
        nz.unshift(V3(sP.x, sP.y-bore*0.10, sP.z+(nbk?-0.16:0.16)*bore));
        extras.push(hoseMesh(nz, bore*0.025, MAT.steel));
      }
    }
  }


  /* ---------- dipstick ---------- */
  setZone(0);
  /* tube leaves the crankcase side and hugs the +Z barrel face (bank 0's outboard face on a vee);
     a boxer's rises from the case top ahead of the intake */
  var dX = bankLen*0.18, dfz = bankW*0.5 + bore*0.07, dsP, dsH;
  if(L.boxer){
    dX = bankLen*0.5 - bore*0.10;
    dsP = [ V3(dX, bore*0.70, bore*0.30), V3(dX, bore*1.30, bore*0.34), V3(dX, bore*1.80, bore*0.30) ];
    dsH = V3(dX, bore*1.88, bore*0.30);
  } else {
    var dM = new THREE.Matrix4().makeRotationX(L.vee ? a : 0);
    dsP = [ V3(dX, caseBot+caseSpan*0.40, caseW*0.5+bore*0.05),
            V3(dX, skirt+(deckH-skirt)*0.45, dfz).applyMatrix4(dM),
            V3(dX, deckH*0.70, dfz).applyMatrix4(dM) ];
    dsH = V3(dX, deckH*0.76, dfz).applyMatrix4(dM);
  }
  extras.push(hoseMesh(dsP, bore*0.035, MAT.steel));
  B.add("malu", TOR(bore*0.09, bore*0.022, 6, 14), dsH.x, dsH.y, dsH.z, 0, PI/2, 0);

  /* ---------- instanced bolts ---------- */
  if(boltXf.length){
    var boltGeo = mergeGeos([
      {g:CYL(bore*0.055,bore*0.055,bore*0.045,6,false,3.0), m:new THREE.Matrix4().makeTranslation(0,bore*0.022,0)},
      {g:CYL(bore*0.070,bore*0.070,bore*0.012,10,false,3.0), m:new THREE.Matrix4().makeTranslation(0,-bore*0.004,0)}
    ]);
    var inst=new THREE.InstancedMesh(boltGeo, MAT.steel, boltXf.length);
    for(var bi=0; bi<boltXf.length; bi++) inst.setMatrixAt(bi, boltXf[bi]);
    inst.instanceMatrix.needsUpdate=true;
    inst.castShadow=true; inst.receiveShadow=true;
    extras.push(inst);
  }

  /* ---------- fidelity pass: wiring, PCV, decals (Full / Ultra) ---------- */
  if(DET) buildDetailPost(B, { L:L, per:per, banks:banks, bore:bore, stroke:stroke, bankLen:bankLen, bankW:bankW, bspace:bspace,
    deckH:deckH, headH:headH, coverH:coverH, caseW:caseW, caseH:caseH, caseBot:caseBot, caseTop:caseTop, panTop:panTop, panH:panH,
    head:head, pushrod:pushrod, sohc:sohc, dohc:dohc, intake:intake, asp:asp, cfg:cfg, bankInfo:bankInfo, aspInfo:aspInfo, a:a,
    blockKey:blockKey, oilSys:oilSys });

  /* ---------- materialise ---------- */
  var live;
  if(DET){
    live = {
      stainless: liveClone(exh==="headers_merge" ? MATHI.inconel : MATHI.stainless),   /* race merge systems are Inconel */
      castexh:   liveClone(MATHI.castexh),
      turbine:   liveClone(pick(cfg.turbineMat,"cast_iron")==="inconel" ? MATHI.inconelCast : MATHI.turbine),
      wrinkle:   coverFinish(pick(cfg.cover,"red"), coverCol),
      anod:      tint(MATHI.anod, 0x8d949c)
    };
    live.anod.userData.perBuild=true;
    for(var hk in MATHI) if(!live[hk]) live[hk]=MATHI[hk];
    for(var dk in DECALS) live[dk]=DECALS[dk];
  } else {
    live = {
      stainless: liveClone(MAT.stainless),
      castexh:   liveClone(MAT.castexh),
      turbine:   liveClone(MAT.turbine),
      wrinkle:   tint(MAT.wrinkle, coverCol),
      anod:      tint(MAT.anod, 0x8d949c)
    };
    live.wrinkle.userData.perBuild=true; live.anod.userData.perBuild=true;
  }
  anim.glowMats = [live.stainless, live.castexh, live.turbine];
  var flushed = B.flush(G, live, true);
  for(var fk in flushed) if(fk.indexOf("decal")===0) flushed[fk].castShadow=false;   /* lettering sits 0.4 mm off its wall */
  /* zone-tag the separately built meshes by the section they were added in */
  for(var ei=0; ei<extras.length; ei++){
    if(!extras[ei]) continue;      /* merged into a bucket (hoses, pipes, belts) */
    var ez=0; for(var zi=0; zi<ZONE_MARKS.length; zi++) if(ZONE_MARKS[zi][0]<=ei) ez=ZONE_MARKS[zi][1];
    extras[ei].traverse(function(o){ if(o.isMesh && o.geometry && !o.geometry.attributes.zone) zoneGeo(o.geometry, ez); });
    G.add(extras[ei]);
  }
  ZONE_EXTRAS=null; setZone(0);
  if(DET) flushHW(G, function(k){ return live[k] || MATHI[k] || MAT[k]; });
  CUR_B=null; DECALS={};

  /* live materials on the separately-added extras */
  G.traverse(function(o){
    var lk = o.userData && o.userData.liveKey;
    if(lk && live[lk]) o.material = live[lk];
    else if(DET && o.isMesh && HI_OF.has(o.material)) o.material = HI_OF.get(o.material);
    if(o.isMesh){ if(Array.isArray(o.material)) o.material.forEach(heatPatch); else heatPatch(o.material); }
  });

  var t1=(typeof performance!=="undefined")?performance.now():0;
  G.userData.buildMs = t1-t0;
  G.userData.crack = CRACK; CRACK=null;
  G.userData.exhaustTip = (exSys && exSys.tip) || (aspInfo && aspInfo.tip) || (bankInfo[0]&&bankInfo[0].exhaustTip) || null;
  return G;
}

/* --- helper: flexible hose / pipe mesh --------------------------------- */
/* While an engine is being built (CUR_B set) hoses, pipes and fixed tubes merge into their material's bucket and
   return null (the extras loop skips it): a V8 no longer pays one draw call per primary, runner and hose. */
var CUR_B=null, DET=0, DCTX=null, DECALS={};
function keyOfMat(m){ if(!m) return "hose"; if(m===MAT.anod) return "anodRaw"; for(var k in MAT) if(MAT[k]===m) return k; return null; }
function meshB(g, mat){
  var key=keyOfMat(mat);
  if(DET && CUR_B && key && g.parameters && g.parameters.path) tubeUV(g, g.parameters.radius);
  if(!CUR_B || !key){ var m=new THREE.Mesh(g, mat); m.castShadow=true; m.receiveShadow=true; return m; }
  CUR_B.addW(key, g); return null;
}
function hoseMesh(pts, rad, mat){
  var g=TUBE(pts, rad, 16, 8), key=keyOfMat(mat||MAT.hose);
  if(!CUR_B || !key){ var m=new THREE.Mesh(g, mat||MAT.hose); m.castShadow=true; m.receiveShadow=true; return m; }
  if(DET && key==="hose"){ key="hoseWrap"; uvByLength(g, 1/1.2); hoseEnds(g, rad, "clamp"); }
  else if(DET>=2 && key==="steel" && rad>=0.018) hoseEnds(g, rad, "nutA");
  CUR_B.addW(key, g); return null;
}
/* world-scaled tube uvs (texel density like the rest of the engine: TK tiles per unit) */
function tubeUV(g, rad){
  var len=g.parameters.path.getLength(), uv=g.attributes.uv, ku=len*TK, kv=TAU*rad*TK;
  for(var i=0;i<uv.count;i++) uv.setXY(i, uv.getX(i)*ku, uv.getY(i)*kv);
  return g;
}
/* tube uv.x runs 0..1 over the whole tube: rescale it to world length so a texture keeps its pitch */
function uvByLength(g, k){
  var len=g.parameters.path.getLength(), uv=g.attributes.uv;
  for(var i=0;i<uv.count;i++) uv.setX(i, uv.getX(i)*len*k);
  return g;
}
/* hardware at both ends of a tube: hose clamps / AN nuts, oriented along the tube, screw up */
var _hz=new THREE.Vector3(), _hx=new THREE.Vector3(), _hy=new THREE.Vector3(), _UP=new THREE.Vector3(0,1,0);
function endFrame(pos, tan, s){
  _hz.copy(tan).normalize(); _hx.crossVectors(_UP, _hz); if(_hx.lengthSq()<1e-6) _hx.set(1,0,0); _hx.normalize(); _hy.crossVectors(_hz, _hx);
  return new THREE.Matrix4().makeBasis(_hx.clone().multiplyScalar(s), _hy.clone().multiplyScalar(s), _hz.clone().multiplyScalar(s)).setPosition(pos);
}
function hoseEnds(g, rad, type){
  var c=g.parameters.path, len=c.getLength(); if(len<rad*4) return;
  var t0=Math.min(0.2, rad*1.6/len);
  hwW(type, endFrame(c.getPointAt(t0), c.getTangentAt(t0), rad));
  hwW(type, endFrame(c.getPointAt(1-t0), c.getTangentAt(1-t0), rad));
}

/* ===========================================================================
   7r. WANKEL ROTARY: a stack of rotor housings and side housings threaded on the eccentric shaft.
       Engine space is the same as a piston engine's: the e-shaft lies on X (front = +X, flywheel at -X),
       the housings stand with the epitrochoid's long axis vertical. Intake on the -Z flank, exhaust ports
       on the +Z flank (so the shared exhaust / turbo / intake / FAD builders hang their parts where they
       expect), spark plugs low on the -Z flank, the oil metering pump on top of the front cover.
       X-ray: triangular rotors orbit the eccentric lobes and turn at a third of shaft speed.
   ==========================================================================*/
function isRotaryCfg(c){
  if(!c) return false;
  var E=(typeof ENGINE_SIM!=="undefined")?ENGINE_SIM:null;
  if(E&&E.isRotary) return !!E.isRotary(c);
  return /^R[1-4]$/.test(c.layout||"");
}
/* epitrochoid (long axis on shape-y) pushed out along its normal by grow; extruded along X it is a housing */
function trochoidShape(R, e, grow, n){
  var s=new THREE.Shape(), i;
  n=n||72;
  for(i=0;i<n;i++){
    var a=i/n*TAU;
    var px=e*Math.sin(3*a)+R*Math.sin(a), py=e*Math.cos(3*a)+R*Math.cos(a);
    var dx=3*e*Math.cos(3*a)+R*Math.cos(a), dy=-3*e*Math.sin(3*a)-R*Math.sin(a), l=Math.sqrt(dx*dx+dy*dy)||1;
    var x=px-dy/l*grow, y=py+dx/l*grow;                 /* the curve runs clockwise: outward is (-dy, dx) */
    if(i===0) s.moveTo(x,y); else s.lineTo(x,y);
  }
  s.closePath();
  return s;
}
/* housing / plate slab: the trochoid outline extruded w thick along X, centred on x=0 */
function TROCHOID(R, e, grow, w, bev){
  var key=gkey("tro",r3(R),r3(e),r3(grow),r3(w),bev?1:0);
  if(GEO[key]) return GEO[key];
  var g=new THREE.ExtrudeGeometry(trochoidShape(R,e,grow,72), {depth:w, bevelEnabled:!!bev, bevelThickness:0.012, bevelSize:0.012, bevelSegments:1, curveSegments:4});
  g.translate(0,0,-w/2); g.rotateY(PI/2);
  scaleUV(g, TK, TK);
  return cache(key, g);
}
/* a rotor: three apexes on radius Ra joined by flanks bulging out by bulge, a bearing bore in the middle */
function ROTOR(Ra, bulge, w, bore){
  var key=gkey("rot",r3(Ra),r3(bulge),r3(w),r3(bore));
  if(GEO[key]) return GEO[key];
  var s=new THREE.Shape(), k, P=function(r,a){ return [-r*Math.sin(a), r*Math.cos(a)]; };   /* world (y,z)=(cos a, sin a) */
  var a0=P(Ra,0); s.moveTo(a0[0],a0[1]);
  for(k=0;k<3;k++){
    var aE=(k+1)*TAU/3, aM=k*TAU/3+TAU/6, c=P(0.5*Ra+2*bulge, aM), p=P(Ra, aE);
    s.quadraticCurveTo(c[0],c[1],p[0],p[1]);
  }
  var h=new THREE.Path(); h.absarc(0,0,bore,0,TAU,true); s.holes.push(h);
  var g=new THREE.ExtrudeGeometry(s, {depth:w, bevelEnabled:true, bevelThickness:0.01, bevelSize:0.01, bevelSegments:1, curveSegments:10});
  g.translate(0,0,-w/2); g.rotateY(PI/2);
  scaleUV(g, TK, TK);
  return cache(key, g);
}

function buildRotaryMesh(cfg, L, B, G, extras, t0){
  var n=L.n, i, k;
  var Rr=pick(cfg.stroke,105)*K, ee=pick(cfg.ecc,15)*K, rw=pick(cfg.bore,80)*K;   /* generating radius, eccentricity, rotor width */
  var port=pick(cfg.rotPort,"side"), asp=pick(cfg.asp,"na"), exh=pick(cfg.exhaust,"cast_tubular"), intake=pick(cfg.intake,"single_tb");
  var ic=pick(cfg.ic,"none"), tsz=pick(cfg.turboSize,"medium"), oilSys=pick(cfg.oilSystem,"wet");
  var coverCol = COVER_COLORS[pick(cfg.cover,"red")] || COVER_COLORS.red;
  var chamber=3*Math.sqrt(3)*Rr*ee*rw;                               /* scene units^3 */
  var bore=0.86*Math.pow(chamber/(3*Math.sqrt(3)*1.05*0.15*0.80), 1/3);   /* pipe and hardware scale: 0.86 on a 13B */
  var wall=0.20;                                                     /* housing wall + water jacket */
  var plateT=0.42*Math.max(0.8, rw/0.8*0.6+0.4);                     /* side housings */
  var bspace=rw+plateT, stackLen=n*bspace+plateT, bankLen=n*bspace;  /* builders place ports at -bankLen/2 + bspace*(i+0.5) */
  var Hh=Rr+ee+wall, Hw=Rr*0.87+wall;                               /* half-height / half-width of a housing */
  var xF=stackLen/2, xR=-stackLen/2;
  var phase=[]; for(i=0;i<n;i++) phase.push(i*TAU/n);
  var rx=function(i){ return -bankLen/2 + bspace*(i+0.5); };         /* rotor (housing) centre */
  var px=function(j){ return -stackLen/2 + plateT/2 + j*bspace; };   /* side housing j = 0..n */
  var sideKey = cfg.sidePlate==="alu" ? "malu" : "iron";
  var houseKey = cfg.rotHousing==="ceramic" ? "palu" : "calu";
  DCTX.bore = bore;

  /* ---------- housings and side plates ---------- */
  setZone(2);
  for(i=0;i<n;i++){
    B.add(houseKey, TROCHOID(Rr, ee, wall, rw*0.995, DET>0), rx(i), 0, 0);
    /* coolant-jacket ribs round the waist and cast bosses top and bottom */
    for(k=-1;k<=1;k+=2){
      B.add(houseKey, BOX(rw*0.70, bore*0.10, bore*0.10), rx(i), k*Hh*0.62, Hw*0.93);
      B.add(houseKey, BOX(rw*0.70, bore*0.10, bore*0.10), rx(i), k*Hh*0.62, -Hw*0.93);
    }
    B.add(houseKey, BOX(rw*0.80, bore*0.16, bore*0.38), rx(i), Hh-bore*0.03, 0);
    if(port==="peri"){
      /* peripheral port: the intake enters the rotor housing itself, a cast stub on the -Z flank */
      B.add(houseKey, BOX(rw*0.62, bore*0.34, bore*0.22), rx(i), Hh*0.42, -(Hw+bore*0.06));
    }
  }
  setZone(3);
  for(var j=0;j<=n;j++){
    var end = (j===0||j===n), t=plateT*(end?1.0:0.98);
    B.add(sideKey, TROCHOID(Rr, ee, wall+bore*0.07, t, DET>0), px(j), 0, 0);
    /* side (intake) port boss on the -Z flank for side, street and bridge ports */
    if(port!=="peri") B.add(sideKey, BOX(t*0.86, bore*0.30, bore*0.18), px(j), Hh*0.40, -(Hw+bore*0.10));
    if(port==="sidex") B.add(sideKey, BOX(t*0.80, bore*0.26, bore*0.16), px(j), -Hh*0.34, Hw+bore*0.10);   /* side exhaust */
    if(DET>=2 && j<n) B.add("gasket", TROCHOID(Rr, ee, wall+bore*0.035, bore*0.012, false), px(j)+plateT/2+bore*0.006, 0, 0);
  }
  /* tension bolts through the whole stack: heads on the front plate, nuts on the rear */
  var nTB = n<=2 ? 14 : 16;
  for(i=0;i<nTB;i++){
    var ta=i/nTB*TAU, ty=Math.cos(ta)*(Hh+bore*0.02), tz=Math.sin(ta)*(Hw+bore*0.02);
    if(DET){ B.hw("hex", xF+0.004, ty, tz, 0,0,-PI/2, bore*0.13); B.hw("hex", xR-0.004, ty, tz, 0,0,PI/2, bore*0.13); }
    else B.add("steel", CYL(bore*0.06,bore*0.06,bore*0.06,6), xF+bore*0.03, ty, tz, 0,0,PI/2);
  }

  /* ---------- front cover, oil metering pump, e-shaft nose ---------- */
  setZone(7);
  var coverT=bore*0.42;
  B.add("wrinkle", TROCHOID(Rr*0.92, ee, wall*0.6, coverT, DET>0), xF+coverT/2, -Hh*0.04, 0);
  B.add("wrinkle", CYL(bore*0.42,bore*0.48,bore*0.20,22), xF+coverT+bore*0.08, 0, 0, 0,0,PI/2);       /* nose boss */
  /* OMP: a little plunger pump on top of the front cover, its control rod to the throttle and a line to each housing */
  var ompY=Hh*0.70, ompX=xF+coverT*0.40;
  B.add("calu", BOX(bore*0.36, bore*0.26, bore*0.30), ompX, ompY+bore*0.10, bore*0.30);
  B.add("steel", CYL(bore*0.05,bore*0.05,bore*0.22,8), ompX+bore*0.10, ompY+bore*0.28, bore*0.30, 0,0,0);
  if(DET && cfg.oilMeter!=="premix"){
    for(i=0;i<n;i++) extras.push(hoseMesh([V3(ompX-bore*0.10, ompY+bore*0.16, bore*0.20), V3((ompX+rx(i))/2, Hh+bore*0.18, bore*0.20), V3(rx(i), Hh+bore*0.10, bore*0.10)], bore*0.022, MAT.dark));
  }
  if(cfg.oilMeter==="premix") B.add("blackPlast", CYL(bore*0.06,bore*0.06,bore*0.04,8), ompX, ompY+bore*0.26, bore*0.30);   /* capped off */
  /* oil filter on the front cover, low on the +Z side; water outlet + thermostat on top */
  B.add("paintBlue", CYL(bore*0.30,bore*0.30,bore*0.58,20,false,1.8), xF+coverT*0.5, -Hh*0.60, Hw*0.55+bore*0.30, PI/2,0,0);
  B.add("calu", CYL(bore*0.13,bore*0.13,bore*0.40,12), xF-bore*0.10, Hh+bore*0.16, -bore*0.30, 0,0,0);

  /* ---------- sump ---------- */
  setZone(6);
  var panTop=-Hh*0.90, panH = oilSys==="dry" ? bore*0.26 : bore*0.70;
  B.add(oilSys==="dry" ? "malu" : "steel", RBOX(stackLen*0.92, panH, Hw*1.60, 0.03), 0, panTop-panH/2, 0);
  B.add("steel", CYL(bore*0.075,bore*0.075,0.04,10), stackLen*0.25, panTop-panH+0.01, Hw*0.30);

  /* ---------- spark plugs: leading and trailing per rotor, low on the -Z flank; coils on a rail above ---------- */
  setZone(3);
  var plugZ=-(Hw+bore*0.02), plugY=[-Hh*0.16, -Hh*0.46];
  var coilZ=-(Hw+bore*0.52), coilY=-Hh*0.30;
  for(i=0;i<n;i++){
    for(k=0;k<2;k++){
      var pxx=rx(i)+(k?-1:1)*rw*0.18, pyy=plugY[k];
      B.add("calu", BOX(rw*0.30, bore*0.22, bore*0.10), pxx, pyy, plugZ+bore*0.02);                     /* plug boss */
      B.add("steel", CYL(bore*0.07,bore*0.07,bore*0.06,6), pxx, pyy, plugZ-bore*0.03, PI/2,0,0);        /* hex */
      B.add(k ? "dark" : "wireRed", CYL(bore*0.055,bore*0.06,bore*0.16,10), pxx, pyy, plugZ-bore*0.14, PI/2,0,0);   /* boot: leading red, trailing black */
      if(DET) extras.push(hoseMesh([V3(pxx, pyy, plugZ-bore*0.22), V3(pxx, (pyy+coilY)/2, plugZ-bore*0.40), V3(rx(i)+(k?-1:1)*rw*0.12, coilY-bore*0.12, coilZ+bore*0.06)], bore*0.026, k ? MAT.dark : MAT.wireRed));
    }
    if(DET){
      for(k=0;k<2;k++) B.add("blackPlast", RBOX(rw*0.22, bore*0.30, bore*0.24, 0.02), rx(i)+(k?-1:1)*rw*0.12, coilY, coilZ);   /* coil packs */
    }
  }
  if(DET){
    B.add("steel", BOX(stackLen*0.86, bore*0.04, bore*0.16), 0, coilY-bore*0.18, coilZ+bore*0.10);    /* coil rail */
    B.addW("loom", uvByLength(TUBE([B.pt(xF, coilY+bore*0.22, coilZ), B.pt(0, coilY+bore*0.24, coilZ), B.pt(xR+bore*0.2, coilY+bore*0.22, coilZ)], bore*0.03, 20, 6), 1/1.4));
  }

  /* ---------- internals (X-ray): eccentric shaft, rotors, stationary gears ---------- */
  setZone(1);
  (function(){
    var IG=new THREE.Group(); IG.name="internals"; IG.visible=false;
    var shaft=new THREE.Group(), items=[];
    items.push({g:CYL(bore*0.25,bore*0.25,stackLen+bore*1.4,18), m:mkM(0,0,0,0,0,PI/2)});
    for(i=0;i<n;i++) items.push({g:CYL(Rr*0.36,Rr*0.36,rw*0.90,24), m:mkM(rx(i), ee*Math.cos(phase[i]), ee*Math.sin(phase[i]), 0,0,PI/2)});   /* eccentric lobes */
    for(k=-1;k<=1;k+=2) items.push({g:BOX(bore*0.10, Rr*0.55, Rr*0.70), m:mkM(k*(stackLen/2+bore*0.18), -Rr*0.22, 0)});   /* counterweights */
    shaft.add(new THREE.Mesh(mergeGeos(items), MAT.steel));
    IG.add(shaft);
    var rotors=[], Ra=Rr*0.985;
    for(i=0;i<n;i++){
      var rg=new THREE.Group();
      rg.add(new THREE.Mesh(ROTOR(Ra, Rr*0.11, rw*0.96, Rr*0.37), MAT.iron));
      for(k=0;k<3;k++){
        var aa=k*TAU/3, am=aa+TAU/6, fr=0.5*Ra+Rr*0.11-bore*0.012;
        var seal=new THREE.Mesh(BOX(rw*0.98, bore*0.035, bore*0.05), MAT.steel);
        seal.position.set(0, Ra*Math.cos(aa), Ra*Math.sin(aa)); seal.rotation.x=aa; rg.add(seal);
        if(DET){   /* combustion recess in each flank */
          var rec=new THREE.Mesh(BOX(rw*0.55, bore*0.02, Rr*0.42), MAT.dark);
          rec.position.set(0, fr*Math.cos(am), fr*Math.sin(am)); rec.rotation.x=am; rg.add(rec);
        }
      }
      var ring=new THREE.Mesh(TOR(Rr*0.40, bore*0.03, 6, 30), MAT.palu); ring.rotation.y=PI/2; ring.position.x=rw*0.49; rg.add(ring);   /* internal gear */
      rg.traverse(function(o){ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
      IG.add(rg);
      rotors.push({g:rg, x:rx(i), phase:phase[i]});
      /* stationary gear on the side housing face */
      var sg=new THREE.Mesh(TOR(Rr*0.28, bore*0.03, 6, 26), MAT.steel); sg.rotation.y=PI/2; sg.position.set(rx(i)+rw*0.50, 0, 0); IG.add(sg);
    }
    G.add(IG);
    anim.internals = {group:IG, crank:shaft, r:ee, L:1, ch:0, cyls:[], theta:0, pistonH:0, rotors:rotors, e:ee};
  })();

  /* ---------- exhaust: a port per rotor on the +Z flank, low ---------- */
  setZone(4);
  EXH_COLL=[]; PIPE_LOG=[]; CRACK=null;
  var tFeed = (asp==="turbo"||asp==="twin_turbo"||asp==="compound") ? ((asp==="twin_turbo") ? 2 : 1) : 0;
  if(tFeed===2 && n<2) tFeed=1;
  var eHeadH=bore*0.62, ePortY=-Hh*0.30, eHeadY=ePortY-eHeadH*0.48;
  var exP={ per:n, bore:bore, bspace:bspace, bankLen:bankLen, exh:exh, zs:1, turboFeed:tFeed, L:{boxer:false, vee:false}, bankIdx:0, deckH:Hh };
  LAST_PIPE_END=null;
  buildExhaust(B, exP, extras, Hw+bore*0.02, eHeadY, eHeadH, function(z){ return z; });
  var exhaustTip = LAST_PIPE_END ? LAST_PIPE_END.clone() : null;
  for(i=0;i<n;i++) B.add(houseKey, BOX(rw*0.62, eHeadH*0.62, bore*0.10), rx(i), ePortY, Hw-bore*0.02);   /* exhaust port boss */

  /* ---------- intake: the shared builder, aimed at the -Z flank ---------- */
  setZone(0);
  var iHeadH=bore*0.62, iPortY=Hh*0.40;
  var bi0={ zs:1, headW:(Hw+bore*0.08)*2/1.04, covW:Hw*1.6, covY:Hh, coverH:bore*0.30, headY:iPortY-iHeadH*0.55, headH:iHeadH,
            covTop:Hh+bore*0.30, exhZ:Hw, inZ:-Hw, matrix:new THREE.Matrix4(), bankLen:bankLen, exhaustTip:exhaustTip, coilLoomEnd:null, injLoomEnd:null, dz:null };
  var bankInfo=[bi0];
  LAST_TB=null; LAST_PLEN=null;
  buildIntake(B, { L:L, per:n, banks:1, bore:bore, bankLen:bankLen, bankW:Hw*2, deckH:Hh, headH:iHeadH, coverH:bore*0.30, bspace:bspace,
    intake:intake, asp:asp, a:0, pushrod:false, dohc:true, bankInfo:bankInfo, boltXf:[] }, extras);
  /* fuel rail with a primary and a secondary injector per rotor */
  if(intake!=="carb"){
    var rZ=-(Hw+bore*0.34), rY=iPortY+bore*0.30;
    B.add("anod", CYL(bore*0.06,bore*0.06,bankLen*0.98,10), 0, rY, rZ, 0,0,PI/2);
    for(i=0;i<n;i++) for(k=0;k<2;k++) B.add("blackPlast", CYL(bore*0.055,bore*0.055,bore*0.20,10), rx(i)+(k?-1:1)*rw*0.16, rY-bore*0.12, rZ+bore*0.05, 0.5,0,0);
  }

  /* ---------- aspiration, accessory drive, charge pipes ---------- */
  setZone(5);
  var caseW=Hw*2, caseH=Hh*0.9;
  var aspInfo = buildAspiration(B, {
    L:L, per:n, banks:1, bore:bore, stroke:bore, bankLen:bankLen, bankW:Hw*2,
    deckH:Hh, headH:iHeadH, coverH:bore*0.30, caseH:caseH, caseW:caseW, panTop:panTop,
    asp:asp, tsz:tsz, ic:ic, turbineMat:pick(cfg.turbineMat,"cast_iron"),
    intake:intake, a:0, bankInfo:bankInfo, exh:exh,
    panBot:panTop-panH, caseBot:panTop, tb:LAST_TB, plen:LAST_PLEN
  }, extras);
  setZone(7);
  var fadLen = 2*(xF + coverT + bore*0.10 - bore*0.16);               /* puts the FAD's front-cover face on ours */
  buildFAD(B, { L:L, bore:bore, stroke:bore, bankLen:fadLen, bankW:Hw*2, caseW:caseW, caseH:caseH,
    deckH:Hh, damper:"rubber", a:0, cfg:cfg, aspInfo:aspInfo, head:"dohc4v", panTop:panTop, oilSys:oilSys }, extras);
  setZone(5);
  buildChargeAir(B, { bore:bore, bankLen:bankLen }, extras, aspInfo);

  /* ---------- flywheel (counterweighted, as every rotary's is) ---------- */
  setZone(1);
  var fwR=Hh*0.78, fwX=xR-bore*0.30;
  var fw=new THREE.Mesh(mergeGeos([
      {g:CYL(fwR,fwR,bore*0.12,30,false,1.6), m:new THREE.Matrix4().makeRotationZ(PI/2)},
      {g:TOR(fwR*0.99, bore*0.055, 8, 34, 1.6), m:new THREE.Matrix4().compose(V3(bore*0.05,0,0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0,PI/2,0)), V3(1,1,1))},
      {g:BOX(bore*0.10, fwR*0.50, fwR*0.80), m:mkM(bore*0.10, fwR*0.40, 0)}
    ]), MAT.steel);
  fw.position.set(fwX,0,0); fw.castShadow=true; fw.receiveShadow=true;
  extras.push(fw); anim.spin.push({o:fw, axis:"x", k:1});

  /* ---------- materialise (as buildEngineMesh does) ---------- */
  var live;
  if(DET){
    live = { stainless: liveClone(exh==="headers_merge" ? MATHI.inconel : MATHI.stainless), castexh: liveClone(MATHI.castexh),
      turbine: liveClone(pick(cfg.turbineMat,"cast_iron")==="inconel" ? MATHI.inconelCast : MATHI.turbine),
      wrinkle: coverFinish(pick(cfg.cover,"red"), coverCol), anod: tint(MATHI.anod, 0x8d949c) };
    live.anod.userData.perBuild=true;
    for(var hk in MATHI) if(!live[hk]) live[hk]=MATHI[hk];
    for(var dk in DECALS) live[dk]=DECALS[dk];
  } else {
    live = { stainless: liveClone(MAT.stainless), castexh: liveClone(MAT.castexh), turbine: liveClone(MAT.turbine),
      wrinkle: tint(MAT.wrinkle, coverCol), anod: tint(MAT.anod, 0x8d949c) };
    live.wrinkle.userData.perBuild=true; live.anod.userData.perBuild=true;
  }
  anim.glowMats = [live.stainless, live.castexh, live.turbine];
  var flushed = B.flush(G, live, true);
  for(var fk in flushed) if(fk.indexOf("decal")===0) flushed[fk].castShadow=false;
  for(var ei=0; ei<extras.length; ei++){
    if(!extras[ei]) continue;
    var ez=0; for(var zi=0; zi<ZONE_MARKS.length; zi++) if(ZONE_MARKS[zi][0]<=ei) ez=ZONE_MARKS[zi][1];
    extras[ei].traverse(function(o){ if(o.isMesh && o.geometry && !o.geometry.attributes.zone) zoneGeo(o.geometry, ez); });
    G.add(extras[ei]);
  }
  ZONE_EXTRAS=null; setZone(0);
  if(DET) flushHW(G, function(k){ return live[k] || MATHI[k] || MAT[k]; });
  CUR_B=null; DECALS={};
  G.traverse(function(o){
    var lk = o.userData && o.userData.liveKey;
    if(lk && live[lk]) o.material = live[lk];
    else if(DET && o.isMesh && HI_OF.has(o.material)) o.material = HI_OF.get(o.material);
    if(o.isMesh){ if(Array.isArray(o.material)) o.material.forEach(heatPatch); else heatPatch(o.material); }
  });
  var t1=(typeof performance!=="undefined")?performance.now():0;
  G.userData.buildMs = t1-t0;
  G.userData.crack = CRACK; CRACK=null;
  G.userData.exhaustTip = (aspInfo && aspInfo.tip) || exhaustTip || null;
  G.userData.rotary = true;
  return G;
}

/* ===========================================================================
   7t. TWO-STROKE: ported barrels with transfer bulges and an exhaust spigot, no cams and no valvetrain (a uniflow
       Detroit keeps its exhaust valves under a rocker cover); expansion chambers; a reed block and carburettor, a
       Roots blower for a Detroit; the Deltic's triangle. X-ray: the piston crown uncovering the exhaust (orange)
       and transfer (blue) ports as it passes them.
   ==========================================================================*/
function isTwoStrokeCfg(c){
  if(!c) return false;
  var E=(typeof ENGINE_SIM!=="undefined")?ENGINE_SIM:null;
  if(E&&E.isTwoStroke) return !!E.isTwoStroke(c);
  return c.cycle==="two" && !/^R[1-4]$/.test(c.layout||"");
}
/* crown height above the crank axis at a crank angle from TDC (degrees) */
function tsCrownY(r, Lr, ch, thDeg){ var t=deg(thDeg), q=r*Math.sin(t); return r*Math.cos(t)+Math.sqrt(Math.max(0, Lr*Lr-q*q))+ch; }
function tsPortMat(hex){ var m=new THREE.MeshBasicMaterial({color:sc(hex), transparent:true, opacity:0.25, depthWrite:false, toneMapped:false}); m.userData.perBuild=true; return m; }
/* an expansion chamber in the current builder frame, running along -X from (x0,y,z): diffuser, belly, baffle cone, stinger */
function tsChamber(B, x0, y, z, len, rH, rB, rS, key){
  var lD=len*0.36, lB=len*0.16, lC=len*0.26, lS=len*0.22, x=x0;
  B.add(key, CONE(rB, rH, lD, 22), x-lD/2, y, z, 0,0,PI/2); x-=lD;
  B.add(key, CYL(rB, rB, lB, 22, true), x-lB/2, y, z, 0,0,PI/2); x-=lB;
  B.add(key, CONE(rS, rB, lC, 22), x-lC/2, y, z, 0,0,PI/2); x-=lC;
  B.add(key, CYL(rS, rS, lS, 12, true), x-lS/2, y, z, 0,0,PI/2); x-=lS;
  return x;
}
function buildTwoStrokeMesh(cfg, L, B, G, extras, t0){
  if(cfg.layout==="D18") return buildDelticMesh(cfg, L, B, G, extras, t0);
  var n=L.n, banks=L.banks, per=Math.max(1, Math.round(n/banks)), i, k, bk, ci;
  var bore=pick(cfg.bore,66)*K, stroke=pick(cfg.stroke,72)*K, rr=pick(cfg.rodRatio,1.75);
  var dsl=isDieselCfg(cfg), xp=pick(cfg.xpipe,"chamber"), ind=pick(cfg.induct,"reed"), tsf=pick(cfg.tsFuel,"carb");
  var asp=pick(cfg.asp,"na"), ep=pick(cfg.ePort,185), tp=pick(cfg.tPort,125), pipeRpm=pick(cfg.pipeRpm,8000);
  var blower=(ind==="blower"), unif=(pick(cfg.scav,"loop")==="uniflow"), coverCol=COVER_COLORS[pick(cfg.cover,"red")]||COVER_COLORS.red;
  var blockMat=pick(cfg.blockMat,"alu_nikasil"), blockKey=(blockMat==="cgi"||blockMat==="cgi_filled")?"cgi":(blockMat.indexOf("alu")===0?"calu":"iron");
  var headKey=(pick(cfg.headMat,"alu")==="iron")?"iron":"calu";
  var big=(n>=3||dsl), finned=(!dsl && blockKey==="iron" && n<=2);
  var r=stroke/2, ch=bore*0.34, Lr=stroke*rr, deckH=r+Lr+ch;
  var bspace=bore*1.34+0.05, bankLen=per*bspace+bore*0.30, vee=banks>1, a=deg(L.angle/2);
  var caseR=r+bore*0.42, caseW=vee?bore*2.2:bore*1.6;
  var cx=function(c){ return -bankLen/2 + bspace*(c+0.5); };
  var portTop=tsCrownY(r,Lr,ch,180-ep/2), trTop=tsCrownY(r,Lr,ch,180-tp/2), bdc=tsCrownY(r,Lr,ch,180);
  DCTX.bore=bore;
  EXH_COLL=[]; EXH_TAILS=[]; PIPE_LOG=[]; CRACK=null; LAST_PIPE_END=null;
  var exhaustTip=null;

  /* ---------- crankcase ---------- */
  setZone(1);
  var panBot=-caseR;
  if(!big){
    /* a bike or sled motor: split cases round the flywheels, the gearbox lump behind, ignition and clutch covers */
    B.add(blockKey, CYL(caseR, caseR, bankLen, 30), 0, 0, 0, 0,0,PI/2);
    B.add(blockKey, RBOX(bankLen*0.94, caseR*1.25, caseR*1.7, 0.04), 0, -caseR*0.30, -caseR*0.95);
    B.add("wrinkle", CYL(caseR*0.92, caseR*0.98, bore*0.26, 28), bankLen/2+bore*0.12, -caseR*0.05, -caseR*0.10, 0,0,PI/2);   /* ignition (flywheel) cover */
    B.add("wrinkle", CYL(caseR*1.02, caseR*1.06, bore*0.26, 28), -bankLen/2-bore*0.12, -caseR*0.25, -caseR*0.55, 0,0,PI/2);  /* clutch cover */
    B.add("steel", CYL(bore*0.10, bore*0.10, bore*0.14, 10), bankLen/2+bore*0.30, -caseR*0.05, -caseR*0.10, 0,0,PI/2);
    panBot=-caseR*1.0;
  } else {
    B.add(blockKey, RBOX(bankLen+bore*0.30, caseR*2.0, caseW, 0.04), 0, -caseR*0.05, 0);
    B.add(blockKey, BOX(bore*0.16, caseR*2.1, caseW*1.05), -(bankLen+bore*0.30)/2-bore*0.06, -caseR*0.05, 0);
    if(dsl){ setZone(6); var panH=stroke*0.9; B.add("steel", RBOX(bankLen*0.94, panH, caseW*0.86, 0.03), 0, -caseR*1.05-panH/2, 0); panBot=-caseR*1.05-panH; setZone(1); }
    else panBot=-caseR*1.05;
  }

  /* ---------- banks: barrels, ports, heads ---------- */
  var exPorts=[], inPorts=[], heads=[];
  for(bk=0; bk<banks; bk++){
    var zs=(bk===0)?1:-1, ang=vee?(bk===0?a:-a):0;
    B.push(new THREE.Matrix4().makeRotationX(ang));
    setZone(2);
    var y0=vee?caseR*0.55:caseR*0.78, y1=deckH;
    if(big) B.add(blockKey, RBOX(bankLen, y1-y0, bore*1.42, 0.03), 0, (y0+y1)/2, 0);
    if(blower) B.add(blockKey, BOX(bankLen*0.97, (trTop-bdc)+bore*0.30, bore*1.62), 0, (bdc+trTop)/2, 0);   /* the air box round the liner ports */
    for(ci=0; ci<per; ci++){
      var x=cx(ci);
      if(!big){
        B.add(blockKey, CYL(bore*0.66, bore*0.70, y1-y0, 26), x, (y0+y1)/2, 0);
        if(finned) for(k=0;k<7;k++) B.add(blockKey, CYL(bore*1.00, bore*1.00, bore*0.032, 26), x, y0+(y1-y0)*(0.18+k*0.12), 0);
        else B.add(blockKey, CYL(bore*0.11, bore*0.11, bore*0.30, 10), x, y1-bore*0.30, -zs*bore*0.70, PI/2,0,0);   /* water outlet */
      }
      /* transfer ports: cast bulges either side of the bore, reaching up to the transfer timing */
      if(!unif) for(k=-1;k<=1;k+=2) B.add(blockKey, RBOX(bore*0.22, Math.max(bore*0.3, trTop-y0+bore*0.10), bore*0.80, 0.02), x+k*bore*0.70, (y0+trTop)/2, -zs*bore*0.06);
      if(!unif){
        /* exhaust port: a spigot on the outside flank at the port's height, then a flange */
        var ey=(portTop+bdc)/2, eh=(portTop-bdc)+bore*0.16;
        B.add(blockKey, BOX(bore*0.64, eh, bore*0.40), x, ey, zs*bore*0.70);
        B.add("steel", CYL(bore*0.27, bore*0.27, bore*0.07, 18), x, ey, zs*bore*0.92, PI/2,0,0);
        exPorts.push({bk:bk, ci:ci, x:x, y:ey, z:zs*bore*0.96, zs:zs, M:B.top().clone()});
      }
      /* head: a squish-band dome with a central plug (diesel: an injector), finned on an air-cooled engine */
      setZone(3);
      if(!unif){
        B.add(headKey, CYL(bore*0.62, bore*0.70, bore*0.30, 26), x, y1+bore*0.15, 0);
        if(finned) for(k=0;k<4;k++) B.add(headKey, BOX(bore*1.70, bore*0.03, bore*1.50), x, y1+bore*(0.06+k*0.075), 0);
        if(!dsl){
          B.add("steel", CYL(bore*0.075, bore*0.075, bore*0.12, 6), x, y1+bore*0.35, 0);
          B.add("wireRed", CYL(bore*0.065, bore*0.075, bore*0.22, 10), x, y1+bore*0.50, 0);
          if(DET) extras.push(hoseMesh([B.pt(x, y1+bore*0.60, 0), B.pt(x+bore*0.3, y1+bore*0.80, -zs*bore*0.3), B.pt(x+bore*0.5, y1+bore*0.55, -zs*bore*0.9)], bore*0.025, MAT.dark));
          if(tsf==="di") B.add("blackPlast", CYL(bore*0.07, bore*0.07, bore*0.26, 10), x+bore*0.28, y1+bore*0.40, -zs*bore*0.12, 0,0,0.45);
        } else B.add("steel", CYL(bore*0.07, bore*0.07, bore*0.24, 8), x, y1+bore*0.42, 0);
      }
      setZone(2);
      inPorts.push({bk:bk, x:x, zs:zs, M:B.top().clone()});
    }
    if(unif){
      /* uniflow: air in through a belt of liner ports, out through four exhaust valves a cylinder under a rocker cover */
      setZone(3);
      B.add(headKey, RBOX(bankLen*0.98, bore*0.55, bore*1.50, 0.03), 0, y1+bore*0.27, 0);
      B.add("wrinkle", RBOX(bankLen*0.95, bore*0.44, bore*1.28, 0.06), 0, y1+bore*0.77, 0);
      for(ci=0; ci<per; ci++){
        var xu=cx(ci);
        B.add("castexh", BOX(bore*0.56, bore*0.42, bore*0.30), xu, y1+bore*0.22, zs*bore*0.84);      /* exhaust port in the head */
        exPorts.push({bk:bk, ci:ci, x:xu, y:y1+bore*0.22, z:zs*bore*0.98, zs:zs, M:B.top().clone(), head:true});
      }
    }
    heads.push({y1:y1, zs:zs, ang:ang});
    B.pop();
  }

  /* ---------- intake: reed blocks and carburettors (or a Roots blower) ---------- */
  setZone(0);
  if(blower){
    setZone(5);
    var bLen=bankLen*0.86, bH=bore*0.95, bW=bore*1.05, bY, bZ;
    if(vee){ bY=deckH*Math.cos(a)*0.62+bH*0.35; bZ=0; }
    else { bY=caseR*0.15+bH*0.2; bZ=-(caseW*0.5+bW*0.55); }
    B.add("calu", RBOX(bLen, bH, bW, 0.10), 0, bY, bZ);
    for(k=-1;k<=1;k+=2) B.add("calu", RBOX(bore*0.20, bH*1.10, bW*1.08, 0.04), k*(bLen/2+bore*0.08), bY, bZ);
    B.add("calu", RBOX(bLen*0.22, bH*0.7, bW*0.6, 0.06), -(bLen/2+bore*0.32), bY, bZ);   /* drive gear housing */
    for(k=0;k<6;k++) B.add("calu", BOX(bLen*0.92, bore*0.03, bW*1.02), 0, bY-bH*0.30+k*bH*0.12, bZ);   /* rotor-case ribs */
    var aiY=bY+bH*0.5+bore*0.25;
    B.add("dark", CYL(bore*0.42, bore*0.36, bore*0.40, 22), bLen*0.18, aiY, bZ);      /* air inlet */
    B.add("filterRed", CYL(bore*0.55, bore*0.55, bore*0.35, 24), bLen*0.18, aiY+bore*0.36, bZ);
    if(asp!=="na"){
      /* the turbo feeds the blower: a compressor on top of the inlet, its turbine fed from the exhaust */
      var tY=aiY+bore*0.95, tX=-bLen*0.20;
      B.add("calu", CYL(bore*0.48, bore*0.48, bore*0.40, 24), tX, tY, bZ, 0,0,PI/2);
      B.add("turbine", CYL(bore*0.44, bore*0.44, bore*0.42, 24), tX-bore*0.55, tY, bZ, 0,0,PI/2);
      B.add("steel", CYL(bore*0.16, bore*0.16, bore*0.30, 12), tX-bore*0.27, tY, bZ, 0,0,PI/2);
      extras.push(hoseMesh([V3(tX+bore*0.25, tY, bZ), V3(tX+bore*0.6, tY-bore*0.3, bZ), V3(bLen*0.18, aiY+bore*0.45, bZ)], bore*0.18, MAT.hose));
      var tw=new THREE.Group(), wm=makeWheelMesh(bore*0.32, 9, MAT.palu); wm.rotation.z=PI/2; tw.add(wm); tw.position.set(tX+bore*0.22, tY, bZ);
      extras.push(tw); anim.turbos.push(tw);
    }
  } else {
    for(i=0;i<inPorts.length;i++){
      var ip=inPorts[i];
      B.push(ip.M);
      var iz=-ip.zs*(vee?bore*0.10:caseW*0.50), iy=vee?y0Of(ip):caseR*0.30;
      if(vee){ iz=-ip.zs*bore*0.75; iy=caseR*0.65; }
      /* reed block (or a disc-valve cover), then the carburettor or throttle body and its bellmouth */
      B.add("dark", BOX(bore*0.58, bore*0.50, bore*0.26), ip.x, iy, iz-ip.zs*bore*0.12);
      if(ind==="disc") B.add("calu", CYL(bore*0.55, bore*0.55, bore*0.12, 24), ip.x, iy, iz-ip.zs*bore*0.02, PI/2,0,0);
      var cz=iz-ip.zs*bore*0.52;
      B.add(tsf==="carb"?"calu":"anod", CYL(bore*0.24, bore*0.24, bore*0.55, 18), ip.x, iy, cz, PI/2,0,0);
      if(tsf==="carb") B.add("calu", RBOX(bore*0.36, bore*0.34, bore*0.30, 0.03), ip.x, iy-bore*0.30, cz);   /* float bowl */
      else if(tsf==="efi") B.add("blackPlast", CYL(bore*0.06, bore*0.06, bore*0.22, 10), ip.x, iy+bore*0.30, cz, 0.3,0,0);
      B.add("dark", CONE(bore*0.36, bore*0.24, bore*0.26, 20), ip.x, iy, cz-ip.zs*bore*0.40, ip.zs>0?-PI/2:PI/2,0,0);   /* bellmouth */
      B.pop();
    }
  }
  function y0Of(ip){ return caseR*0.65; }

  /* ---------- exhaust: expansion chambers, a straight pipe, a muffler, or a Detroit's manifold and stack ---------- */
  setZone(4);
  var rH=bore*0.24, rB=bore*0.62, rS=bore*0.13;
  var realL=0.5*600*(ep/360)*60/Math.max(1500,pipeRpm)*10;                          /* metres -> scene units: a quarter wave and a bit */
  var drawL=Math.min(realL, bankLen*2.0+bore*3.5);                                   /* folded for the stand: shorter than the real thing */
  if(exPorts.length && (exPorts[0].head || (dsl && xp!=="chamber"))){
    /* a cast log manifold along each bank and a vertical stack (a muffler can on it when muffled) */
    for(bk=0; bk<banks; bk++){
      var ps=exPorts.filter(function(p){ return p.bk===bk; }); if(!ps.length) continue;
      B.push(ps[0].M);
      var mz=ps[0].z+bore*0.18, my=ps[0].y;
      B.add("castexh", CYL(bore*0.26, bore*0.30, bankLen*0.98, 18), 0, my, mz, 0,0,PI/2);
      var sx=bankLen*0.30, sy=my+bore*0.3;
      var st=[V3(sx, my, mz), V3(sx, my+bore*0.6, mz+ps[0].zs*bore*0.2), V3(sx, my+bore*3.0, mz+ps[0].zs*bore*0.2)];
      pipeMesh(B, st, bore*0.24, "stainless");
      if(xp==="muffled") B.add("steel", CYL(bore*0.48, bore*0.48, bore*1.4, 22), sx, my+bore*1.9, mz+ps[0].zs*bore*0.2);
      if(bk===0){ exhaustTip=B.pt(sx, my+bore*3.0, mz+ps[0].zs*bore*0.2); CRACK={pt:B.pt(0, my+bore*0.2, mz), dir:V3(0,1,0.3).transformDirection(B.top()).normalize(), len:bore*0.5}; }
      B.pop();
    }
  } else if(xp==="muffled"){
    /* a short manifold or header into a box muffler under the engine */
    for(bk=0; bk<banks; bk++){
      var pm=exPorts.filter(function(p){ return p.bk===bk; }); if(!pm.length) continue;
      B.push(pm[0].M);
      var zl=pm[0].z+bore*0.30, yl=pm[0].y;
      if(pm.length>1) B.add("castexh", CYL(bore*0.22, bore*0.22, (pm.length-1)*bspace+bore*0.4, 16), (pm[0].x+pm[pm.length-1].x)/2, yl, zl, 0,0,PI/2);
      for(i=0;i<pm.length;i++) B.add("castexh", CYL(bore*0.20, bore*0.20, bore*0.34, 14), pm[i].x, yl, pm[i].z+bore*0.15, PI/2,0,0);
      var ex0=pm[0].x-bore*0.3, muY=panBot-bore*0.70;
      pipeMesh(B, [V3(ex0, yl, zl), V3(ex0-bore*0.4, yl-bore*0.6, zl+pm[0].zs*bore*0.2), V3(ex0-bore*0.6, muY, zl)], bore*0.18, "stainless");
      B.add("steel", CYL(bore*0.50, bore*0.50, bankLen*0.9+bore, 22), -bankLen*0.15, muY, zl, 0,0,PI/2);
      var tx=-bankLen*0.15-(bankLen*0.9+bore)/2;
      pipeMesh(B, [V3(tx, muY, zl), V3(tx-bore*0.6, muY-bore*0.1, zl)], bore*0.10, "steel");
      if(bk===0){ exhaustTip=B.pt(tx-bore*0.6, muY-bore*0.1, zl); CRACK={pt:B.pt(ex0, yl, zl), dir:V3(0,1,0.3).transformDirection(B.top()).normalize(), len:bore*0.4}; }
      B.pop();
    }
  } else {
    /* a pipe per cylinder: header out of the port, down beside the cases, then the chamber (or a plain pipe) running back */
    for(i=0;i<exPorts.length;i++){
      var ep2=exPorts[i];
      B.push(ep2.M);
      var stack=Math.floor(i/ Math.max(1,banks)), zo=ep2.zs*(caseW*0.5+rB*1.25+(ep2.ci)*rB*2.2), yr=(big?-caseR*0.2:-caseR*0.55)-(ep2.ci%2)*rB*0.3;
      var hx=ep2.x+bore*0.25;
      var hdr=[V3(ep2.x, ep2.y, ep2.z), V3(ep2.x, ep2.y, ep2.z+ep2.zs*bore*0.45), V3(hx, (ep2.y+yr)/2, zo), V3(hx-bore*0.2, yr, zo)];
      pipeMesh(B, hdr, rH, "stainless");
      var endX;
      if(xp==="chamber") endX=tsChamber(B, hx-bore*0.2, yr, zo, drawL, rH, rB, rS, "stainless");
      else { var sl=Math.min(drawL*0.5, bankLen+bore*2); B.add("stainless", CYL(rH*1.15, rH*1.15, sl, 16, true), hx-bore*0.2-sl/2, yr, zo, 0,0,PI/2); endX=hx-bore*0.2-sl; }
      if(i===0){ exhaustTip=B.pt(endX, yr, zo); CRACK={pt:B.pt(ep2.x, ep2.y, ep2.z+ep2.zs*bore*0.3), dir:V3(0,1,0.2).transformDirection(B.top()).normalize(), len:bore*0.35}; }
      B.pop();
    }
  }

  /* ---------- internals (X-ray): crank, rods, pistons, and the port windows they uncover ---------- */
  setZone(1);
  (function(){
    var nT=per, ph=[];
    for(var q=0;q<nT;q++) ph.push(q*360/nT/(vee?1:1));
    var IG=new THREE.Group(); IG.name="internals"; IG.visible=false;
    var crank=new THREE.Group();
    var journal=new THREE.Mesh(CYL(bore*0.17, bore*0.17, bankLen+bore*0.30, 16), MAT.steel); journal.rotation.z=PI/2; crank.add(journal);
    var throws=[];
    for(var ti=0; ti<nT; ti++){
      var tx2=-bankLen/2+bspace*(ti+0.5), f0=deg(ph[ti]);
      var pin=new THREE.Mesh(CYL(bore*0.14, bore*0.14, bspace*0.40, 12), MAT.palu); pin.rotation.z=PI/2; pin.position.set(tx2, r*Math.cos(f0), r*Math.sin(f0)); crank.add(pin);
      for(var wsd=-1; wsd<=1; wsd+=2){
        /* full-circle flywheels, as a pressed-up two-stroke crank has */
        var fw=new THREE.Mesh(CYL(r+bore*0.30, r+bore*0.30, bore*0.10, 24), MAT.steel); fw.rotation.z=PI/2; fw.position.set(tx2+wsd*bspace*0.26, 0, 0); crank.add(fw);
      }
      throws.push({x:tx2, phase:f0});
    }
    IG.add(crank);
    var cyls=[], ports=[], mE=tsPortMat(0xff7a1a), mT=tsPortMat(0x3ab0ff);
    var pH=bore*0.56;
    for(var b2=0; b2<banks; b2++){
      var ang2=vee?(b2===0?a:-a):0, zs2=b2===0?1:-1;
      for(var c2=0; c2<per; c2++){
        var piston=new THREE.Mesh(CYL(bore*0.485, bore*0.485, pH, 22), MAT.palu);
        var rod=new THREE.Mesh(BOX(bore*0.14, Lr, bore*0.09), MAT.steel);
        IG.add(piston); IG.add(rod);
        var phs=throws[c2].phase+(vee&&b2?deg(180):0);
        cyls.push({ang:ang2, x:throws[c2].x, px:throws[c2].x, phase:phs, piston:piston, rod:rod});
        /* port windows on the liner, in the bank's frame: exhaust on the outside, transfers either side */
        var wg=new THREE.Group(); wg.rotation.x=ang2; IG.add(wg);
        var eTop=unif?null:portTop, eBot=bdc-bore*0.05;
        var cyl=cyls[cyls.length-1];
        if(!unif){
          var we=new THREE.Mesh(BOX(bore*0.55, Math.max(0.01, eTop-eBot), bore*0.02), mE.clone()); we.material.userData.perBuild=true;
          we.position.set(throws[c2].x, (eTop+eBot)/2, zs2*bore*0.50); wg.add(we);
          ports.push({m:we, cyl:cyl, top:eTop, kind:"e"});
        }
        for(var s2=-1; s2<=1; s2+=2){
          var wt=new THREE.Mesh(BOX(bore*0.02, Math.max(0.01, trTop-eBot), bore*0.40), mT.clone()); wt.material.userData.perBuild=true;
          if(unif){ wt.geometry=BOX(bore*0.98, Math.max(0.01, trTop-eBot), bore*0.98); }
          wt.position.set(throws[c2].x+(unif?0:s2*bore*0.50), (trTop+eBot)/2, -zs2*bore*0.06);
          wg.add(wt); ports.push({m:wt, cyl:cyl, top:trTop, kind:"t"});
          if(unif) break;
        }
      }
    }
    mE.dispose(); mT.dispose();
    G.add(IG);
    anim.internals={group:IG, crank:crank, r:r, L:Lr, ch:ch, cyls:cyls, theta:0, pistonH:pH, ports:ports};
  })();

  /* ---------- flywheel ---------- */
  setZone(1);
  var fwR=big?caseR*1.05:caseR*0.80, fwX=-bankLen/2-bore*(big?0.40:0.05);
  var fwm=new THREE.Mesh(CYL(fwR, fwR, bore*0.12, 30, false, 1.6), MAT.steel); fwm.rotation.z=PI/2;
  var fwg=new THREE.Group(); fwg.add(fwm); fwg.position.set(fwX-(big?0:bore*0.40), big?-caseR*0.05:-caseR*0.25, big?0:-caseR*0.55);
  if(big||DET){ fwm.castShadow=true; extras.push(fwg); anim.spin.push({o:fwg, axis:"x", k:1}); }

  return tsMaterialise(cfg, B, G, extras, t0, exhaustTip, dsl&&xp!=="chamber");
}
/* materialise (as buildRotaryMesh does) */
function tsMaterialise(cfg, B, G, extras, t0, exhaustTip, castPipe){
  var live;
  if(DET){
    live = { stainless: liveClone(MATHI.stainless), castexh: liveClone(MATHI.castexh),
      turbine: liveClone(pick(cfg.turbineMat,"cast_iron")==="inconel" ? MATHI.inconelCast : MATHI.turbine),
      wrinkle: coverFinish(pick(cfg.cover,"red"), COVER_COLORS[pick(cfg.cover,"red")]||COVER_COLORS.red), anod: tint(MATHI.anod, 0x8d949c) };
    live.anod.userData.perBuild=true;
    for(var hk in MATHI) if(!live[hk]) live[hk]=MATHI[hk];
    for(var dk in DECALS) live[dk]=DECALS[dk];
  } else {
    live = { stainless: liveClone(MAT.stainless), castexh: liveClone(MAT.castexh), turbine: liveClone(MAT.turbine),
      wrinkle: tint(MAT.wrinkle, COVER_COLORS[pick(cfg.cover,"red")]||COVER_COLORS.red), anod: tint(MAT.anod, 0x8d949c) };
    live.wrinkle.userData.perBuild=true; live.anod.userData.perBuild=true;
  }
  anim.glowMats = [live.stainless, live.castexh, live.turbine];
  var flushed = B.flush(G, live, true);
  for(var fk in flushed) if(fk.indexOf("decal")===0) flushed[fk].castShadow=false;
  for(var ei=0; ei<extras.length; ei++){
    if(!extras[ei]) continue;
    var ez=0; for(var zi=0; zi<ZONE_MARKS.length; zi++) if(ZONE_MARKS[zi][0]<=ei) ez=ZONE_MARKS[zi][1];
    extras[ei].traverse(function(o){ if(o.isMesh && o.geometry && !o.geometry.attributes.zone) zoneGeo(o.geometry, ez); });
    G.add(extras[ei]);
  }
  ZONE_EXTRAS=null; setZone(0);
  if(DET) flushHW(G, function(k){ return live[k] || MATHI[k] || MAT[k]; });
  CUR_B=null; DECALS={};
  G.traverse(function(o){
    var lk = o.userData && o.userData.liveKey;
    if(lk && live[lk]) o.material = live[lk];
    else if(DET && o.isMesh && HI_OF.has(o.material)) o.material = HI_OF.get(o.material);
    if(o.isMesh && !(o.material && o.material.isMeshBasicMaterial)){ if(Array.isArray(o.material)) o.material.forEach(heatPatch); else heatPatch(o.material); }
  });
  var t1=(typeof performance!=="undefined")?performance.now():0;
  G.userData.buildMs = t1-t0;
  G.userData.crack = CRACK; CRACK=null;
  G.userData.exhaustTip = exhaustTip || null;
  G.userData.twoStroke = true;
  return G;
}

/* the Napier Deltic: three banks of opposed-piston cylinders forming a triangle (apex down), a crankshaft at each
   corner (one of them turning the other way), the phasing gear case at one end and the scavenge blower at the other */
function buildDelticMesh(cfg, L, B, G, extras, t0){
  var nC=6, i, k, s;
  var bore=pick(cfg.bore,130)*K, stroke=pick(cfg.stroke,184)*K, rr=pick(cfg.rodRatio,2.2);
  var sF=clamp(6.0/(2*((stroke/2+stroke*rr+bore*0.37)*2/Math.sqrt(3)+stroke/2+bore*0.55)), 0.25, 1);   /* drawn to a size the stand and the camera can hold */
  bore*=sF; stroke*=sF;
  var r=stroke/2, ch=bore*0.34, Lr=stroke*rr, half=r+Lr+ch+bore*0.03;   /* crank to the middle of the cylinder */
  var D=2*half, Rt=D/Math.sqrt(3);                                      /* side and circumradius of the triangle */
  var bspace=bore*1.30+0.05, bankLen=nC*bspace+bore*0.4, caseR=r+bore*0.55;
  var blockKey=(pick(cfg.blockMat,"alu_liners").indexOf("alu")===0)?"calu":"iron";
  var corners=[], cAng=[-PI/2, PI/6, 5*PI/6];                           /* apex down: bottom, upper right, upper left */
  for(i=0;i<3;i++) corners.push(V3(0, Rt*Math.sin(cAng[i]), Rt*Math.cos(cAng[i])));
  DCTX.bore=bore;
  EXH_COLL=[]; EXH_TAILS=[]; PIPE_LOG=[]; CRACK=null; LAST_PIPE_END=null;
  var exhaustTip=null;
  /* crankcases at the corners and the triangular phasing-gear case at the rear */
  setZone(1);
  for(i=0;i<3;i++) B.add(blockKey, CYL(caseR, caseR, bankLen+bore*0.3, 28), 0, corners[i].y, corners[i].z, 0,0,PI/2);
  B.add(blockKey, CYL(Rt+caseR*1.05, Rt+caseR*1.05, bore*0.7, 3), -bankLen/2-bore*0.5, 0, 0, PI/2,0,PI/2);   /* three-sided gear case */
  B.add("wrinkle", CYL(Rt+caseR*0.85, Rt+caseR*0.85, bore*0.12, 3), -bankLen/2-bore*0.92, 0, 0, PI/2,0,PI/2);
  /* the banks: each side of the triangle is a block of six cylinders; exhaust belt toward one crank, air belt toward the other */
  var banksInfo=[];
  for(i=0;i<3;i++){
    var A=corners[i], Bc=corners[(i+1)%3], mid=A.clone().add(Bc).multiplyScalar(0.5), dir=Bc.clone().sub(A).normalize();
    var outN=mid.clone().setX(0).normalize();                           /* outward from the triangle's centre */
    var angX=Math.atan2(dir.z, dir.y);                                   /* rotation about X taking +Y onto dir */
    var M=new THREE.Matrix4().makeTranslation(0, mid.y, mid.z).multiply(new THREE.Matrix4().makeRotationX(angX));
    B.push(M);
    var outZ=(V3(0,0,1).applyAxisAngle(V3(1,0,0), angX).dot(outN) > 0) ? 1 : -1;   /* which local Z faces out */
    setZone(2);
    B.add(blockKey, RBOX(bankLen, D-caseR*1.4, bore*1.55, 0.04), 0, 0, 0);
    setZone(4);
    B.add("castexh", CYL(bore*0.30, bore*0.34, bankLen*0.96, 18), 0, half*0.30, outZ*bore*0.95, 0,0,PI/2);     /* exhaust manifold, outside */
    for(s=0;s<nC;s++) B.add("castexh", BOX(bore*0.5, bore*0.35, bore*0.25), -bankLen/2+bspace*(s+0.5), half*0.30, outZ*bore*0.80);
    setZone(5);
    B.add("calu", RBOX(bankLen*0.96, bore*0.6, bore*0.5, 0.05), 0, -half*0.30, -outZ*bore*0.90);           /* air manifold, inside */
    banksInfo.push({M:M.clone(), outZ:outZ, A:A, Bc:Bc, dir:dir});
    if(i===1){ exhaustTip=B.pt(bankLen*0.45, half*0.30, outZ*bore*1.3); CRACK={pt:B.pt(0, half*0.30, outZ*bore*1.1), dir:V3(0,0,outZ).transformDirection(B.top()).normalize(), len:bore*0.5}; }
    B.pop();
  }
  /* the scavenge blower and its volute at the free end */
  setZone(5);
  B.add("calu", CYL(Rt*0.75, Rt*0.75, bore*0.9, 30), bankLen/2+bore*0.75, 0, 0, 0,0,PI/2);
  B.add("calu", TOR(Rt*0.75, bore*0.35, 10, 30), bankLen/2+bore*0.75, 0, 0, 0,PI/2,0);
  B.add("dark", CYL(Rt*0.32, Rt*0.40, bore*0.6, 24), bankLen/2+bore*1.45, 0, 0, 0,0,PI/2);
  /* exhaust stacks up from the two top banks' manifolds */
  setZone(4);
  var topY=Math.max(corners[1].y, corners[2].y)+caseR;
  pipeMesh(B, [V3(bankLen*0.2, topY*0.6, corners[1].z*0.4), V3(bankLen*0.2, topY+bore*1.2, corners[1].z*0.4), V3(bankLen*0.2, topY+bore*2.6, corners[1].z*0.4)], bore*0.30, "stainless");
  exhaustTip=V3(bankLen*0.2, topY+bore*2.6, corners[1].z*0.4);
  /* X-ray: three cranks and thirty-six pistons meeting in eighteen cylinders */
  setZone(1);
  (function(){
    var IG=new THREE.Group(); IG.name="internals"; IG.visible=false;
    var cranks=[], op=[], pH=bore*0.56;
    for(var c=0;c<3;c++){
      var cg=new THREE.Group(); cg.position.copy(corners[c]);
      var j=new THREE.Mesh(CYL(bore*0.18, bore*0.18, bankLen+bore*0.3, 14), MAT.steel); j.rotation.z=PI/2; cg.add(j);
      for(var t=0;t<nC;t++){ var f=deg(t*60), pn=new THREE.Mesh(CYL(bore*0.14, bore*0.14, bspace*0.45, 10), MAT.palu); pn.rotation.z=PI/2; pn.position.set(-bankLen/2+bspace*(t+0.5), r*Math.cos(f), r*Math.sin(f)); cg.add(pn); }
      IG.add(cg); cranks.push({g:cg, sign:c===1?-1:1, off:deg(c*20)});
    }
    for(var b=0;b<3;b++){
      var bi=banksInfo[b];
      for(var e=0;e<2;e++){
        var cIdx=e===0?b:(b+1)%3, C=corners[cIdx], u=(e===0?bi.dir.clone():bi.dir.clone().negate());
        for(var t2=0;t2<nC;t2++){
          var pm=new THREE.Mesh(CYL(bore*0.485, bore*0.485, pH, 18), MAT.palu), rd=new THREE.Mesh(BOX(bore*0.14, Lr, bore*0.09), MAT.steel);
          IG.add(pm); IG.add(rd);
          op.push({c:cranks[cIdx], C:C.clone(), u:u, x:-bankLen/2+bspace*(t2+0.5), phase:deg(t2*60), piston:pm, rod:rd});
        }
      }
    }
    G.add(IG);
    anim.internals={group:IG, crank:cranks[0].g, r:r, L:Lr, ch:ch, cyls:[], theta:0, pistonH:pH, op:op, cranks:cranks};
  })();
  return tsMaterialise(cfg, B, G, extras, t0, exhaustTip, true);
}

