/* ===========================================================================
   8. GARAGE
   ==========================================================================*/
function buildGarageMesh(owned){
  setZone(0);
  owned = owned || {};
  var sandbox = !!owned.sandbox;
  var bay = owned.bay2 ? 2 : (owned.bay1 ? 1 : 0);
  var W = [70, 88, 108][bay];       /* room width  (X); 8 wider than it was, so a full zoom-out stays inside (loop.js camRoomR) */
  var D = 70;                       /* room depth  (Z) */
  var Hh= [30, 34, 38][bay];        /* wall height (Y) */

  var G=new THREE.Group();
  var B=new Builder();
  var lights=[];
  var floorKey = sandbox ? "tile" : "concrete";
  var wallKey  = sandbox ? "blockWhite" : "blockPaint";

  /* ---- floor ---- */
  var fl=new THREE.Mesh(planarUV(new THREE.PlaneGeometry(W+8, D+8), sandbox?1/16:1/30), MAT[floorKey]);
  fl.rotation.x=-PI/2; fl.receiveShadow=true; G.add(fl);

  /* ---- walls ---- */
  B.add(wallKey, BOX(W, Hh, 1.2, 1/16), 0, Hh/2, -D/2);
  B.add(wallKey, BOX(1.2, Hh, D, 1/16), -W/2, Hh/2, 0);
  B.add(wallKey, BOX(1.2, Hh, D, 1/16),  W/2, Hh/2, 0);
  /* ceiling */
  B.add("panel", BOX(W, 1.0, D, 1/16), 0, Hh, 0);
  /* dado stripe / kick rail */
  if(!sandbox){
    B.add("paintOrange", BOX(W, 1.1, 0.3, 1/6), 0, 9.5, -D/2+0.7);
    B.add("paintOrange", BOX(0.3, 1.1, D, 1/6), -W/2+0.7, 9.5, 0);
  } else {
    B.add("paintBlue", BOX(W, 0.8, 0.3, 1/6), 0, 7.0, -D/2+0.7);
  }
  /* structural columns */
  var cxs=[-W/2+6, W/2-6];
  for(var c=0;c<cxs.length;c++){
    B.add("panel", BOX(2.2, Hh, 2.2, 1/8), cxs[c], Hh/2, -D/2+3.2);
    B.add("panel", BOX(3.2, 0.6, 3.2, 1/8), cxs[c], Hh-1.4, -D/2+3.2);
  }
  /* roof trusses */
  for(var tr=-2; tr<=2; tr++){
    B.add("panel", BOX(W-2, 0.7, 0.7, 1/8), 0, Hh-1.6, tr*11);
  }

  if(sandbox){
    buildTestCell(B, G, extrasPush(lights), W, D, Hh);
  } else {
    buildShop(B, G, extrasPush(lights), W, D, Hh, owned, bay);
  }
  buildUpgrades(B, G, extrasPush(lights), W, D, Hh, owned, sandbox);

  /* the engine stand is not part of the room: api.js fitStand builds it to suit the engine on it */
  /* the workshop monitor beside it (the app draws on it through ENGINE_VIS.setScreen) */
  var mon=buildMonitor(B, G);

  B.flush(G, {}, true);
  G.userData.liveScreen=mon; SCREEN.mesh=mon;
  for(var li=0; li<lights.length; li++) G.add(lights[li]);
  G.userData.roomW=W; G.userData.roomD=D; G.userData.roomH=Hh;
  G.userData.sceneArgs={W:W, D:D, Hh:Hh, owned:owned, sandbox:sandbox, bay:bay};
  scenePolish(G);                       /* Full / Ultra: floor details, props, warm lamps (props.js); Lite is left alone */
  return G;
}
function extrasPush(arr){ return function(o){ arr.push(o); }; }

/* ---- the workshop monitor ----
   A screen on a low rolling stand behind and left of the engine stand, as the opening camera sees it: low and to the left so a phone in
   portrait sees it between the top buttons and the engine card, near enough the middle that the narrow desktop view keeps it in frame.
   Its top (about 6.3) sits below the lowest the orbiting camera goes (the target height), so the camera passes over it. The app draws the picture on its own canvas (the live dyno curve, the last result, or the shop's name) and
   hands it over with ENGINE_VIS.setScreen; this side only uploads that canvas as a texture when told it changed. The stand and bezel
   merge with the room; the screen is one plane of its own sharing MAT.dynoLive, so a garage rebuild keeps the picture.
   The career dyno console (buildUpgrades) shows the same texture. */
var SCREEN_SPOT={x:-11.5, z:-5.5, ry:0.97, y:4.3, w:8.0, h:4.0};   /* centre on the floor, turn, screen height and size */
/* Ultra only, during a dyno pull: the camera eases toward the monitor (look: share of the way the aim swings to it, push: units the camera
   moves toward it, fov: degrees narrower, ease: 1/s, minDot: how squarely ahead of the camera the monitor must be (cosine), or the move is skipped for that pull) */
var SCREEN_DOLLY={look:0.32, push:2.6, fov:-5, ease:1.4, minDot:0.55};
var SCREEN={canvas:null, tex:null, mesh:null, dolly:false, k:0, skip:false, fov0:0, uploads:0};
var _scrV=new THREE.Vector3(), _scrL=new THREE.Vector3(), _scrF=new THREE.Vector3();
function screenMat(){
  if(!MAT.dynoLive) MAT.dynoLive=new THREE.MeshBasicMaterial({map:SCREEN.tex||MAT.dynoScreen.map, toneMapped:false, fog:false});
  return MAT.dynoLive;
}
function buildMonitor(B, G){
  var s=SCREEN_SPOT;
  B.push(new THREE.Matrix4().makeRotationY(s.ry).setPosition(s.x, 0, s.z));
  B.add("blackPlast", BOX(4.2, 0.4, 3.0, 1/4), 0, 0.5, 0);                    /* wheeled base */
  for(var c=0;c<4;c++) B.add("rubberFlat", CYL(0.3,0.3,0.3,10,false,2), (c%2?1.7:-1.7), 0.3, (c<2?1.1:-1.1), 0,0,PI/2);
  B.add("steel", CYL(0.28,0.28,s.y-s.h/2, 10,false,1/3), 0, (s.y-s.h/2)/2+0.6, -0.4);   /* post */
  B.add("blackPlast", RBOX(s.w+0.6, s.h+0.6, 0.5, 0.12, 1/6), 0, s.y, -0.3);    /* bezel */
  B.add("blackPlast", BOX(2.4, 0.5, 1.2, 1/4), 0, 0.95, 0.6);                  /* a keyboard shelf on the base */
  B.pop();
  var m=new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), screenMat());
  m.position.set(s.x+Math.sin(s.ry)*0.02, s.y, s.z+Math.cos(s.ry)*0.02); m.rotation.y=s.ry; m.name="liveScreen";
  G.add(m);
  return m;
}
/* the camera move, called from tick() after the orbit has placed the camera; returns the point to look at */
function screenCam(dt, tgt){
  var on=SCREEN.dolly && GFX==="ultra" && !SCREEN.skip && SCREEN.mesh && SCREEN.mesh.parent && !TD.on;
  if(on && SCREEN.k===0){   /* starting: only when the monitor is ahead of the camera and beyond the engine (seen past it, not under the lens) */
    SCREEN.mesh.getWorldPosition(_scrV);
    _scrF.subVectors(tgt, camera.position);
    var far=_scrV.distanceTo(camera.position)>_scrF.length(); _scrF.normalize();
    if(!far || _scrF.dot(_scrL.subVectors(_scrV, camera.position).normalize())<SCREEN_DOLLY.minDot){ SCREEN.skip=true; on=false; }
  }
  SCREEN.k = on ? Math.min(1, SCREEN.k+dt*SCREEN_DOLLY.ease) : Math.max(0, SCREEN.k-dt*SCREEN_DOLLY.ease);
  if(SCREEN.k<=0){ if(SCREEN.fov0){ camera.fov=SCREEN.fov0; SCREEN.fov0=0; camera.updateProjectionMatrix(); } return tgt; }
  var e=SCREEN.k*SCREEN.k*(3-2*SCREEN.k);
  SCREEN.mesh.getWorldPosition(_scrV);
  _scrL.copy(tgt).lerp(_scrV, e*SCREEN_DOLLY.look);
  camera.position.addScaledVector(_scrF.subVectors(_scrV, camera.position).normalize(), e*SCREEN_DOLLY.push);
  if(!SCREEN.fov0) SCREEN.fov0=camera.fov;
  camera.fov=SCREEN.fov0+e*SCREEN_DOLLY.fov; camera.updateProjectionMatrix();
  return _scrL;
}

/* ---- the engine stand ----
   A welded run stand that fits the engine on it. It is built from the engine's seat (the bottom of its sump or crankcase, which the
   engine builders leave in G.userData.seat; world units here) each time the engine or the room changes (api.js fitStand), into a group
   of its own beside the garage. Square tube base, four posts and a top frame, braced and gusseted; two cross members clamped on the top
   frame carry the cradle: a saddle beam on two posts under the front and the back of the sump, at its exact height, rubber pads where
   it sits. Shop: Longlight clay paint on swivel casters. Test cell: grey, on levelling feet clamped to the dyno bedplate.
   f: {x0,x1,z0,z1,y, r} the seat (r: a round bottom, the pads rise to meet it); none = a small-block's. Lengths are rounded to a tenth
   so the cached tube geometry stays a short list however many engines are tried. */
var STAND={topY:5.0, tube:0.7, pad:0.32};
function buildStand(B, sandbox, f){
  f = f || {x0:-2.6, x1:2.6, z0:-1.5, z1:1.5, y:7.05, r:0};
  var q=function(v){ return Math.round(v*10)/10; }, V=function(x,y,z){ return new THREE.Vector3(x,y,z); };
  var pk = sandbox ? "paintGrey" : "paintOrange", t=STAND.tube, h=t/2, i, j;
  var y0 = sandbox ? 1.2 : 0;                                  /* bedplate top / floor */
  var cx=(f.x0+f.x1)/2, cz=(f.z0+f.z1)/2, sl=f.x1-f.x0, sw=f.z1-f.z0;
  var Lx=q(clamp(sl*1.15+1.8, 7.0, 10.0)), Wz=q(clamp(sw+2.8, 5.6, 7.2));
  var yb = y0 + (sandbox ? 0.62 : 1.16);                       /* underside of the base: levelling feet / casters */
  var topY=STAND.topY, xs=[cx-Lx/2+h, cx+Lx/2-h], zs=[cz-Wz/2+h, cz+Wz/2-h];
  var px=[cx-Lx/2+1.0, cx+Lx/2-1.0];                            /* posts */
  var rt=0.07;

  /* base: side rails, end cross rails, a middle one under the tray */
  for(j=0;j<2;j++) B.add(pk, RBOX(Lx, t, t, rt, 1/3), cx, yb+h, zs[j]);
  for(i=0;i<2;i++) B.add(pk, RBOX(t, t*0.9, q(Wz-t*2), rt, 1/3), xs[i], yb+h, cz);
  B.add(pk, RBOX(t*0.8, t*0.7, q(Wz-t*2), rt, 1/3), cx, yb+t*0.35, cz);
  /* posts, top side rails, gussets where they meet (a square plate turned 45 degrees: only the corner triangle shows) */
  var postH=q(topY-t-(yb+t)), railTop=yb+t, topBot=topY-t;
  for(i=0;i<2;i++) for(j=0;j<2;j++){
    B.add(pk, RBOX(t*0.9, postH, t*0.9, rt, 1/3), px[i], railTop+postH/2, zs[j]);
    for(var sd=-1; sd<=1; sd+=2){
      B.add(pk, BOX(0.62, 0.62, 0.07, 1/3), px[i]+sd*t*0.45, railTop, zs[j], 0,0,PI/4);
      B.add(pk, BOX(0.62, 0.62, 0.07, 1/3), px[i]+sd*t*0.45, topBot, zs[j], 0,0,PI/4);
    }
  }
  var tL=q(px[1]-px[0]+t*2.2);
  for(j=0;j<2;j++) B.add(pk, RBOX(tL, t, t, rt, 1/3), cx, topY-h, zs[j]);
  B.add(pk, RBOX(t*0.8, t*0.8, q(Wz-t*2), rt, 1/3), px[0], topY-h, cz);        /* rear top cross tie */
  /* braces: an X on each long side, one diagonal on each end */
  var bR=0.12;
  for(j=0;j<2;j++){
    standStrut(B, pk, V(px[0]+h, railTop+0.15, zs[j]), V(px[1]-h, topBot-0.15, zs[j]), bR);
    standStrut(B, pk, V(px[1]-h, railTop+0.15, zs[j]), V(px[0]+h, topBot-0.15, zs[j]), bR);
  }
  for(i=0;i<2;i++) standStrut(B, pk, V(px[i], railTop+0.15, zs[0]+h), V(px[i], topBot-0.15, zs[1]-h), bR);

  /* cradle: two cross members clamped on the top rails, under the front and back of the seat */
  var reach=tL/2-0.55, mA=clamp(f.x0+sl*0.17, cx-reach, cx+reach), mB=clamp(f.x1-sl*0.17, cx-reach, cx+reach);
  var padDz=Math.max(0.55, sw*0.32), padTop=f.y;
  if(f.r) padTop = f.y + f.r - Math.sqrt(Math.max(0, f.r*f.r - padDz*padDz));   /* a round bottom: where it is padDz off its lowest line */
  var padH=STAND.pad, beamH=0.42, beamTop=padTop-padH, cmTop=topY+0.55;
  var sPostZ=Math.max(padDz+0.55, sw*0.5+0.35), sPostH=q(Math.max(0.1, beamTop-beamH-cmTop));
  [mA,mB].forEach(function(mx){
    B.add(pk, RBOX(0.62, 0.55, q(Wz+0.3), 0.06, 1/3), mx, topY+0.275, cz);     /* cross member */
    for(j=0;j<2;j++){                                                          /* its clamp blocks and bolts on the rails */
      B.add("steel", BOX(0.9, 0.16, 0.9, 1/3), mx, topY+0.04, zs[j]);
      for(var cb=-1; cb<=1; cb+=2) B.add("steel", CYL(0.09,0.09,0.12,6,false,2), mx+cb*0.32, topY+0.16, zs[j]+0.3);
    }
    for(j=-1;j<=1;j+=2){                                                       /* saddle posts with their adjuster pins */
      B.add(pk, RBOX(0.48, sPostH, 0.48, 0.05, 1/3), mx, cmTop+sPostH/2, cz+j*sPostZ);
      B.add("steel", CYL(0.07,0.07,0.62,8,false,2), mx, cmTop+Math.min(sPostH*0.5, 0.35), cz+j*sPostZ, 0,0,PI/2);
      B.add("steel", CYL(0.13,0.13,0.08,6,false,2), mx+0.31, cmTop+Math.min(sPostH*0.5, 0.35), cz+j*sPostZ, 0,0,PI/2);
    }
    B.add("steel", RBOX(0.66, beamH, q(sPostZ*2+0.6), 0.05, 1/3), mx, beamTop-beamH/2, cz);   /* saddle beam */
    for(j=-1;j<=1;j+=2){
      B.add("steel", BOX(0.86, 0.06, 0.86, 1/3), mx, beamTop+0.03, cz+j*padDz);              /* pad plate */
      B.add("rubberFlat", RBOX(0.78, padH-0.06, 0.78, 0.08, 1/3), mx, beamTop+0.06+(padH-0.06)/2, cz+j*padDz);
    }
  });

  /* drip tray on the base cross rails: a shallow pan with a lip */
  var dL=q(Lx-0.9), dW=q(Wz-t*2-0.1), dy=yb+t*0.9+0.04;
  B.add("dark", BOX(dL, 0.06, dW, 1/6), cx, dy, cz);
  B.add("dark", BOX(dL, 0.26, 0.06, 1/6), cx, dy+0.13, cz-dW/2);
  B.add("dark", BOX(dL, 0.26, 0.06, 1/6), cx, dy+0.13, cz+dW/2);
  B.add("dark", BOX(0.06, 0.26, dW, 1/6), cx-dL/2, dy+0.13, cz);
  B.add("dark", BOX(0.06, 0.26, dW, 1/6), cx+dL/2, dy+0.13, cz);

  /* feet */
  for(i=0;i<2;i++) for(j=0;j<2;j++){
    var fx=xs[i], fz=zs[j];
    if(sandbox){
      /* levelling foot: plate, threaded rod and lock nut, rubber-faced pad; a hold-down clamp to the bedplate T-slot beside it */
      B.add("steel", BOX(0.9, 0.08, 0.9, 1/3), fx, yb-0.04, fz);
      B.add("steel", CYL(0.2,0.2,0.12,6,false,2), fx, yb-0.14, fz);
      B.add("steel", CYL(0.08,0.08,0.38,8,false,2), fx, y0+0.27, fz);
      B.add("steel", CYL(0.36,0.4,0.1,16,false,2), fx, y0+0.13, fz);
      B.add("rubberFlat", CYL(0.4,0.4,0.08,16,false,2), fx, y0+0.04, fz);
      var cs=(j?1:-1);
      B.add("dark", BOX(0.34, 0.12, 0.9, 1/3), fx, yb-0.02, fz+cs*0.75);
      B.add("steel", CYL(0.07,0.07,0.7,8,false,2), fx, y0+0.25, fz+cs*0.95);
      B.add("steel", CYL(0.15,0.15,0.1,6,false,2), fx, yb+0.1, fz+cs*0.95);
      B.add("dark", BOX(0.4, yb-y0-0.04, 0.3, 1/3), fx, (yb+y0)/2-0.04, fz+cs*1.22);
    } else {
      /* swivel caster: top plate, swivel race, fork, wheel on its axle; the front pair have a brake pedal */
      B.add("steel", BOX(0.86, 0.08, 0.86, 1/3), fx, yb-0.04, fz);
      B.add("steel", CYL(0.32,0.34,0.12,16,false,2), fx, yb-0.14, fz);
      var tr=(i?-0.12:0.12);
      for(var fk=-1; fk<=1; fk+=2) B.add("steel", BOX(0.5, 0.62, 0.06, 1/3), fx+tr, yb-0.5, fz+fk*0.21);
      B.add("steel", BOX(0.5, 0.06, 0.48, 1/3), fx+tr*0.5, yb-0.22, fz);
      B.add("rubberFlat", CYL(0.42,0.42,0.3,18,false,2), fx+tr, y0+0.42, fz, PI/2,0,0);
      B.add("steel", CYL(0.2,0.2,0.33,12,false,2), fx+tr, y0+0.42, fz, PI/2,0,0);
      B.add("steel", CYL(0.07,0.07,0.52,6,false,2), fx+tr, y0+0.42, fz, PI/2,0,0);
      if(i===1) B.add("paintOrange", BOX(0.42, 0.07, 0.3, 1/3), fx+0.48, yb-0.3, fz, 0,0,-0.35);
    }
  }

  /* kill switch box on the front post, the cell's lead to the engine coiled on a hook */
  var kx=px[1], kz=zs[1]+h+0.26, ky=railTop+postH*0.55;
  B.add("blackPlast", RBOX(0.9, 1.1, 0.5, 0.08, 1/3), kx, ky, kz);
  B.add("filterRed", CYL(0.2,0.24,0.18,14,false,2), kx, ky+0.18, kz+0.32, PI/2,0,0);
  B.add("paintOrange", BOX(0.5, 0.12, 0.04, 1/3), kx, ky-0.3, kz+0.27);
  B.add("steel", CYL(0.05,0.05,0.5,6,false,2), px[0], ky, zs[1]+h+0.25, PI/2,0,0);
  B.add("rubberFlat", TOR(0.36, 0.05, 6, 20, 2), px[0], ky-0.3, zs[1]+h+0.45, 0,0,0);
}
/* a round brace tube from a to b */
function standStrut(B, key, a, b, r){
  var d=new THREE.Vector3().subVectors(b,a), L=Math.round(d.length()*10)/10;
  var m=new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), d.normalize()), new THREE.Vector3(1,1,1));
  B.addM(key, CYL(r, r, L, 10, false, 1/3), m);
}
/* the test cell's dyno bedplate (and photo mode's, photo.js): a cast-iron plate with machined T-slots on a painted plinth and
   four isolation mounts; its top is at 1.2, where the stand's levelling feet stand */
function buildDynoBed(B){
  B.add("panel", RBOX(17.2, 0.72, 27.2, 0.12, 1/6), 0, 0.36, 0);               /* plinth */
  B.add("iron", RBOX(16.0, 0.5, 26.0, 0.05, 1/4), 0, 0.95, 0);                 /* bedplate */
  for(var ts=0; ts<7; ts++){                                                   /* T-slots: a dark slot with bright machined lips */
    B.add("blackPlast", BOX(0.36, 0.03, 25.4, 1/4), -6.0+ts*2.0, 1.2, 0);
    B.add("malu", BOX(0.08, 0.035, 25.4, 1/4), -6.22+ts*2.0, 1.2, 0);
    B.add("malu", BOX(0.08, 0.035, 25.4, 1/4), -5.78+ts*2.0, 1.2, 0);
  }
  for(var c=0;c<4;c++){                                                        /* isolation mounts at the corners */
    var mx=(c%2?1:-1)*7.6, mz=(c<2?1:-1)*12.4;
    B.add("rubberFlat", CYL(0.55,0.62,0.3,14,false,2), mx, 0.15, mz);
    B.add("steel", CYL(0.2,0.2,0.1,6,false,2), mx, 1.25, mz);
  }
}

function buildShop(B, G, addLight, W, D, Hh, owned, bay){
  /* ---- roll-up door on the back wall ---- */
  var doorW=Math.min(26, W*0.36), doorH=Hh*0.62;
  B.add("door", BOX(doorW, doorH, 0.7, 1/10), W*0.22, doorH/2, -D/2+0.9);
  B.add("panel", BOX(doorW+2.2, 1.4, 1.1, 1/8), W*0.22, doorH+0.7, -D/2+0.9);
  B.add("panel", BOX(1.2, doorH+1.4, 1.1, 1/8), W*0.22-doorW/2-0.6, (doorH+1.4)/2, -D/2+0.9);
  B.add("panel", BOX(1.2, doorH+1.4, 1.1, 1/8), W*0.22+doorW/2+0.6, (doorH+1.4)/2, -D/2+0.9);

  /* ---- shop sign over the door ---- */
  var sign=new THREE.Mesh(new THREE.PlaneGeometry(24,6), MAT.sign);
  sign.position.set(-W*0.16, Hh*0.70, -D/2+0.72); G.add(sign);

  /* ---- posters ---- */
  var p1=new THREE.Mesh(new THREE.PlaneGeometry(7,9.6), MAT.poster1);
  p1.position.set(-W/2+0.75, 16, -6); p1.rotation.y=PI/2; G.add(p1);
  var p2=new THREE.Mesh(new THREE.PlaneGeometry(9,6.8), MAT.poster2);
  p2.position.set(-W/2+0.75, 16, 8); p2.rotation.y=PI/2; G.add(p2);

  /* ---- workbench + pegboard (right wall) ---- */
  var bx=W/2-7;
  B.add("woodDark", BOX(4.4, 0.9, 26, 1/6), bx, 8.6, -8);
  B.add("panel", BOX(4.0, 7.6, 25, 1/8), bx, 4.3, -8);
  for(var dw=0; dw<4; dw++){
    B.add("panel", BOX(0.25, 1.6, 5.6, 1/4), bx-2.05, 6.6-dw*1.9, -18+dw*0.0);
    B.add("steel", BOX(0.3, 0.25, 2.2, 1/3), bx-2.25, 6.6-dw*1.9, -18);
  }
  var peg=new THREE.Mesh(new THREE.PlaneGeometry(22,13), MAT.toolboard);
  peg.position.set(W/2-0.8, 16, -8); peg.rotation.y=-PI/2; G.add(peg);
  /* vice */
  B.add("steel", BOX(1.8, 1.3, 2.6, 1/3), bx-0.6, 9.7, -18.5);
  B.add("paintBlue", BOX(2.4, 2.0, 2.0, 1/3), bx-0.6, 10.2, -16.4);

  /* ---- tool chest (left) ---- */
  B.add("paintOrange", RBOX(7.2, 12.0, 5.6, 0.25, 1/6), -W/2+7.5, 6.2, -14);
  for(var dr=0; dr<5; dr++){
    B.add("steel", BOX(6.2, 0.28, 0.35, 1/3), -W/2+7.5, 2.4+dr*2.1, -11.1);
  }
  B.add("woodDark", BOX(7.8, 0.5, 6.0, 1/6), -W/2+7.5, 12.4, -14);
  /* castors */
  for(var tc=0; tc<2; tc++)
    B.add("rubberFlat", CYL(0.5,0.5,0.4,12,false,2.0), -W/2+5.2+tc*4.6, 0.5, -11.6, 0,0,PI/2);

  /* ---- shelving with parts (right rear) ---- */
  var sx=W/2-3.4;
  B.add("panel", BOX(0.5, 20, 0.5, 1/4), sx, 10, 8);
  B.add("panel", BOX(0.5, 20, 0.5, 1/4), sx, 10, 24);
  for(var sh=0; sh<4; sh++)
    B.add("panel", BOX(5.0, 0.4, 16.5, 1/6), sx, 3.5+sh*5.2, 16);
  for(var pr=0; pr<8; pr++){
    var pz=10+ (pr%4)*4.2, py=3.5+Math.floor(pr/4)*5.2+1.6;
    B.add(pr%2?"calu":"steel", CYL(1.2,1.2,2.4,14,false,1.6), sx, py, pz);
  }
  /* ---- oil drums ---- */
  for(var od=0; od<3; od++){
    B.add(od===1?"paintBlue":"paintOrange", CYL(2.1,2.1,7.4,20,false,1.2), -W/2+3.4+od*4.6, 3.7, 20);
    B.add("steel", TOR(2.1,0.22,6,20,1.6), -W/2+3.4+od*4.6, 6.6, 20, PI/2,0,0);
    B.add("steel", TOR(2.1,0.22,6,20,1.6), -W/2+3.4+od*4.6, 1.4, 20, PI/2,0,0);
  }
  /* ---- tyre stack ---- */
  for(var ty=0; ty<4; ty++){
    B.add("rubberFlat", TOR(2.6,1.05,10,22,1.4), -W/2+6.0, 1.1+ty*2.1, -26, PI/2,0,0);
  }
  /* ---- diamond-plate step ---- */
  B.add("plate", BOX(9, 0.5, 5, 1/4), -W*0.30, 1.6, 15);
  B.add("plate", BOX(9, 0.5, 5, 1/4), -W*0.30, 0.7, 18.6);
  B.add("panel", BOX(9, 1.7, 0.5, 1/6), -W*0.30, 0.85, 17.4);

  /* ---- floor oil-stain decals ---- */
  addStainDecals(G, W, D);

  /* ---- lighting fixtures ---- */
  var rows = bay>=1 ? 3 : 2;
  for(var lz=0; lz<2; lz++){
    for(var lx=0; lx<rows; lx++){
      var X=(lx-(rows-1)/2)*(W/rows*0.92), Z=-12+lz*22;
      B.add("panel", BOX(2.6, 0.7, 13, 1/8), X, Hh-2.2, Z);
      B.add("lamp",  BOX(2.1, 0.28, 12.4, 1/8), X, Hh-2.6, Z);
      B.add("panel", BOX(0.2, 1.6, 0.2, 1/4), X-1.0, Hh-1.2, Z-5);
      B.add("panel", BOX(0.2, 1.6, 0.2, 1/4), X+1.0, Hh-1.2, Z+5);
    }
  }
  var pl=new THREE.PointLight(0xffe9c8, 0.42, 70, 2.0); pl.position.set(0, Hh-5, 0); addLight(pl);
  G.userData.workLight=pl;
}

function buildTestCell(B, G, addLight, W, D, Hh){
  /* clean white cell: control-room window, instrument rack, dyno bed */
  /* painted lane / safety lines on the floor */
  B.add("paintBlue", BOX(W*0.7, 0.06, 0.5, 1/6), 0, 0.05, -13);
  B.add("paintBlue", BOX(W*0.7, 0.06, 0.5, 1/6), 0, 0.05,  13);
  B.add("paintBlue", BOX(0.5, 0.06, 26.5, 1/6), -W*0.35, 0.05, 0);
  B.add("paintBlue", BOX(0.5, 0.06, 26.5, 1/6),  W*0.35, 0.05, 0);

  /* control-room window in the back wall */
  var winW=W*0.46, winH=Hh*0.30, winY=Hh*0.52;
  B.add("panel", BOX(winW+2.0, winH+2.0, 0.8, 1/10), -W*0.16, winY, -D/2+0.5);
  var glass=new THREE.Mesh(planarUV(new THREE.BoxGeometry(winW, winH, 0.35), 1/10), MAT.glass);
  glass.position.set(-W*0.16, winY, -D/2+0.1); G.add(glass);
  /* glow from the control room behind the glass */
  B.add("screenBlue", BOX(winW*0.98, winH*0.96, 0.12, 1/10), -W*0.16, winY, -D/2+0.35);
  for(var mul=0; mul<3; mul++)
    B.add("panel", BOX(0.4, winH, 0.5, 1/8), -W*0.16-winW*0.34+mul*winW*0.34, winY, -D/2+0.1);

  /* instrument rack */
  var rx=W*0.30;
  B.add("panel", RBOX(7.0, 20.0, 6.0, 0.2, 1/8), rx, 10.0, -16);
  for(var u=0;u<5;u++){
    B.add("blackPlast", BOX(6.4, 2.4, 0.4, 1/6), rx, 4.0+u*3.4, -13.1);
    B.add(u%2?"screenGreen":"screenAmber", BOX(3.2, 1.2, 0.2, 1/6), rx-1.0, 4.0+u*3.4, -12.85);
  }
  B.add("panel", BOX(7.6, 0.5, 6.6, 1/8), rx, 20.3, -16);
  /* cable tray to the engine */
  B.add("panel", BOX(1.6, 0.35, 14, 1/6), rx-4.2, 0.4, -8);

  /* dyno bedplate under the stand */
  buildDynoBed(B);

  /* extraction hood overhead */
  B.add("panel", CONE(1.8, 4.4, 4.0, 20, 1/8), W*0.34, Hh-6.4, -14);
  B.add("panel", CYL(1.8,1.8,4.8,20,false,1/8), W*0.34, Hh-2.0, -14);
  B.add("panel", CYL(1.5,1.5,12,16,false,1/8), W*0.34, Hh-4.2, -20, PI/2,0,0);

  /* bright, even cell lighting */
  for(var lx=-1; lx<=1; lx++) for(var lz=-1; lz<=1; lz+=2){
    B.add("panel", BOX(9.0, 0.7, 9.0, 1/8), lx*W*0.28, Hh-1.9, lz*13);
    B.add("lampCool", BOX(8.4, 0.3, 8.4, 1/8), lx*W*0.28, Hh-2.3, lz*13);
  }
  var pl=new THREE.PointLight(0xdfeeff, 0.55, 80, 2.0); pl.position.set(0, Hh-6, 4); addLight(pl);
}

function addStainDecals(G, W, D){
  if(!MAT.stainDecal){
    MAT.stainDecal = drawMat(256,256,function(x,w,h){
      x.clearRect(0,0,w,h);
      for(var i=0;i<7;i++){
        var cx=w*(0.3+Math.random()*0.4), cy=h*(0.3+Math.random()*0.4);
        var r=w*(0.10+Math.random()*0.22);
        var g=x.createRadialGradient(cx,cy,1,cx,cy,r);
        g.addColorStop(0,"rgba(18,14,8,0.62)"); g.addColorStop(0.6,"rgba(24,19,10,0.30)");
        g.addColorStop(1,"rgba(24,19,10,0)");
        x.fillStyle=g; x.beginPath(); x.arc(cx,cy,r,0,TAU); x.fill();
      }
    },{transparent:true, rough:0.35});
    MAT.stainDecal.depthWrite=false;
    MAT.stainDecal.polygonOffset=true;
    MAT.stainDecal.polygonOffsetFactor=-2;
  }
  var spots=[[-W*0.22, 12, 11],[W*0.26, -6, 9],[-W*0.05, 22, 7],[W*0.10, 26, 6]];
  for(var i=0;i<spots.length;i++){
    var m=new THREE.Mesh(new THREE.PlaneGeometry(spots[i][2],spots[i][2]), MAT.stainDecal);
    m.rotation.x=-PI/2; m.rotation.z=i*1.3;
    m.position.set(spots[i][0], 0.06, spots[i][1]);
    m.receiveShadow=false; G.add(m);
  }
}

function buildUpgrades(B, G, addLight, W, D, Hh, owned, sandbox){
  var has=function(k){ return !!owned[k]; };

  /* --- dyno --- */
  if(has("dyno2")||has("dyno3")){
    var dx=W*0.30, dz=14;
    B.add("panel", RBOX(9.0, 8.0, 9.0, 0.3, 1/8), dx, 4.0, dz);
    B.add("plate", BOX(9.6, 0.5, 9.6, 1/4), dx, 8.3, dz);
    /* absorber drum */
    B.add("steel", CYL(2.6,2.6,7.0,22,false,1.4), dx, 10.6, dz, 0,0,PI/2);
    B.add("malu", CYL(1.0,1.0,3.0,16,false,1.6), dx-4.6, 10.6, dz, 0,0,PI/2);
    /* console */
    B.add("panel", RBOX(7.0, 9.0, 3.0, 0.2, 1/8), dx-1, 4.5, dz-9.5);
    var scr=new THREE.Mesh(new THREE.PlaneGeometry(5.4,3.4), screenMat());   /* the same picture as the workshop monitor */
    scr.position.set(dx-1, 7.2, dz-11.1); scr.rotation.x=-0.22; G.add(scr);
    B.add("blackPlast", BOX(5.0, 1.4, 1.2, 1/6), dx-1, 4.6, dz-11.0);
    if(has("dyno3")){
      /* pro cell: glass screen wall + ducting + blue instrument bank */
      var gl=new THREE.Mesh(planarUV(new THREE.BoxGeometry(0.4, 20, 26), 1/10), MAT.glass);
      gl.position.set(W*0.44, 10, 6); G.add(gl);
      B.add("panel", BOX(0.9, 21, 0.9, 1/6), W*0.44, 10.5, -7);
      B.add("panel", BOX(0.9, 21, 0.9, 1/6), W*0.44, 10.5, 19);
      B.add("panel", CYL(2.4,2.4,16,18,false,1/8), W*0.20, Hh-4.5, 20, PI/2,0,0);
      B.add("panel", CONE(2.4, 5.2, 5.0, 18, 1/8), W*0.20, Hh-8.0, 12);
      for(var pb=0; pb<3; pb++)
        B.add("screenBlue", BOX(2.6, 1.4, 0.2, 1/6), dx-3.2+pb*2.2, 8.9, dz-11.05);
      var dl=new THREE.PointLight(0x74c8ff, 0.5, 46, 2.0); dl.position.set(dx, 12, dz-4); addLight(dl);
    } else {
      var al=new THREE.PointLight(0xffb45e, 0.35, 40, 2.0); al.position.set(dx, 11, dz-6); addLight(al);
    }
  }

  /* --- machine shop I: mill / lathe --- */
  if(has("shop1")){
    var mx=-W*0.32, mz=10;
    B.add("paintGrey", RBOX(10.0, 5.0, 6.0, 0.25, 1/8), mx, 2.5, mz);
    B.add("plate", BOX(11.0, 0.6, 6.6, 1/4), mx, 5.3, mz);
    B.add("paintGrey", RBOX(2.6, 9.0, 5.0, 0.2, 1/8), mx-4.0, 9.8, mz);
    B.add("paintGrey", BOX(9.0, 2.2, 3.6, 1/8), mx+0.6, 13.4, mz);
    B.add("steel", CYL(0.9,0.9,4.0,16,false,1.6), mx+3.4, 11.0, mz);
    B.add("steel", CYL(0.35,0.35,2.0,10,false,2.0), mx+3.4, 8.4, mz);
    /* lathe spindle */
    B.add("steel", CYL(1.5,1.5,8.0,18,false,1.4), mx, 7.0, mz-0.2, 0,0,PI/2);
    B.add("blackPlast", CYL(1.7,1.7,0.8,16,false,1.6), mx-4.6, 7.0, mz-0.2, 0,0,PI/2);
    /* chip pan */
    B.add("steel", BOX(11.5, 0.4, 7.0, 1/5), mx, 0.3, mz);
  }
  if(has("shop2")){
    var cx2=-W*0.36, cz2=24;
    B.add("panel", RBOX(9.0, 16.0, 8.0, 0.3, 1/8), cx2, 8.0, cz2);
    B.add("screenGreen", BOX(3.4, 2.4, 0.2, 1/6), cx2+2.4, 11.5, cz2-4.1);
    B.add("blackPlast", BOX(4.6, 5.0, 0.4, 1/6), cx2+2.2, 9.6, cz2-4.15);
    B.add("paintOrange", BOX(2.2, 1.0, 0.5, 1/5), cx2-2.6, 13.0, cz2-4.1);
    /* granite surface plate */
    B.add("blackPlast", BOX(8.0, 1.4, 6.0, 1/6), cx2+11, 6.2, cz2+2);
    B.add("panel", BOX(7.0, 5.0, 5.0, 1/8), cx2+11, 2.7, cz2+2);
  }

  /* --- flow bench --- */
  if(has("flow")){
    var fx2=W*0.40, fz=-6;
    B.add("panel", RBOX(6.0, 14.0, 6.0, 0.25, 1/8), fx2, 7.0, fz);
    B.add("malu", CYL(1.8,1.8,4.5,18,false,1.6), fx2, 15.5, fz);
    B.add("malu", CONE(1.0, 1.8, 2.2, 18, 1.6), fx2, 18.6, fz);
    B.add("screenGreen", BOX(3.0, 2.0, 0.2, 1/6), fx2, 11.0, fz-3.1);
    B.add("blackPlast", BOX(4.0, 4.0, 0.4, 1/6), fx2, 10.0, fz-3.15);
    /* manometer tubes */
    for(var mt=0; mt<4; mt++)
      B.add("glass", CYL(0.16,0.16,5.0,8,false,2.0), fx2-1.6+mt*1.05, 5.0, fz-3.2);
  }

  /* --- boost bench: compressor + turbo rack --- */
  if(has("boost")){
    var bx2=-W*0.10, bz=-D/2+7;
    B.add("paintBlue", CYL(3.0,3.0,10.0,20,false,1.2), bx2, 5.0, bz, 0,0,PI/2);
    B.add("panel", BOX(11.0, 1.0, 6.5, 1/6), bx2, 0.6, bz);
    B.add("steel", CYL(1.2,1.2,3.4,16,false,1.6), bx2+4.2, 8.4, bz);
    B.add("blackPlast", BOX(2.6, 2.2, 2.2, 1/6), bx2-4.2, 8.4, bz);
    /* turbo rack on the wall */
    B.add("panel", BOX(14.0, 0.5, 3.4, 1/6), bx2+3, 15.0, -D/2+2.2);
    for(var tr2=0; tr2<3; tr2++){
      var tx=bx2-2.6+tr2*4.0;
      B.add("turbine", TOR(1.5, 0.75, 8, 18, 1.4), tx, 16.6, -D/2+2.4, 0, PI/2, 0);
      B.add("palu", TOR(1.6, 0.80, 8, 18, 1.4), tx+1.6, 16.6, -D/2+2.4, 0, PI/2, 0);
      B.add("malu", CYL(0.6,0.6,1.5,12,false,1.6), tx+0.8, 16.6, -D/2+2.4, 0,0,PI/2);
    }
  }

  /* --- second bay: gantry crane --- */
  if(has("bay1")){
    var gz=[-14, 8], gxA=-W*0.46, gxB=-W*0.26, gxM=(gxA+gxB)/2;
    for(var g2=0; g2<2; g2++){
      B.add("paintBlue", BOX(1.5, 24, 1.5, 1/6), gxA, 12, gz[g2]);
      B.add("paintBlue", BOX(1.5, 24, 1.5, 1/6), gxB, 12, gz[g2]);
      B.add("paintBlue", BOX(W*0.20+1.5, 1.8, 1.8, 1/6), gxM, 24.4, gz[g2]);
    }
    B.add("paintBlue", BOX(1.6, 1.6, 23, 1/6), gxM, 24.4, -3);
    B.add("steel", BOX(2.4, 2.0, 2.4, 1/5), gxM, 23.0, -5);
    B.add("steel", CYL(0.14,0.14,9.0,8,false,2.0), gxM, 17.6, -5);
    B.add("steel", TOR(1.1, 0.22, 6, 16, 1.6), gxM, 12.6, -5, PI/2,0,0);
  }
  /* --- race bay banner --- */
  if(has("bay2")){
    var ban=new THREE.Mesh(new THREE.PlaneGeometry(22,4.8), MAT.raceBanner);
    ban.position.set(W*0.22, Hh*0.80, -D/2+0.72); G.add(ban);
    B.add("paintOrange", BOX(W*0.9, 0.5, 0.5, 1/6), 0, 4.0, D/2-2);
    /* pit-lane style floor chevrons */
    for(var ch=0; ch<6; ch++)
      B.add("paintOrange", BOX(3.0, 0.07, 1.2, 1/5), -W*0.34+ch*4.6, 0.06, 26, 0, 0.5, 0);
  }
  /* --- prestige --- */
  if(has("prestige_sign")){
    /* lit sign over the roll-up door on the back wall */
    var sw=W*0.36, sy=Hh-6.5, sz=-D/2+1.0;
    B.add("blackPlast", BOX(sw+0.8, 5.2, 0.7, 1/6), 0, sy, sz);
    var face=new THREE.Mesh(new THREE.PlaneGeometry(sw, 4.2), new THREE.MeshBasicMaterial({color:0xff8a2a}));
    face.position.set(0, sy, sz+0.36); G.add(face);
    var txt=new THREE.Mesh(new THREE.PlaneGeometry(sw*0.86, 2.2), new THREE.MeshBasicMaterial({color:0x1a1206}));
    txt.position.set(0, sy, sz+0.38); G.add(txt);
    var sl=new THREE.PointLight(0xffa04d, 0.9, 30, 2.0); sl.position.set(0, sy-3, sz+3); addLight(sl);
  }
  if(has("prestige_trophy")){
    /* shelves of little blocks and plaques on the left wall — and one brass plaque per delivery, up to a wall of forty */
    var tx=-W/2+1.0, tz=D*0.18, k;
    var nDel=Math.min(40, owned.deliveries||0);
    for(k=0;k<nDel;k++){ var pr=Math.floor(k/10), pc=k%10; B.add(k%3===0?"copper":"steel", BOX(0.12, 0.9, 0.7, 1/8), tx+0.35, 26.5-pr*1.4, tz-7+pc*1.55); }
    for(k=0;k<3;k++){
      B.add("woodDark", BOX(0.6, 0.35, 12, 1/8), tx+0.6, 12+k*4.2, tz);
      for(var j=0;j<5;j++){ var mk=(j+k)%3===0?"malu":(j+k)%3===1?"steel":"paintOrange";
        B.add(mk, BOX(0.9, 1.6+((j*7+k*3)%4)*0.25, 1.4, 1/6), tx+0.7, 12.9+k*4.2, tz-5+j*2.5); }
    }
    B.add("blackPlast", BOX(0.2, 6.5, 13.5, 1/6), tx+0.3, 14.5+4.2, tz);
  }
  if(owned.pullCups>0){
    /* pulling-series cups: one per championship on a plank by the right-hand wall, up to eight */
    var cupX=W/2-1.4, cupZ=-D*0.06, nCup=Math.min(8, owned.pullCups), q;
    B.add("woodDark", BOX(1.6, 0.35, 11, 1/8), cupX, 12, cupZ);
    for(q=0;q<nCup;q++){ var cz=cupZ-4.4+q*1.25;
      B.add("copper", CYL(0.4,0.4,0.14,12), cupX, 12.25, cz); B.add("copper", CYL(0.09,0.09,0.55,8), cupX, 12.6, cz);
      B.add("copper", CYL(0.42,0.16,0.75,12), cupX, 13.25, cz); B.add("copper", BOX(0.08,0.35,0.5,1/8), cupX, 13.3, cz+0.42); B.add("copper", BOX(0.08,0.35,0.5,1/8), cupX, 13.3, cz-0.42); }
  }
  if(has("prestige_display")){
    /* a chrome show engine on a lit plinth near the front */
    var px=W*0.34, pz=D*0.36;
    B.add("panel", RBOX(7.5, 2.2, 7.5, 0.3, 1/8), px, 1.1, pz);
    B.add("plate", BOX(8.0, 0.3, 8.0, 1/4), px, 2.35, pz);
    B.add("malu", RBOX(4.6, 3.2, 3.0, 0.2, 1/6), px, 4.2, pz);
    B.add("malu", RBOX(4.9, 1.2, 2.2, 0.15, 1/6), px, 6.4, pz);
    for(var c=0;c<4;c++) B.add("steel", CYL(0.32,0.32,1.6,10,false,1.2), px-1.65+c*1.1, 7.6, pz);
    B.add("steel", CYL(0.45,0.45,5.4,12,false,1.2), px, 7.9, pz+1.2, PI/2,0,0);
    var dl2=new THREE.PointLight(0xfff2dc, 0.9, 18, 2.0); dl2.position.set(px, 12, pz); addLight(dl2);
  }
}

