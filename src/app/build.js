/* ===================== BUILD ===================== */
const CLS_DEFAULT={g10:"economy","4ac":"economy","22re":"truck",ea82:"economy",l36:"truck",k20a:"performance","2jzgte":"performance",rb26:"performance",ls3:"performance",coyote:"performance",ej257:"performance",f6_38:"performance",s54:"performance",v8fp45:"performance",v12_65:"performance",v10_52:"performance",i3_1000:"economy",ea888:"economy",m133:"performance",hemi64:"performance",i5_25t:"performance",outlaw_radial:"outlaw",outlaw_promod:"outlaw"};
const CLS_LABEL={economy:"Economy",truck:"Truck & industrial",classic:"Classic",performance:"Performance",motorsport:"Motorsport",outlaw:"Outlaw",diesel:"Diesel",pulling:"Pulling",rotary:"Rotary"};
const FAM_OF=l=>l[0]==="I"?"inline":l[0]==="F"?"flat":l[0]==="R"?"rotary":"vee";
function presetCls(p){return p.cls||CLS_DEFAULT[p.id]||"performance";}
function presetDisp(p){const L=SIM.LAYOUTS[p.cfg.layout]||{n:4};if(p.cfg.cycle==="two"&&!L.rotary)return L.n*(L.opposed?2:1)*Math.PI/4*p.cfg.bore*p.cfg.bore*p.cfg.stroke/1e6;if(L.rotary)return L.n*3*Math.sqrt(3)*p.cfg.stroke*(p.cfg.ecc||15)*p.cfg.bore/1e6;   // Mazda: one chamber per rotor
  return L.n*Math.PI/4*p.cfg.bore*p.cfg.bore*p.cfg.stroke/1e6;}
function renderPresets(){
  const sort=S.pSort||"layout", fam=S.pFam||"all", cls=S.pCls||"all";
  document.querySelectorAll("#pSort button").forEach(x=>x.classList.toggle("on",x.dataset.ps===sort));
  document.querySelectorAll("#pFam .chip").forEach(x=>x.classList.toggle("on",x.dataset.pf===fam));
  document.querySelectorAll("#pCls .chip").forEach(x=>x.classList.toggle("on",x.dataset.pc===cls));
  $("pReset").hidden=(sort==="layout"&&fam==="all"&&cls==="all");
  const LORDER=["I1","I2","I3","I4","I5","I6","V4","V6","V8","V8F","V10","V12","F4","F6","R1","R2","R3","R4","D18"];
  let list=PRESETS.map((p,i)=>({p,i,disp:presetDisp(p),n:(SIM.LAYOUTS[p.cfg.layout]||{n:0}).n,cls:presetCls(p),fam:FAM_OF(p.cfg.layout),two:p.cfg.cycle==="two"}));
  list=list.filter(e=>fam!=="two"||e.two);if(fam==="two")list.forEach(e=>e.fam="two");   // the two-stroke chip cuts across layouts
  list=list.filter(e=>(fam==="all"||e.fam===fam)&&(cls==="all"||e.cls===cls));
  const key=e=>sort==="size"?e.disp:sort==="power"?-e.p.realHp:sort==="class"?Object.keys(CLS_LABEL).indexOf(e.cls)*1000+e.disp:LORDER.indexOf(e.p.cfg.layout)*1000+e.disp;
  list.sort((a,b)=>key(a)-key(b));
  const groupOf=e=>sort==="layout"?(SIM.LAYOUTS[e.p.cfg.layout]||{}).name||e.p.cfg.layout:sort==="class"?CLS_LABEL[e.cls]:sort==="size"?(e.disp<1.6?"Under 1.6 L":e.disp<2.6?"1.6 – 2.5 L":e.disp<4.1?"2.6 – 4.0 L":e.disp<6.1?"4.1 – 6.0 L":"Over 6 L"):(e.p.realHp<150?"Under 150 hp":e.p.realHp<300?"150 – 299 hp":e.p.realHp<600?"300 – 599 hp":e.p.realHp<1000?"600 – 999 hp":"1,000 hp and up");
  const card=e=>{const p=e.p,lk=career()&&presetLocked(p.cfg);return `<button class="preset ${lk?"lock":""}${p.starter?" starter":""}" data-p="${e.i}"><span>${p.starter?"Starter · ":""}${p.basedOn}</span><b>${p.name}</b><small>${e.two?"2T ":""}${p.cfg.layout} ${fmtDisp(e.disp)} · ${p.realHp} hp${lk?` · needs ${lk}`:""}</small></button>`;};
  let h="",g=null,buf=[];const flush=()=>{if(buf.length)h+=`<div class="pgroup">${g}<i>${buf.length}</i></div><div class="presets">${buf.join("")}</div>`;buf=[];};
  for(const e of list){const gg=groupOf(e);if(gg!==g){flush();g=gg;}buf.push(card(e));}
  flush();
  $("presets").innerHTML=h||`<p class="hint">Nothing matches those filters.</p>`;
  $("presetCnt").textContent=`${list.length} of ${PRESETS.length} · ${PRESETS.filter(p=>p.starter).length} starter`;
  const avail=career()?PRESETS.filter(p=>!presetLocked(p.cfg)).length:PRESETS.length;
  $("presetSum").textContent=(career()?`${avail} of ${PRESETS.length} buildable`:`${PRESETS.length} engines`)+(fam!=="all"||cls!=="all"?" · filtered":"");
}
$("pSort").addEventListener("click",e=>{const b=e.target.closest("[data-ps]");if(!b)return;S.pSort=b.dataset.ps;renderPresets();save();});
$("pFam").addEventListener("click",e=>{const b=e.target.closest("[data-pf]");if(!b)return;S.pFam=b.dataset.pf;renderPresets();save();});
$("pCls").addEventListener("click",e=>{const b=e.target.closest("[data-pc]");if(!b)return;S.pCls=b.dataset.pc;renderPresets();save();});
$("pReset").addEventListener("click",()=>{S.pSort="layout";S.pFam="all";S.pCls="all";renderPresets();save();toast("Filters reset");});
function presetLocked(cfg){for(const k in OPT){if(k==="layout")continue;const o=OPT[k][cfg[k]];if(locked(o))return (UPGRADES.find(u=>u.id===o.req)||{}).name;}const L=OPT.layout[cfg.layout];if(locked(L))return (UPGRADES.find(u=>u.id===L.req)||{}).name;return null;}
$("presets").addEventListener("click",e=>{const b=e.target.closest("[data-p]");if(!b)return;if(testing){toast("Let the run finish first");return;}const p=PRESETS[+b.dataset.p];const lk=career()&&presetLocked(p.cfg);if(lk){toast(`Needs the ${lk} upgrade`);return;}S.cfg=Object.assign({},SIM.DEFAULT_CFG,p.cfg);S.profileId=p.soundProfile;S.name=p.name;resetBase();afterCfgChange(true);toast(`${p.name} loaded — ${p.blurb}`);tourAdvance(0);});
/* live deltas: what each option would do to hp / reliability / unit cost, from a real simulate() call (cached) */
const deltaCache=new Map();
function probe(k,v){const key=cfgHash(S.cfg)+"|"+envHash()+"|"+k+"="+v;let r=deltaCache.get(key);if(r)return r;
  const cfg=Object.assign({},S.cfg,{[k]:v});if(k==="fuel")fuelFamilyDefaults(cfg,isCI(S.cfg.fuel),S.cfg.fuel);clampCfgLimits(cfg);const q=SIM.simulate(cfg,simEnv({testType:"pull"}));r={hp:q.peakHp,rel:q.rel,cost:q.cost,fails:q.fails.length};
  if(deltaCache.size>1500)deltaCache.clear();deltaCache.set(key,r);return r;}
const money=n=>{const a=Math.abs(n);return (n<0?"−$":"+$")+(a>=1000?(a/1000).toFixed(a>=10000?0:1)+"k":String(Math.round(a)));};
function fmtDelta(r,base){if(!base)return"";const dh=Math.round(r.hp-base.peakHp),dr=Math.round(r.rel-base.rel),dc=Math.round(r.cost-base.cost);
  if(r.fails&&!base.fails.length)return`<i class="x">breaks</i>`;
  if(Math.abs(dh)>=1)return`<i class="${dh>0?"up":"dn"}">${dh>0?"+":"−"}${Math.abs(dh)} hp</i>`;
  if(Math.abs(dr)>=2)return`<i class="${dr>0?"up":"dn"}">${dr>0?"+":"−"}${Math.abs(dr)} rel</i>`;
  if(Math.abs(dc)>=5)return`<i>${money(dc)}</i>`;
  return"<i>no change</i>";}
function fillDeltas(root){if(!quick)return;root.querySelectorAll("button[data-k]").forEach(b=>{const d=b.querySelector(".d");if(!d)return;
  if(b.classList.contains("on")){d.innerHTML="<i style=\"color:var(--orange2)\">fitted</i>";return;}if(b.classList.contains("lock")){d.innerHTML="";return;}
  d.innerHTML=fmtDelta(probe(b.dataset.k,isNaN(+b.dataset.v)?b.dataset.v:b.dataset.v),quick);});}
const fLabel=(f,c)=>(f.labelIf&&f.labelIf(c||S.cfg))||f.label;   // a FORM field can rename itself for the build (diesel timing / lambda)
function segRow(f){
  const c=S.cfg,opts=OPT[f.optTable||f.key],lb=fLabel(f);const famOK=(o,k)=>(!o.fam||o.fam===(isCI(c.fuel)?"ci":"si")||c[f.key]===k)&&!(f.key==="fuel"&&o.ci&&isRot(c))&&!(f.key==="layout"&&c[f.key]!==k&&(isTs(c)?!!o.rotary||!!(SIM.LAYOUTS[k]||{}).rotary:!!o.two))&&!(f.key==="intake"&&k==="carb"&&isCI(c.fuel)&&c[f.key]!==k);   // no carb on a diesel;   // nitrous kits for the other fuel family stay out of the way; a Wankel takes no diesel   // nitrous kits for the other fuel family stay out of the way
  let h=`<div class="lbl"><span>${lb}</span><button class="q" data-info="${f.optTable||f.key}" data-ckey="${f.key}" data-lbl="${lb}" aria-label="About ${lb}">${opts[c[f.key]]?specLine(f.optTable||f.key,opts[c[f.key]]):"details"} ›</button></div><div class="seg n${Object.keys(opts).filter(k=>famOK(opts[k],k)).length}">`;
  for(const k in opts){const o=opts[k];if(!famOK(o,k))continue;const lk=locked(o);const req=lk?UPGRADES.find(u=>u.id===o.req):null;
    h+=`<button data-k="${f.key}" data-v="${k}" class="${c[f.key]===k?"on":""}${lk?" lock":""}" ${lk?`data-req="${req?req.name:""}"`:""}>${o.name}<small class="d"></small></button>`;}
  return h+"</div>";
}
const fMin=(f,c)=>f.minIf?f.minIf(c||S.cfg):f.min;
const fMax=(f,c)=>f.maxIf?f.maxIf(c||S.cfg):f.max;
// pull every slider back inside the limits the fitted hardware allows
function clampCfgLimits(c){c=c||S.cfg;let moved=null;
  for(const f of FORM.flatMap(x=>x.fields)){if(f.type!=="slider")continue;
    const lo=fMin(f,c),hi=fMax(f,c),v=c[f.key];
    if(v>hi+1e-9){c[f.key]=hi;moved=moved||f;}else if(v<lo-1e-9){c[f.key]=lo;moved=moved||f;}}
  return moved;}
function sliderRow(f){const v=S.cfg[f.key],lo=fMin(f),hi=fMax(f);
  const unlocked=f.maxIf&&hi>f.max&&!isRot(S.cfg)&&fMax(f,Object.assign({},S.cfg,{fuel:"r91"}))>f.max;   // "billet" only when the outlaw parts raised it, not the diesel limits
  return `<div class="lbl"><span>${fLabel(f)}${unlocked?' <em class="unl">billet</em>':""}${mapTagFor(f.key)}</span><b id="v-${f.key}" class="tap" data-num="${f.key}" title="Tap to type">${f.fmt?f.fmt(v):v}${f.unit?" "+f.unit:""}</b></div><div class="srow"><button class="nud" data-nud="-1" data-nk="${f.key}" aria-label="Decrease">−</button><input type="range" id="r-${f.key}" data-k="${f.key}" min="${lo}" max="${hi}" step="${f.step}" value="${v}"><button class="nud" data-nud="1" data-nk="${f.key}" aria-label="Increase">+</button></div>`;}
/* petrol <-> diesel: a petrol map on a diesel (or the reverse) is nonsense, so switching family drops in a tune that runs.
   Returns the toast, or null when the family didn't change. clampCfgLimits() then pulls the rest inside the new limits. */
/* MORE FUELS: flex gets a blend to read and a gas fuel a system to meter it (the smallest one that feeds it and is unlocked) */
function altFuelFill(c){if(c.fuel==="flex"&&c.ethanolPct==null)c.ethanolPct=85;
  if(isGasF(c.fuel)&&!(c.gasSys&&OPT.gasSys[c.gasSys])){let g="mixer";try{const f=SIM.fitFuel(c).gasSys;if(f&&!locked(OPT.gasSys[f]))g=f;}catch(e){}c.gasSys=g;}}
function fuelFamilyDefaults(c,wasD,was){const fam=fuelFamilyDefaults0(c,wasD);let t=fam;
  if(isGasF(c.fuel)&&!isGasF(was)&&!isCI(c.fuel)){const cr0=c.cr;c.cr=Math.min(13,Math.round((c.cr+(c.asp==="na"?1:0.5))*2)/2);
    if(c.cr!==cr0)t=(fam?fam.replace(/ to start$/,"")+"; ":"")+`${OPT.fuel[c.fuel].short}: compression ${c.cr.toFixed(1)}:1 to use the octane`;}
  altFuelFill(c);return t;}
function fuelFamilyDefaults0(c,wasD){const d=isCI(c.fuel);if(d===wasD)return null;const boosted=c.asp!=="na";
  const ct=OPT.cat&&OPT.cat[c.cat];if(ct&&ct.fam)c.cat="none";   // a cat on a diesel or a DPF on a petrol engine: back to none
  if(d){c.cr=17.5;c.lambda=1.8;c.timing=0;c.redline=Math.min(c.redline,4200);c.cam=Math.min(c.cam,30);if(c.intake==="carb")c.intake="single_tb";
    return `Diesel: compression 17.5:1, λ 1.8, redline ${c.redline.toLocaleString()} to start`;}
  c.cr=boosted?9.0:10.5;c.lambda=boosted?0.82:0.9;c.timing=0;if(c.redline<=4200)c.redline=6000;   // a diesel governor speed is no petrol redline
  return `Petrol: compression ${c.cr.toFixed(1)}:1, λ ${c.lambda.toFixed(2)}, redline ${c.redline.toLocaleString()} to start`;}
/* piston <-> rotary: bore/stroke become rotor width / generating radius, so a switch drops in a 13B (or a
   two-litre four on the way back) instead of leaving nonsense geometry behind */
function rotaryFamilyDefaults(c,wasR){const r=isRot(c);if(r===wasR)return null;const D=SIM.DEFAULT_CFG;
  if(r){c.bore=80;c.stroke=105;c.ecc=15;c.cr=c.asp!=="na"?9.0:9.4;c.redline=Math.max(7000,Math.min(c.redline,8000));c.timing=0;if(isCI(c.fuel)){c.fuel="r91";c.lambda=0.9;}
    return `Rotary: 13B-size rotors (80 mm wide, R 105, e 15), ${c.cr.toFixed(1)}:1, redline ${c.redline.toLocaleString()}`;}
  c.bore=D.bore;c.stroke=D.stroke;c.rodRatio=D.rodRatio;c.cr=c.asp!=="na"?9.0:D.cr;if(c.redline>8000)c.redline=7000;
  return `Piston: ${D.bore}×${D.stroke} mm, ${c.cr.toFixed(1)}:1 to start`;}
/* four-stroke <-> two-stroke: ports instead of valves, a trapped compression ratio, a pipe tuned near the port timing and
   premix on a crankcase engine; a diesel gets a blower and uniflow scavenging. Back to four: a layout a four-stroke has. */
function twoStrokeFamilyDefaults(c,wasT){const D=SIM.DEFAULT_CFG;
  if(c.cycle==="two"&&SIM.LAYOUTS[c.layout]&&SIM.LAYOUTS[c.layout].rotary){c.layout="I2";c.bore=D.bore;c.stroke=D.stroke;c.rodRatio=D.rodRatio;}
  const t=isTs(c);if(t===wasT)return null;
  if(t){const dsl=isCI(c.fuel);c.timing=0;c.ePort=dsl?140:180;c.tPort=dsl?100:124;c.pv="none";c.ccr=1.40;c.lube="premix";c.premix=40;
    if(dsl){c.scav="uniflow";c.induct="blower";c.xpipe="muffled";c.redline=Math.min(c.redline,2800);c.pipeRpm=c.redline;}
    else{c.scav="loop";c.induct="reed";c.tsFuel=c.intake==="carb"?"carb":"efi";c.xpipe="chamber";c.cr=c.asp!=="na"?6.5:8.0;c.lambda=0.86;c.redline=Math.max(c.redline,6500);
      try{const g=SIM.simulate(c,stdEnv({testType:"pull"}));c.pipeRpm=Math.round(Math.min(c.redline*0.92,Math.max(3000,g.twoStroke.rpmP))/100)*100;}catch(e){c.pipeRpm=Math.round(c.redline*0.85/100)*100;}}
    return dsl?`Two-stroke diesel: uniflow, a Roots blower and ${c.redline.toLocaleString()} rpm to start`:`Two-stroke: loop-scavenged, reed valve, ${c.cr.toFixed(1)}:1 trapped, pipe tuned to ${c.pipeRpm.toLocaleString()} rpm, 40:1 premix`;}
  if(SIM.LAYOUTS[c.layout]&&SIM.LAYOUTS[c.layout].two){c.layout=c.layout==="V4"||c.layout==="D18"?"V8":"I4";}
  if(c.bore<68)c.bore=D.bore;if(c.stroke<58)c.stroke=D.stroke;
  if(!isCI(c.fuel)){c.cr=c.asp!=="na"?9.0:D.cr;c.lambda=0.9;}
  return `Four-stroke: valves and a cam again, ${c.layout}, ${c.cr.toFixed(1)}:1`;}
function swatchRow(f){const opts=OPT[f.optTable||f.key];return `<div class="lbl"><span>${fLabel(f)}</span></div><div class="swatches">`+Object.keys(opts).map(k=>`<button data-k="${f.key}" data-v="${k}" class="${S.cfg[f.key]===k?"on":""}" style="background:${opts[k].hex}" aria-label="${opts[k].name}"></button>`).join("")+"</div>";}
const openSec={"Bore & stroke":true};
function secSummary(sec){return sec.fields.filter(f=>!f.showIf||f.showIf(S.cfg)).map(f=>{const v=S.cfg[f.key];if(f.type==="slider")return (f.fmt?f.fmt(v):v)+(f.unit?" "+f.unit:"");const o=OPT[f.optTable||f.key][v];return o?o.name:v;}).join(" · ");}
function renderBuild(){
  altFuelFill(S.cfg);
  let h="";
  for(const sec of FORM){if(!sec.fields.some(f=>!f.showIf||f.showIf(S.cfg)))continue;   // a rotary has no pistons, rods or head gasket to show
    const open=!!openSec[sec.title];h+=`<div class="sec acc ${open?"open":""}"><button class="acch" data-sec="${sec.title}"><span class="t">${(sec.titleIf&&sec.titleIf(S.cfg))||sec.title}</span><span class="sum">${secSummary(sec)}</span><span class="chev"></span></button><div class="accb">`;
    for(const f of sec.fields){if(f.showIf&&!f.showIf(S.cfg))continue;h+=f.type==="seg"?segRow(f):f.type==="slider"?sliderRow(f):swatchRow(f);}h+=`</div></div>`;}
  $("buildForm").innerHTML=h;renderBlueprints();
  document.querySelectorAll("#buildForm .acc.open").forEach(fillDeltas);   // perf: closed sections fill when opened (toggleSec)
  fuelHdr();ddMarkBuild();
}
// Base engines and the FORM sections share one accordion: opening one closes the rest
function toggleSec(a){const key=a.dataset.sec,wasOpen=!!openSec[key];for(const k in openSec)openSec[k]=false;openSec[key]=!wasOpen;
    document.querySelectorAll("#tab-build .acc").forEach(el=>{const k=el.querySelector("[data-sec]").dataset.sec;el.classList.toggle("open",!!openSec[k]);});
    if(openSec[key]){const sec=FORM.find(x=>x.title===key);if(sec){const ff=sec.fields.find(f=>FOCUS_OF[f.key]);if(ff)autoFocus(ff.key);}fillDeltas(a.parentElement);const pn=$("panel"),ar=a.getBoundingClientRect(),top=(document.querySelector("#tab-build .strip")||pn).getBoundingClientRect().bottom+8;if(ar.top<top)pn.scrollTop+=ar.top-top;}
    if(tourStep>=0)requestAnimationFrame(tourPlace);}
$("presetAcc").querySelector(".acch").addEventListener("click",e=>toggleSec(e.currentTarget));
$("buildForm").addEventListener("click",e=>{
  const a=e.target.closest("[data-sec]");if(a){toggleSec(a);return;}
  const q=e.target.closest("[data-info]");if(q){openSheet(q.dataset.lbl,q.dataset.info,q.dataset.ckey);return;}
  const b=e.target.closest("button[data-k]");if(!b)return;autoFocus(b.dataset.k);
  if(b.classList.contains("lock")){toast(`Needs the ${b.dataset.req} upgrade`);return;}
  if(testing){toast("Let the run finish first");return;}
  const wasD=isCI(S.cfg.fuel),wasF=S.cfg.fuel,wasR=isRot(S.cfg),wasT=isTs(S.cfg);S.cfg[b.dataset.k]=b.dataset.v;S.profileId=null;
  const fam=b.dataset.k==="fuel"?fuelFamilyDefaults(S.cfg,wasD,wasF):b.dataset.k==="layout"?rotaryFamilyDefaults(S.cfg,wasR):b.dataset.k==="cycle"?twoStrokeFamilyDefaults(S.cfg,wasT):null;if(fam)delete S.cfg.map;
  if(fam&&b.dataset.k==="fuel"&&isTs(S.cfg)&&isCI(S.cfg.fuel)){S.cfg.induct="blower";S.cfg.scav="uniflow";S.cfg.xpipe="muffled";}   // a two-stroke diesel needs a blower to breathe
  const moved=clampCfgLimits();
  if(fam)toast(fam);else if(moved)toast(`${fLabel(moved)} pulled back to ${S.cfg[moved.key]}${moved.unit?" "+moved.unit:""} — that part will not carry more`);
  afterCfgChange(true);});
let dragBase=null,baseTimer=null,baseField=null;
const HOLD_MS=2000;                       // how long the reading stays up after you stop
function chips(){return document.querySelectorAll("#buildForm .lbl b .d");}
function dropChips(fade){chips().forEach(d=>{if(fade){d.classList.add("out");setTimeout(()=>d.remove(),420);}else d.remove();});}
function holdBase(k){                     // starting to adjust: take a reference, or keep the one we have
  if(baseTimer){clearTimeout(baseTimer);baseTimer=null;}
  if(quick&&!dragBase)dragBase={hp:quick.peakHp,rel:quick.rel};
  if(baseField&&baseField!==k)dropChips(false);   // one reading at a time, on the control you are touching
  baseField=k;}
function resetBase(){                     // a whole different engine: nothing to compare against
  if(baseTimer){clearTimeout(baseTimer);baseTimer=null;}dragBase=null;baseField=null;dropChips(false);}
function releaseBase(){                   // finished adjusting: hold the reading, then re-baseline
  if(baseTimer)clearTimeout(baseTimer);
  baseTimer=setTimeout(()=>{baseTimer=null;dragBase=null;baseField=null;dropChips(true);},HOLD_MS);}
$("buildForm").addEventListener("pointerdown",e=>{if(e.target.type==="range")holdBase(e.target.dataset.k);},{passive:true});
const NOTCH={bore:1,stroke:1,rodRatio:0.05,cr:0.5,cam:5,lift:5,redline:250,timing:1,lambda:0.02,boost:0.1};
const lastNotch={};
function applySlider(k,v,r){mapShiftTo(k,v);S.cfg[k]=v;if(r&&parseFloat(r.value)!==v)r.value=v;
  const nt=NOTCH[k]||1;const ni=Math.floor(v/nt+1e-6);if(lastNotch[k]!==undefined&&ni!==lastNotch[k])buzz(4);lastNotch[k]=ni;
  const f=FORM.flatMap(s=>s.fields).find(x=>x.key===k);const lab=$("v-"+k);if(lab)lab.textContent=(f.fmt?f.fmt(v):v)+(f.unit?" "+f.unit:"");
  recompute();
  if(lab&&dragBase){const dh=Math.round(quick.peakHp-dragBase.hp),dr=Math.round(quick.rel-dragBase.rel);const bits=[];if(dh)bits.push(`<i class="${dh>0?"up":"dn"}">${dh>0?"+":"−"}${Math.abs(dh)} hp</i>`);if(dr)bits.push(`<i class="${dr>0?"up":"dn"}">${dr>0?"+":"−"}${Math.abs(dr)} rel</i>`);
    if(bits.length)lab.insertAdjacentHTML("beforeend",`<span class="d">${bits.join("")}</span>`);}
  const sec=r&&r.closest(".acc");if(sec){const fs=FORM.find(x=>x.title===sec.querySelector("[data-sec]").dataset.sec);sec.querySelector(".sum").textContent=secSummary(fs);}}
const FOCUS_OF={bore:"engine",stroke:"engine",cr:"engine",rodRatio:"engine",blockMat:"engine",deck:"engine",piston:"engine",pistonClearance:"engine",rings:"engine",rod:"engine",rodBolts:"engine",crank:"engine",bearings:"engine",oilSystem:"engine",oilGrade:"engine",oilSquirters:"engine",
  head:"top",headMat:"top",valveMat:"top",springs:"top",cam:"top",lift:"top",gasket:"top",studs:"top",cover:"top",redline:"top",
  intake:"intake",nitrous:"intake",fuel:"intake",lambda:"intake",timing:"intake",asp:"turbo",turboSize:"turbo",turbineMat:"turbo",ic:"turbo",boost:"turbo",exhaust:"exhaust",damper:"front",cooling:"front",layout:"engine",
  ecc:"engine",rotHousing:"engine",sidePlate:"engine",apexSeal:"engine",eshaft:"engine",rotPort:"intake",oilMeter:"front",
  cycle:"engine",scav:"engine",ePort:"engine",tPort:"engine",pv:"exhaust",ccr:"engine",induct:"intake",tsFuel:"intake",xpipe:"exhaust",pipeRpm:"exhaust",lube:"intake",premix:"intake"};
Object.assign(FOCUS_OF,{launchCtl:"exhaust",launchRetard:"exhaust",twoStepRpm:"exhaust"});Object.assign(NOTCH,{twoStepRpm:500,launchRetard:5});
Object.assign(FOCUS_OF,{injectors:"intake",fuelPump:"intake"});
Object.assign(FOCUS_OF,{pipe:"exhaust",muffler:"exhaust",cat:"exhaust",cutout:"exhaust"});
Object.assign(FOCUS_OF,{turbine:"turbo",als:"exhaust"});
let lastFocus=null;
function autoFocus(key){if(testing||S.followCam===false)return;let part=FOCUS_OF[key];if(!part)return;if(part==="turbo"&&S.cfg.asp==="na")part="intake";if(part===lastFocus)return;lastFocus=part;ENGINE_VIS.focus(part);}
function commitSlider(){S.profileId=null;if(mapFitAxis())recompute();ENGINE_VIS.buildEngine(S.cfg,LAYOUTS[S.cfg.layout]);save();if(curTab==="analysis")renderAnalysis();releaseBase();document.querySelectorAll("#buildForm .acc.open").forEach(fillDeltas);}   // perf: closed sections fill when opened (toggleSec)
function sliderField(k){return FORM.flatMap(s=>s.fields).find(x=>x.key===k);}
function snapVal(f,v){const st=f.step||1,lo=fMin(f),hi=fMax(f);v=Math.round((v-lo)/st)*st+lo;v=Math.min(hi,Math.max(lo,v));return +v.toFixed(4);}
$("buildForm").addEventListener("input",e=>{const r=e.target;if(!r.dataset||!r.dataset.k||r.type!=="range")return;autoFocus(r.dataset.k);applySlider(r.dataset.k,parseFloat(r.value),r);});
$("buildForm").addEventListener("change",e=>{if(e.target.type==="range")commitSlider();});
// ± nudge buttons: one field-sized step per tap, hold to repeat
(()=>{let hold=null;const stop=()=>{if(hold){clearTimeout(hold.t);clearInterval(hold.i);hold=null;}};
  let n=0;
  const step=(k,dir,light)=>{const f=sliderField(k);if(!f)return;const r=$("r-"+k);const nv=snapVal(f,S.cfg[k]+dir*(f.nudge||f.step||1));if(nv===S.cfg[k])return;holdBase(k);
    if(light&&(++n%4)){mapShiftTo(k,nv);S.cfg[k]=nv;if(r)r.value=nv;const lab=$("v-"+k);if(lab)lab.textContent=(f.fmt?f.fmt(nv):nv)+(f.unit?" "+f.unit:"");}else applySlider(k,nv,r);buzz(3);};
  $("buildForm").addEventListener("pointerdown",e=>{const b=e.target.closest(".nud");if(!b)return;e.preventDefault();const k=b.dataset.nk,dir=+b.dataset.nud;stop();step(k,dir);n=0;hold={k,t:setTimeout(()=>{hold.i=setInterval(()=>step(k,dir,true),110);},420)};});
  const end=e=>{if(!hold)return;const k=hold.k;stop();applySlider(k,S.cfg[k],$("r-"+k));commitSlider();};
  ["pointerup","pointercancel","pointerleave"].forEach(ev=>$("buildForm").addEventListener(ev,e=>{if(e.target.closest&&e.target.closest(".nud"))end(e);}));
  window.addEventListener("pointerup",end);window.addEventListener("blur",()=>{if(hold){stop();commitSlider();}});})();
// Tap the value to type it
let lastNudge=0;
$("buildForm").addEventListener("pointerdown",e=>{if(e.target.closest(".nud"))lastNudge=performance.now();},true);
$("buildForm").addEventListener("click",e=>{const b=e.target.closest("b[data-num]");if(!b||b.querySelector("input")||performance.now()-lastNudge<600)return;const k=b.dataset.num,f=sliderField(k);if(!f)return;
  const cur=S.cfg[k];const inp=document.createElement("input");inp.type="number";inp.className="num";inp.inputMode="decimal";const pm=S.psi&&f.unit==="bar"?BAR_PSI:1;inp.min=+(fMin(f)*pm).toFixed(2);inp.max=+(fMax(f)*pm).toFixed(2);inp.step=pm===1?f.step:"any";inp.value=pm===1?cur:+(cur*pm).toFixed(1);inp.setAttribute("enterkeyhint","done");
  const restore=()=>{const v=S.cfg[k];b.innerHTML=(f.fmt?f.fmt(v):v)+(f.unit?" "+f.unit:"");};
  const init=inp.value;let done=false;const finish=(ok)=>{if(done)return;done=true;if(ok&&inp.value!==init){const v=parseFloat(inp.value.replace(",","."))/pm;if(isFinite(v)){const nv=snapVal(f,v);if(nv!==S.cfg[k]){holdBase(k);applySlider(k,nv,$("r-"+k));commitSlider();}}}restore();};
  inp.addEventListener("keydown",ev=>{if(ev.key==="Enter"){ev.preventDefault();finish(true);inp.blur();}else if(ev.key==="Escape"){finish(false);inp.blur();}});
  inp.addEventListener("blur",()=>finish(true));
  b.textContent="";b.appendChild(inp);inp.focus();inp.select();});
function afterCfgChange(full){recompute();if(full){renderBuild();ENGINE_VIS.buildEngine(S.cfg,LAYOUTS[S.cfg.layout]);save();}}

/* ---- readable spec chips: one entry per option table ----
   each spec is [label, value-from-option]; only specs that return
   something are shown, so options that lack a field just skip it.   */
const x1=v=>v.toFixed(1), xN=v=>Math.round(v);
const fac=v=>v===1?"standard":(v>1?"+":"")+Math.round((v-1)*100)+"%";
const SPECS={
  layout:{price:o=>o.cost,specs:[["Bare weight",o=>o.massKg+" kg"]]},
  blockMat:{price:o=>o.costPerL+"/L",specs:[
    ["Stiffness",o=>fac(o.stiff)],["Weight",o=>fac(o.massFac)],
    ["Fatigue strength",o=>o.fatigue+" MPa"],["Heat flow",o=>o.k+" W/mK"],
    ["Growth",o=>(+(o.alpha*1e6).toFixed(1))+" µm/m·K"]]},
  deck:{specs:[["Bore stiffness",o=>fac(o.stiff)],["Coolant flow",o=>fac(o.cool)]]},
  headMat:{specs:[
    ["Heat flow",o=>o.k+" W/mK"],["Knock margin",o=>isCI(S.cfg.fuel)?null:(o.octane?"+"+(o.octane%1?x1(o.octane):o.octane)+" octane":"baseline")],
    ["Weight",o=>fac(o.massFac)],["Growth",o=>(+(o.alpha*1e6).toFixed(1))+" µm/m·K"]]},
  head:{specs:[
    ["Valves",o=>(o.nIV*2)+" per cylinder"],["Airflow",o=>fac(o.veBase)],
    ["Valvetrain limit",o=>xN(o.floatBase)+" rpm"],["Burn speed",o=>fac(o.burn)],
    ["Cam timing",o=>o.vvl?"two-stage lift":o.vvt?"variable phasing":"fixed"]]},
  valveMat:{specs:[
    ["Temperature limit",o=>o.maxTempC+" °C"],["Valve weight",o=>fac(o.massFac)],
    ["Extra cooling",o=>o.coolC?"−"+o.coolC+" °C":null]]},
  springs:{specs:[
    ["Spring rate",o=>fac(o.rate)],["Moving weight",o=>fac(o.massFac)]]},
  piston:{specs:[
    ["Strength at 250 °C",o=>o.hot250+" MPa"],["Crown limit",o=>o.maxCrownC+" °C"],
    ["Growth",o=>(+(o.alpha*1e6).toFixed(1))+" µm/m·K"],
    ["Detonation",o=>o.brittle>=0.9?"cracks easily":o.brittle>=0.3?"fair":"tough"]]},
  pistonClearance:{line:o=>Math.round(o.fac*86*1000)+" µm cold",specs:[["Cold clearance",o=>Math.round(o.fac*86*1000)+" µm on an 86 mm bore"]]},
  rings:{line:o=>Math.round(o.gapSet*86*1000)+" µm end gap",specs:[
    ["End gap",o=>Math.round(o.gapSet*86*1000)+" µm on an 86 mm bore"],["Friction",o=>fac(o.fric)],
    ["Sealing",o=>fac(o.seal)],["Temperature limit",o=>o.maxTempC+" °C"]]},
  rod:{specs:[
    ["Fatigue strength",o=>o.fatigue+" MPa"],["Stiffness",o=>o.E+" GPa"],["Weight",o=>fac(o.massFac)]]},
  rodBolts:{specs:[["Tensile strength",o=>o.uts+" MPa"]]},
  crank:{specs:[
    ["Fatigue strength",o=>o.fatigue+" MPa"],["Torsional stiffness",o=>fac(o.stiffFac)],["Weight",o=>fac(o.massFac)]]},
  damper:{specs:[["Absorbs",o=>Math.round(o.damping*100)+"% of crank twist"],["Weight",o=>fac(o.massFac)]]},
  bearings:{specs:[
    ["Load limit",o=>o.limitMPa+" MPa"],
    ["Methanol",o=>o.methanolOK?"safe":"corrodes the overlay"]]},
  gasket:{specs:[
    ["Pressure limit",o=>o.maxPmaxBar+" bar"],["Tolerates movement",o=>o.shearUm+" µm"]]},
  studs:{specs:[
    ["Clamp",o=>o.clampKn+" kN each"],["Tensile strength",o=>o.uts+" MPa"]]},
  intake:{specs:[
    ["Airflow",o=>o.veBonus?(o.veBonus>0?"+":"")+Math.round(o.veBonus*100)+"%":"standard"],["Tuned for",o=>xN(o.rTune)+" rpm"],
    ["Restriction",o=>fac(o.loss)],["Fuel delivery",o=>o.wet?"wet manifold":null]]},
  asp:{price:o=>o.cost,line:o=>o.compound?"two stages":({na:"atmospheric",turbo:"exhaust driven",roots:"crank driven",screw:"crank driven",centrifugal:"belt driven"})[o.kind],specs:[
    ["Drive",o=>({na:"none — atmospheric",turbo:"exhaust gas",roots:"geared to the crank",screw:"geared to the crank",centrifugal:"belt off the crank"})[o.kind]||null],
    ["Staging",o=>o.compound?"two stages, cooled between":null],
    ["Units",o=>o.units>1&&!o.compound?o.units+" chargers":null]]},
  turboSize:{specs:[
    ["Flow ceiling",o=>o.maxFlow+" lb/min"],["Spool",o=>o.spoolFac<0.9?"almost instant":o.spoolFac<1.2?"early":o.spoolFac<1.7?"late":"very late"],
    ["Backpressure",o=>x1(o.backP)+"×"]]},
  turbineMat:{specs:[["Exhaust limit",o=>o.maxEgtC+" °C"]]},
  turbine:{price:o=>o.costPetrol?o.cost.toLocaleString()+" diesel · $"+o.costPetrol.toLocaleString()+" petrol":o.cost,specs:[["Spool",o=>o.vaneEgtC?"30% earlier (diesel), 22% (petrol)":"set by the housing"],["Backpressure",o=>o.vaneEgtC?"high low down, low up top":"fixed by the A/R"],
    ["Vane limit",o=>o.vaneEgtC?o.vaneEgtC.cast_iron+" °C cast · "+o.vaneEgtC.inconel+" °C Inconel":null],["Watch for",o=>o.vaneEgtC?"soot (diesel), heat (petrol)":null]]},
  als:{price:o=>o.cost,specs:[["Boost kept",o=>o.hold?"~"+Math.round(o.hold*100)+"% through a lift":"none"],["On the line",o=>o.line?"+"+Math.round(o.line*100)+"% of target":"—"],
    ["Turbine heat",o=>o.egtAdd?"+"+o.egtAdd+" °C spikes":"—"],["Fuel",o=>o.fuel?"+"+Math.round(o.fuel*100)+"%":"—"],["Dyno",o=>"no effect"]]},
  ic:{specs:[
    ["Removes",o=>o.eff?Math.round(o.eff*100)+"% of charge heat":"nothing"],
    ["Pressure drop",o=>o.dp?Math.round(o.dp*100)+"%":"none"],
    ["Heat soak",o=>o.soak>=1?"soaks quickly":o.soak>0?"soaks slowly":"none"],
    ["Weight",o=>o.massKg?"+"+o.massKg+" kg":null]]},
  fuel:{line:o=>{if(!o.flex||S.cfg.fuel!=="flex")return null;const b=SIM.fuelOf(S.cfg);return "E"+b.ePct+" · "+Math.round(b.ron)+" RON / "+Math.round(b.mon)+" MON";},price:o=>o.flex?OPT.fuel.e85.costL+"–"+OPT.fuel.r91.costL+"/L":o.costL+"/"+(o.unit||"L"),specs:[
    ["Cetane",o=>o.ci?"CN "+o.cetane:null],
    ["Blend",o=>o.flex?"E0–E85, read by the sensor"+(S.cfg.fuel==="flex"?" · now E"+Math.round(S.cfg.ethanolPct==null?85:S.cfg.ethanolPct):""):null],
    ["Octane",o=>o.ci?null:o.flex?OPT.fuel.r91.ron+"–"+o.ron+" RON by blend":o.ron+" RON / "+o.mon+" MON"],["Energy",o=>(o.flex?(OPT.fuel.r91.lhv/1e6).toFixed(1)+"–":"")+(o.lhv/1e6).toFixed(1)+" MJ/kg"],
    ["Air per fuel",o=>o.flex?x1(OPT.fuel.r91.afr)+"–"+x1(o.afr)+":1":x1(o.afr)+":1"],["Charge cooling",o=>o.ci?null:o.gas?"none — arrives as vapour":Math.round(o.hov/1000)+" kJ/kg"],
    ["Oxygen",o=>o.oxy?o.oxy+"% by weight":null],["Lead",o=>o.lead?"leaded — kills cats and O₂ sensors":null],
    ["Air displaced",o=>o.displace?"~"+x1(o.displace*100)+"% of the cylinder":null],
    ["Tank",o=>o.tankKg?o.tankKg+" kg for "+o.tankL+" "+(o.unit||"L")+" ≈ "+Math.round(o.tankL*o.dens*o.lhv/(43.4e6*0.745))+" L of petrol":null],
    ["Cold start",o=>o.vapor?"weak below −30 °C":null],
    ["Cloud point",o=>o.ci&&o.cloudC!=null?degC(o.cloudC):null],
    ["Corrosion",o=>o.ci?(o.corrosive>0?"eats old rubber seals":null):o.corrosive>=1?"attacks alu and lead":o.corrosive>0?"mildly corrosive":null]]},
  gasSys:{line:o=>fuelLine("gasSys",o),specs:[
    ["Meters",o=>o.kgh+" kg/h of gas"],["Propane",o=>"~"+(Math.round(o.kgh*0.76/0.25/10)*10).toLocaleString("en-CA")+" hp with margin"],
    ["Airflow",o=>o.veK<1?"−"+Math.round((1-o.veK)*100)+"% (venturi)":"no loss"],["Under 1 bar boost",o=>"~"+Math.round(o.kgh*(1-o.dropBar))+" kg/h"],
    ["Cold start",o=>"needs "+x1(o.needBar)+" bar in the tank"],["Weight",o=>"+"+o.massKg+" kg on the engine"]]},
  dInj:{line:o=>fuelLine("dInj",o),specs:[
    ["Injection pressure",o=>o.bar.toLocaleString("en-CA")+" bar"],
    ["Fuel per stroke",o=>quick&&quick.n?"~"+Math.round(o.qL*quick.Vd/1000/quick.n*((OPT.dNoz[S.cfg.dNoz]||{mult:1}).mult))+" mm³ a cylinder":o.qL+" mm³ per litre"],
    ["Pump keeps up to",o=>o.rpmMax.toLocaleString("en-CA")+" rpm"],
    ["Smoke control",o=>o.smokeLim>=0.9?"ECU holds λ":o.smokeLim>=0.5?"boost aneroid":"barely — smokes on spool"],
    ["Pilot injection",o=>o.pilot>=0.8?"yes — quiet":o.pilot>0?"partial":"none — it clatters"],
    ["Weight",o=>o.massKg?o.massKg+" kg":null]]},
  dNoz:{price:o=>o.cost?o.cost+" each":0,specs:[
    ["Flow vs stock",o=>o.mult===1?"standard":"×"+o.mult.toFixed(1)],
    ["Fuel per stroke",o=>{const di=OPT.dInj[S.cfg.dInj];return di&&quick&&quick.n?"~"+Math.round(di.qL*quick.Vd/1000/quick.n*o.mult)+" mm³ on the "+(INJ_SHORT[S.cfg.dInj]||"pump"):null;}]]},
  injectors:{price:o=>o.cost?o.cost+" each":0,line:o=>fuelLine("injectors",o),specs:[
    ["Flow",o=>(o.perCyl>1?o.perCyl+" × ":"")+o.cc+" cc/min at 3 bar"],
    ["Petrol",o=>"~"+fuelHp(o.cc*(o.perCyl||1)*0.72*0.06,1).toLocaleString("en-CA")+" hp a cylinder"],["E85",o=>"~"+fuelHp(o.cc*(o.perCyl||1)*0.72*0.06,1.43).toLocaleString("en-CA")+" hp a cylinder"],
    ["Methanol",o=>"~"+fuelHp(o.cc*(o.perCyl||1)*0.72*0.06,2.14).toLocaleString("en-CA")+" hp a cylinder"]]},
  fuelPump:{line:o=>fuelLine("fuelPump",o),specs:[
    ["Flow",o=>o.lph+" L/h "+(o.rpmRef?"at "+o.rpmRef+" rpm":"at 3 bar")],
    ["Under 1.5 bar boost",o=>o.rpmRef?"no loss":"~"+Math.round(o.lph*(1-o.dropBar*1.5))+" L/h"],
    ["Diesel",o=>isCI(S.cfg.fuel)?"~"+fuelHp(o.lph*(1-o.dropBar)*0.76,K_DSL).toLocaleString("en-CA")+" hp of lift":null],
    ["Petrol",o=>o.rpmRef||isCI(S.cfg.fuel)?null:"~"+fuelHp(o.lph*(1-o.dropBar)*0.76,1).toLocaleString("en-CA")+" hp at 1 bar"],["Methanol",o=>isCI(S.cfg.fuel)?null:"~"+fuelHp(o.lph*(1-o.dropBar)*0.76,2.14).toLocaleString("en-CA")+" hp"+(o.rpmRef?" at "+o.rpmRef+" rpm":" at 1 bar")],
    ["Weight",o=>o.massKg?"+"+o.massKg+" kg on the engine":null]]},
  oilGrade:{specs:[
    ["Viscosity",o=>x1(o.kv100)+" cSt at 100 °C"],["Film strength",o=>x1(o.hths)+" HTHS"],
    ["Drag",o=>fac(o.fricFac)],["Cold flow",o=>o.vi>=160?"excellent":o.vi>=145?"good":o.vi>=130?"fair":"poor"]]},
  oilSystem:{specs:[
    ["Holds prime to",o=>x1(o.gLimit)+" g"],["Windage loss",o=>fac(o.windage)],["Weight",o=>o.massKg?"+"+o.massKg+" kg":null]]},
  oilSquirters:{specs:[["Crown cooling",o=>o.crownC?"−"+o.crownC+" °C":"none"]]},
  cooling:{specs:[["Heat rejection",o=>fac(o.cap)],["Weight",o=>o.massKg?"+"+o.massKg+" kg":null]]},
  exhaust:{specs:[
    ["Airflow",o=>o.veBonus?(o.veBonus>0?"+":"")+Math.round(o.veBonus*100)+"%":"standard"],["Backpressure",o=>fac(o.backP)],
    ["Weight",o=>o.massKg+" kg"]]},
  pipe:{line:o=>exhLine("pipe",o),specs:[["Flows",o=>exhSpec("pipe",o,"flow")],["Backpressure",o=>exhSpec("pipe",o,"dp")],["Drive-by",o=>exhSpec("pipe",o,"db")],["Weight",o=>o.massKg?"+"+o.massKg+" kg":"stock"]]},
  muffler:{line:o=>exhLine("muffler",o),specs:[["Restriction",o=>o.K?Math.round(o.K/3*100)+"% of OEM":"none"],["Backpressure",o=>exhSpec("muffler",o,"dp")],["Drive-by",o=>exhSpec("muffler",o,"db")],["Weight",o=>o.massKg?"+"+o.massKg+" kg each":"stock"]]},
  cat:{line:o=>exhLine("cat",o),specs:[["Restriction",o=>o.K?Math.round(o.K/3*100)+"% of an OEM muffler":"none"],["Backpressure",o=>exhSpec("cat",o,"dp")],["Drive-by",o=>exhSpec("cat",o,"db")],["Smoke",o=>o.smokeK?"trapped: ≈ 0%":o.fam==="ci"||isCI(S.cfg.fuel)?"what the tune makes":null],["Weight",o=>o.massKg?"+"+o.massKg+" kg each":null]]},
  cutout:{line:o=>exhLine("cutout",o),specs:[["Drive-by",o=>exhSpec("cutout",o,"db")],["Backpressure",o=>exhSpec("cutout",o,"dp")],["Road buyers",o=>o.cost?"judge it shut":null],["Weight",o=>o.massKg?"+"+o.massKg+" kg":null]]},
  nitrous:{price:o=>o.cost,line:o=>o.shotHp?o.shotHp+" hp shot":"none",specs:[
    ["Shot",o=>o.shotHp?o.shotHp+" hp at the jet":"none"],
    ["Delivery",o=>o.shotHp?(o.prog?"ramped in on a controller":"all at once"):null],
    ["Arms at",o=>o.shotHp?(o.prog?"42% of redline":"55% of redline")+(o.stageHp?` · stage 2 (${o.stageHp[1]}) at 70%`:""):null],
    ["Kit",o=>({dry:"dry · nozzle only",wet:o.stages===2?"wet · two plates":"wet · plate",direct:"direct port · nozzle per runner",diesel:"diesel · oxygen only"})[o.kind]||null],
    ["Fuel from",o=>o.kind==="dry"?"your injectors (rail raised)":o.kind==="diesel"?"the injection pump":o.kind?"its own jets, off your pump":null],
    ["Watch for",o=>o.kind==="dry"?"lean spike":o.plate?"intake backfire":o.kind==="diesel"?"peak pressure":o.kind?"rod and gasket load":null]]},
  rotPort:{specs:[["Breathing",o=>fac(o.ve)],["Strongest near",o=>xN(o.rpmC)+" rpm"],["Port area",o=>fac(o.flow)],["Overlap",o=>o.overlap<=0?"none":o.overlap<0.1?"slight":o.overlap<0.3?"some":o.overlap<0.6?"big — it braps":"huge"],["Idles at",o=>o.idle+" rpm"]]},
  apexSeal:{price:o=>o.cost+"/rotor",specs:[["Thickness",o=>o.thick+" mm"],["Fatigue in bending",o=>o.fatigue+" MPa"],["Seal mass",o=>fac(o.dens*o.thick/21600)],["Knock",o=>o.brittle>=1?"shatters":o.brittle>=0.5?"cracks":"bends, survives"],["Friction",o=>fac(o.fric)],["Wear",o=>fac(o.wear)]]},
  rotHousing:{price:o=>o.cost+"/housing",specs:[["Chatter limit",o=>fac(o.chatter)],["Hot lobe",o=>o.hotC?o.hotC+" °C":"baseline"],["Exhaust heat",o=>o.egtC?"+"+o.egtC+" °C":null]]},
  sidePlate:{specs:[["Side-seal wear",o=>fac(o.sideSeal)],["Stiffness",o=>fac(o.stiff)],["Weight",o=>fac(o.massFac)]]},
  eshaft:{specs:[["Fatigue strength",o=>o.fatigue+" MPa"],["Main bearings",o=>o.supports+(o.supports>2?" (centre main)":" (ends only)")],["Journals",o=>fac(o.dFac)]]},
  oilMeter:{specs:[["Oil to the seals",o=>fac(o.cap)],["Carbon",o=>fac(o.carbon)],["Oil burnt",o=>o.oilL+" L / 1,000 km"]]},
  cycle:{specs:[["Power strokes",o=>o._id==="cycle:two"?"every turn":"every second turn"],["Gas exchange",o=>o._id==="cycle:two"?"ports in the cylinder wall":"valves and a cam"]]},
  scav:{specs:[["Trapping",o=>Math.round(o.te*100)+"% at DR 1"],["Port flow",o=>fac(o.flow)],["Needs",o=>o.valves?"exhaust valves + a blower":"nothing extra"]]},
  induct:{specs:[["Low-speed fill",o=>fac(o.lowK)],["Top end",o=>fac(o.topK)],["Blow-back",o=>o.back?Math.round(o.back*100)+"% at idle":"none"]]},
  tsFuel:{specs:[["Fuel lost with the short-circuit",o=>Math.round(o.sc*100)+"%"]]},
  xpipe:{specs:[["Resonance",o=>o.amp?"+"+Math.round(o.amp*100)+"% on the pipe":"none"],["Band width",o=>o.amp?"±"+Math.round(o.w*100)+"% of its rpm":null],["Back-pressure",o=>fac(o.backP)],["Noise",o=>(o.db>0?"+":"")+o.db+" dB"]]},
  pv:{specs:[["Band",o=>o.wide?fac(o.wide)+" wider below the pipe":"fixed port"]]},
  lube:{specs:[["Oil fed by",o=>o._id==="lube:inject"?"a pump, by load":"the premix ratio"]]},
  cover:{specs:[]},
  launchCtl:{line:o=>o.sub,specs:[["Holds",o=>o.cost?"a set launch rpm":"whatever your foot does"],["Boost on the line",o=>o._id==="launchCtl:two_step_retard"?"most of it, with heat":o.cost?"a little":"none"],["Dyno",o=>"no effect"]]},
  transBrake:{line:o=>o.sub,specs:[["Launch",o=>o._id==="transBrake:trans_brake"?"torque converter":"clutch"],["Burnout",o=>o._id==="transBrake:none"?"creeps, fronts smoke":"clean, rears only"],["Dyno",o=>"no effect"]]}
};
/* exhaust system spec chips: each option evaluated on this engine at its own peak-power exhaust flow */
function exhVar(tbl,o){const k=o._id.split(":")[1],c=Object.assign({},S.cfg,{[tbl]:k});if(tbl!=="cutout"&&c.cutout==="open")c.cutout="closed";return c;}   // compare pipes, cans and cats with the cutout shut
function exhSpec(tbl,o,what){if(!quick||!quick.exhaustSys)return null;const c=exhVar(tbl,o),m=quick.exhaustSys.flowKgS;
  if(what==="db"){const n=SIM.exhaustNoise(c);return tbl==="cutout"&&o.cost?`${Math.round(n.db)} dB shut · ${Math.round(n.dbOpen)} open`:`${Math.round(tbl==="cutout"?n.dbOpen:n.db)} dB`;}
  const X=SIM.exhaustInfo(c,m);
  if(what==="dp")return X.open?"none · open to the air":`${X.dpBar.toFixed(2)} bar at ${Math.round(quick.peakHp)} hp`;
  if(what==="flow"){if(X.open)return"unlimited";const hp=quick.peakHp*X.flow100/Math.max(1e-6,m);return`≈ ${Math.round(hp/10)*10} hp at 100 m/s`;}
  return null;}
function exhLine(tbl,o){if(!quick||!quick.exhaustSys)return o.sub;const k=o._id.split(":")[1];
  if(S.cfg[tbl]!==k)return o.sub;const X=SIM.exhaustInfo(S.cfg,quick.exhaustSys.flowKgS);
  return X.open?`${Math.round(quick.noiseDbOpen)} dB · open`:`${Math.round(quick.noiseDb)} dB · ${X.dpBar.toFixed(2)} bar`;}
function chipsFor(tbl,o){const d=SPECS[tbl];if(!d)return [];
  return d.specs.map(([l,f])=>{let v=null;try{v=f(o);}catch(e){}return v==null?null:[l,v];}).filter(Boolean);}
function priceOf(tbl,o){if((tbl==="injectors"||tbl==="fuelPump"||tbl==="dNoz")&&!o.cost)return"stock";const d=SPECS[tbl];if(d&&d.price){const v=d.price(o);return typeof v==="number"?fmt$(v):"$"+v;}
  return (o.cost||o.cost===0)?fmt$(o.cost):"";}
function specLine(tbl,o){const d=SPECS[tbl];if(d&&d.line){const v=d.line(o);if(v)return v;}
  const c=chipsFor(tbl,o);return c.length?c[0][0]+" "+c[0][1]:"details";}
/* fuel parts: hp a flow of L/h supports with margin (petrol ~0.55 lb/hp/h, k = alcohol's extra volume), and the live duty / pump load in the field header */
function fuelHp(lph,k){return Math.round(lph*0.745*2.2046/0.55/k/5)*5;}
const K_DSL=0.62;   // diesel: denser (0.835) and a far better BSFC (~0.38 lb/hp/h at full load), so each litre is worth ~1.6× petrol
function fuelLine(tbl,o){const f=quick&&quick.fuel;if(tbl==="gasSys")return f&&quick.alt&&quick.alt.gas&&quick.alt.sys===o._id.split(":")[1]?Math.round(f.load*100)+"% of its flow":o.kgh+" kg/h";if(tbl==="dInj")return f&&S.cfg.dInj===o._id.split(":")[1]?Math.round(f.injUtil*100)+"% of its fuel":o.bar.toLocaleString("en-CA")+" bar";
  if(!f||S.cfg[tbl]!==o._id.split(":")[1])return tbl==="injectors"?o.cc+" cc/min":o.lph+" L/h";
  return tbl==="injectors"?(f.portInj?Math.round(f.duty*100)+"% duty":"not used"):Math.round(f.load*100)+"% of its flow";}
function fuelHdr(){const f=quick&&quick.fuel;for(const k of ["injectors","fuelPump","dInj","gasSys"]){const b=document.querySelector(`#buildForm .q[data-ckey="${k}"]`);if(!b||!OPT[k][S.cfg[k]])continue;
  const u=f?(k==="fuelPump"||k==="gasSys"?f.pumpUtil:f.injUtil):0;b.textContent=specLine(k,OPT[k][S.cfg[k]])+" ›";b.style.color=u>1?"var(--crit)":u>0.8?"var(--warn)":"";}}
function openSheet(title,tbl,cfgKey){const opts=OPT[tbl]||tbl;const cur=cfgKey?S.cfg[cfgKey]:null;
  $("sheetTitle").textContent=title;
  $("sheetBody").innerHTML=Object.keys(opts).map(k=>{const o=opts[k];const lk=locked(o);
    const req=lk?UPGRADES.find(u=>u.id===o.req):null;
    const tag=k===cur?`<span class="tag on">Fitted</span>`
      :lk?`<span class="tag lk">Needs ${req?req.name:"an upgrade"}</span>`
      :`<span class="tag">${priceOf(tbl,o)}</span>`;
    const chips=chipsFor(tbl,o).map(([l,v])=>`<i><em>${l}</em>${v}</i>`).join("");
    return `<div class="opt${k===cur?" cur":""}"><div class="oh"><b>${o.name}</b>${tag}</div>`
      + (chips?`<div class="chips">${chips}</div>`:"")
      + (o.info?`<p>${o.info}</p>`:"") + `</div>`;}).join("");
  $("sheet").classList.add("on");$("scrim").classList.add("on");}
function closeSheet(){$("sheet").classList.remove("on");$("scrim").classList.remove("on");const q=document.activeElement;if(q&&q.id==="glQ")q.blur();}
$("sheetClose").addEventListener("click",closeSheet);$("scrim").addEventListener("click",closeSheet);
function renderBlueprints(){$("bpList").innerHTML=S.blueprints.map((b,i)=>{const cfg=Object.assign({},SIM.DEFAULT_CFG,b.cfg);const r=SIM.simulate(cfg,simEnv({testType:"pull"}));
  return `<div class="bp" style="display:block;padding:6px">${engineCard(cfg,r,{name:b.title||b.name,cls:"mini inline"})}<div class="row" style="gap:6px;margin-top:6px"><button class="btn sm" data-load="${i}" style="flex:1">Load</button><button class="btn sm ghost" data-del="${i}">✕</button></div></div>`;}).join("")||`<p class="hint">Save designs here to come back to them or A/B them.</p>`;}
$("bpList").addEventListener("click",e=>{const l=e.target.closest("[data-load]"),d=e.target.closest("[data-del]");
  if(l){if(testing){toast("Let the run finish first");return;}const bp=S.blueprints[+l.dataset.load];if(career()&&presetLocked(bp.cfg)){toast(`Needs the ${presetLocked(bp.cfg)} upgrade`);return;}S.cfg=Object.assign({},SIM.DEFAULT_CFG,bp.cfg);S.profileId=null;S.name=bp.title||null;afterCfgChange(true);toast("BLUEPRINT LOADED");}
  if(d){S.blueprints.splice(+d.dataset.del,1);renderBlueprints();save();}});
$("saveBp").addEventListener("click",()=>{if(S.blueprints.length>=12){toast("Blueprint drawer is full (12)");return;}const q=quick;S.blueprints.push({title:engineName(),name:`${cfgLbl(S.cfg)} · ${Math.round(q.peakHp)} hp`,sum:`${Math.round(q.peakTq)} Nm · rel ${q.rel} · ${fmt$(q.cost)}`,cfg:Object.assign({},S.cfg)});renderBlueprints();save();toast("BLUEPRINT SAVED");});

