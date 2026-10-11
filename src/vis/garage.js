/* ===========================================================================
   8. GARAGE
   ==========================================================================*/
var GARAGE_CACHE=null;
function buildGarageMesh(owned){
  setZone(0);
  owned = owned || {};
  var sandbox = !!owned.sandbox;
  var bay = owned.bay2 ? 2 : (owned.bay1 ? 1 : 0);
  var W = [62, 80, 100][bay];       /* room width  (X) */
  var D = 62;                       /* room depth  (Z) */
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

  /* engine stand */
  buildStand(B, sandbox);

  B.flush(G, {}, true);
  for(var li=0; li<lights.length; li++) G.add(lights[li]);
  G.userData.roomW=W; G.userData.roomD=D; G.userData.roomH=Hh;
  return G;
}
function extrasPush(arr){ return function(o){ arr.push(o); }; }

function buildStand(B, sandbox){
  var pk = sandbox ? "paintGrey" : "paintOrange";
  var w=6.2, d=9.0, topY=6.0;
  /* base rails + cross members */
  B.add(pk, BOX(1.1, 0.9, d, 1/3), -w/2, 0.9, 0);
  B.add(pk, BOX(1.1, 0.9, d, 1/3),  w/2, 0.9, 0);
  B.add(pk, BOX(w, 0.8, 1.0, 1/3), 0, 0.9,  d/2-0.8);
  B.add(pk, BOX(w, 0.8, 1.0, 1/3), 0, 0.9, -d/2+0.8);
  /* uprights + diagonal braces */
  var ux=[-w/2, w/2], uz=[-d/2+1.2, d/2-1.2], i, j;
  for(i=0;i<2;i++) for(j=0;j<2;j++){
    B.add(pk, BOX(0.95, topY-1.2, 0.95, 1/3), ux[i], (topY-1.2)/2+1.3, uz[j]);
  }
  for(i=0;i<2;i++){
    B.add(pk, BOX(0.6, 0.6, d*0.86, 1/3), ux[i], topY*0.55, 0, 0.32, 0, 0);
  }
  /* top cradle */
  B.add(pk, BOX(w+1.4, 0.85, 1.5, 1/3), 0, topY, -d*0.26);
  B.add(pk, BOX(w+1.4, 0.85, 1.5, 1/3), 0, topY, d*0.26);
  B.add("plate", BOX(w+1.0, 0.28, 2.6, 1/4), 0, topY+0.55, -d*0.26);
  B.add("plate", BOX(w+1.0, 0.28, 2.6, 1/4), 0, topY+0.55, d*0.26);
  /* rubber pads */
  B.add("rubberFlat", BOX(w+0.6, 0.30, 1.9, 1/3), 0, topY+0.82, -d*0.26);
  B.add("rubberFlat", BOX(w+0.6, 0.30, 1.9, 1/3), 0, topY+0.82, d*0.26);
  /* casters */
  var cx=[-w/2, w/2], cz=[-d/2+1.0, d/2-1.0];
  for(i=0;i<2;i++) for(j=0;j<2;j++){
    B.add("steel", BOX(0.7,0.7,0.7,1/2), cx[i], 0.45, cz[j]);
    B.add("rubberFlat", CYL(0.45,0.45,0.34,14,false,2.0), cx[i], 0.45, cz[j], 0,0,PI/2);
  }
  /* drip tray */
  B.add("steel", BOX(w+2.4, 0.18, d*0.7, 1/4), 0, 0.10, 0);
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
    B.add(od===1?"paintBlue":"paintOrange", CYL(2.1,2.1,7.4,20,false,1.2), -W/2+5.5+od*5.0, 3.7, 20);
    B.add("steel", TOR(2.1,0.22,6,20,1.6), -W/2+5.5+od*5.0, 6.6, 20, PI/2,0,0);
    B.add("steel", TOR(2.1,0.22,6,20,1.6), -W/2+5.5+od*5.0, 1.4, 20, PI/2,0,0);
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

  /* dyno bed under the stand */
  B.add("plate", BOX(16, 1.2, 26, 1/4), 0, 0.6, 0);
  B.add("panel", BOX(3.0, 3.6, 22, 1/6), -6.6, 2.4, 0);
  B.add("panel", BOX(3.0, 3.6, 22, 1/6),  6.6, 2.4, 0);
  /* T-slots */
  for(var ts=0; ts<7; ts++)
    B.add("blackPlast", BOX(0.5, 0.3, 25, 1/4), -6.0+ts*2.0, 1.25, 0);

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
    var scr=new THREE.Mesh(new THREE.PlaneGeometry(5.4,3.4), MAT.dynoScreen);
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

