/* ===========================================================================
   TEARDOWN VIEW — after a failure: an exploded section of this engine (block
   barrel, lifted head, the failed cylinder's piston and rod pulled out, crank
   throw, bearings, valves, turbo as needed) built on demand over the stand,
   the failed part glowing and pulsing, everything else dimmed.
   ENGINE_VIS.teardown({failId, layout:{banks,angle,n}, bore, stroke, rodRatio,
   diesel, cyl, asp, blockMat, headMat, valves})   ·   ENGINE_VIS.teardown(null)
   ==========================================================================*/
var TD = { on:false, root:null, saved:null, glow:[], cracks:[], mats:[], geos:[], light:null, dmg:null, view:null, focusObj:null, t:0 };
var TD_MAP = { detonation:"ringland", knock:"ringland", preignition_egt:"holed", crown_temp:"holed", fuel_delivery:"holed", lean:"holed", piston:"holed",
  crown_pressure:"crowncrack", hot_clearance:"scuffed", seize:"scuffed", slap_blowby:"scuffed", ring_gap:"ring",
  rod_tension:"rodsnap", piston_speed:"rodsnap", rod:"rodsnap", rod_buckling:"rodbent", rod_bolts:"rodbolt",
  crank_fatigue:"crank", torsional:"crank", crank:"crank", bearing_load:"bearing", oil_film:"bearing", worn:"bearing",
  oil_starvation:"starve", head_lift:"headlift", gasket_shear:"gasket", steam:"gasket", cooling:"warp",
  valve_float:"valvebent", valve_piston:"valvebent", valve:"valvebent", valve_temp:"valveburn",
  compressor_map:"compressor", turbine_temp:"turbine", turbo:"turbine", bore_distortion:"boredist", wall_thickness:"wall",
  manifold:"manifold", backfire:"backfire", panel:"backfire", cold_start:"cold" };
/* [part, what you are looking at (one line), fallback fix] */
var TD_TXT = {
  ringland:["Piston \u00b7 top ring land","Detonation hammered the edge of the crown until the top ring land cracked away","Raise the fuel's octane, drop compression or boost, or cool the charge."],
  holed:["Piston crown","The crown overheated and melted through \u2014 a hole straight into the crankcase","Richen the mixture, fix the knock so the timing isn't pulled, or fit piston cooling jets."],
  crowncrack:["Piston crown","Peak cylinder pressure split the crown across the middle","Forged pistons, less boost or timing, or a thicker crown."],
  scuffed:["Piston skirt & bore","The piston grew into the bore and scuffed \u2014 aluminium smeared down the skirt and the wall","Open the piston-to-wall clearance, or keep the crown cooler."],
  ring:["Top compression ring","The ring ends butted when it got hot \u2014 the ring snapped and scuffed its land","Open the ring end gaps to suit the bore, boost and nitrous."],
  rodsnap:["Connecting rod","The rod snapped across the beam \u2014 inertia at the top of the stroke pulled it apart","Lower the redline, lighten the piston, or fit a stronger forged rod."],
  rodbent:["Connecting rod","Cylinder pressure buckled the rod beam into a bow","A stiffer rod (H-beam or billet), or less peak pressure \u2014 boost, timing, nitrous."],
  rodbolt:["Rod bolts & cap","A rod bolt stretched and let go \u2014 the cap came off the crankpin","Upgrade the rod bolts and torque them to stretch."],
  crank:["Crankshaft","The crank cracked at the pin fillet and broke in two","A forged or billet crank, a proper damper, or a lower redline."],
  bearing:["Rod bearing","The oil film broke down and the bearing spun \u2014 scored shell, blued crankpin","Thicker oil, better bearings, more clearance, or less load."],
  starve:["Oil pickup & rod bearing","The pickup sucked air, the oil pressure went away and the rod bearing spun","A baffled sump or a dry sump, or a lower redline."],
  headlift:["Cylinder head & studs","Cylinder pressure stretched the head bolts and lifted the head off the deck","Fit head studs and a fire-ringed gasket, or reduce peak pressure."],
  gasket:["Head gasket","The gasket blew out past the fire ring \u2014 combustion gas escaped across the deck","An MLS or copper gasket on studs, or less cylinder pressure."],
  warp:["Cylinder head","More heat than the cooling could reject \u2014 the head warped and the gasket steamed","A bigger radiator and better cooling, or less sustained power."],
  valvebent:["Valve","The valve met the piston and bent \u2014 witness marks on the crown","Stiffer springs, lighter valves, a milder cam, or a lower redline."],
  valveburn:["Exhaust valve","The exhaust valve burned \u2014 a chunk of the valve head eroded away","Richen the mixture, sodium-filled or Inconel valves, more seat contact."],
  compressor:["Compressor wheel","The compressor ran off its map and the blades took the hit","A bigger compressor, or less boost at that airflow."],
  turbine:["Turbine wheel","Exhaust heat cracked the turbine wheel and threw blade tips","Less retard, a richer mixture, a shorter hold, or an Inconel hot side."],
  boredist:["Cylinder bore","The bore went out of round \u2014 the rings stopped sealing and scored the wall","Hone with a torque plate, closed deck, or a stiffer block."],
  wall:["Cylinder wall","The wall between the bores cracked \u2014 too thin for the heat and pressure","A smaller bore, or a block material that takes a thinner wall."],
  manifold:["Exhaust manifold","The manifold cracked from the heat \u2014 too long on the limiter","Shorter two-step holds, less retard, or a tubular stainless manifold."],
  backfire:["Intake plenum","A misfire lit the fuel and nitrous in the intake and split the plenum","Fix the lean misfire, keep the mixture rich, shorter runners or a burst panel."],
  cold:["Combustion chamber","The fuel sprayed into cold air and never lit \u2014 the chamber is washed with raw diesel","Higher compression, a higher-cetane fuel, or a common rail with pilot shots."]
};
Object.assign(TD_MAP, { ts_seize:"scuffed", port_wear:"ring", crank_seals:"bearing", pipe_crack:"manifold", plug_foul:"ringland", scav_air:"cold" });
var TD_TXT_ID = {
  ts_seize:["Piston & barrel \u00b7 exhaust side","The piston seized on its exhaust side: aluminium smeared across the port bridge and down the skirt","A richer premix and jetting, looser clearance, more cooling \u2014 never let it run lean on the pipe."],
  port_wear:["Rings & exhaust port","The ring ends wore where they flex into the exhaust window, and one finally snagged the port edge and broke","Shorter exhaust duration or a bridged port, fewer revs, and a top end at the service interval."],
  crank_seals:["Crankcase seals & main bearing","A main seal hardened and leaked: the crankcase pulled air, that cylinder ran lean and the big end ran dry","Fresh PTFE seals, less crankcase compression, fewer revs."],
  pipe_crack:["Expansion chamber","The chamber cracked at the header weld: the wave escaped through the crack and the tune went with it","Spring mounts instead of rigid brackets, richer jetting to cool it, a smoother layout."],
  plug_foul:["Spark plug & piston crown","Rich and oily: carbon built on the plug nose and the crown until the plug shorted out","Leaner low-speed jetting, less oil in the premix, a hotter plug \u2014 or direct injection."],
  scav_air:["Cylinder & ports","No scavenge air: the cylinder never cleared its exhaust, so the fresh charge had nowhere to go and it would not fire","A gear-driven Roots blower \u2014 a two-stroke diesel needs one, with or without a turbo."]
};
function tdDmg(id){ id=String(id||""); return TD_MAP[id] || (/rod/.test(id)?"rodsnap":/crank|tors/.test(id)?"crank":/valve/.test(id)?"valvebent":/turb/.test(id)?"turbine":/oil|bear/.test(id)?"bearing":/gask|head|cool|steam/.test(id)?"gasket":"ringland"); }

var _tdBox=null, _tdY=new THREE.Vector3(0,1,0);
function tdGeo(g){ TD.geos.push(g); return g; }
function tdMat(base, mode){
  var m=base.clone(); m.userData={}; TD.mats.push(m);
  if(m.emissive){ m.emissive.setHex(0x000000); m.emissiveIntensity=0; }
  if(mode==="dim"){ m.color.multiplyScalar(0.62); m.envMapIntensity=(base.envMapIntensity||1)*0.55; }
  if(mode==="hot"){ m.color.multiplyScalar(0.8); m.emissive=sc(0xff2200); m.emissiveIntensity=0.32; m.userData.tdBase=0.32; TD.glow.push(m); }
  return m;
}
function tdFlat(hex, o){ o=o||{}; var m=new THREE.MeshStandardMaterial({color:sc(hex), roughness:o.r===undefined?0.6:o.r, metalness:o.m===undefined?0.3:o.m, envMapIntensity:o.e===undefined?0.6:o.e, side:o.side||THREE.FrontSide, transparent:!!o.op, opacity:o.op||1});
  if(o.em){ m.emissive=sc(o.em); m.emissiveIntensity=o.ei||0.6; m.userData.tdBase=m.emissiveIntensity; TD.glow.push(m); }
  TD.mats.push(m); return m; }
function tdCrackMat(hex){ var m=new THREE.MeshBasicMaterial({color:sc(hex||0xffb43c), toneMapped:false}); m.userData.c0=m.color.clone(); TD.mats.push(m); TD.cracks.push(m); return m; }
function tdM(geo, mat, par, x,y,z, rx,ry,rz){ var m=new THREE.Mesh(tdGeo(geo), mat); m.position.set(x||0,y||0,z||0); if(rx||ry||rz) m.rotation.set(rx||0,ry||0,rz||0); m.castShadow=true; m.receiveShadow=true; par.add(m); return m; }
function tdBoxG(){ if(!_tdBox){ _tdBox=new THREE.BoxGeometry(1,1,1); _tdBox.__cached=true; } return _tdBox; }
/* a glowing crack: thin boxes along a polyline (points in par space) */
function tdCrack(par, pts, w, mat){
  for(var i=0;i<pts.length-1;i++){
    var a=pts[i], b=pts[i+1], d=new THREE.Vector3().subVectors(b,a), L=d.length(); if(L<1e-4) continue;
    var m=new THREE.Mesh(tdBoxG(), mat); m.scale.set(w, L+w*0.6, w*0.7);
    m.position.copy(a).addScaledVector(d,0.5); m.quaternion.setFromUnitVectors(_tdY, d.normalize()); par.add(m);
  }
}
/* jagged line on a cylinder surface (axis y): angles th (rad, 0 = +z) and heights y */
function tdZig(R, th0, y0, th1, y1, n, amp, seed){
  var pts=[], s=seed||1;
  for(var i=0;i<=n;i++){ var f=i/n, j=(i===0||i===n)?0:(((Math.sin(s*12.9898+i*78.233)*43758.5453)%1)-0.5)*amp;
    var th=th0+(th1-th0)*f+j/R, y=y0+(y1-y0)*f+j*0.6; pts.push(new THREE.Vector3(R*Math.sin(th), y, R*Math.cos(th))); }
  return pts;
}
/* flat jagged line in a plane y = const */
function tdZigFlat(x0,z0,x1,z1,y,n,amp,seed){
  var pts=[], s=seed||1, dx=x1-x0, dz=z1-z0, L=Math.hypot(dx,dz)||1, nx=-dz/L, nz=dx/L;
  for(var i=0;i<=n;i++){ var f=i/n, j=(i===0||i===n)?0:(((Math.sin(s*12.9898+i*78.233)*43758.5453)%1)-0.5)*amp;
    pts.push(new THREE.Vector3(x0+dx*f+nx*j, y, z0+dz*f+nz*j)); }
  return pts;
}
/* extrude a 2D shape along +y (shape x -> x, shape y -> -z) */
function tdExY(shape, h, cs){ var g=new THREE.ExtrudeGeometry(shape,{depth:h, bevelEnabled:false, curveSegments:cs||16}); g.rotateX(-PI/2); return g; }
/* extrude a 2D shape along +x (shape x -> -z, shape y -> y), centred on x = 0 */
function tdExX(shape, w, cs){ var g=new THREE.ExtrudeGeometry(shape,{depth:w, bevelEnabled:false, curveSegments:cs||16}); g.translate(0,0,-w/2); g.rotateY(PI/2); return g; }
function tdAnnulus(ro, ri, a0, a1){ var s=new THREE.Shape(); s.absarc(0,0,ro,a0,a1,false);
  if(a1-a0>=TAU-1e-3){ var h=new THREE.Path(); h.absarc(0,0,ri,0,TAU,true); s.holes.push(h); } else s.absarc(0,0,ri,a1,a0,true);
  return s; }

/* ---------- parts (B = displayed bore) ---------- */
function tdPiston(P, B, d, mats, lite){
  var G=new THREE.Group(), R=B/2, seg=lite?20:36, cH=0.40*B, pH=0.72*B, top=cH;
  var hot=(d==="ringland"||d==="holed"||d==="crowncrack"||d==="scuffed"||d==="valvebent"||d==="cold");
  var pm=hot?mats.pistonHot:mats.piston, dark=mats.dark, ringM=d==="ring"?mats.ringHot:mats.ring;
  var gh=0.042*B, g1=top-0.10*B, g2=top-0.17*B, g3=top-0.25*B, tl=top-g1-gh/2;
  /* crown + top land: one solid, with a bite out of it for a cracked ring land, a hole for a melted crown */
  var sh=new THREE.Shape();
  if(d==="ringland"){ /* shape angle a = theta - 90deg, theta the 3D angle from +z toward +x */
    var c=0.62, w=0.95, a0=c-w/2-PI/2, a1=c+w/2-PI/2, k; sh.absarc(0,0,R,a1,a0+TAU,false);
    for(k=1;k<6;k++){ var f=k/6, aa=a0+(a1-a0)*f, rr=R*(0.52+0.14*Math.sin(k*2.7)); sh.lineTo(rr*Math.cos(aa), rr*Math.sin(aa)); } sh.lineTo(R*Math.cos(a1),R*Math.sin(a1)); }
  else sh.absarc(0,0,R,0,TAU,false);
  if(d==="holed"){ var hp=new THREE.Path(), hx=0.18*R, hz=0.30*R, hr=0.36*R, n=lite?10:18; for(var i=0;i<=n;i++){ var a=-i/n*TAU, r=hr*(1+0.16*Math.sin(i*2.3)+0.08*Math.sin(i*5.1)); if(i===0) hp.moveTo(hx+r*Math.cos(a), -hz+r*Math.sin(a)); else hp.lineTo(hx+r*Math.cos(a), -hz+r*Math.sin(a)); } sh.holes.push(hp); }
  tdM(tdExY(sh, tl, seg), pm, G, 0, g1+gh/2, 0);
  /* lands, ring grooves, rings */
  var land=function(y0,y1){ tdM(new THREE.CylinderGeometry(R,R,y1-y0,seg,1,true), pm, G, 0,(y0+y1)/2,0); };
  land(g2+gh/2, g1-gh/2); land(g3+gh*0.7, g2-gh/2);
  [g1,g2,g3].forEach(function(gy,ix){ var h=ix===2?gh*1.4:gh;
    tdM(new THREE.CylinderGeometry(R*0.93,R*0.93,h,seg,1,true), dark, G, 0,gy,0);
    if(!(d==="ring"&&ix===0)) tdM(new THREE.CylinderGeometry(R*1.003,R*1.003,h*0.62,seg,1,true), ix===0&&d==="ringland"?mats.ring:mats.ring, G, 0,gy,0); });
  if(d==="ringland"){ /* the bitten-out ring land: a broken ring end and dark groove showing */
    tdCrack(G, tdZig(R*1.004, 0.62-0.95/2, g1, 0.62-0.95/2-0.1, g3-0.1*B, 5, 0.05*B, 3), 0.03*B, mats.crack);
    tdCrack(G, tdZig(R*1.004, 0.62+0.95/2, g1, 0.62+0.95, g3-0.2*B, 6, 0.07*B, 7), 0.03*B, mats.crack);
    var bp=[], a0b=0.62-0.95/2, a1b=0.62+0.95/2; for(var q=0;q<=6;q++){ var aq=a0b+(a1b-a0b)*q/6, rq=R*(0.52+0.14*Math.sin(q*2.7)); if(q===0||q===6) rq=R; bp.push(new THREE.Vector3(rq*Math.sin(aq), top+0.004, rq*Math.cos(aq))); }
    tdCrack(G, bp, 0.026*B, mats.crack);
    if(!lite) for(var p=0;p<26;p++){ var pa=0.62+(Math.sin(p*7.3))*1.2, pr=R*(0.55+0.4*Math.abs(Math.sin(p*3.1))); tdM(new THREE.CircleGeometry(0.018*B*(1+(p%3)*0.4),6), dark, G, pr*Math.sin(pa), top+0.003, pr*Math.cos(pa), -PI/2); }
  }
  if(d==="holed"){
    var hx2=0.18*R, hz2=0.30*R, hr2=0.36*R;
    tdM(new THREE.CircleGeometry(hr2*1.02, 20), mats.void, G, hx2, g1-0.02*B, hz2, -PI/2);
    tdM(new THREE.TorusGeometry(hr2*1.06, 0.035*B, 6, lite?14:28), mats.crackHot, G, hx2, top+0.004, hz2, PI/2);
    if(!lite) for(var mb=0;mb<9;mb++){ var ma=mb/9*TAU, mr=hr2*(1.35+0.2*Math.sin(mb*4.1)); var bl=tdM(new THREE.SphereGeometry(0.06*B,8,6), pm, G, hx2+mr*Math.cos(ma), top+0.01, hz2+mr*Math.sin(ma)); bl.scale.set(1.2,0.35,0.9); }
    /* the melt ran down the side: a gouge through the lands */
    tdCrack(G, tdZig(R*1.004, 0.55, top, 0.62, g3-0.06*B, 5, 0.04*B, 11), 0.05*B, mats.crackHot);
  }
  if(d==="crowncrack"){ tdCrack(G, tdZigFlat(-R*0.98,0.1*R, R*0.98,-0.15*R, top+0.006, lite?6:12, 0.18*R, 5), 0.03*B, mats.crack);
    tdCrack(G, tdZigFlat(-0.1*R,-0.05*R, 0.25*R,R*0.96, top+0.006, lite?4:8, 0.15*R, 9), 0.026*B, mats.crack);
    tdCrack(G, tdZig(R*1.004, PI/2+0.1, top, PI/2+0.15, g3, 4, 0.03*B, 2), 0.022*B, mats.crack); }
  if(d==="valvebent"){ [[-0.38,0.30],[0.36,0.32]].forEach(function(v){ tdM(new THREE.CircleGeometry(0.17*B,lite?12:20), mats.dent, G, v[0]*B, top+0.004, v[1]*B, -PI/2);
      tdM(new THREE.TorusGeometry(0.17*B, 0.012*B, 4, 20), mats.crack, G, v[0]*B, top+0.006, v[1]*B, PI/2); }); }
  if(d==="cold"){ tdM(new THREE.CircleGeometry(R*0.86, seg), mats.wet, G, 0, top+0.004, 0, -PI/2); }
  /* skirt (open bottom, hollow) and wrist pin */
  var skH=pH-(top-g3)-gh;
  var sk=tdM(new THREE.CylinderGeometry(R*0.995,R*0.995,skH,seg,1,true), d==="scuffed"?mats.pistonHot:mats.piston, G, 0, g3-gh*0.7-skH/2, 0);
  tdM(new THREE.CylinderGeometry(R*0.94,R*0.94,skH,seg,1,true), mats.darkIn, G, 0, g3-gh*0.7-skH/2, 0);
  tdM(new THREE.CylinderGeometry(0.115*B,0.115*B,2*R*1.01,lite?10:16), mats.pin, G, 0,0,0, 0,0,PI/2);
  if(d==="scuffed"||d==="ring"){ var n2=lite?6:14; for(var s2=0;s2<n2;s2++){ var sa=0.15+s2*(1.0/n2)*1.3, sy=g3-gh-0.04*B, sL=skH*(0.55+0.4*Math.abs(Math.sin(s2*2.1)));
      var st=new THREE.Mesh(tdBoxG(), s2%3===0?mats.crack:mats.smear); st.scale.set(0.016*B, sL, 0.01*B); st.position.set(R*1.002*Math.sin(sa), sy-sL/2, R*1.002*Math.cos(sa)); st.rotation.y=sa; G.add(st);
      if(d==="ring") st.scale.y*=0.25, st.position.y=top-0.06*B; } }
  if(d==="ring"){ /* the broken top ring lifted off: two pieces, butted ends glowing */
    var rg=new THREE.Group(); rg.position.set(0, top+0.30*B, 0); G.add(rg);
    tdM(new THREE.TorusGeometry(R*1.0, 0.03*B, 6, lite?24:48, TAU*0.62), ringM, rg, 0,0,0, PI/2,0,0.5);
    var p2=tdM(new THREE.TorusGeometry(R*1.0, 0.03*B, 6, lite?16:32, TAU*0.34), ringM, rg, 0.06*B,0.10*B,0.05*B, PI/2+0.25,0,0.5+TAU*0.64);
    [0.5, 0.5+TAU*0.62].forEach(function(a){ tdM(new THREE.SphereGeometry(0.05*B,8,6), mats.crackHot, rg, R*Math.cos(a), 0, -R*Math.sin(a)); });
  }
  return G;
}
function tdRod(L, B, d, mats, lite){
  var G=new THREE.Group(), rs=0.20*B, rsi=0.12*B, rb=0.40*B, rp=0.29*B, tx=0.20*B, cs=lite?12:20;
  var hotBeam=(d==="rodsnap"||d==="rodbent"), hotEnd=(d==="rodbolt");
  var rm=mats.rod, rmh=mats.rodHot;
  tdM(tdExX(tdAnnulus(rs, rsi, 0, TAU), tx*0.9, cs), hotBeam&&d==="rodsnap"?rmh:rm, G, 0,0,0);
  var b0=-rs*0.8, b1=-L+rb*0.85, bl=b0-b1;
  if(d==="rodbent"){ var cv=new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,b0,0), new THREE.Vector3(0,(b0+b1)/2,0.42*B), new THREE.Vector3(0,b1,0));
    tdM(new THREE.TubeGeometry(cv, lite?10:20, 0.075*B, lite?6:10, false), rmh, G, 0,0,0);
    tdCrack(G, [cv.getPoint(0.38), cv.getPoint(0.5), cv.getPoint(0.62)].map(function(p){ return p.add(new THREE.Vector3(0,0,0.08*B)); }), 0.035*B, mats.crack);
  } else if(d==="rodsnap"){
    var cut=b0-bl*0.42;
    tdM(new THREE.BoxGeometry(0.12*B, b0-cut, 0.20*B), rmh, G, 0,(b0+cut)/2,0);
    tdCrack(G, [new THREE.Vector3(0,cut-0.01,-0.11*B), new THREE.Vector3(0.02,cut+0.02,-0.03*B), new THREE.Vector3(-0.02,cut-0.03,0.04*B), new THREE.Vector3(0,cut+0.01,0.11*B)], 0.05*B, mats.crackHot);
    var low=new THREE.Group(); low.position.set(0.05*B, -0.35*B, 0.42*B); low.rotation.set(0.55,0.15,0.1); G.add(low);
    tdM(new THREE.BoxGeometry(0.12*B, cut-b1-0.06*B, 0.20*B), rmh, low, 0,(cut-0.06*B+b1)/2,0);
    tdCrack(low, [new THREE.Vector3(0,cut-0.06*B,-0.11*B), new THREE.Vector3(-0.02,cut-0.03*B,-0.02*B), new THREE.Vector3(0.02,cut-0.08*B,0.05*B), new THREE.Vector3(0,cut-0.05*B,0.11*B)], 0.05*B, mats.crackHot);
    tdRodEnd(low, L, B, d, mats, lite);
    return G;
  } else {
    tdM(new THREE.BoxGeometry(0.075*B, bl, 0.20*B), rm, G, 0,(b0+b1)/2,0);
    if(!lite){ tdM(new THREE.BoxGeometry(0.15*B, bl, 0.045*B), rm, G, 0,(b0+b1)/2, 0.085*B); tdM(new THREE.BoxGeometry(0.15*B, bl, 0.045*B), rm, G, 0,(b0+b1)/2,-0.085*B); }
  }
  tdRodEnd(G, L, B, d, mats, lite);
  return G;
}
function tdRodEnd(G, L, B, d, mats, lite){
  var rb=0.40*B, rp=0.29*B, tx=0.24*B, cs=lite?14:24, rm=(d==="rodbolt")?mats.rodHot:mats.rod;
  var E=new THREE.Group(); E.position.y=-L; G.add(E);
  tdM(tdExX(tdAnnulus(rb, rp, 0, PI), tx, cs), d==="rodsnap"?mats.rodHot:mats.rod, E, 0,0,0);
  var bz=rp+(rb-rp)*0.5;
  tdM(new THREE.BoxGeometry(tx, 0.12*B, 2*rb+0.06*B), d==="rodsnap"?mats.rodHot:mats.rod, E, 0,-0.04*B,0);
  var cap=new THREE.Group(); E.add(cap);
  if(d==="rodbolt"){ cap.position.set(0.04*B,-0.55*B,0.22*B); cap.rotation.set(0.45,0.2,0); }
  tdM(tdExX(tdAnnulus(rb, rp, PI, TAU), tx, cs), rm, cap, 0,-0.0,0);
  tdM(new THREE.BoxGeometry(tx, 0.10*B, 2*rb+0.06*B), rm, cap, 0,-0.05*B,0);
  /* shells */
  var spun=(d==="bearing"||d==="starve");
  tdM(tdExX(tdAnnulus(rp, rp-0.035*B, 0, PI), tx*0.98, cs), mats.shell, E, 0,0,0);
  if(!spun) tdM(tdExX(tdAnnulus(rp, rp-0.035*B, PI, TAU), tx*0.98, cs), mats.shell, cap, 0,0,0);
  /* bolts */
  [-1,1].forEach(function(sg,ix){ var z=-sg*bz;
    if(d==="rodbolt"&&ix===0){ tdM(new THREE.CylinderGeometry(0.045*B,0.045*B,0.14*B,8), mats.boltHot, E, 0,-0.1*B,z);
      tdM(new THREE.SphereGeometry(0.06*B,8,6), mats.crackHot, E, 0,-0.17*B,z);
      tdM(new THREE.CylinderGeometry(0.045*B,0.045*B,0.16*B,8), mats.boltHot, cap, 0,-0.05*B,z);
      tdM(new THREE.SphereGeometry(0.06*B,8,6), mats.crackHot, cap, 0,0.03*B,z); }
    else if(d==="rodbolt"){ tdM(new THREE.CylinderGeometry(0.03*B,0.045*B,0.55*B,8), mats.boltHot, E, 0,-0.22*B,z); }
    else tdM(new THREE.CylinderGeometry(0.045*B,0.045*B,0.40*B,8), mats.bolt, cap, 0,-0.02*B,z);
  });
  return E;
}
function tdCrank(B, cr, d, mats, lite){
  var G=new THREE.Group(), rj=0.30*B, rpn=0.27*B, tw=0.17*B, wx=0.33*B, cs=lite?16:28, Rcw=cr+0.30*B;
  var broken=(d==="crank"), spun=(d==="bearing"||d==="starve");
  var cm=broken?mats.crankHot:mats.crank;
  var left=new THREE.Group(), right=new THREE.Group(); G.add(left); G.add(right);
  if(broken){ right.position.set(0.28*B, -0.12*B, 0.10*B); right.rotation.set(0.32, 0.06, -0.05); }
  function web(par, x){
    var lobe=new THREE.Shape(); lobe.moveTo(-0.40*B,0); lobe.lineTo(-0.36*B,cr); lobe.absarc(0,cr,0.36*B,PI,0,true); lobe.lineTo(0.40*B,0); lobe.lineTo(-0.40*B,0);
    var cw=new THREE.Shape(); cw.moveTo(0,0.08*B); cw.absarc(0,0,Rcw,PI+0.25,TAU-0.25,false); cw.lineTo(0,0.08*B);
    tdM(tdExX(lobe, tw, cs), cm, par, x,0,0); tdM(tdExX(cw, tw*0.97, cs), cm, par, x,0,0);
    tdM(new THREE.CylinderGeometry(0.43*B,0.43*B,tw*0.985,cs), cm, par, x,0,0, 0,0,PI/2);
  }
  web(left, -wx); web(right, wx);
  var pinL=2*wx-tw;
  if(broken){ tdM(new THREE.CylinderGeometry(rpn,rpn,pinL*0.62,cs), mats.journalHot, left, -wx+tw/2+pinL*0.31, cr, 0, 0,0,PI/2);
    tdM(new THREE.CylinderGeometry(rpn,rpn,pinL*0.38,cs), mats.journalHot, right, wx-tw/2-pinL*0.19, cr, 0, 0,0,PI/2);
    tdM(new THREE.CircleGeometry(rpn*1.01, cs), mats.crackHot, left, -wx+tw/2+pinL*0.62+0.003, cr, 0, 0,PI/2,0);
    tdM(new THREE.CircleGeometry(rpn*1.01, cs), mats.crackHot, right, wx-tw/2-pinL*0.38-0.003, cr, 0, 0,-PI/2,0);
    tdCrack(left, tdZig(0.435*B, 0.3, -0.3*B, 2.6, 0.2*B, 6, 0.05*B, 4).map(function(p){ return new THREE.Vector3(-wx+tw/2+0.002, p.y+cr*0.4, p.z); }), 0.03*B, mats.crack);
  } else tdM(new THREE.CylinderGeometry(rpn,rpn,pinL,cs), spun?mats.journalHot:mats.journal, left, 0, cr, 0, 0,0,PI/2);
  if(spun&&!lite) for(var k=0;k<5;k++) tdM(new THREE.TorusGeometry(rpn*1.003, 0.006*B, 4, cs), mats.score, left, -pinL*0.35+k*pinL*0.17, cr, 0, 0,PI/2,0);
  var jl=0.55*B;
  tdM(new THREE.CylinderGeometry(rj,rj,jl,cs), mats.journal, left, -wx-tw/2-jl/2, 0,0, 0,0,PI/2);
  tdM(new THREE.CylinderGeometry(rj,rj,jl,cs), mats.journal, right, wx+tw/2+jl/2, 0,0, 0,0,PI/2);
  /* main bearing shells, exploded off the journals */
  [-1,1].forEach(function(sg){ var x=sg*(wx+tw/2+jl/2), par=sg<0?left:right;
    tdM(tdExX(tdAnnulus(rj+0.04*B, rj, 0, PI), jl*0.8, cs), mats.shellDim, par, x, 0.32*B, 0);
    tdM(tdExX(tdAnnulus(rj+0.04*B, rj, PI, TAU), jl*0.8, cs), mats.shellDim, par, x,-0.32*B, 0); });
  if(spun){ /* the spun rod shell: torn out, scored to the copper, blued */
    var S=new THREE.Group(); S.position.set(0, cr+0.05*B, 0.62*B); S.rotation.set(0.6, 0.35, 0.2); left.add(S);
    tdM(tdExX(tdAnnulus(rpn+0.05*B, rpn+0.012*B, 0.25, PI+0.7), pinL*0.95, cs), mats.shellHot, S, 0,0,0);
    var nS=lite?4:9; for(var q=0;q<nS;q++){ var a=0.4+q*(PI/ nS); var sc2=new THREE.Mesh(tdBoxG(), q%2?mats.crack:mats.score); sc2.scale.set(pinL*0.9, 0.012*B, 0.01*B); sc2.position.set(0, (rpn+0.01*B)*Math.sin(a), -(rpn+0.01*B)*Math.cos(a)); S.add(sc2); }
  }
  return G;
}
function tdValve(B, kind, mats, lite){
  var G=new THREE.Group(), rh=0.19*B, sl=0.95*B, cs=lite?14:24;
  var hot=(kind==="bent"||kind==="burn"), vm=hot?mats.valveHot:mats.valve;
  var head=new THREE.Group(); G.add(head);
  if(kind==="burn"){ var shp=new THREE.Shape(); shp.moveTo(0,0); shp.absarc(0,0,rh,0.9,TAU-0.1,false); var n=5; for(var i=1;i<n;i++){ var a=-0.1+i/n*1.0, r=rh*(0.45+0.18*Math.sin(i*2.9)); shp.lineTo(r*Math.cos(a), r*Math.sin(a)); } shp.lineTo(0,0);
    tdM(tdExY(shp, 0.035*B, cs), mats.valveBurnt, head, 0,0,0);
    var cp=[]; for(i=0;i<=n;i++){ var a2=-0.1+i/n*1.0, r2=i===0||i===n?rh:rh*(0.45+0.18*Math.sin(i*2.9)); cp.push(new THREE.Vector3(r2*Math.cos(a2), 0.04*B, -r2*Math.sin(a2))); }
    tdCrack(head, cp, 0.03*B, mats.crackHot);
  } else tdM(new THREE.CylinderGeometry(rh,rh,0.035*B,cs), vm, head, 0,0.0175*B,0);
  tdM(new THREE.CylinderGeometry(0.045*B, rh*0.95, 0.10*B, cs), kind==="burn"?mats.valveBurnt:vm, head, 0,0.085*B,0);
  if(kind==="bent"){ var k1=0.30*sl;
    tdM(new THREE.CylinderGeometry(0.035*B,0.035*B,k1,8), vm, head, 0,0.13*B+k1/2,0);
    head.rotation.z=0.42; head.position.set(-0.2*B, 0, 0);
    tdM(new THREE.CylinderGeometry(0.035*B,0.035*B,sl-k1,8), vm, G, 0,0.13*B+k1+(sl-k1)/2,0);
    tdM(new THREE.SphereGeometry(0.05*B,8,6), mats.crackHot, G, 0,0.13*B+k1,0);
  } else tdM(new THREE.CylinderGeometry(0.035*B,0.035*B,sl,8), vm, G, 0,0.13*B+sl/2,0);
  tdM(new THREE.CylinderGeometry(0.11*B,0.11*B,0.04*B,12), mats.steelDim, G, 0,0.13*B+sl*0.88,0);
  return G;
}
function tdTurboG(B, d, mats, lite){
  var G=new THREE.Group(), cs=lite?16:28, nb=lite?9:12;
  /* bearing housing along x, turbine (hot side) at -x, compressor at +x */
  tdM(new THREE.CylinderGeometry(0.26*B,0.26*B,0.55*B,cs), mats.iron, G, 0,0,0, 0,0,PI/2);
  tdM(new THREE.CylinderGeometry(0.05*B,0.05*B,1.9*B,8), mats.journal, G, 0,0,0, 0,0,PI/2);
  function wheel(x, rr, hot, comp, missing){
    var W=new THREE.Group(); W.position.x=x; G.add(W);
    var m=hot?(comp?mats.compHot:mats.turbHot):(comp?mats.alu:mats.turbDim), bentTips=comp&&hot;
    tdM(new THREE.CylinderGeometry(0.10*B, 0.22*B, 0.30*B, cs), m, W, 0,0,0, 0,0,(x<0?1:-1)*PI/2);
    for(var i=0;i<nb;i++){ var a=i/nb*TAU, len=rr*(missing&&missing.indexOf(i)>=0?0.45:1);
      var bl=new THREE.Mesh(tdGeo(new THREE.BoxGeometry(0.26*B, len, 0.022*B)), m); bl.castShadow=true;
      bl.position.set(0, Math.cos(a)*(0.10*B+len/2), Math.sin(a)*(0.10*B+len/2)); bl.rotation.set(a, 0, 0); bl.rotateY(0.35);
      if(bentTips&&i%3===0){ bl.rotateZ(0.5); }
      W.add(bl);
      if(missing&&missing.indexOf(i)>=0){ var cap=new THREE.Mesh(tdBoxG(), mats.crackHot); cap.scale.set(0.28*B, 0.03*B, 0.04*B); cap.position.set(0, Math.cos(a)*(0.10*B+len), Math.sin(a)*(0.10*B+len)); cap.rotation.set(a,0,0); W.add(cap); }
    }
    return W;
  }
  var tw=wheel(-0.62*B, 0.30*B, d==="turbine", false, d==="turbine"?[1,4,8]:null);
  if(d==="turbine") tdCrack(tw, [new THREE.Vector3(-0.15*B,0,0.04*B), new THREE.Vector3(-0.14*B,0.12*B,0.06*B), new THREE.Vector3(-0.15*B,0.22*B,0.02*B), new THREE.Vector3(-0.14*B,0.36*B,0.05*B)], 0.03*B, mats.crackHot);
  wheel(0.62*B, 0.34*B, d==="compressor", true, null);
  /* housings, pulled back off the wheels and cut open */
  var hm=d==="turbine"?mats.ironDim:mats.ironDim;
  tdM(new THREE.TorusGeometry(0.52*B, 0.18*B, lite?8:12, cs, PI*1.3), mats.castexh, G, -1.15*B, 0, 0, 0, PI/2, 0);
  tdM(new THREE.TorusGeometry(0.56*B, 0.17*B, lite?8:12, cs, PI*1.3), mats.aluDim, G, 1.18*B, 0, 0, 0, PI/2, 0);
  return G;
}

function tdBuild(info){
  var lite=GFX==="lite", d=tdDmg(info.failId), Lo=info.layout||{banks:1, angle:0, n:4};
  var B=1.6, R=B/2, bs=Math.max(40, +info.bore||86), st=Math.max(30, +info.stroke||86);
  var S=clamp(B*st/bs, 0.6*B, 1.5*B), cr=S/2, L=clamp(+info.rodRatio||1.7, 1.4, 2.2)*S, cH=0.40*B, pH=0.72*B;
  var Dk=cr+L+cH, wall=info.diesel?0.30*B:0.24*B, W=B+2*wall, D=B+2*wall, pitch=B+0.22*B+(info.diesel?0.06*B:0);
  var alu=/alu/.test(info.blockMat||""), headAlu=!/iron/.test(info.headMat||"alu");
  var two=(Lo.banks||1)===1 && (info.cyl||Lo.n||4)>=2;
  var hotSet={ piston:/ringland|holed|crowncrack|scuffed|valvebent|cold/.test(d) };
  var M={};
  function pick(base, hot){ return tdMat(base, hot?"hot":"dim"); }
  M.piston=pick(MAT.palu,false); M.pistonHot=pick(MAT.palu,true); M.dark=tdFlat(0x16171a,{r:0.8,m:0.2}); M.darkIn=tdFlat(0x2a2b2e,{r:0.8,m:0.2,side:THREE.BackSide});
  M.ring=pick(MAT.steel,false); M.ringHot=pick(MAT.steel,true); M.pin=pick(MAT.chrome||MAT.steel,false);
  M.rod=pick(MAT.steel,false); M.rodHot=pick(MAT.steel,true); M.bolt=pick(MAT.steel,false); M.boltHot=pick(MAT.steel,true);
  M.crank=pick(MAT.steel,false); M.crankHot=pick(MAT.steel,true); M.journal=pick(MAT.chrome||MAT.steel,false); M.journalHot=pick(MAT.chrome||MAT.steel,true);
  M.shell=tdFlat(0x8a8478,{r:0.35,m:0.8}); M.shellDim=tdFlat(0x5c5850,{r:0.4,m:0.8}); M.shellHot=tdFlat(0xb4652e,{r:0.45,m:0.85,em:0xff2a12,ei:0.5});
  M.valve=pick(MAT.steel,false); M.valveHot=pick(MAT.steel,true); M.valveBurnt=tdFlat(0x5a3626,{r:0.7,m:0.6,em:0xff3a10,ei:0.5}); M.steelDim=pick(MAT.steel,false);
  M.iron=pick(MAT.iron,false); M.ironDim=pick(MAT.iron,false); M.alu=pick(MAT.calu,false); M.aluDim=pick(MAT.calu,false);
  M.turbDim=pick(MAT.turbine,false); M.turbHot=tdFlat(0x8a4a2a,{r:0.5,m:0.8,em:0xff4a10,ei:0.7}); M.compHot=pick(MAT.palu,true); M.castexh=pick(MAT.castexh, d==="manifold");
  M.crack=tdCrackMat(0xffa630); M.crackHot=tdCrackMat(0xff5a1e); M.void=tdFlat(0x050505,{r:1,m:0,e:0,side:THREE.DoubleSide});
  M.smear=tdFlat(0xd9d9d4,{r:0.25,m:0.9}); M.score=tdFlat(0x1a1410,{r:0.9,m:0.2}); M.dent=tdFlat(0x2a2622,{r:0.7,m:0.4});
  M.wet=tdFlat(0x1c2a3a,{r:0.06,m:0.2,e:1.6,op:0.72}); M.soot=tdFlat(0x0e0c0a,{r:1,m:0,e:0.1});
  var blockHot=/boredist|wall|scuffed/.test(d), headHot=/headlift|warp/.test(d);
  M.block=pick(alu?MAT.calu:MAT.iron, false); M.blockHot=pick(alu?MAT.calu:MAT.iron, true);
  M.head=pick(headAlu?MAT.calu:MAT.iron, headHot); M.cover=pick(MAT.wrinkle||MAT.dark, false); M.gasket=pick(MAT.steel, /gasket|headlift|warp/.test(d));
  M.stud=pick(MAT.steel, d==="headlift"); M.plenum=pick(MAT.calu, d==="backfire"); M.pan=pick(MAT.steel,false); M.pickup=tdFlat(0x7a7268,{r:0.5,m:0.7,em:d==="starve"?0xff2a12:undefined,ei:0.55});
  M.inj=pick(MAT.steel, d==="cold");
  M.liner=tdFlat(alu?0x8e8e8b:0x6a6865,{r:0.35,m:0.7,side:THREE.BackSide}); M.linerHot=tdFlat(alu?0x8e8e8b:0x6a6865,{r:0.35,m:0.7,side:THREE.BackSide,em:0xff2a12,ei:0.4});

  var root=new THREE.Group(); root.name="teardown";
  var focus=null, view={th:0.80, ph:1.12, k:1};
  /* banks: the failed one is first and leans toward the camera */
  var ang=Lo.angle||0, banks;
  if((Lo.banks||1)===1) banks=[{a:0, fail:true}];
  else if(ang>=170) banks=[{a:0, fail:true},{a:-PI/2, stub:true}];   /* boxer: the far bank lies flat behind, as a stub */
  else banks=[{a:0, fail:true},{a:-deg(ang), seated:true}];   /* vee: the failed bank stands upright, its partner at the real included angle */
  var lift=/headlift|gasket|warp/.test(d)?1.45*B:/valve/.test(d)?1.55*B:/cold|backfire/.test(d)?1.25*B:0.95*B, Hh=0.78*B;
  banks.forEach(function(bk){
    var F=new THREE.Group(); F.rotation.x=bk.a; root.add(F);
    var bores=bk.fail&&two?[0,-pitch]:[0], len=S+pH+0.18*B, y0=Dk-len;
    /* block barrel, cut open along the bore axis so the wall shows */
    var x0=Math.min.apply(null,bores)-W/2, x1=W/2;
    var cutDir=new THREE.Vector3(0,-Math.sin(bk.a),Math.cos(bk.a)), sgn=cutDir.dot(new THREE.Vector3(0,0.55,0.84))>=0?1:-1;
    var sh=new THREE.Shape(), zc=0, zb=-sgn*D/2;
    /* shape space: x -> x, y -> -z ; keep the half of the barrel away from the viewer */
    var ky=function(z){ return -z; };
    sh.moveTo(x0, ky(zb)); sh.lineTo(x1, ky(zb)); sh.lineTo(x1, ky(zc));
    bores.slice().sort(function(a,b){return b-a;}).forEach(function(bx){ sh.lineTo(bx+R, ky(zc));
      var n=lite?12:24; for(var i=1;i<n;i++){ var a=i/n*PI; sh.lineTo(bx+R*Math.cos(a), ky(zc - sgn*R*Math.sin(a))); } sh.lineTo(bx-R, ky(zc)); });
    sh.lineTo(x0, ky(zc)); sh.lineTo(x0, ky(zb));
    var bm=blockHot&&bk.fail?M.blockHot:M.block;
    var barrel=tdM(tdExY(sh, len, lite?12:24), bm, F, 0, y0, 0);
    if(bk.stub) return;
    /* the bore wall that faces the viewer: liner sheen + damage */
    bores.forEach(function(bx, bi){
      var ln=tdM(new THREE.CylinderGeometry(R*0.998,R*0.998,len*0.995,lite?14:28,1,true, sgn>0?PI/2:-PI/2, PI), (bk.fail&&bi===0&&blockHot)?M.linerHot:M.liner, F, bx, y0+len/2, 0);
      if(bk.fail&&bi===0&&(d==="boredist"||d==="scuffed")){ var n=lite?5:11; for(var s=0;s<n;s++){ var th=(sgn>0?PI:0)+(-0.9+1.8*s/(n-1)), x=bx+R*0.985*Math.sin(th), z=R*0.985*Math.cos(th); var sl=len*(0.45+0.35*Math.abs(Math.sin(s*1.7)));
          var st=new THREE.Mesh(tdBoxG(), s%2?M.crack:M.score); st.scale.set(0.022*B, sl, 0.022*B); st.position.set(x, Dk-0.12*B-sl/2, z); F.add(st); }
        if(d==="boredist"){ var ov=tdM(new THREE.TorusGeometry(R*1.0, 0.02*B, 4, 40), M.crackHot, F, bx, Dk+0.004, 0, PI/2); ov.scale.set(1.08,0.9,1); }
        focus=focus||ln; }
      if(bk.fail&&bi===0&&d==="wall"&&two){ var xm=-pitch/2;
        tdCrack(F, tdZigFlat(xm, -sgn*0.05, xm, -sgn*(D/2), Dk+0.006, lite?4:8, 0.08*B, 3), 0.035*B, M.crackHot);
        var wp=[], nw=lite?5:10; for(var q=0;q<=nw;q++) wp.push(new THREE.Vector3(xm+(q%2?0.035:-0.035)*B*(q===0||q===nw?0:1), Dk-len*0.7*q/nw, sgn*0.012));
        tdCrack(F, wp, 0.04*B, M.crackHot);
        var wf=new THREE.Group(); wf.position.set(xm, Dk-len/2, -sgn*0.08*B); F.add(wf); focus=wf; }
      if(bk.fail&&bi===0&&d==="wall"&&!two){ tdCrack(F, tdZig(R*0.985, PI+sgn*0.2, Dk, PI+sgn*0.35, Dk-len*0.75, lite?5:10, 0.08*B, 6).map(function(p){ return new THREE.Vector3(p.x, p.y, sgn>0?p.z:-p.z); }), 0.04*B, M.crackHot); focus=ln; }
      /* the neighbour's piston, still in its bore */
      if(bk.fail&&bi===1&&!lite){ var np=tdPiston(null, B, "none", M, true); np.position.set(bx, Dk-cH-0.04*B, 0); F.add(np); }
      /* head studs */
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(c){ var sx=bx+c[0]*(R+wall*0.5), sz=c[1]*(D/2-wall*0.5); if(sgn*sz>0) return;
        var sL=d==="headlift"&&bk.fail?lift*0.92:0.55*B;
        tdM(new THREE.CylinderGeometry(0.045*B, 0.045*B, sL, 8), M.stud, F, sx, Dk+sL/2, sz); });
    });
    if(bk.seated){ tdM(new THREE.BoxGeometry(W, Hh, D), M.head, F, 0, Dk+Hh/2+0.03*B, 0); tdM(new THREE.BoxGeometry(W*0.9, 0.32*B, D*0.75), M.cover, F, 0, Dk+Hh+0.19*B, 0); return; }
    /* gasket, lifted half-way */
    var gy=Dk+lift*0.42, gs=new THREE.Shape(), gxa=x0, gxb=x1;
    gs.moveTo(gxa,-D/2); gs.lineTo(gxb,-D/2); gs.lineTo(gxb,D/2); gs.lineTo(gxa,D/2); gs.lineTo(gxa,-D/2);
    bores.forEach(function(bx){ var h=new THREE.Path(); h.absarc(bx,0,R*1.03,0,TAU,true); gs.holes.push(h); });
    var gk=tdM(tdExY(gs, 0.035*B, lite?16:32), M.gasket, F, 0, gy, 0);
    bores.forEach(function(bx){ tdM(new THREE.TorusGeometry(R*1.06, 0.03*B, 4, lite?18:36), M.ring, F, bx, gy+0.035*B, 0, PI/2); });
    if(/gasket|headlift|warp/.test(d)){
      var gz=sgn*(D/2), gyy=gy+0.04*B;
      if(two&&d!=="warp"){ tdCrack(F, tdZigFlat(-R*1.0, 0, -pitch+R*1.0, 0.0, gyy+0.003, 4, 0.04*B, 2), 0.05*B, M.crackHot);
        var so=tdM(new THREE.PlaneGeometry(pitch-2*R*1.03+0.1*B, 0.32*B), M.soot, F, -pitch/2, gyy+0.002, 0, -PI/2); }
      tdCrack(F, tdZigFlat(R*1.06*Math.sin(0.55), sgn*R*1.06*Math.cos(0.55), R*0.75, gz*0.98, gyy+0.004, 4, 0.06*B, 7), 0.05*B, M.crackHot);
      tdM(new THREE.PlaneGeometry(0.30*B, (D/2-R*0.9)), M.soot, F, R*0.65, gyy+0.002, sgn*(R*0.9+D/2)/2, -PI/2);
      if(d==="warp") tdM(new THREE.TorusGeometry(R*1.12, 0.02*B, 4, 36), tdFlat(0xe8e0c8,{r:0.9,m:0}), F, 0, gyy+0.004, 0, PI/2);
      if(d==="gasket") focus=gk;
    }
    /* head, lifted (tilted when the studs let go, bowed when it warped) */
    var Hd=new THREE.Group(); Hd.position.set(0, Dk+lift, 0); F.add(Hd);
    if(d==="headlift"){ Hd.rotation.x=sgn*0.10; Hd.rotation.z=0.05; }
    var hx=(x0+x1)/2, hw=x1-x0;
    if(d==="warp"){ var nW=5; for(var w=0;w<nW;w++){ var f=(w+0.5)/nW-0.5, sw=hw/nW; var hb=tdM(new THREE.BoxGeometry(sw*1.02, Hh, D), M.head, Hd, hx+f*hw, Hh/2+0.14*B*(1-4*f*f), 0); hb.rotation.z=-f*0.18; } }
    else tdM(new THREE.BoxGeometry(hw, Hh, D), M.head, Hd, hx, Hh/2, 0);
    tdM(new THREE.BoxGeometry(hw*0.92, 0.34*B, D*0.78), M.cover, Hd, hx, Hh+0.17*B+(d==="warp"?0.14*B:0), 0);
    /* chambers on the underside, valves, plug / injector */
    bores.forEach(function(bx, bi){
      tdM(new THREE.CircleGeometry(R*0.92, lite?16:28), M.dark, Hd, bx, -0.004, 0, PI/2);
      var vk=(bk.fail&&bi===0)?(d==="valvebent"?"bent":d==="valveburn"?"burn":null):null;
      [[-0.26,"in"],[0.26,"ex"]].forEach(function(v, vi){ var isF=vk&&vi===1;
        var vv=tdValve(B, isF?vk:"ok", M, lite); vv.position.set(bx+v[0]*B, -(isF?0.62*B:0.20*B), sgn*0.04*B); Hd.add(vv);
        if(isF) focus=vv; });
      var pl=tdM(new THREE.CylinderGeometry(0.06*B,0.06*B,0.42*B,10), info.diesel?M.inj:M.steelDim, Hd, bx, Hh+0.34*B+0.21*B, 0);
      if(info.diesel&&bk.fail&&bi===0&&d==="cold"){
        tdM(new THREE.CylinderGeometry(0.035*B,0.035*B,Hh*1.2,8), M.inj, Hd, bx, Hh*0.4, 0);
        var spray=tdM(new THREE.ConeGeometry(0.42*B, 0.75*B, 16, 1, true), tdFlat(0xd9c98a,{r:0.3,m:0,op:0.45,side:THREE.DoubleSide,em:0x8a7a40,ei:0.4}), Hd, bx, -0.38*B, 0);
        tdM(new THREE.CylinderGeometry(0.03*B,0.03*B,0.5*B,8), M.inj, Hd, bx+0.32*B, -0.05*B, sgn*0.2*B, 0,0,0.5);
        focus=spray; }
    });
    if(d==="headlift"||d==="warp") focus=Hd;
    /* exhaust manifold off the viewer's side of the head */
    if(d==="manifold"){ var MF=new THREE.Group(); MF.position.set(hx, Dk+lift+Hh*0.45, sgn*(D/2+0.75*B)); F.add(MF);
      bores.forEach(function(bx){ tdM(new THREE.CylinderGeometry(0.15*B,0.15*B,0.55*B,12), M.castexh, MF, bx-hx, 0.05*B, -sgn*0.2*B, PI/2,0,0); });
      tdM(new THREE.CylinderGeometry(0.24*B,0.24*B,hw*0.95,lite?14:24), M.castexh, MF, 0,-0.12*B,0.05*B*sgn, 0,0,PI/2);
      tdCrack(MF, tdZig(0.245*B, -0.1, -0.2*B, 2.2, 0.2*B, lite?5:9, 0.03*B, 4).map(function(p){ return new THREE.Vector3(p.y*0.6, -0.12*B+p.x, 0.05*B*sgn+p.z); }), 0.035*B, M.crackHot);
      focus=MF; }
    /* split intake plenum above the head */
    if(d==="backfire"){ var PL=new THREE.Group(); PL.position.set(hx, Dk+lift+Hh+0.95*B, 0); F.add(PL);
      tdM(new THREE.BoxGeometry(hw*0.9, 0.42*B, 0.55*B), M.plenum, PL, 0,0,-0.30*B);
      var pb=tdM(new THREE.BoxGeometry(hw*0.9, 0.42*B, 0.55*B), M.plenum, PL, 0.05*B,0.18*B,0.42*B, 0.45,0,0.04);
      tdCrack(PL, tdZigFlat(-hw*0.45, -0.02*B, hw*0.45, -0.02*B, 0.215*B, lite?6:12, 0.08*B, 8), 0.04*B, M.crackHot);
      tdM(new THREE.PlaneGeometry(hw*0.8, 0.30*B), M.soot, PL, 0, 0.212*B, -0.2*B, -PI/2);
      focus=PL; }
  });
  /* the failed cylinder's piston and rod, pulled out and stood beside the block */
  var Xp=W/2+0.62*B+R, PR=new THREE.Group(); PR.position.set(Xp, Dk-cH+0.25*B, 0.15*B); root.add(PR);
  var pis=tdPiston(null, B, d, M, lite); PR.add(pis);
  var rod=tdRod(L, B, d, M, lite); PR.add(rod);
  if(/ringland|holed|crowncrack|scuffed|ring|valvebent/.test(d)) focus=focus&&d==="valvebent"?focus:pis;
  if(d==="cold"&&!info.diesel) focus=pis;
  if(/rodsnap|rodbent|rodbolt/.test(d)) focus=rod;
  /* crank throw, dropped out of the block */
  var CK=tdCrank(B, cr, d, M, lite); CK.position.y=-0.55*B; root.add(CK);
  if(/crank|bearing|starve/.test(d)) focus=CK;
  /* sump + pickup when it starved */
  if(d==="starve"){ var SP=new THREE.Group(); SP.position.y=-0.55*B-(cr+0.30*B)-1.0*B; root.add(SP);
    var pw=2.6*B, pd=W*1.05, ph=0.55*B;
    tdM(new THREE.BoxGeometry(pw, 0.03*B, pd), M.pan, SP, 0,-ph,0);
    tdM(new THREE.BoxGeometry(pw, ph, 0.03*B), M.pan, SP, 0,-ph/2,-pd/2);
    tdM(new THREE.BoxGeometry(0.03*B, ph, pd), M.pan, SP, -pw/2,-ph/2,0);
    tdM(new THREE.BoxGeometry(0.03*B, ph, pd), M.pan, SP, pw/2,-ph/2,0);
    var cvp=new THREE.CatmullRomCurve3([new THREE.Vector3(-0.9*B, 1.1*B, 0), new THREE.Vector3(-0.9*B, 0.3*B, 0), new THREE.Vector3(-0.5*B, -0.25*B, 0.15*B), new THREE.Vector3(0.1*B,-ph+0.12*B,0.2*B)]);
    tdM(new THREE.TubeGeometry(cvp, lite?12:24, 0.07*B, 8, false), M.pickup, SP, 0,0,0);
    tdM(new THREE.CylinderGeometry(0.30*B,0.30*B,0.06*B,lite?14:24), M.pickup, SP, 0.1*B,-ph+0.10*B,0.2*B);
    /* a slick of oil thrown to the far corner, the pickup left high and dry */
    tdM(new THREE.PlaneGeometry(0.7*B, pd*0.9), tdFlat(0x14100a,{r:0.1,m:0.3,e:1.2}), SP, -pw/2+0.37*B, -ph+0.02*B, 0, -PI/2);
    focus=[CK,SP]; }
  /* turbo beside the block when the hot side or the compressor let go (or just for context on a turbo engine) */
  var showT=d==="turbine"||d==="compressor";
  if(showT){ var TB=tdTurboG(B, d, M, lite); TB.position.set(-(two?pitch:0)-W/2-1.55*B, Dk*0.62, 0.2*B); root.add(TB); focus=TB; }

  /* views per damage: theta (around y, 0 = from +z), phi (from vertical), zoom */
  var V={ ringland:{th:0.75,ph:0.92,k:0.72}, holed:{th:0.7,ph:0.80,k:0.7}, crowncrack:{th:0.7,ph:0.70,k:0.7}, scuffed:{th:0.75,ph:1.15,k:0.85}, ring:{th:0.7,ph:0.95,k:0.8},
    rodsnap:{th:0.85,ph:1.20,k:1.15}, rodbent:{th:1.42,ph:1.28,k:1.05}, rodbolt:{th:0.85,ph:1.25,k:1.1}, crank:{th:0.55,ph:1.20,k:1.0}, bearing:{th:0.5,ph:1.1,k:1.0}, starve:{th:0.55,ph:1.08,k:1.25},
    headlift:{th:0.6,ph:1.25,k:1.2}, gasket:{th:0.55,ph:0.72,k:1.05}, warp:{th:0.35,ph:1.30,k:1.15}, valvebent:{th:0.6,ph:1.38,k:0.95}, valveburn:{th:0.55,ph:1.42,k:0.95},
    compressor:{th:0.15,ph:1.15,k:0.68}, turbine:{th:-0.35,ph:1.15,k:0.68}, boredist:{th:0.25,ph:1.02,k:1.1}, wall:{th:0.2,ph:0.85,k:1.15}, manifold:{th:0.45,ph:1.05,k:1.15}, backfire:{th:0.6,ph:0.95,k:1.1}, cold:{th:0.45,ph:1.25,k:1.1} };
  view=V[d]||view;
  return {root:root, focus:focus||pis, view:view, dmg:d};
}

function tdFrame(soft){
  if(!TD.root) return;
  var fb=new THREE.Box3(); [].concat(TD.focusObj).forEach(function(o){ var b=new THREE.Box3().setFromObject(o); if(b.isEmpty()) b.setFromCenterAndSize(o.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(1.6,1.6,1.6)); fb.union(b); });   /* an empty marker group frames around its position */
  var c=fb.getCenter(new THREE.Vector3()), sz=fb.getSize(new THREE.Vector3());
  if(!soft && TD.view){ camState.theta=TD.view.th; camState.phi=TD.view.ph; }
  /* the caption card covers the bottom TD.pad of the view: fit the part into what is left, and centre it there */
  var pad=clamp(TD.pad||0, 0, 0.6), top=clamp(TD.padTop||0, 0, 0.3), vfov=deg(camera.fov), aspect=camera.aspect||1, tv=Math.tan(vfov/2)*(1-pad-top), th=Math.tan(vfov/2)*aspect;
  var span=Math.max(sz.x,sz.y,sz.z, 1.6);
  var need=Math.max((span*0.5)/tv, (span*0.5)/th);
  camState.r=clamp(need*2.4*(TD.view?TD.view.k:1)*(aspect>1.2?1.2:1), 5.2, 20);   /* a wide view pulls back a touch so the part keeps its context */
  var sh=(pad-top)*camState.r*Math.tan(vfov/2), ph=camState.phi, t=camState.theta;
  camState.target.set(c.x+sh*Math.cos(ph)*Math.sin(t), c.y-sh*Math.sin(ph), c.z+sh*Math.cos(ph)*Math.cos(t));
}
function tdStep(dt, t){
  if(!TD.on) return;
  TD.t+=dt;
  var p=0.5+0.5*Math.sin(TD.t*4.2), i;
  for(i=0;i<TD.glow.length;i++){ var m=TD.glow[i]; m.emissiveIntensity=(m.userData.tdBase||0.5)*(0.45+0.95*p); }
  var k=0.75+0.65*p;
  for(i=0;i<TD.cracks.length;i++){ var c=TD.cracks[i]; c.color.copy(c.userData.c0).multiplyScalar(k*(GFX==="lite"?1.0:1.35)); }
  if(TD.light) TD.light.intensity=(GFX==="lite"?2.2:1.6)*(0.55+0.6*p);
  if(scene.fog&&TD.fog0){ scene.fog.near=camState.r+2.2; scene.fog.far=camState.r+15; }
}
function tdClear(){
  if(TD.root){ scene.remove(TD.root); TD.root.traverse(function(o){ if(o.geometry&&!o.geometry.__cached) o.geometry.dispose(); }); }
  TD.geos.forEach(function(g){ if(!g.__cached) g.dispose(); });
  TD.mats.forEach(function(m){ m.dispose(); });
  if(TD.light){ scene.remove(TD.light); TD.light=null; }
  TD.root=null; TD.focusObj=null; TD.geos=[]; TD.mats=[]; TD.glow=[]; TD.cracks=[];
}
ENGINE_VIS.teardown=function(info){
  if(!renderer) return null;
  if(!info){
    if(!TD.on) return null;
    tdClear(); TD.on=false;
    if(TD.fog0&&scene.fog){ scene.fog.near=TD.fog0.near; scene.fog.far=TD.fog0.far; } TD.fog0=null;
    if(engineRoot) engineRoot.visible=true;
    var s=TD.saved; TD.saved=null;
    if(s){ camState.theta=s.th; camState.phi=s.ph; camState.r=s.r; camState.target.copy(s.tg); camState.autoForce=s.af; camState.auto=s.au; camState.idle=0; }
    return null;
  }
  if(TD.on) tdClear();
  else TD.saved={th:camState.theta, ph:camState.phi, r:camState.r, tg:camState.target.clone(), af:camState.autoForce, au:camState.auto};
  if(STRIP.on) ENGINE_VIS.setStrip({on:false});
  if(PULL.on) ENGINE_VIS.setPull({on:false});
  if(BOG.on) ENGINE_VIS.setBog({on:false});
  if(BOAT.on) ENGINE_VIS.setBoat({on:false});
  var B=tdBuild(info);
  TD.root=B.root; TD.focusObj=B.focus; TD.view=B.view; TD.dmg=B.dmg; TD.on=true; TD.t=0;
  scene.add(B.root); B.root.updateMatrixWorld(true);
  var bb=new THREE.Box3().setFromObject(B.root), c=bb.getCenter(new THREE.Vector3());
  B.root.position.set(-c.x, 7.25-bb.min.y, -c.z*0.5); B.root.updateMatrixWorld(true);
  /* the garage falls back into a close dark fog (kept just behind the parts in tdStep) so the glow reads */
  if(scene.fog && !TD.fog0) TD.fog0={near:scene.fog.near, far:scene.fog.far};
  TD.light=new THREE.PointLight(0xff4020, 2, 7, 2); var fb2=new THREE.Box3(); [].concat(B.focus).forEach(function(o){ fb2.expandByObject(o); fb2.expandByPoint(o.getWorldPosition(new THREE.Vector3())); }); var fc=fb2.getCenter(new THREE.Vector3());
  TD.light.position.copy(fc).add(new THREE.Vector3(0.6, 0.9, 1.2)); scene.add(TD.light);
  if(engineRoot) engineRoot.visible=false;
  camState.autoForce=false; camState.auto=false; camState.idle=0;
  tdFrame(false);
  var tx=TD_TXT_ID[String(info.failId||"")]||TD_TXT[B.dmg]||TD_TXT.ringland;
  return {dmg:B.dmg, part:tx[0], what:tx[1], fix:tx[2]};
};
ENGINE_VIS.teardownSpin=function(on){ if(!TD.on) return false; camState.autoForce=on?true:false; if(!on) camState.auto=false; return !!on; };
ENGINE_VIS.teardownText=function(id){ var d=tdDmg(id), tx=TD_TXT_ID[String(id||"")]||TD_TXT[d]; return {dmg:d, part:tx[0], what:tx[1], fix:tx[2]}; };
ENGINE_VIS.teardownOn=function(){ return TD.on; };
ENGINE_VIS.teardownPad=function(f, top){ TD.pad=+f||0; TD.padTop=+top||0; if(TD.on) tdFrame(false); };   /* fraction of the view's height under the caption card */
if(typeof module!=="undefined" && module.exports) module.exports=ENGINE_VIS;
if(typeof window!=="undefined")window.ENGINE_VIS=ENGINE_VIS;

})();

</script>
