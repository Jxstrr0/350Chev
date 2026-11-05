/* ===========================================================================
   8c. MODEL PROPS (Full / Ultra only): small glTF models from models/ dressed into the workshop polish layer.
   The room, the stand, the engine and every Lite prop stay as code; this only adds detail where a code box would look
   like a box (a welding cart, a jerry can, a fire extinguisher). Files are packed by tools/pack-model.py and credited
   in models/CREDITS.md. The pull track uses the same loader for its trackside props (PULL_PROPS in vis/pull.js).
   They load after the room is up, cached once per file, and a tier change or a rebuilt room just
   drops them with the polish group (geometry and textures are kept for the next one).
   ==========================================================================*/
var MODEL_UNITS = 8.4;   /* scene units per metre (an oil drum, 0.88 m, is 7.4 units) */
/* key: its file in models/ */
var MODEL_FILES = {
  weldcart: "models/welding-cart.glb",
  jerrycan: "models/jerrycan.glb",
  propane:  "models/propane-tank.glb",
  extinguisher: "models/extinguisher.glb",
  spraypaint: "models/spray-paint.glb",
  lube:     "models/lube-spray.glb",
  /* pull track (vis/pull.js, PULL_PROPS) */
  generator: "models/generator.glb",
  crate:    "models/plastic-crate.glb",
  barrel:   "models/barrel.glb",
  toolbox:  "models/toolbox.glb",
  handtruck:"models/hand-truck.glb",
  fuelcan:  "models/plastic-jerrycan.glb",
  tyre:     "models/old-tyre.glb"
};
/* placements: [key, x, y, z, turn] in scene units; the bench top is at 9.05 */
function modelSpots(a){
  var W=a.W, D=a.D, bx=W/2-7;
  if(a.sandbox) return [
    ["extinguisher", W*0.30-5.6, 0, -D/2+2.6, 0.2],
    ["weldcart",    -W/2+6.5, 0, -D/2+6.5, 0.7]
  ];
  return [
    ["weldcart",    -17.5, 0, -D/2+5.0, 0.35],
    ["propane",     -12.6, 0, -D/2+3.2, 0],
    ["extinguisher",-W/2+2.4, 0, 1.0, PI/2],
    ["jerrycan",    -W/2+5.0, 0, 25.6, 1.9],
    ["spraypaint",   bx-0.2, 9.05, -9.6, -PI/2-0.25],   /* on the bench, between the gooseneck lamp and the toolbox */
    ["lube",         bx-1.2, 9.05, -13.8, 0.6]
  ];
}
var MODEL_CACHE = {};   /* key -> {scene} once loaded, or a list of waiting callbacks */
function modelGet(key, cb){
  var c=MODEL_CACHE[key];
  if(c && c.scene){ cb(c.scene); return; }
  if(c){ c.wait.push(cb); return; }
  c=MODEL_CACHE[key]={wait:[cb]};
  new THREE.GLTFLoader().load(MODEL_FILES[key], function(g){
    g.scene.traverse(function(o){
      if(!o.isMesh) return;
      o.castShadow=true; o.receiveShadow=true;
      if(o.geometry) o.geometry.__cached=true;   /* disposeTree keeps it for the next room */
      if(o.material) o.material.envMapIntensity=0.7;
    });
    c.scene=g.scene;
    var w=c.wait; c.wait=null;
    for(var i=0;i<w.length;i++) w[i](g.scene);
  }, null, function(e){
    if(typeof console!=="undefined") console.warn("model "+key, e && e.message);
    delete MODEL_CACHE[key];   /* try again with the next room */
  });
}
/* called by scenePolish with the new polish group; anything that lands after the group is replaced is dropped */
function sceneModels(G, P, a){
  if(!window.THREE || !MODEL_FILES) return;
  if(!THREE.GLTFLoader){
    if(window.__pewPost) window.__pewPost(function(ok){ if(ok && THREE.GLTFLoader && G.userData.polish===P) sceneModels(G, P, a); });
    return;
  }
  var spots=modelSpots(a);
  spots.forEach(function(s){
    modelGet(s[0], function(src){
      if(G.userData.polish!==P) return;
      var o=src.clone();
      o.scale.setScalar(MODEL_UNITS);
      o.position.set(s[1], s[2], s[3]);
      o.rotation.y=s[4];
      o.name="model:"+s[0];
      P.add(o);
    });
  });
}
