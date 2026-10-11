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
function stripSmoke(x,z,v){ if(STRIP.fx) STRIP.fx.emit(x,0.5,z,-v*0.15-1,0.9,(Math.random()-0.5)*1.2,1.4,1.2,4.7,0.8,0.8,0.8,0.5); }

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
  var txt=hon?"WON THE NIGHT":X.round?String(X.round):"PRAIRIE BLUE RACEWAY", key=txt+"|"+hon;
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
  if(STRIP.beamMesh){ STRIP.beamMesh.visible=on; M.beam.opacity=on?0.012:0; }
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
    STRIP.spots[1].castShadow=false; }   /* v2: spots 0/1 are the cars' keys (stripKeySpots); only the player's casts a shadow */
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
  u._tips=(u.exhaustTips&&u.exhaustTips.length)? u.exhaustTips.map(function(t){ return t.clone(); }) : [new THREE.Vector3(bb.min.x+0.1, Math.max(0.3,rr*0.9), 0.45), new THREE.Vector3(bb.min.x+0.1, Math.max(0.3,rr*0.9), -0.45)];
  u._dirs=u._tips.map(function(t,k){ if(u.exhaustDirs&&u.exhaustDirs[k]) return u.exhaustDirs[k].clone().normalize();
    var sz=t.z>=0?1:-1; if(t.y>bb.max.y*0.8 && t.y>1.1) return new THREE.Vector3(-0.35,0.9,sz*0.15).normalize();
    if(Math.abs(t.z)>(bb.max.z-bb.min.z)*0.38 && t.x>bb.min.x+0.6) return new THREE.Vector3(-0.35,0.12,sz*0.93).normalize();
    return new THREE.Vector3(-1,0.14,sz*0.08).normalize(); });
  u._eng=u.enginePos? u.enginePos.clone() : (u.body==="rail" ? new THREE.Vector3(bb.min.x+(bb.max.x-bb.min.x)*0.3, bb.max.y*0.7, 0) : new THREE.Vector3(bb.max.x-(bb.max.x-bb.min.x)*0.24, bb.max.y*0.72, 0));
  u._chuteA=u.chuteAnchor? u.chuteAnchor.clone() : new THREE.Vector3(bb.min.x-0.3, bb.max.y*0.5, 0);
  u._len=bb.max.x-bb.min.x; u._bbMinX=bb.min.x; u._markLast=[]; u._acc=0; u._markT=0;
  var me=u.meta||{}; u._gates=(me.gates||[]).map(function(q){ return {p:q.p.clone(), d:q.d.clone()}; }); u._hat=me.hat?me.hat.clone():null; u._ex=null;
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
  var u=car.userData; if(u._hdr!==undefined) return u._hdr;
  var me=u.meta||{}, A=u.anim, off=(A&&A.anchorRest&&me.anchor)?A.anchorRest.clone().sub(me.anchor):new THREE.Vector3(), L=null;
  if(me.headers && me.headers.length) L=me.headers.map(function(h){ return {p:h.p.clone().add(off), d:h.d.clone().normalize()}; });
  else if((u.body==="rail"||u.body==="funny") && u._tips) L=u._tips.map(function(p,k){ return {p:p.clone(), d:u._dirs[k].clone()}; });
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
        var ln=(E.al0?1.7:1.1)+Math.random()*0.6;
        stripCone(FA, FF, _sfA, _sfD, v*0.9, ln, E.al0?0.32:0.24, 1.0, 0.55, 0.18, 1.15, lite);
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
/* --- crowd gets up for the launch and the finish --- */
var _crM=new THREE.Matrix4();
function stripCrowd(dt){
  var C=STRIP.crowd; if(!C) return; STRIP.cheer=Math.max(0,STRIP.cheer-dt*0.28);
  if(STRIP.cheer<0.02 && !C.live && !C.wave) return;
  var t=STRIP.t, amp=STRIP.cheer, i;
  for(i=0;i<C.n;i++){ var p=C.base[i], e=C.excite[i], y=amp>0.02&&e>(amp>1?0.04:0.3)?Math.abs(Math.sin(t*(amp>1?10:8)+C.phase[i]))*0.18*Math.min(amp,2)*e:0;
    if(C.wave) y+=C.wy[i];
    _crM.makeTranslation(p[0],p[1]+0.31+y,p[2]); C.body.setMatrixAt(i,_crM); _crM.makeTranslation(p[0],p[1]+0.75+y*1.15,p[2]); C.head.setMatrixAt(i,_crM); }
  C.body.instanceMatrix.needsUpdate=true; C.head.instanceMatrix.needsUpdate=true; C.live=STRIP.cheer>=0.02||!!C.wave;
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
/* the lit stands: each person glows in their own colour a little under the canopy lights */
function stripCrowdLit(m){
  m.onBeforeCompile=function(sh){ sh.uniforms.uCrowdLit=STRIP_U.uCrowdLit;
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uCrowdLit;").replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*uCrowdLit;"); };
  m.customProgramCacheKey=function(){ return "stripCrowdLit"; };
}
/* the crowd colour wave (the final, and won the night): cards up in a band that runs along the stands */
var STRIP_CARDS=[0x1d4787,0xd9a52b,0xf3efe4].map(function(h){ return new THREE.Color(h).convertSRGBToLinear(); }), _wvC=new THREE.Color();
function stripWave(t, off){
  var C=STRIP.crowd; if(!C||!C.col) return; var n=C.n, i, col=C.body.instanceColor.array, base=C.col, wx=t*24, dirty=false;
  for(i=0;i<n;i++){ var p=C.base[i], xx=p[2]<0?p[0]:(p[0]-272)*2.6-8, dx=((xx-wx)%75+112.5)%75-37.5, b=off?0:Math.exp(-dx*dx/14);   /* two bands, 75 m apart */
    C.wy[i]=0.36*b;
    if(b>0.004 || C.cw[i]>0){ var row=p[2]<0?Math.round((p[1]-0.57)/0.46):Math.round((p[1]-0.37)/0.56), cc=STRIP_CARDS[(row+(xx>60?1:0))%3];
      col[i*3]=base[i*3]+(cc.r-base[i*3])*b; col[i*3+1]=base[i*3+1]+(cc.g-base[i*3+1])*b; col[i*3+2]=base[i*3+2]+(cc.b-base[i*3+2])*b; C.cw[i]=b>0.004?b:0; dirty=true; } }
  if(dirty) C.body.instanceColor.needsUpdate=true;
  if(off){ C.live=true; }   /* one more stripCrowd pass puts everyone back down */
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
function stripCut(name){ if(STRIP.shot!==name){ STRIP.shot=name; STRIP.shotT=0; STRIP.cutT=0; STRIP.snap=true; } }
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
  stripCut(s);
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
  STRIP.shake*=Math.exp(-dt*3.2); var sh=STRIP.shake;
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
  var sz=renderer.getSize(new THREE.Vector2()), pr=renderer.getPixelRatio(), C=STRIP.composer;
  if(!C){ try{ C=new THREE.EffectComposer(renderer); C.addPass(new THREE.RenderPass(STRIP.scene, STRIP.cam));
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
  if(o.body && (!STRIP.cars.p || STRIP.cars.p.userData.body!==o.body || STRIP.cars.pcolor!==o.color || STRIP.cars.ptyre!==o.tyreIn || CS.bHw!==hwK || CS.bOp!==opK || CS.bLite!==liteK)){
    if(STRIP.cars.p) S2.remove(STRIP.cars.p); if(STRIP.cars.o) S2.remove(STRIP.cars.o);
    STRIP.cars.p=stripCar(o.body, o.color||0xa32a26, o.tyreIn, o.hw); stripCarMeta(STRIP.cars.p); stripContact(STRIP.cars.p); STRIP.cars.p.position.z=STRIP_LANE; S2.add(STRIP.cars.p); STRIP.cars.pcolor=o.color; STRIP.cars.ptyre=o.tyreIn;
    var op=o.opp||{};
    STRIP.cars.o=stripCar(op.body||o.body, op.color!=null?op.color:0x3a3f46, op.tyreIn||(op.body&&op.body!==o.body?undefined:o.tyreIn), op.hw); stripCarMeta(STRIP.cars.o); stripContact(STRIP.cars.o);   /* op.body: the rival's own class (fix pack plumbing) */ STRIP.cars.o.position.z=-STRIP_LANE; STRIP.cars.o.visible=!!o.race; S2.add(STRIP.cars.o);
    CS.bHw=hwK; CS.bOp=opK; CS.bLite=liteK;
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

