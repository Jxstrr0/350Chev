/* ---- oval: race night as it is run (app-late.js, since 1.76.142.0): the heat and feature field, the live card, the throttle, flags,
   Watch it, finish and the redraw. The setup screen, nights, the gate, records and the verdict are in app/oval.js ---- */
const ovalLabel=t=>(t||ovalTk())==="clay"?"Dirt oval":"Paved oval";
/* the order the flag comes out in: laps first, then the clock; the ones that broke last */
function ovalSortRows(rows){return rows.sort((a,b)=>(a.dnf?1:0)-(b.dnf?1:0)||b.laps-a.laps||(a.dnf?0:a.time-b.time)||(a.me?-1:b.me?1:0));}
/* the feature's field is eleven whole races: run them one at a time in the idle moments after the heat, so the green is not a pause */
function ovalWarm(k,n,tk){if(!n||!n.grid||n.stage!=="feature")return;const R=ovalRoster(k,n.seed),q=n.grid.map((id,g)=>[id,g]).filter(x=>x[0]!=="me");let i=0;
  const nx=()=>{if(i>=q.length||testing||n.stage!=="feature")return;const[id,g]=q[i++];try{ovalCarRun(R[id],k,n.seed,"feature",OVAL_FEAT,ovalGridOff(g),OVAL_HEAT,0.6,tk);}catch(e){}setTimeout(nx,50);};nx();}
/* the other heat: four rivals racing without us, to interleave with ours for the feature grid */
function ovalHeatB(k,seed,tk){const R=ovalRoster(k,seed),ids=ovalSplit(seed).b,g=ids.slice();const cars=g.map((id,gi)=>ovalCarRun(R[id],k,seed,"heatB",OVAL_HEAT,ovalGridOff(gi),0,0.9,tk));
  const win=Math.min(...cars.filter(c=>!c.dnf).map(c=>c.fin));return ovalSortRows(cars.map(c=>Object.assign({id:c.id},ovalCutAt(c,win,OVAL_HEAT)))).map(r=>r.id);}
function ovalSplit(seed){const r=pullRand((seed^0x5E17)>>>0),ids=[0,1,2,3,4,5,6,7,8,9,10];for(let i=ids.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}return{a:ids.slice(0,7),b:ids.slice(7)};}
function ovalHint(){const pv=ovalTT().surf==="asphalt",lb=ovalLabel();return career()?`<b>${lb}</b> · ${fmt$(ovalFee("street"))}–${fmt$(ovalFee("open"))} entry for the night: a ${OVAL_HEAT}-lap heat, then the ${OVAL_FEAT}-lap feature from the grid the heat sets. Needs a certified engine; one night a week, in one class, on either track. Opens at ${OVAL_REP} rep: ${SIM.OVAL_CLASSES.street.n} ${SIM.OVAL_CLASSES.street.rep}, ${SIM.OVAL_CLASSES.late.n} ${SIM.OVAL_CLASSES.late.rep}, ${SIM.OVAL_CLASSES.open.n} ${SIM.OVAL_CLASSES.open.rep}. Purses by finish, up to ${fmt$(OVAL_FPURSE[0]*OVAL_PAY[3])} in the feature. ${pv?"Heat and the long straights are the hard part: there is little dust, but the engine works flat out.":"Heat and radiator dust are the hard part: running in the car ahead's dirt clogs the grille."}`
  :`<b>${lb}</b> · a heat race, then the feature. It is one gear and a lot of throttle: hold <b>PUSH</b> to attack, <b>SAVE</b> to cool the engine and the tyres. <b>Space</b> pushes. Class by cubic inches.`;}
/* the dock button: the stage that is up, the price */
function ovalRunBtn(){if(S.env.testType!=="oval"||testing)return;const k=ovalEnvFix(),n=ovalNight(k),b=$("runTest");if(b.disabled)return;const cost=testCost();
  if(career()&&(n.stage==="done"||(n.stage==="heat"&&ovalOther(k)))){b.textContent=`Night over · next night wk ${C().week+1}`;$("dynoHint").innerHTML=ovalHint();return;}
  const txt=n.stage==="feature"?`Take the green · feature, from ${ordN(n.gridMe+1)}`:"Take the green · heat race";
  b.textContent=txt+(cost?" · "+fmt$(cost)+(fuelBill()>=50&&fuelBill()<cost?" (fuel "+fmt$(fuelBill())+")":""):"");$("dynoHint").innerHTML=ovalHint();}
/* ---- the live card ---- */
function ovalHudInit(){$("ovalLive").innerHTML=`<div class="rdh hlh"><div class="rd-spd"><b id="ovV">0</b><i>km/h</i></div><div class="rd-g"><b id="ovP">–</b><i id="ovPi">place</i></div><div class="rd-lt"><b id="ovLap">0/${OV.laps}</b><i>lap</i></div><div class="rd-lt"><b id="ovT">0:00.0</b><i id="ovTi">clock</i></div></div>
  <div class="ph-bar hl-bar"><i class="fill" id="ovF"></i><i class="mk lead" id="ovL" style="left:0"></i></div>
  <div class="ph-lbl" style="margin-top:4px"><span id="ovA">—</span><span id="ovB"></span></div>
  <div class="hl-next" id="ovN"></div><div class="hl-meters" id="ovM"></div>`;}
function ovalRanks(t){const me=OV.p.st,L=OV.L,out=[{me:true,key:ovalMeProg(),c:null,t:OV.meCut?OV.meCut.t:0}];
  OV.cars.forEach(c=>{const a=ovalAt(c,t);if(!a){out.push({key:-1e9+(c.dnf?c.dnf.lap:0),c,out:true,t:0});return;}out.push({key:c.cut&&t>=c.cut.t?c.cut.s+1e-3*(1-c.cut.t/1e4):a.s,c,s:a.s,v:a.v,t:c.cut?c.cut.t:0});});
  out.sort((x,y)=>y.key-x.key);return out;}
function ovalMeProg(){const st=OV.p.st;return OV.meCut?Math.min(st.s,OV.meCut.s)+1e-3*(1-OV.meCut.t/1e4):st.s;}
function ovalHud(rk){if(!OV||!$("ovV"))return;const st=OV.p.st,t=st.t,pos=rk.findIndex(r=>r.me)+1,N=OV.laps,L=OV.L;
  $("ovV").textContent=Math.round(st.v*3.6);$("ovP").textContent=pos||"–";$("ovPi").textContent=`of ${OV.cars.length+1}`;
  $("ovLap").textContent=`${Math.min(N,st.lap+1)}/${N}`;$("ovT").textContent=fmtOvRace(t);$("ovTi").textContent=OV.pre>0?"on the grid":st.done?(st.broke?"out":"flag"):OV.stageName;
  $("ovF").style.width=(100*Math.min(1,Math.max(0,st.s)/(N*L))).toFixed(2)+"%";
  const leader=rk[0];$("ovL").style.left=(100*Math.min(1,Math.max(0,leader.me?st.s:(leader.s||0))/(N*L))).toFixed(2)+"%";
  const ahead=pos>1?rk[pos-2]:null,behind=pos<rk.length?rk[pos]:null,vv=Math.max(8,st.v),gp=(a,b)=>Math.abs((a.me?st.s:a.s||0)-(b.me?st.s:b.s||0))/vv;
  $("ovA").innerHTML=ahead&&!ahead.out?`<b>#${ahead.c?ahead.c.num:"—"}</b> ${ahead.c?esc(ahead.c.n):""} <b style="color:var(--crit)">+${gp(rk[pos-1],ahead).toFixed(1)}s</b>`:`<b>leading</b>`;
  $("ovB").innerHTML=behind&&!behind.out?`<b>#${behind.c?behind.c.num:"—"}</b> <b style="color:var(--good)">−${gp(rk[pos-1],behind).toFixed(1)}s</b>`:"";
  const fd=OV.feed.slice(-2).map(x=>`<div class="hl-c">${x}</div>`).join("");
  let nx=st.broke?`<div class="hl-ev bad">${ovalFailWord(st.broke)}</div>`:st.done?`<div class="hl-ev good">CHEQUERED · ${ordN(pos)}</div>`:OV.pre>0?`<div class="hl-ev">GREEN IN ${Math.ceil(OV.pre)}…</div>`:fd||`<div class="hl-c dim">Green flag. ${OV.stage==="heat"?"Eight laps":"Twenty-five laps"} to go.</div>`;
  if($("ovN").dataset.k!==nx){$("ovN").dataset.k=nx;$("ovN").innerHTML=nx;}
  const cc=st.cool,wr=Math.round(100*Math.min(1.2,st.wear)),mode=OV.auto?"auto":OV.push?"push":OV.save?"save":"steady";
  $("ovM").innerHTML=`<div class="peak"><b style="color:${cc>112?"var(--crit)":cc>104?"var(--warn)":""}">${Math.round(cc)}<i>°C</i></b><span>water${st.derate<0.999?" · derate":""}${st.radPack>0.35?" · clogged":""}</span></div><div class="peak"><b style="color:${wr>80?"var(--crit)":wr>55?"var(--warn)":""}">${wr}<i>%</i></b><span>tyres worn</span></div><div class="peak"><b class="hl-mode ${mode==="push"?"push":mode==="save"?"lift":mode==="auto"?"auto":""}">${mode.toUpperCase()}</b><span>${OV.auto?"tap to take over":st.slideT>0?"SLIDING":"pace"}</span></div>`;
  ovalBtnText();}
function ovalBtnText(){const p=$("ovalPush"),l=$("ovalSave");if(!p||!OV||!OV.p)return;const st=OV.p.st,k=(OV.auto?"a":"m")+(st.done?"d":"")+(OV.push?"p":"")+(OV.save?"s":"");if(p.dataset.k===k)return;p.dataset.k=k;
  if(st.done){p.innerHTML=`${st.broke?"OUT":"FLAG"}<small>tap to skip</small>`;l.innerHTML=`—<small>&nbsp;</small>`;}
  else if(OV.auto){p.innerHTML=`AUTO DRIVER<small>tap to take over</small>`;l.innerHTML=`SAVE<small>take over</small>`;}
  else{p.innerHTML=`PUSH<small>${OV.push?"attacking":"hold to attack the corners"}</small>`;l.innerHTML=`SAVE<small>${OV.save?"easing it":"hold to cool the engine"}</small>`;}
  p.classList.toggle("on",!!OV.push);l.classList.toggle("on",!!OV.save);const s=$("ovalSpdB");if(s)s.textContent=OV.speed+"×";}
function ovalTakeOver(){if(!OV||!OV.auto||OV.p.st.done)return;OV.auto=false;OV.took=Math.round(OV.p.st.lap);buzz([20]);toast("You have it — hold PUSH to attack, SAVE to cool it");}
function ovalPress(which){if(!OV||OV.finished)return;const st=OV.p.st;if(st.done){ovalSkip();return;}
  if(OV.auto){ovalTakeOver();if(which==="save")OV.save=true;return;}
  if(which==="save"){OV.save=true;OV.push=false;}else{OV.push=true;OV.save=false;}buzz(6);ovalBtnText();}
function ovalRelease(which){if(!OV)return;if(which==="save")OV.save=false;else OV.push=false;ovalBtnText();}
/* ---- the race ---- */
function ovalStart(){
  const k=ovalEnvFix(),e=S.env,C0=SIM.OVAL_CLASSES[k],n=ovalNight(k),stage=n.stage==="feature"?"feature":"heat",env=stdEnv();
  let res;try{res=SIM.ovalPrep(S.cfg,env);}catch(err){testing=false;renderTest();toast("The engine wouldn't run");return;}
  const wi=wearInfo(res);if(wi&&wi.w>0){const f=1-0.05*Math.min(1,wi.w);res.torque=res.torque.map(t=>t*f);if(res.naTorque)res.naTorque=res.naTorque.map(t=>t*f);res.power=res.power.map(t=>t*f);res.peakTq*=f;res.peakHp*=f;res.wornBy=Math.round((1-f)*100);}
  $("app").classList.add("onstrip");
  const tk=ovalTk(),snap=testSnap(),hk=hKey(snap.h),roster=ovalRoster(k,n.seed),laps=stage==="heat"?OVAL_HEAT:OVAL_FEAT,L=SIM.ovalTrack(tk).len;let cars,gridMe,order;
  if(stage==="heat"){const sp=ovalSplit(n.seed),ids=sp.a.slice(),r=pullRand((n.seed^0x6A1D)>>>0);ids.push("me");for(let i=ids.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
    order=ids;gridMe=ids.indexOf("me");cars=[];ids.forEach((id,g)=>{if(id!=="me")cars.push(ovalCarRun(roster[id],k,n.seed,"heat",laps,ovalGridOff(g),0,0.9,tk));});}
  else{order=n.grid.slice();gridMe=order.indexOf("me");cars=[];order.forEach((id,g)=>{if(id!=="me")cars.push(ovalCarRun(roster[id],k,n.seed,"feature",laps,ovalGridOff(g),OVAL_HEAT,0.6,tk));});}
  cars.forEach(c=>{c.cut=null;});
  if(career()&&stage==="heat"){n.hash=hKey(cfgHash(S.cfg));}
  const winAi=Math.min(...cars.filter(c=>!c.dnf&&c.fin!=null).map(c=>c.fin));
  const veh={cls:k,track:tk,tyre:e.ovalTyre,grille:e.ovalGrille,finalK:+e.ovalFinal,redline:S.cfg.redline,idle:SIM.isDiesel&&SIM.isDiesel(S.cfg)?720:Math.max(750,S.cfg.cam>70?1100:850),seed:career()?(n.seed+7919*(C().ovalRuns=(C().ovalRuns||0)+1))>>>0:Math.floor(Math.random()*1e9),laps,off:ovalGridOff(gridMe),night:SIM.ovalNight(n.seed,tk),
    moist:stage==="heat"?0.9:0.6,lap0:stage==="heat"?0:OVAL_HEAT,skill:e.ovalDrive!=="you"?1:0.9};   // the auto driver has the sharpest hands; driving it yourself, yours are a good club racer's
  if(wi&&wi.w>=1)veh.wornAt=Math.max(2,Math.round(laps*(0.3+0.5*Math.random())));
  veh.gap=(s,t)=>{let g=Infinity;for(let i=0;i<cars.length;i++){const a=ovalAt(cars[i],t);if(!a)continue;const d=(((a.s-s)%L)+L)%L;if(d<g&&d>1.2)g=d;}return g;};
  const p=SIM.ovalNew(res,veh);
  let meNum=(parseInt(hk,36)%97)+2;while(roster.some(q=>q.num===meNum))meNum=meNum%98+1;
  OV={p,res,env,veh,k,tk,L,stage,stageName:stage==="heat"?"heat":"feature",snap,hk,night:n,laps,cars,order,gridMe,winT:winAi,flagged:false,cutDone:false,meCut:null,auto:e.ovalDrive!=="you",took:null,push:false,save:false,speed:+e.ovalSpd||4,cam:e.ovalCam||"auto",pre:3,last:performance.now(),finished:false,skip:false,doneAt:null,acc:0,feed:[],posLaps:[],lapSeen:0,meNum,color:carPaint(),roster};
  ENGINE_VIS.setAutoRotate(false);$("rpmbox").style.display="block";$("ovalCtl").style.display="";ovalHudInit();$("ovalPush").dataset.k="";
  $("testProg").classList.remove("done");sfx("start");
  scrollCtlIntoView("ovalCtl");
  let hudT=0;
  const step=()=>{if(!OV||OV.finished)return;const now=performance.now(),dt=Math.min(0.1,(now-OV.last)/1000);OV.last=now;const st=OV.p.st;
    if(OV.pre>0)OV.pre-=dt;
    else if(!st.done){OV.acc+=dt*OV.speed;let nn=0;while(OV.acc>=0.02&&!st.done&&nn++<800){OV.p.step(0.02,ovalCtl());OV.acc-=0.02;ovalWatch();}if(nn>=800)OV.acc=0;}
    if(st.done&&OV.doneAt==null){OV.doneAt=now;if(st.broke){failFlash(300);}else{winFlash();buzz([30,40,30,40,90]);}}
    const t=st.t,rk=ovalRanks(t),L2=OV.L,after=st.done?(now-OV.doneAt)/1000:0;
    const meS=st.done?(OV.meCut?OV.meCut.s+(st.broke?0:20)*after:st.s+(st.broke?0:20*after)):st.s;
    const carsV=[{me:true,s:meS,v:st.done?(st.broke?Math.max(0,st.v-8*after):20):st.v,color:OV.color,num:OV.meNum,n:engineName().slice(0,12),groove:1.6,slide:st.slideT>0?Math.min(1,st.slideT+0.2):0,thr:st.tf,brk:st.thr<0.02&&st.acc<-2?1:0,spin:Math.min(1,Math.max(0,st.spin-1))}];
    OV.cars.forEach(c=>{const a=OV.pre>0?{s:-ovalGridOff(OV.order.indexOf(c.id)),v:0}:ovalAt(c,t);carsV.push(a?{s:a.s,v:a.v,color:c.color,num:c.num,n:c.n,groove:c.groove,thr:0.6,brk:0}:{gone:true,s:0,v:0,color:c.color});});
    if(OV.pre>0){carsV[0].s=-OV.veh.off;carsV[0].v=0;}
    const top=rk.filter(r=>!r.out).slice(0,12).map(r=>r.me?{num:OV.meNum,n:"YOU",me:true}:{num:r.c.num,n:r.c.n.split(" ").pop()});
    if(ENGINE_VIS.setOval)ENGINE_VIS.setOval({on:true,track:SIM.ovalTrack(OV.tk),cars:carsV,pre:OV.pre>0,done:st.done&&after>0.4,flag:st.done?"checker":OV.pre>0?"yellow":st.lap>=OV.laps-1?"white":"green",cam:OV.cam,night:!!S.night,lastLap:st.lap>=OV.laps-1,toFlag:(OV.laps*L2-st.s)/Math.max(10,st.v),order:top,boardHead:OV.stage==="heat"?"HEAT RACE":"FEATURE",dt:dt*(OV.pre>0||st.done?1:OV.speed)});
    if((hudT+=dt)>0.1||st.done){hudT=0;ovalHud(rk);}
    run.on=true;run.rpm=st.done?run.rpm+(OV.veh.idle-run.rpm)*Math.min(1,dt*3):OV.pre>0?OV.veh.idle+900*Math.max(0,Math.sin(now/200)):st.rpm;run.load=st.done?0:Math.max(0.05,st.tf);$("rpmLbl").textContent=Math.round(run.rpm/10)*10;
    $("testProg").style.width=Math.min(100,100*Math.max(0,st.s)/(OV.laps*L2))+"%";
    if(st.done&&(OV.skip||now-OV.doneAt>(st.broke?2600:3400)))ovalFinish();else requestAnimationFrame(step);};
  requestAnimationFrame(step);
}
/* what the flag, the line and the pit board do each step */
function ovalFlag(Tw){OV.cars.forEach(c=>ovalCutAt(c,Tw,OV.laps));OV.winT=Tw;OV.cutDone=true;}
function ovalWatch(){const st=OV.p.st,L=OV.L;
  if(!OV.cutDone&&!st.done&&isFinite(OV.winT)&&st.t>=OV.winT){OV.flagged=true;ovalFlag(OV.winT);}
  if(st.lap>OV.lapSeen){OV.lapSeen=st.lap;const rk=ovalRanks(st.t),pos=rk.findIndex(r=>r.me)+1,prev=OV.posLaps.length?OV.posLaps[OV.posLaps.length-1]:OV.gridMe+1;OV.posLaps.push(pos);
    const lt=st.laps[st.laps.length-1],best=Math.min.apply(null,st.laps),ah=pos>1?rk[pos-2]:null,gp=ah&&!ah.out?Math.abs(st.s-(ah.s||st.s))/Math.max(8,st.v):null;
    OV.feed.push(`<b>L${st.lap}</b> · <b>P${pos}</b>${pos<prev?` <span style="color:var(--good)">▲${prev-pos}</span>`:pos>prev?` <span style="color:var(--crit)">▼${pos-prev}</span>`:""} · ${lt.toFixed(2)}${lt<=best+1e-6?" <b style=\"color:var(--good)\">best</b>":""}${gp!=null?` · +${gp.toFixed(1)} s to P${pos-1}`:""}`);if(OV.feed.length>8)OV.feed.shift();
    if(OV.flagged&&!st.done){st.done=true;st.finish=st.t;st.stopWhy="flag";}}
  if(st.done&&!st.broke&&!OV.meCut)OV.meCut={t:st.t,s:st.lap*L};
  if(st.done&&!OV.cutDone)ovalFlag(st.broke?OV.winT:Math.min(OV.winT,st.t));}
function ovalSkip(){if(!OV||OV.finished)return;const p=OV.p,st=p.st;OV.pre=0;if(!OV.auto&&OV.took==null&&st.lap>0)OV.handed=st.lap;let n=0;while(!st.done&&n++<200000){p.step(0.04,OV.auto?null:ovalCtl());ovalWatch();}OV.skip=true;if(OV.doneAt==null)OV.doneAt=performance.now()-4000;}
(()=>{const bind=(id,w)=>{const b=$(id);
  holdBtn(b,()=>OV,()=>ovalPress(w),()=>ovalRelease(w),()=>{ovalPress(w);setTimeout(()=>ovalRelease(w),400);});};
  bind("ovalPush","push");bind("ovalSave","save");
  $("ovalSkip").addEventListener("click",()=>ovalSkip());
  $("ovalSpdB").addEventListener("click",()=>{if(!OV)return;OV.speed=OV.speed>=8?1:OV.speed*2;S.env.ovalSpd=OV.speed;ovalBtnText();$("ovalSpdB").textContent=OV.speed+"×";save();});
  $("ovalCamB").addEventListener("click",()=>{const ids=OVAL_CAMS.map(c=>c[0]),cur=OV?OV.cam:S.env.ovalCam,nx=ids[(ids.indexOf(cur)+1)%ids.length];S.env.ovalCam=nx;if(OV)OV.cam=nx;$("ovalCamB").textContent="Cam · "+OVAL_CAMS.find(c=>c[0]===nx)[1];save();});
  document.addEventListener("keydown",e=>{if(e.defaultPrevented||!OV||OV.finished||$("ovalCtl").style.display==="none"||typingIn(e.target)||e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.key===" "||e.key==="Spacebar"){e.preventDefault();if(!e.repeat&&!OV.spaceHeld){OV.spaceHeld=true;OV.lastPtr=performance.now();ovalPress("push");}}});
  document.addEventListener("keyup",e=>{if(!OV||!OV.spaceHeld)return;if(e.key===" "||e.key==="Spacebar"){OV.spaceHeld=false;ovalRelease("push");}});})();
/* ---- the flag: classification, money, records ---- */
function ovalFinish(){
  if(!OV||OV.finished)return;OV.finished=true;const {p,res,env,k,tk,stage,snap,hk,night:n,laps:N}=OV,TT=SIM.ovalTrack(tk),C0=SIM.OVAL_CLASSES[k],same=testSame(snap),st=p.st,r=p.result(),failed=!!st.broke;
  setTimeout(()=>{if(!testing){if(ENGINE_VIS.setOval)ENGINE_VIS.setOval({on:false});$("app").classList.remove("onstrip");}},OV.skip?300:1800);
  testing=false;run.on=false;run.rpm=0;$("rpmbox").style.display="none";$("ovalCtl").style.display="none";$("testProg").classList.add("done");setTimeout(()=>{$("testProg").style.width="0";},700);ENGINE_VIS.setAutoRotate(null);
  const meLaps=st.lap,meT=failed?null:st.t;
  const win=Math.min(...OV.cars.filter(c=>!c.dnf&&c.fin!=null).map(c=>c.fin),(!failed&&meLaps>=N)?st.t:Infinity);
  const rows=OV.cars.map(c=>{const q=ovalCutAt(c,win,N);return{n:c.n,num:c.num,hp:c.hp,id:c.id,laps:q.laps,time:q.time,dnf:q.dnf,best:c.best};});
  const me={n:engineName().slice(0,26),num:OV.meNum,me:true,id:"me",laps:meLaps,time:meT,dnf:failed,best:isFinite(st.bestLap)?st.bestLap:null};
  rows.push(me);ovalSortRows(rows);const place=rows.indexOf(me)+1;
  Object.assign(r,{stage,cls:k,clsName:C0.n,tier:C0.tier,place,of:rows.length,field:rows,N,lapsDone:meLaps,auto:OV.auto&&OV.took==null,took:OV.took,gridMe:OV.gridMe+1,posLaps:OV.posLaps.slice(),finished:!failed,tyreName:SIM.OVAL_TYRES[env.ovalTyre]?SIM.OVAL_TYRES[env.ovalTyre].n:"",track:tk,trackName:TT.n,surf:TT.surf,night:SIM.ovalNight(n.seed,tk).name,ci:Math.round(SIM.ovalCi(res)),final:+(OV.veh.finalK||1).toFixed(2),muStart:+(SIM.ovalNight(n.seed,tk).mu).toFixed(2),dnfLap:failed?meLaps+1:null});
  r.time=meT;r.best=me.best;
  if(typeof crowdAfter==="function")crowdAfter("oval",{broke:failed,won:place===1&&!failed});   // app/ambience.js
  const pl=ordN(place)+" of "+rows.length,sc=failed?`DNF · lap ${meLaps+1}`:`${ordN(place)}`;
  // money, rep, wear
  if(same&&career()){addWear((stage==="heat"?0.4:0.9)+(r.coolPeak>112?0.4:0),hk);
    if(failed){C().cert=null;C().rep=Math.max(0,C().rep-(stage==="feature"?2:1));logEvent(`${ovalLabel(tk)} ${stage}: ${C0.n} — ${r.broke==="head_lift"?"cooked it":"engine failed"} on lap ${meLaps+1}`,"bad");toast(`OUT · ${ovalFailWord(r.broke)}`);}
    else{const tab=stage==="heat"?OVAL_HPURSE:OVAL_FPURSE,purse=Math.round((tab[place-1]||0)*(OVAL_PAY[C0.tier]||1)/10)*10,rep=stage==="heat"?(place===1?1:0):((OVAL_FREP[place-1]||0)+1);r.purse=purse;r.rep=rep;C().cash+=purse;C().rep+=rep;
      logEvent(`${ovalLabel(tk)} ${stage}: ${C0.n} — ${ordN(place)} of ${rows.length}${purse?", purse "+fmt$(purse):""}`,place<=3?"good":"");toast(`${stage==="heat"?"Heat":"Feature"} · ${ordN(place)}${purse?" · "+fmt$(purse):""}`);}
    spEvent("oval",{win:!failed&&stage==="feature"&&place===1,finish:!failed&&stage==="feature"&&place>1&&place<=3,heat:stage==="heat"});hud();checkGoals();}
  else toast(failed?`OUT · ${ovalFailWord(r.broke)}`:`${stage==="heat"?"Heat":"Feature"} · ${pl}`);
  // the night moves on
    if(stage==="heat"){n.heat={place,of:rows.length,dnf:failed,time:meT,best:r.best,purse:r.purse||0};
    const bIds=ovalHeatB(k,n.seed,tk),aIds=rows.map(q=>q.id),g=[];
    for(let i=0;i<Math.max(aIds.length,bIds.length);i++){if(i<aIds.length)g.push(aIds[i]);if(i<bIds.length)g.push(bIds[i]);}
    n.grid=g;n.gridMe=g.indexOf("me");n.stage="feature";n.hash=hKey(cfgHash(S.cfg));r.nextGrid=n.gridMe+1;
    if(!failed)setTimeout(()=>toast(`Heat ${ordN(place)} — feature starts ${ordN(n.gridMe+1)}`),2800);
    setTimeout(()=>ovalWarm(k,n,tk),1500);}
  else{n.feat={place,of:rows.length,dnf:failed,time:meT,best:r.best,purse:r.purse||0};n.stage="done";}
  // records: best lap per class, best finish, feature wins
  if(same&&!ff&&!failed){const RR=ovalRecs(tk),was=RR[k]||{};const nw=Object.assign({},was);
    if(r.best&&(!was.lap||r.best<was.lap)){nw.lap=+r.best.toFixed(3);r.pb={lap:was.lap||null};if(was.lap)setTimeout(()=>toast(`CLASS BEST LAP · ${r.best.toFixed(2)} s (was ${was.lap.toFixed(2)})`),2700);}
    if(stage==="feature"){nw.best=Math.min(was.best||99,place);if(place===1)nw.wins=(was.wins||0)+1;nw.feats=(was.feats||0)+1;}
    RR[k]=Object.assign(nw,recTag());}
  res.oval=r;res.ovalFailed=failed;res.ovalFailKind=failed?r.broke:null;S.last={hash:snap.h,cfg:snap.cfg,env,res};
  achCheck({type:"oval",r,failed});
  if(stage==="feature"&&!career())delete OVAL_SB[ovalBK(k,tk)];
  OV.p=null;save();recompute();renderTest();
  revealVerdict();
}
function ovalRedraw(){const l=lastForChart();if(S.env.testType==="oval"&&l&&l.oval)drawOvalChart(l.oval);}
