/* ===========================================================================
   SALT FLATS SCENE — Bonneville land-speed runs, a fourth world the view cuts
   to while ENGINE_VIS.setSalt({on:true, ...}) is fed every frame.
   Units metres. x = distance down the course from the start line (the timed
   mile sits a mile or three out), y up, z across: pits and timing stands on
   the left (z < 0), the black line down the middle at z = 0. The ground is one
   big plane that follows the camera; its salt crust, tyre tracks, the black
   line and the start line are drawn by a world-space shader, so a 10 km course
   costs nothing. Mountains ring the flats 9–15 km out, hazed by the fog; a
   full-screen pass adds the heat shimmer and the mirage band at the horizon
   (Full/Ultra). The cars are built in vis/salt-cars.js (the Altered on the
   strip's muscle shell). Built on first use.
   ==========================================================================*/
var LSR_MILE_V=1609.344, SALT_PUSH_COL=0x56707e;   /* the push truck: weathered slate, clear of every class colour */
function saltInit(){ var o={ on:false, built:false, scene:null, cam:null, sun:null, hemi:null, sky:null, ground:null, mats:{}, cars:{}, cur:null, curKey:"", push:null,
  camPos:new THREE.Vector3(), camTgt:new THREE.Vector3(), fov:46, shot:null, shotT:0, cutT:9, snap:true, relOn:false, skip:false, horLin:null,
  t:0, runT:0, doneT:0, prev:{}, composer:null, shimmer:null, exposure:0.74, stats:null, tier:null, fx:null, flags:[], fixX:0, fixZ:0, seq:0,
  course:null, crowd:null, shake:0, pushX:0, pushZ:0, pushV:0 };
  o.course={x0:LSR_MILE_V, x1:2*LSR_MILE_V, k0:1.5*LSR_MILE_V-500, k1:1.5*LSR_MILE_V+500, xEnd:3.5*LSR_MILE_V}; return o; }
var SALT=saltInit();   /* phones: vis/api.js takes a fresh one when Lite frees the scene */
var _sA=new THREE.Vector3(), _sB=new THREE.Vector3(), _sC=new THREE.Vector3(), _sw=new THREE.Vector3(), _st=new THREE.Vector3(), _sr=new THREE.Vector3(), _srt=new THREE.Vector3(), _sM=new THREE.Matrix4(), _sQ=new THREE.Quaternion(), _sS=new THREE.Vector3();
var SALT_SUN=new THREE.Vector3(0.42,0.66,0.62).normalize(), SALT_HOR=[0.56,0.64,0.74], SALT_WIND=new THREE.Vector3(-1.6,0,0.7);
/* salt: warm cream crust of small, uneven polygons with raised edges (lit on the sun side, a shadow on the lee), low ridges further
   out, damp grey patches far off, old black lines from past meets, the graded course with tyre tracks, the black line, the start line;
   a glare hotspot where the sun reflects off the crust (emissive, so the bloom catches it); near a moving camera the crust smears */
var SALT_GLSL_GROUND=[
  "uniform vec3 uSunG; uniform float uGlare; uniform vec3 uGlareC; uniform float uStreak; uniform vec2 uRelief;",
  "vec3 gGlare=vec3(0.0);",
  "vec2 saltVor(vec2 p){ vec2 i=floor(p), f=fract(p); float d1=8.0, d2=8.0; for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(float(x),float(y)); vec2 r=g+vec2(sh(i+g),sh(i+g+19.7))*0.95-f; float dd=dot(r,r); if(dd<d1){ d2=d1; d1=dd; } else if(dd<d2) d2=dd; } return vec2(sqrt(d1),sqrt(d2)); }",
  "vec3 stripSurf(vec3 w, out float rough){",
  "  vec2 p=w.xz; float d=length(w-cameraPosition); float fine=1.0-smoothstep(10.0,64.0,d), mid=1.0-smoothstep(60.0,1400.0,d);",
  "  float n2=sn(p*0.21+7.0), n3=sn(p*3.7), n4=sn(p*0.017+2.0);",
  "  vec2 q=p*0.42; float r1=1.0-abs(sn(q)*2.0-1.0), r2=1.0-abs(sn(q*1.9+5.0)*2.0-1.0);",
  "  float ridge=(pow(r1,7.0)+0.6*pow(r2,9.0))*(1.0-fine)*mid*0.5;",
  "  vec3 c=vec3(0.84,0.785,0.685)*(0.95+0.08*(n2-0.5)*mid+0.06*(n3-0.5)*fine+0.07*(n4-0.5));",
  "  float sk=uStreak*(1.0-smoothstep(2.0,30.0,d)), sH=0.0;",
  "  if(fine>0.0){ vec2 pv=p*1.7+vec2(sn(p*0.6),sn(p*0.6+5.3))*1.3; float cx=cameraPosition.x*1.7; pv.x=cx+(pv.x-cx)/(1.0+sk*5.0);",
  "    vec2 vv=saltVor(pv); float e=1.0-smoothstep(0.0,0.075,vv.y-vv.x); vec2 v2=saltVor(pv+uRelief); float e2=1.0-smoothstep(0.0,0.075,v2.y-v2.x);",
  "    float fk=fine*(1.0-0.75*sk); c*=1.0+fk*(0.11*e-0.09*e2*(1.0-e)); c*=1.0-fk*0.05*smoothstep(0.2,0.6,vv.x);",
  "    c*=1.0+fine*sk*(sn(vec2(w.x*0.06,w.z*12.0))-0.5)*0.3;",
  "#if STRIP_TIER>=1",
  "    sH=fk*(0.012*e-0.008*e2*(1.0-e)+0.004*smoothstep(0.2,0.6,vv.x));",
  "#endif",
  "  }",
  "  c-=vec3(0.10,0.09,0.07)*ridge;",
  "  float damp=smoothstep(0.6,0.82,sn(p*0.0019+3.0))*smoothstep(60.0,400.0,abs(w.z));",
  "  c=mix(c,vec3(0.52,0.50,0.46),damp*0.5);",
  "  float lz=(w.z+19.0)/37.0, li=floor(lz), lk=sh(vec2(li,4.3)), lc=(fract(lz)-0.5)*37.0-(lk-0.5)*12.0;",
  "  float ol=(1.0-smoothstep(0.07,0.17,abs(lc)))*step(0.45,lk)*step(24.0,abs(w.z))*smoothstep(0.32,0.6,sn(vec2(w.x*0.0035+li*3.1,li)))*(0.55+0.45*sn(vec2(w.x*0.25,li)))*(1.0-smoothstep(250.0,2200.0,d));",
  "  c=mix(c,vec3(0.13,0.12,0.12),ol*0.5);",
  "  float az=abs(w.z), crs=(1.0-smoothstep(13.0,18.0,az))*smoothstep(-260.0,-200.0,w.x)*(1.0-smoothstep(12400.0,12700.0,w.x));",
  "  float tr=exp(-pow((az-0.75)/0.32,2.0))+0.55*exp(-pow((az-2.6)/0.5,2.0))+0.35*exp(-pow((az-5.2)/0.9,2.0));",
  "  c*=1.0-crs*0.17*tr*(0.55+0.45*sn(vec2(w.x*0.04,w.z*2.5)));",
  "  c*=1.0+crs*0.03;",
  "  float azb=az;",
  "#if STRIP_TIER>=1",
  "  azb=abs(w.z+(sn(vec2(w.x*0.045,3.0))-0.5)*0.07+(sn(vec2(w.x*0.8,5.0))-0.5)*0.02);",
  "  c*=1.0-0.09*(1.0-smoothstep(0.15,0.7,azb))*crs;",
  "#endif",
  "  float bl=(1.0-smoothstep(0.10,0.15,azb))*step(-40.0,w.x)*(1.0-step(12350.0,w.x))*(0.82+0.18*sn(vec2(w.x*0.35,1.0)));",
  "  c=mix(c,vec3(0.03,0.03,0.035),bl);",
  "  float sl=(1.0-smoothstep(0.08,0.13,abs(w.x)))*(1.0-smoothstep(5.0,5.4,az));",
  "  c=mix(c,vec3(0.04,0.04,0.05),sl*0.9);",
  "  float pit=smoothstep(-260.0,-240.0,w.x)*(1.0-smoothstep(110.0,130.0,w.x))*smoothstep(-160.0,-150.0,w.z)*(1.0-smoothstep(-32.0,-26.0,w.z));",
  "  c*=1.0-pit*0.08*(0.6+0.4*sn(p*0.8));",
  "  vec3 vd=normalize(w-cameraPosition); float gs=max(dot(vec3(vd.x,-vd.y,vd.z),uSunG),0.0);",
  "  gGlare=uGlareC*uGlare*(pow(gs,14.0)*0.16+pow(gs,120.0)*0.8)*(1.0-0.7*max(bl,ol))*(0.7+0.6*n3*fine+0.3*(1.0-fine));",
  "#if STRIP_TIER>=1",
  "  float spk=smoothstep(0.8,0.93,sn(p*83.0))*aaf(0.012)*fine; c*=1.0+0.35*spk*(1.0-bl);",
  "  gH=sH-0.003*crs*tr; gHK=1.0; gMacroK=0.6;",
  "#endif",
  "  rough=0.93-crs*0.05; return c; }"].join("\n");
/* sky: deep desert blue overhead to a pale hazy horizon, the sun, no clouds to speak of */
function saltSkyMat(){
  return new THREE.ShaderMaterial({ uniforms:{ uSun:{value:SALT_SUN.clone()}, uHor:{value:new THREE.Vector3().fromArray(SALT_HOR)}, uHorS:{value:new THREE.Vector3().fromArray(SALT_HOR)},
      uZen:{value:new THREE.Vector3(0.045,0.14,0.42)}, uSunC:{value:new THREE.Vector3(1.0,0.86,0.62)}, uBelt:{value:0} },
    vertexShader:"varying vec3 vDir; void main(){ vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader:["uniform vec3 uSun; uniform vec3 uHor; uniform vec3 uHorS; uniform vec3 uZen; uniform vec3 uSunC; uniform float uBelt; varying vec3 vDir;", STRIP_GLSL_NOISE, SALT_GLSL_HOR,
      "void main(){ vec3 d=normalize(vDir); float h=d.y, up=clamp(h,0.0,1.0);",
      " vec3 hor=saltHorC(d,uSun,uHor,uHorS); vec3 col=mix(hor,uZen,pow(up,0.42));",
      " float az=dot(normalize(d.xz+vec2(1e-5)),normalize(uSun.xz+vec2(1e-5)));",
      /* dawn: the pink Belt of Venus over the earth's shadow, opposite the sun, and a warm fan over the sunrise */
      " col+=uBelt*vec3(0.34,0.13,0.17)*smoothstep(0.012,0.05,h)*smoothstep(0.26,0.07,h)*pow(max(-az,0.0),1.2);",
      " col+=uBelt*vec3(0.30,0.14,0.04)*smoothstep(0.35,0.0,h)*pow(max(az,0.0),6.0);",
      " col=mix(col,hor*0.97,smoothstep(0.0,-0.04,h));",
      " float sd=max(dot(d,uSun),0.0); col+=uSunC*(pow(sd,6.0)*0.14+pow(sd,60.0)*0.35);",
      " col+=vec3(1.0,0.95,0.85)*smoothstep(0.99955,0.9998,sd)*6.0;",
      " vec2 cp=d.xz/(max(h,0.0)+0.08)*0.7+vec2(5.0,2.0); float n=sfbm(cp*0.9)-0.5;",
      " col=mix(col,mix(vec3(0.86,0.88,0.92),vec3(1.0,0.70,0.62),uBelt*0.75),smoothstep(0.22,0.4,n)*smoothstep(0.02,0.1,h)*smoothstep(0.5,0.2,h)*0.45);",
      " gl_FragColor=vec4(col,1.0); gl_FragColor=linearToOutputTexel(gl_FragColor); }"].join("\n"),
    side:THREE.BackSide, depthWrite:false, fog:false, toneMapped:false });
}
/* heat: the air over the salt boils. Depth-aware: the wobble only touches what is past uWarpN (about 300 m, and always
   behind the car), the mirage mirrors the sky into the salt only past uMirN (about 1 km), so the car and the pits stay
   still. The same pass smears the picture by the camera's own motion over a 1/120 s shutter (the car's box kept sharp). */
var SALT_SHIMMER_SHADER={ uniforms:{ tDiffuse:{value:null}, tDepth:{value:null}, uCN:{value:0.4}, uCF:{value:34000}, uHorY:{value:0.5}, uAmt:{value:1}, uT:{value:0}, uMir:{value:1}, uAsp:{value:1}, uZoom:{value:1},
    uWarpN:{value:300}, uMirN:{value:1000}, uBlur:{value:0}, uInvVP:{value:new THREE.Matrix4()}, uPrevVP:{value:new THREE.Matrix4()}, uBoxC:{value:new THREE.Vector3()}, uBoxH:{value:new THREE.Vector3()} },
  vertexShader:"varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
  fragmentShader:["uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform float uCN; uniform float uCF; uniform float uHorY; uniform float uAmt; uniform float uT; uniform float uMir; uniform float uAsp; uniform float uZoom;",
    "uniform float uWarpN; uniform float uMirN; uniform float uBlur; uniform mat4 uInvVP; uniform mat4 uPrevVP; uniform vec3 uBoxC; uniform vec3 uBoxH; varying vec2 vUv;",
    "float sDep(vec2 u){ return texture2D(tDepth,u).x; }",
    "float sDist(float d){ float z=d*2.0-1.0; return 2.0*uCN*uCF/(uCF+uCN-z*(uCF-uCN)); }",
    "void main(){ float dc=sDep(vUv), zc=sDist(dc); float d=vUv.y-uHorY, fq=1.0/uZoom;",
    " float band=exp(-pow(d/(0.06*uZoom),2.0))*uAmt*smoothstep(uWarpN,uWarpN*2.5,zc);",
    " vec2 o=vec2(sin(vUv.y*620.0*fq+uT*9.0)+0.6*sin(vUv.y*231.0*fq-uT*6.3+vUv.x*40.0*fq), 0.6*cos(vUv.x*180.0*uAsp*fq+uT*7.0))*0.0011*min(uZoom,5.0)*band;",
    " if(band>0.0 && sDist(sDep(vUv+o))<uWarpN*0.8) o=vec2(0.0);",   /* never drag a near pixel into the haze */
    " vec4 c=texture2D(tDiffuse,vUv+o);",
    " if(d<0.0 && uMir>0.0){ float mb=uMir*smoothstep(uMirN,uMirN*1.8,zc);",
    "   if(mb>0.001){ vec2 mu=clamp(vec2(vUv.x+o.x*2.0, uHorY-d+0.0004*uZoom),0.0,1.0); mb*=smoothstep(uMirN,uMirN*1.8,sDist(sDep(mu)));",
    "     c=mix(c,texture2D(tDiffuse,mu)*vec4(0.93,0.96,1.0,1.0),mb*0.62); } }",
    " if(uBlur>0.0){ vec4 wp=uInvVP*vec4(vUv*2.0-1.0, dc*2.0-1.0, 1.0); wp.xyz/=wp.w;",
    "   vec3 q=abs(wp.xyz-uBoxC)-uBoxH; float car=step(max(q.x,max(q.y,q.z)),0.0);",
    "   vec4 pc=uPrevVP*vec4(wp.xyz,1.0); vec2 mv=pc.w>0.01 ? (vUv-(pc.xy/pc.w*0.5+0.5))*uBlur*(1.0-car) : vec2(0.0);",
    "   float ml=length(mv); if(ml>0.04){ mv*=0.04/ml; ml=0.04; }",
    "   if(ml>0.0012){ vec4 acc=c; float ws=1.0;",
    "     for(int i=0;i<8;i++){ vec2 su=vUv+o+mv*((float(i)+0.5)/8.0-0.5); float w=step(zc*0.88,sDist(sDep(su))); acc+=texture2D(tDiffuse,su)*w; ws+=w; }",
    "     c=acc/ws; } }",
    " gl_FragColor=c; }"].join("\n") };
function saltBuild(B, key, mat, shadow){ var keep=STRIP.scene; STRIP.scene=SALT.scene; var m=B.build(key, mat, shadow); STRIP.scene=keep; if(m) (SALT.owned||(SALT.owned=[])).push(m); return m; }
/* sign atlas: mile boards 1–7, START, TIMING, 1 KM, the meet banner, two trailer liveries */
function saltAtlas(){
  var c=newCanvas(1024,512), x=c.getContext("2d"), F="'Chakra Petch','Arial Narrow',Arial,sans-serif", i;
  function board(x0,y0,w,h,bg,fg,big,small){ x.fillStyle="#1a1a1a"; x.fillRect(x0,y0,w,h); x.fillStyle=bg; x.fillRect(x0+5,y0+5,w-10,h-10); x.fillStyle=fg; x.textAlign="center"; x.textBaseline="middle";
    x.font="700 "+(big.length>2?Math.round(h*0.34):Math.round(h*0.55))+"px "+F; x.fillText(big, x0+w/2, y0+h*(small?0.42:0.52), w-16); if(small){ x.font="700 "+Math.round(h*0.17)+"px "+F; x.fillText(small, x0+w/2, y0+h*0.82, w-16); } }
  for(i=0;i<7;i++) board(i*146,0,144,180,"#f4efe2","#141414",String(i+1),"MILE");
  board(0,182,250,120,"#f4efe2","#b7261d","START","");
  board(252,182,250,120,"#d97757","#141414","TIMING","");
  board(504,182,250,120,"#f4efe2","#1d4787","1 KM","");
  board(756,182,268,120,"#141414","#d97757","TIMED","MILE");
  x.fillStyle="#f4efe2"; x.fillRect(0,304,1024,72); x.fillStyle="#1d4787"; x.fillRect(0,366,1024,10);
  x.fillStyle="#1d4787"; x.font="700 44px "+F; x.textAlign="center"; x.textBaseline="middle"; x.fillText("SALT FLATS SPEED TRIALS · PRAIRIE ENGINE WORKS", 512, 336, 1000);
  x.fillStyle="#1b1d20"; x.fillRect(0,380,510,130); x.fillStyle="#d97757"; x.font="700 60px "+F; x.fillText("COULEE FUELS", 255, 445, 480);
  x.fillStyle="#e9e6dc"; x.fillRect(512,380,512,130); x.fillStyle="#1d4787"; x.font="700 52px "+F; x.fillText("WENDOVER FLYERS", 768, 445, 490);
  var t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=MAXANISO; return t;
}
var SALT_UV={ mile:function(i){ i=Math.max(0,Math.min(6,i)); return [i*146/1024, 1-180/512, (i*146+144)/1024, 1]; },
  start:[0,1-302/512,250/1024,1-182/512], timing:[252/1024,1-302/512,502/1024,1-182/512], km:[504/1024,1-302/512,754/1024,1-182/512], timed:[756/1024,1-302/512,1,1-182/512],
  banner:[0,1-376/512,1,1-304/512], liv:[[0,0,510/1024,1-380/512],[512/1024,0,1,1-380/512]] };

/* --- the flats --- */
function buildSaltScene(){
  var S4=new THREE.Scene(); SALT.scene=S4; SALT.tier=GFX;
  var lite=(GFX==="lite"), i, k, x, z, side, M=SALT.mats;
  var rng=function(s){ var t=Math.sin(s*127.1+3.7)*43758.5453; return t-Math.floor(t); };
  SALT.g={ box:new THREE.BoxGeometry(1,1,1), cyl:new THREE.CylinderGeometry(0.5,0.5,1,12), sph:new THREE.SphereGeometry(0.5,12,8) };
  var hemi=new THREE.HemisphereLight(0xd6e2f2, 0xe8e2d4, 0.42); S4.add(hemi); SALT.hemi=hemi;
  var sun=new THREE.DirectionalLight(0xfff0dc, 1.6); sun.castShadow=!lite; sun.shadow.mapSize.set(GFX==="ultra"?4096:2048, GFX==="ultra"?4096:2048);
  var shc=sun.shadow.camera; shc.left=-24; shc.right=24; shc.top=24; shc.bottom=-24; shc.near=1; shc.far=300; sun.shadow.bias=-0.0006; sun.shadow.normalBias=0.03;
  S4.add(sun); S4.add(sun.target); SALT.sun=sun;
  var sky=new THREE.Mesh(new THREE.SphereGeometry(2600, 40, 20), saltSkyMat()); sky.frustumCulled=false; sky.renderOrder=-10; S4.add(sky); SALT.sky=sky;
  SALT.horLin=new THREE.Color(SALT_HOR[0], SALT_HOR[1], SALT_HOR[2]);
  S4.fog=new THREE.Fog(0xffffff, 1800, 30000);
  S4.environment=stripEnv(false);
  SALT.gU={ uSunG:{value:SALT_SUN.clone()}, uGlare:{value:0.6}, uGlareC:{value:new THREE.Vector3(1.0,0.86,0.62)}, uStreak:{value:0}, uRelief:{value:new THREE.Vector2(0.03,0.03)} };
  var gm=stripSurfMat(SALT_GLSL_GROUND, null, SALT.gU, {emissive:"totalEmissiveRadiance+=gGlare;"}); gm.customProgramCacheKey=function(){ return "salt_ground"; };
  var ground=new THREE.Mesh(new THREE.PlaneGeometry(64000, 64000, lite?72:96, lite?72:96), gm); ground.rotation.x=-PI/2; ground.receiveShadow=true; S4.add(ground); SALT.ground=ground;
  /* mountains: Silver Island close on the left with Pilot Peak behind it, Floating Island to the right, low ranges all round (vis/salt-look.js) */
  SALT.mtn=saltMountains(S4, lite);
  M.solid=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.82});
  M.metal=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.4, metalness:0.65});
  M.sign=new THREE.MeshStandardMaterial({map:saltAtlas(), roughness:0.7, side:THREE.DoubleSide});
  M.csign=new THREE.MeshStandardMaterial({map:M.sign.map, roughness:0.7});   /* course boards: one-sided, so their text never reads mirrored */
  M.cloth=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.85, side:THREE.DoubleSide});
  var B=new StripBatch(), ORANGE=0xff6a14, WHITE=0xeeeae0, STEEL=0x8d9296, DARK=0x232528;
  SALT.static=B;
  saltCourseProps(B, SALT.course, true);
  /* pits: the Speed Week pit town (vis/salt-event.js), a starter's stand at the line, the meet banner */
  saltPitTown(B, lite);
  saltBoard(B,[-40, 3.0, -30.5],[22,1.55,1],0,SALT_UV.banner,"sign"); B.box("metal", -51, 1.9, -30.6, 0.12, 3.8, 0.12, STEEL); B.box("metal", -29, 1.9, -30.6, 0.12, 3.8, 0.12, STEEL);
  B.box("solid", -6, 2.55, 11, 3.6, 0.1, 3.6, ORANGE); for(k=0;k<4;k++) B.box("metal", -6+((k>>1)?1.7:-1.7), 1.28, 11+((k&1)?1.7:-1.7), 0.05, 2.56, 0.05, STEEL);
  saltBoard(B,[-2, 1.6, 8.6],[2.4,1.15,1],-PI/2+0.5,SALT_UV.start,"sign"); B.box("metal", -2.05, 0.6, 8.6, 0.08, 1.2, 0.08, STEEL);
  saltBuild(B,"solid", M.solid, !lite); saltBuild(B,"metal", M.metal, !lite); saltBuild(B,"sign", M.csign, false); saltBuild(B,"cloth", M.cloth, false);   /* signs one-sided: text never reads mirrored */
  /* flags on poles at the pits and the start: they flap in the wind */
  (function(){ var fc=[0xff7a1a,0x1d4787,0xd9a52b,0xb7261d,0xf4efe2,0x2c6b3a], spots=[[-8,9],[-60,-34],[-110,-36],[-170,-40],[-20,-36],[40,-34],[-140,-120]];
    spots.forEach(function(sp,q){ var pole=new THREE.Mesh(SALT.g.cyl, sc_mats().alu); pole.scale.set(0.06,6.5,0.06); pole.position.set(sp[0],3.25,sp[1]); S4.add(pole);
      var g=new THREE.PlaneGeometry(2.0,1.25,10,1); g.translate(1.0,0,0); var fl=new THREE.Mesh(g, new THREE.MeshStandardMaterial({color:sc(fc[q%fc.length]), roughness:0.8, side:THREE.DoubleSide})); fl.position.set(sp[0],5.8,sp[1]); fl.rotation.y=-2.7; S4.add(fl);
      SALT.flags.push({m:fl, base:Float32Array.from(g.attributes.position.array), ph:q*1.3}); }); })();
  /* the push truck: saltMakePush (vis/salt-event.js) builds a real pickup with a crew member in the bed; the pit town has the people */
  SALT.push=(typeof saltMakePush==="function"?saltMakePush:saltPushTruck)(); S4.add(SALT.push);   /* hook: saltMakePush() may build a different truck */
  /* effects: salt thrown off the tyres and hanging behind the car; exhaust */
  SALT.fx=new StripFx(lite?320:(GFX==="ultra"?1600:1100), "smoke", stripPuffTex()); S4.add(SALT.fx.mesh);
  SALT.fx.mat.uniforms.uFogN.value=S4.fog.near; SALT.fx.mat.uniforms.uFogF.value=S4.fog.far;
  SALT.cam=new THREE.PerspectiveCamera(46, 1, 0.4, 34000); SALT.built=true;
  SALT.sunDir=SALT_SUN.clone(); SALT.lightK=-1;   /* saltLightPick applies the light on the next update */
}
/* everything that hangs off the course layout (mile boards, timing traps, cones); rebuilt when the course length changes */
function saltCourseProps(B, C, first){
  var i, k, side, x, M=SALT.mats, ORANGE=0xff6a14, WHITE=0xeeeae0, STEEL=0x8d9296, DARK=0x232528, MILE=LSR_MILE_V;
  var B2=first?B:new StripBatch();
  for(i=1;i<=6;i++){ x=i*MILE; if(x>C.xEnd+50) break;
    B2.box("cmetal", x, 1.15, -17, 0.12, 2.3, 0.12, STEEL); saltBoard(B2,[x-0.1, 2.65, -17],[1.6,2.0,1],-PI/2+0.45,SALT_UV.mile(i-1)); }
  /* the traps: an electronic eye on a tripod each side, a flag, and a timing stand at the start and end of the mile */
  [C.x0, C.k0, C.k1, C.x1].forEach(function(tx, q){ var main=(q===0||q===3);
    for(side=-1; side<=1; side+=2){ var tz=side*13;
      for(k=0;k<3;k++){ var a=k/3*TAU; B2.add("cmetal","cyl",[tx+Math.cos(a)*0.22, 0.55, tz+Math.sin(a)*0.22],[0.04,1.15,0.04],DARK,[Math.sin(a)*0.2,0,-Math.cos(a)*0.2]); }
      B2.box("cmetal", tx, 1.15, tz, 0.3, 0.22, 0.24, main?0xffd23a:0xd9dde2); B2.box("csolid", tx, 1.15, tz-side*0.13, 0.12, 0.12, 0.02, 0x111111);
      if(main){ B2.box("cmetal", tx, 1.8, tz+side*1.6, 0.05, 3.6, 0.05, STEEL); B2.add("ccloth","plane",[tx+0.5, 3.3, tz+side*1.6],[1.0,0.65,1],ORANGE,null); } }
    if(main){ B2.box("csolid", tx-6, 1.4, -26, 6.5, 2.4, 2.4, WHITE); B2.box("csolid", tx-6, 2.75, -26, 6.8, 0.15, 2.7, 0xb7261d);
      B2.add("csign","plane",[tx-6, 1.7, -24.78],[4.2,1.4,1],0xffffff,null,SALT_UV.timing); B2.add("csign","plane",[tx-6, 2.2, -27.22],[4.2,1.4,1],0xffffff,[0,PI,0],SALT_UV.timing);
      B2.box("csolid", tx-14, 1.0, -27, 5.2, 1.3, 2.0, 0xd0d3d6); B2.box("csolid", tx-13.4, 1.85, -27, 2.2, 0.7, 1.85, 0x22262b);
      saltBoard(B2,[tx-0.78, 2.4, -18],[2.2,1.05,1],-PI/2+0.45,q===0?SALT_UV.timed:SALT_UV.timing); B2.box("cmetal", tx-0.66, 1.0, -18, 0.08, 2.0, 0.08, STEEL); }
    else { saltBoard(B2,[tx, 2.0, -17],[1.6,0.77,1],-PI/2+0.45,SALT_UV.km); B2.box("cmetal", tx+0.05, 0.8, -17, 0.07, 1.6, 0.07, STEEL); } });
  /* cones every quarter mile along the course, and every 100 m through the timed mile */
  for(x=MILE/4; x<C.xEnd; x+=MILE/4) for(side=-1; side<=1; side+=2){ B2.add("csolid","cone",[x, 0.36, side*16],[0.42,0.72,0.42],ORANGE); B2.box("csolid", x, 0.42, side*16, 0.2, 0.08, 0.2, WHITE); }
  for(x=C.x0+100; x<C.x1; x+=100) for(side=-1; side<=1; side+=2) B2.add("csolid","cone",[x, 0.36, side*14],[0.42,0.72,0.42],ORANGE);
  /* Full/Ultra: a cone every 50 m down both edges, for the low side shot to whip past */
  if(GFX!=="lite") for(x=50; x<C.xEnd; x+=50){ if(Math.abs(x/(MILE/4)-Math.round(x/(MILE/4)))*(MILE/4)<8) continue; for(side=-1; side<=1; side+=2) B2.add("csolid","cone",[x, 0.36, side*16],[0.42,0.72,0.42],ORANGE); }
  if(SALT.courseMeshes) SALT.courseMeshes.forEach(function(m){ SALT.scene.remove(m); m.geometry.dispose(); });
  SALT.courseMeshes=[]; var lite=GFX==="lite";
  [["csolid",M.solid,!lite],["cmetal",M.metal,!lite],["csign",M.csign||M.sign,false],["ccloth",M.cloth,false]].forEach(function(a){ var m=saltBuild(B2,a[0],a[1],a[2]); if(m) SALT.courseMeshes.push(m); });
  SALT.courseKey=[C.x0,C.x1,C.xEnd].join(",");
}
function saltPushTruck(){
  var M=sc_mats(), g=new THREE.Group(), P=sc_paint(SALT_PUSH_COL), bx=SALT.g.box;
  function box(m, x,y,z, w,h,d){ var q=new THREE.Mesh(bx, m); q.position.set(x,y,z); q.scale.set(w,h,d); q.castShadow=true; q.receiveShadow=true; g.add(q); return q; }
  box(P, -2.6, 0.95, 0, 2.6, 0.7, 1.9); box(P, -0.55, 0.95, 0, 1.7, 0.7, 1.9); box(P, -1.25, 1.62, 0, 1.6, 0.66, 1.8); box(M.glass, -0.55, 1.62, 0, 0.18, 0.5, 1.6);
  box(M.black, 0.5, 0.75, 0, 0.35, 0.45, 1.6); box(M.rubber, 0.72, 0.75, 0, 0.1, 0.5, 1.3);
  box(M.black, -2.0, 0.48, 0, 4.8, 0.2, 1.7);
  var wh=[]; [[-3.0,-0.82],[-3.0,0.82],[-0.3,-0.82],[-0.3,0.82]].forEach(function(p){ var w=sc_wheel({x:p[0], z:p[1], r:0.38, w:0.24, rimR:0.2, style:"star", rimMat:"alu"}, M); w.position.set(p[0],0.38,p[1]); g.add(w); wh.push(w.userData.spin); });
  g.userData={wheels:wh, front:0.8}; return g;
}
/* a body of revolution along x: profile [t 0 (tail) .. 1 (nose), radius fraction] */
function saltLathe(len, R, prof, seg){
  var pts=prof.map(function(p){ return new THREE.Vector2(Math.max(0.002,p[1]*R), p[0]*len); });
  var g=new THREE.LatheGeometry(pts, seg||32); g.rotateZ(-PI/2); g.computeVertexNormals(); return g;
}
/* --- the cars (built in vis/salt-cars.js). Origin of every car = its rear axle on the salt, +x forward.
   userData: wheels (spin groups + radius; none when the wheels are Moon discs), chute anchor(s), body pivot, exhaust tips.
   look: from slLook / saltRivalLook (paint, number, class, engine); default = SALT.look when its paint matches, else the garage engine */
function saltCarLook(color, body, look){
  if(look) return look; var L=SALT.look; if(L && L.color===(color>>>0)) return L;
  var cls=""; try{ if(lastCfg && ENGINE_SIM.lsrClass) cls=ENGINE_SIM.lsrClass(lastCfg, null, body||"streamliner").key; }catch(e){}
  return slLook({color:color, cls:cls, num:L?L.num:undefined});
}
function saltCar(body, color, aero, look){ return saltCarV2(body, saltCarLook(color, body, look), aero); }
/* the Altered class: the strip's muscle shell, set up for the salt */
function saltAltered(color, aero, look){ return saltAlteredV2(saltCarLook(color, "altered", look), aero); }
function saltChutes(car, n){
  var U=car.userData; if(U.strip || U.chutes.length===n) return;
  U.chutes.forEach(function(c){ U.piv.remove(c); }); U.chutes.length=0;
  for(var i=0;i<n;i++){ var c=sc_chute(U.me, sc_mats()); c.position.copy(U.me.anchor); if(n>1){ c.position.z+= (i?1:-1)*0.14; if(i===0) c.scale.setScalar(0.6); } c.visible=false; U.piv.add(c); U.chutes.push(c); }
}
/* --- effects: salt spray off the rear tyres, a long rooster tail hanging over the course at speed, exhaust --- */
function saltEffects(o, dt, V){
  var U=V.userData, me=U.me, FX=SALT.fx, lite=GFX==="lite", rate=lite?0.45:(GFX==="ultra"?1.3:1), R=Math.random, i, t;
  var v=Math.max(0,+o.v||0), slip=clamp(+o.slip||0,0,1), ph=o.phase||"stage", x=V.position.x, run=(ph==="run"||ph==="shutdown"||ph==="spin");
  if(run && v>3){ var k=clamp(v/60,0,1.6)+slip*2.5+(ph==="spin"?2:0), nc=k*rate*55*dt, n=Math.floor(nc)+(R()<nc%1?1:0);
    for(i=0;i<n;i++){ var s=R()<0.5?-1:1, wz=(U.strip?0.75:(me.wb>3?0.34:0.8))*s;
      FX.emit(x-0.2-R()*0.4, 0.15+R()*0.25, wz+(R()-0.5)*0.3, v*(0.25+R()*0.3), 0.4+R()*1.8*(0.3+slip), s*(0.3+R()*1.2), 1.2+R()*1.6, 0.35, 1.6+R()*2.4+v*0.02, 0.93, 0.93, 0.9, 0.55, {drag:0.9, buoy:0.05, fin:0.06, spin:0.6}); }
    var sp=clamp((v-25)/50,0,1), nr=rate*sp*48*dt, m=Math.floor(nr)+(R()<nr%1?1:0);
    for(i=0;i<m;i++) FX.emit(x-2-R()*3, 0.4+R()*0.9, (R()-0.5)*1.4, v*0.55, 0.3+R()*0.7, (R()-0.5)*0.9, 3.5+R()*3, 1.2, 4.5+R()*4.5, 0.93, 0.92, 0.89, 0.36, {drag:0.5, buoy:0.08, fin:0.15, spin:0.2});
    /* the rooster tail's dense core: salt flung up and back off the rear tyres, close behind the car */
    var nk=rate*sp*36*dt, mk=Math.floor(nk)+(R()<nk%1?1:0);
    for(i=0;i<mk;i++){ var s2=R()<0.5?-1:1; FX.emit(x-0.6-R()*1.2, 0.25+R()*0.4, s2*(U.strip?0.75:(me.wb>3?0.34:0.8))+(R()-0.5)*0.4, v*0.72, 1.4+R()*2.6, s2*(0.2+R()*0.8), 1.2+R()*1.4, 0.5, 2.6+R()*2.8, 0.95, 0.94, 0.91, 0.5, {drag:1.1, buoy:0.02, fin:0.08, spin:0.5}); } }
  /* exhaust: heat puffs at full load; black for a smoky diesel */
  if(run && U.tips.length && !o.failed){ var sm=clamp(+o.smoke||0,0,1), ne=rate*(6+18*sm)*clamp(+o.throttle||0,0,1)*dt;
    for(t=0;t<U.tips.length;t++){ U.piv.localToWorld(_sA.copy(U.tips[t])); var nn=Math.floor(ne)+(R()<ne%1?1:0);
      for(i=0;i<nn;i++){ var cc=lerp(0.7,0.05,sm); FX.emit(_sA.x, _sA.y, _sA.z+(_sA.z>V.position.z?0.1:-0.1), v*0.8-2, 0.3, (_sA.z>V.position.z?1:-1)*0.8, 0.6+sm*1.2, 0.2, 0.9+sm*2, cc, cc, cc, 0.12+0.5*sm, {drag:1.2, buoy:0.2, fin:0.05, spin:0.5}); } } }
  if(o.failed && v>1){ var nf=rate*30*dt, mf=Math.floor(nf)+(R()<nf%1?1:0); for(i=0;i<mf;i++) FX.emit(x+(me.nose-me.tail)*0.35+me.tail, 0.8, (R()-0.5)*0.5, v*0.7, 1+R(), (R()-0.5), 2+R()*2, 0.5, 3+R()*3, 0.22, 0.22, 0.24, 0.5, {drag:0.8, buoy:0.25, fin:0.1, spin:0.4}); }
  FX.step(dt, SALT_WIND);
}
/* --- camera direction: the push, chase, the helicopter, an on-board nose cam, trackside and the traps, the chute, the stop --- */
function saltCut(name){ if(SALT.shot!==name){ SALT.shot=name; SALT.shotT=0; SALT.cutT=0; SALT.snap=true; SALT.seq++; } }
function saltDirect(o, dt, V){
  var ph=o.phase||"stage", v=Math.max(0,+o.v||0), U=V.userData, me=U.me, x=V.position.x, C=SALT.course, s=SALT.shot, T, sTo=function(X){ return (X-x)/Math.max(8,v); };
  var L=Math.max(2,me.nose-me.tail), mid=(me.tail+me.nose)/2, cx=x+mid, side=(SALT.seq%2?1:-1);
  if(o.shot){ s=o.shot; if(o.fixX!=null){ SALT.fixX=+o.fixX; SALT.fixZ=o.fixZ!=null?+o.fixZ:12; } }
  else if(SALT.skip) s="stop";
  else if(ph==="stage") s="stage";
  else if(ph==="push") s="push";
  else if(ph==="run"){
    /* the cut list: chase, long-lens trackside, low side-tracker through the cones, on-board, head-on through the heat, the helicopter */
    var cycle=["chase","track","side","nose","tele","heli","chase","low"], nx=null;
    if(s===null||s==="stage"||s==="push"&&SALT.shotT>1.2||s==="stop") s="chase";
    var trap=(x<C.x0 && sTo(C.x0)<2.6 && sTo(C.x0)>0.4) ? C.x0 : (x<C.x1 && x>C.x0+50 && sTo(C.x1)<2.6 && sTo(C.x1)>0.4) ? C.x1 : null;
    if(trap!=null && s!=="traps" && s!=="tele"){ s="traps"; SALT.fixX=trap; }
    else if(s==="traps"){ if(x>SALT.fixX+Math.max(60,v*1.6)) nx=cycle[SALT.seq%cycle.length]; }
    else if(s==="track"){ if(cx>SALT.fixX+Math.max(25,v*0.7) || SALT.shotT>5.5) nx=cycle[(SALT.seq+1)%cycle.length]; }
    else if(s==="tele"){ if(SALT.fixX-cx<Math.max(45,v*0.5) || SALT.shotT>5) nx=cycle[(SALT.seq+1)%cycle.length]; }
    else if(SALT.shotT>(s==="heli"?6:s==="side"?3.4:4.5)) nx=cycle[(SALT.seq+1)%cycle.length];
    if(nx==="tele" && (x>C.xEnd-600 || v<40)) nx="chase";
    if(nx){ s=nx; side=-side;
      if(s==="track"){ SALT.fixX=cx+Math.max(60,v*2.0); SALT.fixZ=side*(38+rng01(SALT.seq)*22); }
      if(s==="tele"){ SALT.fixX=cx+Math.max(180,v*4.2); SALT.fixZ=side*(19.5+rng01(SALT.seq+3)*4); } }
  } else if(ph==="shutdown"){ if(o.chute && s!=="chute" && s!=="stop" && SALT.prev.chute!==true) s="chute"; else if(s==="chute" && (SALT.shotT>6 || v<12)) s="stop"; else if(s!=="chute" && s!=="stop" && s!=="traps" && v<20) s="stop"; else if(s==="traps" && x>SALT.fixX+Math.max(60,v*1.6)) s="chase"; else if((s==="tele"||s==="track") && SALT.fixX<cx) s="chase"; }
  else if(ph==="spin"){ s="spin"; }
  else { if(s!=="stop") s="stop"; }
  if(SALT.cue){ if(!o.shot && !SALT.skip && ph==="shutdown") s=SALT.cue; SALT.cue=null; }   /* a one-frame cut asked for elsewhere (vis/salt-event.js: the chute) */
  saltCut(s);
  SALT.shotT+=dt; SALT.cutT+=dt; T=SALT.shotT;
  var fov=46, rel=false, sm=0, ax=x, top=me.top||1.2, lens=0, asp=SALT.cam.aspect||1.5, buf=0, D, fit=0;
  /* a vertical fov that shows a W-metre-wide slice at distance D (the long lenses size the car by this) */
  var fovFor=function(W, D){ return 2*Math.atan(Math.tan(Math.atan(W/2/Math.max(1,D)))/Math.max(0.5,asp))*180/PI; };
  var inMile=clamp((x-(C.x0-160))/160,0,1)*clamp(((C.x1+160)-x)/160,0,1);   /* through the traps: push in, shake */
  switch(s){
    case "stage": { var a=0.8+T*0.05; _sw.set(Math.cos(a)*9+mid, 1.6, Math.sin(a)*9); _st.set(mid, 0.6, 0); fov=42; break; }
    case "push": rel=true; _sw.set(me.tail-3.5, 1.4, 6.8); _st.set(me.tail-1.0, 0.8, 0); fov=52; sm=3; break;
    case "chase": { rel=true; var sp=clamp(v/140,0,1), pk=inMile*clamp(v/80,0,1);
      _sw.set(me.tail-5.6-v*0.018+pk*1.4, 1.12+v*0.003-pk*0.18, 1.9-pk*0.3); _st.set(me.nose+5, 0.72, 0); fov=45+sp*6+pk*8; sm=2.4; buf=sp*(0.3+0.7*pk); break; }
    case "heli": rel=true; _sw.set(-26+T*2.0, 8, 30); _st.set(mid+4, 0.5, 0); fov=30; sm=1.5;
      if(ph==="shutdown" && o.chute){ var cz=Math.min(me.tail, me.anchor?me.anchor.x:me.tail)-(me.chuteLen||8)-1.6, cm=(cz+me.nose)/2;   /* the chute is out: the car and the canopy behind it, together */
        _sw.set(cm-24+T*1.2, 8.5, 30); _st.set(cm, 0.7, 0); fov=clamp(fovFor((me.nose-cz)*1.12, 39.2), 30, 64); fit=1; }
      break;
    case "nose": { rel=true; var ns=saltNoseSeat(V), hf=28*PI/180, al=Math.atan2(ns.y-ns.ny, Math.max(0.3,ns.nx-ns.x)), th=Math.max(-0.03, al-0.62*hf);
      _sw.set(ns.x, ns.y, ns.z); _st.set(ns.x+Math.cos(th)*40, ns.y-Math.sin(th)*40, ns.z*0.3); fov=56; sm=14; buf=clamp(v/120,0,1)*(0.5+0.5*inMile); break; }
    case "low": rel=true; _sw.set(me.nose+2.5, 0.35, 2.2); _st.set(me.tail, 0.6, 0); fov=58; sm=6; break;
    case "side": rel=true; _sw.set(mid+1.2, 0.5, side*19.5); _st.set(mid+0.4, 0.55, 0); fov=31; sm=8; buf=clamp(v/140,0,1)*0.4; break;
    case "track": _sw.set(SALT.fixX, 1.1, SALT.fixZ); _st.set(cx+v*0.035, 0.75, 0); D=Math.hypot(SALT.fixX-cx, SALT.fixZ); fov=clamp(fovFor(Math.max(L*2.4,9), D),6,12); lens=1; break;
    case "tele": _sw.set(SALT.fixX, 1.25, SALT.fixZ); _st.set(cx, 0.65, 0); D=Math.hypot(SALT.fixX-cx, SALT.fixZ); fov=clamp(fovFor(Math.max(L*1.9,7), D),1.2,8); lens=1; break;
    case "traps": _sw.set(SALT.fixX-14, 1.05, -21.5); _st.set(cx, 0.7, 0); D=Math.hypot(SALT.fixX-14-cx, 21.5); fov=clamp(fovFor(Math.max(L*3,14), D),9,50); lens=1; break;
    case "chute": rel=true; _sw.set(me.tail-18, 2.6, 4.5); _st.set(me.tail-4, 0.9, 0); fov=44; sm=3; break;
    case "spin": rel=true; _sw.set(-12, 5, 10); _st.set(0, 0.5, 0); fov=50; sm=2; break;
    case "stop": { var dr=Math.min(4,T*0.3), a2=-0.5+T*0.04; _sw.set(x+mid+Math.cos(a2)*(12-dr), 2.2-dr*0.15, 8+Math.sin(a2)*4); _st.set(x+mid, 0.8, -1.5); fov=40; break; }
  }
  if(rel){ if(SALT.snap||!SALT.relOn){ _sr.copy(_sw); _srt.copy(_st); } else { var kk=1-Math.exp(-sm*dt); _sr.lerp(_sw,kk); _srt.lerp(_st,kk); }
    _sw.copy(_sr); _st.copy(_srt); _sw.x+=ax; _st.x+=ax; SALT.relOn=true; } else SALT.relOn=false;
  /* long lenses track the car tightly and zoom with it; the rest ease */
  if(SALT.snap||lens){ SALT.fov=fov; SALT.camTgt.copy(_st); } else SALT.fov+=(fov-SALT.fov)*(1-Math.exp(-5*dt));
  SALT.snap=false;
  SALT.camPos.copy(_sw); if(rel||lens) SALT.camTgt.copy(_st); else SALT.camTgt.lerp(_st, 1-Math.exp(-9*dt));
  if(SALT.camPos.y<0.25) SALT.camPos.y=0.25;
  SALT.shake*=Math.exp(-dt*4); var sh=SALT.shake; if(sh>0.002){ SALT.camPos.y+=(Math.random()-0.5)*sh*0.25; SALT.camPos.z+=(Math.random()-0.5)*sh*0.25; }
  /* buffeting at speed: a low, uneven shudder (not white noise) and a touch of roll */
  SALT.buffet=(SALT.buffet||0)+(buf-(SALT.buffet||0))*(1-Math.exp(-3*dt)); var bf=SALT.buffet, tt=SALT.t;
  if(bf>0.002){ var by=Math.sin(tt*13.1)+0.6*Math.sin(tt*29.7+1.3)+0.35*Math.sin(tt*53.3+0.4), bz=Math.sin(tt*11.3+2.1)+0.5*Math.sin(tt*31.9+0.7);
    SALT.camPos.y+=by*0.016*bf; SALT.camPos.z+=bz*0.014*bf; SALT.camTgt.y+=by*0.03*bf; }
  var cam=SALT.cam; cam.position.copy(SALT.camPos); cam.lookAt(SALT.camTgt); if(bf>0.002) cam.rotateZ((Math.sin(tt*7.3)+0.5*Math.sin(tt*19.1+1.0))*0.0045*bf);
  cam.fov=SALT.fov; cam.updateProjectionMatrix(); saltLens(cam, lens||fit);
  saltTrackVP(cam, dt);
}
function rng01(s){ var t=Math.sin(s*91.7+1.3)*43758.5453; return t-Math.floor(t); }
function saltComposer(){
  if(SALT.composer===false) return null;
  var sz=renderer.getSize(new THREE.Vector2()), pr=renderer.getPixelRatio(), C=SALT.composer;
  if(!C){ try{ C=new THREE.EffectComposer(renderer); C.addPass(new THREE.RenderPass(SALT.scene, SALT.cam));
      /* the scene pass keeps its depth (both ping-pong targets carry one), so the shimmer knows how far each pixel is */
      SALT.hasDepth=false;
      if(THREE.DepthTexture && (renderer.capabilities.isWebGL2 || renderer.extensions.has("WEBGL_depth_texture"))){
        [C.renderTarget1, C.renderTarget2].forEach(function(rt){ var dt=new THREE.DepthTexture(); dt.type=THREE.UnsignedIntType; rt.depthTexture=dt; rt.depthBuffer=true; }); SALT.hasDepth=true; }
      var hp=new THREE.ShaderPass(SALT_SHIMMER_SHADER); C.addPass(hp); SALT.shimmer=hp;
      var bp=new THREE.UnrealBloomPass(new THREE.Vector2(Math.max(1,sz.x*pr/2), Math.max(1,sz.y*pr/2)), 0.22, 0.4, 0.93); C.addPass(bp); SALT.bloom=bp;
      if(THREE.GammaCorrectionShader) C.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
      SALT.composer=C; SALT.cSize=""; }catch(e){ SALT.composer=false; return null; } }
  var key=sz.x+"x"+sz.y+"@"+pr; if(SALT.cSize!==key){ if(C.setPixelRatio) C.setPixelRatio(pr); C.setSize(sz.x, sz.y); SALT.cSize=key; }
  return C;
}
function saltRender(){
  var S4=SALT.scene, cam=SALT.cam; if(!S4||!cam) return;
  var C=(GFX!=="lite" && THREE.EffectComposer && THREE.UnrealBloomPass && THREE.RenderPass && THREE.ShaderPass) ? saltComposer() : null;
  if(C) S4.fog.color.copy(SALT.horLin); else S4.fog.color.copy(SALT.horLin).convertLinearToSRGB();
  SALT.sky.position.copy(cam.position);
  SALT.fx.mat.uniforms.uFog.value.copy(SALT.horLin);
  var V=SALT.cur, run=SALT.prev.phase==="run"||SALT.prev.phase==="shutdown"||SALT.prev.phase==="spin";
  if(C && SALT.shimmer){ /* the horizon's height on screen: a point far out along the view, down on the salt */
    _sA.set(cam.position.x, 0, cam.position.z); _sB.copy(SALT.camTgt).sub(cam.position); _sB.y=0; if(_sB.lengthSq()<1e-6) _sB.set(1,0,0); _sB.normalize();
    _sA.addScaledVector(_sB, 20000); _sA.project(cam); var hy=clamp(_sA.y*0.5+0.5, -0.5, 1.5);
    var U2=SALT.shimmer.uniforms, dep=!!SALT.hasDepth, me=V?V.userData.me:null, carD=0;
    if(V){ _sC.set(V.position.x+(me.tail+me.nose)/2, 0.6, V.position.z); carD=_sC.distanceTo(cam.position); }
    U2.tDepth.value=dep?C.readBuffer.depthTexture:null; U2.uCN.value=cam.near; U2.uCF.value=cam.far;
    U2.uHorY.value=hy; U2.uT.value=SALT.t; U2.uAmt.value=dep?(GFX==="ultra"?1.25:1):0; U2.uMir.value=dep?(cam.position.y<6?(GFX==="ultra"?1:0.8):0.25):0; U2.uAsp.value=cam.aspect;
    U2.uZoom.value=clamp(46/Math.max(1,cam.fov),0.6,12);
    U2.uWarpN.value=Math.max(300, carD+60); U2.uMirN.value=Math.max(1000, carD+250);   /* the car, and the pits near it, never swim */
    /* motion blur: the camera's own move over a 1/120 s shutter; the car's box (and its chute) stays sharp */
    var mb=dep && run && SALT.vpOk && V && SALT.vpDt>0 ? clamp((1/120)/SALT.vpDt,0,1.5) : 0; U2.uBlur.value=mb;
    if(mb>0){ U2.uInvVP.value.copy(SALT.vpInv); U2.uPrevVP.value.copy(SALT.vpPrev);
      var hx=(me.nose-me.tail)/2+0.4, hh=((me.top||1.2)+0.5)/2, chb=SALT.prev.chute?9:0, spun=SALT.prev.phase==="spin";
      U2.uBoxC.value.set(V.position.x+(me.tail+me.nose)/2-chb/2, hh, V.position.z); U2.uBoxH.value.set(spun?hx+1:hx+chb/2, hh+0.05, spun?hx+1:1.3+(chb?1:0)); } }
  if(SALT.gU){ var rl=SALT.relOn && run && V ? clamp((+SALT.prev.v||0)/120,0,1) : 0; SALT.gU.uStreak.value=rl; }   /* the crust smears near a camera riding with the car */
  var ex=renderer.toneMappingExposure; renderer.toneMappingExposure=SALT.exposure;
  var inf=renderer.info, ar=inf.autoReset; inf.autoReset=false; inf.reset();
  if(C) C.render(); else renderer.render(S4, cam);
  SALT.stats={calls:inf.render.calls, tris:inf.render.triangles, tier:GFX, shot:SALT.shot, parts:SALT.fx.P.length}; inf.autoReset=ar;
  renderer.toneMappingExposure=ex;
}
function saltReset(){
  if(SALT.fx) SALT.fx.clear(); SALT.shot=null; SALT.prev={}; SALT.shake=0; SALT.skip=false; SALT.runT=0; SALT.doneT=0; SALT.seq=0;
  SALT.pushX=0; SALT.pushZ=0; SALT.pushV=0; SALT.spinA=0;
  for(var k in SALT.cars){ var U=SALT.cars[k].userData; U.chutes.forEach(function(c){ c.visible=false; }); U.A.forEach(function(A){ A.chT=0; A.chC=0; }); if(U.strip && U.car.userData.chute) U.car.userData.chute.visible=false; }
}
function saltUpdate(o, dt){
  if(!SALT.built) buildSaltScene();
  saltLightPick(o);   /* midday, or dawn when the night toggle is on (vis/salt-look.js) */
  var S4=SALT.scene; SALT.t+=dt; var i;
  /* course layout: rebuild the traps and boards if a different course was picked */
  if(o.course && [o.course.x0,o.course.x1,o.course.xEnd].join(",")!==SALT.courseKey){ SALT.course=o.course; saltCourseProps(null, o.course, false); }
  var body=o.body||"streamliner", col=o.color!=null?o.color:0xd9a52b, aero=!!o.aero, key=body+":"+col+":"+(aero?1:0);
  if(SALT.look){ col=SALT.look.color; key=body+":"+SALT.look.key+":"+GFX+":"+(aero?1:0); if(!SALT.cars[key]) saltCarsPrune(); }   /* the player's paint / number / class / engine */
  if(!SALT.cars[key]){ SALT.cars[key]=body==="altered"?saltAltered(col, aero):saltCar(body, col, aero); S4.add(SALT.cars[key]); }
  for(var k2 in SALT.cars) SALT.cars[k2].visible=(k2===key);
  var V=SALT.cars[key], U=V.userData, me=U.me; SALT.cur=V; if(U.car) stripLivery(U.car); else if(U.livSpots) livPlanes(U.piv, U, U.livSpots);
  saltChutes(V, o.chutes==null?1:o.chutes);
  var ph=o.phase||"stage", x=+o.x||0, v=Math.max(0,+o.v||0);
  if(ph==="stage" && SALT.prev.phase && SALT.prev.phase!=="stage") saltReset();
  if(ph==="run"||ph==="shutdown") SALT.runT+=dt; if(ph==="done") SALT.doneT+=dt;
  V.position.set(x, 0, 0);
  /* spin: the car swaps ends and slides, kicking up salt */
  saltSpinPose(V, o, dt, ph);
  /* pitch: squat under power, nose-down under the chute, a little float at speed */
  var acc=+o.acc||0, tgt=clamp(acc/40,-0.25,0.3)*0.02+clamp(+o.lightness||0,0,1)*0.006;
  if(U.strip){ stripCarAnim(U.car, {v:v, acc:acc, spin:(+o.slip||0)>0.2, chute:!!o.chute, brake:ph==="shutdown"&&v<60, night:false}, dt, true); }
  else {
    var n=Math.min(8, Math.ceil(dt/0.012)), h=n?dt/n:0; for(i=0;i<n;i++){ U.pv+=(60*(tgt-U.pitch)-2*0.5*7.7*U.pv)*h; U.pitch+=U.pv*h; }
    U.piv.position.set(0, Math.sin(SALT.t*43)*0.0015*Math.min(1,v/40), 0); U.piv.rotation.z=U.pitch;
    var wr=v*(1+clamp(+o.slip||0,0,1)*1.2);
    for(i=0;i<U.wheels.length;i++){ var W=U.wheels[i], w=(W.rear?wr:v)/W.r; W.s.rotation.y=(W.s.rotation.y-w*dt)%TAU; }
    for(i=0;i<U.chutes.length;i++){ var ch=U.chutes[i], A=U.A[i], on=(o.chuteMask!=null?!!((o.chuteMask>>i)&1):!!o.chute) && !(o.chuteBlown && SALT.prev.blownT>0.8);
      if(on && !ch.visible){ ch.visible=true; A.chT=0; A.chC=0; } else if(!on && ch.visible) ch.visible=false;
      if(ch.visible){ A.pitch=U.pitch; sc_chuteAnim(ch, A, me, v, dt); } }
  }
  if(o.chuteBlown) SALT.prev.blownT=(SALT.prev.blownT||0)+dt;
  V.updateMatrixWorld(true);
  /* push truck: nose on the car's tail until the car fires and pulls away, then it peels off and stops */
  var PT=SALT.push, pu=PT.userData;
  if(ph==="stage"||ph==="push"){ SALT.pushX=x+me.tail-pu.front-0.05; SALT.pushV=v; SALT.pushZ=0; }
  else { SALT.pushV=Math.max(0, SALT.pushV-dt*3.2); SALT.pushX+=SALT.pushV*dt; SALT.pushZ=Math.max(-7, SALT.pushZ-dt*1.4*Math.min(1,SALT.pushV/4+0.2)); }
  PT.position.set(SALT.pushX, 0, SALT.pushZ); PT.rotation.y=Math.min(0.35, -SALT.pushZ*0.06)*(SALT.pushV>0.3?1:0);
  for(i=0;i<pu.wheels.length;i++) pu.wheels[i].rotation.y=(pu.wheels[i].rotation.y-SALT.pushV/0.38*dt)%TAU;
  PT.visible=SALT.pushX>x-400;
  saltEffects(o, dt, V);
  saltEventUpdate(o, dt, V, ph);
  /* flags in the wind */
  SALT.flags.forEach(function(f){ var p=f.m.geometry.attributes.position, b=f.base; for(var j=0;j<p.count;j++){ var fx=b[j*3]; p.setZ(j, Math.sin(fx*2.6-SALT.t*6+f.ph)*0.13*fx/2.0); } p.needsUpdate=true; });
  saltDirect(o, dt, V);
  /* the ground follows the camera; the sun and its shadow box ride with the car */
  SALT.ground.position.set(Math.round(SALT.camPos.x/200)*200, 0, Math.round(SALT.camPos.z/200)*200);
  var c=_sC.set(x+(me.tail+me.nose)/2, 0, 0);
  SALT.sun.position.copy(c).addScaledVector(SALT.sunDir, SALT.sunDist||150); SALT.sun.target.position.copy(c); SALT.sun.target.updateMatrixWorld();
  SALT.prev.phase=ph; SALT.prev.chute=!!o.chute; SALT.prev.v=v;
}

