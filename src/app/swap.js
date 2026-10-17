/* ===================== ENGINE SWAPS: Build › Swap — pick a car, read the fit, buy the fixes ===================== */
/* One layer for every event that puts the engine in a car. The vehicle catalogue and the fit check live in
   sim/swap.js; this file keeps what you own (career: C().swap, sandbox: S.swapSb), the chosen car (S.env.swapV),
   and hands the car to the road test, the strip, the salt and the 24 Hours. Pull and bog keep their class trucks:
   their rules define the truck, so a swap there would be a different class, not the same event in your car.
   No swapV (the default) → every event runs exactly as before. */
const SW_DOT={g:"good",a:"warn",r:"crit"},SW_WORD={g:"fits",a:"tight",r:"no"};
const swEsc=v=>String(v==null?"":v).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
function swapStore(){if(career()){const c=C();if(!c.swap||typeof c.swap!=="object")c.swap={};const s=c.swap;if(!s.own||typeof s.own!=="object")s.own={};if(!s.fx||typeof s.fx!=="object")s.fx={};return s;}
  if(!S.swapSb||typeof S.swapSb!=="object")S.swapSb={};const s=S.swapSb;if(!s.own||typeof s.own!=="object")s.own={};if(!s.fx||typeof s.fx!=="object")s.fx={};return s;}
const swapFree=()=>!career()||dev();
function swapOwns(v){return swapFree()||!!swapStore().own[v];}
/* the chosen car: only one you own (career) */
function swapVid(){const v=S&&S.env&&S.env.swapV;return v&&SIM.VEHICLES[v]&&swapOwns(v)?v:null;}
function swapOwnFx(v){const f=swapStore().fx[v];return Array.isArray(f)?f.filter(id=>SIM.SWAP_FIX[id]):[];}
let swCache={k:"",r:null};
function swapRep(cfg,res,vid,fx){vid=vid||swapVid();cfg=cfg||S.cfg;res=res||quick;if(!vid||!res)return null;fx=fx||swapOwnFx(vid);
  const k=cfgHash(cfg)+"|"+vid+"|"+fx.join(",")+"|"+Math.round(res.peakTq)+"|"+Math.round(res.kg)+"|"+Math.round(res.peakHp);
  if(swCache.k!==k)swCache={k,r:SIM.swapFit(cfg,res,vid,fx)};return swCache.r;}
/* what the events use: the car, only once the engine is in (nothing in the bay red) */
function swapLive(cfg,res){const r=swapRep(cfg,res);return r&&r.fits?r:null;}
function swapRoadOpt(o){const r=swapLive();if(!r)return o;const e=S.env;
  return Object.assign(o,{car:r.car,ch:r.look,tyre:e.roadTyre&&SIM.ROAD_TYRES[e.roadTyre]?e.roadTyre:r.car.tyre,sw:r.v,rk:r.look+"@"+r.v,dl:r.dlRatio,cool:r.coolRatio});}
function swapDragOv(v){const r=swapLive();return r?Object.assign(v,SIM.swapDragVeh(r)):v;}
function swapSaltBody(){const r=swapLive();return r?SIM.swapLsrBody(r):null;}
function swapSaltOv(v){const r=swapLive();if(r){v.bodyObj=SIM.swapLsrBody(r);v.dlCap=r.dlCap;}return v;}
/* the road lap: a driveline over its rating goes on the first full-throttle exit in a low gear */
function swapRoadBreak(lap,T,opt){if(!opt||!(opt.dl>1||opt.dtBrk))return null;const tr=lap.trace;let i0=-1;
  for(let i=1;i<lap.N;i++)if(tr.thr[i]>=0.98&&tr.g[i]<=3&&tr.t[i]>1){i0=i;break;}
  if(i0<0)i0=Math.min(lap.N-1,Math.floor(lap.N*0.08));const s=i0*lap.ds,c=(T.corners||[]).filter(q=>q.s1<=s+5).pop();
  return{t:tr.t[i0],s:Math.round(s),corner:c&&c.name?c.name:"the first corner"};}
/* ---- the fun: one line for the result screen, picked by how absurd the swap is ---- */
function swapQuips(r){const q=[],V=r.V,n=V.n,hp=Math.round((quick&&quick.peakHp)||0),pw=hp/(r.mass/1000);
  if(S.cfg.layout==="D18"&&r.v==="trabant")q.push("Deltic in a Trabant: the car is now mostly engine.");
  else if(r.mostly)q.push(`The ${n} is now mostly engine: ${Math.round(r.ekg).toLocaleString("en-CA")} kg of it, against ${Math.round(V.mass-V.eng).toLocaleString("en-CA")} kg of car.`);
  if(r.inf)q.push(`There is no ${n} any more, only a ${n}-shaped hat on an engine.`);
  else if(r.hood)q.push("Forward visibility is now a matter of opinion.");
  if(r.cabin)q.push("The passenger seat has been replaced by the back half of the engine.");
  if(r.dlRatio>1)q.push("The driveline is now a fuse.");
  if(r.coolRatio>1.6)q.push("Bring marshmallows: the radiator can't keep up and everybody will know.");
  if(pw>450&&V.mass<1100&&!r.mostly)q.push(`Sleeper: ${hp} hp in a ${n}. Nobody at the lights sees it coming.`);
  if(r.ekg<V.eng*0.35&&V.mass>2000)q.push(`A ${n} powered by roughly a lawnmower's worth of ambition.`);
  if(!q.length)q.push(r.items.every(x=>x.st==="g")?`Bolt-in swap: the ${n} doesn't know it was ever anything else.`:`In the ${n} it goes, with a little persuasion.`);
  return q;}
function swapTag(){const r=swapLive();if(!r)return null;return{v:r.v,n:r.V.n,q:swapQuips(r)[0],mostly:!!r.mostly,inf:!!r.inf,mass:Math.round(r.mass),front:+r.front.toFixed(3),dl:+r.dlRatio.toFixed(2),cool:+r.coolRatio.toFixed(2),eng:S.cfg.layout};}
/* a result screen banner: which car, the quip, what broke */
function swapVerdict(res){const r=res&&(res.road||res.drag||res.salt||res.e24);const t=r&&r.swap;if(!t)return"";const brk=r.swapBroke||r.broke==="driveline"||(r.dnf&&r.dnf.id==="swap_driveline");
  return `<div class="swban${brk?" brk":""}"><b>${swEsc(t.n)} · engine swap</b><span>${swEsc(t.q)}${brk?" The driveline let go — the engine is fine; the car needs a stronger gearbox and axle.":""}</span></div>`;}
function swapRoadVerdict(r){const b=r.swapBroke;return `<div class="verdict fail"><div style="flex:1"><div class="big">DRIVELINE LET GO</div><p>${swEsc(r.chName)} — it broke on the exit of ${swEsc(b.corner)}, ${b.t.toFixed(1)} s into the lap. The gearbox and axle are rated below what this engine makes. No lap time; the engine is fine.</p></div></div>`;}
/* the note on each car event's panel */
function swapEnvNote(){const v=S.env&&S.env.swapV,V=v&&SIM.VEHICLES[v];if(!V)return"";const r=swapLive();
  if(!r)return `<p class="hint swnote">Your ${swEsc(V.n)} swap ${swapOwns(v)?"doesn't fit yet (Build › Swap)":"isn't bought yet"} — this runs in the event car. <button class="chip" data-swoff>Clear the swap</button></p>`;
  const bad=r.items.filter(x=>x.st==="r"&&x.k!=="mass").map(x=>x.n.split(" · ")[0].toLowerCase());
  return `<div class="swnote on"><b>Car · ${swEsc(V.n)}</b><span>engine swap · ${Math.round(r.mass+75).toLocaleString("en-CA")} kg with a driver · ${Math.round(r.front*100)}% front · ${V.drive.toUpperCase()}${bad.length?` · <em>${bad.join(", ")} red</em>`:""}. Body, weight, tyres and drag come from the car.</span><button class="chip" data-swoff>Use the event cars</button></div>`;}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-swoff]");if(!b)return;if(testing){toast("Let the run finish first");return;}S.env.swapV=null;save();if(typeof renderEnv==="function")renderEnv();swapRender();toast("Back to the event cars");});
/* ---- achievements: the swap group ---- */
ACH_GROUPS.push(["swap","Swaps"]);
ACH.push(
  {g:"swap",id:"swap1",name:"Donor car",desc:"Run any car event with your engine swapped into a car.",ic:"flag",tier:"bronze",check:x=>!!x.swapRun},
  {g:"swap",id:"swapmostly",name:"Mostly engine",desc:"Run an event in a car the engine outweighs.",ic:"gauge",tier:"silver",check:x=>!!x.swapMostly},
  {g:"swap",id:"swapdeltic",name:"People's locomotive",desc:"Put a Deltic in a Trabant and take it somewhere.",ic:"star",tier:"gold",check:x=>!!x.swapDeltic},
  {g:"swap",id:"swaphat",name:"It's a hat now",desc:"Run with the body bolted on over the engine.",ic:"shield",tier:"silver",check:x=>!!x.swapHat},
  {g:"swap",id:"swapfuse",name:"Driveline fuse",desc:"Break a swap car's gearbox or axle.",ic:"bolt",tier:"bronze",check:x=>!!x.swapFuse},
  {g:"swap",id:"swapsleeper",name:"Sleeper",desc:"0–100 km/h under 4.5 s in a Trabant, Saab 96, Beetle, Mini or lawn mower.",ic:"clock",tier:"gold",check:x=>!!x.swapSleeper});
/* called by each event's finish with its result (r.swap set by swapTag) */
function swapAfter(r){const t=r&&r.swap;if(!t)return;const f={swapRun:true,swapMostly:t.mostly,swapDeltic:t.eng==="D18"&&t.v==="trabant",swapHat:t.inf,
  swapFuse:!!(r.swapBroke||r.broke==="driveline"||(r.dnf&&r.dnf.id==="swap_driveline")),swapSleeper:["trabant","saab96","beetle","mini","mower"].includes(t.v)&&r.zero100!=null&&r.zero100<4.5};
  achCheck({type:"swap",f});}
/* ---- market: swap jobs ("put a V8 in my C10"). The brief passes when the engine goes in with the fixes the owner pays for ---- */
function swapReqFit(q,res,cfg){const r=SIM.swapFit(cfg,res,q.v,q.fx||[]);if(!r)return{ok:true,val:"",prog:1};const bad=r.items.filter(x=>x.st==="r");
  return{ok:!bad.length,val:bad.length?bad.map(x=>x.n.split(" · ")[0].toLowerCase()).join(", ")+" red":"goes in",prog:clamp(1-bad.length/4,0,1)};}
REQ_LABEL.swap=["Their car",v=>`${(SIM.VEHICLES[v.v]||{}).n||"car"} · ${(v.fx||[]).length?(v.fx||[]).map(id=>(SIM.SWAP_FIX[id]||{}).n||id).join(", ").toLowerCase():"no cutting"}`];
MISS_W.swap=4;
SEGMENTS.push(
  {id:"swc10",name:"C10 restomod · put a V8 in it",tier:1,units:[1,2],price:7800,req:{hp:[300,420],rel:80,swap:{v:"c10",fx:["firewall","scoop","gbx1","rad1"]}}},
  {id:"swbeetle",name:"Beetle sleeper",tier:1,units:[1,1],price:8600,req:{hp:[160,240],rel:72,swap:{v:"beetle",fx:["firewall","scoop","gbx1","axle1","rad2"]}}},
  {id:"swmiata",name:"Miata V8 conversion",tier:2,units:[1,2],price:12500,req:{hp:[300,450],rel:75,swap:{v:"miata",fx:["firewall","tubs","scoop","gbx1","axle1","rad2"]}}},
  {id:"swsemi",name:"Show-truck highway tractor",tier:3,units:[1,1],price:21000,req:{tq:[2400,3000],rel:75,fuel:"diesel",swap:{v:"semi",fx:["gbx2","axle2","rad1"]}}});
CATS.push({id:"swap",name:"Swap jobs",sub:"their car · your engine · it has to fit",segs:["swc10","swbeetle","swmiata","swsemi"],rep:20});
/* ---- the silhouette: the car side-on, the bay dashed, the engine to scale (it pokes out when it doesn't fit) ---- */
const SW_SHAPE={   // length m; profile [x from the front bumper, height] m; fa: front axle x
  sedan:{L:5.0,fa:0.95,p:[[0,.35],[.05,.72],[1.55,.86],[2.15,1.36],[3.35,1.38],[4.15,.98],[5,.92],[5,.35]]},
  fastback:{L:4.6,fa:0.9,p:[[0,.33],[.05,.7],[1.5,.84],[2.05,1.3],[2.9,1.3],[4.5,.92],[4.6,.86],[4.6,.33]]},
  hatch:{L:4.0,fa:0.85,p:[[0,.32],[.05,.68],[1.0,.86],[1.6,1.35],[3.2,1.37],[3.95,1.0],[4,.32]]},
  trabant:{L:3.55,fa:0.75,p:[[0,.32],[.05,.7],[.85,.82],[1.35,1.42],[2.75,1.44],[3.45,.98],[3.55,.32]]},
  saab:{L:4.2,fa:0.65,p:[[0,.35],[.08,.72],[.9,.88],[1.6,1.44],[2.6,1.46],[3.9,1.0],[4.2,.62],[4.2,.35]]},
  beetle:{L:4.1,fa:0.68,p:[[0,.36],[.1,.78],[1.05,.95],[1.55,1.48],[2.4,1.5],[3.6,1.05],[4.05,.62],[4.1,.36]]},
  mini:{L:3.05,fa:0.5,p:[[0,.3],[.04,.72],[.72,.84],[1.0,1.33],[2.85,1.35],[3.0,.95],[3.05,.3]]},
  wagon:{L:4.8,fa:0.9,p:[[0,.33],[.05,.72],[1.3,.88],[1.95,1.42],[4.7,1.44],[4.8,.95],[4.8,.33]]},
  roadster:{L:3.95,fa:0.8,p:[[0,.3],[.05,.62],[1.55,.78],[1.85,1.18],[2.05,.95],[3.85,.92],[3.95,.3]]},
  seven:{L:3.4,fa:0.55,p:[[0,.3],[.1,.62],[1.75,.74],[1.95,1.0],[2.45,.82],[3.35,.82],[3.4,.3]]},
  pickup:{L:5.3,fa:1.05,p:[[0,.45],[.05,1.02],[1.75,1.1],[2.15,1.82],[3.05,1.84],[3.1,1.25],[5.3,1.25],[5.3,.45]]},
  jeep:{L:3.6,fa:0.75,p:[[0,.5],[.02,1.12],[1.55,1.15],[1.75,1.75],[1.8,1.2],[3.55,1.2],[3.6,.5]]},
  semi:{L:7.2,fa:1.25,p:[[0,.6],[.05,1.85],[2.4,2.0],[2.6,3.3],[4.3,3.4],[4.4,1.5],[7.2,1.3],[7.2,.6]]},
  tractor:{L:4.0,fa:0.75,p:[[0,.55],[.05,1.3],[1.9,1.45],[2.0,2.7],[3.3,2.7],[3.35,1.6],[4.0,1.4],[4.0,.55]]},
  mower:{L:1.85,fa:0.25,p:[[0,.25],[.05,.5],[.95,.6],[1.15,.95],[1.55,1.0],[1.85,.6],[1.85,.25]]},
  bus:{L:4.5,fa:0.45,p:[[0,.4],[.05,1.0],[.3,1.9],[.6,2.0],[4.4,2.0],[4.5,1.6],[4.5,.4]]},
  hearse:{L:6.1,fa:1.05,p:[[0,.36],[.05,.75],[1.75,.9],[2.35,1.45],[5.9,1.48],[6.1,1.0],[6.1,.36]]},
  p911:{L:4.3,fa:0.82,p:[[0,.32],[.06,.64],[1.2,.8],[1.75,1.3],[2.6,1.32],[4.1,.9],[4.3,.55],[4.3,.32]]}};
function swapSil(r){const V=r.V,sh=SW_SHAPE[V.shape]||SW_SHAPE.sedan,tyR=V.tyre*0.0254/2,fa=sh.fa,ra=fa+V.wb,rear=!!V.rear;
  // the bay: at the front (over and just behind the front axle) or behind the rear axle; fixes stretch it
  const add=[0,1,2].map(i=>r.fx.reduce((a,id)=>a+(((SIM.SWAP_FIX[id]||{}).bay||[0,0,0])[i]||0),0));
  const bayL=(V.bay[0]+add[0])/1000,bayH=(V.bay[2]+add[2])/1000,floor=Math.max(0.16,tyR*0.6);
  const bx0=rear?ra-0.25:Math.max(0.12,fa-0.35),eL=r.eDim[0]/1000,eH=r.eDim[2]/1000;
  const bx=rear?[bx0,bx0+bayL]:[bx0,bx0+bayL],ex=rear?[bx0,bx0+eL]:[bx0,bx0+eL];
  const xmin=Math.min(0,ex[0])-0.2,xmax=Math.max(sh.L,ex[1])+0.2,ymax=Math.max(...sh.p.map(p=>p[1]),floor+eH,floor+bayH)+0.15,W=xmax-xmin,H=ymax+0.05;
  const X=x=>((x-xmin)*100).toFixed(1),Y=y=>((ymax-y)*100).toFixed(1);
  const body=sh.p.map((p,i)=>(i?"L":"M")+X(p[0])+" "+Y(p[1])).join(" ")+"Z";
  const wheel=(x,rr)=>`<circle cx="${X(x)}" cy="${Y(rr)}" r="${(rr*100).toFixed(1)}" class="sw-wh"/><circle cx="${X(x)}" cy="${Y(rr)}" r="${(rr*45).toFixed(1)}" class="sw-hub"/>`;
  const frR=V.shape==="tractor"?tyR*0.55:tyR;
  const pokes=eH>bayH+0.001||eL>bayL+0.001;
  return `<svg class="swsil" viewBox="0 0 ${(W*100).toFixed(0)} ${(H*100).toFixed(0)}" role="img" aria-label="${swEsc(V.n)} side view with the engine to scale">
    <line x1="0" y1="${Y(0)}" x2="${(W*100).toFixed(0)}" y2="${Y(0)}" class="sw-gnd"/>
    <path d="${body}" class="sw-body"/>${wheel(fa,frR)}${wheel(ra,tyR)}
    <rect x="${X(bx[0])}" y="${Y(floor+bayH)}" width="${(bayL*100).toFixed(1)}" height="${(bayH*100).toFixed(1)}" class="sw-bay"/>
    <rect x="${X(ex[0])}" y="${Y(floor+eH)}" width="${(eL*100).toFixed(1)}" height="${(eH*100).toFixed(1)}" rx="3" class="sw-eng${pokes?" out":""}"/>
  </svg>`;}
/* ---- the Build section ---- */
let swOpenG=null;
function swapRender(){if(!SW_READY)return;const box=$("swapBody"),sum=$("swapSum");if(!box||!S)return;const v=S.env&&S.env.swapV,V=v&&SIM.VEHICLES[v],r=V&&quick?swapRep(S.cfg,quick,v):null;
  if(sum)sum.innerHTML=!V?"on the stand":`${swEsc(V.n)}${r?" · "+["r","a"].map(s=>{const n=r.items.filter(x=>x.st===s).length;return n?`<i class="sw-${s}">${n} ${s==="r"?"red":"amber"}</i>`:"";}).filter(Boolean).join(" ")||" · all green":""}`;
  if(!$("swapAcc").classList.contains("open"))return;   // perf: the body fills when the section is open
  const g0=swOpenG||(V&&V.g)||"muscle";
  let h=`<div class="hint swhint"><span>Put this engine in a car: size, torque, heat and weight decide the fit.</span><details class="more"><summary aria-label="More info">ⓘ</summary><div>The road test, strip, salt and 24 Hours run in the car you pick; pull and bog keep their class trucks.</div></details></div>`;
  h+=`<div class="chips swg">${SIM.VEH_GROUPS.map(([id,n])=>`<button class="chip${g0===id?" on":""}" data-swg="${id}">${n}</button>`).join("")}<button class="chip${!V?" on":""}" data-swv="">None</button></div>`;
  h+=`<div class="seg wide swvs">${Object.values(SIM.VEHICLES).filter(x=>x.g===g0).map(x=>`<button data-swv="${x.id}" class="${v===x.id?"on":""}">${swEsc(x.n)}<small>${x.mass.toLocaleString("en-CA")} kg · ${x.drive.toUpperCase()}${swapOwns(x.id)?"":` · ${fmt$(x.price)}`}</small></button>`).join("")}</div>`;
  if(!V){box.innerHTML=h;return;}
  if(!swapOwns(v)){h+=`<div class="swbuy"><span>${swEsc(V.n)} — the donor car costs <b>${fmt$(V.price)}</b>.</span><button class="btn sm pri" data-swbuy="${v}" ${C().cash<V.price?"disabled":""}>Buy it</button></div>`;box.innerHTML=h;return;}
  if(!r){box.innerHTML=h;return;}
  const own=swapOwnFx(v),D=r.dims;
  h+=`<div class="swsilw">${swapSil(r)}<div class="swcap"><span>Engine ${D.L} × ${D.W} × ${D.H} mm${V.tv?" · turned across the car":""}</span><span>Bay ${V.bay.join(" × ")} mm · stock ${swEsc(V.famN)}</span></div></div>`;
  const shellAt=r.items.findIndex(x=>x.st==="r"&&(x.k==="len"||x.k==="wid"||x.k==="hgt"));   // the shell is offered once, on the first red bay item
  h+=`<div class="swrep">${r.items.map((it,ii)=>{const st=it.st;let val,why;
    if(it.k==="len"||it.k==="wid"||it.k==="hgt"){val=it.room==null?`${it.have} mm · any`:`${it.have} / ${it.room} mm`;why=it.room==null?"the shell goes over it":st==="r"?`${it.over} mm too big`:st==="a"?"tight — a pry bar and patience":`${-it.over} mm spare`;}
    else if(it.k==="mass"){val=`${it.have.toLocaleString("en-CA")} kg · ${Math.round(it.front*100)}% front`;why=r.mostly?"the engine outweighs the car":`${it.have>=it.stock?"+":""}${(it.have-it.stock).toLocaleString("en-CA")} kg · front ${it.dF>=0?"+":""}${(it.dF*100).toFixed(1)} pts — ${it.dF>0.04?"pushes in corners, light at the back on launch":it.dF<-0.04?"light nose, loose on turn-in, hooks on launch":"handles as it did"}`;}
    else if(it.k==="rad"){val=`${it.have} / ${it.room} kW`;why=st==="r"?"overheats in long events (24 h, salt)":st==="a"?"runs hot in long events":"keeps up";}
    else{val=`${it.have.toLocaleString("en-CA")} / ${it.room.toLocaleString("en-CA")} N·m`;why=st==="r"?"breaks the first time it sees full load":st==="a"?"near its rating":"inside its rating";}
    const fxBtns=st==="g"?"":it.fixes.filter(id=>{const f=SIM.SWAP_FIX[id];if(own.includes(id)||(f.inf&&ii!==shellAt))return false;if(f.tier){const cur=own.map(o=>SIM.SWAP_FIX[o]).filter(o=>o.grp===f.grp).reduce((a,o)=>Math.max(a,o.tier),0);if(f.tier<=cur)return false;}return true;})
      .map(id=>{const f=SIM.SWAP_FIX[id],lk=f.need&&!own.includes(f.need);return `<button class="chip swfx${lk?" lk":""}" data-swf="${id}"${lk?` title="needs ${swEsc(SIM.SWAP_FIX[f.need].n)} first"`:""}>${swEsc(f.n)}<small>${swapFree()?"":fmt$(f.cost)+" · "}${swEsc(f.d)}</small></button>`;}).join("");
    const have=own.filter(id=>it.fixes.includes(id)&&!(SIM.SWAP_FIX[id].inf&&ii>0)).map(id=>`<button class="chip swhave" data-swr="${id}" title="remove">${swEsc(SIM.SWAP_FIX[id].n)} ✕</button>`).join("");
    return `<div class="swit s-${st}"><i class="dot" aria-label="${SW_WORD[st]}"></i><div class="swt"><b>${it.n}</b><span>${val}</span><small>${why}</small></div>${have||fxBtns?`<div class="swfxs">${have}${fxBtns}</div>`:""}</div>`;}).join("")}</div>`;
  // the result: the car on this engine (a standing start and top speed, judged with the road test's own sim)
  if(r.fits){let z="—",tp="—",qm="—";try{const p=SIM.roadPrep(S.cfg,quick),a=SIM.roadRun(p,{ch:r.look,car:r.car,tyre:r.car.tyre});z=a.zero100!=null?a.zero100.toFixed(1)+" s":"—";tp=Math.round(a.top.kmh)+" km/h";qm=a.quarter?a.quarter.t.toFixed(1)+" s":"—";}catch(e){}
    h+=`<div class="swres"><div class="vstats"><div><b>${z}</b><span>0–100 km/h</span></div><div><b>${qm}</b><span>1/4 mile</span></div><div><b>${tp}</b><span>top speed</span></div><div><b>${Math.round((quick.peakHp||0)/(r.mass/1000))}</b><span>hp / tonne</span></div></div><p class="swq">${swEsc(swapQuips(r).slice(0,2).join(" "))}</p></div>`;}
  else h+=`<p class="hint" style="color:var(--crit)">It doesn't go in yet — fix the red bay items. Until then the events run in their own cars.</p>`;
  if(r.cost&&swapFree())h+=`<p class="hint">Fixes fitted: ${fmt$(r.cost)} worth (free in the sandbox).</p>`;
  box.innerHTML=h;}
$("swapAcc").querySelector(".acch").addEventListener("click",e=>{toggleSec(e.currentTarget);swapRender();});
$("swapBody").addEventListener("click",e=>{const t=e.target.closest("button");if(!t)return;
  if(t.dataset.swg!=null){swOpenG=t.dataset.swg;swapRender();return;}
  if(testing){toast("Let the run finish first");return;}
  if(t.dataset.swv!=null){S.env.swapV=t.dataset.swv||null;if(t.dataset.swv)swOpenG=SIM.VEHICLES[t.dataset.swv].g;save();swapRender();buzz(6);return;}
  if(t.dataset.swbuy){const V=SIM.VEHICLES[t.dataset.swbuy];if(!V||C().cash<V.price){toast("Not enough cash");return;}C().cash-=V.price;swapStore().own[V.id]=1;logEvent(`Bought a ${V.n} as a swap donor — ${fmt$(V.price)}`);hud();save();swapRender();toast(`${V.n} is in the shop`);return;}
  const v=swapVid();if(!v)return;const st=swapStore(),own=swapOwnFx(v);
  if(t.dataset.swf){const id=t.dataset.swf,f=SIM.SWAP_FIX[id];if(!f)return;if(f.need&&!own.includes(f.need)){toast(`${SIM.SWAP_FIX[f.need].n} first`);return;}
    if(!swapFree()){if(C().cash<f.cost){toast("Not enough cash");return;}C().cash-=f.cost;logEvent(`${SIM.VEHICLES[v].n}: ${f.n.toLowerCase()} — ${fmt$(f.cost)}`);hud();}
    st.fx[v]=own.filter(o=>!(f.tier&&SIM.SWAP_FIX[o].grp===f.grp)).concat(id);save();swapRender();buzz(8);return;}
  if(t.dataset.swr){const id=t.dataset.swr;st.fx[v]=own.filter(o=>o!==id&&(SIM.SWAP_FIX[o].need!==id));save();swapRender();if(!swapFree())toast("Taken off — no refund on cut metal");}});
var SW_READY=true;   // a var (hoisted, undefined until here): recompute() may call swapRender before this file has run
