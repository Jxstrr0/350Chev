/* ---- truck pull driver: a sled, a class, a field of local pullers ---- */
let PR=null;
const pullIsDiesel=c=>SIM.isDiesel?SIM.isDiesel(c):!!(SIM.OPT.fuel[c.fuel]||{}).ci;
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
  if(fmt!=="practice"){const night=pullNight(k,fseed,n),rd=pullRand((fseed^0x3C6EF372)>>>0);draw=Math.floor(rd()*n);let j=0;field=field.map(f=>{if(j===draw)j++;return pullTrkAdj(f,night[j++]);});track=night[draw];}
  return{fmt,field,track,draw,n,ser:s};}
function pullRaRisk(){if(!quick||!pullIsDiesel(S.cfg)||!SIM.pullRunaway)return null;const wi=wearInfo(quick);return SIM.pullRunaway(quick,S.cfg,wi?wi.w:0);}
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
function pullStandHtml(st,o){o=o||{};const esc=v=>String(v==null?"":v).replace(/[&<>"]/g,"");const rows=o.short?st.filter((x,i)=>i<4||x.me):st;
  return `<div class="pstand"><span></span><span class="h">${o.title||"Standings"}</span><span class="h">pts</span><span class="h">W · full</span>${rows.map(x=>{const i=st.indexOf(x);return `<b>${i+1}</b><span class="nm${x.me?" me":""}">${x.me?"▶ ":""}${esc(x.n)}${o.champ&&i===0?` <i class="champ">CHAMPION</i>`:""}</span><span class="${x.me?"me":""}">${x.pts}</span><span>${x.wins} · ${x.fulls}</span>`;}).join("")}</div>`;}
function pullSerCard(z){const C0=SIM.PULL_CLASSES[z.k];
  return `<div class="sec"><h2>Pulling series <span class="cnt">${C0?C0.n:""} · season ${z.season} · round ${z.round} of ${z.n}</span></h2><p class="hint">${z.done?(z.champMe?`<b style="color:var(--good)">Series champion.</b> ${career()?"The cup goes on the shop shelf and the bonus is in the account.":"It's in the records."}`:`<b>Season over</b> — ${String(z.champ).replace(/[&<>"]/g,"")} takes the title. A new season starts with the next round.`):`<b>+${z.pts} points</b> tonight.`} Points by place ${PULL_PTS.slice(0,4).join(", ")}… plus ${PULL_FULL_PTS} for a full pull; a DQ scores nothing. Ties go to wins, then full pulls, then the latest round.</p>${pullStandHtml(z.stand,{champ:z.done})}</div>`;}
/* standings and titles on the Records card: rows in the records' own five-column format */
function pullSerRecHtml(){const st=pullSerStore(),R=recs(),T=Array.isArray(R.pullTitles)?R.pullTitles:[],esc=v=>String(v==null?"":v).replace(/[&<>"]/g,"");let h="";
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
function pullRunBtn(){if(testing)return;const b=$("runTest");if(PO)b.textContent="Hook up · PULL-OFF · sled +15%";else if(pullFmt()==="series"){const s=pullSerPeek(S.env.pullCls);b.textContent=b.textContent.replace("truck pull",`series round ${s.round+1} of ${PULL_SER_N}`);}}
function pullEnvTop(k){const fmt=pullFmt(),dk=document.documentElement.classList.contains("desk");let h="";
  if(PO)h+=`<div class="pobanner"><b>PULL-OFF — the sled is heavier</b>${PO.n} other${PO.n>1?"s":""} full-pulled too. The box is set 15% heavier and the longest pull-off wins. Pits are open: gear, driveline, tyres, hitch and ballast. Class and engine are locked — leaving the dirt or swapping the engine concedes.</div>`;
  const F=career()?[["night","Pull night","purse · changing dirt"],["series","Points series",PULL_SER_N+" rounds · one a week"]]:[["practice","Practice","neutral dirt"],["night","Pull night","draw · changing dirt"],["series","Points series",PULL_SER_N+" rounds"]];
  if(!PO)h+=`<div class="lbl"><span>Format</span></div><div class="seg">${F.map(([id,n,d])=>`<button data-pk="pullFmt" data-pv="${id}" class="${fmt===id?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>`;
  const pv=PO?{track:poTrack()}:pullEvent(k,pullSeed(k,true),false),t=pv.track;
  h+=`<p class="hint">${t?`<b>Track: ${pullTrkName(t)}</b> · ${PO?"re-worked for the pull-off":`you draw ${ordN(pv.draw+1)} of ${pv.n}`} · moisture ${Math.round(t.moist*100)}% · cut ${Math.round(t.cut*100)}%. ${PO?"":pv.draw<pv.n/3?"Early, on fresh wet dirt: more bite, less speed.":pv.draw>=pv.n*2/3?"Late: the dirt has dried and the ruts are in — less grip at the heavy end.":"Middle of the order."} The crew re-preps between classes.`:`<b>Track: practice · neutral</b> — the same dirt every hook.`}${pv.ser?` <b>Series</b> · season ${pv.ser.season}, round ${pv.ser.round+1} of ${PULL_SER_N}${career()&&pv.ser.lastWeek===C().week?" — the next round is next week":""}.`:""}</p>`;
  const ra=pullRaRisk();if(ra&&ra.p>0)h+=`<p class="hint"><b style="color:${ra.lvl==="high"?"var(--crit)":ra.lvl==="moderate"?"var(--warn)":"var(--muted)"}">Runaway risk: ${ra.lvl}</b> — ${ra.why.join(" / ")}. If it runs away on its own oil the pedal does nothing: hit KILL${dk?" (or K)":""} within about ${(Math.round(pClamp(2.4-1.2*ra.p,1.5,2.4)*10)/10).toFixed(1)} s or it grenades. The kill switch is also on a cable to the sled: if the hitch ever breaks away, it pulls itself.</p>`;
  if(pv.ser&&pv.ser.round>0)h+=pullStandHtml(pullStand(pv.ser),{short:true,title:"Series standings"});
  return h;}
/* a class gate: rep, or (Unlimited) owning the Monster dyno cell or reaching Legend rep; the lock text says which */
function pullClsLocked(k){const c=SIM.PULL_CLASSES[k];if(!c||!career()||dev())return 0;return c.gate?(has(c.gate)||repTierIdx()>=REP_TIERS.length-1?0:c.rep||1):C().rep<c.rep?c.rep:0;}
function pullLockTxt(k){const c=SIM.PULL_CLASSES[k];return c.gate==="dyno5"?"Monster cell or "+REP_TIERS[REP_TIERS.length-1][1]+" rep":c.rep+" rep";}
function pullLegal(k,cfg){const c=SIM.PULL_CLASSES[k];if(!c)return{ok:false,why:"no such class"};try{return c.legal(cfg||S.cfg);}catch(e){return{ok:false,why:"can't be teched"};}}
/* the pull setup lives on S.env next to the strip's; anything a class doesn't allow is pulled back inside its rules */
function pullEnvFix(){const e=S.env;if(PO)e.pullCls=PO.k;if(!SIM.PULL_CLASSES[e.pullCls])e.pullCls=pullIsDiesel(S.cfg)?"street":"gas";const k=e.pullCls,V=SIM.PULL_CLASSES[k].veh,G=SIM.pullGears(k);
  if(!V.tyres.includes(e.pullTyre))e.pullTyre=V.tyres[V.tyres.length-1];
  e.pullGear=Math.max(0,Math.min(G.length-1,Math.round(isFinite(+e.pullGear)&&e.pullGear!==""&&e.pullGear!=null?+e.pullGear:SIM.PULL_CLASSES[k].gear0||2)));
  if(e.pullTrans!=="clutch")e.pullTrans="conv";if(e.pullDrive!=="auto")e.pullDrive="you";
  e.pullHitch=Math.max(12,Math.min(V.hitchMax,isFinite(+e.pullHitch)&&e.pullHitch!=null?+e.pullHitch:V.hitchMax-4));
  const bMax=V.maxMass-V.mass;e.pullBallast=Math.max(0,Math.min(bMax,isFinite(+e.pullBallast)&&e.pullBallast!=null?+e.pullBallast:Math.round(bMax/20)*10));
  return k;}
function pullVeh(k){const e=S.env;return{cls:k,gear:+e.pullGear,trans:e.pullTrans,tyre:e.pullTyre,hitch:+e.pullHitch,ballast:+e.pullBallast,redline:S.cfg.redline,idle:pullIsDiesel(S.cfg)?720:Math.max(750,S.cfg.cam>70?1100:850),dtCap:SIM.dtCapOf(drvId()),dtId:drvId()};}
/* the rest of the class on the night: 5–7 pullers, the same field all week in career, a fresh one every hook in the cell */
function pullField(k,seed){const c=SIM.PULL_CLASSES[k],F=c.field,r=pullRand(seed),names=(c.names||PULL_NAMES[c.veh.kind]).slice(),n=5+Math.floor(r()*3),out=[];
  for(let i=0;i<n;i++){const nm=names.splice(Math.floor(r()*names.length),1)[0];const full=r()<F.full;const gs=Math.sqrt(-2*Math.log(Math.max(1e-6,r())))*Math.cos(2*Math.PI*r());
    out.push({n:nm,full,ft:full?300:Math.round(Math.max(110,Math.min(299.5,F.med+gs*F.sd))*10)/10});}
  return out;}
/* career pull nights: one hook per class per week (the field is the same all week). Series rounds keep their own weekly gate; the pull-off hook is never gated */
function pullHookedWk(k){return career()&&!PO&&pullFmt()==="night"&&(C().pullWk||{})[k]===C().week;}
function pullSeed(k){const ix=Object.keys(SIM.PULL_CLASSES).indexOf(k)+1;if(!career())return PULL_SB[ix]||(PULL_SB[ix]=Math.floor(Math.random()*1e9)+1);if(!C().pullSeed)C().pullSeed=Math.floor(Math.random()*1e9);return(C().pullSeed^(C().week*7919)^(ix*104729))>>>0;}
function pullBtnText(t,sub){const b=$("pullBtn");const k=t+"|"+(sub||"");if(b.dataset.k===k)return;b.dataset.k=k;b.innerHTML=t+(sub?`<small style="display:block;font-size:12px;letter-spacing:.5px;opacity:.75;margin-top:2px">${sub}</small>`:"");}
function pullBreak(kind){PR.failed=true;PR.failKind=kind;if(kind==="driveline"&&PR.p&&PR.p.st&&PR.p.st.dtMsg)toast(PR.p.st.dtMsg.toUpperCase()+" · the engine is fine");run.fail=true;run.failKind=FAIL_VISUAL[kind]||(kind==="turbo"?"turbo":kind==="piston"?"knock":"rod");$("flash").style.background="rgba(238,90,94,.45)";setTimeout(()=>$("flash").style.background="rgba(238,90,94,0)",250);sfx("fail");buzz([80,40,120]);}
function pullStart(){
  $("app").classList.add("onstrip");
  const k=pullEnvFix(),env=stdEnv();const res=SIM.dragPrep(S.cfg,env);
  const wi=wearInfo(res);if(wi&&wi.w>0){const f=1-0.05*Math.min(1,wi.w);res.torque=res.torque.map(t=>t*f);if(res.naTorque)res.naTorque=res.naTorque.map(t=>t*f);res.power=res.power.map(t=>t*f);res.peakTq*=f;res.peakHp*=f;res.wornBy=Math.round((1-f)*100);}
  const snap=testSnap(),hk=hKey(snap.h),veh=pullVeh(k),fseed=PO?PO.fseed:pullSeed(k);if(career()&&!PO&&pullFmt()==="night")(C().pullWk=C().pullWk||{})[k]=C().week;veh.seed=career()?(fseed+7919*(C().pullHooks=(C().pullHooks||0)+1))>>>0:Math.floor(Math.random()*1e9);
  if(wi&&wi.w>=1)veh.wornAt=2+Math.random()*4;
  const ev=PO?{fmt:PO.fmt,field:PO.field,track:poTrack(),draw:null,n:PO.field.length+1}:pullEvent(k,fseed,true);
  if(ev.track)veh.track=ev.track;if(PO)veh.sledK=1.15;   // the night's dirt; the pull-off sled
  const ra=SIM.pullRunaway?SIM.pullRunaway(res,snap.cfg,wi?wi.w:0):{p:0};if(ra.p>0)veh.runaway={p:ra.p};if(window.PULL_FORCE_RA===false)delete veh.runaway;else if(window.PULL_FORCE_RA!=null)veh.runaway={p:1,at:+window.PULL_FORCE_RA};   // PULL_FORCE_RA: test hook — seconds of load, or false for never
  const p=SIM.pullRun(res,veh),field=ev.field;
  PR={p,res,env,veh,k,hk,field,fseed,snap,ev,fmt:ev.fmt,po:!!PO,trk:ev.track,last:performance.now(),down:false,failed:false,failKind:null,doneAt:null,lastPtr:0,lead:Math.max(...field.map(f=>f.ft)),kind:SIM.PULL_CLASSES[k].veh.kind};
  if(S.env.pullDrive==="auto"){PR.auto=true;PR.drv=SIM.pullDriver(veh.seed);PR.goAt=performance.now()+900;}   // the auto driver: its own seeded foot and hand, a beat on the hook before it goes
  ENGINE_VIS.setAutoRotate(false);$("rpmbox").style.display="block";$("pullCtl").style.display="";$("pullBtn").dataset.k="";if(PR.auto)pullBtnText("AUTO","hooked up — tap to drive it yourself");else pullBtnText("HOLD TO PULL","let go to ease off — keep the slip in the green");$("pullBtn").disabled=false;
  $("testProg").classList.remove("done");sfx("start");pullHud(p.st);
  // the button and the card have to be under the thumb: bring them up above the tab bar
  requestAnimationFrame(()=>{const pn=$("panel"),r=$("pullCtl").getBoundingClientRect(),pr=pn.getBoundingClientRect(),bot=Math.min(pr.bottom,tabsTop())-8;if(r.bottom>bot||r.top<pr.top)pn.scrollTo({top:pn.scrollTop+(r.height>bot-pr.top?r.top-pr.top-4:r.bottom-bot),behavior:calmScroll()});});
  const step=()=>{if(!PR||PR.finished)return;const now=performance.now();const dt=Math.min(0.25,(now-PR.last)/1000);PR.last=now;
    let st=p.st;
    if(!PR.auto)st=p.step(dt,PR.down&&!PR.failed?1:0);
    else if(st.phase==="stage"&&now<PR.goAt)st=p.step(dt,0);
    else{let left=dt;while(left>1e-9&&!st.done&&PR.auto){const h=Math.min(0.02,left);left-=h;if(PR.drv.kill(st))pullKill();st=p.step(h,PR.failed?0:PR.drv.foot(st));}   // the auto driver reads the truck every 20 ms
      if(left>1e-9&&!st.done)st=p.step(left,PR.down&&!PR.failed?1:0);}   // taken over part way through the frame
    if(st.broke&&!PR.failed)pullBreak(st.broke);
    if(st.raOn&&!PR.raSeen&&!st.killed&&!st.done&&!PR.failed){PR.raSeen=true;sfx("runaway");buzz([120,60,120,60,120]);
      pullHud(st,true);const pn=$("panel"),kb=$("killBtn").getBoundingClientRect(),pr=pn.getBoundingClientRect(),bot=Math.min(pr.bottom,tabsTop())-8;if(kb.bottom>bot||kb.top<pr.top)pn.scrollTop+=kb.bottom>bot?kb.bottom-bot:kb.top-pr.top-4;}   // the kill switch has to be under the thumb now
    if(st.done&&PR.doneAt==null){PR.doneAt=now;if(st.full&&!PR.failed){$("flash").style.background="rgba(92,191,138,.35)";setTimeout(()=>$("flash").style.background="rgba(238,90,94,0)",400);buzz([30,40,30,40,90]);}else buzz([40]);}
    if(ENGINE_VIS.setPull)ENGINE_VIS.setPull({on:true,phase:st.phase,x:st.x,v:st.v,boxFrac:st.boxFrac,slip:st.slip,hop:st.hop,smoke:st.smoke||0,rpm:PR.failed||PR.killed?run.rpm:st.rpm,vehicle:PR.kind,full:st.full,night:!!S.night,cls:k,distFt:st.x*3.28084,
      dt,throttle:st.foot,boost:st.boost,sweet:st.sweet,failed:PR.failed,failKind:PR.failed?run.failKind:null,hitch:veh.hitch,ballast:veh.ballast,tyre:veh.tyre,hp:PR.res&&PR.res.peakHp||0,track:PR.trk||undefined,runaway:st.raOn&&!st.killed&&!PR.failed?Math.max(0.2,st.ra):0,killed:!!st.killed});
    pullHud(st);
    run.on=true;
    if(PR.failed||PR.killed)run.rpm=Math.max(0,run.rpm-380);else if(st.done)run.rpm+=(veh.idle-run.rpm)*Math.min(1,dt*3);else run.rpm=st.rpm;
    run.load=PR.failed||st.done?0:st.foot;
    $("rpmLbl").textContent=Math.round(run.rpm/10)*10;
    $("testProg").style.width=Math.min(100,100*st.x/SIM.PULL_FULL)+"%";
    const hold=st.full?2600:1800;
    if(!st.done||(now-PR.doneAt<hold&&!PR.skip)||(PR.failed&&run.rpm>0&&!PR.skip))requestAnimationFrame(step);else pullFinish();};
  requestAnimationFrame(step);
}
/* the live card: distance first, then the two things the driver's foot is managing — slip and the box */
function pullHud(st,force){if(!PR||!hudDue(PR,st,force))return;const ft=st.x*3.28084,sw=st.sweet,lo=Math.round(sw[0]*100),hi=Math.round(sw[1]*100),sp=Math.round(st.slip*100);
  const stat=PR.failed?"broke":st.full?"full":"";
  const say=PR.failed?(PR.failKind==="runaway"?"GRENADED":"BROKE"):st.killed?(st.done?"killed":"KILLED — rolling"):st.raOn?"RUNAWAY":st.full?"FULL PULL":st.done?(st.stopWhy==="spun"?"spun out":st.stopWhy==="lifted"?"lifted":"stopped"):st.phase==="stage"?"hooked to the sled":Math.round(st.v*2.237)+" mph";
  const marks=PR.field.map(f=>`<i class="mk${f.ft===PR.lead?" lead":""}" style="left:${Math.min(99.5,f.ft/3)}%"></i>`).join("");
  const bT=PR.res.boostTarget||0;
  const raOn=st.raOn&&!st.killed&&!st.done&&!PR.failed,rl=PR.veh.redline;
  $("pullLive").innerHTML=`${PR.po?`<div class="ph pobanner"><b>PULL-OFF</b>the sled is heavier — +15% on the box</div>`:""}${raOn?`<div class="ph rawarn"><div class="ph-lbl" style="margin-top:0"><span><b>RUNAWAY</b> · ${Math.round(st.rpm/10)*10} rpm</span><span>redline ${rl}</span></div><div class="ph-bar"><i class="fill ra" style="width:${Math.min(100,Math.round(100*(st.rpm-rl*0.8)/(rl*0.75)))}%"></i><i class="mk lead" style="left:${Math.round(100*0.2/0.75)}%"></i></div><div class="ph-lbl"><span>pedal does nothing — hit KILL${document.documentElement.classList.contains("desk")?" (K)":""}</span><span><b>${Math.max(0,st.raWin-st.raT).toFixed(1)} s</b></span></div></div>`:""}<div class="ph"><div class="ph-top ${stat}"><b>${ft.toFixed(1)}<i>ft</i></b><span>${say}${st.phase!=="stage"&&!st.done?"<br>"+st.t.toFixed(1)+" s":""}</span></div>
    <div class="ph-bar"><i class="fill" style="width:${Math.min(100,ft/3)}%"></i>${marks}</div><div class="ph-lbl"><span>0</span><span>leader <b>${PR.lead>=300?"FULL":PR.lead.toFixed(1)+" ft"}</b></span><span>300 ft</span></div>${PR.trk?`<div class="ph-lbl"><span>Track <b>${pullTrkName(PR.trk)}</b></span><span>${PR.po?"re-worked":"draw "+ordN((PR.ev.draw||0)+1)+" of "+PR.ev.n}</span></div>`:""}</div>
    <div class="ph"><div class="ph-lbl" style="margin-top:0"><span>Wheel slip <b>${sp}%</b></span><span>sweet ${lo}–${hi}%</span></div>
    <div class="ph-bar"><i class="sw" style="left:${lo}%;width:${hi-lo}%"></i><i class="nd ${st.slip>sw[1]+0.1?"hot":st.slip>=sw[0]&&st.slip<=sw[1]+0.02?"ok":""}" style="left:${Math.min(99,sp)}%"></i>${PR.auto?`<i class="pd" style="width:${Math.round(st.foot*100)}%"></i>`:""}</div>${PR.auto?`<div class="ph-lbl"><span>Auto · pedal <b>${Math.round(st.foot*100)}%</b></span><span>${st.raOn&&!st.killed&&!st.done?"going for KILL":st.done?"":st.slip>sw[1]+0.03?"backing off":st.slip<sw[0]?"leaning in":"holding it"}</span></div>`:""}
    <div class="ph-lbl"><span>Sled box <b>${Math.round(st.boxFrac*100)}%</b> to the pan</span><span>${st.hop>0.3?`<b style="color:var(--warn)">HOPPING</b>`:st.lift>0.85?`<b style="color:var(--warn)">front light</b>`:""}</span></div>
    <div class="ph-bar"><i class="fill" style="width:${Math.round(st.boxFrac*100)}%"></i></div></div>
    <div class="ph-row"><div class="peak"><b>${Math.round(st.rpm/10)*10}</b><span>rpm</span></div><div class="peak"><b>${bT>0?bv(st.boost):"—"}<i>${bT>0?pU():""}</i></b><span>boost</span></div><div class="peak"><b style="color:${st.egt>900?"var(--crit)":st.egt>780?"var(--warn)":""}">${Math.round(st.egt)}<i>°C</i></b><span>EGT</span></div></div>`;
  const kb=$("killBtn");if(kb.style.display!==(raOn?"":"none"))kb.style.display=raOn?"":"none";
  if(PR.failed)pullBtnText(PR.failKind==="runaway"?"GRENADED · DQ":PR.failKind==="turbo"?"TURBO GONE":PR.failKind==="piston"?"MELTED A PISTON":"BROKE","tap to skip");
  else if(st.killed)pullBtnText(st.done?`KILLED · ${ft.toFixed(1)} FT`:"KILLED","good kill — tap to skip");
  else if(raOn)pullBtnText("RUNAWAY","the pedal does nothing — hit the kill switch");
  else if(st.done)pullBtnText(st.full?"FULL PULL!":`${ft.toFixed(1)} FT`,"tap to skip");
  else if(PR.auto)pullBtnText("AUTO",st.phase==="stage"?"hooked up — tap to drive it yourself":"auto driver on it — tap to take over");
  else if(st.phase==="stage")pullBtnText("HOLD TO PULL","let go to ease off — keep the slip in the green");
  else if(PR.down)pullBtnText(st.slip>sw[1]+0.1?"SPINNING — EASE OFF":"ON IT",st.slip>sw[1]+0.1?"let go a moment, then back on":"hold the slip in the green");
  else pullBtnText("EASED OFF","hold to get back on it");}
function pullPress(){if(!PR||PR.finished)return;const st=PR.p.st;if(st.done||PR.failed){pullSkip();return;}if(PR.auto){PR.auto=false;PR.took=st.phase==="stage"?0:st.x*3.28084;toast(st.raOn&&!st.killed?"You have it — hit KILL":"You have it — hold to pull");}PR.down=true;if(st.phase==="stage")buzz([20]);}
function pullRelease(){if(!PR)return;PR.down=false;}
/* the kill switch: only live while it is running away. Air and fuel off — the truck rolls to a stop and is scored there */
function pullKill(){if(!PR||PR.finished||!PR.p)return false;const st=PR.p.st;if(!st.raOn||st.killed||st.done||PR.failed||!PR.p.kill())return false;
  PR.killed=true;run.rpm=0;run.load=0;sfx("kill");buzz([90]);$("flash").style.background="rgba(240,236,226,.3)";setTimeout(()=>$("flash").style.background="rgba(238,90,94,0)",160);pullHud(st,true);return true;}
$("killBtn").addEventListener("pointerdown",e=>{e.preventDefault();pullKill();});
$("killBtn").addEventListener("click",()=>pullKill());
/* the pull-off buttons on the verdict */
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-po]");if(!b||testing)return;if(b.dataset.po==="go"&&PO){S.env.testType="pull_sled";$("runTest").click();}else if(b.dataset.po==="concede")poConcede("Pull-off conceded");});
function pullSkip(){if(!PR||PR.finished)return;if(ENGINE_VIS.pullSkip)ENGINE_VIS.pullSkip();PR.skip=true;}
(()=>{const b=$("pullBtn");
  b.addEventListener("pointerdown",e=>{e.preventDefault();PR&&(PR.lastPtr=performance.now());try{b.setPointerCapture(e.pointerId);}catch(x){}pullPress();});
  b.addEventListener("pointerup",()=>{PR&&(PR.lastPtr=performance.now());pullRelease();});
  b.addEventListener("pointercancel",()=>{PR&&(PR.lastPtr=performance.now());pullRelease();});
  b.addEventListener("contextmenu",e=>e.preventDefault());
  b.addEventListener("keydown",e=>{if((e.key===" "||e.key==="Enter")&&!e.repeat){e.preventDefault();pullPress();}});
  b.addEventListener("keyup",e=>{if(e.key===" "||e.key==="Enter"){e.preventDefault();pullRelease();}});
  b.addEventListener("click",()=>{if(!PR||!PR.p||performance.now()-(PR.lastPtr||0)<800)return;const st=PR.p.st;if(st.done||PR.failed)pullSkip();});})();
function pullFinish(){
  if(!PR||PR.finished)return;PR.finished=true;const {p,res,env,k,snap}=PR;const r=p.result();if(PR.drv)r.auto=PR.took!=null?{took:Math.round(PR.took*10)/10}:{};const failed=PR.failed;const C0=SIM.PULL_CLASSES[k];const same=testSame(snap);
  setTimeout(()=>{if(!testing){if(ENGINE_VIS.setPull)ENGINE_VIS.setPull({on:false});$("app").classList.remove("onstrip");}},2200);
  testing=false;run.on=false;run.fail=false;run.rpm=0;$("rpmbox").style.display="none";$("pullCtl").style.display="none";$("testProg").classList.add("done");setTimeout(()=>{$("testProg").style.width="0";},700);ENGINE_VIS.setAutoRotate(null);
  // a full pull against other full pulls goes to a pull-off: the same truck on a sled set 15% heavier — and the player drives it
  const isPO=!!PR.po,P0=PO,fulls=PR.field.filter(f=>f.full);
  if(!isPO&&r.full&&!failed&&fulls.length){const rr=pullRand(PR.fseed+99);fulls.forEach(f=>{f.po=Math.round((232+rr()*58)*10)/10;});
    PO={k,r1:r,res,env,field:PR.field,fseed:PR.fseed,ev:PR.ev,fmt:PR.fmt,veh:PR.veh,hash:PR.snap.h,snap:PR.snap,hk:PR.hk,n:fulls.length};}
  else if(isPO)PO=null;
  const ctx={k,res,env,field:isPO?P0.field:PR.field,isPO,first:isPO?P0.r1:r,po:isPO?(failed?0:r.distFt):null,failed,failKind:PR.failKind,fmt:PR.fmt,ev:PR.ev,veh:PR.veh,fseed:PR.fseed,pending:!!PO&&!isPO,snap:PR.snap,hk:PR.hk};
  PR.p=null;pullSettle(r,ctx);
}
function pullSettle(r,c){const {k,res,env,failed}=c,sn=c.snap,same=!sn||testSame(sn),C0=SIM.PULL_CLASSES[k],f1=c.first,dq=r.broke==="runaway"&&!c.isPO;   // grenaded on a hook: disqualified
  const me={n:engineName().slice(0,26),ft:f1.distFt,full:f1.full,po:c.po,me:true,dq};
  const rows=c.field.map(f=>({n:f.n,ft:f.ft,full:f.full,po:f.po!=null?f.po:null})).concat([me]).sort((a,b)=>(a.dq?1:0)-(b.dq?1:0)||b.ft-a.ft||((b.po||0)-(a.po||0))||(a.me?-1:b.me?1:0));
  r.field=rows;r.place=rows.indexOf(me)+1;r.of=rows.length;r.pullOff=c.po;r.clsName=C0.n;r.tier=C0.tier;r.gearName=(SIM.pullGears(k)[c.veh.gear]||[""])[0];
  r.dq=dq;r.fmt=c.fmt;r.draw=c.ev&&c.ev.draw;r.hooks=c.ev&&c.ev.n;r.poPending=!!c.pending;r.poN=c.pending&&PO?PO.n:0;if(c.isPO){r.poRun=!c.conceded;r.conceded=!!c.conceded;r.first=f1.distFt;}
  if(failed){r.broke=r.broke||c.failKind;r.failKind=r.failKind||c.failKind;}
  if(!c.isPO&&same)pullPb(r,failed);
  if(!r.poPending&&c.fmt==="series"&&same)pullSerScore(k,rows,r);
  res.pull=r;res.pullFailed=failed;res.pullFailKind=failed?c.failKind:null;S.last=sn?{hash:sn.h,cfg:sn.cfg,env,res}:{hash:cfgHash(S.cfg),cfg:Object.assign({},S.cfg),env,res};
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
function pullPb(r,failed){if(ff||failed)return;const R=recs();if(!R.pull||typeof R.pull!=="object")R.pull={};const was=R.pull[r.cls];
  if(was&&!(r.distFt>was.ft))return;R.pull[r.cls]=Object.assign({ft:r.distFt,full:r.full},recTag());
  if(was){r.pb={was:was.ft};setTimeout(()=>toast(`CLASS BEST · ${r.full?"FULL PULL":r.distFt.toFixed(1)+" ft"} (was ${was.ft.toFixed(1)})`),2700);}}
function pullRecHtml(){const R=recs(),P=R.pull,sr=pullSerRecHtml();if(!P||typeof P!=="object")return sr;const ks=Object.keys(SIM.PULL_CLASSES).filter(k=>P[k]);if(!ks.length)return sr;const esc=v=>String(v==null?"":v).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
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
  h+=driverToggle(id=>`data-pk="pullDrive" data-pv="${id}"`,e.pullDrive,"hold to pull, let go to ease off","a steady foot · watch the hook");
  if(e.pullDrive==="auto")h+=`<p class="hint">The auto driver holds the slip low in the green band and keeps some pedal in to the end — steady, a little cautious; a good foot can beat it. If it runs away it goes for the kill switch like anyone would, in under a second most hooks. Tap ${document.documentElement.classList.contains("desk")?"the button or Space":"the button"} during the hook to take over.</p>`;
  h+=`<div class="envgrid">${sl("pullHitch","Hitch height",12,V.hitchMax,1," in",e.pullHitch)}${sl("pullBallast","Front ballast",0,V.maxMass-V.mass,10," kg",e.pullBallast)}</div>`;
  h+=`<p class="hint">A higher hitch plants the rear tyres but lifts the nose — past a point the front hops and the grip goes with it. Weight on the front bracket holds it down${V.drive==="rwd"?", though on a two-wheel-drive tractor it takes a little off the rear":" and the front axle pulls too"}. A tall gear carries speed into the heavy end; a short one digs if you stay flat on it.</p>`;
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
    <div><b>Setup</b>${r.clsName} · ${r.gearName} (${r.mphGear} mph) · ${v.trans==="clutch"?"clutch":"converter"} · ${r.tyre.toLowerCase()} · ${v.hitch} in hitch · ${v.ballast} kg front · ${r.ratio}:1 overall</div>
    <div><b>Tyres</b>peak slip ${Math.round(r.peakSlip*100)}% · ${r.sweetT.toFixed(1)} s in the ${Math.round(r.sweet[0]*100)}–${Math.round(r.sweet[1]*100)}% band · ${r.spinT.toFixed(1)} s spinning${r.hopT>0?" · hopped "+r.hopT.toFixed(1)+" s":""}</div>
    ${r.reasons.map(x=>`<div>${x}</div>`).join("")}${wear}</div>${pullLog(r)}
    <div class="pfield" style="margin-top:10px">${r.field.map((f,i)=>`<b>${i+1}</b><span class="nm${f.me?" me":""}">${f.me?"▶ ":""}${String(f.n).replace(/[&<>"]/g,"")}</span><span class="${f.me?"me":""}">${f.dq?"DQ":f.full?"FULL"+(f.po!=null?" · "+f.po.toFixed(1):f.me&&r.poPending?" · pull-off next":""):f.ft.toFixed(1)+" ft"}</span>`).join("")}</div></div>${r.ser?pullSerCard(r.ser):""}`;}


