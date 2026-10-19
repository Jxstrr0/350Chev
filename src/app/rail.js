/* ===================== RESULTS RAIL =====================
   One component, two forms, so the build -> dyno -> build loop never has to leave the tab it is on.
   Desktop 1100 px and wider: a third column right of the tab panel, always in sight. Phone and narrow windows: a peek
   sheet docked over the tab bar: one line (peaks, verdict chip, Run), tap or drag it up for the whole rail.
   It renders from the same sources as Test: S.last when it matches the build (else the live estimate, quick), the
   chart through drawChart() on its own canvas, the verdict headline Test already rendered into #verdict, the
   stress rows in Test's .st markup, and contract specs through fits(). Run clicks #runTest, so it is the same run. */
var RL=null;   // var, not const: recompute() can schedule a refresh before this file has run
const RAIL_MQ=matchMedia("(min-width:1100px)");
function railCol(){return document.documentElement.classList.contains("desk")&&RAIL_MQ.matches;}
function railW(){const r=$("rail");return r&&railCol()?r.offsetWidth:0;}
/* top edge of the docked sheet (phone or narrow desktop), for anything that keeps itself above the panel's foot */
function railTop(){const r=$("rail");if(!r||railCol()||!r.offsetParent)return Infinity;return r.getBoundingClientRect().top;}
function railSched(){if(!RL||RL.raf)return;RL.raf=requestAnimationFrame(()=>{RL.raf=0;try{railRender();}catch(e){console.warn("rail",e);}});}
function railOpen(on){if(!RL)return;on=on==null?!RL.open:!!on;if(on&&$("app").classList.contains("rkrun"))on=false;RL.open=on;$("rail").classList.toggle("open",on);$("rlGrab").setAttribute("aria-expanded",String(on));$("rlGrab").setAttribute("aria-label",on?"Hide results":"Show results");railSched();}
const RL_TN={pull:"dyno pull",endurance:"endurance",overrev:"over-rev"};
function rlName(t){return RL_TN[t]||(EV_NAME[t]||t).toLowerCase();}
/* the verdict headline: Test's own when it rendered this run, otherwise the same reading in brief */
function rlVerdict(L){const v=$("verdict").querySelector(".verdict"),cur=S.last&&L===S.last&&L.env.testType===S.env.testType;
  if(v&&cur){const k=["pass","fail","marg"].find(c=>v.classList.contains(c))||"marg",b=v.querySelector(".big");const t=b?(b.firstChild&&b.firstChild.nodeType===3?b.firstChild.nodeValue:b.textContent):"";const p=v.querySelector("p");return{k,t:t.trim()||"RESULT",s:p?p.textContent:""};}
  const r=L.res;if(r.fails&&r.fails.length)return{k:"fail",t:"FAILED",s:r.fails.join(", ")};
  return{k:r.rel>=85?"pass":"marg",t:r.rel>=85?"CLEAR":"MARGINAL",s:`Reliability ${r.rel}`};}
function rlChipTxt(t){t=String(t||"").replace(/\s+/g," ").trim();const w=t.split(" · ")[0];return w.length>16?w.slice(0,15)+"…":w;}
/* contracts on the board, judged the way Market judges them: the standard cell (a site brief: their air) */
function rlLive(){const ce=career()&&!isStdCell(simEnv());if(!ce)return quick;const key=cfgHash(S.cfg)+JSON.stringify(stdEnv({testType:"pull"}));
  if(RL.liveK!==key){RL.liveK=key;RL.live=SIM.simulate(S.cfg,stdEnv({testType:"pull"}));}return RL.live;}
function rlContracts(){if(!career()||S.bay||!C().contracts||!C().contracts.length)return"";
  const h=cfgHash(S.cfg),cert=C().cert&&C().cert.ok&&C().cert.hash===h?C().cert:null;
  const key=h+"|"+C().week+"|"+(cert?1:0)+"|"+C().contracts.map(k=>k.id).join(",")+"|"+JSON.stringify(simEnv());
  if(RL.kKey===key)return RL.kHtml;
  const live=rlLive();let html="";
  for(const k of C().contracts){let f;try{f=fits(k,live,S.cfg);}catch(e){continue;}
    const ready=cert&&f.ok&&fits(k,cert.res,cert.cfg).ok;
    const st=ready?`<b class="good">Ready to ship</b>`:f.ok?`<b class="warn">Meets brief · cert it</b>`:`<b class="crit">${f.o.filter(q=>!q.ok).length} off brief</b>`;
    html+=`<div class="rlk"><div class="rlkh"><span>${k.name}</span><small>${k.units} × ${fmt$(k.price)} · due wk ${k.expires}</small></div><div class="rlks">${st}</div>`
      +f.o.filter(q=>q.q!=="car"&&q.q!=="lsr").map(q=>`<div class="rlq ${q.ok?"ok":"no"}"><span class="n">${q.name} <i>${q.target}</i></span><span class="v">${q.val}</span><span class="rb"><i style="width:${Math.round(Math.min(1,Math.max(0,q.prog))*100)}%"></i></span></div>`).join("")+`</div>`;}
  RL.kKey=key;RL.kHtml=html?`<div class="rlsec"><h3>Contract${C().contracts.length>1?"s":""} <button class="chip" data-gotab="market">Market</button></h3>${html}</div>`:"";return RL.kHtml;}
function rlDrag(){const d=RL.drag;if(!d)return"";const old=d.hash!==cfgHash(S.cfg);
  return `<div class="rlsec"><h3>Last drag pass${old?' <em>older build</em>':""}</h3><div class="rld"><div><b>${d.et!=null?d.et.toFixed(2)+"<i>s</i>":"DNF"}</b><span>ET</span></div><div><b>${d.mph!=null?Math.round(d.mph)+"<i>mph</i>":"—"}</b><span>trap</span></div><div><b>${d.sixty?d.sixty.toFixed(3):"—"}</b><span>60 ft</span></div></div>${d.race?`<p class="rlnote">${d.race}</p>`:""}</div>`;}
function railRender(){const rail=$("rail");if(!rail||!S||!quick)return;
  const app=$("app"),col=railCol(),t=S.env.testType,ev=trackEvt(t),h=cfgHash(S.cfg);
  /* the last drag pass outlives the next dyno pull: keep it apart from S.last */
  if(S.last&&S.last.res&&S.last.res.drag&&S.last.res.drag!==RL.dragRef){const d=S.last.res.drag,R=d.race;RL.dragRef=d;
    RL.drag={hash:S.last.hash,et:d.et,mph:d.mph,sixty:d.sixty?d.sixty.t:null,race:R?(R.foul?"Red light":(R.won?"Won":"Lost")+" by "+Math.abs(R.margin||0).toFixed(3)+" s vs "+R.name):""};}
  /* a pass, a pull or a lap owns the phone screen while it runs: the sheet shrinks to a slim line (RUNNING + the peaks, no Run, no grip),
     stays shut, and is back at full size with the result the moment the run ends */
  const busy=testing&&ev&&!col;
  if(busy&&RL.open)railOpen(false);
  app.classList.toggle("rkon",!col);app.classList.toggle("rkrun",busy);
  const L=S.last&&S.last.hash===h&&S.last.res&&S.last.res.rpms?S.last:null,res=L?L.res:quick,prev=!L&&S.last&&S.last.res&&S.last.res.peakHp!=null?S.last.res:null;
  const dl=(a,b)=>prev?delta(a,b):"";
  $("rlPk").innerHTML=`<div class="rlp"><b>${Math.round(res.peakHp)}<i>hp</i></b>${dl(res.peakHp,prev&&prev.peakHp)}<span>@ ${res.peakHpRpm.toLocaleString()}</span></div><div class="rlp"><b>${Math.round(res.peakTq)}<i>Nm</i></b>${dl(res.peakTq,prev&&prev.peakTq)}<span>@ ${res.peakTqRpm.toLocaleString()}</span></div>${(()=>{const p=pwRatio(res.peakHp);return `<div class="rlp pw" title="Power to weight against the ${p.m.toLocaleString("en-CA")} kg drag car"><b>${p.hpt.toLocaleString("en-CA")}<i>hp/t</i></b><span>${p.kgHp.toFixed(p.kgHp<10?2:1)} kg/hp · ${p.m.toLocaleString("en-CA")} kg</span></div>`;})()}`;
  const V=L?rlVerdict(L):{k:"est",t:"NOT RUN",s:prev?"Changed since the last run — figures are the live estimate, deltas against that run.":"Live estimate. Run it to lock a result."};
  const chip=$("rlChip");chip.className="rlchip "+V.k;chip.textContent=testing?"RUNNING":rlChipTxt(V.t);
  $("rlTag").textContent=L?`${rlName(L.env.testType).replace(/^./,c=>c.toUpperCase())} · measured`:"live estimate";
  /* off the Events tab the rail's Run is always the dyno pull, whatever event was picked last (the event runs from its own dock) */
  const dy=ev&&curTab!=="events",rt=dy?railDynoT():t;let cost;if(dy){S.env.testType=rt;try{cost=testCost();}finally{S.env.testType=t;}}else cost=testCost();
  const run=$("rlRun");run.disabled=testing;
  run.innerHTML=testing?"Running…":`<span class="rlrl">Run</span><span class="rlrt"> · ${rlName(rt).replace(/^./,c=>c.toUpperCase())}${cost?" · "+fmt$(cost):""}</span>`;
  run.title=`Same run as Test: ${rlName(rt)}`;
  $("rlDyno").hidden=!ev||testing||curTab!=="events";
  $("rlV").innerHTML=`<div class="rlv ${V.k}"><b>${V.t}</b>${V.s?`<small>${V.s}</small>`:""}</div>`;
  $("rlK").innerHTML=rlContracts();$("rlD").innerHTML=rlDrag();pwUpd();
  const cv=$("rlChart");if(cv.offsetParent&&cv.clientWidth>0){try{drawChart(res,null,cv);}catch(e){}}
  toastPlace();
}
/* Run: the same run Test arms. An event type opens Events first (its launch control lives there). */
function railDynoT(){return DYNO_T.includes(S.testPick)?S.testPick:"pull";}
function railRun(){if(testing)return;const t=S.env.testType;if(trackEvt(t)&&curTab!=="events"){railDyno();return;}$("runTest").click();railSched();}
function railDyno(){if(testing)return;pickTest(railDynoT());$("runTest").click();railSched();}
(function railInit(){const app=$("app");if(!app||$("rail"))return;
  const el=document.createElement("aside");el.id="rail";el.setAttribute("aria-label","Results");
  el.innerHTML=`<div class="rlhead" id="rlHead"><button class="rlgrab" id="rlGrab" aria-expanded="false" aria-controls="rlBody" aria-label="Show results"><i></i></button>
    <button class="btn pri rlrun" id="rlRun">Run</button><div class="rlpk" id="rlPk"></div><span class="rlchip" id="rlChip"></span><span class="rltag" id="rlTag"></span></div>
    <div class="rlbody" id="rlBody"><button class="chip rldyno" id="rlDyno" hidden>Dyno pull instead</button>
    <div class="rlchart"><canvas id="rlChart"></canvas></div><div id="rlV"></div><div id="rlK"></div><div id="rlD"></div></div>`;
  app.insertBefore(el,$("tabs"));
  RL={open:false,raf:0,drag:null,dragRef:null,liveK:"",live:null,kKey:"",kHtml:""};
  $("rlRun").addEventListener("click",e=>{e.stopPropagation();railRun();});
  $("rlDyno").addEventListener("click",railDyno);
  /* the sheet: tap the peek line or its grip to open or close; a swipe up opens, down closes */
  let y0=null,moved=false;const head=$("rlHead");
  head.addEventListener("pointerdown",e=>{if(railCol()||e.target.closest("#rlRun"))return;y0=e.clientY;moved=false;});
  head.addEventListener("pointermove",e=>{if(y0==null)return;const dy=e.clientY-y0;if(Math.abs(dy)>24){moved=true;railOpen(dy<0);y0=null;}});
  head.addEventListener("pointerup",()=>{y0=null;});head.addEventListener("pointercancel",()=>{y0=null;});
  head.addEventListener("click",e=>{if(railCol()||e.target.closest("#rlRun")||moved){moved=false;return;}railOpen();});
  document.addEventListener("keydown",e=>{if(e.key!=="Escape"||!RL.open||railCol()||e.defaultPrevented)return;   // a dialog over it (options sheet, Settings) closes first
    if(["sheet","setPane"].some(id=>$(id)&&$(id).classList.contains("on")))return;railOpen(false);});
  /* contracts, cash and the week move on clicks all over the game: refresh after any of them (one frame, cached) */
  document.addEventListener("click",railSched);
  const re=()=>{railSched();};RAIL_MQ.addEventListener?RAIL_MQ.addEventListener("change",re):RAIL_MQ.addListener(re);window.addEventListener("resize",re);
  new MutationObserver(re).observe(document.documentElement,{attributes:true,attributeFilter:["class","data-theme"]});
  railSched();})();
