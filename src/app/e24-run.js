/* ---- 24 Hours: the race as it is run (app-late.js, since 1.76.142.0): the strategy taps, the start, the accelerated clock, camera,
   live card, map, race feed, the pit wall and finish. The setup screen, the gate, the career marker, records and the verdict are in app/e24.js ---- */
/* strategy clicks: env before, plan during */
document.addEventListener("click",e=>{const b=e.target.closest("[data-e24k]");if(!b)return;const k=b.dataset.e24k,raw=b.dataset.e24v;
  const v=k==="e24Stint"?+raw:k==="e24SC"?raw==="true":raw;
  if(k==="e24Trk"&&ER)return;
  S.env[k]=v;e24EnvFix();
  if(ER&&!ER.finished){const pl=ER.R.plan,me=ER.R.cars[0],key={e24Mode:"mode",e24Stint:"stint",e24Fuel:"fuel",e24Tyre:"tyre",e24Chg:"chg"}[k];
    if(k==="e24Drive"){pl.auto=v==="auto";if(pl.auto)ER.took=null;else if(ER.took==null)ER.took=ER.R.t;toast(pl.auto?"The crew chief has the pit wall":"You have the pit wall");}
    else if(key&&pl.auto){pl.auto=false;ER.took=ER.R.t;toast("You have the pit wall");}   // a tap on the strategy takes over, as at the other events
    if(key){pl[key]=v;if(key==="mode"&&!me.out)me.mode=v;}e24StratRender();e24Hud();}
  else if(S.env.testType==="race24")renderEnv();
  save();buzz(6);});
/* ---- the live race ---- */
let e24Snap=null;   // the build, mode and career the flag dropped on (testSnap)
function e24Click(){const gate=e24Gate();if(gate){toast(gate);return;}
  const res=SIM.simulate(S.cfg,stdEnv({testType:"pull"}));if(res.fails.length){toast(`Scrutineering says no — ${String(res.fails[0]).toLowerCase()} on the dyno`);return;}
  testing=true;e24Snap=testSnap();abStop();renderTest();ensureSound();
  ENGINE_VIS.setStrip({on:false});ENGINE_VIS.stripRace&&ENGINE_VIS.stripRace(null);if(ENGINE_VIS.setPull)ENGINE_VIS.setPull({on:false});if(ENGINE_VIS.setSalt)ENGINE_VIS.setSalt({on:false});if(ENGINE_VIS.setBog)ENGINE_VIS.setBog({on:false});if(ENGINE_VIS.setBoat)ENGINE_VIS.setBoat({on:false});   // a leftover strip/sled/salt scene
  if(!E24W.done[S.env.e24Trk])toast("Scrutineering the field…");
  e24Warm(S.env.e24Trk,e24Go);}
function e24Go(){if(!testing||ER)return;const e=e24EnvFix(),trk=e.e24Trk,opt=roadOpt();let P;
  const snap=e24Snap||testSnap();e24Snap=null;
  try{P=e24Prep(trk,snap.cfg);}catch(err){testing=false;renderTest();toast("The car would not pass scrutineering");return;}
  const seed=career()?rnHash([C().seed,C().week,"e24",trk].join(":")):rnHash(Date.now()+":"+Math.random());
  const R=SIM.enduroNew({track:trk,me:P,seed,sc:e.e24SC,number:55,name:"Prairie Engine Works",plan:{mode:e.e24Mode,stint:+e.e24Stint,fuel:e.e24Fuel,tyre:e.e24Tyre,chg:e.e24Chg,scPit:true,auto:e.e24Drive==="auto"}});
  if(career()&&crewPitK()!==1)R.pitK=crewPitK();   // fast hands on the crew: quicker stops (app/crew.js)
  const rv=rivE24Car(R);   // a rival's head-to-head: their car in your class
  if(career()){if(!dev())C().cash-=E24_FEE;const g=e24C();g.next=C().week+E24_GAP;g.live={w:C().week,trk,ch:opt.ch};logEvent(`24 Hours of Prairie Sky: entered in ${roadCarTxt(opt)} at ${e24TrkName(trk)} — ${dev()?"free (dev)":fmt$(E24_FEE)+" entry"}`);hud();save();}
  ER={R,P,opt,trk,snap,T:SIM.roadTrack(trk),L:P.lap,speed:+e.e24Spd,cam:e.e24Cam,last:performance.now(),lastVis:0,lastHud:0,feedN:0,jump:false,toEnd:0,finished:false,field:null,flash:0,pits:0,rv,chief:e.e24Drive==="auto",took:null,sg:""};
  renderEnv();$("app").classList.add("onstrip");ENGINE_VIS.setAutoRotate(false);$("e24Ctl").style.display="";$("e24Side").style.display="";e24HudInit();e24StratRender();e24FeedRender();e24Hud();
  $("testProg").classList.remove("done");sfx("start");buzz([20,30,20]);toast(`GREEN FLAG · ${e24TrkName(trk).toUpperCase()}`);
  requestAnimationFrame(()=>{const pn=$("panel"),r=$("e24Ctl").getBoundingClientRect(),pr=pn.getBoundingClientRect();if(!deskOn()&&(r.top<pr.top||r.top>pr.top+pr.height*0.5))pn.scrollTo({top:pn.scrollTop+r.top-pr.top-6,behavior:calmScroll()});});
  ER.last=performance.now();requestAnimationFrame(e24Frame);}
function e24Frame(now){if(!ER||ER.finished)return;const R=ER.R,me=R.cars[0];
  const dt=Math.min(0.1,Math.max(0,(now-ER.last)/1000));ER.last=now;const t0=performance.now();
  if(ER.toEnd&&now>=ER.toEnd){while(performance.now()-t0<11&&!R.done)SIM.enduroStep(R,R.dur+14400,300);}
  else if(ER.jump){const n0=R.stopN||0;while(performance.now()-t0<9&&!R.done){SIM.enduroStep(R,R.dur+14400,150,true);if((R.stopN||0)>n0){ER.jump=false;e24SpdRender();break;}}}
  else if(!ER.toEnd){const target=R.t+dt*ER.speed;while(performance.now()-t0<9&&!R.done&&R.t<target){if(!SIM.enduroStep(R,target,150))break;}}
  if((me.out||me.fin)&&!ER.toEnd){ER.toEnd=now+(me.out?1800:900);ER.jump=false;if(me.out&&me.dnf&&me.dnf.id){failFlash();}e24SpdRender();e24StratRender();}
  if(R.done){e24Hud();e24FeedRender();e24Finish();return;}
  if(now-ER.lastHud>150){ER.lastHud=now;e24Hud();const pl=R.plan,sg=pl.auto?pl.mode+pl.tyre+pl.chg:"";if(sg!==ER.sg){ER.sg=sg;if(sg)e24StratRender();}}   // the crew chief changed the plan: show it
  if(me.pits!==ER.pits){ER.pits=me.pits;e24StratRender();}   // a stop clears "box this lap" and starts a stint
  const lf=R.feed[R.feed.length-1];if(lf&&lf.n!==ER.feedN)e24FeedRender();
  const visMs=ER.speed>=600||ER.jump||ER.toEnd?110:ER.speed>=60?70:0;
  if(now-ER.lastVis>=visMs*0.9){e24Vis(Math.min(0.1,(now-(ER.lastVis||now))/1000)||dt);ER.lastVis=now;}
  $("testProg").style.width=Math.min(100,100*R.t/R.dur)+"%";
  requestAnimationFrame(e24Frame);}
function e24CamMode(){return ER.cam==="auto"?(ER.speed>1||ER.jump||ER.toEnd?"tower":"auto"):ER.cam;}
/* the 3D: the player's car from the race lap's trace, the field as instanced cars, the sky from the race clock */
function e24Vis(dt){if(!ENGINE_VIS.setRoad)return;const R=ER.R,t=R.t,W=SIM.enduroWhere(R,t),L=ER.L,sky=SIM.e24Sky(t),me=R.cars[0],w0=W[0];
  const inPit=!!(w0.pit||w0.out||w0.fin);let f={s:0,v:0,g:1,rpm:900,thr:0,brk:0,ax:0,ay:0};
  if(!inPit){f=roadAt(L,w0.f*L.time);f.v*=L.time/Math.max(1,me.lapDur);}
  if(!ER.field)ER.field=R.cars.slice(1).map((c,k)=>({cls:Math.max(0,SIM.E24_CLS_ORDER.indexOf(c.cls)),k,s:0,d:0,pit:false,slot:k+1,hide:false}));
  for(let k=1;k<R.cars.length;k++){const o=ER.field[k-1],w=W[k];o.hide=!!w.out;o.pit=!!(w.pit||w.fin);if(!o.pit&&!o.hide){o.s=roadAt(L,w.f*L.time).s;o.d=[-2.7,2.7,-1.3,1.3][k%4];}}
  const fast=ER.speed>1||ER.jump||ER.toEnd;
  ENGINE_VIS.setRoad({on:true,track:ER.T,s:f.s,v:fast?0:f.v,g:f.g,rpm:f.rpm,thr:f.thr,brk:fast?0:f.brk,ax:fast?0:f.ax,ay:fast?0:f.ay,slip:0,ch:ER.opt.ch,night:sky.n>0.45,sky:sky.n,warm:sky.warm,dawn:sky.h<12,cam:e24CamMode(),pre:false,dt:fast?0.05:dt,pit:inPit,field:ER.field,minMs:fast?((S.gfx||(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)?"lite":"full"))==="lite"?140:110):0});
  const live=!fast&&!inPit&&!me.out;run.on=live;run.rpm=live?f.rpm:0;run.load=live?Math.max(0.05,f.thr):0;$("rpmbox").style.display=live?"block":"none";if(live)$("rpmLbl").textContent=Math.round(f.rpm/10)*10;}
/* HUD: clock, positions, gaps, laps, fuel, tyres, temps, the hazard gauge, a live map */
function e24HudInit(){$("e24Hud").innerHTML=`<div class="e24h"><div class="e24c"><b id="e24Clk">14:00</b><i id="e24El">race 0:00</i></div><div class="e24p"><b id="e24P">P–</b><i id="e24Pc">—</i></div>
  <div class="e24gp"><span>ahead <b id="e24Ga">—</b></span><span>behind <b id="e24Gb">—</b></span></div><canvas id="e24Map" class="e24map" aria-label="Track map"></canvas></div>
  <div class="ph-bar e24prog"><i class="fill" id="e24Pr"></i><i class="mk" style="left:33.3%"></i><i class="mk" style="left:66.6%"></i></div><div id="e24Sc" class="e24sc" hidden>SAFETY CAR</div>
  <div class="e24g"><div><span>Laps</span><b id="e24Lp">0</b><i id="e24Lt">—</i></div>
  <div><span>Fuel</span><b id="e24Fu">—</b><i id="e24Fl">—</i><div class="ph-bar"><i class="fill" id="e24Fb"></i></div></div>
  <div><span>Tyres</span><b id="e24Ty">—</b><i id="e24Tl">—</i><div class="ph-bar"><i class="fill" id="e24Tb"></i></div></div>
  <div><span>Engine</span><b id="e24En">—</b><i id="e24Et">—</i></div>
  <div class="e24hz"><span data-s="Risk">Failure risk</span><b id="e24Hz">—</b><i id="e24Hw">—</i><div class="ph-bar"><i class="fill" id="e24Hb"></i></div></div>
  <div><span>Track</span><b id="e24Am">—</b><i id="e24Sk">—</i></div></div>`;e24SpdRender();}
function e24SpdRender(){const b=$("e24Spd");if(!b||!ER)return;const R=ER.R,me=R.cars[0],end=me.out||me.fin;
  b.innerHTML=end?`<button class="btn pri" data-e24a="end" style="flex:1">${ER.toEnd?"Running the race to the flag…":"Skip to flag ▸▸"}</button>`
    :E24_SPEEDS.map(s=>`<button class="btn ${!ER.jump&&ER.speed===s?"on":""}" data-e24s="${s}">${s===1?"1×":s+"×"}</button>`).join("")+`<button class="btn pri e24nx${ER.jump?" on":""}" data-e24a="next">${ER.jump?"Running…":"Next event ▸▸"}</button><button class="btn e24cam" data-e24a="cam">Cam · ${E24_CAMS.find(c=>c[0]===ER.cam)[1]}</button>`;}
function e24StratRender(){const el=$("e24Side");if(!el||!ER)return;const R=ER.R,me=R.cars[0],end=me.out||me.fin;
  el.innerHTML=`<div class="sec e24strat"><h2>Strategy <span class="cnt">${end?"race over":`stint ${me.stints.length} · ${me.drv[me.drvI%3]}`}</span></h2>${end?`<p class="hint">${me.out?(me.dnf&&me.dnf.id?"Out of the race. The rest of the field runs to the flag.":"Retired. The rest of the field runs to the flag."):"Chequered flag. The field is finishing its last laps."}</p>`:e24StratHtml(true,ER.P)+`<div class="row e24act"><button class="btn${R.plan.box?" on":""}" data-e24a="box">${R.plan.box?"Boxing this lap":"Box this lap"}</button><button class="btn" data-e24a="swap">Box · swap driver</button><button class="btn danger" data-e24a="retire">Retire</button></div>`}</div>
    <div class="sec e24feedsec"><h2>Race feed <span class="cnt" id="e24FeedCnt"></span></h2><div class="e24feed" id="e24Feed"></div></div>`;e24FeedRender(true);}
const E24_FEEDK={chief:"pit",pit:"pit",pass:"pass",fail:"warn",inc:"warn",dnf:"crit",ai:"aif",sc:"sc",sky:"sky",hour:"hour",start:"sky",flag:"sky"};
function e24FeedRender(force){const el=$("e24Feed");if(!el||!ER)return;const F=ER.R.feed,lf=F[F.length-1];if(!force&&lf&&lf.n===ER.feedN)return;ER.feedN=lf?lf.n:0;
  el.innerHTML=F.slice(-40).reverse().map(f=>`<div class="e24f ${E24_FEEDK[f.k]||""}${f.me?" me":""}"><time>${SIM.e24Clock(f.t)}</time><span>${esc(f.txt)}</span></div>`).join("");const c=$("e24FeedCnt");if(c)c.textContent=F.length+" events";}
document.addEventListener("click",e=>{const s=e.target.closest("[data-e24s]"),a=e.target.closest("[data-e24a]");if(!ER||ER.finished||(!s&&!a))return;
  if(s){ER.speed=+s.dataset.e24s;ER.jump=false;S.env.e24Spd=ER.speed;e24SpdRender();save();buzz(6);return;}
  const k=a.dataset.e24a,R=ER.R;
  if(k==="next"){ER.jump=!ER.jump;e24SpdRender();}
  else if(k==="cam"){const ids=E24_CAMS.map(c=>c[0]);ER.cam=ids[(ids.indexOf(ER.cam)+1)%ids.length];S.env.e24Cam=ER.cam;e24SpdRender();save();}
  else if(k==="box"){R.plan.box=!R.plan.box;R.plan.swap=false;e24StratRender();}
  else if(k==="swap"){R.plan.box=true;R.plan.swap=true;e24StratRender();toast("Driver change at the next stop");}
  else if(k==="retire"){if(!confirm("Retire the car? The engine comes home in one piece, but there is no prize money."))return;const me=R.cars[0];if(me.out||me.fin)return;me.out=true;me.tNext=Infinity;me.dnf={t:R.t,id:null,name:"Retired by the team",h:R.t/3600};
    R.feed.push({t:R.t,k:"dnf",txt:`Retired by the team after ${me.laps} laps`,me:true,n:++R.seq});e24StratRender();}
  else if(k==="end"){ER.toEnd=performance.now();e24SpdRender();}
  buzz(6);});
/* ---- the flag: classification, money, records, wear ---- */
function e24Finish(){if(!ER||ER.finished)return;ER.finished=true;const R=ER.R,me=R.cars[0],P=ER.P,trk=ER.trk,opt=ER.opt,snap=ER.snap,same=!snap||testSame(snap),cfg0=snap?snap.cfg:S.cfg;
  const all=SIM.enduroResult(R),mine=all.find(x=>x.me),cls=me.cls,inCls=all.filter(x=>x.cls===cls),hrs=Math.min(24,(me.dnf?me.dnf.t:R.dur)/3600);
  const dec=[],LL=me.lapLog,step=Math.max(1,Math.ceil(LL.length/360));for(let i=0;i<LL.length;i+=step)dec.push(LL[i]);
  const stints=me.stints.filter(s=>s.laps>0).map(s=>{const mt=s.modeT,mm=Object.keys(mt).sort((a,b)=>mt[b]-mt[a])[0];return{drv:s.drv,c:s.c,laps:s.laps,fuel:Math.round(s.fuel),t0:Math.round(s.t0),t1:Math.round(s.t1!=null?s.t1:me.tLast),mode:mm};});
  const lapsGreen=LL.filter(l=>!l[2]).map(l=>l[1]),avg=lapsGreen.length?lapsGreen.reduce((a,b)=>a+b,0)/lapsGreen.length:null;
  const r={trk,trkName:e24TrkName(trk),len:Math.round(R.len),ch:opt.ch,chName:(opt.car||SIM.CHASSIS[opt.ch]).n,swap:opt.sw?swapTag():undefined,cls,clsName:e24Cls(cls),pos:mine.pos,posCls:mine.posCls,of:all.length,ofCls:inCls.length,laps:me.laps,km:mine.km,
    classified:!!mine.classified,dnf:me.dnf?{h:+me.dnf.h.toFixed(1),id:me.dnf.id,name:me.dnf.name}:null,best:me.best,bestLap:me.bestLap,avg,pits:me.pits,pitT:Math.round(me.pitT),fuel:Math.round(me.fuelUsed),
    stints,trace:dec,sc:R.scN,field:all.map(x=>({no:x.no,team:x.team,cls:x.cls,eng:x.eng,laps:x.laps,best:x.best!=null?+x.best.toFixed(2):null,out:x.out,dnf:x.dnf,me:x.me,cl:x.classified,pc:x.posCls})),
    clsBest:Math.min(...inCls.filter(x=>x.best!=null).map(x=>x.best)),win:inCls[0]?inCls[0].laps:0,hrs:+hrs.toFixed(1)};
  if(ER.chief||R.plan.auto)r.chief=R.plan.auto?(ER.chief&&ER.took==null?"all":"end"):Math.round(ER.took||0);   // who had the pit wall: the crew chief all race, at the flag, or until this second
  if(typeof crowdAfter==="function")crowdAfter("e24",{won:r.classified&&r.posCls===1,classified:r.classified});   // app/ambience.js
  /* career money and standing */
  if(career()&&!ff&&same){const g=e24C();g.live=null;g.runs=(g.runs||0)+1;const K=SIM.E24_CLASSES[cls],fu=SIM.fuelOf(cfg0)||SIM.OPT.fuel.r91;
    const prize=r.classified?(K.prize[r.posCls-1]||0)+3000:0,fuelBill=Math.round(me.fuelUsed*(fu.costL||1.5)*0.35)/* series fuel, at the trade price */;let rep=r.classified?(K.rep[r.posCls-1]||6)+(r.pos===1?10:0):0;
    if(r.dnf&&r.dnf.id&&r.dnf.id!=="swap_driveline"){C().cert=null;rep-=2;}   // a swap gearbox is not the engine
    C().cash+=prize-fuelBill;C().rep=Math.max(0,C().rep+rep);r.prize=prize;r.fuelBill=fuelBill;r.rep=rep;
    addWear(+(hrs/40*({push:1.6,race:1.25,save:0.95}[stints.length?stints[stints.length-1].mode:"race"]||1.25)).toFixed(2),snap?hKey(snap.h):undefined);
    logEvent(`24 Hours of Prairie Sky: ${r.dnf?(r.dnf.id?"out after "+r.dnf.h+" h — "+r.dnf.name.toLowerCase():"retired after "+r.dnf.h+" h"):r.classified?`${ordN(r.posCls)} in ${r.clsName}, ${ordN(r.pos)} overall`:"not classified"} — ${r.laps} laps${prize?", "+fmt$(prize)+" prize":""}, fuel ${fmt$(fuelBill)}${rep?", "+(rep>0?"+":"")+rep+" rep":""}`,r.classified&&r.posCls<=3?"good":r.dnf&&r.dnf.id?"bad":"");
    const rx=ER.rv&&all.find(x=>x.i===ER.rv.i),cp=x=>x.classified?ordN(x.posCls)+" in class":"not classified";
    spEvent("endurance",Object.assign({finish:r.classified&&r.posCls<=3,win:r.classified&&r.posCls===1},rx?{ahead:all.indexOf(mine)<all.indexOf(rx),rvTxt:`you ${cp(mine)}, ${ER.rv.n} ${cp(rx)}`}:{}));hud();checkGoals();}
  /* records: the longest distance per car and circuit */
  if(!ff&&same){const E=recBucket("e24"),k=roadKey(opt.rk||opt.ch,trk),was=E[k];if(!was||r.km>was.km){E[k]=Object.assign({km:r.km,laps:r.laps,pc:r.classified?r.posCls:null,cls,ch:opt.ch,trk},opt.sw?{sw:opt.sw}:{},recTag());r.pb=was?{was:was.km}:{first:true};}
    const RR=recs();RR.e24Runs=(RR.e24Runs||0)+1;if(r.classified&&!(RR.e24Best<=r.posCls))RR.e24Best=r.posCls;
    achCheck({type:"e24",r});if(r.swap)swapAfter(r);}
  const env=Object.assign(stdEnv(),{testType:"race24"});const res=Object.assign({},P.res,{e24:r});
  S.last=snap?{hash:snap.h,cfg:snap.cfg,env,res}:{hash:cfgHash(S.cfg),cfg:Object.assign({},S.cfg),env,res};
  testing=false;run.on=false;run.rpm=0;$("rpmbox").style.display="none";$("e24Ctl").style.display="none";$("e24Side").style.display="none";$("e24Side").innerHTML="";$("testProg").classList.add("done");setTimeout(()=>{$("testProg").style.width="0";},700);ENGINE_VIS.setAutoRotate(null);
  setTimeout(()=>{if(!testing){if(ENGINE_VIS.setRoad)ENGINE_VIS.setRoad({on:false});$("app").classList.remove("onstrip");}},1400);
  toast(r.dnf?(r.dnf.id?`OUT · ${r.dnf.name.toUpperCase()}`:"RETIRED"):r.classified?`${ordN(r.posCls).toUpperCase()} IN ${r.clsName.toUpperCase()} · ${r.laps} LAPS`:`NOT CLASSIFIED · ${r.laps} LAPS`);
  ER=null;save();recompute();renderTest();revealVerdict();}
