/* ===== APP-LATE: the second background file (since 1.76.136.0) =====
   Code the garage does not need at first paint is not in index.html. build.js writes it to app-late.js (the manifest lines marked
   "app-late.js:"; so far the trophy room, photo mode and the build sheet (app/trophy.js, app/photo.js, since 1.76.137.0) and the
   glossary, tap-to-explain and the 17 lessons (app/glossary.js), since 1.76.140.0 the drag run (app/drag-run.js), and since 1.76.141.0 the pull, bog, salt, boat and hill runs), and lateSoon() fetches it once the garage
   is up (boot.js start), just ahead of scenes.js. It runs as a classic <script>, so it sees every top-level name of the page and its
   functions become page globals, exactly as if it were still in the page.
   LATE_FNS: the late functions the page calls. Until the file has run, each is a stand-in (lateStub):
     - a background call ("") is remembered, every one in order, and made for real the moment the file lands (glApply at boot
       underlines the terms; tropHook logs a trophy won on a run that finished first);
     - a call that opens a sheet (a title: Glossary, Lessons) opens it at once with a "Loading…" line, and the real one fills it in when
       the file lands, unless the player has closed the sheet by then. If the download fails the sheet says so and offers Try again;
     - a call that opens a screen ("toast:" + words: the trophy room) says so in a toast and opens it when the file lands, if that is
       within 8 s of the tap. If the download fails a toast says so.
   build.js stops if the page uses any other app-late.js name without a typeof guard, or if a name is declared on both sides.
   Installed copies have app-late.js in the offline cache (sw.js precaches it). */
/* the drag run (app/drag-run.js, since 1.76.140.0): the setup screen waits for this file too (simNeeds in app/simlate.js), so dragStart,
   dragPress, dragRelease and shareSlip are only reached early by a stray tap; rnRunBtn is only called once simNeeds("drag") is false.
   The same goes for the pull, bog, salt, boat and hill runs (app/<event>-run.js, since 1.76.141.0): Start, Press and Release toast,
   Redraw (a result drawn at boot) waits for the file, and the Run button's words (pullRunBtn, boatRunBtn) come from evRunBtn */
const LATE_FNS={glApply:"",tropHook:"",glBrowse:"Glossary",lsMenu:"Lessons",tropOpen:"toast:Opening the trophy room…",dragStart:"toast:Loading the race…",dragPress:"toast:Loading the race…",dragRelease:"toast:Loading the race…",shareSlip:"toast:Loading the slip…",rnRunBtn:"",pullStart:"toast:Loading the race…",pullPress:"toast:Loading the race…",pullRelease:"toast:Loading the race…",pullRedraw:"",bogStart:"toast:Loading the race…",bogPress:"toast:Loading the race…",bogRelease:"toast:Loading the race…",bogRedraw:"",saltStart:"toast:Loading the race…",saltPress:"toast:Loading the race…",saltRelease:"toast:Loading the race…",saltRedraw:"",boatStart:"toast:Loading the race…",boatPress:"toast:Loading the race…",boatRelease:"toast:Loading the race…",boatRedraw:"",hillStart:"toast:Loading the race…",hillPress:"toast:Loading the race…",hillRelease:"toast:Loading the race…",hillRedraw:"",pullRunBtn:"",boatRunBtn:""};
const LATE={ok:false,st:0,t:0,q:[],ask:null,stubs:{},retry:0};   // st: 0 idle, 1 fetching, 2 failed (try again), 3 broken (ran but did not finish)
function lateStub(n,how){const toast1=how.startsWith("toast:")?how.slice(6):"";
  return (...a)=>{if(!how){LATE.q.push([n,a]);lateLoad(false);return;}
    LATE.ask={n,a,t:Date.now(),toast:!!toast1};if(toast1)toast(toast1);else lateWait(how);lateLoad(true);};}
Object.keys(LATE_FNS).forEach(n=>{LATE.stubs[n]=window[n]=lateStub(n,LATE_FNS[n]);});
function lateWait(title){$("sheetTitle").textContent=title;$("sheetBody").innerHTML=`<p class="hint" id="lateWait" style="margin-top:0">Loading…</p>`;
  $("sheet").classList.add("on");$("scrim").classList.add("on");}
function lateFail(stale){if($("simWait")&&LATE_EVTS.includes(S.env.testType))simLateFail(stale);   // an event screen waiting on this file
  if(LATE.ask&&LATE.ask.toast){LATE.ask=null;toast(stale?"The game was updated: reload to open this":"Couldn't load that. Check your connection.");return;}
  const w=$("lateWait");if(!w)return;
  w.innerHTML=stale?`The game was updated while this page was open. <button class="btn sm" id="lateReload">Reload</button>`:`Couldn't load this. Check your connection. <button class="btn sm" id="lateRetry">Try again</button>`;
  const r=$("lateRetry"),u=$("lateReload");
  if(r)r.addEventListener("click",()=>{w.textContent="Loading…";lateLoad(true);});
  if(u)u.addEventListener("click",()=>location.reload());}
/* the real functions are in: make the remembered calls, then fill the sheet that is still waiting */
function lateCall(n,a){const f=window[n];if(typeof f!=="function"||f===LATE.stubs[n])return;try{f(...a);}catch(e){console.error("[late]",n,e);}}
function lateFlush(){const q=LATE.q;LATE.q=[];for(const [n,a] of q)lateCall(n,a);
  const w=LATE.ask;LATE.ask=null;if(!w)return;
  if(w.toast?Date.now()-w.t<8000:$("lateWait")&&$("sheet").classList.contains("on"))lateCall(w.n,w.a);}
function lateLoad(force){
  if(LATE.ok||LATE.st===1||LATE.st===3||typeof fetch!=="function")return;
  if(LATE.st===2&&!force&&performance.now()-LATE.t<3000)return;
  LATE.st=1;const url="app-late.js?v="+VERSION,tag="/*pew-late "+VERSION+"*/";
  const get=fresh=>fetch(url,fresh?{cache:"reload"}:{}).then(r=>{if(!r.ok)throw new Error("app-late.js "+r.status);return r.text();})
    .then(t=>{if(t.slice(0,tag.length)===tag)return t;if(!fresh)return get(true);const e=new Error("app-late.js is from another version");e.stale=true;throw e;});
  get(false).then(t=>{
    const s=document.createElement("script");s.text=t;window.__pewLate=0;document.head.appendChild(s);s.remove();   // runs here and now; a classic script, so its names join the page's
    if(!window.__pewLate){LATE.st=3;throw new Error("app-late.js stopped part way (see the error above)");}
    LATE.ok=true;LATE.st=0;lateFlush();if(typeof simLateDone==="function")simLateDone(true);   // an event screen waiting on this file (app/simlate.js)
  }).catch(e=>{if(LATE.st!==3){LATE.st=2;LATE.t=performance.now();}console.error("[late]",e);lateFail(!!e.stale);
    if(LATE.st===2&&!e.stale&&LATE.retry++<2)setTimeout(()=>lateLoad(),10000*LATE.retry);});   // a background try: twice more, 10 s then 20 s later
}
/* boot.js start(): once the garage is up, while the phone is idle */
function lateSoon(){const go=()=>lateLoad();setTimeout(()=>{if(window.requestIdleCallback)requestIdleCallback(go,{timeout:1500});else go();},300);}
window.addEventListener("online",()=>{if(!LATE.ok&&LATE.st===2)lateLoad(true);});
/* the buttons that open the late code (Settings › Help, Records): wired here so they work, or say "Loading…", before it lands */
$("glSeg").addEventListener("click",e=>{const b=e.target.closest("[data-gl]");if(!b)return;S.gloss=b.dataset.gl==="1";save();
  document.querySelectorAll("#glSeg button").forEach(x=>x.classList.toggle("on",x===b));glApply();});
$("glOpen").addEventListener("click",()=>glBrowse());
$("lessonsOpen").addEventListener("click",()=>lsMenu());
document.addEventListener("click",e=>{const o=e.target.closest&&e.target.closest("[data-trophy]");if(o){e.preventDefault();tropOpen();}});   // Trophy room (Records, Shop)
