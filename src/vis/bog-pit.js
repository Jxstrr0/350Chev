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
    P.hz.forEach(function(h){ var w=+h.w||1; [-0.5,-0.25,0,0.25,0.5].forEach(function(f){ if(h.x+f*w>0 && h.x+f*w<len) xs.push(h.x+f*w); }); });
    xs.sort(function(a,b){ return a-b; }); xs=xs.filter(function(v,j){ return j===0||v-xs[j-1]>0.05; });
    zs=[-5,-4.9,-BOG_EDGE,-half-0.3,-half+0.3,0,half-0.3,half+0.3,BOG_EDGE,4.9,5]; }
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
        "float bRT=mix(mix(0.34,0.2,thick),0.92,crust); bRT=mix(bRT,0.07,film); bRT=mix(bRT,0.82,dryK);"].join("\n"))
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
