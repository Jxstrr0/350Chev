/* ===================== EVENTS LANDING: the venue picker ===================== */
/* Tapping Events with no event entered shows a full-screen programme (#evHub, css/ui-evhub.css): one big card per event
   with its banner, venue, classes, purse and where you stand. A card enters that event through the same evApply + pickTest
   path the old chip row used, so setup, Go and results behave as before. The event page then opens with a header bar
   (#evHead) and a Back button, and the chip row (#evPick) stays in the page, hidden.
   EH.t is the event entered this session ("" = the landing). It is not saved: a fresh load starts on the grid, and
   switching tabs and back keeps you where you were. html.evin mirrors it for the CSS. Back is held while a run is going.
   The browser's own Back button (Android) steps out of an event too, through one history entry per visit.
   Banner art: a later PR drops one 3:1 image per event into EV_BANNER (a path, e.g. "banners/drag.webp"); the card then
   draws it lazily over the gradient and icon, which stay as the fallback. */
var EH={t:""};   // var: evPickRender can run before this file has on boot
const EV_BANNER={drag:"banners/street.webp",bracket:"banners/gasser.webp",pull_sled:"banners/photfarm.webp",salt:null,bog:"banners/bmod.webp",boat:"banners/boutboard.webp",road:null,hill:"banners/hillppo.webp",oval:"banners/olate.webp",race24:null};   /* each a team series' banner (banners/<PC_EVENTS key>.webp); salt, road and the 24 Hours have no series yet */
/* h: the banner's hue; v: the venue (the home tracks have had names since 1.76.106.0: Section Line Dragway, Elevator Row
   Fairgrounds, Gumbo Flats, Cutbank Reach, and the two ovals, Grid Road Speedway on clay and Sundog Speedway on asphalt); d: one line on what it is; cls: what the classes cell says */
const EVH={
  drag:{h:16,v:"Section Line Dragway",d:"Quarter-mile passes and heads-up race nights on a prepped strip.",cls:()=>Object.keys(SIM.AERO).length+" body classes"},
  bracket:{h:42,v:"Section Line Dragway",d:"Dial in your ET and race heads-up: run under your dial and you break out.",cls:()=>Object.keys(SIM.AERO).length+" body classes"},
  pull_sled:{h:95,v:"Elevator Row Fairgrounds",d:"A truck drags a weighted sled down 300 ft of dirt.",cls:()=>Object.keys(SIM.PULL_CLASSES).length+" classes"},
  salt:{h:200,v:"Bitterwater Salt Flats",d:"One timed mile at full speed, then the chute. Thin air costs power.",cls:()=>Object.keys(SIM.LSR_BODIES).length+" body classes"},
  bog:{h:75,v:"Gumbo Flats",d:"Hit the mud with speed and keep the wheels turning: through scores time, stuck scores distance.",cls:()=>Object.keys(SIM.BOG_CLASSES).length+" classes"},
  boat:{h:190,v:"Cutbank Reach",d:"Heads-up over 1,000 ft of water: a slipping prop, the hump, then the plane.",cls:()=>Object.keys(SIM.BOAT_CLASSES).length+" classes"},
  road:{h:215,v:"Prairie Sky Raceway",d:"Your engine in a chassis: 0-100, the quarter, top speed and a flying lap.",cls:()=>Object.keys(SIM.ROAD_TRACKS).length+" circuits"},
  hill:{h:265,v:"Cloudsplitter Peak",d:"19.99 km and 156 turns, from 2,862 m up into thin air.",cls:()=>Object.keys(SIM.HILL_CLASSES).length+" classes"},
  oval:{h:8,v:"Grid Road and Sundog Speedways",d:"A heat race, then the feature, in one gear on a banked oval.",cls:()=>Object.keys(SIM.OVAL_CLASSES).length+" classes"},
  race24:{h:235,v:"Prairie Sky Raceway",d:"A day and a night against twenty cars in three classes.",cls:()=>Object.keys(SIM.E24_CLASSES).length+" classes"}};
/* the money cell: [label, text]. Career reads the same tables the payouts do; the sandbox has no entry fees */
const evhRange=a=>{const lo=Math.min(...a),hi=Math.max(...a);return lo===hi?fmt$(lo):fmt$(lo)+"–"+fmt$(hi);};
const evhTier=(T,top,pay)=>Object.values(T).map(c=>top*(pay[c.tier]||1));
function evhMoney(t){if(!career())return["Entry","Free"];
  if(t==="drag"||t==="bracket")return["Purse","by your ET"];
  if(t==="pull_sled")return["Winner",evhRange(evhTier(SIM.PULL_CLASSES,PULL_PURSE[0],PULL_PAY))];
  if(t==="bog")return["Winner",evhRange(evhTier(SIM.BOG_CLASSES,BOG_PURSE[0],BOG_PAY))];
  if(t==="hill")return["Winner",evhRange(evhTier(SIM.HILL_CLASSES,HILL_PURSE[0],HILL_PAY))];
  if(t==="oval")return["Feature",evhRange(evhTier(SIM.OVAL_CLASSES,OVAL_FPURSE[0],OVAL_PAY))];
  if(t==="boat")return["Winner",evhRange(Object.values(SIM.BOAT_CLASSES).map(c=>c.purse))];
  if(t==="salt")return["Record",evhRange(Object.values(SALT_PURSE))];
  if(t==="race24")return["Class win",evhRange(Object.values(SIM.E24_CLASSES).map(c=>c.prize[0]))];
  return["Entry",fmt$(ROAD_FEE)];}
const evhCap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):"";
function evhCard(t,i){const st=evStatus(t),H=EVH[t],lock=st.k==="lock",img=EV_BANNER[t],m=evhMoney(t);let cls="";try{cls=H.cls();}catch(e){}
  return `<button class="evc${lock?" lock":""}${st.k==="live"?" live":""}" data-t="${t}" style="--h:${H.h}"${lock?` aria-disabled="true"`:""}>`
    +`<span class="evb">${img?`<img src="${esc(img)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`:""}<svg class="evi" viewBox="0 0 24 24" aria-hidden="true"><path d="${EV_IC[t]}"/></svg><i class="evno">No. ${String(i+1).padStart(2,"0")}</i>${st.k==="live"?`<em class="evon">On now</em>`:""}</span>`
    +`<span class="evx"><b class="evn">${EV_NAME[t]}</b><span class="evv">${H.v}</span><span class="evd">${H.d}</span>`
    +`<span class="evs"><span><i>Classes</i><b>${cls}</b></span><span><i>${m[0]}</i><b>${m[1]}</b></span><span><i>Status</i><b>${esc(evhCap(st.s))||"Open"}</b></span></span></span>`
    +(lock?`<span class="evlk"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg><b>${esc(evhCap(st.s))}</b></span>`:"")+`</button>`;}
/* paint the grid and the event header, and keep html.evin and EH.t in step with what is really set up */
function evhubRender(){if(!EH)return;try{
  const pcw=$("tab-events").classList.contains("pcw"),inEv=trackEvt(S.env.testType);
  if(!EH.t&&testing&&inEv&&!pcw)EH.t=evCur();                    // an event run is going: the page is the event's
  else if(EH.t&&!testing&&inEv)EH.t=evCur();                      // a lock or a mode switch moved the pick: follow it
  document.documentElement.classList.toggle("evin",!!EH.t);
  const g=$("evGrid"),h=EV_T.map(evhCard).join("");if(g.dataset.h!==h){g.dataset.h=h;g.innerHTML=h;}
  const md=career()?"Career: entries cost money and the purses and rep pay out.":"Test cell: free entry, nothing on the books.";if($("evHubMode").textContent!==md)$("evHubMode").textContent=md;
  if(EH.t){const st=evStatus(EH.t),nm=EV_NAME[EH.t],sb=[EVH[EH.t].v,evhCap(st.s)].filter(Boolean).join(" · ");
    if($("evHeadName").textContent!==nm)$("evHeadName").textContent=nm;if($("evHeadSub").textContent!==sb)$("evHeadSub").textContent=sb;}
  }catch(e){}}
/* is the landing the page on show? (no run going: keys and sounds that belong to an event page stand down) */
function evhubOn(){return curTab==="events"&&!EH.t&&!testing;}
function evhubSet(t){EH.t=t||"";evhubRender();}
function evhubPush(){try{if(!(history.state&&history.state.pewEv))history.pushState({pewEv:1},"");}catch(e){}}
/* go into an event: the old chip's path (evApply, then pickTest renders the page). force skips the lock check (lessons) */
function evhubEnter(t,force){if(testing){toast("Let the run finish first");return;}
  const st=evStatus(t);if(st.k==="lock"&&!force){toast(`${EV_NAME[t]}: ${st.s}`);buzz(8);return;}
  evApply(t);EH.t=t;pickTest(S.env.testType);evhubPush();tabScroll.events=0;$("panel").scrollTop=0;}
/* back to the grid. The Back button goes through history when this visit pushed an entry, so the entry is spent too */
function evhubLeave(){if(!EH.t)return;EH.t="";evhubRender();}
function evhubBack(){if(testing){toast("Let the run finish first");return;}
  try{if(history.state&&history.state.pewEv){history.back();return;}}catch(e){}
  evhubLeave();}
function evhubGrid(){evhubSet("");}   // the tour: show the landing
$("evGrid").addEventListener("click",e=>{const b=e.target.closest(".evc");if(b)evhubEnter(b.dataset.t);});
$("evBack").addEventListener("click",evhubBack);
window.addEventListener("popstate",()=>{if(!EH.t)return;if(testing){evhubPush();toast("Let the run finish first");return;}evhubLeave();});
