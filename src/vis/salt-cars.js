/* ===========================================================================
   SALT CARS (v2) — the Bonneville cars, built like the real ones.
   Streamliner: flat sides, flat bottom, wheels behind skirts, a chisel or
   needle nose, canopy, headrest fairing, tail fin, chute tubes.
   Lakester: a belly tank on a narrow track, Moon discs on tall skinny tyres.
   Modified roadster: a '32 grille shell, the engine out in the open, roll bar.
   Altered: the strip's muscle shell set up for the salt (number boards, taped
   lights, chute pack, Moon discs). Every car shows the engine it runs (stacks,
   blower hat, turbos, diesel stacks, rotary, two-stroke pipes) and carries a
   dense livery: number, class plate, sponsor blocks.
   Geometry is merged per material (one draw call each); wheels on the salt
   wear Moon discs, so they are round and need no spin and merge too.
   SALT.look (ENGINE_VIS.saltLook) = the player's paint, the meet number, the
   class and the engine; saltRivalLook(seed) gives any other car its own.
   ==========================================================================*/
var SLC={ geo:{}, mat:{} };
var SL_SPONSORS=[
  {id:"sl_pew", n:"PRAIRIE", t:"ENGINE WORKS", c1:"#f4efe2", c2:"#c0392b", c3:"#1a1a1a", s:"shield"},
  {id:"sl_wen", n:"WENDOVER", t:"SPEED SHOP", c1:"#c62a22", c2:"#f4efe2", c3:"#ffffff", s:"bolt"},
  {id:"sl_scb", n:"SALT CITY", t:"BEARINGS", c1:"#1d3f8f", c2:"#f2c230", c3:"#ffffff", s:"gear"},
  {id:"sl_blo", n:"BLACK LINE", t:"RACING OIL", c1:"#141414", c2:"#e8b21b", c3:"#f4efe2", s:"drop"},
  {id:"sl_sip", n:"SILVER ISLE", t:"PISTONS", c1:"#d9dde2", c2:"#2a2a2a", c3:"#1a1a1a", s:"ring"},
  {id:"sl_m3t", n:"MILE THREE", t:"TIMING", c1:"#f28c1a", c2:"#141414", c3:"#141414", s:"diamond"},
  {id:"sl_alk", n:"ALKALI", t:"FUEL CO.", c1:"#2c6b3a", c2:"#f4efe2", c3:"#f4efe2", s:"leaf"},
  {id:"sl_ftw", n:"FLATS", t:"TIRE & WHEEL", c1:"#202a36", c2:"#cfd3d8", c3:"#ffffff", s:"star"},
  {id:"sl_ktc", n:"KNOT-TIGHT", t:"CHUTES", c1:"#e5562b", c2:"#f4efe2", c3:"#ffffff", s:"wing"},
  {id:"sl_lsr", n:"FIVE MILE", t:"GEAR & AXLE", c1:"#5b2a86", c2:"#f2c230", c3:"#ffffff", s:"gear"}];
var SL_RIVAL_PAINT=[0x1d4787,0xd9a52b,0xb7261d,0xe9e6dc,0x16181b,0x2c6b3a,0xd85f14,0x2b8a9e,0x5b2a86,0xa9aeb5,0xc23b6e,0x7a1f1f];

/* --- the look ------------------------------------------------------------ */
/* what the car's engine shows, read off a build cfg */
function slEngOf(cfg, layoutObj){
  cfg=cfg||{}; var SIMO=(typeof ENGINE_SIM!=="undefined")?ENGINE_SIM:null;
  var LO=layoutObj || (SIMO && SIMO.LAYOUTS && SIMO.LAYOUTS[cfg.layout]) || null, L=normLayout(cfg, LO);
  var a=String(cfg.asp||"na"), asp=a==="na"?"na":(a==="roots"||a==="screw")?"blower":a==="centrifugal"?"centri":(a==="twin_turbo"||a==="compound")?"twin":"turbo";
  var rot=isRotaryCfg(cfg), two=!rot && isTwoStrokeCfg(cfg), dsl=isDieselCfg(cfg), fuel=String(cfg.fuel||"");
  var kind=rot?"rotary":two?"two":L.banks>1?(L.boxer?"flat":"v"):"i";
  var rotors=rot?(+String(cfg.layout||"R2").slice(1)||2):0;
  var inj=asp==="na" && !dsl && (cfg.intake==="itb" || /meth|e85|nitro|ethan/.test(fuel));
  return {kind:kind, n:Math.max(1,L.n||4), rotors:rotors, asp:asp, screw:a==="screw", diesel:dsl, inj:inj, carb:cfg.intake==="carb",
    ic:!!cfg.ic && cfg.ic!=="none", n2o:!!cfg.nitrous && cfg.nitrous!=="none", cover:(COVER_COLORS[cfg.cover]||COVER_COLORS.red)};
}
function slEngKey(E){ return E?[E.kind,E.n,E.rotors,E.asp,E.screw?1:0,E.diesel?1:0,E.inj?1:0,E.carb?1:0,E.cover>>>0].join(","):"-"; }
function slHash(s){ var h=2166136261; s=String(s); for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function slRng(seed){ var a=(seed>>>0)||1; return function(){ a=(a+0x6D2B79F5)>>>0; var t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
function slLum(c){ var q=new THREE.Color(c); return 0.2126*q.r+0.7152*q.g+0.0722*q.b; }
/* the second colour: a contrasting stripe/fin/helmet colour that still suits the paint */
function slAccent(color){ var l=slLum(color); return l>0.6?0x16181b:l<0.08?0xd9a52b:0xf2eee4; }
/* normalise whatever the app (or a harness) hands over: {color, accent, num, cls, cfg|eng, nose, sponsors, rival} */
function slLook(o){
  o=o||{}; var col=o.color!=null?(o.color>>>0):0xd9a52b, E=o.eng||(o.cfg?slEngOf(o.cfg):(lastCfg?slEngOf(lastCfg, lastLayout):slEngOf({})));
  var sp=Array.isArray(o.sponsors)&&o.sponsors.length?o.sponsors:[0,1,2,3,4,5];
  var L={color:col, accent:o.accent!=null?(o.accent>>>0):slAccent(col), num:String(o.num!=null?o.num:((col%377)+11)).slice(0,4), cls:o.cls?String(o.cls).slice(0,9):"",
    eng:E, nose:o.nose==="needle"?"needle":"chisel", sponsors:sp.map(function(i){ return (+i||0)%SL_SPONSORS.length; }), rival:!!o.rival, moon:o.moon==="paint"?"paint":"chrome"};
  L.key=[L.color,L.accent,L.num,L.cls,L.nose,L.sponsors.join("."),L.moon,slEngKey(E),GFX].join("|");
  return L;
}
/* any other car on the salt: its own paint, number, engine and sponsors, seeded */
function saltRivalLook(seed, body){
  var r=slRng(slHash("salt|"+seed)), pick=function(a){ return a[Math.floor(r()*a.length)]; };
  var kinds=[["v",8,"blower"],["v",8,"na"],["v",8,"twin"],["i",6,"turbo"],["i",4,"turbo"],["flat",4,"na"],["i",6,"diesel"],["rotary",2,"na"],["two",3,"na"],["v",8,"turbo"],["i",6,"na"],["v",12,"na"]];
  var k=pick(kinds), dsl=k[2]==="diesel", asp=dsl?"turbo":k[2];
  var E={kind:k[0], n:k[1], rotors:k[0]==="rotary"?2:0, asp:asp, screw:asp==="blower"&&r()<0.3, diesel:dsl, inj:asp==="na"&&r()<0.7, carb:false, ic:asp!=="na"&&asp!=="blower", n2o:false,
    cover:pick([0xa32a26,0x1b1d20,0xd85f14,0x1f4fa8,0xc9ced4])};
  var col=pick(SL_RIVAL_PAINT), sp=[], i; while(sp.length<5){ i=1+Math.floor(r()*(SL_SPONSORS.length-1)); if(sp.indexOf(i)<0) sp.push(i); }
  var num=r()<0.3?String(10+Math.floor(r()*90)):String(100+Math.floor(r()*900));
  var disp=pick(["AA","A","B","C","D","E","F","G"]), fu=dsl?"D":r()<0.55?"F":"G", code={streamliner:"S",lakester:"L",roadster:"MR",altered:"ALT"}[body]||"S";
  return slLook({color:col, accent:r()<0.5?slAccent(col):pick([0xf2eee4,0x16181b,0xd9a52b,0xb7261d]), num:num, cls:disp+"/"+(asp!=="na"?"B":"")+fu+code, eng:E,
    nose:r()<0.5?"needle":"chisel", sponsors:sp, rival:true, moon:r()<0.3?"paint":"chrome"});
}
function saltSetLook(o){ SALT.look=o?slLook(o):null; return SALT.look; }

/* --- the livery atlas: number board, bare numerals, class plate, sponsor blocks, a sponsor rail ---------- */
var SL_ATL={W:1024, H:512, numB:[0,0,320,200], numT:[320,0,384,200], cls:[704,0,320,100], tech:[704,100,104,100], club:[808,100,216,100],
  sp:[[0,200,340,104],[340,200,340,104],[680,200,344,104],[0,304,340,104],[340,304,340,104],[680,304,344,104]], rail:[0,408,1024,104]};
function slSponsor(x, sp, x0, y0, w, h){
  var F="'Barlow Condensed','Arial Narrow',Arial,sans-serif", m=6;
  spRRect(x, x0+m, y0+m, w-2*m, h-2*m, 12); x.fillStyle=sp.c1; x.fill(); x.lineWidth=4; x.strokeStyle=sp.c2; spRRect(x, x0+m+7, y0+m+7, w-2*m-14, h-2*m-14, 8); x.stroke();
  spShape(x, sp.s, x0+h*0.52, y0+h/2, h*0.27, sp.c2, sp.c1);
  x.textAlign="left"; x.textBaseline="alphabetic"; x.fillStyle=sp.c3; x.font="italic 700 "+Math.round(h*0.42)+"px "+F; x.fillText(sp.n, x0+h*0.92, y0+h*0.58, w-h*1.05);
  x.fillStyle=sp.c2; x.font="600 "+Math.round(h*0.19)+"px "+F; x.fillText(sp.t, x0+h*0.94, y0+h*0.82, w-h*1.1);
}
function slAtlas(L){
  var key="atl|"+L.key; if(SLC.mat[key]) return SLC.mat[key];
  var A=SL_ATL, c=newCanvas(A.W, A.H), x=c.getContext("2d"), F="'Chakra Petch','Barlow Condensed','Arial Narrow',Arial,sans-serif", R, i;
  x.clearRect(0,0,A.W,A.H);
  /* number board: white, black border, the number big */
  R=A.numB; spRRect(x, R[0]+8, R[1]+8, R[2]-16, R[3]-16, 18); x.fillStyle="#f4efe2"; x.fill(); x.lineWidth=8; x.strokeStyle="#141414"; x.stroke();
  x.fillStyle="#141414"; x.textAlign="center"; x.textBaseline="middle"; x.font="700 "+(L.num.length>3?118:150)+"px "+F; x.fillText(L.num, R[0]+R[2]/2, R[1]+R[3]/2+8, R[2]-40);
  /* bare numerals in the contrasting colour, outlined */
  R=A.numT; var light=slLum(L.color)>0.45; x.font="italic 700 176px "+F; x.lineJoin="round"; x.lineWidth=14; x.strokeStyle=light?"#f4efe2":"#141414";
  x.strokeText(L.num, R[0]+R[2]/2, R[1]+R[3]/2+10, R[2]-30); x.fillStyle=light?"#141414":"#f4efe2"; x.fillText(L.num, R[0]+R[2]/2, R[1]+R[3]/2+10, R[2]-30);
  /* class plate: what the car runs in, e.g. AA/BFS */
  R=A.cls; x.fillStyle="#f4efe2"; x.fillRect(R[0]+4, R[1]+4, R[2]-8, R[3]-8); x.lineWidth=6; x.strokeStyle="#141414"; x.strokeRect(R[0]+8, R[1]+8, R[2]-16, R[3]-16);
  x.fillStyle="#141414"; x.font="700 20px "+F; x.save(); x.translate(R[0]+28, R[1]+R[3]/2); x.rotate(-PI/2); x.fillText("CLASS", 0, 0); x.restore();
  x.font="700 74px "+F; x.fillText(L.cls||"—", R[0]+R[2]/2+16, R[1]+R[3]/2+5, R[2]-60);
  /* tech sticker and a meet sticker */
  R=A.tech; x.fillStyle="#e8b21b"; x.beginPath(); x.arc(R[0]+R[2]/2, R[1]+R[3]/2, 46, 0, TAU); x.fill(); x.fillStyle="#141414"; x.font="700 26px "+F; x.fillText("TECH", R[0]+R[2]/2, R[1]+R[3]/2-10); x.font="700 22px "+F; x.fillText("✓ OK", R[0]+R[2]/2, R[1]+R[3]/2+16);
  R=A.club; x.fillStyle="#1d3f8f"; spRRect(x, R[0]+6, R[1]+10, R[2]-12, R[3]-20, 10); x.fill(); x.fillStyle="#f4efe2"; x.font="italic 700 34px "+F; x.fillText("SPEED WEEK", R[0]+R[2]/2, R[1]+R[3]/2-6, R[2]-24); x.font="600 18px "+F; x.fillText("BONNEVILLE · SALT FLATS", R[0]+R[2]/2, R[1]+R[3]/2+22, R[2]-24);
  /* sponsor blocks */
  for(i=0;i<A.sp.length;i++){ R=A.sp[i]; slSponsor(x, SL_SPONSORS[L.sponsors[i%L.sponsors.length]], R[0], R[1], R[2], R[3]); }
  /* the rail: a row of small sponsor blocks */
  R=A.rail; for(i=0;i<4;i++) slSponsor(x, SL_SPONSORS[L.sponsors[(i+2)%L.sponsors.length]], R[0]+i*256, R[1]+10, 256, 84);
  var t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=MAXANISO;
  var q=new THREE.MeshStandardMaterial({map:t, transparent:true, depthWrite:false, roughness:0.35, metalness:0.05, polygonOffset:true, polygonOffsetFactor:-3, polygonOffsetUnits:-3});
  var env=sc_env(); if(env) q.envMap=env;
  q.userData.perBuild=true; q.userData.ownMaps=[t]; SLC.mat[key]=q; return q;
}
/* a decal quad: atlas region R, centre p, along u (text direction), up v, size w x h */
function slDecal(B, R, p, u, v, w, h){
  var g=new THREE.PlaneGeometry(1,1), uv=g.attributes.uv, A=SL_ATL, u0=R[0]/A.W, u1=(R[0]+R[2])/A.W, v0=1-(R[1]+R[3])/A.H, v1=1-R[1]/A.H;
  for(var i=0;i<uv.count;i++) uv.setXY(i, u0+uv.getX(i)*(u1-u0), v0+uv.getY(i)*(v1-v0));
  var U=new THREE.Vector3().fromArray(u), V=new THREE.Vector3().fromArray(v), N=new THREE.Vector3().crossVectors(U,V), m=new THREE.Matrix4().makeBasis(U,V,N);
  m.scale(new THREE.Vector3(w,h,1)); m.setPosition(p[0],p[1],p[2]); B.add("decal", g, m);
}
/* the same decal on both flat sides at |z| = zs (text reads forward on each side) */
function slDecal2(B, R, x, y, zs, w, h){ slDecal(B, R, [x,y,zs], [1,0,0], [0,1,0], w, h); slDecal(B, R, [x,y,-zs], [-1,0,0], [0,1,0], w, h); }

/* a decal wrapped onto a body of revolution: centre x, height yc+dy, side sd; rFn(x) = the section's (y, z) half axes */
function slDecalTank(B, R, x, yc, dy, w, h, sd, rFn){
  var g=new THREE.PlaneGeometry(1,1,6,4), uv=g.attributes.uv, P=g.attributes.position, A=SL_ATL, u0=R[0]/A.W, u1=(R[0]+R[2])/A.W, v0=1-(R[1]+R[3])/A.H, v1=1-R[1]/A.H, i;
  for(i=0;i<uv.count;i++) uv.setXY(i, u0+uv.getX(i)*(u1-u0), v0+uv.getY(i)*(v1-v0));
  for(i=0;i<P.count;i++){ var u=P.getX(i), v=P.getY(i), X=x+sd*u*w, ab=rFn(X), Y=yc+dy+v*h, th=Math.asin(clamp((Y-yc)/ab[0],-0.98,0.98)); P.setXYZ(i, X, Y, sd*(ab[1]*Math.cos(th)+0.006)); }
  g.computeVertexNormals(); B.add("decal", g, new THREE.Matrix4());
}

/* --- geometry helpers ---------------------------------------------------- */
function slPchip(xs, ys){
  var n=xs.length, h=[], s=[], m=[], i;
  for(i=0;i<n-1;i++){ h[i]=xs[i+1]-xs[i]; s[i]=(ys[i+1]-ys[i])/h[i]; }
  m[0]=s[0]; m[n-1]=s[n-2];
  for(i=1;i<n-1;i++){ if(s[i-1]*s[i]<=0) m[i]=0; else { var w1=2*h[i]+h[i-1], w2=h[i]+2*h[i-1]; m[i]=(w1+w2)/(w1/s[i-1]+w2/s[i]); } }
  return function(x){ var k=0; while(k<n-2 && x>xs[k+1]) k++; var t=clamp((x-xs[k])/h[k],0,1), t2=t*t, t3=t2*t;
    return (2*t3-3*t2+1)*ys[k]+(t3-2*t2+t)*h[k]*m[k]+(-2*t3+3*t2)*ys[k+1]+(t3-t2)*h[k]*m[k+1]; };
}
/* a flat-sided loft: rows [x, bottom y, top y, half width, top corner r, bottom corner r, crown], rear -> front.
   Each station is a rounded rectangle (flat sides and bottom); the ends are capped. */
function slLoft(rows, k, sub){
  k=k||3; sub=sub||3; var n=rows.length, i, j, q, xs=rows.map(function(r){ return r[0]; }), F=[];
  for(j=1;j<=6;j++) F.push(slPchip(xs, rows.map(function(r){ return r[j]||0; })));
  var X=[]; for(i=0;i<n-1;i++) for(j=0;j<sub;j++) X.push(lerp(xs[i],xs[i+1],j/sub)); X.push(xs[n-1]);
  var ring=2+4*(k+1), pos=[], uv=[], idx=[], cen=[];
  X.forEach(function(x){
    var yb=F[0](x), yt=F[1](x), hw=Math.max(0.004,F[2](x)), H=Math.max(0.004,yt-yb), rt=Math.max(0,Math.min(F[3](x), hw*0.999, H*0.6)), rb=Math.max(0,Math.min(F[4](x), hw*0.999, H-rt)), cr=F[5](x), P=[], a;
    P.push([0,yb]);
    for(q=0;q<=k;q++){ a=-PI/2+q/k*PI/2; P.push([hw-rb+Math.cos(a)*rb, yb+rb+Math.sin(a)*rb]); }
    for(q=0;q<=k;q++){ a=q/k*PI/2; P.push([hw-rt+Math.cos(a)*rt, yt-rt+Math.sin(a)*rt]); }
    P.push([0,yt]);
    for(q=0;q<=k;q++){ a=PI/2+q/k*PI/2; P.push([-(hw-rt)+Math.cos(a)*rt, yt-rt+Math.sin(a)*rt]); }
    for(q=0;q<=k;q++){ a=PI+q/k*PI/2; P.push([-(hw-rb)+Math.cos(a)*rb, yb+rb+Math.sin(a)*rb]); }
    P.forEach(function(p, pi){ var y=p[1]; if(y>yb+H*0.5) y+=cr*(1-Math.pow(p[0]/hw,2)); pos.push(x, y, p[0]); uv.push((x-xs[0])/(xs[n-1]-xs[0]), pi/ring); });
    cen.push([x,(yb+yt)/2]);
  });
  var S=X.length;
  for(i=0;i<S-1;i++) for(q=0;q<ring;q++){ var a0=i*ring+q, b0=i*ring+(q+1)%ring, c0=(i+1)*ring+q, d0=(i+1)*ring+(q+1)%ring; idx.push(a0,c0,b0, b0,c0,d0); }
  var ct=pos.length/3; pos.push(cen[0][0],cen[0][1],0); uv.push(0,0.5); for(q=0;q<ring;q++) idx.push(ct, q, (q+1)%ring);
  var cn=pos.length/3, base=(S-1)*ring; pos.push(cen[S-1][0],cen[S-1][1],0); uv.push(1,0.5); for(q=0;q<ring;q++) idx.push(cn, base+(q+1)%ring, base+q);
  var g=new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos,3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/* a bevelled box (Full/Ultra) or a plain one (Lite: 12 triangles instead of ~100) */
function slBox(w, h, d, b){ if(GFX!=="lite") return sc_rbox(w, h, d, b); var key="lb"+[w,h,d].map(r3).join("_"); return SLC.geo[key]||(SLC.geo[key]=new THREE.BoxGeometry(w, h, d)); }
function slRod(B, key, a, b, r, seg){ B.add(key, sc_cyl(r, GFX==="lite"?Math.min(6, seg||8):(seg||8)), sc_rodM(a, b)); }
function slV(x,y,z){ return new THREE.Vector3(x,y,z); }
/* a cylinder along x (centre cx) or z */
function slCylX(B, key, cx, y, z, r, len, seg){ B.add(key, sc_cyl(r, GFX==="lite"?Math.min(8, seg||10):(seg||10)), sc_M(cx, y, z, 0, 0, -PI/2, 1, len, 1)); }
function slCylZ(B, key, x, y, cz, r, len, seg){ B.add(key, sc_cyl(r, GFX==="lite"?Math.min(8, seg||10):(seg||10)), sc_M(x, y, cz, PI/2, 0, 0, 1, len, 1)); }
function slSph(r, ws, hs){ var key="sph"+r3(r)+"_"+ws; return SLC.geo[key]||(SLC.geo[key]=new THREE.SphereGeometry(r, ws||12, hs||8)); }
/* a Moon disc: a polished spherical cap over the whole rim (dome along +y before placing) */
function slMoonGeo(R, h, seg){ var key="moon"+r3(R)+"_"+r3(h)+"_"+seg; if(SLC.geo[key]) return SLC.geo[key];
  var pts=[], i, N=5; for(i=0;i<=N;i++){ var t=i/N; pts.push(new THREE.Vector2(Math.max(0.001,R*Math.sin(t*PI/2)), h*Math.cos(t*PI/2))); }
  pts.push(new THREE.Vector2(R*1.02, -0.004)); pts.reverse(); return (SLC.geo[key]=new THREE.LatheGeometry(pts, seg)); }
/* the strip's tyre profile; Lite lathes it with 12 sides instead of 18 */
function slTyre(r, w, rimR){ if(GFX!=="lite") return sc_tyreGeo(r, w, rimR); var key="lty"+[r,w,rimR].map(r3).join("_"); if(SLC.geo[key]) return SLC.geo[key];
  var hw=w/2, sh=Math.min(0.055,(r-rimR)*0.3), pr=[[rimR+0.004,0.86],[lerp(rimR,r,0.34),1],[lerp(rimR,r,0.74),1],[r-sh,0.965],[r-sh*0.22,0.82]], pts=[], i;
  for(i=0;i<pr.length;i++) pts.push(new THREE.Vector2(pr[i][0], -hw*pr[i][1])); for(i=pr.length-1;i>=0;i--) pts.push(new THREE.Vector2(pr[i][0], hw*pr[i][1]));
  return (SLC.geo[key]=new THREE.LatheGeometry(pts, 12)); }
/* a salt wheel: tyre + Moon discs both faces (static: round things need no spin) */
function slWheel(B, x, z, r, w, o){
  o=o||{}; var rimR=r*(o.rim||0.62), sd=z<0?-1:1, seg=GFX==="lite"?12:18;
  B.add("rubber", slTyre(r, w, rimR), sc_M(x, r, z, PI/2, 0, 0));
  if(o.disc===false || GFX!=="lite") B.add("well", new THREE.CircleGeometry(rimR*0.99, seg), sc_M(x, r, z+sd*w*0.2, 0, sd>0?0:PI, 0));
  if(o.disc!==false){ B.add(o.moon==="paint"?"paint":"chrome", slMoonGeo(rimR*0.98, rimR*0.22, seg), sc_M(x, r, z+sd*w*0.42, sd*PI/2, 0, 0));
    if(o.inner!==false) B.add("satin", new THREE.CircleGeometry(rimR*0.95, seg), sc_M(x, r, z-sd*w*0.38, 0, sd>0?PI:0, 0)); }
}
/* a seated driver: hips at (x,y,z), leaning back by lean (rad); fire suit, arms to the wheel, helmet + visor */
function slDriver(B, x, y, z, lean, o){
  o=o||{}; var c=Math.cos(lean), s=Math.sin(lean), up=function(d){ return slV(x-s*d, y+c*d, z); };
  B.add("suit", slBox(0.24, 0.5, 0.38, 0.06), sc_M(x-s*0.25, y+c*0.25, z, 0, 0, lean));
  B.add("suit", sc_cyl(0.06, 8), sc_M(x-s*0.53, y+c*0.53, z, 0, 0, lean, 1, 0.1, 1));
  var hc=up(0.68), sh=up(0.44);
  B.add("helm", slSph(0.15, GFX==="lite"?10:14, GFX==="lite"?8:10), sc_M(hc.x, hc.y, hc.z, 0, 0, lean, 1, 1.08, 0.95));
  B.add("visor", slBox(0.07, 0.1, 0.25, 0.03), sc_M(hc.x+c*0.115, hc.y+s*0.115-0.005, hc.z, 0, 0, lean));
  B.add("acc", slBox(0.3, 0.03, 0.035, 0.01), sc_M(hc.x-s*0.15, hc.y+c*0.15, hc.z, 0, 0, lean));
  if(o.wheel){ var wx=o.wheel[0], wy=o.wheel[1];
    B.add("black", new THREE.TorusGeometry(0.15, 0.016, 5, GFX==="lite"?10:16), sc_M(wx, wy, z, 0, PI/2, 0.35));
    [-1,1].forEach(function(sd){ slRod(B, "suit", slV(sh.x, sh.y-0.04, z+sd*0.17), slV(wx-0.05, wy-0.02, z+sd*0.12), 0.045, 6); }); }
}
/* the roll bar: a hoop across the car at x (height top, half width hw from y0) + a brace back */
function slHoop(B, x, y0, top, hw, back){
  var R=hw, hg=Math.max(0.01, top-y0-R);
  B.add("chrome", new THREE.TorusGeometry(R, 0.024, 6, 14, PI), sc_M(x, y0+hg, 0, 0, PI/2, 0));
  [-1,1].forEach(function(sd){ slRod(B, "chrome", slV(x, y0, sd*R), slV(x, y0+hg, sd*R), 0.024, 8); });
  if(back!=null) slRod(B, "chrome", slV(x, top-0.02, 0), slV(back[0], back[1], 0), 0.02, 8);
}
/* the chute pack: a bag on a bracket */
function slChutePack(B, x, y, z){ if(GFX==="lite"){ B.add("black", slBox(0.22, 0.26, 0.3, 0.05), sc_M(x, y, z)); return; } B.add("bag", slBox(0.22, 0.26, 0.3, 0.05), sc_M(x, y, z)); B.add("black", slBox(0.04, 0.3, 0.06, 0.01), sc_M(x+0.02, y, z)); B.add("canopyT", slBox(0.05, 0.05, 0.31, 0.01), sc_M(x-0.09, y+0.06, z)); }

/* --- the engine you can see ---------------------------------------------------------------------------
   slEngine(B, E, o): o.x engine centre, o.y deck (where the intake sits), o.open = the whole engine (block, covers,
   headers) or only what pokes through the body (the hat / stacks / scoops). o.exh: "zoomie" | "side" | "none";
   side pipes run back to o.sideX at o.sideZ. Exhaust tips (for the smoke) go into o.tips. Returns the top y. */
function slEngine(B, E, o){
  var x=o.x, y=o.y, open=!!o.open, lite=GFX==="lite", tips=o.tips||[], top=y, i, sd, k;
  var banks=E.kind==="v"||E.kind==="flat"?2:1, per=E.kind==="rotary"?E.rotors:E.kind==="two"?Math.min(4,E.n):Math.max(1, Math.ceil(E.n/banks)), len=E.kind==="rotary"?0.14*per+0.18:E.kind==="two"?0.17*per+0.1:0.105*per+0.16;
  var x0=x+len/2, x1=x-len/2;
  /* block, heads, covers */
  if(open){
    if(E.kind==="v"){ B.add("engine", slBox(len, 0.3, 0.44, 0.03), sc_M(x, y-0.2, 0)); B.add("black", slBox(len*0.9, 0.12, 0.3, 0.03), sc_M(x, y-0.41, 0));
      for(sd=-1;sd<=1;sd+=2){ B.add("engine", slBox(len*0.96, 0.12, 0.16, 0.02), sc_M(x, y-0.06, sd*0.2, sd*0.55, 0, 0)); B.add("cover", slBox(len*0.92, 0.07, 0.15, 0.025), sc_M(x, y+0.02, sd*0.25, sd*0.55, 0, 0)); }
      slCylX(B, "chrome", x0+0.04, y-0.24, 0, 0.09, 0.05, 14); }
    else if(E.kind==="flat"){ B.add("engine", slBox(len, 0.26, 0.36, 0.03), sc_M(x, y-0.2, 0));
      for(sd=-1;sd<=1;sd+=2){ B.add("engine", slBox(len*0.96, 0.2, 0.12, 0.02), sc_M(x, y-0.2, sd*0.27)); B.add("cover", slBox(len*0.92, 0.16, 0.07, 0.025), sc_M(x, y-0.2, sd*0.36)); } }
    else if(E.kind==="i"){ var th=E.diesel?0.46:0.36; B.add("engine", slBox(len, th, 0.28, 0.03), sc_M(x, y-th/2-0.06, 0)); B.add("black", slBox(len*0.9, 0.12, 0.26, 0.03), sc_M(x, y-th-0.1, 0));
      B.add("engine", slBox(len*0.98, 0.1, 0.26, 0.02), sc_M(x, y-0.03, 0)); B.add(E.diesel?"satin":"cover", slBox(len*0.94, 0.08, 0.22, 0.03), sc_M(x, y+0.05, 0));
      slCylX(B, "chrome", x0+0.04, y-th*0.7, 0, 0.08, 0.05, 14); }
    else if(E.kind==="rotary"){
      for(i=0;i<2*per+1;i++) B.add(i%2?"black":"alu", slBox(0.06, 0.34, 0.42, 0.03), sc_M(x0-0.03-i*((len-0.04)/(2*per)), y-0.2, 0));
      /* the cue: a rotor triangle on the front cover */
      var tri=new THREE.Shape(); for(i=0;i<3;i++){ var a=PI/2+i*TAU/3, b=a+TAU/3, ca=[Math.cos(a)*0.12, Math.sin(a)*0.12], cb=[Math.cos(b)*0.12, Math.sin(b)*0.12], cm=[Math.cos(a+TAU/6)*0.085, Math.sin(a+TAU/6)*0.085];
        if(!i) tri.moveTo(ca[0],ca[1]); tri.quadraticCurveTo(cm[0],cm[1],cb[0],cb[1]); }
      B.add("cover", new THREE.ExtrudeGeometry(tri, {depth:0.03, bevelEnabled:false, curveSegments:4}), sc_M(x0+0.005, y-0.2, 0, 0, PI/2, 0));
      slCylX(B, "chrome", x0+0.05, y-0.2, 0, 0.03, 0.08, 8); }
    else if(E.kind==="two"){
      B.add("engine", slBox(len, 0.24, 0.3, 0.04), sc_M(x, y-0.32, 0));
      var nf=lite?4:8;
      for(i=0;i<per;i++){ var cx=x0-0.1-i*0.17; for(k=0;k<nf;k++) B.add("alu", sc_cyl(0.075, 10), sc_M(cx, y-0.2+k*(0.2/nf), 0, 0,0,0, 1, 0.012, 1));
        B.add("engine", sc_cyl(0.05, 10), sc_M(cx, y-0.1, 0, 0,0,0, 1, 0.22, 1)); B.add("satin", slBox(0.1, 0.05, 0.1, 0.02), sc_M(cx, y+0.03, 0)); }
    }
  }
  /* induction */
  if(E.kind==="two"){   /* reed carbs on the side, bell mouths out */
    for(i=0;i<per;i++){ var cx2=x0-0.1-i*0.17; slRod(B, "alu", slV(cx2, y-0.25, 0.12), slV(cx2, y-0.22, 0.26), 0.03, 8); B.add("chrome", new THREE.CylinderGeometry(0.05, 0.03, 0.06, 10, 1, true), sc_M(cx2, y-0.215, 0.29, PI/2, 0, 0)); }
    top=Math.max(top, y+0.08);
  } else if(E.asp==="blower"){
    var bl=Math.min(0.62, len*0.85);
    B.add("alu", slBox(bl, 0.2, E.screw?0.3:0.28, E.screw?0.08:0.03), sc_M(x, y+0.12, 0));
    if(!lite) for(i=0;i<5;i++) B.add("satin", slBox(0.012, 0.13, E.screw?0.31:0.29, 0.004), sc_M(x-bl*0.4+i*bl*0.2, y+0.12, 0));
    B.add("satin", slBox(bl+0.04, 0.035, 0.32, 0.012), sc_M(x, y+0.235, 0));
    /* the injector hat (bug catcher): an open mouth facing forward, butterflies inside */
    B.add("chrome", sc_prof([[0.16,0],[0.2,0.25],[0.06,0.29],[-0.17,0.23],[-0.17,0]], 0.27, 0.012), sc_M(x+0.03, y+0.25, 0));
    B.add("well", slBox(0.02, 0.19, 0.22, 0.006), sc_M(x+0.215, y+0.38, 0, 0, 0, 0.16));
    B.add("black", slBox(0.035, 0.42, 0.11, 0.012), sc_M(x0+0.05, y-0.02, 0));   /* drive belt */
    top=Math.max(top, y+0.55);
  } else if(E.asp==="turbo"||E.asp==="twin"||E.asp==="centri"){
    B.add("alu", slBox(len*0.8, 0.13, 0.22, 0.03), sc_M(x, y+0.09, 0));   /* plenum */
    var tz=E.kind==="i"?[-0.32]:E.asp==="twin"?[-0.4,0.4]:[0.4], ty=open?y-0.12:y+0.02;
    if(E.asp==="centri"){ tz=[0.0]; }
    tz.forEach(function(z){ var tx=E.asp==="centri"?x0+0.15:x+len*0.15, yy=E.asp==="centri"?y+0.05:ty;
      B.add("alu", sc_cyl(0.11, 16), sc_M(tx, yy, z, PI/2, 0, 0, 1, 0.1, 1));
      sc_bell(B, tx+0.09, yy+0.03, z, 0.07);
      if(E.asp!=="centri") B.add("satin", sc_cyl(0.09, 14), sc_M(tx-0.02, yy, z+(z<0?-0.1:0.1), PI/2, 0, 0, 1, 0.08, 1));
      slRod(B, "alu", slV(tx+0.02, yy+0.1, z), slV(x+len*0.3, y+0.12, z*0.25), 0.04, 10);
      if(E.asp!=="centri"){ var sp=slV(tx-0.12, yy+0.05, z*1.05), st=slV(tx-0.18, yy+0.4+(open?0:0.05), z*1.08); slRod(B, "chrome", sp, st, 0.028, 8); tips.push(st.clone()); }
    });
    B.add("alu", sc_cyl(0.06, 12), sc_M(x0+0.02, y+0.1, 0, 0, 0, -PI/2, 1, 0.08, 1));
    top=Math.max(top, y+(E.asp==="centri"?0.18:0.45));
  } else if(E.inj || E.kind==="rotary"){   /* injector stacks: a trumpet per cylinder (two per rotor) */
    var rows=banks===2&&E.kind==="v"?[-1,1]:[0], ns=E.kind==="rotary"?per*2:per, hS=E.kind==="rotary"?0.24:0.22;
    B.add("alu", slBox(len*0.9, 0.08, rows.length>1?0.26:0.14, 0.02), sc_M(x, y+0.04, E.kind==="rotary"?0.12:0));
    rows.forEach(function(sd2){ for(var j=0;j<ns;j++){ var sx=x0-0.08-j*((len-0.14)/Math.max(1,ns-1||1)), sz=sd2*0.09+(E.kind==="rotary"?0.12:0), lean2=sd2*0.22;
      B.add("chrome", sc_cyl(0.026, 8), sc_M(sx, y+0.08+hS/2, sz+Math.sin(lean2)*hS*0.5, lean2, 0, 0, 1, hS, 1));
      if(!lite||j%2===0) B.add("chrome", new THREE.CylinderGeometry(0.046, 0.028, 0.05, 10, 1, true), sc_M(sx, y+0.08+hS+0.02, sz+Math.sin(lean2)*hS, lean2, 0, 0)); } });
    top=Math.max(top, y+0.36);
  } else if(E.carb){
    B.add("alu", slBox(len*0.6, 0.08, 0.2, 0.02), sc_M(x, y+0.05, 0)); B.add("alu", slBox(0.16, 0.08, 0.16, 0.02), sc_M(x, y+0.12, 0));
    B.add("chrome", sc_cyl(0.16, 18), sc_M(x, y+0.2, 0, 0,0,0, 1, 0.07, 1)); top=Math.max(top, y+0.24);
  } else {
    B.add("alu", slBox(len*0.8, 0.13, 0.22, 0.03), sc_M(x, y+0.09, 0)); B.add("alu", new THREE.CylinderGeometry(0.06, 0.06, 0.1, 12), sc_M(x0+0.02, y+0.1, 0, 0, 0, -PI/2));
    top=Math.max(top, y+0.16);
  }
  /* diesel: twin stacks straight up, rain caps */
  if(E.diesel){ var sx2=x1-0.08, hh=o.stackTop!=null?o.stackTop:y+0.85;
    for(sd=-1;sd<=1;sd+=2){ var zz=sd*(o.stackZ||0.18); slRod(B, "chrome", slV(sx2, y-0.15, zz), slV(sx2, hh, zz), 0.045, 12); B.add("chrome", slBox(0.11, 0.012, 0.1, 0.004), sc_M(sx2-0.04, hh+0.02, zz, 0, 0, 0.5)); tips.push(slV(sx2, hh+0.05, zz)); }
    top=Math.max(top, hh+0.05); }
  /* exhaust */
  if(open && o.exh!=="none" && !E.diesel){
    if(E.kind==="two"){   /* expansion chambers: the two-stroke's fat pipes, back along the side */
      for(i=0;i<per;i++){ var cx3=x0-0.1-i*0.17, zc=-0.24-i*0.11, len3=o.sideX!=null?Math.max(0.8,cx3-o.sideX):1.1;
        slRod(B, "barrel", slV(cx3, y-0.18, -0.08), slV(cx3-0.06, y-0.3, zc), 0.03, 8);
        B.add("barrel", slChamber(len3), sc_M(cx3-0.06, y-0.3, zc, 0, 0, PI/2));
        tips.push(slV(cx3-0.06-len3, y-0.3, zc)); }
    } else if(E.kind==="rotary"){   /* one big straight pipe out the side: the rotary's bark */
      var ez=-0.24, ey=y-0.25; slRod(B, "barrel", slV(x, ey, -0.15), slV(x-0.1, ey, ez-0.1), 0.05, 10);
      var ex=o.sideX!=null?o.sideX:x-1.2; slRod(B, "chrome", slV(x-0.1, ey, ez-0.1), slV(ex, ey-0.05, ez-0.12), 0.055, 12); tips.push(slV(ex, ey-0.05, ez-0.12));
    } else {
      var sides=E.kind==="i"?[-1]:[-1,1];
      sides.forEach(function(sd3){ var zs=E.kind==="flat"?0.4:E.kind==="i"?0.16:0.3, yp=E.kind==="flat"?y-0.28:y-0.12, n2=E.kind==="i"?per:per, j, tip=null;
        for(j=0;j<n2;j++){ var px=x0-0.07-j*((len-0.14)/Math.max(1,n2-1)), a=slV(px, yp, sd3*zs), b;
          if(o.exh==="side"){ b=slV(px-0.04, yp-0.12, sd3*(zs+0.16)); slRod(B, "chrome", a, b, 0.022, 6); slRod(B, "chrome", b, slV(x1-0.08, o.sideY!=null?o.sideY:yp-0.22, sd3*(o.sideZ||zs+0.22)), 0.022, 6); }
          else { b=slV(px-0.03, yp+0.0, sd3*(zs+0.13)); var c=slV(px-0.24, yp+0.16, sd3*(zs+0.2)); slRod(B, "chrome", a, b, 0.024, 6); slRod(B, "chrome", b, c, 0.026, 6);
            if(!lite) B.add("well", new THREE.CircleGeometry(0.024, 6), (function(){ var m=sc_rodM(b,c); m.multiply(new THREE.Matrix4().makeTranslation(0,0.5,0)).multiply(new THREE.Matrix4().makeRotationX(-PI/2)); return m; })());
            if(j===0||j===n2-1) tips.push(c.clone()); } }
        if(o.exh==="side"){ var sy=o.sideY!=null?o.sideY:yp-0.22, sz=sd3*(o.sideZ||zs+0.22), sx=o.sideX!=null?o.sideX:x1-1.2;
          B.add("chrome", sc_cyl(0.05, 12), sc_rodM(slV(x1-0.08, sy, sz), slV(sx, sy, sz))); B.add("chrome", new THREE.CylinderGeometry(0.06, 0.05, 0.08, 12, 1, true), sc_rodM(slV(sx, sy, sz), slV(sx-0.08, sy, sz))); tips.push(slV(sx-0.1, sy, sz)); }
      });
    }
  }
  if(E.n2o && open && !lite){ B.add("n2o", sc_cyl(0.06, 10), sc_M(x1-0.15, y-0.15, 0.3, 0, 0, -PI/2, 1, 0.5, 1)); }
  return top;
}
/* an expansion chamber along -x from its origin: header, diffuser cone, belly, baffle cone, stinger */
function slChamber(L){ var key="ch"+r3(L); if(SLC.geo[key]) return SLC.geo[key];
  var P=[[0,0.03],[0.12,0.035],[0.42,0.08],[0.58,0.085],[0.82,0.04],[0.86,0.018],[1,0.018]], pts=P.map(function(p){ return new THREE.Vector2(p[1], p[0]*L); });
  var g=new THREE.LatheGeometry(pts, 10); return (SLC.geo[key]=g); }

/* --- materials per car ------------------------------------------------------------------------------- */
function slMats(L){
  var M=sc_mats(), env=sc_env();
  function own(k, c, r, mt, o){ if(SLC.mat[k]) return SLC.mat[k]; var q=new THREE.MeshStandardMaterial({color:sc(c), roughness:r, metalness:mt}); if(env) q.envMap=env; if(o) for(var z in o) q[z]=o[z]; return (SLC.mat[k]=q); }
  return function(k){
    if(k==="paint") return sc_paint(L.color);
    if(k==="acc") return sc_paint(L.accent);
    if(k==="cover") return sc_paint(L.eng.cover);
    if(k==="helm") return sc_paint(slLum(L.color)>0.04&&slLum(L.color)<0.7?L.color:0xb7261d);
    if(k==="suit") return own("suit"+(L.rival?L.accent:0), L.rival?(slLum(L.accent)>0.5?0xb7261d:0xd8d2c4):0xd8d2c4, 0.85, 0);
    if(k==="cglass") return own("cglass", 0x0e1820, 0.04, 0.5, {transparent:true, opacity:0.42, envMapIntensity:1.1, depthWrite:false});
    if(k==="decal") return slAtlas(L);
    if(k==="canopyT") return own("canopyT", 0xe5562b, 0.8, 0);
    if(k==="n2o") return own("n2o", 0x2753b8, 0.3, 0.5);
    return M[k]||M.black;
  };
}
function slBuild(B, par, mat, lite){
  for(var k in B){ if(k==="add" || !B[k].length) continue;
    var m=new THREE.Mesh(sc_merge(B[k]), mat(k)); m.name="sl_"+k; m.receiveShadow=true; m.castShadow=!(k==="decal"||k==="cglass"||k==="well"||lite&&k!=="paint");
    if(k==="decal") m.renderOrder=2; if(k==="cglass") m.renderOrder=3; par.add(m); }
}

/* --- the cars. Origin = rear axle on the salt, +x forward. userData as saltCar's (wheels, tips, chutes, piv, me) --- */
function saltCarV2(body, L, aero){
  var g=new THREE.Group(), piv=new THREE.Group(), B=sc_bin(), W=sc_bin(), lite=GFX==="lite", k=lite?2:3, E=L.eng, tips=[], me, ls=[];
  g.add(piv);
  if(body==="streamliner") me=slStreamliner(B, W, L, E, aero, tips, ls, k);
  else if(body==="lakester") me=slLakester(B, W, L, E, aero, tips, ls, k);
  else me=slRoadster(B, W, L, E, aero, tips, ls, k);
  var mat=slMats(L); slBuild(B, piv, mat, lite); slBuild(W, g, mat, lite);
  if(tips.length>4) tips=[tips[0], tips[1], tips[tips.length-2], tips[tips.length-1]];
  g.userData={body:body, me:me, piv:piv, wheels:[], tips:tips, chutes:[], A:[{chT:0,chC:0,chS:0,pitch:0},{chT:0,chC:0,chS:0.7,pitch:0}], pitch:0, pv:0, strip:false, livSpots:ls, look:L};
  return g;
}

/* Streamliner (Speed Demon / Turbinator): flat sides and bottom, wheels behind the skirts, canopy forward of the engine,
   headrest fairing into the tail fin, chute tubes out the tail. Nose: a horizontal chisel blade, or a needle. */
function slStreamliner(B, W, L, E, aero, tips, ls, k){
  var yt=0.92, hw=0.48, T=-2.55, N=L.nose==="needle"?7.55:7.3, i, sd;
  var rows=[[T,0.30,0.62,0.16,0.12,0.08,0],[T+0.22,0.2,0.78,0.34,0.18,0.08,0],[-1.8,0.13,0.88,0.45,0.21,0.06,0.01],[-0.9,0.11,yt,hw,0.22,0.05,0.015],[4.2,0.11,yt,hw,0.22,0.05,0.015],[5.3,0.12,0.84,0.47,0.2,0.05,0.01]];
  if(L.nose==="needle") rows.push([6.3,0.14,0.66,0.40,0.2,0.08,0],[7.0,0.2,0.45,0.22,0.12,0.06,0],[N,0.3,0.34,0.025,0.012,0.012,0]);
  else rows.push([6.3,0.125,0.55,0.46,0.15,0.04,0],[6.95,0.14,0.3,0.44,0.08,0.03,0],[N,0.16,0.19,0.41,0.015,0.012,0]);
  B.add("paint", slLoft(rows, k, k===2?3:4));
  /* skirts: a blister over each wheel and a black rub strip low on the flat side */
  [[0,0.25],[4.6,0.24]].forEach(function(a){ for(sd=-1;sd<=1;sd+=2){ var zz=sd*(hw+0.001); B.add("seam", slBox(1.0, 0.012, 0.004, 0.001), sc_M(a[0], 0.62, zz)); B.add("seam", slBox(0.012, 0.5, 0.004, 0.001), sc_M(a[0]-0.5, 0.37, zz)); B.add("seam", slBox(0.012, 0.5, 0.004, 0.001), sc_M(a[0]+0.5, 0.37, zz));
      B.add("black", slBox(1.0, 0.03, 0.02, 0.004), sc_M(a[0], 0.125, sd*(hw-0.004))); } });
  for(sd=-1;sd<=1;sd+=2) B.add("acc", slBox(5.0, 0.07, 0.012, 0.004), sc_M(1.65, 0.2, sd*(hw+0.002)));
  /* canopy (the driver is under it, lying back), headrest fairing back to the fin */
  var cx=3.55; B.add("cglass", saltLathe(1.5, 0.22, [[0,0.05],[0.2,0.8],[0.5,1.0],[0.8,0.85],[1,0.1]], k===2?12:20), sc_M(cx-0.75, yt-0.02, 0, 0, 0, 0, 1, 0.78, 0.95));
  slDriver(B, cx+0.46, 0.58, 0, 1.12, {});
  B.add("paint", slLoft([[2.0,yt-0.1,yt+0.02,0.06,0.04,0.01,0],[2.45,yt-0.1,yt+0.15,0.15,0.09,0.01,0.02],[cx-0.62,yt-0.1,yt+0.2,0.16,0.1,0.01,0.03],[cx-0.5,yt-0.1,yt+0.08,0.12,0.06,0.01,0]], k, 2));
  /* tail fin with the number on it */
  var fs=new THREE.Shape(); fs.moveTo(T+0.1,0); fs.lineTo(-0.4,0); fs.lineTo(-1.55,0.98); fs.lineTo(-2.2,1.02); fs.lineTo(T+0.05,0.55); fs.lineTo(T+0.1,0);
  B.add("acc", new THREE.ExtrudeGeometry(fs, {depth:0.05, bevelEnabled:true, bevelThickness:0.01, bevelSize:0.01, bevelSegments:1}), sc_M(0, yt-0.25, -0.025));
  slDecal2(B, SL_ATL.numT, -1.75, yt+0.33, 0.04, 0.82, 0.43);
  /* chute tubes out the tail, a skid plate, and the trim tabs (aero) */
  for(sd=-1;sd<=1;sd+=2){ slCylX(B, "satin", T-0.08, 0.49, sd*0.1, 0.07, 0.5, 12); B.add("well", new THREE.CircleGeometry(0.06, 12), sc_M(T-0.335, 0.49, sd*0.1, 0, -PI/2, 0)); }
  B.add("black", slBox(7.0, 0.02, 0.5, 0.008), sc_M(2.0, 0.105, 0));
  if(aero) for(sd=-1;sd<=1;sd+=2){ B.add("acc", slBox(0.5, 0.025, 0.3, 0.008), sc_M(T+0.55, 0.36, sd*(hw-0.05), 0, 0, -0.08)); B.add("acc", slBox(0.32, 0.02, 0.2, 0.006), sc_M(5.9, 0.22, sd*0.5, 0, sd*0.05, -0.05)); }
  /* what the engine shows through the deck, behind the driver */
  var ex=1.0, dy=yt-0.18;
  if(E.asp==="blower") slEngine(B, E, {x:ex, y:dy, open:false, tips:[]});
  else if(E.asp==="turbo"||E.asp==="twin"||E.asp==="centri"){ for(sd=-1;sd<=1;sd+=2){ if(E.asp!=="twin"&&sd<0) continue;
      B.add("paint", sc_prof([[0.45,0],[0.25,0.1],[-0.25,0.14],[-0.35,0.0]], 0.2, 0.02), sc_M(ex+0.4, yt-0.01, sd*0.26)); B.add("well", slBox(0.02, 0.1, 0.16, 0.004), sc_M(ex+0.16, yt+0.06, sd*0.26, 0, 0, 0.3)); }
    if(E.asp!=="centri") for(sd=-1;sd<=1;sd+=2){ if(E.asp!=="twin"&&sd<0) continue; var gp=slV(ex-0.3, yt-0.05, sd*0.3), gt=slV(ex-0.38, yt+0.2, sd*0.32); slRod(B, "chrome", gp, gt, 0.03, 8); tips.push(gt.clone()); } }
  else { B.add("paint", sc_prof([[0.55,0],[0.35,0.16],[-0.2,0.24],[-0.35,0.22],[-0.4,0]], 0.26, 0.02), sc_M(ex+0.4, yt-0.01, 0)); B.add("well", slBox(0.02, 0.16, 0.2, 0.004), sc_M(ex+0.12, yt+0.12, 0, 0, 0, 0.35)); }
  if(E.diesel){ for(sd=-1;sd<=1;sd+=2){ var a=slV(ex-0.55, yt-0.1, sd*0.3), b=slV(ex-0.62, yt+0.32, sd*0.32); slRod(B, "chrome", a, b, 0.04, 10); tips.push(b.clone()); } }
  if(E.kind==="rotary"){ B.add("chrome", sc_cyl(0.07, 12), sc_rodM(slV(ex-0.2, 0.36, -hw+0.05), slV(ex-0.55, 0.34, -hw-0.04))); tips.push(slV(ex-0.6, 0.34, -hw-0.05)); }
  if(E.kind==="two"){ for(sd=-1;sd<=1;sd+=2){ slCylX(B, "barrel", T-0.05, 0.26, sd*0.07, 0.025, 0.4, 8); tips.push(slV(T-0.3, 0.26, sd*0.07)); } }
  if(!tips.length) tips.push(slV(-1.2, 0.3, -hw-0.02), slV(-1.2, 0.3, hw+0.02));
  /* livery: number board + class plate + sponsors on the flat sides, the number on the deck, stickers by the canopy */
  var zs=hw+0.004;
  slDecal2(B, SL_ATL.sp[0], 0.98, 0.62, zs, 0.8, 0.245);
  slDecal2(B, SL_ATL.sp[1], 0.98, 0.37, zs, 0.7, 0.215);
  slDecal2(B, SL_ATL.numB, 1.98, 0.55, zs, 0.68, 0.425);
  slDecal2(B, SL_ATL.cls, 1.98, 0.26, zs+0.002, 0.5, 0.155);
  slDecal2(B, SL_ATL.sp[2], 2.98, 0.62, zs, 0.8, 0.245);
  slDecal2(B, SL_ATL.sp[3], 2.98, 0.37, zs, 0.7, 0.215);
  if(GFX!=="lite"){ slDecal2(B, SL_ATL.rail, -0.42, 0.7, zs, 0.8, 0.09); slDecal2(B, SL_ATL.tech, 3.62, 0.37, zs, 0.16, 0.16); slDecal2(B, SL_ATL.club, 3.8, 0.62, zs, 0.5, 0.235); slDecal2(B, SL_ATL.sp[4], -1.35, 0.55, 0.43, 0.55, 0.17); }
  slDecal(B, SL_ATL.numB, [-0.3, yt+0.004, 0], [0,0,1], [1,0,0], 0.55, 0.36);
  /* wheels inside the skirts */
  W.add("rubber", slTyre(0.343, 0.18, 0.21), sc_M(0, 0.343, -0.25, PI/2, 0, 0)); W.add("rubber", slTyre(0.343, 0.18, 0.21), sc_M(0, 0.343, 0.25, PI/2, 0, 0));
  W.add("rubber", slTyre(0.33, 0.14, 0.2), sc_M(4.6, 0.33, -0.24, PI/2, 0, 0)); W.add("rubber", slTyre(0.33, 0.14, 0.2), sc_M(4.6, 0.33, 0.24, PI/2, 0, 0));
  ls.push({role:"hood", w:0.8, h:0.26, p:[0.3,yt+0.005,0], u:[0,0,1], v:[1,0,0]}, {role:"side", w:0.7, h:0.22, p:[4.3,0.32,zs+0.003], u:[1,0,0], v:[0,1,0]}, {role:"side", i:1, w:0.7, h:0.22, p:[4.3,0.32,-zs-0.003], u:[-1,0,0], v:[0,1,0]});
  return {rr:0.343, anchor:slV(T-0.3, 0.49, 0), chuteLen:9, chuteRise:0.7, chuteR:1.15, len:N-T, tail:T-0.3, nose:N, top:yt+0.2, wb:4.6};
}

/* Lakester: a belly tank on a narrow track. Driver ahead of the engine, headrest fairing, a small fin on the tail;
   tall skinny tyres with Moon discs; exposed front beam axle and rear axle tubes; the tank's seams and filler. */
function slLakester(B, W, L, E, aero, tips, ls, k){
  var L2=5.7, R2=0.44, X2=-1.75, y2=0.56, seg=k===2?20:28, sd, i, top=y2+R2;
  var prof=[[0,0.03],[0.14,0.42],[0.32,0.82],[0.52,1.0],[0.72,0.96],[0.86,0.8]], pf=slPchip([0,0.14,0.32,0.52,0.72,0.86,0.935,1],[0.03,0.42,0.82,1.0,0.96,0.8,0.56,0.0]);
  var rAt=function(x){ var f=Math.max(0.02,pf(clamp((x-X2)/L2,0,1)))*R2; return [f*0.94, f*0.86]; }, tTop=function(x){ return y2+rAt(x)[0]; };
  B.add("paint", saltLathe(L2*0.86, R2, prof.map(function(p){ return [p[0]/0.86, p[1]]; }), seg), sc_M(X2, y2, 0, 0,0,0, 1, 0.94, 0.86));
  B.add("alu", saltLathe(L2*0.14, R2, [[0,0.8],[0.35,0.56],[0.75,0.28],[1,0.0]], seg), sc_M(X2+L2*0.86, y2, 0, 0,0,0, 1, 0.94, 0.86));
  /* the tank's seams, filler cap and mounting lugs */
  [0.2,0.45,0.7].forEach(function(t){ var xr=X2+L2*t, r=Math.max(0.02,pf(t))*R2*1.01; B.add("seam", new THREE.TorusGeometry(r, 0.005, 3, seg), sc_M(xr, y2, 0, 0, PI/2, 0, 0.86, 0.94, 1)); });
  B.add("satin", slBox(L2*0.3, 0.01, 0.012, 0.004), sc_M(X2+L2*0.55, tTop(X2+L2*0.55)+0.002, 0));
  B.add("chrome", sc_cyl(0.06, 12), sc_M(2.3, tTop(2.3)-0.005, 0, 0, 0, 0, 1, 0.03, 1));
  for(i=0;i<2;i++){ var lx=1.85+i*0.18; B.add("chrome", slBox(0.1, 0.05, 0.05, 0.01), sc_M(lx, tTop(lx)+0.01, 0)); }
  /* cockpit: opening, wrap screen, driver, roll hoop, headrest fairing with a small fin */
  var cx=1.2; B.add("well", slBox(0.75, 0.02, 0.5, 0.01), sc_M(cx, tTop(cx)-0.002, 0)); B.add("black", slBox(0.8, 0.03, 0.55, 0.012), sc_M(cx, tTop(cx)-0.012, 0));
  slDriver(B, cx-0.12, y2+0.02, 0, 0.32, {wheel:[cx+0.42, y2+0.4]});
  B.add("cglass", new THREE.CylinderGeometry(0.3, 0.3, 0.16, 12, 1, true, -0.9, 1.8), sc_M(cx+0.5, top+0.07, 0, 0, PI/2, 0.35));
  slHoop(B, cx-0.65, top-0.05, top+0.42, 0.2, [cx-1.05, top-0.06]);
  B.add("paint", slLoft([[0.1,top-0.1,top-0.03,0.05,0.03,0.01,0],[0.35,top-0.1,top+0.18,0.12,0.08,0.01,0.01],[cx-0.6,top-0.1,top+0.3,0.15,0.1,0.01,0.02],[cx-0.48,top-0.1,top+0.2,0.14,0.08,0.01,0]], k, 2));
  var fs=new THREE.Shape(); fs.moveTo(-0.62,0); fs.lineTo(0.05,0); fs.lineTo(-0.3,0.36); fs.lineTo(-0.56,0.38); fs.lineTo(-0.62,0);
  B.add("acc", new THREE.ExtrudeGeometry(fs, {depth:0.025, bevelEnabled:false}), sc_M(-1.0, y2+0.08, -0.0125));
  /* the engine behind the driver: the hat / stacks / turbos stand up through the tank, zoomies out the sides */
  slEngine(B, E, {x:-0.3, y:tTop(-0.3)-0.06, open:false, tips:tips, stackTop:top+0.45, stackZ:0.13});
  if(!E.diesel && E.kind!=="two" && E.kind!=="rotary") for(sd=-1;sd<=1;sd+=2){ for(i=0;i<2;i++){ var a=slV(-0.15-i*0.24, y2+0.06, sd*R2*0.75), b=slV(-0.36-i*0.24, y2+0.3, sd*(R2*0.75+0.12)); slRod(B, "chrome", a, b, 0.028, 8); if(i) tips.push(b.clone()); } }
  if(E.kind==="two") for(sd=-1;sd<=1;sd+=2){ B.add("barrel", slChamber(1.3), sc_M(-0.3, y2-0.3, sd*0.26, 0, 0, PI/2)); tips.push(slV(-1.6, y2-0.3, sd*0.26)); }
  if(E.kind==="rotary"){ slRod(B, "chrome", slV(-0.1, y2-0.1, -R2*0.8), slV(-0.9, y2-0.18, -R2-0.06), 0.06, 12); tips.push(slV(-0.95, y2-0.18, -R2-0.06)); }
  /* running gear: narrow track, tall skinny tyres, Moon discs */
  var tr=0.62, tf=0.56;
  for(sd=-1;sd<=1;sd+=2){ slRod(B, "tube", slV(0, 0.36, sd*R2*0.7), slV(0, 0.36, sd*(tr-0.07)), 0.035, 8); slRod(B, "tube", slV(0, 0.3, sd*(tr-0.1)), slV(1.0, y2-0.2, sd*0.3), 0.016, 6);
    slRod(B, "chrome", slV(2.9, 0.33, sd*(tf-0.08)), slV(2.2, y2-0.12, sd*0.18), 0.016, 6); slRod(B, "chrome", slV(2.9, 0.36, sd*(tf-0.08)), slV(2.9, 0.36, sd*0.1), 0.02, 6);
    B.add("black", slBox(0.06, 0.12, 0.05, 0.01), sc_M(2.9, 0.33, sd*(tf-0.07))); }
  B.add("chrome", slBox(0.05, 0.045, tf*2-0.16, 0.01), sc_M(2.9, 0.36, 0));
  slWheel(W, 0, -tr, 0.355, 0.13, {moon:L.moon}); slWheel(W, 0, tr, 0.355, 0.13, {moon:L.moon}); slWheel(W, 2.9, -tf, 0.33, 0.1, {moon:L.moon}); slWheel(W, 2.9, tf, 0.33, 0.1, {moon:L.moon});
  if(aero) for(sd=-1;sd<=1;sd+=2) B.add("acc", slBox(0.34, 0.022, 0.26, 0.006), sc_M(3.4, y2-0.08, sd*0.36, 0, 0, 0.12));
  if(!tips.length) tips.push(slV(-0.3, y2+0.2, -0.5), slV(-0.3, y2+0.2, 0.5));
  /* livery on the tank (curved, so the decals ride just off the surface) */
  for(sd=-1;sd<=1;sd+=2){
    slDecalTank(B, SL_ATL.numB, 1.75, y2, 0.06, 0.56, 0.35, sd, rAt);
    slDecalTank(B, SL_ATL.cls, -1.0, y2, 0.02, 0.4, 0.125, sd, rAt);
    slDecalTank(B, SL_ATL.sp[0], 0.6, y2, 0.1, 0.62, 0.19, sd, rAt);
    slDecalTank(B, SL_ATL.sp[1], 2.75, y2, 0.02, 0.5, 0.155, sd, rAt);
    if(GFX!=="lite"){ slDecalTank(B, SL_ATL.sp[2], 0.6, y2, -0.12, 0.5, 0.155, sd, rAt); slDecalTank(B, SL_ATL.tech, -0.25, y2, -0.13, 0.13, 0.13, sd, rAt); slDecalTank(B, SL_ATL.rail, 1.6, y2, -0.2, 0.9, 0.085, sd, rAt); } }
  slDecal(B, SL_ATL.numT, [-1.4, y2+0.27, 0.015], [1,0,0], [0,1,0], 0.26, 0.14); slDecal(B, SL_ATL.numT, [-1.4, y2+0.27, -0.015], [-1,0,0], [0,1,0], 0.26, 0.14);
  ls.push({role:"hood", w:0.5, h:0.22, p:[2.6,tTop(2.6)+0.012,0], u:[0,0,1], v:[1,0,0]});
  return {rr:0.355, anchor:slV(X2-0.05, y2, 0), chuteLen:6.5, chuteRise:0.5, chuteR:0.9, len:L2, tail:X2, nose:X2+L2, top:top+0.42, wb:2.9};
}

/* Modified roadster: a channelled '32 tub on a Deuce frame, the '32 grille shell up front, the engine in the open
   with headers, a chopped screen, roll bar, the driver in his seat; Moon discs; a proper rear spoiler on the deck. */
function slRoadster(B, W, L, E, aero, tips, ls, k){
  var sd, i, deck=1.0;
  /* frame rails (the reveal under the body), crossmember, nerf */
  for(sd=-1;sd<=1;sd+=2){ B.add("black", slBox(3.85, 0.16, 0.07, 0.015), sc_M(0.9, 0.46, sd*0.38)); }
  B.add("black", slBox(0.08, 0.1, 0.8, 0.01), sc_M(2.6, 0.42, 0));
  /* the tub: rounded turtle deck at the back, cockpit, cowl */
  B.add("paint", slLoft([[-1.18,0.5,0.82,0.42,0.3,0.05,0],[-1.05,0.42,0.95,0.58,0.26,0.04,0.01],[-0.55,0.4,deck,0.62,0.13,0.03,0.015],[0.9,0.4,deck,0.61,0.1,0.03,0.015],[1.28,0.42,deck+0.02,0.52,0.1,0.03,0.01]], k, 3));
  B.add("well", slBox(0.92, 0.008, 0.96, 0.003), sc_M(0.2, deck+0.004, 0));
  B.add("black", slBox(0.05, 0.05, 1.0, 0.02), sc_M(0.68, deck+0.01, 0)); B.add("black", slBox(0.05, 0.05, 1.0, 0.02), sc_M(-0.28, deck+0.01, 0));
  for(sd=-1;sd<=1;sd+=2) B.add("black", slBox(0.98, 0.05, 0.05, 0.02), sc_M(0.2, deck+0.01, sd*0.49));
  B.add("black", slBox(0.2, 0.2, 0.7, 0.04), sc_M(-0.28, deck, 0));   /* seat back */
  /* chopped windscreen */
  B.add("cglass", slBox(0.02, 0.18, 0.9, 0.005), sc_M(1.08, deck+0.12, 0, 0, 0, 0.28));
  for(sd=-1;sd<=1;sd+=2) slRod(B, "chrome", slV(1.12, deck, sd*0.46), slV(1.04, deck+0.23, sd*0.46), 0.014, 6);
  B.add("chrome", slBox(0.025, 0.02, 0.94, 0.006), sc_M(1.04, deck+0.23, 0));
  slDriver(B, -0.02, 0.68, 0, 0.3, {wheel:[0.6, deck+0.1]});
  slHoop(B, -0.5, deck-0.02, deck+0.5, 0.3, [-1.0, 0.85]);
  /* '32 grille shell: chrome surround, painted insert with bars, the radiator cap on top; leans back a touch */
  var gx=2.62, gy=0.5, gs=new THREE.Shape(), hole=new THREE.Path();
  gs.moveTo(0,0); gs.lineTo(0.17,0); gs.quadraticCurveTo(0.21,0,0.215,0.05); gs.lineTo(0.27,0.56); gs.quadraticCurveTo(0.275,0.66,0.19,0.66); gs.lineTo(-0.19,0.66); gs.quadraticCurveTo(-0.275,0.66,-0.27,0.56); gs.lineTo(-0.215,0.05); gs.quadraticCurveTo(-0.21,0,-0.17,0); gs.lineTo(0,0);
  hole.moveTo(0,0.035); hole.lineTo(0.16,0.035); hole.quadraticCurveTo(0.18,0.035,0.183,0.06); hole.lineTo(0.235,0.55); hole.quadraticCurveTo(0.238,0.625,0.18,0.625); hole.lineTo(-0.18,0.625); hole.quadraticCurveTo(-0.238,0.625,-0.235,0.55); hole.lineTo(-0.183,0.06); hole.quadraticCurveTo(-0.18,0.035,-0.16,0.035); hole.lineTo(0,0.035);
  gs.holes.push(hole);
  var gm=new THREE.Matrix4().compose(slV(gx, gy, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, PI/2, 0.1, "ZYX")), slV(1,1,1));
  var ge=new THREE.ExtrudeGeometry(gs, {depth:0.1, bevelEnabled:true, bevelThickness:0.012, bevelSize:0.01, bevelSegments:1, curveSegments:GFX==="lite"?2:5}); ge.translate(0,0,-0.08); B.add("chrome", ge, gm);
  var ins=new THREE.ShapeGeometry(new THREE.Shape(hole.getPoints(4))); B.add("satin", ins, gm.clone().multiply(new THREE.Matrix4().makeTranslation(0,0,-0.05)));
  for(i=-5;i<=5;i+=(GFX==="lite"?2:1)){ var bz=i*0.038; B.add("chrome", slBox(0.01, 0.56-Math.abs(i)*0.006, 0.006, 0.002), gm.clone().multiply(new THREE.Matrix4().makeTranslation(bz, 0.33, -0.04))); }
  B.add("chrome", sc_cyl(0.03, 10), gm.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.69, -0.04)).multiply(new THREE.Matrix4().makeScale(1, 0.06, 1)));
  B.add("black", slBox(0.1, 0.56, 0.5, 0.02), sc_M(gx-0.14, gy+0.3, 0));   /* radiator core */
  /* the engine in the open: headers out the sides into side pipes along the frame */
  var eng=E.diesel?{x:1.85, y:0.92}:{x:1.88, y:0.86};
  slEngine(B, E, {x:eng.x, y:eng.y, open:true, exh:E.kind==="v"||E.kind==="flat"?"zoomie":"side", sideX:0.55, sideY:0.36, sideZ:0.68, tips:tips, stackTop:deck+0.55, stackZ:0.2});
  /* front end: dropped and drilled beam axle, transverse spring, wishbones, shocks */
  var fx=2.75, tf=0.66, tr=0.72;
  B.add("chrome", sc_prof([[-0.6,0.31],[-0.45,0.31],[-0.24,0.2],[0.24,0.2],[0.45,0.31],[0.6,0.31],[0.6,0.36],[0.45,0.36],[0.24,0.25],[-0.24,0.25],[-0.45,0.36],[-0.6,0.36]], 0.05, 0.006), sc_M(fx, 0, 0, 0, PI/2, 0));
  B.add("satin", slBox(0.05, 0.03, 0.9, 0.01), sc_M(fx-0.05, 0.47, 0, 0.0, 0, 0));
  for(sd=-1;sd<=1;sd+=2){ slRod(B, "chrome", slV(fx, 0.31, sd*0.5), slV(1.9, 0.42, sd*0.08), 0.016, 6); slRod(B, "chrome", slV(fx, 0.33, sd*0.5), slV(1.9, 0.42, sd*0.32), 0.016, 6);
    slRod(B, "satin", slV(fx-0.06, 0.33, sd*0.52), slV(fx-0.15, 0.55, sd*0.4), 0.022, 6); slRod(B, "chrome", slV(fx, 0.31, sd*0.56), slV(fx, 0.31, sd*(tf-0.05)), 0.03, 8); }
  /* rear: chute pack on the tail, the rear axle, the spoiler on the deck */
  slChutePack(B, -1.25, 0.72, 0); B.add("satin", slBox(0.06, 0.06, 1.25, 0.01), sc_M(0, 0.343, 0));
  if(aero){ B.add("paint", sc_prof([[0.0,0],[-0.5,0],[-0.5,0.2],[-0.42,0.2]], 1.16, 0.01), sc_M(-0.6, 0.85, 0));
    B.add("acc", slBox(0.12, 0.02, 1.18, 0.006), sc_M(-1.06, 1.06, 0, 0, 0, 0.0)); for(sd=-1;sd<=1;sd+=2) B.add("paint", sc_prof([[0.05,0],[-0.55,0],[-0.55,0.3]], 0.016, 0.004), sc_M(-0.58, 0.82, sd*0.59)); }
  slWheel(W, 0, -tr, 0.343, 0.27, {moon:L.moon}); slWheel(W, 0, tr, 0.343, 0.27, {moon:L.moon}); slWheel(W, fx, -tf, 0.31, 0.12, {moon:L.moon}); slWheel(W, fx, tf, 0.31, 0.12, {moon:L.moon});
  if(!tips.length) tips.push(slV(0.45, 0.36, -0.68), slV(0.45, 0.36, 0.68));
  /* livery: the number big on the doors, class plate behind, sponsors on the cowl and the tail; a sponsor rail */
  var zs=0.615;
  slDecal2(B, SL_ATL.numB, 0.35, 0.7, zs, 0.52, 0.33);
  slDecal2(B, SL_ATL.cls, -0.55, 0.82, zs, 0.38, 0.12);
  slDecal2(B, SL_ATL.sp[0], 1.0, 0.7, zs-0.006, 0.42, 0.13);
  slDecal2(B, SL_ATL.sp[1], -0.55, 0.62, zs, 0.42, 0.13);
  if(GFX!=="lite"){ slDecal2(B, SL_ATL.rail, 0.25, 0.48, zs, 1.1, 0.12); slDecal2(B, SL_ATL.tech, 1.0, 0.53, zs-0.006, 0.1, 0.1); }
  slDecal(B, SL_ATL.numT, [-0.85, 0.94, 0], [0,0,1], [1,0,0], 0.5, 0.26);
  ls.push({role:"hood", w:0.5, h:0.18, p:[0.98,deck+0.025,0], u:[0,0,1], v:[1,0,0]}, {role:"side", w:0.42, h:0.13, p:[1.0,0.53,zs+0.002], u:[1,0,0], v:[0,1,0]}, {role:"side", i:1, w:0.42, h:0.13, p:[1.0,0.53,-zs-0.002], u:[-1,0,0], v:[0,1,0]});
  return {rr:0.343, anchor:slV(-1.4, 0.72, 0), chuteLen:5.5, chuteRise:0.45, chuteR:0.85, len:4.4, tail:-1.4, nose:fx+0.31, top:deck+0.5, wb:fx};
}

/* Altered: the strip's muscle shell set up for the salt: the engine's hood hardware, number boards on the doors
   with the class plate, taped headlights, a chute pack, Moon discs, a real spoiler; diesel / rotary / two-stroke cues. */
function saltAlteredV2(L, aero){
  var E=L.eng, hw={asp:E.asp==="blower"?"blower":E.asp==="centri"?"centri":E.asp==="twin"?"twin":E.asp==="turbo"?"turbo":"na", ic:E.ic, n2o:E.n2o, diesel:E.diesel, style:"muscle"};
  var car=stripCar("street", L.color, 26.5, hw), U=car.userData, me=U.meta, g=new THREE.Group(), inner=U.bodyGroup.children[0], B=sc_bin(), M=sc_mats(), i, sd;
  car.position.x=-me.xr; g.add(car);
  /* door number boards (the strip's door decals carry them) */
  var board=slDoorMat(L); U.liv.dm=board; U.liv.num=L.num; for(i=0;i<U.liv.door.length;i++) U.liv.door[i].material=board;
  /* headlight tape: a silver panel over each lamp, crossed with black tape */
  var hl=U.lights.head[0];
  if(hl){ hl.geometry.computeBoundingBox(); var bb=hl.geometry.boundingBox, pa=hl.geometry.attributes.position, lb=[new THREE.Box3(), new THREE.Box3()], v=new THREE.Vector3();
    for(i=0;i<pa.count;i++){ v.fromBufferAttribute(pa,i); lb[v.z<0?0:1].expandByPoint(v); }
    lb.forEach(function(b){ if(b.isEmpty()) return; var c=b.getCenter(new THREE.Vector3()), s=b.getSize(new THREE.Vector3()), xx=b.max.x+0.004;
      if(GFX!=="lite") B.add("alu", slBox(0.01, s.y*1.04, s.z*1.04, 0.003), sc_M(xx, c.y, c.z));
      B.add("black", slBox(0.008, 0.03, Math.hypot(s.y,s.z)*0.95, 0.002), sc_M(xx+0.006, c.y, c.z, Math.atan2(s.y,s.z), 0, 0));
      B.add("black", slBox(0.008, 0.03, Math.hypot(s.y,s.z)*0.95, 0.002), sc_M(xx+0.006, c.y, c.z, -Math.atan2(s.y,s.z), 0, 0)); });
    hl.visible=false; }
  /* chute pack over the rear bumper; the strip chute already anchors there */
  var an=me.anchor; slChutePack(B, an.x+0.06, an.y+0.12, 0);
  /* class plate on the rear quarter window line, the sponsor rail on the rocker */
  var bbx=new THREE.Box3(); U.liv.door.forEach(function(d){ d.geometry.computeBoundingBox(); bbx.union(d.geometry.boundingBox); });
  if(!bbx.isEmpty()){ var zq=bbx.max.z+0.003, yq=bbx.min.y;
    if(GFX!=="lite") slDecal2(B, SL_ATL.cls, bbx.min.x-0.45, yq+0.18, zq-0.02, 0.4, 0.125);   /* Lite: the door boards carry the class */
    if(GFX!=="lite"){ slDecal2(B, SL_ATL.rail, (bbx.min.x+bbx.max.x)/2, yq-0.1, zq-0.012, 1.3, 0.13); slDecal2(B, SL_ATL.sp[0], bbx.max.x+0.62, yq+0.12, zq-0.04, 0.42, 0.13); } }
  /* Moon discs on the strip wheels */
  var MB=sc_bin(); if(GFX!=="lite") U.carriers.forEach(function(cw){ var cu=cw.userData, sd2=cu.side; MB.add(L.moon==="paint"?"paint":"chrome", slMoonGeo(cu.r*0.58, cu.r*0.12, GFX==="lite"?12:18), sc_M(cw.position.x, cw.position.y, cw.position.z+sd2*cu.hw*0.9, sd2*PI/2, 0, 0)); });
  slBuild(MB, car, slMats(L), true);
  /* engine cues the strip shell doesn't carry */
  var tips=[];
  if(E.diesel){ for(sd=-1;sd<=1;sd+=2){ var sx=me.xf-0.85, a=slV(sx, 0.9, sd*0.32), b=slV(sx-0.06, 1.5, sd*0.34); slRod(B, "chrome", a, b, 0.045, 12); tips.push(b); } }
  if(E.kind==="rotary"){ slRod(B, "chrome", slV(me.xf-1.0, 0.3, -0.7), slV(me.xr+0.9, 0.22, -0.82), 0.05, 12); }
  if(E.kind==="two") for(sd=-1;sd<=1;sd+=2) slCylX(B, "barrel", me.xr-1.05, 0.28, sd*0.3, 0.03, 0.3, 8);
  if(aero){ var pm=inner.getObjectByName("sc_paint"), lip={x:me.xr-0.95, y:1.1, z:0.7};
    if(pm){ var pp=pm.geometry.attributes.position, mx=1e9, j; for(j=0;j<pp.count;j++) mx=Math.min(mx, pp.getX(j)); lip.y=0; lip.z=0;
      for(j=0;j<pp.count;j++) if(pp.getX(j)<mx+0.14){ lip.y=Math.max(lip.y, pp.getY(j)); lip.z=Math.max(lip.z, Math.abs(pp.getZ(j))); } lip.x=mx+0.1; }
    B.add("black", sc_prof([[0.12,0],[-0.14,0],[-0.16,0.12],[-0.04,0.07]], lip.z*2-0.06, 0.008), sc_M(lip.x, lip.y-0.01, 0));
    for(sd=-1;sd<=1;sd+=2) B.add("black", slBox(0.32, 0.17, 0.012, 0.004), sc_M(lip.x-0.02, lip.y+0.05, sd*(lip.z-0.03))); }
  slBuild(B, inner, slMats(L), GFX==="lite");
  if(!tips.length) tips=U.exhaustTips.slice(0,2);
  g.userData={body:"altered", me:{rr:me.rr, anchor:me.anchor.clone().add(new THREE.Vector3(-me.xr,0,0)), len:4.6, tail:-2.3-me.xr, nose:2.3-me.xr, top:1.4, wb:me.xf-me.xr}, strip:true, car:car, chutes:[], A:[], piv:inner, tips:tips, look:L};
  return g;
}
/* the Altered's door board: white board, black number, the class plate under it */
function slDoorMat(L){
  var key="door|"+L.key; if(SLC.mat[key]) return SLC.mat[key];
  var c=sc_canvas(512,200), x=c.getContext("2d"), F="'Chakra Petch','Barlow Condensed','Arial Narrow',Arial,sans-serif";
  x.clearRect(0,0,512,200); spRRect(x, 6, 6, 300, 188, 14); x.fillStyle="#f4efe2"; x.fill(); x.lineWidth=7; x.strokeStyle="#141414"; x.stroke();
  x.fillStyle="#141414"; x.textAlign="center"; x.textBaseline="middle"; x.font="700 "+(L.num.length>3?110:140)+"px "+F; x.fillText(L.num, 156, 104, 270);
  x.fillStyle="#f4efe2"; x.fillRect(318, 120, 188, 66); x.strokeStyle="#141414"; x.lineWidth=5; x.strokeRect(321, 123, 182, 60); x.fillStyle="#141414"; x.font="700 44px "+F; x.fillText(L.cls||"ALT", 412, 156, 170);
  slSponsor(x, SL_SPONSORS[L.sponsors[0]], 316, 12, 192, 100);
  var t=sc_ctex(c), q=new THREE.MeshStandardMaterial({map:t, transparent:true, depthWrite:false, roughness:0.3, metalness:0.05, polygonOffset:true, polygonOffsetFactor:-3});
  var env=sc_env(); if(env) q.envMap=env; q.userData.perBuild=true; q.userData.ownMaps=[t];
  SLC.mat[key]=q; return q;
}
/* drop the cars built for an older look (a new meet number, a repaint): their merged geometry goes, shared pieces stay */
function saltCarsPrune(){
  for(var k in SALT.cars){ var V=SALT.cars[k]; if(V===SALT.cur) continue; if(V.parent) V.parent.remove(V);
    V.traverse(function(q){ if(q.geometry && !q.geometry.__cached && q.name && q.name.indexOf("sl_")===0) q.geometry.dispose(); }); delete SALT.cars[k]; }
}
