/* ===========================================================================
   MUD BOG FX — the bog's own mud: lit clods stretched along their flight and soft spray (one instanced draw call),
   mud sheets (the rooster-tail fans behind the rear tyres, the wall thrown up at pit entry, the bow-wave mound
   ahead of the front tyres: one dynamic mesh, Full/Ultra), mud splats on the rail, banners and front rows (Full/Ultra),
   mud on the lens of a low camera (Full/Ultra) and the mud coat on the truck: every MeshStandardMaterial on the
   truck is swapped for a per-truck clone with a splatter mask that builds from the bottom up (lugs pack on the tyres).
   Fed from bogEffects / bogUpdate in vis/bog.js; nothing here touches the sim.
   ==========================================================================*/
var BOGFX={ sheet:null, decal:null, decN:0, decI:0, lens:null, lensP:[], crown:null, splatTex:null, puffTex:null, sheetTex:null, mudKey:"",
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
  for(i=0;i<260;i++){ var px=R()*W, py=R()*H, rw=1+R()*4.5, rh=rw*(2+R()*6), sh=150+Math.floor(R()*105), al=0.5+R()*0.5;
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
    if(p.y<0.03){ if(p.kind===0 && p.vy<0) continue; p.y=0.03; if(p.vy<0) p.vy=0; }
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
  var m=new THREE.MeshStandardMaterial({color:0x3a2a1c, map:BOGFX.sheetTex, transparent:true, depthWrite:false, side:THREE.DoubleSide, roughness:0.5, metalness:0, envMapIntensity:0.22});
  m.onBeforeCompile=function(sh){
    sh.vertexShader="attribute float aA; attribute float aE; varying float vMA; varying float vME;\n"+sh.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\n vMA=aA; vME=aE;");
    sh.fragmentShader="varying float vMA; varying float vME;\n"+sh.fragmentShader.replace("#include <map_fragment>",
      "#ifdef USE_MAP\n vec4 texelColor=texture2D(map,vUv); diffuseColor.rgb*=0.55+0.6*texelColor.rgb; diffuseColor.a*=smoothstep(vME,vME+0.14,texelColor.a)*vMA;\n if(diffuseColor.a<0.01) discard;\n#endif");
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
    var im=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1), dm, 48); im.count=0; im.frustumCulled=false; im.renderOrder=3; BOGFX.decal={mesh:im}; }
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
  var mc=BOGFX.mudC||[0.13,0.095,0.065], sh=0.8+Math.random()*0.5; im.setColorAt(i, _bfC.setRGB(mc[0]*sh*1.6, mc[1]*sh*1.6, mc[2]*sh*1.6));
  im.count=BOGFX.decN; im.instanceMatrix.needsUpdate=true; if(im.instanceColor) im.instanceColor.needsUpdate=true; im.visible=true;
}
/* a long throw crossing the rail line: a splat if it hits a banner or a pipe; returns true when it stops there */
function bogFxHitRail(x, y, z){
  var cx=-24+9*Math.round((x+24)/9);
  if(Math.abs(x-cx)<2.6 && x>-27 && x<104 && y>0.53 && y<1.12){ bogFxDecal(x, y, z+0.03, 0.22+Math.random()*0.3); return true; }
  if(Math.abs(y-1.08)<0.09 || Math.abs(y-0.6)<0.09){ bogFxDecal(x, y, z+0.02, 0.1+Math.random()*0.08); return true; }
  return false;
}
/* ... or reaching the front rows: the nearest few spectators get browned */
function bogFxHitCrowd(x, z){
  var C=BOG.crowd; if(!C || !C.body.instanceColor || GFX==="lite") return;
  if(!BOGFX.crowdC || BOGFX.crowdC.body!==C.body) BOGFX.crowdC={body:C.body, b:C.body.instanceColor.array.slice(), h:C.head.instanceColor.array.slice()};
  var B=C.body.instanceColor.array, H=C.head.instanceColor.array, mc=BOGFX.mudC||[0.13,0.095,0.065], hit=0;
  for(var i=0;i<C.n && hit<3;i++){ var p=C.base[i]; if(Math.abs(p[0]-x)>0.7 || p[2]<-BOG_W/2-7.2) continue;
    var k=0.35+Math.random()*0.3; for(var j=0;j<3;j++){ B[i*3+j]+= (mc[j]*1.4-B[i*3+j])*k; H[i*3+j]+=(mc[j]*1.4-H[i*3+j])*k*0.6; } hit++; }
  if(hit){ C.body.instanceColor.needsUpdate=C.head.instanceColor.needsUpdate=true; }
}
/* --- mud on the lens of a low camera near the truck (Full/Ultra) --- */
function bogFxLens(dt, frontX, rearX, amt, bow){
  var cam=BOG.cam; if(!cam || GFX==="lite") return;
  var L=BOGFX.lens;
  if(!L){ var m=new THREE.MeshBasicMaterial({map:BOGFX.splatTex, transparent:true, depthTest:false, depthWrite:false, fog:false, toneMapped:false});
    var im=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1), m, 10); im.count=0; im.frustumCulled=false; im.renderOrder=40; L=BOGFX.lens={mesh:im}; }
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
  BOGFX.t+=dt;
  var v=Math.max(0,+o.v||0), ws=Math.max(v,+o.wspd||0), spin=Math.max(0, ws-v), x=+o.x||0, len=+o.len||70, k=U.k||1;
  var inPit=ph==="pit"||(ph==="done"&&x>0&&x<len), running=ph==="pit", sink=clamp(+o.sink||0,0,1.2);
  var rr=(U.rr||0.55)*k, wr=(U.wr||0.42)*k, trR=(U.trR||0.93)*k, trF=(U.trF||U.trR||0.93)*k, wb=(U.wb||3.65)*k, rx=V.position.x, fx=rx+wb, by=V.position.y;
  var mc=o.cons>0.5?[0.1,0.072,0.05]:[0.115,0.07,0.04]; BOGFX.mudC=mc;
  if(Sh) Sh.mat.color.setRGB(mc[0]*0.9, mc[1]*0.9, mc[2]*0.9);
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
      if(!front && !lite && s<0 && amt>0.7){ var nl=(amt-0.6)*3*dt; if(R()<nl){ var vz=-(7+R()*2.5), vy=3.4+R()*2.4;
        FX.emit(ax-0.3, by+rr*1.2, s*trR, v*0.6-1-R()*2, vy, vz, 2.6, 0.07, 0.06, mc[0], mc[1], mc[2], 1, {drag:0.03, kind:0, lob:true}); } } }
  }
  if(bw>0.03){ var nb=bw*rate*(lite?36:70)*dt, mb=Math.floor(nb)+(R()<nb%1?1:0), fx0=fx+rr*0.95;
    for(i=0;i<mb;i++){ var sd=R()<0.5?-1:1, sh2=0.8+R()*0.4; FX.emit(fx0+R()*0.4, 0.25+R()*0.3*bw, sd*(trF+R()*wr), v*(0.9+R()*0.25), 1.2+R()*3.2*bw, sd*(1.2+R()*2.8*bw), 0.7+R()*0.5, 0.04+R()*0.035, 0.035, mc[0]*sh2, mc[1]*sh2, mc[2]*sh2, 1, {drag:0.25, kind:0}); } }
  /* pit entry: a wall of mud 3-4 m high with wings, scaled with the entry speed; slaps (ridges, ruts, landings) a smaller one */
  var entry=ph==="pit" && BOG.prev.phase==="runup";
  if(entry || BOG.splash>0){
    var sc=entry?clamp(v/11,0.4,1.25):clamp(BOG.splash*0.45,0.15,0.6);
    if(!BOGFX.crown || entry || BOGFX.crown.t>0.7) BOGFX.crown={t:0, x:fx+rr*0.4, sc:sc, v:v, z:0};
    var nsp=Math.round(sc*(lite?42:110));
    for(i=0;i<nsp;i++){ var a=(R()-0.5)*3.6, f=0.35+R()*0.65, H=3.6*sc*(0.72+0.28*Math.cos(a)), vy0=Math.sqrt(2*9.8*H)*f*(0.85+R()*0.25), hs=(2.2+3.4*f)*Math.max(0.5,sc), sh3=0.7+R()*0.6;
      FX.emit(BOGFX.crown.x+Math.cos(a)*1.1, 0.2, Math.sin(a)*(trF+0.4), v*0.55+Math.cos(a)*hs, vy0, Math.sin(a)*hs*1.1, 1.0+R()*0.9, R()<0.25?0.08:0.04+R()*0.035, 0.04, mc[0]*sh3, mc[1]*sh3, mc[2]*sh3, 1, {drag:0.1, kind:0}); }
    if(!lite) for(i=0;i<Math.round(sc*8);i++) FX.emit(BOGFX.crown.x+R()*2, 0.6+R(), (R()-0.5)*4, v*0.4, 0.8+R()*1.4, (R()-0.5)*2, 1.8+R(), 1.2, 3.4+R()*1.5, mc[0]*2.4, mc[1]*2.3, mc[2]*2.2, 0.16, {drag:0.6, grav:0.5, fin:0.1, spin:0.4, kind:1});
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
    for(c=0;c<sl.cols;c++){ var u=c/(sl.cols-1), el=0.7+0.5*u, lat=(0.04+0.16*(1-u))*s, cv=Math.cos(el)*sp, sv=Math.sin(el)*sp, T=(sv+Math.sqrt(sv*sv+2*g*Math.max(0.1,ly)))/g, ef=Math.sin(u*PI);
      for(r=0;r<sl.rows;r++){ var f=r/(sl.rows-1), a=f*T, d=1-0.12*a, px=lx-cv*a*d, py=ly+sv*a-0.5*g*a*a, pz=lz+lat*sp*a*d+s*0.05*q.wr*Math.sin(c*1.7);
        var al=Math.min(1,f*6)*Math.pow(1-f,0.9)*(0.2+0.8*ef)*clamp(q.amt*1.1,0,0.9);
        if(py<0.02){ py=0.02; al=0; }
        Sh.set(sl, c, r, px, py, pz, al, 0.3+0.55*f+(1-ef)*0.2, u*1.3+side*0.37, f*2.2-t*2.4); } } }
  /* crown */
  var C=BOGFX.crown, sc2=S[2];
  if(C){ C.t+=dt; var Tend=2*Math.sqrt(2*g*3.6*C.sc)/g+0.25;
    if(C.t>Tend){ BOGFX.crown=null; Sh.off(sc2); }
    else { sc2.on=true; sc2.dirty=true; Sh.touched=true; var T2=C.t, life=T2/Tend;
      for(c=0;c<sc2.cols;c++){ var ua=(c/(sc2.cols-1))*2-1, phi=ua*1.95, H=3.6*C.sc*(0.72+0.28*Math.cos(phi)), vmax=Math.sqrt(2*g*H), ef2=Math.pow(Math.sin((ua*0.5+0.5)*PI),0.6);
        var bx=C.x+Math.cos(phi)*0.7, bz=Math.sin(phi)*(q.trF+q.wr*0.6);
        for(r=0;r<sc2.rows;r++){ var fr=0.2+0.8*r/(sc2.rows-1), vy=vmax*fr, hs=(1.6+3.0*fr)*Math.max(0.55,C.sc), vxx=C.v*0.45+Math.cos(phi)*hs, vzz=Math.sin(phi)*hs*1.15;
          var py2=vy*T2-0.5*g*T2*T2, al2=ef2*Math.min(1,T2*14)*Math.pow(1-life,0.6)*(py2>0.03?1:0)*(0.55+0.45*fr);
          Sh.set(sc2, c, r, bx+vxx*T2*(1-0.1*T2), Math.max(0.02,py2), bz+vzz*T2*(1-0.1*T2), al2, 0.08+0.7*life+0.15*fr, ua*2.6, fr*1.4); } } } }
  else Sh.off(sc2);
  /* bow mound: two lobes ahead of the front tyres, joined by the axle's push; its crest breaks */
  var B=S[3];
  if(q.bw<0.04){ Sh.off(B); }
  else { B.on=true; B.dirty=true; Sh.touched=true;
    var W=q.trF+q.wr*0.95, x0=q.fx+q.rr*0.55, L2=(1.0+0.9*q.bw)*q.k, Hb=(0.22+0.45*q.bw)*q.k;
    for(c=0;c<B.cols;c++){ var zu=(c/(B.cols-1))*2-1, z=zu*W*1.18, dz=Math.abs(Math.abs(z)-q.trF)/(q.wr*0.9), lobe=0.5+0.5*Math.exp(-dz*dz*0.9), edge=1-Math.pow(Math.abs(zu),3);
      for(r=0;r<B.rows;r++){ var xr=r/(B.rows-1), prof=Math.pow(Math.sin(PI*Math.pow(xr,0.7)),0.9), wob=0.06*Math.sin(t*9+c*1.3+r);
        Sh.set(B, c, r, x0+xr*L2+Math.abs(zu)*0.25*L2, Math.max(0.01,Hb*lobe*prof*edge*(1+wob)), z, Math.min(1,edge*1.4)*Math.min(1,(1-xr)*3+0.2)*Math.min(1,q.bw*2.2),
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
  u.uMudCoat.value=c; u.uMudLine.value=c>0.001?0.15+2.75*Math.pow(c,1.15):0; u.uMudBase.value=V.position.y; u.uMudK.value=U.k||1;
  u.uMudPack.value+=(Math.max(pk, c*0.6)-u.uMudPack.value)*Math.min(1,dt*3); if(c<0.001) u.uMudPack.value=0;
  if(o.cons>0.5) u.uMudCol.value.setRGB(0.075,0.054,0.038); else u.uMudCol.value.setRGB(0.08,0.05,0.03);
}
