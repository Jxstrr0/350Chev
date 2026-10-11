/* ===================== SOUND & IDLE ===================== */
let soundReady=false;
/* one-shot sound events (start, fail, bov) only when sound is on: event("start") builds the graph and sets it running */
function sfx(n){if(soundReady&&S.sound)ENGINE_SOUND.event(n);}
function ensureSound(){try{ENGINE_SOUND.init();ENGINE_SOUND.setVolume(S.vol/100);soundReady=true;if(S.sound)ENGINE_SOUND.start();}catch(e){console.warn(e);}}
$("sndBtn").addEventListener("click",()=>{S.sound=!S.sound;ensureSound();if(S.sound){ENGINE_SOUND.start();setTimeout(applySoundQuality,50);}else{ENGINE_SOUND.stop();if(AB.playing)abStop();}$("sndBtn").classList.toggle("on",S.sound);save();toast(S.sound?"SOUND ON":"SOUND OFF");});
$("idleBtn").addEventListener("click",()=>{run.idle=!run.idle;$("idleBtn").classList.toggle("on",run.idle);if(run.idle){ensureSound();if(!S.sound){S.sound=true;$("sndBtn").classList.add("on");ENGINE_SOUND.start();}sfx("start");}});
let lastT=performance.now(),idleRpm=0,idleTarget=0,visRpm=0,visLoad=0,alsHot=0;
/* ---------- sound bench: hold two builds and switch between them ----------
   Differences in an engine note are almost impossible to judge from memory
   between taps, so the bench keeps both configs loaded and plays either one at
   a fixed rpm and throttle. It drives the sound directly and takes the picture
   with it, so what you see matches what you hear. */
const AB={A:null,B:null,playing:null,rpm:4000,load:1};
function abLabel(cfg){if(!cfg)return"empty";
  const r=SIM.simulate(cfg,simEnv({testType:"pull"}));
  return `${cfg.layout} ${(r.Vd/1000).toFixed(1)}L · ${Math.round(r.peakHp)}hp · ${OPT.asp[cfg.asp].name.split(" ")[0]}`;}
function abRender(){
  $("abAname").textContent=AB.A?abLabel(AB.A):"empty";
  $("abBname").textContent=AB.B?abLabel(AB.B):"empty";
  $("abA").classList.toggle("on",AB.playing==="A");
  $("abB").classList.toggle("on",AB.playing==="B");
  document.querySelectorAll("#abPlay button").forEach(b=>b.classList.toggle("on",b.dataset.abplay===AB.playing));
  $("v-abrpm").textContent=AB.rpm.toLocaleString()+" rpm";
  $("v-abload").textContent=Math.round(AB.load*100)+"%";
  $("abHint").textContent=AB.playing?`Playing ${AB.playing}. Tap the other one — the switch is instant.`
    :(AB.A&&AB.B)?"Both loaded. Tap Play A, then Play B.":"Capture a build into A, change something, capture it into B.";}
function abPlay(k){
  if(!AB[k]){toast("Capture a build into "+k+" first");return;}
  if(testing){toast("Wait for the run to finish");return;}
  if(!S.sound){S.sound=true;$("sndBtn").classList.add("on");}
  ensureSound();AB.playing=k;abRender();buzz(8);
}
function abStop(){AB.playing=null;abRender();}
$("abSec").addEventListener("click",e=>{
  if(e.target.closest("#abSec > .acch")){const f=$("abSec");advSet(f,!f.classList.contains("open"));buzz(4);return;}
  const cap=e.target.closest("[data-abcap]");if(cap){AB[cap.dataset.abcap]=Object.assign({},S.cfg);abRender();toast(`Captured into ${cap.dataset.abcap}`);buzz(10);return;}
  const ld=e.target.closest("[data-abload]");if(ld){const c=AB[ld.dataset.abload];if(!c){toast("That slot is empty");return;}if(testing){toast("Let the run finish first");return;}
    fuelFit(c);S.cfg=Object.assign({},c);S.profileId=null;resetBase();afterCfgChange(true);toast(`${ld.dataset.abload} loaded into the build`);return;}
  const pl=e.target.closest("[data-abplay]");if(pl){abPlay(pl.dataset.abplay);return;}
  if(e.target.closest("#abStop")){abStop();return;}
  const nr=e.target.closest("[data-abr]");if(nr){AB.rpm=Math.max(900,Math.min(9000,AB.rpm+ +nr.dataset.abr*250));$("abRpm").value=AB.rpm;abRender();return;}
  const nl=e.target.closest("[data-abl]");if(nl){AB.load=Math.max(0.1,Math.min(1,AB.load+ +nl.dataset.abl*0.05));$("abLoad").value=Math.round(AB.load*100);abRender();return;}
});
$("abSec").addEventListener("input",e=>{
  if(e.target.id==="abRpm"){AB.rpm=+e.target.value;abRender();}
  else if(e.target.id==="abLoad"){AB.load=+e.target.value/100;abRender();}});

/* diesel exhaust opacity at this rpm: the sim's smoke curve, scaled by how hard the pedal is down */
function dieselSmoke(q,rpm,load){
  const isD=SIM.isDiesel?SIM.isDiesel(S.cfg):!!(SIM.OPT.fuel[S.cfg.fuel]||{}).ci;
  if(!isD||!q||!q.smokeCurve||!q.rpms)return 0;
  const R=q.rpms,C=q.smokeCurve;let i=0;while(i<R.length-1&&R[i+1]<rpm)i++;
  const k=R[i+1]>R[i]?Math.min(1,Math.max(0,(rpm-R[i])/(R[i+1]-R[i]))):0,v=C[i]+((C[Math.min(i+1,C.length-1)]??C[i])-C[i])*k;
  return (v||0)*Math.min(1,load);
}
function tick(now){
  if(!ENGINE_VIS.frameDue(now)){requestAnimationFrame(tick);return;}
  const dt=Math.min(0.05,(now-lastT)/1000);lastT=now;
  const L=LAYOUTS[S.cfg.layout];
  let rpm=run.rpm,load=run.load,on=run.on;
  const rotP=isRot(S.cfg)?(SIM.OPT.rotPort[S.cfg.rotPort]||SIM.OPT.rotPort.side):null,camV=rotP?30+75*rotP.overlap:S.cfg.cam;   // a rotary's port overlap plays the part of a cam
  const tsIdle=!rotP&&isTs(S.cfg)&&quick&&quick.twoStroke?quick.twoStroke.idleRpm:0;
  if(!testing){const idleBase=rotP?rotP.idle:tsIdle?tsIdle:(SIM.isDiesel?SIM.isDiesel(S.cfg):!!(SIM.OPT.fuel[S.cfg.fuel]||{}).ci)?(S.cfg.bore*S.cfg.stroke>=9e3?650:700):S.cfg.cam>70?1300:S.cfg.cam>45?1000:800;idleTarget=run.idle?idleBase+Math.sin(now/300)*20*(1+camV/50)+(camV>65?Math.random()*60:0):0;idleRpm+=(idleTarget-idleRpm)*Math.min(1,dt*(run.idle?2.5:4));rpm=idleRpm;load=run.idle?0.08:0;on=idleRpm>150;}
  /* the picture follows the rpm with inertia: a test ending or a stall spins down instead of freezing */
  const tgt=on?rpm:0;visRpm+=(tgt-visRpm)*Math.min(1,dt*(tgt>visRpm?9:1.6));if(!on&&visRpm<60)visRpm=0;
  visLoad+=((on?load:0)-visLoad)*Math.min(1,dt*7);
  rpm=visRpm;load=visLoad;on=visRpm>40;
  /* anti-lag: fires on the lift after real load (end of a pull, the spin-down) — bangs in the sound, flame at the tip */
  let alsAct=0;{const a=alsOf(S.cfg);
    if(a&&testing&&DR&&DR.d&&S.env.testType==="drag")alsAct=DR.failed?0:DR.d.st.als||0;
    else if(a&&on){if(load>0.6&&rpm>0.45*S.cfg.redline)alsHot=1.4;else alsHot=Math.max(0,alsHot-dt);if(load<0.3&&rpm>Math.max(2200,0.35*S.cfg.redline)&&alsHot>0&&!run.fail)alsAct=a==="air"?1:0.8;}
    else alsHot=0;}
  if(ENGINE_VIS.als)ENGINE_VIS.als(alsAct);
  ENGINE_VIS.setRun({on,rpm,load,fail:run.fail,failKind:run.failKind,redline:S.cfg.redline,smooth:quick?quick.smooth:L.smooth,first:L.firstOrder,second:L.secondOrder,n:L.n,angle:L.angle,stroke:S.cfg.stroke,rodRatio:S.cfg.rodRatio,cam:camV,wear:quick&&wearInfo(quick)?wearInfo(quick).w:0,smoke:dieselSmoke(quick,rpm,load)});
  if(AB.playing&&AB[AB.playing]&&!testing){
    const c=AB[AB.playing],ev=simEnv({testType:"pull"}),ek=JSON.stringify(ev);
    if(!AB.sim||AB.sim.c!==c||AB.sim.ek!==ek)AB.sim={c,ek,r:SIM.simulate(c,ev)};   // one simulate per capture, not two per frame
    const r=AB.sim.r;
    if(soundReady&&S.sound){
      const rp=r.rpms,bc=r.boostCurve;
      let bb=0;
      if(c.asp!=="na"&&bc&&rp&&rp.length>1){
        const i=Math.min(rp.length-1,Math.max(0,Math.round((AB.rpm-rp[0])/Math.max(1,rp[1]-rp[0]))));
        bb=bc[i]*AB.load;
      }
      ENGINE_SOUND.set({rpm:AB.rpm,load:AB.load,cfg:c,layout:LAYOUTS[c.layout],boostBar:bb,
        knock:r.knock.retardDeg,profileId:undefined,diesel:(SIM.isDiesel?SIM.isDiesel(c):!!(SIM.OPT.fuel[c.fuel]||{}).ci),clatter:r.clatter||0});
    }
    const cl=LAYOUTS[c.layout];
    ENGINE_VIS.setRun({on:true,rpm:AB.rpm,load:AB.load,fail:null,failKind:null,redline:c.redline,
      smooth:r.smooth,first:cl.firstOrder,second:cl.secondOrder,n:cl.n,angle:cl.angle,
      stroke:c.stroke,rodRatio:c.rodRatio,cam:c.cam});
    requestAnimationFrame(tick);return;
  }
  if(soundReady&&S.sound){
    // use the boost curve the sim actually computed for this engine; fall back to
    // a spool proxy only if there is no curve yet
    let boostBar=0;
    if(S.cfg.asp!=="na"&&on){
      const bc=quick&&quick.boostCurve,rp=quick&&quick.rpms;
      if(bc&&rp&&bc.length===rp.length&&rp.length>1){
        const i=Math.min(rp.length-1,Math.max(0,Math.round((rpm-rp[0])/Math.max(1,rp[1]-rp[0]))));
        boostBar=bc[i]*load;
      }else{
        const pd=OPT.asp[S.cfg.asp]&&(OPT.asp[S.cfg.asp].kind==="roots"||OPT.asp[S.cfg.asp].kind==="screw");
        const lag=pd?900:1500;
        boostBar=S.cfg.boost*Math.min(1,Math.max(0,(rpm-lag)/Math.max(1,S.cfg.redline*(pd?0.12:0.45))))*load;
      }
    }
    const wi=quick?wearInfo(quick):null;let dx=null;
    if(testing&&DR&&DR.d&&S.env.testType==="drag"&&!DR.failed){const st=DR.d.st;boostBar=st.boost*(on?1:0);
      dx={twoStep:{on:!!st.launch.armed&&st.launch.twoStep,retard:st.launch.retard},pops:st.launch.pops,als:st.als||0,tyre:st.phase==="burnout"&&st.burning?1:st.spin&&st.phase==="run"?0.55:0};}
    if(testing&&HC&&HC.run&&!HC.finished&&S.env.testType==="hill"){const st=HC.run.st,q=HC.prep.pts[0];boostBar=(q.boost>0?q.boost*Math.min(1,st.thr+0.1):0)*(on?1:0);dx={tyre:st.off?0.5:st.latUse>0.97&&st.v>15?0.25:0};}   // the hillclimb: boost while it is on the throttle, tyre noise at the limit
    if(testing&&RT&&!RT.finished&&S.env.testType==="road"){boostBar=(RT.bst||0)*(on?1:0);dx={tyre:RT.slip||0};}   // the road test: boost and tyre noise from the lap trace
    if(testing&&SR&&SR.p&&S.env.testType==="salt"&&!SR.failed){const st=SR.p.st;dx={tyre:st.phase==="run"&&!st.done?Math.min(1,Math.max(0,(st.slip-0.08)*3)):st.phase==="spin"?0.8:0};}
    if(testing&&BR&&BR.p&&S.env.testType==="bog"&&!BR.failed){const st=BR.p.st;boostBar=st.boost*(on?1:0);dx={tyre:st.phase!=="stage"&&!st.done?Math.min(1,Math.max(0,(st.slip-0.08)*1.6))*(st.phase==="pit"?0.8:1):0};}   // the mud bog: boost from the run, tyre noise from the wheelspin
    if(testing&&PR&&PR.p&&S.env.testType==="pull_sled"&&!PR.failed){const st=PR.p.st;boostBar=st.boost*(on?1:0);dx={tyre:st.phase==="pull"&&!st.done?Math.min(1,Math.max(0,(st.slip-0.1)*1.5)):0};}   // the sled: load from the run, tyre noise from the slip
    ENGINE_SOUND.set(Object.assign({rpm:on?rpm:0,load,cfg:S.cfg,layout:L,boostBar,wear:wi?wi.w:0,als:alsAct,
      knock:quick?quick.knock.retardDeg:0,profileId:S.profileId||undefined,diesel:(SIM.isDiesel?SIM.isDiesel(S.cfg):!!(SIM.OPT.fuel[S.cfg.fuel]||{}).ci),clatter:(quick&&quick.clatter)||0},dx||{}));}
  requestAnimationFrame(tick);
}

/* ===================== TABS & BOOT ===================== */
let curTab="build";
/* each tab keeps its own place in the panel: a quick look at Market doesn't throw you back to the top of Build */
const tabScroll={};const calmScroll=()=>matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth";
function showTab(t){tabScroll[curTab]=$("panel").scrollTop;if(t!=="test"&&AB.playing)abStop();curTab=t;document.querySelectorAll("#tabs button").forEach(b=>b.classList.toggle("on",b.dataset.tab===t));document.querySelectorAll(".tabpage").forEach(p=>p.classList.toggle("on",p.id==="tab-"+t));
  if(t==="test"||t==="events"){evSync(t);renderTest();}else{pitsSync();evPickRender();}if(t==="analysis")renderAnalysis();if(t==="shop"||t==="market")renderShop();$("panel").scrollTop=tabScroll[t]||0;if(tourStep>=0)requestAnimationFrame(tourPlace);}
/* a run just finished: the verdict sits under the run button and the sound bench, often below the fold.
   If it isn't fully in sight, bring it up just under the sticky strip (if this tab has one) — bench only. */
function revealVerdict(){const pn=$("panel"),v=$("verdict").firstElementChild;if(ff||(curTab!=="test"&&curTab!=="events")||!v)return;
  const pr=pn.getBoundingClientRect(),vr=v.getBoundingClientRect(),st=document.querySelector(".tabpage.on .strip"),sc=st&&st.offsetParent&&getComputedStyle(st);
  const top=pr.top+pn.clientTop+(sc&&sc.position==="sticky"?parseFloat(getComputedStyle(pn).paddingTop)+(parseFloat(sc.top)||0)+st.offsetHeight:0)+8;
  const dk=$("runDock"),dr=dk&&dk.offsetParent?dk.getBoundingClientRect():null,bot=Math.min(pr.bottom,tabsTop(),dr&&dr.top>pr.top?dr.top:Infinity)-8;
  if(vr.top>=top&&vr.bottom<=bot)return;pn.scrollTo({top:pn.scrollTop+vr.top-top,behavior:calmScroll()});}
document.querySelectorAll("#tabs button").forEach(b=>b.addEventListener("click",()=>{const again=b.dataset.tab===curTab;showTab(b.dataset.tab);if(again)$("panel").scrollTo({top:0,behavior:calmScroll()});}));
/* engine view size: manual only. Nothing resizes it while you scroll — it stays where you put it,
   on every tab, across sessions. */
let miniView=false;
function setMini(m){miniView=!!m;$("app").classList.toggle("mini",miniView);$("sizeBtn").classList.toggle("on",miniView);if(!$("viewTray").hidden){viewTray(true);setTimeout(()=>{if(!$("viewTray").hidden)viewTray(true);},320);}}
$("sizeBtn").addEventListener("click",()=>{setMini(!miniView);S.viewMini=miniView;save();buzz(8);});
/* HUD toggles mirror their .on class into aria-pressed however they get flipped; START reads STOP
   while the engine idles, and VIEW wears a dot when anything in its tray is on */
function hudSync(){const on=id=>$(id).classList.contains("on");["sndBtn","sizeBtn","xrayBtn","heatBtn"].forEach(id=>$(id).setAttribute("aria-pressed",on(id)));
  const idling=on("idleBtn");$("idleBtn").querySelector(".lb").textContent=idling?"Stop":"Start";$("idleBtn").setAttribute("aria-label",idling?"Stop engine":"Start engine");
  $("viewBtn").classList.toggle("lit",on("sizeBtn")||on("xrayBtn")||on("heatBtn"));}
{const mo=new MutationObserver(hudSync);["sndBtn","idleBtn","sizeBtn","xrayBtn","heatBtn"].forEach(id=>mo.observe($(id),{attributes:true,attributeFilter:["class"]}));hudSync();}
/* VIEW tray: hangs under its button (fixed, so it can drop past a small view); outside tap or Escape closes it */
function viewTray(open){const t=$("viewTray"),b=$("viewBtn");open=open==null?t.hidden:!!open;t.hidden=!open;b.setAttribute("aria-expanded",open);b.classList.toggle("open",open);if(!open)return;
  const r=b.getBoundingClientRect(),a=$("app").getBoundingClientRect();t.style.top=Math.round(r.bottom+6)+"px";t.style.left=Math.round(Math.max(a.left+8,Math.min(r.left,a.right-t.offsetWidth-8)))+"px";}
$("viewBtn").addEventListener("click",()=>{viewTray();buzz(6);});
document.addEventListener("pointerdown",e=>{if(!$("viewTray").hidden&&!e.target.closest("#viewTray,#viewBtn"))viewTray(false);},true);
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("viewTray").hidden){viewTray(false);$("viewBtn").focus();}});
$("viewTray").addEventListener("focusout",e=>{if(e.relatedTarget&&!e.relatedTarget.closest("#viewTray,#viewBtn"))viewTray(false);});
window.addEventListener("resize",()=>{if(!$("viewTray").hidden)viewTray(true);});
if(window.ResizeObserver){let rt=null;new ResizeObserver(()=>{ENGINE_VIS.resize();clearTimeout(rt);rt=setTimeout(()=>{ENGINE_VIS.resize();ENGINE_VIS.reframe();},320);}).observe($("view"));}
/* ===================== DESKTOP: wide layout, keyboard, mouse ===================== */
/* Layout is "phone" (the portrait column) or "desktop" (the engine view fills the window, the panel is a sidebar).
   Picked on the intro or in Settings; a save that never picked gets the auto-detect once. Under 900 px wide the
   phone column comes back whatever was picked. */
const DESK_MIN=900;
const bigScreen=()=>Math.max(screen.width||0,screen.height||0,innerWidth)>=DESK_MIN;
function detectLayout(){const fine=matchMedia("(pointer: fine) and (hover: hover)").matches,touch=("ontouchstart" in window)||navigator.maxTouchPoints>0;
  return Math.max(screen.width||0,innerWidth)>=1024&&(fine||!touch)?"desktop":"phone";}
const deskOn=()=>document.documentElement.classList.contains("desk");
// graphics a desktop gets when the player never picked: Ultra on a real GPU with a big texture limit, Full otherwise
let gpuTier=null;
function deskGfx(){if(S.layoutMode!=="desktop")return null;if(gpuTier)return gpuTier;gpuTier="full";
  try{const g=document.createElement("canvas").getContext("webgl");if(g){const x=g.getExtension("WEBGL_debug_renderer_info"),rn=String(x?g.getParameter(x.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER));
    if(g.getParameter(g.MAX_TEXTURE_SIZE)>=16384&&(navigator.hardwareConcurrency||4)>=8&&(devicePixelRatio||1)<=2&&!/swiftshader|llvmpipe|softpipe|software|basic render|(hd|uhd) graphics( [0-9]{3,4})?$/i.test(rn))gpuTier="ultra";
    const lc=g.getExtension("WEBGL_lose_context");if(lc)lc.loseContext();}}catch(e){}
  return gpuTier;}
function applyLayout(fromResize){const want=S.layoutMode==="desktop"&&innerWidth>=DESK_MIN,was=deskOn();document.documentElement.classList.toggle("desk",want);
  document.querySelectorAll("[data-lay]").forEach(b=>b.classList.toggle("on",b.dataset.lay===(S.layoutMode||"phone")));
  $("layBox").hidden=!bigScreen()&&S.layoutMode!=="desktop";$("introLay").hidden=!bigScreen();
  if(S.sbw)document.documentElement.style.setProperty("--sbw-user",S.sbw+"px");else document.documentElement.style.removeProperty("--sbw-user");
  if(want!==was){tipHide();if(!$("viewTray").hidden)viewTray(false);if(!fromResize)window.dispatchEvent(new Event("resize"));}}
function setLayout(m){if(S.layoutMode===m)return;S.layoutMode=m;applyLayout();applyGfx();applySoundQuality();save();
  if(m==="desktop"&&innerWidth<DESK_MIN)toast("Desktop layout needs a window 900 px wide");}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-lay]");if(b){setLayout(b.dataset.lay);buzz(6);}});
window.addEventListener("resize",()=>applyLayout(true));
// panel bottom edge: on the phone the tab bar covers the panel's foot, on desktop the tabs sit on top
function tabsTop(){return deskOn()?$("panel").getBoundingClientRect().bottom:$("tabs").getBoundingClientRect().top;}
// tour and First Fire cards on a wide screen: a 400 px card beside its target instead of a full-width strip
function deskBox(box,r){if(!deskOn()){box.style.left=box.style.right="";return;}
  const a=$("app").getBoundingClientRect(),w=box.offsetWidth||400,h=box.offsetHeight||160;box.style.right="auto";
  if(!r){box.style.left=Math.round((a.width-$("panel").offsetWidth-w)/2)+"px";return;}
  const sb=$("panel").getBoundingClientRect().left-a.left,cl=(v,lo,hi)=>Math.round(Math.max(lo,Math.min(hi,v)));let top,left;
  if(r.left-a.left>=sb-2){top=cl(r.top-a.top,12,a.height-h-12);left=sb-w-24;}   // a sidebar target: the card waits beside the sidebar
  else{top=r.bottom-a.top+14;if(r.height>a.height*0.5)top=Math.min(r.bottom,a.bottom)-a.top-h-24;else if(top+h>a.height-12)top=Math.max(12,r.top-a.top-h-14);left=r.left-a.left+r.width/2-w/2;}
  box.style.top=Math.round(top)+"px";box.style.bottom="auto";box.style.left=cl(left,12,a.width-w-12)+"px";}
// sidebar width: drag its edge, double-click to put it back
(()=>{const g=document.createElement("div");g.id="sbGrip";g.dataset.tip="Drag to resize the sidebar · double-click to reset";$("app").appendChild(g);let on=false;
  g.addEventListener("pointerdown",e=>{e.preventDefault();try{g.setPointerCapture(e.pointerId);}catch(x){}on=true;g.classList.add("on");tipHide();});
  g.addEventListener("pointermove",e=>{if(!on)return;S.sbw=Math.round(Math.max(360,Math.min(innerWidth*0.6,innerWidth-e.clientX)));document.documentElement.style.setProperty("--sbw-user",S.sbw+"px");});
  const end=()=>{if(!on)return;on=false;g.classList.remove("on");save();window.dispatchEvent(new Event("resize"));};
  g.addEventListener("pointerup",end);g.addEventListener("pointercancel",end);
  g.addEventListener("dblclick",()=>{S.sbw=null;applyLayout(true);save();window.dispatchEvent(new Event("resize"));});})();
/* tooltips for the mouse: part options say what they are, HUD buttons and tabs say their key */
const tipEl=document.createElement("div");tipEl.id="tip";tipEl.setAttribute("role","tooltip");document.body.appendChild(tipEl);
let tipT=null,tipOn=null;
function tipHide(){clearTimeout(tipT);tipT=null;tipOn=null;tipEl.classList.remove("on");}
const TAB_KEYS=["build","test","events","analysis","market","shop"];
const KEY_TIP={sndBtn:"Engine sound on / off <kbd>S</kbd>",idleBtn:"Start or stop the idle <kbd>I</kbd>",viewBtn:"Size, X-ray, heat map <kbd>V</kbd>",runTest:"Run the test <kbd>R</kbd>",
  dragBtn:"Hold the button or <kbd>Space</kbd>",pullBtn:"Hold the button or <kbd>Space</kbd> for throttle",gl:"Drag to orbit · right-drag to pan · wheel to zoom · double-click to reframe",kbHelpBtn:"Or press <kbd>?</kbd>"};
function tipText(el){if(el.dataset.tip)return el.dataset.tip;if(KEY_TIP[el.id])return KEY_TIP[el.id];
  if(el.matches("#tabs button")){const i=TAB_KEYS.indexOf(el.dataset.tab);return i<0?"":`${el.textContent.trim()} <kbd>${i+1}</kbd>`;}
  if(el.matches("#buildForm .seg button[data-k][data-v]")){const f=sliderField(el.dataset.k),o=f&&(OPT[f.optTable||f.key]||{})[el.dataset.v];if(!o)return "";
    return `<b>${o.name}</b>${o.cost?` · $${o.cost.toLocaleString("en-CA")}`:""}${o.info?"<br>"+o.info:o.sub?"<br>"+o.sub:""}${el.dataset.req?`<br><b>Needs ${el.dataset.req}</b>`:""}`;}
  if(el.matches(".lbl .q"))return "Every option side by side";
  if(el.matches(".nud"))return "Hold to repeat";
  if(el.matches("input[type=range]"))return "Click it, then <kbd>←</kbd><kbd>→</kbd> or the wheel to nudge";
  if(el.matches("b.tap"))return "Click to type a value";
  return "";}
document.addEventListener("pointerover",e=>{if(e.pointerType!=="mouse")return;const el=e.target.closest&&e.target.closest("[data-tip],#sndBtn,#idleBtn,#viewBtn,#runTest,#dragBtn,#pullBtn,#gl,#kbHelpBtn,#tabs button,#buildForm .seg button,.lbl .q,.nud,input[type=range],b.tap");
  if(el===tipOn)return;tipHide();if(!el)return;tipOn=el;
  tipT=setTimeout(()=>{if(tipOn!==el||!el.isConnected)return;const t=tipText(el);if(!t)return;tipEl.innerHTML=t;const r=el.getBoundingClientRect(),w=tipEl.offsetWidth,h=tipEl.offsetHeight;
    const top=r.bottom+8+h<innerHeight?r.bottom+8:r.top-8-h;tipEl.style.left=Math.round(Math.max(8,Math.min(innerWidth-w-8,el.id==="gl"?e.clientX-w/2:r.left+r.width/2-w/2)))+"px";tipEl.style.top=Math.round(el.id==="gl"?e.clientY+18:top)+"px";tipEl.classList.add("on");},el.id==="gl"?1200:450);});
["pointerdown","wheel","keydown"].forEach(ev=>document.addEventListener(ev,tipHide,{capture:true,passive:true}));document.addEventListener("scroll",tipHide,true);
document.addEventListener("pointerout",e=>{if(tipOn&&(!e.relatedTarget||!tipOn.contains(e.relatedTarget)))tipHide();});
/* sliders: the arrow keys and the wheel nudge the slider you last touched, by its own nudge step, through the same
   path the ± buttons use. The wheel only takes a slider you clicked and are still pointing at, so it never
   steals the panel's scroll. */
let kbSlider=null,wheelArm=null,kbCommit=null,wheelAcc=0;
function nudgeSlider(r,dir){if(!r||r.disabled||!r.isConnected)return false;const later=fn=>{clearTimeout(kbCommit);kbCommit=setTimeout(fn,450);};
  if(r.dataset.k&&$("buildForm").contains(r)){const k=r.dataset.k,f=sliderField(k);if(!f)return false;const nv=snapVal(f,S.cfg[k]+dir*(f.nudge||f.step||1));if(nv!==S.cfg[k]){holdBase(k);autoFocus(k);applySlider(k,nv,r);buzz(3);later(commitSlider);}return true;}
  if(r.dataset.e&&$("envBox").contains(r)){const k=r.dataset.e;applyEnv(k,envStore(k)[k]+dir*(parseFloat(r.step)||1));later(commitEnv);return true;}
  const v=r.value;if(dir>0)r.stepUp();else r.stepDown();if(r.value!==v){r.dispatchEvent(new Event("input",{bubbles:true}));later(()=>r.dispatchEvent(new Event("change",{bubbles:true})));}return true;}
document.addEventListener("pointerdown",e=>{const t=e.target.closest?e.target:null;if(!t)return;const r=t.closest("input[type=range]"),n=t.closest(".srow .nud");
  wheelArm=r;if(r)kbSlider=r;else if(n)kbSlider=n.parentElement.querySelector("input[type=range]");},true);
document.addEventListener("pointerout",e=>{if(wheelArm&&e.target===wheelArm)wheelArm=null;},true);
document.addEventListener("wheel",e=>{const r=e.target;if(!wheelArm||r!==wheelArm)return;e.preventDefault();wheelAcc+=e.deltaY||e.deltaX;if(Math.abs(wheelAcc)<40)return;nudgeSlider(r,wheelAcc<0?1:-1);wheelAcc=0;},{passive:false});
/* keyboard, alongside touch and mouse: Space is the hold button on the strip and the sled */
function kbHelp(){if($("sheet").classList.contains("on")&&$("sheetBody").querySelector(".kbd")){closeSheet();return;}
  const K=(k,t)=>`<kbd>${k}</kbd><span>${t}</span>`;$("sheetTitle").textContent="Keyboard & mouse";
  $("sheetBody").innerHTML=`<div class="kbd"><h3>Driving</h3>${K("Space","hold: burnout, stage, two-step, launch on green, shift · truck pull throttle")}${K("P","hold: nitrous purge on the line · elsewhere a puff from the purge nozzle")}${K("K","truck pull: the kill switch when a diesel runs away")}
    <h3>Engine</h3>${K("I / E","start or stop the idle")}${K("S","engine sound on / off")}${K("R","run the test or the event (Test and Events tabs)")}${K("V","view options")}
    <h3>Panel</h3>${K("1 – 6","Build · Test · Events · Analysis · Market · Shop")}${K("← →","nudge the slider you last touched")}${K("Esc","close this, a sheet or the view tray")}${K("G","the glossary")}${K("?","this list")}
    <h3>Mouse</h3>${K("Drag","orbit the engine")}${K("Right-drag","pan (or Shift + drag)")}${K("Wheel","zoom · on a slider you clicked, nudge it")}${K("Double-click","reframe the engine")}${K("Sidebar edge","drag to resize, double-click to reset")}</div>`;
  $("sheet").classList.add("on");$("scrim").classList.add("on");$("sheetClose").focus({preventScroll:true});}
$("kbHelpBtn").addEventListener("click",kbHelp);
const typingIn=el=>!!el&&(el.isContentEditable||/^(TEXTAREA|SELECT)$/.test(el.tagName)||(el.tagName==="INPUT"&&el.type!=="range"));
function holdKind(){if(DR&&DR.d&&$("dragCtl").style.display!=="none")return "drag";if(SR&&!SR.finished&&$("saltCtl").style.display!=="none")return "salt";if(BR&&!BR.finished&&$("bogCtl").style.display!=="none")return "bog";if(PR&&!PR.finished&&$("pullCtl").style.display!=="none")return "pull";if(RT&&!RT.finished&&$("roadCtl").style.display!=="none")return "road";if(HC&&!HC.finished&&$("hillCtl").style.display!=="none")return "hill";return null;}
let spaceHeld=null;
function spaceUp(cancel){const k=spaceHeld;spaceHeld=null;if(k==="drag"&&DR){DR.lastPtr=performance.now();dragRelease(!!cancel);}else if(k==="pull"&&PR){PR.lastPtr=performance.now();pullRelease();}else if(k==="salt"&&SR){SR.lastPtr=performance.now();saltRelease();}else if(k==="bog"&&BR){BR.lastPtr=performance.now();bogRelease();}else if(k==="hill"&&HC){HC.lastPtr=performance.now();hillRelease("push");}}
document.addEventListener("keydown",e=>{if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||typingIn(e.target))return;const k=e.key;
  if(k===" "||k==="Spacebar"){const h=holdKind();if(!h)return;e.preventDefault();if(e.repeat||spaceHeld)return;spaceHeld=h;
    if(h==="road"){roadSkip();return;}
    if(h==="hill"){HC.lastPtr=performance.now();hillPress("push");return;}
    if(h==="drag"){DR.lastPtr=performance.now();dragPress();}else if(h==="salt"){SR.lastPtr=performance.now();saltPress();}else if(h==="bog"){BR.lastPtr=performance.now();bogPress();}else{PR.lastPtr=performance.now();pullPress();}return;}
  if($("intro").style.display!=="none")return;
  if(k==="Escape"){if($("sheet").classList.contains("on")){closeSheet();e.preventDefault();}return;}
  if(k==="ArrowLeft"||k==="ArrowRight"){const a=document.activeElement,r=a&&a.matches&&a.matches("input[type=range]")?a:kbSlider&&kbSlider.offsetParent?kbSlider:null;if(r&&nudgeSlider(r,k==="ArrowRight"?1:-1))e.preventDefault();return;}
  if(e.repeat)return;
  if(k==="?"){kbHelp();e.preventDefault();return;}
  const lk=k.toLowerCase();
  if(lk==="k"&&pullKill()){e.preventDefault();}
  else if(/^[1-6]$/.test(k)){const b=document.querySelector(`#tabs [data-tab="${TAB_KEYS[+k-1]}"]`);if(b){b.click();e.preventDefault();}}
  else if(lk==="s")$("sndBtn").click();
  else if(lk==="i"||lk==="e")$("idleBtn").click();
  else if(lk==="v")$("viewBtn").click();
  else if(lk==="g")glBrowse();
  else if(lk==="r"&&(curTab==="test"||curTab==="events")&&!testing&&!$("runTest").disabled)$("runTest").click();});
document.addEventListener("keyup",e=>{if((e.key===" "||e.key==="Spacebar")&&spaceHeld){e.preventDefault();spaceUp(false);}});
window.addEventListener("blur",()=>{if(spaceHeld)spaceUp(true);});
let visReady=false;
function boot(){
  if(!S.mode)S.mode="sandbox";
  if(S.layoutMode==null)S.layoutMode=detectLayout();applyLayout(true);
  for(const k in tabScroll)delete tabScroll[k];$("panel").scrollTop=0; // new shop, new pages: every tab starts at the top
  if(!visReady){ENGINE_VIS.init($("gl"));visReady=true;requestAnimationFrame(tick);}
  ENGINE_VIS.buildGarage(garageOwned());ENGINE_VIS.buildEngine(S.cfg,LAYOUTS[S.cfg.layout]);
  applyFps();
  /* Test / Events picks: an older save only has S.env.testType, so it seeds whichever tab owns it */
  if(!EV_T.includes(S.evPick))S.evPick=EV_T.includes(S.env.testType)?S.env.testType:"drag";
  if(!DYNO_T.includes(S.testPick))S.testPick=DYNO_T.includes(S.env.testType)?S.env.testType:"pull";
  advSet($("abSec"),!!(S.advOpen&&S.advOpen.ab));
  document.querySelectorAll("#testType button").forEach(x=>x.classList.toggle("on",x.dataset.t===S.env.testType));
  $("sndBtn").classList.toggle("on",!!S.sound);
  if(S.psi)psiWalk(document.body,true);applyTheme();applySoundQuality();applySoundSrc();applyGfx();applyXray();applyCam();applyNight();setMini(!!S.viewMini);syncShop();recompute();applyHeat();hud();renderPresets();renderBuild();if(career())refillContracts();spLivery();showTab(curTab);glApply();ddBar();
  $("intro").style.display=S.seen?"none":"flex";
  if(S.seen)achCheck({type:"retro"});achRefresh();
}
function start(hot){
  load();
  if(hot&&hot.S){Object.assign(S,hot.S);curTab=hot.tab||"build";}
  boot();
  window.claude?.hot?.snapshot?.(()=>({S:Object.assign({},S,{last:null,base:S.base}),tab:curTab}));
  window.addEventListener("resize",()=>{ENGINE_VIS.resize();if(curTab==="test")drawChart(lastForChart(),null);else if(curTab==="events")chartRedraw();});
  setTimeout(()=>lsrWarm(),2500);   // perf: the salt class records for this build, while idle
}
window.claude?.hot?.ready?window.claude.hot.ready(start):start(window.claude?.hot?.data??{});

</script>
