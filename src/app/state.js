<script>
/* ===================== Prairie Engine Works — app ===================== */
const SIM=ENGINE_SIM,{LAYOUTS,OPT,FORM,PRESETS}=SIM;
const $=id=>document.getElementById(id);
const esc=v=>String(v==null?"":v).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
/* ---- helpers every event shares (drag, pull, bog, boat, salt, hill, oval, road, e24) ---- */
/* one bucket of records per event, created on first use */
function recBucket(k){const R=recs();if(!R[k]||typeof R[k]!=="object")R[k]={};return R[k];}
/* a class is locked while the career is short of its rep (0 = open) */
function clsLocked(T,k){const c=T[k];return c&&career()&&!dev()&&C().rep<c.rep?c.rep:0;}
/* which class this week's hook was in (one run a week per event) */
function wkCls(key){if(!career())return null;const w=C()[key]||{};return Object.keys(w).find(k=>w[k]===C().week)||null;}
/* an entry fee: 15% of the bottom purse, scaled by the class tier, rounded to $5 */
function evFee(purse,pay,tier){return Math.round(purse*(pay[tier]||1)*0.15/5)*5;}
/* the full-screen flash: a colour, then back to clear after ms */
function screenFlash(bg,ms){const f=$("flash");if(!f)return;f.style.background=bg;setTimeout(()=>f.style.background="rgba(238,90,94,0)",ms);}
function failFlash(ms){screenFlash("rgba(238,90,94,.45)",ms||250);sfx("fail");buzz([80,40,120]);}
function winFlash(){screenFlash("rgba(92,191,138,.35)",400);}
/* scroll the panel so an event's control strip sits above the tabs */
function scrollCtlIntoView(id){requestAnimationFrame(()=>{const pn=$("panel"),el=$(id);if(!pn||!el)return;const r=el.getBoundingClientRect(),pr=pn.getBoundingClientRect(),bot=Math.min(pr.bottom,tabsTop())-8;
  if(r.bottom>bot||r.top<pr.top)pn.scrollTo({top:pn.scrollTop+(r.height>bot-pr.top?r.top-pr.top-4:r.bottom-bot),behavior:calmScroll()});});}
/* a hold-to-drive button: pointer capture, Space/Enter on the button, and a click fallback for assistive tech
   (a click within 800 ms of a real pointer is the same press, so it is ignored). run() is the live run object;
   release(cancel) gets true on pointercancel. */
function holdBtn(b,run,press,release,onClick){
  const mark=()=>{const r=run();if(r)r.lastPtr=performance.now();};
  b.addEventListener("pointerdown",e=>{e.preventDefault();mark();try{b.setPointerCapture(e.pointerId);}catch(x){}press();});
  b.addEventListener("pointerup",()=>{mark();release(false);});
  b.addEventListener("pointercancel",()=>{mark();release(true);});
  b.addEventListener("contextmenu",e=>e.preventDefault());
  b.addEventListener("keydown",e=>{if((e.key===" "||e.key==="Enter")&&!e.repeat){e.preventDefault();press();}});
  b.addEventListener("keyup",e=>{if(e.key===" "||e.key==="Enter"){e.preventDefault();release(false);}});
  b.addEventListener("click",()=>{const r=run();if(!r||performance.now()-(r.lastPtr||0)<800)return;onClick(r);});}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt$=n=>(n<0?"-$":"$")+Math.round(Math.abs(n)).toLocaleString("en-CA");
const UPGRADES=[
  {id:"dyno2",name:"Engine dyno",desc:"Reads to 1,000 hp / 10,000 rpm. The chassis dyno tops out at 400 hp.",price:18000},
  {id:"shop1",name:"Machine shop I",desc:"Forged pistons and rods, forged cranks, better bolts, baffled sump.",price:14000},
  {id:"flow",name:"Flow bench",desc:"Variable valve timing and lift, individual throttles, tuned runners.",price:16000},
  {id:"boost",name:"Boost bench",desc:"Turbochargers, superchargers, intercoolers and the fuels that like them.",price:24000},
  {id:"bay1",name:"Second bay",desc:"Room for inline-5, inline-6, V8 (cross or flat-plane), flat-6 and three-rotor blocks.",price:36000},
  {id:"shop2",name:"Machine shop II",desc:"Billet cranks, titanium, 300M, coated bearings, dry sumps, exotic fuels \u2014 and the pulling parts: billet TBC pistons, drag-gap rings, 9/16 studs, compound turbos and 250 hp sticks.",price:60000,needs:"shop1"},
  {id:"dyno3",name:"Pro dyno cell",desc:"Reads to 2,000 hp / 12,500 rpm, with climate control: test hot, cold or at altitude. Certification still runs in the standard cell.",price:90000,needs:"dyno2"},
  {id:"bay2",name:"Race bay",desc:"V10, V12, four-rotor and Deltic blocks.",price:140000,needs:"bay1"},
  {id:"race",name:"Outlaw shop",desc:"Billet blocks and heads, 88 and 98 mm turbo frames, screw blowers, nitrous and aluminium rods \u2014 and the bore, stroke and boost limits that go with them.",price:280000,needs:"shop2"},
  {id:"tool",name:"Tooling hall",desc:"Fixtures, jigs and a second mill. A team's engine changes and rebuilds cost 25% less of its budget. Opens at 300 rep; adds a little to weekly overhead.",price:250000,needs:"race",rep:300,oh:0.4},
  {id:"qlab",name:"Quality lab",desc:"CMM bench and a bore-gauge wall. Team engines wear 30% less each round. Opens at 700 rep.",price:450000,needs:"tool",rep:700,oh:0.4},
  {id:"acad",name:"Training academy",desc:"A classroom over the shop. Staff courses run a week shorter and teach 25% more. Opens at 700 rep.",price:800000,needs:"race",rep:700,oh:0.4},
  {id:"hall",name:"Showroom hall",desc:"A glass-fronted hall for finished engines. +5 rep a week, and a fourth team calls each season. Opens at the Legend tier (1,500 rep).",price:2500000,needs:"qlab",rep:1500,oh:0.3},
  {id:"dyno4",name:"Outlaw dyno cell",desc:"Reads to 3,500 hp. Nothing below it will hold a car making this kind of power.",price:240000,needs:"dyno3"},
  {id:"dyno5",name:"Monster dyno cell",desc:"Water-brake cell that reads to 15,000 hp / 14,000 rpm. Built for the four-figure-boost builds that overload the Outlaw cell.",price:400000,needs:"dyno4"}
];
const STAFF=[
  {id:"machinist",name:"Machinist",wage:350,desc:"Runs the mill and the hone. Parts cost −8%, machining R&D 25% faster."},
  {id:"tuner",name:"Calibration engineer",wage:420,desc:"Maps timing and fuel properly. +1 octane number of knock margin on every build."},
  {id:"dynotech",name:"Dyno technician",wage:300,desc:"Owns the test cell. Dyno pulls, endurance and over-rev runs are free."}
];
const RND=[
  {id:"peen",name:"Shot-peened rods",cost:9000,weeks:4,mach:true,desc:"Compressive surface stress on the beam. Every rod's fatigue limit +12%.",effect:{rodFat:1.12}},
  {id:"nitride",name:"Nitriding line",cost:14000,weeks:6,mach:true,desc:"In-house gas nitriding. Every crank's fatigue limit +15%.",effect:{crkFat:1.15}},
  {id:"forge",name:"Forging supplier deal",cost:8000,weeks:3,desc:"A supply contract for forged 4032 pistons and 4340 rods without the full machine shop.",unlock:["piston:forged_4032","rod:forged_4340"]},
  {id:"plating",name:"Bore plating process",cost:12000,weeks:5,mach:true,desc:"Ni-SiC plating in house. Unlocks the Nikasil aluminium block.",unlock:["blockMat:alu_nikasil"]},
  {id:"vvt",name:"Cam phaser licence",cost:10000,weeks:4,desc:"Licensed phaser hardware. Unlocks DOHC 4v + VVT ahead of the flow bench.",unlock:["head:dohc4v_vvt"]},
  {id:"calib",name:"Calibration suite",cost:7000,weeks:3,desc:"Knock sensing and a proper base map. +0.5 octane number of margin, permanently.",effect:{octane:0.5}},
  /* late projects: each one lets a shop-gated part through without the upgrade that normally carries it (app/state.js locked) */
  {id:"tirods",name:"Titanium rod programme",cost:16000,weeks:6,mach:true,desc:"Beams machined from Ti-6Al-4V bar, in house. Unlocks titanium rods.",unlock:["rod:titanium"]},
  {id:"inconel",name:"Exotic valve supplier",cost:11000,weeks:4,desc:"A nickel-superalloy supplier for the hot side. Unlocks Inconel valves.",unlock:["valveMat:inconel"]},
  {id:"drysump",name:"Dry-sump development",cost:13000,weeks:5,mach:true,desc:"A multi-stage pump and a pan of our own. Unlocks the high-volume dry sump.",unlock:["oilSystem:dry_hv"]},
  {id:"wmi",name:"Water-meth injection",cost:9000,weeks:3,desc:"Nozzle sizing and a tested controller. Unlocks water-methanol charge cooling.",unlock:["ic:wmi"]},
  {id:"fuelbench",name:"Fuel flow rig",cost:12000,weeks:4,desc:"An injector and pump flow bench. Unlocks the 2,200 cc injectors and the big belt-drive pump.",unlock:["injectors:i2200x4","fuelPump:mech_xl"]},
  {id:"lean",name:"Lean build cell",cost:15000,weeks:5,desc:"Kitting, fixtures and a build sheet for every job. Build cost −4% on every engine, permanently.",effect:{costFac:0.96}}
];
const PRESTIGE=[
  {id:"sign",name:"Illuminated shop sign",price:10000,rep:1,desc:"Your name over the door, lit. +1 rep a week."},
  {id:"trophy",name:"Trophy wall",price:30000,rep:2,desc:"A wall of certified builds and team plaques. +2 rep a week."},
  {id:"display",name:"Show engine plinth",price:60000,rep:4,desc:"A polished display engine in the front window. +4 rep a week and teams pay +3%."}
];
const REP_TIERS=[[0,"Backyard"],[40,"Local shop"],[120,"Known builder"],[300,"Regional supplier"],[700,"OEM partner"],[1500,"Legend"],[3000,"Dynasty"]];
const GOALS=[
  {id:"first",name:"Green flag",desc:"Race your first round as a team's engine supplier.",cash:1000,check:c=>!!c.pc&&c.pc.raced>0},
  {id:"hp200",name:"Two hundred",desc:"Certify a 200 hp engine.",cash:3000,check:c=>c.bestHp>=200},
  {id:"rel95",name:"Bulletproof",desc:"Certify an engine with reliability 95 or better.",cash:5000,check:c=>c.bestRel>=95},
  {id:"podium",name:"On the box",desc:"A top-three finish for your team in a round.",cash:3000,check:c=>!!c.pc&&c.pc.podiums>0},
  {id:"endur",name:"Hundred-hour man",desc:"Finish a 100 h endurance run in career with nothing broken.",cash:4000,check:c=>!!c.enduranceOk},
  {id:"boost",name:"Under pressure",desc:"Certify a boosted engine.",cash:6000,check:c=>!!c.boostedCert},
  {id:"rwin",name:"Race winner",desc:"Win a round with your team.",cash:5000,check:c=>!!c.pc&&c.pc.wins>0},
  {id:"season",name:"Full season",desc:"See a team through all eight rounds of a season.",cash:6000,check:c=>!!c.pc&&c.pc.seasons>0},
  {id:"hp500",name:"Five hundred",desc:"Certify a 500 hp engine.",cash:15000,check:c=>c.bestHp>=500},
  {id:"back",name:"Asked back",desc:"Finish a season in the top two, so the team calls you back.",cash:8000,check:c=>!!c.pc&&c.pc.backs>0},
  {id:"title",name:"Champions",desc:"Win a team championship.",cash:15000,check:c=>!!c.pc&&c.pc.titles>0},
  {id:"hp1000",name:"Four figures",desc:"Certify a 1,000 hp engine.",cash:40000,check:c=>c.bestHp>=1000},
  {id:"titles3",name:"Three-time champions",desc:"Win three team championships.",cash:40000,check:c=>!!c.pc&&c.pc.titles>=3}
];
const LOAN_STEP=10000,LOAN_MAX=50000,LOAN_RATE=0.02,LOAN_PAY=0.04,LOAN_MIN_PAY=250,FORECLOSE_AT=-25000;
/* the bank: every week-close takes the interest and a slice of the balance (LOAN_PAY, at least LOAN_MIN_PAY) out of cash.
   Nothing is added to the balance; a shop that cannot pay goes overdrawn, and below FORECLOSE_AT the bank takes it. */
function loanPay(){const l=C().loan||0;return l>0?Math.min(l,Math.max(LOAN_MIN_PAY,Math.round(l*LOAN_PAY/10)*10)):0;}
function loanRate(){return typeof lgLoanRate==="function"?lgLoanRate():LOAN_RATE;}   // app/legacy.js: the Good credit perk lowers it
function loanInt(){return Math.round((C().loan||0)*loanRate());}
function loanWeek(){const c=C();if(!(c.loan>0))return "";const i=loanInt(),p=loanPay();c.cash-=i+p;c.loan-=p;c.loanPaid=(c.loanPaid||0)+i+p;
  if(c.loan<=0){c.loan=0;achCheck({type:"loan"});}return ` · loan interest ${fmt$(i)} + repayment ${fmt$(p)}${c.loan>0?"":" — loan cleared"}`;}
/* ===================== state ===================== */
let S=null,quick=null,combosNow=[];
const VERSION="1.76.33.0";
(()=>{const set=()=>{const v=$("verLbl");if(v)v.textContent="v"+VERSION;};set();document.addEventListener("DOMContentLoaded",set);})();
/* a new career. cv:2 = the team-season career (1.76.33); a save from before it starts over (hydrate) */
function freshCareer(){return{cv:2,cash:20000,rep:0,week:1,owned:{},seed:Math.floor(Math.random()*1e9),cert:null,loan:0,log:[],goals:{},bestHp:0,bestRel:0,enduranceOk:false,boostedCert:false,staff:{},rnd:{},rndActive:null,unlocks:{},prestige:{},pc:null};}
function applySoundQuality(){const q=S.soundQ||(S.layoutMode==="desktop"?"full":null)||(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)?"lite":"full");ENGINE_SOUND.setQuality(q);document.querySelectorAll("#sqSeg button").forEach(b=>b.classList.toggle("on",b.dataset.sq===q));}
/* pressure units: everything is stored and simulated in bar. PSI is a display layer — text nodes that read "N bar"
   (also "A of B bar", "A–B bar", "A / B bar") are rewritten in place and remembered, so switching back restores them. */
const BAR_PSI=14.5038;
const pU=()=>S&&S.psi?"psi":"bar";
const bv=b=>{if(!(S&&S.psi))return b.toFixed(1);const v=b*BAR_PSI;return v.toFixed(v<100?1:0);};
const P_NUM="\\d{1,3}(?:,\\d{3})+(?!\\d)|\\d+(?:\\.\\d+)?";   // "2,000" (thousands separator) or 1.5
const P_RE=new RegExp("((?:(?:"+P_NUM+")\\s?(?:–|-|\\/|of|to)\\s?)*)("+P_NUM+")(?:\\s?|-)bar\\b(?!s)","g");
const toPsiTxt=t=>t.replace(P_RE,m=>{const h=/-bar$/.test(m);return m.replace(/\s?-?bar$/,"").replace(new RegExp(P_NUM,"g"),n=>{const c=n.includes(","),v=+n.replace(/,/g,"")*BAR_PSI;return v<100?v.toFixed(1):c?Math.round(v).toLocaleString("en-CA"):v.toFixed(0);})+(h?"-psi":" psi");});
function psiNode(n){const t=n.nodeValue;if(!t||t.indexOf("bar")<0){return;}if(n.__psi!==undefined&&t===n.__psi)return;const c=toPsiTxt(t);if(c!==t){n.__bar=t;n.nodeValue=c;n.__psi=c;}}
function psiWalk(root,on){if(!root)return;const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>{const p=n.parentNode;return p&&(p.nodeName==="SCRIPT"||p.nodeName==="STYLE"||p.nodeName==="TEXTAREA")?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}});const ns=[];let n;while((n=w.nextNode()))ns.push(n);
  for(const x of ns){if(on)psiNode(x);else if(x.__bar!==undefined){if(x.nodeValue===x.__psi)x.nodeValue=x.__bar;delete x.__bar;delete x.__psi;}}}
let psiBusy=false;
new MutationObserver(ms=>{if(!S||!S.psi||psiBusy)return;psiBusy=true;try{for(const m of ms){if(m.type==="characterData")psiNode(m.target);else for(const a of m.addedNodes){if(a.nodeType===3)psiNode(a);else if(a.nodeType===1)psiWalk(a,true);}}}finally{psiBusy=false;}}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
function applyPU(){psiWalk(document.body,!!(S&&S.psi));applyTheme();}
function applyTheme(){const t=S.theme||"dark";const eff=t==="auto"?(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):t;document.documentElement.setAttribute("data-theme",eff);
  document.querySelectorAll("#themeSeg button").forEach(b=>b.classList.toggle("on",b.dataset.theme===t));document.querySelectorAll("#hapSeg button").forEach(b=>b.classList.toggle("on",(b.dataset.hap==="1")===(S.haptics!==false)));document.querySelectorAll("#puSeg button").forEach(b=>b.classList.toggle("on",(b.dataset.pu==="psi")===!!S.psi));
  if(curTab==="test")drawChart(lastForChart(),null);else if(curTab==="events")chartRedraw();}
function buzz(ms){if(S.haptics===false||!navigator.vibrate)return;try{navigator.vibrate(ms);}catch(e){}}
function freshState(){return{mode:null,career:freshCareer(),cfg:Object.assign({},SIM.DEFAULT_CFG),env:Object.assign({},SIM.DEFAULT_ENV),blueprints:[],last:null,base:null,vol:60,sound:true,seen:false,name:null,heat:false,theme:"dark",haptics:true,viewMini:false,psi:false};}
function save(){try{if(typeof lgSync==="function")lgSync();const o=Object.assign({},S,{last:S.last?slimRes(S.last):null,base:S.base?slimRes(S.base):null});localStorage.setItem("pew2-save",JSON.stringify(o));}catch(e){}}
function slimRes(r){return{hash:r.hash,cfg:r.cfg,env:r.env,label:r.label,res:r.res};}
function snapshot(){const o=Object.assign({},S,{last:S.last?slimRes(S.last):null,base:S.base?slimRes(S.base):null});return o;}
function hydrate(o){if(!o||!o.cfg)return false;S=freshState();suC=null;Object.assign(S,o);delete S.bay;delete S.pit;
  /* 1.76.33: the career became team seasons. A career from before (no cv:2) starts over, and a Pit Crew game becomes a career;
     boot() applies the Legacy perks and tells the player once (S.careerNew) */
  const old=o.career&&typeof o.career==="object"?o.career:null,pit=o.mode==="pit",was=!!old&&old.cv!==2&&(o.mode==="career"||(+old.week||1)>1);
  S.career=old&&old.cv===2?Object.assign(freshCareer(),old):freshCareer();
  if(pit){S.mode="career";const P=o.pit&&typeof o.pit==="object"?o.pit:{};S.career.log=[{w:1,t:`Pit Crew record: ${Math.max(0,(+P.season||1)-1)} season${(+P.season||1)===2?"":"s"}, ${+P.titles||0} title${+P.titles===1?"":"s"}, ${+P.wins||0} round win${+P.wins===1?"":"s"}. Team seasons now run in the career, from the Team tab.`,k:"good"}];}
  if(pit||was)S.careerNew=pit?"pit":"reset";
  try{fuelMigrate();}catch(e){}
  S.cfg=Object.assign({},SIM.DEFAULT_CFG,o.cfg);S.env=Object.assign({},SIM.DEFAULT_ENV,o.env||{});if(S.env.dragDrive!=="auto")S.env.dragDrive="you";S.blueprints=Array.isArray(o.blueprints)?o.blueprints:[];return true;}
/* fuel system: a build saved before injectors and pumps existed gets the smallest set that feeds it (SIM.fitFuel), so a
   600 hp save doesn't suddenly lean out. Certs, strip bests and wear are keyed by the cfg hash, so they follow
   it. In career a fitted part the shop hasn't unlocked comes with the build (an R&D-style unlock), so nothing certified
   turns up locked. Runs on the raw save inside hydrate(), before the cfg is merged with the defaults. */
function fuelFit(c){if(!c||typeof c!=="object"||(c.injectors&&c.fuelPump))return null;
  const full=Object.assign({},SIM.DEFAULT_CFG,c);if(!c.injectors)delete full.injectors;if(!c.fuelPump)delete full.fuelPump;const oh=cfgHash(full);
  const fit=SIM.fitFuel(full);if(!c.injectors)c.injectors=fit.injectors;if(!c.fuelPump)c.fuelPump=fit.fuelPump;
  return [oh,cfgHash(Object.assign({},SIM.DEFAULT_CFG,c)),c];}
function fuelMigrate(){const m={},fitted=[];
  for(const c of [S.cfg,S.last&&S.last.cfg,S.base&&S.base.cfg].concat(Array.isArray(S.blueprints)?S.blueprints.map(b=>b&&b.cfg):[])){try{const r=fuelFit(c);if(r){m[r[0]]=r[1];fitted.push(r[2]);}}catch(e){}}
  if(!fitted.length)return;
  if(S.last&&m[S.last.hash])S.last.hash=m[S.last.hash];
  const K=S.career;if(K.cert&&m[K.cert.hash])K.cert.hash=m[K.cert.hash];
  for(const fld of ["wear","dragBest"]){const w=K[fld];if(!w||typeof w!=="object")continue;
    for(const o in m)for(const [a,b] of [[o,m[o]],[hKey(o),hKey(m[o])]])if(a in w&&!(b in w)){w[b]=w[a];delete w[a];}}
  if(S.mode==="career")for(const c of fitted)for(const k of ["injectors","fuelPump"]){const o=OPT[k][c[k]];if(locked(o))(K.unlocks=K.unlocks||{})[o._id]=true;}}
function load(){S=freshState();try{const j=localStorage.getItem("pew2-save");if(j)hydrate(JSON.parse(j));}catch(e){}}
/* manual save slots, plus the older one-game "PEW2:" save codes (Restore still reads them; Back up codes are app/savecode.js) */
const SLOTS=3,slotKey=i=>"pew2-slot"+i;
function readSlot(i){try{const j=localStorage.getItem(slotKey(i));return j?JSON.parse(j):null;}catch(e){return null;}}
function writeSlot(i){try{const o=snapshot();o.savedAt=Date.now();localStorage.setItem(slotKey(i),JSON.stringify(o));return true;}catch(e){return false;}}
function clearSlot(i){try{localStorage.removeItem(slotKey(i));}catch(e){}}
function slotSummary(o){if(!o)return"Empty";const d=o.savedAt?new Date(o.savedAt):null;const when=d?d.toLocaleDateString("en-CA",{month:"short",day:"numeric"})+" "+d.toLocaleTimeString("en-CA",{hour:"2-digit",minute:"2-digit"}):"";
  const head=o.mode==="career"||o.mode==="pit"?(o.career?.cv===2?`Career · wk ${o.career?.week??1} · ${fmt$(o.career?.cash??0)}`:"Career (from before team seasons: loads as a new career)"):"Test cell";return`${head} · ${(o.blueprints||[]).length} bp<br>${cfgLbl(Object.assign({},SIM.DEFAULT_CFG,o.cfg))}${when?"<br>"+when:""}`;}
function decodeSave(t){t=(t||"").trim();if(t.startsWith("PEW2:"))t=t.slice(5);const o=JSON.parse(decodeURIComponent(escape(atob(t.replace(/\s+/g,"")))));if(!o||!o.cfg)throw new Error("bad");return o;}
function renderSaves(){const box=$("slots");if(!box)return;let h="";for(let i=1;i<=SLOTS;i++){const o=readSlot(i);h+=`<div class="slot ${o?"full":""}"><div><h3>Slot ${i}${o?"":"<small>empty</small>"}</h3><p>${slotSummary(o)}</p></div><div class="acts"><button class="pri" data-save="${i}">Save</button><button data-load="${i}" ${o?"":"disabled"}>Load</button><button class="del" data-clear="${i}" ${o?"":"disabled"}>Clear</button></div></div>`;}box.innerHTML=h;}
function applyLoaded(o,msg){if(testing){toast("Let the run finish first");return;}if(!hydrate(o)){toast("That save didn't read right.");return;}save();curTab="shop";boot();toast(msg);}
const C=()=>S.career;
function rng(){C().seed=(C().seed*1664525+1013904223)>>>0;return C().seed/4294967296;}
const career=()=>S.mode==="career";
function dev(){return career()&&!!C().dev;}
function has(id){return !career()||dev()||!!C().owned[id];}
function locked(o){return career()&&!dev()&&o&&o.req&&!C().owned[o.req]&&!(C().unlocks&&o._id&&C().unlocks[o._id]);}
function staffed(id){return career()&&(dev()||!!(C().staff&&C().staff[id]&&crewOn(id)));}   // a person on a course is out of the shop (app/crew.js)
function shopBonus(){if(!career())return{};const b={octane:0,rodFat:1,crkFat:1,costFac:1};if(staffed("tuner"))b.octane+=1+0.15*crewL("tuner");if(staffed("machinist"))b.costFac*=0.92-0.01*crewL("machinist");b.costFac*=crewCostK();if(typeof lgCostK==="function")b.costFac*=lgCostK();
  for(const r of RND){if(C().rnd[r.id]&&r.effect){if(r.effect.octane)b.octane+=r.effect.octane;if(r.effect.rodFat)b.rodFat*=r.effect.rodFat;if(r.effect.crkFat)b.crkFat*=r.effect.crkFat;if(r.effect.costFac)b.costFac*=r.effect.costFac;}}return b;}
function syncShop(){S.env.shop=shopBonus();deltaCache.clear();}
function wages(){return career()?STAFF.reduce((a,st)=>a+(C().staff[st.id]?crewWage(st):0),0):0;}
function dynoCap(){if(!career())return{hp:15000,rpm:14000,n:"Test cell dyno"};return has("dyno5")?{hp:15000,rpm:14000,n:"Monster cell"}:has("dyno4")?{hp:3500,rpm:12500,n:"Outlaw cell"}:has("dyno3")?{hp:2000,rpm:12500,n:"Pro cell"}:has("dyno2")?{hp:1000,rpm:10000,n:"Engine dyno"}:{hp:400,rpm:8000,n:"Chassis dyno"};}
function repTier(){let t=REP_TIERS[0];for(const r of REP_TIERS)if(C().rep>=r[0])t=r;return t;}
function repTierIdx(){let i=0;REP_TIERS.forEach((r,k)=>{if(C().rep>=r[0])i=k;});return i;}
/* test-cell climate. Sandbox: whatever S.env says. Career: the standard cell (20 °C, 500 m), unless the Pro dyno
   cell's climate control is installed, in which case the career's own cell settings (C().cell). Only a pull in
   the standard cell certifies, and the strip runs in standard weather. */
const CELL_KEYS=["ambientC","altitudeM","coolantC","oilC"];
function stdCell(){const d=SIM.DEFAULT_ENV,o={};CELL_KEYS.forEach(k=>o[k]=d[k]);return o;}
function careerCell(){const c=C();if(!c.cell||typeof c.cell!=="object")c.cell=stdCell();return c.cell;}
function climateCtl(){return career()&&has("dyno3");}
function trackEvt(t){return t==="drag"||t==="pull_sled"||t==="salt"||t==="road"||t==="race24"||t==="bog"||t==="boat"||t==="hill"||t==="oval";}   // out on the strip or the dirt: the cell's climate control stays home
function simEnv(extra){return Object.assign({},S.env,career()?(climateCtl()&&!trackEvt(S.env.testType)?careerCell():stdCell()):{},extra||{});}
function stdEnv(extra){return Object.assign({},S.env,career()?stdCell():{},extra||{});}
function isStdCell(e){const d=SIM.DEFAULT_ENV;return CELL_KEYS.every(k=>+e[k]===+d[k]);}
function envStore(k){return career()&&CELL_KEYS.includes(k)?careerCell():S.env;}
function envHash(){const e=simEnv();return [e.ambientC,e.altitudeM,e.coolantC,e.oilC,e.shop?JSON.stringify(e.shop):""].join(",");}
const HASH_SKIP={cover:1,twoStepRpm:1,launchRetard:1};   // colour and the launch tune don't make it a different engine
const ROT_KEYS={ecc:1,rotPort:1,apexSeal:1,rotHousing:1,sidePlate:1,eshaft:1,oilMeter:1};   // Wankel parts: no part of a piston engine (and no change to its hash)
const isRot=c=>!!(c&&SIM.isRotary&&SIM.isRotary(c));
const TS_KEYS={cycle:1,scav:1,induct:1,tsFuel:1,xpipe:1,pipeRpm:1,ePort:1,tPort:1,pv:1,lube:1,premix:1,ccr:1};   // two-stroke parts: none of them part of a four-stroke's hash
const isTs=c=>!!(c&&SIM.isTwoStroke&&SIM.isTwoStroke(c));
const HASH_DEF={pipe:"stock",muffler:"stock",cat:"none",cutout:"none",turbine:"fixed",als:"off"};   // the exhaust system at its defaults is the engine every older hash was made from
function cfgHash(c){const dsl=isCI(c.fuel),rot=isRot(c),ts=isTs(c);return JSON.stringify(Object.keys(c).filter(k=>!HASH_SKIP[k]&&!(!rot&&ROT_KEYS[k])&&!(!ts&&TS_KEYS[k])&&!(HASH_DEF[k]&&(!c[k]||c[k]===HASH_DEF[k]))&&!(k==="map"&&!c[k])&&!((k==="launchCtl"||k==="transBrake")&&(!c[k]||c[k]==="none"))&&!(!dsl&&(k==="dInj"||k==="dNoz"))&&!(k==="ethanolPct"&&c.fuel!=="flex")&&!(k==="gasSys"&&!isGasF(c.fuel))).sort().map(k=>c[k]));}
// fuel families: compression-ignition fuels (diesel, B100) vs everything with a spark plug
function isCI(f){const o=OPT.fuel[f];return !!(o&&o.ci);}
/* displacement for display: cc below a litre ("125 cc"), litres from 1.0 up. sp: the gap before "L" */
function fmtDisp(L,sp){return L<1?Math.round(L*1000)+" cc":L.toFixed(1)+(sp==null?" ":sp)+"L";}
function cfgLbl(cfg){return SIM.cfgLabel(cfg).replace(/(\d+\.\d+) L\b/,(m,v)=>+v<1?fmtDisp(presetDisp({cfg})):m);}   // SIM.cfgLabel prints litres; small engines read in cc
function fuelShort(f){const o=OPT.fuel[f];return !o?String(f):o.ci?(f==="b100"?"B100":"Diesel"):o.short||o.name.split(" ")[0];}
function isGasF(f){const o=OPT.fuel[f];return !!(o&&o.gas);}
const INJ_SHORT={rotary_ve:"VE",inline_mech:"P-pump",heui:"HEUI",cr_gen1:"CR",cr_piezo:"CR",unit_dd:"unit inj"};
function fuelBill(){if(!career()||dev())return 0;const fu=SIM.fuelOf(S.cfg)||SIM.OPT.fuel.r91;const hp=quick&&isFinite(quick.peakHp)?quick.peakHp:300;
  // WOT burn: ~0.32 L/hp/h on gasoline, more on low-energy fuels (per-litre energy vs pump gas)
  const lph=hp*(fu.ci?0.23*(42.8e6/fu.lhv):0.32*(44e6/fu.lhv))*(fu.gas?0.745/fu.dens:1);const t=S.env.testType;   // gas: litres of liquid propane / kg of CNG   // diesel ~0.23 L/hp/h at full load
  // endurance is an accelerated cycle, not real hours: cell burn ≈ 0.6·√hours (50 h → 4 h, 1,000 h → 19 h)
  const hours=t==="endurance"?0.6*Math.sqrt(S.env.hours)*({highway:.2,mixed:.45,track:.9}[S.env.loadProfile]||.45):t==="drag"?0.012:t==="pull_sled"?0.01:t==="bog"?0.012:t==="boat"?0.008:t==="salt"?0.03:t==="road"?0.03:t==="hill"?0.04:t==="oval"?0.03:t==="race24"?0:t==="overrev"?0.008:0.02;   // the 24 Hours bills its fuel by the litre after the flag
  return Math.round(lph*hours*fu.costL);}
function testCost(){if(dev()||(PO&&S.env.testType==="pull_sled"))return 0;if(S.env.testType==="oval")return ovalCost();if(S.env.testType==="salt")return saltFee()+fuelBill();if(S.env.testType==="race24")return career()?E24_FEE:0;if(S.env.testType==="boat")return boatFee()+fuelBill();const tt=S.env.testType,cell=career()&&!(staffed("dynotech")&&(tt==="pull"||tt==="endurance"||tt==="overrev"))?({pull:75,endurance:450,overrev:150,drag:rnLive()?0:250,pull_sled:150,road:ROAD_FEE,bog:bogFee(S.env.bogCls),hill:hillFee(S.env.hillCls)}[S.env.testType]||75):0;return cell+fuelBill();}
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("on");toastPlace();clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove("on"),2600);toast.until=Date.now()+2600;}
/* the toast and the achievement banner share the foot of the screen. Phone: the toast sits just above whatever is docked there
   (the tab bar, or the results sheet, measured: it can be taller than its peek line) and the banner stacks above the toast.
   Desktop: the toast sits at the top of the view and the banner drops below it. Neither ever hides the other. */
function toastPlace(){const t=$("toast"),a=$("achToast");if(!t||!a)return;
  if(!toastPlace.raf&&(t.classList.contains("on")||a.classList.contains("on")))toastPlace.raf=requestAnimationFrame(()=>{toastPlace.raf=0;toastPlace();});   // follow the dock while either is showing (the sheet can resize under them)
  if(document.documentElement.classList.contains("desk")){t.style.removeProperty("--tbot");a.style.removeProperty("--abot");
    const th=t.classList.contains("on")?Math.round(t.getBoundingClientRect().height):0;a.style.setProperty("--atop",Math.max(140,84+th+10)+"px");return;}
  const app=$("app"),tabs=$("tabs");if(!app||!tabs)return;const ab=app.getBoundingClientRect().bottom;
  let top=tabs.getBoundingClientRect().top;if(typeof railTop==="function"){const r=railTop();if(r<top)top=r;}
  const tb=Math.max(0,Math.round(ab-top))+14,th=t.classList.contains("on")?Math.round(t.getBoundingClientRect().height):38;
  t.style.setProperty("--tbot",tb+"px");a.style.setProperty("--abot",(tb+th+8)+"px");a.style.removeProperty("--atop");}
window.addEventListener("resize",()=>{try{toastPlace();}catch(e){}});
/* a toast that waits for the one on screen to finish (the goal toast must not hide the sale toast) */
function toastAfter(msg){setTimeout(()=>toast(msg),Math.max(0,(toast.until||0)-Date.now())+250);}

/* ===================== live compute ===================== */
/* stress heat-map: zones on the 3D engine tinted by the worst utilisation of the tests that live there */
const ZONE_OF={rod_tension:1,rod_buckling:1,rod_bolts:1,crank_fatigue:1,bearing_load:1,oil_film:1,
  detonation:2,preignition_egt:2,piston_speed:2,crown_temp:2,crown_pressure:2,hot_clearance:2,slap_blowby:2,ring_gap:2,bore_distortion:2,wall_thickness:2,
  head_lift:3,gasket_shear:3,valve_float:3,valve_piston:3,cooling:3,valve_temp:4,turbine_temp:5,compressor_map:5,oil_starvation:6,torsional:7};
ZONE_OF.fuel_delivery=2;ZONE_OF.cold_start=2;ZONE_OF.vgt_vanes=5;ZONE_OF.als_heat=5;
Object.assign(ZONE_OF,{apex_seal:2,housing_chatter:2,carbon_seals:2,coolant_seal:3,eshaft:1,oil_metering:6});   // rotary tests
Object.assign(ZONE_OF,{ts_seize:2,port_wear:2,crank_seals:1,pipe_crack:4,plug_foul:3,scav_air:5});   // two-stroke tests
const ZONE_NAME_TS={2:"Barrels, pistons & ports",3:"Heads & spark plugs",4:"Expansion chambers",5:"Scavenge air: blower & turbo",6:"Premix & oil pump"};
const ZONE_NAME_ROT={1:"Eccentric shaft & rotor bearings",2:"Rotors, apex seals & housings",3:"Hot lobe, plugs & coolant seals",7:"Front cover, OMP & pulley"};
const ZONE_NAME={1:"Crankcase & rotating assembly",2:"Cylinders & pistons",3:"Head, gasket & valvetrain",4:"Exhaust",5:"Turbocharger",6:"Sump & oiling",7:"Front drive & damper"};
function heatZones(){if(!quick)return null;const worst={};for(const t of quick.tests){const z=ZONE_OF[t.id];if(!z)continue;if(t.id==="turbine_temp"||t.id==="compressor_map"){if(S.cfg.asp==="na")continue;}
    if(!worst[z]||t.util>worst[z])worst[z]=t.util;}
  return Object.keys(worst).map(z=>{const u=worst[z];let c,a,pulse=false;if(u>1){c=[0.95,0.18,0.12];a=0.62;pulse=true;}else if(u>0.8){c=[1,0.66,0.15];a=0.28+0.3*(u-0.8)/0.2;}else{c=[0.25,0.85,0.5];a=0.10+0.18*Math.max(0,(u-0.4)/0.4);}
    return{zone:+z,r:c[0],g:c[1],b:c[2],amount:a,pulse};});}
function applyGfx(){const q=S.gfx||deskGfx()||(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)?"lite":"full");ENGINE_VIS.setQuality(q);document.querySelectorAll("#gfxSeg button").forEach(b=>b.classList.toggle("on",b.dataset.gfx===q));}
(()=>{const cs=$("camSeg");if(cs&&!$("nightSeg"))cs.insertAdjacentHTML("afterend",`<div class="lbl"><span>Night racing</span></div><div class="seg n2" id="nightSeg"><button data-night="0">Day<small>afternoon at the strip</small></button><button data-night="1">Night<small>under the lights</small></button></div>`);})();
function applyNight(){document.querySelectorAll("#nightSeg button").forEach(b=>b.classList.toggle("on",(b.dataset.night==="1")===!!S.night));}
$("nightSeg").addEventListener("click",e=>{const b=e.target.closest("[data-night]");if(!b)return;S.night=b.dataset.night==="1";applyNight();save();toast(S.night?"NIGHT RACING · strip lights on":"DAY RACING");});
function applyCam(){document.querySelectorAll("#camSeg button").forEach(b=>b.classList.toggle("on",(b.dataset.cam==="1")===(S.followCam!==false)));}
$("camSeg").addEventListener("click",e=>{const b=e.target.closest("[data-cam]");if(!b)return;S.followCam=b.dataset.cam==="1";applyCam();save();});
function applyXray(){$("xrayBtn").classList.toggle("on",!!S.xray);ENGINE_VIS.setXray(!!S.xray);}
$("gfxSeg").addEventListener("click",e=>{const b=e.target.closest("[data-gfx]");if(!b)return;S.gfx=b.dataset.gfx;applyGfx();save();toast(S.gfx==="ultra"?"ULTRA · bloom + ambient occlusion":S.gfx==="full"?"FULL GRAPHICS · bloom on":"LITE GRAPHICS");});
$("xrayBtn").addEventListener("click",()=>{S.xray=!S.xray;applyXray();save();toast(S.xray?(isRot(S.cfg)?"X-RAY · rotors and eccentric shaft live":isTs(S.cfg)?"X-RAY · pistons opening the ports live":"X-RAY · crank, rods and pistons live"):"X-RAY OFF");});
function applyHeat(){$("heatBtn").classList.toggle("on",!!S.heat);ENGINE_VIS.setHeat(S.heat?heatZones():null);}
function zoneSheet(z){if(!quick||!ZONE_NAME[z])return;const rows=quick.tests.filter(t=>ZONE_OF[t.id]===z&&!((t.id==="turbine_temp"||t.id==="compressor_map")&&S.cfg.asp==="na")).sort((a,b)=>b.util-a.util);
  $("sheetTitle").textContent=(isRot(S.cfg)&&ZONE_NAME_ROT[z])||(isTs(S.cfg)&&ZONE_NAME_TS[z])||ZONE_NAME[z];
  $("sheetBody").innerHTML=rows.map(t=>`<div class="opt"><b>${t.name}</b><small class="${t.util>1?"critc":t.util>0.8?"warnc":""}">${Math.round(t.util*100)}% of limit</small><div class="bar" style="margin:6px 0"><i style="width:${Math.min(100,t.util*80)}%;background:${t.util>1?"var(--crit)":t.util>0.8?"var(--warn)":"var(--good)"}"></i></div><p>${t.physics||""}</p>${t.fix?`<p style="color:var(--muted)">${t.fix}</p>`:""}</div>`).join("")||"<p class='hint'>Nothing measured here.</p>";
  $("sheet").classList.add("on");$("scrim").classList.add("on");}
$("tag").addEventListener("change",e=>{if(e.target.id==="nameIn"){S.name=e.target.value.trim()||null;save();}});
$("tag").addEventListener("keydown",e=>{if(e.target.id==="nameIn"&&e.key==="Enter")e.target.blur();});
$("soloSeg").addEventListener("click",e=>{const b=e.target.closest("[data-solo]");if(!b)return;if(b.dataset.solo==="rebuild"){ENGINE_SOUND.rebuild();toast("SOUND GRAPH REBUILT");return;}
  ENGINE_SOUND.solo(b.dataset.solo);document.querySelectorAll("#soloSeg button").forEach(x=>x.classList.toggle("on",x.dataset.solo===b.dataset.solo));toast(`SOLO · ${b.textContent.toUpperCase()}`);});
setInterval(()=>{const el=$("sdPeak");if(!el||!setOn())return;const pk=ENGINE_SOUND.peak();el.textContent=pk?`${pk.hz} Hz @ ${pk.db} dB · low ${pk.lo} dB · ${pk.state} ${pk.sr/1000}k`:"—";},400);
/* frame rate: S.showFps puts a readout in the view; S.fpsCap 60 has ENGINE_VIS (and tick) skip the extra vsyncs of a 90/120 Hz screen */
function applyFps(){const cap=S.fpsCap==null?(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)?60:0):(S.fpsCap===60?60:0);   /* phones default to the 60 cap (a 120 Hz screen otherwise spends its battery on the garage); the toggle stores 0 or 60 and wins once touched */ENGINE_VIS.setFpsCap(cap);$("fpsHud").classList.toggle("on",!!S.showFps);document.querySelectorAll("#fpsSeg button").forEach(b=>b.classList.toggle("on",(b.dataset.fps==="1")===!!S.showFps));document.querySelectorAll("#capSeg button").forEach(b=>b.classList.toggle("on",+b.dataset.cap===cap));fpsShow();}
function fpsShow(){const f=ENGINE_VIS.fps(),r=Math.round(f.fps);if(S.showFps)$("fpsHud").innerHTML=r?`<b class="${r<30?"crit":r<50?"warn":""}">${r}</b> fps <i>· ${f.ms.toFixed(1)} ms</i>`:"— fps";if(curTab==="shop")$("fpsLbl").textContent=r?`${r} fps · ${f.ms.toFixed(1)} ms`:"—";}
setInterval(fpsShow,500);
$("fpsSeg").addEventListener("click",e=>{const b=e.target.closest("[data-fps]");if(!b)return;S.showFps=b.dataset.fps==="1";applyFps();save();});
$("capSeg").addEventListener("click",e=>{const b=e.target.closest("[data-cap]");if(!b)return;S.fpsCap=+b.dataset.cap===60?60:0;applyFps();save();toast(S.fpsCap?"CAPPED AT 60 FPS":"FRAME RATE · DISPLAY MAX");});
function renderDev(){$("devBox").style.display=career()?"":"none";if(!career())return;document.querySelectorAll("#devSeg button").forEach(b=>b.classList.toggle("on",(b.dataset.dev==="1")===dev()));$("devRow").style.display=dev()?"":"none";}
$("devSeg").addEventListener("click",e=>{const b=e.target.closest("[data-dev]");if(!b||!career())return;C().dev=b.dataset.dev==="1";toast(C().dev?"DEV MODE ON — everything unlocked, tests free":"Dev mode off");renderDev();hud();recompute();save();renderBuild();renderPresets();renderShop();renderTest();});
$("devCash").addEventListener("click",()=>{if(!career())return;C().cash+=1e6;hud();save();toast("+$1,000,000");});
$("devRep").addEventListener("click",()=>{if(!career())return;C().rep+=500;hud();save();toast("+500 rep");});
$("devWeek").addEventListener("click",()=>{if(!career()||typeof advanceWeek!=="function")return;advanceWeek();save();hud();renderShop();recompute();});
$("sqSeg").addEventListener("click",e=>{const b=e.target.closest("[data-sq]");if(!b)return;S.soundQ=b.dataset.sq;applySoundQuality();save();});
/* recorded engine layer: Synth / Real recordings / Blend (default Blend) + the credits sheet */
function applySoundSrc(){const m=S.soundSrc||"blend";if(typeof ENGINE_SAMPLES!=="undefined")ENGINE_SAMPLES.setMode(m);document.querySelectorAll("#srcSeg button").forEach(b=>b.classList.toggle("on",b.dataset.src===m));}
$("srcSeg").addEventListener("click",e=>{const b=e.target.closest("[data-src]");if(!b)return;S.soundSrc=b.dataset.src;applySoundSrc();save();toast(`ENGINE VOICE · ${b.firstChild.textContent.toUpperCase()}`);});
setInterval(()=>{const el=$("srcLbl");if(!el||!setOn()||typeof ENGINE_SAMPLES==="undefined")return;const t=ENGINE_SAMPLES.stats();
  el.textContent=t.mode==="synth"?"synth only":t.set?`${t.setName}${t.set2?" + "+t.set2Name:""} · ${Math.round(t.cover*100)}% recorded`:t.errors&&!t.decoded?"recordings unavailable · synth":t.slow&&t.mode!=="real"?"slow connection · synth":"loads when sound starts";},500);
function sndCredits(){
  const L=(typeof ENGINE_SAMPLES!=="undefined"&&ENGINE_SAMPLES.credits)||[];$("sheetTitle").textContent="Sound credits";
  $("sheetBody").innerHTML=`<p class="hint">Real engine recordings used by the Real and Blend engine voices. All are openly licensed; files were trimmed, looped, level-matched, converted to mono MP3 and are pitch-shifted live. Full list: <a href="sounds/CREDITS.md" target="_blank" rel="noopener" style="color:var(--orange)">sounds/CREDITS.md</a>.</p>`
    +L.map(c=>`<div class="opt"><div class="oh"><b>${esc(c.title)}</b><span class="tag">${esc(c.license)}</span></div><p>${esc(c.use)} · by ${esc(c.author)} · <a href="${esc(c.src)}" target="_blank" rel="noopener" style="color:var(--orange)">source</a>${c.licUrl?` · <a href="${esc(c.licUrl)}" target="_blank" rel="noopener" style="color:var(--orange)">license</a>`:""}${c.mods?`<br><small>${esc(c.mods)}</small>`:""}</p></div>`).join("");
  $("sheet").classList.add("on");$("scrim").classList.add("on");}
$("sndCredBtn").addEventListener("click",sndCredits);
$("themeSeg").addEventListener("click",e=>{const b=e.target.closest("[data-theme]");if(!b)return;S.theme=b.dataset.theme;applyTheme();save();});
$("puSeg").addEventListener("click",e=>{const b=e.target.closest("[data-pu]");if(!b)return;S.psi=b.dataset.pu==="psi";applyPU();save();});
$("hapSeg").addEventListener("click",e=>{const b=e.target.closest("[data-hap]");if(!b)return;S.haptics=b.dataset.hap==="1";applyTheme();save();if(S.haptics)buzz(12);});
if(window.matchMedia)window.matchMedia("(prefers-color-scheme: light)").addEventListener?.("change",()=>{if(S.theme==="auto")applyTheme();});
$("heatBtn").addEventListener("click",()=>{S.heat=!S.heat;applyHeat();save();toast(S.heat?"HEAT-MAP ON · TAP A ZONE":"HEAT-MAP OFF");});
(()=>{let d=null;const gl=$("gl");gl.addEventListener("pointerdown",e=>{d={x:e.clientX,y:e.clientY,t:performance.now()};},{passive:true});
  gl.addEventListener("pointerup",e=>{if(!d||!S.heat||e.button)return;const mv=Math.hypot(e.clientX-d.x,e.clientY-d.y),dt=performance.now()-d.t;d=null;if(mv>9||dt>400)return;const z=ENGINE_VIS.zoneAt(e.clientX,e.clientY);if(z)zoneSheet(z);},{passive:true});})();
/* ---- engine card: name + headline numbers + status, reused everywhere an engine is shown ---- */
const ASP_SYM={na:"NA",turbo:"T",twin_turbo:"TT",roots:"SC",centrifugal:"SC",screw:"SCREW",compound:"CT"};
function engineName(){return S.name||autoName();}
function autoName(){const p=PRESETS.find(x=>x.soundProfile&&x.soundProfile===S.profileId)||null;return p?p.name:`Custom ${isRot(S.cfg)?LAYOUTS[S.cfg.layout].n+"-rotor":isTs(S.cfg)?"two-stroke "+S.cfg.layout:S.cfg.layout} ${quick?fmtDisp(quick.Vd/1000,""):""}`;}
const ROT_PORT_SHORT={side:"side port",sidex:"side exhaust",street:"street port",bridge:"bridge port",peri:"peri port"};
function engineSpecLine(cfg,res){const L=LAYOUTS[cfg.layout];const asp=cfg.asp==="na"?"NA":(ASP_SYM[cfg.asp]||cfg.asp.toUpperCase())+(cfg.asp!=="na"?" "+cfg.boost.toFixed(1)+"bar":"");
  if(isTs(cfg))return `<b>2T ${cfg.layout==="D18"?"Deltic":cfg.layout}</b><i>·</i>${fmtDisp(res.Vd/1000,"")}<i>·</i>${cfg.bore.toFixed(0)}×${cfg.stroke.toFixed(0)}<i>·</i>${{loop:"loop",cross:"cross",uniflow:"uniflow"}[cfg.scav]||"loop"}<i>·</i>${cfg.xpipe==="chamber"&&!isCI(cfg.fuel)?"pipe "+(cfg.pipeRpm/1000).toFixed(1)+"k":cfg.induct==="blower"?"blown":cfg.induct}<i>·</i>${asp}<i>·</i>${fuelShort(cfg.fuel)}${isCI(cfg.fuel)?" "+(INJ_SHORT[cfg.dInj]||"VE"):""}`;
  if(isRot(cfg))return `<b>${L.n}-rotor</b><i>·</i>${fmtDisp(res.Vd/1000,"")}<i>·</i>${ROT_PORT_SHORT[cfg.rotPort]||"side port"}<i>·</i>${cfg.cr.toFixed(1)}:1<i>·</i>${asp}<i>·</i>${fuelShort(cfg.fuel)}`;
  return `<b>${cfg.layout}</b><i>·</i>${fmtDisp(res.Vd/1000,"")}<i>·</i>${cfg.bore.toFixed(0)}×${cfg.stroke.toFixed(0)}<i>·</i>${cfg.cr.toFixed(1)}:1<i>·</i>${asp}<i>·</i>${fuelShort(cfg.fuel)}${isCI(cfg.fuel)?" "+(INJ_SHORT[cfg.dInj]||"VE"):""}`;}
function engineStatus(cfg,res){const h=cfgHash(cfg);
  if(res.fails&&res.fails.length)return (S.ranH||[]).includes(h)?{cls:"bad",txt:"✗ BREAKS"}:{cls:"",txt:"○ NOT RUN YET",nr:true};
  if(career()){const T=pcTeam();if(T&&h===cfgHash(S.cfg)){const k=pcChecks(T);if(k.need>pcLeft(T))return{cls:"bad",txt:"✗ OVER BUDGET"};if(k.ok)return{cls:"ok",txt:`✓ READY FOR ROUND ${T.round+1}`};}
    const c=C().cert;if(c&&c.hash===h&&c.ok)return{cls:"ok",txt:"✓ CERTIFIED"};return{cls:"",txt:"○ UNCERTIFIED"};}
  return{cls:"ok",txt:"● TEST CELL"};}
function engineCard(cfg,res,o){o=o||{};const st=engineStatus(cfg,res);const name=o.name||engineName();
  const nums=`<b>${Math.round(res.peakHp)}</b>hp<i>·</i><b>${Math.round(res.peakTq)}</b>Nm<i>·</i>rel <b>${st.nr?"—":Math.round(res.rel)}</b><i>·</i><b>${fmt$(res.cost)}</b>`;
  return `<div class="ecard ${o.cls||""}"><div class="nm">${o.editable?`<input id="nameIn" value="${name.replace(/"/g,"&quot;")}" maxlength="24" aria-label="Engine name">`:name}</div><span class="badge ${st.cls}">${st.txt}</span><div class="spec">${nums}</div><div class="spec">${engineSpecLine(cfg,res)}</div>${launchLine(cfg)?`<div class="spec"><b>Launch</b><i>·</i>${launchLine(cfg,true)}</div>`:""}</div>`;}
/* phones: slider and env input events ask for one recompute per animation frame (recomputeSoon); the label writes stay synchronous, the
   after-work (delta chips, power window) runs once the sim has caught up, and a commit (change / pointerup / Enter) flushes at once */
let rcRaf=0,rcAfter=new Map();
function recomputeSoon(key,fn){if(fn)rcAfter.set(key,fn);if(!rcRaf)rcRaf=requestAnimationFrame(()=>{rcRaf=0;recompute();});}
function recomputeFlush(){if(rcRaf){cancelAnimationFrame(rcRaf);rcRaf=0;recompute();}}
let prevQuick=null;
function stripFlash(id,d,fmt,lowGood){const el=$(id).parentElement;let t=el.querySelector(".d");if(!t){t=document.createElement("span");t.className="d";el.appendChild(t);}
  if(!d){t.classList.remove("show");return;}t.textContent=(d>0?"▲":"▼")+fmt(Math.abs(d));t.classList.toggle("dn",lowGood?d>0:d<0);t.classList.add("show");clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove("show"),1800);}
function recompute(){
  if(rcRaf){cancelAnimationFrame(rcRaf);rcRaf=0;}   // a direct call covers the pending frame
  altFuelFill(S.cfg);   // flex needs a blend and a gas fuel a gas system before the engine is run
  prevQuick=quick;
  quick=SIM.simulate(S.cfg,simEnv({testType:"pull"}));
  if(prevQuick&&prevQuick!==quick){stripFlash("sHp",Math.round(quick.peakHp-prevQuick.peakHp),v=>v);stripFlash("sKg",Math.round(quick.kg-prevQuick.kg),v=>v,true);stripFlash("sCost",Math.round(quick.cost-prevQuick.cost),v=>"$"+v.toLocaleString("en-CA"),true);stripFlash("sDisp",+(quick.Vd/1000-prevQuick.Vd/1000).toFixed(1),v=>v.toFixed(1));}
  combosNow=SIM.combos(S.cfg,simEnv({testType:"pull"}),quick);
  if(S.heat)applyHeat();
  if(document.activeElement&&document.activeElement.id==="nameIn"){/* don't clobber while typing */}else $("tag").innerHTML=engineCard(S.cfg,quick,{editable:true});
  {const cc=quick.Vd<1000;$("sDisp").textContent=cc?Math.round(quick.Vd):(quick.Vd/1000).toFixed(1);$("sDisp").nextElementSibling.textContent=cc?"cc":"Litres";}$("sHp").textContent=Math.round(quick.peakHp);$("sKg").textContent=Math.round(quick.kg);$("sCost").textContent=fmt$(quick.cost);if(career())pcHud();
  const worst=Math.max(...quick.tests.map(t=>t.util));$("sHp").className=worst>1?"critc":worst>.8?"warnc":"";
  if(typeof tabBadges==="function")tabBadges();
  fuelHdr();
  if(typeof swapRender==="function"&&$("swapAcc"))swapRender();   // the swap fit follows the engine
  if(typeof railSched==="function")railSched();   // the results rail follows it too (app/rail.js)
  if(rcAfter.size){const a=[...rcAfter.values()];rcAfter.clear();a.forEach(f=>f());}   // what recomputeSoon callers queued
}
function hud(){
  if(typeof tabBadges==="function")tabBadges();
  if(career()){$("cashLbl").textContent=fmt$(C().cash);$("cashLbl").style.color=C().cash<0?"var(--crit)":"";$("repLbl").textContent=`Rep ${C().rep} · ${repTier()[1]}`;pcHud();}
  else{$("cashLbl").textContent="Test cell";$("cashLbl").style.color="var(--chalk)";$("repLbl").textContent="all parts unlocked";$("weekLbl").textContent="SANDBOX";}
  if(typeof lgHud==="function")lgHud();
}

