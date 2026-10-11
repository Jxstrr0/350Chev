/* ===========================================================================
   MUD BOG SCENE — a county-fair mud pit the view cuts to while ENGINE_VIS.setBog({on:true, ...}) is fed every frame.
   Units metres, +x down the pit: the run-up is x < 0, the mud runs 0 … len. The mud is one plane per night: a canvas
   map (colour by consistency, the night's dark wet tracks painted in as the truck goes) and, on Full/Ultra, vertices
   pressed down into ruts behind the tyres. Berms both sides, a crowd on the bank, light poles, the pull pickup on
   bigger tyres (swampers, paddles) sinking and pitching with the mud, rooster tails scaled by wheelspin.
   ==========================================================================*/
var BOG={ on:false, built:false, scene:null, cam:null, sun:null, hemi:null, flood:null, sky:null, fog:null, mats:{}, veh:{}, cur:null, curKey:"",
  mud:null, mudKey:"", mudCv:null, mudTex:null, mudGeo:null, mudBase:null, ruts:null, rutDirty:0, paintAt:-1, paintX:-1e9, crowd:null, poles:[], spots:[], fx:null, fxSpray:null,
  camPos:new THREE.Vector3(), camTgt:new THREE.Vector3(), fov:46, shot:null, shotT:0, cutT:9, snap:true, relOn:false, skip:false,
  t:0, doneT:0, cheer:0, night:null, tier:null, prev:{}, lastT:0, composer:null, exposure:0.92, stats:null, horLin:null, sunDir:null, shake:0, fixX:0, coat:0, slapT:0, pitch:0, pv:0, roll:0 };
var BOG_W=10, BOG_WIND=new THREE.Vector3(-0.8,0,0.6), _bA=new THREE.Vector3(), _bB=new THREE.Vector3(), _bw=new THREE.Vector3(), _bt=new THREE.Vector3(), _br=new THREE.Vector3(), _brt=new THREE.Vector3();
/* fairground grass, a dirt run-up lane, the dark ground round the pit, the pits and lot off to the side */
var BOG_GLSL_GROUND=[
  "uniform float uLen;",
  "vec3 stripSurf(vec3 w, out float rough){",
  "  vec2 p=w.xz; if(p.x>0.0 && p.x<uLen && abs(p.y)<5.0) discard;",
  "  float d=length(p-cameraPosition.xz); float fine=1.0-smoothstep(20.0,120.0,d), mid=1.0-smoothstep(100.0,900.0,d);",
  "  vec3 grass=vec3(0.11,0.155,0.055)*(0.8+0.35*sn(p*0.08))*(0.9+0.2*sn(p*1.9)*fine);",
  "  float worn=smoothstep(0.5,0.8,sn(p*0.06+3.0))*0.6;",
  "  vec3 c=mix(grass,vec3(0.27,0.21,0.14)*(0.85+0.3*sn(p*0.7)),worn);",
  "  float lane=(1.0-smoothstep(5.0,6.5,abs(p.y)))*smoothstep(-58.0,-55.0,p.x)*(1.0-smoothstep(uLen+26.0,uLen+30.0,p.x));",
  "  vec3 dirt=vec3(0.30,0.22,0.14)*(0.8+0.3*sn(p*0.9))+vec3(0.04,0.03,0.02)*(sn(p*6.0)-0.5)*fine;",
  "  float tr=exp(-pow((abs(p.y)-1.0)/0.35,2.0))*0.5;",
  "  dirt=mix(dirt,dirt*0.7,tr);",
  "  float wet=(1.0-smoothstep(7.0,10.0,abs(p.y)))*smoothstep(-4.0,0.0,p.x)*(1.0-smoothstep(uLen,uLen+8.0,p.x));",
  "  dirt=mix(dirt,vec3(0.16,0.11,0.07)*(0.85+0.3*sn(p*1.3)),wet*0.8);",
  "  c=mix(c,dirt,max(lane,wet*0.9));",
  "  float lot=smoothstep(16.0,17.0,p.y)*(1.0-smoothstep(46.0,47.0,p.y))*smoothstep(-50.0,-49.0,p.x)*(1.0-smoothstep(uLen+20.0,uLen+21.0,p.x));",
  "  c=mix(c,vec3(0.30,0.27,0.22)*(0.8+0.35*sn(p*0.9)),lot);",
  "  vec2 q=(p+vec2(800.0,800.0))/805.0; vec2 cell=floor(q); float h=sh(cell+11.0);",
  "  vec3 fc= h<0.25?vec3(0.40,0.30,0.11): h<0.45?vec3(0.50,0.42,0.03): h<0.62?vec3(0.11,0.17,0.05): h<0.8?vec3(0.30,0.23,0.12):vec3(0.18,0.13,0.08);",
  "  fc*=0.9+0.22*(sn(p*0.006+cell*7.0)-0.5)*mid;",
  "  float fair=1.0-smoothstep(140.0,170.0,max(abs(p.x-40.0),abs(p.y)));",
  "  c=mix(fc,c,fair); rough=mix(0.96,0.7,wet); return c; }"].join("\n");

/* the night's mud: colour by consistency (soupy = milky chocolate, sticky = grey clay), puddles, foam, the edges */
function bogMudPaint(cv, len, cons, seed){
  var x=cv.getContext("2d"), W=cv.width, H=cv.height, i, r=function(){ seed=(seed*16807)%2147483647; return seed/2147483647; };
  var base=cons<0.45?[104,68,38]:[92,72,52], dark=cons<0.45?[52,32,18]:[50,40,30];
  base=[lerp(base[0],90,cons),lerp(base[1],70,cons),lerp(base[2],50,cons)];
  x.fillStyle="rgb("+base.map(Math.round).join(",")+")"; x.fillRect(0,0,W,H);
  var img=x.getImageData(0,0,W,H), d=img.data;
  for(var j=0;j<H;j++) for(i=0;i<W;i++){ var n=fbm(i/W*len/8, j/H*1.3, 4, 3, 5)*0.7+hashi(i,j,9)*0.3, k=(j*W+i)*4, edge=Math.min(1, Math.min(j, H-1-j)/(H*0.12));
    var f=0.72+0.55*n; d[k]=d[k]*f*(0.8+0.2*edge); d[k+1]=d[k+1]*f*(0.8+0.2*edge); d[k+2]=d[k+2]*f*(0.82+0.18*edge); }
  x.putImageData(img,0,0);
  /* standing water: soupy mud pools, sticky clay cracks into islands */
  var np=Math.round(6+10*(1-cons));
  for(i=0;i<np;i++){ var px=r()*W, py=H*(0.15+0.7*r()), rx=W*(0.01+0.03*r()), ry=H*(0.06+0.12*r());
    x.fillStyle="rgba("+dark.join(",")+","+(0.35+0.3*(1-cons))+")"; x.beginPath(); x.ellipse(px,py,rx,ry,0,0,TAU); x.fill(); }
  if(cons<0.4){ for(i=0;i<60;i++){ x.fillStyle="rgba(200,180,150,"+(0.06+0.08*r())+")"; x.beginPath(); x.ellipse(r()*W,H*(0.1+0.8*r()),2+r()*6,1+r()*2,0,0,TAU); x.fill(); } }   /* foam */
  else { x.strokeStyle="rgba(40,32,24,0.35)"; x.lineWidth=1; for(i=0;i<90;i++){ var cx=r()*W, cy=r()*H; x.beginPath(); x.moveTo(cx,cy); x.lineTo(cx+(r()-0.5)*14,cy+(r()-0.5)*6); x.stroke(); } }
}
/* (re)build the pit for a night: a plane len × BOG_W, its depth profile only drives the ruts; the surface sits level */
function bogMudBuild(pit){
  var lite=GFX==="lite", len=Math.max(20, +pit.len||70), key=[pit.seed, len, pit.cons, GFX==="lite"?"l":"f"].join("|");
  if(BOG.mudKey===key && BOG.mud) return; BOG.mudKey=key;
  if(BOG.mud){ BOG.scene.remove(BOG.mud); BOG.mud.geometry.dispose(); }
  var sx=lite?Math.ceil(len/2):Math.ceil(len*2), sz=lite?2:24, g=new THREE.PlaneGeometry(len, BOG_W, sx, sz); g.rotateX(-PI/2); g.translate(len/2, -0.06, 0);
  if(!lite){ var PA=g.attributes.position, sd=(pit.seed>>>0)%997; for(var q=0;q<PA.count;q++){ var qx=PA.getX(q), qz=PA.getZ(q), edge=Math.min(1,(BOG_W/2-Math.abs(qz))/0.8);
      PA.setY(q, -0.06+edge*(0.045*(fbm(qx/9+sd,qz/5,3,2,7)-0.5)+0.012*Math.sin(qx*1.7+qz*2.3+sd))+(1-edge)*0.05); } g.computeVertexNormals(); }
  BOG.mudGeo=g; BOG.mudBase=Float32Array.from(g.attributes.position.array); BOG.mudSx=sx; BOG.mudSz=sz; BOG.mudLen=len;
  var W=lite?512:1024, H=lite?64:128; if(!BOG.mudCv || BOG.mudCv.width!==W){ BOG.mudCv=newCanvas(W,H); if(BOG.mudTex) BOG.mudTex.dispose(); BOG.mudTex=new THREE.CanvasTexture(BOG.mudCv); BOG.mudTex.encoding=THREE.sRGBEncoding; BOG.mudTex.anisotropy=MAXANISO; }
  bogMudPaint(BOG.mudCv, len, +pit.cons||0.5, (pit.seed>>>0)%2147483646+1); BOG.mudTex.needsUpdate=true;
  BOG.mats.mud.map=BOG.mudTex; BOG.mats.mud.roughness=lerp(0.22,0.48,clamp(+pit.cons||0.5,0,1)); BOG.mats.mud.needsUpdate=true;
  BOG.mud=new THREE.Mesh(g, BOG.mats.mud); BOG.mud.receiveShadow=true; BOG.scene.add(BOG.mud);
  BOG.paintX=-1e9; BOG.rutDirty=0;
  /* the berms close in on the pit's length: scale the two long ones, slide the far end */
  if(BOG.berms){ BOG.berms.forEach(function(b){ b.scale.x=len+14; b.position.x=len/2; }); BOG.farBerm.position.x=len+16; BOG.farWall.position.x=len+13; }
  if(BOG.groundMat && BOG.groundMat.userData.uLen) BOG.groundMat.userData.uLen.value=len;
  if(BOG.marks) BOG.marks.forEach(function(m){ m.visible=m.userData.d<len; });
}
/* paint the wheel tracks into the map: dark wet stripes, churned edges, a smear where it stopped */
function bogMudTrack(x0, x1, half, w, k){
  var cv=BOG.mudCv; if(!cv) return; var c=cv.getContext("2d"), W=cv.width, H=cv.height, L=BOG.mudLen, a=Math.max(0,Math.min(L,x0)), b=Math.max(0,Math.min(L,x1)); if(b<=a) return;
  var px0=a/L*W, px1=b/L*W, zs=[-half, half];
  for(var i=0;i<2;i++){ var cy=(zs[i]/BOG_W+0.5)*H, hh=w/BOG_W*H;
    c.fillStyle="rgba(22,15,9,"+(0.28+0.4*k)+")"; c.fillRect(px0, cy-hh/2, px1-px0+1, hh);
    c.fillStyle="rgba(150,120,90,"+(0.05+0.08*k)+")"; c.fillRect(px0, cy-hh/2-2, px1-px0+1, 2); c.fillRect(px0, cy+hh/2, px1-px0+1, 2); }
  c.fillStyle="rgba(30,20,12,"+(0.1+0.1*k)+")"; c.fillRect(px0, H*0.5-half/BOG_W*H*0.6, px1-px0+1, half/BOG_W*H*1.2);
  BOG.mudTex.needsUpdate=true;
}
/* Full/Ultra: press the plane down where the tyres went; keep the deepest mark each vertex has had */
function bogMudRut(x, half, w, depth){
  if(!BOG.mudGeo || GFX==="lite") return;
  var P=BOG.mudGeo.attributes.position, A=P.array, sx=BOG.mudSx, sz=BOG.mudSz, L=BOG.mudLen, ix0=Math.max(0,Math.floor((x-1.4)/L*sx)), ix1=Math.min(sx,Math.ceil((x+0.6)/L*sx)), ch=false;
  for(var ix=ix0; ix<=ix1; ix++) for(var iz=0; iz<=sz; iz++){ var q=iz*(sx+1)+ix, zz=A[q*3+2], dz=Math.min(Math.abs(zz-half), Math.abs(zz+half));
    var f=dz<w*0.5?1:dz<w*0.5+0.5?0.5+0.5*Math.cos((dz-w*0.5)/0.5*PI):0, lip=dz>w*0.5&&dz<w*0.5+0.7?Math.sin((dz-w*0.5)/0.7*PI)*0.35:0;
    var y=-0.06-depth*f+depth*lip*(1-f); if(f>0 && y<A[q*3+1]){ A[q*3+1]=y; ch=true; } else if(lip>0 && f===0 && y>A[q*3+1] && A[q*3+1]>=-0.07){ A[q*3+1]=y; ch=true; } }
  if(ch){ P.needsUpdate=true; BOG.rutDirty++; }
}
function bogMudReset(){
  if(BOG.mudGeo && BOG.mudBase){ BOG.mudGeo.attributes.position.array.set(BOG.mudBase); BOG.mudGeo.attributes.position.needsUpdate=true; BOG.mudGeo.computeVertexNormals(); }
  BOG.mudKey="";   /* repaint the map next frame */
}
function bogAtlas(){
  var c=newCanvas(1024,256), x=c.getContext("2d"), F="'Chakra Petch','Arial Narrow',Arial,sans-serif", i;
  function panel(x0,y0,w,h,bg,fg,txt,sz,sub){ x.fillStyle=bg; x.fillRect(x0,y0,w,h); x.fillStyle=fg; x.font="700 "+sz+"px "+F; x.textAlign="center"; x.textBaseline="middle"; x.fillText(txt, x0+w/2, y0+h/2+2, w-16); if(sub){ x.fillStyle=sub; x.fillRect(x0,y0+h-7,w,5); } }
  panel(0,0,1024,62,"#15171b","#ff7a1a","PRAIRIE ENGINE WORKS · MUD BOG",40,"#ff7a1a");
  panel(0,64,340,60,"#ff7a1a","#15171b","PRAIRIE ENGINE WORKS",30,"#15171b"); panel(342,64,340,60,"#15171b","#ff7a1a","COULEE FUELS",40,"#ff7a1a"); panel(684,64,340,60,"#131416","#f2c22c","NORTHWIND TYRE",38,"#f2c22c");
  for(i=0;i<9;i++){ var bx=i*113; x.fillStyle="#15171b"; x.fillRect(bx,128,111,126); x.fillStyle=i%2?"#f4efe2":"#ff7a1a"; x.fillRect(bx+5,133,101,116); x.fillStyle="#15171b"; x.font="700 56px "+F; x.textAlign="center"; x.textBaseline="middle"; x.fillText(String((i+1)*10), bx+55, 180); x.font="700 18px "+F; x.fillText("METRES", bx+55, 228); }
  var t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=MAXANISO; return t;
}
var BOG_UV={ long:[0,1-62/256,1,1], ban:[[0,1-124/256,340/1024,1-64/256],[342/1024,1-124/256,682/1024,1-64/256],[684/1024,1-124/256,1,1-64/256]], mark:function(i){ return [i*113/1024, 1-254/256, (i*113+111)/1024, 1-128/256]; } };
function bogBuild(B, key, mat, shadow){ var keep=STRIP.scene; STRIP.scene=BOG.scene; var m=B.build(key, mat, shadow); STRIP.scene=keep; return m; }
function buildBogScene(){
  var S3=new THREE.Scene(); BOG.scene=S3; BOG.tier=GFX;
  var lite=(GFX==="lite"), i, k, side, x, z, M=BOG.mats;
  var rng=function(s){ var t=Math.sin(s*127.1+3.7)*43758.5453; return t-Math.floor(t); };
  if(!PULL.g) PULL.g={ box:new THREE.BoxGeometry(1,1,1), cyl:new THREE.CylinderGeometry(0.5,0.5,1,14), cyl8:new THREE.CylinderGeometry(0.5,0.5,1,8), sph:new THREE.SphereGeometry(0.5,12,8), plane:new THREE.PlaneGeometry(1,1).rotateX(-PI/2) };   /* the pull pickup's parts */
  var hemi=new THREE.HemisphereLight(0xcfdcf0, 0x6a5a3c, 0.3); S3.add(hemi); BOG.hemi=hemi;
  var sun=new THREE.DirectionalLight(0xffe6c4, 1.45); sun.shadow.mapSize.set(2048,2048);
  var shc=sun.shadow.camera; shc.left=-24; shc.right=24; shc.top=24; shc.bottom=-24; shc.near=1; shc.far=260; sun.shadow.bias=-0.0006; sun.shadow.normalBias=0.03;
  S3.add(sun); S3.add(sun.target); BOG.sun=sun;
  var flood=new THREE.DirectionalLight(0xfff2dc, 0); flood.position.set(0,40,30); S3.add(flood); S3.add(flood.target); BOG.flood=flood;
  var sky=new THREE.Mesh(new THREE.SphereGeometry(2600, 40, 20), stripSkyMat()); sky.frustumCulled=false; sky.renderOrder=-10; S3.add(sky); BOG.sky=sky;
  S3.fog=new THREE.Fog(0xffffff, 150, 2700); BOG.fog=S3.fog;
  var uLen={value:75}, gm=stripSurfMat(BOG_GLSL_GROUND, null, {uLen:uLen}); gm.userData.uLen=uLen; gm.customProgramCacheKey=function(){ return "bog_ground"; }; BOG.groundMat=gm;
  var ground=new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), gm); ground.rotation.x=-PI/2; ground.position.set(40,-0.02,0); ground.receiveShadow=true; S3.add(ground);
  /* the pit's walls: a dark box under the mud so a deep rut never shows the sky */
  var well=new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardMaterial({color:sc(0x1c140c), roughness:1, side:THREE.BackSide})); well.scale.set(200,1.4,BOG_W); well.position.set(60,-0.78,0); S3.add(well); BOG.well=well;
  (function(){ var seg=120, R0=1900, pos=[], col=[], idx=[], c1=sc(0x5d6a4a), c2=sc(0x7d8a70);
    for(var s=0;s<=seg;s++){ var a=s/seg*TAU, hgt=Math.max(5, 14+34*Math.pow(0.5+0.5*Math.sin(a*3.0+1.4),2)+18*Math.sin(a*11.0+0.4)*Math.sin(a*5.0)+10*Math.sin(a*23.0));
      pos.push(40+Math.cos(a)*(R0-500),-2,Math.sin(a)*(R0-500), 40+Math.cos(a)*R0,hgt,Math.sin(a)*R0, 40+Math.cos(a)*(R0+400),hgt*0.6,Math.sin(a)*(R0+400)); col.push(c1.r,c1.g,c1.b, c2.r,c2.g,c2.b, c2.r,c2.g,c2.b); }
    for(s=0;s<seg;s++){ var a0=s*3, b0=(s+1)*3; idx.push(a0,b0,a0+1, b0,b0+1,a0+1, a0+1,b0+1,a0+2, b0+1,b0+2,a0+2); }
    var g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); g.setAttribute("color",new THREE.Float32BufferAttribute(col,3)); g.setIndex(idx); g.computeVertexNormals();
    var hm=new THREE.Mesh(g, new THREE.MeshStandardMaterial({vertexColors:true, roughness:1, side:THREE.DoubleSide})); hm.frustumCulled=false; S3.add(hm); })();
  M.solid=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.86});
  M.metal=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.42, metalness:0.65});
  M.lamp=new THREE.MeshBasicMaterial({vertexColors:true, toneMapped:false, color:0x777777});
  M.beam=new THREE.MeshBasicMaterial({vertexColors:true, transparent:true, opacity:0.0, depthWrite:false, blending:THREE.AdditiveBlending, fog:true, side:THREE.DoubleSide});
  M.sign=new THREE.MeshStandardMaterial({map:bogAtlas(), roughness:0.72});
  M.dirt=new THREE.MeshStandardMaterial({color:sc(0x5a4029), roughness:1});
  M.mud=new THREE.MeshStandardMaterial({color:0xb0a090, roughness:0.3, metalness:0.0, envMapIntensity:0.45});
  bogMudWet(M.mud);
  var B=new StripBatch(), STEEL=0x8d9296, ALU=0xb9bec4, DARK=0x2a2c2f, RUB=0x1a1a1c;
  /* berms: long dirt banks both sides (scaled to the night's pit), one across the far end, a tyre wall in front of it */
  BOG.berms=[]; [-1,1].forEach(function(sd){ var m=new THREE.Mesh(sbGeo().prism, M.dirt); m.scale.set(84,1.8,3.4); m.position.set(35,-0.05,sd*(BOG_W/2+1.9)); m.castShadow=!lite; m.receiveShadow=true; S3.add(m); BOG.berms.push(m); });
  var fb=new THREE.Mesh(sbGeo().prism, M.dirt); fb.scale.set(22,4.2,6); fb.rotation.y=PI/2; fb.position.set(91,-0.05,0); fb.castShadow=!lite; fb.receiveShadow=true; S3.add(fb); BOG.farBerm=fb;
  var tw=new THREE.Group(); for(z=-6; z<=6.1; z+=0.8) for(k=0;k<3;k++){ var tyre=new THREE.Mesh(PULL.g.cyl8, new THREE.MeshStandardMaterial({color:sc(RUB), roughness:0.95})); tyre.scale.set(0.72,0.3,0.72); tyre.position.set((k&1)?0.35:0, 0.17+k*0.3, z); tw.add(tyre); }
  tw.position.set(88,0,0); S3.add(tw); BOG.farWall=tw;
  /* pipe rail along the crowd side, banners on it, distance boards on the far side every 10 m */
  for(x=-30; x<110; x+=3){ B.add("metal","cyl6",[x, 0.55, -BOG_W/2-3.6],[0.07,1.1,0.07],STEEL); }
  B.add("metal","cyl6",[40, 1.08, -BOG_W/2-3.6],[0.06,140,0.06],ALU,[0,0,PI/2]); B.add("metal","cyl6",[40, 0.6, -BOG_W/2-3.6],[0.06,140,0.06],ALU,[0,0,PI/2]);
  for(x=-24, k=0; x<104; x+=9, k++) B.add("sign","plane",[x, 0.82, -BOG_W/2-3.55],[5.4,0.62,1],0xffffff,[0,0,0],BOG_UV.ban[k%3]);
  BOG.marks=[]; var markIt=function(i2){ var mx=(i2+1)*10, mz=BOG_W/2+4.4, gp=new THREE.Group(); gp.userData.d=mx;
    var post=new THREE.Mesh(PULL.g.cyl8, new THREE.MeshStandardMaterial({color:sc(STEEL), roughness:0.5, metalness:0.6})); post.scale.set(0.1,2.4,0.1); post.position.y=1.2; gp.add(post);
    var pg=new THREE.PlaneGeometry(1.2,1.36), uv=pg.attributes.uv, r4=BOG_UV.mark(i2); for(var q=0;q<uv.count;q++) uv.setXY(q, r4[0]+uv.getX(q)*(r4[2]-r4[0]), r4[1]+uv.getY(q)*(r4[3]-r4[1]));
    var bd=new THREE.Mesh(pg, M.sign); bd.position.set(0,2.5,-0.06); bd.rotation.y=PI; gp.add(bd); gp.position.set(mx,0,mz); gp.rotation.y=-0.35; S3.add(gp); BOG.marks.push(gp); };
  for(i=0;i<9;i++) markIt(i);
  /* the bank on the crowd side: a grass slope behind the rail, the crowd on it, pickups parked along the top */
  var bank=new THREE.Mesh(sbGeo().prism, new THREE.MeshStandardMaterial({color:sc(0x3d4a24), roughness:1})); bank.scale.set(150,3.4,16); bank.position.set(40,-0.05,-BOG_W/2-12.5); S3.add(bank); bank.receiveShadow=true;
  var hcol=[0xe9e6dc,0x1b1d20,0x9e2a22,0x22488f,0xd0d3d6,0x2c6b3a,0xff7a1a,0x6b6f74];
  for(i=0;i<12;i++){ var hx=-26+i*11+rng(i)*4, hz=-BOG_W/2-25-rng(i+3)*4, cc=hcol[i%hcol.length];
    B.box("solid", hx, 1.05, hz, 5.2, 0.9, 2.0, cc, 0.08*(rng(i+7)-0.5)); B.box("solid", hx+0.9, 1.75, hz, 2.0, 0.7, 1.85, 0x22262b, 0.08*(rng(i+7)-0.5)); B.box("solid", hx, 0.35, hz, 4.6, 0.5, 1.9, 0x161718); }
  /* light poles: four on each side */
  BOG.poles=[]; [[-14,-BOG_W/2-8],[20,-BOG_W/2-8],[54,-BOG_W/2-8],[88,-BOG_W/2-8],[-4,BOG_W/2+10],[30,BOG_W/2+10],[64,BOG_W/2+10],[96,BOG_W/2+10]].forEach(function(pp){
    var px=pp[0], pz=pp[1], H=pz<0?18:16, s2=pz<0?1:-1;
    B.add("metal","cyl",[px, H/2, pz],[0.36,H,0.36],0x9aa0a6); B.box("metal", px, H+0.2, pz, 3.2, 0.22, 0.28, 0x80868c);
    for(k=0;k<3;k++){ var lx=px-1.0+k; B.box("metal", lx, H+0.65, pz+s2*0.12, 0.74, 0.62, 0.36, 0x5a5f65); B.box("lamp", lx, H+0.65, pz+s2*0.31, 0.6, 0.5, 0.02, 0xfff0d0); }
    B.add("beam","beam",[px, H/2, pz+s2*H*0.18],[6,H,6],0xffe8c0,[-s2*0.36,0,0]);
    BOG.poles.push(new THREE.Vector3(px, H+0.8, pz)); });
  /* announcer's trailer and a food truck behind the far side */
  B.box("solid", 44, 1.6, BOG_W/2+16, 7, 2.6, 2.6, 0xe7e2d6); B.box("solid", 44, 3.05, BOG_W/2+16, 7.3, 0.25, 2.9, 0x2a2c2f); B.add("sign","plane",[44, 2.2, BOG_W/2+14.68],[6.4,0.6,1],0xffffff,[0,PI,0],BOG_UV.long);
  B.box("solid", 70, 1.4, BOG_W/2+15, 5, 2.4, 2.3, 0x9e2a22); B.box("solid", 70, 2.75, BOG_W/2+15, 5.2, 0.2, 2.5, 0xf1ede2);
  /* sheds and a grain elevator off in the distance */
  B.box("solid", 150, 12, -150, 12, 24, 12, 0x8e2f23, 0.3); B.add("solid","prism",[150,24,-150],[12.4,3.4,12.4],0x4a4644,[0,0.3,0]);
  B.box("solid", -80, 3.5, 120, 20, 7, 12, 0x9a2e22, 0.4); B.add("solid","prism",[-80,7,120],[20.4,3,12.6],0x5a5a5a,[0,0.4,0]);
  bogBuild(B,"solid", M.solid, !lite); bogBuild(B,"metal", M.metal, !lite); BOG.lampMesh=bogBuild(B,"lamp", M.lamp, false); bogBuild(B,"sign", M.sign, false);
  BOG.beamMesh=bogBuild(B,"beam", M.beam, false); if(BOG.beamMesh){ BOG.beamMesh.receiveShadow=false; BOG.beamMesh.visible=false; BOG.beamMesh.renderOrder=4; }
  /* shelterbelt */
  (function(){ var pts=[], s;
    for(s=0;s<60;s++){ var a=s/60*TAU, R=150+rng(s)*30; pts.push([40+Math.cos(a)*R*1.3, Math.sin(a)*R, 4+rng(s+3)*3]); }
    var im=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0), new THREE.MeshStandardMaterial({roughness:1}), pts.length), mm=new THREE.Matrix4(), cc=new THREE.Color();
    pts.forEach(function(p,q){ var h=p[2]*1.6; mm.compose(_sbP.set(p[0],h*0.8,p[1]), _sbQ.set(0,0,0,1), _sbS.set(p[2],h,p[2])); im.setMatrixAt(q,mm); cc.setHSL(0.24+rng(q)*0.06, 0.45, 0.13+rng(q+1)*0.06).convertSRGBToLinear(); im.setColorAt(q,cc); });
    S3.add(im); })();
  /* the crowd on the bank: standing, some on lawn chairs, thinner on Lite */
  (function(){ var ppl=[], occ=lite?0.35:0.6, slope=1.7/8;
    for(var r=0;r<8;r++){ var rz=-BOG_W/2-4.6-r*1.0, ry=Math.max(0,-BOG_W/2-4.5-rz)*slope;
      for(var xx=-22; xx<104; xx+=0.62){ if(rng(xx*3.1+r*17.7)>occ*(1-r*0.06)) continue; ppl.push([xx+(rng(xx+r)-0.5)*0.3, ry, rz+(rng(xx*1.7+r)-0.5)*0.4]); } }
    var n=ppl.length, bodyM=new THREE.InstancedMesh(new THREE.BoxGeometry(0.46,0.8,0.32), new THREE.MeshStandardMaterial({roughness:0.95}), n),
        headM=new THREE.InstancedMesh(new THREE.BoxGeometry(0.22,0.25,0.22), new THREE.MeshStandardMaterial({roughness:0.9}), n);
    var shirts=[0x9c3a30,0x34598f,0xcfccc4,0x1f2023,0x2a2c30,0xff7a1a,0x44684a,0xc8a640,0x5d5f66,0x7a7f86,0x3a3d44,0x8f4a5e,0x2c6b3a], skin=[0xe0b494,0xc68a64,0x8d5a3b,0xf0c9a8,0x5a3a26], hats=[0x1d4787,0xff7a1a,0x222222,0xe9e6dc,0x2c6b3a,0x9e2a22];
    var mm=new THREE.Matrix4(), cc=new THREE.Color(), base=[];
    for(var s=0;s<n;s++){ var p=ppl[s]; mm.makeTranslation(p[0],p[1]+0.4,p[2]); bodyM.setMatrixAt(s,mm); mm.makeTranslation(p[0],p[1]+0.93,p[2]); headM.setMatrixAt(s,mm);
      cc.set(shirts[Math.floor(rng(s*1.3)*shirts.length)]).convertSRGBToLinear(); bodyM.setColorAt(s,cc);
      cc.set(rng(s*2.9)<0.45?hats[Math.floor(rng(s*4.1)*hats.length)]:skin[Math.floor(rng(s*3.7)*skin.length)]).convertSRGBToLinear(); headM.setColorAt(s,cc); base.push(p); }
    bodyM.receiveShadow=true; S3.add(bodyM); S3.add(headM);
    BOG.crowd={body:bodyM, head:headM, base:base, n:n, phase:base.map(function(p,q){ return rng(q*9.1)*TAU; }), excite:base.map(function(p,q){ return rng(q*5.3); }), live:false}; })();
  /* mud: the plane is built per night; clods (lit, sharp), spray and splash mist (soft, Full/Ultra only), exhaust */
  BOG.fx=new StripFx(lite?150:700, "fire", stripFlameTex(true)); BOG.fx.mat.blending=THREE.NormalBlending; S3.add(BOG.fx.mesh);
  BOG.fxSpray=lite?null:new StripFx(GFX==="ultra"?420:260, "smoke", stripPuffTex()); if(BOG.fxSpray) S3.add(BOG.fxSpray.mesh);
  BOG.cam=new THREE.PerspectiveCamera(46, 1, 0.3, 3600); BOG.built=true;
  BOG.night=null; bogSetNight(false);
}
/* wet mud by day: the material is darker and browner in daylight, and on Full/Ultra (MUD_VAR) a world-space noise breaks it
   into broad tonal patches with glossy wet slicks between matte crust, so it still reads as mud from the stands. Lite keeps
   the plain material (only its colour and gloss change: no extra shader work). Night uses the original look (uDay 0). */
function bogMudWet(m){
  var uDay={value:0}; m.userData.uDay=uDay;
  m.onBeforeCompile=function(sh){ sh.uniforms.uMudDay=uDay;
    sh.vertexShader=sh.vertexShader.replace("#include <common>", "#include <common>\n#ifdef MUD_VAR\nvarying vec2 vMw;\n#endif").replace("#include <project_vertex>", "#include <project_vertex>\n#ifdef MUD_VAR\nvMw=(modelMatrix*vec4(transformed,1.0)).xz;\n#endif");
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uMudDay;\n#ifdef MUD_VAR\nvarying vec2 vMw;\n"+STRIP_GLSL_NOISE+"\n#endif")
      .replace("#include <color_fragment>", "#include <color_fragment>\n#ifdef MUD_VAR\nfloat mTone=sn(vMw*0.33)*0.65+sn(vMw*1.6+3.1)*0.35, mWet=smoothstep(0.42,0.68,sn(vMw*0.55+vec2(7.0,2.0)));\ndiffuseColor.rgb*=mix(1.0,(0.74+0.5*mTone)*(1.0-0.16*mWet),uMudDay);\n#endif")
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n#ifdef MUD_VAR\nroughnessFactor*=mix(1.0,mix(1.3,0.42,mWet),uMudDay);\n#endif");
  };
  m.customProgramCacheKey=function(){ return "bog_mud"+(m.defines&&m.defines.MUD_VAR!==undefined?"_v":""); };
}
function bogMudLook(on, lite){
  var m=BOG.mats&&BOG.mats.mud; if(!m||!m.userData.uDay) return; m.userData.uDay.value=on?0:1;
  m.color.set(on?0xb0a090:0x84644a);           /* by day: darker, browner (the sun is 10x the floods and washed it to grey) */
  m.envMapIntensity=on?0.45:0.32;               /* less grey sky in the sheen; the sun still glints off it */
  var v=!lite; if(v!==(m.defines&&m.defines.MUD_VAR!==undefined)){ m.defines=v?{MUD_VAR:""}:{}; m.needsUpdate=true; }
}
function bogSetNight(on){
  on=!!on; var tierChanged=BOG.tier!==GFX; if(BOG.night===on && !tierChanged) return;
  BOG.night=on; BOG.tier=GFX; var S3=BOG.scene, lite=(GFX==="lite"), M=BOG.mats;
  BOG.sky.material.uniforms.uNight.value=on?1:0;
  var h=on?STRIP_HOR_N:STRIP_HOR; BOG.horLin=new THREE.Color(h[0],h[1],h[2]);
  BOG.sunDir=(on?STRIP_MOON:STRIP_SUN_DAY);
  BOG.sun.color.set(on?0x9fb2d6:0xffe2bc); BOG.sun.intensity=on?0.14:1.45; BOG.sun.castShadow=!lite;
  BOG.hemi.intensity=on?0.14:0.2; BOG.hemi.color.set(on?0x3a4764:0xcfdcf0); BOG.hemi.groundColor.set(on?0x16130e:0x6a5a3c);
  BOG.flood.intensity=on?(lite?0.6:0.28):0;
  M.lamp.color.set(on?0xffffff:0x5e5e5e);
  bogMudLook(on, lite);
  if(BOG.beamMesh){ BOG.beamMesh.visible=on; M.beam.opacity=on?0.014:0; }
  S3.environment=stripEnv(on); BOG.exposure=on?1.0:0.9;
  [BOG.fx, BOG.fxSpray].forEach(function(F){ if(F){ F.mat.uniforms.uAmb.value=F===BOG.fx?1:(on?0.45:1); F.mat.uniforms.uFogN.value=S3.fog.near; F.mat.uniforms.uFogF.value=S3.fog.far; } });
  if(tierChanged && BOG.sun.shadow.map){ BOG.sun.shadow.map.dispose(); BOG.sun.shadow.map=null; }
  BOG.spots.forEach(function(sp){ S3.remove(sp); S3.remove(sp.target); if(sp.shadow&&sp.shadow.map) sp.shadow.map.dispose(); }); BOG.spots=[];
  if(on){ for(var i=0;i<(lite?2:3);i++){ var sp=new THREE.SpotLight(0xfff0d8, 1.6, 120, 0.62, 0.6, 1.5); sp.castShadow=!lite && i===0; if(sp.castShadow){ sp.shadow.mapSize.set(1024,1024); sp.shadow.bias=-0.002; sp.shadow.normalBias=0.05; sp.shadow.camera.near=4; sp.shadow.camera.far=120; }
    S3.add(sp); S3.add(sp.target); BOG.spots.push(sp); } }
}
/* the truck per class: the pull pickup, its tyres swapped (mud-terrain cut lugs, swampers, paddles) and the whole thing scaled up on the bigger tyres */
var BOG_LOOK={ street:{k:1.0, tyre:"cut", col:0x1d4787}, modified:{k:1.1, tyre:"ag", col:0xb7261d}, super:{k:1.22, tyre:"paddle", col:0x2c6b3a} };
function bogVehicle(cls, tyre, color){
  var L=BOG_LOOK[cls]||BOG_LOOK.street, kind=tyre==="paddle"?"paddle":tyre==="swamp"?"ag":"cut", V=pullVehicle("truck", color), U=V.userData;
  [U.wheelsR, U.wheelsF].forEach(function(arr){ arr.forEach(function(sp){ var cont=sp.children[0], ty=cont&&cont.children[0]; if(ty && kind!=="cut") ty.geometry=pullTyreGeo(U.rr, U.wr*(kind==="paddle"?1.12:1.05), 0.27, kind); }); });
  V.scale.setScalar(L.k); U.k=L.k; U.paint0=U.mats.paint.color.clone(); U.cls=cls; return V;
}
function bogEffects(o, dt, V){
  var U=V.userData, FX=BOG.fx, FS=BOG.fxSpray, lite=GFX==="lite", rate=lite?0.4:1, ph=o.phase||"stage", R=Math.random, i, t;
  var v=Math.max(0,+o.v||0), ws=Math.max(v,+o.wspd||0), spin=Math.max(0, ws-v), inPit=ph==="pit"||(ph==="done"&&+o.x>0&&+o.x<+o.len), sink=clamp(+o.sink||0,0,1.2), k=U.k||1;
  var mc=o.cons>0.5?[0.13,0.095,0.065]:[0.16,0.1,0.055];
  if(inPit && ph!=="done"){
    /* rooster tails: off the back of every tyre, as high and as thick as the spin; clods fall, spray hangs */
    var amt=(clamp(spin/5,0,1.5)+clamp(v/25,0,0.5))*clamp(0.5+sink*2,0.5,1.5), axl=[0, U.wb*k];
    for(t=0;t<4;t++){ var s=(t&1)?1:-1, ax=V.position.x+axl[t>>1]-U.rr*k*0.5, front=t>=2, kk=front?0.65:1;
      var nc=amt*kk*rate*(lite?60:190)*dt, n=Math.floor(nc)+(R()<nc%1?1:0);
      for(i=0;i<n;i++){ var up=3+R()*7*(0.35+amt*0.6), back=2.5+spin*(0.35+R()*0.5), sh=0.75+R()*0.5;
        FX.emit(ax-R()*0.3, U.rr*k*(0.4+R()*0.7)+V.position.y, s*U.trR*k+(R()-0.5)*U.wr*k, v*0.5-back, up, s*(0.3+R()*1.8), 0.9+R()*0.9, 0.2+R()*0.25, 0.32+R()*0.35, mc[0]*sh, mc[1]*sh, mc[2]*sh, 1, {drag:0.15, grav:9.8, fin:0.01, spin:5}); }
      if(FS){ var ns=amt*kk*rate*20*dt, m2=Math.floor(ns)+(R()<ns%1?1:0);
        for(i=0;i<m2;i++) FS.emit(ax-0.6, U.rr*k*0.9+V.position.y, s*U.trR*k, v*0.4-2.5-spin*0.5*R(), 2.5+R()*4*amt, s*R()*1.2, 0.8+R()*0.6, 0.35, 1.0+R()*0.9, mc[0]*1.6, mc[1]*1.6, mc[2]*1.6, 0.38, {drag:0.5, grav:4, fin:0.05, spin:0.8}); } }
    /* bow wave: mud pushed up ahead of the front tyres at speed */
    var bw=clamp(v/10,0,1.2)*clamp(sink*2,0,1.2), nb=bw*rate*(lite?14:40)*dt, mb=Math.floor(nb)+(R()<nb%1?1:0), fxp=V.position.x+(U.wb+U.rr*0.9)*k;
    for(i=0;i<mb;i++){ var sd=R()<0.5?-1:1; FX.emit(fxp, 0.1, sd*(U.trR*k+0.2+R()*0.6), v*0.7, 1+R()*2.5*bw, sd*(1+R()*2.5), 0.6+R()*0.5, 0.12, 0.22, mc[0], mc[1], mc[2], 1, {drag:0.3, grav:9.8, fin:0.01, spin:4}); }
  }
  /* splashes: the pit entry, a landing, a rut — one burst */
  if(BOG.splash>0){ var nsp=Math.round(BOG.splash*(lite?14:46)); for(i=0;i<nsp;i++){ var a=R()*TAU, sp2=2+R()*5*BOG.splash; FX.emit(V.position.x+(U.wb*0.5)*k+(R()-0.5)*3, 0.15, Math.sin(a)*1.6, v*0.6+Math.cos(a)*sp2, 2.5+R()*5*BOG.splash, Math.sin(a)*sp2, 0.9+R()*0.7, 0.14, 0.3, mc[0], mc[1], mc[2], 1, {drag:0.2, grav:9.8, fin:0.01, spin:5}); }
    if(FS) for(i=0;i<nsp*0.4;i++) FS.emit(V.position.x+(U.wb*0.5)*k+(R()-0.5)*4, 0.6, (R()-0.5)*4, v*0.5, 1+R()*2, (R()-0.5)*2, 1.6+R(), 1.2, 3.2+R()*1.5, mc[0]*1.3, mc[1]*1.3, mc[2]*1.3, 0.45, {drag:0.6, grav:1.2, fin:0.05, spin:0.4});
    BOG.splash=0; }
  /* exhaust: a diesel's black smoke out the stacks, a whisp otherwise */
  var smk=clamp(+o.smoke||0,0,1), ne=(lite?6:14)*(0.15+smk)*(+o.throttle||0)*dt*(o.failed?0:1);
  for(t=0;t<U.tips.length;t++){ var nn=Math.floor(ne)+(R()<ne%1?1:0); if(!nn) continue; U.body.localToWorld(_bA.copy(U.tips[t]));
    for(i=0;i<nn;i++){ var c=lerp(0.42,0.04,Math.pow(smk,0.7)); (FS||FX).emit(_bA.x, _bA.y, _bA.z, v-0.6, 2.4+smk*2, (R()-0.5)*0.5, 1.8+R(), 0.25, 1.6+smk*3, c, c, c, 0.2+0.5*smk, {drag:0.7, buoy:0.15, fin:0.03, spin:0.5}); } }
  FX.step(dt, BOG_WIND); if(FS) FS.step(dt, BOG_WIND);
}
function bogCrowd(dt){
  var C=BOG.crowd; if(!C) return; BOG.cheer=Math.max(0,BOG.cheer-dt*0.3);
  if(BOG.cheer<0.02 && !C.live) return;
  var t=BOG.t, amp=BOG.cheer, i, m=_pM;
  for(i=0;i<C.n;i++){ var p=C.base[i], e=C.excite[i], y=amp>0.02&&e>(amp>1?0.05:0.4)?Math.abs(Math.sin(t*(amp>1?9:7)+C.phase[i]))*0.18*Math.min(amp,2)*e:0;
    m.makeTranslation(p[0],p[1]+0.4+y,p[2]); C.body.setMatrixAt(i,m); m.makeTranslation(p[0],p[1]+0.93+y*1.15,p[2]); C.head.setMatrixAt(i,m); }
  C.body.instanceMatrix.needsUpdate=true; C.head.instanceMatrix.needsUpdate=true; C.live=BOG.cheer>=0.02;
}
function bogCut(name){ if(BOG.shot!==name){ BOG.shot=name; BOG.shotT=0; BOG.cutT=0; BOG.snap=true; } }
function bogDirect(o, dt, V){
  var ph=o.phase||"stage", v=Math.max(0,+o.v||0), U=V.userData, k=U.k||1, fx=+o.x||0, len=+o.len||70, cx=V.position.x+U.wb*k*0.5, s=BOG.shot;
  if(o.shot) s=o.shot;
  else if(BOG.skip||ph==="done") s=(s==="front"&&BOG.doneT<1.2)?"front":"stop";
  else if(ph==="stage") s="stage";
  else if(ph==="runup") s=fx<-12?"chase":"entry";
  else { if(s!=="side"&&s!=="front"&&s!=="high") s="side";
    if(s==="side" && BOG.shotT>2.6 && fx<len-14 && v>2) s="front";
    else if(s==="front" && (BOG.fixX-fx<4 || BOG.shotT>3.4)) s=GFX==="lite"?"side":"high";
    else if(s==="high" && BOG.shotT>2.6) s="side"; }
  if(s!==BOG.shot){ if(s==="front") BOG.fixX=Math.min(len+5, fx+7+v*0.9); }
  bogCut(s); BOG.shotT+=dt; BOG.cutT+=dt; var T=BOG.shotT, fov=46, rel=false, ax=0, sm=0;
  switch(s){
    case "stage": { var push=Math.min(2.2,T*0.2); _bw.set(cx-8+push, 2.4, 5.6-push*0.4); _bt.set(cx+14, 0.8, -0.6); fov=48; break; }
    case "chase": rel=true; ax=cx; _bw.set(-9.5, 2.6, 2.2); _bt.set(6, 1.0, 0); fov=50; sm=4; break;
    case "entry": _bw.set(3, 2.4, -BOG_W/2-4.2); _bt.set(cx+1, 0.9, 0); fov=50; break;
    case "side": rel=true; ax=cx; _bw.set(-2, 5.2, -BOG_W/2-7.5); _bt.set(1.2, 0.6, 0); fov=48; sm=3; break;
    case "front": _bw.set(BOG.fixX, 1.0, 2.4); _bt.set(cx, 1.3, 0); fov=38; BOG.shake=Math.max(BOG.shake, 0.04*clamp(+o.slip||0,0,1)); break;
    case "high": rel=true; ax=cx; _bw.set(-7, 9, 9); _bt.set(4, 0, -1); fov=46; sm=2; break;
    case "stop": { var dr=Math.min(3,T*0.25); _bw.set(cx-7+dr, 3.2-dr*0.2, -7.5+dr*0.4); _bt.set(cx+2, 0.8, 0); fov=40; break; }
  }
  if(rel){ if(BOG.snap||!BOG.relOn){ _br.copy(_bw); _brt.copy(_bt); } else { var kk=1-Math.exp(-sm*dt); _br.lerp(_bw,kk); _brt.lerp(_bt,kk); }
    _bw.copy(_br); _bt.copy(_brt); _bw.x+=ax; _bt.x+=ax; BOG.relOn=true; } else BOG.relOn=false;
  if(BOG.snap){ BOG.fov=fov; BOG.snap=false; BOG.camTgt.copy(_bt); } else BOG.fov+=(fov-BOG.fov)*(1-Math.exp(-6*dt));
  BOG.camPos.copy(_bw); if(rel) BOG.camTgt.copy(_bt); else BOG.camTgt.lerp(_bt, 1-Math.exp(-8*dt));
  BOG.shake*=Math.exp(-dt*3.5); var sh=BOG.shake; if(sh>0.002){ BOG.camPos.x+=(Math.random()-0.5)*sh*0.25; BOG.camPos.y+=(Math.random()-0.5)*sh*0.25; }
  var cam=BOG.cam; cam.position.copy(BOG.camPos); cam.lookAt(BOG.camTgt); cam.fov=BOG.fov; cam.updateProjectionMatrix(); bandLens(cam);
}
function bogComposer(){
  if(BOG.composer===false) return null;
  var sz=renderer.getSize(new THREE.Vector2()), pr=renderer.getPixelRatio(), C=BOG.composer;
  if(!C){ try{ C=new THREE.EffectComposer(renderer); C.addPass(new THREE.RenderPass(BOG.scene, BOG.cam));
      var bp=new THREE.UnrealBloomPass(new THREE.Vector2(Math.max(1,sz.x*pr/2), Math.max(1,sz.y*pr/2)), 0.3, 0.4, 0.9); C.addPass(bp); BOG.bloom=bp;
      if(THREE.GammaCorrectionShader) C.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
      BOG.composer=C; BOG.cSize=""; }catch(e){ BOG.composer=false; return null; } }
  var key=sz.x+"x"+sz.y+"@"+pr; if(BOG.cSize!==key){ if(C.setPixelRatio) C.setPixelRatio(pr); C.setSize(sz.x, sz.y); BOG.cSize=key; }
  var n=!!BOG.night, b=BOG.bloom; b.strength=n?0.6:0.22; b.threshold=n?0.72:0.92; b.radius=n?0.5:0.4;
  return C;
}
function bogRender(){
  var S3=BOG.scene, cam=BOG.cam; if(!S3||!cam) return;
  var C=(GFX!=="lite" && THREE.EffectComposer && THREE.UnrealBloomPass && THREE.RenderPass && THREE.ShaderPass) ? bogComposer() : null;
  if(C) S3.fog.color.copy(BOG.horLin); else S3.fog.color.copy(BOG.horLin).convertLinearToSRGB();
  BOG.sky.position.copy(cam.position);
  [BOG.fx, BOG.fxSpray].forEach(function(F){ if(F) F.mat.uniforms.uFog.value.copy(BOG.horLin); });
  var ex=renderer.toneMappingExposure; renderer.toneMappingExposure=BOG.exposure;
  var inf=renderer.info, ar=inf.autoReset; inf.autoReset=false; inf.reset();
  if(C) C.render(); else renderer.render(S3, cam);
  BOG.stats={calls:inf.render.calls, tris:inf.render.triangles, tier:GFX, shot:BOG.shot, parts:BOG.fx.P.length+(BOG.fxSpray?BOG.fxSpray.P.length:0)}; inf.autoReset=ar;
  renderer.toneMappingExposure=ex;
}
function bogReset(){
  [BOG.fx, BOG.fxSpray].forEach(function(F){ if(F) F.clear(); });
  BOG.shot=null; BOG.prev={}; BOG.vsink=0; BOG.shake=0; BOG.cheer=0; BOG.skip=false; BOG.doneT=0; BOG.splash=0; BOG.coat=0; BOG.pitch=0; BOG.pv=0; BOG.lastHz=0;
  if(BOG.crowd && BOG.crowd.live){ BOG.cheer=0; bogCrowd(0); }
  if(BOG.cur){ var U=BOG.cur.userData; if(U.paint0) U.mats.paint.color.copy(U.paint0); }
  bogMudReset();
}
function bogUpdate(o, dt){
  if(!BOG.built) buildBogScene();
  var S3=BOG.scene; BOG.t+=dt;
  if(BOG.tier!==GFX || BOG.night!==!!o.night){ var tc=BOG.tier!==GFX; bogSetNight(!!o.night); if(tc){ BOG.mudKey=""; if(BOG.fxSpray===null && GFX!=="lite"){ BOG.fxSpray=new StripFx(GFX==="ultra"?420:260, "smoke", stripPuffTex()); S3.add(BOG.fxSpray.mesh); bogSetNight(!!o.night); } } }
  var ph=o.phase||"stage";
  if(ph==="stage" && BOG.prev.phase && BOG.prev.phase!=="stage") bogReset();
  if(o.pit) bogMudBuild(o.pit);
  var cls=BOG_LOOK[o.cls]?o.cls:"street", ty=o.tyre||"mt", col=o.color!=null?o.color:BOG_LOOK[cls].col, vk=cls+":"+ty+":"+col;
  if(!BOG.veh[vk]){ BOG.veh[vk]=bogVehicle(cls, ty, col); S3.add(BOG.veh[vk]); }
  for(var kk in BOG.veh) BOG.veh[kk].visible=(kk===vk);
  var V=BOG.veh[vk], U=V.userData, k=U.k||1; if(BOG.cur!==V){ BOG.cur=V; } pullLivery(U);
  var x=+o.x||0, v=Math.max(0,+o.v||0), slip=clamp(+o.slip||0,0,1), sink=clamp(+o.sink||0,0,1.4), len=+o.len||(o.pit&&o.pit.len)||70, i;
  if(ph==="done") BOG.doneT+=dt;
  if(ph==="pit" && BOG.prev.phase==="runup"){ BOG.splash=Math.max(BOG.splash, 0.6+Math.min(1,v/12)); BOG.cheer=Math.max(BOG.cheer,1.2); BOG.shake=Math.max(BOG.shake,0.12); }
  if(o.cleared && !BOG.prev.cleared){ BOG.cheer=2.4; }
  if(ph==="done" && BOG.prev.phase==="pit" && !o.cleared) BOG.cheer=Math.max(BOG.cheer,0.8);
  if((+o.slap||0)>0){ BOG.splash=Math.max(BOG.splash, Math.min(1.5,+o.slap)); BOG.shake=Math.max(BOG.shake, 0.08*Math.min(1.5,+o.slap)); }
  /* the truck: front axle at x, sunk by the sim's sinkage, thrown by its bounce; pitch follows the depth under each axle and the bounce */
  var vsink=Math.min(U.rr*k*0.62, Math.max(sink*1.3, (ph==="pit"?0.42*Math.max(+o.dFront||0,+o.dRear||0):0)));   /* down to the hubs in the deep end */
  BOG.vsink=(BOG.vsink||0)+(vsink-(BOG.vsink||0))*Math.min(1,dt*5);
  V.position.set(x-U.wb*k, -BOG.vsink+Math.max(0,+o.y||0), 0);
  var tgt=clamp(-(+o.vy||0)*0.05, -0.12, 0.14)+clamp((+o.dRear||0)-(+o.dFront||0),-0.4,0.4)*0.25+0.01*slip*(ph==="pit"?1:0)+(ph!=="stage"&&ph!=="done"?Math.sin(BOG.t*8.0)*0.006*slip:0);
  var n=Math.min(8, Math.ceil(dt/0.01)), h=n?dt/n:0, om=7, ze=0.35;
  for(i=0;i<n;i++){ BOG.pv+=(om*om*(tgt-BOG.pitch)-2*ze*om*BOG.pv)*h; BOG.pitch+=BOG.pv*h; }
  BOG.roll+=((ph==="pit"?Math.sin(BOG.t*3.1)*0.02*slip+Math.sin(BOG.t*1.3)*0.012*sink:0)-BOG.roll)*Math.min(1,dt*4);
  U.pivot.rotation.z=BOG.pitch; U.pivot.rotation.x=BOG.roll; U.pivot.position.y=U.rr+Math.sin(BOG.t*(+o.rpm||800)/60*1.3)*0.002;
  var ws=Math.max(v,+o.wspd||0), wr=ws/(U.rr*k);
  for(i=0;i<U.wheelsR.length;i++){ var sp=U.wheelsR[i]; sp.rotation.y=(sp.rotation.y-wr*dt)%TAU; }
  for(i=0;i<U.wheelsF.length;i++){ var sf=U.wheelsF[i]; sf.rotation.y=(sf.rotation.y-wr*dt)%TAU; }
  /* the mud coat builds on the paint */
  BOG.coat+=(clamp((+o.mudKg||0)/220,0,0.85)-BOG.coat)*Math.min(1,dt*2);
  if(U.paint0){ U.mats.paint.color.copy(U.paint0).lerp(_mudC, BOG.coat); }
  V.updateMatrixWorld(true);
  /* ruts and tracks: where the tyres have been */
  if(BOG.mud && x>0 && (ph==="pit"||ph==="done")){
    var rx=Math.min(x, len), half=U.trR*k, tw=U.wr*k*0.95, dep=clamp(0.05+sink*0.4,0.05,0.4);
    if(rx-BOG.paintX>0.4 || (ph==="done"&&BOG.paintX<rx-0.01)){ var from=Math.max(0,BOG.paintX<-1e8?0:BOG.paintX); bogMudTrack(from-0.2, rx, half, tw, clamp(slip+sink,0,1)); BOG.paintX=rx; }
    if(GFX!=="lite"){ bogMudRut(rx-U.rr*k*0.9, half, tw, dep); bogMudRut(rx-U.wb*k-U.rr*k*0.9, half, tw, dep*0.9); }
  }
  if(BOG.rutDirty && (BOG.t-(BOG.normT||0)>0.12)){ BOG.normT=BOG.t; BOG.rutDirty=0; BOG.mudGeo.computeVertexNormals(); }
  bogEffects(o, dt, V);
  bogCrowd(dt);
  bogDirect(o, dt, V);
  var c=_pC.copy(BOG.camPos).lerp(BOG.camTgt, 0.6); c.y=0;
  BOG.sun.position.copy(c).addScaledVector(BOG.sunDir, 120); BOG.sun.target.position.copy(c); BOG.sun.target.updateMatrixWorld();
  if(BOG.flood.intensity>0){ BOG.flood.position.set(c.x-20, 60, 40); BOG.flood.target.position.copy(c); BOG.flood.target.updateMatrixWorld(); }
  if(BOG.spots.length){ var poles=BOG.poles.slice().sort(function(a,b){ return Math.abs(a.x-c.x)-Math.abs(b.x-c.x); });
    BOG.spots.forEach(function(sp,j){ var pp=poles[j]; if(!pp) return; sp.position.copy(pp); sp.target.position.set(lerp(pp.x,c.x,0.5), 0, 0); sp.target.updateMatrixWorld(); }); }
  BOG.prev={phase:ph, cleared:!!o.cleared};
}
var _mudC=new THREE.Color(0.11,0.075,0.045);

