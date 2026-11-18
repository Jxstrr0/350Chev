/* ---- mud bog: the run itself (app-late.js, since 1.76.141.0): start, the hold button, live card, finish. The setup screen, nights, records and the verdict are in app/bog.js ---- */
function bogBtnText(t,sub){const b=$("bogBtn");const k=t+"|"+(sub||"");if(b.dataset.k===k)return;b.dataset.k=k;b.innerHTML=t+(sub?`<small style="display:block;font-size:12px;letter-spacing:.5px;opacity:.75;margin-top:2px">${sub}</small>`:"");}
function bogBreak(kind){BR.failed=true;BR.failKind=kind;run.fail=true;run.failKind=FAIL_VISUAL[kind]||(kind==="turbo"?"turbo":kind==="piston"?"knock":"rod");failFlash();}
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
  scrollCtlIntoView("bogCtl");
  const step=()=>{if(!BR||BR.finished)return;const now=performance.now();const dt=Math.min(0.25,(now-BR.last)/1000);BR.last=now;const st=p.st;
    let left=dt;while(left>1e-6&&!st.done){const d=Math.min(0.02,left);left-=d;p.step(d,bogThr(st));}
    if(st.broke&&!BR.failed)bogBreak(st.broke);
    if(st.done&&BR.doneAt==null){BR.doneAt=now;if(st.cleared&&!BR.failed){winFlash();buzz([30,40,30,40,90]);}else buzz([40]);}
    // mud slaps: the pit entry, a ridge, a rut, a landing — and the wheels throwing it while they spin
    let slap=0;if(st.phase==="pit"&&BR.ph!=="pit")slap=1;if(st.hzHit.length>BR.hz){BR.hz=st.hzHit.length;slap=Math.max(slap,0.8);}if(st.slaps>BR.slaps){BR.slaps=st.slaps;slap=Math.max(slap,0.9);}
    if(slap&&typeof foley==="function")foley("mud",{gain:0.6+0.4*slap});   // the recording on the big moments, rate-limited in app/foley.js
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
function bogThr(st){if(!BR.auto)return BR.down&&!BR.failed?1:0;if(st.phase==="stage")return BR.go?1:0;return BR.failed?0:BR.p.auto(1);}
/* the live card: distance (or the clock once through), the pit with the field on it, then the two things the foot manages — wheel speed and rpm */
function bogHud(st,force){if(!BR||!hudDue(BR,st,force))return;const L=BR.night.len,x=Math.max(0,st.x),pc=v=>Math.min(100,100*v/L);
  const stat=BR.failed?"broke":st.cleared?"full":"";
  const say=BR.failed?"BROKE":st.cleared?"THROUGH!":st.done?({stalled:"stalled",highcentre:"high-centred",dug:"dug in",bogged:"bogged down",packed:"packed up",lifted:"lifted"}[st.stopWhy]||"stuck"):st.phase==="stage"?"at the line":st.phase==="runup"?`${Math.round(-st.x)} m to the mud`:Math.round(st.v*2.237)+" mph";
  const pitT=st.tPit!=null?(st.cleared?st.tOut:st.t)-st.tPit:0,big=st.cleared?`${pitT.toFixed(2)}<i>s</i>`:`${x.toFixed(1)}<i>m</i>`;
  const marks=BR.field.map(f=>`<i class="mk${f===BR.lead?" lead":""}" style="left:${Math.min(99.5,pc(f.cleared?L:f.m))}%"></i>`).join("");
  const sw=st.sweet,sp=Math.round(st.slip*100),dg=Math.round(BR.p.digS*100),band=st.bogBand,rl=BR.veh.redline,rpmP=Math.min(100,Math.round(100*st.rpm/(rl*1.05))),bandP=Math.round(100*band[1]/(rl*1.05));
  const d=st.phase==="pit"?st.depth:0,lead=BR.lead;
  $("bogLive").innerHTML=`<div class="ph"><div class="ph-top ${stat}"><b>${big}</b><span>${say}${st.phase==="pit"&&!st.done?"<br>"+pitT.toFixed(1)+" s in the mud":""}</span></div>
    <div class="ph-bar"><i class="fill" style="width:${pc(x)}%"></i>${marks}</div><div class="ph-lbl"><span>0</span><span>leader <b>${lead?bogScore(lead):"—"}</b></span><span>${L} m</span></div>
    <div class="ph-lbl"><span>Mud <b>${esc(BR.night.name)}</b></span><span>${st.phase==="pit"?`depth <b>${Math.round(d*100)} cm</b>`:`${SIM.BOG_CLASSES[BR.k].n}`}</span></div></div>
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
  if(!st.done){let n=0;while(!st.done&&n++<20000)p.step(0.02,BR.auto?p.auto(1):BR.down?1:p.auto(1));if(st.broke&&!BR.failed)bogBreak(st.broke);}
  if(ENGINE_VIS.bogSkip)ENGINE_VIS.bogSkip();BR.skip=true;if(BR.doneAt==null)BR.doneAt=performance.now()-2000;}
function bogFinish(){
  if(!BR||BR.finished)return;BR.finished=true;const {p,res,env,k,snap,hk}=BR;const r=p.result();const failed=BR.failed,C0=SIM.BOG_CLASSES[k];const same=testSame(snap);
  setTimeout(()=>{if(!testing){if(ENGINE_VIS.setBog)ENGINE_VIS.setBog({on:false});$("app").classList.remove("onstrip");}},2200);
  testing=false;run.on=false;run.fail=false;run.rpm=0;$("rpmbox").style.display="none";$("bogCtl").style.display="none";$("testProg").classList.add("done");setTimeout(()=>{$("testProg").style.width="0";},700);ENGINE_VIS.setAutoRotate(null);
  const me={n:engineName().slice(0,26),me:true,cleared:r.cleared&&!failed,t:r.pitT,m:r.distM,broke:failed};
  const rows=BR.field.map(f=>Object.assign({},f)).concat([me]).sort(bogCmp);
  r.field=rows;r.place=rows.indexOf(me)+1;r.of=rows.length;r.clsName=C0.n;r.tier=C0.tier;r.auto=BR.auto;r.cleared=me.cleared;
  if(failed){r.broke=r.broke||BR.failKind;r.failKind=r.failKind||BR.failKind;}
  if(same)bogPb(r,failed);
  if(typeof crowdAfter==="function")crowdAfter("bog",{broke:failed,cleared:r.cleared});   // app/ambience.js
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
function bogPb(r,failed){if(ff||failed)return;const P=recBucket("bog"),was=P[r.cls];
  const better=!was||(r.cleared&&(!was.c||r.pitT<was.t))||(!r.cleared&&!was.c&&r.distM>was.m);if(!better)return;
  P[r.cls]=Object.assign({c:!!r.cleared,t:r.cleared?r.pitT:null,m:r.distM,len:r.len},recTag());
  if(was){r.pb={was:was.c?was.t.toFixed(2)+" s":was.m.toFixed(1)+" m"};setTimeout(()=>toast(`CLASS BEST · ${r.cleared?r.pitT.toFixed(2)+" s":r.distM.toFixed(1)+" m"} (was ${r.pb.was})`),2700);}}
function bogRedraw(){const l=lastForChart();if(S.env.testType==="bog"&&l&&l.bog)drawBogTrace(l.bog);}
(()=>{const b=$("bogBtn");
  holdBtn(b,()=>BR,bogPress,bogRelease,r=>{if(!r.p)return;bogPress();setTimeout(bogRelease,60);});})();
