/* ---- truck pull: the pull as it is run (app-late.js, since 1.76.141.0): start, the hold button and kill switch, live card, finish.
   The setup screen, nights, series, records and the verdict are in app/pull.js ---- */
function pullRunBtn(){if(testing)return;const b=$("runTest");if(PO)b.textContent="Hook up · PULL-OFF · sled +15%";else if(pullFmt()==="series"){const s=pullSerPeek(S.env.pullCls);b.textContent=b.textContent.replace("truck pull",`series round ${s.round+1} of ${PULL_SER_N}`);}}
function pullBtnText(t,sub){const b=$("pullBtn");const k=t+"|"+(sub||"");if(b.dataset.k===k)return;b.dataset.k=k;b.innerHTML=t+(sub?`<small style="display:block;font-size:12px;letter-spacing:.5px;opacity:.75;margin-top:2px">${sub}</small>`:"");}
function pullBreak(kind){PR.failed=true;PR.failKind=kind;if(kind==="driveline"&&PR.p&&PR.p.st&&PR.p.st.dtMsg)toast(PR.p.st.dtMsg.toUpperCase()+" · the engine is fine");run.fail=true;run.failKind=FAIL_VISUAL[kind]||(kind==="turbo"?"turbo":kind==="piston"?"knock":"rod");failFlash();}
function pullStart(){
  $("app").classList.add("onstrip");
  const k=pullEnvFix(),env=stdEnv(wxEnv("pull_sled"));const res=SIM.dragPrep(S.cfg,env);
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
  scrollCtlIntoView("pullCtl");
  const step=()=>{if(!PR||PR.finished)return;const now=performance.now();const dt=Math.min(0.25,(now-PR.last)/1000);PR.last=now;
    let st=p.st;
    if(!PR.auto)st=p.step(dt,PR.down&&!PR.failed?1:0);
    else if(st.phase==="stage"&&now<PR.goAt)st=p.step(dt,0);
    else{let left=dt;while(left>1e-9&&!st.done&&PR.auto){const h=Math.min(0.02,left);left-=h;if(PR.drv.kill(st))pullKill();st=p.step(h,PR.failed?0:PR.drv.foot(st));}   // the auto driver reads the truck every 20 ms
      if(left>1e-9&&!st.done)st=p.step(left,PR.down&&!PR.failed?1:0);}   // taken over part way through the frame
    if(st.broke&&!PR.failed)pullBreak(st.broke);
    if(st.raOn&&!PR.raSeen&&!st.killed&&!st.done&&!PR.failed){PR.raSeen=true;sfx("runaway");buzz([120,60,120,60,120]);
      pullHud(st,true);const pn=$("panel"),kb=$("killBtn").getBoundingClientRect(),pr=pn.getBoundingClientRect(),bot=Math.min(pr.bottom,tabsTop())-8;if(kb.bottom>bot||kb.top<pr.top)pn.scrollTop+=kb.bottom>bot?kb.bottom-bot:kb.top-pr.top-4;}   // the kill switch has to be under the thumb now
    if(st.done&&PR.doneAt==null){PR.doneAt=now;if(st.full&&!PR.failed){winFlash();buzz([30,40,30,40,90]);}else buzz([40]);}
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
  PR.killed=true;run.rpm=0;run.load=0;sfx("kill");buzz([90]);screenFlash("rgba(240,236,226,.3)",160);pullHud(st,true);return true;}
function pullRedraw(){const l=lastForChart();if(S.env.testType==="pull_sled"&&l&&l.pull)drawPullTrace(l.pull);}
function pullSkip(){if(!PR||PR.finished)return;if(ENGINE_VIS.pullSkip)ENGINE_VIS.pullSkip();PR.skip=true;}
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
  if(typeof crowdAfter==="function")crowdAfter("pull",{broke:failed,full:r.full&&!failed});   // app/ambience.js
  PR.p=null;pullSettle(r,ctx);
}
$("killBtn").addEventListener("pointerdown",e=>{e.preventDefault();pullKill();});
$("killBtn").addEventListener("click",()=>pullKill());
(()=>{const b=$("pullBtn");
  holdBtn(b,()=>PR,pullPress,pullRelease,r=>{if(!r.p)return;if(r.p.st.done||r.failed)pullSkip();});})();
