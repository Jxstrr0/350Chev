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
  mesh.castShadow=false; mesh.receiveShadow=true; S2.add(mesh);
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
  mesh.receiveShadow=true; mesh.castShadow=false; S2.add(mesh);   /* the pits sit outside the sun's 60 m shadow box; at night each spot would redraw them */
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
