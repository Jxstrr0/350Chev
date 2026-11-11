/* ===========================================================================
   7h. MODELLED SMALL PARTS (Full / Ultra): the engine's fasteners, hose clamp, ignition coils, plug boot, wiring
   plug, oil filter and fuel injectors as real shapes, modelled in Blender by tools/blender/engine-parts.py and kept in one file, models/eng-parts.glb
   (geometry only: the engine's own materials go on). The engine is still built in code; these only stand in where
   code drew a plain box or cylinder that is looked at up close.
   The file loads once, after the first Full / Ultra engine is asked for. Until it lands (or if it never does: offline
   on a first visit, an old browser) the plain shapes are drawn, and the engine is rebuilt once when it arrives.
   A part is a list of {mat: the builder's material key, g: geometry}; partAdd places one like Builder.add places a
   box, and hwGeo (core.js) hands the bolts, studs, clamps, nuts and rivets to the instanced hardware.
   Lite never loads the file.
   ==========================================================================*/
var ENGP = { file:"models/eng-parts.glb", parts:null, loading:false, failed:false };
function engPartsLoad(){
  if(ENGP.parts || ENGP.loading || ENGP.failed || !window.THREE) return;
  if(!THREE.GLTFLoader){
    if(!window.__pewPost) return;
    ENGP.loading=true;
    window.__pewPost(function(ok){ ENGP.loading=false; if(ok && THREE.GLTFLoader) engPartsLoad(); else ENGP.failed=true; });
    return;
  }
  ENGP.loading=true;
  new THREE.GLTFLoader().load(ENGP.file, function(g){
    var P={};
    g.scene.updateMatrixWorld(true);
    g.scene.traverse(function(o){
      if(!o.isMesh || !o.geometry) return;
      var nm=String(o.userData.name||o.name).split("__"); if(nm.length<2) return;   /* <part>__<material key> */
      var geo=o.geometry; geo.applyMatrix4(o.matrixWorld); geo.__cached=true;        /* kept across engine rebuilds (disposeTree) */
      (P[nm[0]]||(P[nm[0]]=[])).push({mat:nm[1].replace(/[^A-Za-z].*$/,""), g:geo});
    });
    ENGP.parts=P; ENGP.loading=false;
    HW_GEO={};                                             /* the instanced hardware picks the modelled shapes up */
    if(GFX!=="lite" && lastCfg && engineRoot && engineRoot.children.length && !failFx.started && !run.fail)
      ENGINE_VIS.buildEngine(lastCfg, lastLayout, true);
  }, null, function(e){
    ENGP.loading=false; ENGP.failed=true;
    if(typeof console!=="undefined") console.warn("engine parts", e && e.message);
  });
}
/* place a modelled part: the arguments after the name are Builder.add's (a negative sz mirrors it for the other bank).
   Returns false when the parts are not there, so the caller draws its plain shape instead. */
function partAdd(B, name, x,y,z, rx,ry,rz, sx,sy,sz){
  var P=DET && ENGP.parts && ENGP.parts[name]; if(!P) return false;
  var mir=(sx===undefined?1:sx)*(sy===undefined?1:sy)*(sz===undefined?1:sz)<0, i, bk;
  for(i=0;i<P.length;i++){
    B.add(P[i].mat, P[i].g, x,y,z, rx,ry,rz, sx,sy,sz);
    if(mir){ bk=B.buckets[P[i].mat]; bk[bk.length-1].mir=true; }   /* mergeGeos turns its triangles back the right way round */
  }
  return true;
}
