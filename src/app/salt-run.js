/* ---- Bitterwater: the run itself (app-late.js, since 1.76.141.0): start, push, shift and chute, time warp, live card, finish. Meets, records and the setup screen are in app/salt.js ---- */
const SALT_COLORS={altered:0x2c6b3a,roadster:0xb7261d,lakester:0xd9a52b,streamliner:0x1d4787};
/* the car's number for this meet: drawn when you sign in, the same for every run of the meet */
function saltNum(meet){let h=2166136261;const s="lsrnum|"+meet.id+"|"+(career()?C().name||"":"sandbox");for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}h>>>=0;return h%10<3?String(10+(h>>>4)%90):String(100+(h>>>4)%900);}
function saltBtnText(t,sub){const b=$("saltBtn");const k=t+"|"+(sub||"");if(b.dataset.k===k)return;b.dataset.k=k;b.innerHTML=t+(sub?`<small style="display:block;font-size:12px;letter-spacing:.5px;opacity:.75;margin-top:2px">${sub}</small>`:"");}
function saltBreak(kind){if(kind==="driveline"){if(!SR.dl){SR.dl=true;sfx("fail");buzz([80,40,120]);toast("DRIVELINE LET GO · the engine is fine");}return;}   // a swap car's gearbox or axle
  SR.failed=true;SR.failKind=kind;run.fail=true;run.failKind=FAIL_VISUAL[kind]||(kind==="turbo"?"turbo":kind==="piston"?"knock":kind==="steam"?"steam":"rod");failFlash();}
function saltStart(){
  $("app").classList.add("onstrip");
  const k=saltEnvFix(),env=stdEnv(),base=saltRes();
  const res=Object.assign({},base);const wi=wearInfo(res);
  if(wi&&wi.w>0){const f=1-0.05*Math.min(1,wi.w);res.torque=base.torque.map(t=>t*f);res.peakTq=base.peakTq*f;res.peakHp=base.peakHp*f;res.wornBy=Math.round((1-f)*100);}
  const snap=testSnap(),veh=saltVeh(k),hk=hKey(snap.h);veh.seed=Math.floor(Math.random()*1e9);if(wi&&wi.w>=1)veh.wornAt=8+Math.random()*30;
  const p=SIM.lsrRun(res,veh),cls=SIM.lsrClass(S.cfg,res,k),meet=saltMeet();
  if(ENGINE_VIS.saltLook)ENGINE_VIS.saltLook({color:carPaint(),num:saltNum(meet),cls:cls.key,cfg:S.cfg});   /* your paint, this meet's number, the class plate, the engine you see */
  if(meet.imp&&(meet.imp.key!==cls.key||meet.imp.hk!==hk)){toast("Left impound — that record attempt is void");meet.imp=null;}
  const backup=!!meet.imp;
  SR={p,res,env,veh,k,hk,snap,cls,rec:saltRecord(cls.key),backup,last:performance.now(),down:false,failed:false,failKind:null,doneAt:null,lastPtr:0,warp:1,auto:S.env.saltDrive==="auto",foot:SIM.lsrFoot(),color:SALT_COLORS[k]};
  ENGINE_VIS.setAutoRotate(false);$("rpmbox").style.display="block";$("saltCtl").style.display="";$("saltBtn").dataset.k="";$("saltBtn").disabled=false;
  $("saltShiftBtn").style.display=!SR.auto&&veh.shift==="manual"?"":"none";saltWarpUi();
  saltBtnText(SR.auto?"START THE PUSH":"HOLD TO RUN",SR.auto?"the driver takes it from here":"push off · hold for throttle, let go to feather");
  $("testProg").classList.remove("done");sfx("start");saltHud(p.st);
  scrollCtlIntoView("saltCtl");
  const course={x0:p.x0,x1:p.x1,k0:p.k0,k1:p.k1,xEnd:p.xEnd};
  const step=()=>{if(!SR||SR.finished)return;const now=performance.now();const rdt=Math.min(0.25,(now-SR.last)/1000);SR.last=now;const st=p.st;
    const wp=st.phase==="run"||st.phase==="shutdown"?SR.warp:1;let left=rdt*wp;
    while(left>1e-6&&!st.done){const d=Math.min(0.02,left);left-=d;p.step(d,saltThr(st,d));}
    if(st.broke&&!SR.failed)saltBreak(st.broke);
    if((st.chuteOut||st.drogueOut)&&!SR.chuteFx){SR.chuteFx=true;if(typeof foley==="function")foley("chute");}
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
/* the driver's foot: yours (the button), or the auto driver (SIM.lsrFoot) holding the tyres on their best slip and minding a light nose */
function saltThr(st,dt){if(!SR.auto)return SR.down&&!SR.failed?1:0;if(st.phase==="stage")return SR.go?1:0;return SR.foot(st,dt);}
function saltWarpUi(){document.querySelectorAll("#saltWarp [data-warp]").forEach(b=>b.classList.toggle("on",+b.dataset.warp===(SR?SR.warp:1)));}
/* the live card: speed first, then the course with the timed mile on it, then what the driver is managing */
function saltHud(st,force){if(!SR||!hudDue(SR,st,force))return;const p=SR.p,mph=st.v*2.23694,mi=st.x/SIM.LSR_MILE,xe=p.xEnd,pc=x=>Math.min(100,100*x/xe);
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
  if(!st.done){p.autoShift();const f=SR.auto?SR.foot:SIM.lsrFoot();let n=0;while(!st.done&&n++<20000)p.step(0.02,f(st,0.02));
    if(st.broke&&!SR.failed)saltBreak(st.broke);}
  if(ENGINE_VIS.saltSkip)ENGINE_VIS.saltSkip();SR.skip=true;if(SR.doneAt==null)SR.doneAt=performance.now()-2000;}
(()=>{const b=$("saltBtn");
  holdBtn(b,()=>SR,saltPress,saltRelease,r=>{if(!r.p)return;saltPress();setTimeout(saltRelease,60);});
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
  if(typeof crowdAfter==="function")crowdAfter("salt",{broke:failed,record:outcome==="record"});   // app/ambience.js
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
    C().cash+=cash;C().rep=Math.max(0,C().rep+rep);r.cash=cash;r.repD=rep;spEvent("salt",{record:outcome==="record",k:cls.key,mph:valid?r.mileMph:null});hud();checkGoals();}
  toast(outcome==="record"?`NEW RECORD · ${r.avg.toFixed(3)} MPH`:outcome==="impound"?`${mphTxt} · OVER THE RECORD — IMPOUND`:failed?"BROKE ON THE SALT":r.stopWhy==="spun"?"SPUN ON THE SALT":dq?`${mphTxt} · NOT ACCEPTED — NO CHUTE`:`${mphTxt}`);
  achCheck({type:"salt",r,failed});   // salt badges (timed mile, 200 and 300 mph, a class record); the trophy room books the record
  SR.p=null;save();recompute();renderTest();
  revealVerdict();
}
function saltRedraw(){const l=lastForChart();if(S.env.testType==="salt"&&l&&l.salt)drawSaltTrace(l.salt);}
