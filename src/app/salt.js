/* ---- Bonneville: salt-flat land-speed runs. A push off the line, a run-up, the timed mile, the chute.
   A class record (body × displacement letter × fuel, B for blown) stands until a run beats it AND the backup run
   at the same meet does too: the record is the average of the two. Career meet = the week; sandbox meet = until "New meet". ---- */
let SR=null;
const SALT_FEE={short:350,long:600},SALT_PURSE={altered:1500,roadster:2000,lakester:3500,streamliner:6000},SALT_REP={altered:6,roadster:8,lakester:12,streamliner:18};
const SALT_COLORS={altered:0x2c6b3a,roadster:0xb7261d,lakester:0xd9a52b,streamliner:0x1d4787};
const saltEsc=v=>String(v==null?"":v).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
function saltBodyLocked(k){const b=SIM.LSR_BODIES[k];return b&&career()&&!dev()&&C().rep<b.rep?b.rep:0;}
/* the run setup lives on S.env beside the strip's and the sled's; anything out of range is pulled back in */
function saltEnvFix(){const e=S.env,B=SIM.LSR_BODIES;if(!B[e.saltBody])e.saltBody="altered";const k=e.saltBody;
  if(!SIM.LSR_COURSES[e.saltCourse])e.saltCourse=B[k].course;
  if(!SIM.LSR_CHUTES[e.saltChute])e.saltChute="single";
  if(e.saltCool!=="ice"&&e.saltCool!=="radiator")e.saltCool=k==="streamliner"?"ice":"radiator";
  if(e.saltShift!=="manual")e.saltShift="auto";if(e.saltDrive!=="auto")e.saltDrive="you";
  e.saltAero=e.saltAero==="on"?"on":"off";
  e.saltBallast=Math.max(0,Math.min(300,isFinite(+e.saltBallast)&&e.saltBallast!==""&&e.saltBallast!=null?Math.round(+e.saltBallast/10)*10:0));
  e.saltTop=isFinite(+e.saltTop)&&+e.saltTop>0?Math.max(100,Math.min(520,Math.round(+e.saltTop/5)*5)):0;
  return swapLive()?"altered":k;}   // a swap car runs in an altered class
const saltCache=new Map();
/* the engine at Bonneville's 1,290 m and 32 °C — simulate() re-run in that air, cached per build */
function saltRes(){const h=cfgHash(S.cfg);let r=saltCache.get(h);if(!r){if(saltCache.size>24)saltCache.clear();r=SIM.lsrPrep(S.cfg,stdEnv());saltCache.set(h,r);}return r;}
function saltVeh(k){const e=S.env,res=saltRes();const v={body:k,course:e.saltCourse,redline:S.cfg.redline,aero:e.saltAero==="on",ballast:+e.saltBallast,cooling:e.saltCool,chute:e.saltChute,shift:e.saltDrive==="auto"?"auto":e.saltShift,autoLift:e.saltDrive==="auto",idle:SIM.isDiesel(S.cfg)?720:Math.max(800,S.cfg.cam>70?1100:850)};
  swapSaltOv(v);if(!e.saltTop){e.saltTop=SIM.lsrGearing(res,v);}v.topMph=+e.saltTop;return v;}
function saltCls(k){const r=quick||saltRes();return SIM.lsrClass(S.cfg,r,k||S.env.saltBody);}
function saltBook(){const R=recs();if(!R.lsr||typeof R.lsr!=="object")R.lsr={};const L=R.lsr;if(!L.rec||typeof L.rec!=="object")L.rec={};if(!L.pb||typeof L.pb!=="object")L.pb={};return L;}
/* the standing record for a class: yours if you set it, otherwise the seeded book */
function saltRecord(key){const L=saltBook(),mine=L.rec[key],seed=SIM.lsrRecord(key);return mine&&(!seed||mine.mph>seed.mph)?Object.assign({mine:true,holder:mine.n},mine):seed;}
function saltMeet(){const L=saltBook(),id=career()?"w"+C().week:"s"+(S.saltMeetId||(S.saltMeetId=1));if(!L.meet||L.meet.id!==id)L.meet={id,runs:0,best:{},imp:null};return L.meet;}
function saltFee(){return career()&&!dev()?SALT_FEE[S.env.saltCourse==="long"?"long":"short"]:0;}
function saltBtnText(t,sub){const b=$("saltBtn");const k=t+"|"+(sub||"");if(b.dataset.k===k)return;b.dataset.k=k;b.innerHTML=t+(sub?`<small style="display:block;font-size:12px;letter-spacing:.5px;opacity:.75;margin-top:2px">${sub}</small>`:"");}
function saltBreak(kind){if(kind==="driveline"){if(!SR.dl){SR.dl=true;sfx("fail");buzz([80,40,120]);toast("DRIVELINE LET GO · the engine is fine");}return;}   // a swap car's gearbox or axle
  SR.failed=true;SR.failKind=kind;run.fail=true;run.failKind=FAIL_VISUAL[kind]||(kind==="turbo"?"turbo":kind==="piston"?"knock":kind==="steam"?"steam":"rod");$("flash").style.background="rgba(226,71,60,.45)";setTimeout(()=>$("flash").style.background="rgba(226,71,60,0)",250);sfx("fail");buzz([80,40,120]);}
function saltStart(){
  $("app").classList.add("onstrip");
  const k=saltEnvFix(),env=stdEnv(),base=saltRes();
  const res=Object.assign({},base);const wi=wearInfo(res);
  if(wi&&wi.w>0){const f=1-0.05*Math.min(1,wi.w);res.torque=base.torque.map(t=>t*f);res.peakTq=base.peakTq*f;res.peakHp=base.peakHp*f;res.wornBy=Math.round((1-f)*100);}
  const snap=testSnap(),veh=saltVeh(k),hk=hKey(snap.h);veh.seed=Math.floor(Math.random()*1e9);if(wi&&wi.w>=1)veh.wornAt=8+Math.random()*30;
  const p=SIM.lsrRun(res,veh),cls=SIM.lsrClass(S.cfg,res,k),meet=saltMeet();
  if(meet.imp&&(meet.imp.key!==cls.key||meet.imp.hk!==hk)){toast("Left impound — that record attempt is void");meet.imp=null;}
  const backup=!!meet.imp;
  SR={p,res,env,veh,k,hk,snap,cls,rec:saltRecord(cls.key),backup,last:performance.now(),down:false,failed:false,failKind:null,doneAt:null,lastPtr:0,warp:1,auto:S.env.saltDrive==="auto",thrAI:1,color:SALT_COLORS[k]};
  ENGINE_VIS.setAutoRotate(false);$("rpmbox").style.display="block";$("saltCtl").style.display="";$("saltBtn").dataset.k="";$("saltBtn").disabled=false;
  $("saltShiftBtn").style.display=!SR.auto&&veh.shift==="manual"?"":"none";saltWarpUi();
  saltBtnText(SR.auto?"START THE PUSH":"HOLD TO RUN",SR.auto?"the driver takes it from here":"push off · hold for throttle, let go to feather");
  $("testProg").classList.remove("done");sfx("start");saltHud(p.st);
  requestAnimationFrame(()=>{const pn=$("panel"),r=$("saltCtl").getBoundingClientRect(),pr=pn.getBoundingClientRect(),bot=Math.min(pr.bottom,tabsTop())-8;if(r.bottom>bot||r.top<pr.top)pn.scrollTo({top:pn.scrollTop+(r.height>bot-pr.top?r.top-pr.top-4:r.bottom-bot),behavior:calmScroll()});});
  const course={x0:p.x0,x1:p.x1,k0:p.k0,k1:p.k1,xEnd:p.xEnd};
  const step=()=>{if(!SR||SR.finished)return;const now=performance.now();const rdt=Math.min(0.25,(now-SR.last)/1000);SR.last=now;const st=p.st;
    const wp=st.phase==="run"||st.phase==="shutdown"?SR.warp:1;let left=rdt*wp;
    while(left>1e-6&&!st.done){const d=Math.min(0.02,left);left-=d;p.step(d,saltThr(st));}
    if(st.broke&&!SR.failed)saltBreak(st.broke);
    if(st.phase==="spin"&&!SR.spun){SR.spun=true;buzz([60,30,60]);sfx("fail");}
    if(st.tOut!=null&&!SR.miled){SR.miled=true;buzz([20,30,20]);}
    if(st.done&&SR.doneAt==null){SR.doneAt=now;buzz([40]);}
    if(ENGINE_VIS.setSalt)ENGINE_VIS.setSalt({on:true,phase:st.phase,x:st.x,v:st.v,acc:st.acc,slip:Math.max(0,st.slip),rpm:SR.failed?run.rpm:st.rpm,throttle:st.foot,body:k,aero:veh.aero,color:SR.color,
      chute:st.chuteOut||st.drogueOut,chutes:veh.chute==="dual"?2:veh.chute==="single"?1:0,chuteMask:veh.chute==="dual"?(st.drogueOut?1:0)|(st.chuteOut?2:0):(st.chuteOut?1:0),chuteBlown:st.chuteBlown,night:!!S.night,failed:SR.failed,smoke:SR.res.diesel?Math.min(1,(SR.res.smoke||0)/60)*st.foot:0,course,lightness:1-Math.min(1,st.light),dt:rdt*wp});
    saltHud(st);
    run.on=true;
    if(SR.failed)run.rpm=Math.max(0,run.rpm-380);else if(st.done)run.rpm+=(veh.idle-run.rpm)*Math.min(1,rdt*3);else run.rpm=st.rpm;
    run.load=SR.failed||st.done?0:(st.phase==="run"?st.foot:0.1);
    $("rpmLbl").textContent=Math.round(run.rpm/10)*10;
    $("testProg").style.width=Math.min(100,100*st.x/p.xEnd)+"%";
    if(!st.done||(now-SR.doneAt<2200&&!SR.skip))requestAnimationFrame(step);else saltFinish();};
  requestAnimationFrame(step);
}
/* the driver's foot: yours (the button), or the auto driver feathering wheelspin and a light nose every 20 ms */
function saltThr(st){if(!SR.auto)return SR.down&&!SR.failed?1:0;if(st.phase==="stage")return SR.go?1:0;if(st.phase!=="run")return 1;
  const bad=st.slip>0.13||st.light<0.5||st.loose>0.3;SR.thrAI=bad?Math.max(0.04,SR.thrAI*(st.slip>0.2||st.loose>0.5?0.7:0.88)):Math.min(1,SR.thrAI+0.03);return SR.thrAI;}
function saltWarpUi(){document.querySelectorAll("#saltWarp [data-warp]").forEach(b=>b.classList.toggle("on",+b.dataset.warp===(SR?SR.warp:1)));}
/* the live card: speed first, then the course with the timed mile on it, then what the driver is managing */
function saltHud(st){if(!SR)return;const p=SR.p,mph=st.v*2.23694,mi=st.x/SIM.LSR_MILE,xe=p.xEnd,pc=x=>Math.min(100,100*x/xe);
  const stat=SR.failed?"broke":st.phase==="spin"?"broke":st.tOut!=null&&!SR.failed?"full":"";
  const say=SR.failed?"BROKE":st.phase==="spin"?"SPUN":st.phase==="stage"?"on the line":st.phase==="push"?"push truck":st.phase==="run"?(st.x<p.x0?`${((p.x0-st.x)/SIM.LSR_MILE).toFixed(2)} mi to the clocks`:"IN THE MILE"):st.phase==="shutdown"?(st.chuteWait?"coasting to chute speed":st.chuteBlown?"chute tore off":st.chuteOut?"chute out":st.drogueOut?"drogue out":"shut off"):"stopped";
  const split=st.tIn!=null&&st.tOut==null&&st.t>st.tIn?`${(SIM.LSR_MILE*Math.min(1,(st.x-p.x0)/SIM.LSR_MILE)/Math.max(0.01,st.t-st.tIn)*2.23694).toFixed(1)} avg`:st.mileMph!=null?`<b>${st.mileMph.toFixed(3)}</b>`:"—";
  const rec=SR.rec,need=SR.backup?"backup run":"record";
  const lt=Math.round(st.light*100),sp=Math.round(Math.max(0,st.slip)*100),loose=Math.min(100,Math.round(st.loose*100));
  $("saltLive").innerHTML=`<div class="ph"><div class="ph-top ${stat}"><b>${mph.toFixed(1)}<i>mph</i></b><span>${say}<br>${st.phase==="stage"?SR.cls.key:mi.toFixed(2)+" mi · gear "+(st.gear+1)}</span></div>
    <div class="ph-bar"><i class="zone" style="left:${pc(p.x0)}%;width:${pc(p.x1)-pc(p.x0)}%"></i><i class="fill" style="width:${pc(st.x)}%"></i>${[1,2,3,4,5,6].filter(m=>m*SIM.LSR_MILE<xe).map(m=>`<i class="mk" style="left:${pc(m*SIM.LSR_MILE)}%"></i>`).join("")}</div>
    <div class="ph-lbl"><span>start</span><span>mile ${split}</span><span>${need} <b>${rec?rec.mph.toFixed(3):"—"}</b></span></div></div>
    <div class="ph"><div class="ph-lbl" style="margin-top:0"><span>Wheelspin <b>${sp}%</b></span><span>${loose>30?`<b style="color:var(--crit)">LOOSE ${loose}%</b>`:lt<55&&st.phase==="run"?`<b style="color:var(--warn)">FRONT LIGHT ${lt}%</b>`:`front ${lt}%`}</span></div>
    <div class="ph-bar"><i class="sw" style="left:0;width:13%"></i><i class="nd ${sp>22?"hot":sp<=13?"ok":""}" style="left:${Math.min(99,sp*2)}%"></i></div></div>
    <div class="ph-row"><div class="peak"><b>${Math.round(st.rpm/10)*10}</b><span>rpm</span></div><div class="peak"><b style="color:${st.coolC>118?"var(--crit)":st.coolC>108?"var(--warn)":""}">${Math.round(st.coolC)}<i>°C</i></b><span>water</span></div><div class="peak"><b style="color:${st.egt>950?"var(--crit)":st.egt>880?"var(--warn)":""}">${Math.round(st.egt)}<i>°C</i></b><span>EGT</span></div></div>`;
  if(SR.failed)saltBtnText(SR.failKind==="steam"?"BLEW THE HEAD GASKET":SR.failKind==="turbo"?"TURBO GONE":SR.failKind==="piston"?"MELTED A PISTON":"BROKE","tap to skip");
  else if(st.phase==="spin")saltBtnText("SPUN","tap to skip");
  else if(st.done)saltBtnText(st.mileMph!=null?`${st.mileMph.toFixed(3)} MPH`:"NO TIME","tap to skip");
  else if(SR.auto)saltBtnText(st.phase==="stage"?"START THE PUSH":"AUTO DRIVER",st.phase==="stage"?"the driver takes it from here":"tap to skip to the result");
  else if(st.phase==="stage")saltBtnText("HOLD TO RUN","push off · hold for throttle, let go to feather");
  else if(st.phase==="push")saltBtnText("PUSHING","hold — the clutch goes out at 27 mph");
  else if(st.phase==="shutdown")saltBtnText(st.chuteOut?"CHUTE OUT":st.drogueOut?"DROGUE OUT":st.chuteWait?"COASTING":"SHUT OFF",st.chuteOut?"tap to skip":st.chuteWait?"chute comes out at its rated speed":"tap for the chute");
  else if(SR.down)saltBtnText(st.loose>0.3?"LOOSE — LIFT":st.light<0.5?"FRONT LIGHT — LIFT":sp>15?"SPINNING — FEATHER":"FLAT OUT",SR.veh.shift==="manual"?"SHIFT with ↑ or G":"let go to feather");
  else saltBtnText("FEATHERED","hold to get back on it");}
function saltPress(){if(!SR||SR.finished)return;const st=SR.p.st;if(st.done||SR.failed||st.phase==="spin"){saltSkip();return;}
  if(SR.auto){if(st.phase==="stage"){SR.go=true;buzz([20]);}else saltSkip();return;}
  if(st.phase==="shutdown"){if(!st.chuteOut&&!st.chuteWait)SR.p.chute();else saltSkip();return;}
  SR.down=true;if(st.phase==="stage")buzz([20]);}
function saltRelease(){if(!SR)return;SR.down=false;}
function saltShift(){if(!SR||SR.finished||!SR.p)return;SR.p.shift();buzz([8]);}
/* skip: the rest of the run is simulated at once (same seed, same driver's foot) */
function saltSkip(){if(!SR||SR.finished)return;const p=SR.p,st=p.st;if(st.phase==="stage"&&!SR.auto)return;
  if(!st.done){p.autoShift();let thr=1,n=0;while(!st.done&&n++<20000){if(st.phase==="run"){const bad=st.slip>0.13||st.light<0.5||st.loose>0.3;thr=bad?Math.max(0.04,thr*(st.slip>0.2||st.loose>0.5?0.7:0.88)):Math.min(1,thr+0.03);}else thr=1;p.step(0.02,thr);}
    if(st.broke&&!SR.failed)saltBreak(st.broke);}
  if(ENGINE_VIS.saltSkip)ENGINE_VIS.saltSkip();SR.skip=true;if(SR.doneAt==null)SR.doneAt=performance.now()-2000;}
(()=>{const b=$("saltBtn");
  b.addEventListener("pointerdown",e=>{e.preventDefault();SR&&(SR.lastPtr=performance.now());try{b.setPointerCapture(e.pointerId);}catch(x){}saltPress();});
  b.addEventListener("pointerup",()=>{SR&&(SR.lastPtr=performance.now());saltRelease();});
  b.addEventListener("pointercancel",()=>{SR&&(SR.lastPtr=performance.now());saltRelease();});
  b.addEventListener("contextmenu",e=>e.preventDefault());
  b.addEventListener("keydown",e=>{if((e.key===" "||e.key==="Enter")&&!e.repeat){e.preventDefault();saltPress();}});
  b.addEventListener("keyup",e=>{if(e.key===" "||e.key==="Enter"){e.preventDefault();saltRelease();}});
  b.addEventListener("click",()=>{if(!SR||!SR.p||performance.now()-(SR.lastPtr||0)<800)return;saltPress();setTimeout(saltRelease,60);});
  $("saltShiftBtn").addEventListener("pointerdown",e=>{e.preventDefault();saltShift();});
  $("saltWarp").addEventListener("click",e=>{const w=e.target.closest("[data-warp]");if(!w||!SR)return;SR.warp=+w.dataset.warp;saltWarpUi();buzz(6);});
  document.addEventListener("keydown",e=>{if(!SR||SR.finished||e.repeat||e.ctrlKey||e.metaKey||e.altKey||typingIn(e.target))return;if(e.key==="ArrowUp"||e.key.toLowerCase()==="g"){e.preventDefault();saltShift();}});})();
function saltFinish(){
  if(!SR||SR.finished)return;SR.finished=true;const {p,res,env,k,cls,hk,snap}=SR;const r=p.result();const failed=SR.failed,B=SIM.LSR_BODIES[k];const same=testSame(snap);
  setTimeout(()=>{if(!testing){if(ENGINE_VIS.setSalt)ENGINE_VIS.setSalt({on:false});$("app").classList.remove("onstrip");}},2200);
  testing=false;run.on=false;run.fail=false;run.rpm=0;$("rpmbox").style.display="none";$("saltCtl").style.display="none";$("testProg").classList.add("done");setTimeout(()=>{$("testProg").style.width="0";},700);ENGINE_VIS.setAutoRotate(null);
  const L=saltBook(),meet=saltMeet(),rec=saltRecord(cls.key),dq=r.noChuteFast;
  const valid=same&&r.mileMph!=null&&!dq&&!(r.brokeX!=null&&r.brokeX<r.x1);   // (a run whose mode/career changed underneath books no time)   // broke before the last light: no time
  r.cls=cls;r.rec=rec?{mph:rec.mph,holder:rec.holder,year:rec.year,mine:!!rec.mine}:null;r.clsName=B.n;r.courseName=SIM.LSR_COURSES[r.course].n;r.dq=dq;r.valid=valid;r.backup=SR.backup;
  meet.runs++;if(valid&&(!meet.best[cls.key]||r.mileMph>meet.best[cls.key]))meet.best[cls.key]=r.mileMph;r.meetBest=meet.best[cls.key]||null;r.meetRuns=meet.runs;
  // the record book: a qualifying run over the record goes to impound; the backup run decides it
  let outcome="run";
  if(SR.backup&&meet.imp){const a=meet.imp.mph;if(valid){const avg=(a+r.mileMph)/2;r.avg=+avg.toFixed(3);r.firstMph=a;
      if(rec&&avg>rec.mph){outcome="record";L.rec[cls.key]=Object.assign({mph:+avg.toFixed(3),runs:[a,r.mileMph],was:rec.mph,wasHolder:rec.holder},recTag());}
      else outcome="backupslow";}
    else outcome="backupfail";
    meet.imp=null;}
  else if(valid&&rec&&r.mileMph>rec.mph){outcome="impound";meet.imp={key:cls.key,hk,mph:r.mileMph};}
  r.outcome=outcome;
  // personal best for the class
  const pb=L.pb[cls.key];if(valid&&(!pb||r.mileMph>pb.mph)){L.pb[cls.key]=Object.assign({mph:r.mileMph,km:r.kmMph,peak:r.peakMph},recTag());r.pb=pb?{was:pb.mph}:{first:true};}
  if(failed){r.broke=r.broke||SR.failKind;r.failKind=r.failKind||SR.failKind;}
  if(SR.veh&&SR.veh.bodyObj){r.swap=swapTag();setTimeout(()=>swapAfter(r),0);}
  res.salt=r;res.saltFailed=failed;res.saltFailKind=failed?SR.failKind:null;S.last={hash:snap.h,cfg:snap.cfg,env,res};
  const mphTxt=r.mileMph!=null?r.mileMph.toFixed(3)+" mph":"no time";
  if(career()&&same){addWear(1+Math.min(1.5,r.time/60),hk);let cash=0,rep=0;
    if(failed){C().cert=null;rep-=2;logEvent(`Salt: ${cls.key} — ${r.broke==="steam"?"cooked it":r.broke==="turbo"?"turbo let go":"broke"} at ${(r.trace.length?(r.trace[r.trace.length-1].x/SIM.LSR_MILE).toFixed(1):"0")} mi`,"bad");}
    if(r.stopWhy==="spun"){cash-=800;rep-=1;logEvent(`Salt: ${cls.key} — spun at ${Math.round(r.peakMph)} mph, $800 in body repairs`,"bad");}
    if(r.offEnd||r.chute.blown){cash-=500;}
    if(outcome==="record"){const club=r.avg>=200&&!C().club200;cash+=Math.round(SALT_PURSE[k]*(1+r.avg/300)/10)*10;rep+=SALT_REP[k]+(club?15:0);if(club)C().club200=C().week;r.purse=cash;r.club=club;
      logEvent(`RECORD · ${cls.key} at ${r.avg.toFixed(3)} mph (was ${r.rec.mph.toFixed(3)})${club?" — into the 200 MPH Club":""}`,"good");}
    else if(outcome==="impound")logEvent(`Salt: ${cls.key} — ${mphTxt}, over the record. Impounded for a backup run`,"good");
    else if(!failed&&r.stopWhy!=="spun")logEvent(`Salt: ${cls.key} — ${mphTxt}${r.pb&&!r.pb.first?" (class best)":""}`,"");
    if(r.pb&&!r.pb.first&&outcome!=="record")rep+=1;
    C().cash+=cash;C().rep=Math.max(0,C().rep+rep);r.cash=cash;r.repD=rep;spEvent("salt",{record:outcome==="record"});hud();checkGoals();}
  toast(outcome==="record"?`NEW RECORD · ${r.avg.toFixed(3)} MPH`:outcome==="impound"?`${mphTxt} · OVER THE RECORD — IMPOUND`:failed?"BROKE ON THE SALT":r.stopWhy==="spun"?"SPUN ON THE SALT":dq?`${mphTxt} · NOT ACCEPTED — NO CHUTE`:`${mphTxt}`);
  achCheck({type:"salt",r,failed});   // (no salt badges yet; the trophy room books a class record)
  SR.p=null;save();recompute();renderTest();
  revealVerdict();
}
function saltHint(){const fee=SALT_FEE;return career()?`<b>Speed trials</b> · $${fee.short} entry on the short course, $${fee.long} on the long. Needs a certified engine. ${SIM.LSR_BODIES.lakester.n} opens at ${SIM.LSR_BODIES.lakester.rep} rep, ${SIM.LSR_BODIES.streamliner.n} at ${SIM.LSR_BODIES.streamliner.rep}. Beat a class record and back it up on your next run the same week — the record is the average of the two. Records pay contingency money and reputation; a long run is real wear.`
  :`<b>Salt</b> · hold the button for the push, then for throttle — let go to feather the wheelspin. Salt grips about half as well as a prepped strip. The clocks time the mile ${S.env.saltCourse==="long"?"three":"one"} mile${S.env.saltCourse==="long"?"s":""} out; the chute comes out after it.`;}
/* what this car can do with this setup (steady driver, cached), to check the chute against */
const saltTopCache=new Map();
function saltTopEst(k){const v=saltVeh(k),key=[cfgHash(S.cfg),k,v.course,v.topMph,v.aero,v.ballast,v.cooling].join("|")+(v.bodyObj?"|"+v.bodyObj.swap+"|"+v.bodyObj.mass+"|"+v.bodyObj.cdA:"");if(saltTopCache.has(key))return saltTopCache.get(key);
  const r=SIM.lsrPass(saltRes(),Object.assign({},v,{noFail:true,noSpin:true,autoLift:false,h:0.004}));if(saltTopCache.size>40)saltTopCache.clear();saltTopCache.set(key,r.peakMph);return r.peakMph;}
function saltEnvHtml(sl){const e=S.env,k=saltEnvFix(),B=swapSaltBody()||SIM.LSR_BODIES[k],cls=saltCls(k),rec=saltRecord(cls.key),L=saltBook(),pb=L.pb[cls.key],meet=saltMeet(),res=saltRes(),cell=quick,lk=saltBodyLocked(k);
  const loss=cell&&cell.peakHp>0?Math.round((1-res.peakHp/cell.peakHp)*100):0;
  let h=`<div class="saltcls"><div><span>Class</span><b>${cls.key}</b><small>${cls.litres.toFixed(2)} L · ${cls.blown?"blown":"unblown"} · ${cls.fuelName}${cls.n2o?" (nitrous)":""}</small></div><div><span>Record</span><b>${rec?rec.mph.toFixed(3):"—"}</b><small>${rec?(rec.mine?"you · "+saltEsc(rec.holder||""):saltEsc(rec.holder)+" · "+rec.year):""}</small></div><div><span>Your best</span><b>${pb?pb.mph.toFixed(3):"—"}</b><small>${meet.imp&&meet.imp.key===cls.key?`<em style="color:var(--warn);font-style:normal">IMPOUND · back up ${meet.imp.mph.toFixed(3)}</em>`:pb?"mile mph":"no run yet"}</small></div></div>`;
  h+=`<p class="hint">At Bonneville — ${SIM.SALT_ENV.altitudeM.toLocaleString("en-CA")} m and ${SIM.SALT_ENV.ambientC} °C — this engine makes <b>${Math.round(res.peakHp)} hp</b>${loss>0?`, ${loss}% down on the cell`:""}${cls.blown?" (boost makes up most of the thin air)":" (no boost to make up the thin air)"}.</p>`;
  h+=swapEnvNote();if(!swapLive())h+=`<div class="lbl"><span>Body</span></div><div class="seg wide">${Object.entries(SIM.LSR_BODIES).map(([id,b])=>{const l=saltBodyLocked(id);return `<button data-sk="saltBody" data-sv="${id}" class="${k===id?"on":""}${l?" lock":""}">${b.n}<small>${l?l+" rep":b.d}</small></button>`;}).join("")}</div>`;
  h+=`<div class="lbl"><span>Course</span></div><div class="seg">${Object.entries(SIM.LSR_COURSES).map(([id,c])=>`<button data-sk="saltCourse" data-sv="${id}" class="${e.saltCourse===id?"on":""}">${c.n}<small>${c.d}${career()?" · $"+SALT_FEE[id]:""}</small></button>`).join("")}</div>`;
  h+=`<div class="envgrid">${sl("saltTop","Top gear",100,520,5," mph",e.saltTop||saltVeh(k).topMph)}${sl("saltBallast","Rear ballast",0,300,10," kg",e.saltBallast)}</div><div class="row" style="margin:-2px 0 8px"><button class="chip" data-saltgear>Suggest gearing</button></div>`;
  h+=`<div class="lbl"><span>Aero</span></div><div class="seg">${[["off","Clean","least drag"],["on",B.aero.n,"holds the nose down · more drag"]].map(([id,n,d])=>`<button data-sk="saltAero" data-sv="${id}" class="${e.saltAero===id?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>`;
  h+=`<div class="lbl"><span>Cooling</span></div><div class="seg">${[["radiator","Radiator",B.radDrag?"costs drag in this body":"sheds heat at speed"],["ice","Ice tank","sealed nose · soaks a run's heat"]].map(([id,n,d])=>`<button data-sk="saltCool" data-sv="${id}" class="${e.saltCool===id?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>`;
  h+=`<div class="lbl"><span>Parachute</span></div><div class="seg">${Object.entries(SIM.LSR_CHUTES).map(([id,c])=>`<button data-sk="saltChute" data-sv="${id}" class="${e.saltChute===id?"on":""}">${c.n}<small>${id==="none"?"tech says 175 mph max":c.drogue?"drogue to "+Math.round(c.drogue.rated*2.23694)+", main "+Math.round(c.rated*2.23694)+" mph":"rated "+Math.round(c.rated*2.23694)+" mph"}</small></button>`).join("")}</div>`;
  {const est=saltTopEst(k),rated=SIM.lsrChuteMax(e.saltChute)*2.23694;
   if(e.saltChute==="none"&&est>175)h+=`<p class="hint" style="color:var(--warn)">⚠ This car can do ~${Math.round(est)} mph — over 175 mph tech wants a parachute, or the run won't count.</p>`;
   else if(e.saltChute!=="none"&&est>rated*0.98)h+=`<p class="hint" style="color:var(--warn)">⚠ Chute rated ${Math.round(rated)} mph, this car can do ~${Math.round(est)}. It has to coast down to ${Math.round(rated)} before the chute can open — a long shutdown, and the auto driver lifts early if the course would run out${e.saltChute==="single"?"; the drogue + main pack opens far higher":""}.</p>`;}
  h+=`<div class="lbl"><span>Driver</span></div><div class="seg">${[["you","You drive","hold to run, let go to feather"],["auto","Auto","a steady hand · watch the run"]].map(([id,n,d])=>`<button data-sk="saltDrive" data-sv="${id}" class="${e.saltDrive===id?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>`;
  if(e.saltDrive!=="auto")h+=`<div class="lbl"><span>Shifting</span></div><div class="seg">${[["auto","Auto","shifts at the power peak"],["manual","Manual","SHIFT, ↑ or G — four gears"]].map(([id,n,d])=>`<button data-sk="saltShift" data-sv="${id}" class="${e.saltShift===id?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>`;
  h+=`<p class="hint">${B.n}: ${B.d}. Car ${Math.round(B.mass+res.kg)} kg with this engine · CdA ${(B.cdA+(e.saltAero==="on"?B.aero.cd:0)+(e.saltCool==="ice"?0:B.radDrag)).toFixed(2)} m². Top gear is the road speed at the redline in fourth. Tall gearing is free speed only if the engine can pull it — too tall and it runs out of power below the peak; too short and it sits on the limiter. Lift at speed unloads the front: past half its weight the car wanders. Ballast plants the rear tyres but has to be pushed through the air like everything else.${lk?` <b>Opens at ${lk} rep.</b>`:""}${career()?"":` <button class="chip" data-saltmeet style="margin-left:4px">New meet</button>`}</p>`;
  return h;}
$("envBox").addEventListener("click",e=>{const g=e.target.closest("[data-saltgear]");if(g){const k=saltEnvFix();S.env.saltTop=0;const v=saltVeh(k);S.env.saltTop=SIM.lsrGearing(saltRes(),v);renderEnv();save();toast(`Gearing set: ${S.env.saltTop} mph at redline in top`);return;}
  if(e.target.closest("[data-saltmeet]")){S.saltMeetId=(S.saltMeetId||1)+1;renderEnv();save();toast("New meet — impound cleared");return;}
  const b=e.target.closest("[data-sk]");if(!b)return;const k=b.dataset.sk,v=b.dataset.sv;
  if(k==="saltBody"){const l=saltBodyLocked(v);if(l){toast(`${SIM.LSR_BODIES[v].n} opens at ${l} rep`);return;}if(v!==S.env.saltBody){S.env.saltCourse=SIM.LSR_BODIES[v].course;S.env.saltCool=v==="streamliner"?"ice":"radiator";S.env.saltChute=v==="streamliner"||v==="lakester"?"dual":"single";S.env.saltTop=0;}}
  S.env[k]=v;saltEnvFix();renderEnv();save();buzz(6);});
/* the run sheet's trace: speed and rpm against distance, the timed mile shaded */
function drawSaltTrace(r){const css=getComputedStyle(document.documentElement),INK=css.getPropertyValue("--ink").trim()||"#e8e3d6";const soft=INK.startsWith("#1")?"rgba(27,26,23,.45)":"rgba(232,227,214,.45)";
  const dpr=Math.min(devicePixelRatio,2),W=chart.clientWidth,H=chart.clientHeight;if(chart.width!==W*dpr){chart.width=W*dpr;chart.height=H*dpr;}
  const x=chart.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);const tr=r.trace||[];if(!tr.length)return;
  const MI=SIM.LSR_MILE,xe=r.xEnd||tr[tr.length-1].x,padL=34,padR=34,padT=16,padB=22,cw=W-padL-padR,ch=H-padT-padB,X=d=>padL+cw*Math.min(1,Math.max(0,d/xe));
  const mx=Math.max(50,Math.ceil((r.peakMph||50)/50)*50),rm=Math.max(3000,Math.ceil(Math.max(...tr.map(p=>p.rpm))/1000)*1000),font=getComputedStyle(document.body).fontFamily;
  x.fillStyle="rgba(255,122,26,.10)";x.fillRect(X(r.x0),padT,X(r.x1)-X(r.x0),ch);
  x.strokeStyle=css.getPropertyValue("--grid").trim()||"rgba(255,255,255,.07)";x.lineWidth=1;x.font="10px "+font;x.textAlign="center";
  for(let m=0;m*MI<=xe+1;m++){const px=X(m*MI);x.beginPath();x.moveTo(px,padT);x.lineTo(px,padT+ch);x.stroke();x.fillStyle=soft;x.fillText(m+" mi",px,H-6);}
  for(let v=50;v<mx;v+=50){const py=padT+ch*(1-v/mx);x.beginPath();x.moveTo(padL,py);x.lineTo(padL+cw,py);x.stroke();}
  const line=(f,col,w,dash)=>{x.strokeStyle=col;x.lineWidth=w;x.setLineDash(dash||[]);x.beginPath();tr.forEach((p,i)=>{const px=X(p.x),py=padT+ch*(1-Math.max(0,Math.min(1,f(p))));i?x.lineTo(px,py):x.moveTo(px,py);});x.stroke();x.setLineDash([]);};
  line(p=>p.rpm/rm,"#e8c14a",1.2,[2,3]);line(p=>(p.tc-20)/120,"#c58be0",1.2);line(p=>p.v*2.23694/mx,"#ff7a1a",2.2);
  x.textAlign="left";x.font="11px "+font;x.fillStyle="#ff7a1a";x.fillText("mph",padL+4,padT+10);x.fillStyle="#e8c14a";x.fillText("rpm",padL+34,padT+10);x.fillStyle="#c58be0";x.fillText("water",padL+62,padT+10);
  x.textAlign="right";x.fillStyle=soft;x.fillText(mx+" mph",W-padR,padT+10);
  if(r.mileMph!=null){x.textAlign="center";x.fillStyle=INK;x.font="600 12px "+font;x.fillText(r.mileMph.toFixed(2)+" mph",(X(r.x0)+X(r.x1))/2,padT+ch*(1-Math.min(1,r.mileMph/mx))-8);}}
function saltRedraw(){const l=lastForChart();if(S.env.testType==="salt"&&l&&l.salt)drawSaltTrace(l.salt);}
function saltVerdict(res){const r=res.salt,c=r.cls||{},R=r.rec;
  const mph=r.mileMph!=null?r.mileMph.toFixed(3):"—";
  if(res.saltFailed)return `<div class="verdict fail"><div><div class="big">${r.broke==="steam"?"BLEW THE HEAD GASKET":r.broke==="turbo"?"TURBO LET GO":r.broke==="piston"?"MELTED A PISTON":"BROKE ON THE SALT"}</div><p>${c.key||""} · ${r.mileMph!=null?"it made the clocks first: "+mph+" mph":"before the timed mile"}${career()?" — certification is void":""}.</p></div></div>`;
  if(r.stopWhy==="spun")return `<div class="verdict fail"><div><div class="big">SPUN AT ${Math.round(r.peakMph)} MPH</div><p>${c.key||""} · no time. ${career()?"$800 to straighten the body.":""}</p></div></div>`;
  const big=r.outcome==="record"?`NEW RECORD · ${r.avg.toFixed(3)}`:r.outcome==="impound"?`${mph} · IMPOUND`:r.dq?`${mph} · NOT ACCEPTED`:r.mileMph!=null?`${mph} MPH`:"NO TIME";
  const cls=r.outcome==="record"||r.outcome==="impound"?"pass":r.valid?"marg":"fail";
  const sub=r.outcome==="record"?`${c.key} · ${r.firstMph.toFixed(3)} and ${mph} average ${r.avg.toFixed(3)} — the old mark was ${R.mph.toFixed(3)} (${saltEsc(R.holder)}).${r.club?" Welcome to the 200 MPH Club.":""}${career()&&r.purse?" Contingency "+fmt$(r.purse)+".":""}`
    :r.outcome==="impound"?`${c.key} · over the ${R.mph.toFixed(3)} record. The car goes to impound — back it up on your next run this ${career()?"week":"meet"} and the average stands.`
    :r.outcome==="backupslow"?`${c.key} · backup run: ${r.firstMph.toFixed(3)} and ${mph} average ${r.avg.toFixed(3)} — short of the ${R.mph.toFixed(3)} record. It stands.`
    :r.outcome==="backupfail"?`${c.key} · no backup time — the record attempt is over.`
    :r.dq?"Over 175 mph without a parachute — tech won't accept the run."
    :`${c.key} · record ${R?R.mph.toFixed(3):"—"}${R?` (${R.mph>r.mileMph?"−"+(R.mph-r.mileMph).toFixed(2):"+"+(r.mileMph-R.mph).toFixed(2)} mph)`:""}${r.pb&&!r.pb.first?` · class best (was ${r.pb.was.toFixed(3)})`:""}`;
  return `<div class="verdict ${cls}"><div style="flex:1"><div class="big">${big}</div><p>${sub}</p>
    <div class="vstats"><div><b>${mph}</b><span>timed mile</span></div><div><b>${r.kmMph!=null?r.kmMph.toFixed(2):"—"}</b><span>timed km</span></div><div><b>${r.peakMph.toFixed(1)}</b><span>peak mph</span></div><div><b>${r.meetBest!=null?r.meetBest.toFixed(2):"—"}</b><span>best of meet</span></div><div><b>${r.coolMax}</b><span>peak water °C</span></div><div><b>${r.time.toFixed(0)}</b><span>seconds</span></div></div></div></div>`;}
function saltSheet(res){const r=res.salt,v=r.veh||{},c=r.cls||{};
  const why={done:"chute out, stopped",spun:"spun",broke:"broke",lifted:"lifted before the clocks",time:"flagged"}[r.stopWhy]||"stopped";
  const wi=wearInfo(res);const wear=wi?`<div><b>Wear</b>${wi.passes} of ${wi.budget} pass${wi.budget===1?"":"es"} · <span style="color:${wi.w>=1?"var(--crit)":wi.w>0.6?"var(--warn)":"var(--good)"}">${Math.round(wi.w*100)}%</span>${res.wornBy?" · down "+res.wornBy+"% on power":""}${wi.w>0?` <button class="btn sm" id="freshen" style="margin-left:8px">Freshen · ${fmt$(freshenCost(res))}</button>`:""}</div>`:"";
  return `<div class="sec"><h2>Time slip · ${saltEsc(c.key||"")}</h2><div class="log"><div><b>Mile</b>${r.mileMph!=null?r.mileMph.toFixed(3)+" mph · "+r.mileT.toFixed(3)+" s · in "+r.inMph+" out "+r.outMph+" mph":"no time"}</div>
    <div><b>Km</b>${r.kmMph!=null?r.kmMph.toFixed(3)+" mph · "+r.kmT.toFixed(3)+" s":"—"} · peak ${r.peakMph} mph · ${r.time.toFixed(1)} s · ${why}</div>
    <div><b>Setup</b>${r.clsName} · ${r.courseName} · ${v.topMph} mph top gear (${r.ratios.map(x=>x.toFixed(2)).join(" / ")}:1) · ${v.aero?"aero on":"clean"} · ${v.ballast} kg ballast · ${v.cooling==="ice"?"ice tank":"radiator"} · ${(SIM.LSR_CHUTES[v.chute]||{}).n||""} · ${r.mass} kg · CdA ${r.cdA}</div>
    <div><b>Car</b>front down to ${Math.round(r.lightMin*100)}% · ${r.spinT.toFixed(1)} s of wheelspin · ${r.shifts} shift${r.shifts===1?"":"s"}${r.limT>0?" · "+r.limT.toFixed(1)+" s on the limiter":""} · water ${r.coolMax} °C · EGT ${r.peakEgt} °C${r.chute.out?` · chute at ${r.chute.mph} mph${r.chute.blown?" (tore off)":""}`:""}</div>
    ${r.reasons.map(x=>`<div>${x}</div>`).join("")}${wear}</div></div>`;}
/* perf: a seeded class record costs a few hundred ms on a phone the first time (SIM caches it), and Analysis
   draws up to ten. They are worked out one per idle slot (never during a run): after boot for this build, and on
   demand when Analysis needs one it hasn't got, which then shows a placeholder line until they're in. */
const LSRW={done:new Set(),q:[],cbs:[],busy:false};
function lsrWarm(keys,cb){if(!keys){keys=[];try{keys=Object.keys(SIM.LSR_BODIES).map(b=>saltCls(b).key);}catch(e){return;}}
  for(const k of keys)if(!LSRW.done.has(k)&&!LSRW.q.includes(k))LSRW.q.push(k);if(cb)LSRW.cbs.push(cb);if(LSRW.busy)return;LSRW.busy=true;
  const ric=window.requestIdleCallback?f=>requestIdleCallback(f,{timeout:1500}):f=>setTimeout(f,60);
  const go=()=>{if(testing){setTimeout(()=>ric(go),2000);return;}const k=LSRW.q.shift();if(k!=null){try{SIM.lsrRecord(k);}catch(e){}LSRW.done.add(k);}
    if(LSRW.q.length){ric(go);return;}LSRW.busy=false;const cbs=LSRW.cbs.splice(0);cbs.forEach(f=>{try{f();}catch(e){}});};ric(go);}
/* records: the class records you have set or are chasing, and your best per class */
function saltRecHtml(){const L=saltBook();const keys=new Set(Object.keys(L.rec).concat(Object.keys(L.pb)));let cur=[];try{cur=Object.keys(SIM.LSR_BODIES).map(b=>saltCls(b).key);}catch(e){}cur.forEach(k=>keys.add(k));if(!keys.size)return"";
  const miss=[...keys].filter(k=>!LSRW.done.has(k));if(miss.length){lsrWarm(miss,()=>{if(curTab==="analysis")renderRecords();});return `<div class="rtop saltrec"><span>Salt flats · class records</span><div><span>working out the class records…</span></div></div>`;}
  const rows=[...keys].map(k=>{const r=saltRecord(k),pb=L.pb[k];return{k,r,pb};}).filter(o=>o.r).sort((a,b)=>(b.pb?1:0)-(a.pb?1:0)||(b.r.mph-a.r.mph)).slice(0,10);
  return `<div class="rtop saltrec"><span>Salt flats · class records</span>${rows.map(o=>`<div><b>${o.r.mine?"★":"·"}</b><span class="et">${o.r.mph.toFixed(2)}</span><span>${saltEsc(o.k)}</span><span class="nm" title="${saltEsc(o.r.holder)}">${o.r.mine?"you":saltEsc(o.r.holder)+" '"+String(o.r.year).slice(2)}</span><span>${o.pb?"PB "+o.pb.mph.toFixed(1):"—"}</span></div>`).join("")}</div>`;}
/* land-speed buyers: their car, your engine, the same salt — the mile they need, estimated with a steady driver */
const lsrFitCache=new Map();
function lsrFitMph(res,cfg,body){const key=cfgHash(cfg)+"|"+body;if(lsrFitCache.has(key))return lsrFitCache.get(key);
  const asp=(SIM.OPT.asp[cfg.asp]||{}).kind||"na",f=asp==="na"?0.87:0.92;const r=Object.assign({},res,{torque:res.torque.map(t=>t*f),peakHp:res.peakHp*f,peakTq:res.peakTq*f,saltEnv:{rho:1.0,ambientC:32}});
  const veh={body,redline:cfg.redline,course:"long",cooling:body==="streamliner"||body==="lakester"?"ice":"radiator",chute:"dual",aero:body==="altered"||body==="roadster",noFail:true,noSpin:true,h:0.005};
  const B=SIM.LSR_BODIES[body],m=B.mass+(r.kg||200),P=0.9*r.peakHp*745.7;let vb=20;for(let i=0;i<30;i++)vb=Math.pow(Math.max(1,P-0.015*m*9.81*vb)/(0.5*1.0*B.cdA),1/3);
  veh.topMph=Math.round(vb*2.23694*cfg.redline/Math.max(1,r.peakHpRpm||cfg.redline*0.85));
  const out=SIM.lsrPass(r,veh).mileMph||0;if(lsrFitCache.size>300)lsrFitCache.clear();lsrFitCache.set(key,out);return out;}

