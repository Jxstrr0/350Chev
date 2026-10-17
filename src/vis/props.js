/* ===========================================================================
   8b. WORKSHOP POLISH (Full / Ultra only): floor details, props, lamps and the workshop light tune.
   Lite never calls any of it, so Lite stays exactly as it was. The garage is built once at boot (while the tier is still
   Lite); this layer is a separate group on top of it, so a tier change only rebuilds the polish, never the room.
   ==========================================================================*/
var SCN=null;
function sceneRng(seed){ var s=seed>>>0; return function(){ s=(s+0x6D2B79F5)>>>0; var t=s; t=Math.imul(t^(t>>>15), t|1); t^=t+Math.imul(t^(t>>>7), t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
function scenePlane(w,h){ var k=gkey("pln",r3(w),r3(h)); if(!GEO[k]) cache(k, new THREE.PlaneGeometry(w,h)); return GEO[k]; }

function sceneMats(){
  if(SCN) return SCN;
  var M={};
  function dec(m, off){ m.depthWrite=false; m.polygonOffset=true; m.polygonOffsetFactor=off; m.polygonOffsetUnits=off; return m; }
  function rep(m){ m.map.wrapS=m.map.wrapT=THREE.RepeatWrapping; return m; }
  /* a saw cut: a dark hairline with a dusty shoulder either side */
  M.sawcut=dec(drawMat(16,8,function(x,w,h){
    var g=x.createLinearGradient(0,0,w,0);
    g.addColorStop(0,"rgba(16,14,11,0)"); g.addColorStop(0.30,"rgba(16,14,11,0.10)"); g.addColorStop(0.44,"rgba(8,7,5,0.92)");
    g.addColorStop(0.56,"rgba(8,7,5,0.92)"); g.addColorStop(0.70,"rgba(16,14,11,0.10)"); g.addColorStop(1,"rgba(16,14,11,0)");
    x.fillStyle=g; x.fillRect(0,0,w,h);
  },{transparent:true, rough:0.95}), -1);
  /* tyre scuffs: paired rubber streaks that fade out */
  M.scuff=dec(drawMat(256,128,function(x,w,h){
    var r=sceneRng(41); x.clearRect(0,0,w,h); x.lineCap="round";
    for(var t=0;t<2;t++){
      var y0=h*(0.34+t*0.30), bend=(r()-0.5)*h*0.5;
      for(var k=0;k<5;k++){
        x.strokeStyle="rgba(10,9,8,"+(0.10+r()*0.16)+")"; x.lineWidth=2+r()*5;
        x.beginPath(); x.moveTo(w*0.04, y0+(r()-0.5)*5); x.quadraticCurveTo(w*0.5, y0+bend+(r()-0.5)*6, w*0.96, y0+bend*1.6+(r()-0.5)*6); x.stroke();
      }
    }
    x.globalCompositeOperation="destination-out";
    for(var i=0;i<260;i++){ x.fillStyle="rgba(0,0,0,"+(0.25+r()*0.6)+")"; x.fillRect(r()*w, r()*h, 2+r()*9, 1+r()*3); }
    var fade=x.createLinearGradient(0,0,w,0); fade.addColorStop(0,"rgba(0,0,0,1)"); fade.addColorStop(0.22,"rgba(0,0,0,0)"); fade.addColorStop(0.78,"rgba(0,0,0,0)"); fade.addColorStop(1,"rgba(0,0,0,1)");
    x.fillStyle=fade; x.fillRect(0,0,w,h);
  },{transparent:true, rough:0.8}), -2);
  /* safety line, worn through to the concrete */
  function wornPaint(rgb, seed){
    return dec(drawMat(512,32,function(x,w,h){
      var r=sceneRng(seed); x.fillStyle=rgb; x.fillRect(0,3,w,h-6);
      x.globalCompositeOperation="destination-out";
      for(var i=0;i<1100;i++){ x.fillStyle="rgba(0,0,0,"+(0.25+r()*0.65)+")"; x.fillRect(r()*w, r()*h, 1+r()*6, 1+r()*2.6); }
      for(i=0;i<9;i++){ x.fillStyle="rgba(0,0,0,"+(0.35+r()*0.45)+")"; x.fillRect(r()*w, 0, 12+r()*70, h); }
    },{transparent:true, rough:0.82}), -3);
  }
  M.worn=wornPaint("rgb(200,154,52)", 7);
  /* the sandbox's painted lines: chipped back to the white tile */
  M.chip=dec(drawMat(512,32,function(x,w,h){
    var r=sceneRng(19); x.clearRect(0,0,w,h);
    for(var i=0;i<520;i++){ x.fillStyle="rgba(214,217,219,"+(0.30+r()*0.6)+")"; x.fillRect(r()*w, r()*h, 1+r()*7, 1+r()*3); }
    for(i=0;i<7;i++){ x.fillStyle="rgba(214,217,219,"+(0.55+r()*0.4)+")"; x.fillRect(r()*w, 0, 8+r()*38, h); }
  },{transparent:true, rough:0.5}), -4);
  /* puddles with a wet sheen: near-black body, low roughness so the room shows in them */
  function puddle(seed, rgb, rough){
    var m=dec(drawMat(256,256,function(x,w,h){
      var r=sceneRng(seed); x.clearRect(0,0,w,h);
      for(var i=0;i<7;i++){
        var cx=w*(0.30+r()*0.40), cy=h*(0.32+r()*0.36), rr=w*(0.11+r()*0.17);
        var g=x.createRadialGradient(cx,cy,rr*0.1,cx,cy,rr);
        g.addColorStop(0,"rgba("+rgb+",0.97)"); g.addColorStop(0.72,"rgba("+rgb+",0.85)"); g.addColorStop(1,"rgba("+rgb+",0)");
        x.fillStyle=g; x.beginPath(); x.arc(cx,cy,rr,0,TAU); x.fill();
      }
    },{transparent:true, rough:rough}), -5);
    m.envMapIntensity=1.5; return m;
  }
  M.puddle=puddle(23,"7,6,5",0.07);
  M.coolant=puddle(29,"20,52,66",0.05);
  /* rubber stall mat: coin studs, with a bump from the same canvas */
  M.rubberMat=rep(drawMat(64,64,function(x,w,h){
    x.fillStyle="rgb(26,27,29)"; x.fillRect(0,0,w,h);
    for(var i=0;i<8;i++) for(var j=0;j<8;j++){
      var g=x.createRadialGradient(i*8+4,j*8+4,0.4,i*8+4,j*8+4,3.4); g.addColorStop(0,"rgb(58,60,63)"); g.addColorStop(1,"rgb(30,31,33)");
      x.fillStyle=g; x.beginPath(); x.arc(i*8+4,j*8+4,3.4,0,TAU); x.fill();
    }
  },{rough:0.9}));
  M.rubberMat.bumpMap=M.rubberMat.map; M.rubberMat.bumpScale=0.7; M.rubberMat.envMapIntensity=0.4;
  /* cardboard parcels */
  M.cardboard=rep(drawMat(64,64,function(x,w,h){
    var r=sceneRng(5); x.fillStyle="rgb(168,130,86)"; x.fillRect(0,0,w,h);
    for(var y=0;y<h;y+=4){ x.fillStyle="rgba(96,70,40,0.16)"; x.fillRect(0,y,w,1); }
    for(var i=0;i<260;i++){ x.fillStyle="rgba("+(r()<0.5?"70,50,28":"210,176,128")+","+(0.08+r()*0.14)+")"; x.fillRect(r()*w, r()*h, 1+r()*2, 1); }
  },{rough:0.92}));
  M.cardboard.envMapIntensity=0.3;
  /* shop rag */
  M.rag=rep(drawMat(32,32,function(x,w,h){
    x.fillStyle="rgb(150,42,32)"; x.fillRect(0,0,w,h);
    for(var i=0;i<w;i+=3){ x.fillStyle="rgba(235,200,180,0.17)"; x.fillRect(i,0,1,h); x.fillRect(0,i,w,1); }
    x.fillStyle="rgba(20,14,8,0.35)"; x.fillRect(w*0.55,h*0.15,w*0.3,h*0.2); x.fillRect(w*0.1,h*0.6,w*0.25,h*0.18);
  },{rough:1.0}));
  M.rag.envMapIntensity=0.15;
  /* plain jug plastics */
  function jug(hex, rough){ return new THREE.MeshStandardMaterial({color:sc(hex), roughness:rough, metalness:0.0, envMapIntensity:0.7}); }
  M.jugAmber=jug(0xd49a36,0.34); M.jugBlue=jug(0x3b78bd,0.4); M.jugWhite=jug(0xe2dfd4,0.45);
  /* warm work lamps */
  M.lampWarm=new THREE.MeshStandardMaterial({color:sc(0xfff0d2), emissive:sc(0xffd7a0), emissiveIntensity:2.5, roughness:0.4});
  M.bulb=new THREE.MeshStandardMaterial({color:sc(0xfff6e0), emissive:sc(0xffcf8a), emissiveIntensity:3.2, roughness:0.4});
  /* light that creeps in under the roll-up door */
  M.doorGlow=new THREE.MeshBasicMaterial({color:0xb9d6ff});
  M.doorSpill=new THREE.MeshBasicMaterial({map:(function(){
    var c=newCanvas(64,64), x=c.getContext("2d"), g=x.createLinearGradient(0,0,0,64);
    g.addColorStop(0,"rgba(190,218,255,0.55)"); g.addColorStop(0.35,"rgba(150,190,240,0.20)"); g.addColorStop(1,"rgba(130,170,230,0)");
    x.fillStyle=g; x.fillRect(0,0,64,64);
    var t=tex(c,true); t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping; return t;
  })(), transparent:true, blending:THREE.AdditiveBlending, depthWrite:false});
  M.doorSpill.polygonOffset=true; M.doorSpill.polygonOffsetFactor=-6; M.doorSpill.polygonOffsetUnits=-6;
  SCN=M; return M;
}
function sceneMap(){
  var M=sceneMats();
  return { sawcut:M.sawcut, scuff:M.scuff, worn:M.worn, chip:M.chip, puddle:M.puddle, coolant:M.coolant, rubberMat:M.rubberMat, cardboard:M.cardboard,
           rag:M.rag, jugAmber:M.jugAmber, jugBlue:M.jugBlue, jugWhite:M.jugWhite, bulb:M.bulb, lampWarm:M.lampWarm };
}

/* ---- the workshop light tune: warm work lamps, a cooler daylight rim from the door. Lite keeps the originals. ---- */
function sceneLights(G, a, tier){
  var warm=(tier!=="lite" && !a.sandbox);
  var wl=G.userData.workLight;
  if(wl && !a.sandbox){ wl.color.setHex(warm?0xffd9a6:0xffe9c8); wl.intensity=warm?0.50:0.42; }
  if(fillLight){
    if(warm){ fillLight.color.setHex(0xffa85a); fillLight.intensity=0.72; fillLight.position.set(-11.9,10.5,10.8); }
    else    { fillLight.color.setHex(0xffb075); fillLight.intensity=0.60; fillLight.position.set(-13,11,11); }
  }
  if(rimLight){
    if(warm){ rimLight.color.setHex(0xa9c9ee); rimLight.intensity=0.92; rimLight.position.set(10,13,-26); }
    else    { rimLight.color.setHex(0x7fa8d8); rimLight.intensity=0.75; rimLight.position.set(-16,12,-20); }
  }
}

function scenePolish(G){
  var a=G.userData.sceneArgs; if(!a) return;
  var old=G.userData.polish;
  if(old){ disposeTree(old); G.remove(old); G.userData.polish=null; }
  var tier=GFX; G.userData.polishTier=tier;
  var lampMesh=null, i;
  for(i=0;i<G.children.length;i++) if(G.children[i].isMesh && G.children[i].name==="lamp") lampMesh=G.children[i];
  var warm=(tier!=="lite" && !a.sandbox);
  if(lampMesh) lampMesh.material = warm ? heatPatch(sceneMats().lampWarm) : MAT.lamp;
  sceneLights(G, a, tier);
  if(tier==="lite") return;

  var M=sceneMats(), mm=sceneMap(), ult=(tier==="ultra");
  var W=a.W, D=a.D, Hh=a.Hh, owned=a.owned, sandbox=a.sandbox;
  var P=new THREE.Group(); P.name="polish"; G.add(P); G.userData.polish=P;
  var S=new Builder();       /* solid floor / prop geometry (casts shadow) */
  var Dc=new Builder();      /* flat decals (no shadow) */
  function flat(key, w, h, x, y, z, rot){ Dc.add(key, scenePlane(w,h), x, y, z, -PI/2, 0, rot||0); }
  function has(k){ return !!owned[k]; }

  /* ---------------- floor details ---------------- */
  if(!sandbox){
    /* saw-cut control joints between the slab's expansion joints */
    for(i=-1;i<=1;i+=2){
      for(var jx=15; jx<W/2-2; jx+=30) flat("sawcut", 0.9, D-1.6, i*jx, 0.035, 0, 0);
      for(var jz=15; jz<D/2-2; jz+=30) flat("sawcut", 0.9, W-1.6, 0, 0.035, i*jz, PI/2);
    }
    /* tyre scuffs: the line a car takes from the door to the stand, and the turn out of the bay */
    var sp=[[W*0.17,-19,0.95,10],[W*0.08,-10.5,0.85,9],[-5,17,0.25,9],[-11,22,-0.35,9]];
    if(ult) sp.push([14,10,-0.6,8],[-17,-7,0.4,8]);
    for(i=0;i<sp.length;i++) flat("scuff", sp[i][3], sp[i][3]*0.5, sp[i][0], 0.045, sp[i][1], sp[i][2]);
    /* worn safety box round the stand */
    var bw=8.4, bd=10.6;
    flat("worn", bw*2+0.6, 0.6, 0, 0.055, -bd, 0);  flat("worn", bw*2+0.6, 0.6, 0, 0.055, bd, PI);
    flat("worn", bd*2+0.6, 0.6, -bw, 0.055, 0, PI/2); flat("worn", bd*2+0.6, 0.6, bw, 0.055, 0, -PI/2);
    /* oil with a sheen */
    flat("puddle", 5.4, 5.4, -8.6, 0.065, 3.0, 0.7);
    flat("puddle", 4.4, 4.4, 6.8, 0.065, -9.0, 2.1);
    if(ult){ flat("puddle", 3.6, 3.6, -3.0, 0.065, -14.5, 4.0); flat("puddle", 5.0, 5.0, -15.5, 0.065, 15.0, 1.2); }
    /* rubber stall mat under the stand */
    S.add("rubberMat", BOX(11.6, 0.10, 14.0, 1/2), 0, 0.05, 0);
    /* trench drain behind the stand */
    var gx=-3.5, gz=-17, gl=16, n=Math.floor(gl/0.9), b;
    S.add("rubberFlat", BOX(gl-0.2, 0.05, 1.7, 1/4), gx, 0.045, gz);
    S.add("steel", BOX(gl+0.6, 0.16, 0.32, 1/3), gx, 0.08, gz-1.0);
    S.add("steel", BOX(gl+0.6, 0.16, 0.32, 1/3), gx, 0.08, gz+1.0);
    for(b=0;b<=n;b++) S.add("steel", BOX(0.34, 0.12, 1.7, 1/3), gx-gl/2+0.2+b*(gl-0.4)/n, 0.11, gz);
  } else {
    /* test cell: the painted lines are chipped, scuffs and a coolant spill on the tile, a floor drain */
    var ln=[[0,-13,W*0.7,0.5,0],[0,13,W*0.7,0.5,0],[-W*0.35,0,26.5,0.5,PI/2],[W*0.35,0,26.5,0.5,PI/2]];
    for(i=0;i<ln.length;i++) flat("chip", ln[i][2], ln[i][3], ln[i][0], 0.095, ln[i][1], ln[i][4]);
    var ss=[[-9,19,0.3,9],[8,-19,-0.5,9]]; if(ult) ss.push([14,18,0.9,8],[-15,-8,-0.2,8]);
    for(i=0;i<ss.length;i++) flat("scuff", ss[i][3], ss[i][3]*0.5, ss[i][0], 0.045, ss[i][1], ss[i][2]);
    flat("coolant", 5.6, 5.6, 10.5, 0.065, 8.5, 0.8);
    if(ult) flat("coolant", 4.2, 4.2, -11, 0.065, -4, 2.2);
    var dgx=-W*0.22, dgz=19;
    S.add("steel", BOX(6.4, 0.14, 6.4, 1/3), dgx, 0.07, dgz);
    S.add("blackPlast", BOX(5.6, 0.05, 5.6, 1/4), dgx, 0.10, dgz);
    for(b=0;b<7;b++) S.add("steel", BOX(5.6, 0.12, 0.3, 1/3), dgx, 0.14, dgz-2.4+b*0.8);
  }

  /* ---------------- props ---------------- */
  /* parts crates + jugs on the back wall, left of the roll-up door */
  function parcel(w,h,d,x,y,z,ry){
    S.push(new THREE.Matrix4().makeRotationY(ry||0).setPosition(x,y,z));
    S.add("cardboard", BOX(w,h,d,1/4), 0,0,0);
    S.add("paintOrange", BOX(w*0.11, h+0.04, d+0.04, 1/4), 0,0,0);
    S.pop();
  }
  function bin(w,h,d,x,y,z,ry,key){
    S.push(new THREE.Matrix4().makeRotationY(ry||0).setPosition(x,y,z));
    S.add(key||"paintBlue", BOX(w,h,d,1/3), 0,0,0);
    S.add(key||"paintBlue", BOX(w+0.3,0.3,d+0.3,1/3), 0,h/2-0.15,0);
    S.add("blackPlast", BOX(w*0.5,0.3,0.1,1/4), 0,h*0.12,d/2+0.02);
    S.pop();
  }
  function jugAt(mk,x,y,z,ry){
    S.push(new THREE.Matrix4().makeRotationY(ry||0).setPosition(x,y,z));
    S.add(mk, BOX(1.7,2.5,1.2,1/3), 0,1.25,0);
    S.add(mk, CYL(0.34,0.5,0.45,10,false,1/3), 0.45,2.7,0);
    S.add("paintOrange", CYL(0.36,0.36,0.26,10,false,1/3), 0.45,3.05,0);
    S.add("blackPlast", BOX(0.22,1.3,0.22,1/4), -0.5,2.35,0);
    S.pop();
  }
  function rag(x,y,z,ry,flap){
    S.push(new THREE.Matrix4().makeRotationY(ry||0).setPosition(x,y,z));
    S.add("rag", BOX(2.2,0.10,1.7,1/2), 0,0.05,0, 0,0.2,0);
    S.add("rag", BOX(1.5,0.10,1.3,1/2), 0.2,0.14,-0.1, 0,-0.5,0);
    if(flap) S.add("rag", BOX(1.9,1.3,0.09,1/2), 0,-0.55,0.82, 0.08,0,0);
    S.pop();
  }
  var ax=W*0.10, az=-D/2+3.4;
  bin(4.6,2.5,3.4, ax, 1.25, az, 0.04, "paintBlue");
  parcel(4.2,2.7,3.2, ax+0.2, 3.85, az+0.1, 0.25);
  parcel(3.6,2.3,2.8, ax+5.6, 1.15, az+0.2, -0.12);
  jugAt("jugAmber", ax-3.4, 0, az+3.7, 0.5);
  jugAt("jugBlue",  ax-1.3, 0, az+4.4, -0.3);
  jugAt("jugWhite", ax+0.9, 0, az+4.0, 0.9);

  if(!sandbox){
    /* oil drum + hand pump and drip tray, along the left wall between the tyres and the tool chest */
    var dx2=-W/2+4.2, dz2=-19.6;
    S.add("blackPlast", BOX(5.4,0.3,5.4,1/4), dx2, 0.15, dz2);
    S.add("paintGrey", CYL(2.1,2.1,7.4,20,false,1.2), dx2, 3.85, dz2);
    S.add("steel", TOR(2.1,0.22,6,20,1.6), dx2, 6.8, dz2, PI/2,0,0);
    S.add("steel", TOR(2.1,0.22,6,20,1.6), dx2, 1.6, dz2, PI/2,0,0);
    S.add("steel", CYL(1.9,1.9,0.14,20,false,1.4), dx2, 7.6, dz2);
    S.add("steel", CYL(0.26,0.26,3.6,8,false,2), dx2+0.8, 9.2, dz2);
    S.add("steel", BOX(2.2,0.26,0.26,1/3), dx2+1.5, 11.0, dz2);
    S.add("blackPlast", BOX(0.5,0.9,0.5,1/3), dx2+2.5, 10.5, dz2);
    /* creeper by the stand */
    S.push(new THREE.Matrix4().makeRotationY(0.55).setPosition(-14.2,0,-4.2));
    S.add("blackPlast", RBOX(8.0,0.36,3.4,0.14,1/4), 0,0.78,0);
    S.add("blackPlast", RBOX(1.8,0.55,3.1,0.2,1/4), -3.3,1.2,0);
    S.add("paintOrange", BOX(7.6,0.26,0.4,1/4), 0,0.5,1.45);
    S.add("paintOrange", BOX(7.6,0.26,0.4,1/4), 0,0.5,-1.45);
    for(i=0;i<6;i++) S.add("rubberFlat", CYL(0.34,0.34,0.3,10,false,2), -3.0+(i%3)*3.0, 0.34, (i<3?1:-1)*1.45, PI/2,0,0);
    S.pop();
    /* tool chest: a top box with a lid seam and a handle, a rag over it */
    var cx=-W/2+7.5;
    S.add("paintOrange", RBOX(6.4,3.0,4.6,0.2,1/6), cx, 14.15, -14);
    S.add("steel", BOX(6.5,0.12,4.7,1/3), cx, 14.7, -14);
    S.add("steel", BOX(2.8,0.2,0.2,1/3), cx, 14.4, -11.62);
    S.add("steel", BOX(0.5,0.35,0.2,1/3), cx-2.4, 14.7, -11.62);
    S.add("steel", BOX(0.5,0.35,0.2,1/3), cx+2.4, 14.7, -11.62);
    rag(cx+1.2, 15.7, -14.4, 0.5, false);
    /* workbench: steel edge trim, a portable toolbox, parts trays, a gooseneck lamp, a rag */
    var bx=W/2-7;
    S.add("steel", BOX(0.2,0.24,26.2,1/3), bx-2.28, 8.62, -8);
    S.push(new THREE.Matrix4().setPosition(bx+0.2,9.05,-4.6));
    S.add("paintOrange", RBOX(2.6,1.6,6.4,0.2,1/6), 0,0.8,0);
    S.add("blackPlast", BOX(2.64,0.12,6.44,1/4), 0,0.95,0);
    S.add("steel", BOX(0.2,0.2,3.4,1/3), 0,2.0,0);
    S.add("steel", BOX(0.2,0.55,0.2,1/3), 0,1.7,-1.6);
    S.add("steel", BOX(0.2,0.55,0.2,1/3), 0,1.7,1.6);
    S.add("steel", BOX(0.18,0.4,0.5,1/3), -1.32,0.95,-2.2);
    S.add("steel", BOX(0.18,0.4,0.5,1/3), -1.32,0.95,2.2);
    S.pop();
    S.add("paintGrey", BOX(1.8,0.7,2.2,1/3), bx+0.3, 9.4, -0.2);
    S.add("paintGrey", BOX(1.8,0.7,2.2,1/3), bx+0.3, 9.4, 2.3);
    S.add("blackPlast", BOX(1.2,0.5,1.2,1/3), bx-0.2, 9.3, 4.2);
    /* gooseneck lamp: a base, two arms and a warm head */
    var gA=[bx+1.1,9.3], d1=[-Math.sin(0.25),Math.cos(0.25)], d2=[-Math.sin(1.15),Math.cos(1.15)], d3=[-Math.sin(2.3),Math.cos(2.3)];
    var gM=[gA[0]+d1[0]*3.4, gA[1]+d1[1]*3.4], gE=[gM[0]+d2[0]*3.0, gM[1]+d2[1]*3.0];
    S.add("steel", CYL(0.6,0.7,0.25,12,false,1.6), bx+1.1, 9.18, -12.5);
    S.add("steel", CYL(0.09,0.09,3.4,8,false,2), gA[0]+d1[0]*1.7, gA[1]+d1[1]*1.7, -12.5, 0,0,0.25);
    S.add("steel", CYL(0.09,0.09,3.0,8,false,2), gM[0]+d2[0]*1.5, gM[1]+d2[1]*1.5, -12.5, 0,0,1.15);
    S.add("paintOrange", CYL(0.9,0.2,1.1,14,true,1.6), gE[0]+d3[0]*0.55, gE[1]+d3[1]*0.55, -12.5, 0,0,2.3);
    S.add("bulb", SPH(0.36,10,1), gE[0]+d3[0]*0.85, gE[1]+d3[1]*0.85, -12.5);
    rag(bx-0.4, 9.1, -15.4, 1.2, false);
    /* shelving: parcels, bins and jugs on the upper levels */
    var sx=W/2-3.4;
    parcel(3.8,2.8,3.6, sx, 15.5, 9.8, 0.05);
    parcel(3.8,3.4,3.2, sx, 15.8, 13.6, -0.08);
    bin(3.8,2.2,5.0, sx, 15.2, 18.4, 1.5708, "paintBlue");
    parcel(3.6,2.6,3.0, sx, 15.4, 22.4, 0.1);
    jugAt("jugAmber", sx, 19.3, 10.2, 1.2);
    jugAt("jugBlue",  sx, 19.3, 13.0, 1.9);
    jugAt("jugWhite", sx, 19.3, 15.8, 1.4);
    parcel(3.8,2.4,3.4, sx, 20.5, 20.8, 0.0);
    /* tripod work lamp: the warm fill light sits in its head */
    var tx0=-12.8, tz0=11.6, yaw=Math.atan2(12.8, -11.6);
    for(i=0;i<3;i++){
      var an=i*TAU/3+0.5, fx=tx0+Math.sin(an)*2.4, fz=tz0+Math.cos(an)*2.4;
      var ddx=tx0-fx, ddy=9.0-0.1, ddz=tz0-fz, dl=Math.sqrt(ddx*ddx+ddy*ddy+ddz*ddz);
      var q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), new THREE.Vector3(ddx/dl,ddy/dl,ddz/dl));
      var eu=new THREE.Euler().setFromQuaternion(q,"XYZ");
      S.add("steel", CYL(0.1,0.1,dl,8,false,2), (fx+tx0)/2, 4.55, (fz+tz0)/2, eu.x, eu.y, eu.z);
    }
    S.add("steel", CYL(0.14,0.14,5.4,8,false,2), tx0, 7.7, tz0);
    S.push(new THREE.Matrix4().makeRotationY(yaw).setPosition(tx0,10.4,tz0));
    S.add("paintOrange", RBOX(2.4,1.8,1.0,0.14,1/4), 0,0,0);
    S.add("bulb", BOX(2.0,1.4,0.1,1/3), 0,0,0.56);
    S.pop();
    /* the supply cable from the stand across the floor to a wall socket (Ultra) */
    if(ult){
      var pts=[new THREE.Vector3(2.4,0.2,-5.2), new THREE.Vector3(6.5,0.2,-9.5), new THREE.Vector3(12,0.2,-14.5), new THREE.Vector3(18.5,0.2,-20), new THREE.Vector3(23.2,0.2,-25.2)];
      S.add("rubberFlat", TUBE(pts, 0.15, 36, 6, false), 0,0,0);
      S.add("rubberFlat", CYL(0.15,0.15,3.1,6,false,2), 23.2, 1.7, -26.0);
      S.add("blackPlast", BOX(1.4,1.8,0.5,1/4), 23.2, 3.4, -27.3);
    }
  } else {
    /* test cell: two parcels and a bin by the instrument rack */
    var rx2=W*0.30+7.6;
    parcel(3.8,2.6,3.0, rx2, 1.3, -22.4, 0.2);
    bin(4.0,2.2,3.0, rx2-0.2, 1.1, -18.6, -0.15, "paintGrey");
    rag(rx2-2, 0.1, -14.6, 0.7, false);
  }

  /* ---------------- lamps: reflector wings, a pair of tubes and end caps on every fixture ---------------- */
  var rows=a.bay>=1 ? 3 : 2;
  if(!sandbox){
    for(var lz2=0; lz2<2; lz2++) for(var lx2=0; lx2<rows; lx2++){
      var X=(lx2-(rows-1)/2)*(W/rows*0.92), Z=-12+lz2*22;
      S.add("lampWarm", CYL(0.15,0.15,12.2,8,false,1), X-0.5, Hh-2.88, Z, PI/2,0,0);
      S.add("lampWarm", CYL(0.15,0.15,12.2,8,false,1), X+0.5, Hh-2.88, Z, PI/2,0,0);
      S.add("panel", BOX(0.7,0.1,12.8,1/8), X-1.5, Hh-2.4, Z, 0,0,0.5);
      S.add("panel", BOX(0.7,0.1,12.8,1/8), X+1.5, Hh-2.4, Z, 0,0,-0.5);
      S.add("panel", BOX(2.9,0.5,0.4,1/8), X, Hh-2.5, Z-6.7);
      S.add("panel", BOX(2.9,0.5,0.4,1/8), X, Hh-2.5, Z+6.7);
    }
    /* daylight leaking in under the roll-up door */
    var doorW=Math.min(26, W*0.36), dxw=W*0.22, dzw=-D/2+1.3;
    var gl2=new THREE.Mesh(new THREE.BoxGeometry(doorW-0.6, 0.3, 0.2), M.doorGlow); gl2.position.set(dxw, 0.2, dzw+0.05); P.add(gl2);
    var sp2=new THREE.Mesh(scenePlane(doorW+3, 9), M.doorSpill); sp2.rotation.x=-PI/2; sp2.position.set(dxw, 0.08, dzw+4.6); sp2.rotation.z=PI; P.add(sp2);
  }

  S.flush(P, mm, true);
  Dc.flush(P, mm, false);
  for(i=0;i<P.children.length;i++) if(P.children[i].isMesh && /^(sawcut|scuff|worn|chip|puddle|coolant)$/.test(P.children[i].name)){ P.children[i].castShadow=false; P.children[i].renderOrder=1; }
}

/* a tier change rebuilds the polish only; the room itself is untouched */
function sceneRetier(){
  if(!garageRoot) return;
  for(var i=0;i<garageRoot.children.length;i++){
    var G=garageRoot.children[i];
    if(G.userData && G.userData.sceneArgs && G.userData.polishTier!==GFX) scenePolish(G);
  }
}
(function(){
  var sq=ENGINE_VIS.setQuality;
  ENGINE_VIS.setQuality=function(q){ var r=sq.apply(this, arguments);
    var go=function(){ try{ sceneRetier(); }catch(e){ if(typeof console!=="undefined") console.warn("scene polish", e); } };
    /* at boot the tier lands before the first frame: keep the polish off the boot-to-first-tap path */
    if(renderer && renderer.info.render.frame<3) setTimeout(go, 1500); else go();
    return r; };
})();
