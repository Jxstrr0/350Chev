/* ===========================================================================
   OVAL SCENE: a banked track the view cuts to (the 3/8-mile clay, or the paved half-mile: G.surf "clay" | "asphalt" picks the surface, the dust and the painted lines) while ENGINE_VIS.setOval({on, track, cars:[...], ...}) is fed
   every frame. Units metres. The track is a stadium: two straights joined by two 180° left-hand turns, driven
   anticlockwise seen from above. Distance sp runs along the centre line from the start of the front straight
   (x = -ls/2, z = +R), lateral offset d is + toward the infield. The turns bank up toward the wall: height above the
   infield = (w/2 - d)·tan(bank). One clay shader paints the ground, the banked ribbon and the groove from world
   position alone. A concrete wall and catch fence round the top of the bank, tyres on the infield edge, a
   grandstand on the front straight with a crowd, press box, flag stand, scoreboard, light towers, pits in the infield,
   a pack of stock cars (the sim's positions; lanes found here so cars never overlap) and the dust they throw.
   ==========================================================================*/
var OVAL={ on:false, built:false, scene:null, cam:null, sun:null, hemi:null, flood:null, sky:null, fog:null, mats:{}, cars:{}, list:[], fx:null, G:null, gkey:"",
  camPos:new THREE.Vector3(), camTgt:new THREE.Vector3(), fov:50, shot:null, shotT:0, cutT:0, snap:true, relOn:false, t:0, night:null, tier:null, prev:{}, lastT:0,
  composer:null, exposure:0.92, stats:null, horLin:null, sunDir:null, shake:0, crowd:null, poles:[], spots:[], board:null, lane:{}, flagMesh:null, flagKey:"", cheer:0, lapSeen:0, tvA:0 };
var OVAL_WIND=new THREE.Vector3(-0.8,0,0.6), _oA=new THREE.Vector3(), _oB=new THREE.Vector3(), _oC=new THREE.Vector3(), _oD=new THREE.Vector3(),
  _oPt={x:0,z:0,psi:0,nx:0,nz:0,y:0,bank:0};
function ovalSmooth(a,b,x){ var t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); }
/* track point at sp (m along the centre line), lateral d: fills _oPt {x, z, psi (yaw), nx, nz (unit normal toward the infield), bank (rad), y (surface height)} */
function ovalPt(sp, d, out){
  var G=OVAL.G, R=G.R, ls=G.ls, L=G.L, s=((sp%L)+L)%L, o=out||_oPt, c, sn, ph, tl=Math.PI*R, tin;
  if(s<ls){ o.x=-ls/2+s; o.z=R; o.psi=0; o.nx=0; o.nz=-1; tin=-Math.min(s, ls-s); }
  else if(s<ls+tl){ ph=(s-ls)/R; c=Math.cos(ph); sn=Math.sin(ph); o.x=ls/2+R*sn; o.z=R*c; o.psi=ph; o.nx=-sn; o.nz=-c; tin=Math.min(s-ls, ls+tl-s); }
  else if(s<2*ls+tl){ var u=s-ls-tl; o.x=ls/2-u; o.z=-R; o.psi=PI; o.nx=0; o.nz=1; tin=-Math.min(u, ls-u); }
  else { var u2=s-2*ls-tl; ph=u2/R; c=Math.cos(ph); sn=Math.sin(ph); o.x=-ls/2-R*sn; o.z=-R*c; o.psi=PI+ph; o.nx=sn; o.nz=c; tin=Math.min(u2, L-s); }
  o.bank=G.bank*ovalSmooth(-16,16,tin)+0.02*(1-ovalSmooth(-16,16,tin));
  o.x+=o.nx*d; o.z+=o.nz*d; o.y=(G.w/2-d)*Math.tan(o.bank); return o;
}
/* the clay, the grass, the groove: everything from world x,z and the stadium's own distance field */
var OVAL_GLSL=[
  "uniform float uR; uniform float uLs; uniform float uW; uniform float uDry; uniform float uAsph;",
  "vec3 stripSurf(vec3 w, out float rough){",
  "  vec2 p=w.xz; float dc=length(p-cameraPosition.xz); float fine=1.0-smoothstep(18.0,110.0,dc), mid=1.0-smoothstep(100.0,900.0,dc);",
  "  float rho=uR-length(vec2(max(abs(p.x)-uLs*0.5,0.0),p.y));",
  "  vec3 grass=vec3(0.10,0.15,0.05)*(0.8+0.35*sn(p*0.07))*(0.9+0.2*sn(p*1.7)*fine);",
  "  float mow=smoothstep(0.5,0.8,sn(p*0.045+2.0)); grass=mix(grass,vec3(0.13,0.19,0.065),mow*0.5);",
  "  vec3 clay=vec3(0.30,0.20,0.125)*(0.78+0.4*sn(p*0.35))+vec3(0.035,0.025,0.015)*(sn(p*5.0)-0.5)*fine;",
  "  float groove=exp(-pow((rho+1.5)/2.6,2.0)), cush=exp(-pow((rho+uW*0.4)/1.8,2.0));",
  "  clay=mix(clay,clay*0.62,groove*(1.0-uDry*0.5)); clay=mix(clay,vec3(0.38,0.27,0.18),cush*(0.5+uDry*0.4));",
  "  float rut=sn(vec2(p.x*0.6+p.y*0.6,rho*3.0)); clay*=1.0-0.18*smoothstep(0.55,0.8,rut)*groove*fine;",
  "  float onT=1.0-smoothstep(uW*0.5,uW*0.5+0.5,abs(rho));",
  /* Full / Ultra: harrow lines and a packed, rubbered groove, loose marbles and clods up by the cushion, the seam where the bank begins, tufted grass */
  "#if STRIP_TIER>=1",
  "  float gh, dh; vec3 gm=sfGrassFx(p,gh); vec3 dm=sfDirtFx(p,clamp(0.2+0.85*cush+0.4*(1.0-groove),0.0,1.0),dh);",
  "  float ln=0.5+0.5*sin(rho*13.0+2.5*sn(p*0.4)), sm=1.0-smoothstep(0.0,0.4,abs(abs(p.x)-uLs*0.5)), mb=smoothstep(0.62,0.82,sn(p*3.1+8.0))*aaf(0.3)*(1.0-groove);",
  "  dm*=(1.0+0.09*(ln-0.5)*groove*aaf(0.2))*(1.0-0.12*sm*(1.0-0.5*groove))*(1.0+0.16*mb); dh+=0.011*ln*groove*aaf(0.2)-0.01*sm+0.012*mb;",
  "  grass*=gm; clay*=dm; gH=mix(gh,dh,onT); gHK=1.0;",
  "#endif",
  /* asphalt instead of clay: dark grey with a rubbered racing line, tar snakes, white edge lines inside and out, a faint lighter apron */
  "  if(uAsph>0.5){ vec3 asp=vec3(0.092,0.095,0.102)*(0.8+0.36*sn(p*0.31))+vec3(0.02)*(sn(p*6.0)-0.5)*fine;",
  "    asp=mix(asp,asp*0.7,groove*0.75); asp=mix(asp,vec3(0.15,0.15,0.16),smoothstep(0.62,0.8,sn(p*0.9+4.0))*0.35*(1.0-groove));",
  "    float eIn=1.0-smoothstep(0.12,0.3,abs(rho-(uW*0.5-0.9))), eOut=1.0-smoothstep(0.12,0.3,abs(rho+(uW*0.5-0.9)));",
  "    asp=mix(asp,vec3(0.72,0.72,0.69),0.85*max(eIn,eOut));",
  "    clay=asp; }",
  "  vec3 apron=vec3(0.36,0.33,0.28)*(0.85+0.3*sn(p*0.6)); float inner=smoothstep(uW*0.5,uW*0.5+0.4,rho)*(1.0-smoothstep(uW*0.5+0.8,uW*0.5+1.2,rho));",
  "  vec3 c=mix(grass,clay,onT); c=mix(c,apron*0.6,inner*0.0);",
  "  float lot=smoothstep(uW*0.5+13.0,uW*0.5+14.0,-rho)*(1.0-smoothstep(uW*0.5+60.0,uW*0.5+61.0,-rho));",
  "  c=mix(c,vec3(0.30,0.27,0.21)*(0.8+0.35*sn(p*0.9)),lot*0.65);",
  "#if STRIP_TIER>=1",
  "  float gvH; vec3 gvm=sfGravelFx(p,gvH); c*=mix(vec3(1.0),gvm,lot*0.65); gH=mix(gH,gvH,lot*0.65);",
  "#endif",
  "  vec2 q=(p+vec2(800.0,800.0))/805.0; vec2 cell=floor(q); float h=sh(cell+11.0);",
  "  vec3 fc= h<0.25?vec3(0.40,0.30,0.11): h<0.45?vec3(0.50,0.42,0.03): h<0.62?vec3(0.11,0.17,0.05): h<0.8?vec3(0.30,0.23,0.12):vec3(0.18,0.13,0.08);",
  "  fc*=0.9+0.22*(sn(p*0.006+cell*7.0)-0.5)*mid;",
  "  float fair=1.0-smoothstep(150.0,190.0,-rho); c=mix(fc,c,fair);",
  "#if STRIP_TIER>=1",
  "  gH*=fair;",
  "#endif",
  "  rough=mix(0.97,mix(0.82,0.9,uAsph),onT); return c; }"].join("\n");
function ovalAtlas(){
  var c=newCanvas(1024,128), x=c.getContext("2d"), F="'Chakra Petch','Arial Narrow',Arial,sans-serif", i, labels=["PRAIRIE ENGINE WORKS","COULEE FUELS","NORTHWIND TYRE","CANOLA CO-OP","BIG SKY SALVAGE","ELEVATOR FEEDS"], cols=[["#d97757","#141413"],["#141413","#d97757"],["#f2c22c","#131416"],["#1d4787","#f4efe2"],["#b7261d","#f4efe2"],["#2c6b3a","#f4efe2"]];
  for(i=0;i<6;i++){ var bx=i*170; x.fillStyle=cols[i][0]; x.fillRect(bx,0,168,128); x.fillStyle=cols[i][1]; x.font="700 26px "+F; x.textAlign="center"; x.textBaseline="middle";
    var w=labels[i].split(" "), half=Math.ceil(w.length/2); x.fillText(w.slice(0,half).join(" "),bx+84,46,156); x.fillText(w.slice(half).join(" "),bx+84,82,156); }
  var t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=MAXANISO; return t;
}
function ovalFlagTex(kind){
  var c=newCanvas(128,80), x=c.getContext("2d");
  if(kind==="checker"){ for(var j=0;j<5;j++) for(var i=0;i<8;i++){ x.fillStyle=(i+j)%2?"#f4f4f0":"#141413"; x.fillRect(i*16,j*16,16,16); } }
  else { x.fillStyle=kind==="green"?"#2fb24c":kind==="yellow"?"#f2c22c":kind==="red"?"#d63a2c":"#f4f4f0"; x.fillRect(0,0,128,80); }
  var t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; return t;
}
function ovalBoardTex(){ var c=newCanvas(256,512), t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=MAXANISO; t.userData={cv:c}; return t; }
function ovalBoardDraw(t, rows, head){
  var c=t.userData.cv, x=c.getContext("2d"), F="'Chakra Petch','Arial Narrow',Arial,sans-serif";
  x.fillStyle="#1c1b19"; x.fillRect(0,0,256,512); x.fillStyle="#d97757"; x.fillRect(0,0,256,46); x.fillStyle="#141413"; x.font="700 26px "+F; x.textAlign="center"; x.textBaseline="middle"; x.fillText(head||"PRAIRIE SPEEDWAY",128,24,240);
  x.textAlign="left"; x.font="700 25px "+F;
  for(var i=0;i<Math.min(12,rows.length);i++){ var r=rows[i], y=60+i*37; x.fillStyle=r.me?"#d97757":i%2?"#161a1e":"#1b2025"; if(r.me) x.fillRect(4,y-17,248,34); else x.fillRect(4,y-17,248,34);
    x.fillStyle=r.me?"#141413":"#f2c22c"; x.fillText(String(i+1),12,y+1); x.fillStyle=r.me?"#141413":"#f0ece2"; x.fillText(String(r.num).padStart(2," "),52,y+1);
    x.font="600 19px "+F; x.fillText(String(r.n||"").slice(0,12),96,y+1); x.font="700 25px "+F; }
  t.needsUpdate=true;
}
/* ---- the world: built once per tier / track ---- */
function buildOvalScene(G){
  var S3=new THREE.Scene(), lite=(GFX==="lite"), M={}, i, k;
  OVAL.scene=S3; OVAL.tier=GFX; OVAL.mats=M; OVAL.G=G; OVAL.poles=[]; OVAL.spots=[]; OVAL.cars={}; OVAL.list=[];
  var R=G.R, ls=G.ls, W=G.w, L=G.L, hw=W/2, rng=function(s){ var t=Math.sin(s*127.1+3.7)*43758.5453; return t-Math.floor(t); };
  var hemi=new THREE.HemisphereLight(0xcfdcf0, 0x6a5a3c, 0.3); S3.add(hemi); OVAL.hemi=hemi;
  var sun=new THREE.DirectionalLight(0xffe6c4, 1.45); sun.shadow.mapSize.set(2048,2048); var shc=sun.shadow.camera; shc.left=-34; shc.right=34; shc.top=34; shc.bottom=-34; shc.near=1; shc.far=300; sun.shadow.bias=-0.0006; sun.shadow.normalBias=0.03;
  S3.add(sun); S3.add(sun.target); OVAL.sun=sun;
  var flood=new THREE.DirectionalLight(0xfff2dc, 0); flood.position.set(0,60,40); S3.add(flood); S3.add(flood.target); OVAL.flood=flood;
  var sky=new THREE.Mesh(new THREE.SphereGeometry(2600,40,20), stripSkyMat()); sky.frustumCulled=false; sky.renderOrder=-10; S3.add(sky); OVAL.sky=sky;
  S3.fog=new THREE.Fog(0xffffff,150,2700); OVAL.fog=S3.fog;
  var U={ uR:{value:R}, uLs:{value:ls}, uW:{value:W}, uDry:{value:0}, uAsph:{value:G.surf==="asphalt"?1:0} };
  var gm=stripSurfMat(OVAL_GLSL, null, U); gm.customProgramCacheKey=function(){ return "oval_ground"; }; gm.userData.U=U; M.ground=gm;
  var ground=new THREE.Mesh(new THREE.PlaneGeometry(6000,6000), gm); ground.rotation.x=-PI/2; ground.position.y=-0.03; ground.receiveShadow=true; S3.add(ground);
  /* the banked ribbon: inner edge low, outer high; one row of samples every 2.5 m, 13 across and a sloped berm out to the ground */
  (function(){ var n=Math.round(L/2.5), nd=13, ex=7, pos=[], idx=[], dd=[], j, e;
    for(j=0;j<nd;j++) dd.push(hw-W*j/(nd-1));
    for(e=1;e<=ex;e++) dd.push(-hw-e*2.0);
    var cols=dd.length;
    for(i=0;i<=n;i++){ var sp=i/n*L; ovalPt(sp,-hw,_oPt); var yTop=_oPt.y;
      for(j=0;j<cols;j++){ var d=dd[j]; ovalPt(sp,d,_oPt); var y=_oPt.y; if(d<-hw) y=yTop*(1-ovalSmooth(0,1,(-hw-d)/(2.0*ex))); pos.push(_oPt.x,y+0.02,_oPt.z); } }
    for(i=0;i<n;i++) for(j=0;j<cols-1;j++){ var a=i*cols+j, b=a+1, c2=a+cols, d2=c2+1; idx.push(a,b,c2, b,d2,c2); }
    var g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals();
    var m=new THREE.Mesh(g, gm); m.receiveShadow=true; S3.add(m); OVAL.ribbon=m; })();
  M.solid=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.86});
  M.metal=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.42, metalness:0.65});
  M.lamp=new THREE.MeshBasicMaterial({vertexColors:true, toneMapped:false, color:0x777777});
  M.beam=new THREE.MeshBasicMaterial({vertexColors:true, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, fog:true, side:THREE.DoubleSide});
  M.sign=new THREE.MeshStandardMaterial({map:ovalAtlas(), roughness:0.7});
  var B=new StripBatch(), STEEL=0x8d9296, ALU=0xb9bec4, CON=0x9a9a94, UVS=function(q){ return [q*170/1024,0,(q*170+168)/1024,1]; };
  /* the wall round the outside of the bank, a catch fence on top, posts; sponsor boards on the wall face */
  for(var sp=0, q=0; sp<L; sp+=3.0, q++){ ovalPt(sp+1.5, -hw-0.55, _oPt); var yy=_oPt.y, psi=_oPt.psi, nx=_oPt.nx, nz=_oPt.nz;
    B.add("solid","box",[_oPt.x, yy+0.65, _oPt.z],[3.05,1.3,0.42],q%7===3?0xd8d4c6:CON,[0,psi,0]);
    if(q%2===0){ B.add("sign","plane",[_oPt.x+nx*0.24, yy+0.7, _oPt.z+nz*0.24],[2.7,1.0,1],0xffffff,[0,Math.atan2(nx,nz),0],UVS((q/2)%6|0));
      B.add("metal","cyl6",[_oPt.x, yy+3.2, _oPt.z],[0.1,3.8,0.1],STEEL); } }
  /* catch fence: a tall thin wire panel along the top, one translucent ribbon */
  (function(){ var pos=[], idx=[], n=Math.round(L/3), v=0;
    for(i=0;i<=n;i++){ ovalPt(i/n*L, -hw-0.55, _oPt); pos.push(_oPt.x,_oPt.y+1.3,_oPt.z,_oPt.x,_oPt.y+5.1,_oPt.z); if(i<n){ idx.push(v,v+1,v+2,v+1,v+3,v+2); } v+=2; }
    var g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals();
    var f=new THREE.Mesh(g, new THREE.MeshBasicMaterial({color:0x8d9296, transparent:true, opacity:0.16, side:THREE.DoubleSide, depthWrite:false})); f.frustumCulled=false; S3.add(f); })();
  /* tyres on the infield edge: two-high, white paint on the turns */
  for(var st=0, t2=0; st<L; st+=lite?3.6:2.4, t2++){ ovalPt(st, hw+0.55, _oPt); var tw=_oPt.bank>0.12; B.add("solid","cyl",[_oPt.x,_oPt.y+0.22,_oPt.z],[0.85,0.42,0.85],tw&&t2%2?0xe8e4da:0x1a1a1c);
    if(!lite) B.add("solid","cyl",[_oPt.x+_oPt.nx*0.12,_oPt.y+0.62,_oPt.z+_oPt.nz*0.12],[0.8,0.4,0.8],tw&&t2%2===0?0xe8e4da:0x1a1a1c); }
  /* the front straight: start/finish stripe, grandstand, press box, flag stand */
  B.add("solid","box",[0,0.045,R],[0.9,0.03,W],0xf4f4f0);
  var gz=R+hw+7, tiers=9;
  for(i=0;i<tiers;i++){ B.add("solid","box",[0,0.55+i*0.95,gz+i*1.55],[132,1.1,1.65],0x8a8a84); B.add("metal","box",[0,1.12+i*0.95,gz+i*1.55-0.5],[130,0.1,0.5],ALU); }
  B.add("solid","box",[0,0.5,gz-1.4],[134,1.0,0.35],0x6f6f6a);
  for(i=-5;i<=5;i++){ B.add("metal","cyl6",[i*13,tiers*0.95+3.2,gz+tiers*1.55-1.2],[0.18,6.6,0.18],STEEL); }
  B.add("metal","box",[0,tiers*0.95+6.6,gz+tiers*1.55-2.2],[140,0.3,9.6],0x6a2a22,[-0.09,0,0]);
  B.add("solid","box",[0,tiers*0.95+9.4,gz+tiers*1.55+2.4],[22,3.2,4.2],0xe7e2d6); B.add("solid","box",[0,tiers*0.95+9.5,gz+tiers*1.55+0.28],[20,1.4,0.08],0x1b2a33); B.add("sign","plane",[0,tiers*0.95+11.4,gz+tiers*1.55-0.2],[16,1.5,1],0xffffff,[0,PI,0],UVS(0));
  /* flag stand: a stand beside the line, the flagman's platform */
  B.add("solid","box",[-4.5,1.8,R+hw+2.6],[5,3.6,2.6],0xd9d2c0); B.add("metal","box",[-4.5,3.7,R+hw+2.6],[5.4,0.2,3],0x4a4f55);
  /* light towers: ten round the outside, a pole to 26 m with a bank of lamps and a beam leaning onto the track */
  var towers=[[-70,R+hw+32],[0,R+hw+60],[70,R+hw+32],[ls/2+R+hw+28,0],[ls/2+R*0.7+hw+24,R*0.75+24],[ls/2+R*0.7+hw+24,-R*0.75-24],[70,-R-hw-32],[0,-R-hw-30],[-70,-R-hw-32],[-ls/2-R-hw-28,0]];
  towers.forEach(function(tp){ var px=tp[0], pz=tp[1], H=26, dl=Math.hypot(px,pz)||1, ux=-px/dl, uz=-pz/dl, ry=Math.atan2(ux,uz), ax=Math.cos(ry), az=-Math.sin(ry), t=0.24;
    B.add("metal","cyl",[px,H/2,pz],[0.5,H,0.5],0x9aa0a6); B.add("metal","box",[px,H+0.3,pz],[5.4,0.3,0.4],0x80868c,[0,ry,0]);
    for(k=-2;k<=2;k++){ var lx=px+ax*k*1.0, lz=pz+az*k*1.0; B.add("metal","box",[lx,H+0.9,lz],[0.9,0.8,0.5],0x5a5f65,[0,ry,0]); B.add("lamp","box",[lx+ux*0.3,H+0.9,lz+uz*0.3],[0.78,0.66,0.04],0xfff0d0,[0,ry,0]); }
    var rx=-Math.atan(t*uz), rz=Math.atan(t*ux*Math.cos(rx)), nn=Math.sqrt(1+t*t);
    B.add("beam","beam",[px+t*ux*H*0.5, H*0.5+0.4, pz+t*uz*H*0.5],[8,H*nn,8],0xffe8c0,[rx,0,rz]);
    OVAL.poles.push(new THREE.Vector3(px,H+0.9,pz)); });
  /* the infield: haulers and tents in the pits, a stack of spare tyres, the pit road */
  var hc=[0xe9e6dc,0x1b1d20,0x9e2a22,0x22488f,0xd0d3d6,0x2c6b3a,0xff7a1a,0x6b6f74];
  for(i=0;i<14;i++){ var hx=-ls/2+8+i*((ls-16)/13), hz=-R+hw+14+(i%2)*10+rng(i)*3, cc=hc[i%hc.length];
    B.box("solid",hx,1.9,hz,9,3.4,2.7,cc,0); B.box("solid",hx-5.4,1.4,hz,2.2,2.4,2.6,0x22262b,0); B.box("solid",hx,0.4,hz,9,0.5,2.5,0x161718,0); B.add("sign","plane",[hx,2.3,hz+1.37],[6.5,1.2,1],0xffffff,[0,0,0],UVS(i%6)); }
  for(i=0;i<9;i++){ var tx=-ls/2+16+i*13, tz=R-hw-22-rng(i+5)*3; B.box("solid",tx,1.1,tz,5.5,2.2,4,i%2?0xf1ede2:0x2a6db5,0); B.add("solid","prism",[tx,2.2,tz],[5.7,1.4,4.2],i%2?0xe0dccf:0x1d4787,[0,PI/2,0]); }
  /* the grain elevator and sheds on the horizon, a water tower in the town */
  B.box("solid",260,22,-340,14,44,14,0xd9d4c6,0.3); B.add("solid","prism",[260,44,-340],[14.4,4,14.4],0x4a4644,[0,0.3,0]); B.box("solid",282,13,-336,10,26,10,0xcfcabb,0.3);
  B.box("solid",-300,6,260,28,12,18,0x9a2e22,0.4); B.add("solid","prism",[-300,12,260],[28.4,4,18.6],0x5a5a5a,[0,0.4,0]);
  B.add("metal","cyl",[-420,22,-300],[3,44,3],0x9aa0a6); B.add("metal","cyl",[-420,48,-300],[16,12,16],0xe9e6dc);
  var bm=function(key,shadow){ var keep=STRIP.scene; STRIP.scene=S3; var m=B.build(key, M[key], shadow); STRIP.scene=keep; return m; };
  bm("solid",!lite); bm("metal",!lite); OVAL.lampMesh=bm("lamp",false); bm("sign",false);
  OVAL.beamMesh=bm("beam",false); if(OVAL.beamMesh){ OVAL.beamMesh.receiveShadow=false; OVAL.beamMesh.visible=false; OVAL.beamMesh.renderOrder=4; }
  /* shelterbelt */
  (function(){ var pts=[], s;
    for(s=0;s<70;s++){ var a=s/70*TAU, Rr=230+rng(s)*60; pts.push([Math.cos(a)*Rr*1.5, Math.sin(a)*Rr*1.2, 4+rng(s+3)*3]); }
    var im=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0), new THREE.MeshStandardMaterial({roughness:1}), pts.length), mm=new THREE.Matrix4(), cc=new THREE.Color();
    pts.forEach(function(p,qq){ var h=p[2]*1.6; mm.compose(_oA.set(p[0],h*0.8,p[1]), new THREE.Quaternion(), _oB.set(p[2],h,p[2])); im.setMatrixAt(qq,mm); cc.setHSL(0.24+rng(qq)*0.06,0.45,0.13+rng(qq+1)*0.06).convertSRGBToLinear(); im.setColorAt(qq,cc); });
    instCull(im); S3.add(im); })();
  /* the crowd on the stand: rows of seated people, thinner on Lite */
  (function(){ var ppl=[], occ=lite?0.4:ULT()?0.9:0.66;
    for(var r=0;r<tiers;r++){ var rz=gz+r*1.55+0.2, ry=1.1+r*0.95;
      for(var xx=-64; xx<64; xx+=0.62){ if(rng(xx*3.1+r*17.7)>occ*(1-r*0.03)) continue; ppl.push([xx+(rng(xx+r)-0.5)*0.3, ry, rz+(rng(xx*1.7+r)-0.5)*0.3]); } }
    var n=ppl.length, bodyM=new THREE.InstancedMesh(new THREE.BoxGeometry(0.46,0.7,0.34), new THREE.MeshStandardMaterial({roughness:0.95}), n), headM=new THREE.InstancedMesh(new THREE.BoxGeometry(0.22,0.25,0.22), new THREE.MeshStandardMaterial({roughness:0.9}), n);
    var shirts=[0x9c3a30,0x34598f,0xcfccc4,0x1f2023,0x2a2c30,0xff7a1a,0x44684a,0xc8a640,0x5d5f66,0x7a7f86,0x3a3d44,0x8f4a5e,0x2c6b3a], skin=[0xe0b494,0xc68a64,0x8d5a3b,0xf0c9a8,0x5a3a26], hats=[0x1d4787,0xff7a1a,0x222222,0xe9e6dc,0x2c6b3a,0x9e2a22];
    var mm=new THREE.Matrix4(), cc=new THREE.Color(), base=[];
    for(var s2=0;s2<n;s2++){ var p=ppl[s2]; mm.makeTranslation(p[0],p[1]+0.35,p[2]); bodyM.setMatrixAt(s2,mm); mm.makeTranslation(p[0],p[1]+0.83,p[2]); headM.setMatrixAt(s2,mm);
      cc.set(shirts[Math.floor(rng(s2*1.3)*shirts.length)]).convertSRGBToLinear(); bodyM.setColorAt(s2,cc);
      cc.set(rng(s2*2.9)<0.45?hats[Math.floor(rng(s2*4.1)*hats.length)]:skin[Math.floor(rng(s2*3.7)*skin.length)]).convertSRGBToLinear(); headM.setColorAt(s2,cc); base.push(p); }
    instCull(bodyM,1.5); instCull(headM,1.5); S3.add(bodyM); S3.add(headM);
    OVAL.crowd={body:bodyM, head:headM, base:base, n:n, phase:base.map(function(p,q2){ return rng(q2*9.1)*TAU; }), excite:base.map(function(p,q2){ return rng(q2*5.3); }), live:false}; })();
  /* scoreboard in the infield, facing the stand */
  (function(){ var t=ovalBoardTex(); ovalBoardDraw(t,[],"PRAIRIE SPEEDWAY"); var mat=new THREE.MeshBasicMaterial({map:t, toneMapped:false}); OVAL.board={tex:t, mat:mat, key:""};
    var mesh=new THREE.Mesh(new THREE.PlaneGeometry(10,20), mat); mesh.position.set(-ls*0.18, 12, -8); mesh.rotation.y=0; S3.add(mesh);
    var post=new THREE.Mesh(new THREE.BoxGeometry(0.5,12,0.5), new THREE.MeshStandardMaterial({color:0x4a4f55})); post.position.set(-ls*0.18,6,-8.4); S3.add(post); OVAL.boardMesh=mesh; })();
  /* the flag */
  (function(){ var pole=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,3,6), new THREE.MeshStandardMaterial({color:0xcfd2d6})); pole.position.set(-4.5,5.2,R+hw+2.6); S3.add(pole);
    var fl=new THREE.Mesh(new THREE.PlaneGeometry(1.9,1.2), new THREE.MeshBasicMaterial({map:ovalFlagTex("green"), side:THREE.DoubleSide, toneMapped:false})); fl.position.set(-4.5+0.95,5.6,R+hw+2.6); fl.rotation.y=PI/2; fl.rotation.set(0,0,0); S3.add(fl); OVAL.flagMesh=fl; OVAL.flagKey="green"; OVAL.flagTex={}; })();
  OVAL.fx=new StripFx(lite?260:620,"smoke",stripPuffTex()); S3.add(OVAL.fx.mesh);
  OVAL.cam=OVAL.cam||new THREE.PerspectiveCamera(50,1,0.3,4200); OVAL.built=true; OVAL.night=null; OVAL.snap=true; ovalSetNight(false);
}
function ovalSetNight(on){
  on=!!on; var tierChanged=OVAL.tier!==GFX; if(OVAL.night===on && !tierChanged) return;
  OVAL.night=on; OVAL.tier=GFX; var S3=OVAL.scene, lite=(GFX==="lite"), M=OVAL.mats;
  OVAL.sky.material.uniforms.uNight.value=on?1:0;
  var h=on?STRIP_HOR_N:STRIP_HOR; OVAL.horLin=new THREE.Color(h[0],h[1],h[2]); OVAL.sunDir=(on?STRIP_MOON:STRIP_SUN_DAY);
  OVAL.sun.color.set(on?0x9fb2d6:0xffe2bc); OVAL.sun.intensity=on?0.14:1.45; OVAL.sun.castShadow=!lite;
  OVAL.hemi.intensity=on?0.16:0.2; OVAL.hemi.color.set(on?0x3a4764:0xcfdcf0); OVAL.hemi.groundColor.set(on?0x16130e:0x6a5a3c);
  OVAL.flood.intensity=on?(lite?0.7:0.4):0; M.lamp.color.set(on?0xffffff:0x5e5e5e);
  if(OVAL.beamMesh){ OVAL.beamMesh.visible=on; M.beam.opacity=on?0.012:0; ultraBeam(OVAL.beamMesh, M.beam); }
  S3.environment=stripEnv(on); OVAL.exposure=on?1.0:0.9;
  if(OVAL.fx){ OVAL.fx.mat.uniforms.uAmb.value=on?0.5:1; OVAL.fx.mat.uniforms.uFogN.value=S3.fog.near; OVAL.fx.mat.uniforms.uFogF.value=S3.fog.far; }
  M.ground.userData.U.uDry.value=on?0.3:0.5;
  if(tierChanged && OVAL.sun.shadow.map){ OVAL.sun.shadow.map.dispose(); OVAL.sun.shadow.map=null; }
  OVAL.spots.forEach(function(sp){ S3.remove(sp); S3.remove(sp.target); if(sp.shadow&&sp.shadow.map) sp.shadow.map.dispose(); }); OVAL.spots=[];
  if(on){ for(var i=0;i<(lite?2:3);i++){ var sp=new THREE.SpotLight(0xfff0d8,lite?2.2:1.1,200,0.7,0.6,1.4); sp.castShadow=!lite && i===0; if(sp.castShadow){ sp.shadow.mapSize.set(1024,1024); sp.shadow.bias=-0.002; sp.shadow.normalBias=0.05; sp.shadow.camera.near=4; sp.shadow.camera.far=220; }
    S3.add(sp); S3.add(sp.target); OVAL.spots.push(sp); } ultraSpots(OVAL.spots); }
  if(!lite) ultraShadow(OVAL.sun,2048);
}
/* ---- a stock car: the road test's muscle shape, a rear spoiler, number and livery from stripCar ---- */
function ovalCarMesh(color, big){
  var car=stripCar("street", color, 27), U=car.userData, B=U.bodyGroup;
  B.scale.set(1.0, 0.94, 1.06);
  var wm=new THREE.MeshStandardMaterial({color:sc(0x15171b), roughness:0.5, metalness:0.2}), g=new THREE.Group();
  var sp=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.05,1.65), wm); sp.position.set(-2.2,1.08,0); sp.rotation.z=0.22; g.add(sp);
  for(var s=-1;s<=1;s+=2){ var pl=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.28,0.025), wm); pl.position.set(-2.2,1.0,s*0.83); g.add(pl); }
  g.children.forEach(function(m){ m.castShadow=true; }); B.children[0].add(g);
  car.traverse(function(o){ if(o.isMesh) o.castShadow=true; });
  return car;
}
function ovalGetCar(color){
  var k=color+(GFX==="lite"?"l":""), c=OVAL.cars[k]; if(!c){ c=OVAL.cars[k]=ovalCarMesh(color); OVAL.scene.add(c); c.userData.lane={d:0,set:false}; c.userData.steer=0; c.userData.roll=0; }
  return c;
}
/* ---- lanes: front to back, each car takes its preferred groove unless a car ahead is in it ---- */
function ovalLanes(list, dt){
  var G=OVAL.G, L=G.L, idx=list.map(function(c,i){ return i; }).filter(function(i){ return !list[i].gone; });
  idx.sort(function(a,b){ return list[b].s-list[a].s; });
  var placed=[], gap=7.8, side=2.7, i, j, w;
  idx.forEach(function(ci){ var c=list[ci], pref=c.me?1.6:(c.groove!=null?c.groove:-1), d=pref, best=null, tries=[0,1,-1,2,-2,3,-3];
    for(j=0;j<tries.length;j++){ var dd=clamp(pref+tries[j]*side,-hw0(),hw0()), ok=true;
      for(w=0;w<placed.length;w++){ var p=placed[w], ds=((p.s-c.s)%L+L)%L; if(ds>L/2) ds-=L; if(Math.abs(ds)<gap && Math.abs(p.d-dd)<side*0.92){ ok=false; break; } }
      if(ok){ best=dd; break; } }
    if(best==null) best=clamp(pref+side*3,-hw0(),hw0());
    var st=OVAL.lane[ci]; if(st==null||isNaN(st)) st=best; st+=(best-st)*Math.min(1,dt*1.6); OVAL.lane[ci]=st; c.dRender=st; placed.push({s:c.s,d:st}); });
}
function hw0(){ return OVAL.G.w/2-1.3; }
/* ---- the director ---- */
function ovalDirect(o, dt, me, V){
  var G=OVAL.G, L=G.L, s=OVAL.shot, mode=o.cam||"auto", ph=o.pre?"pre":o.done?"done":"race", sp=me.s+G.ls/2, fov=50, rel=false;
  var pos=_oA, tgt=_oB;
  if(mode==="chase"||mode==="tv"||mode==="heli"||mode==="onboard") s=mode;
  else if(ph==="pre") s="start";
  else if(ph==="done") s="finish";
  else { var cyc=["chase","tv","pack","chase","onboard","tv","heli"], lens=[6,7,5,5,4,6,5];
    if(!s||cyc.indexOf(s)<0){ s="chase"; OVAL.cyc=0; }
    if(OVAL.shotT>lens[OVAL.cyc%cyc.length]){ OVAL.cyc=(OVAL.cyc+1)%cyc.length; s=cyc[OVAL.cyc]; } else s=cyc[OVAL.cyc%cyc.length];
    if(o.lastLap && (o.toFlag||0)<1) s="finish"; }
  sceneCut(OVAL, s); OVAL.shotT+=dt; OVAL.cutT+=dt;
  var cp=V.position, yaw=V.rotation.y, fx=Math.cos(yaw), fz=-Math.sin(yaw);
  switch(s){
    case "start": { var t0=Math.min(1,OVAL.shotT/8); ovalPt(G.ls/2+34-10*t0, G.w/2+11, _oPt); pos.set(_oPt.x, 3.3+1.4*t0, _oPt.z); ovalPt(G.ls/2-20, 0, _oPt); tgt.set(_oPt.x, 1.1, _oPt.z); fov=52; break; }
    case "chase": { pos.set(cp.x-fx*11, cp.y+3.0, cp.z-fz*11); tgt.set(cp.x+fx*8, cp.y+1.1, cp.z+fz*8); fov=58; rel=true; break; }
    case "onboard": { pos.set(cp.x+fx*0.1-0.0, cp.y+1.12, cp.z+fz*0.1); tgt.set(cp.x+fx*22, cp.y+0.9, cp.z+fz*22); fov=72; break; }
    case "tv": { ovalPt(sp+34, G.w/2+13, _oPt); pos.set(_oPt.x, 4.4, _oPt.z); tgt.set(cp.x+fx*4, cp.y+0.8, cp.z+fz*4); var dist=pos.distanceTo(tgt); fov=clamp(2*Math.atan(9/Math.max(8,dist))*180/PI,14,50); break; }
    case "pack": { var cx=0, cz=0, n=0; for(var i=0;i<o.cars.length;i++){ var c=o.cars[i]; if(c.gone) continue; var ds=((c.s-me.s)%L+L)%L; if(ds>L/2) ds-=L; if(Math.abs(ds)<55){ var q=OVAL.list[i]; if(q){ cx+=q.position.x; cz+=q.position.z; n++; } } } if(!n){ cx=cp.x; cz=cp.z; n=1; }
      tgt.set(cx/n, 0.6, cz/n); pos.set(cx/n-fz*0*0+fx*-1, 15, cz/n); pos.x=cx/n-fx*8+(-fz)*-22; pos.z=cz/n-fz*8+(fx)*-22; pos.y=14; fov=44; break; }
    case "heli": { OVAL.tvA+=dt*0.16; var Rr=70; pos.set(cp.x+Math.cos(OVAL.tvA)*Rr, 46, cp.z+Math.sin(OVAL.tvA)*Rr); tgt.set(cp.x+fx*6, cp.y, cp.z+fz*6); fov=40; break; }
    case "finish": { ovalPt(G.ls/2+60, -hw0()-1, _oPt); pos.set(_oPt.x, 3.0, _oPt.z+3); ovalPt(G.ls/2, 1, _oPt); tgt.set(_oPt.x+8, 1.3, _oPt.z); fov=36; break; }
  }
  if(rel){ if(OVAL.snap||!OVAL.relOn){ OVAL.rp=OVAL.rp||new THREE.Vector3(); OVAL.rt=OVAL.rt||new THREE.Vector3(); OVAL.rp.copy(pos); OVAL.rt.copy(tgt); } else { var k=1-Math.exp(-dt*5); OVAL.rp.lerp(pos,k); OVAL.rt.lerp(tgt,1-Math.exp(-dt*9)); }
    pos.copy(OVAL.rp); tgt.copy(OVAL.rt); OVAL.relOn=true; } else OVAL.relOn=false;
  if(OVAL.snap){ OVAL.fov=fov; OVAL.snap=false; OVAL.camTgt.copy(tgt); } else OVAL.fov+=(fov-OVAL.fov)*(1-Math.exp(-5*dt));
  OVAL.camPos.copy(pos); if(rel) OVAL.camTgt.copy(tgt); else OVAL.camTgt.lerp(tgt,1-Math.exp(-7*dt));
  OVAL.shake*=Math.exp(-dt*3); var sh=OVAL.shake; if(sh>0.002){ OVAL.camPos.x+=(Math.random()-0.5)*sh*0.2; OVAL.camPos.y+=(Math.random()-0.5)*sh*0.2; }
  var cam=OVAL.cam; cam.position.copy(OVAL.camPos); cam.lookAt(OVAL.camTgt); cam.fov=OVAL.fov; cam.updateProjectionMatrix(); bandLens(cam);
}
function ovalComposer(){
  if(OVAL.composer===false) return null;
  var sz=renderer.getSize(new THREE.Vector2()), pr=renderer.getPixelRatio(), C=ultraComposerKeep(OVAL.composer);
  if(!C){ try{ C=ultraComposerMark(new THREE.EffectComposer(renderer, ultraRT())); C.addPass(ultraRenderPass(OVAL.scene, OVAL.cam, "oval"));
      var bp=new THREE.UnrealBloomPass(new THREE.Vector2(Math.max(1,sz.x*pr/2), Math.max(1,sz.y*pr/2)), 0.3, 0.4, 0.9); C.addPass(bp); OVAL.bloom=bp;
      if(THREE.GammaCorrectionShader) C.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
      OVAL.composer=C; OVAL.cSize=""; }catch(e){ OVAL.composer=false; return null; } }
  var key=sz.x+"x"+sz.y+"@"+pr; if(OVAL.cSize!==key){ if(C.setPixelRatio) C.setPixelRatio(pr); C.setSize(sz.x, sz.y); OVAL.cSize=key; }
  var n=!!OVAL.night, b=OVAL.bloom; b.strength=n?0.6:0.22; b.threshold=n?0.72:0.92; b.radius=n?0.5:0.4;
  return C;
}
function ovalRender(){
  var S3=OVAL.scene, cam=OVAL.cam; if(!S3||!cam) return;
  var C=(GFX!=="lite" && THREE.EffectComposer && THREE.UnrealBloomPass && THREE.RenderPass && THREE.ShaderPass) ? ovalComposer() : null;
  if(C) S3.fog.color.copy(OVAL.horLin); else S3.fog.color.copy(OVAL.horLin).convertLinearToSRGB();
  OVAL.sky.position.copy(cam.position); if(OVAL.fx) OVAL.fx.mat.uniforms.uFog.value.copy(OVAL.horLin);
  var ex=renderer.toneMappingExposure; renderer.toneMappingExposure=OVAL.exposure;
  var inf=renderer.info, ar=inf.autoReset; inf.autoReset=false; inf.reset();
  if(C) C.render(); else renderer.render(S3, cam);
  OVAL.stats={calls:inf.render.calls, tris:inf.render.triangles, tier:GFX, shot:OVAL.shot, parts:OVAL.fx?OVAL.fx.P.length:0, cars:OVAL.list.length}; inf.autoReset=ar;
  renderer.toneMappingExposure=ex;
}
function ovalReset(){ if(OVAL.fx) OVAL.fx.clear(); OVAL.shot=null; OVAL.prev={}; OVAL.shake=0; OVAL.cheer=0; OVAL.lane={}; OVAL.snap=true; OVAL.relOn=false; OVAL.lapSeen=0; }
var OVAL_CROWD={decay:0.3, lo:0.4, hi:0.05, f0:7, f1:9, amp:0.16, body:0.35, head:0.83};
function ovalCrowd(dt){ crowdTick(OVAL, dt, OVAL_CROWD); }
function ovalSetFlag(kind){
  if(OVAL.flagKey===kind||!OVAL.flagMesh) return; OVAL.flagKey=kind; var t=OVAL.flagTex[kind]||(OVAL.flagTex[kind]=ovalFlagTex(kind)); OVAL.flagMesh.material.map=t; OVAL.flagMesh.material.needsUpdate=true;
}
/* o: {on, track:{R, ls, w, bank, len}, cars:[{s (total m, + along), v, color, me, num, n, groove, gone, slide (0..1), thr}], pre, done, flag:"green"|"white"|"checker"|"yellow", cam, night, lastLap, toFlag, order:[{num,n,me}], boardHead, cheer, dt} */
function ovalUpdate(o, dt){
  var T=o.track||{}, G={R:+T.R||52, ls:+T.ls||136.6, w:+T.w||18, bank:+T.bank||0.384, surf:T.surf==="asphalt"?"asphalt":"clay"}; G.L=2*G.ls+2*Math.PI*G.R;
  var gk=[G.R,G.ls,G.w,G.bank,G.surf,GFX].join("|");
  if(!OVAL.built||OVAL.gkey!==gk){ if(OVAL.scene){ OVAL.list.forEach(function(c){ if(c.parent) c.parent.remove(c); }); disposeTree(OVAL.scene); OVAL.composer=null; } OVAL.gkey=gk; buildOvalScene(G); }
  var S3=OVAL.scene; OVAL.t+=dt;
  if(OVAL.night!==!!o.night) ovalSetNight(!!o.night);
  var cars=o.cars||[], ph=o.pre?"pre":o.done?"done":"race";
  if(ph==="pre" && OVAL.prev.ph && OVAL.prev.ph!=="pre") ovalReset();
  for(var kk in OVAL.cars) OVAL.cars[kk].visible=false;
  OVAL.list=cars.map(function(c){ var m=ovalGetCar(c.color); m.visible=!c.gone; return m; });
  ovalLanes(cars, dt);
  var me=cars.find(function(c){ return c.me; })||cars[0], V=null, i;
  for(i=0;i<cars.length;i++){
    var c=cars[i], car=OVAL.list[i], U=car.userData; if(c.gone){ car.visible=false; continue; }
    var d=c.dRender!=null?c.dRender:0; ovalPt(c.s+G.ls/2, d, _oPt);
    var slide=clamp(+c.slide||0,0,1), inT=_oPt.bank>0.12, crab=(inT?0.11:0)+slide*0.16, yaw=_oPt.psi+crab;
    car.position.set(_oPt.x, _oPt.y+0.02, _oPt.z); car.rotation.set(-_oPt.bank*(1-0.0), yaw, 0, "YXZ");
    var steer=(inT?0.2-slide*0.5:0.0); U.steer+=(steer-U.steer)*Math.min(1,dt*8); for(var w=0;w<U.carriers.length;w++){ var Cw=U.carriers[w]; if(!Cw.userData.rear) Cw.rotation.y=U.steer; }
    stripCarAnim(car,{v:Math.max(0,+c.v||0), acc:(+c.thr||0)*3-(+c.brk||0)*6, brake:(+c.brk||0)>0.05, night:!!o.night, lift:0},dt,true);
    var roll=clamp(-(inT?1:0)*0.012-slide*0.02,-0.05,0.05); U.roll+=(roll-U.roll)*Math.min(1,dt*5); U.bodyGroup.rotation.x+=U.roll;
    car.updateMatrixWorld(true);
    /* dust off the rear tyres: more in a slide and on the throttle, thin on Lite */
    var v=Math.max(0,+c.v||0), asph=G.surf==="asphalt", rate=(v>8?(asph?0.04+2.6*slide+1.2*(+c.thr||0)*(+c.spin||0):0.6+3.4*slide+1.0*(+c.thr||0)*(+c.spin||0))*(inT?1.0:0.7)*dt*(v/30)*(GFX==="lite"?18:34):0);
    if(OVAL.fx && rate>0){ var fx=Math.cos(yaw), fz=-Math.sin(yaw); rate*=(c.me?1.1:0.8);
      while(rate>0){ if(rate<1 && Math.random()>rate) break; rate-=1;
        var side=Math.random()<0.5?-1:1, ox=-fx*2.3+(-fz)*side*0.8*-1, oz=-fz*2.3+(fx)*side*0.8*-1;
        OVAL.fx.emit(car.position.x+ox, car.position.y+0.3, car.position.z+oz, (Math.random()-0.5)*1.4-fx*v*0.05, 0.5+Math.random()*0.7, (Math.random()-0.5)*1.4-fz*v*0.05, 1.7+Math.random()*0.9, 0.7, 3.6+slide*2.4, asph?0.8:0.56, asph?0.8:0.46, asph?0.82:0.35, asph?0.2+0.1*slide:0.26+0.12*slide, {drag:0.55, buoy:0.12}); } }
    if(c.me) V=car;
  }
  if(!V) V=OVAL.list[0];
  if(OVAL.fx) OVAL.fx.step(dt, OVAL_WIND);
  if(+o.cheer>0) OVAL.cheer=Math.max(OVAL.cheer,+o.cheer);
  if(ph==="done" && OVAL.prev.ph==="race") OVAL.cheer=2.4;
  ovalCrowd(dt);
  ovalSetFlag(o.flag||"green");
  if(OVAL.flagMesh){ OVAL.flagMesh.rotation.z=Math.sin(OVAL.t*(o.flag==="checker"?9:5))*0.2; OVAL.flagMesh.rotation.y=Math.sin(OVAL.t*3)*0.25; }
  /* the board: top twelve, redrawn when the order changes (twice a second at most) */
  if(OVAL.board && o.order){ var key=o.order.map(function(r){ return r.num+(r.me?"*":""); }).join(",")+"|"+(o.boardHead||""); if(key!==OVAL.board.key && OVAL.t-(OVAL.board.t||0)>0.4){ OVAL.board.key=key; OVAL.board.t=OVAL.t; ovalBoardDraw(OVAL.board.tex,o.order,o.boardHead); } }
  if(V) ovalDirect(o, dt, me, V);
  var cc=_oC.copy(OVAL.camPos).lerp(OVAL.camTgt,0.6); cc.y=0;
  OVAL.sun.position.copy(cc).addScaledVector(OVAL.sunDir,120); OVAL.sun.target.position.copy(cc); OVAL.sun.target.updateMatrixWorld();
  if(OVAL.flood.intensity>0){ OVAL.flood.position.set(cc.x-20,60,cc.z+40); OVAL.flood.target.position.copy(cc); OVAL.flood.target.updateMatrixWorld(); }
  if(OVAL.spots.length){ var poles=OVAL.poles.slice().sort(function(a,b){ return a.distanceToSquared(cc)-b.distanceToSquared(cc); });
    OVAL.spots.forEach(function(sp,j){ var pp=poles[j]; if(!pp) return; sp.position.copy(pp); sp.target.position.set(cc.x,0,cc.z); sp.target.updateMatrixWorld(); }); }
  OVAL.prev={ph:ph};
}
