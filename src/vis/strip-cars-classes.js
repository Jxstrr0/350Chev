/* ---------------------------------------------------------------------------
   DRAG CARS v3 — the nitro classes.
   sc_tfrail: Top Fuel-scale dragster (300" wheelbase, biplane rear wing high over the slicks, a big front wing,
              14-71 blower + butterfly hat, eight zoomies a side, the cage). Replaces the v2 rail when hw is given.
   sc_funny:  nitro funny car — a one-piece carbon body (res.flipB -> its own group, hinged at the back, so the
              pits can lift it) over a short (125") chassis, blower and hat through the hood, headers out the sides.
   Both hand meta.flames = every header outlet ({p, d}, body frame) for the night-time header flames (dragfx),
   meta.eng (engine centre) and meta.hat (blower hat).
   -------------------------------------------------------------------------*/
function sc_V(x,y,z){ return new THREE.Vector3(x,y,z); }
/* a 14-71 style blower on a manifold, with restraint straps and a butterfly hat; returns the hat mouth */
function sc_bigBlower(B, x, y, len, hatMat){
  B.add("satin", sc_rbox(len*0.92, 0.08, 0.36, 0.015), sc_M(x, y+0.04, 0));                    /* manifold */
  B.add("alu", sc_rbox(len, 0.3, 0.36, 0.05), sc_M(x, y+0.23, 0));                           /* case */
  for(var i=0;i<6;i++) B.add("satin", sc_rbox(0.014, 0.18, 0.37, 0.004), sc_M(x-len*0.4+i*len*0.16, y+0.24, 0));
  B.add("satin", sc_rbox(0.05, 0.02, 0.4, 0.006), sc_M(x-len*0.25, y+0.39, 0)); B.add("satin", sc_rbox(0.05, 0.02, 0.4, 0.006), sc_M(x+len*0.25, y+0.39, 0));
  B.add("alu", sc_rbox(0.12, 0.2, 0.2, 0.03), sc_M(x+len*0.5+0.05, y+0.2, 0));                 /* snout / drive */
  B.add("satin", sc_rbox(len*0.7, 0.04, 0.34, 0.012), sc_M(x, y+0.4, 0));                    /* hat base */
  B.add(hatMat||"alu", sc_prof([[0.26,0],[0.3,0.34],[0.12,0.4],[-0.26,0.3],[-0.28,0]], 0.34, 0.02), sc_M(x+0.03, y+0.42, 0));
  B.add("well", sc_rbox(0.02, 0.26, 0.26, 0.01), sc_M(x+0.315, y+0.6, 0, 0,0,0.12));
  return sc_V(x+0.1, y+0.86, 0);
}
/* eight short zoomies per side, up and back; pushes every outlet to flames, two per side to the exhaust tips */
function sc_zoomies(B, x0, dx, y, z0, len, tips, dirs, flames, out, H){
  /* a pipe per cylinder over the same engine length (V8: four a bank); inline / rotary one side; flat lower and wider */
  var PO=sc_ports(H), n=PO.per, sp=n>1?Math.min(dx*2, dx*7/(n-1)):0, xs=x0-dx*3.5+sp*(n-1)/2, r=0.027*PO.r;
  if(PO.flat){ y-=0.12; z0+=0.06; out=(out||0.3)+0.15; }
  PO.sides.forEach(function(sd){ for(var i=0;i<n;i++){
    var x=xs-i*sp, a=sc_V(x, y, sd*z0), b=sc_V(x-0.02, y+0.05, sd*(z0+0.1)), c=sc_V(x-len*0.55, y+len*0.85, sd*(z0+0.1+len*(out||0.3)));
    if(!SC.lite || n<=4 || i%2===0){ B.add("alu", TUBE([a,b,c], r, SC.lite?2:6, SC.lite?5:10)); sc_pipeEnd(B, "alu", b, c, r); }   /* Lite: every other pipe past four, coarser */
    var d=c.clone().sub(b).normalize(); flames.push({p:c.clone(), d:d});
    if(PO.tip(i)){ tips.push(c.clone()); dirs.push(d.clone()); }
  } });
}

/* --- Top Fuel dragster ----------------------------------------------------- */
function sc_tfrail(B, rr, tails, heads, res, H){
  var xr=-3.2, xf=4.42, fr=0.29, V=sc_V, i;
  var D=sc_def([
    [-2.05,.20,.50,.62,.30,.27,.03],[-1.70,.19,.52,.66,.31,.26,.04],[-1.10,.18,.52,.70,.30,.24,.05],[-0.60,.17,.48,.62,.27,.22,.05],
    [0.60,.17,.40,.50,.21,.17,.04],[2.20,.18,.34,.42,.16,.13,.03],[3.80,.20,.30,.36,.12,.10,.03],[4.90,.21,.27,.31,.09,.075,.02],[5.55,.23,.25,.27,.05,.04,.01]], {sub:H.lite?2:3});
  var L=sc_loft(D); B.add("paint", L.paint); B.add("well", L.well);
  sc_decal(res, sc_patch(D, -0.55, 0.45, 2.3, 5.4, 0.004, null, 0.5)); sc_decal(res, sc_patch(D, -0.55, 0.45, 14.6, 17.7, 0.004, "L", 0.5));
  res.hood=sc_patch(D, 1.6, 3.0, 8.4, 11.6, 0.008, null, 0.5);
  /* cockpit, driver, cage */
  B.add("well", sc_patch(D, -1.95, -1.15, 8.6, 11.4, 0.004, null, 0.5));
  B.add("paint", new THREE.SphereGeometry(0.16, 16, 12), sc_M(-1.55, 0.9, 0));
  B.add("visor", new THREE.SphereGeometry(0.162, 12, 8, -0.9, 1.8, 1.2, 0.7), sc_M(-1.55, 0.9, 0, 0, PI, 0));
  B.add("satin", new THREE.CylinderGeometry(0.2, 0.26, 0.3, 12), sc_M(-1.6, 0.64, 0));
  [-1,1].forEach(function(sd){
    B.add("tube", sc_cyl(0.024,8), sc_rodM(V(-1.95,0.52,sd*0.28), V(-1.88,1.16,sd*0.2)));
    B.add("tube", sc_cyl(0.022,8), sc_rodM(V(-1.88,1.16,sd*0.2), V(-1.12,0.66,sd*0.26)));
    B.add("tube", sc_cyl(0.02,8), sc_rodM(V(-1.88,1.16,sd*0.2), V(-2.15,0.62,sd*0.28)));
    B.add("tube", sc_cyl(0.018,6), sc_rodM(V(-1.5,1.12,sd*0.18), V(-1.45,0.58,sd*0.29)));
    B.add("tube", sc_cyl(0.018,6), sc_rodM(V(-1.88,1.16,sd*0.2), V(-1.5,1.12,sd*0.18)));
  });
  B.add("tube", sc_cyl(0.022,8), sc_rodM(V(-1.88,1.16,-0.2), V(-1.88,1.16,0.2)));
  B.add("tube", sc_cyl(0.02,8), sc_rodM(V(-1.5,1.12,-0.18), V(-1.5,1.12,0.18)));
  /* chassis: rails from the axle forward to the body, triangulated */
  [-1,1].forEach(function(sd){
    B.add("tube", sc_cyl(0.028,8), sc_rodM(V(-2.05,0.22,sd*0.3), V(-3.55,0.26,sd*0.3)));
    B.add("tube", sc_cyl(0.024,8), sc_rodM(V(-2.1,0.6,sd*0.3), V(-3.5,0.62,sd*0.28)));
    for(i=0;i<3;i++) B.add("tube", sc_cyl(0.017,6), sc_rodM(V(-2.1-i*0.48,0.23,sd*0.3), V(-2.58-i*0.46,0.61,sd*0.29)));
    B.add("tube", sc_cyl(0.02,6), sc_rodM(V(-3.55,0.26,sd*0.3), V(-3.5,0.62,sd*0.28)));
  });
  B.add("satin", sc_cyl(0.065,12), sc_rodM(V(xr,rr,-0.42), V(xr,rr,0.42)));
  B.add("satin", sc_rbox(0.36,0.32,0.36,0.05), sc_M(xr, rr, 0));
  B.add("tube", sc_cyl(0.03,8), sc_rodM(V(xf,fr,-0.5), V(xf,fr,0.5)));
  /* engine ahead of the axle, the blower and hat on top, zoomies */
  var ex=-2.5, gates=[], hat=null, tips=[], dirs=[], flames=[], ra=H.asp;
  B.add("engine", sc_rbox(0.82,0.42,0.42,0.03), sc_M(ex, 0.48, 0));
  B.add("engine", sc_rbox(0.6,0.12,0.3,0.03), sc_M(ex, 0.24, 0));
  var PO=sc_ports(H);   /* heads to match: a V pair, one upright head (inline / rotary housing), or flat out to the sides */
  if(PO.one){ B.add("alu", sc_rbox(0.78,0.1,0.24,0.03), sc_M(ex, 0.8, 0)); B.add("engine", sc_rbox(0.8,0.16,0.3,0.02), sc_M(ex, 0.7, 0)); }
  else if(PO.flat) [-1,1].forEach(function(sd){ B.add("alu", sc_rbox(0.78,0.2,0.1,0.03), sc_M(ex, 0.5, sd*0.36)); B.add("engine", sc_rbox(0.8,0.24,0.16,0.02), sc_M(ex, 0.5, sd*0.26)); });
  else [-1,1].forEach(function(sd){ B.add("alu", sc_rbox(0.78,0.1,0.2,0.03), sc_M(ex, 0.76, sd*0.21, sd*-0.55,0,0)); B.add("engine", sc_rbox(0.8,0.2,0.16,0.02), sc_M(ex, 0.64, sd*0.2, sd*-0.55,0,0)); });
  if(ra==="blower") hat=sc_bigBlower(B, ex, 0.8, 0.86, "paint");
  else if(ra==="na"){ B.add("satin", sc_rbox(0.6,0.06,0.3,0.012), sc_M(ex, 0.85, 0)); B.add("paint", sc_prof([[0.18,0],[0.22,0.28],[0.06,0.32],[-0.2,0.25],[-0.2,0]], 0.3, 0.015), sc_M(ex+0.05, 0.87, 0)); B.add("well", sc_rbox(0.02,0.2,0.22,0.01), sc_M(ex+0.265, 1.02, 0, 0,0,0.15)); hat=V(ex+0.08, 1.2, 0); }
  else { B.add("satin", sc_rbox(0.6,0.06,0.3,0.012), sc_M(ex, 0.85, 0));
    (ra==="twin"||ra==="turbo"?[-1,1]:[1]).forEach(function(sd){
      B.add("alu", new THREE.CylinderGeometry(0.15,0.15,0.13,16), sc_M(ex+0.12, 0.98, sd*0.36, PI/2,0,0));
      B.add("barrel", new THREE.TorusGeometry(0.15,0.035,6,16), sc_M(ex+0.12, 0.98, sd*0.36));
      sc_bell(B, ex+0.3, 0.98, sd*0.36, 0.085);
      if(ra!=="centri"){ var a=V(ex-0.12, 0.9, sd*0.34), b=V(ex-0.2, 1.22, sd*0.38); B.add("chrome", sc_cyl(0.028,10), sc_rodM(a,b)); gates.push({p:b.clone(), d:V(-0.3,1,sd*0.1).normalize()}); } }); }
  sc_zoomies(B, ex+0.3, 0.085, PO.one?0.68:0.64, PO.one?0.17:0.3, 0.3, tips, dirs, flames, 0.25, H);
  /* biplane rear wing high over the slicks, on struts from the axle */
  var wx=-4.0, wl=1.72, wu=2.1;
  B.add("carbonS", sc_foil(0.78, 0.13, 1.3), sc_M(wx, wl, 0, 0,0,-0.32));
  B.add("carbonS", sc_foil(0.6, 0.12, 1.3), sc_M(wx-0.1, wu, 0, 0,0,-0.36));
  B.add("paint", sc_rbox(0.04, 0.05, 1.3, 0.01), sc_M(wx-0.4, wl+0.13, 0));
  [-1,1].forEach(function(sd){
    B.add("paint", sc_prof([[0.52,-0.28],[0.5,0.32],[0.1,0.66],[-0.52,0.66],[-0.56,-0.28]], 0.016, 0.004), sc_M(wx, wl, sd*0.66));
    B.add("tube", sc_cyl(0.03,8), sc_rodM(V(-3.45,0.62,sd*0.28), V(wx+0.15,wl-0.1,sd*0.32)));
    B.add("tube", sc_cyl(0.02,6), sc_rodM(V(-3.0,0.62,sd*0.28), V(wx+0.3,wl-0.08,sd*0.32)));
    B.add("tube", sc_cyl(0.016,6), sc_rodM(V(wx+0.1,wl+0.08,sd*0.32), V(wx,wu-0.06,sd*0.32)));
  });
  /* big front wing on the nose, ahead of the front wheels */
  var fx=5.05, fy=0.5;
  B.add("carbonS", sc_foil(0.36, 0.12, 1.24), sc_M(fx, fy, 0, 0,0,-0.18));
  [-1,1].forEach(function(sd){ B.add("paint", sc_prof([[0.22,-0.1],[0.22,0.1],[-0.22,0.16],[-0.22,-0.1]], 0.012, 0.003), sc_M(fx, fy, sd*0.62));
    B.add("tube", sc_cyl(0.014,6), sc_rodM(V(fx-0.05,0.27,sd*0.06), V(fx,fy-0.02,sd*0.3))); });
  /* wheelie bars, twin chute pack on the wing struts, brake light */
  var maxP=deg(3), bx0=-3.55, bx1=-5.15, br=0.06, dxB=bx1-xr, cy=(br-rr-dxB*Math.sin(maxP))/Math.cos(maxP)+rr;
  [-1,1].forEach(function(sd){ var b=V(bx1,cy,sd*0.2);
    B.add("tube", sc_cyl(0.022,8), sc_rodM(V(bx0,0.26,sd*0.24), b)); B.add("tube", sc_cyl(0.014,6), sc_rodM(V(bx0,0.6,sd*0.24), b));
    B.add("rubber", new THREE.CylinderGeometry(br,br,0.04,14), sc_M(bx1,cy,sd*0.2, PI/2,0,0)); B.add("alu", new THREE.CylinderGeometry(br*0.55,br*0.55,0.045,10), sc_M(bx1,cy,sd*0.2, PI/2,0,0)); });
  B.add("tube", sc_cyl(0.016,8), sc_rodM(V(bx1+0.05,cy,-0.2), V(bx1+0.05,cy,0.2)));
  [-1,1].forEach(function(sd){ B.add("bag", sc_rbox(0.26,0.26,0.24,0.05), sc_M(-3.72, 0.62, sd*0.14)); });
  B.add("paint", sc_rbox(0.03,0.2,0.5,0.012), sc_M(-3.86, 0.62, 0));
  tails.push({g:sc_rbox(0.03,0.05,0.3,0.01), m:sc_M(-3.875, 0.78, 0)});
  var wh=[], brk=!H.lite;
  [-1,1].forEach(function(sd){
    wh.push({x:xr, z:sd*0.62, r:rr, w:clamp(0.36+(rr*2/0.0254-32)*0.022,0.36,0.46), rimR:0.205, style:"bead", rimMat:"alu", rear:true, letters:true, brake:brk});
    wh.push({x:xf, z:sd*0.5, r:fr, w:0.07, rimR:0.215, style:"wire", rimMat:"alu", rear:false, letters:false});
  });
  if(brk) sc_calipers(B, wh);
  return { rr:rr, fr:fr, xr:xr, xf:xf, wheels:wh, tips:tips, dirs:dirs, flames:flames, headers:flames, eng:V(ex, 0.75, 0), anchor:V(-3.86,0.62,0), bars:true, maxPitch:maxP, gates:gates, hat:hat,
    squat:deg(0.4), squatDrop:0.008, shiftKick:0.08, pitchW:9.5, droop:0.03, wrinkle:1.15, chuteLen:5.8, chuteRise:0.6, chuteR:0.95 };
}

/* --- nitro funny car --------------------------------------------------------- */
function sc_funny(B, rr, tails, heads, res, H){
  var xr=-1.59, xf=1.59, fr=0.3, V=sc_V, FB=sc_bin(), i;
  res.flipB=FB;
  var D=sc_def([
    [-2.42,.30,.96,1.0,.88,.84,.02],[-2.34,.22,1.02,1.06,.93,.88,.02],[-1.85,.17,1.0,1.08,.96,.88,.03],[-1.40,.15,.97,1.12,.96,.78,.04],
    [-0.90,.14,.92,1.2,.95,.62,.04],[-0.30,.13,.87,1.18,.94,.6,.04],[0.20,.12,.82,.93,.93,.78,.03],[1.10,.10,.74,.80,.92,.84,.03],
    [2.20,.09,.58,.62,.88,.80,.02],[3.10,.08,.40,.43,.80,.70,.02],[3.48,.09,.24,.26,.66,.58,.01]],
    {arches:[{x:xr, y:rr, R:rr+0.04},{x:xf, y:fr, R:fr+0.05}], sub:H.lite?2:3});
  var L=sc_loft(D); FB.add("paint", L.paint); FB.add("carbonS", L.well);
  /* glass: windshield, backlight, small side glass; door decals and the hood patch ride on the body */
  FB.add("glass", sc_patch(D, -0.27, 0.17, 8.28, 11.72, 0.006));
  FB.add("glass", sc_patch(D, -1.42, -0.95, 8.28, 11.72, 0.006));
  FB.add("glass", sc_patch(D, -0.8, 0.1, 5.6, 7.7, 0.006)); FB.add("glass", sc_patch(D, -0.8, 0.1, 12.3, 14.4, 0.006, "L"));
  res.decals.push({g:sc_patch(D, -1.25, -0.25, 2.3, 4.75, 0.004, null, 0.5), kind:"door", flip:true});
  res.decals.push({g:sc_patch(D, -1.25, -0.25, 15.25, 17.7, 0.004, "L", 0.5), kind:"door", flip:true});
  res.decals.push({g:sc_patch(D, -0.29, -0.16, 8.3, 11.7, 0.009, "K", 0.5), kind:"banner", flip:true});
  res.hood=sc_patch(D, 1.6, 2.6, 8.45, 11.55, 0.012, "K", 0.5);
  /* the body's split line, carbon skirts and splitter, decal headlamps, rear spoiler on the deck */
  FB.add("seam", sc_patch(D, -2.39, -2.38, 1.6, 18.4, 0.002));
  FB.add("carbonS", sc_prof([[0,0],[0.42,0],[0.46,0.03],[0,0.05]], 1.66, 0.006), sc_M(3.0, 0.04, 0));
  FB.add("well", sc_patch(D, 2.55, 3.0, 8.2, 9.2, 0.005)); FB.add("well", sc_patch(D, 2.55, 3.0, 10.8, 11.8, 0.005));   /* decal headlamps */
  var sx=-2.3, sP=sc_at(D, sx);
  FB.add("carbonS", sc_prof([[0.3,0],[0.0,0.2],[-0.32,0.42],[-0.38,0.4],[-0.06,0]], 1.86, 0.008), sc_M(sx, sP.yt-0.03, 0));
  [-1,1].forEach(function(sd){ FB.add("carbonS", sc_prof([[0.3,0],[-0.4,0.46],[-0.42,0.2],[-0.1,-0.06]], 0.014, 0.003), sc_M(sx, sP.yt-0.03, sd*0.93)); });
  tails.push({g:sc_rbox(0.03, 0.05, 0.6, 0.012), m:sc_M(-2.43, 0.72, 0)});
  /* chassis: cage, driver (seen through the glass), rear axle, wheelie bars */
  B.add("paint", new THREE.SphereGeometry(0.155, 16, 12), sc_M(-0.72, 0.86, 0));
  B.add("visor", new THREE.SphereGeometry(0.157, 12, 8, -0.9, 1.8, 1.2, 0.7), sc_M(-0.72, 0.86, 0, 0, PI, 0));
  B.add("satin", new THREE.CylinderGeometry(0.2, 0.25, 0.3, 12), sc_M(-0.8, 0.58, 0));
  [-1,1].forEach(function(sd){ B.add("tube", sc_cyl(0.022,8), sc_rodM(V(-1.1,0.2,sd*0.32), V(-1.0,1.06,sd*0.24))); B.add("tube", sc_cyl(0.02,8), sc_rodM(V(-1.0,1.06,sd*0.24), V(-0.2,0.7,sd*0.3)));
    B.add("tube", sc_cyl(0.024,8), sc_rodM(V(-2.2,0.2,sd*0.3), V(2.4,0.16,sd*0.3))); });
  B.add("tube", sc_cyl(0.022,8), sc_rodM(V(-1.0,1.06,-0.24), V(-1.0,1.06,0.24)));
  B.add("satin", sc_cyl(0.065,12), sc_rodM(V(xr,rr,-0.46), V(xr,rr,0.46)));
  B.add("satin", sc_rbox(0.36,0.32,0.36,0.05), sc_M(xr, rr, 0));
  B.add("tube", sc_cyl(0.028,8), sc_rodM(V(xf,fr,-0.6), V(xf,fr,0.6)));
  /* engine: blower and hat out through the hood, eight headers a side out through the body behind the front wheels */
  var ex=0.75, hat=null, gates=[], tips=[], dirs=[], flames=[], P=sc_at(D, ex);
  B.add("engine", sc_rbox(0.8,0.4,0.44,0.03), sc_M(ex, 0.42, 0));
  if(H.asp==="blower" || H.asp==="na") hat=sc_bigBlower(B, ex, P.yt-0.06, 0.8, "paint");
  else { (H.asp==="twin"||H.asp==="turbo"?[-1,1]:[1]).forEach(function(sd){ sc_bell(B, ex+0.3, P.yt+0.08, sd*0.22, 0.09); });
    B.add("carbonS", sc_prof([[0.42,0],[0.3,0.1],[-0.36,0.12],[-0.42,0]], 0.7, 0.02), sc_M(ex, P.yt-0.02, 0)); }
  var hp=sc_at(D, ex+0.1);
  sc_zoomies(B, ex+0.32, 0.09, 0.52, hp.w-0.12, 0.26, tips, dirs, flames, 0.45, H);
  /* wheelie bars, twin chutes */
  var maxP=deg(4), bx0=-2.3, bx1=-3.9, br=0.06, dxB=bx1-xr, cy=(br-rr-dxB*Math.sin(maxP))/Math.cos(maxP)+rr;
  [-1,1].forEach(function(sd){ var b=V(bx1,cy,sd*0.24);
    B.add("tube", sc_cyl(0.022,8), sc_rodM(V(bx0,0.26,sd*0.3), b)); B.add("tube", sc_cyl(0.014,6), sc_rodM(V(bx0,0.5,sd*0.3), b));
    B.add("rubber", new THREE.CylinderGeometry(br,br,0.04,14), sc_M(bx1,cy,sd*0.24, PI/2,0,0)); B.add("alu", new THREE.CylinderGeometry(br*0.55,br*0.55,0.045,10), sc_M(bx1,cy,sd*0.24, PI/2,0,0)); });
  B.add("tube", sc_cyl(0.016,8), sc_rodM(V(bx1+0.05,cy,-0.24), V(bx1+0.05,cy,0.24)));
  [-1,1].forEach(function(sd){ B.add("bag", sc_rbox(0.24,0.26,0.24,0.05), sc_M(-2.55, 0.5, sd*0.15)); });
  B.add("satin", sc_rbox(0.04,0.3,0.56,0.012), sc_M(-2.44, 0.5, 0));
  var wh=[], brk=!H.lite;
  [-1,1].forEach(function(sd){
    wh.push({x:xr, z:sd*0.66, r:rr, w:clamp(0.36+(rr*2/0.0254-32)*0.022,0.36,0.46), rimR:0.205, style:"bead", rimMat:"rimBlack", rear:true, letters:true, brake:brk});
    wh.push({x:xf, z:sd*0.7, r:fr, w:0.1, rimR:0.19, style:"weld", rimMat:"rimBlack", rear:false, letters:false});
  });
  if(brk) sc_calipers(B, wh);
  return { rr:rr, fr:fr, xr:xr, xf:xf, wheels:wh, tips:tips, dirs:dirs, flames:flames, headers:flames, eng:V(ex, 0.7, 0), anchor:V(-2.6,0.5,0), bars:true, maxPitch:maxP, gates:gates, hat:hat,
    hinge:V(-2.4, 1.0, 0), squat:deg(0.6), squatDrop:0.012, shiftKick:0.1, pitchW:8.5, droop:0.035, wrinkle:1.15, chuteLen:5.4, chuteRise:0.5, chuteR:0.95 };
}
