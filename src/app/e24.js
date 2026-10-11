/* ===================== 24 HOURS OF PRAIRIE SKY: the endurance race ===================== */
/* The road-test car on race slicks against ~20 AI cars in three classes, simulated in accelerated time (SIM.enduroStep in
   slices per frame). Strategy lives in S.env.e24* before the race and in ER.R.plan during it; the live race is not saved —
   career keeps a marker (C().e24.live) so a page closed mid-race still counts as a retirement. */
let ER=null;
const E24_FEE=3500,E24_GAP=6,E24_REP=120,E24_SPEEDS=[1,60,600,3600],E24_CAMS=[["auto","Auto"],["tower","Tower"],["chase","Chase"],["onboard","Onboard"]];
const E24_STINTS=[[0,"Max","to the fuel"],[45,"45 min","short, light"],[60,"60 min","an hour"],[90,"90 min","long"]];
function e24EnvFix(){const e=S.env;if(!SIM.ROAD_TRACKS[e.e24Trk])e.e24Trk="gp";if(!SIM.E24_MODES[e.e24Mode])e.e24Mode="race";if(!E24_STINTS.some(s=>s[0]===+e.e24Stint))e.e24Stint=0;
  if(e.e24Fuel!=="full"&&e.e24Fuel!=="stint")e.e24Fuel="full";if(!SIM.E24_TYRES[e.e24Tyre])e.e24Tyre="medium";if(e.e24Chg!=="every"&&e.e24Chg!=="double")e.e24Chg="every";
  if(typeof e.e24SC!=="boolean")e.e24SC=true;if(!E24_SPEEDS.includes(+e.e24Spd))e.e24Spd=600;if(!E24_CAMS.some(c=>c[0]===e.e24Cam))e.e24Cam="auto";roadEnvFix();return e;}
function e24C(){const c=C();if(!c.e24||typeof c.e24!=="object")c.e24={next:0,runs:0,live:null};return c.e24;}
function e24Recs(){const R=recs();if(!R.e24||typeof R.e24!=="object")R.e24={};return R.e24;}
const e24TrkName=trk=>(SIM.ROAD_TRACKS[trk]||SIM.ROAD_TRACKS.gp).n;
const e24Cls=c=>(SIM.E24_CLASSES[c]||{n:c}).n;
const e24Min=t=>t<3600?Math.round(t/60)+" min":e24HM(t)+" h";
const e24HM=t=>{t=Math.max(0,t);const h=Math.floor(t/3600),m=Math.floor(t%3600/60);return h+":"+String(m).padStart(2,"0");};
/* career: rep, the calendar, a certified engine, the entry */
function e24Gate(){if(!career())return null;if(C().rep<E24_REP)return `Opens at ${E24_REP} rep — ${(REP_TIERS.find(r=>r[0]===E24_REP)||[0,"Known builder"])[1]}`;const g=e24C();
  if(C().week<g.next)return `Next running in week ${g.next}`;if(!(C().cert&&C().cert.ok&&C().cert.hash===cfgHash(S.cfg)))return "Certify this engine on the dyno first";if(C().cash<E24_FEE)return `Entry is ${fmt$(E24_FEE)} — not enough cash`;return null;}
/* a race that was running when the page closed: the team packed up, the entry is gone */
function e24Orphan(){if(!career()||ER)return;const g=e24C();if(!g.live)return;const L=g.live;g.live=null;g.runs=(g.runs||0)+1;const R=recs();R.e24Runs=(R.e24Runs||0)+1;
  logEvent(`24 Hours of Prairie Sky (${e24TrkName(L.trk)}): retired — the team packed up when the shop closed mid-race`,"bad");save();}
/* the AI field is built from the presets once per circuit, a few cars a frame */
const E24W={trk:null,q:[],done:{},busy:false,cb:null};
function e24Warm(trk,cb){if(E24W.done[trk]){if(cb)cb();return;}
  if(E24W.trk!==trk||!E24W.q.length){E24W.trk=trk;E24W.q=[];for(const c of SIM.E24_CLS_ORDER)for(const id of SIM.E24_CLASSES[c].pool)E24W.q.push([id,c]);}
  if(cb)E24W.cb=cb;if(E24W.busy)return;E24W.busy=true;
  const step=()=>{const t0=performance.now(),tk=E24W.trk;while(E24W.q.length&&performance.now()-t0<10){const [id,c]=E24W.q.shift();try{SIM.e24AiPrep(id,c,tk);}catch(e){}}
    if(E24W.q.length){requestAnimationFrame(step);return;}
    SIM.enduroClasses(tk);E24W.done[tk]=true;E24W.busy=false;const f=E24W.cb;E24W.cb=null;if(f)f();};
  requestAnimationFrame(step);}
/* the player's car, cached per engine × chassis × gearing × circuit */
const e24Cache=new Map();
function e24Prep(trk,cfg){cfg=cfg||S.cfg;const o=roadOpt(),k=cfgHash(cfg)+"|"+o.ch+"|"+o.finalK+"|"+trk+(o.car?"|"+o.rk+"|"+o.car.mass+"|"+o.car.cdA+"|"+o.dl+"|"+o.cool:"");let P=e24Cache.get(k);
  if(!P){if(e24Cache.size>10)e24Cache.clear();P=SIM.enduroPrep(cfg,null,o.car?{ch:o.ch,finalK:o.finalK,car:o.car,dl:o.dl,cool:o.cool}:{ch:o.ch,finalK:o.finalK},trk);e24Cache.set(k,P);}return P;}
const e24Pct=h=>(100*(1-Math.exp(-h))).toFixed(h<0.001?2:1);
function e24Hint(){return career()?`<b>24 Hours of Prairie Sky</b> · ${fmt$(E24_FEE)} entry, fuel billed by the litre after the flag. Opens at ${E24_REP} rep; one entry every ${E24_GAP} weeks. The top five in each class are paid, every hour is wear on the build, and a failure can end it — the teardown shows what let go.`
  :`<b>24 Hours of Prairie Sky</b> · your engine in the road-test car against twenty cars in three classes, a full day and night in accelerated time. Set the strategy, then watch it at 1× or time-lapse to the next event.`;}
/* strategy seg rows: pre-race they edit S.env.e24*, live they edit the race plan (mode at once, the rest from the next stop) */
function e24Seg(k,cur,opts,cls){return `<div class="seg ${cls||""}">${opts.map(([v,n,d])=>`<button data-e24k="${k}" data-e24v="${v}" class="${String(cur)===String(v)?"on":""}">${n}${d?`<small>${d}</small>`:""}</button>`).join("")}</div>`;}
function e24StratHtml(live,P){const e=S.env,pl=live?ER.R.plan:{mode:e.e24Mode,stint:+e.e24Stint,fuel:e.e24Fuel,tyre:e.e24Tyre,chg:e.e24Chg},M=SIM.E24_MODES,Ty=SIM.E24_TYRES;
  const md=k=>{if(!P)return M[k].d;const m=P.modes[k],b=P.modes.race;return `${k==="race"?fmtLap(m.lap):(m.lap>=b.lap?"+":"−")+Math.abs(m.lap-b.lap).toFixed(1)+" s"} · ${m.fuel.toFixed(1)} L`;};
  let h=`<div class="lbl"><span>Engine mode${live?" · now":""}</span></div>${e24Seg("e24Mode",pl.mode,["push","race","save"].map(k=>[k,M[k].n,md(k)]),"n3")}`;
  h+=`<div class="lbl"><span>Stint length${live?" · next stint":""}</span></div>${e24Seg("e24Stint",pl.stint,E24_STINTS,"n4")}`;
  h+=`<div class="lbl"><span>Fuel at the stops</span></div>${e24Seg("e24Fuel",pl.fuel,[["full","Full tank",`${SIM.E24_TANK} L`],["stint","Just enough","for the stint, lighter"]])}`;
  h+=`<div class="lbl"><span>Tyres${live?" · next set":""}</span></div>${e24Seg("e24Tyre",pl.tyre,Object.entries(Ty).map(([k,t])=>[k,t.n,`${t.mu>1?"+":t.mu<1?"−":""}${Math.round(Math.abs(t.mu-1)*1000)/10||""}${t.mu===1?"base":"%"} · ${t.km} km`]),"n3")}`;
  h+=`<div class="lbl"><span>Tyre changes</span></div>${e24Seg("e24Chg",pl.chg,[["every","Every stop","fresh rubber"],["double","Double-stint","save 22 s every other stop"]])}`;
  if(!live)h+=`<div class="lbl"><span>Safety cars</span></div>${e24Seg("e24SC",String(e.e24SC),[["true","On","debris, crashes, bunched field"],["false","Off","green all day"]])}`;
  return h;}
function e24EnvHtml(){e24Orphan();const e=e24EnvFix(),trk=e.e24Trk,ready=!!E24W.done[trk],gate=e24Gate(),o=roadOpt(),C0=SIM.CHASSIS[o.ch];
  let h=`<div class="e24ev"><b>24 Hours of Prairie Sky</b><span>Saturday 2 pm to Sunday 2 pm · about 21 cars in Proto, GT and Stock · dark from 10 pm to 5 am</span>`;
  if(career()){const g=e24C(),R=recs();h+=`<p class="${gate?"no":"ok"}">${gate?gate:`Entry open · ${fmt$(E24_FEE)}`}${g.runs?` · ${g.runs} run${g.runs>1?"s":""}${R.e24Best?`, best ${ordN(R.e24Best)} in class`:""}`:""}</p>`;}
  h+=`</div>`;
  h+=`<div class="lbl"><span>Circuit</span></div>${e24Seg("e24Trk",trk,Object.entries(SIM.ROAD_TRACKS).map(([id,t])=>{const T=SIM.roadTrack(id);return [id,t.n,`${(T.len/1000).toFixed(2)} km · ${id==="gp"?"the 24 Hours":"short-course 24"}`];}))}`;
  h+=swapEnvNote();if(!o.car)h+=`<div class="lbl"><span>Car</span></div><div class="seg wide">${Object.entries(SIM.CHASSIS).map(([id,c])=>`<button data-rk="roadCh" data-rv="${id}" class="${o.ch===id?"on":""}">${c.n}<small>${c.d.split(" · ").slice(0,2).reverse().join(" · ")}</small></button>`).join("")}</div>`;
  let P=null;
  if(!ready){h+=`<div class="e24scr"><b>Scrutineering</b><p>Checking the field in… <span class="e24spin"></span></p></div>`;e24Warm(trk,()=>{if(S.env.testType==="race24"&&!ER&&curTab==="events")renderEnv();});}
  else if(quick&&quick.rpms){try{P=e24Prep(trk);}catch(err){P=null;}
    if(P){const cls=SIM.enduroClassOf(P,trk),K=SIM.enduroClasses(trk)[cls],rt=SIM.e24Rates(P,24,e.e24Mode),rp=SIM.e24Rates(P,24,"push"),rs=SIM.e24Rates(P,24,"save"),m=P.modes[e.e24Mode],perTank=SIM.E24_TANK/m.fuel;
      const top=rt.top>=0?P.tests[rt.top]:null,crit=P.critN||[];
      h+=`<div class="e24scr"><b>Scrutineering · ${e24Cls(cls)}</b><p>Classed <b>${e24Cls(cls)}</b> on pace: ${fmtLap(m.lap)} a lap in ${C0.n.toLowerCase().replace("gt","GT").replace("awd","AWD")} trim against a class running ${fmtLap(K.med)} (fastest ${fmtLap(K.best)}). ${m.fuel.toFixed(2)} L a lap — about ${Math.floor(perTank)} laps, ${Math.round(perTank*m.lap/60)} min, on a ${SIM.E24_TANK} L tank.</p>
        <p>Failure risk about <b class="${rt.haz>0.03?"crit":rt.haz>0.012?"warn":"good"}">${e24Pct(rt.haz)}% an hour</b> in ${SIM.E24_MODES[e.e24Mode].n} at 24 °C — ${e24Pct(rt.haz*24)}% over the full 24 h (Push ${e24Pct(rp.haz)}%/h, Conserve ${e24Pct(rs.haz)}%/h).${top?` The worry is <b>${top.name.toLowerCase()}</b>${top.id==="oil_starvation"?` — ${P.gLat.toFixed(2)} g sustained in the corners on a ${String(S.cfg.oilSystem||"wet")} sump`:""}.`:""}</p>
        ${crit.length?`<p class="crit">Past its limit at race pace: <b>${crit.map(n=>rdEsc(n)).join(", ")}</b>. It will start, but expect it to let go.${crit.some(n=>/Oil pickup/.test(n))?" A baffled or dry sump fixes the oil.":""}</p>`:""}</div>`;}}
  h+=e24StratHtml(false,P);
  return h;}
/* strategy clicks: env before, plan during */
document.addEventListener("click",e=>{const b=e.target.closest("[data-e24k]");if(!b)return;const k=b.dataset.e24k,raw=b.dataset.e24v;
  const v=k==="e24Stint"?+raw:k==="e24SC"?raw==="true":raw;
  if(k==="e24Trk"&&ER)return;
  S.env[k]=v;e24EnvFix();
  if(ER&&!ER.finished){const pl=ER.R.plan,me=ER.R.cars[0],key={e24Mode:"mode",e24Stint:"stint",e24Fuel:"fuel",e24Tyre:"tyre",e24Chg:"chg"}[k];if(key){pl[key]=v;if(key==="mode"&&!me.out)me.mode=v;}e24StratRender();e24Hud();}
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
  const R=SIM.enduroNew({track:trk,me:P,seed,sc:e.e24SC,number:55,name:"Prairie Engine Works",plan:{mode:e.e24Mode,stint:+e.e24Stint,fuel:e.e24Fuel,tyre:e.e24Tyre,chg:e.e24Chg,scPit:true}});
  if(career()&&crewPitK()!==1)R.pitK=crewPitK();   // fast hands on the crew: quicker stops (app/crew.js)
  if(career()){C().cash-=E24_FEE;const g=e24C();g.next=C().week+E24_GAP;g.live={w:C().week,trk,ch:opt.ch};logEvent(`24 Hours of Prairie Sky: entered in ${roadCarTxt(opt)} at ${e24TrkName(trk)} — ${fmt$(E24_FEE)} entry`);hud();save();}
  ER={R,P,opt,trk,snap,T:SIM.roadTrack(trk),L:P.lap,speed:+e.e24Spd,cam:e.e24Cam,last:performance.now(),lastVis:0,lastHud:0,feedN:0,jump:false,toEnd:0,finished:false,field:null,flash:0,pits:0};
  renderEnv();$("app").classList.add("onstrip");ENGINE_VIS.setAutoRotate(false);$("e24Ctl").style.display="";$("e24Side").style.display="";e24HudInit();e24StratRender();e24FeedRender();e24Hud();
  $("testProg").classList.remove("done");sfx("start");buzz([20,30,20]);toast(`GREEN FLAG · ${e24TrkName(trk).toUpperCase()}`);
  requestAnimationFrame(()=>{const pn=$("panel"),r=$("e24Ctl").getBoundingClientRect(),pr=pn.getBoundingClientRect();if(!deskOn()&&(r.top<pr.top||r.top>pr.top+pr.height*0.5))pn.scrollTo({top:pn.scrollTop+r.top-pr.top-6,behavior:calmScroll()});});
  ER.last=performance.now();requestAnimationFrame(e24Frame);}
function e24Frame(now){if(!ER||ER.finished)return;const R=ER.R,me=R.cars[0];
  const dt=Math.min(0.1,Math.max(0,(now-ER.last)/1000));ER.last=now;const t0=performance.now();
  if(ER.toEnd&&now>=ER.toEnd){while(performance.now()-t0<11&&!R.done)SIM.enduroStep(R,R.dur+14400,300);}
  else if(ER.jump){const n0=R.stopN||0;while(performance.now()-t0<9&&!R.done){SIM.enduroStep(R,R.dur+14400,150,true);if((R.stopN||0)>n0){ER.jump=false;e24SpdRender();break;}}}
  else if(!ER.toEnd){const target=R.t+dt*ER.speed;while(performance.now()-t0<9&&!R.done&&R.t<target){if(!SIM.enduroStep(R,target,150))break;}}
  if((me.out||me.fin)&&!ER.toEnd){ER.toEnd=now+(me.out?1800:900);ER.jump=false;if(me.out&&me.dnf&&me.dnf.id){$("flash").style.background="rgba(226,71,60,.45)";setTimeout(()=>$("flash").style.background="rgba(226,71,60,0)",250);sfx("fail");buzz([80,40,120]);}e24SpdRender();e24StratRender();}
  if(R.done){e24Hud();e24FeedRender();e24Finish();return;}
  if(now-ER.lastHud>150){ER.lastHud=now;e24Hud();}
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
  b.innerHTML=end?`<button class="btn pri" data-e24a="end" style="flex:1">${ER.toEnd?"Running the race to the flag…":"To the flag ▸▸"}</button>`
    :E24_SPEEDS.map(s=>`<button class="btn ${!ER.jump&&ER.speed===s?"on":""}" data-e24s="${s}">${s===1?"1×":s+"×"}</button>`).join("")+`<button class="btn pri e24nx${ER.jump?" on":""}" data-e24a="next">${ER.jump?"Running…":"Next event ▸▸"}</button><button class="btn e24cam" data-e24a="cam">Cam · ${E24_CAMS.find(c=>c[0]===ER.cam)[1]}</button>`;}
function e24Gap(me,o,ahead){if(!o)return"—";const d=ahead?o.laps-me.laps:me.laps-o.laps;if(d>0)return `${ahead?"+":"−"}${d} lap${d>1?"s":""}`;const g=ahead?me.tLast-o.tLast:o.tLast-me.tLast;return `${ahead?"+":"−"}${Math.abs(g).toFixed(1)} s`;}
function e24TyreLife(R,c,t){const sky=SIM.e24Sky(t),Ty=SIM.E24_TYRES[c.tyre.c],life=Ty.km*Math.min(1.25,Math.max(0.7,1-0.012*(sky.amb-20)))/SIM.E24_MODES[c.mode].tyre;return 1-c.tyre.km/life;}
function e24Hud(){if(!ER||!$("e24Clk"))return;const R=ER.R,me=R.cars[0],t=R.t,P=ER.P,sky=SIM.e24Sky(t),p=SIM.e24Pos(R,me),m=P.modes[me.mode],nCls=R.cars.filter(c=>c.cls===me.cls).length;
  $("e24Clk").textContent=SIM.e24Clock(t);$("e24El").textContent=`race ${e24HM(Math.min(t,R.dur))} of 24:00`;
  $("e24P").textContent=me.out?"OUT":me.fin?"FLAG":"P"+p.all;$("e24Pc").textContent=`${e24Cls(me.cls)} P${p.cls} of ${nCls}`;
  $("e24Ga").textContent=p.ahead?`${e24Gap(me,p.ahead,true)} #${p.ahead.no}`:"leading";$("e24Gb").textContent=p.behind?`${e24Gap(me,p.behind,false)} #${p.behind.no}`:"—";
  $("e24Pr").style.width=Math.min(100,100*t/R.dur)+"%";$("e24Sc").hidden=!R.sc;
  $("e24Lp").textContent=me.laps;$("e24Lt").textContent=`last ${fmtLap(me.last)} · best ${fmtLap(me.best)}`;
  $("e24Fu").textContent=Math.round(me.fuel)+" L";$("e24Fl").textContent=`~${Math.floor(me.fuel/m.fuel)} laps · ${m.fuel.toFixed(2)} L/lap`;$("e24Fb").style.width=Math.min(100,me.fuel)+"%";
  const tl=e24TyreLife(R,me,t);$("e24Ty").textContent=Math.max(0,Math.round(tl*100))+"%";$("e24Tl").textContent=`${SIM.E24_TYRES[me.tyre.c].n} · ${Math.round(me.tyre.km*1000/R.len)} laps`;
  const tb=$("e24Tb");tb.style.width=Math.max(0,Math.min(100,tl*100))+"%";tb.style.background=tl<0.1?"var(--crit)":tl<0.3?"var(--warn)":"";
  const f=Math.min(1.6,Math.max(-0.6,(sky.amb-11)/20)),ct=P.tests.find(x=>x.id==="cooling"),cu=ct?ct.uC+(ct.uH-ct.uC)*f:0.6,mk={push:1,race:0,save:-1}[me.mode];
  const cool=Math.round(84+18*cu+3*mk),oil=Math.round(P.oilC+(P.oilH-P.oilC)*f+4*mk),egt=Math.round(P.egtC+(P.egtH-P.egtC)*f+(mk>0?25:mk<0?-45:0));
  $("e24En").textContent=cool+" °C";$("e24En").className=cool>=108?"crit":cool>=101?"warn":"";$("e24Et").textContent=`oil ${oil} · EGT ${egt}`;
  const rt=SIM.e24Rates(P,sky.amb,me.mode),hz=me.out||me.fin?0:rt.haz,top=rt.top>=0?P.tests[rt.top]:null;$("e24Hz").textContent=e24Pct(hz)+"%/h";$("e24Hz").className=hz>0.03?"crit":hz>0.012?"warn":"good";
  const dm=Math.max(0,...me.dmg);$("e24Hw").textContent=top?`${top.name} · wear ${Math.round(dm*100)}%`:"—";const hb=$("e24Hb");hb.style.width=Math.min(100,100*hz/0.05)+"%";hb.style.background=hz>0.03?"var(--crit)":hz>0.012?"var(--warn)":"var(--good)";
  $("e24Am").textContent=Math.round(sky.amb)+" °C";$("e24Sk").textContent=`${sky.n>0.7?"night":sky.warm>0.35?(sky.h>12?"dusk":"dawn"):sky.n>0.2?(sky.h>12?"dusk":"dawn"):"day"} · ${SIM.E24_MODES[me.mode].n.toLowerCase()} · ${me.drv[me.drvI%3]}`;
  e24MapDraw();}
function e24MapDraw(){const cv=$("e24Map");if(!cv||!ER)return;const T=ER.T,R=ER.R,dpr=Math.min(devicePixelRatio||1,2),B=cvBox(cv),Wd=B.W,H=B.H;
  if(cv.width!==Math.round(Wd*dpr)){cv.width=Math.round(Wd*dpr);cv.height=Math.round(H*dpr);}
  const x=cv.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,Wd,H);const sc=Math.min((Wd-12)/T.size[0],(H-12)/T.size[1]),Pt=i=>[Wd/2+T.x[i]*sc,H/2-T.y[i]*sc];
  const ink=B.ink;x.lineJoin="round";x.strokeStyle=ink;x.globalAlpha=.2;x.lineWidth=5;x.beginPath();for(let i=0;i<T.N;i+=2){const p=Pt(i);i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]);}x.closePath();x.stroke();x.globalAlpha=.7;x.lineWidth=1.4;x.stroke();x.globalAlpha=1;
  const W=SIM.enduroWhere(R,R.t),L=ER.L,col=["#e8e6df","#5fa8e6","#e5b73b"];
  for(let k=W.length-1;k>=0;k--){const w=W[k],c=R.cars[k];if(w.out)continue;let p;if(w.pit||w.fin){p=Pt(Math.max(0,T.N-14));p[1]+=6;}else{const s=roadAt(L,w.f*L.time).s,i=Math.floor(((s/T.ds)%T.N+T.N)%T.N);p=Pt(i);}
    if(c.me){x.fillStyle="#ff7a1a";x.beginPath();x.arc(p[0],p[1],4.6,0,7);x.fill();x.strokeStyle="#15171b";x.lineWidth=1.3;x.stroke();}
    else{x.fillStyle=col[Math.max(0,SIM.E24_CLS_ORDER.indexOf(c.cls))];x.globalAlpha=c.cls===R.cars[0].cls?1:.55;x.beginPath();x.arc(p[0],p[1],2.6,0,7);x.fill();x.globalAlpha=1;}}}
function e24StratRender(){const el=$("e24Side");if(!el||!ER)return;const R=ER.R,me=R.cars[0],end=me.out||me.fin;
  el.innerHTML=`<div class="sec e24strat"><h2>Strategy <span class="cnt">${end?"race over":`stint ${me.stints.length} · ${me.drv[me.drvI%3]}`}</span></h2>${end?`<p class="hint">${me.out?(me.dnf&&me.dnf.id?"Out of the race. The rest of the field runs to the flag.":"Retired. The rest of the field runs to the flag."):"Chequered flag. The field is finishing its last laps."}</p>`:e24StratHtml(true,ER.P)+`<div class="row e24act"><button class="btn${R.plan.box?" on":""}" data-e24a="box">${R.plan.box?"Boxing this lap":"Box this lap"}</button><button class="btn" data-e24a="swap">Box · swap driver</button><button class="btn danger" data-e24a="retire">Retire</button></div>`}</div>
    <div class="sec e24feedsec"><h2>Race feed <span class="cnt" id="e24FeedCnt"></span></h2><div class="e24feed" id="e24Feed"></div></div>`;e24FeedRender(true);}
const E24_FEEDK={pit:"pit",pass:"pass",fail:"warn",inc:"warn",dnf:"crit",ai:"aif",sc:"sc",sky:"sky",hour:"hour",start:"sky",flag:"sky"};
function e24FeedRender(force){const el=$("e24Feed");if(!el||!ER)return;const F=ER.R.feed,lf=F[F.length-1];if(!force&&lf&&lf.n===ER.feedN)return;ER.feedN=lf?lf.n:0;
  el.innerHTML=F.slice(-40).reverse().map(f=>`<div class="e24f ${E24_FEEDK[f.k]||""}${f.me?" me":""}"><time>${SIM.e24Clock(f.t)}</time><span>${rdEsc(f.txt)}</span></div>`).join("");const c=$("e24FeedCnt");if(c)c.textContent=F.length+" events";}
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
  /* career money and standing */
  if(career()&&!ff&&same){const g=e24C();g.live=null;g.runs=(g.runs||0)+1;const K=SIM.E24_CLASSES[cls],fu=SIM.fuelOf(cfg0)||SIM.OPT.fuel.r91;
    const prize=r.classified?(K.prize[r.posCls-1]||0)+3000:0,fuelBill=Math.round(me.fuelUsed*(fu.costL||1.5)*0.35)/* series fuel, at the trade price */;let rep=r.classified?(K.rep[r.posCls-1]||6)+(r.pos===1?10:0):0;
    if(r.dnf&&r.dnf.id&&r.dnf.id!=="swap_driveline"){C().cert=null;rep-=2;}   // a swap gearbox is not the engine
    C().cash+=prize-fuelBill;C().rep=Math.max(0,C().rep+rep);r.prize=prize;r.fuelBill=fuelBill;r.rep=rep;
    addWear(+(hrs/40*({push:1.6,race:1.25,save:0.95}[stints.length?stints[stints.length-1].mode:"race"]||1.25)).toFixed(2),snap?hKey(snap.h):undefined);
    logEvent(`24 Hours of Prairie Sky: ${r.dnf?(r.dnf.id?"out after "+r.dnf.h+" h — "+r.dnf.name.toLowerCase():"retired after "+r.dnf.h+" h"):r.classified?`${ordN(r.posCls)} in ${r.clsName}, ${ordN(r.pos)} overall`:"not classified"} — ${r.laps} laps${prize?", "+fmt$(prize)+" prize":""}, fuel ${fmt$(fuelBill)}${rep?", "+(rep>0?"+":"")+rep+" rep":""}`,r.classified&&r.posCls<=3?"good":r.dnf&&r.dnf.id?"bad":"");
    spEvent("endurance",{finish:r.classified&&r.posCls<=3,win:r.classified&&r.posCls===1});hud();checkGoals();}
  /* records: the longest distance per car and circuit */
  if(!ff&&same){const E=e24Recs(),k=roadKey(opt.rk||opt.ch,trk),was=E[k];if(!was||r.km>was.km){E[k]=Object.assign({km:r.km,laps:r.laps,pc:r.classified?r.posCls:null,cls,ch:opt.ch,trk},opt.sw?{sw:opt.sw}:{},recTag());r.pb=was?{was:was.km}:{first:true};}
    const RR=recs();RR.e24Runs=(RR.e24Runs||0)+1;if(r.classified&&!(RR.e24Best<=r.posCls))RR.e24Best=r.posCls;
    achCheck({type:"e24",r});if(r.swap)swapAfter(r);}
  const env=Object.assign(stdEnv(),{testType:"race24"});const res=Object.assign({},P.res,{e24:r});
  S.last=snap?{hash:snap.h,cfg:snap.cfg,env,res}:{hash:cfgHash(S.cfg),cfg:Object.assign({},S.cfg),env,res};
  testing=false;run.on=false;run.rpm=0;$("rpmbox").style.display="none";$("e24Ctl").style.display="none";$("e24Side").style.display="none";$("e24Side").innerHTML="";$("testProg").classList.add("done");setTimeout(()=>{$("testProg").style.width="0";},700);ENGINE_VIS.setAutoRotate(null);
  setTimeout(()=>{if(!testing){if(ENGINE_VIS.setRoad)ENGINE_VIS.setRoad({on:false});$("app").classList.remove("onstrip");}},1400);
  toast(r.dnf?(r.dnf.id?`OUT · ${r.dnf.name.toUpperCase()}`:"RETIRED"):r.classified?`${ordN(r.posCls).toUpperCase()} IN ${r.clsName.toUpperCase()} · ${r.laps} LAPS`:`NOT CLASSIFIED · ${r.laps} LAPS`);
  ER=null;save();recompute();renderTest();revealVerdict();}
function e24Verdict(res){const r=res.e24,cls=r.dnf&&r.dnf.id?"fail":r.classified&&r.posCls<=3?"pass":"marg";
  const big=r.dnf?(r.dnf.id?`OUT AFTER ${r.dnf.h} H`:`RETIRED AFTER ${r.dnf.h} H`):r.classified?`${ordN(r.posCls).toUpperCase()} IN ${r.clsName.toUpperCase()}`:"NOT CLASSIFIED";
  return `<div class="verdict ${cls}"><div style="flex:1"><div class="big">${big}</div><p>24 Hours of Prairie Sky · ${rdEsc(r.trkName)} · ${rdEsc(r.chName.toLowerCase().replace("gt","GT").replace("awd","AWD"))} in ${r.clsName} · ${ordN(r.pos)} of ${r.of} overall${r.dnf&&r.dnf.id?` — ${rdEsc(r.dnf.name.toLowerCase())} let go`:""}${r.prize?` · prize ${fmt$(r.prize)}`:""}${r.rep?` · ${r.rep>0?"+":""}${r.rep} rep`:""}${r.pb&&r.pb.was!=null?` · <b>distance record</b> (was ${r.pb.was} km)`:""}</p>
    <div class="vstats"><div><b>${r.laps}</b><span>laps</span></div><div><b>${fmtLap(r.best,2)}</b><span>fastest lap</span></div><div><b>${r.avg?fmtLap(r.avg,1):"—"}</b><span>avg green lap</span></div>
    <div><b>${r.pits}</b><span>pit stops</span></div><div><b>${r.fuel.toLocaleString("en-CA")}</b><span>litres</span></div><div><b>${r.win-r.laps>0?"−"+(r.win-r.laps):"0"}</b><span>to class win</span></div></div></div></div>`;}
function e24Sheet(res){const r=res.e24,TY=SIM.E24_TYRES,MO=SIM.E24_MODES;
  const fieldRows=r.field.map((f,i)=>`<div class="${f.me?"me":""}${f.out?" out":""}"><b>${i+1}</b><span class="c${SIM.E24_CLS_ORDER.indexOf(f.cls)}">${e24Cls(f.cls)}${f.cl?" "+f.pc:""}</span><span class="nm">${f.me?"▶ ":""}#${f.no} ${rdEsc(f.team)}${f.eng?` <i>${rdEsc(f.eng)}</i>`:""}</span><span>${f.out?(f.dnf?"DNF "+f.dnf.h+" h":"DNF"):f.laps}</span><span>${f.out?f.laps+" laps":fmtLap(f.best,1)}</span></div>`).join("");
  const st=r.stints.map((s,i)=>`<div><b>${i+1}</b><span>${rdEsc(s.drv)}</span><span>${TY[s.c]?TY[s.c].n:s.c}</span><span>${MO[s.mode]?MO[s.mode].n:""}</span><span>${s.laps}</span><span>${s.fuel} L</span><span>${SIM.e24Clock(s.t0)}</span></div>`).join("");
  return `<div class="sec"><h2>Race report</h2><div class="log"><div><b>Distance</b>${r.laps} laps · ${r.km.toLocaleString("en-CA")} km of ${rdEsc(r.trkName)} (${(r.len/1000).toFixed(2)} km a lap) · ${r.hrs} h on track</div>
    <div><b>Pace</b>fastest ${fmtLap(r.best,2)} on lap ${r.bestLap||"—"}${r.avg?` · average green lap ${fmtLap(r.avg,2)}`:""} · class best ${fmtLap(r.clsBest,2)}</div>
    <div><b>Pits</b>${r.pits} stops · ${e24Min(r.pitT)} lost in the lane and the box · ${r.stints.length} stints · ${r.sc} safety car${r.sc===1?"":"s"}</div>
    <div><b>Fuel</b>${r.fuel.toLocaleString("en-CA")} L · ${r.laps?(r.fuel/r.laps).toFixed(2):"—"} L a lap${r.fuelBill!=null?` · bill ${fmt$(r.fuelBill)}`:""}</div>
    ${r.dnf?`<div><b>Out</b>${rdEsc(r.dnf.name)} after ${r.dnf.h} h${r.dnf.id?" — open the teardown to see it":""}</div>`:""}</div>
    <h3 class="e24h3">Stints</h3><div class="e24tbl e24st"><div class="hd"><b>#</b><span>Driver</span><span>Tyre</span><span>Mode</span><span>Laps</span><span>Fuel</span><span>Out</span></div>${st}</div>
    <h3 class="e24h3">Classification</h3><div class="e24tbl e24cl"><div class="hd"><b>Pos</b><span>Class</span><span>Car</span><span>Laps</span><span>Best</span></div>${fieldRows}</div></div>`;}
/* the lap-time trace across the 24 hours: green laps, pit laps (orange ticks), safety-car laps (amber), night shaded */
function drawE24Trace(r){const INK=getComputedStyle(document.documentElement).getPropertyValue("--ink").trim()||"#e8e3d6",soft=INK.startsWith("#1")?"rgba(27,26,23,.45)":"rgba(232,227,214,.45)";
  const dpr=Math.min(devicePixelRatio,2),W=chart.clientWidth,H=chart.clientHeight;if(chart.width!==W*dpr){chart.width=W*dpr;chart.height=H*dpr;}
  const x=chart.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);const tr=r.trace;if(!tr||tr.length<2)return;
  const padL=40,padR=12,padT=22,padB=24,cw=W-padL-padR,ch=H-padT-padB,X=t=>padL+cw*Math.min(1,t/86400);
  const green=tr.filter(l=>!l[2]).map(l=>l[1]).sort((a,b)=>a-b),lo=green.length?green[0]:Math.min(...tr.map(l=>l[1])),p97=green.length?green[Math.floor(green.length*0.97)]:lo+6,hi=Math.max(lo+4,p97+2),Y=v=>padT+ch*(1-Math.max(0,Math.min(1,(v-lo+1)/(hi-lo+1))));   // y to the 97th percentile: an off or a puncture lap pins to the top
  const F=getComputedStyle(document.body).fontFamily;x.font="10px "+F;
  for(let t=0;t<=86400;t+=60){const s=SIM.e24Sky(t);if(s.n>0.05){x.fillStyle=`rgba(95,120,200,${0.12*s.n})`;x.fillRect(X(t),padT,cw/1440+0.6,ch);}}
  x.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue("--grid").trim()||"rgba(255,255,255,.07)";x.lineWidth=1;
  const stp=hi-lo>12?5:hi-lo>5?2:1;for(let v=Math.ceil(lo);v<=hi;v+=stp){const py=Y(v);x.beginPath();x.moveTo(padL,py);x.lineTo(W-padR,py);x.stroke();x.fillStyle=soft;x.textAlign="right";x.fillText(fmtLap(v,0).replace(/\.0$/,""),padL-4,py+3);}
  x.textAlign="center";for(let h=0;h<=24;h+=W>520?3:6){x.fillStyle=soft;x.fillText(SIM.e24Clock(h*3600),X(h*3600),H-6);}
  x.fillStyle="rgba(229,183,59,.8)";tr.forEach(l=>{if(l[2]===2)x.fillRect(X(l[0])-1,padT+ch-5,2,5);});
  x.strokeStyle="#ff7a1a";x.lineWidth=1.6;x.beginPath();let pen=false;tr.forEach(l=>{if(l[2]){pen=false;return;}const px=X(l[0]),py=Y(l[1]);pen?x.lineTo(px,py):x.moveTo(px,py);pen=true;});x.stroke();
  x.fillStyle="#ff7a1a";tr.forEach(l=>{if(l[2]===1){x.fillRect(X(l[0])-0.75,padT,1.5,6);}});
  if(r.dnf){const px=X(r.dnf.h*3600);x.strokeStyle="#e2473c";x.setLineDash([4,4]);x.beginPath();x.moveTo(px,padT);x.lineTo(px,padT+ch);x.stroke();x.setLineDash([]);x.fillStyle="#e2473c";x.textAlign=px>W-80?"right":"left";x.fillText(r.dnf.id?"failure":"retired",px+(px>W-80?-4:4),padT+12);}
  x.textAlign="left";x.font="11px "+F;x.fillStyle="#ff7a1a";x.fillText("lap time",padL+4,13);x.fillStyle="#ff7a1a";x.fillText("▮ pit",padL+62,13);x.fillStyle="rgba(229,183,59,.95)";x.fillText("▮ safety car",padL+98,13);x.fillStyle="rgba(120,140,220,.95)";x.fillText("▮ night",padL+176,13);
  if(W>520){x.fillStyle=soft;x.textAlign="right";x.fillText(`${r.trkName} · ${r.laps} laps`,W-padR,13);}}
function e24RecHtml(){const P=e24Recs(),ks=Object.keys(P).filter(k=>P[k]&&P[k].km);if(!ks.length)return"";ks.sort((a,b)=>P[b].km-P[a].km);
  return `<div class="rtop e24rec"><span>24 Hours · longest distance per car and circuit</span>${ks.map(k=>{const e=P[k],c=e.sw&&SIM.VEHICLES[e.sw]||SIM.CHASSIS[e.ch],t=SIM.ROAD_TRACKS[e.trk];if(!c||!t)return"";return `<div><b>${e.trk==="gp"?"GP":"C"}</b><span class="et">${Math.round(e.km).toLocaleString("en-CA")} km</span><span>${e.pc?ordN(e.pc)+" "+e24Cls(e.cls):"DNF"}</span><span class="nm" title="${rdEsc(e.n)}">${rdEsc(c.n)} · ${rdEsc(t.n)}</span><span>${e.w!=null?"wk "+e.w:e.d?new Date(e.d).toLocaleDateString("en-CA",{month:"short",day:"numeric"}):""}</span></div>`;}).join("")}</div>`;}
