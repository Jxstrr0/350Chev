/* ---- Cloudsplitter Peak: the climb as it is run (app-late.js, since 1.76.141.0): live card with corner calls, PUSH/LIFT, start, finish.
   Classes, the field, the splits sheet, the chart and records are in app/hill.js ---- */
const HILL_C={lift:0.962,steady:1.0,push:1.035};
/* the live card */
function hillHudInit(){$("hillLive").innerHTML=`<div class="rdh hlh"><div class="rd-spd"><b id="hlV">0</b><i>km/h</i></div><div class="rd-g"><b id="hlG">–</b><i>gear</i></div><div class="rd-lt"><b id="hlT">0:00.00</b><i id="hlTi">clock</i></div><div class="rd-lt"><b id="hlA">2,862</b><i>metres</i></div></div>
  <div class="ph-bar hl-bar"><i class="fill" id="hlF"></i>${SIM.hillCourse().sections.slice(0,-1).map(s=>`<i class="mk" style="left:${(100*s.s1/SIM.hillCourse().len).toFixed(2)}%"></i>`).join("")}<i class="mk lead" id="hlL" style="left:0"></i></div>
  <div class="ph-lbl" style="margin-top:4px"><span id="hlSec">Engineer's</span><span id="hlD"></span></div>
  <div class="hl-next" id="hlN"></div><div class="hl-meters" id="hlM"></div>`;}
function hillLeadS(t){const L=HC.lead;if(!L||!L.splits||!L.splits.length)return null;const T=SIM.hillCourse(),S0=T.sections;let pt=0;
  for(let i=0;i<L.splits.length;i++){const st=L.splits[i];if(t<=st){const f=(t-pt)/Math.max(0.01,st-pt);return S0[i].s0+(S0[i].s1-S0[i].s0)*f;}pt=st;}return T.len;}
function hillCornerTxt(c,call){const dir=c.deg>0?"left":"right",kind=c.hp?"hairpin":c.R<40?"tight":c.R<110?"":"fast",cl=call&&call.call;
  return `<b>${c.name?esc(c.name):kind?kind[0].toUpperCase()+kind.slice(1)+" "+dir:dir[0].toUpperCase()+dir.slice(1)}</b><span>${c.name?(kind?kind+" ":"")+dir+" · ":""}R ${Math.round(c.R)} m${c.drop?c.rail?" · drop, railed":` · <em class="dr">DROP · no rail</em>`:""}</span><i class="call ${cl}">${cl==="dusty"?"DUSTY — lift":cl==="grippy"?"GRIPPY — push":"clean"}</i>`;}
function hillHud(){if(!HC)return;const st=HC.run.st,T=HC.run.T,v=$("hlV");if(!v)return;
  v.textContent=Math.round(st.v*3.6);$("hlG").textContent=st.off?"–":st.g+1;$("hlT").textContent=fmtHill(st.t);$("hlA").textContent=Math.round(st.alt).toLocaleString("en-CA");
  $("hlTi").textContent=HC.pre>0?"on the line":st.done?(st.dnf?"DNF":"summit"):"clock";
  $("hlF").style.width=(100*st.s/T.len).toFixed(2)+"%";const ls=hillLeadS(st.t);if(ls!=null)$("hlL").style.left=(100*Math.min(1,ls/T.len)).toFixed(2)+"%";
  const sec=T.sections[Math.min(T.sections.length-1,st.sec)];$("hlSec").innerHTML=`<b>${esc(sec.n)}</b> · ${(st.s/1000).toFixed(2)} km`;
  const L=HC.lead,ns=st.splits.length;let gap="";if(L&&L.splits&&ns&&L.splits[ns-1]!=null){const d=st.splits[ns-1]-L.splits[ns-1];gap=`split ${ns} <b style="color:${d<=0?"var(--good)":"var(--crit)"}">${d<=0?"−":"+"}${Math.abs(d).toFixed(2)}</b> vs ${esc(L.n)}`;}
  $("hlD").innerHTML=gap;
  // the next two corners and their calls; the event of the moment over them
  const K=T.corners,c0=K[Math.min(K.length-1,st.k)],c1=K[Math.min(K.length-1,st.k+1)],ev=st.ev&&st.t-st.ev.t<2.5?st.ev:null;
  let nx="";if(st.dnf)nx=`<div class="hl-ev bad">${hillDnfWord(st.dnf.kind)} · ${esc(st.dnf.name)}</div>`;
  else if(st.off)nx=`<div class="hl-ev bad">${st.off.kind==="rail"?"INTO THE GUARDRAIL":st.off.kind==="bank"?"INTO THE BANK":"OFF · GRAVEL"} · +${st.off.T.toFixed(1)} s</div>`;
  else if(ev&&ev.kind==="moment")nx=`<div class="hl-ev warn">MOMENT! · ${esc(K[ev.k].name||"held it")}</div>`;
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
  const seed=hillSeed(k),field=wxField(hillWithRv(k,hillField(k,seed,true)),k),calls=SIM.hillCalls(seed);if(career())(C().hillWk=C().hillWk||{})[k]=C().week;
  const rs=career()?(seed+7919*(C().hillRuns=(C().hillRuns||0)+1))>>>0:Math.floor(Math.random()*1e9);
  const run=SIM.hillNew(prep,Object.assign({seed:rs,calls,plan:SIM.hillPlan(calls,1,rs)},opt));
  const lead=field.filter(f=>f.t!=null).sort(hillCmp)[0]||null;
  HC={suVis:SIM.setupVis(opt.setup),run,prep,opt,k,snap,env,seed,field,lead,auto:S.env.hillDrive!=="you",took:null,speed:+S.env.hillSpd||4,cam:S.env.hillCam||"auto",push:false,lift:false,pre:2.5,last:performance.now(),finished:false,skip:false,doneAt:null,lastPtr:0,acc:0,color:carPaint()};
  ENGINE_VIS.setAutoRotate(false);$("rpmbox").style.display="block";$("hillCtl").style.display="";hillHudInit();$("hillPush").dataset.k="";hillHud();
  $("testProg").classList.remove("done");sfx("start");
  scrollCtlIntoView("hillCtl");
  let hudT=0;
  const step=()=>{if(!HC||HC.finished)return;const now=performance.now(),dt=Math.min(0.1,(now-HC.last)/1000);HC.last=now;const st=HC.run.st;
    if(HC.pre>0)HC.pre-=dt;else if(!st.done){HC.acc+=dt*HC.speed;let n=0;while(HC.acc>=0.02&&!st.done&&n++<800){HC.run.step(0.02,hillCtl());HC.acc-=0.02;}if(n>=800)HC.acc=0;}
    if(st.done&&HC.doneAt==null){HC.doneAt=now;if(st.dnf){failFlash(300);}else{winFlash();buzz([30,40,30,40,90]);}}
    if(st.ev&&st.ev!==HC.lastEv){HC.lastEv=st.ev;if(st.ev.kind!=="moment"){buzz([60,30,60]);sfx("mudslap");if(st.ev.kind!=="rail"&&typeof foley==="function")foley("gravel");}else buzz([25]);}
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
  holdBtn(b,()=>HC,()=>hillPress(w),()=>hillRelease(w),()=>{hillPress(w);setTimeout(()=>hillRelease(w),400);});};
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
  if(typeof crowdAfter==="function")crowdAfter("hill",{broke:!!r.dnf,edge:!!(r.dnf&&r.dnf.kind==="edge")});   // app/ambience.js
  r.suBal=+SIM.hillCar(prep,opt).bi.toFixed(2);if(!r.dnf)suTipHill(r,prep,opt);
  if(same&&!r.dnf&&!ff){const RR=recBucket("hill"),was=RR[k];if(!was||r.time<was.t){RR[k]=Object.assign({t:r.time,splits:r.splits.slice(),ch:opt.ch},recTag());r.pb=was?{was:was.t}:{first:true};if(was)setTimeout(()=>toast(`CLASS RECORD · ${fmtHill(r.time)} (was ${fmtHill(was.t)})`),2700);}}
  r.wx=wxSnap("hill");const res=Object.assign({},prep.refRes,{hill:r});S.last={hash:snap.h,cfg:snap.cfg,env,res};
  const pl=ordN(r.place)+" of "+r.of,sc=r.dnf?(r.dnf.kind==="edge"?"over the edge at "+r.dnf.name:r.dnf.kind==="boil"?"boiled over in "+r.dnf.name:r.dnf.kind==="stall"?"couldn't climb the grade":"flagged off in "+r.dnf.name):fmtHill(r.time);
  if(career()&&same){addWear(0.6+(r.coolPeak>112?0.4:0)+(r.dmg>0?0.3:0),hKey(snap.h));
    if(r.dnf){C().rep=Math.max(0,C().rep-(r.dnf.kind==="edge"?2:1));logEvent(`Cloudsplitter Peak: ${C0.n} — DNF, ${sc}`,"bad");toast(`DNF · ${sc}`);}
    else{const purse=Math.round((HILL_PURSE[r.place-1]||0)*(HILL_PAY[C0.tier]||1)/10)*10,rep=(HILL_REP[r.place-1]||0)+1;r.purse=purse;r.rep=rep;C().cash+=purse;C().rep+=rep;
      logEvent(`Cloudsplitter Peak: ${C0.n} — ${sc}, ${pl}${purse?", purse "+fmt$(purse):""}`,r.place<=3?"good":"");toast(`${sc} · ${ordN(r.place)}${purse?" · "+fmt$(purse):""}`);}
    spEvent("hill",{win:!r.dnf&&r.place===1,finish:!r.dnf&&r.place>1&&r.place<=3,record:!!(r.pb&&r.pb.was),k,t:r.dnf?null:r.time});hud();checkGoals();}
  else toast(r.dnf?`DNF · ${sc}`:`${sc} · ${pl}`);
  if(!career())delete HILL_SB[Object.keys(SIM.HILL_CLASSES).indexOf(k)+1];   // a fresh mountain next run
  achCheck({type:"hill",r});
  HC.run=null;HC.prep=null;save();recompute();renderTest();revealVerdict();
}
function hillRedraw(){const l=lastForChart();if(S.env.testType==="hill"&&l&&l.hill)drawHillChart(l.hill);}
