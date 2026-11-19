/* ---- drag: the setup screen, records, wear, race-night tables and the timing slip card ----
   the pass itself and the nights as they are run are in app/drag-run.js, which goes into app-late.js (since 1.76.140.0) */
let DR=null;
/* bolt-on wheelie bars: only for bodies that do not already have them; ~10 kg on the tail */
const WBAR_KG=10,WBAR_COST=1500;function wbarOwned(){if(career()&&!C().wbarOwn&&S.env&&S.env.wbar==="yes")C().wbarOwn=1;return !career()||!!C().wbarOwn;}   // career: paid once (C().wbarOwn), then re-fitted free; sandbox free; saves fitted before the price keep theirs
function wbarOn(e){e=e||S.env;return e.wbar==="yes"&&wbarOwned()&&!(SIM.AERO[e.body||"street"]||{}).bars;}
/* power-to-weight against the drag car as set up (weight slider, bolt-on bars, a swap car's own weight) */
function pwRatio(hp){let m=S.env.mass||1400;try{m=dragVeh().mass||m;}catch(e){}return {m:Math.round(m),hpt:hp>0?Math.round(hp/(m/1000)):0,kgHp:hp>0?m/hp:0};}
function pwTxt(hp){const r=pwRatio(hp),d=r.m-(S.env.mass||0)-(wbarOn()?WBAR_KG:0);return `${d&&!swapLive()?`${r.m.toLocaleString("en-CA")} kg with this engine · `:""}${r.hpt.toLocaleString("en-CA")} hp/t · ${r.kgHp.toFixed(r.kgHp<10?2:1)} kg/hp`;}
function pwUpd(){const el=$("evPw");if(el&&quick)el.textContent=pwTxt(quick.peakHp);}
/* the engine as built, for its weight on the strip (the live result when it is current) */
function engKgNow(){if(quick&&quick.kg>0)return quick.kg;try{return SIM.simulate(S.cfg,simEnv({testType:"pull"})).kg||0;}catch(e){return 0;}}
function dragVeh(){const e=S.env,lt=SIM.launchTech(S.cfg),ekg=engKgNow();return swapDragOv({mass:SIM.dragMass(e.mass,ekg)+(wbarOn(e)?WBAR_KG:0),engKg:Math.round(ekg),wbar:wbarOn(e),rearBias:e.rearBias,tyre:e.tyre,tyreDia:e.tyreDia,gears:e.gears,first:e.first,top:e.top,final:e.final,ratios:dragRatios(),rideH:+e.rideH||0,shiftRpm:e.shiftRpm>0?Math.min(e.shiftRpm,S.cfg.redline):0,launchRpm:lt.launchCtl!=="none"?lt.twoStepRpm:Math.min(e.launchRpm,S.cfg.redline),auto:e.shiftMode!=="manual",redline:S.cfg.redline,body:e.body||"street",chute:e.chute==="yes",launchCtl:lt.launchCtl,twoStepRpm:lt.twoStepRpm,launchRetard:lt.launchRetard,transBrake:lt.transBrake,dtCap:SIM.dtCapOf(drvId()),dtId:drvId()});}   // a chosen swap car (app/swap.js) brings its own weight, tyres and drag
/* launch hardware, in words, only when something is fitted */
/* anti-lag that will actually fire: a petrol turbo with it fitted */
function alsOf(cfg){const a=cfg&&cfg.als;return a&&a!=="off"&&OPT.als&&OPT.als[a]&&(OPT.asp[cfg.asp]||{}).kind==="turbo"&&!isCI(cfg.fuel)?a:null;}
function launchLine(cfg,short){const lt=SIM.launchTech(cfg);const b=[];const als=alsOf(cfg);
  if(short){if(lt.launchCtl!=="none")b.push(`2-step ${(lt.twoStepRpm/1000).toFixed(1)}k${lt.launchCtl==="two_step_retard"?" +"+Math.round(lt.launchRetard)+"°":""}`);if(lt.transBrake!=="none")b.push(lt.transBrake==="trans_brake"?"trans-brake":"line lock");if(als)b.push(als==="air"?"ALS air":"ALS");return b.join(" · ");}
  if(als)b.push(als==="air"?"secondary-air anti-lag":"ignition anti-lag");
  if(lt.launchCtl==="two_step")b.push(`two-step ${lt.twoStepRpm.toLocaleString()}`);else if(lt.launchCtl==="two_step_retard")b.push(`two-step ${lt.twoStepRpm.toLocaleString()} · ${Math.round(lt.launchRetard)}° retard`);
  if(lt.transBrake==="trans_brake")b.push("trans-brake");else if(lt.transBrake==="line_lock")b.push("line lock");return b.join(" · ");}
function hKey(h){let x=5381;for(let i=0;i<h.length;i++)x=((x*33)^h.charCodeAt(i))>>>0;return x.toString(36);}
function dragWear(){if(!career())return null;const h=hKey(cfgHash(S.cfg));C().wear=C().wear||{};return C().wear[h]||0;}
function wearBudget(res){return res.raceSpec?res.racePasses:Math.max(2,Math.round(res.lifeHours/25));}
function wearInfo(res){const p=dragWear();if(p==null||!res)return null;const b=wearBudget(res);return{passes:+p.toFixed(1),budget:b,w:Math.min(1.5,p/Math.max(1,b))};}
function addWear(n,hk){if(!career())return;const h=hk||hKey(cfgHash(S.cfg));C().wear=C().wear||{};C().wear[h]=+((C().wear[h]||0)+n).toFixed(2);}
/* a test reads the build, mode and career it started on; a run whose mode or career changed underneath books nothing */
function testSnap(){return{cfg:Object.assign({},S.cfg),h:cfgHash(S.cfg),car:S.career,mode:S.mode};}
function testSame(s){return!!s&&S.mode===s.mode&&S.career===s.car;}
function freshenCost(res){return Math.max(500,Math.round(res.cost*0.15/50)*50);}
function rnFreshCost(res){const c=freshenCost(res),k=career()?crewRnFreshK():1;return k===1?c:Math.round(c*k/50)*50;}   // race-night pits: the crew's fast hands or nerves (app/crew.js)
/* personal bests: quickest passes and biggest pulls, kept per mode (career on C().rec, sandbox on S.sbRecords) */
function recs(){const o=career()?C():S,k=career()?"rec":"sbRecords";let R=o[k];if(!R||typeof R!=="object")R=o[k]={};if(!Array.isArray(R.top))R.top=[];if(!R.topBy||typeof R.topBy!=="object")R.topBy={};if(!career()&&(!R.eng||typeof R.eng!=="object"))R.eng={};return R;}
function dragRecHtml(){const R=recs(),ks=Object.keys(SIM.AERO).filter(k=>Array.isArray(R.topBy[k])&&R.topBy[k][0]);if(!ks.length)return "";
  return `<div class="rtop"><span>Strip · quickest per body</span>${ks.map(k=>{const e=R.topBy[k][0],n=R.topBy[k].length;return `<div><b>${n}</b><span class="et">${e.et.toFixed(3)}</span><span>${Math.round(e.mph)} mph</span><span class="nm" title="${esc(e.n)} · ${n} pass${n>1?"es":""} booked">${esc(SIM.AERO[k].n)}</span><span>${e.w!=null?"wk "+e.w:e.d?new Date(e.d).toLocaleDateString("en-CA",{month:"short",day:"numeric"}):""}</span></div>`;}).join("")}</div>`;}
function allBest(){const t=recs().top[0];return Math.min(t?t.et:Infinity,career()&&C().bestEt||Infinity);}
function recTag(){const e={n:engineName().slice(0,28),d:Date.now()};if(career())e.w=C().week;return e;}
const etFix=(a,b)=>a.toFixed(2)===b.toFixed(2)?3:2;   // two decimals unless that hides the gain
/* dyno: highest certified (career) / clean pulled (sandbox) hp and the best reliability; a new top hp gets a toast */
function pbPull(res){const R=recs(),hp=Math.round(res.peakHp),was=career()?Math.round(C().bestHp||0):R.hp?R.hp.v:0,rw=career()?C().bestRel||0:R.rel?R.rel.v:0;
  if(hp>was){R.hp=Object.assign({v:hp},recTag());if(was>0)setTimeout(()=>toast(`New record: ${hp.toLocaleString("en-CA")} hp (was ${was.toLocaleString("en-CA")})`),2700);}
  if(res.rel>rw||(!R.rel&&res.rel>=rw))R.rel=Object.assign({v:res.rel,hp},recTag());}
/* ---- compact strip HUD on the 3D view (#stripHud): built when a pass starts, updated in place every frame (only nodes whose
   text changed are touched). It carries what #dragLive carried; while it is up (html.shud) the panel copy and #rpmbox step aside. ---- */
let SH=null,SHgen=0;
function shudStart(){const el=$("stripHud");if(!el)return;clearTimeout(shudStop.t);
  el.innerHTML=`<div class="shr"><i></i></div><div class="shc"></div><div class="shn"><span></span><b></b></div>`;
  SH={el,row:el.querySelector(".shc"),bar:el.querySelector(".shr"),bi:el.querySelector(".shr i"),cap:el.querySelector(".shn span"),rpm:el.querySelector(".shn b"),keys:"",nodes:[],m:{},gen:++SHgen};
  el.hidden=false;document.documentElement.classList.add("shud");}
function shudStop(ms){const g=SHgen;clearTimeout(shudStop.t);shudStop.t=setTimeout(()=>{if(g!==SHgen)return;const el=$("stripHud");if(el){el.hidden=true;el.innerHTML="";}SH=null;document.documentElement.classList.remove("shud");},ms||0);}
function shudSet(k,node,v,prop){if(SH.m[k]===v)return;SH.m[k]=v;if(prop==="cls")node.className=v;else if(prop)node.style[prop]=v;else node.innerHTML=v;}
const shSur=n=>{const w=String(n||"").trim().split(/\s+/);return w[w.length-1]||"";},shOpp=n=>String(n||"").length<=12?String(n||""):shSur(n);   // "Halcyon GT" whole, "Dale Kowalchuk" → "Kowalchuk"
/* one row of cells [key, label, value html, class]: rebuilt only when the set changes, otherwise text in place (also the team replay, app/team-watch.js) */
function shudRow(c){const keys=c.map(x=>x[0]).join();if(keys!==SH.keys){SH.keys=keys;SH.row.innerHTML=c.map(()=>`<div class="shx"><span></span><b></b></div>`).join("");SH.nodes=Array.from(SH.row.children);SH.m={};}
  c.forEach((x,i)=>{const nd=SH.nodes[i];shudSet("c"+i,nd,"shx sh-"+x[0]+(x[3]?" "+x[3]:""),"cls");shudSet("l"+i,nd.firstChild,x[1]);shudSet("v"+i,nd.lastChild,x[2]);});}
/* ---- saved drag tunes: three named slots of the strip setup (S.dragTunes sandbox / C().dragTunes career).
   A tune is the setup sliders and picks below plus the two-step rpm and retard from the build; paid-for kit (drivetrain,
   wheelie bars), paint and the race format are left alone. Loading a tune never buys anything. ---- */
const DTUNE_ENV=["mass","rearBias","gears","first","top","final","tyreDia","tyre","body","chute","launchRpm","shiftMode","shiftRpm","gearSet","g2","g3","g4","g5","g6","rideH","tyrePsi","shocks"],DTUNE_CFG=["twoStepRpm","launchRetard"],DTUNE_N=3;
let DTSEL=-1;   // the slot whose actions are open
function dragTunes(){const o=career()?C():S;if(!Array.isArray(o.dragTunes))o.dragTunes=[];while(o.dragTunes.length<DTUNE_N)o.dragTunes.push(null);return o.dragTunes;}
function dragTuneSum(t){const e=t.env,ty=SIM.TYRES[e.tyre],a=SIM.AERO[e.body];return[ty&&ty.n,a&&a.n,(t.cfg.twoStepRpm&&S.cfg.launchCtl&&S.cfg.launchCtl!=="none"?t.cfg.twoStepRpm:e.launchRpm)+" rpm launch"].filter(Boolean).join(" · ");}
function dragTuneHtml(){const T=dragTunes();
  return`<div class="lbl"><span>Saved tunes</span></div><div class="seg n3 dtunes">${T.map((t,i)=>`<button data-dtune="${i}" class="${t&&dragTuneSame(t)?"on":""}${DTSEL===i?" sel":""}">${t?esc(t.n):"Empty slot"}<small>${t?esc(dragTuneSum(t)):"tap to save this setup"}</small></button>`).join("")}</div>
  ${DTSEL>=0&&T[DTSEL]?`<div class="dtact"><button data-dtact="load">Load</button><button data-dtact="save">Save over</button><button data-dtact="name">Rename</button><button data-dtact="clear">Clear</button></div>`:""}`;}
function dragTuneNow(){const e={},c={};for(const k of DTUNE_ENV)if(S.env[k]!==undefined)e[k]=S.env[k];for(const k of DTUNE_CFG)if(S.cfg[k]!==undefined)c[k]=S.cfg[k];return{env:e,cfg:c};}
function dragTuneSame(t){if(!t)return false;const n=dragTuneNow();return DTUNE_ENV.every(k=>t.env[k]===n.env[k])&&DTUNE_CFG.every(k=>t.cfg[k]===undefined||t.cfg[k]===n.cfg[k]);}
function dragTuneName(def){let n=null;try{n=prompt("Name this tune",def);}catch(e){}if(n==null)return null;n=String(n).trim().slice(0,24);return n||def;}
function dragTuneAct(i,a){const T=dragTunes(),t=T[i];
  if(a==="save"||!t){const n=t?t.n:dragTuneName(`Tune ${i+1}`);if(n==null)return;T[i]=Object.assign({n,at:Date.now()},dragTuneNow());DTSEL=-1;toast(`Saved “${n}”`);}
  else if(a==="load"){Object.assign(S.env,t.env);for(const k of DTUNE_CFG)if(t.cfg[k]!==undefined&&S.cfg[k]!==t.cfg[k]){S.cfg[k]=t.cfg[k];buildStale=true;}
    S.env.launchRpm=Math.min(S.env.launchRpm,S.cfg.redline);if(S.env.shiftRpm>0)S.env.shiftRpm=Math.min(S.env.shiftRpm,S.cfg.redline);
    DTSEL=-1;recompute();toast(`Loaded “${t.n}”`);}
  else if(a==="name"){const n=dragTuneName(t.n);if(n==null)return;t.n=n;DTSEL=-1;}
  else if(a==="clear"){T[i]=null;DTSEL=-1;toast("Slot cleared");}
  renderEnv();save();}
$("envBox").addEventListener("click",e=>{const s=e.target.closest("[data-dtune]"),a=e.target.closest("[data-dtact]");if(!s&&!a)return;
  if(a){if(DTSEL>=0)dragTuneAct(DTSEL,a.dataset.dtact);return;}
  const i=+s.dataset.dtune;if(!dragTunes()[i]){dragTuneAct(i,"save");return;}DTSEL=DTSEL===i?-1:i;renderEnv();});
/* ---- the thermal timing slip: the same card on the Test tab and in the share image ---- */
let SLIPN=false;   // notes tab: stays as you left it for the session
document.addEventListener("toggle",e=>{const t=e.target;if(t&&t.classList&&t.classList.contains("tsn"))SLIPN=t.open;},true);
/* the slip's split times as plain numbers, so the next pass can print the change from this one (the card only, not the share image).
   DPREV is the last clean pass this session, picked up from the saved slip after a reload; a broken pass never becomes the baseline. */
function dragMarks(r){const t=x=>x&&x.t!=null?+x.t:null;return{sixty:t(r.sixty),ft330:t(r.ft330),eighth:t(r.eighth),em:r.eighth&&r.eighth.mph!=null?+r.eighth.mph:null,ft1000:t(r.ft1000),et:r.et!=null?+r.et:null,mph:r.et!=null&&r.mph!=null?+r.mph:null};}
/* what goes on the slip, shared by the card and the image */
function slipData(r,res){const R=r.race,n=r.night,o=R&&R.om,br=!!(n&&n.dialP!=null),f3=v=>v==null?"—":(+v).toFixed(3),mp=v=>v==null?"—":(+v).toFixed(2);
  const rt=v=>v==null?"—":v<0?"RED":(+v).toFixed(3),failed=!!res.dragFailed,et=failed?null:r.et,m=dragMarks(r),p=!failed&&r.prev;
  const dl=k=>{if(!p||m[k]==null||p[k]==null)return"";const mph=k==="em"||k==="mph",d=m[k]-p[k],f=mph?1:3;if(Math.abs(d)<(mph?0.05:0.0005))return`<i class="dl">±0</i>`;
    const t=(d<0?"−":"+")+Math.abs(d).toFixed(f).replace(/^0(?=\.)/,"");return`<i class="dl ${(mph?d>0:d<0)?"b":"w"}">${t}</i>`;};   // the change from the last pass: green quicker, red slower
  const rows=[["R/T",R?(R.foul?"RED":rt(R.rt)):"—",R?rt(R.oppRt):null],
    ["60'",f3(r.sixty&&r.sixty.t),o?f3(o.sixty&&o.sixty.t):null,"",dl("sixty")],["330'",f3(r.ft330&&r.ft330.t),o?f3(o.ft330&&o.ft330.t):null,"",dl("ft330")],
    ["1/8",f3(r.eighth&&r.eighth.t),o?f3(o.eighth&&o.eighth.t):null,"",dl("eighth")],["MPH",mp(r.eighth&&r.eighth.mph),o?mp(o.eighth&&o.eighth.mph):null,"mph",dl("em")],
    ["1000'",f3(r.ft1000&&r.ft1000.t),o?f3(o.ft1000&&o.ft1000.t):null,"",dl("ft1000")],
    ["1/4",et!=null?f3(et):failed?"BROKE":"—",R?(n&&n.oppBroke?"BROKE":f3(R.oppEt)):null,"et",et!=null?dl("et"):""],["MPH",et!=null?mp(r.mph):"—",R?(R.oppEt!=null?mp(R.oppMph):"—"):null,"mph",et!=null?dl("mph"):""]];
  if(br)rows.push(["DIAL",n.dialP.toFixed(2),n.dialO.toFixed(2)]);
  if(!R)rows.shift();   // no tree on a time trial
  const win=R&&(!n||n.stage>=2)?!!R.won:null;
  // a qualifying pass: the seed is what counts, but say who crossed first in the pair too (it doesn't knock anyone out)
  const q=n&&n.stage<2&&!failed&&!(R&&R.foul),lane=q&&R&&R.margin!=null?`${R.won?"beat":"behind"} the other lane by ${Math.abs(R.margin).toFixed(2)} s · doesn't count`:"";
  const verdict=failed?"BROKE":R&&R.foul?"RED LIGHT":win===true?"WIN":win===false?"LOSS":q&&n.seed?`SEEDED #${n.seed} OF 8`:n?"QUALIFYING":R?"—":"TIME TRIAL";
  const margin=R&&R.margin!=null&&win!=null&&!R.foul?`by ${Math.abs(R.margin).toFixed(3)} s`:q&&n.seed?(n.stage===0?"so far · ":"")+(lane||"your seed for the ladder"):n&&n.stage<2&&et!=null?(br?"time trial"+(lane?" · "+lane:""):"counts toward your seed"):"";
  const when=new Date(r.at||Date.now());
  return{R,n,rows,win,verdict,margin,prev:p&&p.et!=null?`± vs last pass · ${p.et.toFixed(3)} @ ${(+p.mph).toFixed(1)} mph`:"",opp:R?shOpp(R.name):null,round:n?n.label:R?"TEST & TUNE · HEADS-UP":"TEST & TUNE",
    date:when.toLocaleDateString("en-CA")+" "+String(when.getHours()).padStart(2,"0")+":"+String(when.getMinutes()).padStart(2,"0"),
    car:(S.name||engineName()||"").slice(0,40),spec:`${Math.round(res.peakHp)} hp · ${(SIM.AERO[r.body]||SIM.AERO.street).n} · ${SIM.TYRES[r.veh.tyre].n} · ${r.veh.mass} kg${r.auto?r.auto.took!=null?" · you took over":" · Auto driver":""}`};}
function dragSlipCard(r,res){const D=slipData(r,res),two=!!D.R,lamp=w=>two&&D.win!=null?`<i class="lamp${w?" on":""}"></i>`:"";
  const pb=r.pb&&r.et!=null?(()=>{const f=etFix(r.et,+r.pb.was);return`<div class="stamp">${r.pb.all?"PERSONAL BEST":"ENGINE BEST"}<br><s>${(+r.pb.was).toFixed(f)}</s> ${r.et.toFixed(f)}</div>`;})():"";
  return`<div class="tslip${D.win===true?" won":""}" role="group" aria-label="Timing slip"><div class="tsh"><b>SECTION LINE DRAGWAY</b><small>1/4 mile · ${esc(D.round)}</small><small>${D.date}</small></div>
    <div class="tsc"><strong>${esc(D.car)}</strong>${esc(D.spec)}</div>
    <table><thead><tr><th></th><th class="you"><small>Right lane</small>${lamp(D.win===true)}You</th>${two?`<th><small>Left lane</small>${lamp(D.win===false)}${esc(D.opp)}</th>`:""}</tr></thead>
    <tbody>${D.rows.map(x=>`<tr class="${x[3]||""}"><td>${x[0]}</td><td>${x[4]||""}${x[1]}</td>${two?`<td>${x[2]==null?"—":x[2]}</td>`:""}</tr>`).join("")}</tbody></table>
    <div class="tsw"><b class="${D.win===true?"w":D.win===false||D.verdict==="RED LIGHT"||D.verdict==="BROKE"?"l":""}">${D.verdict}</b><span>${D.margin}</span></div>${D.prev?`<div class="tsd">${D.prev}</div>`:""}
    ${pb}<div class="tsf">Thank you for racing</div></div>`;}
/* the auto driver (S.env.dragDrive "auto"): SIM.dragDriver presses the same buttons on fixed 4 ms ticks of a clock (DR.vt) that
   trails the frame clock, so it drives the same pass at 4 fps or 120. A tap or Space hands the car back (dragTakeOver). */
function dragAuto(){if(S.env.dragDrive!=="auto")S.env.dragDrive="you";return S.env.dragDrive==="auto";}
function dragAutoWord(a){return a.took==null?"Auto driver — the whole pass":"Auto driver — you took over "+(typeof a.took==="number"?"at "+a.took+" ft":a.took==="burnout"?"in the water box":"on the line");}
(()=>{const skip=()=>!testing&&ENGINE_VIS.stripBusy&&ENGINE_VIS.stripBusy()>0&&ENGINE_VIS.stripSkip();
  $("view").addEventListener("pointerdown",()=>{skip();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!e.defaultPrevented&&skip())e.preventDefault();});})();
/* ---- nitrous on the strip: bottle pressure (heater or weather), when the shot comes on, and a purge on the line ---- */
const N2O_ACT=[["window","Window switch","at the rpm window"],["mph40","At 40 mph","once it's hooked"],["mph60","At 60 mph","late, safe"],["shift2","After the 1-2","second gear on"]];
const N2OB={cooled:0,t:0};   // a bottle without a heater cools a little every pass and warms back over ~20 min (session only)
function n2oKit(){const k=SIM.OPT.nitrous[S.cfg.nitrous];return k&&k.shotHp?k:null;}
function n2oBottleNow(env){const e=env||stdEnv(),heat=(S.env.n2oHeater||"on")==="on";const cool=N2OB.cooled*Math.exp(-(Date.now()-N2OB.t)/1200000);return SIM.n2oBottle(heat,e.ambientC,heat?0:cool);}
function n2oEnvHtml(){const k=n2oKit(),e=S.env,b=n2oBottleNow(),heat=(e.n2oHeater||"on")==="on",act=e.n2oAct||"window",q=quick&&quick.nitrous;
  return `<div class="lbl" style="margin-top:6px"><span>Nitrous · ${k.name}</span><b style="color:${b.psi<850||b.psi>1000?"var(--warn)":"var(--good)"}">${b.psi.toLocaleString("en-CA")} psi</b></div>
    <p class="hint" style="margin-top:-2px">Bottle at ${b.tempC} °C. ${heat?"The heater blanket holds it near 950 psi, so the shot is the same every pass.":b.psi<850?`Without a heater a ${b.tempC} °C bottle flows about ${Math.round((1-Math.pow(b.psi/950,0.85))*100)}% less shot, and less again every pass as it empties.`:b.psi>1000?"A hot bottle flows more nitrous than the kit was jetted for — that is how a dry kit goes lean.":"Close to where the kit was jetted."}${q&&q.backfire>0.02?` Backfire odds about ${Math.round(q.backfire*100)}% a pass.`:""}${q&&q.leanRisk>0.03?` Lean-spike odds about ${Math.round(q.leanRisk*100)}% a pass.`:""}</p>
    <div class="lbl"><span>Bottle heater</span></div><div class="seg">${[["on","On","holds ~950 psi"],["off","Off","follows the weather"]].map(([v,n,d])=>`<button data-lp="${v}" data-ek="n2oHeater" class="${(heat?"on":"off")===v?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>
    <div class="lbl"><span>Shot comes on</span></div><div class="seg n4">${N2O_ACT.map(([v,n,d])=>`<button data-lp="${v}" data-ek="n2oAct" class="${act===v?"on":""}" style="flex:1 1 40%">${n}<small>${v==="window"&&q?Math.round(q.winRpm).toLocaleString("en-CA")+" rpm":d}</small></button>`).join("")}</div>
    <p class="hint">Purge on the line: hold <b>PURGE</b> (or <kbd>P</kbd>) while staged until it spits white — that fills the line with liquid so the hit is full strength. An unpurged line sends gas first and the shot comes in soft.</p>`;}
function n2oSlip(n){const g=["1st","2nd","3rd","4th","5th","6th","7th"][Math.max(0,(n.onGear||1)-1)];
  return `${n.shotHp} shot ${n.cut?"cut by a backfire":n.on?`on ${n.act==="window"?"at the window":"at "+n.onMph+" mph"} in ${g}`:"never came on"} · ${n.psi.toLocaleString("en-CA")} psi${n.purged>0.3?` after a ${n.purged.toFixed(1)} s purge`:" · not purged"}`;}
$("testExtra").addEventListener("click",e=>{if(e.target.closest("#freshen")){const l=S.last;if(!l||!career())return;const c=freshenCost(l.res);if(C().cash<c){toast("Not enough cash for a freshen");return;}C().cash-=c;C().wear[hKey(cfgHash(S.cfg))]=0;logEvent(`Freshened ${engineName()} — ${fmt$(c)}`);hud();save();renderTest();toast("Rings, bearings and a hone — like new");return;}
  if(!e.target.closest("#shareSlip"))return;const l=S.last;if(!l||!l.res.drag)return;shareSlip(l);});
/* ---- race night: heads-up eliminations and bracket racing ----
   Two qualifying passes (time trials in bracket), then an 8-car ladder: quarter, semi, final against AI rivals of the
   same body class. The night lives on C().rn (career) / S.rnSb (sandbox), so a reload keeps it. Rivals are a calibrated
   ET / reaction-time model seeded per career week (per entry in sandbox); the car in the other lane replays the player's
   own baseline pass, time-scaled so it crosses the stripe on the rival's ET. */
const RN_CARS={street:["'69 Camaro","Fox-body Mustang","'72 Nova","Civic hatch","'87 Grand National","'71 Duster","'99 Trans Am","Duramax crew cab","'66 Chevelle","Supra Mk IV","'70 Challenger","'86 Monte Carlo SS"],
  outlaw:["Outlaw Camaro","Big-tyre Fox","Radial Regal","Outlaw Cummins","'68 Dart","Turbo Mustang","Outlaw Corvette","'70 Chevelle","Radial Supra","Outlaw Firebird","'63 Falcon","Nitrous Duster"],
  promod:["Pro-mod '68 Camaro","Pro-mod Corvette","Pro-mod '41 Willys","Pro-mod Mustang","Pro-mod GTO","Pro-mod Camaro","Pro-mod '53 Corvette","Pro-mod Firebird","Pro-mod Dart","Pro-mod Cuda"],
  rail:["Front-engine dragster","Rear-engine rail","Top dragster","Alcohol dragster","Junior-built rail","Swingarm rail","Long-wheelbase rail","Nostalgia digger","Top sportsman rail","Turbo rail"],
  funny:["Nitro Mustang funny car","Nitro Camaro funny car","Nitro Charger funny car","Alcohol Mustang funny car","Alcohol Camaro funny car","Nostalgia Charger funny car","Nostalgia Vega funny car","Alcohol Monza funny car","Nostalgia 'Cuda funny car","Nitro Challenger funny car"],
  prostock:["Pro stock Camaro","Pro stock Mustang","Pro stock Dart","Pro stock Firebird","Pro stock GXP","Pro stock Cobalt","Pro stock Strata","Pro stock Thunderbird","Pro stock Probe","Pro stock Avenger"],
  gasser:["'55 Chevy gasser","'41 Willys gasser","'33 Willys gasser","'56 Chevy gasser","'57 Bel Air gasser","Anglia gasser","Austin gasser","'40 Willys pickup gasser","'55 Chevy 210 gasser","'37 Chevy gasser"]};
const RN_DRV=["Dale Kowalchuk","Marie Lavoie","Tyler Sorensen","Wes Bouchard","Kim Nakamura","Rhett Dyck","Jo Fehr","Sam Okafor","Lena Penner","Cody Gauthier","Ana Petrova","Reggie Thiessen","Bo Lindqvist","Nora Wiebe","Gus Halvorsen","Priya Sandhu"];
const RN_FMT={elim:"Heads-up eliminations",bracket:"Bracket racing"};
const RN_STAGE=["QUALIFYING 1","QUALIFYING 2","QUARTER-FINAL","SEMI-FINAL","FINAL"],RN_TT=["TIME TRIAL 1","TIME TRIAL 2"];
const RN_PLACE={1:"Won the night",2:"Runner-up",3:"Semi-final",5:"Quarter-final",9:"Did not qualify"},RN_PAY={1:1,2:0.45,3:0.2,5:0.08,9:0};
function rnRng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function rnHash(s){let h=2166136261;s=String(s);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function rnGauss(r){let u=0;while(!u)u=r();return Math.sqrt(-2*Math.log(u))*Math.cos(6.283185307*r());}
/* the field: heads-up has one dominant car and the rest spread either side of what you run; at a bracket race every speed shows up */
function rnField(seed,body,fmt,et0,mph0){const r=rnRng(seed),br=fmt==="bracket",cars=(RN_CARS[body]||RN_CARS.street).slice(),drv=RN_DRV.slice(),pick=a=>a.splice(Math.floor(r()*a.length),1)[0];
  const f=br?[0.86,0.92,0.97,1.02,1.08,1.15,1.24].map(x=>x*(0.97+r()*0.06)):[0.925+r()*0.015,0.965+r()*0.02,0.985+r()*0.02,1.0+r()*0.02,1.015+r()*0.025,1.035+r()*0.03,1.06+r()*0.04];
  return f.map((k,i)=>{const sk=i===0&&!br?0.75+r()*0.25:r(),mean=+(et0*k).toFixed(3);
    return{name:pick(drv),car:pick(cars),mean,mph:+(mph0*et0/mean).toFixed(1),
      sd:br?+(0.02+0.045*(1-sk)).toFixed(3):+(mean*(0.003+0.006*(1-sk))).toFixed(3),   // bracket: holds its number within about ±0.03–0.10
      rt:+(0.035+0.07*(1-sk*0.6-r()*0.4)).toFixed(3),rtSd:+(0.012+0.02*(1-sk)).toFixed(3),brk:+(0.012+0.04*r()).toFixed(3),red:+(0.01+0.035*r()).toFixed(3),
      dial:br?Math.floor((mean-0.01-0.03*r())*100)/100:null,skill:+sk.toFixed(2)};});}   // bracket racers dial a hair under what they run so they don't break out
/* one pass by a rival: a light under .000 is a red light; sometimes the car breaks */
function rnRivalPass(rv,r,air){const rt=r()<(rv.red||0)?-+(0.002+0.04*r()).toFixed(3):+(rv.rt+rnGauss(r)*rv.rtSd).toFixed(3),broke=r()<rv.brk,et=broke?null:+((rv.mean+rnGauss(r)*rv.sd)*(1-(air||0)/3)).toFixed(3);
  return{rt,et,mph:et!=null?+(rv.mph*rv.mean/et*(1+rnGauss(r)*0.004)).toFixed(1):null,broke,at:broke?+(0.15+r()*0.6).toFixed(2):null,dial:rv.dial};}
/* who won: a = {rt, et, dial, dq, x}. Red light first (both red: the earlier one loses), then the centreline, then a car that
   broke or never got there, then — bracket — a breakout (both: the smaller one wins), then first to the stripe. */
function rnJudge(a,b,br){const fa=a.rt!=null&&a.rt<0,fb=b.rt!=null&&b.rt<0;
  if(fa||fb)return{w:fa&&fb?(a.rt<b.rt?1:0):fa?1:0,why:"red"};
  if(a.dq!==b.dq)return{w:a.dq?1:0,why:"line"};
  const da=a.et==null,db=b.et==null;
  if(da||db)return{w:da&&db?((a.x||0)>=(b.x||0)?0:1):da?1:0,why:da&&db?"dnf2":"dnf"};
  if(br){const ba=a.et<a.dial,bb=b.et<b.dial;
    if(ba&&bb){const ma=a.dial-a.et,mb=b.dial-b.et;return{w:ma<=mb?0:1,why:"bo2",margin:+Math.abs(ma-mb).toFixed(3)};}
    if(ba||bb)return{w:ba?1:0,why:"bo",margin:+(ba?a.dial-a.et:b.dial-b.et).toFixed(3)};
    const pa=a.rt+a.et-a.dial,pb=b.rt+b.et-b.dial;return{w:pa<=pb?0:1,why:"stripe",margin:+Math.abs(pa-pb).toFixed(3)};}
  const pa=a.rt+a.et,pb=b.rt+b.et,w=pa<=pb?0:1;return{w,why:"stripe",margin:+Math.abs(pa-pb).toFixed(3),holeshot:w===0?a.et>b.et:b.et>a.et};}
/* bracket handicap: the slower dial gets the tree first; each lane's countdown starts (slow dial − own dial) later */
function rnTreeOffsets(dp,dO){const s=Math.max(dp,dO);return{p:+(s-dp).toFixed(3),o:+(s-dO).toFixed(3)};}
/* the ladder: 1v8 and 4v5 in the top half, 2v7 and 3v6 in the bottom, so the top two can only meet in the final */
function rnPairs(seeds){return[[seeds[0],seeds[7]],[seeds[3],seeds[4]],[seeds[1],seeds[6]],[seeds[2],seeds[5]]];}
function rnNextPairs(prev){const w=prev.map(m=>m.win);const out=[];for(let i=0;i<w.length;i+=2)out.push([w[i],w[i+1]]);return out.map(([a,b])=>({a,b,win:null}));}
function rnSeeds(N){if(N.fmt==="bracket"){const r=rnRng(rnHash(N.seed+":draw")),a=[0,1,2,3,4,5,6,7];for(let i=7;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  const best=i=>{const t=[0,1].map(q=>N.q[q][i]).filter(p=>p&&p.et!=null).map(p=>p.et);return t.length?Math.min.apply(null,t):Infinity;};
  return[0,1,2,3,4,5,6,7].sort((a,b)=>best(a)-best(b)||a-b);}
/* a rival's pass for a stage: fixed by the night's seed, so a reload (or the node harness) sees the same night */
function rnRivalAt(N,stage,i){N.rp=N.rp||{};const k=stage+":"+i;if(!N.rp[k])N.rp[k]=rnRivalPass(N.field[i-1],rnRng(rnHash(N.seed+":"+k)),N.air[stage]||0);return N.rp[k];}
function rnPart(N,i){return i===0?{name:"You",car:engineName().slice(0,22),you:true}:N.field[i-1];}
function rnQualBest(N,i){const t=[0,1].map(q=>N.q[q]&&N.q[q][i]).filter(p=>p&&p.et!=null);return t.length?t.reduce((a,b)=>a.et<=b.et?a:b):null;}
/* play out the AI-vs-AI matches of a round */
function rnResolve(N,ri){const br=N.fmt==="bracket";for(const m of N.rounds[ri]){if(m.win!=null||m.a===0||m.b===0)continue;
  const pa=rnRivalAt(N,ri+2,m.a),pb=rnRivalAt(N,ri+2,m.b),j=rnJudge(Object.assign({x:pa.broke?402*pa.at:402},pa),Object.assign({x:pb.broke?402*pb.at:402},pb),br);
  m.pa=pa;m.pb=pb;m.win=j.w===0?m.a:m.b;m.why=j.why;m.margin=j.margin;}}
function rnPurseEt(et){return et<7?6000:et<8?4000:et<9?2000:et<10?1000:et<11?500:et<13?200:100;}
function rnCur(){const n=career()?C().rn:S.rnSb;return n&&n.v===1?n:null;}
function rnSetN(n){if(career())C().rn=n;else S.rnSb=n;}
function rnLive(){const n=rnCur();return n&&!n.done?n:null;}
/* pits tuning on top of the Test-tab car: pressure and shocks (always), and on a night the class-locked parts */
function rnVeh(veh){const e=S.env;if(e.tyrePsi>0)veh.tyrePsi=e.tyrePsi;if(e.shocks==="soft"||e.shocks==="firm")veh.shocks=e.shocks;
  const N=rnLive();if(N){Object.assign(veh,N.lock);if(veh.tyrePsi>0&&!(e.tyrePsi>0))delete veh.tyrePsi;}return veh;}
function rnBaseline(veh){const res=SIM.dragPrep(S.cfg,stdEnv());const b=SIM.dragPass(res,Object.assign({},veh,{auto:true,noFail:true,tyreTemp:veh.tyre==="street"?0.3:0.8,holdTime:1.0}));
  if(b.et!=null)return{et:b.et,mph:b.mph,trace:b.trace.map(p=>[p[0],p[1]])};
  const lb=veh.mass*2.2046,hp=Math.max(30,res.peakHp),et=Math.min(39,5.825*Math.cbrt(lb/hp)),mph=234*Math.cbrt(hp/lb),tr=[];for(let t=0.05;t<=et+0.001;t+=0.05)tr.push([+t.toFixed(2),Math.round(402.336*Math.pow(t/et,1.7))]);return{et:+et.toFixed(3),mph:+mph.toFixed(1),trace:tr};}
/* race-night darkness for a stage, shared by the strip and the pits: Q1 dusk (0) to the final full dark (1); night mode on = dark all night */
function rnNightK(stage){return S.night?1:Math.min(1,(stage||0)/4);}
function rnStageName(N,s){return N.fmt==="bracket"&&s<2?RN_TT[s]:RN_STAGE[s];}
function rnOppIdx(N){if(N.stage<2)return N.qopp[N.stage];const m=N.rounds[N.stage-2].find(x=>x.a===0||x.b===0);return m?(m.a===0?m.b:m.a):1;}
function rnSuggest(N){const p=(N.passes||[]).filter(x=>x.et!=null&&!x.dq).slice(-1)[0];const et=p?p.et:N.et0;return Math.floor((et-0.01)*100)/100;}
function rnEnter(){const fmt=S.env.dragFmt;if(!RN_FMT[fmt])return;
  if(career()){if(!(C().cert&&C().cert.ok&&C().cert.hash===cfgHash(S.cfg))){toast("Certify this engine on the dyno first");return;}if(!has("race")){toast(`Needs the ${(UPGRADES.find(u=>u.id==="race")||{}).name} upgrade`);return;}}
  const veh=rnVeh(dragVeh()),b=rnBaseline(veh),body=veh.body||"street";
  if(career()&&b.mph>150&&!veh.chute){toast("Tech won't take it — over 150 mph needs a parachute");return;}
  const qk=fmt==="bracket"&&!!S.env.dragQuick;if(career()&&qk&&C().rep<BR_REP){toast(`Bracket night opens at ${BR_REP} rep`);return;}
  const rnKey=fmt+(qk?"q":"")+":"+body;if(career()&&(C().rnDone||{})[rnKey]===C().week){toast(`One ${RN_FMT[fmt].toLowerCase()} night a week for the ${SIM.AERO[body].n} class — back next week`);return;}
  const br=fmt==="bracket",purse=Math.round(Math.max(1500,6*rnPurseEt(b.et))*(br?0.8:1)/50)*50,entry=career()?Math.max(150,Math.round(purse*0.08/50)*50):0;
  if(career()&&C().cash<entry){toast(`Entry is ${fmt$(entry)} — not enough cash`);return;}
  const seed=career()?rnHash([C().seed,C().week,body,fmt].join(":")):rnHash(Date.now()+":"+Math.random()),r=rnRng(rnHash(seed+":air"));
  const air=[0];for(let i=1;i<5;i++)air.push(+(air[i-1]+0.002+0.006*r()-0.002*(r()<0.25?1:0)).toFixed(4));   // the air gets better as the night cools
  const qr=rnRng(rnHash(seed+":q")),q0=1+Math.floor(qr()*7);let q1=1+Math.floor(qr()*6);if(q1>=q0)q1++;
  const lt=SIM.launchTech(S.cfg);
  const N={v:1,fmt,seed,body,hash:cfgHash(S.cfg),week:career()?C().week:null,entry,purse,et0:b.et,mph0:b.mph,trace:b.trace,air,
    lock:{mass:veh.mass,rearBias:veh.rearBias,tyre:veh.tyre,tyreDia:veh.tyreDia,gears:veh.gears,top:veh.top,body,chute:veh.chute},
    t0:{first:S.env.first,final:S.env.final,launch:lt.launchCtl!=="none"?lt.twoStepRpm:S.env.launchRpm},
    field:rnField(seed,body,fmt,b.et,b.mph),stage:0,qopp:[q0,q1],q:[[],[]],rounds:[],passes:[],hist:[],dial:br?Math.floor((b.et-0.01)*100)/100:null,done:false,place:null,won:0};
  if(qk){N.quick=true;N.stage=2;N.seeds=rnSeeds(N);N.rounds=[rnPairs(N.seeds).map(([a,b])=>({a,b,win:null}))];rnResolve(N,0);const lb=(C0=>C0&&C0.dragBest&&C0.dragBest[hKey(cfgHash(S.cfg))])(career()?C():null);if(lb&&lb<b.et+0.5)N.dial=Math.floor((lb-0.01)*100)/100;}   // quick bracket: straight to round 1, dial defaults to your best ET with this engine (else the predicted one)
  if(career()){(C().rnDone=C().rnDone||{})[rnKey]=C().week;C().cash-=entry;logEvent(`Race night: entered ${RN_FMT[fmt].toLowerCase()} (${SIM.AERO[body].n}) — ${fmt$(entry)} entry`);hud();}
  rnSetN(N);save();renderTest();toast(`${qk?"BRACKET NIGHT":RN_FMT[fmt].toUpperCase()} · ${SIM.AERO[body].n.toUpperCase()} · 8 CARS`);buzz([20,30,20]);}
/* Build tab: a line above the form while a race night is on, so a change is flagged when it is made and not
   only when Stage refuses it (playtest, 1.76.123.0). Called whenever the engine changes. */
function rnBuildWarn(){const f=$("buildForm");if(!f)return;let w=$("rnBuildWarn");const N=rnLive();
  if(!N){if(w)w.remove();return;}
  if(!w){w=document.createElement("p");w.id="rnBuildWarn";w.className="hint";w.setAttribute("role","status");f.parentNode.insertBefore(w,f);}
  const off=cfgHash(S.cfg)!==N.hash;w.style.color=off?"var(--warn)":"";
  w.textContent=off?"This is not the engine you entered tonight's race night with. It can't stage until you put the changes back, or leave the night on the Test tab."
    :"You're entered in a race night with this engine. Change it here and it can't race tonight until you put it back.";}
/* before a paid dyno pull: a race night is on and this isn't the engine it was entered with, so the night will refuse it.
   Asked once per build (playtest, Nov 2026: the refusal only came at Stage, after paying for the pull). */
let rnPullAsked=null;
function rnPullGate(cost){const N=rnLive();if(!N||!career())return true;const h=cfgHash(S.cfg);if(h===N.hash||rnPullAsked===h)return true;
  if(!confirm(`You're entered in tonight's race night with a different engine. This one can't stage there until you put the changes back.\n\nThe pull costs ${fmt$(cost)}. Pull anyway?`))return false;
  rnPullAsked=h;return true;}
/* runTest on the drag tab: true when the race night took the click */
function rnGate(){const N=rnCur();
  if(!N){if(RN_FMT[S.env.dragFmt]){rnEnter();return true;}return false;}
  if(N.done){rnSetN(null);save();renderTest();return true;}
  if(cfgHash(S.cfg)!==N.hash){toast("That's not the engine you entered with — put it back, or leave the night");return true;}
  return false;}
/* ---- race-night panel (replaces the drag set-up on the Test tab while a night is on) ---- */
function rnPT(p,br){if(!p)return"—";if(p.rt!=null&&p.rt<0)return`<span class="rnr">RED</span>`;if(p.dq)return`<span class="rnr">X-LINE</span>`;if(p.et==null)return`<span class="rnr">${p.broke?"BROKE":"DNF"}</span>`;return p.et.toFixed(3)+(br&&p.dial!=null&&p.et<p.dial?`<span class="rnr"> BO</span>`:"");}
/* the ladder as a bracket of cars: quarter → semi → final → trophy. Winners slide forward the first time they show up in the next
   round; tap a car for the driver, the car and how their night went. */
const RNLG={seed:null,seen:null,sel:null};
const RNLG_SIL={   // side views facing right, 30×13
  street:"M29 9.6 28.6 7.2 23.4 6.1 19.2 3.2 11 3 7 6 1.6 6.8 1 9.6Z",
  outlaw:"M29 9.6 28.6 7.3 23 6.3 19 3.4 11.2 3.2 7.4 6.1 2.6 6.4 2.2 4.6 .6 4.6 .8 9.6Z",
  promod:"M29.3 9.6 28.4 7.9 21.5 6.6 17.2 3.8 10.4 3.6 6.4 6 2.4 6 2 3.8 .4 3.8 .6 9.6Z",
  rail:"M29.6 9.4 25 8.4 11 7.8 9.4 5.6 7.4 5.6 6.4 7.4 3.2 7.4 3.2 3 .4 2 .4 3.4 2 3.6 2 9.6Z",
  funny:"M29.6 9.6 29 8.6 20 6.8 14 4.4 9.6 4.2 6.4 4.8 2.2 3.4 .6 3.4 1 9.6Z",
  prostock:"M29.4 9.6 28.6 8.2 21.6 6.8 17 4.2 10.6 4 6.2 6 1.4 6.4 .8 9.6Z",
  gasser:"M28.8 7.4 28.4 4.6 22.6 3.8 18.6 1.4 11.2 1.4 7.6 4.6 1.6 5.8 1.2 9.4Z"};
const RNLG_WH={street:[[23.4,10.2,2.4],[6.8,10.2,2.4]],outlaw:[[23.6,10.6,2],[6.6,9.8,3]],promod:[[23,10.4,2.2],[6.4,9.7,3]],rail:[[27,10.8,1.5],[5.2,9.3,3.6]],
  funny:[[24.4,10.9,1.7],[6.2,9.7,2.9]],prostock:[[23,10.4,2.2],[6.4,9.7,2.9]],gasser:[[23.4,10.4,2.2],[6.8,10,2.6]]};
function rnSil(body,col){const b=RNLG_SIL[body]?body:"street";return`<svg viewBox="0 0 30 13" aria-hidden="true"><path d="${RNLG_SIL[b]}" fill="${col}"/>${RNLG_WH[b].map(([cx,cy,r])=>`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#121417" stroke="#5a606b" stroke-width=".7"/>`).join("")}</svg>`;}
const rnPaint=(N,i)=>i===0?"var(--orange)":`hsl(${rnHash(N.field[i-1].name)%360} 52% 56%)`;
function rnLadderHtml(N){const br=N.fmt==="bracket",seedOf=i=>N.seeds?N.seeds.indexOf(i)+1:"",cur=N.done?-1:N.stage-2;
  if(RNLG.seed!==N.seed){RNLG.seed=N.seed;RNLG.seen=null;RNLG.sel=null;}
  const first=!RNLG.seen,seen=RNLG.seen||new Set(),col=[1,3,5],span=[1,2,4];let chips="",lines="",lit="";
  const yc=(ri,s)=>(s*span[ri]+span[ri]/2)*12.5,xr=[31,58,85],xl=[34,61,88];
  for(let ri=0;ri<3;ri++){const ms=N.rounds[ri]||(ri===1?[{},{}]:[{}]);
    ms.forEach((m,mi)=>{[["a","pa"],["b","pb"]].forEach(([k,pk],si)=>{const s=mi*2+si,i=m[k],row=`grid-column:${col[ri]};grid-row:${s*span[ri]+1}/span ${span[ri]}`;
        if(i==null){chips+=`<div class="rnk tbd" style="${row}" aria-hidden="true"><em></em><span>—</span></div>`;return;}
        const P=rnPart(N,i),p=m[pk],done=m.win!=null,key=ri+":"+s+":"+i,adv=ri>0&&!first&&!seen.has(key);seen.add(key);
        const cls=`rnk${i===0?" you":""}${done&&m.win===i?" w":done?" l":""}${ri===cur&&(m.a===0||m.b===0)?" nx":""}${RNLG.sel===i?" sel":""}${adv?" adv":""}`;
        chips+=`<button class="${cls}" style="${row}" data-rnlg="${i}" aria-label="${esc(P.name)}${i?" · "+esc(P.car):""}">${rnSil(N.body,rnPaint(N,i))}<em${done&&p&&br&&p.dial!=null&&p.et!=null&&p.et<p.dial?' class="bo" title="broke out"':""}>${done&&p?rnPT(p,false):seedOf(i)?"#"+seedOf(i):""}</em><span>${i===0?"YOU":esc(shSur(P.name))}</span></button>`;});
      // the bracket lines into the next round, the winner's path drawn over in green (orange when it's you)
      const ya=yc(ri,mi*2),yb=yc(ri,mi*2+1),ym=ri<2?yc(ri+1,mi):50,xm=(xr[ri]+xl[ri])/2;
      lines+=`<path d="M${xr[ri]} ${ya}H${xm}V${yb}H${xr[ri]}M${xm} ${(ya+yb)/2}V${ym}H${xl[ri]}"/>`;
      if(m.win!=null){const yw=m.win===m.a?ya:yb;lit+=`<path class="${m.win===0?"y":"w"}" d="M${xr[ri]} ${yw}H${xm}V${ym}H${xl[ri]}"/>`;}});}
  RNLG.seen=seen;
  const fm=N.rounds[2]&&N.rounds[2][0],champ=fm&&fm.win!=null?fm.win:null;
  const tro=`<div class="rntro${champ!=null?" on":""}${champ===0?" you":""}"><svg viewBox="0 0 36 40" aria-hidden="true"><path d="M9 3h18v8c0 6-4 10.5-9 10.5S9 17 9 11zM9 6H3.5c0 5 2.5 8 6.5 8.5M27 6h5.5c0 5-2.5 8-6.5 8.5M15.5 21.5h5v6h-5zM11 27.5h14l1.5 6h-17z"/></svg><small>${champ!=null?(champ===0?"YOU":esc(shSur(rnPart(N,champ).name))):N.purse>=1000?"$"+Math.round(N.purse/1000)+"k":fmt$(N.purse)}</small></div>`;
  const sel=RNLG.sel!=null&&(RNLG.sel===0||N.field[RNLG.sel-1])?rnLgDetail(N,RNLG.sel):"";
  return`<div class="rnlg"><div class="rnlgh"><i>Quarter</i><i>Semi</i><i>Final</i><i>Cup</i></div><div class="rnlgb"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}${lit}</svg>${chips}${tro}</div><div class="rnlgx"${sel?"":" hidden"}>${sel}</div></div>`;}
function rnLgDetail(N,i){const P=rnPart(N,i),br=N.fmt==="bracket",q=rnQualBest(N,i),rv=i?N.field[i-1]:null,seed=N.seeds?N.seeds.indexOf(i)+1:null;let h=`<b>${esc(i===0?"You · "+P.car:P.name)}</b><span>${i===0?(SIM.AERO[N.body]||{}).n||"":esc(P.car)}${seed?" · seed #"+seed:""}${br&&rv?" · dial "+rv.dial.toFixed(2):""}${q?` · qualified ${q.et.toFixed(3)}`:""}</span>`;
  (N.rounds||[]).forEach((ms,ri)=>{const m=ms.find(x=>x.a===i||x.b===i);if(!m)return;const o=m.a===i?m.b:m.a,p=m.a===i?m.pa:m.pb;if(o==null)return;
    h+=`<div><span>${["QF","SF","Final"][ri]} vs ${o===0?"you":esc(rnPart(N,o).name)}</span><span>${p?rnPT(p,br):""}${m.win==null?" · to run":m.win===i?' · <span style="color:var(--good)">won</span>':" · out"}</span></div>`;});
  return h;}
$("envBox").addEventListener("click",e=>{const b=e.target.closest("[data-rnlg]");if(!b)return;const N=rnCur();if(!N)return;const i=+b.dataset.rnlg,box=b.closest(".rnlg");
  RNLG.sel=RNLG.sel===i?null:i;box.querySelectorAll(".rnk.sel").forEach(x=>x.classList.remove("sel"));box.querySelectorAll(".rnk.adv").forEach(x=>x.classList.remove("adv"));
  if(RNLG.sel!=null)box.querySelectorAll(`[data-rnlg="${i}"]`).forEach(x=>x.classList.add("sel"));const x=box.querySelector(".rnlgx");x.innerHTML=RNLG.sel!=null?rnLgDetail(N,i):"";x.hidden=RNLG.sel==null;buzz(3);});
function rnQualHtml(N){const br=N.fmt==="bracket",ids=[0,1,2,3,4,5,6,7],q=N.stage,best=i=>{const b=rnQualBest(N,i);return b?b.et:Infinity;};
  const ord=q>0?ids.slice().sort((a,b)=>best(a)-best(b)||a-b):ids;
  return`<div class="rnq">${ord.map((i,k)=>{const P=rnPart(N,i),rv=i?N.field[i-1]:null,b=rnQualBest(N,i);
    return`<div class="${i===0?"you":""}"><i>${q>0&&!br?k+1:""}</i><span>${esc(P.name)}<small>${esc(P.car)}</small></span><b>${b?b.et.toFixed(3):q>0?"—":br&&rv?"dial "+rv.dial.toFixed(2):""}</b></div>`;}).join("")}</div>`;}
function rnTuneRows(N){const lt=SIM.launchTech(S.cfg),two=lt.launchCtl!=="none",t0=N.t0,psi0=SIM.TYRES[N.lock.tyre].psi||16,psi=S.env.tyrePsi>0?S.env.tyrePsi:psi0,sh=S.env.shocks||"medium";
  const L=two?lt.twoStepRpm:Math.min(S.env.launchRpm,S.cfg.redline);
  const row=(k,lbl,val,sub)=>{const m=rnTuneLim(N,k);return`<div class="rnt"><span>${lbl}<small>${sub||""}</small></span><button class="nud" data-rn="tune" data-k="${k}" data-d="-1" aria-label="less">−</button><b id="rnv-${k}">${val}</b><button class="nud" data-rn="tune" data-k="${k}" data-d="1" aria-label="more">+</button></div><input type="range" class="rnr" data-rnr="${k}" min="${m.lo}" max="${m.hi}" step="${m.step}" value="${m.v}" aria-label="${lbl}">`;};
  return row("launch",two?"Two-step rpm":"Launch rpm",L.toLocaleString(),two?"sets the hold on the line":"where you feed the clutch")
    +row("first","1st gear",(+S.env.first).toFixed(2)+":1",`was ${(+t0.first).toFixed(2)} · shorter = harder hit`)
    +row("final","Final drive",(+S.env.final).toFixed(2)+":1",`was ${(+t0.final).toFixed(2)}`)
    +row("psi","Tyre pressure",psi.toFixed(1)+" psi",psi<psi0*0.75?`<span style="color:var(--warn)">shake risk under ${(psi0*0.75).toFixed(1)}</span>`:psi<psi0?"more bite, rolls out shorter":psi>psi0?"harder: less bite":`${SIM.TYRES[N.lock.tyre].n.toLowerCase()} baseline`)
    +`<div class="lbl" style="margin-top:6px"><span>Shocks</span></div><div class="seg n3">${[["soft","Soft","more bite · lifts"],["medium","Medium","as delivered"],["firm","Firm","flat · may spin"]].map(([k,n,d])=>`<button data-rn="shock" data-k="${k}" class="${sh===k?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>`;}
function rnPitsHtml(N){const br=N.fmt==="bracket",p=N.last,i=rnOppIdx(N),rv=N.field[i-1],rd=N.stage>=2;let h=`<div class="rnpits"><h3>Pits${p?" · last pass":""}</h3>`;
  if(p)h+=`<div class="peaks rnlast"><div class="peak"><b>${p.sixty!=null?p.sixty.toFixed(3):"—"}</b><span>60 ft</span></div><div class="peak"><b>${p.et!=null?p.et.toFixed(3):"—"}</b><span>ET${p.mph?" · "+Math.round(p.mph)+" mph":""}</span></div><div class="peak"><b>${p.spin.toFixed(2)}<i>s</i></b><span>spin${p.shake>0.1?" · shake "+p.shake.toFixed(1):""}</span></div></div>`;
  const da=((N.air[N.stage]||0)-(N.air[Math.max(0,N.stage-1)]||0))*100;
  h+=`<p class="hint" style="margin:4px 0 8px">${N.stage>0?`Air ${da>=0.05?"is "+da.toFixed(1)+"% better than last round — cars will pick up a little":da<=-0.05?"has gone off "+(-da).toFixed(1)+"% — expect it to slow down":"about the same as last round"}. `:""}Body, tyre and weight are locked for the night; this is what a racer changes between rounds.</p>`;
  h+=rnTuneRows(N);
  if(br&&rd){const sug=rnSuggest(N);h+=`<div class="rnt dial"><span>Your dial-in<small>${p&&p.et!=null?"last ran "+p.et.toFixed(3)+" · ":""}under it is a breakout</small></span><button class="nud" data-rn="dial" data-d="-1" aria-label="quicker">−</button><b>${N.dial.toFixed(2)}</b><button class="nud" data-rn="dial" data-d="1" aria-label="slower">+</button></div>${Math.abs(sug-N.dial)>0.004?`<button class="chip" data-rn="dialsug" style="margin:0 0 8px">Use ${sug.toFixed(2)} (a hundredth under your last)</button>`:""}`;}
  const wi=wearInfo(quick);if(wi){const c=rnFreshCost(quick);h+=`<div class="rnt"><span>Wear<small>${wi.passes} of ${wi.budget} passes${wi.w>=1?" · past budget, parts start letting go":""}</small></span><b style="color:${wi.w>=1?"var(--crit)":wi.w>0.6?"var(--warn)":"var(--good)"}">${Math.round(wi.w*100)}%</b>${wi.w>0?`<button class="btn sm" data-rn="freshen">Freshen · ${fmt$(c)}</button>`:""}</div>`;}
  else if(!career())h+=`<p class="hint" style="margin:6px 0 0">Sandbox: no wear on the parts.</p>`;
  return h+`</div>`;}
function rnNextHtml(N){const br=N.fmt==="bracket",i=rnOppIdx(N),rv=N.field[i-1],qb=rnQualBest(N,i),rd=N.stage>=2,ri=N.stage-2;
  const win=rd?Math.round(N.purse*(ri===2?1:ri===1?0.45:0.2)/50)*50:0,lose=rd?Math.round(N.purse*RN_PAY[ri===0?5:ri===1?3:2]/50)*50:0;
  const h=rd&&br?rnTreeOffsets(N.dial,rv.dial):null;
  return`<div class="rnnext"><span>NEXT · ${rnStageName(N,N.stage)}</span><b>${rd&&N.seeds?"#"+(N.seeds.indexOf(i)+1)+" ":""}${esc(rv.name)}</b><small>${esc(rv.car)}${br?` · dial ${rv.dial.toFixed(2)}`:qb&&qb.et!=null?` · qualified ${qb.et.toFixed(3)}`:` · runs about ${rv.mean.toFixed(2)}`}${rd?` · win ${fmt$(win)} / out ${fmt$(lose)}${career()?"":" (sandbox)"}`:""}</small>${h?`<small>${h.p>0?`Their tree starts first — you go ${h.p.toFixed(2)} s after them`:h.o>0?`Your tree starts first — ${h.o.toFixed(2)} s head start`:"Same dial — the trees come down together"}</small>`:""}</div>`;}
function rnSummaryHtml(N){const br=N.fmt==="bracket",b=N.best,rts=(N.passes||[]).filter(p=>p.rt!=null&&p.rt>=0).map(p=>p.rt);
  return`<div class="rnsum ${N.place===1?"won":""}"><div class="big">${N.left&&N.place===9?"LEFT THE NIGHT":RN_PLACE[N.place].toUpperCase()}</div><p>${RN_FMT[N.fmt]} · ${SIM.AERO[N.body].n}${N.week!=null?" · week "+N.week:""}</p>
  <div class="vstats"><div><b>${N.won}</b><span>rounds won</span></div><div><b>${b?b.et.toFixed(3):"—"}</b><span>best ET${b&&b.mph?" · "+Math.round(b.mph):""}</span></div><div><b>${rts.length?Math.min.apply(null,rts).toFixed(3):"—"}</b><span>best light</span></div><div><b>${fmt$(N.paid||0)}</b><span>purse${career()?"":" (sandbox)"}</span></div><div><b>${career()?"+"+(N.rep||0):"—"}</b><span>rep</span></div></div>
  <div class="log" style="margin-top:8px">${N.hist.map(x=>`<div><b>${x.label}</b>${x.opp?"vs "+esc(rnPart(N,x.opp).name)+" · ":""}${esc(x.text||"")}</div>`).join("")}</div>
  <button class="btn pri" data-rn="done" style="width:100%;margin-top:10px">Done — back to the pits</button></div>`;}
function rnPanel(){const N=rnCur();if(!N)return"";const br=N.fmt==="bracket";
  let h=`<div class="rn"><div class="rnhd"><div><b>${N.quick?"BRACKET NIGHT":RN_FMT[N.fmt].toUpperCase()}</b><span>${SIM.AERO[N.body].n} · 8 cars · winner ${fmt$(N.purse)}${career()?"":" (sandbox)"}</span></div>${N.done?"":`<button class="btn sm ghost" data-rn="leave">Leave the night</button>`}</div>`;
  h+=`<div class="rnsteps">${[0,1,2,3,4].filter(s=>!(N.quick&&s<2)).map(s=>`<i class="${s<N.stage||N.done&&s<=N.stage?"d":s===N.stage&&!N.done?"on":""}">${br&&s<2?"TT"+(s+1):["Q1","Q2","QF","SF","F"][s]}</i>`).join("")}</div>`;
  if(testing&&!N.done)return h+rnNextHtml(N)+`</div>`;   // during the pass: just who's in the other lane
  if(N.done)return h+rnSummaryHtml(N)+(N.rounds.length?rnLadderHtml(N):rnQualHtml(N))+`</div>`;
  h+=rnNextHtml(N)+dragDriveHtml(true);
  h+=N.stage<2?`<div class="lbl"><span>${br?"The field — time trials to learn your number":"Qualifying — best of two sets the seed"}</span></div>`+rnQualHtml(N):rnLadderHtml(N);
  return h+rnPitsHtml(N)+`</div>`;}
/* race night pits vignette: between rounds the view shows the car up on stands in the pits (ENGINE_VIS.setPits) with the pits
   tune as tags on the car. A tag opens its control in a bar along the bottom of the view; the bar's buttons press the same
   controls in the pits panel below, which stays the one source of truth. */
var pitsKey="",pitsSel=null,pitsPass={n:-1,t:0},pitsPokeK=null;   // var: renderEnv can run before this line on boot
function pitsWanted(){const N=rnCur();return !!(N&&!N.done&&!testing&&S.env.testType==="drag"&&$("tab-events").classList.contains("on")&&!$("app").classList.contains("td"));}
function pitsTags(){const q=s=>$("envBox").querySelector(s),T=[];
  const rv=k=>{const b=q(`[data-rn="tune"][data-k="${k}"]`),r=b&&b.closest(".rnt");if(!r)return null;const sp=r.querySelector("span"),sm=sp.querySelector("small");return{k,lbl:sp.firstChild.textContent,sub:sm?sm.innerHTML:"",val:r.querySelector("b").textContent};};
  const L=rv("launch"),f=rv("first"),fd=rv("final"),p=rv("psi");
  if(L)T.push({k:"launch",t:L.lbl.replace(/ rpm$/,""),v:L.val,rows:[L]});
  if(f&&fd)T.push({k:"gear",t:"Gearing",v:f.val.replace(":1","")+" · "+fd.val.replace(":1",""),rows:[Object.assign({},f,{lbl:"1st"}),Object.assign({},fd,{lbl:"Final"})]});
  if(p)T.push({k:"psi",t:"Tyres",v:p.val,rows:[p]});
  const sh=q('[data-rn="shock"].on');T.push({k:"shocks",t:"Shocks",v:sh?sh.firstChild.textContent:"Medium",seg:1});
  const wi=career()&&quick?wearInfo(quick):null;if(wi)T.push({k:"wear",t:"Wear",v:Math.round(wi.w*100)+"%",wi});
  const dl=q(".rnt.dial");if(dl)T.push({k:"dial",t:"Dial-in",v:dl.querySelector("b").textContent,dial:1});
  return T;}
function pitsStepHtml(x){const fw=(s,lbl,aria)=>`<button data-fw='${s}' aria-label="${aria}">${lbl}</button>`;
  const nud=(r,full)=>`<div class="psr${full?"":" half"}">${full?"":`<i>${r.lbl}</i>`}${fw(`[data-rn="tune"][data-k="${r.k}"][data-d="-1"]`,"−","less")}<b>${full?r.val:r.val.replace(":1","")}</b>${fw(`[data-rn="tune"][data-k="${r.k}"][data-d="1"]`,"+","more")}</div>`;
  let sub="",c="";
  if(x.rows&&x.rows.length===1){sub=x.rows[0].sub;c=nud(x.rows[0],1);}
  else if(x.rows){sub="shorter = harder hit";c=x.rows.map(r=>nud(r,0)).join("");}
  else if(x.seg){const on=(($("envBox").querySelector('[data-rn="shock"].on')||{}).dataset||{}).k||"medium";c=`<div class="pseg">${[["soft","Soft"],["medium","Medium"],["firm","Firm"]].map(([k,n])=>`<button data-fw='[data-rn="shock"][data-k="${k}"]' class="${on===k?"on":""}">${n}</button>`).join("")}</div>`;sub="soft: more bite, lifts · firm: flat, may spin";}
  else if(x.wi){const fb=$("envBox").querySelector('[data-rn="freshen"]');sub=`${x.wi.passes} of ${x.wi.budget} passes${x.wi.w>=1?" · past budget":""}`;c=fb?`<button class="psw" data-fw='[data-rn="freshen"]'>${fb.textContent}</button>`:`<span class="psn">Fresh — nothing to do</span>`;}
  else if(x.dial){const sg=$("envBox").querySelector('[data-rn="dialsug"]');sub="under it is a breakout";c=`<div class="psr">${fw('[data-rn="dial"][data-d="-1"]',"−","quicker")}<b>${x.v}</b>${fw('[data-rn="dial"][data-d="1"]',"+","slower")}</div>${sg?`<button class="psw" data-fw='[data-rn="dialsug"]'>${sg.textContent.replace(/ \(.*\)/,"")}</button>`:""}`;}
  return`<div class="pstep"><div class="psh"><b>${x.t}</b><small>${sub}</small><button class="psx" aria-label="Close">×</button></div><div class="psc">${c}</div></div>`;}
function pitsSync(){if(!ENGINE_VIS.setPits)return;let ov=$("pitsOv");
  if(!pitsWanted()){if(ov&&!ov.hidden){ov.hidden=true;$("app").classList.remove("pits");}ENGINE_VIS.setPits({on:false});pitsKey="";return;}
  const N=rnCur();
  if(!ov){ov=document.createElement("div");ov.id="pitsOv";$("view").appendChild(ov);ov.addEventListener("click",pitsOvClick);
    if(window.ResizeObserver)new ResizeObserver(()=>pitsPlace()).observe($("view"));
    if(window.MutationObserver){const mo=new MutationObserver(()=>requestAnimationFrame(pitsPlace));mo.observe($("app"),{attributes:true,attributeFilter:["class"]});mo.observe(document.documentElement,{attributes:true,attributeFilter:["class"]});}}   // the strip/teardown classes come off: lay the tags out again
  ov.hidden=false;$("app").classList.add("pits");
  const np=(N.passes||[]).length;if(np!==pitsPass.n){pitsPass={n:np,t:pitsPass.n>=0&&np>0?Date.now():0};}   // just off the strip: hot tyres
  const veh=rnVeh(dragVeh());
  ENGINE_VIS.setPits({on:true,body:N.body,color:carPaint(),hw:stripHw(S.cfg),tyreIn:veh.tyreDia,wbar:wbarOn({wbar:S.env.wbar,body:N.body}),nightK:rnNightK(N.stage),
    heat:pitsPass.t?Math.max(0,1-(Date.now()-pitsPass.t)/90000):0,poke:pitsPokeK});pitsPokeK=null;
  const T=pitsTags();if(pitsSel&&!T.some(x=>x.k===pitsSel))pitsSel=null;
  const key=JSON.stringify(T.map(x=>[x.k,x.v]))+"|"+pitsSel+"|"+N.stage+"|"+((T.find(x=>x.k===pitsSel)||{}).wi?$("envBox").querySelector('[data-rn="freshen"]')?1:0:"");
  if(key!==pitsKey){pitsKey=key;const sel=T.find(x=>x.k===pitsSel);ov.classList.toggle("sel",!!sel);
    ov.innerHTML=`<svg aria-hidden="true"></svg>${T.map(x=>`<button class="pt${x.k===pitsSel?" on":""}" data-pk="${x.k}" aria-expanded="${x.k===pitsSel}"><span><i>${x.t}</i><b>${x.v}</b></span></button>`).join("")}
      <div class="pcap"><b>PITS</b> · ${rnStageName(N,N.stage)} next · tap a tag to tune</div>${sel?pitsStepHtml(sel):""}`;}
  pitsPlace();}
function pitsOvClick(e){const t=e.target.closest(".pt");
  if(t){pitsSel=pitsSel===t.dataset.pk?null:t.dataset.pk;pitsKey="";pitsSync();return;}
  if(e.target.closest(".psx")){pitsSel=null;pitsKey="";pitsSync();return;}
  const f=e.target.closest("[data-fw]");if(!f)return;const b=$("envBox").querySelector(f.dataset.fw);if(!b)return;
  pitsPokeK=pitsSel;b.click();const p=$("pitsOv").querySelector(`.pt[data-pk="${pitsSel}"]`);if(p){p.classList.remove("pulse");void p.offsetWidth;p.classList.add("pulse");}}
/* tags next to their part of the car (anchors from the 3D view), kept clear of the header and the bar, nudged apart */
function pitsPlace(){const ov=$("pitsOv");if(!ov||ov.hidden)return;const svg=ov.querySelector("svg");if(!svg)return;
  const A=ENGINE_VIS.pitsAnchors&&ENGINE_VIS.pitsAnchors(),tags=[...ov.querySelectorAll(".pt")].filter(t=>t.offsetParent!==null);
  if(!A||$("app").classList.contains("mini")&&!document.documentElement.classList.contains("desk")){   /* the phone's small view: just the caption */tags.forEach(t=>t.style.visibility="hidden");svg.innerHTML="";return;}
  const vr=ov.getBoundingClientRect(),hb=$("hud"),hr=hb?[...hb.children].reduce((m,c)=>c.offsetParent?Math.max(m,c.getBoundingClientRect().bottom):m,0):0;
  const top=Math.max(8,hr-vr.top+6),st=ov.querySelector(".pstep"),bot=vr.height-(st?st.offsetHeight+16:30);
  const OFF={launch:[0.5,-1],wear:[-0.9,-0.8],gear:[0.2,1],psi:[-0.8,0.9],shocks:[-0.9,-1],dial:[0,-1]},D=34,placed=[];let lines="";
  tags.forEach(t=>{const k=t.dataset.pk,a=A[k];if(!a||!a[2]){t.style.visibility="hidden";return;}
    const w=t.offsetWidth,h=t.offsetHeight,o=OFF[k]||[0,-1];let x=a[0]+o[0]*(D+w*0.3)-w/2,y=a[1]+o[1]*D-h/2;
    const fx=v=>Math.max(4,Math.min(vr.width-w-4,v)),fy=v=>Math.max(top,Math.min(bot-h,v));
    /* rings of spots around the wanted one, nearest first: the first that overlaps nothing wins, else the least overlap (the phone's
       short view used to stack Dial-in on Gearing) */
    const ovl=(cx,cy)=>placed.reduce((s,p)=>s+Math.max(0,Math.min(cx+w,p.x+p.w+2)-Math.max(cx,p.x-2))*Math.max(0,Math.min(cy+h,p.y+p.h+2)-Math.max(cy,p.y-2)),0);
    let bx=fx(x),by=fy(y),best=Infinity;
    ring:for(let r=0;r<=4;r++)for(const [dx,dy] of r?[[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]]:[[0,0]]){
      const cx=fx(x+dx*r*(w*0.5+4)),cy=fy(y+dy*r*(h*0.55+2)),o=ovl(cx,cy);
      if(o===0){bx=cx;by=cy;break ring;}const c=o*10+Math.hypot(cx-x,cy-y);if(c<best){best=c;bx=cx;by=cy;}}
    x=bx;y=by;
    placed.push({x,y,w,h});t.style.transform=`translate(${Math.round(x)}px,${Math.round(y)}px)`;t.style.visibility="visible";
    lines+=`<line x1="${a[0]}" y1="${a[1]}" x2="${Math.round(x+w/2)}" y2="${Math.round(y+h/2)}"/><circle cx="${a[0]}" cy="${a[1]}" r="3.5"/>`;});
  svg.innerHTML=lines;}
/* Driver: you, or the auto driver (S.env.dragDrive; env only, never cfg or cfgHash). On a race night it is set once and drives every pass. */
/* custom gear spacing: 1st and top come from their own sliders, the gears between from g2..g6 (S.env); unset ones sit where even spacing puts them */
const DRAG_MID_G=["g2","g3","g4","g5","g6"];
function dragRatios(){const e=S.env;if(e.gearSet!=="custom"||!(e.gears>=3))return undefined;const r=SIM.gearRatios(e);for(let i=1;i<r.length-1;i++){const x=+e["g"+(i+1)];if(x>0)r[i]=x;}return r;}
function dragGearFill(){const e=S.env,r=SIM.gearRatios(e);DRAG_MID_G.forEach(k=>delete e[k]);for(let i=1;i<r.length-1;i++)e["g"+(i+1)]=+r[i].toFixed(2);}
function dragEvenTxt(){return SIM.gearRatios(S.env).map(x=>x.toFixed(2)).join(" · ");}
function dragGearHtml(sl){const e=S.env,n=e.gears|0;if(n<3)return"";const cus=e.gearSet==="custom",r=cus?dragRatios():SIM.gearRatios(e);
  let h=`<div class="lbl"><span>Gear spacing</span></div><div class="seg">${[["even","Even","spaced evenly from 1st to top"],["custom","Custom","set each gear in between"]].map(([k,nm,d])=>`<button data-lp="${k}" data-ek="gearSet" class="${(cus?"custom":"even")===k?"on":""}">${nm}<small>${d}</small></button>`).join("")}</div>`;
  if(cus){h+=`<div class="envgrid">`;for(let i=1;i<n-1;i++)h+=sl("g"+(i+1),["2nd","3rd","4th","5th","6th"][i-1]+" gear",0.3,6,0.01,":1",+r[i].toFixed(2));h+=`</div><p class="hint" style="margin-top:-4px">Each gear stays between the one before it and top gear. Close ratios keep the engine near its power; a big drop pulls it down the curve.</p>`;}
  else h+=`<p class="hint" id="dgEven" style="margin-top:-4px">${dragEvenTxt()}</p>`;
  return h;}
function dragShiftHtml(sl){const e=S.env;if(e.shiftMode==="manual")return"";const red=S.cfg.redline,def=red-200,lo=Math.min(def,Math.max(2000,Math.round(red*0.5/50)*50));
  return`<div class="envgrid">${sl("shiftRpm","Shift rpm",lo,red,50,"",e.shiftRpm>0?Math.min(red,Math.max(lo,e.shiftRpm)):def)}</div><p class="hint" style="margin-top:-4px">Where the box changes up. Out of the box it is ${def} (redline less 200); shift where the next gear pulls harder than this one to go quicker.</p>`;}
/* chassis: ride height */
function dragChassisHtml(sl){const e=S.env;
  return `<div class="envgrid">${sl("rideH","Ride height",-50,75,5," mm",+e.rideH||0)}</div><p class="hint" style="margin-top:-4px"><b>Ride height</b> · 0 is the body as delivered. Up puts more weight on the rear tyres at the hit but lifts the nose sooner and catches more air; down is the reverse.</p>`;}
function dragDriveHtml(night){const on=dragAuto();
  return driverToggle(k=>`data-lp="${k}" data-ek="dragDrive"`,on?"auto":"you","burnout, stage, the light, the shifts","a sharp light and the quickest shifts · watch the pass")
    +(on?`<p class="hint">The auto driver does the burnout, stages${n2oKit()?", purges the nitrous":""}${(()=>{const lt=SIM.launchTech(S.cfg);return lt.launchCtl!=="none"||lt.transBrake==="trans_brake"||alsOf(S.cfg);})()?", arms the launch on the ambers":""} and leaves on the green with a sharp light, .02 to .045, never red. It does the burnout the right length for the tyres${S.env.shiftMode==="manual"?", and shifts where this engine's curve makes the pass quickest":""}. Launch rpm${n2oKit()?", the nitrous switch":""} and the chute stay as you set them. It drives close to as well as the car allows: beating it takes a light under .030${S.env.shiftMode==="manual"?" and shifts right on the mark":""}.${night?" It drives every pass of the night.":""} Tap ${document.documentElement.classList.contains("desk")?"the button or Space":"the button"} during a pass to take over.</p>`:"");}
function rnFmtHtml(){const f=RN_FMT[S.env.dragFmt]?S.env.dragFmt:"test";
  let h=`<div class="lbl"><span>Race format</span></div><div class="seg n3">${[["test","Test & tune","single pass"],["elim","Eliminations","8-car ladder"],["bracket","Bracket","dial-in"]].map(([k,n,d])=>`<button data-lp="${k}" data-ek="dragFmt" class="${f===k&&!(k==="bracket"&&S.env.dragQuick)?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>`;
  if(f==="bracket"&&S.env.dragQuick)h+=`<p class="hint" style="margin-top:-4px"><b>Bracket night</b> · dial in the ET you expect — run quicker than your dial and you break out and lose. Three rounds, no time trials; the slower dial leaves first, so tap on the green of your own tree. ${career()?`Entry about 8% of the winner's purse (from $150), opens at ${BR_REP} rep.`:"Free in the sandbox."}</p>`;
  else if(f!=="test")h+=`<p class="hint" style="margin-top:-4px"><b>${RN_FMT[f]}</b> · ${f==="elim"?"two qualifying passes set your seed, then quarter-final, semi and final against seven cars of your class. First to the stripe wins — a quick light beats a quick car. Red light or crossing the centreline loses.":"dial in the ET you expect. The slower dial leaves first; first to the stripe wins unless they ran under their dial (a breakout). Both under: the smaller breakout wins. Consistency beats horsepower."} ${career()?`Entry about 8% of the winner's purse (from $150), fuel per pass. Same rules as a pass: certified engine, ${(UPGRADES.find(u=>u.id==="race")||{}).name} upgrade.`:"Free in the sandbox."} Set the car up below — body, tyre and weight lock when you enter.</p>`;
  return h;}
function rnTuneEnvHtml(sl){const e=S.env,psi0=(SIM.TYRES[e.tyre]||SIM.TYRES.street).psi||16,sh=e.shocks||"medium";
  return`<div class="envgrid">${sl("tyrePsi","Tyre pressure",+(psi0*0.5).toFixed(1),+(psi0*1.4).toFixed(1),0.5," psi",e.tyrePsi>0?e.tyrePsi:psi0)}</div><div class="lbl"><span>Shocks</span></div><div class="seg n3">${[["soft","Soft","more bite · lifts"],["medium","Medium","as delivered"],["firm","Firm","flat · may spin"]].map(([k,n,d])=>`<button data-lp="${k}" data-ek="shocks" class="${sh===k?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>`;}
function rnRecHtml(){const R=recs();if(!R.nightsRun)return"";return`<div class="rec"><span>Race nights</span><b>${R.nightsWon||0}<i>of ${R.nightsRun} won</i></b><small>best finish: ${(RN_PLACE[R.bestFinish]||"—").toLowerCase()}</small></div>`;}
function rnSlipHtml(r){const n=r.night;if(!n)return"";return`<div class="sec"><h2>${n.label}${n.win===true?" · won":n.win===false?" · out":""}</h2><div class="log"><div><b>vs</b>${esc(n.opp)} · ${esc(n.car)} — RT ${n.oppRt!=null?n.oppRt.toFixed(3):"—"}${n.oppBroke?" · broke":n.oppEt!=null?" · "+n.oppEt.toFixed(3)+" @ "+Math.round(n.oppMph):""}${n.dialO!=null?" on a "+n.dialO.toFixed(2):""}</div>${n.dialP!=null?`<div><b>Dial</b>${n.dialP.toFixed(2)}${r.et!=null?" · ran "+(r.et-n.dialP>=0?"+":"")+(r.et-n.dialP).toFixed(3):""}</div>`:""}<div>${esc(n.text)}</div></div></div>`;}
function rnVerdict(r){const n=r.night,R=r.race;const cls=n.win===true?"pass":n.win===false?"fail":r.et==null?"fail":"marg";
  return`<div class="verdict ${cls}"><div style="flex:1"><div class="big">${n.label}${n.win===true?" · WON":n.win===false?" · OUT":""}<br><span style="font-size:.7em;opacity:.85">${r.et!=null?r.et.toFixed(3)+" s @ "+Math.round(r.mph)+" mph":"DID NOT FINISH"}${R&&R.rt!=null?" · RT "+(R.foul?"red":R.rt.toFixed(3)):""}</span></div><p>${esc(n.text)}</p>${r.auto?`<p>${dragAutoWord(r.auto)}</p>`:""}${n.place?`<p><b>${RN_PLACE[n.place]}</b> — the night's summary is up top.</p>`:""}<div class="vstats">${r.marks.map(m=>`<div><b>${m.t.toFixed(2)}</b><span>${m.n}${m.n==="1/8 mi"||m.n==="1/4 mi"?" · "+Math.round(m.mph)+" mph":""}</span></div>`).join("")}</div></div></div>`;}
/* r15: one place for the between-rounds limits, shared by the − / + steps and the sliders. 1st and final get the same full range
   as the test-cell sliders (r16; was a band around the night's start); psi is half..1.4× the tyre's baseline */
function rnTuneLim(N,k){const lt=SIM.launchTech(S.cfg);
  if(k==="launch")return lt.launchCtl!=="none"?{lo:2000,hi:S.cfg.redline,step:100,v:lt.twoStepRpm}:{lo:1000,hi:S.cfg.redline,step:100,v:Math.min(S.env.launchRpm,S.cfg.redline)};
  if(k==="first"){const v=+S.env.first;return{lo:Math.min(v,0.75),hi:Math.max(v,6),step:0.05,v};}
  if(k==="final"){const v=+S.env.final;return{lo:Math.min(v,1),hi:Math.max(v,7),step:0.05,v};}
  const p0=SIM.TYRES[N.lock.tyre].psi||16;return{lo:+(p0*0.5).toFixed(1),hi:+(p0*1.4).toFixed(1),step:0.5,v:S.env.tyrePsi>0?S.env.tyrePsi:p0};}
$("envBox").addEventListener("change",e=>{if(!(e.target.dataset&&e.target.dataset.rnr))return;save();const sc=$("panel").scrollTop;renderEnv();$("panel").scrollTop=sc;});
$("envBox").addEventListener("click",e=>{if(e.target.closest('[data-ek="tyre"],[data-ek="body"]')&&S.env.tyrePsi!=null){delete S.env.tyrePsi;renderEnv();save();}});
