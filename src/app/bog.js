/* ===================== MUD BOG: the engine in a truck, a pit of mud ===================== */
/* run up on the dirt, hit the mud with whatever speed you've got and keep the wheels turning: stuck scores the distance, through scores the time */
let BR=null;
const BOG_FEE=120,BOG_PURSE=[2500,1200,700,400,200],BOG_PAY={1:1,2:1.8,3:3},BOG_REP=[3,2,1],BOG_SB={};
const BOG_NAMES=["Swamp Thing","Mud Butter","Gumbo","Sloppy Joe","Bog Hog","Muddy Waters","Dirty Bird","Low Ground","Sink Hole","Gator Bait","Brown Out","Clay Pigeon","Backwater","Slough Monster","Rooster Tail","Wet Willy","Gravy Train","Stuck Up"];
const BOG_COLORS={street:0x1d4787,modified:0xb7261d,super:0x2c6b3a};
const bogEsc=v=>String(v==null?"":v).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
const bogIsD=c=>SIM.isDiesel?SIM.isDiesel(c):!!(SIM.OPT.fuel[c.fuel]||{}).ci;
function bogClsLocked(k){const c=SIM.BOG_CLASSES[k];return c&&career()&&!dev()&&C().rep<c.rep?c.rep:0;}
/* the truck setup lives on S.env beside the sled's and the salt's; anything a class doesn't run is pulled back in */
function bogEnvFix(){const e=S.env,B=SIM.BOG_CLASSES;if(!B[e.bogCls])e.bogCls="street";const k=e.bogCls,V=B[k].veh,G=B[k].gears;
  if(!V.tyres.includes(e.bogTyre))e.bogTyre=V.tyres[V.tyres.length-1];
  e.bogGear=Math.max(0,Math.min(G.length-1,Math.round(isFinite(+e.bogGear)&&e.bogGear!==""&&e.bogGear!=null?+e.bogGear:1)));
  if(e.bogDrive!=="auto")e.bogDrive="you";return k;}
function bogVeh(k){const e=S.env;return{cls:k,gear:+e.bogGear,tyre:e.bogTyre,redline:S.cfg.redline,idle:bogIsD(S.cfg)?720:Math.max(750,S.cfg.cam>70?1100:850)};}
/* the night: one pit per class per week in career (the same mud all week), a fresh one every run in the sandbox */
function bogSeed(k){const ix=Object.keys(SIM.BOG_CLASSES).indexOf(k)+1;if(!career())return BOG_SB[ix]||(BOG_SB[ix]=Math.floor(Math.random()*1e9)+1);if(!C().bogSeed)C().bogSeed=Math.floor(Math.random()*1e9)+1;return(C().bogSeed^(C().week*7919)^(ix*104729))>>>0;}
function bogHookedWk(k){return career()&&(C().bogWk||{})[k]===C().week;}
const bogNightCache=new Map(),bogFieldCache=new Map();
function bogNight(seed){let n=bogNightCache.get(seed);if(!n){if(bogNightCache.size>12)bogNightCache.clear();n=SIM.bogNight(seed);bogNightCache.set(seed,n);}return n;}
/* the rest of the class: 5–7 trucks, each its own engine and driver run through the same sim and the same mud */
function bogField(k,seed){const key=k+"|"+seed;if(bogFieldCache.has(key))return bogFieldCache.get(key);
  const C0=SIM.BOG_CLASSES[k],F=C0.field,r=pullRand((seed^0x2F6B1D)>>>0),night=bogNight(seed),names=BOG_NAMES.slice(),n=5+Math.floor(r()*3),out=[];
  for(let i=0;i<n;i++){const nm=names.splice(Math.floor(r()*names.length),1)[0],gs=Math.sqrt(-2*Math.log(Math.max(1e-6,r())))*Math.cos(2*Math.PI*r());
    const hp=Math.round(Math.max(140,F.hp+gs*F.sd)),dsl=r()<F.dsl,skill=+(0.45+0.55*r()).toFixed(2),gear=Math.min(C0.gears.length-1,Math.max(0,1+(r()<0.25?-1:r()<0.3?1:0))),tyre=C0.veh.tyres[r()<0.8?C0.veh.tyres.length-1:0];
    const res=SIM.bogAiRes(hp,dsl,(seed+i*977)>>>0);let q;try{q=SIM.bogPass(res,{cls:k,gear,tyre,redline:res.redline,idle:dsl?720:850,seed:(seed^(i+1)*2654435761)>>>0,night,noFail:true},skill);}catch(e){q={cleared:false,distM:20,pitT:null};}
    const row={n:nm,hp,dsl,cleared:!!q.cleared,t:q.cleared?q.pitT:null,m:q.cleared?night.len:q.distM};
    if(r()<0.06){row.broke=true;row.cleared=false;row.t=null;row.m=+(row.m*(0.25+0.6*r())).toFixed(2);}
    out.push(row);}
  if(bogFieldCache.size>12)bogFieldCache.clear();bogFieldCache.set(key,out);return out;}
/* mud-bog order: through the pit beats stuck in it; through, the quicker time; stuck, the farther */
const bogCmp=(a,b)=>(a.dq?1:0)-(b.dq?1:0)||(b.cleared?1:0)-(a.cleared?1:0)||(a.cleared?a.t-b.t:b.m-a.m)||(a.me?-1:b.me?1:0);
const bogScore=f=>f.dq?"DQ":f.cleared?f.t.toFixed(2)+" s":f.m.toFixed(1)+" m";
function bogBtnText(t,sub){const b=$("bogBtn");const k=t+"|"+(sub||"");if(b.dataset.k===k)return;b.dataset.k=k;b.innerHTML=t+(sub?`<small style="display:block;font-size:12px;letter-spacing:.5px;opacity:.75;margin-top:2px">${sub}</small>`:"");}
function bogBreak(kind){BR.failed=true;BR.failKind=kind;run.fail=true;run.failKind=FAIL_VISUAL[kind]||(kind==="turbo"?"turbo":kind==="piston"?"knock":"rod");$("flash").style.background="rgba(238,90,94,.45)";setTimeout(()=>$("flash").style.background="rgba(238,90,94,0)",250);sfx("fail");buzz([80,40,120]);}
function bogStart(){
  $("app").classList.add("onstrip");
  const k=bogEnvFix(),env=stdEnv();const res=SIM.bogPrep(S.cfg,env);
  const wi=wearInfo(res);if(wi&&wi.w>0){const f=1-0.05*Math.min(1,wi.w);res.torque=res.torque.map(t=>t*f);if(res.naTorque)res.naTorque=res.naTorque.map(t=>t*f);res.power=res.power.map(t=>t*f);res.peakTq*=f;res.peakHp*=f;res.wornBy=Math.round((1-f)*100);}
  const snap=testSnap(),hk=hKey(snap.h),veh=bogVeh(k),seed=bogSeed(k),night=bogNight(seed),field=bogField(k,seed);
  if(career())(C().bogWk=C().bogWk||{})[k]=C().week;
  veh.seed=career()?(seed+7919*(C().bogRuns=(C().bogRuns||0)+1))>>>0:Math.floor(Math.random()*1e9);veh.night=night;if(wi&&wi.w>=1)veh.wornAt=1.5+Math.random()*4;
  const p=SIM.bogRun(res,veh),C0=SIM.BOG_CLASSES[k],pitK=C0.veh.pitK||1;
  const lead=field.slice().sort(bogCmp)[0];
  BR={p,res,env,veh,k,hk,snap,seed,night,field,lead,pitK,pit:{seed:night.seed,len:night.len,cons:night.cons,depth:night.depth,hz:night.hz,pitK},auto:S.env.bogDrive==="auto",last:performance.now(),down:false,failed:false,failKind:null,doneAt:null,lastPtr:0,slaps:0,hz:0,slapT:0,color:BOG_COLORS[k]};
  ENGINE_VIS.setAutoRotate(false);$("rpmbox").style.display="block";$("bogCtl").style.display="";$("bogBtn").dataset.k="";$("bogBtn").disabled=false;
  bogBtnText(BR.auto?"START THE RUN":"HOLD TO DRIVE",BR.auto?"the driver takes it from here":"hold for throttle · let go to feather the wheelspin");
  $("testProg").classList.remove("done");sfx("start");bogHud(p.st);
  requestAnimationFrame(()=>{const pn=$("panel"),r=$("bogCtl").getBoundingClientRect(),pr=pn.getBoundingClientRect(),bot=Math.min(pr.bottom,tabsTop())-8;if(r.bottom>bot||r.top<pr.top)pn.scrollTo({top:pn.scrollTop+(r.height>bot-pr.top?r.top-pr.top-4:r.bottom-bot),behavior:calmScroll()});});
  const step=()=>{if(!BR||BR.finished)return;const now=performance.now();const dt=Math.min(0.25,(now-BR.last)/1000);BR.last=now;const st=p.st;
    let left=dt;while(left>1e-6&&!st.done){const d=Math.min(0.02,left);left-=d;p.step(d,bogThr(st));}
    if(st.broke&&!BR.failed)bogBreak(st.broke);
    if(st.done&&BR.doneAt==null){BR.doneAt=now;if(st.cleared&&!BR.failed){$("flash").style.background="rgba(92,191,138,.35)";setTimeout(()=>$("flash").style.background="rgba(238,90,94,0)",400);buzz([30,40,30,40,90]);}else buzz([40]);}
    // mud slaps: the pit entry, a ridge, a rut, a landing — and the wheels throwing it while they spin
    let slap=0;if(st.phase==="pit"&&BR.ph!=="pit")slap=1;if(st.hzHit.length>BR.hz){BR.hz=st.hzHit.length;slap=Math.max(slap,0.8);}if(st.slaps>BR.slaps){BR.slaps=st.slaps;slap=Math.max(slap,0.9);}
    if(slap)sfx("mudslap");else if(st.phase==="pit"&&!st.done&&st.slip>0.2&&now-BR.slapT>Math.max(140,520-600*st.slip)){BR.slapT=now;sfx("mudslap");}
    BR.ph=st.phase;
    const x=Math.max(-50,st.x),dF=SIM.bogDepth(BR.night,x)*BR.pitK,dR=SIM.bogDepth(BR.night,x-3.6)*BR.pitK;
    if(ENGINE_VIS.setBog)ENGINE_VIS.setBog({on:true,phase:st.phase,x:st.x,v:st.v,wspd:st.w*SIM.BOG_CLASSES[k].veh.tyreDia*0.0254/2,slip:st.slip,sink:st.sink,y:st.y,vy:st.vy,dFront:dF,dRear:dR,rpm:BR.failed?run.rpm:st.rpm,throttle:st.foot,
      smoke:BR.res.diesel?Math.min(1,(BR.res.smoke||0)/60):0.1,cls:k,tyre:veh.tyre,color:BR.color,night:!!S.night,len:BR.night.len,cons:BR.night.cons,pit:BR.pit,mudKg:st.mudKg,pack:st.pack,slap,cleared:st.cleared,failed:BR.failed,belly:st.belly,dig:st.dig,why:st.stopWhy,rw:SIM.BOG_CLASSES[k].veh.tyreDia*0.0254/2,dt});
    bogHud(st);
    run.on=true;
    if(BR.failed)run.rpm=Math.max(0,run.rpm-380);else if(st.done||st.stalled)run.rpm=st.stalled?Math.max(0,run.rpm-260):run.rpm+(veh.idle-run.rpm)*Math.min(1,dt*3);else run.rpm=st.rpm;
    run.load=BR.failed||st.done?0:st.foot;
    $("rpmLbl").textContent=Math.round(run.rpm/10)*10;
    $("testProg").style.width=Math.min(100,100*Math.max(0,st.x)/BR.night.len)+"%";
    const hold=st.cleared?2400:1800;
    if(!st.done||(now-BR.doneAt<hold&&!BR.skip)||(BR.failed&&run.rpm>0&&!BR.skip))requestAnimationFrame(step);else bogFinish();};
  requestAnimationFrame(step);
}
/* the driver's foot: yours (the button), or the auto driver every 20 ms */
function bogThr(st){if(!BR.auto)return BR.down&&!BR.failed?1:0;if(st.phase==="stage")return BR.go?1:0;return BR.failed?0:BR.p.auto(0.92);}
/* the live card: distance (or the clock once through), the pit with the field on it, then the two things the foot manages — wheel speed and rpm */
function bogHud(st){if(!BR)return;const L=BR.night.len,x=Math.max(0,st.x),pc=v=>Math.min(100,100*v/L);
  const stat=BR.failed?"broke":st.cleared?"full":"";
  const say=BR.failed?"BROKE":st.cleared?"THROUGH!":st.done?({stalled:"stalled",highcentre:"high-centred",dug:"dug in",bogged:"bogged down",packed:"packed up",lifted:"lifted"}[st.stopWhy]||"stuck"):st.phase==="stage"?"at the line":st.phase==="runup"?`${Math.round(-st.x)} m to the mud`:Math.round(st.v*2.237)+" mph";
  const pitT=st.tPit!=null?(st.cleared?st.tOut:st.t)-st.tPit:0,big=st.cleared?`${pitT.toFixed(2)}<i>s</i>`:`${x.toFixed(1)}<i>m</i>`;
  const marks=BR.field.map(f=>`<i class="mk${f===BR.lead?" lead":""}" style="left:${Math.min(99.5,pc(f.cleared?L:f.m))}%"></i>`).join("");
  const sw=st.sweet,sp=Math.round(st.slip*100),dg=Math.round(BR.p.digS*100),band=st.bogBand,rl=BR.veh.redline,rpmP=Math.min(100,Math.round(100*st.rpm/(rl*1.05))),bandP=Math.round(100*band[1]/(rl*1.05));
  const d=st.phase==="pit"?st.depth:0,lead=BR.lead;
  $("bogLive").innerHTML=`<div class="ph"><div class="ph-top ${stat}"><b>${big}</b><span>${say}${st.phase==="pit"&&!st.done?"<br>"+pitT.toFixed(1)+" s in the mud":""}</span></div>
    <div class="ph-bar"><i class="fill" style="width:${pc(x)}%"></i>${marks}</div><div class="ph-lbl"><span>0</span><span>leader <b>${lead?bogScore(lead):"—"}</b></span><span>${L} m</span></div>
    <div class="ph-lbl"><span>Mud <b>${bogEsc(BR.night.name)}</b></span><span>${st.phase==="pit"?`depth <b>${Math.round(d*100)} cm</b>`:`${SIM.BOG_CLASSES[BR.k].n}`}</span></div></div>
    <div class="ph"><div class="ph-lbl" style="margin-top:0"><span>Wheelspin <b>${sp}%</b></span><span>${st.pack>0.5?`<b style="color:var(--warn)">LUGS PACKED</b>`:st.dig>0.4?`<b style="color:var(--crit)">DIGGING</b>`:st.belly>0.3?`<b style="color:var(--crit)">ON THE FRAME</b>`:st.air?`<b style="color:var(--info)">AIRBORNE</b>`:`dig past ${dg}%`}</span></div>
    <div class="ph-bar"><i class="sw" style="left:${Math.round(sw[0]*100)}%;width:${Math.round((sw[1]-sw[0])*100)}%"></i><i class="mk" style="left:${dg}%"></i><i class="nd ${st.slip>BR.p.digS?"hot":st.slip>=sw[0]&&st.slip<=sw[1]+0.06?"ok":""}" style="left:${Math.min(99,sp)}%"></i></div>
    <div class="ph-lbl"><span>rpm <b style="color:${st.phase==="pit"&&st.rpm<band[1]?"var(--crit)":""}">${Math.round(st.rpm/10)*10}</b></span><span>${st.stalled?`<b style="color:var(--crit)">STALLED</b>`:st.phase==="pit"&&st.rpm<band[1]?`<b style="color:var(--warn)">BOGGING</b>`:`bog under ${band[1].toLocaleString()}`}</span></div>
    <div class="ph-bar"><i class="zone" style="left:0;width:${bandP}%"></i><i class="fill" style="width:${rpmP}%"></i></div></div>
    <div class="ph-row"><div class="peak"><b>${Math.round(st.v*2.237)}</b><span>mph</span></div><div class="peak"><b style="color:${st.cool>118?"var(--crit)":st.cool>108?"var(--warn)":""}">${Math.round(st.cool)}<i>°C</i></b><span>water</span></div><div class="peak"><b style="color:${st.egt>900?"var(--crit)":st.egt>800?"var(--warn)":""}">${Math.round(st.egt)}<i>°C</i></b><span>EGT</span></div></div>`;
  if(BR.failed)bogBtnText(BR.failKind==="head_lift"?"COOKED IT":BR.failKind==="turbo"?"TURBO GONE":BR.failKind==="piston"||BR.failKind==="crown_temp"?"MELTED A PISTON":"GRENADED","tap to skip");
  else if(st.done)bogBtnText(st.cleared?`THROUGH · ${pitT.toFixed(2)} S`:`${x.toFixed(1)} M`,"tap to skip");
  else if(BR.auto)bogBtnText(st.phase==="stage"?"START THE RUN":"AUTO DRIVER",st.phase==="stage"?"the driver takes it from here":"tap to skip to the result");
  else if(st.phase==="stage")bogBtnText("HOLD TO DRIVE","hold for throttle · let go to feather the wheelspin");
  else if(BR.down)bogBtnText(st.phase==="runup"?"BUILD SPEED":st.slip>BR.p.digS?"DIGGING — FEATHER":st.rpm<band[1]?"BOGGING — STAY IN IT":"IN THE MUD",st.phase==="runup"?"momentum is free":st.slip>BR.p.digS?"let go a moment, then back on":"keep the wheels turning");
  else bogBtnText("FEATHERED","hold to get back on it");}
function bogPress(){if(!BR||BR.finished)return;const st=BR.p.st;if(st.done||BR.failed){bogSkip();return;}
  if(BR.auto){if(st.phase==="stage"){BR.go=true;buzz([20]);}else bogSkip();return;}
  BR.down=true;if(st.phase==="stage")buzz([20]);}
function bogRelease(){if(!BR)return;BR.down=false;}
/* skip: the rest of the run is driven at once (the auto driver's foot, or yours held where it was) */
function bogSkip(){if(!BR||BR.finished)return;const p=BR.p,st=p.st;if(st.phase==="stage"&&!BR.auto)return;
  if(!st.done){let n=0;while(!st.done&&n++<20000)p.step(0.02,BR.auto?p.auto(0.92):BR.down?1:p.auto(0.92));if(st.broke&&!BR.failed)bogBreak(st.broke);}
  if(ENGINE_VIS.bogSkip)ENGINE_VIS.bogSkip();BR.skip=true;if(BR.doneAt==null)BR.doneAt=performance.now()-2000;}
(()=>{const b=$("bogBtn");
  b.addEventListener("pointerdown",e=>{e.preventDefault();BR&&(BR.lastPtr=performance.now());try{b.setPointerCapture(e.pointerId);}catch(x){}bogPress();});
  b.addEventListener("pointerup",()=>{BR&&(BR.lastPtr=performance.now());bogRelease();});
  b.addEventListener("pointercancel",()=>{BR&&(BR.lastPtr=performance.now());bogRelease();});
  b.addEventListener("contextmenu",e=>e.preventDefault());
  b.addEventListener("keydown",e=>{if((e.key===" "||e.key==="Enter")&&!e.repeat){e.preventDefault();bogPress();}});
  b.addEventListener("keyup",e=>{if(e.key===" "||e.key==="Enter"){e.preventDefault();bogRelease();}});
  b.addEventListener("click",()=>{if(!BR||!BR.p||performance.now()-(BR.lastPtr||0)<800)return;bogPress();setTimeout(bogRelease,60);});})();
function bogFinish(){
  if(!BR||BR.finished)return;BR.finished=true;const {p,res,env,k,snap,hk}=BR;const r=p.result();const failed=BR.failed,C0=SIM.BOG_CLASSES[k];const same=testSame(snap);
  setTimeout(()=>{if(!testing){if(ENGINE_VIS.setBog)ENGINE_VIS.setBog({on:false});$("app").classList.remove("onstrip");}},2200);
  testing=false;run.on=false;run.fail=false;run.rpm=0;$("rpmbox").style.display="none";$("bogCtl").style.display="none";$("testProg").classList.add("done");setTimeout(()=>{$("testProg").style.width="0";},700);ENGINE_VIS.setAutoRotate(null);
  const me={n:engineName().slice(0,26),me:true,cleared:r.cleared&&!failed,t:r.pitT,m:r.distM,broke:failed};
  const rows=BR.field.map(f=>Object.assign({},f)).concat([me]).sort(bogCmp);
  r.field=rows;r.place=rows.indexOf(me)+1;r.of=rows.length;r.clsName=C0.n;r.tier=C0.tier;r.auto=BR.auto;r.cleared=me.cleared;
  if(failed){r.broke=r.broke||BR.failKind;r.failKind=r.failKind||BR.failKind;}
  if(same)bogPb(r,failed);
  res.bog=r;res.bogFailed=failed;res.bogFailKind=failed?BR.failKind:null;S.last={hash:snap.h,cfg:snap.cfg,env,res};
  const pl=ordN(r.place)+" of "+r.of,sc=r.cleared?`THROUGH · ${r.pitT.toFixed(2)} s`:`${r.distM.toFixed(1)} m`;
  if(career()&&same){addWear(0.5+Math.min(1,r.time/25)*0.5+(r.coolPeak>115?0.4:0),hk);
    if(failed){C().cert=null;C().rep=Math.max(0,C().rep-2);logEvent(`Mud bog: ${C0.n} — ${r.broke==="head_lift"?"cooked it":r.broke==="turbo"?"turbo let go":"grenaded"} ${r.distM.toFixed(0)} m into the pit`,"bad");toast(`GRENADED IN THE MUD · ${r.distM.toFixed(0)} m`);}
    else{const purse=Math.round((BOG_PURSE[r.place-1]||0)*(BOG_PAY[C0.tier]||1)/10)*10,rep=(BOG_REP[r.place-1]||0)+(r.cleared?1:0);r.purse=purse;r.rep=rep;C().cash+=purse;C().rep+=rep;
      logEvent(`Mud bog: ${C0.n} — ${sc}, ${pl}${purse?", purse "+fmt$(purse):""}`,r.place<=3?"good":"");toast(`${sc} · ${ordN(r.place)}${purse?" · "+fmt$(purse):""}`);}
    spEvent("bog",{win:!failed&&r.place===1,finish:!failed&&r.place>1&&r.place<=3});
    hud();checkGoals();}
  else toast(failed?`GRENADED IN THE MUD · ${r.distM.toFixed(0)} m`:`${sc} · ${pl}`);
  if(!career())delete BOG_SB[Object.keys(SIM.BOG_CLASSES).indexOf(k)+1];   // a new pit next run
  achCheck({type:"bog",r,failed});
  BR.p=null;save();recompute();renderTest();
  revealVerdict();
}
/* records: per class, the quickest time through, or the farthest anyone got */
function bogPb(r,failed){if(ff||failed)return;const R=recs();if(!R.bog||typeof R.bog!=="object")R.bog={};const was=R.bog[r.cls];
  const better=!was||(r.cleared&&(!was.c||r.pitT<was.t))||(!r.cleared&&!was.c&&r.distM>was.m);if(!better)return;
  R.bog[r.cls]=Object.assign({c:!!r.cleared,t:r.cleared?r.pitT:null,m:r.distM,len:r.len},recTag());
  if(was){r.pb={was:was.c?was.t.toFixed(2)+" s":was.m.toFixed(1)+" m"};setTimeout(()=>toast(`CLASS BEST · ${r.cleared?r.pitT.toFixed(2)+" s":r.distM.toFixed(1)+" m"} (was ${r.pb.was})`),2700);}}
function bogRecHtml(){const R=recs(),P=R.bog;if(!P||typeof P!=="object")return "";const ks=Object.keys(SIM.BOG_CLASSES).filter(k=>P[k]);if(!ks.length)return "";
  return `<div class="rtop"><span>Mud bog · best per class</span>${ks.map(k=>{const e=P[k];return `<div><b>${e.c?"✓":"·"}</b><span class="et">${e.c?e.t.toFixed(2):e.m.toFixed(1)}</span><span>${e.c?"s":"m"}</span><span class="nm" title="${bogEsc(e.n)}">${bogEsc(SIM.BOG_CLASSES[k].n)}</span><span>${e.w!=null?"wk "+e.w:e.d?new Date(e.d).toLocaleDateString("en-CA",{month:"short",day:"numeric"}):""}</span></div>`;}).join("")}</div>`;}
function bogHint(){const c=SIM.BOG_CLASSES;return career()?`<b>Mud bog</b> · $${BOG_FEE} entry, one run per class a week. Needs a certified engine. ${c.street.n} is open to anyone; ${c.modified.n} at ${c.modified.rep} rep, ${c.super.n} at ${c.super.rep}. Through the pit beats stuck in it — quickest time wins, then farthest. Purse by placing, up to ${fmt$(BOG_PURSE[0]*BOG_PAY[3])} in Super. Every run is wear, and the mud packs the radiator.`
  :`<b>Mud bog</b> · hold the button for throttle, let go to feather. Carry speed off the run-up, then keep the wheels turning in the mud: a little wheelspin cleans the lugs, too much digs a hole. Stuck scores the distance; through scores the time.`;}
/* a quick look at the night's pit before you run it: length, mud, the depth along it, where the field got to */
function bogPitSvg(night,pitK,field){const L=night.len,W=300,H=40,pts=[];for(let x=0;x<=L;x+=1)pts.push([x/L*W,4+Math.min(1.6,SIM.bogDepth(night,x)*pitK)/1.6*(H-8)]);
  const path="M0,4 "+pts.map(p=>"L"+p[0].toFixed(1)+","+p[1].toFixed(1)).join(" ")+` L${W},4 Z`;
  const mk=(field||[]).map(f=>`<line x1="${((f.cleared?L:f.m)/L*W).toFixed(1)}" x2="${((f.cleared?L:f.m)/L*W).toFixed(1)}" y1="0" y2="${H}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="2 2"/>`).join("");
  const hz=night.hz.map(h=>`<text x="${(h.x/L*W).toFixed(1)}" y="${H-1}" font-size="8" text-anchor="middle" fill="var(--dim)">${h.kind==="rut"?"▾":"▴"}</text>`).join("");
  return `<svg class="bogpit" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Depth along the pit"><path d="${path}" fill="rgba(122,86,52,.55)" stroke="rgba(160,120,80,.9)" stroke-width="1"/>${mk}${hz}</svg>`;}
function bogEnvHtml(sl){const e=S.env,k=bogEnvFix(),C0=SIM.BOG_CLASSES[k],V=C0.veh,G=C0.gears,lk=bogClsLocked(k),seed=bogSeed(k),night=bogNight(seed),field=bogField(k,seed),R=recs().bog||{},pb=R[k];
  const thru=field.filter(f=>f.cleared).length,lead=field.slice().sort(bogCmp)[0];
  let h=`<div class="saltcls"><div><span>Tonight's pit</span><b>${night.len} m</b><small>${bogEsc(night.name)} · ${Math.round(night.d0*(V.pitK||1)*100)} cm deep</small></div><div><span>To beat</span><b>${lead?bogScore(lead):"—"}</b><small>${thru} of ${field.length} got through</small></div><div><span>Your best</span><b>${pb?(pb.c?pb.t.toFixed(2)+" s":pb.m.toFixed(1)+" m"):"—"}</b><small>${pb?(pb.c?"through the pit":"farthest"):"no run yet"}</small></div></div>${bogPitSvg(night,V.pitK||1,field)}`;
  h+=`<div class="lbl"><span>Class</span></div><div class="seg wide">${Object.entries(SIM.BOG_CLASSES).map(([id,c])=>{const l=bogClsLocked(id);return `<button data-bk="bogCls" data-bv="${id}" class="${k===id?"on":""}${l?" lock":""}">${c.n}<small>${l?l+" rep":c.d}</small></button>`;}).join("")}</div>`;
  h+=`<div class="lbl"><span>Driver</span></div><div class="seg">${[["you","You drive","hold for throttle, feather the spin"],["auto","Auto","a steady foot · watch the run"]].map(([id,n,d])=>`<button data-bk="bogDrive" data-bv="${id}" class="${e.bogDrive===id?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>`;
  h+=`<div class="lbl"><span>Gear</span></div><div class="seg">${G.map(([n,mph],i)=>`<button data-bk="bogGear" data-bv="${i}" class="${+e.bogGear===i?"on":""}">${n}<small>${mph} mph at redline</small></button>`).join("")}</div>`;
  h+=`<div class="lbl"><span>Tyres</span></div><div class="seg">${V.tyres.map(id=>{const t=SIM.BOG_TYRES[id];return `<button data-bk="bogTyre" data-bv="${id}" class="${e.bogTyre===id?"on":""}">${t.n}<small>${t.d}</small></button>`;}).join("")}</div>`;
  h+=`<p class="hint">${C0.n}: ${V.mass.toLocaleString("en-CA")} kg truck, ${V.tyreDia}" tyres, ${V.driveN}, ${V.trans==="clutch"?"clutch — it can stall":"automatic"}, ${Math.round(V.clear*100)} cm under the frame. ${V.runup} m run-up. A tall gear carries more speed into the mud but bogs sooner in the deep end; a short one keeps the engine up in its band and spins easier. ${night.cons>0.6?"Sticky clay grabs the tyres and packs slow lugs solid":"Soupy mud lets the tyres sink to the floor but lets go of them"}.${lk?` <b>Opens at ${lk} rep.</b>`:""}${bogHookedWk(k)?` <b>Run this week — the next mud bog is week ${C().week+1}.</b>`:""}</p>`;
  return h;}
$("envBox").addEventListener("click",e=>{const b=e.target.closest("[data-bk]");if(!b)return;const k=b.dataset.bk,v=b.dataset.bv;
  if(k==="bogCls"){const l=bogClsLocked(v);if(l){toast(`${SIM.BOG_CLASSES[v].n} opens at ${l} rep`);return;}if(v!==S.env.bogCls){S.env.bogGear=null;S.env.bogTyre=null;}}
  S.env[k]=k==="bogGear"?+v:v;bogEnvFix();renderEnv();save();buzz(6);});
/* the run sheet's trace: speed and wheelspin against distance, the mud's depth shaded under them */
function drawBogTrace(r){const css=getComputedStyle(document.documentElement),INK=css.getPropertyValue("--ink").trim()||"#edeae1";const soft=INK.startsWith("#1")?"rgba(20,20,19,.45)":"rgba(237,234,225,.45)";
  const dpr=Math.min(devicePixelRatio,2),W=chart.clientWidth,H=chart.clientHeight;if(chart.width!==W*dpr){chart.width=W*dpr;chart.height=H*dpr;}
  const x=chart.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);const tr=(r.trace||[]).filter(p=>p.x>-15);if(!tr.length)return;
  const L=r.len||70,padL=34,padR=34,padT=12,padB=22,cw=W-padL-padR,ch=H-padT-padB,X0=-15,X=d=>padL+cw*Math.max(0,Math.min(1,(d-X0)/(L+5-X0))),mx=Math.max(10,Math.ceil((r.maxMph||10)/5)*5);
  x.strokeStyle=css.getPropertyValue("--grid").trim()||"rgba(255,255,255,.07)";x.lineWidth=1;x.font="10px "+getComputedStyle(document.body).fontFamily;x.textAlign="center";
  for(let f=0;f<=L;f+=10){const px=X(f);x.beginPath();x.moveTo(px,padT);x.lineTo(px,padT+ch);x.stroke();x.fillStyle=soft;x.fillText(f+" m",px,H-6);}
  // the mud: depth hangs down from the top of the plot
  x.fillStyle="rgba(122,86,52,.28)";x.beginPath();x.moveTo(X(0),padT);tr.forEach(p=>{if(p.x>=0)x.lineTo(X(p.x),padT+ch*Math.min(1,p.d/1.6));});x.lineTo(X(Math.min(L,tr[tr.length-1].x)),padT);x.closePath();x.fill();
  const sw=r.sweet||[0.1,0.26];x.fillStyle="rgba(92,191,138,.10)";x.fillRect(X(0),padT+ch*(1-sw[1]),X(L)-X(0),ch*(sw[1]-sw[0]));
  const line=(f,col,w,dash)=>{x.strokeStyle=col;x.lineWidth=w;x.setLineDash(dash||[]);x.beginPath();tr.forEach((p,i)=>{const px=X(p.x),py=padT+ch*(1-Math.max(0,Math.min(1,f(p))));i?x.lineTo(px,py):x.moveTo(px,py);});x.stroke();x.setLineDash([]);};
  const rm=Math.max(3000,Math.ceil(Math.max(...tr.map(p=>p.rpm))/1000)*1000);
  line(p=>p.slip,"rgba(120,169,221,.9)",1.5);line(p=>p.rpm/rm,"#e8c14a",1.2,[2,3]);line(p=>p.v*2.23694/mx,"#d97757",2.2);
  x.strokeStyle=INK;x.lineWidth=1;x.setLineDash([3,3]);x.beginPath();x.moveTo(X(L),padT);x.lineTo(X(L),padT+ch);x.stroke();x.setLineDash([]);
  const ly=padT+ch-6;x.textAlign="left";x.font="11px "+getComputedStyle(document.body).fontFamily;x.fillStyle="#d97757";x.fillText("mph",padL+4,ly);x.fillStyle="rgba(120,169,221,.9)";x.fillText("spin",padL+34,ly);x.fillStyle="#e8c14a";x.fillText("rpm",padL+62,ly);x.fillStyle="rgba(160,120,80,.95)";x.fillText("depth",padL+88,ly);
  x.fillStyle=soft;x.textAlign="right";x.fillText(mx+" mph",W-padR,ly);}
function bogRedraw(){const l=lastForChart();if(S.env.testType==="bog"&&l&&l.bog)drawBogTrace(l.bog);}
function bogVerdict(res){const r=res.bog;
  if(res.bogFailed)return `<div class="verdict fail"><div><div class="big">${r.broke==="head_lift"?"COOKED IT IN THE MUD":r.broke==="turbo"?"TURBO LET GO":r.broke==="piston"||r.broke==="crown_temp"?"MELTED A PISTON":"GRENADED IN THE PIT"}</div><p>${r.distM.toFixed(1)} m into the pit before it let go · scored ${ordN(r.place)} of ${r.of} on distance${career()?" — certification is void and reputation took a hit":""}.</p></div></div>`;
  const cls=r.place===1?"pass":r.place<=BOG_PURSE.length?"marg":"fail";
  return `<div class="verdict ${cls}"><div style="flex:1"><div class="big">${r.cleared?"THROUGH · "+r.pitT.toFixed(2)+" s":r.distM.toFixed(1)+" m"} · ${ordN(r.place)}</div><p>${r.clsName} · ${ordN(r.place)} of ${r.of} · ${r.len} m of ${bogEsc(r.mud)} mud${r.auto?" · auto driver":""}${career()&&r.purse?` · purse ${fmt$(r.purse)}`:""}${r.pb?` · class best (was ${r.pb.was})`:""}</p>
    <div class="vstats"><div><b>${r.cleared?r.pitT.toFixed(2):r.distM.toFixed(1)}</b><span>${r.cleared?"seconds":"metres"}</span></div><div><b>${Math.round(r.entryMph)}</b><span>mph in</span></div><div><b>${r.avgMph!=null?Math.round(r.avgMph):Math.round(r.maxMph)}</b><span>${r.avgMph!=null?"avg mph":"top mph"}</span></div><div><b>${r.sweetT.toFixed(1)}</b><span>s in the band</span></div><div><b>${r.coolPeak}</b><span>water °C</span></div><div><b>${r.peakEgt}</b><span>EGT °C</span></div></div></div></div>`;}
function bogSheet(res){const r=res.bog;const why={cleared:"through",bogged:"bogged down",stalled:"stalled",highcentre:"high-centred",dug:"dug in",packed:"lugs packed",lifted:"lifted",stuck:"stuck",broke:"broke",time:"flagged"}[r.stopWhy]||"stopped";
  const wi=wearInfo(res);const wear=wi?`<div><b>Wear</b>${wi.passes} of ${wi.budget} pass${wi.budget===1?"":"es"} · <span style="color:${wi.w>=1?"var(--crit)":wi.w>0.6?"var(--warn)":"var(--good)"}">${Math.round(wi.w*100)}%</span>${res.wornBy?" · down "+res.wornBy+"% on power":""}${wi.w>0?` <button class="btn sm" id="freshen" style="margin-left:8px">Freshen · ${fmt$(freshenCost(res))}</button>`:""}</div>`:"";
  return `<div class="sec"><h2>Mud bog sheet</h2><div class="log"><div><b>Run</b>${r.cleared?"through in "+r.pitT.toFixed(2)+" s":r.distM.toFixed(1)+" m of "+r.len+" · "+why} · in at ${r.entryMph} mph · ${r.maxMph} mph top</div>
    <div><b>Setup</b>${r.clsName} · ${r.gearName} (${r.mphGear} mph) · ${r.tyre.toLowerCase()} · ${r.ratio}:1 overall</div>
    <div><b>Tyres</b>peak spin ${Math.round(r.peakSlip*100)}% · ${r.sweetT.toFixed(1)} s in the ${Math.round(r.sweet[0]*100)}–${Math.round(r.sweet[1]*100)}% band · ${r.spinT.toFixed(1)} s past the dig point · lugs ${Math.round(r.pack*100)}% packed · ${r.mudKg} kg of mud on it</div>
    <div><b>Heat</b>water ${r.coolPeak} °C peak · radiator ${Math.round(r.radPack*100)}% packed · EGT ${r.peakEgt} °C${r.bogT>0.3?" · "+r.bogT.toFixed(1)+" s lugging under "+r.bogBand[1].toLocaleString()+" rpm":""}</div>
    ${r.reasons.map(x=>`<div>${x}</div>`).join("")}${wear}</div>
    <div class="pfield" style="margin-top:10px">${r.field.map((f,i)=>`<b>${i+1}</b><span class="nm${f.me?" me":""}">${f.me?"▶ ":""}${bogEsc(f.n)}${f.me?"":` <small style="opacity:.6">${f.hp} hp${f.dsl?" diesel":""}</small>`}</span><span class="${f.me?"me":""}">${f.broke&&!f.cleared?"broke · ":""}${bogScore(f)}</span>`).join("")}</div></div>`;}

