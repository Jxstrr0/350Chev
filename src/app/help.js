/* ---- career onboarding tour: three callouts anchored to the real controls ---- */
const TOUR=[
  {tab:"build",sel:'#presets [data-id="22re"]',pre:tourPresetPrep,pre2:tourPresetRow,title:"Tap the Two-four",text:"The {n} green-tagged Starter engines use only parts your bay already has. Tap the Two-four truck four — it is a safe first sale."},
  {tab:"test",sel:"#rlRun",title:"Certify it on the dyno",text:"Buyers only look at engines with a certified pull. Arm the dyno and pull ($75). No failures and under the dyno's cap means it's certified."},
  {tab:"market",sel:"#tabs [data-tab=market]",title:"Sell it in Market",text:"Sell to a buyer group on the open market, or take a contract (10% deposit up front) and ship it. Engines that miss a brief still sell — for less. Then close the week and watch the warranty ledger."}
];
let tourStep=-1;
function tourPresetPrep(){S.pSort="layout";S.pFam="all";S.pCls="all";renderPresets();tourPresetRow();}
function tourPresetRow(){const c=document.querySelector('#presets [data-id="22re"]');if(c){const row=c.parentElement,rr=row.getBoundingClientRect(),cr=c.getBoundingClientRect();row.scrollLeft+=cr.left-rr.left-16;}}
const tourStarters=()=>PRESETS.filter(p=>p.starter&&!presetLocked(p.cfg)).length;
function tourPlace(){const st=TOUR[tourStep];if(!st)return;let el=document.querySelector(st.sel);if(el&&!el.offsetParent)el=null;const app=$("app").getBoundingClientRect();const spot=$("tourSpot"),box=$("tourBox");
  if(el){const r=el.getBoundingClientRect();spot.style.display="";const sl=Math.max(4,r.left-app.left-6),st2=Math.max(4,r.top-app.top-6),sr=Math.min(app.width-4,r.right-app.left+6),sb=Math.min(app.height-4,r.bottom-app.top+6);spot.style.left=sl+"px";spot.style.top=st2+"px";spot.style.width=Math.max(20,sr-sl)+"px";spot.style.height=Math.max(20,sb-st2)+"px";
    const below=r.bottom-app.top+16;const boxH=box.offsetHeight||170;if(below+boxH<app.height-70){box.style.top=below+"px";box.style.bottom="auto";}else{box.style.top="auto";box.style.bottom=(app.height-(r.top-app.top)+16)+"px";}}
  else{spot.style.display="none";box.style.top="auto";box.style.bottom="90px";}
  deskBox(box,el&&el.getBoundingClientRect());}
function tourShow(i){tourStep=i;const st=TOUR[i];if(!st){tourEnd();return;}$("tour").hidden=false;showTab(st.tab);if(st.pre)st.pre();
  accReveal(document.querySelector(st.sel));anaReveal(document.querySelector(st.sel));
  const target=document.querySelector(st.sel);if(target&&$("panel").contains(target)){const go=n=>{if(tourStep!==i)return;if(st.pre2)st.pre2();const t2=document.querySelector(st.sel)||target,pr=$("panel").getBoundingClientRect(),tr=t2.getBoundingClientRect(),dy=(tr.top-pr.top)-(pr.height*0.38);$("panel").scrollTop+=dy;tourPlace();if(n>0&&Math.abs(dy)>3)setTimeout(()=>go(n-1),350);else setTimeout(tourPlace,380);};setTimeout(()=>go(16),60);}
  $("tourStep").textContent=`Step ${i+1} of ${TOUR.length}`;$("tourTitle").textContent=st.title;$("tourText").textContent=st.text.replace("{n}",tourStarters());$("tourNext").textContent=i===TOUR.length-1?"Got it":"Next";
  if(target&&!$("panel").contains(target)){setTimeout(tourPlace,380);setTimeout(tourPlace,700);}   // the results rail is not in the panel: its layout settles a beat after the tab switch
  requestAnimationFrame(()=>requestAnimationFrame(tourPlace));}
function tourEnd(){tourStep=-1;$("tour").hidden=true;S.tourDone=true;save();touchHint();}
function tourAdvance(fromStep){if(tourStep===fromStep)tourShow(fromStep+1);}
function startTour(){if(!career())return;tourShow(0);}
$("tourNext").addEventListener("click",()=>tourShow(tourStep+1));$("tourSkip").addEventListener("click",tourEnd);
$("replayTour").addEventListener("click",()=>{if(!career()){setMode("career");}S.tourDone=false;showTab("build");startTour();});
window.addEventListener("resize",()=>{if(tourStep>=0)tourPlace();});
$("panel").addEventListener("scroll",()=>{if(tourStep>=0)tourPlace();},{passive:true});
function setMode(m){
  if(S.mode===m)return;if(testing){toast("Let the run finish first");return;}S.mode=m;
  if(career()&&presetLocked(S.cfg)){S.cfg=Object.assign({},SIM.DEFAULT_CFG);S.profileId=null;toast("Career bay can't fit that design yet — starting from the base four.");}
  save();boot();
}
document.querySelectorAll("#modeBox button, #intro [data-mode]").forEach(b=>b.addEventListener("click",()=>{$("intro").style.display="none";S.seen=true;ensureSound();setMode(b.dataset.mode);save();if(career()&&!S.tourDone)setTimeout(startTour,350);else touchHint();}));
/* ---- First Fire: a ninety-second scratch run for new players. Fire a V6, rev it past where its
   springs give up, fit a stiffer spring, certify it. It runs in the test cell on a borrowed engine,
   so the career books never see it; the player's own build, name, bench and tab go back after. ---- */
let ff=null;
const FF_STEPS=["fire","limit","fix","cert"];
function ffRig(){const p=PRESETS.find(x=>x.id==="l36")||PRESETS.find(x=>x.cfg.layout==="V6");const env=Object.assign({},SIM.DEFAULT_ENV,{testType:"pull"});
  const base=Object.assign({},SIM.DEFAULT_CFG,p.cfg,{springs:"single"}),stiffer=Object.keys(OPT.springs).filter(k=>OPT.springs[k].rate>OPT.springs.single.rate);let cfg=Object.assign({},base,{redline:6600});
  // lowest redline where single springs float, nothing else breaks, and any stiffer spring holds it
  for(let rl=6400;rl<=7400;rl+=100){const c=Object.assign({},base,{redline:rl}),a=SIM.simulate(c,env),vf=a.tests.find(t=>t.id==="valve_float");
    if(a.fails.length===1&&vf&&vf.status==="crit"&&vf.util>=1.015&&stiffer.every(k=>!SIM.simulate(Object.assign({},c,{springs:k}),env).fails.length)){cfg=c;break;}}
  return{p,cfg};}
function ffFloat(res,cfg){const vf=res&&res.tests.find(t=>t.id==="valve_float");return vf?(Math.round(cfg.redline/vf.util/50)*50).toLocaleString():"—";}
function ffFailed(l){const r=l.res,e=l.env;return r.fails.length>0||(e.testType==="endurance"&&r.endurance&&r.endurance.failedAtHour!=null)||(e.testType==="overrev"&&r.overrev&&!r.overrev.survived)||(e.testType==="drag"&&!!r.dragFailed);}
function ffRect(el){if(!el||!el.getClientRects().length)return null;const r=el.getBoundingClientRect();return r.width&&r.height?r:null;}
const FFT={idle:{under:"view",get:()=>ffRect($("idleBtn"))},view:{get:()=>ffRect($("view"))},
  run:{tab:"test",get:()=>ffRect($("runTest"))||ffRect($("rlRun"))},verdict:{tab:"test",get:()=>ffRect(document.querySelector("#verdict .verdict"))},
  springs:{tab:"build",sec:"Valvetrain",get:()=>{const b=document.querySelector('#buildForm button[data-k="springs"]'),sg=b&&b.parentElement,a=ffRect(sg&&sg.previousElementSibling),c=ffRect(sg);if(!a||!c)return c;
    const l=Math.min(a.left,c.left),r=Math.max(a.right,c.right);return{left:l,right:r,width:r-l,top:a.top,bottom:c.bottom,height:c.bottom-a.top};}}};
const FF_RUN={t:"Find the limit",x:()=>"Watch the tach — it's going all the way to redline.",tgt:"view",d:1e9};
const FF={
  fire:{go:{t:"Fire it up",x:()=>`${ff.rig.p.name}, straight off the stand. Tap START up top to turn it over.`,tgt:"idle",d:2500},
    ok:{t:"Fire it up",x:()=>"It's alive. Now let's find out where it breaks.",tgt:"view",auto:2600}},
  limit:{go:{t:"Find the limit",x:()=>`The redline's at ${S.cfg.redline.toLocaleString()} rpm on the stock single valve springs. Arm the dyno and pull it.`,tgt:"run",d:3000},run:FF_RUN,
    broke:{t:"Valve float",x:()=>`Past about ${ffFloat(S.last.res,S.last.cfg)} rpm the springs can't close the valves in time — they float and hit the pistons.`,tgt:"verdict",n:"Fix it"},
    held:{t:"It held",x:()=>"You changed something and it survived. Next shows the one-part fix anyway.",tgt:"verdict"}},
  fix:{go:{t:"Fix it with one change",x:()=>"Valve float is a spring problem. Under Valve springs, fit a stiffer one — try the Beehive.",tgt:"springs",d:3500},
    ok:{t:"Fix it with one change",x:()=>`${S.cfg.springs!=="single"?OPT.springs[S.cfg.springs].name+" fitted. ":""}The valves now follow the cam to about ${ffFloat(quick,S.cfg)} rpm — past the ${S.cfg.redline.toLocaleString()} redline.`,tgt:"springs",auto:2600}},
  cert:{go:{t:"Certify it",x:()=>"Same pull, one part changed. Arm the dyno and run it again.",tgt:"run",d:3000},run:Object.assign({},FF_RUN,{t:"Certify it"}),
    done:{t:"Build, break, fix",x:()=>`${S.last&&S.last.res.rel<85?"Certified — marginal, but it holds. ":"Certified. "}That's the game — build it, break it on the dyno, fix the weak link.`,tgt:"verdict",n:()=>ff.to==="career"?"Open my shop":"Open the test cell",last:1},
    still:{t:"Still breaking",x:()=>"Something else let go — the red bars in the stress report say what. Fix it and pull again, or finish here.",tgt:"verdict",n:"Finish"}}};
const ffCur=()=>FF[FF_STEPS[ff.step]][ff.phase];
function ffSet(ph){ff.phase=ph;ff.t0=performance.now();const P=ffCur();
  $("ffStep").textContent=P.last?"First Fire · done":`First Fire · ${ff.step+1} of ${FF_STEPS.length}`;$("ffTitle").textContent=P.t;$("ffText").textContent=P.x();
  $("ffNext").textContent=typeof P.n==="function"?P.n():P.n||"Next";$("ffSkip").style.display=P.last?"none":"";ffTick();}
function ffStep(i){ff.step=i;ff.ref=S.last;ffSet(i===0&&run.idle?"ok":"go");ffShow();}
function ffNext(){if(!ff)return;if(ff.step>=FF_STEPS.length-1)ffEnd();else ffStep(ff.step+1);}
// bring the current target back: its tab, its accordion section, then scroll it into the top third
function ffShow(){if(!ff)return;const t=FFT[ffCur().tgt];if(t.tab&&curTab!==t.tab)showTab(t.tab);
  if(t.sec){const a=document.querySelector(`#buildForm [data-sec="${t.sec}"]`);if(a&&!openSec[t.sec])toggleSec(a);}
  if(t===FFT.run&&!testing&&S.env.testType!=="pull"){S.env.testType="pull";renderTest();}
  setTimeout(()=>{if(!ff)return;const r=t.tab&&t.get();if(r){const pn=$("panel"),pr=pn.getBoundingClientRect();pn.scrollTop+=(r.top-pr.top)-pr.height*0.3;}ffPlace();},60);}
function ffPlace(){if(!ff||ff.ending)return;const app=$("app").getBoundingClientRect(),spot=$("ffSpot"),box=$("ffBox"),t=FFT[ffCur().tgt];
  const tabT=tabsTop()-app.top;let r=t.get();
  if(r&&t.tab){const pr=$("panel").getBoundingClientRect(),top=Math.max(r.top,pr.top),bot=Math.min(r.bottom,app.top+tabT);r=bot-top>=Math.min(28,r.height*0.5)?{left:r.left,width:r.width,top,bottom:bot,height:bot-top}:null;}
  $("ff").style.visibility=$("sheet").classList.contains("on")?"hidden":"";$("ffShow").style.display=!r&&t.tab?"":"none";
  const w=$("weekLbl");if(w&&w.textContent!=="FIRST FIRE")w.textContent="FIRST FIRE";
  const boxH=box.offsetHeight||150;let top=null;
  if(r){spot.style.display="";spot.style.left=(r.left-app.left-6)+"px";spot.style.top=(r.top-app.top-6)+"px";spot.style.width=(r.width+12)+"px";spot.style.height=(r.height+12)+"px";
    const below=(t.under?$(t.under).getBoundingClientRect():r).bottom-app.top+14,above=r.top-app.top-14-boxH;top=below+boxH<tabT-8?below:above>=8?above:null;}
  else spot.style.display="none";
  if(top!=null){box.style.top=top+"px";box.style.bottom="auto";}else{box.style.top="auto";box.style.bottom=(app.height-tabT+10)+"px";}
  deskBox(box,r);}
function ffTick(){if(!ff)return;if(ff.ending){if(!testing)ffFinish(true);return;}
  const st=FF_STEPS[ff.step],ph=ff.phase;
  if(st==="fire"){if(ph==="go"&&run.idle){ffSet("ok");return;}}
  else if(st==="limit"||st==="cert"){
    if(testing){if(ph!=="run"){ffSet("run");return;}}
    else if(S.last&&S.last!==ff.ref){ff.ref=S.last;const bad=ffFailed(S.last);if(!bad)buzz(20);ffSet(st==="limit"?(bad?"broke":"held"):(bad?"still":"done"));ffShow();return;}
    else if(ph==="run"){ffSet("go");return;}}
  else if(st==="fix"){const ok=!!quick&&!quick.fails.length;if(ph==="go"&&ok){buzz(20);ffSet("ok");return;}if(ph==="ok"&&!ok){ffSet("go");return;}}
  const P=ffCur(),dt=performance.now()-ff.t0;if(P.auto&&dt>P.auto){ffNext();return;}
  $("ffNext").style.display=dt>=(P.d||0)?"":"none";ffPlace();}
function ffStart(to){if(ff)return;if(S.bay){toast("Hand the dyno-day engine back first");return;}if(testing){toast("Let the dyno finish first");return;}
  closeSheet();if(tourStep>=0){tourStep=-1;$("tour").hidden=true;}
  const rig=ffRig();ff={to:to||S.mode||"sandbox",rig,step:0,phase:"go",t0:0,ref:null,back:{cfg:S.cfg,env:S.env,profileId:S.profileId,name:S.name,last:S.last,tab:curTab,idle:run.idle,sound:S.sound,tabs:Object.assign({},tabScroll,{[curTab]:$("panel").scrollTop})}};tabScroll.build=0;
  S.cfg=Object.assign({},rig.cfg);S.env=Object.assign({},SIM.DEFAULT_ENV,{testType:"pull"});S.profileId=rig.p.soundProfile;S.name=rig.p.name;S.last=null;curTab="build";resetBase();
  if(S.mode!=="sandbox"){S.mode="sandbox";boot();}else{afterCfgChange(true);hud();showTab("build");}
  $("ff").hidden=false;ff.iv=setInterval(ffTick,200);ffStep(0);}
// Skip or finish. Mid-pull it waits for the dyno to stop so the result lands on the scratch engine.
function ffEnd(){if(!ff)return;$("ff").hidden=true;if(testing){ff.ending=true;return;}ffFinish(true);}
function ffFinish(hand){const f=ff;if(!f)return;ff=null;clearInterval(f.iv);$("ff").hidden=true;const b=f.back;
  run.idle=b.idle;$("idleBtn").classList.toggle("on",run.idle);
  Object.assign(S,{cfg:b.cfg,env:b.env,profileId:b.profileId,name:b.name,last:b.last,mode:f.to,firstFireDone:true});curTab=b.tab;
  if(career()&&presetLocked(S.cfg)){S.cfg=Object.assign({},SIM.DEFAULT_CFG);S.profileId=null;}
  if(S.sound!==b.sound){S.sound=b.sound;$("sndBtn").classList.toggle("on",S.sound);if(!S.sound)ENGINE_SOUND.stop();}
  resetBase();achCheck({type:"ff"});save();boot();Object.assign(tabScroll,b.tabs);$("panel").scrollTop=b.tabs[curTab]||0;if(hand&&career()&&!S.tourDone)setTimeout(startTour,350);}
// if the page goes away mid-run, leave the player's own game in storage, not the scratch V6
function ffSafeSave(){if(!ff)return;const keep={mode:S.mode,cfg:S.cfg,env:S.env,profileId:S.profileId,name:S.name,last:S.last,sound:S.sound},b=ff.back;
  Object.assign(S,{mode:ff.to,cfg:b.cfg,env:b.env,profileId:b.profileId,name:b.name,last:b.last,sound:b.sound});save();Object.assign(S,keep);}
$("ffSkip").addEventListener("click",ffEnd);$("ffNext").addEventListener("click",ffNext);$("ffShow").addEventListener("click",ffShow);
$("replayFF").addEventListener("click",()=>{ensureSound();ffStart(S.mode);});
// a new player's first tap on the intro runs First Fire before the mode they picked (capture beats the handler above)
$("intro").addEventListener("click",e=>{const b=e.target.closest("[data-mode]");if(!b||S.firstFireDone)return;e.stopPropagation();$("intro").style.display="none";S.seen=true;ensureSound();ffStart(b.dataset.mode);},true);
// buttons that swap the whole game end First Fire first, so they act on the player's own save
function ffGuard(e){if(!ff)return;const b=e.target.closest("#modeBox button,#replayTour,#resetGame,#foreclose [data-restart],#slots button,#importSave,#exportSave");if(!b)return;
  if(testing){e.stopPropagation();toast("Let the dyno finish first");return;}ffFinish(!b.matches("#modeBox button,#replayTour"));}
$("panel").addEventListener("click",ffGuard,true);$("setPane").addEventListener("click",ffGuard,true);
document.addEventListener("visibilitychange",()=>{if(document.hidden)ffSafeSave();});window.addEventListener("pagehide",ffSafeSave);
window.addEventListener("resize",()=>{if(ff)ffPlace();});$("panel").addEventListener("scroll",()=>{if(ff)ffPlace();},{passive:true});

/* ===================== GLOSSARY, TAP-TO-EXPLAIN AND LESSONS ===================== */
/* ---- glossary: [id, name, aliases (| list, "=" prefix = match this exact case only), what it is, why it matters here, related ids] ---- */
const GLOSSARY=[
["lambda","Lambda (λ) and AFR","=λ|lambda|air-fuel ratio|air/fuel ratio|=AFR","Lambda is the air actually in the cylinder divided by the air needed to burn the fuel completely. 1.0 is chemically exact, below 1 is rich, above 1 is lean. AFR is the same thing as a mass ratio (about 14.7:1 for petrol at λ 1).","A rich petrol engine runs cooler and knocks less; a lean one makes heat. A diesel always runs lean, and how low its full-load λ can go is set by the smoke limit.","smoke,egt,knock"],
["bmep","BMEP","=BMEP|brake mean effective pressure","Brake mean effective pressure is the average pressure on the pistons through the whole cycle that would give the engine's measured torque. It is torque normalised for engine size, so it compares a 1.0 L and a 12 L fairly.","It is the best single number for how hard an engine is working. High BMEP means high loads on pistons, rods and bearings, and it is how boost shows up in your stress report.","imep,fmep,pmax"],
["imep","IMEP","=IMEP|indicated mean effective pressure","Indicated mean effective pressure is what the gas actually pushes on the pistons, before friction and pumping losses are taken off. Brake pressure is IMEP minus those losses.","The gap between IMEP and BMEP is the engine wasting work on friction and breathing.","bmep,fmep,pmep"],
["fmep","FMEP","=FMEP|friction mean effective pressure","Friction mean effective pressure is the rubbing loss of rings, bearings, valvetrain and oil pump, expressed as a pressure. It rises with rpm and with thick, cold oil.","Friction is why a tight, high-revving build loses power at the top, and why oil grade and ring choice show up in the dyno numbers.","bmep,pmep"],
["pmep","PMEP","=PMEP|pumping mean effective pressure|pumping loss","Pumping mean effective pressure is the work the engine spends dragging air in past a throttle and pushing exhaust out. A throttled petrol engine at part load pays a lot; an open diesel pays little.","It is a big part of why diesels use less fuel at light load, and why restrictive manifolds cost power.","imep,fmep"],
["mbt","MBT timing","=MBT|minimum advance for best torque|best torque timing","MBT is the spark timing that gives the most torque, just early enough that peak pressure lands a few degrees after top dead centre. Earlier than that adds knock risk without adding torque.","The ignition slider is measured against MBT: pull it back to protect a knocking engine, and the game shows the torque you gave up.","knock,injtiming"],
["knock","Knock (detonation)","knock|knocking|detonation|pre-ignition|preignition","Knock is the end gas igniting by itself, before the flame front reaches it. The sharp pressure spike hammers pistons and can melt crowns and ring lands in seconds. Heat, boost, compression and low octane all bring it on.","It is the hard ceiling on petrol power. The Detonation margin test tells you how close you are, and the fixes are octane, an intercooler, retarded timing, a richer mixture or lower compression.","octane,mbt,crown,egt"],
["octane","Octane (RON / MON)","octane|=RON|=MON|octane number|octane rating","Octane is a petrol's resistance to knock. RON is measured gently and MON under hotter, harder conditions; North American pump labels average the two. Higher is not more energy, only more resistance to self-ignition.","Each fuel in the game has an octane number, and the engine reports the octane it requires. Ethanol, methanol and race fuel buy knock margin that lets you run more boost and compression.","knock,cetane,cr"],
["cetane","Cetane number","cetane","Cetane is the opposite of octane: how quickly a diesel fuel ignites after injection. Higher cetane means shorter ignition delay, a smoother burn and easier cold starts.","Low-cetane fuel makes a diesel start hard and clatter. It appears in Analysis in place of the octane line.","octane,coldstart,injtiming"],
["cr","Compression ratio","compression ratio|static compression|=CR","The static compression ratio is the cylinder volume with the piston at the bottom divided by the volume at the top. More compression extracts more work from the fuel but raises the heat and the knock risk.","Petrol engines are limited by knock, so boost wants lower compression. A diesel needs 14 to 24:1 just to light the fuel by the heat of compression.","ecr,knock,boost"],
["ecr","Effective compression","effective compression|dynamic compression|effective CR|=ECR","Effective compression ratio counts only from the moment the intake valve closes, so a long cam with a late closing gives less than the static figure. Boost multiplies it again, since the cylinder is filled above atmospheric pressure.","This is the figure that actually decides knock and cylinder pressure, which is why big cams let you run more static compression.","cr,boost,knock"],
["ve","Volumetric efficiency","volumetric efficiency|=VE","Volumetric efficiency is how much air an engine actually draws compared with the air its displacement could hold at atmospheric pressure. Good heads and tuned runners can pass 100 percent; a turbo takes it far beyond.","Power is air first, so VE is the heart of the dyno curve. Cam, valves, runners, intake and exhaust all move it, and it falls off as the valves run out of time at high rpm.","boost,bmep"],
["boost","Boost","boost|boost pressure","Boost is how far above atmospheric pressure a turbo or blower pushes the intake air. 1 bar of boost roughly doubles the air in the cylinder.","More air burns more fuel for more power, and also more heat and pressure on everything downstream. Boost is why detonation, head lift and the gasket show up as limits.","pr,spool,ic,wastegate"],
["pr","Pressure ratio","pressure ratio|=PR","Pressure ratio is the absolute pressure after the compressor divided by the pressure before it. 1 bar of boost at sea level is a ratio of about 2.0.","Compressors are rated by flow at a pressure ratio. Ask for more ratio than the compressor can give and its efficiency collapses and the air comes out hot.","boost,inducer,compmap"],
["inducer","Inducer","inducer|inducer diameter","The inducer is the inlet side of a compressor wheel, where air enters. A bigger inducer swallows more air, so it is the number people quote for turbo frame size.","A bigger inducer moves more air at high boost but is slower to spin up. This is the trade between the small, medium and large turbo frames.","exducer,spool,compmap"],
["exducer","Exducer","exducer","The exducer is the outer edge of a wheel, where flow leaves a compressor or enters a turbine. Its diameter sets the speed at the tips and, for the turbine, how much exhaust energy it can catch.","Along with the inducer it describes a wheel's size and trim. Bigger wheels flow more but take more exhaust energy to turn.","inducer,spool"],
["spool","Spool and lag","spool|spool-up|turbo lag","Spool is a turbo getting up to speed on exhaust energy. Lag is the wait between pressing the throttle and the boost arriving; big wheels and low rpm make it longer.","A big turbo makes more peak power but arrives later. Diesels spool earlier because they push full exhaust flow with no throttle.","boost,inducer,compound"],
["wastegate","Wastegate","wastegate|waste gate","A wastegate is a valve that lets exhaust bypass the turbine so boost stops rising at the set pressure. Without it the turbo would keep speeding up until something broke.","It holds boost to your slider setting and protects the turbo's speed limit.","boost,bov,spool"],
["bov","Blow-off valve","blow-off valve|blowoff valve|=BOV|diverter valve","A blow-off valve vents boost from the intake when the throttle snaps shut, so the compressor is not slammed against a closed throttle. That stops compressor surge and the fluttering sound.","It protects the compressor wheel and keeps the turbo spinning for quicker re-boost.","wastegate,compmap"],
["compound","Compound turbos","compound turbos|compound turbo|compound|triple turbo|triple-turbo|series turbos","Compound turbos run in series: a big low-pressure turbo feeds a small high-pressure turbo. The small one spools quickly and the big one carries the flow, so the pressure ratios multiply.","This is how diesel pulling trucks reach several bar of boost. It makes enormous cylinder pressure and demands a stout head, studs and gasket.","boost,pr,spool,pmax"],
["ic","Intercooler","intercooler|charge cooler|charge-air cooler|aftercooler|ice tank","An intercooler cools the compressed intake air. Cooler air is denser, so more of it fits in the cylinder, and it also lowers the temperature the cylinder starts from.","Cooling the charge is the cheapest knock margin you can buy, and it lifts power at the same boost.","boost,knock,ve"],
["compmap","Compressor map","compressor map|compressor flow|surge","A compressor map plots how much air a compressor moves at each pressure ratio and how efficient it is there. Too little flow at high ratio causes surge; too much chokes it.","The Compressor flow test in the stress report is this check: does your turbo sit in its efficient island for the air and boost you asked for.","pr,inducer,bov"],
["pmax","Peak cylinder pressure","peak cylinder pressure|cylinder pressure|firing pressure|=Pmax","The highest pressure reached in the cylinder during combustion, normally a few degrees after top dead centre. Boost and compression raise it directly.","It loads the crown, gasket, studs, head, bearings and rod. Many failures in the stress report are really this number passing a part's limit.","bmep,headlift,gasket,crown"],
["egt","Exhaust gas temperature","exhaust gas temperature|=EGT","EGT is how hot the gas is as it leaves the cylinders. It rises when the mixture is lean or the timing is late, because the heat is still being released as the exhaust valve opens.","High EGT cooks exhaust valves, manifolds and turbine wheels. A diesel's EGT is the direct limit on how much fuel it can burn.","lambda,turbine,valvetemp"],
["crown","Crown temperature","crown temperature|piston crown|crown temp|crown strength","The piston crown is the top face the flame touches. It is cooled mostly through the rings and from underneath by oil, so it runs far hotter than the block around it.","Past roughly the point where aluminium softens, crowns melt or hammer into a ring land. Oil squirters, forged alloys and cooler charge all bring it down.","ringland,knock,squirters"],
["squirters","Piston cooling jets","oil squirters|piston cooling jets|piston squirters|squirters","Small oil nozzles in the block that spray the underside of each piston. The oil carries heat away from the crown that the rings alone cannot.","Cheap and effective protection for a boosted or high-load build, and a normal feature on diesels.","crown,oilstarve"],
["ringland","Ring land","ring land|ringland|top land","The ring lands are the ridges of piston metal between the ring grooves. The top land carries the top ring and is the thinnest, hottest, most fragile part of the piston.","Knock and heat break ring lands first. When the ring land fails, compression and oil control go with it.","crown,ringgap,knock"],
["ringgap","Ring end gap","ring end gap|ring gap|end gap","Each piston ring is split, and the gap at the split closes up as the ring heats. Too small and the ends butt together and the ring scuffs the bore; too large and gas leaks past.","Power adders need looser gaps because the rings run hotter. The Ring end gap test checks that the hot gap has not closed.","ringland,blowby"],
["slap","Piston slap","piston slap|cold slap|slap","Piston slap is the knock of a piston rocking in its bore when the engine is cold and the piston has not yet expanded to fit. Forged pistons are fitted looser, so they slap more when cold.","A loose fit that is right when hot is noisy and wearing when cold. The Cold slap test balances it against blow-by.","blowby,ringgap,forged"],
["blowby","Blow-by","blow-by|blowby","Blow-by is combustion gas that leaks past the rings into the crankcase. It costs power, dilutes the oil and pressurises the case.","Loose pistons and big ring gaps raise it. A little is normal; a lot means lost compression and fouled oil.","slap,ringgap"],
["rodratio","Rod ratio","rod ratio|rod/stroke|rod-to-stroke","Rod ratio is the connecting rod's length divided by the stroke. A longer rod swings less side to side, lowering the push on the cylinder wall and lingering a little longer near top dead centre.","Long rods are kinder to piston skirts and bores; short rods make a more compact engine. It is a modest, not a dramatic, effect.","pistonspeed,slap"],
["pistonspeed","Piston speed","mean piston speed|piston speed","Mean piston speed is how fast the piston moves on average: twice the stroke times rpm. Everything that scales with inertia, friction and ring wear scales with it.","Roughly 25 m/s is where production engines top out and racing engines push past. It is why long strokes limit redline.","rodratio,redline,fmep"],
["bearingfilm","Bearing oil film","hydrodynamic film|oil film|bearing film|bearing specific load|bearing load","A crank bearing never touches the shaft when it works: spinning drags a wedge of oil between them that carries the load. It is thin, and oil thickness and temperature change it.","Heavy cylinder pressure squeezes the film out. When it breaks down the bearing wipes, one of the quickest ways to destroy an engine.","oilstarve,pmax,oilgrade"],
["oilstarve","Oil starvation","oil starvation|oil pickup|aeration","Oil starvation is the pump drawing air instead of oil, from sloshing in hard cornering or braking, or from oil foamed by the crank. Pressure collapses and the bearings are unprotected within seconds.","Baffled sumps and dry sumps exist to prevent it. It matters most for race builds at high g.","bearingfilm,drysump"],
["drysump","Dry sump","dry sump|dry-sump","A dry-sump system pumps oil out of a shallow pan into a remote tank and feeds the engine from there. The oil stays deaerated and available whatever the car does.","It protects race engines from starvation and lets the engine sit lower.","oilstarve"],
["oilgrade","Oil grade","oil grade|oil viscosity|viscosity","Viscosity grades such as 5W-30 describe how thick the oil is cold and hot. Thin oil flows easily and wastes less; thick oil holds a film under load but drags.","It trades friction against bearing protection, and cold flow against hot film strength.","bearingfilm,fmep"],
["valvefloat","Valve float","valve float|valvetrain limit","Valve float is the valve springs being too soft to pull the valve closed as fast as the cam lets it go, so the valve lags the cam and bounces. The engine loses power and can crash a valve into the piston.","It sets the usable redline of a valvetrain. Stiffer springs, lighter valves and a gentler cam push the limit up.","valvepiston,springs"],
["springs","Valve springs","valve springs|beehive","Valve springs close the valves against the cam's motion. Stiffer ones hold the valves under control to a higher rpm but add friction and wear the cam.","Fitting a stiffer spring is the standard cure for valve float.","valvefloat"],
["valvepiston","Valve-to-piston clearance","valve-to-piston|valve to piston|valve/piston","With big lift and overlap the open valves reach into the space where the piston arrives at top dead centre. The clearance between them is a few millimetres.","A float, a broken belt or a too-wild cam closes that gap, and the result is bent valves and holed pistons.","valvefloat,cam"],
["valvetemp","Exhaust valve temperature","exhaust valve temp|exhaust valve temperature|valve temperature","The exhaust valve passes all of the hot gas and has only its seat and stem to shed heat, so it runs near its material limit.","Lean mixtures, late timing and boost cook valves. Sodium-filled or nickel alloys raise the limit.","egt,lambda"],
["cam","Cam duration and overlap","cam duration|overlap|valve overlap","Cam duration is how long the valves stay open; overlap is when intake and exhaust are both open at once. Long cams favour high rpm breathing and idle rough at low rpm.","A wild cam moves the powerband upwards and lowers effective compression, which is why it changes both the dyno and the knock picture.","ve,ecr,valvepiston"],
["headlift","Head lift and clamp margin","head lift|head clamp|clamp margin|clamp load","Cylinder pressure pushes the head up and the studs hold it down. If the pressure force exceeds the clamp load, the head lifts a hair and gas escapes past the gasket.","Boost and compression raise the force. Better studs and a stiff deck raise the clamp.","gasket,studs,pmax"],
["studs","Head studs and fasteners","head studs|studs|head bolts|head fasteners|torque-to-yield","Head studs clamp the head to the block. Studs stretch evenly and hold more load than bolts, which are turned into the block and tend to distort it. Torque-to-yield bolts are single use.","They set the head's clamp margin. Boosted and high-pressure builds need studs.","headlift,gasket"],
["gasket","Head gasket and MLS","head gasket|gasket|=MLS|multi-layer steel|multilayer steel","The head gasket seals combustion, coolant and oil between head and block. Composite gaskets are cheap; multi-layer steel (MLS) uses stacked steel sheets that take more pressure and heat.","Cylinder pressure and head lift are measured against the gasket's sealing limit.","firering,headlift,studs"],
["firering","Fire ring","fire ring|o-ring|receiver groove|o-ringed|copper gasket","A fire ring is a wire or groove that sinks into the block or head to ring each cylinder, so the gasket is not the only thing sealing very high pressure. Copper gaskets work the same way.","It is the answer for outlaw boost and nitrous power where a normal gasket would blow out.","gasket,headlift"],
["cgi","CGI (compacted graphite iron)","=CGI|compacted graphite iron|compacted graphite","CGI is cast iron with graphite in short, blunt flakes. It is roughly 75 percent stronger and 35 percent stiffer than grey iron, so the block can be lighter or stand higher pressure.","It is the modern diesel block material: high cylinder pressure without enormous mass.","pmax,blockmat,billet"],
["nikasil","Nikasil bore plating","nikasil|Ni-SiC|bore plating|plated bore","A thin nickel and silicon carbide coat plated on an aluminium bore. It is very hard, runs the rings well and lets an aluminium block do without iron liners.","It saves weight and conducts heat better than a liner, but needs a machine shop that can do the plating.","blockmat"],
["blockmat","Block material","block material|grey iron|aluminium block|iron block","The block is the foundation: grey iron is cheap, damped and heavy; aluminium is light and conducts heat but is weaker and expands; CGI sits between them in stiffness and strength.","Stiffness keeps bores round under load and strength carries cylinder pressure. Heavy blocks cost weight on a launch.","cgi,nikasil"],
["forged","Forged 2618 and 4032","2618|4032|forged piston|forged pistons","Forged pistons are pressed from billet alloy. 2618 is strong and tough and expands a lot, so it needs a looser fit and rattles cold; 4032 holds a tighter fit with a little less strength.","2618 is the choice for nitrous, boost and race builds; 4032 is the quieter street forging. This choice trades slap against strength.","slap,crown,billet"],
["billet","Billet","billet","A billet part is machined from a solid block of alloy rather than cast or forged. It is the strongest and most consistent, with no cast porosity, and the most expensive.","It is how outlaw builds go past what any casting can take, and what lifts the limits on bore and cylinder pressure.","forged,cgi"],
["torsional","Torsional vibration and damper","torsional|torsional vibration|harmonic damper|damper|harmonic balancer","A crank is a long spring and twists a little with every firing pulse. At some rpm the twist builds into a resonance. A torsional damper is a weighted rubber or fluid ring that absorbs it.","Without the right damper a crank can fatigue and break at the resonant rpm. Cylinder count and stroke decide where it sits.","firing,crankfatigue"],
["crankfatigue","Crank bending fatigue","crank bending fatigue|crank fatigue","A crank bends a little with each combustion pulse. Do that millions of times and a crack grows from the fillet where a journal meets a web.","Forged and nitrided cranks resist it. It is the failure of long endurance runs rather than single pulls.","torsional,forged"],
["firing","Firing order","firing order|firing interval","The firing order is the sequence in which the cylinders fire. Even spacing gives a smooth engine; uneven spacing gives a lumpy idle and the characteristic burble.","It sets smoothness, exhaust pulse spacing and exhaust note.","crossplane,smoothness"],
["crossplane","Crossplane and flatplane","crossplane|cross-plane|flatplane|flat-plane|flat plane","A crossplane V8 crank has throws at 90 degrees, giving the deep, rumbly note and balanced shaking forces. A flatplane has all throws in one plane: revvier and lighter, with a higher-pitched sound and more vibration.","The choice changes sound, the smoothness score, and the firing pulses seen by the exhaust.","firing,smoothness"],
["smoke","Smoke limit","smoke limit|smoke|black smoke|=Smoke","The smoke limit is the least air a diesel can burn its fuel in without soot. Past it, fuel burns badly and the exhaust goes black, so the fuelling is held at a minimum lambda.","It is the real power limit of a diesel. More air (boost) lets you burn more fuel inside the limit, and market briefs cap smoke too.","lambda,egt,boost"],
["injtiming","Injection timing","injection timing|injection advance|pump timing","When in the compression stroke the diesel fuel is injected, in degrees before top dead centre. Earlier means a higher peak pressure and a hotter, noisier burn; later gives less pressure but more smoke and heat.","It is the diesel's equivalent of the ignition slider: more advance trades torque and cold-start ability against peak pressure.","mbt,pmax,cetane"],
["commonrail","Common rail","common rail|common-rail","A common-rail diesel keeps fuel at very high pressure in a shared rail, and electronic injectors open when told to. The pressure is independent of rpm, and the fuel can be split into several injections.","It makes the quiet, clean, strong diesels of the last twenty years, and good low-rpm torque.","heui,ppump,vepump"],
["heui","HEUI","=HEUI|hydraulic electronic unit injector","Hydraulic electronic unit injectors are electronically controlled injectors boosted by high-pressure engine oil. Each one multiplies the oil pressure into fuel pressure at the nozzle.","They give common-rail-style control from an older design, as on the 7.3 Power Stroke.","commonrail"],
["ppump","P-pump","P-pump|P pump|=P7100|inline pump|inline mechanical","An inline injection pump with one plunger per cylinder, driven by the engine and set by a mechanical governor. It is rugged and easy to tune for large fuel flow.","The classic pulling and high-power pump: a simple mechanism with lots of fuelling headroom.","vepump,commonrail"],
["vepump","VE pump","VE pump|rotary pump|rotary injection pump|distributor pump","A rotary distributor-type diesel injection pump: one plunger pumps for all the cylinders and a rotor spins to deal the fuel out in turn. Compact, cheap and lower in pressure.","Fine for small diesels and light duty; it caps how much fuel a build can use.","ppump"],
["nozzles","Injector nozzles and sticks","nozzles|nozzle|sticks|injector sticks|injector nozzles","The nozzle is the tip of a diesel injector, with tiny holes that atomise fuel into the cylinder. Bigger holes (pullers call a set of injectors 'sticks' by size) flow more fuel for more power and more smoke.","Nozzle size caps how much fuel can go in during the available time, and with it the power.","commonrail,smoke"],
["glow","Glow plugs","glow plugs|glow plug|intake heater|grid heater","Glow plugs are small electric heaters in each diesel cylinder that warm the chamber for starting, since cold air at the end of compression may not be hot enough to light the fuel.","They matter for the cold-start test and the cold site briefs.","coldstart,cetane"],
["coldstart","Cold start","cold start|cold-start|cold starting","Starting at low temperature is hard for any engine: fuel will not vaporise, oil is thick and the battery weak. A diesel must also get its cylinder air hot enough to ignite the fuel by compression alone.","The cold-start test and the cold site briefs check this. Compression, glow plugs, cetane and oil grade help.","glow,cetane,cloud"],
["cloud","Cloud point","cloud point|gel point|waxing","The cloud point is the temperature at which wax first appears in diesel fuel. It plugs filters well before the fuel is solid, and biodiesel clouds at a higher temperature than mineral diesel.","It is a fuel limit at cold sites; B100 is the worst case.","b100,coldstart"],
["b100","B100 (biodiesel)","=B100|biodiesel","B100 is pure biodiesel made from vegetable oil or fat. It has high cetane and lubricity but a little less energy per litre and a higher cloud point than petroleum diesel.","It starts easily and smokes less, but it gels sooner at cold sites.","cetane,cloud"],
["nitrous","Nitrous oxide","nitrous oxide|nitrous|N₂O|N2O","Nitrous oxide is a liquid that splits at combustion heat to release oxygen: by weight about 36 percent oxygen, against 23 for air. More oxygen allows more fuel burned and more power, and the evaporating liquid also chills the charge.","The game models bottle pressure, jetting, fuel match and timing. A shot too big for the engine breaks pistons faster than any other power adder.","wetdry,bottle,purge"],
["wetdry","Wet and dry nitrous","wet kit|dry kit|nitrous wet|nitrous dry|wet shot|dry shot|, wet|, dry|wet nitrous|dry nitrous","A dry kit sprays only nitrous and relies on the engine's own injectors to add fuel. A wet kit sprays fuel with the nitrous through the same plate or nozzle. In the game the kind is part of each kit's name.","A wet kit's fuel comes from its own jet, so it is easy to match to the shot but can pool in the intake; a dry kit needs the injectors and pump to keep up.","directport,progressive,nitrous"],
["directport","Direct port","direct port|direct-port|nozzle per runner","A direct-port kit has a nozzle and a fuel jet in every intake runner, so every cylinder gets an identical share. It can carry very large shots.","Even distribution is what makes 250 to 700 horsepower shots survivable.","wetdry,progressive"],
["progressive","Progressive controller","progressive|progressive controller|ramped","A progressive controller pulses the nitrous solenoids and ramps the shot in over a second or two instead of slamming it on all at once.","It lets the tyres hook up and spares the pistons the full-shot shock, which is why strong launches use it.","directport,holeshot"],
["purge","Purge","purge|nitrous purge","Purging opens the nitrous line to the air for a moment to flush out gas bubbles that formed while the car sat. This puts liquid at the solenoid so the first spray is full strength.","Skip it and the first part of the shot is weak and lean in fuel; it is also the cloud and the hiss on the line.","bottle,nitrous"],
["bottle","Bottle pressure","bottle pressure|bottle temperature|bottle heater","The vapour pressure of a nitrous bottle follows its temperature: about 900 to 1,000 psi is the target. Lower pressure delivers less nitrous through the same jets, higher delivers more.","A cold bottle makes a weak shot and an over-warm one makes a violent one. The game shows the bottle pressure and warns when it is off.","nitrous,purge"],
["twostep","Two-step","two-step|two step|2-step","A two-step is a second rev limiter, set lower than the real one, that you use only on the line. It holds rpm steady while you wait for the green.","It lets the engine sit at the rpm where boost or nitrous is ready, for a consistent launch.","launchretard,transbrake"],
["launchretard","Launch retard","launch retard|retarded timing|timing retard","On a two-step with launch retard, the ignition timing is pulled far back while holding rpm. The late burn heats the exhaust and builds boost on a turbo car without making much torque.","It spools the turbo on the line, at the cost of exhaust heat.","twostep,egt,boost"],
["transbrake","Trans-brake","trans-brake|trans brake|transbrake","A trans-brake is a transmission feature that locks the output so the car stays still in gear with the engine loaded against the converter, and releases at a button press.","The driver can hold rpm and boost at the line, and it gives the hardest, most consistent launch.","twostep,linelock,launchretard"],
["linelock","Line lock","line lock|line-lock","A line lock clamps the front brakes only, while the rear wheels spin free, so the driver can do a burnout to heat the slicks without moving the car.","Hot tyres grip better; the burnout is part of the launch in the game.","transbrake,sixty"],
["sixty","60 foot time","60 ft|60-foot|60 foot|sixty-foot","The elapsed time over the first 60 feet of the track. It is purely launch: grip, power at the line and driver, and it governs a large share of the final ET.","A tenth lost here is about a tenth to a tenth-and-a-half lost in the quarter mile.","et,holeshot,rt"],
["et","Elapsed time (ET)","=ET|elapsed time|quarter mile","Elapsed time is how long a pass takes from the car leaving the line to crossing the finish, measured at 1/8 or 1/4 mile.","It is the number the strip is judged on, and the one the career drag briefs ask for.","trap,sixty,breakout"],
["trap","Trap speed","trap speed|=Trap","The speed measured through the last stretch before the finish line. Elapsed time depends on launch and traction; trap speed depends almost purely on power and aero.","If ET is slow but trap speed is high, the car has power but lost it at the line. The reverse means it cannot pull at the top.","et,sixty"],
["rt","Reaction time","reaction time|=RT","Reaction time is the time between the last bulb lighting and the car leaving the line. Zero is a perfect launch, and a negative one is a red light foul.","On the tree it can decide close races, and nothing the engine does will repair it.","holeshot,breakout"],
["holeshot","Holeshot","holeshot|hole shot","A holeshot is winning the race by leaving the line sooner, even though the other car is quicker over the full distance.","A good reaction time can beat an engine that is a tenth quicker.","rt,et"],
["breakout","Breakout","breakout|break out|broke out","In bracket racing, running quicker than the number you dialled in is a breakout and loses the race, unless the other car did something worse.","It is why consistency matters more than outright speed there.","dialin,package"],
["dialin","Dial-in","dial-in|dial in|dial-ins","A dial-in is the elapsed time you tell the timers you expect to run. A slower car gets a head start worth the difference between dial-ins.","It lets cars of very different speeds race fairly, so the winner is the one who gets closest to the number without going under.","breakout,package"],
["package","Race package","race package|your package","The package is the whole combination: engine, converter, tyres, gearing and weight. Bracket racers tune it to run the same time every pass.","Changing any one part changes everything else, which is why a repeatable setup beats a faster, jumpier one.","dialin,breakout"],
["sled","Pulling sled","pulling sled|sled","The sled is a trailer with a heavy box that slides forward along its length as it is dragged, so the load grows the farther the truck pulls. The winner goes farthest.","The sled pull tests drag a sled down 300 feet of track; it is the whole point of the Pulling class.","weightbox,pan,fullpull"],
["weightbox","Weight box","weight box|weightbox","On a pulling sled the weight box is the heavy block that rolls toward the front as the sled moves, shifting load onto the pan and making the pull harder.","It makes the sled harder the farther you go, so late in the pull torque and traction are all that matter.","sled,pan"],
["pan","Sled pan","sled pan|drag pan|the pan","The pan is the flat skid under the front of the sled. As the weight box moves forward, it presses the pan into the dirt, so friction rises to stop the truck.","The pan is why a pull always ends: the load rises until the engine, the tyres, or both give up.","sled,weightbox"],
["fullpull","Full pull","full pull|full-pull|full 300","A full pull is dragging the sled the full 300 ft length of the track. Anyone who does that goes to a pull-off.","In the game FULL marks a completed pull; stopping short ends in a distance in feet.","pulloff,sled"],
["pulloff","Pull-off","pull-off|pull off|pulloff","If more than one truck makes a full pull, the sled is made heavier and the tied trucks go again. The winner is whoever goes farthest.","Pull-offs reward the truck that does not break after several full-power efforts.","fullpull"],
["hitch","Hitch height","hitch height|hitch|drawbar","Where the sled is attached to the truck. A high hitch lifts the front end under load, taking weight off the steering axle and helping the rear tyres by weight transfer; too high, and the truck stands up.","It is one of the main chassis settings in the game's pull setup.","slip,sled"],
["slip","Tyre slip and sweet spot","slip sweet spot|sweet spot|tyre slip|wheel slip|slip band","Slip is how much faster the tyre turns than the truck moves. A little slip gives the most traction; too much spins and digs in. The sweet spot is the narrow band where pull is greatest.","Time spent in the band is shown on the pull sheet. Gearing and throttle control keep you in it.","hitch,sled"],
["sae","SAE J1349 correction","SAE J1349|SAE|correction factor|corrected hp|corrected power","SAE J1349 is a standard formula for correcting a power reading to a reference temperature and pressure (25 °C and 99 kPa dry air), so a dyno run on a hot day can be compared with a cold one.","The dyno reports raw and SAE-corrected power. Certification and market briefs use the corrected number.","densalt"],
["densalt","Density altitude","density altitude|air density","Density altitude is the height at which standard air has the same density as today's air. Heat, humidity and elevation all thin the air and raise it.","Thin air means less oxygen and less power for an engine without boost, which is why site briefs at altitude punish naturally aspirated engines.","sae,boost"],
["warranty","Warranty claims","warranty claims|warranty claim|warranty|warranty ledger","A warranty claim is a customer sending back a failed engine within the guarantee period. In career the shop pays to put it right, and the cost comes out of your earnings.","Reliability on the dyno becomes real money here: weak engines come back, and the ledger shows each week's claims.","reliability,sitebrief"],
["sitebrief","Site brief","site brief|site briefs|site conditions","A site brief puts a requirement into a climate and altitude, such as a Yukon pickup at -25 °C or a mine at 3,500 m. Your engine is tested in those conditions, not the dyno's comfortable ones.","Cold, heat and thin air each stress different things, so one build rarely suits every site.","densalt,coldstart,warranty"],
["reliability","Reliability score","reliability","The shop's score for how much margin an engine has: how far every stress limit sits from what the engine actually does. It sets whether a build certifies and how likely it is to come back under warranty.","Most briefs ask for a minimum score, and most deliveries are priced by it.","warranty,smoothness"],
["smoothness","Smoothness","smoothness","Smoothness is the score for how little the engine shakes and how even its torque is. It depends on cylinder count, layout, firing order and balance.","Car and luxury briefs ask for smoothness; a truck brief does not care.","firing,crossplane"],
["freshen","Passes to freshen","passes to freshen|freshen-up|freshen up","Racing engines wear with every pass. 'Passes to freshen' is how many hard passes an engine can make before the teardown that replaces its parts.","Outlaw drag briefs ask for a minimum number of passes between rebuilds, which is a trade against power.","reliability,et"],
["torque","Torque and power","torque and horsepower|torque curve|power curve|torque peak","Torque is the twisting force the crank delivers; horsepower is torque times rpm, divided by a constant. An engine that holds torque to high rpm makes more power.","Diesels and trucks live on torque low down, and sports cars on horsepower high up. The dyno plots both.","bmep,ve"],
["dyno","Dynamometer","dyno|dynamometer|dyno cell","A dynamometer holds the engine against a brake and measures torque as the speed climbs. A pull is a full-throttle sweep through the rpm range.","Certification in career happens on the dyno, and the dyno's own capacity limits what you can certify.","sae,torque"],
["redline","Redline","redline|rev limit","The redline is the highest rpm the engine is set to run. Beyond it the valvetrain floats and piston speeds, rod loads and friction climb sharply.","It trades peak power rpm against the life and the valve float margin of the build.","valvefloat,pistonspeed"],
["turbine","Turbine inlet temperature","turbine temp|turbine inlet|turbine inlet temp|hot-side|hot side","The exhaust temperature at the turbine wheel. Wheels are cast iron, nickel alloys or ceramics, and each has a temperature past which it creeps and fails.","Hot-side material limits how hot the engine can run under boost.","egt,wastegate"],
["twostroke","Two-stroke","two-stroke|two-strokes|2-stroke","A two-stroke fires every cylinder on every turn of the crank. There are no intake and exhaust strokes: the piston itself uncovers ports in the cylinder wall near the bottom of its travel, the exhaust blows down, and fresh charge pushed up the transfer ports from the crankcase (or by a blower) sweeps the rest out.","Twice the power strokes and no valvetrain make it light and strong for its size; the price is the charge that escapes straight out of the exhaust, and a narrower band.","scavenge,pipe,premix"],
["scavenge","Scavenging, delivery and trapping","scavenging|delivery ratio|trapping efficiency|short-circuits|short-circuit|loop-scavenged|uniflow","Scavenging is clearing the burnt gas out of a two-stroke's cylinder with fresh charge. The delivery ratio is how much fresh charge is pushed through per swept volume; the trapping efficiency is the share of it still inside when the exhaust port closes. The rest short-circuits out of the exhaust.","Loop scavenging aims the charge away from the exhaust; uniflow (Detroit, Napier) sweeps it straight up the bore and out of valves at the top, which traps the most but needs a blower.","twostroke,pipe"],
["pipe","Expansion chamber","expansion chamber|expansion chambers|tuned pipe|on the pipe","A two-stroke exhaust built as a long diverging cone, a belly and a converging cone. The diverging cone sends back a suction wave that pulls the cylinder empty; the converging cone sends back a pressure wave that pushes escaping charge back in just before the port closes.","It only works at the rpm it is cut for, which is why a racing two-stroke 'comes on the pipe' with a hit. A hot pipe carries its waves faster, so lean running moves the tune up and rich running moves it down.","twostroke,scavenge"],
["premix","Premix","premix|premix ratio","Two-stroke oil mixed into the fuel, at ratios from about 20:1 to 100:1. On a crankcase-scavenged engine there is no oil in the crankcase; the bearings, rings and skirt are oiled by what the mixture leaves behind.","Rich ratios smoke and foul plugs; lean ones free up a little friction and then seize the piston. An oil-injection pump meters by load instead.","twostroke"],
["powervalve","Power valve","power valve|power valves|YPVS|RAVE","A guillotine or drum in a two-stroke's exhaust port that lowers the port roof at low rpm and lifts it on the pipe, so a racing port timing still pulls from low down.","It widens the band of a peaky two-stroke without giving up the top end.","pipe,twostroke"]
];
/* Known terms in the text of a few containers get a dotted underline (first use per block). Tap (or hover on desktop) for a small card.
   Never inside inputs or buttons (the stress report's open explanations excepted), and S.gloss===false turns the whole pass off. */
const GL={on:true,re:null,ci:new Map(),cs:new Map(),cache:new Map(),mo:null,pop:null,pin:false,timer:0,roots:["tab-analysis","tab-market","testExtra","verdict","stressList","sheetBody","dynoHint","ddBox","ddBar"]};
const GL_BLK="p,li,.combo,.opt,.req,.stx,.verdict,.card,.buyer,.goal,.rec,.peak,.log > div,#tele > div,#notes > div,.lbl";
const GL_ESC=s=>s.replace(/[.*+?^${}()|[\]\\\/]/g,"\\$&");
function glBuild(){const alts=new Set();GL.ci.clear();GL.cs.clear();
  GLOSSARY.forEach((g,i)=>g[2].split("|").forEach(a=>{const sens=a[0]==="=",w=sens?a.slice(1):a;if(!w)return;(sens?GL.cs:GL.ci).set(sens?w:w.toLowerCase(),i);alts.add(w);}));
  GL.re=new RegExp("(?<![\\p{L}\\p{N}_])(?:"+[...alts].sort((a,b)=>b.length-a.length).map(GL_ESC).join("|")+")(?![\\p{L}\\p{N}_])","giu");}
function glMatch(txt){let r=GL.cache.get(txt);if(r)return r;if(!GL.re)glBuild();r=[];GL.re.lastIndex=0;let m;
  while((m=GL.re.exec(txt))){let s=m.index;const w=m[0],i=GL.cs.has(w)?GL.cs.get(w):GL.ci.get(w.toLowerCase());if(i==null)continue;
    while(s<m.index+w.length&&!/[\p{L}\p{N}]/u.test(txt[s]))s++;r.push([s,m.index+w.length,i]);}
  if(GL.cache.size>5000)GL.cache.clear();GL.cache.set(txt,r);return r;}
function glScan(root){if(!GL.on||!root||!root.isConnected)return;
  if(root.nodeType===1&&root.closest("[data-nogl],#glPop,.glb,.kbd"))return;
  const bad=p=>{if(!p||p.closest(".gl,input,textarea,select,a,kbd,script,style,svg,canvas,[data-nogl],.glb,.kbd,h1,h2"))return true;const b=p.closest("button");return !!b&&!p.closest(".stx");};
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.nodeValue.length<3||n.__bar!==undefined||bad(n.parentElement)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
  const ns=[];let n;while((n=w.nextNode()))ns.push(n);if(!ns.length)return;
  const seen=new Map(),seenOf=b=>{let s=seen.get(b);if(!s){s=new Set();b.querySelectorAll(".gl").forEach(x=>s.add(+x.dataset.gi));seen.set(b,s);}return s;};
  for(const t of ns){const txt=t.nodeValue,ms=glMatch(txt);if(!ms.length||!t.parentNode)continue;const par=t.parentElement,blk=par.closest(".combo,.opt,.req,.buyer,.card,.goal,.rec,.verdict")||par.closest(GL_BLK)||par,sn=seenOf(blk);
    const use=ms.filter(m=>!sn.has(m[2])&&(sn.add(m[2]),true));if(!use.length)continue;
    const f=document.createDocumentFragment();let at=0;
    for(const [s,e,i] of use){if(s>at)f.appendChild(document.createTextNode(txt.slice(at,s)));const sp=document.createElement("span");sp.className="gl";sp.dataset.g=GLOSSARY[i][0];sp.dataset.gi=i;sp.tabIndex=0;sp.setAttribute("role","button");sp.setAttribute("aria-label",GLOSSARY[i][1]+": explain");sp.textContent=txt.slice(s,e);f.appendChild(sp);at=e;}
    if(at<txt.length)f.appendChild(document.createTextNode(txt.slice(at)));t.parentNode.replaceChild(f,t);}
  if(GL.mo)GL.mo.takeRecords();}
function glScanAll(){for(const id of GL.roots){const r=$(id);if(r)glScan(r);}}
function glUnwrap(){document.querySelectorAll(".gl").forEach(s=>s.replaceWith(document.createTextNode(s.textContent)));}
function glApply(){const on=!S||S.gloss!==false;document.querySelectorAll("#glSeg button").forEach(b=>b.classList.toggle("on",(b.dataset.gl==="1")===on));
  if(on===GL.on&&GL.mo){if(on)glScanAll();return;}GL.on=on;glPopClose();if(on){glScanAll();}else glUnwrap();}
let glQ=0;GL.q=new Set();
GL.mo=new MutationObserver(ms=>{if(!GL.on)return;for(const m of ms)for(const a of m.addedNodes){const e=a.nodeType===1?a:a.parentElement;if(e&&!e.closest(".gl"))GL.q.add(e);}
  if(GL.q.size&&!glQ)glQ=requestAnimationFrame(()=>{glQ=0;const q=[...GL.q];GL.q.clear();for(const e of q)glScan(e);});});
GL.roots.forEach(id=>{const r=$(id);if(r)GL.mo.observe(r,{childList:true,subtree:true});});
/* the card */
function glRel(g){return g[5].split(",").map(id=>GLOSSARY.find(x=>x[0]===id)).filter(Boolean);}
function glPopOpen(id,anchor,pin){const g=GLOSSARY.find(x=>x[0]===id);if(!g)return;const p=$("glPop");GL.pin=!!pin;GL.anchor=anchor;
  p.innerHTML=`<div class="gh"><b>${g[1]}</b><button class="gx" aria-label="Close">✕</button></div><p>${g[3]}</p><p class="gw"><em>Here</em> ${g[4]}</p><div class="grel">${glRel(g).slice(0,4).map(r=>`<button class="gchip" data-gj="${r[0]}">${r[1].replace(/ \(.*/,"")}</button>`).join("")}</div><button class="gmore" data-gb="${g[0]}">Open in the glossary ›</button>`;
  p.hidden=false;p.dataset.id=id;glPlace(anchor);}
function glPlace(a){const p=$("glPop");if(!a||!a.isConnected){glPopClose();return;}const app=$("app").getBoundingClientRect(),r=a.getClientRects()[0]||a.getBoundingClientRect(),w=p.offsetWidth,h=p.offsetHeight;
  let left=Math.max(8,Math.min(app.width-w-8,r.left-app.left+r.width/2-w/2)),top=r.bottom-app.top+8;if(top+h>app.height-8)top=Math.max(8,r.top-app.top-h-8);
  if(deskOn()&&a.closest("#panel")){const pl=$("panel").getBoundingClientRect();left=Math.max(8,pl.left-app.left-w-12);top=Math.max(8,Math.min(app.height-h-8,r.top-app.top-8));}   // beside the sidebar, not over the text it explains
  p.style.left=Math.round(left)+"px";p.style.top=Math.round(top)+"px";}
function glPopClose(){const p=$("glPop");if(!p)return;p.hidden=true;GL.pin=false;GL.anchor=null;clearTimeout(GL.timer);}
document.addEventListener("click",e=>{const x=e.target.closest&&e.target.closest(".gl,#glPop");if(!x)return;
  if(x.matches(".gl")){e.preventDefault();e.stopPropagation();const open=!$("glPop").hidden&&GL.anchor===x&&GL.pin;if(open)glPopClose();else glPopOpen(x.dataset.g,x,true);return;}
  const j=e.target.closest("[data-gj]"),b=e.target.closest("[data-gb]");
  if(e.target.closest(".gx")){glPopClose();return;}
  if(j){glPopOpen(j.dataset.gj,GL.anchor,true);return;}
  if(b){const id=b.dataset.gb;glPopClose();glBrowse(id);}},true);
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("glPop").hidden){glPopClose();e.stopImmediatePropagation();e.preventDefault();return;}
  if((e.key==="Enter"||e.key===" ")&&e.target.classList&&e.target.classList.contains("gl")){e.preventDefault();e.stopImmediatePropagation();glPopOpen(e.target.dataset.g,e.target,true);}},true);
document.addEventListener("pointerdown",e=>{if($("glPop").hidden)return;if(!e.target.closest(".gl,#glPop"))glPopClose();},true);
document.addEventListener("pointerover",e=>{if(e.pointerType!=="mouse")return;const a=e.target.closest&&e.target.closest(".gl");clearTimeout(GL.timer);
  if(a){if(GL.pin&&GL.anchor!==a)return;if(!$("glPop").hidden&&GL.anchor===a)return;GL.timer=setTimeout(()=>glPopOpen(a.dataset.g,a,false),230);}});
document.addEventListener("pointerout",e=>{if(e.pointerType!=="mouse"||GL.pin)return;const f=e.target.closest&&e.target.closest(".gl,#glPop");if(!f)return;const to=e.relatedTarget&&e.relatedTarget.closest&&e.relatedTarget.closest(".gl,#glPop");if(to)return;clearTimeout(GL.timer);GL.timer=setTimeout(glPopClose,260);});
$("panel").addEventListener("scroll",()=>{if(!$("glPop").hidden)glPopClose();},{passive:true});$("sheetBody").addEventListener("scroll",()=>{if(!$("glPop").hidden)glPopClose();},{passive:true});
window.addEventListener("resize",()=>{if(!$("glPop").hidden)glPlace(GL.anchor);});
$("glSeg").addEventListener("click",e=>{const b=e.target.closest("[data-gl]");if(!b)return;S.gloss=b.dataset.gl==="1";save();glApply();});
/* the browser: every term, searchable */
function glRow(g,open){return `<div class="gle${open?" open":""}" id="gle-${g[0]}"><button class="glh" data-ge="${g[0]}" aria-expanded="${!!open}"><b>${g[1]}</b><span>${g[3].split(/(?<=\.)\s/)[0]}</span></button><div class="glx"><p>${g[3]}</p><p class="gw"><em>Here</em> ${g[4]}</p><div class="grel">${glRel(g).map(r=>`<button class="gchip" data-gt="${r[0]}">${r[1].replace(/ \(.*/,"")}</button>`).join("")}</div></div></div>`;}
function glList(q,open){const t=(q||"").toLowerCase().split(/\s+/).filter(Boolean);
  const hit=GLOSSARY.filter(g=>{const hay=(g[1]+" "+g[2].replace(/[=|]/g," ")+" "+g[3]).toLowerCase();return t.every(w=>hay.includes(w));}).sort((a,b)=>a[1].localeCompare(b[1]));
  $("glList").innerHTML=hit.map(g=>glRow(g,g[0]===open)).join("")||`<p class="hint">Nothing matches “${q.replace(/[<>&]/g,"")}”. Try a shorter word.</p>`;
  $("glCnt").textContent=hit.length===GLOSSARY.length?`${GLOSSARY.length} terms`:`${hit.length} of ${GLOSSARY.length} terms`;}
function glBrowse(open){if(open===undefined&&$("sheet").classList.contains("on")&&$("sheetBody").querySelector(".glb")){closeSheet();return;}
  glPopClose();$("sheetTitle").textContent="Glossary";
  $("sheetBody").innerHTML=`<div class="glb"><input type="search" id="glQ" placeholder="Search terms: lambda, boost, sled…" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Search the glossary"><div class="hint" id="glCnt"></div><div id="glList"></div></div>`;
  $("sheet").classList.add("on");$("scrim").classList.add("on");glList("",open);
  const q=$("glQ");q.addEventListener("input",()=>glList(q.value));q.addEventListener("keydown",e=>{if(e.key==="Escape")closeSheet();});
  if(open){const el=$("gle-"+open);if(el)requestAnimationFrame(()=>el.scrollIntoView({block:"start"}));}else if(deskOn())q.focus({preventScroll:true});}
$("sheetBody").addEventListener("click",e=>{const h=e.target.closest(".glb [data-ge]"),c=e.target.closest(".glb [data-gt]");
  if(h){const r=h.parentElement,on=!r.classList.contains("open");r.classList.toggle("open",on);h.setAttribute("aria-expanded",on);return;}
  if(c){const id=c.dataset.gt;$("glQ").value="";glList("",id);const el=$("gle-"+id);if(el)el.scrollIntoView({block:"start"});}});
$("glOpen").addEventListener("click",()=>glBrowse());

/* ---- guided lessons: the tour's spotlight, a sandbox rig, and the player's own build put back afterwards ---- */
const LESSONS=[
 {id:"diesel",name:"Diesel 101",sub:"compression, smoke limit, fuel system",preset:"c59_12v",env:{testType:"pull"},steps:[
  {tab:"build",sel:".strip",title:"No spark, just heat",text:"This is a 5.9 litre inline-six diesel. It has no spark plugs: it squeezes air until it is hot enough to light the fuel the instant it is sprayed in. Everything on these steps follows from that."},
  {tab:"build",sel:"#r-cr",up:1,lbl:1,title:"Compression ratio",text:"A diesel runs 14 to 24:1. Higher compression lights the fuel more easily and extracts more work, but it raises cylinder pressure and stress on the block."},
  {tab:"build",sel:"#r-lambda",up:1,lbl:1,title:"The smoke limit",text:"A diesel always runs with spare air. Lambda here is the full-load mixture: push it lower for more fuel and power, and the exhaust turns black. The market has smoke caps."},
  {tab:"build",sel:'[data-k="dInj"]',up:1,lbl:1,title:"How the fuel arrives",text:"Rotary VE pump, inline P-pump, HEUI or common rail. Each trades cost and simplicity against pressure and control. Nozzle size caps how much fuel can go in."},
  {tab:"build",sel:"#r-timing",up:1,lbl:1,title:"Injection timing",text:"When the fuel is injected before top dead centre. Earlier is more peak pressure and a harder knock; later cuts pressure but raises smoke and exhaust heat."},
  {tab:"build",sel:'[data-k="asp"]',up:1,lbl:1,title:"Air is power",text:"Fit a turbo and more fuel fits inside the smoke limit. Diesels spool early because they push full exhaust flow with no throttle, which is why they love boost."},
  {tab:"test",sel:"#rlRun",title:"Run it on the dyno",text:"Arm the dyno and pull. The torque curve of a diesel peaks low and is flat. Check the stress report afterwards: peak cylinder pressure and exhaust temperature are the first limits."},
  {tab:"analysis",sel:"#tele",title:"Read the telemetry",text:"Analysis shows cetane instead of octane, smoke, peak cylinder pressure and the temperatures. Cold sites need glow plugs and good cetane for the cold start."}]},
 {id:"nitrous",name:"Nitrous 101",sub:"kits, bottle, timing, the line",preset:"n2o632",env:{testType:"drag"},steps:[
  {tab:"build",sel:'[data-k="nitrous"]',up:1,lbl:1,title:"A bottle of oxygen",text:"Nitrous oxide splits in the cylinder and gives up extra oxygen, so more fuel burns. Dry kits add nitrous only, wet kits add their own fuel, direct port feeds every runner, and a progressive controller ramps the shot in, as on this 632 big-block."},
  {tab:"build",sel:'[data-info="fuel"]',up:1,title:"Octane matters more",text:"The extra oxygen makes the cylinder hotter and faster, so knock margin gets thin. High-octane or alcohol fuel protects pistons that a shot would otherwise melt."},
  {tab:"build",sel:"#r-timing",up:1,lbl:1,title:"Retard the timing",text:"Nitrous burns fast. Pull a few degrees of ignition timing back for a bigger shot. The Detonation margin test in the stress report shows whether you went far enough."},
  {tab:"build",sel:'[data-k="launchCtl"]',up:1,lbl:1,title:"Launch control",text:"A two-step holds rpm on the line, launch retard builds boost while holding it, and a trans-brake keeps the car still until you release. They are strip-only and add no power by themselves."},
  {tab:"events",sel:'#evPick [data-t="drag"]',title:"Take it to the strip",text:"Events holds the strip, the sled, the salt, the road and the 24 Hours. Drag strip is the 1/4 mile. Your nitrous kit only arrives when the throttle is wide open, and it comes on at the point you choose below."},
  {tab:"events",sel:'#envBox [data-ek="n2oHeater"]',up:1,lbl:1,title:"Bottle pressure and purge",text:"The shot is jetted for about 950 psi, so a heater keeps passes the same. On the line, hold PURGE (or press P) until it spits white so the first spray is liquid."},
  {tab:"events",sel:"#runTest",title:"Stage and launch",text:"Stage the car and launch on the green. A strong launch counts for more than top-end power, and a shot that comes on too early only spins the tyres."},
  {tab:"events",sel:"#dynoHint",title:"Read the timing slip",text:"After a pass, the slip lists reaction time, 60 ft, the eighth and quarter mile ET with trap speed. If the 60 ft is slow but the trap speed is high, the power is there and the launch is the problem."}]},
 {id:"pulling",name:"Pulling 101",sub:"the sled, hitch, tyres and throttle",preset:"smoker26",env:{testType:"pull_sled"},steps:[
  {tab:"events",sel:'#evPick [data-t="pull_sled"]',title:"The sled pull",text:"Truck pull lives on the Events tab. A truck drags a sled down 300 feet of dirt. A heavy box slides forward as it goes, pressing the sled's pan into the track, so the load grows every foot. Farthest wins; a full pull gets a pull-off."},
  {tab:"events",sel:'#envBox [data-pk="pullCls"]',up:1,lbl:1,title:"Pick a class",text:"Each class has its own weight limit, tyres and rules. Your build has to be legal for the class, and the legal line is shown under each button."},
  {tab:"events",sel:'#envBox [data-pk="pullGear"]',up:1,lbl:1,title:"Choose a gear",text:"A tall gear carries speed into the heavy end of the track; a short one gives more pull but digs the tyres if you stay flat on it."},
  {tab:"events",sel:'#envBox [data-pk="pullTyre"]',up:1,lbl:1,title:"Tyres and slip",text:"Some slip is good: there is a sweet spot where the tyres pull hardest. Too little and the engine bogs, too much and the tyres dig a hole. The pull sheet reports the time you spent in that band."},
  {tab:"events",sel:"#er-pullHitch",up:0,wrap:".envgrid",title:"Hitch height and ballast",text:"Under Advanced. A higher hitch plants the rear tyres but lifts the nose. Past a point the front hops and grip goes with it. Weight on the front bracket holds the nose down."},
  {tab:"build",sel:'[data-k="dNoz"]',up:1,lbl:1,title:"Fuel and sticks",text:"Pulling diesels live on large injector nozzles and compound turbos. The smoke limit is not a rule here; the limits are cylinder pressure, the head gasket and the pump."},
  {tab:"events",sel:"#runTest",title:"Hold the throttle",text:"Start the pull and hold the button (or Space) for throttle. Ease off when the tyres spin to stay in the sweet spot; the engine must keep pulling as the sled gets heavier."},
  {tab:"events",sel:"#dynoHint",title:"Read the pull sheet",text:"The sheet lists distance, setup, tyre slip and the reasons the pull ended. If the truck stopped bogged, you need torque or gear; if it spun, you need grip or less throttle."}]},
 /* the Events lessons below: Setup controls show by default; Advanced ones are revealed by accReveal (tab + section). "#dynoHint,#verdict" = whichever result block is showing */
 {id:"bracket",name:"Bracket night 101",sub:"dial-in, breakouts, tyres, the tree",preset:"sbc350",env:{testType:"drag",dragFmt:"bracket",dragQuick:true},steps:[
  {tab:"events",sel:'#evPick [data-t="bracket"]',title:"Consistent beats quick",text:"Bracket racing is not won by the fastest car. Before the round you dial in the ET you expect. The slower dial leaves first, and the first car to the stripe wins, unless it ran quicker than its dial. That is a breakout, and it loses."},
  {tab:"events",sel:'#envBox [data-ek="dragFmt"]',up:1,lbl:1,title:"Three ways to race",text:"Test & tune is one pass. Eliminations is a heads-up ladder where a quick light beats a quick car. Bracket is the dial-in night. The Bracket night tile above skips the time trials and goes straight to round one, up to three rounds."},
  {tab:"events",sel:'#envBox [data-ek="tyre"]',up:1,lbl:1,title:"Grip is repeatability",text:"Street radial, drag radial or slick. A tyre that spins one pass in three gives you a different ET each round, and your dial is worthless. Pick the grip that lets the car do the same thing every time."},
  {tab:"events",sel:"#er-launchRpm",wrap:".env",title:"Launch rpm",text:"Where the clutch lets go. Too high and the tyres spin, too low and the engine bogs. You are chasing a number you can repeat, so find a launch rpm you can hit every pass."},
  {tab:"events",sel:'#envBox [data-ek="dragDrive"]',up:2,title:"You drive, or Auto",text:"Auto stages and leaves on the green with a good, human light, and drives every pass of the night. Drive it yourself and you tap on the green of your own tree, because the slower dial leaves first."},
  {tab:"events",sel:"#er-mass",wrap:".env",title:"Weight",text:"Under Advanced, in Car. Car weight and the rear weight split both change the ET. For a dial it matters less how light the car is than that it stays the same between rounds."},
  {tab:"events",sel:"#er-tyrePsi",wrap:".env",title:"Pressure and shocks",text:"Under Advanced, in Driveline. Tyre pressure and the shocks are what a tuner changes between rounds: soft shocks bite harder and lift the nose, firm ones keep it flat but may spin."},
  {tab:"events",sel:"#runTest",title:"Enter the night",text:"Tap to enter. Leave on the green of your own tree. A red light loses outright, and running quicker than your dial is a breakout. Entry is free in the sandbox."},
  {tab:"events",sel:"#dynoHint,#verdict",title:"Read the slip",text:"After each round the slip shows your ET against your dial, your rival's ET and dial, and who went through. Ran a hair over your dial is a good round. Ran under it, and you broke out and lost, however quick it was."}]},
 {id:"salt",name:"Salt flats 101",sub:"thin air, gearing, body, chutes",preset:"2jzgte",env:{testType:"salt"},steps:[
  {tab:"events",sel:'#evPick [data-t="salt"]',title:"A mile at full speed",text:"Salt flats is a top-speed run. You roll to the line, push off, and hold the throttle while the clocks time one mile that starts well down the course. Salt grips about half as well as a prepped strip, so the wheels let go early."},
  {tab:"events",sel:"#envBox>p.hint",title:"Thin air costs power",text:"Bonneville is high and warm, so the engine makes less than it did on the dyno. A boosted engine gets most of it back. A naturally aspirated one does not."},
  {tab:"events",sel:'#envBox [data-sk="saltBody"]',up:1,lbl:1,title:"Pick a body",text:"From the altered, with its street body and big radiator, to the streamliner with its wheels enclosed. Less drag is more top speed, but the streamliner is the twitchy one."},
  {tab:"events",sel:'#envBox [data-sk="saltCourse"]',up:1,lbl:1,title:"Short or long course",text:"The short course has a one-mile run-up and the long one four. A longer run-up gives the car more road to climb to its top speed before the clocks start."},
  {tab:"events",sel:"#er-saltTop",wrap:".env",title:"Top gear",text:"Under Advanced, in Gearing. This is the road speed at redline in top gear. Too short and you hit the limiter early. Too tall and the engine never reaches its power. The Suggest gearing button below it picks one for this engine and body."},
  {tab:"events",sel:'#envBox [data-sk="saltChute"]',up:1,lbl:1,title:"The parachute",text:"Under Advanced, in Body. With no chute the tech inspector caps you at 175 mph. A single chute is rated for 300, and a drogue plus main chute for 503. Fit what the speed you expect needs."},
  {tab:"events",sel:"#runTest",title:"Roll to the line",text:"Hold the button for the push, then keep holding for throttle. Let go to feather it if the wheels spin. The chute comes out after the timed mile."},
  {tab:"events",sel:"#dynoHint,#verdict",title:"Read the run",text:"The result shows your speed through the timed mile and how the run ended. If it topped out on the limiter, gear taller. If it was still climbing at the clocks, try the long course. If it spun, ease the throttle."}]},
 {id:"bog",name:"Mud bog 101",sub:"class, torque, gear, wheelspin",preset:"godzilla73",env:{testType:"bog"},steps:[
  {tab:"events",sel:'#evPick [data-t="bog"]',title:"Through, or stuck",text:"Mud bog is a truck and a pit of mud. If you get through, the stopwatch scores the time. If you stick, the distance you reached is your score. The wheels have to keep turning."},
  {tab:"events",sel:'#envBox [data-bk="bogCls"]',up:1,lbl:1,title:"Pick a class",text:"Street 4×4, Modified or Open. Each is a different truck with its own tyres, drivetrain and weight, and the line under the buttons says what you have."},
  {tab:"build",sel:'[data-k="asp"]',up:1,lbl:1,title:"Torque, not top speed",text:"The pit loads the wheels hard at low speed, so what counts is torque at low revs. Big displacement or boost holds the engine up in its band when the mud grabs the tyres."},
  {tab:"events",sel:'#envBox [data-bk="bogGear"]',up:1,lbl:1,title:"Choose a gear",text:"Under Advanced. A tall gear carries more speed into the mud but bogs sooner in the deep end. A short gear keeps the engine up in its band, and spins the wheels more easily."},
  {tab:"events",sel:'#envBox [data-bk="bogTyre"]',up:1,lbl:1,title:"Tyres",text:"Under Advanced. Lugs bite, then the clay packs into them and they stop biting. Sticky clay grabs a slow tyre and packs it solid, so speed through the pit keeps the lugs clean."},
  {tab:"events",sel:"#runTest",title:"Hold for throttle",text:"Carry speed off the run-up, then keep the wheels turning in the mud. A little wheelspin cleans the lugs, too much digs a hole. Hold the button (or Space) for throttle and let go to feather."},
  {tab:"events",sel:"#dynoHint,#verdict",title:"Read the run",text:"A run that stuck early needs a shorter gear or less wheelspin. A truck that dug a hole needed the throttle feathered. A clean run through is scored on time, so a taller gear is the next thing to try."}]},
 {id:"boat",name:"Boat drags 101",sub:"class, prop pitch, gear, trim",preset:"merc25",env:{testType:"boat"},steps:[
  {tab:"events",sel:'#evPick [data-t="boat"]',title:"1,000 feet of river",text:"Boat drags are heads-up over a thousand feet of water. Wait for the green, then hold for throttle. The engine turns a prop, and a prop slips, so it behaves nothing like a car."},
  {tab:"events",sel:'#envBox [data-tk="boatCls"]',up:1,lbl:1,title:"Pick a class",text:"A stock outboard V-bottom, a jet boat with a pump instead of a prop, a blown Pro Eliminator or a Top Fuel hydro. The class sets the hull, the drive and the limit on the engine."},
  {tab:"events",sel:"#er-boatPitch",wrap:".env",title:"Prop pitch",text:"Under Advanced. Pitch is how far one turn of the prop would push the boat with no slip. More pitch is more top speed and more load, so the engine revs lower and the prop slips more off the line."},
  {tab:"events",sel:"#er-boatGear",wrap:".env",title:"Lower-unit gear",text:"Under Advanced. The gear in the lower unit turns engine revs into prop revs. It works against pitch: between them they decide where the engine sits in its rev range down the course."},
  {tab:"events",sel:"#er-boatTrim",wrap:".env",title:"Trim at the start",text:"Under Advanced. Trim in (negative) to get over the hump, then out once the hull is on the plane. Too far out and the boat porpoises, walks, or blows over."},
  {tab:"events",sel:"#runTest",title:"Wait for the green",text:"Enter the drags, wait for the green, then hold for throttle. If the prop blows out off the line, feather it. Trim in for the hump and out once the boat is planing."},
  {tab:"events",sel:"#dynoHint,#verdict",title:"Read the pass",text:"The result shows your time over the course. A lazy start with a strong finish usually means too much pitch for the launch. A quick start that stops pulling means too little. Change one thing and run again."}]},
 {id:"road",name:"Road test 101",sub:"tyres, circuit, chassis, final drive",preset:"k20a",env:{testType:"road"},steps:[
  {tab:"events",sel:'#evPick [data-t="road"]',title:"Your engine in a car",text:"The road test puts your engine into the chassis you pick. It measures 0–100, the quarter mile, 80–120 and top speed on a straight, then runs one flying lap of the circuit and plays it back."},
  {tab:"events",sel:'#envBox [data-rk="roadTyre"]',up:1,lbl:1,title:"Tyres",text:"Eco, street, sport and semi-slick. The number is the grip, so more of it means a quicker corner and a better launch. Sport is the stock fitment."},
  {tab:"events",sel:'#envBox [data-rk="roadTrk"]',up:1,lbl:1,title:"Pick a circuit",text:"Coulee Park is short and tight, Prairie Sky Raceway is long with 12 turns, and Grain Exchange is a walled downtown street circuit that rewards torque and brakes. The same car laps differently on each, and each keeps its own best."},
  {tab:"events",sel:'#envBox [data-rk="roadCh"]',up:1,lbl:1,title:"Pick the chassis",text:"Under Advanced, in Chassis. A 1,000 kg roadster, a front-drive hatch, a muscle car, a pickup. The line under it says what the engine adds and how the weight balances front to back."},
  {tab:"events",sel:"#er-suSt",wrap:".su-grid",title:"Springs and wing",text:"Under Advanced, in Suspension. Stiffer at one end and that end loses grip first: a stiff front pushes wide, a stiff rear comes round. A steeper wing adds downforce, and top speed pays for it."},
  {tab:"events",sel:"#er-roadFinal",wrap:".env",title:"Final drive",text:"Under Advanced, in Drive & view. A shorter ratio pulls harder out of corners. A taller one runs out the straight. The line under the chassis shows where top gear lands against the power peak."},
  {tab:"events",sel:"#runTest",title:"Roll out",text:"Start the test. The straight-line runs happen first, then the lap. Space skips the lap playback if you only want the numbers."},
  {tab:"events",sel:"#dynoHint,#verdict",title:"Read the lap",text:"The straight-line numbers show whether the engine is strong. The lap shows whether the car can use it. A quick straight with a slow lap points at grip or balance, not power."}]},
 {id:"hill",name:"Pikes Peak 101",sub:"thin air, class, tyres, final drive",preset:"4g63",env:{testType:"hill"},steps:[
  {tab:"events",sel:'#evPick [data-t="hill"]',title:"Up the mountain",text:"Pikes Peak is a 19.99 km hill climb with 156 turns. It runs from 2,862 m to 4,302 m, so the air gets steadily thinner as you climb and the engine gets weaker."},
  {tab:"events",sel:"#envBox>p.hint",title:"The power you lose",text:"This line shows what the engine makes at the shop, at the start line and on the summit. An atmospheric engine's power follows the air down. Boost holds more of it."},
  {tab:"events",sel:'#envBox [data-hk="hillCls"]',up:1,lbl:1,title:"Pick a class",text:"Open is a street car on street tyres with no aero. Time Attack adds semi-slicks and a wing. Pikes Peak Open and Unlimited allow slicks and big aero."},
  {tab:"events",sel:'#envBox [data-hk="hillTyre"]',up:1,lbl:1,title:"Tyres",text:"The tyres on offer depend on the class. Grip decides how hard you can push through the 156 turns. In You drive, dusty corners want a LIFT."},
  {tab:"events",sel:'#envBox [data-hk="hillCh"]',up:1,lbl:1,title:"Pick the car",text:"Under Advanced, in Car. A 1,000 kg roadster up to a 2,100 kg pickup, with rear, front or all-wheel drive. The line at the top of Setup updates with its weight and gearing."},
  {tab:"events",sel:"#er-hillFinal",wrap:".env",title:"Final drive",text:"Under Advanced, in Drive & view. A shorter ratio pulls harder out of the many slow corners. A taller one runs out of revs on the fast sections. The line at the top of Setup shows the speed it is geared for."},
  {tab:"events",sel:"#runTest",title:"To the line",text:"Start the climb. Auto reads the corner calls for you. In You drive, hold PUSH into grippy corners and LIFT into dusty ones. Too fast is a moment, or a trip through the gravel."},
  {tab:"events",sel:"#dynoHint,#verdict",title:"Read the climb",text:"The result shows your time for the climb. If the engine is weak up high, boost or a shorter gear helps. If you lose time in the corners, look at the tyres, the car and the suspension."}]},
 {id:"oval",name:"Dirt oval 101",sub:"class, one gear, tyres, grille",preset:"sbc350",env:{testType:"oval"},steps:[
  {tab:"events",sel:'#evPick [data-t="oval"]',title:"Heat race, then feature",text:"Dirt oval is a heat race and then the feature. The clay starts tacky and dries out slick as the laps pile up, and the rivals' lap times come from the same sim you drive."},
  {tab:"events",sel:'#envBox [data-ok="ovalCls"]',up:1,lbl:1,title:"Class by cubic inches",text:"Street Stock takes up to 360 ci, Late Model up to 430, and Open has no limit. Your engine's size decides which class it can enter."},
  {tab:"events",sel:"#er-ovalFinal",wrap:".env",title:"One gear",text:"Under Advanced, in Rear end. The car has no gearbox to speak of: engine speed is road speed times the rear end. The corner exit wants torque, not peak power. A taller ratio trades exit for the straight."},
  {tab:"events",sel:'#envBox [data-ok="ovalTyre"]',up:1,lbl:1,title:"Tyres and the clay",text:"Soft tyres bite early and fade late. Hard ones last and bite less. The track dries out as the laps pile up, so match the tyre to how long the race is."},
  {tab:"events",sel:'#envBox [data-ok="ovalGrille"]',up:1,lbl:1,title:"Grille",text:"Under Advanced. An open grille cools best but adds drag and clogs with dirt. Taping it up is slippery on the straight, and the engine runs hot."},
  {tab:"events",sel:"#runTest",title:"Take the green",text:"Hold PUSH to attack and SAVE to cool the engine and the tyres. Space pushes. If the heat is already safe, save the engine for the feature."},
  {tab:"events",sel:"#dynoHint,#verdict",title:"Read the night",text:"The heat sets the feature grid, so a good heat gets you a good start. Watch the lap times fall off as the tyres fade and the clay dries. That is when to SAVE."}]},
 {id:"race24",name:"24 Hours 101",sub:"circuit, engine mode, stints, tyres",preset:"gt3r",env:{testType:"race24"},steps:[
  {tab:"events",sel:'#evPick [data-t="race24"]',title:"A day and a night",text:"The 24 Hours puts your engine in the road-test car against twenty others in three classes. A full day and night runs in accelerated time. Pace matters, and so does making it to the end."},
  {tab:"events",sel:'#envBox [data-e24k="e24Trk"]',up:1,lbl:1,title:"Pick a circuit",text:"Coulee Park is a short-course 24. Prairie Sky Raceway is the 24 Hours itself, on a 4.48 km lap."},
  {tab:"events",sel:'#envBox [data-e24k="e24Mode"]',up:1,lbl:1,title:"Engine mode",text:"Push uses everything the engine has. Race short-shifts at 96% torque. Conserve cruises lean at 92%. Over a whole day, the gentler modes are how an engine lasts."},
  {tab:"events",sel:'#envBox [data-e24k="e24Stint"]',up:1,lbl:1,title:"Stint length",text:"How long a driver stays out between stops: to the fuel, 45, 60 or 90 minutes. Short stints are light, but every stop costs time in the pits."},
  {tab:"events",sel:'#envBox [data-e24k="e24Tyre"]',up:1,lbl:1,title:"Tyres",text:"Soft is 3.5% quicker and lasts 170 km. Medium is the base and lasts 270. Hard is 3.5% slower and lasts 420. The longer the stint, the more a hard tyre is worth."},
  {tab:"events",sel:'#envBox [data-e24k="e24Fuel"]',up:1,lbl:1,title:"Fuel at the stops",text:"Under Advanced. A full tank is 100 L and goes further. Just enough for the stint is lighter, so the car is quicker."},
  {tab:"events",sel:'#envBox [data-e24k="e24Chg"]',up:1,lbl:1,title:"Tyre changes",text:"Under Advanced. Fresh rubber at every stop, or a double stint that skips the change at every other stop and saves 22 seconds. It pays only if the tyre can last."},
  {tab:"events",sel:"#runTest",title:"Take the green",text:"Set the strategy, then start. Watch it at 1× or time-lapse to the next event."},
  {tab:"events",sel:"#dynoHint,#verdict",title:"Read the result",text:"The result ranks the car among the twenty. If it lost places in the night, look at the engine mode and the tyres. If the engine failed, back off the mode."}]}
];
let LS=null;
const LS_WALK=["#modeBox button","#replayTour","#resetGame","#foreclose [data-restart]","#slots button","#importSave","#exportSave"].join(",");
function lsEl(st){const all=document.querySelectorAll(st.sel);let el=[...all].find(e=>e.offsetParent)||all[0];if(!el)return null;if(st.wrap)el=el.closest(st.wrap)||el;for(let i=0;i<(st.up||0)&&el.parentElement;i++)el=el.parentElement;return el;}
function lsRect(st){const el=lsEl(st);if(!el||!el.offsetParent&&getComputedStyle(el).position!=="fixed")return null;let r=el.getBoundingClientRect();
  if(st.lbl&&el.previousElementSibling&&el.previousElementSibling.classList.contains("lbl")){const a=el.previousElementSibling.getBoundingClientRect();r={left:Math.min(a.left,r.left),right:Math.max(a.right,r.right),top:a.top,bottom:r.bottom,width:0,height:0};r.width=r.right-r.left;r.height=r.bottom-r.top;}
  return r.width&&r.height?r:null;}
function lsPlace(){if(!LS)return;const st=LS.L.steps[LS.i];if(!st)return;const app=$("app").getBoundingClientRect(),spot=$("lesSpot"),box=$("lesBox"),tabT=tabsTop()-app.top;let r=lsRect(st);
  if(r){const pr=$("panel").getBoundingClientRect(),fixed=st.sel==="#dragBtn"||st.sel==="#pullBtn"||!$("panel").contains(lsEl(st));const top=fixed?r.top:Math.max(r.top,pr.top),bot=fixed?r.bottom:Math.min(r.bottom,app.top+tabT);r=bot-top>=Math.min(28,r.height*0.5)?{left:r.left,width:r.width,top,bottom:bot,height:bot-top}:null;}
  const boxH=box.offsetHeight||150;
  if(r){spot.style.display="";spot.style.left=(r.left-app.left-6)+"px";spot.style.top=(r.top-app.top-6)+"px";spot.style.width=(r.width+12)+"px";spot.style.height=(r.height+12)+"px";
    const below=r.bottom-app.top+14,above=r.top-app.top-14-boxH;const top=below+boxH<tabT-8?below:above>=8?above:null;
    if(top!=null){box.style.top=top+"px";box.style.bottom="auto";}else{box.style.top="auto";box.style.bottom=(app.height-tabT+10)+"px";}}
  else{spot.style.display="none";box.style.top="auto";box.style.bottom=(app.height-tabT+10)+"px";}
  deskBox(box,r);}
function lsShow(i){if(!LS)return;LS.i=i;const L=LS.L,st=L.steps[i];if(!st){lsEnd(false);return;}glPopClose();
  if((st.tab==="test"||st.tab==="events")&&S.env.testType!==L.env.testType&&!testing)pickTest(L.env.testType);
  if(curTab!==st.tab)showTab(st.tab);
  accReveal(document.querySelector(st.sel));anaReveal(document.querySelector(st.sel));
  const last=i===L.steps.length-1;
  $("lesStep").textContent=`${L.name} · ${i+1} of ${L.steps.length}`;$("lesTitle").textContent=st.title;$("lesText").textContent=st.text;
  $("lesSkip").style.display=last?"none":"";$("lesKeep").style.display=last?"":"none";$("lesNext").textContent=last?"Back to my engine":"Next";
  glScan($("lesText"));
  const t2=lsEl(st)||document.querySelector(st.sel);if(t2&&$("panel").contains(t2)&&st.sel.charAt(0)!=="."){setTimeout(()=>{if(!LS||LS.i!==i)return;const pr=$("panel").getBoundingClientRect(),tr=(lsRect(st)||t2.getBoundingClientRect());$("panel").scrollTop+=(tr.top-pr.top)-pr.height*0.32;lsPlace();setTimeout(lsPlace,380);setTimeout(lsPlace,700);},60);}
  requestAnimationFrame(()=>requestAnimationFrame(lsPlace));}
function lsAsk(id){const L=LESSONS.find(x=>x.id===id);if(!L||LS)return;const car=career();
  $("sheetTitle").textContent=L.name;
  $("sheetBody").innerHTML=`<p class="hint" style="margin-top:0">${L.name} runs in the test cell on a scratch engine${car?", so you will switch out of Career for a few minutes. Your shop, cash and contracts are not touched":""}. Your current build is saved first and put back when you finish or skip${car?" and you return to Career":""}. You can also keep the lesson's engine at the end.</p><div class="row" style="margin-top:12px"><button class="btn sm ghost" id="lesCancel" style="flex:1">Not now</button><button class="btn pri" id="lesGo" style="flex:2">Start ${L.name}</button></div>`;
  $("sheet").classList.add("on");$("scrim").classList.add("on");
  $("lesCancel").addEventListener("click",closeSheet);$("lesGo").addEventListener("click",()=>{closeSheet();lsStart(id);});}
function lsMenu(){$("sheetTitle").textContent="Lessons";
  $("sheetBody").innerHTML=`<p class="hint" style="margin-top:0">Short guided tours of the real controls. Each runs on a scratch engine and puts your own build back when it ends. Skip any time.</p>`+LESSONS.map(L=>`<div class="opt les"><div class="lsx"><div class="oh"><b>${L.name}</b><span class="tag">${L.steps.length} steps</span></div><p>${L.sub}</p></div><button class="btn sm pri" data-les="${L.id}">${S.lessonsDone&&S.lessonsDone[L.id]?"Replay":"Start"}</button></div>`).join("");
  $("sheet").classList.add("on");$("scrim").classList.add("on");}
function lsStart(id){if(LS||(typeof ff!=="undefined"&&ff))return;if(S.bay){toast("Hand the dyno-day engine back first");return;}if(testing){toast("Let the dyno finish first");return;}
  const L=LESSONS.find(x=>x.id===id),p=PRESETS.find(x=>x.id===L.preset);if(!L||!p)return;closeSheet();if(tourStep>=0){tourStep=-1;$("tour").hidden=true;}
  LS={L,i:0,to:S.mode||"sandbox",back:{picks:[S.evPick,S.testPick],evTab:S.evTab,advSec:S.advSec,cfg:S.cfg,env:S.env,profileId:S.profileId,name:S.name,last:S.last,tab:curTab,idle:run.idle,sound:S.sound,tabs:Object.assign({},tabScroll,{[curTab]:$("panel").scrollTop})}};tabScroll.build=0;
  S.cfg=Object.assign({},SIM.DEFAULT_CFG,p.cfg,L.cfg||{});S.env=Object.assign({},SIM.DEFAULT_ENV,L.env);S.profileId=p.soundProfile;S.name=p.name;S.last=null;curTab="build";resetBase();
  if(S.mode!=="sandbox"){S.mode="sandbox";boot();}else{afterCfgChange(true);hud();showTab("build");}
  $("les").hidden=false;lsShow(0);}
function lsEnd(keep){if(!LS)return;if(testing){toast("Let the dyno finish first");return;}const f=LS;LS=null;$("les").hidden=true;const b=f.back;
  if(f.i>=f.L.steps.length-1){S.lessonsDone=Object.assign({},S.lessonsDone,{[f.L.id]:true});}
  const mine={cfg:S.cfg,env:S.env,profileId:S.profileId,name:S.name};
  run.idle=b.idle;$("idleBtn").classList.toggle("on",run.idle);
  if(b.picks){S.evPick=b.picks[0];S.testPick=b.picks[1];}
  if(!keep){S.evTab=b.evTab;S.advSec=b.advSec;}   // the lesson opened Advanced panes on the scratch engine: put the player's tab choices back
  Object.assign(S,keep?{cfg:mine.cfg,env:mine.env,profileId:mine.profileId,name:mine.name,last:null}:{cfg:b.cfg,env:b.env,profileId:b.profileId,name:b.name,last:b.last},{mode:f.to});curTab=keep?"build":b.tab;
  let note=keep?"Kept the lesson engine":"Your build is back";
  if(career()&&presetLocked(S.cfg)){S.cfg=b.cfg;S.env=b.env;S.profileId=b.profileId;S.name=b.name;S.last=b.last;note=keep?"Career bay can't fit that engine yet. Your own build is back":note;keep=false;curTab=b.tab;}
  if(S.sound!==b.sound){S.sound=b.sound;$("sndBtn").classList.toggle("on",S.sound);if(!S.sound)ENGINE_SOUND.stop();}
  resetBase();save();boot();if(!keep){Object.assign(tabScroll,b.tabs);$("panel").scrollTop=b.tabs[curTab]||0;}toast(note);}
function lsSafeSave(){if(!LS)return;const keep={mode:S.mode,cfg:S.cfg,env:S.env,profileId:S.profileId,name:S.name,last:S.last,sound:S.sound},b=LS.back;
  Object.assign(S,{mode:LS.to,cfg:b.cfg,env:b.env,profileId:b.profileId,name:b.name,last:b.last,sound:b.sound});save();Object.assign(S,keep);}
$("lesNext").addEventListener("click",()=>{if(!LS)return;if(LS.i>=LS.L.steps.length-1)lsEnd(false);else lsShow(LS.i+1);});
$("lesSkip").addEventListener("click",()=>lsEnd(false));$("lesKeep").addEventListener("click",()=>lsEnd(true));
$("lessonsOpen").addEventListener("click",lsMenu);
$("sheetBody").addEventListener("click",e=>{const b=e.target.closest("[data-les]");if(b)lsAsk(b.dataset.les);});
[$("panel"),$("setPane")].forEach(el=>el.addEventListener("click",e=>{if(!LS)return;const b=e.target.closest(LS_WALK);if(!b)return;if(testing){e.stopPropagation();toast("Let the dyno finish first");return;}lsEnd(false);},true));
document.addEventListener("visibilitychange",()=>{if(document.hidden)lsSafeSave();});window.addEventListener("pagehide",lsSafeSave);
window.addEventListener("resize",()=>{if(LS)lsPlace();});$("panel").addEventListener("scroll",()=>{if(LS)lsPlace();},{passive:true});
/* ===== HELP (v1.66 UI cleanup): long explainer text folds to a one-line summary + an ⓘ that opens the full text =====
   moreI(full)/hintMore(summary,full) build the markup by hand; hfFold() does it for any long .hint (and the Shop's one-line card blurbs)
   on the Test/Events/Analysis/Market/Shop pages: summary = the first sentence (cut short at a clause if it runs long), the ⓘ holds the whole
   original text. A MutationObserver folds whatever those pages re-render, so JS-built text needs no per-site change. Build, the settings pane
   and sheets are not observed. CSS: css/ui-help.css. */
function moreI(full,label){return `<details class="more"><summary aria-label="${label||"More info"}">ⓘ</summary><div>${full}</div></details>`;}
function hintMore(sum,full,attrs){return `<div class="hint hmx"${attrs?" "+attrs:""}><span class="hms">${sum}</span>${moreI(full)}</div>`;}
/* [summary html, true] for html whose first sentence (at tag depth 0) ends before the last ~16 characters, or whose first sentence is over max */
function hfCut(html,max,ms){ms=ms||34;
  const n=html.length;let depth=0,txt=0,sent=-1,soft=-1,softT=0,sentT=0;
  for(let i=0;i<n;i++){const ch=html[i];
    if(ch==="<"){const j=html.indexOf(">",i);if(j<0)break;const tag=html.slice(i+1,j);if(tag[0]==="/")depth--;else if(!/\/$|^(br|img|input|hr|wbr)\b/i.test(tag))depth++;i=j;continue;}
    if(ch==="&"){const j=html.indexOf(";",i);if(j>0&&j-i<8){txt++;i=j;continue;}}
    txt++;
    if(depth!==0)continue;
    if((ch==="."||ch==="!"||ch==="?")&&html[i+1]===" "&&/^\s+(?:[A-Z<“"($\d⚠✓✗]|&[a-z]+;)/.test(html.slice(i+1,i+4))&&sent<0&&txt>=12){sent=i+1;sentT=txt;break;}
    if(txt>=ms&&txt<=max&&(ch===";"||ch===":"||(ch===","&&html[i+1]===" ")||(ch==="—"&&html[i-1]===" "))){soft=i;softT=txt;}
    else if(txt>=ms&&txt<=max&&ch==="·"&&html[i-1]===" "&&html[i+1]===" "){soft=i-1;softT=txt-1;}
  }
  let total=0;{let d=0;for(let i=0;i<n;i++){if(html[i]==="<"){const j=html.indexOf(">",i);if(j<0)break;i=j;continue;}total++;}}
  if(sent>=0&&sentT<=max&&total-sentT>=16)return [html.slice(0,sent).trim(),true];
  if(total<=max)return null;
  if(sent>=0&&sentT>max||sent<0){   // first sentence is long (or the text is one long sentence): cut at the last clause break that fits, else at a word
    if(soft>0)return [html.slice(0,soft).replace(/[\s,;:.—·-]+$/,"")+"…",true];
    let cut=-1,t=0,dd=0;for(let i=0;i<n;i++){const ch=html[i];if(ch==="<"){const j=html.indexOf(">",i);if(j<0)break;const tag=html.slice(i+1,j);if(tag[0]==="/")dd--;else if(!/\/$|^(br|img|input|hr|wbr)\b/i.test(tag))dd++;i=j;continue;}t++;if(dd===0&&ch===" "&&t>=Math.min(30,ms+8)&&t<=max)cut=i;}
    if(cut>0)return [html.slice(0,cut).replace(/[\s,;:.—·-]+$/,"")+"…",true];}
  return null;}
const HF_SKIP="button,input,select,textarea,a,svg,canvas,details,.warn,.crit";
const HF_TXT=".hint,.combo>p";
/* one-line blurbs on cards (Shop): the same split, but the summary is clipped to the row by CSS */
const HF_ONE=".up>div>p:not(.csub):not(.cxp):not(.uneed),.goal>div>p";
function hfFold(el){
  if(!el||el.nodeType!==1||el.__hf===el.innerHTML)return;
  if(el.querySelector(":scope > .hms,:scope > details.more"))return;
  if(el.matches(".ddsay,.maphs,.bucount,.buerr,.su-txt,.swnote,[data-nofold]")||el.closest("[data-nofold],#setPane,#sheet,#buildForm,#tab-build,.sheet"))return;
  const one=el.matches(HF_ONE),html=el.innerHTML,plain=el.textContent.trim();
  if(plain.length<(one?44:64)||el.querySelector(HF_SKIP)||(one&&el.querySelector("b")))return;
  if(el.matches("[style*='color']")||[...el.querySelectorAll("[style*='color']")].some(c=>c!==el.firstElementChild))return;   // a warning inside the text stays in view; a leading ✓ Legal / ✗ status may head the summary
  let r=hfCut(html,one?40:92,one?16:34);if(!r&&one)r=[html,true];if(!r){el.__hf=html;return;}
  const sum=r[0],rest=html.length-sum.length;if(rest<12&&!one){el.__hf=html;return;}
  const cutS=sum.length<html.length&&!/…$/.test(sum)&&html.startsWith(sum);   // cut at a sentence end: the ⓘ continues it; a clause cut or a whole line: the ⓘ holds the full text and replaces the summary while open
  el.innerHTML=`<span class="hms">${sum}</span>${moreI(cutS?html.slice(sum.length).trim():html)}`;el.classList.add("hmx");if(!cutS)el.classList.add("hmx-full");if(one)el.classList.add("hm1");el.__hf=el.innerHTML;}
function hfScan(root){if(!root||root.nodeType!==1)return;
  if(root.matches&&root.matches(HF_TXT+","+HF_ONE))hfFold(root);
  root.querySelectorAll(HF_TXT+","+HF_ONE).forEach(hfFold);
  const h=root.closest&&root.closest(HF_TXT+","+HF_ONE);if(h&&h!==root)hfFold(h);}
const HF_ROOTS=["tab-test","tab-events","tab-analysis","tab-market","tab-shop"];
const HF={q:new Set(),sch:0,mo:new MutationObserver(ms=>{for(const m of ms){if(m.target.nodeType===1)HF.q.add(m.target);m.addedNodes.forEach(a=>{if(a.nodeType===1)HF.q.add(a);});}
  if(HF.q.size&&!HF.sch){HF.sch=1;queueMicrotask(()=>{HF.sch=0;const q=[...HF.q];HF.q.clear();for(const e of q){if(e.isConnected){hfScan(e);hmRestore(e);}}});}})};
HF_ROOTS.forEach(id=>{const r=$(id);if(r){HF.mo.observe(r,{childList:true,subtree:true});hfScan(r);}});
/* an open ⓘ survives its panel re-rendering: the open ones are remembered by their text and re-opened on the fresh markup */
const HM_OPEN=new Set();
function hmKey(d){const x=d.querySelector(":scope > div");return x?x.textContent.trim().slice(0,90):"";}
document.addEventListener("toggle",e=>{const d=e.target;if(!d||!d.matches||!d.matches("details.more"))return;const k=hmKey(d);if(!k)return;if(d.open)HM_OPEN.add(k);else HM_OPEN.delete(k);},true);
function hmRestore(root){if(!HM_OPEN.size||!root||root.nodeType!==1)return;(root.matches("details.more")?[root]:[...root.querySelectorAll("details.more")]).forEach(d=>{if(!d.open&&HM_OPEN.has(hmKey(d)))d.open=true;});}
