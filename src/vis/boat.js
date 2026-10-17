/* ===========================================================================
   BOAT DRAGS SCENE — a river course the view cuts to while ENGINE_VIS.setBoat({on:true, ...}) is fed every frame.
   Units metres, +x down the course: the start buoys at x = 0, the finish buoys at 304.8 m (1,000 ft), the shutdown past
   them. Your boat runs the right lane (+z), the rival the left. The water is one plane with its own shader: on Lite a
   cheap animated tint, on Full/Ultra rolling normals, a fresnel sky and a sun glint. Grass banks with a crowd, a tree on a
   float between the lanes, timing towers at the finish, buoys that bob. Each boat sits in the water, climbs the hump and
   planes (a hydro props-rides and skips on its sponsons); rooster tails, hull spray and a foam wake behind it.
   ==========================================================================*/
var BOAT={ on:false, built:false, scene:null, cam:null, sun:null, hemi:null, sky:null, fog:null, mats:{}, water:null, wMat:null, boats:{}, me:null, opp:null, fx:null, fxMist:null,
  tree:null, lamps:null, boards:[], crowd:null, buoys:null, camPos:new THREE.Vector3(), camTgt:new THREE.Vector3(), fov:45, shot:null, shotT:0, snap:true, relOn:false, skip:false,
  t:0, doneT:0, cheer:0, tier:null, prev:{}, lastT:0, composer:null, exposure:0.9, stats:null, horLin:null, sunDir:null, shake:0, fixX:0, night:null, st:{me:{}, opp:{}} };
/* night: light poles along both banks (built the first night only, vis/boat.js boatNightKit); the water mirrors them */
var BOAT_POLES=[[20,71],[105,71],[190,71],[262,73],[-8,-66],[80,-66],[170,-66],[258,-66]], BOAT_POLE_H=15, BOAT_FLOOD=new THREE.Vector3(0.18,1,0.42).normalize();
var BOAT_LZ=6, BOAT_FIN=304.8, BOAT_WIND=new THREE.Vector3(-1.2,0,0.5), _btA=new THREE.Vector3(), _btw=new THREE.Vector3(), _btt=new THREE.Vector3(), _btr=new THREE.Vector3(), _btrt=new THREE.Vector3(), _btM=new THREE.Matrix4(), _btQ=new THREE.Quaternion(), _btS=new THREE.Vector3(1,1,1), _btE=new THREE.Euler();
/* the river: Lite gets two drifting ripple bands and a fresnel tint; Full/Ultra a sum of travelling waves for the normal,
   the sky reflected by it, a sun glint and the far water fading into the haze */
function boatWaterMat(lite){
  return new THREE.ShaderMaterial({ uniforms:{ uT:{value:0}, uSun:{value:STRIP_SUN_DAY.clone()}, uHor:{value:new THREE.Color(0.55,0.62,0.7)}, uZen:{value:new THREE.Color(0.08,0.2,0.46)}, uDeep:{value:new THREE.Color(0.02,0.075,0.085)},
      uFog:{value:new THREE.Color(0.55,0.62,0.7)}, uFogN:{value:200}, uFogF:{value:2600}, uChop:{value:0.2}, uNight:{value:0},
      uLmp:{value:BOAT_POLES.map(function(q){ return new THREE.Vector3(q[0], BOAT_POLE_H+1.5, q[1]); })} },
    vertexShader:"varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }",
    fragmentShader:["uniform float uT; uniform vec3 uSun; uniform vec3 uHor; uniform vec3 uZen; uniform vec3 uDeep; uniform vec3 uFog; uniform float uFogN; uniform float uFogF; uniform float uChop; uniform float uNight; uniform vec3 uLmp[8]; varying vec3 vW;", STRIP_GLSL_NOISE,
      "void main(){ vec2 p=vW.xz; vec3 V=normalize(cameraPosition-vW); float d=length(cameraPosition-vW);",
      lite?" float r=sin(p.x*0.35+p.y*0.12-uT*1.6)*0.5+sin(p.x*0.11-p.y*0.31+uT*1.1)*0.5; vec3 N=normalize(vec3(r*0.06*(0.6+uChop),1.0,r*0.04));"
          :" float a=0.0; vec2 g=vec2(0.0); float k=0.6+1.6*uChop; vec2 D[4]; D[0]=vec2(0.94,0.34); D[1]=vec2(0.6,-0.8); D[2]=vec2(-0.3,0.95); D[3]=vec2(0.85,-0.52); float F[4]; F[0]=0.31; F[1]=0.53; F[2]=0.87; F[3]=1.9;"+
           " for(int i=0;i<4;i++){ float ph=dot(D[i],p)*F[i]-uT*sqrt(9.8*F[i]); g+=D[i]*cos(ph)*F[i]*0.04*k/(1.0+float(i)); }"+
           " vec2 q=p*1.7+vec2(uT*0.5,uT*0.3); g+=vec2(sn(q)-0.5,sn(q+7.3)-0.5)*0.22*k*(1.0-smoothstep(10.0,80.0,d));"+
           " vec3 N=normalize(vec3(-g.x,1.0,-g.y));",
      " float fr=0.03+0.97*pow(1.0-max(dot(N,V),0.0),5.0); vec3 R=reflect(-V,N); float up=clamp(R.y,0.0,1.0);",
      " vec3 sky=mix(uHor,uZen,pow(up,0.6)); vec3 c=mix(uDeep*(0.8+0.4*sn(p*0.02)),sky*vec3(0.85,0.95,1.0),clamp(fr,0.0,0.85));",
      lite?" c+=vec3(1.0,0.9,0.75)*pow(max(dot(R,uSun),0.0),60.0)*0.6*(1.0-uNight);"
          :" c+=vec3(1.0,0.92,0.78)*(pow(max(dot(R,uSun),0.0),220.0)*2.2+pow(max(dot(R,uSun),0.0),24.0)*0.12)*(1.0-uNight);",
      /* night: each bank light laid on the water as a long streak toward the camera (narrow across, long along the view) */
      " if(uNight>0.5){ for(int i=0;i<8;i++){ vec3 L=normalize(uLmp[i]-vW); float ah=1.0-dot(normalize(R.xz+vec2(1e-4)),normalize(L.xz)); float av=R.y-L.y;",
      "   c+=vec3(1.0,0.78,0.5)*exp(-ah*"+(lite?"12000.0":"9000.0")+"-av*av*"+(lite?"60.0":"38.0")+")*"+(lite?"0.7":"1.25")+"; } }",
      " c=mix(c,uFog,smoothstep(uFogN,uFogF,d));",
      " gl_FragColor=linearToOutputTexel(vec4(c,1.0)); }"].join("\n") });
}
/* the banks: mown grass by the river, mud and sand at the waterline, fields beyond */
var BOAT_GLSL_GROUND=[
  "vec3 stripSurf(vec3 w, out float rough){",
  "  vec2 p=w.xz; float d=length(p-cameraPosition.xz); float fine=1.0-smoothstep(20.0,140.0,d), mid=1.0-smoothstep(100.0,900.0,d);",
  "  vec3 grass=vec3(0.12,0.17,0.06)*(0.8+0.35*sn(p*0.07))*(0.9+0.2*sn(p*1.7)*fine);",
  "  float edge=1.0-smoothstep(58.0,63.0,abs(p.y)); vec3 sand=vec3(0.36,0.31,0.22)*(0.85+0.3*sn(p*0.9));",
  "  vec3 c=mix(grass,sand,edge);",
  "  float lot=smoothstep(80.0,81.0,p.y)*(1.0-smoothstep(110.0,111.0,p.y))*smoothstep(-60.0,-59.0,p.x)*(1.0-smoothstep(380.0,381.0,p.x));",
  "  c=mix(c,vec3(0.3,0.28,0.24)*(0.8+0.3*sn(p*0.8)),lot);",
  "  vec2 q=(p+vec2(800.0,800.0))/650.0; vec2 cell=floor(q); float h=sh(cell+5.0);",
  "  vec3 fc= h<0.3?vec3(0.42,0.34,0.13): h<0.55?vec3(0.13,0.2,0.06): h<0.8?vec3(0.5,0.44,0.05):vec3(0.2,0.15,0.09);",
  "  fc*=0.9+0.2*(sn(p*0.006+cell*7.0)-0.5)*mid;",
  "  c=mix(fc,c,1.0-smoothstep(150.0,190.0,abs(p.y)));",
  "  rough=mix(0.95,0.6,edge); return c; }"].join("\n");
/* a hull lofted through cross-sections: secs = [{x, p:[[z,y]...]}] keel to gunwale on one side, mirrored; the deck is closed between the gunwales */
function boatLoft(secs, col){
  var pos=[], cols=[], idx=[], n=secs[0].p.length, c=sc(col), i, j, s, base;
  for(s=0;s<secs.length;s++){ var S=secs[s]; for(var side=-1; side<=1; side+=2) for(j=0;j<n;j++){ pos.push(S.x, S.p[j][1], side*S.p[j][0]); cols.push(c.r,c.g,c.b); } }
  var row=2*n, at=function(s2,side,j2){ return s2*row+(side<0?0:n)+j2; };
  for(s=0;s<secs.length-1;s++){ for(j=0;j<n-1;j++){
      var a=at(s,1,j), b=at(s+1,1,j), c2=at(s+1,1,j+1), d=at(s,1,j+1); idx.push(a,b,c2, a,c2,d);
      a=at(s,-1,j); b=at(s+1,-1,j); c2=at(s+1,-1,j+1); d=at(s,-1,j+1); idx.push(a,c2,b, a,d,c2); }
    var ga=at(s,-1,n-1), gb=at(s+1,-1,n-1), gc=at(s+1,1,n-1), gd=at(s,1,n-1); idx.push(ga,gc,gb, ga,gd,gc); }
  /* the transom */
  for(j=0;j<n-1;j++){ idx.push(at(0,-1,j),at(0,-1,j+1),at(0,1,j+1), at(0,-1,j),at(0,1,j+1),at(0,1,j)); }
  var g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); g.setAttribute("color",new THREE.Float32BufferAttribute(cols,3)); g.setIndex(idx);
  g=g.toNonIndexed(); g.computeVertexNormals(); return g;
}
var BOAT_LOOK={
  outboard:{len:6.0, beam:2.3, prop:[-0.75,-0.32], rt:0.55, k:1.0},
  jet:{len:6.6, beam:2.4, prop:[-0.1,0.05], rt:0.45, k:1.0},
  pro:{len:6.8, beam:2.4, prop:[-0.55,-0.12], rt:1.1, k:1.0},
  tfh:{len:8.4, beam:3.8, prop:[-0.7,-0.05], rt:1.6, k:1.0}};
function boatModel(cls, color){
  var L=BOAT_LOOK[cls]||BOAT_LOOK.outboard, G=new THREE.Group(), pivot=new THREE.Group(); G.add(pivot);
  var M=BOAT.mats, paint=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.32, metalness:0.15}), dark=new THREE.MeshStandardMaterial({color:sc(0x1a1c1f), roughness:0.6, metalness:0.3}),
      chrome=new THREE.MeshStandardMaterial({color:sc(0xc8ccd2), roughness:0.18, metalness:0.9}), glass=new THREE.MeshStandardMaterial({color:sc(0x26323c), roughness:0.05, metalness:0.2, transparent:true, opacity:0.55}),
      white=new THREE.MeshStandardMaterial({color:sc(0xeeeae0), roughness:0.5}), lite=GFX==="lite";
  var box=function(m,x,y,z,w,h,d,rz){ var o=new THREE.Mesh(sbGeo().box,m); o.scale.set(w,h,d); o.position.set(x,y,z); if(rz) o.rotation.z=rz; o.castShadow=!lite; pivot.add(o); return o; };
  var cyl=function(m,x,y,z,r,h,rx,rz,seg){ var o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg||12),m); o.position.set(x,y,z); if(rx) o.rotation.x=rx; if(rz) o.rotation.z=rz; o.castShadow=!lite; pivot.add(o); return o; };
  var hull, secs, spons=[];
  if(cls==="outboard"){
    secs=[{x:0,p:[[0,0.04],[0.55,0.16],[1.05,0.36],[1.12,0.78]]},{x:2.6,p:[[0,0],[0.6,0.18],[1.12,0.4],[1.16,0.82]]},{x:4.6,p:[[0,0.12],[0.45,0.3],[0.85,0.52],[0.9,0.86]]},{x:5.6,p:[[0,0.42],[0.2,0.55],[0.36,0.7],[0.4,0.88]]},{x:6.0,p:[[0,0.74],[0.03,0.78],[0.05,0.84],[0.06,0.9]]}];
    hull=new THREE.Mesh(boatLoft(secs,color), paint); pivot.add(hull);
    box(white, 2.2, 0.86, 0, 3.6, 0.06, 2.1);   /* the deck */
    box(dark, 3.3, 1.05, 0.45, 0.6, 0.4, 0.6); box(glass, 3.62, 1.32, 0.45, 0.04, 0.32, 0.62, -0.5);   /* console and screen */
    box(dark, 2.4, 1.0, 0.45, 0.55, 0.3, 0.55); box(dark, 2.4, 1.0, -0.45, 0.55, 0.3, 0.55);
    box(dark, -0.45, 1.25, 0, 0.6, 0.8, 0.5); box(paint, -0.45, 1.62, 0, 0.62, 0.12, 0.52);   /* the cowling */
    box(dark, -0.6, 0.35, 0, 0.18, 1.1, 0.12); cyl(dark, -0.62, -0.25, 0, 0.09, 0.55, 0, PI/2, 10);   /* leg and gearcase */
  } else if(cls==="tfh"){
    secs=[{x:0,p:[[0,0.12],[0.4,0.14],[0.5,0.55],[0.42,0.8]]},{x:5.0,p:[[0,0.1],[0.45,0.12],[0.55,0.55],[0.45,0.85]]},{x:7.6,p:[[0,0.25],[0.3,0.3],[0.38,0.55],[0.3,0.75]]},{x:8.4,p:[[0,0.48],[0.05,0.5],[0.08,0.55],[0.06,0.62]]}];
    hull=new THREE.Mesh(boatLoft(secs,color), paint); pivot.add(hull);
    [-1,1].forEach(function(sd){ var ss=[{x:4.2,p:[[0,0.1],[0.32,0.02],[0.62,0.1],[0.6,0.6]]},{x:7.4,p:[[0,0.04],[0.32,0.0],[0.62,0.05],[0.6,0.6]]},{x:8.3,p:[[0,0.3],[0.2,0.3],[0.38,0.35],[0.36,0.6]]}];
      var sp=new THREE.Mesh(boatLoft(ss,color), paint); sp.position.z=sd*1.45; pivot.add(sp); spons.push(sp);
      box(paint, 5.6, 0.55, sd*0.95, 2.6, 0.08, 1.0); });   /* sponsons and the wing deck between */
    box(dark, 6.6, 0.85, 0, 1.4, 0.45, 0.8); var cap=new THREE.Mesh(new THREE.SphereGeometry(0.5,14,10,0,TAU,0,PI/2), glass); cap.scale.set(1.6,0.9,0.9); cap.position.set(6.6,1.05,0); pivot.add(cap);   /* the capsule */
    box(dark, 2.6, 1.0, 0, 2.2, 0.7, 0.9); box(chrome, 2.9, 1.55, 0, 0.9, 0.45, 0.55); box(dark, 2.9, 1.95, 0, 0.7, 0.35, 0.45);   /* engine, blower, hat */
    box(dark, 0.3, 1.0, -0.6, 0.12, 1.2, 0.08); box(dark, 0.3, 1.0, 0.6, 0.12, 1.2, 0.08); box(paint, 0.3, 1.62, 0, 0.7, 0.05, 2.2);   /* the rear wing */
    box(dark, -0.3, -0.05, 0, 0.7, 0.1, 0.1);
  } else {
    var flat=cls==="pro"||cls==="jet", wl=cls==="jet"?6.6:6.8;
    secs=[{x:0,p:[[0,0.05],[0.9,0.06],[1.15,0.2],[1.18,0.82]]},{x:wl*0.55,p:[[0,0.0],[0.95,0.03],[1.2,0.2],[1.2,0.85]]},{x:wl*0.86,p:[[0,0.2],[0.6,0.24],[0.85,0.42],[0.85,0.85]]},{x:wl,p:[[0,0.62],[0.2,0.64],[0.3,0.75],[0.3,0.88]]}];
    hull=new THREE.Mesh(boatLoft(secs,color), paint); pivot.add(hull);
    box(white, wl*0.45, 0.86, 0, wl*0.8, 0.05, 2.2);
    if(cls==="jet"){ box(dark, 1.6, 1.05, 0, 1.6, 0.45, 0.9); box(chrome, 1.7, 1.42, 0, 0.7, 0.35, 0.5); cyl(chrome, 1.7, 1.75, 0, 0.18, 0.35, 0, 0, 10);
      cyl(dark, -0.15, 0.3, 0, 0.17, 0.4, 0, PI/2, 10); box(dark, 3.6, 1.1, 0.4, 0.6, 0.4, 0.6); box(dark, 3.6, 1.1, -0.4, 0.6, 0.4, 0.6); box(chrome, 3.0, 1.45, 0, 0.06, 0.06, 2.0); }
    else { box(dark, 1.6, 1.1, 0, 1.9, 0.55, 0.95); box(chrome, 1.75, 1.6, 0, 0.95, 0.5, 0.6); box(dark, 1.75, 2.05, 0, 0.75, 0.4, 0.5);
      var can=new THREE.Mesh(new THREE.SphereGeometry(0.5,14,10,0,TAU,0,PI/2), glass); can.scale.set(1.5,0.8,1.0); can.position.set(4.5,0.9,0); pivot.add(can); box(dark, 4.5, 0.95, 0, 1.4, 0.15, 0.95);
      box(dark, -0.45, -0.02, 0, 0.9, 0.08, 0.08); }
  }
  hull.castShadow=!lite; hull.receiveShadow=true;
  var prop=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,0.04,3), chrome); prop.rotation.z=PI/2; prop.position.set(L.prop[0], L.prop[1], 0); pivot.add(prop);
  G.userData={cls:cls, L:L, pivot:pivot, prop:prop, spons:spons, paint:paint, hull:hull, wake:[], wakeX:-1e9, flip:0, yaw:0, bow:0, bv:0, roll:0, y:0};
  return G;
}
/* the wake: a foam trail behind the boat (prop wash in the middle, two arms spreading out), alpha fading with age */
function boatWakeMesh(){
  var N=120, g=new THREE.BufferGeometry(), pos=new Float32Array(N*6*3*3), al=new Float32Array(N*6*3);
  g.setAttribute("position", new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute("aA", new THREE.BufferAttribute(al,1).setUsage(THREE.DynamicDrawUsage)); g.setDrawRange(0,0);
  var m=new THREE.ShaderMaterial({ uniforms:{uFog:{value:new THREE.Color(0.6,0.65,0.7)}, uFogN:{value:200}, uFogF:{value:2600}, uAmb:{value:1}},
    vertexShader:"attribute float aA; varying float vA; varying float vD; void main(){ vA=aA; vec4 mv=modelViewMatrix*vec4(position,1.0); vD=-mv.z; gl_Position=projectionMatrix*mv; }",
    fragmentShader:"uniform vec3 uFog; uniform float uFogN; uniform float uFogF; uniform float uAmb; varying float vA; varying float vD; void main(){ vec3 c=mix(vec3(0.92,0.95,0.96)*uAmb,uFog,smoothstep(uFogN,uFogF,vD)); gl_FragColor=linearToOutputTexel(vec4(c,vA*0.8)); }",
    transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-4 });
  var mesh=new THREE.Mesh(g,m); mesh.frustumCulled=false; mesh.renderOrder=3; mesh.userData.N=N; return mesh;
}
function boatWakeStep(V, wm, x, z, v, beam, live){
  var U=V.userData, W=U.wake, t=BOAT.t;
  if(live && v>0.5 && x-U.wakeX>Math.max(0.6, v*0.04)){ W.push({x:x, z:z, t:t, v:v}); U.wakeX=x; if(W.length>wm.userData.N) W.shift(); }
  var P=wm.geometry.attributes.position.array, A=wm.geometry.attributes.aA.array, q=0, k=0, i;
  var quad=function(x0,z0a,z0b,x1,z1a,z1b,a0,a1){ P[q++]=x0;P[q++]=0.03;P[q++]=z0a; P[q++]=x1;P[q++]=0.03;P[q++]=z1a; P[q++]=x1;P[q++]=0.03;P[q++]=z1b; A[k++]=a0;A[k++]=a1;A[k++]=a1;
    P[q++]=x0;P[q++]=0.03;P[q++]=z0a; P[q++]=x1;P[q++]=0.03;P[q++]=z1b; P[q++]=x0;P[q++]=0.03;P[q++]=z0b; A[k++]=a0;A[k++]=a1;A[k++]=a0; };
  for(i=W.length-1;i>0;i--){ var a=W[i], b=W[i-1], ag=t-a.t, bg=t-b.t; if(bg>9) break;
    var fa=Math.exp(-ag/2.6)*Math.min(1,a.v/12), fb=Math.exp(-bg/2.6)*Math.min(1,b.v/12);
    var wa=0.5+ag*0.9, wb=0.5+bg*0.9; quad(a.x,a.z-wa,a.z+wa, b.x,b.z-wb,b.z+wb, fa*0.75, fb*0.75);   /* the prop wash */
    for(var sd=-1; sd<=1; sd+=2){ var oa=beam*0.5+ag*(1.4+a.v*0.03), ob=beam*0.5+bg*(1.4+b.v*0.03), w2=0.35+ag*0.25, w3=0.35+bg*0.25;
      quad(a.x, a.z+sd*oa-w2, a.z+sd*oa+w2, b.x, b.z+sd*ob-w3, b.z+sd*ob+w3, fa*0.55, fb*0.55); } }
  wm.geometry.setDrawRange(0, k); wm.geometry.attributes.position.needsUpdate=true; wm.geometry.attributes.aA.needsUpdate=true;
}
function boatBoardTex(lane){ var c=newCanvas(256,128), t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.userData={cv:c, lane:lane}; boatBoardDraw(t,null,null); return t; }
function boatBoardDraw(t, et, mph){ var c=t.userData.cv, x=c.getContext("2d"); x.fillStyle="#0b0c0e"; x.fillRect(0,0,256,128); x.font="700 22px 'Chakra Petch','Arial Narrow',sans-serif"; x.textAlign="center"; x.fillStyle="#8a8f96"; x.fillText(t.userData.lane,128,24);
  x.font="700 54px 'IBM Plex Mono',monospace"; x.fillStyle="#e8956f"; x.fillText(et!=null?(+et).toFixed(3):"-.---",128,78); x.font="700 30px 'IBM Plex Mono',monospace"; x.fillStyle="#f2c22c"; x.fillText(mph!=null?(+mph).toFixed(1)+" mph":"",128,116); t.needsUpdate=true; }
function boatBuild(B,key,mat,shadow){ var keep=STRIP.scene; STRIP.scene=BOAT.scene; var m=B.build(key,mat,shadow); STRIP.scene=keep; return m; }
function buildBoatScene(){
  var S3=new THREE.Scene(); BOAT.scene=S3; BOAT.tier=GFX; var lite=GFX==="lite", M=BOAT.mats, i, k, x, z;
  var rng=function(s){ var t=Math.sin(s*127.1+3.7)*43758.5453; return t-Math.floor(t); };
  var hemi=new THREE.HemisphereLight(0xcfdcf0, 0x5a6a44, 0.3); S3.add(hemi); BOAT.hemi=hemi;
  var sun=new THREE.DirectionalLight(0xffe6c4, 1.5); sun.shadow.mapSize.set(2048,2048); var shc=sun.shadow.camera; shc.left=-30; shc.right=30; shc.top=30; shc.bottom=-30; shc.near=1; shc.far=300; sun.shadow.bias=-0.0006; sun.shadow.normalBias=0.03;
  S3.add(sun); S3.add(sun.target); BOAT.sun=sun;
  var sky=new THREE.Mesh(new THREE.SphereGeometry(2600,40,20), stripSkyMat()); sky.frustumCulled=false; sky.renderOrder=-10; S3.add(sky); BOAT.sky=sky;
  S3.fog=new THREE.Fog(0xffffff, 200, 2700); BOAT.fog=S3.fog;
  BOAT.wMat=boatWaterMat(lite); var water=new THREE.Mesh(new THREE.PlaneGeometry(4000,130), BOAT.wMat); water.rotation.x=-PI/2; water.position.set(300,0,0); S3.add(water); BOAT.water=water;
  var gm=stripSurfMat(BOAT_GLSL_GROUND); gm.customProgramCacheKey=function(){ return "boat_ground"; };
  [-1,1].forEach(function(sd){ var g=new THREE.Mesh(new THREE.PlaneGeometry(4000,3000), gm); g.rotation.x=-PI/2; g.position.set(300,0.9,sd*(63+1500)); g.receiveShadow=true; S3.add(g);
    var bank=new THREE.Mesh(new THREE.PlaneGeometry(4000,8.2), gm); bank.rotation.x=-PI/2-sd*Math.atan(1.3/8); bank.position.set(300,0.25,sd*59); bank.receiveShadow=true; S3.add(bank); });
  /* hills on the horizon */
  (function(){ var seg=120, R0=1900, pos=[], col=[], idx=[], c1=sc(0x5d6a4a), c2=sc(0x7d8a70);
    for(var s=0;s<=seg;s++){ var a=s/seg*TAU, h=Math.max(5,12+30*Math.pow(0.5+0.5*Math.sin(a*3.0+0.4),2)+14*Math.sin(a*9.0)*Math.sin(a*4.0));
      pos.push(300+Math.cos(a)*(R0-500),-2,Math.sin(a)*(R0-500), 300+Math.cos(a)*R0,h,Math.sin(a)*R0, 300+Math.cos(a)*(R0+400),h*0.6,Math.sin(a)*(R0+400)); col.push(c1.r,c1.g,c1.b,c2.r,c2.g,c2.b,c2.r,c2.g,c2.b); }
    for(s=0;s<seg;s++){ var a0=s*3, b0=(s+1)*3; idx.push(a0,b0,a0+1, b0,b0+1,a0+1, a0+1,b0+1,a0+2, b0+1,b0+2,a0+2); }
    var g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); g.setAttribute("color",new THREE.Float32BufferAttribute(col,3)); g.setIndex(idx); g.computeVertexNormals();
    var hm=new THREE.Mesh(g, new THREE.MeshStandardMaterial({vertexColors:true, roughness:1, side:THREE.DoubleSide})); hm.frustumCulled=false; S3.add(hm); })();
  M.solid=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.85}); M.metal=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.4, metalness:0.6});
  var B=new StripBatch(), STEEL=0x8d9296;
  /* timing towers at the finish (one each bank, facing the river) and the start tower */
  BOAT.boards=[]; [[1,"RIGHT LANE"],[-1,"LEFT LANE"]].forEach(function(q){ var sd=q[0], tz=sd*70;
    B.box("solid", BOAT_FIN, 6, tz, 3.2, 12, 3.2, 0xe7e2d6); B.box("solid", BOAT_FIN, 12.2, tz, 3.8, 0.4, 3.8, 0x2a2c2f); B.box("metal", BOAT_FIN, 13.6, tz, 0.25, 2.6, 0.25, STEEL);
    var tex=boatBoardTex(q[1]), bd=new THREE.Mesh(new THREE.PlaneGeometry(6,3), new THREE.MeshBasicMaterial({map:tex, toneMapped:false})); bd.position.set(BOAT_FIN-0.5, 15.5, tz-sd*1.7); bd.rotation.y=sd>0?PI:0; S3.add(bd);
    B.box("solid", BOAT_FIN, 15.5, tz-sd*1.55, 6.4, 3.4, 0.25, 0x15171b); BOAT.boards.push({tex:tex, lane:sd>0?"me":"opp"}); });
  B.box("solid", -12, 4, 72, 4, 8, 4, 0xe7e2d6); B.box("solid", -12, 8.3, 72, 5, 0.5, 5, 0x9e2a22);
  /* bleachers and pickups on the right bank by the finish, a few trailers on the left */
  for(i=0;i<5;i++){ B.box("solid", 220+i*16, 1.4, 66, 14, 0.3, 1.2, 0x9aa0a6); B.box("solid", 220+i*16, 2.0, 67.3, 14, 0.3, 1.2, 0x9aa0a6); B.box("solid", 220+i*16, 2.6, 68.6, 14, 0.3, 1.2, 0x9aa0a6); }
  var hcol=[0xe9e6dc,0x1b1d20,0x9e2a22,0x22488f,0xd0d3d6,0x2c6b3a,0xff7a1a];
  for(i=0;i<16;i++){ var hx=-40+i*24+rng(i)*6, hz=88+rng(i+3)*12, cc=hcol[i%hcol.length]; B.box("solid", hx, 1.95, hz, 5.2, 0.9, 2.0, cc, 0.3*(rng(i+7)-0.5)); B.box("solid", hx+0.9, 2.65, hz, 2.0, 0.7, 1.85, 0x22262b, 0.3*(rng(i+7)-0.5)); }
  for(i=0;i<6;i++){ B.box("solid", 40+i*45, 2.3, -82-rng(i)*6, 9, 2.8, 2.6, i%2?0xe7e2d6:0x9e2a22, 0.1); }
  boatBuild(B,"solid",M.solid,!lite); boatBuild(B,"metal",M.metal,!lite);
  /* the tree: a float between the lanes just past the start, a mast, lamps for each lane facing back up the course */
  (function(){ var T=new THREE.Group(), pl=new THREE.Mesh(new THREE.BoxGeometry(2.4,0.5,2.4), new THREE.MeshStandardMaterial({color:sc(0x2a2c2f), roughness:0.7})); pl.position.y=0.1; T.add(pl);
    var mast=new THREE.Mesh(new THREE.BoxGeometry(0.3,4.4,0.5), new THREE.MeshStandardMaterial({color:sc(0x1b1d20), roughness:0.6})); mast.position.y=2.4; T.add(mast);
    var L={me:[], opp:[]}, kinds=["pre","stage","a1","a2","a3","green","red"], ys=[4.35,4.05,3.55,3.05,2.55,2.0,1.5], cols={pre:0xfff0c0,stage:0xfff0c0,a1:0xffa020,a2:0xffa020,a3:0xffa020,green:0x30ff60,red:0xff2a1a};
    [["me",0.33],["opp",-0.33]].forEach(function(q){ kinds.forEach(function(kd,j){ var big=j>=2, m=new THREE.MeshBasicMaterial({color:0x222222, toneMapped:false}), b=new THREE.Mesh(new THREE.CylinderGeometry(big?0.17:0.09,big?0.17:0.09,0.08,12), m);
      b.rotation.z=PI/2; b.position.set(-0.3, ys[j], q[1]); b.userData={on:sc(cols[kd]).multiplyScalar(2.2), off:new THREE.Color(0x151515)}; T.add(b); L[q[0]].push(b); }); });
    T.position.set(8,0,0); S3.add(T); BOAT.tree=T; BOAT.lamps=L; })();
  /* buoys: orange at the start and finish across the course, yellow down the lane lines every 100 ft — they bob */
  (function(){ var pts=[]; [-12,0,12].forEach(function(zz){ pts.push([0,zz,1.2,0xff6a1a]); pts.push([BOAT_FIN,zz,1.2,0xff6a1a]); for(var f=100; f<1000; f+=100) pts.push([f/3.28084,zz,0.55,0xf2c22c]); });
    [-18,18].forEach(function(zz){ pts.push([0,zz,1.0,0xf4efe2]); pts.push([BOAT_FIN,zz,1.0,0xf4efe2]); });
    var im=new THREE.InstancedMesh(new THREE.SphereGeometry(0.5,12,8), new THREE.MeshStandardMaterial({roughness:0.45}), pts.length), cc=new THREE.Color();
    pts.forEach(function(p,q){ cc.set(p[3]).convertSRGBToLinear(); im.setColorAt(q,cc); }); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); S3.add(im); BOAT.buoys={mesh:im, pts:pts}; boatBuoys(0); instCull(im, 1); })();
  /* trees behind the banks */
  (function(){ var pts=[], s; for(s=0;s<(lite?70:150);s++){ var sd=s%2?1:-1, xx=-200+rng(s)*900, zz=sd*(100+rng(s+5)*120); if(sd>0&&xx>-60&&xx<380&&zz<115) continue; pts.push([xx,zz,4+rng(s+3)*3]); }
    var im=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0), new THREE.MeshStandardMaterial({roughness:1}), pts.length), mm=new THREE.Matrix4(), cc=new THREE.Color();
    pts.forEach(function(p,q){ var h=p[2]*1.6; mm.compose(_sbP.set(p[0],0.9+h*0.8,p[1]), _sbQ.set(0,0,0,1), _sbS.set(p[2],h,p[2])); im.setMatrixAt(q,mm); cc.setHSL(0.24+rng(q)*0.06,0.45,0.13+rng(q+1)*0.06).convertSRGBToLinear(); im.setColorAt(q,cc); }); instCull(im); S3.add(im); })();
  /* the crowd on the right bank and in the bleachers; thinner on Lite */
  (function(){ var ppl=[], occ=lite?0.3:0.6;
    for(var r=0;r<6;r++){ var rz=62+r*1.1, ry=0.6+Math.min(0.3,r*0.06); for(var xx=-30; xx<360; xx+=0.65){ if(xx>214&&xx<300) continue; if(rng(xx*3.1+r*17.7)>occ*(xx>180?1:0.55)*(1-r*0.08)) continue; ppl.push([xx+(rng(xx+r)-0.5)*0.3, ry, rz+(rng(xx*1.7+r)-0.5)*0.4]); } }
    for(r=0;r<3;r++) for(xx=214; xx<298; xx+=0.62){ if(rng(xx*5.3+r)>(lite?0.45:0.8)) continue; ppl.push([xx, 1.55+r*0.6, 66+r*1.3]); }
    var n=ppl.length, bodyM=new THREE.InstancedMesh(new THREE.BoxGeometry(0.46,0.8,0.32), new THREE.MeshStandardMaterial({roughness:0.95}), n), headM=new THREE.InstancedMesh(new THREE.BoxGeometry(0.22,0.25,0.22), new THREE.MeshStandardMaterial({roughness:0.9}), n);
    var shirts=[0x9c3a30,0x34598f,0xcfccc4,0x1f2023,0xff7a1a,0x44684a,0xc8a640,0x5d5f66,0x8f4a5e,0x2c6b3a], skin=[0xe0b494,0xc68a64,0x8d5a3b,0xf0c9a8,0x5a3a26], hats=[0x1d4787,0xff7a1a,0x222222,0xe9e6dc,0x9e2a22];
    var mm=new THREE.Matrix4(), cc=new THREE.Color(), base=[];
    for(var s=0;s<n;s++){ var p=ppl[s]; mm.makeTranslation(p[0],p[1]+0.4,p[2]); bodyM.setMatrixAt(s,mm); mm.makeTranslation(p[0],p[1]+0.93,p[2]); headM.setMatrixAt(s,mm);
      cc.set(shirts[Math.floor(rng(s*1.3)*shirts.length)]).convertSRGBToLinear(); bodyM.setColorAt(s,cc); cc.set(rng(s*2.9)<0.45?hats[Math.floor(rng(s*4.1)*hats.length)]:skin[Math.floor(rng(s*3.7)*skin.length)]).convertSRGBToLinear(); headM.setColorAt(s,cc); base.push(p); }
    instCull(bodyM, 1.5); instCull(headM, 1.5); S3.add(bodyM); S3.add(headM); BOAT.crowd={body:bodyM, head:headM, base:base, n:n, phase:base.map(function(p,q){ return rng(q*9.1)*TAU; }), excite:base.map(function(p,q){ return rng(q*5.3); }), live:false}; })();
  /* spray: droplets (unlit, sharp) on every tier, a soft lit mist on Full/Ultra; wakes for both lanes */
  BOAT.fx=new StripFx(lite?220:900, "fire", stripPuffTex()); BOAT.fx.mat.blending=THREE.NormalBlending; S3.add(BOAT.fx.mesh);
  BOAT.fxMist=lite?null:new StripFx(GFX==="ultra"?500:300, "smoke", stripPuffTex()); if(BOAT.fxMist) S3.add(BOAT.fxMist.mesh);
  BOAT.wakeMe=boatWakeMesh(); BOAT.wakeOpp=boatWakeMesh(); S3.add(BOAT.wakeMe); S3.add(BOAT.wakeOpp);
  BOAT.cam=new THREE.PerspectiveCamera(45, 1, 0.3, 3600); BOAT.built=true;
  BOAT.night=null; boatSetLight(false);
}
function boatBuoys(t){ var B=BOAT.buoys; if(!B) return; for(var q=0;q<B.pts.length;q++){ var p=B.pts[q], s=p[2], bob=Math.sin(t*1.7+q*1.3)*0.06*s; _btM.compose(_sbP.set(p[0], s*0.25+bob, p[1]), _btQ.setFromEuler(_btE.set(Math.sin(t*1.1+q)*0.08,0,Math.cos(t*1.3+q)*0.08)), _sbS.set(s,s,s)); B.mesh.setMatrixAt(q,_btM); } B.mesh.instanceMatrix.needsUpdate=true; }
function boatSetLight(night){
  /* a night meet: a dark sky, the bank lights flood the course (the sun light stands in for them: no extra lights, cheap on Lite),
     the water goes black and mirrors the poles (boatWaterMat), the spray and the wakes dim */
  night=!!night; var tc=BOAT.tier!==GFX; if(BOAT.night===night && !tc) return; BOAT.night=night; BOAT.tier=GFX; var lite=GFX==="lite";
  BOAT.sky.material.uniforms.uNight.value=night?1:0; if(BOAT.sky.material.uniforms.uDusk) BOAT.sky.material.uniforms.uDusk.value=0;
  var h=night?STRIP_HOR_N:STRIP_HOR; BOAT.horLin=new THREE.Color(h[0],h[1],h[2]);
  BOAT.sunDir=night?BOAT_FLOOD:STRIP_SUN_DAY; BOAT.sun.color.set(night?0xfff0dc:0xffe2bc); BOAT.sun.intensity=night?(lite?0.8:0.62):1.5; BOAT.sun.castShadow=!lite;
  BOAT.hemi.intensity=night?0.16:0.3; BOAT.hemi.color.set(night?0x3a4764:0xcfdcf0); BOAT.hemi.groundColor.set(night?0x16130e:0x5a6a44);
  BOAT.scene.environment=stripEnv(night); BOAT.exposure=night?1.0:0.9;
  var U=BOAT.wMat.uniforms; U.uSun.value.copy(night?STRIP_MOON:STRIP_SUN_DAY); U.uHor.value.copy(BOAT.horLin); U.uZen.value.set(night?0.006:0.075, night?0.009:0.19, night?0.022:0.48);
  U.uDeep.value.setRGB(night?0.004:0.02, night?0.01:0.075, night?0.014:0.085); U.uNight.value=night?1:0;
  [BOAT.fx, BOAT.fxMist].forEach(function(F){ if(F){ F.mat.uniforms.uAmb.value=night?0.5:1; F.mat.uniforms.uFogN.value=BOAT.fog.near; F.mat.uniforms.uFogF.value=BOAT.fog.far; } });
  [BOAT.wakeMe, BOAT.wakeOpp].forEach(function(w){ if(w) w.material.uniforms.uAmb.value=night?0.45:1; });
  if(tc && BOAT.sun.shadow.map){ BOAT.sun.shadow.map.dispose(); BOAT.sun.shadow.map=null; }
  boatNightKit(night, tc);
}
/* the bank light poles and the towers' lamps: built the first night (a day meet never pays for them); beams on Full/Ultra */
function boatNightKit(on, rebuild){
  var K=BOAT.nightKit, S3=BOAT.scene;
  if(K && rebuild){ K.forEach(function(m){ S3.remove(m); m.geometry.dispose(); }); K=BOAT.nightKit=null; }
  if(on && !K){ var B=new StripBatch(), M=BOAT.mats, lite=GFX==="lite", H=BOAT_POLE_H, G=0.9;
    M.lamp=M.lamp||new THREE.MeshBasicMaterial({vertexColors:true, toneMapped:false});
    M.beam=M.beam||new THREE.MeshBasicMaterial({vertexColors:true, transparent:true, opacity:0.016, depthWrite:false, blending:THREE.AdditiveBlending, fog:true, side:THREE.DoubleSide});
    BOAT_POLES.forEach(function(q){ var px=q[0], pz=q[1], s=pz>0?-1:1;   /* s: toward the river */
      B.add("metal","cyl",[px, G+H/2, pz],[0.32,H,0.32],0x9aa0a6); B.box("metal", px, G+H+0.2, pz, 3.0, 0.22, 0.28, 0x80868c);
      for(var k=0;k<3;k++){ var lx=px-1.0+k; B.box("metal", lx, G+H+0.6, pz+s*0.1, 0.7, 0.6, 0.34, 0x5a5f65); B.box("lamp", lx, G+H+0.6, pz+s*0.29, 0.58, 0.48, 0.02, 0xfff0d0); }
      if(!lite) B.add("beam","beam",[px, G+H/2, pz+s*H*0.18],[6,H,6],0xffe8c0,[-s*0.36,0,0]); });
    [1,-1].forEach(function(sd){ for(var k=0;k<2;k++) B.box("lamp", BOAT_FIN-0.8+k*1.6, 11.7, sd*70-sd*1.62, 1.1, 0.4, 0.02, 0xfff0d0); });   /* lamps under the finish towers' decks */
    B.box("lamp", -12, 7.6, 69.95, 3.0, 0.35, 0.02, 0xfff0d0);   /* the start tower */
    K=[boatBuild(B,"metal",M.metal,false), boatBuild(B,"lamp",M.lamp,false)];
    var bm=boatBuild(B,"beam",M.beam,false); if(bm){ bm.receiveShadow=false; bm.renderOrder=4; K.push(bm); }
    K=BOAT.nightKit=K.filter(function(m){ return !!m; }); }
  if(K) K.forEach(function(m){ m.visible=!!on; });
}
/* one boat's attitude for this frame: sitting in the water, the bow up over the hump, the running angle, porpoising, chine walk, a hop off the chop, a blowover */
function boatPose(V, s, z, dt, live){
  var U=V.userData, L=U.L, v=Math.max(0,+s.v||0), pl=clamp(+s.pl||0,0,1), hydro=U.cls==="tfh";
  var tgt=(+s.bow||0)*PI/180+(s.porp?Math.sin(BOAT.t*8)*0.035*s.porp:0)+(s.hop||0)*0.06;
  var n=Math.min(8,Math.ceil(dt/0.01)), h=n?dt/n:0; for(var i=0;i<n;i++){ U.bv+=(60*(tgt-U.bow)-11*U.bv)*h; U.bow+=U.bv*h; }
  var sink=-0.42*(1-pl)+(hydro?0.12*clamp((v-35)/20,0,1):0.04*pl), skip=hydro&&v>30?Math.abs(Math.sin(BOAT.t*(5+v*0.06)))*0.05*clamp((v-30)/30,0,1):0;
  U.y+=(sink+skip+(s.hop||0)*0.35-U.y)*Math.min(1,dt*(skip?14:5));
  if(s.flip){ U.flip=Math.min(PI*0.95,U.flip+dt*(1.2+U.flip*1.8)); } else U.flip=Math.max(0,U.flip-dt*2);
  if(s.hook){ U.yaw+=dt*(3-U.yaw)*1.5; } else U.yaw*=Math.exp(-dt*3);
  U.roll=(s.walk?Math.sin(BOAT.t*5.5)*0.08*s.walk:0)+(live?Math.sin(BOAT.t*1.3+z)*0.008*(1-pl):0);
  V.position.set((+s.x||0)-L.len, U.y+(U.flip>0?Math.sin(U.flip)*2.5:0), z); V.rotation.set(U.roll, U.yaw, 0);
  U.pivot.rotation.z=U.bow+U.flip; U.pivot.position.y=0;
  U.prop.rotation.x=(U.prop.rotation.x+(+s.rpm||0)/60*TAU*dt*0.25)%TAU;
  V.updateMatrixWorld(true);
}
/* rooster tail off the prop (a hydro's is a wall), spray off the chines, a bow wave climbing the hump, the engine's exhaust */
function boatSpray(V, s, dt){
  var U=V.userData, L=U.L, FX=BOAT.fx, FM=BOAT.fxMist, lite=GFX==="lite", rate=lite?0.35:1, R=Math.random, i, v=Math.max(0,+s.v||0), pl=clamp(+s.pl||0,0,1), thr=+s.thr||0;
  if(U.flip>0.3||s.failed&&v<2) { if(U.flip>0.3&&U.flip<2.5){ var nf=Math.floor(rate*40*dt*6); for(i=0;i<nf;i++) FX.emit(V.position.x+R()*L.len, 0.3, V.position.z+(R()-0.5)*L.beam, (R()-0.5)*6+v*0.4, 3+R()*6, (R()-0.5)*6, 1.2+R(), 0.3, 1.2, 0.85,0.9,0.92, 0.8, {drag:0.2,grav:9.8,fin:0.02,spin:2}); } return; }
  U.prop.localToWorld(_btA.set(0,0,0)); var px=_btA.x, py=Math.max(0.05,_btA.y), pz=_btA.z;
  if(v>3){ var k=U.cls==="tfh"?1.5:U.cls==="pro"?1.2:U.cls==="jet"?0.9:0.7, amt=clamp(v/40,0,1.6)*(0.35+0.65*thr)*(s.air?0.3:1);
    var nc=amt*k*rate*(lite?90:260)*dt, nn=Math.floor(nc)+(R()<nc%1?1:0), up=Math.min(26, 3+v*0.2)*k;
    for(i=0;i<nn;i++){ var sp=0.6+R()*0.7; FX.emit(px-R()*0.4, py+0.1, pz+(R()-0.5)*0.4, v*(U.cls==="jet"?0.15:0.42)-1-R()*3, up*sp*(U.cls==="jet"?0.55:1), (R()-0.5)*(1.5+v*0.03), 1.2+R()*1.2, 0.18+R()*0.12, 0.8+R()*0.8*k, 0.9,0.94,0.96, 0.85, {drag:0.12, grav:9.8, fin:0.02, spin:3}); }
    if(FM){ var nm=amt*k*rate*26*dt, mm2=Math.floor(nm)+(R()<nm%1?1:0); for(i=0;i<mm2;i++) FM.emit(px-1-R()*2, py+1+R()*up*0.3, pz+(R()-0.5)*2, v*0.3-2, up*0.25*R(), (R()-0.5)*2, 2+R()*1.5, 1.2, 4+R()*3*k, 0.9,0.93,0.95, 0.35, {drag:0.5, grav:1.0, fin:0.06, spin:0.4}); } }
  /* chine spray: sideways sheets once it's moving, the bow wave at the hump */
  var hump=clamp(1-Math.abs(v-9)/7,0,1)*(1-pl*0.6), sheet=clamp(v/25,0,1)*(U.cls==="tfh"?0.5:1), nsh=(sheet+hump*1.5)*rate*(lite?40:120)*dt, ns=Math.floor(nsh)+(R()<nsh%1?1:0);
  for(i=0;i<ns;i++){ var sd=R()<0.5?-1:1; V.localToWorld(_btA.set(L.len*(0.45+0.35*hump+R()*0.15), 0.1, sd*L.beam*0.5)); FX.emit(_btA.x, Math.max(0.1,_btA.y), _btA.z, v*0.55, 1+R()*2.5+hump*2, sd*(1.5+v*0.06+R()*2), 0.5+R()*0.5, 0.12, 0.4+hump*0.4, 0.9,0.94,0.96, 0.7, {drag:0.3, grav:9.8, fin:0.02, spin:3}); }
  /* hydro sponsons skipping: a puff each touch */
  if(U.cls==="tfh"&&v>30&&R()<dt*8*rate) for(var sd2=-1; sd2<=1; sd2+=2){ V.localToWorld(_btA.set(L.len*0.82, 0.05, sd2*1.45)); for(i=0;i<(lite?2:6);i++) FX.emit(_btA.x, 0.1, _btA.z, v*0.6, 1+R()*2, sd2*(1+R()*2), 0.4, 0.15, 0.6, 0.9,0.94,0.96, 0.7, {drag:0.4, grav:9.8, fin:0.02, spin:3}); }
  /* exhaust: a whisp, black for a diesel */
  var smk=clamp(+s.smoke||0,0,1), ne=(lite?3:8)*(0.15+smk)*thr*dt; if(R()<ne){ V.localToWorld(_btA.set(L.len*0.3, 1.6, 0)); var c=lerp(0.42,0.05,smk); (FM||FX).emit(_btA.x, _btA.y, _btA.z, v-0.6, 2, 0, 1.5, 0.3, 1.5+smk*2, c,c,c, 0.25+0.4*smk, {drag:0.7, buoy:0.15, fin:0.03, spin:0.5}); }
}
function boatCrowd(dt){ var C=BOAT.crowd; if(!C) return; BOAT.cheer=Math.max(0,BOAT.cheer-dt*0.3); if(BOAT.cheer<0.02&&!C.live) return;
  var t=BOAT.t, amp=BOAT.cheer, m=_btM; for(var i=0;i<C.n;i++){ var p=C.base[i], e=C.excite[i], y=amp>0.02&&e>0.35?Math.abs(Math.sin(t*8+C.phase[i]))*0.18*Math.min(amp,2)*e:0;
    m.makeTranslation(p[0],p[1]+0.4+y,p[2]); C.body.setMatrixAt(i,m); m.makeTranslation(p[0],p[1]+0.93+y*1.15,p[2]); C.head.setMatrixAt(i,m); }
  C.body.instanceMatrix.needsUpdate=true; C.head.instanceMatrix.needsUpdate=true; C.live=BOAT.cheer>=0.02; }
function boatCut(n){ if(BOAT.shot!==n){ BOAT.shot=n; BOAT.shotT=0; BOAT.snap=true; } }
/* the camera: behind the boats at the tree, low beside them off the line, a chase, the helicopter and the bank, the finish tower, a slow look after */
function boatDirect(o, dt){
  var ph=o.phase||"tree", me=o.me||{}, mx=+me.x||0, ox=(o.opp&&+o.opp.x)||0, v=+me.v||0, lead=Math.abs(ox-mx)<40?(mx+ox)/2:mx, s=BOAT.shot, L=(BOAT.me&&BOAT.me.userData.L)||BOAT_LOOK.outboard;
  if(o.shot) s=o.shot;
  else if(BOAT.skip||ph==="done") s=lead>BOAT_FIN-20&&(s==="finish"||s==="tower")&&BOAT.doneT<2.5?s:"stop";
  else if(ph==="tree") s="tree";
  else if((BOAT_FIN-lead)/Math.max(v,8)<1.8 && lead<BOAT_FIN+40) s=GFX==="lite"?"finish":(s==="finish"||s==="tower"?s:(BOAT.flipK=(BOAT.flipK||0)+1)%2?"tower":"finish");
  else if(s==="tree"||!s) s="launch";
  else if(s==="launch"&&(BOAT.shotT>1.6||mx>30)) s="chase";
  else if(s==="chase"&&BOAT.shotT>2.4) s=GFX==="lite"?"bank":"heli";
  else if(s==="heli"&&BOAT.shotT>2.6) s="bank";
  else if(s==="bank"&&BOAT.shotT>2.6) s="chase";
  if(s!==BOAT.shot&&s==="bank") BOAT.fixX=Math.min(BOAT_FIN-20, mx+20+v*1.4);
  boatCut(s); BOAT.shotT+=dt; var T=BOAT.shotT, fov=45, rel=false, ax=0, sm=0, zz=BOAT_LZ;
  switch(s){
    case "tree": { var push=Math.min(2,T*0.4); _btw.set(-L.len-11+push, 3.0, 1.5); _btt.set(22, 1.2, 0); fov=46; break; }
    case "launch": _btw.set(10, 1.2, zz+14); _btt.set(mx-L.len*0.5, 0.8, zz*0.3); fov=44; break;
    case "chase": rel=true; ax=mx; _btw.set(-14-v*0.04, 3.4+v*0.02, zz+3.5); _btt.set(18, 1.2, -1); fov=48; sm=4; break;
    case "heli": rel=true; ax=mx; _btw.set(-6, 22, zz+40); _btt.set(14, 0, -2); fov=40; sm=2.5; break;
    case "bank": _btw.set(BOAT.fixX, 2.2, 52); _btt.set(mx-L.len*0.5, 1.0, 0); fov=34; break;
    case "finish": _btw.set(BOAT_FIN+28, 2.4, zz+20); _btt.set(lead-6, 1.2, 0); fov=36; break;
    case "tower": _btw.set(BOAT_FIN+4, 16.5, 64); _btt.set(lead-4, 0, 0); fov=34; break;
    case "stop": { var dr=Math.min(4,T*0.35); _btw.set(mx-18+dr, 5-dr*0.3, zz+16); _btt.set(mx+4, 1, 0); fov=38; break; }
  }
  if(rel){ if(BOAT.snap||!BOAT.relOn){ _btr.copy(_btw); _btrt.copy(_btt); } else { var kk=1-Math.exp(-sm*dt); _btr.lerp(_btw,kk); _btrt.lerp(_btt,kk); }
    _btw.copy(_btr); _btt.copy(_btrt); _btw.x+=ax; _btt.x+=ax; BOAT.relOn=true; } else BOAT.relOn=false;
  if(BOAT.snap){ BOAT.fov=fov; BOAT.snap=false; BOAT.camTgt.copy(_btt); } else BOAT.fov+=(fov-BOAT.fov)*(1-Math.exp(-6*dt));
  BOAT.camPos.copy(_btw); if(rel) BOAT.camTgt.copy(_btt); else BOAT.camTgt.lerp(_btt, 1-Math.exp(-7*dt));
  BOAT.shake*=Math.exp(-dt*3.5); var sh=BOAT.shake; if(sh>0.002){ BOAT.camPos.x+=(Math.random()-0.5)*sh*0.3; BOAT.camPos.y+=(Math.random()-0.5)*sh*0.3; }
  BOAT.camPos.y=Math.max(0.6,BOAT.camPos.y);
  var cam=BOAT.cam; cam.position.copy(BOAT.camPos); cam.lookAt(BOAT.camTgt); cam.fov=BOAT.fov; cam.updateProjectionMatrix(); bandLens(cam);
}
function boatComposer(){
  if(BOAT.composer===false) return null; var sz=renderer.getSize(new THREE.Vector2()), pr=renderer.getPixelRatio(), C=ultraComposerKeep(BOAT.composer);
  if(!C){ try{ C=ultraComposerMark(new THREE.EffectComposer(renderer, ultraRT())); C.addPass(ultraRenderPass(BOAT.scene, BOAT.cam, "boat")); var bp=new THREE.UnrealBloomPass(new THREE.Vector2(Math.max(1,sz.x*pr/2), Math.max(1,sz.y*pr/2)), 0.25, 0.4, 0.92); C.addPass(bp); BOAT.bloom=bp;
      if(THREE.GammaCorrectionShader) C.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader)); BOAT.composer=C; BOAT.cSize=""; }catch(e){ BOAT.composer=false; return null; } }
  var key=sz.x+"x"+sz.y+"@"+pr; if(BOAT.cSize!==key){ if(C.setPixelRatio) C.setPixelRatio(pr); C.setSize(sz.x, sz.y); BOAT.cSize=key; } return C;
}
function boatRender(){
  var S3=BOAT.scene, cam=BOAT.cam; if(!S3||!cam) return;
  var C=(GFX!=="lite" && THREE.EffectComposer && THREE.UnrealBloomPass && THREE.RenderPass && THREE.ShaderPass) ? boatComposer() : null;
  var fogC=C?BOAT.horLin:BOAT.horLin.clone().convertLinearToSRGB(); S3.fog.color.copy(fogC); BOAT.sky.position.copy(cam.position);
  BOAT.wMat.uniforms.uFog.value.copy(BOAT.horLin); [BOAT.fx, BOAT.fxMist].forEach(function(F){ if(F) F.mat.uniforms.uFog.value.copy(BOAT.horLin); });
  [BOAT.wakeMe, BOAT.wakeOpp].forEach(function(w){ w.material.uniforms.uFog.value.copy(BOAT.horLin); });
  var ex=renderer.toneMappingExposure; renderer.toneMappingExposure=BOAT.exposure; var inf=renderer.info, ar=inf.autoReset; inf.autoReset=false; inf.reset();
  if(ULT()) ultraBoatReflect(S3, cam, BOAT.water, [BOAT.wakeMe, BOAT.wakeOpp]);
  if(C) C.render(); else renderer.render(S3, cam);
  BOAT.stats={calls:inf.render.calls, tris:inf.render.triangles, tier:GFX, shot:BOAT.shot, parts:BOAT.fx.P.length+(BOAT.fxMist?BOAT.fxMist.P.length:0)}; inf.autoReset=ar; renderer.toneMappingExposure=ex;
}
function boatReset(){
  [BOAT.fx, BOAT.fxMist].forEach(function(F){ if(F) F.clear(); });
  BOAT.shot=null; BOAT.prev={}; BOAT.shake=0; BOAT.cheer=0; BOAT.skip=false; BOAT.doneT=0; BOAT.boardSet={};
  for(var k in BOAT.boats){ var U=BOAT.boats[k].userData; U.wake.length=0; U.wakeX=-1e9; U.flip=0; U.yaw=0; U.bow=0; U.bv=0; U.y=0; }
  if(BOAT.wakeMe){ BOAT.wakeMe.geometry.setDrawRange(0,0); BOAT.wakeOpp.geometry.setDrawRange(0,0); }
  if(BOAT.boards) BOAT.boards.forEach(function(b){ boatBoardDraw(b.tex,null,null); });
  if(BOAT.crowd&&BOAT.crowd.live){ BOAT.cheer=0; boatCrowd(0); }
}
function boatGet(cls, color, lane){ var key=cls+":"+color+":"+lane; if(!BOAT.boats[key]){ BOAT.boats[key]=boatModel(cls, color); BOAT.scene.add(BOAT.boats[key]); } return BOAT.boats[key]; }
function boatUpdate(o, dt){
  if(!BOAT.built) buildBoatScene();
  BOAT.t+=dt; if(BOAT.tier!==GFX){ var lite=GFX==="lite"; if(!lite&&!BOAT.fxMist){ BOAT.fxMist=new StripFx(GFX==="ultra"?500:300,"smoke",stripPuffTex()); BOAT.scene.add(BOAT.fxMist.mesh); } BOAT.wMat=null; }
  if(!BOAT.wMat){ BOAT.wMat=boatWaterMat(GFX==="lite"); BOAT.water.material=BOAT.wMat; BOAT.night=null; }
  boatSetLight(!!o.night);
  var ph=o.phase||"tree", cls=BOAT_LOOK[o.cls]?o.cls:"outboard", me=o.me||{}, op=o.opp||{};
  if(ph==="tree" && BOAT.prev.phase && BOAT.prev.phase!=="tree") boatReset();
  var Vm=boatGet(cls, me.color!=null?me.color:0xff7a1a, "me"), Vo=boatGet(cls, op.color!=null?op.color:0x1d4787, "opp");
  for(var k in BOAT.boats) BOAT.boats[k].visible=(BOAT.boats[k]===Vm||BOAT.boats[k]===Vo); BOAT.me=Vm; BOAT.opp=Vo;
  if(ph==="done") BOAT.doneT+=dt;
  var W=o.water||{}; BOAT.wMat.uniforms.uT.value=BOAT.t; BOAT.wMat.uniforms.uChop.value=clamp(+W.chop||0,0,1); BOAT_WIND.set(-1.5-(+W.wind||0)*0.6, 0, 0.5);
  boatPose(Vm, me, BOAT_LZ, dt, ph!=="tree"); boatPose(Vo, op, -BOAT_LZ, dt, ph!=="tree");
  if(ph!=="tree"){ boatSpray(Vm, me, dt); boatSpray(Vo, op, dt); }
  BOAT.fx.step(dt, BOAT_WIND); if(BOAT.fxMist) BOAT.fxMist.step(dt, BOAT_WIND);
  boatWakeStep(Vm, BOAT.wakeMe, (+me.x||0)-Vm.userData.L.len, BOAT_LZ, +me.v||0, Vm.userData.L.beam, ph!=="tree"); boatWakeStep(Vo, BOAT.wakeOpp, (+op.x||0)-Vo.userData.L.len, -BOAT_LZ, +op.v||0, Vo.userData.L.beam, ph!=="tree");
  /* the tree */
  var tr=o.tree||{}, set=function(arr, on){ arr.forEach(function(b,j){ b.material.color.copy(on[j]?b.userData.on:b.userData.off); }); };
  if(BOAT.lamps){ var lm=function(red){ return [tr.pre,tr.stage,tr.amb>=1&&!tr.green,tr.amb>=2&&!tr.green,tr.amb>=3&&!tr.green,tr.green&&!red,red]; }; set(BOAT.lamps.me, lm(tr.redMe)); set(BOAT.lamps.opp, lm(tr.redOpp)); }
  /* the boards at the finish */
  BOAT.boardSet=BOAT.boardSet||{}; if(o.meEt!=null&&!BOAT.boardSet.me){ BOAT.boardSet.me=1; boatBoardDraw(BOAT.boards[0].tex, o.meEt, o.meMph); BOAT.cheer=Math.max(BOAT.cheer,1.6); BOAT.shake=Math.max(BOAT.shake,0.1); }
  if(o.oppEt!=null&&!BOAT.boardSet.opp){ BOAT.boardSet.opp=1; boatBoardDraw(BOAT.boards[1].tex, o.oppEt, o.oppMph); }
  if(o.won===true&&!BOAT.prev.won) BOAT.cheer=2.4;
  if(ph==="run"&&BOAT.prev.phase==="tree"){ BOAT.shake=0.15; BOAT.cheer=Math.max(BOAT.cheer,0.8); }
  boatBuoys(BOAT.t); boatCrowd(dt); boatDirect(o, dt);
  var c=_btA.copy(BOAT.camPos).lerp(BOAT.camTgt,0.6); c.y=0; BOAT.sun.position.copy(c).addScaledVector(BOAT.sunDir,150); BOAT.sun.target.position.copy(c); BOAT.sun.target.updateMatrixWorld();
  BOAT.prev={phase:ph, won:o.won===true};
}
