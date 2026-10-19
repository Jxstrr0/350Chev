/* ===================== ROAD TEST: the engine in a car ===================== */
/* pick a chassis, tyres and a circuit; the sim runs 0–100, the quarter, top speed and a flying lap, the view plays the lap */
let RT=null;
const ROAD_FEE=200,ROAD_CAMS=[["auto","Auto","director"],["chase","Chase","behind the car"],["side","Trackside","corner cameras"],["onboard","Onboard","driver's eye"]];
const fmtLap=(t,d)=>t==null||!isFinite(t)?"—":`${Math.floor(t/60)}:${(t%60).toFixed(d||1).padStart(d===2?5:4,"0")}`;
const rdEsc=v=>String(v==null?"":v).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
function roadEnvFix(){const e=S.env;if(!SIM.CHASSIS[e.roadCh])e.roadCh="coupe";if(!SIM.ROAD_TRACKS[e.roadTrk])e.roadTrk="club";if(e.roadTyre!=null&&!SIM.ROAD_TYRES[e.roadTyre])e.roadTyre=null;
  if(!(+e.roadFinal>=0.8&&+e.roadFinal<=1.25))e.roadFinal=1;if(![1,2,4].includes(+e.roadSpd))e.roadSpd=2;if(!ROAD_CAMS.some(c=>c[0]===e.roadCam))e.roadCam="auto";suFix(e);return e;}
function roadOpt(){const e=roadEnvFix();return swapRoadOpt({ch:e.roadCh,tyre:e.roadTyre||SIM.CHASSIS[e.roadCh].tyre,finalK:+e.roadFinal,dtCap:SIM.dtCapOf(drvId()),setup:suOpt()});}   // a chosen swap car (app/swap.js) stands in for the chassis
/* ---- setup sheet (Road Test + Pikes Peak share it): roll stiffness, front/rear split, wing. Saved in S.env (suSt/suSp/suWg), stock = 50/0/0 ---- */
/* the setup belongs to the engine on the bench, not to its numbers: S.suId names it, S.suMap[id] = [stiffness, balance, wing]
   (newest 24 kept; none = stock). Tweaking the build sliders keeps the id; loading another build (preset, blueprint, trophy, save
   slot...) swaps S.cfg for a new object, which files the outgoing id under its hash (S.suHm) and picks up the id last filed under
   the incoming hash, else a fresh stock id. The sliders live in S.env (a working copy) and are filed back under the id here.
   An older save (setup keyed by build hash, or a single S.env setup) moves onto the build on the bench the first time this runs. */
let suC=null;
const suNew=()=>"e"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function suFix(e){const c=(k,d,a,b)=>{const v=Math.round(+e[k]);e[k]=isFinite(v)?Math.min(b,Math.max(a,v)):d;};
  let h=null;try{h=cfgHash(S.cfg);}catch(x){}
  if(h!=null){
    const objMap=S.suMap&&typeof S.suMap==="object"&&!Array.isArray(S.suMap);
    if(typeof S.suId!=="string"||!objMap){const old=objMap&&Array.isArray(S.suMap[h])?S.suMap[h]:null;S.suId=suNew();S.suMap={};S.suHm={};suC=S.cfg;
      if(old){e.suSt=old[0];e.suSp=old[1];e.suWg=old[2];}
      else if(!objMap&&(e.suSt!==undefined||e.suSp!==undefined||e.suWg!==undefined)){c("suSt",50,0,100);c("suSp",0,-100,100);c("suWg",0,-100,100);}
      else{e.suSt=50;e.suSp=0;e.suWg=0;}}
    else if(suC!==S.cfg){
      if(suC){const m=S.suMap;if(!S.suHm||typeof S.suHm!=="object"||Array.isArray(S.suHm))S.suHm={};let oh=null;try{oh=cfgHash(suC);}catch(x){}
        if(oh!=null&&Array.isArray(m[S.suId])){delete S.suHm[oh];S.suHm[oh]=S.suId;const k=Object.keys(S.suHm);if(k.length>24)delete S.suHm[k[0]];}
        const nid=S.suHm&&S.suHm[h];S.suId=typeof nid==="string"&&Array.isArray(m[nid])?nid:suNew();
        const v=Array.isArray(m[S.suId])?m[S.suId]:[50,0,0];e.suSt=v[0];e.suSp=v[1];e.suWg=v[2];}
      suC=S.cfg;}
  }
  c("suSt",50,0,100);c("suSp",0,-100,100);c("suWg",0,-100,100);
  if(h!=null&&S.suMap&&typeof S.suId==="string"){const m=S.suMap,id=S.suId;if(e.suSt===50&&e.suSp===0&&e.suWg===0)delete m[id];else{const was=m[id];if(!was||was[0]!==e.suSt||was[1]!==e.suSp||was[2]!==e.suWg){delete m[id];m[id]=[e.suSt,e.suSp,e.suWg];const k=Object.keys(m);if(k.length>24)delete m[k[0]];}}}}
function suOpt(){const e=S.env;suFix(e);return SIM.setupNorm({st:e.suSt,sp:e.suSp,wg:e.suWg});}
const suLapCache=new Map();
function suBalWord(b){return b>0.2?"understeer":b<-0.2?"oversteer":"neutral";}
function suLapFor(p,o,trk){const k=cfgHash(S.cfg)+"|"+o.ch+"|"+o.tyre+"|"+o.finalK+"|"+trk+"|"+JSON.stringify(o.setup||0)+"|"+(o.rk||"")+"|"+(o.dtCap||0);let r=suLapCache.get(k);
  if(!r){if(suLapCache.size>60)suLapCache.clear();const L=SIM.lapSim(p,o,trk);let w=null;for(const a of L.apex)if(!w||a.kmh<w.kmh)w=a;r={t:L.time,low:w&&w.name,ay:L.ayPk};suLapCache.set(k,r);}return r;}
/* the live read-out under the sliders: balance bar, lap-time change against stock (Road) or the car's figures (Hill), a plain line */
function suLive(){const box=$("suLive");if(!box)return;const hill=S.env.testType==="hill";let car,txt="",dl="";
  try{
    if(hill){if(!(quick&&quick.rpms)){box.innerHTML="";return;}const p=hillPrepFor(S.cfg);car=SIM.hillCar(p,hillOpt());const c0=SIM.hillCar(p,Object.assign(hillOpt(),{setup:null}));
      const hk=o=>cfgHash(S.cfg)+"|"+JSON.stringify(o),hp=o=>{const k=hk(o);let t=suLapCache.get(k);if(t===undefined){if(suLapCache.size>60)suLapCache.clear();const q=SIM.hillPass(p,Object.assign({seed:5},o));t=q.time;suLapCache.set(k,t);}return t;};
      const ho=hillOpt(),ta=hp(ho),tb=ho.setup?hp(Object.assign({},ho,{setup:null})):ta,d=ta!=null&&tb!=null?ta-tb:null;
      dl=`climb <b>${fmtHill(ta)}</b> <b class="${d==null||Math.abs(d)<0.05?"":d<0?"su-up":"su-dn"}">${d==null||Math.abs(d)<0.05?"= stock":(d<0?"−":"+")+Math.abs(d).toFixed(1)+" s"}</b> <span class="dim">vs stock · downforce ${car.clA.toFixed(2)} m² · drag ${car.cdA.toFixed(2)} m²</span>`;}
    else{const o=roadOpt(),q=quick&&quick.rpms?quick:null;if(!q){box.innerHTML="";return;}const p=SIM.roadPrep(S.cfg,q);car=SIM.roadCar(p,o);const trk=S.env.roadTrk;
      const a=suLapFor(p,o,trk),b=o.setup?suLapFor(p,Object.assign({},o,{setup:null}),trk):a,d=a.t-b.t;
      dl=`lap <b>${fmtLap(a.t,2)}</b> <b class="${Math.abs(d)<0.005?"":d<0?"su-up":"su-dn"}">${Math.abs(d)<0.005?"= stock":(d<0?"−":"+")+Math.abs(d).toFixed(2)+" s"}</b> <span class="dim">vs stock setup</span>`;
      if(b&&a.low&&suBalWord(car.bi)!=="neutral")txt=car.bi>0?`Pushing wide in ${rdEsc(a.low)} — the fronts run out first.`:`The tail steps out on the way out of ${rdEsc(a.low)}.`;
      else txt=`Neutral — front and rear let go together.`;}
  }catch(err){box.innerHTML="";return;}
  const b=car.bi,w=suBalWord(b);if(hill){txt=w==="neutral"?"Neutral — front and rear let go together.":w==="understeer"?"It pushes wide in the tight stuff — the fronts run out first.":"The tail steps out on exit — the rears run out first.";}
  box.innerHTML=`<div class="su-bal" id="suBal" role="img" aria-label="Balance: ${w}"><span>UNDER</span><div class="su-track"><i class="su-mid"></i><i class="su-pin" style="left:${(50+50*Math.max(-1,Math.min(1,b))).toFixed(1)}%"></i></div><span>OVER</span></div>
    <div class="su-row"><b class="su-w su-${w}">${w==="neutral"?"Neutral":w==="understeer"?"Understeer":"Oversteer"}</b><span>${dl}</span></div><p class="hint su-txt">${txt}</p>`;}
function suEnvHtml(sl,hill){const e=S.env;suFix(e);
  return `<div class="lbl"><span>Setup</span><button class="chip su-rst" data-su-reset>Reset to stock</button></div>
    <div class="envgrid su-grid">${sl("suSt","Roll stiffness · soft ↔ stiff",0,100,5,"",e.suSt)}${sl("suSp","Roll balance · rear ↔ front",-100,100,5,"",e.suSp)}${sl("suWg","Wing angle · flat ↔ steep",-100,100,5,"",e.suWg)}</div>
    <div id="suLive" class="su-live"></div>
    <p class="hint">Springs and bars decide how the weight rolls. Stiffer at one end and that end loses grip first: stiff front pushes, stiff rear comes round — the car corners at the weaker axle's limit. A steeper wing adds downforce and drag${hill?"":" (top speed pays)"}. Stock is the chassis as designed.</p>`;}
$("envBox").addEventListener("click",e=>{if(!e.target.closest("[data-su-reset]"))return;S.env.suSt=50;S.env.suSp=0;S.env.suWg=0;renderEnv();save();buzz(6);});
function roadKey(ch,trk){return ch+"|"+trk;}
function roadRecs(){const R=recs();if(!R.road||typeof R.road!=="object")R.road={};return R.road;}
/* market: a buyer's road figures for an engine, in the buyer's car (cached like the site runs) */
const roadCache=new Map();
function roadFor(res,cfg,road,tag){const ch=road&&SIM.CHASSIS[road.ch]?road.ch:"coupe",trk=road&&SIM.ROAD_TRACKS[road.trk]?road.trk:null,ty=road&&road.tyre||null;
  const key=cfgHash(cfg)+"|"+(tag||"")+"|"+ch+"|"+(ty||"")+"|"+(trk||"");let r=roadCache.get(key);
  if(!r){if(roadCache.size>800)roadCache.clear();const p=SIM.roadPrep(cfg,res),o={ch,tyre:ty||undefined},a=SIM.roadRun(p,o),L=trk?SIM.lapSim(p,o,trk):null;r={z100:a.zero100,top:a.top.kmh,lap:L?L.time:null};roadCache.set(key,r);}
  return r;}
function roadCarTxt(road){const c=(road&&road.car)||SIM.CHASSIS[road&&road.ch]||SIM.CHASSIS.coupe;return `${/^[AEIOU]/.test(c.n)?"an":"a"} ${c.n.toLowerCase().replace("gt","GT").replace("awd","AWD")}`;}
function roadHint(){return career()?`<b>Track day</b> · ${fmt$(ROAD_FEE)} entry. Needs a certified engine. Bolt it into a car, run the straight-line figures and a flying lap — performance buyers judge 0–100 and lap times in their own car. Every lap is a little wear on the build.`
  :`<b>Road test</b> · the engine goes into the chassis you pick. 0–100, the quarter, 80–120 and top speed come off a straight; then one flying lap, played back on the circuit. <b>Space</b> skips the lap.`;}
function roadEnvHtml(sl){const e=roadEnvFix(),o=roadOpt(),C0=o.car||SIM.CHASSIS[o.ch],q=quick&&quick.rpms?quick:null;
  let h=o.car?swapEnvNote():swapEnvNote()+`<div class="lbl"><span>Chassis</span></div><div class="seg wide">${Object.entries(SIM.CHASSIS).map(([id,c])=>`<button data-rk="roadCh" data-rv="${id}" class="${o.ch===id?"on":""}">${c.n}<small>${c.d.split(" · ").slice(0,2).reverse().join(" · ")}</small></button>`).join("")}</div>`;
  h+=`<div class="lbl"><span>Tyres</span></div><div class="seg">${Object.entries(SIM.ROAD_TYRES).map(([id,t])=>`<button data-rk="roadTyre" data-rv="${id}" class="${o.tyre===id?"on":""}">${t.n}<small>μ ${t.mu}${C0.tyre===id?" · stock":""}</small></button>`).join("")}</div>`;
  h+=drvHtml();
  h+=`<div class="lbl"><span>Circuit</span></div><div class="seg n3">${Object.entries(SIM.ROAD_TRACKS).map(([id,t])=>{const T=SIM.roadTrack(id);return `<button data-rk="roadTrk" data-rv="${id}" class="${e.roadTrk===id?"on":""}">${t.n}<small>${(T.len/1000).toFixed(2)} km · ${t.d.split(" · ")[1]}</small></button>`;}).join("")}</div>`;
  h+=`<div class="envgrid">${sl("roadFinal","Final drive",0.8,1.25,0.01," × fitted",(+e.roadFinal).toFixed(2))}</div>`;
  if(q){const car=SIM.roadCar(SIM.roadPrep(S.cfg,q),o),fr=Math.round(car.front*100),bal=car.bal==="under"?`nose-heavy (${fr}% front, ${C0.front*100|0}% as designed) — it will push in the slow corners`:car.bal==="over"?`light in the nose (${fr}% front) — the tail steps out on the way in`:`balanced (${fr}% front)`;
    h+=`<p class="hint"><b>${C0.n}</b> · ${C0.d}. With this ${Math.round(car.engKg)} kg engine and a driver: <b>${Math.round(car.m).toLocaleString("en-CA")} kg</b>, ${bal}. ${car.gears.length}-speed, final drive ${car.fd.toFixed(2)}:1 (fitted ${car.fdAuto.toFixed(2)} — top gear on the power peak at the speed the power can hold). Shorter pulls harder out of corners; taller runs out the straight.</p>`;}
  h+=suEnvHtml(sl,false);
  h+=`<div class="lbl"><span>Camera</span></div><div class="seg n4">${ROAD_CAMS.map(([id,n,d])=>`<button data-rk="roadCam" data-rv="${id}" class="${e.roadCam===id?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>`;
  h+=`<div class="lbl"><span>Playback</span></div><div class="seg">${[1,2,4].map(v=>`<button data-rk="roadSpd" data-rv="${v}" class="${+e.roadSpd===v?"on":""}">${v}×<small>${v===1?"real time":v===2?"double speed":"quick look"}</small></button>`).join("")}</div>`;
  return h;}
$("envBox").addEventListener("click",e=>{const b=e.target.closest("[data-rk]");if(!b)return;const k=b.dataset.rk,v=b.dataset.rv;
  if(k==="roadCh"&&v!==S.env.roadCh)S.env.roadTyre=null;   // a new chassis comes on its own stock tyres
  S.env[k]=k==="roadSpd"?+v:v;roadEnvFix();if(RT&&!RT.finished){if(k==="roadCam")RT.cam=v;if(k==="roadSpd")RT.speed=+v;}renderEnv();save();buzz(6);});
/* live card: speed, gear, the tach, the lap clock with sector splits against the record, a mini-map */
/* perf: a live mini-map's size and ink, read once per layout (window size, desk/theme classes) instead of a forced
   style + layout every frame right after the HUD text was written */
function cvBox(cv){const de=document.documentElement,k=innerWidth+"x"+innerHeight+"|"+de.className+"|"+(de.getAttribute("data-theme")||""),m=cv._box;if(m&&m.k===k)return m;
  const W=cv.clientWidth,H=cv.clientHeight,b={k:W&&H?k:"",W:W||120,H:H||90,ink:getComputedStyle(cv).color||"#faf9f5"};cv._box=b;return b;}
function roadMapDraw(cv,T,s){if(!cv)return;const B=cvBox(cv),dpr=Math.min(devicePixelRatio||1,2),W=B.W,H=B.H;if(cv.width!==Math.round(W*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);}
  const x=cv.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);const sc=Math.min((W-12)/T.size[0],(H-12)/T.size[1]),P=i=>[W/2+T.x[i]*sc,H/2-T.y[i]*sc];
  const ink=B.ink;x.lineJoin="round";x.strokeStyle=ink;x.globalAlpha=.22;x.lineWidth=5;x.beginPath();for(let i=0;i<T.N;i+=2){const p=P(i);i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]);}x.closePath();x.stroke();
  x.globalAlpha=.75;x.lineWidth=1.6;x.stroke();x.globalAlpha=1;
  const p0=P(0),h0=T.h[0];x.strokeStyle="#d97757";x.lineWidth=2;x.beginPath();x.moveTo(p0[0]-Math.sin(h0)*6,p0[1]-Math.cos(h0)*6);x.lineTo(p0[0]+Math.sin(h0)*6,p0[1]+Math.cos(h0)*6);x.stroke();
  if(s!=null){const i=Math.floor(((s/T.ds)%T.N+T.N)%T.N),p=P(i);x.fillStyle="#d97757";x.beginPath();x.arc(p[0],p[1],4,0,7);x.fill();x.strokeStyle="#141413";x.lineWidth=1.2;x.stroke();}}
function roadHudInit(){const L=$("roadLive");L.innerHTML=`<div class="rdh"><div class="rd-spd"><b id="rdV">0</b><i>km/h</i></div><div class="rd-g"><b id="rdG">–</b><i>gear</i></div><div class="rd-lt"><b id="rdT">0:00.0</b><i id="rdTi">lap</i></div><canvas id="rdMap" class="rd-map"></canvas></div>
  <div class="ph-bar rd-rpm"><i class="fill" id="rdR"></i><i class="mk" style="left:${Math.round(100*(RT.redline*0.9)/(RT.redline*1.04))}%"></i></div><div class="ph-lbl" style="margin-top:4px"><span id="rdRpm">0 rpm</span><span id="rdPd"></span></div>
  <div class="rd-sec" id="rdS"></div>`;}
function roadHud(f){if(!RT)return;const v=$("rdV");if(!v)return;
  v.textContent=Math.round(f.v*3.6);$("rdG").textContent=f.g||"–";$("rdT").textContent=fmtLap(Math.max(0,f.lapT));$("rdTi").textContent=f.pre?"flying start":f.done?"lap":"lap time";
  $("rdR").style.width=Math.min(100,100*f.rpm/(RT.redline*1.04))+"%";$("rdR").style.background=f.rpm>RT.redline*0.97?"linear-gradient(90deg,rgba(238,90,94,.4),rgba(238,90,94,.9))":"";
  $("rdRpm").textContent=`${(Math.round(f.rpm/10)*10).toLocaleString("en-CA")} rpm${RT.boostT>0?` · ${bv(f.bst)} ${pU()}`:""}`;$("rdPd").innerHTML=f.brk>0.05?`<b style="color:var(--crit)">BRAKE ${Math.round(f.brk*100)}%</b>`:`throttle <b>${Math.round(f.thr*100)}%</b>${f.lim?` · <b style="color:var(--warn)">grip</b>`:""}`;
  const sec=RT.lap.sectors,cut=RT.secCut,best=RT.best&&RT.best.sec;let h="";
  for(let k=0;k<3;k++){const done=!f.pre&&f.lapT>=cut[k+1]-1e-6,t=sec[k],d=best&&done?t-best[k]:null;
    h+=`<div class="${done?"on":""}"><span>S${k+1}</span><b>${done?t.toFixed(2):k===0||(!f.pre&&f.lapT>=cut[k])?"…":"—"}</b>${d!=null?`<i class="${d<=0?"up":"dn"}">${d<=0?"−":"+"}${Math.abs(d).toFixed(2)}</i>`:""}</div>`;}
  $("rdS").innerHTML=h;roadMapDraw($("rdMap"),RT.T,f.s);}
function roadBtnText(){const b=$("roadSkip");if(b)b.textContent=RT&&RT.finished?"…":"SKIP ▸▸";const s=$("roadSpd");if(s&&RT)s.textContent=RT.speed+"×";}
/* sample the lap trace at lap time tt */
function roadAt(L,tt){const t=L.trace.t,N=L.N;tt=((tt%L.time)+L.time)%L.time;let a=0,b=N;while(b-a>1){const m=(a+b)>>1;if(t[m]<=tt)a=m;else b=m;}
  const f=clamp((tt-t[a])/Math.max(1e-6,t[a+1]-t[a]),0,1),j=(a+1)%N,T=L.trace;
  return{i:a,s:(a+f)*L.ds,v:T.v[a]+(T.v[j]-T.v[a])*f,g:T.g[a],rpm:T.rpm[a]+(T.rpm[j]-T.rpm[a])*f,thr:T.thr[a],brk:T.brk[a],ax:T.ax[a],ay:T.ay[a],bst:T.bst[a],lim:T.lim[a]};}
function roadStart(){
  const env=stdEnv(),opt=roadOpt(),trk=S.env.roadTrk,snap=testSnap();
  const res=SIM.simulate(snap.cfg,env);
  if(res.fails.length){testing=false;toast(`It wouldn't last a lap — ${String(res.fails[0]).toLowerCase()} on the dyno first`);if(career()){C().cash+=testCost();hud();}renderTest();return;}
  $("app").classList.add("onstrip");
  if(opt.dtCap>0&&res.peakTq/opt.dtCap>1.3){opt.dtBrk=true;opt.dtMsg=SIM.dtPart(res.peakTq/opt.dtCap);}   // a big overload breaks a part on the first hard exit
  const prep=SIM.roadPrep(snap.cfg,res),run0=SIM.roadRun(prep,opt),lap=SIM.lapSim(prep,opt,trk),T=SIM.roadTrack(trk);
  const best=roadRecs()[roadKey(opt.rk||opt.ch,trk)]||null,secCut=[0,lap.sectors[0],lap.sectors[0]+lap.sectors[1],lap.time];
  RT={suVis:SIM.setupVis(opt.setup),brk:swapRoadBreak(lap,T,opt),res,env,opt,trk,snap,run:run0,lap,T,best,secCut,t:-3.5,speed:+S.env.roadSpd||2,cam:S.env.roadCam||"auto",last:performance.now(),finished:false,skip:false,redline:snap.cfg.redline,boostT:prep.boostTarget||0,lastPtr:0,bst:0,slip:0};
  ENGINE_VIS.setAutoRotate(false);$("rpmbox").style.display="block";$("roadCtl").style.display="";roadHudInit();roadBtnText();
  $("testProg").classList.remove("done");sfx("start");
  requestAnimationFrame(()=>{const pn=$("panel"),r=$("roadCtl").getBoundingClientRect(),pr=pn.getBoundingClientRect(),bot=Math.min(pr.bottom,tabsTop())-8;if(r.bottom>bot||r.top<pr.top)pn.scrollTo({top:pn.scrollTop+(r.height>bot-pr.top?r.top-pr.top-4:r.bottom-bot),behavior:calmScroll()});});
  const step=()=>{if(!RT||RT.finished)return;const now=performance.now(),dt=Math.min(0.1,(now-RT.last)/1000);RT.last=now;
    RT.t+=dt*RT.speed;const L=RT.lap,pre=RT.t<0,f=roadAt(L,RT.t),done=RT.t>=L.time;
    f.pre=pre;f.done=done;f.lapT=pre?0:Math.min(RT.t,L.time);
    RT.bst=f.bst;RT.slip=f.lim&&f.v<30?0.6:f.lim&&f.v<45?0.3:0;
    if(ENGINE_VIS.setRoad)ENGINE_VIS.setRoad({on:true,su:RT.suVis,track:RT.T,s:f.s,v:f.v,g:f.g,rpm:f.rpm,thr:f.thr,brk:f.brk,ax:f.ax,ay:f.ay,slip:RT.slip,ch:RT.opt.ch,night:!!S.night,cam:RT.cam,pre:pre&&RT.t>-2.2,dt:dt*RT.speed});
    roadHud(f);run.on=true;run.rpm=f.rpm;run.load=Math.max(0.05,f.thr);$("rpmLbl").textContent=Math.round(f.rpm/10)*10;
    $("testProg").style.width=Math.min(100,100*Math.max(0,RT.t)/L.time)+"%";
    if(done&&!RT.crossed){RT.crossed=true;buzz([20,30,20]);}
    if(RT.brk&&!RT.brkHit&&!pre&&RT.t>=RT.brk.t){RT.brkHit=true;RT.skip=true;sfx("fail");buzz([80,40,120]);toast(RT.opt.dtMsg?RT.opt.dtMsg.toUpperCase()+" · the engine is fine":"DRIVELINE LET GO · the engine is fine");}   // a swap's driveline over its rating
    if(RT.skip||RT.t>=L.time+1.6*RT.speed)roadFinish();else requestAnimationFrame(step);};
  requestAnimationFrame(step);
}
function roadSkip(){if(!RT||RT.finished)return;RT.skip=true;}
(()=>{$("roadSkip").addEventListener("click",()=>roadSkip());
  $("roadSpd").addEventListener("click",()=>{if(!RT)return;RT.speed=RT.speed>=4?1:RT.speed*2;S.env.roadSpd=RT.speed;roadBtnText();save();});
  $("roadCamB").addEventListener("click",()=>{const ids=ROAD_CAMS.map(c=>c[0]);const cur=RT?RT.cam:S.env.roadCam;const nx=ids[(ids.indexOf(cur)+1)%ids.length];S.env.roadCam=nx;if(RT)RT.cam=nx;$("roadCamB").textContent="Cam · "+ROAD_CAMS.find(c=>c[0]===nx)[1];save();});})();
function roadFinish(){
  if(!RT||RT.finished)return;RT.finished=true;const {res,env,opt,trk,run:a,lap,snap}=RT;const same=testSame(snap);
  setTimeout(()=>{if(!testing){if(ENGINE_VIS.setRoad)ENGINE_VIS.setRoad({on:false});$("app").classList.remove("onstrip");}},RT.skip?250:1600);
  testing=false;run.on=false;run.rpm=0;$("rpmbox").style.display="none";$("roadCtl").style.display="none";$("testProg").classList.add("done");setTimeout(()=>{$("testProg").style.width="0";},700);ENGINE_VIS.setAutoRotate(null);
  const C0=opt.car||SIM.CHASSIS[opt.ch],car=lap.car,tr=lap.trace,dec={d:[],v:[],thr:[],brk:[],g:[]};
  for(let i=0;i<lap.N;i+=4){dec.d.push(Math.round(i*lap.ds));dec.v.push(+(tr.v[i]*3.6).toFixed(1));dec.thr.push(+tr.thr[i].toFixed(2));dec.brk.push(+tr.brk[i].toFixed(2));dec.g.push(tr.g[i]);}
  const r={ch:opt.ch,chName:C0.n,tyre:opt.tyre,tyreName:SIM.ROAD_TYRES[opt.tyre].n,trk,trkName:lap.trackName,len:Math.round(lap.len),finalK:opt.finalK,fd:+car.fd.toFixed(2),fdAuto:+car.fdAuto.toFixed(2),gears:car.gears.length,
    m:Math.round(car.m),front:+car.front.toFixed(3),bal:car.bal,su:opt.setup||null,suBal:+car.bi.toFixed(2),engKg:Math.round(car.engKg),drive:car.drive,
    zero60:a.zero60,zero100:a.zero100,zero200:a.zero200,quarter:a.quarter,roll:a.roll80120,brake100:a.brake100,top:a.top,spinT:a.spinT,
    lapT:+lap.time.toFixed(3),sectors:lap.sectors.map(x=>+x.toFixed(3)),vmax:+lap.vmax.toFixed(1),vmin:+lap.vmin.toFixed(1),apex:lap.apex,shifts:lap.shifts,fullPct:lap.fullPct,ayPk:lap.ayPk,brakePk:lap.brakePk,tracT:lap.tractionT,trace:dec};
  /* records: best lap per chassis × circuit, best 0–100 per chassis */
  if(opt.sw){r.swap=swapTag();if(RT.brk)r.swapBroke=RT.brk;}else if(RT.brk&&opt.dtMsg)r.dtBroke={msg:opt.dtMsg,t:RT.brk.t,corner:RT.brk.corner};
  if(!ff&&same&&!r.swapBroke&&!r.dtBroke){const RR=roadRecs(),k=roadKey(opt.rk||opt.ch,trk),was=RR[k];if(!was||r.lapT<was.t){RR[k]=Object.assign({t:r.lapT,sec:r.sectors.slice(),z:r.zero100,ch:opt.ch,trk},opt.sw?{sw:opt.sw}:{},recTag());if(was){r.pb={was:was.t};setTimeout(()=>toast(`LAP RECORD · ${fmtLap(r.lapT,2)} (was ${fmtLap(was.t,2)})`),2700);}else r.pb={first:true};}}
  res.road=r;S.last={hash:snap.h,cfg:snap.cfg,env,res};
  const line=`${r.trkName} ${fmtLap(r.lapT)} · 0–100 ${r.zero100!=null?r.zero100.toFixed(1)+" s":"—"} · top ${Math.round(r.top.kmh)} km/h`;
  if(career()&&same){addWear(0.35,hKey(snap.h));logEvent(`Track day in ${roadCarTxt(opt)}: ${line}`,r.pb&&r.pb.was?"good":"");if(!ff)rivalsEvent("road",{ch:opt.ch,trk,sw:!!opt.sw,t:r.swapBroke||r.dtBroke?null:r.lapT});hud();checkGoals();}
  toast(`${fmtLap(r.lapT)} · ${r.trkName}`);
  if(r.swap)swapAfter(r);
  RT.lap=null;save();recompute();renderTest();revealVerdict();
}
function roadVerdict(res){const r=res.road,z=r.zero100;if(r.swapBroke)return swapRoadVerdict(r);if(r.dtBroke)return `<div class="verdict fail"><div style="flex:1"><div class="big">${r.dtBroke.msg.toUpperCase()}</div><p>${r.chName} — it let go on the exit of ${r.dtBroke.corner}, ${r.dtBroke.t.toFixed(1)} s into the lap. The ${SIM.drivetrain(drvId()).n} drivetrain is rated below what this engine makes. No lap time; the engine is fine.</p></div></div>`;
  return `<div class="verdict pass"><div style="flex:1"><div class="big">${fmtLap(r.lapT)} · ${rdEsc(r.trkName)}</div><p>0–100 ${z!=null?z.toFixed(1)+" s":"—"} · top ${Math.round(r.top.kmh)} km/h · ${rdEsc(r.trkName)} ${fmtLap(r.lapT)} — ${r.chName.toLowerCase().replace("gt","GT").replace("awd","AWD")}, ${r.tyreName.toLowerCase()} tyres, ${r.m.toLocaleString("en-CA")} kg${r.pb&&r.pb.was?` · <b>lap record</b> (was ${fmtLap(r.pb.was,2)})`:""}</p>
    <div class="vstats"><div><b>${z!=null?z.toFixed(1):"—"}</b><span>0–100 km/h s</span></div><div><b>${r.zero60!=null?r.zero60.toFixed(1):"—"}</b><span>0–60 mph s</span></div><div><b>${r.quarter?r.quarter.t.toFixed(1):"—"}</b><span>1/4 mi${r.quarter?" · "+Math.round(r.quarter.kmh)+" km/h":""}</span></div>
    <div><b>${Math.round(r.top.kmh)}</b><span>top km/h · ${r.top.limit==="redline"?"rev limit":"drag"}</span></div><div><b>${r.roll!=null?r.roll.toFixed(1):"—"}</b><span>80–120 s</span></div><div><b>${r.brake100.toFixed(1)}</b><span>100–0 m</span></div></div></div></div>`;}
function roadSheet(res){const r=res.road,b=roadRecs()[roadKey(r.ch+(r.swap?"@"+r.swap.v:""),r.trk)],bs=b&&b.t<r.lapT-1e-6?b.sec:null;
  const balTxt=r.bal==="under"?`nose-heavy at ${Math.round(r.front*100)}% front — the ${r.engKg} kg engine makes it push in the slow corners`:r.bal==="over"?`light nose at ${Math.round(r.front*100)}% front — loose on turn-in`:`${Math.round(r.front*100)}% front, as the chassis was designed`;
  const drv={rwd:"rear-drive",fwd:"front-drive",awd:"all-wheel drive"}[r.drive]||r.drive;
  return `<div class="sec"><h2>Lap sheet</h2><div class="log"><div><b>Lap</b>${fmtLap(r.lapT,2)} · ${rdEsc(r.trkName)} ${(r.len/1000).toFixed(2)} km · ${(r.len/r.lapT*3.6).toFixed(1)} km/h average</div>
    <div><b>Sectors</b>${r.sectors.map((t,i)=>`S${i+1} ${t.toFixed(2)}${bs?` <span style="color:${t<=bs[i]?"var(--good)":"var(--crit)"}">(${t<=bs[i]?"−":"+"}${Math.abs(t-bs[i]).toFixed(2)})</span>`:""}`).join(" · ")}${bs?" vs the record":""}</div>
    <div><b>Speed</b>${Math.round(r.vmax)} km/h on the straight · slowest ${Math.round(r.vmin)} km/h · ${r.fullPct}% of the lap flat · ${r.shifts} upshifts</div>
    <div><b>Corners</b>${r.apex.map(a=>`${rdEsc(a.name)} ${Math.round(a.kmh)}`).join(" · ")} km/h</div>
    <div><b>Grip</b>${r.ayPk.toFixed(2)} g cornering · ${r.brakePk.toFixed(2)} g braking · ${r.tracT.toFixed(1)} s grip-limited on the power${r.spinT>0.3?` · wheelspin for ${r.spinT.toFixed(1)} s off the line`:""}</div>
    <div><b>Car</b>${rdEsc(r.chName)} · ${drv} · ${r.m.toLocaleString("en-CA")} kg · ${balTxt}</div>
    ${r.su?`<div><b>Setup</b>roll stiffness ${r.su.st} · balance ${r.su.sp>0?"+":""}${r.su.sp} (${suBalWord(r.suBal)}) · wing ${r.su.wg>0?"+":""}${r.su.wg}</div>`:""}
    <div><b>Gearing</b>${r.gears}-speed · final ${r.fd.toFixed(2)}:1${Math.abs(r.finalK-1)>0.005?` (fitted ${r.fdAuto.toFixed(2)})`:" (fitted)"} · top speed ${r.top.limit==="redline"?"on the rev limiter in "+ordN(r.top.gear):"held by drag in "+ordN(r.top.gear)}</div>
    ${r.zero200!=null?`<div><b>Straight</b>0–200 km/h ${r.zero200.toFixed(1)} s${r.quarter?` · 1/4 mile ${r.quarter.t.toFixed(2)} s @ ${Math.round(r.quarter.kmh)} km/h`:""}</div>`:""}</div></div>`;}
/* the speed trace: km/h against distance, throttle (green) and brake (red) bands underneath, sector lines, gear steps */
function drawRoadTrace(r){const INK=getComputedStyle(document.documentElement).getPropertyValue("--ink").trim()||"#edeae1";const soft=INK.startsWith("#1")?"rgba(20,20,19,.45)":"rgba(237,234,225,.45)";
  const dpr=Math.min(devicePixelRatio,2),W=chart.clientWidth,H=chart.clientHeight;if(chart.width!==W*dpr){chart.width=W*dpr;chart.height=H*dpr;}
  const x=chart.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);const tr=r.trace;if(!tr||!tr.d||tr.d.length<3)return;
  const padL=34,padR=12,padT=24,padB=34,cw=W-padL-padR,ch=H-padT-padB,X=d=>padL+cw*d/r.len,mx=Math.max(60,Math.ceil(Math.max(...tr.v)/50)*50),Y=v=>padT+ch*(1-v/mx);
  const F=getComputedStyle(document.body).fontFamily;x.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue("--grid").trim()||"rgba(255,255,255,.07)";x.lineWidth=1;x.font="10px "+F;
  for(let v=0;v<=mx;v+=50){const py=Y(v);x.beginPath();x.moveTo(padL,py);x.lineTo(W-padR,py);x.stroke();x.fillStyle=soft;x.textAlign="right";x.fillText(v,padL-4,py+3);}
  x.textAlign="center";for(let d=0;d<=r.len;d+=500){const px=X(d);x.fillStyle=soft;x.fillText(d===0?"0":(d/1000).toFixed(1)+" km",px,H-4);}
  let cum=0;x.setLineDash([3,4]);x.strokeStyle=soft;r.sectors.slice(0,2).forEach((t,k)=>{cum+=t;const T=SIM.roadTrack(r.trk),dd=T.sec[k]*T.len,px=X(dd);x.beginPath();x.moveTo(px,padT);x.lineTo(px,padT+ch);x.stroke();x.fillStyle=soft;x.fillText("S"+(k+2),px+9,padT+ch-4);});x.setLineDash([]);
  const bandY=H-padB+6,bh=6;for(let i=0;i<tr.d.length-1;i++){const x0=X(tr.d[i]),x1=X(tr.d[i+1]);if(tr.brk[i]>0.05){x.fillStyle=`rgba(238,90,94,${0.3+0.6*tr.brk[i]})`;x.fillRect(x0,bandY,x1-x0+0.5,bh);}else if(tr.thr[i]>0.02){x.fillStyle=`rgba(92,191,138,${0.2+0.7*tr.thr[i]})`;x.fillRect(x0,bandY,x1-x0+0.5,bh);}}
  const gm=Math.max(...tr.g);x.strokeStyle="rgba(120,169,221,.7)";x.lineWidth=1.2;x.beginPath();tr.d.forEach((d,i)=>{const py=padT+ch*(1-0.32*tr.g[i]/gm);i?x.lineTo(X(d),py):x.moveTo(X(d),py);});x.stroke();
  x.strokeStyle="#d97757";x.lineWidth=2.2;x.beginPath();tr.d.forEach((d,i)=>{i?x.lineTo(X(d),Y(tr.v[i])):x.moveTo(X(d),Y(tr.v[i]));});x.stroke();
  x.font="9.5px "+F;x.fillStyle=INK;(r.apex||[]).forEach((a,k)=>{const px=X(a.s),py=Y(a.kmh);x.beginPath();x.arc(px,py,2.2,0,7);x.fill();if(W>520||k%2===0){x.textAlign="center";x.fillText(Math.round(a.kmh),px,py+12);}});
  x.textAlign="left";x.font="11px "+F;x.fillStyle="#d97757";x.fillText("km/h",padL+4,13);x.fillStyle="rgba(120,169,221,.9)";x.fillText("gear",padL+40,13);x.fillStyle="#5cbf8a";x.fillText("throttle",padL+72,13);x.fillStyle="#ee5a5e";x.fillText("brake",padL+122,13);
  x.fillStyle=soft;x.textAlign="right";x.fillText(`${rdEsc(r.trkName)} · ${fmtLap(r.lapT)}`,W-padR,13);}
function roadRedraw(){const l=lastForChart();if(S.env.testType==="road"&&l&&l.road)drawRoadTrace(l.road);}
function roadRecHtml(){const P=roadRecs(),ks=Object.keys(P).filter(k=>P[k]&&P[k].t);if(!ks.length)return"";ks.sort((a,b)=>(P[a].trk>P[b].trk?1:P[a].trk<P[b].trk?-1:P[a].t-P[b].t));
  return `<div class="rtop rdrec"><span>Road test · best lap per car and circuit</span>${ks.map(k=>{const e=P[k],c=e.sw&&SIM.VEHICLES[e.sw]||SIM.CHASSIS[e.ch],t=SIM.ROAD_TRACKS[e.trk];if(!c||!t)return"";return `<div><b>${e.trk==="gp"?"GP":e.trk==="street"?"ST":"C"}</b><span class="et">${fmtLap(e.t,2)}</span><span>${e.z!=null?e.z.toFixed(1)+" s":""}</span><span class="nm" title="${rdEsc(e.n)}">${rdEsc(c.n)} · ${rdEsc(t.n)}</span><span>${e.w!=null?"wk "+e.w:e.d?new Date(e.d).toLocaleDateString("en-CA",{month:"short",day:"numeric"}):""}</span></div>`;}).join("")}</div>`;}
