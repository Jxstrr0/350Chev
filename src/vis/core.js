<script>
/* ============================================================================
   Prairie Engine Works — visuals.js  (ENGINE_VIS)
   Plain browser JS. Requires global THREE (three.js r128, core build only).
   All textures are procedural (canvas + value-noise + Sobel normal maps).
   ==========================================================================*/
(function(){
"use strict";

/* ===========================================================================
   0. SMALL MATH / NOISE
   ==========================================================================*/
var PI = Math.PI, TAU = PI * 2;
var clamp = function(v,a,b){ return v<a?a:(v>b?b:v); };
var lerp  = function(a,b,t){ return a+(b-a)*t; };
var smoothstep = function(a,b,x){ var t=clamp((x-a)/(b-a||1e-6),0,1); return t*t*(3-2*t); };
var deg = function(d){ return d*PI/180; };

function hashi(x,y,s){
  var h = (x*374761393 + y*668265263 + s*1013904223) | 0;
  h = (h ^ (h>>>13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h>>>16))>>>0) / 4294967295;
}
function wrap(a,b){ return ((a%b)+b)%b; }
/* tileable value noise: lattice period = per */
function vnoise(x,y,per,s){
  var xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi;
  var u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf), x0, x1, y0, y1;
  if(per===(per|0) && per>0){   /* perf: integer period (every caller) — one modulo per axis, same lattice as wrap() */
    x0=xi%per; if(x0<0) x0+=per; x1=x0+1; if(x1===per) x1=0;
    y0=yi%per; if(y0<0) y0+=per; y1=y0+1; if(y1===per) y1=0;
  } else { x0=wrap(xi,per); x1=wrap(xi+1,per); y0=wrap(yi,per); y1=wrap(yi+1,per); }
  var a=hashi(x0,y0,s), b=hashi(x1,y0,s), c=hashi(x0,y1,s), d=hashi(x1,y1,s);
  var ab=a+(b-a)*u, cd=c+(d-c)*u;
  return ab+(cd-ab)*v;
}
/* anisotropic tileable value noise: fx x fy lattice cells over the unit square (long scratches, streaks, drip marks) */
function vnoiseA(u,v,fx,fy,s){
  var x=u*fx, y=v*fy, xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi;
  var ux=xf*xf*(3-2*xf), vy=yf*yf*(3-2*yf);
  var x0=xi%fx; if(x0<0) x0+=fx; var x1=x0+1; if(x1===fx) x1=0;
  var y0=yi%fy; if(y0<0) y0+=fy; var y1=y0+1; if(y1===fy) y1=0;
  var a=hashi(x0,y0,s), b=hashi(x1,y0,s), c=hashi(x0,y1,s), d=hashi(x1,y1,s);
  var ab=a+(b-a)*ux, cd=c+(d-c)*ux;
  return ab+(cd-ab)*vy;
}
/* overlapping circular tool marks (engine-turned / spun finish): n x n jittered cells over the unit square.
   Returns the distance to the nearest cell centre in cell units; SW_H is that cell's own random 0..1 */
var SW_H=0;
function swirlD(u,v,n,s){
  var x=u*n, y=v*n, ix=Math.floor(x), iy=Math.floor(y), best=9, dj, di;
  for(dj=-1;dj<=1;dj++) for(di=-1;di<=1;di++){
    var cx=ix+di, cy=iy+dj, wx=((cx%n)+n)%n, wy=((cy%n)+n)%n;
    var jx=cx+0.15+hashi(wx,wy,s)*0.7-x, jy=cy+0.15+hashi(wx,wy,s+1)*0.7-y, d=jx*jx+jy*jy;
    if(d<best){ best=d; SW_H=hashi(wx,wy,s+2); }
  }
  return Math.sqrt(best);
}
/* fbm on unit square, tileable. f0 must be an integer frequency. */
function fbm(u,v,oct,f0,s){
  var f=f0, amp=1, sum=0, tot=0;
  for(var i=0;i<oct;i++){ sum += amp*vnoise(u*f,v*f,f,s+i*131); tot+=amp; amp*=0.5; f*=2; }
  return sum/tot;
}
/* ridged / billowy variant — good for wrinkle finishes and cast grain */
function ridge(u,v,oct,f0,s){
  var f=f0, amp=1, sum=0, tot=0;
  for(var i=0;i<oct;i++){ sum += amp*Math.abs(vnoise(u*f,v*f,f,s+i*77)*2-1); tot+=amp; amp*=0.5; f*=2; }
  return 1-sum/tot;
}

/* ===========================================================================
   1. CANVAS / TEXTURE HELPERS
   ==========================================================================*/
function newCanvas(w,h){
  var c=document.createElement("canvas"); c.width=w; c.height=h||w; return c;
}
/* Build colour + packed(rough/metal) + normal canvases from one per-pixel fn.
   fn(u,v,out,i,j): out=[r,g,b, height0..1, rough0..1, metal0..1]
   v1.70: painted by a MapJob, which can also run in time slices (the Full / Ultra hi-res upgrade, see pmUpgrade). HQ is the
   detail level the painters read: 1 = the base set (what Lite always uses), 2+ = a bigger set that earns extra octaves. */
var HQ = 1;
function MapJob(size, fn, nstr, hq){
  this.size=size; this.fn=fn; this.hq=hq||1; this.str=(nstr===undefined?2.0:nstr)*this.hq;
  this.cC=newCanvas(size); this.cR=newCanvas(size);
  this.xC=this.cC.getContext("2d"); this.xR=this.cR.getContext("2d");
  this.iC=this.xC.createImageData(size,size); this.iR=this.xR.createImageData(size,size);
  this.H=new Float32Array(size*size); this.cN=newCanvas(size); this.xN=this.cN.getContext("2d"); this.iN=this.xN.createImageData(size,size);
  this.out=[128,128,128,0.5,0.7,0.0]; this.j=0; this.ph=0; this.res=null;
}
/* paint / sobel for up to budget ms (checked every 4 rows); true when the maps are done */
MapJob.prototype.step=function(budget){
  var t0=budget<1e9?performance.now():0, size=this.size, inv=1/size, out=this.out, fn=this.fn, dC=this.iC.data, dR=this.iR.data, H=this.H, j, i, k;
  if(this.ph===0){
    HQ=this.hq;
    while(this.j<size){
      j=this.j; k=j*size*4;
      for(i=0;i<size;i++){
        out[0]=128;out[1]=128;out[2]=128;out[3]=0.5;out[4]=0.7;out[5]=0.0;
        fn(i*inv, j*inv, out, i, j);
        dC[k]=out[0]; dC[k+1]=out[1]; dC[k+2]=out[2]; dC[k+3]=255;
        dR[k]=255;    dR[k+1]=out[4]*255; dR[k+2]=out[5]*255; dR[k+3]=255;
        H[j*size+i]=out[3];
        k+=4;
      }
      this.j++;
      if(t0 && (this.j&3)===0 && performance.now()-t0>budget){ HQ=1; return false; }
    }
    HQ=1; this.xC.putImageData(this.iC,0,0); this.xR.putImageData(this.iR,0,0); this.ph=1; this.j=0;
  }
  while(this.j<size){
    sobelRows(H,size,this.str,this.iN.data,this.j,Math.min(size,this.j+4)); this.j+=4;
    if(t0 && performance.now()-t0>budget) return false;
  }
  this.xN.putImageData(this.iN,0,0);
  this.res={ color:this.cC, orm:this.cR, normal:this.cN, size:size };
  return true;
};
function buildMaps(size, fn, nstr, hq){
  var job=new MapJob(size, fn, nstr, hq); job.step(1e12); return job.res;
}
/* Sobel height -> tangent-space normal map rows y0..y1-1 */
function sobelRows(H,size,strength,d,y0,y1){
  function at(px,py){ return H[(py<0?py+size:py>=size?py-size:py)*size + (px<0?px+size:px>=size?px-size:px)]; }   /* perf: px,py only step one past an edge */
  var k=y0*size*4;
  for(var y=y0;y<y1;y++){
    for(var px=0;px<size;px++){
      var gx = (at(px+1,y-1)+2*at(px+1,y)+at(px+1,y+1)) - (at(px-1,y-1)+2*at(px-1,y)+at(px-1,y+1));
      var gy = (at(px-1,y+1)+2*at(px,y+1)+at(px+1,y+1)) - (at(px-1,y-1)+2*at(px,y-1)+at(px+1,y-1));
      var nx=-gx*strength, ny=-gy*strength;
      var l=Math.sqrt(nx*nx+ny*ny+1)||1;
      d[k]=(nx/l*0.5+0.5)*255; d[k+1]=(ny/l*0.5+0.5)*255; d[k+2]=(1/l*0.5+0.5)*255; d[k+3]=255;
      k+=4;
    }
  }
}

var MAXANISO = 4;
function tex(canvas, srgb){
  var t=new THREE.CanvasTexture(canvas);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.anisotropy=MAXANISO;
  if(srgb) t.encoding=THREE.sRGBEncoding;
  return t;
}

/* Make a MeshStandardMaterial from a per-pixel fn. */
/* perf: the maps are painted the first time three.js uploads one of them (texture.image is read on upload), so a
   surface nothing on screen uses (a turbine, a belt, the glass…) costs nothing at boot. Same pixels, just later. */
function lazyTex(get, srgb){
  var t=tex(undefined, srgb), img=null;
  Object.defineProperty(t, "image", { configurable:true, enumerable:true, get:function(){ if(!img) img=get(); return img; }, set:function(v){ img=v; } });
  return t;
}
/* v1.70: a pmat's maps come in two sets. The base set (size px) is painted on first use, exactly as before, and is all Lite ever
   has. On Full / Ultra a bigger set (2x, 4x for the Ultra floor and walls) is then painted in the background, a few ms per tick
   once the first frame is up, and swapped in: boot costs the same, the surfaces sharpen a moment later. A tier change swaps
   between the sets (painting the bigger one if it isn't there yet). */
var PM_ALL=[], PM_Q=[], PM_T=0;
function pmScale(pm){ return GFX==="lite" ? 1 : (GFX==="ultra" && pm.hero ? 4 : 2); }
/* the size the current tier wants; a 4x set is reached through the 2x one so the floor sharpens in two steps, not one long wait */
function pmTarget(pm){
  var s=pmScale(pm), sz=pm.size*s;
  if(s>2 && !pm.sets[pm.size*2]) sz=pm.size*2;
  return Math.min(2048, sz);
}
function pmTex(pm, kind, srgb){
  var t=tex(undefined, srgb);
  Object.defineProperty(t, "image", { configurable:true, enumerable:true, get:function(){ if(!pm.cur) pmBase(pm); return pm.cur[kind]; }, set:function(){} });
  pm.texs.push(t); return t;
}
function pmBase(pm){
  pm.base=buildMaps(pm.size, pm.fn, pm.nstr, 1); pm.cur=pm.base; pm.sets[pm.size]=pm.base;
  if(GFX!=="lite") pmWant(pm, 1500);   /* the first frame is being painted: leave the bigger set until the menus are up */
}
function pmSwap(pm, set){
  if(pm.cur===set) return; pm.cur=set;
  for(var i=0;i<pm.texs.length;i++){ pm.texs[i].dispose(); pm.texs[i].needsUpdate=true; }
}
/* make pm's current set match the tier: swap, or queue the bigger set's painting (one stage at a time) */
function pmWant(pm, delay){
  if(!pm.cur) return;                       /* never painted: the base set will be asked for when something first draws it */
  var sz=pmTarget(pm), top=Math.min(2048, pm.size*pmScale(pm)), k;
  if(pm.job && pm.job.size>top){ var qi=PM_Q.indexOf(pm.job); if(qi>=0) PM_Q.splice(qi,1); pm.job=null; }   /* the tier dropped under a job in flight */
  for(k in pm.sets) if(+k>top){ if(pm.cur===pm.sets[k]) pmSwap(pm, pm.sets[pm.size]); delete pm.sets[k]; }   /* and under sets it no longer wants */
  if(sz<=pm.size){ if(pm.cur!==pm.base) pmSwap(pm, pm.base); return; }
  if(pm.sets[sz]){ pmSwap(pm, pm.sets[sz]); return; }
  if(pm.job && pm.job.size===sz) return;
  if(pm.job){ var qj=PM_Q.indexOf(pm.job); if(qj>=0) PM_Q.splice(qj,1); }
  pm.job=new MapJob(sz, pm.fn, pm.nstr, sz/pm.size); pm.job.pm=pm; PM_Q.push(pm.job);
  if(!PM_T) PM_T=setTimeout(pmTick, delay||60);
}
function pmTick(){
  PM_T=0; var job=PM_Q[0]; if(!job) return;
  if(typeof document!=="undefined" && document.hidden){ PM_T=setTimeout(pmTick, 500); return; }
  var done=false;
  try{ done=job.step(7); }catch(e){ PM_Q.shift(); job.pm.job=null; if(PM_Q.length) PM_T=setTimeout(pmTick,60); return; }
  if(done){
    PM_Q.shift(); var pm=job.pm, k; pm.job=null; pm.sets[job.size]=job.res;
    if(job.size>pm.cur.size && job.size<=Math.min(2048, pm.size*pmScale(pm))){
      pmSwap(pm, job.res);
      for(k in pm.sets) if(+k!==pm.size && +k<job.size) delete pm.sets[k];     /* a bigger set replaces the middle one: free its canvases */
    }
    pmWant(pm, 24);                                   /* the next stage, if the tier wants one */
  }
  if(PM_Q.length) PM_T=setTimeout(pmTick, 20);
}
/* the graphics tier changed (ENGINE_VIS.setQuality): swap / queue every painted set, and let the anti-tiling shaders recompile */
function matTierChanged(){
  for(var i=0;i<PM_ALL.length;i++) pmWant(PM_ALL[i], 60);
  for(i=0;i<AA_MATS.length;i++) AA_MATS[i].needsUpdate=true;
}
/* v1.70 anti-tiling (Full / Ultra): the garage's repeating surfaces get a slow macro tint + a mid-scale breakup from one shared
   256px noise map, sampled at scales that never line up with the texture's own repeat. Albedo and roughness only: the joints, mortar
   lines and ribs stay put. Lite compiles the unpatched shader (the program key tells the two apart). */
var AA_MATS=[], AA_NOISE=null;
function aaNoise(){
  return AA_NOISE||(AA_NOISE=lazyTex(function(){
    var n=256, c=newCanvas(n), x=c.getContext("2d"), im=x.createImageData(n,n), d=im.data, i, j, k=0, u, v;
    function nz(a){ return clamp((a-0.5)*2.7+0.5,0,1)*255; }
    for(j=0;j<n;j++) for(i=0;i<n;i++){
      u=i/n; v=j/n;
      d[k]=nz(fbm(u,v,3,3,3101)); d[k+1]=nz(fbm(u,v,3,9,3111)); d[k+2]=nz(fbm(u,v,3,6,3121)); d[k+3]=255; k+=4;
    }
    x.putImageData(im,0,0); return c;
  }, false));
}
var AA_GLSL_PRE="uniform sampler2D uAAN;\nuniform vec4 uAAk;\n";
function aaPatch(mat, albedo, detail, rough){
  if(!mat) return mat;
  var k=new THREE.Vector4(albedo, detail, rough, 0);
  mat.userData.aa=true;
  mat.onBeforeCompile=function(sh){
    if(GFX==="lite") return;
    sh.uniforms.uAAN={value:aaNoise()}; sh.uniforms.uAAk={value:k};
    sh.fragmentShader=AA_GLSL_PRE+sh.fragmentShader
      .replace("#include <map_fragment>",
        "vec2 aaR = vec2(vUv.x*0.8776-vUv.y*0.4794, vUv.x*0.4794+vUv.y*0.8776);\n"+
        "vec3 aaA = texture2D(uAAN, aaR*0.173+vec2(0.37,0.11)).rgb;\n"+
        "vec3 aaB = texture2D(uAAN, vUv*0.617+vec2(0.71,0.53)).rgb;\n"+
        "#include <map_fragment>\n"+
        "#ifdef USE_MAP\n  diffuseColor.rgb *= 1.0 + (aaA.r-0.5)*uAAk.x + (aaB.g-0.5)*uAAk.y;\n#endif")
      .replace("#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\n  roughnessFactor = clamp(roughnessFactor + (aaA.b-0.5)*uAAk.z + (aaB.r-0.5)*uAAk.z*0.6, 0.04, 1.0);");
  };
  mat.customProgramCacheKey=function(){ return "aa"+(GFX==="lite"?"0":"1"); };
  AA_MATS.push(mat); mat.needsUpdate=true;
  return mat;
}
function pmat(size, fn, o){
  o=o||{};
  var pm={ size:size, fn:fn, nstr:o.nstr, hero:!!o.hero, base:null, sets:{}, cur:null, job:null, texs:[] };
  PM_ALL.push(pm);
  var mat=new THREE.MeshStandardMaterial({
    map: pmTex(pm,"color",true),
    normalMap: pmTex(pm,"normal",false),
    roughnessMap: pmTex(pm,"orm",false),
    metalnessMap: pmTex(pm,"orm",false),
    roughness: 1, metalness: 1,
    color: o.tint===undefined?0xffffff:sc(o.tint).getHex(),
    envMapIntensity: o.env===undefined?1.0:o.env,
    side: o.side||THREE.FrontSide,
    transparent: !!o.transparent,
    opacity: o.opacity===undefined?1:o.opacity
  });
  mat.normalScale=new THREE.Vector2(o.ns===undefined?1:o.ns, o.ns===undefined?1:o.ns);
  if(o.emissive!==undefined){ mat.emissive=sc(o.emissive); mat.emissiveIntensity=o.emissiveIntensity||0; }
  return mat;
}

/* 2D-drawn texture (posters, screens, pegboard art) */
function drawMat(w,h,draw,o){
  o=o||{};
  var c=newCanvas(w,h), x=c.getContext("2d");
  draw(x,w,h);
  var t=tex(c,true); t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
  var mat=new THREE.MeshStandardMaterial({
    map:t, roughness:o.rough===undefined?0.72:o.rough, metalness:o.metal||0,
    emissive:sc(o.emissive||0x000000),
    emissiveIntensity:o.emissiveIntensity||0,
    side:o.side||THREE.FrontSide, transparent:!!o.transparent
  });
  if(o.emissiveMap) mat.emissiveMap=t;
  return mat;
}

/* --- v1.6 fidelity helpers (Full / Ultra only; Lite never calls these) --- */
/* MeshStandardMaterial -> MeshPhysicalMaterial with a clear coat, sharing every texture */
function toPhysical(base, cc, ccr){
  var p=new THREE.MeshPhysicalMaterial();
  THREE.MeshStandardMaterial.prototype.copy.call(p, base);
  p.defines={ STANDARD:"", PHYSICAL:"" };
  p.clearcoat=cc; p.clearcoatRoughness=ccr; p.reflectivity=0.5;
  p.userData={};
  return p;
}
/* raised / stamped lettering: draw(x,w,h) paints white shapes on black. Returns an alpha mask (hard edge, read
   from green by alphaMap) and a normal map from the blurred mask, so the bevel sits just inside each letter. */
function castMaskMaps(w, h, draw, str){
  var c=newCanvas(w,h), x=c.getContext("2d");
  x.fillStyle="#000"; x.fillRect(0,0,w,h); x.fillStyle="#fff"; x.strokeStyle="#fff";
  draw(x,w,h);
  var d=x.getImageData(0,0,w,h).data, n=w*h, A=new Float32Array(n), Hh=new Float32Array(n), T=new Float32Array(n), i, j, k;
  for(i=0;i<n;i++) A[i]=d[i*4+1]/255;
  /* two box-blur passes (radius 2) -> soft height field */
  for(i=0;i<n;i++) Hh[i]=A[i];
  for(var pass=0;pass<2;pass++){
    for(j=0;j<h;j++) for(i=0;i<w;i++){ var s=0,cn=0; for(k=-2;k<=2;k++){ var ii=i+k; if(ii>=0&&ii<w){ s+=Hh[j*w+ii]; cn++; } } T[j*w+i]=s/cn; }
    for(j=0;j<h;j++) for(i=0;i<w;i++){ var s2=0,cn2=0; for(k=-2;k<=2;k++){ var jj=j+k; if(jj>=0&&jj<h){ s2+=T[jj*w+i]; cn2++; } } Hh[j*w+i]=s2/cn2; }
  }
  var nc=newCanvas(w,h), nx=nc.getContext("2d"), img=nx.createImageData(w,h), o=img.data, st=str||3.0;
  for(j=0;j<h;j++) for(i=0;i<w;i++){
    var gx=Hh[j*w+Math.min(w-1,i+1)]-Hh[j*w+Math.max(0,i-1)], gy=Hh[Math.min(h-1,j+1)*w+i]-Hh[Math.max(0,j-1)*w+i];
    var vx=-gx*st, vy=gy*st, l=Math.sqrt(vx*vx+vy*vy+1);
    k=(j*w+i)*4; o[k]=(vx/l*0.5+0.5)*255; o[k+1]=(vy/l*0.5+0.5)*255; o[k+2]=(1/l*0.5+0.5)*255; o[k+3]=255;
  }
  nx.putImageData(img,0,0);
  var mt=tex(c,false), ntx=tex(nc,false);
  mt.wrapS=mt.wrapT=ntx.wrapS=ntx.wrapT=THREE.ClampToEdgeWrapping;
  return { mask:mt, normal:ntx };
}

/* ===========================================================================
   2. PROCEDURAL MATERIAL DEFINITIONS
   ==========================================================================*/
var MAT = {};           /* key -> MeshStandardMaterial (cached, shared)      */
var MATS_BUILT = false;

/* --- surface fns -------------------------------------------------------- */
/* base set (Lite, and the first paint on Full / Ultra): the original, cheap painter */
function fnCastIron0(u,v,o){
  var g = fbm(u,v,4,24,11);            /* sand grain            */
  var fine = fbm(u,v,2,110,31);        /* fine speckle          */
  var blot = fbm(u,v,3,5,23);          /* casting blotch        */
  var l = 104 + (g-0.5)*26 + (blot-0.5)*15 + (fine-0.5)*20;
  o[0]=l*0.99; o[1]=l*0.99; o[2]=l*1.06;
  /* rust settles in the low spots */
  var rec = 1-smoothstep(0.34,0.62,g);
  var rust = clamp(rec*rec*(fbm(u,v,3,9,7)-0.50)*2.0,0,1);
  o[0]=lerp(o[0],124,rust); o[1]=lerp(o[1],70,rust); o[2]=lerp(o[2],42,rust);
  o[3]=g*0.62+fine*0.38;
  o[4]=clamp(0.70+(1-g)*0.16+rust*0.14,0,1);
  o[5]=0.55*(1-rust*0.75);
}
/* hi-res set (Full / Ultra, painted in the background): the detailed painter */
function fnCastIron(u,v,o,i,j){         /* sand-cast iron: orange-peel lumps, sand inclusions, gas pits, burnished high spots; rust blooms in the low ones */
  if(HQ<=1) return fnCastIron0(u,v,o,i,j);
  var g = fbm(u,v,4,24,11);            /* sand grain            */
  var lump = fbm(u,v,3,9,13);          /* casting waviness      */
  var fine = fbm(u,v,2,110,31);        /* fine speckle          */
  var blot = fbm(u,v,3,5,23);          /* casting blotch        */
  var sand = vnoise(u*170,v*170,170,17);
  if(HQ>1) sand = sand*0.65 + vnoise(u*340,v*340,340,41)*0.35;
  var pit = smoothstep(0.80,0.92,fbm(u,v,2,70,19))*(0.5+0.5*lump);
  var inc = smoothstep(0.84,0.93,vnoise(u*220,v*220,220,29));        /* pale sand grains */
  var burn = smoothstep(0.55,0.85,lump)*smoothstep(0.45,0.8,g);      /* handled / machined-bright high spots */
  var l = 98 + (g-0.5)*26 + (blot-0.5)*16 + (fine-0.5)*14 + (sand-0.5)*18 - pit*26 + inc*14 + burn*10;
  o[0]=l*0.99; o[1]=l*0.985; o[2]=l*1.05;
  /* rust settles in the low spots */
  var rec = 1-smoothstep(0.34,0.62,g);
  var rust = clamp(rec*rec*(fbm(u,v,3,9,7)-0.50)*2.0,0,1);
  o[0]=lerp(o[0],128,rust); o[1]=lerp(o[1],72,rust); o[2]=lerp(o[2],42,rust);
  o[3]=lump*0.40+g*0.30+sand*0.22+fine*0.08-pit*0.55;
  o[4]=clamp(0.74+(1-g)*0.14+rust*0.12+pit*0.08-burn*0.18+(sand-0.5)*0.10,0,1);
  o[5]=0.55*(1-rust*0.75)+burn*0.10;
}
function fnCGI(u,v,o){
  var g=fbm(u,v,4,52,53), fine=fbm(u,v,2,170,61);
  var l=78+(g-0.5)*14+(fine-0.5)*11;
  o[0]=l*0.98; o[1]=l; o[2]=l*1.09;
  o[3]=g*0.5+fine*0.5;
  o[4]=0.58+(1-g)*0.10; o[5]=0.72;
}
/* base set (Lite, and the first paint on Full / Ultra): the original, cheap painter */
function fnCastAlu0(u,v,o){          /* A356 sand cast: matte, porous, light */
  var g=fbm(u,v,4,26,101), fine=fbm(u,v,2,140,107);
  var l=128+(g-0.5)*20+(fine-0.5)*15;
  o[0]=l; o[1]=l*1.005; o[2]=l*1.02;
  /* porosity pits */
  var p=fbm(u,v,2,64,113);
  var pit=smoothstep(0.80,0.94,p);
  o[0]-=pit*46; o[1]-=pit*46; o[2]-=pit*44;
  o[3]=g*0.55+fine*0.45-pit*0.55;
  o[4]=clamp(0.62+(1-g)*0.14+pit*0.20,0,1);
  o[5]=0.86;
}
/* hi-res set (Full / Ultra, painted in the background): the detailed painter */
function fnCastAlu(u,v,o,i,j){          /* A356 sand cast: matte, porous, light, a little oxide mottling and bright metal grains */
  if(HQ<=1) return fnCastAlu0(u,v,o,i,j);
  var g=fbm(u,v,4,26,101), fine=fbm(u,v,2,140,107), mott=fbm(u,v,3,6,121), sand=vnoise(u*190,v*190,190,127);
  var l=130+(g-0.5)*22+(fine-0.5)*14+(sand-0.5)*16+(mott-0.5)*14;
  if(HQ>1) l += (vnoise(u*380,v*380,380,137)-0.5)*11;
  /* porosity pits */
  var pit=smoothstep(0.78,0.92,fbm(u,v,2,64,113));
  var spark=smoothstep(0.88,0.95,vnoise(u*260,v*260,260,131));
  l += spark*22 - pit*48;
  o[0]=l*0.99; o[1]=l*1.005; o[2]=l*1.03+(1-mott)*3;
  o[3]=g*0.45+fine*0.20+sand*0.20+mott*0.15-pit*0.55;
  o[4]=clamp(0.60+(1-g)*0.14+pit*0.20+(mott-0.5)*0.12-spark*0.15,0,1);
  o[5]=0.86;
}
/* base set (Lite, and the first paint on Full / Ultra): the original, cheap painter */
function fnMachinedAlu0(u,v,o){      /* fine brushed / turned tool marks */
  var streak=fbm(u*0.09,v,3,128,201);
  var fineline=vnoise(u*4,v*420,420,7);
  var l=154+(streak-0.5)*15+(fineline-0.5)*12;
  o[0]=l*0.995; o[1]=l; o[2]=l*1.03;
  o[3]=streak*0.4+fineline*0.6;
  o[4]=clamp(0.24+(streak-0.5)*0.13+(fineline-0.5)*0.08,0.06,0.6);
  o[5]=1.0;
}
/* hi-res set (Full / Ultra, painted in the background): the detailed painter */
function fnMachinedAlu(u,v,o,i,j){      /* machined: fine feed lines along u with chatter, and overlapping cutter-swirl patches */
  if(HQ<=1) return fnMachinedAlu0(u,v,o,i,j);
  var streak=vnoiseA(u,v,8,160,201)*0.6+vnoiseA(u,v,16,300,203)*0.4;
  var fineline=vnoiseA(u,v,4,420,207);
  var d=swirlD(u,v,5,211), h=SW_H;
  var ring=0.5+0.5*Math.sin(d*TAU*13+h*TAU);
  var lines=streak*0.55+fineline*0.45;
  var m=lerp(lines, ring, smoothstep(0.30,0.60,h)*(1-smoothstep(0.50,0.80,d))*0.42);
  var l=152+(m-0.5)*26+(streak-0.5)*8+(h-0.5)*9;
  if(HQ>1) l += (vnoiseA(u,v,3,900,223)-0.5)*7;
  o[0]=l*0.995; o[1]=l; o[2]=l*1.03;
  o[3]=m*0.65+streak*0.35;
  o[4]=clamp(0.23+(1-m)*0.07+(streak-0.5)*0.12+(fineline-0.5)*0.06,0.06,0.6);
  o[5]=1.0;
}
/* base set (Lite, and the first paint on Full / Ultra): the original, cheap painter */
function fnPolishedAlu0(u,v,o){
  var n=fbm(u,v,3,90,301);
  var l=178+(n-0.5)*10;
  o[0]=l*0.99; o[1]=l; o[2]=l*1.04;
  o[3]=n; o[4]=clamp(0.10+(n-0.5)*0.07,0.04,0.3); o[5]=1.0;
}
/* hi-res set (Full / Ultra, painted in the background): the detailed painter */
function fnPolishedAlu(u,v,o,i,j){      /* buffed: faint swirl from the mop, hairline scratches, a little haze */
  if(HQ<=1) return fnPolishedAlu0(u,v,o,i,j);
  var n=fbm(u,v,3,90,301), d=swirlD(u,v,3,311), buff=0.5+0.5*Math.sin(d*TAU*26+SW_H*TAU);
  var hz=fbm(u,v,2,5,317), sc1=smoothstep(0.82,0.93,vnoiseA(u,v,3,170,321));
  var l=176+(n-0.5)*8+(buff-0.5)*5+(hz-0.5)*8-sc1*16;
  o[0]=l*0.99; o[1]=l; o[2]=l*1.04;
  o[3]=n*0.5+buff*0.5-sc1*0.3;
  o[4]=clamp(0.10+(n-0.5)*0.05+(1-buff)*0.03+sc1*0.12+(hz-0.5)*0.05,0.04,0.35); o[5]=1.0;
}
function fnNikasil(u,v,o){          /* mirror bore plating */
  var n=fbm(u,v,2,200,401);
  var hone=Math.abs(Math.sin((u*38+v*38)*PI))*0.5+Math.abs(Math.sin((u*38-v*38)*PI))*0.5;
  var l=122+(n-0.5)*8+hone*6;
  o[0]=l; o[1]=l*1.01; o[2]=l*1.06;
  o[3]=n*0.5+hone*0.5; o[4]=clamp(0.07+hone*0.05,0.04,0.2); o[5]=1.0;
}
/* base set (Lite, and the first paint on Full / Ultra): the original, cheap painter */
function fnWrinkle0(u,v,o){          /* wrinkle-finish powder coat (tinted) */
  var r1=ridge(u,v,3,7,501);
  var r2=ridge(u,v,2,16,517);
  var w=r1*0.70+r2*0.30;
  w=w*w*(3-2*w);
  var l=176+(w-0.5)*22;
  o[0]=l; o[1]=l; o[2]=l;
  o[3]=w;
  o[4]=clamp(0.60+(1-w)*0.26,0,1);
  o[5]=0.06;
}
/* hi-res set (Full / Ultra, painted in the background): the detailed painter */
function fnWrinkle(u,v,o,i,j){          /* wrinkle-finish powder coat (tinted): crisp ridges, dark troughs, a few metallic flake glints */
  if(HQ<=1) return fnWrinkle0(u,v,o,i,j);
  var r1=ridge(u,v,3,7,501);
  var r2=ridge(u,v,2,16,517);
  var w=r1*0.62+r2*0.28+(HQ>1?ridge(u,v,2,36,527):r2)*0.10;
  w=w*w*(3-2*w);
  var fl=smoothstep(0.86,0.95,vnoise(u*230,v*230,230,531));
  var l=174+(w-0.5)*50+fl*14;
  o[0]=l; o[1]=l; o[2]=l;
  o[3]=w;
  o[4]=clamp(0.52+(1-w)*0.30-fl*0.10,0,1);
  o[5]=0.06+fl*0.15;
}
/* base set (Lite, and the first paint on Full / Ultra): the original, cheap painter */
function fnAnodised0(u,v,o){         /* bead-blasted anodised plenum (tinted) */
  var b=fbm(u,v,2,190,601), c=fbm(u,v,3,30,613);
  var l=146+(b-0.5)*20+(c-0.5)*10;
  o[0]=l; o[1]=l; o[2]=l;
  o[3]=b*0.7+c*0.3;
  o[4]=clamp(0.40+(b-0.5)*0.14,0.2,0.7);
  o[5]=0.80;
}
/* hi-res set (Full / Ultra, painted in the background): the detailed painter */
function fnAnodised(u,v,o,i,j){     /* bead-blasted anodised plenum (tinted): fine pitted peen with a sparkle */
  if(HQ<=1) return fnAnodised0(u,v,o,i,j);
  var b=fbm(u,v,2,190,601), c=fbm(u,v,3,30,613), pp=hashi(i,j,607);
  var l=146+(b-0.5)*20+(c-0.5)*10+(pp-0.5)*14;
  o[0]=l; o[1]=l; o[2]=l;
  o[3]=b*0.5+c*0.2+pp*0.3;
  o[4]=clamp(0.42+(b-0.5)*0.14+(pp-0.5)*0.10,0.2,0.7);
  o[5]=0.80;
}
var STAIN_BANDS=[[0.00,[196,176,128]],[0.05,[178,140,58]],[0.10,[132,94,134]],
             [0.16,[78,102,166]],[0.24,[110,132,172]],[0.34,[164,170,178]],[1.0,[174,178,184]]];
/* base set (Lite, and the first paint on Full / Ultra): the original, cheap painter */
function fnStainless0(u,v,o){        /* heat-tinted header: u = along the tube */
  var grain=fbm(u*3,v,3,64,701);
  var base=[172,175,180];
  /* heat tint bands close to the flange (u small) */
  var bands=[[0.00,[196,176,128]],[0.05,[178,140,58]],[0.10,[132,94,134]],
             [0.16,[78,102,166]],[0.24,[110,132,172]],[0.34,[164,170,178]],[1.0,[174,178,184]]];
  var col=base, i;
  for(i=0;i<bands.length-1;i++){
    if(u>=bands[i][0]&&u<=bands[i+1][0]){
      var t=(u-bands[i][0])/(bands[i+1][0]-bands[i][0]);
      col=[lerp(bands[i][1][0],bands[i+1][1][0],t),
           lerp(bands[i][1][1],bands[i+1][1][1],t),
           lerp(bands[i][1][2],bands[i+1][1][2],t)];
      break;
    }
  }
  var gm=(grain-0.5)*16;
  o[0]=col[0]+gm; o[1]=col[1]+gm; o[2]=col[2]+gm;
  o[3]=grain;
  o[4]=clamp(0.26+(grain-0.5)*0.16,0.1,0.6);
  o[5]=1.0;
}
/* hi-res set (Full / Ultra, painted in the background): the detailed painter */
function fnStainless(u,v,o,i,j){        /* heat-tinted header: u = along the tube. Bands wander, brushed along the tube, soot specks */
  if(HQ<=1) return fnStainless0(u,v,o,i,j);
  var grain=fbm(u*3,v,3,64,701), br=vnoiseA(u,v,6,220,713), wob=fbm(u,v,2,6,709);
  var uu=clamp(u+(wob-0.5)*0.07,0,1);
  var col=heatBands(uu, STAIN_BANDS);
  var soot=smoothstep(0.86,0.97,vnoise(u*90,v*90,90,719))*0.5;
  var gm=(grain-0.5)*14+(br-0.5)*10;
  o[0]=col[0]+gm-soot*22; o[1]=col[1]+gm-soot*22; o[2]=col[2]+gm-soot*20;
  o[3]=grain*0.5+br*0.5;
  o[4]=clamp(0.26+(grain-0.5)*0.14+(br-0.5)*0.10+soot*0.2,0.1,0.6);
  o[5]=1.0;
}
/* base set (Lite, and the first paint on Full / Ultra): the original, cheap painter */
function fnCastExh0(u,v,o){          /* fresh cast-iron exhaust manifold: even dark grey, sand-cast grain, no rust */
  var g=fbm(u,v,4,24,801), fine=fbm(u,v,2,120,811), pit=smoothstep(0.84,0.96,fbm(u,v,2,64,821));
  var l=100+(g-0.5)*12+(fine-0.5)*10-pit*20;
  o[0]=l+2; o[1]=l+1; o[2]=l+2;
  o[3]=g*0.55+fine*0.45-pit*0.4;
  o[4]=clamp(0.66+(1-g)*0.10+pit*0.10,0,1);
  o[5]=0.5;
}
/* hi-res set (Full / Ultra, painted in the background): the detailed painter */
function fnCastExh(u,v,o,i,j){          /* fresh cast-iron exhaust manifold: even dark grey, sand-cast grain, no rust */
  if(HQ<=1) return fnCastExh0(u,v,o,i,j);
  var g=fbm(u,v,4,24,801), fine=fbm(u,v,2,120,811), pit=smoothstep(0.84,0.96,fbm(u,v,2,64,821)), lump=fbm(u,v,3,8,827), sand=vnoise(u*180,v*180,180,829);
  var l=100+(g-0.5)*12+(fine-0.5)*10+(sand-0.5)*14+(lump-0.5)*8-pit*20;
  o[0]=l+2; o[1]=l+1; o[2]=l+2;
  o[3]=lump*0.30+g*0.35+fine*0.15+sand*0.2-pit*0.4;
  o[4]=clamp(0.66+(1-g)*0.10+pit*0.10+(sand-0.5)*0.08,0,1);
  o[5]=0.5;
}
function fnTurbine(u,v,o){          /* clean sand-cast turbine housing: even grey, fine grain, no stain */
  var g=fbm(u,v,4,30,901), fine=fbm(u,v,2,120,911);
  var l=118+(g-0.5)*12+(fine-0.5)*10;
  o[0]=l+3; o[1]=l+1; o[2]=l;
  o[3]=g*0.55+fine*0.45;
  o[4]=clamp(0.58+(1-g)*0.10,0,1);
  o[5]=0.6;
}
/* base set (Lite, and the first paint on Full / Ultra): the original, cheap painter */
function fnRubberBelt0(u,v,o){       /* ribbed serpentine belt */
  var rib=Math.abs(Math.sin(v*PI*26));
  var n=fbm(u,v,2,60,1001);
  var l=26+rib*10+(n-0.5)*8;
  o[0]=l; o[1]=l; o[2]=l*1.05;
  o[3]=rib*0.8+n*0.2;
  o[4]=0.86-rib*0.10; o[5]=0.02;
}
/* hi-res set (Full / Ultra, painted in the background): the detailed painter */
function fnRubberBelt(u,v,o,i,j){       /* ribbed serpentine belt: dusty worn rib tops, fine cross-cracks */
  if(HQ<=1) return fnRubberBelt0(u,v,o,i,j);
  var rib=Math.abs(Math.sin(v*PI*26));
  var n=fbm(u,v,2,60,1001), dust=fbm(u,v,3,8,1009);
  var ck=1-smoothstep(0.0,0.04,Math.abs(vnoiseA(u,v,52,4,1007)-0.5));
  var worn=smoothstep(0.7,0.95,rib)*dust;
  var l=26+rib*10+(n-0.5)*8+worn*9+dust*3-ck*5;
  o[0]=l; o[1]=l; o[2]=l*1.05;
  o[3]=rib*0.8+n*0.2-ck*0.15;
  o[4]=0.86-rib*0.10-worn*0.06; o[5]=0.02;
}
/* base set (Lite, and the first paint on Full / Ultra): the original, cheap painter */
function fnHose0(u,v,o){
  var weave=Math.abs(Math.sin(u*PI*70))*0.4+Math.abs(Math.sin(v*PI*70))*0.4;
  var n=fbm(u,v,2,50,1101);
  var l=27+(n-0.5)*8+weave*4;
  o[0]=l; o[1]=l; o[2]=l;
  o[3]=n*0.6+weave*0.4; o[4]=0.80; o[5]=0.03;
}
/* hi-res set (Full / Ultra, painted in the background): the detailed painter */
function fnHose(u,v,o,i,j){
  if(HQ<=1) return fnHose0(u,v,o,i,j);
  var weave=Math.abs(Math.sin(u*PI*70))*0.4+Math.abs(Math.sin(v*PI*70))*0.4;
  var n=fbm(u,v,2,50,1101), dust=fbm(u,v,3,7,1103), sc=smoothstep(0.88,0.96,vnoiseA(u,v,5,140,1107));
  var l=27+(n-0.5)*8+weave*4+dust*5+sc*8;
  o[0]=l; o[1]=l; o[2]=l;
  o[3]=n*0.6+weave*0.4-sc*0.1; o[4]=0.80-sc*0.1; o[5]=0.03;
}
/* base set (Lite, and the first paint on Full / Ultra): the original, cheap painter */
function fnSteel0(u,v,o){
  var n=fbm(u,v,3,70,1201), fine=vnoise(u*300,v*8,300,3);
  var l=104+(n-0.5)*16+(fine-0.5)*8;
  o[0]=l; o[1]=l*1.01; o[2]=l*1.04;
  o[3]=n*0.7+fine*0.3; o[4]=clamp(0.34+(n-0.5)*0.15,0.12,0.7); o[5]=0.95;
}
/* hi-res set (Full / Ultra, painted in the background): the detailed painter */
function fnSteel(u,v,o,i,j){            /* ground / brushed steel: feed lines, the odd scratch, oil sheen patches */
  if(HQ<=1) return fnSteel0(u,v,o,i,j);
  var n=fbm(u,v,3,70,1201), fine=vnoiseA(u,v,300,8,3), sc=smoothstep(0.86,0.95,vnoiseA(u,v,5,220,1207)), oil=fbm(u,v,2,4,1209);
  var l=104+(n-0.5)*16+(fine-0.5)*10+sc*18-(oil-0.5)*8;
  o[0]=l; o[1]=l*1.01; o[2]=l*1.04;
  o[3]=n*0.6+fine*0.3+0.1-sc*0.12; o[4]=clamp(0.34+(n-0.5)*0.15+(oil-0.5)*0.08-sc*0.06,0.12,0.7); o[5]=0.95;
}
function fnDarkComposite(u,v,o){
  var n=fbm(u,v,3,44,1301), crinkle=ridge(u,v,2,90,1311);
  var l=46+(n-0.5)*11+crinkle*9;
  o[0]=l; o[1]=l*1.01; o[2]=l*1.06;
  o[3]=n*0.4+crinkle*0.6; o[4]=0.62+(1-crinkle)*0.14; o[5]=0.08;
}
/* base set (Lite, and the first paint on Full / Ultra): the original, cheap painter */
function fnPaintChipped0(u,v,o){     /* painted steel, chipped to rust (tinted) */
  var chip=fbm(u,v,3,5,1401);
  var scuff=fbm(u,v,3,22,1411);
  var bare=smoothstep(0.78,0.90,chip)*0.8;
  var l=186+(scuff-0.5)*20;
  o[0]=l; o[1]=l; o[2]=l;
  /* bare metal / rust under the paint — desaturate away from the tint */
  if(bare>0){
    o[0]=lerp(o[0],118,bare); o[1]=lerp(o[1],96,bare); o[2]=lerp(o[2],80,bare);
  }
  o[3]=chip*0.35+scuff*0.25 - bare*0.5;
  o[4]=clamp(0.42+bare*0.34+(scuff-0.5)*0.12,0,1);
  o[5]=bare*0.5;
}
/* hi-res set (Full / Ultra, painted in the background): the detailed painter */
function fnPaintChipped(u,v,o,i,j){     /* painted steel (tinted): orange peel, scuffs, scratches and crisp-edged chips down to primer and rust */
  if(HQ<=1) return fnPaintChipped0(u,v,o,i,j);
  var chip=fbm(u,v,3,5,1401), scuff=fbm(u,v,3,22,1411), peel=fbm(u,v,2,90,1417);
  var zone=smoothstep(0.64,0.80,chip);                                   /* where the paint has been knocked about */
  var cn=vnoise(u*44,v*44,44,1421)*0.65+vnoise(u*90,v*90,90,1423)*0.35;
  var bare=zone*smoothstep(0.56,0.59,cn);                               /* flake-shaped, crisp edged */
  var ring=zone*smoothstep(0.51,0.56,cn)*(1-bare);                       /* lifted rim round a chip */
  var rustc=smoothstep(0.45,0.8,fbm(u,v,3,11,1427))*bare;
  var sc=smoothstep(0.88,0.95,vnoiseA(u,v,4,120,1431))*(0.4+0.6*scuff);
  var l=186+(scuff-0.5)*20+(peel-0.5)*8+ring*8-sc*30;
  o[0]=l; o[1]=l; o[2]=l;
  /* primer / bare metal / rust under the paint — desaturate away from the tint */
  if(bare>0){
    o[0]=lerp(o[0],lerp(118,128,rustc),bare); o[1]=lerp(o[1],lerp(100,76,rustc),bare); o[2]=lerp(o[2],lerp(88,48,rustc),bare);
  }
  o[3]=0.62+peel*0.06+(scuff-0.5)*0.10-bare*0.30+ring*0.10-sc*0.05;
  o[4]=clamp(0.42+bare*0.36+rustc*0.10+(scuff-0.5)*0.12+ring*0.04+sc*0.1,0,1);
  o[5]=bare*0.5*(1-rustc*0.8);
}
/* --- garage surfaces ---------------------------------------------------- */
/* base set (Lite, and the first paint on Full / Ultra): the original, cheap painter */
function fnConcrete0(u,v,o){
  var agg=fbm(u,v,3,18,1501), fine=fbm(u,v,2,64,1511), broad=fbm(u,v,3,4,1521);
  var l=86+(agg-0.5)*16+(fine-0.5)*11+(broad-0.5)*13;
  /* expansion joints on the tile edges */
  var jx=Math.min(u,1-u), jy=Math.min(v,1-v);
  var joint=(1-smoothstep(0.004,0.013,jx))+(1-smoothstep(0.004,0.013,jy));
  joint=clamp(joint,0,1);
  /* oil stains */
  var stain=smoothstep(0.62,0.86,fbm(u,v,3,6,1531))*smoothstep(0.4,0.7,fbm(u,v,2,3,1541));
  /* tyre marks: broad dark streaks along v */
  var tyre=smoothstep(0.72,0.9,fbm(u,v*0.14,2,18,1551))*0.55;
  l -= stain*70 + tyre*36 + joint*54;
  o[0]=l*1.0; o[1]=l*0.99; o[2]=l*0.96;
  o[3]=agg*0.30+fine*0.12+broad*0.58 - joint*0.9;
  o[4]=clamp(0.62+(agg-0.5)*0.16 - stain*0.20 + joint*0.24,0.3,1);
  o[5]=0.03;
}
/* hi-res set (Full / Ultra, painted in the background): the detailed painter */
function fnConcrete(u,v,o,i,j){
  if(HQ<=1) return fnConcrete0(u,v,o,i,j);
  var agg=fbm(u,v,3,18,1501), fine=fbm(u,v,2,64,1511), broad=fbm(u,v,3,4,1521);
  var l=86+(agg-0.5)*14+(fine-0.5)*10+(broad-0.5)*13;
  /* hand-trowelled sweeps: soft arcs, the contours of a slow noise field */
  var tw=Math.sin(fbm(u,v,2,3,1561)*26)*0.5+0.5;
  l += (tw-0.5)*7;
  /* sealed patches: darker, tighter and glossier, with a crisp lap line at the edge */
  var sf=fbm(u,v,3,3,1571), seal=smoothstep(0.54,0.575,sf), lap=seal*(1-smoothstep(0.575,0.60,sf));
  l = l*(1-seal*0.075) - lap*4;
  /* expansion joints on the tile edges, chipped */
  var jx=Math.min(u,1-u), jy=Math.min(v,1-v), cj=(fine-0.5)*0.012;
  var joint=clamp((1-smoothstep(0.004,0.013,jx+cj))+(1-smoothstep(0.004,0.013,jy+cj)),0,1);
  /* oil stains: dark core, a faint ring round it */
  var sn=fbm(u,v,3,6,1531), sm=fbm(u,v,2,3,1541);
  var stain=smoothstep(0.62,0.86,sn)*smoothstep(0.4,0.7,sm), ring=smoothstep(0.55,0.62,sn)*(1-smoothstep(0.62,0.7,sn))*smoothstep(0.4,0.7,sm);
  /* tyre marks: broad dark streaks along v */
  var tyre=smoothstep(0.72,0.9,vnoiseA(u,v,18,3,1551)*0.65+vnoiseA(u,v,36,6,1552)*0.35)*0.55;
  /* aggregate speckle, pores, hairline cracks */
  var spk=smoothstep(0.70,0.90,vnoise(u*100,v*100,100,1581)), prs=smoothstep(0.78,0.92,vnoise(u*130,v*130,130,1583));
  var cr=(1-smoothstep(0.0,0.014,Math.abs(fbm(u,v,2,7,1591)-0.5)))*smoothstep(0.5,0.68,fbm(u,v,2,2,1593));
  l += spk*6 - prs*9 - cr*16 - stain*68 - ring*8 - tyre*36 - joint*54;
  if(HQ>1) l += (vnoise(u*260,v*260,260,1597)-0.5)*5;
  o[0]=l*1.0; o[1]=l*0.99; o[2]=l*0.96;
  o[3]=agg*0.26+fine*0.10+broad*0.50+tw*0.06 - joint*0.9 - prs*0.12 - cr*0.45 - seal*0.04;
  o[4]=clamp(0.64+(agg-0.5)*0.16 - stain*0.22 - seal*0.14 + joint*0.24 + tyre*0.10 + prs*0.10,0.3,1);
  o[5]=0.03;
}
/* base set (Lite, and the first paint on Full / Ultra): the original, cheap painter */
function fnTileFloor0(u,v,o){        /* sandbox / test-cell white epoxy tile */
  var gx=wrap(u*4,1), gy=wrap(v*4,1);
  var g=Math.min(Math.min(gx,1-gx),Math.min(gy,1-gy));
  var grout=1-smoothstep(0.008,0.022,g);
  var n=fbm(u,v,3,60,1601);
  var l=206+(n-0.5)*9 - grout*44;
  o[0]=l; o[1]=l*1.005; o[2]=l*1.01;
  o[3]=n*0.4 - grout*0.7;
  o[4]=clamp(0.16+grout*0.34+(n-0.5)*0.06,0.06,1);
  o[5]=0.02;
}
/* hi-res set (Full / Ultra, painted in the background): the detailed painter */
function fnTileFloor(u,v,o,i,j){        /* sandbox / test-cell white epoxy tile: dirty grout, chipped glaze at the edges, heel scuffs */
  if(HQ<=1) return fnTileFloor0(u,v,o,i,j);
  var tu=u*4, tv=v*4, ci=Math.floor(tu), cj=Math.floor(tv), gx=tu-ci, gy=tv-cj;
  var g=Math.min(Math.min(gx,1-gx),Math.min(gy,1-gy));
  var th=hashi(ci,cj,1611), n=fbm(u,v,3,60,1601), nn=fbm(u,v,2,9,1603), dirt=fbm(u,v,3,28,1613);
  var grout=1-smoothstep(0.008,0.022,g);
  var cn=vnoise(u*72,v*72,72,1607);
  var chip=(1-smoothstep(0.022,0.05,g))*smoothstep(0.70,0.78,cn)*(1-grout);
  var l=206+(th-0.5)*7+(n-0.5)*8+(nn-0.5)*6;
  l=lerp(l,188,chip);
  var gl=152-dirt*44+(vnoise(u*160,v*160,160,1609)-0.5)*14;
  l=lerp(l,gl,grout);
  var sc=smoothstep(0.80,0.92,vnoiseA(u,v,9,40,1617))*(0.4+0.6*dirt);
  l-=sc*7;
  o[0]=l; o[1]=l*1.005; o[2]=l*1.01;
  o[3]=0.70+n*0.20+(th-0.5)*0.06-grout*0.80-chip*0.30;
  o[4]=clamp(0.16+grout*0.38+chip*0.20+sc*0.12+(nn-0.5)*0.08+(n-0.5)*0.05,0.06,1);
  o[5]=0.02;
}
/* base set (Lite, and the first paint on Full / Ultra): the original, cheap painter */
function fnCinderBlock0(u,v,o){
  var rows=8, cols=4;
  var ry=v*rows, r=Math.floor(ry), fy=ry-r;
  var off=(r%2)?0.5:0.0;
  var rx=wrap(u*cols+off,cols), cIdx=Math.floor(rx), fx=rx-cIdx;
  var mx=Math.min(fx,1-fx)*  (1/cols), my=Math.min(fy,1-fy)*(1/rows);
  var mortar=1-smoothstep(0.0035,0.0075,Math.min(mx,my));
  var grit=fbm(u,v,4,64,1701), broad=fbm(u,v,3,7,1711);
  var per=hashi(cIdx,r,1721);
  var l=132+(grit-0.5)*14+(broad-0.5)*12+(per-0.5)*9;
  /* grime creeping up from the floor */
  var grime=smoothstep(0.0,0.35,v)*0.0 + (1-smoothstep(0.0,0.30,v))*0.30*fbm(u,v,3,10,1731);
  l -= grime*70;
  l = lerp(l, 96, mortar);
  o[0]=l*0.99; o[1]=l; o[2]=l*0.97;
  o[3]=grit*0.35+broad*0.35 - mortar*0.55;
  o[4]=clamp(0.72+(grit-0.5)*0.16+mortar*0.14,0,1);
  o[5]=0.02;
}
/* hi-res set (Full / Ultra, painted in the background): the detailed painter */
function fnCinderBlock(u,v,o,i,j){
  if(HQ<=1) return fnCinderBlock0(u,v,o,i,j);
  var rows=8, cols=4;
  var ry=v*rows, r=Math.floor(ry), fy=ry-r;
  var off=(r%2)?0.5:0.0;
  var rx=wrap(u*cols+off,cols), cIdx=Math.floor(rx), fx=rx-cIdx;
  var mx=Math.min(fx,1-fx)*  (1/cols), my=Math.min(fy,1-fy)*(1/rows);
  var mortar=1-smoothstep(0.0035,0.0075,Math.min(mx,my));
  var grit=fbm(u,v,4,64,1701), broad=fbm(u,v,3,7,1711);
  var per=hashi(cIdx,r,1721), per2=hashi(cIdx,r,1723);
  var pore=smoothstep(0.74,0.95,vnoise(u*96,v*96,96,1741)), pore2=smoothstep(0.80,0.95,vnoise(u*150,v*150,150,1743));
  var l=130+(grit-0.5)*16+(broad-0.5)*12+(per-0.5)*10;
  /* grime creeping up from the floor, rain streaks running down from the joints */
  var grime=(1-smoothstep(0.0,0.30,v))*0.30*fbm(u,v,3,10,1731);
  var drip=smoothstep(0.55,0.85,vnoiseA(u,v,28,3,1751))*0.35*fbm(u,v,2,5,1753);
  l -= grime*70 + drip*22 + pore*15 + pore2*7;
  /* mortar: sandy, a little lighter than the dirty face */
  var ml=112+(vnoise(u*200,v*200,200,1761)-0.5)*26+(grit-0.5)*10-grime*30;
  l = lerp(l, ml, mortar);
  var tn=(per2-0.5)*0.025;
  o[0]=l*(0.99+tn); o[1]=l; o[2]=l*(0.97-tn);
  o[3]=0.15+grit*0.38+broad*0.36 - mortar*0.60 - pore*0.25 - pore2*0.10;
  o[4]=clamp(0.72+(grit-0.5)*0.16+mortar*0.14+pore*0.12,0,1);
  o[5]=0.02;
}
/* base set (Lite, and the first paint on Full / Ultra): the original, cheap painter */
function fnCorrugated0(u,v,o){       /* roll-up door: vertical ribs + slats */
  var rib=Math.sin(u*PI*2*9);
  var slat=wrap(v*7,1);
  var seam=1-smoothstep(0.01,0.05,Math.min(slat,1-slat));
  var n=fbm(u,v,3,50,1801);
  var scuff=smoothstep(0.6,0.86,fbm(u,v,3,12,1811))*(1-smoothstep(0.0,0.4,v));
  var l=96+rib*15+(n-0.5)*12 - seam*34 - scuff*28;
  o[0]=l*0.96; o[1]=l*0.99; o[2]=l*1.05;
  o[3]=(rib*0.5+0.5)*0.7+n*0.3 - seam*0.5;
  o[4]=clamp(0.44+(n-0.5)*0.14+scuff*0.2,0.1,1);
  o[5]=0.55;
}
/* hi-res set (Full / Ultra, painted in the background): the detailed painter */
function fnCorrugated(u,v,o,i,j){       /* roll-up door: vertical ribs + slats; rust weeping from the seams, scratches, dents */
  if(HQ<=1) return fnCorrugated0(u,v,o,i,j);
  var rib=Math.sin(u*PI*2*9);
  var sr=Math.floor(v*7), slat=wrap(v*7,1), sh=hashi(sr,3,1821);
  var seam=1-smoothstep(0.01,0.05,Math.min(slat,1-slat));
  var n=fbm(u,v,3,50,1801), dent=fbm(u,v,3,6,1823);
  var scuff=smoothstep(0.6,0.86,fbm(u,v,3,12,1811))*(1-smoothstep(0.0,0.4,v));
  var rusty=smoothstep(0.50,0.75,fbm(u,v,3,9,1827))*clamp(seam*0.9+(1-smoothstep(0.0,0.25,v))*0.6,0,1);
  var scr=smoothstep(0.88,0.96,vnoiseA(u,v,4,170,1831));
  var l=96+rib*15+(n-0.5)*12+(sh-0.5)*8+(dent-0.5)*10 - seam*34 - scuff*28 + scr*22;
  o[0]=lerp(l*0.96,112,rusty*0.7); o[1]=lerp(l*0.99,64,rusty*0.7); o[2]=lerp(l*1.05,38,rusty*0.7);
  o[3]=(rib*0.5+0.5)*0.7+n*0.2+dent*0.1 - seam*0.5 - scr*0.08;
  o[4]=clamp(0.44+(n-0.5)*0.14+scuff*0.2+rusty*0.3-scr*0.08,0.1,1);
  o[5]=0.55*(1-rusty*0.7)+scr*0.2;
}
/* base set (Lite, and the first paint on Full / Ultra): the original, cheap painter */
function fnDiamondPlate0(u,v,o){
  var s=6;
  var uu=wrap(u*s,1), vv=wrap(v*s,1);
  var cell=Math.floor(v*s);
  var a=wrap(uu+ (cell%2?0.5:0),1);
  /* two opposing diagonal lozenges per cell */
  var d1=Math.abs((a*2-1)+(vv*2-1)*0.55);
  var d2=Math.abs((a*2-1)-(vv*2-1)*0.55);
  var lug=Math.max(1-smoothstep(0.15,0.42,d1)*1.0, 1-smoothstep(0.15,0.42,d2));
  lug *= 1-smoothstep(0.3,0.48,Math.abs(vv-0.5));
  var n=fbm(u,v,3,80,1901);
  var l=94+lug*40+(n-0.5)*12;
  o[0]=l; o[1]=l*1.01; o[2]=l*1.05;
  o[3]=lug*0.85+n*0.15;
  o[4]=clamp(0.40-lug*0.12+(n-0.5)*0.1,0.1,1); o[5]=0.9;
}
/* hi-res set (Full / Ultra, painted in the background): the detailed painter */
function fnDiamondPlate(u,v,o,i,j){
  if(HQ<=1) return fnDiamondPlate0(u,v,o,i,j);
  var s=6;
  var uu=wrap(u*s,1), vv=wrap(v*s,1);
  var cell=Math.floor(v*s);
  var a=wrap(uu+ (cell%2?0.5:0),1);
  /* two opposing diagonal lozenges per cell */
  var d1=Math.abs((a*2-1)+(vv*2-1)*0.55);
  var d2=Math.abs((a*2-1)-(vv*2-1)*0.55);
  var lug=Math.max(1-smoothstep(0.15,0.42,d1)*1.0, 1-smoothstep(0.15,0.42,d2));
  lug *= 1-smoothstep(0.3,0.48,Math.abs(vv-0.5));
  var n=fbm(u,v,3,80,1901), dirt=fbm(u,v,3,12,1903), wear=smoothstep(0.45,0.8,fbm(u,v,3,7,1907));
  var scr=smoothstep(0.86,0.95,vnoiseA(u,v,5,230,1911))+smoothstep(0.88,0.96,vnoiseA(u,v,230,5,1913));
  /* tops polished bright by boots, dirt packed into the valleys */
  var l=94+lug*40+(n-0.5)*12 + lug*wear*22 - (1-lug)*dirt*26 + scr*14;
  o[0]=l; o[1]=l*1.01; o[2]=l*1.05;
  o[3]=lug*0.85+n*0.15-scr*0.05;
  o[4]=clamp(0.40-lug*0.12-lug*wear*0.14+(1-lug)*dirt*0.2+(n-0.5)*0.1,0.1,1); o[5]=0.9-(1-lug)*dirt*0.3;
}
/* base set (Lite, and the first paint on Full / Ultra): the original, cheap painter */
function fnPegboard0(u,v,o){
  var s=26;
  var hu=wrap(u*s,1)-0.5, hv=wrap(v*s,1)-0.5;
  var d=Math.sqrt(hu*hu+hv*hv);
  var hole=1-smoothstep(0.12,0.20,d);
  var n=fbm(u,v,3,50,2001);
  var l=116+(n-0.5)*17 - hole*88;
  o[0]=l*1.02; o[1]=l*0.92; o[2]=l*0.76;
  o[3]=n*0.4 - hole*0.9;
  o[4]=0.78+(n-0.5)*0.1; o[5]=0.02;
}
/* hi-res set (Full / Ultra, painted in the background): the detailed painter */
function fnPegboard(u,v,o,i,j){
  if(HQ<=1) return fnPegboard0(u,v,o,i,j);
  var s=26;
  var hu=wrap(u*s,1)-0.5, hv=wrap(v*s,1)-0.5;
  var d=Math.sqrt(hu*hu+hv*hv);
  var hole=1-smoothstep(0.12,0.20,d);
  var rim=smoothstep(0.20,0.27,d)*(1-smoothstep(0.27,0.36,d));      /* worn, greasy rim round each hole */
  var n=fbm(u,v,3,50,2001), fib=hashi(i,j,2003), dirt=fbm(u,v,3,6,2005);
  var l=116+(n-0.5)*17+(fib-0.5)*12 - hole*88 - rim*10*dirt - dirt*8;
  o[0]=l*1.02; o[1]=l*0.92; o[2]=l*0.76;
  o[3]=0.2+n*0.3+fib*0.08 - hole*0.95 + rim*0.06;
  o[4]=0.78+(n-0.5)*0.1-rim*0.08; o[5]=0.02;
}
/* distance to a knot at (cx,cy): wrapped on the unit square and stretched along the grain (u) */
function knotD(u,v,cx,cy){ var du=Math.abs(u-cx), dv=Math.abs(v-cy); if(du>0.5) du=1-du; if(dv>0.5) dv=1-dv; du*=0.45; return Math.sqrt(du*du+dv*dv); }
/* base set (Lite, and the first paint on Full / Ultra): the original, cheap painter */
function fnWood0(u,v,o){
  var rings=fbm(u*0.2,v,3,26,2101);
  var grain=Math.abs(Math.sin((v*11+rings*3)*PI));
  var n=fbm(u,v,2,120,2111);
  var l=94+grain*26+(n-0.5)*12;
  o[0]=l*1.12; o[1]=l*0.86; o[2]=l*0.6;
  o[3]=grain*0.6+n*0.4; o[4]=0.74+(1-grain)*0.12; o[5]=0.02;
}
/* hi-res set (Full / Ultra, painted in the background): the detailed painter */
function fnWood(u,v,o,i,j){
  if(HQ<=1) return fnWood0(u,v,o,i,j);
  /* two knots (wrapped distance, stretched along the grain) bend the rings round them */
  var k1=knotD(u,v,0.31,0.62), k2=knotD(u,v,0.79,0.21);
  var kn=(1-smoothstep(0.010,0.028,k1))+(1-smoothstep(0.008,0.022,k2));
  var bend=(1-smoothstep(0.02,0.16,k1))*0.6-(1-smoothstep(0.02,0.14,k2))*0.5;
  var rings=fbm(u*0.2,v,3,26,2101);
  var grain=Math.abs(Math.sin((v*11+rings*3+bend)*PI));
  var n=fbm(u,v,2,120,2111);
  var pores=smoothstep(0.78,0.90,vnoiseA(u,v,24,230,2121));        /* open pores: short dark dashes along the grain */
  var wear=fbm(u,v,3,5,2123);
  var l=94+grain*26+(n-0.5)*12 - pores*20 - kn*34 + (wear-0.5)*10;
  o[0]=l*1.12; o[1]=l*0.86; o[2]=l*0.6;
  o[3]=0.2+grain*0.45+n*0.2 - pores*0.3 - kn*0.12; o[4]=0.74+(1-grain)*0.12+pores*0.1-(wear-0.5)*0.1; o[5]=0.02;
}
/* base set (Lite, and the first paint on Full / Ultra): the original, cheap painter */
function fnPaintedSteelPanel0(u,v,o){
  var n=fbm(u,v,3,54,2201), dent=fbm(u,v,3,9,2211);
  var l=118+(n-0.5)*13+(dent-0.5)*9;
  o[0]=l; o[1]=l; o[2]=l;
  o[3]=n*0.5+dent*0.5; o[4]=0.45+(n-0.5)*0.12; o[5]=0.35;
}
/* hi-res set (Full / Ultra, painted in the background): the detailed painter */
function fnPaintedSteelPanel(u,v,o,i,j){
  if(HQ<=1) return fnPaintedSteelPanel0(u,v,o,i,j);
  var n=fbm(u,v,3,54,2201), dent=fbm(u,v,3,9,2211), peel=fbm(u,v,2,120,2213);
  var sc=smoothstep(0.88,0.96,vnoiseA(u,v,5,200,2217))+smoothstep(0.9,0.97,vnoiseA(u,v,200,5,2219));
  var wear=smoothstep(0.62,0.85,fbm(u,v,3,14,2221));
  var l=118+(n-0.5)*12+(dent-0.5)*9+(peel-0.5)*6+sc*18-wear*10;
  o[0]=l; o[1]=l; o[2]=l;
  o[3]=0.1+n*0.3+dent*0.4+peel*0.2-sc*0.15; o[4]=0.45+(n-0.5)*0.12+wear*0.18-sc*0.10; o[5]=0.35;
}
function fnGlassish(u,v,o){
  var n=fbm(u,v,2,40,2301);
  o[0]=190;o[1]=204;o[2]=214;
  o[3]=n*0.2; o[4]=0.05; o[5]=0.15;
}
/* --- v1.6 engine surfaces for Full / Ultra ------------------------------ */
function fnTurned(u,v,o){           /* lathe-turned face: concentric tool marks round the disc centre (disc uv 0..1) */
  var du=u-0.5, dv=v-0.5, r=Math.sqrt(du*du+dv*dv);
  var groove=0.5+0.5*Math.sin(r*TAU*70 + fbm(u,v,2,8,2401)*2.0);
  var chatter=fbm(u,v,2,64,2411);
  var l=160+(groove-0.5)*20+(chatter-0.5)*10;
  o[0]=l*0.99; o[1]=l; o[2]=l*1.03;
  o[3]=groove*0.7+chatter*0.3;
  o[4]=clamp(0.20+(1-groove)*0.14+(chatter-0.5)*0.08,0.08,0.6); o[5]=1.0;
}
function fnCarbon(u,v,o){           /* 2x2 twill carbon under a resin coat */
  var N=16, cx=Math.floor(u*N), cy=Math.floor(v*N), fx=u*N-cx, fy=v*N-cy;
  var s=wrap(cx-cy,4), horiz=s<2;
  var across=horiz?fy:fx, along=horiz?fx:fy;
  var crown=Math.sin(across*PI);                       /* round tow cross-section */
  var fibre=vnoise((horiz?v:u)*N*18, (horiz?u:v)*3, N*18, 2421);
  var l=22+crown*26+(fibre-0.5)*10+(horiz?5:0);
  o[0]=l; o[1]=l*1.02; o[2]=l*1.08;
  o[3]=crown*0.8+Math.sin(along*PI)*0.2;
  o[4]=clamp(0.30+(1-crown)*0.14,0,1); o[5]=0.15;
}
function heatBands(u, bands){
  for(var i=0;i<bands.length-1;i++){
    if(u>=bands[i][0]&&u<=bands[i+1][0]){
      var t=(u-bands[i][0])/(bands[i+1][0]-bands[i][0]);
      return [lerp(bands[i][1][0],bands[i+1][1][0],t), lerp(bands[i][1][1],bands[i+1][1][1],t), lerp(bands[i][1][2],bands[i+1][1][2],t)];
    }
  }
  return bands[bands.length-1][1];
}
var INCONEL_BANDS=[[0.00,[132,112,86]],[0.06,[168,128,62]],[0.12,[120,74,112]],[0.19,[70,82,140]],[0.28,[96,104,126]],[0.40,[128,124,118]],[1.0,[138,134,128]]];
function fnInconel(u,v,o){          /* thin-wall Inconel / titanium header: darker, straw -> purple -> blue from the flange (u) */
  var grain=fbm(u*3,v,3,64,2431), weld=fbm(u,v,2,160,2437);
  var col=heatBands(u, INCONEL_BANDS), gm=(grain-0.5)*14+(weld-0.5)*6;
  o[0]=col[0]+gm; o[1]=col[1]+gm; o[2]=col[2]+gm;
  o[3]=grain*0.7+weld*0.3;
  o[4]=clamp(0.30+(grain-0.5)*0.16,0.12,0.6); o[5]=1.0;
}
function fnInconelCast(u,v,o){      /* investment-cast Inconel turbine housing, fresh: fine grain, bright nickel grey, a faint even straw tint */
  var g=fbm(u,v,4,40,2441), fine=fbm(u,v,2,160,2443), tint=smoothstep(0.35,0.75,fbm(u,v,2,2,2447));
  var l=132+(g-0.5)*8+(fine-0.5)*8;
  o[0]=l+6+tint*8; o[1]=l+3+tint*4; o[2]=l-tint*4;
  o[3]=g*0.5+fine*0.5; o[4]=clamp(0.40+(1-g)*0.08,0,1); o[5]=0.85;
}
function fnTurbineHi(u,v,o){        /* Ni-resist housing, fresh: even cast grey, crisp sand grain, satin sheen */
  var g=fbm(u,v,4,30,2521), fine=fbm(u,v,2,140,2527), pit=smoothstep(0.84,0.96,fbm(u,v,2,70,2533));
  var l=116+(g-0.5)*12+(fine-0.5)*12-pit*24;
  o[0]=l+3; o[1]=l+1; o[2]=l;
  o[3]=g*0.5+fine*0.5-pit*0.4; o[4]=clamp(0.56+(1-g)*0.10+pit*0.12,0,1); o[5]=0.62;
}
function fnLoom(u,v,o){             /* split corrugated wiring conduit: ribs along u (uv scaled to length) */
  var rib=0.5+0.5*Math.cos(u*TAU*24);
  var n=fbm(u,v,2,40,2451);
  var l=24+rib*14+(n-0.5)*6;
  o[0]=l; o[1]=l; o[2]=l*1.04;
  o[3]=rib; o[4]=clamp(0.62-rib*0.18,0,1); o[5]=0.02;
}
function fnGasket(u,v,o){           /* graphite-faced gasket edge */
  var n=fbm(u,v,3,90,2461), mica=smoothstep(0.78,0.9,fbm(u,v,2,200,2467));
  var l=58+(n-0.5)*12+mica*40;
  o[0]=l; o[1]=l; o[2]=l*1.03;
  o[3]=n*0.5; o[4]=clamp(0.78-mica*0.4,0,1); o[5]=0.25+mica*0.5;
}
function fnShield(u,v,o){           /* stamped aluminised heat shield: dimple grid + heat bloom */
  var N=10, cx=Math.floor(u*N), cy=Math.floor(v*N), fx=u*N-cx-0.5, fy=v*N-cy-0.5;
  if(cy%2){ fx=wrap(u*N+0.5,1)-0.5; }
  var d=Math.sqrt(fx*fx+fy*fy), dimple=1-smoothstep(0.18,0.40,d);
  var n=fbm(u,v,3,40,2471), bloom=smoothstep(0.45,0.8,fbm(u,v,3,4,2477));
  var l=138+(n-0.5)*16-dimple*16;
  o[0]=l+bloom*14; o[1]=l-bloom*2; o[2]=l-bloom*20;
  o[3]=0.6-dimple*0.55+n*0.1;
  o[4]=clamp(0.52+(n-0.5)*0.14+bloom*0.12,0.1,0.85); o[5]=0.85;
}
function fnPaintSmooth(u,v,o){      /* enamel over a casting: faint orange peel (tinted) */
  var peel=fbm(u,v,2,70,2481), cast=fbm(u,v,3,14,2487);
  var l=196+(peel-0.5)*8+(cast-0.5)*8;
  o[0]=l; o[1]=l; o[2]=l;
  o[3]=peel*0.3+cast*0.7; o[4]=clamp(0.34+(peel-0.5)*0.08,0,1); o[5]=0.0;
}
function fnZinc(u,v,o){             /* zinc-plated fastener: faint yellow-blue passivate */
  var n=fbm(u,v,2,30,2491), irr=fbm(u,v,2,6,2497);
  var l=150+(n-0.5)*16;
  o[0]=l+(irr-0.5)*18; o[1]=l+(irr-0.5)*8; o[2]=l-(irr-0.5)*10;
  o[3]=n; o[4]=clamp(0.34+(n-0.5)*0.1,0,1); o[5]=1.0;
}
function fnBeltFlat(u,v,o){         /* flat belt back: rubber over a fabric weave (u along the belt, uv scaled to length) */
  var wv=Math.abs(Math.sin(u*PI*90))*Math.abs(Math.sin(v*PI*14));
  var n=fbm(u,v,2,40,2503);
  var l=24+wv*9+(n-0.5)*6;
  o[0]=l; o[1]=l; o[2]=l*1.05;
  o[3]=wv*0.7+n*0.3; o[4]=0.74-wv*0.08; o[5]=0.02;
}
function fnHoseWrap(u,v,o){         /* moulded hose: fine helical wrap impressions (u along the hose, uv scaled to length) */
  var wrapL=0.5+0.5*Math.sin((u*40+v)*TAU);
  var n=fbm(u,v,2,40,2511);
  var l=26+(n-0.5)*7+wrapL*4;
  o[0]=l; o[1]=l; o[2]=l;
  o[3]=wrapL*0.5+n*0.5; o[4]=0.70+(1-wrapL)*0.10; o[5]=0.03;
}

/* --- build all shared materials ---------------------------------------- */
function buildMaterials(){
  if(MATS_BUILT) return;
  MATS_BUILT=true;
  var S=256, L=512;

  MAT.iron        = pmat(S, fnCastIron,      {ns:1.1, env:0.9});
  MAT.cgi         = pmat(S, fnCGI,           {ns:0.8, env:1.0});
  MAT.calu        = pmat(S, fnCastAlu,       {ns:1.0, env:1.0});
  MAT.malu        = pmat(S, fnMachinedAlu,   {ns:0.55,env:1.2});
  MAT.palu        = pmat(S, fnPolishedAlu,   {ns:0.35,env:1.5});
  MAT.nikasil     = pmat(128,fnNikasil,      {ns:0.3, env:1.6});
  MAT.wrinkle     = pmat(S, fnWrinkle,       {ns:1.05,env:0.7});
  MAT.anod        = pmat(S, fnAnodised,      {ns:0.7, env:1.1});
  MAT.stainless   = pmat(S, fnStainless,     {ns:0.6, env:1.2, emissive:0xff4a08, emissiveIntensity:0});
  MAT.castexh     = pmat(S, fnCastExh,       {ns:1.2, env:0.7, emissive:0xff3a06, emissiveIntensity:0});
  MAT.turbine     = pmat(S, fnTurbine,       {ns:1.1, env:0.8, emissive:0xff3a06, emissiveIntensity:0});
  MAT.belt        = pmat(128,fnRubberBelt,   {ns:1.2, env:0.4});
  MAT.hose        = pmat(128,fnHose,         {ns:0.8, env:0.4});
  MAT.steel       = pmat(S, fnSteel,         {ns:0.6, env:1.2});
  MAT.dark        = pmat(S, fnDarkComposite, {ns:0.9, env:0.6});
  MAT.paint       = pmat(S, fnPaintChipped,  {ns:0.55,env:0.85});

  MAT.concrete    = pmat(L, fnConcrete,      {ns:0.55,env:0.35, hero:true});   /* hero: the Ultra floor goes to 2048 */
  MAT.tile        = pmat(L, fnTileFloor,     {ns:0.6, env:0.8});
  MAT.block       = pmat(L, fnCinderBlock,   {ns:0.85,env:0.3});
  MAT.door        = pmat(S, fnCorrugated,    {ns:1.4, env:0.7});
  MAT.plate       = pmat(S, fnDiamondPlate,  {ns:1.0, env:0.6});
  MAT.peg         = pmat(S, fnPegboard,      {ns:1.2, env:0.4});
  MAT.wood        = pmat(S, fnWood,          {ns:0.8, env:0.4});
  MAT.panel       = pmat(S, fnPaintedSteelPanel,{ns:0.6, env:0.9});
  MAT.glass       = pmat(64, fnGlassish,     {ns:0.2, env:1.6, transparent:true, opacity:0.28});
  MAT.anodRaw     = MAT.anod;     /* untinted anodised runners, merged into their own bucket */
  MAT.wireRed     = new THREE.MeshStandardMaterial({color:sc(0x431310), roughness:0.88, metalness:0.0, envMapIntensity:0.18});

  /* tinted clones (share textures, differ only by .color) */
  MAT.paintOrange = tint(MAT.paint, 0xa65a40);   /* Longlight clay, shaded */
  MAT.paintBlue   = tint(MAT.paint, 0x2b5183);
  MAT.paintGrey   = tint(MAT.paint, 0x5d646b);
  MAT.blockPaint  = tint(MAT.block, 0xbdb9ac);
  MAT.blockWhite  = tint(MAT.block, 0xeceeef);
  MAT.woodDark    = tint(MAT.wood,  0x9a7a52);

  /* anti-tiling layer (Full / Ultra) on the garage's repeating surfaces: (macro tint, mid-scale breakup, roughness) */
  aaPatch(MAT.concrete, 0.26, 0.15, 0.20); aaPatch(MAT.tile, 0.12, 0.08, 0.12); aaPatch(MAT.block, 0.20, 0.12, 0.14);
  aaPatch(MAT.blockPaint, 0.20, 0.12, 0.14); aaPatch(MAT.blockWhite, 0.16, 0.10, 0.14);
  aaPatch(MAT.door, 0.14, 0.08, 0.14); aaPatch(MAT.plate, 0.14, 0.08, 0.12); aaPatch(MAT.peg, 0.16, 0.10, 0.10);
  aaPatch(MAT.wood, 0.20, 0.10, 0.10); aaPatch(MAT.woodDark, 0.20, 0.10, 0.10); aaPatch(MAT.panel, 0.12, 0.08, 0.12);

  /* emissive / flat helpers */
  MAT.lamp   = new THREE.MeshStandardMaterial({color:sc(0xfff6e4), emissive:sc(0xfff2dc), emissiveIntensity:2.3, roughness:0.4});
  MAT.lampCool=new THREE.MeshStandardMaterial({color:sc(0xeaf4ff), emissive:sc(0xdcecff), emissiveIntensity:2.6, roughness:0.4});
  MAT.screenAmber=new THREE.MeshStandardMaterial({color:sc(0x100c04), emissive:sc(0xffa42a), emissiveIntensity:1.5, roughness:0.3});
  MAT.screenBlue =new THREE.MeshStandardMaterial({color:sc(0x04080f), emissive:sc(0x36a8ff), emissiveIntensity:1.5, roughness:0.3});
  MAT.screenGreen=new THREE.MeshStandardMaterial({color:sc(0x04100a), emissive:sc(0x54d68e), emissiveIntensity:1.3, roughness:0.3});
  MAT.rubberFlat =new THREE.MeshStandardMaterial({color:sc(0x17181a), roughness:0.92, metalness:0.02, envMapIntensity:0.35});
  MAT.blackPlast =new THREE.MeshStandardMaterial({color:sc(0x232529), roughness:0.66, metalness:0.06, envMapIntensity:0.5});
  MAT.chrome     =new THREE.MeshStandardMaterial({color:sc(0xbcc2c8), roughness:0.16, metalness:1.0});
  MAT.copper     =new THREE.MeshStandardMaterial({color:sc(0xc07434), roughness:0.34, metalness:1.0});
  MAT.filterRed  =new THREE.MeshStandardMaterial({color:sc(0xa3241d), roughness:0.86, metalness:0.0, envMapIntensity:0.4});   /* oiled cotton filter element */

  /* signage */
  MAT.sign = drawMat(1024,256,function(x,w,h){
    x.fillStyle="#171a1e"; x.fillRect(0,0,w,h);
    x.strokeStyle="#e2731f"; x.lineWidth=8; x.strokeRect(12,12,w-24,h-24);
    x.fillStyle="#efe6d2"; x.textAlign="center"; x.textBaseline="middle";
    x.font="700 96px Impact, 'Arial Narrow', sans-serif";
    x.fillText("PRAIRIE ENGINE WORKS", w/2, h/2-14);
    x.fillStyle="#e2731f"; x.font="600 34px Impact, 'Arial Narrow', sans-serif";
    x.fillText("ENGINE BUILDING  ·  DYNO  ·  MACHINE SHOP", w/2, h/2+56);
  },{rough:0.62});

  MAT.poster1 = drawMat(512,704,function(x,w,h){
    x.fillStyle="#c9c0aa"; x.fillRect(0,0,w,h);
    var g=x.createLinearGradient(0,0,0,h); g.addColorStop(0,"#1d2b46"); g.addColorStop(1,"#5c3a1c");
    x.fillStyle=g; x.fillRect(24,24,w-48,h*0.56);
    /* crude engine silhouette */
    x.fillStyle="#0d1218";
    x.fillRect(w*0.24,h*0.22,w*0.52,h*0.22);
    x.fillRect(w*0.30,h*0.14,w*0.40,h*0.09);
    for(var i=0;i<4;i++) x.fillRect(w*0.30+i*w*0.10,h*0.10,w*0.05,h*0.05);
    x.fillStyle="#1a1a1a"; x.textAlign="center";
    x.font="700 62px Impact, sans-serif"; x.fillText("BUILD IT", w/2, h*0.72);
    x.fillStyle="#a8331b"; x.font="700 62px Impact, sans-serif"; x.fillText("RIGHT", w/2, h*0.80);
    x.fillStyle="#3a3a3a"; x.font="500 24px sans-serif"; x.fillText("PRAIRIE ENGINE WORKS · EST. 1974", w/2, h*0.90);
  },{rough:0.85});

  MAT.poster2 = drawMat(512,384,function(x,w,h){
    x.fillStyle="#e8e2d4"; x.fillRect(0,0,w,h);
    x.strokeStyle="#8a8578"; x.lineWidth=2;
    for(var i=0;i<=10;i++){ x.beginPath(); x.moveTo(40,h-40-i*(h-70)/10); x.lineTo(w-20,h-40-i*(h-70)/10); x.stroke(); }
    x.strokeStyle="#a8331b"; x.lineWidth=6; x.beginPath();
    for(var k=0;k<=40;k++){ var t=k/40; var y=h-50-Math.pow(Math.sin(t*2.6),1.4)*(h-110); x.lineTo(40+t*(w-70), y); }
    x.stroke();
    x.strokeStyle="#1d4f8a"; x.lineWidth=6; x.beginPath();
    for(var k2=0;k2<=40;k2++){ var t2=k2/40; var y2=h-50-Math.sin(t2*2.1+0.4)*(h-140)*0.8; x.lineTo(40+t2*(w-70), y2); }
    x.stroke();
    x.fillStyle="#1a1a1a"; x.font="700 30px sans-serif"; x.textAlign="left";
    x.fillText("POWER / TORQUE", 44, 34);
  },{rough:0.85});

  MAT.raceBanner = drawMat(1024,224,function(x,w,h){
    x.fillStyle="#e2731f"; x.fillRect(0,0,w,h);
    x.fillStyle="#1a1206"; x.textAlign="center"; x.textBaseline="middle";
    x.font="700 132px Impact, sans-serif"; x.fillText("RACE BAY", w/2, h/2+6);
  },{rough:0.8});

  MAT.dynoScreen = drawMat(512,320,function(x,w,h){
    x.fillStyle="#06090e"; x.fillRect(0,0,w,h);
    x.strokeStyle="#123048"; x.lineWidth=2;
    for(var i=1;i<8;i++){x.beginPath();x.moveTo(i*w/8,0);x.lineTo(i*w/8,h);x.stroke();}
    for(var j=1;j<5;j++){x.beginPath();x.moveTo(0,j*h/5);x.lineTo(w,j*h/5);x.stroke();}
    x.strokeStyle="#ff9a2a"; x.lineWidth=5; x.beginPath();
    for(var k=0;k<=40;k++){var t=k/40;x.lineTo(t*w, h-20-Math.pow(Math.sin(t*2.5),1.3)*(h-60));}
    x.stroke();
    x.strokeStyle="#38b6ff"; x.lineWidth=5; x.beginPath();
    for(var k2=0;k2<=40;k2++){var t2=k2/40;x.lineTo(t2*w, h-20-Math.sin(t2*2.0+0.5)*(h-90)*0.85);}
    x.stroke();
    x.fillStyle="#cfe4f4"; x.font="700 34px monospace"; x.textAlign="left";
    x.fillText("DYNO", 14, 40);
  },{emissive:0xffffff, emissiveIntensity:0.85, emissiveMap:true, rough:0.3});

  MAT.toolboard = drawMat(512,512,function(x,w,h){
    /* pegboard base */
    x.fillStyle="#8d6a45"; x.fillRect(0,0,w,h);
    x.fillStyle="rgba(0,0,0,0.55)";
    for(var j=0;j<26;j++)for(var i=0;i<26;i++){
      x.beginPath(); x.arc((i+0.5)*w/26,(j+0.5)*h/26,2.4,0,TAU); x.fill();
    }
    /* hanging tools */
    function wrench(cx,cy,len,wid,col){
      x.save(); x.translate(cx,cy); x.fillStyle=col;
      x.fillRect(-wid*0.28,0,wid*0.56,len);
      x.beginPath(); x.arc(0,0,wid*0.72,0,TAU); x.fill();
      x.beginPath(); x.arc(0,len,wid*0.6,0,TAU); x.fill();
      x.globalCompositeOperation="destination-out";
      x.beginPath(); x.arc(0,-wid*0.15,wid*0.36,0,TAU); x.fill();
      x.beginPath(); x.arc(0,len+wid*0.1,wid*0.30,0,TAU); x.fill();
      x.globalCompositeOperation="source-over"; x.restore();
    }
    for(var t=0;t<7;t++) wrench(46+t*36, 40, 120-t*7, 24-t*1.4, t%2?"#c9ced4":"#aeb4bb");
    /* screwdrivers */
    for(var s=0;s<6;s++){
      x.fillStyle="#b9bec4"; x.fillRect(300+s*30, 210, 6, 96);
      x.fillStyle=["#b8352c","#2c5fb8","#c9a227"][s%3]; x.fillRect(296+s*30, 306, 14, 52);
    }
    /* hammer + pliers block */
    x.fillStyle="#7a5a3a"; x.fillRect(40,220,16,110);
    x.fillStyle="#8f959c"; x.fillRect(24,206,50,26);
    x.fillStyle="#9aa0a7"; x.fillRect(120,230,12,90); x.fillRect(148,230,12,90);
    x.fillStyle="#b8352c"; x.fillRect(118,320,16,52); x.fillRect(146,320,16,52);
    /* shadow under tools */
    x.fillStyle="rgba(0,0,0,0.25)"; x.fillRect(0,h-16,w,16);
  },{rough:0.8});
}
function sc(hex){ return new THREE.Color(hex).convertSRGBToLinear(); }
/* clones copy userData but not onBeforeCompile: drop the heat flag so heatPatch() patches the clone too */
function tint(base, color){
  var m=base.clone(); m.color=sc(color); delete m.userData.heat; return m;
}
/* per-build clone so emissive can animate independently */
function liveClone(base){ var m=base.clone(); m.emissiveIntensity=0; delete m.userData.heat; m.userData.perBuild=true; return m; }

/* --- Full / Ultra material set: same keys as MAT (so the builder code is shared), plus new ones.
   Clones share MAT's textures; only the new surfaces generate maps. Built on first non-Lite build. --- */
var MATHI = {}, HI_BUILT = false, HI_OF = null;   /* HI_OF: Map MAT[k] -> MATHI[k] (for meshes built with MAT.x directly) */
function hiFlag(m){ m.userData.hi=true; return m; }
function buildHiMaterials(){
  if(HI_BUILT) return; HI_BUILT=true;
  var S=256, k;
  /* 1:1 clones of the shared engine materials (hi-tier grime shader) */
  ["iron","cgi","calu","malu","palu","nikasil","wrinkle","anod","stainless","castexh","turbine","belt","hose","steel","dark",
   "paint","paintOrange","paintBlue","paintGrey","rubberFlat","blackPlast","chrome","copper"].forEach(function(key){
     var m=MAT[key].clone(); m.userData={}; MATHI[key]=hiFlag(m);
  });
  /* painted parts get a real clear coat; bare castings stay rough */
  ["paint","paintOrange","paintBlue","paintGrey"].forEach(function(key){ MATHI[key]=hiFlag(toPhysical(MATHI[key], 0.55, 0.22)); });
  MATHI.iron.normalScale.set(1.3,1.3); MATHI.stainless.normalScale.set(0.35,0.35); MATHI.calu.normalScale.set(1.15,1.15); MATHI.castexh.normalScale.set(1.4,1.4);
  /* new surfaces */
  MATHI.turbine   = hiFlag(pmat(S, fnTurbineHi,   {ns:1.2, env:0.8, emissive:0xff3a06, emissiveIntensity:0}));
  MATHI.turned    = hiFlag(pmat(S, fnTurned,      {ns:0.7, env:1.3}));
  MATHI.carbon    = hiFlag(toPhysical(pmat(S, fnCarbon, {ns:0.9, env:1.0}), 1.0, 0.06));
  MATHI.inconel   = hiFlag(pmat(S, fnInconel,     {ns:0.5, env:1.1, emissive:0xff4a08, emissiveIntensity:0}));
  MATHI.inconelCast=hiFlag(pmat(S, fnInconelCast, {ns:0.8, env:0.9, emissive:0xff3a06, emissiveIntensity:0}));
  MATHI.loom      = hiFlag(pmat(128,fnLoom,       {ns:1.4, env:0.5}));
  MATHI.gasket    = hiFlag(pmat(128,fnGasket,     {ns:0.6, env:0.5}));
  MATHI.shield    = hiFlag(pmat(S, fnShield,      {ns:1.6, env:0.75}));
  MATHI.enamel    = hiFlag(pmat(S, fnPaintSmooth, {ns:0.35,env:0.9}));
  MATHI.zinc      = hiFlag(pmat(64, fnZinc,       {ns:0.4, env:1.2}));
  MATHI.beltFlat  = hiFlag(pmat(128,fnBeltFlat,   {ns:1.0, env:0.4}));
  MATHI.hoseWrap  = hiFlag(pmat(128,fnHoseWrap,   {ns:0.9, env:0.45}));
  MATHI.wireRed   = hiFlag(new THREE.MeshStandardMaterial({color:sc(0x431310), roughness:0.62, metalness:0.0, envMapIntensity:0.4}));
  MATHI.wireBlk   = hiFlag(new THREE.MeshStandardMaterial({color:sc(0x141517), roughness:0.55, metalness:0.0, envMapIntensity:0.45}));
  MATHI.connGrey  = hiFlag(new THREE.MeshStandardMaterial({color:sc(0x3b3f45), roughness:0.52, metalness:0.0, envMapIntensity:0.55}));
  MATHI.brass     = hiFlag(new THREE.MeshStandardMaterial({color:sc(0xb08a3e), roughness:0.32, metalness:1.0}));
  MATHI.anodRaw   = MATHI.anod;
  HI_OF = new Map();
  for(k in MAT) if(MATHI[k] && MAT[k]!==MATHI[k]) HI_OF.set(MAT[k], MATHI[k]);
}
/* cam-cover finish per OPT.cover (Full / Ultra): crackle, satin, gloss enamel, bare cast, gold chromate */
var COVER_FINISH = { red:"crackle", black:"satin", orange:"gloss", blue:"gloss", silver:"cast", gold:"irridite" };
function coverFinish(name, hex){
  var f=COVER_FINISH[name]||"crackle", m;
  if(f==="crackle"){ m=toPhysical(MATHI.wrinkle, 0.18, 0.5); m.color=sc(hex); }
  else if(f==="satin"){ m=toPhysical(MATHI.enamel, 0.35, 0.42); m.color=sc(hex); m.roughness=1.45; }
  else if(f==="gloss"){ m=toPhysical(MATHI.enamel, 1.0, 0.08); m.color=sc(hex); }
  else if(f==="cast"){ m=MATHI.calu.clone(); m.color=sc(0xffffff); m.envMapIntensity=1.25; }
  else { m=MATHI.anod.clone(); m.color=sc(0xc9a24a); m.envMapIntensity=1.3; }
  m.userData={hi:true, perBuild:true};
  return m;
}

/* ===========================================================================
   3. GEOMETRY HELPERS + CACHE
   ==========================================================================*/
var GEO = {};
function gkey(){ return Array.prototype.join.call(arguments,"_"); }
function r3(v){ return Math.round(v*1000)/1000; }

/* planar (triplanar-by-dominant-normal) UVs scaled to world size * k */
function planarUV(geo,k){
  var p=geo.attributes.position, n=geo.attributes.normal;
  var uv=new Float32Array(p.count*2);
  for(var i=0;i<p.count;i++){
    var nx=Math.abs(n.getX(i)), ny=Math.abs(n.getY(i)), nz=Math.abs(n.getZ(i));
    var u,v;
    if(nx>=ny&&nx>=nz){ u=p.getZ(i); v=p.getY(i); }
    else if(ny>=nz){ u=p.getX(i); v=p.getZ(i); }
    else { u=p.getX(i); v=p.getY(i); }
    uv[i*2]=u*k; uv[i*2+1]=v*k;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv,2));
  return geo;
}
function scaleUV(geo,su,sv){
  var uv=geo.attributes.uv;
  for(var i=0;i<uv.count;i++) uv.setXY(i, uv.getX(i)*su, uv.getY(i)*sv);
  return geo;
}
var TK = 2.2;  /* default texel scale: one texture tile ≈ 45 mm */

function cache(key,g){ g.__cached=true; GEO[key]=g; return g; }
function BOX(w,h,d,k){
  k=k===undefined?TK:k;
  var key=gkey("b",r3(w),r3(h),r3(d),k);
  if(!GEO[key]) cache(key, planarUV(new THREE.BoxGeometry(w,h,d),k));
  return GEO[key];
}
/* chamfered box — hero parts */
function RBOX(w,h,d,r,k){
  k=k===undefined?TK:k;
  r=Math.min(r, w/2*0.9, h/2*0.9, d/2*0.9);
  var key=gkey("rb",r3(w),r3(h),r3(d),r3(r),k);
  if(GEO[key]) return GEO[key];
  var g=new THREE.BoxGeometry(w,h,d,3,3,3);
  var p=g.attributes.position;
  var hw=w/2-r, hh=h/2-r, hd=d/2-r;
  for(var i=0;i<p.count;i++){
    var x=p.getX(i), y=p.getY(i), z=p.getZ(i);
    var ix=clamp(x,-hw,hw), iy=clamp(y,-hh,hh), iz=clamp(z,-hd,hd);
    var dx=x-ix, dy=y-iy, dz=z-iz, l=Math.sqrt(dx*dx+dy*dy+dz*dz);
    if(l>1e-6) p.setXYZ(i, ix+dx/l*r, iy+dy/l*r, iz+dz/l*r);
  }
  g.computeVertexNormals();
  cache(key, planarUV(g,k));
  return GEO[key];
}
function CYL(rt,rb,h,seg,open,k){
  k=k===undefined?TK:k;
  seg=seg||18;
  var key=gkey("c",r3(rt),r3(rb),r3(h),seg,open?1:0,k);
  if(!GEO[key]){
    var g=new THREE.CylinderGeometry(rt,rb,h,seg,1,!!open);
    scaleUV(g, TAU*Math.max(rt,rb)*k, h*k);
    cache(key,g);
  }
  return GEO[key];
}
function SPH(r,seg,k){
  k=k===undefined?TK:k;
  seg=seg||14;
  var key=gkey("s",r3(r),seg,k);
  if(!GEO[key]){ var g=new THREE.SphereGeometry(r,seg,Math.max(6,seg>>1)); scaleUV(g,TAU*r*k,PI*r*k); cache(key,g); }
  return GEO[key];
}
function TOR(r,t,seg,tseg,k){
  k=k===undefined?TK:k;
  seg=seg||10; tseg=tseg||22;
  var key=gkey("t",r3(r),r3(t),seg,tseg,k);
  if(!GEO[key]){ var g=new THREE.TorusGeometry(r,t,seg,tseg); scaleUV(g,TAU*r*k,TAU*t*k); cache(key,g); }
  return GEO[key];
}
function CONE(rt,rb,h,seg,k){ return CYL(rt,rb,h,seg,true,k); }
/* tube along a point list; uv left at 0..1 (heat-tint gradient uses it) */
function TUBE(pts,rad,tubular,radial,closed){
  var curve=new THREE.CatmullRomCurve3(pts, !!closed, "catmullrom", 0.25);
  return new THREE.TubeGeometry(curve, tubular||18, rad, radial||9, !!closed);
}
/* spiral volute ("snail") round the X axis: the tube centre walks out from Ra to Rb while its section grows from
   ra to rb over `sweep` radians, starting at angle 0 in the YZ plane and winding toward +Z */
function VOLUTE(Ra,Rb,ra,rb,sweep,nT,nR,k){
  k=k===undefined?TK:k;
  var key=gkey("vo",r3(Ra),r3(Rb),r3(ra),r3(rb),r3(sweep),nT,nR,k);
  if(GEO[key]) return GEO[key];
  var pos=[], nor=[], uv=[], idx=[], i, j;
  for(i=0;i<=nT;i++){
    var t=i/nT, th=t*sweep, R=Ra+(Rb-Ra)*t, r=ra+(rb-ra)*Math.pow(t,0.85), c=Math.cos(th), sn=Math.sin(th);
    for(j=0;j<=nR;j++){
      var ph=j/nR*TAU, cp=Math.cos(ph), sp=Math.sin(ph);
      pos.push(r*sp, (R+r*cp)*c, (R+r*cp)*sn);
      nor.push(sp, cp*c, cp*sn);
      uv.push(th*R*k, ph*r*k);
    }
  }
  for(i=0;i<nT;i++) for(j=0;j<nR;j++){
    var a=i*(nR+1)+j, b=a+nR+1;
    idx.push(a,b,a+1, b,b+1,a+1);
  }
  var g=new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute("normal",   new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute("uv",       new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx);
  return cache(key,g);
}
/* square turbine-inlet flange (T3/T4 style): w x w plate, h x h port, thickness along Y */
function SQFLANGE(w,h,t,k){
  k=k===undefined?TK:k;
  var key=gkey("sf",r3(w),r3(h),r3(t),k);
  if(GEO[key]) return GEO[key];
  var W=w/2, H=h/2, cr=w*0.12, sh=new THREE.Shape();
  sh.moveTo(-W+cr,-W); sh.lineTo(W-cr,-W); sh.quadraticCurveTo(W,-W,W,-W+cr); sh.lineTo(W,W-cr); sh.quadraticCurveTo(W,W,W-cr,W);
  sh.lineTo(-W+cr,W); sh.quadraticCurveTo(-W,W,-W,W-cr); sh.lineTo(-W,-W+cr); sh.quadraticCurveTo(-W,-W,-W+cr,-W);
  var hole=new THREE.Path(); hole.moveTo(-H,-H); hole.lineTo(-H,H); hole.lineTo(H,H); hole.lineTo(H,-H); hole.lineTo(-H,-H);
  sh.holes.push(hole);
  var g=new THREE.ExtrudeGeometry(sh, {depth:t, bevelEnabled:false, curveSegments:3});
  g.translate(0,0,-t/2); g.rotateX(-PI/2);
  return cache(key, planarUV(g.toNonIndexed(),k));
}
/* pleated cone filter element along Y: base radius r0 at -Y, tip r1 at +Y, nP pleats of depth d, hard pleat edges */
function PLEATCONE(r0,r1,L,nP,d){
  var key=gkey("pc",r3(r0),r3(r1),r3(L),nP,r3(d));
  if(GEO[key]) return GEO[key];
  var nA=nP*2, nL=2, pos=[], idx=[], i, j;
  for(j=0;j<=nL;j++){ var y=-L/2+L*j/nL, R=r0+(r1-r0)*j/nL;
    for(i=0;i<=nA;i++){ var th=i/nA*TAU, rr=R-((i&1)?d:0); pos.push(Math.cos(th)*rr, y, Math.sin(th)*rr); } }
  for(j=0;j<nL;j++) for(i=0;i<nA;i++){ var a=j*(nA+1)+i, c=a+nA+1; idx.push(a,c,a+1, a+1,c,c+1); }
  var g=new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx);
  g=g.toNonIndexed(); g.computeVertexNormals();
  g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
  return cache(key,g);
}
/* open bore seen from inside (normals and winding turned in), axis Y */
function BORE(r,h,seg,k){
  k=k===undefined?TK:k;
  var key=gkey("bo",r3(r),r3(h),seg,k);
  if(GEO[key]) return GEO[key];
  var g=new THREE.CylinderGeometry(r,r,h,seg,1,true), ix=g.index.array, n=g.attributes.normal;
  for(var i=0;i<ix.length;i+=3){ var t=ix[i+1]; ix[i+1]=ix[i+2]; ix[i+2]=t; }
  for(i=0;i<n.count;i++) n.setXYZ(i,-n.getX(i),-n.getY(i),-n.getZ(i));
  scaleUV(g, TAU*r*k, h*k);
  return cache(key,g);
}
/* flat annulus facing +Z */
function RING(ri,ro,seg,k){
  k=k===undefined?TK:k;
  var key=gkey("rg",r3(ri),r3(ro),seg,k);
  if(GEO[key]) return GEO[key];
  return cache(key, planarUV(new THREE.RingGeometry(ri,ro,seg,1),k));
}
function V3(x,y,z){ return new THREE.Vector3(x,y,z); }
function mkM(x,y,z,rx,ry,rz,sx,sy,sz){
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x||0,y||0,z||0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx||0,ry||0,rz||0,"XYZ")),
    new THREE.Vector3(sx===undefined?1:sx, sy===undefined?1:sy, sz===undefined?1:sz));
}

/* ---- merge (BufferGeometryUtils-free) --------------------------------- */
var _m4 = new THREE.Matrix4(), _m3 = new THREE.Matrix3(), _v3 = new THREE.Vector3();
function nonIndexed(g){
  if(!g.index) return g;
  if(!g.__ni) g.__ni = g.toNonIndexed();
  return g.__ni;
}
function mergeGeos(items){
  var count=0, i, prep=[];
  for(i=0;i<items.length;i++){
    var ni=nonIndexed(items[i].g);
    count += ni.attributes.position.count;
    prep.push({ni:ni, m:items[i].m});
  }
  var pos=new Float32Array(count*3), nor=new Float32Array(count*3), uv=new Float32Array(count*2), zn=new Float32Array(count);
  var o=0, o2=0, oz=0;
  for(i=0;i<prep.length;i++){
    var P=prep[i].ni.attributes.position, N=prep[i].ni.attributes.normal, U=prep[i].ni.attributes.uv;
    var M=prep[i].m; _m3.getNormalMatrix(M); var zv=items[i].z||0;
    for(var v=0; v<P.count; v++){
      zn[oz++]=zv;
      _v3.fromBufferAttribute(P,v).applyMatrix4(M);
      pos[o]=_v3.x; pos[o+1]=_v3.y; pos[o+2]=_v3.z;
      if(N){ _v3.fromBufferAttribute(N,v).applyMatrix3(_m3).normalize();
             nor[o]=_v3.x; nor[o+1]=_v3.y; nor[o+2]=_v3.z; }
      o+=3;
      if(U){ uv[o2]=U.getX(v); uv[o2+1]=U.getY(v); }
      o2+=2;
    }
  }
  var g=new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos,3));
  g.setAttribute("normal",   new THREE.BufferAttribute(nor,3));
  g.setAttribute("uv",       new THREE.BufferAttribute(uv,2));
  g.setAttribute("zone",     new THREE.BufferAttribute(zn,1));
  g.computeBoundingSphere();
  return g;
}
/* --- heat-map shader hook: one vec4 per zone (rgb tint, a = amount), shared by every material --- */
var HEAT_UNIFORM = { value: (function(){ var a=[]; for(var i=0;i<16;i++) a.push(new THREE.Vector4(0,0,0,0)); return a; })() };
/* Full / Ultra variant: grime lives in object space (no screen-space crawl), settles as dust on up-facing
   surfaces and oily soot underneath, and rubs edges bright; applied before the heat tint so the map still reads */
var GRIME_HI_GLSL =
  "float pewH(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }\n"+
  "float pewN(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);\n"+
  "  return mix(mix(mix(pewH(i),pewH(i+vec3(1.,0.,0.)),f.x), mix(pewH(i+vec3(0.,1.,0.)),pewH(i+vec3(1.,1.,0.)),f.x), f.y),\n"+
  "             mix(mix(pewH(i+vec3(0.,0.,1.)),pewH(i+vec3(1.,0.,1.)),f.x), mix(pewH(i+vec3(0.,1.,1.)),pewH(i+vec3(1.,1.,1.)),f.x), f.y), f.z); }\n";
function heatPatchHi(mat){
  mat.onBeforeCompile = function(shader){
    shader.uniforms.uHeat = HEAT_UNIFORM; shader.uniforms.uGrime = GRIME_UNIFORM;
    shader.vertexShader = "attribute float zone;\nvarying float vZone;\nvarying vec3 vGP;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvZone = zone; vGP = position;");
    shader.fragmentShader = "varying float vZone;\nvarying vec3 vGP;\nuniform vec4 uHeat[16];\nuniform float uGrime;\n" + GRIME_HI_GLSL + shader.fragmentShader.replace("#include <dithering_fragment>",
      "#include <dithering_fragment>\n{ if(uGrime > 0.001 && vZone > 0.5){\n"+
      "  float gn = pewN(vGP*2.3)*0.62 + pewN(vGP*8.1)*0.38;\n"+
      "  vec3 wN = normalize((vec4(geometryNormal,0.0)*viewMatrix).xyz);\n"+
      "  float up = clamp(wN.y,0.0,1.0), dn = clamp(-wN.y,0.0,1.0);\n"+
      "  float edge = clamp(length(fwidth(geometryNormal))*2.6-0.12, 0.0, 1.0);\n"+
      "  float g = uGrime*smoothstep(0.28,0.86,gn);\n"+
      "  gl_FragColor.rgb *= 1.0 - 0.36*g*(0.55+0.45*dn);\n"+
      "  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.19,0.16,0.115), 0.32*g*up);\n"+
      "  gl_FragColor.rgb += vec3(0.055)*edge*min(uGrime,1.0)*(1.0-g);\n"+
      "}\n"+
      "vec4 h = uHeat[int(vZone + 0.5)]; gl_FragColor.rgb = mix(gl_FragColor.rgb, h.rgb, h.a); }");
  };
  mat.customProgramCacheKey = function(){ return "heatHi"; };
}
function heatPatch(mat){
  if(!mat || mat.userData.heat) return mat;
  mat.userData.heat = true;
  if(mat.userData.hi){ heatPatchHi(mat); mat.needsUpdate = true; return mat; }
  var prevO = mat.userData.aa ? mat.onBeforeCompile : null, prevK = mat.userData.aa ? mat.customProgramCacheKey : null;
  mat.onBeforeCompile = function(shader){
    if(prevO) prevO.call(this, shader);
    shader.uniforms.uHeat = HEAT_UNIFORM; shader.uniforms.uGrime = GRIME_UNIFORM;
    shader.vertexShader = "attribute float zone;\nvarying float vZone;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvZone = zone;");
    shader.fragmentShader = "varying float vZone;\nuniform vec4 uHeat[16];\nuniform float uGrime;\n" + shader.fragmentShader.replace("#include <dithering_fragment>",
      "#include <dithering_fragment>\n{ vec4 h = uHeat[int(vZone + 0.5)]; gl_FragColor.rgb = mix(gl_FragColor.rgb, h.rgb, h.a); if(vZone > 0.5){ float gr = uGrime * (0.55 + 0.45 * fract(sin(dot(gl_FragCoord.xy * 0.021, vec2(12.9898, 78.233))) * 43758.5453)); gl_FragColor.rgb *= 1.0 - 0.30 * gr; gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.16,0.13,0.09), 0.22 * gr); } }");
  };
  mat.customProgramCacheKey = function(){ return "heat"+(prevK ? prevK.call(this) : ""); };
  mat.needsUpdate = true;
  return mat;
}

/* ---- builder: accumulates geometry per material key ------------------- */
/* heat-map zones: every geometry carries the zone that was current when it was added */
var ZONE=0, ZONE_MARKS=[], ZONE_EXTRAS=null;
function setZone(z){ ZONE=z; if(ZONE_EXTRAS) ZONE_MARKS.push([ZONE_EXTRAS.length, z]); }
function zoneGeo(g, z){ if(!g||!g.attributes||!g.attributes.position) return g; var n=g.attributes.position.count; var a=new Float32Array(n); for(var i=0;i<n;i++) a[i]=z; g.setAttribute("zone", new THREE.BufferAttribute(a,1)); return g; }
function Builder(){ this.buckets={}; this.stack=[new THREE.Matrix4()]; }
Builder.prototype.push=function(m){
  var top=this.stack[this.stack.length-1].clone().multiply(m);
  this.stack.push(top); return this;
};
Builder.prototype.pop=function(){ if(this.stack.length>1) this.stack.pop(); return this; };
Builder.prototype.top=function(){ return this.stack[this.stack.length-1]; };
/* add(matKey, geo, x,y,z, rx,ry,rz, sx,sy,sz) */
Builder.prototype.add=function(key,g,x,y,z,rx,ry,rz,sx,sy,sz){
  var m=new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(x||0,y||0,z||0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx||0,ry||0,rz||0,"XYZ")),
    new THREE.Vector3(sx===undefined?1:sx, sy===undefined?1:sy, sz===undefined?1:sz)
  );
  var w=this.top().clone().multiply(m);
  (this.buckets[key]||(this.buckets[key]=[])).push({g:g,m:w,z:ZONE});
  return this;
};
Builder.prototype.addM=function(key,g,m){
  (this.buckets[key]||(this.buckets[key]=[])).push({g:g,m:this.top().clone().multiply(m),z:ZONE});
  return this;
};
/* geometry already in engine space (a TUBE through B.pt() points, ...): merged into the bucket as-is, so a
   hose or pipe costs no draw call of its own */
var _I4 = new THREE.Matrix4();
Builder.prototype.addW=function(key,g){
  (this.buckets[key]||(this.buckets[key]=[])).push({g:g,m:_I4,z:ZONE});
  return this;
};
/* repeated hardware (bolts, studs, clamps...) -> one InstancedMesh per type and heat zone (Full / Ultra) */
var HW = null;
Builder.prototype.hw=function(type,x,y,z,rx,ry,rz,s,sy,sz){
  if(!HW) return this;
  var m=this.top().clone().multiply(mkM(x,y,z,rx,ry,rz,s,sy===undefined?s:sy,sz===undefined?s:sz));
  (HW[type]||(HW[type]=[])).push({m:m, z:ZONE}); return this;
};
function hwW(type, m){ if(HW) (HW[type]||(HW[type]=[])).push({m:m, z:ZONE}); }
var HW_MAT = { hex:"zinc", stud:"steel", clamp:"chrome", nutA:"zinc", pbolt:"steel", rivet:"palu" };
var HW_GEO = {};
function hwGeo(t){
  if(HW_GEO[t]) return HW_GEO[t];
  var I=function(x,y,z,rx,ry,rz){ return mkM(x,y,z,rx,ry,rz); }, g;
  if(t==="hex")        /* flange-head bolt, axis +Y, unit = head across corners */
    g=mergeGeos([{g:CYL(0.5,0.5,0.34,6,false,8),m:I(0,0.24,0)},{g:CYL(0.62,0.66,0.08,12,false,8),m:I(0,0.04,0)}]);
  else if(t==="stud")  /* stud + nut + washer */
    g=mergeGeos([{g:CYL(0.5,0.5,0.40,6,false,8),m:I(0,0.28,0)},{g:CYL(0.6,0.6,0.08,12,false,8),m:I(0,0.04,0)},{g:CYL(0.24,0.24,0.42,8,false,8),m:I(0,0.55,0)}]);
  else if(t==="clamp") /* worm-drive hose clamp round +Z, unit = hose radius */
    g=mergeGeos([{g:TOR(1.06,0.07,4,22,8),m:I(0,0,0)},{g:BOX(0.42,0.26,0.36,8),m:I(0,1.14,0)},{g:CYL(0.08,0.08,0.44,6,false,8),m:I(0,1.2,0,0,0,PI/2)}]);
  else if(t==="nutA")  /* AN / banjo fitting hex round +Z, unit = line radius */
    g=mergeGeos([{g:CYL(1.9,1.9,1.6,6,false,8),m:I(0,0,0,PI/2,0,0)},{g:CYL(1.5,1.5,1.2,12,false,8),m:I(0,0,0.9,PI/2,0,0)}]);
  else if(t==="pbolt") /* pulley / damper bolt head, axis +X */
    g=mergeGeos([{g:CYL(0.5,0.5,0.3,6,false,8),m:I(0.15,0,0,0,0,PI/2)}]);
  else /* rivet: dome, axis +Y */
    g=mergeGeos([{g:SPH(0.5,8,8),m:I(0,0,0,0,0,0)}]);
  g.__cached=true; HW_GEO[t]=g; return g;
}
function flushHW(G, matOf){
  if(!HW) return;
  for(var t in HW){
    var list=HW[t], byZ={}, i;
    for(i=0;i<list.length;i++) (byZ[list[i].z]||(byZ[list[i].z]=[])).push(list[i].m);
    for(var z in byZ){
      var ms=byZ[z], g=zoneGeo(hwGeo(t).clone(), +z), ub, bb=new THREE.Box3();
      /* Box3.setFromObject (engine framing, resting on the stand) only sees geometry.boundingBox: give it the instances' extent */
      g.computeBoundingBox(); ub=g.boundingBox.clone();
      for(i=0;i<ms.length;i++) bb.union(ub.clone().applyMatrix4(ms[i]));
      g.boundingBox=bb;
      var im=new THREE.InstancedMesh(g, heatPatch(matOf(HW_MAT[t])), ms.length);
      for(i=0;i<ms.length;i++) im.setMatrixAt(i, ms[i]);
      im.instanceMatrix.needsUpdate=true; im.castShadow=true; im.receiveShadow=true; im.frustumCulled=false; im.name="hw_"+t;
      G.add(im);
    }
  }
  HW=null;
}
/* r128's InstancedMesh turns frustum culling off (its geometry's sphere is one instance's, at the origin), so a static set
   (a forest, a crowd, the rocks) draws, and shadows, all of it every frame wherever the camera looks. instCull puts a sphere
   round every instance on the mesh's geometry (which must be its own) and turns culling on: the set is skipped, in the
   view and in each shadow map, only when none of it can be there. pad: metres of slack for small per-frame motion (a cheer);
   base: the shape's own geometry when the mesh's geometry already carries some other (cell) sphere. */
var _icM=new THREE.Matrix4(), _icS=new THREE.Sphere();
function instCull(im, pad, base){
  var g=im.geometry, n=im.count, i, bb=new THREE.Box3(), c=new THREE.Vector3(), r=0; if(!n) return im;
  var sg=base||g; if(!sg.boundingSphere) sg.computeBoundingSphere(); var gs=sg.boundingSphere.clone();
  for(i=0;i<n;i++){ im.getMatrixAt(i,_icM); _icS.copy(gs).applyMatrix4(_icM); bb.expandByPoint(_icS.center); }
  bb.getCenter(c);
  for(i=0;i<n;i++){ im.getMatrixAt(i,_icM); _icS.copy(gs).applyMatrix4(_icM); r=Math.max(r, c.distanceTo(_icS.center)+_icS.radius); }
  g.boundingSphere=new THREE.Sphere(c, r+(pad||0)); im.frustumCulled=true; return im;
}

/* world-space point of a local point (for belt paths, pipe routing) */
Builder.prototype.pt=function(x,y,z){ return new THREE.Vector3(x,y,z).applyMatrix4(this.top()); };
Builder.prototype.flush=function(parent, matmap, shadow){
  var out={};
  for(var k in this.buckets){
    var mat = matmap[k] || MAT[k] || MAT.steel;
    var mesh=new THREE.Mesh(mergeGeos(this.buckets[k]), heatPatch(mat));
    mesh.castShadow = shadow!==false;
    mesh.receiveShadow = true;
    mesh.name = k;
    parent.add(mesh); out[k]=mesh;
  }
  this.buckets={};
  return out;
};

function disposeMat(m){
  if(!m || !m.userData || !m.userData.perBuild) return;
  if(m.userData.ownMaps) m.userData.ownMaps.forEach(function(t){ t.dispose(); });
  m.dispose();
}
function disposeTree(obj){
  for(var i=obj.children.length-1;i>=0;i--){
    var c=obj.children[i];
    disposeTree(c);
    if(c.geometry && !c.geometry.__cached) c.geometry.dispose();
    if(c.isInstancedMesh && c.dispose) c.dispose();          /* frees the instanceMatrix buffer */
    if(c.material){ if(Array.isArray(c.material)) c.material.forEach(disposeMat); else disposeMat(c.material); }
    if(c.userData){ disposeMat(c.userData.solidMat); if(c.userData.xrayMat) c.userData.xrayMat.dispose(); }
    obj.remove(c);
  }
}

/* ===========================================================================
   4. ENVIRONMENT (procedural room cubemap -> PMREM)
   ==========================================================================*/
function buildEnvMap(renderer){
  var s=new THREE.Scene();
  s.background=new THREE.Color(0x14171b);
  var shell=new THREE.Mesh(new THREE.BoxGeometry(24,11,26),
    new THREE.MeshBasicMaterial({color:0x3b4046, side:THREE.BackSide}));
  s.add(shell);
  var floor=new THREE.Mesh(new THREE.PlaneGeometry(24,26), new THREE.MeshBasicMaterial({color:0x22262b}));
  floor.rotation.x=-PI/2; floor.position.y=-5.4; s.add(floor);
  /* ceiling strip lights */
  var i;
  for(i=-1;i<=1;i++){
    var strip=new THREE.Mesh(new THREE.PlaneGeometry(1.7,17), new THREE.MeshBasicMaterial({color:0xffffff}));
    strip.rotation.x=PI/2; strip.position.set(i*6.5,5.35,0); s.add(strip);
  }
  /* one big warm panel (window / door light) and a cool one opposite */
  var warm=new THREE.Mesh(new THREE.PlaneGeometry(11,6), new THREE.MeshBasicMaterial({color:0xffd9a8}));
  warm.position.set(0,0.6,-12.9); s.add(warm);
  var cool=new THREE.Mesh(new THREE.PlaneGeometry(7,5), new THREE.MeshBasicMaterial({color:0x8fb6dd}));
  cool.position.set(0,1.2,12.9); cool.rotation.y=PI; s.add(cool);

  var rt=new THREE.WebGLCubeRenderTarget(128,{format:THREE.RGBAFormat, generateMipmaps:true,
        minFilter:THREE.LinearMipmapLinearFilter});
  var cam=new THREE.CubeCamera(0.1,120,rt);
  cam.update(renderer,s);
  var pmrem=new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();
  var env=pmrem.fromCubemap(rt.texture).texture;
  pmrem.dispose(); rt.dispose();
  shell.geometry.dispose(); floor.geometry.dispose();
  return env;
}

/* ===========================================================================
   5. MODULE STATE
   ==========================================================================*/
var renderer=null, scene=null, camera=null, canvasEl=null, clock=null;
var envMap=null;
var garageRoot=null, engineRoot=null, engineShake=null, fxRoot=null;
var keyLight=null, fillLight=null, rimLight=null, hemi=null;
var running=true, rafId=0;
var lastOwned={}, lastCfg=null, lastLayout=null;
var anim = { spin:[], turbos:[], belts:[], hot:[], fans:[], glowMats:[], internals:null };
var composer=null, bloomPass=null, GFX="lite", XRAY=false;
var GRIME_UNIFORM={ value:0 };
var heatZones=null, _ndc=new THREE.Vector2(), _ray=new THREE.Raycaster();
var engBox = new THREE.Box3(new THREE.Vector3(-3,6,-2), new THREE.Vector3(3,12,2));
var run = { on:false, rpm:0, load:0, fail:false, redline:7000, smooth:70, first:0.05, second:0.85, n:4, angle:0, stroke:86, rodRatio:1.7, cam:40, smoke:0 };
/* mount dynamics state: roll about the crank axis is a real spring-damper so blips rock and settle */
var mnt = { roll:0, rollV:0, lope:0, lopeT:0, nz:[0,0,0], buzz:[0,0,0] };
var particles=[];
var camState = { theta:0.72, phi:1.06, r:15, target:new THREE.Vector3(0,7.6,0),
                 auto:true, autoForce:null, idle:0, dragging:false, shake:0 };
var engineBounds = new THREE.Box3();

/* ===========================================================================
   6. CFG HELPERS
   ==========================================================================*/
var COVER_COLORS = { red:0xa32a26, black:0x1b1d20, orange:0xd85f14,
                     blue:0x22488f, silver:0xb0b5bb, gold:0xb08b28 };
function pick(v,d){ return (v===undefined||v===null)?d:v; }
function normLayout(cfg, L){
  L = L || {};
  var n = L.n || 4, banks = L.banks || 1, angle = L.angle;
  var key = (cfg && cfg.layout) || "I4";
  if(angle===undefined||angle===null){
    angle = (key==="V12"||key==="V6") ? 60 : (key.charAt(0)==="F" ? 180 : (banks>1?90:0));
  }
  if(key.charAt(0)==="F") { angle=180; banks=2; }
  if(banks<1) banks=1;
  return { n:n, banks:banks, angle:angle, name:L.name||key, key:key,
           boxer:(angle>=175), vee:(banks>1 && angle<175) };
}

