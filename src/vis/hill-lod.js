/* ===========================================================================
   PIKES PEAK, LITE AND ULTRA: CULLING AND LOD
   The course is 20 km of road on an 11 × 7 km mountain, and Full draws it as a
   handful of whole-map meshes (one terrain grid, one road ribbon, one verge
   strip, one instanced forest), so every frame draws and shadows all of it.
   On Lite and Ultra the same geometry is cut into pieces the camera can cull:
   terrain tiles, road / verge / rail runs along the course, trees and rocks in
   ground cells. Lite also drops what is too far to see (road runs past
   1.6 km, trees past 1.1 km, rocks past 0.9 km, all inside the haze). Ultra
   keeps everything, adds a near-tree LOD (three-tier fir with a trunk inside
   450 m, the plain two-cone fir beyond), and only the cells in the sun's
   shadow box cast shadows. Full never calls any of this.
   ==========================================================================*/
var HILL_LOD={ lite:{chunks:20, tile:37, cell:1500, road:1600, tree:1100, rock:900}, ultra:{chunks:40, tile:35, cell:850, road:0, tree:0, rock:0, near:450} };
var _hlA=new THREE.Vector3();
function hillLodCfg(){ return GFX==="ultra"?HILL_LOD.ultra:HILL_LOD.lite; }
/* a bounding sphere round the vertices an index list uses */
function hillIdxSphere(P, idx){
  var x0=1e9,y0=1e9,z0=1e9,x1=-1e9,y1=-1e9,z1=-1e9, i, v;
  for(i=0;i<idx.length;i++){ v=idx[i]*3; var x=P[v], y=P[v+1], z=P[v+2]; if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; if(z<z0)z0=z; if(z>z1)z1=z; }
  var c=new THREE.Vector3((x0+x1)/2,(y0+y1)/2,(z0+z1)/2), r=0;
  for(i=0;i<idx.length;i++){ v=idx[i]*3; var dx=P[v]-c.x, dy=P[v+1]-c.y, dz=P[v+2]-c.z, d=dx*dx+dy*dy+dz*dz; if(d>r) r=d; }
  return new THREE.Sphere(c, Math.sqrt(r));
}
function hillPiece(S, src, idx, kind, W){
  var g=src.geometry, gg=new THREE.BufferGeometry();
  for(var k in g.attributes) gg.setAttribute(k, g.attributes[k]);
  gg.setIndex(new THREE.BufferAttribute(idx, 1)); gg.boundingSphere=hillIdxSphere(g.attributes.position.array, idx);
  var m=new THREE.Mesh(gg, src.material); m.castShadow=src.castShadow; m.receiveShadow=src.receiveShadow; m.renderOrder=src.renderOrder;
  S.add(m); W.lod.pieces.push({m:m, kind:kind}); return m;
}
function hillLodInit(W){ if(!W.lod) W.lod={pieces:[], cells:[], cfg:hillLodCfg()}; return W.lod; }
/* road, verges, rails: the triangles run along the course, so consecutive index runs are runs of road */
function hillSplit(W, S, mesh, kind){
  var L=hillLodInit(W), g=mesh.geometry; if(!g.index) return;
  var I=g.index.array, n=I.length/3, per=Math.max(64, Math.ceil(n/L.cfg.chunks))*3;
  for(var a=0;a<I.length;a+=per) hillPiece(S, mesh, I.slice(a, Math.min(I.length, a+per)), kind, W);
  S.remove(mesh);
}
/* the terrain grid in square tiles */
function hillTiles(W, S, tm, G){
  var L=hillLodInit(W), R=G+1, t=L.cfg.tile, Arr=(R*R>65535)?Uint32Array:Uint16Array;
  for(var ty=0;ty<G;ty+=t) for(var tx=0;tx<G;tx+=t){ var ny=Math.min(t,G-ty), nx=Math.min(t,G-tx), idx=new Arr(nx*ny*6), o=0;
    for(var yy=ty;yy<ty+ny;yy++) for(var xx=tx;xx<tx+nx;xx++){ var a=yy*R+xx, b=a+1, c=a+R, d=c+1; idx[o++]=a; idx[o++]=b; idx[o++]=c; idx[o++]=b; idx[o++]=d; idx[o++]=c; }
    hillPiece(S, tm, idx, "terr", W); }
  S.remove(tm); W.terr=null;
}
/* trees and rocks into ground cells; Ultra: a detailed near LOD */
function hillUltraFir(){
  var parts=[], c1=new THREE.ConeGeometry(2.3,5.0,10); c1.translate(0,5.2,0); parts.push(c1);
  var c2=new THREE.ConeGeometry(1.75,4.2,10); c2.translate(0,7.6,0); parts.push(c2);
  var c3=new THREE.ConeGeometry(1.15,3.4,9); c3.translate(0,10.0,0); parts.push(c3);
  parts.forEach(function(g, j){ var P=g.attributes.position; for(var q=0;q<P.count;q++){ var x=P.getX(q), z=P.getZ(q), y=P.getY(q), r=Math.hypot(x,z);   /* ragged, drooping bough tips */
    if(r>0.3){ var a=Math.atan2(z,x), k=0.86+0.22*Math.abs(Math.sin(a*5+j*1.7)); P.setXYZ(q, x*k, y-0.35*(k-0.86)*3, z*k); } } g.computeVertexNormals(); });
  return mergeHillGeos(parts);
}
function hillCellGeo(base, sph){ var g=new THREE.BufferGeometry(); for(var k in base.attributes) g.setAttribute(k, base.attributes[k]); if(base.index) g.setIndex(base.index); g.boundingSphere=sph; return g; }
function hillTreeCells(W, S, tp, rp, foliage, trunk, rocks, ultra){
  var L=hillLodInit(W), cs=L.cfg.cell, bx=W.box, x0=bx[0]-W.ox, z1=-(bx[1]-W.oy), nx=Math.ceil((bx[2]-bx[0])/cs), ny=Math.ceil((bx[3]-bx[1])/cs);
  var hiF=ultra?hillUltraFir():null, hiT=null; if(ultra){ hiT=new THREE.CylinderGeometry(0.2,0.32,4.2,6); hiT.translate(0,2.1,0); }
  var bin=function(list){ var B={}; list.forEach(function(p, j){ var cx=Math.floor((p[0]-x0)/cs), cz=Math.floor((z1-p[2])/cs); cx=clamp(cx,0,nx-1); cz=clamp(cz,0,ny-1); var k=cz*nx+cx; (B[k]||(B[k]=[])).push(j); }); return B; };
  var mm=new THREE.Matrix4(), cc=new THREE.Color();
  var cellMesh=function(src, base, ids, sph, cast){ var m=new THREE.InstancedMesh(hillCellGeo(base, sph), src.material, ids.length);
    ids.forEach(function(j, q){ src.getMatrixAt(j, mm); m.setMatrixAt(q, mm); if(src.instanceColor){ src.getColorAt(j, cc); m.setColorAt(q, cc); } });
    m.castShadow=cast; m.receiveShadow=src.receiveShadow; S.add(m); return m; };
  var sphOf=function(list, ids, up){ var a=new THREE.Vector3(1e9,1e9,1e9), b=new THREE.Vector3(-1e9,-1e9,-1e9); ids.forEach(function(j){ var p=list[j]; a.min(_hlA.set(p[0],p[1],p[2])); b.max(_hlA); });
    b.y+=up; a.x-=8; a.z-=8; b.x+=8; b.z+=8; var c=a.clone().add(b).multiplyScalar(0.5); return new THREE.Sphere(c, c.distanceTo(b)); };
  if(foliage){ var TB=bin(tp);
    for(var k in TB){ var ids=TB[k], sph=sphOf(tp, ids, 16), cell={kind:"tree", sph:sph};
      cell.lo=cellMesh(foliage, foliage.geometry, ids, sph, foliage.castShadow); cell.loT=cellMesh(trunk, trunk.geometry, ids, sph, trunk.castShadow);
      if(ultra){ cell.hi=cellMesh(foliage, hiF, ids, sph, true); cell.hiT=cellMesh(trunk, hiT, ids, sph, true); cell.loT.visible=false; cell.lo.castShadow=cell.loT.castShadow=false; }
      L.cells.push(cell); }
    S.remove(foliage); S.remove(trunk); }
  if(rocks){ var RB=bin(rp);
    for(var k2 in RB){ var ids2=RB[k2], sph2=sphOf(rp, ids2, 6); L.cells.push({kind:"rock", sph:sph2, lo:cellMesh(rocks, rocks.geometry, ids2, sph2, rocks.castShadow)}); }
    S.remove(rocks); }
}
/* per frame, before the render: distance culling (Lite), near/far LOD (Ultra) */
function hillLodUpdate(W, cam){
  var L=W.lod; if(!L) return; var C=L.cfg, p=cam.position, i;
  for(i=0;i<L.pieces.length;i++){ var P=L.pieces[i]; if(P.kind==="terr"||!C.road) continue; var s=P.m.geometry.boundingSphere; P.m.visible=s.center.distanceTo(p)-s.radius<C.road; }
  for(i=0;i<L.cells.length;i++){ var c=L.cells[i], d=c.sph.center.distanceTo(p)-c.sph.radius;
    if(c.kind==="rock"){ if(C.rock) c.lo.visible=d<C.rock; continue; }
    if(c.hi){ var near=d<C.near; c.hi.visible=c.hiT.visible=near; c.lo.visible=!near; }
    else if(C.tree){ c.lo.visible=c.loT.visible=d<C.tree; } }
}
