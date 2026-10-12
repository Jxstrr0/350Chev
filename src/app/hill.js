/* ===================== PIKES PEAK: the hillclimb ===================== */
/* 19.99 km, 156 turns, 2,862 m to 4,302 m. The engine is run at five altitudes on the way up (SIM.hillPrep); the car is the
   road test's chassis on the class's tyres and aero. Auto drives the corner calls; You drive holds PUSH or LIFT into each corner. */
let HC=null;
const HILL_FEE=400,HILL_PURSE=[4000,2000,1200,700,400],HILL_PAY={1:1,2:1.8,3:3,4:5},HILL_REP=[4,3,2,1],HILL_SB={};
const HILL_CAMS=[["auto","Auto","director"],["chase","Chase","behind the car"],["heli","Helicopter","from above"],["onboard","Onboard","driver's eye"]];
const HILL_C={lift:0.962,steady:1.0,push:1.035};
const HILL_NAMES=["R. Okafor","D. Lindqvist","M. Tanaka","J. Whitehorse","C. Duval","T. Brennan","A. Kovač","S. Moreau","L. Haugen","P. Rinaldi","K. Mbeki","E. Castellanos","N. Fairweather","B. Ostrowski","H. Nakamura","F. Leclair","G. Running Elk","V. Sørensen"];
const HILL_PAINT=[0x1d4787,0xb7261d,0xe8e6df,0x2c6b3a,0xd9a52b,0x16181b,0x5b2a86,0xd85f14,0x2a6db5];
const hlEsc=v=>String(v==null?"":v).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
const fmtHill=t=>t==null||!isFinite(t)?"DNF":`${Math.floor(t/60)}:${(t%60).toFixed(2).padStart(5,"0")}`;
function hillClsLocked(k){const c=SIM.HILL_CLASSES[k];return c&&career()&&!dev()&&C().rep<c.rep?c.rep:0;}
function hillEnvFix(){const e=S.env,H=SIM.HILL_CLASSES;if(!H[e.hillCls])e.hillCls="open";const c=H[e.hillCls];
  if(!SIM.CHASSIS[e.hillCh])e.hillCh="coupe";if(!c.tyres.includes(e.hillTyre))e.hillTyre=c.tyres[c.tyres.length-1];if(!c.aero.includes(e.hillAero))e.hillAero=c.aero[c.aero.length-1];
  if(!(+e.hillFinal>=0.8&&+e.hillFinal<=1.25))e.hillFinal=1;if(![1,2,4,8].includes(+e.hillSpd))e.hillSpd=4;if(!HILL_CAMS.some(q=>q[0]===e.hillCam))e.hillCam="auto";
  if(e.hillDrive!=="you")e.hillDrive="auto";suFix(e);return e.hillCls;}
function hillOpt(){const e=S.env;hillEnvFix();return{cls:e.hillCls,ch:e.hillCh,tyre:e.hillTyre,aero:e.hillAero,finalK:+e.hillFinal,setup:suOpt()};}
/* race day: one running per class per week in career (the same calls all week, the same field); a fresh mountain every run in the sandbox */
function hillSeed(k){const ix=Object.keys(SIM.HILL_CLASSES).indexOf(k)+1;if(!career())return HILL_SB[ix]||(HILL_SB[ix]=Math.floor(Math.random()*1e9)+1);if(!C().hillSeed)C().hillSeed=Math.floor(Math.random()*1e9)+1;return(C().hillSeed^(C().week*7919)^(ix*104729))>>>0;}
function hillRanWk(k){return career()&&(C().hillWk||{})[k]===C().week;}
function hillRecs(){const R=recs();if(!R.hill||typeof R.hill!=="object")R.hill={};return R.hill;}
/* the engine at altitude, cached by build: five dyno runs up the mountain */
const hillPrepCache=new Map();
function hillPrepFor(cfg){const k=cfgHash(cfg);let p=hillPrepCache.get(k);if(!p){if(hillPrepCache.size>6)hillPrepCache.clear();p=SIM.hillPrep(cfg,stdEnv());hillPrepCache.set(k,p);}return p;}
/* the rest of the class: 7–9 cars, each a made-up engine and driver run up the same mountain on the same calls */
/* each car is a whole run up the mountain, so the field is driven a car at a time between frames (hillField returns null
   until it is done and re-renders the panel); a run that starts before then drives the rest at once */
const hillFieldCache=new Map(),hillFieldJobs=new Map();
function hillField(k,seed,sync){const key=k+"|"+seed;if(hillFieldCache.has(key))return hillFieldCache.get(key);
  let J=hillFieldJobs.get(key);if(!J){J=hillFieldJob(k,seed);hillFieldJobs.set(key,J);}
  if(sync){while(!J.done)J.next();}else if(!J.timer){const tick=()=>{J.timer=null;if(J.done)return;J.next();if(J.done){if(S.env.testType==="hill"&&!testing&&curTab==="events")renderEnv();evPickRender();}else J.timer=setTimeout(tick,30);};J.timer=setTimeout(tick,60);}
  return J.done?hillFieldCache.get(key):null;}
function hillFieldJob(k,seed){const key=k+"|"+seed;
  const C0=SIM.HILL_CLASSES[k],F=C0.field,r=pullRand((seed^0x51CC)>>>0),calls=SIM.hillCalls(seed),names=HILL_NAMES.slice(),n=7+Math.floor(r()*3),out=[],chs=Object.keys(SIM.CHASSIS).filter(c=>c!=="pickup");
  let i=0;const J={done:false,timer:null,next:()=>{if(J.done)return;if(i>=n){J.done=true;if(hillFieldCache.size>8)hillFieldCache.clear();hillFieldCache.set(key,out);hillFieldJobs.delete(key);return;}{const nm=names.splice(Math.floor(r()*names.length),1)[0],gs=Math.sqrt(-2*Math.log(Math.max(1e-6,r())))*Math.cos(2*Math.PI*r());
    const hp=Math.round(Math.max(150,F.hp+gs*F.sd)),turbo=r()<F.turbo,skill=+Math.min(1,Math.max(0.3,F.skill+(r()-0.5)*0.4)).toFixed(2),ch=chs[Math.floor(r()*chs.length)];
    const sd=(seed^(i+1)*2654435761)>>>0,prep=SIM.hillAiPrep(hp,turbo,sd);let q;
    try{q=SIM.hillPass(prep,{cls:k,ch,tyre:C0.tyres[C0.tyres.length-1],aero:C0.aero[C0.aero.length-1],seed:sd,calls,plan:SIM.hillPlan(calls,skill,sd),dt:0.08});}catch(e){q={time:null,dnf:{kind:"mech"},splits:[]};}
    out.push({n:nm,hp,turbo,ch,skill,t:q.time,dnf:q.dnf?q.dnf.kind:null,splits:q.splits,offs:(q.offs||[]).length,paint:HILL_PAINT[(i+Math.floor(r()*9))%HILL_PAINT.length]});}
    i++;if(i>=n)J.next();}};
  return J;}
const hillDnfWord=k=>({edge:"OVER THE EDGE",boil:"BOILED OVER",stall:"COULDN'T CLIMB",time:"FLAGGED OFF"})[k]||"DNF";
const hillCmp=(a,b)=>(a.t==null?1:0)-(b.t==null?1:0)||(a.t!=null?a.t-b.t:0)||(a.me?-1:b.me?1:0);
function hillHint(){const c=SIM.HILL_CLASSES;return career()?`<b>Pikes Peak</b> · ${fmt$(HILL_FEE)} entry, one run per class a week. Needs a certified engine. ${c.open.n} is open to anyone; ${c.ta.n} at ${c.ta.rep} rep, ${c.ppo.n} at ${c.ppo.rep}, ${c.unl.n} at ${c.unl.rep}. Purse by placing, up to ${fmt$(HILL_PURSE[0]*HILL_PAY[4])} in ${c.unl.n}. Thin air costs an atmospheric engine about a third of its power; a turbo holds on.`
  :`<b>Pikes Peak</b> · 19.99 km, 156 turns, 2,862 m to 4,302 m. Auto reads the corner calls for you; in <b>You drive</b>, hold <b>PUSH</b> into grippy corners and <b>LIFT</b> into dusty ones. Too fast is a moment, a trip through the gravel, or — where there's a drop and no rail — the end of the run. <b>Space</b> pushes.`;}
/* the mountain in profile: altitude against distance, the sections, the treeline, where you are */
function hillProfileSvg(cls,mark){const T=SIM.hillCourse(),W=320,H=64,a0=2800,a1=4360,X=s=>(s/T.len*W).toFixed(1),Y=z=>(H-4-(z-a0)/(a1-a0)*(H-10)).toFixed(1);
  let p=`M0,${H} `;for(let i=0;i<T.N;i+=40)p+=`L${X(i*T.ds)},${Y(T.z[i])} `;p+=`L${W},${Y(T.z[T.N-1])} L${W},${H} Z`;
  const ty=Y(SIM.HILL_TREE),secs=T.sections.slice(0,-1).map(s=>`<line x1="${X(s.s1)}" x2="${X(s.s1)}" y1="${Y(s.alt1)}" y2="${H}" stroke="var(--dim)" stroke-width="1" stroke-dasharray="2 2"/>`).join("");
  const mk=mark!=null?`<circle cx="${X(mark)}" cy="${Y(SIM.hillZ(T,mark))}" r="3" fill="var(--orange)"/>`:"";
  return `<svg class="${cls||"hlprof"}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Elevation along the course"><path d="${p}" fill="rgba(140,130,118,.35)" stroke="rgba(170,160,145,.9)" stroke-width="1.2"/>`+
    `<line x1="0" x2="${W}" y1="${ty}" y2="${ty}" stroke="rgba(79,192,141,.55)" stroke-width="1" stroke-dasharray="4 3"/>${secs}${mk}</svg>`;}
function hillAltLine(p){const pk=p.pts,top=pk[pk.length-1],dn=Math.round(100*(1-top.hp/p.ref.hp)),d0=Math.round(100*(1-pk[0].hp/p.ref.hp));
  let s=`At the shop (500 m) <b>${Math.round(p.ref.hp)} hp</b>; at the line <b>${Math.round(pk[0].hp)}</b> (−${d0}%), on the summit <b>${Math.round(top.hp)}</b> (−${dn}%).`;
  if(p.kind==="turbo"){const lim=pk.find(q=>q.lim);s+=lim?` The turbo holds the shop's manifold pressure to about ${lim.alt.toLocaleString("en-CA")} m, then the compressor runs out of ${lim.lim==="flow"?"flow":"pressure ratio"} (${bv(top.boost)} ${pU()} on top).`:` The turbo holds the shop's manifold pressure all the way up (${bv(top.boost)} ${pU()} on top).`;}
  else if(p.kind!=="na")s+=" The blower keeps its pressure ratio, so it makes the same ratio of thinner air.";else s+=" Atmospheric: the power follows the air.";
  s+=p.carb?` Carburettor: it meters by air speed, so it runs rich as the air thins (λ ${(+p.ref.lambda).toFixed(2)} → ${(+top.lambda).toFixed(2)} on top).`:" Injection trims the mixture for the altitude.";
  return s;}
function hillEnvHtml(sl){const e=S.env,k=hillEnvFix(),C0=SIM.HILL_CLASSES[k],lk=hillClsLocked(k),seed=hillSeed(k),field=hillField(k,seed),R=hillRecs(),pb=R[k],lead=field?field.slice().sort(hillCmp)[0]:null,q=quick&&quick.rpms?quick:null;
  const fin=field?field.filter(f=>f.t!=null).length:0;
  let h=`<div class="saltcls"><div><span>The mountain</span><b>19.99 km</b><small>156 turns · 2,862 → 4,302 m</small></div><div><span>To beat</span><b>${lead&&lead.t!=null?fmtHill(lead.t):"…"}</b><small>${field?`${lead?hlEsc(lead.n):""} · ${fin} of ${field.length} finished`:"the field is warming up"}</small></div><div><span>Your best</span><b>${pb?fmtHill(pb.t):"—"}</b><small>${pb?"in "+C0.n:"no run yet"}</small></div></div>${hillProfileSvg()}`;
  h+=`<div class="lbl"><span>Class</span></div><div class="seg wide">${Object.entries(SIM.HILL_CLASSES).map(([id,c])=>{const l=hillClsLocked(id);return `<button data-hk="hillCls" data-hv="${id}" class="${k===id?"on":""}${l?" lock":""}">${c.n}<small>${l?l+" rep":c.d}</small></button>`;}).join("")}</div>`;
  h+=`<div class="lbl"><span>Driver</span></div><div class="seg">${[["you","You drive","push or lift into each corner"],["auto","Auto","reads the calls · watch the run"]].map(([id,n,d])=>`<button data-hk="hillDrive" data-hv="${id}" class="${e.hillDrive===id?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>`;
  h+=`<div class="lbl"><span>Car</span></div><div class="seg wide">${Object.entries(SIM.CHASSIS).map(([id,c])=>`<button data-hk="hillCh" data-hv="${id}" class="${e.hillCh===id?"on":""}">${c.n}<small>${c.d.split(" · ").slice(0,2).reverse().join(" · ")}</small></button>`).join("")}</div>`;
  h+=`<div class="lbl"><span>Tyres</span></div><div class="seg">${C0.tyres.map(id=>{const t=SIM.HILL_TYRES[id];return `<button data-hk="hillTyre" data-hv="${id}" class="${e.hillTyre===id?"on":""}">${t.n}<small>μ ${t.mu}</small></button>`;}).join("")}</div>`;
  h+=`<div class="lbl"><span>Aero</span></div><div class="seg">${C0.aero.map(id=>{const a=SIM.HILL_AERO[id];return `<button data-hk="hillAero" data-hv="${id}" class="${e.hillAero===id?"on":""}">${a.n}<small>${a.d}</small></button>`;}).join("")}</div>`;
  if(q){try{const p=hillPrepFor(S.cfg),car=SIM.hillCar(p,hillOpt());h+=`<p class="hint"><b>Up the mountain</b> · ${hillAltLine(p)} ${SIM.CHASSIS[e.hillCh].n} at ${Math.round(car.m).toLocaleString("en-CA")} kg${C0.massK<1?" (stripped for the class)":""}, final drive ${car.fd.toFixed(2)}:1 — geared for about 200 km/h.</p>`;}catch(err){}}
  h+=`<p class="hint">${C0.n}: ${C0.d}. The air at the summit is 40% thinner than at sea level: less power for an atmospheric engine, less drag, less downforce, and less air through the radiator.${lk?` <b>Opens at ${lk} rep</b> — earn it by shipping orders and placing in events.`:""}${hillRanWk(k)?` <b>Run this week — the next running is week ${C().week+1}.</b>`:""}</p>`;
  h+=`<div class="envgrid">${sl("hillFinal","Final drive",0.8,1.25,0.01," × fitted",(+e.hillFinal).toFixed(2))}</div>`+suEnvHtml(sl,true);
  h+=`<div class="lbl"><span>Camera</span></div><div class="seg n4">${HILL_CAMS.map(([id,n,d])=>`<button data-hk="hillCam" data-hv="${id}" class="${e.hillCam===id?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>`;
  h+=`<div class="lbl"><span>Playback</span></div><div class="seg n4">${[1,2,4,8].map(v=>`<button data-hk="hillSpd" data-hv="${v}" class="${+e.hillSpd===v?"on":""}">${v}×<small>${v===1?"real time":v===2?"double":v===4?"quick":"quicker"}</small></button>`).join("")}</div>`;
  return h;}
$("envBox").addEventListener("click",e=>{const b=e.target.closest("[data-hk]");if(!b)return;const k=b.dataset.hk,v=b.dataset.hv;
  if(k==="hillCls"){const l=hillClsLocked(v);if(l){toast(`${SIM.HILL_CLASSES[v].n} opens at ${l} rep`);return;}if(v!==S.env.hillCls){S.env.hillTyre=null;S.env.hillAero=null;}}
  S.env[k]=k==="hillSpd"?+v:v;hillEnvFix();if(HC&&!HC.finished){if(k==="hillCam")HC.cam=v;if(k==="hillSpd")HC.speed=+v;}renderEnv();save();buzz(6);});
/* the live card */
function hillHudInit(){$("hillLive").innerHTML=`<div class="rdh hlh"><div class="rd-spd"><b id="hlV">0</b><i>km/h</i></div><div class="rd-g"><b id="hlG">–</b><i>gear</i></div><div class="rd-lt"><b id="hlT">0:00.00</b><i id="hlTi">clock</i></div><div class="rd-lt"><b id="hlA">2,862</b><i>metres</i></div></div>
  <div class="ph-bar hl-bar"><i class="fill" id="hlF"></i>${SIM.hillCourse().sections.slice(0,-1).map(s=>`<i class="mk" style="left:${(100*s.s1/SIM.hillCourse().len).toFixed(2)}%"></i>`).join("")}<i class="mk lead" id="hlL" style="left:0"></i></div>
  <div class="ph-lbl" style="margin-top:4px"><span id="hlSec">Engineer's</span><span id="hlD"></span></div>
  <div class="hl-next" id="hlN"></div><div class="hl-meters" id="hlM"></div>`;}
function hillLeadS(t){const L=HC.lead;if(!L||!L.splits||!L.splits.length)return null;const T=SIM.hillCourse(),S0=T.sections;let pt=0;
  for(let i=0;i<L.splits.length;i++){const st=L.splits[i];if(t<=st){const f=(t-pt)/Math.max(0.01,st-pt);return S0[i].s0+(S0[i].s1-S0[i].s0)*f;}pt=st;}return T.len;}
function hillCornerTxt(c,call){const dir=c.deg>0?"left":"right",kind=c.hp?"hairpin":c.R<40?"tight":c.R<110?"":"fast",cl=call&&call.call;
  return `<b>${c.name?hlEsc(c.name):kind?kind[0].toUpperCase()+kind.slice(1)+" "+dir:dir[0].toUpperCase()+dir.slice(1)}</b><span>${c.name?(kind?kind+" ":"")+dir+" · ":""}R ${Math.round(c.R)} m${c.drop?c.rail?" · drop, railed":` · <em class="dr">DROP · no rail</em>`:""}</span><i class="call ${cl}">${cl==="dusty"?"DUSTY — lift":cl==="grippy"?"GRIPPY — push":"clean"}</i>`;}
function hillHud(){if(!HC)return;const st=HC.run.st,T=HC.run.T,v=$("hlV");if(!v)return;
  v.textContent=Math.round(st.v*3.6);$("hlG").textContent=st.off?"–":st.g+1;$("hlT").textContent=fmtHill(st.t);$("hlA").textContent=Math.round(st.alt).toLocaleString("en-CA");
  $("hlTi").textContent=HC.pre>0?"on the line":st.done?(st.dnf?"DNF":"summit"):"clock";
  $("hlF").style.width=(100*st.s/T.len).toFixed(2)+"%";const ls=hillLeadS(st.t);if(ls!=null)$("hlL").style.left=(100*Math.min(1,ls/T.len)).toFixed(2)+"%";
  const sec=T.sections[Math.min(T.sections.length-1,st.sec)];$("hlSec").innerHTML=`<b>${hlEsc(sec.n)}</b> · ${(st.s/1000).toFixed(2)} km`;
  const L=HC.lead,ns=st.splits.length;let gap="";if(L&&L.splits&&ns&&L.splits[ns-1]!=null){const d=st.splits[ns-1]-L.splits[ns-1];gap=`split ${ns} <b style="color:${d<=0?"var(--good)":"var(--crit)"}">${d<=0?"−":"+"}${Math.abs(d).toFixed(2)}</b> vs ${hlEsc(L.n)}`;}
  $("hlD").innerHTML=gap;
  // the next two corners and their calls; the event of the moment over them
  const K=T.corners,c0=K[Math.min(K.length-1,st.k)],c1=K[Math.min(K.length-1,st.k+1)],ev=st.ev&&st.t-st.ev.t<2.5?st.ev:null;
  let nx="";if(st.dnf)nx=`<div class="hl-ev bad">${hillDnfWord(st.dnf.kind)} · ${hlEsc(st.dnf.name)}</div>`;
  else if(st.off)nx=`<div class="hl-ev bad">${st.off.kind==="rail"?"INTO THE GUARDRAIL":st.off.kind==="bank"?"INTO THE BANK":"OFF · GRAVEL"} · +${st.off.T.toFixed(1)} s</div>`;
  else if(ev&&ev.kind==="moment")nx=`<div class="hl-ev warn">MOMENT! · ${hlEsc(K[ev.k].name||"held it")}</div>`;
  else if(st.done)nx=`<div class="hl-ev good">SUMMIT · ${fmtHill(st.t)}</div>`;
  else nx=`<div class="hl-c">${hillCornerTxt(c0,HC.run.calls[c0.i])}</div>${c1!==c0?`<div class="hl-c dim">${hillCornerTxt(c1,HC.run.calls[c1.i])}</div>`:""}`;
  const nk=nx;if($("hlN").dataset.k!==nk){$("hlN").dataset.k=nk;$("hlN").innerHTML=nk;}
  const pc=Math.round(100*st.hpNow/HC.prep.ref.hp),cc=st.cool,mode=HC.auto?"auto":HC.push?"push":HC.lift?"lift":"steady";
  $("hlM").innerHTML=`<div class="peak"><b>${Math.round(st.hpNow)}</b><span>hp · ${pc}% of shop</span></div><div class="peak"><b style="color:${cc>112?"var(--crit)":cc>104?"var(--warn)":""}">${Math.round(cc)}<i>°C</i></b><span>water${st.derate<0.999?" · derate":""}</span></div><div class="peak"><b class="hl-mode ${mode}">${mode==="auto"?"AUTO":mode.toUpperCase()}</b><span>${HC.auto?"tap to take over":"commitment"}</span></div>`;
  hillBtnText();}
function hillBtnText(){const p=$("hillPush"),l=$("hillLift");if(!p||!HC)return;const st=HC.run.st,k=(HC.auto?"a":"m")+(st.done?"d":"")+(HC.push?"p":"")+(HC.lift?"l":"");if(p.dataset.k===k)return;p.dataset.k=k;
  if(st.done){p.innerHTML=`SUMMIT<small>tap to skip</small>`;l.innerHTML=`—<small>&nbsp;</small>`;}
  else if(HC.auto){p.innerHTML=`AUTO DRIVER<small>tap to take over</small>`;l.innerHTML=`LIFT<small>take over</small>`;}
  else{p.innerHTML=`PUSH<small>${HC.push?"committed":"hold into grippy corners"}</small>`;l.innerHTML=`LIFT<small>${HC.lift?"easing it in":"hold into dusty ones"}</small>`;}
  p.classList.toggle("on",!!HC.push);l.classList.toggle("on",!!HC.lift);
  const s=$("hillSpdB");if(s)s.textContent=HC.speed+"×";}
function hillCtl(){if(!HC||HC.auto)return null;return{c:HC.push?HILL_C.push:HC.lift?HILL_C.lift:HILL_C.steady};}
function hillTakeOver(){if(!HC||!HC.auto||HC.run.st.done)return;HC.auto=false;HC.took=Math.round(HC.run.st.s);buzz([20]);toast("You have it — hold PUSH or LIFT into each corner");}
function hillStart(){
  const k=hillEnvFix(),opt=hillOpt(),snap=testSnap(),env=stdEnv();let prep;
  try{prep=hillPrepFor(snap.cfg);}catch(err){testing=false;renderTest();toast("The engine wouldn't run at altitude");return;}
  if(prep.fails.length){testing=false;toast(`It wouldn't make the summit — ${String(prep.fails[0]).toLowerCase()} on the dyno first`);if(career()){C().cash+=testCost();hud();}renderTest();return;}
  $("app").classList.add("onstrip");
  const seed=hillSeed(k),field=hillField(k,seed,true),calls=SIM.hillCalls(seed);if(career())(C().hillWk=C().hillWk||{})[k]=C().week;
  const rs=career()?(seed+7919*(C().hillRuns=(C().hillRuns||0)+1))>>>0:Math.floor(Math.random()*1e9);
  const run=SIM.hillNew(prep,Object.assign({seed:rs,calls,plan:SIM.hillPlan(calls,0.86,rs)},opt));
  const lead=field.filter(f=>f.t!=null).sort(hillCmp)[0]||null;
  HC={suVis:SIM.setupVis(opt.setup),run,prep,opt,k,snap,env,seed,field,lead,auto:S.env.hillDrive!=="you",took:null,speed:+S.env.hillSpd||4,cam:S.env.hillCam||"auto",push:false,lift:false,pre:2.5,last:performance.now(),finished:false,skip:false,doneAt:null,lastPtr:0,acc:0,color:carPaint()};
  ENGINE_VIS.setAutoRotate(false);$("rpmbox").style.display="block";$("hillCtl").style.display="";hillHudInit();$("hillPush").dataset.k="";hillHud();
  $("testProg").classList.remove("done");sfx("start");
  requestAnimationFrame(()=>{const pn=$("panel"),r=$("hillCtl").getBoundingClientRect(),pr=pn.getBoundingClientRect(),bot=Math.min(pr.bottom,tabsTop())-8;if(r.bottom>bot||r.top<pr.top)pn.scrollTo({top:pn.scrollTop+(r.height>bot-pr.top?r.top-pr.top-4:r.bottom-bot),behavior:calmScroll()});});
  let hudT=0;
  const step=()=>{if(!HC||HC.finished)return;const now=performance.now(),dt=Math.min(0.1,(now-HC.last)/1000);HC.last=now;const st=HC.run.st;
    if(HC.pre>0)HC.pre-=dt;else if(!st.done){HC.acc+=dt*HC.speed;let n=0;while(HC.acc>=0.02&&!st.done&&n++<800){HC.run.step(0.02,hillCtl());HC.acc-=0.02;}if(n>=800)HC.acc=0;}
    if(st.done&&HC.doneAt==null){HC.doneAt=now;if(st.dnf){$("flash").style.background="rgba(226,71,60,.45)";setTimeout(()=>$("flash").style.background="rgba(226,71,60,0)",300);sfx("fail");buzz([80,40,120]);}else{$("flash").style.background="rgba(79,192,141,.35)";setTimeout(()=>$("flash").style.background="rgba(226,71,60,0)",400);buzz([30,40,30,40,90]);}}
    if(st.ev&&st.ev!==HC.lastEv){HC.lastEv=st.ev;if(st.ev.kind!=="moment"){buzz([60,30,60]);sfx("mudslap");}else buzz([25]);}
    if(ENGINE_VIS.setHill)ENGINE_VIS.setHill({on:true,su:HC.suVis,course:HC.run.T,s:st.s,v:st.v,d:st.d,g:st.g+1,rpm:st.rpm,thr:st.thr,brk:st.brk,lat:st.latUse,off:st.off?st.off.kind:null,dnf:st.dnf?st.dnf.kind:null,ev:st.ev&&st.t-st.ev.t<1?st.ev.kind:null,
      ch:HC.opt.ch,aero:HC.opt.aero,color:HC.color,cam:HC.cam,pre:HC.pre>0,done:st.done,night:false,dt:dt*(HC.pre>0||st.done?1:HC.speed)});
    if((hudT+=dt)>0.08||st.done){hudT=0;hillHud();}
    run.on=true;run.rpm=st.done?run.rpm+(HC.run.car.idle-run.rpm)*Math.min(1,dt*3):HC.pre>0?HC.run.car.idle+800*Math.max(0,Math.sin(now/180)):st.rpm;run.load=st.done?0:Math.max(0.05,st.thr);$("rpmLbl").textContent=Math.round(run.rpm/10)*10;
    $("testProg").style.width=Math.min(100,100*st.s/HC.run.T.len)+"%";
    if(st.done&&(HC.skip||now-HC.doneAt>(st.dnf?2200:2600)))hillFinish();else requestAnimationFrame(step);};
  requestAnimationFrame(step);
}
function hillPress(which){if(!HC||HC.finished)return;const st=HC.run.st;if(st.done){hillSkip();return;}
  if(HC.auto){hillTakeOver();if(which==="lift")HC.lift=true;return;}
  if(which==="lift"){HC.lift=true;HC.push=false;}else{HC.push=true;HC.lift=false;}buzz(6);hillBtnText();}
function hillRelease(which){if(!HC)return;if(which==="lift")HC.lift=false;else HC.push=false;hillBtnText();}
/* skip: the auto driver takes the rest of the climb at once (a run you were driving keeps what you did up to here) */
function hillSkip(){if(!HC||HC.finished)return;const st=HC.run.st;HC.pre=0;if(!HC.auto&&HC.took==null&&st.s>1)HC.handed=Math.round(st.s);let n=0;while(!st.done&&n++<120000)HC.run.step(0.02,null);HC.skip=true;if(HC.doneAt==null)HC.doneAt=performance.now()-3000;}
(()=>{const bind=(id,w)=>{const b=$(id);
  b.addEventListener("pointerdown",e=>{e.preventDefault();HC&&(HC.lastPtr=performance.now());try{b.setPointerCapture(e.pointerId);}catch(x){}hillPress(w);});
  b.addEventListener("pointerup",()=>{HC&&(HC.lastPtr=performance.now());hillRelease(w);});b.addEventListener("pointercancel",()=>hillRelease(w));b.addEventListener("contextmenu",e=>e.preventDefault());
  b.addEventListener("keydown",e=>{if((e.key===" "||e.key==="Enter")&&!e.repeat){e.preventDefault();hillPress(w);}});b.addEventListener("keyup",e=>{if(e.key===" "||e.key==="Enter"){e.preventDefault();hillRelease(w);}});
  b.addEventListener("click",()=>{if(!HC||performance.now()-(HC.lastPtr||0)<800)return;hillPress(w);setTimeout(()=>hillRelease(w),400);});};
  bind("hillPush","push");bind("hillLift","lift");
  $("hillSkip").addEventListener("click",()=>hillSkip());
  $("hillSpdB").addEventListener("click",()=>{if(!HC)return;HC.speed=HC.speed>=8?1:HC.speed*2;S.env.hillSpd=HC.speed;hillBtnText();$("hillSpdB").textContent=HC.speed+"×";save();});
  $("hillCamB").addEventListener("click",()=>{const ids=HILL_CAMS.map(c=>c[0]),cur=HC?HC.cam:S.env.hillCam,nx=ids[(ids.indexOf(cur)+1)%ids.length];S.env.hillCam=nx;if(HC)HC.cam=nx;$("hillCamB").textContent="Cam · "+HILL_CAMS.find(c=>c[0]===nx)[1];save();});})();
function hillFinish(){
  if(!HC||HC.finished)return;HC.finished=true;const {run:R0,prep,opt,k,snap,env,field}=HC,C0=SIM.HILL_CLASSES[k],same=testSame(snap);
  setTimeout(()=>{if(!testing){if(ENGINE_VIS.setHill)ENGINE_VIS.setHill({on:false});$("app").classList.remove("onstrip");}},HC.skip?300:1800);
  testing=false;run.on=false;run.rpm=0;$("rpmbox").style.display="none";$("hillCtl").style.display="none";$("testProg").classList.add("done");setTimeout(()=>{$("testProg").style.width="0";},700);ENGINE_VIS.setAutoRotate(null);
  const r=R0.result(),T=R0.T;
  const me={n:engineName().slice(0,26),me:true,t:r.time,dnf:r.dnf?r.dnf.kind:null,splits:r.splits,hp:Math.round(prep.ref.hp),turbo:prep.kind==="turbo",ch:opt.ch};
  const rows=field.map(f=>Object.assign({},f)).concat([me]).sort(hillCmp);
  Object.assign(r,{field:rows,place:rows.indexOf(me)+1,of:rows.length,clsName:C0.n,tier:C0.tier,auto:HC.auto&&HC.took==null,took:HC.took,handed:HC.handed||null,chName:SIM.CHASSIS[opt.ch].n,tyreName:SIM.HILL_TYRES[opt.tyre].n,aeroName:SIM.HILL_AERO[opt.aero].n,
    secNames:T.sections.map(s=>s.n),lead:HC.lead?{n:HC.lead.n,t:HC.lead.t,splits:HC.lead.splits}:null});
  if(r.dnf)r.place=rows.indexOf(me)+1;
  if(same&&!r.dnf&&!ff){const RR=hillRecs(),was=RR[k];if(!was||r.time<was.t){RR[k]=Object.assign({t:r.time,splits:r.splits.slice(),ch:opt.ch},recTag());r.pb=was?{was:was.t}:{first:true};if(was)setTimeout(()=>toast(`CLASS RECORD · ${fmtHill(r.time)} (was ${fmtHill(was.t)})`),2700);}}
  const res=Object.assign({},prep.refRes,{hill:r});S.last={hash:snap.h,cfg:snap.cfg,env,res};
  const pl=ordN(r.place)+" of "+r.of,sc=r.dnf?(r.dnf.kind==="edge"?"over the edge at "+r.dnf.name:r.dnf.kind==="boil"?"boiled over in "+r.dnf.name:r.dnf.kind==="stall"?"couldn't climb the grade":"flagged off in "+r.dnf.name):fmtHill(r.time);
  if(career()&&same){addWear(0.6+(r.coolPeak>112?0.4:0)+(r.dmg>0?0.3:0),hKey(snap.h));
    if(r.dnf){C().rep=Math.max(0,C().rep-(r.dnf.kind==="edge"?2:1));logEvent(`Pikes Peak: ${C0.n} — DNF, ${sc}`,"bad");toast(`DNF · ${sc}`);}
    else{const purse=Math.round((HILL_PURSE[r.place-1]||0)*(HILL_PAY[C0.tier]||1)/10)*10,rep=(HILL_REP[r.place-1]||0)+1;r.purse=purse;r.rep=rep;C().cash+=purse;C().rep+=rep;
      logEvent(`Pikes Peak: ${C0.n} — ${sc}, ${pl}${purse?", purse "+fmt$(purse):""}`,r.place<=3?"good":"");toast(`${sc} · ${ordN(r.place)}${purse?" · "+fmt$(purse):""}`);}
    spEvent("hill",{win:!r.dnf&&r.place===1,finish:!r.dnf&&r.place>1&&r.place<=3,record:!!(r.pb&&r.pb.was)});hud();checkGoals();}
  else toast(r.dnf?`DNF · ${sc}`:`${sc} · ${pl}`);
  if(!career())delete HILL_SB[Object.keys(SIM.HILL_CLASSES).indexOf(k)+1];   // a fresh mountain next run
  achCheck({type:"hill",r});
  HC.run=null;HC.prep=null;save();recompute();renderTest();revealVerdict();
}
function hillVerdict(res){const r=res.hill;
  if(r.dnf)return `<div class="verdict fail"><div><div class="big">${hillDnfWord(r.dnf.kind)} · DNF</div><p>${r.dnf.kind==="edge"?`Too fast into ${hlEsc(r.dnf.name)} with a drop on the outside and no guardrail`:r.dnf.kind==="boil"?`The water went past boiling in ${hlEsc(r.dnf.name)} — thin air through the radiator`:r.dnf.kind==="stall"?`Not enough torque to pull the car up the grade in ${hlEsc(r.dnf.name)} — a shorter final drive, or more engine`:`Still on the mountain at half an hour, in ${hlEsc(r.dnf.name)}`} · ${(r.dnf.s/1000).toFixed(2)} km up, ${fmtHill(r.dnf.t)} in${career()?" — reputation took a hit":""}.</p></div></div>`;
  const cls=r.place===1?"pass":r.place<=HILL_PURSE.length?"marg":"fail",hp=r.hp,top=hp[hp.length-1];
  return `<div class="verdict ${cls}"><div style="flex:1"><div class="big">${fmtHill(r.time)} · ${ordN(r.place)}</div><p>${hlEsc(r.clsName)} · ${ordN(r.place)} of ${r.of} · ${hlEsc(r.chName.toLowerCase().replace("gt","GT").replace("awd","AWD"))}, ${r.tyreName.toLowerCase()} tyres${r.aero!=="none"?", "+r.aeroName.toLowerCase():""}${r.auto?" · auto driver":r.took!=null?` · you took over at ${(r.took/1000).toFixed(1)} km`:""}${career()&&r.purse?` · purse ${fmt$(r.purse)}`:""}${r.pb&&r.pb.was?` · class record (was ${fmtHill(r.pb.was)})`:""}</p>
    <div class="vstats"><div><b>${r.avgKmh}</b><span>avg km/h</span></div><div><b>${Math.round(r.vmax)}</b><span>top km/h</span></div><div><b>${r.offs.length}</b><span>off${r.offs.length===1?"":"s"} · ${r.moments} moment${r.moments===1?"":"s"}</span></div><div><b>${top.hp}</b><span>hp on top · ${Math.round(100*top.hp/r.refHp)}%</span></div><div><b>${r.coolPeak}</b><span>water °C peak</span></div><div><b>${r.m.toLocaleString("en-CA")}</b><span>kg</span></div></div></div></div>`;}
function hillSheet(res){const r=res.hill,b=hillRecs()[r.cls],L=r.lead;let pt=0,lt=0;
  const rows=r.secNames.map((n,i)=>{const t=r.splits[i],sec=t!=null?t-pt:null;const lsec=L&&L.splits&&L.splits[i]!=null?L.splits[i]-lt:null;if(t!=null)pt=t;if(L&&L.splits&&L.splits[i]!=null)lt=L.splits[i];
    const d=sec!=null&&lsec!=null?sec-lsec:null;return `<div><b>${i+1}</b><span class="nm">${hlEsc(n)}</span><span>${sec!=null?sec.toFixed(2):"—"}</span><span class="et">${t!=null?fmtHill(t):"—"}</span><span style="color:${d==null?"":d<=0?"var(--good)":"var(--crit)"}">${d!=null?(d<=0?"−":"+")+Math.abs(d).toFixed(2):""}</span></div>`;}).join("");
  const offs=r.offs.map(o=>`${o.kind==="rail"?"guardrail":o.kind==="bank"?"into the bank":"gravel"} at ${hlEsc(o.name||r.secNames[o.sec])} (+${o.loss} s)`).join(" · ");
  const hp=r.hp.map(p=>`${p.alt.toLocaleString("en-CA")} m <b>${p.hp}</b>${p.boost?" @ "+bv(p.boost)+" "+pU():""}`).join(" · ");
  const wi=wearInfo(res),wear=wi?`<div><b>Wear</b>${wi.passes} of ${wi.budget} pass${wi.budget===1?"":"es"} · <span style="color:${wi.w>=1?"var(--crit)":wi.w>0.6?"var(--warn)":"var(--good)"}">${Math.round(wi.w*100)}%</span></div>`:"";
  return `<div class="sec"><h2>Hillclimb sheet</h2><div class="rtop hlsplit"><span>Splits${L?" · against "+hlEsc(L.n)+", the class's best":""}</span>${rows}</div><div class="log" style="margin-top:8px">
    <div><b>Run</b>${r.dnf?"DNF":fmtHill(r.time)} · ${(r.len/1000).toFixed(2)} km · ${r.avgKmh!=null?r.avgKmh+" km/h average · ":""}${Math.round(r.vmax)} km/h top${b&&!r.dnf?` · class record ${fmtHill(b.t)}`:""}</div>
    <div><b>Power</b>${hp} hp — ${r.refHp} hp at the shop${r.carb?" · carburettor running rich up top":""}</div>
    <div><b>Driving</b>${r.auto?"Auto driver all the way":r.took!=null?`Auto to ${(r.took/1000).toFixed(1)} km, then you`:"You drove"}${r.handed?` to ${(r.handed/1000).toFixed(1)} km, then the auto driver took the rest`:""} · ${r.moments} moment${r.moments===1?"":"s"}${offs?" · "+offs:" · no offs"}</div>
    <div><b>Heat</b>water ${r.coolPeak} °C peak${r.derateT>0?` · ${r.derateT.toFixed(0)} s pulling power to save itself`:""} · on top the air is ${Math.round(100*(1-0.69))}% thinner, so the radiator sheds about ${Math.round(100*(1-Math.pow(0.69,0.8)))}% less heat per degree</div>
    <div><b>Car</b>${hlEsc(r.chName)} · ${r.m.toLocaleString("en-CA")} kg · ${r.tyreName} · ${r.aeroName} · final ${r.fd.toFixed(2)}:1${r.dmg>0?` · bodywork damaged (−${Math.round(r.dmg*100)}% power through the rest)`:""}</div>${wear}</div>
    <div class="pfield" style="margin-top:10px">${r.field.map((f,i)=>`<b>${i+1}</b><span class="nm${f.me?" me":""}">${f.me?"▶ ":""}${hlEsc(f.n)}${f.me?"":` <small style="opacity:.6">${f.hp} hp${f.turbo?" turbo":""}</small>`}</span><span class="${f.me?"me":""}">${f.t!=null?fmtHill(f.t):f.dnf==="edge"?"DNF · edge":"DNF"}</span>`).join("")}</div></div>`;}
/* the chart: power against altitude — this engine, what an atmospheric engine of the same shop power would make, the shop line */
function drawHillChart(r){const css=getComputedStyle(document.documentElement),INK=css.getPropertyValue("--ink").trim()||"#e8e3d6",soft=INK.startsWith("#1")?"rgba(27,26,23,.45)":"rgba(232,227,214,.45)";
  const dpr=Math.min(devicePixelRatio,2),W=chart.clientWidth,H=chart.clientHeight;if(chart.width!==W*dpr){chart.width=W*dpr;chart.height=H*dpr;}
  const x=chart.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);const hp=r.hp;if(!hp||!hp.length)return;
  const F=getComputedStyle(document.body).fontFamily,padL=40,padR=14,padT=24,padB=26,cw=W-padL-padR,ch=H-padT-padB,a0=2800,a1=4360,X=a=>padL+cw*(a-a0)/(a1-a0),mx=Math.ceil(r.refHp*1.08/50)*50,Y=v=>padT+ch*(1-v/mx);
  x.strokeStyle=css.getPropertyValue("--grid").trim()||"rgba(255,255,255,.07)";x.lineWidth=1;x.font="10px "+F;
  const stp=mx>600?200:mx>300?100:50;for(let v=0;v<=mx;v+=stp){const py=Y(v);x.beginPath();x.moveTo(padL,py);x.lineTo(W-padR,py);x.stroke();x.fillStyle=soft;x.textAlign="right";x.fillText(v,padL-4,py+3);}
  x.textAlign="center";for(let a=3000;a<=4300;a+=W>480?250:500){x.fillStyle=soft;x.fillText(a.toLocaleString("en-CA")+" m",X(a),H-8);}
  // treeline, sections up top
  x.setLineDash([3,4]);x.strokeStyle="rgba(79,192,141,.5)";x.beginPath();x.moveTo(X(SIM.HILL_TREE),padT);x.lineTo(X(SIM.HILL_TREE),padT+ch);x.stroke();x.setLineDash([]);
  x.fillStyle="rgba(79,192,141,.8)";x.textAlign="left";x.fillText("treeline",X(SIM.HILL_TREE)+4,padT+ch-4);
  // the shop figure, an atmospheric engine of the same shop power (∝ density^1.1), this engine
  x.strokeStyle=soft;x.setLineDash([2,3]);x.beginPath();x.moveTo(padL,Y(r.refHp));x.lineTo(W-padR,Y(r.refHp));x.stroke();x.fillStyle=soft;x.textAlign="right";x.fillText(`${r.refHp} hp at the shop`,W-padR,Y(r.refHp)-4);
  const rho=a=>Math.pow(1-2.25577e-5*a,5.25588)/(273.15+16-6.5*(a-2862)/1000),r500=Math.pow(1-2.25577e-5*500,5.25588)/293.15;
  x.strokeStyle="rgba(95,168,230,.85)";x.setLineDash([5,4]);x.lineWidth=1.6;x.beginPath();for(let a=2862;a<=4302;a+=20){const v=r.refHp*Math.pow(rho(a)/r500,1.1);a===2862?x.moveTo(X(a),Y(v)):x.lineTo(X(a),Y(v));}x.stroke();x.setLineDash([]);
  x.strokeStyle="#ff7a1a";x.lineWidth=2.4;x.beginPath();hp.forEach((p,i)=>{i?x.lineTo(X(p.alt),Y(p.hp)):x.moveTo(X(p.alt),Y(p.hp));});x.stroke();
  x.fillStyle="#ff7a1a";hp.forEach(p=>{x.beginPath();x.arc(X(p.alt),Y(p.hp),3,0,7);x.fill();});
  x.font="10.5px "+F;x.textAlign="center";x.fillStyle=INK;hp.forEach((p,i)=>{if(W>420||i%2===0)x.fillText(p.hp,X(p.alt),Y(p.hp)-8);});
  x.textAlign="left";x.font="11px "+F;x.fillStyle="#ff7a1a";x.fillText(r.kind==="turbo"?"this engine (turbo)":r.kind==="na"?"this engine":"this engine (blown)",padL+4,13);x.fillStyle="rgba(95,168,230,.95)";x.fillText("atmospheric",padL+(r.kind==="turbo"?122:r.kind==="na"?80:118),13);
  x.fillStyle=soft;x.textAlign="right";if(W>420)x.fillText(`hp vs altitude · ${r.dnf?"DNF":fmtHill(r.time)}`,W-padR,13);}
function hillRedraw(){const l=lastForChart();if(S.env.testType==="hill"&&l&&l.hill)drawHillChart(l.hill);}
function hillRecHtml(){const P=hillRecs(),ks=Object.keys(SIM.HILL_CLASSES).filter(k=>P[k]&&P[k].t);if(!ks.length)return "";
  return `<div class="rtop"><span>Pikes Peak · best per class</span>${ks.map(k=>{const e=P[k],c=SIM.CHASSIS[e.ch];return `<div><b>▲</b><span class="et">${fmtHill(e.t)}</span><span></span><span class="nm" title="${hlEsc(e.n)}">${hlEsc(SIM.HILL_CLASSES[k].n)}${c?" · "+hlEsc(c.n):""}</span><span>${e.w!=null?"wk "+e.w:e.d?new Date(e.d).toLocaleDateString("en-CA",{month:"short",day:"numeric"}):""}</span></div>`;}).join("")}</div>`;}
