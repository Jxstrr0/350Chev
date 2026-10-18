/* ===================== TEST ===================== */
const chart=$("chart");const curves={power:true,torque:true,boost:false,ve:false,egt:false,base:false};
let envStdShown=null;
function renderEnv(){
  const e=S.env,t=e.testType;let h="";
  const sl=(k,l,min,max,step,unit,val)=>`<div class="env"><div class="lbl"><span>${l}</span><b id="ev-${k}" class="tap" data-enum="${k}" data-unit="${unit}">${val}${unit}</b></div><div class="srow"><button class="nud" data-enud="-1" data-ek="${k}">−</button><input type="range" id="er-${k}" data-e="${k}" min="${min}" max="${max}" step="${step}" value="${val}"><button class="nud" data-enud="1" data-ek="${k}">+</button></div></div>`;
  if(career()&&!trackEvt(t)){const ce=simEnv(),std=isStdCell(ce);envStdShown=std;
    h+=`<p class="hint">${climateCtl()?`<b>Climate control</b> · ${std?"standard cell — a clean pull certifies for contracts.":`<b>off-standard</b> — test only. Contracts certify at 20 °C · 500 m · coolant 90 °C · oil 100 °C. <button class="chip" data-stdcell style="margin-top:6px">Reset to standard</button>`}`:`Cell conditions: ${ce.ambientC} °C · ${ce.altitudeM} m · coolant ${ce.coolantC} °C · oil ${ce.oilC} °C.`} ${t==="endurance"?`Endurance runs ${e.hours} h on a ${e.loadProfile} profile.`:t==="overrev"?"A missed downshift to 115% of redline for half a second.":"A full-throttle sweep to redline, then held there under load."}</p>`;
    if(climateCtl())h+=`<div class="envgrid">${sl("ambientC","Ambient",-25,45,1," °C",ce.ambientC)}${sl("altitudeM","Altitude",0,3500,50," m",ce.altitudeM)}${sl("coolantC","Coolant",70,118,1," °C",ce.coolantC)}${sl("oilC","Oil temp",70,150,1," °C",ce.oilC)}</div>`;}
  else if(!trackEvt(t)){
    h+=`<div class="envgrid">${sl("ambientC","Ambient",-25,45,1," °C",e.ambientC)}${sl("altitudeM","Altitude",0,3500,50," m",e.altitudeM)}${sl("coolantC","Coolant",70,118,1," °C",e.coolantC)}${sl("oilC","Oil temp",70,150,1," °C",e.oilC)}</div>`;
  }
  if(t==="drag"&&rnCur()){h+=rnPanel();$("envBox").innerHTML=h;pitsSync();return;}
  if(t==="drag"){h+=rnFmtHtml()+swapEnvNote()+`<div class="envgrid">${sl("mass","Car weight",800,2200,10," kg",e.mass)}${sl("rearBias","Rear weight",0.4,e.body==="rail"?0.85:0.7,0.01,"",e.rearBias)}${sl("gears","Gears",1,7,1,"",e.gears)}${sl("first","1st gear",1.5,4.5,0.25,":1",e.first)}${sl("top","Top gear",0.5,1.2,0.05,":1",e.top)}${sl("final","Final drive",2.5,5.5,0.25,":1",e.final)}${sl("tyreDia","Tyre height",22,36,0.25,'"',e.tyreDia)}${S.cfg.launchCtl&&S.cfg.launchCtl!=="none"?"":sl("launchRpm","Launch rpm",1500,Math.max(2000,S.cfg.redline),100,"",e.launchRpm)}</div>
    <p class="hint"><b>Launch</b> · ${launchLine(S.cfg)?launchLine(S.cfg)+(S.cfg.launchCtl&&S.cfg.launchCtl!=="none"?" — the two-step sets the launch rpm":"")+". Tune it in Build › Launch control.":"nothing fitted — a foot on the throttle at the launch rpm below. A two-step, line lock or trans-brake go on in Build › Launch control."}</p>
    <div class="lbl"><span>Tyre</span></div><div class="seg">${Object.entries(SIM.TYRES).map(([k,v])=>`<button data-lp="${k}" data-ek="tyre" class="${e.tyre===k?"on":""}">${v.n}<small>μ ${v.mu}</small></button>`).join("")}</div>${drvHtml()}
    <div class="lbl"><span>Body &amp; aero</span></div><div class="seg segbody">${Object.entries(SIM.AERO).map(([k,v])=>`<button data-lp="${k}" data-ek="body" class="${e.body===k?"on":""}">${v.n}<small>${v.d}</small></button>`).join("")}</div><div class="segbodynote">${(SIM.AERO[e.body]||{}).d||""}</div>${paintHtml()}${shellHtml()}
    ${(SIM.AERO[e.body||"street"]||{}).bars?"":`<div class="lbl"><span>Wheelie bars</span></div><div class="seg">${[["no","Not fitted","the nose may come up"],["yes","Bolt-on bars",`+14 kg · rides the bars, no DQ${career()?(wbarOwned()?" · owned":" · "+fmt$(WBAR_COST)):""}`]].map(([k,n,d])=>`<button data-lp="${k}" data-ek="wbar" class="${(e.wbar||"no")===k?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>`}
    <div class="lbl"><span>Parachute</span></div><div class="seg">${[["no","Not fitted","brakes only"],["yes","Fitted","required over 150 mph"]].map(([k,n,d])=>`<button data-lp="${k}" data-ek="chute" class="${e.chute===k?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>
    ${RN_FMT[S.env.dragFmt]?"":`<div class="lbl"><span>Other lane</span></div><div class="seg">${[["solo","Time trial","just you and the clocks"],["heads","Heads-up race","tree, reaction time, a rival"]].map(([k,n,d])=>`<button data-lp="${k}" data-ek="race" class="${e.race===k?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>`}
    <div class="lbl"><span>Shifting</span></div><div class="seg">${[["auto","Auto","shifts near redline"],["manual","Manual","tap SHIFT — miss it and over-rev"]].map(([k,n,d])=>`<button data-lp="${k}" data-ek="shiftMode" class="${e.shiftMode===k?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>
    ${dragDriveHtml()}
    ${rnTuneEnvHtml(sl)}
    <p class="hint">Rear-drive on a prepped strip. Gears are spaced evenly between 1st and top. Wheel force is the engine's torque × gear × final ÷ tyre radius; grip is μ × rear weight, with weight transfer helping the launch. Tyres, body and launch rpm are what a ${career()?"racer":"tuner"} actually changes between rounds. Body sets aero drag and how hard the chassis can plant the tyre — bars and a four-link put the power down; a stock shell cannot.</p>`;}
  if(t==="drag"&&n2oKit())h+=n2oEnvHtml();
  if(t==="pull_sled")h+=pullEnvHtml(sl);
  if(t==="road")h+=roadEnvHtml(sl);
  if(t==="race24"&&!ER)h+=e24EnvHtml();
  if(t==="salt")h+=saltEnvHtml(sl);
  if(t==="bog")h+=bogEnvHtml(sl);
  if(t==="hill")h+=hillEnvHtml(sl);
  if(t==="oval")h+=ovalEnvHtml(sl);
  if(t==="boat")h+=boatEnvHtml(sl);
  if(t==="endurance"){h+=sl("hours","Test length",5,1000,5," h",e.hours)+`<div class="lbl"><span>Load profile</span></div><div class="seg">${["highway","mixed","track"].map(p=>`<button data-lp="${p}" class="${e.loadProfile===p?"on":""}">${p[0].toUpperCase()+p.slice(1)}<small>${{highway:"steady 20% load",mixed:"street + spirited",track:"WOT, 1.3 g corners"}[p]}</small></button>`).join("")}</div>`;}
  $("envBox").innerHTML=h;envFold(t);pitsSync();if(t==="road"||t==="hill")suLive();
}
function applyEnv(k,v){const r=$("er-"+k);if(!r)return;const st=parseFloat(r.step)||1,mn=parseFloat(r.min),mx=parseFloat(r.max);v=Math.round((v-mn)/st)*st+mn;v=Math.min(mx,Math.max(mn,+v.toFixed(4)));envStore(k)[k]=v;r.value=v;const lab=$("ev-"+k);if(lab&&!lab.querySelector("input"))lab.textContent=v+(lab.dataset.unit||"");recompute();if(k.slice(0,2)==="su")suLive();}
function commitEnv(){save();if(climateCtl()&&!trackEvt(S.env.testType)&&isStdCell(simEnv())!==envStdShown)renderEnv();const l=lastForChart();if(S.env.testType==="drag"&&l&&l.drag&&S.last.env.testType==="drag")drawDragTrace(l.drag);else if(S.env.testType==="pull_sled"&&l&&l.pull&&S.last.env.testType==="pull_sled")drawPullTrace(l.pull);else if(S.env.testType==="salt"&&l&&l.salt&&S.last.env.testType==="salt")drawSaltTrace(l.salt);else if(S.env.testType==="bog"&&l&&l.bog&&S.last.env.testType==="bog")drawBogTrace(l.bog);else if(S.env.testType==="road"&&l&&l.road&&S.last.env.testType==="road")drawRoadTrace(l.road);else drawChart(quickForChart(),null);if(S.env.testType==="road")renderEnv();}
$("envBox").addEventListener("input",e=>{const r=e.target;if(!r.dataset.e||r.type!=="range")return;applyEnv(r.dataset.e,parseFloat(r.value));});
$("envBox").addEventListener("change",e=>{if(e.target.type==="range")commitEnv();});
(()=>{let hold=null;const stop=()=>{if(hold){clearTimeout(hold.t);clearInterval(hold.i);hold=null;}};
  const step=(k,dir)=>{const r=$("er-"+k);if(!r)return;applyEnv(k,envStore(k)[k]+dir*(parseFloat(r.step)||1));buzz(3);};
  $("envBox").addEventListener("pointerdown",e=>{const b=e.target.closest("[data-enud]");if(!b)return;e.preventDefault();const k=b.dataset.ek,dir=+b.dataset.enud;stop();step(k,dir);hold={t:setTimeout(()=>{hold.i=setInterval(()=>step(k,dir),110);},420)};});
  window.addEventListener("pointerup",()=>{if(hold){stop();commitEnv();}});window.addEventListener("blur",()=>{if(hold){stop();commitEnv();}});})();
let lastENudge=0;$("envBox").addEventListener("pointerdown",e=>{if(e.target.closest("[data-enud]"))lastENudge=performance.now();},true);
$("envBox").addEventListener("click",e=>{const b=e.target.closest("b[data-enum]");if(!b||b.querySelector("input")||performance.now()-lastENudge<600)return;const k=b.dataset.enum,r=$("er-"+k);if(!r)return;
  const inp=document.createElement("input");inp.type="number";inp.className="num";inp.inputMode="decimal";inp.min=r.min;inp.max=r.max;inp.step=r.step;inp.value=envStore(k)[k];inp.setAttribute("enterkeyhint","done");
  const init=inp.value;let done=false;const finish=ok=>{if(done)return;done=true;if(ok&&inp.value!==init){const v=parseFloat(inp.value.replace(",","."));if(isFinite(v)&&v!==envStore(k)[k]){b.textContent="";applyEnv(k,v);commitEnv();}}b.textContent=envStore(k)[k]+(b.dataset.unit||"");};
  inp.addEventListener("keydown",ev=>{if(ev.key==="Enter"){ev.preventDefault();finish(true);inp.blur();}else if(ev.key==="Escape"){finish(false);inp.blur();}});
  inp.addEventListener("blur",()=>finish(true));b.textContent="";b.appendChild(inp);inp.focus();inp.select();});
/* the drivetrain tier (clutch, box, axle): one rating, beside the tyres on the strip, the sled and the road. No S.env.drv = Stock, which never limits. */
/* career: a tier is bought once (C().drvOwn), then re-fitted free; an unowned one counts as Stock. Sandbox: every tier free. */
function drvOwned(id){return !career()||id==="stock"||!!(C().drvOwn&&C().drvOwn[id]);}
function drvId(){const id=S.env.drv;return SIM.DRIVETRAIN[id]&&drvOwned(id)?id:"stock";}
/* the one Driver toggle every event shares: You drive | Auto in a single row, the two one-line notes behind a small (i).
   attrs(id) gives the button its event's data attributes ("you" / "auto"); cur is the chosen id. */
function driverToggle(attrs,cur,you,auto){return `<div class="drvrow"><span class="dl">Driver</span><div class="seg n2 drvseg">${[["you","You drive"],["auto","Auto"]].map(([id,n])=>`<button ${attrs(id)} class="${cur===id?"on":""}">${n}</button>`).join("")}</div>${moreI(`<b>You drive</b> · ${you}<br><b>Auto</b> · ${auto}`,"About the driver")}</div>`;}
function drvHtml(){const cur=drvId();return `<div class="lbl"><span>Clutch, box &amp; axle</span></div><div class="seg">${Object.entries(SIM.DRIVETRAIN).map(([k,v])=>`<button data-lp="${k}" data-ek="drv" class="${cur===k?"on":""}">${v.n}<small>${Math.round(v.nm).toLocaleString("en-CA")} N·m${v.cost&&!drvOwned(k)?" · "+fmt$(v.cost):v.cost&&career()?" · owned":""}</small></button>`).join("")}</div><div class="segbodynote">${SIM.DRIVETRAIN[cur].d}${cur==="stock"?"":" — past the rating the clutch slips; far past it, something breaks."}</div>`;}
function carVeh(car){const b=BODY_SETUP[(car&&car.body)||"street"]||BODY_SETUP.street;const v=Object.assign({},b,car||{});v.chute=v.chute==="yes"||v.chute===true;v.body=(car&&car.body)||"street";return v;}
const BODY_SETUP={street:{gears:6,first:3.3,top:0.8,final:3.75,tyreDia:27,tyre:"street",chute:"no",launchRpm:3500,rearBias:0.55,mass:1400},
  outlaw:{gears:3,first:2.1,top:1.0,final:3.25,tyreDia:30,tyre:"radial",chute:"yes",launchRpm:4500,rearBias:0.6,mass:1450},
  promod:{gears:3,first:1.8,top:1.0,final:3.2,tyreDia:33,tyre:"slick",chute:"yes",launchRpm:6000,rearBias:0.62,mass:1150},
  rail:{gears:2,first:1.6,top:1.0,final:3.0,tyreDia:36,tyre:"slick",chute:"yes",launchRpm:6000,rearBias:0.8,mass:1000},
  funny:{gears:2,first:1.75,top:1.0,final:3.25,tyreDia:36,tyre:"slick",chute:"yes",launchRpm:6000,rearBias:0.68,mass:1170},
  prostock:{gears:5,first:2.5,top:1.0,final:4.25,tyreDia:33,tyre:"slick",chute:"yes",launchRpm:7000,rearBias:0.56,mass:1070},
  gasser:{gears:4,first:2.5,top:1.0,final:4.5,tyreDia:30,tyre:"slick",chute:"no",launchRpm:5000,rearBias:0.6,mass:1360}};
/* drag v2: the car's paint (S.paint sandbox / C().paint career; unset = the valve-cover colour, as before) */
const PAINTS=[["cover","Match the covers",null],["red","Red",0xb3261e],["white","White",0xe6e4de],["black","Black",0x16181b],["yellow","Yellow",0xe2b21b],["orange","Orange",0xd85f14],["blue","Blue",0x1f4fa8],["green","Green",0x1e6a3b],["purple","Purple",0x5b2a86],["silver","Silver",0xa9aeb5]];
function paintKey(){const k=(career()?C():S).paint;return PAINTS.some(p=>p[0]===k)?k:"cover";}
function carPaint(){const p=PAINTS.find(x=>x[0]===paintKey());return p&&p[2]!=null?p[2]:((window.COVER_COLORS||{})[S.cfg.cover]||0xa32a26);}
const hex6=n=>"#"+(n>>>0).toString(16).padStart(6,"0");
function paintHtml(){const k=paintKey(),cov=(window.COVER_COLORS||{})[S.cfg.cover]||0xa32a26;
  return`<div class="lbl"><span>Paint</span><b>${(PAINTS.find(p=>p[0]===k)||PAINTS[0])[1]}</b></div><div class="paints" role="radiogroup" aria-label="Paint">${PAINTS.map(([id,n,c])=>`<button data-paint="${id}" role="radio" aria-checked="${k===id}" aria-label="${n}" title="${n}" class="${k===id?"on":""}${c==null?" cov":""}"><i style="background:${hex6(c==null?cov:c)}"></i></button>`).join("")}</div>`;}
$("envBox").addEventListener("click",e=>{const b=e.target.closest("[data-paint]");if(!b)return;(career()?C():S).paint=b.dataset.paint;renderEnv();save();});
/* drag v3: the body shell, picked per class next to the paint (S.shell sandbox / C().shell career: {street:"fox", promod:"c7", ...});
   unset = the class default, a diesel street car defaults to the pickup */
const SHELLS={street:[["fox","Fox Mustang","notchback"],["gbody","G-body","Monte / Regal"],["nova","'70 Nova","chrome bumpers"],["coupe","90s F-body","the coupe"],["hatch","Hatch","small & light"],["truck","Diesel pickup","crew cab, stacks"]],
  promod:[["modern","Modern","the shop shell"],["camaro69","'69 Camaro","square & wide"],["c7","C7 Corvette","low wedge"],["willys41","'41 Willys","fendered coupe"]],
  gasser:[["tri55","'55 Chevy","tri-five post"],["willys","Willys","'41 coupe"]]};
SHELLS.outlaw=SHELLS.street;
function carShell(body,diesel){const o=(career()?C():S).shell||{},L=SHELLS[body];if(!L)return"";const k=o[body];return L.some(x=>x[0]===k)?k:body==="street"||body==="outlaw"?(diesel?"truck":"coupe"):L[0][0];}
function shellHtml(){const body=S.env.body||"street",L=SHELLS[body];if(!L)return"";const k=carShell(body,!!SIM.isDiesel(S.cfg));
  return`<div class="lbl"><span>Shell</span><b>${L.find(x=>x[0]===k)[1]}</b></div><div class="seg n${L.length}" role="radiogroup" aria-label="Body shell">${L.map(([id,n,d])=>`<button data-shell="${id}" role="radio" aria-checked="${k===id}" class="${k===id?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>`;}
$("envBox").addEventListener("click",e=>{const b=e.target.closest("[data-shell]");if(!b)return;const o=career()?C():S;o.shell=Object.assign({},o.shell||{},{[S.env.body||"street"]:b.dataset.shell});renderEnv();save();});
/* drag v2: what the strip car carries, read off the build (hood hardware, intercooler, exhaust effects) */
function stripHw(c){const k=c.asp||"na",asp=k==="na"?"na":k==="roots"||k==="screw"?"blower":k==="centrifugal"?"centri":k==="twin_turbo"||k==="compound"?"twin":"turbo";
  const diesel=!!SIM.isDiesel(c);return{asp,ic:!!c.ic&&c.ic!=="none",als:!!c.als&&c.als!=="off",n2o:!!c.nitrous&&c.nitrous!=="none",diesel,style:carShell((S.env&&S.env.body)||"street",diesel)};}
/* the other lane's own car: shell from the car's name, paint and hardware seeded from the name (hw0: the test & tune mirror runs your engine) */
const RIVAL_PAINT=[0x1f4fa8,0xe2b21b,0x1e6a3b,0xe6e4de,0x16181b,0x5b2a86,0xd85f14,0x7a1f1f,0x2b8a9e,0xa9aeb5,0xc23b6e,0x55602f];
/* v3: the shell each rival's car name reads as, per class (unnamed test & tune rivals get a seeded one) */
function rivalShell(body,n,h){
  if(body==="street"||body==="outlaw")return/s10|pickup|truck|duramax|cummins|ram 2500|crew cab/.test(n)?"truck":/civic|hatch|crx|golf/.test(n)?"hatch":/fox|mustang/.test(n)?"fox":/grand national|monte|regal|cutlass|g-body|buick/.test(n)?"gbody":/'6\d|'7[0-4]|camaro|nova|chevelle|duster|challenger|dart|falcon|cuda|gto|impala/.test(n)?"nova":/trans am|firebird|supra|corvette|'9\d|z28/.test(n)?"coupe":["fox","gbody","nova","coupe","hatch","nova","fox","coupe","truck"][h%9];
  if(body==="promod")return/willys/.test(n)?"willys41":/corvette/.test(n)?"c7":/camaro|'6\d/.test(n)?"camaro69":["modern","camaro69","c7","willys41","modern"][h%5];
  if(body==="gasser")return/willys|anglia|austin/.test(n)?"willys":/chevy|bel air|'5\d/.test(n)?"tri55":["tri55","willys"][h%2];
  return"";}
function rivalLook(name,car,body,hw0){const h=rnHash(String(name)+"|"+String(car||"")),r=rnRng(h),n=String(car||"").toLowerCase();
  let style=rivalShell(body,n,h);
  let hw;if(hw0)hw=Object.assign({},hw0);
  else{const pool=body==="street"?["na","na","turbo","blower","centri"]:body==="outlaw"?["turbo","twin","blower","na","centri"]:body==="funny"?["blower"]:body==="prostock"?["na"]:body==="gasser"?["na","blower","na","blower","turbo"]:["blower","twin","turbo","blower","na"];
    let asp=/turbo|grand national|supra/.test(n)?(r()<0.5?"twin":"turbo"):/nitrous|pro stock/.test(n)?"na":/nitro|top dragster|funny/.test(n)?"blower":pool[Math.floor(r()*pool.length)];
    const tb=asp==="turbo"||asp==="twin",dsl=style==="truck"&&(/duramax|cummins|diesel/.test(n)||r()<0.5);if(dsl&&asp==="na")asp="turbo";
    hw={asp,ic:tb||asp==="centri"||dsl,als:(tb&&!dsl&&body!=="street"&&r()<0.6)||(tb&&r()<0.2),n2o:/nitrous/.test(n)||(!dsl&&r()<0.2),diesel:dsl};}
  hw.style=style;const mine=carPaint();let c=RIVAL_PAINT[h%RIVAL_PAINT.length];if(c===mine)c=RIVAL_PAINT[(h+5)%RIVAL_PAINT.length];
  return{color:c,hw,body:body||"street"};}
/* what the other lane's car does (from a full dragPass trace): shift times, how long it spins, a seeded wheelie, chute */
function oppFx(tr,veh,seed){const r=rnRng(seed>>>0),sh=[];let g=null,spin=0;
  for(const p of tr||[]){if(p&&p.length>5){if(g!=null&&p[4]>g)sh.push(p[0]);g=p[4];if(p[5]&&p[0]<2.5)spin=p[0]+0.05;}}
  return{sh,spin,cut:Infinity,chute:!!veh.chute,lift:veh.body==="street"?0.05+r()*0.25:0.35+r()*0.55};}
function rnOppFx(N,rv,op){let tr=[];try{tr=SIM.dragPass(DR.res,Object.assign({},DR.veh,{auto:true,noFail:true,tyreTemp:DR.veh.tyre==="street"?0.3:0.8,holdTime:1.0})).trace;}catch(e){}
  const f=oppFx(tr,DR.veh,rnHash(rv.name+"|"+rv.car));if(op.broke)f.cut=op.at*N.et0;if(rv.skill<0.45)f.spin=Math.max(f.spin,0.25+(0.45-rv.skill));return f;}
/* every frame: the other lane's spin / shift kick / wheelie / chute, on the trace's clock (same as oppX) */
function oppDyn(now,ox,st){const R=DR&&DR.race,F=R&&R.fx;if(!F)return null;
  if(st.phase==="burnout")return{oburn:!!st.spin,ospin:!!st.spin,oshifting:false,olift:0,ochute:false};
  const g0=R.ogreen!=null?R.ogreen:R.green;const tt=g0==null?-1:((now-g0)/1000-R.rt)/R.k;
  if(tt<=0)return{ospin:false,oshifting:false,olift:0,ochute:false};
  const live=tt<F.cut;
  return{ospin:live&&tt<F.spin,oshifting:live&&F.sh.some(s=>tt>=s&&tt<s+0.22),olift:live?F.lift*Math.min(1,tt/0.2)*Math.max(0,1-tt/1.3):0,ochute:F.chute&&ox>404};}
$("envBox").addEventListener("click",e=>{if(e.target.closest("[data-stdcell]")){C().cell=stdCell();renderEnv();recompute();commitEnv();renderTest();toast("Cell reset to standard");}});
$("envBox").addEventListener("click",e=>{const b=e.target.closest("[data-lp]");if(!b)return;const k=b.dataset.ek||"loadProfile";
  if(k==="drv"&&SIM.DRIVETRAIN[b.dataset.lp]&&!drvOwned(b.dataset.lp)){const D=SIM.DRIVETRAIN[b.dataset.lp];if(C().cash<D.cost){toast("Not enough cash for the "+D.n+" drivetrain");return;}C().cash-=D.cost;(C().drvOwn=C().drvOwn||{})[b.dataset.lp]=1;logEvent(`Fitted a ${D.n} clutch, box & axle — ${fmt$(D.cost)}`);hud();toast(`${D.n} drivetrain fitted — ${fmt$(D.cost)}`);}
  if(k==="wbar"&&b.dataset.lp==="yes"&&!wbarOwned()){if(C().cash<WBAR_COST){toast("Not enough cash for wheelie bars");return;}C().cash-=WBAR_COST;C().wbarOwn=1;logEvent(`Fitted bolt-on wheelie bars — ${fmt$(WBAR_COST)}`);hud();toast(`Wheelie bars fitted — ${fmt$(WBAR_COST)}`);}
  S.env[k]=b.dataset.lp;if(k==="dragFmt")S.env.dragQuick=false;
  if(k==="body"&&BODY_SETUP[b.dataset.lp]){const bs=Object.assign({},BODY_SETUP[b.dataset.lp]);bs.launchRpm=Math.min(bs.launchRpm,S.cfg.redline);Object.assign(S.env,bs);toast(`${SIM.AERO[b.dataset.lp].n} — typical gearing filled in, edit anything`);}
  renderEnv();save();});
/* Test holds the dyno work, Events the strip, the sled, the salt, the road and the 24 Hours. Both pick S.env.testType;
   S.testPick / S.evPick remember the last of each so either tab reopens where it was left. */
const DYNO_T=["pull","endurance","overrev"],EV_T=["drag","bracket","pull_sled","salt","bog","boat","road","hill","oval","race24"];
/* Bracket night is the drag strip in its quick bracket format (S.env.dragFmt "bracket" + dragQuick): the picker shows it as its own tile */
function evCur(){return S.env.testType==="drag"&&S.env.dragFmt==="bracket"&&S.env.dragQuick?"bracket":S.env.testType;}
function evApply(t){if(t==="bracket"){S.env.dragFmt="bracket";S.env.dragQuick=true;S.env.testType="drag";}else{if(t==="drag"&&S.env.dragQuick){S.env.dragQuick=false;if(S.env.dragFmt==="bracket")S.env.dragFmt="test";}S.env.testType=t;}}
function pickTest(t){if(testing&&t!==S.env.testType){toast("Let the run finish first");return;}S.env.testType=t;document.querySelectorAll("#testType button").forEach(x=>x.classList.toggle("on",x.dataset.t===t));renderEnv();if(climateCtl())recompute();renderTest();save();}
$("testType").addEventListener("click",e=>{const b=e.target.closest("[data-t]");if(!b)return;pickTest(b.dataset.t);});
$("evPick").addEventListener("click",e=>{const b=e.target.closest("[data-t]");if(!b)return;const same=b.dataset.t===evCur();if(!same&&testing){toast("Let the run finish first");return;}if(!same&&b.dataset.t!=="bracket"&&evBlockPick(b.dataset.t))return;evApply(b.dataset.t);pickTest(S.env.testType);if(!same&&!testing)requestAnimationFrame(()=>{const pn=$("panel"),r=$("evPick").getBoundingClientRect(),pr=pn.getBoundingClientRect();if(r.top<pr.top)pn.scrollTo({top:pn.scrollTop+r.top-pr.top-8,behavior:calmScroll()});});});
/* opening Test or Events: if S.env.testType belongs to the other tab, switch to this tab's last pick (never mid-run) */
function evBlockPick(t){return false;}
function evSync(tab){if(testing||(S.bay&&tab==="events"))return;   // a dyno-day engine keeps the bay on its pull
  const ev=trackEvt(S.env.testType);let t=null;
  if(tab==="events"){const cur=ev?evCur():S.evPick;t=EV_T.includes(cur)&&evStatus(cur).k!=="lock"?cur:(EV_T.find(x=>evStatus(x).k!=="lock")||"drag");if(t===evCur())t=null;}else if(tab==="test"&&ev)t=DYNO_T.includes(S.testPick)?S.testPick:"pull";
  if(!t)return;evApply(t);document.querySelectorAll("#testType button").forEach(x=>x.classList.toggle("on",x.dataset.t===t));if(climateCtl())recompute();save();}
/* the test core (set-up, chart, results) and the run dock live in whichever tab owns the current test type */
const EV_NAME={drag:"Drag strip",bracket:"Bracket night",pull_sled:"Truck pull",salt:"Salt flats",bog:"Mud bog",boat:"Boat drags",road:"Road test",hill:"Pikes Peak",oval:"Dirt oval",race24:"24 Hours",pull:"Dyno pull",endurance:"Endurance",overrev:"Over-rev"};
function corePlace(){const t=S.env.testType,ev=trackEvt(t),slot=$(ev?"evSlot":"testSlot"),dock=$(ev?"evDock":"testDock"),core=$("testCore"),rd=$("runDock");
  if(core.parentElement!==slot)slot.appendChild(core);if(rd.parentElement!==dock)dock.appendChild(rd);
  const busy=(id,on,txt)=>{const el=$(id);if(el.hidden!==!on)el.hidden=!on;if(on&&el.dataset.k!==txt){el.dataset.k=txt;el.innerHTML=txt;}};
  busy("testBusy",ev,`<b>${EV_NAME[t]}</b> ${testing?"is running":"is set up"} in Events. <button class="chip" data-gotab="events">Open Events</button>`);
  busy("evBusy",!ev,S.bay?`<b>${S.bay.practice?"Practice":"Customer"} engine on the dyno</b> — events open again once it is handed back or you walk away. <button class="chip" data-gotab="test">Open Test</button>`:`A <b>${(EV_NAME[t]||"dyno").toLowerCase()}</b> ${testing?"is running":"is set up"} in Test. <button class="chip" data-gotab="test">Open Test</button>`);}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-gotab]");if(!b)return;showTab(b.dataset.gotab);});
/* a brief judged on the road, the strip or the salt: straight to that event (in the buyer's car and circuit for the road) */
function evGo(t,patch){if(testing){toast("Let the run finish first");return;}if(S.bay){toast(`${S.bay.practice?"Practice":"Customer"} engine on the dyno — hand it back or walk away first`);return;}Object.assign(S.env,patch||{});evApply(t);S.evPick=evCur();if(climateCtl())recompute();save();showTab("events");$("panel").scrollTop=0;}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-evgo]");if(!b)return;const t=b.dataset.evgo,p={};if(t==="road"){if(b.dataset.ch)p.roadCh=b.dataset.ch;if(b.dataset.trk)p.roadTrk=b.dataset.trk;}evGo(t,p);});
/* the picker cards: icon, name and one line of where you stand */
const BR_REP=5;   // bracket night: rep to enter in career
const EV_IC={drag:"M12 3.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 16.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",bracket:"M3 5h6v4H3zM3 15h6v4H3zM9 7h4v10H9M13 12h8",pull_sled:"M12 3v11a3.5 3.5 0 1 1-3.5-3.5",
  salt:"M4 17a8 8 0 1 1 16 0M12 17l5-3M3 21h18",bog:"M7 15a5 5 0 1 1 10 0M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0",boat:"M3 13h18l-3.5 4.5h-11zM12 4v9M12 5l6 6.5h-6M3 21c2-1.4 4-1.4 6 0s4 1.4 6 0 4-1.4 6 0",road:"M7 21c0-5 10-4 10-9S9 8 9 3M15 3c0 3 2 4 4 5",hill:"M2 20l7-12 4 6 3-4 6 10zM9 8l-1.5 2.6M16 10l1.4 2",oval:"M8 6h8a6 6 0 0 1 0 12H8A6 6 0 0 1 8 6zM12 4v3M12 17v3",race24:"M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"};
function evCert(){return !career()||!!(C().cert&&C().cert.ok&&C().cert.hash===cfgHash(S.cfg));}
function evStatus(t){const cr=career();let s="",k="";
  try{
  if(t==="drag"){const up=UPGRADES.find(u=>u.id==="race")||{},b=allBest(),N=rnLive();
    if(cr&&!has("race")){s=`needs ${up.name||"the race upgrade"}`;k="lock";}else if(N){s=`${RN_FMT[N.fmt]||"race night"} · on now`;k="live";}else if(!evCert())s="certify first";else s=b<Infinity?`best ${b.toFixed(2)} s`:"no pass yet";}
  else if(t==="bracket"){const N=rnLive(),R=recs();
    if(cr&&!has("race")){s=`needs ${(UPGRADES.find(u=>u.id==="race")||{}).name||"the race upgrade"}`;k="lock";}else if(cr&&C().rep<BR_REP){s=`opens at ${BR_REP} rep`;k="lock";}else if(N&&N.quick){s=`${rnStageName(N,N.stage).toLowerCase()} · on now`;k="live";}else if(!evCert())s="certify first";else s=R.brWon?`${R.brWon} of ${R.brRun} won`:"dial-in · 3 rounds";}
  else if(t==="pull_sled"){const P=recs().pull||{},ks=Object.keys(SIM.PULL_CLASSES).filter(c=>P[c]),full=ks.find(c=>P[c].full),bf=ks.reduce((m,c)=>Math.max(m,P[c].ft||0),0),c0=S.env.pullCls;
    if(PO){s="pull-off · on now";k="live";}else if(!evCert())s="certify first";else if(cr&&SIM.PULL_CLASSES[c0]&&pullHookedWk(c0))s=`hooked · next pull wk ${C().week+1}`;else s=full?`FULL · ${SIM.PULL_CLASSES[full].n}`:bf?`best ${bf.toFixed(1)} ft`:"no pull yet";}
  else if(t==="salt"){const L=saltBook(),bm=Object.values(L.pb).reduce((m,p)=>Math.max(m,p&&p.mph||0),0);s=!evCert()?"certify first":bm?`best ${bm.toFixed(1)} mph`:"no run yet";}
  else if(t==="bog"){const R=recs().bog||{},v=Object.values(R).filter(x=>x&&typeof x==="object"),cl=v.filter(x=>x.c&&x.t>0),bm=v.reduce((m,x)=>Math.max(m,+x.m||0),0),c0=S.env.bogCls;
    s=!evCert()?"certify first":cr&&SIM.BOG_CLASSES[c0]&&bogHookedWk(c0)?`ran · next bog wk ${C().week+1}`:cl.length?`best ${Math.min(...cl.map(x=>x.t)).toFixed(2)} s through`:bm?`best ${bm.toFixed(1)} m`:"no run yet";}
  else if(t==="boat"){const R=recs().boat||{},b=Object.values(R).filter(x=>x&&x.et>0),N=boatLive(),c0=S.env.boatCls;
    if(N){s=`${(BOAT_RND[N.stage]||"").toLowerCase()} · on now`;k="live";}else if(!evCert())s="certify first";else if(cr&&SIM.BOAT_CLASSES[c0]&&boatRanWk(c0))s=`ran · next night wk ${C().week+1}`;else s=b.length?`best ${Math.min(...b.map(x=>x.et)).toFixed(2)} s`:"no pass yet";}
  else if(t==="road"){const P=roadRecs(),o=roadOpt(),r=P[roadKey(o.rk||o.ch,S.env.roadTrk)],any=Object.values(P).some(x=>x&&x.t);s=!evCert()?"certify first":r&&r.t?`best ${fmtLap(r.t,1)} · ${SIM.ROAD_TRACKS[S.env.roadTrk].n.split(" ")[0]}`:any?"no lap in this car yet":"no lap yet";}
  else if(t==="hill"){const P=hillRecs(),k0=S.env.hillCls,r=P[k0],any=Object.values(P).some(x=>x&&x.t);s=!evCert()?"certify first":cr&&SIM.HILL_CLASSES[k0]&&hillRanWk(k0)?`ran · next wk ${C().week+1}`:r&&r.t?`best ${fmtHill(r.t)}`:any?"no run in this class":"no run yet";}
  else if(t==="oval"){const o=ovalOpen(),b=Object.values(ovalRecs()).filter(x=>x&&x.lap),k0=S.env.ovalCls,n=SIM.OVAL_CLASSES[k0]?ovalNight(k0):null;
    if(o){s=`opens at ${o} rep`;k="lock";}else if(n&&n.stage==="feature"){s="feature next";k="live";}else if(!evCert())s="certify first";else if(cr&&n&&ovalRanWk(k0))s=`ran · next night wk ${C().week+1}`;else s=b.length?`best lap ${Math.min(...b.map(x=>x.lap)).toFixed(2)} s`:"no night yet";}
  else if(t==="race24"){const g=cr?e24Gate():null,P=e24Recs(),km=Object.values(P).reduce((m,x)=>Math.max(m,x&&x.km||0),0),nx=g&&/^Next running in week (\d+)/.exec(g);
    if(ER){s="racing now";k="live";}else if(g&&/^Opens at/.test(g)){s=`opens at ${E24_REP} rep`;k="lock";}else if(nx)s=`next 24 h in wk ${nx[1]}`;else if(g)s=/Certify/.test(g)?"certify first":g.split(" — ")[0].toLowerCase();else s=km?`best ${Math.round(km).toLocaleString("en-CA")} km`:cr?"entry open":"a day and a night";}
  }catch(err){s="";}
  return{s,k};}
/* why the dock CTA can't run this event right now ("" when it can): a locked tile, or the 24 Hours' own gate */
function evBlock(t){if(!career()||!trackEvt(t))return"";
  if(t==="drag"&&S.env.dragQuick&&!has("race"))return`Locked · ${(UPGRADES.find(u=>u.id==="race")||{}).name||"race upgrade"}`;
  if(t==="drag"&&S.env.dragQuick&&C().rep<BR_REP&&!rnLive())return`Locked · opens at ${BR_REP} rep`;
  if(t==="drag"&&!has("race"))return`Locked · ${(UPGRADES.find(u=>u.id==="race")||{}).name||"race upgrade"}`;
  if(t==="race24"&&!ER){const g=e24Gate();if(!g)return"";return/^Opens at/.test(g)?`Locked · opens at ${E24_REP} rep`:/^Next running/.test(g)?g.replace("Next running","Next 24 h"):/Certify/.test(g)?"Certify this engine first":g;}
  if(t==="oval"){const o=ovalOpen();if(o)return`Locked · opens at ${o} rep`;}
  return"";}
function evPickRender(){const box=$("evPick");if(!box)return;const cur=evCur();
  const h=EV_T.map(t=>{const st=evStatus(t),on=t===cur;return `<button data-t="${t}" role="radio" aria-checked="${on}" class="${on?"on":""}${st.k?" "+st.k:""}" title="${EV_NAME[t]}${st.s?" · "+st.s:""}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${EV_IC[t]}"/></svg><b>${EV_NAME[t]}</b><small>${st.s||"&nbsp;"}</small></button>`;}).join("");
  if(box.dataset.h!==h){box.dataset.h=h;box.innerHTML=h;}
  const dot=$("evDot");if(dot)dot.classList.toggle("on",curTab!=="events"&&!!(rnLive()||ER||PO||boatLive()));}
/* Advanced: the settings a racer rarely touches fold away under the essentials (open state per test in S.advOpen) */
/* ADV: what folds away under an event's essentials. e = sliders, k = [data-attr, key] segs (label + seg + its note), x = extra selectors,
   m = selectors for more groups the Events tab moves out of Setup (a .seg's label and note, or the suspension grid with its read-out),
   anything built with data-evadv goes too. The Events tab shows the fold as its Advanced tab (evLayout), the Test tab as the "Cell" fold. */
const ADV={cell:{e:["ambientC","altitudeM","coolantC","oilC"]},
  drag:{e:["mass","rearBias","gears","first","top","final","tyreDia","tyrePsi"],k:[["ek","chute"],["ek","shocks"]],m:['[data-ek="drv"]','[data-ek="body"]','[data-shell]','[data-ek="wbar"]','[data-ek="race"]','[data-ek="shiftMode"]'],paint:1,hint:"Rear-drive on a prepped strip",sum:"weight · gearing · tyre psi · shocks · chute · paint"},
  pull_sled:{e:["pullHitch","pullBallast"],m:['[data-pk="pullTrans"]','[data-ek="drv"]'],hint:"A higher hitch plants",sum:"hitch height · front ballast"},
  salt:{e:["saltTop","saltBallast"],k:[["sk","saltAero"],["sk","saltCool"],["sk","saltChute"]],m:['[data-sk="saltShift"]'],x:["[data-saltgear]"],paint:1,sum:"gearing · ballast · aero · cooling · chutes · paint"},
  bog:{k:[["bk","bogGear"],["bk","bogTyre"]],sum:"gear · tyres"},
  boat:{e:["boatPitch","boatGear","boatTrim"],k:[["tk","boatImp"]],hint:"Boat drags:",sum:"prop pitch · gear · trim · prop shop"},
  road:{e:["roadFinal"],k:[["rk","roadCam"],["rk","roadSpd"]],m:['[data-rk="roadCh"]','[data-ek="drv"]',".su-grid"],sum:"final drive · camera · playback"},
  hill:{e:["hillFinal"],k:[["hk","hillCam"],["hk","hillSpd"]],m:['[data-hk="hillCh"]','[data-hk="hillAero"]',".su-grid"],sum:"final drive · camera · playback"},
  oval:{e:["ovalFinal"],k:[["ok","ovalGrille"],["ok","ovalCam"],["ok","ovalSpd"]],sum:"rear end · grille · camera · playback"},
  race24:{k:[["e24k","e24Fuel"],["e24k","e24Chg"],["e24k","e24SC"]],m:['[data-rk="roadCh"]'],sum:"fuel · tyre changes · safety cars"}};
function envFold(t){const key=DYNO_T.includes(t)?"cell":t,A=ADV[key],box=$("envBox");if(!A)return;const nodes=[],add=n=>{if(n&&!nodes.includes(n))nodes.push(n);};
  const seg=b=>{const g=b&&b.closest(".seg");if(!g)return;const l=g.previousElementSibling;if(l&&l.classList.contains("lbl"))add(l);add(g);for(let n=g.nextElementSibling;n&&n.classList.contains("segbodynote");n=n.nextElementSibling)add(n);};
  const evT=trackEvt(t);
  (A.e||[]).forEach(k=>{const r=$("er-"+k);if(r&&box.contains(r))add(r.closest(".env"));});
  (A.k||[]).forEach(([a,k])=>seg(box.querySelector(`[data-${a}="${k}"]`)));
  (A.x||[]).forEach(q=>{const b=box.querySelector(q);if(b)add(b.closest(".row")||b);});
  if(A.paint){const p=box.querySelector(".paints");if(p){const l=p.previousElementSibling;if(l&&l.classList.contains("lbl"))add(l);add(p);}}
  if(evT){(A.m||[]).forEach(q=>{const b=box.querySelector(q);if(!b)return;
      if(b.matches(".su-grid")){const l=b.previousElementSibling;if(l&&l.classList.contains("lbl"))add(l);add(b);const lv=$("suLive");if(lv&&box.contains(lv))add(lv);const n=lv&&lv.nextElementSibling;if(n&&n.matches("p.hint"))add(n);}else seg(b);});
    box.querySelectorAll("[data-evadv]").forEach(add);}
  if(A.hint)box.querySelectorAll(":scope > p.hint").forEach(p=>{if(p.textContent.trim().startsWith(A.hint))add(p);});
  if(!nodes.length)return;nodes.sort((a,b)=>a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1);
  const open=evT||!!(S.advOpen&&S.advOpen[key]),es=k=>envStore(k)[k];   // Events: the fold is the Advanced tab, always open
  const sum=key==="cell"?`${es("ambientC")} °C · ${es("altitudeM")} m · coolant ${es("coolantC")} · oil ${es("oilC")}`:A.sum;
  const f=document.createElement("div");f.className="acc advf"+(open?" open":"");f.dataset.adv=key;
  f.innerHTML=`<button class="acch" aria-expanded="${open}"><span class="t">${key==="cell"?"Cell":"Advanced"}</span><span class="sum">${sum}</span><span class="chev"></span></button><div class="accb"></div>`;
  const body=f.lastElementChild;let grid=null;
  for(const n of nodes){const g=n.parentElement;if(n.classList.contains("env")){if(!grid){grid=document.createElement("div");grid.className="envgrid";body.appendChild(grid);}grid.appendChild(n);if(g&&g.classList.contains("envgrid")&&!g.children.length)g.remove();}else{grid=null;body.appendChild(n);}}
  box.appendChild(f);}
function advSet(f,on){if(!f)return;f.classList.toggle("open",on);const h=f.querySelector(".acch");if(h)h.setAttribute("aria-expanded",String(on));S.advOpen=Object.assign({},S.advOpen,{[f.dataset.adv]:on});save();}
/* a lesson, tour or tip pointing into a closed fold opens it (Build's accordion or an Advanced fold) */
function accReveal(el){const p=evPaneOf(el);if(p&&!testing&&evTabNow()!==p)evTabSet(p);const ac=el&&el.closest(".acc");if(!ac||ac.classList.contains("open"))return;if(ac.classList.contains("advf"))advSet(ac,true);else{const a=ac.querySelector("[data-sec]");if(a)toggleSec(a);}}
/* Events panel tabs: Setup (the essentials) · Advanced (the fold) · Results. S.evTab[event] remembers the open one; old saves have none = Setup.
   Panes are CSS (#evSlot[data-evt]); a run always shows Setup. */
function evTabNow(){const t=(S.evTab||{})[evCur()];return t==="adv"||t==="res"?t:"setup";}
function evPaneOf(el){const sl=$("evSlot");if(!el||!sl||curTab!=="events"||!sl.contains(el))return null;return el.closest(".advf")?"adv":el.closest("#peaks,#verdict,#testExtra,#stressSec,#dynoHint,#setupJump")?"res":"setup";}
function evTabSet(tab,scroll){S.evTab=Object.assign({},S.evTab,{[evCur()]:tab});save();evLayout();if(scroll){const pn=$("panel"),tb=$("evTabs");if(pn&&tb){const d=tb.getBoundingClientRect().top-pn.getBoundingClientRect().top;if(d<0)pn.scrollTop=Math.max(0,pn.scrollTop+d-6);}}}
function evLayout(){const sl=$("evSlot"),tabs=$("evTabs"),pg=$("tab-events");if(!sl||!tabs)return;
  const hasAdv=!!document.querySelector("#envBox .advf"),hasRes=!!($("verdict").firstElementChild||$("peaks").firstElementChild);let tab=evTabNow();if(tab==="adv"&&!hasAdv)tab="setup";
  const pane=testing?"setup":tab;sl.dataset.evt=pane;sl.classList.toggle("nores",!hasRes);
  tabs.querySelectorAll("button").forEach(b=>{const on=b.dataset.evt===pane;b.classList.toggle("on",on);b.setAttribute("aria-selected",String(on));if(b.dataset.evt==="adv")b.hidden=!hasAdv;if(b.dataset.evt==="res")b.classList.toggle("has",hasRes);});
  tabs.classList.toggle("n2",!hasAdv);pg.classList.toggle("evbusy",!!testing);}
$("evTabs").addEventListener("click",e=>{const b=e.target.closest("[data-evt]");if(!b||testing)return;evTabSet(b.dataset.evt,true);buzz(4);});
$("envBox").addEventListener("click",e=>{const h=e.target.closest(".advf > .acch");if(!h)return;advSet(h.parentElement,!h.parentElement.classList.contains("open"));buzz(4);});
$("curveChips").addEventListener("click",e=>{const b=e.target.closest("[data-c]");if(!b)return;curves[b.dataset.c]=!curves[b.dataset.c];b.classList.toggle("on",curves[b.dataset.c]);drawChart(lastForChart(),null);});
function quickForChart(){return quick;}
function drawDragTrace(r){const INK=getComputedStyle(document.documentElement).getPropertyValue("--ink").trim()||"#edeae1";const soft=INK.startsWith("#1")?"rgba(20,20,19,.45)":"rgba(237,234,225,.45)";
  const dpr=Math.min(devicePixelRatio,2),W=chart.clientWidth,H=chart.clientHeight;if(chart.width!==W*dpr){chart.width=W*dpr;chart.height=H*dpr;}
  const x=chart.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);
  const padL=34,padR=34,padT=12,padB=22,cw=W-padL-padR,ch=H-padT-padB;const tr=r.trace.filter(t=>t[1]<=1320*0.3048+1);if(!tr.length)return;
  const X=d=>padL+cw*Math.min(1,d/402.336);const mphMax=Math.max(60,Math.ceil((r.mph||100)/20)*20),rpmMax=Math.max(4000,Math.ceil(S.cfg.redline/1000)*1000);
  x.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue("--grid").trim()||"rgba(255,255,255,.07)";x.lineWidth=1;
  for(const [d,n] of [[18.288,"60'"],[100.584,"330'"],[201.168,"1/8"],[304.8,"1000'"],[402.336,"1/4"]]){x.beginPath();x.moveTo(X(d),padT);x.lineTo(X(d),padT+ch);x.stroke();x.fillStyle=soft;x.font="10px "+getComputedStyle(document.body).fontFamily;x.textAlign="center";x.fillText(n,X(d),H-6);}
  // spin zones
  x.fillStyle="rgba(238,90,94,.18)";let s0=null;for(let i=0;i<tr.length;i++){const sp=tr[i][5];if(sp&&s0==null)s0=tr[i][1];if((!sp||i===tr.length-1)&&s0!=null){x.fillRect(X(s0),padT,Math.max(2,X(tr[i][1])-X(s0)),ch);s0=null;}}
  const line=(idx,max,col,w)=>{x.strokeStyle=col;x.lineWidth=w;x.beginPath();tr.forEach((t,i)=>{const px=X(t[1]),py=padT+ch*(1-Math.min(1,t[idx]/max));i?x.lineTo(px,py):x.moveTo(px,py);});x.stroke();};
  line(3,rpmMax,"rgba(120,169,221,.9)",1.5);line(2,mphMax,"#d97757",2.2);
  // shifts
  x.fillStyle=INK;for(const sh of r.shifts){const px=X(sh.x);x.beginPath();x.moveTo(px,padT+2);x.lineTo(px-4,padT+10);x.lineTo(px+4,padT+10);x.closePath();x.fill();}
  x.fillStyle="#d97757";x.textAlign="left";x.font="11px "+getComputedStyle(document.body).fontFamily;x.fillText("mph",padL+4,padT+12);x.fillStyle="rgba(120,169,221,.9)";x.fillText("rpm",padL+34,padT+12);
  x.fillStyle=soft;x.textAlign="right";x.fillText(mphMax+" mph",W-padR,padT+12);x.textAlign="left";x.fillText("0",padL+4,padT+ch-4);}
function lastForChart(){return S.last&&S.last.hash===cfgHash(S.cfg)?S.last.res:null;}
function drawChart(res,upto,cv){const chart=cv||$("chart");const OR2=getComputedStyle(document.documentElement).getPropertyValue("--orange2").trim()||"#e8956f";if(res&&res.e24&&upto==null&&!cv&&S.env.testType==="race24"){drawE24Trace(res.e24);return;}const INK=getComputedStyle(document.documentElement).getPropertyValue("--ink").trim()||"#edeae1";const INK_SOFT=INK.startsWith("#1")?"rgba(20,20,19,.45)":"rgba(237,234,225,.45)";
  const dpr=Math.min(devicePixelRatio,2),W=chart.clientWidth,H=chart.clientHeight;
  if(chart.width!==W*dpr){chart.width=W*dpr;chart.height=H*dpr;}
  const x=chart.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);
  const padL=34,padR=34,padT=12,padB=22,cw=W-padL-padR,ch=H-padT-padB;
  const base=curves.base&&S.base?S.base.res:null;
  const src=res||quick;const rmin=1000;const rmax=Math.max(4000,Math.ceil(Math.max(src.rpms[src.rpms.length-1],base?base.rpms[base.rpms.length-1]:0)/1000)*1000);
  const tmax=Math.max(50,Math.ceil(Math.max(...src.torque,base?Math.max(...base.torque):0)*1.1/50)*50),pmax=Math.max(50,Math.ceil(Math.max(...src.power,base?Math.max(...base.power):0)*1.1/50)*50);
  const X=r=>padL+(r-rmin)/(rmax-rmin)*cw,YT=v=>padT+ch-v/tmax*ch,YP=v=>padT+ch-v/pmax*ch,YN=f=>padT+ch-clamp(f,0,1)*ch;
  x.font="10px 'IBM Plex Mono',monospace";x.textBaseline="middle";
  x.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue("--grid").trim()||"rgba(255,255,255,.07)";x.fillStyle="#9a9484";
  for(let r=rmin;r<=rmax;r+=1000){x.beginPath();x.moveTo(X(r),padT);x.lineTo(X(r),padT+ch);x.stroke();x.textAlign="center";x.fillText((r/1000)+"k",X(r),H-9);}
  for(let i=0;i<=4;i++){const y=padT+ch*i/4;x.beginPath();x.moveTo(padL,y);x.lineTo(padL+cw,y);x.stroke();x.textAlign="right";x.fillStyle=OR2;x.fillText(Math.round(tmax*(1-i/4)),padL-4,y);x.textAlign="left";x.fillStyle=INK;x.fillText(Math.round(pmax*(1-i/4)),padL+cw+4,y);}
  const dc=dynoCap();if(dc.hp<pmax){x.strokeStyle="rgba(238,90,94,.5)";x.setLineDash([4,4]);x.beginPath();x.moveTo(padL,YP(dc.hp));x.lineTo(padL+cw,YP(dc.hp));x.stroke();x.setLineDash([]);x.fillStyle="#ee5a5e";x.textAlign="right";x.fillText("dyno limit",padL+cw,YP(dc.hp)-7);}
  const line=(R,arr,Y,col,w,N,dash)=>{x.strokeStyle=col;x.lineWidth=w;x.lineJoin="round";x.setLineDash(dash||[]);x.beginPath();for(let i=0;i<N;i++){const px=X(R.rpms[i]),py=Y(arr[i]);i?x.lineTo(px,py):x.moveTo(px,py);}x.stroke();x.setLineDash([]);};
  if(base){const NB=base.rpms.length;if(curves.torque)line(base,base.torque,YT,"rgba(217,119,87,.45)",1.5,NB,[5,4]);if(curves.power)line(base,base.power,YP,INK_SOFT,1.5,NB,[5,4]);}
  if(!res){x.fillStyle="#6e6a60";x.textAlign="center";x.font="12px 'Barlow',sans-serif";x.fillText("Run the test to plot this design",padL+cw/2,padT+ch/2);return;}
  const N=upto==null?res.rpms.length:Math.min(res.rpms.length,upto);
  if(N>1&&curves.torque){x.fillStyle="rgba(217,119,87,.10)";x.beginPath();x.moveTo(X(res.rpms[0]),padT+ch);for(let i=0;i<N;i++)x.lineTo(X(res.rpms[i]),YT(res.torque[i]));x.lineTo(X(res.rpms[N-1]),padT+ch);x.closePath();x.fill();}
  if(curves.torque)line(res,res.torque,YT,"#d97757",2.2,N);
  if(curves.power)line(res,res.power,YP,INK,2.2,N);
  const aux=[["boost",res.boostCurve,3.5,"#78a9dd",pU(),v=>S.psi?bv(v):v.toFixed(2)],["ve",res.veCurve,1.3,"#5cbf8a","VE",v=>Math.round(v*100)+"%"],["egt",res.egtCurve,1200,"#e2b24a","°C",v=>Math.round(v)]];
  for(const [k,arr,mx,col,unit,f] of aux){if(!curves[k]||!arr)continue;line(res,arr.map(v=>v/mx),YN,col,1.4,N);if(N>0){x.fillStyle=col;x.textAlign="right";x.fillText(f(arr[N-1])+" "+unit,X(res.rpms[N-1])-3,YN(arr[N-1]/mx)-7);}}
  if(N>0&&N<res.rpms.length){x.fillStyle=INK;x.beginPath();x.arc(X(res.rpms[N-1]),YP(res.power[N-1]),3,0,7);x.fill();}
  x.fillStyle=OR2;x.textAlign="left";x.fillText("Nm",padL+2,padT+6);x.fillStyle=INK;x.textAlign="right";x.fillText("hp",padL+cw-2,padT+6);x.lineWidth=1;
}
let testing=false;
/* the chart for the current test: the last run's trace when it matches the build and the test type, otherwise the live curve */
function chartRedraw(){const last=S.last&&S.last.hash===cfgHash(S.cfg)&&S.last.env.testType===S.env.testType?S.last:null;
  if(last&&S.env.testType==="drag"&&last.res.drag)drawDragTrace(last.res.drag);else if(last&&S.env.testType==="pull_sled"&&last.res.pull)drawPullTrace(last.res.pull);else if(last&&S.env.testType==="salt"&&last.res.salt)drawSaltTrace(last.res.salt);else if(last&&S.env.testType==="road"&&last.res.road)drawRoadTrace(last.res.road);else if(last&&S.env.testType==="bog"&&last.res.bog)drawBogTrace(last.res.bog);else if(last&&S.env.testType==="boat"&&last.res.boat)drawBoatTrace(last.res.boat);else if(last&&S.env.testType==="race24"&&last.res.e24)drawE24Trace(last.res.e24);else if(last&&S.env.testType==="hill"&&last.res.hill)drawHillChart(last.res.hill);else if(last&&S.env.testType==="oval"&&last.res.oval)drawOvalChart(last.res.oval);else drawChart(last?last.res:null,null);
  return last;}
function renderTest(){
  if(trackEvt(S.env.testType))S.evPick=evCur();else S.testPick=S.env.testType;corePlace();evPickRender();
  document.querySelectorAll("#testType button").forEach(x=>x.classList.toggle("on",x.dataset.t===S.env.testType));
  renderEnv();
  const last=chartRedraw();
  const blk=testing?"":evBlock(S.env.testType);$("runTest").disabled=testing||!!blk;$("runTest").classList.toggle("pri",!blk);const cost=testCost();
  $("runTest").textContent=testing?"Test in progress":blk?blk:`${{pull:"Arm dyno · pull",endurance:"Arm cell · endurance",overrev:"Arm cell · over-rev",drag:"Stage the car · drag pass",pull_sled:"Hook to the sled · truck pull",salt:"Roll to the line · salt run",bog:"Roll to the pit · mud bog",boat:"To the line · boat drags",road:"Roll out · road test",hill:"To the line · Pikes Peak",race24:ER?"Racing":"Take the green · 24 Hours"}[S.env.testType]}${cost?" · "+fmt$(cost)+(fuelBill()>=50&&fuelBill()<cost?" (fuel "+fmt$(fuelBill())+")":fuelBill()>=50?" fuel":""):""}`;
  $("pinBase").disabled=!last;$("baseChip").style.display=S.base?"":"none";$("baseChip").textContent=S.base?`vs ${S.base.label}`:"";
  const dc=dynoCap();$("dynoHint").innerHTML=S.env.testType==="hill"?hillHint():S.env.testType==="race24"?e24Hint():S.env.testType==="road"?roadHint():S.env.testType==="salt"?saltHint():S.env.testType==="bog"?bogHint():S.env.testType==="boat"?boatHint():S.env.testType==="pull_sled"?pullHint():S.env.testType==="drag"?(career()?`<b>Strip night</b> · $250 entry. Needs a certified engine and the ${(UPGRADES.find(u=>u.id==="race")||{}).name} upgrade. Purse by ET (sub-10 pays $1,500, sub-7 $25,000) plus reputation. Every pass is wear on the build — past its pass budget, parts start letting go.`:`<b>Strip</b> · hold the button in the water box to burn out, tap to stage. With a two-step or trans-brake, hold on the ambers and let go on the green; otherwise tap to launch. Tap SHIFT in manual mode.`):career()
    ? `<b>${dc.n}</b> · reads to ${dc.hp.toLocaleString()} hp and ${dc.rpm.toLocaleString()} rpm. A pull with no failures, inside those limits, certifies the engine for sale.`
    : `<b>${dc.n}</b> · no limits in the test cell. Figures update as you change the build; run a test to lock a result and pin it as a baseline.`;
  if(S.env.testType==="drag")rnRunBtn();
  if(S.env.testType==="pull_sled")pullRunBtn();
  if(S.env.testType==="boat")boatRunBtn();
  if(S.env.testType==="oval")ovalRunBtn();
  if(last)showResult(last.res,last.env);else{$("peaks").innerHTML="";$("verdict").innerHTML="";$("testExtra").innerHTML="";$("stressSec").style.display="none";}
  const rf=curTab==="events"&&!!last&&last.env.testType===S.env.testType;$("testCore").classList.toggle("resfirst",rf);$("setupJump").hidden=!rf;
  resultReveal(last,rf);evLayout();
  renderMap();ddRender();if(typeof railSched==="function")railSched();
}
/* a run just finished: bring the headline numbers (peaks + verdict, or the verdict on Events) to the top of the panel so they aren't left above or below the fold */
let revKey;
function resultReveal(last,rf){const k=last?last.res:null;if(testing)return;if(revKey===undefined||k===revKey){revKey=k;return;}revKey=k;if(!k)return;
  if(rf&&trackEvt(S.env.testType)){evTabSet("res",true);return;}   // Events: a fresh result opens the Results tab
  requestAnimationFrame(()=>{const pn=$("panel"),el=rf?$("verdict"):$("peaks");if(!el.offsetHeight||(curTab!=="test"&&curTab!=="events"))return;const pr=pn.getBoundingClientRect(),r=el.getBoundingClientRect(),bot=Math.min(pr.bottom,tabsTop());
    if(r.top<pr.top||r.top>pr.top+(bot-pr.top)*0.45)pn.scrollTo({top:pn.scrollTop+r.top-pr.top-6,behavior:calmScroll()});});}
$("setupJump").addEventListener("click",()=>{if(curTab==="events"){evTabSet("setup",true);return;}const pn=$("panel"),pr=pn.getBoundingClientRect(),r=$("envBox").getBoundingClientRect();pn.scrollTo({top:pn.scrollTop+r.top-pr.top-6,behavior:calmScroll()});});
/* ===================== TUNE MAP (dyno) =====================
   S.cfg.map is an rpm x load table that replaces the single timing / lambda sliders (and, on a boosted engine,
   a per-rpm boost target). The sim reads its 100% row for the WOT pull and the cruise cell for economy; SIM.mapGrid
   probes each load row so every cell can show its knock margin, EGT, smoke and torque. A map is never edited in
   place: blueprints and S.last hold the same object, so every edit swaps in a fresh copy. */
const MV={mode:"ign",over:"val",a:null,b:null,block:false,grid:null,key:"",drag:false,busy:false,wheel:0};
const mapHas=()=>!!(S.cfg.map&&SIM.mapOk(S.cfg.map));
const MAP_STEP={ign:0.5,lam:0.01,boost:0.05};
const MAP_SLIDE={timing:"ign",lambda:"lam",boost:"boost"};
function mapLim(mode){const d=isCI(S.cfg.fuel);return mode==="ign"?[-20,15]:mode==="lam"?(d?[1.0,4.0]:[0.65,1.6]):[0,fMax(sliderField("boost"))];}
function mapRnd(mode,v){const l=mapLim(mode);v=Math.min(l[1],Math.max(l[0],v));return mode==="ign"?Math.round(v*10)/10:Math.round(v*100)/100;}
function mapFmt(mode,v){if(mode!=="ign")return v.toFixed(2);const a=Math.abs(v);return (v>0?"+":v<0?"−":"")+(a%1?a.toFixed(1):a.toFixed(0));}
function mapTbl(m,mode){return mode==="ign"?m.ign:mode==="lam"?m.lam:[m.boost||m.rpm.map(()=>S.cfg.boost)];}
function mapSet(m,mode,li,ri,v){if(mode==="boost"){if(!m.boost)m.boost=m.rpm.map(()=>S.cfg.boost);m.boost[ri]=v;}else (mode==="ign"?m.ign:m.lam)[li][ri]=v;}
function mapTagFor(k){return S.cfg.map&&MAP_SLIDE[k]&&(k!=="boost"||S.cfg.map.boost)?' <em class="unl">mapped</em>':"";}
/* the sliders, with a map: they move the whole map by the same offset */
function mapShiftTo(k,v){const mode=MAP_SLIDE[k];if(!mapHas()||!mode||v===S.cfg[k])return;if(mode==="boost"&&!S.cfg.map.boost)return;
  const d=v-S.cfg[k],m=JSON.parse(JSON.stringify(S.cfg.map));
  if(mode==="boost")m.boost=m.boost.map(x=>mapRnd("boost",x+d));else{const t=mode==="ign"?m.ign:m.lam;t.forEach((row,j)=>t[j]=row.map(x=>mapRnd(mode,x+d)));}
  S.cfg.map=m;}
/* the redline moved: lay the rpm axis out again over the new range, keeping the shape */
function mapFitAxis(){if(!mapHas())return false;const ax=SIM.mapAxis(S.cfg),m=S.cfg.map;if(ax.join()===m.rpm.join())return false;S.cfg.map=SIM.mapRespace(m,ax);MV.a=MV.b=null;return true;}
function mapGridNow(){const env=simEnv({testType:"pull"});const k=cfgHash(S.cfg)+JSON.stringify(env);if(MV.key!==k){MV.grid=SIM.mapGrid(S.cfg,env);MV.key=k;}return MV.grid;}
function tuneLevel(){if(!career()||dev())return{margin:0.5,ignStep:0.5,lamStep:0.01,name:"Full calibration"};const t=staffed("tuner"),c=!!(C().rnd&&C().rnd.calib);
  if(t&&c)return{margin:0.5,ignStep:0.5,lamStep:0.01,name:"Calibration engineer + suite"};if(t)return crewT("wizard")?{margin:0.75,ignStep:0.5,lamStep:0.01,name:"Calibration engineer · tuning wizard"}:{margin:1.0,ignStep:1,lamStep:0.02,name:"Calibration engineer"};
  if(c)return{margin:1.5,ignStep:2,lamStep:0.04,name:"Calibration suite"};return null;}
function tuneCost(){if(!career()||dev())return 0;return (staffed("dynotech")?0:300)+4*fuelBill();}   // about four pulls of dyno time
/* cell colour: by value, or by the overlay's feedback (green safe, amber close, red past it) */
function mapBg(mode,over,v,c,tqMax,bMax){
  const hs=(h,a)=>`hsla(${Math.round(h)},72%,48%,${a})`;
  if(over==="knock")return hs(Math.min(1,Math.max(0,(c.margin+1)/4))*120,.5);
  if(over==="egt")return hs(120-Math.min(1,Math.max(0,(c.egt-650)/330))*120,.5);
  if(over==="smoke")return hs(120-Math.min(1,Math.max(0,c.smoke/0.35))*120,.5);
  if(over==="tq")return `rgba(217,119,87,${(0.06+0.62*Math.max(0,c.tq)/Math.max(1,tqMax)).toFixed(3)})`;
  const d=isCI(S.cfg.fuel);
  if(mode==="ign"){const t=Math.max(-1,Math.min(1,v/8));return t>=0?`rgba(217,119,87,${(0.06+0.5*t).toFixed(3)})`:`rgba(120,169,221,${(0.06-0.5*t).toFixed(3)})`;}
  if(mode==="lam"){const t=d?Math.max(-1,Math.min(1,(v-1.7)/0.5)):Math.max(-1,Math.min(1,(v-1.0)/0.14));return t<0?`rgba(120,169,221,${(0.06-0.5*t).toFixed(3)})`:`rgba(238,90,94,${(0.06+0.5*t).toFixed(3)})`;}
  return `rgba(217,119,87,${(0.06+0.55*v/Math.max(0.1,bMax)).toFixed(3)})`;}
function mapSub(over,c){if(over==="knock")return (c.margin>=0?"+":"−")+Math.abs(c.margin).toFixed(1);if(over==="egt")return Math.round(c.egt)+"";if(over==="smoke")return Math.round(c.smoke*100)+"%";if(over==="tq")return Math.round(c.tq)+"";return "";}
const MAP_LEG={knock:["knock margin","−1","+3 ON","hsla(0,72%,48%,.6),hsla(60,72%,48%,.6),hsla(120,72%,48%,.6)"],egt:["EGT","650","980 °C","hsla(120,72%,48%,.6),hsla(60,72%,48%,.6),hsla(0,72%,48%,.6)"],
  smoke:["smoke","0","35%","hsla(120,72%,48%,.6),hsla(60,72%,48%,.6),hsla(0,72%,48%,.6)"],tq:["torque","0","max","rgba(217,119,87,.06),rgba(217,119,87,.68)"]};
function mapSelRect(){if(!MV.a)return null;const b=MV.b||MV.a;return{l0:Math.min(MV.a[0],b[0]),l1:Math.max(MV.a[0],b[0]),r0:Math.min(MV.a[1],b[1]),r1:Math.max(MV.a[1],b[1])};}
function renderMap(){
  const sec=$("mapSec");if(!sec)return;
  const show=["pull","endurance","overrev"].includes(S.env.testType);sec.style.display=show?"":"none";if(!show)return;
  const box=$("mapBox"),d=isCI(S.cfg.fuel),boosted=S.cfg.asp!=="na";
  if(!mapHas()){$("mapCnt").textContent="sliders";
    box.dataset.sk="";box.innerHTML=`<p class="hint" style="margin-top:-4px">The tune is one ${d?"injection timing":"ignition timing"} and one λ for the whole rev range. A map gives every rpm and load its own cell, with ${d?"smoke":"knock"}, EGT and torque read back per cell — pull timing only where it ${d?"smokes":"knocks"}, ${d?"fuel":"enrich"} only where it needs it, lean the cruise cells for economy.</p>
      <button class="btn sm" data-map="create" style="width:100%"${testing?" disabled":""}>Start a map from the sliders</button>`;return;}
  if(mapFitAxis())recompute();
  if(MV.mode==="boost"&&!boosted)MV.mode="ign";
  if(MV.over==="knock"&&d)MV.over="smoke";if(MV.over==="smoke"&&!d)MV.over="knock";
  const m=S.cfg.map,G=mapGridNow(),nL=m.load.length,nR=m.rpm.length,bm=MV.mode==="boost";
  if(MV.a&&(MV.a[0]>=nL||MV.a[1]>=nR))MV.a=MV.b=null;
  if(bm&&MV.a){MV.a=[nL-1,MV.a[1]];MV.b=[nL-1,(MV.b||MV.a)[1]];}
  const T=mapTbl(m,MV.mode),tqMax=Math.max(...G.flat().map(c=>c.tq)),bMax=Math.max(0.1,...(m.boost||[S.cfg.boost]));
  $("mapCnt").textContent=`${nR} × ${bm?1:nL} · ${d?"diesel":"spark"}`;
  const cr=quick&&quick.mapCruise&&!d?quick.mapCruise:null;
  const near=(ax,v)=>ax.reduce((bi,x,i)=>Math.abs(x-v)<Math.abs(ax[bi]-v)?i:bi,0);
  const crCell=cr?[near(m.load,cr.load*100),near(m.rpm,cr.rpm)]:null;
  let h=`<table class="mapt"><thead><tr><th class="ax">${bm?"bar":"load"}</th>${m.rpm.map(r=>`<th>${r>=10000?(r/1000).toFixed(1)+"k":r.toLocaleString("en-CA")}</th>`).join("")}</tr></thead><tbody>`;
  const rows=bm?[nL-1]:m.load.map((_,j)=>nL-1-j);
  for(const li of rows){h+=`<tr><td class="ax">${bm?"target":m.load[li]+"%"}</td>`;
    for(let ri=0;ri<nR;ri++){const v=bm?T[0][ri]:T[li][ri],c=G[li][ri];const sub=MV.over==="val"?(bm?c.boost.toFixed(2):""):mapSub(MV.over,c);
      h+=`<td class="c${crCell&&!bm&&crCell[0]===li&&crCell[1]===ri?" cr":""}" data-li="${li}" data-ri="${ri}" style="background:${mapBg(MV.mode,MV.over,v,c,tqMax,bMax)}"><b>${mapFmt(MV.mode,v)}</b>${sub?`<i>${sub}</i>`:""}</td>`;}
    h+=`</tr>`;}
  h+=`</tbody></table>`;
  const leg=MV.over==="val"?(MV.mode==="ign"?["timing vs MBT","retard","advance","rgba(120,169,221,.56),rgba(255,255,255,0),rgba(217,119,87,.56)"]:MV.mode==="lam"?["commanded λ","rich","lean","rgba(120,169,221,.56),rgba(255,255,255,0),rgba(238,90,94,.56)"]:["boost target","0","max","rgba(217,119,87,.06),rgba(217,119,87,.61)"]):MAP_LEG[MV.over];
  const lvl=tuneLevel(),cost=tuneCost(),wrapOld=$("mapWrap"),sl=wrapOld?wrapOld.scrollLeft:0,foc=document.activeElement===wrapOld;
  const modeBtns=[["ign",d?"Injection":"Ignition",d?"° timing":"° vs MBT"],["lam",d?"Fuel limiter":"Fuel λ",d?"min λ":"commanded"]].concat(boosted?[["boost","Boost","bar target"]]:[]);
  const overBtns=[["val","Values"],[d?"smoke":"knock",d?"Smoke":"Knock"],["egt","EGT"],["tq","Torque"]];
  const note=`${lvl?`<b>${lvl.name}</b>: auto-tune keeps ${d?"smoke under 15% and EGT in check":`${lvl.margin.toFixed(1)} ON of knock margin and EGT in check`}, in ${lvl.ignStep}° / λ ${lvl.lamStep.toFixed(2)} steps.`:"Auto-tune needs a <b>Calibration engineer</b> (staff) or the <b>Calibration suite</b> (R&amp;D)."} ${html_desk()?"Drag to select a block · ↑↓ or wheel nudge · ←→ move · Shift+arrows extend.":"Tap a cell, <b>Block</b> then a far corner for a block, ± to nudge."}${cr?` Blue dot: the cruise cell (${Math.round(cr.rpm).toLocaleString("en-CA")} rpm, ${Math.round(cr.load*100)}%) that sets the economy figure.`:""}`;
  /* a nudge only changes the cells: swap the table, keep the buttons (a finger may still be on one) */
  const sk=[MV.mode,MV.over,d,boosted,lvl&&lvl.name,cost,MV.busy,testing,MV.block].join("|");
  if(wrapOld&&box.dataset.sk===sk){wrapOld.innerHTML=h;$("mapNote").innerHTML=note;mapPaintSel();return;}
  box.dataset.sk=sk;
  box.innerHTML=`<div class="seg n${modeBtns.length}" id="mapMode">${modeBtns.map(x=>`<button data-mm="${x[0]}" class="${MV.mode===x[0]?"on":""}">${x[1]}<small>${x[2]}</small></button>`).join("")}</div>
    <div class="chips" id="mapOver" style="margin-bottom:8px">${overBtns.map(x=>`<button class="chip${MV.over===x[0]?" on":""}" data-mo="${x[0]}">${x[1]}</button>`).join("")}</div>
    <div class="mapwrap" id="mapWrap" tabindex="0" aria-label="Tune map grid">${h}</div>
    <p class="hint maphs">Swipe the grid sideways for the higher rpm columns →</p><div class="mapleg"><span>${leg[0]}</span><span>${leg[1]}</span><span class="g" style="background:linear-gradient(90deg,${leg[3]})"></span><span>${leg[2]}</span></div>
    <div class="mapfb" id="mapFb"></div>
    <div class="mapbar"><button class="nud" data-mn="-1" aria-label="Nudge down">−</button><button class="nud" data-mn="1" aria-label="Nudge up">+</button>
      <button class="btn sm ghost${MV.block?" on":""}" data-map="block" title="Then tap the far corner of the block">Block</button><button class="btn sm ghost" data-map="smooth">Smooth</button><button class="btn sm ghost" data-map="interp">Interpolate</button></div>
    <div class="mapbar"><button class="btn sm${lvl?" pri":""}" data-map="auto" style="flex:2 1 100%"${!lvl||testing||MV.busy?" disabled":""}>${MV.busy?"Tuning…":"Auto-tune for safety"}${lvl&&cost?" · "+fmt$(cost):""}</button>
      <button class="btn sm ghost" data-map="copy">Copy from sliders</button><button class="btn sm ghost" data-map="reset">Reset map</button></div>
    <p class="hint" id="mapNote">${note}</p>`;
  const w=$("mapWrap");w.scrollLeft=sl;if(foc)w.focus({preventScroll:true});
  mapPaintSel();}
function html_desk(){return document.documentElement.classList.contains("desk");}
function mapPaintSel(){const w=$("mapWrap");if(!w)return;const R=mapSelRect();
  w.querySelectorAll("td.c").forEach(td=>{const li=+td.dataset.li,ri=+td.dataset.ri;const inR=R&&ri>=R.r0&&ri<=R.r1&&(MV.mode==="boost"||li>=R.l0&&li<=R.l1);td.classList.toggle("sel",!!inR);td.classList.toggle("anc",!!(MV.a&&MV.a[0]===li&&MV.a[1]===ri));});
  mapFeedback();}
function mapFeedback(){const fb=$("mapFb");if(!fb)return;const m=S.cfg.map,G=MV.grid,d=isCI(S.cfg.fuel);
  if(!MV.a||!G){fb.innerHTML=`Tap a cell to read it back${quick?` · this map pulls ${Math.round(quick.peakHp)} hp, ${Math.round(quick.peakTq)} N·m, ${quick.econ} L/100 km`:""}.`;return;}
  const [li,ri]=MV.a,c=G[li][ri],R=mapSelRect(),nSel=(R.r1-R.r0+1)*(MV.mode==="boost"?1:R.l1-R.l0+1);
  const head=`<b>${m.rpm[ri].toLocaleString("en-CA")} rpm · ${MV.mode==="boost"?"boost":m.load[li]+"%"}</b>: `;
  let t;
  if(MV.mode==="boost")t=`target ${(m.boost?m.boost[ri]:S.cfg.boost).toFixed(2)} bar → makes ${c.boost.toFixed(2)} bar`;
  else t=`${mapFmt("ign",m.ign[li][ri])}° → ${d?`smoke <span class="${c.smoke>0.25?"c":c.smoke>0.12?"w":"g"}">${Math.round(c.smoke*100)}%</span>`:`knock margin <span class="${c.margin<0?"c":c.margin<1?"w":"g"}">${c.margin>=0?"+":"−"}${Math.abs(c.margin).toFixed(1)}</span>${c.retard>0.05?` <span class="c">(ECU retard ${c.retard.toFixed(1)}°)</span>`:""}`}`;
  t+=`, EGT <span class="${c.egt>950?"c":c.egt>880?"w":""}">${Math.round(c.egt)} °C</span>, λ ${c.lam.toFixed(2)}${Math.abs(c.lam-c.cmd)>0.005&&MV.mode!=="boost"?` <span class="w">(asked ${c.cmd.toFixed(2)})</span>`:""}, ${Math.round(c.tq)} N·m`;
  if(!d&&m.load[li]<100&&MV.mode==="lam"&&c.cmd>1.1)t+=` <span class="w">· lean: misfire risk at cruise</span>`;
  fb.innerHTML=head+t+(nSel>1?`<br><span style="color:var(--dim)">${nSel} cells selected</span>`:"");}
let mapSaveT=null;
function mapCommit(){clearTimeout(mapSaveT);mapSaveT=setTimeout(()=>{save();if(curTab==="analysis")renderAnalysis();},400);}
function mapEdit(fn){if(!mapHas()||testing)return;const m=JSON.parse(JSON.stringify(S.cfg.map));if(fn(m)===false)return;S.cfg.map=m;
  if(m.boost&&S.cfg.asp!=="na")S.cfg.boost=Math.max(...m.boost);   // the turbo is sized and spooled for the highest target
  S.profileId=null;recompute();renderMap();mapCommit();}
function mapNudge(dir,mult){const R=mapSelRect();if(!R){toast("Tap a cell first");return;}const mode=MV.mode,st=MAP_STEP[mode]*(mult||1);
  mapEdit(m=>{const T=mapTbl(m,mode);for(let li=R.l0;li<=R.l1;li++)for(let ri=R.r0;ri<=R.r1;ri++){if(mode==="boost"&&li!==m.load.length-1)continue;const v=mode==="boost"?T[0][ri]:T[li][ri];mapSet(m,mode,li,ri,mapRnd(mode,v+dir*st));}});buzz(3);}
function mapSmooth(){const R=mapSelRect(),mode=MV.mode;mapEdit(m=>{const T=JSON.parse(JSON.stringify(mapTbl(m,mode))),nl=T.length,nr=T[0].length;
  const all=!R||(R.r0===R.r1&&R.l0===R.l1);const inR=(li,ri)=>all||ri>=R.r0&&ri<=R.r1&&(mode==="boost"||li>=R.l0&&li<=R.l1);
  for(let j=0;j<nl;j++)for(let i=0;i<nr;i++){const li=mode==="boost"?m.load.length-1:j;if(!inR(li,i))continue;let s=2*T[j][i],n=2;for(const [dj,di] of [[0,1],[0,-1],[1,0],[-1,0]]){const a=T[j+dj];if(a&&a[i+di]!=null){s+=a[i+di];n++;}}mapSet(m,mode,li,i,mapRnd(mode,s/n));}});
  toast(R&&!(R.r0===R.r1&&R.l0===R.l1)?"Smoothed the selection":"Smoothed the whole table");}
function mapInterp(){const R=mapSelRect(),mode=MV.mode;if(!R||(R.r0===R.r1&&(mode==="boost"||R.l0===R.l1))){toast("Select a block first: drag, or Block then the far corner");return;}
  mapEdit(m=>{const T=mapTbl(m,mode),g=(li,ri)=>mode==="boost"?T[0][ri]:T[li][ri];
    if(R.r1>R.r0){for(let li=(mode==="boost"?m.load.length-1:R.l0);li<=(mode==="boost"?m.load.length-1:R.l1);li++){const a=g(li,R.r0),b=g(li,R.r1),x0=m.rpm[R.r0],x1=m.rpm[R.r1];for(let ri=R.r0+1;ri<R.r1;ri++)mapSet(m,mode,li,ri,mapRnd(mode,a+(b-a)*(m.rpm[ri]-x0)/(x1-x0)));}}
    else{for(let ri=R.r0;ri<=R.r1;ri++){const a=g(R.l0,ri),b=g(R.l1,ri),y0=m.load[R.l0],y1=m.load[R.l1];for(let li=R.l0+1;li<R.l1;li++)mapSet(m,mode,li,ri,mapRnd(mode,a+(b-a)*(m.load[li]-y0)/(y1-y0)));}}});
  toast(R.r1>R.r0?"Interpolated across rpm":"Interpolated across load");}
function mapAuto(){const lvl=tuneLevel();if(!lvl||MV.busy||testing)return;const cost=tuneCost();if(career()&&C().cash<cost){toast("Not enough cash for dyno time");return;}
  MV.busy=true;renderMap();
  setTimeout(()=>{try{const before=quick;const r=SIM.mapAutoTune(S.cfg,simEnv({testType:"pull"}),lvl);
      if(career()&&cost){C().cash-=cost;hud();}
      S.cfg.map=r.map;S.profileId=null;MV.busy=false;recompute();renderMap();save();
      const avg=x=>x.torque.reduce((s,v)=>s+v,0)/x.torque.length,dh=Math.round(r.after.peakHp-r.before.peakHp),dq=Math.round(avg(r.after)-avg(r.before));
      toast(`Auto-tune: ${dh>=0?"+":"−"}${Math.abs(dh)} hp, ${dq>=0?"+":"−"}${Math.abs(dq)} N·m average · ${isCI(S.cfg.fuel)?"smoke ≤ 15%":"knock margin ≥ "+lvl.margin.toFixed(1)}, EGT ≤ ${r.egtMax} °C${r.backedOff?" · backed off "+r.backedOff+"° to stay in one piece":""}`);buzz([10,30,10]);
      if(before)void 0;}
    catch(e){MV.busy=false;renderMap();throw e;}},40);}
$("mapBox").addEventListener("click",e=>{
  const b=e.target.closest("[data-map],[data-mm],[data-mo]");if(!b||b.disabled)return;
  if(b.dataset.mm){MV.mode=b.dataset.mm;renderMap();return;}
  if(b.dataset.mo){MV.over=b.dataset.mo;renderMap();return;}
  const a=b.dataset.map;if(testing&&a!=="block")return;
  if(a==="create"||a==="copy"){if(a==="copy"&&!confirm("Replace the map with the slider values? Your cell edits will be lost."))return;
    S.cfg.map=SIM.mapFromSliders(S.cfg);S.profileId=null;MV.a=MV.b=null;recompute();renderBuild();renderMap();save();toast(a==="create"?"Map started from the sliders — it runs exactly like them until you change a cell":"Map reset to the slider values");return;}
  if(a==="reset"){if(!confirm("Delete the map and go back to the sliders?"))return;delete S.cfg.map;MV.a=MV.b=null;recompute();renderBuild();renderMap();save();toast("Map removed — the sliders run the engine again");return;}
  if(a==="block"){MV.block=!MV.block;b.classList.toggle("on",MV.block);if(MV.block&&!MV.a)toast("Tap the first corner, then the far corner");return;}
  if(a==="smooth")mapSmooth();else if(a==="interp")mapInterp();else if(a==="auto")mapAuto();});
/* ± with hold-to-repeat */
(()=>{let hold=null;const stop=()=>{if(hold){clearTimeout(hold.t);clearInterval(hold.i);hold=null;}};
  $("mapBox").addEventListener("pointerdown",e=>{const b=e.target.closest("[data-mn]");if(!b)return;e.preventDefault();try{b.setPointerCapture(e.pointerId);}catch(x){}const dir=+b.dataset.mn;stop();mapNudge(dir);hold={t:setTimeout(()=>{hold.i=setInterval(()=>mapNudge(dir),140);},420)};});
  ["pointerup","pointercancel","pointerleave"].forEach(ev=>$("mapBox").addEventListener(ev,e=>{if(e.target.closest&&e.target.closest("[data-mn]"))stop();}));
  window.addEventListener("pointerup",stop);window.addEventListener("pointercancel",stop);window.addEventListener("touchend",stop);window.addEventListener("blur",stop);})();
/* cells: tap / shift-click / Block-mode corner, mouse drag-select */
$("mapBox").addEventListener("pointerdown",e=>{const td=e.target.closest("#mapWrap td.c");if(!td)return;const p=[+td.dataset.li,+td.dataset.ri];
  if((e.shiftKey||MV.block)&&MV.a){MV.b=p;MV.block=false;const bb=$("mapBox").querySelector('[data-map="block"]');if(bb)bb.classList.remove("on");}else{MV.a=p;MV.b=p;}
  if(e.pointerType==="mouse"){MV.drag=true;e.preventDefault();$("mapWrap").focus({preventScroll:true});}
  mapPaintSel();});
$("mapBox").addEventListener("pointermove",e=>{if(!MV.drag)return;const el=document.elementFromPoint(e.clientX,e.clientY),td=el&&el.closest&&el.closest("#mapWrap td.c");if(!td)return;const p=[+td.dataset.li,+td.dataset.ri];if(!MV.b||p[0]!==MV.b[0]||p[1]!==MV.b[1]){MV.b=p;mapPaintSel();}});
window.addEventListener("pointerup",()=>{MV.drag=false;});
$("mapBox").addEventListener("keydown",e=>{if(e.target.id!=="mapWrap"||!mapHas())return;const k=e.key,m=S.cfg.map,nL=m.load.length,nR=m.rpm.length;
  if(!MV.a){if(k.startsWith("Arrow")){MV.a=MV.b=[nL-1,0];mapPaintSel();e.preventDefault();}return;}
  const mv=(dl,dr)=>{const p=e.shiftKey?(MV.b||MV.a).slice():MV.a.slice();p[0]=Math.max(0,Math.min(nL-1,p[0]+dl));p[1]=Math.max(0,Math.min(nR-1,p[1]+dr));if(MV.mode==="boost")p[0]=nL-1;if(e.shiftKey)MV.b=p;else{MV.a=p;MV.b=p;}mapPaintSel();
    const td=$("mapWrap").querySelector(`td[data-li="${p[0]}"][data-ri="${p[1]}"]`);if(td)td.scrollIntoView({block:"nearest",inline:"nearest"});};
  if(k==="ArrowUp"||k==="ArrowDown"){if(e.shiftKey||e.altKey||e.ctrlKey)mv(k==="ArrowUp"?1:-1,0);else mapNudge(k==="ArrowUp"?1:-1);}
  else if(k==="ArrowLeft"||k==="ArrowRight")mv(0,k==="ArrowRight"?1:-1);
  else if(k==="+"||k==="="||k==="PageUp")mapNudge(1,k==="PageUp"?4:1);
  else if(k==="-"||k==="_"||k==="PageDown")mapNudge(-1,k==="PageDown"?4:1);
  else if(k==="Escape"){MV.a=MV.b=null;mapPaintSel();}
  else return;
  e.preventDefault();e.stopPropagation();});
/* wheel over the selection nudges it; anywhere else the grid scrolls as usual */
$("mapBox").addEventListener("wheel",e=>{const td=e.target.closest&&e.target.closest("#mapWrap td.c.sel");if(!td||testing)return;e.preventDefault();MV.wheel+=e.deltaY;
  if(Math.abs(MV.wheel)>=50){mapNudge(MV.wheel<0?1:-1);MV.wheel=0;}},{passive:false});
function delta(a,b,f=v=>Math.round(v)){if(b==null)return"";const d=a-b;if(Math.abs(d)<0.5)return"";return `<span class="delta ${d>0?"up":"dn"}">${d>0?"+":""}${f(d)}</span>`;}
