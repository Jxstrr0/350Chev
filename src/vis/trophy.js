/* ===========================================================================
   TROPHY ROOM — the shop's clubhouse mezzanine, a world the view cuts to while
   ENGINE_VIS.setTrophy({on:true, items, engines}) is set. Metres; y up; the
   back wall at z = -3, open to the front like a dollhouse (side walls face in,
   so from outside they vanish). Shelves on the back wall hold the trophies,
   timing slips hang framed on the left wall, the medal board, goal
   certificates on the right, sponsor pennants along the top, retired engines
   on stands on the floor. Everything is procedural from a few cached shapes;
   medals are instanced. Drawn on demand: nothing renders while the camera
   sits still. Built on first use, rebuilt when the item list changes.
   ==========================================================================*/
var TROPHY={ on:false, built:false, scene:null, cam:null, root:null, dyn:null, key:"", engKey:"", pick:[], geo:{}, mat:{}, tex:[],
  orb:{th:0, ph:1.47, r:8.6, t:new THREE.Vector3(0,1.4,-1.2)}, home:{th:0, ph:1.47, r:8.6, t:new THREE.Vector3(0,1.4,-1.2)}, fly:null,
  dirty:2, onPick:null, snapCam:null, engQ:[], engines:{}, stats:null, w:0, h:0, sel:null, selMesh:null, lim:{shelf:48, slip:12, cert:13, pennant:9, stand:6} };
var TR_ROOM={ W:10, D:12, H:3.6, back:-3, front:9 };   /* the room runs forward past the camera: walls and ceiling all round */
var _trRay=new THREE.Raycaster(), _trNdc=new THREE.Vector2(), _trV=new THREE.Vector3(), _trM=new THREE.Matrix4(), _trQ=new THREE.Quaternion(), _trS=new THREE.Vector3();
function trMat(k){
  var M=TROPHY.mat; if(M[k]) return M[k];
  var std=function(c,r,m,o){ var x=new THREE.MeshStandardMaterial({color:sc(c), roughness:r, metalness:m||0}); if(o) for(var q in o) x[q]=o[q]; return x; };
  var defs={
    gold:function(){ return std(0xd9a93a,0.28,1,{envMapIntensity:1.1}); }, silver:function(){ return std(0xc9ced6,0.24,1,{envMapIntensity:1.1}); },
    bronze:function(){ return std(0xb06a34,0.34,1); }, chrome:function(){ return std(0xe2e6ea,0.14,1,{envMapIntensity:1.2}); },
    plinth:function(){ return std(0x16130f,0.55,0); }, wood:function(){ return std(0x6a4528,0.62,0); }, woodDk:function(){ return std(0x3b2617,0.7,0); },
    wall:function(){ return std(0x2c3b34,0.92,0); }, wallS:function(){ return std(0x34443c,0.92,0); }, steel:function(){ return std(0x50565c,0.5,0.8); },
    red:function(){ return std(0xb3281f,0.5,0.1); }, white:function(){ return std(0xf1efe6,0.7,0); }, paper:function(){ return std(0xefe9d8,0.85,0); },
    black:function(){ return std(0x111214,0.6,0.2); }, mud:function(){ return std(0x3a2a1a,0.95,0); }, rubber:function(){ return std(0x1a1a1c,0.85,0); },
    rock:function(){ return std(0x5d6670,0.8,0.1); }, snow:function(){ return std(0xf4f6f8,0.6,0); }, green:function(){ return std(0x3d7a3a,0.4,0.6); },
    blue:function(){ return std(0x1f4f9a,0.4,0.3); }, brass:function(){ return std(0xc59a4a,0.32,1); }, shadow:function(){ return new THREE.MeshBasicMaterial({color:0x000000, transparent:true, opacity:0.28, depthWrite:false}); }
  };
  M[k]=defs[k]?defs[k]():std(0x888888,0.5,0); M[k].userData.trophy=true; return M[k];
}
function trGeo(k, mk){ var G=TROPHY.geo; if(!G[k]) G[k]=mk(); return G[k]; }
function trSeg(){ return GFX==="lite"?12:GFX==="ultra"?32:20; }
function trLathe(pts, sy){ var v=pts.map(function(p){ return new THREE.Vector2(p[0], p[1]*(sy||1)); }); return new THREE.LatheGeometry(v, trSeg()); }
var TR_CUP=[[0,0.06],[0.05,0.06],[0.05,0.075],[0.022,0.09],[0.013,0.15],[0.02,0.175],[0.032,0.185],[0.068,0.215],[0.082,0.27],[0.086,0.33],[0.08,0.33],[0.074,0.28],[0.06,0.235],[0,0.225]];
function trMesh(g, m, x, y, z){ var o=new THREE.Mesh(g, m); o.position.set(x||0, y||0, z||0); return o; }
/* one trophy by shape; ~0.2 x 0.35 m, standing on its own plinth at the origin */
function trBuild(it){
  var g=new THREE.Group(), tier=it.tier||"gold", met=trMat(tier==="silver"?"silver":tier==="bronze"?"bronze":"gold");
  var shape=it.shape||"cup", big=shape==="title"?1.35:1;
  g.add(trMesh(trGeo("plinth", function(){ return new THREE.BoxGeometry(0.15,0.06,0.15); }), trMat("plinth"), 0, 0.03, 0));
  if(shape==="cup"||shape==="title"||shape==="tallcup"){
    var cup=new THREE.Group(), sy=shape==="tallcup"?1.3:1;
    cup.add(trMesh(trGeo("cup"+sy, function(){ return trLathe(TR_CUP, sy); }), met));
    var hg=trGeo("handle", function(){ return new THREE.TorusGeometry(0.04, 0.007, 6, 12, Math.PI); });
    for(var s=-1;s<=1;s+=2){ var h=trMesh(hg, met, s*0.085, 0.265*sy, 0); h.rotation.z=s>0?-Math.PI/2:Math.PI/2; cup.add(h); }
    if(shape==="tallcup"){ var ring=trMesh(trGeo("laurel", function(){ return new THREE.TorusGeometry(0.095, 0.009, 6, trSeg()+8); }), trMat("green"), 0, 0.3, 0); ring.rotation.x=Math.PI/2; cup.add(ring); }
    cup.scale.setScalar(big); g.add(cup);
  } else if(shape==="wrench"){
    var w=new THREE.Group(); w.position.y=0.07;
    w.add(trMesh(trGeo("wShaft", function(){ return new THREE.BoxGeometry(0.03,0.2,0.014); }), trMat("chrome"), 0, 0.1, 0));
    var hd=trMesh(trGeo("wHead", function(){ return new THREE.TorusGeometry(0.034, 0.013, 6, 14, Math.PI*1.45); }), trMat("chrome"), 0, 0.225, 0); hd.rotation.z=Math.PI*0.27+Math.PI/2*0; w.add(hd);
    var hb=trMesh(trGeo("wEye", function(){ return new THREE.TorusGeometry(0.022, 0.011, 6, 14); }), met, 0, -0.002, 0); w.add(hb);
    w.rotation.z=-0.18; g.add(w);
  } else if(shape==="salt"){
    var b=trMesh(trGeo("sBoard", function(){ return new THREE.BoxGeometry(0.2,0.25,0.025); }), trMat("wood"), 0, 0.2, 0); b.rotation.x=-0.12; g.add(b);
    var pl=trMesh(trGeo("sPlate", function(){ return new THREE.BoxGeometry(0.16,0.1,0.006); }), trMat("white"), 0, -0.04, 0.015); b.add(pl);
    var car=trMesh(trGeo("sCar", function(){ var q=new THREE.SphereGeometry(0.5, trSeg(), 8); q.scale(0.09,0.016,0.02); return q; }), trMat("red"), 0, 0.055, 0.02); b.add(car);
    var fin=trMesh(trGeo("sFin", function(){ return new THREE.BoxGeometry(0.012,0.026,0.004); }), trMat("red"), -0.038, 0.068, 0.02); b.add(fin);
    var bl=trMesh(trGeo("sLine", function(){ return new THREE.BoxGeometry(0.15,0.006,0.008); }), met, 0, 0.03, 0.016); b.add(bl);
  } else if(shape==="boot"){
    var bt=new THREE.Group(); bt.position.y=0.06;
    bt.add(trMesh(trGeo("bShaft", function(){ return new THREE.CylinderGeometry(0.036,0.04,0.16,trSeg()); }), met, 0, 0.13, 0));
    bt.add(trMesh(trGeo("bFoot", function(){ var q=new THREE.SphereGeometry(0.5, trSeg(), 8); q.scale(0.15,0.07,0.085); return q; }), met, 0.035, 0.035, 0));
    bt.add(trMesh(trGeo("bMud", function(){ var q=new THREE.SphereGeometry(0.5, 10, 6); q.scale(0.2,0.03,0.14); return q; }), trMat("mud"), 0.02, 0.008, 0));
    var rm=trMesh(trGeo("bRim", function(){ return new THREE.TorusGeometry(0.037,0.006,6,trSeg()); }), trMat("mud"), 0, 0.21, 0); rm.rotation.x=Math.PI/2; bt.add(rm);
    g.add(bt);
  } else if(shape==="wheel"){
    var wh=new THREE.Group(); wh.position.y=0.15;
    wh.add(trMesh(trGeo("tyre", function(){ return new THREE.TorusGeometry(0.068,0.024,8,trSeg()+4); }), trMat("rubber")));
    var rim=trMesh(trGeo("rim", function(){ return new THREE.CylinderGeometry(0.05,0.05,0.03,trSeg()); }), met); rim.rotation.x=Math.PI/2; wh.add(rim);
    g.add(trMesh(trGeo("post", function(){ return new THREE.CylinderGeometry(0.012,0.012,0.06,8); }), trMat("steel"), 0, 0.07, 0)); g.add(wh);
  } else if(shape==="peak"){
    g.add(trMesh(trGeo("pk", function(){ return new THREE.ConeGeometry(0.1,0.22,5); }), trMat("rock"), 0, 0.17, 0));
    g.add(trMesh(trGeo("pkSnow", function(){ return new THREE.ConeGeometry(0.042,0.09,5); }), trMat("snow"), 0, 0.237, 0));
    g.add(trMesh(trGeo("pkFlag", function(){ return new THREE.BoxGeometry(0.004,0.08,0.004); }), met, 0, 0.32, 0));
  } else if(shape==="prop"){
    var pr=new THREE.Group(); pr.position.set(0,0.2,0.0);
    pr.add(trMesh(trGeo("hub", function(){ return new THREE.SphereGeometry(0.024, 10, 8); }), met));
    var bg=trGeo("blade", function(){ var q=new THREE.SphereGeometry(0.5, 10, 6); q.scale(0.055,0.13,0.012); q.translate(0,0.07,0); return q; });
    for(var i=0;i<3;i++){ var bl2=trMesh(bg, met); bl2.rotation.z=i*Math.PI*2/3; bl2.rotation.y=0.35; pr.add(bl2); }
    g.add(trMesh(trGeo("ppost", function(){ return new THREE.CylinderGeometry(0.01,0.014,0.14,8); }), trMat("steel"), 0, 0.12, -0.01)); g.add(pr);
  } else if(shape==="gauge"){
    var gg=new THREE.Group(); gg.position.y=0.19;
    var face=trMesh(trGeo("gFace", function(){ return new THREE.CylinderGeometry(0.075,0.075,0.022,trSeg()+4); }), met); face.rotation.x=Math.PI/2; gg.add(face);
    var dial=trMesh(trGeo("gDial", function(){ return new THREE.CircleGeometry(0.064,trSeg()+4); }), trMat("white"), 0, 0, 0.0115); gg.add(dial);
    var nd=trMesh(trGeo("gNeedle", function(){ var q=new THREE.BoxGeometry(0.006,0.056,0.003); q.translate(0,0.024,0); return q; }), trMat("red"), 0, 0, 0.014); nd.rotation.z=-0.9; gg.add(nd);
    g.add(trMesh(trGeo("post", function(){ return new THREE.CylinderGeometry(0.012,0.012,0.06,8); }), trMat("steel"), 0, 0.09, 0)); g.add(gg);
  } else {   /* obelisk: an unknown event's win */
    var ob=trMesh(trGeo("obel", function(){ return new THREE.CylinderGeometry(0.022,0.045,0.26,4); }), met, 0, 0.19, 0); ob.rotation.y=Math.PI/4; g.add(ob);
  }
  return g;
}
/* canvas text panel: lines [[text, px, weight, color]] centred on paper */
function trCanvasTex(w, h, bg, lines, frame){
  var c=document.createElement("canvas"); c.width=w; c.height=h; var x=c.getContext("2d");
  x.fillStyle=bg; x.fillRect(0,0,w,h);
  if(frame){ x.strokeStyle=frame; x.lineWidth=Math.max(2,w/90); x.strokeRect(w*0.04,h*0.04,w*0.92,h*0.92); }
  x.textAlign="center"; x.textBaseline="middle";
  for(var i=0;i<lines.length;i++){ var L=lines[i]; if(!L||L[0]==null) continue; x.fillStyle=L[3]||"#2d2b36"; x.font=(L[2]||600)+" "+L[1]+"px 'Chakra Petch','Barlow Condensed','Arial Narrow',sans-serif";
    var s=String(L[0]); while(s.length>3&&x.measureText(s).width>w*0.88) s=s.slice(0,-2)+"…"; x.fillText(s, w/2, L[4]*h); }
  var t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=Math.min(4, MAXANISO||1); t.generateMipmaps=false; t.minFilter=THREE.LinearFilter;   /* odd sizes: no mipmaps, so WebGL1 never resizes them */
  TROPHY.tex.push(t); return t;
}
function trTexMat(t){ var m=new THREE.MeshStandardMaterial({map:t, roughness:0.85, metalness:0}); m.userData.trTex=true; return m; }
function trFloorTex(){
  var c=document.createElement("canvas"); c.width=256; c.height=256; var x=c.getContext("2d");
  for(var i=0;i<8;i++){ var l=34+((i*37)%17); x.fillStyle="hsl(26,32%,"+l+"%)"; x.fillRect(0,i*32,256,32); x.fillStyle="rgba(0,0,0,.35)"; x.fillRect(0,i*32,256,2); x.fillRect(((i*97)%200)+20,i*32,2,32); }
  for(i=0;i<900;i++){ x.fillStyle="rgba(0,0,0,"+(0.03+0.05*((i*13)%7)/7)+")"; x.fillRect((i*53)%256,(i*29)%256,1+((i*7)%9),1); }
  var t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(5,3); t.encoding=THREE.sRGBEncoding; t.anisotropy=Math.min(4, MAXANISO||1); TROPHY.tex.push(t); return t;
}
/* the fixed room: floor, walls, wainscot, shelves, medal board, sign, lights */
function trBuildScene(){
  var S5=new THREE.Scene(); S5.background=sc(0x14110e); S5.fog=new THREE.Fog(0x14110e, 14, 30); if(envMap) S5.environment=envMap;
  var cam=new THREE.PerspectiveCamera(46, 1, 0.05, 60);
  S5.add(new THREE.HemisphereLight(0xfff1dc, 0x2a2018, 0.62));
  var key=new THREE.DirectionalLight(0xffe2bc, 0.85); key.position.set(-3,6,8); S5.add(key); S5.add(key.target);
  var p1=new THREE.PointLight(0xffc98e, 0.9, 9, 2); p1.position.set(-2.4,3.2,-1.6); S5.add(p1);
  var p2=new THREE.PointLight(0xffc98e, 0.9, 9, 2); p2.position.set(2.4,3.2,-1.6); S5.add(p2);
  TROPHY.lights=[key];   /* Ultra: the key casts shadows (ultraTrophy) */
  var p3=new THREE.PointLight(0xfff0dc, 0.55, 9, 2); p3.position.set(0,3.0,1.6); S5.add(p3);
  var R=TR_ROOM, W=R.W, D=R.D, H=R.H, zc=(R.back+R.front)/2, fixed=new THREE.Group(); S5.add(fixed);
  var ft=trFloorTex(); ft.repeat.set(5,6);
  var floor=new THREE.Mesh(new THREE.PlaneGeometry(W,D), new THREE.MeshStandardMaterial({map:ft, roughness:0.7, metalness:0})); floor.rotation.x=-Math.PI/2; floor.position.z=zc; fixed.add(floor);
  var back=new THREE.Mesh(new THREE.PlaneGeometry(W,H), trMat("wall")); back.position.set(0,H/2,R.back); fixed.add(back);
  var fw=new THREE.Mesh(new THREE.PlaneGeometry(W,H), trMat("wallS")); fw.position.set(0,H/2,R.front); fw.rotation.y=Math.PI; fixed.add(fw);
  var lw=new THREE.Mesh(new THREE.PlaneGeometry(D,H), trMat("wallS")); lw.position.set(-W/2,H/2,zc); lw.rotation.y=Math.PI/2; fixed.add(lw);
  var rw=new THREE.Mesh(new THREE.PlaneGeometry(D,H), trMat("wallS")); rw.position.set(W/2,H/2,zc); rw.rotation.y=-Math.PI/2; fixed.add(rw);
  /* the ceiling: boards and three beams across */
  var ceil=new THREE.Mesh(new THREE.PlaneGeometry(W,D), trMat("woodDk")); ceil.rotation.x=Math.PI/2; ceil.position.set(0,H,zc); fixed.add(ceil);
  var bmG=new THREE.BoxGeometry(W,0.22,0.24); for(var bz=-1.2; bz<R.front; bz+=3.2){ var beam=new THREE.Mesh(bmG, trMat("wood")); beam.position.set(0,H-0.11,bz); fixed.add(beam); }
  /* wainscot and a chair rail on the three walls */
  var wb=new THREE.Mesh(new THREE.BoxGeometry(W,0.9,0.04), trMat("woodDk")); wb.position.set(0,0.45,R.back+0.02); fixed.add(wb);
  var wl=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.9,D), trMat("woodDk")); wl.position.set(-W/2+0.02,0.45,zc); fixed.add(wl);
  var wr=wl.clone(); wr.position.x=W/2-0.02; fixed.add(wr);
  var cr=new THREE.Mesh(new THREE.BoxGeometry(W,0.05,0.07), trMat("wood")); cr.position.set(0,0.92,R.back+0.035); fixed.add(cr);
  /* shelves: three planks on brackets across the back wall, a long low cabinet under them */
  var sg=new THREE.BoxGeometry(8.4,0.04,0.34), bg=new THREE.BoxGeometry(0.03,0.16,0.3);
  TROPHY.shelfY=[1.52,2.12,0.98];
  for(var s=0;s<3;s++){ var y=TROPHY.shelfY[s], sh=new THREE.Mesh(sg, trMat("wood")); sh.position.set(0,y-0.02,R.back+0.17); fixed.add(sh);
    for(var b=-4;b<=4;b+=2){ var br=new THREE.Mesh(bg, trMat("steel")); br.position.set(b*1.02,y-0.12,R.back+0.15); fixed.add(br); } }
  /* the shop sign over the shelves */
  var sign=new THREE.Mesh(new THREE.PlaneGeometry(5,0.5), trTexMat(trCanvasTex(1280,128,"#1b1611",[["PRAIRIE ENGINE WORKS · TROPHY ROOM",50,700,"#e8c27a",0.53]],"#8a6a3a")));
  sign.position.set(0,2.92,R.back+0.01); fixed.add(sign);
  /* medal board on the right wall */
  var mb=new THREE.Mesh(new THREE.BoxGeometry(0.05,1.2,2.5), trMat("woodDk")); mb.position.set(W/2-0.03,1.95,-0.6); fixed.add(mb);
  var mbl=new THREE.Mesh(new THREE.PlaneGeometry(1.9,0.22), trTexMat(trCanvasTex(512,60,"#2a1d12",[["ACHIEVEMENTS",34,700,"#e8c27a",0.55]])));
  mbl.position.set(W/2-0.061,2.67,-0.6); mbl.rotation.y=-Math.PI/2; fixed.add(mbl);
  /* pendant lamps: a cone shade and a glowing bulb each */
  var shade=new THREE.ConeGeometry(0.22,0.22,trSeg(),1,true), bulb=new THREE.SphereGeometry(0.06,10,8), bm=new THREE.MeshBasicMaterial({color:0xffe2b0});
  [[-2.4,-1.6],[2.4,-1.6],[0,1.6]].forEach(function(p){ var c=new THREE.Mesh(shade, trMat("black")); c.material.side=THREE.DoubleSide; c.position.set(p[0],3.34,p[1]); fixed.add(c);
    var bu=new THREE.Mesh(bulb, bm); bu.position.set(p[0],3.22,p[1]); fixed.add(bu);
    var cord=new THREE.Mesh(trGeo("cord", function(){ return new THREE.CylinderGeometry(0.008,0.008,0.4,4); }), trMat("black")); cord.position.set(p[0],3.49,p[1]); cord.scale.y=0.55; fixed.add(cord); });
  /* a rug under the stands */
  var rug=new THREE.Mesh(new THREE.PlaneGeometry(8.4,2.2), new THREE.MeshStandardMaterial({color:sc(0x5a1f1a), roughness:1})); rug.rotation.x=-Math.PI/2; rug.position.set(0,0.004,1.25); fixed.add(rug);
  TROPHY.scene=S5; TROPHY.cam=cam; TROPHY.dyn=new THREE.Group(); S5.add(TROPHY.dyn); TROPHY.built=true;
}
function trClearDyn(){
  var d=TROPHY.dyn; if(!d) return;
  for(var i=d.children.length-1;i>=0;i--){ var c=d.children[i]; trDispose(c); d.remove(c); }
  TROPHY.pick=[]; TROPHY.engines={}; TROPHY.engQ=[]; TROPHY.selMesh=null;
}
function trDispose(o){
  var eng=[]; o.traverse(function(c){ if(c.userData && c.userData.engine) eng.push(c); });
  eng.forEach(function(c){ disposeTree(c); });
  o.traverse(function(c){
    if(c.isInstancedMesh && c.dispose) c.dispose();
    if(c.material && c.material.userData && c.material.userData.trTex){ if(c.material.map){ c.material.map.dispose(); var k=TROPHY.tex.indexOf(c.material.map); if(k>=0) TROPHY.tex.splice(k,1); } c.material.dispose(); }
    if(c.geometry && c.userData && c.userData.ownGeo) c.geometry.dispose();
  });
}
function trTag(o, id){ o.userData.tid=id; TROPHY.pick.push(o); return o; }
/* the movable part: everything that depends on the player's history */
function trLayout(items, engines){
  trClearDyn(); var D=TROPHY.dyn, R=TR_ROOM, L=TROPHY.lim, i;
  var by={shelf:[], slip:[], medal:[], cert:[], pennant:[]};
  for(i=0;i<items.length;i++){ var it=items[i]; (by[it.slot]||by.shelf).push(it); }
  /* shelves: eye level first, centred; then the top shelf; then the bottom */
  var sh=by.shelf.slice(0, L.shelf), per=sh.length<=8?8:Math.ceil(sh.length/3), rows=[sh.slice(0,per), sh.slice(per,2*per), sh.slice(2*per,3*per)];
  rows.forEach(function(row, ri){ var y=TROPHY.shelfY[ri], n=row.length, gap=Math.min(0.5, 8/Math.max(1,n));
    row.forEach(function(it, k){ var g=trBuild(it); g.position.set((k-(n-1)/2)*gap, y, R.back+0.18+(k%2?0.03:-0.02)); g.rotation.y=(k%3-1)*0.12; D.add(trTag(g, it.id)); }); });
  if(!sh.length){   /* the empty shelf: a little card leaning on it */
    var em=new THREE.Mesh(new THREE.PlaneGeometry(1.1,0.44), trTexMat(trCanvasTex(512,205,"#efe9d8",[["Empty shelf",62,700,"#2d2b36",0.36],["go win something",44,600,"#8a5a1a",0.72]],"#8a6a3a")));
    em.position.set(0,TROPHY.shelfY[0]+0.22,R.back+0.1); em.rotation.x=-0.16; em.userData.ownGeo=true; D.add(em); }
  /* timing slips, framed, on the left wall */
  var fg=trGeo("slipFrame", function(){ return new THREE.BoxGeometry(0.03,0.62,0.44); });
  by.slip.slice(0, L.slip).forEach(function(it, k){ var col=k%4, row=Math.floor(k/4), z=-2.25+col*1.15, y=2.55-row*0.78;
    var g=new THREE.Group(); g.position.set(-R.W/2+0.02, y, z);
    g.add(trMesh(fg, trMat("black"), 0.015, 0, 0));
    var tl=it.lines||[], tex=trCanvasTex(256,360,"#f4f1e6",[[tl[0],22,700,"#6b6772",0.12],[tl[1],50,700,"#2d2b36",0.36],[tl[2],24,600,"#2d2b36",0.54],[tl[3],20,500,"#6b6772",0.68],[tl[4],18,500,"#6b6772",0.84]],"#c9c2ad");
    var p=new THREE.Mesh(new THREE.PlaneGeometry(0.38,0.54), trTexMat(tex)); p.position.x=0.032; p.rotation.y=Math.PI/2; p.userData.ownGeo=true; g.add(p);
    D.add(trTag(g, it.id)); });
  /* medals: instanced by tier on the board */
  var md=by.medal, tiers=["gold","silver","bronze"], mg=trGeo("medal", function(){ var q=new THREE.CylinderGeometry(0.05,0.05,0.008,trSeg()+4); q.rotateZ(Math.PI/2); return q; }),
    rg=trGeo("ribbon", function(){ return new THREE.BoxGeometry(0.004,0.07,0.04); });
  var cols=11, pos=function(k){ var c=k%cols, r=Math.floor(k/cols); return [R.W/2-0.06, 2.42-r*0.16, -0.6-1.05+c*0.21]; };
  tiers.forEach(function(t){ var L2=[]; md.forEach(function(it, k){ if((it.tier||"bronze")===t) L2.push([it,k]); }); if(!L2.length) return;
    var im=new THREE.InstancedMesh(mg, trMat(t), L2.length), ri=new THREE.InstancedMesh(rg, trMat(t==="gold"?"red":t==="silver"?"blue":"green"), L2.length);
    L2.forEach(function(e, j){ var p=pos(e[1]); _trM.makeTranslation(p[0]-0.006,p[1],p[2]); im.setMatrixAt(j,_trM); _trM.makeTranslation(p[0]-0.003,p[1]+0.06,p[2]); ri.setMatrixAt(j,_trM); });
    im.userData.tids=L2.map(function(e){ return e[0].id; }); D.add(im); D.add(ri); TROPHY.pick.push(im); });
  /* goal certificates under the medal board */
  var cf=trGeo("certFrame", function(){ return new THREE.BoxGeometry(0.025,0.26,0.34); }), cp=trGeo("certPaper", function(){ var q=new THREE.PlaneGeometry(0.29,0.21); q.rotateY(-Math.PI/2); return q; }),
    seal=trGeo("seal", function(){ var q=new THREE.CircleGeometry(0.03,12); q.rotateY(-Math.PI/2); return q; });
  by.cert.slice(0, L.cert).forEach(function(it, k){ var c=k%7, r=Math.floor(k/7), g=new THREE.Group(); g.position.set(R.W/2-0.02, 1.15-r*0.32, -2.3+c*0.4+(r?0.2:0));
    g.add(trMesh(cf, trMat("woodDk"))); g.add(trMesh(cp, trMat("paper"), -0.014, 0, 0)); g.add(trMesh(seal, trMat("red"), -0.016, -0.05, 0.09)); D.add(trTag(g, it.id)); });
  /* sponsor pennants along the top of the back wall */
  var pg=trGeo("pennant", function(){ var s=new THREE.Shape(); s.moveTo(-0.32,0); s.lineTo(0.32,0); s.lineTo(0,-0.42); s.closePath(); return new THREE.ShapeGeometry(s); });
  var pn=by.pennant.slice(0, L.pennant), np=pn.length;
  pn.forEach(function(it, k){ var x=(k-(np-1)/2)*0.85, g=new THREE.Group(); g.position.set(x, 3.38, R.back+0.02);
    var m=new THREE.MeshStandardMaterial({color:sc(it.col||0x8c1d18), roughness:0.8, side:THREE.DoubleSide}); m.userData.trTex=true;
    var m2=new THREE.MeshStandardMaterial({color:sc(it.col2||0xf2d04a), roughness:0.8, side:THREE.DoubleSide}); m2.userData.trTex=true;
    g.add(new THREE.Mesh(pg, m)); var st=new THREE.Mesh(pg, m2); st.scale.set(0.45,0.45,1); st.position.set(0,-0.05,0.004); g.add(st); D.add(trTag(g, it.id)); });
  if(np){ var rope=new THREE.Mesh(new THREE.BoxGeometry(Math.max(1,np*0.85),0.012,0.012), trMat("black")); rope.position.set(0,3.39,R.back+0.02); rope.userData.ownGeo=true; D.add(rope); }
  /* engine stands on the rug: the engine is queued and built a frame at a time */
  var es=engines.slice(0, L.stand), ne=es.length, sp=Math.min(1.45, 7.8/Math.max(1,ne));
  es.forEach(function(e, k){ var x=(k-(ne-1)/2)*sp, g=new THREE.Group(); g.position.set(x, 0, 1.25);
    g.add(trStand());
    var plate=new THREE.Mesh(new THREE.PlaneGeometry(0.62,0.24), trTexMat(trCanvasTex(384,150,"#c59a4a",[[e.name,34,700,"#2a1d12",0.36],[e.sub,23,600,"#3b2a16",0.7]],"#7a5a28")));
    plate.position.set(0,0.27,0.356); plate.userData.ownGeo=true; g.add(plate);
    var shd=new THREE.Mesh(trGeo("shad", function(){ var q=new THREE.PlaneGeometry(1.25,0.95); q.rotateX(-Math.PI/2); return q; }), trMat("shadow")); shd.position.y=0.008; g.add(shd);
    D.add(trTag(g, e.id)); TROPHY.engQ.push({g:g, e:e}); });
}
function trStand(){   /* a display plinth: dark box, brass trim, two red cradle rails the engine sits on */
  var g=new THREE.Group();
  g.add(trMesh(trGeo("plinth2", function(){ return new THREE.BoxGeometry(1.08,0.5,0.7); }), trMat("woodDk"), 0, 0.25, 0));
  g.add(trMesh(trGeo("plTrim", function(){ return new THREE.BoxGeometry(1.12,0.03,0.74); }), trMat("brass"), 0, 0.505, 0));
  g.add(trMesh(trGeo("plFoot", function(){ return new THREE.BoxGeometry(1.14,0.05,0.76); }), trMat("black"), 0, 0.025, 0));
  var rail=trGeo("plRail", function(){ return new THREE.BoxGeometry(0.07,0.06,0.56); });
  g.add(trMesh(rail, trMat("red"), -0.26, 0.55, 0)); g.add(trMesh(rail, trMat("red"), 0.26, 0.55, 0));
  return g;
}
/* build one queued engine with the shop's own builder, at Lite detail, without disturbing the engine on the main stand */
function trEngineStep(){
  var q=TROPHY.engQ.shift(); if(!q) return false;
  var keep={anim:anim, det:DET, gfx:GFX, hw:HW, cb:CUR_B, dc:DCTX, zm:ZONE_MARKS, ze:ZONE_EXTRAS, z:ZONE};
  var G=null;
  try{ anim={ spin:[], turbos:[], belts:[], hot:[], fans:[], glowMats:[], internals:null }; GFX="lite"; G=buildEngineMesh(q.e.cfg, q.e.layout); }catch(err){ G=null; }
  anim=keep.anim; GFX=keep.gfx; DET=keep.det; HW=keep.hw; CUR_B=keep.cb; DCTX=keep.dc; ZONE_MARKS=keep.zm; ZONE_EXTRAS=keep.ze; ZONE=keep.z;
  if(!G) return true;
  var holder=new THREE.Group(); holder.userData.engine=true; holder.add(G);
  var bb=new THREE.Box3().setFromObject(G), sz=bb.getSize(_trV), mx=Math.max(sz.x,sz.y,sz.z)||1, k=Math.min(0.1, 0.95/mx), c=bb.getCenter(new THREE.Vector3());
  G.position.set(-c.x, -bb.min.y, -c.z);   /* sit it centred on the stand head, its sump on the cradle */
  holder.scale.setScalar(k); holder.position.set(0, 0.575, 0); holder.rotation.y=-0.5;
  if(GFX==="lite") holder.traverse(function(o){ o.castShadow=false; o.receiveShadow=false; });
  q.g.add(holder); TROPHY.dirty=2; return true;
}
/* camera: a dollhouse orbit with limits, pinch / wheel zoom, two-finger or right-drag pan, tap to pick */
function trCamApply(){
  var o=TROPHY.orb, cam=TROPHY.cam; if(!cam) return;
  cam.position.set(o.t.x+o.r*Math.sin(o.ph)*Math.sin(o.th), o.t.y+o.r*Math.cos(o.ph), o.t.z+o.r*Math.sin(o.ph)*Math.cos(o.th));
  var R=TR_ROOM; cam.position.set(clamp(cam.position.x,-R.W/2+0.25,R.W/2-0.25), clamp(cam.position.y,0.25,R.H-0.3), clamp(cam.position.z,R.back+0.3,R.front-0.3));   /* never through a wall */
  cam.lookAt(o.t);
}
function trClampOrb(){ var o=TROPHY.orb; o.th=clamp(o.th,-1.35,1.35); o.ph=clamp(o.ph,1.0,1.75); o.r=clamp(o.r,0.7,10.5); o.t.x=clamp(o.t.x,-4.6,4.6); o.t.y=clamp(o.t.y,0.4,3.2); o.t.z=clamp(o.t.z,-2.7,2.6); }
var trInput=null;
function trSetupInput(){
  if(trInput||!canvasEl) return; var P={}, n=0, last=null, down=null, pan=false;
  trInput=true;
  var pt=function(e){ return {x:e.clientX, y:e.clientY}; };
  canvasEl.addEventListener("pointerdown", function(e){ if(!TROPHY.on) return; if(!P[e.pointerId]) n++; P[e.pointerId]=pt(e); TROPHY.fly=null;
    pan=e.pointerType==="mouse"&&(e.button===1||e.button===2||e.shiftKey); down=n===1?{x:e.clientX,y:e.clientY,t:performance.now()}:null; last=null; });
  canvasEl.addEventListener("pointermove", function(e){ if(!TROPHY.on) return; var p=P[e.pointerId]; if(!p) return; var np=pt(e), o=TROPHY.orb, h=canvasEl.clientHeight||600;
    var panBy=function(dx,dy){ var k=2*o.r*Math.tan(TROPHY.cam.fov*Math.PI/360)/h; o.t.x-=dx*k*Math.cos(o.th); o.t.z+=dx*k*Math.sin(o.th); o.t.y+=dy*k; };
    if(n===1&&pan) panBy(np.x-p.x, np.y-p.y);
    else if(n===1){ o.th-=(np.x-p.x)*0.0065; o.ph=o.ph-(np.y-p.y)*0.005; }
    else if(n>=2){ var ids=Object.keys(P), a=P[ids[0]], b=P[ids[1]], q={x:(a.x+b.x)/2, y:(a.y+b.y)/2, d:Math.hypot(a.x-b.x,a.y-b.y)};
      P[e.pointerId]=np; a=P[ids[0]]; b=P[ids[1]]; var q2={x:(a.x+b.x)/2, y:(a.y+b.y)/2, d:Math.hypot(a.x-b.x,a.y-b.y)};
      if(q.d>0&&q2.d>0) o.r*=q.d/q2.d; panBy(q2.x-q.x, q2.y-q.y); }
    P[e.pointerId]=np; trClampOrb(); TROPHY.dirty=1; });
  var up=function(e){ if(!P[e.pointerId]) return; delete P[e.pointerId]; n=Math.max(0,n-1);
    if(TROPHY.on && down && e.type==="pointerup" && Math.hypot(e.clientX-down.x,e.clientY-down.y)<10 && performance.now()-down.t<700){ var id=trPickAt(e.clientX,e.clientY); if(TROPHY.onPick) TROPHY.onPick(id); }
    if(!n) down=null; };
  canvasEl.addEventListener("pointerup", up); canvasEl.addEventListener("pointercancel", up); canvasEl.addEventListener("pointerleave", up);
  canvasEl.addEventListener("wheel", function(e){ if(!TROPHY.on) return; TROPHY.fly=null; TROPHY.orb.r*=1+e.deltaY*0.0012; trClampOrb(); TROPHY.dirty=1; }, {passive:true});
}
function trPickAt(px, py){
  if(!TROPHY.cam) return null; var r=canvasEl.getBoundingClientRect();
  _trNdc.set(((px-r.left)/r.width)*2-1, -((py-r.top)/r.height)*2+1); _trRay.setFromCamera(_trNdc, TROPHY.cam);
  var hits=_trRay.intersectObjects(TROPHY.pick, true);
  for(var i=0;i<hits.length;i++){ var o=hits[i].object;
    if(o.isInstancedMesh && o.userData.tids && hits[i].instanceId!=null) return o.userData.tids[hits[i].instanceId];
    while(o && o.userData.tid==null) o=o.parent; if(o) return o.userData.tid; }
  return null;
}
/* where to stand to look at an item: square on to its wall, a little back */
function trHome(){ var a=TROPHY.cam?TROPHY.cam.aspect:1; return {t:new THREE.Vector3(0,1.3,-1.2), th:0, ph:1.4, r:a<0.8?7.6:8.6}; }
function trFocusOf(id){
  var o=null, D=TROPHY.dyn; if(!D) return null;
  for(var i=0;i<TROPHY.pick.length;i++){ var p=TROPHY.pick[i]; if(p.userData.tid===id){ o=p; break; } if(p.userData.tids){ var k=p.userData.tids.indexOf(id); if(k>=0){ p.getMatrixAt(k,_trM); var w=new THREE.Vector3().setFromMatrixPosition(_trM); p.localToWorld(w); return {t:w, th:1.2, r:1.1, ph:1.45}; } } }
  if(!o) return null; var b=new THREE.Box3().setFromObject(o), c=b.getCenter(new THREE.Vector3()), pt=TROPHY.cam&&TROPHY.cam.aspect<0.8, k=pt?1.45:1, dy=pt?-0.16:0;
  if(c.x<-TR_ROOM.W/2+0.3) return {t:c.setY(c.y+dy), th:-1.2, r:1.25*k, ph:1.5};
  if(c.x>TR_ROOM.W/2-0.3) return {t:c.setY(c.y+dy), th:1.2, r:1.1*k, ph:1.45};
  if(c.z>0) return {t:c.setY(Math.max(0.5,c.y)+dy*2), th:0.3, r:2.6*k, ph:1.25};
  return {t:c.setY(c.y+dy), th:clamp(c.x*0.05,-0.3,0.3), r:(c.y>3?2.4:1.15)*k, ph:c.y>3?1.5:1.42};
}
function trFlyStep(dt){
  var f=TROPHY.fly; if(!f) return; var o=TROPHY.orb, k=1-Math.exp(-dt*5);
  o.t.lerp(f.t, k); o.th+=(f.th-o.th)*k; o.ph+=(f.ph-o.ph)*k; o.r+=(f.r-o.r)*k; TROPHY.dirty=1;
  if(o.t.distanceTo(f.t)<0.005&&Math.abs(f.r-o.r)<0.005&&Math.abs(f.th-o.th)<0.003) TROPHY.fly=null;
}
var trLastT=0;
function trophyFrame(now){
  var dt=trLastT?Math.min(0.05,(now-trLastT)/1000):0.016; trLastT=now;
  trFlyStep(dt);
  if(TROPHY.engQ.length){ trEngineStep(); }
  var w=canvasEl.clientWidth, h=canvasEl.clientHeight;
  if(w!==TROPHY.w||h!==TROPHY.h){ TROPHY.w=w; TROPHY.h=h; TROPHY.dirty=2; }
  if(!TROPHY.dirty) return;
  TROPHY.dirty=Math.max(0,TROPHY.dirty-1);
  trRender();
}
function trRender(){
  var cam=TROPHY.cam; if(!cam||!renderer) return;
  var sz=renderer.getSize(new THREE.Vector2()); cam.aspect=sz.x/Math.max(1,sz.y);
  cam.fov=cam.aspect<0.8?58:46; cam.updateProjectionMatrix(); trCamApply();
  var ex=renderer.toneMappingExposure; renderer.toneMappingExposure=1.05;
  var inf=renderer.info, ar=inf.autoReset; inf.autoReset=false; inf.reset();
  var AO=ultraTrophy(cam); if(AO) AO.render(); else renderer.render(TROPHY.scene, cam);
  TROPHY.stats={calls:inf.render.calls, tris:inf.render.triangles, items:TROPHY.pick.length, engQ:TROPHY.engQ.length}; inf.autoReset=ar;
  renderer.toneMappingExposure=ex;
}
ENGINE_VIS.setTrophy=function(o){
  if(!renderer) return false;
  if(!o||o.on===false){ if(TROPHY.on){ TROPHY.on=false; trLastT=0; TROPHY.fly=null; if(TROPHY.snapCam){ var s=TROPHY.snapCam; camState.theta=s.th; camState.phi=s.ph; camState.r=s.r; camState.target.copy(s.t); TROPHY.snapCam=null; } ENGINE_VIS.resize(); } return true; }
  if(!TROPHY.built) trBuildScene();
  trSetupInput();
  if(!TROPHY.on){ TROPHY.on=true; TROPHY.snapCam={th:camState.theta, ph:camState.phi, r:camState.r, t:camState.target.clone()}; if(canvasEl.clientHeight) TROPHY.cam.aspect=canvasEl.clientWidth/canvasEl.clientHeight; var hm=TROPHY.home=trHome(); TROPHY.orb.th=hm.th; TROPHY.orb.ph=hm.ph; TROPHY.orb.r=hm.r; TROPHY.orb.t.copy(hm.t); }
  if(o.onPick) TROPHY.onPick=o.onPick;
  if(o.items){ var key=o.key||JSON.stringify(o.items.map(function(x){ return x.id; }))+"|"+(o.engines||[]).map(function(e){ return e.id; }).join(","); if(key!==TROPHY.key){ TROPHY.key=key; trLayout(o.items, o.engines||[]); } }
  TROPHY.dirty=2; return true;
};
ENGINE_VIS.trophyFocus=function(id){ if(!TROPHY.on) return; if(id==null){ var hm=TROPHY.home=trHome(); TROPHY.fly={t:hm.t.clone(), th:hm.th, ph:hm.ph, r:hm.r}; return; } var f=trFocusOf(id); if(f) TROPHY.fly=f; };
ENGINE_VIS.trophyShot=function(){   /* a copy of the room as it stands, for the share card */
  if(!TROPHY.on||!renderer) return null; trRender(); var c=document.createElement("canvas"); c.width=canvasEl.width; c.height=canvasEl.height;
  try{ c.getContext("2d").drawImage(canvasEl,0,0); }catch(e){ return null; } return c; };
ENGINE_VIS.trophyPickAt=function(x,y){ return TROPHY.on?trPickAt(x,y):null; };
ENGINE_VIS.trophyState=function(){ return {on:TROPHY.on, built:TROPHY.built, pick:TROPHY.pick.length, engQ:TROPHY.engQ.length, stats:TROPHY.stats, orb:{th:+TROPHY.orb.th.toFixed(2), ph:+TROPHY.orb.ph.toFixed(2), r:+TROPHY.orb.r.toFixed(2)}, fly:!!TROPHY.fly}; };
ENGINE_VIS.trophyProject=function(id){   /* screen point of an item (tests, and the card's pointer) */
  if(!TROPHY.on||!TROPHY.cam) return null; var f=null; for(var i=0;i<TROPHY.pick.length;i++) if(TROPHY.pick[i].userData.tid===id){ f=TROPHY.pick[i]; break; } if(!f) return null;
  var c=new THREE.Box3().setFromObject(f).getCenter(new THREE.Vector3()); trCamApply(); c.project(TROPHY.cam); var r=canvasEl.getBoundingClientRect(); return {x:r.left+(c.x+1)/2*r.width, y:r.top+(1-c.y)/2*r.height}; };
(function(){ var z0=ENGINE_VIS.zoneAt; ENGINE_VIS.zoneAt=function(x,y){ return TROPHY.on?0:z0(x,y); }; })();   /* no part sheets from a tap in the trophy room */
