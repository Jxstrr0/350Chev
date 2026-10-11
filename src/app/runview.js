/* ===================== RUN VIEW: the big 3D view during every event =====================
   html.onevent is on while an event scene is up (#app.onstrip: drag, pull, salt, mud bog, road test, 24 Hours, through the
   after-run beat) and the Events tab is showing; teardown (#app.td) or another tab takes it off and everything comes back.
   Under it the header and SOUND/START/VIEW fold away and the view grows (CSS). For every event but the strip (which has
   its own #stripHud), the live card (#pullLive, #saltLive, #bogLive, #roadLive, #e24Hud) moves from its control block into
   #evHud on the view's bottom edge (html.evhud) and goes home when the run view ends. The band it covers goes to the scene
   cameras through ENGINE_VIS.setBand. All driven by observers: no event's start / finish code needs to know. */
const RV_LIVE=[["dragCtl",null],["pullCtl","pullLive"],["saltCtl","saltLive"],["bogCtl","bogLive"],["roadCtl","roadLive"],["e24Ctl","e24Hud"]];
const RV={live:null,home:null,band:-1,h:-1,raf:0};
/* an event scene owns the 3D view (also the race-night pits): no "drag to orbit" over it */
function evScene(){const a=$("app"),d=document.documentElement.classList;return a.classList.contains("onstrip")||a.classList.contains("pits")||d.contains("onstrip")||d.contains("onevent");}
function rvActive(){const a=$("app").classList,t=$("tab-events");return a.contains("onstrip")&&!a.contains("td")&&!!t&&t.classList.contains("on");}
function rvHost(){let h=$("evHud");if(!h){h=document.createElement("div");h.id="evHud";h.hidden=true;$("view").appendChild(h);}return h;}
function rvHome(){const L=RV.live;if(!L)return;const ph=RV.home;if(ph&&ph.parentNode)ph.parentNode.replaceChild(L,ph);RV.live=null;RV.home=null;}
function rvSync(){const on=rvActive(),de=document.documentElement;
  if(de.classList.contains("onevent")!==on){de.classList.toggle("onevent",on);if(on&&typeof tipHide==="function")tipHide();}   // a "drag to orbit" tip left up from before the run goes
  /* the card of the control block that is showing; after the run its block hides but the card stays up with the final numbers until the scene goes */
  let want=null;if(on){const c=RV_LIVE.find(([c])=>{const e=$(c);return e&&e.style.display!=="none";});want=c?(c[1]?$(c[1]):null):RV.live;}   // the strip brings its own HUD
  if(want!==RV.live){rvHome();
    if(want){const ph=document.createComment("evHud");want.parentNode.insertBefore(ph,want);RV.home=ph;RV.live=want;rvHost().appendChild(want);}}
  const host=$("evHud");if(host)host.hidden=!RV.live;de.classList.toggle("evhud",!!RV.live);
  if(host)host.dataset.ev=RV.live?RV.live.id:"";
  rvBandSoon();}
/* the band: from the view's bottom edge up to the top of whatever covers its middle (the overlay; on desktop the slim dock too) */
function rvBandSoon(){if(!RV.raf)RV.raf=requestAnimationFrame(rvBand);}
function rvBand(){RV.raf=0;if(!ENGINE_VIS.setBand)return;const v=$("view"),vr=v.getBoundingClientRect();let px=0;
  if(RV.live&&vr.height>0){const cx0=vr.left+vr.width*0.3,cx1=vr.right-vr.width*0.3;
    [$("evHud")].concat(RV_LIVE.map(([c])=>$(c))).forEach(e=>{if(!e||e.hidden||e.style.display==="none")return;const r=e.getBoundingClientRect();
      if(!r.height||r.right<cx0||r.left>cx1||r.top>=vr.bottom||r.bottom<vr.top+vr.height*0.5)return;px=Math.max(px,vr.bottom-r.top);});}
  px=Math.round(px);const h=Math.round(vr.height);if(px!==RV.band||h!==RV.h){RV.band=px;RV.h=h;ENGINE_VIS.setBand(px,h);}}
(()=>{if(!window.MutationObserver)return;const mo=new MutationObserver(rvSync);
  mo.observe($("app"),{attributes:true,attributeFilter:["class"]});
  ["tab-events"].concat(RV_LIVE.map(([c])=>c)).forEach(id=>{const e=$(id);if(e)mo.observe(e,{attributes:true,attributeFilter:["class","style"]});});
  if(window.ResizeObserver){const ro=new ResizeObserver(rvBandSoon);ro.observe($("view"));ro.observe(rvHost());RV_LIVE.forEach(([c])=>{const e=$(c);if(e)ro.observe(e);});}
  rvSync();})();
