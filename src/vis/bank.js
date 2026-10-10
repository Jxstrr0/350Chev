/* ===========================================================================
   7a-d. DIESEL FUEL HARDWARE: injectors, glow plugs, injection pump and its lines. Petrol builds never reach it.
   ==========================================================================*/
function isDieselCfg(c){
  var E=(typeof ENGINE_SIM!=="undefined")?ENGINE_SIM:null; if(!c||!E) return false;
  if(E.isDiesel) return !!E.isDiesel(c);
  return !!(((E.OPT||{}).fuel||{})[c.fuel]||{}).ci;
}
/* MORE FUELS: propane / CNG hardware. A coolant-heated vaporiser on the front of the intake flank and the fuel tank
   lying beside the stand (white propane cylinder with its valve guard, or a grey 200-bar CNG bottle), joined by a hose. */
function isGasCfg(c){ var E=(typeof ENGINE_SIM!=="undefined")?ENGINE_SIM:null; return !!(c&&E&&E.OPT&&E.OPT.fuel[c.fuel]&&E.OPT.fuel[c.fuel].gas); }
function gasHardware(B, p){
  var bore=p.bore, cng=p.cfg.fuel==="cng", tr=cng?1.30:1.55, tl=cng?9.0:7.2;
  var tz=-(p.caseW*0.5+tr+bore*0.9), ty=p.floorY+tr, tx=-p.bankLen*0.10;
  var key=cng?"paintGrey":"blockWhite";
  B.add(key, CYL(tr,tr,tl,DET?28:16), tx, ty, tz, 0,0,PI/2);
  B.add(key, SPH(tr,DET?24:14), tx+tl/2, ty, tz, 0,0,0, 0.45,1,1);   /* dished ends */
  B.add(key, SPH(tr,DET?24:14), tx-tl/2, ty, tz, 0,0,0, 0.45,1,1);
  var vx=tx+tl/2+tr*0.40;                                          /* valve end */
  B.add("steel", CYL(bore*0.10,bore*0.10,bore*0.55,10), vx, ty, tz, 0,0,PI/2);
  B.add("wireRed", CYL(bore*0.16,bore*0.16,bore*0.08,12), vx+bore*0.30, ty, tz, 0,0,PI/2);   /* service valve handwheel */
  if(!cng){ B.add("steel", TOR(tr*0.55, bore*0.06, 6, 22), vx+bore*0.05, ty, tz, 0,PI/2,0); }   /* forklift-bottle guard collar round the valve */
  else { for(var b=-1;b<=1;b+=2) B.add("dark", BOX(bore*0.12, tr*2.06, tr*2.06), tx+b*tl*0.30, ty, tz); }   /* mounting straps */
  /* vaporiser / regulator: an aluminium drum with coolant stubs, on the front of the intake flank */
  var rx=p.bankLen*0.5-bore*0.55, ry=p.deckH*0.55, rz=-(p.caseW*0.5+bore*0.75);
  B.add("malu", CYL(bore*0.55,bore*0.55,bore*0.42,DET?24:14), rx, ry, rz, PI/2,0,0);
  B.add("calu", CYL(bore*0.30,bore*0.30,bore*0.20,12), rx, ry, rz-bore*0.30, PI/2,0,0);
  B.add("steel", CYL(bore*0.06,bore*0.06,bore*0.40,8), rx+bore*0.45, ry+bore*0.25, rz, 0,0,PI/2);
  B.add("steel", CYL(bore*0.06,bore*0.06,bore*0.40,8), rx+bore*0.45, ry-bore*0.25, rz, 0,0,PI/2);
  B.addW("hose", TUBE([B.pt(vx+bore*0.25, ty, tz), B.pt(vx+bore*1.2, ty+tr*0.8, tz+tr*0.4), B.pt(rx+bore*0.2, ry-bore*1.2, rz-bore*0.4), B.pt(rx, ry-bore*0.55, rz)], bore*0.07, 24, 6));
}
/* hex nut / fitting at a line end, axis along `dir` */
function dzNut(B, pos, dir, r, len){
  var q=new THREE.Quaternion().setFromUnitVectors(_UP, dir.clone().normalize());
  B.addM("steel", CYL(r,r,len,6,false,3.0), new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1,1,1)));
}
/* a steel pressure line through engine-space points, with a nut at each end in Ultra */
function dzLine(B, pts, rad, key){
  B.addW(key||"steel", TUBE(pts, rad, 10*pts.length+8, 6));
  if(DET>=2){
    var n=pts.length;
    dzNut(B, pts[0].clone().lerp(pts[1],0.06), pts[1].clone().sub(pts[0]), rad*1.9, rad*3.4);
    dzNut(B, pts[n-1].clone().lerp(pts[n-2],0.06), pts[n-2].clone().sub(pts[n-1]), rad*1.9, rad*3.4);
  }
}
/* per cylinder: an injector (stubby steel body, HP inlet on the intake side, return nipple or connector on top) and a
   glow plug in the exhaust-side head flank with a bus bar across the terminals. Returns the HP inlets (bank-local). */
function dieselHead(B, p, g){
  var bore=p.bore, per=p.per, bspace=p.bspace, zs=p.zs, Z=g.Z, di=(p.cfg&&p.cfg.dInj)||"rotary_ve", i, RX=function(r){ return r*zs; };
  var elec=(di==="heui"||di==="cr_gen1"||di==="cr_piezo"), slim=(di==="cr_piezo")?0.8:1;
  var by, iz;
  if(p.pushrod){ by=g.covY+g.coverH*0.90; iz=Z(-g.covW*0.20); }
  else if(p.sohc){ by=g.covY+g.coverH*0.92; iz=Z(-g.covW*0.22); }
  else if(p.head==="billet_hemi"){ by=g.covY+g.coverH*1.15; iz=0; }
  else { by=g.covY+g.coverH*0.72; iz=0; }
  var hI=bore*0.38, rI=bore*0.072*slim, yIn=by+hI*0.80, out=[], retPts=[];
  for(i=0;i<per;i++){
    var x=-p.bankLen/2 + bspace*(i+0.5);
    B.add("steel", CYL(rI*1.6,rI*1.7,bore*0.07,6,false,3.0), x, by, iz);                      /* clamp boss */
    B.add("steel", CYL(rI,rI*1.12,hI,10,false,2.4), x, by+hI*0.5, iz);                        /* body */
    B.add(elec?"dark":"malu", CYL(rI*1.18,rI*1.18,bore*0.07,10,false,2.4), x, by+hI+bore*0.02, iz);
    B.add("steel", CYL(rI*0.5,rI*0.55,bore*0.11,8,false,3.0), x, yIn, iz-zs*(rI+bore*0.04), RX(PI/2),0,0);   /* HP inlet nipple, intake side */
    out.push({x:x, y:yIn, z:iz-zs*(rI+bore*0.095)});
    if(elec){
      B.add("blackPlast", BOX(bore*0.10, bore*0.075, bore*0.12), x, by+hI+bore*0.085, iz+zs*bore*0.01);   /* connector body */
      if(DET) B.add("connGrey", BOX(bore*0.07, bore*0.035, bore*0.08), x, by+hI+bore*0.13, iz+zs*bore*0.01);
    }
    if(di!=="heui"){
      B.add("malu", CYL(rI*0.42,rI*0.46,bore*0.10,8,false,3.0), x, by+hI*0.95, iz+zs*(rI+bore*0.04), RX(-PI/2),0,0);   /* return-line nipple */
      retPts.push(B.pt(x, by+hI*0.95, iz+zs*(rI+bore*0.11)));
      if(DET>=2) B.hw("clamp", x, by+hI*0.95, iz+zs*(rI+bore*0.085), 0,0,0, rI*0.55);
    }
  }
  var retEnd=null;
  if(DET && retPts.length){   /* return line: one rubber hose along the row, dropping off the rear end */
    var q0=B.pt(-p.bankLen/2-bore*0.20, by+hI*0.95, iz+zs*(rI+bore*0.11)), q1=B.pt(-p.bankLen/2-bore*0.28, by-bore*0.12, iz+zs*(rI+bore*0.16));
    B.addW("hose", TUBE([B.pt(p.bankLen/2-bspace*0.25, by+hI*0.95, iz+zs*(rI+bore*0.11))].concat(retPts, [q0, q1]), bore*0.022, 40, 6)); retEnd=q1;
  }
  /* glow plugs tilt out of the exhaust-side head flank between the ports; a bus bar ties the terminals */
  var hy=g.headY+g.headH*0.86, hz=Z(g.headW*0.5), tl=0.55, d=V3(0, Math.cos(tl), zs*Math.sin(tl)), tips=[], gx, rxg=zs*tl;
  for(i=0;i<per;i++){
    gx=-p.bankLen/2 + bspace*(i+0.5) - bspace*0.26;
    var b0=V3(gx,hy,hz);
    B.add("steel", CYL(bore*0.05,bore*0.055,bore*0.06,6,false,3.0), gx, hy, hz, rxg,0,0);
    var c1=b0.clone().addScaledVector(d, bore*0.17);
    B.add("steel", CYL(bore*0.026,bore*0.03,bore*0.22,8,false,3.0), c1.x, c1.y, c1.z, rxg,0,0);
    var tip=b0.clone().addScaledVector(d, bore*0.31);
    B.add("chrome", CYL(bore*0.012,bore*0.012,bore*0.08,6,false,3.0), tip.x, tip.y, tip.z, rxg,0,0);
    B.add(DET?"connGrey":"blackPlast", CYL(bore*0.03,bore*0.03,bore*0.03,8,false,3.0), tip.x, tip.y, tip.z, rxg,0,0);
    tips.push(tip);
  }
  var glowEnd=null;
  if(DET){
    var gy=tips[0].y+bore*0.01, gz=tips[0].z;
    B.add("copper", BOX(p.bankLen*0.86, bore*0.02, bore*0.045), -bspace*0.26, gy+bore*0.02, gz);
    for(i=0;i<per;i++) B.add("steel", CYL(bore*0.028,bore*0.028,bore*0.025,6,false,3.0), tips[i].x, gy+bore*0.04, gz);
    if(DET>=2){
      for(i=0;i<per;i++) B.hw("hex", tips[i].x, gy+bore*0.032, gz, 0,0,0, bore*0.045);
      glowEnd=B.pt(-p.bankLen/2-bore*0.30, gy-bore*0.25, gz+zs*bore*0.05);
      B.addW("wireRed", TUBE([B.pt(-p.bankLen*0.43-bspace*0.26, gy+bore*0.03, gz), B.pt(-p.bankLen/2-bore*0.08, gy+bore*0.02, gz), glowEnd], bore*0.016, 14, 5));
    } else glowEnd=B.pt(-p.bankLen/2-bore*0.20, gy-bore*0.12, gz);
  }
  return {inl:out, yIn:yIn, by:by, hI:hI, iz:iz, retEnd:retEnd, glowEnd:glowEnd, rI:rI};
}
/* injection pump + lines for the whole engine (all banks), engine space. X = {cfg,L,bore,bankLen,bankW,deckH,skirt,bspace,per}. */
function dieselFuel(B, X, bankInfo, extras){
  var cfg=X.cfg, di=cfg.dInj||"rotary_ve", bore=X.bore, bl=X.bankLen, per=X.per, bsp=X.bspace, L=X.L, i, k, b, info, nb=bankInfo.length;
  var piezo=(di==="cr_piezo"), off=bsp*0.34;
  var W=function(inf,x,y,z){ return V3(x,y,z).applyMatrix4(inf.matrix); };
  /* pump seat: on the intake flank of the block (inline), in the valley (vee) or on top of the case (boxer) */
  var R = bore*(di==="inline_mech"?0.31:di==="rotary_ve"?0.30:di==="heui"?0.36:0.26)*(piezo?1.1:1);
  var cy = L.boxer ? bore*0.75+R+bore*0.20 : L.vee ? X.deckH*0.80 : X.skirt+(X.deckH-X.skirt)*0.40;
  var cz = (L.boxer||L.vee) ? 0 : -(X.bankW*0.5 + R + bore*0.12);
  var cx = 0;
  if(di==="rotary_ve"||di==="cr_gen1"||di==="cr_piezo") cx = bl*0.5 - bore*(L.vee?0.0:0.62);
  else if(di==="heui") cx = -bl*0.5 + bore*(L.vee?0.1:0.62);
  else cx = bl*0.02;
  /* mounting bracket from the pump down to the block flank */
  var seat=function(x, len){
    if(L.boxer||L.vee) return;
    var gap = (-X.bankW*0.5) - (cz + R*0.85);
    for(var s=-1;s<=1;s+=2) B.add("calu", BOX(bore*0.20, R*1.1, Math.max(0.02, gap)+bore*0.05), x+s*len*0.4, cy-R*0.1, cz+R*0.85+gap/2);
    for(var s2=-1;s2<=1;s2+=2) B.hw("hex", x+s2*len*0.4, cy-R*0.1, -X.bankW*0.5-bore*0.02, -PI/2,0,0, bore*0.08);
  };
  var outs=[[],[]];          /* [bank][cyl] world outlet points */
  var top=null;              /* a pump fitting the rail / return line can use */
  if(di==="inline_mech"){
    /* P7100: a long finned inline pump on the intake flank, driven from the front gear case, governor at the rear */
    var len=bl*0.88, xr=-bl*0.5+bore*0.34, xf=xr+len, xm=(xr+xf)/2;
    B.add("calu", RBOX(len, R*2, R*1.9, bore*0.03), xm, cy, cz);
    B.add("calu", CYL(R*1.0,R*1.0,bore*0.16,18,false,2.4), xf+bore*0.07, cy, cz, 0,0,PI/2);                    /* drive flange on the gear case */
    B.add("steel", CYL(R*0.5,R*0.5,bore*0.08,12,false,2.4), xf+bore*0.17, cy, cz, 0,0,PI/2);
    B.add("calu", RBOX(len*0.98, R*0.5, R*2.0, bore*0.02), xm, cy+R*0.95, cz);                                 /* delivery housing on top */
    if(DET){ var nf=Math.round(len/(bore*0.19));
      for(i=0;i<nf;i++) B.add("calu", BOX(bore*0.035, R*2.12, R*1.98), xr+bore*0.3+i*(len-bore*0.4)/(nf-1), cy-R*0.04, cz); }
    var gx=xr-bore*0.08;
    B.add("calu", CYL(R*1.28,R*1.28,bore*0.42,18,false,2.4), gx, cy, cz, 0,0,PI/2);                             /* governor housing */
    B.add("calu", CYL(R*0.92,R*0.92,bore*0.30,14,false,2.4), gx, cy+R*1.34, cz);
    B.add("dark", CYL(R*0.42,R*0.42,bore*0.20,12,false,2.4), gx, cy+R*1.34+bore*0.22, cz);                      /* fuel shut-off solenoid */
    B.add("steel", CYL(R*0.14,R*0.14,bore*0.10,8,false,2.4), gx, cy+R*1.34+bore*0.37, cz);
    if(DET){ B.add("connGrey", BOX(bore*0.10, bore*0.07, bore*0.10), gx+bore*0.10, cy+R*1.34+bore*0.24, cz+R*0.10);
      B.add("steel", BOX(bore*0.035, R*1.5, bore*0.05), gx-bore*0.02, cy+R*0.1, cz-R*1.30);                      /* throttle lever */
      B.add("chrome", SPH(bore*0.04,8), gx-bore*0.02, cy+R*0.85, cz-R*1.30); }
    seat(xm, len);
    for(b=0;b<nb;b++) for(i=0;i<per;i++){
      var ox=-bl/2 + bsp*(i+0.5), oz=cz + (nb>1 ? bankInfo[b].zs*R*0.6 : 0), oy=cy+R*1.2+(nb>1?-R*0.2:0);
      B.add("steel", CYL(bore*0.055,bore*0.06,bore*0.13,8,false,3.0), ox, oy-bore*0.01, oz);                    /* delivery valve holder */
      outs[b][i]=V3(ox, oy+bore*0.08, oz);
    }
    top = V3(gx, cy+R*1.0, cz);
  } else if(di==="rotary_ve"){
    /* VE rotary: a compact barrel with the distributor head at the rear and a cold-start lever */
    var vl=bore*0.80;
    B.add("calu", CYL(R,R,vl,20,false,2.4), cx, cy, cz, 0,0,PI/2);
    B.add("calu", CYL(R*1.15,R*1.15,bore*0.16,20,false,2.4), cx+vl/2+bore*0.03, cy, cz, 0,0,PI/2);                 /* drive-end flange */
    B.add("steel", CYL(R*0.45,R*0.45,bore*0.12,10,false,2.4), cx+vl/2+bore*0.14, cy, cz, 0,0,PI/2);
    var hxv=cx-vl/2-bore*0.12;
    B.add("steel", CYL(R*0.98,R*0.98,bore*0.26,20,false,2.4), hxv, cy, cz, 0,0,PI/2);                             /* distributor head */
    B.add("calu", CYL(R*1.02,R*1.02,bore*0.07,20,false,2.4), cx-vl/2+bore*0.01, cy, cz, 0,0,PI/2);
    B.add("calu", RBOX(vl*0.7, R*0.5, R*1.2, bore*0.02), cx+bore*0.05, cy+R*0.92, cz);                            /* governor cover on top */
    B.add("dark", CYL(R*0.34,R*0.34,bore*0.16,12,false,2.4), cx+bore*0.12, cy+R*1.2+bore*0.04, cz);               /* shut-off solenoid */
    if(DET){ B.add("connGrey", BOX(bore*0.09, bore*0.06, bore*0.09), cx+bore*0.12, cy+R*1.2+bore*0.15, cz);
      B.add("steel", BOX(bore*0.03, bore*0.30, bore*0.04), cx-bore*0.05, cy-R*0.3, cz-R*1.1);                    /* cold-start lever on the side */
      B.add("chrome", SPH(bore*0.035,8), cx-bore*0.05, cy-R*0.3+bore*0.15, cz-R*1.1);
      B.add("steel", CYL(bore*0.04,bore*0.04,bore*0.10,8,false,2.4), cx-bore*0.05, cy-R*0.3, cz-R*0.98, PI/2,0,0); }
    seat(cx, vl);
    var nOut=per*nb;
    for(b=0;b<nb;b++) for(i=0;i<per;i++){
      var kk = (b*per+i), ang = (nOut>1 ? (kk/(nOut-1)-0.5) : 0) * 2.0;        /* fan of outlets round the head, rad */
      var px=hxv, py=cy+Math.cos(ang)*(R*1.0), pz=cz+Math.sin(ang)*(R*1.0);
      B.add("steel", CYL(bore*0.05,bore*0.055,bore*0.11,8,false,3.0), px, py+Math.cos(ang)*bore*0.04, pz+Math.sin(ang)*bore*0.04, ang,0,0);
      outs[b][i]=V3(px, py+Math.cos(ang)*bore*0.12, pz+Math.sin(ang)*bore*0.12);
    }
    top = V3(cx+bore*0.12, cy+R*1.2, cz);
  } else if(di==="cr_gen1"||di==="cr_piezo"){
    /* CP3 / CP4: round housing, flange on the gear case, metering valve and a high-pressure head with the outlet */
    var pl=bore*0.62;
    B.add("calu", CYL(R,R,pl,18,false,2.4), cx, cy, cz, 0,0,PI/2);
    B.add("calu", CYL(R*1.12,R*1.12,bore*0.10,18,false,2.4), cx+pl/2+bore*0.04, cy, cz, 0,0,PI/2);
    B.add("steel", CYL(R*0.42,R*0.42,bore*0.12,10,false,2.4), cx+pl/2+bore*0.14, cy, cz, 0,0,PI/2);
    B.add("steel", RBOX(pl*0.7, R*0.9, R*1.5, bore*0.02), cx-pl*0.06, cy+R*0.86, cz);                              /* pump head */
    B.add("paintBlue", CYL(R*0.34,R*0.34,bore*0.20,12,false,2.4), cx-pl*0.06, cy+R*1.3+bore*0.04, cz-R*0.35);      /* metering valve */
    if(DET) B.add("connGrey", BOX(bore*0.09, bore*0.07, bore*0.09), cx-pl*0.06, cy+R*1.3+bore*0.17, cz-R*0.35);
    B.add("steel", CYL(bore*0.06,bore*0.06,bore*0.16,8,false,3.0), cx+pl*0.18, cy+R*1.3+bore*0.04, cz+R*0.2);     /* HP outlet */
    seat(cx, pl);
    top = V3(cx+pl*0.18, cy+R*1.3+bore*0.12, cz+R*0.2);
  } else if(di==="heui"){
    /* high-pressure oil pump: a squat canister at the back of the valley (or the intake flank on an inline) */
    B.add("calu", CYL(R,R*1.06,bore*0.55,20,false,2.4), cx, cy, cz);
    B.add("calu", CYL(R*1.12,R*1.12,bore*0.08,20,false,2.4), cx, cy+bore*0.30, cz);
    B.add("steel", CYL(R*0.55,R*0.6,bore*0.22,14,false,2.4), cx, cy+bore*0.44, cz);
    B.add("dark", CYL(R*0.30,R*0.30,bore*0.18,10,false,2.4), cx, cy+bore*0.60, cz);
    if(DET){ B.add("connGrey", BOX(bore*0.09, bore*0.07, bore*0.09), cx+bore*0.1, cy+bore*0.64, cz);
      for(i=0;i<8;i++) B.hw("hex", cx+Math.cos(i*PI/4)*R*0.88, cy+bore*0.345, cz+Math.sin(i*PI/4)*R*0.88, 0,0,0, bore*0.07); }
    seat(cx, bore*0.6);
    top = V3(cx, cy+bore*0.45, cz);
  }
  /* ---------- lines, rails and wiring per bank (bank-local drawing) ---------- */
  for(b=0;b<nb;b++){
    info=bankInfo[b]; var dz=info.dz, zs=info.zs, Z=function(z){ return z*zs; };
    var zf = -zs*(info.headW*0.5 + bore*0.17);
    if(di==="inline_mech"||di==="rotary_ve"){
      /* one pressure line per cylinder: pump outlet, up the head flank, across the cover to the injector */
      for(i=0;i<per;i++){
        var q=dz.inl[i], I=W(info,q.x,dz.yIn,q.z), A=W(info,q.x,dz.yIn,q.z-zs*bore*0.10), M=W(info,q.x+off*0.4,dz.yIn,(zf+q.z)/2);
        var F1=W(info,q.x+off,dz.yIn,zf), O=outs[b][i], pts;
        if(di==="inline_mech"){
          var F0=W(info,q.x+off,info.headY+info.headH*0.10,zf);
          pts=[O, O.clone().add(V3(0,bore*0.34,0)), F0, F1, M, A, I];
        } else {      /* VE: a nested ladder, the farthest cylinder runs lowest, so the bundle never crosses */
          var rank=Math.abs(q.x-cx)/(bl*0.5), runY=O.y+bore*0.30+(1-rank)*bore*0.55+i*bore*0.0;
          var F0b=W(info,q.x+off,runY,zf);
          pts=[O, V3(O.x,runY,O.z), F0b, F1, M, A, I];
        }
        dzLine(B, pts, bore*0.03);
      }
      if(DET && dz.retEnd && top){   /* return line from the injector row to the pump */
        extras.push(hoseMesh([dz.retEnd, dz.retEnd.clone().add(V3(-bore*0.08,-bore*0.5,-zs*bore*0.1)), top.clone().add(V3(0,bore*0.12,0))], bore*0.02, MAT.hose));
      }
    } else if(di==="cr_gen1"||di==="cr_piezo"){
      B.push(info.matrix);
      var ry=info.covY+info.coverH*0.38, rz=-zs*(info.covW*0.5+bore*0.17), rl=bl*0.94;
      B.add("steel", CYL(bore*0.058,bore*0.058,rl,12,false,3.0), 0, ry, rz, 0,0,PI/2);                               /* forged common rail */
      B.add("steel", CYL(bore*0.075,bore*0.075,bore*0.05,12,false,3.0), rl/2, ry, rz, 0,0,PI/2);
      B.add("steel", CYL(bore*0.075,bore*0.075,bore*0.05,12,false,3.0), -rl/2, ry, rz, 0,0,PI/2);
      B.add("dark", CYL(bore*0.045,bore*0.045,bore*0.12,10,false,2.4), -rl*0.40, ry+bore*0.09, rz);                    /* rail pressure sensor */
      if(DET) B.add("connGrey", BOX(bore*0.08, bore*0.06, bore*0.08), -rl*0.40, ry+bore*0.17, rz);
      for(i=0;i<per;i++){
        var q2=dz.inl[i], xi=q2.x;
        B.add("steel", CYL(bore*0.03,bore*0.036,bore*0.09,8,false,3.0), xi, ry+bore*0.07, rz);                       /* outlet stub */
        var S=B.pt(xi, ry+bore*0.10, rz), P1=B.pt(xi, (ry+dz.yIn)/2, rz), P2=B.pt(xi, dz.yIn, rz+Z(-bore*0.0));
        var Mm=B.pt(xi, dz.yIn, (rz+q2.z)/2), A2=B.pt(xi, dz.yIn, q2.z-zs*bore*0.10), I2=B.pt(xi, dz.yIn, q2.z);
        dzLine(B, [S, P1, P2, Mm, A2, I2], bore*0.03);
      }
      if(DET){   /* rail brackets */
        for(i=0;i<=per;i+=Math.max(1,Math.floor(per/2))){ var rbx=clamp(-bl/2+bsp*i, -bl*0.44, bl*0.44);
          B.add("steel", BOX(bore*0.08, bore*0.05, bore*0.14), rbx, ry-bore*0.02, rz+Z(bore*0.08));
          B.hw("hex", rbx, ry+bore*0.0, rz+Z(bore*0.18), 0,0,0, bore*0.06); }
      }
      var rEnd=B.pt(rl/2+bore*0.05, ry, rz);
      B.pop();
      dzLine(B, [top.clone(), top.clone().add(V3(bore*0.12, bore*0.35, 0)), V3(rEnd.x+bore*0.15, rEnd.y+(L.vee?bore*0.1:bore*0.45), rEnd.z+(rEnd.z>top.z?-1:1)*bore*0.2*(L.vee?1:0)), rEnd], bore*0.034);
    } else if(di==="heui"){
      B.push(info.matrix);
      /* oil rail block on the rear of the head, standpipe into the cover, injector connectors strung on a loom */
      var rbz=Z(-info.covW*0.0), rby=info.covY+info.coverH*0.40, rbx2=-bl/2-bore*0.14;
      B.add("anod", BOX(bore*0.22, bore*0.20, bore*0.34), rbx2, rby, rbz);
      B.add("steel", CYL(bore*0.06,bore*0.06,bore*0.18,10,false,3.0), rbx2+bore*0.19, rby, rbz, 0,0,PI/2);
      B.add("steel", CYL(bore*0.07,bore*0.07,bore*0.06,8,false,3.0), rbx2-bore*0.13, rby+bore*0.02, rbz+Z(bore*0.1), 0,0,PI/2);
      if(DET){
        B.add("connGrey", BOX(bore*0.10, bore*0.08, bore*0.10), rbx2, rby+bore*0.14, rbz+Z(bore*0.08));
        var lp=[], lyy=dz.by+dz.hI+bore*0.13;
        for(i=per-1;i>=0;i--) lp.push(B.pt(dz.inl[i].x, lyy, dz.iz+Z(bore*0.03)));
        lp.push(B.pt(-bl/2-bore*0.04, lyy, dz.iz+Z(bore*0.03))); lp.push(B.pt(rbx2, rby+bore*0.2, rbz+Z(bore*0.08)));
        B.addW("loom", uvByLength(TUBE(lp, bore*0.03, 30, 6), 1/1.4));
      }
      var tail=B.pt(rbx2-bore*0.13, rby+bore*0.02, rbz+Z(bore*0.1));
      B.pop();
      var o1=top.clone().add(V3(0,bore*0.05,0));
      dzLine(B, [o1, o1.clone().add(V3(-bore*0.1, bore*0.25, 0)), V3(tail.x-bore*0.35, tail.y-(L.vee?0:bore*0.2), tail.z + (b===0?1:-1)*(L.vee?bore*0.25:0)), tail], bore*0.04, "steel");
    }
  }
  return true;
}

/* ===========================================================================
   7a. ONE CYLINDER BANK
   ==========================================================================*/
function buildBank(B, p, extras){
  var zs=p.zs, per=p.per, bore=p.bore, bankLen=p.bankLen, bankW=p.bankW;
  var deckH=p.deckH, skirt=p.skirt, headH=p.headH, coverH=p.coverH, bspace=p.bspace;
  var Z=function(z){ return z*zs; };
  var RX=function(r){ return r*zs; };
  var RY=function(r){ return r*zs; };

  var deckTop = deckH;
  var barrelH = deckH - skirt;
  var DZ = isDieselCfg(p.cfg), dzInfo = null;
  var coilLoom = null, injLoomEnd = null;       /* wiring ends (engine space) for the harness trunk (Full / Ultra) */

  /* cylinder barrel / block deck */
  B.add(p.blockKey, RBOX(bankLen, barrelH, bankW, 0.03), 0, skirt+barrelH/2, 0);
  /* siamesed bore bulges on the intake+exhaust flanks */
  for(var i=0;i<per;i++){
    var x=-bankLen/2 + bspace*(i+0.5);
    B.add(p.blockKey, CYL(bore*0.60,bore*0.62,barrelH*0.96,16,false), x, skirt+barrelH*0.48, 0);
  }
  /* freeze (core) plugs in the water jacket: outboard barrel flank (both flanks on an inline) */
  for(i=0;i<per;i++){
    var fpx=-bankLen/2 + bspace*(i+0.5);
    B.add("steel", CYL(bore*0.15,bore*0.15,bore*0.035,14,false,2.6), fpx, skirt+barrelH*0.42, Z(bankW*0.5+0.004), RX(PI/2),0,0);
    if(!p.L.vee && !p.L.boxer) B.add("steel", CYL(bore*0.15,bore*0.15,bore*0.035,14,false,2.6), fpx, skirt+barrelH*0.42, Z(-(bankW*0.5+0.004)), RX(-PI/2),0,0);
  }
  if(DET){
    /* cast stiffening ribs on the water-jacket flank at each siamese wall, and a coolant drain boss */
    for(i=1;i<per;i++){
      var rbx=-bankLen/2 + bspace*i;
      B.add(p.blockKey, BOX(bore*0.07, barrelH*0.78, bore*0.07), rbx, skirt+barrelH*0.47, Z(bankW*0.5+0.012));
      if(!p.L.vee && !p.L.boxer) B.add(p.blockKey, BOX(bore*0.07, barrelH*0.78, bore*0.07), rbx, skirt+barrelH*0.47, Z(-(bankW*0.5+0.012)));
    }
    B.add(p.blockKey, CYL(bore*0.07,bore*0.08,bore*0.08,8), -bankLen*0.40, skirt+barrelH*0.16, Z(bankW*0.5+0.02), RX(PI/2),0,0);
    if(DET>=2) B.hw("hex", -bankLen*0.40, skirt+barrelH*0.16, Z(bankW*0.5+0.06), RX(PI/2),0,0, bore*0.09);
  }
  /* deck plate */
  B.add(p.blockKey, BOX(bankLen, bore*0.06, bankW), 0, deckTop-bore*0.03, 0);
  /* liners + bores visible from above */
  for(i=0;i<per;i++){
    var bx=-bankLen/2 + bspace*(i+0.5);
    B.add(p.liner, CYL(bore*0.50, bore*0.50, bore*0.30, 24, true, 3.0), bx, deckTop-bore*0.14, 0);
    B.add(p.liner, TOR(bore*0.50, bore*0.022, 6, 24, 3.0), bx, deckTop-0.002, 0, PI/2, 0, 0);
  }
  /* head-stud bosses */
  for(i=0;i<=per;i++){
    var sx=-bankLen/2 + bspace*i;
    if(i===0) sx+=bore*0.10; if(i===per) sx-=bore*0.10;
    B.add(p.blockKey, CYL(bore*0.11,bore*0.11,bore*0.10,8), sx, deckTop-bore*0.02, Z(bankW*0.40));
    B.add(p.blockKey, CYL(bore*0.11,bore*0.11,bore*0.10,8), sx, deckTop-bore*0.02, Z(-bankW*0.40));
  }

  /* head gasket line */
  B.add("steel", BOX(bankLen*1.002, bore*0.022, bankW*1.004), 0, deckTop+bore*0.011, 0);

  /* ---------- head ---------- */
  setZone(3);
  var headY = deckTop + bore*0.022;
  var headW = p.pushrod ? bankW*1.02 : (p.sohc ? bankW*1.06 : bankW*1.12);
  B.add(p.headKey, RBOX(bankLen*1.01, headH, headW, 0.035), 0, headY+headH/2, 0);
  /* intake/exhaust port bosses on the head flanks */
  for(i=0;i<per;i++){
    var px=-bankLen/2 + bspace*(i+0.5);
    var nPort = p.pushrod||p.sohc ? 1 : 2;
    for(var q=0;q<nPort;q++){
      var pz = nPort===1 ? 0 : (q?  bspace*0.17 : -bspace*0.17);
      B.add(p.headKey, BOX(bspace*0.30, headH*0.52, bore*0.16),
            px+pz, headY+headH*0.55, Z(headW*0.50));
      B.add(p.headKey, BOX(bspace*0.30, headH*0.46, bore*0.16),
            px+pz, headY+headH*0.50, Z(-headW*0.50));
    }
    /* head bolts (instanced) */
    var bm1=new THREE.Matrix4().compose(
      new THREE.Vector3(px-bspace*0.42, headY+headH*0.999, Z(headW*0.40)),
      new THREE.Quaternion(), new THREE.Vector3(1,1,1));
    p.boltXf.push(bm1.premultiply(p.matrix));
    var bm2=new THREE.Matrix4().compose(
      new THREE.Vector3(px-bspace*0.42, headY+headH*0.999, Z(-headW*0.40)),
      new THREE.Quaternion(), new THREE.Vector3(1,1,1));
    p.boltXf.push(bm2.premultiply(p.matrix));
  }

  if(DET){
    /* intake flange at every port (runners, log or ITB bolt to it) */
    for(i=0;i<per;i++){
      var ifx=-bankLen/2 + bspace*(i+0.5), ify=headY+headH*0.55, ifz=headW*0.50+bore*0.095;
      B.add(p.headKey, BOX(bspace*0.40, headH*0.44, bore*0.035), ifx, ify, Z(-ifz));
      if(DET>=2){ B.add("gasket", BOX(bspace*0.42, headH*0.46, bore*0.01), ifx, ify, Z(-(ifz-bore*0.022)));
        B.hw("hex", ifx-bspace*0.15, ify+headH*0.10, Z(-(ifz+bore*0.018)), RX(-PI/2),0,0, bore*0.085);
        B.hw("hex", ifx+bspace*0.15, ify-headH*0.10, Z(-(ifz+bore*0.018)), RX(-PI/2),0,0, bore*0.085); }
    }
    /* head casting: lifting eye at the rear, core plug on the end face */
    B.add(p.headKey, BOX(bore*0.08, headH*0.50, bore*0.30), -bankLen*0.505-bore*0.04, headY+headH*0.85, Z(headW*0.18));
    B.add("steel", CYL(bore*0.09,bore*0.09,bore*0.02,12), -bankLen*0.505-0.004, headY+headH*0.45, Z(-headW*0.16), 0,0,PI/2);
  }

  /* ---------- cam cover / rocker cover ---------- */
  var covY = headY + headH;
  var covW, covL=bankLen*0.97;
  if(p.pushrod){
    /* tall, slab-sided rocker cover with a filler cap */
    covW = headW*0.74;
    /* bolt flange, slab body, crowned top */
    B.add("wrinkle", BOX(covL*1.03, coverH*0.10, covW*1.16), 0, covY+coverH*0.05, 0);
    B.add("wrinkle", RBOX(covL, coverH*0.74, covW, 0.05), 0, covY+coverH*0.45, 0);
    B.addM("wrinkle", CYL(covW*0.30, covW*0.30, covL, 20, false), mkM(0, covY+coverH*0.82, 0, 0,0,PI/2, 0.45,1,1));   /* low crown, not a full log */
    B.add("wrinkle", BOX(covL*0.86, coverH*0.10, covW*0.44), 0, covY+coverH*0.99, 0);
    /* oil filler + breather */
    B.add("malu", CYL(bore*0.17,bore*0.19,bore*0.15,14), covL*0.30, covY+coverH*1.06, 0);
    if(DET) capDetail(B, covL*0.30, covY+coverH*1.06+bore*0.075, 0, bore*0.17, bore);
    B.add("blackPlast", CYL(bore*0.10,bore*0.10,bore*0.14,10), -covL*0.30, covY+coverH*1.05, Z(covW*0.16));
    /* rocker cover hold-downs */
    for(i=0;i<3;i++){
      var hx=(-1+i)*covL*0.40;
      p.boltXf.push(new THREE.Matrix4().makeTranslation(hx, covY+coverH*0.10, Z( covW*0.54)).premultiply(p.matrix));
      p.boltXf.push(new THREE.Matrix4().makeTranslation(hx, covY+coverH*0.10, Z(-covW*0.54)).premultiply(p.matrix));
    }
  } else if(p.sohc){
    /* single cam hump, narrow */
    covW = headW*0.80;
    B.add("wrinkle", RBOX(covL, coverH*0.55, covW, 0.04), 0, covY+coverH*0.275, 0);
    B.add("wrinkle", CYL(covW*0.30, covW*0.30, covL, 20, false), 0, covY+coverH*0.50, 0, 0,0,PI/2);
    B.add("wrinkle", BOX(covL*0.35, coverH*0.30, covW*0.62), -covL*0.10, covY+coverH*0.74, 0);
    B.add("malu", CYL(bore*0.15,bore*0.17,bore*0.12,14), covL*0.26, covY+coverH*0.80+bore*0.04, Z(covW*0.22));
    if(DET){   /* the cap proper stands on the hump (the v1.5 one sits half inside it) */
      var capS=covY+coverH*0.50+Math.sqrt(Math.pow(covW*0.30,2)-Math.pow(covW*0.22,2));
      B.add("malu", CYL(bore*0.15,bore*0.16,bore*0.10,14), covL*0.26, capS+bore*0.02, Z(covW*0.22));
      capDetail(B, covL*0.26, capS+bore*0.07, Z(covW*0.22), bore*0.15, bore);
    }
    for(i=0;i<4;i++){
      var sx2=(-1.5+i)*covL*0.28;
      p.boltXf.push(new THREE.Matrix4().makeTranslation(sx2, covY+coverH*0.55, Z(covW*0.44)).premultiply(p.matrix));
    }
  } else if(p.head==="billet_hemi"){
    /* hemi: one wide polished dome, plugs straight down the centre through tubes */
    covW = headW*0.96;
    B.add("wrinkle", BOX(covL*1.04, coverH*0.10, covW*1.10), 0, covY+coverH*0.05, 0);
    B.addM("palu", CYL(covW*0.50, covW*0.50, covL, 26, false), mkM(0, covY+coverH*0.36, 0, 0,0,PI/2, 0.62,1,0.98));   /* sx squashes world Y: a low, full-width dome */
    B.add("palu", BOX(covL, coverH*0.34, covW*0.98), 0, covY+coverH*0.20, 0);
    for(var hp=0; hp<(DZ?0:p.per); hp++){
      var hx=-bankLen/2 + bspace*(hp+0.5);
      B.add("malu", CYL(bore*0.11,bore*0.11,coverH*0.30,12), hx, covY+coverH*1.30, 0);     /* plug tube standing out of the dome crown */
      B.add("dark", CYL(bore*0.06,bore*0.06,coverH*0.12,10), hx, covY+coverH*1.50, 0);
      B.add("steel", CYL(bore*0.05,bore*0.05,bore*0.06,8), hx-bspace*0.36, covY+coverH*0.10+bore*0.03, Z(covW*0.52));
      B.add("steel", CYL(bore*0.05,bore*0.05,bore*0.06,8), hx-bspace*0.36, covY+coverH*0.10+bore*0.03, Z(-covW*0.52));
    }
    /* raised cast rib each side of the plug row, half-sunk in the dome */
    B.add("palu", BOX(covL*0.92, coverH*0.08, bore*0.10), 0, covY+coverH*1.24, Z( covW*0.16));
    B.add("palu", BOX(covL*0.92, coverH*0.08, bore*0.10), 0, covY+coverH*1.24, Z(-covW*0.16));
  } else {
    /* DOHC: two cam humps with a plug valley between them */
    covW = headW*0.90;
    var humpR = covW*0.245;
    /* bolt-down flange skirt */
    B.add("wrinkle", BOX(covL*1.04, coverH*0.10, covW*1.10), 0, covY+coverH*0.05, 0);
    B.add("wrinkle", RBOX(covL, coverH*0.44, covW, 0.035), 0, covY+coverH*0.26, 0);
    /* the two cam humps, almost touching, with a filled saddle between */
    B.addM("wrinkle", CYL(humpR,humpR,covL,22,false), mkM(0, covY+coverH*0.40, Z( covW*0.255), 0,0,PI/2, 1,1,0.66));
    B.addM("wrinkle", CYL(humpR,humpR,covL,22,false), mkM(0, covY+coverH*0.40, Z(-covW*0.255), 0,0,PI/2, 1,1,0.66));
    B.add("wrinkle", BOX(covL, coverH*0.46, covW*0.52), 0, covY+coverH*0.44, 0);
    /* cast rib + name pad running down the saddle */
    B.add("wrinkle", BOX(covL*0.90, coverH*0.10, covW*0.30), 0, covY+coverH*0.70, 0);
    /* coil-on-plug packs sunk into the saddle */
    for(i=0;i<per && !DZ;i++){
      var cx=-bankLen/2 + bspace*(i+0.5);
      B.add("blackPlast", BOX(bspace*0.34, coverH*0.34, covW*0.24), cx, covY+coverH*0.84, 0);
      B.add("blackPlast", BOX(bspace*0.16, coverH*0.16, covW*0.30), cx+bspace*0.10, covY+coverH*0.92, Z(covW*0.06));
    }
    B.add("malu", CYL(bore*0.15,bore*0.17,bore*0.11,14), -covL*0.34, covY+coverH*0.60+bore*0.04, Z(covW*0.26));
    if(DET){   /* v1.5's cap is buried in the cam hump: stand the real one on the crest */
      var capD=covY+coverH*0.40+humpR;
      B.add("malu", CYL(bore*0.15,bore*0.16,bore*0.09,14), -covL*0.34, capD+bore*0.015, Z(covW*0.255));
      capDetail(B, -covL*0.34, capD+bore*0.06, Z(covW*0.255), bore*0.15, bore);
    }
    for(i=0;i<5;i++){
      var bx3=(-2+i)*covL*0.22;
      p.boltXf.push(new THREE.Matrix4().makeTranslation(bx3, covY+coverH*0.52, Z(covW*0.45)).premultiply(p.matrix));
      p.boltXf.push(new THREE.Matrix4().makeTranslation(bx3, covY+coverH*0.52, Z(-covW*0.45)).premultiply(p.matrix));
    }
  }

  /* ---------- cam drive / VVT phasers on the front face ---------- */
  var fx = bankLen*0.50 + bore*0.06;
  if(p.pushrod || p.head==="billet_hemi"){
    /* timing cover only — cam lives in the block */
    if(!p.L.vee) B.add("calu", RBOX(bore*0.16, deckH*0.62, bankW*0.86, 0.03), bankLen*0.50+bore*0.08, deckH*0.30, 0);   /* V: one central cover in buildFAD */
  } else {
    var nCam = p.dohc ? 2 : 1;
    /* timing chain / belt case, as wide as the cam cover so both sprockets sit behind it */
    var tcFace = bankLen*0.50 + bore*0.14;
    var tcTop=covY+coverH*0.5+bore*0.34, tcBot=-bore*0.40;
    B.add("calu", RBOX(bore*0.14, tcTop-tcBot, Math.max(bankW*0.92, covW*0.96), 0.03), bankLen*0.50+bore*0.07, (tcTop+tcBot)/2, 0);
    for(var cI=0; cI<nCam; cI++){
      var cz = nCam===1 ? 0 : (cI? covW*0.30 : -covW*0.30);
      /* sprocket housing cast proud of the case: one cam or two reads from the front */
      B.add("calu", CYL(bore*0.27,bore*0.27,bore*0.05,22,false,2.4), tcFace+bore*0.025, covY+coverH*0.50, Z(cz), 0,0,PI/2);
      if(DET) B.add("turned", DISC(bore*0.25), tcFace+bore*0.0515, covY+coverH*0.50, Z(cz), 0,PI/2,0);   /* machined boss face */
      if(p.vvt){
        B.add("malu", CYL(bore*0.17,bore*0.17,bore*0.05,18), tcFace+bore*0.075, covY+coverH*0.50, Z(cz), 0,0,PI/2);
        B.add("dark", CYL(bore*0.08,bore*0.08,bore*0.04,10), tcFace+bore*0.12, covY+coverH*0.50, Z(cz), 0,0,PI/2);
        if(p.vvl) B.add("blackPlast", BOX(bore*0.20,bore*0.20,bore*0.16), tcFace+bore*0.02, covY+coverH*0.86, Z(cz));
      } else {
        B.add("steel", CYL(bore*0.07,bore*0.07,bore*0.03,6), tcFace+bore*0.065, covY+coverH*0.50, Z(cz), 0,0,PI/2);
      }
    }
  }

  /* ---------- exhaust ---------- */
  setZone(4);
  var exhZ = Z(headW*0.50);
  LAST_PIPE_END=null; buildExhaust(B, p, extras, exhZ, headY, headH, Z);
  var exhaustTip = LAST_PIPE_END ? LAST_PIPE_END.clone() : null;

  /* ---------- fuel rail + injectors (intake flank) ---------- */
  setZone(0);
  var inZ = Z(-headW*0.52);
  if(p.intake!=="carb" && !DZ){
    /* bigger injectors are fatter bodies on a fatter rail */
    var injK = ({i440:1.06, i650:1.12, i1000:1.2, i1650:1.3, i2200:1.38, i2200x2:1.38, i2200x4:1.38})[p.cfg && p.cfg.injectors] || 1, railK = 1 + (injK-1)*0.9;
    B.add("malu", CYL(bore*0.055*railK,bore*0.055*railK,bankLen*0.94,12,false,3.0), 0, headY+headH*0.72, inZ+Z(-bore*0.16), 0,0,PI/2);
    for(i=0;i<per;i++){
      var ix=-bankLen/2 + bspace*(i+0.5);
      B.add("blackPlast", CYL(bore*0.048*injK,bore*0.038*injK,bore*0.20*injK,10), ix, headY+headH*0.60, inZ+Z(-bore*0.13), RX(-0.30),0,0);   /* nozzle tipped toward the port */
      B.add("dark", BOX(bore*0.09*injK,bore*0.07,bore*0.06*injK), ix, headY+headH*0.78, inZ+Z(-bore*0.16));
      if(DET>=2){
        B.add("steel", BOX(bore*0.022, bore*0.05, bore*0.075), ix+bore*0.055, headY+headH*0.70, inZ+Z(-bore*0.15));    /* retaining clip */
        B.add("connGrey", BOX(bore*0.07, bore*0.035, bore*0.05), ix, headY+headH*0.78+bore*0.045, inZ+Z(-bore*0.16));    /* connector latch */
      }
    }
    if(DET){
      /* rail brackets bolted to the head between the ports */
      for(i=0;i<=per;i+=Math.max(1,Math.floor(per/2))){
        var rbx2=clamp(-bankLen/2 + bspace*i, -bankLen*0.44, bankLen*0.44);
        B.add("steel", BOX(bore*0.10, headH*0.26, bore*0.03), rbx2, headY+headH*0.60, inZ+Z(-bore*0.08));
        B.add("steel", BOX(bore*0.10, bore*0.03, bore*0.12), rbx2, headY+headH*0.72-bore*0.06, inZ+Z(-bore*0.13));
        B.hw("hex", rbx2, headY+headH*0.52, inZ+Z(-bore*0.10), RX(-PI/2),0,0, bore*0.075);
      }
      /* injector harness: a loom above the rail with a tail over the rear of the head */
      var ihz=inZ+Z(-bore*0.23), ihy=headY+headH*0.72+bore*0.12;
      var ihp=[B.pt(bankLen*0.47, ihy, ihz), B.pt(0, ihy+bore*0.01, ihz), B.pt(-bankLen*0.47, ihy, ihz), B.pt(-bankLen*0.52-bore*0.10, ihy-bore*0.12, ihz)];
      B.addW("loom", uvByLength(TUBE(ihp, bore*0.032, 28, 6), 1/1.4));
      injLoomEnd = ihp[ihp.length-1];
      if(DET>=2){
        for(i=0;i<per;i++){
          var px2=-bankLen/2 + bspace*(i+0.5);
          B.addW("wireBlk", TUBE([B.pt(px2, headY+headH*0.78+bore*0.06, inZ+Z(-bore*0.18)), B.pt(px2+bore*0.03, ihy-bore*0.01, inZ+Z(-bore*0.21)), B.pt(px2+bore*0.08, ihy, ihz)], bore*0.011, 6, 4));
        }
        /* fuel pressure regulator + feed line down the rear of the head */
        B.add("anod", CYL(bore*0.075,bore*0.075,bore*0.16,12), -bankLen*0.49-bore*0.06, headY+headH*0.72, inZ+Z(-bore*0.16), 0,0,PI/2);
        B.add("dark", CYL(bore*0.05,bore*0.05,bore*0.05,10), -bankLen*0.49-bore*0.06, headY+headH*0.72+bore*0.09, inZ+Z(-bore*0.16));
        hoseMesh([B.pt(-bankLen*0.49-bore*0.16, headY+headH*0.72, inZ+Z(-bore*0.16)), B.pt(-bankLen*0.52-bore*0.28, headY+headH*0.50, inZ+Z(-bore*0.18)),
                  B.pt(-bankLen*0.52-bore*0.30, headY-headH*0.45, inZ+Z(-bore*0.10))], bore*0.022, MAT.steel);
      }
    }
  }

  /* ---------- plug leads for 2-valve heads: coil-near-plug (GM LS style) ----------
     one coil per cylinder on a bracket along the outboard shoulder of the cover; a short
     lead runs down the outside of the cover to the plug boot in the head flank */
  if((p.pushrod || p.sohc) && !DZ){
    var shY = covY + (p.pushrod ? coverH*0.82 : coverH*0.55);   /* cover body top beside the crown / cam hump */
    var cpZ = covW*0.40;
    B.add("steel", BOX(bankLen*0.88, bore*0.035, bore*0.24), 0, shY+bore*0.018, Z(cpZ));
    for(i=0;i<per;i++){
      var wx=-bankLen/2 + bspace*(i+0.5);
      B.add("blackPlast", BOX(bspace*0.40, bore*0.24, bore*0.22), wx, shY+bore*0.155, Z(cpZ));
      B.add("blackPlast", CYL(bore*0.05,bore*0.05,bore*0.10,8), wx, shY+bore*0.155, Z(cpZ+bore*0.15), RX(PI/2),0,0);
      var a0=B.pt(wx, covY-headH*0.20, Z(covW*0.70));
      var a1=B.pt(wx, covY+coverH*0.30, Z(covW*0.78+bore*0.06));
      var a2=B.pt(wx, shY+bore*0.155, Z(cpZ+bore*0.20));
      extras.push(meshB(TUBE([a0,a1,a2], bore*0.045, 12, 7), MAT.wireRed));
      B.add("blackPlast", CYL(bore*0.065,bore*0.065,bore*0.14,10), wx, covY-headH*0.20, Z(covW*0.66), RX(PI/2),0,0);
      if(DET){
        B.add("connGrey", BOX(bspace*0.14, bore*0.05, bore*0.10), wx-bspace*0.06, shY+bore*0.30, Z(cpZ-bore*0.04));
        if(DET>=2) B.addW("wireBlk", TUBE([B.pt(wx-bspace*0.06, shY+bore*0.32, Z(cpZ-bore*0.08)), B.pt(wx-bspace*0.02, shY+bore*0.34, Z(cpZ-bore*0.13)), B.pt(wx+bspace*0.06, shY+bore*0.33, Z(cpZ-bore*0.16))], bore*0.011, 6, 4));
        B.hw("hex", wx+bspace*0.15, shY+bore*0.035, Z(cpZ+bore*0.07), 0,0,0, bore*0.07);
      }
    }
    if(DET) coilLoom = [B.pt(bankLen*0.45, shY+bore*0.33, Z(cpZ-bore*0.17)), B.pt(0, shY+bore*0.34, Z(cpZ-bore*0.17)), B.pt(-bankLen*0.45, shY+bore*0.33, Z(cpZ-bore*0.17))];
  }
  if(DZ){ setZone(3); dzInfo = dieselHead(B, p, { covY:covY, covW:covW, coverH:coverH, headY:headY, headH:headH, headW:headW, Z:Z }); if(dzInfo.glowEnd) coilLoom = [dzInfo.glowEnd, dzInfo.glowEnd]; }
  if(DET) setZone(3);     /* cover-top wiring and lettering belong to the head zone (tap / heat map) */
  if(DET && p.dohc && p.head!=="billet_hemi" && !DZ){
    /* coil-on-plug: a connector on every coil, pigtails into a loom along the saddle */
    for(i=0;i<per;i++){
      var ccx=-bankLen/2 + bspace*(i+0.5);
      B.add("connGrey", BOX(bspace*0.14, bore*0.05, covW*0.10), ccx-bspace*0.03, covY+coverH*1.01+bore*0.022, Z(-covW*0.07));
      if(DET>=2) B.addW("wireBlk", TUBE([B.pt(ccx-bspace*0.03, covY+coverH*1.01+bore*0.045, Z(-covW*0.11)), B.pt(ccx, covY+coverH*1.01+bore*0.05, Z(-covW*0.16)), B.pt(ccx+bspace*0.08, covY+coverH*1.0+bore*0.04, Z(-covW*0.19))], bore*0.011, 6, 4));
      B.hw("hex", ccx+bspace*0.14, covY+coverH*1.01, Z(covW*0.05), 0,0,0, bore*0.06);
    }
    coilLoom = [B.pt(bankLen*0.46, covY+coverH*1.0+bore*0.04, Z(-covW*0.19)), B.pt(0, covY+coverH*1.0+bore*0.045, Z(-covW*0.19)), B.pt(-bankLen*0.46, covY+coverH*1.0+bore*0.04, Z(-covW*0.19))];
  }
  if(DET && p.head==="billet_hemi" && !DZ){
    for(i=0;i<per;i++){
      var hcx=-bankLen/2 + bspace*(i+0.5);
      B.add("connGrey", BOX(bore*0.10, bore*0.05, bore*0.10), hcx, covY+coverH*1.56+bore*0.025, 0);
      if(DET>=2) B.addW("wireBlk", TUBE([B.pt(hcx, covY+coverH*1.56+bore*0.05, Z(bore*0.03)), B.pt(hcx+bore*0.04, covY+coverH*1.58+bore*0.04, Z(bore*0.10)), B.pt(hcx+bore*0.10, covY+coverH*1.56+bore*0.03, Z(bore*0.16))], bore*0.011, 6, 4));
    }
    for(i=0;i<per;i+=2) B.add("steel", BOX(bore*0.03, coverH*0.30, bore*0.03), -bankLen/2 + bspace*(i+1), covY+coverH*1.40, Z(bore*0.16));
    coilLoom = [B.pt(bankLen*0.46, covY+coverH*1.56+bore*0.02, Z(bore*0.16)), B.pt(0, covY+coverH*1.57+bore*0.02, Z(bore*0.16)), B.pt(-bankLen*0.46, covY+coverH*1.56+bore*0.02, Z(bore*0.16))];
  }
  if(DET && coilLoom && !DZ){
    var rearDrop = coilLoom[2].clone().add(V3(-bore*0.30, -coverH*0.9, 0));
    coilLoom.push(rearDrop);
    B.addW("loom", uvByLength(TUBE(coilLoom, bore*0.036, 30, 6), 1/1.4));
  }
  if(DET){ coverDecor(B, p, { covY:covY, covW:covW, covL:covL, coverH:coverH, headW:headW, zs:zs }); setZone(0); }

  return {
    zs:zs, headW:headW, covW:covW, covY:covY, coverH:coverH, headY:headY, headH:headH,
    covTop: covY + (p.pushrod ? coverH*1.07 : p.sohc ? coverH*0.50+covW*0.30 : p.head==="billet_hemi" ? coverH*1.56 : coverH*1.10),
    exhZ:exhZ, inZ:inZ, matrix:p.matrix, bankLen:bankLen, exhaustTip:exhaustTip,
    coilLoomEnd: coilLoom ? coilLoom[coilLoom.length-1] : null, injLoomEnd: injLoomEnd, dz: dzInfo
  };
}

