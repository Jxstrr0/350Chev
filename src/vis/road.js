/* ===========================================================================
   ROAD COURSE SCENE — the road test's flying lap, a fourth world the view cuts
   to while ENGINE_VIS.setRoad({on:true, track, s, v, ...}) is fed every frame.
   Units metres. The track comes from ENGINE_SIM.roadTrack (x, y, heading,
   curvature per 2.5 m sample); world x = track x, world z = −track y, so a
   heading h faces (cos h, 0, −sin h) and a car's rotation.y is simply h.
   One world per circuit, built on first use: asphalt ribbon, kerbs on every
   corner, gravel traps on the outside, a pit straight with a timing gantry,
   grandstands, trees, the coulee hills. Scenery goes through StripBatch like
   the strip and the pull; the car is the strip's door car, scaled per chassis.
   ==========================================================================*/
var ROAD={ on:false, worlds:{}, W:null, cam:null, cars:{}, car:null, carKey:"", camPos:new THREE.Vector3(), camTgt:new THREE.Vector3(), fov:50, shot:null, shotT:0, cutT:9,
  snap:true, skip:false, night:null, tier:null, exposure:0.92, composer:null, stats:null, lastT:0, st:-1, chP:new THREE.Vector3(), chT:new THREE.Vector3(), roll:0, steer:0, mode:"auto" };
var ROAD_W=12, _rA=new THREE.Vector3(), _rB=new THREE.Vector3(), _rC=new THREE.Vector3(), _rF=new THREE.Vector3(), _rW=new THREE.Vector3(0.6,0,-0.4);
var ROAD_GLSL_GROUND=[
  "vec3 stripSurf(vec3 w, out float rough){",
  "  vec2 p=w.xz; float d=length(p-cameraPosition.xz); float fine=1.0-smoothstep(30.0,160.0,d), mid=1.0-smoothstep(150.0,1100.0,d);",
  "  float mow=step(0.5,fract((p.x*0.7+p.y*0.7)/9.0));",
  "  vec3 grass=vec3(0.10,0.155,0.052)*(0.82+0.32*sn(p*0.05))*(1.0+(mow-0.5)*0.18*mid)*(0.9+0.2*sn(p*1.9)*fine);",
  "  float inf=1.0-smoothstep(uR,uR+60.0,max(abs(p.x)-uHx,abs(p.y)-uHy)+uR);",
  "  vec2 q=(p+vec2(402.0,402.0))/805.0; vec2 cell=floor(q); float h=sh(cell+23.0);",
  "  vec3 fc= h<0.22?vec3(0.40,0.30,0.11): h<0.40?vec3(0.50,0.42,0.03): h<0.56?vec3(0.11,0.17,0.05): h<0.72?vec3(0.30,0.23,0.12): h<0.86?vec3(0.18,0.13,0.08):vec3(0.16,0.19,0.08);",
  "  float dir=step(0.5,sh(cell+3.0)); fc*=0.9+0.14*(0.5+0.5*sin(mix(p.x,p.y,dir)*1.3))*mid+0.22*(sn(p*0.006+cell*7.0)-0.5);",
  "  vec2 rp=abs(fract((p+vec2(402.0,402.0))/1609.0+0.5)-0.5)*1609.0; fc=mix(fc,vec3(0.34,0.30,0.24),1.0-smoothstep(4.0,7.0,min(rp.x,rp.y)));",
  "#if STRIP_TIER>=1",
  "  float gh; vec3 gm=sfGrassFx(p,gh); grass*=gm; fc*=mix(vec3(1.0),gm,0.55); gH=gh; gHK=1.0;",
  "#endif",
  "  vec3 c=mix(fc,grass,inf); rough=0.96; return c; }"].join("\n");
/* Full / Ultra multipliers on the painted maps: asphalt (grain, tar snakes, repair patches, oil), kerbs (chips, scuffs), gravel (stones), verge */
var ROAD_GLSL_ASPH=[
  "vec3 stripSurf(vec3 w, out float rough){ rough=0.88; gMacroK=0.55; float h; vec3 v=sfAsphFx(w.xz,1.0,h);",
  "  float rub=smoothstep(0.55,0.8,sn(w.xz*vec2(0.5,0.09)+3.0)); v*=1.0-0.1*rub; rough=mix(rough,0.8,rub); gH=h; gHK=1.0; return v; }"].join("\n");
var ROAD_GLSL_KERB=[
  "vec3 stripSurf(vec3 w, out float rough){ rough=0.7; gMacroK=0.3; vec2 p=w.xz; float g1=sn(p*23.0), g2=sn(p*79.0), fa=aaf(0.043), fb=aaf(0.0127);",
  "  float chip=smoothstep(0.7,0.9,sn(p*7.0+2.0)); float scuff=smoothstep(0.5,0.85,sn(p*vec2(0.8,2.6)+5.0));",
  "  gH=0.0032*g1*fa+0.0018*g2*fb-0.004*chip; gHK=1.0;",
  "  return vec3(1.0+0.14*(g1-0.5)*fa+0.14*(g2-0.5)*fb)*(1.0-0.32*scuff)*(1.0-0.18*chip); }"].join("\n");
var ROAD_GLSL_GRAV=[
  "vec3 stripSurf(vec3 w, out float rough){ rough=1.0; gMacroK=0.5; float h; vec3 v=sfGravelFx(w.xz,h); float rake=0.5+0.5*sin(dot(w.xz,vec2(0.4,0.9))*1.6+4.0*sn(w.xz*0.3));",
  "  gH=h+0.012*rake*aaf(0.2); gHK=1.0; return v*(1.0+0.1*(rake-0.5)); }"].join("\n");
var ROAD_GLSL_VERGE=[
  "vec3 stripSurf(vec3 w, out float rough){ rough=0.92; gMacroK=0.7; float h; vec3 v=sfAsphFx(w.xz*0.8,0.5,h); gH=h; gHK=1.0; return v; }"].join("\n");

/* --- canvas art: asphalt, kerb stripes, gravel, chequer line, banners --- */
function roadAsphaltTex(){
  var c=newCanvas(256,512), x=c.getContext("2d"), img=x.createImageData(256,512), d=img.data;
  for(var j=0;j<512;j++) for(var i=0;i<256;i++){ var n=fbm(i/256,j/512,4,6,3)*0.6+hashi(i,j,7)*0.4, k=(j*256+i)*4, u=Math.abs(i/255-0.5)*2;
    var rub=Math.exp(-Math.pow((u-0.42)/0.16,2))*0.35+Math.exp(-Math.pow(u/0.2,2))*0.12, v=44+44*n-rub*26;
    d[k]=v; d[k+1]=v+1; d[k+2]=v+4; d[k+3]=255; }
  x.putImageData(img,0,0);
  x.fillStyle="rgba(236,234,226,0.92)"; x.fillRect(5,0,7,512); x.fillRect(244,0,7,512);
  return tex(c, true);
}
function roadKerbTex(){
  var c=newCanvas(64,128), x=c.getContext("2d");
  for(var j=0;j<4;j++){ x.fillStyle=(j&1)?"#f0ede4":"#c8261c"; x.fillRect(0,j*32,64,32); }
  x.fillStyle="rgba(0,0,0,0.18)"; x.fillRect(0,0,6,128);
  return tex(c, true);
}
function roadGravelTex(){
  var c=newCanvas(128,128), x=c.getContext("2d"), img=x.createImageData(128,128), d=img.data;
  for(var j=0;j<128;j++) for(var i=0;i<128;i++){ var n=hashi(i,j,11)*0.6+fbm(i/128,j/128,3,5,9)*0.4, k=(j*128+i)*4; d[k]=150+70*n; d[k+1]=132+62*n; d[k+2]=100+50*n; d[k+3]=255; }
  x.putImageData(img,0,0); var t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}
function roadAtlas(name){
  var c=newCanvas(1024,512), x=c.getContext("2d"), F="'Chakra Petch','Arial Narrow',Arial,sans-serif";
  function panel(x0,y0,w,h,bg,fg,txt,sz,sub){ x.fillStyle=bg; x.fillRect(x0,y0,w,h); x.fillStyle=fg; x.font="700 "+sz+"px "+F; x.textAlign="center"; x.textBaseline="middle"; x.fillText(txt, x0+w/2, y0+h/2+2);
    if(sub){ x.fillStyle=sub; x.fillRect(x0,y0+h-7,w,5); } }
  panel(0,0,1024,96,"#f1ede2","#1d4787",String(name).toUpperCase(),62,"#d97757");
  panel(0,98,340,64,"#1d4787","#f4f1e8","SECTION LINE",42,"#d9a52b"); panel(342,98,340,64,"#e5701f","#141414","COULEE FUELS",42,"#141414"); panel(684,98,340,64,"#131416","#f2c22c","NORTHWIND TYRE",40,"#f2c22c");
  panel(0,164,340,64,"#2c6b3a","#f4f1e8","HALCYON GT",42); panel(342,164,340,64,"#141413","#d97757","PRAIRIE ENGINE WORKS",30,"#d97757"); panel(684,164,340,64,"#b7261d","#f4f1e8","PRAIRIE FIRE",40);
  for(var i=0;i<64;i++) for(var j=0;j<4;j++){ x.fillStyle=((i+j)&1)?"#111":"#f2f2f2"; x.fillRect(i*16, 232+j*16, 16,16); }
  panel(0,300,256,96,"#141413","#f4efe2","PIT",64,"#d97757"); panel(258,300,256,96,"#f4efe2","#c8261c","3",80); panel(514,300,256,96,"#f4efe2","#c8261c","2",80); panel(770,300,254,96,"#f4efe2","#c8261c","1",80);
  x.fillStyle="#0e1418"; x.fillRect(0,400,1024,110); for(i=0;i<16;i++){ x.fillStyle="#26343d"; x.fillRect(i*64+4,404,56,102); x.fillStyle="rgba(170,200,220,0.25)"; x.fillRect(i*64+6,406,20,98); }
  var t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=MAXANISO; return t;
}
var ROAD_UV={ name:[0,1-96/512,1,1], ban:[[0,1-162/512,340/1024,1-98/512],[342/1024,1-162/512,682/1024,1-98/512],[684/1024,1-162/512,1,1-98/512],[0,1-228/512,340/1024,1-164/512],[342/1024,1-228/512,682/1024,1-164/512],[684/1024,1-228/512,1,1-164/512]],
  cheq:[0,1-296/512,1,1-232/512], pit:[0,1-396/512,0.25,1-300/512], brd:function(i){ return [(258+i*256)/1024,1-396/512,(258+i*256+254)/1024,1-300/512]; }, win:[0,1-510/512,1,1-400/512] };

/* a ribbon along the track between lateral offsets dA..dB (+ = left of the driving line), samples i0..i1 (wrapping) */
function roadRibbon(T, i0, i1, dA, dB, y, vScale, closed){
  var N=T.N, n=closed?N+1:(((i1-i0)%N+N)%N)+1, pos=new Float32Array(n*6), nor=new Float32Array(n*6), uv=new Float32Array(n*4), idx=[], q;
  for(q=0;q<n;q++){ var i=(i0+q)%N, h=T.h[i], sx=-Math.sin(h), sy=Math.cos(h), x=T.x[i], yy=T.y[i];
    var da=typeof dA==="function"?dA(i):dA, db=typeof dB==="function"?dB(i):dB;
    pos[q*6]=x+sx*da; pos[q*6+1]=y; pos[q*6+2]=-(yy+sy*da); pos[q*6+3]=x+sx*db; pos[q*6+4]=y; pos[q*6+5]=-(yy+sy*db);
    nor[q*6+1]=1; nor[q*6+4]=1; var v=q*T.ds/vScale; uv[q*4]=0; uv[q*4+1]=v; uv[q*4+2]=1; uv[q*4+3]=v;
    if(q<n-1){ var a=q*2, b=a+1, c2=a+2, d2=a+3; if(db<da) idx.push(a,b,c2, b,d2,c2); else idx.push(a,c2,b, b,c2,d2); } }
  var g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.BufferAttribute(pos,3)); g.setAttribute("normal",new THREE.BufferAttribute(nor,3)); g.setAttribute("uv",new THREE.BufferAttribute(uv,2)); g.setIndex(idx); g.computeBoundingSphere();
  return g;
}
/* track-relative point: sample i (fractional ok), lateral offset d, height y -> world vector */
function roadPt(T, i, d, y, out){ var N=T.N, i0=Math.floor(i), f=i-i0, a=((i0%N)+N)%N, b=(a+1)%N, x=lerp(T.x[a],T.x[b],f), yy=lerp(T.y[a],T.y[b],f), h=T.h[a]+((T.h[b]-T.h[a]+PI*3)%TAU-PI)*f;
  return out.set(x-Math.sin(h)*d, y, -(yy+Math.cos(h)*d)); }
function roadHd(T, i){ var N=T.N, i0=Math.floor(i), f=i-i0, a=((i0%N)+N)%N, b=(a+1)%N; return T.h[a]+((T.h[b]-T.h[a]+PI*3)%TAU-PI)*f; }

/* the street circuit: a wall along both edges (tyres on the outside of the corners), pavement behind it, and a grid of low
   downtown blocks and grain elevators in the gaps the circuit leaves. Pushes footprints into W.bld so the trees keep clear. */
function roadStreetScenery(W, B, T, s0, s1, rng, lite){
  var N=T.N, ds=T.ds, hw=ROAD_W/2, q, sd, CONC=0xc9c4b6, TYRE=0x1a1a1c, bld=W.bld=[], S4=W.scene, M=W.mats;
  var cap=function(i,d){ var k=T.k[i%N]; return (d*k>0)?Math.sign(d)*Math.min(Math.abs(d),0.9/Math.abs(k)):d; };   // an offset on the inside of a tight corner may not pass the centre of the arc
  var inPit=function(i){ var u=i>N/2?i-N:i; return u>=s0-12 && u<=s1+12; };
  for(sd=-1;sd<=1;sd+=2){ var pv=new THREE.Mesh(roadRibbon(T, 0, 0, function(i){ return cap(i,sd*(hw+1.5)); }, function(i){ return cap(i,sd*(hw+9)); }, 0.02, 20, true), M.verge); pv.receiveShadow=true; S4.add(pv); }
  var stp=lite?3:2;
  for(q=0;q<N;q+=stp){ if(inPit(q)) continue; var h=T.h[q], out=Math.abs(T.k[q])>1/260;
    for(sd=-1;sd<=1;sd+=2){ var dw=cap(q,sd*(hw+3)), outside=out&&sd*T.k[q]<0;
      roadPt(T, q, dw, 0, _rA); B.box("solid", _rA.x, 0.5, _rA.z, stp*ds+0.4, 1.0, 0.5, CONC, h);
      if(outside){ roadPt(T, q, dw-sd*0.4, 0, _rB); B.box("solid", _rB.x, 0.36, _rB.z, stp*ds+0.2, 0.62, 0.4, (q/stp)%2?TYRE:0x2b2d30, h); }
      if((q/stp)%4===0){ roadPt(T, q, dw-sd*0.55, 0, _rB); B.add("sign","plane",[_rB.x, 0.62, _rB.z],[4.6,0.5,1],0xffffff,[0,h+(sd<0?PI:0),0],ROAD_UV.ban[((q/stp/4)|0)%6]); } } }
  /* blocks: a 44 m lattice over the map, a building wherever the circuit (and its pit buildings) leaves room */
  var cols=[0x8a4a38,0xb9a57a,0x9a9a94,0xd8d0bc,0x7d6a58,0xa4553f], roofs=[0x3c3f44,0x5a5a5a,0x4a4644], gx, gz, cell=0, nB=0, maxB=lite?46:140, R=Math.max(T.size[0],T.size[1]);
  function elev(ex, ez, s, col){
    B.box("solid", ex, 11*s, ez, 11*s, 22*s, 11*s, col); B.add("solid","prism",[ex,22*s,ez],[11.4*s,3.2*s,11.4*s],col);
    B.box("solid", ex, 27*s, ez, 4.8*s, 5*s, 5.2*s, col); B.add("solid","prism",[ex,29.5*s,ez],[5.2*s,1.8*s,5.6*s],0x4a4644);
    B.box("solid", ex+9.5*s, 7*s, ez, 8*s, 14*s, 9*s, col); B.add("solid","prism",[ex+9.5*s,14*s,ez],[8.2*s,2*s,9.4*s],0x4a4644); B.box("solid", ex-8*s, 3*s, ez, 6*s, 6*s, 7*s, 0x8a8478); }
  for(gx=-T.size[0]/2-110; gx<=T.size[0]/2+110 && nB<maxB; gx+=44){ for(gz=-T.size[1]/2-110; gz<=T.size[1]/2+110 && nB<maxB; gz+=44){ cell++;
    var r1=rng(cell*3.17), r2=rng(cell*5.41+1), r3=rng(cell*7.93+2), r4=rng(cell*2.71+3);
    var isEl=r1>0.94, w=isEl?24:18+r2*14, d=isEl?16:18+r3*14, hgt=6+r4*r4*14, cx=gx+(r2-0.5)*8, cz=gz+(r3-0.5)*8, hd=Math.hypot(w,d)/2, ok=r1>0.22;
    for(var j=0;ok&&j<N;j+=2){ var dx=T.x[j]-cx, dz=-T.y[j]-cz, lim=hd+(inPit(j)?44:20); if(dx*dx+dz*dz<lim*lim) ok=false; }
    if(!ok) continue; nB++; bld.push([cx,cz,w/2,d/2]);
    if(isEl){ elev(cx-3, cz, 0.62, r4>0.5?0x8e2f23:0xb9a57a); continue; }
    B.box("solid", cx, hgt/2, cz, w, hgt, d, cols[Math.floor(r1*cols.length*1.3)%cols.length]);
    if(r2>0.5) B.add("solid","prism",[cx,hgt,cz],[w+0.4,2+r3*2.5,d+0.4],roofs[Math.floor(r4*3)%3]); else B.box("solid", cx, hgt+0.15, cz, w+0.6, 0.3, d+0.6, roofs[Math.floor(r4*3)%3]);
    if(hgt>8){ var wy=hgt*0.55, wh=Math.min(hgt*0.5,5); B.add("sign","plane",[cx, wy, cz+d/2+0.06],[w*0.92,wh,1],0xffffff,[0,0,0],ROAD_UV.win); B.add("sign","plane",[cx, wy, cz-d/2-0.06],[w*0.92,wh,1],0xffffff,[0,PI,0],ROAD_UV.win); } } }
}

function buildRoadWorld(T){
  var W={T:T, scene:new THREE.Scene(), mats:{}, stations:[]}, S4=W.scene, lite=(GFX==="lite"), M=W.mats, N=T.N, ds=T.ds, hw=ROAD_W/2, i, k, q;
  var rng=function(s){ var t=Math.sin(s*127.1+3.7)*43758.5453; return t-Math.floor(t); };
  var street=(T.id==="street");   // the downtown circuit: walls instead of gravel, blocks of low buildings
  /* lights + sky + ground */
  var hemi=new THREE.HemisphereLight(0xcfdcf0, 0x5a5a3c, 0.22); S4.add(hemi); W.hemi=hemi;
  var sun=new THREE.DirectionalLight(0xffe6c4, 1.45); sun.shadow.mapSize.set(2048,2048); var shc=sun.shadow.camera; shc.left=-30; shc.right=30; shc.top=30; shc.bottom=-30; shc.near=1; shc.far=300; sun.shadow.bias=-0.0006; sun.shadow.normalBias=0.03;
  S4.add(sun); S4.add(sun.target); W.sun=sun;
  var sky=new THREE.Mesh(new THREE.SphereGeometry(3000, 40, 20), stripSkyMat()); sky.frustumCulled=false; sky.renderOrder=-10; S4.add(sky); W.sky=sky;
  S4.fog=new THREE.Fog(0xffffff, 300, 3200); W.fog=S4.fog;
  var gm=stripSurfMat(ROAD_GLSL_GROUND.replace(/uR/g,"60.0").replace(/uHx/g,(T.size[0]/2+90).toFixed(1)).replace(/uHy/g,(T.size[1]/2+90).toFixed(1)));
  gm.customProgramCacheKey=function(){ return "road_ground_"+T.id; };
  var ground=new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), gm); ground.rotation.x=-PI/2; ground.position.y=-0.05; ground.receiveShadow=true; S4.add(ground);
  /* asphalt, kerbs, gravel, start line */
  M.asph=stripMapMat(new THREE.MeshStandardMaterial({map:roadAsphaltTex(), roughness:0.88, metalness:0, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-2}), ROAD_GLSL_ASPH, "road_asph");
  M.kerb=stripMapMat(new THREE.MeshStandardMaterial({map:roadKerbTex(), roughness:0.7, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-3}), ROAD_GLSL_KERB, "road_kerb");
  M.grav=stripMapMat(new THREE.MeshStandardMaterial({map:roadGravelTex(), roughness:1, color:0xd8ccb4, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1}), ROAD_GLSL_GRAV, "road_grav");
  M.verge=stripMapMat(new THREE.MeshStandardMaterial({color:0x5a5d5e, roughness:0.92, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1}), ROAD_GLSL_VERGE, "road_verge");
  M.sign=new THREE.MeshStandardMaterial({map:roadAtlas(T.n), roughness:0.72});
  M.solid=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.86}); M.metal=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.42, metalness:0.65});
  M.lamp=new THREE.MeshBasicMaterial({vertexColors:true, toneMapped:false, color:0x777777});
  var road=new THREE.Mesh(roadRibbon(T, 0, 0, hw, -hw, 0.02, 20, true), M.asph); road.receiveShadow=true; S4.add(road);
  M.asph.map.repeat.set(1,1);
  /* corners: runs of samples with |k| > 1/260 (grown a little at each end) */
  var runs=[], inR=false, r0=0;
  for(i=0;i<=N;i++){ var on=i<N && Math.abs(T.k[i])>1/260; if(on&&!inR){ inR=true; r0=i; } else if(!on&&inR){ inR=false; runs.push([r0,i-1]); } }
  if(runs.length>1 && runs[0][0]===0 && runs[runs.length-1][1]===N-1){ runs[0][0]=runs[runs.length-1][0]-N; runs.pop(); }
  W.runs=runs;
  runs.forEach(function(r){ var a=r[0]-4, b=r[1]+4, mid=((((r[0]+r[1])>>1)%N)+N)%N, sg=Math.sign(T.k[mid])||1, a0=(a+N)%N, b0=(b+N)%N;
    var kin=new THREE.Mesh(roadRibbon(T, a0, b0, sg*hw, sg*(hw+1.3), 0.035, 4, false), M.kerb); kin.receiveShadow=true; S4.add(kin);
    var kout=new THREE.Mesh(roadRibbon(T, a0, b0, -sg*hw, -sg*(hw+1.5), 0.035, 4, false), M.kerb); kout.receiveShadow=true; S4.add(kout);
    var len=(b-a), ga=(a-2+N)%N, gb=(b+Math.round(36/ds)+N)%N, R=1/Math.abs(T.k[mid]||1/100), gw=clamp(9+260/R,10,22);
    var taper=function(ii){ var u=(((ii-ga)%N)+N)%N, L=(((gb-ga)%N)+N)%N, f=Math.min(1, u/6, (L-u)/10); return -sg*(hw+1.5+0.2+gw*clamp(f,0.15,1)); };
    if(!street){ var gr=new THREE.Mesh(roadRibbon(T, ga, gb, -sg*(hw+1.6), taper, 0.015, 8, false), M.grav); gr.receiveShadow=true; S4.add(gr); }
    r.sg=sg; r.ga=ga; r.gb=gb; r.gw=street?1:gw; r.R=R; r.len=len; });
  /* start/finish chequer across the track */
  var cq=new THREE.Mesh(roadRibbon(T, N-1, 0, hw, -hw, 0.04, 1, false), new THREE.MeshStandardMaterial({map:M.sign.map, roughness:0.7, polygonOffset:true, polygonOffsetFactor:-3, polygonOffsetUnits:-4}));
  (function(){ var uv=cq.geometry.attributes.uv; var R=ROAD_UV.cheq; for(var j=0;j<uv.count;j++){ uv.setXY(j, lerp(R[0],R[2],uv.getX(j)), lerp(R[1],R[3],uv.getY(j)>0?1:0)); } uv.needsUpdate=true; })();
  S4.add(cq);

  var B=new StripBatch(), CONC=0xc9c4b6, STEEL=0x8d9296, DARK=0x2a2c2f, TYRE=0x1a1a1c;
  /* barriers: tyre-faced walls behind every gravel trap, armco on the open stretches of the outside */
  runs.forEach(function(r, ri){ var L=(((r.gb-r.ga)%N)+N)%N;
    for(q=0;!street&&q<=L;q+=2){ var ii=(r.ga+q)%N, f=Math.min(1,q/6,(L-q)/10), d=-r.sg*(hw+1.9+r.gw*clamp(f,0.15,1)+0.6), h=T.h[ii]; roadPt(T, ii, d, 0, _rA);
      B.box("solid", _rA.x, 0.45, _rA.z, 5.3, 0.9, 0.5, CONC, h); B.box("solid", _rA.x-Math.sin(h)*r.sg*0.32, 0.38, _rA.z-Math.cos(h)*r.sg*0.32, 5.3, 0.62, 0.36, q%4?TYRE:0x2b2d30, h);
      if(q%4===0) B.add("sign","plane",[_rA.x-Math.sin(h)*r.sg*0.52, 0.62, _rA.z-Math.cos(h)*r.sg*0.52],[4.6,0.5,1],0xffffff,[0,h+(r.sg>0?PI:0),0],ROAD_UV.ban[(ri+q/4)%6]); }
    /* brake boards 150 / 100 / 50 m before the slow corners */
    if(r.R<70){ var app=(r.ga+N)%N; [150,100,50].forEach(function(m,bi){ var ii=((app-Math.round(m/ds))%N+N)%N, h=T.h[ii], d=-r.sg*(hw+3.2); roadPt(T, ii, d, 0, _rA);
      B.add("metal","cyl6",[_rA.x,0.6,_rA.z],[0.08,1.2,0.08],STEEL); B.add("sign","plane",[_rA.x,1.35,_rA.z],[0.9,0.6,1],0xffffff,[0,h-PI/2,0],ROAD_UV.brd(bi)); }); }
    W.stations.push({i:(((r[0]+r[1])>>1)+N)%N, d:-r.sg*(hw+1.9+r.gw+9), y:3.2+(ri%3)*1.4}); });
  /* the pit straight: the straight that holds the line; pits and pit wall inside (right), stands outside (left) */
  var s0=0, s1=0; while(Math.abs(T.k[(s0-1+N)%N])<1e-6 && s0>-N/2) s0--; while(Math.abs(T.k[(s1+1)%N])<1e-6 && s1<N/2) s1++;
  W.pit=[s0,s1];
  var pitA=s0+8, pitB=s1-8;
  var pl=new THREE.Mesh(roadRibbon(T, (pitA+N)%N, (pitB+N)%N, -(hw+4), -(hw+16), 0.02, 20, false), M.verge); pl.receiveShadow=true; S4.add(pl);
  for(q=pitA;q<=pitB;q+=2){ var ii=(q+N)%N, h=T.h[ii]; roadPt(T, ii, -(hw+3.2), 0, _rA); B.box("solid", _rA.x, 0.55, _rA.z, 5.2, 1.1, 0.5, CONC, h);
    if(q%6===0) B.add("sign","plane",[_rA.x-Math.sin(h)*0.26, 0.62, _rA.z-Math.cos(h)*0.26],[4.6,0.6,1],0xffffff,[0,h+PI,0],ROAD_UV.ban[((q/6)|0)%6]); }
  /* pit building: garages along the lane, a control tower over the line */
  var gA=s0+16, gB=Math.min(s1-30, s0+16+Math.round(220/ds));
  for(q=gA;q<gB;q+=Math.round(12/ds)){ var ii2=(q+N)%N, h2=T.h[ii2]; roadPt(T, ii2+2.4, -(hw+23), 0, _rA);
    B.box("solid", _rA.x, 3.2, _rA.z, 11.6, 6.4, 13, 0xe7e2d6, h2); roadPt(T, ii2+2.4, -(hw+16.45), 0, _rB); B.box("solid", _rB.x, 2.2, _rB.z, 9.4, 4.4, 0.1, q%2?0x2b2f35:0x3a4048, h2);
    roadPt(T, ii2+2.4, -(hw+23), 0, _rA); B.box("solid", _rA.x, 6.55, _rA.z, 12, 0.3, 14, 0x3c3f44, h2);
    roadPt(T, ii2+2.4, -(hw+16.2), 0, _rC); B.box("lamp", _rC.x, 4.55, _rC.z, 9.2, 0.16, 0.16, 0xfff0d0, h2); }   // garage lights: they glow at night
  roadPt(T, 6, -(hw+24), 0, _rA); B.box("solid", _rA.x, 7.5, _rA.z, 10, 15, 10, 0xe9e6dc, T.h[6]); roadPt(T, 6, -(hw+18.9), 0, _rB);
  B.add("sign","plane",[_rB.x, 11.6, _rB.z],[9,2.6,1],0xffffff,[0,T.h[6]+PI,0],ROAD_UV.win); B.add("sign","plane",[_rB.x, 14, _rB.z],[9,0.85,1],0xffffff,[0,T.h[6]+PI,0],ROAD_UV.name);
  roadPt(T, gA-6, -(hw+16.5), 0, _rA); B.add("sign","plane",[_rA.x, 3.4, _rA.z],[3,1.1,1],0xffffff,[0,T.h[(gA-6+N)%N]+PI,0],ROAD_UV.pit);
  /* timing gantry over the line */
  (function(){ var h=T.h[0], L=ROAD_W+4; for(var sd=-1;sd<=1;sd+=2){ roadPt(T, 0, sd*(hw+1.6), 0, _rA); B.add("metal","box",[_rA.x,3.6,_rA.z],[0.45,7.2,0.45],STEEL,[0,h,0]); }
    roadPt(T, 0, 0, 0, _rA); B.add("metal","box",[_rA.x,6.9,_rA.z],[0.7,1.1,L],DARK,[0,h,0]);
    B.add("sign","plane",[_rA.x-Math.cos(h)*0.37,6.9,_rA.z+Math.sin(h)*0.37],[L-0.6,1.0,1],0xffffff,[0,h-PI/2,0],ROAD_UV.name);
    B.add("sign","plane",[_rA.x+Math.cos(h)*0.37,6.9,_rA.z-Math.sin(h)*0.37],[L-0.6,1.0,1],0xffffff,[0,h+PI/2,0],ROAD_UV.name);
    for(var j=0;j<5;j++){ roadPt(T, 0, -2.6+j*1.3, 0, _rB); B.add("lamp","box",[_rB.x-Math.cos(h)*0.4,6.2,_rB.z+Math.sin(h)*0.4],[0.1,0.42,0.42],0xff2a18,[0,h,0]); } })();
  /* grandstands outside the pit straight */
  var stands=[]; for(q=Math.max(s0+20,-Math.round(260/ds)); q<Math.min(s1-20, Math.round(160/ds)); q+=Math.round(44/ds)) stands.push(q);
  var rows=lite?7:9, seatPts=[];
  stands.forEach(function(sq, si){ var ii=(sq+N)%N, h=T.h[ii], len=40;
    for(var r=0;r<rows;r++){ roadPt(T, ii, hw+9+r*0.85, 0, _rA); B.box("solid", _rA.x, 0.45+r*0.5, _rA.z, len, 0.9+r*1.0, 0.85, r%2?0xb9b4a8:0xa9a497, h);
      B.box("solid", _rA.x, 0.95+r*0.5+r*0.5, _rA.z, len, 0.12, 0.5, [0x1d4787,0xff7a1a,0x2c6b3a,0xb7261d][si%4], h);
      for(var p=-len/2+0.5;p<len/2-0.3;p+=0.62){ if(rng(p*3.1+r*17.7+si*5.3)>(lite?0.35:ULT()?0.88:0.6)) continue; seatPts.push([_rA.x+Math.cos(h)*p, 1.05+r*1.0, _rA.z-Math.sin(h)*p]); } }
    roadPt(T, ii, hw+9+rows*0.85*0.5, 0, _rA); B.box("solid", _rA.x, 2+rows*1.0+1.6, _rA.z, len+1, 0.25, rows*0.85+2.4, 0xe9e6dc, h);
    for(var pp=-1;pp<=1;pp+=2){ roadPt(T, ii+pp*len/2/ds, hw+9+rows*0.85, 0, _rB); B.box("metal", _rB.x, (2+rows*1.0+1.6)/2, _rB.z, 0.3, 2+rows*1.0+1.6, 0.3, STEEL, h); }
    roadPt(T, ii, hw+8.3, 0, _rB); B.add("sign","plane",[_rB.x, 0.6, _rB.z],[len*0.5,0.55,1],0xffffff,[0,h,0],ROAD_UV.ban[si%6]); });
  /* catch fence posts along the stands side of the straight */
  for(q=s0+6;q<=s1-6;q+=4){ var i3=(q+N)%N; roadPt(T, i3, hw+3.5, 0, _rA); B.box("metal", _rA.x, 1.8, _rA.z, 0.1, 3.6, 0.1, STEEL, T.h[i3]); roadPt(T, i3, hw+3.5, 0, _rA); B.box("solid", _rA.x, 0.5, _rA.z, 10.2, 1.0, 0.45, CONC, T.h[i3]); }
  /* floodlight masts down the pit straight: lamp heads that light up after dark */
  for(q=s0+10;q<=s1-10;q+=20){ var i4=(q+N)%N, h4=T.h[i4]; for(var sd2=-1;sd2<=1;sd2+=2){ roadPt(T, i4, sd2>0?hw+6.5:-(hw+3.2), 0, _rA); B.box("metal", _rA.x, 7, _rA.z, 0.35, 14, 0.35, STEEL, h4); B.box("lamp", _rA.x, 14.1, _rA.z, 2.2, 0.5, 1.0, 0xfff2d8, h4); } }
  if(street) roadStreetScenery(W, B, T, s0, s1, rng, lite);
  /* a grain elevator and a red barn beyond the back of the circuit, sheds round the paddock */
  var far=Math.max(T.size[0],T.size[1])/2;
  B.box("solid", far+180, 14, -far*0.4, 14, 28, 14, 0x8e2f23, 0.3); B.add("solid","prism",[far+180,28,-far*0.4],[14.4,3.6,14.4],0x4a4644,[0,0.3,0]); B.box("solid", far+180, 33, -far*0.4, 6, 7, 6.4, 0x8e2f23, 0.3);
  B.box("solid", far+198, 8, -far*0.4-6, 10, 16, 10, 0xb9a57a, 0.3);
  B.box("solid", -far-140, 5, far*0.5, 18, 10, 12, 0x9a2e22, 0.5); B.add("solid","prism",[-far-140,10,far*0.5],[18.4,5,12.6],0x5a5a5a,[0,0.5,0]);
  var keep=STRIP.scene; STRIP.scene=S4; B.build("solid", M.solid, !lite); B.build("metal", M.metal, !lite); W.lampMesh=B.build("lamp", M.lamp, false); B.build("sign", M.sign, false); STRIP.scene=keep;
  /* crowd in the stands */
  if(seatPts.length){ var n2=seatPts.length, bodyM=new THREE.InstancedMesh(new THREE.BoxGeometry(0.46,0.62,0.34), new THREE.MeshStandardMaterial({roughness:0.95}), n2), headM=new THREE.InstancedMesh(new THREE.BoxGeometry(0.22,0.25,0.22), new THREE.MeshStandardMaterial({roughness:0.9}), n2);
    var shirts=[0x9c3a30,0x34598f,0xcfccc4,0x1f2023,0xff7a1a,0x44684a,0xc8a640,0x5d5f66,0x8f4a5e,0x2c6b3a], skin=[0xe0b494,0xc68a64,0x8d5a3b,0xf0c9a8,0x5a3a26], mm=new THREE.Matrix4(), cc=new THREE.Color();
    for(q=0;q<n2;q++){ var p0=seatPts[q]; mm.makeTranslation(p0[0],p0[1]+0.31,p0[2]); bodyM.setMatrixAt(q,mm); mm.makeTranslation(p0[0],p0[1]+0.75,p0[2]); headM.setMatrixAt(q,mm);
      cc.set(shirts[Math.floor(rng(q*1.3)*shirts.length)]).convertSRGBToLinear(); bodyM.setColorAt(q,cc); cc.set(skin[Math.floor(rng(q*3.7)*skin.length)]).convertSRGBToLinear(); headM.setColorAt(q,cc); }
    instCull(bodyM, 1.5); instCull(headM, 1.5); S4.add(bodyM); S4.add(headM); }
  /* trees: shelterbelts and copses, kept well clear of the racing surface */
  (function(){ var ult=ULT(), pts=[], tries=lite?900:ult?3600:1800, R2=Math.max(T.size[0],T.size[1])*0.5+260, s;
    for(s=0;s<tries && pts.length<(lite?170:ult?760:380);s++){ var px=(rng(s*1.7)-0.5)*2*R2, pz=(rng(s*2.9+1)-0.5)*2*R2, ok=true;
      for(var j=0;j<N;j+=6){ var dx=T.x[j]-px, dz=-T.y[j]-pz; if(dx*dx+dz*dz<34*34){ ok=false; break; } }
      var bl=W.bld||[]; for(var bi=0;ok&&bi<bl.length;bi++){ if(Math.abs(px-bl[bi][0])<bl[bi][2]+5 && Math.abs(pz-bl[bi][1])<bl[bi][3]+5) ok=false; }
      if(ok) pts.push([px,pz,3.5+rng(s+3)*3.5]); }
    var im=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0), new THREE.MeshStandardMaterial({roughness:1}), pts.length), mm=new THREE.Matrix4(), cc=new THREE.Color();
    pts.forEach(function(p,qq){ var h=p[2]*1.7; mm.compose(_sbP.set(p[0],h*0.8,p[1]), _sbQ.set(0,0,0,1), _sbS.set(p[2],h,p[2])); im.setMatrixAt(qq,mm); cc.setHSL(0.24+rng(qq)*0.06,0.45,0.13+rng(qq+1)*0.06).convertSRGBToLinear(); im.setColorAt(qq,cc); });
    im.castShadow=!lite; instCull(im); S4.add(im); if(ult) ultraRoadTrees(S4, im, pts, rng); })();
  /* coulee hills on the horizon */
  (function(){ var seg=120, R0=2400, pos=[], col=[], idx=[], c1=sc(0x5d6a4a), c2=sc(0x7d8a70);
    for(var s=0;s<=seg;s++){ var a=s/seg*TAU, hgt=Math.max(5, 16+40*Math.pow(0.5+0.5*Math.sin(a*3.0+1.1),2)+18*Math.sin(a*11.0+1.4)*Math.sin(a*5.0)+10*Math.sin(a*23.0));
      pos.push(Math.cos(a)*(R0-500),-2,Math.sin(a)*(R0-500), Math.cos(a)*R0,hgt,Math.sin(a)*R0, Math.cos(a)*(R0+400),hgt*0.6,Math.sin(a)*(R0+400)); col.push(c1.r,c1.g,c1.b, c2.r,c2.g,c2.b, c2.r,c2.g,c2.b); }
    for(s=0;s<seg;s++){ var a0=s*3, b0=(s+1)*3; idx.push(a0,b0,a0+1, b0,b0+1,a0+1, a0+1,b0+1,a0+2, b0+1,b0+2,a0+2); }
    var g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); g.setAttribute("color",new THREE.Float32BufferAttribute(col,3)); g.setIndex(idx); g.computeVertexNormals();
    var hm=new THREE.Mesh(g, new THREE.MeshStandardMaterial({vertexColors:true, roughness:1, side:THREE.DoubleSide})); hm.frustumCulled=false; S4.add(hm); })();
  /* trackside cameras: one per corner (above), a couple down each long straight, the gantry */
  for(q=0;q<N;q+=Math.round(330/ds)){ if(Math.abs(T.k[q])<1e-6) W.stations.push({i:q, d:(q%2?1:-1)*(hw+14), y:2.6}); }
  W.stations.sort(function(a,b){ return a.i-b.i; });
  W.fx=new StripFx(lite?160:360, "smoke", stripPuffTex()); S4.add(W.fx.mesh);
  return W;
}
/* door car scaled per chassis: [length, height, width, tyre inches, wing] */
var ROAD_SHAPE={ roadster:[0.86,0.86,0.96,24.5,0], hatch:[0.84,1.07,0.97,25,0], coupe:[1,1,1,26,0], muscle:[1.06,1.0,1.04,27,0], rally:[0.95,1.05,0.99,25.5,1], pickup:[1.16,1.26,1.07,31,0], super:[1.02,0.84,1.07,27,2] };
var ROAD_PAINT={ roadster:0xc23a2b, hatch:0xe8e6df, coupe:0x1d4787, muscle:0x2b2d30, rally:0x2a6db5, pickup:0x8e2f23, super:0xff7a1a };
function roadCarMesh(ch){
  var sp=ROAD_SHAPE[ch]||ROAD_SHAPE.coupe, car=stripCar("street", ROAD_PAINT[ch]||0xa32a26, sp[3]), U=car.userData, me=U.meta, B=U.bodyGroup;
  B.scale.set(sp[0], sp[1], sp[2]);
  for(var i=0;i<U.carriers.length;i++){ var C=U.carriers[i]; if(!C.userData.rear) C.position.x=me.xr+(me.xf-me.xr)*sp[0]; C.position.z*=sp[2]; }
  if(sp[4]){ var wm=new THREE.MeshStandardMaterial({color:sc(sp[4]>1?0x15171b:0xf0ede4), roughness:0.5, metalness:0.2}), g=new THREE.Group();
    var plane=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.04,1.5), wm); plane.position.set(-2.12,1.13,0); plane.rotation.z=0.12; g.add(plane);
    for(var s=-1;s<=1;s+=2){ var st=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.22,0.03), wm); st.position.set(-2.06,1.0,s*0.48); g.add(st); }
    g.children.forEach(function(m){ m.castShadow=true; }); U.bodyGroup.children[0].add(g); }
  car.traverse(function(o){ if(o.isMesh){ o.castShadow=true; } });
  U.roadCh=ch; return car;
}
function roadSetNight(W, on){
  on=!!on; var tierChanged=W.tier!==GFX; if(W.night===on && !tierChanged) return;
  W.night=on; W.tier=GFX; var lite=(GFX==="lite");
  W.sky.material.uniforms.uNight.value=on?1:0;
  var h=on?STRIP_HOR_N:STRIP_HOR; W.horLin=new THREE.Color(h[0],h[1],h[2]); W.sunDir=on?STRIP_MOON:STRIP_SUN_DAY;
  W.sun.color.set(on?0x9fb2d6:0xffe2bc); W.sun.intensity=on?0.16:1.45; W.sun.castShadow=!lite;
  W.hemi.intensity=on?0.14:0.22; W.hemi.color.set(on?0x3a4764:0xcfdcf0);
  W.mats.lamp.color.set(on?0xffffff:0x777777); if(!lite) ultraShadow(W.sun, 2048);
  W.scene.environment=stripEnv(on); W.exposure=on?1.05:0.9;
  if(W.fx){ W.fx.mat.uniforms.uAmb.value=on?0.42:1; W.fx.mat.uniforms.uFogN.value=W.fog.near; W.fx.mat.uniforms.uFogF.value=W.fog.far; }
  if(tierChanged && W.sun.shadow.map){ W.sun.shadow.map.dispose(); W.sun.shadow.map=null; }
  if(!W.head){ W.head=new THREE.SpotLight(0xfff2dc, 0, 120, 0.5, 0.5, 1.4); W.scene.add(W.head); W.scene.add(W.head.target); }
  W.head.intensity=on?3.2:0;
}
/* ---------------------------------------------------------------------------
   24 HOURS: the rest of the field and the turning day.
   The other cars are four InstancedMeshes (body, cabin, headlamps, tail lamps) sharing
   one matrix per car, coloured by class, so twenty cars cost four draw calls. The sky runs
   continuously from day through dusk to night and back (uNight is a mix), the sun sinks and
   warms, the pits and the floodlights come on, and at time-lapse speeds the camera holds a
   tower shot over the pit straight while the app draws only a few frames a second.
   -------------------------------------------------------------------------*/
var E24_PAINT=[[0xf2f0ea,0x1d4787,0xff7a1a,0x2b2d30,0xc23a2b,0x2a6db5],[0x2a6db5,0xd9a52b,0x2c6b3a,0xb7261d,0xe8e6df,0x5a5f65],[0xffd23a,0x6b8e23,0xb7261d,0x3a9ad9,0xe8e6df,0x8e2f23]];
var _rM=new THREE.Matrix4(), _rQ=new THREE.Quaternion(), _rS=new THREE.Vector3(1,1,1), _rS0=new THREE.Vector3(0,0,0), _rY=new THREE.Vector3(0,1,0), _rCol=new THREE.Color();
function roadFieldBuild(W){
  if(W.ai) return W.ai;
  var n=24, lite=(GFX==="lite"), A={n:n, key:""};
  var bodyG=new THREE.BoxGeometry(4.4,0.72,1.86); bodyG.translate(0,0.56,0);
  var cabG=new THREE.BoxGeometry(2.0,0.52,1.5); cabG.translate(-0.4,1.17,0);
  var headG=new THREE.BoxGeometry(0.08,0.13,1.5); headG.translate(2.19,0.66,0);
  var tailG=new THREE.BoxGeometry(0.08,0.11,1.6); tailG.translate(-2.19,0.74,0);
  A.mBody=new THREE.MeshStandardMaterial({roughness:0.45, metalness:0.12});
  A.mCab=new THREE.MeshStandardMaterial({color:0x14161a, roughness:0.2, metalness:0.6});
  A.mHead=new THREE.MeshBasicMaterial({color:0x6b6b6b, toneMapped:false}); A.mTail=new THREE.MeshBasicMaterial({color:0x5a1410, toneMapped:false});
  A.body=new THREE.InstancedMesh(bodyG, A.mBody, n); A.cab=new THREE.InstancedMesh(cabG, A.mCab, n); A.head=new THREE.InstancedMesh(headG, A.mHead, n); A.tail=new THREE.InstancedMesh(tailG, A.mTail, n);
  [A.body,A.cab,A.head,A.tail].forEach(function(m){ m.count=0; m.frustumCulled=false; m.castShadow=(m===A.body||m===A.cab)&&!lite; W.scene.add(m); });
  for(var i=0;i<n;i++){ A.body.setColorAt(i, _rCol.set(0xffffff)); }
  return (W.ai=A);
}
/* field: [{s (m), d (lateral m), cls 0..2, k (paint slot), pit (bool), slot (garage), hide}] */
function roadFieldUpdate(W, T, field, night){
  var A=roadFieldBuild(W), n=field?Math.min(field.length, A.n):0, N=T.N, hw=ROAD_W/2;
  var key=""; for(var i=0;i<n;i++) key+=field[i].cls+":"+field[i].k+",";
  if(key!==A.key){ A.key=key; for(i=0;i<n;i++){ var pal=E24_PAINT[field[i].cls]||E24_PAINT[0]; A.body.setColorAt(i, _rCol.set(pal[field[i].k%pal.length]).convertSRGBToLinear()); } if(A.body.instanceColor) A.body.instanceColor.needsUpdate=true; }
  for(i=0;i<n;i++){ var f=field[i], fi, d, h;
    if(f.hide){ _rM.compose(_rA.set(0,-50,0), _rQ.set(0,0,0,1), _rS0); }
    else { if(f.pit){ fi=W.pit[0]+16+(f.slot||0)*Math.round(12/T.ds)+2.4+(f.lane||0)*30; d=-(hw+10.5); } else { fi=(f.s||0)/T.ds; d=f.d||0; }
      fi=((fi%N)+N)%N; h=roadHd(T, fi); roadPt(T, fi, d, 0, _rA); _rQ.setFromAxisAngle(_rY, h); _rM.compose(_rA, _rQ, _rS); }
    A.body.setMatrixAt(i,_rM); A.cab.setMatrixAt(i,_rM); A.head.setMatrixAt(i,_rM); A.tail.setMatrixAt(i,_rM); }
  [A.body,A.cab,A.head,A.tail].forEach(function(m){ m.count=n; m.instanceMatrix.needsUpdate=true; });
  if(A.wheel||ULT()) ultraRoadWheels(W, A, n);
  var nk=clamp((night-0.25)/0.5,0,1); A.mHead.color.setRGB(0.42+2.2*nk, 0.42+2.1*nk, 0.4+1.8*nk); A.mTail.color.setRGB(0.35+1.6*nk, 0.06+0.12*nk, 0.05+0.08*nk);
}
function roadFieldHide(W){ if(W&&W.ai) [W.ai.body,W.ai.cab,W.ai.head,W.ai.tail,W.ai.wheel].forEach(function(m){ if(m) m.count=0; }); }
/* continuous sky: n = 0 day … 1 night, warm = dusk/dawn glow. Binary parts (env map, lamps, headlight) switch at half-dark */
var _skyD=new THREE.Vector3(), _skyE=new THREE.Vector3(), _skyW=new THREE.Vector3(-0.95,0.06,0.3).normalize();
function roadSetSky(W, n, warm, east){
  roadSetNight(W, n>0.5);
  var key=n.toFixed(3)+"|"+warm.toFixed(3)+"|"+GFX+"|"+W.night+"|"+!!east; if(W.skyKey===key) return; W.skyKey=key;
  var U=W.sky.material.uniforms, wd=warm*(1-n);
  U.uNight.value=n;
  var hd=STRIP_HOR, hn=STRIP_HOR_N, dusk=[0.86,0.5,0.3];
  U.uHor.value.set(lerp(hd[0],dusk[0],wd), lerp(hd[1],dusk[1],wd), lerp(hd[2],dusk[2],wd));
  _skyE.set(-_skyW.x, _skyW.y, -_skyW.z); _skyD.copy(STRIP_SUN_DAY).lerp(east?_skyE:_skyW, clamp(warm*1.2+n,0,1)).normalize();   // dusk in the west, dawn in the east U.uSun.value.copy(_skyD);
  var hz=U.uHor.value; W.horLin=new THREE.Color(lerp(hz.x,hn[0],n), lerp(hz.y,hn[1],n), lerp(hz.z,hn[2],n));
  W.sunDir=n>0.5?STRIP_MOON:_skyD;
  W.sun.color.setRGB(lerp(1,1,wd), lerp(0.89,0.62,wd), lerp(0.74,0.4,wd)); if(n>0.5) W.sun.color.set(0x9fb2d6);
  W.sun.intensity=n>0.5?0.16+0.3*(1-n):1.45*(1-0.4*wd)*(1-n)+0.16*n;
  W.hemi.intensity=lerp(0.22,0.14,n); W.hemi.color.set(n>0.5?0x3a4764:0xcfdcf0);
  W.exposure=lerp(0.9,1.05,n);
  W.mats.lamp.color.set(n>0.3?0xffffff:0x777777);
  if(W.head) W.head.intensity=n>0.3?3.2:0;
}
function roadSkyReset(W){ if(!W||W.skyKey==null) return; W.skyKey=null; W.night=null; var U=W.sky.material.uniforms; U.uHor.value.fromArray(STRIP_HOR); U.uSun.value.copy(STRIP_SUN_DAY); }
function roadDirect(o, dt, W, car){
  var T=W.T, N=T.N, fi=(o.s||0)/T.ds, h=roadHd(T, fi), v=Math.max(0,+o.v||0), mode=o.cam||"auto", s=ROAD.shot;
  var fx=Math.cos(h), fz=-Math.sin(h);
  /* the 24 Hours at time-lapse speed: a tower shot down the pit straight, the field streaming at it */
  if(mode==="tower"){ var i1=W.pit[1]-6; roadPt(T, i1, ROAD_W/2+30, 21, ROAD.camPos); roadPt(T, i1-Math.round(190/T.ds), -3, 0, ROAD.camTgt); sceneCut(ROAD, "tower"); ROAD.shotT+=dt; ROAD.fov=46; ROAD.snap=false;
    var tc=ROAD.cam; tc.position.copy(ROAD.camPos); tc.lookAt(ROAD.camTgt); tc.fov=46; tc.updateProjectionMatrix(); bandLens(tc); return; }
  /* nearest trackside camera ahead of (or just past) the car */
  var best=-1, bd=1e9; for(var q=0;q<W.stations.length;q++){ var st=W.stations[q], d=((st.i-fi)%N+N)%N; if(d>N/2) d-=N; var m=d*T.ds; if(m>-45 && m<150 && Math.abs(m-30)<bd){ bd=Math.abs(m-30); best=q; } }
  if(mode==="chase") s="chase"; else if(mode==="onboard") s="onboard"; else if(mode==="side") s=best>=0?"side":"chase";
  else { if(o.pre) s="gantry"; else if(s==="gantry" && ROAD.shotT<2.6) s="gantry"; else if(best>=0 && (s!=="side"||ROAD.st===best) && !(s==="chase" && ROAD.shotT<3.5)) s="side"; else if(s==="side" && best!==ROAD.st) s=(ROAD.shotT>3.2 && best>=0)?"side":"chase"; else if(s!=="side") s=(s==="onboard"&&ROAD.shotT<5)?"onboard":(s==="chase"&&ROAD.shotT>9&&v>25)?"onboard":"chase"; }
  if(s==="side" && best!==ROAD.st){ ROAD.st=best; ROAD.shot=null; }
  sceneCut(ROAD, s); ROAD.shotT+=dt; ROAD.cutT+=dt;
  var cp=car.position, fov=50;
  if(s==="chase"){ _rA.set(cp.x-fx*6.8, cp.y+2.25, cp.z-fz*6.8); _rB.set(cp.x+fx*5, cp.y+0.8, cp.z+fz*5);
    if(ROAD.snap){ ROAD.chP.copy(_rA); ROAD.chT.copy(_rB); } else { var k1=1-Math.exp(-dt*7), k2=1-Math.exp(-dt*12); ROAD.chP.lerp(_rA,k1); ROAD.chT.lerp(_rB,k2); }
    ROAD.camPos.copy(ROAD.chP); ROAD.camTgt.copy(ROAD.chT); fov=56+Math.min(10,v*0.12); }
  else if(s==="onboard"){ var bx=-0.15; ROAD.camPos.set(cp.x+fx*bx, cp.y+1.18, cp.z+fz*bx); ROAD.camTgt.set(cp.x+fx*20, cp.y+0.9, cp.z+fz*20); fov=68; }
  else if(s==="gantry"){ roadPt(T, 0, -(ROAD_W/2+4), 0, _rA); _rA.y=7.6; roadPt(T, -Math.round(10/T.ds), 0, 0, _rB); ROAD.camPos.copy(_rA); ROAD.camTgt.lerp(_rC.set(cp.x, cp.y+0.6, cp.z), ROAD.snap?1:1-Math.exp(-dt*8)); fov=40; }
  else { var st2=W.stations[ROAD.st]; roadPt(T, st2.i, st2.d, st2.y, ROAD.camPos); _rC.set(cp.x, cp.y+0.7, cp.z); if(ROAD.snap) ROAD.camTgt.copy(_rC); else ROAD.camTgt.lerp(_rC, 1-Math.exp(-dt*10));
    var dist=ROAD.camPos.distanceTo(_rC); fov=clamp(2*Math.atan(5.5/Math.max(1,dist))*180/PI, 9, 55); }
  if(ROAD.snap){ ROAD.fov=fov; ROAD.snap=false; } else ROAD.fov+=(fov-ROAD.fov)*(1-Math.exp(-dt*6));
  var cam=ROAD.cam; cam.position.copy(ROAD.camPos); cam.lookAt(ROAD.camTgt); cam.fov=ROAD.fov; cam.updateProjectionMatrix(); bandLens(cam);
}
function roadComposer(){
  if(ROAD.composer===false) return null;
  var sz=renderer.getSize(new THREE.Vector2()), pr=renderer.getPixelRatio(), C=ultraComposerKeep(ROAD.composer);
  if(!C){ try{ C=ultraComposerMark(new THREE.EffectComposer(renderer, ultraRT())); C.rp=ultraRenderPass(ROAD.W.scene, ROAD.cam, "road"); C.addPass(C.rp);
      var bp=new THREE.UnrealBloomPass(new THREE.Vector2(Math.max(1,sz.x*pr/2), Math.max(1,sz.y*pr/2)), 0.25, 0.4, 0.92); C.addPass(bp); ROAD.bloom=bp;
      if(THREE.GammaCorrectionShader) C.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
      ROAD.composer=C; ROAD.cSize=""; }catch(e){ ROAD.composer=false; return null; } }
  C.rp.scene=ROAD.W.scene;
  var key=sz.x+"x"+sz.y+"@"+pr; if(ROAD.cSize!==key){ if(C.setPixelRatio) C.setPixelRatio(pr); C.setSize(sz.x, sz.y); ROAD.cSize=key; }
  var n=!!ROAD.W.night, b=ROAD.bloom; b.strength=n?0.55:0.22; b.threshold=n?0.7:0.92;
  return C;
}
function roadRender(){
  var W=ROAD.W, cam=ROAD.cam; if(!W||!cam) return;
  var C=(GFX!=="lite" && THREE.EffectComposer && THREE.UnrealBloomPass && THREE.RenderPass && THREE.ShaderPass) ? roadComposer() : null;
  if(C) W.fog.color.copy(W.horLin); else W.fog.color.copy(W.horLin).convertLinearToSRGB();
  W.sky.position.copy(cam.position); if(W.fx) W.fx.mat.uniforms.uFog.value.copy(W.horLin);
  var ex=renderer.toneMappingExposure; renderer.toneMappingExposure=W.exposure;
  var inf=renderer.info, ar=inf.autoReset; inf.autoReset=false; inf.reset();
  if(C) C.render(); else renderer.render(W.scene, cam);
  ROAD.stats={calls:inf.render.calls, tris:inf.render.triangles, tier:GFX, shot:ROAD.shot, track:W.T.id}; inf.autoReset=ar;
  renderer.toneMappingExposure=ex;
}
function roadUpdate(o, dt){
  var T=o.track; if(!T) return;
  var W=ROAD.worlds[T.id]; if(!W){ W=ROAD.worlds[T.id]=buildRoadWorld(T); }
  if(ROAD.W!==W){ if(ROAD.car && ROAD.car.parent) ROAD.car.parent.remove(ROAD.car); ROAD.W=W; ROAD.carKey=""; ROAD.snap=true; ROAD.shot=null; }
  if(o.sky!=null) roadSetSky(W, clamp(+o.sky,0,1), clamp(+o.warm||0,0,1), !!o.dawn);
  else { if(W.skyKey!=null) roadSkyReset(W); if(W.tier!==GFX || W.night!==!!o.night) roadSetNight(W, !!o.night); }
  if(o.field) roadFieldUpdate(W, T, o.field, +o.sky||0); else roadFieldHide(W);
  var ch=o.ch||"coupe"; if(!ROAD.cars[ch]) ROAD.cars[ch]=roadCarMesh(ch);
  var car=ROAD.cars[ch]; if(ROAD.carKey!==ch || car.parent!==W.scene){ if(ROAD.car && ROAD.car.parent) ROAD.car.parent.remove(ROAD.car); W.scene.add(car); ROAD.car=car; ROAD.carKey=ch; }
  var N=T.N, fi=((o.s||0)/T.ds%N+N)%N; if(o.pit) fi=((W.pit[0]+18.4)%N+N)%N;   // in the pits: parked at the first garage
  var h=roadHd(T, fi), v=Math.max(0,+o.v||0);
  roadPt(T, fi, o.pit?-(ROAD_W/2+10.5):(+o.d||0), 0, car.position); car.rotation.set(0, h, 0);
  /* steering: front wheels to the path's curvature (bicycle model), body roll to the lateral g */
  var k=T.k[Math.floor(fi)%N]||0, U=car.userData, stT=Math.atan(2.6*k)*1.15;
  ROAD.steer+=(stT-ROAD.steer)*Math.min(1,dt*10); for(var i=0;i<U.carriers.length;i++){ var Cw=U.carriers[i]; if(!Cw.userData.rear) Cw.rotation.y=ROAD.steer; }
  stripCarAnim(car, {v:v, acc:(+o.ax||0)*9.81, brake:(+o.brk||0)>0.05, night:!!o.night, lift:0}, dt, true);
  var su=o.su||null, rk=su?su.rk:1, rollT=clamp(-(+o.ay||0)*0.03*rk,-0.07*rk,0.07*rk); ROAD.roll+=(rollT-ROAD.roll)*Math.min(1,dt*6); U.bodyGroup.rotation.x+=ROAD.roll;
  stripSetupLean(car, su, +o.ay||0, +o.ax||0, ROAD.sx||(ROAD.sx={dv:0,lf:0,lr:0}), dt);
  /* a puff of tyre smoke and dust when it runs out of grip on exit, or locks a wheel */
  if(W.fx){ var sl=(+o.slip||0); if(sl>0.2 && v>4 && Math.random()<sl*dt*30){ roadPt(T, fi-1.2, (Math.random()-0.5)*1.6, 0.3, _rA); W.fx.emit(_rA.x,0.25,_rA.z,(Math.random()-0.5),0.35,(Math.random()-0.5),1.3,0.6,2.6,0.84,0.84,0.84,0.18,{drag:0.6,buoy:0.15}); }
    W.fx.step(dt, _rW); }
  roadDirect(o, dt, W, car);
  var c=_rA.copy(ROAD.camPos).lerp(car.position, 0.7); c.y=0;
  W.sun.position.copy(c).addScaledVector(W.sunDir, 160); W.sun.target.position.copy(c); W.sun.target.updateMatrixWorld();
  if(W.head && W.head.intensity>0){ W.head.position.set(car.position.x+Math.cos(h)*2.2, 0.9, car.position.z-Math.sin(h)*2.2); W.head.target.position.set(car.position.x+Math.cos(h)*30, 0, car.position.z-Math.sin(h)*30); W.head.target.updateMatrixWorld(); }
}

