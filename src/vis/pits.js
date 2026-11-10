/* ===========================================================================
   PITS VIGNETTE — race night, between rounds: your car up on jack stands under
   the hauler's awning (mat, tool cart, floor jack, slicks, crew, work light),
   one fixed camera. ENGINE_VIS.setPits({on, body, color, tyreIn, nightK, heat,
   poke}); {on:false} leaves. On Full and Ultra a few glTF props (PITS_MODELS,
   vis/models.js) stand around the space too. The car is stripCar (geometry shared with the
   strip). Lite draws a frame only when something changed (a still); Full and
   Ultra add hot-tyre smoke and a little crew movement. Built on first use.
   ==========================================================================*/
var PITS_LIFT=0.22, _ptA=new THREE.Vector3(), _ptB=new THREE.Vector3(), _ptC=new THREE.Color();
function pitsBuild(B, key, mat, shadow, into){ var keep=STRIP.scene; STRIP.scene=into; var m=B.build(key, mat, shadow); STRIP.scene=keep; return m; }
function pitsMats(){
  var M=PITS.mats; if(M.solid) return M;
  var env=sc_env();
  M.solid=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.82});
  M.metal=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.38, metalness:0.7}); if(env){ M.metal.envMap=env; M.metal.envMapIntensity=0.5; }
  M.glow=new THREE.MeshBasicMaterial({vertexColors:true, toneMapped:false});
  /* asphalt: speckle and a few old oil stains, tiled */
  var c=newCanvas(256,256), x=c.getContext("2d"), i; x.fillStyle="#2b2c2e"; x.fillRect(0,0,256,256);
  for(i=0;i<2600;i++){ var g=30+Math.random()*40|0; x.fillStyle="rgba("+g+","+g+","+(g+2)+","+(0.35+Math.random()*0.5)+")"; x.fillRect(Math.random()*256, Math.random()*256, 1+Math.random()*2, 1+Math.random()*2); }
  for(i=0;i<5;i++){ var px=Math.random()*256, py=Math.random()*256, r=10+Math.random()*26, gr=x.createRadialGradient(px,py,0,px,py,r); gr.addColorStop(0,"rgba(8,8,10,0.45)"); gr.addColorStop(1,"rgba(8,8,10,0)"); x.fillStyle=gr; x.fillRect(px-r,py-r,2*r,2*r); }
  var t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(30,30); t.encoding=THREE.sRGBEncoding; t.anisotropy=4;
  M.ground=stripMapMat(new THREE.MeshStandardMaterial({map:t, roughness:0.92}), ROAD_GLSL_ASPH, "pits_floor", 0.8);   /* Full / Ultra: world-space grain, cracks, patches and a macro tint over the 5 m tile */
  /* the hauler's side: the shop's colours and name */
  c=newCanvas(1024,256); x=c.getContext("2d"); var gg=x.createLinearGradient(0,0,0,256); gg.addColorStop(0,"#25303f"); gg.addColorStop(1,"#141a23"); x.fillStyle=gg; x.fillRect(0,0,1024,256);
  x.fillStyle="#e5562b"; x.beginPath(); x.moveTo(0,212); x.bezierCurveTo(300,204,620,190,1024,180); x.lineTo(1024,200); x.bezierCurveTo(620,210,300,224,0,234); x.fill();
  x.fillStyle="#f2a33a"; x.beginPath(); x.moveTo(0,242); x.bezierCurveTo(320,236,620,222,1024,208); x.lineTo(1024,214); x.bezierCurveTo(620,228,320,242,0,248); x.fill();
  x.fillStyle="#f4efe2"; x.font="bold 64px 'Chakra Petch','Barlow Condensed','Arial Narrow',sans-serif"; x.fillText("PRAIRIE ENGINE WORKS",40,146);
  x.fillStyle="#9fb0c4"; x.font="600 26px 'Barlow Condensed','Arial Narrow',sans-serif"; x.fillText("RACE ENGINES · DYNO · DRAG",44,182);
  x.strokeStyle="rgba(255,255,255,0.18)"; x.lineWidth=3; x.strokeRect(842,30,120,206);   /* side door */
  t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=4;
  M.side=new THREE.MeshStandardMaterial({map:t, roughness:0.45, metalness:0.15}); if(env){ M.side.envMap=env; M.side.envMapIntensity=0.35; }
  return M;
}
/* sky: a vertical gradient, dusk (k 0) to full dark (k 1); returns the horizon colour (sRGB) for the fog */
function pitsSky(k){
  var mix=function(a,b){ return new THREE.Color(a).lerp(new THREE.Color(b), k); };
  var top=mix(0x2a2f55,0x04060b), mid=mix(0x8a5266,0x0b1018), hor=mix(0xe9853f,0x1a212e);   /* fix pack: Q1 (k 0) is a warm sunset, not a cold blue */
  if(!PITS.bg){ var c=newCanvas(4,256); PITS.bg=new THREE.CanvasTexture(c); PITS.bg.encoding=THREE.sRGBEncoding; }
  var x=PITS.bg.image.getContext("2d"), g=x.createLinearGradient(0,0,0,256);
  g.addColorStop(0,"#"+top.getHexString()); g.addColorStop(0.55,"#"+mid.getHexString()); g.addColorStop(0.82,"#"+hor.getHexString()); g.addColorStop(1,"#"+hor.getHexString());
  x.fillStyle=g; x.fillRect(0,0,4,256); PITS.bg.needsUpdate=true; return hor;
}
/* a crew member: legs + upper body (pivot at the hips) as two vertex-coloured batches; pose "kneel" or "lean". Faces -z. Rounded limbs (tapered
   tubes with ball joints), gloves, work boots, a team shirt with a contrast stripe, collar and cuffs, and a cap. The joints for each pose are in PITS_POSE */
var PITS_POSE={
  lean:{ hip:0.92, lean0:-0.55,
    legs:[[[-0.1,0.92,0],[-0.115,0.5,-0.03],[-0.13,0.11,0]], [[0.1,0.92,0],[0.115,0.5,-0.03],[0.13,0.11,0]]],
    arms:[[[-0.2,0.44,0],[-0.24,0.22,-0.15],[-0.19,0.11,-0.38]], [[0.2,0.44,0],[0.24,0.22,-0.15],[0.19,0.11,-0.38]]] },
  kneel:{ hip:0.52, lean0:-0.18,
    legs:[[[-0.11,0.52,0],[-0.12,0.52,-0.42],[-0.12,0.11,-0.38]], [[0.11,0.52,0],[0.12,0.08,0.05],[0.12,0.09,0.46],[0.12,0.03,0.66]]],
    arms:[[[-0.2,0.44,0],[-0.25,0.21,-0.1],[-0.13,0.23,-0.35]], [[0.2,0.44,0],[0.25,0.2,-0.12],[0.12,0.2,-0.38]]], gauge:true } };
var _pcY=new THREE.Vector3(0,1,0), _pcD=new THREE.Vector3(), _pcQ=new THREE.Quaternion(), _pcE=new THREE.Euler();
/* a tube from a to b (narrower at b), radius r at a */
function pitsLimb(S, a, b, r, col, g){
  _pcD.set(b[0]-a[0], b[1]-a[1], b[2]-a[2]); var l=_pcD.length(); _pcQ.setFromUnitVectors(_pcY, _pcD.multiplyScalar(1/l)); _pcE.setFromQuaternion(_pcQ);
  S.add("s", g||"taper", [(a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2], [2*r, l, 2*r], col, [_pcE.x, _pcE.y, _pcE.z]);
}
function pitsBall(S, p, r, col, sx, sy, sz){ S.add("s", "sph", p, [2*r*(sx||1), 2*r*(sy||1), 2*r*(sz||1)], col); }
function pitsLerp(a, b, t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
function pitsPerson(shirt, pose, trim){
  var M=pitsMats(), G=new THREE.Group(), up=new THREE.Group(), P=PITS_POSE[pose]||PITS_POSE.lean, i;
  var PANTS=0x2b3442, SKIN=0xc39274, CAP=0x15171b, BOOT=0x2a2018, SOLE=0x111111, GLOVE=0x26282c, TRIM=trim||0xf4efe2;
  var L=new StripBatch(), U=new StripBatch(), hip=P.hip;
  /* legs: seat, thighs, knees, shins, boots (a planted foot points forward; a kneeling one has its toe tucked under, behind) */
  pitsBall(L, [0, hip-0.02, 0.01], 0.17, PANTS, 1.05, 0.62, 0.72);
  L.box("s", 0.095, hip-0.11, 0.115, 0.08, 0.13, 0.012, 0xb3261e);   /* the rag in the back pocket */
  for(i=0;i<2;i++){ var g=P.legs[i], hp=g[0], kn=g[1], an=g[2];
    pitsLimb(L, hp, kn, 0.085, PANTS); pitsBall(L, kn, 0.07, PANTS); pitsLimb(L, kn, an, 0.068, PANTS);
    if(g[3]){ pitsBall(L, kn, 0.075, 0x3a3f46, 1, 0.8, 1); pitsLimb(L, an, g[3], 0.06, BOOT, "box"); pitsBall(L, g[3], 0.058, SOLE, 1, 0.8, 1); }
    else { var ax=an[0], az=an[2];
      L.add("s", "cyl", [ax, an[1]+0.02, az], [0.13, 0.1, 0.13], BOOT); L.box("s", ax, 0.075, az-0.04, 0.115, 0.1, 0.2, BOOT);
      pitsBall(L, [ax, 0.07, az-0.14], 0.06, BOOT, 1, 0.85, 1.25); L.box("s", ax, 0.02, az-0.05, 0.125, 0.04, 0.3, SOLE); } }
  /* upper body: belt, torso widening to the shoulders, stripe, collar, name patch, neck, head, cap */
  U.add("s", "cyl", [0, 0.02, 0], [0.345, 0.06, 0.215], 0x1c1c1c); U.box("s", 0, 0.02, -0.108, 0.05, 0.04, 0.012, 0x9a9ea4);
  U.add("s", "taper", [0, 0.25, 0], [0.36, 0.44, 0.22], shirt, [0, 0, PI]); pitsBall(U, [0, 0.44, 0], 0.22, shirt, 1, 0.45, 0.55);
  U.add("s", "cyl", [0, 0.32, 0], [0.37, 0.05, 0.228], TRIM); U.add("s", "cyl", [0, 0.53, 0], [0.15, 0.04, 0.13], TRIM);
  U.box("s", 0.075, 0.4, -0.118, 0.08, 0.035, 0.01, 0xf4efe2);
  U.add("s", "cyl", [0, 0.58, 0], [0.1, 0.1, 0.1], SKIN);
  pitsBall(U, [0, 0.705, 0], 0.11, SKIN, 0.86, 1.04, 0.95); pitsBall(U, [0, 0.69, -0.105], 0.02, SKIN, 0.9, 1.3, 1);
  pitsBall(U, [-0.094, 0.7, 0.01], 0.022, SKIN, 0.6, 1.1, 0.9); pitsBall(U, [0.094, 0.7, 0.01], 0.022, SKIN, 0.6, 1.1, 0.9);
  pitsBall(U, [0, 0.765, 0.005], 0.104, CAP, 1, 0.68, 1.06); U.add("s", "box", [0, 0.765, -0.14], [0.17, 0.016, 0.12], CAP, [-0.12, 0, 0]);
  pitsBall(U, [0, 0.8, -0.098], 0.016, TRIM, 1, 1, 0.5);   /* the cap badge */
  /* arms: short sleeves with a cuff, bare forearms, gloves */
  for(i=0;i<2;i++){ var a=P.arms[i], sh=a[0], el=a[1], wr=a[2], mid=pitsLerp(sh, el, 0.55);
    pitsBall(U, sh, 0.07, shirt); pitsLimb(U, sh, mid, 0.064, shirt, "cyl"); pitsLimb(U, pitsLerp(sh, el, 0.5), pitsLerp(sh, el, 0.6), 0.067, TRIM, "cyl");
    pitsLimb(U, mid, el, 0.047, SKIN); pitsBall(U, el, 0.042, SKIN); pitsLimb(U, el, wr, 0.043, SKIN);
    var hd=pitsLerp(el, wr, 1.18); pitsBall(U, hd, 0.045, GLOVE, 0.9, 0.75, 1.35); pitsLimb(U, pitsLerp(el, wr, 0.92), pitsLerp(el, wr, 1.02), 0.047, GLOVE, "cyl"); }
  if(P.gauge){ var w=P.arms[1][2], e=P.arms[1][1], gp=pitsLerp(e, w, 1.3);   /* the tyre gauge in his right hand */
    U.add("s", "cyl", [gp[0], gp[1]+0.03, gp[2]], [0.07, 0.025, 0.07], 0xd8d6cc, [PI/2-0.3, 0, 0]); pitsLimb(U, gp, pitsLerp(e, w, 1.6), 0.008, 0x9a9ea4, "cyl"); }
  pitsBuild(L, "s", M.solid, true, G); up.position.y=hip; pitsBuild(U, "s", M.solid, true, up); G.add(up);
  G.userData={up:up, pose:pose, lean0:P.lean0, ph:Math.random()*6};
  up.rotation.x=G.userData.lean0; return G;
}
function buildPitsScene(){
  var S5=new THREE.Scene(); PITS.scene=S5; PITS.tier=GFX; var M=pitsMats(), B=new StripBatch(), i, k;
  S5.background=PITS.bg||null; S5.fog=new THREE.Fog(0x1a212e, 22, 95);
  PITS.hemi=new THREE.HemisphereLight(0x8090b0, 0x2a241c, 0.4); S5.add(PITS.hemi);
  var moon=new THREE.DirectionalLight(0x9fb4d8, 0.35); moon.position.set(-20,30,-25); S5.add(moon); PITS.moon=moon;
  PITS.lamp=new THREE.PointLight(0xffd9a8, 1.5, 15, 2); PITS.lamp.position.set(0, 2.85, 0.2); S5.add(PITS.lamp);
  var sp=new THREE.SpotLight(0xfff1dc, 2.9, 24, 0.62, 0.55, 1.4); sp.castShadow=true; var ms=GFX==="ultra"?2048:1024; sp.shadow.mapSize.set(ms,ms); sp.shadow.bias=-0.0008; sp.shadow.normalBias=0.02;
  sp.shadow.camera.near=0.5; sp.shadow.camera.far=24; S5.add(sp); S5.add(sp.target); PITS.spot=sp;
  var ground=new THREE.Mesh(new THREE.PlaneGeometry(160,160), M.ground); ground.rotation.x=-PI/2; ground.receiveShadow=true; S5.add(ground);
  /* the hauler: box on its wheels, the graphics on the side facing the car, the awning out over the pit space */
  var TX0=-7.5, TX1=7.5, TZ=-3.6;
  B.box("solid", 0, 2.15, TZ-1.25, TX1-TX0, 3.6, 2.5, 0x1b222c); B.box("metal", 0, 0.34, TZ-1.25, TX1-TX0-0.3, 0.12, 2.3, 0x3a3e44);
  for(k=0;k<3;k++){ B.add("solid","cyl",[-5.2+k*1.05, 0.42, TZ-0.05],[0.84,0.3,0.84],0x141414,[PI/2,0,0]); B.add("metal","cyl",[-5.2+k*1.05, 0.42, TZ+0.06],[0.46,0.04,0.46],0x9a9ea4,[PI/2,0,0]); }
  B.box("metal", 0, 3.98, TZ-1.25, TX1-TX0+0.05, 0.08, 2.56, 0x8d9298);
  var side=new THREE.Mesh(new THREE.PlaneGeometry(TX1-TX0-0.2, 3.4), M.side); side.position.set(0, 2.17, TZ+0.012); S5.add(side);
  var aw=new THREE.Mesh(new THREE.PlaneGeometry(11.2, 6.1), sc_mats().canopy); aw.position.set(0, 3.42, TZ+3.0); aw.rotation.set(-PI/2+0.115, 0, 0); aw.receiveShadow=true; S5.add(aw);
  B.box("solid", 0, 2.96, 2.38, 11.2, 0.26, 0.03, 0xe5562b);
  for(k=-1;k<=1;k+=2) B.add("metal","cyl",[k*5.5, 1.5, 2.38],[0.07,3.0,0.07],0xb9bec4);
  for(i=0;i<17;i++){ B.box("glow", -5.2+i*0.65, 2.78+0.05*Math.sin(i*1.7), 2.36, 0.07, 0.09, 0.07, 0xffc87a); }   /* string lights along the valance */
  /* the next pit spaces over and the strip's light poles, far off in the dark */
  [[-24,-8,0x2a3340],[22,-10,0x3a2a2a],[-40,-20,0x262c33],[42,-26,0x30343a],[8,-34,0x2c3038]].forEach(function(h){
    B.box("solid", h[0], 1.9, h[1], 12, 3.2, 2.5, h[2]); B.box("solid", h[0], 3.3, h[1]+2.6, 9, 0.08, 4.5, 0x4d5560);
    for(var q=0;q<10;q++) B.box("glow", h[0]-4.2+q*0.95, 3.1, h[1]+4.8, 0.08, 0.08, 0.08, 0xffd9a0); });
  for(i=0;i<7;i++){ var lx=-60+i*20, lz=-55-((i*37)%11); B.box("metal", lx, 9, lz, 0.3, 18, 0.3, 0x4a4e54); B.box("glow", lx, 18.2, lz+0.3, 2.2, 0.8, 0.2, 0xfff1d6); }
  pitsBuild(B, "solid", M.solid, true, S5); pitsBuild(B, "metal", M.metal, true, S5); pitsBuild(B, "glow", M.glow, false, S5);
  PITS.props=new THREE.Group(); S5.add(PITS.props);
  if(GFX!=="lite"){ PITS.fx=new StripFx(GFX==="ultra"?90:60, "smoke", stripPuffTex()); PITS.fx.mat.uniforms.uAmb.value=0.5; PITS.fx.mat.uniforms.uFogN.value=22; PITS.fx.mat.uniforms.uFogF.value=95; S5.add(PITS.fx.mesh); }
  PITS.cam=new THREE.PerspectiveCamera(42, 1, 0.2, 400);
  PITS.built=true;
}
/* everything that sits around the car: rebuilt when the car (body / tyre) changes */
function pitsProps(car){
  var u=car.userData, me=u.meta, G=PITS.props, M=pitsMats(), B=new StripBatch(), i, k, F=PITS.fit;
  while(G.children.length){ var ch=G.children[0]; G.remove(ch); if(ch.geometry) ch.geometry.dispose(); else ch.traverse(function(q){ if(q.geometry) q.geometry.dispose(); }); }
  PITS.crew=[];
  var bb=new THREE.Box3(); car.children.forEach(function(c){ if(c!==u.chute) bb.expandByObject(c); });
  var ox=car.position.x, L=u._len||4.6, hw=Math.max(0.5,bb.max.z), H=bb.max.y-PITS_LIFT;
  var rearX=u._tyres[0].x+ox, rearZ=u._tyres[0].z, rr=u.rr||0.35, frontX=rearX, frontZ=hw*0.8, frontR=rr;
  (me.wheels||[]).forEach(function(w){ if(w.x+ox>frontX){ frontX=w.x+ox; frontZ=Math.abs(w.z); frontR=w.r; } });
  /* r13: how tall the car is over its last and first 1.2 m (the wing over the slicks, the nose), for the camera fit: one pass over the vertices when the car changes */
  var hR=0, hF=0; car.traverse(function(m){ if(!m.isMesh||!m.geometry||m.visible===false) return; for(var o=m; o; o=o.parent) if(o===u.chute) return;
    var pa=m.geometry.attributes.position; if(!pa) return; m.updateWorldMatrix(true,false); var e=m.matrixWorld.elements, st=pa.count>40000?3:1;
    for(var q=0;q<pa.count;q+=st){ var px=pa.getX(q), py=pa.getY(q), pz=pa.getZ(q), wx=e[0]*px+e[4]*py+e[8]*pz+e[12], wy=e[1]*px+e[5]*py+e[9]*pz+e[13];
      if(wx<bb.min.x+1.2){ if(wy>hR) hR=wy; } else if(wx>bb.max.x-1.2){ if(wy>hF) hF=wy; } } });
  F.hR=Math.max(hR,0.6+PITS_LIFT)-PITS_LIFT; F.hF=Math.max(hF,0.4+PITS_LIFT)-PITS_LIFT;
  F.L=L; F.hw=hw; F.H=H; F.rearX=rearX; F.rearZ=rearZ; F.rr=rr; F.frontX=frontX; F.tw=u._tyreW||0.35; F.x0=bb.min.x; F.x1=bb.max.x;
  var x0=bb.min.x, x1=bb.max.x, RED=0xb3261e, STAND=0xd2471f;
  B.box("solid", (x0+x1)/2, 0.006, 0, L+1.8, 0.012, 2*hw+1.4, 0x232528);   /* the pit mat */
  /* jack stands under the frame, just inboard of each axle */
  /* fix pack: out near the sills where the camera sees them, tall enough to meet the frame (the car is PITS_LIFT up, wheels hanging) */
  var rail=u.body==="rail", top=PITS_LIFT+(rail?0.2:0.15);
  [[rearX+rr*0.9, rearZ*0.62],[frontX-frontR*0.9, frontZ*0.62]].forEach(function(p){ for(var s=-1;s<=1;s+=2){ var sx=p[0], sz=s*(rail?Math.max(0.28,p[1]):Math.max(0.28,hw-0.34));
    B.add("metal","cone",[sx, 0.16, sz],[0.42,0.32,0.42],STAND,[0,PI/4,0]); B.add("metal","cyl",[sx, (0.3+top)/2, sz],[0.055,top-0.3+0.04,0.055],0xb9bec4);
    B.box("metal", sx, top-0.015, sz, 0.16, 0.03, 0.1, STAND); B.box("solid", sx, 0.014, sz, 0.5, 0.004, 0.5, 0x161719); } });
  /* floor jack behind the car, handle up */
  /* r8: well back and to the far side, so it no longer sits in the line of sight to the wheelie bars (x0 already includes the bars) */
  var jx=x0-1.5, jz=-0.55;
  B.box("metal", jx-0.35, 0.09, jz, 0.9, 0.12, 0.34, RED); B.add("metal","cyl",[jx-1.0, 0.55, jz],[0.05,1.1,0.05],0x9a9ea4,[0,0,0.9]);
  for(k=0;k<4;k++) B.add("solid","cyl",[jx-0.0-(k>>1)*0.7, 0.05, jz+((k&1)?0.16:-0.16)],[0.1,0.05,0.1],0x111111,[PI/2,0,0]);
  /* tool cart: red, drawers, a tray of tools, on casters */
  var cx=x0-1.55, cz=1.55;
  B.box("metal", cx, 0.62, cz, 1.05, 0.95, 0.55, RED); B.box("metal", cx, 1.11, cz, 1.09, 0.04, 0.59, 0x8d9298);
  for(k=0;k<5;k++) B.box("solid", cx, 0.3+k*0.17, cz+0.28, 0.98, 0.012, 0.012, 0x3a0c08);
  for(k=0;k<5;k++) B.box("metal", cx, 0.36+k*0.17, cz+0.285, 0.5, 0.02, 0.02, 0xd8dce0);
  for(k=0;k<4;k++) B.box("solid", cx+((k&1)?0.42:-0.42), 0.07, cz+((k>>1)?0.2:-0.2), 0.07, 0.14, 0.07, 0x141414);
  B.box("metal", cx-0.2, 1.16, cz, 0.36, 0.06, 0.08, 0xc9ced4); B.box("solid", cx+0.22, 1.17, cz+0.05, 0.22, 0.08, 0.14, 0x1d4787); B.box("metal", cx+0.05, 1.15, cz-0.12, 0.4, 0.02, 0.03, 0xb0b5bb);
  /* two spare slicks leaning on the hauler, a fuel jug and a cooler */
  var sx2=x1+0.9; B.add("solid","cyl",[sx2, 0.42, -2.9],[0.84,0.36,0.84],0x18181a,[PI/2-0.25,0,0]); B.add("solid","cyl",[sx2+0.75, 0.42, -2.95],[0.84,0.36,0.84],0x18181a,[PI/2-0.22,0,0]);
  B.box("solid", x1+2.0, 0.24, -2.6, 0.26, 0.48, 0.26, 0xb7261d); B.box("solid", x0-0.2, 0.23, -2.7, 0.7, 0.46, 0.42, 0xe8e6e0); B.box("solid", x0-0.2, 0.47, -2.7, 0.72, 0.05, 0.44, 0x1d4787);
  /* work light on a tripod, front corner, aimed at the car */
  var wx=x1+1.15, wz=2.1; for(k=0;k<3;k++){ var a=k/3*TAU; B.add("metal","cyl",[wx+Math.cos(a)*0.25, 0.42, wz+Math.sin(a)*0.25],[0.035,0.9,0.035],0x2a2c30,[Math.sin(a)*0.28,0,-Math.cos(a)*0.28]); }
  B.add("metal","cyl",[wx, 1.3, wz],[0.04,1.2,0.04],0x2a2c30); B.box("metal", wx, 1.95, wz, 0.42, 0.3, 0.14, 0xf2b61f, -0.75);
  B.box("glow", wx-0.05, 1.95, wz-0.06, 0.36, 0.24, 0.04, 0xfff6e2, -0.75);
  pitsBuild(B, "solid", M.solid, true, G); pitsBuild(B, "metal", M.metal, true, G); pitsBuild(B, "glow", M.glow, false, G);
  PITS.spot.position.set(wx-0.1, 1.95, wz-0.05); PITS.spot.target.position.set((x0+x1)/2-0.4, 0.4, 0); PITS.spot.target.updateMatrixWorld();
  /* crew: one on the rear tyre with the gauge, one leaning into the engine bay */
  var A=pitsPerson(0xe5562b, "kneel", 0x22262c); A.position.set(rearX+0.05, 0, -(rearZ+F.tw*0.5+0.62)); A.rotation.y=PI+0.12;   /* r8: far side of the rear tyre: on the near side he stood in front of the rear wheel and the bars */
   G.add(A); A.userData.key="psi";
  var eng=u._eng.clone(); eng.x+=ox; var Bm=pitsPerson(0x22262c, "lean", 0xe5562b); G.add(Bm); Bm.userData.key="launch";
  if(u.body==="rail"){ Bm.position.set(eng.x, 0, -(hw+0.42)); Bm.rotation.y=PI-0.08; } else { Bm.position.set(x1+0.42, 0, 0.3); Bm.rotation.y=PI/2; }   /* over the motor: alongside a rail, over the nose of a car */
  PITS.crew=[A, Bm];
  pitsModels();
}
/* glTF props around the pit space, Full / Ultra (vis/models.js): [key, anchor, dx, y, z, turn, tilt]. anchor "r" counts dx from the car's
   rear end (wheelie bars included), "f" from its nose, "" from the middle of the awning, so a long dragster never parks on one */
var PITS_MODELS=[
  ["generator","r",-3.4,0,-2.3,0.5], ["fuelcan","r",-2.3,0,-2.85,-0.4], ["fuelcan","r",-1.95,0,-3.05,0.9],
  ["toolbox","r",-1.62,1.13,1.55,0.05], ["lube","r",-1.22,1.13,1.42,0.4], ["extinguisher","r",-0.75,0,1.95,0.6],
  ["handtruck","r",2.3,0,-3.1,PI*0.5], ["barrel","r",3.5,0,-2.9,0],
  ["crate","f",0.15,0,-2.7,0.06], ["crate","f",0.17,0.32,-2.68,-0.1]
];
function pitsModels(){
  var S5=PITS.scene; PITS.mTier=GFX;
  if(GFX==="lite"){ if(PITS.models){ S5.remove(PITS.models); PITS.models=null; PITS.dirty=2; } return; }
  if(PITS.models){ PITS.models.children.forEach(pitsModelPlace); return; }
  if(typeof modelGet!=="function") return;
  if(!THREE.GLTFLoader){ if(!PITS.mWait && window.__pewPost){ PITS.mWait=true; window.__pewPost(function(ok){ PITS.mWait=false; if(ok && THREE.GLTFLoader && PITS.scene===S5 && GFX!=="lite") pitsModels(); }); } return; }
  var G=new THREE.Group(); G.name="pitsModels"; PITS.models=G; S5.add(G);
  PITS_MODELS.forEach(function(s){ modelGet(s[0], function(src){ if(PITS.models!==G) return;
    var o=src.clone(); o.name="model:"+s[0]; o.userData.spot=s; o.rotation.order="YXZ"; o.rotation.set(s[6]||0, s[5], 0); G.add(o); pitsModelPlace(o); PITS.dirty=2; }); });
}
/* stand one on the floor (or a cart top) at its spot for the car on the stands now */
function pitsModelPlace(o){
  var s=o.userData.spot, F=PITS.fit; o.position.set(s[2]+(s[1]==="r"?F.x0:s[1]==="f"?F.x1:0), 0, s[4]);
  o.updateMatrixWorld(true); o.position.y=s[3]-new THREE.Box3().setFromObject(o).min.y;
}
/* fixed camera: front three-quarter from the near side, fitted to the car and the props around it; room left for the header */
function pitsFrame(){
  var cam=PITS.cam, F=PITS.fit, el=renderer.domElement, w=el.clientWidth||400, h=el.clientHeight||300, asp=w/Math.max(1,h);
  var small=h<520, vf=asp<0.9?50:asp>1.9?30:asp>1.4?36:42; cam.fov=vf; cam.aspect=asp;   /* small: the phone view, where the header covers the top third */
  var tv=Math.tan(vf*PI/360), th=tv*asp, xe=Math.min(F.x1, F.x0+(small?5.4:6.2)), halfW=(xe-F.x0)*0.5+(small?0.8:1.2), halfH=small?1.05:1.3;
  var d=Math.max(halfW/th, halfH/tv)+1.0;
  var tx=(F.x0+xe)/2-(small?0.25:0.5), tgt=_ptA.set(tx, 0.8+(small?0.2:0.05)*d*tv, 0.35), dir=_ptB.set(0.2,small?0.16:0.21,0.93).normalize();   /* r8: a touch more side-on and higher: the rear corner and bars read */
  cam.position.copy(tgt).addScaledVector(dir, d); cam.lookAt(tgt); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  pitsFit(cam, F, tgt, dir, d, tv, small);
  PITS.fitKey=w+"x"+h;
}
/* r13: fit to the car's bounds. The framing above is for a street-length car; a funny car, a dragster (wing, long nose) or a car on its bars can run past
   the edge. Project the car's outline (rear and nose ends at their own heights, mid-car at full height); while any of it is outside the safe window, back the
   camera off and slide it toward the car's middle. Cars that already fit are left exactly as framed. */
function pitsFit(cam, F, tgt, dir, d, tv, small){
  var lift=PITS_LIFT, hw=F.hw, xm=(F.x0+F.x1)/2, P=[], i, it, LX=small?0.95:0.93, LB=small?-0.9:-0.88, LT=small?0.62:0.86, ok;
  if(F.x0==null||F.hR==null) return;
  [-1,1].forEach(function(s){ var z=s*hw;
    P.push([F.x0,lift,z],[F.x0,F.hR+lift,z],[F.x1,lift,z],[F.x1,F.hF+lift,z],[xm,F.H+lift,z*0.7],[xm,lift,z]); });
  var th=Math.tan(cam.fov*PI/360)*cam.aspect, right=new THREE.Vector3(1,0,0).applyQuaternion(cam.quaternion), mnx, mxx, mny, mxy, v=new THREE.Vector3();
  for(it=0;it<14;it++){
    mnx=mny=9; mxx=mxy=-9;
    for(i=0;i<P.length;i++){ v.set(P[i][0],P[i][1],P[i][2]).project(cam); if(v.x<mnx) mnx=v.x; if(v.x>mxx) mxx=v.x; if(v.y<mny) mny=v.y; if(v.y>mxy) mxy=v.y; }
    ok=mnx>=-LX && mxx<=LX && mny>=LB && mxy<=LT; if(ok) break;
    var kx=(mxx-mnx)/(2*LX), ky=(mxy-mny)/(LT-LB), k=Math.max(kx,ky,1.02);
    var cx=(mxx+mnx)/2, cy=(mxy+mny)/2-(LT+LB)/2;
    tgt.addScaledVector(right, cx*d*th); tgt.y+=cy*d*tv;
    d*=Math.min(k,1.5)*1.01;
    cam.position.copy(tgt).addScaledVector(dir, d); cam.lookAt(tgt); cam.updateMatrixWorld();
  }
  PITS.ndc={x0:mnx, x1:mxx, y0:mny, y1:mxy, d:d, it:it, ok:ok};
}
function pitsUpdate(o){
  if(!PITS.built) buildPitsScene();
  var S5=PITS.scene, ch=false;
  var key=(o.body||"street")+"|"+(o.color>>>0)+"|"+(+o.tyreIn||0)+(o.hw?"|"+JSON.stringify(o.hw)+(GFX==="lite"):"")+(o.wbar?"|wb":"");   /* hw: the strip car's hardware (drag v2 A) */
  if(key!==PITS.carKey){
    if(PITS.car) S5.remove(PITS.car);
    var car=stripCar(o.body||"street", o.color==null?0xa32a26:o.color, o.tyreIn, o.hw); if(o.wbar && !car.userData.meta.bars) stripAddBars(car); stripCarMeta(car); if(car.userData.driver) car.userData.driver.visible=false;   /* up on the stands between rounds: nobody in the seat */
    car.position.set(-(car.userData._bbMinX+car.userData._len/2), PITS_LIFT, 0); car.updateMatrixWorld(true);
    S5.add(car); PITS.car=car; PITS.carKey=key; pitsProps(car); stripContact(car, {soft:true, y:0.01-PITS_LIFT, opacity:0.8}); PITS.fitKey=""; ch=true;   /* floor shadow under the raised car */
  }
  stripLivery(PITS.car);
  var nk=clamp(o.nightK==null?1:+o.nightK, 0, 1);
  if(Math.abs(nk-PITS.nightK)>0.001){ PITS.nightK=nk; var hor=pitsSky(nk); S5.background=PITS.bg; S5.fog.color.copy(hor);
    PITS.hemi.intensity=0.62-0.22*nk; PITS.moon.intensity=0.45-0.25*nk; PITS.hemi.color.set(0x8090b0).lerp(_ptC.set(0xc9a08e), 0.7*(1-nk)); PITS.moon.color.set(0x9fb4d8).lerp(_ptC.set(0xffb27a), 1-nk); if(PITS.fx) PITS.fx.mat.uniforms.uFog.value.copy(hor).convertSRGBToLinear(); ch=true; }
  if(PITS.tier!==GFX){ PITS.tier=GFX; var ms=GFX==="ultra"?2048:1024; PITS.spot.shadow.mapSize.set(ms,ms); if(PITS.spot.shadow.map){ PITS.spot.shadow.map.dispose(); PITS.spot.shadow.map=null; } ch=true; }
  PITS.heat=clamp(+o.heat||0, 0, 1);
  if(o.poke){ PITS.work[o.poke==="first"||o.poke==="final"||o.poke==="gear"||o.poke==="wear"?"launch":o.poke==="shocks"?"psi":o.poke]=1.6; ch=true; }
  if(ch) PITS.dirty=2;
}
/* per drawn frame: Full/Ultra only (Lite is a still) */
function pitsAnimate(dt){
  PITS.t+=dt; var t=PITS.t, i;
  PITS.crew.forEach(function(p){ var U=p.userData, w=PITS.work[U.key]||0; if(w>0) PITS.work[U.key]=Math.max(0,w-dt);
    var a=U.pose==="lean"? 0.06*Math.sin(t*0.9+U.ph)+(w>0?0.12*Math.sin(t*9):0) : 0.04*Math.sin(t*0.7+U.ph)+(w>0?0.08*Math.sin(t*11):0);
    U.up.rotation.x=U.lean0+a; U.up.rotation.y=0.08*Math.sin(t*0.45+U.ph); });
  if(PITS.fx){ var F=PITS.fit, car=PITS.car, n=PITS.heat*dt*5;
    PITS.acc=(PITS.acc||0)+n; while(PITS.acc>=1){ PITS.acc-=1; var s=Math.random()<0.5?1:-1;
      PITS.fx.emit(F.rearX+(Math.random()-0.5)*F.rr, PITS_LIFT+F.rr*(0.6+Math.random()*0.9), s*(F.rearZ+F.tw*0.3), 0, 0.25, 0, 3.6+Math.random()*1.6, 0.3, 1.5, 0.78,0.78,0.8, 0.3, {buoy:0.25, drag:0.6, fin:0.15}); }
    PITS.fx.step(dt, PITS.wind); }
  PITS.lamp.intensity=1.5+0.04*Math.sin(t*7.3)*Math.sin(t*3.1);
}
function pitsRender(dt){
  var el=renderer.domElement, fk=(el.clientWidth||400)+"x"+(el.clientHeight||300);
  if(PITS.fitKey!==fk){ pitsFrame(); PITS.dirty=2; }
  if(renderer.info.render.frame!==PITS.seen) PITS.dirty=Math.max(PITS.dirty,1);   /* something else drew on the canvas */
  if(GFX==="lite" && PITS.dirty<=0) return;   /* Lite: the last frame stays up */
  if(PITS.mTier!==GFX) pitsModels();   /* the tier changed: props in or out */
  if(GFX!=="lite") pitsAnimate(dt||0.016);
  var ex=renderer.toneMappingExposure; renderer.toneMappingExposure=1.0;
  var inf=renderer.info, ar=inf.autoReset; inf.autoReset=false; inf.reset();
  if(!ultraPits()) renderer.render(PITS.scene, PITS.cam);
  PITS.stats={calls:inf.render.calls, tris:inf.render.triangles, tier:GFX, parts:PITS.fx?PITS.fx.P.length:0}; inf.autoReset=ar;
  renderer.toneMappingExposure=ex; PITS.seen=inf.render.frame; PITS.dirty=Math.max(0,PITS.dirty-1); PITS.renders++;
}
/* screen points (CSS px in the canvas) for the tune tags: engine, gearbox, rear tyre, rear shock, cockpit */
function pitsAnchors(){
  if(!PITS.on||!PITS.car) return null;
  var el=renderer.domElement, w=el.clientWidth, h=el.clientHeight; if(!w||!h) return null;
  if(PITS.fitKey!==w+"x"+h) pitsFrame();
  var car=PITS.car, u=car.userData, F=PITS.fit, ox=car.position.x, e=u._eng, out={w:w, h:h};
  var pts={ launch:[e.x+ox, e.y+PITS_LIFT, 0], wear:[e.x+ox+(u.body==="rail"?0.5:-0.35), e.y+PITS_LIFT+0.12, 0],
    gear:[F.rearX+(e.x+ox-F.rearX)*0.45, PITS_LIFT+F.rr*1.05, 0.15], psi:[F.rearX, PITS_LIFT+F.rr*0.55, F.rearZ+F.tw*0.5],
    shocks:[F.rearX+F.rr*0.4, PITS_LIFT+F.rr*1.65, F.rearZ*0.7], dial:[u.body==="rail"?F.rearX+0.9:F.rearX+(e.x+ox-F.rearX)*0.45, PITS_LIFT+F.H*0.95, 0] };
  for(var k in pts){ _ptA.set(pts[k][0], pts[k][1], pts[k][2]).project(PITS.cam); out[k]=[Math.round((_ptA.x+1)/2*w), Math.round((1-_ptA.y)/2*h), _ptA.z<1]; }
  return out;
}

