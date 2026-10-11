/* ===========================================================================
   SALT FLATS LOOK — helpers for vis/salt.js: the light (midday, or a Speed Week dawn with a low warm
   sun, long shadows and pink-lit mountains), Silver Island and Pilot Peak as one layered, hazed mesh,
   the depth-aware heat shimmer / far mirage / camera motion blur post pass, the HUD band lens lift,
   the nose cam's seat on the bodywork, and the rebuild when the quality tier changes.
   ==========================================================================*/
/* light presets: k=0 midday, k=1 dawn. Light colours are raw (as three takes a hex); sky, haze and mountain colours are linear. */
var SALT_LIGHT={
  day:{ sun:[0.42,0.66,0.62], sunC:[1.0,0.941,0.863], sunI:1.6, hemiS:[0.839,0.886,0.949], hemiG:[0.91,0.886,0.831], hemiI:0.42,
    hor:[0.56,0.64,0.74], horS:[0.66,0.70,0.76], zen:[0.045,0.14,0.42], skySun:[1.0,0.86,0.62], belt:0, exp:0.74, glare:0.6,
    mAmb:[0.34,0.38,0.46], mSun:[1.05,0.98,0.90], glow:0, fogMix:0.3 },
  dawn:{ sun:[-0.55,0.19,0.82], sunC:[1.0,0.70,0.46], sunI:3.4, hemiS:[0.66,0.68,0.84], hemiG:[0.98,0.80,0.66], hemiI:0.36,
    hor:[0.66,0.58,0.68], horS:[1.0,0.68,0.46], zen:[0.07,0.13,0.36], skySun:[1.0,0.62,0.34], belt:1, exp:0.92, glare:1.3,
    mAmb:[0.26,0.24,0.36], mSun:[1.5,0.78,0.56], glow:1.6, fogMix:0.4 }
};
/* the horizon colour seen along a direction: warmer toward the sun (shared by the sky, the mountains' haze) */
var SALT_GLSL_HOR="vec3 saltHorC(vec3 d, vec3 sun, vec3 hor, vec3 horS){ vec2 a=normalize(d.xz+vec2(1e-5)), b=normalize(sun.xz+vec2(1e-5)); return mix(hor,horS,pow(max(dot(a,b),0.0),2.0)); }";
function saltV3(a){ return new THREE.Vector3(a[0],a[1],a[2]); }
function saltLmix(a,b,k){ return [lerp(a[0],b[0],k), lerp(a[1],b[1],k), lerp(a[2],b[2],k)]; }
/* apply the light: k 0 (midday) .. 1 (dawn) */
function saltLight(k){
  k=clamp(+k||0,0,1); SALT.lightK=k; if(!SALT.built) return;
  var A=SALT_LIGHT.day, B=SALT_LIGHT.dawn, m=function(n){ return saltLmix(A[n],B[n],k); }, f=function(n){ return lerp(A[n],B[n],k); };
  var sd=saltV3(m("sun")).normalize(); SALT.sunDir.copy(sd);
  var sc3=m("sunC"); SALT.sun.color.setRGB(sc3[0],sc3[1],sc3[2]); SALT.sun.intensity=f("sunI");
  var hs=m("hemiS"), hg=m("hemiG"); SALT.hemi.color.setRGB(hs[0],hs[1],hs[2]); SALT.hemi.groundColor.setRGB(hg[0],hg[1],hg[2]); SALT.hemi.intensity=f("hemiI");
  /* a low sun throws shadows a long way: push the light back and deepen the shadow box along it */
  SALT.sunDist=lerp(150,420,k); var shc=SALT.sun.shadow.camera; shc.far=lerp(300,900,k); shc.updateProjectionMatrix(); SALT.sun.shadow.normalBias=lerp(0.03,0.07,k);
  var hor=m("hor"), horS=m("horS"), fm=f("fogMix");
  var su=SALT.sky.material.uniforms; su.uSun.value.copy(sd); su.uHor.value.fromArray(hor); su.uHorS.value.fromArray(horS); su.uZen.value.fromArray(m("zen")); su.uSunC.value.fromArray(m("skySun")); su.uBelt.value=f("belt");
  SALT.horLin.setRGB(lerp(hor[0],horS[0],fm), lerp(hor[1],horS[1],fm), lerp(hor[2],horS[2],fm));
  SALT.exposure=f("exp");
  if(SALT.gU){ SALT.gU.uSunG.value.copy(sd); SALT.gU.uGlare.value=f("glare"); var r=new THREE.Vector2(sd.x,sd.z); if(r.lengthSq()<1e-6) r.set(1,0); r.normalize().multiplyScalar(lerp(0.045,0.085,k)); SALT.gU.uRelief.value.copy(r); SALT.gU.uGlareC.value.fromArray(m("skySun")); }
  if(SALT.mtn && SALT.mtn.material.uniforms){ var mu=SALT.mtn.material.uniforms; mu.uSun.value.copy(sd); mu.uSunC.value.fromArray(m("mSun")); mu.uAmb.value.fromArray(m("mAmb")); mu.uHor.value.fromArray(hor); mu.uHorS.value.fromArray(horS); mu.uGlow.value=f("glow"); }
}
/* pick the light for this run: o.dawn (0..1) wins, else the night toggle means a dawn session (Speed Week starts at first light) */
function saltLightPick(o){ var k=o.dawn!=null ? clamp(+o.dawn||0,0,1) : (o.night ? 1 : 0); if(k!==SALT.lightK) saltLight(k); }

/* --- the mountains: one mesh of jagged, layered ranges (Silver Island close on the left, Pilot Peak standing up
   behind it, Floating Island off to the right, long low ranges all round), hazed toward the horizon colour by distance --- */
function saltVN(x, seed){ var i=Math.floor(x), f=x-i; f=f*f*(3-2*f); return lerp(rng01(i*1.731+seed*37.13), rng01((i+1)*1.731+seed*37.13), f); }
function saltRidge(s, seed){ var a=0, w=1, tw=0, L=[2100,900,380,160,70]; for(var k=0;k<L.length;k++){ var n=1-Math.abs(2*saltVN(s/L[k], seed+k*7.3)-1); a+=w*Math.pow(n,1.7); tw+=w; w*=0.5; } return a/tw; }
var SALT_RANGES=[
  /* a0, a1 (rad: 0 = straight down the course, negative = the pit side), R (m), radial wobble, base, amp, seed, colour (sRGB), peaks [a, half-width, height], spacing (m) */
  {a0:-Math.PI, a1:Math.PI, R:27000, Rj:3500, h0:120, amp:620, seed:1, col:0x7c7f8c, peaks:[], ds:320, ring:true},
  {a0:-0.80, a1:-0.10, R:21500, Rj:900, h0:180, amp:520, seed:2, col:0x7a7472, peaks:[[-0.43,0.075,1620],[-0.30,0.05,380]], ds:90},
  {a0:-2.05, a1:-0.42, R:10200, Rj:1300, h0:140, amp:900, seed:3, col:0x857a6e, peaks:[[-1.05,0.07,250],[-0.72,0.05,170]], ds:55},
  {a0:-1.75, a1:-0.55, R:8000, Rj:900, h0:60, amp:420, seed:4, col:0x8d8172, peaks:[], ds:50},
  {a0:0.48, a1:0.92, R:12800, Rj:700, h0:60, amp:330, seed:5, col:0x857c72, peaks:[[0.70,0.06,140]], ds:70},
  {a0:1.15, a1:4.85, R:16500, Rj:2200, h0:50, amp:260, seed:6, col:0x80808a, peaks:[], ds:180}
];
function saltMountains(S4, lite){
  var pos=[], col=[], idx=[], cx=4800, base=0, c=new THREE.Color(), cf=new THREE.Color(0x9a8f80).convertSRGBToLinear();
  SALT_RANGES.forEach(function(r){
    var span=r.a1-r.a0, n=Math.max(8, Math.ceil(span*r.R/(r.ds*(lite?2.2:1)))), s, rows=4;
    c.set(r.col).convertSRGBToLinear();
    for(s=0;s<=n;s++){ var t=s/n, a=r.a0+span*t, ca=Math.cos(a), sa=Math.sin(a), arc=a*r.R;
      var env=r.ring?1:Math.pow(Math.sin(Math.PI*t),0.55), rd=saltRidge(arc, r.seed);
      var h=(r.h0+r.amp*Math.pow(rd,1.35))*env;
      r.peaks.forEach(function(p){ var d=Math.abs(a-p[0])/p[1]; if(d<1) h+=p[2]*Math.pow(1-d,1.5)*(0.82+0.3*rd); });
      if(r.ring) h*=0.55+0.9*Math.pow(saltVN(a*5.0, r.seed+9),2.0);
      h=Math.max(12,h);
      var Rc=r.R+r.Rj*(saltVN(arc/2600, r.seed+3)-0.5)*2, gul=(saltVN(arc/140, r.seed+11)-0.5);
      var rr=[Rc-(380+2.3*h), Rc-(1.1*h)*(0.55+gul*0.5), Rc, Rc+600+1.4*h], yy=[-10, h*(0.42+gul*0.25), h, h*0.3-10];
      for(var q=0;q<rows;q++){ pos.push(cx+ca*rr[q], yy[q], sa*rr[q]); var cc=q===0?cf:c, sh=q===2?1.08:(q===1?0.95+gul*0.2:1); col.push(cc.r*sh, cc.g*sh, cc.b*sh); }
      if(s<n) for(q=0;q<rows-1;q++){ var a0=base+s*rows+q, b0=a0+rows; idx.push(a0,b0,a0+1, b0,b0+1,a0+1); } }
    base+=(n+1)*rows; });
  var g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); g.setAttribute("aCol",new THREE.Float32BufferAttribute(col,3)); g.setIndex(idx); g.computeVertexNormals();
  var A=SALT_LIGHT.day, mat=new THREE.ShaderMaterial({
    uniforms:{ uSun:{value:saltV3(A.sun).normalize()}, uSunC:{value:saltV3(A.mSun)}, uAmb:{value:saltV3(A.mAmb)}, uHor:{value:saltV3(A.hor)}, uHorS:{value:saltV3(A.horS)}, uGlow:{value:0}, uHazeL:{value:40000} },
    vertexShader:"attribute vec3 aCol; varying vec3 vN; varying vec3 vC; varying vec3 vD; varying float vY; void main(){ vN=normal; vC=aCol; vY=position.y; vec4 wp=modelMatrix*vec4(position,1.0); vD=wp.xyz-cameraPosition; gl_Position=projectionMatrix*viewMatrix*wp; }",
    fragmentShader:["uniform vec3 uSun; uniform vec3 uSunC; uniform vec3 uAmb; uniform vec3 uHor; uniform vec3 uHorS; uniform float uGlow; uniform float uHazeL; varying vec3 vN; varying vec3 vC; varying vec3 vD; varying float vY;", SALT_GLSL_HOR,
      "void main(){ vec3 n=normalize(vN); if(!gl_FrontFacing) n=-n; float lam=max(dot(n,uSun),0.0);",
      " vec3 c=vC*(uAmb+uSunC*lam);",
      " c+=vec3(0.30,0.09,0.13)*uGlow*lam*smoothstep(40.0,700.0,vY);",   /* alpenglow on the sunward faces */
      " float dist=length(vD); vec3 d=vD/dist;",
      " float hz=1.0-exp(-dist/uHazeL); hz=mix(hz,min(1.0,hz*1.25+0.05),1.0-smoothstep(0.0,600.0,vY));",   /* thicker air down at the foot */
      " c=mix(c,saltHorC(d,uSun,uHor,uHorS),clamp(hz,0.0,0.96));",
      " gl_FragColor=linearToOutputTexel(vec4(c,1.0)); }"].join("\n"),
    side:THREE.DoubleSide, fog:false, toneMapped:false });
  var hm=new THREE.Mesh(g, mat); hm.frustumCulled=false; hm.renderOrder=-5; S4.add(hm); return hm;
}

/* a one-sided course board facing the approach (rotation ry about y), with a plain dark back so it reads from behind too */
function saltBoard(B, p, s, ry, uv, key){ key=key||"csign"; B.add(key,"plane",p,s,0xffffff,[0,ry,0],uv);
  var nx=Math.sin(ry), nz=Math.cos(ry); B.box(key==="csign"?"csolid":"solid", p[0]-nx*0.035, p[1], p[2]-nz*0.035, s[0]+0.06, s[1]+0.06, 0.04, 0x3a3d42, ry); }

/* --- the HUD band: --salthud on #view is the strip of the view the dock covers; an off-axis lens shift lifts the picture
   so the car frames above it (like stripLens) --- */
function saltBandRead(){ var host=canvasEl&&canvasEl.parentElement; SALT.band=0; if(host){ try{ SALT.band=parseFloat(getComputedStyle(host).getPropertyValue("--salthud"))||0; }catch(e){} } }
function saltLens(cam, fitted){
  /* the run view's HUD band (VBAND, vis/band.js) wins while it is up: it already counts the dock, so the picture is lifted once.
     bandFov widens a portrait shot as in the other scenes, except a shot already sized to the view's width (fitted) */
  if(VBAND.px>0 && VBAND.h>0){ if(!fitted){ var f=bandFov(cam.fov, cam.aspect); if(f!==cam.fov){ cam.fov=f; cam.updateProjectionMatrix(); } }
    cam.projectionMatrix.elements[9]=-clamp(VBAND.px/VBAND.h,0,0.3); cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert(); return; }
  var b=SALT.band||0, h=SALT.viewH||0; if(!(b>0&&h>0)) return;
  cam.projectionMatrix.elements[9]=-clamp(b/h,0,0.3); cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert(); }

/* --- the nose cam's seat: find the bodywork under a point a third of the way back from the nose, and the nose itself,
   so the shot always has the car's own skin in the bottom of the frame (whatever shape the car is) --- */
function saltNoseSeat(V){
  var U=V.userData; if(U.noseSeat) return U.noseSeat;
  var me=U.me, L=Math.max(2,me.nose-me.tail), rc=new THREE.Raycaster(), dn=new THREE.Vector3(0,-1,0), o=new THREE.Vector3(); rc.camera=SALT.cam; rc.far=60;
  var ry=V.rotation.y, pz=V.position.z; V.rotation.y=0; V.position.z=0; V.updateMatrixWorld(true);
  function shown(ob){ for(; ob; ob=ob.parent){ if(ob.visible===false) return false; if(ob===V) return true; } return true; }
  function top(xl, zl){ o.set(V.position.x+xl, 40, zl); rc.set(o, dn); var hs=rc.intersectObject(V, true);
    for(var i=0;i<hs.length;i++) if(shown(hs[i].object) && hs[i].object.isMesh) return hs[i].point.y; return -1; }
  var zs=-0.28, xs=me.nose-0.34*L, ys=top(xs, zs), xn=me.nose-0.05*L, yn=-1;
  for(var k=0;k<6 && yn<0;k++){ yn=top(xn-k*0.05*L, 0); if(yn>=0) xn-=k*0.05*L; }
  if(ys<0) ys=me.top||1.0; if(yn<0) yn=0.5;
  V.rotation.y=ry; V.position.z=pz; V.updateMatrixWorld(true);
  U.noseSeat={x:xs, y:ys+0.24, z:zs, nx:xn, ny:yn}; return U.noseSeat;
}

/* --- quality tier changed: tear the whole flats down and build them again at the new tier (cars too: they rebuild on demand) --- */
function saltRebuild(){
  var old=SALT.scene; if(!old) return;
  (SALT.owned||[]).concat([SALT.ground, SALT.sky, SALT.mtn]).forEach(function(m){ if(m && m.geometry) m.geometry.dispose(); });
  if(SALT.mats && SALT.mats.sign && SALT.mats.sign.map) SALT.mats.sign.map.dispose();
  if(SALT.sun && SALT.sun.shadow.map){ SALT.sun.shadow.map.dispose(); SALT.sun.shadow.map=null; }
  if(SALT.composer){ try{ SALT.composer.renderTarget1.dispose(); SALT.composer.renderTarget2.dispose(); SALT.composer.passes.forEach(function(ps){ if(ps.dispose) ps.dispose(); }); }catch(e){} }
  SALT.composer=null; SALT.shimmer=null; SALT.bloom=null; SALT.cSize="";
  SALT.owned=[]; SALT.flags=[]; SALT.courseMeshes=null; SALT.courseKey=""; SALT.cars={}; SALT.cur=null; SALT.mats={}; SALT.gU=null;
  var k=SALT.lightK||0; SALT.built=false; buildSaltScene(); SALT.lightK=-1; saltLight(k); SALT.snap=true; SALT.mbSeq=-1;
}

/* --- motion blur bookkeeping: the camera's view-projection now and one update ago (render cadence doesn't matter) --- */
var _sVP=new THREE.Matrix4();
function saltTrackVP(cam, dt){
  cam.updateMatrixWorld(); _sVP.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  if(!SALT.vpCur){ SALT.vpCur=new THREE.Matrix4(); SALT.vpPrev=new THREE.Matrix4(); SALT.vpInv=new THREE.Matrix4(); }
  SALT.vpPrev.copy(SALT.vpCur); SALT.vpCur.copy(_sVP); SALT.vpInv.copy(_sVP).invert(); SALT.vpDt=dt;
  SALT.vpOk=(SALT.mbSeq===SALT.seq) && dt>0; SALT.mbSeq=SALT.seq;   /* never across a cut */
}
