/* ===========================================================================
   PIKES PEAK SCENE — the hillclimb, a world the view cuts to while
   ENGINE_VIS.setHill({on:true, course, s, v, d, ...}) is fed every frame.
   Units metres. The course comes from ENGINE_SIM.hillCourse (x, y, heading,
   curvature, altitude per 2.5 m sample); world x = course x − ox, world z =
   −(course y − oy), world y = altitude − 2,862 m. Built once on first use:
   a heightfield mountain shaped round the road (the road's own altitude near
   it, the mountain's fall line away from it, cliffs off the drops), a road
   ribbon with gravel verges, guardrails on the railed drops, sparse pines
   below the treeline giving way to boulders, a start gantry and the summit
   house. The sky deepens and the haze clears as the car climbs.
   ==========================================================================*/
var HILL={ on:false, W:null, cam:null, cars:{}, car:null, carKey:"", camPos:new THREE.Vector3(), camTgt:new THREE.Vector3(), fov:50, shot:null, shotT:0, snap:true, lastT:0, stats:null, st:-1,
  chP:new THREE.Vector3(), chT:new THREE.Vector3(), roll:0, steer:0, heliA:0, tier:null };
var HILL_RW=8, _hA=new THREE.Vector3(), _hB=new THREE.Vector3(), _hC=new THREE.Vector3(), _hW=new THREE.Vector3(0.8,0,-0.3);
function hillSkyMat(){
  return new THREE.ShaderMaterial({ uniforms:{ uSun:{value:new THREE.Vector3(-0.35,0.62,0.7).normalize()}, uAlt:{value:0} },
    vertexShader:"varying vec3 vDir; void main(){ vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
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
  "  rough=0.95; return vec3(n);",
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
  var r=lerp(0.17,0.30,tl), g=lerp(0.22,0.26,tl), b=lerp(0.11,0.17,tl);   /* pine duff and grass → tundra and Pikes Peak granite, pinkish grey */
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
  var sky=new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), hillSkyMat()); sky.frustumCulled=false; sky.renderOrder=-10; S5.add(sky); W.sky=sky;
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
  M.asph=new THREE.MeshStandardMaterial({map:hillAsphaltTex(), roughness:0.86, metalness:0, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2});
  M.verge=new THREE.MeshStandardMaterial({vertexColors:true, roughness:1, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1});
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
    [-1,1].forEach(function(sd){ hillPt(W, 2, sd*(hw+1.4), 0, _hA); B.add("metal","box",[_hA.x,_hA.y+2.8,_hA.z],[0.3,5.6,0.3],0x2b2d30); });
    hillPt(W, 2, 0, 5.4, _hA); B.add("solid","box",[_hA.x,_hA.y,_hA.z],[0.5,1.1,HILL_RW+3.2],0xe8e4da,[0,h0,0]);
    var st=stripLabel("START", HILL_RW+2.6, 0.9); hillPt(W, 1.85, 0, 5.4, _hA); st.position.copy(_hA); st.rotation.y=h0-PI/2; S5.add(st); W.startSign=st;
    hillPt(W, -6, -(hw+6), 0, _hA); B.box("solid", _hA.x,_hA.y+1.3,_hA.z, 3.2,2.6,2.4, 0xc9c1ad, h0); B.add("solid","prism",[_hA.x,_hA.y+2.6,_hA.z],[3.6,1.0,2.8],0x5a3a2a,[0,h0,0]);
    var iF=N-1, hF=T.h[iF], i9=Math.max(0,N-1-Math.round(14/ds));
    [-1,1].forEach(function(sd){ hillPt(W, i9, sd*(hw+1.4), 0, _hA); B.add("metal","box",[_hA.x,_hA.y+2.8,_hA.z],[0.3,5.6,0.3],0x2b2d30); });
    var fin=stripLabel("SUMMIT · FINISH", HILL_RW+2.6, 0.9); hillPt(W, i9-0.15, 0, 5.4, _hA); fin.position.copy(_hA); fin.rotation.y=hillHd(T,i9)-PI/2; S5.add(fin);
    hillPt(W, i9, 0, 5.4, _hA); B.add("solid","box",[_hA.x,_hA.y,_hA.z],[0.5,1.1,HILL_RW+3.2],0x1a1a1c,[0,hillHd(T,i9),0]);
    /* the summit house beyond the line, a stone base and a long low roof */
    hillPt(W, iF, 34, 0, _hA); var by=T.z[iF]-W.z0, hx=_hA.x+Math.cos(hF)*28, hz=_hA.z-Math.sin(hF)*28;
    B.box("solid", hx, by+2.2, hz, 30, 4.4, 14, 0x9a8f80, hF); B.box("solid", hx, by+4.75, hz, 31.5, 0.7, 15.5, 0x4c4f53, hF);
    for(var w=-12;w<=12;w+=3){ B.box("solid", hx+Math.cos(hF)*w+Math.sin(hF)*7.02, by+2.6, hz-Math.sin(hF)*w+Math.cos(hF)*7.02, 1.8, 1.4, 0.06, 0x2a3a48, hF); }
    hillPt(W, iF, 14, 0, _hA); B.box("solid", _hA.x+Math.cos(hF)*12, by-0.15, _hA.z-Math.sin(hF)*12, 56, 0.4, 34, 0x6b675f, hF);   // the car park
    W.summit=new THREE.Vector3(hx, by+3, hz); })();
  var keep=STRIP.scene; STRIP.scene=S5; B.build("solid", M.solid, !lite); B.build("metal", M.metal, !lite); STRIP.scene=keep;
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
      foliage.castShadow=trunk.castShadow=!lite; S5.add(foliage); S5.add(trunk); W.trees=tp.length; }
    if(rp.length){ var rg=new THREE.DodecahedronGeometry(1,0), rocks=new THREE.InstancedMesh(rg, new THREE.MeshStandardMaterial({roughness:0.92}), rp.length);
      rp.forEach(function(p,j){ mm.compose(_hA.set(p[0],p[1]+p[3]*0.25,p[2]), qq.setFromEuler(e.set(rng(j)*3,rng(j+1)*3,rng(j+2)*3)), _hB.set(p[3]*(0.8+rng(j+3)*0.6),p[3]*(0.55+rng(j+4)*0.4),p[3]*(0.8+rng(j+5)*0.5)));
        rocks.setMatrixAt(j,mm); cc.setHSL(0.07,0.08+rng(j+6)*0.06,0.3+rng(j+7)*0.12).convertSRGBToLinear(); rocks.setColorAt(j,cc); });
      rocks.castShadow=!lite; S5.add(rocks); W.rocks=rp.length; }
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
  return W;
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
function hillCut(name){ if(HILL.shot!==name){ HILL.shot=name; HILL.shotT=0; HILL.snap=true; } }
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
  hillCut(s); HILL.shotT+=dt;
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
  var rollT=clamp(-k*v*v/9.81*0.035,-0.08,0.08); HILL.roll+=(rollT-HILL.roll)*Math.min(1,dt*6); U.bodyGroup.rotation.x+=HILL.roll;
  /* dust: off in the gravel, a moment, the verge at the limit */
  if(W.fx){ var dust=o.off?0.9:o.ev==="moment"?0.6:(+o.lat||0)>0.97&&v>15?0.15:0;
    if(dust>0 && Math.random()<dust*dt*40*(GFX==="lite"?0.5:1)){ hillPt(W, fi-1.4, (+o.d||0)+(Math.random()-0.5)*1.8, 0.3, _hA); W.fx.emit(_hA.x,_hA.y,_hA.z,(Math.random()-0.5)*1.2,0.6,(Math.random()-0.5)*1.2,2.2,0.8,4.2,0.72,0.66,0.56,0.32,{drag:0.5,buoy:0.1}); }
    W.fx.step(dt, _hW); }
  hillDirect(o, dt, W, car);
  /* thin air: the zenith deepens and the haze lifts with the camera's altitude */
  var alt=clamp((HILL.camPos.y+W.z0-2862)/1440,0,1.1); W.sky.material.uniforms.uAlt.value=alt; W.horLin.setRGB(lerp(0.6,0.52,alt),lerp(0.68,0.63,alt),lerp(0.76,0.78,alt)); W.fog.near=lerp(500,1100,alt); W.fog.far=lerp(6000,9000,alt); if(W.tier==="ultra"){ W.fog.near*=1.6; W.fog.far*=1.3; }   /* Ultra: the long view */
  var c=_hA.copy(car.position); W.sun.position.copy(c).addScaledVector(W.sunDir, 200); W.sun.target.position.copy(c); W.sun.target.updateMatrixWorld();
}
