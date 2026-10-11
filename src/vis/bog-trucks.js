/* ===========================================================================
   MUD BOG TRUCKS — one real truck per class, drawn at real size on the sim's tyres (SIM.BOG_CLASSES[cls].veh.tyreDia):
   Street 4×4: a plated square-body pickup on a 4" lift, 35" mud-terrains tucked under the flares, chrome bumpers, a winch
   and a snorkel; sits low. Modified: a 10" lift on 44" swampers (big staggered square blocks), cut fenders, exposed
   Rockwells (planetary hubs, top-loader pumpkins), steel beadlocks, a big-block's zoomies or a diesel's stacks.
   Open/Super: a tube-chassis buggy under a chopped fibreglass cab, engine set back, cage, no bed, rear radiator, 54"
   paddles (or swampers) on narrow polished beadlocks, the build's blower / turbo / injector hat through the hood.
   Same userData contract as pullVehicle (wheelsR/F spin groups, tips, rr, wr, trR, wb, pivot, body, mats.paint, door
   decal + livery spots), with k=1. Also here: the Lite/contact blob shadow, the stage framing and the fairground props.
   ==========================================================================*/
var BOGT={ geo:{}, tex:{}, flagman:null, startX:null, poseT:0, pose:-1 };
var BOGT_SPEC={
  street:{ wb:2.95, trk:0.83, rimIn:17, rim:"steel", rimCol:0x1b1c1f, w:{mt:12.5, swamp:13.5, paddle:12.5} },
  modified:{ wb:3.1, trk:0.93, rimIn:15, rim:"bead", rimCol:0xe9e6dc, w:{mt:15.5, swamp:18.5, paddle:15} },
  super:{ wb:3.0, trk:1.06, rimIn:20, rim:"bead", rimCol:0xcfd3d8, w:{mt:15, swamp:16.5, paddle:15} }
};
var BOGT_TYRE={ mt:{brand:"NORTHWIND", model:"MUD GRIP M/T"}, swamp:{brand:"NORTHWIND", model:"SWAMP BOGGER"}, paddle:{brand:"NORTHWIND", model:"PADDLE PRO"} };
function bogTyreDia(cls){
  var C=(typeof ENGINE_SIM!=="undefined" && ENGINE_SIM.BOG_CLASSES)?ENGINE_SIM.BOG_CLASSES[cls]:null;
  return (C && C.veh && +C.veh.tyreDia) || ({street:35, modified:44, super:54})[cls] || 35;
}
/* what the engine bay shows: d/g (diesel / gas) + N (atmo) B (blower) T (turbo) C (centrifugal) */
function bogTruckHw(){
  var c=lastCfg||{}, a=String(c.asp||"na"), d=false; try{ d=isDieselCfg(c); }catch(e){ d=false; }
  return (d?"d":"g")+(a==="roots"||a==="screw"?"B":a==="na"?"N":a==="centrifugal"?"C":"T");
}
function bogtCanvasTex(c, srgb){ var t=new THREE.CanvasTexture(c); if(srgb!==false) t.encoding=THREE.sRGBEncoding; t.anisotropy=MAXANISO; return t; }
/* chrome: a banded "reflection" across u so a stack reads as polished metal, not a white tube */
function bogtChromeTex(){
  if(BOGT.tex.chrome) return BOGT.tex.chrome;
  var c=newCanvas(128,4), x=c.getContext("2d"), g=x.createLinearGradient(0,0,128,0);
  [[0,"#8a929b"],[0.1,"#ffffff"],[0.17,"#c4cad1"],[0.3,"#5e646c"],[0.42,"#eef1f4"],[0.5,"#ffffff"],[0.58,"#aab1b9"],[0.7,"#565b62"],[0.82,"#e2e6ea"],[0.92,"#ffffff"],[1,"#8a929b"]].forEach(function(s){ g.addColorStop(s[0],s[1]); });
  x.fillStyle=g; x.fillRect(0,0,128,4); return (BOGT.tex.chrome=bogtCanvasTex(c));
}
/* the sidewall: rubber everywhere, raised letters round the outer wall (v 0.2..0.8 = rim..shoulder, see bogTyreGeo; the rest stays plain) */
function bogtSideTex(cls, kind, dia, wIn, rimIn, lite){
  var key="side"+cls+kind+(lite?"l":""); if(BOGT.tex[key]) return BOGT.tex[key];
  var W=lite?1024:2048, H=lite?128:256, c=newCanvas(W,H), x=c.getContext("2d"), F="'Chakra Petch','Arial Narrow',Arial,sans-serif", T=BOGT_TYRE[kind]||BOGT_TYRE.mt;
  x.fillStyle="#241e19"; x.fillRect(0,0,W,H);
  x.fillStyle="#1b1612"; for(var i=0;i<W;i+=W/96) x.fillRect(i, H*0.23, W/400, H*0.06);   /* sidewall ribs near the tread */
  var size=dia+"x"+(wIn%1?wIn.toFixed(2):wIn.toFixed(2))+(kind==="mt"?"R":"-")+rimIn+(kind==="mt"?" LT":"");
  x.setTransform(-1,0,0,1,W,0);   /* u runs the other way round the lathe: mirror so it reads clockwise from outside */
  x.textBaseline="middle"; x.textAlign="center";
  for(var k=0;k<2;k++){ var cx=W*(0.25+0.5*k), y=H*0.53;
    x.font="700 "+Math.round(H*0.2)+"px "+F; x.fillStyle="#cdc6b8"; x.fillText(T.brand, cx, y, W*0.2);
    x.font="700 "+Math.round(H*0.11)+"px "+F; x.fillStyle="#b7b0a3"; x.fillText(T.model, cx+W*0.17, y, W*0.1); x.fillText(size, cx-W*0.17, y, W*0.11); }
  x.setTransform(1,0,0,1,0,0);
  return (BOGT.tex[key]=bogtCanvasTex(c));
}
function bogtLugBox(){
  if(BOGT.geo.lug) return BOGT.geo.lug;
  var g=new THREE.BoxGeometry(1,1,1).toNonIndexed(), uv=g.attributes.uv; for(var i=0;i<uv.count;i++) uv.setXY(i, 0.5, 0.95);   /* plain rubber in the side map */
  return (BOGT.geo.lug=g);
}
/* the tyre: a squared carcass (lathe, axle along y, outer wall +y) and its tread blocks seated INTO the carcass so nothing floats.
   kinds: mt = staggered street blocks; swamp = big staggered square blocks + side-biters; paddle = cupped scoops across a narrow tread */
function bogTyreGeo(r, w, rimR, kind, lite){
  var key="bt"+[r,w,rimR].map(r3).join("_")+kind+(lite?"l":""); if(BOGT.geo[key]) return BOGT.geo[key];
  var hw=w/2, lugH=kind==="paddle"?r*0.13:kind==="swamp"?r*0.078:r*0.058, r0=r-lugH, sh=Math.min(0.06,(r0-rimR)*0.2), i, s;
  var pr=[[rimR+0.006,0.84],[lerp(rimR,r0,0.3),0.97],[lerp(rimR,r0,0.62),1],[lerp(rimR,r0,0.86),0.99],[r0-sh,0.95],[r0-sh*0.15,0.8]], pts=[];
  for(i=0;i<pr.length;i++) pts.push(new THREE.Vector2(pr[i][0], -hw*pr[i][1]));
  for(i=pr.length-1;i>=0;i--) pts.push(new THREE.Vector2(pr[i][0], hw*pr[i][1]));
  var lathe=new THREE.LatheGeometry(pts, lite?24:40), P=lathe.attributes.position, UV=lathe.attributes.uv;
  for(i=0;i<P.count;i++){ var px=P.getX(i), pz=P.getZ(i), rad=Math.sqrt(px*px+pz*pz), y=P.getY(i);
    UV.setY(i, y>hw*0.83 && rad<r0-sh*0.5 ? 0.2+0.6*clamp((rad-rimR)/(r0-sh-rimR),0,1) : 0.95); }
  var parts=[{g:lathe, m:new THREE.Matrix4()}], box=bogtLugBox();
  var rad3=new THREE.Vector3(), tan=new THREE.Vector3(), ax=new THREE.Vector3(0,1,0), d=new THREE.Vector3(), e=new THREE.Vector3(), c=new THREE.Vector3();
  /* a block: angle th, axial centre yc, from radius rb to rt, axial length L, circumferential width cw, twist a */
  function blk(th, yc, rb, rt, L, cw, a){
    rad3.set(Math.sin(th),0,Math.cos(th)); tan.set(Math.cos(th),0,-Math.sin(th));
    d.copy(ax).multiplyScalar(Math.cos(a)).addScaledVector(tan, Math.sin(a)); e.crossVectors(rad3, d).normalize();
    c.copy(rad3).multiplyScalar((rb+rt)/2).addScaledVector(ax, yc);
    var m=new THREE.Matrix4().makeBasis(rad3.clone().multiplyScalar(rt-rb), d.clone().multiplyScalar(L), e.clone().multiplyScalar(cw)); m.setPosition(c);
    parts.push({g:box, m:m}); }
  /* a paddle plate: tilted b off radial towards the tangent, centred at radius rc, shifted t0 along the tangent */
  function plate(th, rc, t0, b, h, L, th2){
    rad3.set(Math.sin(th),0,Math.cos(th)); tan.set(Math.cos(th),0,-Math.sin(th));
    d.copy(rad3).multiplyScalar(Math.cos(b)).addScaledVector(tan, Math.sin(b)); e.crossVectors(d, ax).normalize();
    c.copy(rad3).multiplyScalar(rc).addScaledVector(tan, t0);
    var m=new THREE.Matrix4().makeBasis(d.clone().multiplyScalar(h), ax.clone().multiplyScalar(L), e.clone().multiplyScalar(th2)); m.setPosition(c);
    parts.push({g:box, m:m}); }
  var base=r0-sh-0.004;
  if(kind==="paddle"){
    var n=14; for(i=0;i<n;i++){ var t=i/n*TAU;
      plate(t, (base+r-lugH*0.35)/2, 0, 0, r-lugH*0.35-base, w*0.97, 0.032);                       /* the blade, root sunk into the carcass */
      plate(t, r-lugH*0.22, -0.018, -0.5, lugH*0.36, w*0.97, 0.028);                               /* the cupped lip, curling into the scoop */
      if(!lite) plate(t+0.5/n*TAU*0.18, (base+r0)/2+0.01, 0, 0.0, r0-base, w*0.97, 0.02); }           /* a rib at the root */
  } else if(kind==="swamp"){
    var n2=18, pitch=TAU/n2; for(i=0;i<n2;i++){ var t2=i*pitch;
      for(s=-1;s<=1;s+=2){ var ts=t2+(s>0?0:pitch/2);
        blk(ts, s*hw*0.46, base, r, hw*0.8, 0.13*r/0.56, s*0.2);                                      /* the big square block */
        if(!lite) blk(ts, s*(hw*0.99), r0-lugH*1.9, r0+lugH*0.55, 0.05, 0.1*r/0.56, 0); } }          /* the side-biter down the shoulder */
  } else {
    var n3=lite?20:28, p3=TAU/n3; for(i=0;i<n3;i++){ var t3=i*p3;
      for(s=-1;s<=1;s+=2){ var ts3=t3+(s>0?0:p3/2);
        blk(ts3, s*hw*0.62, base, r, hw*0.6, lite?0.09:0.072, s*0.12);                               /* shoulder block */
        if(!lite || (i&1)) blk(ts3+p3/2, s*hw*0.15, base, r-0.004, hw*0.34, 0.05, -s*0.35);                              /* centre block, staggered */
        if(!lite && (i&1)) blk(ts3, s*(hw*0.985), r0-lugH*1.6, r0+lugH*0.4, 0.035, 0.06, 0); } }
  }
  return (BOGT.geo[key]=mergeGeos(parts));
}
/* wheels: steel (street: black modular, round holes) or beadlock (dish + a bolted ring); Rockwell trucks show the planetary hub */
function bogRimGeo(rimR, w, style, hub, lite){
  var key="br"+[rimR,w].map(r3).join("_")+style+(hub?"h":"")+(lite?"l":""); if(BOGT.geo[key]) return BOGT.geo[key];
  var hw=w/2, i, parts=[], inner=[], M0=function(){ return new THREE.Matrix4(); };
  var s=new THREE.Shape(); s.absarc(0,0,rimR*0.9,0,TAU,false);
  var nh=style==="steel"?8:10, hr=style==="steel"?rimR*0.12:rimR*0.1, hc=rimR*(style==="steel"?0.6:0.64);
  for(i=0;i<nh;i++){ var a=i/nh*TAU, hp=new THREE.Path(); hp.absarc(Math.cos(a)*hc, Math.sin(a)*hc, hr, 0, TAU, true); s.holes.push(hp); }
  if(!hub){ var cb=new THREE.Path(); cb.absarc(0,0,rimR*0.16,0,TAU,true); s.holes.push(cb); }
  var dishY=style==="steel"?hw*0.62:hw*0.5;
  var face=new THREE.ExtrudeGeometry(s, {depth:0.014, bevelEnabled:false, curveSegments:lite?4:6}); face.rotateX(-PI/2); face.translate(0, dishY, 0); parts.push({g:face, m:M0()});
  /* the outer wall from the dish out to the flange */
  parts.push({g:new THREE.LatheGeometry([new THREE.Vector2(rimR*0.88, dishY), new THREE.Vector2(rimR*0.9, hw*0.86), new THREE.Vector2(rimR*1.03, hw*0.9), new THREE.Vector2(rimR*1.05, hw*0.8)], lite?16:28), m:M0()});
  if(style==="bead"){
    parts.push({g:new THREE.LatheGeometry([new THREE.Vector2(rimR*0.9, hw*0.9), new THREE.Vector2(rimR*0.9, hw+0.016), new THREE.Vector2(rimR*1.1, hw+0.016), new THREE.Vector2(rimR*1.12, hw*0.88)], lite?16:32), m:M0()});
    if(!lite){ var bolt=BOGT.geo.bolt||(BOGT.geo.bolt=new THREE.CylinderGeometry(0.009,0.009,0.014,5,1)); for(i=0;i<18;i++){ var b=i/18*TAU; parts.push({g:bolt, m:mkM(Math.cos(b)*rimR*1.0, hw+0.022, Math.sin(b)*rimR*1.0)}); } }
  } else {
    var nut=BOGT.geo.nut||(BOGT.geo.nut=new THREE.CylinderGeometry(0.012,0.012,0.024,6)); for(i=0;i<6;i++){ var b2=i/6*TAU; parts.push({g:nut, m:mkM(Math.cos(b2)*rimR*0.27, dishY+0.022, Math.sin(b2)*rimR*0.27)}); }
    var cap=new THREE.CylinderGeometry(rimR*0.15, rimR*0.17, 0.04, 12); cap.translate(0, dishY+0.03, 0); parts.push({g:cap, m:M0()});
  }
  /* inside: barrel, a dark backing so the wheel doesn't see through, the hub (a Rockwell's planetary dome pokes out of the dish) */
  inner.push({g:new THREE.LatheGeometry([new THREE.Vector2(rimR*0.95, -hw*0.8), new THREE.Vector2(rimR*0.9, hw*0.3), new THREE.Vector2(rimR*0.88, dishY)], 12), m:M0()});
  var back=new THREE.CircleGeometry(rimR*0.9, 14); back.rotateX(-PI/2); back.translate(0, -hw*0.1, 0); inner.push({g:back, m:M0()});
  if(hub){ var hb=new THREE.CylinderGeometry(rimR*0.4, rimR*0.44, hw*0.5+0.06, lite?10:16); hb.translate(0, dishY-hw*0.25+0.04, 0); inner.push({g:hb, m:M0()});
    var dome=new THREE.SphereGeometry(rimR*0.3, lite?8:12, 6, 0, TAU, 0, PI/2); dome.scale(1,0.45,1); dome.translate(0, dishY+0.07, 0); inner.push({g:dome, m:M0()});
    var stud=BOGT.geo.nut||(BOGT.geo.nut=new THREE.CylinderGeometry(0.012,0.012,0.024,6)); for(i=0;i<(lite?0:8);i++){ var b3=i/8*TAU; inner.push({g:stud, m:mkM(Math.cos(b3)*rimR*0.36, dishY+0.07, Math.sin(b3)*rimR*0.36)}); } }
  else { var hb2=new THREE.CylinderGeometry(rimR*0.3, rimR*0.3, hw*0.8, 8, 1, true); hb2.translate(0, hw*0.2, 0); inner.push({g:hb2, m:M0()}); }
  return (BOGT.geo[key]={rim:mergeGeos(parts), inner:mergeGeos(inner)});
}
function bogtWheel(r, w, rimR, kind, side, style, hub, mats, lite){
  var car=new THREE.Group(), spin=new THREE.Group(), cont=new THREE.Group();
  spin.rotation.x=PI/2; cont.rotation.x=side<0?PI:0;
  var ty=new THREE.Mesh(bogTyreGeo(r,w,rimR,kind,lite), mats.tyre); ty.castShadow=true; ty.receiveShadow=true; cont.add(ty);
  var rg=bogRimGeo(rimR, w, style, hub, lite);
  if(lite){ var one=new THREE.Mesh(mergeGeos([{g:rg.rim, m:new THREE.Matrix4()},{g:rg.inner, m:new THREE.Matrix4()}]), mats.rim); cont.add(one); }   /* Lite: rim + hub in one draw */
  else { var rim=new THREE.Mesh(rg.rim, mats.rim), inn=new THREE.Mesh(rg.inner, mats.cast); rim.castShadow=true; cont.add(rim); cont.add(inn); }
  spin.add(cont); car.add(spin); car.userData={spin:spin, r:r, w:w}; return car;
}
function bogtMats(color, spec, cls, kind, dia, wIn, lite){
  var M=sc_mats(), P=pullMats(), num=String(((color>>>0)%89)+11);
  var paint=new THREE.MeshStandardMaterial({color:sc(color), roughness:0.34, metalness:0.12, envMapIntensity:0.8});
  return { paint:paint, black:M.black, satin:M.satin, glass:M.glass, lens:P.lens, tail:P.tail, cast:P.cast, orange:P.orange, white:P.white, suit:P.suit, helmet:P.helmet, alu:M.alu,
    chrome:new THREE.MeshStandardMaterial({color:0xffffff, map:bogtChromeTex(), roughness:0.12, metalness:0.92, envMapIntensity:1.25}),
    tube:new THREE.MeshStandardMaterial({color:sc(cls==="super"?0xb3b8be:0x16171a), roughness:0.36, metalness:cls==="super"?0.7:0.3}),
    rim:new THREE.MeshStandardMaterial({color:sc(spec.rimCol), roughness:spec.rim==="bead"&&cls==="super"?0.18:0.42, metalness:spec.rim==="bead"&&cls==="super"?0.95:0.35}),
    tyre:new THREE.MeshStandardMaterial({color:0xffffff, map:bogtSideTex(cls, kind, dia, wIn, spec.rimIn, lite), roughness:0.9, metalness:0}),
    well:new THREE.MeshStandardMaterial({color:0x0b0b0c, roughness:1, side:THREE.DoubleSide}),
    plate:new THREE.MeshStandardMaterial({color:sc(0xe8e4d6), roughness:0.5, metalness:0.1}),
    decal:pullDecalMat(num), num:num };
}
/* build one truck: cls street|modified|super, tyre mt|swamp|paddle, color, hw (bogTruckHw) */
function bogTruck(cls, tyre, color, hw){
  var spec=BOGT_SPEC[cls]||BOGT_SPEC.street, kind=tyre==="paddle"?"paddle":tyre==="swamp"?"swamp":"mt", lite=GFX==="lite";
  hw=hw||"gN"; var diesel=hw.charAt(0)==="d", asp=hw.charAt(1);
  var dia=bogTyreDia(cls), r=dia*0.0254/2, wIn=spec.w[kind]||12.5, tw=wIn*0.0254, rimR=spec.rimIn*0.0254/2, wb=spec.wb, trR=spec.trk;
  var mats=bogtMats(color, spec, cls, kind, dia, wIn, lite); delete mats.num;
  var g=new THREE.Group(), pivot=new THREE.Group(), body=new THREE.Group(); g.add(pivot); pivot.add(body);
  var bin=sc_bin(), bx=BOGT.geo.box||(BOGT.geo.box=new THREE.BoxGeometry(1,1,1)), cy=BOGT.geo.cyl||(BOGT.geo.cyl=new THREE.CylinderGeometry(0.5,0.5,1,12)),
      cy6=BOGT.geo.cyl6||(BOGT.geo.cyl6=new THREE.CylinderGeometry(0.5,0.5,1,lite?5:7)), sp=BOGT.geo.sph||(BOGT.geo.sph=new THREE.SphereGeometry(0.5,12,8)), i, s;
  function box(m,x,y,z,w,h,d,rx,ry,rz){ bin.add(m, bx, mkM(x,y,z,rx||0,ry||0,rz||0,w,h,d)); }
  function rbox(m,x,y,z,w,h,d,bv,rx,ry,rz){ bin.add(m, sc_rbox(w,h,d,bv), mkM(x,y,z,rx||0,ry||0,rz||0)); }
  function cyl(m,x,y,z,rr,len,rx,ry,rz){ bin.add(m, cy, mkM(x,y,z,rx||0,ry||0,rz||0,2*rr,len,2*rr)); }
  function rod(m,a,c,rr,fine){ var mm=sc_rodM(new THREE.Vector3(a[0],a[1],a[2]), new THREE.Vector3(c[0],c[1],c[2])); mm.multiply(new THREE.Matrix4().makeScale(2*rr,1,2*rr)); bin.add(m, fine?cy:cy6, mm); }
  function sph(m,x,y,z,sx,sy,sz){ bin.add(m, sp, mkM(x,y,z,0,0,0,sx,sy,sz)); }
  function prof(m,pts,d,bv,z){ bin.add(m, sc_prof(pts,d,bv), mkM(0,0,z||0)); }
  function arc(m,x,y,z,rr,w,t0,tl){ var a=new THREE.CylinderGeometry(rr,rr,w,lite?12:20,1,true,t0,tl); a.rotateX(PI/2); bin.add(m, a, mkM(x,y,z)); }
  function archT(ay, R, yb, ext){ var p0=Math.asin(clamp((yb-ay)/R,-1,1))-(ext||0); return [PI/2+p0, PI-2*p0]; }   /* arc() range from where an arch meets the body bottom, over the top */
  function bar(m,a,c,w,d,z){ var dx=c[0]-a[0], dy=c[1]-a[1]; box(m,(a[0]+c[0])/2,(a[1]+c[1])/2,z,Math.sqrt(dx*dx+dy*dy),w,d,0,0,Math.atan2(dy,dx)); }
  /* a side profile from x0 (back) to x1 (front) above yb, wheel arches (centre x, y, radius) cut out of the bottom edge, top given front -> back */
  function body2(x0, x1, yb, arches, top){
    var pts=[[x0,yb]]; arches.slice().sort(function(a,b){ return a[0]-b[0]; }).forEach(function(A){ var dy=yb-A[1]; if(Math.abs(dy)>=A[2]) return;
      var p0=Math.asin(dy/A[2]), n=lite?6:10; for(var q=0;q<=n;q++){ var ph=lerp(PI-p0, p0, q/n); pts.push([A[0]+Math.cos(ph)*A[2], A[1]+Math.sin(ph)*A[2]]); } });
    pts.push([x1,yb]); return pts.concat(top); }
  /* Rockwell-style axle: tube, offset top-loader pumpkin, hub reductions at the ends, the 4-link and coilovers up to the frame */
  function rockwell(ax, fy, front, sgn){
    var half=trR-tw/2-0.05; cyl("cast",ax,r,0,0.085,half*2,PI/2,0,0);
    sph("cast",ax,r-0.03,sgn*0.22,0.46,0.44,0.4); box("cast",ax+(front?-0.12:0.12),r+0.17,sgn*0.22,0.34,0.24,0.3);
    for(s=-1;s<=1;s+=2){ cyl("cast",ax,r,s*(half-0.04),0.16,0.16,PI/2,0,0);
      rod("satin",[ax,r-0.06,s*0.42],[ax+(front?-1:1)*1.05,fy-0.06,s*0.42],0.035); rod("satin",[ax,r+0.1,s*0.2],[ax+(front?-1:1)*0.85,fy,s*0.25],0.03);
      rod("orange",[ax+(front?-0.1:0.1),r+0.12,s*(half-0.32)],[ax+(front?-0.28:0.28),fy+0.42,s*(half-0.42)],0.06);
      rod("chrome",[ax+(front?-0.1:0.1),r+0.06,s*(half-0.32)],[ax+(front?-0.3:0.3),fy+0.5,s*(half-0.43)],0.022); }
    if(front){ rod("satin",[ax+0.16,r+0.16,-half+0.05],[ax+0.16,r+0.16,half-0.05],0.03);
      for(s=-1;s<=1;s+=2) box("satin",ax+0.08,r+0.2,s*(half-0.06),0.3,0.05,0.07);
      rod("chrome",[ax+0.2,r+0.24,-0.35],[ax+0.2,r+0.24,0.3],0.028); }
  }
  function driver(x,y,z){ box("suit",x,y,z,0.32,0.42,0.36); bin.add("helmet", sp, mkM(x+0.05,y+0.33,z,0,0,0,0.27,0.29,0.27)); box("black",x+0.15,y+0.33,z,0.1,0.08,0.24); }
  function doorDecal(x,y,z,w,h){ for(s=-1;s<=1;s+=2){ var dg=new THREE.PlaneGeometry(w,h); if(s<0) dg.rotateY(PI); bin.add("decal", dg, mkM(x,y,s*z)); } }
  var U={kind:"truck", cls:cls, wheelsR:[], wheelsF:[], tips:[], dirs:[], flap:null, pitch:0, pv:0, spinR:0, spinF:0, hw:hw, tyreDia:dia};
  var livSpots, front, top, back;
  if(cls==="street"){
    /* ---- plated square-body short-box, 4" lift, sits low on 35s under the flares ---- */
    var yb=0.8, ar=r+0.075, ay=r+0.02, BW=1.92;
    prof("paint", body2(1.0, 3.84, yb, [[wb,ay,ar]], [[3.86,1.28],[3.8,1.34],[2.5,1.39],[2.44,1.41],[1.0,1.41]]), BW, 0.03);
    prof("paint", body2(-1.18, 1.0, yb, [[0,ay,ar]], [[1.0,1.02],[-1.18,1.02]]), BW, 0.02);
    for(s=-1;s<=1;s+=2){ rbox("paint",-0.09,1.22,s*0.93,2.18,0.4,0.06,0.02); box("black",-0.09,1.425,s*0.93,2.2,0.025,0.08); }
    rbox("paint",0.97,1.22,0,0.06,0.4,1.86,0.02); rbox("paint",-1.16,1.22,0,0.06,0.4,1.86,0.02); box("black",-0.09,1.055,0,2.1,0.02,1.8);
    prof("glass",[[1.08,1.41],[2.42,1.41],[2.17,1.93],[1.13,1.93]],1.74,0);
    rbox("paint",1.66,1.955,0,1.12,0.06,1.82,0.02);
    for(s=-1;s<=1;s+=2){ bar("paint",[2.43,1.41],[2.17,1.94],0.07,0.07,s*0.885); box("paint",1.11,1.67,s*0.885,0.08,0.52,0.07);
      box("black",1.86,1.1,s*0.962,0.012,0.58,0.012); box("black",2.36,1.56,s*1.03,0.06,0.16,0.2); box("chrome",1.65,1.3,s*0.963,0.16,0.025,0.02); }
    /* front: grille, square lamps, chrome bumper with a winch, plates, a snorkel up the right A-pillar */
    box("black",3.86,1.1,0,0.04,0.32,1.5); rbox("chrome",3.87,1.1,0,0.03,0.36,1.58,0.01); for(i=0;i<3;i++) box("chrome",3.885,1.0+i*0.1,0,0.015,0.025,1.0);
    box("lens",3.875,1.12,0.66,0.03,0.17,0.2); box("lens",3.875,1.12,-0.66,0.03,0.17,0.2); box("tail",3.87,0.96,0.72,0.03,0.05,0.14); box("tail",3.87,0.96,-0.72,0.03,0.05,0.14);
    rbox("chrome",3.96,0.8,0,0.14,0.2,1.98,0.03); box("plate",4.035,0.8,0,0.012,0.15,0.3); box("black",4.04,0.8,0,0.006,0.03,0.24);
    box("black",4.0,0.96,0,0.24,0.14,0.62); cyl("satin",4.02,0.98,0,0.06,0.42,PI/2,0,0); box("satin",4.13,0.96,0,0.04,0.08,0.06);
    rod("black",[2.62,1.18,0.975],[2.44,1.95,0.975],0.045,true); rbox("black",2.46,2.0,0.975,0.16,0.12,0.11,0.02);
    /* back: tail lamps, bumper, plate, a tailpipe */
    box("tail",-1.195,1.2,0.86,0.03,0.3,0.1); box("tail",-1.195,1.2,-0.86,0.03,0.3,0.1);
    rbox("chrome",-1.26,0.8,0,0.12,0.18,1.94,0.03); box("plate",-1.325,0.84,0,0.012,0.15,0.3); box("black",-1.33,0.84,0,0.006,0.03,0.24);
    /* flares (tyres tucked under them) and wheel wells */
    var fT=archT(ay,ar+0.03,yb,0.12), wT=archT(ay,ar-0.03,yb,0.1); [0,wb].forEach(function(ax){ for(s=-1;s<=1;s+=2){ arc("black",ax,ay,s*0.985,ar+0.03,0.12,fT[0],fT[1]); arc("well",ax,ay,s*0.8,ar-0.03,0.3,wT[0],wT[1]); } });
    /* frame, leaf springs, solid axles, shocks, driveshafts, transfer case, exhaust */
    for(s=-1;s<=1;s+=2){ box("black",1.35,0.66,s*0.48,4.9,0.16,0.07);
      [0,wb].forEach(function(ax){ box("satin",ax,r+0.1,s*0.48,1.3,0.06,0.07); box("black",ax,r+0.04,s*0.48,0.14,0.12,0.09); rod("orange",[ax+0.14,r-0.02,s*0.58],[ax+0.06,0.72,s*0.56],0.035); }); }
    cyl("cast",0,r,0,0.055,(trR-tw/2)*2,PI/2,0,0); sph("cast",0,r,0.08,0.3,0.3,0.26); cyl("cast",wb,r,0,0.055,(trR-tw/2)*2,PI/2,0,0); sph("cast",wb,r,-0.16,0.28,0.28,0.24);
    rod("satin",[0.12,r,0.08],[1.9,0.62,0.08],0.04,true); rod("satin",[wb-0.12,r,-0.16],[2.15,0.6,-0.1],0.035,true); box("cast",2.05,0.66,0,0.36,0.24,0.3);
    rod("satin",[2.3,0.6,0.32],[-1.0,0.56,0.6],0.03); cyl("chrome",-1.2,0.56,0.6,0.032,0.14,0,0,PI/2);
    U.tips.push(new THREE.Vector3(-1.28,0.56,0.6)); U.dirs.push(new THREE.Vector3(-1,0.15,0).normalize());
    driver(1.55,1.46,-0.42); doorDecal(1.75,1.13,0.962,0.82,0.26);
    livSpots=[{role:"hood", w:0.7, h:0.26, p:[3.2,1.397,0], u:[0,0,-1], v:[-0.999,0.04,0]},
      {role:"side", i:0, w:1.3, h:0.32, p:[-0.1,1.2,0.963], u:[1,0,0], v:[0,1,0]}, {role:"side", i:0, w:1.3, h:0.32, p:[-0.1,1.2,-0.963], u:[-1,0,0], v:[0,1,0]},
      {role:"side", i:1, w:0.62, h:0.22, p:[3.42,1.16,0.963], u:[1,0,0], v:[0,1,0]}, {role:"side", i:1, w:0.62, h:0.22, p:[3.42,1.16,-0.963], u:[-1,0,0], v:[0,1,0]}];
    front=4.14; back=-1.34; top=2.0;
  } else if(cls==="modified"){
    /* ---- the same kind of square-body on a 10" lift: cut fenders, Rockwells, 44s; a big-block's zoomies or a diesel's stacks ---- */
    var yb2=1.14, ar2=r+0.09, ay2=r+0.2, BW2=1.96;
    prof("paint", body2(1.05, 3.98, yb2, [[wb,ay2,ar2]], [[4.0,1.6],[3.94,1.7],[2.56,1.76],[2.5,1.78],[1.05,1.78]]), BW2, 0.03);
    prof("paint", body2(-1.24, 1.05, yb2, [[0,ay2,ar2]], [[1.05,1.44],[-1.24,1.44]]), BW2, 0.02);
    for(s=-1;s<=1;s+=2){ rbox("paint",-0.1,1.61,s*0.95,2.28,0.36,0.06,0.02); box("black",-0.1,1.8,s*0.95,2.3,0.025,0.08); }
    rbox("paint",1.02,1.61,0,0.06,0.36,1.9,0.02); rbox("paint",-1.22,1.61,0,0.06,0.36,1.9,0.02); box("black",-0.1,1.475,0,2.2,0.02,1.84);
    prof("glass",[[1.13,1.78],[2.48,1.78],[2.22,2.3],[1.18,2.3]],1.78,0);
    rbox("paint",1.71,2.325,0,1.12,0.06,1.86,0.02); box("black",1.9,2.4,0,0.2,0.09,1.4); for(i=0;i<5;i++) box("lens",2.005,2.4,-0.56+i*0.28,0.01,0.06,0.2);
    for(s=-1;s<=1;s+=2){ bar("paint",[2.49,1.78],[2.22,2.31],0.07,0.07,s*0.905); box("paint",1.16,2.04,s*0.905,0.08,0.52,0.07);
      box("black",1.91,1.46,s*0.982,0.012,0.6,0.012); box("black",2.42,1.94,s*1.05,0.06,0.16,0.2);
      /* the cut: a pinch-weld trim round each opening */
      [0,wb].forEach(function(ax){ var cT=archT(ay2,ar2+0.005,yb2); arc("black",ax,ay2,s*0.985,ar2+0.005,0.035,cT[0],cT[1]); }); }
    box("glass",1.11,2.05,0,0.02,0.4,1.54);
    /* front: quad lamps, a tube bumper, the hood (scoop / blower / turbo by the build) */
    box("black",4.0,1.42,0,0.04,0.3,1.56); for(i=0;i<3;i++) box("chrome",4.022,1.33+i*0.09,0,0.015,0.025,1.02);
    for(s=-1;s<=1;s+=2){ box("lens",4.02,1.46,s*0.6,0.03,0.12,0.17); box("lens",4.02,1.46,s*0.79,0.03,0.12,0.15); }
    rod("black",[4.12,1.18,-0.95],[4.12,1.18,0.95],0.05,true); rod("black",[4.12,1.32,-0.7],[4.12,1.32,0.7],0.04,true);
    for(s=-1;s<=1;s+=2){ rod("black",[4.12,1.18,s*0.7],[3.92,1.62,s*0.62],0.035); rod("black",[3.95,1.18,s*0.5],[4.12,1.18,s*0.5],0.04); }
    rod("black",[-1.32,1.16,-0.96],[-1.32,1.16,0.96],0.05,true); for(s=-1;s<=1;s+=2) rod("black",[-1.32,1.16,s*0.5],[-1.1,1.12,s*0.5],0.04);
    box("tail",-1.255,1.6,0.88,0.03,0.28,0.1); box("tail",-1.255,1.6,-0.88,0.03,0.28,0.1);
    if(asp==="B"){ box("black",3.2,1.79,0,0.7,0.06,0.52); rbox("alu",3.2,1.92,0,0.62,0.22,0.42,0.03); for(i=0;i<5;i++) box("alu",3.2,2.04,-0.16+i*0.08,0.6,0.03,0.012);
      rbox("chrome",3.12,2.13,0,0.44,0.17,0.32,0.03); box("black",3.35,2.14,0,0.02,0.11,0.26); box("black",3.58,1.88,0,0.1,0.22,0.2); }
    else if(asp==="T"||asp==="C"){ rbox("paint",3.05,1.8,0,1.1,0.08,0.7,0.03); cyl("cast",3.15,1.97,0.22,0.15,0.16,PI/2,0,0); cyl("chrome",3.3,2.0,0.22,0.08,0.18,0,0,PI/2); rod("satin",[3.15,1.97,0.12],[3.0,1.84,-0.1],0.05); }
    else rbox("paint",3.0,1.83,0,1.0,0.13,0.62,0.04), box("black",3.505,1.83,0,0.02,0.08,0.5);
    if(diesel){ for(s=-1;s<=1;s+=2){ cyl("chrome",0.82,2.45,s*0.74,0.07,2.1); bin.add("chrome", cy, mkM(0.82,3.52,s*0.74,0,0,0.5,0.15,0.1,0.15)); box("black",0.86,1.75,s*0.74,0.12,0.06,0.12);
        U.tips.push(new THREE.Vector3(0.82,3.56,s*0.74)); U.dirs.push(new THREE.Vector3(-0.2,1,0).normalize()); } }
    else { for(s=-1;s<=1;s+=2) for(i=0;i<4;i++){ var zx=2.75+i*0.2; rod("chrome",[zx,1.55,s*0.62],[zx-0.2,2.0,s*0.9],0.03,true);
        if(i===1||i===3){ U.tips.push(new THREE.Vector3(zx-0.2,2.02,s*0.9)); U.dirs.push(new THREE.Vector3(-0.3,1,s*0.4).normalize()); } } }
    /* wells behind the cut, frame, Rockwells, driveshafts, transfer case */
    var wT2=archT(ay2,ar2-0.06,yb2,0.25); [0,wb].forEach(function(ax){ for(s=-1;s<=1;s+=2) arc("well",ax,ay2,s*0.8,ar2-0.06,0.34,wT2[0],wT2[1]); });
    for(s=-1;s<=1;s+=2) box("black",1.4,1.05,s*0.5,5.3,0.18,0.08);
    rockwell(0,1.0,false,1); rockwell(wb,1.0,true,-1);
    rod("satin",[0.12,r+0.05,0.22],[2.0,0.98,0.1],0.045,true); rod("satin",[wb-0.12,r+0.05,-0.22],[2.25,0.96,-0.05],0.04,true); box("cast",2.12,1.02,0,0.38,0.26,0.32);
    driver(1.6,1.84,-0.43); doorDecal(1.8,1.5,0.982,0.84,0.27);
    livSpots=[{role:"hood", w:0.66, h:0.24, p:[3.62,1.749,0], u:[0,0,-1], v:[-0.998,0.05,0]},
      {role:"side", i:0, w:1.3, h:0.3, p:[-0.1,1.6,0.983], u:[1,0,0], v:[0,1,0]}, {role:"side", i:0, w:1.3, h:0.3, p:[-0.1,1.6,-0.983], u:[-1,0,0], v:[0,1,0]},
      {role:"side", i:1, w:0.6, h:0.2, p:[3.55,1.56,0.983], u:[1,0,0], v:[0,1,0]}, {role:"side", i:1, w:0.6, h:0.2, p:[3.55,1.56,-0.983], u:[-1,0,0], v:[0,1,0]}];
    front=4.18; back=-1.38; top=diesel?3.56:2.42;
  } else {
    /* ---- Open / Super: tube chassis, chopped fibreglass cab, engine set back, cage, no bed ---- */
    var yl=1.0, yu=1.4, xs=[-0.95,-0.3,0.4,1.55,2.75,3.6];
    for(s=-1;s<=1;s+=2){ rod("tube",[-0.95,yl,s*0.42],[3.7,yl+0.02,s*0.42],0.035); rod("tube",[-0.95,yu,s*0.5],[1.55,yu,s*0.55],0.035); rod("tube",[1.55,yu,s*0.55],[3.6,yu-0.04,s*0.45],0.035);
      for(i=0;i<xs.length;i++){ var xx=xs[i]; rod("tube",[xx,yl,s*0.42],[xx,yu-(xx>2?0.03:0),s*(xx<1.6?(xx<0?0.5:0.53):0.47)],0.03); if(i<xs.length-1) rod("tube",[xx,yl,s*0.42],[xs[i+1],yu,s*0.5],0.026); }
      /* cage: main hoop, A-pillars, roof rails, rear braces, front down-bars over the engine */
      rod("tube",[0.4,yu,s*0.55],[0.42,2.24,s*0.5],0.035); rod("tube",[1.55,yu,s*0.58],[1.12,2.24,s*0.5],0.035); rod("tube",[0.42,2.24,s*0.5],[1.12,2.24,s*0.5],0.035);
      rod("tube",[0.42,2.2,s*0.48],[-0.9,yu+0.02,s*0.46],0.03); rod("tube",[1.3,2.0,s*0.55],[3.55,1.42,s*0.42],0.03); rod("tube",[0.42,1.8,s*0.56],[1.4,1.8,s*0.6],0.028); }
    for(i=0;i<xs.length;i++) rod("tube",[xs[i],yl,-0.42],[xs[i],yl,0.42],0.028);
    rod("tube",[0.42,2.24,-0.5],[0.42,2.24,0.5],0.035); rod("tube",[1.12,2.24,-0.5],[1.12,2.24,0.5],0.035); rod("tube",[0.42,2.22,-0.48],[1.12,2.22,0.48],0.025);
    rod("tube",[-0.95,yu,-0.5],[-0.95,yu,0.5],0.035); rod("tube",[3.65,yl,-0.45],[3.65,yu,0.45],0.025);
    /* chopped fibreglass cab: lower shell, doors with the windows gone, a Lexan screen, roof skin, back wall */
    rbox("paint",0.98,1.62,0,1.18,0.44,1.42,0.04);
    for(s=-1;s<=1;s+=2){ rbox("paint",0.46,1.98,s*0.66,0.14,0.32,0.1,0.02); rbox("paint",1.42,1.92,s*0.66,0.14,0.2,0.1,0.02); }
    rbox("paint",0.78,2.28,0,0.86,0.05,1.3,0.02); bar("glass",[1.56,1.84],[1.14,2.26],0.012,1.24,0); bar("black",[1.56,1.84],[1.14,2.26],0.04,0.04,0.63); bar("black",[1.56,1.84],[1.14,2.26],0.04,0.04,-0.63);
    box("paint",0.39,1.95,0,0.05,0.68,1.3); box("glass",0.37,2.02,0,0.02,0.26,0.9);
    /* nose: a long low fibreglass hood over the set-back engine, narrow so the block and headers show */
    prof("paint",[[1.56,1.84],[1.56,1.42],[3.92,1.36],[3.98,1.5],[3.7,1.6],[2.85,1.72],[1.6,1.86]],1.12,0.03);
    box("black",3.99,1.43,0,0.03,0.12,0.7); box("lens",3.99,1.52,0.38,0.02,0.06,0.12); box("lens",3.99,1.52,-0.38,0.02,0.06,0.12);
    rbox("cast",2.2,1.22,0,0.82,0.36,0.5,0.03); rbox("orange",2.62,1.15,0,0.1,0.28,0.36,0.02);
    var ex=2.0; if(asp==="B"){ box("black",2.15,1.78,0,0.72,0.04,0.46); rbox("alu",2.15,1.9,0,0.66,0.22,0.4,0.03); for(i=0;i<5;i++) box("alu",2.15,2.02,-0.15+i*0.075,0.64,0.03,0.012);
        rbox("chrome",2.08,2.12,0,0.46,0.17,0.32,0.03); box("black",2.32,2.13,0,0.02,0.11,0.26); box("black",2.55,1.86,0,0.1,0.24,0.22); ex=2.0; }
    else if(asp==="T"||asp==="C"){ cyl("cast",2.2,1.98,0.18,0.17,0.17,PI/2,0,0); if(asp==="C") cyl("chrome",2.4,1.98,0.18,0.1,0.22,0,0,PI/2); else cyl("chrome",2.2,2.2,0.18,0.1,0.24); rod("satin",[2.2,1.95,0.06],[2.0,1.78,-0.15],0.06); box("black",2.2,1.78,0,0.7,0.04,0.46); }
    else if(!diesel){ box("black",2.2,1.8,0,0.66,0.05,0.42); for(i=0;i<8;i++) cyl("chrome",1.96+(i>>1)*0.16,1.92,(i&1?1:-1)*0.11,0.045,0.2); }
    if(diesel){ cyl("cast",2.1,1.95,0.18,0.16,0.16,PI/2,0,0); cyl("chrome",1.72,2.55,0.32,0.07,1.5); U.tips.push(new THREE.Vector3(1.72,3.32,0.32)); U.dirs.push(new THREE.Vector3(-0.15,1,0).normalize()); }
    for(s=-1;s<=1;s+=2) for(i=0;i<4;i++){ var hx=1.85+i*0.17; rod("chrome",[hx,1.3,s*0.3],[hx+0.02,1.42,s*0.58],0.028,true); rod("chrome",[hx+0.02,1.42,s*0.58],[hx-0.32,2.05,s*0.66],0.028,true);
      if(!diesel && (i===0||i===2)){ U.tips.push(new THREE.Vector3(hx-0.34,2.08,s*0.66)); U.dirs.push(new THREE.Vector3(-0.45,1,s*0.1).normalize()); } }
    /* back: rear-mount radiator + fan, fuel cell, battery, tube bumper */
    rbox("black",-0.62,1.78,0,0.12,0.6,0.92,0.02,0,0,0.42); cyl("satin",-0.53,1.8,0,0.26,0.1,0,0,PI/2-0.42); box("alu",-0.66,1.78,0,0.02,0.5,0.84,0,0,0.42);
    rbox("alu",-0.3,1.24,0,0.46,0.3,0.62,0.03); box("black",0.15,1.12,-0.25,0.26,0.18,0.18);
    rod("tube",[-1.08,1.12,-0.62],[-1.08,1.12,0.62],0.04); for(s=-1;s<=1;s+=2) rod("tube",[-1.08,1.12,s*0.45],[-0.95,yl,s*0.42],0.03);
    rod("tube",[3.95,1.12,-0.55],[3.95,1.12,0.55],0.04); for(s=-1;s<=1;s+=2) rod("tube",[3.95,1.12,s*0.45],[3.68,yl,s*0.42],0.03);
    rockwell(0,yl,false,1); rockwell(wb,yl,true,-1);
    rod("satin",[0.12,r+0.05,0.22],[1.9,1.08,0.05],0.045,true); rod("satin",[wb-0.12,r+0.05,-0.22],[2.3,1.06,-0.05],0.04,true); box("cast",1.75,1.1,0,0.4,0.24,0.3);
    driver(0.86,1.62,-0.3); doorDecal(0.98,1.6,0.715,0.92,0.3);
    livSpots=[{role:"hood", w:0.56, h:0.22, p:[3.25,1.698,0], u:[0,0,-1], v:[-0.99,0.14,0]},
      {role:"side", i:0, w:0.9, h:0.28, p:[2.75,1.5,0.565], u:[1,0,0], v:[0,1,0]}, {role:"side", i:0, w:0.9, h:0.28, p:[2.75,1.5,-0.565], u:[-1,0,0], v:[0,1,0]}];
    front=4.0; back=-1.12; top=diesel?3.32:2.3;
  }
  /* pivot about the rear axle centre */
  pivot.position.set(0, r, 0); body.position.set(0, -r, 0);
  pullBinTo(bin, body, mats, true);
  var style=spec.rim, hub=cls!=="street";
  for(s=-1;s<=1;s+=2){
    var w1=bogtWheel(r, tw, rimR, kind, s, style, hub, mats, lite); w1.position.set(0, r, s*trR); g.add(w1); U.wheelsR.push(w1.userData.spin);
    var w2=bogtWheel(r, tw, rimR, kind, s, style, hub, mats, lite); w2.position.set(wb, r, s*trR); body.add(w2); U.wheelsF.push(w2.userData.spin);
  }
  U.rr=r; U.rf=r; U.wr=tw; U.trR=trR; U.wb=wb; U.pivot=pivot; U.body=body; U.mats=mats; U.k=1;
  U.hitch=new THREE.Vector3(back,0.7,0); U.front=front; U.back=back; U.mid=wb/2; U.top=top; U.len=front-back; U.width=2*(trR+tw/2); U.maxPitch=0.085; U.bars=null;
  U.livNum=String(((color>>>0)%89)+11); U.livDecal=body.children.filter(function(c){ return c.material===mats.decal; })[0]||null; U.livSpots=livSpots;
  /* blob/contact shadow: four tyre patches and the chassis, on the ground under the truck (placed every frame by bogTruckFrame) */
  var blob=bogtBlob(U); if(blob){ g.add(blob); U.blob=blob; }
  g.userData=U;
  return g;
}
function bogtBlobTex(){
  if(BOGT.tex.blob) return BOGT.tex.blob;
  var c=newCanvas(64,64), x=c.getContext("2d"), gr=x.createRadialGradient(32,32,2,32,32,31);
  gr.addColorStop(0,"rgba(255,255,255,1)"); gr.addColorStop(0.45,"rgba(255,255,255,0.75)"); gr.addColorStop(1,"rgba(255,255,255,0)");
  x.fillStyle=gr; x.fillRect(0,0,64,64); return (BOGT.tex.blob=bogtCanvasTex(c, false));
}
function bogtBlob(U){
  var pl=BOGT.geo.blobPlane||(BOGT.geo.blobPlane=new THREE.PlaneGeometry(1,1).rotateX(-PI/2)), parts=[], s, lite=GFX==="lite";
  [0,U.wb].forEach(function(ax){ for(s=-1;s<=1;s+=2) parts.push({g:pl, m:mkM(ax,0,s*U.trR,0,0,0,U.rr*1.5,1,U.wr*1.9)}); });
  parts.push({g:pl, m:mkM((U.front+U.back)/2,0,0,0,0,0,U.len*1.08,1,U.width*0.95)});
  var m=new THREE.Mesh(mergeGeos(parts), new THREE.MeshBasicMaterial({color:0x000000, map:bogtBlobTex(), transparent:true, opacity:lite?0.62:0.34, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2}));
  m.renderOrder=1; m.userData.lite=lite; return m;
}
/* per frame (from bogUpdate): keep the blob on the ground/mud under the truck, the flagman's flag, the night spots off the run-up */
function bogTruckFrame(V, o, dt){
  var U=V.userData, ph=o.phase||"stage", x=+o.x||0, len=+o.len||70;
  if(U.blob){ var inPit=x>-0.3 && x-U.wb<len+0.3, gy=inPit?-0.05:0.012; U.blob.position.y=gy-V.position.y;
    var lite=GFX==="lite"; if(U.blob.userData.lite!==lite){ U.blob.userData.lite=lite; U.blob.material.opacity=lite?0.62:0.34; }
    U.blob.material.opacity=(lite?0.62:0.34)*clamp(1-Math.max(0,+o.y||0)*1.4,0.25,1); }
  if(BOGT.flagman){ var F=BOGT.flagman;
    if(ph==="stage"){ if(BOGT.startX===null || BOG.prev.phase!=="stage") BOGT.startX=x; }
    var sx=BOGT.startX===null?x:BOGT.startX; F.position.set(sx+5.2, 0, -5.4);
    BOGT.poseT+=dt; var pose=ph==="stage"?((BOGT.poseT%0.7)<0.35?0:1):(ph==="runup"&&x<sx+12?2:3);
    if(pose!==BOGT.pose){ BOGT.pose=pose; F.geometry=F.userData.poses[pose]; } }
  if(BOG.night){ var cxm=BOG.camTgt.x, kk=lerp(0.5,1,clamp((cxm+6)/14,0,1)); BOG.spots.forEach(function(s2){ s2.intensity=1.6*kk; }); BOG.flood.intensity=(GFX==="lite"?0.6:0.28)*lerp(0.7,1,kk); }   /* the light dirt run-up blew out under the poles */
  if(BOG.lip){ var L2=+o.len||(o.pit&&o.pit.len)||70; if(BOG.lip.scale.x!==L2+1){ BOG.lip.scale.x=L2+1; BOG.lip.position.x=(L2+1)/2-0.5; } }
}
/* the pit's lip: a dark wet band along both long edges, over the strip of light ground before the berms and the lifted,
   sun-catching rim of the mud (the bright "seam"); its inner edge fades out into the mud */
function bogLip(S3){
  var pl=new THREE.PlaneGeometry(1,1.25,1,1).rotateX(-PI/2), g=mergeGeos([{g:pl, m:mkM(0,0,BOG_W/2-0.05)},{g:pl, m:mkM(0,0,-BOG_W/2+0.05)}]), P=g.attributes.position, UV=g.attributes.uv;
  for(var i=0;i<P.count;i++) UV.setXY(i, 0.5, clamp((Math.abs(P.getZ(i))-(BOG_W/2-0.68))/0.45,0,1));
  var c=newCanvas(4,64), x=c.getContext("2d"), gr=x.createLinearGradient(0,0,0,64); gr.addColorStop(0,"rgba(36,24,15,1)"); gr.addColorStop(1,"rgba(36,24,15,0)"); x.fillStyle=gr; x.fillRect(0,0,4,64);
  var t=bogtCanvasTex(c); t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
  var m=new THREE.Mesh(g, new THREE.MeshStandardMaterial({color:0xffffff, map:t, transparent:true, depthWrite:false, roughness:0.6, metalness:0, envMapIntensity:0.4, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1}));
  m.position.set(35,-0.006,0); m.scale.x=71; m.receiveShadow=true; m.renderOrder=1; S3.add(m); BOG.lip=m;
}
/* stage framing: the whole truck in frame whatever the aspect (phone portrait canvas is narrow), a slow push in */
function bogFitDist(U, fov){
  var cam=BOG.cam, asp=Math.max(0.3, cam&&cam.aspect||1.4), vf=fov*PI/180, hf=2*Math.atan(Math.tan(vf/2)*asp);
  var R=0.5*Math.sqrt(U.len*U.len+U.width*U.width+U.top*U.top*0.6);
  return R/Math.sin(Math.min(vf,hf)/2)*1.08;
}
/* ---- fairground props: people in the parked pickups' beds, lawn chairs, coolers, flags, a recovery tractor and a skid-steer.
   All into the scene's static batch (no extra draws). The flagman at the start is one mesh with three poses. ---- */
function bogProps(B, S3, lite){
  var K=lite?"solid":"props", rng=function(s){ var t=Math.sin(s*127.1+3.7)*43758.5453; return t-Math.floor(t); }, i, k, x, z;
  var shirts=[0x9c3a30,0x34598f,0xcfccc4,0x1f2023,0xff7a1a,0x44684a,0xc8a640,0x5d5f66,0x8f4a5e,0x2c6b3a], skin=[0xe0b494,0xc68a64,0x8d5a3b,0xf0c9a8,0x5a3a26], jeans=[0x2a3550,0x1f2023,0x4a4a46,0x6b5a40];
  function person(px, py, pz, sitting, s0){
    var sh=shirts[Math.floor(rng(s0)*shirts.length)], sk=skin[Math.floor(rng(s0+1)*skin.length)], jn=jeans[Math.floor(rng(s0+2)*jeans.length)];
    if(sitting){ B.box(K, px, py+0.22, pz, 0.36, 0.14, 0.4, jn); B.box(K, px, py+0.5, pz-0.08, 0.42, 0.5, 0.26, sh); B.box(K, px, py+0.85, pz-0.08, 0.21, 0.24, 0.21, rng(s0+3)<0.4?0x1d4787:sk); B.box(K, px, py+0.08, pz+0.16, 0.3, 0.3, 0.1, jn); }
    else { B.box(K, px, py+0.4, pz, 0.36, 0.8, 0.24, jn); B.box(K, px, py+1.05, pz, 0.44, 0.56, 0.28, sh); B.box(K, px, py+1.46, pz, 0.22, 0.25, 0.22, rng(s0+3)<0.4?0xff7a1a:sk);
      if(rng(s0+4)<0.4) B.box(K, px+0.12, py+1.62, pz-0.12, 0.08, 0.36, 0.08, sk); }   /* an arm up */
  }
  function chair(px, py, pz, col, ry){ B.box(K, px, py+0.24, pz, 0.48, 0.04, 0.46, col, ry); B.box(K, px, py+0.5, pz-0.24, 0.48, 0.5, 0.04, col, ry);
    for(var q=0;q<4;q++) B.box(K, px+(q&1?0.22:-0.22), py+0.12, pz+(q&2?0.2:-0.2), 0.025, 0.24, 0.025, 0xb9bec4); }
  function cooler(px, py, pz, col){ B.box(K, px, py+0.2, pz, 0.62, 0.36, 0.4, col); B.box(K, px, py+0.41, pz, 0.64, 0.06, 0.42, 0xf1ede2); }
  function flag(px, py, pz, h, c1, c2){ B.add(K,"cyl6",[px, py+h/2, pz],[0.04,h,0.04],0xb9bec4); B.box(K, px+0.46, py+h-0.16, pz, 0.88, 0.28, 0.02, c1); B.box(K, px+0.46, py+h-0.44, pz, 0.88, 0.28, 0.02, c2); }
  /* the pickups parked along the top of the bank (same spots as buildBogScene's) */
  var fl=[[0xff7a1a,0x15171b],[0x1d4787,0xf1ede2],[0x9e2a22,0xf1ede2],[0x2c6b3a,0xf2c22c],[0x15171b,0xf2c22c]];
  for(i=0;i<12;i++){ var hx=-26+i*11+rng(i)*4, hz=-BOG_W/2-25-rng(i+3)*4, bedY=1.5;
    var n=lite?(i%2===0?1:0):2+Math.floor(rng(i+20)*3);
    for(k=0;k<n;k++) person(hx-2.3+k*0.62, bedY, hz+(rng(i*7+k)-0.5)*0.9, false, i*13+k);
    if(!lite || i%3===0) flag(hx-2.45, bedY, hz+0.7, 2.6+rng(i+9), fl[i%fl.length][0], fl[i%fl.length][1]);
    /* tailgate party in front of the truck, facing the pit */
    if(!lite){ chair(hx-1.2, 0.6, hz+2.6, i%2?0x2c6b3a:0x34598f, 0); person(hx-1.2, 0.6, hz+2.68, true, i*31); chair(hx-0.3, 0.6, hz+2.7, 0x9e2a22, 0.2); person(hx-0.3, 0.6, hz+2.78, true, i*37);
      cooler(hx+0.6, 0.6, hz+2.6, i%2?0x9e2a22:0x1d4787); }
  }
  /* lawn chairs down the front of the bank, between the standing crowd */
  if(!lite) for(x=-18; x<100; x+=11+rng(x)*6){ var cz=-BOG_W/2-4.2; chair(x, 0.02, cz, [0x2c6b3a,0x1d4787,0x9e2a22,0xc8a640][Math.floor(rng(x+3)*4)], 0); person(x, 0.02, cz+0.08, true, Math.floor(x*7)); if(rng(x+5)<0.5) cooler(x+0.75, 0.02, cz+0.1, rng(x+6)<0.5?0xf1ede2:0x9e2a22); }
  /* the recovery tractor waiting by the far berm, chain on the drawbar, and a skid-steer near the start */
  (function(tx, tz){ var G=0x2f7a2c, Y=0xf2c22c;
    for(var s=-1;s<=1;s+=2){ B.add("solid","cyl",[tx-0.2, 0.85, tz+s*1.0],[1.7,0.62,1.7],0x1a1a1c,[PI/2,0,0]); B.add("solid","cyl",[tx-0.2, 0.85, tz+s*1.32],[0.9,0.04,0.9],Y,[PI/2,0,0]);
      B.add("solid","cyl",[tx+2.35, 0.48, tz+s*0.78],[0.96,0.34,0.96],0x1a1a1c,[PI/2,0,0]); B.add("solid","cyl",[tx+2.35, 0.48, tz+s*0.97],[0.5,0.04,0.5],Y,[PI/2,0,0]);
      B.box("solid", tx-0.2, 1.62, tz+s*0.98, 1.6, 0.06, 0.5, G); }
    B.box("solid", tx+1.4, 1.15, tz, 2.6, 0.75, 0.78, G); B.box("solid", tx+2.65, 1.1, tz, 0.1, 0.6, 0.66, 0x15171b); B.box("solid", tx+0.1, 0.95, tz, 1.0, 0.55, 1.0, 0x2a2c2f);
    B.box("solid", tx-0.25, 2.1, tz, 1.2, 1.3, 1.2, 0x9fb0ba); B.box("solid", tx-0.25, 2.8, tz, 1.4, 0.1, 1.4, Y); B.add("solid","cyl6",[tx+1.0, 2.0, tz+0.3],[0.12,1.2,0.12],0x15171b);
    B.box("solid", tx-1.1, 0.6, tz, 0.5, 0.1, 0.2, 0x15171b); for(var q=0;q<5;q++) B.add("solid","cyl6",[tx-1.4+q*0.06, 0.65-q*0.1, tz+0.1],[0.1,0.05,0.18],0x8d9296,[0,q,PI/2]);
  })(-14, BOG_W/2+10.5);
  (function(sx, sz){ var Y=0xf2c22c;
    for(var q=0;q<4;q++) B.add("solid","cyl",[sx+(q&1?0.55:-0.55), 0.3, sz+(q&2?0.62:-0.62)],[0.6,0.26,0.6],0x1a1a1c,[PI/2,0,0]);
    B.box("solid", sx, 0.75, sz, 1.6, 0.6, 1.1, Y); B.box("solid", sx-0.15, 1.4, sz, 0.9, 0.75, 0.9, 0x2a2c2f); B.box("solid", sx-0.15, 1.8, sz, 1.0, 0.06, 1.0, Y);
    B.box("solid", sx+1.2, 0.35, sz, 0.6, 0.45, 1.5, 0x3a3d42); for(var s=-1;s<=1;s+=2) B.box("solid", sx+0.6, 0.85, sz+s*0.6, 1.1, 0.12, 0.1, Y);
  })(30, BOG_W/2+11.2);
  if(!lite) bogBuild(B,"props", BOG.mats.solid, false);   /* Full/Ultra: the bank props in their own draw, out of the shadow pass */
}
/* the flagman at the start line: green flag up (waving: two poses), flag down the lane on "go", flag lowered */
function bogFlagman(S3){
  var poses=[], mat=BOG.mats.solid, P=sbGeo(), base=[];
  function add(list, g, p, sc3, col, rot){ var m=new THREE.Matrix4(); m.compose(_sbP.set(p[0],p[1],p[2]), _sbQ.setFromEuler(new THREE.Euler(rot?rot[0]:0,rot?rot[1]:0,rot?rot[2]:0)), _sbS.set(sc3[0],sc3[1],sc3[2])); list.push({g:P[g], m:m, c:col}); }
  add(base,"box",[0,0.42,0],[0.24,0.84,0.38],0x1f2023); add(base,"box",[0,1.08,0],[0.28,0.52,0.46],0xf2c22c); add(base,"box",[0,1.08,0],[0.29,0.08,0.47],0xc8cbd0);
  add(base,"box",[0,1.48,0],[0.22,0.25,0.22],0xc68a64); add(base,"box",[0,1.62,0],[0.26,0.07,0.26],0x15171b); add(base,"box",[0,1.08,0.27],[0.09,0.5,0.09],0xf2c22c);
  /* the flag arm (left of him, +z is the lane side) in four poses: up (two waves), pointed down the lane, lowered */
  [[0,0,-0.3],[0,0,0.3],[0,0,1.4],[0,0,2.95]].forEach(function(R){ var L=base.slice(), m0=new THREE.Matrix4().compose(_sbP.set(0,1.3,-0.27), _sbQ.setFromEuler(new THREE.Euler(R[0],R[1],R[2])), _sbS.set(1,1,1)), list=[];
    add(list,"box",[0,0.28,0],[0.09,0.56,0.09],0xf2c22c); add(list,"cyl6",[0,0.95,0],[0.03,0.9,0.03],0x8d9296); add(list,"box",[0.32,1.18,0],[0.62,0.42,0.02],0x2fb24c);
    list.forEach(function(it){ it.m.premultiply(m0); L.push(it); }); poses.push(bogtColGeo(L)); });
  var mesh=new THREE.Mesh(poses[0], mat); mesh.castShadow=GFX!=="lite"; mesh.userData.poses=poses; mesh.rotation.y=PI; S3.add(mesh); BOGT.flagman=mesh; BOGT.pose=0; BOGT.startX=null;
}
function bogtColGeo(items){
  var n=0, i, j; for(i=0;i<items.length;i++) n+=items[i].g.attributes.position.count;
  var pos=new Float32Array(n*3), nor=new Float32Array(n*3), col=new Float32Array(n*3), o=0, nm=new THREE.Matrix3(), v=new THREE.Vector3(), c=new THREE.Color();
  for(i=0;i<items.length;i++){ var it=items[i], P=it.g.attributes.position, N=it.g.attributes.normal; nm.getNormalMatrix(it.m); c.set(it.c).convertSRGBToLinear();
    for(j=0;j<P.count;j++,o++){ v.fromBufferAttribute(P,j).applyMatrix4(it.m); pos[o*3]=v.x; pos[o*3+1]=v.y; pos[o*3+2]=v.z; v.fromBufferAttribute(N,j).applyMatrix3(nm).normalize(); nor[o*3]=v.x; nor[o*3+1]=v.y; nor[o*3+2]=v.z; col[o*3]=c.r; col[o*3+1]=c.g; col[o*3+2]=c.b; } }
  var g=new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos,3)); g.setAttribute("normal", new THREE.BufferAttribute(nor,3)); g.setAttribute("color", new THREE.BufferAttribute(col,3)); g.computeBoundingSphere(); return g;
}
