/*pew-scenes 1.76.114.0*/
/* ===========================================================================
   DRAG STRIP SCENE — a second world the view cuts to during a pass.
   Units are metres. x = distance down the track (start line 0, 1/4 mile 402.336),
   player in the near/right lane (z +2.5), rival in the far/left lane (z −2.5).
   Static scenery is merged into a handful of vertex-coloured meshes; the track
   and the prairie are procedural shaders (crisp at any distance, 1 draw each);
   smoke/flames are two instanced billboard systems (1 draw each).
   ==========================================================================*/
var STRIP_TRACK_END=780, STRIP_Q=402.336, STRIP_LANE=2.5;
/* v2 world: uniforms shared by the track and crowd shaders (time, midday mirage, fresh burnout shine per lane, water-box ripples, lit stands) */
var STRIP_U={ uTime:{value:0}, uHaze:{value:0}, uShine:{value:new THREE.Vector2()}, uRip:{value:0}, uHorC:{value:new THREE.Color(0.52,0.6,0.7)}, uCrowdLit:{value:0},
  uGlare:{value:0}, uSunW:{value:new THREE.Vector3(0,1,0)}, uGlareC:{value:new THREE.Color(1,0.6,0.35)} };   /* fix pack: dusk glare clamp (stripGlare) */
var STRIP_SUN_DAY=new THREE.Vector3(-0.55,0.36,0.75).normalize(), STRIP_MOON=new THREE.Vector3(0.45,0.42,-0.78).normalize();
var STRIP_HOR=[0.52,0.60,0.70], STRIP_HOR_N=[0.016,0.019,0.03], STRIP_HOR_D=[0.2,0.1,0.1];
var STRIP_SUN_DUSK=new THREE.Vector3(0.86,0.03,-0.5).normalize(), STRIP_DUSK_LIGHT=new THREE.Vector3(0.82,0.2,-0.54).normalize();
function stripLabel(txt, w, h){ var c=document.createElement("canvas"); c.width=256; c.height=96; var x=c.getContext("2d"); x.fillStyle="#f4efe2"; x.fillRect(0,0,256,96); x.fillStyle="#1a1a1a"; x.font="bold 54px 'Barlow Condensed','Arial Narrow',sans-serif"; x.textAlign="center"; x.textBaseline="middle"; x.fillText(txt,128,50);
  var t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; var m=new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshStandardMaterial({map:t, roughness:0.8})); return m; }

/* --- static batch: collect unit primitives with a transform + colour, merge per material key --- */
var SB_GEO=null;
function sbGeo(){
  if(SB_GEO) return SB_GEO;
  SB_GEO={ box:new THREE.BoxGeometry(1,1,1).toNonIndexed(), cyl:new THREE.CylinderGeometry(0.5,0.5,1,10).toNonIndexed(), cyl6:new THREE.CylinderGeometry(0.5,0.5,1,6).toNonIndexed(),
    cone:new THREE.CylinderGeometry(0,0.5,1,4).toNonIndexed(), plane:new THREE.PlaneGeometry(1,1).toNonIndexed(), prism:null, beam:new THREE.CylinderGeometry(0.08,0.5,1,12,1,true).toNonIndexed(), tcone:new THREE.CylinderGeometry(0.11,0.5,1,12).toNonIndexed(), ico:new THREE.IcosahedronGeometry(1,0),
    sph:new THREE.SphereGeometry(0.5,12,8).toNonIndexed(), taper:new THREE.CylinderGeometry(0.4,0.5,1,10).toNonIndexed() };   /* sph, taper: the pits crew (rounded heads, joints, limbs) */
  /* gable roof: triangular prism, 1×1×1, ridge along x */
  var p=new THREE.BufferGeometry(), v=[-.5,0,-.5, .5,0,-.5, .5,.5,0,  -.5,0,-.5, .5,.5,0, -.5,.5,0,   .5,0,.5, -.5,0,.5, -.5,.5,0,  .5,0,.5, -.5,.5,0, .5,.5,0,
    -.5,0,.5, -.5,0,-.5, -.5,.5,0,   .5,0,-.5, .5,0,.5, .5,.5,0];
  p.setAttribute("position", new THREE.Float32BufferAttribute(v,3)); p.setAttribute("uv", new THREE.Float32BufferAttribute(new Array(v.length/3*2).fill(0),2)); p.computeVertexNormals(); SB_GEO.prism=p;
  return SB_GEO;
}
var _sbE=new THREE.Euler(), _sbQ=new THREE.Quaternion(), _sbP=new THREE.Vector3(), _sbS=new THREE.Vector3();
function StripBatch(){ this.b={}; }
/* add(key, geoName, [x,y,z], [sx,sy,sz], color, [rx,ry,rz], uvRect) */
StripBatch.prototype.add=function(key, gname, p, s, col, r, uvr){
  var m=new THREE.Matrix4(); _sbE.set(r?r[0]:0, r?r[1]:0, r?r[2]:0); _sbQ.setFromEuler(_sbE);
  m.compose(_sbP.set(p[0],p[1],p[2]), _sbQ, _sbS.set(s[0],s[1],s[2]));
  (this.b[key]||(this.b[key]=[])).push({g:sbGeo()[gname], m:m, c:col, uv:uvr});
};
StripBatch.prototype.box=function(key, x,y,z, w,h,d, col, ry){ this.add(key,"box",[x,y,z],[w,h,d],col,ry?[0,ry,0]:null); };
StripBatch.prototype.build=function(key, mat, shadow){
  var items=this.b[key]; if(!items||!items.length) return null;
  var n=0,i,j; for(i=0;i<items.length;i++) n+=items[i].g.attributes.position.count;
  var pos=new Float32Array(n*3), nor=new Float32Array(n*3), uv=new Float32Array(n*2), col=new Float32Array(n*3);
  var o=0, nm=new THREE.Matrix3(), v=new THREE.Vector3(), c=new THREE.Color();
  for(i=0;i<items.length;i++){ var it=items[i], P=it.g.attributes.position, N=it.g.attributes.normal, U=it.g.attributes.uv; nm.getNormalMatrix(it.m); c.set(it.c||0xffffff).convertSRGBToLinear();
    for(j=0;j<P.count;j++,o++){ v.fromBufferAttribute(P,j).applyMatrix4(it.m); pos[o*3]=v.x; pos[o*3+1]=v.y; pos[o*3+2]=v.z;
      v.fromBufferAttribute(N,j).applyMatrix3(nm).normalize(); nor[o*3]=v.x; nor[o*3+1]=v.y; nor[o*3+2]=v.z;
      var uu=U?U.getX(j):0, vv=U?U.getY(j):0; if(it.uv){ uu=it.uv[0]+uu*(it.uv[2]-it.uv[0]); vv=it.uv[1]+vv*(it.uv[3]-it.uv[1]); } uv[o*2]=uu; uv[o*2+1]=vv;
      col[o*3]=c.r; col[o*3+1]=c.g; col[o*3+2]=c.b; } }
  var g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.BufferAttribute(pos,3)); g.setAttribute("normal",new THREE.BufferAttribute(nor,3));
  g.setAttribute("uv",new THREE.BufferAttribute(uv,2)); g.setAttribute("color",new THREE.BufferAttribute(col,3)); g.computeBoundingSphere();
  var mesh=new THREE.Mesh(g, mat); mesh.castShadow=!!shadow; mesh.receiveShadow=true; mesh.matrixAutoUpdate=false; STRIP.scene.add(mesh); return mesh;
};

/* --- GLSL shared by the procedural ground / track --- */
var STRIP_GLSL_NOISE=[
  "float sh(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }",
  "float sn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(sh(i),sh(i+vec2(1.0,0.0)),f.x), mix(sh(i+vec2(0.0,1.0)),sh(i+vec2(1.0,1.0)),f.x), f.y); }",
  "float sfbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*sn(p); p=p*2.03+vec2(17.1,9.3); a*=0.5; } return s; }"].join("\n");
/* painted markings: a mask sampled from the decal atlas in a rotated rect (c centre, fw travel direction = top of the letters, hs half across/along, cell uv rect) */
var STRIP_GLSL_DECAL=["uniform sampler2D uDecal;",
  "float dcl(vec2 p, vec2 c, vec2 fw, vec2 hs, vec4 cell){ vec2 d=p-c, rt=vec2(-fw.y,fw.x); vec2 q=vec2(dot(d,rt),dot(d,fw))/(2.0*hs)+0.5;",
  "  float ins=step(0.0,q.x)*step(q.x,1.0)*step(0.0,q.y)*step(q.y,1.0); return ins*texture2D(uDecal,cell.xy+clamp(q,0.0,1.0)*cell.zw).r; }"].join("\n");
var STRIP_GLSL_TRACK=[
  "uniform float uTime; uniform float uHaze; uniform vec2 uShine; uniform float uRip; uniform vec3 uHorC; uniform float uGlare; uniform vec3 uSunW; uniform vec3 uGlareC;", STRIP_GLSL_DECAL,
  "float gWet=0.0, gMir=0.0, gRefl=0.0, gGlare=0.0; vec2 gRip=vec2(0.0);",
  "vec3 stripSurf(vec3 w, out float rough){",
  "  float x=w.x, z=w.z, az=abs(z); float d=length(w-cameraPosition);",
  "  float fine=1.0-smoothstep(20.0,80.0,d), mid=1.0-smoothstep(60.0,260.0,d);",
  "  float n1=sn(w.xz*vec2(0.21,0.7)), n2=sn(w.xz*2.7), n3=sn(w.xz*13.0);",
  "  float conc=smoothstep(-17.0,-16.0,x)*(1.0-smoothstep(99.93,100.07,x));",
  "  vec3 asph=vec3(0.062,0.063,0.067)*(0.78+0.38*n1)+(n3-0.5)*0.035*fine;",
  "  vec3 cr=vec3(0.19,0.187,0.178)*(0.86+0.2*n1+(n2-0.5)*0.12*fine);",
  "  float jx=abs(fract(x/4.57+0.5)-0.5)*4.57, jz=abs(fract((z+7.5)/3.75+0.5)-0.5)*3.75;",
  "  cr*=1.0-0.4*max(1.0-smoothstep(0.012,0.04,jx),1.0-smoothstep(0.012,0.04,jz))*(1.0-smoothstep(12.0,55.0,d));",
  "#if STRIP_TIER<1",
  "  asph*=bkAsph(w.xz,0.8); cr*=bkConc(w.xz,0.9);",
  "#endif",
  "  vec3 c=mix(asph,cr,conc); rough=mix(0.9,0.8,conc);",
  /* Full/Ultra: aggregate grain + tar snakes + repair patches on the asphalt, slab-by-slab tone and grooved joints on the concrete, a tar-sealed ragged seam
     where the two meet with a patched strip behind it */
  "#if STRIP_TIER>=1",
  "  float aH; vec3 am=sfAsphFx(w.xz,fine,aH); float slab=sh(vec2(floor(x/4.57),floor((z+7.5)/3.75))), jm=max(1.0-smoothstep(0.012,0.04,jx),1.0-smoothstep(0.012,0.04,jz))*(1.0-smoothstep(12.0,70.0,d));",
  "  vec3 cm=vec3(1.0+0.1*(slab-0.5)+0.04*(sn(w.xz*47.0)-0.5)*aaf(0.021))*(1.0-0.3*sfBlot(w.xz*vec2(0.6,2.0),0.5,0.6,0.85,4.0));",
  "  cm*=bkConc(w.xz,0.9); gBn=mix(gBn,gBk,conc); c*=mix(am,cm,conc); gH=mix(aH,0.0026*sn(w.xz*61.0)*aaf(0.0165)-0.008*jm,conc); gHK=0.6;",
  "  float sx=x-100.0+(sn(vec2(z*2.3,5.0))-0.5)*0.07, seam=1.0-smoothstep(0.012,0.032,abs(sx)), rp=step(0.03,sx)*(1.0-smoothstep(1.1,1.3,sx))*(1.0-conc);",
  "  c*=1.0-0.5*seam-0.16*rp; gH-=0.009*seam; gH*=1.0-0.6*rp;",
  "#endif",
  "  c*=1.0-0.7*(1.0-smoothstep(0.025,0.07,abs(x-100.0)))-0.12*(1.0-smoothstep(0.07,0.5,abs(x-100.0)))*step(100.0,x);",
  "  float lc=z>0.0?2.5:-2.5; float dz=abs(z-lc);",
  "  float tyre=exp(-pow((dz-0.82)/0.30,2.0)), broad=exp(-pow(dz/1.45,2.0));",
  "  float fx=smoothstep(-4.8,-3.6,x);",
  "  float launch=fx*(0.9*exp(-max(x,0.0)/80.0)+0.38*exp(-max(x,0.0)/520.0))*(1.0-smoothstep(640.0,700.0,x));",
  "  float streak=0.7+0.3*sn(vec2(x*0.5,dz*20.0))*mid+0.15*(1.0-mid);",
  "  float rub=clamp(tyre*launch*1.35*streak+broad*launch*0.55,0.0,0.95);",
  "  float bo=smoothstep(-5.6,-4.8,x)*(1.0-smoothstep(-0.4,0.6,x))*tyre*(0.55+0.45*sn(vec2(x*2.5,dz*28.0)));",
  "  rub=max(rub,bo*0.97);",
  /* Full/Ultra: rubber fills the grain, flung marbles pile along the lane's outer edge, the hit leaves tread-patterned burnout */
  "#if STRIP_TIER>=1",
  "  float mb=fx*launch*smoothstep(1.2,1.7,dz)*(1.0-smoothstep(3.4,4.2,dz))*smoothstep(0.7,0.92,sn(w.xz*vec2(23.0,29.0)))*aaf(0.04);",
  "  float trd=smoothstep(0.35,0.7,sin(dz*22.0+sin(x*1.9)*2.2+x*3.5)*0.5+0.5)*bo;",
  "  rub=min(rub*(1.0-0.22*trd),0.97); gH*=1.0-0.75*rub; gH-=0.0022*trd; gH+=0.004*mb; rub=max(rub,mb*0.3);",
  "#endif",
  "  c=mix(c,vec3(0.018,0.018,0.02),rub); rough=mix(rough,0.55,rub);",
  "  float prep=fx*exp(-pow((dz-0.82)/0.42,2.0))*(0.5+0.5*exp(-max(x,0.0)/260.0))*(1.0-smoothstep(560.0,700.0,x))*(0.85+0.15*n2);",
  "  c=mix(c,vec3(0.021,0.02,0.021),prep*0.55); rough=mix(rough,0.4,prep*0.7); gRefl=prep*0.12;",
  "  float vht=fx*(1.0-smoothstep(45.0,140.0,x))*clamp(0.6*broad+0.5*tyre,0.0,1.0)*(0.8+0.2*n1);",
  "  c=mix(c,vec3(0.026,0.021,0.016),vht*0.4); rough=mix(rough,0.24,vht*0.9);",
  "  float shn=(z>0.0?uShine.x:uShine.y)*smoothstep(-6.4,-5.4,x)*(1.0-smoothstep(0.5,7.0,x))*tyre*(0.55+0.45*sn(vec2(x*1.1,dz*36.0)));",
  "  c=mix(c,vec3(0.01,0.01,0.011),shn*0.7); rough=mix(rough,0.1,shn);",
  "  float wb=smoothstep(-15.2,-14.6,x)*(1.0-smoothstep(-5.6,-5.0,x))*(1.0-smoothstep(1.75,2.05,dz));",
  "  float wtr=smoothstep(-5.8,-5.0,x)*(1.0-smoothstep(-4.5,1.5,x))*tyre;",
  "  float wet=max(wb*(0.8+0.2*n2),wtr*0.85);",
  "  c*=1.0-0.7*wet; rough=mix(rough,0.16,wet);",
  "  float pool=wb*smoothstep(0.47,0.57,sn(w.xz*vec2(0.8,1.5)+3.0)+0.18*n2);",
  "  c*=1.0-0.45*pool; rough=mix(rough,0.07,pool); gWet=max(wet,pool); gRefl=max(gRefl,pool*0.12);",
  "  c*=1.0-0.55*(1.0-smoothstep(0.05,0.26,abs(dz-2.3)))*smoothstep(-15.3,-14.9,x)*(1.0-smoothstep(-5.1,-4.7,x));",
  "  if(gWet>0.0){ vec2 q=w.xz*6.0; float t=uTime; gRip=vec2(sin(q.x+t*3.3+sn(q*0.6)*6.0), sin(q.y*1.3-t*2.6+sn(q*0.45+3.0)*6.0))*(0.03+0.16*uRip)*gWet; }",
  "  if(uHaze>0.0){ vec3 vd=normalize(w-cameraPosition); float graze=1.0-smoothstep(0.004,0.032,-vd.y);",
  "    float far=smoothstep(60.0,200.0,d)*(1.0-smoothstep(900.0,1500.0,d));",
  "    float wob=0.7*sn(vec2(x*0.045-uTime*0.9,z*0.35+uTime*0.3))+0.3*sn(vec2(x*0.14+uTime*1.7,z*0.8));",
  "    gMir=uHaze*graze*far*smoothstep(0.38,0.72,wob); c*=1.0-0.85*gMir; rough=mix(rough,0.9,gMir); }",
  /* fix pack: a low sun off the glossy groove made a white blob; at dusk the sharp highlight is clamped (STRIP_TRACK_POST.light)
     and a broad warm sheen towards the sun stands in for it */
  "  if(uGlare>0.0){ vec3 gv=normalize(w-cameraPosition); float gs=max(dot(reflect(gv,vec3(0.0,1.0,0.0)),uSunW),0.0);",
  "    gGlare=uGlare*(0.25+0.75*(1.0-rough))*(0.55*pow(gs,5.0)+0.45*pow(gs,40.0))*(1.0-smoothstep(0.02,0.35,-gv.y)); }",
  "  float ln=1.0-smoothstep(0.05,0.075,abs(x));",
  "  ln=max(ln,(1.0-smoothstep(0.13,0.16,abs(x-402.336)))*(0.75+0.25*step(0.5,fract(z*1.0))));",
  "  ln=max(ln,(1.0-smoothstep(0.05,0.075,abs(az-6.95)))*step(-76.0,x));",
  "  float stg=step(-76.0,x)*(1.0-step(-31.0,x)); ln=max(ln,stg*(1.0-smoothstep(0.05,0.075,abs(az-3.73))));",
  "  ln=max(ln,stg*(1.0-smoothstep(0.05,0.075,az))*step(0.45,fract(x/3.0))); ln=max(ln,(1.0-smoothstep(0.1,0.13,abs(x+31.0)))*step(az,6.95));",
  "  if(x<-14.0){ vec2 f0=vec2(1.0,0.0), h0=vec2(0.72,1.45), h1=vec2(0.62,1.25);",
  "    ln=max(ln,dcl(w.xz,vec2(-20.5,-2.5),f0,h0,vec4(0.0,0.5,0.125,0.5))+dcl(w.xz,vec2(-20.5,2.5),f0,h0,vec4(0.125,0.5,0.125,0.5)));",
  "    ln=max(ln,dcl(w.xz,vec2(-34.0,-5.6),f0,h1,vec4(0.0,0.5,0.125,0.5))+dcl(w.xz,vec2(-34.0,-1.87),f0,h1,vec4(0.125,0.5,0.125,0.5))",
  "      +dcl(w.xz,vec2(-34.0,1.87),f0,h1,vec4(0.25,0.5,0.125,0.5))+dcl(w.xz,vec2(-34.0,5.6),f0,h1,vec4(0.375,0.5,0.125,0.5))); }",
  "  if(x>690.0) ln=max(ln,dcl(w.xz,vec2(714.0,4.4),normalize(vec2(1.0,0.42)),vec2(0.8,2.3),vec4(0.5,0.5,0.125,0.5))+dcl(w.xz,vec2(744.0,5.6),normalize(vec2(1.0,0.42)),vec2(0.8,2.3),vec4(0.5,0.5,0.125,0.5)));",
  "  float st=(1.0-smoothstep(0.04,0.06,abs(x+0.18)))*(1.0-smoothstep(1.9,2.0,dz))*0.6;",
  "  ln=max(ln,st*step(0.5,fract(dz*2.5)));",
  "#if STRIP_TIER>=1",
  "  ln*=(0.8+0.2*smoothstep(0.25,0.7,sn(w.xz*vec2(4.0,26.0))))*(1.0-0.4*sfBlot(w.xz,31.0,0.7,0.9,1.0)*aaf(0.03)); gH+=0.0015*ln;",
  "#endif",
  "  c=mix(c,vec3(0.74,0.73,0.69),ln*(1.0-rub*0.5));",
  "  float cl=(1.0-smoothstep(0.05,0.075,az))*smoothstep(-2.0,-1.0,x);",
  "  c=mix(c,vec3(0.78,0.52,0.06),cl);",
  "  vec3 vdr=normalize(w-cameraPosition); gRefl*=pow(1.0-clamp(-vdr.y,0.0,1.0),4.0)*(1.0-ln);",
  /* a mirror-wet or rubber-glazed surface shows its grain as flicker, not relief: let the bump die out where it is glossy */
  "#if STRIP_TIER>=1",
  "  gH*=(1.0-0.92*gWet)*(1.0-0.8*shn)*(1.0-0.6*prep)*(1.0-0.7*vht)*(1.0-0.9*gMir);",
  "  gBn*=(1.0-0.8*rub)*(1.0-0.92*gWet)*(1.0-0.8*shn)*(1.0-0.6*prep)*(1.0-0.7*vht)*(1.0-0.9*gMir)*(1.0-ln);",
  "#endif",
  "  return c; }"].join("\n");
var STRIP_GLSL_GROUND=[ STRIP_GLSL_DECAL,
  "vec3 stripSurf(vec3 w, out float rough){",
  "  vec2 p=w.xz; float d=length(p-cameraPosition.xz); float fine=1.0-smoothstep(30.0,140.0,d), mid=1.0-smoothstep(120.0,900.0,d);",
  "  float inf=(1.0-smoothstep(70.0,80.0,abs(p.y)))*smoothstep(-300.0,-290.0,p.x)*(1.0-smoothstep(1020.0,1030.0,p.x));",
  "  float mow=step(0.5,fract(p.x/8.0));",
  "  vec3 grass=vec3(0.105,0.15,0.05)*(0.82+0.35*sn(p*0.06))*(1.0+(mow-0.5)*0.16*mid)*(0.9+0.2*sn(p*1.7)*fine);",
  "  vec2 q=(p+vec2(402.0,402.0))/805.0; vec2 cell=floor(q); float h=sh(cell+17.0);",
  "  vec3 fc= h<0.22?vec3(0.40,0.30,0.11): h<0.40?vec3(0.50,0.42,0.03): h<0.56?vec3(0.11,0.17,0.05): h<0.72?vec3(0.30,0.23,0.12): h<0.86?vec3(0.18,0.13,0.08):vec3(0.16,0.19,0.08);",
  "  float dir=step(0.5,sh(cell+3.0)); float co=mix(p.x,p.y,dir);",
  "  fc*=0.9+0.14*(0.5+0.5*sin(co*1.3))*mid+0.22*(sn(p*0.006+cell*7.0)-0.5);",
  "  vec2 rp=abs(fract((p+vec2(402.0,402.0))/1609.0+0.5)-0.5)*1609.0; float road=1.0-smoothstep(4.0,7.0,min(rp.x,rp.y));",
  "  fc=mix(fc,vec3(0.34,0.30,0.24),road);",
  /* Full/Ultra: tufted, sun-cured grass whose mowing edges wander; the field patchwork stays flat */
  "#if STRIP_TIER>=1",
  "  float gh; grass*=sfGrassFx(p,gh); float mowW=step(0.5,fract((p.x+(sn(p*0.02)-0.5)*2.6)/8.0)); grass*=(1.0+(mowW-0.5)*0.16*mid)/(1.0+(mow-0.5)*0.16*mid); gH=gh*inf; gHK=1.0;",
  "#endif",
  "  vec3 c=mix(fc,grass,inf);",
  "  float rr=(1.0-smoothstep(2.7,3.0,abs(p.y-13.5)))*smoothstep(-95.0,-90.0,p.x)*(1.0-smoothstep(775.0,780.0,p.x));",
  "  c=mix(c,vec3(0.07,0.07,0.075)*(0.85+0.3*sn(p*0.4)),rr);",
  "  float pit=smoothstep(-162.0,-157.0,p.x)*(1.0-smoothstep(336.0,341.0,p.x))*smoothstep(17.0,18.0,p.y)*(1.0-smoothstep(68.0,69.0,p.y));",
  "  c=mix(c,vec3(0.25,0.23,0.20)*(0.8+0.4*sn(p*1.1)),pit);",
  "#if STRIP_TIER>=1",
  "  float gvH; vec3 gvm=sfGravelFx(p,gvH); c*=mix(vec3(1.0),gvm,pit); gH=mix(gH,gvH,pit);",
  "#endif",
  "  float sp=(1.0-smoothstep(7.4,8.2,abs(p.y)))*smoothstep(-80.0,-75.0,p.x)*(1.0-smoothstep(785.0,790.0,p.x));",
  "  c=mix(c,vec3(0.2,0.19,0.17),sp);",
  "#if STRIP_TIER>=1",
  "  float spH; vec3 spm=sfDirtFx(p,0.3,spH); c*=mix(vec3(1.0),spm,sp); gH=mix(gH,spH,sp);",
  "#endif",
  "  float ap=smoothstep(-153.0,-151.0,p.x)*(1.0-smoothstep(-80.5,-79.5,p.x))*(1.0-smoothstep(11.5,12.2,abs(p.y)));",
  "  float tf=smoothstep(736.0,738.0,p.x)*(1.0-smoothstep(772.0,774.0,p.x))*smoothstep(6.8,7.2,p.y)*(1.0-smoothstep(11.0,11.6,p.y));",
  "  c=mix(c,vec3(0.07,0.07,0.075)*(0.85+0.3*sn(p*0.4)),max(ap,tf));",
  "#if STRIP_TIER>=1",
  "  float ah=max(rr,max(ap,tf)); float rh; vec3 rm=sfAsphFx(p,fine,rh); c*=mix(vec3(1.0),rm,ah); gH=mix(gH,rh,ah); gBn*=ah;",
  "#endif",
  "  float sand=smoothstep(783.0,785.0,p.x)*(1.0-smoothstep(855.0,857.0,p.x))*(1.0-smoothstep(8.6,9.1,abs(p.y)));",
  "  c=mix(c,vec3(0.44,0.36,0.24)*(0.82+0.3*sn(p*0.7)+0.12*(sn(p*6.0)-0.5)*fine)*(1.0+0.09*sin(p.y*21.0)*fine),sand);",
  "#if STRIP_TIER>=1",
  "  gH=mix(gH,0.012*sin(p.y*21.0+sn(p*0.5)*3.0)*aaf(0.3)+0.004*sn(p*23.0)*aaf(0.04),sand);",
  "#endif",
  "  float ry=abs(p.y-13.5), rl=rr*(1.0-smoothstep(0.05,0.08,abs(ry-2.7)));",
  "  if(ry<3.0 && p.x<640.0){ vec2 fb=vec2(-1.0,0.0), hw=vec2(2.2,4.2), ha=vec2(0.85,2.3); vec4 cw=vec4(0.0,0.0,0.5,0.5), ca=vec4(0.5,0.5,0.125,0.5);",
  "    float dm=dcl(p,vec2(560.0,13.5),fb,hw,cw)+dcl(p,vec2(260.0,13.5),fb,hw,cw)+dcl(p,vec2(-40.0,13.5),fb,hw,cw)+dcl(p,vec2(60.0,13.5),fb,hw,vec4(0.5,0.0,0.5,0.5));",
  "    dm+=dcl(p,vec2(546.0,13.5),fb,ha,ca)+dcl(p,vec2(246.0,13.5),fb,ha,ca)+dcl(p,vec2(-54.0,13.5),fb,ha,ca); rl=max(rl,dm); }",
  "  c=mix(c,vec3(0.72,0.71,0.66),rl);",
  "  rough=0.96; return c; }"].join("\n");
var STRIP_TRACK_POST={ normal:"normal=normalize(normal+(viewMatrix*vec4(gRip.x,0.0,gRip.y,0.0)).xyz);", emissive:"totalEmissiveRadiance+=uHorC*(gMir+gRefl)+uGlareC*gGlare;",
  light:"reflectedLight.directSpecular=min(reflectedLight.directSpecular, vec3(mix(64.0,0.14,uGlare))); reflectedLight.indirectSpecular=min(reflectedLight.indirectSpecular, vec3(mix(64.0,0.3,uGlare)));" };
/* Baked surfaces (tex/gr-*.jpg, tools/blender/ground-bake.py; every tier). Each bk*(p,k) is a real patch of that surface built and
   photographed in Blender, returned as a multiplier on the venue's own colour (k = strength): one tile every couple of metres, times a
   turned copy six times larger so the tiling never shows. Full / Ultra also read the slope picture into gBk; the caller copies or blends
   that into gBn, which leans the lit normal (stripPatchSh). Mip-mapping fades both out with distance, so nothing shimmers far away.
   A shader that calls one of these gets its pictures from stripPatchSh (STRIP_BAKES: function name, uniform, file, 1 / tile size, 1 if it has a slope picture). */
var STRIP_BAKES=[["bkAsph","uBkA","asphalt",0.5263,1], ["bkConc","uBkC","concrete",0.4348,0]];
var STRIP_GLSL_BAKE="vec2 gBk=vec2(0.0);\n"+STRIP_BAKES.map(function(b){ var u=b[1], f=b[3].toFixed(4), g=(b[3]/5.9).toFixed(4);
  return "uniform sampler2D "+u+";\n"+(b[4]?"#if STRIP_TIER>=1\nuniform sampler2D "+u+"n;\n#endif\n":"")+
    "vec3 "+b[0]+"(vec2 p, float k){ vec3 a=texture2D("+u+",p*"+f+").rgb*2.0; float b=texture2D("+u+",vec2(p.y,-p.x)*"+g+"+0.37).g*2.0;\n"+
    (b[4]?"#if STRIP_TIER>=1\n  gBk=(texture2D("+u+"n,p*"+f+").rg*2.0-1.0)*k;\n#endif\n":"  gBk=vec2(0.0);\n")+
    "  return mix(vec3(1.0), a*(0.62+0.38*b), k); }"; }).join("\n");
/* Full / Ultra ground detail (STRIP_TIER 1 / 2; Lite is tier 0 and compiles none of it). A surface's stripSurf() may set gH (a height in
   metres) and gHK (its strength) and the material perturbs the lit normal from the screen-space slope of gH, so grain, ruts, clods and
   crust edges catch the sun; gFP is the world size of a pixel here, so a fine octave can fade out before it shimmers (aaf). stripMacro is
   a three-scale, never-repeating tint that keeps a long straight from reading as one tiled noise; gMacroK scales it per surface. */
var STRIP_GLSL_DETAIL=[
  "vec3 stripMacro(vec2 p){ float a=sn(p*0.0023+vec2(3.1,8.7)), b=sn(p*0.0091+vec2(19.3,4.4)), c=sn(p*0.037+vec2(7.7,13.1)), l=(a-0.5)*0.26+(b-0.5)*0.2+(c-0.5)*0.12;",
  "  return vec3(1.0+l+(b-0.5)*0.05, 1.0+l, 1.0+l-(b-0.5)*0.06); }",
  "float aaf(float cell){ return 1.0-smoothstep(0.3*cell,0.85*cell,gFP); }",
  /* thin wandering lines (tar snakes, cracks, mud cracks): the contour of a warped noise; f frequency, w half width in noise units */
  "float sfLine(vec2 p, float f, float w, float s){ vec2 q=p*f+s; q+=vec2(sn(q*1.7+3.0),sn(q*1.7+9.0))*0.9; float n=sn(q); return 1.0-smoothstep(w*0.4,w,abs(n-0.5)); }",
  /* rectangular repair patches on a jittered grid: cell size c (m); returns a mask with a slightly ragged edge */
  "float sfPatch(vec2 p, vec2 c, float s, float prob){ vec2 g=p/c, i=floor(g), f=fract(g); float r=sh(i+s); if(r>prob) return 0.0; vec2 o=vec2(sh(i+s+7.1),sh(i+s+13.3))*0.4, z=vec2(0.25+0.3*sh(i+s+3.7),0.25+0.3*sh(i+s+5.9));",
  "  vec2 d=abs(f-0.5-(o-0.2))-z; float e=max(d.x,d.y)+(sn(p*3.0)-0.5)*0.05; return 1.0-smoothstep(-0.01,0.015,e); }",
  /* round blotches (oil, damp, scuffs) */
  "float sfBlot(vec2 p, float f, float lo, float hi, float s){ return smoothstep(lo,hi,sn(p*f+s)); }",
  /* grass: a multiplier on the venue's own green (tufts, blades, sun-cured patches); h = blade height for the bump */
  "vec3 sfGrassFx(vec2 p, out float h){ float tuft=sn(p*7.0), blade=sn(p*29.0), clump=sn(p*0.9+5.0), dry=sn(p*0.17+11.0), fa=aaf(0.14), fb=aaf(0.034);",
  "  h=0.06*tuft*fa+0.025*blade*fb; float v=1.0+0.2*(clump-0.5)+0.24*(tuft-0.5)*fa+0.22*(blade-0.5)*fb;",
  "  return mix(vec3(v), v*vec3(1.5,1.32,0.6), smoothstep(0.62,0.86,dry)*0.4); }",
  /* packed dirt / clay: clods and crumbs; k = 0 smooth .. 1 loose and lumpy. Returns a multiplier; h = lump height */
  "vec3 sfDirtFx(vec2 p, float k, out float h){ float cl=sn(p*vec2(5.0,6.5)+2.0), cr=sn(p*17.0), gr=sn(p*61.0), fa=aaf(0.06), fb=aaf(0.0165);",
  "  float lump=smoothstep(0.38,0.8,cl); h=k*(0.085*lump+0.03*cr*fa)+0.006*gr*fb; float v=1.0+0.28*k*(lump-0.4)+0.16*(cr-0.5)*fa+0.12*(gr-0.5)*fb;",
  "  return vec3(v, v*(1.0+0.05*(cl-0.5)), v*(1.0-0.06*(cl-0.5))); }",
  /* loose gravel: stones with a lit side; h = stone height. Multiplier on the lot's colour */
  "vec3 sfGravelFx(vec2 p, out float h){ float s1=sn(p*26.0), s2=sn(p*71.0+4.0), fa=aaf(0.038), fb=aaf(0.014); h=0.02*smoothstep(0.35,0.85,s1)*fa+0.008*smoothstep(0.4,0.9,s2)*fb;",
  "  float v=1.0+0.34*(s1-0.5)*fa+0.3*(s2-0.5)*fb; return vec3(v)*(1.0+0.1*(sn(p*3.0)-0.5)); }",
  /* road asphalt: grain bump, tar snakes, repair patches, oil. Multiplier on the asphalt colour; h = surface height; fine 0..1 near-camera weight */
  "vec3 sfAsphFx(vec2 p, float fine, out float h){ float g1=sn(p*13.0), g2=sn(p*47.0), g3=sn(p*131.0), fa=aaf(0.077), fb=aaf(0.021), fc=aaf(0.0076);",
  "  h=0.0036*g1*fa+0.0014*g2*fb+0.0008*g3*fc; float v=1.0+0.05*(g2-0.5)*fb+0.07*(g1-0.5)*fa; vec3 bk=bkAsph(p,BK_FULL);",
  "  float snake=sfLine(p*vec2(0.22,0.8),1.0,0.016,5.0)*smoothstep(0.52,0.72,sn(p*0.07+9.0))*aaf(0.022);",
  "  float web=sfLine(p*1.6,1.0,0.014,17.0)*smoothstep(0.66,0.8,sn(p*0.11+4.0))*aaf(0.018);",
  "  float cr=max(snake,web); v*=1.0-0.62*cr; h-=0.006*cr;",
  "  float pat=sfPatch(p,vec2(23.0,31.0),11.0,0.34); v*=1.0-0.2*pat; h-=0.0025*pat; h*=1.0-0.5*pat;",
  "  float oil=sfBlot(p*vec2(1.0,2.2),0.23,0.62,0.86,3.0)*0.5+sfBlot(p,1.1,0.66,0.9,8.0)*0.25; v*=1.0-0.4*oil;",
  "  gBn=gBk*(1.0-0.8*cr)*(1.0-0.5*pat); return v*mix(bk,vec3(1.0),0.6*cr+0.35*oil); }"].join("\n").replace(/BK_FULL/g,"0.85");
function stripSurfMat(glsl, extra, uni, post){
  var tier=GFX==="ultra"?2:GFX==="lite"?0:1;
  var m=new THREE.MeshStandardMaterial(Object.assign({color:0xffffff, roughness:0.9, metalness:0}, extra||{}));
  m.defines.STRIP_TIER=tier; if(tier) m.extensions={ derivatives:true };
  m.onBeforeCompile=function(sh){
    if(uni) for(var uk in uni) sh.uniforms[uk]=uni[uk];
    if(post){ if(post.normal) sh.fragmentShader=sh.fragmentShader.replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n"+post.normal);
      if(post.emissive) sh.fragmentShader=sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n"+post.emissive);
      if(post.light) sh.fragmentShader=sh.fragmentShader.replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n"+post.light); }
    stripPatchSh(sh, glsl);
  };
  m.customProgramCacheKey=function(){ return "strip_"+glsl.length; };
  return m;
}
/* the shared shader patch: world position varying, the noise kit, the surface function (a colour that multiplies diffuse, or a multiplier on a map),
   roughness, and (tier 1+) the macro tint + bump. The bump is added before any post.normal so the ripples sit on top of it. */
function stripPatchSh(sh, glsl){
  STRIP_BAKES.forEach(function(b){ if(glsl.indexOf(b[0])<0 && !(b[0]==="bkAsph" && GFX!=="lite" && glsl.indexOf("sfAsphFx")>=0)) return;
    sh.uniforms[b[1]]=bakeUni(b[2]); if(b[4] && GFX!=="lite") sh.uniforms[b[1]+"n"]=bakeUni(b[2]+"-n"); });
  sh.vertexShader=sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWp;").replace("#include <project_vertex>", "#include <project_vertex>\nvWp=(modelMatrix*vec4(transformed,1.0)).xyz;");
  sh.fragmentShader=sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWp;\nfloat gRough; float gH=0.0, gHK=0.0, gFP=0.0, gMacroK=1.0; vec2 gBn=vec2(0.0);\n"+STRIP_GLSL_NOISE+"\n"+STRIP_GLSL_BAKE+"\n#if STRIP_TIER>=1\n"+STRIP_GLSL_DETAIL+"\n#endif\n"+glsl)
    .replace("#include <color_fragment>", "#include <color_fragment>\n#if STRIP_TIER>=1\ngFP=length(fwidth(vWp));\n#endif\ndiffuseColor.rgb*=stripSurf(vWp,gRough);\n#if STRIP_TIER>=1\ndiffuseColor.rgb*=mix(vec3(1.0),stripMacro(vWp.xz),gMacroK);\n#endif")
    .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor=gRough;")
    .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n#if STRIP_TIER>=1\nif(gHK>0.0){ vec3 bSx=dFdx(-vViewPosition), bSy=dFdy(-vViewPosition); vec3 bR1=cross(bSy,normal), bR2=cross(normal,bSx); float bDet=dot(bSx,bR1)*faceDirection;\n  vec3 bGr=sign(bDet)*(dFdx(gH)*gHK*bR1+dFdy(gH)*gHK*bR2); float bL=length(bGr), bM=0.35*abs(bDet); if(bL>bM) bGr*=bM/bL; normal=normalize(abs(bDet)*normal-bGr); }\nnormal=normalize(normal+(viewMatrix*vec4(gBn.x,0.0,gBn.y,0.0)).xyz);\n#endif");
}

/* a textured material (road asphalt, kerbs, gravel, the pits floor) with the same Full / Ultra detail: stripSurf returns a multiplier on the map,
   world-space so a repeating canvas gets macro variation and a real bump. Lite gets the material back untouched. key names the program. */
function stripMapMat(m, glsl, key){
  if(GFX==="lite") return m;
  m.defines.STRIP_TIER=GFX==="ultra"?2:1; m.extensions={ derivatives:true };
  m.onBeforeCompile=function(sh){ stripPatchSh(sh, glsl); };
  m.customProgramCacheKey=function(){ return "stripmap_"+key; };
  return m;
}

/* Draw order that saves fill without changing a pixel (every event scene's sky goes through here). The sky used to be drawn first and
   then painted over by the ground and everything on it: more than half its cloud shader's work thrown away. Now its shader pins it to the
   far plane (gl_Position.z = w) and it is drawn last among the solid things, so it only fills pixels nothing else covered. The ground
   shaders (anything stripSurfMat / stripMapMat made) are the dearest solid pixels on screen, so they go second to last: cars, walls and
   stands first, and the ground skips what they hide. r128 otherwise sorts solid meshes by shader, not by distance. Depth decides every
   pixel either way, so the picture is the same. The ground pass is redone if the tier changes (new materials). */
function stripSkyLate(sky){
  sky.renderOrder=1000;
  sky.onBeforeRender=function(r, sc){
    if(sc.userData.lateKey===GFX) return; sc.userData.lateKey=GFX;
    sc.traverse(function(o){ var m=o.material; if(!o.isMesh || !m || !m.defines || m.defines.STRIP_TIER===undefined || m.transparent || o.userData.late) return; o.userData.late=1; o.renderOrder+=100; });
  };
  return sky;
}

/* --- sky dome: gradient, sun, prairie cumulus; night: stars, moon, town glow on the horizon --- */
function stripSkyMat(){
  return new THREE.ShaderMaterial({ uniforms:{ uSun:{value:STRIP_SUN_DAY.clone()}, uMoon:{value:STRIP_MOON.clone()}, uNight:{value:0}, uGain:{value:1}, uHor:{value:new THREE.Vector3().fromArray(STRIP_HOR)}, uHorN:{value:new THREE.Vector3().fromArray(STRIP_HOR_N)}, uDusk:{value:0}, uDuskSun:{value:STRIP_SUN_DUSK.clone()} },
    vertexShader:"varying vec3 vDir; void main(){ vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position.z=gl_Position.w; }",
    fragmentShader:[ "uniform vec3 uSun; uniform vec3 uMoon; uniform float uNight; uniform float uGain; uniform vec3 uHor; uniform vec3 uHorN; uniform float uDusk; uniform vec3 uDuskSun; varying vec3 vDir;", STRIP_GLSL_NOISE,
      "float h3(vec3 p){ p=fract(p*0.1031); p+=dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z); }",
      "void main(){ vec3 d=normalize(vDir); float h=d.y, up=clamp(h,0.0,1.0);",
      " vec3 zen=vec3(0.075,0.19,0.48);",
      " vec3 day=mix(uHor,zen,pow(up,0.55)); day=mix(day,uHor*0.92,smoothstep(0.0,-0.05,h));",
      " float sd=max(dot(d,uSun),0.0); vec3 sunc=vec3(1.0,0.80,0.52);",
      " day+=sunc*(pow(sd,5.0)*0.16+pow(sd,48.0)*0.3)*(1.0-uNight);",
      " vec2 cp=d.xz/(max(h,0.0)+0.09)*0.9+vec2(3.0,1.0);",
      " float n=sfbm(cp*1.1)+0.5*sfbm(cp*3.3)-0.25;",
      " float cov=smoothstep(0.50,0.74,n)*smoothstep(0.015,0.14,h);",
      " vec3 cl=mix(vec3(0.46,0.49,0.56),vec3(0.95,0.93,0.88),clamp((n-0.5)*2.6+pow(sd,3.0)*0.6,0.0,1.0));",
      " day=mix(day,cl,cov*0.92);",
      " day+=sunc*smoothstep(0.99955,0.9998,sd)*5.0*(1.0-cov);",
      " vec3 nt=mix(uHorN,vec3(0.0015,0.0025,0.008),pow(up,0.35));",
      " vec2 az=normalize(d.xz+vec2(1e-4)); float town=pow(max(0.0,1.0-abs(h)*7.0),2.2)*(0.35+0.65*pow(max(0.0,dot(az,normalize(vec2(-0.7,-0.7)))),3.0));",
      " nt+=vec3(0.075,0.04,0.015)*town;",
      " vec3 sp=d*150.0, sc=floor(sp)+0.5; float s=h3(floor(sp)); vec3 so=normalize(sc)*150.0, sq=abs(so-sc);",
      " float star=1.4*step(0.986,s)*step(max(sq.x,max(sq.y,sq.z)),0.2)*smoothstep(0.3,0.06,length(sp-so))*smoothstep(0.03,0.25,h)*(1.0-cov*0.9);",
      " nt+=vec3(0.75,0.8,1.0)*star*(0.35+0.65*fract(s*173.1));",
      " float md=max(dot(d,uMoon),0.0); nt+=vec3(0.85,0.88,0.95)*smoothstep(0.99965,0.99985,md)+vec3(0.03,0.035,0.05)*pow(md,40.0);",
      " nt=mix(nt,vec3(0.006,0.007,0.011)+vec3(0.03,0.018,0.008)*town,cov*0.75);",
      " vec3 col=mix(day,nt,uNight);",
      /* race-night dusk: sunset glow downtrack fading to blue hour, clouds lit pink from below */
      " if(uDusk>0.0){ vec3 ds=uDuskSun; float sdd=max(dot(d,ds),0.0), aw=0.5+0.5*dot(az,normalize(ds.xz)), hb=clamp(h,0.0,1.0);",
      "  vec3 dk=mix(vec3(0.95,0.34,0.09)*(0.18+0.82*pow(aw,3.0)), vec3(0.15,0.09,0.20), smoothstep(0.0,0.17,hb));",
      "  dk=mix(dk,vec3(0.016,0.03,0.09),smoothstep(0.1,0.62,hb));",
      "  dk+=vec3(1.0,0.5,0.2)*pow(sdd,22.0)*0.55+vec3(1.0,0.72,0.42)*smoothstep(0.9993,0.9997,sdd)*3.0*step(-0.002,h);",
      "  dk=mix(dk,vec3(0.03,0.025,0.035),smoothstep(0.0,-0.05,h));",
      "  vec3 dcl=mix(vec3(0.03,0.026,0.045),vec3(0.9,0.36,0.18)*(0.15+0.85*pow(aw,2.0)),clamp((n-0.45)*1.8,0.0,1.0)*(1.0-smoothstep(0.05,0.4,hb))+0.12);",
      "  dk=mix(dk,dcl,cov*0.9); dk*=0.22+0.78*uDusk;",
      "  col=mix(col,dk,smoothstep(0.0,0.3,uDusk)); }",
      " gl_FragColor=vec4(col*uGain,1.0);",
      " gl_FragColor=linearToOutputTexel(gl_FragColor); }"].join("\n"),
    side:THREE.BackSide, depthWrite:false, fog:false, toneMapped:false });
}

/* --- canvas art: sponsor/marker atlas, smoke puff, flame --- */
function stripAtlas(){
  var c=newCanvas(1024,512), x=c.getContext("2d"), F="'Chakra Petch','Arial Narrow',Arial,sans-serif";
  function panel(x0,y0,w,h,bg,fg,txt,sz,sub){ x.fillStyle=bg; x.fillRect(x0,y0,w,h); x.fillStyle=fg; x.font="700 "+sz+"px "+F; x.textAlign="center"; x.textBaseline="middle"; x.fillText(txt, x0+w/2, y0+h/2+2);
    if(sub){ x.fillStyle=sub; x.fillRect(x0,y0+h-7,w,5); } }
  /* row 0: wall banners (340×64 each) */
  panel(0,0,340,64,"#1d4787","#f4f1e8","SECTION LINE",42,"#d9a52b");
  panel(342,0,340,64,"#e5701f","#141414","COULEE FUELS",42,"#141414");
  panel(684,0,340,64,"#131416","#f2c22c","NORTHWIND TYRE",40,"#f2c22c");
  /* row 1: long raceway sign */
  panel(0,66,1024,62,"#f1ede2","#1d4787","SECTION LINE DRAGWAY · SASKATOON",46,"#1d4787");
  /* row 2: finish checker + second-tier banners */
  for(var i=0;i<32;i++) for(var j=0;j<4;j++){ x.fillStyle=((i+j)&1)?"#111":"#f2f2f2"; x.fillRect(i*16, 130+j*16, 16,16); }
  panel(512,130,256,64,"#b7261d","#f4f1e8","PRAIRIE FIRE",34);
  panel(768,130,256,64,"#2c6b3a","#f4f1e8","HALCYON GT",36);
  /* row 3: marker boards 5 × 204×120 */
  var mk=["60 FT","330","1/8","1000","1/4"];
  for(i=0;i<5;i++){ var bx=i*205; x.fillStyle="#1a1a1a"; x.fillRect(bx,196,203,122); x.fillStyle="#f4efe2"; x.fillRect(bx+6,202,191,110); x.fillStyle="#141414"; x.font="700 "+(mk[i].length>4?66:78)+"px "+F; x.textAlign="center"; x.textBaseline="middle"; x.fillText(mk[i], bx+101, 260); }
  /* row 4: hauler liveries 512×120 ×2 */
  panel(0,322,510,120,"#e9e6dc","#1d4787","SECTION LINE RACING",50,"#d9a52b");
  panel(512,322,512,120,"#1b1d20","#e5701f","COULEE FUELS",64,"#e5701f");
  /* row 5: tower windows strip */
  x.fillStyle="#0e1418"; x.fillRect(0,446,1024,64); for(i=0;i<16;i++){ x.fillStyle="#26343d"; x.fillRect(i*64+4,450,56,56); x.fillStyle="rgba(170,200,220,0.25)"; x.fillRect(i*64+6,452,20,52); }
  var t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=MAXANISO; return t;
}
var STRIP_UV={ ban:[[0,1-64/512,340/1024,1],[342/1024,1-64/512,682/1024,1],[684/1024,1-64/512,1,1],[512/1024,1-194/512,768/1024,1-130/512],[768/1024,1-194/512,1,1-130/512]],
  raceway:[0,1-128/512,1,1-66/512], finish:[0,1-194/512,0.5,1-130/512],
  mark:function(i){ return [i*205/1024, 1-318/512, (i*205+203)/1024, 1-196/512]; },
  haul:[[0,1-442/512,510/1024,1-322/512],[512/1024,1-442/512,1,1-322/512]], win:[0,1-510/512,1,1-446/512] };
function stripPuffTex(){
  var c=newCanvas(128,128), x=c.getContext("2d"), i;
  for(i=0;i<22;i++){ var a=Math.random()*TAU, r=Math.random()*30, px=64+Math.cos(a)*r, py=64+Math.sin(a)*r, rad=16+Math.random()*22;
    var g=x.createRadialGradient(px,py,0,px,py,rad); g.addColorStop(0,"rgba(255,255,255,0.34)"); g.addColorStop(1,"rgba(255,255,255,0)"); x.fillStyle=g; x.fillRect(0,0,128,128); }
  x.globalCompositeOperation="destination-in"; var g2=x.createRadialGradient(64,64,10,64,64,63); g2.addColorStop(0,"rgba(0,0,0,1)"); g2.addColorStop(0.6,"rgba(0,0,0,0.8)"); g2.addColorStop(1,"rgba(0,0,0,0)"); x.fillStyle=g2; x.fillRect(0,0,128,128);
  return new THREE.CanvasTexture(c);
}
function stripFlameTex(sharp){
  var c=newCanvas(64,64), x=c.getContext("2d"); var g=x.createRadialGradient(32,32,0,32,32,31);
  if(sharp){ g.addColorStop(0,"rgba(255,255,255,1)"); g.addColorStop(0.45,"rgba(255,255,255,0.9)"); g.addColorStop(0.75,"rgba(255,255,255,0.35)"); g.addColorStop(1,"rgba(255,255,255,0)"); }
  else { g.addColorStop(0,"rgba(255,255,255,1)"); g.addColorStop(0.22,"rgba(255,255,255,0.85)"); g.addColorStop(0.55,"rgba(255,255,255,0.25)"); g.addColorStop(1,"rgba(255,255,255,0)"); }
  x.fillStyle=g; x.fillRect(0,0,64,64); return new THREE.CanvasTexture(c);
}
function stripFenceTex(){
  var c=newCanvas(64,64), x=c.getContext("2d"); x.strokeStyle="rgba(200,205,210,0.9)"; x.lineWidth=2.5;
  x.beginPath(); x.moveTo(0,0); x.lineTo(64,64); x.moveTo(64,0); x.lineTo(0,64); x.moveTo(-32,0); x.lineTo(32,64); x.moveTo(32,0); x.lineTo(96,64); x.moveTo(96,0); x.lineTo(32,64); x.moveTo(32,0); x.lineTo(-32,64); x.stroke();
  var t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}

/* --- the prairie & the plant --- */
function buildStripScene(){
  var S2=new THREE.Scene(); STRIP.scene=S2; STRIP.tier=GFX;
  var lite=(GFX==="lite"), i, j, k, side, x, z;
  /* lights */
  var hemi=new THREE.HemisphereLight(0xcfdcf0, 0x6a5a3c, 0.32); S2.add(hemi); STRIP.hemi=hemi;
  var sun=new THREE.DirectionalLight(0xffe6c4, 2.1); sun.castShadow=true; var ms=lite?1024:2048; sun.shadow.mapSize.set(ms,ms);
  var shc=sun.shadow.camera; shc.left=-30; shc.right=30; shc.top=30; shc.bottom=-30; shc.near=1; shc.far=260; sun.shadow.bias=-0.0006; sun.shadow.normalBias=0.03;
  S2.add(sun); S2.add(sun.target); STRIP.sun=sun;
  var flood=new THREE.DirectionalLight(0xfff2dc, 0); flood.position.set(0,40,30); S2.add(flood); S2.add(flood.target); STRIP.flood=flood;
  var flash=new THREE.PointLight(0xff8a30, 0, 9, 2); flash.position.set(0,-50,0); S2.add(flash); STRIP.flash=flash;
  /* sky + fog + big world */
  var sky=new THREE.Mesh(new THREE.SphereGeometry(3000, 40, 20), stripSkyMat()); sky.frustumCulled=false; stripSkyLate(sky); S2.add(sky); STRIP.sky=sky;
  S2.fog=new THREE.Fog(0xffffff, 170, 3400); STRIP.fog=S2.fog;
  var decal={value:stripDecalTex()};   /* painted markings (lane numbers, staging lanes, return road) sampled by both surface shaders */
  var ground=new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), stripSurfMat(STRIP_GLSL_GROUND, null, {uDecal:decal})); ground.rotation.x=-PI/2; ground.position.set(350,-0.03,0); ground.receiveShadow=true; S2.add(ground);
  var trackW=15, trackL=STRIP_TRACK_END+80;
  var track=new THREE.Mesh(new THREE.PlaneGeometry(trackL, trackW), stripSurfMat(STRIP_GLSL_TRACK, null, Object.assign({uDecal:decal}, STRIP_U), STRIP_TRACK_POST)); track.rotation.x=-PI/2; track.position.set(-80+trackL/2, 0, 0); track.receiveShadow=true; S2.add(track);
  /* distant hills: a low ring of coulee rises */
  (function(){ var seg=160, R0=2300, pos=[], col=[], idx=[], c1=sc(0x5d6a4a), c2=sc(0x7d8a70);
    for(var s=0;s<=seg;s++){ var a=s/seg*TAU, hgt=18+40*Math.pow(0.5+0.5*Math.sin(a*3.0+1.2),2)+22*Math.sin(a*11.0+0.4)*Math.sin(a*5.0)+14*Math.sin(a*23.0);
      hgt=Math.max(6,hgt); var cx=350+Math.cos(a)*R0, cz=Math.sin(a)*R0, fx=350+Math.cos(a)*(R0-600), fz=Math.sin(a)*(R0-600);
      pos.push(fx,-2,fz, cx,hgt,cz, 350+Math.cos(a)*(R0+400),hgt*0.6,Math.sin(a)*(R0+400)); col.push(c1.r,c1.g,c1.b, c2.r,c2.g,c2.b, c2.r,c2.g,c2.b); }
    for(s=0;s<seg;s++){ var a0=s*3, b0=(s+1)*3; idx.push(a0,b0,a0+1, b0,b0+1,a0+1, a0+1,b0+1,a0+2, b0+1,b0+2,a0+2); }
    var g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); g.setAttribute("color",new THREE.Float32BufferAttribute(col,3)); g.setIndex(idx); g.computeVertexNormals();
    var hm=new THREE.Mesh(g, new THREE.MeshStandardMaterial({vertexColors:true, roughness:1, side:THREE.DoubleSide})); hm.frustumCulled=false; S2.add(hm); })();

  var M=STRIP.mats;
  M.solid=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.86});
  M.metal=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.42, metalness:0.65});
  M.lamp=new THREE.MeshBasicMaterial({vertexColors:true, toneMapped:false, color:0x777777});
  M.beam=new THREE.MeshBasicMaterial({vertexColors:true, transparent:true, opacity:0.0, depthWrite:false, blending:THREE.AdditiveBlending, fog:true, side:THREE.DoubleSide});
  M.sign=new THREE.MeshStandardMaterial({map:stripAtlas(), roughness:0.72});
  M.fence=new THREE.MeshBasicMaterial({map:stripFenceTex(), transparent:true, opacity:0.55, depthWrite:false, side:THREE.DoubleSide, color:0x9aa0a6});
  var B=new StripBatch();
  var CONC=0xc9c4b6, CONC2=0xb4ae9f, STEEL=0x8d9296, DARK=0x2a2c2f;

  /* guardwalls + sponsor panels + catch fence (the near wall opens at x 738-772 for the turn-off to the return road) */
  var fenceG=[], TO0=738, TO1=772;
  function fencePanel(cx, cy, cz, len, h, ry){ var g=new THREE.PlaneGeometry(len, h).toNonIndexed(), uv=g.attributes.uv; for(var q=0;q<uv.count;q++) uv.setXY(q, uv.getX(q)*len/0.9, uv.getY(q)*h/0.9);
    if(ry) g.rotateY(ry); g.translate(cx, cy, cz); fenceG.push(g); }
  for(side=-1; side<=1; side+=2){
    var wz=side*7.78, x0=-75, x1=STRIP_TRACK_END;
    (side>0?[[x0,TO0],[TO1,x1]]:[[x0,x1]]).forEach(function(sg){
      B.box("solid", (sg[0]+sg[1])/2, 0.53, wz, sg[1]-sg[0], 1.06, 0.56, CONC);
      B.box("solid", (sg[0]+sg[1])/2, 1.075, wz, sg[1]-sg[0], 0.05, 0.4, CONC2); });
    for(x=-60, k=0; x<x1-10; x+=8.5, k++){ if(side>0 && x>TO0-4 && x<TO1+4) continue;
      var pick=((k*7+(side>0?1:0)*3)%5); var uvr=STRIP_UV.ban[pick];
      B.add("sign","plane",[x, 0.56, side*7.495],[5.4,0.82,1],0xffffff,[0, side>0?PI:0, 0],uvr); }
    /* catch fence along the launch half on both sides */
    var fx0=-40, fx1=440;
    for(x=fx0; x<=fx1; x+=10) B.add("metal","cyl6",[x, 2.3, side*7.9],[0.07,2.5,0.07],STEEL);
    B.box("metal", (fx0+fx1)/2, 3.55, side*7.9, fx1-fx0, 0.05, 0.05, STEEL);
    fencePanel((fx0+fx1)/2, 2.32, side*7.9, fx1-fx0, 2.45, 0);
    /* timing blocks at every increment, both lanes (lane edges + centre) */
    var marks=[18.288,100.584,201.168,304.8,402.336];
    for(i=0;i<marks.length;i++){ if(i||side<0){ B.box("solid", marks[i], 0.2, side*7.3, 0.3, 0.4, 0.3, 0x3a3d40); B.box("lamp", marks[i]-0.16, 0.25, side*7.3, 0.02, 0.08, 0.08, 0xff3322); }   /* not the near 60 ft one: it sits in front of the pan camera's lens */
      /* marker boards on posts behind the wall, angled to read from the chase and the side */
      var mx=marks[i]-2, mz=side*9.6; B.add("metal","cyl6",[mx, 1.9, mz],[0.14,3.8,0.14],STEEL);
      B.add("sign","plane",[mx, 3.4, mz],[3.2,1.9,1],0xffffff,[0, side<0?-0.62:-(PI-0.62), 0],STRIP_UV.mark(i));
      var mry=side<0?-0.62:-(PI-0.62); B.add("solid","box",[mx-Math.sin(mry)*0.05, 3.4, mz-Math.cos(mry)*0.05],[3.3,2.0,0.06],0x1a1a1a,[0,mry,0]); }
  }
  /* staging beams: photocell posts on both edges of both lanes */
  for(var ln=-1; ln<=1; ln+=2){ var lzc=ln*STRIP_LANE;
    for(side=-1; side<=1; side+=2){ var pz=lzc+side*2.15; if(Math.abs(pz)<0.5) pz=side*0.45;
      B.box("solid", 0.0, 0.18, pz, 0.16, 0.36, 0.16, 0x2b2d30); B.box("solid", -0.18, 0.18, pz, 0.16, 0.36, 0.16, 0x2b2d30);
      B.box("lamp", 0.0, 0.2, pz-side*0.085, 0.06, 0.06, 0.01, 0xff2a1a); B.box("lamp", -0.18, 0.2, pz-side*0.085, 0.06, 0.06, 0.01, 0xff2a1a); }
    /* water box curbs */
    B.box("solid", -10, 0.035, lzc+2.3, 10, 0.1, 0.12, 0xd9d4c6); B.box("solid", -10, 0.035, lzc-2.3, 10, 0.1, 0.12, 0xd9d4c6);   /* fix pack: set into the pad */
    B.box("solid", -10, 0.002, lzc+2.3, 10.06, 0.006, 0.18, 0x26272a); B.box("solid", -10, 0.002, lzc-2.3, 10.06, 0.006, 0.18, 0x26272a);   /* grime line where the curb meets the pad */
  }
  /* burnout-box water hose reel + cones behind the line */
  B.add("solid","cone",[-15.5,0.35,6.6],[0.4,0.7,0.4],0xe36a17); B.add("solid","cone",[-15.5,0.35,-6.6],[0.4,0.7,0.4],0xe36a17);
  /* v2: traffic cones: lane split behind the box, the shutdown centreline, the turn-off */
  function tcone(cx, cz){ B.box("solid", cx, 0.015, cz, 0.38, 0.03, 0.38, 0xe8641a); B.add("solid","tcone",[cx, 0.31, cz],[0.3,0.56,0.3],0xf06a1c);
    B.add("solid","cyl",[cx, 0.36, cz],[0.19,0.09,0.19],0xf3f1ea); }
  tcone(-19,0); tcone(-23,0); tcone(-27,0); tcone(-16.2,5.7); tcone(-16.2,-5.7);
  for(x=480; x<=760; x+=40) tcone(x, 0);
  tcone(705,5.9); tcone(715,5.4); tcone(725,4.9); tcone(735,4.4);

  /* the tree (pole, housing, visors) — bulbs are separate emissive meshes */
  var TX=6.0;
  B.add("metal","cyl",[TX, 0.7, 0],[0.16,1.4,0.16],DARK); B.box("solid", TX, 0.03, 0, 0.8, 0.06, 0.8, 0x3a3c3f);
  B.box("solid", TX, 2.42, 0, 0.26, 2.3, 0.86, 0x121315); B.box("solid", TX+0.06, 3.66, 0, 0.16, 0.12, 0.86, 0x121315);
  var bulbY={pre:3.44, stage:3.2, a1:2.9, a2:2.55, a3:2.2, g:1.85, r:1.5};
  for(var nm in bulbY){ for(side=-1; side<=1; side+=2) B.box("solid", TX-0.2, bulbY[nm]+0.13, side*0.24, 0.16, 0.025, 0.3, 0x0c0c0d); }
  /* fix pack: the back of the tree (what the chase cam sees): a grey service door with ribs and a stencilled lane split, not a black slab */
  B.box("solid", TX+0.135, 2.42, 0, 0.02, 2.18, 0.78, 0x8b9096); B.box("solid", TX+0.15, 2.42, 0, 0.012, 2.1, 0.035, 0xe1b21c);
  for(k=0;k<4;k++) B.box("metal", TX+0.15, 1.55+k*0.58, 0, 0.02, 0.04, 0.7, 0x7d8388);
  B.box("solid", TX+0.15, 3.25, 0.2, 0.012, 0.1, 0.14, 0xe9e5da); B.box("solid", TX+0.15, 3.25, -0.2, 0.012, 0.1, 0.14, 0xe9e5da);
  /* start-line timing tower (far side, behind the line) */
  var TWX=-24, TWZ=-15;
  B.box("solid", TWX, 3.2, TWZ, 10, 6.4, 6, 0xd8d2c2); B.box("solid", TWX, 6.65, TWZ, 10.8, 0.5, 6.8, 0x2a2c2f);
  B.box("solid", TWX, 8.2, TWZ, 7, 2.6, 4.6, 0xe7e2d6); B.box("solid", TWX, 9.65, TWZ, 7.8, 0.35, 5.4, 0x2a2c2f);
  B.add("sign","plane",[TWX, 8.25, TWZ+2.31],[6.6,1.6,1],0xffffff,null,[0,1-510/512,0.45,1-446/512]);
  B.add("sign","plane",[TWX+3.51, 8.25, TWZ],[4.2,1.6,1],0xffffff,[0,PI/2,0],[0,1-510/512,0.3,1-446/512]);
  B.add("sign","plane",[TWX, 5.2, TWZ+3.01],[9.6,0.9,1],0xffffff,null,STRIP_UV.raceway);
  B.box("lamp", TWX, 8.25, TWZ+2.33, 6.4, 0.3, 0.01, 0xffd79a);
  B.add("metal","cyl6",[TWX-3.5, 13.5, TWZ-1.5],[0.08,7,0.08],STEEL);
  /* raceway gantry downtrack + finish gantry */
  function gantry(gx, uv, h){ B.box("metal", gx, h/2, -8.6, 0.35, h, 0.35, STEEL); B.box("metal", gx, h/2, 8.6, 0.35, h, 0.35, STEEL); B.box("metal", gx, h+0.2, 0, 0.4, 0.4, 17.6, STEEL);
    B.add("sign","plane",[gx-0.22, h-0.55, 0],[14,1.2,1],0xffffff,[0,-PI/2,0],uv); B.add("solid","plane",[gx+0.22, h-0.55, 0],[14,1.2,1],0x222428,[0,PI/2,0]); }
  gantry(122, STRIP_UV.raceway, 7.6); gantry(STRIP_Q+0.3, STRIP_UV.finish, 7.2);
  /* grandstand (far side, along the launch area) with a canopy */
  var GX0=-8, GX1=140, rows=11;
  for(i=0;i<rows;i++){ var rz=-9.6-i*0.9, ry=0.45+i*0.46; B.box("solid", (GX0+GX1)/2, ry/2, rz, GX1-GX0, ry, 0.9, i%2?0xb8b2a4:0xc4beb0);
    B.box("solid", (GX0+GX1)/2, ry+0.08, rz+0.1, GX1-GX0, 0.08, 0.34, 0x2e5a9a); }
  var gzB=-9.6-rows*0.9; B.box("solid", (GX0+GX1)/2, 3.4, gzB, GX1-GX0, 6.8, 0.4, 0xa8a293);
  for(x=GX0; x<=GX1; x+=18.5){ B.box("metal", x, 5.6, gzB+0.4, 0.3, 11.2, 0.3, STEEL); B.box("metal", x, 11.0, gzB+3.2, 0.25, 0.25, 6.6, STEEL); }
  B.box("metal", (GX0+GX1)/2, 11.2, gzB+3.4, GX1-GX0+1, 0.25, 7.6, 0x5d6268);
  B.add("sign","plane",[(GX0+GX1)/2, 10.4, gzB+7.21],[40,1.9,1],0xffffff,null,STRIP_UV.raceway);
  for(x=GX0+4; x<GX1; x+=9) B.box("lamp", x, 11.06, gzB+4.2, 1.6, 0.04, 0.5, 0xfff2d8);   /* v2: canopy lights over the stands */
  /* light poles (both sides, every 55 m) with lamp heads and fake light shafts for night */
  STRIP.poles=[];
  for(x=-45; x<=STRIP_TRACK_END-20; x+=55){ for(side=-1; side<=1; side+=2){ var plz=side*(side<0 && x>=GX0-6 && x<=GX1+6 ? 9.0 : 10.6);
    B.add("metal","cyl",[x, 9, plz],[0.34,18,0.34],0x9aa0a6); B.box("metal", x, 18.2, plz-side*0.2, 0.3, 0.3, 3.2, 0x80868c);
    for(k=-1;k<=1;k+=2){ B.box("metal", x, 18.55, plz-side*0.2+k*0.8, 0.7, 0.5, 0.6, 0x5a5f65); B.box("lamp", x, 18.29, plz-side*0.2+k*0.8, 0.62, 0.02, 0.52, 0xfff0d0);
      B.add("beam","beam",[x, 9.2, plz-side*(0.2+2.4)+k*0.8],[5.2,18,5.2],0xffe8c0,[side*0.26,0,0]); }
    STRIP.poles.push(new THREE.Vector3(x, 18.3, plz)); } }
  /* shutdown: sand trap past the end of the strip, curbed, with a catch net across it */
  var rng=function(s){ var t=Math.sin(s*127.1)*43758.5453; return t-Math.floor(t); };
  for(side=-1; side<=1; side+=2) B.box("solid", 820, 0.22, side*9.3, 74, 0.44, 0.45, CONC);
  B.box("solid", 781.5, 0.08, 0, 3, 0.16, 15, CONC2);
  for(z=-9; z<=9.01; z+=3) B.add("metal","cyl6",[851, 2.35, z],[0.16,4.7,0.16],STEEL);
  B.box("metal", 851, 4.66, 0, 0.08, 0.08, 18.4, STEEL); B.box("metal", 851, 0.3, 0, 0.12, 0.12, 18.4, STEEL);
  fencePanel(851, 2.4, 0, 18, 4.2, PI/2);
  for(i=0;i<5;i++) B.box("solid", 760+i*1.2, 0.5, 0, 0.9, 1.0, 0.9, i%2?0xe8641a:0xf3f1ea);   /* barrels at the end of the shutdown */
  /* the pits (instanced pit spaces + crews) and the staging lanes (static cars) */
  var ppl=[];
  STRIP.kits=stripBuildPits(S2, B, ppl, rng);
  stripBuildStaging(B, ppl, rng);
  /* bleacher + fence near the finish on the near side */
  for(i=0;i<5;i++){ B.box("solid", 300, 0.25+i*0.28, 10.5+i*0.75, 60, 0.5+i*0.56, 0.75, i%2?0xb8b2a4:0xc4beb0); }
  /* scoreboard frames near the stripe (boards themselves are dynamic) */
  for(side=-1; side<=1; side+=2){ var sbx=STRIP_Q+26, sbz=side*10.8, ry2=side<0?-PI/2+0.55:-PI/2-0.55;
    for(var sp2=-1; sp2<=1; sp2+=2) B.box("metal", sbx-Math.sin(ry2)*0.75+Math.cos(ry2)*sp2*2.6, 3.3, sbz-Math.cos(ry2)*0.75-Math.sin(ry2)*sp2*2.6, 0.35, 6.6, 0.35, STEEL);   /* posts behind the board (one stood in front of its lower half) */
    B.add("solid","box",[sbx-Math.sin(ry2)*0.3, 6.7, sbz-Math.cos(ry2)*0.3],[9.0,4.7,0.4],0x151618,[0,ry2,0]);
    B.add("solid","box",[sbx-Math.sin(ry2)*0.3, 9.66, sbz-Math.cos(ry2)*0.3],[9.0,1.3,0.4],0x151618,[0,ry2,0]); }   /* v2: title header */
  /* grain elevators: the prairie skyline (one downtrack, one behind the start, one far off) */
  function elevator(ex, ez, s, col, rot){
    var cs=Math.cos(rot||0), sn2=Math.sin(rot||0); function P(dx,dz){ return [ex+dx*cs-dz*sn2, ez+dx*sn2+dz*cs]; }
    var p=P(0,0); B.box("solid", p[0], 11*s, p[1], 11*s, 22*s, 11*s, col, rot);
    p=P(0,0); B.add("solid","prism",[p[0], 22*s, p[1]],[11.4*s, 3.2*s, 11.4*s],col,[0,rot||0,0]);
    p=P(0,0); B.box("solid", p[0], 27*s, p[1], 4.8*s, 5*s, 5.2*s, col, rot); B.add("solid","prism",[p[0], 29.5*s, p[1]],[5.2*s,1.8*s,5.6*s],0x4a4644,[0,rot||0,0]);
    p=P(9.5*s,0); B.box("solid", p[0], 7*s, p[1], 8*s, 14*s, 9*s, col, rot); B.add("solid","prism",[p[0], 14*s, p[1]],[8.2*s,2*s,9.4*s],0x4a4644,[0,rot||0,0]);
    p=P(-8*s,0); B.box("solid", p[0], 3*s, p[1], 6*s, 6*s, 7*s, 0x8a8478, rot);
  }
  elevator(1180, -210, 1.0, 0x8e2f23, 0.3); elevator(1215, -225, 0.9, 0xb9a57a, 0.3);
  elevator(-760, -420, 1.1, 0x9b3a2a, -0.5); elevator(420, 1400, 1.0, 0xa89a78, 1.1); elevator(-300, 1150, 0.9, 0x8e2f23, 0.6);
  /* farmyards: house, red barn, quonset */
  function yard(fx, fz, rot){ B.box("solid", fx, 3, fz, 9, 6, 7, 0xe8e4da, rot); B.add("solid","prism",[fx,6,fz],[9.4,3,7.6],0x3c3a38,[0,rot,0]);
    B.box("solid", fx+22, 5, fz+4, 16, 10, 12, 0x9a2e22, rot); B.add("solid","prism",[fx+22,10,fz+4],[16.4,5,12.6],0x5a5a5a,[0,rot,0]);
    B.add("metal","cyl",[fx-18, 0, fz+10],[14,26,14],0x8f959b,[PI/2,rot,0]); }
  yard(520,-340,0.2); yard(-180,-520,-0.4); yard(900,380,0.7); yard(150,620,0.1);
  (function(){ var n=0, q, o=0; fenceG.forEach(function(g){ n+=g.attributes.position.count; });
    var pos=new Float32Array(n*3), uv=new Float32Array(n*2); fenceG.forEach(function(g){ pos.set(g.attributes.position.array, o*3); uv.set(g.attributes.uv.array, o*2); o+=g.attributes.position.count; g.dispose(); });
    var fg=new THREE.BufferGeometry(); fg.setAttribute("position",new THREE.BufferAttribute(pos,3)); fg.setAttribute("uv",new THREE.BufferAttribute(uv,2)); fg.computeBoundingSphere();
    M.fence.map.repeat.set(1,1); S2.add(new THREE.Mesh(fg, M.fence)); })();
  /* shelterbelts: low-poly trees around the yards and along the mile roads (merged into the static batch: no draw of their own) */
  (function(){ var pts=[], s;
    var belts=[[520,-340,0.2],[-180,-520,-0.4],[900,380,0.7],[150,620,0.1],[1180,-210,0.3],[-760,-420,-0.5]];
    belts.forEach(function(b,bi){ for(var q=0;q<26;q++){ var a=b[2], along=-30+q*4.2, off=-28+rng(bi*50+q)*3; if(q>=14){ along=-30+(q-14)*5; off=40+rng(q*3+bi)*3; }
      pts.push([b[0]+along*Math.cos(a)-off*Math.sin(a), b[1]+along*Math.sin(a)+off*Math.cos(a), 4+rng(q+bi*7)*3]); } });
    for(s=0;s<60;s++){ pts.push([-600+s*32+rng(s)*10, -1207+rng(s+3)*6, 3+rng(s+5)*2.5]); pts.push([-400+s*30, 1210+rng(s+8)*6, 3+rng(s+2)*2.5]); }
    var cc=new THREE.Color();
    pts.forEach(function(p,q){ var h=p[2]*1.6; cc.setHSL(0.24+rng(q)*0.06, 0.45, 0.13+rng(q+1)*0.06); B.add("solid","ico",[p[0],h*0.8,p[1]],[p[2],h,p[2]],cc.getHex()); }); })();
  /* build the merged meshes */
  B.build("solid", M.solid, true); B.build("metal", M.metal, true); STRIP.lampMesh=B.build("lamp", M.lamp, false); B.build("sign", M.sign, true);
  STRIP.beamMesh=B.build("beam", M.beam, false); if(STRIP.beamMesh){ STRIP.beamMesh.receiveShadow=false; STRIP.beamMesh.visible=false; STRIP.beamMesh.renderOrder=4; }

  /* crowd: billboard people on the grandstand rows and the near bleacher (+ the pit and staging crews collected above), one draw;
     built at Ultra density, ranked, and thinned per tier by instance count (stripVenueTier) */
  (function(){ var s2, r2;
    for(r2=0;r2<rows;r2++){ for(x=GX0+0.6; x<GX1-0.5; x+=0.62){ if(rng(x*3.1+r2*17.7)<0.24) continue; var xx=x+(rng(x+r2)-0.5)*0.2;
      ppl.push({p:[xx, 0.45+r2*0.46+0.12, -9.6-r2*0.9-0.1], r:rng(x*7.3+r2*3.9+0.5), xx:xx, card:(r2+(xx>60?1:0))%3, stand:true}); } }
    for(r2=0;r2<5;r2++){ for(x=272; x<328; x+=0.7){ if(rng(x*1.7+r2*5.3)<0.4) continue; var wx=(x-272)*2.6-8;
      ppl.push({p:[x, 0.25+r2*0.56+0.12, 10.5+r2*0.75], r:rng(x*5.1+r2*2.3+0.9), xx:wx, card:(r2+(wx>60?1:0))%3, stand:true}); } }
    STRIP.crowd=stripBuildCrowd(S2, ppl, rng); })();

  /* Christmas tree bulbs — names kept: {p,o}{pre,stage,a1,a2,a3,g,r} */
  STRIP.tree={bulbs:{}, halos:{}};
  var haloTex=stripFlameTex();
  function bulb(name, y, z, col, r, pair){
    var geo=pair ? (function(){ var g1=new THREE.CylinderGeometry(r,r,0.06,14).toNonIndexed(); g1.rotateZ(PI/2); var a=g1.clone().translate(0,0,-0.09), b2=g1.clone().translate(0,0,0.09);
        var pos=new Float32Array(a.attributes.position.count*6), nor=new Float32Array(pos.length); pos.set(a.attributes.position.array); pos.set(b2.attributes.position.array, a.attributes.position.array.length);
        nor.set(a.attributes.normal.array); nor.set(b2.attributes.normal.array, a.attributes.normal.array.length);
        var gg=new THREE.BufferGeometry(); gg.setAttribute("position",new THREE.BufferAttribute(pos,3)); gg.setAttribute("normal",new THREE.BufferAttribute(nor,3)); return gg; })()
      : new THREE.CylinderGeometry(r,r,0.07,18).rotateZ(PI/2);
    var off=new THREE.Color(col).multiplyScalar(0.16);
    var b=new THREE.Mesh(geo, new THREE.MeshStandardMaterial({color:off, emissive:col, emissiveIntensity:0, roughness:0.25, metalness:0}));
    b.position.set(TX-0.15, y, z); S2.add(b); STRIP.tree.bulbs[name]=b;
    var h=new THREE.Sprite(new THREE.SpriteMaterial({map:haloTex, color:col, transparent:true, opacity:0.85, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false}));
    h.position.set(TX-0.3, y, z); var hs=pair?0.55:0.8; h.scale.set(hs,hs,hs); h.userData.s=hs; h.visible=false; S2.add(h); STRIP.tree.halos[name]=h; }
  for(side=-1; side<=1; side+=2){ var bz=side*0.24, tag=side>0?"p":"o";
    bulb(tag+"pre", bulbY.pre, bz, 0xffe9a8, 0.055, true); bulb(tag+"stage", bulbY.stage, bz, 0xffe9a8, 0.055, true);
    bulb(tag+"a1", bulbY.a1, bz, 0xffa01e, 0.13); bulb(tag+"a2", bulbY.a2, bz, 0xffa01e, 0.13); bulb(tag+"a3", bulbY.a3, bz, 0xffa01e, 0.13);
    bulb(tag+"g", bulbY.g, bz, 0x3dff6a, 0.13); bulb(tag+"r", bulbY.r, bz, 0xff2a22, 0.13); }

  /* scoreboards (canvas, redrawn when a time comes in) */
  STRIP.board={};
  for(side=-1; side<=1; side+=2){ var cv=newCanvas(512,256), tx=new THREE.CanvasTexture(cv); tx.encoding=THREE.sRGBEncoding; tx.anisotropy=MAXANISO;
    var bm=new THREE.Mesh(new THREE.PlaneGeometry(8.4,4.2), new THREE.MeshBasicMaterial({map:tx, toneMapped:false, color:0xdddddd}));
    bm.position.set(STRIP_Q+26, 6.7, side*10.8); bm.rotation.y=side<0?-PI/2+0.55:-PI/2-0.55; S2.add(bm);
    STRIP.board[side>0?"p":"o"]={cv:cv, tex:tx, mesh:bm, key:""}; }
  /* v2: round title over both boards: one canvas, both quads in one mesh */
  (function(){ var cv=newCanvas(512,64), tx=new THREE.CanvasTexture(cv); tx.encoding=THREE.sRGBEncoding; tx.anisotropy=MAXANISO; var gs=[];
    for(var sd=-1; sd<=1; sd+=2){ var g=new THREE.PlaneGeometry(8.4,1.05); g.rotateY(sd<0?-PI/2+0.55:-PI/2-0.55); g.translate(STRIP_Q+26, 9.66, sd*10.8); gs.push(g); }
    var pos=new Float32Array(gs[0].attributes.position.array.length*2), uv=new Float32Array(gs[0].attributes.uv.array.length*2), idx=[];
    pos.set(gs[0].attributes.position.array); pos.set(gs[1].attributes.position.array, gs[0].attributes.position.array.length);
    uv.set(gs[0].attributes.uv.array); uv.set(gs[1].attributes.uv.array, gs[0].attributes.uv.array.length);
    var i0=gs[0].index.array, nv=gs[0].attributes.position.count; for(var q=0;q<i0.length;q++) idx.push(i0[q]); for(q=0;q<i0.length;q++) idx.push(i0[q]+nv);
    var gg=new THREE.BufferGeometry(); gg.setAttribute("position",new THREE.BufferAttribute(pos,3)); gg.setAttribute("uv",new THREE.BufferAttribute(uv,2)); gg.setIndex(idx);
    var tm=new THREE.Mesh(gg, new THREE.MeshBasicMaterial({map:tx, toneMapped:false, color:0xdddddd})); S2.add(tm);
    STRIP.title={cv:cv, tex:tx, mesh:tm, key:""}; gs.forEach(function(g){ g.dispose(); }); })();
  stripBoardDraw({}, true);

  /* effects */
  STRIP.fx=new StripFx(lite?420:760, "smoke", stripSmokeTex(), {lit:true, str:true}); S2.add(STRIP.fx.mesh);   /* v3: lit, normal-mapped smoke; stretched jets/cones */
  STRIP.fxFire=new StripFx(lite?140:240, "fire", stripFlameTex(true), {str:true}); S2.add(STRIP.fxFire.mesh);
  STRIP.fxAdd=new StripFx(lite?140:240, "add", haloTex, {str:true}); S2.add(STRIP.fxAdd.mesh);
  STRIP.marks=stripMarksInit(lite?160:260); S2.add(STRIP.marks.mesh);

  stripVenueTier();
  STRIP.cam=new THREE.PerspectiveCamera(46, 1, 0.3, 4200); STRIP.built=true;
  STRIP.night=null; stripSetNight(false);
}
/* ---------------------------------------------------------------------------
   STRIP VENUE (v1.40) — the dressing that makes the strip a real dragstrip: a
   billboard crowd (one draw: stands, pit crews and staging crews), the pits as
   two instanced "pit space" kits (a hauler space and a trailer space, tinted per
   instance), the painted markings atlas the track and ground shaders sample, and
   the per-tier thinning. Everything is ranked once at build; a tier only changes
   instance counts (a prefix of the ranked lists), so switching tiers is free.
   ------------------------------------------------------------------------- */
var STRIP_VENUE_KEEP={ lite:0.55, full:0.8, ultra:1.01 };   /* crowd: share of the (Ultra-density) people kept per tier */
var STRIP_PITS_KEEP={ lite:0.38, full:0.68, ultra:1.01 };    /* pit spaces kept per tier (near the start line first) */
function stripKeep(tbl){ return tbl[GFX]!=null?tbl[GFX]:tbl.full; }

/* --- crowd atlas: 6 poses in 84×256 tiles (1 px = 1 cm, tile bottom = seat ref −0.5 m).
   Channels are masks: R shirt (or the wave card), G skin, B pants (or hair/hat above the pose's head line); R+G+B = shading --- */
function stripCrowdTex(){
  var c=newCanvas(512,256), x=c.getContext("2d"), tx0=0;
  function col(ch,s){ s=Math.round(clamp(s,0,1)*255); return ch===0?"rgb("+s+",0,0)":ch===1?"rgb(0,"+s+",0)":"rgb(0,0,"+s+")"; }
  function X(m){ return tx0+42+m*100; } function Y(m){ return 256-(m+0.5)*100; }
  function rr(ch,s,x0,y0,x1,y1,rad){ var L=X(x0),R=X(x1),T=Y(y1),B=Y(y0),r=Math.min(rad*100,(R-L)/2,(B-T)/2);
    var g=x.createLinearGradient(L,0,R,0); g.addColorStop(0,col(ch,s*0.6)); g.addColorStop(0.42,col(ch,s)); g.addColorStop(1,col(ch,s*0.68)); x.fillStyle=g;
    x.beginPath(); x.moveTo(L+r,T); x.lineTo(R-r,T); x.quadraticCurveTo(R,T,R,T+r); x.lineTo(R,B-r); x.quadraticCurveTo(R,B,R-r,B); x.lineTo(L+r,B); x.quadraticCurveTo(L,B,L,B-r); x.lineTo(L,T+r); x.quadraticCurveTo(L,T,L+r,T); x.fill(); }
  function limb(ch,s,ax,ay,bx,by,w){ x.strokeStyle=col(ch,s); x.lineWidth=w*100; x.lineCap="round"; x.beginPath(); x.moveTo(X(ax),Y(ay)); x.lineTo(X(bx),Y(by)); x.stroke(); }
  function head(cy,lean){ var cx=X(lean||0), cyp=Y(cy); x.fillStyle=col(1,0.86); x.beginPath(); x.ellipse(cx,cyp,9.5,11.5,0,0,TAU); x.fill();
    x.fillStyle=col(1,0.62); x.beginPath(); x.ellipse(cx+3,cyp+1,5,8,0,0,TAU); x.fill();
    x.fillStyle=col(2,0.8); x.beginPath(); x.ellipse(cx,cyp-4,10.4,8.5,0,PI,TAU); x.fill(); x.fillRect(cx-10.4,cyp-4.5,20.8,1.5); }
  function arms(sh, ex, ey, hx, hy, side){ limb(0,0.72,side*0.2,sh,side*ex,ey,0.095); limb(1,0.78,side*ex,ey,side*hx,hy,0.075); }
  function seatedBase(){ rr(2,0.3,-0.2,-0.5,-0.03,-0.42,0.03); rr(2,0.3,0.03,-0.5,0.2,-0.42,0.03);
    rr(2,0.66,-0.17,-0.45,-0.04,0.02,0.05); rr(2,0.66,0.04,-0.45,0.17,0.02,0.05); rr(2,0.85,-0.2,-0.05,0.2,0.1,0.06);
    rr(0,0.92,-0.2,0.04,0.2,0.6,0.08); rr(1,0.7,-0.045,0.55,0.045,0.66,0.02); }
  function standBase(){ rr(2,0.3,-0.19,-0.13,-0.02,-0.05,0.03); rr(2,0.3,0.02,-0.13,0.19,-0.05,0.03);
    rr(2,0.72,-0.17,-0.08,-0.025,0.78,0.05); rr(2,0.72,0.025,-0.08,0.17,0.78,0.05); rr(2,0.8,-0.18,0.6,0.18,0.8,0.05);
    rr(0,0.92,-0.21,0.72,0.21,1.33,0.08); rr(1,0.7,-0.045,1.28,0.045,1.39,0.02); }
  /* 0 seated, arms on knees */
  tx0=0; seatedBase(); arms(0.52,0.25,0.24,0.15,0.06,-1); arms(0.52,0.25,0.24,0.15,0.06,1); head(0.75);
  /* 1 seated, phone/drink up */
  tx0=84; seatedBase(); arms(0.52,0.25,0.24,0.14,0.06,-1); arms(0.52,0.27,0.3,0.2,0.6,1); rr(2,0.25,0.15,0.57,0.24,0.7,0.01); head(0.75,-0.01);
  /* 2 standing */
  tx0=168; standBase(); arms(1.27,0.26,0.98,0.27,0.72,-1); arms(1.27,0.26,0.98,0.25,0.72,1); head(1.48);
  /* 3 standing, arms up */
  tx0=252; standBase(); arms(1.27,0.32,1.55,0.36,1.86,-1); arms(1.27,0.32,1.55,0.36,1.86,1); head(1.48);
  /* 4 standing, card up (the R block takes the card colour) */
  tx0=336; standBase(); arms(1.27,0.24,1.58,0.24,1.8,-1); arms(1.27,0.24,1.58,0.24,1.8,1); head(1.48); rr(0,1.0,-0.31,1.68,0.31,2.03,0.012);
  /* 5 crew, hands on hips */
  tx0=420; standBase(); arms(1.27,0.35,1.06,0.2,0.86,-1); arms(1.27,0.35,1.06,0.2,0.86,1); head(1.48);
  var t=new THREE.CanvasTexture(c); t.anisotropy=Math.min(4,MAXANISO); return t;
}
/* billboard crowd material: cylindrical billboards in the vertex shader, pose + bounce + sway + card wave all on the GPU */
function stripCrowdMat(){
  var m=new THREE.MeshStandardMaterial({roughness:0.92, metalness:0}), tex=stripCrowdTex();
  var U={ uCrowd:STRIP_VU.uCrowd, uCrowdTex:{value:tex}, uCrowdLit:STRIP_U.uCrowdLit, uCard0:{value:STRIP_VU.cards[0]}, uCard1:{value:STRIP_VU.cards[1]}, uCard2:{value:STRIP_VU.cards[2]} };
  m.onBeforeCompile=function(sh){ for(var k in U) sh.uniforms[k]=U[k];
    sh.vertexShader=sh.vertexShader.replace("#include <common>", ["#include <common>",
      "attribute vec4 aCw; attribute vec3 aShirt; attribute vec3 aSkin; attribute vec3 aHat; uniform vec4 uCrowd; uniform vec3 uCard0; uniform vec3 uCard1; uniform vec3 uCard2;",
      "varying vec3 vShirt; varying vec3 vSkin; varying vec3 vHat; varying vec3 vPants; varying vec2 vCuv; varying float vHl;"].join("\n"))
    .replace("#include <beginnormal_vertex>", [
      "vec3 cC=(modelMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz; vec3 toC=cameraPosition-cC; vec3 rt=normalize(vec3(toC.z,0.0,-toC.x)+vec3(1e-4,0.0,0.0));",
      "float tt=uCrowd.x, amp=uCrowd.y, ph=aCw.x, ex=aCw.y, pit=step(aCw.w,-0.5), hs=fract(ph*7.31);",
      "float on=(1.0-pit)*step(0.02,amp)*step(amp>1.0?0.04:0.3,ex);",
      "float by=on*abs(sin(tt*(amp>1.0?10.0:8.0)+ph))*0.18*min(amp,2.0)*ex;",
      "float wdx=mod(aCw.z-uCrowd.z+37.5,75.0)-37.5; float wb=(1.0-pit)*uCrowd.w*exp(-wdx*wdx/14.0); by+=0.36*wb;",
      "float pose=pit>0.5?(hs<0.45?2.0:5.0):(wb>0.3?4.0:(on>0.5?((amp>1.0&&ex>0.55)?3.0:2.0):(hs<0.72?0.0:1.0)));",
      "float yy=position.y+0.5, sway=sin(tt*(1.2+0.7*hs)+ph*3.0)*(0.02+0.05*on)*(1.0-pit*0.5);",
      "vec3 crowdPos=rt*(position.x*0.84+sway*yy*yy*1.6)+vec3(0.0,-0.5+yy*2.56+by,0.0);",
      "vCuv=vec2((pose+position.x+0.5)*84.0/512.0, uv.y); vHl=pose<1.5?0.469:0.754;",
      "vec3 card=aCw.w<0.5?uCard0:(aCw.w<1.5?uCard1:uCard2); vShirt=mix(aShirt,card,clamp(wb*1.4,0.0,1.0)); vSkin=aSkin; vHat=aHat;",
      "float hp=fract(ph*3.17); vPants=hp<0.55?vec3(0.03,0.045,0.09):(hp<0.8?vec3(0.02,0.02,0.022):vec3(0.17,0.14,0.085));",
      "vec3 objectNormal=pit>0.5?normalize(vec3(toC.x,0.0,toC.z)/max(length(toC.xz),1e-3)+vec3(0.0,0.5,0.0)):normalize(vec3(0.0,0.45,cC.z<0.0?1.0:-1.0));",
      "#ifdef USE_TANGENT\nvec3 objectTangent=vec3(1.0,0.0,0.0);\n#endif"].join("\n"))
    .replace("#include <begin_vertex>", "vec3 transformed=crowdPos;");
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>", ["#include <common>",
      "uniform sampler2D uCrowdTex; uniform float uCrowdLit; varying vec3 vShirt; varying vec3 vSkin; varying vec3 vHat; varying vec3 vPants; varying vec2 vCuv; varying float vHl;"].join("\n"))
    .replace("#include <map_fragment>", ["vec4 ctx=texture2D(uCrowdTex,vCuv); if(ctx.a<0.42) discard;",
      "float csh=ctx.r+ctx.g+ctx.b; vec3 cwt=ctx.rgb/max(csh,1e-3);",
      "diffuseColor.rgb=(cwt.r*vShirt+cwt.g*vSkin+cwt.b*(vCuv.y>vHl?vHat:vPants))*min(csh,1.0);"].join("\n"))
    .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*uCrowdLit;");
  };
  m.customProgramCacheKey=function(){ return "stripCrowdBB"; };
  return m;
}
var STRIP_VU={ uCrowd:{value:new THREE.Vector4(0,0,0,0)}, cards:[0x1d4787,0xd9a52b,0xf3efe4].map(function(h){ return new THREE.Color(h).convertSRGBToLinear(); }) };
var STRIP_SHIRTS=[0x9c3a30,0x34598f,0xcfccc4,0x1f2023,0x2a2c30,0xb7652a,0x44684a,0xc8a640,0x5d5f66,0x7a7f86,0x3a3d44,0x8f4a5e,0xd8d4ca,0x1d4787,0xb7261d],
    STRIP_SKIN=[0xe0b494,0xc68a64,0x8d5a3b,0xf0c9a8,0x5a3a26], STRIP_HATS=[0x1d4787,0xb7261d,0x222222,0xe9e6dc,0x2c6b3a,0xe5701f], STRIP_HAIR=[0x1a1410,0x3a2616,0x6b4a2a,0x8c8a86,0xb08a50,0x120f0d];
/* people: [{p:[x,refY,z], r:rank, xx:wave x, card:0..2 or -1 (pits/staging: standing, no bounce/wave), stand:bool}] */
function stripBuildCrowd(S2, ppl, rng){
  ppl.sort(function(a,b){ return a.r-b.r; });
  var n=ppl.length, g=new THREE.PlaneGeometry(1,1), i, cc=new THREE.Color();
  var aCw=new Float32Array(n*4), aSh=new Float32Array(n*3), aSk=new Float32Array(n*3), aHt=new Float32Array(n*3);
  function put(arr,i,hex){ cc.set(hex).convertSRGBToLinear(); arr[i*3]=cc.r; arr[i*3+1]=cc.g; arr[i*3+2]=cc.b; }
  var mesh=new THREE.InstancedMesh(g, stripCrowdMat(), n), mm=new THREE.Matrix4(), base=[], mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9];
  for(i=0;i<n;i++){ var q=ppl[i], p=q.p; mm.makeTranslation(p[0],p[1],p[2]); mesh.setMatrixAt(i,mm);
    aCw[i*4]=rng(i*9.1+0.3)*TAU; aCw[i*4+1]=q.card<0?0:rng(i*5.3+0.7); aCw[i*4+2]=q.xx||0; aCw[i*4+3]=q.card;
    put(aSh,i,STRIP_SHIRTS[Math.floor(rng(i*1.3+0.1)*STRIP_SHIRTS.length)]); put(aSk,i,STRIP_SKIN[Math.floor(rng(i*3.7+0.2)*STRIP_SKIN.length)]);
    put(aHt,i,rng(i*2.9+0.4)<(q.card<0?0.55:0.35)?STRIP_HATS[Math.floor(rng(i*4.1)*STRIP_HATS.length)]:STRIP_HAIR[Math.floor(rng(i*6.7)*STRIP_HAIR.length)]);
    if(q.stand) base.push(p);
    for(var k=0;k<3;k++){ mn[k]=Math.min(mn[k],p[k]); mx[k]=Math.max(mx[k],p[k]); } }
  g.setAttribute("aCw", new THREE.InstancedBufferAttribute(aCw,4)); g.setAttribute("aShirt", new THREE.InstancedBufferAttribute(aSh,3));
  g.setAttribute("aSkin", new THREE.InstancedBufferAttribute(aSk,3)); g.setAttribute("aHat", new THREE.InstancedBufferAttribute(aHt,3));
  var ctr=new THREE.Vector3((mn[0]+mx[0])/2,(mn[1]+mx[1])/2+1,(mn[2]+mx[2])/2);
  g.boundingSphere=new THREE.Sphere(ctr, ctr.distanceTo(new THREE.Vector3(mx[0],mx[1]+2.2,mx[2]))+1);
  mesh.castShadow=false; mesh.receiveShadow=true; mesh.frustumCulled=true; S2.add(mesh);   /* r128 leaves InstancedMesh unculled; the sphere above holds every one */
  var rk=ppl.map(function(q){ return q.r; }), sr=[]; for(i=0;i<n;i++) if(ppl[i].stand) sr.push(ppl[i].r);
  return { mesh:mesh, body:mesh, base:base, n:base.length, ranks:rk, standRanks:sr, live:false, wave:false, u:STRIP_VU.uCrowd, tier:null };
}

/* --- instanced kits: unit primitives (StripBatch geometry names) merged into one geometry with a per-vertex paint slot;
   colour "1"/"2" = tinted per instance (iT1/iT2), anything else is a fixed vertex colour --- */
function stripKitGeo(items){
  var G=sbGeo(), n=0, i, j; items.forEach(function(it){ n+=G[it[0]].attributes.position.count; });
  var pos=new Float32Array(n*3), nor=new Float32Array(n*3), col=new Float32Array(n*3), pnt=new Float32Array(n), o=0, m=new THREE.Matrix4(), nm=new THREE.Matrix3(), v=new THREE.Vector3(), c=new THREE.Color();
  for(i=0;i<items.length;i++){ var it=items[i], g=G[it[0]], P=g.attributes.position, N=g.attributes.normal, r=it[4];
    _sbE.set(r?r[0]:0, r?r[1]:0, r?r[2]:0); _sbQ.setFromEuler(_sbE); m.compose(_sbP.set(it[1][0],it[1][1],it[1][2]), _sbQ, _sbS.set(it[2][0],it[2][1],it[2][2])); nm.getNormalMatrix(m);
    var tint=(it[3]==="1")?1:(it[3]==="2")?2:0; if(tint) c.setRGB(1,1,1); else c.set(it[3]).convertSRGBToLinear();
    for(j=0;j<P.count;j++,o++){ v.fromBufferAttribute(P,j).applyMatrix4(m); pos[o*3]=v.x; pos[o*3+1]=v.y; pos[o*3+2]=v.z;
      v.fromBufferAttribute(N,j).applyMatrix3(nm).normalize(); nor[o*3]=v.x; nor[o*3+1]=v.y; nor[o*3+2]=v.z; col[o*3]=c.r; col[o*3+1]=c.g; col[o*3+2]=c.b; pnt[o]=tint; } }
  var geo=new THREE.BufferGeometry(); geo.setAttribute("position",new THREE.BufferAttribute(pos,3)); geo.setAttribute("normal",new THREE.BufferAttribute(nor,3));
  geo.setAttribute("color",new THREE.BufferAttribute(col,3)); geo.setAttribute("aPaint",new THREE.BufferAttribute(pnt,1)); return geo;
}
function stripKitMat(){
  var m=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.62, metalness:0.08});
  m.onBeforeCompile=function(sh){ sh.vertexShader=sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float aPaint; attribute vec3 iT1; attribute vec3 iT2;")
    .replace("#include <color_vertex>", "#include <color_vertex>\nvColor.rgb*=aPaint>1.5?iT2:(aPaint>0.5?iT1:vec3(1.0));"); };
  m.customProgramCacheKey=function(){ return "stripKit"; };
  return m;
}
/* inst: [{x,z,ry,c1,c2,r}] sorted by rank r here; returns {mesh, ranks} */
function stripKitMesh(S2, items, inst, mat){
  inst.sort(function(a,b){ return a.r-b.r; });
  var geo=stripKitGeo(items), n=inst.length, t1=new Float32Array(n*3), t2=new Float32Array(n*3), mesh=new THREE.InstancedMesh(geo, mat, n), mm=new THREE.Matrix4(), c=new THREE.Color(), i;
  geo.computeBoundingSphere(); var kr=geo.boundingSphere.radius+geo.boundingSphere.center.length(), mn=[1e9,1e9], mx=[-1e9,-1e9];
  for(i=0;i<n;i++){ var q=inst[i]; _sbQ.setFromAxisAngle(_sbS.set(0,1,0), q.ry); mm.compose(_sbP.set(q.x,0,q.z), _sbQ, _sbS.set(1,1,1)); mesh.setMatrixAt(i,mm);
    c.set(q.c1).convertSRGBToLinear(); t1[i*3]=c.r; t1[i*3+1]=c.g; t1[i*3+2]=c.b; c.set(q.c2).convertSRGBToLinear(); t2[i*3]=c.r; t2[i*3+1]=c.g; t2[i*3+2]=c.b;
    mn[0]=Math.min(mn[0],q.x); mn[1]=Math.min(mn[1],q.z); mx[0]=Math.max(mx[0],q.x); mx[1]=Math.max(mx[1],q.z); }
  geo.setAttribute("iT1", new THREE.InstancedBufferAttribute(t1,3)); geo.setAttribute("iT2", new THREE.InstancedBufferAttribute(t2,3));
  var ctr=new THREE.Vector3((mn[0]+mx[0])/2, 2, (mn[1]+mx[1])/2); geo.boundingSphere=new THREE.Sphere(ctr, Math.hypot(mx[0]-mn[0], mx[1]-mn[1])/2+kr);
  mesh.receiveShadow=true; mesh.castShadow=false; mesh.frustumCulled=true; S2.add(mesh);   /* the pits sit outside the sun's 60 m shadow box; at night each spot would redraw them */
  return { mesh:mesh, ranks:inst.map(function(q){ return q.r; }) };
}
/* the two pit spaces (local: length along x, the work side toward +z) */
function stripKitHauler(){
  var K=[], DK=0x1c1d1f, CH=0xb9bdc1, GL=0x1b2228, ST=0x9aa0a6;
  function b(x,y,z,w,h,d,c,r){ K.push(["box",[x,y,z],[w,h,d],c,r||null]); }
  function wh(x,z,dia,w){ K.push(["cyl6",[x,dia/2,z],[dia,w,dia],DK,[PI/2,0,0]]); }
  b(0,0.95,0,14,0.3,2.2,DK); b(0,2.55,0,14.6,2.95,2.55,"1"); b(0,1.42,0,14.62,0.2,2.57,"2"); b(0,3.95,0,14.62,0.12,2.57,"2");
  wh(-5.4,0,1.0,2.45); wh(-4.3,0,1.0,2.45);
  b(7.55,2.45,0,1.8,2.7,2.45,"1"); b(9.25,2.15,0,1.7,2.1,2.45,"1"); b(10.12,2.55,0,0.06,0.8,2.1,GL); b(10.85,1.5,0,1.5,1.05,2.3,"1"); b(11.65,0.85,0,0.25,0.45,2.5,CH);
  b(9.2,0.85,0,5.6,0.35,1.1,DK); wh(10.6,0,1.0,2.4); wh(8.3,0,1.0,2.4);
  K.push(["cyl6",[8.45,3.7,1.3],[0.16,2.4,0.16],CH,null]); K.push(["cyl6",[8.45,3.7,-1.3],[0.16,2.4,0.16],CH,null]);
  b(0,3.7,2.95,12.5,0.07,3.4,"2",[0.1,0,0]); K.push(["cyl6",[-5.9,1.75,4.5],[0.08,3.5,0.08],ST,null]); K.push(["cyl6",[5.9,1.75,4.5],[0.08,3.5,0.08],ST,null]);
  b(0,0.012,3.4,12,0.025,4.4,0x2e3033); b(-4.4,0.55,1.75,1.6,1.1,0.6,0xa8241e); b(-2.6,0.45,1.7,1.0,0.9,0.55,0x2a2c30); K.push(["cyl6",[4.6,0.55,1.85],[0.72,1.1,0.72],0x161617,null]);
  /* the race car on stands under the awning */
  b(0.5,0.68,3.95,4.5,0.5,1.75,"1"); b(0.2,1.1,3.95,1.5,0.4,1.3,GL); b(-1.75,1.3,3.95,0.4,0.06,1.6,"2"); b(-1.65,1.0,3.95,0.08,0.6,1.0,DK);
  wh(-0.9,3.0,0.8,0.36); wh(-0.9,4.9,0.8,0.36); wh(2.3,3.12,0.6,0.22); wh(2.3,4.78,0.6,0.22);
  return K;
}
function stripKitTrailer(){
  var K=[], DK=0x1c1d1f, CH=0xb9bdc1, GL=0x1b2228, ST=0x9aa0a6, WH=0xe6e4dc;
  function b(x,y,z,w,h,d,c,r){ K.push(["box",[x,y,z],[w,h,d],c,r||null]); }
  function wh(x,z,dia,w){ K.push(["cyl6",[x,dia/2,z],[dia,w,dia],DK,[PI/2,0,0]]); }
  /* enclosed car trailer + pickup on the hitch */
  b(-2,1.75,0,7.3,2.3,2.45,"1"); b(-2,0.95,0,7.32,0.14,2.47,"2"); b(-2,0.56,0,7.0,0.2,2.0,DK); wh(-1.6,0,0.7,2.5); wh(-2.5,0,0.7,2.5); b(2.3,0.55,0,1.6,0.12,0.15,DK);
  b(5.2,0.78,0,5.4,0.55,1.95,"2"); b(3.95,1.25,0,2.3,0.42,1.95,"2"); b(5.9,1.45,0,1.6,0.82,1.85,"2"); b(6.72,1.5,0,0.05,0.6,1.7,GL); b(7.95,0.66,0,0.12,0.3,1.95,CH);
  wh(3.6,0,0.8,1.95); wh(6.95,0,0.8,1.95);
  /* pop-up canopy, the car under it, a cooler */
  K.push(["cone",[-2,2.98,3.8],[4.24,0.56,4.24],"1",[0,PI/4,0]]); b(-2,2.6,3.8,3.0,0.22,3.0,"1");
  for(var k=0;k<4;k++) K.push(["cyl6",[-2+((k&1)?1.45:-1.45),1.25,3.8+((k&2)?1.45:-1.45)],[0.05,2.5,0.05],ST,null]);
  b(-2,0.012,3.8,3.2,0.02,3.2,0x2e3033);
  b(-2,0.62,3.8,4.2,0.48,1.7,"2"); b(-2.2,1.03,3.8,1.4,0.38,1.25,GL); wh(-3.3,2.95,0.72,0.32); wh(-3.3,4.65,0.72,0.32); wh(-0.6,3.0,0.6,0.22); wh(-0.6,4.6,0.6,0.22);
  b(0.4,0.3,2.4,0.65,0.5,0.42,0x2058a8);
  /* golf cart */
  b(3.6,0.5,4.4,1.9,0.42,1.1,WH); b(3.25,0.95,4.4,0.3,0.5,1.0,0x2a2c30); b(3.6,1.85,4.4,2.0,0.05,1.15,"1");
  for(k=0;k<4;k++) K.push(["cyl6",[3.6+((k&1)?0.85:-0.85),1.32,4.4+((k&2)?0.5:-0.5)],[0.04,1.06,0.04],ST,null]);
  wh(2.95,3.85,0.45,0.18); wh(2.95,4.95,0.45,0.18); wh(4.25,3.85,0.45,0.18); wh(4.25,4.95,0.45,0.18);
  return K;
}
/* the pits: rows of pit spaces on the near side (x −150…330, z 19…64), crews standing about in each */
function stripBuildPits(S2, B, ppl, rng){
  var A=[], T=[], hcol=[0xe9e6dc,0x1b1d20,0x9e2a22,0x22488f,0xd0d3d6,0x2c6b3a,0xe5701f,0x5b2a86,0xc8a640,0x2a2c30],
      acc=[0xd9a52b,0xe9e6dc,0xb7261d,0x1d4787,0x141414,0xe5701f], rows=[24,41,58], ri, slot=0;
  for(ri=0;ri<rows.length;ri++){ var cx=-150+rng(ri*7.7)*6;
    while(cx<322){ var big=rng(slot*3.3+ri)<0.42, len=big?24:19, sx=cx+len/2, gap=2+rng(slot*1.9)*5; cx+=len+gap; slot++;
      if(rng(slot*4.7+1.1)<0.1) continue;   /* an empty space here and there */
      var flip=rng(slot*2.2)<0.5, ry=(flip?PI:0)+(rng(slot*6.1)-0.5)*0.08, z=rows[ri]+(rng(slot*8.3)-0.5)*1.5;
      var r=0.62*rng(slot*5.9+0.4)+0.38*clamp(Math.abs(sx-40)/320+ri*0.12,0,1);
      var q={x:sx, z:z, ry:ry, c1:hcol[Math.floor(rng(slot*1.7)*hcol.length)], c2:acc[Math.floor(rng(slot*2.7)*acc.length)], r:r};
      (big?A:T).push(q);
      /* livery on the haulers every tier keeps (signs ride the static batch, so only where the hauler is always drawn) */
      if(big && r<STRIP_PITS_KEEP.lite && slot%2===0){ var cs=Math.cos(ry), sn2=Math.sin(ry), lz=1.29;
        B.add("sign","plane",[sx-lz*sn2, 2.45, z+lz*cs],[9,2.1,1],0xffffff,[0,ry,0],STRIP_UV.haul[slot%4<2?0:1]); }
      /* crew: 2-4 people on the work side */
      var nc=2+Math.floor(rng(slot*3.9)*3), cs2=Math.cos(ry), sn3=Math.sin(ry);
      for(var k=0;k<nc;k++){ var lx=(rng(slot*11+k)-0.5)*(big?11:7)+(big?0:-1), lz2=1.6+rng(slot*13+k*1.7)*4.2;
        ppl.push({p:[sx+lx*cs2+lz2*sn3, 0.12, z-lx*sn3+lz2*cs2], r:r+0.001*k, card:-1}); } } }
  /* a few walking the return road / pit lane */
  for(var w=0;w<26;w++){ var wr=rng(w*7.3+40); ppl.push({p:[-130+rng(w*3.1+9)*440, 0.12, 17.6+rng(w*5.7+3)*1.6], r:wr, card:-1}); }
  var mat=stripKitMat();
  var KA=stripKitMesh(S2, stripKitHauler(), A, mat), KT=stripKitMesh(S2, stripKitTrailer(), T, mat);
  return [KA, KT];
}
/* staging lanes behind the tree (inside the walls, x −76…−31) and the holding apron behind the strip: cars waiting, crews with them */
function stripBuildStaging(B, ppl, rng){
  var cols=[0xb3261e,0x1f4fa8,0xe2b21b,0xe6e4de,0x16181b,0xd85f14,0x5b2a86,0x1e6a3b,0xa9aeb5,0x7a1f2a,0x2b7fae];
  function car(x, z, col, k){ var GL=0x2b3742, DK=0x161617;
    var lo=k===1?0.5:0.62, L=k===1?5.2:4.5;
    B.box("solid", x, lo, z, L, 0.55, 1.85, col); B.box("solid", x-0.35, lo+0.44, z, 1.5, 0.34, 1.36, GL); B.box("solid", x-0.45, lo+0.63, z, 1.1, 0.05, 1.3, col); B.box("solid", x+0.6, lo+0.3, z, 1.3, 0.06, 1.7, col);
    if(k===1){ B.box("solid", x-L/2+0.25, lo+0.75, z, 0.45, 0.06, 1.7, col); B.box("solid", x-L/2+0.3, lo+0.45, z, 0.06, 0.55, 1.1, DK); }
    var rw=k===1?0.86:0.72, fw=k===1?0.56:0.66;
    B.add("solid","cyl6",[x-L/2+0.95, rw/2, z+0.82],[rw,0.36,rw],DK,[PI/2,0,0]); B.add("solid","cyl6",[x-L/2+0.95, rw/2, z-0.82],[rw,0.36,rw],DK,[PI/2,0,0]);
    B.add("solid","cyl6",[x+L/2-0.85, fw/2, z+0.8],[fw,0.24,fw],DK,[PI/2,0,0]); B.add("solid","cyl6",[x+L/2-0.85, fw/2, z-0.8],[fw,0.24,fw],DK,[PI/2,0,0]); }
  var lanes=[-5.6,-1.87,1.87,5.6], q=[3,2,3,1], i, j, s=0;
  for(i=0;i<4;i++) for(j=0;j<q[i];j++,s++){ var x=-39-j*8.5-rng(s*2.1)*1.5;
    car(x, lanes[i]+(rng(s*3.3)-0.5)*0.3, cols[(s*3+i)%cols.length], rng(s*5.1)<0.45?1:0);
    if(rng(s*7.7)<0.7) ppl.push({p:[x+(rng(s)-0.5)*3, 0.12, lanes[i]+(i<2?1.35:-1.35)], r:rng(s*9.9)*0.3, card:-1}); }
  /* holding apron behind the strip (x −150…−82): two rows of cars nose to tail */
  for(i=0;i<9;i++){ var hx=-92-i*6.8, hz=(i%2?-1:1)*(3.2+rng(i*1.3)*1.2)+(i>4?(i%2?-4.5:4.5):0);
    car(hx, hz, cols[(i*5+2)%cols.length], i%3===0?1:0);
    if(i%2===0) ppl.push({p:[hx+1.5, 0.12, hz+(hz>0?1.4:-1.4)], r:0.2+rng(i*4.4)*0.6, card:-1}); }
}
/* painted markings atlas (white on black, sampled as a mask): top row 8 cells 128×256 ("1"…"4", arrow), bottom row two 512×256 words */
function stripDecalTex(){
  var c=newCanvas(1024,512), x=c.getContext("2d"), F="'Barlow Condensed','Arial Narrow',Arial,sans-serif", i;
  x.fillStyle="#000"; x.fillRect(0,0,1024,512); x.fillStyle="#fff"; x.textAlign="center"; x.textBaseline="middle";
  var dg=["1","2","3","4"]; x.font="700 230px "+F;
  for(i=0;i<4;i++){ x.save(); x.translate(i*128+64, 134); x.scale(0.62,1); x.fillText(dg[i],0,0); x.restore(); }
  /* arrow pointing "far" (canvas up) */
  x.beginPath(); x.moveTo(4*128+64, 18); x.lineTo(4*128+116, 104); x.lineTo(4*128+82, 104); x.lineTo(4*128+82, 238); x.lineTo(4*128+46, 238); x.lineTo(4*128+46, 104); x.lineTo(4*128+12, 104); x.closePath(); x.fill();
  x.font="700 150px "+F; var w=["RETURN","SLOW"];
  for(i=0;i<2;i++){ x.save(); x.translate(i*512+256, 384); x.scale(0.82,1.45); x.fillText(w[i],0,0); x.restore(); }
  var t=new THREE.CanvasTexture(c); t.anisotropy=MAXANISO; return t;
}
/* tier: instance counts are prefixes of the ranked lists */
function stripVenueTier(){
  var C=STRIP.crowd, k;
  if(C){ C.tier=GFX; k=stripKeep(STRIP_VENUE_KEEP); var n=0; while(n<C.ranks.length && C.ranks[n]<k) n++; C.mesh.count=n;
    var ns=0; while(ns<C.standRanks.length && C.standRanks[ns]<k) ns++; C.n=Math.max(1,ns); }
  (STRIP.kits||[]).forEach(function(K){ var kk=stripKeep(STRIP_PITS_KEEP), n=0; while(n<K.ranks.length && K.ranks[n]<kk) n++;
    K.mesh.count=n; K.mesh.visible=n>0; });
}
/* ---------------------------------------------------------------------------
   DRAG CARS (v1.5) — procedural car models for the strip.
   Bodies are lofted from cross-sections (sc_loft), tyres are lathed, rims /
   wings / scoops are extruded 2D shapes. Units metres, +x forward, y up,
   +z to the car's right. Geometry is cached per body + tyre size and shared
   by both lanes; only paint, lamps and door decals are per car.
   stripCarAnim() animates wheels, tyre wrinkle, pitch, chute and lamps.
   -------------------------------------------------------------------------*/
var SC = { geo:{}, tex:{}, mat:null, paint:{}, env:null };
var SC_F = ["zb","ys","yt","w","wt","cr"];
var _scA=new THREE.Vector3(), _scB=new THREE.Vector3(), _scC=new THREE.Vector3(), _scX=new THREE.Vector3(1,0,0), _scY=new THREE.Vector3(0,1,0), _scO=new THREE.Vector3();
function stripCar(body, color, tyreIn, hw){
  if(!SC_BODY_TYRE[body]) body="street";
  var tIn=clamp(+tyreIn||SC_BODY_TYRE[body], 20, 40);
  var H=sc_hw(hw, body);
  var P=sc_pack(body, Math.round(tIn*4)/4, H), M=sc_mats(), me=P.meta;
  var paint=sc_paint(color===undefined?0xa32a26:color);
  var tail=new THREE.MeshStandardMaterial({color:sc(0x4a0707), roughness:0.25, metalness:0.1, emissive:new THREE.Color(0xff1a0a), emissiveIntensity:0});
  var head=new THREE.MeshStandardMaterial({color:sc(0xc9ced4), roughness:0.12, metalness:0.55, emissive:new THREE.Color(0xfff1d8), emissiveIntensity:0});
  var g=new THREE.Group(); g.name="stripCar";
  var bodyG=new THREE.Group(); bodyG.position.set(me.xr, me.rr-scRide(me, body), 0); g.add(bodyG);   /* scRide: the fix pack's lower ride height */
  var inner=new THREE.Group(); inner.position.set(-me.xr, -me.rr, 0); bodyG.add(inner);
  var k, mesh;
  var drv=null, DRV={drvSuit:M.suit, drvHelm:paint, drvVisor:M.visor};
  for(k in P.parts){
    if(DRV[k]){ if(!drv){ drv=new THREE.Group(); drv.name="sc_driver"; inner.add(drv); }
      mesh=new THREE.Mesh(P.parts[k], DRV[k]); mesh.name="sc_"+k; mesh.castShadow=true; drv.add(mesh); continue; }
    var mat = k==="paint"?paint : (M[k]||M.black);
    mesh=new THREE.Mesh(P.parts[k], mat); mesh.name="sc_"+k; mesh.castShadow=(k!=="glass"&&k!=="glassT"); mesh.receiveShadow=true; inner.add(mesh);
  }
  if(P.liner && P.parts.paint){ mesh=new THREE.Mesh(P.parts.paint, M.liner); mesh.name="sc_liner"; mesh.receiveShadow=true; inner.add(mesh); }   /* the body's inside, seen through the open windows */
  /* v3: a flip-up body (funny car) is its own group hinged at the back, so the pits can lift it (userData.flip) */
  var flip=null;
  if(P.flip){ flip=new THREE.Group(); flip.name="sc_flip"; flip.position.copy(me.hinge); inner.add(flip);
    var fi=new THREE.Group(); fi.position.copy(me.hinge).negate(); flip.add(fi);
    for(k in P.flip){ mesh=new THREE.Mesh(P.flip[k], k==="paint"?paint:(M[k]||M.black)); mesh.name="sc_f"+k; mesh.castShadow=(k!=="glass"); mesh.receiveShadow=true; fi.add(mesh); } }
  var lights={brake:[], head:[]};
  if(P.tail){ mesh=new THREE.Mesh(P.tail, tail); inner.add(mesh); lights.brake.push(mesh); }
  if(P.head){ mesh=new THREE.Mesh(P.head, head); inner.add(mesh); lights.head.push(mesh); }
  /* door number + sponsor decals: number is picked from the paint so the two lanes differ */
  var num=String(((color>>>0)%89)+11), dm=sc_decalMat(num, color, "door"), bm=sc_decalMat("", color, "banner");
  var liv={num:num, color:color, dm:dm, bm:bm, door:[], banner:[], hood:null, key:""};   /* sponsor livery (stripLivery) */
  for(var d=0; d<P.decals.length; d++){ mesh=new THREE.Mesh(P.decals[d].g, P.decals[d].kind==="banner"?bm:dm); mesh.renderOrder=2; (flip&&P.decals[d].flip?flip.children[0]:inner).add(mesh); (P.decals[d].kind==="banner"?liv.banner:liv.door).push(mesh); }
  if(P.hood){ liv.hood=new THREE.Mesh(P.hood, dm); liv.hood.visible=false; liv.hood.renderOrder=3; (flip?flip.children[0]:inner).add(liv.hood); }
  /* wheels: carrier (squash / lift) -> tyre holder (never spins, tyres are round) + spin group (rim, lettering) */
  var wheels=[], carriers=[];
  for(var w=0; w<me.wheels.length; w++){
    var ws=me.wheels[w], car=sc_wheel(ws, M);
    car.position.set(ws.x, ws.r, ws.z); g.add(car); carriers.push(car); wheels.push(car.userData.spin);
  }
  /* parachute */
  var chute=sc_chute(me, M); chute.position.copy(me.anchor); chute.visible=false; inner.add(chute);
  /* outlets: *Rest in the body group's frame; the live copies (car frame, at rest here) are moved by stripCarAnim every
     frame so the flames and smoke leave the pipes where they are, wheelie and squat included */
  bodyG.updateMatrix();
  var tips=[], dirs=[], tipR=[], dirR=[], BM=bodyG.matrix;
  for(var t=0;t<me.tips.length;t++){ tipR.push(me.tips[t].clone().add(inner.position)); dirR.push(me.dirs[t].clone().normalize()); tips.push(tipR[t].clone().applyMatrix4(BM)); dirs.push(dirR[t].clone()); }
  /* v3: header flame anchors (every primary of a nitro car; body frame, follow the pitch like the exhaust tips) */
  var fl=me.flames||[], fT=[], fD=[], fTR=[], fDR=[];
  for(t=0;t<fl.length;t++){ fTR.push(fl[t].p.clone().add(inner.position)); fDR.push(fl[t].d.clone().normalize()); fT.push(fTR[t].clone().applyMatrix4(BM)); fD.push(fDR[t].clone()); }
  var gR=(me.gates||[]).map(function(q){ return {p:q.p.clone().add(inner.position), d:q.d.clone().normalize()}; }),
      gL=gR.map(function(q){ return {p:q.p.clone().applyMatrix4(BM), d:q.d.clone()}; }),
      hR=me.hat?me.hat.clone().add(inner.position):null, hL=hR?hR.clone().applyMatrix4(BM):null;
  g.userData={ driver:drv, body:body, hw:H, rr:me.rr, fr:me.fr, wheels:wheels, carriers:carriers, chute:chute, exhaustTips:tips, exhaustDirs:dirs, flameTips:fT, flameDirs:fD, flip:flip,
    gates:gL, hat:hL, enginePos:me.eng?me.eng.clone():undefined, style:H?H.style:"",
    chuteAnchor:me.anchor.clone(), lights:lights, bodyGroup:bodyG, meta:me, paint:paint, lampMats:{tail:tail, head:head}, liv:liv,
    anim:{ pitch:0, pv:0, sq:0, sqv:0, roll:0, lastV:0, accF:0, shifting:false, chT:0, chC:0, chS:0, tailI:-1, headI:-1,
      tipRest:tipR, dirRest:dirR, flameRest:fTR, flameDirRest:fDR, gateRest:gR, hatRest:hR, anchorRest:me.anchor.clone().add(inner.position) } };
  g.traverse(function(q){ if(q.geometry) q.geometry.__cached=true; });   /* shared by both lanes + later rebuilds: disposeTree must skip them */
  return g;
}

/* --- per-frame animation (no allocations) --------------------------------- */
/* the setup sheet's lean on a road / hill car (after stripCarAnim): su = {dive, lf, lr} from ENGINE_SIM.setupVis, lateral and
   longitudinal g. Soft cars dive harder under braking and squat more on the power; a stiff axle lifts its inside wheel when
   it is pushed past about 0.8 g. Stock (su null) leaves the car exactly as stripCarAnim made it. S = the caller's smoothing state. */
function stripSetupLean(car, su, ayg, axg, S, dt){
  if(!su) return;
  var U=car.userData, B=U.bodyGroup, i, k=Math.min(1,dt*6);
  S.dv+=(clamp(axg,-1.4,0.6)*0.03*(su.dive-1)-S.dv)*k; B.rotation.z+=S.dv;
  var m=clamp((Math.abs(ayg)-0.8)/0.7,0,1)*0.10, inner=ayg>=0?-1:1;
  S.lf+=(su.lf*m-S.lf)*k; S.lr+=(su.lr*m-S.lr)*k;
  for(i=0;i<U.carriers.length;i++){ var Cw=U.carriers[i]; if(Cw.position.z*inner>0) Cw.position.y+=Cw.userData.rear?S.lr:S.lf; }
  B.updateMatrix();
}
function stripCarAnim(car, o, dt, isPlayer){
  var U=car&&car.userData, A=U&&U.anim; if(!A||!o) return;
  if(!(dt>0)) dt=0; if(dt>0.1) dt=0.1;
  var me=U.meta, i;
  var v = isPlayer ? (o.v||0) : (o.ov||0);
  var acc;
  if(isPlayer) acc=o.acc||0;
  else if(o.oacc!==undefined) acc=o.oacc;
  else { if(dt>0){ var ea=(v-A.lastV)/dt; if(ea>60) ea=60; if(ea<-60) ea=-60; A.accF+=(ea-A.accF)*Math.min(1,dt*5); } acc=A.accF; }
  A.lastV=v;
  var spin = isPlayer ? !!o.spin : !!o.ospin;
  var burn = isPlayer ? !!o.burnout : !!o.oburn;
  /* wheels */
  var wr=v/U.rr*(spin?1.4:1), wf=v/me.fr;
  if(burn && wr<75) wr=75;
  if(spin && v<3 && wr<30) wr=30;
  for(i=0;i<U.carriers.length;i++){
    var C=U.carriers[i], S=C.userData.spin, rot=S.rotation.y-(C.userData.rear?wr:wf)*dt;
    if(rot<-TAU||rot>TAU) rot=rot%TAU;
    S.rotation.y=rot;
  }
  /* tyre wrinkle: hard launch squashes the tall sidewalls, damped spring back */
  var wt=me.wrinkle*clamp((acc-4)/12,0,1)*clamp(1-v/16,0,1);
  if(burn) wt=Math.max(wt, me.wrinkle*0.35);
  var n=Math.min(12, Math.ceil(dt/0.012)), h=n?dt/n:0, s;
  var ptT=0, pitchMax=U.wbar?U.maxPitch:me.maxPitch;
  var lift=isPlayer ? (o.lift||0) : (o.olift!==undefined ? o.olift : clamp((acc-12)/18,0,1)*0.6);
  var onBars=isPlayer ? !!o.onBars : !!o.oOnBars;
  ptT=clamp(lift,0,1)*pitchMax;
  if((me.bars||U.wbar) && onBars) ptT=pitchMax;
  ptT += clamp(acc/25,-0.5,1)*me.squat;
  var sh=isPlayer ? !!o.shifting : !!o.oshifting;
  if(sh && !A.shifting) A.pv -= me.shiftKick;
  A.shifting=sh;
  if(sh) ptT -= me.squat*0.8;
  var om=me.pitchW, ze=0.42, om2=15, ze2=0.3;
  for(s=0;s<n;s++){
    A.pv += (om*om*(ptT-A.pitch) - 2*ze*om*A.pv)*h; A.pitch += A.pv*h;
    A.sqv += (om2*om2*(wt-A.sq) - 2*ze2*om2*A.sqv)*h; A.sq += A.sqv*h;
  }
  if(A.pitch>pitchMax+0.02) { A.pitch=pitchMax+0.02; if(A.pv>0) A.pv=0; }
  if((me.bars||U.wbar) && A.pitch>pitchMax){ A.pitch=pitchMax; if(A.pv>0) A.pv*=-0.25; }
  if(A.pitch<-0.035){ A.pitch=-0.035; if(A.pv<0) A.pv=0; }
  var sq=clamp(A.sq,-0.4,1.2);
  A.roll += (clamp(acc/30,-0.3,1)*0.010 - A.roll)*Math.min(1,dt*6);
  /* tyres: squash about the contact patch, bulge the sidewall out, lean a touch */
  var sy=1-0.08*sq, sz=1+0.06*sq, sx=1+0.035*sq;
  for(i=0;i<U.carriers.length;i++){
    var Cw=U.carriers[i], d=Cw.userData;
    if(d.rear){
      d.hold.scale.set(sx, sz, sy);
      d.letters.position.y=d.hw*(sz-1);
      Cw.position.y=d.r*sy; Cw.rotation.x=d.side*0.035*sq;
    } else {
      var rise=(me.xf-me.xr)*Math.sin(A.pitch)-me.droop;
      Cw.position.y=d.r+(rise>0?rise:0);
    }
  }
  var B=U.bodyGroup;
  B.rotation.z=A.pitch; B.rotation.x=A.roll;
  B.position.y=me.rr - (me.ride||0) - me.rr*0.08*sq - clamp(acc/25,0,1)*me.squatDrop;
  B.updateMatrix();
  for(i=0;i<A.tipRest.length;i++){ U.exhaustTips[i].copy(A.tipRest[i]).applyMatrix4(B.matrix); U.exhaustDirs[i].copy(A.dirRest[i]).transformDirection(B.matrix); }
  for(i=0;i<A.flameRest.length;i++){ U.flameTips[i].copy(A.flameRest[i]).applyMatrix4(B.matrix); U.flameDirs[i].copy(A.flameDirRest[i]).transformDirection(B.matrix); }
  if(A.gateRest) for(i=0;i<A.gateRest.length;i++){ U.gates[i].p.copy(A.gateRest[i].p).applyMatrix4(B.matrix); U.gates[i].d.copy(A.gateRest[i].d).transformDirection(B.matrix); }
  if(A.hatRest) U.hat.copy(A.hatRest).applyMatrix4(B.matrix);
  U.chuteAnchor.copy(A.anchorRest).applyMatrix4(B.matrix);
  /* lamps */
  var brake=isPlayer ? !!o.brake : (o.obrake!==undefined ? !!o.obrake : ((o.ox||0)>402.336 && v>1));
  var night=!!o.night, ti=brake?2.6:(night?0.9:0), hi=night?2.4:0;
  if(ti!==A.tailI){ U.lampMats.tail.emissiveIntensity=ti; A.tailI=ti; }
  if(hi!==A.headI){ U.lampMats.head.emissiveIntensity=hi; A.headI=hi; }
  /* parachute: bag out -> lines taut -> blossom with overshoot -> sway -> collapse under 10 m/s */
  var ch=U.chute, on=isPlayer ? !!o.chute : (o.ochute!==undefined ? !!o.ochute : (!!o.chute && (o.ox||0)>402.336));
  if(on && !ch.visible){ ch.visible=true; A.chT=0; A.chC=0; }
  else if(!on && ch.visible) ch.visible=false;
  if(ch.visible) sc_chuteAnim(ch, A, me, v, dt);
}
function sc_chuteAnim(ch, A, me, v, dt){
  A.chT+=dt; A.chS+=dt*(1.8+Math.min(v,100)*0.03);
  var U=ch.userData, cn=U.canopy, t=A.chT;
  var ext=smoothstep(0,0.3,t), b=clamp((t-0.2)/0.5,0,1), c1=1.9, bloom=0.08+0.92*(1+(c1+1)*Math.pow(b-1,3)+c1*Math.pow(b-1,2));
  A.chC += ((v<10?1:0)-A.chC)*Math.min(1,dt*1.4);
  var c=A.chC, sway=(0.05+Math.min(v,100)*0.0024)*(1-c)*ext;
  ch.rotation.z=-A.pitch;
  var D=me.chuteLen*(0.08+0.92*ext)*(1-0.3*c);
  cn.position.set(-D, me.chuteRise*ext*(1-c) + c*(0.28-me.anchor.y) + Math.sin(A.chS*1.3)*sway, Math.sin(A.chS*0.83+1.1)*sway*1.5);
  _scA.copy(cn.position).negate().normalize();
  cn.quaternion.setFromUnitVectors(_scX, _scA);
  var rad=bloom*(1-0.6*c)*(1+0.035*Math.sin(A.chS*4.1)*(1-c));
  if(U.fl) U.fl.value.set(A.chS%600, ext*(1-c)*(0.35+0.65*Math.min(1,v/30)));   /* fabric flutter: hard at speed, gone once it falls in */
  cn.scale.set(bloom*(1+0.5*c), rad, rad*(1-0.25*c));
  cn.updateMatrix();
  _scB.copy(cn.position).multiplyScalar(0.28);                 /* confluence point */
  sc_setLine(U.bridle, _scO, _scB);
  for(var i=0;i<U.lines.length;i++){
    var L=U.lines[i];
    _scA.set(0, U.rc*L.userData.cy, U.rc*L.userData.cz).applyMatrix4(cn.matrix);
    sc_setLine(L, _scB, _scA);
  }
}
function sc_setLine(m, a, b){
  m.position.copy(a); _scC.subVectors(b,a); var len=_scC.length()||1e-4; _scC.multiplyScalar(1/len);
  m.quaternion.setFromUnitVectors(_scY, _scC); m.scale.set(1,len,1);
}

/* --- materials ------------------------------------------------------------ */
function sc_env(){
  if(STRIP.scene && STRIP.scene.environment) return null;      /* the strip's own environment wins */
  if(SC.env || !renderer) return SC.env;
  var s=new THREE.Scene(), g=new THREE.SphereGeometry(50, 32, 16), p=g.attributes.position, col=[], c=new THREE.Color();
  for(var i=0;i<p.count;i++){
    var y=p.getY(i)/50, x=p.getX(i)/50;
    if(y>=0){ var f=Math.pow(y,0.5); c.setRGB(lerp(1.05,0.22,f), lerp(1.08,0.42,f), lerp(1.12,0.85,f)); }
    else { var f2=Math.min(1,-y*3); c.setRGB(lerp(0.50,0.13,f2), lerp(0.52,0.15,f2), lerp(0.46,0.11,f2)); }
    if(y>0.02 && y<0.14) c.multiplyScalar(0.72+0.2*Math.abs(Math.sin(x*9)));   /* distant horizon clutter */
    col.push(c.r,c.g,c.b);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(col,3));
  s.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({vertexColors:true, side:THREE.BackSide})));
  var sun=new THREE.Mesh(new THREE.SphereGeometry(3.5,12,8), new THREE.MeshBasicMaterial({color:new THREE.Color(9,8.4,7.4)})); sun.position.set(-22,32,26); s.add(sun);
  var pan=new THREE.Mesh(new THREE.PlaneGeometry(40,6), new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,1.6,1.6), side:THREE.DoubleSide})); pan.position.set(0,26,-30); pan.lookAt(0,0,0); s.add(pan);
  var rt=new THREE.WebGLCubeRenderTarget(128,{format:THREE.RGBAFormat, generateMipmaps:true, minFilter:THREE.LinearMipmapLinearFilter});
  var cam=new THREE.CubeCamera(0.1,120,rt); cam.update(renderer,s);
  var pm=new THREE.PMREMGenerator(renderer); pm.compileCubemapShader(); SC.env=pm.fromCubemap(rt.texture).texture; pm.dispose(); rt.dispose();
  g.dispose(); return SC.env;
}
function sc_mats(){
  if(SC.mat) return SC.mat;
  var env=sc_env();
  function m(c, r, mt, ei, o){ var q=new THREE.MeshStandardMaterial({color:sc(c), roughness:r, metalness:mt, envMapIntensity:ei===undefined?1:ei}); if(env) q.envMap=env; if(o) for(var k in o) q[k]=o[k]; return q; }
  var M={};
  M.rubber=m(0x18181a, 0.82, 0.0, 0.45);
  M.well=m(0x0a0a0b, 1.0, 0.0, 0.2);
  M.black=m(0x1c1d20, 0.6, 0.1, 0.6);
  M.satin=m(0x111214, 0.42, 0.35, 0.9);
  M.glass=m(0x0c131a, 0.05, 0.75, 1.5, {polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1});
  M.seam=m(0x0a0a0b, 1.0, 0.0, 0.2, {polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2});
  M.chrome=m(0xf0f0f0, 0.09, 1.0, 1.25);
  M.alu=m(0xcfd3d8, 0.2, 1.0, 1.15);
  M.barrel=m(0x7b8087, 0.45, 0.9, 0.8);
  M.rimBlack=m(0x1e2023, 0.35, 0.6, 0.9);
  M.tube=m(0xaeb3b9, 0.32, 0.85, 1.0);
  M.engine=m(0x1a1b1e, 0.5, 0.3, 0.8);
  M.bag=m(0x1b1c20, 0.8, 0.0, 0.4);
  M.lineM=m(0xe6e2d8, 0.85, 0.0, 0.3);
  M.visor=m(0x1a2530, 0.08, 0.8, 1.4);
  M.carbon=m(0xffffff, 0.24, 0.3, 1.35, {map:sc_carbonTex(), polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1});
  M.carbonS=m(0xffffff, 0.24, 0.3, 1.35, {map:M.carbon.map});   /* v3: carbon as a solid part (wings, funny-car body), no decal offset */
  M.rotor=m(0x8b8f95, 0.38, 0.95, 0.9);
  M.caliper=m(0xb3261e, 0.35, 0.25, 1.0);
  M.chromeT=m(0xf4f4f4, 0.07, 1.0, 1.35, {polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2});   /* chrome trim strips on the body */
  M.canopy=m(0xffffff, 0.85, 0.0, 0.4, {map:sc_stripeTex(), side:THREE.DoubleSide});
  M.letters=new THREE.MeshStandardMaterial({map:sc_letterTex(), transparent:true, depthWrite:false, roughness:0.85, polygonOffset:true, polygonOffsetFactor:-2});
  if(env) M.letters.envMap=env;
  /* Full / Ultra door cars: window openings in the body, see-through tinted glass with a black ceramic border (the frit), and
     a cabin behind it: the headliner and door cards (the body's own inside, drawn back faces only), dash, seats, floor */
  M.glassT=m(0xffffff, 0.02, 0.35, 2.0, {map:sc_fritTex(), transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1});
  M.liner=m(0x1e1f22, 0.92, 0.0, 0.25, {side:THREE.BackSide});
  M.cabin=m(0x232427, 0.85, 0.05, 0.4);
  M.seat=m(0x1a1b1e, 0.7, 0.0, 0.45);
  M.suit=m(0x2b3242, 0.85, 0.0, 0.4);
  SC.mat=M; return M;
}
function sc_paint(color){
  var cc=GFX!=="lite", key=String(color>>>0)+(cc?"c":""); if(SC.paint[key]) return SC.paint[key];
  var c=new THREE.Color(color).convertSRGBToLinear(), lum=0.2126*c.r+0.7152*c.g+0.0722*c.b;
  /* v3: Full / Ultra paint is a clear coat over a satin base (a second, sharp highlight); Lite keeps the single-lobe paint */
  var q=cc?new THREE.MeshPhysicalMaterial({color:c, roughness:0.42, metalness:lum<0.02?0.3:0.12, envMapIntensity:lum<0.02?1.45:1.1, clearcoat:1, clearcoatRoughness:0.06})
    :new THREE.MeshStandardMaterial({color:c, roughness:0.2, metalness:lum<0.02?0.35:0.22, envMapIntensity:lum<0.02?1.5:1.15});
  var env=sc_env(); if(env) q.envMap=env;
  SC.paint[key]=q; return q;
}
function sc_canvas(w,h){ var c=document.createElement("canvas"); c.width=w; c.height=h; return c; }
function sc_ctex(c, srgb){ return ctex(c, srgb, 4); }
/* v3: 2x2 twill weave: each tow is a rounded ribbon (sheen across it, dark at the edges), alternating direction on the twill diagonal */
function sc_carbonTex(){
  var c=sc_canvas(128,128), x=c.getContext("2d"), i, j, s=16;
  x.fillStyle="#0c0d0f"; x.fillRect(0,0,128,128);
  for(i=0;i<8;i++) for(j=0;j<8;j++){ var on=(((i+j)%4)<2), x0=i*s, y0=j*s;
    var gr=on?x.createLinearGradient(x0,y0,x0,y0+s):x.createLinearGradient(x0,y0,x0+s,y0);
    gr.addColorStop(0,"#101114"); gr.addColorStop(0.18,on?"#2c3036":"#1b1d21"); gr.addColorStop(0.5,on?"#454a52":"#2a2d33"); gr.addColorStop(0.82,on?"#2c3036":"#1b1d21"); gr.addColorStop(1,"#0f1013");
    x.fillStyle=gr; x.fillRect(x0+0.5,y0+0.5,s-1,s-1);
    x.strokeStyle="rgba(0,0,0,0.35)"; x.lineWidth=1; for(var q=1;q<4;q++){ x.beginPath(); if(on){ x.moveTo(x0+q*s/4,y0); x.lineTo(x0+q*s/4,y0+s); } else { x.moveTo(x0,y0+q*s/4); x.lineTo(x0+s,y0+q*s/4); } x.stroke(); } }
  var t=sc_ctex(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(5,5); return t;
}
/* window glass: a dark smoke tint you can see through, a solid black border with the dot fade real windscreens have */
function sc_fritTex(){
  var c=sc_canvas(128,128), x=c.getContext("2d"), i, j, b=9, f=7;
  x.clearRect(0,0,128,128); x.fillStyle="rgba(26,33,38,0.5)"; x.fillRect(0,0,128,128);
  x.clearRect(b+f,b+f,128-2*(b+f),128-2*(b+f)); x.fillStyle="rgba(26,33,38,0.5)"; x.fillRect(b+f,b+f,128-2*(b+f),128-2*(b+f));
  x.fillStyle="#08090a"; x.fillRect(0,0,128,b); x.fillRect(0,128-b,128,b); x.fillRect(0,0,b,128); x.fillRect(128-b,0,b,128);
  for(i=0;i<128;i+=3) for(j=0;j<f;j+=3){ var r=1.4*(1-j/f)+0.3;
    [[i,b+j],[i,127-b-j],[b+j,i],[127-b-j,i]].forEach(function(q){ x.beginPath(); x.arc(q[0]+1,q[1]+1,r,0,TAU); x.fill(); }); }
  return sc_ctex(c);
}
function sc_stripeTex(){
  var c=sc_canvas(128,16), x=c.getContext("2d");
  for(var i=0;i<8;i++){ x.fillStyle=i%2?"#f2eee4":"#e5562b"; x.fillRect(i*16,0,16,16); }
  x.fillStyle="rgba(0,0,0,0.15)"; x.fillRect(0,13,128,3);
  return sc_ctex(c);
}
function sc_letterTex(){
  var c=sc_canvas(512,512), x=c.getContext("2d");
  function arc(txt, r, a0, span, size){
    x.font="bold "+size+"px 'Barlow Condensed','Arial Narrow',Arial,sans-serif";
    var tw=0, i, ws=[]; for(i=0;i<txt.length;i++){ ws.push(x.measureText(txt[i]).width); tw+=ws[i]; }
    var a=a0-span/2;
    for(i=0;i<txt.length;i++){ var da=ws[i]/tw*span; x.save(); x.translate(256,256); x.rotate(a+da/2+PI/2); x.fillText(txt[i], -ws[i]/2, -r); x.restore(); a+=da; }
  }
  x.fillStyle="rgba(240,236,226,0.95)"; x.textBaseline="middle";
  arc("SECTION LINE", 204, -PI/2, 1.25, 46); arc("SECTION LINE", 204, PI/2, 1.25, 46);
  x.fillStyle="rgba(240,236,226,0.7)";
  arc("DRAG · RADIAL · 15", 204, 0, 0.9, 26); arc("DRAG · RADIAL · 15", 204, PI, 0.9, 26);
  return sc_ctex(c);
}
function sc_decalMat(num, color, kind){
  var key=kind+"|"+num+"|"+(color>>>0); if(SC.tex[key]) return SC.tex[key];
  var c0=new THREE.Color(color), lum=0.2126*c0.r+0.7152*c0.g+0.0722*c0.b;
  var fg=lum>0.55?"#15171a":"#f3efe4", ac="#3f7fd0";
  var c, x;
  if(kind==="banner"){
    c=sc_canvas(512,64); x=c.getContext("2d");
    x.fillStyle="rgba(12,16,22,0.92)"; x.fillRect(0,0,512,64);
    x.fillStyle="#e9e4d6"; x.font="bold 40px 'Barlow Condensed','Arial Narrow',Arial,sans-serif"; x.textAlign="center"; x.textBaseline="middle"; x.fillText("LONGLIGHT INTERACTIVE", 256, 34, 480);
  } else {
    c=sc_canvas(512,200); x=c.getContext("2d");
    x.fillStyle="#f3efe4"; x.beginPath(); x.arc(118,96,78,0,TAU); x.fill();
    x.lineWidth=6; x.strokeStyle=ac; x.stroke();
    x.fillStyle="#141518"; x.font="bold 104px 'Barlow Condensed','Arial Narrow',Arial,sans-serif"; x.textAlign="center"; x.textBaseline="middle"; x.fillText(num, 118, 102);
    x.textAlign="left"; x.fillStyle=fg; x.font="bold 46px 'Barlow Condensed','Arial Narrow',Arial,sans-serif"; x.fillText("LONGLIGHT", 216, 74, 284);
    x.font="bold 30px 'Barlow Condensed','Arial Narrow',Arial,sans-serif"; x.fillText("INTERACTIVE · RACING", 218, 116, 280);
    x.fillStyle=ac; x.fillRect(216,142,280,9); x.fillStyle=fg; x.fillRect(216,158,210,5);
  }
  var q=new THREE.MeshStandardMaterial({map:sc_ctex(c), transparent:true, depthWrite:false, roughness:0.3, metalness:0.05, polygonOffset:true, polygonOffsetFactor:-3});
  var env=sc_env(); if(env) q.envMap=env;
  SC.tex[key]=q; return q;
}

function livMat(sp){
  if(LIV_MAT[sp.id]) return LIV_MAT[sp.id];
  var t=new THREE.CanvasTexture(spLogoCanvas(sp,512,192)); t.encoding=THREE.sRGBEncoding; t.anisotropy=MAXANISO;
  var q=new THREE.MeshStandardMaterial({map:t, transparent:true, depthWrite:false, roughness:0.32, metalness:0.05, polygonOffset:true, polygonOffsetFactor:-3, polygonOffsetUnits:-3});
  var env=sc_env(); if(env) q.envMap=env;
  LIV_MAT[sp.id]=q; return q;
}
/* the strip car's door decal: the race number, with the side sponsors where the studio name (Longlight Interactive) went (one, or two stacked) */
function livDoorMat(num, color){
  var key="door|"+num+"|"+LIVERY.key; if(LIV_MAT[key]) return LIV_MAT[key];
  var c=sc_canvas(512,200), x=c.getContext("2d"), L=LIVERY.sides.length?LIVERY.sides.slice(0,2):[LIVERY.hood];
  var draw=function(){ x.clearRect(0,0,512,200);
    x.fillStyle="#f3efe4"; x.beginPath(); x.arc(118,96,78,0,TAU); x.fill(); x.lineWidth=6; x.strokeStyle=L[0].c1; x.stroke();
    x.fillStyle="#141518"; x.font="bold 104px 'Barlow Condensed','Arial Narrow',Arial,sans-serif"; x.textAlign="center"; x.textBaseline="middle"; x.fillText(num, 118, 102);
    if(L.length===1) x.drawImage(spLogoCanvas(L[0],512,192), 206, 40, 300, 112.5);
    else L.forEach(function(sp,i){ x.drawImage(spLogoCanvas(sp,512,192), 214, 6+i*96, 250, 94); }); };
  draw(); LIV_FX.push(draw);   /* livRedraw repaints it when an emblem arrives (the material's map is flagged there) */
  var q=new THREE.MeshStandardMaterial({map:sc_ctex(c), transparent:true, depthWrite:false, roughness:0.3, metalness:0.05, polygonOffset:true, polygonOffsetFactor:-3});
  var env=sc_env(); if(env) q.envMap=env;
  LIV_MAT[key]=q; return q;
}
/* windshield banner in the primary sponsor's colours */
function livBannerMat(sp){
  var key="ban|"+sp.id; if(LIV_MAT[key]) return LIV_MAT[key];
  var c=sc_canvas(512,64), x=c.getContext("2d");
  x.fillStyle=sp.c1; x.fillRect(0,0,512,64); x.fillStyle=sp.c2; x.fillRect(0,56,512,8);
  spShape(x, sp.shape, 40, 30, 20, sp.c2, sp.c1);
  x.fillStyle=sp.c3; x.font="italic bold 40px 'Barlow Condensed','Arial Narrow',Arial,sans-serif"; x.textAlign="center"; x.textBaseline="middle"; x.fillText(String(sp.name).toUpperCase(), 270, 31, 420);
  var q=new THREE.MeshStandardMaterial({map:sc_ctex(c), transparent:true, depthWrite:false, roughness:0.3, metalness:0.05, polygonOffset:true, polygonOffsetFactor:-3});
  var env=sc_env(); if(env) q.envMap=env;
  LIV_MAT[key]=q; return q;
}
/* the player's strip car (and the salt Altered, which is one): swap the door / banner materials, show the hood patch */
function stripLivery(car){
  var L=car && car.userData && car.userData.liv; if(!L) return; var key=LIVERY.key; if(L.key===key) return; L.key=key;
  var on=!!(key && LIVERY.hood), i;
  for(i=0;i<L.door.length;i++) L.door[i].material=on?livDoorMat(L.num, L.color):L.dm;
  for(i=0;i<L.banner.length;i++) L.banner[i].material=on?livBannerMat(LIVERY.hood):L.bm;
  if(L.hood){ L.hood.visible=on; if(on) L.hood.material=livMat(LIVERY.hood); }
}
/* logo planes for the pull and salt vehicles: spots [{role:"hood"|"side", w, h, p:[x,y,z], u:[..], v:[..]}] (u = along the text, v = up the logo) */
var _livU=new THREE.Vector3(), _livV=new THREE.Vector3(), _livN=new THREE.Vector3();
function livPlanes(parent, U, spots){
  var key=LIVERY.key+"|"+GFX; if(U.livKey===key) return; U.livKey=key;
  if(U.livG){ parent.remove(U.livG); U.livG=null; }
  if(!LIVERY.key || !LIVERY.hood) return;
  var G=new THREE.Group(); if(!LIV_PG){ LIV_PG=new THREE.PlaneGeometry(1,1); LIV_PG.__cached=true; }
  spots.forEach(function(s){
    var sp=s.role==="hood"?LIVERY.hood:(LIVERY.sides.length?LIVERY.sides[(s.i||0)%LIVERY.sides.length]:null);
    if(!sp || (s.role!=="hood" && GFX==="lite")) return;   /* Lite: the hood logo only */
    var m=new THREE.Mesh(LIV_PG, livMat(sp)); _livU.fromArray(s.u); _livV.fromArray(s.v); _livN.crossVectors(_livU,_livV);
    m.matrix.makeBasis(_livU, _livV, _livN); m.matrix.scale(_livN.set(s.w, s.h, 1)); m.matrix.setPosition(s.p[0], s.p[1], s.p[2]); m.matrixAutoUpdate=false; m.renderOrder=3;
    G.add(m); });
  parent.add(G); U.livG=G;
}

/* --- body loft ------------------------------------------------------------ */
/* keys: [{x,zb,ys,yt,w,wt,cr}] rear->front: bottom, beltline, top centre, side half-width, top half-width, crown.
   PCHIP interpolation (no overshoot); arches carve the sill; rake/lift shift every height. */
function sc_def(rows, o){
  var keys=rows.map(function(r){ return {x:r[0], zb:r[1], ys:r[2], yt:r[3], w:r[4], wt:r[5], cr:r[6]}; });
  var n=keys.length; keys.m={};
  SC_F.forEach(function(f){
    var m=[], s=[], h=[], i;
    for(i=0;i<n-1;i++){ h[i]=keys[i+1].x-keys[i].x; s[i]=(keys[i+1][f]-keys[i][f])/h[i]; }
    m[0]=s[0]; m[n-1]=s[n-2];
    for(i=1;i<n-1;i++){ if(s[i-1]*s[i]<=0) m[i]=0; else { var w1=2*h[i]+h[i-1], w2=h[i]+2*h[i-1]; m[i]=(w1+w2)/(w1/s[i-1]+w2/s[i]); } }
    keys.m[f]=m;
  });
  var D={keys:keys, arches:o.arches||[], rake:o.rake||0, rakeX:o.rakeX||0, lift:o.lift||0, sub:o.sub||2, flares:o.flares||[]};
  D.X=sc_stations(D);
  return D;
}
function sc_params(D, x, out){
  var K=D.keys, n=K.length, i=0, f, j;
  if(x<=K[0].x){ for(j=0;j<6;j++){ f=SC_F[j]; out[f]=K[0][f]; } }
  else if(x>=K[n-1].x){ for(j=0;j<6;j++){ f=SC_F[j]; out[f]=K[n-1][f]; } }
  else {
    while(i<n-2 && x>K[i+1].x) i++;
    var h=K[i+1].x-K[i].x, t=(x-K[i].x)/h, t2=t*t, t3=t2*t, h00=2*t3-3*t2+1, h10=t3-2*t2+t, h01=-2*t3+3*t2, h11=t3-t2;
    for(j=0;j<6;j++){ f=SC_F[j]; out[f]=h00*K[i][f]+h10*h*K.m[f][i]+h01*K[i+1][f]+h11*h*K.m[f][i+1]; }
  }
  var dy=D.lift+(x-D.rakeX)*D.rake; out.zb+=dy; out.ys+=dy; out.yt+=dy;
  for(j=0;j<D.flares.length;j++){ var F=D.flares[j], u=(x-F.x)/F.span; if(u>-1&&u<1){ var cb=Math.cos(u*PI/2); out.w+=F.amt*cb*cb; out.ys+=F.up*cb*cb; } }
  for(j=0;j<D.arches.length;j++){ var a=D.arches[j], dx=x-a.x; if(dx>-a.R && dx<a.R){ var ay=a.y+Math.sqrt(a.R*a.R-dx*dx); if(ay>out.zb) out.zb=ay; } }
  if(out.zb>out.ys-0.045) out.zb=out.ys-0.045;
  return out;
}
function sc_ring(p, R){
  var zb=p.zb, ys=p.ys, h=ys-zb, w=p.w, wt=p.wt, top=p.yt-p.cr, z5=w*0.975, j;
  var Y=[zb, zb, zb+Math.min(0.055,h*0.2), zb+h*0.45, zb+h*0.8, ys, lerp(ys,top,0.36), lerp(ys,top,0.7), top, p.yt-p.cr*0.2, p.yt];
  var Z=[0, w*0.8, w*0.955, w, w*0.995, z5, lerp(z5,wt,0.36)+0.006, lerp(z5,wt,0.7)+0.004, wt, wt*0.56, 0];
  for(j=0;j<=10;j++){ R[2*j]=Y[j]; R[2*j+1]=Z[j]; }
  for(j=11;j<20;j++){ R[2*j]=Y[20-j]; R[2*j+1]=-Z[20-j]; }
  return R;
}
function sc_stations(D){
  var K=D.keys, xs=[], i, s;
  for(i=0;i<K.length-1;i++) for(s=0;s<D.sub;s++) xs.push(lerp(K[i].x,K[i+1].x,s/D.sub));
  xs.push(K[K.length-1].x);
  D.arches.forEach(function(a){ for(var j=0;j<=8;j++) xs.push(a.x+a.R*Math.cos(PI*j/8)); xs.push(a.x+a.R+0.008, a.x-a.R-0.008); });
  xs=xs.filter(function(x){ return x>=K[0].x && x<=K[K.length-1].x; }).sort(function(a,b){ return a-b; });
  var out=[xs[0]]; for(i=1;i<xs.length;i++) if(xs[i]-out[out.length-1]>0.004) out.push(xs[i]);
  out[out.length-1]=K[K.length-1].x;
  return out;
}
function sc_pt(D, x, k, out, P, R){
  sc_params(D, x, P); sc_ring(P, R);
  k=((k%20)+20)%20; var k0=Math.floor(k), f=k-k0, k1=(k0+1)%20;
  return out.set(x, lerp(R[2*k0],R[2*k1],f), lerp(R[2*k0+1],R[2*k1+1],f));
}
/* returns {paint, well, capF:{x,p}, capR} ; the underside (k 19->0->1) is the dark wheel-well / floor.
   holes (Full / Ultra door cars): [{x0,x1,k0,k1}] window openings. Their edges become loft stations (added to D.X, so the
   glass patches line up with them) and extra ring points (on the straight line between the old ones, so the shape does
   not change), and the faces inside them are left out: the see-through glass covers the opening and the cabin shows. */
function sc_loft(D, holes){
  var KS=[], i, j, k;
  for(k=0;k<20;k++) KS.push(k);
  if(holes && holes.length){
    holes.forEach(function(h){ [h.k0,h.k1].forEach(function(q){ if(KS.indexOf(q)<0) KS.push(q); }); });
    KS.sort(function(a,b){ return a-b; });
    var hx=[]; holes.forEach(function(h){ hx.push(h.x0, h.x1); });
    var X0=D.X.filter(function(x){ for(var q=0;q<hx.length;q++) if(Math.abs(x-hx[q])<0.004) return false; return true; }).concat(hx);
    X0.sort(function(a,b){ return a-b; }); D.X=X0.filter(function(x,q){ return q===0 || x-X0[q-1]>1e-6; });
  }
  var X=D.X, nX=X.length, NS=KS.length, pos=[], iP=[], iW=[], P={}, R=new Float32Array(40);
  function ring(){ for(var q=0;q<NS;q++){ var kq=KS[q], k0=Math.floor(kq), f=kq-k0, k1=(k0+1)%20; pos.push(0, lerp(R[2*k0],R[2*k1],f), lerp(R[2*k0+1],R[2*k1+1],f)); } }
  function cut(a, b, ka, kb){ if(!holes) return false; for(var q=0;q<holes.length;q++){ var h=holes[q]; if(a>=h.x0-1e-4 && b<=h.x1+1e-4 && ka>=h.k0-1e-4 && kb<=h.k1+1e-4) return true; } return false; }
  for(i=0;i<nX;i++){ sc_params(D,X[i],P); sc_ring(P,R); var b0=pos.length; ring(); for(j=b0;j<pos.length;j+=3) pos[j]=X[i]; }
  for(i=0;i<nX-1;i++) for(k=0;k<NS;k++){
    var kn=(k+1)%NS, a=i*NS+k, b=(i+1)*NS+k, c=(i+1)*NS+kn, d=i*NS+kn, dst=(KS[k]===0||k===NS-1)?iW:iP;
    if(kn && cut(X[i], X[i+1], KS[k], KS[kn])) continue;
    dst.push(a,b,c, a,c,d);
  }
  function cap(ii, front){
    sc_params(D,X[ii],P); sc_ring(P,R); var base=pos.length/3, cy=(P.zb+P.yt)/2;
    pos.push(X[ii], cy, 0); var b0=pos.length; ring(); for(j=b0;j<pos.length;j+=3) pos[j]=X[ii];
    for(k=0;k<NS;k++){ var p0=base+1+k, p1=base+1+(k+1)%NS; if(front) iP.push(base,p1,p0); else iP.push(base,p0,p1); }
    return {x:X[ii], zb:P.zb, ys:P.ys, yt:P.yt, w:P.w, wt:P.wt};
  }
  var capR=cap(0,false), capF=cap(nX-1,true);
  var full=new THREE.BufferGeometry(); full.setAttribute("position", new THREE.Float32BufferAttribute(pos,3)); full.setIndex(iP.concat(iW)); full.computeVertexNormals();
  var gP=new THREE.BufferGeometry(), gW=new THREE.BufferGeometry();
  gP.setAttribute("position", full.attributes.position); gP.setAttribute("normal", full.attributes.normal); gP.setIndex(iP);
  gW.setAttribute("position", full.attributes.position); gW.setAttribute("normal", full.attributes.normal); gW.setIndex(iW);
  return {paint:gP, well:gW, capF:capF, capR:capR};
}
/* overlay patch on the loft surface (glass, decals, carbon hood), pushed out along the normal */
function sc_patch(D, x0, x1, k0, k1, off, uvMode, kStep){
  var xs=[x0], ks=[k0], i, j, P={}, R=new Float32Array(40), p=new THREE.Vector3(), a=new THREE.Vector3(), b=new THREE.Vector3(), nn=new THREE.Vector3(), du=new THREE.Vector3(), dk=new THREE.Vector3();
  D.X.forEach(function(x){ if(x>x0+0.004 && x<x1-0.004) xs.push(x); }); xs.push(x1);
  var st=kStep||1; for(var kk=Math.floor(k0/st)*st+st; kk<k1-0.02; kk+=st) ks.push(kk); ks.push(k1);
  var pos=[], nor=[], uv=[], idx=[], nk=ks.length;
  for(i=0;i<xs.length;i++) for(j=0;j<nk;j++){
    var x=xs[i], k=ks[j];
    sc_pt(D,x,k,p,P,R);
    sc_pt(D,x+0.01,k,a,P,R); sc_pt(D,x-0.01,k,b,P,R); du.subVectors(a,b);
    sc_pt(D,x,k+0.2,a,P,R); sc_pt(D,x,k-0.2,b,P,R); dk.subVectors(a,b);
    nn.crossVectors(du,dk).normalize();
    pos.push(p.x+nn.x*off, p.y+nn.y*off, p.z+nn.z*off); nor.push(nn.x,nn.y,nn.z);
    var fu=(x-x0)/(x1-x0), fk=(k-k0)/(k1-k0);
    if(uvMode==="L") uv.push(1-fu, 1-fk); else if(uvMode==="K") uv.push(fk, 1-fu); else uv.push(fu, fk);
  }
  for(i=0;i<xs.length-1;i++) for(j=0;j<nk-1;j++){ var A0=i*nk+j, B0=(i+1)*nk+j, C0=(i+1)*nk+j+1, D0=i*nk+j+1; idx.push(A0,B0,C0, A0,C0,D0); }
  var g=new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos,3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor,3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx);
  return g;
}

/* --- small shape helpers ---------------------------------------------------- */
function sc_rr(w,h,r){ var s=new THREE.Shape(), x=-w/2, y=-h/2; r=Math.min(r,w/2,h/2);
  s.moveTo(x+r,y); s.lineTo(x+w-r,y); s.quadraticCurveTo(x+w,y,x+w,y+r); s.lineTo(x+w,y+h-r); s.quadraticCurveTo(x+w,y+h,x+w-r,y+h); s.lineTo(x+r,y+h); s.quadraticCurveTo(x,y+h,x,y+h-r); s.lineTo(x,y+r); s.quadraticCurveTo(x,y,x+r,y); return s; }
/* beveled box, w along x, h along y, d along z, centred */
function sc_rbox(w,h,d,b){
  if(SC.lite){ var kl="rbL"+[w,h,d].map(r3).join("_"); return SC.geo[kl]||(SC.geo[kl]=new THREE.BoxGeometry(w,h,d)); }   /* v3: Lite strip cars use plain boxes */
  var key="rb"+[w,h,d,b].map(r3).join("_"); if(SC.geo[key]) return SC.geo[key];
  b=Math.min(b, w*0.3, h*0.3, d*0.3);
  var g=new THREE.ExtrudeGeometry(sc_rr(w-2*b,h-2*b,b*1.2), {depth:Math.max(0.001,d-2*b), bevelEnabled:true, bevelThickness:b, bevelSize:b, bevelSegments:1, curveSegments:2});
  g.translate(0,0,-(d-2*b)/2); return (SC.geo[key]=g);
}
/* side profile (x,y points) extruded across z */
function sc_prof(pts, d, b){
  if(SC.lite) b=0;   /* v3: Lite: no bevels */
  var s=new THREE.Shape(); s.moveTo(pts[0][0],pts[0][1]); for(var i=1;i<pts.length;i++) s.lineTo(pts[i][0],pts[i][1]);
  var g=new THREE.ExtrudeGeometry(s, {depth:Math.max(0.001,d-2*(b||0)), bevelEnabled:!!b, bevelThickness:b||0, bevelSize:b||0, bevelSegments:2, curveSegments:4});
  g.translate(0,0,-(d-2*(b||0))/2); return g;
}
/* inverted airfoil (leading edge +x), span along z */
function sc_foil(chord, thick, span, b){
  var pts=[], N=9, i, u, yt;
  for(i=0;i<=N;i++){ u=(1-Math.cos(PI*i/N))/2; yt=5*thick*(0.2969*Math.sqrt(u)-0.126*u-0.3516*u*u+0.2843*u*u*u-0.1036*u*u*u*u); pts.push([chord/2-u*chord, -yt*1.35+0.02*chord*Math.sin(PI*u)]); }
  for(i=N-1;i>0;i--){ u=(1-Math.cos(PI*i/N))/2; yt=5*thick*(0.2969*Math.sqrt(u)-0.126*u-0.3516*u*u+0.2843*u*u*u-0.1036*u*u*u*u); pts.push([chord/2-u*chord, yt*0.55+0.02*chord*Math.sin(PI*u)]); }
  pts.reverse();
  return sc_prof(pts, span, SC.lite?0:(b||0.004));
}
/* r6: bolt-on wheelie bars for a shell that has none (drag setup). A handful of rods + two skid wheels on the body frame;
   U.wbar makes the pitch code treat it like a bars body (lower pitch stop, rides the bars). Same look as the factory bars above. */
function stripAddBars(car){
  var U=car.userData, me=U.meta, inner=U.bodyGroup.children[0], M=sc_mats(), br=0.08, maxP=deg(5);
  var bb=new THREE.Box3().setFromObject(car), cs=U.chute; if(cs&&cs.parent===car) bb.expandByObject(cs);
  /* r14: well clear of the bumper: a street or gasser shell's long rear overhang hid all but the last 12 cm */
  var bx0=me.xr-0.05, bx1=Math.min(bb.min.x-0.45, me.xr-1.5), rr=me.rr, dxB=bx1-me.xr, cy=(br-rr-dxB*Math.sin(maxP))/Math.cos(maxP)+rr;
  var g=new THREE.Group(); g.name="sc_wbar";
  function add(geo, mat, m){ var me2=new THREE.Mesh(geo, mat); me2.applyMatrix4(m); me2.matrixAutoUpdate=false; me2.castShadow=true; g.add(me2); }
  [-1,1].forEach(function(sd){
    var a=new THREE.Vector3(bx0, 0.3, sd*0.36), b=new THREE.Vector3(bx1, cy, sd*0.3);
    add(sc_cyl(0.022,8), M.tube, sc_rodM(a,b));
    add(sc_cyl(0.014,6), M.tube, sc_rodM(new THREE.Vector3(bx0, 0.46, sd*0.36), b));
    add(new THREE.CylinderGeometry(br,br,0.045,SC.lite?8:14), M.rubber, sc_M(bx1, cy, sd*0.3, PI/2,0,0));
    add(new THREE.CylinderGeometry(br*0.55,br*0.55,0.05,SC.lite?6:10), M.alu, sc_M(bx1, cy, sd*0.3, PI/2,0,0));
  });
  add(sc_cyl(0.018,8), M.tube, sc_rodM(new THREE.Vector3(bx1+0.05, cy, -0.3), new THREE.Vector3(bx1+0.05, cy, 0.3)));
  var mx=(bx0+bx1)/2, my=(0.3+cy)/2;
  add(sc_cyl(0.018,8), M.tube, sc_rodM(new THREE.Vector3(mx, my, -0.33), new THREE.Vector3(mx, my, 0.33)));
  inner.add(g); U.wbar=true; U.maxPitch=Math.min(me.maxPitch, maxP);
}
function sc_segM(a, b){ /* like sc_rodM but unscaled: a part built to length (a box) laid along a->b, centred on it */
  var d=new THREE.Vector3().subVectors(b,a).normalize(), q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), d);
  return new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a,b).multiplyScalar(0.5), q, new THREE.Vector3(1,1,1));
}
function sc_rodM(a, b){ /* matrix mapping a unit Y cylinder (centre origin, h=1) onto segment a->b */
  var d=new THREE.Vector3().subVectors(b,a), L=d.length(), q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), d.clone().normalize());
  return new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a,b).multiplyScalar(0.5), q, new THREE.Vector3(1,L,1));
}
function sc_cyl(r, seg){ if(SC.lite){ var kl="cyL"+r3(r)+"_"+Math.min(seg||8,6); return SC.geo[kl]||(SC.geo[kl]=new THREE.CylinderGeometry(r,r,1,Math.min(seg||8,6),1,true)); }   /* v3: Lite rods: 6 sides, no caps */
  var key="cy"+r3(r)+"_"+seg; return SC.geo[key]||(SC.geo[key]=new THREE.CylinderGeometry(r,r,1,seg||8,1,false)); }
function sc_M(x,y,z,rx,ry,rz,sx,sy,sz){ return mkM(x,y,z,rx,ry,rz,sx,sy,sz); }
/* a finished open pipe end at c (last leg b->c): a rolled lip and the dark bore just inside, square to the pipe.
   Existing material bins only (no new draws); Lite gets coarser rings */
var _scZ=new THREE.Vector3(0,0,1), _scOne=new THREE.Vector3(1,1,1);
function sc_pipeEnd(B, mat, b, c, r){
  var d=new THREE.Vector3().subVectors(c,b).normalize(), q=new THREE.Quaternion().setFromUnitVectors(_scZ, d), k=r3(r)+(SC.lite?"l":"");
  var ring=SC.geo["pl"+k]||(SC.geo["pl"+k]=new THREE.TorusGeometry(r, r*0.2, SC.lite?3:5, SC.lite?8:14)),
      bore=SC.geo["pb"+k]||(SC.geo["pb"+k]=new THREE.CircleGeometry(r*0.95, SC.lite?8:14));
  B.add(mat, ring, new THREE.Matrix4().compose(c, q, _scOne));
  B.add("well", bore, new THREE.Matrix4().compose(c.clone().addScaledVector(d, -r*0.6), q, _scOne));
}
/* pipe bends: Full/Ultra round, Lite as before */
/* header ports for the engine layout: V / flat a bank a side, inline and two-stroke one side only, rotary one fat pipe per rotor.
   tip(i) = the outlets the effects (heat, pops) ride on, about two a side. No hw = a V8. */
function sc_ports(H){
  var E=(H&&H.eng)||{kind:"v", n:8}, k=E.kind, P;
  if(k==="rotary") P={sides:[-1], per:E.rotors||2, r:1.45};
  else if(k==="i"||k==="two") P={sides:[-1], per:Math.min(8,E.n), r:k==="two"?1.25:1};
  else P={sides:[-1,1], per:Math.min(8,Math.ceil(E.n/2)), r:1};
  P.kind=k; P.flat=k==="flat"; P.one=P.sides.length===1;
  var q=Math.floor(P.per/3); P.tip=function(i){ return i===q || i===P.per-1-q; };
  return P;
}
function sc_pipe(pts, r){ return TUBE(pts, r, SC.lite?5:8, SC.lite?6:10); }
function sc_bin(){ var B={}; B.add=function(k,g,m){ (B[k]||(B[k]=[])).push({g:g, m:m||new THREE.Matrix4()}); }; return B; }
function sc_merge(list){ return mergeGeos(list); }

/* --- wheels -------------------------------------------------------------- */
function sc_tyreGeo(r, w, rimR){
  var seg=GFX==="lite"?18:36;   /* Full / Ultra: a round tyre, not an 18-sided one */
  var key="ty"+[r,w,rimR].map(r3).join("_")+(seg>18?"s":""); if(SC.geo[key]) return SC.geo[key];
  var hw=w/2, sh=Math.min(0.055,(r-rimR)*0.3), pr=[
    [rimR+0.004, 0.86], [lerp(rimR,r,0.34), 1], [lerp(rimR,r,0.74), 1], [r-sh, 0.965], [r-sh*0.22, 0.82]], pts=[], i;
  for(i=0;i<pr.length;i++) pts.push(new THREE.Vector2(pr[i][0], -hw*pr[i][1]));
  for(i=pr.length-1;i>=0;i--) pts.push(new THREE.Vector2(pr[i][0], hw*pr[i][1]));
  return (SC.geo[key]=new THREE.LatheGeometry(pts, seg));
}
function sc_rimGeo(rimR, w, style, brk){
  var key="rim"+[rimR,w].map(r3).join("_")+style+(brk?"b":""); if(SC.geo[key]) return SC.geo[key];
  var n=style==="star"?5:style==="wire"?12:style==="bead"?8:10, spk=style==="star"?0.44:style==="wire"?0.1:style==="bead"?0.3:0.22;
  var fr=rimR*0.9, rin=rimR*(style==="wire"?0.3:0.34), rout=rimR*(style==="star"?0.8:0.78), hw=w/2;
  var s=new THREE.Shape(); s.absarc(0,0,fr,0,TAU,false);
  for(var i=0;i<n;i++){
    var a0=i*TAU/n+spk/2, a1=(i+1)*TAU/n-spk/2, hp=new THREE.Path(), j, m=3;
    for(j=0;j<=m;j++){ var a=lerp(a0,a1,j/m); if(j===0) hp.moveTo(Math.cos(a)*rout, Math.sin(a)*rout); else hp.lineTo(Math.cos(a)*rout, Math.sin(a)*rout); }
    var ai0=a0+(style==="star"?0.12:0.04), ai1=a1-(style==="star"?0.12:0.04);
    for(j=2;j>=0;j--){ var b=lerp(ai0,ai1,j/2); hp.lineTo(Math.cos(b)*rin, Math.sin(b)*rin); }
    s.holes.push(hp);
  }
  var face=new THREE.ExtrudeGeometry(s, {depth:0.016, bevelEnabled:false, curveSegments:6});
  face.rotateX(-PI/2); face.translate(0, hw*0.78, 0);
  var lip=new THREE.LatheGeometry([new THREE.Vector2(rimR*0.86, hw*0.8), new THREE.Vector2(rimR*0.9, hw*0.9), new THREE.Vector2(rimR*1.02, hw*0.92), new THREE.Vector2(rimR*1.04, hw*0.84)], 16);
  var cap=new THREE.CylinderGeometry(rimR*0.17, rimR*0.23, 0.05, 8); cap.translate(0, hw*0.78+0.03, 0);
  var parts=[{g:face,m:new THREE.Matrix4()},{g:lip,m:new THREE.Matrix4()},{g:cap,m:new THREE.Matrix4()}];
  if(brk) for(var ln=0;ln<5;ln++){ var la=ln*TAU/5+0.3, lg=new THREE.CylinderGeometry(0.0085, 0.0095, 0.03, 6); lg.translate(Math.cos(la)*rimR*0.27, hw*0.78+0.025, Math.sin(la)*rimR*0.27); parts.push({g:lg,m:new THREE.Matrix4()}); }   /* lug nuts (Full / Ultra) */
  if(style==="bead"){ var ring=new THREE.LatheGeometry([new THREE.Vector2(rimR*0.9, hw*0.92), new THREE.Vector2(rimR*0.92, hw+0.012), new THREE.Vector2(rimR*1.06, hw+0.012), new THREE.Vector2(rimR*1.08, hw*0.9)], 16); parts.push({g:ring,m:new THREE.Matrix4()}); }
  var rimG=mergeGeos(parts);
  /* barrel (inside, seen through the windows) + dark hub backing so you can't see through the wheel */
  var barrel=new THREE.LatheGeometry([new THREE.Vector2(rimR*0.95, -hw*0.8), new THREE.Vector2(rimR*0.9, hw*0.3), new THREE.Vector2(rimR*0.88, hw*0.8)], 12);
  var back=new THREE.CircleGeometry(rimR*0.92, 12); back.rotateX(-PI/2); back.translate(0, -hw*0.1, 0);
  var hub=new THREE.CylinderGeometry(rimR*0.3, rimR*0.3, hw*0.8, 8, 1, true); hub.translate(0, hw*0.35, 0);
  var inL=[{g:barrel,m:new THREE.Matrix4()},{g:back,m:new THREE.Matrix4()},{g:hub,m:new THREE.Matrix4()}];
  if(brk){   /* v3: brake rotor + hat behind the spokes (merged into the barrel, so no extra draw call) */
    var ro=new THREE.CylinderGeometry(rimR*0.8, rimR*0.8, 0.026, 22, 1, false); ro.translate(0, hw*0.28, 0);
    var hat=new THREE.CylinderGeometry(rimR*0.36, rimR*0.4, hw*0.3, 10, 1, true); hat.translate(0, hw*0.42, 0);
    inL.push({g:ro,m:new THREE.Matrix4()},{g:hat,m:new THREE.Matrix4()});
  }
  var inG=mergeGeos(inL);
  return (SC.geo[key]={rim:rimG, inner:inG});
}
function sc_ringGeo(r, rimR){ var key="lr"+r3(r)+"_"+r3(rimR); if(SC.geo[key]) return SC.geo[key];
  var ri=lerp(rimR,r,0.36), ro=lerp(rimR,r,0.73), g=new THREE.RingGeometry(ri, ro, 40, 1), p=g.attributes.position, uv=g.attributes.uv;
  for(var i=0;i<p.count;i++){ var x=p.getX(i), y=p.getY(i), rr=Math.sqrt(x*x+y*y), a=Math.atan2(y,x), t=(rr-ri)/(ro-ri), R=0.3125+t*(0.4648-0.3125); uv.setXY(i, 0.5+Math.cos(a)*R, 0.5+Math.sin(a)*R); }
  g.rotateX(-PI/2); return (SC.geo[key]=g); }
function sc_wheel(ws, M){
  var car=new THREE.Group(), hold=new THREE.Group(), spin=new THREE.Group(), cont=new THREE.Group();
  hold.rotation.x=PI/2; spin.rotation.x=PI/2; cont.rotation.x=ws.z<0?PI:0;
  var ty=new THREE.Mesh(sc_tyreGeo(ws.r, ws.w, ws.rimR), M.rubber); ty.castShadow=true; ty.receiveShadow=true; hold.add(ty);
  var rg=sc_rimGeo(ws.rimR, ws.w, ws.style, ws.brake), rim=new THREE.Mesh(rg.rim, M[ws.rimMat]||M.alu), inn=new THREE.Mesh(rg.inner, ws.brake?M.rotor:M.barrel);
  rim.castShadow=true; cont.add(rim); cont.add(inn);
  var lt=new THREE.Group(), lm=new THREE.Mesh(sc_ringGeo(ws.r, ws.rimR), M.letters); lm.position.y=ws.w/2+0.0035; lm.renderOrder=2; lt.add(lm); if(ws.letters) cont.add(lt);
  spin.add(cont); car.add(hold); car.add(spin);
  car.userData={spin:spin, hold:hold, letters:lt, r:ws.r, hw:ws.w/2, rear:!!ws.rear, side:ws.z<0?-1:1};
  return car;
}

/* --- parachute ------------------------------------------------------------ */
function sc_chute(me, M){
  /* fix pack: a cross-form drag chute (four arms around a centre square, domed), shroud lines from each arm tip to the
     confluence, the fabric flutters in the vertex shader. Canopy axis along local +x (towards the car), rim at x=0. */
  var g=new THREE.Group(), rc=me.chuteR, A=0.375, key="xcano2"+r3(rc), geo=SC.geo[key];
  if(!geo){ var N=20, pos=[], uv=[], idx=[], i, j, DEP=0.34*rc, RA=1.12*rc;
    for(j=0;j<=N;j++) for(i=0;i<=N;i++){ var u=-1+2*i/N, v=-1+2*j/N, r2=Math.min(1,(u*u+v*v)/(1+A*A)), au=Math.abs(u), av=Math.abs(v);
      var puff=0.09*rc*(av<=A?Math.cos(PI/2*v/A):0)*Math.sin(PI*Math.max(0,au-A)/(1-A))+0.09*rc*(au<=A?Math.cos(PI/2*u/A):0)*Math.sin(PI*Math.max(0,av-A)/(1-A));   /* each arm bellies out between its seams */
      pos.push(-DEP*(1-r2)-puff, (u-v)*RA*0.7071, (u+v)*RA*0.7071);   /* set as an X, the way it reads from the chase cams */ uv.push((u+1)/2, (v+1)/2); }
    for(j=0;j<N;j++) for(i=0;i<N;i++){ var uc=-1+2*(i+0.5)/N, vc=-1+2*(j+0.5)/N; if(Math.abs(uc)>A && Math.abs(vc)>A) continue;
      var q=j*(N+1)+i; idx.push(q, q+1, q+N+1, q+1, q+N+2, q+N+1); }
    geo=new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos,3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv,2));
    geo.setIndex(idx); geo.computeVertexNormals(); SC.geo[key]=geo; }
  var mat=sc_chuteMat(M), cn=new THREE.Mesh(geo, mat); cn.castShadow=true; g.add(cn);
  var lg=SC.geo.chuteLine2||(SC.geo.chuteLine2=new THREE.CylinderGeometry(0.009,0.009,1,4,1,true).translate(0,0.5,0));
  var bg=SC.geo.chuteBridle||(SC.geo.chuteBridle=new THREE.CylinderGeometry(0.018,0.018,1,5,1,true).translate(0,0.5,0));
  var lines=[]; for(var k=0;k<4;k++) for(var s2=-1;s2<=1;s2+=2){ var l=new THREE.Mesh(lg, M.lineM), ca=Math.cos(k*PI/2+PI/4), sa=Math.sin(k*PI/2+PI/4);
    l.userData={cy:(ca*0.98-sa*s2*A)*1.12, cz:(sa*0.98+ca*s2*A)*1.12}; g.add(l); lines.push(l); }   /* the two corners of each arm tip */
  var br=new THREE.Mesh(bg, M.lineM); g.add(br);
  g.userData={canopy:cn, lines:lines, bridle:br, rc:rc, fl:mat.userData.fl};
  return g;
}
/* the canopy: white nylon, a coloured band across each arm tip, dark seams; fluttering arms (uFl = time, amount) */
function sc_chuteTex(){
  if(SC.tex.xchute) return SC.tex.xchute;
  var c=sc_canvas(128,128), x=c.getContext("2d"), A=0.375*64, m=64;
  x.fillStyle="#efebe2"; x.fillRect(0,0,128,128);
  x.fillStyle="#e5562b"; x.fillRect(0,m-A,22,2*A); x.fillRect(106,m-A,22,2*A); x.fillRect(m-A,0,2*A,22); x.fillRect(m-A,106,2*A,22);
  x.fillStyle="#1b1c20"; x.fillRect(0,m-A,8,2*A); x.fillRect(120,m-A,8,2*A); x.fillRect(m-A,0,2*A,8); x.fillRect(m-A,120,2*A,8);
  x.strokeStyle="rgba(40,36,30,0.45)"; x.lineWidth=1.5;
  [m-A, m+A].forEach(function(p){ x.beginPath(); x.moveTo(p,0); x.lineTo(p,128); x.moveTo(0,p); x.lineTo(128,p); x.stroke(); });
  x.strokeStyle="rgba(40,36,30,0.25)"; x.beginPath(); x.moveTo(m,0); x.lineTo(m,128); x.moveTo(0,m); x.lineTo(128,m); x.stroke();
  return (SC.tex.xchute=sc_ctex(c));
}
function sc_chuteMat(M){
  var env=M.canopy.envMap||null, fl={value:new THREE.Vector2(0,0)};
  var q=new THREE.MeshStandardMaterial({color:0xffffff, map:sc_chuteTex(), roughness:0.82, metalness:0, envMapIntensity:0.4, side:THREE.DoubleSide}); if(env) q.envMap=env;
  q.userData.fl=fl;
  q.onBeforeCompile=function(sh){ sh.uniforms.uFl=fl;
    sh.vertexShader=sh.vertexShader.replace("#include <common>", "#include <common>\nuniform vec2 uFl;").replace("#include <begin_vertex>",
      "#include <begin_vertex>\nfloat flR=length(position.yz), flA=atan(position.z,position.y);\n"+
      "transformed.x+=uFl.y*flR*flR*(0.07*sin(uFl.x*17.0+flA*2.0+flR*6.0)+0.06*sin(uFl.x*29.0-flR*9.0+flA*3.0));\n"+
      "transformed.yz*=1.0+uFl.y*0.035*sin(uFl.x*21.0+flA*4.0);"); };
  q.customProgramCacheKey=function(){ return "scChuteFl"; };
  return q;
}

/* --- v2: what the car carries -----------------------------------------------
   hw (optional, from setStrip): {asp:"na"|"turbo"|"twin"|"blower"|"centri", ic, als, n2o, diesel, style}
   style (door cars): "coupe" (the 90s shell, default) | "muscle" | "hatch" | "truck". No hw = the v1.5 cars exactly. */
function sc_hw(hw, body){
  if(!hw || typeof hw!=="object") return null;
  var a=String(hw.asp||"na"); if(!/^(na|turbo|twin|blower|centri)$/.test(a)) a="na";
  var st=sc_styleFor(body, String(hw.style||""), !!hw.diesel);   /* v3: per-class shell (strip-cars-shells.js) */
  var H={asp:a, ic:!!hw.ic && a!=="na" && a!=="blower", als:!!hw.als && (a==="turbo"||a==="twin"), n2o:!!hw.n2o, diesel:!!hw.diesel, style:st, lite:GFX==="lite"};
  H.boost=a!=="na"; H.turbo=(a==="turbo"||a==="twin");
  var E=hw.eng&&typeof hw.eng==="object"?hw.eng:null, ek=E&&/^(i|v|flat|rotary|two)$/.test(E.kind)?E.kind:"v";
  H.eng={kind:ek, n:Math.max(1,Math.min(18,(+(E&&E.n)||8)|0)), rotors:Math.max(1,Math.min(4,(+(E&&E.rotors)||2)|0))};
  H.key=[a, H.ic?1:0, H.diesel?1:0, st, H.lite?1:0, ek+H.eng.n+(ek==="rotary"?"r"+H.eng.rotors:"")].join(",");
  return H;
}
/* door-car shells: loft rows (see sc_def) + where the glass, wheels and hood hardware go */
var SC_STYLE={
  coupe:{xr:-1.28, xf:1.27, roofF:0.18, cowl:0.98, roofR:-0.5, deck:-1.62, dG0:-0.52, qG0:-1.12, hx:1.3},
  muscle:{xr:-1.32, xf:1.42, roofF:0.06, cowl:0.72, roofR:-0.6, deck:-1.12, dG0:-0.42, qG0:-0.95, hx:1.36, rows:[
    [-2.36,.30,.85,.89,.86,.82,.02],[-2.28,.24,.92,.965,.89,.85,.02],[-1.85,.21,.93,.985,.90,.86,.03],[-1.42,.20,.935,1.0,.905,.82,.04],
    [-1.08,.19,.935,1.16,.905,.70,.05],[-0.62,.19,.935,1.285,.905,.645,.05],[0.06,.19,.935,1.295,.905,.645,.05],[0.46,.19,.935,1.09,.905,.77,.04],
    [0.72,.19,.93,.975,.905,.845,.03],[1.40,.20,.92,.96,.90,.86,.02],[2.02,.22,.90,.935,.89,.85,.02],[2.30,.25,.84,.875,.86,.82,.02],[2.40,.31,.73,.76,.80,.76,.02]]},
  hatch:{xr:-1.2, xf:1.2, roofF:0.06, cowl:0.84, roofR:-1.42, deck:-1.86, dG0:-0.42, qG0:-1.3, hx:1.24, spoilerRoof:true, rows:[
    [-1.98,.33,.84,.93,.80,.74,.02],[-1.92,.26,.88,1.04,.84,.77,.03],[-1.78,.22,.89,1.17,.85,.71,.04],[-1.45,.20,.90,1.29,.86,.645,.05],
    [-0.60,.20,.91,1.33,.865,.625,.05],[0.06,.20,.91,1.30,.865,.64,.05],[0.55,.20,.905,1.06,.86,.74,.04],[0.84,.20,.89,.93,.855,.80,.03],
    [1.35,.21,.85,.885,.85,.80,.03],[1.82,.24,.74,.765,.82,.76,.02],[1.98,.30,.62,.64,.76,.70,.02]]},
  truck:{xr:-1.42, xf:1.36, roofF:0.14, cowl:0.86, roofR:-0.52, deck:-0.74, dG0:-0.4, qG0:null, hx:1.4, bed:true, rows:[
    [-2.30,.36,.86,.90,.84,.80,.02],[-2.24,.30,.90,.95,.86,.83,.02],[-1.90,.26,.91,.955,.87,.84,.02],[-0.86,.24,.915,.955,.87,.84,.02],
    [-0.70,.23,.92,1.36,.87,.60,.04],[-0.55,.22,.92,1.41,.87,.62,.05],[0.14,.21,.92,1.41,.87,.62,.05],[0.55,.20,.915,1.14,.87,.74,.04],
    [0.86,.20,.905,.985,.865,.81,.03],[1.40,.21,.89,.95,.86,.82,.03],[1.95,.24,.82,.855,.85,.80,.02],[2.16,.30,.72,.74,.82,.76,.02]]}
};
/* a forward-facing compressor inlet (turbo / centrifugal through the grille) */
function sc_bell(B, x, y, z, r){
  B.add("chrome", new THREE.CylinderGeometry(r, r*0.82, 0.16, 16, 1, true), sc_M(x, y, z, 0,0,-PI/2));
  B.add("chrome", new THREE.TorusGeometry(r*1.02, r*0.12, 6, 18), sc_M(x+0.08, y, z, 0,PI/2,0));
  B.add("well", new THREE.CircleGeometry(r*0.9, 14), sc_M(x+0.02, y, z, 0,PI/2,0));
}
/* front-mount intercooler in the lower grille */
function sc_ic(B, x, y, w, h){
  B.add("alu", sc_rbox(0.05, h, w, 0.008), sc_M(x+0.02, y, 0));
  B.add("satin", sc_rbox(0.03, h*0.92, w*0.11, 0.008), sc_M(x+0.035, y, w*0.47));
  B.add("satin", sc_rbox(0.03, h*0.92, w*0.11, 0.008), sc_M(x+0.035, y, -w*0.47));
  for(var i=0;i<3;i++) B.add("black", sc_rbox(0.012, 0.006, w*0.8, 0.002), sc_M(x+0.047, y-h*0.3+i*h*0.3, 0));
}

/* --- body packs (cached geometry per body + tyre) --------------------------- */
function sc_pack(body, tIn, H){
  var key=body+"|"+tIn+(H?"|"+H.key:(GFX!=="lite"?"|d":""));   /* no hw (road, hill, oval): Full / Ultra get the cabin, Lite does not */ if(SC.geo[key]) return SC.geo[key];
  var rr=tIn*0.0254/2, B=sc_bin(), me, res={parts:{}, decals:[], tail:null, head:null};
  var tails=[], heads=[]; SC.lite=!!(H && H.lite);
  if(body==="rail") me=H?sc_tfrail(B, rr, tails, heads, res, H):sc_rail(B, rr, tails, heads, res, H);
  else if(body==="funny") me=sc_funny(B, rr, tails, heads, res, H||sc_hw({asp:"blower"}, "funny"));
  else me=sc_door(B, body, rr, tails, heads, res, H, tIn);
  if(body!=="rail") sc_skirt(B, me);   /* fix pack: side skirts under the sill (strip-ground.js) */
  SC.lite=false;
  if(H && H.lite) [B, res.flipB].forEach(sc_liteBins);   /* v3: Lite folds the extra trim materials into their base ones (no extra draw calls) */
  for(var k in B) if(k!=="add" && B[k].length) res.parts[k]=sc_merge(B[k]);
  if(res.flipB){ res.flip={}; for(k in res.flipB) if(k!=="add" && res.flipB[k].length) res.flip[k]=sc_merge(res.flipB[k]); delete res.flipB; }
  if(tails.length) res.tail=sc_merge(tails);
  if(heads.length) res.head=sc_merge(heads);
  res.meta=me; SC.geo[key]=res; return res;
}
function sc_decal(res, g, kind){ res.decals.push({g:g, kind:kind||"door"}); }

/* v2 hood by aspiration: blower through the hood; NA street = cowl induction, outlaw = scoop, promod = tall scoop;
   boosted = a low bulge (street / outlaw) or a flat carbon hood (promod: the turbos show in the grille) */
function sc_hoodKind(H, body){
  if(!H) return body==="outlaw"?"scoop":body==="promod"?"blower":"none";
  if(body==="prostock") return H.asp==="na"?"pstock":H.asp==="blower"?"blower":"none";   /* v3: the pro stock's tall hood scoop */
  if(body==="gasser") return H.asp==="na"?"stacks":H.asp==="blower"?"blower":"bulge";      /* v3: injector stacks through the hood */
  if(H.asp==="blower") return "blower";
  if(H.asp==="na") return body==="street"?"cowl":body==="outlaw"?"scoop":"tall";
  return body==="promod"?"none":"bulge";
}
function sc_doorHw(B, D, H, kind, body, hx, hood, slope, cowl, cF, gates){
  var P={}, st=body==="street", pm=body==="promod", hat=null, i;
  if(kind==="blower"){
    B.add("alu", sc_rbox(0.62,0.2,0.34,0.03), sc_M(hx, hood+0.06, 0));
    B.add("satin", sc_rbox(0.66,0.04,0.38,0.012), sc_M(hx, hood+0.17, 0));
    B.add("black", sc_rbox(0.5,0.03,0.4,0.01), sc_M(hx, hood-0.02, 0));
    for(i=0;i<5;i++) B.add("satin", sc_rbox(0.012,0.12,0.36,0.004), sc_M(hx-0.24+i*0.12, hood+0.07, 0));   /* case ribs */
    B.add(pm?"carbon":"alu", sc_prof([[0.2,0],[0.24,0.26],[0.08,0.3],[-0.22,0.24],[-0.22,0]], 0.3, 0.015), sc_M(hx+0.02, hood+0.19, 0));
    B.add("well", sc_rbox(0.02,0.18,0.22,0.01), sc_M(hx+0.235, hood+0.33, 0, 0,0,0.15));
    hat=new THREE.Vector3(hx+0.05, hood+0.5, 0);
  } else if(kind==="scoop"){
    B.add("paint", sc_prof([[0.45,0],[0.3,0.07],[0.0,0.12],[-0.42,0.13],[-0.5,0.02],[-0.5,0]], 0.66, 0.02), sc_M(hx, hood-0.01, 0, 0,0,slope));
    B.add("well", sc_rbox(0.02,0.09,0.54,0.01), sc_M(hx-0.515, hood+0.065, 0, 0,0,slope));
  } else if(kind==="tall"){
    B.add("carbon", sc_prof([[0.34,0],[0.26,0.3],[-0.12,0.33],[-0.36,0.05],[-0.36,0]], 0.34, 0.02), sc_M(hx, hood-0.01, 0));
    B.add("well", sc_rbox(0.02,0.16,0.26,0.01), sc_M(hx+0.3, hood+0.2, 0, 0,0,0.27));
    hat=new THREE.Vector3(hx+0.2, hood+0.38, 0);
  } else if(kind==="pstock" || kind==="stacks"){
    hat=sc_hoodX(B, D, kind, hx, hood, slope, cowl);
  } else if(kind==="cowl" || kind==="bulge"){
    var cx=cowl+(kind==="cowl"?0.42:0.5); sc_params(D, cx, P); var cy=P.yt, hgt=kind==="cowl"?0.075:0.05;
    B.add("paint", sc_prof([[0.5,0],[0.25,hgt*0.8],[-0.25,hgt],[-0.38,hgt*0.9],[-0.4,0]], kind==="cowl"?0.56:0.74, 0.02), sc_M(cx, cy-0.012, 0, 0,0,slope*0.5));
    if(kind==="cowl") B.add("well", sc_rbox(0.015,hgt*0.7,0.46,0.006), sc_M(cx-0.395, cy+hgt*0.45, 0, 0,0,slope*0.5));
  }
  if(H.ic){ var icy=lerp(cF.zb,cF.ys,pm?0.42:0.36); sc_ic(B, cF.x, icy, pm?0.62:0.52, pm?0.13:0.15); }
  if(!st && (H.turbo || H.asp==="centri")){   /* outlaw / promod: the compressor inlets stick out through the grille */
    var by=lerp(cF.zb,cF.ys,0.66), n=H.asp==="twin"?2:1;
    for(i=0;i<n;i++) sc_bell(B, cF.x+0.04, by, n>1?(i?0.22:-0.22):0.2, pm?0.1:0.09);
  }
  if(H.turbo){   /* wastegate dumps (screamer pipes) poke up through the hood: the flutter puffs come out of these */
    var gx=cowl+0.3; sc_params(D, gx, P);
    (H.asp==="twin"?[-1,1]:[1]).forEach(function(sd){ var z=sd*Math.min(0.36, P.wt*0.55), a=new THREE.Vector3(gx, P.yt-0.04, z), b=new THREE.Vector3(gx-0.05, P.yt+0.13, z+sd*0.02);
      B.add("chrome", sc_cyl(0.03,10), sc_rodM(a,b)); B.add("well", new THREE.CircleGeometry(0.026,10), sc_M(b.x, b.y+0.001, b.z, -PI/2,0,0));
      gates.push({p:b.clone(), d:new THREE.Vector3(-0.25,1,0).normalize()}); });
  }
  return {hat:hat};
}
/* door cars: street (90s coupe), outlaw (radial car), promod */
function sc_door(B, body, rr, tails, heads, res, H, tIn){
  var I=new THREE.Matrix4(), gs=body==="gasser", ps=body==="prostock", st=body==="street"||gs, ol=body==="outlaw", pm=body==="promod"||ps;
  var SY=H?sc_shell(body, H.style):null;   /* v2: the rival's (or your) shell; null = the v1.5 car (v3: every class has shells, pm "modern" = null) */
  var rr0=SY&&SY.rr0?SY.rr0:st?0.343:ol?0.381:0.419, lift=(rr-rr0)*0.7;
  var fr=SY&&SY.fr?(SY.fr<0?rr:SY.fr):st?clamp(rr*0.94,0.3,0.335):0.335, xr=SY?SY.xr:pm?-1.34:-1.28, xf=SY?SY.xf:pm?1.40:1.27, rows;
  /* v2 tyre-size cue: the rear tyre gets wider with its height, and a fat tyre on a street car gets flared tubs */
  var rwH=H?(st?clamp(0.2+(tIn-24)*0.025,0.2,0.37):ol?clamp(0.28+(tIn-28)*0.025,0.28,0.42):clamp(0.36+(tIn-31)*0.025,0.36,0.46)):0;
  if(SY && SY.rows) rows=SY.rows.map(function(r){ return r.slice(); });
  else if(pm) rows=[
    [-2.42,.36,.84,.90,.86,.82,.02],[-2.32,.28,.95,1.0,.94,.88,.02],[-1.95,.22,.985,1.03,.97,.90,.03],[-1.50,.20,.975,1.07,.97,.78,.05],
    [-0.90,.19,.935,1.19,.965,.665,.05],[-0.20,.19,.91,1.215,.96,.645,.05],[0.22,.185,.90,1.12,.958,.72,.05],[0.64,.18,.885,.945,.955,.84,.04],
    [1.10,.17,.87,.915,.95,.87,.03],[1.80,.16,.80,.84,.94,.86,.03],[2.30,.165,.68,.72,.90,.82,.02],[2.52,.19,.56,.59,.80,.72,.02]];
  else rows=[
    [-2.28,.34,.80,.85,.82,.78,.02],[-2.20,.27,.88,.94,.875,.83,.02],[-1.95,.22,.90,.97,.895,.84,.03],[-1.55,.20,.91,1.02,.90,.78,.04],
    [-1.05,.19,.915,1.17,.905,.69,.05],[-0.50,.19,.92,1.305,.905,.645,.05],[0.18,.19,.92,1.315,.905,.64,.05],[0.62,.19,.915,1.12,.905,.73,.05],
    [0.98,.19,.905,.97,.90,.81,.04],[1.40,.20,.875,.93,.895,.835,.03],[1.95,.22,.78,.82,.88,.82,.03],[2.18,.26,.67,.70,.835,.78,.02],[2.29,.32,.59,.61,.77,.71,.02]];
  if(ol) rows.forEach(function(r){ if(r[3]>1.1) r[3]-=0.055*clamp((r[3]-1.1)/0.2,0,1); });   /* chopped roof */
  var xR=rows[0][0], xF=rows[rows.length-1][0];
  var gapR=SY&&SY.gapR?SY.gapR:pm?0.045:0.05, gapF=0.05;
  var flares=[]; if(!st) flares.push({x:xr, span:pm?0.75:0.6, amt:pm?0.035:0.025, up:0.03});
  if(H && st && rwH>0.285) flares.push({x:xr, span:0.62, amt:(rwH-0.26)*0.75, up:0.025});
  if(SY && SY.flares) flares=flares.concat(SY.flares);
  if(SY && SY.gapF) gapF=SY.gapF;
  var rake=SY&&SY.rake!=null?SY.rake:ol?-0.012:pm?-0.006:0;
  var D=sc_def(rows, {arches:[{x:xr, y:rr, R:rr+gapR},{x:xf, y:fr, R:fr+gapF}], rake:rake, rakeX:xr, lift:lift+(ol?0.02:0)+(SY&&SY.lift||0), flares:flares, sub:(H && !H.lite)?3:2});
  var P={}, R=new Float32Array(40), v=new THREE.Vector3();
  /* glass: windshield, backlight, door + quarter glass both sides */
  var roofF=SY?SY.roofF:pm?-0.2:0.18, cowl=SY?SY.cowl:pm?0.64:0.98, roofR=SY?SY.roofR:pm?-0.9:-0.5, deck=SY?SY.deck:pm?-1.5:-1.62;
  var dG0=SY?SY.dG0:pm?-0.62:-0.52, dG1=cowl-0.06, qG0=SY?SY.qG0:pm?-1.05:-1.12, qG1=dG0-0.07;
  var WIN=[{x0:roofF+0.03, x1:cowl-0.03, k0:8.28, k1:11.72}];
  if(roofR-deck>0.1) WIN.push({x0:deck+0.06, x1:roofR-0.03, k0:8.28, k1:11.72});
  [[dG0,dG1],[qG0,qG1]].forEach(function(r){ if(r[0]==null) return; WIN.push({x0:r[0], x1:r[1], k0:5.42, k1:7.7}, {x0:r[0], x1:r[1], k0:12.3, k1:14.58, L:true}); });
  /* Full / Ultra: the windows are open in the body, the glass is see-through and there is a cabin behind it (Lite: the old dark glass) */
  var det=H?!H.lite:GFX!=="lite";
  var L=sc_loft(D, det?WIN:null);
  B.add("paint", L.paint); B.add("well", L.well);
  WIN.forEach(function(w){ B.add(det?"glassT":"glass", sc_patch(D, w.x0, w.x1, w.k0, w.k1, 0.006, w.L?"L":null)); });
  /* door shut lines */
  [dG1+0.02, dG0-0.1].concat(SY&&SY.seams||[]).forEach(function(x){ B.add("seam", sc_patch(D, x, x+0.009, 1.6, 5.2, 0.002)); B.add("seam", sc_patch(D, x, x+0.009, 14.8, 18.4, 0.002)); });
  if(det) res.liner=true;
  if(det) sc_detail(B, D, {body:body, st:st, ol:ol, pm:pm, gs:gs, SY:SY, H:H, rows:rows, cowl:cowl, roofF:roofF, roofR:roofR, deck:deck, dG0:dG0, dG1:dG1, xr:xr, xf:xf, rr:rr, fr:fr});
  /* door decals + windshield banner */
  var dx0=SY&&SY.door?SY.door[0]:pm?-0.5:-0.42, dx1=SY&&SY.door?SY.door[1]:pm?0.5:0.58;
  sc_decal(res, sc_patch(D, dx0, dx1, 2.3, 4.75, 0.004, null, 0.5)); sc_decal(res, sc_patch(D, dx0, dx1, 15.25, 17.7, 0.004, "L", 0.5));
  sc_decal(res, sc_patch(D, roofF+0.02, roofF+0.17, 8.3, 11.7, 0.009, "K", 0.5), "banner");
  var hoodK=sc_hoodKind(H, body);   /* v2: what sits on the hood (scoop, blower, cowl...) */
  var hdF=rows[rows.length-1][0];
  res.hood=SY&&SY.hood?sc_patch(D, SY.hood[0], SY.hood[1], 8.45, 11.55, 0.012, "K", 0.5):pm?sc_patch(D, 1.45, 2.12, 8.45, 11.55, 0.012, "K", 0.5):(ol||(H && st && hoodK!=="none"))?sc_patch(D, hdF-0.5, hdF-0.1, 8.5, 11.5, 0.012, "K", 0.5):sc_patch(D, cowl+0.12, cowl+0.68, 8.45, 11.55, 0.012, "K", 0.5);
  if(SY && SY.bed) B.add("well", sc_patch(D, rows[0][0]+0.12, deck-0.1, 8.3, 11.7, 0.004));   /* pickup bed */   /* primary sponsor on the hood, clear of the outlaw scoop / promod blower (hidden until there is one) */
  if(pm && !(SY && SY.noCarbonHood)) B.add("carbon", sc_patch(D, cowl+0.02, hdF-0.24, 7.4, 12.6, 0.003));
  /* front + rear caps: lamps, grille, bumpers (v3: a shell with its own fascia, bumpers and mirrors dresses itself) */
  var cF=L.capF, cR=L.capR, hy=lerp(cF.zb,cF.ys,0.72), ly=lerp(cF.zb,cF.ys,0.3);
  if(SY && SY.dress) SY.dress({B:B, D:D, cF:cF, cR:cR, tails:tails, heads:heads, H:H, body:body, cowl:cowl, xR:xR, xF:xF, xr:xr, xf:xf, rr:rr, fr:fr, SY:SY, deck:deck, roofR:roofR, roofF:roofF, dG0:dG0, qG0:qG0});
  else {
  var hl=sc_rbox(0.03, pm?0.08:0.1, pm?0.26:0.3, 0.012);
  [-1,1].forEach(function(sd){
    heads.push({g:hl, m:sc_M(cF.x, hy, sd*cF.w*0.56)});
    if(!pm) B.add("black", sc_rbox(0.03,0.05,0.12,0.01), sc_M(cF.x+0.004, hy-0.075, sd*cF.w*0.8));
    if(det){ B.add("black", sc_rbox(0.03, pm?0.1:0.122, pm?0.29:0.33, 0.012), sc_M(cF.x-0.007, hy, sd*cF.w*0.56));   /* the lamp's housing round the lens, two projector bezels in it */
      [-1,1].forEach(function(q){ B.add("chromeT", sc_bezel(pm?0.026:0.032, 0.007), sc_M(cF.x+0.017, hy, sd*cF.w*0.56+q*(pm?0.065:0.075))); }); }
  });
  B.add("black", sc_rbox(0.04, pm?0.07:0.09, cF.w*(pm?1.2:0.95), 0.02), sc_M(cF.x, ly, 0));
  if(!pm) B.add("satin", sc_rbox(0.03, 0.06, cF.w*0.5, 0.012), sc_M(cF.x+0.005, hy, 0));
  B.add(pm?"carbon":"black", sc_prof([[0,0],[0.32,0],[0.34,0.035],[0,0.05]], cF.w*2*0.98, 0.006), sc_M(cF.x-0.3, cF.zb-0.035, 0));
  var ty=lerp(cR.zb,cR.ys,0.74);
  tails.push({g:sc_rbox(0.03, 0.11, cR.w*(st?1.85:0.55), 0.015), m:sc_M(cR.x-0.004, ty, 0)});
  if(!st) [-1,1].forEach(function(sd){ tails.push({g:sc_rbox(0.03,0.09,0.36,0.015), m:sc_M(cR.x-0.004, ty, sd*cR.w*0.68)}); });
  if(det && st){ B.add("black", sc_rbox(0.03, 0.13, cR.w*1.89, 0.015), sc_M(cR.x+0.004, ty, 0));   /* tail-lamp surround and the lens split into lamps */
    [-0.62,-0.2,0.2,0.62].forEach(function(f){ B.add("seam", sc_rbox(0.012, 0.11, 0.012, 0.003), sc_M(cR.x-0.02, ty, f*cR.w)); }); }
  B.add("black", sc_rbox(0.05, 0.12, cR.w*1.9, 0.025), sc_M(cR.x+0.01, lerp(cR.zb,cR.ys,0.22), 0));
  /* mirrors */
  sc_params(D, cowl-0.04, P);
  [-1,1].forEach(function(sd){
    B.add("paint", sc_prof([[0.07,0.01],[0.0,-0.01],[-0.06,0.0],[-0.065,0.075],[0.0,0.085],[0.06,0.06]], 0.13, 0.012), sc_M(cowl-0.05, P.ys+0.06, sd*(P.w+0.1)));
    B.add("glass", sc_rbox(0.008,0.06,0.1,0.003), sc_M(cowl-0.117, P.ys+0.097, sd*(P.w+0.1)));
    B.add("black", sc_rbox(0.05,0.025,0.1,0.008), sc_M(cowl-0.03, P.ys+0.045, sd*(P.w+0.04)));
  });
  }
  /* inner wheel-well liners (stop see-through under the arches) */
  [[xr,rr+gapR,rr],[xf,fr+gapF,fr]].forEach(function(a){ var s=new THREE.Shape(); s.absarc(0,0,a[1],0,PI,false); s.lineTo(-a[1],0);
    var lg=new THREE.ShapeGeometry(s,8); [-1,1].forEach(function(sd){ B.add("well", lg, sc_M(a[0], a[2], sd*0.36, 0, sd>0?0:PI, 0)); }); });
  /* wheels */
  var rw=H?rwH:st?0.26:ol?0.34:0.43, fw=SY&&SY.fw?(SY.fw<0?rw:SY.fw):st?0.225:0.115;
  sc_params(D, xr, P); var zr=P.w-(st?0.015:0.05)-rw/2; sc_params(D, xf, P); var zf=SY&&SY.fz!=null?P.w-SY.fz-fw/2:st?P.w-0.02-fw/2:P.w-0.11-fw/2;
  var wh=[], brk=det;
  [-1,1].forEach(function(sd){
    wh.push({x:xr, z:sd*zr, r:rr, w:rw, rimR:pm?0.205:0.19, style:SY&&SY.rimR?SY.rimR:st?"star":pm?"bead":"weld", rimMat:SY&&SY.rimMat?SY.rimMat:pm?"rimBlack":"alu", rear:true, letters:true, brake:brk});
    wh.push({x:xf, z:sd*zf, r:fr, w:fw, rimR:0.19, style:SY&&SY.rimF?SY.rimF:st?"star":"weld", rimMat:SY&&SY.rimMat?SY.rimMat:pm?"rimBlack":"alu", rear:false, letters:SY&&SY.lettersF!=null?SY.lettersF:st, brake:brk});
  });
  if(brk) sc_calipers(B, wh, true);
  if(SY && SY.chassis) SY.chassis({B:B, D:D, H:H, xr:xr, xf:xf, rr:rr, fr:fr, zf:zf, zr:zr, fw:fw, rw:rw, cF:cF, cR:cR});
  /* hood: outlaw scoop, promod blower + injector hat */
  var hx=SY?SY.hx:pm?1.05:1.3; sc_params(D, hx, P); var hood=P.yt;
  sc_params(D, hx+0.35, P); var slope=Math.atan2(P.yt-hood, 0.35);
  var gates=[], hat=null;
  if(H){ var hwr=sc_doorHw(B, D, H, hoodK, body, hx, hood, slope, cowl, L.capF, gates); hat=hwr.hat; }
  else if(ol){
    B.add("paint", sc_prof([[0.45,0],[0.3,0.07],[0.0,0.12],[-0.42,0.13],[-0.5,0.02],[-0.5,0]], 0.66, 0.02), sc_M(hx, hood-0.01, 0, 0,0,slope));
    B.add("well", sc_rbox(0.02,0.09,0.54,0.01), sc_M(hx-0.515, hood+0.065, 0, 0,0,slope));
  }
  if(pm && !H){
    B.add("alu", sc_rbox(0.62,0.2,0.34,0.03), sc_M(hx, hood+0.06, 0));
    B.add("satin", sc_rbox(0.66,0.04,0.38,0.012), sc_M(hx, hood+0.17, 0));
    B.add("carbon", sc_prof([[0.2,0],[0.24,0.26],[0.08,0.3],[-0.22,0.24],[-0.22,0]], 0.3, 0.015), sc_M(hx+0.02, hood+0.19, 0));
    B.add("well", sc_rbox(0.02,0.18,0.22,0.01), sc_M(hx+0.235, hood+0.33, 0, 0,0,0.15));
  }
  /* rear: spoiler (street/outlaw) or big wing (promod) */
  sc_params(D, xR+0.2, P); var dk=P.yt;
  if(SY && SY.rear) SY.rear({B:B, D:D, xR:xR, dk:dk, tails:tails, H:H, body:body, roofR:roofR});   /* v3: the shell's own spoiler / wing / nothing */
  else if(SY && SY.bed){}   /* pickup: no deck spoiler */
  else if(!pm){
    B.add("paint", sc_foil(0.24, 0.06, 1.5), sc_M(xR+0.14, dk+0.1, 0, 0,0,-0.08));
    [-0.6,0.6].forEach(function(z){ B.add("paint", sc_rbox(0.12,0.1,0.05,0.015), sc_M(xR+0.16, dk+0.045, z)); });
    tails.push({g:sc_rbox(0.03,0.025,0.34,0.008), m:sc_M(xR+0.02, dk+0.105, 0)});
  } else {
    var wy=SY&&SY.wingY?SY.wingY:1.46, wx=xR+0.22;
    B.add("carbon", sc_foil(0.54, 0.12, 1.78), sc_M(wx, wy, 0, 0,0,-0.24));
    B.add("carbon", sc_rbox(0.03,0.06,1.78,0.006), sc_M(wx-0.27, wy+0.09, 0));
    [-1,1].forEach(function(sd){
      B.add("carbon", sc_prof([[0.32,-0.14],[0.34,0.12],[-0.36,0.2],[-0.38,-0.14]], 0.014, 0.003), sc_M(wx, wy, sd*0.9));
      B.add("tube", sc_cyl(0.02,8), sc_rodM(new THREE.Vector3(wx-0.02, dk-0.02, sd*0.42), new THREE.Vector3(wx+0.03, wy-0.06, sd*0.42)));
      B.add("tube", sc_cyl(0.012,6), sc_rodM(new THREE.Vector3(wx-0.28, dk-0.02, sd*0.42), new THREE.Vector3(wx+0.02, wy-0.05, sd*0.42)));
    });
  }
  /* exhaust */
  var tips=[], dirs=[];
  /* side pipes are placed for the class's own tyre; a taller or shorter tyre lifts the body, so they ride with it */
  var dLift=lift-((SC_BODY_TYRE[body]||30)*0.0127-rr0)*0.7;
  if(SY && SY.exhaust) SY.exhaust({B:B, D:D, H:H, tips:tips, dirs:dirs, xR:xR, xf:xf, cR:cR, deck:deck, body:body, dLift:dLift});
  else if(H && H.diesel && SY && SY.bed){
    [-1,1].forEach(function(sd){ var x0=deck+0.02, z0=sd*0.62, y1=1.84;
      B.add("chrome", sc_cyl(0.06,12), sc_rodM(new THREE.Vector3(x0, 0.86, z0), new THREE.Vector3(x0, y1, z0)));
      B.add("well", new THREE.CircleGeometry(0.055,12), sc_M(x0, y1+0.002, z0, -PI/2,0,0));
      tips.push(new THREE.Vector3(x0, y1+0.02, z0)); dirs.push(new THREE.Vector3(-0.15,1,0).normalize()); });
  } else if(H && H.diesel && st){
    var pD=new THREE.Vector3(xR-0.04, cR.zb-0.04, 0.5);
    B.add("chrome", new THREE.CylinderGeometry(0.065,0.065,0.24,14,1,true), sc_M(pD.x+0.1, pD.y, pD.z, 0,0,PI/2));
    B.add("well", new THREE.CircleGeometry(0.06,14), sc_M(pD.x+0.03, pD.y, pD.z, 0,-PI/2,0));
    tips.push(pD); dirs.push(new THREE.Vector3(-1,-0.08,0).normalize());
  } else if(st){
    [-1,1].forEach(function(sd){ var p=new THREE.Vector3(xR-0.04, cR.zb-0.06, sd*0.52);
      B.add("chrome", new THREE.CylinderGeometry(0.045,0.045,0.22,12,1,true), sc_M(p.x+0.1, p.y, p.z, 0,0,PI/2));
      B.add("well", new THREE.CircleGeometry(0.04,12), sc_M(p.x+0.03, p.y, p.z, 0,-PI/2,0));
      tips.push(p); dirs.push(new THREE.Vector3(-1,0,0)); });
  } else {
    /* Pro Mod: a pipe per cylinder out of the fender; outlaw: merged pairs. Same engine length whatever the count */
    var PO=sc_ports(H), nP=pm?PO.per:Math.max(1,Math.ceil(PO.per/2)), ex0=pm?0.66:0.62, sp=Math.min(pm?0.075:0.1, (pm?0.3:0.2)/Math.max(1,nP-1)), rP=(pm?0.028:0.034)*PO.r, yF=PO.flat?-0.08:0;
    if(nP<(pm?4:2)) ex0+=((pm?4:2)-nP)*sp*0.5;
    PO.sides.forEach(function(sd){
      sc_params(D, ex0, P);
      for(var i=0;i<nP;i++){
        var x0=ex0+i*sp, y0=(pm?0.5:0.42)+dLift+yF, a=new THREE.Vector3(x0+0.06, y0, sd*(P.w-0.1)), b=new THREE.Vector3(x0+0.02, y0+0.03, sd*(P.w+0.05));
        var c=pm?new THREE.Vector3(x0-0.16, y0+0.2+i*0.012, sd*(P.w+0.16)):new THREE.Vector3(x0-0.12, y0-0.06, sd*(P.w+0.13));
        B.add("alu", sc_pipe([a,b,c], rP)); sc_pipeEnd(B, "alu", b, c, rP);
        if(pm?(nP<3||(PO.one?true:PO.tip(i))):true){ tips.push(c.clone()); dirs.push(c.clone().sub(b).normalize()); }
      }
    });
  }
  /* wheelie bars + chute pack */
  var bars=!st, anchor, maxP=gs?deg(14):st?deg(12):ol?deg(5):deg(4);
  if(bars){
    var bx0=xR+0.1, bx1=xR-(pm?1.55:1.35), br=0.065;
    var dxB=bx1-xr, cy=(br-rr-dxB*Math.sin(maxP))/Math.cos(maxP)+rr;
    [-1,1].forEach(function(sd){
      var a=new THREE.Vector3(bx0, 0.3, sd*0.36), b=new THREE.Vector3(bx1, cy, sd*0.3);
      B.add("tube", sc_cyl(0.022,8), sc_rodM(a,b));
      B.add("tube", sc_cyl(0.014,6), sc_rodM(new THREE.Vector3(bx0, 0.46, sd*0.36), b));
      B.add("rubber", new THREE.CylinderGeometry(br,br,0.045,14), sc_M(bx1, cy, sd*0.3, PI/2,0,0));
      B.add("alu", new THREE.CylinderGeometry(br*0.55,br*0.55,0.05,10), sc_M(bx1, cy, sd*0.3, PI/2,0,0));
    });
    B.add("tube", sc_cyl(0.018,8), sc_rodM(new THREE.Vector3(bx1+0.05, cy, -0.3), new THREE.Vector3(bx1+0.05, cy, 0.3)));
    B.add("tube", sc_cyl(0.018,8), sc_rodM(new THREE.Vector3(lerp(bx0,bx1,0.5), lerp(0.3,cy,0.5), -0.33), new THREE.Vector3(lerp(bx0,bx1,0.5), lerp(0.3,cy,0.5), 0.33)));
    var py=lerp(cR.zb,cR.ys,0.45);
    B.add("bag", sc_rbox(0.2, 0.26, 0.4, 0.05), sc_M(xR-0.09, py, 0));
    B.add("satin", sc_rbox(0.05, 0.3, 0.44, 0.012), sc_M(xR+0.0, py, 0));
    B.add("paint", sc_rbox(0.03, 0.2, 0.3, 0.012), sc_M(xR-0.2, py, 0));
    anchor=new THREE.Vector3(xR-0.2, py, 0);
  } else anchor=new THREE.Vector3(xR-0.05, cR.zb+0.05, 0);
  return { rr:rr, fr:fr, xr:xr, xf:xf, wheels:wh, tips:tips, dirs:dirs, anchor:anchor, bars:bars, maxPitch:maxP, gates:gates, hat:hat,
    squat:st?deg(1.6):deg(0.7), squatDrop:st?0.035:0.015, shiftKick:st?0.22:0.12, pitchW:st?6.5:8.5, droop:st?0.07:0.04, wrinkle:st?0.55:1,
    chuteLen:pm?5.2:4.4, chuteRise:pm?0.45:0.35, chuteR:pm?0.95:0.8, flames:SY&&SY.flames?tips.map(function(t,i){ return {p:t.clone(), d:dirs[i].clone()}; }):null,
    headers:SY&&(SY.flames||ps)?tips.map(function(t,i){ return {p:t.clone(), d:dirs[i].clone()}; }):undefined };   /* v3: night header flames (dragfx) for gassers + pro stock */
}

/* Full / Ultra door cars: what the open windows show, and the small body detail that makes a shell read as a real car.
   Cabin (left-hand drive, so the driver sits at -z): floor, firewall and dash with the gauge binnacle, transmission tunnel and
   shifter, bucket seat(s) (race classes: one, with head wings), a parcel shelf and rear bulkhead (street road cars: a rear
   bench), the steering wheel on its column, a driver in a firesuit and a helmet in the car's colour. Race classes add a cage
   (street drag cars: a four-point roll bar). Outside: a door handle each side, the hood and boot shut lines. Every height
   is a fraction of floor-to-roof at that x, so the same code fits a low pro mod and a tall crew-cab pickup. */
var _sdQ=new THREE.Quaternion(), _sdN=new THREE.Vector3(), _sdZ=new THREE.Vector3(0,0,1), _sdS=new THREE.Vector3(1,1,1), _sdP=new THREE.Vector3();
function sc_detail(B, D, o){
  var V=function(x,y,z){ return new THREE.Vector3(x,y,z); }, at=function(x){ return sc_params(D, x, {}); };
  var race=!!o.H && !(o.st && !o.gs), road=!o.H, i;
  var xH=clamp(o.dG0+0.3, o.roofR+0.15, o.roofF-0.12), Ph=at(xH), fl=Ph.zb+0.07, hy=lerp(fl, Ph.yt, 0.72);
  var zD=-Math.min(0.37, Ph.w*0.42), wIn=Ph.w-0.07;
  /* floor, firewall, dash */
  var yD=at(o.cowl).yt-0.05, xb=Math.max(o.deck+0.03, xH-(road?0.95:0.42)), xF=o.cowl-0.06;
  B.add("cabin", sc_rbox(xF-xb, 0.03, wIn*2, 0.01), sc_M((xF+xb)/2, fl, 0));
  var wD=at(o.cowl-0.2).w-0.06;
  B.add("cabin", sc_prof([[0,0],[-0.34,-0.02],[-0.41,-0.08],[-0.39,-0.25],[-0.2,-0.3],[0,-0.32]], wD*2, 0.02), sc_M(o.cowl-0.02, yD, 0));
  B.add("cabin", sc_rbox(0.04, Math.max(0.05, yD-0.3-fl), wD*2, 0.01), sc_M(o.cowl-0.1, (yD-0.3+fl)/2, 0));
  B.add("cabin", sc_rbox(0.16, 0.07, 0.34, 0.02), sc_M(o.cowl-0.36, yD+0.015, zD));                  /* gauge binnacle */
  B.add("well", sc_rbox(0.01, 0.05, 0.28, 0.004), sc_M(o.cowl-0.443, yD+0.0, zD));                   /* the gauges' dark faces */
  /* tunnel + shifter */
  B.add("cabin", sc_rbox(0.9, 0.16, 0.22, 0.04), sc_M(xH+0.3, fl+0.08, 0));
  B.add("black", sc_cyl(0.008, 6), sc_rodM(V(xH+0.42, fl+0.16, 0), V(xH+0.36, fl+0.36, 0)));
  B.add("chrome", new THREE.SphereGeometry(0.024, 10, 8), sc_M(xH+0.36, fl+0.37, 0));
  /* seats: a bucket = cushion, a reclined back, side bolsters; race seats add head wings */
  function seat(z, wings){
    B.add("seat", sc_rbox(0.46, 0.1, 0.44, 0.035), sc_M(xH+0.26, fl+0.17, z));
    var a=V(xH+0.02, fl+0.2, z), b=V(xH-0.1, hy+(wings?0.1:0.02), z), len=a.distanceTo(b);
    B.add("seat", sc_rbox(0.09, len, 0.46, 0.035), sc_segM(a,b));
    [-1,1].forEach(function(sd){ B.add("seat", sc_rbox(0.16, len*0.62, 0.05, 0.02), sc_segM(V(a.x+0.04, a.y, z+sd*0.22), V(lerp(a.x,b.x,0.62)+0.04, lerp(a.y,b.y,0.62), z+sd*0.22)));
      B.add("seat", sc_rbox(0.4, 0.07, 0.06, 0.02), sc_M(xH+0.24, fl+0.24, z+sd*0.2));
      if(wings) B.add("seat", sc_rbox(0.14, 0.2, 0.04, 0.015), sc_M(b.x+0.06, hy, z+sd*0.17)); });
  }
  seat(zD, race);
  if(!o.pm) seat(-zD, race);
  /* behind the seats: a bulkhead up to the parcel shelf, the shelf under the rear glass; road cars a rear bench */
  var Pb=at(xb), ysh=Pb.ys-0.03;
  if(ysh-fl>0.1) B.add("cabin", sc_rbox(0.03, ysh-fl, (Pb.w-0.07)*2, 0.01), sc_M(xb, (ysh+fl)/2, 0));
  if(xb-o.deck>0.1) B.add("cabin", sc_rbox(xb-o.deck, 0.025, (Pb.w-0.07)*2, 0.008), sc_M((xb+o.deck)/2, ysh, 0));
  if(road && xH-0.42-xb>0.3){ B.add("seat", sc_rbox(0.4, 0.1, (Pb.w-0.12)*2, 0.04), sc_M(xb+0.25, fl+0.16, 0));
    B.add("seat", sc_rbox(0.1, ysh-fl-0.18, (Pb.w-0.12)*2, 0.04), sc_M(xb+0.07, (ysh+fl+0.18)/2, 0, 0,0,0.18)); }
  /* steering wheel, its plane facing the driver, and the column into the dash */
  var wc=V(xH+0.5, hy-0.29, zD), n=_sdN.set(-0.9, 0.44, 0).normalize();
  var wm=new THREE.Matrix4().compose(wc, _sdQ.setFromUnitVectors(_sdZ, n), _sdS);
  B.add("black", new THREE.TorusGeometry(0.17, 0.017, 6, 22), wm);
  [0, 2.2, 4.1].forEach(function(a){ var sp=new THREE.Matrix4().makeRotationZ(a).multiply(new THREE.Matrix4().makeTranslation(0.085, 0, 0)); B.add("black", sc_rbox(0.17, 0.03, 0.012, 0.004), wm.clone().multiply(sp)); });
  B.add("black", sc_cyl(0.022, 8), sc_rodM(wc, V(o.cowl-0.38, wc.y-0.12, zD)));
  if(race) B.add("alu", new THREE.CylinderGeometry(0.05, 0.05, 0.05, 14), new THREE.Matrix4().compose(V(wc.x+0.1, wc.y+0.17, zD), _sdQ.setFromUnitVectors(new THREE.Vector3(0,1,0), n), _sdS));   /* the shift light / tach on the column */
  /* the driver (own bins: stripCar puts them in userData.driver so the pits can leave the seat empty): legs under the dash,
     torso against the seat back, arms to the wheel, a helmet in the car's colour with a dark visor */
  [-1,1].forEach(function(sd){ var z=zD+sd*0.1;
    B.add("drvSuit", sc_cyl(0.065, 8), sc_rodM(V(xH+0.12, fl+0.25, z), V(xH+0.58, fl+0.34, z)));
    B.add("drvSuit", sc_cyl(0.05, 8), sc_rodM(V(xH+0.58, fl+0.34, z), V(xH+0.8, fl+0.1, z))); });
  var sh=V(xH-0.02, hy-0.22, zD), hp=V(xH+0.1, fl+0.24, zD);
  B.add("drvSuit", sc_rbox(0.22, sh.distanceTo(hp)+0.06, 0.4, 0.08), sc_segM(hp, sh));
  B.add("drvSuit", sc_cyl(0.05, 8), sc_rodM(V(sh.x, sh.y+0.02, zD), V(sh.x+0.02, hy-0.08, zD)));
  [-1,1].forEach(function(sd){ var s0=V(sh.x+0.03, sh.y-0.02, zD+sd*0.19), h1=V(wc.x-0.04, wc.y+0.08, zD+sd*0.14), el=V(lerp(s0.x,h1.x,0.5), Math.min(s0.y,h1.y)-0.09, zD+sd*0.2);
    B.add("drvSuit", sc_cyl(0.042, 8), sc_rodM(s0, el)); B.add("drvSuit", sc_cyl(0.036, 8), sc_rodM(el, h1)); });
  B.add("drvHelm", new THREE.SphereGeometry(0.135, 16, 12), sc_M(xH+0.02, hy, zD));
  B.add("drvVisor", new THREE.SphereGeometry(0.137, 12, 8, -0.95, 1.9, 1.25, 0.62), sc_M(xH+0.02, hy, zD, 0, PI, 0));
  /* cage: the main hoop behind the seats; race classes add halo bars to the A-pillars, A-pillar bars and driver's door bars */
  if(o.H){
    var xh=xH-0.2, Pm=at(xh), top=Pm.yt-0.08, zt=Math.max(0.2, Pm.wt-0.1), zb=Pm.w-0.1, yb=Pm.ys-0.05;
    [-1,1].forEach(function(sd){ B.add("tube", sc_cyl(0.022, 8), sc_rodM(V(xh, fl, sd*zb), V(xh, yb, sd*zb))); B.add("tube", sc_cyl(0.022, 8), sc_rodM(V(xh, yb, sd*zb), V(xh, top, sd*zt)));
      B.add("tube", sc_cyl(0.018, 8), sc_rodM(V(xh, top, sd*zt), V(xh-0.55, Math.max(fl+0.1, at(xh-0.55).ys-0.08), sd*Math.min(zb, at(xh-0.55).w-0.12)))); });
    B.add("tube", sc_cyl(0.022, 8), sc_rodM(V(xh, top, -zt), V(xh, top, zt)));
    B.add("tube", sc_cyl(0.018, 8), sc_rodM(V(xh, top, zt), V(xh, fl, -zb)));
    if(race){ var xa=o.roofF-0.06, Pa=at(xa), za=Math.max(0.2, Pa.wt-0.1), xp=o.cowl-0.12, Pp=at(xp), zp=Pp.w-0.12;
      [-1,1].forEach(function(sd){ B.add("tube", sc_cyl(0.02, 8), sc_rodM(V(xh, top, sd*zt), V(xa, Pa.yt-0.08, sd*za))); B.add("tube", sc_cyl(0.02, 8), sc_rodM(V(xa, Pa.yt-0.08, sd*za), V(xp, yD-0.04, sd*zp))); });
      B.add("tube", sc_cyl(0.02, 8), sc_rodM(V(xa, Pa.yt-0.08, -za), V(xa, Pa.yt-0.08, za)));
      [0.2, 0.4].forEach(function(h, j){ B.add("tube", sc_cyl(0.02, 8), sc_rodM(V(xh, fl+(j?0.18:0.42), -zb), V(xp, fl+h+0.08, -zp))); }); }
  }
  /* door handles (street, outlaw, gasser; pro mods run flush doors) */
  if(!o.pm){ var x0=o.dG0-0.06, x1=o.dG0+0.08;
    B.add("seam", sc_patch(D, x0, x1, 4.5, 4.78, 0.003)); B.add("seam", sc_patch(D, x0, x1, 15.22, 15.5, 0.003));
    B.add("chromeT", sc_patch(D, x0+0.012, x1-0.012, 4.58, 4.7, 0.009)); B.add("chromeT", sc_patch(D, x0+0.012, x1-0.012, 15.3, 15.42, 0.009)); }
  /* hood and boot shut lines (a pro mod's hood is the carbon panel, its own edge) */
  if(!o.pm){ var hF=o.rows[o.rows.length-1][0]-0.14, hx0=o.cowl+0.05, xR=o.rows[0][0];
    if(hF-hx0>0.3){ B.add("seam", sc_patch(D, hx0, hx0+0.008, 7.9, 12.1, 0.002));
      B.add("seam", sc_patch(D, hx0, hF, 7.86, 7.93, 0.002)); B.add("seam", sc_patch(D, hx0, hF, 12.07, 12.14, 0.002)); }
    if(!(o.SY && o.SY.bed) && o.deck-xR>0.3){ var tx=o.deck-0.03, tR=xR+0.1;
      B.add("seam", sc_patch(D, tx-0.008, tx, 7.9, 12.1, 0.002));
      B.add("seam", sc_patch(D, tR, tx, 7.86, 7.93, 0.002)); B.add("seam", sc_patch(D, tR, tx, 12.07, 12.14, 0.002)); } }
}

/* rear-engine dragster */
function sc_rail(B, rr, tails, heads, res, H){
  var xr=-2.7, xf=3.3, fr=0.29, V=function(x,y,z){ return new THREE.Vector3(x,y,z); };
  var D=sc_def([
    [-1.40,.17,.46,.58,.30,.27,.03],[-0.95,.16,.48,.60,.30,.25,.04],[-0.45,.15,.48,.63,.29,.24,.05],[0.30,.15,.42,.52,.24,.2,.04],
    [1.30,.15,.36,.44,.19,.16,.03],[2.60,.16,.31,.37,.14,.12,.03],[3.70,.17,.26,.30,.10,.085,.02],[4.02,.2,.23,.25,.05,.04,.01]], {sub:3});
  var L=sc_loft(D); B.add("paint", L.paint); B.add("well", L.well);
  sc_decal(res, sc_patch(D, -0.1, 0.6, 2.3, 5.4, 0.004, null, 0.5)); sc_decal(res, sc_patch(D, -0.1, 0.6, 14.6, 17.7, 0.004, "L", 0.5));
  res.hood=sc_patch(D, 1.45, 2.65, 8.4, 11.6, 0.008, null, 0.5);
  /* cockpit opening (dark) + driver */
  B.add("well", sc_patch(D, -1.33, -0.55, 8.6, 11.4, 0.004, null, 0.5));
  B.add("paint", new THREE.SphereGeometry(0.155, 16, 12), sc_M(-1.02, 0.86, 0));
  B.add("visor", new THREE.SphereGeometry(0.157, 12, 8, -0.9, 1.8, 1.2, 0.7), sc_M(-1.02, 0.86, 0, 0, PI, 0));
  B.add("satin", new THREE.CylinderGeometry(0.2, 0.26, 0.28, 12), sc_M(-1.08, 0.62, 0));
  /* roll cage */
  [-1,1].forEach(function(sd){
    B.add("tube", sc_cyl(0.022,8), sc_rodM(V(-1.3,0.5,sd*0.26), V(-1.22,1.1,sd*0.2)));
    B.add("tube", sc_cyl(0.02,8), sc_rodM(V(-1.22,1.1,sd*0.2), V(-0.62,0.62,sd*0.25)));
    B.add("tube", sc_cyl(0.018,8), sc_rodM(V(-1.22,1.1,sd*0.2), V(-1.55,0.62,sd*0.26)));
  });
  B.add("tube", sc_cyl(0.022,8), sc_rodM(V(-1.22,1.1,-0.2), V(-1.22,1.1,0.2)));
  /* chromoly chassis behind the body */
  [-1,1].forEach(function(sd){
    B.add("tube", sc_cyl(0.026,8), sc_rodM(V(-1.35,0.2,sd*0.29), V(-2.98,0.24,sd*0.27)));
    B.add("tube", sc_cyl(0.022,8), sc_rodM(V(-1.35,0.55,sd*0.29), V(-2.95,0.56,sd*0.25)));
    B.add("tube", sc_cyl(0.018,6), sc_rodM(V(-2.0,0.21,sd*0.28), V(-2.5,0.56,sd*0.26)));
    B.add("tube", sc_cyl(0.018,6), sc_rodM(V(-2.98,0.24,sd*0.27), V(-2.95,0.56,sd*0.25)));
  });
  B.add("satin", sc_cyl(0.06,12), sc_rodM(V(xr,rr,-0.42), V(xr,rr,0.42)));
  B.add("satin", sc_rbox(0.34,0.3,0.34,0.05), sc_M(xr, rr, 0));
  B.add("tube", sc_cyl(0.028,8), sc_rodM(V(xf,fr,-0.52), V(xf,fr,0.52)));
  /* engine behind the driver */
  var ex=-1.95;
  B.add("engine", sc_rbox(0.78,0.42,0.4,0.03), sc_M(ex, 0.5, 0));
  [-1,1].forEach(function(sd){ B.add("alu", sc_rbox(0.74,0.1,0.2,0.03), sc_M(ex, 0.78, sd*0.2, sd*-0.55,0,0)); B.add("engine", sc_rbox(0.76,0.2,0.16,0.02), sc_M(ex, 0.66, sd*0.19, sd*-0.55,0,0)); });
  var gates=[], hat=null, ra=H?H.asp:"blower";
  if(ra==="blower"){
  B.add("alu", sc_rbox(0.66,0.22,0.3,0.035), sc_M(ex, 0.93, 0));
  B.add("satin", sc_rbox(0.7,0.04,0.34,0.012), sc_M(ex, 1.05, 0));
  B.add("paint", sc_prof([[0.18,0],[0.22,0.28],[0.06,0.32],[-0.2,0.25],[-0.2,0]], 0.3, 0.015), sc_M(ex+0.05, 1.06, 0));
  B.add("well", sc_rbox(0.02,0.2,0.22,0.01), sc_M(ex+0.265, 1.21, 0, 0,0,0.15));
  hat=V(ex+0.08, 1.38, 0);
  } else if(ra==="na"){   /* v2: injector hat straight on the intake, no blower case */
    B.add("satin", sc_rbox(0.6,0.06,0.3,0.012), sc_M(ex, 0.85, 0));
    B.add("paint", sc_prof([[0.18,0],[0.22,0.28],[0.06,0.32],[-0.2,0.25],[-0.2,0]], 0.3, 0.015), sc_M(ex+0.05, 0.87, 0));
    B.add("well", sc_rbox(0.02,0.2,0.22,0.01), sc_M(ex+0.265, 1.02, 0, 0,0,0.15));
    hat=V(ex+0.08, 1.2, 0);
  } else {   /* v2: turbos hung off the headers, inlets forward, wastegates up */
    B.add("satin", sc_rbox(0.6,0.06,0.3,0.012), sc_M(ex, 0.85, 0));
    (ra==="twin"||ra==="turbo"?[-1,1]:[1]).forEach(function(sd){
      B.add("alu", new THREE.CylinderGeometry(0.15,0.15,0.13,16), sc_M(ex+0.12, 0.98, sd*0.36, PI/2,0,0));
      B.add("barrel", new THREE.TorusGeometry(0.15,0.035,6,16), sc_M(ex+0.12, 0.98, sd*0.36));
      sc_bell(B, ex+0.3, 0.98, sd*0.36, 0.085);
      if(ra!=="centri"){ var a=V(ex-0.12, 0.9, sd*0.34), b=V(ex-0.2, 1.22, sd*0.38); B.add("chrome", sc_cyl(0.028,10), sc_rodM(a,b)); gates.push({p:b.clone(), d:V(-0.3,1,sd*0.1).normalize()}); }
    });
  }
  /* zoomie headers, up and back */
  var tips=[], dirs=[];
  [-1,1].forEach(function(sd){ for(var i=0;i<4;i++){
    var x0=ex+0.27-i*0.18, a=V(x0,0.66,sd*0.3), b=V(x0-0.02,0.74,sd*0.44), c=V(x0-0.26,1.08,sd*0.52);
    B.add("alu", sc_pipe([a,b,c], 0.026)); sc_pipeEnd(B, "alu", b, c, 0.026);
    if(i===1||i===2){ tips.push(c.clone()); dirs.push(c.clone().sub(b).normalize()); }
  } });
  /* rear wing + front wing */
  var wx=-3.12, wy=1.62;
  B.add("paint", sc_foil(0.62, 0.12, 1.36), sc_M(wx, wy, 0, 0,0,-0.3));
  [-1,1].forEach(function(sd){
    B.add("carbon", sc_prof([[0.36,-0.2],[0.38,0.14],[-0.4,0.26],[-0.42,-0.2]], 0.014, 0.003), sc_M(wx, wy, sd*0.69));
    B.add("tube", sc_cyl(0.022,8), sc_rodM(V(-2.95,0.56,sd*0.25), V(wx+0.05,wy-0.08,sd*0.3)));
    B.add("tube", sc_cyl(0.016,6), sc_rodM(V(-2.6,0.56,sd*0.26), V(wx+0.1,wy-0.06,sd*0.3)));
  });
  B.add("paint", sc_foil(0.26, 0.1, 0.96), sc_M(4.0, 0.36, 0, 0,0,-0.12));
  [-1,1].forEach(function(sd){ B.add("carbon", sc_prof([[0.16,-0.08],[0.16,0.08],[-0.16,0.1],[-0.16,-0.08]], 0.01, 0.002), sc_M(4.0, 0.36, sd*0.48)); B.add("tube", sc_cyl(0.012,6), sc_rodM(V(3.92,0.25,sd*0.06), V(3.97,0.33,sd*0.3))); });
  /* wheelie bars, chute pack, brake light */
  var maxP=deg(4), bx0=-2.95, bx1=-4.55, br=0.06, dxB=bx1-xr, cy=(br-rr-dxB*Math.sin(maxP))/Math.cos(maxP)+rr;
  [-1,1].forEach(function(sd){ var b=V(bx1,cy,sd*0.2);
    B.add("tube", sc_cyl(0.02,8), sc_rodM(V(bx0,0.24,sd*0.22), b)); B.add("tube", sc_cyl(0.013,6), sc_rodM(V(bx0,0.52,sd*0.22), b));
    B.add("rubber", new THREE.CylinderGeometry(br,br,0.04,14), sc_M(bx1,cy,sd*0.2, PI/2,0,0)); B.add("alu", new THREE.CylinderGeometry(br*0.55,br*0.55,0.045,10), sc_M(bx1,cy,sd*0.2, PI/2,0,0)); });
  B.add("tube", sc_cyl(0.016,8), sc_rodM(V(bx1+0.05,cy,-0.2), V(bx1+0.05,cy,0.2)));
  B.add("bag", sc_rbox(0.24,0.26,0.36,0.05), sc_M(-3.08, 0.44, 0));
  B.add("paint", sc_rbox(0.03,0.2,0.28,0.012), sc_M(-3.21, 0.44, 0));
  tails.push({g:sc_rbox(0.03,0.04,0.26,0.01), m:sc_M(-3.22, 0.6, 0)});
  var wh=[];
  [-1,1].forEach(function(sd){
    wh.push({x:xr, z:sd*0.6, r:rr, w:H?clamp(0.34+(rr*2/0.0254-32)*0.022,0.34,0.46):0.43, rimR:0.205, style:"bead", rimMat:"alu", rear:true, letters:true});
    wh.push({x:xf, z:sd*0.56, r:fr, w:0.075, rimR:0.215, style:"wire", rimMat:"alu", rear:false, letters:false});
  });
  return { rr:rr, fr:fr, xr:xr, xf:xf, wheels:wh, tips:tips, dirs:dirs, anchor:V(-3.23,0.44,0), bars:true, maxPitch:maxP, gates:gates, hat:hat,
    squat:deg(0.5), squatDrop:0.01, shiftKick:0.1, pitchW:9, droop:0.03, wrinkle:1, chuteLen:5.4, chuteRise:0.5, chuteR:0.9 };
}
/* ---------------------------------------------------------------------------
   DRAG CARS v3 — shells. Every door car picks a shell (hw.style) per class:
     street / outlaw : fox · gbody · nova · coupe (the 90s F-body) · hatch · truck (crew-cab diesel)
     promod          : modern (the v2 shell) · camaro69 · c7 · willys41
     prostock        : one sleek shell with the tall hood scoop
     gasser          : tri55 ('55 Chevy) · willys
   A shell is loft rows (see sc_def) plus where the glass / wheels / hood hardware sit, a drag stance
   (rake: nose up, lift: tail squat, skinny fronts) and hooks that dress it: dress (fascia, bumpers, lamps,
   mirrors), rear (spoiler / wing), exhaust, chassis (things under the body). No hw = the v1.5 car exactly.
   -------------------------------------------------------------------------*/
var SC_BODY_TYRE={street:27, outlaw:30, promod:33, rail:36, funny:36, prostock:33, gasser:30};
var SC_ALIAS={muscle:"nova", fbody:"coupe", camaro:"camaro69", vette:"c7", corvette:"c7"};
/* the shell a class actually uses for a requested style (unknown -> the class default; diesel street -> the truck) */
function sc_styleFor(body, st, diesel){
  if(body==="street"||body==="outlaw"){ st=SC_ALIAS[st]||st; return SC_STYLE[st] && st!=="muscle"?st:(diesel?"truck":"coupe"); }
  if(body==="promod"){ st=SC_ALIAS[st]||(st==="willys"?"willys41":st); return SC_PM[st] && st!=="prostock"?st:"modern"; }
  if(body==="gasser"){ if(st==="willys41") st="willys"; return SC_GAS[st]?st:"tri55"; }
  return "";
}
function sc_shell(body, st){
  if(body==="promod") return SC_PM[st]||null;
  if(body==="prostock") return SC_PM.prostock;
  if(body==="gasser") return SC_GAS[st]||SC_GAS.tri55;
  return SC_STYLE[st]||null;
}

/* --- fascia helpers ------------------------------------------------------- */
/* the body's front (dir -1) or rear (dir +1) surface x at height y on the centre line */
function sc_faceX(D, xEnd, y, dir){ var P={}, x=xEnd; for(var i=0;i<90;i++){ sc_params(D,x,P); if(y>=P.zb && y<=P.yt) return x; x+=dir*0.01; } return x; }
function sc_at(D, x){ var P={}; return sc_params(D, x, P); }
function sc_disc(r, t, seg){ var key="dk"+r3(r)+"_"+r3(t)+"_"+(seg||14); if(SC.geo[key]) return SC.geo[key]; var g=new THREE.CylinderGeometry(r, r, t, seg||14); g.rotateZ(PI/2); return (SC.geo[key]=g); }
function sc_bezel(r, t){ var key="bz"+r3(r)+"_"+r3(t); if(SC.geo[key]) return SC.geo[key]; var g=new THREE.TorusGeometry(r, t, 4, 14); g.rotateY(PI/2); return (SC.geo[key]=g); }
/* round headlamp with a chrome bezel, facing +x (or -x for a tail lamp) */
function sc_roundLamp(C, list, x, y, z, r, bezel){ list.push({g:sc_disc(r, 0.03), m:sc_M(x, y, z)}); if(bezel) C.B.add(bezel, sc_bezel(r+0.006, 0.011), sc_M(x+0.006, y, z)); }
/* flush lamps on the nose slope: a patch of the body skin at the top corners (k 8.2..9.5 right, 10.5..11.8 left) */
function sc_flushLamps(C, x0, x1, kIn){ var ki=kIn||9.5; C.heads.push({g:sc_patch(C.D, x0, x1, 8.15, ki, 0.006), m:new THREE.Matrix4()}); C.heads.push({g:sc_patch(C.D, x0, x1, 20-ki, 11.85, 0.006), m:new THREE.Matrix4()}); }
function sc_liteBins(B){ if(!B) return; [["carbonS","carbon"],["chromeT","chrome"],["caliper","black"]].forEach(function(q){ if(B[q[0]]){ (B[q[1]]||(B[q[1]]=[])).push.apply(B[q[1]], B[q[0]]); delete B[q[0]]; } }); }
/* a straight bumper blade across the car with its ends wrapped back */
function sc_bumper(B, mat, x, y, half, h, d, dir, wrap){
  B.add(mat, sc_rbox(d, h, half*2-0.16, Math.min(0.03, h*0.3)), sc_M(x, y, 0));
  [-1,1].forEach(function(sd){ B.add(mat, sc_rbox(d, h, wrap||0.24, Math.min(0.03, h*0.3)), sc_M(x-dir*0.05, y, sd*(half-0.03), 0, -sd*dir*0.75, 0)); });
}
function sc_grille(B, x, y, w, h, bars, barMat, frame){
  B.add("well", sc_rbox(0.03, h, w, 0.012), sc_M(x-0.012, y, 0));
  if(frame) B.add(frame, sc_rbox(0.022, h+0.03, w+0.03, 0.012), sc_M(x-0.02, y, 0));
  for(var i=0;i<bars;i++) B.add(barMat||"satin", sc_rbox(0.014, 0.011, w*0.96, 0.004), sc_M(x+0.006, y-h/2+(i+1)*h/(bars+1), 0));
}
/* mirrors: aero (body colour), bullet (chrome, one side), square, tow (big, on arms) */
function sc_mirror(C, kind){
  var B=C.B, x=C.cowl-0.05, P=sc_at(C.D, C.cowl-0.04), y=P.ys, sides=kind==="bullet"?[-1]:[-1,1];
  sides.forEach(function(sd){ var z=sd*(P.w+0.1);
    if(kind==="bullet"){ B.add("chrome", new THREE.SphereGeometry(0.05, 10, 6, 0, TAU, 0, PI/2), sc_M(x-0.02, y+0.08, z, 0,0,-PI/2)); B.add("chrome", sc_disc(0.05,0.03,10), sc_M(x-0.035, y+0.08, z)); B.add("chrome", sc_cyl(0.008,6), sc_rodM(new THREE.Vector3(x, y+0.005, sd*(P.w-0.01)), new THREE.Vector3(x-0.01, y+0.06, z))); }
    else if(kind==="square"){ B.add("chrome", sc_rbox(0.05, 0.08, 0.13, 0.012), sc_M(x, y+0.075, z)); B.add("glass", sc_rbox(0.006, 0.06, 0.11, 0.003), sc_M(x-0.028, y+0.075, z)); B.add("chrome", sc_rbox(0.03, 0.05, 0.06, 0.008), sc_M(x+0.01, y+0.025, sd*(P.w+0.04))); }
    else if(kind==="tow"){ var zt=sd*(P.w+0.24); B.add("black", sc_rbox(0.09, 0.32, 0.2, 0.025), sc_M(x, y+0.2, zt)); B.add("glass", sc_rbox(0.006, 0.28, 0.17, 0.004), sc_M(x-0.048, y+0.2, zt));
      B.add("black", sc_cyl(0.014,6), sc_rodM(new THREE.Vector3(x+0.02, y+0.06, sd*(P.w-0.02)), new THREE.Vector3(x, y+0.1, zt))); B.add("black", sc_cyl(0.014,6), sc_rodM(new THREE.Vector3(x+0.02, y+0.3, sd*(P.w-0.04)), new THREE.Vector3(x, y+0.3, zt))); }
    else { B.add("paint", sc_prof([[0.07,0.01],[0.0,-0.01],[-0.06,0.0],[-0.065,0.075],[0.0,0.085],[0.06,0.06]], 0.13, 0.012), sc_M(x, y+0.06, z));
      B.add("glass", sc_rbox(0.008,0.06,0.1,0.003), sc_M(x-0.067, y+0.097, z)); B.add("black", sc_rbox(0.05,0.025,0.1,0.008), sc_M(x+0.02, y+0.045, sd*(P.w+0.04))); }
  });
}
/* chrome trim under the side glass (older cars) */
function sc_beltTrim(C, x0, x1){ C.B.add("chromeT", sc_patch(C.D, x0, x1, 5.22, 5.4, 0.006)); C.B.add("chromeT", sc_patch(C.D, x0, x1, 14.6, 14.78, 0.006, "L")); }
/* a lip spoiler on the deck */
function sc_lip(C, x, h, span){ var P=sc_at(C.D, x); C.B.add(C.mat||"paint", sc_prof([[0.1,0],[0.0,h],[-0.08,h*1.1],[-0.1,0]], span||P.wt*2*0.95, 0.008), sc_M(x, P.yt-0.012, 0)); }
/* brake calipers on the rear rotors (merged into the body pack: they sit on the axle, not the spinning wheel) */
function sc_calipers(B, wh, all){   /* all: the front wheels get one too (door cars with a cabin) */
  wh.forEach(function(w){ if(!w.rear && !all) return; var sd=w.z<0?-1:1, a=w.rear?2.2:0.94, rc=w.rimR*0.74;
    B.add("caliper", sc_rbox(0.06, 0.15, 0.06, 0.016), sc_M(w.x+Math.cos(a)*rc, w.r+Math.sin(a)*rc, w.z+sd*w.w*0.14, 0,0,a)); });
}
/* rear exhaust pair under the bumper (shared by the shells that keep their pipes out back) */
function sc_rearPipes(C, y, z, r, n){
  (n===1?[1]:[-1,1]).forEach(function(sd){ var p=new THREE.Vector3(C.xR-0.04, y, sd*z);
    C.B.add("chrome", new THREE.CylinderGeometry(r, r, 0.22, 12, 1, true), sc_M(p.x+0.1, p.y, p.z, 0,0,PI/2));
    C.B.add("well", new THREE.CircleGeometry(r*0.9, 12), sc_M(p.x+0.03, p.y, p.z, 0,-PI/2,0));
    C.tips.push(p); C.dirs.push(new THREE.Vector3(-1,0,0)); });
}

/* --- street / outlaw shells ------------------------------------------------- */
/* Fox-body Mustang (notchback): aero nose with flush composite lamps, slot grille, body-colour bumpers, ribbed tails */
SC_STYLE.fox={xr:-1.27, xf:1.28, roofF:0.1, cowl:0.6, roofR:-0.78, deck:-1.42, dG0:-0.42, qG0:-0.95, hx:1.25, door:[-0.38,0.5], hood:[1.55,2.0],
  rake:0.028, lift:0, fw:0.13, fr:0.33, fz:0.06, rimR:"star", rimF:"weld", lettersF:false, rows:[
  [-2.30,.31,.80,.83,.84,.80,.02],[-2.25,.24,.87,.92,.855,.82,.02],[-1.85,.21,.88,.94,.86,.83,.02],[-1.42,.20,.885,.96,.865,.81,.03],
  [-1.10,.19,.885,1.20,.865,.66,.04],[-0.78,.19,.885,1.295,.865,.62,.04],[0.10,.19,.885,1.305,.865,.62,.04],[0.60,.19,.885,1.01,.865,.79,.03],
  [0.95,.19,.88,.945,.86,.82,.02],[1.70,.20,.845,.89,.85,.81,.02],[2.12,.24,.73,.765,.82,.77,.02],[2.27,.31,.60,.625,.76,.70,.02]],
  dress:function(C){ var B=C.B, D=C.D, cF=C.cF, cR=C.cR, y, x, P;
    y=lerp(cF.zb,cF.ys,0.82)+0.02; x=sc_faceX(D, C.xF, y, -1); P=sc_at(D, x-0.06);
    sc_flushLamps(C, C.xF-0.2, C.xF-0.05, 9.3);
    B.add("well", sc_patch(D, C.xF-0.16, C.xF-0.09, 9.6, 10.4, 0.006));
    y=lerp(cF.zb,cF.ys,0.25); x=sc_faceX(D, C.xF, y, -1);
    B.add("black", sc_rbox(0.04, 0.09, cF.w*1.5, 0.02), sc_M(x, y, 0));
    [-1,1].forEach(function(sd){ B.add("glass", sc_disc(0.03, 0.02, 10), sc_M(x+0.004, y, sd*cF.w*0.62)); });
    B.add("black", sc_prof([[0,0],[0.3,0],[0.33,0.03],[0,0.045]], cF.w*2*0.96, 0.006), sc_M(cF.x-0.3, cF.zb-0.03, 0));
    /* tails: wide, horizontally ribbed, the black centre panel between */
    y=lerp(cR.zb,cR.ys,0.7); x=sc_faceX(D, C.xR, y, 1);
    [-1,1].forEach(function(sd){ C.tails.push({g:sc_rbox(0.03, 0.13, 0.5, 0.012), m:sc_M(x-0.004, y, sd*cR.w*0.6)});
      for(var i=0;i<3;i++) B.add("black", sc_rbox(0.012, 0.008, 0.5, 0.002), sc_M(x-0.02, y-0.04+i*0.04, sd*cR.w*0.6)); });
    B.add("black", sc_rbox(0.03, 0.13, cR.w*0.42, 0.012), sc_M(x-0.002, y, 0));
    B.add("black", sc_rbox(0.05, 0.04, cR.w*1.95, 0.015), sc_M(cR.x+0.01, lerp(cR.zb,cR.ys,0.32), 0));
    sc_mirror(C, "square");
  },
  rear:function(C){}
};
/* G-body Monte Carlo SS: long hood, formal roof, aero nose with quad lamps around an egg-crate grille, a deck lip */
SC_STYLE.gbody={xr:-1.37, xf:1.37, roofF:-0.05, cowl:0.5, roofR:-1.12, deck:-1.48, dG0:-0.5, qG0:-1.05, hx:1.35, door:[-0.45,0.4], hood:[1.7,2.2],
  rake:0.028, lift:0, fw:0.13, fr:0.33, fz:0.06, rimR:"star", rimF:"weld", lettersF:false, rows:[
  [-2.56,.32,.82,.86,.86,.82,.02],[-2.50,.25,.88,.935,.885,.85,.02],[-2.0,.22,.895,.96,.895,.86,.02],[-1.48,.21,.90,.985,.90,.85,.03],
  [-1.30,.20,.90,1.25,.90,.66,.04],[-1.12,.20,.90,1.35,.90,.62,.04],[-0.05,.20,.90,1.36,.90,.62,.04],[0.50,.20,.90,1.02,.90,.79,.03],
  [0.90,.20,.895,.975,.90,.84,.02],[1.90,.22,.875,.94,.89,.84,.02],[2.38,.26,.79,.82,.86,.81,.02],[2.56,.32,.66,.68,.80,.74,.02]],
  dress:function(C){ var B=C.B, D=C.D, cF=C.cF, cR=C.cR, y, x, P;
    y=lerp(cF.zb,cF.ys,0.62); x=sc_faceX(D, C.xF, y, -1); P=sc_at(D, x-0.05);
    sc_grille(B, x, y, 0.44, 0.13, 4, "chrome", "chrome");
    [-1,1].forEach(function(sd){ for(var i=0;i<2;i++) C.heads.push({g:sc_rbox(0.03, 0.065, 0.15, 0.01), m:sc_M(x-0.01, y+(i?0.035:-0.035), sd*(0.34+0.0*i))});
      B.add("black", sc_rbox(0.025, 0.16, 0.2, 0.01), sc_M(x-0.02, y, sd*0.34)); });
    y=lerp(cF.zb,cF.ys,0.24); x=sc_faceX(D, C.xF, y, -1);
    B.add("black", sc_rbox(0.04, 0.05, cF.w*1.8, 0.015), sc_M(x, y, 0));
    B.add("black", sc_prof([[0,0],[0.32,0],[0.34,0.035],[0,0.05]], cF.w*2*0.98, 0.006), sc_M(cF.x-0.3, cF.zb-0.035, 0));
    y=lerp(cR.zb,cR.ys,0.72); x=sc_faceX(D, C.xR, y, 1);
    [-1,1].forEach(function(sd){ C.tails.push({g:sc_rbox(0.03, 0.12, 0.56, 0.012), m:sc_M(x-0.004, y, sd*cR.w*0.55)}); });
    B.add("chromeT", sc_rbox(0.02, 0.018, cR.w*1.9, 0.006), sc_M(x-0.006, y+0.08, 0));
    B.add("black", sc_rbox(0.05, 0.05, cR.w*1.95, 0.015), sc_M(cR.x+0.01, lerp(cR.zb,cR.ys,0.3), 0));
    sc_beltTrim(C, C.qG0, C.cowl-0.04);
    sc_mirror(C, "square");
  },
  rear:function(C){ sc_lip(C, C.xR+0.08, 0.045); }
};
/* '68-72 Nova: flat face, full-width grille between round lamps, chrome blade bumpers, chrome trim, one bullet mirror */
SC_STYLE.nova={xr:-1.36, xf:1.43, roofF:0.05, cowl:0.55, roofR:-0.72, deck:-1.55, dG0:-0.4, qG0:-1.0, hx:1.4, door:[-0.4,0.45], hood:[1.75,2.25],
  rake:0.035, lift:0, fw:0.13, fr:0.33, fz:0.06, rimR:"star", rimF:"weld", lettersF:false, rows:[
  [-2.34,.30,.80,.835,.86,.82,.02],[-2.29,.24,.88,.935,.885,.85,.02],[-1.90,.22,.89,.95,.895,.86,.02],[-1.55,.21,.895,.965,.90,.86,.03],
  [-1.20,.20,.90,1.15,.90,.71,.04],[-0.72,.20,.90,1.325,.90,.63,.04],[0.05,.20,.90,1.335,.90,.63,.04],[0.55,.20,.90,1.01,.90,.80,.03],
  [0.85,.20,.895,.97,.90,.855,.02],[1.85,.21,.885,.955,.895,.86,.02],[2.38,.23,.86,.925,.89,.85,.02],[2.50,.30,.81,.845,.86,.82,.02]],
  dress:function(C){ var B=C.B, D=C.D, cF=C.cF, cR=C.cR, y, x;
    y=lerp(cF.zb,cF.ys,0.62); x=sc_faceX(D, C.xF, y, -1);
    sc_grille(B, x, y, cF.w*1.5, 0.17, 3, "chrome", "chrome");
    [-1,1].forEach(function(sd){ sc_roundLamp(C, C.heads, x+0.002, y, sd*cF.w*0.86, 0.075, "chrome"); });
    sc_bumper(B, "chrome", cF.x+0.05, lerp(cF.zb,cF.ys,0.12)+0.02, cF.w+0.03, 0.1, 0.08, 1);
    y=lerp(cR.zb,cR.ys,0.62); x=sc_faceX(D, C.xR, y, 1);
    [-1,1].forEach(function(sd){ C.tails.push({g:sc_rbox(0.03, 0.09, 0.28, 0.012), m:sc_M(x-0.004, y, sd*cR.w*0.62)}); B.add("chromeT", sc_rbox(0.02, 0.11, 0.3, 0.012), sc_M(x+0.004, y, sd*cR.w*0.62)); });
    sc_bumper(B, "chrome", cR.x-0.05, lerp(cR.zb,cR.ys,0.14)+0.02, cR.w+0.03, 0.1, 0.08, -1);
    sc_beltTrim(C, C.qG0, C.cowl-0.04);
    sc_mirror(C, "bullet");
  },
  rear:function(C){}
};
/* the 90s F-body: pointed nose, slim lamps, big lower intake, full-width tail bar, the factory spoiler (default rear) */
Object.assign(SC_STYLE.coupe, {rake:0.022, lift:0, fw:0.13, fr:0.33, fz:0.06, rimR:"star", rimF:"weld", lettersF:false,
  dress:function(C){ var B=C.B, D=C.D, cF=C.cF, cR=C.cR, y, x, P;
    y=lerp(cF.zb,cF.ys,0.82); x=sc_faceX(D, C.xF, y, -1); P=sc_at(D, x-0.1);
    sc_flushLamps(C, C.xF-0.32, C.xF-0.1, 9.0);
    y=lerp(cF.zb,cF.ys,0.36); x=sc_faceX(D, C.xF, y, -1);
    B.add("well", sc_rbox(0.04, 0.11, cF.w*1.2, 0.03), sc_M(x-0.005, y, 0));
    for(var i=0;i<2;i++) B.add("satin", sc_rbox(0.012, 0.01, cF.w*1.15, 0.003), sc_M(x+0.012, y-0.03+i*0.06, 0));
    B.add("black", sc_prof([[0,0],[0.32,0],[0.34,0.035],[0,0.05]], cF.w*2*0.98, 0.006), sc_M(cF.x-0.3, cF.zb-0.035, 0));
    var ty=lerp(cR.zb,cR.ys,0.74); x=sc_faceX(D, C.xR, ty, 1);
    C.tails.push({g:sc_rbox(0.03, 0.11, cR.w*1.85, 0.015), m:sc_M(x-0.004, ty, 0)});
    B.add("black", sc_rbox(0.05, 0.12, cR.w*1.9, 0.025), sc_M(cR.x+0.01, lerp(cR.zb,cR.ys,0.22), 0));
    sc_mirror(C, "aero");
  }});
/* Civic-style hatch: small flush lamps, tall corner tails, a roof spoiler over the hatch glass */
Object.assign(SC_STYLE.hatch, {rake:0.016, lift:0, fw:0.13, fr:0.32, fz:0.06, rimR:"star", rimF:"weld", lettersF:false,
  dress:function(C){ var B=C.B, D=C.D, cF=C.cF, cR=C.cR, y, x, P;
    y=lerp(cF.zb,cF.ys,0.78); x=sc_faceX(D, C.xF, y, -1); P=sc_at(D, x-0.05);
    sc_flushLamps(C, C.xF-0.2, C.xF-0.03, 9.2);
    B.add("well", sc_rbox(0.03, 0.04, 0.36, 0.01), sc_M(x-0.01, y-0.01, 0));
    y=lerp(cF.zb,cF.ys,0.3); x=sc_faceX(D, C.xF, y, -1);
    B.add("well", sc_rbox(0.04, 0.08, cF.w*0.9, 0.025), sc_M(x-0.005, y, 0));
    B.add("black", sc_prof([[0,0],[0.3,0],[0.32,0.03],[0,0.045]], cF.w*2*0.96, 0.006), sc_M(cF.x-0.28, cF.zb-0.03, 0));
    y=lerp(cR.zb,cR.ys,0.8); x=sc_faceX(D, C.xR, y, 1);
    [-1,1].forEach(function(sd){ C.tails.push({g:sc_rbox(0.04, 0.2, 0.16, 0.015), m:sc_M(x+0.01, y, sd*cR.w*0.82)}); });
    B.add("black", sc_rbox(0.05, 0.06, cR.w*1.95, 0.02), sc_M(cR.x+0.01, lerp(cR.zb,cR.ys,0.3), 0));
    sc_mirror(C, "aero");
  },
  rear:function(C){ var x=C.roofR, P=sc_at(C.D, x+0.02);
    C.B.add("paint", sc_foil(0.24, 0.05, P.wt*2*0.98), sc_M(x-0.06, P.yt+0.015, 0, 0,0,-0.12)); }
});
/* crew-cab diesel pickup (Duramax / Cummins class): tall, square, a big chrome grille, steel bumpers, tow mirrors,
   running boards, frame rails, and two stacks out of the bed */
SC_STYLE.truck={xr:-1.95, xf:1.85, roofF:0.55, cowl:1.05, roofR:-0.98, deck:-1.22, dG0:0.0, qG0:-0.92, hx:1.9, bed:true, door:[0.1,0.88], hood:[2.0,2.5],
  rr0:0.40, rake:0.012, lift:0, fw:-1, fr:-1, fz:0.04, gapF:0.06, gapR:0.05, rimR:"star", rimF:"star", rimMat:"chrome", lettersF:true, seams:[-0.98,-1.17], rows:[
  [-3.15,.60,1.17,1.20,.99,.95,.01],[-3.10,.54,1.24,1.26,1.0,.97,.01],[-1.22,.54,1.24,1.26,1.0,.97,.01],[-1.16,.52,1.25,1.30,1.0,.93,.01],
  [-1.08,.52,1.26,1.90,1.0,.82,.03],[-0.98,.52,1.26,1.96,1.0,.82,.04],[0.55,.52,1.26,1.97,1.0,.82,.04],[1.05,.52,1.26,1.40,1.0,.90,.03],
  [1.30,.52,1.26,1.37,1.0,.95,.02],[2.55,.54,1.24,1.33,.99,.95,.02],[2.80,.58,1.21,1.28,.98,.93,.02],[2.86,.66,1.08,1.10,.95,.90,.01]],
  dress:function(C){ var B=C.B, D=C.D, cF=C.cF, cR=C.cR, y=0.95, x=sc_faceX(D, C.xF, y, -1), P=sc_at(D, x-0.05);
    sc_grille(B, x, y, 1.0, 0.36, 4, "chrome", "chrome");
    B.add("chrome", sc_rbox(0.03, 0.05, 1.04, 0.012), sc_M(x+0.01, y, 0));
    [-1,1].forEach(function(sd){ C.heads.push({g:sc_rbox(0.04, 0.2, 0.3, 0.02), m:sc_M(x-0.02, y+0.04, sd*0.71)}); B.add("chrome", sc_rbox(0.03, 0.22, 0.32, 0.012), sc_M(x-0.03, y+0.04, sd*0.71)); });
    sc_bumper(B, "chrome", x+0.06, 0.66, P.w+0.04, 0.2, 0.16, 1, 0.34);
    B.add("black", sc_rbox(0.12, 0.08, P.w*1.6, 0.02), sc_M(x-0.02, 0.52, 0));
    [-1,1].forEach(function(sd){ B.add("caliper", sc_rbox(0.06, 0.05, 0.05, 0.012), sc_M(x+0.12, 0.6, sd*0.45)); });   /* tow hooks */
    /* rear: tall lamps on the bed corners, the tailgate, a step bumper */
    [-1,1].forEach(function(sd){ C.tails.push({g:sc_rbox(0.04, 0.42, 0.11, 0.015), m:sc_M(cR.x-0.0, 1.0, sd*(cR.w-0.07))}); });
    B.add("seam", sc_rbox(0.01, 0.01, cR.w*1.6, 0.002), sc_M(cR.x-0.006, 0.7, 0));
    sc_bumper(B, "chrome", cR.x-0.07, 0.6, cR.w+0.02, 0.17, 0.16, -1, 0.3);
    B.add("black", sc_rbox(0.18, 0.025, 0.5, 0.005), sc_M(cR.x-0.07, 0.69, 0));
    sc_mirror(C, "tow");
  },
  rear:function(C){},
  chassis:function(C){ var B=C.B;   /* frame rails, running boards, a hint of the axles */
    [-1,1].forEach(function(sd){ B.add("black", sc_rbox(C.xf-C.xr+1.6, 0.16, 0.07, 0.01), sc_M((C.xf+C.xr)/2-0.2, 0.47, sd*0.45));
      B.add("black", sc_rbox(C.xf-C.xr-2*C.rr-0.3, 0.05, 0.16, 0.012), sc_M((C.xf+C.xr)/2+0.05, 0.42, sd*0.93));
      B.add("satin", sc_rbox(0.05, 0.12, 0.05, 0.01), sc_M((C.xf+C.xr)/2-0.6, 0.47, sd*0.88)); B.add("satin", sc_rbox(0.05, 0.12, 0.05, 0.01), sc_M((C.xf+C.xr)/2+0.7, 0.47, sd*0.88)); });
    B.add("black", sc_cyl(0.06, 8), sc_rodM(new THREE.Vector3(C.xr, C.rr, -0.7), new THREE.Vector3(C.xr, C.rr, 0.7)));
    B.add("black", sc_rbox(0.3, 0.26, 0.3, 0.04), sc_M(C.xr, C.rr, 0));
  },
  exhaust:function(C){
    if(C.H && C.H.diesel){ [-1,1].forEach(function(sd){ var x0=-1.42, z0=sd*0.78, y0=1.0, y1=2.6;   /* 5" stacks behind the cab */
        C.B.add("chrome", sc_cyl(0.065, 12), sc_rodM(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x0, y1, z0)));
        C.B.add("chrome", new THREE.CylinderGeometry(0.068, 0.068, 0.16, 12, 1, true), sc_M(x0, y1+0.04, z0, 0,0,0.6));   /* mitred tip */
        C.B.add("well", new THREE.CircleGeometry(0.06, 12), sc_M(x0-0.045, y1+0.1, z0, -PI/2,0,0.6));
        C.B.add("satin", sc_rbox(0.06, 0.04, 0.16, 0.01), sc_M(x0, 1.28, z0));
        C.tips.push(new THREE.Vector3(x0-0.04, y1+0.1, z0)); C.dirs.push(new THREE.Vector3(-0.35,1,0).normalize()); }); }
    else sc_rearPipes(C, C.cR.zb-0.05, 0.6, 0.05);
  }
};
SC_STYLE.coupe.rows=undefined;   /* the coupe keeps the v1.5 rows (sc_door's default) */

/* --- pro-mod shells (per car) -------------------------------------------------- */
var SC_PM={
  /* '69 Camaro: square, flat face, round lamps set in the grille, chopped and wide over the tubs */
  camaro69:{xr:-1.36, xf:1.40, roofF:0.0, cowl:0.5, roofR:-0.62, deck:-1.52, dG0:-0.42, qG0:-1.0, hx:1.15, door:[-0.45,0.4], hood:[1.55,2.15], rimMat:"rimBlack", rows:[
    [-2.36,.30,.82,.86,.90,.86,.02],[-2.30,.24,.90,.955,.93,.89,.02],[-1.90,.21,.92,.975,.95,.90,.02],[-1.52,.20,.925,.99,.955,.89,.03],
    [-1.10,.19,.93,1.10,.955,.74,.04],[-0.62,.19,.93,1.205,.955,.66,.05],[0.0,.19,.93,1.215,.955,.66,.05],[0.50,.19,.925,.99,.955,.82,.03],
    [0.80,.18,.92,.965,.955,.88,.02],[1.90,.17,.89,.945,.95,.89,.02],[2.36,.18,.85,.90,.94,.88,.02],[2.46,.24,.79,.82,.90,.84,.02]],
    dress:function(C){ var B=C.B, D=C.D, cF=C.cF, cR=C.cR, y=lerp(cF.zb,cF.ys,0.6), x=sc_faceX(D, C.xF, y, -1);
      sc_grille(B, x, y, cF.w*1.7, 0.16, 2, "satin", "black");
      [-1,1].forEach(function(sd){ sc_roundLamp(C, C.heads, x+0.002, y, sd*cF.w*0.68, 0.065, "chrome"); });
      B.add("carbonS", sc_prof([[0,0],[0.36,0],[0.4,0.03],[0,0.05]], cF.w*2*1.0, 0.006), sc_M(cF.x-0.32, cF.zb-0.04, 0));
      y=lerp(cR.zb,cR.ys,0.66); x=sc_faceX(D, C.xR, y, 1);
      [-1,1].forEach(function(sd){ for(var i=0;i<2;i++) C.tails.push({g:sc_rbox(0.03, 0.08, 0.24, 0.012), m:sc_M(x-0.004, y, sd*(cR.w*0.3+i*0.28))}); });
      B.add("black", sc_rbox(0.03, 0.03, cR.w*1.9, 0.01), sc_M(x+0.004, y-0.08, 0));
      sc_mirror(C, "aero");
    }},
  /* C7 Corvette: low wedge, cab-back, angular lamps, big lower intake, angular tails */
  c7:{xr:-1.32, xf:1.36, roofF:-0.35, cowl:0.15, roofR:-0.95, deck:-1.6, dG0:-0.55, qG0:null, hx:0.95, door:[-0.55,0.15], hood:[1.2,1.85], rimMat:"rimBlack", rows:[
    [-2.30,.36,.92,.96,.90,.84,.02],[-2.24,.28,.98,1.02,.93,.87,.02],[-1.90,.22,.97,1.05,.95,.86,.03],[-1.45,.20,.95,1.10,.96,.78,.04],
    [-0.95,.19,.92,1.19,.96,.64,.05],[-0.35,.19,.89,1.20,.95,.62,.05],[0.15,.18,.86,.98,.95,.80,.04],[0.70,.17,.82,.88,.95,.88,.03],
    [1.50,.16,.74,.79,.94,.88,.02],[2.05,.16,.62,.66,.92,.85,.02],[2.30,.18,.50,.52,.86,.78,.02]],
    dress:function(C){ var B=C.B, D=C.D, cF=C.cF, cR=C.cR, y=lerp(cF.zb,cF.ys,0.92), x=sc_faceX(D, C.xF, y, -1), P=sc_at(D, x-0.15);
      sc_flushLamps(C, C.xF-0.42, C.xF-0.14, 8.9);
      y=lerp(cF.zb,cF.ys,0.4); x=sc_faceX(D, C.xF, y, -1);
      B.add("well", sc_rbox(0.04, 0.12, cF.w*1.3, 0.03), sc_M(x-0.01, y, 0));
      B.add("carbonS", sc_prof([[0,0],[0.4,0],[0.44,0.03],[0,0.05]], cF.w*2*1.04, 0.006), sc_M(cF.x-0.34, cF.zb-0.04, 0));
      y=lerp(cR.zb,cR.ys,0.74); x=sc_faceX(D, C.xR, y, 1);
      [-1,1].forEach(function(sd){ for(var i=0;i<2;i++) C.tails.push({g:sc_rbox(0.03, 0.06, 0.2, 0.01), m:sc_M(x-0.004, y, sd*(cR.w*0.4+i*0.24), 0,0,0)}); });
      B.add("well", sc_rbox(0.04, 0.1, cR.w*0.8, 0.02), sc_M(cR.x+0.0, lerp(cR.zb,cR.ys,0.25), 0));
      sc_mirror(C, "aero");
    }},
  /* '41 Willys: narrow cab, separate fenders (flares), tall waterfall grille, lamp pods on the fenders */
  willys41:{xr:-1.30, xf:1.30, roofF:-0.2, cowl:0.2, roofR:-0.8, deck:-1.32, dG0:-0.35, qG0:-0.75, hx:1.0, door:[-0.48,0.1], hood:[1.3,1.8], rimMat:"rimBlack", noCarbonHood:true,
    flares:[{x:-1.30, span:0.78, amt:0.17, up:0.0},{x:1.30, span:0.62, amt:0.2, up:-0.02}], rows:[
    [-2.10,.34,.78,.82,.78,.72,.03],[-2.00,.26,.86,.95,.80,.74,.04],[-1.70,.22,.88,1.05,.80,.70,.05],[-1.30,.20,.88,1.18,.79,.62,.06],
    [-0.80,.20,.88,1.24,.78,.58,.06],[-0.20,.20,.88,1.25,.78,.58,.06],[0.20,.20,.88,1.06,.78,.66,.05],[0.40,.20,.88,1.01,.76,.64,.05],
    [1.40,.22,.86,.98,.70,.60,.06],[1.95,.26,.82,.93,.62,.54,.07],[2.12,.34,.70,.78,.55,.46,.06]],
    dress:function(C){ sc_willysFace(C, "chrome"); sc_mirror(C, "aero"); }}
};
/* pro stock: long smooth nose, small lip spoiler, side-exit headers, the tall NA hood scoop (sc_hoodX) */
SC_PM.prostock={xr:-1.32, xf:1.35, roofF:-0.25, cowl:0.6, roofR:-0.9, deck:-1.5, dG0:-0.6, qG0:-1.02, hx:0.95, door:[-0.55,0.3], hood:[1.5,2.25], rimMat:"rimBlack", rows:[
  [-2.40,.34,.86,.90,.86,.82,.02],[-2.32,.26,.96,1.00,.93,.88,.02],[-1.95,.21,.97,1.02,.95,.89,.03],[-1.50,.19,.955,1.06,.955,.78,.05],
  [-0.90,.18,.92,1.16,.955,.64,.05],[-0.25,.18,.89,1.17,.95,.62,.05],[0.25,.17,.87,1.03,.95,.74,.05],[0.60,.16,.85,.92,.95,.86,.04],
  [1.20,.15,.80,.86,.94,.88,.03],[1.95,.14,.70,.74,.92,.86,.02],[2.45,.15,.56,.59,.86,.78,.02],[2.60,.18,.44,.46,.76,.68,.02]],
  dress:function(C){ var B=C.B, D=C.D, cF=C.cF, cR=C.cR, y=lerp(cF.zb,cF.ys,0.95), x=sc_faceX(D, C.xF, y, -1), P=sc_at(D, x-0.2);
    sc_flushLamps(C, C.xF-0.5, C.xF-0.2, 8.8);   /* decal lamps */
    y=lerp(cF.zb,cF.ys,0.45); x=sc_faceX(D, C.xF, y, -1);
    B.add("well", sc_rbox(0.03, 0.05, cF.w*0.9, 0.015), sc_M(x-0.01, y, 0));
    B.add("carbonS", sc_prof([[0,0],[0.42,0],[0.46,0.025],[0,0.045]], cF.w*2*1.04, 0.006), sc_M(cF.x-0.36, cF.zb-0.04, 0));
    y=lerp(cR.zb,cR.ys,0.76); x=sc_faceX(D, C.xR, y, 1);
    C.tails.push({g:sc_rbox(0.03, 0.06, cR.w*1.7, 0.012), m:sc_M(x-0.004, y, 0)});
    B.add("carbonS", sc_rbox(0.05, 0.06, cR.w*1.9, 0.015), sc_M(cR.x+0.01, lerp(cR.zb,cR.ys,0.25), 0));
    sc_mirror(C, "aero");
  },
  rear:function(C){ var P=sc_at(C.D, C.xR+0.1); C.B.add("carbonS", sc_prof([[0.14,0],[0.0,0.09],[-0.06,0.1],[-0.08,0]], P.wt*2*0.98, 0.008), sc_M(C.xR+0.1, P.yt-0.012, 0));
    [-1,1].forEach(function(sd){ C.B.add("carbonS", sc_prof([[0.1,0],[0.0,0.1],[-0.08,0.11],[-0.08,0]], 0.012, 0.002), sc_M(C.xR+0.1, P.yt-0.01, sd*P.wt*0.98)); }); }
};
/* the hood hardware these shells add: pro stock scoop, gasser injector stacks; returns the injector hat (for the flame FX) */
function sc_hoodX(B, D, kind, hx, hood, slope, cowl){
  if(kind==="pstock"){
    B.add("paint", sc_prof([[0.5,0],[0.47,0.3],[0.34,0.32],[-0.4,0.2],[-0.62,0.06],[-0.64,0]], 0.5, 0.025), sc_M(hx+0.32, hood-0.02, 0, 0,0,slope*0.5));
    B.add("well", sc_rbox(0.02, 0.2, 0.38, 0.02), sc_M(hx+0.84, hood+0.16, 0, 0,0,slope*0.5));
    return new THREE.Vector3(hx+0.6, hood+0.3, 0);
  }
  /* 8 velocity stacks in two rows through a hole in the hood */
  B.add("well", sc_rbox(0.5, 0.02, 0.36, 0.008), sc_M(hx, hood+0.005, 0));
  B.add("satin", sc_rbox(0.44, 0.06, 0.3, 0.012), sc_M(hx, hood+0.03, 0));
  for(var i=0;i<4;i++) [-1,1].forEach(function(sd){ var x=hx-0.15+i*0.1, z=sd*0.075;
    B.add("chrome", new THREE.CylinderGeometry(0.03, 0.022, 0.2, 10, 1, true), sc_M(x, hood+0.16, z));
    B.add("chrome", sc_bezel(0.03, 0.008), sc_M(x, hood+0.26, z, 0,0,PI/2)); });
  return new THREE.Vector3(hx, hood+0.3, 0);
}
/* the Willys face, shared by the pro-mod and the gasser */
function sc_willysFace(C, trim){
  var B=C.B, D=C.D, cF=C.cF, cR=C.cR, y=lerp(cF.zb,cF.ys,0.6), x=sc_faceX(D, C.xF, y, -1), i;
  B.add("well", sc_rbox(0.03, 0.3, 0.3, 0.06), sc_M(x-0.01, y, 0));
  for(i=0;i<7;i++) B.add(trim, sc_rbox(0.02, 0.28, 0.012, 0.004), sc_M(x+0.005, y, -0.12+i*0.04));
  B.add(trim, sc_rbox(0.02, 0.32, 0.34, 0.03), sc_M(x-0.02, y, 0));
  var P=sc_at(D, C.xf); [-1,1].forEach(function(sd){ var lx=C.xf+0.12, ly=P.ys+0.02, lz=sd*(P.w-0.12);
    B.add("paint", new THREE.SphereGeometry(0.085, 12, 8), sc_M(lx, ly, lz, 0,0,0, 1.5,1,1));
    sc_roundLamp(C, C.heads, lx+0.12, ly, lz, 0.06, trim); });
  y=lerp(cR.zb,cR.ys,0.6); x=sc_faceX(D, C.xR, y, 1);
  [-1,1].forEach(function(sd){ sc_roundLamp(C, C.tails, x-0.01, y, sd*cR.w*0.7, 0.045, null); });
}

/* --- gassers: nose-high on a straight axle, no bars, chrome, headers out the fenders -------------------- */
function sc_gasChassis(C){   /* straight front axle on leaf springs, shocks */
  var B=C.B, y=C.fr, zf=Math.abs(C.zf);
  B.add("chrome", sc_cyl(0.03, 10), sc_rodM(new THREE.Vector3(C.xf, y, -zf+0.04), new THREE.Vector3(C.xf, y, zf-0.04)));
  [-1,1].forEach(function(sd){ var z=sd*(zf-0.2), P=sc_at(C.D, C.xf);
    B.add("black", sc_rbox(0.95, 0.04, 0.06, 0.01), sc_M(C.xf-0.05, y+0.06, z, 0,0,-0.04));
    B.add("chrome", sc_cyl(0.022, 8), sc_rodM(new THREE.Vector3(C.xf+0.08, y+0.03, z), new THREE.Vector3(C.xf+0.12, P.zb+0.05, z)));
    B.add("black", sc_rbox(0.08, Math.max(0.05, P.zb-y-0.02), 0.08, 0.01), sc_M(C.xf+0.4, (P.zb+y)/2+0.04, z)); });
}
function sc_gasExhaust(C){   /* short pipes out of the front fender, up and back: one per cylinder, a bank a side (inline: one side) */
  var P=sc_at(C.D, C.xf-0.6), PO=sc_ports(C.H), sp=Math.min(0.11, 0.4/Math.max(1,PO.per-1)), r=0.026*PO.r, yF=PO.flat?-0.06:0, x00=C.xf-0.42-Math.max(0,4-PO.per)*sp*0.5;
  PO.sides.forEach(function(sd){ for(var i=0;i<PO.per;i++){
    var x0=x00-i*sp, y=(C.dLift||0)+yF, a=new THREE.Vector3(x0+0.05, 0.42+y, sd*(P.w-0.12)), b=new THREE.Vector3(x0, 0.45+y, sd*(P.w+0.02)), c=new THREE.Vector3(x0-0.1, 0.6+i*0.01+y, sd*(P.w+0.1));
    C.B.add("chrome", sc_pipe([a,b,c], r)); sc_pipeEnd(C.B, "chrome", b, c, r);
    C.tips.push(c.clone()); C.dirs.push(c.clone().sub(b).normalize()); } });
}
var SC_GAS={
  /* '55 Chevy two-door: flat face, egg-crate grille, lamps in the fender eyebrows, front bumper gone, chrome out back */
  tri55:{xr:-1.46, xf:1.46, roofF:0.1, cowl:0.5, roofR:-0.95, deck:-1.5, dG0:-0.4, qG0:-1.05, hx:1.45, door:[-0.42,0.4], hood:[1.7,2.2],
    rake:0.055, lift:-0.03, fw:0.12, fr:0.3, fz:0.1, gapF:0.04, rimR:"star", rimF:"wire", rimMat:"chrome", lettersF:false, flames:true, rows:[
    [-2.45,.32,.80,.85,.88,.84,.02],[-2.38,.26,.88,.95,.90,.86,.02],[-1.95,.23,.90,.97,.91,.87,.02],[-1.50,.22,.905,.985,.915,.87,.03],
    [-1.25,.21,.91,1.30,.915,.70,.04],[-0.95,.21,.91,1.42,.915,.66,.05],[0.10,.21,.91,1.43,.915,.66,.05],[0.50,.21,.91,1.07,.915,.80,.03],
    [0.80,.21,.905,.99,.915,.86,.02],[2.0,.22,.89,.97,.91,.87,.02],[2.40,.24,.86,.93,.90,.86,.02],[2.50,.30,.84,.88,.88,.84,.02]],
    dress:function(C){ var B=C.B, D=C.D, cF=C.cF, cR=C.cR, y=lerp(cF.zb,cF.ys,0.52), x=sc_faceX(D, C.xF, y, -1), i;
      B.add("well", sc_rbox(0.03, 0.2, cF.w*1.45, 0.02), sc_M(x-0.01, y, 0));
      for(i=0;i<3;i++) B.add("chrome", sc_rbox(0.014, 0.012, cF.w*1.4, 0.004), sc_M(x+0.006, y-0.06+i*0.06, 0));
      for(i=0;i<7;i++) B.add("chrome", sc_rbox(0.014, 0.19, 0.012, 0.004), sc_M(x+0.006, y, -cF.w*0.6+i*cF.w*0.2));
      B.add("chrome", sc_rbox(0.02, 0.23, cF.w*1.5, 0.014), sc_M(x-0.016, y, 0));
      y=lerp(cF.zb,cF.ys,0.82); x=sc_faceX(D, C.xF, y, -1);
      [-1,1].forEach(function(sd){ sc_roundLamp(C, C.heads, x+0.01, y, sd*cF.w*0.82, 0.075, "chrome"); B.add("paint", sc_rbox(0.12, 0.04, 0.2, 0.02), sc_M(x-0.03, y+0.085, sd*cF.w*0.82)); });
      y=lerp(cR.zb,cR.ys,0.66); x=sc_faceX(D, C.xR, y, 1);
      [-1,1].forEach(function(sd){ C.tails.push({g:sc_rbox(0.03, 0.15, 0.08, 0.012), m:sc_M(x-0.004, y, sd*cR.w*0.86)}); B.add("chrome", sc_rbox(0.02, 0.17, 0.1, 0.012), sc_M(x+0.004, y, sd*cR.w*0.86)); });
      sc_bumper(B, "chrome", cR.x-0.06, lerp(cR.zb,cR.ys,0.12)+0.02, cR.w+0.04, 0.11, 0.09, -1);
      sc_beltTrim(C, C.qG0, C.cowl-0.04);
      sc_mirror(C, "bullet");
    },
    rear:function(C){}, chassis:sc_gasChassis, exhaust:sc_gasExhaust},
  /* Willys gasser: the '41 coupe stock height, nose way up */
  willys:{xr:-1.30, xf:1.30, roofF:-0.2, cowl:0.2, roofR:-0.8, deck:-1.32, dG0:-0.35, qG0:-0.75, hx:1.05, door:[-0.48,0.1], hood:[1.3,1.8],
    rake:0.07, lift:-0.03, fw:0.12, fr:0.3, fz:0.16, gapF:0.04, rimR:"star", rimF:"wire", rimMat:"chrome", lettersF:false, flames:true,
    flares:[{x:-1.30, span:0.78, amt:0.17, up:0.0},{x:1.30, span:0.62, amt:0.2, up:-0.02}], rows:[
    [-2.10,.34,.78,.82,.78,.72,.03],[-2.00,.26,.86,.95,.80,.74,.04],[-1.70,.22,.88,1.07,.80,.70,.05],[-1.30,.20,.88,1.22,.79,.62,.06],
    [-0.80,.20,.88,1.34,.78,.58,.06],[-0.20,.20,.88,1.35,.78,.58,.06],[0.20,.20,.88,1.1,.78,.66,.05],[0.40,.20,.88,1.03,.76,.64,.05],
    [1.40,.22,.86,.99,.70,.60,.06],[1.95,.26,.82,.94,.62,.54,.07],[2.12,.34,.70,.78,.55,.46,.06]],
    dress:function(C){ sc_willysFace(C, "chrome"); sc_mirror(C, "bullet"); },
    rear:function(C){}, chassis:sc_gasChassis, exhaust:sc_gasExhaust}
};
/* ---------------------------------------------------------------------------
   DRAG CARS v3 — the nitro classes.
   sc_tfrail: Top Fuel-scale dragster (300" wheelbase, biplane rear wing high over the slicks, a big front wing,
              14-71 blower + butterfly hat, eight zoomies a side, the cage). Replaces the v2 rail when hw is given.
   sc_funny:  nitro funny car — a one-piece carbon body (res.flipB -> its own group, hinged at the back, so the
              pits can lift it) over a short (125") chassis, blower and hat through the hood, headers out the sides.
   Both hand meta.flames = every header outlet ({p, d}, body frame) for the night-time header flames (dragfx),
   meta.eng (engine centre) and meta.hat (blower hat).
   -------------------------------------------------------------------------*/
function sc_V(x,y,z){ return new THREE.Vector3(x,y,z); }
/* a 14-71 style blower on a manifold, with restraint straps and a butterfly hat; returns the hat mouth */
function sc_bigBlower(B, x, y, len, hatMat){
  B.add("satin", sc_rbox(len*0.92, 0.08, 0.36, 0.015), sc_M(x, y+0.04, 0));                    /* manifold */
  B.add("alu", sc_rbox(len, 0.3, 0.36, 0.05), sc_M(x, y+0.23, 0));                           /* case */
  for(var i=0;i<6;i++) B.add("satin", sc_rbox(0.014, 0.18, 0.37, 0.004), sc_M(x-len*0.4+i*len*0.16, y+0.24, 0));
  B.add("satin", sc_rbox(0.05, 0.02, 0.4, 0.006), sc_M(x-len*0.25, y+0.39, 0)); B.add("satin", sc_rbox(0.05, 0.02, 0.4, 0.006), sc_M(x+len*0.25, y+0.39, 0));
  B.add("alu", sc_rbox(0.12, 0.2, 0.2, 0.03), sc_M(x+len*0.5+0.05, y+0.2, 0));                 /* snout / drive */
  B.add("satin", sc_rbox(len*0.7, 0.04, 0.34, 0.012), sc_M(x, y+0.4, 0));                    /* hat base */
  B.add(hatMat||"alu", sc_prof([[0.26,0],[0.3,0.34],[0.12,0.4],[-0.26,0.3],[-0.28,0]], 0.34, 0.02), sc_M(x+0.03, y+0.42, 0));
  B.add("well", sc_rbox(0.02, 0.26, 0.26, 0.01), sc_M(x+0.315, y+0.6, 0, 0,0,0.12));
  return sc_V(x+0.1, y+0.86, 0);
}
/* eight short zoomies per side, up and back; pushes every outlet to flames, two per side to the exhaust tips */
function sc_zoomies(B, x0, dx, y, z0, len, tips, dirs, flames, out, H){
  /* a pipe per cylinder over the same engine length (V8: four a bank); inline / rotary one side; flat lower and wider */
  var PO=sc_ports(H), n=PO.per, sp=n>1?Math.min(dx*2, dx*7/(n-1)):0, xs=x0-dx*3.5+sp*(n-1)/2, r=0.027*PO.r;
  if(PO.flat){ y-=0.12; z0+=0.06; out=(out||0.3)+0.15; }
  PO.sides.forEach(function(sd){ for(var i=0;i<n;i++){
    var x=xs-i*sp, a=sc_V(x, y, sd*z0), b=sc_V(x-0.02, y+0.05, sd*(z0+0.1)), c=sc_V(x-len*0.55, y+len*0.85, sd*(z0+0.1+len*(out||0.3)));
    if(!SC.lite || n<=4 || i%2===0){ B.add("alu", TUBE([a,b,c], r, SC.lite?2:6, SC.lite?5:10)); sc_pipeEnd(B, "alu", b, c, r); }   /* Lite: every other pipe past four, coarser */
    var d=c.clone().sub(b).normalize(); flames.push({p:c.clone(), d:d});
    if(PO.tip(i)){ tips.push(c.clone()); dirs.push(d.clone()); }
  } });
}

/* --- Top Fuel dragster ----------------------------------------------------- */
function sc_tfrail(B, rr, tails, heads, res, H){
  var xr=-3.2, xf=4.42, fr=0.29, V=sc_V, i;
  var D=sc_def([
    [-2.05,.20,.50,.62,.30,.27,.03],[-1.70,.19,.52,.66,.31,.26,.04],[-1.10,.18,.52,.70,.30,.24,.05],[-0.60,.17,.48,.62,.27,.22,.05],
    [0.60,.17,.40,.50,.21,.17,.04],[2.20,.18,.34,.42,.16,.13,.03],[3.80,.20,.30,.36,.12,.10,.03],[4.90,.21,.27,.31,.09,.075,.02],[5.55,.23,.25,.27,.05,.04,.01]], {sub:H.lite?2:3});
  var L=sc_loft(D); B.add("paint", L.paint); B.add("well", L.well);
  sc_decal(res, sc_patch(D, -0.55, 0.45, 2.3, 5.4, 0.004, null, 0.5)); sc_decal(res, sc_patch(D, -0.55, 0.45, 14.6, 17.7, 0.004, "L", 0.5));
  res.hood=sc_patch(D, 1.6, 3.0, 8.4, 11.6, 0.008, null, 0.5);
  /* cockpit, driver, cage */
  B.add("well", sc_patch(D, -1.95, -1.15, 8.6, 11.4, 0.004, null, 0.5));
  B.add("paint", new THREE.SphereGeometry(0.16, 16, 12), sc_M(-1.55, 0.9, 0));
  B.add("visor", new THREE.SphereGeometry(0.162, 12, 8, -0.9, 1.8, 1.2, 0.7), sc_M(-1.55, 0.9, 0, 0, PI, 0));
  B.add("satin", new THREE.CylinderGeometry(0.2, 0.26, 0.3, 12), sc_M(-1.6, 0.64, 0));
  [-1,1].forEach(function(sd){
    B.add("tube", sc_cyl(0.024,8), sc_rodM(V(-1.95,0.52,sd*0.28), V(-1.88,1.16,sd*0.2)));
    B.add("tube", sc_cyl(0.022,8), sc_rodM(V(-1.88,1.16,sd*0.2), V(-1.12,0.66,sd*0.26)));
    B.add("tube", sc_cyl(0.02,8), sc_rodM(V(-1.88,1.16,sd*0.2), V(-2.15,0.62,sd*0.28)));
    B.add("tube", sc_cyl(0.018,6), sc_rodM(V(-1.5,1.12,sd*0.18), V(-1.45,0.58,sd*0.29)));
    B.add("tube", sc_cyl(0.018,6), sc_rodM(V(-1.88,1.16,sd*0.2), V(-1.5,1.12,sd*0.18)));
  });
  B.add("tube", sc_cyl(0.022,8), sc_rodM(V(-1.88,1.16,-0.2), V(-1.88,1.16,0.2)));
  B.add("tube", sc_cyl(0.02,8), sc_rodM(V(-1.5,1.12,-0.18), V(-1.5,1.12,0.18)));
  /* chassis: rails from the axle forward to the body, triangulated */
  [-1,1].forEach(function(sd){
    B.add("tube", sc_cyl(0.028,8), sc_rodM(V(-2.05,0.22,sd*0.3), V(-3.55,0.26,sd*0.3)));
    B.add("tube", sc_cyl(0.024,8), sc_rodM(V(-2.1,0.6,sd*0.3), V(-3.5,0.62,sd*0.28)));
    for(i=0;i<3;i++) B.add("tube", sc_cyl(0.017,6), sc_rodM(V(-2.1-i*0.48,0.23,sd*0.3), V(-2.58-i*0.46,0.61,sd*0.29)));
    B.add("tube", sc_cyl(0.02,6), sc_rodM(V(-3.55,0.26,sd*0.3), V(-3.5,0.62,sd*0.28)));
  });
  B.add("satin", sc_cyl(0.065,12), sc_rodM(V(xr,rr,-0.42), V(xr,rr,0.42)));
  B.add("satin", sc_rbox(0.36,0.32,0.36,0.05), sc_M(xr, rr, 0));
  B.add("tube", sc_cyl(0.03,8), sc_rodM(V(xf,fr,-0.5), V(xf,fr,0.5)));
  /* engine ahead of the axle, the blower and hat on top, zoomies */
  var ex=-2.5, gates=[], hat=null, tips=[], dirs=[], flames=[], ra=H.asp;
  B.add("engine", sc_rbox(0.82,0.42,0.42,0.03), sc_M(ex, 0.48, 0));
  B.add("engine", sc_rbox(0.6,0.12,0.3,0.03), sc_M(ex, 0.24, 0));
  var PO=sc_ports(H);   /* heads to match: a V pair, one upright head (inline / rotary housing), or flat out to the sides */
  if(PO.one){ B.add("alu", sc_rbox(0.78,0.1,0.24,0.03), sc_M(ex, 0.8, 0)); B.add("engine", sc_rbox(0.8,0.16,0.3,0.02), sc_M(ex, 0.7, 0)); }
  else if(PO.flat) [-1,1].forEach(function(sd){ B.add("alu", sc_rbox(0.78,0.2,0.1,0.03), sc_M(ex, 0.5, sd*0.36)); B.add("engine", sc_rbox(0.8,0.24,0.16,0.02), sc_M(ex, 0.5, sd*0.26)); });
  else [-1,1].forEach(function(sd){ B.add("alu", sc_rbox(0.78,0.1,0.2,0.03), sc_M(ex, 0.76, sd*0.21, sd*-0.55,0,0)); B.add("engine", sc_rbox(0.8,0.2,0.16,0.02), sc_M(ex, 0.64, sd*0.2, sd*-0.55,0,0)); });
  if(ra==="blower") hat=sc_bigBlower(B, ex, 0.8, 0.86, "paint");
  else if(ra==="na"){ B.add("satin", sc_rbox(0.6,0.06,0.3,0.012), sc_M(ex, 0.85, 0)); B.add("paint", sc_prof([[0.18,0],[0.22,0.28],[0.06,0.32],[-0.2,0.25],[-0.2,0]], 0.3, 0.015), sc_M(ex+0.05, 0.87, 0)); B.add("well", sc_rbox(0.02,0.2,0.22,0.01), sc_M(ex+0.265, 1.02, 0, 0,0,0.15)); hat=V(ex+0.08, 1.2, 0); }
  else { B.add("satin", sc_rbox(0.6,0.06,0.3,0.012), sc_M(ex, 0.85, 0));
    (ra==="twin"||ra==="turbo"?[-1,1]:[1]).forEach(function(sd){
      B.add("alu", new THREE.CylinderGeometry(0.15,0.15,0.13,16), sc_M(ex+0.12, 0.98, sd*0.36, PI/2,0,0));
      B.add("barrel", new THREE.TorusGeometry(0.15,0.035,6,16), sc_M(ex+0.12, 0.98, sd*0.36));
      sc_bell(B, ex+0.3, 0.98, sd*0.36, 0.085);
      if(ra!=="centri"){ var a=V(ex-0.12, 0.9, sd*0.34), b=V(ex-0.2, 1.22, sd*0.38); B.add("chrome", sc_cyl(0.028,10), sc_rodM(a,b)); gates.push({p:b.clone(), d:V(-0.3,1,sd*0.1).normalize()}); } }); }
  sc_zoomies(B, ex+0.3, 0.085, PO.one?0.68:0.64, PO.one?0.17:0.3, 0.3, tips, dirs, flames, 0.25, H);
  /* biplane rear wing high over the slicks, on struts from the axle */
  var wx=-4.0, wl=1.72, wu=2.1;
  B.add("carbonS", sc_foil(0.78, 0.13, 1.3), sc_M(wx, wl, 0, 0,0,-0.32));
  B.add("carbonS", sc_foil(0.6, 0.12, 1.3), sc_M(wx-0.1, wu, 0, 0,0,-0.36));
  B.add("paint", sc_rbox(0.04, 0.05, 1.3, 0.01), sc_M(wx-0.4, wl+0.13, 0));
  [-1,1].forEach(function(sd){
    B.add("paint", sc_prof([[0.52,-0.28],[0.5,0.32],[0.1,0.66],[-0.52,0.66],[-0.56,-0.28]], 0.016, 0.004), sc_M(wx, wl, sd*0.66));
    B.add("tube", sc_cyl(0.03,8), sc_rodM(V(-3.45,0.62,sd*0.28), V(wx+0.15,wl-0.1,sd*0.32)));
    B.add("tube", sc_cyl(0.02,6), sc_rodM(V(-3.0,0.62,sd*0.28), V(wx+0.3,wl-0.08,sd*0.32)));
    B.add("tube", sc_cyl(0.016,6), sc_rodM(V(wx+0.1,wl+0.08,sd*0.32), V(wx,wu-0.06,sd*0.32)));
  });
  /* big front wing on the nose, ahead of the front wheels */
  var fx=5.05, fy=0.5;
  B.add("carbonS", sc_foil(0.36, 0.12, 1.24), sc_M(fx, fy, 0, 0,0,-0.18));
  [-1,1].forEach(function(sd){ B.add("paint", sc_prof([[0.22,-0.1],[0.22,0.1],[-0.22,0.16],[-0.22,-0.1]], 0.012, 0.003), sc_M(fx, fy, sd*0.62));
    B.add("tube", sc_cyl(0.014,6), sc_rodM(V(fx-0.05,0.27,sd*0.06), V(fx,fy-0.02,sd*0.3))); });
  /* wheelie bars, twin chute pack on the wing struts, brake light */
  var maxP=deg(3), bx0=-3.55, bx1=-5.15, br=0.06, dxB=bx1-xr, cy=(br-rr-dxB*Math.sin(maxP))/Math.cos(maxP)+rr;
  [-1,1].forEach(function(sd){ var b=V(bx1,cy,sd*0.2);
    B.add("tube", sc_cyl(0.022,8), sc_rodM(V(bx0,0.26,sd*0.24), b)); B.add("tube", sc_cyl(0.014,6), sc_rodM(V(bx0,0.6,sd*0.24), b));
    B.add("rubber", new THREE.CylinderGeometry(br,br,0.04,14), sc_M(bx1,cy,sd*0.2, PI/2,0,0)); B.add("alu", new THREE.CylinderGeometry(br*0.55,br*0.55,0.045,10), sc_M(bx1,cy,sd*0.2, PI/2,0,0)); });
  B.add("tube", sc_cyl(0.016,8), sc_rodM(V(bx1+0.05,cy,-0.2), V(bx1+0.05,cy,0.2)));
  [-1,1].forEach(function(sd){ B.add("bag", sc_rbox(0.26,0.26,0.24,0.05), sc_M(-3.72, 0.62, sd*0.14)); });
  B.add("paint", sc_rbox(0.03,0.2,0.5,0.012), sc_M(-3.86, 0.62, 0));
  tails.push({g:sc_rbox(0.03,0.05,0.3,0.01), m:sc_M(-3.875, 0.78, 0)});
  var wh=[], brk=!H.lite;
  [-1,1].forEach(function(sd){
    wh.push({x:xr, z:sd*0.62, r:rr, w:clamp(0.36+(rr*2/0.0254-32)*0.022,0.36,0.46), rimR:0.205, style:"bead", rimMat:"alu", rear:true, letters:true, brake:brk});
    wh.push({x:xf, z:sd*0.5, r:fr, w:0.07, rimR:0.215, style:"wire", rimMat:"alu", rear:false, letters:false});
  });
  if(brk) sc_calipers(B, wh);
  return { rr:rr, fr:fr, xr:xr, xf:xf, wheels:wh, tips:tips, dirs:dirs, flames:flames, headers:flames, eng:V(ex, 0.75, 0), anchor:V(-3.86,0.62,0), bars:true, maxPitch:maxP, gates:gates, hat:hat,
    squat:deg(0.4), squatDrop:0.008, shiftKick:0.08, pitchW:9.5, droop:0.03, wrinkle:1.15, chuteLen:5.8, chuteRise:0.6, chuteR:0.95 };
}

/* --- nitro funny car --------------------------------------------------------- */
function sc_funny(B, rr, tails, heads, res, H){
  var xr=-1.59, xf=1.59, fr=0.3, V=sc_V, FB=sc_bin(), i;
  res.flipB=FB;
  var D=sc_def([
    [-2.42,.30,.96,1.0,.88,.84,.02],[-2.34,.22,1.02,1.06,.93,.88,.02],[-1.85,.17,1.0,1.08,.96,.88,.03],[-1.40,.15,.97,1.12,.96,.78,.04],
    [-0.90,.14,.92,1.2,.95,.62,.04],[-0.30,.13,.87,1.18,.94,.6,.04],[0.20,.12,.82,.93,.93,.78,.03],[1.10,.10,.74,.80,.92,.84,.03],
    [2.20,.09,.58,.62,.88,.80,.02],[3.10,.08,.40,.43,.80,.70,.02],[3.48,.09,.24,.26,.66,.58,.01]],
    {arches:[{x:xr, y:rr, R:rr+0.04},{x:xf, y:fr, R:fr+0.05}], sub:H.lite?2:3});
  var L=sc_loft(D); FB.add("paint", L.paint); FB.add("carbonS", L.well);
  /* glass: windshield, backlight, small side glass; door decals and the hood patch ride on the body */
  FB.add("glass", sc_patch(D, -0.27, 0.17, 8.28, 11.72, 0.006));
  FB.add("glass", sc_patch(D, -1.42, -0.95, 8.28, 11.72, 0.006));
  FB.add("glass", sc_patch(D, -0.8, 0.1, 5.6, 7.7, 0.006)); FB.add("glass", sc_patch(D, -0.8, 0.1, 12.3, 14.4, 0.006, "L"));
  res.decals.push({g:sc_patch(D, -1.25, -0.25, 2.3, 4.75, 0.004, null, 0.5), kind:"door", flip:true});
  res.decals.push({g:sc_patch(D, -1.25, -0.25, 15.25, 17.7, 0.004, "L", 0.5), kind:"door", flip:true});
  res.decals.push({g:sc_patch(D, -0.29, -0.16, 8.3, 11.7, 0.009, "K", 0.5), kind:"banner", flip:true});
  res.hood=sc_patch(D, 1.6, 2.6, 8.45, 11.55, 0.012, "K", 0.5);
  /* the body's split line, carbon skirts and splitter, decal headlamps, rear spoiler on the deck */
  FB.add("seam", sc_patch(D, -2.39, -2.38, 1.6, 18.4, 0.002));
  FB.add("carbonS", sc_prof([[0,0],[0.42,0],[0.46,0.03],[0,0.05]], 1.66, 0.006), sc_M(3.0, 0.04, 0));
  FB.add("well", sc_patch(D, 2.55, 3.0, 8.2, 9.2, 0.005)); FB.add("well", sc_patch(D, 2.55, 3.0, 10.8, 11.8, 0.005));   /* decal headlamps */
  var sx=-2.3, sP=sc_at(D, sx);
  FB.add("carbonS", sc_prof([[0.3,0],[0.0,0.2],[-0.32,0.42],[-0.38,0.4],[-0.06,0]], 1.86, 0.008), sc_M(sx, sP.yt-0.03, 0));
  [-1,1].forEach(function(sd){ FB.add("carbonS", sc_prof([[0.3,0],[-0.4,0.46],[-0.42,0.2],[-0.1,-0.06]], 0.014, 0.003), sc_M(sx, sP.yt-0.03, sd*0.93)); });
  tails.push({g:sc_rbox(0.03, 0.05, 0.6, 0.012), m:sc_M(-2.43, 0.72, 0)});
  /* chassis: cage, driver (seen through the glass), rear axle, wheelie bars */
  B.add("paint", new THREE.SphereGeometry(0.155, 16, 12), sc_M(-0.72, 0.86, 0));
  B.add("visor", new THREE.SphereGeometry(0.157, 12, 8, -0.9, 1.8, 1.2, 0.7), sc_M(-0.72, 0.86, 0, 0, PI, 0));
  B.add("satin", new THREE.CylinderGeometry(0.2, 0.25, 0.3, 12), sc_M(-0.8, 0.58, 0));
  [-1,1].forEach(function(sd){ B.add("tube", sc_cyl(0.022,8), sc_rodM(V(-1.1,0.2,sd*0.32), V(-1.0,1.06,sd*0.24))); B.add("tube", sc_cyl(0.02,8), sc_rodM(V(-1.0,1.06,sd*0.24), V(-0.2,0.7,sd*0.3)));
    B.add("tube", sc_cyl(0.024,8), sc_rodM(V(-2.2,0.2,sd*0.3), V(2.4,0.16,sd*0.3))); });
  B.add("tube", sc_cyl(0.022,8), sc_rodM(V(-1.0,1.06,-0.24), V(-1.0,1.06,0.24)));
  B.add("satin", sc_cyl(0.065,12), sc_rodM(V(xr,rr,-0.46), V(xr,rr,0.46)));
  B.add("satin", sc_rbox(0.36,0.32,0.36,0.05), sc_M(xr, rr, 0));
  B.add("tube", sc_cyl(0.028,8), sc_rodM(V(xf,fr,-0.6), V(xf,fr,0.6)));
  /* engine: blower and hat out through the hood, eight headers a side out through the body behind the front wheels */
  var ex=0.75, hat=null, gates=[], tips=[], dirs=[], flames=[], P=sc_at(D, ex);
  B.add("engine", sc_rbox(0.8,0.4,0.44,0.03), sc_M(ex, 0.42, 0));
  if(H.asp==="blower" || H.asp==="na") hat=sc_bigBlower(B, ex, P.yt-0.06, 0.8, "paint");
  else { (H.asp==="twin"||H.asp==="turbo"?[-1,1]:[1]).forEach(function(sd){ sc_bell(B, ex+0.3, P.yt+0.08, sd*0.22, 0.09); });
    B.add("carbonS", sc_prof([[0.42,0],[0.3,0.1],[-0.36,0.12],[-0.42,0]], 0.7, 0.02), sc_M(ex, P.yt-0.02, 0)); }
  var hp=sc_at(D, ex+0.1);
  sc_zoomies(B, ex+0.32, 0.09, 0.52, hp.w-0.12, 0.26, tips, dirs, flames, 0.45, H);
  /* wheelie bars, twin chutes */
  var maxP=deg(4), bx0=-2.3, bx1=-3.9, br=0.06, dxB=bx1-xr, cy=(br-rr-dxB*Math.sin(maxP))/Math.cos(maxP)+rr;
  [-1,1].forEach(function(sd){ var b=V(bx1,cy,sd*0.24);
    B.add("tube", sc_cyl(0.022,8), sc_rodM(V(bx0,0.26,sd*0.3), b)); B.add("tube", sc_cyl(0.014,6), sc_rodM(V(bx0,0.5,sd*0.3), b));
    B.add("rubber", new THREE.CylinderGeometry(br,br,0.04,14), sc_M(bx1,cy,sd*0.24, PI/2,0,0)); B.add("alu", new THREE.CylinderGeometry(br*0.55,br*0.55,0.045,10), sc_M(bx1,cy,sd*0.24, PI/2,0,0)); });
  B.add("tube", sc_cyl(0.016,8), sc_rodM(V(bx1+0.05,cy,-0.24), V(bx1+0.05,cy,0.24)));
  [-1,1].forEach(function(sd){ B.add("bag", sc_rbox(0.24,0.26,0.24,0.05), sc_M(-2.55, 0.5, sd*0.15)); });
  B.add("satin", sc_rbox(0.04,0.3,0.56,0.012), sc_M(-2.44, 0.5, 0));
  var wh=[], brk=!H.lite;
  [-1,1].forEach(function(sd){
    wh.push({x:xr, z:sd*0.66, r:rr, w:clamp(0.36+(rr*2/0.0254-32)*0.022,0.36,0.46), rimR:0.205, style:"bead", rimMat:"rimBlack", rear:true, letters:true, brake:brk});
    wh.push({x:xf, z:sd*0.7, r:fr, w:0.1, rimR:0.19, style:"weld", rimMat:"rimBlack", rear:false, letters:false});
  });
  if(brk) sc_calipers(B, wh);
  return { rr:rr, fr:fr, xr:xr, xf:xf, wheels:wh, tips:tips, dirs:dirs, flames:flames, headers:flames, eng:V(ex, 0.7, 0), anchor:V(-2.6,0.5,0), bars:true, maxPitch:maxP, gates:gates, hat:hat,
    hinge:V(-2.4, 1.0, 0), squat:deg(0.6), squatDrop:0.012, shiftKick:0.1, pitchW:8.5, droop:0.035, wrinkle:1.15, chuteLen:5.4, chuteRise:0.5, chuteR:0.95 };
}
/* ---------------------------------------------------------------------------
   GROUNDING (drag fix pack) — what keeps a car sitting on the track instead of hovering over it:
   - stripContact(car, o): a soft contact-shadow decal under the car (ambient occlusion under the floor) with
     dark tyre contact patches, baked into one small canvas per footprint. One transparent quad per car on every
     tier (Lite too); it rides with the car group, not the body, so it stays on the ground through wheelies.
     o.y lifts/sinks it (the pits car is up on stands: the decal goes back down to the floor, softer and wider).
   - SC_RIDE: a little off the door cars' ride height (the body group sits lower over the wheels).
   - sc_skirt(B, me): side skirts under the sill between the arches, merged into the car's own black part
     (no extra draw call). Door cars only.
   -------------------------------------------------------------------------*/
var SC_RIDE={street:0.03, outlaw:0.025, promod:0.015, rail:0};
function scRide(me, body){ if(me && me.ride===undefined) me.ride=SC_RIDE[body]||0; return me?me.ride||0:0; }
function sc_skirt(B, me){
  var L=B.paint; if(!L||!L.length||!me) return;
  var g=L[0].g, p=g.attributes&&g.attributes.position; if(!p) return;
  var x0=me.xr+me.rr+0.14, x1=me.xf-me.fr-0.14, ymin=Infinity, zmax=0, i, x, y;
  if(!(x1-x0>0.4)) return;
  for(i=0;i<p.count;i++){ x=p.getX(i); if(x<x0||x>x1) continue; y=p.getY(i); if(y<ymin) ymin=y; }
  if(!isFinite(ymin)) return;
  for(i=0;i<p.count;i++){ x=p.getX(i); if(x<x0||x>x1) continue; if(p.getY(i)<ymin+0.035) zmax=Math.max(zmax, Math.abs(p.getZ(i))); }
  if(!(zmax>0.3)) return;
  var h=0.075, geo=sc_rbox(x1-x0, h, 0.04, 0.012);
  for(var sd=-1; sd<=1; sd+=2) B.add("black", geo, sc_M((x0+x1)/2, ymin+0.012-h/2, sd*(zmax-0.008)));
}
/* the decal texture: soft floor occlusion + a dark patch where each tyre meets the ground */
var SC_CONTACT={tex:{}, geo:{}};
function scContactTex(key, F){
  if(SC_CONTACT.tex[key]) return SC_CONTACT.tex[key];
  var W=256, H=128, c=sc_canvas(W,H), x=c.getContext("2d");
  var sx=W/F.lx, sz=H/F.lz, cx=function(v){ return (v-F.x0)*sx; }, cz=function(v){ return (v+F.lz/2)*sz; };
  x.clearRect(0,0,W,H);
  /* floor occlusion: blurred rounded slab under the body (drawn off canvas, only its shadow lands) */
  function blob(xa, xb, hz, a, blur){ var off=4000;
    x.save(); x.shadowColor="rgba(0,0,0,"+a+")"; x.shadowBlur=blur; x.shadowOffsetX=off; x.fillStyle="#000";
    var X0=cx(xa)-off, X1=cx(xb)-off, Z0=cz(-hz), Z1=cz(hz), r=Math.min((Z1-Z0)/2, 18);
    x.beginPath(); x.moveTo(X0+r,Z0); x.lineTo(X1-r,Z0); x.quadraticCurveTo(X1,Z0,X1,Z0+r); x.lineTo(X1,Z1-r); x.quadraticCurveTo(X1,Z1,X1-r,Z1); x.lineTo(X0+r,Z1); x.quadraticCurveTo(X0,Z1,X0,Z1-r); x.lineTo(X0,Z0+r); x.quadraticCurveTo(X0,Z0,X0+r,Z0); x.fill(); x.restore(); }
  blob(F.bx0, F.bx1, F.bhz, F.soft?0.5:0.82, F.soft?26:10); if(!F.soft) blob(F.bx0+0.25, F.bx1-0.25, F.bhz*0.7, 0.6, 16);
  if(F.rail) blob(F.bx0+0.3, F.bx1-0.4, 0.16, 0.35, 8);   /* the rail's chassis rails */
  /* tyres: a broad soft pool and a hard dark patch at the contact */
  F.wheels.forEach(function(w){ var X=cx(w.x), Z=cz(w.z), lx=Math.max(4, w.r*(F.soft?1.3:0.75)*sx), lz=Math.max(3, w.w*(F.soft?1.0:0.62)*sz);
    var g=x.createRadialGradient(0,0,0,0,0,1); g.addColorStop(0,"rgba(0,0,0,"+(F.soft?0.38:0.7)+")"); g.addColorStop(1,"rgba(0,0,0,0)");
    x.save(); x.translate(X,Z); x.scale(lx*1.7, lz*1.5); x.fillStyle=g; x.beginPath(); x.arc(0,0,1,0,TAU); x.fill(); x.restore();
    if(!F.soft){ var g2=x.createRadialGradient(0,0,0,0,0,1); g2.addColorStop(0,"rgba(0,0,0,1)"); g2.addColorStop(0.6,"rgba(0,0,0,0.92)"); g2.addColorStop(1,"rgba(0,0,0,0)");
      x.save(); x.translate(X,Z); x.scale(lx*0.8, lz*0.75); x.fillStyle=g2; x.beginPath(); x.arc(0,0,1,0,TAU); x.fill(); x.restore(); } });
  var t=sc_ctex(c, false); t.anisotropy=4; SC_CONTACT.tex[key]=t; return t;
}
function stripContact(car, o){
  var u=car&&car.userData; if(!u||!u.meta) return null; o=o||{};
  if(u._contact){ car.remove(u._contact); u._contact=null; }
  var me=u.meta, body=u.body, rail=body==="rail", wh=[], i;
  for(i=0;i<(me.wheels||[]).length;i++){ var ws=me.wheels[i]; wh.push({x:ws.x, z:ws.z, r:ws.r, w:ws.w||0.3}); }
  if(!wh.length) return null;
  /* footprint: the body group's box (car at rest, at the origin) */
  var keepP=car.position.clone(), keepR=car.rotation.clone(); car.position.set(0,0,0); car.rotation.set(0,0,0); car.updateMatrixWorld(true);
  var bb=new THREE.Box3(), inner=u.bodyGroup&&u.bodyGroup.children[0]; if(inner) inner.children.forEach(function(ch){ if(ch!==u.chute && ch.visible!==false) bb.expandByObject(ch); }); car.position.copy(keepP); car.rotation.copy(keepR); car.updateMatrixWorld(true);
  var wx0=Infinity, wx1=-Infinity, wz=0; wh.forEach(function(w){ wx0=Math.min(wx0,w.x-w.r); wx1=Math.max(wx1,w.x+w.r); wz=Math.max(wz, Math.abs(w.z)+w.w/2); });
  if(bb.isEmpty()) bb.set(new THREE.Vector3(wx0,0,-wz), new THREE.Vector3(wx1,1,wz));
  var soft=!!o.soft, pad=soft?0.7:0.35, x0=Math.min(bb.min.x, wx0)-pad, x1=Math.max(bb.max.x, wx1)+pad, hz=Math.max(wz, rail?0.3:Math.max(-bb.min.z, bb.max.z))+pad;
  var F={x0:x0, lx:x1-x0, lz:2*hz, wheels:wh, soft:soft, rail:rail,
    bx0:rail?wx0+0.2:bb.min.x+0.12, bx1:rail?bb.max.x-0.6:bb.max.x-0.1, bhz:rail?0.28:Math.max(0.3, Math.min(-bb.min.z, bb.max.z)-0.06)};
  var key=body+"|"+[x0,F.lx,F.lz,F.bx0,F.bx1,F.bhz].map(function(v){ return v.toFixed(2); }).join(",")+"|"+wh.map(function(w){ return w.x.toFixed(2)+":"+w.z.toFixed(2)+":"+w.r.toFixed(2)+":"+w.w.toFixed(2); }).join(",")+(soft?"|s":"");
  var tex=scContactTex(key, F), gk="q"+F.lx.toFixed(2)+"x"+F.lz.toFixed(2), geo=SC_CONTACT.geo[gk];
  if(!geo){ geo=new THREE.PlaneGeometry(F.lx, F.lz); geo.rotateX(-PI/2); geo.__cached=true; SC_CONTACT.geo[gk]=geo; }
  var mat=new THREE.MeshBasicMaterial({map:tex, color:0x000000, transparent:true, opacity:o.opacity==null?1:o.opacity, depthWrite:false,
    polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-4});
  /* black colour, alpha from the canvas: MeshBasic multiplies map.rgb (black) and keeps map.a */
  var m=new THREE.Mesh(geo, mat); m.name="stripContact"; m.renderOrder=1; m.frustumCulled=true;
  m.position.set(x0+F.lx/2, (o.y||0)+0.004, 0); m.castShadow=false; m.receiveShadow=false; m.matrixAutoUpdate=false; m.updateMatrix();
  /* Lite pays for the decal by not drawing the rims into the shadow map: the tyre around each one casts the same shadow */
  if(GFX==="lite") (u.carriers||[]).forEach(function(c){ var sp=c.userData&&c.userData.spin; if(sp) sp.traverse(function(q){ if(q.isMesh) q.castShadow=false; }); });
  car.add(m); u._contact=m; return m;
}
/* dusk glare (track shader, STRIP_TRACK_POST.light): with the sun on the horizon the glossy launch groove mirrored it into a
   white blob that the bloom then blew up; from dusk on the sharp highlight is capped and a broad warm sheen replaces it */
function stripGlare(){
  var d=STRIP.night?(STRIP.dusk||0):0, g=clamp(d*1.6,0,1);
  STRIP_U.uGlare.value=g; if(STRIP.sunDir) STRIP_U.uSunW.value.copy(STRIP.sunDir);
  if(STRIP.sun) STRIP_U.uGlareC.value.copy(STRIP.sun.color).multiplyScalar(0.13*g);
}
/* --- instanced billboard particles: one draw call per system (smoke = normal blend, flames = additive) ---
   opt (per scene, opt-in; without it the system is exactly the v1 one the bog, salt, pull, road and pits use):
     lit: volumetric-looking smoke. The texture is a normal-mapped puff atlas (stripSmokeTex): each puff is shaded by a key
          and a fill direction, an ambient and up to four point lights (the night floods, the exhaust flash), with
          forward scattering so smoke between the camera and a light glows at its thin edges (backlit). Sprites that
          fill the lens fade out so a cloud never whites out the shot. Uniforms are fed by stripFxLight().
     str: emit(..., {sx,sy,sz}) stretches a particle along that world vector (metres): flame cones, jets, purge plumes. */
function StripFx(cap, mode, tex, opt){
  opt=opt||{}; var additive=(mode==="add"); this.cap=cap; this.additive=additive; this.P=[]; this.opt=opt;
  var q=new THREE.PlaneGeometry(1,1), g=new THREE.InstancedBufferGeometry();
  g.setIndex(q.index); g.setAttribute("position", q.attributes.position); g.setAttribute("uv", q.attributes.uv);
  this.aPos=new THREE.InstancedBufferAttribute(new Float32Array(cap*3),3); this.aSz=new THREE.InstancedBufferAttribute(new Float32Array(cap),1);
  this.aCol=new THREE.InstancedBufferAttribute(new Float32Array(cap*4),4); this.aRot=new THREE.InstancedBufferAttribute(new Float32Array(cap),1);
  var at=[this.aPos,this.aSz,this.aCol,this.aRot];
  if(opt.str){ this.aStr=new THREE.InstancedBufferAttribute(new Float32Array(cap*3),3); g.setAttribute("iStr",this.aStr); at.push(this.aStr); }
  if(opt.lit){ this.aSeed=new THREE.InstancedBufferAttribute(new Float32Array(cap),1); g.setAttribute("iSeed",this.aSeed); at.push(this.aSeed); }
  at.forEach(function(a){ a.setUsage(THREE.DynamicDrawUsage); });
  g.setAttribute("iPos",this.aPos); g.setAttribute("iSz",this.aSz); g.setAttribute("iCol",this.aCol); g.setAttribute("iRot",this.aRot); g.instanceCount=0;
  this.geo=g;
  var U={ map:{value:tex}, uFog:{value:new THREE.Color(0.5,0.6,0.7)}, uFogN:{value:170}, uFogF:{value:3400}, uLit:{value:mode==="smoke"?1:0}, uAmb:{value:1} }, defs={};
  if(opt.str) defs.STR=1;
  if(opt.lit){ defs.VOL=1;
    U.uKeyV={value:new THREE.Vector3(0,1,0)}; U.uKeyC={value:new THREE.Color(0.5,0.5,0.5)}; U.uFillV={value:new THREE.Vector3(0,1,0)}; U.uFillC={value:new THREE.Color(0,0,0)};
    U.uAmbC={value:new THREE.Color(0.4,0.42,0.46)}; U.uBack={value:1}; U.uCover={value:1};
    U.uPtP={value:[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]}; U.uPtC={value:[new THREE.Color(0,0,0),new THREE.Color(0,0,0),new THREE.Color(0,0,0),new THREE.Color(0,0,0)]};
    U.uPtR={value:new THREE.Vector4(20,20,20,6)}; }
  this.mat=new THREE.ShaderMaterial({ uniforms:U, defines:defs,
    vertexShader:["attribute vec3 iPos; attribute float iSz; attribute vec4 iCol; attribute float iRot;",
      "varying vec2 vUv; varying vec4 vCol; varying float vDepth; varying float vShade;",
      "#ifdef STR\nattribute vec3 iStr; varying float vAlong; varying float vStr;\n#endif",
      "#ifdef VOL\nattribute float iSeed; varying vec3 vC; varying vec2 vCS; varying float vCover;\n#endif",
      "void main(){ vec4 mv=modelViewMatrix*vec4(iPos,1.0); float c=cos(iRot), s=sin(iRot);",
      "#ifdef STR\n vec3 sv3=(modelViewMatrix*vec4(iStr,0.0)).xyz; float L=length(sv3.xy); vStr=0.0; vAlong=0.5;",
      " if(L>0.001){ vec2 ax=sv3.xy/L, pp=vec2(-ax.y,ax.x); mv.xyz+=sv3*0.5; mv.xy+=ax*position.x*(L+iSz*0.5)+pp*position.y*iSz; vStr=1.0; vAlong=position.x+0.5; c=1.0; s=0.0; }",
      " else\n#endif",
      " mv.xy+=vec2(c*position.x-s*position.y, s*position.x+c*position.y)*iSz;",
      " gl_Position=projectionMatrix*mv; vUv=uv; vCol=iCol; vDepth=-mv.z; vShade=position.y+0.5;",
      "#ifdef VOL\n vC=mv.xyz; vCS=vec2(c,s); vUv=uv*0.5+vec2(step(0.5,fract(iSeed*2.0)), step(0.5,iSeed))*0.5;",
      " vCover=projectionMatrix[1][1]*iSz/max(0.1,-mv.z)*0.5;\n#endif",
      " }"].join("\n"),
    fragmentShader:["uniform sampler2D map; uniform vec3 uFog; uniform float uFogN; uniform float uFogF; uniform float uLit; uniform float uAmb;",
      "varying vec2 vUv; varying vec4 vCol; varying float vDepth; varying float vShade;",
      "#ifdef STR\nvarying float vAlong; varying float vStr;\n#endif",
      "#ifdef VOL\nvarying vec3 vC; varying vec2 vCS; varying float vCover;",
      "uniform vec3 uKeyV; uniform vec3 uKeyC; uniform vec3 uFillV; uniform vec3 uFillC; uniform vec3 uAmbC; uniform float uBack; uniform float uCover;",
      "uniform vec3 uPtP[4]; uniform vec3 uPtC[4]; uniform vec4 uPtR;",
      "float wrapL(vec3 n, vec3 l){ return clamp((dot(n,l)+0.3)/1.3,0.0,1.0); }\n#endif",
      "void main(){",
      "#ifdef VOL\n vec4 t=texture2D(map,vUv); vec3 nt=vec3(t.rg*2.0-1.0, t.b); vec3 n=normalize(vec3(vCS.x*nt.x-vCS.y*nt.y, vCS.y*nt.x+vCS.x*nt.y, nt.z+0.1));",
      " float a=t.a*vCol.a*smoothstep(0.35,2.0,vDepth)*(1.0-uCover*0.8*smoothstep(0.32,1.25,vCover));",
      " vec3 vd=normalize(vC); float thin=1.0-0.75*t.a, occ=0.5+0.5*vShade;",
      " vec3 li=uAmbC*occ + uKeyC*wrapL(n,uKeyV)*(0.55+0.45*occ) + uFillC*wrapL(n,uFillV);",
      " vec3 sc=uKeyC*pow(max(dot(vd,uKeyV),0.0),5.0)*thin*1.6;",
      " float rr[4]; rr[0]=uPtR.x; rr[1]=uPtR.y; rr[2]=uPtR.z; rr[3]=uPtR.w;",
      " for(int i=0;i<4;i++){ vec3 d=uPtP[i]-vC; float dl=length(d); vec3 l=d/max(dl,0.001); float q=dl/rr[i], att=1.0/(1.0+q*q*4.0);",
      "  li+=uPtC[i]*att*wrapL(n,l)*0.7; sc+=uPtC[i]*att*pow(max(dot(vd,l),0.0),3.0)*thin; }",
      " vec3 col=vCol.rgb*li+sc*uBack*mix(0.55,1.0,vCol.r); col=col/(1.0+max(0.0,max(col.r,max(col.g,col.b))-0.8)*0.9);   /* soft knee: lit smoke never burns out to a white blob */",
      "#else\n vec4 t=texture2D(map,vUv);",
      "#ifdef STR\n float wd=mix(1.0, 0.38+0.62*vAlong, vStr); t=texture2D(map, vec2(vUv.x, 0.5+(vUv.y-0.5)/wd)); t.a*=mix(1.0, 1.0-0.45*vAlong, vStr);\n#endif",
      " float a=t.a*vCol.a*smoothstep(0.35,2.0,vDepth);",
      " vec3 col=vCol.rgb*mix(1.0,(0.52+0.62*vShade)*uAmb,uLit);",
      "#ifdef STR\n col=mix(col, mix(vec3(0.85,0.92,1.0)*1.25, col, smoothstep(0.0,0.42,vAlong)), vStr*0.75);\n#endif",
      "#endif",
      " float f=smoothstep(uFogN,uFogF,vDepth);",
      " if(uLit>0.5) col=mix(col,uFog,f); else if(uAmb>0.0) a*=1.0-f;",
      " if(a<0.003) discard;",
      " gl_FragColor=linearToOutputTexel(vec4(col,a)); }"].join("\n"),
    transparent:true, depthWrite:false, blending:additive?THREE.AdditiveBlending:THREE.NormalBlending });
  this.mesh=new THREE.Mesh(g,this.mat); this.mesh.frustumCulled=false; this.mesh.renderOrder=additive?8:(mode==="fire"?7:6);
}
/* o: {drag, buoy, grav, fin (fade-in fraction), spin, sx/sy/sz (stretch, str systems), fout (fade-out power)} */
StripFx.prototype.emit=function(x,y,z, vx,vy,vz, life, s0,s1, r,g,b,a, o){
  if(this.P.length>=this.cap) this.P.shift();
  o=o||{};
  this.P.push({x:x,y:y,z:z,vx:vx,vy:vy,vz:vz,t:0,life:life,s0:s0,s1:s1,r:r,g:g,b:b,a:a,rot:Math.random()*TAU,vr:(Math.random()-0.5)*(o.spin===undefined?0.7:o.spin),
    drag:o.drag===undefined?1.0:o.drag, buoy:o.buoy||0, grav:o.grav||0, fin:o.fin===undefined?0.06:o.fin,
    sx:o.sx||0, sy:o.sy||0, sz:o.sz||0, seed:Math.random(), fo:o.fout||1.35});
};
StripFx.prototype.clear=function(){ this.P.length=0; this.geo.instanceCount=0; };
/* age every live particle k times faster this frame (the burnout cloud clearing once the car rolls in) */
StripFx.prototype.hasten=function(dt, k){ for(var i=0;i<this.P.length;i++) this.P[i].t+=dt*k; };
StripFx.prototype.step=function(dt, wind){
  var P=this.P, i, n=0;
  for(i=0;i<P.length;i++){ var p=P[i]; p.t+=dt; if(p.t>=p.life) continue;
    var k=Math.min(1,p.drag*dt); p.vx+=(wind.x-p.vx)*k; p.vz+=(wind.z-p.vz)*k; p.vy+=(p.buoy-p.grav)*dt-p.vy*k*0.4;
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt; if(p.y<0.05){ p.y=0.05; if(p.vy<0) p.vy=0; } p.rot+=p.vr*dt;
    P[n++]=p; }
  P.length=n;
  var pos=this.aPos.array, sz=this.aSz.array, col=this.aCol.array, rot=this.aRot.array, st=this.aStr?this.aStr.array:null, sd=this.aSeed?this.aSeed.array:null;
  for(i=0;i<n;i++){ p=P[i]; var f=p.t/p.life, e=1-Math.pow(1-f,2.2);
    pos[i*3]=p.x; pos[i*3+1]=p.y; pos[i*3+2]=p.z; sz[i]=p.s0+(p.s1-p.s0)*e; rot[i]=p.rot;
    col[i*4]=p.r; col[i*4+1]=p.g; col[i*4+2]=p.b; col[i*4+3]=p.a*Math.min(1,f/Math.max(0.001,p.fin))*Math.pow(1-f,p.fo);
    if(st){ var sk=1-0.35*f; st[i*3]=p.sx*sk; st[i*3+1]=p.sy*sk; st[i*3+2]=p.sz*sk; }
    if(sd) sd[i]=p.seed; }
  this.geo.instanceCount=n;
  this.aPos.needsUpdate=this.aSz.needsUpdate=this.aCol.needsUpdate=this.aRot.needsUpdate=true;
  if(st) this.aStr.needsUpdate=true; if(sd) this.aSeed.needsUpdate=true;
};
/* the strip's lit-smoke atlas: 2x2 cauliflower puffs, RGB = tangent-space normal, A = density (built once) */
var STRIP_SMOKE_TEX=null;
function stripSmokeTex(){
  if(STRIP_SMOKE_TEX) return STRIP_SMOKE_TEX;
  var N=256, C=128, d=new Uint8Array(N*N*4), h=new Float32Array(C*C), cx, cy, i, j, k, seed=11;
  function rnd(){ seed=(seed*16807)%2147483647; return seed/2147483647; }
  function sst(a,b,x){ var t=Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); }
  for(var cell=0;cell<4;cell++){
    h.fill(0); var bl=[[0.5,0.48,0.25,0.9]];
    /* lumps on three scales: a few big lobes, a ring of cauliflower heads, fine curds over the top */
    for(k=0;k<5;k++){ var an=rnd()*TAU, rd=0.12+rnd()*0.12; bl.push([0.5+Math.cos(an)*rd, 0.48+Math.sin(an)*rd*0.85, 0.13+rnd()*0.07, 0.6+rnd()*0.3]); }
    for(k=0;k<14+cell*2;k++){ an=rnd()*TAU; rd=0.18+rnd()*0.17; bl.push([0.5+Math.cos(an)*rd, 0.48+Math.sin(an)*rd*0.85, 0.05+rnd()*0.05, 0.22+rnd()*0.22]); }
    for(k=0;k<40;k++){ an=rnd()*TAU; rd=Math.sqrt(rnd())*0.36; bl.push([0.5+Math.cos(an)*rd, 0.48+Math.sin(an)*rd*0.85, 0.02+rnd()*0.02, 0.05+rnd()*0.06]); }
    for(j=0;j<C;j++) for(i=0;i<C;i++){ var u=(i+0.5)/C, v=(j+0.5)/C, s=0;
      for(k=0;k<bl.length;k++){ var q=bl[k], dx=u-q[0], dy=v-q[1], e=(dx*dx+dy*dy)/(q[2]*q[2]); if(e<5) s+=q[3]*Math.exp(-e); }
      var ru=Math.sqrt((u-0.5)*(u-0.5)+(v-0.48)*(v-0.48)); h[j*C+i]=s*(1-sst(0.36,0.5,ru)); }
    var hm=0; for(k=0;k<C*C;k++) hm=Math.max(hm,h[k]); for(k=0;k<C*C;k++) h[k]/=hm;
    cx=(cell&1)*C; cy=(cell>>1)*C;
    for(j=0;j<C;j++) for(i=0;i<C;i++){ var H=h[j*C+i], hx=h[j*C+Math.min(C-1,i+1)]-h[j*C+Math.max(0,i-1)], hy=h[Math.min(C-1,j+1)*C+i]-h[Math.max(0,j-1)*C+i];
      var nx=-hx*7, ny=-hy*7, nz=Math.sqrt(Math.max(0.02, 1-Math.min(0.98, nx*nx+ny*ny))), L=Math.sqrt(nx*nx+ny*ny+nz*nz);
      var o=((cy+j)*N+cx+i)*4; d[o]=Math.round((nx/L*0.5+0.5)*255); d[o+1]=Math.round((ny/L*0.5+0.5)*255); d[o+2]=Math.round(nz/L*255);
      d[o+3]=Math.round(sst(0.02,0.62,H)*255); } }
  var t=new THREE.DataTexture(d, N, N, THREE.RGBAFormat); t.magFilter=THREE.LinearFilter; t.minFilter=THREE.LinearMipmapLinearFilter; t.generateMipmaps=true; t.needsUpdate=true;
  STRIP_SMOKE_TEX=t; return t;
}

/* --- rubber laid on the track: instanced dark quads in a ring buffer --- */
function stripMarksInit(cap){
  var g=new THREE.PlaneGeometry(1,1); g.rotateX(-PI/2);
  var m=new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({color:0x030303, transparent:true, opacity:0.3, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-4}), cap);
  m.count=0; m.frustumCulled=false; m.renderOrder=2; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return {mesh:m, cap:cap, i:0, n:0};
}
var _mkM=new THREE.Matrix4(), _mkQ=new THREE.Quaternion(), _mkY=new THREE.Vector3(0,1,0);
function stripMark(a, b, w){
  var M=STRIP.marks; if(!M) return; var dx=b.x-a.x, dz=b.z-a.z, len=Math.max(0.35, Math.sqrt(dx*dx+dz*dz));
  _mkQ.setFromAxisAngle(_mkY, Math.atan2(-dz, dx||1e-6));
  _mkM.compose(_sbP.set((a.x+b.x)/2, 0.012, (a.z+b.z)/2), _mkQ, _sbS.set(len, 1, w));
  M.mesh.setMatrixAt(M.i, _mkM); M.i=(M.i+1)%M.cap; M.n=Math.min(M.cap, M.n+1); M.mesh.count=M.n; M.mesh.instanceMatrix.needsUpdate=true;
}

/* --- scoreboards: redrawn only when what they show changes --- */
function stripBoardDraw(d, force){
  var B=STRIP.board; if(!B) return; var X=STRIP.rn||{};
  ["p","o"].forEach(function(tag){ var L=d[tag]||{}, bd=B[tag], dl=tag==="p"?X.pdial:X.odial;
    var key=[L.et,L.mph,L.rt,L.win,L.foul,L.off,L.pb,STRIP.night,X.round,dl].join("|"); if(!force && key===bd.key) return; bd.key=key;
    var x=bd.cv.getContext("2d"), MONO="'IBM Plex Mono','Courier New',monospace", F="'Chakra Petch','Arial Narrow',Arial,sans-serif";
    x.fillStyle="#060607"; x.fillRect(0,0,512,256); x.strokeStyle="#34373c"; x.lineWidth=10; x.strokeRect(5,5,502,246);
    x.textBaseline="middle"; x.textAlign="left"; x.fillStyle="#9aa0a8"; x.font="700 "+(X.round?24:28)+"px "+F; x.fillText((tag==="p"?"RIGHT":"LEFT")+(X.round?" · "+X.round:" LANE"), 24, 36);
    x.beginPath(); x.arc(468,36,17,0,TAU); x.fillStyle=L.win?"#44ff72":"#16241a"; x.fill();
    if(L.win){ x.fillStyle="#44ff72"; x.font="700 28px "+F; x.textAlign="right"; x.fillText("WIN", 440, 37); }
    var amber=L.off?"#3a2a12":"#ffb22c", dim=L.off?"#2c220f":"#ffcf73";
    if(L.foul){ x.fillStyle="#ff3b30"; x.font="700 70px "+F; x.textAlign="center"; x.fillText("RED LIGHT", 256, 150); }
    else {
      x.textAlign="right"; x.fillStyle=dim; x.font="600 30px "+MONO; x.fillText("RT "+(L.rt!=null?(+L.rt).toFixed(3):"-.---"), 488, 80);
      if(dl!=null){ var bo=L.et!=null && +L.et<dl; x.textAlign="left"; x.fillStyle=bo?"#ff3b30":dim; x.fillText("DIAL "+(+dl).toFixed(2)+(bo?" BO":""), 24, 80); }   /* bracket: the dial-in, red when it broke out */
      x.textAlign="right"; x.fillStyle=amber; x.font="700 104px "+MONO; x.fillText(L.et!=null?(+L.et).toFixed(3):"--.---", 494, 150);
      x.fillStyle=dim; x.font="700 58px "+MONO; x.fillText((L.mph!=null?(+L.mph).toFixed(2):"---.--"), 400, 220);
      x.font="700 30px "+F; x.fillText("MPH", 488, 226); x.textAlign="left"; x.font="700 30px "+F; x.fillText("ET", 24, 136);
      /* personal best: purple for the all-time quickest, green for this engine's best */
      if(L.pb){ x.fillStyle=L.pb>1?"#c86bff":"#44ff72"; x.fillRect(24,188,116,54); x.fillStyle="#060607"; x.font="700 44px "+F; x.textAlign="center"; x.fillText("PB", 82, 217); }
    }
    bd.tex.needsUpdate=true; });
  stripTitleDraw(force);
}
/* v2: the title line over the boards: the round on a race night, the raceway otherwise, the winner's call after the final */
function stripTitleDraw(force){
  var T=STRIP.title; if(!T) return; var X=STRIP.rn||{}, hon=!!STRIP.honour;
  var txt=hon?"WON THE NIGHT":X.round?String(X.round):"SECTION LINE DRAGWAY", key=txt+"|"+hon;
  if(!force && key===T.key) return; T.key=key;
  var x=T.cv.getContext("2d"), F="'Chakra Petch','Arial Narrow',Arial,sans-serif";
  x.fillStyle="#060607"; x.fillRect(0,0,512,64); x.strokeStyle="#34373c"; x.lineWidth=6; x.strokeRect(3,3,506,58);
  x.fillStyle=hon?"#44ff72":X.round?"#ffb22c":"#9aa0a8"; x.textAlign="center"; x.textBaseline="middle";
  var sz=40; x.font="700 "+sz+"px "+F; while(sz>22 && x.measureText(txt).width>440){ sz-=2; x.font="700 "+sz+"px "+F; }
  x.fillText(txt, 256, 34);
  x.fillStyle=hon?"#44ff72":"#ff9a1c"; [22,490].forEach(function(cx){ x.beginPath(); x.arc(cx,32,7,0,TAU); x.fill(); });
  T.tex.needsUpdate=true;
}
function stripTmLane(){ return {px:null, pv:0, start:null, et:null, mph:null, cross:null}; }
function stripTiming(o, rdt){
  var ph=o.phase||"run";
  if(ph==="burnout"||ph==="staged"){ if(!STRIP.tm||STRIP.tm.used){ STRIP.tm={used:false, clock:0, p:stripTmLane(), o:stripTmLane()}; STRIP.pb=0; STRIP.pbCut=0; STRIP.win=0; STRIP.wonFx=0; STRIP.honour=0; STRIP.honourT=0; stripBoardDraw({p:{},o:{off:!o.race}}, false); } return; }
  var tm=STRIP.tm||(STRIP.tm={used:false, clock:0, p:stripTmLane(), o:stripTmLane()});
  tm.used=true; tm.clock+=rdt;
  function lane(L, x, v){
    if(L.start==null && x>=0.25){ var f=(L.px!=null && x>L.px)?clamp((0.25-L.px)/(x-L.px),0,1):1; L.start=tm.clock-rdt*(1-f); }
    if(L.et==null && L.start!=null && L.px!=null && L.px<STRIP_Q && x>=STRIP_Q){ var g=clamp((STRIP_Q-L.px)/Math.max(1e-6,x-L.px),0,1), tc=tm.clock-rdt*(1-g);
      L.et=tc-L.start; L.cross=tc; L.mph=(L.pv+(v-L.pv)*g)*2.23694; STRIP.cheer=Math.max(STRIP.cheer,0.8); }
    L.px=x; L.pv=v; }
  lane(tm.p, o.x||0, o.v||0); if(o.race) lane(tm.o, o.ox||0, o.ov||0);
  if(o.et!=null) tm.p.et=o.et; if(o.mph!=null) tm.p.mph=o.mph; if(o.oet!=null) tm.o.et=o.oet; if(o.omph!=null) tm.o.mph=o.omph;
  if(ph==="shutdown"||ph==="done"){
    var pd={et:o.failed?null:tm.p.et, mph:o.failed?null:tm.p.mph, rt:o.rt, foul:!!o.foul}, od={off:!o.race, et:tm.o.et, mph:tm.o.mph, rt:o.ort, foul:!!o.ofoul};
    pd.pb=pd.et!=null?STRIP.pb||0:0;
    if(o.race){ var pc=o.failed||o.foul?null:tm.p.cross, oc=tm.o.cross;
      if(o.win!=null){ pd.win=!!o.win; od.win=!o.win && (oc!=null||o.foul); }
      else { pd.win=pc!=null && (oc==null||pc<=oc); od.win=oc!=null && (pc==null||oc<pc) || (!!o.foul && !o.ofoul); } }
    stripBoardDraw(STRIP.boardD={p:pd, o:od}, false);
    if(pd.win && !STRIP.wonFx){ STRIP.wonFx=1; STRIP.flashT=Math.max(STRIP.flashT||0, 3.2); STRIP.cheer=Math.max(STRIP.cheer, 1.25); }   /* v2: every win: flashbulbs */
  }
}

/* --- day / night --- */
function stripEnv(night, dusk){
  var key=dusk?"k":night?"n":"d"; if(STRIP.env[key]) return STRIP.env[key];
  try{
    var s=new THREE.Scene(), mat=stripSkyMat(); mat.uniforms.uNight.value=night?1:0; mat.uniforms.uDusk.value=dusk?1:0; mat.uniforms.uGain.value=night?1:0.45; var sky=new THREE.Mesh(new THREE.SphereGeometry(100,32,16), mat); s.add(sky);
    var gm=new THREE.MeshBasicMaterial({color:night?0x040404:0x4a4330}), gd=new THREE.Mesh(new THREE.CircleGeometry(100,24), gm); gd.rotation.x=-PI/2; gd.position.y=-4; s.add(gd);
    var pm=new THREE.PMREMGenerator(renderer); var rt=pm.fromScene(s, 0.02, 0.1, 400); pm.dispose();
    sky.geometry.dispose(); mat.dispose(); gd.geometry.dispose(); gm.dispose();
    STRIP.env[key]=rt.texture; return rt.texture;
  }catch(e){ return null; }
}
function stripSetNight(on){
  on=!!on; var tierChanged=STRIP.tier!==GFX; if(STRIP.night===on && !tierChanged) return;
  STRIP.night=on; STRIP.tier=GFX; var S2=STRIP.scene, lite=(GFX==="lite"), M=STRIP.mats;
  STRIP.sky.material.uniforms.uNight.value=on?1:0;
  var h=on?STRIP_HOR_N:STRIP_HOR; STRIP.horLin=new THREE.Color(h[0],h[1],h[2]);
  STRIP.sunDir=(on?STRIP_MOON:STRIP_SUN_DAY);
  STRIP.sun.color.set(on?0x9fb2d6:0xffe2bc); STRIP.sun.intensity=on?0.14:1.45;
  STRIP.hemi.intensity=on?0.10:0.18; STRIP.hemi.color.set(on?0x3a4764:0xcfdcf0); STRIP.hemi.groundColor.set(on?0x16130e:0x6a5a3c);
  STRIP.flood.intensity=on?(lite?0.6:0.36):0;   /* a soft key from above the near stands so the cars read between the spots (no shadow, no cost) */
  M.lamp.color.set(on?0xffffff:0x5e5e5e);
  if(STRIP.beamMesh){ STRIP.beamMesh.visible=on; M.beam.opacity=on?0.012:0; ultraBeam(STRIP.beamMesh, M.beam); }
  var env=stripEnv(on); S2.environment=env;
  STRIP.exposure=on?0.95:0.9;
  if(STRIP.board){ ["p","o"].forEach(function(t){ STRIP.board[t].mesh.material.color.set(on?0xffffff:0xd8d8d8); }); }
  if(STRIP.tree) for(var k in STRIP.tree.halos){ var hl=STRIP.tree.halos[k], s=hl.userData.s*(on?1.5:1); hl.scale.set(s,s,s); }
  [STRIP.fx, STRIP.fxFire, STRIP.fxAdd].forEach(function(F){ if(F){ F.mat.uniforms.uAmb.value=F===STRIP.fx?(on?0.38:1):1; F.mat.uniforms.uFogN.value=S2.fog.near; F.mat.uniforms.uFogF.value=S2.fog.far; } });
  if(tierChanged){ var ms=lite?1024:2048; STRIP.sun.shadow.mapSize.set(ms,ms); if(STRIP.sun.shadow.map){ STRIP.sun.shadow.map.dispose(); STRIP.sun.shadow.map=null; } }
  /* floodlights: a few spots riding the nearest poles; shadows only on Full/Ultra */
  STRIP.spots.forEach(function(sp){ S2.remove(sp); S2.remove(sp.target); if(sp.shadow&&sp.shadow.map) sp.shadow.map.dispose(); }); STRIP.spots=[];
  if(on){ for(var i=0;i<3;i++){ var sp=new THREE.SpotLight(0xfff0d8, 1.25, 110, 0.72, 0.65, 1.6); sp.castShadow=!lite; if(!lite){ sp.shadow.mapSize.set(512,512); sp.shadow.bias=-0.0025; sp.shadow.normalBias=0.06; sp.shadow.camera.near=2; sp.shadow.camera.far=130; }
    S2.add(sp); S2.add(sp.target); STRIP.spots.push(sp); }
    STRIP.spots[1].castShadow=false; ultraSpots(STRIP.spots); }   /* v2: spots 0/1 are the cars' keys (stripKeySpots); only the player's casts a shadow (Ultra: all) */
  if(!lite) ultraShadow(STRIP.sun, 2048);
  STRIP.duskK=null;   /* v2: re-apply the dusk blend (and the stands' lights, the mirage) on top */
}

/* --- per-car helper data (tyre contact points, exhaust tips, engine, chute anchor), cached on rebuild --- */
function stripCarMeta(car){
  var u=car.userData; car.position.set(0,0,0); car.rotation.set(0,0,0); car.updateMatrixWorld(true);
  var bb=new THREE.Box3(), wp=new THREE.Vector3(), i;
  car.children.forEach(function(ch){ if(ch!==u.chute) bb.expandByObject(ch); });
  if(bb.isEmpty()) bb.set(new THREE.Vector3(-2.3,0,-1), new THREE.Vector3(2.3,1.4,1));
  var ws=[]; (u.wheels||[]).forEach(function(w){ w.getWorldPosition(wp); ws.push({p:wp.clone(), m:w}); });
  var minx=Infinity; ws.forEach(function(w){ minx=Math.min(minx,w.p.x); });
  var rear=ws.filter(function(w){ return w.p.x<minx+0.3; }), zmax=-Infinity, zmin=Infinity, wmax=null;
  rear.forEach(function(w){ if(w.p.z>zmax){ zmax=w.p.z; wmax=w.m; } zmin=Math.min(zmin,w.p.z); });
  if(!rear.length){ minx=bb.min.x+0.22*(bb.max.x-bb.min.x); zmax=bb.max.z*0.8; zmin=bb.min.z*0.8; }
  u._tyres=[new THREE.Vector3(minx,0,zmax), new THREE.Vector3(minx,0,zmin)];
  var tw=0.35; if(wmax){ var wb=new THREE.Box3().setFromObject(wmax); tw=clamp(wb.max.z-wb.min.z,0.18,0.6); } u._tyreW=tw;
  var rr=u.rr||0.35;
  /* the car's own outlet arrays, not copies: stripCarAnim moves them with the body every frame (wheelie, squat, roll) */
  var live=!!(u.exhaustTips&&u.exhaustTips.length&&u.exhaustDirs&&u.exhaustDirs.length===u.exhaustTips.length);
  u._tips=live? u.exhaustTips : [new THREE.Vector3(bb.min.x+0.1, Math.max(0.3,rr*0.9), 0.45), new THREE.Vector3(bb.min.x+0.1, Math.max(0.3,rr*0.9), -0.45)];
  u._dirs=live? u.exhaustDirs : u._tips.map(function(t,k){
    var sz=t.z>=0?1:-1; if(t.y>bb.max.y*0.8 && t.y>1.1) return new THREE.Vector3(-0.35,0.9,sz*0.15).normalize();
    if(Math.abs(t.z)>(bb.max.z-bb.min.z)*0.38 && t.x>bb.min.x+0.6) return new THREE.Vector3(-0.35,0.12,sz*0.93).normalize();
    return new THREE.Vector3(-1,0.14,sz*0.08).normalize(); });
  u._eng=u.enginePos? u.enginePos.clone() : (u.body==="rail" ? new THREE.Vector3(bb.min.x+(bb.max.x-bb.min.x)*0.3, bb.max.y*0.7, 0) : new THREE.Vector3(bb.max.x-(bb.max.x-bb.min.x)*0.24, bb.max.y*0.72, 0));
  u._chuteA=u.chuteAnchor? u.chuteAnchor.clone() : new THREE.Vector3(bb.min.x-0.3, bb.max.y*0.5, 0);
  u._len=bb.max.x-bb.min.x; u._bbMinX=bb.min.x; u._markLast=[]; u._acc=0; u._markT=0;
  u._gates=u.gates||[]; u._hat=u.hat||null; u._ex=null; u._hdr=undefined;
}

/* --- effects --- */
var STRIP_WIND=new THREE.Vector3(-0.8,0,-2.2), _sfA=new THREE.Vector3(), _sfB=new THREE.Vector3(), _sfD=new THREE.Vector3();
function stripTyreSmoke(car, dt, k, temp, still, v){
  /* v3 lit burnout smoke: fewer, denser puffs that roll off the tyre, billow and clear (1.0-1.7 s) instead of a long flat wall */
  var u=car.userData, FX=STRIP.fx; u._acc=(u._acc||0)+k*dt*(still?46:18); var n=Math.floor(u._acc); u._acc-=n; if(n<=0) return;
  var c=0.74+0.16*temp, a=(still?0.6:0.42)+0.3*temp, rr=u.rr||0.35;
  for(var t=0;t<u._tyres.length;t++){ car.localToWorld(_sfA.copy(u._tyres[t])); var sz=u._tyres[t].z>=0?1:-1;
    for(var i=0;i<n;i++){ var r=Math.random(), skirt=still && ((u._skI=(u._skI||0)+1)%3===0), cc=c*(0.94+Math.random()*0.08);
      if(skirt) FX.emit(_sfA.x-0.2+Math.random()*0.4, 0.22, _sfA.z+sz*0.2, -1.2-Math.random()*3, 0.15, sz*(1.6+Math.random()*2.6),
        1.2+r*0.5, 0.7, 3.6+Math.random()*1.4, cc, cc, cc*1.03, a*0.85, {drag:0.9, buoy:0.12, fin:0.1, spin:0.4, fout:1.5});   /* the low skirt that rolls out sideways */
      else FX.emit(_sfA.x-0.3+Math.random()*0.5, rr*(0.3+Math.random()*0.5), _sfA.z+(Math.random()-0.3)*0.35*sz,
        still? -2-Math.random()*5.5 : (v||0)*0.15+(Math.random()-0.5)*2, 0.7+Math.random()*1.5, sz*(0.3+Math.random()*2.2),
        still? 1.0+r*0.7 : 1.4+r*0.9, 0.6+Math.random()*0.5, (still?3.3:3.0)+Math.random()*(still?2.0:2.4), cc, cc, cc*1.03, a, {drag:0.8, buoy:0.6, fin:0.12, spin:0.5, fout:1.6}); } }
}
/* a sharp flame cone out of a pipe: a stretched additive core (white-blue at the base, the colour out at the tip) plus
   flickering stretched tongues; len in metres. r,g,b the flame's colour (orange; violet-blue on nitrous) */
function stripCone(FA, FF, p, d, carV, len, wid, r, g, b, k, lite){
  var sp=5+Math.random()*5, j=0.18;
  FA.emit(p.x, p.y, p.z, d.x*sp+carV, d.y*sp, d.z*sp, 0.05+Math.random()*0.035, wid, wid*1.2, r*k*1.6, g*k*1.6, b*k*1.6, 0.95,
    {drag:3, fin:0.01, spin:0, fout:0.8, sx:d.x*len, sy:d.y*len, sz:d.z*len});
  for(var i=0;i<(lite?1:2);i++){ var l2=len*(0.55+Math.random()*0.5), dx=d.x+(Math.random()-0.5)*j, dy=d.y+(Math.random()-0.5)*j, dz=d.z+(Math.random()-0.5)*j;
    FF.emit(p.x+d.x*0.05, p.y+d.y*0.05, p.z+d.z*0.05, dx*sp*1.3+carV, dy*sp*1.3+0.5, dz*sp*1.3, 0.06+Math.random()*0.06, wid*0.7, wid*0.9,
      1.0, 0.5+Math.random()*0.3, 0.12+Math.random()*0.1, 0.85*Math.min(1,k), {drag:2.5, buoy:1.5, fin:0.01, spin:0, sx:dx*l2, sy:dy*l2+0.05, sz:dz*l2}); }
}
function stripFlames(car, amt, shift, carV, tint){
  /* v3: two-step pops and shift flames are cones out of the tips, not round blobs over the car */
  var u=car.userData, FA=STRIP.fxAdd, FF=STRIP.fxFire, FX=STRIP.fx, lite=GFX==="lite", tn=clamp(tint||0,0,1);
  var fr=lerp(1.0,0.5,tn), fg=lerp(0.56,0.55,tn), fb=lerp(0.2,1.0,tn);
  for(var t=0;t<u._tips.length;t++){ car.localToWorld(_sfA.copy(u._tips[t])); _sfD.copy(u._dirs[t]).applyQuaternion(car.quaternion);
    var len=(shift?0.35:0.45)+amt*(shift?0.4:0.75);
    stripCone(FA, FF, _sfA, _sfD, carV, len*(0.8+Math.random()*0.4), 0.1+amt*0.08, fr, fg, fb, 1, lite);
    FA.emit(_sfA.x+_sfD.x*0.06, _sfA.y+_sfD.y*0.06, _sfA.z+_sfD.z*0.06, carV, 0, 0, 0.045, 0.16+amt*0.18, 0.26+amt*0.22, fr, lerp(0.7,0.6,tn), fb*0.8+0.2, 0.7, {drag:0, fin:0.01, spin:0});   /* the pop at the lip */
    if(Math.random()<0.4) FX.emit(_sfA.x+_sfD.x*0.4, _sfA.y+0.1, _sfA.z+_sfD.z*0.4, carV*0.6+_sfD.x*2, 0.6, _sfD.z*2, 0.8, 0.25, 1.1, 0.2, 0.2, 0.21, 0.32, {drag:1.2, buoy:0.4, fin:0.05});
    STRIP.flash.position.copy(_sfA).addScaledVector(_sfD,0.4); STRIP.flash.position.y+=0.25; }
  STRIP.flash.color.setHex(tn>0.5?0x7a8cff:0xff8a30);
  STRIP.flashI=Math.max(STRIP.flashI||0, amt*(shift?1.5:3)*(STRIP.night?0.5:1));
}
/* nitrous on the strip car: the purge cloud from the nozzle in the nose, a little flame at the pipes while the
   shot is in, and a fireball from the intake if a plate backfires (the burst panel) */
function stripN2O(o, dt, P){
  var u=P.userData, FX=STRIP.fx, lite=(GFX==="lite"), v=Math.max(0,o.v||0), pv=STRIP.prevN2O||(STRIP.prevN2O={});
  o=STRIP.n2oSt||{}; o.phase=o.phase||"staged";
  if(!u._eng) return;
  if((o.purge||0)>0.02){
    /* v3: a hard white jet that blooms into a cold cloud and sinks a little */
    var n=(lite?24:48)*dt*o.purge; u._pgAcc=(u._pgAcc||0)+n; var k=Math.floor(u._pgAcc); u._pgAcc-=k;
    _sfA.set(u._eng.x+(u._len||4)*0.17, u._eng.y+0.08, u._eng.z+0.22); P.localToWorld(_sfA);
    for(var i=0;i<k;i++){ var sp=6+Math.random()*6, jx=0.3+(Math.random()-0.5)*0.12, jy=0.42+Math.random()*0.12, jz=0.12+(Math.random()-0.5)*0.25, jet=((u._pgI=(u._pgI||0)+1)%3)===1;
      if(jet) FX.emit(_sfA.x, _sfA.y, _sfA.z, v+sp*jx, sp*jy, sp*jz, 0.24+Math.random()*0.1, 0.14, 0.45, 0.97, 0.98, 1.0, 0.95,
        {drag:3.0, fin:0.02, spin:0, fout:1.0, sx:jx*2.4, sy:jy*2.4, sz:jz*2.4});
      else FX.emit(_sfA.x+jx*0.6, _sfA.y+jy*0.6, _sfA.z+jz*0.6, v+sp*jx*0.6+(Math.random()-0.5)*1.2, sp*jy*0.5+Math.random()*0.6, (Math.random()-0.35)*2.4,
        0.8+Math.random()*0.5, 0.3, 1.8+Math.random()*1.2, 0.96, 0.97, 1.0, 0.85, {drag:3.2, buoy:0.1, grav:0.5, fin:0.08, spin:0.8}); }
  }
  if(o.phase==="run" && (o.n2o||0)>0.3){   /* v3: the shot in: a steady violet-blue flame tint at the pipes */
    var tr=dt*(lite?15:30)*o.n2o; u._nzAcc=(u._nzAcc||0)+tr;
    if(u._nzAcc>=1){ u._nzAcc-=1; var FA=STRIP.fxAdd;
      for(var t=0;t<u._tips.length;t++){ P.localToWorld(_sfA.copy(u._tips[t])); _sfD.copy(u._dirs[t]).applyQuaternion(P.quaternion);
        FA.emit(_sfA.x, _sfA.y, _sfA.z, _sfD.x*6+v, _sfD.y*6, _sfD.z*6, 0.09, 0.2, 0.28, 0.62, 0.72, 1.6, 0.95, {drag:3, fin:0.01, spin:0, fout:0.8, sx:_sfD.x*1.0, sy:_sfD.y*1.0, sz:_sfD.z*1.0}); }
      STRIP.flash.position.copy(_sfA); STRIP.flash.color.setHex(0x7a8cff); STRIP.flashI=Math.max(STRIP.flashI||0, STRIP.night?1.6:2.4); }
    if(Math.random()<dt*(lite?2:4)) stripFlames(P, 0.12+0.15*o.n2o, false, v, 1);
  }
  if(o.cut && !pv.cut){ P.localToWorld(_sfA.copy(u._eng)); _sfA.y+=0.3;
    for(var j=0;j<(lite?8:16);j++) STRIP.fxFire.emit(_sfA.x+(Math.random()-0.5)*0.4, _sfA.y, _sfA.z+(Math.random()-0.5)*0.4, v*0.9+(Math.random()-0.5)*3, 2+Math.random()*3, (Math.random()-0.5)*2, 0.25+Math.random()*0.2, 0.4, 1.4, 1.0, 0.5+Math.random()*0.2, 0.1, 0.9, {drag:1.5, buoy:2, fin:0.05, spin:3});
    STRIP.flash.color.setHex(0xff8a30); STRIP.flashI=Math.max(STRIP.flashI||0, 6); STRIP.flash.position.copy(_sfA); STRIP.shake=Math.max(STRIP.shake||0, 0.35); }
  pv.cut=!!o.cut;
}
/* v3 header flames (nitro rail, funny car): one cone per header outlet, tall at night. Outlets come from the shell's
   meta.headers [{p,d}] (same frame as meta.gates); a rail or funny car without them uses its exhaust tips. */
function stripHeaderPts(car){
  /* every header outlet is in flameTips (rail, funny car, gasser); pro stock's headers are its exhaust tips. Both are the
     live per-frame points, so the flames sit on the pipes through a wheelie */
  var u=car.userData; if(u._hdr!==undefined) return u._hdr;
  var me=u.meta||{}, L=null, T=null, D=null;
  if(u.flameTips && u.flameTips.length){ T=u.flameTips; D=u.flameDirs; }
  else if((me.headers && me.headers.length) || u.body==="rail" || u.body==="funny"){ T=u._tips; D=u._dirs; }
  if(T) L=T.map(function(p,k){ return {p:p, d:D[k]}; });
  u._hdr=L; return L;
}
function stripHeaders(o, dt, car, isP){
  var L=stripHeaderPts(car); if(!L) return;
  var u=car.userData, lite=GFX==="lite", ph=o.phase||"run", v=Math.max(0, isP?(o.v||0):(o.ov||0)), x=isP?(o.x||0):(o.ox||0);
  var nk=STRIP.night?1-0.55*(STRIP.dusk||0):(lite?0:0.3); if(nk<=0) return;
  var load=ph==="run" ? ((isP?v>0.2:x>0.15) ? (v<110?1:0.6) : 0.25) : ph==="burnout" ? ((isP?o.spin:o.oburn)?0.65:0.12) : ph==="staged" ? 0.15+0.6*clamp((o.launch&&o.launch.pops)||0,0,1) : 0;
  if(isP && o.shifting) load*=0.4;
  if(load<=0.01) return;
  var FA=STRIP.fxAdd, FF=STRIP.fxFire, step=lite?2:1, pr=(lite?0.45:0.85)*Math.min(1,load*1.3), last=null;
  for(var i=0;i<L.length;i+=step){ if(Math.random()>pr) continue; var h=L[i];
    car.localToWorld(_sfA.copy(h.p)); _sfD.copy(h.d).applyQuaternion(car.quaternion);
    var len=(0.35+0.85*load)*(0.7+Math.random()*0.6)*(0.6+0.4*nk);
    stripCone(FA, FF, _sfA, _sfD, v, len, 0.14+0.08*load, 1.0, 0.6, 0.24, nk, true); last=_sfA; }
  if(last){ STRIP.flash.position.copy(last); STRIP.flash.position.y+=0.3; STRIP.flash.color.setHex(0xff8a30); STRIP.flashI=Math.max(STRIP.flashI||0, 2.2*load*nk); }
}
/* v2 engine-true exhaust, per car from userData.hw (set at build): diesel black smoke on the launch and every shift;
   turbo wastegate flutter out of the dump pipes on a shift; an anti-lag car spits a fireball on every shift; a
   nitrous car in the other lane shows its blue flame. The player's own lane reads o.*, the other lane o.o* (ox, ov, oshifting).
   v3: hw.smoke (0-1, the build's peak smoke opacity) scales the diesel cloud; anti-lag is a short string of sharp cones. */
function stripExhaust(o, dt, car, isP){
  var u=car.userData, H=u.hw; if(!H || !u._tips) return;
  var FX=STRIP.fx, FF=STRIP.fxFire, FA=STRIP.fxAdd, lite=GFX==="lite", ph=o.phase||"run", t, i, k;
  var v=Math.max(0, isP?(o.v||0):(o.ov||0)), x=isP?(o.x||0):(o.ox||0), sh=isP?!!o.shifting:!!o.oshifting;
  var E=u._ex||(u._ex={sh:false, fl:0, flN:0, dz:0, alN:0, al:0, mv:false});
  var moving=ph==="run" && (isP ? v>0.2 : x>0.15), edge=sh && !E.sh && moving && v>2; E.sh=sh;
  var boosted=isP ? (o.boost||0)>0.3 || (o.boostTarget||0)>0.3 : v>6;
  /* diesel: a rolling black cloud off the line, a black cough on each shift, haze while it loads up on the line */
  if(H.diesel){
    var rh=isP?o.hw:(o.opp&&o.opp.hw), sm=(rh&&rh.smoke!=null)?clamp(+rh.smoke||0,0,1):0.5, big=0.35+1.1*sm;   /* sc_hw keeps only the shell keys: read smoke off the frame's own hw */
    var load=moving ? clamp(1-v/34,0.15,1) : (ph==="staged" && isP && o.launch && o.launch.held>0 ? 0.35 : 0);
    if(ph==="burnout" && isP && o.spin) load=0.5;
    var rate=(lite?11:26)*load*(isP?1:0.75)*big;
    if(moving && !E.mv) E.dz+=(lite?5:12)*big;   /* the hit: everything the pump had queued */
    if(edge) E.dz+=(lite?4:9)*big;
    E.dz+=rate*dt; E.mv=moving;
    var nD=Math.floor(E.dz); E.dz-=nD;
    for(i=0;i<nD;i++){ t=i%u._tips.length; car.localToWorld(_sfA.copy(u._tips[t])); _sfD.copy(u._dirs[t]).applyQuaternion(car.quaternion);
      var sp=3+Math.random()*4, c=0.018+Math.random()*0.03, gr=0.7+0.6*sm;
      FX.emit(_sfA.x+_sfD.x*0.15, _sfA.y+_sfD.y*0.15, _sfA.z+_sfD.z*0.15, _sfD.x*sp+v*0.55+(Math.random()-0.5), _sfD.y*sp*0.6+0.2+Math.random()*0.5, _sfD.z*sp+(Math.random()-0.5)*2.2,
        1.8+Math.random()*1.3, 0.45, (2.8+Math.random()*2.0)*gr, c*1.08, c, c*0.95, Math.min(0.95,0.66+0.3*sm), {drag:1.4, buoy:0.18, fin:0.05, spin:1.3, fout:1.2,
        sx:i<2&&edge?_sfD.x*0.7:0, sy:i<2&&edge?_sfD.y*0.7:0, sz:i<2&&edge?_sfD.z*0.7:0}); }
  }
  /* turbo: the wastegates flutter open on the lift: a sharp white jet, then a billow, out of the dumps */
  if(H.turbo && edge && boosted){ E.flN=lite?2:4; E.fl=0; E.flJ=1; }
  if(E.flN>0){ E.fl-=dt;
    if(E.fl<=0){ E.fl=0.06; E.flN--;
      var G=u._gates.length?u._gates:null;
      for(k=0;k<(G?G.length:u._tips.length);k++){
        if(G){ car.localToWorld(_sfA.copy(G[k].p)); _sfD.copy(G[k].d).applyQuaternion(car.quaternion); }
        else { car.localToWorld(_sfA.copy(u._tips[k])); _sfD.copy(u._dirs[k]).applyQuaternion(car.quaternion); }
        if(E.flJ || !lite) FX.emit(_sfA.x, _sfA.y, _sfA.z, _sfD.x*9+v*0.8, _sfD.y*9, _sfD.z*9, 0.22, 0.12, 0.3, 0.97, 0.98, 1.0, 0.92,
          {drag:3.5, fin:0.01, spin:0, fout:1.0, sx:_sfD.x*1.2, sy:_sfD.y*1.2, sz:_sfD.z*1.2});
        FX.emit(_sfA.x+_sfD.x*0.5, _sfA.y+_sfD.y*0.5, _sfA.z+_sfD.z*0.5, _sfD.x*4+v*0.7+(Math.random()-0.5), _sfD.y*4+Math.random(), _sfD.z*4+(Math.random()-0.5),
          0.7+Math.random()*0.35, 0.3, 1.4+Math.random()*0.6, 0.93, 0.94, 0.96, 0.75, {drag:2.4, buoy:0.8, fin:0.04, spin:1.2}); }
      E.flJ=0; } }
  /* anti-lag: a string of sharp bangs out of the pipes on every shift, each a cone, not a fireball over the car */
  if(H.als && edge && boosted){ E.alN=lite?2:3+(Math.random()<0.5?1:0); E.al=0; E.al0=1; }
  if(E.alN>0){ E.al-=dt;
    if(E.al<=0){ E.al=0.045+Math.random()*0.045; E.alN--;
      for(t=0;t<u._tips.length;t++){ car.localToWorld(_sfA.copy(u._tips[t])); _sfD.copy(u._dirs[t]).applyQuaternion(car.quaternion);
        var ln=(E.al0?2.3:1.6)+Math.random()*0.7;   /* longer and hotter than a shift pop, so it reads in daylight */
        stripCone(FA, FF, _sfA, _sfD, v*0.9, ln, E.al0?0.36:0.29, 1.0, 0.4, 0.08, 1.6, lite);
        FA.emit(_sfA.x+_sfD.x*0.08, _sfA.y+_sfD.y*0.08, _sfA.z+_sfD.z*0.08, v*0.9, 0, 0, 0.06, 0.3, E.al0?0.75:0.5, 1.0, 0.66, 0.3, 0.9, {drag:0, fin:0.01, spin:0});
        if(E.al0) for(i=0;i<(lite?1:2);i++) FX.emit(_sfA.x+_sfD.x*1.0, _sfA.y+0.3, _sfA.z+_sfD.z*1.0, v*0.6+_sfD.x*2, 1.0+Math.random(), _sfD.z*2+(Math.random()-0.5),
          1.0+Math.random()*0.5, 0.4, 1.7+Math.random()*0.8, 0.14, 0.13, 0.13, 0.42, {drag:1.3, buoy:0.6, fin:0.1});
        STRIP.flash.position.copy(_sfA).addScaledVector(_sfD,0.6); STRIP.flash.position.y+=0.3; }
      STRIP.flash.color.setHex(0xff8a30);
      STRIP.flashI=Math.max(STRIP.flashI||0, (isP?7:5)*(STRIP.night?0.6:1));
      if(isP && E.al0) STRIP.shake=Math.max(STRIP.shake||0, 0.12);
      E.al0=0; } }
  /* nitrous in the other lane: its blue flame at the pipes while the shot is in */
  if(!isP && H.n2o && moving && v>3 && v<75 && Math.random()<dt*(lite?4:9)) stripFlames(car, 0.25, false, v, 1);
  stripHeaders(o, dt, car, isP);
}
function stripEffects(o, dt, P, O){
  var FX=STRIP.fx, FA=STRIP.fxAdd, lite=(GFX==="lite"), rate=lite?0.55:1, ph=o.phase||"run", v=Math.max(0,o.v||0), u=P.userData, prev=STRIP.prev;
  var temp=o.tyreTemp==null?0.6:clamp(o.tyreTemp,0,1), race=!!(o.race&&O&&O.visible);
  var burn=(o.burnout||ph==="burnout") && o.spin;
  /* burnout smoke (both lanes in a race), launch haze while the tyres spin */
  if(burn){ stripTyreSmoke(P, dt, rate*(0.55+0.8*temp), temp, true, 0); if(race && Math.abs(O.position.x-P.position.x)<5) stripTyreSmoke(O, dt, rate*0.7, 0.55, true, 0); }
  else if(ph==="run" && o.spin && v<60) stripTyreSmoke(P, dt, rate*(0.45+0.4*temp), temp, false, v);
  if(ph==="staged" && FX.hasten) FX.hasten(dt, 1.4);   /* v3: the burnout cloud clears off the tree once the car rolls in */
  /* rubber on the track */
  if(o.spin && v<65 && ph!=="shutdown" && ph!=="done"){ for(var t=0;t<u._tyres.length;t++){ P.localToWorld(_sfB.copy(u._tyres[t])); var L=u._markLast[t];
      if(!L){ u._markLast[t]=_sfB.clone(); stripMark(_sfB,_sfB,u._tyreW); }
      else if(Math.abs(_sfB.x-L.x)>0.7 || (burn && STRIP.t-u._markT>0.45)){ stripMark(L,_sfB,u._tyreW); L.copy(_sfB); if(t===u._tyres.length-1) u._markT=STRIP.t; } } }
  else u._markLast=[];
  /* two-step / anti-lag bangs and shift pops */
  var pops=(o.launch&&o.launch.pops)||0, nz=STRIP.n2oSt, tn=(nz && ph==="run" && (nz.n2o||0)>0.3)?1:0;
  if(pops>0.02) stripFlames(P, clamp(pops,0,1), false, v, tn);
  if(o.shifting && !prev.shifting && (o.boost||0)>0.3) stripFlames(P, 0.5, true, v, tn);
  else if(o.shifting && (o.boost||0)>0.3 && Math.random()<dt*6) stripFlames(P, 0.3, true, v, tn);
  stripExhaust(o, dt, P, true); if(race) stripExhaust(o, dt, O, false);
  if(race && ph==="run" && o.ospin && (o.ov||0)<60) stripTyreSmoke(O, dt, rate*0.4, 0.5, false, o.ov||0);
  /* chute dust */
  if(o.chute && !prev.chute){ P.localToWorld(_sfA.copy(u._chuteA)); for(var i=0;i<(lite?9:16);i++) FX.emit(_sfA.x-Math.random()*2, 0.3+Math.random()*0.6, _sfA.z+(Math.random()-0.5)*2.4, v*0.35+(Math.random()-0.5)*4, 0.6+Math.random(), (Math.random()-0.5)*3, 1.6+Math.random(), 0.6, 3.2, 0.6, 0.53, 0.42, 0.34, {drag:1.3, buoy:0.2}); }
  if(o.chute && v>12 && Math.random()<dt*10*rate){ P.localToWorld(_sfA.copy(u._chuteA)); FX.emit(_sfA.x-1.5, 0.15, _sfA.z+(Math.random()-0.5)*1.5, v*0.5, 0.3, 0, 1.1, 0.5, 2.2, 0.58, 0.52, 0.43, 0.18, {drag:1.5}); }
  /* failure: oil smoke (dark), coolant (white), fire on a turbo/manifold */
  if(o.failed){ var kind=String(o.failKind||"rod"), steam=/steam|cool|gasket|head/.test(kind), fire=/turbo|manifold|fire|rod/.test(kind);
    if(!prev.failed){ STRIP.failT=0; STRIP.shake=Math.max(STRIP.shake,0.7); P.localToWorld(_sfA.copy(u._eng));
      for(i=0;i<(lite?14:26);i++) FA.emit(_sfA.x,_sfA.y,_sfA.z, v+(Math.random()-0.5)*14, 2+Math.random()*7, (Math.random()-0.5)*14, 0.35+Math.random()*0.3, 0.12, 0.05, 1.0, 0.75, 0.35, 1, {drag:0.3, grav:22, fin:0.01});
      FA.emit(_sfA.x,_sfA.y,_sfA.z, v, 0, 0, 0.1, 2.5, 3.5, 1, 0.7, 0.4, 1, {drag:0});
      STRIP.flashI=Math.max(STRIP.flashI||0, 10); STRIP.flash.position.copy(_sfA); }
    STRIP.failT=(STRIP.failT||0)+dt;
    var fr=rate*(STRIP.failT<4?1:0.5)*dt*30, nf=Math.floor(fr)+(Math.random()<fr%1?1:0);
    P.localToWorld(_sfA.copy(u._eng));
    for(i=0;i<nf;i++){ var cc=steam?0.86:0.07+Math.random()*0.05;
      FX.emit(_sfA.x+(Math.random()-0.5)*0.6, _sfA.y+0.2, _sfA.z+(Math.random()-0.5)*0.6, v*0.25+(Math.random()-0.5), 1.4+Math.random()*1.5, (Math.random()-0.5)*1.2, 2.6+Math.random()*1.4, 0.9, 4.5+Math.random()*2, cc, cc, cc*1.04, steam?0.45:0.62, {drag:0.8, buoy:0.5, fin:0.05}); }
    if(fire && STRIP.failT<5){ var nfl=Math.round((lite?3:6)*dt*10*Math.max(0.2,1-STRIP.failT/5));
      for(i=0;i<nfl;i++) STRIP.fxFire.emit(_sfA.x+(Math.random()-0.5)*0.5, _sfA.y+Math.random()*0.3, _sfA.z+(Math.random()-0.5)*0.5, v*0.8, 2.5+Math.random()*2.5, (Math.random()-0.5), 0.22+Math.random()*0.15, 0.45, 1.3, 1.0, 0.38+Math.random()*0.25, 0.08, 0.8, {drag:1.5, buoy:2, fin:0.05, spin:3});
      STRIP.flashI=Math.max(STRIP.flashI||0, 2.5+Math.random()*2); STRIP.flash.position.copy(_sfA); }
  }
  STRIP.flashI=(STRIP.flashI||0)*Math.exp(-dt*24); STRIP.flash.intensity=STRIP.flashI;
  if(race && ph==="staged" && pops>0.02 && Math.random()<0.55) stripFlames(O, pops*(0.4+Math.random()*0.5), false, 0);
  FX.step(dt, STRIP_WIND); STRIP.fxFire.step(dt, STRIP_WIND); FA.step(dt, STRIP_WIND);
}

/* --- tree lights --- */
function stripTreeLights(o){
  var T=STRIP.tree; if(!T) return; var tr=o.tree||{}, ph=o.phase||"run", px=o.x||0, ox=o.ox||0, race=!!o.race, night=!!STRIP.night;
  function set(n,on){ var b=T.bulbs[n]; if(!b) return; b.material.emissiveIntensity=on?(night?4.0:3.4):0; var h=T.halos[n]; if(h) h.visible=!!on; }
  var near=function(x){ return ph!=="burnout" && x>-1.2 && x<0.9; };
  set("ppre", tr.pre!=null?tr.pre&&px<0.9:near(px)); set("pstage", !!tr.staged && ph!=="burnout" && px<0.4);
  set("pa1", tr.a1); set("pa2", tr.a2); set("pa3", tr.a3); set("pg", tr.green&&!o.foul); set("pr", !!o.foul);
  set("opre", race && (tr.opre!=null?tr.opre&&ox<0.9:near(ox))); set("ostage", race && !!(tr.ostaged!=null?tr.ostaged:tr.staged) && ph!=="burnout" && ox<0.4);
  set("oa1", race&&tr.a1); set("oa2", race&&tr.a2); set("oa3", race&&tr.a3); set("og", race&&tr.green&&!o.ofoul); set("or", race&&!!o.ofoul);
  if(o.otree){ var ot=o.otree; set("oa1", race&&ot.a1); set("oa2", race&&ot.a2); set("oa3", race&&ot.a3); set("og", race&&ot.green&&!o.ofoul); }   /* bracket: the slower dial's tree counts down first */
}
/* --- crowd gets up for the launch and the finish (billboard crowd: the bounce, sway and poses run in its vertex shader) --- */
function stripCrowd(dt){
  var C=STRIP.crowd; if(!C) return; if(C.tier!==GFX) stripVenueTier(); STRIP.cheer=Math.max(0,STRIP.cheer-dt*0.28);
  var amp=STRIP.cheer; C.u.value.x=STRIP.t%600; C.u.value.y=amp<0.02?0:amp; C.live=amp>=0.02||!!C.wave;
  if(amp>1 && STRIP.fxAdd){ var fr=(amp>1.8?70:35)*dt, nf=Math.floor(fr)+(Math.random()<fr%1?1:0);   /* a PB: phones and flashes going off in the stands */
    while(nf-->0){ var q=C.base[(Math.random()*C.n)|0]; STRIP.fxAdd.emit(q[0], q[1]+1.0, q[2]+0.3, 0,0,0, 0.16, 0.8, 1.1, 1, 0.97, 0.9, 1, {drag:0, fin:0.01}); } }
}

/* --- v2 world: dusk to dark across a race night, key lights on the cars, crowd pay-offs --- */
/* nightK 0..1 (race nights: Q1 = 0 dusk … final = 1 full dark); missing = 1, i.e. plain night as before. Day ignores it. */
function stripDusk(nk){
  var k=(nk==null||!isFinite(+nk))?1:clamp(+nk,0,1), lite=GFX==="lite", key=(STRIP.night?1:0)+":"+k.toFixed(3); if(STRIP.duskK===key) return; STRIP.duskK=key;
  var U=STRIP.sky.material.uniforms, d=STRIP.night?Math.pow(1-k,1.15):0; STRIP.dusk=d; U.uDusk.value=d;
  STRIP_U.uHaze.value=(!STRIP.night && !lite)?1:0; STRIP_U.uCrowdLit.value=STRIP.night?0.16+0.06*(1-d):0;
  var h=STRIP.night?STRIP_HOR_N:STRIP_HOR; STRIP_U.uHorC.value.setRGB(h[0],h[1],h[2]).multiplyScalar(0.9);
  if(!STRIP.night) return;
  var hn=STRIP_HOR_N, hd=STRIP_HOR_D; STRIP.horLin=new THREE.Color(lerp(hn[0],hd[0],d), lerp(hn[1],hd[1],d), lerp(hn[2],hd[2],d));
  STRIP.sunDir=d>0.001?STRIP_DUSK_LIGHT:STRIP_MOON;
  STRIP.sun.color.set(0x9fb2d6).lerp(new THREE.Color(0xff9a5c), d); STRIP.sun.intensity=lerp(0.14, 0.7, d);
  STRIP.hemi.intensity=lerp(0.10, 0.24, d); STRIP.hemi.color.set(0x3a4764).lerp(new THREE.Color(0x9a86b4), d);
  if(STRIP.beamMesh) STRIP.mats.beam.opacity=0.012*(1-0.7*d);
  var env=stripEnv(true, d>0.45); if(env) STRIP.scene.environment=env;
}
/* night: two of the three spots become key lights riding above each car (no extra lights; shadowed only off Lite, as before) */
function stripKeySpots(P, O){
  var sp=STRIP.spots, i, cars=[P, O&&O.visible?O:null];
  for(i=0;i<2;i++){ var L=sp[i], c=cars[i]; if(!L || !c) continue; var zs=c.position.z>=0?1:-1;
    L.position.set(c.position.x+6, 15, zs*9.6); L.target.position.set(c.position.x+0.4, 0.4, c.position.z); L.target.updateMatrixWorld();
    L.angle=0.27; L.penumbra=0.75; L.distance=50; L.intensity=0.95; }
}
/* the lit stands: each person glows in their own colour a little under the canopy lights (the billboard crowd material does it itself) */
function stripCrowdLit(m){
  m.onBeforeCompile=function(sh){ sh.uniforms.uCrowdLit=STRIP_U.uCrowdLit;
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uCrowdLit;").replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*uCrowdLit;"); };
  m.customProgramCacheKey=function(){ return "stripCrowdLit"; };
}
/* the crowd colour wave (the final, and won the night): cards up in a band that runs along the stands — two bands 75 m apart, on the GPU */
function stripWave(t, off){
  var C=STRIP.crowd; if(!C||!C.u) return; C.u.value.z=t*24; C.u.value.w=off?0:1;
  if(off){ C.live=true; }
}
function stripPayoffs(o, dt, P, O){
  var ph=o.phase||"run", C=STRIP.crowd, lite=GFX==="lite", i;
  STRIP_U.uTime.value=STRIP.t%600;
  /* fresh rubber: the burnout leaves a shine in each lane's groove; tyres in the water ripple the box */
  var burn=(o.burnout||ph==="burnout") && o.spin, sh=STRIP_U.uShine.value;
  if(burn){ sh.x=Math.min(1, sh.x+dt*0.45); if(o.race && O && O.visible && Math.abs(O.position.x-P.position.x)<5) sh.y=Math.min(1, sh.y+dt*0.4); }
  STRIP_U.uRip.value+=((burn?1:0)-STRIP_U.uRip.value)*Math.min(1, dt*(burn?4:0.8));
  if(STRIP.honour) STRIP.honourT=(STRIP.honourT||0)+dt;
  /* staged: the big burnout puffs (they grow to 4.8 m+) age 3x faster so the tree shot clears on every tier; the purge cloud is small and keeps its time */
  if(ph==="staged" && STRIP.fx){ var FP=STRIP.fx.P; for(i=0;i<FP.length;i++) if(FP[i].s1>=4.5) FP[i].t+=dt*2; }
  stripTitleDraw(false);
  /* the wave: the final's burnout and staging, and the lap of honour */
  var rd=STRIP.rn&&STRIP.rn.round, want=!!C && (!!STRIP.honour || (rd==="FINAL" && (ph==="burnout"||ph==="staged")));
  if(C){ if(want){ C.wave=true; C.waveT=(C.waveT||0)+dt; if(!lite || (STRIP.waveSkip=!STRIP.waveSkip)) stripWave(C.waveT, false); }
    else if(C.wave){ C.wave=false; C.waveT=0; stripWave(0, true); } }
  /* flashbulbs on a win: the stands and the photographers along the wall past the stripe */
  if((STRIP.flashT||0)>0 && C && STRIP.fxAdd){ STRIP.flashT=Math.max(0, STRIP.flashT-dt);
    var fr=(STRIP.honour?(lite?70:140):(lite?40:70))*dt, nf=Math.floor(fr)+(Math.random()<fr%1?1:0);
    while(nf-->0){ var x, y, z;
      if(Math.random()<0.45){ x=STRIP_Q-6+Math.random()*48; z=(Math.random()<0.5?-1:1)*(8.4+Math.random()*1.2); y=1.3+Math.random()*0.6; }
      else { var q=C.base[(Math.random()*C.n)|0]; x=q[0]; y=q[1]+1.0; z=q[2]+(q[2]<0?0.3:-0.3); }
      STRIP.fxAdd.emit(x, y, z, 0,0,0, 0.14, 0.6, 0.85, 1, 0.98, 0.93, 1, {drag:0, fin:0.01}); } }
}

/* --- camera direction: a cut list, not a lerp between distant spots --- */
var STRIP_PAN_X=26, STRIP_WALL_X=64, STRIP_FIN_X=386, _cw=new THREE.Vector3(), _ct=new THREE.Vector3(), _cr=new THREE.Vector3(), _crt=new THREE.Vector3();
function stripDirect(o, dt, P, O){
  var ph=o.phase||"run", v=Math.max(0,o.v||0), race=!!(o.race&&O&&O.visible);
  var px=P.position.x, pz=P.position.z, ox=race?O.position.x:px, lead=Math.max(px,ox), trail=Math.min(px,ox), gap=Math.abs(px-ox);
  var both=race&&gap<45, mx=both?(px+ox)/2:px, mz=both?0:pz;
  var s=STRIP.shot;
  if(o.failed) s="fail";
  else if(ph==="burnout") s="burnout";
  else if(ph==="staged") s="tree";
  else if(ph==="run"){
    if(s===null||s==="burnout"||s==="tree"||s==="board"||s==="shutdown"||s==="fail") s=(STRIP.runT<0.6&&lead<25)?"tree":(lead<STRIP_WALL_X-8?"wall":"chase");
    if(s==="wall" && (lead>STRIP_WALL_X+16 || (STRIP.shot==="wall" && STRIP.shotT>6))) s="chase";
    if((s==="wall"||s==="chase") && lead>=338) s="finish";
  } else if(ph==="shutdown"){
    if(s!=="finish"&&s!=="shutdown"&&s!=="crowd") s="shutdown";
    else if(s==="finish" && (px>STRIP_Q+70 || (STRIP.shotT>2.4 && px>STRIP_Q+12))) s=(STRIP.pb||STRIP.win)&&!STRIP.pbCut?"crowd":"shutdown";
    else if(s==="crowd" && (STRIP.pbCut>1 || STRIP.shotT>(STRIP.win?2.8:STRIP.pb>1?2.3:1.7))) s="shutdown";
  } else if(ph==="done"){ s=(s==="shutdown"&&STRIP.shotT<0.8)?"shutdown":"board"; }
  if(STRIP.post) s=STRIP.post.seg;   /* after the pass: board close-up, instant replay, lap of honour */
  sceneCut(STRIP, s);
  STRIP.shotT+=dt; STRIP.cutT+=dt;
  var T=STRIP.shotT, fov=46, rel=false, ax=0, sm=0, d;
  switch(s){
    case "burnout": _cw.set(-0.7-Math.min(1.2,T*0.1), 0.72, Math.min(6.9,pz+4.4)); _ct.set(px-4.5, 1.3, pz-2.4); fov=40; break;
    case "tree": { var cz=race?0:1.35, push=Math.min(4.0,T*0.4); _cw.set(-20+push, 4.6, cz); _ct.set(2+push*0.5, 1.1, cz*0.3); fov=30;
      if(ph==="run") STRIP.shake=Math.max(STRIP.shake, 0.3*Math.max(0,1-STRIP.runT/0.8)); break; }
    case "wall": { _cw.set(STRIP_WALL_X, 0.55, 7.2);
      /* fix pack: a pair only while it fits the frame; split up, the camera follows one car (the player's, unless the
         other is much nearer the lens) and eases across instead of framing the empty track between them */
      var wp=race&&gap<12, wt=STRIP_WALL_X-px, wo=STRIP_WALL_X-ox, wcar=(!race||wp||Math.abs(wt)<=Math.abs(wo)+8)?P:O;
      var wx=wp?mx:wcar.position.x, wz=wp?mz:wcar.position.z;
      if(STRIP.snap||STRIP.wallX==null) STRIP.wallX=wx; else STRIP.wallX+=(wx-STRIP.wallX)*(1-Math.exp(-7*dt));
      STRIP.wallCar=wp?null:wcar; STRIP.wallPair=wp;
      _ct.set(STRIP.wallX+(STRIP.wallX<STRIP_WALL_X?1.2:-0.6), 0.8, wz*0.6); d=Math.max(2.5,_cw.distanceTo(_ct));
      var hw=3.4+(wp?gap*0.5+1.5:0), ta=Math.max(hw/(d*Math.max(0.3,STRIP.cam.aspect)), 1.9/d); fov=clamp(2*Math.atan(ta)*180/PI, 12, 74); break; }
    case "pan": _cw.set(STRIP_PAN_X, 1.3, 7.15); _ct.set(mx+1.4, 0.85, mz*0.6); d=_cw.distanceTo(_ct); fov=clamp(2*Math.atan((4.6+(both?gap*0.5+2.5:0))/d)*180/PI, 20, 62); break;
    case "chase": { rel=true; var b2=race&&gap<28; ax=b2?trail:px; var back=6.6+v*0.06+(b2?Math.min(12,gap*0.5):0), cz2=b2?0:pz;
      _cw.set(-back, 2.0+v*0.026+(b2?gap*0.03:0), cz2+1.5+v*0.022); _ct.set((b2?lead-ax:0)+5+v*0.1, 1.0, cz2*0.7); fov=46+Math.min(12,v*0.12); sm=5;
      STRIP.shake=Math.max(STRIP.shake, 0.05*Math.min(1,v/80)); break; }
    case "finish": { _cw.set(STRIP_FIN_X, 1.4, 7.15); var w=smoothstep(STRIP_FIN_X-4, STRIP_FIN_X+14, mx);
      _ct.set(lerp(STRIP_Q+18,mx+3,w), lerp(3.6,0.9,w), lerp(-1.5,mz*0.5,w)); d=_cw.distanceTo(_ct);
      fov=lerp(stripFitFov(36), clamp(2*Math.atan((4.8+(both?gap*0.5+2.5:0))/d)*180/PI, 24, 62), w); break; }
    case "shutdown": { rel=true; var b3=race&&gap<10; ax=b3?trail:px; var cz3=b3?0:pz, bk=11+v*0.04+(b3?gap*0.3:0);
      /* rear three-quarter from inside the near wall (the catch fence is at 7.9), far enough back that the chute blossoms
         between us and the car instead of over the lens, aimed between the two so both stay in a portrait frame */
      _cw.set(-bk, 3.0, 6.6); _ct.set((b3?lead-ax:0)-3.2, 1.0, cz3*0.7); fov=stripFitFov(42, 1.1); sm=4; break; }
    case "board": { /* both boards across the frame whatever the aspect: back the camera off until ~31 m of width fits */
      var bt=Math.tan(deg(46)/2), bd=Math.max(15.5/(bt*Math.max(0.3,STRIP.cam.aspect)), 9.5/bt);
      _cw.set(STRIP_Q+26-bd+Math.min(2,T*0.7), 3.2, 0); _ct.set(STRIP_Q+26, 6.2, 0); fov=46; break; }
    case "boardup": { /* scoreboard moment: square on to this lane's board, a slow push while the digits roll */
      var bm=STRIP.board.p.mesh, ry=bm.rotation.y, uf=Math.tan(deg(30)/2), ud=Math.max(8.4*0.6/(uf*Math.max(0.3,STRIP.cam.aspect)), 4.2*0.78/uf)*(1.06-0.06*smoothstep(0,1.6,T));
      _cw.set(bm.position.x+Math.sin(ry)*ud, bm.position.y-0.7, bm.position.z+Math.cos(ry)*ud); _ct.copy(bm.position); fov=30; break; }
    case "replay": { var RP=STRIP.post, rdx=px-RP.x0;
      if(RP.angle==="nose"){ _cw.set(RP.x0+6.4+rdx*0.74, 0.34, STRIP_LANE+3.4); _ct.set(px+0.4, 0.85, STRIP_LANE); fov=stripFitFov(30, 1.25); }   /* low, ahead: the nose comes up at the lens */
      else { var ty=P.userData._tyres[0]; _sfA.copy(ty); P.localToWorld(_sfA); _cw.set(_sfA.x+2.4+rdx*0.04, 0.3, _sfA.z+2.6); _ct.set(_sfA.x+0.2, 0.45, _sfA.z-0.3); fov=stripFitFov(34, 1.25); }   /* down at the rear tyre: the sidewall wrinkles */
      break; }
    case "honour": { var hk=smoothstep(0,4.6,T), hz=smoothstep(0.35,1,hk);   /* crane up out of the wall over the fence: the car, the stands behind it */
      _cw.set(px-8.5+4*hk, 1.0+6.4*hk, 6.6+3.2*hz); _ct.set(px+1.6, 0.9+2.6*hk, -1.5-8*hk); fov=stripFitFov(46, 1.2);
      stripKeepIn(_sfD.set(px, 0.15, pz), _sfB.set(px+0.6, 0.7, pz), fov); break; }   /* fix pack: the car stays clear of the HUD band and the frame edge */   /* ends on the stands (x 0-140, z -10..-19) so the card wave reads */
    case "crowd": { if(!STRIP.pbCut) STRIP.pbCut=1; var cp=smoothstep(0,2.3,T); _cw.set(78-cp*6, 1.4+cp*0.5, 2.4); _ct.set(52-cp*4, 3.4, -13.5); fov=stripFitFov(40-cp*5, 1.2); break; }
    case "fail": { rel=true; ax=px; _cw.set(8.5+v*0.04, 1.5, pz+4.2); _ct.set(-3.5, 1.2, pz-0.6); fov=50; sm=8; STRIP.shake=Math.max(STRIP.shake, 0.16); break; }
  }
  if(rel){ if(STRIP.snap||!STRIP.relOn){ _cr.copy(_cw); _crt.copy(_ct); } else { var k=1-Math.exp(-sm*dt); _cr.lerp(_cw,k); _crt.lerp(_ct,k); }
    _cw.copy(_cr); _ct.copy(_crt); _cw.x+=ax; _ct.x+=ax; STRIP.relOn=true; } else STRIP.relOn=false;
  if(STRIP.snap){ STRIP.fov=fov; STRIP.snap=false; } else STRIP.fov+=(fov-STRIP.fov)*(1-Math.exp(-6*dt));
  STRIP.camPos.copy(_cw); STRIP.camTgt.copy(_ct);
  /* hard cut, then a 0.15 s ease-in: start 6% further out and settle */
  var ease=1-smoothstep(0,0.15,STRIP.cutT); if(ease>0) STRIP.camPos.addScaledVector(_sfD.subVectors(_cw,_ct), 0.06*ease);
  STRIP.shake*=Math.exp(-dt*3.2); var sh=CALM?0:STRIP.shake;
  if(sh>0.002){ STRIP.camPos.x+=(Math.random()-0.5)*sh*0.22; STRIP.camPos.y+=(Math.random()-0.5)*sh*0.22; STRIP.camPos.z+=(Math.random()-0.5)*sh*0.18; STRIP.camTgt.y+=(Math.random()-0.5)*sh*0.1; }
  var cam=STRIP.cam; cam.position.copy(STRIP.camPos); cam.lookAt(STRIP.camTgt); cam.fov=STRIP.fov; cam.updateProjectionMatrix();
  stripLens(cam);
}
/* phone-first framing: a portrait view widens a shot's vertical fov until it shows the width it would at refAsp */
function stripFitFov(vf, refAsp){ var a=STRIP.cam?STRIP.cam.aspect:1; refAsp=refAsp||1.35; if(!(a>0)||a>=refAsp) return vf;
  return Math.min(78, 2*Math.atan(Math.tan(deg(vf)/2)*refAsp/a)*180/PI); }
/* fix pack: pull the aim point (_ct) towards a subject until its low point (lo) sits above the HUD band and its centre (mid)
   stays inside the frame's sides; bisection on a scratch camera, only when it is out (portrait honour shot) */
var _kpCam=null, _kpT=new THREE.Vector3();
function stripKeepIn(lo, mid, fov){
  var c=_kpCam||(_kpCam=new THREE.PerspectiveCamera(46,1,0.3,4200)), b=STRIP.band||0, h=STRIP.viewH||0, yMin=-1+(h>0?clamp(b/h,0,0.3):0)+0.1, xMax=0.72;
  c.aspect=STRIP.cam?STRIP.cam.aspect:1; c.fov=fov; c.updateProjectionMatrix(); c.position.copy(_cw);
  function ok(k){ c.lookAt(_kpT.copy(_ct).lerp(mid, k)); c.updateMatrixWorld(true);
    var a=_mbA.copy(lo).project(c), m=_mbB.copy(mid).project(c); return a.z<1 && a.y>=yMin && Math.abs(m.x)<=xMax; }
  if(ok(0)) return; var k0=0, k1=1; if(!ok(1)) return;
  for(var i=0;i<7;i++){ var km=(k0+k1)/2; if(ok(km)) k1=km; else k0=km; }
  _ct.lerp(mid, k1);
}
/* ...and an off-axis lens shift lifts the picture so the subject sits above the HUD band along the view's bottom edge
   (the band is the --striphud custom property on #view, read on resize) */
function stripBandRead(){ var de=document.documentElement, host=canvasEl&&canvasEl.parentElement; STRIP.band=0; STRIP.bandShud=de.classList.contains("shud");
  if(host && de.classList.contains("onstrip")){ try{ var cs=getComputedStyle(host); STRIP.band=parseFloat(cs.getPropertyValue(STRIP.bandShud?"--shud-h":"--striphud"))||parseFloat(cs.getPropertyValue("--striphud"))||0; }catch(e){} } }
function stripLens(cam){ if(document.documentElement.classList.contains("shud")!==STRIP.bandShud) stripBandRead();   /* the HUD overlay (html.shud, --shud-h) came or went */
  var b=STRIP.band||0, h=STRIP.viewH||0; if(!(b>0&&h>0)) return;
  cam.projectionMatrix.elements[9]=-clamp(b/h,0,0.3); cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert(); }

/* --- post: the strip gets its own bloom chain (Full/Ultra) and a heat-haze pass behind the car --- */
var STRIP_HEAT_SHADER={ uniforms:{ tDiffuse:{value:null}, uC:{value:new THREE.Vector2(0.5,0.5)}, uR:{value:new THREE.Vector2(0.1,0.1)}, uAmt:{value:0}, uT:{value:0} },
  vertexShader:"varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
  fragmentShader:["uniform sampler2D tDiffuse; uniform vec2 uC; uniform vec2 uR; uniform float uAmt; uniform float uT; varying vec2 vUv;",
    "void main(){ vec2 d=(vUv-uC)/uR; float m=exp(-dot(d,d)*1.8)*smoothstep(-1.1,-0.3,d.y);",
    " vec2 o=vec2(sin(vUv.y*190.0+uT*23.0)+0.6*sin(vUv.x*97.0-uT*17.0), cos(vUv.x*150.0+uT*19.0)+0.5*sin(vUv.y*71.0+uT*13.0))*uAmt*m;",
    " gl_FragColor=texture2D(tDiffuse,vUv+o); }"].join("\n") };
/* wall camera: the camera's own swing smeared along the screen, the tracked car kept sharp inside a soft ellipse */
var STRIP_BLUR_SHADER={ uniforms:{ tDiffuse:{value:null}, uDir:{value:new THREE.Vector2(0,0)}, uC:{value:new THREE.Vector2(0.5,0.5)}, uR:{value:new THREE.Vector2(0.2,0.2)} },
  vertexShader:"varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
  fragmentShader:["uniform sampler2D tDiffuse; uniform vec2 uDir; uniform vec2 uC; uniform vec2 uR; varying vec2 vUv;",
    "void main(){ vec2 d=(vUv-uC)/uR; float m=smoothstep(0.55,1.35,length(d)); vec2 st=uDir*m; vec4 a=vec4(0.0);",
    " for(int i=0;i<9;i++){ a+=texture2D(tDiffuse, vUv+st*(float(i)/8.0-0.5)); }",
    " gl_FragColor=a/9.0; }"].join("\n") };
var _mbQ=new THREE.Quaternion(), _mbA=new THREE.Vector3(), _mbB=new THREE.Vector3();
function stripBlur(P, dt){
  var bp=STRIP.blurPass, cam=STRIP.cam; if(!cam) return;
  if(STRIP.mbOk && STRIP.shot==="wall" && cam.quaternion.angleTo(_mbQ)<1e-6) return;   /* same view again (no time passed): keep the last smear */
  var on=!!bp && GFX!=="lite" && STRIP.shot==="wall" && STRIP.cutT>0.05 && STRIP.mbOk && dt>0;
  if(on){ /* where last frame's line of sight lands now = how far the background slid this frame */
    _mbA.set(0,0,-60).applyQuaternion(_mbQ).add(cam.position).project(cam); _mbB.set(0,0,-60).applyQuaternion(cam.quaternion).add(cam.position).project(cam);
    var k=(1/45)/Math.max(dt,1/120), ux=(_mbA.x-_mbB.x)*0.5*k, uy=(_mbA.y-_mbB.y)*0.5*k, L=Math.sqrt(ux*ux+uy*uy);
    if(L>0.07){ ux*=0.07/L; uy*=0.07/L; L=0.07; }
    on=L>0.0025;
    if(on){ bp.uniforms.uDir.value.set(ux, uy);
      /* fix pack: the sharp spot sits on the car the wall cam follows (both, when it frames the pair); no car in frame, no smear */
      var O=STRIP.cars.o, pair=STRIP.wallPair && O && O.visible, tc=STRIP.wallCar||P, gx=0;
      if(pair){ _mbA.set(0,0.75,0); P.localToWorld(_mbA); _mbB.set(0,0.75,0); O.localToWorld(_mbB); _mbA.add(_mbB).multiplyScalar(0.5); }
      else { _mbA.set(0,0.75,0); tc.localToWorld(_mbA); }
      var dist=Math.max(1,_mbA.distanceTo(cam.position)); _mbA.project(cam);
      if(pair){ _mbB.project(cam); gx=Math.abs(_mbB.x-_mbA.x)*0.5; }
      if(_mbA.z>1 || Math.abs(_mbA.x)>1.05+gx || Math.abs(_mbA.y)>1.05) on=false;
      var ry=Math.min(1.1, 3.6/(dist*Math.tan(deg(cam.fov)/2))*0.5); bp.uniforms.uC.value.set(_mbA.x*0.5+0.5, _mbA.y*0.5+0.5); bp.uniforms.uR.value.set(ry*1.5/cam.aspect+gx*0.5, ry*0.7); } }
  if(bp) bp.enabled=on;
  _mbQ.copy(cam.quaternion); STRIP.mbOk=true;
}
function stripComposer(){
  if(STRIP.composer===false) return null;
  var sz=renderer.getSize(new THREE.Vector2()), pr=renderer.getPixelRatio(), C=ultraComposerKeep(STRIP.composer);
  if(!C){ try{ C=ultraComposerMark(new THREE.EffectComposer(renderer, ultraRT())); C.addPass(ultraRenderPass(STRIP.scene, STRIP.cam, "strip"));
      var hp=new THREE.ShaderPass(STRIP_HEAT_SHADER); hp.enabled=false; C.addPass(hp); STRIP.heatPass=hp;
      var mb=new THREE.ShaderPass(STRIP_BLUR_SHADER); mb.enabled=false; C.addPass(mb); STRIP.blurPass=mb;
      var bp=new THREE.UnrealBloomPass(new THREE.Vector2(Math.max(1,sz.x*pr/2), Math.max(1,sz.y*pr/2)), 0.3, 0.4, 0.9); C.addPass(bp); STRIP.bloom=bp;
      if(THREE.GammaCorrectionShader) C.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
      STRIP.composer=C; STRIP.cSize=""; }catch(e){ STRIP.composer=false; return null; } }
  var key=sz.x+"x"+sz.y+"@"+pr; if(STRIP.cSize!==key){ if(C.setPixelRatio) C.setPixelRatio(pr); C.setSize(sz.x, sz.y); STRIP.cSize=key; }
  var n=!!STRIP.night, bp2=STRIP.bloom; bp2.strength=n?0.6:0.3; bp2.threshold=n?0.72:0.9; bp2.radius=n?0.5:0.4;
  return C;
}
function stripHeat(o, P){
  var hp=STRIP.heatPass; if(!hp) return; var v=o.v||0, ph=o.phase||"run";
  if(GFX==="lite" || v<22 || (ph!=="run"&&ph!=="shutdown") || STRIP.shot==="tree" || o.failed){ hp.enabled=false; return; }
  P.localToWorld(_sfA.set((P.userData._bbMinX||-2.3)-1.6, 0.9, 0)); var cam=STRIP.cam; var dist=_sfA.distanceTo(cam.position);
  _sfA.project(cam); if(_sfA.z>1 || Math.abs(_sfA.x)>1.3 || Math.abs(_sfA.y)>1.3){ hp.enabled=false; return; }
  var ry=2.2/(dist*Math.tan(deg(cam.fov)/2))*0.5; hp.enabled=true;
  hp.uniforms.uC.value.set(_sfA.x*0.5+0.5, _sfA.y*0.5+0.5); hp.uniforms.uR.value.set(ry*1.6/cam.aspect, ry);
  hp.uniforms.uAmt.value=0.0013*smoothstep(22,70,v)*clamp(8/Math.max(4,dist),0.3,1); hp.uniforms.uT.value=STRIP.t;
}
function stripHatHeat(o, P){
  var C=STRIP.composer, u=P&&P.userData, hp=STRIP.hatPass, ph=o.phase||"run";
  var hot=u && u._hat && u.hw && u.hw.asp!=="na" ? 1 : 0.55;   /* a blower hat shimmers hardest; an NA scoop a little */
  if(!C || GFX==="lite" || !u || !u._hat || !u.hw || ph==="done" || o.failed || STRIP.shot==="tree"){ if(hp) hp.enabled=false; return; }
  if(hp===false) return;
  if(!hp){ try{ hp=new THREE.ShaderPass(STRIP_HEAT_SHADER); var at=C.passes.indexOf(STRIP.heatPass); C.passes.splice(at>=0?at+1:1, 0, hp); hp.enabled=false; STRIP.hatPass=hp; }catch(e){ STRIP.hatPass=false; return; } }
  var cam=STRIP.cam; P.localToWorld(_sfA.copy(u._hat)); _sfA.y+=0.32; var dist=_sfA.distanceTo(cam.position);
  _sfA.project(cam); if(_sfA.z>1 || Math.abs(_sfA.x)>1.2 || Math.abs(_sfA.y)>1.2 || dist>60){ hp.enabled=false; return; }
  var rpmK=o.redline>0 ? clamp((o.rpm||0)/o.redline,0.25,1) : 0.6, ry=(hot>=1?0.55:0.45)/(dist*Math.tan(deg(cam.fov)/2));
  hp.enabled=true; hp.uniforms.uC.value.set(_sfA.x*0.5+0.5, _sfA.y*0.5+0.5); hp.uniforms.uR.value.set(ry*1.1/cam.aspect, ry);
  hp.uniforms.uAmt.value=(hot>=1?0.003:0.0019)*(GFX==="ultra"?1.25:1)*hot*rpmK*clamp(6/Math.max(3,dist),0.25,1);   /* v3: a blower hat shimmers so you can see it */ hp.uniforms.uT.value=STRIP.t*1.3;
}
/* the lit smoke's lights, in view space: the sun (moon at night) as key, the night flood as fill, the hemisphere as
   ambient, the three floodlight spots and the exhaust flash as points (so smoke between you and a pole glows) */
var _flV=new THREE.Vector3(), _flC=new THREE.Color();
function stripFxLight(){
  var F=STRIP.fx, cam=STRIP.cam; if(!F || !F.opt || !F.opt.lit || !cam) return;
  var U=F.mat.uniforms, M=cam.matrixWorldInverse, i; cam.updateMatrixWorld(); M.copy(cam.matrixWorld).invert();
  U.uKeyV.value.copy(STRIP.sunDir).normalize().transformDirection(M); U.uKeyC.value.copy(STRIP.sun.color).multiplyScalar(STRIP.sun.intensity*0.6);
  var fl=STRIP.flood; _flV.copy(fl.position).sub(fl.target.position).normalize(); U.uFillV.value.copy(_flV).transformDirection(M); U.uFillC.value.copy(fl.color).multiplyScalar(fl.intensity*0.75);
  var hm=STRIP.hemi; U.uAmbC.value.copy(hm.color).multiplyScalar(hm.intensity*2.5); if(STRIP.night){ U.uAmbC.value.r+=0.025; U.uAmbC.value.g+=0.03; U.uAmbC.value.b+=0.04; }
  var R=U.uPtR.value;
  for(i=0;i<3;i++){ var sp=STRIP.spots[i];
    if(sp && STRIP.night){ U.uPtP.value[i].copy(sp.position).applyMatrix4(M); U.uPtC.value[i].copy(sp.color).multiplyScalar(sp.intensity*0.42); R.setComponent(i, Math.max(20, (sp.position.y||15)*2.4)); }
    else U.uPtC.value[i].setRGB(0,0,0); }
  var fx=STRIP.flash; if(fx && fx.intensity>0.02){ U.uPtP.value[3].copy(fx.position).applyMatrix4(M); U.uPtC.value[3].copy(fx.color).multiplyScalar(Math.min(4, fx.intensity*0.14)); R.w=7; }
  else U.uPtC.value[3].setRGB(0,0,0);
}
function stripRender(){
  var S2=STRIP.scene, cam=STRIP.cam; if(!S2||!cam) return;
  var C=(GFX!=="lite" && THREE.EffectComposer && THREE.UnrealBloomPass && THREE.RenderPass && THREE.ShaderPass) ? stripComposer() : null;
  /* fog is applied after tone mapping/encoding in r128: give it the sky's horizon in the target's space */
  if(C) S2.fog.color.copy(STRIP.horLin); else S2.fog.color.copy(STRIP.horLin).convertLinearToSRGB();
  STRIP.sky.position.copy(cam.position);
  [STRIP.fx, STRIP.fxFire, STRIP.fxAdd].forEach(function(F){ if(F) F.mat.uniforms.uFog.value.copy(STRIP.horLin); });
  stripFxLight();
  var ex=renderer.toneMappingExposure; renderer.toneMappingExposure=STRIP.exposure;
  var inf=renderer.info, ar=inf.autoReset; inf.autoReset=false; inf.reset();
  if(C) C.render(); else renderer.render(S2, cam);
  STRIP.stats={calls:inf.render.calls, tris:inf.render.triangles, tier:GFX}; inf.autoReset=ar;
  renderer.toneMappingExposure=ex;
}
function stripReset(){
  if(STRIP.fx) STRIP.fx.clear(); if(STRIP.fxFire) STRIP.fxFire.clear(); if(STRIP.fxAdd) STRIP.fxAdd.clear();
  if(STRIP.marks){ STRIP.marks.n=0; STRIP.marks.i=0; STRIP.marks.mesh.count=0; }
  STRIP.shot=null; STRIP.prev={}; STRIP.tm=null; STRIP.shake=0; STRIP.flashI=0; if(STRIP.flash) STRIP.flash.intensity=0; if(STRIP.heatPass) STRIP.heatPass.enabled=false;
  STRIP.cheer=0; STRIP.pb=0; STRIP.pbCut=0; if(STRIP.crowd && STRIP.crowd.live) stripCrowd(0);
  STRIP.win=0; STRIP.rn=null; STRIP.wonFx=0; STRIP.flashT=0; STRIP.honour=0; STRIP.honourT=0; STRIP_U.uShine.value.set(0,0); STRIP_U.uRip.value=0;
  if(STRIP.crowd && STRIP.crowd.wave){ STRIP.crowd.wave=false; stripWave(0, true); stripCrowd(0); }
  ["p","o"].forEach(function(k){ var c=STRIP.cars[k]; if(c){ c.userData._markLast=[]; } });
}

/* ---------------------------------------------------------------------------
   AFTER THE PASS (v2): once the pass reports "done" the strip runs its own short show off the render loop:
   a 1.5 s scoreboard close-up (digits roll, WIN/LOSS lamp), a skippable 3 s slow-motion replay of the launch
   rebuilt from the frames this pass was fed, a lap of honour when STRIP.honour is set (won the night), then the
   wide board shot. ENGINE_VIS.stripBusy() says how long is left; stripSkip() jumps to the end.
   --------------------------------------------------------------------------- */
function stripRec(o, ph){
  if(ph==="burnout"||ph==="staged"){ STRIP.recPre=o; return; }
  if(ph!=="run") return;
  if(STRIP.prev.phase!=="run"){ STRIP.rec=[]; if(STRIP.recPre && STRIP.recPre.phase==="staged") STRIP.rec.push({t:-0.45, o:STRIP.recPre}); }
  if(STRIP.rec && STRIP.runT<=1.7) STRIP.rec.push({t:STRIP.runT, o:o});
}
var STRIP_RP_NUM=["x","v","ox","ov","acc","oacc","lift","olift","tyreTemp","boost","rpm"];
function stripRecAt(rt){
  var R=STRIP.rec, i=0; while(i<R.length-2 && R[i+1].t<=rt) i++;
  var a=R[i], b=R[Math.min(R.length-1,i+1)], f=b.t>a.t?clamp((rt-a.t)/(b.t-a.t),0,1):0, o=Object.assign({}, a.o);
  if(b!==a && b.o.phase==="run" && a.o.phase==="run") STRIP_RP_NUM.forEach(function(k){ var p=a.o[k], q=b.o[k]; if(typeof p==="number" && typeof q==="number") o[k]=p+(q-p)*f; });
  o.phase=a.o.phase; o.chute=false; o.brake=false; return o;
}
function stripPostStart(o){
  var P=STRIP.cars.p, O=STRIP.cars.o; if(!P||o.failed||!STRIP.board) return;
  var rec=STRIP.rec||[], runs=rec.filter(function(r){ return r.o.phase==="run"; }), ok=runs.length>=2 && runs[runs.length-1].t>=0.35 && !runs.some(function(r){ return r.o.failed; });
  var lift=0; runs.forEach(function(r){ lift=Math.max(lift, r.o.lift||0, r.o.onBars?1:0); });
  var me=P.userData.meta||{};
  STRIP.post={ seg:"boardup", t:0, o:o, px:P.position.x, ox:O?O.position.x:0, ov:!!(O&&O.visible), replay:ok, honourDone:false, last:performance.now(),
    t0:-0.3, t1:ok?Math.min(1.25, runs[runs.length-1].t):0, x0:rec.length?(rec[0].o.x||0):0, angle:(lift>0.2||(me.maxPitch||0)>0.09)?"nose":"tyre", roll:-1, lit:false };
  if(STRIP.blurPass) STRIP.blurPass.enabled=false; if(STRIP.heatPass) STRIP.heatPass.enabled=false;
  stripPostCap("");
}
function stripPostCap(t){ var el=typeof document!=="undefined" && document.getElementById("stripCap"); if(!el) return;
  if(el.dataset.t===t) return; el.dataset.t=t; el.hidden=!t; el.innerHTML=t; }
/* the roll: digits land left to right, the ones still spinning show a fresh digit every 60 ms */
function stripRollNum(v, dp, T, lane){
  if(v==null) return v; var s=(+v).toFixed(dp), out="", n=0, tick=Math.floor(T/0.06);
  for(var i=0;i<s.length;i++){ var ch=s[i]; if(ch<"0"||ch>"9"){ out+=ch; continue; }
    var land=0.12+n*0.16+lane*0.05; n++;
    if(T>=land) out+=ch; else { var h=Math.sin((tick+1)*12.9898+i*78.233+lane*37.7)*43758.5453; out+=String(Math.floor((h-Math.floor(h))*10)); } }
  return +out;
}
function stripPostBoard(T){
  var D=STRIP.boardD, R=STRIP.post; if(!D||!STRIP.board) return;
  var done=T>=1.05, tick=done?-2:Math.floor(T/0.06); if(tick===R.roll) return; R.roll=tick;
  var d={}; ["p","o"].forEach(function(tag, li){ var L=D[tag]; if(!L){ d[tag]=L; return; } var c=Object.assign({}, L);
    if(!done){ c.et=stripRollNum(L.et,3,T,li); c.mph=stripRollNum(L.mph,2,T,li); c.rt=stripRollNum(L.rt,3,T,li); c.win=false; c.pb=0; }
    d[tag]=c; });
  stripBoardDraw(d, true);
  if(done){ var race=D.o&&!D.o.off; if(race){ ["p","o"].forEach(function(tag){ var L=D[tag], bd=STRIP.board[tag]; if(!L||L.win||L.foul||L.off) return;
      var x=bd.cv.getContext("2d"); x.beginPath(); x.arc(468,36,17,0,TAU); x.fillStyle="#ff3b30"; x.fill(); x.fillStyle="#ff3b30"; x.font="700 28px 'Chakra Petch','Arial Narrow',Arial,sans-serif"; x.textAlign="right"; x.textBaseline="middle"; x.fillText("LOSS", 440, 37); bd.tex.needsUpdate=true; bd.key=""; }); }
    if(D.p&&D.p.win) STRIP.cheer=Math.max(STRIP.cheer, 1.4); STRIP.shake=Math.max(STRIP.shake, 0.12); }
}
function stripPostEnter(seg){
  var R=STRIP.post, P=STRIP.cars.p, O=STRIP.cars.o; R.seg=seg; R.t=0;
  if(seg==="replay"){ R.mk=STRIP.marks?{i:STRIP.marks.i, n:STRIP.marks.n}:null; R.prev=STRIP.prev;
    [STRIP.fx, STRIP.fxFire, STRIP.fxAdd].forEach(function(F){ if(F) F.clear(); });
    [P,O].forEach(function(c){ var A=c&&c.userData.anim; if(A){ A.pitch=0; A.pv=0; A.sq=0; A.sqv=0; } });
    stripPostCap('<b>REPLAY</b><span>tap to skip</span>'); }
  else if(seg==="honour"){ R.honourDone=true; if(O) O.visible=false; STRIP.cheer=Math.max(STRIP.cheer, 2.4); stripPostCap('<b>LAP OF HONOUR</b><span>tap to skip</span>'); }
  else stripPostCap("");
  if(seg==="board") stripPostBoard(9);
}
function stripPostLeave(){
  var R=STRIP.post, P=STRIP.cars.p, O=STRIP.cars.o; if(!R) return;
  if(R.seg==="replay"||R.seg==="honour"){
    [STRIP.fx, STRIP.fxFire, STRIP.fxAdd].forEach(function(F){ if(F) F.clear(); });
    if(R.mk && STRIP.marks){ STRIP.marks.i=R.mk.i; STRIP.marks.n=R.mk.n; STRIP.marks.mesh.count=R.mk.n; }
    if(R.prev) STRIP.prev=R.prev;
    P.position.x=R.px; if(O){ O.position.x=R.ox; O.visible=R.ov; }
    var fo=Object.assign({}, R.o, {v:0, ov:0, acc:0, oacc:0, lift:0, olift:0, spin:false, ospin:false, shifting:false, oshifting:false, chute:false, ochute:false});
    if(typeof stripCarAnim==="function"){ stripCarAnim(P, fo, 0, true); if(O&&O.visible) stripCarAnim(O, fo, 0, false); }
    P.updateMatrixWorld(true); if(O) O.updateMatrixWorld(true); }
}
function stripPostNext(){
  var R=STRIP.post, sq=["boardup","replay","honour","board"], i=sq.indexOf(R.seg)+1;
  while(i<sq.length && ((sq[i]==="replay"&&!R.replay) || (sq[i]==="honour"&&(!STRIP.honour||R.honourDone)))) i++;
  stripPostLeave(); stripPostEnter(sq[Math.min(i, sq.length-1)]);
}
var STRIP_POST_LEN={boardup:1.6, replay:3.0, honour:4.6, board:1.2};
function stripPostStep(){
  var R=STRIP.post, P=STRIP.cars.p, O=STRIP.cars.o; if(!R||!P) return;
  var now=performance.now(), dt=clamp((now-R.last)/1000, 0, 0.1); R.last=now; R.t+=dt;
  if(R.seg!=="board" && R.t>=STRIP_POST_LEN[R.seg]) stripPostNext();
  else if(R.seg==="board" && STRIP.honour && !R.honourDone && R.t<0.3) stripPostNext();   /* the flag came in late: still take the lap */
  var seg=R.seg, T=R.t, o=R.o, sdt=dt;
  if(seg==="boardup") stripPostBoard(T);
  if(seg==="replay"){ sdt=dt*(R.t1-R.t0)/STRIP_POST_LEN.replay; var rt=R.t0+(R.t1-R.t0)*clamp(T/STRIP_POST_LEN.replay,0,1);
    o=stripRecAt(rt); P.position.x=o.x||0; if(O&&O.visible) O.position.x=o.ox||0;
    if(typeof stripCarAnim==="function"){ stripCarAnim(P, o, sdt, true); if(O&&O.visible) stripCarAnim(O, o, sdt, false); }
    P.updateMatrixWorld(true); if(O) O.updateMatrixWorld(true);
    var mk=STRIP.marks?{i:STRIP.marks.i, n:STRIP.marks.n}:null;
    STRIP.t+=sdt; stripEffects(o, sdt, P, O); stripTreeLights(o);
    if(mk){ STRIP.marks.i=mk.i; STRIP.marks.n=mk.n; STRIP.marks.mesh.count=mk.n; }   /* the replay leaves no new rubber */
    STRIP.prev={phase:o.phase, chute:false, shifting:!!o.shifting, failed:!!o.failed};
  } else if(seg==="honour"){ var hv=6.2; P.position.x=16+hv*T;
    o=Object.assign({}, R.o, {x:P.position.x, v:hv, acc:0, lift:0, spin:false, shifting:false, chute:false, brake:false, burnout:false, race:false, phase:"done"});
    if(typeof stripCarAnim==="function") stripCarAnim(P, o, dt, true); P.updateMatrixWorld(true);
    STRIP.cheer=Math.max(STRIP.cheer, 2.2); STRIP.t+=dt; stripEffects(o, dt, P, O);
  } else { STRIP.t+=dt; [STRIP.fx, STRIP.fxFire, STRIP.fxAdd].forEach(function(F){ if(F) F.step(dt, STRIP_WIND); }); }
  if(seg!=="replay" && typeof stripPayoffs==="function") stripPayoffs(o, dt, P, O);   /* B's crowd wave, flashbulbs and title keep going under the show */
  stripCrowd(sdt);
  stripDirect(o, dt, P, O);
  if(STRIP.blurPass) STRIP.blurPass.enabled=false; if(STRIP.heatPass) STRIP.heatPass.enabled=false; if(STRIP.hatPass) STRIP.hatPass.enabled=false;
}
function stripPostEnd(){ if(!STRIP.post) return; stripPostLeave(); STRIP.post=null; stripPostCap(""); }
function stripPostLeft(){ var R=STRIP.post; if(!R) return 0; var sq=["boardup","replay","honour","board"], left=0, i=sq.indexOf(R.seg);
  for(var k=i;k<sq.length;k++){ var g=sq[k]; if(k>i && ((g==="replay"&&!R.replay)||(g==="honour"&&(!STRIP.honour||R.honourDone)))) continue; left+=STRIP_POST_LEN[g]-(k===i?R.t:0); }
  return Math.max(0,left); }

function stripUpdate(o, dt, rdt){
  if(!STRIP.built) buildStripScene();
  var S2=STRIP.scene; STRIP.t+=dt; if(rdt===undefined) rdt=dt;
  if(STRIP.tier!==GFX || STRIP.night!==!!o.night) stripSetNight(!!o.night);
  stripDusk(o.nightK);
  stripGlare();
  /* v2: o.hw = what your engine carries (scoop / blower / turbos / intercooler, diesel, ALS, nitrous); o.opp = the other lane's
     own car {color, hw:{...style}}. Both optional: without them the cars are the v1.5 ones (charcoal mirror opponent). */
  var CS=STRIP.cars, hwK=o.hw===CS.hwRef?CS.hwK:(o.hw?JSON.stringify(o.hw):""), opK=o.opp===CS.opRef?CS.opK:(o.opp?JSON.stringify(o.opp):""), liteK=(hwK||opK)?GFX==="lite":false;
  CS.hwRef=o.hw; CS.hwK=hwK; CS.opRef=o.opp; CS.opK=opK;
  if(o.body && (!STRIP.cars.p || STRIP.cars.p.userData.body!==o.body || STRIP.cars.pcolor!==o.color || STRIP.cars.ptyre!==o.tyreIn || CS.bHw!==hwK || CS.bOp!==opK || CS.bLite!==liteK || CS.bWb!==!!o.wbar)){
    if(STRIP.cars.p) S2.remove(STRIP.cars.p); if(STRIP.cars.o) S2.remove(STRIP.cars.o);
    STRIP.cars.p=stripCar(o.body, o.color||0xa32a26, o.tyreIn, o.hw); if(o.wbar && !STRIP.cars.p.userData.meta.bars) stripAddBars(STRIP.cars.p); stripCarMeta(STRIP.cars.p); stripContact(STRIP.cars.p); STRIP.cars.p.position.z=STRIP_LANE; S2.add(STRIP.cars.p); STRIP.cars.pcolor=o.color; STRIP.cars.ptyre=o.tyreIn;
    var op=o.opp||{};
    STRIP.cars.o=stripCar(op.body||o.body, op.color!=null?op.color:0x3a3f46, op.tyreIn||(op.body&&op.body!==o.body?undefined:o.tyreIn), op.hw); stripCarMeta(STRIP.cars.o); stripContact(STRIP.cars.o);   /* op.body: the rival's own class (fix pack plumbing) */ STRIP.cars.o.position.z=-STRIP_LANE; STRIP.cars.o.visible=!!o.race; S2.add(STRIP.cars.o);
    CS.bHw=hwK; CS.bOp=opK; CS.bLite=liteK; CS.bWb=!!o.wbar;
  }
  var P=STRIP.cars.p, O=STRIP.cars.o; if(!P) return; stripLivery(P);
  var ph=o.phase||"run", v=o.v||0;
  P.position.x=o.x||0; P.position.z=STRIP_LANE; if(O){ O.visible=!!o.race; O.position.x=o.ox||0; O.position.z=-STRIP_LANE; }
  if(ph==="run" && STRIP.prev.phase!=="run"){ STRIP.runT=0; STRIP.cheer=Math.max(STRIP.cheer,1); }
  stripRec(o, ph);
  if(ph==="run") STRIP.runT+=dt;
  if(typeof stripCarAnim==="function"){ stripCarAnim(P, o, dt, true); if(O && O.visible) stripCarAnim(O, o, dt, false); }
  else {
    var w=(o.spin&&v<5?40:v)/Math.max(0.1,P.userData.rr);
    P.userData.wheels.forEach(function(wm){ wm.rotation.y -= w*dt; });
    if(O) O.userData.wheels.forEach(function(wm){ wm.rotation.y -= (o.ov||0)/Math.max(0.1,O.userData.rr)*dt; });
    var acc=o.acc||0; P.rotation.z = -clamp(acc*0.012, -0.02, 0.10) * (P.userData.body==="street"?0.5:1);
    if(P.userData.chute) P.userData.chute.visible=!!o.chute;
    if(O && O.userData.chute) O.userData.chute.visible=!!o.chute && (o.ox||0)>402;
  }
  P.updateMatrixWorld(true); if(O) O.updateMatrixWorld(true);
  stripTiming(o, rdt);
  stripEffects(o, dt, P, O);
  stripN2O(o, dt, P);
  stripTreeLights(o);
  stripPayoffs(o, dt, P, O);
  stripCrowd(dt);
  stripDirect(o, dt, P, O);
  stripHeat(o, P);
  stripHatHeat(o, P);
  stripBlur(P, dt);
  /* sun (and its shadow box) rides between the camera and what it looks at */
  var c=_sfB.copy(STRIP.camPos).lerp(STRIP.camTgt, 0.62); c.y=0;
  var sun=STRIP.sun; sun.position.copy(c).addScaledVector(STRIP.sunDir, 130); sun.target.position.copy(c); sun.target.updateMatrixWorld();
  if(STRIP.flood.intensity>0){ STRIP.flood.position.set(c.x-30, 60, 40); STRIP.flood.target.position.copy(c); STRIP.flood.target.updateMatrixWorld(); }
  if(STRIP.spots.length){ var poles=STRIP.poles.slice().sort(function(a,b){ return Math.abs(a.x-c.x-4)-Math.abs(b.x-c.x-4); });
    STRIP.spots.forEach(function(sp,i){ var pl=poles[i]; if(!pl) return; sp.position.copy(pl); sp.target.position.set(pl.x+8, 0, pl.z*0.15); sp.target.updateMatrixWorld(); });
    stripKeySpots(P, O); }
  STRIP.prev={phase:ph, chute:!!o.chute, shifting:!!o.shifting, failed:!!o.failed};
}

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
  M.ground=stripMapMat(new THREE.MeshStandardMaterial({map:t, roughness:0.92}), ROAD_GLSL_ASPH, "pits_floor");   /* Full / Ultra: world-space grain, cracks, patches and a macro tint over the 5 m tile */
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

/* ===========================================================================
   PULL TRACK SCENE (DIESEL) — truck & tractor pulling, a third world the view
   cuts to while ENGINE_VIS.setPull({on:true, ...}) is fed every frame.
   Units metres. x = distance down the track (start line 0, 300 ft line 91.44),
   y up, z across: bleachers on the far side (z < 0), cameras on the near side.
   The vehicle's hitch sits at state.x and the sled trails it on a chain.
   Scenery goes through StripBatch like the strip; dirt, dust, diesel smoke and
   confetti are StripFx billboard systems (one draw each). Built on first use.
   ==========================================================================*/
var PULL_LINE=91.44, PULL_END=112, PULL_CHAIN=1.4, PULL_BOX0=-8.25, PULL_BOX1=-1.55, PULL_SLED_L=9.9;
var PULL_WIND=new THREE.Vector3(-1.1,0,-0.75), _sbX=new THREE.Vector3(1,0,0), _pA=new THREE.Vector3(), _pB=new THREE.Vector3(), _pC=new THREE.Vector3(), _pD=new THREE.Vector3(),
  _pw=new THREE.Vector3(), _pt=new THREE.Vector3(), _pr=new THREE.Vector3(), _prt=new THREE.Vector3(), _pM=new THREE.Matrix4(), _pQ=new THREE.Quaternion();
/* trackside props (Full / Ultra only): glTF models from models/ (vis/models.js), in metres.
   [key, x, y, z, turn, tilt]: y is what it sits on (each model is lifted so its lowest point lands there), tilt lays it over
   (a tyre lying flat is PI/2). The far wall hides anything this small from the race cameras, so they sit on the dirt:
   most in the near-side corner of the run-off at the far end (the right of the stop shot, held after every pull; all
   behind x 106 so the 300 ft line camera at x 105.4, z 5.6 has clear ground in front of it), and a few in the staging
   area behind the start (the line and low shots look back at it). Lite keeps the plain code scenery. */
var PULL_PROPS=[
  /* far end, near-side corner: the scoreboard's generator and fuel, tyres, milk crates with a toolbox on top,
     a hand truck, drums */
  ["generator",106.7,0,4.5,0.6], ["fuelcan",106.2,0,3.4,1.3], ["fuelcan",106.5,0,3.0,0.2],
  ["tyre",108.1,0,5.4,0,PI/2], ["tyre",108.1,0.165,5.4,0.6,PI/2], ["tyre",108.12,0.33,5.42,1.1,PI/2], ["tyre",108.1,0.495,5.4,1.9,PI/2],
  ["tyre",108.6,0,4.3,0.3,1.25],
  ["crate",109.5,0,5.5,0.05], ["crate",109.52,0.264,5.5,-0.08], ["crate",110.0,0,4.8,1.45], ["toolbox",109.5,0.528,5.5,2.9],
  ["handtruck",110.5,0,3.3,-0.9],
  ["barrel",111.1,0,5.5,0], ["barrel",111.4,0,4.7,1.2], ["barrel",110.9,0,4.0,2.3],
  /* far end, far-side corner (behind the vehicle in the stop shot; photo mode finds it) */
  ["tyre",108.2,0,-4.2,0,PI/2], ["tyre",108.2,0.165,-4.2,0.8,PI/2], ["barrel",110.6,0,-4.6,0.9], ["barrel",111.2,0,-5.3,2.0],
  /* staging area behind the start, near half, where the next hook waits */
  ["generator",-16.4,0,4.4,2.4], ["fuelcan",-15.4,0,3.7,1.3],
  ["tyre",-18.6,0,5.2,0,PI/2], ["tyre",-18.6,0.165,5.2,0.6,PI/2], ["tyre",-18.62,0.33,5.22,1.1,PI/2],
  ["crate",-21.6,0,5.3,0.05], ["crate",-21.62,0.264,5.3,-0.08], ["toolbox",-21.6,0.528,5.3,2.9],
  ["handtruck",-23.3,0,4.4,2.6], ["barrel",-26.0,0,5.4,0], ["barrel",-26.8,0,4.7,1.2]
];
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
  /* Full/Ultra: loose clods at the edges, a packed smooth pan band, ruts sunk with lugged floors, throw-berms along them */
  "#if STRIP_TIER>=1",
  "  float dh; vec3 dm=sfDirtFx(w.xz,clamp(0.3+0.7*smoothstep(1.6,4.5,az)-0.55*pan,0.0,1.0),dh); c*=mix(vec3(1.0),dm,0.75);",
  "  c*=1.0-0.14*rut; gH=dh-0.065*rut+0.045*berm+0.014*(lug-0.55)*rut; gHK=1.0;",
  "#endif",
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
  "#if STRIP_TIER>=1",
  "  float gh, dh; vec3 gm=sfGrassFx(p,gh), dm=sfDirtFx(p,0.5,dh); c*=mix(vec3(1.0),mix(gm,dm,worn/0.6),0.75); gH=mix(gh,dh,worn/0.6); gHK=1.0;",
  "#endif",
  "  float apron=(1.0-smoothstep(9.0,9.5,abs(p.y)))*smoothstep(-36.0,-35.0,p.x)*(1.0-smoothstep(128.0,129.0,p.x));",
  "  c=mix(c,vec3(0.34,0.31,0.27)*(0.8+0.4*sn(p*2.3)),apron);",
  "  float pit=smoothstep(19.0,20.0,p.y)*(1.0-smoothstep(54.0,55.0,p.y))*smoothstep(-42.0,-41.0,p.x)*(1.0-smoothstep(122.0,123.0,p.x));",
  "  c=mix(c,vec3(0.30,0.27,0.22)*(0.8+0.35*sn(p*0.9)),pit);",
  "#if STRIP_TIER>=1",
  "  float gvH; vec3 gvm=sfGravelFx(p,gvH); float gv=max(apron,pit); c*=mix(vec3(1.0),gvm,gv); gH=mix(gH,gvH,gv);",
  "#endif",
  "  vec2 q=(p+vec2(800.0,800.0))/805.0; vec2 cell=floor(q); float h=sh(cell+11.0);",
  "  vec3 fc= h<0.25?vec3(0.40,0.30,0.11): h<0.45?vec3(0.50,0.42,0.03): h<0.62?vec3(0.11,0.17,0.05): h<0.8?vec3(0.30,0.23,0.12):vec3(0.18,0.13,0.08);",
  "  float dir=step(0.5,sh(cell+3.0)); fc*=0.9+0.14*(0.5+0.5*sin(mix(p.x,p.y,dir)*1.3))*mid+0.22*(sn(p*0.006+cell*7.0)-0.5);",
  "  vec2 rp=abs(fract((p+vec2(800.0,800.0))/1609.0+0.5)-0.5)*1609.0; fc=mix(fc,vec3(0.34,0.30,0.24),1.0-smoothstep(4.0,7.0,min(rp.x,rp.y)));",
  "  float fair=1.0-smoothstep(150.0,175.0,max(abs(p.x-40.0),abs(p.y)));",
  "#if STRIP_TIER>=1",
  "  gH*=fair;",
  "#endif",
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
  var sky=new THREE.Mesh(new THREE.SphereGeometry(2600, 40, 20), stripSkyMat()); sky.frustumCulled=false; stripSkyLate(sky); S3.add(sky); PULL.sky=sky;
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
  P.amber=new THREE.MeshStandardMaterial({color:sc(0xd9820f), roughness:0.2, metalness:0.1, emissive:new THREE.Color(0xff8a00), emissiveIntensity:0.35});
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
  var mats={paint:paint, paintDS:paintDS, black:M.black, satin:M.satin, chrome:M.chrome, glass:M.glass, alu:M.alu, cast:P.cast, orange:P.orange, white:P.white, lens:P.lens, tail:P.tail, amber:P.amber, suit:P.suit, helmet:P.helmet, well:new THREE.MeshStandardMaterial({color:0x0b0b0c, roughness:1, side:THREE.DoubleSide}), decal:pullDecalMat(kind==="tractor"?"4020":String(((color>>>0)%89)+11))};
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
    /* detail: nerf bars, a headache rack with two lamps, cab roof markers, hood vents, the cab-to-fender seam,
       tailgate handle, rear bumper, and the bed load (a fuel cell and a row of suitcase weights) */
    for(s=-1;s<=1;s+=2){ rod(bin,"black",[1.05,1.0,s*1.08],[2.85,1.0,s*1.08],0.035);
      box(bin,"black",1.4,1.04,s*1.0,0.06,0.05,0.18); box(bin,"black",2.5,1.04,s*1.0,0.06,0.05,0.18);
      box(bin,"black",2.92,1.48,s*1.003,0.012,0.7,0.012);
      rod(bin,"black",[0.88,1.72,s*0.86],[0.88,2.5,s*0.86],0.035);
      for(i=0;i<4;i++) box(bin,"black",3.12+i*0.1,1.897,s*0.62,0.05,0.012,0.3);
      box(bin,"black",0.88,2.6,s*0.42,0.12,0.16,0.22); box(bin,"lens",0.945,2.6,s*0.42,0.01,0.12,0.18); }
    rod(bin,"black",[0.88,2.5,-0.86],[0.88,2.5,0.86],0.035); rod(bin,"black",[0.88,2.1,-0.86],[0.88,2.1,0.86],0.03);
    for(i=0;i<5;i++) box(bin,"amber",2.37,2.5,-0.5+i*0.25,0.05,0.035,0.09);
    box(bin,"black",-1.372,1.6,0,0.012,0.06,0.24); box(bin,"satin",-1.44,1.0,0,0.16,0.16,1.92);
    box(bin,"black",-0.6,1.36,0.42,0.5,0.32,0.5); cyl(bin,"chrome",-0.6,1.54,0.42,0.06,0.05);
    for(i=0;i<6;i++) rbox(bin,i%3===2?"black":"orange",-0.42-i*0.085,1.44,-0.42,0.07,0.46,0.42,0.015);
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
    /* detail: a roof beacon, rear work lamps, mirrors on arms, a grab rail and steps up to the cab door,
       amber and red lamps on the fenders, a fuel tank ahead of the cab, hood trim, and the 3-point lift arms */
    cyl(bin,"black",-0.45,3.04,0.55,0.08,0.04); cyl(bin,"amber",-0.45,3.12,0.55,0.065,0.13);
    for(s=-1;s<=1;s+=2){ box(bin,"black",-0.76,2.93,s*0.45,0.08,0.12,0.2); box(bin,"lens",-0.805,2.93,s*0.45,0.01,0.09,0.16);
      rod(bin,"black",[0.69,2.55,s*0.69],[0.86,2.48,s*1.02],0.02); box(bin,"black",0.87,2.36,s*1.06,0.04,0.3,0.16); box(bin,"glass",0.85,2.36,s*1.06,0.01,0.26,0.13);
      box(bin,"amber",0.55,1.98,s*1.5,0.12,0.08,0.1); box(bin,"tail",-0.75,1.83,s*1.5,0.1,0.08,0.1,0,0,0.75);
      box(bin,"chrome",2.0,1.1,s*0.447,2.5,0.025,0.012);
      rod(bin,"black",[-0.35,1.38,s*0.24],[-0.85,1.05,s*0.3],0.03); }
    rod(bin,"chrome",[0.75,1.62,0.73],[0.75,2.6,0.73],0.02);
    for(i=0;i<2;i++){ box(bin,"black",1.18,0.62+i*0.4,0.65,0.26,0.03,0.3); }
    rod(bin,"black",[1.18,0.55,0.5],[1.18,1.45,0.5],0.02); rod(bin,"black",[1.18,0.55,0.8],[1.18,1.45,0.8],0.02);
    cyl(bin,"black",1.8,1.0,0.62,0.14,0.7,0,0,PI/2); cyl(bin,"chrome",1.95,1.15,0.62,0.045,0.04);
    box(bin,"black",0.1,2.18,0.69,0.03,1.4,0.012); box(bin,"black",-0.22,2.3,0.69,0.62,0.03,0.012); box(bin,"chrome",0.02,2.0,0.7,0.1,0.025,0.015);
    rod(bin,"satin",[-0.45,1.32,0],[-0.95,1.02,0],0.035); box(bin,"orange",-0.62,0.86,0,0.12,0.12,0.3);
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
  pullProps();
}

/* glTF trackside props on Full / Ultra (PULL_PROPS); a drop to Lite takes them out again. They arrive a moment after the scene. */
function pullProps(){
  var S3=PULL.scene, lite=GFX==="lite";
  if(lite){ if(PULL.props){ S3.remove(PULL.props); PULL.props=null; } return; }
  if(PULL.props || typeof modelGet!=="function") return;
  if(!THREE.GLTFLoader){
    if(window.__pewPost) window.__pewPost(function(ok){ if(ok && THREE.GLTFLoader && PULL.scene===S3 && GFX!=="lite") pullProps(); });
    return;
  }
  var P=new THREE.Group(); P.name="pullProps"; PULL.props=P; S3.add(P);
  PULL_PROPS.forEach(function(s){
    modelGet(s[0], function(src){
      if(PULL.props!==P) return;
      var o=src.clone(); o.rotation.order="YXZ"; o.rotation.set(s[5]||0, s[4], 0); o.position.set(s[1], 0, s[3]);
      o.updateMatrixWorld(true); o.position.y=s[2]-new THREE.Box3().setFromObject(o).min.y;   /* sit it on y */
      o.name="model:"+s[0]; P.add(o);
    });
  });
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
var PULL_CROWD={decay:0.25, lo:0.35, hi:0.05, f0:7, f1:9, amp:0.17, body:0.31, head:0.75};
function pullCrowd(dt){ crowdTick(PULL, dt, PULL_CROWD); }
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
  sceneCut(PULL, s);
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
  PULL.shake*=Math.exp(-dt*3.5); var sh=CALM?0:PULL.shake; if(sh>0.002){ PULL.camPos.x+=(Math.random()-0.5)*sh*0.2; PULL.camPos.y+=(Math.random()-0.5)*sh*0.2; }
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


/* ===========================================================================
   MUD BOG SCENE — a county-fair mud pit the view cuts to while ENGINE_VIS.setBog({on:true, ...}) is fed every frame.
   Units metres, +x down the pit: the run-up is x < 0, the mud runs 0 … len. The mud is one plane per night: a canvas
   map (colour by consistency, the night's dark wet tracks painted in as the truck goes) and, on Full/Ultra, vertices
   pressed down into ruts behind the tyres. Berms both sides, a crowd on the bank, light poles, the pull pickup on
   bigger tyres (swampers, paddles) sinking and pitching with the mud, rooster tails scaled by wheelspin.
   ==========================================================================*/
var BOG_W=10, BOG_WIND=new THREE.Vector3(-0.8,0,0.6), _bA=new THREE.Vector3(), _bB=new THREE.Vector3(), _bw=new THREE.Vector3(), _bt=new THREE.Vector3(), _br=new THREE.Vector3(), _brt=new THREE.Vector3();
/* fairground grass, a dirt run-up lane, the dark ground round the pit, the pits and lot off to the side */
var BOG_GLSL_GROUND=[
  "uniform float uLen;",
  "vec3 stripSurf(vec3 w, out float rough){",
  "  vec2 p=w.xz; if(p.x>0.0 && p.x<uLen && abs(p.y)<5.0) discard;",
  "  float d=length(p-cameraPosition.xz); float fine=1.0-smoothstep(20.0,120.0,d), mid=1.0-smoothstep(100.0,900.0,d);",
  "  vec3 grass=vec3(0.11,0.155,0.055)*(0.8+0.35*sn(p*0.08))*(0.9+0.2*sn(p*1.9)*fine);",
  "  float worn=smoothstep(0.5,0.8,sn(p*0.06+3.0))*0.6;",
  "  vec3 c=mix(grass,vec3(0.27,0.21,0.14)*(0.85+0.3*sn(p*0.7)),worn);",
  "  float lane=(1.0-smoothstep(5.0,6.5,abs(p.y)))*smoothstep(-58.0,-55.0,p.x)*(1.0-smoothstep(uLen+26.0,uLen+30.0,p.x));",
  "  vec3 dirt=vec3(0.30,0.22,0.14)*(0.8+0.3*sn(p*0.9))+vec3(0.04,0.03,0.02)*(sn(p*6.0)-0.5)*fine;",
  "  float tr=exp(-pow((abs(p.y)-1.0)/0.35,2.0))*0.5;",
  "  dirt=mix(dirt,dirt*0.7,tr);",
  "  float wet=(1.0-smoothstep(7.0,10.0,abs(p.y)))*smoothstep(-4.0,0.0,p.x)*(1.0-smoothstep(uLen,uLen+8.0,p.x));",
  "  dirt=mix(dirt,vec3(0.16,0.11,0.07)*(0.85+0.3*sn(p*1.3)),wet*0.8);",
  "  c=mix(c,dirt,max(lane,wet*0.9));",
  /* Full/Ultra: grass tufts, a lumpy rutted run-up, standing puddles in the wet lane */
  "#if STRIP_TIER>=1",
  "  float gh, dh; vec3 gm=sfGrassFx(p,gh), dm=sfDirtFx(p,0.75,dh); float wd=max(lane,wet*0.9); c*=mix(mix(gm,dm,worn/0.6),dm,wd); gH=mix(mix(gh,dh,worn/0.6),dh,wd); gHK=1.0;",
  "  gH-=0.05*tr*lane; float pud=wet*smoothstep(0.6,0.68,sn(p*0.85+4.0)+0.12*sn(p*4.0)); c*=1.0-0.45*pud; gH*=1.0-pud;",
  "#endif",
  "  float lot=smoothstep(16.0,17.0,p.y)*(1.0-smoothstep(46.0,47.0,p.y))*smoothstep(-50.0,-49.0,p.x)*(1.0-smoothstep(uLen+20.0,uLen+21.0,p.x));",
  "  c=mix(c,vec3(0.30,0.27,0.22)*(0.8+0.35*sn(p*0.9)),lot);",
  "#if STRIP_TIER>=1",
  "  float gvH; vec3 gvm=sfGravelFx(p,gvH); c*=mix(vec3(1.0),gvm,lot); gH=mix(gH,gvH,lot);",
  "#endif",
  "  vec2 q=(p+vec2(800.0,800.0))/805.0; vec2 cell=floor(q); float h=sh(cell+11.0);",
  "  vec3 fc= h<0.25?vec3(0.40,0.30,0.11): h<0.45?vec3(0.50,0.42,0.03): h<0.62?vec3(0.11,0.17,0.05): h<0.8?vec3(0.30,0.23,0.12):vec3(0.18,0.13,0.08);",
  "  fc*=0.9+0.22*(sn(p*0.006+cell*7.0)-0.5)*mid;",
  "  float fair=1.0-smoothstep(140.0,170.0,max(abs(p.x-40.0),abs(p.y)));",
  "#if STRIP_TIER>=1",
  "  gH*=fair; rough=mix(0.96,0.7,wet); rough=mix(rough,0.12,pud*fair); c=mix(fc,c,fair); return c; }",
  "#else",
  "  c=mix(fc,c,fair); rough=mix(0.96,0.7,wet); return c; }",
  "#endif"].join("\n");

/* the night's mud: colour by consistency (soupy = milky chocolate, sticky = grey clay), puddles, foam, the edges */
function bogMudPaint(cv, len, cons, seed){
  var x=cv.getContext("2d"), W=cv.width, H=cv.height, i, r=function(){ seed=(seed*16807)%2147483647; return seed/2147483647; };
  var base=cons<0.45?[104,68,38]:[92,72,52], dark=cons<0.45?[52,32,18]:[50,40,30];
  base=[lerp(base[0],90,cons),lerp(base[1],70,cons),lerp(base[2],50,cons)];
  x.fillStyle="rgb("+base.map(Math.round).join(",")+")"; x.fillRect(0,0,W,H);
  var img=x.getImageData(0,0,W,H), d=img.data;
  for(var j=0;j<H;j++) for(i=0;i<W;i++){ var n=fbm(i/W*len/8, j/H*1.3, 4, 3, 5)*0.7+hashi(i,j,9)*0.3, k=(j*W+i)*4, edge=Math.min(1, Math.min(j, H-1-j)/(H*0.12));
    var f=0.72+0.55*n; d[k]=d[k]*f*(0.8+0.2*edge); d[k+1]=d[k+1]*f*(0.8+0.2*edge); d[k+2]=d[k+2]*f*(0.82+0.18*edge); }
  x.putImageData(img,0,0);
  /* standing water: soupy mud pools, sticky clay cracks into islands */
  var np=Math.round(6+10*(1-cons));
  for(i=0;i<np;i++){ var px=r()*W, py=H*(0.15+0.7*r()), rx=W*(0.01+0.03*r()), ry=H*(0.06+0.12*r());
    x.fillStyle="rgba("+dark.join(",")+","+(0.35+0.3*(1-cons))+")"; x.beginPath(); x.ellipse(px,py,rx,ry,0,0,TAU); x.fill(); }
  if(cons<0.4){ for(i=0;i<60;i++){ x.fillStyle="rgba(200,180,150,"+(0.06+0.08*r())+")"; x.beginPath(); x.ellipse(r()*W,H*(0.1+0.8*r()),2+r()*6,1+r()*2,0,0,TAU); x.fill(); } }   /* foam */
  else { x.strokeStyle="rgba(40,32,24,0.35)"; x.lineWidth=1; for(i=0;i<90;i++){ var cx=r()*W, cy=r()*H; x.beginPath(); x.moveTo(cx,cy); x.lineTo(cx+(r()-0.5)*14,cy+(r()-0.5)*6); x.stroke(); } }
}
/* (re)build the pit for a night: the sim's pit (depth profile, ridges, ruts) as a heightfield dug below the fairground, its
   map, the water in its troughs and the berms (vis/bog-pit.js). half: the truck's half-track, where the fine rut rows go. */
function bogMudBuild(pit, half){
  var lite=GFX==="lite", len=Math.max(20, +pit.len||70), hf=Math.round((half||1)*20)/20, key=[pit.seed, len, pit.cons, lite?"l":GFX, hf, +pit.pitK||1, (pit.hz||[]).length, pit.depth?1:0].join("|");
  if(BOG.mudKey===key && BOG.mud) return; BOG.mudKey=key;
  if(BOG.mud){ BOG.scene.remove(BOG.mud); BOG.mud.geometry.dispose(); }
  var P=bogPitInit(pit, len), g=bogPitGeo(P, hf, lite); BOG.mudLen=len; BOG.rutLast={}; BOG.rutC0=1e9; BOG.rutC1=-1; BOG.texC0=1e9; BOG.texC1=-1; BOG.holeDone=false;
  var W=lite?512:1024, H=lite?64:128; if(!BOG.mudCv || BOG.mudCv.width!==W){ BOG.mudCv=newCanvas(W,H); if(BOG.mudTex) BOG.mudTex.dispose(); BOG.mudTex=new THREE.CanvasTexture(BOG.mudCv); BOG.mudTex.encoding=THREE.sRGBEncoding; BOG.mudTex.anisotropy=MAXANISO; }
  bogMudPaint(BOG.mudCv, len, +pit.cons||0.5, (pit.seed>>>0)%2147483646+1); bogPitPaint(BOG.mudCv, P); BOG.mudTex.needsUpdate=true;
  BOG.mats.mud.map=BOG.mudTex; BOG.mats.mud.roughness=lerp(0.22,0.48,clamp(+pit.cons||0.5,0,1)); BOG.mats.mud.needsUpdate=true;
  var MD=BOG.mats.mud.defines=Object.assign({}, BOG.mats.mud.defines||{}); if(lite) MD.BOG_LITE=""; else delete MD.BOG_LITE; if(BOG.mudU) BOG.mudU.uCons.value=P.cons;
  BOG.mud=new THREE.Mesh(g, BOG.mats.mud); BOG.mud.receiveShadow=true; BOG.scene.add(BOG.mud);
  bogPitWater(P, lite); bogPitBerms(len, lite);
  BOG.paintX=-1e9; BOG.rutDirty=0;
  if(BOG.farWall) BOG.farWall.position.x=len+13;
  if(BOG.groundMat && BOG.groundMat.userData.uLen) BOG.groundMat.userData.uLen.value=len;
  if(BOG.marks) BOG.marks.forEach(function(m){ m.visible=m.userData.d<len; });
}
/* paint the wheel tracks into the map: dark wet stripes, churned edges, a smear where it stopped */
function bogMudTrack(x0, x1, half, w, k){
  var cv=BOG.mudCv; if(!cv) return; var c=cv.getContext("2d"), W=cv.width, H=cv.height, L=BOG.mudLen, a=Math.max(0,Math.min(L,x0)), b=Math.max(0,Math.min(L,x1)); if(b<=a) return;
  var px0=a/L*W, px1=b/L*W, zs=[-half, half];
  for(var i=0;i<2;i++){ var cy=(zs[i]/BOG_W+0.5)*H, hh=w/BOG_W*H;
    c.fillStyle="rgba(22,15,9,"+(0.28+0.4*k)+")"; c.fillRect(px0, cy-hh/2, px1-px0+1, hh);
    c.fillStyle="rgba(150,120,90,"+(0.05+0.08*k)+")"; c.fillRect(px0, cy-hh/2-2, px1-px0+1, 2); c.fillRect(px0, cy+hh/2, px1-px0+1, 2); }
  c.fillStyle="rgba(30,20,12,"+(0.1+0.1*k)+")"; c.fillRect(px0, H*0.5-half/BOG_W*H*0.6, px1-px0+1, half/BOG_W*H*1.2);
  BOG.texC0=Math.min(BOG.texC0,px0-3); BOG.texC1=Math.max(BOG.texC1,px1+3);   /* uploaded as a strip once a frame (bogPitTexFlush) */
}
/* Full/Ultra: a rut behind each tyre (key: which tyre), the trough deep as the mud holds it — soup flows back in, clay keeps its shape */
function bogMudRut(key, x, z, w, depth, lip){ if(GFX!=="lite") bogPitRut(key, x, z, w, depth, lip); }
function bogMudReset(){
  BOG.mudKey=""; BOG.rutLast={};   /* rebuild the pit and repaint the map next frame */
}
function bogAtlas(){
  var c=newCanvas(1024,256), x=c.getContext("2d"), F="'Chakra Petch','Arial Narrow',Arial,sans-serif", i;
  function panel(x0,y0,w,h,bg,fg,txt,sz,sub){ x.fillStyle=bg; x.fillRect(x0,y0,w,h); x.fillStyle=fg; x.font="700 "+sz+"px "+F; x.textAlign="center"; x.textBaseline="middle"; x.fillText(txt, x0+w/2, y0+h/2+2, w-16); if(sub){ x.fillStyle=sub; x.fillRect(x0,y0+h-7,w,5); } }
  panel(0,0,1024,62,"#141413","#d97757","PRAIRIE ENGINE WORKS · MUD BOG",40,"#d97757");
  panel(0,64,340,60,"#d97757","#141413","PRAIRIE ENGINE WORKS",30,"#141413"); panel(342,64,340,60,"#141413","#d97757","COULEE FUELS",40,"#d97757"); panel(684,64,340,60,"#131416","#f2c22c","NORTHWIND TYRE",38,"#f2c22c");
  for(i=0;i<9;i++){ var bx=i*113; x.fillStyle="#141413"; x.fillRect(bx,128,111,126); x.fillStyle=i%2?"#f4efe2":"#d97757"; x.fillRect(bx+5,133,101,116); x.fillStyle="#141413"; x.font="700 56px "+F; x.textAlign="center"; x.textBaseline="middle"; x.fillText(String((i+1)*10), bx+55, 180); x.font="700 18px "+F; x.fillText("METRES", bx+55, 228); }
  var t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=MAXANISO; return t;
}
var BOG_UV={ long:[0,1-62/256,1,1], ban:[[0,1-124/256,340/1024,1-64/256],[342/1024,1-124/256,682/1024,1-64/256],[684/1024,1-124/256,1,1-64/256]], mark:function(i){ return [i*113/1024, 1-254/256, (i*113+111)/1024, 1-128/256]; } };
function bogBuild(B, key, mat, shadow){ var keep=STRIP.scene; STRIP.scene=BOG.scene; var m=B.build(key, mat, shadow); STRIP.scene=keep; return m; }
function buildBogScene(){
  var S3=new THREE.Scene(); BOG.scene=S3; BOG.tier=GFX;
  var lite=(GFX==="lite"), i, k, side, x, z, M=BOG.mats;
  var rng=function(s){ var t=Math.sin(s*127.1+3.7)*43758.5453; return t-Math.floor(t); };
  if(!PULL.g) PULL.g={ box:new THREE.BoxGeometry(1,1,1), cyl:new THREE.CylinderGeometry(0.5,0.5,1,14), cyl8:new THREE.CylinderGeometry(0.5,0.5,1,8), sph:new THREE.SphereGeometry(0.5,12,8), plane:new THREE.PlaneGeometry(1,1).rotateX(-PI/2) };   /* the pull pickup's parts */
  var hemi=new THREE.HemisphereLight(0xcfdcf0, 0x6a5a3c, 0.3); S3.add(hemi); BOG.hemi=hemi;
  var sun=new THREE.DirectionalLight(0xffe6c4, 1.45); sun.shadow.mapSize.set(2048,2048);
  var shc=sun.shadow.camera; shc.left=-24; shc.right=24; shc.top=24; shc.bottom=-24; shc.near=1; shc.far=260; sun.shadow.bias=-0.0006; sun.shadow.normalBias=0.03;
  S3.add(sun); S3.add(sun.target); BOG.sun=sun;
  var flood=new THREE.DirectionalLight(0xfff2dc, 0); flood.position.set(0,40,30); S3.add(flood); S3.add(flood.target); BOG.flood=flood;
  var sky=new THREE.Mesh(new THREE.SphereGeometry(2600, 40, 20), stripSkyMat()); sky.frustumCulled=false; stripSkyLate(sky); S3.add(sky); BOG.sky=sky;
  S3.fog=new THREE.Fog(0xffffff, 150, 2700); BOG.fog=S3.fog;
  var uLen={value:75}, gm=stripSurfMat(BOG_GLSL_GROUND, null, {uLen:uLen}); gm.userData.uLen=uLen; gm.customProgramCacheKey=function(){ return "bog_ground"; }; BOG.groundMat=gm;
  var ground=new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), gm); ground.rotation.x=-PI/2; ground.position.set(40,-0.02,0); ground.receiveShadow=true; S3.add(ground);
  /* the pit itself (dug below the ground, its own walls), its water and the berms are built per night: bogMudBuild */
  (function(){ var seg=120, R0=1900, pos=[], col=[], idx=[], c1=sc(0x5d6a4a), c2=sc(0x7d8a70);
    for(var s=0;s<=seg;s++){ var a=s/seg*TAU, hgt=Math.max(5, 14+34*Math.pow(0.5+0.5*Math.sin(a*3.0+1.4),2)+18*Math.sin(a*11.0+0.4)*Math.sin(a*5.0)+10*Math.sin(a*23.0));
      pos.push(40+Math.cos(a)*(R0-500),-2,Math.sin(a)*(R0-500), 40+Math.cos(a)*R0,hgt,Math.sin(a)*R0, 40+Math.cos(a)*(R0+400),hgt*0.6,Math.sin(a)*(R0+400)); col.push(c1.r,c1.g,c1.b, c2.r,c2.g,c2.b, c2.r,c2.g,c2.b); }
    for(s=0;s<seg;s++){ var a0=s*3, b0=(s+1)*3; idx.push(a0,b0,a0+1, b0,b0+1,a0+1, a0+1,b0+1,a0+2, b0+1,b0+2,a0+2); }
    var g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); g.setAttribute("color",new THREE.Float32BufferAttribute(col,3)); g.setIndex(idx); g.computeVertexNormals();
    var hm=new THREE.Mesh(g, new THREE.MeshStandardMaterial({vertexColors:true, roughness:1, side:THREE.DoubleSide})); hm.frustumCulled=false; S3.add(hm); })();
  M.solid=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.86});
  M.metal=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.42, metalness:0.65});
  M.lamp=new THREE.MeshBasicMaterial({vertexColors:true, toneMapped:false, color:0x777777});
  M.beam=new THREE.MeshBasicMaterial({vertexColors:true, transparent:true, opacity:0.0, depthWrite:false, blending:THREE.AdditiveBlending, fog:true, side:THREE.DoubleSide});
  M.sign=new THREE.MeshStandardMaterial({map:bogAtlas(), roughness:0.72});
  M.dirt=new THREE.MeshStandardMaterial({color:sc(0x5a4029), roughness:1});
  M.mud=new THREE.MeshStandardMaterial({color:0xb0a090, roughness:0.3, metalness:0.0, envMapIntensity:0.45});
  bogMudWet(M.mud);
  bogMudMatDetail(M.mud);   /* consistency detail, tyre collars, the belly crown: chained after bogMudWet, layered over its colour */
  var B=new StripBatch(), STEEL=0x8d9296, ALU=0xb9bec4, DARK=0x2a2c2f, RUB=0x1a1a1c;
  /* berms (rough banks both sides and across the far end) come with the night's pit: bogPitBerms. A tyre wall at the far end. */
  BOG.bermKey="";
  var tw=new THREE.Group(); for(z=-6; z<=6.1; z+=0.8) for(k=0;k<3;k++){ var tyre=new THREE.Mesh(PULL.g.cyl8, new THREE.MeshStandardMaterial({color:sc(RUB), roughness:0.95})); tyre.scale.set(0.72,0.3,0.72); tyre.position.set((k&1)?0.35:0, 0.17+k*0.3, z); tw.add(tyre); }
  tw.position.set(88,0,0); S3.add(tw); BOG.farWall=tw;
  /* pipe rail along the crowd side, banners on it, distance boards on the far side every 10 m */
  for(x=-30; x<110; x+=3){ B.add("metal","cyl6",[x, 0.55, -BOG_W/2-3.6],[0.07,1.1,0.07],STEEL); }
  B.add("metal","cyl6",[40, 1.08, -BOG_W/2-3.6],[0.06,140,0.06],ALU,[0,0,PI/2]); B.add("metal","cyl6",[40, 0.6, -BOG_W/2-3.6],[0.06,140,0.06],ALU,[0,0,PI/2]);
  for(x=-24, k=0; x<104; x+=9, k++) B.add("sign","plane",[x, 0.82, -BOG_W/2-3.55],[5.4,0.62,1],0xffffff,[0,0,0],BOG_UV.ban[k%3]);
  BOG.marks=[]; var markIt=function(i2){ var mx=(i2+1)*10, mz=BOG_W/2+4.4, gp=new THREE.Group(); gp.userData.d=mx;
    var post=new THREE.Mesh(PULL.g.cyl8, new THREE.MeshStandardMaterial({color:sc(STEEL), roughness:0.5, metalness:0.6})); post.scale.set(0.1,2.4,0.1); post.position.y=1.2; gp.add(post);
    var pg=new THREE.PlaneGeometry(1.2,1.36), uv=pg.attributes.uv, r4=BOG_UV.mark(i2); for(var q=0;q<uv.count;q++) uv.setXY(q, r4[0]+uv.getX(q)*(r4[2]-r4[0]), r4[1]+uv.getY(q)*(r4[3]-r4[1]));
    var bd=new THREE.Mesh(pg, M.sign); bd.position.set(0,2.5,-0.06); bd.rotation.y=PI; gp.add(bd); gp.position.set(mx,0,mz); gp.rotation.y=-0.35; S3.add(gp); BOG.marks.push(gp); };
  for(i=0;i<9;i++) markIt(i);
  /* the bank on the crowd side: a grass slope behind the rail, the crowd on it, pickups parked along the top */
  var bank=new THREE.Mesh(sbGeo().prism, new THREE.MeshStandardMaterial({color:sc(0x3d4a24), roughness:1})); bank.scale.set(150,3.4,16); bank.position.set(40,-0.05,-BOG_W/2-12.5); S3.add(bank); bank.receiveShadow=true;
  var hcol=[0xe9e6dc,0x1b1d20,0x9e2a22,0x22488f,0xd0d3d6,0x2c6b3a,0xff7a1a,0x6b6f74];
  for(i=0;i<12;i++){ var hx=-26+i*11+rng(i)*4, hz=-BOG_W/2-25-rng(i+3)*4, cc=hcol[i%hcol.length];
    B.box("solid", hx, 1.05, hz, 5.2, 0.9, 2.0, cc, 0.08*(rng(i+7)-0.5)); B.box("solid", hx+0.9, 1.75, hz, 2.0, 0.7, 1.85, 0x22262b, 0.08*(rng(i+7)-0.5)); B.box("solid", hx, 0.35, hz, 4.6, 0.5, 1.9, 0x161718); }
  /* light poles: four on each side */
  BOG.poles=[]; [[-14,-BOG_W/2-8],[20,-BOG_W/2-8],[54,-BOG_W/2-8],[88,-BOG_W/2-8],[-4,BOG_W/2+10],[30,BOG_W/2+10],[64,BOG_W/2+10],[96,BOG_W/2+10]].forEach(function(pp){
    var px=pp[0], pz=pp[1], H=pz<0?18:16, s2=pz<0?1:-1;
    B.add("metal","cyl",[px, H/2, pz],[0.36,H,0.36],0x9aa0a6); B.box("metal", px, H+0.2, pz, 3.2, 0.22, 0.28, 0x80868c);
    for(k=0;k<3;k++){ var lx=px-1.0+k; B.box("metal", lx, H+0.65, pz+s2*0.12, 0.74, 0.62, 0.36, 0x5a5f65); B.box("lamp", lx, H+0.65, pz+s2*0.31, 0.6, 0.5, 0.02, 0xfff0d0); }
    B.add("beam","beam",[px, H/2, pz+s2*H*0.18],[6,H,6],0xffe8c0,[-s2*0.36,0,0]);
    BOG.poles.push(new THREE.Vector3(px, H+0.8, pz)); });
  /* announcer's trailer and a food truck behind the far side */
  B.box("solid", 44, 1.6, BOG_W/2+16, 7, 2.6, 2.6, 0xe7e2d6); B.box("solid", 44, 3.05, BOG_W/2+16, 7.3, 0.25, 2.9, 0x2a2c2f); B.add("sign","plane",[44, 2.2, BOG_W/2+14.68],[6.4,0.6,1],0xffffff,[0,PI,0],BOG_UV.long);
  B.box("solid", 70, 1.4, BOG_W/2+15, 5, 2.4, 2.3, 0x9e2a22); B.box("solid", 70, 2.75, BOG_W/2+15, 5.2, 0.2, 2.5, 0xf1ede2);
  /* sheds and a grain elevator off in the distance */
  B.box("solid", 150, 12, -150, 12, 24, 12, 0x8e2f23, 0.3); B.add("solid","prism",[150,24,-150],[12.4,3.4,12.4],0x4a4644,[0,0.3,0]);
  B.box("solid", -80, 3.5, 120, 20, 7, 12, 0x9a2e22, 0.4); B.add("solid","prism",[-80,7,120],[20.4,3,12.6],0x5a5a5a,[0,0.4,0]);
  bogProps(B, S3, lite);   /* people in the pickup beds, chairs, coolers, flags, the recovery tractor (vis/bog-trucks.js) */
  bogBuild(B,"solid", M.solid, !lite); bogBuild(B,"metal", M.metal, !lite); bogFlagman(S3); BOG.lampMesh=bogBuild(B,"lamp", M.lamp, false); bogBuild(B,"sign", M.sign, false);
  BOG.beamMesh=bogBuild(B,"beam", M.beam, false); if(BOG.beamMesh){ BOG.beamMesh.receiveShadow=false; BOG.beamMesh.visible=false; BOG.beamMesh.renderOrder=4; }
  /* shelterbelt */
  (function(){ var pts=[], s;
    for(s=0;s<60;s++){ var a=s/60*TAU, R=150+rng(s)*30; pts.push([40+Math.cos(a)*R*1.3, Math.sin(a)*R, 4+rng(s+3)*3]); }
    var im=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0), new THREE.MeshStandardMaterial({roughness:1}), pts.length), mm=new THREE.Matrix4(), cc=new THREE.Color();
    pts.forEach(function(p,q){ var h=p[2]*1.6; mm.compose(_sbP.set(p[0],h*0.8,p[1]), _sbQ.set(0,0,0,1), _sbS.set(p[2],h,p[2])); im.setMatrixAt(q,mm); cc.setHSL(0.24+rng(q)*0.06, 0.45, 0.13+rng(q+1)*0.06).convertSRGBToLinear(); im.setColorAt(q,cc); });
    instCull(im); S3.add(im); })();
  /* the crowd on the bank: standing, some on lawn chairs, thinner on Lite */
  (function(){ var ppl=[], occ=lite?0.35:ULT()?0.88:0.6, slope=1.7/8;
    for(var r=0;r<8;r++){ var rz=-BOG_W/2-4.6-r*1.0, ry=Math.max(0,-BOG_W/2-4.5-rz)*slope;
      for(var xx=-22; xx<104; xx+=0.62){ if(rng(xx*3.1+r*17.7)>occ*(1-r*0.06)) continue; ppl.push([xx+(rng(xx+r)-0.5)*0.3, ry, rz+(rng(xx*1.7+r)-0.5)*0.4]); } }
    var n=ppl.length, bodyM=new THREE.InstancedMesh(new THREE.BoxGeometry(0.46,0.8,0.32), new THREE.MeshStandardMaterial({roughness:0.95}), n),
        headM=new THREE.InstancedMesh(new THREE.BoxGeometry(0.22,0.25,0.22), new THREE.MeshStandardMaterial({roughness:0.9}), n);
    var shirts=[0x9c3a30,0x34598f,0xcfccc4,0x1f2023,0x2a2c30,0xff7a1a,0x44684a,0xc8a640,0x5d5f66,0x7a7f86,0x3a3d44,0x8f4a5e,0x2c6b3a], skin=[0xe0b494,0xc68a64,0x8d5a3b,0xf0c9a8,0x5a3a26], hats=[0x1d4787,0xff7a1a,0x222222,0xe9e6dc,0x2c6b3a,0x9e2a22];
    var mm=new THREE.Matrix4(), cc=new THREE.Color(), base=[];
    for(var s=0;s<n;s++){ var p=ppl[s]; mm.makeTranslation(p[0],p[1]+0.4,p[2]); bodyM.setMatrixAt(s,mm); mm.makeTranslation(p[0],p[1]+0.93,p[2]); headM.setMatrixAt(s,mm);
      cc.set(shirts[Math.floor(rng(s*1.3)*shirts.length)]).convertSRGBToLinear(); bodyM.setColorAt(s,cc);
      cc.set(rng(s*2.9)<0.45?hats[Math.floor(rng(s*4.1)*hats.length)]:skin[Math.floor(rng(s*3.7)*skin.length)]).convertSRGBToLinear(); headM.setColorAt(s,cc); base.push(p); }
    bodyM.receiveShadow=true; instCull(bodyM, 1.5); instCull(headM, 1.5); S3.add(bodyM); S3.add(headM);
    BOG.crowd={body:bodyM, head:headM, base:base, n:n, phase:base.map(function(p,q){ return rng(q*9.1)*TAU; }), excite:base.map(function(p,q){ return rng(q*5.3); }), live:false}; })();
  /* mud: the plane is built per night; clods (lit, sharp), spray and splash mist (soft, Full/Ultra only), exhaust */
  bogFxBuild(S3, lite);   /* vis/bog-fx.js */
  BOG.cam=new THREE.PerspectiveCamera(46, 1, 0.3, 3600); BOG.built=true;
  BOG.night=null; bogSetNight(false);
}
/* wet mud by day: the material is darker and browner in daylight, and on Full/Ultra (MUD_VAR) a world-space noise breaks it
   into broad tonal patches with glossy wet slicks between matte crust, so it still reads as mud from the stands. Lite keeps
   the plain material (only its colour and gloss change: no extra shader work). Night uses the original look (uDay 0). */
function bogMudWet(m){
  var uDay={value:0}; m.userData.uDay=uDay;
  m.onBeforeCompile=function(sh){ sh.uniforms.uMudDay=uDay;
    sh.vertexShader=sh.vertexShader.replace("#include <common>", "#include <common>\n#ifdef MUD_VAR\nvarying vec2 vMw;\n#endif").replace("#include <project_vertex>", "#include <project_vertex>\n#ifdef MUD_VAR\nvMw=(modelMatrix*vec4(transformed,1.0)).xz;\n#endif");
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uMudDay;\n#ifdef MUD_VAR\nvarying vec2 vMw;\n"+STRIP_GLSL_NOISE+"\n#endif")
      .replace("#include <color_fragment>", "#include <color_fragment>\n#ifdef MUD_VAR\nfloat mTone=sn(vMw*0.33)*0.65+sn(vMw*1.6+3.1)*0.35, mWet=smoothstep(0.42,0.68,sn(vMw*0.55+vec2(7.0,2.0)));\ndiffuseColor.rgb*=mix(1.0,(0.74+0.5*mTone)*(1.0-0.16*mWet),uMudDay);\n#endif")
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n#ifdef MUD_VAR\nroughnessFactor*=mix(1.0,mix(1.3,0.42,mWet),uMudDay);\n#endif");
  };
  m.customProgramCacheKey=function(){ return "bog_mud"+(m.defines&&m.defines.MUD_VAR!==undefined?"_v":""); };
}
function bogMudLook(on, lite){
  var m=BOG.mats&&BOG.mats.mud; if(!m||!m.userData.uDay) return; m.userData.uDay.value=on?0:1;
  m.color.set(on?0xb0a090:0x84644a);           /* by day: darker, browner (the sun is 10x the floods and washed it to grey) */
  m.envMapIntensity=on?0.45:0.32;               /* less grey sky in the sheen; the sun still glints off it */
  var v=!lite; if(v!==(m.defines&&m.defines.MUD_VAR!==undefined)){ m.defines=v?{MUD_VAR:""}:{}; m.needsUpdate=true; }
}
function bogSetNight(on){
  on=!!on; var tierChanged=BOG.tier!==GFX; if(BOG.night===on && !tierChanged) return;
  BOG.night=on; BOG.tier=GFX; var S3=BOG.scene, lite=(GFX==="lite"), M=BOG.mats;
  BOG.sky.material.uniforms.uNight.value=on?1:0;
  var h=on?STRIP_HOR_N:STRIP_HOR; BOG.horLin=new THREE.Color(h[0],h[1],h[2]);
  BOG.sunDir=(on?STRIP_MOON:STRIP_SUN_DAY);
  BOG.sun.color.set(on?0x9fb2d6:0xffe2bc); BOG.sun.intensity=on?0.14:1.45; BOG.sun.castShadow=!lite;
  BOG.hemi.intensity=on?0.14:0.2; BOG.hemi.color.set(on?0x3a4764:0xcfdcf0); BOG.hemi.groundColor.set(on?0x16130e:0x6a5a3c);
  BOG.flood.intensity=on?(lite?0.6:0.28):0;
  M.lamp.color.set(on?0xffffff:0x5e5e5e);
  bogMudLook(on, lite);
  if(BOG.beamMesh){ BOG.beamMesh.visible=on; M.beam.opacity=on?0.014:0; ultraBeam(BOG.beamMesh, M.beam); }
  S3.environment=stripEnv(on); BOG.exposure=on?1.0:0.9;
  [BOG.fx, BOG.fxSpray].forEach(function(F){ if(F){ F.mat.uniforms.uAmb.value=F===BOG.fx?1:(on?0.45:1); F.mat.uniforms.uFogN.value=S3.fog.near; F.mat.uniforms.uFogF.value=S3.fog.far; } });
  if(tierChanged && BOG.sun.shadow.map){ BOG.sun.shadow.map.dispose(); BOG.sun.shadow.map=null; }
  BOG.spots.forEach(function(sp){ S3.remove(sp); S3.remove(sp.target); if(sp.shadow&&sp.shadow.map) sp.shadow.map.dispose(); }); BOG.spots=[];
  if(on){ for(var i=0;i<(lite?2:3);i++){ var sp=new THREE.SpotLight(0xfff0d8, 1.6, 120, 0.62, 0.6, 1.5); sp.castShadow=!lite && i===0; if(sp.castShadow){ sp.shadow.mapSize.set(1024,1024); sp.shadow.bias=-0.002; sp.shadow.normalBias=0.05; sp.shadow.camera.near=4; sp.shadow.camera.far=120; }
    S3.add(sp); S3.add(sp.target); BOG.spots.push(sp); } ultraSpots(BOG.spots); }
  if(!lite) ultraShadow(BOG.sun, 2048);
}
/* the truck per class: a real one per class at real size on the sim's tyres (vis/bog-trucks.js: bogTruck), no pull gear; k=1 */
var BOG_LOOK={ street:{k:1.0, tyre:"mt", col:0x1d4787}, modified:{k:1.0, tyre:"swamp", col:0xb7261d}, super:{k:1.0, tyre:"paddle", col:0x2c6b3a} };
function bogVehicle(cls, tyre, color, hw){
  var V=bogTruck(BOG_LOOK[cls]?cls:"street", tyre, color, hw||bogTruckHw()), U=V.userData;
  U.k=1; U.paint0=U.mats.paint.color.clone(); U.cls=cls; return V;
}
/* the mud thrown about: rooster tails, the bow wave, splashes, spray, exhaust (vis/bog-fx.js) */
function bogEffects(o, dt, V){ bogFxUpdate(o, dt, V); }
var BOG_CROWD={decay:0.3, lo:0.4, hi:0.05, f0:7, f1:9, amp:0.18, body:0.4, head:0.93};
function bogCrowd(dt){ crowdTick(BOG, dt, BOG_CROWD); }
function bogDirect(o, dt, V){
  var ph=o.phase||"stage", v=Math.max(0,+o.v||0), U=V.userData, k=U.k||1, fx=+o.x||0, len=+o.len||70, cx=V.position.x+U.wb*k*0.5, s=BOG.shot;
  if(o.shot) s=o.shot;
  else if(BOG.skip||ph==="done") s=(s==="front"&&BOG.doneT<1.2)?"front":"stop";
  else if(ph==="stage") s="stage";
  else if(ph==="runup") s=fx<-12?"chase":"entry";
  else { if(s!=="side"&&s!=="front"&&s!=="high") s="side";
    if(s==="side" && BOG.shotT>2.6 && fx<len-14 && v>2) s="front";
    else if(s==="front" && (BOG.fixX-fx<4 || BOG.shotT>3.4)) s=GFX==="lite"?"side":"high";
    else if(s==="high" && BOG.shotT>2.6) s="side"; }
  if(s!==BOG.shot){ if(s==="front") BOG.fixX=Math.min(len+5, fx+7+v*0.9); }
  sceneCut(BOG, s); BOG.shotT+=dt; BOG.cutT+=dt; var T=BOG.shotT, fov=46, rel=false, ax=0, sm=0;
  switch(s){
    case "stage": { var dS=bogFitDist(U, 46), pu=1-0.08*Math.min(1,T/5); _bw.set(cx-dS*0.6*pu, 0.9+dS*0.2, -dS*0.8*pu); _bt.set(cx+0.6, (U.top||2)*0.42, 0); fov=46; break; }   /* the whole truck in frame on any aspect */
    case "chase": rel=true; ax=cx; _bw.set(-9.5, 2.6, 2.2); _bt.set(6, 1.0, 0); fov=50; sm=4; break;
    case "entry": _bw.set(3, 2.4, -BOG_W/2-4.2); _bt.set(cx+1, 0.9, 0); fov=50; break;
    case "side": rel=true; ax=cx; _bw.set(-2, 5.2, -BOG_W/2-7.5); _bt.set(1.2, 0.6, 0); fov=48; sm=3; break;
    case "front": { var nose=V.position.x+(U.front||U.wb+1)*k, hw2=(U.width||2.4)*k/2;   /* never inside the truck: it backs off ahead of the nose, and stands clear of the side */
      _bw.set(Math.max(BOG.fixX, nose+2.2), Math.max(1.0, (U.top||2)*k*0.42), Math.max(2.4, hw2+1.1)); } _bt.set(cx, 1.3, 0); fov=38; BOG.shake=Math.max(BOG.shake, 0.04*clamp(+o.slip||0,0,1)); break;
    case "high": rel=true; ax=cx; _bw.set(-7, 9, 9); _bt.set(4, 0, -1); fov=46; sm=2; break;
    case "stop": { var dr=Math.min(3,T*0.25), fs=Math.max(1, bogFitDist(U, 40)/9.6); _bw.set(cx+(-7+dr)*fs, (3.2-dr*0.2)*Math.min(fs,1.3), (-7.5+dr*0.4)*fs); _bt.set(cx+1.2, 0.9, 0); fov=40; break; }
  }
  if(rel){ if(BOG.snap||!BOG.relOn){ _br.copy(_bw); _brt.copy(_bt); } else { var kk=1-Math.exp(-sm*dt); _br.lerp(_bw,kk); _brt.lerp(_bt,kk); }
    _bw.copy(_br); _bt.copy(_brt); _bw.x+=ax; _bt.x+=ax; BOG.relOn=true; } else BOG.relOn=false;
  if(BOG.snap){ BOG.fov=fov; BOG.snap=false; BOG.camTgt.copy(_bt); } else BOG.fov+=(fov-BOG.fov)*(1-Math.exp(-6*dt));
  BOG.camPos.copy(_bw); if(rel) BOG.camTgt.copy(_bt); else BOG.camTgt.lerp(_bt, 1-Math.exp(-8*dt));
  BOG.shake*=Math.exp(-dt*3.5); var sh=CALM?0:BOG.shake; if(sh>0.002){ BOG.camPos.x+=(Math.random()-0.5)*sh*0.25; BOG.camPos.y+=(Math.random()-0.5)*sh*0.25; }
  var cam=BOG.cam; cam.position.copy(BOG.camPos); cam.lookAt(BOG.camTgt); cam.fov=BOG.fov; cam.updateProjectionMatrix(); bandLens(cam);
}
function bogComposer(){
  if(BOG.composer===false) return null;
  var sz=renderer.getSize(new THREE.Vector2()), pr=renderer.getPixelRatio(), C=ultraComposerKeep(BOG.composer);
  if(!C){ try{ C=ultraComposerMark(new THREE.EffectComposer(renderer, ultraRT())); C.addPass(ultraRenderPass(BOG.scene, BOG.cam, "bog"));
      var bp=new THREE.UnrealBloomPass(new THREE.Vector2(Math.max(1,sz.x*pr/2), Math.max(1,sz.y*pr/2)), 0.3, 0.4, 0.9); C.addPass(bp); BOG.bloom=bp;
      if(THREE.GammaCorrectionShader) C.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
      BOG.composer=C; BOG.cSize=""; }catch(e){ BOG.composer=false; return null; } }
  var key=sz.x+"x"+sz.y+"@"+pr; if(BOG.cSize!==key){ if(C.setPixelRatio) C.setPixelRatio(pr); C.setSize(sz.x, sz.y); BOG.cSize=key; }
  var n=!!BOG.night, b=BOG.bloom; b.strength=n?0.6:0.22; b.threshold=n?0.72:0.92; b.radius=n?0.5:0.4;
  return C;
}
function bogRender(){
  var S3=BOG.scene, cam=BOG.cam; if(!S3||!cam) return;
  var C=(GFX!=="lite" && THREE.EffectComposer && THREE.UnrealBloomPass && THREE.RenderPass && THREE.ShaderPass) ? bogComposer() : null;
  if(C) S3.fog.color.copy(BOG.horLin); else S3.fog.color.copy(BOG.horLin).convertLinearToSRGB();
  BOG.sky.position.copy(cam.position);
  [BOG.fx, BOG.fxSpray].forEach(function(F){ if(F) F.mat.uniforms.uFog.value.copy(BOG.horLin); });
  var ex=renderer.toneMappingExposure; renderer.toneMappingExposure=BOG.exposure;
  var inf=renderer.info, ar=inf.autoReset; inf.autoReset=false; inf.reset();
  if(C) C.render(); else renderer.render(S3, cam);
  BOG.stats={calls:inf.render.calls, tris:inf.render.triangles, tier:GFX, shot:BOG.shot, parts:BOG.fx.P.length+(BOG.fxSpray?BOG.fxSpray.P.length:0)}; inf.autoReset=ar;
  renderer.toneMappingExposure=ex;
}
function bogReset(){
  [BOG.fx, BOG.fxSpray].forEach(function(F){ if(F) F.clear(); }); bogFxReset();
  BOG.vsF=BOG.vsR=0; BOG.outX=0; BOG.outV=null; BOG.bellyA=0; BOG.holeDone=false; if(BOG.cur) BOG.cur.userData.mudLine=0;
  BOG.shot=null; BOG.prev={}; BOG.vsink=0; BOG.shake=0; BOG.cheer=0; BOG.skip=false; BOG.doneT=0; BOG.splash=0; BOG.coat=0; BOG.pitch=0; BOG.pv=0; BOG.lastHz=0;
  if(BOG.crowd && BOG.crowd.live){ BOG.cheer=0; bogCrowd(0); }
  if(BOG.cur){ var U=BOG.cur.userData; if(U.paint0) U.mats.paint.color.copy(U.paint0); }
  bogMudReset();
}
function bogUpdate(o, dt){
  if(!BOG.built) buildBogScene();
  var S3=BOG.scene; BOG.t+=dt;
  if(BOG.tier!==GFX || BOG.night!==!!o.night){ var tc=BOG.tier!==GFX; bogSetNight(!!o.night); if(tc){ BOG.mudKey=""; bogFxBuild(S3, GFX==="lite"); } }
  var ph=o.phase||"stage";
  if(ph==="stage" && BOG.prev.phase && BOG.prev.phase!=="stage") bogReset();
  var cls=BOG_LOOK[o.cls]?o.cls:"street", ty=o.tyre||"mt", col=o.color!=null?o.color:BOG_LOOK[cls].col, hwk=bogTruckHw(), vk=cls+":"+ty+":"+col+":"+hwk+(GFX==="lite"?":l":"");
  if(!BOG.veh[vk]){ BOG.veh[vk]=bogVehicle(cls, ty, col, hwk); S3.add(BOG.veh[vk]); }
  for(var kk in BOG.veh) BOG.veh[kk].visible=(kk===vk);
  var V=BOG.veh[vk], U=V.userData, k=U.k||1; if(BOG.cur!==V){ BOG.cur=V; } pullLivery(U);
  if(o.pit) bogMudBuild(o.pit, U.trR*k);   /* after the truck: the fine rut rows follow its track */
  var x=+o.x||0, v=Math.max(0,+o.v||0), slip=clamp(+o.slip||0,0,1), sink=clamp(+o.sink||0,0,1.4), len=+o.len||(o.pit&&o.pit.len)||70, i;
  if(ph==="done") BOG.doneT+=dt;
  if(ph==="pit" && BOG.prev.phase==="runup"){ BOG.splash=Math.max(BOG.splash, 0.6+Math.min(1,v/12)); BOG.cheer=Math.max(BOG.cheer,1.2); BOG.shake=Math.max(BOG.shake,0.12); }
  if(o.cleared && !BOG.prev.cleared){ BOG.cheer=2.4; }
  if(ph==="done" && BOG.prev.phase==="pit" && !o.cleared) BOG.cheer=Math.max(BOG.cheer,0.8);
  if((+o.slap||0)>0){ BOG.splash=Math.max(BOG.splash, Math.min(1.5,+o.slap)); BOG.shake=Math.max(BOG.shake, 0.08*Math.min(1.5,+o.slap)); }
  /* the truck: front axle at x, each axle on the pit's own level (dug in below the fairground, up on a ridge's crown), sunk by
     the sim's sinkage scaled to the drawn tyre, deeper where it dug; thrown by its bounce. Stopped, the look says why:
     bogged sits mid-tyre in level mud, high-centred sits its frame on a crown of mud, dug in is buried to the axles in its
     holes, and a truck that cleared rolls on out onto dry ground. */
  var R=U.rr*k, why=o.why||"", stopped=ph==="done"&&!o.cleared&&x>0&&x<len, sk=R/((+o.rw)||(BOG_TYRE_IN[cls]||35)*0.0254/2), dig=clamp(+o.dig||0,0,1.5), bel=clamp(+o.belly||0,0,1), cons=BOG.pit?BOG.pit.cons:0.5;
  if(o.cleared && ph==="done"){ if(BOG.outV==null) BOG.outV=Math.max(2.5,v); BOG.outV=Math.max(0,BOG.outV-2.6*dt); BOG.outX=Math.min(6.5,(BOG.outX||0)+BOG.outV*dt); } else { BOG.outV=null; BOG.outX=0; }
  var xF=x+BOG.outX, xR=xF-U.wb*k, vs=Math.min(R*0.8, sink*sk+dig*0.28*R), vF=vs, vR=vs;
  if(stopped){ if(why==="dug"){ vR=R*0.98; vF=Math.max(vs,R*0.82); } else if(why==="highcentre"){ vR=vF=clamp(vs,R*0.55,R*0.72); } else { vR=clamp(vs,R*0.48,R*0.75); vF=clamp(vs*0.9,R*0.42,R*0.68); } }
  vF*=bogPitRamp(xF); vR*=bogPitRamp(xR);
  var kv=Math.min(1,dt*5); BOG.vsF=(BOG.vsF||0)+(vF-(BOG.vsF||0))*kv; BOG.vsR=(BOG.vsR||0)+(vR-(BOG.vsR||0))*kv; BOG.vsink=Math.max(BOG.vsF,BOG.vsR);
  var rmx=Math.max(0.05,BOG.pit?BOG.pit.rmax:0.3), rgF=bogPitHz(xF,"bump")*bogPitRamp(xF), rgR=bogPitHz(xR,"bump")*bogPitRamp(xR);
  var yF=bogPitLevel(xF)+0.02+rgF-BOG.vsF*(1-0.6*rgF/rmx), yR=bogPitLevel(xR)+0.02+rgR-BOG.vsR*(1-0.6*rgR/rmx);
  V.position.set(xR, yR+Math.max(0,+o.y||0), 0);
  var tgt=clamp(-(+o.vy||0)*0.05, -0.12, 0.14)+clamp((+o.dRear||0)-(+o.dFront||0),-0.4,0.4)*0.25+0.01*slip*(ph==="pit"?1:0)+(ph!=="stage"&&ph!=="done"?Math.sin(BOG.t*8.0)*0.006*slip:0)+Math.atan2(yF-yR, U.wb*k);
  var n=Math.min(8, Math.ceil(dt/0.01)), h=n?dt/n:0, om=7, ze=0.35;
  for(i=0;i<n;i++){ BOG.pv+=(om*om*(tgt-BOG.pitch)-2*ze*om*BOG.pv)*h; BOG.pitch+=BOG.pv*h; }
  BOG.roll+=((ph==="pit"?Math.sin(BOG.t*3.1)*0.02*slip+Math.sin(BOG.t*1.3)*0.012*sink:0)+(stopped&&why==="highcentre"?0.035:0)-BOG.roll)*Math.min(1,dt*4);
  U.pivot.rotation.z=BOG.pitch; U.pivot.rotation.x=BOG.roll; U.pivot.position.y=U.rr+Math.sin(BOG.t*(+o.rpm||800)/60*1.3)*0.002;
  var ws=Math.max(v,+o.wspd||0), wr=ws/(U.rr*k);
  for(i=0;i<U.wheelsR.length;i++){ var sp=U.wheelsR[i]; sp.rotation.y=(sp.rotation.y-wr*dt)%TAU; }
  for(i=0;i<U.wheelsF.length;i++){ var sf=U.wheelsF[i]; sf.rotation.y=(sf.rotation.y-wr*dt)%TAU; }
  /* the mud coat: a splatter mask on every material, bottom up (vis/bog-fx.js) */
  bogCoatUpdate(o, dt, V);
  V.updateMatrixWorld(true);
  /* the mud round the truck (vertex shader): a collar heaped round each tyre as it sinks, a bow ahead of the fronts at speed;
     a crown pushed up under the frame when it sits down on the mud */
  var TY=BOG.mudU&&BOG.mudU.uTy.value, air=clamp((+o.y||0)/0.15,0,1), bow=ph==="pit"?clamp(v/9,0,1)*0.08:0, xc=xR+U.wb*k*0.5;
  var hcW=(stopped&&why==="highcentre")?1:(ph==="pit"?clamp((bel-0.3)/0.4,0,1):0), need=Math.max(0, V.position.y+bogFrameY(U)+0.03-bogPitLevel(xc))*hcW*bogPitRamp(xc);
  BOG.bellyA=(BOG.bellyA||0)+(need-(BOG.bellyA||0))*Math.min(1,dt*3);
  if(TY){ for(i=0;i<4;i++){ var ax=i<2?xF:xR, va=i<2?BOG.vsF:BOG.vsR, ca=(clamp(va*0.4,0,0.22)*(0.6+0.6*cons)+(i<2?bow:bow*0.35))*bogPitRamp(ax)*(1-air)*(1-0.7*clamp(bogPitHz(ax,"bump")/0.1,0,1));
      TY[i].set(ax, (i&1?1:-1)*U.trR*k, ca, U.wr*k*0.5+0.16); }
    BOG.mudU.uTyR.value=R*0.95; BOG.mudU.uBelly.value.set(xc, U.wb*k*0.42, BOG.bellyA, U.trR*k*0.5); BOG.mudU.uTime.value=BOG.t;
    U.mudLine=Math.max(U.mudLine||0, BOG.vsink+TY[3].z); }   /* the high-water mark up the tyres (m above the contact), for the mud coat */
  /* ruts and tracks: where the tyres have been */
  if(BOG.mud && x>0 && (ph==="pit"||ph==="done")){
    var rx=Math.min(x, len), half=U.trR*k, tw=U.wr*k*0.95, dep=clamp(0.05+sink*0.4,0.05,0.4);
    if(rx-BOG.paintX>0.4 || (ph==="done"&&BOG.paintX<rx-0.01)){ var from=Math.max(0,BOG.paintX<-1e8?0:BOG.paintX); bogMudTrack(from-0.2, rx, half, tw, clamp(slip+sink,0,1)); BOG.paintX=rx; }
    if(GFX!=="lite" && ph==="pit"){ var dF=clamp(BOG.vsF*(0.22+0.5*cons)+0.03+dig*0.08,0.03,0.42), dR=clamp(BOG.vsR*(0.22+0.5*cons)+0.05+dig*0.1,0.04,0.45), lp=0.25+0.6*cons;
      for(i=0;i<4;i++) bogMudRut(i, (i<2?xF:xR)-R*0.55, (i&1?1:-1)*half, tw, i<2?dF:dR, (i<2?dF:dR)*lp); }
    if(stopped && why==="dug" && !BOG.holeDone){ BOG.holeDone=true; for(i=0;i<4;i++) bogPitHole(i<2?xF:xR, (i&1?1:-1)*half, R*0.95, tw, (i<2?0.25:0.4)*R); }
  }
  bogPitFlush(); bogPitTexFlush();   /* just the columns the ruts touched, just the strip of map the tracks painted */
  bogEffects(o, dt, V);
  bogCrowd(dt);
  bogDirect(o, dt, V);
  var c=_pC.copy(BOG.camPos).lerp(BOG.camTgt, 0.6); c.y=0;
  BOG.sun.position.copy(c).addScaledVector(BOG.sunDir, 120); BOG.sun.target.position.copy(c); BOG.sun.target.updateMatrixWorld();
  if(BOG.flood.intensity>0){ BOG.flood.position.set(c.x-20, 60, 40); BOG.flood.target.position.copy(c); BOG.flood.target.updateMatrixWorld(); }
  if(BOG.spots.length){ var poles=BOG.poles.slice().sort(function(a,b){ return Math.abs(a.x-c.x)-Math.abs(b.x-c.x); });
    BOG.spots.forEach(function(sp,j){ var pp=poles[j]; if(!pp) return; sp.position.copy(pp); sp.target.position.set(lerp(pp.x,c.x,0.5), 0, 0); sp.target.updateMatrixWorld(); }); }
  bogTruckFrame(V, o, dt);   /* blob shadow on the ground, the flagman, night spots off the run-up (vis/bog-trucks.js) */
  BOG.prev={phase:ph, cleared:!!o.cleared};
}

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
/* chrome: a banded "reflection" across u so a stack reads as polished metal, not a white tube */
function bogtChromeTex(){
  if(BOGT.tex.chrome) return BOGT.tex.chrome;
  var c=newCanvas(128,4), x=c.getContext("2d"), g=x.createLinearGradient(0,0,128,0);
  [[0,"#8a929b"],[0.1,"#ffffff"],[0.17,"#c4cad1"],[0.3,"#5e646c"],[0.42,"#eef1f4"],[0.5,"#ffffff"],[0.58,"#aab1b9"],[0.7,"#565b62"],[0.82,"#e2e6ea"],[0.92,"#ffffff"],[1,"#8a929b"]].forEach(function(s){ g.addColorStop(s[0],s[1]); });
  x.fillStyle=g; x.fillRect(0,0,128,4); return (BOGT.tex.chrome=ctex(c));
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
  return (BOGT.tex[key]=ctex(c));
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
    var nut=BOGT.geo.nut||(BOGT.geo.nut=new THREE.CylinderGeometry(0.012,0.012,0.024,6)); for(i=0;i<(lite?0:6);i++){ var b2=i/6*TAU; parts.push({g:nut, m:mkM(Math.cos(b2)*rimR*0.27, dishY+0.022, Math.sin(b2)*rimR*0.27)}); }
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
  var bin=sc_bin(), bx=BOGT.geo.box||(BOGT.geo.box=new THREE.BoxGeometry(1,1,1)), tk=lite?"l":"f", cy=BOGT.geo["cyl"+tk]||(BOGT.geo["cyl"+tk]=new THREE.CylinderGeometry(0.5,0.5,1,lite?8:12)),
      cy6=BOGT.geo["cyl6"+tk]||(BOGT.geo["cyl6"+tk]=new THREE.CylinderGeometry(0.5,0.5,1,lite?5:7)), sp=BOGT.geo["sph"+tk]||(BOGT.geo["sph"+tk]=new THREE.SphereGeometry(0.5,lite?8:12,lite?6:8)), i, s;
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
      for(i=0;i<xs.length;i++){ var xx=xs[i]; rod("tube",[xx,yl,s*0.42],[xx,yu-(xx>2?0.03:0),s*(xx<1.6?(xx<0?0.5:0.53):0.47)],0.03); if(i<xs.length-1 && (!lite || (i&1))) rod("tube",[xx,yl,s*0.42],[xs[i+1],yu,s*0.5],0.026); }
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
    for(s=-1;s<=1;s+=2) for(i=0;i<(lite?2:4);i++){ var hx=1.85+i*(lite?0.34:0.17); rod("chrome",[hx,1.3,s*0.3],[hx+0.02,1.42,s*0.58],0.028,true); rod("chrome",[hx+0.02,1.42,s*0.58],[hx-0.32,2.05,s*0.66],0.028,true);
      if(!diesel && (i===0||i===2||(lite&&i===1))){ U.tips.push(new THREE.Vector3(hx-0.34,2.08,s*0.66)); U.dirs.push(new THREE.Vector3(-0.45,1,s*0.1).normalize()); } }
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
  U.frameY=cls==="street"?0.58:0.96;   /* frame rail bottoms above the contact patch: the belly / high-centre test (bogFrameY) */
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
  x.fillStyle=gr; x.fillRect(0,0,64,64); return (BOGT.tex.blob=ctex(c, false));
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
  if(U.blob){ var gy=(typeof bogPitLevel==="function"?bogPitLevel(x-U.wb/2):(x>-0.3&&x-U.wb<len+0.3?-0.07:-0.02))+0.03; U.blob.position.y=gy-V.position.y;   /* on the dug mud (vis/bog-pit.js) or the run-up */
    var lite=GFX==="lite"; if(U.blob.userData.lite!==lite){ U.blob.userData.lite=lite; U.blob.material.opacity=lite?0.62:0.34; }
    U.blob.material.opacity=(lite?0.62:0.34)*clamp(1-Math.max(0,+o.y||0)*1.4,0.25,1); }
  if(BOGT.flagman){ var F=BOGT.flagman;
    if(ph==="stage"){ if(BOGT.startX===null || BOG.prev.phase!=="stage") BOGT.startX=x; }
    var sx=BOGT.startX===null?x:BOGT.startX; F.position.set(sx+5.2, 0, -5.4);
    BOGT.poseT+=dt; var pose=ph==="stage"?((BOGT.poseT%0.7)<0.35?0:1):(ph==="runup"&&x<sx+12?2:3);
    if(pose!==BOGT.pose){ BOGT.pose=pose; F.geometry=F.userData.poses[pose]; } }
  if(BOG.night){ var cxm=BOG.camTgt.x, kk=lerp(0.5,1,clamp((cxm+6)/14,0,1)); BOG.spots.forEach(function(s2){ s2.intensity=1.6*kk; }); BOG.flood.intensity=(GFX==="lite"?0.6:0.28)*lerp(0.7,1,kk); }   /* the light dirt run-up blew out under the poles */
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
    var n=lite?(i%2===0?1:0):1+Math.floor(rng(i+20)*2.6);
    for(k=0;k<n;k++) person(hx-2.3+k*0.62, bedY, hz+(rng(i*7+k)-0.5)*0.9, false, i*13+k);
    if(!lite || i%3===0) flag(hx-2.45, bedY, hz+0.7, 2.6+rng(i+9), fl[i%fl.length][0], fl[i%fl.length][1]);
    /* tailgate party in front of the truck, facing the pit */
    if(!lite && (i&1)===(i>5?1:0)){ chair(hx-1.2, 0.6, hz+2.6, i%2?0x2c6b3a:0x34598f, 0); person(hx-1.2, 0.6, hz+2.68, true, i*31); chair(hx-0.3, 0.6, hz+2.7, 0x9e2a22, 0.2); person(hx-0.3, 0.6, hz+2.78, true, i*37);
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
  })(-9.5, BOG_W/2+5.6);   /* by the start, clear of the far berm (vis/bog-pit.js bogPitBerms starts at x=-6) */
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
/* ===========================================================================
   MUD BOG FX — the bog's own mud: lit clods stretched along their flight and soft spray (one instanced draw call),
   mud sheets (the rooster-tail fans behind the rear tyres, the wall thrown up at pit entry, the bow-wave mound
   ahead of the front tyres: one dynamic mesh, Full/Ultra), mud splats on the rail, banners and front rows (Full/Ultra),
   mud on the lens of a low camera (Full/Ultra) and the mud coat on the truck: every MeshStandardMaterial on the
   truck is swapped for a per-truck clone with a splatter mask that builds from the bottom up (lugs pack on the tyres).
   Fed from bogEffects / bogUpdate in vis/bog.js; nothing here touches the sim.
   ==========================================================================*/
var BOGFX={ mudY:0, len:70, sheet:null, decal:null, decN:0, decI:0, lens:null, lensP:[], crown:null, splatTex:null, puffTex:null, sheetTex:null, mudKey:"",
  crowdC:null, sunC:new THREE.Color(1,1,1), ambC:new THREE.Color(0.3,0.3,0.3), t:0, tailA:0, bowA:0, lensT:0 };
var _bfA=new THREE.Vector3(), _bfM=new THREE.Matrix4(), _bfQ=new THREE.Quaternion(), _bfS=new THREE.Vector3(), _bfE=new THREE.Euler(), _bfC=new THREE.Color(), _bfZ=new THREE.Vector3(0,0,1);
/* --- textures --- */
function bogFxPuffTex(){
  var c=newCanvas(128,128), x=c.getContext("2d"), i;
  for(i=0;i<18;i++){ var a=Math.random()*TAU, r=Math.random()*26, px=64+Math.cos(a)*r, py=64+Math.sin(a)*r, rad=18+Math.random()*20;
    var g=x.createRadialGradient(px,py,0,px,py,rad); g.addColorStop(0,"rgba(255,255,255,0.3)"); g.addColorStop(1,"rgba(255,255,255,0)"); x.fillStyle=g; x.fillRect(0,0,128,128); }
  x.globalCompositeOperation="destination-in"; var g2=x.createRadialGradient(64,64,8,64,64,63); g2.addColorStop(0,"rgba(0,0,0,1)"); g2.addColorStop(1,"rgba(0,0,0,0)"); x.fillStyle=g2; x.fillRect(0,0,128,128);
  return new THREE.CanvasTexture(c);
}
/* a splat: a dense blob, lobes, flung droplets and a couple of runs */
function bogFxSplatTex(){
  var c=newCanvas(128,128), x=c.getContext("2d"), i, R=Math.random;
  x.fillStyle="rgba(255,255,255,1)";
  function blob(px,py,r){ x.beginPath(); x.arc(px,py,r,0,TAU); x.fill(); }
  blob(64,64,22);
  for(i=0;i<14;i++){ var a=R()*TAU, d=14+R()*14; blob(64+Math.cos(a)*d, 64+Math.sin(a)*d, 6+R()*9); }
  for(i=0;i<30;i++){ var a2=R()*TAU, d2=30+R()*30; blob(64+Math.cos(a2)*d2, 64+Math.sin(a2)*d2, 1+R()*3.5); }
  for(i=0;i<3;i++){ var dx=44+R()*40; x.fillRect(dx-2.5, 70, 5, 20+R()*34); blob(dx, 90+R()*20, 4); }
  var t=new THREE.CanvasTexture(c); return t;
}
/* the sheets: streaky splatter, the streaks along v (the flow); alpha = mud, rgb = a little shading */
function bogFxSheetTex(){
  var W=128, H=256, c=newCanvas(W,H), x=c.getContext("2d"), i, R=Math.random;
  x.clearRect(0,0,W,H);
  /* a dense body first (the sheet reads as a mass of mud, not a curtain of streaks), the streaks over it */
  for(i=0;i<90;i++){ var bx=R()*W, by=R()*H, br=6+R()*12, bs=110+Math.floor(R()*50); x.fillStyle="rgba("+bs+","+bs+","+bs+",0.55)"; x.beginPath(); x.ellipse(bx,by,br,br*(1.5+R()*2),0,0,TAU); x.fill();
    if(bx<br) { x.beginPath(); x.ellipse(bx+W,by,br,br*2,0,0,TAU); x.fill(); } if(bx>W-br){ x.beginPath(); x.ellipse(bx-W,by,br,br*2,0,0,TAU); x.fill(); } }
  for(i=0;i<420;i++){ var px=R()*W, py=R()*H, rw=1+R()*4.5, rh=rw*(2+R()*6), sh=120+Math.floor(R()*100), al=0.65+R()*0.35;
    x.fillStyle="rgba("+sh+","+sh+","+sh+","+al.toFixed(2)+")"; x.beginPath(); x.ellipse(px,py,rw,rh,0,0,TAU); x.fill();
    if(px<rw*2){ x.beginPath(); x.ellipse(px+W,py,rw,rh,0,0,TAU); x.fill(); } if(px>W-rw*2){ x.beginPath(); x.ellipse(px-W,py,rw,rh,0,0,TAU); x.fill(); } }
  var t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}
/* --- particles: kind 0 = a clod (a lit, wet sphere stretched along its screen motion), kind 1 = spray / smoke (soft) --- */
function BogParts(cap){
  this.cap=cap; this.P=[];
  var q=new THREE.PlaneGeometry(1,1), g=new THREE.InstancedBufferGeometry();
  g.setIndex(q.index); g.setAttribute("position", q.attributes.position); g.setAttribute("uv", q.attributes.uv);
  this.aPos=new THREE.InstancedBufferAttribute(new Float32Array(cap*3),3); this.aVel=new THREE.InstancedBufferAttribute(new Float32Array(cap*3),3);
  this.aSz=new THREE.InstancedBufferAttribute(new Float32Array(cap),1); this.aCol=new THREE.InstancedBufferAttribute(new Float32Array(cap*4),4);
  this.aRot=new THREE.InstancedBufferAttribute(new Float32Array(cap),1); this.aKind=new THREE.InstancedBufferAttribute(new Float32Array(cap),1);
  var me=this; [this.aPos,this.aVel,this.aSz,this.aCol,this.aRot,this.aKind].forEach(function(a){ a.setUsage(THREE.DynamicDrawUsage); });
  g.setAttribute("iPos",this.aPos); g.setAttribute("iVel",this.aVel); g.setAttribute("iSz",this.aSz); g.setAttribute("iCol",this.aCol); g.setAttribute("iRot",this.aRot); g.setAttribute("iKind",this.aKind); g.instanceCount=0;
  this.geo=g;
  if(!BOGFX.puffTex) BOGFX.puffTex=bogFxPuffTex();
  this.mat=new THREE.ShaderMaterial({ uniforms:{ map:{value:BOGFX.puffTex}, uFog:{value:new THREE.Color(0.5,0.6,0.7)}, uFogN:{value:150}, uFogF:{value:2700}, uAmb:{value:1},
      uSun:{value:new THREE.Vector3(0,1,0)}, uSunC:{value:BOGFX.sunC}, uAmbC:{value:BOGFX.ambC}, uBlur:{value:0.018} },
    vertexShader:["attribute vec3 iPos; attribute vec3 iVel; attribute float iSz; attribute vec4 iCol; attribute float iRot; attribute float iKind;",
      "uniform vec3 uSun; uniform float uBlur;",
      "varying vec2 vUv; varying vec4 vCol; varying float vDepth; varying float vKind; varying vec3 vL; varying float vShade;",
      "void main(){ vec4 mv=modelViewMatrix*vec4(iPos,1.0); vec2 q=position.xy; vec2 d=vec2(1.0,0.0); float len=iSz;",
      " if(iKind<0.5){ vec3 vv=(modelViewMatrix*vec4(iVel,0.0)).xyz; float sp=length(vv.xy); if(sp>0.01) d=vv.xy/sp; len=iSz+min(sp*uBlur, iSz*3.0); }",
      " else { d=vec2(cos(iRot),sin(iRot)); }",
      " vec2 pp=vec2(-d.y,d.x); mv.xy+=d*q.x*len+pp*q.y*iSz;",
      " gl_Position=projectionMatrix*mv; vUv=uv; vCol=iCol; vDepth=-mv.z; vKind=iKind; vShade=position.y+0.5;",
      " vL=vec3(dot(uSun.xy,d), dot(uSun.xy,pp), uSun.z); }"].join("\n"),
    fragmentShader:["uniform sampler2D map; uniform vec3 uFog; uniform float uFogN; uniform float uFogF; uniform vec3 uSunC; uniform vec3 uAmbC;",
      "varying vec2 vUv; varying vec4 vCol; varying float vDepth; varying float vKind; varying vec3 vL; varying float vShade;",
      "void main(){ vec3 col; float a;",
      " if(vKind<0.5){ vec2 c=vUv*2.0-1.0; float r2=dot(c,c); if(r2>1.0) discard; vec3 n=vec3(c*0.9, sqrt(max(0.0,1.0-r2*0.81)));",
      "  vec3 L=normalize(vL); float dif=max(0.0,dot(n,L)); vec3 h=normalize(L+vec3(0.0,0.0,1.0)); float spc=pow(max(0.0,dot(n,h)),28.0)*0.5;",
      "  col=vCol.rgb*(uAmbC*(0.55+0.45*n.z)+uSunC*dif)+uSunC*spc*0.25; a=vCol.a*smoothstep(1.0,0.82,r2); }",
      " else { vec4 t=texture2D(map,vUv); a=t.a*vCol.a; col=vCol.rgb*(uAmbC+uSunC*(0.25+0.45*vShade)); }",
      " a*=smoothstep(0.3,1.6,vDepth); float f=smoothstep(uFogN,uFogF,vDepth); col=mix(col,uFog,f);",
      " if(a<0.004) discard;",
      " gl_FragColor=linearToOutputTexel(vec4(col,a)); }"].join("\n"),
    transparent:true, depthWrite:false, blending:THREE.NormalBlending });
  this.mesh=new THREE.Mesh(g,this.mat); this.mesh.frustumCulled=false; this.mesh.renderOrder=7;
  this.mesh.onBeforeRender=function(r,s,cam){ var u=me.mat.uniforms.uSun.value; u.copy(BOG.night?_bfA.set(0.25,1,0.35):BOG.sunDir||_bfA.set(0.3,1,0.2)).transformDirection(cam.matrixWorldInverse); };
}
/* o: {drag, grav, buoy, fin, spin, kind (0 clod, 1 soft), lob (a long throw toward the crowd side)} */
BogParts.prototype.emit=function(x,y,z, vx,vy,vz, life, s0,s1, r,g,b,a, o){
  if(this.P.length>=this.cap) this.P.shift();
  o=o||{};
  this.P.push({x:x,y:y,z:z,vx:vx,vy:vy,vz:vz,t:0,life:life,s0:s0,s1:s1,r:r,g:g,b:b,a:a,rot:Math.random()*TAU,vr:(Math.random()-0.5)*(o.spin===undefined?0.7:o.spin),
    drag:o.drag===undefined?0.2:o.drag, buoy:o.buoy||0, grav:o.grav===undefined?9.8:o.grav, fin:o.fin===undefined?0.02:o.fin, kind:o.kind||0, lob:!!o.lob});
};
BogParts.prototype.clear=function(){ this.P.length=0; this.geo.instanceCount=0; };
BogParts.prototype.step=function(dt, wind){
  var P=this.P, i, n=0, railZ=-BOG_W/2-3.55;
  for(i=0;i<P.length;i++){ var p=P[i]; p.t+=dt; if(p.t>=p.life) continue;
    var k=Math.min(1,p.drag*dt), z0=p.z;
    if(p.kind===1){ p.vx+=(wind.x-p.vx)*k; p.vz+=(wind.z-p.vz)*k; } else { p.vx-=p.vx*k; p.vz-=p.vz*k; }
    p.vy+=(p.buoy-p.grav)*dt-p.vy*k*0.4;
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt; p.rot+=p.vr*dt;
    if(p.lob && z0>railZ && p.z<=railZ){ if(bogFxHitRail(p.x, p.y, railZ)) continue; }
    if(p.lob && p.z<railZ-0.9 && p.y<1.9){ bogFxHitCrowd(p.x, p.z); continue; }
    var gy=(p.x>0 && p.x<BOGFX.len && Math.abs(p.z)<BOG_W/2)?BOGFX.mudY:0;   /* the mud sits below the fairground */
    if(p.y<gy+0.03){ if(p.kind===0 && p.vy<0) continue; p.y=gy+0.03; if(p.vy<0) p.vy=0; }
    P[n++]=p; }
  P.length=n;
  var pos=this.aPos.array, vel=this.aVel.array, sz=this.aSz.array, col=this.aCol.array, rot=this.aRot.array, kd=this.aKind.array;
  for(i=0;i<n;i++){ p=P[i]; var f=p.t/p.life, e=1-Math.pow(1-f,2.2);
    pos[i*3]=p.x; pos[i*3+1]=p.y; pos[i*3+2]=p.z; vel[i*3]=p.vx; vel[i*3+1]=p.vy; vel[i*3+2]=p.vz; sz[i]=p.s0+(p.s1-p.s0)*e; rot[i]=p.rot; kd[i]=p.kind;
    col[i*4]=p.r; col[i*4+1]=p.g; col[i*4+2]=p.b; col[i*4+3]=p.a*Math.min(1,f/Math.max(0.001,p.fin))*(p.kind===0?1-Math.pow(f,6):Math.pow(1-f,1.35)); }
  this.geo.instanceCount=n;
  this.aPos.needsUpdate=this.aVel.needsUpdate=this.aSz.needsUpdate=this.aCol.needsUpdate=this.aRot.needsUpdate=this.aKind.needsUpdate=true;
};
/* --- sheets: slots of cols x rows grids in one dynamic mesh; position, alpha and erosion written per frame --- */
function BogSheet(slots){
  var nv=0, idx=[], me=this; this.slots=slots;
  slots.forEach(function(s){ s.base=nv; s.on=false; s.dirty=true;
    for(var r=0;r<s.rows-1;r++) for(var c=0;c<s.cols-1;c++){ var a=s.base+r*s.cols+c, b=a+1, d=a+s.cols, e=d+1; idx.push(a,d,b, b,d,e); }
    nv+=s.cols*s.rows; });
  var g=new THREE.BufferGeometry(); this.nv=nv;
  this.pos=new THREE.BufferAttribute(new Float32Array(nv*3),3); this.uv=new THREE.BufferAttribute(new Float32Array(nv*2),2);
  this.aA=new THREE.BufferAttribute(new Float32Array(nv),1); this.aE=new THREE.BufferAttribute(new Float32Array(nv),1);
  [this.pos,this.uv,this.aA,this.aE].forEach(function(a){ a.setUsage(THREE.DynamicDrawUsage); });
  g.setAttribute("position",this.pos); g.setAttribute("uv",this.uv); g.setAttribute("aA",this.aA); g.setAttribute("aE",this.aE); g.setIndex(idx);
  g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(nv*3),3));
  this.geo=g;
  if(!BOGFX.sheetTex) BOGFX.sheetTex=bogFxSheetTex();
  var m=new THREE.MeshStandardMaterial({color:0x3a2a1c, map:BOGFX.sheetTex, transparent:true, depthWrite:false, side:THREE.DoubleSide, roughness:0.75, metalness:0, envMapIntensity:0.22});
  m.onBeforeCompile=function(sh){
    sh.vertexShader="attribute float aA; attribute float aE; varying float vMA; varying float vME;\n"+sh.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\n vMA=aA; vME=aE;");
    sh.fragmentShader="varying float vMA; varying float vME;\n"+sh.fragmentShader.replace("#include <map_fragment>",
      "#ifdef USE_MAP\n vec4 texelColor=texture2D(map,vUv); diffuseColor.rgb*=0.5+0.5*texelColor.rgb; diffuseColor.a*=smoothstep(vME,vME+0.14,texelColor.a)*vMA;\n if(diffuseColor.a<0.01) discard;\n#endif");
  };
  m.customProgramCacheKey=function(){ return "bog_sheet"; };
  this.mat=m; this.mesh=new THREE.Mesh(g,m); this.mesh.frustumCulled=false; this.mesh.renderOrder=6; this.mesh.visible=false;
}
BogSheet.prototype.set=function(s, c, r, x,y,z, a, e, u, v){
  var i=s.base+r*s.cols+c, P=this.pos.array, U=this.uv.array; P[i*3]=x; P[i*3+1]=y; P[i*3+2]=z; U[i*2]=u; U[i*2+1]=v; this.aA.array[i]=a; this.aE.array[i]=e;
};
BogSheet.prototype.off=function(s){ if(!s.on && !s.dirty) return; s.on=false; s.dirty=false; for(var i=s.base;i<s.base+s.cols*s.rows;i++){ this.aA.array[i]=0; this.pos.array[i*3+1]=-5; } this.touched=true; };
BogSheet.prototype.flush=function(){
  var any=this.slots.some(function(s){ return s.on; }); this.mesh.visible=any;
  if(!any && !this.touched) return; this.touched=false;
  this.pos.needsUpdate=this.uv.needsUpdate=this.aA.needsUpdate=this.aE.needsUpdate=true;
  if(any) this.geo.computeVertexNormals();
};
/* --- build / tier / reset --- */
function bogFxBuild(S3, lite){
  if(BOG.fx){ S3.remove(BOG.fx.mesh); BOG.fx.geo.dispose(); BOG.fx.mat.dispose(); }
  BOG.fx=new BogParts(lite?150:700); BOG.fxSpray=null; S3.add(BOG.fx.mesh);
  var U=BOG.fx.mat.uniforms; U.uFogN.value=S3.fog?S3.fog.near:150; U.uFogF.value=S3.fog?S3.fog.far:2700;
  if(!BOGFX.splatTex) BOGFX.splatTex=bogFxSplatTex();
  if(lite){ ["sheet","decal","lens"].forEach(function(k){ if(BOGFX[k]) BOGFX[k].mesh.visible=false; }); return; }
  if(!BOGFX.sheet){ BOGFX.sheet=new BogSheet([{name:"tl",cols:7,rows:13},{name:"tr",cols:7,rows:13},{name:"crown",cols:17,rows:7},{name:"bow",cols:11,rows:6}]); }
  if(BOGFX.sheet.mesh.parent!==S3) S3.add(BOGFX.sheet.mesh);
  if(!BOGFX.decal){ var dm=new THREE.MeshStandardMaterial({map:BOGFX.splatTex, transparent:true, depthWrite:false, roughness:0.55, metalness:0, polygonOffset:true, polygonOffsetFactor:-3, polygonOffsetUnits:-3});
    var im=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1), dm, 48); im.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(48*3),3); im.count=0;   /* colour buffer at full size before count drops to 0 */ im.frustumCulled=false; im.renderOrder=3; BOGFX.decal={mesh:im}; }
  if(BOGFX.decal.mesh.parent!==S3) S3.add(BOGFX.decal.mesh);
  BOGFX.decal.mesh.visible=BOGFX.decN>0;
}
function bogFxReset(){
  if(BOG.fx) BOG.fx.clear();
  var Sh=BOGFX.sheet; if(Sh){ Sh.slots.forEach(function(s){ Sh.off(s); }); Sh.flush(); }
  BOGFX.crown=null; BOGFX.tailA=0; BOGFX.bowA=0; BOGFX.lensP.length=0; if(BOGFX.lens) BOGFX.lens.mesh.count=0;
}
/* splats on the rail / banners and on the front rows: cleared when the night's mud is rebuilt */
function bogFxClearSplats(){
  BOGFX.decN=0; BOGFX.decI=0; if(BOGFX.decal){ BOGFX.decal.mesh.count=0; BOGFX.decal.mesh.visible=false; }
  var C=BOG.crowd; if(C && BOGFX.crowdC && BOGFX.crowdC.body===C.body){ C.body.instanceColor.array.set(BOGFX.crowdC.b); C.head.instanceColor.array.set(BOGFX.crowdC.h); C.body.instanceColor.needsUpdate=C.head.instanceColor.needsUpdate=true; }
  BOGFX.crowdC=null;
}
function bogFxDecal(x, y, z, s){
  var D=BOGFX.decal; if(!D || GFX==="lite") return;
  var im=D.mesh, i=BOGFX.decI; BOGFX.decI=(i+1)%48; BOGFX.decN=Math.min(48, BOGFX.decN+1);
  _bfE.set(0,0,Math.random()*TAU); _bfQ.setFromEuler(_bfE); _bfM.compose(_bfA.set(x,y,z), _bfQ, _bfS.set(s,s*(0.8+Math.random()*0.5),1)); im.setMatrixAt(i,_bfM);
  var mc=BOGFX.mudC||[0.13,0.095,0.065], sh=0.8+Math.random()*0.5; im.setColorAt(i, _bfC.setRGB(mc[0]*sh*2.2, mc[1]*sh*2.2, mc[2]*sh*2.2));
  im.count=BOGFX.decN; im.instanceMatrix.needsUpdate=true; if(im.instanceColor) im.instanceColor.needsUpdate=true; im.visible=true;
}
/* a long throw crossing the rail line: a splat if it hits a banner or a pipe; returns true when it stops there */
function bogFxHitRail(x, y, z){
  var cx=-24+9*Math.round((x+24)/9);
  if(Math.abs(x-cx)<2.6 && x>-27 && x<104 && y>0.53 && y<1.12){ bogFxDecal(x, y, z+0.03, 0.4+Math.random()*0.5); return true; }
  if(Math.abs(y-1.08)<0.09 || Math.abs(y-0.6)<0.09){ bogFxDecal(x, y, z+0.02, 0.1+Math.random()*0.08); return true; }
  return false;
}
/* ... or reaching the front rows: the nearest few spectators get browned */
function bogFxHitCrowd(x, z){
  var C=BOG.crowd; if(!C || !C.body.instanceColor || GFX==="lite") return;
  if(!BOGFX.crowdC || BOGFX.crowdC.body!==C.body) BOGFX.crowdC={body:C.body, b:C.body.instanceColor.array.slice(), h:C.head.instanceColor.array.slice()};
  var B=C.body.instanceColor.array, H=C.head.instanceColor.array, mc=BOGFX.mudC||[0.13,0.095,0.065], hit=0;
  for(var i=0;i<C.n && hit<3;i++){ var p=C.base[i]; if(Math.abs(p[0]-x)>0.7 || p[2]<-BOG_W/2-7.2) continue;
    var k=0.6+Math.random()*0.25; for(var j=0;j<3;j++){ B[i*3+j]+= (mc[j]*1.4-B[i*3+j])*k; H[i*3+j]+=(mc[j]*1.4-H[i*3+j])*k*0.6; } hit++; }
  if(hit){ C.body.instanceColor.needsUpdate=C.head.instanceColor.needsUpdate=true; }
}
/* --- mud on the lens of a low camera near the truck (Full/Ultra) --- */
function bogFxLens(dt, frontX, rearX, amt, bow){
  var cam=BOG.cam; if(!cam || GFX==="lite") return;
  var L=BOGFX.lens;
  if(!L){ var m=new THREE.MeshBasicMaterial({map:BOGFX.splatTex, transparent:true, depthTest:false, depthWrite:false, fog:false, toneMapped:false});
    var im=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1), m, 10); im.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(10*3),3); im.count=0; im.frustumCulled=false; im.renderOrder=40; L=BOGFX.lens={mesh:im}; }
  if(L.mesh.parent!==cam) cam.add(L.mesh); if(cam.parent!==BOG.scene) BOG.scene.add(cam);
  if(BOGFX.lensShot!==BOG.shot){ BOGFX.lensShot=BOG.shot; BOGFX.lensP.length=0; }   /* a cut is another camera: a clean lens */
  var cp=cam.position, low=cp.y<1.9 && Math.abs(cp.z)<6.5, near=(cp.x>frontX-1 && cp.x<frontX+6)?bow:(cp.x<rearX && cp.x>rearX-7?amt*0.8:0);
  if(low && near>0.05){ var rate=near*3.2*dt; if(Math.random()<rate && BOGFX.lensP.length<10) BOGFX.lensP.push({x:(Math.random()-0.5)*1.7, y:(Math.random()-0.5)*1.4, s:0.12+Math.random()*0.26, t:0, life:2.2+Math.random()*2, r:Math.random()*TAU}); }
  var P=BOGFX.lensP, n=0, i, h=Math.tan(cam.fov*Math.PI/360)*0.4, asp=cam.aspect||1;
  for(i=0;i<P.length;i++){ var p=P[i]; p.t+=dt; if(p.t<p.life) P[n++]=p; } P.length=n;
  var mc=BOGFX.mudC||[0.13,0.095,0.065], lt=BOG.night?0.7:1.5;
  for(i=0;i<n;i++){ p=P[i]; var f=p.t/p.life, sl=Math.min(1,p.t*0.3);
    _bfE.set(0,0,p.r); _bfQ.setFromEuler(_bfE); _bfM.compose(_bfA.set(p.x*h*asp, (p.y-sl*0.06)*h, -0.4), _bfQ, _bfS.set(p.s*h, p.s*h*(1+sl*0.4), 1)); L.mesh.setMatrixAt(i,_bfM);
    var fa=1-Math.pow(f,3); L.mesh.setColorAt(i, _bfC.setRGB(mc[0]*lt*fa+(1-fa), mc[1]*lt*fa+(1-fa), mc[2]*lt*fa+(1-fa))); }
  L.mesh.material.opacity=0.92; L.mesh.count=n; L.mesh.visible=n>0; L.mesh.instanceMatrix.needsUpdate=true; if(L.mesh.instanceColor) L.mesh.instanceColor.needsUpdate=true;
}
/* --- the frame: rooster tails, the bow wave, splashes, spray and exhaust --- */
function bogFxUpdate(o, dt, V){
  var U=V.userData, FX=BOG.fx, Sh=GFX==="lite"?null:BOGFX.sheet, lite=GFX==="lite", R=Math.random, i, t, ph=o.phase||"stage";
  if(!FX) return;
  if(BOG.mudKey!==BOGFX.mudKey){ BOGFX.mudKey=BOG.mudKey; bogFxClearSplats(); }
  BOGFX.t+=dt; BOGFX.mudY=typeof BOG_MUDY==='number'?BOG_MUDY:0; var my=BOGFX.mudY;
  var v=Math.max(0,+o.v||0), ws=Math.max(v,+o.wspd||0), spin=Math.max(0, ws-v), x=+o.x||0, len=+o.len||70, k=U.k||1;
  BOGFX.len=len;
  var inPit=ph==="pit"||(ph==="done"&&x>0&&x<len), running=ph==="pit", sink=clamp(+o.sink||0,0,1.2);
  var rr=(U.rr||0.55)*k, wr=(U.wr||0.42)*k, trR=(U.trR||0.93)*k, trF=(U.trF||U.trR||0.93)*k, wb=(U.wb||3.65)*k, rx=V.position.x, fx=rx+wb, by=V.position.y;
  var mc=o.cons>0.5?[0.1,0.072,0.05]:[0.115,0.07,0.04]; BOGFX.mudC=mc;
  if(Sh) Sh.mat.color.setRGB(mc[0]*0.5, mc[1]*0.5, mc[2]*0.5);   /* darker than the clods: a thick sheet is in its own shadow */
  /* light for the clods: the sun (or the flood at night) and the sky */
  if(BOG.night){ BOGFX.sunC.setRGB(1.0,0.93,0.82).multiplyScalar(0.9); BOGFX.ambC.setRGB(0.24,0.23,0.22); }
  else { BOGFX.sunC.copy(BOG.sun.color).multiplyScalar(BOG.sun.intensity*0.6); BOGFX.ambC.copy(BOG.hemi.color).multiplyScalar(BOG.hemi.intensity*0.9).addScalar(0.14); }
  var rate=lite?0.32:1;
  /* how hard the tyres are throwing it: spin first, speed second */
  var amtT=running?(clamp(spin/4.5,0,1.4)*0.85+clamp(v/20,0,0.4))*clamp(0.6+sink*1.5,0.6,1.3):0;
  BOGFX.tailA+=(amtT-BOGFX.tailA)*Math.min(1,dt*(amtT>BOGFX.tailA?6:2.5)); var amt=BOGFX.tailA;
  /* bow wave: speed into the mud pushes a mound ahead of the front tyres (not the sink, which is ~0 at entry) */
  var bowT=running&&x>0.4?clamp((v-1.2)/8,0,1.25)*clamp(0.55+(+o.dFront||0)*1.4,0.55,1.2):0;
  BOGFX.bowA+=(bowT-BOGFX.bowA)*Math.min(1,dt*(bowT>BOGFX.bowA?5:2)); var bw=BOGFX.bowA;
  if(amt>0.02){
    for(t=0;t<4;t++){ var s=(t&1)?1:-1, front=t>=2, ax=(front?fx:rx)-rr*0.55, kk=front?0.45:1;
      var nc=amt*kk*rate*(lite?100:105)*dt, n=Math.floor(nc)+(R()<nc%1?1:0);
      for(i=0;i<n;i++){ var el=0.55+R()*0.75, sp=(2.2+ws*0.75)*(0.55+R()*0.55)*(front?0.7:1), sh=0.7+R()*0.6, big=R()<0.2;
        FX.emit(ax-R()*0.25, by+rr*(0.5+R()*0.6), s*trR+(R()-0.5)*wr, v-Math.cos(el)*sp, Math.sin(el)*sp, s*R()*sp*0.22, 0.9+R()*0.8, big?0.075:0.035+R()*0.03, big?0.065:0.03, mc[0]*sh, mc[1]*sh, mc[2]*sh, 1, {drag:big?0.06:0.12, kind:0}); }
      if(!front && !lite){ var ns=amt*6*dt, m2=Math.floor(ns)+(R()<ns%1?1:0);
        for(i=0;i<m2;i++) FX.emit(ax-1.6-R(), by+rr*1.6+R()*1.2, s*(trR+0.3), v*0.5-1.5, 0.6+R()*1.2, s*R()*0.8, 1.4+R()*0.8, 0.8, 2.2+R()*1.2, mc[0]*2.6, mc[1]*2.5, mc[2]*2.4, 0.14, {drag:0.6, grav:0.4, fin:0.15, spin:0.5, kind:1}); }
      /* long throws toward the crowd side: they splat the rail, the banners and the front rows */
      if(!front && !lite && s<0 && amt>0.4){ var nl=(amt-0.3)*12*dt; if(R()<nl){ var vz=-(7+R()*2.5), y0=by+rr*1.2, tz=(BOG_W/2+3.55-trR)/-vz, yT=0.55+R()*1.1, vy=(yT-y0+4.9*tz*tz)/tz;   /* aimed: it crosses the rail line at yT */
        FX.emit(ax-0.3, y0, s*trR, v*0.6-1-R()*2, vy, vz, 2.6, 0.07, 0.06, mc[0], mc[1], mc[2], 1, {drag:0, kind:0, lob:true}); } } }
  }
  if(bw>0.03){ var nb=bw*rate*(lite?36:70)*dt, mb=Math.floor(nb)+(R()<nb%1?1:0), fx0=fx+rr*0.95;
    for(i=0;i<mb;i++){ var sd=R()<0.5?-1:1, sh2=0.8+R()*0.4; FX.emit(fx0+R()*0.4, my+0.25+R()*0.3*bw, sd*(trF+R()*wr), v*(0.9+R()*0.25), 1.2+R()*3.2*bw, sd*(1.2+R()*2.8*bw), 0.7+R()*0.5, 0.04+R()*0.035, 0.035, mc[0]*sh2, mc[1]*sh2, mc[2]*sh2, 1, {drag:0.25, kind:0}); } }
  /* pit entry: a wall of mud 3-4 m high with wings, scaled with the entry speed; slaps (ridges, ruts, landings) a smaller one */
  var entry=ph==="pit" && BOG.prev.phase==="runup";
  if(entry || BOG.splash>0){
    var sc=entry?clamp(v/12,0.4,1.1):clamp(BOG.splash*0.45,0.15,0.6);
    if(!BOGFX.crown || entry || BOGFX.crown.t>0.7) BOGFX.crown={t:0, x:fx+rr*0.4, sc:sc, v:v, z:0};
    var nsp=Math.round(sc*(lite?42:110));
    for(i=0;i<nsp;i++){ var a=(R()-0.5)*3.6, f=0.35+R()*0.65, H=3.6*sc*(0.72+0.28*Math.cos(a)), vy0=Math.sqrt(2*9.8*H)*f*(0.85+R()*0.25), hs=(2.2+3.4*f)*Math.max(0.5,sc), sh3=0.7+R()*0.6;
      FX.emit(BOGFX.crown.x+Math.cos(a)*1.1, my+0.2, Math.sin(a)*(trF+0.4), v*0.55+Math.cos(a)*hs, vy0, Math.sin(a)*hs*1.1, 1.0+R()*0.9, R()<0.25?0.08:0.04+R()*0.035, 0.04, mc[0]*sh3, mc[1]*sh3, mc[2]*sh3, 1, {drag:0.1, kind:0}); }
    if(!lite) for(i=0;i<Math.round(sc*4);i++) FX.emit(BOGFX.crown.x+R()*2, 0.6+R(), (R()-0.5)*4, v*0.4, 0.8+R()*1.4, (R()-0.5)*2, 1.8+R(), 1.2, 3.4+R()*1.5, mc[0]*2.4, mc[1]*2.3, mc[2]*2.2, 0.16, {drag:0.6, grav:0.5, fin:0.1, spin:0.4, kind:1});
    BOG.splash=0; }
  /* exhaust: a diesel's black smoke out the stacks, a whisp otherwise */
  var smk=clamp(+o.smoke||0,0,1), ne=(lite?5:12)*(0.15+smk)*(+o.throttle||0)*dt*(o.failed?0:1);
  for(t=0;t<(U.tips||[]).length;t++){ var nn=Math.floor(ne)+(R()<ne%1?1:0); if(!nn) continue; (U.body||V).localToWorld(_bfA.copy(U.tips[t]));
    for(i=0;i<nn;i++){ var c=lerp(0.42,0.04,Math.pow(smk,0.7)); FX.emit(_bfA.x, _bfA.y, _bfA.z, v-0.6, 2.4+smk*2, (R()-0.5)*0.5, 1.8+R(), 0.25, 1.6+smk*3, c, c, c, 0.2+0.5*smk, {drag:0.7, grav:0, buoy:0.15, fin:0.03, spin:0.5, kind:1}); } }
  FX.step(dt, BOG_WIND);
  if(Sh) bogFxSheets(Sh, dt, {amt:amt, bw:bw, v:v, ws:ws, rx:rx, fx:fx, by:by, rr:rr, wr:wr, trR:trR, trF:trF, k:k, mc:mc});
  if(!lite) bogFxLens(dt, fx, rx, amt, bw);
}
/* the sheets: the tail fans are steady-state streams in the truck's frame (launched at the tyre's surface speed),
   the crown is a ring of mud launched once and drawn where it has flown to, the bow mound rides ahead of the front tyres */
function bogFxSheets(Sh, dt, q){
  var S=Sh.slots, g=9.8, c, r, t=BOGFX.t;
  for(var side=0;side<2;side++){ var sl=S[side], s=side?1:-1;
    if(q.amt<0.06){ Sh.off(sl); continue; }
    sl.on=true; sl.dirty=true; Sh.touched=true;
    var sp=clamp(2+q.ws*0.32+(q.ws-q.v)*0.6,3,9), lx=q.rx-q.rr*0.7, ly=q.by+q.rr*0.95, lz=s*q.trR, Tf=0;
    for(c=0;c<sl.cols;c++){ var u=c/(sl.cols-1), el=0.42+0.55*u, lat=(0.04+0.16*(1-u))*s, cv=Math.cos(el)*sp, sv=Math.sin(el)*sp, T=(sv+Math.sqrt(sv*sv+2*g*Math.max(0.1,ly)))/g, ef=Math.sin(u*PI);
      for(r=0;r<sl.rows;r++){ var f=r/(sl.rows-1), a=f*T, d=1-0.12*a, px=lx-cv*a*d, py=ly+sv*a-0.5*g*a*a, pz=lz+lat*sp*a*d+s*0.05*q.wr*Math.sin(c*1.7);
        var al=Math.min(1,f*6)*Math.pow(1-f,0.7)*(0.3+0.7*ef)*clamp(q.amt*1.4,0,1);
        if(py<BOGFX.mudY+0.02){ py=BOGFX.mudY+0.02; al=0; }
        Sh.set(sl, c, r, px, py, pz, al, 0.3+0.55*f+(1-ef)*0.2, u*1.3+side*0.37, f*2.2-t*2.4); } } }
  /* crown */
  var C=BOGFX.crown, sc2=S[2];
  if(C){ C.t+=dt; var Tend=2*Math.sqrt(2*g*3.6*C.sc)/g+0.25;
    if(C.t>Tend){ BOGFX.crown=null; Sh.off(sc2); }
    else { sc2.on=true; sc2.dirty=true; Sh.touched=true; var T2=C.t, life=T2/Tend;
      for(c=0;c<sc2.cols;c++){ var ua=(c/(sc2.cols-1))*2-1, phi=ua*1.95, H=3.6*C.sc*(0.72+0.28*Math.cos(phi)), vmax=Math.sqrt(2*g*H), ef2=Math.pow(Math.sin((ua*0.5+0.5)*PI),0.6);
        var bx=C.x+Math.cos(phi)*0.7, bz=Math.sin(phi)*(q.trF+q.wr*0.6);
        for(r=0;r<sc2.rows;r++){ var fr=0.2+0.8*r/(sc2.rows-1), vy=vmax*fr, hs=(1.6+3.0*fr)*Math.max(0.55,C.sc), vxx=C.v*0.45+Math.cos(phi)*hs, vzz=Math.sin(phi)*hs*1.15;
          var py2=vy*T2-0.5*g*T2*T2, al2=ef2*Math.min(1,T2*14)*Math.pow(1-life,0.6)*(py2>0.03?1:0)*(0.8+0.2*fr);
          Sh.set(sc2, c, r, bx+vxx*T2*(1-0.1*T2), BOGFX.mudY+Math.max(0.02,py2), bz+vzz*T2*(1-0.1*T2), al2, 0.04+0.6*Math.pow(life,1.5)+0.12*fr, ua*2.6, fr*1.4); } } } }
  else Sh.off(sc2);
  /* bow mound: two lobes ahead of the front tyres, joined by the axle's push; its crest breaks */
  var B=S[3];
  if(q.bw<0.04){ Sh.off(B); }
  else { B.on=true; B.dirty=true; Sh.touched=true;
    var W=q.trF+q.wr*0.95, x0=q.fx+q.rr*0.55, L2=(1.0+0.9*q.bw)*q.k, Hb=(0.22+0.45*q.bw)*q.k;
    for(c=0;c<B.cols;c++){ var zu=(c/(B.cols-1))*2-1, z=zu*W*1.18, dz=Math.abs(Math.abs(z)-q.trF)/(q.wr*0.9), lobe=0.5+0.5*Math.exp(-dz*dz*0.9), edge=1-Math.pow(Math.abs(zu),3);
      for(r=0;r<B.rows;r++){ var xr=r/(B.rows-1), prof=Math.pow(Math.sin(PI*Math.pow(xr,0.7)),0.9), wob=0.06*Math.sin(t*9+c*1.3+r);
        Sh.set(B, c, r, x0+xr*L2+Math.abs(zu)*0.25*L2, BOGFX.mudY+Math.max(0.01,Hb*lobe*prof*edge*(1+wob)), z, Math.min(1,edge*1.4)*Math.min(1,(1-xr)*3+0.2)*Math.min(1,q.bw*2.2),
          0.02+0.35*xr*xr+0.3*(1-edge), zu*1.4, (x0+xr*L2)*0.35); } } }
  Sh.flush();
}
/* --- the mud coat: every standard material on the truck becomes a per-truck clone with a bottom-up splatter mask --- */
var BOG_MUD_VS=["varying vec3 vMudP; varying float vMudH;"].join("\n");
var BOG_MUD_FS=["uniform float uMudCoat; uniform float uMudLine; uniform float uMudBase; uniform float uMudK; uniform vec3 uMudCol; uniform float uMudPack;",
  "uniform float uMudWheel; uniform float uMudLug; uniform float uMudR; uniform vec3 uMudAx;",
  "varying vec3 vMudP; varying float vMudH;",
  "float mudH3(vec3 p){ p=fract(p*0.3183099+vec3(0.71,0.113,0.419)); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }",
  "float mudN(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);",
  " return mix(mix(mix(mudH3(i),mudH3(i+vec3(1.0,0.0,0.0)),f.x),mix(mudH3(i+vec3(0.0,1.0,0.0)),mudH3(i+vec3(1.0,1.0,0.0)),f.x),f.y),",
  "  mix(mix(mudH3(i+vec3(0.0,0.0,1.0)),mudH3(i+vec3(1.0,0.0,1.0)),f.x),mix(mudH3(i+vec3(0.0,1.0,1.0)),mudH3(i+vec3(1.0,1.0,1.0)),f.x),f.y),f.z); }"].join("\n");
var BOG_MUD_MASK=["float mudM=0.0, mudTk=0.0, mudV=0.5;",
  "if(uMudCoat>0.002){ vec3 mP=vMudP; float n1=mudN(mP*2.3)*0.55+mudN(mP*5.7)*0.3+mudN(mP*13.0)*0.15; mudV=n1;",
  " if(uMudWheel>0.5){ float cov=clamp(uMudCoat*1.35,0.0,1.0); mudM=smoothstep(1.0-cov-0.06,1.0-cov+0.06,n1); mudTk=0.4;",
  "  if(uMudLug>0.5){ float rn=length(mP*uMudAx)/max(0.01,uMudR), fill=mix(0.8,1.0,uMudPack); mudM=max(mudM, smoothstep(fill+0.012,fill-0.012,rn)*smoothstep(0.66,0.74,rn)*step(0.03,uMudPack)); mudTk=0.7; } }",
  " else { float h=(vMudH-uMudBase)/uMudK, drip=mudN(vec3(mP.x*7.0,mP.y*0.9,mP.z*7.0)), edge=uMudLine+(n1-0.5)*0.9+(drip-0.5)*0.7*uMudCoat;",
  "  mudM=smoothstep(edge+0.035,edge-0.035,h); mudTk=clamp((edge-h)*1.5,0.0,1.0);",
  "  float spk=mudN(mP*19.0+3.1)*0.7+mudN(mP*43.0)*0.3, th=0.8-0.2*uMudCoat;",
  "  mudM=max(mudM, smoothstep(th,th+0.04,spk)*smoothstep(edge+0.5+1.9*uMudCoat,edge,h)); }",
  " mudM*=smoothstep(0.0,0.04,uMudCoat);",
  " vec3 mudC=uMudCol*(0.7+0.65*mudV)*mix(1.25,0.72,mudTk);",
  " diffuseColor.rgb=mix(diffuseColor.rgb,mudC,mudM); diffuseColor.a=mix(diffuseColor.a,1.0,mudM); }"].join("\n");
function bogMudOBC(sh){
  var u=this.__bogU; for(var key in u) sh.uniforms[key]=u[key];
  sh.vertexShader=BOG_MUD_VS+"\n"+sh.vertexShader.replace("#include <begin_vertex>",
    "#include <begin_vertex>\n vec4 mudW=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\n mudW=instanceMatrix*mudW;\n#endif\n vMudP=mudW.xyz; vMudH=(modelMatrix*mudW).y;");
  sh.fragmentShader=BOG_MUD_FS+"\n"+sh.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\n"+BOG_MUD_MASK)
    .replace("#include <roughnessmap_fragment>","#include <roughnessmap_fragment>\n roughnessFactor=mix(roughnessFactor,mix(0.8,0.32,mudTk),mudM);")
    .replace("#include <metalnessmap_fragment>","#include <metalnessmap_fragment>\n metalnessFactor=mix(metalnessFactor,0.0,mudM);")
    .replace("#include <emissivemap_fragment>","#include <emissivemap_fragment>\n totalEmissiveRadiance*=1.0-0.92*mudM;");
}
function bogMudClone(orig, U, w){
  var c=orig.clone(), ob=orig.onBeforeCompile, own=ob && ob!==THREE.Material.prototype.onBeforeCompile;
  c.__bogOrig=orig; c.__bogU=Object.assign({}, U.mudU, {uMudWheel:{value:w?1:0}, uMudLug:{value:w&&w.lug?1:0}, uMudR:{value:w?w.r:1}, uMudAx:{value:w?w.ax:new THREE.Vector3(1,0,1)}});
  c.onBeforeCompile=function(sh, r){ if(own) ob.call(this, sh, r); bogMudOBC.call(this, sh); };
  var key=orig.customProgramCacheKey?orig.customProgramCacheKey():""; c.customProgramCacheKey=function(){ return "bogmud|"+key; };
  return c;
}
/* wheels: the tyre (the widest mesh in each wheel) packs its lugs; radius and axle from the mesh's own bounds */
function bogMudWheels(U){
  var W={}; [U.wheelsR||[], U.wheelsF||[]].forEach(function(arr){ arr.forEach(function(wh){ var list=[], big=null;
    wh.traverse(function(m){ if(!m.isMesh || !m.geometry) return; var g=m.geometry; if(!g.boundingBox) g.computeBoundingBox(); var b=g.boundingBox, s=_bfA.subVectors(b.max,b.min);
      var ax=s.x<=s.y&&s.x<=s.z?new THREE.Vector3(0,1,1):s.y<=s.z?new THREE.Vector3(1,0,1):new THREE.Vector3(1,1,0), r=Math.max(s.x*ax.x, s.y*ax.y, s.z*ax.z)/2;
      var e={r:r, ax:ax, lug:false}; list.push([m,e]); if(!big || r>big.r) big=e; });
    if(big) big.lug=true; list.forEach(function(p){ W[p[0].uuid]=p[1]; }); }); });
  return W;
}
function bogMudPatch(V){
  var U=V.userData;
  if(!U.mudU){ U.mudU={uMudCoat:{value:0}, uMudLine:{value:0}, uMudBase:{value:0}, uMudK:{value:U.k||1}, uMudCol:{value:new THREE.Color(0.12,0.085,0.05)}, uMudPack:{value:0}};
    U.mudClones={}; U.mudWheels=bogMudWheels(U); }
  var C=U.mudClones, WH=U.mudWheels;
  V.traverse(function(m){ if(!m.isMesh || m.isInstancedMesh && m.count===0) return;
    var arr=Array.isArray(m.material), list=arr?m.material:[m.material], ch=false;
    for(var i=0;i<list.length;i++){ var mt=list[i]; if(!mt) continue;
      if(mt.__bogOrig){ var o=mt.__bogOrig; mt.color.copy(o.color); if(o.emissive) mt.emissive.copy(o.emissive); mt.emissiveIntensity=o.emissiveIntensity; mt.opacity=o.opacity; mt.visible=o.visible; continue; }
      if(!mt.isMeshStandardMaterial) continue;
      var w=WH[m.uuid], key=(w?m.uuid+":":"")+mt.uuid; if(!C[key]) C[key]=bogMudClone(mt, U, w);
      list[i]=C[key]; ch=true; }
    if(ch && !arr) m.material=list[0]; });
}
/* the coat's target: the pit run so far (a clean pass still browns it) and the mud the sim says it carries (stuck runs go heavy) */
function bogCoatUpdate(o, dt, V){
  var U=V.userData, ph=o.phase||"stage", x=+o.x||0, len=+o.len||70, kg=+o.mudKg||0;
  var run=(ph==="pit"||ph==="done")?clamp(x/Math.max(20,len),0,1):0;
  var tgt=Math.max(run*0.46, 1-Math.exp(-kg/110));
  if(ph==="stage" || ph==="runup") tgt=0;
  BOG.coat=Math.max(tgt<0.001?0:BOG.coat, BOG.coat+(tgt-BOG.coat)*Math.min(1,dt*2.2));
  if(BOG.coat<0.001 && !U.mudU) return;
  bogMudPatch(V);
  var u=U.mudU, c=BOG.coat, pk=o.pack!=null?clamp(+o.pack,0,1):clamp(c*1.1,0,1);
  u.uMudCoat.value=c; u.uMudLine.value=c>0.001?Math.max(0.15+2.75*Math.pow(c,1.15), (+U.mudLine||0)/(U.k||1)+0.08):0;   /* never below the mud's high-water mark (mudstuck's U.mudLine, m above the contact) */ u.uMudBase.value=V.position.y; u.uMudK.value=U.k||1;
  u.uMudPack.value+=(Math.max(pk, c*0.6)-u.uMudPack.value)*Math.min(1,dt*3); if(c<0.001) u.uMudPack.value=0;
  if(o.cons>0.5) u.uMudCol.value.setRGB(0.075,0.054,0.038); else u.uMudCol.value.setRGB(0.08,0.05,0.03);
}
/* ===========================================================================
   MUD BOG PIT — the night's pit as the sim has it. The mud is a heightfield dug BOG_MUDY below the fairground with steep wet
   walls, the sim's depth profile (deeper = lower and wetter), its hard ridges (humps across the pit, drier crowns) and its
   hidden ruts (troughs holding water). Columns are stored contiguously (q = ix*nz + iz) so a rut touches one run of the
   buffers: ruts update their own normals and upload just that range. The vertex shader lifts a collar of mud round each
   tyre and, when the frame sits down, a crown under the belly; the fragment shader layers consistency detail (soupy water
   film with ripples, glossy ridged slop, cracked clay crust) over whatever base colour the material has.
   ==========================================================================*/
var BOG_MUDY=-0.2, BOG_TYRE_IN={street:35, modified:44, super:54}, BOG_EDGE=4.78, _bV2=new THREE.Vector2();
/* the sim's pit for the vis: {seed, len, cons, depth (every 0.5 m, unscaled), hz [{x,kind,h,w}], pitK} — depth/hz optional */
function bogPitInit(pit, len){
  var P={len:len, seed:(pit.seed>>>0), cons:clamp(+pit.cons||0.5,0,1), k:+pit.pitK||1, depth:Array.isArray(pit.depth)&&pit.depth.length>1?pit.depth:null, hz:Array.isArray(pit.hz)?pit.hz:[], dmin:0, dmax:0, rmax:0.01}, i;
  if(P.depth){ P.dmin=1e9; P.dmax=-1e9; for(i=0;i<P.depth.length;i++){ P.dmin=Math.min(P.dmin,P.depth[i]); P.dmax=Math.max(P.dmax,P.depth[i]); } }
  P.hz.forEach(function(h){ if(h.kind==="bump") P.rmax=Math.max(P.rmax,+h.h||0); });
  BOG.pit=P; return P;
}
function bogPitDn(x){ var P=BOG.pit; if(!P||!P.depth||P.dmax-P.dmin<1e-3) return 0.5; var f=clamp(x,0,P.len)*2, i=Math.floor(f), a=P.depth[Math.min(P.depth.length-1,i)], b=P.depth[Math.min(P.depth.length-1,i+1)]; return ((a+(b-a)*(f-i))-P.dmin)/(P.dmax-P.dmin); }
function bogPitRamp(x){ var L=BOG.pit?BOG.pit.len:70; return smoothstep(0,2.4,x)*(1-smoothstep(L-2.8,L,x)); }
/* the mud's resting surface at x (no ruts, no hazards): the fairground (-0.02) outside, BOG_MUDY in the pit, deeper mud a touch lower */
function bogPitLevel(x){ var P=BOG.pit; if(!P||x<=0||x>=P.len) return -0.02; return -0.02+(BOG_MUDY+0.02-0.05*(bogPitDn(x)-0.5))*bogPitRamp(x); }
/* a hazard's profile at x: "bump" = a hard ridge's height, "rut" = a trough's depth */
function bogPitHz(x, kind){
  var P=BOG.pit, s=0, i; if(!P) return 0;
  for(i=0;i<P.hz.length;i++){ var h=P.hz[i], hw=(+h.w||1)*0.5, d=Math.abs(x-h.x); if(h.kind!==kind || d>=hw) continue;
    if(kind==="bump"){ var c=Math.cos(d/hw*PI/2); s+=(+h.h||0)*c*c; } else s+=(+h.h||0)*(1-smoothstep(hw*0.6,hw,d)); }
  return s;
}
/* the heightfield: columns along x (uniform on Full/Ultra so a rut finds its column; coarse plus the hazards on Lite),
   rows across: the wall (±5 at the fairground, ±4.9, ±4.78 at the mud), fine rows down each wheel track, coarser between */
function bogPitGeo(P, half, lite){
  var len=P.len, ultra=GFX==="ultra", xs=[], zs=[], i, x, z;
  if(lite){ xs=[0,0.8,1.6,2.4]; for(x=4;x<len-3;x+=2) xs.push(x); xs.push(len-2.8,len-1.4,len);
    P.hz.forEach(function(h){ var w=+h.w||1; [-0.5,0,0.5].forEach(function(f){ if(h.x+f*w>0 && h.x+f*w<len) xs.push(h.x+f*w); }); });
    xs.sort(function(a,b){ return a-b; }); xs=xs.filter(function(v,j){ return j===0||v-xs[j-1]>0.05; });
    zs=[-5,-4.9,-BOG_EDGE,0,BOG_EDGE,4.9,5]; }
  else { var dx=ultra?0.2:0.3, nx=Math.ceil(len/dx)+1; dx=len/(nx-1); for(i=0;i<nx;i++) xs.push(i*dx); BOG.mudDx=dx;
    var fine=ultra?0.09:0.13, band=0.8; zs=[-5,-4.9]; z=-BOG_EDGE;
    while(z<BOG_EDGE-0.05){ zs.push(z); var a=Math.abs(Math.abs(z)-half); z+=a<band?fine:Math.abs(z)<half?0.22:(ultra?0.45:0.6); }
    zs.push(BOG_EDGE,4.9,5); }
  if(lite) BOG.mudDx=0;
  var nx2=xs.length, nz=zs.length, n=nx2*nz, pos=new Float32Array(n*3), uv=new Float32Array(n*2), mud=new Float32Array(n*2), idx=[], sd=(P.seed%997);
  for(i=0;i<nx2;i++){ x=xs[i]; var lv=bogPitLevel(x), rp=bogPitRamp(x), dn=bogPitDn(x);
    for(var j=0;j<nz;j++){ z=zs[j]; var q=i*nz+j, az=Math.abs(z), y, wet=0, dry=0;
      var xw=x+0.18*Math.sin(z*0.9+sd)*rp, tp=1-0.35*smoothstep(3.6,BOG_EDGE,az), rg=bogPitHz(xw,"bump")*tp*rp, ru=bogPitHz(xw,"rut")*tp*rp;
      var yin=lv+rg-ru+(lite?0:rp*(0.016*(fbm(x/7+sd,z/4+3,3,2,7)-0.5)+0.005*Math.sin(x*1.9+z*2.7+sd)));
      if(az>4.95) { y=-0.02; wet=1; }
      else if(az>4.85) { y=lerp(-0.02, yin, 0.62); wet=1; }
      else { y=yin; wet=az>4.7?0.85:clamp(0.3*dn+(ru>0.02?0.4+ru*2:0)+(1-rp)*0.4,0,1); dry=P.rmax>0?clamp(rg/P.rmax,0,1)*0.9:0; }
      pos[q*3]=x; pos[q*3+1]=y; pos[q*3+2]=z; uv[q*2]=x/len; uv[q*2+1]=0.5-z/BOG_W; mud[q*2]=wet; mud[q*2+1]=dry; } }
  for(i=0;i<nx2-1;i++) for(j=0;j<nz-1;j++){ var a0=i*nz+j, b0=a0+nz, c0=a0+1, d0=b0+1; idx.push(a0,c0,b0, b0,c0,d0); }
  var g=new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos,3)); g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(n*3),3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv,2)); g.setAttribute("aMud", new THREE.BufferAttribute(mud,2)); g.setIndex(idx);
  BOG.mudXs=xs; BOG.mudZs=zs; BOG.mudSx=nx2; BOG.mudSz=nz; BOG.mudGeo=g; BOG.mudBase=Float32Array.from(pos);
  bogPitNormals(0, nx2-1); g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}
/* heightfield normals over a run of columns (central differences) */
function bogPitNormals(c0, c1){
  var g=BOG.mudGeo, A=g.attributes.position.array, N=g.attributes.normal.array, xs=BOG.mudXs, zs=BOG.mudZs, nx=BOG.mudSx, nz=BOG.mudSz;
  c0=Math.max(0,c0); c1=Math.min(nx-1,c1);
  for(var i=c0;i<=c1;i++){ var il=Math.max(0,i-1), ir=Math.min(nx-1,i+1), ddx=xs[ir]-xs[il]||1;
    for(var j=0;j<nz;j++){ var jl=Math.max(0,j-1), jr=Math.min(nz-1,j+1), q=i*nz+j;
      var gx=(A[(ir*nz+j)*3+1]-A[(il*nz+j)*3+1])/ddx, gz=(A[(i*nz+jr)*3+1]-A[(i*nz+jl)*3+1])/((zs[jr]-zs[jl])||1), l=1/Math.sqrt(gx*gx+1+gz*gz);
      N[q*3]=-gx*l; N[q*3+1]=l; N[q*3+2]=-gz*l; } }
}
/* push the columns a rut touched since the last frame: their normals, then just that range of each buffer */
function bogPitFlush(){
  if(BOG.rutC1<0 || !BOG.mudGeo) return; var nz=BOG.mudSz, c0=Math.max(0,BOG.rutC0-1), c1=Math.min(BOG.mudSx-1,BOG.rutC1+1), at=BOG.mudGeo.attributes;
  bogPitNormals(c0, c1);
  [["position",3],["normal",3],["aMud",2]].forEach(function(p){ var a=at[p[0]]; a.updateRange.offset=c0*nz*p[1]; a.updateRange.count=(c1-c0+1)*nz*p[1]; a.needsUpdate=true; });
  BOG.rutC0=1e9; BOG.rutC1=-1;
}
/* standing water in the sim's ruts (Full/Ultra): one flat sheet per trough, drawn with the mud's own material (its wet film) */
function bogPitWater(P, lite){
  if(BOG.water){ BOG.scene.remove(BOG.water); BOG.water.geometry.dispose(); BOG.water=null; }
  if(lite) return; var pos=[], uv=[], mud=[], nrm=[], idx=[], n=0;
  P.hz.forEach(function(h){ if(h.kind!=="rut") return; var hw=(+h.w||1)*0.5*0.86, y=bogPitLevel(h.x)-(+h.h||0)*0.35, x0=Math.max(0.1,h.x-hw), x1=Math.min(P.len-0.1,h.x+hw), ZS=[-BOG_EDGE,-2.4,0,2.4,BOG_EDGE];
    for(var a=0;a<2;a++) for(var b=0;b<ZS.length;b++){ var xx=a?x1:x0; pos.push(xx,y,ZS[b]); uv.push(xx/P.len,0.5-ZS[b]/BOG_W); mud.push(1,0); nrm.push(0,1,0); }
    for(b=0;b<ZS.length-1;b++){ var q=n+b; idx.push(q,q+1,q+ZS.length, q+ZS.length,q+1,q+ZS.length+1); } n+=ZS.length*2; });
  if(!n) return; var g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); g.setAttribute("normal",new THREE.Float32BufferAttribute(nrm,3));
  g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2)); g.setAttribute("aMud",new THREE.Float32BufferAttribute(mud,2)); g.setIndex(idx);
  BOG.water=new THREE.Mesh(g, BOG.mats.mud); BOG.water.receiveShadow=true; BOG.scene.add(BOG.water);
}
/* the sim's pit painted into the map: deeper mud darker, ridge crowns drier and lighter, troughs dark water */
function bogPitPaint(cv, P){
  var c=cv.getContext("2d"), W=cv.width, H=cv.height, L=P.len, x, i;
  for(x=0;x<L;x+=1){ var dn=bogPitDn(x+0.5); c.fillStyle="rgba(18,11,6,"+(0.28*dn).toFixed(3)+")"; c.fillRect(x/L*W, H*0.03, W/L+1, H*0.94); }
  P.hz.forEach(function(h){ var w=+h.w||1, px=(h.x-w/2)/L*W, pw=w/L*W;
    if(h.kind==="bump"){ var gr=c.createLinearGradient(px,0,px+pw,0); gr.addColorStop(0,"rgba(150,120,85,0)"); gr.addColorStop(0.5,"rgba(150,120,85,0.38)"); gr.addColorStop(1,"rgba(150,120,85,0)"); c.fillStyle=gr; c.fillRect(px,H*0.03,pw,H*0.94);
      c.strokeStyle="rgba(60,44,30,0.35)"; c.lineWidth=1; for(i=0;i<14;i++){ var yy=H*(0.06+0.88*i/14); c.beginPath(); c.moveTo(px+pw*0.3,yy); c.lineTo(px+pw*0.7,yy+2); c.stroke(); } }
    else { c.fillStyle="rgba(16,10,5,0.55)"; c.fillRect(px+pw*0.12,H*0.03,pw*0.76,H*0.94); c.fillStyle="rgba(90,70,50,0.18)"; c.fillRect(px+pw*0.08,H*0.03,pw*0.05,H*0.94); c.fillRect(px+pw*0.87,H*0.03,pw*0.05,H*0.94); } });
}
/* the canvas map uploads only the strip the tracks touched (texSubImage2D), not the whole map every 0.4 m */
function bogPitTexFlush(){
  var a=BOG.texC0, b=BOG.texC1; if(b<0 || !BOG.mudTex || !BOG.mudCv) return; BOG.texC0=1e9; BOG.texC1=-1;
  var W=BOG.mudCv.width, H=BOG.mudCv.height, x0=Math.max(0,Math.floor(a/16)*16), w=Math.min(W-x0, Math.ceil((b+3-x0)/16)*16);
  if(w<=0) return; if(w>256 || !renderer || !renderer.copyTextureToTexture){ BOG.mudTex.needsUpdate=true; return; }
  var S=(BOG.texStrip||(BOG.texStrip={}))[w+"x"+H]; if(!S){ S=BOG.texStrip[w+"x"+H]={image:newCanvas(w,H)}; }
  var sx=S.image.getContext("2d"); sx.clearRect(0,0,w,H); sx.drawImage(BOG.mudCv, x0,0,w,H, 0,0,w,H);
  try{ renderer.copyTextureToTexture(_bV2.set(x0,0), S, BOG.mudTex); }catch(e){ BOG.mudTex.needsUpdate=true; }
}
/* Full/Ultra: press a rut behind a tyre — the trough sits where the tyre has been, never under it (the mud there stays level,
   the collar lifts it). Keeps the deepest mark; churned mud is marked wet for the shader. */
function bogPitRut(key, xc, zt, w, dep, lip){
  if(!BOG.mudGeo || !BOG.mudDx) return;
  var last=BOG.rutLast[key], x1=xc, x0=(last!=null && last<x1 && x1-last<6)?last:x1-0.5; BOG.rutLast[key]=x1; if(x1<=0) return;
  var dx=BOG.mudDx, nz=BOG.mudSz, zs=BOG.mudZs, A=BOG.mudGeo.attributes.position.array, M=BOG.mudGeo.attributes.aMud.array, B=BOG.mudBase;
  var i0=Math.max(1,Math.ceil(x0/dx)), i1=Math.min(BOG.mudSx-2,Math.floor(x1/dx)), hw=w*0.5, lw=0.45, ch=false;
  for(var i=i0;i<=i1;i++){ var rp=bogPitRamp(i*dx), dd=dep*rp*(1-0.6*(M[(i*nz+(nz>>1))*2+1]||0)), lp=lip*rp;
    for(var j=3;j<nz-3;j++){ var z=zs[j], dz=Math.abs(z-zt); if(dz>hw+lw) continue; var q=i*nz+j, b=B[q*3+1], y=A[q*3+1];
      if(dz<hw){ var f=dz<hw-0.08?1:0.5+0.5*Math.cos((dz-hw+0.08)/0.08*PI*0.5), t=b-dd*f; if(t<y){ A[q*3+1]=t; ch=true; } M[q*2]=Math.max(M[q*2],0.55+0.45*f); }
      else { var lf=Math.sin((dz-hw)/lw*PI), t2=b+lp*lf; if(y>=b-0.004 && t2>y){ A[q*3+1]=t2; ch=true; M[q*2]=Math.max(M[q*2],0.3*lf); } } } }
  if(ch||i1>=i0){ BOG.rutC0=Math.min(BOG.rutC0,i0); BOG.rutC1=Math.max(BOG.rutC1,i1); }
}
/* dug in: a bowl under the tyre, the spoil thrown up behind it */
function bogPitHole(xc, zt, r, w, dep){
  if(!BOG.mudGeo || !BOG.mudDx) return;
  var dx=BOG.mudDx, nz=BOG.mudSz, zs=BOG.mudZs, A=BOG.mudGeo.attributes.position.array, M=BOG.mudGeo.attributes.aMud.array, B=BOG.mudBase;
  var i0=Math.max(1,Math.floor((xc-r-1.4)/dx)), i1=Math.min(BOG.mudSx-2,Math.ceil((xc+r)/dx));
  for(var i=i0;i<=i1;i++){ var x=i*dx, ex=(x-xc)/r;
    for(var j=3;j<nz-3;j++){ var ez=(zs[j]-zt)/(w*0.5+0.15), q=i*nz+j, b=B[q*3+1], d2=ex*ex+ez*ez;
      if(d2<1){ var t=b-dep*(1-d2); if(t<A[q*3+1]) A[q*3+1]=t; M[q*2]=1; }
      else if(ex<-1 && ex>-1-1.3/r && Math.abs(ez)<1.3){ var sp=Math.sin((-ex-1)/(1.3/r)*PI)*(1-Math.abs(ez)/1.3)*dep*0.7, t2=b+sp; if(t2>A[q*3+1]){ A[q*3+1]=t2; M[q*2]=Math.max(M[q*2],0.7); } } } }
  BOG.rutC0=Math.min(BOG.rutC0,i0); BOG.rutC1=Math.max(BOG.rutC1,i1);
}
/* shared GLSL: value noise, crack cells, screen-space bump */
var BOG_GLSL_NOISE=[
  "float bgH(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }",
  "float bgN(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(bgH(i),bgH(i+vec2(1.0,0.0)),f.x), mix(bgH(i+vec2(0.0,1.0)),bgH(i+vec2(1.0,1.0)),f.x), f.y); }",
  "float bgVor(vec2 p){ vec2 i=floor(p), f=fract(p); float d1=8.0, d2=8.0; for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(float(x),float(y)); vec2 o=vec2(bgH(i+g),bgH(i+g+17.3)); vec2 r=g+o-f; float d=dot(r,r); if(d<d1){ d2=d1; d1=d; } else if(d<d2) d2=d; } return sqrt(d2)-sqrt(d1); }",
  "vec3 bgBump(vec3 sp, vec3 n, float h){ vec3 sx=dFdx(sp), sy=dFdy(sp), r1=cross(sy,n), r2=cross(n,sx); float det=dot(sx,r1); vec2 dh=vec2(dFdx(h),dFdy(h)); vec3 gr=sign(det)*(dh.x*r1+dh.y*r2); return normalize(abs(det)*n-gr); }"].join("\n");
/* the mud material's detail, layered over its colour/roughness (the base colour is someone else's to tune) */
function bogMudMatDetail(mat){
  if(mat.userData.bogDetail) return; mat.userData.bogDetail=true;
  var U=BOG.mudU||(BOG.mudU={uTy:{value:[new THREE.Vector4(-99,0,0,1),new THREE.Vector4(-99,0,0,1),new THREE.Vector4(-99,0,0,1),new THREE.Vector4(-99,0,0,1)]}, uTyR:{value:0.5}, uBelly:{value:new THREE.Vector4(-99,1,0,1)}, uCons:{value:0.5}, uTime:{value:0}});
  var prev=mat.onBeforeCompile, prevKey=mat.customProgramCacheKey;
  mat.onBeforeCompile=function(sh, r){
    if(prev) prev.call(this, sh, r);
    for(var k in U) sh.uniforms[k]=U[k];
    sh.vertexShader="uniform vec4 uTy[4]; uniform float uTyR; uniform vec4 uBelly;\nattribute vec2 aMud; varying vec2 vBogM; varying vec3 vBogP; varying float vBogB;\n"+sh.vertexShader
      .replace("#include <beginnormal_vertex>", ["#include <beginnormal_vertex>",
        "float bogY=0.0; vec2 bogG=vec2(0.0); vBogB=0.0;",
        "#ifndef BOG_LITE",
        "for(int i=0;i<4;i++){ vec4 T=uTy[i]; vec2 d=vec2(position.x-T.x, position.z-T.y); vec2 s=vec2(uTyR*(d.x>0.0?1.3:0.85), T.w); vec2 q=d/s; float g=T.z*exp(-dot(q,q)); bogY+=g; bogG+=-2.0*g*q/s; }",
        "{ vec2 d=vec2(position.x-uBelly.x, position.z); vec2 s=uBelly.yw; vec2 q=d/s; float q2=dot(q,q); float g=uBelly.z*exp(-q2*q2); vBogB=g; bogY+=g; bogG+=-4.0*q2*g*q/s; }",
        "float bogWk=1.0-smoothstep(4.5,4.78,abs(position.z)); bogY*=bogWk; bogG*=bogWk;",
        "objectNormal=normalize(objectNormal+vec3(-bogG.x,0.0,-bogG.y));",
        "#endif"].join("\n"))
      .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed.y+=bogY; vBogM=aMud; vBogP=transformed;");
    sh.fragmentShader="uniform float uCons; uniform float uTime; varying vec2 vBogM; varying vec3 vBogP; varying float vBogB;\n"+BOG_GLSL_NOISE+"\n"+sh.fragmentShader
      .replace("#include <map_fragment>", ["#include <map_fragment>",
        "float bWet=clamp(vBogM.x,0.0,1.0), bDry=clamp(vBogM.y,0.0,1.0); vec2 bP=vBogP.xz; float bFade=1.0-smoothstep(10.0,50.0,length(vBogP-cameraPosition));",
        "float wSoup=1.0-smoothstep(0.16,0.3,uCons), wClay=smoothstep(0.6,0.74,uCons), wSlop=max(0.0,1.0-wSoup-wClay), thick=smoothstep(0.3,0.62,uCons);",
        "float bCrown=clamp(vBogB*6.0,0.0,1.0), dryK=max(bDry,bCrown);",
        "float film=clamp(wSoup*(0.72+0.28*bWet)+bWet*bWet*0.55*(1.0-0.6*wClay),0.0,1.0)*(1.0-dryK);",
        "float bH=0.0; vec3 bT=vec3(1.0);",
        /* water film: two wind ripple trains and a slow noise swell */
        "float rip=sin(dot(bP,vec2(0.8,0.6))*9.0-uTime*2.3)*0.5+sin(dot(bP,vec2(-0.45,0.89))*14.0-uTime*3.1)*0.3+(bgN(bP*2.5+vec2(uTime*0.35,0.0))-0.5)*0.9;",
        "bH+=film*rip*0.006*bFade;",
        /* slop / peanut butter: glossy smeared ridges, streaked along the pit, lumps when thick */
        "float sm=bgN(vec2(bP.x*0.7,bP.y*2.6)); float rg=1.0-abs(sin(bP.y*6.0+sm*7.0+bP.x*0.9)); rg*=rg; float lump=bgN(bP*2.2+3.1);",
        "float slopK=wSlop*(1.0-film*0.8);",
        "bH+=slopK*(rg*(0.008+0.014*thick)+lump*0.014*thick)*bFade;",
        "bT*=mix(vec3(1.0), vec3(0.9+0.22*rg*(0.4+thick)+0.12*thick), slopK);",
        /* sticky clay: a dry grey-tan crust cracked into plates; the churn breaks it up */
        "float crust=wClay*(1.0-bWet)*(1.0-film);",
        "#ifdef BOG_LITE",
        "float crack=1.0-smoothstep(0.0,0.04,abs(bgN(bP*3.0)-0.5));",
        "#else",
        "float crack=(1.0-smoothstep(0.015,0.05,bgVor(bP*3.6+bgN(bP*0.9)*0.8)))*smoothstep(0.25,0.55,bgN(bP*0.6+5.0));",
        "#endif",
        "bH+=crust*(-crack*0.008+bgN(bP*9.0)*0.004)*bFade;",
        "bT*=mix(vec3(1.0), mix(vec3(1.42,1.38,1.3)*(0.92+0.16*bgN(bP*1.3)), vec3(0.62,0.58,0.55), crack*(0.3+0.7*bFade)), crust);",
        /* ridge crowns and the belly crown: drier, lighter, lumpy */
        "bT*=mix(vec3(1.0), vec3(1.28,1.22,1.12), dryK*0.75); bH+=dryK*bgN(bP*5.0)*0.016*bFade;",
        /* tread prints in the churned tracks */
        "bH+=bWet*(1.0-film)*(1.0-wSoup)*sin(bP.x*19.0)*0.004*bFade;",
        /* water darkens what's under it */
        "bT*=mix(vec3(1.0), vec3(0.5,0.5,0.55), film);",
        "diffuseColor.rgb*=bT;",
        "float bRT=mix(mix(0.34,0.2,thick),0.92,crust); bRT=mix(bRT,0.07,film); bRT=mix(bRT,0.82,dryK);",
        "#ifdef BOG_LITE",
        "bRT=max(bRT,0.24);   /* no ripples to break it up: keep the sun off a flat mirror */",
        "#endif"].join("\n"))
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,bRT,0.88);")
      .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n#ifndef BOG_LITE\nnormal=bgBump(-vViewPosition, normal, bH);\n#endif");
  };
  mat.customProgramCacheKey=function(){ return (prevKey?prevKey.call(this):"")+"|bogmud"; };
  mat.extensions=Object.assign(mat.extensions||{}, {derivatives:true});
  mat.needsUpdate=true;
}
/* berms: rough dirt banks, one long one each side (low on the crowd side so low cameras see over it, 2.6 m on the far side),
   a 3 m bank across the far end; one mesh. Mud splatter on the faces that look into the pit. */
function bogPitBerms(len, lite){
  var key=len+"|"+(lite?"l":GFX); if(BOG.bermKey===key && BOG.bermMesh) return; BOG.bermKey=key;
  if(BOG.bermMesh){ BOG.scene.remove(BOG.bermMesh); BOG.bermMesh.geometry.dispose(); }
  var pos=[], col=[], spl=[], idx=[], n=0, cDry=sc(0x6d5438), cMid=sc(0x553b25), cWet=sc(0x2a1d12), sd=7;
  /* a bank along a line: xs stations, each a cross-section [offset out from the toe, height, wet 0..1, splatter 0..1] */
  function bank(st, prof, place){
    var np=prof.length;
    st.forEach(function(s, i){ var t=s.t, hk=s.h;
      prof.forEach(function(p, j){ var o=p[0], hh=p[1]*hk*(0.86+0.28*fbm(t/9+sd, j/np+place.k, 2, 2, 11)), w=place(t, o+(j>0&&j<np-1?0.25*(hashi(i,j,place.k*7)-0.5):0), Math.max(-0.02,hh+(j>0&&j<np-1?0.12*(hashi(i,j,3+place.k)-0.5):0)));
        pos.push(w[0],w[1],w[2]); var c=cMid.clone().lerp(cDry, clamp(p[1]-0.3,0,1)*0.8).lerp(cWet, p[2]); c.multiplyScalar(0.85+0.3*hashi(i,j,5+place.k)); col.push(c.r,c.g,c.b); spl.push(p[3]); }); });
    for(var i=0;i<st.length-1;i++) for(var j=0;j<np-1;j++){ var a=n+i*np+j, b=a+np; if(place.flip) idx.push(a,a+1,b, b,a+1,b+1); else idx.push(a,b,a+1, b,b+1,a+1); }
    n+=st.length*np;
  }
  var step=lite?4:1.2, st=[], x;
  for(x=-6;x<=len+13.01;x+=step){ st.push({t:x, h:Math.min(1,(x+6)/4,(len+13.5-x)/2.5)}); }
  var farP=lite?[[0,0,1,0.6],[1.3,0.92,0.4,0.8],[2.4,1,0,0.4],[4.6,0,0,0]]:[[0,0,1,0.6],[0.35,0.32,0.9,0.9],[0.9,0.78,0.6,1],[1.6,1,0.2,0.7],[2.3,0.94,0,0.3],[3.3,0.5,0,0.1],[4.6,0,0,0]];
  var nearP=lite?[[0,0,1,0.6],[0.8,0.95,0.5,0.8],[1.6,0.8,0.1,0.3],[2.8,0,0,0]]:[[0,0,1,0.6],[0.3,0.5,0.85,1],[0.75,0.95,0.5,0.9],[1.3,1,0.1,0.5],[2.0,0.55,0,0.2],[2.8,0,0,0]];
  var pf=function(t,o,h){ return [t, h*2.6-0.03, BOG_W/2+0.05+o]; }; pf.k=1; pf.flip=true; bank(st, farP, pf);
  var pn=function(t,o,h){ return [t, h*1.05-0.03, -(BOG_W/2+0.05+o)]; }; pn.k=2; pn.flip=false; bank(st, nearP, pn);
  var se=[]; for(var zz=-11;zz<=11.01;zz+=lite?5.5:1.4) se.push({t:zz, h:1-0.35*smoothstep(7,11,Math.abs(zz))});
  var pe=function(t,o,h){ return [len+12.6+o, h*3.0-0.03, t]; }; pe.k=3; pe.flip=false; bank(se, farP, pe);
  var g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); g.setAttribute("color",new THREE.Float32BufferAttribute(col,3)); g.setAttribute("aSpl",new THREE.Float32BufferAttribute(spl,1)); g.setIndex(idx); g.computeVertexNormals();
  var m=BOG.mats.berm; if(!m){ m=BOG.mats.berm=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.95});
    m.onBeforeCompile=function(sh){
      sh.vertexShader="attribute float aSpl; varying float vSpl; varying vec3 vBP;\n"+sh.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nvSpl=aSpl; vBP=transformed;");
      sh.fragmentShader="varying float vSpl; varying vec3 vBP;\n"+BOG_GLSL_NOISE+"\n"+sh.fragmentShader
        .replace("#include <color_fragment>", "#include <color_fragment>\nvec2 bq=vBP.xz+vec2(vBP.y*0.7,vBP.y*1.3); float bS=smoothstep(0.6,0.66,bgN(bq*2.4)*0.55+bgN(bq*8.0)*0.45)*vSpl; float bL=bgN(bq*3.0)*0.5+bgN(bq*11.0)*0.5;\ndiffuseColor.rgb=mix(diffuseColor.rgb*(0.85+0.3*bL), vec3(0.05,0.034,0.021), bS*0.88);")
        .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,0.32,bS);")
        .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n#ifndef BOG_LITE\nnormal=bgBump(-vViewPosition, normal, bL*0.06+bS*0.012);\n#endif"); };
    m.customProgramCacheKey=function(){ return "bogberm"; }; m.extensions={derivatives:true}; }
  m.defines=lite?{BOG_LITE:""}:{}; m.needsUpdate=true;
  var mesh=new THREE.Mesh(g, m); mesh.castShadow=!lite; mesh.receiveShadow=true; BOG.scene.add(mesh); BOG.bermMesh=mesh;
  /* the distance boards stand on the far berm's crest, where the stands can read them */
  if(BOG.marks) BOG.marks.forEach(function(gp){ gp.position.z=BOG_W/2+2.2; gp.position.y=2.3; });
}
/* the truck's frame height above its tyre contact (world metres): the model's own figure if it gives one */
function bogFrameY(U){ return (U.frameY!=null?U.frameY:U.rr*1.3)*(U.k||1); }
/* ===========================================================================
   BOAT DRAGS SCENE — a river course the view cuts to while ENGINE_VIS.setBoat({on:true, ...}) is fed every frame.
   Units metres, +x down the course: the start buoys at x = 0, the finish buoys at 304.8 m (1,000 ft), the shutdown past
   them. Your boat runs the right lane (+z), the rival the left. The water is one plane with its own shader: on Lite a
   cheap animated tint, on Full/Ultra rolling normals, a fresnel sky and a sun glint. Grass banks with a crowd, a tree on a
   float between the lanes, timing towers at the finish, buoys that bob. Each boat sits in the water, climbs the hump and
   planes (a hydro props-rides and skips on its sponsons); rooster tails, hull spray and a foam wake behind it.
   ==========================================================================*/
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
           /* finer capillary ripples near the camera (a second on Ultra) so the glint breaks up instead of sliding as one smooth sheet */
           " vec2 q2=p*5.3+vec2(-uT*0.9,uT*0.6); g+=vec2(sn(q2)-0.5,sn(q2+3.1)-0.5)*0.1*k*(1.0-smoothstep(5.0,45.0,d));"+(GFX==="ultra"?
           " vec2 q3=p*14.0+vec2(uT*1.3,-uT*0.8); g+=vec2(sn(q3)-0.5,sn(q3+5.7)-0.5)*0.07*k*(1.0-smoothstep(3.0,22.0,d));":"")+
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
  "#if STRIP_TIER>=1",
  "  float gh, dh, gvH; vec3 gm=sfGrassFx(p,gh), dm=sfDirtFx(p,0.35,dh), gvm=sfGravelFx(p,gvH);",
  "  float rip=0.5+0.5*sin(p.y*2.3+3.0*sn(p*0.5)); dm*=1.0+0.08*(rip-0.5);",
  "  grass*=gm; sand*=dm; c=mix(grass,sand,edge); c=mix(c,vec3(0.3,0.28,0.24)*(0.8+0.3*sn(p*0.8)),lot); c*=mix(vec3(1.0),gvm,lot);",
  "  gH=mix(mix(gh,dh+0.008*rip,edge),gvH,lot); gHK=1.0;",
  "  float fa=1.0-smoothstep(150.0,190.0,abs(p.y)); gH*=fa;",
  "#endif",
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
  var sky=new THREE.Mesh(new THREE.SphereGeometry(2600,40,20), stripSkyMat()); sky.frustumCulled=false; stripSkyLate(sky); S3.add(sky); BOAT.sky=sky;
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
/* the shore crowd bounces at one pace whatever the cheer (no wild mode: same bar and beat at cheer>1) */
var BOAT_CROWD={decay:0.3, lo:0.35, hi:0.35, f0:8, f1:8, amp:0.18, body:0.4, head:0.93};
function boatCrowd(dt){ crowdTick(BOAT, dt, BOAT_CROWD); }
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
  sceneCut(BOAT, s); BOAT.shotT+=dt; var T=BOAT.shotT, fov=45, rel=false, ax=0, sm=0, zz=BOAT_LZ;
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
  BOAT.shake*=Math.exp(-dt*3.5); var sh=CALM?0:BOAT.shake; if(sh>0.002){ BOAT.camPos.x+=(Math.random()-0.5)*sh*0.3; BOAT.camPos.y+=(Math.random()-0.5)*sh*0.3; }
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
  var sky=new THREE.Mesh(new THREE.SphereGeometry(3000, 40, 20), stripSkyMat()); sky.frustumCulled=false; stripSkyLate(sky); S4.add(sky); W.sky=sky;
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
/* the ghost of your best lap: a see-through pale blue car at s (m), or hidden when s is null */
function roadGhost(W, T, s){
  var g=W.ghost;
  if(s==null || !isFinite(s)){ if(g) g.visible=false; return; }
  if(!g){
    var m=new THREE.MeshBasicMaterial({color:0x9fd3ff, transparent:true, opacity:0.35, depthWrite:false});
    var bodyG=new THREE.BoxGeometry(4.4,0.72,1.86); bodyG.translate(0,0.56,0);
    var cabG=new THREE.BoxGeometry(2.0,0.52,1.5); cabG.translate(-0.4,1.17,0);
    g=W.ghost=new THREE.Group(); g.add(new THREE.Mesh(bodyG, m)); g.add(new THREE.Mesh(cabG, m)); W.scene.add(g);
  }
  var N=T.N, fi=((s/T.ds)%N+N)%N; g.visible=true; roadPt(T, fi, 0, 0, g.position); g.rotation.set(0, roadHd(T, fi), 0);
}
function roadUpdate(o, dt){
  var T=o.track; if(!T) return;
  var W=ROAD.worlds[T.id]; if(!W){ W=ROAD.worlds[T.id]=buildRoadWorld(T); }
  if(ROAD.W!==W){ if(ROAD.car && ROAD.car.parent) ROAD.car.parent.remove(ROAD.car); ROAD.W=W; ROAD.carKey=""; ROAD.snap=true; ROAD.shot=null; }
  if(o.sky!=null) roadSetSky(W, clamp(+o.sky,0,1), clamp(+o.warm||0,0,1), !!o.dawn);
  else { if(W.skyKey!=null) roadSkyReset(W); if(W.tier!==GFX || W.night!==!!o.night) roadSetNight(W, !!o.night); }
  if(o.field) roadFieldUpdate(W, T, o.field, +o.sky||0); else roadFieldHide(W);
  roadGhost(W, T, o.ghost);
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

/* ===========================================================================
   SALT FLATS SCENE — Bitterwater land-speed runs, a fourth world the view cuts
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
    vertexShader:"varying vec3 vDir; void main(){ vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position.z=gl_Position.w; }",
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
  var sky=new THREE.Mesh(new THREE.SphereGeometry(2600, 40, 20), saltSkyMat()); sky.frustumCulled=false; stripSkyLate(sky); S4.add(sky); SALT.sky=sky;
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
  sceneCut(SALT, s);
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
  SALT.shake*=Math.exp(-dt*4); var sh=CALM?0:SALT.shake; if(sh>0.002){ SALT.camPos.y+=(Math.random()-0.5)*sh*0.25; SALT.camPos.z+=(Math.random()-0.5)*sh*0.25; }
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

/* ===========================================================================
   SALT CARS (v2) — the Bitterwater cars, built like the real ones.
   Streamliner: flat sides, flat bottom, wheels behind skirts, a chisel or
   needle nose, canopy, headrest fairing, tail fin, chute tubes.
   Lakester: a belly tank on a narrow track, Moon discs on tall skinny tyres.
   Modified roadster: a '32 grille shell, the engine out in the open, roll bar.
   Altered: the strip's muscle shell set up for the salt (number boards, taped
   lights, chute pack, Moon discs). Every car shows the engine it runs (stacks,
   blower hat, turbos, diesel stacks, rotary, two-stroke pipes) and carries a
   dense livery: number, class plate, sponsor blocks.
   Geometry is merged per material (one draw call each); wheels on the salt
   wear Moon discs, so they are round and need no spin and merge too.
   SALT.look (ENGINE_VIS.saltLook) = the player's paint, the meet number, the
   class and the engine; saltRivalLook(seed) gives any other car its own.
   ==========================================================================*/
var SLC={ geo:{}, mat:{} };
var SL_SPONSORS=[
  {id:"sl_pew", n:"PRAIRIE", t:"ENGINE WORKS", c1:"#f4efe2", c2:"#c0392b", c3:"#1a1a1a", s:"shield"},
  {id:"sl_wen", n:"WENDOVER", t:"SPEED SHOP", c1:"#c62a22", c2:"#f4efe2", c3:"#ffffff", s:"bolt"},
  {id:"sl_scb", n:"SALT CITY", t:"BEARINGS", c1:"#1d3f8f", c2:"#f2c230", c3:"#ffffff", s:"gear"},
  {id:"sl_blo", n:"BLACK LINE", t:"RACING OIL", c1:"#141414", c2:"#e8b21b", c3:"#f4efe2", s:"drop"},
  {id:"sl_sip", n:"SILVER ISLE", t:"PISTONS", c1:"#d9dde2", c2:"#2a2a2a", c3:"#1a1a1a", s:"ring"},
  {id:"sl_m3t", n:"MILE THREE", t:"TIMING", c1:"#f28c1a", c2:"#141414", c3:"#141414", s:"diamond"},
  {id:"sl_alk", n:"ALKALI", t:"FUEL CO.", c1:"#2c6b3a", c2:"#f4efe2", c3:"#f4efe2", s:"leaf"},
  {id:"sl_ftw", n:"FLATS", t:"TIRE & WHEEL", c1:"#202a36", c2:"#cfd3d8", c3:"#ffffff", s:"star"},
  {id:"sl_ktc", n:"KNOT-TIGHT", t:"CHUTES", c1:"#e5562b", c2:"#f4efe2", c3:"#ffffff", s:"wing"},
  {id:"sl_lsr", n:"FIVE MILE", t:"GEAR & AXLE", c1:"#5b2a86", c2:"#f2c230", c3:"#ffffff", s:"gear"}];
var SL_RIVAL_PAINT=[0x1d4787,0xd9a52b,0xb7261d,0xe9e6dc,0x16181b,0x2c6b3a,0xd85f14,0x2b8a9e,0x5b2a86,0xa9aeb5,0xc23b6e,0x7a1f1f];

/* --- the look ------------------------------------------------------------ */
function slEngKey(E){ return E?[E.kind,E.n,E.rotors,E.asp,E.screw?1:0,E.diesel?1:0,E.inj?1:0,E.carb?1:0,E.cover>>>0].join(","):"-"; }
function slHash(s){ var h=2166136261; s=String(s); for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function slRng(seed){ var a=(seed>>>0)||1; return function(){ a=(a+0x6D2B79F5)>>>0; var t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
function slLum(c){ var q=new THREE.Color(c); return 0.2126*q.r+0.7152*q.g+0.0722*q.b; }
/* the second colour: a contrasting stripe/fin/helmet colour that still suits the paint */
function slAccent(color){ var l=slLum(color); return l>0.6?0x16181b:l<0.08?0xd9a52b:0xf2eee4; }
/* normalise whatever the app (or a harness) hands over: {color, accent, num, cls, cfg|eng, nose, sponsors, rival} */
function slLook(o){
  o=o||{}; var col=o.color!=null?(o.color>>>0):0xd9a52b, E=o.eng||(o.cfg?slEngOf(o.cfg):(lastCfg?slEngOf(lastCfg, lastLayout):slEngOf({})));
  var sp=Array.isArray(o.sponsors)&&o.sponsors.length?o.sponsors:[0,1,2,3,4,5];
  var L={color:col, accent:o.accent!=null?(o.accent>>>0):slAccent(col), num:String(o.num!=null?o.num:((col%377)+11)).slice(0,4), cls:o.cls?String(o.cls).slice(0,9):"",
    eng:E, nose:o.nose==="needle"?"needle":"chisel", sponsors:sp.map(function(i){ return (+i||0)%SL_SPONSORS.length; }), rival:!!o.rival, moon:o.moon==="paint"?"paint":"chrome"};
  L.key=[L.color,L.accent,L.num,L.cls,L.nose,L.sponsors.join("."),L.moon,slEngKey(E),GFX].join("|");
  return L;
}
/* any other car on the salt: its own paint, number, engine and sponsors, seeded */
function saltRivalLook(seed, body){
  var r=slRng(slHash("salt|"+seed)), pick=function(a){ return a[Math.floor(r()*a.length)]; };
  var kinds=[["v",8,"blower"],["v",8,"na"],["v",8,"twin"],["i",6,"turbo"],["i",4,"turbo"],["flat",4,"na"],["i",6,"diesel"],["rotary",2,"na"],["two",3,"na"],["v",8,"turbo"],["i",6,"na"],["v",12,"na"]];
  var k=pick(kinds), dsl=k[2]==="diesel", asp=dsl?"turbo":k[2];
  var E={kind:k[0], n:k[1], rotors:k[0]==="rotary"?2:0, asp:asp, screw:asp==="blower"&&r()<0.3, diesel:dsl, inj:asp==="na"&&r()<0.7, carb:false, ic:asp!=="na"&&asp!=="blower", n2o:false,
    cover:pick([0xa32a26,0x1b1d20,0xd85f14,0x1f4fa8,0xc9ced4])};
  var col=pick(SL_RIVAL_PAINT), sp=[], i; while(sp.length<5){ i=1+Math.floor(r()*(SL_SPONSORS.length-1)); if(sp.indexOf(i)<0) sp.push(i); }
  var num=r()<0.3?String(10+Math.floor(r()*90)):String(100+Math.floor(r()*900));
  var disp=pick(["AA","A","B","C","D","E","F","G"]), fu=dsl?"D":r()<0.55?"F":"G", code={streamliner:"S",lakester:"L",roadster:"MR",altered:"ALT"}[body]||"S";
  return slLook({color:col, accent:r()<0.5?slAccent(col):pick([0xf2eee4,0x16181b,0xd9a52b,0xb7261d]), num:num, cls:disp+"/"+(asp!=="na"?"B":"")+fu+code, eng:E,
    nose:r()<0.5?"needle":"chisel", sponsors:sp, rival:true, moon:r()<0.3?"paint":"chrome"});
}
function saltSetLook(o){ SALT.look=o?slLook(o):null; return SALT.look; }

/* --- the livery atlas: number board, bare numerals, class plate, sponsor blocks, a sponsor rail ---------- */
var SL_ATL={W:1024, H:512, numB:[0,0,320,200], numT:[320,0,384,200], cls:[704,0,320,100], tech:[704,100,104,100], club:[808,100,216,100],
  sp:[[0,200,340,104],[340,200,340,104],[680,200,344,104],[0,304,340,104],[340,304,340,104],[680,304,344,104]], rail:[0,408,1024,104]};
function slSponsor(x, sp, x0, y0, w, h){
  var F="'Barlow Condensed','Arial Narrow',Arial,sans-serif", m=6;
  spRRect(x, x0+m, y0+m, w-2*m, h-2*m, 12); x.fillStyle=sp.c1; x.fill(); x.lineWidth=4; x.strokeStyle=sp.c2; spRRect(x, x0+m+7, y0+m+7, w-2*m-14, h-2*m-14, 8); x.stroke();
  spShape(x, sp.s, x0+h*0.52, y0+h/2, h*0.27, sp.c2, sp.c1);
  x.textAlign="left"; x.textBaseline="alphabetic"; x.fillStyle=sp.c3; x.font="italic 700 "+Math.round(h*0.42)+"px "+F; x.fillText(sp.n, x0+h*0.92, y0+h*0.58, w-h*1.05);
  x.fillStyle=sp.c2; x.font="600 "+Math.round(h*0.19)+"px "+F; x.fillText(sp.t, x0+h*0.94, y0+h*0.82, w-h*1.1);
}
function slAtlas(L){
  var key="atl|"+L.key; if(SLC.mat[key]) return SLC.mat[key];
  var A=SL_ATL, c=newCanvas(A.W, A.H), x=c.getContext("2d"), F="'Chakra Petch','Barlow Condensed','Arial Narrow',Arial,sans-serif", R, i;
  x.clearRect(0,0,A.W,A.H);
  /* number board: white, black border, the number big */
  R=A.numB; spRRect(x, R[0]+8, R[1]+8, R[2]-16, R[3]-16, 18); x.fillStyle="#f4efe2"; x.fill(); x.lineWidth=8; x.strokeStyle="#141414"; x.stroke();
  x.fillStyle="#141414"; x.textAlign="center"; x.textBaseline="middle"; x.font="700 "+(L.num.length>3?118:150)+"px "+F; x.fillText(L.num, R[0]+R[2]/2, R[1]+R[3]/2+8, R[2]-40);
  /* bare numerals in the contrasting colour, outlined */
  R=A.numT; var light=slLum(L.color)>0.45; x.font="italic 700 176px "+F; x.lineJoin="round"; x.lineWidth=14; x.strokeStyle=light?"#f4efe2":"#141414";
  x.strokeText(L.num, R[0]+R[2]/2, R[1]+R[3]/2+10, R[2]-30); x.fillStyle=light?"#141414":"#f4efe2"; x.fillText(L.num, R[0]+R[2]/2, R[1]+R[3]/2+10, R[2]-30);
  /* class plate: what the car runs in, e.g. AA/BFS */
  R=A.cls; x.fillStyle="#f4efe2"; x.fillRect(R[0]+4, R[1]+4, R[2]-8, R[3]-8); x.lineWidth=6; x.strokeStyle="#141414"; x.strokeRect(R[0]+8, R[1]+8, R[2]-16, R[3]-16);
  x.fillStyle="#141414"; x.font="700 20px "+F; x.save(); x.translate(R[0]+28, R[1]+R[3]/2); x.rotate(-PI/2); x.fillText("CLASS", 0, 0); x.restore();
  x.font="700 74px "+F; x.fillText(L.cls||"—", R[0]+R[2]/2+16, R[1]+R[3]/2+5, R[2]-60);
  /* tech sticker and a meet sticker */
  R=A.tech; x.fillStyle="#e8b21b"; x.beginPath(); x.arc(R[0]+R[2]/2, R[1]+R[3]/2, 46, 0, TAU); x.fill(); x.fillStyle="#141414"; x.font="700 26px "+F; x.fillText("TECH", R[0]+R[2]/2, R[1]+R[3]/2-10); x.font="700 22px "+F; x.fillText("✓ OK", R[0]+R[2]/2, R[1]+R[3]/2+16);
  R=A.club; x.fillStyle="#1d3f8f"; spRRect(x, R[0]+6, R[1]+10, R[2]-12, R[3]-20, 10); x.fill(); x.fillStyle="#f4efe2"; x.font="italic 700 34px "+F; x.fillText("SPEED WEEK", R[0]+R[2]/2, R[1]+R[3]/2-6, R[2]-24); x.font="600 18px "+F; x.fillText("BITTERWATER · SALT FLATS", R[0]+R[2]/2, R[1]+R[3]/2+22, R[2]-24);
  /* sponsor blocks */
  for(i=0;i<A.sp.length;i++){ R=A.sp[i]; slSponsor(x, SL_SPONSORS[L.sponsors[i%L.sponsors.length]], R[0], R[1], R[2], R[3]); }
  /* the rail: a row of small sponsor blocks */
  R=A.rail; for(i=0;i<4;i++) slSponsor(x, SL_SPONSORS[L.sponsors[(i+2)%L.sponsors.length]], R[0]+i*256, R[1]+10, 256, 84);
  var t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=MAXANISO;
  var q=new THREE.MeshStandardMaterial({map:t, transparent:true, depthWrite:false, roughness:0.35, metalness:0.05, polygonOffset:true, polygonOffsetFactor:-3, polygonOffsetUnits:-3});
  var env=sc_env(); if(env) q.envMap=env;
  q.userData.perBuild=true; q.userData.ownMaps=[t]; SLC.mat[key]=q; return q;
}
/* a decal quad: atlas region R, centre p, along u (text direction), up v, size w x h */
function slDecal(B, R, p, u, v, w, h){
  var g=new THREE.PlaneGeometry(1,1), uv=g.attributes.uv, A=SL_ATL, u0=R[0]/A.W, u1=(R[0]+R[2])/A.W, v0=1-(R[1]+R[3])/A.H, v1=1-R[1]/A.H;
  for(var i=0;i<uv.count;i++) uv.setXY(i, u0+uv.getX(i)*(u1-u0), v0+uv.getY(i)*(v1-v0));
  var U=new THREE.Vector3().fromArray(u), V=new THREE.Vector3().fromArray(v), N=new THREE.Vector3().crossVectors(U,V), m=new THREE.Matrix4().makeBasis(U,V,N);
  m.scale(new THREE.Vector3(w,h,1)); m.setPosition(p[0],p[1],p[2]); B.add("decal", g, m);
}
/* the same decal on both flat sides at |z| = zs (text reads forward on each side) */
function slDecal2(B, R, x, y, zs, w, h){ slDecal(B, R, [x,y,zs], [1,0,0], [0,1,0], w, h); slDecal(B, R, [x,y,-zs], [-1,0,0], [0,1,0], w, h); }

/* a decal wrapped onto a body of revolution: centre x, height yc+dy, side sd; rFn(x) = the section's (y, z) half axes */
function slDecalTank(B, R, x, yc, dy, w, h, sd, rFn){
  var g=new THREE.PlaneGeometry(1,1,6,4), uv=g.attributes.uv, P=g.attributes.position, A=SL_ATL, u0=R[0]/A.W, u1=(R[0]+R[2])/A.W, v0=1-(R[1]+R[3])/A.H, v1=1-R[1]/A.H, i;
  for(i=0;i<uv.count;i++) uv.setXY(i, u0+uv.getX(i)*(u1-u0), v0+uv.getY(i)*(v1-v0));
  for(i=0;i<P.count;i++){ var u=P.getX(i), v=P.getY(i), X=x+sd*u*w, ab=rFn(X), Y=yc+dy+v*h, th=Math.asin(clamp((Y-yc)/ab[0],-0.98,0.98)); P.setXYZ(i, X, Y, sd*(ab[1]*Math.cos(th)+0.006)); }
  g.computeVertexNormals(); B.add("decal", g, new THREE.Matrix4());
}

/* --- geometry helpers ---------------------------------------------------- */
function slPchip(xs, ys){
  var n=xs.length, h=[], s=[], m=[], i;
  for(i=0;i<n-1;i++){ h[i]=xs[i+1]-xs[i]; s[i]=(ys[i+1]-ys[i])/h[i]; }
  m[0]=s[0]; m[n-1]=s[n-2];
  for(i=1;i<n-1;i++){ if(s[i-1]*s[i]<=0) m[i]=0; else { var w1=2*h[i]+h[i-1], w2=h[i]+2*h[i-1]; m[i]=(w1+w2)/(w1/s[i-1]+w2/s[i]); } }
  return function(x){ var k=0; while(k<n-2 && x>xs[k+1]) k++; var t=clamp((x-xs[k])/h[k],0,1), t2=t*t, t3=t2*t;
    return (2*t3-3*t2+1)*ys[k]+(t3-2*t2+t)*h[k]*m[k]+(-2*t3+3*t2)*ys[k+1]+(t3-t2)*h[k]*m[k+1]; };
}
/* a flat-sided loft: rows [x, bottom y, top y, half width, top corner r, bottom corner r, crown], rear -> front.
   Each station is a rounded rectangle (flat sides and bottom); the ends are capped. */
function slLoft(rows, k, sub){
  k=k||3; sub=sub||3; var n=rows.length, i, j, q, xs=rows.map(function(r){ return r[0]; }), F=[];
  for(j=1;j<=6;j++) F.push(slPchip(xs, rows.map(function(r){ return r[j]||0; })));
  var X=[]; for(i=0;i<n-1;i++) for(j=0;j<sub;j++) X.push(lerp(xs[i],xs[i+1],j/sub)); X.push(xs[n-1]);
  var ring=2+4*(k+1), pos=[], uv=[], idx=[], cen=[];
  X.forEach(function(x){
    var yb=F[0](x), yt=F[1](x), hw=Math.max(0.004,F[2](x)), H=Math.max(0.004,yt-yb), rt=Math.max(0,Math.min(F[3](x), hw*0.999, H*0.6)), rb=Math.max(0,Math.min(F[4](x), hw*0.999, H-rt)), cr=F[5](x), P=[], a;
    P.push([0,yb]);
    for(q=0;q<=k;q++){ a=-PI/2+q/k*PI/2; P.push([hw-rb+Math.cos(a)*rb, yb+rb+Math.sin(a)*rb]); }
    for(q=0;q<=k;q++){ a=q/k*PI/2; P.push([hw-rt+Math.cos(a)*rt, yt-rt+Math.sin(a)*rt]); }
    P.push([0,yt]);
    for(q=0;q<=k;q++){ a=PI/2+q/k*PI/2; P.push([-(hw-rt)+Math.cos(a)*rt, yt-rt+Math.sin(a)*rt]); }
    for(q=0;q<=k;q++){ a=PI+q/k*PI/2; P.push([-(hw-rb)+Math.cos(a)*rb, yb+rb+Math.sin(a)*rb]); }
    P.forEach(function(p, pi){ var y=p[1]; if(y>yb+H*0.5) y+=cr*(1-Math.pow(p[0]/hw,2)); pos.push(x, y, p[0]); uv.push((x-xs[0])/(xs[n-1]-xs[0]), pi/ring); });
    cen.push([x,(yb+yt)/2]);
  });
  var S=X.length;
  for(i=0;i<S-1;i++) for(q=0;q<ring;q++){ var a0=i*ring+q, b0=i*ring+(q+1)%ring, c0=(i+1)*ring+q, d0=(i+1)*ring+(q+1)%ring; idx.push(a0,c0,b0, b0,c0,d0); }
  var ct=pos.length/3; pos.push(cen[0][0],cen[0][1],0); uv.push(0,0.5); for(q=0;q<ring;q++) idx.push(ct, q, (q+1)%ring);
  var cn=pos.length/3, base=(S-1)*ring; pos.push(cen[S-1][0],cen[S-1][1],0); uv.push(1,0.5); for(q=0;q<ring;q++) idx.push(cn, base+(q+1)%ring, base+q);
  var g=new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos,3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/* a bevelled box (Full/Ultra) or a plain one (Lite: 12 triangles instead of ~100) */
function slBox(w, h, d, b){ if(GFX!=="lite") return sc_rbox(w, h, d, b); var key="lb"+[w,h,d].map(r3).join("_"); return SLC.geo[key]||(SLC.geo[key]=new THREE.BoxGeometry(w, h, d)); }
function slRod(B, key, a, b, r, seg){ B.add(key, sc_cyl(r, GFX==="lite"?Math.min(6, seg||8):(seg||8)), sc_rodM(a, b)); }
function slV(x,y,z){ return new THREE.Vector3(x,y,z); }
/* a cylinder along x (centre cx) or z */
function slCylX(B, key, cx, y, z, r, len, seg){ B.add(key, sc_cyl(r, GFX==="lite"?Math.min(8, seg||10):(seg||10)), sc_M(cx, y, z, 0, 0, -PI/2, 1, len, 1)); }
function slSph(r, ws, hs){ var key="sph"+r3(r)+"_"+ws; return SLC.geo[key]||(SLC.geo[key]=new THREE.SphereGeometry(r, ws||12, hs||8)); }
/* a Moon disc: a polished spherical cap over the whole rim (dome along +y before placing) */
function slMoonGeo(R, h, seg){ var key="moon"+r3(R)+"_"+r3(h)+"_"+seg; if(SLC.geo[key]) return SLC.geo[key];
  var pts=[], i, N=5; for(i=0;i<=N;i++){ var t=i/N; pts.push(new THREE.Vector2(Math.max(0.001,R*Math.sin(t*PI/2)), h*Math.cos(t*PI/2))); }
  pts.push(new THREE.Vector2(R*1.02, -0.004)); pts.reverse(); return (SLC.geo[key]=new THREE.LatheGeometry(pts, seg)); }
/* the strip's tyre profile; Lite lathes it with 12 sides instead of 18 */
function slTyre(r, w, rimR){ if(GFX!=="lite") return sc_tyreGeo(r, w, rimR); var key="lty"+[r,w,rimR].map(r3).join("_"); if(SLC.geo[key]) return SLC.geo[key];
  var hw=w/2, sh=Math.min(0.055,(r-rimR)*0.3), pr=[[rimR+0.004,0.86],[lerp(rimR,r,0.34),1],[lerp(rimR,r,0.74),1],[r-sh,0.965],[r-sh*0.22,0.82]], pts=[], i;
  for(i=0;i<pr.length;i++) pts.push(new THREE.Vector2(pr[i][0], -hw*pr[i][1])); for(i=pr.length-1;i>=0;i--) pts.push(new THREE.Vector2(pr[i][0], hw*pr[i][1]));
  return (SLC.geo[key]=new THREE.LatheGeometry(pts, 12)); }
/* a salt wheel: tyre + Moon discs both faces (static: round things need no spin) */
function slWheel(B, x, z, r, w, o){
  o=o||{}; var rimR=r*(o.rim||0.62), sd=z<0?-1:1, seg=GFX==="lite"?12:18;
  B.add("rubber", slTyre(r, w, rimR), sc_M(x, r, z, PI/2, 0, 0));
  if(o.disc===false || GFX!=="lite") B.add("well", new THREE.CircleGeometry(rimR*0.99, seg), sc_M(x, r, z+sd*w*0.2, 0, sd>0?0:PI, 0));
  if(o.disc!==false){ B.add(o.moon==="paint"?"paint":"chrome", slMoonGeo(rimR*0.98, rimR*0.22, seg), sc_M(x, r, z+sd*w*0.42, sd*PI/2, 0, 0));
    if(o.inner!==false) B.add("satin", new THREE.CircleGeometry(rimR*0.95, seg), sc_M(x, r, z-sd*w*0.38, 0, sd>0?PI:0, 0)); }
}
/* a seated driver: hips at (x,y,z), leaning back by lean (rad); fire suit, arms to the wheel, helmet + visor */
function slDriver(B, x, y, z, lean, o){
  o=o||{}; var c=Math.cos(lean), s=Math.sin(lean), up=function(d){ return slV(x-s*d, y+c*d, z); };
  B.add("suit", slBox(0.24, 0.5, 0.38, 0.06), sc_M(x-s*0.25, y+c*0.25, z, 0, 0, lean));
  B.add("suit", sc_cyl(0.06, 8), sc_M(x-s*0.53, y+c*0.53, z, 0, 0, lean, 1, 0.1, 1));
  var hc=up(0.68), sh=up(0.44);
  B.add("helm", slSph(0.15, GFX==="lite"?10:14, GFX==="lite"?8:10), sc_M(hc.x, hc.y, hc.z, 0, 0, lean, 1, 1.08, 0.95));
  B.add("visor", slBox(0.07, 0.1, 0.25, 0.03), sc_M(hc.x+c*0.115, hc.y+s*0.115-0.005, hc.z, 0, 0, lean));
  B.add("acc", slBox(0.3, 0.03, 0.035, 0.01), sc_M(hc.x-s*0.15, hc.y+c*0.15, hc.z, 0, 0, lean));
  if(o.wheel){ var wx=o.wheel[0], wy=o.wheel[1];
    B.add("black", new THREE.TorusGeometry(0.15, 0.016, 5, GFX==="lite"?10:16), sc_M(wx, wy, z, 0, PI/2, 0.35));
    [-1,1].forEach(function(sd){ slRod(B, "suit", slV(sh.x, sh.y-0.04, z+sd*0.17), slV(wx-0.05, wy-0.02, z+sd*0.12), 0.045, 6); }); }
}
/* the roll bar: a hoop across the car at x (height top, half width hw from y0) + a brace back */
function slHoop(B, x, y0, top, hw, back){
  var R=hw, hg=Math.max(0.01, top-y0-R);
  B.add("chrome", new THREE.TorusGeometry(R, 0.024, 6, 14, PI), sc_M(x, y0+hg, 0, 0, PI/2, 0));
  [-1,1].forEach(function(sd){ slRod(B, "chrome", slV(x, y0, sd*R), slV(x, y0+hg, sd*R), 0.024, 8); });
  if(back!=null) slRod(B, "chrome", slV(x, top-0.02, 0), slV(back[0], back[1], 0), 0.02, 8);
}
/* the chute pack: a bag on a bracket */
function slChutePack(B, x, y, z){ if(GFX==="lite"){ B.add("black", slBox(0.22, 0.26, 0.3, 0.05), sc_M(x, y, z)); return; } B.add("bag", slBox(0.22, 0.26, 0.3, 0.05), sc_M(x, y, z)); B.add("black", slBox(0.04, 0.3, 0.06, 0.01), sc_M(x+0.02, y, z)); B.add("canopyT", slBox(0.05, 0.05, 0.31, 0.01), sc_M(x-0.09, y+0.06, z)); }

/* --- the engine you can see ---------------------------------------------------------------------------
   slEngine(B, E, o): o.x engine centre, o.y deck (where the intake sits), o.open = the whole engine (block, covers,
   headers) or only what pokes through the body (the hat / stacks / scoops). o.exh: "zoomie" | "side" | "none";
   side pipes run back to o.sideX at o.sideZ. Exhaust tips (for the smoke) go into o.tips. Returns the top y. */
function slEngine(B, E, o){
  var x=o.x, y=o.y, open=!!o.open, lite=GFX==="lite", tips=o.tips||[], top=y, i, sd, k;
  var banks=E.kind==="v"||E.kind==="flat"?2:1, per=E.kind==="rotary"?E.rotors:E.kind==="two"?Math.min(4,E.n):Math.max(1, Math.ceil(E.n/banks)), len=E.kind==="rotary"?0.14*per+0.18:E.kind==="two"?0.17*per+0.1:0.105*per+0.16;
  var x0=x+len/2, x1=x-len/2;
  /* block, heads, covers */
  if(open){
    if(E.kind==="v"){ B.add("engine", slBox(len, 0.3, 0.44, 0.03), sc_M(x, y-0.2, 0)); B.add("black", slBox(len*0.9, 0.12, 0.3, 0.03), sc_M(x, y-0.41, 0));
      for(sd=-1;sd<=1;sd+=2){ B.add("engine", slBox(len*0.96, 0.12, 0.16, 0.02), sc_M(x, y-0.06, sd*0.2, sd*0.55, 0, 0)); B.add("cover", slBox(len*0.92, 0.07, 0.15, 0.025), sc_M(x, y+0.02, sd*0.25, sd*0.55, 0, 0)); }
      slCylX(B, "chrome", x0+0.04, y-0.24, 0, 0.09, 0.05, 14); }
    else if(E.kind==="flat"){ B.add("engine", slBox(len, 0.26, 0.36, 0.03), sc_M(x, y-0.2, 0));
      for(sd=-1;sd<=1;sd+=2){ B.add("engine", slBox(len*0.96, 0.2, 0.12, 0.02), sc_M(x, y-0.2, sd*0.27)); B.add("cover", slBox(len*0.92, 0.16, 0.07, 0.025), sc_M(x, y-0.2, sd*0.36)); } }
    else if(E.kind==="i"){ var th=E.diesel?0.46:0.36; B.add("engine", slBox(len, th, 0.28, 0.03), sc_M(x, y-th/2-0.06, 0)); B.add("black", slBox(len*0.9, 0.12, 0.26, 0.03), sc_M(x, y-th-0.1, 0));
      B.add("engine", slBox(len*0.98, 0.1, 0.26, 0.02), sc_M(x, y-0.03, 0)); B.add(E.diesel?"satin":"cover", slBox(len*0.94, 0.08, 0.22, 0.03), sc_M(x, y+0.05, 0));
      slCylX(B, "chrome", x0+0.04, y-th*0.7, 0, 0.08, 0.05, 14); }
    else if(E.kind==="rotary"){
      for(i=0;i<2*per+1;i++) B.add(i%2?"black":"alu", slBox(0.06, 0.34, 0.42, 0.03), sc_M(x0-0.03-i*((len-0.04)/(2*per)), y-0.2, 0));
      /* the cue: a rotor triangle on the front cover */
      var tri=new THREE.Shape(); for(i=0;i<3;i++){ var a=PI/2+i*TAU/3, b=a+TAU/3, ca=[Math.cos(a)*0.12, Math.sin(a)*0.12], cb=[Math.cos(b)*0.12, Math.sin(b)*0.12], cm=[Math.cos(a+TAU/6)*0.085, Math.sin(a+TAU/6)*0.085];
        if(!i) tri.moveTo(ca[0],ca[1]); tri.quadraticCurveTo(cm[0],cm[1],cb[0],cb[1]); }
      B.add("cover", new THREE.ExtrudeGeometry(tri, {depth:0.03, bevelEnabled:false, curveSegments:4}), sc_M(x0+0.005, y-0.2, 0, 0, PI/2, 0));
      slCylX(B, "chrome", x0+0.05, y-0.2, 0, 0.03, 0.08, 8); }
    else if(E.kind==="two"){
      B.add("engine", slBox(len, 0.24, 0.3, 0.04), sc_M(x, y-0.32, 0));
      var nf=lite?4:8;
      for(i=0;i<per;i++){ var cx=x0-0.1-i*0.17; for(k=0;k<nf;k++) B.add("alu", sc_cyl(0.075, 10), sc_M(cx, y-0.2+k*(0.2/nf), 0, 0,0,0, 1, 0.012, 1));
        B.add("engine", sc_cyl(0.05, 10), sc_M(cx, y-0.1, 0, 0,0,0, 1, 0.22, 1)); B.add("satin", slBox(0.1, 0.05, 0.1, 0.02), sc_M(cx, y+0.03, 0)); }
    }
  }
  /* induction */
  if(E.kind==="two"){   /* reed carbs on the side, bell mouths out */
    for(i=0;i<per;i++){ var cx2=x0-0.1-i*0.17; slRod(B, "alu", slV(cx2, y-0.25, 0.12), slV(cx2, y-0.22, 0.26), 0.03, 8); B.add("chrome", new THREE.CylinderGeometry(0.05, 0.03, 0.06, 10, 1, true), sc_M(cx2, y-0.215, 0.29, PI/2, 0, 0)); }
    top=Math.max(top, y+0.08);
  } else if(E.asp==="blower"){
    var bl=Math.min(0.62, len*0.85);
    B.add("alu", slBox(bl, 0.2, E.screw?0.3:0.28, E.screw?0.08:0.03), sc_M(x, y+0.12, 0));
    if(!lite) for(i=0;i<5;i++) B.add("satin", slBox(0.012, 0.13, E.screw?0.31:0.29, 0.004), sc_M(x-bl*0.4+i*bl*0.2, y+0.12, 0));
    B.add("satin", slBox(bl+0.04, 0.035, 0.32, 0.012), sc_M(x, y+0.235, 0));
    /* the injector hat (bug catcher): an open mouth facing forward, butterflies inside */
    B.add("chrome", sc_prof([[0.16,0],[0.2,0.25],[0.06,0.29],[-0.17,0.23],[-0.17,0]], 0.27, 0.012), sc_M(x+0.03, y+0.25, 0));
    B.add("well", slBox(0.02, 0.19, 0.22, 0.006), sc_M(x+0.215, y+0.38, 0, 0, 0, 0.16));
    B.add("black", slBox(0.035, 0.42, 0.11, 0.012), sc_M(x0+0.05, y-0.02, 0));   /* drive belt */
    top=Math.max(top, y+0.55);
  } else if(E.asp==="turbo"||E.asp==="twin"||E.asp==="centri"){
    B.add("alu", slBox(len*0.8, 0.13, 0.22, 0.03), sc_M(x, y+0.09, 0));   /* plenum */
    var tz=E.kind==="i"?[-0.32]:E.asp==="twin"?[-0.4,0.4]:[0.4], ty=open?y-0.12:y+0.02;
    if(E.asp==="centri"){ tz=[0.0]; }
    tz.forEach(function(z){ var tx=E.asp==="centri"?x0+0.15:x+len*0.15, yy=E.asp==="centri"?y+0.05:ty;
      B.add("alu", sc_cyl(0.11, 16), sc_M(tx, yy, z, PI/2, 0, 0, 1, 0.1, 1));
      sc_bell(B, tx+0.09, yy+0.03, z, 0.07);
      if(E.asp!=="centri") B.add("satin", sc_cyl(0.09, 14), sc_M(tx-0.02, yy, z+(z<0?-0.1:0.1), PI/2, 0, 0, 1, 0.08, 1));
      slRod(B, "alu", slV(tx+0.02, yy+0.1, z), slV(x+len*0.3, y+0.12, z*0.25), 0.04, 10);
      if(E.asp!=="centri"){ var sp=slV(tx-0.12, yy+0.05, z*1.05), st=slV(tx-0.18, yy+0.4+(open?0:0.05), z*1.08); slRod(B, "chrome", sp, st, 0.028, 8); tips.push(st.clone()); }
    });
    B.add("alu", sc_cyl(0.06, 12), sc_M(x0+0.02, y+0.1, 0, 0, 0, -PI/2, 1, 0.08, 1));
    top=Math.max(top, y+(E.asp==="centri"?0.18:0.45));
  } else if(E.inj || E.kind==="rotary"){   /* injector stacks: a trumpet per cylinder (two per rotor) */
    var rows=banks===2&&E.kind==="v"?[-1,1]:[0], ns=E.kind==="rotary"?per*2:per, hS=E.kind==="rotary"?0.24:0.22;
    B.add("alu", slBox(len*0.9, 0.08, rows.length>1?0.26:0.14, 0.02), sc_M(x, y+0.04, E.kind==="rotary"?0.12:0));
    rows.forEach(function(sd2){ for(var j=0;j<ns;j++){ var sx=x0-0.08-j*((len-0.14)/Math.max(1,ns-1||1)), sz=sd2*0.09+(E.kind==="rotary"?0.12:0), lean2=sd2*0.22;
      B.add("chrome", sc_cyl(0.026, 8), sc_M(sx, y+0.08+hS/2, sz+Math.sin(lean2)*hS*0.5, lean2, 0, 0, 1, hS, 1));
      if(!lite||j%2===0) B.add("chrome", new THREE.CylinderGeometry(0.046, 0.028, 0.05, 10, 1, true), sc_M(sx, y+0.08+hS+0.02, sz+Math.sin(lean2)*hS, lean2, 0, 0)); } });
    top=Math.max(top, y+0.36);
  } else if(E.carb){
    B.add("alu", slBox(len*0.6, 0.08, 0.2, 0.02), sc_M(x, y+0.05, 0)); B.add("alu", slBox(0.16, 0.08, 0.16, 0.02), sc_M(x, y+0.12, 0));
    B.add("chrome", sc_cyl(0.16, 18), sc_M(x, y+0.2, 0, 0,0,0, 1, 0.07, 1)); top=Math.max(top, y+0.24);
  } else {
    B.add("alu", slBox(len*0.8, 0.13, 0.22, 0.03), sc_M(x, y+0.09, 0)); B.add("alu", new THREE.CylinderGeometry(0.06, 0.06, 0.1, 12), sc_M(x0+0.02, y+0.1, 0, 0, 0, -PI/2));
    top=Math.max(top, y+0.16);
  }
  /* diesel: twin stacks straight up, rain caps */
  if(E.diesel){ var sx2=x1-0.08, hh=o.stackTop!=null?o.stackTop:y+0.85;
    for(sd=-1;sd<=1;sd+=2){ var zz=sd*(o.stackZ||0.18); slRod(B, "chrome", slV(sx2, y-0.15, zz), slV(sx2, hh, zz), 0.045, 12); B.add("chrome", slBox(0.11, 0.012, 0.1, 0.004), sc_M(sx2-0.04, hh+0.02, zz, 0, 0, 0.5)); tips.push(slV(sx2, hh+0.05, zz)); }
    top=Math.max(top, hh+0.05); }
  /* exhaust */
  if(open && o.exh!=="none" && !E.diesel){
    if(E.kind==="two"){   /* expansion chambers: the two-stroke's fat pipes, back along the side */
      for(i=0;i<per;i++){ var cx3=x0-0.1-i*0.17, zc=-0.24-i*0.11, len3=o.sideX!=null?Math.max(0.8,cx3-o.sideX):1.1;
        slRod(B, "barrel", slV(cx3, y-0.18, -0.08), slV(cx3-0.06, y-0.3, zc), 0.03, 8);
        B.add("barrel", slChamber(len3), sc_M(cx3-0.06, y-0.3, zc, 0, 0, PI/2));
        tips.push(slV(cx3-0.06-len3, y-0.3, zc)); }
    } else if(E.kind==="rotary"){   /* one big straight pipe out the side: the rotary's bark */
      var ez=-0.24, ey=y-0.25; slRod(B, "barrel", slV(x, ey, -0.15), slV(x-0.1, ey, ez-0.1), 0.05, 10);
      var ex=o.sideX!=null?o.sideX:x-1.2; slRod(B, "chrome", slV(x-0.1, ey, ez-0.1), slV(ex, ey-0.05, ez-0.12), 0.055, 12); tips.push(slV(ex, ey-0.05, ez-0.12));
    } else {
      var sides=E.kind==="i"?[-1]:[-1,1];
      sides.forEach(function(sd3){ var zs=E.kind==="flat"?0.4:E.kind==="i"?0.16:0.3, yp=E.kind==="flat"?y-0.28:y-0.12, n2=E.kind==="i"?per:per, j, tip=null;
        for(j=0;j<n2;j++){ var px=x0-0.07-j*((len-0.14)/Math.max(1,n2-1)), a=slV(px, yp, sd3*zs), b;
          if(o.exh==="side"){ b=slV(px-0.04, yp-0.12, sd3*(zs+0.16)); slRod(B, "chrome", a, b, 0.022, 6); slRod(B, "chrome", b, slV(x1-0.08, o.sideY!=null?o.sideY:yp-0.22, sd3*(o.sideZ||zs+0.22)), 0.022, 6); }
          else { b=slV(px-0.03, yp+0.0, sd3*(zs+0.13)); var c=slV(px-0.24, yp+0.16, sd3*(zs+0.2)); slRod(B, "chrome", a, b, 0.024, 6); slRod(B, "chrome", b, c, 0.026, 6);
            if(!lite) B.add("well", new THREE.CircleGeometry(0.024, 6), (function(){ var m=sc_rodM(b,c); m.multiply(new THREE.Matrix4().makeTranslation(0,0.5,0)).multiply(new THREE.Matrix4().makeRotationX(-PI/2)); return m; })());
            if(j===0||j===n2-1) tips.push(c.clone()); } }
        if(o.exh==="side"){ var sy=o.sideY!=null?o.sideY:yp-0.22, sz=sd3*(o.sideZ||zs+0.22), sx=o.sideX!=null?o.sideX:x1-1.2;
          B.add("chrome", sc_cyl(0.05, 12), sc_rodM(slV(x1-0.08, sy, sz), slV(sx, sy, sz))); B.add("chrome", new THREE.CylinderGeometry(0.06, 0.05, 0.08, 12, 1, true), sc_rodM(slV(sx, sy, sz), slV(sx-0.08, sy, sz))); tips.push(slV(sx-0.1, sy, sz)); }
      });
    }
  }
  if(E.n2o && open && !lite){ B.add("n2o", sc_cyl(0.06, 10), sc_M(x1-0.15, y-0.15, 0.3, 0, 0, -PI/2, 1, 0.5, 1)); }
  return top;
}
/* an expansion chamber along -x from its origin: header, diffuser cone, belly, baffle cone, stinger */
function slChamber(L){ var key="ch"+r3(L); if(SLC.geo[key]) return SLC.geo[key];
  var P=[[0,0.03],[0.12,0.035],[0.42,0.08],[0.58,0.085],[0.82,0.04],[0.86,0.018],[1,0.018]], pts=P.map(function(p){ return new THREE.Vector2(p[1], p[0]*L); });
  var g=new THREE.LatheGeometry(pts, 10); return (SLC.geo[key]=g); }

/* --- materials per car ------------------------------------------------------------------------------- */
function slMats(L){
  var M=sc_mats(), env=sc_env();
  function own(k, c, r, mt, o){ if(SLC.mat[k]) return SLC.mat[k]; var q=new THREE.MeshStandardMaterial({color:sc(c), roughness:r, metalness:mt}); if(env) q.envMap=env; if(o) for(var z in o) q[z]=o[z]; return (SLC.mat[k]=q); }
  return function(k){
    if(k==="paint") return sc_paint(L.color);
    if(k==="acc") return sc_paint(L.accent);
    if(k==="cover") return sc_paint(L.eng.cover);
    if(k==="helm") return sc_paint(slLum(L.color)>0.04&&slLum(L.color)<0.7?L.color:0xb7261d);
    if(k==="suit") return own("suit"+(L.rival?L.accent:0), L.rival?(slLum(L.accent)>0.5?0xb7261d:0xd8d2c4):0xd8d2c4, 0.85, 0);
    if(k==="cglass") return own("cglass", 0x0e1820, 0.04, 0.5, {transparent:true, opacity:0.42, envMapIntensity:1.1, depthWrite:false});
    if(k==="decal") return slAtlas(L);
    if(k==="canopyT") return own("canopyT", 0xe5562b, 0.8, 0);
    if(k==="n2o") return own("n2o", 0x2753b8, 0.3, 0.5);
    return M[k]||M.black;
  };
}
function slBuild(B, par, mat, lite){
  for(var k in B){ if(k==="add" || !B[k].length) continue;
    var m=new THREE.Mesh(sc_merge(B[k]), mat(k)); m.name="sl_"+k; m.receiveShadow=true; m.castShadow=!(k==="decal"||k==="cglass"||k==="well"||lite&&k!=="paint");
    if(k==="decal") m.renderOrder=2; if(k==="cglass") m.renderOrder=3; par.add(m); }
}

/* --- the cars. Origin = rear axle on the salt, +x forward. userData as saltCar's (wheels, tips, chutes, piv, me) --- */
function saltCarV2(body, L, aero){
  var g=new THREE.Group(), piv=new THREE.Group(), B=sc_bin(), W=sc_bin(), lite=GFX==="lite", k=lite?2:3, E=L.eng, tips=[], me, ls=[];
  g.add(piv);
  if(body==="streamliner") me=slStreamliner(B, W, L, E, aero, tips, ls, k);
  else if(body==="lakester") me=slLakester(B, W, L, E, aero, tips, ls, k);
  else me=slRoadster(B, W, L, E, aero, tips, ls, k);
  var mat=slMats(L); slBuild(B, piv, mat, lite); slBuild(W, g, mat, lite);
  if(tips.length>4) tips=[tips[0], tips[1], tips[tips.length-2], tips[tips.length-1]];
  g.userData={body:body, me:me, piv:piv, wheels:[], tips:tips, chutes:[], A:[{chT:0,chC:0,chS:0,pitch:0},{chT:0,chC:0,chS:0.7,pitch:0}], pitch:0, pv:0, strip:false, livSpots:ls, look:L};
  return g;
}

/* Streamliner (Speed Demon / Turbinator): flat sides and bottom, wheels behind the skirts, canopy forward of the engine,
   headrest fairing into the tail fin, chute tubes out the tail. Nose: a horizontal chisel blade, or a needle. */
function slStreamliner(B, W, L, E, aero, tips, ls, k){
  var yt=0.92, hw=0.48, T=-2.55, N=L.nose==="needle"?7.55:7.3, i, sd;
  var rows=[[T,0.30,0.62,0.16,0.12,0.08,0],[T+0.22,0.2,0.78,0.34,0.18,0.08,0],[-1.8,0.13,0.88,0.45,0.21,0.06,0.01],[-0.9,0.11,yt,hw,0.22,0.05,0.015],[4.2,0.11,yt,hw,0.22,0.05,0.015],[5.3,0.12,0.84,0.47,0.2,0.05,0.01]];
  if(L.nose==="needle") rows.push([6.3,0.14,0.66,0.40,0.2,0.08,0],[7.0,0.2,0.45,0.22,0.12,0.06,0],[N,0.3,0.34,0.025,0.012,0.012,0]);
  else rows.push([6.3,0.125,0.55,0.46,0.15,0.04,0],[6.95,0.14,0.3,0.44,0.08,0.03,0],[N,0.16,0.19,0.41,0.015,0.012,0]);
  B.add("paint", slLoft(rows, k, k===2?3:4));
  /* skirts: a blister over each wheel and a black rub strip low on the flat side */
  [[0,0.25],[4.6,0.24]].forEach(function(a){ for(sd=-1;sd<=1;sd+=2){ var zz=sd*(hw+0.001); B.add("seam", slBox(1.0, 0.012, 0.004, 0.001), sc_M(a[0], 0.62, zz)); B.add("seam", slBox(0.012, 0.5, 0.004, 0.001), sc_M(a[0]-0.5, 0.37, zz)); B.add("seam", slBox(0.012, 0.5, 0.004, 0.001), sc_M(a[0]+0.5, 0.37, zz));
      B.add("black", slBox(1.0, 0.03, 0.02, 0.004), sc_M(a[0], 0.125, sd*(hw-0.004))); } });
  for(sd=-1;sd<=1;sd+=2) B.add("acc", slBox(5.0, 0.07, 0.012, 0.004), sc_M(1.65, 0.2, sd*(hw+0.002)));
  /* canopy (the driver is under it, lying back), headrest fairing back to the fin */
  var cx=3.55; B.add("cglass", saltLathe(1.5, 0.22, [[0,0.05],[0.2,0.8],[0.5,1.0],[0.8,0.85],[1,0.1]], k===2?12:20), sc_M(cx-0.75, yt-0.02, 0, 0, 0, 0, 1, 0.78, 0.95));
  slDriver(B, cx+0.46, 0.58, 0, 1.12, {});
  B.add("paint", slLoft([[2.0,yt-0.1,yt+0.02,0.06,0.04,0.01,0],[2.45,yt-0.1,yt+0.15,0.15,0.09,0.01,0.02],[cx-0.62,yt-0.1,yt+0.2,0.16,0.1,0.01,0.03],[cx-0.5,yt-0.1,yt+0.08,0.12,0.06,0.01,0]], k, 2));
  /* tail fin with the number on it */
  var fs=new THREE.Shape(); fs.moveTo(T+0.1,0); fs.lineTo(-0.4,0); fs.lineTo(-1.55,0.98); fs.lineTo(-2.2,1.02); fs.lineTo(T+0.05,0.55); fs.lineTo(T+0.1,0);
  B.add("acc", new THREE.ExtrudeGeometry(fs, {depth:0.05, bevelEnabled:true, bevelThickness:0.01, bevelSize:0.01, bevelSegments:1}), sc_M(0, yt-0.25, -0.025));
  slDecal2(B, SL_ATL.numT, -1.75, yt+0.33, 0.04, 0.82, 0.43);
  /* chute tubes out the tail, a skid plate, and the trim tabs (aero) */
  for(sd=-1;sd<=1;sd+=2){ slCylX(B, "satin", T-0.08, 0.49, sd*0.1, 0.07, 0.5, 12); B.add("well", new THREE.CircleGeometry(0.06, 12), sc_M(T-0.335, 0.49, sd*0.1, 0, -PI/2, 0)); }
  B.add("black", slBox(7.0, 0.02, 0.5, 0.008), sc_M(2.0, 0.105, 0));
  if(aero) for(sd=-1;sd<=1;sd+=2){ B.add("acc", slBox(0.5, 0.025, 0.3, 0.008), sc_M(T+0.55, 0.36, sd*(hw-0.05), 0, 0, -0.08)); B.add("acc", slBox(0.32, 0.02, 0.2, 0.006), sc_M(5.9, 0.22, sd*0.5, 0, sd*0.05, -0.05)); }
  /* what the engine shows through the deck, behind the driver */
  var ex=1.0, dy=yt-0.18;
  if(E.asp==="blower") slEngine(B, E, {x:ex, y:dy, open:false, tips:[]});
  else if(E.asp==="turbo"||E.asp==="twin"||E.asp==="centri"){ for(sd=-1;sd<=1;sd+=2){ if(E.asp!=="twin"&&sd<0) continue;
      B.add("paint", sc_prof([[0.45,0],[0.25,0.1],[-0.25,0.14],[-0.35,0.0]], 0.2, 0.02), sc_M(ex+0.4, yt-0.01, sd*0.26)); B.add("well", slBox(0.02, 0.1, 0.16, 0.004), sc_M(ex+0.16, yt+0.06, sd*0.26, 0, 0, 0.3)); }
    if(E.asp!=="centri") for(sd=-1;sd<=1;sd+=2){ if(E.asp!=="twin"&&sd<0) continue; var gp=slV(ex-0.3, yt-0.05, sd*0.3), gt=slV(ex-0.38, yt+0.2, sd*0.32); slRod(B, "chrome", gp, gt, 0.03, 8); tips.push(gt.clone()); } }
  else { B.add("paint", sc_prof([[0.55,0],[0.35,0.16],[-0.2,0.24],[-0.35,0.22],[-0.4,0]], 0.26, 0.02), sc_M(ex+0.4, yt-0.01, 0)); B.add("well", slBox(0.02, 0.16, 0.2, 0.004), sc_M(ex+0.12, yt+0.12, 0, 0, 0, 0.35)); }
  if(E.diesel){ for(sd=-1;sd<=1;sd+=2){ var a=slV(ex-0.55, yt-0.1, sd*0.3), b=slV(ex-0.62, yt+0.32, sd*0.32); slRod(B, "chrome", a, b, 0.04, 10); tips.push(b.clone()); } }
  if(E.kind==="rotary"){ B.add("chrome", sc_cyl(0.07, 12), sc_rodM(slV(ex-0.2, 0.36, -hw+0.05), slV(ex-0.55, 0.34, -hw-0.04))); tips.push(slV(ex-0.6, 0.34, -hw-0.05)); }
  if(E.kind==="two"){ for(sd=-1;sd<=1;sd+=2){ slCylX(B, "barrel", T-0.05, 0.26, sd*0.07, 0.025, 0.4, 8); tips.push(slV(T-0.3, 0.26, sd*0.07)); } }
  if(!tips.length) tips.push(slV(-1.2, 0.3, -hw-0.02), slV(-1.2, 0.3, hw+0.02));
  /* livery: number board + class plate + sponsors on the flat sides, the number on the deck, stickers by the canopy */
  var zs=hw+0.004;
  slDecal2(B, SL_ATL.sp[0], 0.98, 0.62, zs, 0.8, 0.245);
  slDecal2(B, SL_ATL.sp[1], 0.98, 0.37, zs, 0.7, 0.215);
  slDecal2(B, SL_ATL.numB, 1.98, 0.55, zs, 0.68, 0.425);
  slDecal2(B, SL_ATL.cls, 1.98, 0.26, zs+0.002, 0.5, 0.155);
  slDecal2(B, SL_ATL.sp[2], 2.98, 0.62, zs, 0.8, 0.245);
  slDecal2(B, SL_ATL.sp[3], 2.98, 0.37, zs, 0.7, 0.215);
  if(GFX!=="lite"){ slDecal2(B, SL_ATL.rail, -0.42, 0.7, zs, 0.8, 0.09); slDecal2(B, SL_ATL.tech, 3.62, 0.37, zs, 0.16, 0.16); slDecal2(B, SL_ATL.club, 3.8, 0.62, zs, 0.5, 0.235); slDecal2(B, SL_ATL.sp[4], -1.35, 0.55, 0.43, 0.55, 0.17); }
  slDecal(B, SL_ATL.numB, [-0.3, yt+0.004, 0], [0,0,1], [1,0,0], 0.55, 0.36);
  /* wheels inside the skirts */
  W.add("rubber", slTyre(0.343, 0.18, 0.21), sc_M(0, 0.343, -0.25, PI/2, 0, 0)); W.add("rubber", slTyre(0.343, 0.18, 0.21), sc_M(0, 0.343, 0.25, PI/2, 0, 0));
  W.add("rubber", slTyre(0.33, 0.14, 0.2), sc_M(4.6, 0.33, -0.24, PI/2, 0, 0)); W.add("rubber", slTyre(0.33, 0.14, 0.2), sc_M(4.6, 0.33, 0.24, PI/2, 0, 0));
  ls.push({role:"hood", w:0.8, h:0.26, p:[0.3,yt+0.005,0], u:[0,0,1], v:[1,0,0]}, {role:"side", w:0.7, h:0.22, p:[4.3,0.32,zs+0.003], u:[1,0,0], v:[0,1,0]}, {role:"side", i:1, w:0.7, h:0.22, p:[4.3,0.32,-zs-0.003], u:[-1,0,0], v:[0,1,0]});
  return {rr:0.343, anchor:slV(T-0.3, 0.49, 0), chuteLen:9, chuteRise:0.7, chuteR:1.15, len:N-T, tail:T-0.3, nose:N, top:yt+0.2, wb:4.6};
}

/* Lakester: a belly tank on a narrow track. Driver ahead of the engine, headrest fairing, a small fin on the tail;
   tall skinny tyres with Moon discs; exposed front beam axle and rear axle tubes; the tank's seams and filler. */
function slLakester(B, W, L, E, aero, tips, ls, k){
  var L2=5.7, R2=0.44, X2=-1.75, y2=0.56, seg=k===2?20:28, sd, i, top=y2+R2;
  var prof=[[0,0.03],[0.14,0.42],[0.32,0.82],[0.52,1.0],[0.72,0.96],[0.86,0.8]], pf=slPchip([0,0.14,0.32,0.52,0.72,0.86,0.935,1],[0.03,0.42,0.82,1.0,0.96,0.8,0.56,0.0]);
  var rAt=function(x){ var f=Math.max(0.02,pf(clamp((x-X2)/L2,0,1)))*R2; return [f*0.94, f*0.86]; }, tTop=function(x){ return y2+rAt(x)[0]; };
  B.add("paint", saltLathe(L2*0.86, R2, prof.map(function(p){ return [p[0]/0.86, p[1]]; }), seg), sc_M(X2, y2, 0, 0,0,0, 1, 0.94, 0.86));
  B.add("alu", saltLathe(L2*0.14, R2, [[0,0.8],[0.35,0.56],[0.75,0.28],[1,0.0]], seg), sc_M(X2+L2*0.86, y2, 0, 0,0,0, 1, 0.94, 0.86));
  /* the tank's seams, filler cap and mounting lugs */
  [0.2,0.45,0.7].forEach(function(t){ var xr=X2+L2*t, r=Math.max(0.02,pf(t))*R2*1.01; B.add("seam", new THREE.TorusGeometry(r, 0.005, 3, seg), sc_M(xr, y2, 0, 0, PI/2, 0, 0.86, 0.94, 1)); });
  B.add("satin", slBox(L2*0.3, 0.01, 0.012, 0.004), sc_M(X2+L2*0.55, tTop(X2+L2*0.55)+0.002, 0));
  B.add("chrome", sc_cyl(0.06, 12), sc_M(2.3, tTop(2.3)-0.005, 0, 0, 0, 0, 1, 0.03, 1));
  for(i=0;i<2;i++){ var lx=1.85+i*0.18; B.add("chrome", slBox(0.1, 0.05, 0.05, 0.01), sc_M(lx, tTop(lx)+0.01, 0)); }
  /* cockpit: opening, wrap screen, driver, roll hoop, headrest fairing with a small fin */
  var cx=1.2; B.add("well", slBox(0.75, 0.02, 0.5, 0.01), sc_M(cx, tTop(cx)-0.002, 0)); B.add("black", slBox(0.8, 0.03, 0.55, 0.012), sc_M(cx, tTop(cx)-0.012, 0));
  slDriver(B, cx-0.12, y2+0.02, 0, 0.32, {wheel:[cx+0.42, y2+0.4]});
  B.add("cglass", new THREE.CylinderGeometry(0.3, 0.3, 0.16, 12, 1, true, -0.9, 1.8), sc_M(cx+0.5, top+0.07, 0, 0, PI/2, 0.35));
  slHoop(B, cx-0.65, top-0.05, top+0.42, 0.2, [cx-1.05, top-0.06]);
  B.add("paint", slLoft([[0.1,top-0.1,top-0.03,0.05,0.03,0.01,0],[0.35,top-0.1,top+0.18,0.12,0.08,0.01,0.01],[cx-0.6,top-0.1,top+0.3,0.15,0.1,0.01,0.02],[cx-0.48,top-0.1,top+0.2,0.14,0.08,0.01,0]], k, 2));
  var fs=new THREE.Shape(); fs.moveTo(-0.62,0); fs.lineTo(0.05,0); fs.lineTo(-0.3,0.36); fs.lineTo(-0.56,0.38); fs.lineTo(-0.62,0);
  B.add("acc", new THREE.ExtrudeGeometry(fs, {depth:0.025, bevelEnabled:false}), sc_M(-1.0, y2+0.08, -0.0125));
  /* the engine behind the driver: the hat / stacks / turbos stand up through the tank, zoomies out the sides */
  slEngine(B, E, {x:-0.3, y:tTop(-0.3)-0.06, open:false, tips:tips, stackTop:top+0.45, stackZ:0.13});
  if(!E.diesel && E.kind!=="two" && E.kind!=="rotary") for(sd=-1;sd<=1;sd+=2){ for(i=0;i<2;i++){ var a=slV(-0.15-i*0.24, y2+0.06, sd*R2*0.75), b=slV(-0.36-i*0.24, y2+0.3, sd*(R2*0.75+0.12)); slRod(B, "chrome", a, b, 0.028, 8); if(i) tips.push(b.clone()); } }
  if(E.kind==="two") for(sd=-1;sd<=1;sd+=2){ B.add("barrel", slChamber(1.3), sc_M(-0.3, y2-0.3, sd*0.26, 0, 0, PI/2)); tips.push(slV(-1.6, y2-0.3, sd*0.26)); }
  if(E.kind==="rotary"){ slRod(B, "chrome", slV(-0.1, y2-0.1, -R2*0.8), slV(-0.9, y2-0.18, -R2-0.06), 0.06, 12); tips.push(slV(-0.95, y2-0.18, -R2-0.06)); }
  /* running gear: narrow track, tall skinny tyres, Moon discs */
  var tr=0.62, tf=0.56;
  for(sd=-1;sd<=1;sd+=2){ slRod(B, "tube", slV(0, 0.36, sd*R2*0.7), slV(0, 0.36, sd*(tr-0.07)), 0.035, 8); slRod(B, "tube", slV(0, 0.3, sd*(tr-0.1)), slV(1.0, y2-0.2, sd*0.3), 0.016, 6);
    slRod(B, "chrome", slV(2.9, 0.33, sd*(tf-0.08)), slV(2.2, y2-0.12, sd*0.18), 0.016, 6); slRod(B, "chrome", slV(2.9, 0.36, sd*(tf-0.08)), slV(2.9, 0.36, sd*0.1), 0.02, 6);
    B.add("black", slBox(0.06, 0.12, 0.05, 0.01), sc_M(2.9, 0.33, sd*(tf-0.07))); }
  B.add("chrome", slBox(0.05, 0.045, tf*2-0.16, 0.01), sc_M(2.9, 0.36, 0));
  slWheel(W, 0, -tr, 0.355, 0.13, {moon:L.moon}); slWheel(W, 0, tr, 0.355, 0.13, {moon:L.moon}); slWheel(W, 2.9, -tf, 0.33, 0.1, {moon:L.moon}); slWheel(W, 2.9, tf, 0.33, 0.1, {moon:L.moon});
  if(aero) for(sd=-1;sd<=1;sd+=2) B.add("acc", slBox(0.34, 0.022, 0.26, 0.006), sc_M(3.4, y2-0.08, sd*0.36, 0, 0, 0.12));
  if(!tips.length) tips.push(slV(-0.3, y2+0.2, -0.5), slV(-0.3, y2+0.2, 0.5));
  /* livery on the tank (curved, so the decals ride just off the surface) */
  for(sd=-1;sd<=1;sd+=2){
    slDecalTank(B, SL_ATL.numB, 1.75, y2, 0.06, 0.56, 0.35, sd, rAt);
    slDecalTank(B, SL_ATL.cls, -1.0, y2, 0.02, 0.4, 0.125, sd, rAt);
    slDecalTank(B, SL_ATL.sp[0], 0.6, y2, 0.1, 0.62, 0.19, sd, rAt);
    slDecalTank(B, SL_ATL.sp[1], 2.75, y2, 0.02, 0.5, 0.155, sd, rAt);
    if(GFX!=="lite"){ slDecalTank(B, SL_ATL.sp[2], 0.6, y2, -0.12, 0.5, 0.155, sd, rAt); slDecalTank(B, SL_ATL.tech, -0.25, y2, -0.13, 0.13, 0.13, sd, rAt); slDecalTank(B, SL_ATL.rail, 1.6, y2, -0.2, 0.9, 0.085, sd, rAt); } }
  slDecal(B, SL_ATL.numT, [-1.4, y2+0.27, 0.015], [1,0,0], [0,1,0], 0.26, 0.14); slDecal(B, SL_ATL.numT, [-1.4, y2+0.27, -0.015], [-1,0,0], [0,1,0], 0.26, 0.14);
  ls.push({role:"hood", w:0.5, h:0.22, p:[2.6,tTop(2.6)+0.012,0], u:[0,0,1], v:[1,0,0]});
  return {rr:0.355, anchor:slV(X2-0.05, y2, 0), chuteLen:6.5, chuteRise:0.5, chuteR:0.9, len:L2, tail:X2, nose:X2+L2, top:top+0.42, wb:2.9};
}

/* Modified roadster: a channelled '32 tub on a Deuce frame, the '32 grille shell up front, the engine in the open
   with headers, a chopped screen, roll bar, the driver in his seat; Moon discs; a proper rear spoiler on the deck. */
function slRoadster(B, W, L, E, aero, tips, ls, k){
  var sd, i, deck=1.0;
  /* frame rails (the reveal under the body), crossmember, nerf */
  for(sd=-1;sd<=1;sd+=2){ B.add("black", slBox(3.85, 0.16, 0.07, 0.015), sc_M(0.9, 0.46, sd*0.38)); }
  B.add("black", slBox(0.08, 0.1, 0.8, 0.01), sc_M(2.6, 0.42, 0));
  /* the tub: rounded turtle deck at the back, cockpit, cowl */
  B.add("paint", slLoft([[-1.18,0.5,0.82,0.42,0.3,0.05,0],[-1.05,0.42,0.95,0.58,0.26,0.04,0.01],[-0.55,0.4,deck,0.62,0.13,0.03,0.015],[0.9,0.4,deck,0.61,0.1,0.03,0.015],[1.28,0.42,deck+0.02,0.52,0.1,0.03,0.01]], k, 3));
  B.add("well", slBox(0.92, 0.008, 0.96, 0.003), sc_M(0.2, deck+0.004, 0));
  B.add("black", slBox(0.05, 0.05, 1.0, 0.02), sc_M(0.68, deck+0.01, 0)); B.add("black", slBox(0.05, 0.05, 1.0, 0.02), sc_M(-0.28, deck+0.01, 0));
  for(sd=-1;sd<=1;sd+=2) B.add("black", slBox(0.98, 0.05, 0.05, 0.02), sc_M(0.2, deck+0.01, sd*0.49));
  B.add("black", slBox(0.2, 0.2, 0.7, 0.04), sc_M(-0.28, deck, 0));   /* seat back */
  /* chopped windscreen */
  B.add("cglass", slBox(0.02, 0.18, 0.9, 0.005), sc_M(1.08, deck+0.12, 0, 0, 0, 0.28));
  for(sd=-1;sd<=1;sd+=2) slRod(B, "chrome", slV(1.12, deck, sd*0.46), slV(1.04, deck+0.23, sd*0.46), 0.014, 6);
  B.add("chrome", slBox(0.025, 0.02, 0.94, 0.006), sc_M(1.04, deck+0.23, 0));
  slDriver(B, -0.02, 0.68, 0, 0.3, {wheel:[0.6, deck+0.1]});
  slHoop(B, -0.5, deck-0.02, deck+0.5, 0.3, [-1.0, 0.85]);
  /* '32 grille shell: chrome surround, painted insert with bars, the radiator cap on top; leans back a touch */
  var gx=2.62, gy=0.5, gs=new THREE.Shape(), hole=new THREE.Path();
  gs.moveTo(0,0); gs.lineTo(0.17,0); gs.quadraticCurveTo(0.21,0,0.215,0.05); gs.lineTo(0.27,0.56); gs.quadraticCurveTo(0.275,0.66,0.19,0.66); gs.lineTo(-0.19,0.66); gs.quadraticCurveTo(-0.275,0.66,-0.27,0.56); gs.lineTo(-0.215,0.05); gs.quadraticCurveTo(-0.21,0,-0.17,0); gs.lineTo(0,0);
  hole.moveTo(0,0.035); hole.lineTo(0.16,0.035); hole.quadraticCurveTo(0.18,0.035,0.183,0.06); hole.lineTo(0.235,0.55); hole.quadraticCurveTo(0.238,0.625,0.18,0.625); hole.lineTo(-0.18,0.625); hole.quadraticCurveTo(-0.238,0.625,-0.235,0.55); hole.lineTo(-0.183,0.06); hole.quadraticCurveTo(-0.18,0.035,-0.16,0.035); hole.lineTo(0,0.035);
  gs.holes.push(hole);
  var gm=new THREE.Matrix4().compose(slV(gx, gy, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, PI/2, 0.1, "ZYX")), slV(1,1,1));
  var ge=new THREE.ExtrudeGeometry(gs, {depth:0.1, bevelEnabled:true, bevelThickness:0.012, bevelSize:0.01, bevelSegments:1, curveSegments:GFX==="lite"?2:5}); ge.translate(0,0,-0.08); B.add("chrome", ge, gm);
  var ins=new THREE.ShapeGeometry(new THREE.Shape(hole.getPoints(4))); B.add("satin", ins, gm.clone().multiply(new THREE.Matrix4().makeTranslation(0,0,-0.05)));
  for(i=-5;i<=5;i+=(GFX==="lite"?2:1)){ var bz=i*0.038; B.add("chrome", slBox(0.01, 0.56-Math.abs(i)*0.006, 0.006, 0.002), gm.clone().multiply(new THREE.Matrix4().makeTranslation(bz, 0.33, -0.04))); }
  B.add("chrome", sc_cyl(0.03, 10), gm.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.69, -0.04)).multiply(new THREE.Matrix4().makeScale(1, 0.06, 1)));
  B.add("black", slBox(0.1, 0.56, 0.5, 0.02), sc_M(gx-0.14, gy+0.3, 0));   /* radiator core */
  /* the engine in the open: headers out the sides into side pipes along the frame */
  var eng=E.diesel?{x:1.85, y:0.92}:{x:1.88, y:0.86};
  slEngine(B, E, {x:eng.x, y:eng.y, open:true, exh:E.kind==="v"||E.kind==="flat"?"zoomie":"side", sideX:0.55, sideY:0.36, sideZ:0.68, tips:tips, stackTop:deck+0.55, stackZ:0.2});
  /* front end: dropped and drilled beam axle, transverse spring, wishbones, shocks */
  var fx=2.75, tf=0.66, tr=0.72;
  B.add("chrome", sc_prof([[-0.6,0.31],[-0.45,0.31],[-0.24,0.2],[0.24,0.2],[0.45,0.31],[0.6,0.31],[0.6,0.36],[0.45,0.36],[0.24,0.25],[-0.24,0.25],[-0.45,0.36],[-0.6,0.36]], 0.05, 0.006), sc_M(fx, 0, 0, 0, PI/2, 0));
  B.add("satin", slBox(0.05, 0.03, 0.9, 0.01), sc_M(fx-0.05, 0.47, 0, 0.0, 0, 0));
  for(sd=-1;sd<=1;sd+=2){ slRod(B, "chrome", slV(fx, 0.31, sd*0.5), slV(1.9, 0.42, sd*0.08), 0.016, 6); slRod(B, "chrome", slV(fx, 0.33, sd*0.5), slV(1.9, 0.42, sd*0.32), 0.016, 6);
    slRod(B, "satin", slV(fx-0.06, 0.33, sd*0.52), slV(fx-0.15, 0.55, sd*0.4), 0.022, 6); slRod(B, "chrome", slV(fx, 0.31, sd*0.56), slV(fx, 0.31, sd*(tf-0.05)), 0.03, 8); }
  /* rear: chute pack on the tail, the rear axle, the spoiler on the deck */
  slChutePack(B, -1.25, 0.72, 0); B.add("satin", slBox(0.06, 0.06, 1.25, 0.01), sc_M(0, 0.343, 0));
  if(aero){ B.add("paint", sc_prof([[0.0,0],[-0.5,0],[-0.5,0.2],[-0.42,0.2]], 1.16, 0.01), sc_M(-0.6, 0.85, 0));
    B.add("acc", slBox(0.12, 0.02, 1.18, 0.006), sc_M(-1.06, 1.06, 0, 0, 0, 0.0)); for(sd=-1;sd<=1;sd+=2) B.add("paint", sc_prof([[0.05,0],[-0.55,0],[-0.55,0.3]], 0.016, 0.004), sc_M(-0.58, 0.82, sd*0.59)); }
  slWheel(W, 0, -tr, 0.343, 0.27, {moon:L.moon}); slWheel(W, 0, tr, 0.343, 0.27, {moon:L.moon}); slWheel(W, fx, -tf, 0.31, 0.12, {moon:L.moon}); slWheel(W, fx, tf, 0.31, 0.12, {moon:L.moon});
  if(!tips.length) tips.push(slV(0.45, 0.36, -0.68), slV(0.45, 0.36, 0.68));
  /* livery: the number big on the doors, class plate behind, sponsors on the cowl and the tail; a sponsor rail */
  var zs=0.615;
  slDecal2(B, SL_ATL.numB, 0.35, 0.7, zs, 0.52, 0.33);
  slDecal2(B, SL_ATL.cls, -0.55, 0.82, zs, 0.38, 0.12);
  slDecal2(B, SL_ATL.sp[0], 1.0, 0.7, zs-0.006, 0.42, 0.13);
  slDecal2(B, SL_ATL.sp[1], -0.55, 0.62, zs, 0.42, 0.13);
  if(GFX!=="lite"){ slDecal2(B, SL_ATL.rail, 0.25, 0.48, zs, 1.1, 0.12); slDecal2(B, SL_ATL.tech, 1.0, 0.53, zs-0.006, 0.1, 0.1); }
  slDecal(B, SL_ATL.numT, [-0.85, 0.94, 0], [0,0,1], [1,0,0], 0.5, 0.26);
  ls.push({role:"hood", w:0.5, h:0.18, p:[0.98,deck+0.025,0], u:[0,0,1], v:[1,0,0]}, {role:"side", w:0.42, h:0.13, p:[1.0,0.53,zs+0.002], u:[1,0,0], v:[0,1,0]}, {role:"side", i:1, w:0.42, h:0.13, p:[1.0,0.53,-zs-0.002], u:[-1,0,0], v:[0,1,0]});
  return {rr:0.343, anchor:slV(-1.4, 0.72, 0), chuteLen:5.5, chuteRise:0.45, chuteR:0.85, len:4.4, tail:-1.4, nose:fx+0.31, top:deck+0.5, wb:fx};
}

/* Altered: the strip's muscle shell set up for the salt: the engine's hood hardware, number boards on the doors
   with the class plate, taped headlights, a chute pack, Moon discs, a real spoiler; diesel / rotary / two-stroke cues. */
function saltAlteredV2(L, aero){
  var E=L.eng, hw={asp:E.asp==="blower"?"blower":E.asp==="centri"?"centri":E.asp==="twin"?"twin":E.asp==="turbo"?"turbo":"na", ic:E.ic, n2o:E.n2o, diesel:E.diesel, style:"muscle"};
  var car=stripCar("street", L.color, 26.5, hw), U=car.userData, me=U.meta, g=new THREE.Group(), inner=U.bodyGroup.children[0], B=sc_bin(), M=sc_mats(), i, sd;
  car.position.x=-me.xr; g.add(car);
  /* door number boards (the strip's door decals carry them) */
  var board=slDoorMat(L); U.liv.dm=board; U.liv.num=L.num; for(i=0;i<U.liv.door.length;i++) U.liv.door[i].material=board;
  /* no windshield banner on the salt: a strip thing (stripLivery only swaps its material, so it stays hidden) */
  for(i=0;i<U.liv.banner.length;i++) U.liv.banner[i].visible=false;
  /* headlight tape: a silver panel over each lamp, crossed with black tape */
  var hl=U.lights.head[0];
  if(hl){ hl.geometry.computeBoundingBox(); var bb=hl.geometry.boundingBox, pa=hl.geometry.attributes.position, lb=[new THREE.Box3(), new THREE.Box3()], v=new THREE.Vector3();
    for(i=0;i<pa.count;i++){ v.fromBufferAttribute(pa,i); lb[v.z<0?0:1].expandByPoint(v); }
    lb.forEach(function(b){ if(b.isEmpty()) return; var c=b.getCenter(new THREE.Vector3()), s=b.getSize(new THREE.Vector3()), xx=b.max.x+0.004;
      if(GFX!=="lite") B.add("alu", slBox(0.01, s.y*1.04, s.z*1.04, 0.003), sc_M(xx, c.y, c.z));
      B.add("black", slBox(0.008, 0.03, Math.hypot(s.y,s.z)*0.95, 0.002), sc_M(xx+0.006, c.y, c.z, Math.atan2(s.y,s.z), 0, 0));
      B.add("black", slBox(0.008, 0.03, Math.hypot(s.y,s.z)*0.95, 0.002), sc_M(xx+0.006, c.y, c.z, -Math.atan2(s.y,s.z), 0, 0)); });
    hl.visible=false; }
  /* chute pack over the rear bumper; the strip chute already anchors there */
  var an=me.anchor; slChutePack(B, an.x+0.06, an.y+0.12, 0);
  /* the sponsor rail on the rocker and a block on the front fender (the class plate is on the door boards) */
  var bbx=new THREE.Box3(); U.liv.door.forEach(function(d){ d.geometry.computeBoundingBox(); bbx.union(d.geometry.boundingBox); });
  if(!bbx.isEmpty()){ var zq=bbx.max.z+0.003, yq=bbx.min.y;
    if(GFX!=="lite"){ slDecal2(B, SL_ATL.rail, (bbx.min.x+bbx.max.x)/2, yq-0.1, zq-0.012, 1.3, 0.13); slDecal2(B, SL_ATL.sp[0], bbx.max.x+0.62, yq+0.12, zq-0.04, 0.42, 0.13); } }
  /* Moon discs on the strip wheels */
  var MB=sc_bin(); if(GFX!=="lite") U.carriers.forEach(function(cw){ var cu=cw.userData, sd2=cu.side; MB.add(L.moon==="paint"?"paint":"chrome", slMoonGeo(cu.r*0.58, cu.r*0.12, GFX==="lite"?12:18), sc_M(cw.position.x, cw.position.y, cw.position.z+sd2*cu.hw*0.9, sd2*PI/2, 0, 0)); });
  slBuild(MB, car, slMats(L), true);
  /* engine cues the strip shell doesn't carry */
  var tips=[];
  if(E.diesel){ for(sd=-1;sd<=1;sd+=2){ var sx=me.xf-0.85, a=slV(sx, 0.9, sd*0.32), b=slV(sx-0.06, 1.5, sd*0.34); slRod(B, "chrome", a, b, 0.045, 12); tips.push(b); } }
  if(E.kind==="rotary"){ slRod(B, "chrome", slV(me.xf-1.0, 0.3, -0.7), slV(me.xr+0.9, 0.22, -0.82), 0.05, 12); }
  if(E.kind==="two") for(sd=-1;sd<=1;sd+=2) slCylX(B, "barrel", me.xr-1.05, 0.28, sd*0.3, 0.03, 0.3, 8);
  if(aero){ var pm=inner.getObjectByName("sc_paint"), lip={x:me.xr-0.95, y:1.1, z:0.7};
    if(pm){ var pp=pm.geometry.attributes.position, mx=1e9, j; for(j=0;j<pp.count;j++) mx=Math.min(mx, pp.getX(j)); lip.y=0; lip.z=0;
      for(j=0;j<pp.count;j++) if(pp.getX(j)<mx+0.14){ lip.y=Math.max(lip.y, pp.getY(j)); lip.z=Math.max(lip.z, Math.abs(pp.getZ(j))); } lip.x=mx+0.1; }
    B.add("black", sc_prof([[0.12,0],[-0.14,0],[-0.16,0.12],[-0.04,0.07]], lip.z*2-0.06, 0.008), sc_M(lip.x, lip.y-0.01, 0));
    for(sd=-1;sd<=1;sd+=2) B.add("black", slBox(0.32, 0.17, 0.012, 0.004), sc_M(lip.x-0.02, lip.y+0.05, sd*(lip.z-0.03))); }
  slBuild(B, inner, slMats(L), GFX==="lite");
  if(!tips.length) tips=U.exhaustTips.slice(0,2);
  g.userData={body:"altered", me:{rr:me.rr, anchor:me.anchor.clone().add(new THREE.Vector3(-me.xr,0,0)), len:4.6, tail:-2.3-me.xr, nose:2.3-me.xr, top:1.4, wb:me.xf-me.xr}, strip:true, car:car, chutes:[], A:[], piv:inner, tips:tips, look:L};
  return g;
}
/* the Altered's door board: white board, black number, the class plate under it */
function slDoorMat(L){
  var key="door|"+L.key; if(SLC.mat[key]) return SLC.mat[key];
  var c=sc_canvas(512,200), x=c.getContext("2d"), F="'Chakra Petch','Barlow Condensed','Arial Narrow',Arial,sans-serif";
  x.clearRect(0,0,512,200); spRRect(x, 6, 6, 300, 188, 14); x.fillStyle="#f4efe2"; x.fill(); x.lineWidth=7; x.strokeStyle="#141414"; x.stroke();
  x.fillStyle="#141414"; x.textAlign="center"; x.textBaseline="middle"; x.font="700 "+(L.num.length>3?110:140)+"px "+F; x.fillText(L.num, 156, 104, 270);
  x.fillStyle="#f4efe2"; x.fillRect(318, 120, 188, 66); x.strokeStyle="#141414"; x.lineWidth=5; x.strokeRect(321, 123, 182, 60); x.fillStyle="#141414"; x.font="700 44px "+F; x.fillText(L.cls||"ALT", 412, 156, 170);
  slSponsor(x, SL_SPONSORS[L.sponsors[0]], 316, 12, 192, 100);
  var t=sc_ctex(c), q=new THREE.MeshStandardMaterial({map:t, transparent:true, depthWrite:false, roughness:0.3, metalness:0.05, polygonOffset:true, polygonOffsetFactor:-3});
  var env=sc_env(); if(env) q.envMap=env; q.userData.perBuild=true; q.userData.ownMaps=[t];
  SLC.mat[key]=q; return q;
}
/* drop the cars built for an older look (a new meet number, a repaint): their merged geometry goes, shared pieces stay */
function saltCarsPrune(){
  for(var k in SALT.cars){ var V=SALT.cars[k]; if(V===SALT.cur) continue; if(V.parent) V.parent.remove(V);
    V.traverse(function(q){ if(q.geometry && !q.geometry.__cached && q.name && q.name.indexOf("sl_")===0) q.geometry.dispose(); }); delete SALT.cars[k]; }
}
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
/* ===========================================================================
   SALT FLATS · SPEED WEEK — the busy event around the run: the pit town at the
   start (rigs, haulers, motorhomes, EZ-Ups, golf carts, scooters, tool carts,
   feather flags, people), the return road and a spectator line behind the
   cones; the push truck (a real pickup with a crew member riding the bed) and
   the safety truck; spins (lift, roll, yaw, skid and scuff marks on the salt,
   salt dust); and the parachute's salt-only extras (thick shroud lines, a
   tether, a pilot chute that pulls the main, a salt puff, a cut to the heli).
   Visual only: everything here reads what setSalt is fed and never feeds back.
   Full/Ultra: the town is InstancedMeshes (one draw call per shape+material,
   culled by town bounds and distance). Lite: the same prefabs, fewer of them,
   merged into the scene's existing static batches (no extra draw calls).
   Hooks into vis/salt.js: buildSaltScene (saltPitTown, saltPickup), saltUpdate
   (saltSpinPose, saltEventUpdate), saltDirect (the SALT.cue line).
   ==========================================================================*/
var SALT_PUSH_PAL=[0xf2c12e, 0xc8331f, 0xff6a14, 0x1f4f9a, 0x2a8a4a];   /* never white or black: it has to read against the salt as well as the car */
var _seM=new THREE.Matrix4(), _seL=new THREE.Matrix4(), _seE=new THREE.Euler(), _seQ=new THREE.Quaternion(), _seP=new THREE.Vector3(), _seS=new THREE.Vector3(),
  _seA=new THREE.Vector3(), _seB=new THREE.Vector3(), _seC=new THREE.Vector3(), _seX=new THREE.Vector3(1,0,0), _seCol=new THREE.Color();
function seOwn(m){ if(m && SALT.owned) SALT.owned.push(m); return m; }   /* saltRebuild (vis/salt-look.js) disposes what is listed */
function seRng(s){ var t=Math.sin(s*12.9898+78.233)*43758.5453; return t-Math.floor(t); }
/* extra unit shapes, registered beside StripBatch's own so either path can use them */
function seGeo(){
  var G=sbGeo(); if(G.sePyr) return G;
  function ni(g){ return g.index ? g.toNonIndexed() : g; }
  G.sePyr=ni(new THREE.CylinderGeometry(0,0.7071,1,4,1).rotateY(PI/4).translate(0,0.5,0));   /* square pyramid, base 1×1 at y 0 */
  G.seHead=ni(new THREE.IcosahedronGeometry(0.5,0));
  G.seWheel=ni(new THREE.CylinderGeometry(0.5,0.5,1,8).rotateX(PI/2));                       /* axle along z */
  G.seWheelL=ni(new THREE.CylinderGeometry(0.5,0.5,1,6).rotateX(PI/2));
  G.seFlat=ni(new THREE.PlaneGeometry(1,1).rotateX(-PI/2));                                     /* flat on the ground */
  return G;
}
/* --- a kit of unit shapes placed in a prefab's frame: merged into StripBatch keys (Lite) or collected for instancing --- */
function SeKit(B, inst){ this.B=B; this.inst=inst; this.I={}; this.base=new THREE.Matrix4(); this.n=0; }
SeKit.prototype.at=function(x,z,yaw){ this.base.makeRotationY(yaw||0); this.base.setPosition(x,0,z); return this; };
/* key: gloss | solid | metal | cloth | skin | blob */
SeKit.prototype.put=function(key, gn, lx,ly,lz, sx,sy,sz, col, rx,ry,rz){
  _seE.set(rx||0,ry||0,rz||0); _seQ.setFromEuler(_seE); _seL.compose(_seP.set(lx,ly,lz), _seQ, _seS.set(sx,sy,sz));
  var m=new THREE.Matrix4().multiplyMatrices(this.base,_seL); this.n++;
  if(!this.inst){ var bk={gloss:"solid", solid:"solid", skin:"solid", metal:"metal", cloth:"cloth"}[key]; if(!bk) return;
    (this.B.b[bk]||(this.B.b[bk]=[])).push({g:seGeo()[gn], m:m, c:col}); }
  else (this.I[key+"|"+gn]||(this.I[key+"|"+gn]=[])).push({m:m, c:col});
};
SeKit.prototype.build=function(scene){
  var out=[], G=seGeo(), M=seMats(), c=new THREE.Color(), bb=new THREE.Box3(), v=new THREE.Vector3();
  for(var k in this.I){ var it=this.I[k], p=k.split("|"), mat=M[p[0]], geo=G[p[1]]; if(!mat||!geo) continue;
    var g=geo.clone(), im=new THREE.InstancedMesh(g, mat, it.length); bb.makeEmpty();
    for(var i=0;i<it.length;i++){ im.setMatrixAt(i, it[i].m); im.setColorAt(i, c.set(it[i].c==null?0xffffff:it[i].c).convertSRGBToLinear()); bb.expandByPoint(v.setFromMatrixPosition(it[i].m)); }
    var sp=new THREE.Sphere(); bb.getBoundingSphere(sp); sp.radius+=16; g.boundingSphere=sp; im.frustumCulled=true;   /* r128 turns culling off for InstancedMesh; with the town's sphere on the geometry it culls right */
    im.instanceMatrix.needsUpdate=true; im.castShadow=false; im.receiveShadow=(p[0]!=="blob"); im.matrixAutoUpdate=false; im.updateMatrix();
    if(p[0]==="blob") im.renderOrder=1;
    scene.add(im); out.push(im); seOwn(im); }
  return out;
};
function seMats(){
  var M=SALT.mats; if(M.iSolid) return M.iMap;
  M.iSolid=new THREE.MeshStandardMaterial({roughness:0.82});
  M.iGloss=new THREE.MeshStandardMaterial({roughness:0.32, metalness:0.25});
  M.iMetal=new THREE.MeshStandardMaterial({roughness:0.4, metalness:0.65});
  M.iCloth=new THREE.MeshStandardMaterial({roughness:0.88, side:THREE.DoubleSide});
  M.iSkin=new THREE.MeshStandardMaterial({roughness:0.7});
  var cv=newCanvas(64,64), x=cv.getContext("2d"), gr=x.createRadialGradient(32,32,2,32,32,31); gr.addColorStop(0,"rgba(0,0,0,0.55)"); gr.addColorStop(0.6,"rgba(0,0,0,0.3)"); gr.addColorStop(1,"rgba(0,0,0,0)");
  x.fillStyle=gr; x.fillRect(0,0,64,64);
  M.iBlob=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv), transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-2});
  M.iMap={solid:M.iSolid, gloss:M.iGloss, metal:M.iMetal, cloth:M.iCloth, skin:M.iSkin, blob:M.iBlob};
  return M.iMap;
}

/* --- prefabs: local x along the vehicle (front +x), y up, z across; all stand on y 0 --- */
var SE_LIV=[0xe9e6dc,0x1b1d20,0x9e2a22,0x22488f,0xd0d3d6,0x2c6b3a,0xd9a52b,0x6b2d6b,0x2a7d8c,0xc85a17];
var SE_SHIRT=[0xff7a1a,0x1d4787,0xf4efe2,0xb7261d,0x2c6b3a,0x3b3f45,0xd9a52b,0x7fb3d5,0xe36f8b,0x8a8f96];
var SE_PANTS=[0x2f3e5c,0x9c8a66,0x1d1f22,0x4a4f56,0x2f3e5c];
var SE_SKIN=[0xe0b48f,0xc89a78,0x9a6a4a,0x6e4a33,0xf0c8a8];
function seAxle(k, x, r, tw, lite, col){ if(lite) k.put("solid","box", x, r*0.8, 0, r*1.7, r*1.6, tw, col||0x18181a); else k.put("solid","seWheelL", x, r, 0, r*2, r*2, tw, col||0x18181a); }
function seBlob(k, x, z, l, w){ k.put("blob","seFlat", x, 0.015, z, l, 1, w, 0xffffff); }
/* a race rig: conventional tractor, enclosed trailer, the side door down as a ramp, an awning */
function sePfRig(k, s, lite, sides){
  var c=SE_LIV[Math.floor(seRng(s)*SE_LIV.length)], c2=SE_LIV[Math.floor(seRng(s+1)*SE_LIV.length)], DK=0x232528, CH=0xc9ccd0;
  k.put("gloss","box", 0, 2.3, 0, 13.4, 2.8, 2.55, c); k.put("solid","box", 0, 0.62, 0, 12.8, 0.42, 2.2, DK);
  if(!lite){ k.put("gloss","box", 0, 0.98, 1.28, 13.2, 0.18, 0.02, c2); k.put("gloss","box", 0, 0.98, -1.28, 13.2, 0.18, 0.02, c2); }
  seAxle(k, -5.2, 0.5, 2.4, lite); seAxle(k, -4.0, 0.5, 2.4, lite);
  /* tractor */
  k.put("solid","box", 8.6, 0.72, 0, 5.4, 0.36, 1.1, DK); k.put("gloss","box", 7.65, 2.25, 0, 1.6, 2.2, 2.4, c2);
  k.put("gloss","box", 9.5, 1.55, 0, 2.1, 1.05, 2.2, c2); if(!lite) k.put("gloss","box", 8.48, 2.75, 0, 0.06, 0.8, 2.2, 0x1a2128, 0, 0, 0.25);
  if(!lite) k.put("metal","box", 10.58, 1.45, 0, 0.08, 0.8, 1.2, CH); k.put("metal","box", 10.7, 0.75, 0, 0.18, 0.3, 2.4, CH);
  if(!lite){ k.put("metal","cyl6", 6.75, 3.0, 1.0, 0.16, 3.0, 0.16, CH); k.put("metal","cyl6", 6.75, 3.0, -1.0, 0.16, 3.0, 0.16, CH); }
  seAxle(k, 9.8, 0.5, 2.3, lite); seAxle(k, 7.2, 0.5, 2.4, lite); if(!lite) seAxle(k, 6.0, 0.5, 2.4, lite);
  if(sides!==0){ var sd=sides||-1, aw=SE_SHIRT[Math.floor(seRng(s+2)*SE_SHIRT.length)];
    k.put("cloth","box", 1.0, 3.1, sd*3.55, 7.0, 0.06, 4.6, aw, sd*0.09, 0, 0);
    k.put("metal","cyl6", -2.4, 1.5, sd*5.7, 0.06, 3.0, 0.06, 0x8d9296); k.put("metal","cyl6", 4.4, 1.5, sd*5.7, 0.06, 3.0, 0.06, 0x8d9296);
    k.put("solid","box", -3.2, 0.5, sd*2.2, 2.2, 0.06, 1.9, 0x8d9296, sd*0.42, 0, 0); }
  if(!lite) seBlob(k, 2.5, 0, 18, 4.2);
}
/* a pickup or dually towing an open car trailer, a race car on it */
function sePfHauler(k, s, lite){
  var c=SE_LIV[Math.floor(seRng(s+4)*SE_LIV.length)], car=SE_SHIRT[Math.floor(seRng(s+5)*SE_SHIRT.length)];
  sePfPickupBody(k, 3.6, c, lite);
  k.put("solid","box", -2.6, 0.62, 0, 6.2, 0.14, 2.2, 0x3b3f45); k.put("metal","box", 0.9, 0.55, 0, 1.4, 0.1, 0.12, 0x8d9296);
  seAxle(k, -2.4, 0.36, 2.3, lite); seAxle(k, -3.3, 0.36, 2.3, lite);
  sePfRaceCar(k, -2.6, 0.7, car, lite);
  if(!lite) seBlob(k, 0.5, 0, 13, 3.2);
}
/* the pickup shell used by the haulers and the parked cars (the real push truck is saltPickup) */
function sePfPickupBody(k, x, c, lite){
  k.put("gloss","box", x+0.8, 1.0, 0, 1.6, 0.45, 1.8, c); k.put("gloss","box", x-0.5, 1.15, 0, 1.2, 0.75, 1.8, c);
  k.put("gloss","box", x-0.48, 1.72, 0, 1.0, 0.45, 1.68, 0x1a2128); k.put("gloss","box", x-2.0, 0.98, 0, 1.9, 0.5, 1.8, c);
  k.put("metal","box", x+1.65, 0.65, 0, 0.12, 0.18, 1.85, 0xc9ccd0);
  seAxle(k, x+1.1, 0.38, 1.9, lite); seAxle(k, x-2.1, 0.38, 1.9, lite);
}
/* a low race car: a slab-sided hull, a cockpit hump, a roll hoop */
function sePfRaceCar(k, x, y, c, lite){
  k.put("gloss","box", x, y+0.42, 0, 4.2, 0.45, 1.05, c); k.put("gloss","cone", x+2.4, y+0.42, 0, 0.6, 0.8, 0.9, c, 0, PI/4, -PI/2);
  k.put("gloss","box", x-0.6, y+0.78, 0, 0.9, 0.3, 0.6, 0x1a2128);
  seAxle(k, x-1.3, 0.34, 1.5, lite); seAxle(k, x+1.4, 0.32, 1.5, lite);
}
/* a motorhome: cab-over front, stripe, window band, roof unit, a striped awning out on one side */
function sePfMotorhome(k, s, lite){
  var c=[0xf1efe8,0xe9e3d4,0xdcdcd8][Math.floor(seRng(s)*3)], st=[0x9e2a22,0x22488f,0x7a5a2a,0x2a7d8c,0x3b3f45][Math.floor(seRng(s+1)*5)];
  k.put("gloss","box", -0.4, 1.95, 0, 8.8, 2.9, 2.5, c); k.put("gloss","box", 4.4, 1.15, 0, 1.2, 1.3, 2.4, c);
  k.put("gloss","box", 4.95, 1.55, 0, 0.06, 0.62, 2.2, 0x1a2128, 0, 0, 0.3); k.put("gloss","box", 3.9, 3.0, 0, 1.4, 0.8, 2.4, c);
  k.put("gloss","box", 0, 1.35, 0, 10.1, 0.22, 2.53, st); k.put("gloss","box", -1.2, 2.45, 0, 6.0, 0.5, 2.53, 0x1a2128);
  if(!lite){ k.put("solid","box", -2.2, 3.5, 0, 1.0, 0.25, 0.8, 0xd0d3d6); k.put("cloth","box", -1.0, 2.9, 2.6, 4.8, 0.04, 2.6, st, -0.12, 0, 0);
    k.put("metal","cyl6", -3.3, 1.4, 3.85, 0.05, 2.8, 0.05, 0x8d9296); k.put("metal","cyl6", 1.3, 1.4, 3.85, 0.05, 2.8, 0.05, 0x8d9296);
    seBlob(k, 0, 0, 12, 3.6); }
  seAxle(k, 3.3, 0.48, 2.3, lite); seAxle(k, -2.6, 0.48, 2.3, lite);
}
/* an EZ-Up: four legs, valance, peaked top; a table and chairs under it */
function sePfEzUp(k, s, lite, sz){
  var c=SE_SHIRT[Math.floor(seRng(s+9)*SE_SHIRT.length)], h=sz/2-0.05;
  for(var q=0;q<4;q++) k.put("metal","box", (q>>1)?h:-h, 1.2, (q&1)?h:-h, 0.05, 2.4, 0.05, 0x8d9296);
  k.put("cloth","box", 0, 2.4, 0, sz, 0.24, sz, c); k.put("cloth","sePyr", 0, 2.52, 0, sz, 0.62, sz, c);
  k.put("solid","box", 0, 0.72, 0, 1.8, 0.05, 0.7, 0xeeeae0); if(!lite) for(q=0;q<2;q++) k.put("solid","box", 0, 0.38, (q?1:-1)*0.75, 0.75, 0.75, 0.5, 0x1d4787);
  if(!lite) seBlob(k, 0, 0, sz+0.6, sz+0.6);
}
function sePfGolfCart(k, s, lite){
  var c=[0xf1efe8,0x2c6b3a,0xc8331f,0x1f4f9a,0xd9a52b][Math.floor(seRng(s)*5)];
  k.put("gloss","box", 0, 0.55, 0, 2.3, 0.45, 1.15, c); k.put("solid","box", -0.35, 0.95, 0, 0.12, 0.55, 1.05, 0x1d1f22);
  k.put("gloss","box", -0.1, 1.95, 0, 2.0, 0.06, 1.25, 0xf1efe8);
  [[0.75,0.55],[0.75,-0.55],[-0.8,0.55],[-0.8,-0.55]].forEach(function(p){ k.put("metal", lite?"box":"cyl6", p[0], 1.3, p[1], 0.04, 1.3, 0.04, 0x8d9296); });
  seAxle(k, 0.75, 0.22, 1.05, lite); seAxle(k, -0.75, 0.22, 1.05, lite);
}
function sePfScooter(k, s, lite){
  var c=SE_SHIRT[Math.floor(seRng(s+3)*SE_SHIRT.length)];
  k.put("gloss","box", 0, 0.3, 0, 1.15, 0.16, 0.36, c); k.put("solid","box", -0.25, 0.62, 0, 0.45, 0.12, 0.3, 0x1d1f22);
  k.put("metal","box", 0.52, 0.65, 0, 0.05, 0.85, 0.05, 0x8d9296, 0, 0, -0.2); k.put("metal","box", 0.6, 1.05, 0, 0.05, 0.05, 0.6, 0x1d1f22);
  if(!lite){ k.put("solid","seWheelL", 0.48, 0.18, 0, 0.36, 0.36, 0.1, 0x18181a); k.put("solid","seWheelL", -0.45, 0.18, 0, 0.36, 0.36, 0.1, 0x18181a); }
}
function sePfToolCart(k, s, lite){
  var c=[0xb7261d,0x1d1f22,0x1d4787,0xc85a17][Math.floor(seRng(s+6)*4)];
  k.put("gloss","box", 0, 0.62, 0, 0.95, 0.85, 0.55, c); if(!lite) for(var q=0;q<3;q++) k.put("metal","box", 0.48, 0.42+q*0.24, 0, 0.02, 0.03, 0.4, 0xc9ccd0);
  k.put("metal","box", -0.56, 1.0, 0, 0.04, 0.04, 0.5, 0xc9ccd0); k.put("solid","box", 0, 0.12, 0, 0.8, 0.16, 0.45, 0x18181a);
}
function sePfFeather(k, s){
  var c=[0xff7a1a,0x1d4787,0xd9a52b,0xb7261d,0x2c6b3a][Math.floor(seRng(s)*5)];
  k.put("metal","cyl6", 0, 2.1, 0, 0.04, 4.2, 0.04, 0x8d9296); k.put("cloth","plane", 0.38, 2.6, 0, 0.72, 3.0, 1, c);
}
/* a person: legs, torso, head, maybe a cap; seated ones sit lower with their legs out */
function sePfPerson(k, s, lite, seated){
  var sh=SE_SHIRT[Math.floor(seRng(s)*SE_SHIRT.length)], pa=SE_PANTS[Math.floor(seRng(s+1)*SE_PANTS.length)], sk=SE_SKIN[Math.floor(seRng(s+2)*SE_SKIN.length)], ht=0.92+seRng(s+3)*0.16;
  if(lite){ k.put("solid","box", 0, ht*0.75, 0, 0.3, ht*1.5, 0.42, sh); k.put("solid","box", 0, ht*1.63, 0, 0.22, 0.24, 0.2, sk); return; }
  if(seated){ k.put("solid","box", 0.25, 0.5, 0, 0.55, 0.18, 0.34, pa); k.put("solid","box", 0.5, 0.25, 0, 0.14, 0.5, 0.3, pa);
    k.put("solid","cyl6", 0, 0.92, 0, 0.4, 0.62, 0.3, sh); k.put("skin","seHead", 0, 1.38, 0, 0.23, 0.26, 0.23, sk);
    k.put("solid","box", 0.05, 0.3, 0, 0.5, 0.6, 0.5, 0x1d4787); return; }
  k.put("solid","box", 0, ht*0.43, 0, 0.22, ht*0.86, 0.3, pa); k.put("solid","cyl6", 0, ht*1.17, 0, 0.42, ht*0.62, 0.3, sh);
  k.put("skin","seHead", 0, ht*1.62, 0, 0.23, 0.26, 0.23, sk);
  if(seRng(s+4)<0.4) k.put("solid","cyl6", 0.04, ht*1.62+0.12, 0, 0.26, 0.07, 0.26, [0xf4efe2,0xff7a1a,0x1d1f22,0x1d4787][Math.floor(seRng(s+5)*4)]);
}

/* --- the town: rows of pits behind the start, a return road, spectators behind the cones --- */
function saltPitTown(B, lite){
  var ult=(GFX==="ultra"), inst=!lite, pits=new SeKit(B, inst), line=new SeKit(B, inst), road=new SeKit(B, inst), i, k, x, z, s=11;
  SALT.town=[];
  /* rows of pits, aisles along x between them: rigs nose toward the line, EZ-Ups and carts in the gaps */
  var rows=lite?[{z:-54, n:4},{z:-78, n:3}]:[{z:-54, n:ult?8:7},{z:-78, n:ult?7:6},{z:-102, n:ult?8:5}];
  rows.forEach(function(r, ri){ var span=330/r.n;
    for(i=0;i<r.n;i++){ x=-232+span*(i+0.5)+(seRng(s)-0.5)*span*0.25; z=r.z+(seRng(s+1)-0.5)*3; var yaw=(seRng(s+2)-0.5)*0.12, kind=seRng(s+3);
      pits.at(x, z, yaw);
      if(kind<0.55) sePfRig(pits, s, lite, -1); else if(kind<0.8) sePfHauler(pits, s, lite); else sePfMotorhome(pits, s, lite);
      /* the pit around it: an EZ-Up with the car work under it, a tool cart, people */
      if(!lite || i%2===0){ var ex=x+(seRng(s+4)-0.5)*6, ez=z-8.5-seRng(s+5)*2; pits.at(ex, ez, (seRng(s+6)-0.5)*0.3); sePfEzUp(pits, s, lite, 3);
        if(!lite && seRng(s+7)<0.6){ pits.at(ex, ez, PI*(seRng(s+8)<0.5?0:1)); sePfRaceCar(pits, 0, 0.0, SE_SHIRT[Math.floor(seRng(s+8)*SE_SHIRT.length)], lite); }
        pits.at(ex+2.4, ez+1.2, seRng(s+9)*TAU); sePfToolCart(pits, s, lite);
        if(!lite){ var np=1+Math.floor(seRng(s+10)*(ult?3.5:2)); for(k=0;k<np;k++){ pits.at(ex+(seRng(s+11+k)-0.5)*5, ez+(seRng(s+15+k)-0.5)*4, seRng(s+19+k)*TAU); sePfPerson(pits, s*7+k, lite, false); } } }
      s+=23; }
  });
  /* the back row: motorhomes and haulers' living quarters */
  var nm=lite?1:(ult?11:6);
  for(i=0;i<nm;i++){ pits.at(-226+i*(330/nm)+seRng(s)*6, lite?-100:-122, (seRng(s+1)-0.5)*0.1+(i%2?PI:0)); sePfMotorhome(pits, s, lite); s+=7; }
  /* golf carts and scooters parked in the aisles, feather flags at pit corners */
  var ng=lite?2:(ult?14:10);
  for(i=0;i<ng;i++){ x=-220+seRng(s)*320; z=[-66,-90,-112][i%(lite?1:3)]+(seRng(s+1)-0.5)*3; pits.at(x, z, seRng(s+2)*TAU);
    if(i%3===2) sePfScooter(pits, s, lite); else sePfGolfCart(pits, s, lite);
    if(!lite && i%2===0){ pits.at(x+1.6, z+0.8, seRng(s+3)*TAU); sePfPerson(pits, s+5, lite, false); }
    s+=5; }
  if(!lite) for(i=0;i<(ult?14:9);i++){ pits.at(-228+i*(330/(ult?14:9))+seRng(s)*8, -44.5-seRng(s+1)*2, -PI/2); sePfFeather(pits, s); s+=3; }
  /* walkers in the aisles (Full/Ultra) */
  if(!lite) for(i=0;i<(ult?36:12);i++){ pits.at(-225+seRng(s)*325, [-66,-90,-112,-44][i%4]+(seRng(s+1)-0.5)*5, seRng(s+2)*TAU); sePfPerson(pits, s, lite, false); s+=3; }
  /* the start: a handful of officials and crew well off the line, clear of the push and stage cameras */
  pits.at(-22, -21, 0.4); sePfGolfCart(pits, 991, lite); pits.at(-16, -22.5, 0); sePfToolCart(pits, 992, lite);
  if(!lite) [[-19,-19.5],[-13,-21.5],[-24,-23],[-10,-24]].forEach(function(p,q){ pits.at(p[0], p[1], 1.2+q); sePfPerson(pits, 500+q, lite, false); });
  /* spectators along the course behind the left cones, folding chairs, EZ-Ups and their cars and pickups behind them */
  var x1=lite?320:(ult?900:560), st=lite?22:(ult?2.6:4.6);
  for(x=40; x<x1; x+=st*(0.7+seRng(s)*0.6)){ s+=3; if(seRng(s+1)<0.12) continue;
    var seat=seRng(s+2)<0.35; line.at(x, -21.2-seRng(s+3)*1.5, seat?-PI/2:(-PI/2+(seRng(s+4)-0.5)*1.2)); sePfPerson(line, s, lite, seat); }
  for(x=46; x<x1; x+=(lite?90:15)+seRng(s)*10){ s+=5; var kz=-28.5-seRng(s+1)*2.5;
    if(seRng(s+2)<0.35 && !lite){ line.at(x, -25.2, 0); sePfEzUp(line, s, lite, 3); }
    line.at(x+4, kz, (seRng(s+3)<0.5?0:PI)+(seRng(s+4)-0.5)*0.2);
    if(seRng(s+5)<0.5) sePfPickupBody(line, 0, SE_LIV[Math.floor(seRng(s+6)*SE_LIV.length)], lite); else sePfMotorhome(line, s, lite); }
  /* traffic on the return road: crews driving back to the pits */
  [[420,0],[260,1],[1300,1],[2600,0],[3900,1],[6200,0]].slice(0, lite?1:6).forEach(function(p, q){ road.at(p[0], -37.8+(p[1]?1.6:-1.6), p[1]?PI:0); sePfPickupBody(road, 0, SE_LIV[(q*3)%SE_LIV.length], lite); });
  if(inst){ var a=pits.build(SALT.scene), b=line.build(SALT.scene); road.build(SALT.scene);   /* the road's few trucks span the course: tiny, never dropped */
    SALT.town.push({ms:a, c:new THREE.Vector3(-60,0,-85)}, {ms:b, c:new THREE.Vector3(300,0,-26)}); }
  saltReturnRoad();
  if(!lite) saltPitCars(ult?3:1);
}
/* a parked car never moves: merge its meshes per material (a car's ~28 draw calls become ~8), no cast shadows */
function sePitBake(car){
  car.updateMatrixWorld(true); var by={}, out=new THREE.Group(), keepM=[];
  car.traverse(function(q){ if(!q.isMesh) return; for(var a=q; a; a=a.parent) if(!a.visible) return;
    if(q.matrixWorld.determinant()<0){ keepM.push(q); return; }
    var k=q.material.uuid; (by[k]||(by[k]={mat:q.material, it:[]})).it.push({g:q.geometry, m:q.matrixWorld.clone()}); });
  for(var k in by){ var m=new THREE.Mesh(mergeGeos(by[k].it), by[k].mat); m.receiveShadow=true; out.add(seOwn(m)); }
  keepM.forEach(function(q){ var m=new THREE.Mesh(q.geometry, q.material); q.matrixWorld.decompose(m.position, m.quaternion, m.scale); out.add(m); });
  out.userData={pit:true}; return out;
}
/* a few real salt cars parked at the front of the pits (Full 1, Ultra 3; Lite none; no cast shadows, ~13 draw calls each): rival looks when vis/salt.js offers them (saltRivalLook) */
function saltPitCars(n){
  SALT.pitCars=[]; var spots=[[-34,-45.5,0.25],[6,-46.5,-0.2],[-76,-45.8,0.1],[-118,-46.2,-0.15]], bodies=["lakester","roadster","streamliner","lakester"];
  for(var i=0;i<n;i++){ try{ var sp=spots[i], body=bodies[i], col=SE_SHIRT[(i*3+1)%SE_SHIRT.length], look=(typeof saltRivalLook==="function")?saltRivalLook(4100+i*17, body):undefined;
      var car=sePitBake(saltCar(body, col, i%2===0, look)); car.position.set(sp[0],0,sp[1]); car.rotation.y=sp[2]; SALT.scene.add(car); SALT.pitCars.push(car);
    }catch(e){ break; } }
}
/* the return road: a graded lane beside the course, two darker wheel tracks, soft edges */
function saltReturnRoad(){
  var cv=newCanvas(16,128), x=cv.getContext("2d"), y, a;
  for(y=0;y<128;y++){ var u=y/127, edge=Math.min(1, Math.min(u, 1-u)*6), tr=Math.exp(-Math.pow((u-0.3)/0.06,2))+Math.exp(-Math.pow((u-0.7)/0.06,2));
    a=edge*(0.22+0.32*tr); x.fillStyle="rgba(120,112,100,"+a.toFixed(3)+")"; x.fillRect(0,y,16,1); }
  var t=new THREE.CanvasTexture(cv); t.wrapS=THREE.RepeatWrapping;
  var L=12600, g=new THREE.PlaneGeometry(L, 8).rotateX(-PI/2);
  var m=new THREE.Mesh(g, new THREE.MeshBasicMaterial({map:t, transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-3}));
  m.position.set(70+L/2, 0.01, -37.8); m.renderOrder=1; SALT.scene.add(m); SALT.road=seOwn(m);
}

/* --- the push truck: a 60s-style pickup, two-tone, padded push bar, a crew member riding the bed. o: {crew, beacon, roof, stripe} --- */
function saltPickup(col, o){
  o=o||{}; seGeo(); var lite=(GFX==="lite"), g=new THREE.Group(), B=new StripBatch(), DK=0x1d1f22, CH=0xc9ccd0, GL=0x182028, roof=o.roof!=null?o.roof:0xf1efe8;
  var paint=new THREE.MeshStandardMaterial({color:sc(col), roughness:0.3, metalness:0.25});
  function P(key, x,y,z, w,h,d, c, rz, gn){ B.add(key, gn||"box", [x,y,z], [w,h,d], c, rz?[0,0,rz]:null); }
  /* paint ("p", the material colour) */
  P("p", -0.45, 1.0, 0, 1.75, 0.42, 1.8, 0xffffff); P("p", -1.975, 1.02, 0, 1.35, 0.46, 1.86, 0xffffff);
  P("p", -3.75, 1.02, 0.9, 2.2, 0.48, 0.06, 0xffffff); P("p", -3.75, 1.02, -0.9, 2.2, 0.48, 0.06, 0xffffff); P("p", -4.83, 1.02, 0, 0.06, 0.48, 1.8, 0xffffff);
  P("p", -1.42, 1.5, 0.84, 0.07, 0.6, 0.07, 0xffffff, 0.4); P("p", -1.42, 1.5, -0.84, 0.07, 0.6, 0.07, 0xffffff, 0.4);
  P("p", -2.52, 1.52, 0.84, 0.09, 0.56, 0.08, 0xffffff); P("p", -2.52, 1.52, -0.84, 0.09, 0.56, 0.08, 0xffffff);
  /* the rest ("g": vertex colours) */
  P("g", -2.05, 1.83, 0, 1.18, 0.08, 1.76, roof); P("g", -2.0, 1.52, 0, 1.0, 0.54, 1.68, GL); P("g", -1.42, 1.5, 0, 0.05, 0.6, 1.62, GL, 0.4);
  P("g", 0.44, 0.92, 0, 0.06, 0.34, 1.5, CH); P("g", 0.47, 0.92, 0, 0.02, 0.24, 1.2, DK); P("g", 0.47, 0.93, 0.66, 0.04, 0.16, 0.18, 0xf4f1e0); P("g", 0.47, 0.93, -0.66, 0.04, 0.16, 0.18, 0xf4f1e0);
  P("g", 0.55, 0.62, 0, 0.14, 0.18, 1.9, CH); P("g", -4.92, 0.62, 0, 0.12, 0.16, 1.9, CH);
  P("g", -4.87, 1.12, 0.84, 0.04, 0.18, 0.1, 0xb01c14); P("g", -4.87, 1.12, -0.84, 0.04, 0.18, 0.1, 0xb01c14);
  P("g", -2.2, 1.12, 0.935, 5.2, 0.07, 0.01, o.stripe!=null?o.stripe:roof); P("g", -2.2, 1.12, -0.935, 5.2, 0.07, 0.01, o.stripe!=null?o.stripe:roof);
  P("s", -1.9, 0.52, 0, 5.0, 0.18, 1.0, DK); P("s", -3.75, 0.8, 0, 2.2, 0.06, 1.74, 0x2a2b2e);
  P("s", 0.68, 0.85, 0.45, 0.12, 0.62, 0.1, DK); P("s", 0.68, 0.85, -0.45, 0.12, 0.62, 0.1, DK); P("s", 0.7, 0.6, 0, 0.1, 0.1, 1.0, DK);
  P("s", 0.82, 0.88, 0, 0.16, 0.36, 1.3, 0x121314);
  P("s", -1.33, 1.42, 1.0, 0.05, 0.16, 0.13, DK); P("s", -1.33, 1.42, -1.0, 0.05, 0.16, 0.13, DK);
  if(o.crew){ /* standing in the bed behind the cab, hands on the roof */
    var cx=-2.95, cz=0.42, fl=0.83; P("s", cx, fl+0.43, cz, 0.3, 0.86, 0.26, 0x1d1f22, 0, "cyl6"); P("g", cx, fl+1.17, cz, 0.44, 0.64, 0.32, 0xff6a14, 0, "cyl6");
    P("s", cx, fl+1.63, cz, 0.23, 0.26, 0.23, 0xc89a78, 0, "seHead"); P("g", cx+0.03, fl+1.76, cz, 0.27, 0.08, 0.27, 0xf1efe8, 0, "cyl6");
    [-1,1].forEach(function(sd){ B.add("g","box",[cx+0.24, fl+1.2, cz+sd*0.22],[0.55,0.09,0.09],0xff6a14,[0,0,-0.62]); });
    if(!lite){ P("s", -1.95, 1.5, -0.35, 0.36, 0.5, 0.3, 0x2a2b2e, 0, "cyl6"); P("s", -1.95, 1.74, -0.35, 0.2, 0.22, 0.2, 0x6e4a33, 0, "seHead"); } }
  if(o.beacon) P("b", -1.98, 1.93, 0, 0.26, 0.1, 1.3, 0xffffff);
  var WP=[[-3.5,-0.82],[-3.5,0.82],[-0.3,-0.82],[-0.3,0.82]], stat=!!o.beacon;   /* the safety truck: tyres merged into the body (seen from afar, it needn't roll; saves ~12 draw calls) */
  if(stat) WP.forEach(function(p){ B.add("s","cyl",[p[0],0.38,p[1]],[0.76,0.24,0.76],0x18181a,[PI/2,0,0]); });
  var keep=STRIP.scene; STRIP.scene=g;
  var mp=B.build("p", paint, !lite), mg=B.build("g", SALT.mats.solid.clone(), !lite), ms=B.build("s", SALT.mats.solid, !lite), mb=null;
  mg.material.roughness=0.35; mg.material.metalness=0.3;
  if(o.beacon){ var bm=new THREE.MeshStandardMaterial({color:sc(0xff8a1a), emissive:sc(0xff6a00), emissiveIntensity:2, roughness:0.4}); mb=B.build("b", bm, false); }
  /* wheels: Full rolls real ones; Lite merges tyre and hub into one mesh per wheel */
  var wh=[], M=sc_mats();
  WP.forEach(function(p){ if(stat) return;
    if(!lite){ var w=sc_wheel({x:p[0], z:p[1], r:0.38, w:0.24, rimR:0.2, style:"star", rimMat:"alu"}, M); w.position.set(p[0],0.38,p[1]); g.add(w); wh.push(w.userData.spin); return; }
    var spin=new THREE.Group(); spin.rotation.x=PI/2; spin.position.set(p[0],0.38,p[1]); var wb=new StripBatch();
    wb.add("w","cyl",[0,0,0],[0.76,0.24,0.76],0x18181a); wb.add("w","cyl6",[0,0,0],[0.42,0.26,0.42],0xc9ccd0); wb.add("w","box",[0,0,0],[0.08,0.27,0.4],0x5a5d62);
    STRIP.scene=spin; seOwn(wb.build("w", SALT.mats.solid, false)); g.add(spin); wh.push(spin); });
  STRIP.scene=keep; [mp,mg,ms,mb].forEach(seOwn);   /* the merged batches are this truck's own */
  g.userData={wheels:wh, front:0.9, paint:paint, beacon:mb, col:col};
  return g;
}
/* what colour the push truck wears: a colour vis/salt.js sets (SALT.pushColor, or a repaint of saltPushTruck), else whatever stands out from the car */
function saltPushCol(carCol){
  if(typeof SALT.pushColor==="number") return SALT.pushColor;
  if(typeof SALT_PUSH_COL==="number") return SALT_PUSH_COL;   /* vis/salt-look.js picks the colour when it has one */
  if(SALT.pushFixed===undefined){ SALT.pushFixed=null;
    try{ var g=saltPushTruck(), c=null; g.traverse(function(q){ if(!c && q.isMesh && q.material && q.material.color) c=q.material.color; });
      var old=sc(0x2c6b3a); if(c && Math.abs(c.r-old.r)+Math.abs(c.g-old.g)+Math.abs(c.b-old.b)>0.02) SALT.pushFixed=c.clone().convertLinearToSRGB().getHex(); }catch(e){} }
  if(SALT.pushFixed!=null) return SALT.pushFixed;
  var cc=new THREE.Color(carCol==null?0xd9a52b:carCol), best=SALT_PUSH_PAL[0], bd=-1;
  SALT_PUSH_PAL.forEach(function(h){ _seCol.set(h); var d=Math.pow(_seCol.r-cc.r,2)*0.3+Math.pow(_seCol.g-cc.g,2)*0.59+Math.pow(_seCol.b-cc.b,2)*0.11+Math.abs((_seCol.r+_seCol.g+_seCol.b)-(cc.r+cc.g+cc.b))*0.05; if(d>bd){ bd=d; best=h; } });
  return best;
}

/* --- spins: the car lifts, rolls a little, swaps ends and slides off line; the pose holds once it stops --- */
function saltSpinPose(V, o, dt, ph){
  var P=SALT.sp||(SALT.sp={on:false, t:0, yaw:0, z:0});
  if(ph!=="spin" && !(ph==="done" && P.on)){ if(P.on){ P.on=false; } V.rotation.set(0,0,0); V.position.y=0; V.position.z=0; return; }
  var v=Math.max(0,+o.v||0);
  if(!P.on){ P.on=true; P.t=0; P.yaw=0; P.z=0; P.v0=v; P.side=(Math.floor(Math.abs(+o.x||0)*0.37)%2)?1:-1; P.landed=false; P.start=true; }
  if(ph==="spin"){ P.t+=dt; var w=clamp(v/13,0.25,3.4)*smoothstep(0,0.45,P.t); P.yaw+=P.side*w*dt;
    P.z=clamp(P.z+P.side*v*0.045*smoothstep(0.2,1.2,P.t)*Math.abs(Math.sin(P.yaw*0.5+0.3))*dt, -18, 18); }
  var t=P.t, A=clamp(P.v0/110,0.12,1), lift=0, nose=0;
  if(P.v0>30){ if(t<0.9){ lift=A*0.62*Math.sin(PI*t/0.9); nose=A*0.1*Math.sin(PI*t/0.9); } else if(t<1.3) lift=A*0.12*Math.sin(PI*(t-0.9)/0.4); }
  if(t>=0.9 && !P.landed){ P.landed=true; P.land=P.v0>30; }
  var roll=P.side*A*0.3*Math.sin(PI*clamp(t/1.3,0,1)) - 0.07*clamp(v/50,0,1)*Math.sin(P.yaw);
  V.rotation.order="YXZ"; V.rotation.set(roll, P.yaw, nose); V.position.y=lift; V.position.z=P.z;
}
/* skid and scuff marks: instanced quads in a ring buffer, laid along each tyre's path */
function seMarks(){
  if(SALT.mk && SALT.mk.mesh.parent===SALT.scene) return SALT.mk;   /* a quality change rebuilds the flats: start a fresh set in the new scene */
  var cap=GFX==="lite"?240:(GFX==="ultra"?1400:720), g=new THREE.PlaneGeometry(1,1); g.rotateX(-PI/2);
  var m=new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.6, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-4}), cap);
  m.setColorAt(0, _seCol.setRGB(1,1,1)); m.count=0; m.visible=false; m.frustumCulled=false; m.renderOrder=2;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.instanceColor.setUsage(THREE.DynamicDrawUsage); SALT.scene.add(m); seOwn(m);
  return (SALT.mk={mesh:m, cap:cap, i:0, n:0, last:null});
}
function seMark(ax, az, bx, bz, w, shade){
  var K=seMarks(), dx=bx-ax, dz=bz-az, len=Math.sqrt(dx*dx+dz*dz); if(len<0.05) return;
  _seQ.setFromAxisAngle(_seP.set(0,1,0), Math.atan2(-dz, dx));
  _seM.compose(_seA.set((ax+bx)/2, 0.014, (az+bz)/2), _seQ, _seS.set(len+w*0.4, 1, w));
  K.mesh.setMatrixAt(K.i, _seM); K.mesh.setColorAt(K.i, _seCol.setRGB(0.2+0.55*shade, 0.185+0.55*shade, 0.17+0.55*shade));
  K.i=(K.i+1)%K.cap; K.n=Math.min(K.cap, K.n+1); K.mesh.count=K.n; K.mesh.visible=true; K.mesh.instanceMatrix.needsUpdate=true; K.mesh.instanceColor.needsUpdate=true;
}
function seMarksClear(){ var K=SALT.mk; if(!K) return; K.i=0; K.n=0; K.mesh.count=0; K.mesh.visible=false; K.last=null; }
/* the car's tyre contact points, car-local [x, z, rear?] */
function seContacts(U){
  if(U.seCt) return U.seCt; var me=U.me, L=[];
  if(U.wheels && U.wheels.length) U.wheels.forEach(function(W){ var p=W.s.parent.position; L.push([p.x, p.z, !!W.rear, W.r]); });
  else { var tw=U.strip?0.78:0.7; L=[[0,tw,true,0.34],[0,-tw,true,0.34],[me.wb||2.6,tw,false,0.32],[me.wb||2.6,-tw,false,0.32]]; }
  return (U.seCt=L);
}
function seMarksUpdate(o, V, ph){
  var U=V.userData, v=Math.max(0,+o.v||0), slip=clamp(+o.slip||0,0,1), P=SALT.sp, spin=(P&&P.on&&ph==="spin"), K=seMarks(), C=seContacts(U);
  var cur={x:V.position.x, z:V.position.z, yaw:V.rotation.y}, run=(ph==="run"||ph==="shutdown");
  var lay=(spin && V.position.y<0.03 && v>1.2) || (run && slip>0.28 && v>6);
  if(!lay || !K.last){ K.last=lay?cur:null; return; }
  var L=K.last, d=Math.abs(cur.x-L.x)+Math.abs(cur.z-L.z)+Math.abs(cur.yaw-L.yaw)*2.5; if(d<0.6) return;
  var n=Math.min(24, Math.max(1, Math.ceil(d/1.2))), i, j, sh=spin?0.0:0.55;
  for(j=0;j<C.length;j++){ if(!spin && !C[j][2]) continue; var w=clamp(C[j][3]*0.75,0.18,0.34);
    var px=null, pz=null;
    for(i=0;i<=n;i++){ var f=i/n, x=lerp(L.x,cur.x,f), z=lerp(L.z,cur.z,f), y=lerp(L.yaw,cur.yaw,f), cs=Math.cos(y), sn=Math.sin(y);
      var wx=x+C[j][0]*cs+C[j][1]*sn, wz=z-C[j][0]*sn+C[j][1]*cs;
      if(px!==null) seMark(px, pz, wx, wz, w, sh+(spin?0.25*Math.abs(Math.cos(y)):0)); px=wx; pz=wz; } }
  K.last=cur;
}
/* salt dust: billowing clouds while it slides, a ring when it lands from the lift */
function seSpinDust(o, dt, V){
  var P=SALT.sp, FX=SALT.fx, lite=GFX==="lite", R=Math.random, v=Math.max(0,+o.v||0), i;
  if(!P || !P.on || !FX) return;
  if(P.land){ P.land=false; for(i=0;i<(lite?10:26);i++){ var a=i/(lite?10:26)*TAU; FX.emit(V.position.x+Math.cos(a)*1.5, 0.3, V.position.z+Math.sin(a)*1.5, Math.cos(a)*6+v*0.3, 0.8+R(), Math.sin(a)*6, 2.5+R()*2, 1.2, 6+R()*4, 0.95, 0.95, 0.93, 0.42, {drag:1.2, buoy:0.1, fin:0.05, spin:0.4}); } }
  if(v<1.5 || V.position.y>0.05) return;
  var nc=(lite?0.5:1)*clamp(v/20,0.3,3)*30*dt, n=Math.floor(nc)+(R()<nc%1?1:0), C=seContacts(V.userData), cs=Math.cos(V.rotation.y), sn=Math.sin(V.rotation.y);
  for(i=0;i<n;i++){ var c=C[Math.floor(R()*C.length)], wx=V.position.x+c[0]*cs+c[1]*sn, wz=V.position.z-c[0]*sn+c[1]*cs;
    FX.emit(wx, 0.25+R()*0.3, wz, v*(0.2+R()*0.3), 0.5+R()*1.4, (R()-0.5)*4, 3+R()*3, 0.8, 5+R()*5+v*0.04, 0.95, 0.95, 0.93, 0.36, {drag:0.75, buoy:0.12, fin:0.1, spin:0.35}); }
}
/* the safety truck: rolls from the next station down the course to the stopped car, beacon going */
function seSafety(o, dt, V){
  var P=SALT.sp, T=SALT.safety; if(T && T.parent!==SALT.scene) T=SALT.safety=null;
  if(!P || !P.on){ if(T) T.visible=false; return; }
  if(!T){ T=SALT.safety=saltPickup(0xf1efe8, {beacon:true, stripe:0xff6a14, roof:0xff6a14}); SALT.scene.add(T); }
  var u=T.userData, v=Math.max(0,+o.v||0);
  if(P.start || !u.st){ P.start=false; var side=-P.side; u.st={x:V.position.x+v*v/(2*7)+50, z:V.position.z+side*20, yaw:PI, v:0, wait:0.5, side:side};   /* from the station just past where the car will stop (salt plus the chute pulls ~0.7 g) */ }
  var S=u.st; S.wait-=dt;
  if(S.wait<0){ var tx=V.position.x-4, tz=V.position.z+S.side*6.5, dx=tx-S.x, dz=tz-S.z, d=Math.sqrt(dx*dx+dz*dz);
    var want=Math.min(30, d*0.7), hd=Math.atan2(-dz, dx), dy=((hd-S.yaw+PI*3)%TAU)-PI;
    if(d>1.2){ S.yaw+=clamp(dy, -1.4*dt, 1.4*dt)*Math.min(1, S.v/3+0.3); } else want=0;
    S.v+=clamp(want-S.v, -8*dt, 5*dt); S.x+=Math.cos(S.yaw)*S.v*dt; S.z-=Math.sin(S.yaw)*S.v*dt; }
  T.position.set(S.x, 0, S.z); T.rotation.y=S.yaw; T.visible=true;
  for(var i=0;i<u.wheels.length;i++) u.wheels[i].rotation.y=(u.wheels[i].rotation.y-S.v/0.38*dt)%TAU;
  if(u.beacon) u.beacon.material.emissiveIntensity=(Math.sin(SALT.t*13)>0.2)?3.2:0.25;
}

/* --- the chute, salt only: thick shroud lines in a colour that reads on salt, a dark tether, a pilot chute that pulls the main out --- */
var SE_PILOT=0.45;
function seChuteList(U){
  if(U.strip){ var cu=U.car&&U.car.userData; return (cu&&cu.chute)?[{ch:cu.chute, A:cu.anim, me:cu.meta}]:[]; }
  var L=[]; for(var i=0;i<U.chutes.length;i++) L.push({ch:U.chutes[i], A:U.A[i], me:U.me}); return L;
}
function seChuteRig(ch){
  var u=ch.userData; if(u.se) return u.se; var M=SALT.mats;
  if(!M.seLine){ M.seLine=new THREE.MeshStandardMaterial({color:sc(0xe0582c), roughness:0.8}); M.seTether=new THREE.MeshStandardMaterial({color:sc(0x26282c), roughness:0.7}); }
  u.lines.forEach(function(l){ l.material=M.seLine; }); u.bridle.material=M.seTether;
  var pc=new THREE.Mesh(u.canopy.geometry, u.canopy.material); pc.castShadow=false; pc.visible=false; ch.add(pc);
  var pl=new THREE.Mesh(u.lines[0].geometry, M.seLine); pl.visible=false; ch.add(pl);
  return (u.se={pilot:pc, pline:pl, t:-1, bloom:false});
}
function seChutes(o, dt, V, ph){
  var U=V.userData, L=seChuteList(U), FX=SALT.fx, lite=GFX==="lite", R=Math.random, v=Math.max(0,+o.v||0), P=SALT.sp;
  for(var i=0;i<L.length;i++){ var it=L[i], ch=it.ch, me=it.me, A=it.A; if(!ch || !A) continue; var se=seChuteRig(ch), u=ch.userData, cn=u.canopy;
    if(!ch.visible){ se.t=-1; se.bloom=false; se.pilot.visible=se.pline.visible=false; continue; }
    var first=(se.t<0); se.t=first?0:se.t+dt;
    if(se.t<SE_PILOT) A.chT=0;            /* the main stays in its bag until the pilot has pulled it out */
    ch.rotation.y=(P&&P.on)?-V.rotation.y:0;   /* in a spin the chute streams back down the course, whichever way the car points */
    for(var j=0;j<u.lines.length;j++){ u.lines[j].scale.x=u.lines[j].scale.z=4.5; } u.bridle.scale.x=u.bridle.scale.z=3;
    /* pilot */
    var pc=se.pilot, pl=se.pline, rc=me.chuteR||0.9, bob=Math.sin(SALT.t*7+i)*0.08;
    if(se.t<SE_PILOT){ var f=smoothstep(0,SE_PILOT,se.t); _seA.set(-(0.3+me.chuteLen*0.8*f), (me.chuteRise||0.5)*0.9*f+bob, bob*0.6);
      _seB.copy(_seA).negate().normalize(); pc.quaternion.setFromUnitVectors(_seX, _seB); pc.scale.setScalar(0.32*Math.min(1, 0.25+se.t/0.12));
      _seC.copy(cn.position); }
    else { _seB.copy(cn.position).normalize(); var ap=rc*0.62*cn.scale.x;
      _seC.copy(cn.position).addScaledVector(_seB, ap); _seA.copy(_seC).addScaledVector(_seB, 1.6+bob); _seA.y+=bob*0.5;
      pc.quaternion.copy(cn.quaternion); pc.scale.setScalar(0.32*(1-0.45*(A.chC||0))); }
    var pOn=!(lite && se.t>SE_PILOT+0.8);   /* Lite drops the pilot once the main is open: two draw calls back */
    pc.position.copy(_seA); pc.visible=pOn; sc_setLine(pl, _seC, _seA); pl.scale.x=pl.scale.z=3.5; pl.visible=pOn;
    if(!FX) continue;
    /* deploy: the bag kicks a puff of salt off the tail; the main's blossom blasts more off the salt below it */
    if(first){ ch.localToWorld(_seA.set(0,0,0)); for(var q=0;q<(lite?8:20);q++) FX.emit(_seA.x-R()*1.5, 0.2+R()*0.6, _seA.z+(R()-0.5)*1.6, v*0.6, 0.3+R()*1.2, (R()-0.5)*3, 1.5+R()*2, 0.6, 3.5+R()*3, 0.95, 0.95, 0.93, 0.4, {drag:1.0, buoy:0.12, fin:0.05, spin:0.5});
      if(ph==="shutdown" && !SALT.cueDone){ SALT.cue="heli"; SALT.cueDone=true; SALT.cueBack=SALT.t+3.4; } }
    if(!se.bloom && se.t>SE_PILOT+0.3){ se.bloom=true; ch.localToWorld(_seA.copy(cn.position)); for(q=0;q<(lite?8:22);q++){ var a=R()*TAU; FX.emit(_seA.x+Math.cos(a)*rc, 0.2, _seA.z+Math.sin(a)*rc, v*0.5+Math.cos(a)*3, 0.4+R()*0.8, Math.sin(a)*3, 2+R()*2, 1.0, 5+R()*4, 0.95, 0.95, 0.93, 0.34, {drag:0.9, buoy:0.1, fin:0.08, spin:0.4}); } }
  }
  if(SALT.cueBack && SALT.t>SALT.cueBack){ SALT.cueBack=0; if(SALT.shot==="heli" && ph==="shutdown") SALT.cue="chute"; }
}

/* vis/salt-look.js builds the push truck through saltMakePush when it is there */
function saltMakePush(){ return saltPickup(saltPushCol(null), {crew:true}); }
/* --- per frame, from saltUpdate after the car is posed --- */
function saltEventUpdate(o, dt, V, ph){
  var E=SALT.ev||(SALT.ev={ph:null});
  if(ph==="stage" && E.ph!=="stage"){ seMarksClear(); SALT.cue=null; SALT.cueDone=false; SALT.cueBack=0; if(SALT.safety){ SALT.safety.visible=false; SALT.safety.userData.st=null; } }
  E.ph=ph;
  /* the push truck stands out from whatever the car is painted */
  var pu=SALT.push&&SALT.push.userData; if(pu && pu.paint){ var pc=saltPushCol(o.color); if(pc!==pu.col){ pu.col=pc; pu.paint.color.copy(sc(pc)); } }
  seMarksUpdate(o, V, ph); seSpinDust(o, dt, V); seSafety(o, dt, V); seChutes(o, dt, V, ph);
  /* the pit cars only show near the start; the town drops out once the camera is miles away from it */
  if(SALT.pitCars && SALT.pitCars.length){ var near=SALT.camPos.x<260 && SALT.camPos.distanceTo(_seA.set(-50,0,-46))<260; if(SALT.pitCars[0].visible!==near) SALT.pitCars.forEach(function(c){ c.visible=near; }); }
  if(SALT.town && SALT.cam) for(var i=0;i<SALT.town.length;i++){ var T=SALT.town[i], on=SALT.camPos.distanceTo(T.c)<3200; if(T.on!==on){ T.on=on; T.ms.forEach(function(m){ m.visible=on; }); } }
}
/* ===========================================================================
   CLOUDSPLITTER PEAK SCENE — the hillclimb, a world the view cuts to while
   ENGINE_VIS.setHill({on:true, course, s, v, d, ...}) is fed every frame.
   Units metres. The course comes from ENGINE_SIM.hillCourse (x, y, heading,
   curvature, altitude per 2.5 m sample); world x = course x − ox, world z =
   −(course y − oy), world y = altitude − 2,862 m. Built once on first use:
   a heightfield mountain shaped round the road (the road's own altitude near
   it, the mountain's fall line away from it, cliffs off the drops), a road
   ribbon with gravel verges, guardrails on the railed drops, sparse pines
   below the treeline giving way to boulders, a start gantry and the summit
   house. The sky deepens and the haze clears as the car climbs. On Full and
   Ultra the Blender props (hillModels, at the end) dress it further.
   ==========================================================================*/
var HILL_RW=8, _hA=new THREE.Vector3(), _hB=new THREE.Vector3(), _hC=new THREE.Vector3(), _hW=new THREE.Vector3(0.8,0,-0.3);
function hillSkyMat(){
  return new THREE.ShaderMaterial({ uniforms:{ uSun:{value:new THREE.Vector3(-0.35,0.62,0.7).normalize()}, uAlt:{value:0} },
    vertexShader:"varying vec3 vDir; void main(){ vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position.z=gl_Position.w; }",
    fragmentShader:["uniform vec3 uSun; uniform float uAlt; varying vec3 vDir;",
      "void main(){ vec3 d=normalize(vDir); float h=d.y, up=clamp(h,0.0,1.0);",
      /* thin air: less scattering, so the zenith goes a deeper, darker blue and the horizon haze thins as the car climbs */
      " vec3 zen=mix(vec3(0.07,0.18,0.46),vec3(0.018,0.07,0.30),uAlt), hor=mix(vec3(0.60,0.68,0.76),vec3(0.50,0.62,0.78),uAlt);",
      " vec3 col=mix(hor,zen,pow(up,mix(0.5,0.38,uAlt))); col=mix(col,hor*0.85,smoothstep(0.0,-0.08,h));",
      " float sd=max(dot(d,uSun),0.0); col+=vec3(1.0,0.86,0.62)*(pow(sd,6.0)*mix(0.18,0.08,uAlt)+pow(sd,60.0)*0.3); col+=vec3(1.0,0.95,0.85)*smoothstep(0.9996,0.9999,sd)*6.0;",
      " gl_FragColor=vec4(col,1.0); }"].join("\n"), side:THREE.BackSide, depthWrite:false });
}
var HILL_GLSL_TERR=[
  "vec3 stripSurf(vec3 w, out float rough){",
  "  vec2 p=w.xz; float d=length(p-cameraPosition.xz); float fine=1.0-smoothstep(25.0,140.0,d);",
  "  float n=0.82+0.3*sn(p*0.045)+0.12*sn(p*0.31)*fine+0.07*sn(p*2.3)*fine;",
  /* Full / Ultra: scree and duff grain, granite facets, and the bump to catch the low sun */
  "#if STRIP_TIER>=1",
  "  float dh, gh; vec3 dm=sfDirtFx(p*0.8,0.6,dh), gm=sfGrassFx(p,gh); float rk=1.0-abs(2.0*sn(p*0.6+7.0)-1.0), rkf=aaf(0.5);",
  "  gH=0.5*(dh+gh)+0.14*rk*rk*rkf; gHK=1.0; gMacroK=0.8; rough=0.95; return vec3(n)*(0.5*(dm+gm))*(1.0-0.16*rk*rkf);",
  "#else",
  "  rough=0.95; return vec3(n);",
  "#endif",
  "}"].join("\n");
/* course sample → world (fractional i ok), lateral offset d (+ left), height above the road */
function hillPt(W, i, d, y, out){ var T=W.T, N=T.N, f=clamp(i,0,N-1.001), i0=Math.floor(f), t=f-i0, a=i0, b=Math.min(N-1,i0+1);
  var x=lerp(T.x[a],T.x[b],t), yy=lerp(T.y[a],T.y[b],t), h=T.h[a]+((T.h[b]-T.h[a]+PI*3)%TAU-PI)*t, z=lerp(T.z[a],T.z[b],t);
  return out.set(x-Math.sin(h)*d-W.ox, z-W.z0+y, -(yy+Math.cos(h)*d-W.oy)); }
function hillHd(T, i){ var N=T.N, f=clamp(i,0,N-1.001), i0=Math.floor(f), t=f-i0, a=i0, b=Math.min(N-1,i0+1); return T.h[a]+((T.h[b]-T.h[a]+PI*3)%TAU-PI)*t; }
/* the mountain: a cone fitted to the road (altitude falls with distance from the summit), the road's own altitude
   blended in near it (inverse-distance over road samples every 50 m), the fall line amplified away from it, drops cut
   off the outside of the drop corners, rock relief where it's far from anything */
function hillTerrainFn(W){
  var T=W.T, N=T.N, sx=T.x[N-1], sy=T.y[N-1], i, S=[], n=0, a=0, b=0, c=0, d=0, e=0;
  for(i=0;i<N;i+=4){ var r=Math.hypot(T.x[i]-sx,T.y[i]-sy); a+=r; b+=T.z[i]; c+=r*r; d+=r*T.z[i]; n++; }
  var kc=-(n*d-a*b)/(n*c-a*a), z0=(b+kc*a)/n; kc=clamp(kc,0.08,0.4);
  var F=function(x,y){ return z0-kc*Math.hypot(x-sx,y-sy); };
  for(i=0;i<N;i+=20) S.push([T.x[i],T.y[i],T.z[i],F(T.x[i],T.y[i])]);
  /* fine hash of road samples every 5 m: nearest road point, its side, its corner */
  var CS=40, H=new Map(), key=function(ix,iy){ return (ix+4096)*8192+(iy+4096); };
  for(i=0;i<N;i+=2){ var k=key(Math.floor(T.x[i]/CS),Math.floor(T.y[i]/CS)); if(!H.has(k)) H.set(k,[]); H.get(k).push(i); }
  var drop=new Int8Array(N); T.corners.forEach(function(cn){ if(!cn.drop) return; for(var q=Math.max(0,cn.i0-6);q<=Math.min(N-1,cn.i1+6);q++) drop[q]=cn.rail?-2*cn.side:-cn.side; });
  W.drop=drop;
  var near=function(x,y,R){ var ix=Math.floor(x/CS), iy=Math.floor(y/CS), rr=Math.ceil(R/CS), best=-1, bd=R*R;
    for(var u=-rr;u<=rr;u++) for(var v=-rr;v<=rr;v++){ var L=H.get(key(ix+u,iy+v)); if(!L) continue; for(var q=0;q<L.length;q++){ var j=L[q], dx=T.x[j]-x, dy=T.y[j]-y, dd=dx*dx+dy*dy; if(dd<bd){ bd=dd; best=j; } } }
    return best<0?null:{i:best, d:Math.sqrt(bd)}; };
  W.near=near;
  return function(x,y){
    var sw=0, sz=0, sf=0; for(var q=0;q<S.length;q++){ var p=S[q], dx=p[0]-x, dy=p[1]-y, w=1/Math.pow(dx*dx+dy*dy+900,1.5); sw+=w; sz+=w*p[2]; sf+=w*p[3]; }
    var zI=sz/sw, h=zI+2.4*(F(x,y)-sf/sw), nr=near(x,y,160), dm=nr?nr.d:160;
    var u=(x-W.box[0])/W.span, v=(y-W.box[1])/W.span, far=smoothstep(25,220,dm);
    h+=(fbm(u,v,4,6,11)-0.5)*70*far+(ridge(u,v,3,14,5)-0.5)*26*far;
    if(nr){ var j=nr.i, dr=drop[j]; if(dr){ var side=Math.sign(-Math.sin(T.h[j])*(x-T.x[j])+Math.cos(T.h[j])*(y-T.y[j])), want=Math.sign(dr); if(side===want) h-=(Math.abs(dr)===2?24:38)*smoothstep(6,60,dm); }
      if(dm<70) h=lerp(T.z[j]-0.4, h, smoothstep(6,70,dm)); }
    return h; };
}
function hillTerrColor(alt, slope, n, out){   /* forest floor → alpine tundra → bare granite, by altitude and steepness */
  var tl=smoothstep(3460,3640,alt+n*90), hi=smoothstep(3950,4250,alt+n*60), st=smoothstep(0.55,1.1,slope);
  var r=lerp(0.17,0.30,tl), g=lerp(0.22,0.26,tl), b=lerp(0.11,0.17,tl);   /* pine duff and grass → tundra and Cloudsplitter Peak granite, pinkish grey */
  r=lerp(r,0.36,hi); g=lerp(g,0.30,hi); b=lerp(b,0.27,hi);
  r=lerp(r,0.38,st*0.7); g=lerp(g,0.31,st*0.7); b=lerp(b,0.28,st*0.7);
  var k=0.86+0.28*n; return out.setRGB(r*k,g*k,b*k).convertSRGBToLinear(); }
function hillAsphaltTex(){ var t=roadAsphaltTex(), c=t.image, x=c.getContext("2d"); x.fillStyle="rgba(226,178,40,0.95)"; x.fillRect(119,0,5,512); x.fillRect(132,0,5,512); t.needsUpdate=true; return t; }
function buildHillWorld(T){
  var lite=(GFX==="lite"), ultra=(GFX==="ultra"), N=T.N, ds=T.ds, hw=HILL_RW/2, i, q, k;
  var W={T:T, scene:new THREE.Scene(), mats:{}, stations:[], tier:GFX, ox:(T.box[0]+T.box[2])/2, oy:(T.box[1]+T.box[3])/2, z0:T.z[0]}, S5=W.scene, M=W.mats;
  var rng=function(s){ var t=Math.sin(s*127.1+3.7)*43758.5453; return t-Math.floor(t); };
  var hemi=new THREE.HemisphereLight(0xd6e4f6, 0x5f5444, 0.3); S5.add(hemi); W.hemi=hemi;
  var sun=new THREE.DirectionalLight(0xfff0d8, 1.6); sun.shadow.mapSize.set(lite?512:2048,lite?512:2048); var shc=sun.shadow.camera; shc.left=-34; shc.right=34; shc.top=34; shc.bottom=-34; shc.near=1; shc.far=400; sun.shadow.bias=-0.0006; sun.shadow.normalBias=0.04; sun.castShadow=!lite;
  if(ultra){ sun.shadow.mapSize.set(4096,4096); shc.left=shc.bottom=-48; shc.right=shc.top=48; }   /* Ultra: a sharper, wider sun shadow */
  S5.add(sun); S5.add(sun.target); W.sun=sun; W.sunDir=new THREE.Vector3(-0.35,0.62,0.7).normalize();
  var sky=new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), hillSkyMat()); sky.frustumCulled=false; stripSkyLate(sky); S5.add(sky); W.sky=sky;
  S5.fog=new THREE.Fog(0xa8b8c8, 500, 6000); W.fog=S5.fog; W.horLin=new THREE.Color(0.6,0.68,0.76);
  S5.environment=stripEnv(false);
  /* terrain grid over the course box plus a margin */
  var m=900; W.box=[T.box[0]-m, T.box[1]-m, T.box[2]+m, T.box[3]+m]; W.span=Math.max(W.box[2]-W.box[0], W.box[3]-W.box[1]);
  var Hf=hillTerrainFn(W), G=lite?110:ultra?280:190, cw=(W.box[2]-W.box[0])/G, ch2=(W.box[3]-W.box[1])/G, gh=new Float32Array((G+1)*(G+1));
  W.G=G; W.cw=cw; W.ch=ch2; W.gh=gh;
  var clampR=Math.max(cw,ch2)*1.05+hw;
  for(var gy=0;gy<=G;gy++) for(var gx=0;gx<=G;gx++){ var x=W.box[0]+gx*cw, y=W.box[1]+gy*ch2, h=Hf(x,y), nr=W.near(x,y,clampR); if(nr) h=Math.min(h, T.z[nr.i]-1.3-0.04*nr.d); gh[gy*(G+1)+gx]=h; }
  /* the grid surface itself (two triangles per cell, same split as the mesh), for the verges, trees and cameras */
  W.gH=function(x,y){ var fx=clamp((x-W.box[0])/cw,0,G-1e-4), fy=clamp((y-W.box[1])/ch2,0,G-1e-4), ix=Math.floor(fx), iy=Math.floor(fy), u=fx-ix, v=fy-iy, R=G+1;
    var a=gh[iy*R+ix], b=gh[iy*R+ix+1], c=gh[(iy+1)*R+ix], d=gh[(iy+1)*R+ix+1]; return u+v<=1 ? a+(b-a)*u+(c-a)*v : d+(c-d)*(1-u)+(b-d)*(1-v); };
  (function(){ var R=G+1, pos=new Float32Array(R*R*3), col=new Float32Array(R*R*3), idx=[], cc=new THREE.Color();
    for(var yy=0;yy<R;yy++) for(var xx=0;xx<R;xx++){ var o=yy*R+xx, x=W.box[0]+xx*cw, y=W.box[1]+yy*ch2, h=gh[o];
      pos[o*3]=x-W.ox; pos[o*3+1]=h-W.z0; pos[o*3+2]=-(y-W.oy);
      var sl=Math.hypot((gh[yy*R+Math.min(R-1,xx+1)]-gh[yy*R+Math.max(0,xx-1)])/(2*cw),(gh[Math.min(R-1,yy+1)*R+xx]-gh[Math.max(0,yy-1)*R+xx])/(2*ch2));
      hillTerrColor(h, sl, fbm(xx/R,yy/R,3,9,4), cc); col[o*3]=cc.r; col[o*3+1]=cc.g; col[o*3+2]=cc.b; }
    for(yy=0;yy<G;yy++) for(xx=0;xx<G;xx++){ var a=yy*R+xx, b=a+1, c=a+R, d=c+1; idx.push(a,b,c, b,d,c); }
    var g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.BufferAttribute(pos,3)); g.setAttribute("color",new THREE.BufferAttribute(col,3)); g.setIndex(idx); g.computeVertexNormals();
    var mat=lite?new THREE.MeshLambertMaterial({vertexColors:true}):stripSurfMat(HILL_GLSL_TERR,{vertexColors:true});
    if(!lite) mat.customProgramCacheKey=function(){ return "hill_terr"; };
    var tm=new THREE.Mesh(g, mat); tm.receiveShadow=!lite; S5.add(tm); W.terr=tm; if(lite||ultra) hillTiles(W, S5, tm, G); })();
  /* road, centre lines, gravel verges sloping out to the terrain */
  M.asph=stripMapMat(new THREE.MeshStandardMaterial({map:hillAsphaltTex(), roughness:0.86, metalness:0, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2}), ROAD_GLSL_ASPH, "hill_asph");
  M.verge=stripMapMat(new THREE.MeshStandardMaterial({vertexColors:true, roughness:1, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1}), ROAD_GLSL_GRAV, "hill_verge");
  (function(){ var step=lite?2:1, n=Math.floor((N-1)/step)+1, pos=new Float32Array(n*6), nor=new Float32Array(n*6), uv=new Float32Array(n*4), idx=[];
    for(q=0;q<n;q++){ var ii=Math.min(N-1,q*step); hillPt(W, ii, hw, 0.04, _hA); hillPt(W, ii, -hw, 0.04, _hB);
      pos.set([_hA.x,_hA.y,_hA.z,_hB.x,_hB.y,_hB.z], q*6); nor[q*6+1]=1; nor[q*6+4]=1; var vv=ii*ds/16; uv.set([0,vv,1,vv], q*4);
      if(q<n-1){ var a=q*2; idx.push(a,a+1,a+2, a+1,a+3,a+2); } }
    var g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.BufferAttribute(pos,3)); g.setAttribute("normal",new THREE.BufferAttribute(nor,3)); g.setAttribute("uv",new THREE.BufferAttribute(uv,2)); g.setIndex(idx); g.computeBoundingSphere();
    var rd=new THREE.Mesh(g, M.asph); rd.receiveShadow=!lite; S5.add(rd); if(lite||ultra) hillSplit(W, S5, rd, "road"); })();
  (function(){ var step=lite?4:2, gcol=sc(0x8a7f70), cc=new THREE.Color(), pos=[], col=[], idx=[], base=0;
    [-1,1].forEach(function(sd){ for(var ii=0;ii<N;ii+=step){ var dr=W.drop[ii], isDrop=dr&&Math.sign(dr)===sd, Lv=isDrop?(Math.abs(dr)===2?9:6):Math.min(48,Math.max(cw,ch2)*0.95);
        var offs=lite?[hw, hw+0.9, hw+3.2, hw+Lv]:[hw, hw+0.9, hw+2.6, hw+4.4, hw+Lv], nr=offs.length;
        for(var r=0;r<nr;r++){ hillPt(W, ii, sd*offs[r], 0, _hA); var cx=_hA.x+W.ox, cy=-_hA.z+W.oy, roadY=T.z[ii]-W.z0, y;
          if(r<2) y=roadY+0.03-r*0.06; else if(r===nr-1) y=W.gH(cx,cy)-W.z0+0.05; else y=lerp(roadY-0.2, W.gH(cx,cy)-W.z0, r===2?0.04:0.1);
          pos.push(_hA.x,y,_hA.z);
          if(r<nr-2||(lite&&r<2)) cc.copy(gcol).multiplyScalar(0.9+0.2*rng(ii*7+r)); else hillTerrColor(T.z[ii], 0.3, rng(ii), cc);
          col.push(cc.r,cc.g,cc.b); }
        if(ii+step<N){ var a=base, b=base+nr; for(var r2=0;r2<nr-1;r2++){ if(sd>0) idx.push(a+r2,b+r2,a+r2+1, a+r2+1,b+r2,b+r2+1); else idx.push(a+r2,a+r2+1,b+r2, a+r2+1,b+r2+1,b+r2); } }
        base+=nr; }
      base=pos.length/3; });
    var g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); g.setAttribute("color",new THREE.Float32BufferAttribute(col,3)); g.setIndex(idx); g.computeVertexNormals();
    var vm=new THREE.Mesh(g, M.verge); vm.receiveShadow=!lite; S5.add(vm); if(lite||ultra) hillSplit(W, S5, vm, "verge"); })();
  var B=new StripBatch(), STEEL=0xa7acb1, POST=0x6e7276;
  M.solid=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.86}); M.metal=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.38, metalness:0.7});
  /* guardrails: posts and a W-beam on the outside of the railed drops */
  (function(){ var pos=[], idx=[], nrm=[], v=0;
    T.corners.forEach(function(cn){ if(!cn.rail) return; var sd=-cn.side, a=Math.max(0,cn.i0-10), b=Math.min(N-1,cn.i1+10), d=sd*(hw+1.1);
      for(var ii=a;ii<=b;ii++){ hillPt(W, ii, d, 0.42, _hA); pos.push(_hA.x,_hA.y,_hA.z, _hA.x,_hA.y+0.36,_hA.z); var hh=T.h[ii]; nrm.push(Math.sin(hh)*sd,0,Math.cos(hh)*sd, Math.sin(hh)*sd,0,Math.cos(hh)*sd);
        if(ii<b) idx.push(v,v+2,v+1, v+1,v+2,v+3); v+=2;
        if((ii-a)%(lite?4:2)===0){ hillPt(W, ii, d+sd*0.12, 0, _hB); B.add("metal","box",[_hB.x,_hB.y+0.36,_hB.z],[0.12,0.78,0.12],POST,[0,hh,0]); } } });
    if(!pos.length) return;
    var g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); g.setAttribute("normal",new THREE.Float32BufferAttribute(nrm,3)); g.setIndex(idx);
    var rm=new THREE.Mesh(g, new THREE.MeshStandardMaterial({color:sc(STEEL), roughness:0.35, metalness:0.75, side:THREE.DoubleSide})); rm.castShadow=!lite; S5.add(rm); if(lite||ultra) hillSplit(W, S5, rm, "rail"); })();
  /* start: a timing gantry over the road; summit: the summit house, a car park, the finish banner */
  (function(){ var h0=T.h[0];
    /* the start gantry and the timing hut, and the summit house below, go in batches of their own ("…S", "…H"): on Full / Ultra the
       Blender models (hillModels) take their place when they arrive, and these stay only if the files can't be had */
    [-1,1].forEach(function(sd){ hillPt(W, 2, sd*(hw+1.4), 0, _hA); B.add("metalS","box",[_hA.x,_hA.y+2.8,_hA.z],[0.3,5.6,0.3],0x2b2d30); });
    hillPt(W, 2, 0, 5.4, _hA); B.add("solidS","box",[_hA.x,_hA.y,_hA.z],[0.5,1.1,HILL_RW+3.2],0xe8e4da,[0,h0,0]);
    var st=stripLabel("START", HILL_RW+2.6, 0.9); hillPt(W, 1.85, 0, 5.4, _hA); st.position.copy(_hA); st.rotation.y=h0-PI/2; S5.add(st); W.startSign=st;
    hillPt(W, -6, -(hw+6), 0, _hA); B.box("solidS", _hA.x,_hA.y+1.3,_hA.z, 3.2,2.6,2.4, 0xc9c1ad, h0); B.add("solidS","prism",[_hA.x,_hA.y+2.6,_hA.z],[3.6,1.0,2.8],0x5a3a2a,[0,h0,0]);
    hillPt(W, 2, 0, 0, _hA); W.startAt={p:_hA.clone(), h:h0};
    var iF=N-1, hF=T.h[iF], i9=Math.max(0,N-1-Math.round(14/ds));
    [-1,1].forEach(function(sd){ hillPt(W, i9, sd*(hw+1.4), 0, _hA); B.add("metal","box",[_hA.x,_hA.y+2.8,_hA.z],[0.3,5.6,0.3],0x2b2d30); });
    var fin=stripLabel("SUMMIT · FINISH", HILL_RW+2.6, 0.9); hillPt(W, i9-0.15, 0, 5.4, _hA); fin.position.copy(_hA); fin.rotation.y=hillHd(T,i9)-PI/2; S5.add(fin);
    hillPt(W, i9, 0, 5.4, _hA); B.add("solid","box",[_hA.x,_hA.y,_hA.z],[0.5,1.1,HILL_RW+3.2],0x1a1a1c,[0,hillHd(T,i9),0]);
    /* the summit house beyond the line, a stone base and a long low roof */
    hillPt(W, iF, 34, 0, _hA); var by=T.z[iF]-W.z0, hx=_hA.x+Math.cos(hF)*28, hz=_hA.z-Math.sin(hF)*28;
    B.box("solidH", hx, by+2.2, hz, 30, 4.4, 14, 0x9a8f80, hF); B.box("solidH", hx, by+4.75, hz, 31.5, 0.7, 15.5, 0x4c4f53, hF);
    for(var w=-12;w<=12;w+=3){ B.box("solidH", hx+Math.cos(hF)*w+Math.sin(hF)*7.02, by+2.6, hz-Math.sin(hF)*w+Math.cos(hF)*7.02, 1.8, 1.4, 0.06, 0x2a3a48, hF); }
    W.houseAt={p:new THREE.Vector3(hx, by, hz), h:hF};
    hillPt(W, iF, 14, 0, _hA); B.box("solid", _hA.x+Math.cos(hF)*12, by-0.15, _hA.z-Math.sin(hF)*12, 56, 0.4, 34, 0x6b675f, hF);   // the car park
    W.summit=new THREE.Vector3(hx, by+3, hz); })();
  var keep=STRIP.scene; STRIP.scene=S5; B.build("solid", M.solid, !lite); B.build("metal", M.metal, !lite);
  W.fb={start:[B.build("solidS", M.solid, !lite), B.build("metalS", M.metal, !lite)], summit:[B.build("solidH", M.solid, !lite)]}; STRIP.scene=keep;
  /* sparse pines below the treeline, boulders above it */
  (function(){ var nT=lite?300:ultra?2400:1600, nR=lite?140:ultra?900:520, tp=[], rp=[], s, tries=0;
    while((tp.length<nT||rp.length<nR) && tries++<(nT+nR)*12){ s=tries*1.37;
      var ii=Math.floor(rng(s)*N), lat=(rng(s+1)<0.5?-1:1)*(hw+9+Math.pow(rng(s+2),2.2)*340); hillPt(W, ii, lat, 0, _hA);
      var cx=_hA.x+W.ox, cy=-_hA.z+W.oy, nr=W.near(cx,cy,hw+7); if(nr) continue;
      var gy=W.gH(cx,cy), alt=gy, tl=SIM_TREE+(rng(s+3)-0.5)*160;
      if(alt<tl){ if(tp.length<nT && !(W.drop[ii]&&Math.abs(lat)<60&&rng(s+5)<0.7)) tp.push([_hA.x,gy-W.z0,_hA.z,0.7+rng(s+4)*0.7,alt]); }
      else if(rp.length<nR){ var bp=T.sec[ii]===6?1.6:1; if(rng(s+6)<0.55*bp||Math.abs(lat)<60) rp.push([_hA.x,gy-W.z0,_hA.z,(0.5+Math.pow(rng(s+7),2.5)*3.2)*bp]); } }
    var mm=new THREE.Matrix4(), cc=new THREE.Color(), qq=new THREE.Quaternion(), e=new THREE.Euler();
    if(tp.length){ var fg=new THREE.ConeGeometry(2.1,6.5,lite?5:7); fg.translate(0,6.2,0); var f2=new THREE.ConeGeometry(1.5,4.6,lite?5:7); f2.translate(0,9.2,0);
      var tg=new THREE.CylinderGeometry(0.22,0.3,3.6,5); tg.translate(0,1.8,0);
      var foliage=new THREE.InstancedMesh(lite?fg:mergeHillGeos([fg,f2]), new THREE.MeshStandardMaterial({roughness:0.95}), tp.length), trunk=new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({color:sc(0x4a3626), roughness:1}), tp.length);
      tp.forEach(function(p,j){ var sz=p[3]*(1-0.35*smoothstep(3300,3560,p[4])); mm.compose(_hA.set(p[0],p[1]-0.3,p[2]), qq.setFromEuler(e.set(0,rng(j)*6,0)), _hB.set(sz,sz*(0.9+rng(j+9)*0.35),sz));
        foliage.setMatrixAt(j,mm); trunk.setMatrixAt(j,mm); cc.setHSL(0.30+rng(j+2)*0.06,0.38,0.12+rng(j+3)*0.06).convertSRGBToLinear(); foliage.setColorAt(j,cc); });
      foliage.castShadow=trunk.castShadow=!lite; instCull(foliage); instCull(trunk); S5.add(foliage); S5.add(trunk); W.trees=tp.length; }
    if(rp.length){ var rg=new THREE.DodecahedronGeometry(1,0), rocks=new THREE.InstancedMesh(rg, new THREE.MeshStandardMaterial({roughness:0.92}), rp.length);
      rp.forEach(function(p,j){ mm.compose(_hA.set(p[0],p[1]+p[3]*0.25,p[2]), qq.setFromEuler(e.set(rng(j)*3,rng(j+1)*3,rng(j+2)*3)), _hB.set(p[3]*(0.8+rng(j+3)*0.6),p[3]*(0.55+rng(j+4)*0.4),p[3]*(0.8+rng(j+5)*0.5)));
        rocks.setMatrixAt(j,mm); cc.setHSL(0.07,0.08+rng(j+6)*0.06,0.3+rng(j+7)*0.12).convertSRGBToLinear(); rocks.setColorAt(j,cc); });
      rocks.castShadow=!lite; instCull(rocks); S5.add(rocks); W.rocks=rp.length; }
    W.inst={foliage:foliage, trunk:trunk, rocks:rocks};
    if(lite||ultra) hillTreeCells(W, S5, tp, rp, foliage, trunk, rocks, ultra); })();
  /* the Front Range on the horizon: a ring of peaks, snow on the tops */
  (function(){ var seg=lite?96:160, R0=W.span*0.62+2500, pos=[], col=[], idx=[], cx=0, cz=0, c1=sc(0x5a5e5c), c2=sc(0x8a8e92), c3=sc(0xe8ecf0);
    for(var s2=0;s2<=seg;s2++){ var a=s2/seg*TAU, hgt=900+500*Math.pow(0.5+0.5*Math.sin(a*3.0+1.1),2)+300*Math.sin(a*11.0+1.4)*Math.sin(a*5.0)+140*Math.sin(a*23.0), snow=hgt>1300;
      pos.push(cx+Math.cos(a)*(R0-1500),-500,cz+Math.sin(a)*(R0-1500), cx+Math.cos(a)*R0,hgt,cz+Math.sin(a)*R0, cx+Math.cos(a)*(R0+900),hgt*0.5,cz+Math.sin(a)*(R0+900));
      col.push(c1.r,c1.g,c1.b, (snow?c3:c2).r,(snow?c3:c2).g,(snow?c3:c2).b, c2.r,c2.g,c2.b); }
    for(s2=0;s2<seg;s2++){ var a0=s2*3, b0=(s2+1)*3; idx.push(a0,b0,a0+1, b0,b0+1,a0+1, a0+1,b0+1,a0+2, b0+1,b0+2,a0+2); }
    var g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); g.setAttribute("color",new THREE.Float32BufferAttribute(col,3)); g.setIndex(idx); g.computeVertexNormals();
    var hm=new THREE.Mesh(g, new THREE.MeshLambertMaterial({vertexColors:true, side:THREE.DoubleSide})); hm.frustumCulled=false; S5.add(hm); })();
  /* trackside camera spots: inside of the named corners and every few others, up on the bank */
  T.corners.forEach(function(cn, ci){ if(!(cn.name || ci%5===2)) return; var d=cn.side*(hw+16+(ci%3)*6); hillPt(W, cn.iA, d, 0, _hA); var gy=W.gH(_hA.x+W.ox, -_hA.z+W.oy)-W.z0;
    W.stations.push({i:cn.iA, d:d, y:Math.max(gy, T.z[cn.iA]-W.z0)+2.5+(ci%2)*2}); });
  W.fx=new StripFx(lite?120:320, "smoke", stripPuffTex()); S5.add(W.fx.mesh);
  if(!lite) hillModels(W);
  return W;
}
/* ===========================================================================
   FULL / ULTRA: THE BLENDER MODELS
   Five props modelled in Blender (tools/blender/hill-props.py, files in models/hill-*.glb, flat colours, no textures):
   the summit visitor centre and the start gantry with its timing hut replace their code boxes when they arrive; a
   marshal post goes on the inside of every named corner; the granite boulder and the two-level fir are geometry only,
   swapped into the instanced rocks and trees (Full and Ultra's far trees take FirLo, Ultra's near trees FirHi), keeping
   their own materials, colours, placements and culling spheres. Lite never loads them; the code shapes stay as they are.
   ==========================================================================*/
function hillModels(W){
  if(typeof modelGet!=="function") return;
  if(!THREE.GLTFLoader){ if(window.__pewPost) window.__pewPost(function(ok){ if(ok && THREE.GLTFLoader && HILL.W===W) hillModels(W); }); return; }
  var live=function(){ return HILL.W===W && W.tier!=="lite"; };
  var place=function(key, at, fb){ if(!at) return; modelGet(key, function(src){ if(!live()) return;
      var o=src.clone(); o.position.copy(at.p); o.rotation.y=at.h; o.name="model:"+key; W.scene.add(o);
      if(fb) fb.forEach(function(m){ if(m){ W.scene.remove(m); m.geometry.dispose(); } }); }); };
  place("hillSummit", W.houseAt, W.fb.summit);
  place("hillStart", W.startAt, W.fb.start);
  /* marshal posts: a canopy, bales and a flag on the inside of each named corner, the bales toward the road */
  modelGet("hillMarshal", function(src){ if(!live()) return; var T=W.T, hw=HILL_RW/2;
    T.corners.forEach(function(cn){ if(!cn.name || cn.i1>=T.N-8) return; var ii=Math.round((cn.i0+cn.iA)/2), d=cn.side*(hw+6.2); hillPt(W, ii, d, 0, _hA);
      var o=src.clone(); o.position.set(_hA.x, W.gH(_hA.x+W.ox, -_hA.z+W.oy)-W.z0, _hA.z); o.rotation.y=hillHd(T, ii)+(cn.side>0?0:PI); o.name="model:hillMarshal"; W.scene.add(o); }); });
  /* trees and rocks: new shapes for the instanced meshes already placed (Full: one mesh each; Ultra: the ground cells) */
  var geoOf=function(src, name){ var g=null; src.traverse(function(o){ if(o.isMesh && o.name===name) g=o.geometry; }); return g; };
  var swap=function(m, g){ if(!m || !g) return; var sph=m.geometry.boundingSphere; m.geometry=hillCellGeo(g, sph); };
  var cells=W.lod?W.lod.cells:null, I=W.inst||{};
  modelGet("hillRock", function(src){ if(!live()) return; var g=geoOf(src, "Rock"); if(!g) return;
    if(cells) cells.forEach(function(c){ if(c.kind==="rock") swap(c.lo, g); }); else swap(I.rocks, g); });
  modelGet("hillFir", function(src){ if(!live()) return; var fl=geoOf(src, "FirLo"), tl=geoOf(src, "TrunkLo"), fh=geoOf(src, "FirHi"), th=geoOf(src, "TrunkHi"); if(!fl||!tl) return;
    if(cells) cells.forEach(function(c){ if(c.kind!=="tree") return; swap(c.lo, fl); swap(c.loT, tl); if(c.hi){ swap(c.hi, fh||fl); swap(c.hiT, th||tl); } });
    else { swap(I.foliage, fl); swap(I.trunk, tl); } });
}
var SIM_TREE=3560;
function mergeHillGeos(list){ var pos=[], nor=[], idx=[], off=0; list.forEach(function(g){ var gg=g.index?g:g; var P=gg.attributes.position, Nn=gg.attributes.normal; for(var j=0;j<P.count;j++){ pos.push(P.getX(j),P.getY(j),P.getZ(j)); nor.push(Nn.getX(j),Nn.getY(j),Nn.getZ(j)); }
  if(gg.index){ var I=gg.index.array; for(j=0;j<I.length;j++) idx.push(I[j]+off); } else for(j=0;j<P.count;j++) idx.push(j+off); off+=P.count; });
  var g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); g.setAttribute("normal",new THREE.Float32BufferAttribute(nor,3)); g.setIndex(idx); return g; }
/* the car: the road test's door car per chassis in the run's paint, with the class's aero bolted on */
function hillCarMesh(ch, color, aero){
  var sp=ROAD_SHAPE[ch]||ROAD_SHAPE.coupe, car=stripCar("street", color, sp[3]), U=car.userData, me=U.meta, B=U.bodyGroup;
  B.scale.set(sp[0], sp[1], sp[2]);
  for(var i=0;i<U.carriers.length;i++){ var C=U.carriers[i]; if(!C.userData.rear) C.position.x=me.xr+(me.xf-me.xr)*sp[0]; C.position.z*=sp[2]; }
  var wing=aero==="unl"?3:aero==="full"?2:aero==="wing"?1:sp[4]?1:0;
  if(wing){ var wm=new THREE.MeshStandardMaterial({color:sc(wing>1?0x15171b:0xf0ede4), roughness:0.5, metalness:0.2}), g=new THREE.Group(), span=wing>2?1.95:wing>1?1.7:1.45, ht=wing>2?1.42:wing>1?1.25:1.13;
    var plane=new THREE.Mesh(new THREE.BoxGeometry(wing>2?0.62:0.36,0.045,span), wm); plane.position.set(-2.16,ht,0); plane.rotation.z=0.14; g.add(plane);
    if(wing>2){ var p2=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.04,span), wm); p2.position.set(-2.0,ht+0.12,0); p2.rotation.z=0.4; g.add(p2);
      for(var e2=-1;e2<=1;e2+=2){ var ep=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.5,0.03), wm); ep.position.set(-2.1,ht-0.05,e2*span/2); g.add(ep); } }
    for(var s=-1;s<=1;s+=2){ var st=new THREE.Mesh(new THREE.BoxGeometry(0.1,ht-0.88,0.03), wm); st.position.set(-2.08,(ht+0.88)/2,s*0.5); g.add(st); }
    if(wing>1){ var spl=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.03,1.9), wm); spl.position.set(2.22,0.2,0); g.add(spl);
      for(var d2=-1;d2<=1;d2+=2){ var dv=new THREE.Mesh(new THREE.BoxGeometry(0.32,0.02,0.22), wm); dv.position.set(2.0,0.48,d2*0.86); dv.rotation.x=d2*0.3; g.add(dv); } }
    g.children.forEach(function(m){ m.castShadow=true; }); U.bodyGroup.children[0].add(g); }
  car.traverse(function(o){ if(o.isMesh){ o.castShadow=true; } });
  return car;
}
function hillDirect(o, dt, W, car){
  var T=W.T, fi=(o.s||0)/T.ds, h=hillHd(T, fi), v=Math.max(0,+o.v||0), mode=o.cam||"auto", s=HILL.shot;
  var fx=Math.cos(h), fz=-Math.sin(h), cp=car.position, fov=50;
  var best=-1, bd=1e9; for(var q=0;q<W.stations.length;q++){ var st=W.stations[q], m=(st.i-fi)*T.ds; if(m>-40 && m<130 && Math.abs(m-25)<bd){ bd=Math.abs(m-25); best=q; } }
  if(mode==="chase"||mode==="heli"||mode==="onboard") s=mode;
  else { if(o.pre||o.done) s=o.done?"heli":"chase";
    else if(s==="side" && (best!==HILL.st || HILL.shotT>6)) s="chase";
    else if(s==="chase" && HILL.shotT>8) s=best>=0?"side":"heli";
    else if(s==="heli" && HILL.shotT>7) s="chase";
    else if(s==="side" && best<0) s="chase";
    else if(!s) s="chase";
    if(o.off && s!=="side") s="heli"; }
  if(s==="side" && best!==HILL.st){ HILL.st=best; HILL.shot=null; }
  sceneCut(HILL, s); HILL.shotT+=dt;
  if(s==="chase"){ var gr=Math.atan(T.grade[Math.min(T.N-1,Math.floor(fi))]||0); _hA.set(cp.x-fx*7.2, cp.y+2.4-7.2*Math.tan(gr)*0.6, cp.z-fz*7.2); _hB.set(cp.x+fx*6, cp.y+0.9+6*Math.tan(gr), cp.z+fz*6);
    if(HILL.snap){ HILL.chP.copy(_hA); HILL.chT.copy(_hB); } else { HILL.chP.lerp(_hA,1-Math.exp(-dt*6)); HILL.chT.lerp(_hB,1-Math.exp(-dt*11)); }
    HILL.camPos.copy(HILL.chP); HILL.camTgt.copy(HILL.chT); fov=56+Math.min(10,v*0.12); }
  else if(s==="heli"){ HILL.heliA+=dt*0.12; var r=62, a=h+2.4+0.5*Math.sin(HILL.heliA); _hA.set(cp.x+Math.cos(a)*r, cp.y+48, cp.z-Math.sin(a)*r); _hB.set(cp.x+fx*8, cp.y, cp.z+fz*8);
    if(HILL.snap){ HILL.chP.copy(_hA); HILL.chT.copy(_hB); } else { HILL.chP.lerp(_hA,1-Math.exp(-dt*1.6)); HILL.chT.lerp(_hB,1-Math.exp(-dt*5)); }
    HILL.camPos.copy(HILL.chP); HILL.camTgt.copy(HILL.chT); fov=40; }
  else if(s==="onboard"){ HILL.camPos.set(cp.x-fx*0.15, cp.y+1.18, cp.z-fz*0.15); HILL.camTgt.set(cp.x+fx*20, cp.y+0.9+20*(T.grade[Math.min(T.N-1,Math.floor(fi))]||0), cp.z+fz*20); fov=68; }
  else { var st2=W.stations[HILL.st]; hillPt(W, st2.i, st2.d, 0, HILL.camPos); HILL.camPos.y=st2.y; _hC.set(cp.x, cp.y+0.7, cp.z); if(HILL.snap) HILL.camTgt.copy(_hC); else HILL.camTgt.lerp(_hC, 1-Math.exp(-dt*10));
    var dist=HILL.camPos.distanceTo(_hC); fov=clamp(2*Math.atan(6/Math.max(1,dist))*180/PI, 10, 55); }
  if(HILL.snap){ HILL.fov=fov; HILL.snap=false; } else HILL.fov+=(fov-HILL.fov)*(1-Math.exp(-dt*6));
  var cam=HILL.cam; cam.position.copy(HILL.camPos); cam.lookAt(HILL.camTgt); cam.fov=HILL.fov; cam.updateProjectionMatrix(); bandLens(cam);
}
function hillRender(){
  var W=HILL.W, cam=HILL.cam; if(!W||!cam) return;
  W.fog.color.copy(W.horLin).convertLinearToSRGB();
  W.sky.position.copy(cam.position); if(W.fx) W.fx.mat.uniforms.uFog.value.copy(W.horLin);
  var ex=renderer.toneMappingExposure; renderer.toneMappingExposure=0.95;
  if(W.lod) hillLodUpdate(W, cam);
  var inf=renderer.info, ar=inf.autoReset; inf.autoReset=false; inf.reset();
  renderer.render(W.scene, cam);
  HILL.stats={calls:inf.render.calls, tris:inf.render.triangles, tier:GFX, shot:HILL.shot, trees:W.trees||0, rocks:W.rocks||0, grid:W.G}; inf.autoReset=ar;
  renderer.toneMappingExposure=ex;
}
function hillUpdate(o, dt){
  var T=o.course; if(!T) return;
  if(!HILL.W || HILL.W.T!==T || HILL.W.tier!==GFX){ if(HILL.car && HILL.car.parent) HILL.car.parent.remove(HILL.car); HILL.W=buildHillWorld(T); HILL.carKey=""; HILL.snap=true; HILL.shot=null; }
  var W=HILL.W, key=(o.ch||"coupe")+"|"+(o.color||0)+"|"+(o.aero||"none");
  if(HILL.carKey!==key){ if(HILL.car && HILL.car.parent) HILL.car.parent.remove(HILL.car); if(!HILL.cars[key]) HILL.cars[key]=hillCarMesh(o.ch||"coupe", o.color||0xa32a26, o.aero); HILL.car=HILL.cars[key]; W.scene.add(HILL.car); HILL.carKey=key; }
  var car=HILL.car, fi=clamp((o.s||0)/T.ds,0,T.N-1.001), h=hillHd(T, fi), v=Math.max(0,+o.v||0), gi=Math.floor(fi);
  hillPt(W, fi, +o.d||0, 0, car.position); car.rotation.set(0, h, Math.atan(T.grade[gi]||0), "YXZ");
  if(o.dnf==="edge"){ car.position.y-=Math.min(30, (HILL.fall=(HILL.fall||0)+dt*9)*HILL.fall*0.5); car.rotation.x+=HILL.fall*0.6; } else HILL.fall=0;
  var k=T.k[gi]||0, U=car.userData, stT=Math.atan(2.6*k)*1.15*(o.off?0.3:1);
  HILL.steer+=(stT-HILL.steer)*Math.min(1,dt*10); for(var i=0;i<U.carriers.length;i++){ var Cw=U.carriers[i]; if(!Cw.userData.rear) Cw.rotation.y=HILL.steer; }
  stripCarAnim(car, {v:v, acc:(+o.thr||0)*3-(+o.brk||0)*8, brake:(+o.brk||0)>0.05, night:false, lift:0}, dt, true);
  var su=o.su||null, rk=su?su.rk:1, rollT=clamp(-k*v*v/9.81*0.035*rk,-0.08*rk,0.08*rk); HILL.roll+=(rollT-HILL.roll)*Math.min(1,dt*6); U.bodyGroup.rotation.x+=HILL.roll;
  stripSetupLean(car, su, k*v*v/9.81, ((+o.thr||0)*0.3-(+o.brk||0)*0.8), HILL.sx||(HILL.sx={dv:0,lf:0,lr:0}), dt);
  /* dust: off in the gravel, a moment, the verge at the limit */
  if(W.fx){ var dust=o.off?0.9:o.ev==="moment"?0.6:(+o.lat||0)>0.97&&v>15?0.15:0;
    if(dust>0 && Math.random()<dust*dt*40*(GFX==="lite"?0.5:1)){ hillPt(W, fi-1.4, (+o.d||0)+(Math.random()-0.5)*1.8, 0.3, _hA); W.fx.emit(_hA.x,_hA.y,_hA.z,(Math.random()-0.5)*1.2,0.6,(Math.random()-0.5)*1.2,2.2,0.8,4.2,0.72,0.66,0.56,0.32,{drag:0.5,buoy:0.1}); }
    W.fx.step(dt, _hW); }
  hillDirect(o, dt, W, car);
  /* thin air: the zenith deepens and the haze lifts with the camera's altitude */
  var alt=clamp((HILL.camPos.y+W.z0-2862)/1440,0,1.1); W.sky.material.uniforms.uAlt.value=alt; W.horLin.setRGB(lerp(0.6,0.52,alt),lerp(0.68,0.63,alt),lerp(0.76,0.78,alt)); W.fog.near=lerp(500,1100,alt); W.fog.far=lerp(6000,9000,alt); if(W.tier==="ultra"){ W.fog.near*=1.6; W.fog.far*=1.3; }   /* Ultra: the long view */
  var c=_hA.copy(car.position); W.sun.position.copy(c).addScaledVector(W.sunDir, 200); W.sun.target.position.copy(c); W.sun.target.updateMatrixWorld();
}
/* ===========================================================================
   CLOUDSPLITTER PEAK, LITE AND ULTRA: CULLING AND LOD
   The course is 20 km of road on an 11 × 7 km mountain, and Full draws it as a
   handful of whole-map meshes (one terrain grid, one road ribbon, one verge
   strip, one instanced forest), so every frame draws and shadows all of it.
   On Lite and Ultra the same geometry is cut into pieces the camera can cull:
   terrain tiles, road / verge / rail runs along the course, trees and rocks in
   ground cells. Lite also drops what is too far to see (road runs past
   1.6 km, trees past 1.1 km, rocks past 0.9 km, all inside the haze). Ultra
   keeps everything, adds a near-tree LOD (three-tier fir with a trunk inside
   450 m, the plain two-cone fir beyond), and only the cells in the sun's
   shadow box cast shadows. Full never calls any of this.
   ==========================================================================*/
var HILL_LOD={ lite:{chunks:20, tile:37, cell:1500, road:1600, tree:1100, rock:900}, ultra:{chunks:40, tile:35, cell:850, road:0, tree:0, rock:0, near:450} };
var _hlA=new THREE.Vector3();
function hillLodCfg(){ return GFX==="ultra"?HILL_LOD.ultra:HILL_LOD.lite; }
/* a bounding sphere round the vertices an index list uses */
function hillIdxSphere(P, idx){
  var x0=1e9,y0=1e9,z0=1e9,x1=-1e9,y1=-1e9,z1=-1e9, i, v;
  for(i=0;i<idx.length;i++){ v=idx[i]*3; var x=P[v], y=P[v+1], z=P[v+2]; if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; if(z<z0)z0=z; if(z>z1)z1=z; }
  var c=new THREE.Vector3((x0+x1)/2,(y0+y1)/2,(z0+z1)/2), r=0;
  for(i=0;i<idx.length;i++){ v=idx[i]*3; var dx=P[v]-c.x, dy=P[v+1]-c.y, dz=P[v+2]-c.z, d=dx*dx+dy*dy+dz*dz; if(d>r) r=d; }
  return new THREE.Sphere(c, Math.sqrt(r));
}
function hillPiece(S, src, idx, kind, W){
  var g=src.geometry, gg=new THREE.BufferGeometry();
  for(var k in g.attributes) gg.setAttribute(k, g.attributes[k]);
  gg.setIndex(new THREE.BufferAttribute(idx, 1)); gg.boundingSphere=hillIdxSphere(g.attributes.position.array, idx);
  var m=new THREE.Mesh(gg, src.material); m.castShadow=src.castShadow; m.receiveShadow=src.receiveShadow; m.renderOrder=src.renderOrder;
  S.add(m); W.lod.pieces.push({m:m, kind:kind}); return m;
}
function hillLodInit(W){ if(!W.lod) W.lod={pieces:[], cells:[], cfg:hillLodCfg()}; return W.lod; }
/* road, verges, rails: the triangles run along the course, so consecutive index runs are runs of road */
function hillSplit(W, S, mesh, kind){
  var L=hillLodInit(W), g=mesh.geometry; if(!g.index) return;
  var I=g.index.array, n=I.length/3, per=Math.max(64, Math.ceil(n/L.cfg.chunks))*3;
  for(var a=0;a<I.length;a+=per) hillPiece(S, mesh, I.slice(a, Math.min(I.length, a+per)), kind, W);
  S.remove(mesh);
}
/* the terrain grid in square tiles */
function hillTiles(W, S, tm, G){
  var L=hillLodInit(W), R=G+1, t=L.cfg.tile, Arr=(R*R>65535)?Uint32Array:Uint16Array;
  for(var ty=0;ty<G;ty+=t) for(var tx=0;tx<G;tx+=t){ var ny=Math.min(t,G-ty), nx=Math.min(t,G-tx), idx=new Arr(nx*ny*6), o=0;
    for(var yy=ty;yy<ty+ny;yy++) for(var xx=tx;xx<tx+nx;xx++){ var a=yy*R+xx, b=a+1, c=a+R, d=c+1; idx[o++]=a; idx[o++]=b; idx[o++]=c; idx[o++]=b; idx[o++]=d; idx[o++]=c; }
    hillPiece(S, tm, idx, "terr", W); }
  S.remove(tm); W.terr=null;
}
/* trees and rocks into ground cells; Ultra: a detailed near LOD */
function hillUltraFir(){
  var parts=[], c1=new THREE.ConeGeometry(2.3,5.0,10); c1.translate(0,5.2,0); parts.push(c1);
  var c2=new THREE.ConeGeometry(1.75,4.2,10); c2.translate(0,7.6,0); parts.push(c2);
  var c3=new THREE.ConeGeometry(1.15,3.4,9); c3.translate(0,10.0,0); parts.push(c3);
  parts.forEach(function(g, j){ var P=g.attributes.position; for(var q=0;q<P.count;q++){ var x=P.getX(q), z=P.getZ(q), y=P.getY(q), r=Math.hypot(x,z);   /* ragged, drooping bough tips */
    if(r>0.3){ var a=Math.atan2(z,x), k=0.86+0.22*Math.abs(Math.sin(a*5+j*1.7)); P.setXYZ(q, x*k, y-0.35*(k-0.86)*3, z*k); } } g.computeVertexNormals(); });
  return mergeHillGeos(parts);
}
function hillCellGeo(base, sph){ var g=new THREE.BufferGeometry(); for(var k in base.attributes) g.setAttribute(k, base.attributes[k]); if(base.index) g.setIndex(base.index); g.boundingSphere=sph; return g; }
function hillTreeCells(W, S, tp, rp, foliage, trunk, rocks, ultra){
  var L=hillLodInit(W), cs=L.cfg.cell, bx=W.box, x0=bx[0]-W.ox, z1=-(bx[1]-W.oy), nx=Math.ceil((bx[2]-bx[0])/cs), ny=Math.ceil((bx[3]-bx[1])/cs);
  var hiF=ultra?hillUltraFir():null, hiT=null; if(ultra){ hiT=new THREE.CylinderGeometry(0.2,0.32,4.2,6); hiT.translate(0,2.1,0); }
  var bin=function(list){ var B={}; list.forEach(function(p, j){ var cx=Math.floor((p[0]-x0)/cs), cz=Math.floor((z1-p[2])/cs); cx=clamp(cx,0,nx-1); cz=clamp(cz,0,ny-1); var k=cz*nx+cx; (B[k]||(B[k]=[])).push(j); }); return B; };
  var mm=new THREE.Matrix4(), cc=new THREE.Color();
  var cellMesh=function(src, base, ids, sph, cast){ var m=new THREE.InstancedMesh(hillCellGeo(base, sph), src.material, ids.length);
    ids.forEach(function(j, q){ src.getMatrixAt(j, mm); m.setMatrixAt(q, mm); if(src.instanceColor){ src.getColorAt(j, cc); m.setColorAt(q, cc); } });
    m.castShadow=cast; m.receiveShadow=src.receiveShadow; instCull(m, 0, base); S.add(m); return m; };
  var sphOf=function(list, ids, up){ var a=new THREE.Vector3(1e9,1e9,1e9), b=new THREE.Vector3(-1e9,-1e9,-1e9); ids.forEach(function(j){ var p=list[j]; a.min(_hlA.set(p[0],p[1],p[2])); b.max(_hlA); });
    b.y+=up; a.x-=8; a.z-=8; b.x+=8; b.z+=8; var c=a.clone().add(b).multiplyScalar(0.5); return new THREE.Sphere(c, c.distanceTo(b)); };
  if(foliage){ var TB=bin(tp);
    for(var k in TB){ var ids=TB[k], sph=sphOf(tp, ids, 16), cell={kind:"tree", sph:sph};
      cell.lo=cellMesh(foliage, foliage.geometry, ids, sph, foliage.castShadow); cell.loT=cellMesh(trunk, trunk.geometry, ids, sph, trunk.castShadow);
      if(ultra){ cell.hi=cellMesh(foliage, hiF, ids, sph, true); cell.hiT=cellMesh(trunk, hiT, ids, sph, true); cell.loT.visible=false; cell.lo.castShadow=cell.loT.castShadow=false; }
      L.cells.push(cell); }
    S.remove(foliage); S.remove(trunk); }
  if(rocks){ var RB=bin(rp);
    for(var k2 in RB){ var ids2=RB[k2], sph2=sphOf(rp, ids2, 6); L.cells.push({kind:"rock", sph:sph2, lo:cellMesh(rocks, rocks.geometry, ids2, sph2, rocks.castShadow)}); }
    S.remove(rocks); }
}
/* per frame, before the render: distance culling (Lite), near/far LOD (Ultra) */
function hillLodUpdate(W, cam){
  var L=W.lod; if(!L) return; var C=L.cfg, p=cam.position, i;
  for(i=0;i<L.pieces.length;i++){ var P=L.pieces[i]; if(P.kind==="terr"||!C.road) continue; var s=P.m.geometry.boundingSphere; P.m.visible=s.center.distanceTo(p)-s.radius<C.road; }
  for(i=0;i<L.cells.length;i++){ var c=L.cells[i], d=c.sph.center.distanceTo(p)-c.sph.radius;
    if(c.kind==="rock"){ if(C.rock) c.lo.visible=d<C.rock; continue; }
    if(c.hi){ var near=d<C.near; c.hi.visible=c.hiT.visible=near; c.lo.visible=!near; }
    else if(C.tree){ c.lo.visible=c.loT.visible=d<C.tree; } }
}
/* ===========================================================================
   OVAL SCENE: a banked track the view cuts to (the 3/8-mile clay, or the paved half-mile: G.surf "clay" | "asphalt" picks the surface, the dust and the painted lines) while ENGINE_VIS.setOval({on, track, cars:[...], ...}) is fed
   every frame. Units metres. The track is a stadium: two straights joined by two 180° left-hand turns, driven
   anticlockwise seen from above. Distance sp runs along the centre line from the start of the front straight
   (x = -ls/2, z = +R), lateral offset d is + toward the infield. The turns bank up toward the wall: height above the
   infield = (w/2 - d)·tan(bank). One clay shader paints the ground, the banked ribbon and the groove from world
   position alone. A concrete wall and catch fence round the top of the bank, tyres on the infield edge, a
   grandstand on the front straight with a crowd, press box, flag stand, scoreboard, light towers, pits in the infield,
   a pack of stock cars (the sim's positions; lanes found here so cars never overlap) and the dust they throw.
   ==========================================================================*/
var OVAL_WIND=new THREE.Vector3(-0.8,0,0.6), _oA=new THREE.Vector3(), _oB=new THREE.Vector3(), _oC=new THREE.Vector3(), _oD=new THREE.Vector3(),
  _oPt={x:0,z:0,psi:0,nx:0,nz:0,y:0,bank:0};
function ovalSmooth(a,b,x){ var t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); }
/* track point at sp (m along the centre line), lateral d: fills _oPt {x, z, psi (yaw), nx, nz (unit normal toward the infield), bank (rad), y (surface height)} */
function ovalPt(sp, d, out){
  var G=OVAL.G, R=G.R, ls=G.ls, L=G.L, s=((sp%L)+L)%L, o=out||_oPt, c, sn, ph, tl=Math.PI*R, tin;
  if(s<ls){ o.x=-ls/2+s; o.z=R; o.psi=0; o.nx=0; o.nz=-1; tin=-Math.min(s, ls-s); }
  else if(s<ls+tl){ ph=(s-ls)/R; c=Math.cos(ph); sn=Math.sin(ph); o.x=ls/2+R*sn; o.z=R*c; o.psi=ph; o.nx=-sn; o.nz=-c; tin=Math.min(s-ls, ls+tl-s); }
  else if(s<2*ls+tl){ var u=s-ls-tl; o.x=ls/2-u; o.z=-R; o.psi=PI; o.nx=0; o.nz=1; tin=-Math.min(u, ls-u); }
  else { var u2=s-2*ls-tl; ph=u2/R; c=Math.cos(ph); sn=Math.sin(ph); o.x=-ls/2-R*sn; o.z=-R*c; o.psi=PI+ph; o.nx=sn; o.nz=c; tin=Math.min(u2, L-s); }
  o.bank=G.bank*ovalSmooth(-16,16,tin)+0.02*(1-ovalSmooth(-16,16,tin));
  o.x+=o.nx*d; o.z+=o.nz*d; o.y=(G.w/2-d)*Math.tan(o.bank); return o;
}
/* the clay, the grass, the groove: everything from world x,z and the stadium's own distance field */
var OVAL_GLSL=[
  "uniform float uR; uniform float uLs; uniform float uW; uniform float uDry; uniform float uAsph;",
  "vec3 stripSurf(vec3 w, out float rough){",
  "  vec2 p=w.xz; float dc=length(p-cameraPosition.xz); float fine=1.0-smoothstep(18.0,110.0,dc), mid=1.0-smoothstep(100.0,900.0,dc);",
  "  float rho=uR-length(vec2(max(abs(p.x)-uLs*0.5,0.0),p.y));",
  "  vec3 grass=vec3(0.10,0.15,0.05)*(0.8+0.35*sn(p*0.07))*(0.9+0.2*sn(p*1.7)*fine);",
  "  float mow=smoothstep(0.5,0.8,sn(p*0.045+2.0)); grass=mix(grass,vec3(0.13,0.19,0.065),mow*0.5);",
  "  vec3 clay=vec3(0.30,0.20,0.125)*(0.78+0.4*sn(p*0.35))+vec3(0.035,0.025,0.015)*(sn(p*5.0)-0.5)*fine;",
  "  float groove=exp(-pow((rho+1.5)/2.6,2.0)), cush=exp(-pow((rho+uW*0.4)/1.8,2.0));",
  "  clay=mix(clay,clay*0.62,groove*(1.0-uDry*0.5)); clay=mix(clay,vec3(0.38,0.27,0.18),cush*(0.5+uDry*0.4));",
  "  float rut=sn(vec2(p.x*0.6+p.y*0.6,rho*3.0)); clay*=1.0-0.18*smoothstep(0.55,0.8,rut)*groove*fine;",
  "  float onT=1.0-smoothstep(uW*0.5,uW*0.5+0.5,abs(rho));",
  /* Full / Ultra: harrow lines and a packed, rubbered groove, loose marbles and clods up by the cushion, the seam where the bank begins, tufted grass */
  "#if STRIP_TIER>=1",
  "  float gh, dh; vec3 gm=sfGrassFx(p,gh); vec3 dm=sfDirtFx(p,clamp(0.2+0.85*cush+0.4*(1.0-groove),0.0,1.0),dh);",
  "  float ln=0.5+0.5*sin(rho*13.0+2.5*sn(p*0.4)), sm=1.0-smoothstep(0.0,0.4,abs(abs(p.x)-uLs*0.5)), mb=smoothstep(0.62,0.82,sn(p*3.1+8.0))*aaf(0.3)*(1.0-groove);",
  "  dm*=(1.0+0.09*(ln-0.5)*groove*aaf(0.2))*(1.0-0.12*sm*(1.0-0.5*groove))*(1.0+0.16*mb); dh+=0.011*ln*groove*aaf(0.2)-0.01*sm+0.012*mb;",
  "  grass*=gm; clay*=dm; gH=mix(gh,dh,onT); gHK=1.0;",
  "#endif",
  /* asphalt instead of clay: dark grey with a rubbered racing line, tar snakes, white edge lines inside and out, a faint lighter apron */
  "  if(uAsph>0.5){ vec3 asp=vec3(0.092,0.095,0.102)*(0.8+0.36*sn(p*0.31))+vec3(0.02)*(sn(p*6.0)-0.5)*fine;",
  "    asp=mix(asp,asp*0.7,groove*0.75); asp=mix(asp,vec3(0.15,0.15,0.16),smoothstep(0.62,0.8,sn(p*0.9+4.0))*0.35*(1.0-groove));",
  "    float eIn=1.0-smoothstep(0.12,0.3,abs(rho-(uW*0.5-0.9))), eOut=1.0-smoothstep(0.12,0.3,abs(rho+(uW*0.5-0.9)));",
  "    asp=mix(asp,vec3(0.72,0.72,0.69),0.85*max(eIn,eOut));",
  "    clay=asp; }",
  "  vec3 apron=vec3(0.36,0.33,0.28)*(0.85+0.3*sn(p*0.6)); float inner=smoothstep(uW*0.5,uW*0.5+0.4,rho)*(1.0-smoothstep(uW*0.5+0.8,uW*0.5+1.2,rho));",
  "  vec3 c=mix(grass,clay,onT); c=mix(c,apron*0.6,inner*0.0);",
  "  float lot=smoothstep(uW*0.5+13.0,uW*0.5+14.0,-rho)*(1.0-smoothstep(uW*0.5+60.0,uW*0.5+61.0,-rho));",
  "  c=mix(c,vec3(0.30,0.27,0.21)*(0.8+0.35*sn(p*0.9)),lot*0.65);",
  "#if STRIP_TIER>=1",
  "  float gvH; vec3 gvm=sfGravelFx(p,gvH); c*=mix(vec3(1.0),gvm,lot*0.65); gH=mix(gH,gvH,lot*0.65);",
  "#endif",
  "  vec2 q=(p+vec2(800.0,800.0))/805.0; vec2 cell=floor(q); float h=sh(cell+11.0);",
  "  vec3 fc= h<0.25?vec3(0.40,0.30,0.11): h<0.45?vec3(0.50,0.42,0.03): h<0.62?vec3(0.11,0.17,0.05): h<0.8?vec3(0.30,0.23,0.12):vec3(0.18,0.13,0.08);",
  "  fc*=0.9+0.22*(sn(p*0.006+cell*7.0)-0.5)*mid;",
  "  float fair=1.0-smoothstep(150.0,190.0,-rho); c=mix(fc,c,fair);",
  "#if STRIP_TIER>=1",
  "  gH*=fair;",
  "#endif",
  "  rough=mix(0.97,mix(0.82,0.9,uAsph),onT); return c; }"].join("\n");
function ovalAtlas(){
  var c=newCanvas(1024,128), x=c.getContext("2d"), F="'Chakra Petch','Arial Narrow',Arial,sans-serif", i, labels=["PRAIRIE ENGINE WORKS","COULEE FUELS","NORTHWIND TYRE","CANOLA CO-OP","BIG SKY SALVAGE","ELEVATOR FEEDS"], cols=[["#d97757","#141413"],["#141413","#d97757"],["#f2c22c","#131416"],["#1d4787","#f4efe2"],["#b7261d","#f4efe2"],["#2c6b3a","#f4efe2"]];
  for(i=0;i<6;i++){ var bx=i*170; x.fillStyle=cols[i][0]; x.fillRect(bx,0,168,128); x.fillStyle=cols[i][1]; x.font="700 26px "+F; x.textAlign="center"; x.textBaseline="middle";
    var w=labels[i].split(" "), half=Math.ceil(w.length/2); x.fillText(w.slice(0,half).join(" "),bx+84,46,156); x.fillText(w.slice(half).join(" "),bx+84,82,156); }
  var t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=MAXANISO; return t;
}
function ovalFlagTex(kind){
  var c=newCanvas(128,80), x=c.getContext("2d");
  if(kind==="checker"){ for(var j=0;j<5;j++) for(var i=0;i<8;i++){ x.fillStyle=(i+j)%2?"#f4f4f0":"#141413"; x.fillRect(i*16,j*16,16,16); } }
  else { x.fillStyle=kind==="green"?"#2fb24c":kind==="yellow"?"#f2c22c":kind==="red"?"#d63a2c":"#f4f4f0"; x.fillRect(0,0,128,80); }
  var t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; return t;
}
function ovalBoardTex(){ var c=newCanvas(256,512), t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=MAXANISO; t.userData={cv:c}; return t; }
function ovalBoardDraw(t, rows, head){
  var c=t.userData.cv, x=c.getContext("2d"), F="'Chakra Petch','Arial Narrow',Arial,sans-serif";
  x.fillStyle="#1c1b19"; x.fillRect(0,0,256,512); x.fillStyle="#d97757"; x.fillRect(0,0,256,46); x.fillStyle="#141413"; x.font="700 26px "+F; x.textAlign="center"; x.textBaseline="middle"; x.fillText(head||OVAL.venue||"SPEEDWAY",128,24,240);
  x.textAlign="left"; x.font="700 25px "+F;
  for(var i=0;i<Math.min(12,rows.length);i++){ var r=rows[i], y=60+i*37; x.fillStyle=r.me?"#d97757":i%2?"#161a1e":"#1b2025"; if(r.me) x.fillRect(4,y-17,248,34); else x.fillRect(4,y-17,248,34);
    x.fillStyle=r.me?"#141413":"#f2c22c"; x.fillText(String(i+1),12,y+1); x.fillStyle=r.me?"#141413":"#f0ece2"; x.fillText(String(r.num).padStart(2," "),52,y+1);
    x.font="600 19px "+F; x.fillText(String(r.n||"").slice(0,12),96,y+1); x.font="700 25px "+F; }
  t.needsUpdate=true;
}
/* ---- the world: built once per tier / track ---- */
function buildOvalScene(G){
  var S3=new THREE.Scene(), lite=(GFX==="lite"), M={}, i, k;
  OVAL.scene=S3; OVAL.tier=GFX; OVAL.mats=M; OVAL.G=G; OVAL.poles=[]; OVAL.spots=[]; OVAL.cars={}; OVAL.list=[];
  var R=G.R, ls=G.ls, W=G.w, L=G.L, hw=W/2, rng=function(s){ var t=Math.sin(s*127.1+3.7)*43758.5453; return t-Math.floor(t); };
  var hemi=new THREE.HemisphereLight(0xcfdcf0, 0x6a5a3c, 0.3); S3.add(hemi); OVAL.hemi=hemi;
  var sun=new THREE.DirectionalLight(0xffe6c4, 1.45); sun.shadow.mapSize.set(2048,2048); var shc=sun.shadow.camera; shc.left=-34; shc.right=34; shc.top=34; shc.bottom=-34; shc.near=1; shc.far=300; sun.shadow.bias=-0.0006; sun.shadow.normalBias=0.03;
  S3.add(sun); S3.add(sun.target); OVAL.sun=sun;
  var flood=new THREE.DirectionalLight(0xfff2dc, 0); flood.position.set(0,60,40); S3.add(flood); S3.add(flood.target); OVAL.flood=flood;
  var sky=new THREE.Mesh(new THREE.SphereGeometry(2600,40,20), stripSkyMat()); sky.frustumCulled=false; stripSkyLate(sky); S3.add(sky); OVAL.sky=sky;
  S3.fog=new THREE.Fog(0xffffff,150,2700); OVAL.fog=S3.fog;
  var U={ uR:{value:R}, uLs:{value:ls}, uW:{value:W}, uDry:{value:0}, uAsph:{value:G.surf==="asphalt"?1:0} };
  var gm=stripSurfMat(OVAL_GLSL, null, U); gm.customProgramCacheKey=function(){ return "oval_ground"; }; gm.userData.U=U; M.ground=gm;
  var ground=new THREE.Mesh(new THREE.PlaneGeometry(6000,6000), gm); ground.rotation.x=-PI/2; ground.position.y=-0.03; ground.receiveShadow=true; S3.add(ground);
  /* the banked ribbon: inner edge low, outer high; one row of samples every 2.5 m, 13 across and a sloped berm out to the ground */
  (function(){ var n=Math.round(L/2.5), nd=13, ex=7, pos=[], idx=[], dd=[], j, e;
    for(j=0;j<nd;j++) dd.push(hw-W*j/(nd-1));
    for(e=1;e<=ex;e++) dd.push(-hw-e*2.0);
    var cols=dd.length;
    for(i=0;i<=n;i++){ var sp=i/n*L; ovalPt(sp,-hw,_oPt); var yTop=_oPt.y;
      for(j=0;j<cols;j++){ var d=dd[j]; ovalPt(sp,d,_oPt); var y=_oPt.y; if(d<-hw) y=yTop*(1-ovalSmooth(0,1,(-hw-d)/(2.0*ex))); pos.push(_oPt.x,y+0.02,_oPt.z); } }
    for(i=0;i<n;i++) for(j=0;j<cols-1;j++){ var a=i*cols+j, b=a+1, c2=a+cols, d2=c2+1; idx.push(a,b,c2, b,d2,c2); }
    var g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals();
    var m=new THREE.Mesh(g, gm); m.receiveShadow=true; S3.add(m); OVAL.ribbon=m; })();
  M.solid=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.86});
  M.metal=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.42, metalness:0.65});
  M.lamp=new THREE.MeshBasicMaterial({vertexColors:true, toneMapped:false, color:0x777777});
  M.beam=new THREE.MeshBasicMaterial({vertexColors:true, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, fog:true, side:THREE.DoubleSide});
  M.sign=new THREE.MeshStandardMaterial({map:ovalAtlas(), roughness:0.7});
  var B=new StripBatch(), STEEL=0x8d9296, ALU=0xb9bec4, CON=0x9a9a94, UVS=function(q){ return [q*170/1024,0,(q*170+168)/1024,1]; };
  /* the wall round the outside of the bank, a catch fence on top, posts; sponsor boards on the wall face */
  for(var sp=0, q=0; sp<L; sp+=3.0, q++){ ovalPt(sp+1.5, -hw-0.55, _oPt); var yy=_oPt.y, psi=_oPt.psi, nx=_oPt.nx, nz=_oPt.nz;
    B.add("solid","box",[_oPt.x, yy+0.65, _oPt.z],[3.05,1.3,0.42],q%7===3?0xd8d4c6:CON,[0,psi,0]);
    if(q%2===0){ B.add("sign","plane",[_oPt.x+nx*0.24, yy+0.7, _oPt.z+nz*0.24],[2.7,1.0,1],0xffffff,[0,Math.atan2(nx,nz),0],UVS((q/2)%6|0));
      B.add("metal","cyl6",[_oPt.x, yy+3.2, _oPt.z],[0.1,3.8,0.1],STEEL); } }
  /* catch fence: a tall thin wire panel along the top, one translucent ribbon */
  (function(){ var pos=[], idx=[], n=Math.round(L/3), v=0;
    for(i=0;i<=n;i++){ ovalPt(i/n*L, -hw-0.55, _oPt); pos.push(_oPt.x,_oPt.y+1.3,_oPt.z,_oPt.x,_oPt.y+5.1,_oPt.z); if(i<n){ idx.push(v,v+1,v+2,v+1,v+3,v+2); } v+=2; }
    var g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals();
    var f=new THREE.Mesh(g, new THREE.MeshBasicMaterial({color:0x8d9296, transparent:true, opacity:0.16, side:THREE.DoubleSide, depthWrite:false})); f.frustumCulled=false; S3.add(f); })();
  /* tyres on the infield edge: two-high, white paint on the turns */
  for(var st=0, t2=0; st<L; st+=lite?3.6:2.4, t2++){ ovalPt(st, hw+0.55, _oPt); var tw=_oPt.bank>0.12; B.add("solid","cyl",[_oPt.x,_oPt.y+0.22,_oPt.z],[0.85,0.42,0.85],tw&&t2%2?0xe8e4da:0x1a1a1c);
    if(!lite) B.add("solid","cyl",[_oPt.x+_oPt.nx*0.12,_oPt.y+0.62,_oPt.z+_oPt.nz*0.12],[0.8,0.4,0.8],tw&&t2%2===0?0xe8e4da:0x1a1a1c); }
  /* the front straight: start/finish stripe, grandstand, press box, flag stand */
  B.add("solid","box",[0,0.045,R],[0.9,0.03,W],0xf4f4f0);
  var gz=R+hw+7, tiers=9;
  for(i=0;i<tiers;i++){ B.add("solid","box",[0,0.55+i*0.95,gz+i*1.55],[132,1.1,1.65],0x8a8a84); B.add("metal","box",[0,1.12+i*0.95,gz+i*1.55-0.5],[130,0.1,0.5],ALU); }
  B.add("solid","box",[0,0.5,gz-1.4],[134,1.0,0.35],0x6f6f6a);
  for(i=-5;i<=5;i++){ B.add("metal","cyl6",[i*13,tiers*0.95+3.2,gz+tiers*1.55-1.2],[0.18,6.6,0.18],STEEL); }
  B.add("metal","box",[0,tiers*0.95+6.6,gz+tiers*1.55-2.2],[140,0.3,9.6],0x6a2a22,[-0.09,0,0]);
  B.add("solid","box",[0,tiers*0.95+9.4,gz+tiers*1.55+2.4],[22,3.2,4.2],0xe7e2d6); B.add("solid","box",[0,tiers*0.95+9.5,gz+tiers*1.55+0.28],[20,1.4,0.08],0x1b2a33); B.add("sign","plane",[0,tiers*0.95+11.4,gz+tiers*1.55-0.2],[16,1.5,1],0xffffff,[0,PI,0],UVS(0));
  /* flag stand: a stand beside the line, the flagman's platform */
  B.add("solid","box",[-4.5,1.8,R+hw+2.6],[5,3.6,2.6],0xd9d2c0); B.add("metal","box",[-4.5,3.7,R+hw+2.6],[5.4,0.2,3],0x4a4f55);
  /* light towers: ten round the outside, a pole to 26 m with a bank of lamps and a beam leaning onto the track */
  var towers=[[-70,R+hw+32],[0,R+hw+60],[70,R+hw+32],[ls/2+R+hw+28,0],[ls/2+R*0.7+hw+24,R*0.75+24],[ls/2+R*0.7+hw+24,-R*0.75-24],[70,-R-hw-32],[0,-R-hw-30],[-70,-R-hw-32],[-ls/2-R-hw-28,0]];
  towers.forEach(function(tp){ var px=tp[0], pz=tp[1], H=26, dl=Math.hypot(px,pz)||1, ux=-px/dl, uz=-pz/dl, ry=Math.atan2(ux,uz), ax=Math.cos(ry), az=-Math.sin(ry), t=0.24;
    B.add("metal","cyl",[px,H/2,pz],[0.5,H,0.5],0x9aa0a6); B.add("metal","box",[px,H+0.3,pz],[5.4,0.3,0.4],0x80868c,[0,ry,0]);
    for(k=-2;k<=2;k++){ var lx=px+ax*k*1.0, lz=pz+az*k*1.0; B.add("metal","box",[lx,H+0.9,lz],[0.9,0.8,0.5],0x5a5f65,[0,ry,0]); B.add("lamp","box",[lx+ux*0.3,H+0.9,lz+uz*0.3],[0.78,0.66,0.04],0xfff0d0,[0,ry,0]); }
    var rx=-Math.atan(t*uz), rz=Math.atan(t*ux*Math.cos(rx)), nn=Math.sqrt(1+t*t);
    B.add("beam","beam",[px+t*ux*H*0.5, H*0.5+0.4, pz+t*uz*H*0.5],[8,H*nn,8],0xffe8c0,[rx,0,rz]);
    OVAL.poles.push(new THREE.Vector3(px,H+0.9,pz)); });
  /* the infield: haulers and tents in the pits, a stack of spare tyres, the pit road */
  var hc=[0xe9e6dc,0x1b1d20,0x9e2a22,0x22488f,0xd0d3d6,0x2c6b3a,0xff7a1a,0x6b6f74];
  for(i=0;i<14;i++){ var hx=-ls/2+8+i*((ls-16)/13), hz=-R+hw+14+(i%2)*10+rng(i)*3, cc=hc[i%hc.length];
    B.box("solid",hx,1.9,hz,9,3.4,2.7,cc,0); B.box("solid",hx-5.4,1.4,hz,2.2,2.4,2.6,0x22262b,0); B.box("solid",hx,0.4,hz,9,0.5,2.5,0x161718,0); B.add("sign","plane",[hx,2.3,hz+1.37],[6.5,1.2,1],0xffffff,[0,0,0],UVS(i%6)); }
  for(i=0;i<9;i++){ var tx=-ls/2+16+i*13, tz=R-hw-22-rng(i+5)*3; B.box("solid",tx,1.1,tz,5.5,2.2,4,i%2?0xf1ede2:0x2a6db5,0); B.add("solid","prism",[tx,2.2,tz],[5.7,1.4,4.2],i%2?0xe0dccf:0x1d4787,[0,PI/2,0]); }
  /* the grain elevator and sheds on the horizon, a water tower in the town */
  B.box("solid",260,22,-340,14,44,14,0xd9d4c6,0.3); B.add("solid","prism",[260,44,-340],[14.4,4,14.4],0x4a4644,[0,0.3,0]); B.box("solid",282,13,-336,10,26,10,0xcfcabb,0.3);
  B.box("solid",-300,6,260,28,12,18,0x9a2e22,0.4); B.add("solid","prism",[-300,12,260],[28.4,4,18.6],0x5a5a5a,[0,0.4,0]);
  B.add("metal","cyl",[-420,22,-300],[3,44,3],0x9aa0a6); B.add("metal","cyl",[-420,48,-300],[16,12,16],0xe9e6dc);
  var bm=function(key,shadow){ var keep=STRIP.scene; STRIP.scene=S3; var m=B.build(key, M[key], shadow); STRIP.scene=keep; return m; };
  bm("solid",!lite); bm("metal",!lite); OVAL.lampMesh=bm("lamp",false); bm("sign",false);
  OVAL.beamMesh=bm("beam",false); if(OVAL.beamMesh){ OVAL.beamMesh.receiveShadow=false; OVAL.beamMesh.visible=false; OVAL.beamMesh.renderOrder=4; }
  /* shelterbelt */
  (function(){ var pts=[], s;
    for(s=0;s<70;s++){ var a=s/70*TAU, Rr=230+rng(s)*60; pts.push([Math.cos(a)*Rr*1.5, Math.sin(a)*Rr*1.2, 4+rng(s+3)*3]); }
    var im=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0), new THREE.MeshStandardMaterial({roughness:1}), pts.length), mm=new THREE.Matrix4(), cc=new THREE.Color();
    pts.forEach(function(p,qq){ var h=p[2]*1.6; mm.compose(_oA.set(p[0],h*0.8,p[1]), new THREE.Quaternion(), _oB.set(p[2],h,p[2])); im.setMatrixAt(qq,mm); cc.setHSL(0.24+rng(qq)*0.06,0.45,0.13+rng(qq+1)*0.06).convertSRGBToLinear(); im.setColorAt(qq,cc); });
    instCull(im); S3.add(im); })();
  /* the crowd on the stand: rows of seated people, thinner on Lite */
  (function(){ var ppl=[], occ=lite?0.4:ULT()?0.9:0.66;
    for(var r=0;r<tiers;r++){ var rz=gz+r*1.55+0.2, ry=1.1+r*0.95;
      for(var xx=-64; xx<64; xx+=0.62){ if(rng(xx*3.1+r*17.7)>occ*(1-r*0.03)) continue; ppl.push([xx+(rng(xx+r)-0.5)*0.3, ry, rz+(rng(xx*1.7+r)-0.5)*0.3]); } }
    var n=ppl.length, bodyM=new THREE.InstancedMesh(new THREE.BoxGeometry(0.46,0.7,0.34), new THREE.MeshStandardMaterial({roughness:0.95}), n), headM=new THREE.InstancedMesh(new THREE.BoxGeometry(0.22,0.25,0.22), new THREE.MeshStandardMaterial({roughness:0.9}), n);
    var shirts=[0x9c3a30,0x34598f,0xcfccc4,0x1f2023,0x2a2c30,0xff7a1a,0x44684a,0xc8a640,0x5d5f66,0x7a7f86,0x3a3d44,0x8f4a5e,0x2c6b3a], skin=[0xe0b494,0xc68a64,0x8d5a3b,0xf0c9a8,0x5a3a26], hats=[0x1d4787,0xff7a1a,0x222222,0xe9e6dc,0x2c6b3a,0x9e2a22];
    var mm=new THREE.Matrix4(), cc=new THREE.Color(), base=[];
    for(var s2=0;s2<n;s2++){ var p=ppl[s2]; mm.makeTranslation(p[0],p[1]+0.35,p[2]); bodyM.setMatrixAt(s2,mm); mm.makeTranslation(p[0],p[1]+0.83,p[2]); headM.setMatrixAt(s2,mm);
      cc.set(shirts[Math.floor(rng(s2*1.3)*shirts.length)]).convertSRGBToLinear(); bodyM.setColorAt(s2,cc);
      cc.set(rng(s2*2.9)<0.45?hats[Math.floor(rng(s2*4.1)*hats.length)]:skin[Math.floor(rng(s2*3.7)*skin.length)]).convertSRGBToLinear(); headM.setColorAt(s2,cc); base.push(p); }
    instCull(bodyM,1.5); instCull(headM,1.5); S3.add(bodyM); S3.add(headM);
    OVAL.crowd={body:bodyM, head:headM, base:base, n:n, phase:base.map(function(p,q2){ return rng(q2*9.1)*TAU; }), excite:base.map(function(p,q2){ return rng(q2*5.3); }), live:false}; })();
  /* scoreboard in the infield, facing the stand */
  (function(){ var t=ovalBoardTex(); ovalBoardDraw(t,[],""); var mat=new THREE.MeshBasicMaterial({map:t, toneMapped:false}); OVAL.board={tex:t, mat:mat, key:""};
    var mesh=new THREE.Mesh(new THREE.PlaneGeometry(10,20), mat); mesh.position.set(-ls*0.18, 12, -8); mesh.rotation.y=0; S3.add(mesh);
    var post=new THREE.Mesh(new THREE.BoxGeometry(0.5,12,0.5), new THREE.MeshStandardMaterial({color:0x4a4f55})); post.position.set(-ls*0.18,6,-8.4); S3.add(post); OVAL.boardMesh=mesh; })();
  /* the flag */
  (function(){ var pole=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,3,6), new THREE.MeshStandardMaterial({color:0xcfd2d6})); pole.position.set(-4.5,5.2,R+hw+2.6); S3.add(pole);
    var fl=new THREE.Mesh(new THREE.PlaneGeometry(1.9,1.2), new THREE.MeshBasicMaterial({map:ovalFlagTex("green"), side:THREE.DoubleSide, toneMapped:false})); fl.position.set(-4.5+0.95,5.6,R+hw+2.6); fl.rotation.y=PI/2; fl.rotation.set(0,0,0); S3.add(fl); OVAL.flagMesh=fl; OVAL.flagKey="green"; OVAL.flagTex={}; })();
  OVAL.fx=new StripFx(lite?260:620,"smoke",stripPuffTex()); S3.add(OVAL.fx.mesh);
  OVAL.cam=OVAL.cam||new THREE.PerspectiveCamera(50,1,0.3,4200); OVAL.built=true; OVAL.night=null; OVAL.snap=true; ovalSetNight(false);
}
function ovalSetNight(on){
  on=!!on; var tierChanged=OVAL.tier!==GFX; if(OVAL.night===on && !tierChanged) return;
  OVAL.night=on; OVAL.tier=GFX; var S3=OVAL.scene, lite=(GFX==="lite"), M=OVAL.mats;
  OVAL.sky.material.uniforms.uNight.value=on?1:0;
  var h=on?STRIP_HOR_N:STRIP_HOR; OVAL.horLin=new THREE.Color(h[0],h[1],h[2]); OVAL.sunDir=(on?STRIP_MOON:STRIP_SUN_DAY);
  OVAL.sun.color.set(on?0x9fb2d6:0xffe2bc); OVAL.sun.intensity=on?0.14:1.45; OVAL.sun.castShadow=!lite;
  OVAL.hemi.intensity=on?0.16:0.2; OVAL.hemi.color.set(on?0x3a4764:0xcfdcf0); OVAL.hemi.groundColor.set(on?0x16130e:0x6a5a3c);
  OVAL.flood.intensity=on?(lite?0.7:0.4):0; M.lamp.color.set(on?0xffffff:0x5e5e5e);
  if(OVAL.beamMesh){ OVAL.beamMesh.visible=on; M.beam.opacity=on?0.012:0; ultraBeam(OVAL.beamMesh, M.beam); }
  S3.environment=stripEnv(on); OVAL.exposure=on?1.0:0.9;
  if(OVAL.fx){ OVAL.fx.mat.uniforms.uAmb.value=on?0.5:1; OVAL.fx.mat.uniforms.uFogN.value=S3.fog.near; OVAL.fx.mat.uniforms.uFogF.value=S3.fog.far; }
  M.ground.userData.U.uDry.value=on?0.3:0.5;
  if(tierChanged && OVAL.sun.shadow.map){ OVAL.sun.shadow.map.dispose(); OVAL.sun.shadow.map=null; }
  OVAL.spots.forEach(function(sp){ S3.remove(sp); S3.remove(sp.target); if(sp.shadow&&sp.shadow.map) sp.shadow.map.dispose(); }); OVAL.spots=[];
  if(on){ for(var i=0;i<(lite?2:3);i++){ var sp=new THREE.SpotLight(0xfff0d8,lite?2.2:1.1,200,0.7,0.6,1.4); sp.castShadow=!lite && i===0; if(sp.castShadow){ sp.shadow.mapSize.set(1024,1024); sp.shadow.bias=-0.002; sp.shadow.normalBias=0.05; sp.shadow.camera.near=4; sp.shadow.camera.far=220; }
    S3.add(sp); S3.add(sp.target); OVAL.spots.push(sp); } ultraSpots(OVAL.spots); }
  if(!lite) ultraShadow(OVAL.sun,2048);
}
/* ---- a stock car: the road test's muscle shape, a rear spoiler, number and livery from stripCar ---- */
function ovalCarMesh(color, big){
  var car=stripCar("street", color, 27), U=car.userData, B=U.bodyGroup;
  B.scale.set(1.0, 0.94, 1.06);
  var wm=new THREE.MeshStandardMaterial({color:sc(0x15171b), roughness:0.5, metalness:0.2}), g=new THREE.Group();
  var sp=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.05,1.65), wm); sp.position.set(-2.2,1.08,0); sp.rotation.z=0.22; g.add(sp);
  for(var s=-1;s<=1;s+=2){ var pl=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.28,0.025), wm); pl.position.set(-2.2,1.0,s*0.83); g.add(pl); }
  g.children.forEach(function(m){ m.castShadow=true; }); B.children[0].add(g);
  car.traverse(function(o){ if(o.isMesh) o.castShadow=true; });
  return car;
}
function ovalGetCar(color){
  var k=color+(GFX==="lite"?"l":""), c=OVAL.cars[k]; if(!c){ c=OVAL.cars[k]=ovalCarMesh(color); OVAL.scene.add(c); c.userData.lane={d:0,set:false}; c.userData.steer=0; c.userData.roll=0; }
  return c;
}
/* ---- lanes: front to back, each car takes its preferred groove unless a car ahead is in it ---- */
function ovalLanes(list, dt){
  var G=OVAL.G, L=G.L, idx=list.map(function(c,i){ return i; }).filter(function(i){ return !list[i].gone; });
  idx.sort(function(a,b){ return list[b].s-list[a].s; });
  var placed=[], gap=7.8, side=2.7, i, j, w;
  idx.forEach(function(ci){ var c=list[ci], pref=c.me?1.6:(c.groove!=null?c.groove:-1), d=pref, best=null, tries=[0,1,-1,2,-2,3,-3];
    for(j=0;j<tries.length;j++){ var dd=clamp(pref+tries[j]*side,-hw0(),hw0()), ok=true;
      for(w=0;w<placed.length;w++){ var p=placed[w], ds=((p.s-c.s)%L+L)%L; if(ds>L/2) ds-=L; if(Math.abs(ds)<gap && Math.abs(p.d-dd)<side*0.92){ ok=false; break; } }
      if(ok){ best=dd; break; } }
    if(best==null) best=clamp(pref+side*3,-hw0(),hw0());
    var st=OVAL.lane[ci]; if(st==null||isNaN(st)) st=best; st+=(best-st)*Math.min(1,dt*1.6); OVAL.lane[ci]=st; c.dRender=st; placed.push({s:c.s,d:st}); });
}
function hw0(){ return OVAL.G.w/2-1.3; }
/* ---- the director ---- */
function ovalDirect(o, dt, me, V){
  var G=OVAL.G, L=G.L, s=OVAL.shot, mode=o.cam||"auto", ph=o.pre?"pre":o.done?"done":"race", sp=me.s+G.ls/2, fov=50, rel=false;
  var pos=_oA, tgt=_oB;
  if(mode==="chase"||mode==="tv"||mode==="heli"||mode==="onboard") s=mode;
  else if(ph==="pre") s="start";
  else if(ph==="done") s="finish";
  else { var cyc=["chase","tv","pack","chase","onboard","tv","heli"], lens=[6,7,5,5,4,6,5];
    if(!s||cyc.indexOf(s)<0){ s="chase"; OVAL.cyc=0; }
    if(OVAL.shotT>lens[OVAL.cyc%cyc.length]){ OVAL.cyc=(OVAL.cyc+1)%cyc.length; s=cyc[OVAL.cyc]; } else s=cyc[OVAL.cyc%cyc.length];
    if(o.lastLap && (o.toFlag||0)<1) s="finish"; }
  sceneCut(OVAL, s); OVAL.shotT+=dt; OVAL.cutT+=dt;
  var cp=V.position, yaw=V.rotation.y, fx=Math.cos(yaw), fz=-Math.sin(yaw);
  switch(s){
    case "start": { var t0=Math.min(1,OVAL.shotT/8); ovalPt(G.ls/2+34-10*t0, G.w/2+11, _oPt); pos.set(_oPt.x, 3.3+1.4*t0, _oPt.z); ovalPt(G.ls/2-20, 0, _oPt); tgt.set(_oPt.x, 1.1, _oPt.z); fov=52; break; }
    case "chase": { pos.set(cp.x-fx*11, cp.y+3.0, cp.z-fz*11); tgt.set(cp.x+fx*8, cp.y+1.1, cp.z+fz*8); fov=58; rel=true; break; }
    case "onboard": { pos.set(cp.x+fx*0.1-0.0, cp.y+1.12, cp.z+fz*0.1); tgt.set(cp.x+fx*22, cp.y+0.9, cp.z+fz*22); fov=72; break; }
    case "tv": { ovalPt(sp+34, G.w/2+13, _oPt); pos.set(_oPt.x, 4.4, _oPt.z); tgt.set(cp.x+fx*4, cp.y+0.8, cp.z+fz*4); var dist=pos.distanceTo(tgt); fov=clamp(2*Math.atan(9/Math.max(8,dist))*180/PI,14,50); break; }
    case "pack": { var cx=0, cz=0, n=0; for(var i=0;i<o.cars.length;i++){ var c=o.cars[i]; if(c.gone) continue; var ds=((c.s-me.s)%L+L)%L; if(ds>L/2) ds-=L; if(Math.abs(ds)<55){ var q=OVAL.list[i]; if(q){ cx+=q.position.x; cz+=q.position.z; n++; } } } if(!n){ cx=cp.x; cz=cp.z; n=1; }
      tgt.set(cx/n, 0.6, cz/n); pos.set(cx/n-fz*0*0+fx*-1, 15, cz/n); pos.x=cx/n-fx*8+(-fz)*-22; pos.z=cz/n-fz*8+(fx)*-22; pos.y=14; fov=44; break; }
    case "heli": { OVAL.tvA+=dt*0.16; var Rr=70; pos.set(cp.x+Math.cos(OVAL.tvA)*Rr, 46, cp.z+Math.sin(OVAL.tvA)*Rr); tgt.set(cp.x+fx*6, cp.y, cp.z+fz*6); fov=40; break; }
    case "finish": { ovalPt(G.ls/2+60, -hw0()-1, _oPt); pos.set(_oPt.x, 3.0, _oPt.z+3); ovalPt(G.ls/2, 1, _oPt); tgt.set(_oPt.x+8, 1.3, _oPt.z); fov=36; break; }
  }
  if(rel){ if(OVAL.snap||!OVAL.relOn){ OVAL.rp=OVAL.rp||new THREE.Vector3(); OVAL.rt=OVAL.rt||new THREE.Vector3(); OVAL.rp.copy(pos); OVAL.rt.copy(tgt); } else { var k=1-Math.exp(-dt*5); OVAL.rp.lerp(pos,k); OVAL.rt.lerp(tgt,1-Math.exp(-dt*9)); }
    pos.copy(OVAL.rp); tgt.copy(OVAL.rt); OVAL.relOn=true; } else OVAL.relOn=false;
  if(OVAL.snap){ OVAL.fov=fov; OVAL.snap=false; OVAL.camTgt.copy(tgt); } else OVAL.fov+=(fov-OVAL.fov)*(1-Math.exp(-5*dt));
  OVAL.camPos.copy(pos); if(rel) OVAL.camTgt.copy(tgt); else OVAL.camTgt.lerp(tgt,1-Math.exp(-7*dt));
  OVAL.shake*=Math.exp(-dt*3); var sh=CALM?0:OVAL.shake; if(sh>0.002){ OVAL.camPos.x+=(Math.random()-0.5)*sh*0.2; OVAL.camPos.y+=(Math.random()-0.5)*sh*0.2; }
  var cam=OVAL.cam; cam.position.copy(OVAL.camPos); cam.lookAt(OVAL.camTgt); cam.fov=OVAL.fov; cam.updateProjectionMatrix(); bandLens(cam);
}
function ovalComposer(){
  if(OVAL.composer===false) return null;
  var sz=renderer.getSize(new THREE.Vector2()), pr=renderer.getPixelRatio(), C=ultraComposerKeep(OVAL.composer);
  if(!C){ try{ C=ultraComposerMark(new THREE.EffectComposer(renderer, ultraRT())); C.addPass(ultraRenderPass(OVAL.scene, OVAL.cam, "oval"));
      var bp=new THREE.UnrealBloomPass(new THREE.Vector2(Math.max(1,sz.x*pr/2), Math.max(1,sz.y*pr/2)), 0.3, 0.4, 0.9); C.addPass(bp); OVAL.bloom=bp;
      if(THREE.GammaCorrectionShader) C.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
      OVAL.composer=C; OVAL.cSize=""; }catch(e){ OVAL.composer=false; return null; } }
  var key=sz.x+"x"+sz.y+"@"+pr; if(OVAL.cSize!==key){ if(C.setPixelRatio) C.setPixelRatio(pr); C.setSize(sz.x, sz.y); OVAL.cSize=key; }
  var n=!!OVAL.night, b=OVAL.bloom; b.strength=n?0.6:0.22; b.threshold=n?0.72:0.92; b.radius=n?0.5:0.4;
  return C;
}
function ovalRender(){
  var S3=OVAL.scene, cam=OVAL.cam; if(!S3||!cam) return;
  var C=(GFX!=="lite" && THREE.EffectComposer && THREE.UnrealBloomPass && THREE.RenderPass && THREE.ShaderPass) ? ovalComposer() : null;
  if(C) S3.fog.color.copy(OVAL.horLin); else S3.fog.color.copy(OVAL.horLin).convertLinearToSRGB();
  OVAL.sky.position.copy(cam.position); if(OVAL.fx) OVAL.fx.mat.uniforms.uFog.value.copy(OVAL.horLin);
  var ex=renderer.toneMappingExposure; renderer.toneMappingExposure=OVAL.exposure;
  var inf=renderer.info, ar=inf.autoReset; inf.autoReset=false; inf.reset();
  if(C) C.render(); else renderer.render(S3, cam);
  OVAL.stats={calls:inf.render.calls, tris:inf.render.triangles, tier:GFX, shot:OVAL.shot, parts:OVAL.fx?OVAL.fx.P.length:0, cars:OVAL.list.length}; inf.autoReset=ar;
  renderer.toneMappingExposure=ex;
}
function ovalReset(){ if(OVAL.fx) OVAL.fx.clear(); OVAL.shot=null; OVAL.prev={}; OVAL.shake=0; OVAL.cheer=0; OVAL.lane={}; OVAL.snap=true; OVAL.relOn=false; OVAL.lapSeen=0; }
var OVAL_CROWD={decay:0.3, lo:0.4, hi:0.05, f0:7, f1:9, amp:0.16, body:0.35, head:0.83};
function ovalCrowd(dt){ crowdTick(OVAL, dt, OVAL_CROWD); }
function ovalSetFlag(kind){
  if(OVAL.flagKey===kind||!OVAL.flagMesh) return; OVAL.flagKey=kind; var t=OVAL.flagTex[kind]||(OVAL.flagTex[kind]=ovalFlagTex(kind)); OVAL.flagMesh.material.map=t; OVAL.flagMesh.material.needsUpdate=true;
}
/* o: {on, track:{R, ls, w, bank, len}, cars:[{s (total m, + along), v, color, me, num, n, groove, gone, slide (0..1), thr}], pre, done, flag:"green"|"white"|"checker"|"yellow", cam, night, lastLap, toFlag, order:[{num,n,me}], boardHead, cheer, dt} */
function ovalUpdate(o, dt){
  OVAL.venue=(o.track&&o.track.v)?String(o.track.v).toUpperCase():"";   /* the venue's name heads the scoreboard until a race puts HEAT or FEATURE there */
  if(OVAL.board && OVAL.board.v!==OVAL.venue){ OVAL.board.v=OVAL.venue; if(!OVAL.board.key) ovalBoardDraw(OVAL.board.tex,[],""); }
  var T=o.track||{}, G={R:+T.R||52, ls:+T.ls||136.6, w:+T.w||18, bank:+T.bank||0.384, surf:T.surf==="asphalt"?"asphalt":"clay"}; G.L=2*G.ls+2*Math.PI*G.R;
  var gk=[G.R,G.ls,G.w,G.bank,G.surf,GFX].join("|");
  if(!OVAL.built||OVAL.gkey!==gk){ if(OVAL.scene){ OVAL.list.forEach(function(c){ if(c.parent) c.parent.remove(c); }); disposeTree(OVAL.scene); OVAL.composer=null; } OVAL.gkey=gk; buildOvalScene(G); }
  var S3=OVAL.scene; OVAL.t+=dt;
  if(OVAL.night!==!!o.night) ovalSetNight(!!o.night);
  var cars=o.cars||[], ph=o.pre?"pre":o.done?"done":"race";
  if(ph==="pre" && OVAL.prev.ph && OVAL.prev.ph!=="pre") ovalReset();
  for(var kk in OVAL.cars) OVAL.cars[kk].visible=false;
  OVAL.list=cars.map(function(c){ var m=ovalGetCar(c.color); m.visible=!c.gone; return m; });
  ovalLanes(cars, dt);
  var me=cars.find(function(c){ return c.me; })||cars[0], V=null, i;
  for(i=0;i<cars.length;i++){
    var c=cars[i], car=OVAL.list[i], U=car.userData; if(c.gone){ car.visible=false; continue; }
    var d=c.dRender!=null?c.dRender:0; ovalPt(c.s+G.ls/2, d, _oPt);
    var slide=clamp(+c.slide||0,0,1), inT=_oPt.bank>0.12, crab=(inT?0.11:0)+slide*0.16, yaw=_oPt.psi+crab;
    car.position.set(_oPt.x, _oPt.y+0.02, _oPt.z); car.rotation.set(-_oPt.bank*(1-0.0), yaw, 0, "YXZ");
    var steer=(inT?0.2-slide*0.5:0.0); U.steer+=(steer-U.steer)*Math.min(1,dt*8); for(var w=0;w<U.carriers.length;w++){ var Cw=U.carriers[w]; if(!Cw.userData.rear) Cw.rotation.y=U.steer; }
    stripCarAnim(car,{v:Math.max(0,+c.v||0), acc:(+c.thr||0)*3-(+c.brk||0)*6, brake:(+c.brk||0)>0.05, night:!!o.night, lift:0},dt,true);
    var roll=clamp(-(inT?1:0)*0.012-slide*0.02,-0.05,0.05); U.roll+=(roll-U.roll)*Math.min(1,dt*5); U.bodyGroup.rotation.x+=U.roll;
    car.updateMatrixWorld(true);
    /* dust off the rear tyres: more in a slide and on the throttle, thin on Lite */
    var v=Math.max(0,+c.v||0), asph=G.surf==="asphalt", rate=(v>8?(asph?0.04+2.6*slide+1.2*(+c.thr||0)*(+c.spin||0):0.6+3.4*slide+1.0*(+c.thr||0)*(+c.spin||0))*(inT?1.0:0.7)*dt*(v/30)*(GFX==="lite"?18:34):0);
    if(OVAL.fx && rate>0){ var fx=Math.cos(yaw), fz=-Math.sin(yaw); rate*=(c.me?1.1:0.8);
      while(rate>0){ if(rate<1 && Math.random()>rate) break; rate-=1;
        var side=Math.random()<0.5?-1:1, ox=-fx*2.3+(-fz)*side*0.8*-1, oz=-fz*2.3+(fx)*side*0.8*-1;
        OVAL.fx.emit(car.position.x+ox, car.position.y+0.3, car.position.z+oz, (Math.random()-0.5)*1.4-fx*v*0.05, 0.5+Math.random()*0.7, (Math.random()-0.5)*1.4-fz*v*0.05, 1.7+Math.random()*0.9, 0.7, 3.6+slide*2.4, asph?0.8:0.56, asph?0.8:0.46, asph?0.82:0.35, asph?0.2+0.1*slide:0.26+0.12*slide, {drag:0.55, buoy:0.12}); } }
    if(c.me) V=car;
  }
  if(!V) V=OVAL.list[0];
  if(OVAL.fx) OVAL.fx.step(dt, OVAL_WIND);
  if(+o.cheer>0) OVAL.cheer=Math.max(OVAL.cheer,+o.cheer);
  if(ph==="done" && OVAL.prev.ph==="race") OVAL.cheer=2.4;
  ovalCrowd(dt);
  ovalSetFlag(o.flag||"green");
  if(OVAL.flagMesh){ OVAL.flagMesh.rotation.z=Math.sin(OVAL.t*(o.flag==="checker"?9:5))*0.2; OVAL.flagMesh.rotation.y=Math.sin(OVAL.t*3)*0.25; }
  /* the board: top twelve, redrawn when the order changes (twice a second at most) */
  if(OVAL.board && o.order){ var key=o.order.map(function(r){ return r.num+(r.me?"*":""); }).join(",")+"|"+(o.boardHead||""); if(key!==OVAL.board.key && OVAL.t-(OVAL.board.t||0)>0.4){ OVAL.board.key=key; OVAL.board.t=OVAL.t; ovalBoardDraw(OVAL.board.tex,o.order,o.boardHead); } }
  if(V) ovalDirect(o, dt, me, V);
  var cc=_oC.copy(OVAL.camPos).lerp(OVAL.camTgt,0.6); cc.y=0;
  OVAL.sun.position.copy(cc).addScaledVector(OVAL.sunDir,120); OVAL.sun.target.position.copy(cc); OVAL.sun.target.updateMatrixWorld();
  if(OVAL.flood.intensity>0){ OVAL.flood.position.set(cc.x-20,60,cc.z+40); OVAL.flood.target.position.copy(cc); OVAL.flood.target.updateMatrixWorld(); }
  if(OVAL.spots.length){ var poles=OVAL.poles.slice().sort(function(a,b){ return a.distanceToSquared(cc)-b.distanceToSquared(cc); });
    OVAL.spots.forEach(function(sp,j){ var pp=poles[j]; if(!pp) return; sp.position.copy(pp); sp.target.position.set(cc.x,0,cc.z); sp.target.updateMatrixWorld(); }); }
  OVAL.prev={ph:ph};
}
;({roadRender:roadRender,hillRender:hillRender,ovalRender:ovalRender,saltRender:saltRender,bogRender:bogRender,boatRender:boatRender,pullRender:pullRender,stripPostStep:stripPostStep,stripRender:stripRender,pitsRender:pitsRender,_sbP:_sbP,_sbS:_sbS,stripBandRead:stripBandRead,saltBandRead:saltBandRead,stripPostEnd:stripPostEnd,stripReset:stripReset,buildStripScene:buildStripScene,stripUpdate:stripUpdate,stripPostStart:stripPostStart,stripPostLeft:stripPostLeft,stripPostLeave:stripPostLeave,stripPostEnter:stripPostEnter,pitsUpdate:pitsUpdate,pitsAnchors:pitsAnchors,pullReset:pullReset,buildPullScene:buildPullScene,pullUpdate:pullUpdate,bogReset:bogReset,buildBogScene:buildBogScene,bogUpdate:bogUpdate,boatReset:boatReset,buildBoatScene:buildBoatScene,boatUpdate:boatUpdate,roadFieldHide:roadFieldHide,roadUpdate:roadUpdate,hillUpdate:hillUpdate,ovalUpdate:ovalUpdate,saltReset:saltReset,buildSaltScene:buildSaltScene,saltRebuild:saltRebuild,saltUpdate:saltUpdate,saltRivalLook:saltRivalLook,saltSetLook:saltSetLook})
//# sourceURL=scenes.js
