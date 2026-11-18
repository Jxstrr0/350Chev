/* ---- career onboarding tour: four callouts anchored to the real controls, each one a thing to do. The words name the buttons as they read.
   Since 1.76.114.0 the old descriptive steps (Events, Analysis, Sponsors, Shop) are one line in the last step, which ends on the
   button that moves the season on (To race week / Close week, or Race round N once it is due). text may be a function. ---- */
const TOUR=[
  {tab:"market",sel:"#pcOfSec",title:"Sign a race team",text:"Teams call with an offer: one series, eight rounds. The team's parts budget pays for the engine; the season fee is yours, paid as you race. Tap Sign with… on the one you like."},
  {tab:"build",sel:'#presets [data-id="22re"]',pre:tourPresetPrep,pre2:tourPresetRow,title:"Build the team's engine",text:"The {n} green-tagged Starter engines use only parts your bay already has. Tap one that passes the team's class rules (listed on its card) and keep the build cost under its budget. For a gas series the Two-four is a cheap first try."},
  {tab:"test",sel:"#rlRun",title:"Certify it on the dyno",text:()=>`A team only races a certified engine. Tap Run for a dyno pull${career()?` (${fmt$(testCost())}, the price is on the button)`:""}. No failures and under the dyno's cap means it's certified.`},
  {tab:"market",sel:"#pcJob [data-pcgo],#pcJob [data-pcweek]",title:"Now go racing",text:tourRaceText}
];
/* the last step: what's next for the team, in the words on its buttons, and where the rest of the game lives */
function tourRaceText(){const T=typeof pcTeam==="function"&&pcTeam(),later=" Events, Analysis, Sponsors & Rivals and the Shop are there when you want more: race your own engine, read the data, grow the shop.";
  if(!T)return "Sign a team first: its offers are on this tab."+later;
  const rd=T.round+1,due=C().week>=T.due;
  return (due?`Round ${rd} is due. Tap Race round ${rd} on the team card.`:`Round ${rd} is race week ${T.due}. Tap ${typeof pcSkip==="function"&&pcSkip()?"To race week":"Close week"} to get there, then Race round ${rd}.`)+later;}
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
  $("tourStep").textContent=`Step ${i+1} of ${TOUR.length}`;$("tourTitle").textContent=st.title;$("tourText").textContent=(typeof st.text==="function"?st.text():st.text).replace("{n}",tourStarters());$("tourNext").textContent=i===TOUR.length-1?"Got it":"Next";
  $("tourNext").style.display=i===0&&career()&&!pcTeam()?"none":"";   // step 1 asks for a signature: signing moves the tour on (team.js), so a Next here only skipped it
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
  fire:{go:{t:"Fire it up",x:()=>`${ff.rig.p.name}, straight off the stand. Tap Start (the power button up top) to turn it over.`,tgt:"idle",d:2500},
    ok:{t:"Fire it up",x:()=>"It's alive. Now let's find out where it breaks.",tgt:"view",auto:2600}},
  limit:{go:{t:"Find the limit",x:()=>`The redline's at ${S.cfg.redline.toLocaleString()} rpm on the stock single valve springs. Tap Run to pull it on the dyno.`,tgt:"run",d:3000},run:FF_RUN,
    broke:{t:"Valve float",x:()=>`Past about ${ffFloat(S.last.res,S.last.cfg)} rpm the springs can't close the valves in time — they float and hit the pistons.`,tgt:"verdict",n:"Fix it"},
    held:{t:"It held",x:()=>"You changed something and it survived. Next shows the one-part fix anyway.",tgt:"verdict"}},
  fix:{go:{t:"Fix it with one change",x:()=>"Valve float is a spring problem. Under Valve springs, fit a stiffer one — try the Beehive.",tgt:"springs",d:3500},
    ok:{t:"Fix it with one change",x:()=>`${S.cfg.springs!=="single"?OPT.springs[S.cfg.springs].name+" fitted. ":""}The valves now follow the cam to about ${ffFloat(quick,S.cfg)} rpm — past the ${S.cfg.redline.toLocaleString()} redline.`,tgt:"springs",auto:2600}},
  cert:{go:{t:"Certify it",x:()=>"Same pull, one part changed. Tap Run again.",tgt:"run",d:3000},run:Object.assign({},FF_RUN,{t:"Certify it"}),
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
// the target sits in the scrolling panel (clip it to what shows) or outside it, like the results rail's Run button over the tab bar (never clipped: Show me can't scroll to it)
function ffInPanel(t){const el=t===FFT.run?([$("runTest"),$("rlRun")].find(e=>e&&e.getClientRects().length)):null;return !el||$("panel").contains(el);}
function ffPlace(){if(!ff||ff.ending)return;const app=$("app").getBoundingClientRect(),spot=$("ffSpot"),box=$("ffBox"),t=FFT[ffCur().tgt];
  const tabT=tabsTop()-app.top;let r=t.get();
  if(r&&t.tab&&ffInPanel(t)){const pr=$("panel").getBoundingClientRect(),top=Math.max(r.top,pr.top),bot=Math.min(r.bottom,app.top+tabT);r=bot-top>=Math.min(28,r.height*0.5)?{left:r.left,width:r.width,top,bottom:bot,height:bot-top}:null;}
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
function ffStart(to){if(ff)return;if(testing){toast("Let the dyno finish first");return;}
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
function ffGuard(e){if(!ff)return;const b=e.target.closest("#modeBox button,#replayTour,#resetGame,#foreclose [data-restart],#slots button,#importSave,#exportSave,#bkFileSave,#bkFileLoad");if(!b)return;
  if(testing){e.stopPropagation();toast("Let the dyno finish first");return;}ffFinish(!b.matches("#modeBox button,#replayTour"));}
$("panel").addEventListener("click",ffGuard,true);$("setPane").addEventListener("click",ffGuard,true);
document.addEventListener("visibilitychange",()=>{if(document.hidden)ffSafeSave();});window.addEventListener("pagehide",ffSafeSave);
window.addEventListener("resize",()=>{if(ff)ffPlace();});$("panel").addEventListener("scroll",()=>{if(ff)ffPlace();},{passive:true});

/* ===== HELP (v1.66 UI cleanup): long explainer text folds to a one-line summary + an ⓘ that opens the full text =====
   moreI(full)/hintMore(summary,full) build the markup by hand; hfFold() does it for any long .hint (and the Shop's one-line card blurbs)
   on the Test/Events/Analysis/Team/Shop pages: summary = the first sentence (cut short at a clause if it runs long), the ⓘ holds the whole
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
