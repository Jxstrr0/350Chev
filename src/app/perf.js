/* ===================== AUTO-ADJUST GRAPHICS (v1.71) =====================
   S.gfxAuto (on unless false): once the scene has settled, watch the frame rate ENGINE_VIS already measures. If it
   stays under ~27 fps for ~8 s (a 30 Hz power-saver screen doesn't count), step ONE tier down (ultra>full>lite) and say
   so. It never steps up. A manual tier pick after an auto-drop is respected for the rest of the session.
   Skipped while the tab is hidden, before the first ~6 s, for 3 s after a tier / tab change, and whenever the view isn't
   drawing. Automated browsers (navigator.webdriver) are left alone unless PERF.force is set (test hook: PERF.force=12). */
const PERF={T:["lite","full","ultra"],LOW:27,NEED:8000,SETTLE:6000,HOLD:3000,boot:performance.now(),f:null,fAt:0,sAt:0,low:0,tier:null,tab:null,holdTo:0,dropped:false,manual:false,force:null};
function perfTier(){return S.gfx||deskGfx()||(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)?"lite":"full");}
function perfReset(hold){PERF.low=0;PERF.sAt=0;if(hold)PERF.holdTo=performance.now()+PERF.HOLD;}
function perfUi(){const on=!S||S.gfxAuto!==false;document.querySelectorAll("#gfxAutoSeg button").forEach(b=>b.classList.toggle("on",(b.dataset.gauto==="1")===on));}
function perfPoll(){
  if(!S||typeof ENGINE_VIS==="undefined")return;
  perfUi();
  const now=performance.now();
  if(S.gfxAuto===false||(PERF.dropped&&PERF.manual)||document.hidden||now-PERF.boot<PERF.SETTLE){perfReset(true);return;}
  if(navigator.webdriver&&PERF.force==null)return;
  const tier=perfTier();if(tier!==PERF.tier){PERF.tier=tier;perfReset(true);}
  if(curTab!==PERF.tab){PERF.tab=curTab;perfReset(true);}
  if(now<PERF.holdTo)return;
  const f=ENGINE_VIS.fps();let fps;
  if(PERF.force!=null){fps=PERF.force;if(!PERF.sAt){PERF.sAt=now;return;}}
  else if(f!==PERF.f){PERF.f=f;PERF.fAt=now;fps=f.fps;if(!PERF.sAt){PERF.sAt=now;return;}}
  else{if(now-PERF.fAt>1500)perfReset(false);return;}          // nothing drawn lately (view off-screen / paused): start over
  const el=Math.min(now-PERF.sAt,1000);PERF.sAt=now;
  if(fps>0&&fps<PERF.LOW)PERF.low+=el;else PERF.low=Math.max(0,PERF.low-2*el);
  if(PERF.low<PERF.NEED)return;
  PERF.low=0;const i=PERF.T.indexOf(tier);if(i<1)return;     // already Lite: nothing lower to give
  const n=PERF.T[i-1];PERF.dropped=true;S.gfx=n;applyGfx();save();perfReset(true);
  toast(`Graphics lowered to ${n[0].toUpperCase()+n.slice(1)} to keep things smooth — change in Settings`);}
setInterval(perfPoll,500);
$("gfxSeg").addEventListener("click",e=>{if(e.target.closest("[data-gfx]")){PERF.manual=true;perfReset(true);}});
$("gfxAutoSeg").addEventListener("click",e=>{const b=e.target.closest("[data-gauto]");if(!b)return;S.gfxAuto=b.dataset.gauto==="1";PERF.dropped=PERF.manual=false;perfReset(true);perfUi();save();
  toast(S.gfxAuto?"AUTO-ADJUST ON · lowers graphics if it stutters":"AUTO-ADJUST OFF");});
