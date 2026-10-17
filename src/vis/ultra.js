/* ===========================================================================
   ULTRA TIER — what Ultra buys over Full in the event scenes. Everything here
   runs only when GFX==="ultra"; Full and Lite never reach it (each hook in the
   scene files is a ULT() check or a call that is a no-op off Ultra).
   - ultraPR: a supersampled drawing buffer (1.5× on a 1× desktop screen, if the
     view is not huge), so edges and fine texture stop crawling.
   - ultraRT / ultraComposerKeep: the event composers (bloom etc.) render into a
     4× multisampled target (WebGL2), so the composed scenes get the antialiasing
     the plain canvas has but an EffectComposer drops.
   - ultraShadow / ultraSpots: 4096 sun shadow maps, every night floodlight
     casts a shadow.
   - ultraBeam: night floodlight cones drawn as soft volumetric-ish beams
     (bright at the lamp, fading to the ground, soft edges, a drift of dust).
   - ultraAO: an SSAO composer for the small scenes that redraw on demand (race
     night pits, trophy room): contact shadows under cars, crew, trophies.
   ==========================================================================*/
function ULT(){ return GFX==="ultra"; }
function ultraPR(p){
  if(!ULT()) return p;
  var el=canvasEl, a=el?(el.clientWidth||0)*(el.clientHeight||0):0;
  return (p<1.5 && a>0 && a<=1700000) ? 1.5 : p;   /* 1× screens: 1.5× supersampling (a 1440×900 view is 1.3 MP) */
}
function ultraMSOk(){ return ULT() && !!renderer && renderer.capabilities.isWebGL2 && !!THREE.WebGLMultisampleRenderTarget; }
/* the render target an Ultra composer is built on (undefined = the composer's own, as on Full) */
function ultraRT(){
  if(!ultraMSOk()) return undefined;
  var ds=renderer.getDrawingBufferSize(new THREE.Vector2());
  var rt=new THREE.WebGLMultisampleRenderTarget(Math.max(1,ds.x), Math.max(1,ds.y), {minFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter, format:THREE.RGBAFormat});
  rt.samples=4; return rt;
}
/* a cached composer stays while its Ultra setup (multisampling, AO pass) matches the tier; a tier change drops it (null) so it is rebuilt */
function ultraKey(){ return (ULT()?1:0)+(ultraMSOk()?2:0); }
function ultraComposerKeep(C){
  if(!C) return C;
  if(C.ultraMS===ultraKey()) return C;
  try{ C.passes.forEach(function(p){ if(p.dispose) p.dispose(); }); C.renderTarget1.dispose(); C.renderTarget2.dispose(); }catch(e){}
  return null;
}
function ultraComposerMark(C){ if(C) C.ultraMS=ultraKey(); return C; }
/* sun shadow map: twice Full's size on Ultra (full = Full's size); resets when the size changes */
function ultraShadow(light, full){
  if(!light||!light.shadow) return;
  var ms=ULT()?full*2:full; if(light.shadow.mapSize.x===ms) return;
  light.shadow.mapSize.set(ms,ms); if(light.shadow.map){ light.shadow.map.dispose(); light.shadow.map=null; }
}
/* night floodlights: on Ultra each one casts a soft shadow */
function ultraSpots(list){
  if(!ULT()||!list) return;
  list.forEach(function(sp){ if(sp.castShadow) return; sp.castShadow=true; sp.shadow.mapSize.set(1024,1024); sp.shadow.bias=-0.002; sp.shadow.normalBias=0.05; sp.shadow.camera.near=2; sp.shadow.camera.far=140; });
}
/* --- volumetric-ish beams: the StripBatch "beam" cones (open cylinders, uv.y 1 at the lamp, 0 at the ground) --- */
function ultraBeamMat(){
  return new THREE.ShaderMaterial({
    uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uOp:{value:0}, uT:{value:0} }]),
    vertexShader:["varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vC;",
      "#include <common>", "#include <fog_pars_vertex>",
      "void main(){ vUv=uv; vC=color; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); vV=cameraPosition-w.xyz;",
      " vec4 mvPosition=viewMatrix*w; gl_Position=projectionMatrix*mvPosition;", "#include <fog_vertex>", "}"].join("\n"),
    fragmentShader:["uniform float uOp; uniform float uT; varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vC;",
      "#include <common>", "#include <fog_pars_fragment>",
      "float bh(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453); }",
      "float bn(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);",
      " return mix(mix(mix(bh(i),bh(i+vec3(1,0,0)),f.x),mix(bh(i+vec3(0,1,0)),bh(i+vec3(1,1,0)),f.x),f.y),mix(mix(bh(i+vec3(0,0,1)),bh(i+vec3(1,0,1)),f.x),mix(bh(i+vec3(0,1,1)),bh(i+vec3(1,1,1)),f.x),f.y),f.z); }",
      "void main(){ vec3 V=normalize(vV); float f=abs(dot(normalize(vN),V));",
      " float core=pow(f,2.4);",                                   /* soft edges: thin at the silhouette, dense through the middle */
      " float along=clamp(vUv.y,0.0,1.0); float fall=0.18+1.6*pow(along,1.7)+0.9*smoothstep(0.93,1.0,along);",   /* bright at the lamp, a glow at the lens */
      " float dust=0.75+0.5*bn(vW*0.55+vec3(0.0,-uT*0.25,uT*0.12));",   /* drifting haze in the light */
      " float a=uOp*core*fall*dust;",
      "#ifdef USE_FOG", " a*=1.0-smoothstep(fogNear,fogFar,fogDepth);", "#endif",
      " gl_FragColor=vec4(vC*a,1.0); }"].join("\n"),
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, fog:true, vertexColors:true, toneMapped:false });
}
var ULTRA_BEAM_K=7.0;   /* the Full beam's opacity (0.012–0.014) → the Ultra shader's strength */
/* call after the scene's night switch has set base.opacity; swaps the beam mesh's material for the tier */
function ultraBeam(mesh, base){
  if(!mesh) return;
  if(!ULT()){ if(mesh.material!==base) mesh.material=base; return; }
  var U=mesh.userData; if(!U.ultraBeam){ U.ultraBeam=ultraBeamMat(); U.beamBase=base;
    mesh.onBeforeRender=function(){ var m=this.material; if(m===this.userData.ultraBeam){ m.uniforms.uOp.value=this.userData.beamBase.opacity*ULTRA_BEAM_K; m.uniforms.uT.value=performance.now()/1000; } }; }
  mesh.material=U.ultraBeam;
}
/* --- SSAO ---
   One SSAOPass recipe for every Ultra scene: a 24-bit depth buffer (the stock 16-bit one bands badly at range), an AO strength
   and a distance fade (far pixels have no useful AO, only noise), no see-through bits in the normal/depth pass (smoke, glass,
   sky), no second run of the shadow maps for that pass, and optionally a 4x multisampled beauty target. o: r = sample radius
   (world units), min / max = depth gap window (world units), k = strength, f0 / f1 = fade-out distance, ms = multisampled. */
function ultraSSAO(S, cam, w, h, o){
  var ao=new THREE.SSAOPass(S, cam, w, h), span=Math.max(1, cam.far-cam.near);
  ao.kernelRadius=o.r; ao.minDistance=o.min/span; ao.maxDistance=o.max/span; ao.output=THREE.SSAOPass.OUTPUT.Default;
  var dt=new THREE.DepthTexture(w, h); dt.type=THREE.UnsignedIntType; var nrt=ao.normalRenderTarget;
  nrt.depthTexture.dispose(); nrt.depthTexture=dt; ao.ssaoMaterial.uniforms.tDepth.value=dt; ao.depthRenderMaterial.uniforms.tDepth.value=dt;
  var sm=ao.ssaoMaterial, U=sm.uniforms; U.uK={value:o.k||1}; U.uFade={value:new THREE.Vector2(o.f0||1e9, o.f1||2e9)};
  sm.fragmentShader=sm.fragmentShader.replace("uniform float kernelRadius;", "uniform float kernelRadius; uniform float uK; uniform vec2 uFade;")
    .replace("gl_FragColor = vec4( vec3( 1.0 - occlusion ), 1.0 );", "occlusion *= uK*(1.0-smoothstep(uFade.x, uFade.y, -viewZ)); gl_FragColor = vec4( vec3( 1.0 - occlusion ), 1.0 );");
  if(o.ms && ultraMSOk()){
    var m=new THREE.WebGLMultisampleRenderTarget(Math.max(1,w), Math.max(1,h), {minFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter, format:THREE.RGBAFormat}); m.samples=4;
    ao.beautyRenderTarget.dispose(); ao.beautyRenderTarget=m; U.tDiffuse.value=m.texture; }
  var hidden=[], orig=ao.renderOverride, r0=ao.render;
  ao.render=function(){   /* the stock pass reads the lens once; an event camera's fov and lens shift change every frame */
    var u=this.ssaoMaterial.uniforms, c=this.camera; u.cameraProjectionMatrix.value.copy(c.projectionMatrix); u.cameraInverseProjectionMatrix.value.copy(c.projectionMatrixInverse);
    u.cameraNear.value=c.near; u.cameraFar.value=c.far; r0.apply(this, arguments); };
  ao.renderOverride=function(){   /* the normal/depth pass: no smoke, glass or other see-through bits, and the shadow maps stay as the beauty pass drew them */
    hidden.length=0; this.scene.traverseVisible(function(q){ var m=q.material; if((q.isMesh||q.isPoints||q.isSprite) && m && (m.transparent || m.depthWrite===false || q.isPoints)){ hidden.push(q); } });
    hidden.forEach(function(q){ q.visible=false; }); var au=renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate=false;
    orig.apply(this, arguments);
    renderer.shadowMap.autoUpdate=au; hidden.forEach(function(q){ q.visible=true; }); };
  return ao;
}
/* the small on-demand scenes (race night pits, trophy room) draw through their own composer: SSAO and a gamma pass */
var ULTRA_AO={};
function ultraAO(key, S, cam, o){
  if(!ULT() || !THREE.SSAOPass || !THREE.EffectComposer) return null;
  var A=ULTRA_AO[key], ds=renderer.getDrawingBufferSize(new THREE.Vector2());
  if(A===false) return null;
  if(!A || A.scene!==S || A.cam!==cam){
    try{ if(A&&A.C) A.C.passes.forEach(function(p){ if(p.dispose) p.dispose(); });
      var C=new THREE.EffectComposer(renderer), ao=ultraSSAO(S, cam, ds.x, ds.y, {r:o.r, min:o.min*(cam.far-cam.near), max:o.max*(cam.far-cam.near)});
      C.addPass(ao); if(THREE.GammaCorrectionShader) C.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
      A=ULTRA_AO[key]={C:C, ao:ao, scene:S, cam:cam, size:""}; }
    catch(e){ ULTRA_AO[key]=false; return null; } }
  var sk=ds.x+"x"+ds.y; if(A.size!==sk){ var cs=renderer.getSize(new THREE.Vector2()); if(A.C.setPixelRatio) A.C.setPixelRatio(renderer.getPixelRatio()); A.C.setSize(cs.x, cs.y); A.size=sk; }
  return A.C;
}
/* the event composers' first pass: Full draws the scene (RenderPass); Ultra draws it through SSAO, so cars sit on the track,
   the stands, crowd and buildings get contact shading, and the multisampled beauty keeps the edges clean */
var ULTRA_AOV={
  shop:{r:0.9, min:0.2, max:15, k:1.5, f0:70, f1:130, ms:1},   /* the workshop's own composer (api.js setQuality) */
  strip:{r:1.3, min:0.07, max:1.8, k:0.85, f0:55, f1:130, ms:1},
  pull:{r:1.4, min:0.08, max:2.0, k:0.85, f0:60, f1:140, ms:1},
  bog:{r:1.4, min:0.08, max:2.0, k:0.8, f0:55, f1:130, ms:1},
  oval:{r:1.4, min:0.08, max:2.0, k:0.85, f0:60, f1:140, ms:1},
  road:{r:1.4, min:0.08, max:2.0, k:0.8, f0:60, f1:140, ms:1},
  boat:{r:1.3, min:0.07, max:1.8, k:0.8, f0:55, f1:130, ms:1}
};
function ultraRenderPass(S, cam, key){
  if(ULT() && THREE.SSAOPass && THREE.DepthTexture && ULTRA_AOV[key] && ULTRA_AO[key]!==false){
    try{ var ds=renderer.getDrawingBufferSize(new THREE.Vector2()), ao=ultraSSAO(S, cam, ds.x, ds.y, ULTRA_AOV[key]); ao.ultraAO=true; return ao; }
    catch(e){ ULTRA_AO[key]=false; } }
  return new THREE.RenderPass(S, cam);
}
/* --- road course / 24 h --- */
/* trees: a faceted two-crown broadleaf on a trunk (Full: one icosahedron blob sunk in the ground). The trees go into
   ground cells with real bounds (instCull), so the camera culls the ones behind it and only the cells in the sun's shadow box
   draw into the shadow map (Full's single instanced forest culls only as a whole). */
function ultraRoadTrees(S, im, pts, rng){
  var g=new THREE.IcosahedronGeometry(1,1), P=g.attributes.position;
  for(var q=0;q<P.count;q++){ var x=P.getX(q), y=P.getY(q), z=P.getZ(q), k=0.84+0.3*Math.abs(Math.sin(x*7.1+y*3.3+z*5.7)); P.setXYZ(q, x*k, y*k, z*k); }
  g.computeVertexNormals();
  var g2=new THREE.IcosahedronGeometry(1,0), tg=new THREE.CylinderGeometry(0.16,0.3,1,6,1,true); tg.translate(0,0.5,0);
  var tm=new THREE.MeshStandardMaterial({color:sc(0x4a3828), roughness:1}), mm=new THREE.Matrix4(), cc=new THREE.Color(), Q=new THREE.Quaternion(), E=new THREE.Euler();
  var x0=1e9, x1=-1e9, z0=1e9, z1=-1e9; pts.forEach(function(p){ x0=Math.min(x0,p[0]); x1=Math.max(x1,p[0]); z0=Math.min(z0,p[1]); z1=Math.max(z1,p[1]); });
  var NC=5, cw=(x1-x0)/NC+1e-3, cz=(z1-z0)/NC+1e-3, bins={};
  pts.forEach(function(p, j){ var k=Math.min(NC-1,Math.floor((p[0]-x0)/cw))*NC+Math.min(NC-1,Math.floor((p[1]-z0)/cz)); (bins[k]||(bins[k]=[])).push(j); });
  var cellGeo=function(base, sph){ var c=new THREE.BufferGeometry(); for(var k in base.attributes) c.setAttribute(k, base.attributes[k]); if(base.index) c.setIndex(base.index); c.boundingSphere=sph; return c; };
  for(var key in bins){ var ids=bins[key], lo=new THREE.Vector3(1e9,0,1e9), hi=new THREE.Vector3(-1e9,0,-1e9);
    ids.forEach(function(j){ var p=pts[j]; lo.x=Math.min(lo.x,p[0]-p[2]); lo.z=Math.min(lo.z,p[1]-p[2]); hi.x=Math.max(hi.x,p[0]+p[2]); hi.z=Math.max(hi.z,p[1]+p[2]); hi.y=Math.max(hi.y,p[2]*3.3+1); });
    var ctr=lo.clone().add(hi).multiplyScalar(0.5), sph=new THREE.Sphere(ctr, ctr.distanceTo(hi));
    var crown=new THREE.InstancedMesh(cellGeo(g,sph), im.material, ids.length), top=new THREE.InstancedMesh(cellGeo(g2,sph), im.material, ids.length), trunk=new THREE.InstancedMesh(cellGeo(tg,sph), tm, ids.length);
    ids.forEach(function(j, n){ var p=pts[j], r=p[2], h=r*1.7, tH=r*0.55+0.6;
      mm.compose(_sbP.set(p[0], tH+h*0.72, p[1]), Q.setFromEuler(E.set(0, rng(j*3.3)*6, 0)), _sbS.set(r, h*0.8, r)); crown.setMatrixAt(n, mm);
      mm.compose(_sbP.set(p[0]+(rng(j+11)-0.5)*r*0.6, tH+h*1.32, p[1]+(rng(j+13)-0.5)*r*0.6), Q, _sbS.set(r*0.62, h*0.5, r*0.62)); top.setMatrixAt(n, mm);
      mm.compose(_sbP.set(p[0], 0, p[1]), Q.set(0,0,0,1), _sbS.set(r*0.35+0.4, tH+h*0.4, r*0.35+0.4)); trunk.setMatrixAt(n, mm);
      im.getColorAt(j, cc); crown.setColorAt(n, cc); top.setColorAt(n, cc.multiplyScalar(1.12)); });
    crown.castShadow=true; instCull(crown, 0, g); instCull(top, 0, g2); instCull(trunk, 0, tg); S.add(crown); S.add(top); S.add(trunk); }
  S.remove(im);
}
/* the 24 h field: four wheels per car (Full: body and cabin boxes on the road) */
var _urM=new THREE.Matrix4(), _urW=new THREE.Matrix4();
function ultraRoadWheels(W, A, n){
  if(!A.wheel){ if(!ULT()) return;
    var g=new THREE.CylinderGeometry(0.34,0.34,0.26,16); g.rotateX(PI/2);
    A.wheel=new THREE.InstancedMesh(g, [new THREE.MeshStandardMaterial({color:0x101114, roughness:0.88}), new THREE.MeshStandardMaterial({color:0x8a8e94, roughness:0.35, metalness:0.8}), new THREE.MeshStandardMaterial({color:0x8a8e94, roughness:0.35, metalness:0.8})], A.n*4);
    A.wheel.frustumCulled=false; A.wheel.castShadow=true; A.wheel.count=0; W.scene.add(A.wheel);
    A.wOff=[[1.42,0.85],[1.42,-0.85],[-1.38,0.85],[-1.38,-0.85]].map(function(o){ return new THREE.Matrix4().makeTranslation(o[0], 0.34, o[1]); }); }
  if(!ULT()){ A.wheel.count=0; A.wheel.visible=false; return; }
  A.wheel.visible=true;
  for(var i=0;i<n;i++){ A.body.getMatrixAt(i, _urM); for(var k=0;k<4;k++) A.wheel.setMatrixAt(i*4+k, _urW.multiplyMatrices(_urM, A.wOff[k])); }
  A.wheel.count=n*4; A.wheel.instanceMatrix.needsUpdate=true;
}
/* --- boat drags: a planar reflection on the river ---
   Full's water reflects an analytic sky. Ultra renders the scene from the camera mirrored in the water plane (half
   resolution, an oblique near plane so nothing under the water shows) and the water shader looks it up through its
   own wave normals: the banks, the towers, the crowd and the boats reflect, broken up by the chop. */
var ULTRA_REFL=null, _urP=new THREE.Plane(), _urV=new THREE.Vector4(), _urQ=new THREE.Vector4(), _urN=new THREE.Vector3(0,1,0), _urC=new THREE.Vector3(), _urT=new THREE.Vector3(), _urR=new THREE.Matrix4(), _urL=new THREE.Vector3();
function ultraWaterPatch(mat){
  if(mat.userData.ultra) return;
  mat.userData.ultra=true; var R=ultraReflState();
  mat.uniforms.uRefl={value:R.rt.texture}; mat.uniforms.uRM={value:R.tm}; mat.uniforms.uRK={value:1};
  mat.fragmentShader=mat.fragmentShader.replace("uniform float uT;", "uniform sampler2D uRefl; uniform mat4 uRM; uniform float uRK; uniform float uT;")
    .replace(" vec3 sky=mix(uHor,uZen,pow(up,0.6));",
      " vec3 sky=mix(uHor,uZen,pow(up,0.6)); vec4 rp=uRM*vec4(vW,1.0); vec2 ruv=rp.xy/rp.w+N.xz*vec2(0.9,0.6)*(0.05+0.03*uChop)*clamp(12.0/max(d,1.0),0.25,1.0);"+
      " vec3 rc=texture2D(uRefl,clamp(ruv,0.002,0.998)).rgb; sky=mix(sky,rc,uRK);");
  mat.customProgramCacheKey=function(){ return "boat_water_ultra"; }; mat.needsUpdate=true;
}
function ultraReflState(){
  if(ULTRA_REFL) return ULTRA_REFL;
  var rt=new THREE.WebGLRenderTarget(512, 256, {minFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter, format:THREE.RGBAFormat}); rt.texture.generateMipmaps=false;
  return (ULTRA_REFL={rt:rt, cam:new THREE.PerspectiveCamera(), tm:new THREE.Matrix4(), size:""});
}
function ultraBoatReflect(S, cam, water, hide){
  if(!ULT()||!water) return;
  var mat=water.material; if(!mat||!mat.uniforms) return; ultraWaterPatch(mat);
  var R=ultraReflState(), ds=renderer.getDrawingBufferSize(new THREE.Vector2()), w=Math.max(2,Math.round(ds.x/2)), h=Math.max(2,Math.round(ds.y/2)), sk=w+"x"+h;
  if(R.size!==sk){ R.rt.setSize(w,h); R.size=sk; }
  mat.uniforms.uRK.value=ultraMirror(R, S, cam, water.position.y, [water].concat(hide||[]))?1:0;
}
/* render S as seen from cam mirrored in the horizontal plane y=y0 into R.rt (oblique near plane: nothing below the plane shows);
   R.tm then maps a world point to the reflection's uv. hide = objects left out (the reflecting surface itself). false = the camera is under the plane. */
function ultraMirror(R, S, cam, y0, hide){
  var vc=R.cam;
  cam.updateMatrixWorld(); _urC.setFromMatrixPosition(cam.matrixWorld);
  if(_urC.y<=y0+0.05) return false;
  _urR.extractRotation(cam.matrixWorld); _urL.set(0,0,-1).applyMatrix4(_urR).add(_urC);
  vc.position.set(_urC.x, 2*y0-_urC.y, _urC.z); _urT.set(_urL.x, 2*y0-_urL.y, _urL.z);
  vc.up.set(0,1,0).applyMatrix4(_urR); vc.up.y=-vc.up.y; vc.lookAt(_urT);
  vc.far=cam.far; vc.updateMatrixWorld(); vc.projectionMatrix.copy(cam.projectionMatrix);
  /* oblique near plane at the water */
  _urP.setFromNormalAndCoplanarPoint(_urN, _urT.set(0,y0,0)); _urP.applyMatrix4(vc.matrixWorldInverse);
  _urV.set(_urP.normal.x, _urP.normal.y, _urP.normal.z, _urP.constant); var pm=vc.projectionMatrix;
  _urQ.x=(Math.sign(_urV.x)+pm.elements[8])/pm.elements[0]; _urQ.y=(Math.sign(_urV.y)+pm.elements[9])/pm.elements[5]; _urQ.z=-1; _urQ.w=(1+pm.elements[10])/pm.elements[14];
  _urV.multiplyScalar(2/_urV.dot(_urQ)); pm.elements[2]=_urV.x; pm.elements[6]=_urV.y; pm.elements[10]=_urV.z+1-0.003; pm.elements[14]=_urV.w;
  vc.projectionMatrixInverse.copy(pm).invert();
  R.tm.set(0.5,0,0,0.5, 0,0.5,0,0.5, 0,0,0.5,0.5, 0,0,0,1).multiply(pm).multiply(vc.matrixWorldInverse);
  var vis=hide.map(function(o){ var v=o.visible; o.visible=false; return v; });
  var rtk=renderer.getRenderTarget(), au=renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate=false;
  renderer.setRenderTarget(R.rt); renderer.clear(); renderer.render(S, vc); renderer.setRenderTarget(rtk); renderer.shadowMap.autoUpdate=au;
  hide.forEach(function(o,i){ o.visible=vis[i]; });
  return true;
}
/* --- workshop: sealed floor ---
   Full's concrete is matte with a little env sheen. On Ultra the floor is sealed: the room is drawn once more from the camera
   mirrored in the floor (half resolution, with mip levels for the blur), and the floor shader lays that over its own light
   by Fresnel and by how glossy its roughness map says each spot is (oil stains and polished tyre tracks shine, joints and
   rough aggregate don't). Two lookups, one sharp and one wide, make the reflection tighten where things touch the floor. */
var ULTRA_FLOOR={mesh:null, base:null, mat:null, R:null, size:"", G:null};
function ultraFloorState(){
  if(ULTRA_FLOOR.R) return ULTRA_FLOOR.R;
  var mip=!!renderer.capabilities.isWebGL2;
  var rt=new THREE.WebGLRenderTarget(512, 256, {minFilter:mip?THREE.LinearMipmapLinearFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter, format:THREE.RGBAFormat}); rt.texture.generateMipmaps=mip;
  return (ULTRA_FLOOR.R={rt:rt, cam:new THREE.PerspectiveCamera(), tm:new THREE.Matrix4(), size:"", mip:mip});
}
function ultraFloorMat(base){
  var R=ultraFloorState(), m=base.clone(); m.userData={perBuild:true};
  var U={uRefl:{value:R.rt.texture}, uRM:{value:R.tm}, uRK:{value:1}};
  m.onBeforeCompile=function(sh){
    for(var k in U) sh.uniforms[k]=U[k];
    sh.vertexShader=sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWp;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvWp=(modelMatrix*vec4(transformed,1.0)).xyz;");
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform sampler2D uRefl; uniform mat4 uRM; uniform float uRK; varying vec3 vWp;")
      .replace("#include <aomap_fragment>", "#include <aomap_fragment>\n"+
        "{ vec3 nG=normalize(vNormal), vd=normalize(vViewPosition); float cg=clamp(dot(nG,vd),0.0,1.0);\n"+
        "  float fr=0.06+0.94*pow(1.0-cg,4.0);\n"+                                                   /* Fresnel: strongest at a low angle */
        "  vec4 rp=uRM*vec4(vWp,1.0); vec2 ruv=rp.xy/rp.w+(normal.xy-nG.xy)*0.05;\n"+                 /* the normal map breaks the image up */
        "  float gl=smoothstep(0.95,0.38,roughnessFactor);\n"+                                         /* glossy where the roughness map is low */
        "  vec3 sharp=texture2D(uRefl,clamp(ruv,0.002,0.998),0.8).rgb;\n"+
        "  vec3 wide=(texture2D(uRefl,clamp(ruv+vec2(0.012,0.004),0.002,0.998),3.2).rgb+texture2D(uRefl,clamp(ruv-vec2(0.011,0.006),0.002,0.998),3.2).rgb+texture2D(uRefl,clamp(ruv+vec2(-0.004,0.013),0.002,0.998),3.2).rgb)*0.3333;\n"+
        "  vec3 rc=mix(wide,sharp,0.4*(1.0-roughnessFactor)+0.1);\n"+
        "  reflectedLight.indirectSpecular+=rc*(fr*1.4+0.55)*gl*uRK; }");
  };
  m.customProgramCacheKey=function(){ return "workshop_floor_ultra"; };
  m.userData.uni=U; return m;
}
/* find the room's floor plane (the big PlaneGeometry on MAT.concrete / MAT.tile) in the current garage group */
function ultraFloorFind(){
  var G=garageRoot&&garageRoot.children[0]; if(!G) return null; if(G===ULTRA_FLOOR.G) return ULTRA_FLOOR.mesh;
  ULTRA_FLOOR.G=G; var f=null;
  for(var i=0;i<G.children.length&&!f;i++){ var c=G.children[i]; if(c.isMesh && c.geometry && c.geometry.type==="PlaneGeometry" && (c.material===MAT.concrete||c.material===MAT.tile)) f=c; }
  if(ULTRA_FLOOR.mat){ ULTRA_FLOOR.mat.dispose(); ULTRA_FLOOR.mat=null; }
  ULTRA_FLOOR.mesh=f; ULTRA_FLOOR.base=f?f.material:null; return f;
}
/* call just before the workshop composer draws: on Ultra the mirror pass and the sealed material, off Ultra the stock floor back */
function ultraFloor(){
  var f=ultraFloorFind(); if(!f) return;
  if(!ULT() || !garageRoot.visible || XRAY){ if(f.material!==ULTRA_FLOOR.base) f.material=ULTRA_FLOOR.base; return; }
  if(!ULTRA_FLOOR.mat) ULTRA_FLOOR.mat=ultraFloorMat(ULTRA_FLOOR.base);
  var R=ultraFloorState(), M=ULTRA_FLOOR.mat, ds=renderer.getDrawingBufferSize(new THREE.Vector2()), w=Math.max(2,Math.round(ds.x/2)), h=Math.max(2,Math.round(ds.y/2)), sk=w+"x"+h;
  if(R.size!==sk){ R.rt.setSize(w,h); R.size=sk; }
  var on=ultraMirror(R, scene, camera, f.position.y, [f]);
  M.userData.uni.uRK.value=on?1:0; if(f.material!==M) f.material=M;
}
/* --- trophy room: shadows from the key light, SSAO contact shading (the room redraws only when
   something changes, so this costs nothing while it sits still) --- */
function ultraTrophy(cam){
  var S=TROPHY.scene, on=ULT(); if(!S) return null;
  if(!!TROPHY.ultraOn!==on){ TROPHY.ultraOn=on;
    (TROPHY.lights||[]).forEach(function(L, i){ L.castShadow=on; if(on){ var ms=i?512:2048; L.shadow.mapSize.set(ms,ms); L.shadow.bias=i?-0.004:-0.0008; L.shadow.normalBias=0.02;
      if(L.isDirectionalLight){ var c=L.shadow.camera; c.left=-6; c.right=6; c.top=5; c.bottom=-5; c.near=1; c.far=24; c.updateProjectionMatrix(); } else { L.shadow.camera.near=0.1; L.shadow.camera.far=9; } } }); }
  if(!on) return null;
  S.traverse(function(o){ if(!o.isMesh || o.userData.ultraSh) return; o.userData.ultraSh=1; var m=o.material;
    if(m && (m.transparent || m.isMeshBasicMaterial)) return; o.receiveShadow=true; if(o.geometry && o.geometry.type!=="PlaneGeometry") o.castShadow=true; });
  return ultraAO("trophy", S, cam, {r:0.16, min:0.00015, max:0.008});
}
/* --- race night pits: SSAO under the car on its stands, round the crew and the hauler (true = drawn) --- */
function ultraPits(){
  if(!ULT()) return false;
  var S=PITS.scene, C=ultraAO("pits", S, PITS.cam, {r:0.45, min:0.00002, max:0.0016}); if(!C) return false;
  var f=S.fog, keep=f?f.color.clone():null; if(f) f.color.convertSRGBToLinear();   /* the composer works in linear: the pits' fog colour is sRGB */
  C.render(); if(f) f.color.copy(keep); return true;
}
