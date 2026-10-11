/* ---------------------------------------------------------------------------
   GROUNDING (drag fix pack) — what keeps a car sitting on the track instead of hovering over it:
   - stripContact(car, o): a soft contact-shadow decal under the car (ambient occlusion under the floor) with
     dark tyre contact patches, baked into one small canvas per footprint. One transparent quad per car on every
     tier (Lite too); it rides with the car group, not the body, so it stays on the ground through wheelies.
     o.y lifts/sinks it (the pits car is up on stands: the decal goes back down to the floor, softer and wider).
   - SC_RIDE: a little off the door cars' ride height (the body group sits lower over the wheels).
   - sc_skirt(B, me): side skirts under the sill between the arches, merged into the car's own black part
     (no extra draw call). Door cars only.
   -------------------------------------------------------------------------*/
var SC_RIDE={street:0.03, outlaw:0.025, promod:0.015, rail:0};
function scRide(me, body){ if(me && me.ride===undefined) me.ride=SC_RIDE[body]||0; return me?me.ride||0:0; }
function sc_skirt(B, me){
  var L=B.paint; if(!L||!L.length||!me) return;
  var g=L[0].g, p=g.attributes&&g.attributes.position; if(!p) return;
  var x0=me.xr+me.rr+0.14, x1=me.xf-me.fr-0.14, ymin=Infinity, zmax=0, i, x, y;
  if(!(x1-x0>0.4)) return;
  for(i=0;i<p.count;i++){ x=p.getX(i); if(x<x0||x>x1) continue; y=p.getY(i); if(y<ymin) ymin=y; }
  if(!isFinite(ymin)) return;
  for(i=0;i<p.count;i++){ x=p.getX(i); if(x<x0||x>x1) continue; if(p.getY(i)<ymin+0.035) zmax=Math.max(zmax, Math.abs(p.getZ(i))); }
  if(!(zmax>0.3)) return;
  var h=0.075, geo=sc_rbox(x1-x0, h, 0.04, 0.012);
  for(var sd=-1; sd<=1; sd+=2) B.add("black", geo, sc_M((x0+x1)/2, ymin+0.012-h/2, sd*(zmax-0.008)));
}
/* the decal texture: soft floor occlusion + a dark patch where each tyre meets the ground */
var SC_CONTACT={tex:{}, geo:{}};
function scContactTex(key, F){
  if(SC_CONTACT.tex[key]) return SC_CONTACT.tex[key];
  var W=256, H=128, c=sc_canvas(W,H), x=c.getContext("2d");
  var sx=W/F.lx, sz=H/F.lz, cx=function(v){ return (v-F.x0)*sx; }, cz=function(v){ return (v+F.lz/2)*sz; };
  x.clearRect(0,0,W,H);
  /* floor occlusion: blurred rounded slab under the body (drawn off canvas, only its shadow lands) */
  function blob(xa, xb, hz, a, blur){ var off=4000;
    x.save(); x.shadowColor="rgba(0,0,0,"+a+")"; x.shadowBlur=blur; x.shadowOffsetX=off; x.fillStyle="#000";
    var X0=cx(xa)-off, X1=cx(xb)-off, Z0=cz(-hz), Z1=cz(hz), r=Math.min((Z1-Z0)/2, 18);
    x.beginPath(); x.moveTo(X0+r,Z0); x.lineTo(X1-r,Z0); x.quadraticCurveTo(X1,Z0,X1,Z0+r); x.lineTo(X1,Z1-r); x.quadraticCurveTo(X1,Z1,X1-r,Z1); x.lineTo(X0+r,Z1); x.quadraticCurveTo(X0,Z1,X0,Z1-r); x.lineTo(X0,Z0+r); x.quadraticCurveTo(X0,Z0,X0+r,Z0); x.fill(); x.restore(); }
  blob(F.bx0, F.bx1, F.bhz, F.soft?0.5:0.82, F.soft?26:10); if(!F.soft) blob(F.bx0+0.25, F.bx1-0.25, F.bhz*0.7, 0.6, 16);
  if(F.rail) blob(F.bx0+0.3, F.bx1-0.4, 0.16, 0.35, 8);   /* the rail's chassis rails */
  /* tyres: a broad soft pool and a hard dark patch at the contact */
  F.wheels.forEach(function(w){ var X=cx(w.x), Z=cz(w.z), lx=Math.max(4, w.r*(F.soft?1.3:0.75)*sx), lz=Math.max(3, w.w*(F.soft?1.0:0.62)*sz);
    var g=x.createRadialGradient(0,0,0,0,0,1); g.addColorStop(0,"rgba(0,0,0,"+(F.soft?0.38:0.7)+")"); g.addColorStop(1,"rgba(0,0,0,0)");
    x.save(); x.translate(X,Z); x.scale(lx*1.7, lz*1.5); x.fillStyle=g; x.beginPath(); x.arc(0,0,1,0,TAU); x.fill(); x.restore();
    if(!F.soft){ var g2=x.createRadialGradient(0,0,0,0,0,1); g2.addColorStop(0,"rgba(0,0,0,1)"); g2.addColorStop(0.6,"rgba(0,0,0,0.92)"); g2.addColorStop(1,"rgba(0,0,0,0)");
      x.save(); x.translate(X,Z); x.scale(lx*0.8, lz*0.75); x.fillStyle=g2; x.beginPath(); x.arc(0,0,1,0,TAU); x.fill(); x.restore(); } });
  var t=sc_ctex(c, false); t.anisotropy=4; SC_CONTACT.tex[key]=t; return t;
}
function stripContact(car, o){
  var u=car&&car.userData; if(!u||!u.meta) return null; o=o||{};
  if(u._contact){ car.remove(u._contact); u._contact=null; }
  var me=u.meta, body=u.body, rail=body==="rail", wh=[], i;
  for(i=0;i<(me.wheels||[]).length;i++){ var ws=me.wheels[i]; wh.push({x:ws.x, z:ws.z, r:ws.r, w:ws.w||0.3}); }
  if(!wh.length) return null;
  /* footprint: the body group's box (car at rest, at the origin) */
  var keepP=car.position.clone(), keepR=car.rotation.clone(); car.position.set(0,0,0); car.rotation.set(0,0,0); car.updateMatrixWorld(true);
  var bb=new THREE.Box3(), inner=u.bodyGroup&&u.bodyGroup.children[0]; if(inner) inner.children.forEach(function(ch){ if(ch!==u.chute && ch.visible!==false) bb.expandByObject(ch); }); car.position.copy(keepP); car.rotation.copy(keepR); car.updateMatrixWorld(true);
  var wx0=Infinity, wx1=-Infinity, wz=0; wh.forEach(function(w){ wx0=Math.min(wx0,w.x-w.r); wx1=Math.max(wx1,w.x+w.r); wz=Math.max(wz, Math.abs(w.z)+w.w/2); });
  if(bb.isEmpty()) bb.set(new THREE.Vector3(wx0,0,-wz), new THREE.Vector3(wx1,1,wz));
  var soft=!!o.soft, pad=soft?0.7:0.35, x0=Math.min(bb.min.x, wx0)-pad, x1=Math.max(bb.max.x, wx1)+pad, hz=Math.max(wz, rail?0.3:Math.max(-bb.min.z, bb.max.z))+pad;
  var F={x0:x0, lx:x1-x0, lz:2*hz, wheels:wh, soft:soft, rail:rail,
    bx0:rail?wx0+0.2:bb.min.x+0.12, bx1:rail?bb.max.x-0.6:bb.max.x-0.1, bhz:rail?0.28:Math.max(0.3, Math.min(-bb.min.z, bb.max.z)-0.06)};
  var key=body+"|"+[x0,F.lx,F.lz,F.bx0,F.bx1,F.bhz].map(function(v){ return v.toFixed(2); }).join(",")+"|"+wh.map(function(w){ return w.x.toFixed(2)+":"+w.z.toFixed(2)+":"+w.r.toFixed(2)+":"+w.w.toFixed(2); }).join(",")+(soft?"|s":"");
  var tex=scContactTex(key, F), gk="q"+F.lx.toFixed(2)+"x"+F.lz.toFixed(2), geo=SC_CONTACT.geo[gk];
  if(!geo){ geo=new THREE.PlaneGeometry(F.lx, F.lz); geo.rotateX(-PI/2); geo.__cached=true; SC_CONTACT.geo[gk]=geo; }
  var mat=new THREE.MeshBasicMaterial({map:tex, color:0x000000, transparent:true, opacity:o.opacity==null?1:o.opacity, depthWrite:false,
    polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-4});
  /* black colour, alpha from the canvas: MeshBasic multiplies map.rgb (black) and keeps map.a */
  var m=new THREE.Mesh(geo, mat); m.name="stripContact"; m.renderOrder=1; m.frustumCulled=true;
  m.position.set(x0+F.lx/2, (o.y||0)+0.004, 0); m.castShadow=false; m.receiveShadow=false; m.matrixAutoUpdate=false; m.updateMatrix();
  /* Lite pays for the decal by not drawing the rims into the shadow map: the tyre around each one casts the same shadow */
  if(GFX==="lite") (u.carriers||[]).forEach(function(c){ var sp=c.userData&&c.userData.spin; if(sp) sp.traverse(function(q){ if(q.isMesh) q.castShadow=false; }); });
  car.add(m); u._contact=m; return m;
}
/* dusk glare (track shader, STRIP_TRACK_POST.light): with the sun on the horizon the glossy launch groove mirrored it into a
   white blob that the bloom then blew up; from dusk on the sharp highlight is capped and a broad warm sheen replaces it */
function stripGlare(){
  var d=STRIP.night?(STRIP.dusk||0):0, g=clamp(d*1.6,0,1);
  STRIP_U.uGlare.value=g; if(STRIP.sunDir) STRIP_U.uSunW.value.copy(STRIP.sunDir);
  if(STRIP.sun) STRIP_U.uGlareC.value.copy(STRIP.sun.color).multiplyScalar(0.13*g);
}
