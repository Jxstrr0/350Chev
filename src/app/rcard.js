/* ===================== RESULTS CARD (UI-GLASS-PLAN PR 4) =====================
   After a run the player drives (a dyno test or an event), a full-screen glass card shows the headline: the hero number,
   the verdict chip, the change from the last run of the same test, and on the dyno the curve over a faint ghost of the
   previous pull (or the pinned baseline). Team race days and Close week never set `testing`, so they never arm it.
   A trophy won on the run shows as a holographic card that tilts with the phone (or a finger); the trophy room's plaque
   card gets the same sheen. Share draws the card to a picture and hands it to phoSave. Where the browser has View
   Transitions the engine card (.ecard) grows into the results card. Settings › Display › Results card turns it off (S.rcOff).
   Hooks: resultReveal() in test.js calls rcSeen(); tropHook() in trophy.js calls rcTrophy(); tropCard() calls holoWire(). */
const RC={armed:false,open:false,res:null,env:null,ghost:null,lastDyno:null,prev:{},cmp:null,trop:null,tropAt:0,wait:0,tries:0};
const RC_DELAY=450,RC_WAIT=250,RC_TRIES=48;   // ms after a dyno test; events wait for the scene to end, checking every 250 ms for up to 12 s
const RC_KICK={pull:"Dyno pull",endurance:"Endurance",overrev:"Over-rev",drag:"Drag pass",pull_sled:"Truck pull",salt:"Salt run",bog:"Mud bog",boat:"Boat drags",road:"Road test",hill:"Pikes Peak",oval:"Dirt oval",race24:"24 Hours"};
/* the hero number for each test: v (shown), u (unit), n (number for the delta), lo (lower is better), key (only compare runs with the same key), d (delta decimals) */
const RC_HERO={
  pull:res=>({v:Math.round(res.peakHp),u:"hp",n:res.peakHp,key:"dyno",d:0}),
  drag:res=>{const r=res.drag;if(res.dragFailed||!r||r.et==null)return null;return{v:r.et.toFixed(2),u:"s",n:r.et,lo:true,key:"d"+(r.body||""),d:2,sub:Math.round(r.mph)+" mph"};},
  salt:res=>{const r=res.salt;if(res.saltFailed||!r||r.mileMph==null)return null;return{v:r.mileMph.toFixed(1),u:"mph",n:r.mileMph,key:"s"+(r.cls&&r.cls.key||""),d:1};},
  pull_sled:res=>{const r=res.pull;if(res.pullFailed||!r||r.dq||r.poPending)return null;return{v:r.full?"FULL":r.distFt.toFixed(1),u:r.full?"pull":"ft",n:r.distFt,key:"p"+(r.cls||""),d:1};},
  bog:res=>{const r=res.bog;if(res.bogFailed||!r)return null;return r.cleared?{v:r.pitT.toFixed(2),u:"s",n:r.pitT,lo:true,key:"bc"+(r.cls||""),d:2}:{v:r.distM.toFixed(1),u:"m",n:r.distM,key:"bd"+(r.cls||""),d:1};},
  hill:res=>{const r=res.hill;if(!r||r.dnf)return null;return{v:fmtHill(r.time),u:"",n:r.time,lo:true,key:"h"+(r.clsName||""),d:2,dt:1};},
  road:res=>{const r=res.road;if(!r||r.lapT==null||r.dtBroke||r.swapBroke)return null;return{v:fmtLap(r.lapT,2),u:"lap",n:r.lapT,lo:true,key:"r"+(r.trkName||"")+(r.chName||""),d:2,dt:1};},
  oval:res=>{const r=res.oval;if(res.ovalFailed||!r)return null;return{v:ordN(r.place),u:r.stage==="heat"?"heat":"feature"};}
};
RC_HERO.endurance=RC_HERO.overrev=RC_HERO.pull;
const rcDyno=t=>t==="pull"||t==="endurance"||t==="overrev";
const rcReduced=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;

/* called from resultReveal on every Test/Events render: arm while a run is going, fire once on the first new result after it */
function rcSeen(last){if(testing){if(!RC.armed){RC.armed=true;RC.before=last&&last.res;}clearTimeout(RC.wait);return;}
  if(!RC.armed)return;RC.armed=false;if(!last||!last.res||last.res===RC.before)return;const t=last.env.testType;   // a run that stopped before it ran leaves the old result: no card
  /* the ghost and the delta come from the run before, whether or not its card showed */
  if(rcDyno(t)){RC.ghost=RC.lastDyno;RC.lastDyno=last.res;}
  else{RC.cmp=RC.prev[t]||null;let h=null;try{h=RC_HERO[t]?RC_HERO[t](last.res):null;}catch(e){}if(h&&h.n!=null)RC.prev[t]={n:h.n,key:h.key};}
  if(S.rcOff)return;
  RC.res=last.res;RC.env=last.env;RC.tries=0;clearTimeout(RC.wait);RC.wait=setTimeout(rcTry,rcDyno(last.env.testType)?RC_DELAY:RC_WAIT);}
/* something else owns the screen: a tour, First Fire, a lesson, teardown, the photo mode or trophy room, an open sheet or Settings */
function rcBlocked(){const vis=id=>{const e=$(id);return !!(e&&!e.hidden&&e.offsetParent!==null&&getComputedStyle(e).display!=="none");};
  const a=$("app").classList,d=document.documentElement.classList;
  return a.contains("td")||d.contains("photo")||d.contains("troom")||vis("tourBox")||vis("ffBox")||vis("lesBox")||$("setPane").classList.contains("on")||($("sheet")&&$("sheet").classList.contains("on"));}
function rcTry(){if(testing||!RC.res||S.rcOff)return;
  if($("app").classList.contains("onstrip")||rcBlocked()){if(++RC.tries<RC_TRIES)RC.wait=setTimeout(rcTry,RC_WAIT);return;}   // wait out the after-run beat
  if(curTab!=="test"&&curTab!=="events")return;
  if($("verdict").querySelector("button"))return;   // a verdict with its own buttons (the pull-off) needs the panel, not the card
  rcShow();}

/* ---- building the card ---- */
function rcVerdict(){const v=$("verdict").querySelector(".verdict");if(!v)return null;const b=v.querySelector(".big"),p=v.querySelector("p");
  const big=b?b.innerHTML.replace(/<br\s*\/?>/gi," · ").replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/\s+/g," ").trim():"";
  return{cls:v.classList.contains("pass")?"pass":v.classList.contains("fail")?"fail":"marg",big,p:p?p.textContent.replace(/\s+/g," ").trim():""};}
function rcHero(){const t=RC.env.testType,f=RC_HERO[t];let h=null;try{h=f?f(RC.res):null;}catch(e){h=null;}return h;}
function rcDelta(h){const t=RC.env.testType;let ref=null,lbl="";
  if(rcDyno(t)){const g=S.base?S.base.res:RC.ghost;if(g&&g!==RC.res){ref=g.peakHp;lbl=S.base?S.base.label:"last pull";}}
  else{const p=RC.cmp;if(p&&p.key===h.key){ref=p.n;lbl="last run";}}
  if(ref==null||h.n==null)return "";const dv=h.n-ref,good=h.lo?dv<0:dv>0,z=Math.abs(dv)<Math.pow(10,-(h.d||0))/2;
  const s=(dv>=0?"+":"−")+Math.abs(dv).toFixed(h.d||0)+(h.u&&!h.dt?" "+h.u:" s");
  return `<div class="rcdelta ${z?"":good?"rcup":"rcdn"}">${z?"Same as":s+" vs"} <em>${esc(lbl)}</em></div>`;}
function rcPaint(){const t=RC.env.testType,res=RC.res,h=rcHero(),v=rcVerdict(),dy=rcDyno(t);
  const kick=`${RC_KICK[t]||"Run"} · ${esc(engineName())}`;
  const hero=h?`<div class="rchero"><b id="rcHero">${esc(h.v)}</b>${h.u?`<i>${esc(h.u)}</i>`:""}</div>${h.sub?`<div class="rcsub">${esc(h.sub)}</div>`:""}${rcDelta(h)}`
    :`<div class="rchero rctext ${v?v.cls:""}"><b id="rcHero">${esc(v&&v.big||"Run complete")}</b></div>`;
  const chip=h&&v&&v.big?`<div class="rcchip ${v.cls}">${esc(v.big)}</div>`:"";
  const stats=dy?`<div class="rcstats"><div><b>${Math.round(res.peakTq)}</b><span>Nm @ ${res.peakTqRpm.toLocaleString()}</span></div><div><b>${Math.round(res.rel)}</b><span>reliability</span></div><div><b>${res.peakHpRpm.toLocaleString()}</b><span>rpm at peak</span></div></div>`
    :v&&v.p?`<p class="rcp">${esc(v.p.length>170?v.p.slice(0,168)+"…":v.p)}</p>`:"";
  const trop=rcTrop(),tr=trop?`<div class="rctrop holo" data-tier="${esc(trop.tier||"gold")}" data-holo tabindex="0" aria-label="Trophy: ${esc(trop.t)}"><small>TROPHY ROOM</small><b>${esc(trop.t)}</b>${trop.nums&&trop.nums.length?`<span>${trop.nums.slice(0,2).map(([k,x])=>`${esc(k)} ${esc(x)}`).join(" · ")}</span>`:""}<i class="hsheen" aria-hidden="true"></i></div>`:"";
  const again=$("runTest");
  $("rcBox").innerHTML=`<button class="rcx" data-rc="close" aria-label="Close">✕</button><div class="rckick">${kick}</div>${hero}${chip}${dy?`<canvas id="rcCv" aria-hidden="true"></canvas>`:""}${stats}${tr}
    <div class="rcact"><button class="btn pri" data-rc="again"${again&&again.disabled?" disabled":""}>Run it again</button><button class="btn" data-rc="build">Back to build</button><button class="btn" data-rc="share">Share</button></div>`;
}
/* the dyno curve, with the ghost behind: drawChart draws S.base as its dashed baseline, so lend it the ghost for one draw */
function rcChart(){const cv=$("rcCv");if(!cv||!RC.res||!RC.res.rpms)return;const g=S.base?S.base.res:(RC.ghost!==RC.res?RC.ghost:null),sb=S.base,cb=curves.base;
  try{S.base=g?{res:g,label:sb?sb.label:"last pull"}:null;curves.base=!!g;drawChart(RC.res,null,cv);}catch(e){}finally{S.base=sb;curves.base=cb;}}
function rcShow(){if(RC.open)return;const box=$("rcBox"),wrap=$("rcard");
  const ec=[...document.querySelectorAll(".ecard:not(.inline)")].find(e=>e.offsetParent&&e.getBoundingClientRect().height>0);
  const go=()=>{rcPaint();wrap.hidden=false;document.documentElement.classList.add("rcon");RC.open=true;rcChart();holoWire(box);};
  if(document.startViewTransition&&ec&&!rcReduced()){ec.style.viewTransitionName="rcmorph";
    try{const vt=document.startViewTransition(()=>{ec.style.viewTransitionName="";box.style.viewTransitionName="rcmorph";go();});
      vt.finished.finally(()=>{box.style.viewTransitionName="";});}catch(e){ec.style.viewTransitionName="";go();}}
  else go();
  buzz(12);setTimeout(()=>{const b=box.querySelector("[data-rc=again]:not([disabled])")||box.querySelector("[data-rc=build]");if(b&&RC.open)b.focus({preventScroll:true});},60);}
function rcClose(then){if(!RC.open)return;RC.open=false;RC.trop=null;
  const wrap=$("rcard"),fin=()=>{wrap.hidden=true;wrap.classList.remove("out");$("rcBox").style.translate="";document.documentElement.classList.remove("rcon");if(then)then();};
  if(rcReduced())fin();else{wrap.classList.add("out");setTimeout(fin,180);}}

/* ---- share: the card as a 1080 × 1350 picture ---- */
function rcShareCanvas(){const W=1080,H=1350,c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d"),t=RC.env.testType,h=rcHero(),v=rcVerdict();
  const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,"#26221d");g.addColorStop(1,"#121110");x.fillStyle=g;x.fillRect(0,0,W,H);
  const tint=getComputedStyle(document.documentElement).getPropertyValue("--glass-tint").trim()||"217,119,87";
  const r=x.createRadialGradient(W*.2,H*.12,0,W*.2,H*.12,W*.9);r.addColorStop(0,`rgba(${tint},.35)`);r.addColorStop(1,"rgba(0,0,0,0)");x.fillStyle=r;x.fillRect(0,0,W,H);
  const D='"Chakra Petch","Barlow Condensed",sans-serif',M='"IBM Plex Mono",Menlo,monospace',P=72;x.textBaseline="alphabetic";
  x.fillStyle="rgba(255,255,255,.6)";x.font=`500 34px ${M}`;x.fillText(phoFit(x,(RC_KICK[t]||"Run").toUpperCase(),W-P*2),P,130);
  x.fillStyle="#f2efe6";x.font=`700 56px ${D}`;x.fillText(phoFit(x,engineName(),W-P*2),P,200);
  let y=470;if(h){x.font=`700 260px ${D}`;x.fillStyle="#fff";const hv=String(h.v);x.fillText(phoFit(x,hv,W-P*2-160),P,y);const w=x.measureText(hv).width;x.font=`600 72px ${D}`;x.fillStyle=`rgb(${tint})`;x.fillText(h.u||"",P+w+18,y);}
  else{x.font=`700 96px ${D}`;x.fillStyle="#fff";x.fillText(phoFit(x,v&&v.big||"Run complete",W-P*2),P,y-60);}
  if(h&&h.sub){x.font=`500 40px ${M}`;x.fillStyle="rgba(255,255,255,.7)";x.fillText(h.sub,P,y+64);y+=56;}
  y+=80;if(v&&v.big&&h){x.font=`600 44px ${D}`;x.fillStyle=v.cls==="pass"?"#5cbf8a":v.cls==="fail"?"#ee5a5e":"#e8c14a";x.fillText(phoFit(x,v.big,W-P*2),P,y);y+=30;}
  const dl=$("rcBox").querySelector(".rcdelta");if(dl){x.font=`500 36px ${M}`;x.fillStyle=dl.classList.contains("rcup")?"#5cbf8a":dl.classList.contains("rcdn")?"#ee5a5e":"rgba(255,255,255,.6)";x.fillText(phoFit(x,dl.textContent.replace(/\s+/g," ").trim(),W-P*2),P,y+30);y+=60;}
  if(v&&v.p&&!rcDyno(t)){x.font=`400 36px "Barlow",sans-serif`;x.fillStyle="rgba(255,255,255,.72)";const words=v.p.split(" ");let ln="",n=0;y+=30;
    for(const w of words){const tt=ln?ln+" "+w:w;if(x.measureText(tt).width>W-P*2&&ln){x.fillText(ln,P,y);y+=50;ln=w;if(++n>=4)break;}else ln=tt;}if(n<4&&ln){x.fillText(ln,P,y);y+=50;}}
  const cv=$("rcCv");if(cv&&cv.width){const ch=Math.round((W-P*2)*cv.height/cv.width);x.drawImage(cv,P,y+20,W-P*2,ch);y+=ch+40;}
  const trop=rcTrop();if(trop){y+=40;x.fillStyle="rgba(217,169,58,.18)";x.fillRect(P,y,W-P*2,120);x.fillStyle="#d9a93a";x.font=`500 28px ${M}`;x.fillText("TROPHY ROOM",P+28,y+46);x.fillStyle="#fff";x.font=`700 40px ${D}`;x.fillText(phoFit(x,trop.t,W-P*2-56),P+28,y+96);}
  x.fillStyle="rgba(255,255,255,.55)";x.font=`500 30px ${M}`;x.fillText("PRAIRIE ENGINE WORKS",P,H-70);return c;}
async function rcShare(b){if(b)b.disabled=true;try{const c=rcShareCanvas(),st=new Date().toISOString().slice(0,16).replace(/[-:T]/g,"");
  await phoSave(c,`prairie-${phoSlug(engineName())}-${RC.env.testType}-${st}.png`,engineName(),true);}catch(e){toast("Couldn't make the picture here");}finally{if(b)b.disabled=false;}}

/* ---- input: buttons, tap outside, swipe down, Esc ---- */
$("rcard").addEventListener("click",e=>{const b=e.target.closest("[data-rc]");if(!b){if(e.target===$("rcard"))rcClose();return;}const k=b.dataset.rc;
  if(k==="close")rcClose();else if(k==="build")rcClose(()=>showTab("build"));else if(k==="share")rcShare(b);
  else if(k==="again")rcClose(()=>{const r=$("runTest");if(r&&!r.disabled)r.click();});});
{let sy=null,dy=0;const box=$("rcBox");
  box.addEventListener("pointerdown",e=>{if(e.pointerType==="mouse"||e.target.closest("button,[data-holo]"))return;sy=e.clientY;dy=0;});
  box.addEventListener("pointermove",e=>{if(sy==null)return;dy=Math.max(0,e.clientY-sy);box.style.translate=`0 ${dy}px`;});
  const up=()=>{if(sy==null)return;sy=null;if(dy>90)rcClose();else box.style.translate="";};box.addEventListener("pointerup",up);box.addEventListener("pointercancel",up);}
document.addEventListener("keydown",e=>{if(!RC.open)return;if(e.key==="Escape"){e.preventDefault();rcClose();}else if(e.key!=="Tab"&&e.key!=="Enter"&&e.key!==" ")e.preventDefault();},true);
/* Settings › Display › Results card */
function rcSegSync(){const s=$("rcSeg");if(s&&S)s.querySelectorAll("button").forEach(b=>b.classList.toggle("on",(b.dataset.rcs==="0")===!!S.rcOff));}
$("rcSeg").addEventListener("click",e=>{const b=e.target.closest("[data-rcs]");if(!b)return;S.rcOff=b.dataset.rcs==="0";save();rcSegSync();toast(S.rcOff?"No results card: results stay in the panel":"The results card shows after each run");});
$("setOpen").addEventListener("click",rcSegSync);

/* ---- holographic trophy cards: a rainbow sheen and a small tilt that follow the phone, or a finger ---- */
const HOLO={asked:false,on:false,b0:null,g0:null,raf:0,tx:0,ty:0};
function rcTrophy(ent){if(!ent)return;RC.trop=ent;RC.tropAt=Date.now();}   // tropHook: a trophy just went on the shelf
const rcTrop=()=>RC.trop&&Date.now()-RC.tropAt<20000?RC.trop:null;   // only one won on the run the card is about
const holoStatic=()=>document.documentElement.dataset.gfx==="lite"||rcReduced();
function holoSet(el,tx,ty){el.style.setProperty("--tilt-x",tx.toFixed(3));el.style.setProperty("--tilt-y",ty.toFixed(3));}
function holoVisible(){return [...document.querySelectorAll("[data-holo]")].filter(e=>e.offsetParent!==null);}
function holoOrient(e){if(e.beta==null||e.gamma==null)return;if(HOLO.b0==null){HOLO.b0=e.beta;HOLO.g0=e.gamma;}
  HOLO.tx=Math.max(-1,Math.min(1,(e.gamma-HOLO.g0)/25));HOLO.ty=Math.max(-1,Math.min(1,(e.beta-HOLO.b0)/25));
  if(!HOLO.raf)HOLO.raf=requestAnimationFrame(()=>{HOLO.raf=0;const L=holoVisible();if(!L.length){holoStop();return;}L.forEach(el=>{if(!el.dataset.hdrag)holoSet(el,HOLO.tx,HOLO.ty);});});}
function holoStart(){if(HOLO.on||holoStatic())return;HOLO.on=true;HOLO.b0=null;addEventListener("deviceorientation",holoOrient);}
function holoStop(){if(!HOLO.on)return;HOLO.on=false;removeEventListener("deviceorientation",holoOrient);}
/* iOS asks before it shares the tilt, and only from a tap: the first tap on a holo card asks */
function holoAsk(){if(HOLO.asked)return;HOLO.asked=true;const D=window.DeviceOrientationEvent;
  if(D&&typeof D.requestPermission==="function")D.requestPermission().then(s=>{if(s==="granted"){HOLO.on=false;holoStart();}}).catch(()=>{});}
function holoWire(root){const L=[...root.querySelectorAll("[data-holo]")].concat(root.matches&&root.matches("[data-holo]")?[root]:[]);if(!L.length)return;
  const D=window.DeviceOrientationEvent;if(!(D&&typeof D.requestPermission==="function"))holoStart();else if(HOLO.asked)holoStart();
  L.forEach(el=>{if(el.dataset.hw)return;el.dataset.hw="1";
    el.addEventListener("pointerdown",e=>{holoAsk();if(holoStatic())return;el.dataset.hdrag="1";try{el.setPointerCapture(e.pointerId);}catch(_){}});
    el.addEventListener("pointermove",e=>{if(holoStatic()||(e.pointerType!=="mouse"&&!el.dataset.hdrag))return;const r=el.getBoundingClientRect();holoSet(el,((e.clientX-r.left)/r.width-.5)*2,((e.clientY-r.top)/r.height-.5)*2);});
    const end=()=>{delete el.dataset.hdrag;holoSet(el,HOLO.on?HOLO.tx:0,HOLO.on?HOLO.ty:0);};el.addEventListener("pointerup",end);el.addEventListener("pointercancel",end);el.addEventListener("pointerleave",end);});}
