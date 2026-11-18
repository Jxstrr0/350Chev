/* ---- truck pull driver: a sled, a class, a field of local pullers ---- */
/* the run itself is in app/pull-run.js, which goes into app-late.js (since 1.76.141.0) */
let PR=null;
const PULL_PURSE=[4000,2000,1200,600,300],PULL_PAY={1:1,2:1.5,3:2,4:3,5:4},PULL_REP=[3,2,1];
const PULL_NAMES={truck:["Dirty Deeds","Smoke Show","Black Gold","Coal Roller","Prairie Thunder","Mud Hen","Night Shift","Holy Roller","Rusty Nail","Stack Attack","Bad Habit","Gravel Pit"],tractor:["Sod Buster","Iron Horse","Field General","Green Machine","Big Red","Grain Train","Hay Fever","Dust Devil","Plow Boy","Farmall Fury","Quarter Section","Swather"]};
const ordN=n=>n+(n%10===1&&n%100!==11?"st":n%10===2&&n%100!==12?"nd":n%10===3&&n%100!==13?"rd":"th");
function pullRand(seed){let a=(seed>>>0)||1;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
/* ---- the night around the hook: a running order, dirt that changes under it, a points series, the pull-off ---- */
let PO=null;   // a pull-off waiting for the player: the first hook's result and the field that tied it
const PULL_ORDER=["gas","street","smoker26","hotfarm","superstock","unlimited"];   // classes run in this order; the crew re-preps between them
const PULL_PTS=[20,18,16,14,12,10,8,6,4,2],PULL_FULL_PTS=3,PULL_SER_N=6,PULL_TITLE=5000,PULL_SB={};
const pClamp=(v,a,b)=>Math.max(a,Math.min(b,v)),pullTrkName=t=>SIM.pullTrackName?SIM.pullTrackName(t):"";
function pullFmt(){const f=S.env.pullFmt;return f==="series"||f==="night"||(f==="practice"&&!career())?f:career()?"night":"practice";}
/* the dirt for each hook of a class: watered in the afternoon, it dries and packs as the night goes and the ruts deepen
   hook by hook; the crew re-works it between classes, so each class starts tackier and smoother than the last one ended */
function pullNight(k,seed,n){const r=pullRand((seed^0x51ED27)>>>0),ci=Math.max(0,PULL_ORDER.indexOf(k)),m0=0.66+r()*0.2-0.07*ci,c0=0.04+0.03*ci,out=[];
  for(let i=0;i<n;i++){const f=n>1?i/(n-1):0;out.push({moist:+pClamp(m0-0.26*f+(r()-0.5)*0.03,0.08,0.95).toFixed(2),cut:+pClamp(c0+0.6*f,0,1).toFixed(2)});}
  return out;}
/* what the dirt does to a rival's number: a dry, cut-up track takes feet off everyone who pulls on it */
function pullTrkAdj(f,t){const k=1-0.1*Math.max(0,0.5-t.moist)-0.16*t.cut,o=Object.assign({},f,{trk:t});
  if(o.full&&k<0.95){o.full=false;o.ft=Math.round(Math.min(299.5,300*(k+0.04))*10)/10;}else if(!o.full)o.ft=Math.round(Math.max(100,Math.min(299.5,o.ft*k))*10)/10;return o;}
const poTrack=()=>PO&&PO.ev&&PO.ev.track?{moist:+Math.min(0.95,PO.ev.track.moist+0.06).toFixed(2),cut:0.12}:null;   // re-worked for the pull-off
/* the class on the night: practice is the old neutral hook; a pull night draws you a slot in the order and the dirt that comes with it */
function pullEvent(k,fseed,live){const fmt=pullFmt(),s=fmt==="series"?(live?pullSerCur(k):pullSerPeek(k)):null;let field=s?pullSerField(k,s):pullField(k,fseed),track=null,draw=null;const n=field.length+1;
  if(fmt!=="practice"){const night=pullNight(k,fseed,n).map(wxTrack),rd=pullRand((fseed^0x3C6EF372)>>>0);draw=Math.floor(rd()*n);let j=0;field=field.map(f=>{if(j===draw)j++;return pullTrkAdj(f,night[j++]);});track=night[draw];}
  else if(wxDirt()){track=wxTrack(null);field=field.map(f=>pullTrkAdj(f,track));}   // practice on the day's dirt
  return{fmt,field,track,draw,n,ser:s};}
function pullRaRisk(){if(!quick||!SIM.isDiesel(S.cfg)||!SIM.pullRunaway)return null;const wi=wearInfo(quick);return SIM.pullRunaway(quick,S.cfg,wi?wi.w:0);}
/* ---- points series: the same named rivals all season, points by place plus a bonus for a full pull ---- */
function pullSerStore(){const o=career()?C():S;if(!o.pullSer||typeof o.pullSer!=="object")o.pullSer={};return o.pullSer;}
function pullSerSeed(){if(career())return(C().seed>>>0)||1;if(!S.pullSerSeed)S.pullSerSeed=Math.floor(Math.random()*1e9)+1;return S.pullSerSeed;}
function pullSerNew(k,season){const c=SIM.PULL_CLASSES[k],seed=(pullSerSeed()^Math.imul(season,2654435761)^Math.imul(PULL_ORDER.indexOf(k)+1,40503))>>>0,r=pullRand(seed),names=(c.names||PULL_NAMES[c.veh.kind]).slice(),rivals=[];
  for(let i=0;i<7;i++){const nm=names.splice(Math.floor(r()*names.length),1)[0];const g=Math.sqrt(-2*Math.log(Math.max(1e-6,r())))*Math.cos(2*Math.PI*r());rivals.push({n:nm,sk:+g.toFixed(2),pts:0,wins:0,fulls:0,last:0});}
  return{k,season,seed,round:0,rivals,me:{pts:0,wins:0,fulls:0,last:0},ev:[],done:false,champ:null,lastWeek:null};}
function pullSerPeek(k){const s=pullSerStore()[k];return s&&!s.done?s:pullSerNew(k,s?s.season+1:1);}
function pullSerCur(k){const st=pullSerStore();if(!st[k]||st[k].done)st[k]=pullSerPeek(k);return st[k];}
/* a round's field: every rival turns up, with a steady skill and the night's luck */
function pullSerField(k,s){const F=SIM.PULL_CLASSES[k].field,r=pullRand((s.seed^Math.imul(s.round+1,0x9E3779B1))>>>0);
  return s.rivals.map(x=>{const g=Math.sqrt(-2*Math.log(Math.max(1e-6,r())))*Math.cos(2*Math.PI*r()),ft=F.med+F.sd*(0.6*x.sk+0.8*g),full=ft>=300||r()<F.full*pClamp(1+0.6*x.sk,0.3,2);
    return{n:x.n,full,ft:full?300:Math.round(Math.max(110,Math.min(299.5,ft))*10)/10};});}
/* standings: points, then wins, then full pulls, then the better finish in the latest round */
function pullStand(s){return s.rivals.map(x=>Object.assign({},x)).concat([Object.assign({n:"You",me:true},s.me)]).sort((a,b)=>b.pts-a.pts||b.wins-a.wins||b.fulls-a.fulls||(a.last||99)-(b.last||99)||(a.me?-1:b.me?1:a.n<b.n?-1:1));}
function pullSerScore(k,rows,r){const s=pullSerCur(k);s.round++;
  rows.forEach((f,i)=>{const c=f.me?s.me:s.rivals.find(x=>x.n===f.n);if(!c)return;const pts=f.dq?0:(PULL_PTS[i]||1)+(f.full?PULL_FULL_PTS:0);c.pts+=pts;if(i===0&&!f.dq)c.wins++;if(f.full)c.fulls++;c.last=i+1;if(f.me)r.serPts=pts;});
  s.ev.push({round:s.round,place:r.place,of:r.of,pts:r.serPts||0,w:career()?C().week:null});if(career())s.lastWeek=C().week;
  const st=pullStand(s);if(s.round>=PULL_SER_N){s.done=true;s.champ=st[0].n;s.champMe=!!st[0].me;if(st[0].me)pullTitle(k,s,r);}
  r.ser={k,season:s.season,round:s.round,n:PULL_SER_N,pts:r.serPts||0,done:s.done,champ:s.champ,champMe:!!s.champMe,stand:st.map(x=>({n:x.n,me:!!x.me,pts:x.pts,wins:x.wins,fulls:x.fulls}))};}
function pullTitle(k,s,r){const C0=SIM.PULL_CLASSES[k],bonus=Math.round(PULL_TITLE*(PULL_PAY[C0.tier]||1)/10)*10;r.title={bonus:career()?bonus:0};
  const R=recs();if(!Array.isArray(R.pullTitles))R.pullTitles=[];R.pullTitles.push(Object.assign({k,season:s.season,pts:s.me.pts},recTag()));
  if(career()){C().cash+=bonus;C().rep+=8;C().pullTitles=(C().pullTitles||[]).concat([{k,season:s.season,w:C().week}]);logEvent(`Champion: ${C0.n} pulling series, season ${s.season} — ${fmt$(bonus)} bonus, +8 rep, a cup for the shop`,"good");try{ENGINE_VIS.buildGarage(garageOwned());}catch(e){}}
  setTimeout(()=>toast(`SERIES CHAMPION · ${C0.n}${career()?" · "+fmt$(bonus):""}`),3200);}
function pullStandHtml(st,o){o=o||{};const rows=o.short?st.filter((x,i)=>i<4||x.me):st;
  return `<div class="pstand"><span></span><span class="h">${o.title||"Standings"}</span><span class="h">pts</span><span class="h">W · full</span>${rows.map(x=>{const i=st.indexOf(x);return `<b>${i+1}</b><span class="nm${x.me?" me":""}">${x.me?"▶ ":""}${esc(x.n)}${o.champ&&i===0?` <i class="champ">CHAMPION</i>`:""}</span><span class="${x.me?"me":""}">${x.pts}</span><span>${x.wins} · ${x.fulls}</span>`;}).join("")}</div>`;}
function pullSerCard(z){const C0=SIM.PULL_CLASSES[z.k];
  return `<div class="sec"><h2>Pulling series <span class="cnt">${C0?C0.n:""} · season ${z.season} · round ${z.round} of ${z.n}</span></h2><p class="hint">${z.done?(z.champMe?`<b style="color:var(--good)">Series champion.</b> ${career()?"The cup goes on the shop shelf and the bonus is in the account.":"It's in the records."}`:`<b>Season over</b> — ${esc(z.champ)} takes the title. A new season starts with the next round.`):`<b>+${z.pts} points</b> tonight.`} Points by place ${PULL_PTS.slice(0,4).join(", ")}… plus ${PULL_FULL_PTS} for a full pull; a DQ scores nothing. Ties go to wins, then full pulls, then the latest round.</p>${pullStandHtml(z.stand,{champ:z.done})}</div>`;}
/* standings and titles on the Records card: rows in the records' own five-column format */
function pullSerRecHtml(){const st=pullSerStore(),R=recs(),T=Array.isArray(R.pullTitles)?R.pullTitles:[];let h="";
  Object.keys(st).filter(k=>SIM.PULL_CLASSES[k]&&st[k]&&st[k].round>0).forEach(k=>{const s=st[k],sd=pullStand(s);
    h+=`<div class="rtop"><span>Pulling series · ${SIM.PULL_CLASSES[k].n} · season ${s.season} · ${s.done?"final":"round "+s.round+" of "+PULL_SER_N}</span>${sd.map((x,i)=>`<div><b>${i+1}</b><span class="et">${x.pts}</span><span>${x.wins}W ${x.fulls}F</span><span class="nm"${x.me?' style="color:var(--chalk);font-weight:600"':""}>${x.me?"▶ ":""}${esc(x.n)}</span><span>${s.done&&i===0?"champ":""}</span></div>`).join("")}</div>`;});
  if(T.length)h+=`<div class="rtop"><span>Pulling championships won · ${T.length}</span>${T.map(t=>`<div><b>★</b><span class="et">S${t.season}</span><span>${t.pts} pts</span><span class="nm">${esc(SIM.PULL_CLASSES[t.k]?SIM.PULL_CLASSES[t.k].n:t.k)}</span><span>${t.w!=null?"wk "+t.w:t.d?new Date(t.d).toLocaleDateString("en-CA",{month:"short",day:"numeric"}):""}</span></div>`).join("")}</div>`;
  return h;}
/* gates before a hook: a pending pull-off is conceded by leaving the dirt or swapping engines; a series round is weekly in career */
function pullGate(){if(PO&&(S.env.testType!=="pull_sled"||cfgHash(S.cfg)!==PO.hash)){const away=S.env.testType!=="pull_sled";poConcede(away?"Pull-off conceded — you left the dirt":"Pull-off conceded — that's a different engine");return !away;}
  if(!PO&&S.env.testType==="pull_sled"&&pullFmt()==="series"&&career()){const s=pullSerStore()[S.env.pullCls];if(s&&!s.done&&s.lastWeek===C().week){toast(`Round ${s.round+1} of the series runs next week${(C().pullWk||{})[S.env.pullCls]===C().week?"":" — Pull night is open tonight"}`);return true;}}
  return false;}
function poConcede(why){if(!PO)return;const P0=PO;PO=null;const r=Object.assign({},P0.r1,{reasons:(P0.r1.reasons||[]).concat(["Conceded the pull-off — placed behind the trucks that pulled it."])});
  pullSettle(r,{k:P0.k,res:P0.res,env:P0.env,field:P0.field,isPO:true,first:P0.r1,po:0,failed:false,fmt:P0.fmt,ev:P0.ev,veh:P0.veh,fseed:P0.fseed,conceded:true,snap:P0.snap,hk:P0.hk});if(why)setTimeout(()=>toast(why),60);}
function pullEnvTop(k){const fmt=pullFmt(),dk=document.documentElement.classList.contains("desk");let h="";
  if(PO)h+=`<div class="pobanner"><b>PULL-OFF — the sled is heavier</b>${PO.n} other${PO.n>1?"s":""} full-pulled too. The box is set 15% heavier and the longest pull-off wins. Pits are open: gear, driveline, tyres, hitch and ballast. Class and engine are locked — leaving the dirt or swapping the engine concedes.</div>`;
  const F=career()?[["night","Pull night","purse · changing dirt"],["series","Points series",PULL_SER_N+" rounds · one a week"]]:[["practice","Practice",wxOn("pull_sled")?"the day's dirt":"neutral dirt"],["night","Pull night","draw · changing dirt"],["series","Points series",PULL_SER_N+" rounds"]];
  if(!PO)h+=`<div class="lbl"><span>Format</span></div><div class="seg">${F.map(([id,n,d])=>`<button data-pk="pullFmt" data-pv="${id}" class="${fmt===id?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>`;
  const pv=PO?{track:poTrack()}:pullEvent(k,pullSeed(k,true),false),t=pv.track;
  h+=`<p class="hint">${t?`<b>Track: ${pullTrkName(t)}</b> · ${PO?"re-worked for the pull-off":pv.draw==null?"practice on the day's dirt":`you draw ${ordN(pv.draw+1)} of ${pv.n}`} · moisture ${Math.round(t.moist*100)}% · cut ${Math.round(t.cut*100)}%. ${PO||pv.draw==null?"":pv.draw<pv.n/3?"Early, on fresh wet dirt: more bite, less speed.":pv.draw>=pv.n*2/3?"Late: the dirt has dried and the ruts are in — less grip at the heavy end.":"Middle of the order."} The crew re-preps between classes.`:`<b>Track: practice · neutral</b> — the same dirt every hook.`}${pv.ser?` <b>Series</b> · season ${pv.ser.season}, round ${pv.ser.round+1} of ${PULL_SER_N}${career()&&pv.ser.lastWeek===C().week?" — the next round is next week":""}.`:""}</p>`;
  const ra=pullRaRisk();if(ra&&ra.p>0)h+=`<p class="hint"><b style="color:${ra.lvl==="high"?"var(--crit)":ra.lvl==="moderate"?"var(--warn)":"var(--muted)"}">Runaway risk: ${ra.lvl}</b> — ${ra.why.join(" / ")}. If it runs away on its own oil the pedal does nothing: hit KILL${dk?" (or K)":""} within about ${(Math.round(pClamp(2.4-1.2*ra.p,1.5,2.4)*10)/10).toFixed(1)} s or it grenades. The kill switch is also on a cable to the sled: if the hitch ever breaks away, it pulls itself.</p>`;
  if(pv.ser&&pv.ser.round>0)h+=pullStandHtml(pullStand(pv.ser),{short:true,title:"Series standings"});
  return h;}
/* a class gate: rep, or (Unlimited) owning the Monster dyno cell or reaching Legend rep; the lock text says which */
function pullClsLocked(k){const c=SIM.PULL_CLASSES[k];if(!c||!career()||dev())return 0;return c.gate?(has(c.gate)||repTierIdx()>=5?0:c.rep||1):C().rep<c.rep?c.rep:0;}
function pullLockTxt(k){const c=SIM.PULL_CLASSES[k];return c.gate==="dyno5"?"Monster cell or "+REP_TIERS[5][1]+" rep":c.rep+" rep";}
function pullLegal(k,cfg){const c=SIM.PULL_CLASSES[k];if(!c)return{ok:false,why:"no such class"};try{return c.legal(cfg||S.cfg);}catch(e){return{ok:false,why:"can't be teched"};}}
/* the pull setup lives on S.env next to the strip's; anything a class doesn't allow is pulled back inside its rules */
function pullEnvFix(){const e=S.env;if(PO)e.pullCls=PO.k;if(!SIM.PULL_CLASSES[e.pullCls])e.pullCls=SIM.isDiesel(S.cfg)?"street":"gas";const k=e.pullCls,V=SIM.PULL_CLASSES[k].veh,G=SIM.pullGears(k);
  if(!V.tyres.includes(e.pullTyre))e.pullTyre=V.tyres[V.tyres.length-1];
  e.pullGear=Math.max(0,Math.min(G.length-1,Math.round(isFinite(+e.pullGear)&&e.pullGear!==""&&e.pullGear!=null?+e.pullGear:SIM.PULL_CLASSES[k].gear0||2)));
  if(e.pullTrans!=="clutch")e.pullTrans="conv";if(e.pullDrive!=="auto")e.pullDrive="you";
  e.pullHitch=Math.max(12,Math.min(V.hitchMax,isFinite(+e.pullHitch)&&e.pullHitch!=null?+e.pullHitch:V.hitchMax-4));
  const bMax=V.maxMass-V.mass;e.pullBallast=Math.max(0,Math.min(bMax,isFinite(+e.pullBallast)&&e.pullBallast!=null?+e.pullBallast:Math.round(bMax/20)*10));
  /* aired down or up from the class's neutral pressure, the throttle stop, and how far back the ballast sits (0 = front bracket, 100 = over the rear axle) */
  const P=SIM.pullPsi(V.kind),num=(x,d)=>x!=null&&x!==""&&isFinite(+x)?+x:d;
  e.pullPsi=Math.max(P.min,Math.min(P.max,Math.round(num(e.pullPsi,P.def))));
  e.pullThr=Math.max(50,Math.min(100,Math.round(num(e.pullThr,100)/5)*5));
  e.pullBallPos=Math.max(0,Math.min(100,Math.round(num(e.pullBallPos,0)/10)*10));
  return k;}
function pullVeh(k){const e=S.env;return{cls:k,gear:+e.pullGear,trans:e.pullTrans,tyre:e.pullTyre,hitch:+e.pullHitch,ballast:+e.pullBallast,psi:+e.pullPsi,thrMax:+e.pullThr/100,ballPos:+e.pullBallPos/100,redline:S.cfg.redline,idle:SIM.isDiesel(S.cfg)?720:Math.max(750,S.cfg.cam>70?1100:850),dtCap:SIM.dtCapOf(drvId()),dtId:drvId()};}
/* the rest of the class on the night: 5–7 pullers, the same field all week in career, a fresh one every hook in the cell */
function pullField(k,seed){const c=SIM.PULL_CLASSES[k],F=c.field,r=pullRand(seed),names=(c.names||PULL_NAMES[c.veh.kind]).slice(),n=5+Math.floor(r()*3),out=[];
  for(let i=0;i<n;i++){const nm=names.splice(Math.floor(r()*names.length),1)[0];const full=r()<F.full;const gs=Math.sqrt(-2*Math.log(Math.max(1e-6,r())))*Math.cos(2*Math.PI*r());
    out.push({n:nm,full,ft:full?300:Math.round(Math.max(110,Math.min(299.5,F.med+gs*F.sd))*10)/10});}
  return out;}
/* career pull nights: one hook per class per week (the field is the same all week). Series rounds keep their own weekly gate; the pull-off hook is never gated */
function pullHookedWk(k){return career()&&!PO&&pullFmt()==="night"&&(C().pullWk||{})[k]===C().week;}
function pullSeed(k){const ix=Object.keys(SIM.PULL_CLASSES).indexOf(k)+1;if(!career())return PULL_SB[ix]||(PULL_SB[ix]=Math.floor(Math.random()*1e9)+1);if(!C().pullSeed)C().pullSeed=Math.floor(Math.random()*1e9);return(C().pullSeed^(C().week*7919)^(ix*104729))>>>0;}
/* the pull-off buttons on the verdict */
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-po]");if(!b||testing)return;if(b.dataset.po==="go"&&PO){S.env.testType="pull_sled";$("runTest").click();}else if(b.dataset.po==="concede")poConcede("Pull-off conceded");});
function pullSettle(r,c){const {k,res,env,failed}=c,sn=c.snap,same=!sn||testSame(sn),C0=SIM.PULL_CLASSES[k],f1=c.first,dq=r.broke==="runaway"&&!c.isPO;   // grenaded on a hook: disqualified
  const me={n:engineName().slice(0,26),ft:f1.distFt,full:f1.full,po:c.po,me:true,dq};
  const rows=c.field.map(f=>({n:f.n,ft:f.ft,full:f.full,po:f.po!=null?f.po:null})).concat([me]).sort((a,b)=>(a.dq?1:0)-(b.dq?1:0)||b.ft-a.ft||((b.po||0)-(a.po||0))||(a.me?-1:b.me?1:0));
  r.field=rows;r.place=rows.indexOf(me)+1;r.of=rows.length;r.pullOff=c.po;r.clsName=C0.n;r.tier=C0.tier;r.gearName=(SIM.pullGears(k)[c.veh.gear]||[""])[0];
  r.dq=dq;r.fmt=c.fmt;r.draw=c.ev&&c.ev.draw;r.hooks=c.ev&&c.ev.n;r.poPending=!!c.pending;r.poN=c.pending&&PO?PO.n:0;if(c.isPO){r.poRun=!c.conceded;r.conceded=!!c.conceded;r.first=f1.distFt;}
  if(failed){r.broke=r.broke||c.failKind;r.failKind=r.failKind||c.failKind;}
  if(!c.isPO&&same)pullPb(r,failed);
  if(!r.poPending&&c.fmt==="series"&&same)pullSerScore(k,rows,r);
  r.wx=wxSnap("pull_sled");res.pull=r;res.pullFailed=failed;res.pullFailKind=failed?c.failKind:null;S.last=sn?{hash:sn.h,cfg:sn.cfg,env,res}:{hash:cfgHash(S.cfg),cfg:Object.assign({},S.cfg),env,res};
  const pl=ordN(r.place)+" of "+r.of,dist=f1.full?"FULL PULL":f1.distFt.toFixed(1)+" ft",kill=r.runaway&&r.runaway.killed;
  if(career()&&same){if(!c.conceded)addWear(0.6+Math.min(1,r.time/30)*0.4+(r.peakEgt>850?0.3:0),c.hk);
    if(r.poPending){logEvent(`Pull: ${C0.n} — FULL PULL, pull-off against ${r.poN}`,"good");toast(`FULL PULL · PULL-OFF against ${r.poN}`);}
    else if(dq){const bill=Math.max(1500,Math.round((res.cost||5000)*0.4/50)*50);r.bill=bill;C().cash-=bill;C().cert=null;C().rep=Math.max(0,C().rep-3);addWear(3,c.hk);
      logEvent(`Pull: ${C0.n} — ran away and grenaded at ${r.distFt.toFixed(0)} ft, DQ. Rebuild ${fmt$(bill)}`,"bad");toast(`GRENADED · DQ · rebuild ${fmt$(bill)}`);}
    else if(failed){C().cert=null;C().rep=Math.max(0,C().rep-2);logEvent(`Pull: ${C0.n} — ${r.broke==="turbo"?"turbo let go":r.broke==="piston"?"melted a piston":"broke"} at ${r.distFt.toFixed(0)} ft`,"bad");if(r.broke!=="driveline")toast(`BROKE UNDER THE SLED · ${r.distFt.toFixed(0)} ft`);}
    else{const purse=Math.round((PULL_PURSE[r.place-1]||0)*(PULL_PAY[C0.tier]||1)/10)*10,rep=(PULL_REP[r.place-1]||0)+(f1.full?1:0)+(kill?1:0);r.purse=purse;r.rep=rep;C().cash+=purse;C().rep+=rep;
      logEvent(`Pull: ${C0.n} — ${dist}${c.po!=null?" (pull-off "+(c.conceded?"conceded":c.po.toFixed(1)+" ft")+")":""}${kill?", good kill":""}, ${pl}${r.ser?", series +"+r.ser.pts+" pts":""}${purse?", purse "+fmt$(purse):""}`,r.place<=3?"good":"");toast(`${dist} · ${ordN(r.place)}${kill?" · good kill":""}${purse?" · "+fmt$(purse):""}`);}
    if(!r.poPending)spEvent("pull",{win:!failed&&r.place===1,finish:!failed&&r.place>1&&r.place<=3});
    hud();checkGoals();}
  else toast(r.poPending?`FULL PULL · PULL-OFF against ${r.poN}`:dq?`GRENADED · DQ`:failed?`BROKE UNDER THE SLED · ${r.distFt.toFixed(0)} ft`:`${dist} · ${pl}${kill?" · good kill":""}`);
  if(!career()&&!r.poPending)delete PULL_SB[Object.keys(SIM.PULL_CLASSES).indexOf(k)+1];   // a new night next hook
  if(!r.poPending)achCheck({type:"pull",r:Object.assign({},r,{full:f1.full}),failed});   // a pull-off counts the first hook's full pull
  save();recompute();renderTest();
  revealVerdict();
}
/* records: the longest clean pull per class */
function pullPb(r,failed){if(ff||failed)return;const P=recBucket("pull"),was=P[r.cls];
  if(was&&!(r.distFt>was.ft))return;P[r.cls]=Object.assign({ft:r.distFt,full:r.full},recTag());
  if(was){r.pb={was:was.ft};setTimeout(()=>toast(`CLASS BEST · ${r.full?"FULL PULL":r.distFt.toFixed(1)+" ft"} (was ${was.ft.toFixed(1)})`),2700);}}
function pullRecHtml(){const R=recs(),P=R.pull,sr=pullSerRecHtml();if(!P||typeof P!=="object")return sr;const ks=Object.keys(SIM.PULL_CLASSES).filter(k=>P[k]);if(!ks.length)return sr;
  return `<div class="rtop"><span>Truck pull · longest per class</span>${ks.map(k=>{const e=P[k];return `<div><b>${e.full?"✓":"·"}</b><span class="et">${e.full?"FULL":e.ft.toFixed(1)}</span><span>${e.full?"300 ft":"ft"}</span><span class="nm" title="${esc(e.n)}">${esc(SIM.PULL_CLASSES[k].n)}</span><span>${e.w!=null?"wk "+e.w:e.d?new Date(e.d).toLocaleDateString("en-CA",{month:"short",day:"numeric"}):""}</span></div>`;}).join("")}</div>`+sr;}
function pullHint(){const c=SIM.PULL_CLASSES;return career()?`<b>Pull night</b> · $150 entry. Needs a certified engine — no shop upgrade, this is a county-fair event. ${c.street.n} and ${c.gas.n} are open to anyone; ${c.smoker26.n} at ${c.smoker26.rep} rep, ${c.hotfarm.n} at ${c.hotfarm.rep}, ${c.superstock.n} at ${c.superstock.rep}; ${c.unlimited.n} needs the Monster dyno cell or Legend rep. Purse by placing — 1st pays ${fmt$(PULL_PURSE[0])} in the street classes, up to ${fmt$(PULL_PURSE[0]*PULL_PAY[4])} in Super Stock and ${fmt$(PULL_PURSE[0]*PULL_PAY[5])} in Unlimited. Every hook is wear on the build.`
  :`<b>Sled</b> · hold the button for throttle, let go to ease off. The box slides up the sled toward the pan as you go, so the drag keeps building — keep the wheel slip in the green band and carry speed into the heavy end. 300 ft is a full pull.`;}
function pullEnvHtml(sl){const e=S.env,k=pullEnvFix(),C0=SIM.PULL_CLASSES[k],V=C0.veh,G=SIM.pullGears(k),lg=pullLegal(k),lk=pullClsLocked(k);
  let h=pullEnvTop(k)+`<div class="lbl"><span>Class</span></div><div class="seg wide">${Object.entries(SIM.PULL_CLASSES).map(([id,c])=>{const L=pullLegal(id),l=pullClsLocked(id);return `<button data-pk="pullCls" data-pv="${id}" class="${k===id?"on":""}${l?" lock":""}">${c.n}<small style="color:${l?"":L.ok?"var(--good)":"var(--crit)"}${l?";white-space:normal;overflow:visible;line-height:1.25":""}">${l?pullLockTxt(id):(L.ok?"✓ legal":"✗ "+L.why)}</small></button>`;}).join("")}</div>`;
  h+=`<p class="hint"><b style="color:${lg.ok?"var(--good)":"var(--crit)"}">${lg.ok?"✓ Legal":"✗ Not legal"}</b> · ${lg.why}. ${C0.d[0].toUpperCase()+C0.d.slice(1)}. ${V.kind==="tractor"?"Two-wheel-drive tractor":"Four-wheel-drive pickup"}, ${V.mass.toLocaleString("en-CA")} kg empty, ${V.maxMass.toLocaleString("en-CA")} kg class limit. Sled: ${C0.sled.box.toLocaleString("en-CA")} kg box that rides up onto the pan.${lk?` <b>Opens at ${lk} rep.</b>`:""}${pullHookedWk(k)?` <b>Hooked this week — next pull night is week ${C().week+1}.</b>`:""}</p>`;
  h+=`<div class="lbl"><span>Pulling gear</span></div><div class="seg">${G.map(([n,mph],i)=>`<button data-pk="pullGear" data-pv="${i}" class="${+e.pullGear===i?"on":""}">${n}<small>${mph} mph</small></button>`).join("")}</div>`;
  h+=`<div class="lbl"><span>Driveline</span></div><div class="seg">${[["conv","Converter","multiplies torque when it bogs"],["clutch","Clutch","direct · less heat, no help low"]].map(([id,n,d])=>`<button data-pk="pullTrans" data-pv="${id}" class="${e.pullTrans===id?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>`;
  h+=drvHtml();
  h+=`<div class="lbl"><span>Tyres</span></div><div class="seg">${V.tyres.map(id=>{const t=SIM.PULL_TYRES[id];return `<button data-pk="pullTyre" data-pv="${id}" class="${e.pullTyre===id?"on":""}">${t.n}<small>${t.d}</small></button>`;}).join("")}</div>`;
  h+=driverToggle(id=>`data-pk="pullDrive" data-pv="${id}"`,e.pullDrive,"hold to pull, let go to ease off","a sharp foot · watch the hook");
  if(e.pullDrive==="auto")h+=`<p class="hint">The auto driver holds the slip in the middle of the green band, where the dirt bites hardest, and never lifts below about 60% — it is hard to out-pull. If it runs away it hits the kill switch in under a second, every time. Tap ${document.documentElement.classList.contains("desk")?"the button or Space":"the button"} during the hook to take over.</p>`;
  h+=`<div class="envgrid">${sl("pullHitch","Hitch height",12,V.hitchMax,1," in",e.pullHitch)}${sl("pullBallast","Ballast",0,V.maxMass-V.mass,10," kg",e.pullBallast)}${sl("pullBallPos","Ballast set back",0,100,10,"%",e.pullBallPos)}${sl("pullPsi","Tyre pressure",SIM.pullPsi(V.kind).min,SIM.pullPsi(V.kind).max,1," psi",e.pullPsi)}${sl("pullThr","Throttle stop",50,100,5,"%",e.pullThr)}</div>`;
  h+=`<p class="hint">A higher hitch plants the rear tyres but lifts the nose — past a point the front hops and the grip goes with it. Weight on the front bracket holds it down${V.drive==="rwd"?", though on a two-wheel-drive tractor it takes a little off the rear":" and the front axle pulls too"}; set it back toward the rear axle and it plants the rear tyres instead, but stops holding the nose. Air the tyres down from ${SIM.pullPsi(V.kind).def} psi for more bite and less digging, at the cost of a sidewall that winds up and hops sooner. A throttle stop caps the pedal, so a big engine can't spin the tyres into a hole even flat out. A tall gear carries speed into the heavy end; a short one digs if you stay flat on it.</p>`;
  return h;}
$("envBox").addEventListener("click",e=>{const b=e.target.closest("[data-pk]");if(!b)return;const k=b.dataset.pk,v=b.dataset.pv;
  if(PO&&(k==="pullCls"||k==="pullFmt")&&v!==S.env[k]){toast("Locked for the pull-off — concede it first");return;}
  if(k==="pullCls"){const l=pullClsLocked(v);if(l){toast(`${SIM.PULL_CLASSES[v].n} needs the ${pullLockTxt(v)}`);return;}if(v!==S.env.pullCls)S.env.pullGear=null;}   /* each class has its own gear ladder: start from its default, not the old button position */
  S.env[k]=k==="pullGear"?+v:v;pullEnvFix();renderEnv();save();buzz(6);});
/* the pull sheet's trace: speed and slip against distance, the sweet spot shaded */
function drawPullTrace(r){const INK=getComputedStyle(document.documentElement).getPropertyValue("--ink").trim()||"#edeae1";const soft=INK.startsWith("#1")?"rgba(20,20,19,.45)":"rgba(237,234,225,.45)";
  const dpr=Math.min(devicePixelRatio,2),W=chart.clientWidth,H=chart.clientHeight;if(chart.width!==W*dpr){chart.width=W*dpr;chart.height=H*dpr;}
  const x=chart.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);const tr=r.trace||[];if(!tr.length)return;
  const padL=34,padR=34,padT=12,padB=22,cw=W-padL-padR,ch=H-padT-padB,X=d=>padL+cw*Math.min(1,d/SIM.PULL_FULL),mx=Math.max(10,Math.ceil((r.maxMph||10)/5)*5);
  x.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue("--grid").trim()||"rgba(255,255,255,.07)";x.lineWidth=1;x.font="10px "+getComputedStyle(document.body).fontFamily;x.textAlign="center";
  for(let f=0;f<=300;f+=50){const px=X(f*0.3048);x.beginPath();x.moveTo(px,padT);x.lineTo(px,padT+ch);x.stroke();x.fillStyle=soft;x.fillText(f+"'",px,H-6);}
  const sw=r.sweet||[0.15,0.3];x.fillStyle="rgba(92,191,138,.12)";x.fillRect(padL,padT+ch*(1-sw[1]),cw,ch*(sw[1]-sw[0]));
  const line=(f,col,w,dash)=>{x.strokeStyle=col;x.lineWidth=w;x.setLineDash(dash||[]);x.beginPath();tr.forEach((p,i)=>{const px=X(p.x),py=padT+ch*(1-Math.max(0,Math.min(1,f(p))));i?x.lineTo(px,py):x.moveTo(px,py);});x.stroke();x.setLineDash([]);};
  line(p=>p.boxFrac,soft,1,[4,4]);line(p=>p.slip,"rgba(120,169,221,.9)",1.5);line(p=>p.v*2.23694/mx,"#d97757",2.2);
  const rm=Math.max(4000,Math.ceil(Math.max(...tr.map(p=>p.rpm))/1000)*1000),em=Math.max(800,Math.ceil(Math.max(...tr.map(p=>p.egt||0))/100)*100),hasE=tr[0].egt!=null;if(hasE&&PL.rpm)line(p=>p.rpm/rm,"#e8c14a",1.3,[2,3]);if(hasE&&PL.egt)line(p=>p.egt/em,"#c58be0",1.3);
  x.textAlign="left";x.font="11px "+getComputedStyle(document.body).fontFamily;x.fillStyle="#d97757";x.fillText("mph",padL+4,padT+12);x.fillStyle="rgba(120,169,221,.9)";x.fillText("slip",padL+34,padT+12);x.fillStyle=soft;x.fillText("box",padL+62,padT+12);if(hasE&&PL.rpm){x.fillStyle="#e8c14a";x.fillText("rpm",padL+88,padT+12);}if(hasE&&PL.egt){x.fillStyle="#c58be0";x.fillText("EGT",padL+116,padT+12);}x.fillStyle=soft;x.textAlign="right";x.fillText(mx+" mph",W-padR,padT+12);pullCursor(x,r,tr,X,padT,ch,mx,rm,em,INK);}
function pullVerdict(res){const r=res.pull;
  if(r.dq)return `<div class="verdict fail"><div><div class="big">RAN AWAY · GRENADED</div><p>It ran away on its own oil ${r.runaway?Math.round(r.runaway.ftAt)+" ft out":""} and came apart before ${r.auto&&r.auto.took==null?"the auto driver found ":""}the kill switch — disqualified${career()?`. Certification void, rebuild bill ${fmt$(r.bill||0)}`:""}.</p></div></div>`;
  if(r.poPending&&PO)return `<div class="verdict pass"><div style="flex:1"><div class="big">FULL PULL · PULL-OFF</div><p>${r.poN} other${r.poN>1?"s":""} full-pulled too. The sled goes 15% heavier and you drive it again — the longest pull-off wins. Pits are open below: gear, driveline, tyres, hitch and ballast.</p><div class="pobtns"><button class="btn pri" data-po="go">Hook up for the pull-off</button><button class="btn" data-po="concede">Concede</button></div></div></div>`;
  if(res.pullFailed)return `<div class="verdict fail"><div><div class="big">${r.broke==="turbo"?"TURBO LET GO":r.broke==="piston"?"MELTED A PISTON":"BROKE UNDER THE SLED"}</div><p>${r.distFt.toFixed(1)} ft before it let go${career()?" — certification is void and reputation took a hit":""}.</p></div></div>`;
  const cls=r.full||r.place===1?"pass":r.place<=PULL_PURSE.length?"marg":"fail";   // in the money is not a loss
  return `<div class="verdict ${cls}"><div style="flex:1"><div class="big">${r.full||r.poRun||r.conceded?"FULL PULL":r.distFt.toFixed(1)+" ft"} · ${ordN(r.place)}</div><p>${r.clsName} · ${ordN(r.place)} of ${r.of}${r.conceded?" · pull-off conceded":r.pullOff!=null?` · pull-off ${r.pullOff.toFixed(1)} ft with the sled 15% heavier`:""}${r.runaway&&r.runaway.killed?` · ran away, good kill in ${r.runaway.react.toFixed(1)} s`:r.killed?" · killed":""}${r.auto?(r.auto.took!=null?" · you took over from the auto driver":" · Auto driver"):""}${r.track?` · track ${pullTrkName(r.track)}`:""}${r.ser?` · series round ${r.ser.round}: +${r.ser.pts} pts`:""}${career()&&r.purse?` · purse ${fmt$(r.purse)}`:""}${r.pb?` · class best (was ${r.pb.was.toFixed(1)})`:""}</p>
    <div class="vstats"><div><b>${r.full?"300":r.distFt.toFixed(1)}</b><span>${r.poRun?"pull-off ft":"feet"}</span></div><div><b>${Math.round(r.maxMph)}</b><span>top mph</span></div><div><b>${Math.round(r.peakSlip*100)}%</b><span>peak slip</span></div><div><b>${r.sweetT.toFixed(1)}</b><span>s in the band</span></div><div><b>${r.peakEgt}</b><span>peak EGT °C</span></div><div><b>${r.time.toFixed(1)}</b><span>seconds</span></div></div></div></div>`;}
function pullSheet(res){const r=res.pull,v=r.veh||{};const why={full:"full pull",bogged:"bogged",spun:"spun out",lifted:"lifted",broke:"broke",time:"flagged",killed:"killed"}[r.stopWhy]||"stopped";
  const wi=wearInfo(res);const wear=wi?`<div><b>Wear</b>${wi.passes} of ${wi.budget} pass${wi.budget===1?"":"es"} · <span style="color:${wi.w>=1?"var(--crit)":wi.w>0.6?"var(--warn)":"var(--good)"}">${Math.round(wi.w*100)}%</span>${res.wornBy?" · down "+res.wornBy+"% on power":""}${wi.w>0?` <button class="btn sm" id="freshen" style="margin-left:8px">Freshen · ${fmt$(freshenCost(res))}</button>`:""}</div>`:"";
  return `<div class="sec"><h2>Pull sheet</h2><div class="log"><div><b>Pull</b>${r.full?"FULL · 300 ft":r.distFt.toFixed(1)+" ft"} · ${r.maxMph} mph top · ${r.time.toFixed(1)} s · ${why}</div>
    ${r.auto?`<div><b>Driver</b>Auto driver${r.auto.took!=null?` — you took over ${r.auto.took>0?"at "+r.auto.took.toFixed(1)+" ft":"on the hook"}`:" — the whole hook"}</div>`:""}
    <div><b>Setup</b>${r.clsName} · ${r.gearName} (${r.mphGear} mph) · ${v.trans==="clutch"?"clutch":"converter"} · ${r.tyre.toLowerCase()} · ${v.hitch} in hitch · ${v.ballast} kg ${v.ballPos>0?Math.round(v.ballPos*100)+"% back":"front"} · ${r.psi} psi${r.thrMax<1?" · stop "+Math.round(r.thrMax*100)+"%":""} · ${r.ratio}:1 overall</div>
    <div><b>Tyres</b>peak slip ${Math.round(r.peakSlip*100)}% · ${r.sweetT.toFixed(1)} s in the ${Math.round(r.sweet[0]*100)}–${Math.round(r.sweet[1]*100)}% band · ${r.spinT.toFixed(1)} s spinning${r.hopT>0?" · hopped "+r.hopT.toFixed(1)+" s":""}</div>
    ${r.reasons.map(x=>`<div>${x}</div>`).join("")}${wear}</div>${wxLine(r)}${pullLog(r)}
    <div class="pfield" style="margin-top:10px">${r.field.map((f,i)=>`<b>${i+1}</b><span class="nm${f.me?" me":""}">${f.me?"▶ ":""}${esc(f.n)}</span><span class="${f.me?"me":""}">${f.dq?"DQ":f.full?"FULL"+(f.po!=null?" · "+f.po.toFixed(1):f.me&&r.poPending?" · pull-off next":""):f.ft.toFixed(1)+" ft"}</span>`).join("")}</div></div>${r.ser?pullSerCard(r.ser):""}`;}


