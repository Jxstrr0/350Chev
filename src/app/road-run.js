/* ---- road test: the lap as it is run (app-late.js, since 1.76.142.0): the live map and card, the ghost, finish, the setup tip worked
   out after a run, and the redraw. The setup screen, setup sheet, saved setups, records and the verdict are in app/road.js ---- */
/* ---- setup tip after a run: nudge one slider at a time, re-run the lap (Cloudsplitter Peak: the climb, a few a tick in the background),
   and name the single change that gains most. r.tip = {i,d,v,gain} or {none:true}; "Use it" on the sheet loads v into the sliders. ---- */
const SU_TRY=[[1,25],[1,-25],[5,25],[5,-25],[2,25],[2,-25],[4,-3],[4,3],[6,-20],[0,20],[0,-20],[3,-15],[3,15],[6,20]],SU_TRY_HILL=9;
function suTipCands(su,n){const b=SU_F.map(f=>su&&su[f[4]]!=null?su[f[4]]:f[1]);
  return SU_TRY.slice(0,n||SU_TRY.length).map(([i,d])=>{const v=b.slice();v[i]=Math.min(SU_F[i][3],Math.max(SU_F[i][2],v[i]+d));return v[i]===b[i]?null:{i,d,v};}).filter(Boolean);}
const suTipBest=(L,min)=>{let w=null;for(const c of L)if(c.gain>=min&&(!w||c.gain>w.gain))w=c;return w?{i:w.i,d:w.d,v:w.v,gain:+w.gain.toFixed(2)}:{none:true};};
function suTipRoad(prep,opt,trk,t0){try{const L=suTipCands(opt.setup);for(const c of L)c.gain=t0-SIM.lapSim(prep,Object.assign({},opt,{setup:suOf(c.v)}),trk).time;return suTipBest(L,0.03);}catch(e){return null;}}
function suTipHill(r,prep,opt){const L=suTipCands(opt.setup,SU_TRY_HILL),pass=o=>SIM.hillPass(prep,Object.assign({},opt,{seed:5},o)).time;let t0=null,k=0;
  const step=()=>{try{if(t0==null)t0=pass({});else{const c=L[k++],t=pass({setup:suOf(c.v)});c.gain=t0!=null&&t!=null?t0-t:-1;}}catch(e){r.tip=null;return;}
    if(t0==null){r.tip=null;return;}if(k<L.length){setTimeout(step,30);return;}r.tip=suTipBest(L,0.2);const box=$("suTipBox");if(box)box.outerHTML=suTipHtml(r,true);};
  r.tip=undefined;setTimeout(step,2200);}
function roadMapDraw(cv,T,s,gs){if(!cv)return;const B=cvBox(cv),dpr=Math.min(devicePixelRatio||1,2),W=B.W,H=B.H;if(cv.width!==Math.round(W*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);}
  const x=cv.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);const sc=Math.min((W-12)/T.size[0],(H-12)/T.size[1]),P=i=>[W/2+T.x[i]*sc,H/2-T.y[i]*sc];
  const ink=B.ink;x.lineJoin="round";x.strokeStyle=ink;x.globalAlpha=.22;x.lineWidth=5;x.beginPath();for(let i=0;i<T.N;i+=2){const p=P(i);i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]);}x.closePath();x.stroke();
  x.globalAlpha=.75;x.lineWidth=1.6;x.stroke();x.globalAlpha=1;
  const p0=P(0),h0=T.h[0];x.strokeStyle="#d97757";x.lineWidth=2;x.beginPath();x.moveTo(p0[0]-Math.sin(h0)*6,p0[1]-Math.cos(h0)*6);x.lineTo(p0[0]+Math.sin(h0)*6,p0[1]+Math.cos(h0)*6);x.stroke();
  if(gs!=null){const i=Math.floor(((gs/T.ds)%T.N+T.N)%T.N),p=P(i);x.fillStyle="#9fd3ff";x.globalAlpha=.8;x.beginPath();x.arc(p[0],p[1],3.5,0,7);x.fill();x.globalAlpha=1;}
  if(s!=null){const i=Math.floor(((s/T.ds)%T.N+T.N)%T.N),p=P(i);x.fillStyle="#d97757";x.beginPath();x.arc(p[0],p[1],4,0,7);x.fill();x.strokeStyle="#141413";x.lineWidth=1.2;x.stroke();}}
function roadHudInit(){const L=$("roadLive");L.innerHTML=`<div class="rdh"><div class="rd-spd"><b id="rdV">0</b><i>km/h</i></div><div class="rd-g"><b id="rdG">–</b><i>gear</i></div><div class="rd-lt"><b id="rdT">0:00.0</b><i id="rdTi">lap</i></div><canvas id="rdMap" class="rd-map"></canvas></div>
  <div class="ph-bar rd-rpm"><i class="fill" id="rdR"></i><i class="mk" style="left:${Math.round(100*(RT.redline*0.9)/(RT.redline*1.04))}%"></i></div><div class="ph-lbl" style="margin-top:4px"><span id="rdRpm">0 rpm</span><span id="rdPd"></span></div>
  <div class="rd-sec" id="rdS"></div>`;}
function roadHud(f){if(!RT)return;const v=$("rdV");if(!v)return;
  v.textContent=Math.round(f.v*3.6);$("rdG").textContent=f.g||"–";$("rdT").textContent=fmtLap(Math.max(0,f.lapT));$("rdTi").textContent=f.pre?"flying start":f.done?"lap":"lap time";
  $("rdR").style.width=Math.min(100,100*f.rpm/(RT.redline*1.04))+"%";$("rdR").style.background=f.rpm>RT.redline*0.97?"linear-gradient(90deg,rgba(238,90,94,.4),rgba(238,90,94,.9))":"";
  $("rdRpm").textContent=`${(Math.round(f.rpm/10)*10).toLocaleString("en-CA")} rpm${RT.boostT>0?` · ${bv(f.bst)} ${pU()}`:""}`;$("rdPd").innerHTML=f.brk>0.05?`<b style="color:var(--crit)">BRAKE ${Math.round(f.brk*100)}%</b>`:`throttle <b>${Math.round(f.thr*100)}%</b>${f.lim?` · <b style="color:var(--warn)">grip</b>`:""}`;
  const sec=RT.lap.sectors,cut=RT.secCut,best=RT.best&&RT.best.sec;let h="";
  for(let k=0;k<3;k++){const done=!f.pre&&f.lapT>=cut[k+1]-1e-6,t=sec[k],d=best&&done?t-best[k]:null;
    h+=`<div class="${done?"on":""}"><span>S${k+1}</span><b>${done?t.toFixed(2):k===0||(!f.pre&&f.lapT>=cut[k])?"…":"—"}</b>${d!=null?`<i class="${d<=0?"up":"dn"}">${d<=0?"−":"+"}${Math.abs(d).toFixed(2)}</i>`:""}</div>`;}
  $("rdS").innerHTML=h;roadMapDraw($("rdMap"),RT.T,f.s,RT.ghost);}
function roadBtnText(){const b=$("roadSkip");if(b)b.textContent=RT&&RT.finished?"…":"SKIP ▸▸";const s=$("roadSpd");if(s&&RT)s.textContent=RT.speed+"×";}
/* the ghost of your best lap: its distance every gd seconds, saved with the record (about 240 numbers a lap) */
function roadGhostRec(L){const gd=Math.max(0.5,Math.ceil(L.time/240*2)/2),o=[gd];for(let t=0;t<L.time;t+=gd)o.push(Math.round(roadAt(L,t).s));o.push(Math.round(L.N*L.ds));return o;}
function roadGhostAt(B,t){const g=B&&B.gh;if(!Array.isArray(g)||g.length<3||!(t>=0)||t>=B.t)return null;const gd=g[0],x=t/gd,i=Math.floor(x),a=g[1+i],b=g[2+i];if(a==null)return null;return b==null?a:a+(b-a)*(x-i);}
function roadStart(){
  const env=stdEnv(wxEnv("road")),opt=roadOpt(),trk=S.env.roadTrk,snap=testSnap();
  const res=SIM.simulate(snap.cfg,env);
  if(res.fails.length){testing=false;toast(`It wouldn't last a lap — ${String(res.fails[0]).toLowerCase()} on the dyno first`);if(career()){C().cash+=testCost();hud();}renderTest();return;}
  $("app").classList.add("onstrip");
  if(opt.dtCap>0&&res.peakTq/opt.dtCap>1.3){opt.dtBrk=true;opt.dtMsg=SIM.dtPart(res.peakTq/opt.dtCap);}   // a big overload breaks a part on the first hard exit
  const prep=SIM.roadPrep(snap.cfg,res),run0=SIM.roadRun(prep,opt),lap=SIM.lapSim(prep,opt,trk),T=SIM.roadTrack(trk);
  const best=recBucket("road")[roadKey(opt.rk||opt.ch,trk)]||null,secCut=[0,lap.sectors[0],lap.sectors[0]+lap.sectors[1],lap.time];
  RT={suVis:SIM.setupVis(opt.setup),brk:swapRoadBreak(lap,T,opt),res,env,opt,trk,snap,run:run0,lap,T,best,secCut,t:-3.5,speed:+S.env.roadSpd||2,cam:S.env.roadCam||"auto",last:performance.now(),finished:false,skip:false,redline:snap.cfg.redline,boostT:prep.boostTarget||0,lastPtr:0,bst:0,slip:0};
  ENGINE_VIS.setAutoRotate(false);$("rpmbox").style.display="block";$("roadCtl").style.display="";roadHudInit();roadBtnText();
  $("testProg").classList.remove("done");sfx("start");
  scrollCtlIntoView("roadCtl");
  const step=()=>{if(!RT||RT.finished)return;const now=performance.now(),dt=Math.min(0.1,(now-RT.last)/1000);RT.last=now;
    RT.t+=dt*RT.speed;const L=RT.lap,pre=RT.t<0,f=roadAt(L,RT.t),done=RT.t>=L.time;RT.ghost=pre?null:roadGhostAt(RT.best,RT.t);
    f.pre=pre;f.done=done;f.lapT=pre?0:Math.min(RT.t,L.time);
    RT.bst=f.bst;RT.slip=f.lim&&f.v<30?0.6:f.lim&&f.v<45?0.3:0;
    if(ENGINE_VIS.setRoad)ENGINE_VIS.setRoad({on:true,su:RT.suVis,track:RT.T,s:f.s,v:f.v,g:f.g,rpm:f.rpm,thr:f.thr,brk:f.brk,ax:f.ax,ay:f.ay,slip:RT.slip,ch:RT.opt.ch,ghost:RT.ghost,night:!!S.night,cam:RT.cam,pre:pre&&RT.t>-2.2,dt:dt*RT.speed});
    roadHud(f);run.on=true;run.rpm=f.rpm;run.load=Math.max(0.05,f.thr);$("rpmLbl").textContent=Math.round(f.rpm/10)*10;
    $("testProg").style.width=Math.min(100,100*Math.max(0,RT.t)/L.time)+"%";
    if(done&&!RT.crossed){RT.crossed=true;buzz([20,30,20]);}
    if(RT.brk&&!RT.brkHit&&!pre&&RT.t>=RT.brk.t){RT.brkHit=true;RT.skip=true;sfx("fail");buzz([80,40,120]);toast(RT.opt.dtMsg?RT.opt.dtMsg.toUpperCase()+" · the engine is fine":"DRIVELINE LET GO · the engine is fine");}   // a swap's driveline over its rating
    if(RT.skip||RT.t>=L.time+1.6*RT.speed)roadFinish();else requestAnimationFrame(step);};
  requestAnimationFrame(step);
}
function roadSkip(){if(!RT||RT.finished)return;RT.skip=true;}
(()=>{$("roadSkip").addEventListener("click",()=>roadSkip());
  $("roadSpd").addEventListener("click",()=>{if(!RT)return;RT.speed=RT.speed>=4?1:RT.speed*2;S.env.roadSpd=RT.speed;roadBtnText();save();});
  $("roadCamB").addEventListener("click",()=>{const ids=ROAD_CAMS.map(c=>c[0]);const cur=RT?RT.cam:S.env.roadCam;const nx=ids[(ids.indexOf(cur)+1)%ids.length];S.env.roadCam=nx;if(RT)RT.cam=nx;$("roadCamB").textContent="Cam · "+ROAD_CAMS.find(c=>c[0]===nx)[1];save();});})();
function roadFinish(){
  if(!RT||RT.finished)return;RT.finished=true;const {res,env,opt,trk,run:a,lap,snap}=RT;const same=testSame(snap);
  setTimeout(()=>{if(!testing){if(ENGINE_VIS.setRoad)ENGINE_VIS.setRoad({on:false});$("app").classList.remove("onstrip");}},RT.skip?250:1600);
  testing=false;run.on=false;run.rpm=0;$("rpmbox").style.display="none";$("roadCtl").style.display="none";$("testProg").classList.add("done");setTimeout(()=>{$("testProg").style.width="0";},700);ENGINE_VIS.setAutoRotate(null);
  const C0=opt.car||SIM.CHASSIS[opt.ch],car=lap.car,tr=lap.trace,dec={d:[],v:[],thr:[],brk:[],g:[]};
  for(let i=0;i<lap.N;i+=4){dec.d.push(Math.round(i*lap.ds));dec.v.push(+(tr.v[i]*3.6).toFixed(1));dec.thr.push(+tr.thr[i].toFixed(2));dec.brk.push(+tr.brk[i].toFixed(2));dec.g.push(tr.g[i]);}
  const r={ch:opt.ch,chName:C0.n,tyre:opt.tyre,tyreName:SIM.ROAD_TYRES[opt.tyre].n,trk,trkName:lap.trackName,len:Math.round(lap.len),finalK:opt.finalK,fd:+car.fd.toFixed(2),fdAuto:+car.fdAuto.toFixed(2),gears:car.gears.length,
    m:Math.round(car.m),front:+car.front.toFixed(3),bal:car.bal,su:opt.setup||null,suBal:+car.bi.toFixed(2),engKg:Math.round(car.engKg),drive:car.drive,
    zero60:a.zero60,zero100:a.zero100,zero200:a.zero200,quarter:a.quarter,roll:a.roll80120,brake100:a.brake100,top:a.top,spinT:a.spinT,
    lapT:+lap.time.toFixed(3),sectors:lap.sectors.map(x=>+x.toFixed(3)),vmax:+lap.vmax.toFixed(1),vmin:+lap.vmin.toFixed(1),apex:lap.apex,shifts:lap.shifts,fullPct:lap.fullPct,ayPk:lap.ayPk,brakePk:lap.brakePk,tracT:lap.tractionT,trace:dec};
  /* records: best lap per chassis × circuit, best 0–100 per chassis */
  if(opt.sw){r.swap=swapTag();if(RT.brk)r.swapBroke=RT.brk;}else if(RT.brk&&opt.dtMsg)r.dtBroke={msg:opt.dtMsg,t:RT.brk.t,corner:RT.brk.corner};
  if(!r.swapBroke&&!r.dtBroke)r.tip=suTipRoad(SIM.roadPrep(snap.cfg,res),opt,trk,lap.time);
  if(!ff&&same&&!r.swapBroke&&!r.dtBroke){const RR=recBucket("road"),k=roadKey(opt.rk||opt.ch,trk),was=RR[k];if(!was||r.lapT<was.t){RR[k]=Object.assign({t:r.lapT,sec:r.sectors.slice(),z:r.zero100,ch:opt.ch,trk,gh:roadGhostRec(lap)},opt.sw?{sw:opt.sw}:{},recTag());if(was){r.pb={was:was.t};setTimeout(()=>toast(`LAP RECORD · ${fmtLap(r.lapT,2)} (was ${fmtLap(was.t,2)})`),2700);}else r.pb={first:true};}}
  r.wx=wxSnap("road");res.road=r;S.last={hash:snap.h,cfg:snap.cfg,env,res};
  const line=`${r.trkName} ${fmtLap(r.lapT)} · 0–100 ${r.zero100!=null?r.zero100.toFixed(1)+" s":"—"} · top ${Math.round(r.top.kmh)} km/h`;
  // a track day counts like any other event: sponsors see it (form, record bonus, offers), the crew learn from it, a rival's posted lap is decided — spEvent does all of that
  if(career()&&same){addWear(0.35,hKey(snap.h));logEvent(`Track day in ${roadCarTxt(opt)}: ${line}`,r.pb&&r.pb.was?"good":"");
    if(!ff){const won0=(rivS().hist&&rivS().hist.won)||0;spEvent("road",{ch:opt.ch,trk,sw:!!opt.sw,t:r.swapBroke||r.dtBroke?null:r.lapT,record:!!(r.pb&&r.pb.was)});r.rivBeat=((rivS().hist&&rivS().hist.won)||0)>won0;}
    hud();checkGoals();}
  if(same&&!ff)achCheck({type:"road",r,failed:!!(r.swapBroke||r.dtBroke)});
  toast(`${fmtLap(r.lapT)} · ${r.trkName}`);
  if(r.swap)swapAfter(r);
  RT.lap=null;save();recompute();renderTest();revealVerdict();
}
function roadRedraw(){const l=lastForChart();if(S.env.testType==="road"&&l&&l.road)drawRoadTrace(l.road);}
