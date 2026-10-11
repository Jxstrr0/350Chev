/* ===========================================================================
   DRAG STRIP SCENE — a second world the view cuts to during a pass.
   Units are metres. x = distance down the track (start line 0, 1/4 mile 402.336),
   player in the near/right lane (z +2.5), rival in the far/left lane (z −2.5).
   Static scenery is merged into a handful of vertex-coloured meshes; the track
   and the prairie are procedural shaders (crisp at any distance, 1 draw each);
   smoke/flames are two instanced billboard systems (1 draw each).
   ==========================================================================*/
var STRIP={ on:false, scene:null, cam:null, built:false, sun:null, hemi:null, cars:{}, tree:null, smoke:[], lastX:0,
  camPos:new THREE.Vector3(), camTgt:new THREE.Vector3(), t:0,
  shot:null, shotT:0, cutT:9, runT:0, shake:0, cheer:0, night:null, tier:null, prev:{},
  fx:null, fxAdd:null, marks:null, board:null, tm:null, sky:null, env:{}, spots:[], poles:[], mats:{}, composer:null, heatPass:null,
  flash:null, fog:null, crowd:null, halos:[], exposure:0.95 };
var STRIP_TRACK_END=780, STRIP_Q=402.336, STRIP_LANE=2.5;
/* v2 world: uniforms shared by the track and crowd shaders (time, midday mirage, fresh burnout shine per lane, water-box ripples, lit stands) */
var STRIP_U={ uTime:{value:0}, uHaze:{value:0}, uShine:{value:new THREE.Vector2()}, uRip:{value:0}, uHorC:{value:new THREE.Color(0.52,0.6,0.7)}, uCrowdLit:{value:0} };
var STRIP_SUN_DAY=new THREE.Vector3(-0.55,0.36,0.75).normalize(), STRIP_MOON=new THREE.Vector3(0.45,0.42,-0.78).normalize();
var STRIP_HOR=[0.52,0.60,0.70], STRIP_HOR_N=[0.016,0.019,0.03], STRIP_HOR_D=[0.2,0.1,0.1];
var STRIP_SUN_DUSK=new THREE.Vector3(0.86,0.03,-0.5).normalize(), STRIP_DUSK_LIGHT=new THREE.Vector3(0.82,0.2,-0.54).normalize();
function stripMat(c, r, m){ return new THREE.MeshStandardMaterial({color:c, roughness:r===undefined?0.7:r, metalness:m||0}); }
function stripBox(w,h,d,mat,x,y,z){ var mm=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat); mm.position.set(x,y,z); mm.castShadow=true; mm.receiveShadow=true; return mm; }
function stripLabel(txt, w, h){ var c=document.createElement("canvas"); c.width=256; c.height=96; var x=c.getContext("2d"); x.fillStyle="#f4efe2"; x.fillRect(0,0,256,96); x.fillStyle="#1a1a1a"; x.font="bold 54px 'Barlow Condensed','Arial Narrow',sans-serif"; x.textAlign="center"; x.textBaseline="middle"; x.fillText(txt,128,50);
  var t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; var m=new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshStandardMaterial({map:t, roughness:0.8})); return m; }

/* --- static batch: collect unit primitives with a transform + colour, merge per material key --- */
var SB_GEO=null;
function sbGeo(){
  if(SB_GEO) return SB_GEO;
  SB_GEO={ box:new THREE.BoxGeometry(1,1,1).toNonIndexed(), cyl:new THREE.CylinderGeometry(0.5,0.5,1,10).toNonIndexed(), cyl6:new THREE.CylinderGeometry(0.5,0.5,1,6).toNonIndexed(),
    cone:new THREE.CylinderGeometry(0,0.5,1,4).toNonIndexed(), plane:new THREE.PlaneGeometry(1,1).toNonIndexed(), prism:null, beam:new THREE.CylinderGeometry(0.08,0.5,1,12,1,true).toNonIndexed(), tcone:new THREE.CylinderGeometry(0.11,0.5,1,12).toNonIndexed() };
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
var STRIP_GLSL_TRACK=[
  "uniform float uTime; uniform float uHaze; uniform vec2 uShine; uniform float uRip; uniform vec3 uHorC;",
  "float gWet=0.0, gMir=0.0; vec2 gRip=vec2(0.0);",
  "vec3 stripSurf(vec3 w, out float rough){",
  "  float x=w.x, z=w.z, az=abs(z); float d=length(w-cameraPosition);",
  "  float fine=1.0-smoothstep(20.0,80.0,d), mid=1.0-smoothstep(60.0,260.0,d);",
  "  float n1=sn(w.xz*vec2(0.21,0.7)), n2=sn(w.xz*2.7), n3=sn(w.xz*13.0);",
  "  float conc=smoothstep(-17.0,-16.0,x)*(1.0-smoothstep(196.0,204.0,x));",
  "  vec3 asph=vec3(0.062,0.063,0.067)*(0.78+0.38*n1)+(n3-0.5)*0.035*fine;",
  "  vec3 cr=vec3(0.19,0.187,0.178)*(0.86+0.2*n1+(n2-0.5)*0.12*fine);",
  "  float jx=abs(fract(x/4.57+0.5)-0.5)*4.57, jz=abs(fract((z+7.5)/3.75+0.5)-0.5)*3.75;",
  "  cr*=1.0-0.4*max(1.0-smoothstep(0.012,0.04,jx),1.0-smoothstep(0.012,0.04,jz))*(1.0-smoothstep(12.0,55.0,d));",
  "  vec3 c=mix(asph,cr,conc); rough=mix(0.9,0.8,conc);",
  "  float lc=z>0.0?2.5:-2.5; float dz=abs(z-lc);",
  "  float tyre=exp(-pow((dz-0.82)/0.30,2.0)), broad=exp(-pow(dz/1.45,2.0));",
  "  float fx=smoothstep(-4.8,-3.6,x);",
  "  float launch=fx*(0.9*exp(-max(x,0.0)/80.0)+0.38*exp(-max(x,0.0)/520.0))*(1.0-smoothstep(640.0,700.0,x));",
  "  float streak=0.7+0.3*sn(vec2(x*0.5,dz*20.0))*mid+0.15*(1.0-mid);",
  "  float rub=clamp(tyre*launch*1.35*streak+broad*launch*0.55,0.0,0.95);",
  "  float bo=smoothstep(-5.6,-4.8,x)*(1.0-smoothstep(-0.4,0.6,x))*tyre*(0.55+0.45*sn(vec2(x*2.5,dz*28.0)));",
  "  rub=max(rub,bo*0.97);",
  "  c=mix(c,vec3(0.018,0.018,0.02),rub); rough=mix(rough,0.55,rub);",
  "  float vht=fx*(1.0-smoothstep(45.0,140.0,x))*clamp(0.6*broad+0.5*tyre,0.0,1.0)*(0.8+0.2*n1);",
  "  c=mix(c,vec3(0.026,0.021,0.016),vht*0.4); rough=mix(rough,0.24,vht*0.9);",
  "  float shn=(z>0.0?uShine.x:uShine.y)*smoothstep(-6.4,-5.4,x)*(1.0-smoothstep(0.5,7.0,x))*tyre*(0.55+0.45*sn(vec2(x*1.1,dz*36.0)));",
  "  c=mix(c,vec3(0.01,0.01,0.011),shn*0.7); rough=mix(rough,0.1,shn);",
  "  float wb=smoothstep(-15.2,-14.6,x)*(1.0-smoothstep(-5.6,-5.0,x))*(1.0-smoothstep(1.75,2.05,dz));",
  "  float wtr=smoothstep(-5.8,-5.0,x)*(1.0-smoothstep(-4.5,1.5,x))*tyre;",
  "  float wet=max(wb*(0.8+0.2*n2),wtr*0.85);",
  "  c*=1.0-0.62*wet; rough=mix(rough,0.06,wet);",
  "  float pool=wb*smoothstep(0.56,0.64,sn(w.xz*vec2(0.8,1.5)+3.0)+0.18*n2);",
  "  c*=1.0-0.3*pool; rough=mix(rough,0.02,pool); gWet=max(wet,pool);",
  "  if(gWet>0.0){ vec2 q=w.xz*6.0; float t=uTime; gRip=vec2(sin(q.x+t*3.3+sn(q*0.6)*6.0), sin(q.y*1.3-t*2.6+sn(q*0.45+3.0)*6.0))*(0.03+0.16*uRip)*gWet; }",
  "  if(uHaze>0.0){ vec3 vd=normalize(w-cameraPosition); float graze=1.0-smoothstep(0.004,0.032,-vd.y);",
  "    float far=smoothstep(60.0,200.0,d)*(1.0-smoothstep(900.0,1500.0,d));",
  "    float wob=0.7*sn(vec2(x*0.045-uTime*0.9,z*0.35+uTime*0.3))+0.3*sn(vec2(x*0.14+uTime*1.7,z*0.8));",
  "    gMir=uHaze*graze*far*smoothstep(0.38,0.72,wob); c*=1.0-0.85*gMir; rough=mix(rough,0.9,gMir); }",
  "  float ln=1.0-smoothstep(0.05,0.075,abs(x));",
  "  ln=max(ln,(1.0-smoothstep(0.13,0.16,abs(x-402.336)))*(0.75+0.25*step(0.5,fract(z*1.0))));",
  "  ln=max(ln,(1.0-smoothstep(0.05,0.075,abs(az-6.95)))*step(-40.0,x));",
  "  float st=(1.0-smoothstep(0.04,0.06,abs(x+0.18)))*(1.0-smoothstep(1.9,2.0,dz))*0.6;",
  "  ln=max(ln,st*step(0.5,fract(dz*2.5)));",
  "  c=mix(c,vec3(0.74,0.73,0.69),ln*(1.0-rub*0.5));",
  "  float cl=(1.0-smoothstep(0.05,0.075,az))*smoothstep(-2.0,-1.0,x);",
  "  c=mix(c,vec3(0.78,0.52,0.06),cl);",
  "  return c; }"].join("\n");
var STRIP_GLSL_GROUND=[
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
  "  vec3 c=mix(fc,grass,inf);",
  "  float rr=(1.0-smoothstep(2.7,3.0,abs(p.y-13.5)))*smoothstep(-95.0,-90.0,p.x)*(1.0-smoothstep(775.0,780.0,p.x));",
  "  c=mix(c,vec3(0.07,0.07,0.075)*(0.85+0.3*sn(p*0.4)),rr);",
  "  float pit=smoothstep(-140.0,-135.0,p.x)*(1.0-smoothstep(135.0,140.0,p.x))*smoothstep(17.0,18.0,p.y)*(1.0-smoothstep(54.0,55.0,p.y));",
  "  c=mix(c,vec3(0.25,0.23,0.20)*(0.8+0.4*sn(p*1.1)),pit);",
  "  float sp=(1.0-smoothstep(7.4,8.2,abs(p.y)))*smoothstep(-80.0,-75.0,p.x)*(1.0-smoothstep(785.0,790.0,p.x));",
  "  c=mix(c,vec3(0.2,0.19,0.17),sp);",
  "  rough=0.96; return c; }"].join("\n");
var STRIP_TRACK_POST={ normal:"normal=normalize(normal+(viewMatrix*vec4(gRip.x,0.0,gRip.y,0.0)).xyz);", emissive:"totalEmissiveRadiance+=uHorC*gMir;" };
function stripSurfMat(glsl, extra, uni, post){
  var m=new THREE.MeshStandardMaterial(Object.assign({color:0xffffff, roughness:0.9, metalness:0}, extra||{}));
  m.onBeforeCompile=function(sh){
    if(uni) for(var uk in uni) sh.uniforms[uk]=uni[uk];
    if(post){ if(post.normal) sh.fragmentShader=sh.fragmentShader.replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n"+post.normal);
      if(post.emissive) sh.fragmentShader=sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n"+post.emissive); }
    sh.vertexShader=sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWp;").replace("#include <project_vertex>", "#include <project_vertex>\nvWp=(modelMatrix*vec4(transformed,1.0)).xyz;");
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWp;\nfloat gRough;\n"+STRIP_GLSL_NOISE+"\n"+glsl)
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb*=stripSurf(vWp,gRough);")
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor=gRough;");
  };
  m.customProgramCacheKey=function(){ return "strip_"+glsl.length; };
  return m;
}

/* --- sky dome: gradient, sun, prairie cumulus; night: stars, moon, town glow on the horizon --- */
function stripSkyMat(){
  return new THREE.ShaderMaterial({ uniforms:{ uSun:{value:STRIP_SUN_DAY.clone()}, uMoon:{value:STRIP_MOON.clone()}, uNight:{value:0}, uGain:{value:1}, uHor:{value:new THREE.Vector3().fromArray(STRIP_HOR)}, uHorN:{value:new THREE.Vector3().fromArray(STRIP_HOR_N)}, uDusk:{value:0}, uDuskSun:{value:STRIP_SUN_DUSK.clone()} },
    vertexShader:"varying vec3 vDir; void main(){ vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
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
  panel(0,0,340,64,"#1d4787","#f4f1e8","PRAIRIE BLUE",42,"#d9a52b");
  panel(342,0,340,64,"#e5701f","#141414","COULEE FUELS",42,"#141414");
  panel(684,0,340,64,"#131416","#f2c22c","NORTHWIND TYRE",40,"#f2c22c");
  /* row 1: long raceway sign */
  panel(0,66,1024,62,"#f1ede2","#1d4787","PRAIRIE BLUE RACEWAY · SASKATOON",46,"#1d4787");
  /* row 2: finish checker + second-tier banners */
  for(var i=0;i<32;i++) for(var j=0;j<4;j++){ x.fillStyle=((i+j)&1)?"#111":"#f2f2f2"; x.fillRect(i*16, 130+j*16, 16,16); }
  panel(512,130,256,64,"#b7261d","#f4f1e8","PRAIRIE FIRE",34);
  panel(768,130,256,64,"#2c6b3a","#f4f1e8","HALCYON GT",36);
  /* row 3: marker boards 5 × 204×120 */
  var mk=["60 FT","330","1/8","1000","1/4"];
  for(i=0;i<5;i++){ var bx=i*205; x.fillStyle="#1a1a1a"; x.fillRect(bx,196,203,122); x.fillStyle="#f4efe2"; x.fillRect(bx+6,202,191,110); x.fillStyle="#141414"; x.font="700 "+(mk[i].length>4?66:78)+"px "+F; x.textAlign="center"; x.textBaseline="middle"; x.fillText(mk[i], bx+101, 260); }
  /* row 4: hauler liveries 512×120 ×2 */
  panel(0,322,510,120,"#e9e6dc","#1d4787","PRAIRIE BLUE RACING",50,"#d9a52b");
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
  var sky=new THREE.Mesh(new THREE.SphereGeometry(3000, 40, 20), stripSkyMat()); sky.frustumCulled=false; sky.renderOrder=-10; S2.add(sky); STRIP.sky=sky;
  S2.fog=new THREE.Fog(0xffffff, 170, 3400); STRIP.fog=S2.fog;
  var ground=new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), stripSurfMat(STRIP_GLSL_GROUND)); ground.rotation.x=-PI/2; ground.position.set(350,-0.03,0); ground.receiveShadow=true; S2.add(ground);
  var trackW=15, trackL=STRIP_TRACK_END+80;
  var track=new THREE.Mesh(new THREE.PlaneGeometry(trackL, trackW), stripSurfMat(STRIP_GLSL_TRACK, null, STRIP_U, STRIP_TRACK_POST)); track.rotation.x=-PI/2; track.position.set(-80+trackL/2, 0, 0); track.receiveShadow=true; S2.add(track);
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

  /* guardwalls + sponsor panels + catch fence */
  for(side=-1; side<=1; side+=2){
    var wz=side*7.78, x0=-75, x1=STRIP_TRACK_END;
    B.box("solid", (x0+x1)/2, 0.53, wz, x1-x0, 1.06, 0.56, CONC);
    B.box("solid", (x0+x1)/2, 1.075, wz, x1-x0, 0.05, 0.4, CONC2);
    for(x=-60, k=0; x<x1-10; x+=8.5, k++){
      var pick=((k*7+(side>0?1:0)*3)%5); var uvr=STRIP_UV.ban[pick];
      B.add("sign","plane",[x, 0.56, side*7.495],[5.4,0.82,1],0xffffff,[0, side>0?PI:0, 0],uvr); }
    /* catch fence along the launch half on both sides */
    var fx0=-40, fx1=440;
    for(x=fx0; x<=fx1; x+=10) B.add("metal","cyl6",[x, 2.3, side*7.9],[0.07,2.5,0.07],STEEL);
    B.box("metal", (fx0+fx1)/2, 3.55, side*7.9, fx1-fx0, 0.05, 0.05, STEEL);
    var fence=new THREE.Mesh(new THREE.PlaneGeometry(fx1-fx0, 2.45), M.fence); fence.position.set((fx0+fx1)/2, 2.32, side*7.9); M.fence.map.repeat.set((fx1-fx0)/0.9, 2.45/0.9); S2.add(fence);
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
    B.box("solid", -10, 0.05, lzc+2.3, 10, 0.1, 0.12, 0xd9d4c6); B.box("solid", -10, 0.05, lzc-2.3, 10, 0.1, 0.12, 0xd9d4c6);
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
  /* pits on the near side: haulers, pickups, canopies */
  var hcol=[0xe9e6dc,0x1b1d20,0x9e2a22,0x22488f,0xd0d3d6,0x2c6b3a], rng=function(s){ var t=Math.sin(s*127.1)*43758.5453; return t-Math.floor(t); };
  for(i=0;i<9;i++){ var hx=-120+i*27+rng(i)*8, hz=24+rng(i+9)*16, liv=i%3===0?0:i%3===1?1:-1;
    B.box("solid", hx, 2.1, hz, 14, 3.4, 2.6, hcol[i%hcol.length]); B.box("solid", hx+8.6, 1.6, hz, 3.0, 2.6, 2.5, hcol[(i+2)%hcol.length]); B.box("solid", hx, 0.3, hz, 14, 0.5, 2.3, 0x1c1d1f);
    if(liv>=0) B.add("sign","plane",[hx, 2.3, hz-1.31],[9,2.1,1],0xffffff,[0,PI,0],STRIP_UV.haul[liv]);
    B.box("solid", hx+2, 1.2, hz-5.5, 4.8, 1.3, 2.0, hcol[(i+4)%hcol.length]); B.box("solid", hx+1.6, 2.1, hz-5.5, 2.2, 0.7, 1.8, 0x22262b);
    if(i%2===0){ B.box("solid", hx-3, 2.9, hz-7.5, 4, 0.08, 4, hcol[(i+1)%hcol.length]); for(k=0;k<4;k++) B.box("metal", hx-4.9+(k>>1)*3.8, 1.45, hz-9.4+(k&1)*3.8, 0.06, 2.9, 0.06, STEEL); } }
  /* bleacher + fence near the finish on the near side */
  for(i=0;i<5;i++){ B.box("solid", 300, 0.25+i*0.28, 10.5+i*0.75, 60, 0.5+i*0.56, 0.75, i%2?0xb8b2a4:0xc4beb0); }
  /* scoreboard frames near the stripe (boards themselves are dynamic) */
  for(side=-1; side<=1; side+=2){ var sbx=STRIP_Q+26, sbz=side*10.8, ry2=side<0?-PI/2+0.55:-PI/2-0.55;
    B.box("metal", sbx+1.0, 3.3, sbz-2.4, 0.35, 6.6, 0.35, STEEL); B.box("metal", sbx+1.0, 3.3, sbz+2.4, 0.35, 6.6, 0.35, STEEL);
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
  /* build the merged meshes */
  B.build("solid", M.solid, true); B.build("metal", M.metal, true); STRIP.lampMesh=B.build("lamp", M.lamp, false); B.build("sign", M.sign, true);
  STRIP.beamMesh=B.build("beam", M.beam, false); if(STRIP.beamMesh){ STRIP.beamMesh.receiveShadow=false; STRIP.beamMesh.visible=false; STRIP.beamMesh.renderOrder=4; }

  /* shelterbelts: instanced low-poly trees around the yards and along the mile roads */
  (function(){ var pts=[], s;
    var belts=[[520,-340,0.2],[-180,-520,-0.4],[900,380,0.7],[150,620,0.1],[1180,-210,0.3],[-760,-420,-0.5]];
    belts.forEach(function(b,bi){ for(var q=0;q<26;q++){ var a=b[2], along=-30+q*4.2, off=-28+rng(bi*50+q)*3; if(q>=14){ along=-30+(q-14)*5; off=40+rng(q*3+bi)*3; }
      pts.push([b[0]+along*Math.cos(a)-off*Math.sin(a), b[1]+along*Math.sin(a)+off*Math.cos(a), 4+rng(q+bi*7)*3]); } });
    for(s=0;s<60;s++){ pts.push([-600+s*32+rng(s)*10, -1207+rng(s+3)*6, 3+rng(s+5)*2.5]); pts.push([-400+s*30, 1210+rng(s+8)*6, 3+rng(s+2)*2.5]); }
    var im=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0), new THREE.MeshStandardMaterial({roughness:1, color:0xffffff}), pts.length), mm=new THREE.Matrix4(), cc=new THREE.Color();
    pts.forEach(function(p,q){ var h=p[2]*1.6; mm.compose(_sbP.set(p[0],h*0.8,p[1]), _sbQ.set(0,0,0,1), _sbS.set(p[2],h,p[2])); im.setMatrixAt(q,mm); cc.setHSL(0.24+rng(q)*0.06, 0.45, 0.13+rng(q+1)*0.06).convertSRGBToLinear(); im.setColorAt(q,cc); });
    im.castShadow=false; im.receiveShadow=false; S2.add(im); })();

  /* crowd: instanced bodies + heads on the grandstand rows (and a thin line on the near bleacher) */
  (function(){ var ppl=[], s, r2;
    for(r2=0;r2<rows;r2++){ for(x=GX0+0.6; x<GX1-0.5; x+=0.62){ if(rng(x*3.1+r2*17.7)<0.38) continue; ppl.push([x+(rng(x+r2)-0.5)*0.2, 0.45+r2*0.46+0.12, -9.6-r2*0.9-0.1]); } }
    for(r2=0;r2<5;r2++){ for(x=272; x<328; x+=0.7){ if(rng(x*1.7+r2*5.3)<0.55) continue; ppl.push([x, 0.25+r2*0.56+0.12, 10.5+r2*0.75]); } }
    var n=ppl.length, bodyM=new THREE.InstancedMesh(new THREE.BoxGeometry(0.46,0.62,0.34), new THREE.MeshStandardMaterial({roughness:0.95}), n),
        headM=new THREE.InstancedMesh(new THREE.BoxGeometry(0.22,0.25,0.22), new THREE.MeshStandardMaterial({roughness:0.9}), n);
    var shirts=[0x9c3a30,0x34598f,0xcfccc4,0x1f2023,0x2a2c30,0xb7652a,0x44684a,0xc8a640,0x5d5f66,0x7a7f86,0x3a3d44,0x8f4a5e], skin=[0xe0b494,0xc68a64,0x8d5a3b,0xf0c9a8,0x5a3a26], hats=[0x1d4787,0xb7261d,0x222222,0xe9e6dc,0x2c6b3a];
    var mm=new THREE.Matrix4(), cc=new THREE.Color(); var base=[];
    for(s=0;s<n;s++){ var p=ppl[s]; mm.makeTranslation(p[0],p[1]+0.31,p[2]); bodyM.setMatrixAt(s,mm); mm.makeTranslation(p[0],p[1]+0.75,p[2]); headM.setMatrixAt(s,mm);
      cc.set(shirts[Math.floor(rng(s*1.3)*shirts.length)]).convertSRGBToLinear(); bodyM.setColorAt(s,cc);
      cc.set(rng(s*2.9)<0.35?hats[Math.floor(rng(s*4.1)*hats.length)]:skin[Math.floor(rng(s*3.7)*skin.length)]).convertSRGBToLinear(); headM.setColorAt(s,cc); base.push(p); }
    bodyM.castShadow=false; headM.castShadow=false; bodyM.receiveShadow=true; S2.add(bodyM); S2.add(headM);
    STRIP.crowd={body:bodyM, head:headM, base:base, n:n, phase:base.map(function(p,q){ return rng(q*9.1)*TAU; }), excite:base.map(function(p,q){ return rng(q*5.3); }), live:false};
    stripCrowdLit(bodyM.material); stripCrowdLit(headM.material); STRIP.crowd.col=bodyM.instanceColor.array.slice(); STRIP.crowd.cw=new Float32Array(n); STRIP.crowd.wy=new Float32Array(n); })();

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

  STRIP.cam=new THREE.PerspectiveCamera(46, 1, 0.3, 4200); STRIP.built=true;
  STRIP.night=null; stripSetNight(false);
}
