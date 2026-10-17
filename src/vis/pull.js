/* ===========================================================================
   PULL TRACK SCENE (DIESEL) — truck & tractor pulling, a third world the view
   cuts to while ENGINE_VIS.setPull({on:true, ...}) is fed every frame.
   Units metres. x = distance down the track (start line 0, 300 ft line 91.44),
   y up, z across: bleachers on the far side (z < 0), cameras on the near side.
   The vehicle's hitch sits at state.x and the sled trails it on a chain.
   Scenery goes through StripBatch like the strip; dirt, dust, diesel smoke and
   confetti are StripFx billboard systems (one draw each). Built on first use.
   ==========================================================================*/
var PULL={ on:false, built:false, scene:null, cam:null, sun:null, hemi:null, flood:null, sky:null, fog:null, mats:{}, geo:{},
  veh:{}, cur:null, sled:null, chain:null, board:null, crowd:null, poles:[], spots:[], fx:null, fxDirt:null, fxConf:null,
  camPos:new THREE.Vector3(), camTgt:new THREE.Vector3(), fov:44, shot:null, shotT:0, cutT:9, snap:true, relOn:false, skip:false,
  t:0, pullT:0, doneT:0, cheer:0, night:null, tier:null, prev:{}, x0:null, lastT:0, composer:null, exposure:0.92, stats:null,
  flags:[], wheel:null, ruts:null, horLin:null, sunDir:null, tension:0, shake:0, fixX:0 };
var PULL_LINE=91.44, PULL_END=112, PULL_CHAIN=1.4, PULL_BOX0=-8.25, PULL_BOX1=-1.55, PULL_SLED_L=9.9;
var PULL_WIND=new THREE.Vector3(-1.1,0,-0.75), _sbX=new THREE.Vector3(1,0,0), _pA=new THREE.Vector3(), _pB=new THREE.Vector3(), _pC=new THREE.Vector3(), _pD=new THREE.Vector3(),
  _pw=new THREE.Vector3(), _pt=new THREE.Vector3(), _pr=new THREE.Vector3(), _prt=new THREE.Vector3(), _pM=new THREE.Matrix4(), _pQ=new THREE.Quaternion();
/* packed dirt: old ruts from earlier hooks, the pan's smooth centre band, lime lines (start, every 50 ft, the 300 ft line) */
var PULL_GLSL_TRACK=[
  "vec3 stripSurf(vec3 w, out float rough){",
  "  float x=w.x, z=w.z, az=abs(z); float d=length(w-cameraPosition);",
  "  float fine=1.0-smoothstep(12.0,55.0,d);",
  "  float n1=sn(w.xz*vec2(0.3,0.8)), n2=sn(w.xz*3.1), n3=sn(w.xz*17.0);",
  "  vec3 c=vec3(0.30,0.205,0.125)*(0.8+0.32*n1)+vec3(0.05,0.04,0.03)*(n2-0.5)+vec3(0.05,0.04,0.03)*(n3-0.5)*fine;",
  "  float wob=sn(vec2(x*0.07,z>0.0?3.0:9.0))-0.5;",
  "  float r1=exp(-pow((az-0.93-wob*0.35)/0.2,2.0)), r2=exp(-pow((az-1.2-wob*0.25)/0.33,2.0))*0.85;",
  "  float lug=0.55+0.45*sin(x*16.0+az*7.0)*fine;",
  "  float rut=clamp((r1+r2)*lug,0.0,1.0)*smoothstep(-6.0,-2.0,x);",
  "  float pan=(1.0-smoothstep(1.35,1.75,az))*smoothstep(-12.0,-6.0,x);",
  "  c=mix(c,c*vec3(0.62,0.6,0.58),rut*0.75);",
  "  c=mix(c,c*1.14+vec3(0.025,0.018,0.01),pan*0.45*(1.0-rut*0.6));",
  "  float berm=exp(-pow((az-1.7)/0.12,2.0))*smoothstep(-8.0,-2.0,x)*(0.6+0.4*n2);",
  "  c=mix(c,c*0.78,berm*0.6);",
  "  float edge=smoothstep(4.4,6.1,az); c=mix(c,c*vec3(0.72,0.7,0.68)+vec3(0.0,0.0,0.0),edge*(0.6+0.4*n1));",
  "  float ln=1.0-smoothstep(0.06,0.09,abs(x));",
  "  ln=max(ln,1.0-smoothstep(0.15,0.19,abs(x-91.44)));",
  "  float t50=abs(fract(x/15.24+0.5)-0.5)*15.24;",
  "  ln=max(ln,(1.0-smoothstep(0.06,0.09,t50))*smoothstep(4.3,4.5,az)*step(1.0,x)*step(x,90.0));",
  "  ln*=0.6+0.4*smoothstep(0.2,0.6,sn(w.xz*vec2(5.0,9.0)));",
  "  c=mix(c,vec3(0.80,0.78,0.72),ln*0.92);",
  "  rough=0.97-0.08*pan; return c; }"].join("\n");
/* fairground: trampled grass, gravel apron, the pit lot; section-line fields beyond */
var PULL_GLSL_GROUND=[
  "vec3 stripSurf(vec3 w, out float rough){",
  "  vec2 p=w.xz; float d=length(p-cameraPosition.xz); float fine=1.0-smoothstep(20.0,120.0,d), mid=1.0-smoothstep(100.0,900.0,d);",
  "  vec3 grass=vec3(0.11,0.155,0.055)*(0.8+0.35*sn(p*0.08))*(0.9+0.2*sn(p*1.9)*fine);",
  "  float worn=smoothstep(0.5,0.8,sn(p*0.06+3.0))*0.6;",
  "  vec3 c=mix(grass,vec3(0.27,0.21,0.14)*(0.85+0.3*sn(p*0.7)),worn);",
  "  float apron=(1.0-smoothstep(9.0,9.5,abs(p.y)))*smoothstep(-36.0,-35.0,p.x)*(1.0-smoothstep(128.0,129.0,p.x));",
  "  c=mix(c,vec3(0.34,0.31,0.27)*(0.8+0.4*sn(p*2.3)),apron);",
  "  float pit=smoothstep(19.0,20.0,p.y)*(1.0-smoothstep(54.0,55.0,p.y))*smoothstep(-42.0,-41.0,p.x)*(1.0-smoothstep(122.0,123.0,p.x));",
  "  c=mix(c,vec3(0.30,0.27,0.22)*(0.8+0.35*sn(p*0.9)),pit);",
  "  vec2 q=(p+vec2(800.0,800.0))/805.0; vec2 cell=floor(q); float h=sh(cell+11.0);",
  "  vec3 fc= h<0.25?vec3(0.40,0.30,0.11): h<0.45?vec3(0.50,0.42,0.03): h<0.62?vec3(0.11,0.17,0.05): h<0.8?vec3(0.30,0.23,0.12):vec3(0.18,0.13,0.08);",
  "  float dir=step(0.5,sh(cell+3.0)); fc*=0.9+0.14*(0.5+0.5*sin(mix(p.x,p.y,dir)*1.3))*mid+0.22*(sn(p*0.006+cell*7.0)-0.5);",
  "  vec2 rp=abs(fract((p+vec2(800.0,800.0))/1609.0+0.5)-0.5)*1609.0; fc=mix(fc,vec3(0.34,0.30,0.24),1.0-smoothstep(4.0,7.0,min(rp.x,rp.y)));",
  "  float fair=1.0-smoothstep(150.0,175.0,max(abs(p.x-40.0),abs(p.y)));",
  "  c=mix(fc,c,fair); rough=0.96; return c; }"].join("\n");

/* --- canvas art: banners, distance markers, the sled's sign, door decal --- */
function pullAtlas(){
  var c=newCanvas(1024,512), x=c.getContext("2d"), F="'Chakra Petch','Arial Narrow',Arial,sans-serif", i;
  function panel(x0,y0,w,h,bg,fg,txt,sz,sub){ x.fillStyle=bg; x.fillRect(x0,y0,w,h); x.fillStyle=fg; x.font="700 "+sz+"px "+F; x.textAlign="center"; x.textBaseline="middle"; x.fillText(txt, x0+w/2, y0+h/2+2, w-16);
    if(sub){ x.fillStyle=sub; x.fillRect(x0,y0+h-7,w,5); } }
  panel(0,0,340,64,"#d97757","#141413","PRAIRIE ENGINE WORKS",31,"#141413");
  panel(342,0,340,64,"#141413","#d97757","COULEE FUELS",42,"#d97757");
  panel(684,0,340,64,"#131416","#f2c22c","NORTHWIND TYRE",40,"#f2c22c");
  panel(0,66,1024,62,"#141413","#d97757","PRAIRIE ENGINE WORKS · TRUCK & TRACTOR PULL",40,"#d97757");
  panel(0,130,254,64,"#1d4787","#f4f1e8","SECTION LINE",34,"#d9a52b"); panel(256,130,254,64,"#b7261d","#f4f1e8","PRAIRIE FIRE",34);
  panel(512,130,254,64,"#2c6b3a","#f4f1e8","HALCYON GT",36); panel(768,130,256,64,"#f1ede2","#141413","DIESEL DAYS",36,"#d97757");
  var mk=["50","100","150","200","250","300"];
  for(i=0;i<6;i++){ var bx=i*171; x.fillStyle="#141413"; x.fillRect(bx,196,169,122); x.fillStyle=i===5?"#d97757":"#f4efe2"; x.fillRect(bx+6,202,157,110); x.fillStyle="#141413"; x.font="700 76px "+F; x.textAlign="center"; x.textBaseline="middle"; x.fillText(mk[i], bx+84, 252); x.font="700 22px "+F; x.fillText("FEET", bx+84, 298); }
  panel(0,322,510,120,"#141413","#d97757","PRAIRIE ENGINE WORKS",54,"#d97757");
  panel(512,322,512,120,"#d97757","#141413","PULL OFF",70,"#141413");
  panel(0,446,510,64,"#f1ede2","#9e2a22","FRIES · PIE · LEMONADE",34,"#9e2a22");
  panel(512,446,512,64,"#141413","#f1ede2","GRANDSTAND · SECTION B",34,"#d97757");
  var t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=MAXANISO; return t;
}
var PULL_UV={ ban:[[0,1-64/512,340/1024,1],[342/1024,1-64/512,682/1024,1],[684/1024,1-64/512,1,1],[0,1-194/512,254/1024,1-130/512],[256/1024,1-194/512,510/1024,1-130/512],[512/1024,1-194/512,766/1024,1-130/512],[768/1024,1-194/512,1,1-130/512]],
  long:[0,1-128/512,1,1-66/512], mark:function(i){ return [i*171/1024, 1-318/512, (i*171+169)/1024, 1-196/512]; },
  sled:[0,1-442/512,510/1024,1-322/512], pulloff:[512/1024,1-442/512,1,1-322/512], food:[0,1-510/512,510/1024,1-446/512], stand:[512/1024,1-510/512,1,1-446/512] };
function pullDecalMat(num){
  var c=newCanvas(512,160), x=c.getContext("2d"), F="'Chakra Petch','Arial Narrow',Arial,sans-serif";
  x.clearRect(0,0,512,160); x.textAlign="left"; x.textBaseline="middle";
  x.font="italic 700 92px "+F; x.lineWidth=10; x.strokeStyle="#111"; x.strokeText(num, 14, 66); x.fillStyle="#f4f1e8"; x.fillText(num, 14, 66);
  x.font="700 34px "+F; x.fillStyle="#d97757"; x.strokeStyle="#111"; x.lineWidth=6; x.strokeText("PRAIRIE ENGINE WORKS", 14, 132); x.fillText("PRAIRIE ENGINE WORKS", 14, 132);
  x.fillStyle="#d97757"; x.fillRect(150,40,340,10); x.fillRect(150,62,300,10); x.fillRect(150,84,260,10);
  var t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=MAXANISO;
  return new THREE.MeshStandardMaterial({map:t, transparent:true, depthWrite:false, roughness:0.45, metalness:0.1, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2});
}
function pullDirtTex(){
  var c=newCanvas(128,128), x=c.getContext("2d"), img=x.createImageData(128,128), d=img.data;
  for(var j=0;j<128;j++) for(var i=0;i<128;i++){ var n=fbm(i/128,j/128,4,4,7)*0.7+hashi(i,j,3)*0.3, k=(j*128+i)*4; d[k]=70+80*n; d[k+1]=48+56*n; d[k+2]=30+34*n; d[k+3]=255; }
  x.putImageData(img,0,0); var t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}
/* StripBatch.build adds to STRIP.scene: point it at the pull world for the call */
function pullBuild(B, key, mat, shadow){ var keep=STRIP.scene; STRIP.scene=PULL.scene; var m=B.build(key, mat, shadow); STRIP.scene=keep; return m; }

/* --- the fairground --- */
function buildPullScene(){
  var S3=new THREE.Scene(); PULL.scene=S3; PULL.tier=GFX;
  var lite=(GFX==="lite"), i, k, side, x, z, M=PULL.mats;
  var rng=function(s){ var t=Math.sin(s*127.1+3.7)*43758.5453; return t-Math.floor(t); };
  PULL.g={ box:new THREE.BoxGeometry(1,1,1), cyl:new THREE.CylinderGeometry(0.5,0.5,1,14), cyl8:new THREE.CylinderGeometry(0.5,0.5,1,8), sph:new THREE.SphereGeometry(0.5,12,8),
    plane:new THREE.PlaneGeometry(1,1).rotateX(-PI/2) };
  /* a lumpy mound for the dirt the pan pushes */
  (function(){ var g=new THREE.SphereGeometry(1,22,7,0,TAU,0,PI/2), p=g.attributes.position, uv=g.attributes.uv;
    for(var q=0;q<p.count;q++){ var x0=p.getX(q), y0=p.getY(q), z0=p.getZ(q), n=0.75+0.5*hashi(Math.round(x0*9),Math.round(z0*9),5)*(0.4+0.6*y0);
      p.setXYZ(q, x0*(y0<0.05?1:n), Math.pow(y0,0.8)*n*0.9, z0*(y0<0.05?1:n)); uv.setXY(q, x0*2+2, z0*2+2); }
    g.computeVertexNormals(); PULL.g.mound=g; })();
  /* lights */
  var hemi=new THREE.HemisphereLight(0xcfdcf0, 0x6a5a3c, 0.3); S3.add(hemi); PULL.hemi=hemi;
  var sun=new THREE.DirectionalLight(0xffe6c4, 1.45); sun.shadow.mapSize.set(2048,2048);
  var shc=sun.shadow.camera; shc.left=-26; shc.right=26; shc.top=26; shc.bottom=-26; shc.near=1; shc.far=260; sun.shadow.bias=-0.0006; sun.shadow.normalBias=0.03;
  S3.add(sun); S3.add(sun.target); PULL.sun=sun;
  var flood=new THREE.DirectionalLight(0xfff2dc, 0); flood.position.set(0,40,30); S3.add(flood); S3.add(flood.target); PULL.flood=flood;
  /* sky, fog, ground, track */
  var sky=new THREE.Mesh(new THREE.SphereGeometry(2600, 40, 20), stripSkyMat()); sky.frustumCulled=false; sky.renderOrder=-10; S3.add(sky); PULL.sky=sky;
  S3.fog=new THREE.Fog(0xffffff, 160, 2700); PULL.fog=S3.fog;
  var gm=stripSurfMat(PULL_GLSL_GROUND); gm.customProgramCacheKey=function(){ return "pull_ground"; };
  var ground=new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), gm); ground.rotation.x=-PI/2; ground.position.set(40,-0.12,0); ground.receiveShadow=true; S3.add(ground);
  var tm=stripSurfMat(PULL_GLSL_TRACK, {polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-2}); tm.customProgramCacheKey=function(){ return "pull_track"; };
  var track=new THREE.Mesh(new THREE.PlaneGeometry(160, 13.2), tm); track.rotation.x=-PI/2; track.position.set(-36+80, 0, 0); track.receiveShadow=true; S3.add(track);
  PULL.trackMat=tm; PULL.trackKey="";   /* tinted per hook by setPull({track}) */
  /* low coulee hills on the horizon */
  (function(){ var seg=120, R0=1900, pos=[], col=[], idx=[], c1=sc(0x5d6a4a), c2=sc(0x7d8a70);
    for(var s=0;s<=seg;s++){ var a=s/seg*TAU, hgt=Math.max(5, 14+34*Math.pow(0.5+0.5*Math.sin(a*3.0+0.4),2)+18*Math.sin(a*11.0+1.4)*Math.sin(a*5.0)+10*Math.sin(a*23.0));
      pos.push(40+Math.cos(a)*(R0-500),-2,Math.sin(a)*(R0-500), 40+Math.cos(a)*R0,hgt,Math.sin(a)*R0, 40+Math.cos(a)*(R0+400),hgt*0.6,Math.sin(a)*(R0+400)); col.push(c1.r,c1.g,c1.b, c2.r,c2.g,c2.b, c2.r,c2.g,c2.b); }
    for(s=0;s<seg;s++){ var a0=s*3, b0=(s+1)*3; idx.push(a0,b0,a0+1, b0,b0+1,a0+1, a0+1,b0+1,a0+2, b0+1,b0+2,a0+2); }
    var g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); g.setAttribute("color",new THREE.Float32BufferAttribute(col,3)); g.setIndex(idx); g.computeVertexNormals();
    var hm=new THREE.Mesh(g, new THREE.MeshStandardMaterial({vertexColors:true, roughness:1, side:THREE.DoubleSide})); hm.frustumCulled=false; S3.add(hm); })();

  M.solid=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.86});
  M.metal=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.42, metalness:0.65});
  M.lamp=new THREE.MeshBasicMaterial({vertexColors:true, toneMapped:false, color:0x777777});
  M.beam=new THREE.MeshBasicMaterial({vertexColors:true, transparent:true, opacity:0.0, depthWrite:false, blending:THREE.AdditiveBlending, fog:true, side:THREE.DoubleSide});
  M.sign=new THREE.MeshStandardMaterial({map:pullAtlas(), roughness:0.72});
  M.pen=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.8, side:THREE.DoubleSide});
  M.dirt=new THREE.MeshStandardMaterial({map:pullDirtTex(), roughness:1, color:0x9a8270});
  var G=sbGeo(); if(!G.tri){ var tg=new THREE.BufferGeometry(); tg.setAttribute("position", new THREE.Float32BufferAttribute([-0.5,0,0, 0.5,0,0, 0,-1,0],3)); tg.setAttribute("normal", new THREE.Float32BufferAttribute([0,0,1, 0,0,1, 0,0,1],3)); tg.setAttribute("uv", new THREE.Float32BufferAttribute([0,1, 1,1, 0.5,0],2)); G.tri=tg; }
  var B=new StripBatch();
  var CONC=0xc9c4b6, CONC2=0xb4ae9f, STEEL=0x8d9296, ALU=0xb9bec4, DARK=0x2a2c2f, RUB=0x1a1a1c;

  /* concrete barriers both sides (3 m sections), sponsor banners on the inside faces, 50 ft marker boards */
  for(side=-1; side<=1; side+=2){ var wz=side*6.45;
    for(x=-33; x<PULL_END+1; x+=3.05){ B.box("solid", x+1.5, 0.17, wz, 3.0, 0.34, 0.62, CONC); B.box("solid", x+1.5, 0.55, wz, 3.0, 0.44, 0.34, CONC); B.box("solid", x+1.5, 0.8, wz, 3.0, 0.07, 0.24, CONC2); }
    for(x=-24, k=0; x<PULL_END-6; x+=9.15, k++){ var pick=(k*5+(side>0?2:0))%7;
      B.add("sign","plane",[x, 0.52, side*6.27],[5.4,0.7,1],0xffffff,[0, side>0?PI:0, 0],PULL_UV.ban[pick]); }
    for(i=1;i<=6;i++){ var mx=i*15.24, mz=side*7.3;
      B.add("metal","cyl6",[mx, 1.1, mz],[0.1,2.2,0.1],STEEL);
      var mry=side<0?0.5:PI-0.5; B.add("sign","plane",[mx, 2.15, mz],[1.25,0.9,1],0xffffff,[0,mry,0],PULL_UV.mark(i-1));
      B.add("solid","box",[mx-Math.sin(mry)*0.03, 2.15, mz-Math.cos(mry)*0.03],[1.3,0.95,0.04],0x15171b,[0,mry,0]); }
  }
  /* starting area: chalk box posts + hook-up official's flags; far end: dirt berm, tyre wall, flag poles */
  B.add("solid","prism",[PULL_END+3.5, 0, 0],[14, 4.2, 5],0x5a3f27,[0,PI/2,0]);
  for(z=-5.6; z<=5.7; z+=0.8) for(k=0;k<3;k++) B.add("solid","cyl",[PULL_END+0.6+((k&1)?0.35:0), 0.17+k*0.3, z],[0.72,0.3,0.72],RUB);
  for(i=-1;i<=1;i++){ B.add("metal","cyl6",[PULL_END+6, 2.6, i*5.5-1],[0.1,5.2,0.1],ALU); }
  /* pennant strings over the far wall, posts every 12 m */
  for(x=-24; x<=PULL_END; x+=12){ B.add("metal","cyl6",[x, 2.2, -7.05],[0.08,4.4,0.08],STEEL); }
  var PEN=[0xff7a1a,0xf1ede2,0x15171b,0x1d4787,0xd9a52b];
  for(x=-24; x<PULL_END; x+=12){ for(k=0;k<20;k++){ var f=(k+0.5)/20, px=x+f*12, py=4.25-Math.sin(f*PI)*0.7; B.add("pen","tri",[px, py, -7.05],[0.42,0.48,1],PEN[k%PEN.length],[0,0,0]); } }
  /* bleachers on the far side: aluminium planks on a steel frame, two sections */
  var rows=10, BX=[[-8,40],[44,96]];
  BX.forEach(function(sec){ var x0=sec[0], x1=sec[1], L=x1-x0, cx=(x0+x1)/2;
    for(var r=0;r<rows;r++){ var ry=0.42+r*0.42, rz=-9.0-r*0.8;
      B.box("metal", cx, ry, rz, L, 0.06, 0.32, ALU); B.box("metal", cx, ry-0.3, rz+0.32, L, 0.04, 0.26, 0xa4a9ae); }
    for(x=x0+0.3; x<=x1; x+=4){ for(var r2=0;r2<rows;r2+=3){ B.box("metal", x, (0.42+r2*0.42)/2, -9.0-r2*0.8, 0.08, 0.42+r2*0.42, 0.08, DARK); }
      B.add("metal","box",[x, (0.42+(rows-1)*0.42)/2+0.1, -9.0-(rows-1)*0.4],[0.08, 0.1, (rows-1)*0.8*1.22],DARK,[Math.atan2(0.42,0.8),0,0]);
      B.box("metal", x, (0.42+(rows-1)*0.42)/2+0.6, -9.0-rows*0.8+0.2, 0.08, 0.42+(rows-1)*0.42+1.2, 0.08, DARK); }
    B.box("metal", cx, 0.42+(rows-1)*0.42+1.0, -9.0-rows*0.8+0.2, L, 0.05, 0.05, ALU);
    B.box("metal", cx, 0.42+(rows-1)*0.42+0.6, -9.0-rows*0.8+0.2, L, 0.05, 0.05, ALU);
    B.add("sign","plane",[cx, 0.3, -8.5],[Math.min(24,L*0.5),0.42,1],0xffffff,null,PULL_UV.long); });
  /* announcer's stand at the top of the gap */
  B.box("solid", 42, 3.2, -18.5, 5, 6.4, 3.6, 0xe7e2d6); B.box("solid", 42, 6.6, -18.5, 5.6, 0.3, 4.2, 0x2a2c2f); B.box("solid", 42, 4.9, -16.68, 4.4, 1.2, 0.04, 0x26343d);
  B.add("sign","plane",[42, 2.5, -16.66],[4.6,0.58,1],0xffffff,null,PULL_UV.stand);
  /* light towers: two behind the stands, three on the near side */
  PULL.poles=[]; var poleXZ=[[14,-26],[72,-26],[-6,15],[48,15],[104,15]];
  poleXZ.forEach(function(pp){ var px=pp[0], pz=pp[1], H=pz<0?24:20, sz2=pz<0?1:-1;
    B.add("metal","cyl",[px, H/2, pz],[0.42,H,0.42],0x9aa0a6); B.box("metal", px, H+0.2, pz, 4.2, 0.25, 0.3, 0x80868c); B.box("metal", px, H+1.2, pz, 4.2, 0.25, 0.3, 0x80868c);
    for(k=0;k<4;k++){ for(var kk=0;kk<2;kk++){ var lx=px-1.5+k, ly=H+0.45+kk*1.0; B.box("metal", lx, ly, pz+sz2*0.15, 0.8, 0.7, 0.4, 0x5a5f65); B.box("lamp", lx, ly, pz+sz2*0.36, 0.66, 0.56, 0.02, 0xfff0d0); } }
    B.add("beam","beam",[px, H/2, pz+sz2*H*0.18],[7,H,7],0xffe8c0,[-sz2*0.36,0,0]);
    PULL.poles.push(new THREE.Vector3(px, H+0.8, pz)); });
  /* scoreboard frames: big one past the end, one above the far stands by the 300 ft line */
  /* board faces: ry = plane yaw, n = its normal, t = along its face */
  function bframe(bx0, by, bz0, ry, w, h, top){ var nx=Math.sin(ry), nz=Math.cos(ry), tx=Math.cos(ry), tz=-Math.sin(ry), y0=by-h/2-0.3, y1=by+h/2+(top?1.5:0.3);
    B.add("solid","box",[bx0-nx*0.3, (y0+y1)/2, bz0-nz*0.3],[w+0.6, y1-y0, 0.4],0x151618,[0,ry,0]);
    for(var q=-1;q<=1;q+=2) B.box("metal", bx0+tx*q*w*0.36-nx*0.6, y0/2+0.3, bz0+tz*q*w*0.36-nz*0.6, 0.4, y0+0.6, 0.4, STEEL);
    if(top) B.add("sign","plane",[bx0+nx*0.02, by+h/2+0.75, bz0+nz*0.02],[w,0.95,1],0xffffff,[0,ry,0],PULL_UV.long); }
  bframe(PULL_END+9.42, 8.6, -2.5, -PI/2+0.25, 11.6, 5.8, true); bframe(103, 10.6, -16.4, -0.45, 8.6, 4.3, false);
  /* pits on the near side: haulers, pickups, a few tractors on trailers */
  var hcol=[0xe9e6dc,0x1b1d20,0x9e2a22,0x22488f,0xd0d3d6,0x2c6b3a,0xff7a1a];
  for(i=0;i<8;i++){ var hx=-30+i*18+rng(i)*6, hz=26+rng(i+9)*14;
    B.box("solid", hx, 2.0, hz, 12, 3.2, 2.6, hcol[i%hcol.length]); B.box("solid", hx+7.6, 1.6, hz, 3.0, 2.6, 2.5, hcol[(i+3)%hcol.length]); B.box("solid", hx, 0.3, hz, 12, 0.5, 2.3, 0x1c1d1f);
    if(i%3===1) B.add("sign","plane",[hx, 2.2, hz-1.31],[8,1.9,1],0xffffff,[0,PI,0],i%2?PULL_UV.sled:PULL_UV.pulloff);
    B.box("solid", hx+2, 1.2, hz-5.5, 4.8, 1.3, 2.0, hcol[(i+4)%hcol.length]); B.box("solid", hx+1.6, 2.1, hz-5.5, 2.2, 0.7, 1.8, 0x22262b); }
  /* concession stand behind the near-side apron */
  B.box("solid", 60, 1.5, 21, 8, 3, 4, 0xf1ede2); B.add("solid","prism",[60,3,21],[8.6,1.4,4.8],0x9e2a22); B.add("sign","plane",[60, 2.5, 18.98],[6,0.75,1],0xffffff,null,PULL_UV.food);
  /* fairground buildings, a grain elevator and a red barn off in the distance */
  function shed(fx, fz, w, d, h, col, roof, rot){ B.box("solid", fx, h/2, fz, w, h, d, col, rot); B.add("solid","prism",[fx,h,fz],[w+0.4,h*0.4,d+0.6],roof,[0,rot||0,0]); }
  shed(20,-46,36,14,7,0xd8d2c2,0x5d6268,0); shed(70,-48,28,12,6,0x9a2e22,0x5a5a5a,0); shed(-40,-30,14,10,5,0xe9e6dc,0x3c3a38,0.3);
  B.box("solid", 160, 12, -140, 12, 24, 12, 0x8e2f23, 0.3); B.add("solid","prism",[160,24,-140],[12.4,3.4,12.4],0x4a4644,[0,0.3,0]); B.box("solid", 160, 29, -140, 5, 6, 5.4, 0x8e2f23, 0.3);
  B.box("solid", 176, 7, -146, 9, 14, 10, 0xb9a57a, 0.3);
  shed(-120,-160,18,12,9,0x9a2e22,0x5a5a5a,0.5); shed(260,90,16,12,8,0x9a2e22,0x5a5a5a,-0.4);
  pullBuild(B,"solid", M.solid, !lite); pullBuild(B,"metal", M.metal, !lite); PULL.lampMesh=pullBuild(B,"lamp", M.lamp, false); pullBuild(B,"sign", M.sign, false); pullBuild(B,"pen", M.pen, false);
  PULL.beamMesh=pullBuild(B,"beam", M.beam, false); if(PULL.beamMesh){ PULL.beamMesh.receiveShadow=false; PULL.beamMesh.visible=false; PULL.beamMesh.renderOrder=4; }

  /* shelterbelt trees round the fairground */
  (function(){ var pts=[], s;
    for(s=0;s<70;s++){ var a=s/70*TAU, R=150+rng(s)*30; pts.push([40+Math.cos(a)*R*1.3, Math.sin(a)*R, 4+rng(s+3)*3]); }
    for(s=0;s<24;s++) pts.push([-60+s*9+rng(s+7)*3, -64-rng(s)*6, 4+rng(s+9)*2.5]);
    var im=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0), new THREE.MeshStandardMaterial({roughness:1}), pts.length), mm=new THREE.Matrix4(), cc=new THREE.Color();
    pts.forEach(function(p,q){ var h=p[2]*1.6; mm.compose(_sbP.set(p[0],h*0.8,p[1]), _sbQ.set(0,0,0,1), _sbS.set(p[2],h,p[2])); im.setMatrixAt(q,mm); cc.setHSL(0.24+rng(q)*0.06, 0.45, 0.13+rng(q+1)*0.06).convertSRGBToLinear(); im.setColorAt(q,cc); });
    instCull(im); S3.add(im); })();
  /* Ferris wheel on the midway behind the stands (turns slowly, rim lights at night) */
  (function(){ var W=new THREE.Group(), R=11, hub=new THREE.Vector3(58, 14, -78), mat=new THREE.MeshStandardMaterial({color:0xd8dde2, roughness:0.4, metalness:0.6}), parts=[];
    parts.push({g:new THREE.TorusGeometry(R,0.16,6,48), m:new THREE.Matrix4()}); parts.push({g:new THREE.TorusGeometry(R*0.94,0.1,6,48), m:new THREE.Matrix4()});
    for(var s2=0;s2<16;s2++){ var a=s2/16*TAU; parts.push({g:PULL.g.box, m:mkM(Math.cos(a)*R/2, Math.sin(a)*R/2, 0, 0,0,a, R,0.12,0.12)}); }
    var rim=new THREE.Mesh(mergeGeos(parts), mat); W.add(rim);
    var bulbs=new THREE.Mesh(new THREE.TorusGeometry(R*1.012,0.07,4,64), new THREE.MeshBasicMaterial({color:0x553322, toneMapped:false})); W.add(bulbs);
    W.position.copy(hub); S3.add(W);
    var lg=[]; [-1,1].forEach(function(sd){ [-1,1].forEach(function(fz){ lg.push({g:PULL.g.cyl8, m:sc_rodM(new THREE.Vector3(hub.x+sd*7, 0, hub.z+fz*2.2), hub.clone().setZ(hub.z+fz*0.4))}); }); });
    lg.forEach(function(q){ q.m.multiply(new THREE.Matrix4().makeScale(0.45,1,0.45)); });
    S3.add(new THREE.Mesh(mergeGeos(lg), mat));
    var cars=new THREE.InstancedMesh(PULL.g.box, new THREE.MeshStandardMaterial({roughness:0.6}), 16), cc2=new THREE.Color(); for(s2=0;s2<16;s2++){ cc2.set([0xff7a1a,0x1d4787,0xd9a52b,0x9e2a22][s2%4]).convertSRGBToLinear(); cars.setColorAt(s2,cc2); }
    cars.instanceMatrix.setUsage(THREE.DynamicDrawUsage); S3.add(cars);
    PULL.wheel={g:W, cars:cars, hub:hub, R:R, bulbs:bulbs}; })();
  /* flags on the berm */
  (function(){ var c=newCanvas(256,160), x=c.getContext("2d"); x.fillStyle="#d97757"; x.fillRect(0,0,256,160); x.fillStyle="#141413"; x.fillRect(0,112,256,48);
    x.font="700 64px 'Chakra Petch','Arial Narrow',Arial,sans-serif"; x.textAlign="center"; x.textBaseline="middle"; x.fillText("PEW", 128, 58); x.fillStyle="#d97757"; x.fillRect(0,124,256,6);
    var t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; var fm=new THREE.MeshStandardMaterial({map:t, roughness:0.8, side:THREE.DoubleSide});
    for(var q=-1;q<=1;q++){ var g=new THREE.PlaneGeometry(2.2,1.35,10,1); g.translate(1.1,0,0); var fl=new THREE.Mesh(g, fm); fl.position.set(PULL_END+6, 4.5, q*5.5-1); fl.rotation.y=-PI*0.38; S3.add(fl);
      PULL.flags.push({m:fl, base:Float32Array.from(g.attributes.position.array), ph:q*1.7}); } })();

  /* crowd on the bleachers */
  (function(){ var ppl=[], occ=lite?0.45:ULT()?0.9:0.62;
    BX.forEach(function(sec){ for(var r=0;r<rows;r++){ for(var xx=sec[0]+0.5; xx<sec[1]-0.4; xx+=0.6){ if(rng(xx*3.1+r*17.7)>occ) continue; ppl.push([xx+(rng(xx+r)-0.5)*0.2, 0.42+r*0.42+0.03, -9.0-r*0.8-0.02]); } } });
    var n=ppl.length, bodyM=new THREE.InstancedMesh(new THREE.BoxGeometry(0.46,0.62,0.34), new THREE.MeshStandardMaterial({roughness:0.95}), n),
        headM=new THREE.InstancedMesh(new THREE.BoxGeometry(0.22,0.25,0.22), new THREE.MeshStandardMaterial({roughness:0.9}), n);
    var shirts=[0x9c3a30,0x34598f,0xcfccc4,0x1f2023,0x2a2c30,0xff7a1a,0x44684a,0xc8a640,0x5d5f66,0x7a7f86,0x3a3d44,0x8f4a5e,0x2c6b3a], skin=[0xe0b494,0xc68a64,0x8d5a3b,0xf0c9a8,0x5a3a26], hats=[0x1d4787,0xff7a1a,0x222222,0xe9e6dc,0x2c6b3a,0x9e2a22];
    var mm=new THREE.Matrix4(), cc=new THREE.Color(), base=[];
    for(var s=0;s<n;s++){ var p=ppl[s]; mm.makeTranslation(p[0],p[1]+0.31,p[2]); bodyM.setMatrixAt(s,mm); mm.makeTranslation(p[0],p[1]+0.75,p[2]); headM.setMatrixAt(s,mm);
      cc.set(shirts[Math.floor(rng(s*1.3)*shirts.length)]).convertSRGBToLinear(); bodyM.setColorAt(s,cc);
      cc.set(rng(s*2.9)<0.45?hats[Math.floor(rng(s*4.1)*hats.length)]:skin[Math.floor(rng(s*3.7)*skin.length)]).convertSRGBToLinear(); headM.setColorAt(s,cc); base.push(p); }
    bodyM.receiveShadow=true; instCull(bodyM, 1.5); instCull(headM, 1.5); S3.add(bodyM); S3.add(headM);
    PULL.crowd={body:bodyM, head:headM, base:base, n:n, phase:base.map(function(p,q){ return rng(q*9.1)*TAU; }), excite:base.map(function(p,q){ return rng(q*5.3); }), live:false}; })();

  /* scoreboards: one canvas, two faces */
  (function(){ var cv=newCanvas(512,256), tx=new THREE.CanvasTexture(cv); tx.encoding=THREE.sRGBEncoding; tx.anisotropy=MAXANISO;
    var bm=new THREE.MeshBasicMaterial({map:tx, toneMapped:false, color:0xdddddd});
    var m1=new THREE.Mesh(new THREE.PlaneGeometry(11.6,5.8), bm); m1.position.set(PULL_END+9.42, 8.6, -2.5); m1.rotation.y=-PI/2+0.25; S3.add(m1);
    var m2=new THREE.Mesh(new THREE.PlaneGeometry(8.6,4.3), bm); m2.position.set(103, 10.6, -16.4); m2.rotation.y=-0.45; S3.add(m2);
    PULL.board={cv:cv, tex:tx, mat:bm, key:"", at:-1}; })();
  pullBoardDraw({phase:"stage"}, true);

  /* sled, chain, ruts */
  PULL.sled=pullSled(); S3.add(PULL.sled);
  (function(){ var g=new THREE.TorusGeometry(0.055,0.016,5,10), m=sc_mats().satin; var im=new THREE.InstancedMesh(g, m, 14); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.castShadow=!lite; im.frustumCulled=false; S3.add(im); PULL.chain=im; })();
  (function(){ var rm=new THREE.MeshStandardMaterial({color:0x2a1c10, roughness:1, transparent:true, opacity:0.55, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-3, polygonOffsetUnits:-6});
    var pm=new THREE.MeshStandardMaterial({color:0x9a7a55, roughness:0.85, transparent:true, opacity:0.42, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-4});
    var R={tyre:[], pan:null};
    for(var q=0;q<2;q++){ var t=new THREE.Mesh(PULL.g.plane, rm); t.renderOrder=2; t.visible=false; S3.add(t); R.tyre.push(t); }
    R.pan=new THREE.Mesh(PULL.g.plane, pm); R.pan.renderOrder=1; R.pan.visible=false; S3.add(R.pan);
    PULL.ruts=R; })();

  /* effects: smoke + dust (lit), thrown dirt (lit), confetti (flat colour) */
  PULL.fx=new StripFx(lite?380:760, "smoke", stripPuffTex()); S3.add(PULL.fx.mesh);
  PULL.fxDirt=new StripFx(lite?240:520, "smoke", stripFlameTex(true)); S3.add(PULL.fxDirt.mesh);
  PULL.fxConf=new StripFx(lite?160:320, "fire", stripFlameTex(true)); S3.add(PULL.fxConf.mesh);

  PULL.cam=new THREE.PerspectiveCamera(44, 1, 0.3, 3600); PULL.built=true;
  PULL.night=null; pullSetNight(false);
}

/* ---------------------------------------------------------------------------
   PULLING VEHICLES + SLED. Origin of a vehicle = its rear axle on the ground,
   +x forward. Everything that pitches (body, front axle) hangs off a pivot at
   the rear axle centre; the rear wheels don't. Tyres carry real lugs: cut
   blocks on the truck, chevron bars on the tractor. Geometry is cached.
   -------------------------------------------------------------------------*/
function pullTyreGeo(r, w, rimR, kind){
  var key="pt"+[r,w,rimR].map(r3).join("_")+kind; if(PULL.geo[key]) return PULL.geo[key];
  var hw=w/2, lugH=kind==="ag"?r*0.075:kind==="cut"?0.04:kind==="paddle"?r*0.13:0, r0=r-lugH, sh=Math.min(0.07,(r0-rimR)*0.25), i, s;
  var pr=[[rimR+0.004,0.86],[lerp(rimR,r0,0.4),1],[lerp(rimR,r0,0.8),1],[r0-sh,0.97],[r0-sh*0.2,0.84]], pts=[];
  for(i=0;i<pr.length;i++) pts.push(new THREE.Vector2(pr[i][0], -hw*pr[i][1]));
  for(i=pr.length-1;i>=0;i--) pts.push(new THREE.Vector2(pr[i][0], hw*pr[i][1]));
  var parts=[{g:new THREE.LatheGeometry(pts, kind==="ag"?36:28), m:new THREE.Matrix4()}];
  if(lugH>0){ var pad=kind==="paddle", n=pad?16:kind==="ag"?23:28, a=pad?0:kind==="ag"?0.62:0.42, L=pad?hw*0.98:kind==="ag"?hw*1.0/Math.cos(a):hw*0.78/Math.cos(a), t=pad?0.05:kind==="ag"?0.075:0.07;   /* paddles: straight scoops across the tread, both halves in line */
    var rad=new THREE.Vector3(), tan=new THREE.Vector3(), ax=new THREE.Vector3(0,1,0), d=new THREE.Vector3(), e=new THREE.Vector3(), c=new THREE.Vector3();
    for(i=0;i<n;i++) for(s=-1;s<=1;s+=2){ var th=(i+(s>0||pad?0:0.5))/n*TAU;
      rad.set(Math.cos(th),0,Math.sin(th)); tan.set(-Math.sin(th),0,Math.cos(th));
      d.copy(ax).multiplyScalar(s*Math.cos(a)).addScaledVector(tan, Math.sin(a)); e.crossVectors(rad, d).normalize();
      var zc=s*(kind==="ag"?hw*0.5:hw*0.52);
      c.copy(rad).multiplyScalar(r0+lugH/2-0.006).addScaledVector(ax, zc).addScaledVector(tan, Math.sin(a)*L*0.0);
      var m=new THREE.Matrix4().makeBasis(rad.clone().multiplyScalar(lugH+0.012), d.clone().multiplyScalar(L), e.clone().multiplyScalar(t)); m.setPosition(c);
      parts.push({g:PULL.g.box, m:m}); } }
  return (PULL.geo[key]=mergeGeos(parts));
}
/* a wheel: carrier -> spin group (axle along z) -> tyre + rim facing outwards */
function pullWheel(r, w, rimR, kind, side, rimMat, style){
  var M=sc_mats(), car=new THREE.Group(), spin=new THREE.Group(), cont=new THREE.Group();
  spin.rotation.x=PI/2; cont.rotation.x=side<0?PI:0;
  var ty=new THREE.Mesh(pullTyreGeo(r,w,rimR,kind), PULL.mats.tyre); ty.castShadow=true; ty.receiveShadow=true; cont.add(ty);
  var rg=sc_rimGeo(rimR, w, style||"bead"), rim=new THREE.Mesh(rg.rim, rimMat||M.alu), inn=new THREE.Mesh(rg.inner, M.barrel); rim.castShadow=true; cont.add(rim); cont.add(inn);
  spin.add(cont); car.add(spin); car.userData={spin:spin, r:r, w:w}; return car;
}
function pullMats(){
  var P=PULL.mats; if(P.tyre) return P;
  P.tyre=new THREE.MeshStandardMaterial({color:sc(0x231d18), roughness:0.92, metalness:0});
  P.cast=new THREE.MeshStandardMaterial({color:sc(0x2e3034), roughness:0.55, metalness:0.45});
  P.sled=new THREE.MeshStandardMaterial({color:sc(0xe0aa18), roughness:0.45, metalness:0.2});
  P.plate=new THREE.MeshStandardMaterial({color:sc(0x44474c), roughness:0.5, metalness:0.6});
  P.pan=new THREE.MeshStandardMaterial({color:sc(0x6c6a66), roughness:0.6, metalness:0.55});
  P.orange=new THREE.MeshStandardMaterial({color:sc(0xff7a1a), roughness:0.35, metalness:0.15});
  P.white=new THREE.MeshStandardMaterial({color:sc(0xe9e6dc), roughness:0.4, metalness:0.05});
  P.cream=new THREE.MeshStandardMaterial({color:sc(0xd9d2bf), roughness:0.35, metalness:0.25});
  P.lens=new THREE.MeshStandardMaterial({color:sc(0xc9ced4), roughness:0.12, metalness:0.55, emissive:new THREE.Color(0xfff1d8), emissiveIntensity:0});
  P.tail=new THREE.MeshStandardMaterial({color:sc(0x5a0808), roughness:0.25, metalness:0.1, emissive:new THREE.Color(0xff1a0a), emissiveIntensity:0});
  P.suit=new THREE.MeshStandardMaterial({color:sc(0x1d2a44), roughness:0.85});
  P.helmet=new THREE.MeshStandardMaterial({color:sc(0xf1ede2), roughness:0.25, metalness:0.1});
  return P;
}
/* merge a material-keyed bin into meshes under a parent */
function pullBinTo(bin, parent, mats, shadow){
  for(var k in bin){ if(typeof bin[k]!=="object"||!bin[k].length) continue; var g=mergeGeos(bin[k]); g.__cached=true;
    var m=new THREE.Mesh(g, mats[k]); m.castShadow=shadow!==false && k!=="glass" && k!=="decal"; m.receiveShadow=true; if(k==="decal") m.renderOrder=2; parent.add(m); }
}
/* the pull vehicle's door decal with the first side sponsor (or the primary) where the stripes go */
function pullLivDecalMat(num){
  var key="pull|"+num+"|"+LIVERY.key; if(LIV_MAT[key]) return LIV_MAT[key];
  var c=newCanvas(512,160), x=c.getContext("2d"), F="'Chakra Petch','Arial Narrow',Arial,sans-serif", sp=LIVERY.sides[0]||LIVERY.hood;
  x.clearRect(0,0,512,160); x.textAlign="left"; x.textBaseline="middle";
  x.font="italic 700 92px "+F; x.lineWidth=10; x.strokeStyle="#111"; x.strokeText(num, 14, 66); x.fillStyle="#f4f1e8"; x.fillText(num, 14, 66);
  var nw=Math.min(230, x.measureText(num).width+30); x.drawImage(spLogoCanvas(sp,512,192), nw, 8, Math.min(290, 500-nw), Math.min(290, 500-nw)*0.375);
  x.font="700 34px "+F; x.fillStyle="#d97757"; x.strokeStyle="#111"; x.lineWidth=6; x.strokeText("PRAIRIE ENGINE WORKS", 14, 136); x.fillText("PRAIRIE ENGINE WORKS", 14, 136);
  var t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=MAXANISO;
  LIV_MAT[key]=new THREE.MeshStandardMaterial({map:t, transparent:true, depthWrite:false, roughness:0.45, metalness:0.1, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2});
  return LIV_MAT[key];
}
function pullLivery(U){
  var key=LIVERY.key; if(U.livDk!==key){ U.livDk=key; if(U.livDecal) U.livDecal.material=(key&&LIVERY.hood)?pullLivDecalMat(U.livNum):U.mats.decal; }
  livPlanes(U.body, U, U.livSpots);
}
function pullVehicle(kind, color){
  var M=sc_mats(), P=pullMats(), paint=new THREE.MeshStandardMaterial({color:sc(color), roughness:0.36, metalness:0.12, envMapIntensity:0.8}), lite=GFX==="lite";
  var paintDS=new THREE.MeshStandardMaterial({color:paint.color, roughness:0.35, metalness:0.2, side:THREE.DoubleSide});
  var mats={paint:paint, paintDS:paintDS, black:M.black, satin:M.satin, chrome:M.chrome, glass:M.glass, alu:M.alu, cast:P.cast, orange:P.orange, white:P.white, lens:P.lens, tail:P.tail, suit:P.suit, helmet:P.helmet, well:new THREE.MeshStandardMaterial({color:0x0b0b0c, roughness:1, side:THREE.DoubleSide}), decal:pullDecalMat(kind==="tractor"?"4020":String(((color>>>0)%89)+11))};
  var g=new THREE.Group(), pivot=new THREE.Group(), body=new THREE.Group(); g.add(pivot); pivot.add(body);
  var bin=sc_bin(), pb=sc_bin(), bx=PULL.g.box, cy=PULL.g.cyl, i, s;
  function box(b,m,x,y,z,w,h,d,rx,ry,rz){ b.add(m, bx, mkM(x,y,z,rx||0,ry||0,rz||0,w,h,d)); }
  function rbox(b,m,x,y,z,w,h,d,bv,rx,ry,rz){ b.add(m, sc_rbox(w,h,d,bv), mkM(x,y,z,rx||0,ry||0,rz||0)); }
  function cyl(b,m,x,y,z,r,len,rx,ry,rz){ b.add(m, cy, mkM(x,y,z,rx||0,ry||0,rz||0,2*r,len,2*r)); }
  function rod(b,m,a,c,r){ var mm=sc_rodM(new THREE.Vector3(a[0],a[1],a[2]), new THREE.Vector3(c[0],c[1],c[2])); mm.multiply(new THREE.Matrix4().makeScale(2*r,1,2*r)); b.add(m, cy, mm); }
  function prof(b,m,pts,d,bv,z){ b.add(m, sc_prof(pts,d,bv), mkM(0,0,z||0)); }
  function arc(b,m,x,y,z,r,w,t0,tl){ var a=new THREE.CylinderGeometry(r,r,w,18,1,true,t0,tl); a.rotateX(PI/2); b.add(m, a, mkM(x,y,z)); }
  var U={kind:kind, wheelsR:[], wheelsF:[], tips:[], dirs:[], flap:null, pitch:0, pv:0, spinR:0, spinF:0};
  var rr, rf, wr, wf, trR, trF, wb;
  if(kind!=="tractor"){
    /* ---- lifted 3/4-ton pickup on 43 inch cut tyres ---- */
    rr=rf=0.55; wr=wf=0.42; trR=trF=0.93; wb=3.65;
    var BY=1.12;
    /* bed */
    for(s=-1;s<=1;s+=2){ rbox(bin,"paint",-0.2,1.42,s*0.965,2.3,0.6,0.07,0.02); box(bin,"black",-0.2,1.735,s*0.96,2.32,0.04,0.11); }
    rbox(bin,"paint",0.93,1.42,0,0.07,0.6,2.0,0.02); rbox(bin,"paint",-1.33,1.42,0,0.07,0.6,2.0,0.02); box(bin,"black",-0.2,1.18,0,2.25,0.06,1.86);
    box(bin,"black",-0.2,1.15,0,2.4,0.08,1.98);
    box(bin,"tail",-1.375,1.5,0.86,0.03,0.3,0.16); box(bin,"tail",-1.375,1.5,-0.86,0.03,0.3,0.16);
    /* cab: paint lower, glass greenhouse, pillars + roof, light bar */
    rbox(bin,"paint",1.965,1.48,0,1.94,0.74,2.0,0.04);
    prof(bin,"glass",[[1.02,1.84],[2.9,1.84],[2.36,2.43],[1.08,2.43]],1.82,0);
    rbox(bin,"paint",1.72,2.46,0,1.36,0.07,1.88,0.025);
    for(s=-1;s<=1;s+=2){ box(bin,"paint",2.62,2.135,s*0.915,0.79,0.085,0.07,0,0,Math.atan2(0.59,-0.54)); box(bin,"paint",1.9,2.14,s*0.915,0.1,0.6,0.07); box(bin,"paint",1.08,2.14,s*0.915,0.1,0.6,0.07);
      box(bin,"black",2.78,2.02,s*1.1,0.08,0.16,0.26); box(bin,"black",2.82,1.95,s*0.99,0.06,0.04,0.12);
      box(bin,"chrome",1.75,1.72,s*1.003,0.18,0.03,0.02); box(bin,"black",1.94,1.48,s*1.003,0.012,0.72,0.012); }
    box(bin,"black",1.72,2.54,0,0.22,0.1,1.5); for(i=0;i<6;i++) box(bin,"lens",1.835,2.54,-0.6+i*0.24,0.01,0.07,0.18);
    /* hood + front clip */
    prof(bin,"paint",[[2.9,1.12],[4.42,1.12],[4.5,1.48],[4.44,1.84],[2.9,1.9]],1.98,0.03);
    rbox(bin,"paint",3.55,1.92,0,1.1,0.1,0.8,0.03);
    box(bin,"black",4.55,1.48,0,0.05,0.5,1.5); for(i=0;i<3;i++) box(bin,"chrome",4.58,1.32+i*0.16,0,0.02,0.035,1.46);
    box(bin,"lens",4.56,1.62,0.74,0.04,0.16,0.3); box(bin,"lens",4.56,1.62,-0.74,0.04,0.16,0.3);
    rbox(bin,"black",4.6,1.08,0,0.22,0.24,2.04,0.03);
    /* front weight bar + suitcase weights */
    box(bin,"black",4.85,1.0,0,0.5,0.1,0.5); box(bin,"black",5.12,1.02,0,0.08,0.14,1.5);
    for(i=0;i<13;i++) rbox(bin,i%4===0?"black":"orange",5.18,0.82,-0.6+i*0.1,0.42,0.46,0.075,0.015);
    /* flares + wheel wells */
    [0,wb].forEach(function(ax){ for(s=-1;s<=1;s+=2){ arc(bin,"black",ax,rr,s*1.05,rr+0.12,0.2,PI/2-0.15,PI+0.3); arc(bin,"well",ax,rr,s*0.86,rr+0.06,0.36,PI/2-0.15,PI+0.3); } });
    /* frame, lift, axles, shocks, driveshaft */
    for(s=-1;s<=1;s+=2){ box(bin,"black",1.55,0.98,s*0.52,6.0,0.2,0.09);
      [0,wb].forEach(function(ax){ box(bin,"satin",ax,0.82,s*0.52,1.3,0.06,0.08); rod(bin,"orange",[ax+0.18,rr,s*0.62],[ax+0.05,1.05,s*0.6],0.04); rod(bin,"orange",[ax-0.18,rr,s*0.62],[ax-0.05,1.05,s*0.6],0.04); }); }
    rod(bin,"satin",[0.25,rr+0.02,0.1],[2.05,0.82,0.1],0.045); cyl(bin,"cast",0,rr,0,0.08,1.72,PI/2,0,0); bin.add("cast", PULL.g.sph, mkM(0,rr,0.12,0,0,0,0.36,0.36,0.32)); box(bin,"cast",2.3,0.86,0.05,0.5,0.3,0.32);
    cyl(bin,"cast",wb,rr,0,0.08,1.72,PI/2,0,0); bin.add("cast", PULL.g.sph, mkM(wb,rr,-0.15,0,0,0,0.34,0.34,0.32));
    /* exhaust: two 5 inch stacks up through the bed */
    for(s=-1;s<=1;s+=2){ cyl(bin,"chrome",0.72,2.15,s*0.72,0.065,2.1); cyl(bin,"chrome",0.72,3.18,s*0.72,0.075,0.08); rod(bin,"satin",[0.72,1.2,s*0.72],[1.6,0.95,s*0.3],0.05);
      U.tips.push(new THREE.Vector3(0.72,3.24,s*0.72)); U.dirs.push(new THREE.Vector3(-0.15,1,0).normalize()); }
    /* hitch: receiver plate and a clevis under the tailgate */
    box(bin,"black",-1.42,0.86,0,0.1,0.5,0.28); box(bin,"black",-1.55,0.66,0,0.36,0.1,0.1); box(bin,"satin",-1.72,0.66,0,0.06,0.14,0.08);
    rod(bin,"black",[-1.4,0.68,0],[-0.2,0.92,0.45],0.035); rod(bin,"black",[-1.4,0.68,0],[-0.2,0.92,-0.45],0.035);
    /* decals + driver */
    for(s=-1;s<=1;s+=2){ var dg=new THREE.PlaneGeometry(1.05,0.33); if(s<0) dg.rotateY(PI); bin.add("decal", dg, mkM(1.55,1.45,s*1.012)); }
    box(bin,"suit",1.55,1.98,-0.42,0.32,0.4,0.36); bin.add("helmet", PULL.g.sph, mkM(1.6,2.27,-0.42,0,0,0,0.27,0.29,0.27)); box(bin,"black",1.7,2.27,-0.42,0.1,0.08,0.24);
    U.hitch=new THREE.Vector3(-1.75,0.66,0); U.front=5.4; U.mid=1.8; U.top=2.6; U.maxPitch=0.085; U.bars=null;
  } else {
    /* ---- super farm tractor: 38 inch rears on chevron bars, long hood, one tall stack ---- */
    rr=0.98; rf=0.52; wr=0.72; wf=0.3; trR=1.18; trF=0.86; wb=2.85;
    box(bin,"cast",0.1,1.0,0,1.25,0.9,1.0); cyl(bin,"cast",0,rr,0,0.15,1.75,PI/2,0,0);
    for(s=-1;s<=1;s+=2){ arc(bin,"paintDS",0,rr,s*trR,rr+0.12,0.86,PI-1.45,2.35); box(bin,"paint",0.05,1.42,s*0.62,1.5,0.06,0.26); }
    box(bin,"black",0.07,1.43,0,1.36,0.06,1.2);
    /* cab */
    box(bin,"glass",0.07,2.18,0,1.24,1.44,1.36);
    for(i=0;i<4;i++){ var cxp=(i&1)?0.69:-0.55, czp=(i&2)?0.69:-0.69; box(bin,"black",cxp,2.18,czp,0.07,1.46,0.07); }
    rbox(bin,"white",0.07,2.95,0,1.6,0.14,1.62,0.04); box(bin,"paint",0.07,1.5,0,1.28,0.12,1.4);
    for(i=0;i<4;i++) box(bin,"lens",0.88,2.92,-0.5+i*0.33,0.02,0.06,0.16);
    box(bin,"suit",-0.12,1.86,0,0.34,0.44,0.38); bin.add("helmet", PULL.g.sph, mkM(-0.08,2.2,0,0,0,0,0.27,0.29,0.27)); box(bin,"black",0.03,2.2,0,0.1,0.08,0.24);
    /* hood, grille, side vents, decal */
    prof(bin,"paint",[[0.72,1.0],[3.28,1.0],[3.34,1.45],[3.22,1.8],[0.72,1.9]],0.88,0.03);
    box(bin,"black",3.4,1.38,0,0.06,0.62,0.7); for(i=0;i<4;i++) box(bin,"chrome",3.435,1.15+i*0.15,0,0.02,0.03,0.66);
    box(bin,"lens",3.42,1.68,0.25,0.04,0.1,0.18); box(bin,"lens",3.42,1.68,-0.25,0.04,0.1,0.18);
    for(s=-1;s<=1;s+=2){ for(i=0;i<5;i++) box(bin,"black",2.75,1.25+i*0.09,s*0.445,0.7,0.035,0.012);
      var dg2=new THREE.PlaneGeometry(1.25,0.4); if(s<0) dg2.rotateY(PI); bin.add("decal", dg2, mkM(1.6,1.42,s*0.447)); }
    box(bin,"black",2.0,0.8,0,2.9,0.36,0.56);
    /* front axle, weight bracket and suitcase weights */
    cyl(bin,"cast",wb,rf,0,0.07,1.5,PI/2,0,0); box(bin,"cast",wb,0.78,0,0.3,0.4,0.4);
    for(s=-1;s<=1;s+=2) box(bin,"black",3.95,0.8,s*0.3,1.3,0.12,0.08);
    box(bin,"black",4.58,0.92,0,0.1,0.5,0.8);
    for(i=0;i<9;i++) rbox(bin,i%3===2?"orange":"black",3.55+i*0.11,0.78,0,0.085,0.52,0.82,0.015);
    /* stack (rain cap flaps on the exhaust), pre-cleaner */
    cyl(bin,"chrome",1.35,2.85,0,0.11,1.9); cyl(bin,"black",1.35,1.95,0,0.14,0.12);
    cyl(bin,"chrome",2.35,2.05,0.18,0.07,0.32); cyl(bin,"black",2.35,2.25,0.18,0.12,0.16);
    U.tips.push(new THREE.Vector3(1.35,3.82,0)); U.dirs.push(new THREE.Vector3(-0.1,1,0).normalize());
    var flap=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.13,0.015,14).translate(0.12,0,0), M.chrome); flap.position.set(1.23,3.81,0); flap.castShadow=true; U.flap=flap;
    /* drawbar hitch + wheelie bars with skid wheels */
    box(bin,"black",-0.7,0.52,0,0.5,0.1,0.18); box(bin,"satin",-0.98,0.52,0,0.08,0.16,0.08);
    for(s=-1;s<=1;s+=2){ rod(bin,"black",[-0.45,0.72,s*0.42],[-1.7,0.26,s*0.42],0.045); rod(bin,"black",[-0.45,0.48,s*0.42],[-1.5,0.27,s*0.42],0.035);
      cyl(bin,"black",-1.72,0.17,s*0.42,0.12,0.08,PI/2,0,0); }
    U.hitch=new THREE.Vector3(-1.02,0.52,0); U.front=4.65; U.mid=1.4; U.top=3.9; U.maxPitch=0.105; U.bars=new THREE.Vector3(-1.72,0.05,0);
  }
  /* pivot about the rear axle centre */
  pivot.position.set(0, rr, 0); body.position.set(0, -rr, 0);
  pullBinTo(bin, body, mats, true);
  if(U.flap) body.add(U.flap);
  var rimR=kind==="tractor"?P.cream:M.alu, rimF=kind==="tractor"?P.cream:M.alu, st=kind==="tractor"?"star":"bead";
  for(s=-1;s<=1;s+=2){
    var w1=pullWheel(rr, wr, kind==="tractor"?0.5:0.27, kind==="tractor"?"ag":"cut", s, rimR, st); w1.position.set(0, rr, s*trR); g.add(w1); U.wheelsR.push(w1.userData.spin);
    var w2=pullWheel(rf, wf, kind==="tractor"?0.26:0.27, kind==="tractor"?"rib":"cut", s, rimF, st); w2.position.set(wb, rf, s*trF); body.add(w2); U.wheelsF.push(w2.userData.spin);
  }
  U.rr=rr; U.rf=rf; U.wr=wr; U.trR=trR; U.wb=wb; U.pivot=pivot; U.body=body; U.mats=mats;
  /* sponsor livery: the door decal mesh (material swap) and logo spots in body space */
  U.livNum=kind==="tractor"?"4020":String(((color>>>0)%89)+11); U.livDecal=body.children.filter(function(c){ return c.material===mats.decal; })[0]||null;
  U.livSpots=kind==="tractor"?[{role:"hood", w:0.76, h:0.28, p:[2.64,1.852,0], u:[0,0,-1], v:[-0.9992,0.04,0]}]
    :[{role:"hood", w:0.72, h:0.27, p:[3.55,1.976,0], u:[0,0,-1], v:[-1,0,0]},
      {role:"side", i:0, w:1.45, h:0.46, p:[-0.2,1.46,1.006], u:[1,0,0], v:[0,1,0]}, {role:"side", i:0, w:1.45, h:0.46, p:[-0.2,1.46,-1.006], u:[-1,0,0], v:[0,1,0]},
      {role:"side", i:1, w:0.9, h:0.34, p:[3.72,1.56,1.0], u:[1,0,0], v:[0,1,0]}, {role:"side", i:1, w:0.9, h:0.34, p:[3.72,1.56,-1.0], u:[-1,0,0], v:[0,1,0]}];
  g.userData=U;
  return g;
}
function pullSled(){
  var P=pullMats(), M=sc_mats(), g=new THREE.Group(), bin=sc_bin(), bx=PULL.g.box, cy=PULL.g.cyl, i, s, L=PULL_SLED_L;
  function box(m,x,y,z,w,h,d,rx,ry,rz){ bin.add(m, bx, mkM(x,y,z,rx||0,ry||0,rz||0,w,h,d)); }
  function rod(m,a,c,r){ var mm=sc_rodM(new THREE.Vector3(a[0],a[1],a[2]), new THREE.Vector3(c[0],c[1],c[2])); mm.multiply(new THREE.Matrix4().makeScale(2*r,1,2*r)); bin.add(m, cy, mm); }
  /* I-beam rails, cross members */
  for(s=-1;s<=1;s+=2){ var zr=s*0.66; box("sled",-L/2-0.1,0.98,zr,L-0.8,0.3,0.035); box("sled",-L/2-0.1,1.12,zr,L-0.8,0.03,0.2); box("sled",-L/2-0.1,0.84,zr,L-0.8,0.03,0.2); }
  [-0.75,-2.7,-4.6,-6.5,-8.3,-9.4].forEach(function(cx){ box("sled",cx,0.98,0,0.16,0.26,1.3); });
  /* gooseneck down to the hook */
  for(s=-1;s<=1;s+=2) rod("sled",[-0.6,1.0,s*0.62],[-0.05,0.66,s*0.12],0.07);
  box("cast",-0.12,0.62,0,0.22,0.22,0.3); box("satin",0.02,0.62,0,0.12,0.06,0.12);
  /* the pan: wide plate on the dirt, turned-up front lip, hung off the frame on posts */
  box("pan",-1.45,0.05,0,2.3,0.05,3.1); box("pan",-0.18,0.2,0,0.42,0.05,3.1,0,0,0.62); box("sled",-1.45,0.12,1.55,2.3,0.18,0.05); box("sled",-1.45,0.12,-1.55,2.3,0.18,0.05);
  for(s=-1;s<=1;s+=2){ rod("cast",[-0.7,0.08,s*0.66],[-0.7,0.85,s*0.66],0.06); rod("cast",[-2.3,0.08,s*0.66],[-2.3,0.85,s*0.66],0.06); rod("sled",[-0.7,0.1,s*1.4],[-1.6,0.86,s*0.66],0.04); }
  /* rear axle and the operator's cage */
  rod("cast",[-8.5,0.48,-1.5],[-8.5,0.48,1.5],0.07); for(s=-1;s<=1;s+=2) box("sled",-8.5,0.72,s*0.66,0.5,0.4,0.12);
  box("plate",-9.6,0.98,0,0.9,0.06,1.4); box("cast",-9.75,1.25,0,0.35,0.5,0.45); box("black",-9.62,1.45,0.32,0.2,0.3,0.25);
  for(i=0;i<4;i++){ var px=(i&1)?-9.15:-10.0, pz=(i&2)?0.68:-0.68; rod("sled",[px,1.0,pz],[px,2.55,pz],0.04); }
  box("sled",-9.58,2.56,0,0.95,0.06,1.42); box("suit",-9.6,1.62,0,0.32,0.4,0.36); bin.add("helmet", PULL.g.sph, mkM(-9.58,1.92,0,0,0,0,0.26,0.28,0.26));
  /* a drive chain + track on top of each rail for the box carriage */
  for(s=-1;s<=1;s+=2) box("satin",-L/2+0.2,1.15,s*0.66,L-1.6,0.03,0.06);
  var mats={sled:P.sled, cast:P.cast, pan:P.pan, plate:P.plate, satin:M.satin, black:M.black, suit:P.suit, helmet:P.helmet};
  pullBinTo(bin, g, mats, true);
  /* weight box: stacked plates on a carriage; slides from the rear wheels to the pan */
  var bg=new THREE.Group(), bb=sc_bin(); var pw=1.7, pd=2.1;
  for(i=0;i<7;i++){ bb.add(i===6?"orange":"plate", sc_rbox(pw,0.112,pd,0.012), mkM(0,1.24+i*0.12,0)); }
  bb.add("cast", bx, mkM(0,1.17,0,0,0,0,pw+0.1,0.06,1.6)); for(s=-1;s<=1;s+=2) for(i=-1;i<=1;i+=2) bb.add("satin", cy, mkM(i*0.6,1.17,s*0.66,PI/2,0,0,0.14,0.22,0.14));
  bb.add("cast", bx, mkM(0,2.12,0,0,0,0,0.3,0.12,0.5)); bb.add("satin", cy, mkM(0,2.2,0,0,0,PI/2,0.08,0.5,0.08));
  pullBinTo(bb, bg, {plate:P.plate, orange:P.orange, cast:P.cast, satin:M.satin}, true);
  for(s=-1;s<=1;s+=2){ var sg=new THREE.Mesh(new THREE.PlaneGeometry(1.55,0.36), PULL.mats.sign); var uv=sg.geometry.attributes.uv, U2=PULL_UV.sled;
    for(i=0;i<uv.count;i++) uv.setXY(i, U2[0]+uv.getX(i)*(U2[2]-U2[0]), U2[1]+uv.getY(i)*(U2[3]-U2[1]));
    sg.position.set(0,1.6,s*(pd/2+0.004)); if(s<0) sg.rotation.y=PI; bg.add(sg); }
  bg.position.x=PULL_BOX0; g.add(bg);
  /* rear duals */
  var wheels=[]; for(s=-1;s<=1;s+=2) for(i=0;i<2;i++){ var w=pullWheel(0.48,0.3,0.25,"rib",s,P.cream,"star"); w.position.set(-8.5,0.48,s*(0.98+i*0.34)); g.add(w); wheels.push(w.userData.spin); }
  /* dirt pushed up ahead of the pan, spilling off its corners */
  var pile=new THREE.Mesh(PULL.g.mound, PULL.mats.dirt), pl=new THREE.Mesh(PULL.g.mound, PULL.mats.dirt), pr=new THREE.Mesh(PULL.g.mound, PULL.mats.dirt);
  pile.position.set(0.12,0,0); pl.position.set(-0.9,0,1.72); pr.position.set(-0.9,0,-1.72); [pile,pl,pr].forEach(function(m){ m.receiveShadow=true; m.castShadow=true; m.scale.set(0.01,0.01,0.01); g.add(m); });
  g.userData={box:bg, wheels:wheels, pile:pile, pileL:pl, pileR:pr, hook:new THREE.Vector3(0.06,0.62,0)};
  return g;
}

/* --- scoreboard: class, distance in feet (big), FULL PULL flashing --- */
function pullBoardDraw(o, force){
  var B=PULL.board; if(!B) return; var ph=o.phase||"stage", full=!!o.full, d=o.distFt, flash=full && (Math.floor(PULL.t*2.6)%2===0);
  var ds=(d!=null&&isFinite(d))?(+d).toFixed(2):null, key=[ph, ds, o.cls||"", full, flash, PULL.night].join("|");
  if(!force && key===B.key) return; if(!force && ph==="pull" && !full && PULL.t-B.at<0.09) return;
  B.key=key; B.at=PULL.t;
  var x=B.cv.getContext("2d"), MONO="'IBM Plex Mono','Courier New',monospace", F="'Chakra Petch','Arial Narrow',Arial,sans-serif";
  x.fillStyle="#060607"; x.fillRect(0,0,512,256); x.strokeStyle="#34373c"; x.lineWidth=10; x.strokeRect(5,5,502,246);
  x.fillStyle="#d97757"; x.fillRect(10,10,492,6);
  x.textBaseline="middle"; x.textAlign="left"; x.fillStyle="#d97757"; x.font="700 30px "+F; x.fillText(String(o.cls||"OPEN CLASS").toUpperCase(), 24, 42, 330);
  x.textAlign="right"; x.fillStyle="#9aa0a8"; x.font="700 24px "+F; x.fillText(ph==="stage"?"HOOKED":ph==="pull"?"PULLING":"FINAL", 488, 42);
  if(full){
    x.textAlign="center"; x.fillStyle=flash?"#d97757":"#f4efe2"; x.font="700 96px "+F; x.fillText("FULL PULL", 256, 132, 470);
    x.fillStyle="#ffcf73"; x.font="700 44px "+MONO; x.fillText((ds||"300.00")+" FT", 256, 212);
  } else {
    x.textAlign="right"; x.fillStyle="#ffb22c"; x.font="700 112px "+MONO; x.fillText(ds!=null&&ph!=="stage"?ds:"---.--", 420, 142);
    x.fillStyle="#ffcf73"; x.font="700 38px "+F; x.fillText("FT", 488, 160);
    x.textAlign="left"; x.fillStyle="#7d828a"; x.font="700 22px "+F; x.fillText("PRAIRIE ENGINE WORKS", 24, 222);
    if(ds!=null&&ph!=="stage"){ x.textAlign="right"; x.fillStyle="#ffcf73"; x.font="600 26px "+MONO; x.fillText((+d*0.3048).toFixed(2)+" m", 488, 222); }
  }
  B.tex.needsUpdate=true;
}

/* --- day / night --- */
function pullSetNight(on){
  on=!!on; var tierChanged=PULL.tier!==GFX; if(PULL.night===on && !tierChanged) return;
  PULL.night=on; PULL.tier=GFX; var S3=PULL.scene, lite=(GFX==="lite"), M=PULL.mats;
  PULL.sky.material.uniforms.uNight.value=on?1:0;
  var h=on?STRIP_HOR_N:STRIP_HOR; PULL.horLin=new THREE.Color(h[0],h[1],h[2]);
  PULL.sunDir=(on?STRIP_MOON:STRIP_SUN_DAY);
  PULL.sun.color.set(on?0x9fb2d6:0xffe2bc); PULL.sun.intensity=on?0.14:1.45; PULL.sun.castShadow=!lite;
  PULL.hemi.intensity=on?0.12:0.2; PULL.hemi.color.set(on?0x3a4764:0xcfdcf0); PULL.hemi.groundColor.set(on?0x16130e:0x6a5a3c);
  PULL.flood.intensity=on?(lite?0.55:0.25):0;
  M.lamp.color.set(on?0xffffff:0x5e5e5e);
  if(PULL.beamMesh){ PULL.beamMesh.visible=on; M.beam.opacity=on?0.014:0; ultraBeam(PULL.beamMesh, M.beam); }
  if(PULL.wheel) PULL.wheel.bulbs.material.color.set(on?0xffc070:0x553322);
  S3.environment=stripEnv(on);
  PULL.exposure=on?0.98:0.9;
  if(PULL.board) PULL.board.mat.color.set(on?0xffffff:0xd8d8d8);
  [PULL.fx, PULL.fxDirt, PULL.fxConf].forEach(function(F){ if(F){ F.mat.uniforms.uAmb.value=F===PULL.fxConf?1:(on?0.42:1); F.mat.uniforms.uFogN.value=S3.fog.near; F.mat.uniforms.uFogF.value=S3.fog.far; } });
  if(tierChanged && PULL.sun.shadow.map){ PULL.sun.shadow.map.dispose(); PULL.sun.shadow.map=null; }
  /* floodlights ride the towers nearest the action; only one casts shadows, and only on Full/Ultra */
  PULL.spots.forEach(function(sp){ S3.remove(sp); S3.remove(sp.target); if(sp.shadow&&sp.shadow.map) sp.shadow.map.dispose(); }); PULL.spots=[];
  if(on){ for(var i=0;i<3;i++){ var sp=new THREE.SpotLight(0xfff0d8, 1.5, 130, 0.62, 0.6, 1.5); sp.castShadow=!lite && i===0; if(sp.castShadow){ sp.shadow.mapSize.set(1024,1024); sp.shadow.bias=-0.002; sp.shadow.normalBias=0.05; sp.shadow.camera.near=4; sp.shadow.camera.far=140; }
    S3.add(sp); S3.add(sp.target); PULL.spots.push(sp); } ultraSpots(PULL.spots); }
  if(!lite) ultraShadow(PULL.sun, 2048);
}

/* --- effects: roost off the rear tyres, dust over the track, black smoke out the stack(s), confetti --- */
function pullEffects(o, dt, V){
  var U=V.userData, FX=PULL.fx, FD=PULL.fxDirt, lite=GFX==="lite", rate=lite?0.5:1, ph=o.phase||"stage";
  var v=Math.max(0,+o.v||0), slip=clamp(+o.slip||0,0,1), smoke=clamp(o.smoke==null?0.15:+o.smoke,0,1), pulling=(ph==="pull");
  var R=Math.random, i, t;
  /* a wet track throws clods and little dust; a dry, cut-up one hangs a cloud over the pan */
  var TRK=o.track||null, dustK=TRK?clamp(1+1.6*(0.5-clamp(+TRK.moist,0,1))+0.6*clamp(+TRK.cut||0,0,1),0.3,2.2):1, raV=clamp(+o.runaway||0,0,1);
  /* roost: clods + spray thrown up and back, more with slip and speed */
  var k=pulling ? clamp(slip*1.25+v*0.05, 0, 1.4) : 0;
  var pk0=clamp(((+o.hp||0)-1500)/3000,0,1.5); k*=1+0.35*pk0;
  if(k>0.02){ for(t=0;t<2;t++){ var s=t?1:-1; _pA.set(V.position.x-U.rr*0.55, U.rr*0.75, s*U.trR);
      var nc=k*rate*70*dt, n=Math.floor(nc)+(R()<nc%1?1:0);
      for(i=0;i<n;i++){ var up=2.5+R()*6.5*(0.4+slip), back=2+R()*5*(0.3+slip);
        FD.emit(_pA.x-R()*0.3, _pA.y+R()*0.4, _pA.z+(R()-0.5)*U.wr*0.9, v*0.4-back, up, s*R()*1.6+(R()-0.5), 0.9+R()*0.7, 0.1+R()*0.12, 0.15+R()*0.17, 0.26, 0.18, 0.11, 1, {drag:0.12, grav:9.8, fin:0.02, spin:4}); }
      var ns=k*rate*34*dt, m=Math.floor(ns)+(R()<ns%1?1:0);
      for(i=0;i<m;i++) FX.emit(_pA.x-0.2, _pA.y+R()*0.3, _pA.z+(R()-0.5)*U.wr, v*0.3-1.5-R()*3.5*(0.4+slip), 2+R()*5*(0.4+slip), s*R()*1.2, 1.2+R()*0.7, 0.5, 1.8+R()*1.2, 0.5, 0.38, 0.25, 0.8, {drag:0.55, grav:3.5, fin:0.04, spin:1});
      var nd=k*rate*12*dt*dustK, md=Math.floor(nd)+(R()<nd%1?1:0);
      for(i=0;i<md;i++) FX.emit(_pA.x-1-R()*2, 0.6+R()*0.8, _pA.z+(R()-0.5)*1.5, v*0.2-0.6, 0.3+R()*0.4, -0.3-R()*0.4, 4+R()*3, 1.4, 4.2+R()*2.4, 0.5, 0.39, 0.27, 0.17, {drag:0.5, buoy:0.12, fin:0.15, spin:0.3}); } }
  /* the pan ploughs: dust off the pile */
  if(pulling && v>0.15){ var S=PULL.sled, nb=rate*(0.6+(+o.boxFrac||0)*1.5)*v*1.4*dt*dustK, mb=Math.floor(nb)+(R()<nb%1?1:0);
    for(i=0;i<mb;i++){ var side=R()<0.5?-1:1; FX.emit(S.position.x-0.2-R()*1.5, 0.25, side*(1.2+R()*0.8), v*0.3, 0.4+R()*0.5, side>0?0.3:-0.9, 3.5+R()*2, 0.8, 3.2+R()*1.6, 0.5, 0.39, 0.27, 0.14, {drag:0.6, buoy:0.15, fin:0.1, spin:0.3}); } }
  /* black smoke: puffs leave the stack fast, slow, swell and drift with the wind */
  var pk=clamp(((+o.hp||0)-1500)/3000,0,1.5);   /* big builds (Unlimited): more smoke, bigger roost, flames at the stacks */
  var ns2=rate*(lite?16:30)*(0.25+smoke)*(1+0.8*pk)*dt;
  if(o.killed) ns2=0; else if(raV>0) ns2*=1+3.5*raV;   /* runaway: a grey-white torrent of burnt oil; killed: nothing at all */
  for(t=0;t<U.tips.length;t++){ V.userData.body.localToWorld(_pB.copy(U.tips[t])); _pD.copy(U.dirs[t]).applyQuaternion(U.pivot.quaternion);
    var nn=Math.floor(ns2)+(R()<ns2%1?1:0);
    if(pk>0.25 && pulling && !o.killed && (+o.throttle||0)>0.6){ var nf2=rate*(lite?10:22)*pk*dt, mf2=Math.floor(nf2)+(R()<nf2%1?1:0);
      for(i=0;i<mf2;i++) FX.emit(_pB.x+_pD.x*0.1, _pB.y+_pD.y*0.1, _pB.z, _pD.x*(5+R()*3)+v, _pD.y*(5+R()*3), _pD.z*(5+R()*3), 0.12+R()*0.1, 0.3+pk*0.2, 0.9+pk*0.4, 1, 0.55+R()*0.2, 0.15, 0.55, {drag:1.2, buoy:0.3, fin:0.02, spin:0.2}); }
    for(i=0;i<nn;i++){ var sp=1.8+smoke*2.2+R()*1.2, c=lerp(lerp(0.42,0.025,Math.pow(smoke,0.7))+R()*0.03, 0.7+R()*0.12, raV>0?Math.min(1,0.55+raV*1.5):0);
      FX.emit(_pB.x+_pD.x*0.05, _pB.y+_pD.y*0.05, _pB.z, _pD.x*sp+v, _pD.y*sp, _pD.z*sp+(R()-0.5)*0.6, 2.4+R()*1.6+smoke*1.2, 0.3+smoke*0.25, 2+smoke*4+R(), c, c*0.98, c*0.96, 0.22+0.55*smoke, {drag:0.75, buoy:0.12+smoke*0.18, fin:0.03, spin:0.5}); } }
  /* full pull: confetti over the hook */
  if(PULL.confT>0){ PULL.confT-=dt; var nf=rate*(lite?60:120)*dt, mf=Math.floor(nf)+(R()<nf%1?1:0), CC=[[1,0.48,0.1],[0.95,0.93,0.88],[0.2,0.4,0.85],[0.95,0.78,0.15],[0.2,0.7,0.35]];
    for(i=0;i<mf;i++){ var cc=CC[(R()*CC.length)|0]; PULL.fxConf.emit(V.position.x-6+R()*16, 7+R()*4, (R()-0.5)*12, (R()-0.5)*2, -0.5-R(), (R()-0.5)*2, 4+R()*2, 0.12, 0.12, cc[0], cc[1], cc[2], 1, {drag:1.6, grav:1.2, fin:0.01, spin:9}); } }
  FX.step(dt, PULL_WIND); FD.step(dt, PULL_WIND); PULL.fxConf.step(dt, PULL_WIND);
}
/* --- the crowd comes up off the planks for the hook and for a full pull --- */
function pullCrowd(dt){
  var C=PULL.crowd; if(!C) return; PULL.cheer=Math.max(0,PULL.cheer-dt*0.25);
  if(PULL.cheer<0.02 && !C.live) return;
  var t=PULL.t, amp=PULL.cheer, i, m=_pM;
  for(i=0;i<C.n;i++){ var p=C.base[i], e=C.excite[i], y=amp>0.02&&e>(amp>1?0.05:0.35)?Math.abs(Math.sin(t*(amp>1?9:7)+C.phase[i]))*0.17*Math.min(amp,2)*e:0;
    m.makeTranslation(p[0],p[1]+0.31+y,p[2]); C.body.setMatrixAt(i,m); m.makeTranslation(p[0],p[1]+0.75+y*1.15,p[2]); C.head.setMatrixAt(i,m); }
  C.body.instanceMatrix.needsUpdate=true; C.head.instanceMatrix.needsUpdate=true; C.live=PULL.cheer>=0.02;
}
/* --- the chain: links along a sagging line from the hitch to the sled hook --- */
function pullChain(a, b, sag){
  var C=PULL.chain, n=C.count, i; _pD.subVectors(b,a); var L=_pD.length(); if(L<1e-4) return; _pD.divideScalar(L);
  for(i=0;i<n;i++){ var f=(i+0.5)/n; _pC.copy(a).addScaledVector(_pD, L*f); _pC.y-=sag*4*f*(1-f);
    var dy=-sag*4*(1-2*f)/Math.max(0.2,L); _pB.copy(_pD); _pB.y+=dy; _pB.normalize();
    _pQ.setFromUnitVectors(_sbX, _pB); _sbQ.setFromAxisAngle(_sbX, (i&1)?PI/2:0); _pQ.multiply(_sbQ);
    _pM.compose(_pC, _pQ, _sbS.set(L/n/0.08,1,1)); C.setMatrixAt(i,_pM); }
  C.instanceMatrix.needsUpdate=true;
}

/* --- camera direction: stage, launch, side tracking, low front for the hop, sled, the line, the stop --- */
function pullCut(name){ if(PULL.shot!==name){ PULL.shot=name; PULL.shotT=0; PULL.cutT=0; PULL.snap=true; } }
function pullDirect(o, dt, V){
  var ph=o.phase||"stage", v=Math.max(0,+o.v||0), U=V.userData, vx=V.position.x, fx=vx+U.front, S=PULL.sled, sf=S.position.x, sr=sf-PULL_SLED_L, hx=+o.x||0;
  var s=PULL.shot, T;
  if(PULL.skip) s="stop";
  else if(ph==="stage") s="stage";
  else if(ph==="pull"){
    if(s===null||s==="stage"||s==="stop") s=PULL.pullT<1.5?"launch":"side";
    if(s==="launch" && PULL.shotT>2.4) s="side";
    if(hx>PULL_LINE-16 && v>0.6 && hx<PULL_LINE-3 && s!=="line" && PULL_LINE+14-fx>8) s="line";
    else if(s==="side" && PULL.shotT>4.2) s=(v>0.9 && hx<PULL_LINE-30)?"low":"sled";
    else if(s==="low" && (PULL.shotT>3.2 || PULL.fixX-fx<3.5)) s="sled";
    else if(s==="sled" && PULL.shotT>3.6) s="side";
    else if(s==="line" && PULL.fixX-fx<5.5) s="side";
  } else { if(s!=="stop" && !(s==="line" && PULL.doneT<1.6)) s="stop"; }
  if(s!==PULL.shot){ if(s==="low") PULL.fixX=fx+7+v*0.8; if(s==="line") PULL.fixX=PULL_LINE+14; }
  pullCut(s);
  PULL.shotT+=dt; PULL.cutT+=dt; T=PULL.shotT;
  var fov=44, rel=false, ax=0, sm=0, cx=vx+U.mid;
  switch(s){
    case "stage": { var push=Math.min(2.5,T*0.22); _pw.set(fx+4.6-push, 2.3, 6.4-push*0.5); _pt.set(vx-3.2, 0.9, -0.4); fov=46; break; }
    case "launch": rel=true; ax=vx; _pw.set(-3.4, 1.05, 4.3); _pt.set(1.6, 1.25, -0.2); fov=50; sm=4; PULL.shake=Math.max(PULL.shake, 0.06*clamp(+o.slip||0,0,1)); break;
    case "side": rel=true; ax=cx; _pw.set(0.2, 1.5+U.top*0.45, 6.0); _pt.set(-1.2, U.top*0.55, -0.8); fov=62; sm=3; break;
    case "low": _pw.set(PULL.fixX, 0.42, 2.7); _pt.set(vx+U.mid*0.6, 1.25+U.top*0.12, 0); fov=42; break;
    case "sled": rel=true; ax=sr; _pw.set(-4.2, 3.7, 5.6); _pt.set(PULL_SLED_L+2.4, 0.9, -0.2); fov=48; sm=3; break;
    case "line": _pw.set(PULL.fixX, 1.7, 5.6); _pt.set(vx+U.mid, 1.2, 0); fov=40; break;
    case "stop": { var dr=Math.min(3,T*0.25); _pw.set(sr-10+dr, 3.4-dr*0.2, 7.0-dr*0.3); _pt.set(sf+10, 4.4, -1.8); fov=36; break; }
  }
  if(rel){ if(PULL.snap||!PULL.relOn){ _pr.copy(_pw); _prt.copy(_pt); } else { var kk=1-Math.exp(-sm*dt); _pr.lerp(_pw,kk); _prt.lerp(_pt,kk); }
    _pw.copy(_pr); _pt.copy(_prt); _pw.x+=ax; _pt.x+=ax; PULL.relOn=true; } else PULL.relOn=false;
  if(PULL.snap){ PULL.fov=fov; PULL.snap=false; PULL.camTgt.copy(_pt); } else PULL.fov+=(fov-PULL.fov)*(1-Math.exp(-6*dt));
  /* the look point is eased so world-fixed shots pan smoothly after the vehicle */
  PULL.camPos.copy(_pw); if(rel) PULL.camTgt.copy(_pt); else PULL.camTgt.lerp(_pt, 1-Math.exp(-8*dt));
  var ease=1-smoothstep(0,0.15,PULL.cutT); if(ease>0) PULL.camPos.addScaledVector(_pD.subVectors(PULL.camPos,PULL.camTgt), 0.06*ease);
  PULL.shake*=Math.exp(-dt*3.5); var sh=PULL.shake; if(sh>0.002){ PULL.camPos.x+=(Math.random()-0.5)*sh*0.2; PULL.camPos.y+=(Math.random()-0.5)*sh*0.2; }
  var cam=PULL.cam; cam.position.copy(PULL.camPos); cam.lookAt(PULL.camTgt); cam.fov=PULL.fov; cam.updateProjectionMatrix(); bandLens(cam);
}
function pullComposer(){
  if(PULL.composer===false) return null;
  var sz=renderer.getSize(new THREE.Vector2()), pr=renderer.getPixelRatio(), C=ultraComposerKeep(PULL.composer);
  if(!C){ try{ C=ultraComposerMark(new THREE.EffectComposer(renderer, ultraRT())); C.addPass(ultraRenderPass(PULL.scene, PULL.cam, "pull"));
      var bp=new THREE.UnrealBloomPass(new THREE.Vector2(Math.max(1,sz.x*pr/2), Math.max(1,sz.y*pr/2)), 0.3, 0.4, 0.9); C.addPass(bp); PULL.bloom=bp;
      if(THREE.GammaCorrectionShader) C.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
      PULL.composer=C; PULL.cSize=""; }catch(e){ PULL.composer=false; return null; } }
  var key=sz.x+"x"+sz.y+"@"+pr; if(PULL.cSize!==key){ if(C.setPixelRatio) C.setPixelRatio(pr); C.setSize(sz.x, sz.y); PULL.cSize=key; }
  var n=!!PULL.night, b=PULL.bloom; b.strength=n?0.6:0.25; b.threshold=n?0.72:0.92; b.radius=n?0.5:0.4;
  return C;
}
function pullRender(){
  var S3=PULL.scene, cam=PULL.cam; if(!S3||!cam) return;
  var C=(GFX!=="lite" && THREE.EffectComposer && THREE.UnrealBloomPass && THREE.RenderPass && THREE.ShaderPass) ? pullComposer() : null;
  if(C) S3.fog.color.copy(PULL.horLin); else S3.fog.color.copy(PULL.horLin).convertLinearToSRGB();
  PULL.sky.position.copy(cam.position);
  [PULL.fx, PULL.fxDirt, PULL.fxConf].forEach(function(F){ if(F) F.mat.uniforms.uFog.value.copy(PULL.horLin); });
  var ex=renderer.toneMappingExposure; renderer.toneMappingExposure=PULL.exposure;
  var inf=renderer.info, ar=inf.autoReset; inf.autoReset=false; inf.reset();
  if(C) C.render(); else renderer.render(S3, cam);
  PULL.stats={calls:inf.render.calls, tris:inf.render.triangles, tier:GFX, shot:PULL.shot, parts:PULL.fx.P.length+PULL.fxDirt.P.length+PULL.fxConf.P.length}; inf.autoReset=ar;
  renderer.toneMappingExposure=ex;
}
function pullReset(){
  [PULL.fx, PULL.fxDirt, PULL.fxConf].forEach(function(F){ if(F) F.clear(); });
  PULL.shot=null; PULL.prev={}; PULL.shake=0; PULL.cheer=0; PULL.confT=0; PULL.skip=false; PULL.x0=null; PULL.pullT=0; PULL.doneT=0; PULL.tension=0;
  if(PULL.crowd && PULL.crowd.live) pullCrowd(0);
  if(PULL.ruts){ PULL.ruts.tyre.forEach(function(m){ m.visible=false; }); PULL.ruts.pan.visible=false; }
  if(PULL.board) PULL.board.key="";
}
function pullUpdate(o, dt){
  if(!PULL.built) buildPullScene();
  var S3=PULL.scene; PULL.t+=dt;
  if(PULL.tier!==GFX || PULL.night!==!!o.night) pullSetNight(!!o.night);
  var kind=o.vehicle==="tractor"?"tractor":"truck", col=o.color!=null?o.color:(kind==="tractor"?0xd9661c:0xa32a26), vk=kind+":"+col;
  if(!PULL.veh[vk]){ PULL.veh[vk]=pullVehicle(kind, col); S3.add(PULL.veh[vk]); }
  for(var k in PULL.veh) PULL.veh[k].visible=(k===vk);
  var V=PULL.veh[vk], U=V.userData; PULL.cur=V; pullLivery(U);
  var ph=o.phase||"stage", x=+o.x||0, v=Math.max(0,+o.v||0), slip=clamp(+o.slip||0,0,1), hop=clamp(+o.hop||0,0,1), bf=clamp(+o.boxFrac||0,0,1), i;
  if(ph==="stage" && PULL.prev.phase && PULL.prev.phase!=="stage") pullReset();
  if(ph!=="stage" && PULL.prev.phase==="stage"){ PULL.cheer=Math.max(PULL.cheer,0.9); }
  if(ph==="pull") PULL.pullT+=dt; if(ph==="done") PULL.doneT+=dt;
  if(o.full && !PULL.prev.full){ PULL.cheer=2.4; PULL.confT=5; PULL.shake=Math.max(PULL.shake,0.25); }
  if(ph==="done" && PULL.prev.phase==="pull" && !o.full) PULL.cheer=Math.max(PULL.cheer,1.0);
  if(PULL.x0==null || ph==="stage") PULL.x0=x;
  if(+o.runaway>0 && !o.killed) PULL.shake=Math.max(PULL.shake, 0.05+0.1*clamp(+o.runaway,0,1));   /* the whole truck shakes as it screams */
  /* track condition: darker and wetter early, paler and dustier as it dries and gets chewed up (no field = neutral) */
  if(PULL.trackMat){ var trk=o.track||null, tmo=trk?clamp(+trk.moist,0,1):0.5, tcu=trk?clamp(+trk.cut||0,0,1):0, tkey=tmo.toFixed(2)+"|"+tcu.toFixed(2);
    if(PULL.trackKey!==tkey){ PULL.trackKey=tkey; var wet=tmo-0.5, kk=(wet>0?1-0.62*wet:1-0.5*wet)*(1-0.07*tcu);
      PULL.trackMat.color.setRGB(kk, kk*(1-0.03*Math.abs(wet)), kk*(1-0.08*Math.abs(wet)));
      if(PULL.mats.dirt) PULL.mats.dirt.color.setHex(0x9a8270).multiplyScalar(kk); } }
  /* vehicle: hitch at x; pitch is a damped spring on hop (front lifts about the rear axle), squat under load */
  V.position.set(x-U.hitch.x, 0, 0);
  var load=ph==="pull"?0.4+0.6*bf:0, target=U.maxPitch*hop+0.012*load*(1+slip)+(ph==="pull"?Math.sin(PULL.t*9.0)*0.004*slip:0);
  var n=Math.min(8, Math.ceil(dt/0.01)), h=n?dt/n:0, om=8, ze=0.32;
  for(i=0;i<n;i++){ U.pv+=(om*om*(target-U.pitch)-2*ze*om*U.pv)*h; U.pitch+=U.pv*h; }
  var pmax=U.maxPitch+0.012; if(U.pitch>pmax){ U.pitch=pmax; if(U.pv>0) U.pv*=-0.3; } if(U.pitch<-0.012){ U.pitch=-0.012; if(U.pv<0) U.pv=0; }
  var idle=(+o.rpm||800)/60;
  U.pivot.rotation.z=U.pitch; U.pivot.position.y=U.rr-0.025*load+Math.sin(PULL.t*idle*1.3)*0.0025;
  /* wheels: the rears turn faster than the ground when they slip */
  var ws=v*(1+2.2*slip)+slip*(ph==="pull"?5:0), wr=ws/U.rr, wf=(U.pitch>0.03?U.spinF*0.98:v/U.rf);
  U.spinF=wf; U.spinR=wr;
  for(i=0;i<U.wheelsR.length;i++){ var sp=U.wheelsR[i]; sp.rotation.y=(sp.rotation.y-wr*dt)%TAU; }
  for(i=0;i<U.wheelsF.length;i++){ var sf2=U.wheelsF[i]; sf2.rotation.y=(sf2.rotation.y-wf*dt)%TAU; }
  if(U.flap){ U.flap.rotation.z=clamp(0.25+(+o.smoke||0)*1.1+(ph==="pull"?0.3:0),0,1.35)+Math.sin(PULL.t*idle*0.9)*0.08; }
  V.updateMatrixWorld(true);
  /* sled: hook trails the hitch on the chain (slack while staged); the box rides from the rear wheels to the pan */
  PULL.tension+=((ph==="stage"?0:1)-PULL.tension)*Math.min(1,dt*5);
  var S=PULL.sled, SU=S.userData; V.userData.body.localToWorld(_pA.copy(U.hitch));
  S.position.set(_pA.x-PULL_CHAIN+(1-PULL.tension)*0.25, 0, 0); S.rotation.z=ph==="pull"?Math.sin(PULL.t*11)*0.0018*Math.min(1,v):0;
  SU.box.position.x=lerp(PULL_BOX0, PULL_BOX1, bf);
  for(i=0;i<SU.wheels.length;i++){ var sw=SU.wheels[i]; sw.rotation.y=(sw.rotation.y-v/0.48*dt)%TAU; }
  var moved=Math.max(0, x-PULL.x0), dig=clamp(moved/3,0,1)*(0.35+0.65*bf), ph2=0.06+0.42*dig;
  SU.pile.scale.set(0.3+0.35*dig, ph2*0.8, 1.55+0.15*dig); SU.pileL.scale.set(0.9*dig+0.01, ph2*0.6+0.01, 0.35*dig+0.01); SU.pileR.scale.copy(SU.pileL.scale);
  S.updateMatrixWorld(true); S.localToWorld(_pB.copy(SU.hook));
  pullChain(_pA, _pB, (1-PULL.tension)*0.22+0.01);
  /* ruts behind the rear tyres, the pan's scar and its side berms */
  var R=PULL.ruts, r0=PULL.x0-U.hitch.x, r1=V.position.x, len=r1-r0;
  for(i=0;i<2;i++){ var tm=R.tyre[i]; tm.visible=len>0.05; if(tm.visible){ tm.position.set((r0+r1)/2, 0.012, (i?1:-1)*U.trR); tm.scale.set(len, 1, U.wr*0.95); } }
  var p0=PULL.x0-PULL_CHAIN-1.4, p1=S.position.x-1.4, pl=p1-p0; R.pan.visible=pl>0.05; if(R.pan.visible){ R.pan.position.set((p0+p1)/2, 0.008, 0); R.pan.scale.set(pl, 1, 3.0); }
  pullEffects(o, dt, V);
  pullCrowd(dt);
  pullBoardDraw(o, false);
  /* fairground motion: Ferris wheel, flags */
  var W=PULL.wheel; if(W){ var a0=PULL.t*0.06; W.g.rotation.z=a0; for(i=0;i<16;i++){ var a=a0+i/16*TAU; _pM.compose(_pC.set(W.hub.x+Math.cos(a)*W.R, W.hub.y+Math.sin(a)*W.R-0.9, W.hub.z), _sbQ.set(0,0,0,1), _sbS.set(1.1,1.2,1.4)); W.cars.setMatrixAt(i,_pM); } W.cars.instanceMatrix.needsUpdate=true; }
  PULL.flags.forEach(function(f){ var p=f.m.geometry.attributes.position, b=f.base; for(var j=0;j<p.count;j++){ var fx=b[j*3]; p.setZ(j, Math.sin(fx*2.4-PULL.t*5+f.ph)*0.12*fx/2.2); } p.needsUpdate=true; });
  pullDirect(o, dt, V);
  /* sun (and its shadow box) rides between the camera and what it looks at */
  var c=_pC.copy(PULL.camPos).lerp(PULL.camTgt, 0.6); c.y=0;
  PULL.sun.position.copy(c).addScaledVector(PULL.sunDir, 120); PULL.sun.target.position.copy(c); PULL.sun.target.updateMatrixWorld();
  if(PULL.flood.intensity>0){ PULL.flood.position.set(c.x-20, 60, 40); PULL.flood.target.position.copy(c); PULL.flood.target.updateMatrixWorld(); }
  if(PULL.spots.length){ var poles=PULL.poles.slice().sort(function(a,b){ return Math.abs(a.x-c.x)-Math.abs(b.x-c.x); });
    PULL.spots.forEach(function(sp,j){ var pp=poles[j]; if(!pp) return; sp.position.copy(pp); sp.target.position.set(lerp(pp.x,c.x,0.5), 0, 0); sp.target.updateMatrixWorld(); }); }
  PULL.prev={phase:ph, full:!!o.full};
}


