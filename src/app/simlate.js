/* ===== SIM-LATE: event physics that comes after the garage (since 1.76.138.0) =====
   The races themselves for the events are not in index.html: build.js writes them to sim-late.js (the manifest lines marked
   "sim-late.js:", sim/<event>-run.js: the 24 Hours and the hill climbs since 1.76.138.0, drag, pull, bog, road, salt, boat and
   oval since 1.76.139.0; the tables the setup screens and the garage read stay in sim/<event>.js). simLateSoon() fetches it once
   the garage is up (boot.js start), first of the three background files because it is what an event screen waits on, and
   SIM.simLateRun runs it inside the physics closure (sim/tunemap.js). Until then SIM.simLateOk is false and those SIM functions
   are stand-ins that throw, so every way into those events checks first:
     - the event's setup screen (renderEnv, app/test.js) says "Loading the track…" and draws itself when the file lands;
     - the Run button says so in a toast (the setup screen already shows it);
     - a team race day (Race, Close week, the dev Skip week) and a Watch it replay say so in a toast and go ahead when the file
       lands, if that is within 8 s of the tap; only for a team in a series that needs it (SIMLATE_PC);
     - the swap section (Build) shows its road numbers as "—" and fills them in when it lands;
     - the 24 Hours lap chart leaves out the night shading and is drawn again when it lands.
   If the download fails the setup screen says so and offers Try again; installed copies have sim-late.js in the offline cache. */
const SIMLATE_EVTS=["race24","hill","drag","pull_sled","bog","road","salt","boat","oval"];   // events (S.env.testType) whose physics is in sim-late.js
const SIMLATE_PC=["hill","drag","oval","pull","bog","boat"];   // team series kinds (PC_EVENTS[].ev) whose race day and replay need it
const SIMLATE={st:0,t:0,retry:0,ask:null,chart:false};   // st: 0 idle, 1 fetching, 2 failed (try again), 3 broken (ran but did not finish)
function simNeeds(t){return !SIM.simLateOk&&SIMLATE_EVTS.includes(t);}
function simTeamNeeds(){return !SIM.simLateOk&&pcTeams().some(T=>PC_EVENTS[T.ev]&&SIMLATE_PC.includes(PC_EVENTS[T.ev].ev));}
/* the setup screen's stand-in while the file is on its way */
function simWaitHtml(){return `<p class="hint" id="simWait">Loading the track…</p>`;}
/* a tap that needs the file: say so, and make the call once it lands, if that is soon */
function simWait(fn,msg){if(SIM.simLateOk)return false;SIMLATE.ask={fn,t:Date.now()};toast(msg||"Loading the race…");simLateLoad(true);return true;}
function simLateDone(){
  if($("simWait"))renderEnv();
  if(typeof swapRender==="function")swapRender();   // the swap section's 0–100, top speed and quarter
  if(SIMLATE.chart){SIMLATE.chart=false;try{chartRedraw();}catch(e){console.error("[sim-late]",e);}}
  const a=SIMLATE.ask;SIMLATE.ask=null;if(a&&Date.now()-a.t<8000)try{a.fn();}catch(e){console.error("[sim-late]",e);}}
function simLateFail(stale){
  if(SIMLATE.ask){SIMLATE.ask=null;toast(stale?"The game was updated: reload to race":"Couldn't load the race. Check your connection.");}
  const w=$("simWait");if(!w)return;
  w.innerHTML=stale?`The game was updated while this page was open. <button class="btn sm" id="simReload">Reload</button>`:`Couldn't load the track. Check your connection. <button class="btn sm" id="simRetry">Try again</button>`;
  const r=$("simRetry"),u=$("simReload");
  if(r)r.addEventListener("click",()=>{w.textContent="Loading the track…";simLateLoad(true);});
  if(u)u.addEventListener("click",()=>location.reload());}
function simLateLoad(force){
  if(SIM.simLateOk||SIMLATE.st===1||SIMLATE.st===3||typeof fetch!=="function")return;
  if(SIMLATE.st===2&&!force&&performance.now()-SIMLATE.t<3000)return;
  SIMLATE.st=1;const url="sim-late.js?v="+VERSION,tag="/*pew-simlate "+VERSION+"*/";
  const get=fresh=>fetch(url,fresh?{cache:"reload"}:{}).then(r=>{if(!r.ok)throw new Error("sim-late.js "+r.status);return r.text();})
    .then(t=>{if(t.slice(0,tag.length)===tag)return t;if(!fresh)return get(true);const e=new Error("sim-late.js is from another version");e.stale=true;throw e;});
  get(false).then(t=>{
    try{SIM.simLateRun(t);}catch(e){SIMLATE.st=3;throw e;}
    SIMLATE.st=0;simLateDone();
  }).catch(e=>{if(SIMLATE.st!==3){SIMLATE.st=2;SIMLATE.t=performance.now();}console.error("[sim-late]",e);simLateFail(!!e.stale);
    if(SIMLATE.st===2&&!e.stale&&SIMLATE.retry++<2)setTimeout(()=>simLateLoad(),10000*SIMLATE.retry);});   // a background try: twice more, 10 s then 20 s later
}
/* boot.js start(): at once if the saved event needs it, else once the garage is up and the phone is idle */
function simLateSoon(){if(simNeeds(S.env.testType)){simLateLoad(true);return;}
  const go=()=>simLateLoad();setTimeout(()=>{if(window.requestIdleCallback)requestIdleCallback(go,{timeout:1000});else go();},200);}
window.addEventListener("online",()=>{if(!SIM.simLateOk&&SIMLATE.st===2)simLateLoad(true);});
