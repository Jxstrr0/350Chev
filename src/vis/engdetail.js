/* ===========================================================================
   7g. ENGINE DETAIL, round 5 (Full / Ultra): coolant plumbing, remote MAP sensor with its vacuum line, coolant-temp sender,
   valve-cover flange bolts, timing-case bolts. Everything is static geometry merged into the existing material buckets
   (hoses, wires) or instanced hardware, so it adds almost nothing to the draw-call count. Lite (DET 0) never gets here.
   Anchors that the front-drive builder knows (water pump, thermostat housing) arrive through ENGD.
   ==========================================================================*/
var ENGD = {};
/* a small hose between two fixed points, clamped at both ends: leaves the first point along d0 and arrives along d1 */
function engHose(a, d0, b, d1, rad, lift){
  var l=a.distanceTo(b), k=Math.max(rad*3, l*0.33);
  var p1=a.clone().addScaledVector(d0, k), p2=b.clone().addScaledVector(d1, -k);
  if(lift){ p1.y+=lift; p2.y+=lift; }
  hoseMesh([a, p1, p2, b], rad);
}
/* a wire (merged into the black wire bucket) through engine-space points */
function engWire(B, pts, r){ B.addW("wireBlk", TUBE(pts, r, Math.max(8, pts.length*6), 4)); }
/* water neck, lower pump inlet, heater loop and coolant-temp sender */
function engCoolant(B, c, mc){
  var bore=c.bore, L=c.L, bi=c.bankInfo[0], P=ENGD.pump, hs0, y0;
  setZone(0);
  if(P){
    /* upper hose off the thermostat housing, capped for the dyno cart (every layout; v1.5 only had it on an inline) */
    hs0=V3(P.tcF+bore*0.20, P.thY+bore*0.12, P.wpZ+bore*0.18);
    hoseMesh([hs0, hs0.clone().add(V3(0,bore*0.20,0)), hs0.clone().add(V3(bore*0.10,bore*0.32,0)), hs0.clone().add(V3(bore*0.26,bore*0.36,0))], bore*0.085);
    B.add("brass", CYL(bore*0.07,bore*0.07,bore*0.10,12), hs0.x+bore*0.31, hs0.y+bore*0.36, hs0.z, 0,0,PI/2);
    B.add("chrome", TOR(bore*0.085, bore*0.014, 5, 16), hs0.x+bore*0.255, hs0.y+bore*0.36, hs0.z, 0,PI/2,0);
    /* lower inlet: a neck on the pump's -Z flank and a short hose sweeping outboard to a capped stub (stays clear of the damper) */
    y0=P.wpY-bore*0.12; var ix=P.tcF+bore*0.19, iz=P.wpZ-bore*0.30;
    B.add("calu", CYL(bore*0.10,bore*0.10,bore*0.14,12,false,2.2), ix, y0, iz-bore*0.02, PI/2,0,0);
    hoseMesh([V3(ix, y0, iz-bore*0.08), V3(ix, y0, iz-bore*0.22), V3(ix, y0-bore*0.10, iz-bore*0.36), V3(ix, y0-bore*0.22, iz-bore*0.46)], bore*0.08);
    B.add("brass", CYL(bore*0.065,bore*0.065,bore*0.08,12), ix, y0-bore*0.24, iz-bore*0.50, PI/2,0,0);
    /* bypass loop from the thermostat housing down into the pump's side (a hose with a clamp at each end) */
    var ta=V3(P.tcF+bore*0.20, P.thY-bore*0.02, P.wpZ+bore*0.18+bore*0.17), pb=V3(P.tcF+bore*0.34, P.wpY+bore*0.06, P.wpZ+bore*0.18+bore*0.30);
    B.add("calu", CYL(bore*0.06,bore*0.06,bore*0.12,10), ta.x, ta.y, ta.z-bore*0.02, PI/2,0,0);
    B.add("calu", CYL(bore*0.06,bore*0.06,bore*0.12,10), pb.x, pb.y, pb.z-bore*0.06, PI/2,0,0);
    hoseMesh([V3(ta.x, ta.y, ta.z+bore*0.04), V3(ta.x, ta.y-bore*0.04, ta.z+bore*0.18), V3(pb.x, pb.y+bore*0.10, pb.z+bore*0.12), V3(pb.x, pb.y, pb.z)], bore*0.05);
  }
  if(!bi) return;
  /* heater loop on the rear face of bank 0's head: two nipples joined by a U hose (what a stand engine runs) */
  setZone(3);
  B.push(bi.matrix);
  var hw=bi.headW, xr=-c.bankLen*0.505, yh=bi.headY+bi.headH*0.30, z1=hw*0.20, z2=hw*0.44, hr=bore*0.075;
  B.add("calu", CYL(bore*0.06,bore*0.06,bore*0.16,10), xr-bore*0.07, yh, z1, 0,0,PI/2);
  B.add("calu", CYL(bore*0.06,bore*0.06,bore*0.16,10), xr-bore*0.07, yh, z2, 0,0,PI/2);
  var xe=xr-bore*0.13;
  hoseMesh([B.pt(xe, yh, z1), B.pt(xe-bore*0.16, yh, z1+(z2-z1)*0.12), B.pt(xe-bore*0.30, yh, (z1+z2)/2), B.pt(xe-bore*0.16, yh, z2-(z2-z1)*0.12), B.pt(xe, yh, z2)], hr);
  /* coolant-temperature sender on the same face, its plug and a wire to the main connector (an inline / vee; a boxer's face looks sideways) */
  if(!L.boxer && mc){
    var sz=-hw*0.34, sy=bi.headY+bi.headH*0.55, sx=xr-bore*0.06;
    B.add("brass", CYL(bore*0.05,bore*0.06,bore*0.12,10), sx, sy, sz, 0,0,PI/2);
    B.add("brass", CYL(bore*0.075,bore*0.075,bore*0.03,6), sx-bore*0.05, sy, sz, 0,0,PI/2);
    B.add("connGrey", BOX(bore*0.08,bore*0.09,bore*0.09), sx-bore*0.11, sy, sz);
    var w0=B.pt(sx-bore*0.15, sy, sz), w1=B.pt(sx-bore*0.26, sy-bore*0.14, sz);
    engWire(B, [w0, w1, V3(mc.x-bore*0.20, (w1.y+mc.y)*0.5, (w1.z*0.7+mc.z*0.3)), V3(mc.x-bore*0.14, mc.y+bore*0.06, mc.z+bore*0.05)], bore*0.016);
  }
  B.pop();
}
/* remote MAP sensor bracketed on the head's rear face, a vacuum hose to the plenum's rear nipple and a wire to the connector */
function engVacuum(B, c, mc){
  var bore=c.bore, L=c.L, bi=c.bankInfo[0], pl=LAST_PLEN, i;
  if(!bi || !pl || !mc || L.boxer || c.intake==="itb" || c.intake==="carb" || bi.dz || c.asp==="roots" || c.asp==="screw") return;
  setZone(3);
  B.push(bi.matrix);
  var hw=bi.headW, xr=-c.bankLen*0.505, my=bi.headY+bi.headH*0.80, mz=-hw*0.05;
  B.add("steel", BOX(bore*0.03, bore*0.24, bore*0.26), xr-bore*0.015, my, mz);
  B.hw("hex", xr-bore*0.03, my+bore*0.09, mz+bore*0.10, 0,0,PI/2, bore*0.06);
  B.hw("hex", xr-bore*0.03, my-bore*0.09, mz-bore*0.10, 0,0,PI/2, bore*0.06);
  B.add("dark", BOX(bore*0.11,bore*0.13,bore*0.15), xr-bore*0.085, my, mz);
  B.add("connGrey", BOX(bore*0.07,bore*0.06,bore*0.10), xr-bore*0.085, my+bore*0.095, mz+bore*0.02);
  B.add("blackPlast", CYL(bore*0.03,bore*0.03,bore*0.07,8), xr-bore*0.13, my+bore*0.04, mz-bore*0.04, 0,0,PI/2);
  var vp=B.pt(xr-bore*0.18, my+bore*0.04, mz-bore*0.04), wp=B.pt(xr-bore*0.085, my+bore*0.13, mz+bore*0.02);
  B.pop();
  /* nipple on the plenum's rear face */
  var pn=V3(pl.x-pl.len*0.5, (pl.top+pl.bot)*0.5, pl.z);
  B.add("blackPlast", CYL(bore*0.04,bore*0.04,bore*0.10,8), pn.x-bore*0.02, pn.y, pn.z, 0,0,PI/2);
  var pe=V3(pn.x-bore*0.08, pn.y, pn.z);
  var mid=V3((vp.x+pe.x)*0.5-bore*0.10, Math.max(vp.y,pe.y)+bore*0.16, (vp.z+pe.z)*0.5);
  hoseMesh([vp, V3(vp.x-bore*0.06, vp.y+bore*0.08, vp.z), mid, V3(pe.x-bore*0.06, pe.y+bore*0.04, pe.z), pe], bore*0.032);
  engWire(B, [wp, V3(wp.x-bore*0.08, wp.y+bore*0.05, wp.z), V3(mc.x-bore*0.20, (wp.y+mc.y)*0.55, (wp.z+mc.z)*0.5), V3(mc.x-bore*0.14, mc.y+bore*0.07, mc.z-bore*0.05)], bore*0.016);
}
/* valve-cover flange bolts and timing-case bolts (instanced hex heads, same few draw calls as the existing hardware) */
function engBolts(B, c){
  var bore=c.bore, ful=DET>=2, i, j, bi, covL, xs, zf, yf, sg;
  for(i=0;i<c.bankInfo.length;i++){
    bi=c.bankInfo[i]; if(bi.dz) continue;
    B.push(bi.matrix); setZone(3);
    covL=c.bankLen*0.97;
    /* a single-cam cover only carries its hold-down bolts on one side in bank.js: mirror them onto the other */
    if(c.sohc && !c.dohc && !c.pushrod){
      for(j=0;j<4;j++) B.hw("hex", (-1.5+j)*covL*0.28, bi.covY+bi.coverH*0.55, -bi.zs*bi.covW*0.44, 0,0,0, bore*0.075);
    }
    /* the cam-end flange of a pushrod / twin-cam cover: a bolt through each corner of the gasket flange */
    if(ful && (c.pushrod || (c.dohc && c.head!=="billet_hemi"))){
      zf = bi.covW*0.555; yf = bi.covY + bi.coverH*0.10;
      for(sg=-1;sg<=1;sg+=2) for(j=-1;j<=1;j+=2) B.hw("hex", j*covL*0.5, yf, sg*zf, 0,0,0, bore*0.075);
    }
    if(ful && c.dohc && c.head!=="billet_hemi"){
      /* timing-case bolts round the edge of the chain / belt case, heads facing forward */
      var tcX=c.bankLen*0.5+bore*0.14, tcTop=bi.covY+bi.coverH*0.5+bore*0.34, tcBot=-bore*0.40, tw=Math.max(c.bankW*0.92, bi.covW*0.96)*0.5-bore*0.11;
      var ys=[tcBot+bore*0.22, (tcBot+tcTop)*0.5-bore*0.10, tcTop-bore*0.16];
      for(j=0;j<3;j++) for(sg=-1;sg<=1;sg+=2) B.hw("hex", tcX, ys[j], sg*tw, 0,0,-PI/2, bore*0.07);
    }
    B.pop();
  }
  setZone(0);
}
/* entry point: after the harness trunk's main connector (mc) is placed */
function engineDetail(B, c, mc){
  engCoolant(B, c, mc);
  engVacuum(B, c, mc);
  engBolts(B, c);
  setZone(0);
}

/* ===========================================================================
   7g2. TWO-STROKE DIESEL DETAIL, round 7 (Full / Ultra): the old Detroit uniflow (6-71, 8V-92) and the Deltic never went
   through buildEngine's front-drive / harness path, so none of the round-5 hardware reached them. They have no throttle body,
   no MAP sensor and no valve-cover wiring; what they do have is air-box hand-hole covers, a bolted rocker cover, exhaust
   manifold flanges, a bolted blower, a front damper, a fuel manifold with a filter and a spin-on oil filter. Every piece is
   merged into an existing bucket or is instanced hardware. Lite (DET 0) never calls any of it.
   ==========================================================================*/
/* a hand-hole cover (plate + four bolts) on an outboard face of a bank (local frame: x along the bank, z out) */
function tsHandhole(B, x, y, z, side, w, h, bore){
  var sx, sy;
  B.add("steel", RBOX(w, h, bore*0.03, 0.012), x, y, z+side*bore*0.015);
  for(sx=-1;sx<=1;sx+=2) for(sy=-1;sy<=1;sy+=2) B.hw("hex", x+sx*w*0.38, y+sy*h*0.36, z+side*bore*0.035, side>0?PI/2:-PI/2,0,0, bore*0.07);
}
/* one Detroit bank, in the bank's own frame (called inside buildTwoStrokeMesh's bank loop, uniflow only) */
function tsDetroitBank(B, o){
  var b=o.bore, i, x, sg, ful=DET>=2, zs=o.zs, yc=(o.bdc+o.trTop)*0.5, h=Math.max(b*0.40, (o.trTop-o.bdc)*0.62), rx=zs>0?PI/2:-PI/2;
  /* air-box hand-hole covers on the outboard face */
  setZone(2);
  for(i=0;i<o.per;i++) tsHandhole(B, o.cx(i), yc, zs*b*0.81, zs, b*0.86, h, b);
  /* rocker-cover lip with a hold-down bolt a side per cylinder (two on Ultra), and the oil filler */
  setZone(3);
  var yl=o.y1+b*0.555;
  B.add("steel", BOX(o.bankLen*0.95, b*0.035, b*1.40), 0, yl, 0);
  for(i=0;i<o.per;i++){ x=o.cx(i);
    for(sg=-1;sg<=1;sg+=2){
      B.hw("hex", x, yl+b*0.02, sg*b*0.66, 0,0,0, b*0.08);
      if(ful) B.hw("hex", x+o.bspace*0.30, yl+b*0.02, sg*b*0.66, 0,0,0, b*0.08);
    }
  }
  B.add("steel", CYL(b*0.13, b*0.13, b*0.09, 14), o.cx(0)-o.bspace*0.20, o.y1+b*0.995, 0);
  B.add("dark", CYL(b*0.09, b*0.09, b*0.07, 12), o.cx(0)-o.bspace*0.20, o.y1+b*1.06, 0);
  /* exhaust-manifold flanges: a plate at each head port with a bolt above and below the pipe */
  setZone(4);
  var ye=o.y1+b*0.22, ze=zs*b*1.0;
  for(i=0;i<o.per;i++){ x=o.cx(i);
    B.add("steel", BOX(b*0.70, b*0.80, b*0.05), x, ye, ze);
    for(sg=-1;sg<=1;sg+=2){ B.hw("hex", x-b*0.20, ye+sg*b*0.37, ze+zs*b*0.03, rx,0,0, b*0.07); B.hw("hex", x+b*0.20, ye+sg*b*0.37, ze+zs*b*0.03, rx,0,0, b*0.07); }
  }
  /* fuel manifold along the cover side of the head (an inline: a vee's faces the valley) with a union per injector */
  if(!o.vee){
    setZone(3);
    var yf=o.y1+b*0.30, zf=-zs*b*0.82;
    B.add("steel", CYL(b*0.055, b*0.055, o.bankLen*0.95, 10), 0, yf, zf, 0,0,PI/2);
    for(i=0;i<o.per;i++) B.add("brass", BOX(b*0.16, b*0.15, b*0.14), o.cx(i), yf, zf+zs*b*0.04);
  }
  setZone(0);
}
/* front end and side hardware of a Detroit, in engine space (an inline gets the fuel filter and its hose as well) */
function tsDetroitFront(B, extras, o){
  var b=o.bore, j, ful=DET>=2, xF=o.bankLen*0.5+b*0.15, dR=o.caseR*0.60;
  setZone(1);
  B.add("calu", RBOX(b*0.22, o.caseR*1.9, o.caseW*0.98, 0.03), xF+b*0.11, -o.caseR*0.05, 0);          /* front cover */
  B.add("steel", CYL(dR, dR, b*0.20, 28, false, 1.6), xF+b*0.32, 0, 0, 0,0,PI/2);                      /* viscous damper */
  B.add("dark", CYL(dR*0.70, dR*0.70, b*0.12, 24, false, 1.6), xF+b*0.48, 0, 0, 0,0,PI/2);             /* belt pulley */
  B.add("steel", CYL(b*0.16, b*0.14, b*0.16, 12), xF+b*0.62, 0, 0, 0,0,PI/2);                           /* crank nose */
  for(j=0;j<6;j++){ var fa=j/6*TAU; B.hw("pbolt", xF+b*0.42, Math.cos(fa)*dR*0.84, Math.sin(fa)*dR*0.84, 0,0,0, b*0.09); }
  /* spin-on oil filter on the exhaust side low down, with a pair of lines to the block */
  setZone(2);
  var fz=o.caseW*0.5+b*0.42, fy=-o.caseR*0.15, fx=o.bankLen*0.28;
  B.add("calu", RBOX(b*0.70, b*0.30, b*0.40, 0.03), fx, fy+b*0.52, fz-b*0.20);
  B.add("dark", CYL(b*0.30, b*0.30, b*0.88, 20, false, 1.6), fx, fy, fz);
  B.add("steel", CYL(b*0.31, b*0.31, b*0.05, 20), fx, fy-b*0.44, fz);
  extras.push(hoseMesh([V3(fx+b*0.22, fy+b*0.64, fz-b*0.20), V3(fx+b*0.22, fy+b*0.84, fz-b*0.34), V3(fx+b*0.22, fy+b*0.62, o.caseW*0.5)], b*0.045, MAT.steel));
  extras.push(hoseMesh([V3(fx-b*0.22, fy+b*0.64, fz-b*0.20), V3(fx-b*0.22, fy+b*0.88, fz-b*0.34), V3(fx-b*0.22, fy+b*0.64, o.caseW*0.5)], b*0.045, MAT.steel));
  /* fuel filter at the front end of the head, fed from the manifold by a clamped hose (inline only) */
  if(!o.vee){
    setZone(3);
    var yf=o.y1+b*0.30, zf=-b*0.82, qx=xF+b*0.30, qy=o.y1+b*0.12, qz=zf-b*0.12;
    B.add("dark", CYL(b*0.20, b*0.20, b*0.70, 18, false, 1.6), qx, qy, qz);
    B.add("calu", CYL(b*0.22, b*0.22, b*0.08, 18), qx, qy+b*0.38, qz);
    B.add("brass", CYL(b*0.06, b*0.06, b*0.12, 10), qx, qy+b*0.46, qz);
    extras.push(hoseMesh([V3(o.bankLen*0.475, yf, zf), V3(o.bankLen*0.5+b*0.12, yf+b*0.10, zf), V3(qx-b*0.12, qy+b*0.50, qz+b*0.02), V3(qx, qy+b*0.50, qz)], b*0.05));
  }
  setZone(0);
}
/* the blower's end-plate bolts and inlet collar bolts (a Detroit's, in engine space) */
function tsBlowerBolts(B, bLen, bY, bZ, bH, bW, bore, zin){
  var k, j, sz, fa;
  setZone(5);
  for(k=-1;k<=1;k+=2) for(j=-1;j<=1;j++) for(sz=-1;sz<=1;sz+=2)
    B.hw("hex", k*(bLen/2+bore*0.18), bY+j*bH*0.36, bZ+sz*bW*0.40, 0,0,k>0?-PI/2:PI/2, bore*0.08);
  for(j=0;j<6;j++){ fa=j/6*TAU; B.hw("hex", zin.x+Math.cos(fa)*bore*0.40, zin.y, bZ+Math.sin(fa)*bore*0.40, 0,0,0, bore*0.07); }
  setZone(0);
}
/* the Deltic: one bank (local frame, outZ faces away from the triangle's centre) */
function tsDelticBank(B, o){
  var b=o.bore, i, x, sg, zo=o.outZ, rx=zo>0?PI/2:-PI/2;
  setZone(4);
  for(i=0;i<o.nC;i++){ x=-o.bankLen/2+o.bspace*(i+0.5);
    B.add("steel", BOX(b*0.62, b*0.80, b*0.05), x, o.half*0.30, zo*b*0.97);
    for(sg=-1;sg<=1;sg+=2){ B.hw("hex", x-b*0.18, o.half*0.30+sg*b*0.38, zo*b*1.0, rx,0,0, b*0.07); B.hw("hex", x+b*0.18, o.half*0.30+sg*b*0.38, zo*b*1.0, rx,0,0, b*0.07); }
  }
  setZone(2);
  for(i=0;i<o.nC;i++) tsHandhole(B, -o.bankLen/2+o.bspace*(i+0.5), -o.half*0.28, zo*b*0.775, zo, b*0.80, b*0.50, b);
  setZone(0);
}
/* the Deltic: blower casing bolts, the corner crank end caps, and an inspection plate on the phasing-gear case */
function tsDelticEnds(B, o){
  var b=o.bore, i, j, fa, x1=o.bankLen*0.5+b*1.2;
  setZone(5);
  for(j=0;j<12;j++){ fa=j/12*TAU; B.hw("hex", x1, Math.cos(fa)*o.Rt*0.66, Math.sin(fa)*o.Rt*0.66, 0,0,-PI/2, b*0.10); }
  setZone(1);
  for(i=0;i<3;i++){
    var c=o.corners[i], xe=o.bankLen*0.5+b*0.17;
    B.add("steel", CYL(o.caseR*0.80, o.caseR*0.80, b*0.05, 24), xe, c.y, c.z, 0,0,PI/2);
    for(j=0;j<6;j++){ fa=j/6*TAU; B.hw("hex", xe+b*0.03, c.y+Math.cos(fa)*o.caseR*0.62, c.z+Math.sin(fa)*o.caseR*0.62, 0,0,-PI/2, b*0.09); }
  }
  var xg=-o.bankLen*0.5-b*0.99;
  B.add("calu", CYL(b*0.60, b*0.60, b*0.06, 24), xg, 0, 0, 0,0,PI/2);
  for(j=0;j<8;j++){ fa=j/8*TAU; B.hw("hex", xg-b*0.04, Math.cos(fa)*b*0.46, Math.sin(fa)*b*0.46, 0,0,PI/2, b*0.09); }
  setZone(0);
}
