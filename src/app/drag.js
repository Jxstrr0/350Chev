/* ---- drag pass driver ---- */
let DR=null;
function dragVeh(){const e=S.env,lt=SIM.launchTech(S.cfg);return swapDragOv({mass:e.mass,rearBias:e.rearBias,tyre:e.tyre,tyreDia:e.tyreDia,gears:e.gears,first:e.first,top:e.top,final:e.final,launchRpm:lt.launchCtl!=="none"?lt.twoStepRpm:Math.min(e.launchRpm,S.cfg.redline),auto:e.shiftMode!=="manual",redline:S.cfg.redline,body:e.body||"street",chute:e.chute==="yes",launchCtl:lt.launchCtl,twoStepRpm:lt.twoStepRpm,launchRetard:lt.launchRetard,transBrake:lt.transBrake});}   // a chosen swap car (app/swap.js) brings its own weight, tyres and drag
/* launch hardware, in words, only when something is fitted */
/* anti-lag that will actually fire: a petrol turbo with it fitted */
function alsOf(cfg){const a=cfg&&cfg.als;return a&&a!=="off"&&OPT.als&&OPT.als[a]&&(OPT.asp[cfg.asp]||{}).kind==="turbo"&&!isCI(cfg.fuel)?a:null;}
function launchLine(cfg,short){const lt=SIM.launchTech(cfg);const b=[];const als=alsOf(cfg);
  if(short){if(lt.launchCtl!=="none")b.push(`2-step ${(lt.twoStepRpm/1000).toFixed(1)}k${lt.launchCtl==="two_step_retard"?" +"+Math.round(lt.launchRetard)+"°":""}`);if(lt.transBrake!=="none")b.push(lt.transBrake==="trans_brake"?"trans-brake":"line lock");if(als)b.push(als==="air"?"ALS air":"ALS");return b.join(" · ");}
  if(als)b.push(als==="air"?"secondary-air anti-lag":"ignition anti-lag");
  if(lt.launchCtl==="two_step")b.push(`two-step ${lt.twoStepRpm.toLocaleString()}`);else if(lt.launchCtl==="two_step_retard")b.push(`two-step ${lt.twoStepRpm.toLocaleString()} · ${Math.round(lt.launchRetard)}° retard`);
  if(lt.transBrake==="trans_brake")b.push("trans-brake");else if(lt.transBrake==="line_lock")b.push("line lock");return b.join(" · ");}
/* back-to-back launches: the turbine and manifold are still hot from the last hold (kept for the session, not saved) */
const HOTLAP={};
function soakFor(h){const x=HOTLAP[h];if(!x)return 0;return Math.max(0,(x.egt-420)*0.6*Math.exp(-(Date.now()-x.t)/90000));}
function hKey(h){let x=5381;for(let i=0;i<h.length;i++)x=((x*33)^h.charCodeAt(i))>>>0;return x.toString(36);}
function dragWear(){if(!career())return null;const h=hKey(cfgHash(S.cfg));C().wear=C().wear||{};return C().wear[h]||0;}
function wearBudget(res){return res.raceSpec?res.racePasses:Math.max(2,Math.round(res.lifeHours/25));}
function wearInfo(res){const p=dragWear();if(p==null||!res)return null;const b=wearBudget(res);return{passes:+p.toFixed(1),budget:b,w:Math.min(1.5,p/Math.max(1,b))};}
function addWear(n,hk){if(!career())return;const h=hk||hKey(cfgHash(S.cfg));C().wear=C().wear||{};C().wear[h]=+((C().wear[h]||0)+n).toFixed(2);}
/* a test reads the build, mode and career it started on; a run whose mode or career changed underneath books nothing */
function testSnap(){return{cfg:Object.assign({},S.cfg),h:cfgHash(S.cfg),car:S.career,mode:S.mode};}
function testSame(s){return!!s&&S.mode===s.mode&&S.career===s.car;}
function freshenCost(res){return Math.max(500,Math.round(res.cost*0.15/50)*50);}
function oppX(now){const R=DR&&DR.race,g0=R&&(R.ogreen!=null?R.ogreen:R.green);if(!R||g0==null)return 0;const tt=((now-g0)/1000-R.rt)/R.k;const tr=R.trace;if(tt<=0||!tr.length)return 0;let i=1;while(i<tr.length&&tr[i][0]<tt)i++;const a=tr[Math.max(0,i-1)],b=tr[Math.min(tr.length-1,i)];const f=b[0]>a[0]?(tt-a[0])/(b[0]-a[0]):0;return a[1]+(b[1]-a[1])*Math.max(0,Math.min(1,f));}
function dragBtnText(t,sub){const b=$("dragBtn");if(DR&&DR.auto&&!DR.failed&&DR.d&&/^(burnout|staged|run)$/.test(DR.d.st.phase)){t="AUTO";sub="auto driver on it — tap to take over";}const k=t+"|"+(sub||"");if(b.dataset.k===k)return;b.dataset.k=k;b.innerHTML=t+(sub?`<small style="display:block;font-size:12px;letter-spacing:.5px;opacity:.75;margin-top:2px">${sub}</small>`:"");}
/* personal bests: quickest passes and biggest pulls, kept per mode (career on C().rec, sandbox on S.sbRecords) */
function recs(){const o=career()?C():S,k=career()?"rec":"sbRecords";let R=o[k];if(!R||typeof R!=="object")R=o[k]={};if(!Array.isArray(R.top))R.top=[];if(!career()&&(!R.eng||typeof R.eng!=="object"))R.eng={};return R;}
function engBest(h){return career()?(C().dragBest||{})[h]:recs().eng[h];}
function allBest(){const t=recs().top[0];return Math.min(t?t.et:Infinity,career()&&C().bestEt||Infinity);}
function recTag(){const e={n:engineName().slice(0,28),d:Date.now()};if(career())e.w=C().week;return e;}
const etFix=(a,b)=>a.toFixed(2)===b.toFixed(2)?3:2;   // two decimals unless that hides the gain
/* a pass counts when nothing broke, no red light, and (career) it wasn't black-flagged at tech */
function dragPbCheck(q){if(ff||!q||DR.failed||(DR.race&&DR.race.foul)||(career()&&q.mph>150&&!DR.veh.chute))return null;const all=allBest(),eb=engBest(DR.hk);
  if(all<Infinity&&q.t<all)return{kind:2,was:all};if(eb!=null&&q.t<eb)return{kind:1,was:eb};return null;}
function pbPass(r,failed){if(ff||failed||r.et==null||(r.race&&r.race.foul)||(career()&&r.mph>150&&!r.chute))return;const R=recs(),h=DR.hk;
  R.top.push(Object.assign({et:r.et,mph:r.mph},recTag()));R.top.sort((a,b)=>a.et-b.et);if(R.top.length>5)R.top.length=5;
  if(career()){const m=C().dragBest=C().dragBest||{};if(!(m[h]<=r.et))m[h]=r.et;if(!(C().bestEt<=r.et))C().bestEt=r.et;}
  else{const m=R.eng;if(!(m[h]<=r.et)){delete m[h];m[h]=r.et;const k=Object.keys(m);if(k.length>24)delete m[k[0]];}}
  const pb=DR.pb;if(!pb)return;r.pb={was:pb.was,all:pb.kind>1};const f=etFix(r.et,pb.was);
  // after the pass's own toast: the PB first, then the purse line again in career
  setTimeout(()=>{const prev=career()?$("toast").textContent:"";toast(`${pb.kind>1?"PERSONAL BEST":"ENGINE PB"} · ${r.et.toFixed(f)} s (was ${pb.was.toFixed(f)})`);buzz([20,40,20,40,60]);if(prev)setTimeout(()=>toast(prev),2700);},0);}
/* dyno: highest certified (career) / clean pulled (sandbox) hp and the best reliability; a new top hp gets a toast */
function pbPull(res){const R=recs(),hp=Math.round(res.peakHp),was=career()?Math.round(C().bestHp||0):R.hp?R.hp.v:0,rw=career()?C().bestRel||0:R.rel?R.rel.v:0;
  if(hp>was){R.hp=Object.assign({v:hp},recTag());if(was>0)setTimeout(()=>toast(`New record: ${hp.toLocaleString("en-CA")} hp (was ${was.toLocaleString("en-CA")})`),2700);}
  if(res.rel>rw||(!R.rel&&res.rel>=rw))R.rel=Object.assign({v:res.rel,hp},recTag());}
function dragBreak(){if(DR&&DR.failKind==="driveline"){if(!DR.dl){DR.dl=true;sfx("fail");buzz([80,40,120]);toast("DRIVELINE LET GO · the engine is fine");}return;}   // a swap car's gearbox or axle: not an engine failure
  DR.failed=true;run.fail=true;run.failKind=DR.failKind;$("flash").style.background="rgba(226,71,60,.45)";setTimeout(()=>$("flash").style.background="rgba(226,71,60,0)",250);sfx("fail");buzz([80,40,120]);}
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
function shudFrame(st,now,dtT){if(!SH||!DR||!DR.d)return;const R=DR.race,n=DR.night,d=DR.d,ph=st.phase,pre=ph==="burnout"||ph==="staged",c=[];
  const m4=ph==="shutdown"||ph==="done"?st.marks.find(m=>m.n==="1/4 mi"):null,foul=!!(R&&R.foul);
  // the tree: stage beam, three ambers, then green (or red)
  const green=R?R.green!=null&&!foul:!pre,amb=[dtT>=0,dtT>=0.5,dtT>=1.0].map(x=>R&&x&&!green&&!foul);
  c.push(["tree",foul?"RED LIGHT":R&&R.rt0!=null?"RT "+R.rt0.toFixed(3):R?"TREE":"STAGE",
    `<div class="shbulbs"><i class="pz${st.rolled&&ph!=="burnout"?" on":""}"></i>${amb.map(x=>`<i class="a${x?" on":""}"></i>`).join("")}<i class="${foul?"r on":"g"+(green?" on":"")}"></i></div>`,foul?"bad":""]);
  if(pre){const tt=st.tyreTemp;c.push(["tyre","Tyre heat",`${Math.round(tt*100)}<i>%</i><u><s style="transform:scaleX(${Math.min(1,tt).toFixed(2)})"></s></u>`,st.overcook>0.02?"warn":tt<0.4?"info":"good"]);
    if(ph==="staged"&&d.canArm){const bT=st.boostTarget;if(bT>0)c.push(["boost","Boost",`${bv(st.boost)}<i>/${bv(bT)}</i>`,st.boost>=bT*0.9?"hot":""]);
      c.push(["egt","EGT",`${Math.round(st.egt)}<i>°C</i>`,st.egt>950?"bad":st.egt>850?"warn":""]);}}
  else{if(R){const ox=oppX(now),gap=(st.x-ox)*3.281;let mg=null;   // past the stripe the gap means nothing: once both are through, the margin
      if(m4&&!foul){if(n&&n.verdict&&n.verdict.margin!=null)mg=n.verdict.win?n.verdict.margin:-n.verdict.margin;else if(!n&&R.et!=null&&ox>=402.336)mg=(R.et+R.rt)-(m4.t+Math.max(0,R.rt0||0));}
      c.push(mg!=null?["gap","Margin",(mg>=0?"+":"−")+Math.abs(mg).toFixed(3).replace(/^0(?=\.)/,"")+"<i>s</i>",mg>=0?"good":"bad"]:["gap","vs "+rnEsc(shOpp(R.name)),foul?"RED":m4&&gap<0?"—":(gap>=0?"+":"")+Math.round(gap)+"<i>ft</i>",foul||gap<0?"bad":"good"]);}
    c.push(["et",m4?"ET":"Clock",m4?m4.t.toFixed(3):st.t.toFixed(2)+"<i>s</i>",st.spin&&!m4?"bad":""]);
    c.push(["mph",m4?"Trap mph":"mph",String(Math.round(m4?m4.mph:st.v*2.237)),""]);
    if(st.boostTarget>0)c.push(["boost","Boost",`${bv(st.boost)}<i>${pU()}</i>`,st.als>0.2?"hot":""]);}
  const z=st.n2oS;if(z){if(pre){const lp=Math.round(z.psi*(0.55+0.45*z.line));c.push(["n2o",z.purging?"Purging":z.line>=0.5?"N2O purged":"N2O · purge",`${lp}<i>psi</i><u><s style="transform:scaleX(${Math.min(1,z.psi/1100).toFixed(2)})"></s></u>`,z.purging?"info":z.line>=0.5?"good":"warn"]);}
    else c.push(["n2o","Nitrous",z.cut?"CUT":ph==="run"?(st.n2o>0.05?"ON":z.on?"WINDOW":"ARMED"):"OFF",z.cut?"bad":ph==="run"&&st.n2o>0.05?"info":ph==="run"?"":"dim"]);}
  if(DR.res.als&&DR.res.als!=="off"){const on=st.als>0.2;c.push(["als","Anti-lag",on?"ON":(ph==="staged"||ph==="run")&&(st.launch.armed||ph==="run")?"ARMED":"OFF",on?"hot":"dim"]);}
  // one row of cells: rebuilt only when the set changes, otherwise text in place
  const keys=c.map(x=>x[0]).join();if(keys!==SH.keys){SH.keys=keys;SH.row.innerHTML=c.map(()=>`<div class="shx"><span></span><b></b></div>`).join("");SH.nodes=Array.from(SH.row.children);SH.m={};}
  c.forEach((x,i)=>{const nd=SH.nodes[i];shudSet("c"+i,nd,"shx sh-"+x[0]+(x[3]?" "+x[3]:""),"cls");shudSet("l"+i,nd.firstChild,x[1]);shudSet("v"+i,nd.lastChild,x[2]);});
  // caption: the round and who's in the other lane, then what to do now
  let s="";if(n){s=`${n.label} · vs ${rnEsc(R.name)}`;if(n.dialP!=null)s+=` · dial ${n.dialP.toFixed(2)} vs ${n.dialO.toFixed(2)}`;
    if(ph==="staged"&&R.hcP!=null&&R.otree0==null)s+=R.hcP>0?` · you go ${R.hcP.toFixed(2)} s after them`:R.hcO>0?` · ${R.hcO.toFixed(2)} s head start`:"";}
  else if(R)s=`Heads-up · vs ${rnEsc(R.name)}`;
  let h="";
  if(DR.failed)h=`<em class="l">${DR.failKind==="manifold"?"MANIFOLD CRACKED":DR.failKind==="turbo"?"TURBO GONE":DR.failKind==="backfire"?"INTAKE BACKFIRE":DR.failKind==="lean"?"MELTED A PISTON":"BROKE"}</em>`;
  else if(ph==="burnout")h=st.burning?`burning · ${st.burnT.toFixed(1)} s${st.burnT>4?" · too long, it's going greasy":st.burnT>2.5?" · that's about right":""}`:st.burnT>0?"tap to roll into the beams":"in the water box"+(DR.veh.transBrake==="line_lock"?" · line lock on":" · no line lock — it will creep");
  else if(ph==="staged")h=!st.rolled?"rolling into the beams":st.launch.armed?(st.launch.twoStep?"on the two-step":st.launch.transBrake?"on the trans-brake":"ALS armed — foot on the throttle")+` · ${st.launch.held.toFixed(1)} s`:R?(dtT<0?"staged — wait for the ambers":dtT<1.5?"…":`<em class="o">GO</em>`):"time trial — leave when you like";
  else if(ph==="run"){const m=st.marks.slice(-1)[0];h=st.spin?`<em class="l">SPIN</em>`:st.onBars?"on the bars":m?`${m.n} ${m.t.toFixed(2)} s`:`gear ${st.gear}`;}
  else if(ph==="shutdown")h=(st.chuteOut?"chute out · ":"on the brakes · ")+Math.round(st.shutFt)+" ft";
  if(DR.auto&&!DR.failed&&(pre||ph==="run")){const w=DR.drv.say(d,dragTree(now));if(w)h="Auto · "+w;}
  if(!DR.failed&&(ph==="shutdown"||ph==="done")){let w=null;if(n&&n.verdict&&n.stage>=2)w=!!n.verdict.win;else if(R&&!n)w=!foul&&!!m4&&(R.et==null||m4.t+Math.max(0,R.rt0||0)<R.et+R.rt);
    if(w!=null)h=`<em class="${w?"w":"l"}">${w?"WIN":"LOSS"}</em>`+(h?" · "+h:"");}
  shudSet("cap",SH.cap,s&&h?s+" · "+h:s||h);
  const rl=DR.veh.redline||8000,rpm=Math.max(0,run.rpm||0),f=Math.min(1,rpm/rl);
  shudSet("rpm",SH.rpm,`${ph==="run"?"G"+st.gear+" · ":""}${(Math.round(rpm/10)*10).toLocaleString("en-CA")} rpm`);
  shudSet("bar",SH.bi,`scaleX(${f.toFixed(3)})`,"transform");shudSet("lim",SH.bar,f>0.965?"shr lim":"shr","cls");}
/* ---- the thermal timing slip: the same card on the Test tab and in the share image ---- */
let SLIPN=false;   // notes tab: stays as you left it for the session
document.addEventListener("toggle",e=>{const t=e.target;if(t&&t.classList&&t.classList.contains("tsn"))SLIPN=t.open;},true);
/* the other lane's splits from its trace (the trace runs in its own time; R.k stretches it to the pass it made) */
function dhudOppMarks(R){if(!R||!R.trace||!R.trace.length)return null;const tr=R.trace,k=R.k||1;
  const at=x=>{for(let i=1;i<tr.length;i++)if(tr[i][1]>=x){const a=tr[i-1],b=tr[i],dt=Math.max(1e-3,(b[0]-a[0])*k),f=b[1]>a[1]?(x-a[1])/(b[1]-a[1]):0;return{t:+((a[0]+(b[0]-a[0])*f)*k).toFixed(3),mph:+((b[1]-a[1])/dt*2.23694).toFixed(1)};}return null;};
  return{sixty:at(18.288),ft330:at(100.584),eighth:at(201.168),ft1000:at(304.8),et:R.et!=null?R.et:null,mph:R.et!=null?R.mph:null};}
/* what goes on the slip, shared by the card and the image */
function slipData(r,res){const R=r.race,n=r.night,o=R&&R.om,br=!!(n&&n.dialP!=null),f3=v=>v==null?"—":(+v).toFixed(3),mp=v=>v==null?"—":(+v).toFixed(2);
  const rt=v=>v==null?"—":v<0?"RED":(+v).toFixed(3),failed=!!res.dragFailed,et=failed?null:r.et;
  const rows=[["R/T",R?(R.foul?"RED":rt(R.rt)):"—",R?rt(R.oppRt):null],
    ["60'",f3(r.sixty&&r.sixty.t),o?f3(o.sixty&&o.sixty.t):null],["330'",f3(r.ft330&&r.ft330.t),o?f3(o.ft330&&o.ft330.t):null],
    ["1/8",f3(r.eighth&&r.eighth.t),o?f3(o.eighth&&o.eighth.t):null,""],["MPH",mp(r.eighth&&r.eighth.mph),o?mp(o.eighth&&o.eighth.mph):null,"mph"],
    ["1000'",f3(r.ft1000&&r.ft1000.t),o?f3(o.ft1000&&o.ft1000.t):null],
    ["1/4",et!=null?f3(et):failed?"BROKE":"—",R?(n&&n.oppBroke?"BROKE":f3(R.oppEt)):null,"et"],["MPH",et!=null?mp(r.mph):"—",R?(R.oppEt!=null?mp(R.oppMph):"—"):null,"mph"]];
  if(br)rows.push(["DIAL",n.dialP.toFixed(2),n.dialO.toFixed(2)]);
  if(!R)rows.shift();   // no tree on a time trial
  const win=R&&(!n||n.stage>=2)?!!R.won:null;
  const verdict=failed?"BROKE":R&&R.foul?"RED LIGHT":win===true?"WIN":win===false?"LOSS":n?"QUALIFYING":R?"—":"TIME TRIAL";
  const margin=R&&R.margin!=null&&win!=null&&!R.foul?`by ${Math.abs(R.margin).toFixed(3)} s`:n&&n.stage<2&&et!=null?(br?"time trial":"counts toward your seed"):"";
  const when=new Date(r.at||Date.now());
  return{R,n,rows,win,verdict,margin,opp:R?shOpp(R.name):null,round:n?n.label:R?"TEST & TUNE · HEADS-UP":"TEST & TUNE",
    date:when.toLocaleDateString("en-CA")+" "+String(when.getHours()).padStart(2,"0")+":"+String(when.getMinutes()).padStart(2,"0"),
    car:(S.name||engineName()||"").slice(0,40),spec:`${Math.round(res.peakHp)} hp · ${(SIM.AERO[r.body]||SIM.AERO.street).n} · ${SIM.TYRES[r.veh.tyre].n} · ${r.veh.mass} kg${r.auto?r.auto.took!=null?" · you took over":" · Auto driver":""}`};}
function dragSlipCard(r,res){const D=slipData(r,res),two=!!D.R,lamp=w=>two&&D.win!=null?`<i class="lamp${w?" on":""}"></i>`:"";
  const pb=r.pb&&r.et!=null?(()=>{const f=etFix(r.et,+r.pb.was);return`<div class="stamp">${r.pb.all?"PERSONAL BEST":"ENGINE BEST"}<br><s>${(+r.pb.was).toFixed(f)}</s> ${r.et.toFixed(f)}</div>`;})():"";
  return`<div class="tslip${D.win===true?" won":""}" role="group" aria-label="Timing slip"><div class="tsh"><b>PRAIRIE BLUE RACEWAY</b><small>1/4 mile · ${rnEsc(D.round)}</small><small>${D.date}</small></div>
    <div class="tsc"><strong>${rnEsc(D.car)}</strong>${rnEsc(D.spec)}</div>
    <table><thead><tr><th></th><th class="you"><small>Right lane</small>${lamp(D.win===true)}You</th>${two?`<th><small>Left lane</small>${lamp(D.win===false)}${rnEsc(D.opp)}</th>`:""}</tr></thead>
    <tbody>${D.rows.map(x=>`<tr class="${x[3]||""}"><td>${x[0]}</td><td>${x[1]}</td>${two?`<td>${x[2]==null?"—":x[2]}</td>`:""}</tr>`).join("")}</tbody></table>
    <div class="tsw"><b class="${D.win===true?"w":D.win===false||D.verdict==="RED LIGHT"||D.verdict==="BROKE"?"l":""}">${D.verdict}</b><span>${D.margin}</span></div>
    ${pb}<div class="tsf">Thank you for racing</div></div>`;}
/* the share image: the same slip, printed big on a dark bench */
function slipCanvas(l){const r=l.res.drag,res=l.res,D=slipData(r,res),W=1080,H=1350,c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d");
  const F=(sz,w)=>`${w||600} ${sz}px "Chakra Petch","Barlow Condensed","Arial Narrow",sans-serif`,M=(sz,w)=>`${w||500} ${sz}px "IBM Plex Mono",Menlo,Consolas,monospace`;
  const ink="#2d2b36",ink2="#6b6772",paper="#f4f1e6",L=140,Rt=940,T=64,B=H-64,two=!!D.R;
  {const g=x.createRadialGradient(W/2,H/2,200,W/2,H/2,900);g.addColorStop(0,"#23262c");g.addColorStop(1,"#121417");x.fillStyle=g;x.fillRect(0,0,W,H);}
  // the paper, with torn zigzag ends and a soft shadow
  x.save();x.shadowColor="rgba(0,0,0,.55)";x.shadowBlur=40;x.shadowOffsetY=16;x.fillStyle=paper;x.beginPath();x.moveTo(L,T);
  for(let xx=L;xx<Rt;xx+=20){x.lineTo(xx+10,T-10);x.lineTo(Math.min(Rt,xx+20),T);}x.lineTo(Rt,B);for(let xx=Rt;xx>L;xx-=20){x.lineTo(xx-10,B+10);x.lineTo(Math.max(L,xx-20),B);}x.closePath();x.fill();x.restore();
  {const g=x.createLinearGradient(0,T,0,B);g.addColorStop(0,"rgba(0,0,0,.05)");g.addColorStop(.15,"rgba(0,0,0,0)");g.addColorStop(.88,"rgba(0,0,0,0)");g.addColorStop(1,"rgba(0,0,0,.06)");x.fillStyle=g;x.fillRect(L,T,Rt-L,B-T);}
  const dash=y=>{x.save();x.strokeStyle="rgba(45,43,54,.45)";x.setLineDash([10,8]);x.lineWidth=2;x.beginPath();x.moveTo(L+40,y);x.lineTo(Rt-40,y);x.stroke();x.restore();};
  const fit=(t,font,max)=>{x.font=font;let s=String(t);while(s.length>3&&x.measureText(s).width>max)s=s.slice(0,-2)+"…";return s;};
  x.textAlign="center";x.fillStyle=ink;{let fs=58;x.font=F(fs,700);while(fs>34&&x.measureText("PRAIRIE BLUE RACEWAY").width>Rt-L-80){fs-=2;x.font=F(fs,700);}}x.fillText("PRAIRIE BLUE RACEWAY",W/2,150);
  x.fillStyle=ink2;x.font=M(26);x.fillText(fit(("1/4 MILE · "+D.round).toUpperCase(),M(26),Rt-L-80),W/2,196);x.fillText(D.date,W/2,232);dash(262);
  x.fillStyle=ink;x.fillText(fit(D.car,M(32,500),Rt-L-80),W/2,312);x.fillStyle=ink2;x.font=M(23);x.fillText(fit(D.spec,M(23),Rt-L-80),W/2,350);dash(380);
  // the times: label on the left, your lane, then theirs
  const cx1=two?650:Rt-60,cx2=Rt-60;let y=436;x.font=M(22);x.textAlign="right";
  const lamp=(cx,on)=>{x.beginPath();x.arc(cx,y-8,9,0,7);x.fillStyle=on?"#e8392a":"#cfcabd";if(on){x.save();x.shadowColor="#ff5a3c";x.shadowBlur=14;x.fill();x.restore();}else x.fill();};
  x.fillStyle=ink2;x.font=M(18);x.fillText("RIGHT LANE",cx1,y-30);if(two)x.fillText("LEFT LANE",cx2,y-30);
  x.fillStyle=ink;x.font=M(24,600);x.fillText("YOU",cx1,y);if(two&&D.win!=null)lamp(cx1-x.measureText("YOU").width-20,D.win===true);
  if(two){const t=fit(D.opp.toUpperCase(),M(24,600),190);x.font=M(24,600);x.fillStyle=ink;x.fillText(t,cx2,y);if(D.win!=null)lamp(cx2-x.measureText(t).width-20,D.win===false);}
  y+=58;for(const row of D.rows){const big=row[3]==="et",sub=row[3]==="mph";if(big){x.strokeStyle="rgba(45,43,54,.3)";x.lineWidth=2;x.beginPath();x.moveTo(L+40,y-42);x.lineTo(Rt-40,y-42);x.stroke();y+=6;}
    x.textAlign="left";x.fillStyle=ink2;x.font=M(28);x.fillText(row[0],L+50,y);x.textAlign="right";x.fillStyle=sub?ink2:ink;x.font=M(big?44:32,big?600:500);x.fillText(row[1],cx1,y);if(two){x.fillText(row[2]==null?"—":row[2],cx2,y);}
    y+=big?62:sub?60:52;}
  dash(y-18);y+=44;x.textAlign="left";x.font=F(54,700);x.fillStyle=D.win===true?"#1d7a4a":D.win===false||D.verdict==="RED LIGHT"||D.verdict==="BROKE"?"#b3261a":ink;x.fillText(D.verdict,L+50,y);
  x.textAlign="right";x.fillStyle=ink2;x.font=M(26);x.fillText(D.margin,Rt-50,y);
  // the launch in two lines of small print (one when the PB stamp needs the room)
  let ly=y;{const plain=h=>String(h||"").replace(/<[^>]+>/g,"");const t=[plain(launchSlip(r)),r.shifts.length?"shifts "+r.shifts.map(s=>s.rpm.toLocaleString("en-CA")).join(" · "):""].filter(Boolean).join(" · ");
    x.textAlign="left";x.font=M(21);x.fillStyle=ink2;const mx=r.pb?1:2;let yy=y+48,cur="",ln=0;for(const w of t.split(" ")){const s=cur?cur+" "+w:w;if(x.measureText(s).width>Rt-L-100){x.fillText(cur,L+50,yy);yy+=30;cur=w;if(++ln>=mx){cur="";break;}}else cur=s;}if(cur&&ln<mx)x.fillText(cur,L+50,yy);ly=yy;}
  if(r.pb&&r.et!=null){const f=etFix(r.et,+r.pb.was),t1=r.pb.all?"PERSONAL BEST":"ENGINE BEST",was=(+r.pb.was).toFixed(f),now=r.et.toFixed(f);   // the stamp: old time struck through
    x.save();x.translate(L+190,Math.min(B-150,ly+72));x.rotate(-0.1);x.globalAlpha=0.88;x.strokeStyle=x.fillStyle="#d0402e";x.lineWidth=5;x.strokeRect(-125,-44,250,88);x.textAlign="center";
    let fs=34;do{x.font=F(fs,700);fs-=2;}while(x.measureText(t1).width>220&&fs>18);x.fillText(t1,0,-6);x.font=M(28,600);const ww=x.measureText(was).width,wn=x.measureText(now).width,x0=-(ww+18+wn)/2;x.textAlign="left";x.fillText(was,x0,32);x.fillText(now,x0+ww+18,32);
    x.lineWidth=3;x.beginPath();x.moveTo(x0-4,22);x.lineTo(x0+ww+4,22);x.stroke();x.restore();}
  x.textAlign="left";x.fillStyle=ink2;x.font=M(22);x.fillText(career()?"WEEK "+C().week+" · PRAIRIE ENGINE WORKS":"TEST CELL · PRAIRIE ENGINE WORKS",L+50,B-58);
  x.textAlign="center";x.font=F(24,600);x.fillText("THANK YOU FOR RACING",W/2,B-20);
  spSlipDraw(x,Rt+60,B-4);   // sponsor logos printed bottom-right of the slip
  return c;}
function dragStart(){
  $("app").classList.add("onstrip");
  const env=stdEnv();const res=SIM.dragPrep(S.cfg,env);const veh=dragVeh();
  if(res.nitrous&&res.n2oTq)veh.n2o=n2oVeh(env);
  rnPrep(veh,res,env);   // tyre pressure / shocks; on a race night the class lock and the air
  const wi=wearInfo(res);if(wi&&wi.w>0){const f=1-0.05*Math.min(1,wi.w);res.torque=res.torque.map(t=>t*f);if(res.naTorque)res.naTorque=res.naTorque.map(t=>t*f);res.power=res.power.map(t=>t*f);res.peakTq*=f;res.peakHp*=f;res.wornBy=Math.round((1-f)*100);}
  const snap=testSnap(),hk=hKey(snap.h),soak=soakFor(hk);
  const d=SIM.dragRun(res,Object.assign({},veh,{burnout:true,soakC:soak}));DR={d,res,env,veh,hk,soak,snap,last:performance.now(),failed:false,downAt:null,lastPtr:0};DR.hw=stripHw(snap.cfg);if(DR.hw.diesel)DR.hw.smoke=+Math.min(1,(res.smoke||0)/60).toFixed(2);
  if(dragAuto()){DR.auto=true;DR.drv=SIM.dragDriver(Math.floor(Math.random()*4294967296),res,veh);DR.vt=DR.last;}   // the auto driver: its own seeded hand, on its own fixed clock
  if(env.race==="heads"){
    // the other lane runs the same car and the same launch hardware, with a sensible hold and a tidy burnout
    const opp=SIM.dragPass(res,Object.assign({},veh,{auto:true,mass:veh.mass*(0.97+Math.random()*0.06),holdTime:0.9+Math.random()*0.5,noFail:true,soakC:0,tyreTemp:veh.transBrake==="line_lock"?0.85:0.36}));const k=0.965+Math.random()*0.075;
    DR.race={trace:oppTrace(opp.trace,Infinity,veh.chute?9:6,(opp.et||30)+40),k,rt:0.03+Math.random()*0.16,et:opp.et!=null?+(opp.et*k).toFixed(3):null,mph:opp.mph,foul:false,rt0:null,tree0:null,green:null,name:["Lane 2","Northwind","Halcyon GT","Coulee","Prairie Fire"][Math.floor(Math.random()*5)]};
    DR.race.look=rivalLook(DR.race.name,"",veh.body,DR.hw);DR.race.fx=oppFx(opp.trace,veh,rnHash(DR.race.name+":"+DR.race.k));}
  n2oStart();
  ENGINE_VIS.stripRace&&ENGINE_VIS.stripRace(null);
  if(env.race==="night")rnRace();   // race night: the rival in the other lane
  // phone: bring the button and the live numbers up to the top of the panel, clear of the tab bar, with room for the HUD to grow
  if(!document.documentElement.classList.contains("desk"))setTimeout(()=>{try{$("dragCtl").scrollIntoView({block:"start",behavior:"smooth"});}catch(e){}},60);
  ENGINE_VIS.setAutoRotate(false);$("rpmbox").style.display="block";$("dragCtl").style.display="";$("dragBtn").dataset.k="";dragBtnText("HOLD TO BURN OUT","tap to skip straight to the line");$("dragBtn").disabled=false;$("dragLive").innerHTML="";shudStart();
  $("testProg").classList.remove("done");sfx("start");
  // fresh-engine budget: passes beyond what the build can take start to break parts
  DR.breakAt=(wi&&wi.w>=1)?(2+Math.random()*4):Infinity;
  DR.failKind=failKindOf(res,env)||"rod";
  DR.lv=0;DR.lox=0;
  const step=()=>{const now=performance.now();const dt=(now-DR.last)/1000;DR.last=now;const st=DR.auto?dragAutoStep(now):d.step(dt);const R=DR.race;
    if(R&&st.phase==="staged"&&st.rolled&&R.tree0==null)R.tree0=now+1200+Math.random()*1800;
    const dtT=R&&R.tree0!=null?(now-R.tree0)/1000:-1;if(R&&dtT>=1.5&&R.green==null)R.green=R.tree0+1500;
    if(st.broke&&!DR.failed){DR.failKind=st.broke;dragBreak();}
    if(st.phase==="run"&&!DR.failed&&(st.t>DR.breakAt||(st.overrev>1.12&&res.overrev&&!res.overrev.survived))){dragBreak();st.done=true;st.phase="done";}
    if(DR.pb===undefined&&(st.phase==="shutdown"||st.phase==="done")){DR.pb=dragPbCheck(st.marks.find(m=>m.n==="1/4 mi"));if(DR.pb)ENGINE_VIS.stripPb(DR.pb.kind);}
    if(DR.night)rnFrame(now,st,dtT);
    {const pre=st.phase==="burnout"||(st.phase==="staged"&&!st.rolled);const ox=R?(pre?st.x:oppX(now)):0;const ov=dt>0?Math.max(0,(ox-DR.lox)/dt):0;const acc=dt>0?(st.v-DR.lv)/dt:0;DR.lv=st.v;DR.lox=ox;
      const m4=st.phase==="shutdown"||st.phase==="done"?st.marks.find(m=>m.n==="1/4 mi"):null;
      // test & tune heads-up: the other lane's RT once it leaves, its ET/MPH once it's through the traps, and the same verdict as the slip
      let hx=null;if(R&&!DR.night){const fin=R.et!=null&&ox>=402.336;hx={ort:R.green!=null&&(now-R.green)/1000>=R.rt?R.rt:undefined,oet:fin?R.et:undefined,omph:fin?R.mph:undefined,
        win:st.phase==="shutdown"||st.phase==="done"?!DR.failed&&!R.foul&&!!m4&&(R.et==null||m4.t+Math.max(0,R.rt0||0)<R.et+R.rt):undefined};}
      ENGINE_VIS.setStrip(Object.assign({on:true,et:m4?m4.t:undefined,mph:m4?m4.mph:undefined,dt,x:st.x,v:st.v,ox,ov,acc,spin:st.spin,phase:st.phase,chute:st.chuteOut,race:!!R,foul:!!(R&&R.foul),body:veh.body,tyreIn:veh.tyreDia,color:carPaint(),hw:DR.hw,opp:R?R.look:undefined,
        tree:{staged:!!st.rolled&&st.phase!=="burnout",a1:dtT>=0,a2:dtT>=0.5,a3:dtT>=1.0,green:!!(R&&R.green!=null)},
        shifting:st.shiftT>0,boost:st.boost,boostTarget:st.boostTarget,rpm:st.rpm,redline:veh.redline,gear:st.gear,
        launch:{armed:!!st.launch.armed,twoStep:st.launch.twoStep,transBrake:st.launch.transBrake,held:st.launch.held,retard:st.launch.retard,pops:st.launch.pops},
        tyreTemp:st.tyreTemp,burnout:st.phase==="burnout",lift:st.lift,onBars:!!st.onBars,brake:st.phase==="shutdown",failed:!!DR.failed,failKind:DR.failed?DR.failKind:null,night:!!(S.night||DR.night),rt:R?R.rt0:null},R?oppDyn(now,ox,st):null,hx));}
    if(st.phase==="burnout"){const ll=veh.transBrake==="line_lock";
      $("dragLive").innerHTML=`<div class="peak" style="grid-column:1/-1"><b>${Math.round(st.tyreTemp*100)}<i>% tyre heat</i></b><span>${st.burning?"burning · "+st.burnT.toFixed(1)+" s"+(st.burnT>4?" · too long, it's going greasy":st.burnT>2.5?" · that's about right":""):st.burnT>0?"tap to roll into the beams":"in the water box"}${ll?" · line lock on":" · no line lock — it will creep"}</span></div>`;
      if(st.burning)dragBtnText("BURNING…","let go when the smoke rolls");else if(st.burnT>0)dragBtnText("TAP TO STAGE","or hold to burn some more");else dragBtnText("HOLD TO BURN OUT","tap to skip straight to the line");}
    else if(st.phase==="staged"){const bT=st.boostTarget;let h="";
      if(R){const bulbs=[dtT>=0,dtT>=0.5,dtT>=1.0,dtT>=1.5];h+=`<div class="peak" style="grid-column:1/-1"><b style="letter-spacing:6px">${bulbs.slice(0,3).map(b=>b?"🟠":"⚫").join("")}${bulbs[3]?"🟢":"⚫"}</b><span>${!st.rolled?"rolling into the beams":dtT<0?"staged — wait for the ambers":dtT<1.5?"…":"GO"}</span></div>`;}
      else h+=`<div class="peak" style="grid-column:1/-1"><b>${st.rolled?"STAGED":"…"}</b><span>${st.rolled?"time trial — leave when you like":"rolling into the beams"}</span></div>`;
      if(d.canArm)h+=`<div class="peak"><b>${bT>0?bv(st.boost):"—"}<i>${bT>0?pU():""}</i></b><span>${bT>0?"of "+bv(bT)+" on the line":"no boost to build"}</span></div><div class="peak"><b>${st.launch.held.toFixed(1)}<i>s</i></b><span>${st.launch.armed?(st.launch.twoStep?"on the two-step":st.launch.transBrake?"on the trans-brake":"ALS armed — foot on the throttle"):"not armed"}</span></div><div class="peak"><b style="color:${st.egt>950?"var(--crit)":st.egt>850?"var(--warn)":""}">${Math.round(st.egt)}<i>°C</i></b><span>turbine inlet</span></div>`;
      $("dragLive").innerHTML=h;
      if(!st.rolled)dragBtnText("ROLLING IN…");else if(d.canArm)dragBtnText(st.launch.armed?"RELEASE ON GREEN":"HOLD · RELEASE ON GREEN",st.launch.armed?(st.launch.twoStep?`two-step ${d.holdRpm.toLocaleString()} rpm`:st.launch.transBrake?"on the brake":`ALS armed · ${d.holdRpm.toLocaleString()} rpm`):"arm it on the ambers — every second holding is heat");else dragBtnText("LAUNCH",R?"tap on the green":"tap to go");}
    run.on=true;run.rpm=DR.failed?Math.max(0,run.rpm-380):st.rpm;run.load=DR.failed?0:st.load;
    $("rpmLbl").textContent=Math.round(run.rpm/10)*10;
    if(st.phase==="run"||st.phase==="shutdown"||st.phase==="done"){$("testProg").style.width=Math.min(100,100*st.x/402.336)+"%";
      const m=st.marks.slice(-1)[0];let lane="";if(R){const ox=oppX(now);
        const gap=(st.x-ox)*3.281;lane=`<div class="peak" style="grid-column:1/-1"><b style="color:${R.foul?"var(--crit)":gap>=0?"var(--good)":"var(--crit)"}">${R.foul?"RED LIGHT":(gap>=0?"+":"")+Math.round(gap)+"<i>ft</i>"}</b><span>${R.name} · RT ${R.rt0!=null?R.rt0.toFixed(3):"—"}</span></div>`;}
      $("dragLive").innerHTML=lane+`<div class="peak"><b>${st.t.toFixed(2)}<i>s</i></b><span>${Math.round(st.x*3.281)} ft · gear ${st.gear}${st.spin?" · <span style=\"color:var(--crit)\">SPIN</span>":""}</span></div><div class="peak"><b>${Math.round(st.v*2.237)}<i>mph</i></b><span>${st.phase==="shutdown"?(st.chuteOut?"chute out · "+Math.round(st.shutFt)+" ft":"on the brakes · "+Math.round(st.shutFt)+" ft"):m?m.n+" "+m.t.toFixed(2)+" s":"—"}</span></div>${st.boostTarget>0?`<div class="peak"><b>${st.boost.toFixed(1)}<i>bar</i></b><span>boost${st.als>0.2?' · <span style="color:var(--orange)">ALS</span>':""}${st.onBars?" · on the bars":""}</span></div>`:""}${DR.res.als&&DR.res.als!=="off"&&st.phase==="run"?`<div class="peak" style="grid-column:1/-1"><b style="font-size:15px;color:var(--orange)">ALS armed</b><span>boost held through shifts · ${Math.round(st.egt)} °C at the turbine</span></div>`:""}`;
      if(DR.failed)dragBtnText(DR.failKind==="manifold"?"MANIFOLD CRACKED":DR.failKind==="turbo"?"TURBO GONE":DR.failKind==="backfire"?"INTAKE BACKFIRE":DR.failKind==="lean"?"MELTED A PISTON":"BROKE");
      else if(st.phase==="shutdown"){if(DR.pb&&ENGINE_VIS.stripPb().shot==="crowd")dragBtnText(DR.pb.kind>1?"PERSONAL BEST":"ENGINE PB","tap to go back to the car");else dragBtnText(st.chuteOut?"CHUTE OUT":"SHUT DOWN");}
      else if(!veh.auto)dragBtnText(st.gear<veh.gears?"SHIFT ▲":"FLAT OUT");else dragBtnText("RUNNING");}
    if(DR.n2o)n2oFrame(st,dt);
    if(DR.night)rnHud(st);
    if(DR.auto&&!DR.failed&&st.phase!=="done"){const w=DR.drv.say(d,dragTree(now));if(w)$("dragLive").insertAdjacentHTML("afterbegin",`<div class="peak dauto" style="grid-column:1/-1;padding:6px 10px"><span style="margin:0">Auto · <b>${w}</b> — tap to take over</span></div>`);}
    shudFrame(st,now,dtT);
    if(!st.done||(DR.failed&&run.rpm>0))requestAnimationFrame(step);else dragFinish();};
  requestAnimationFrame(step);
}
/* the driver's inputs. Pointer events so a held thumb on an iPhone works (burnout, two-step, trans-brake);
   a plain click (keyboard, harness) is treated as a tap. */
function dragStage(){const d=DR.d;d.stage();buzz([12]);}
/* the auto driver (S.env.dragDrive "auto"): SIM.dragDriver presses the same buttons on fixed 4 ms ticks of a clock (DR.vt) that
   trails the frame clock, so it drives the same pass at 4 fps or 120. A tap or Space hands the car back (dragTakeOver). */
function dragAuto(){if(S.env.dragDrive!=="auto")S.env.dragDrive="you";return S.env.dragDrive==="auto";}
function dragTree(t){const R=DR.race;return!R?null:R.tree0==null||t<R.tree0?NaN:(t-(R.tree0+1500))/1000;}   // seconds from the green (NaN while the tree is dark)
function dragAutoStep(now){const d=DR.d,H=SIM.DRAG_TICK;let st=d.st;if(now-DR.vt>1000)DR.vt=now-1000;
  while(DR.auto&&!st.done&&DR.vt+H*1000<=now){const vt=DR.vt+H*1000;const a=DR.failed?null:DR.drv.tick(d,H,dragTree(vt));if(a)dragAutoDo(a,vt);st=d.step(H);DR.vt=vt;}
  return st;}
function dragAutoDo(a,vt){const d=DR.d;
  if(a==="burn")d.burn(true);else if(a==="unburn")d.burn(false);else if(a==="stage")dragStage();else if(a==="purge")n2oPurge(true);else if(a==="unpurge")n2oPurge(false);
  else if(a==="arm"){if(d.arm())buzz([20]);}else if(a==="shift")d.shift();else if(a==="go"){const l=DR.last;dragGo(vt);DR.last=l;}}
function dragTakeOver(){const d=DR.d,st=d.st,R=DR.race;DR.auto=false;DR.took=st.phase==="run"?Math.round(st.x*3.28084):st.phase;
  DR.tookPre=st.phase==="burnout"||st.phase==="staged"&&(!R||R.tree0==null||performance.now()<R.tree0);   // took it before the tree lit: the light is yours
  if(st.burning)d.burn(false);DR.downAt=null;if(st.launch.armed)d.disarm();if(st.n2oS&&st.n2oS.purging)n2oPurge(false);$("dragBtn").dataset.k="";
  toast(st.phase==="run"?(DR.veh.auto?"You have it — the box shifts itself":"You have it — tap to shift"):st.phase==="burnout"?"You have it — hold to burn out, tap to stage":"You have it — "+(d.canArm?"hold to arm, let go on the green":DR.race?"tap on the green":"tap to go"));buzz([20]);}
function dragAutoWord(a){return a.took==null?"Auto driver — the whole pass":"Auto driver — you took over "+(typeof a.took==="number"?"at "+a.took+" ft":a.took==="burnout"?"in the water box":"on the line");}
(()=>{const skip=()=>!testing&&ENGINE_VIS.stripBusy&&ENGINE_VIS.stripBusy()>0&&ENGINE_VIS.stripSkip();
  $("view").addEventListener("pointerdown",()=>{skip();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!e.defaultPrevented&&skip())e.preventDefault();});})();
function dragGo(now){const d=DR.d;if(d.st.phase!=="staged")return;const R=DR.race;
  if(R&&R.green==null&&R.tree0!=null&&now>=R.tree0+1500)R.green=R.tree0+1500;   // the green lit between frames: not a red light
  if(R){if(R.green==null){R.foul=true;R.rt0=R.tree0!=null?+((now-(R.tree0+1500))/1000).toFixed(3):-9.999;}
    else{let rt=(now-R.green)/1000;if(DR.veh.transBrake==="trans_brake")rt=Math.max(0.001,rt-0.020);   // a trans-brake lets go quicker and the same every time
      R.rt0=+rt.toFixed(3);}}
  d.launch();DR.last=now;buzz([30]);}
function dragPress(){if(!DR||!DR.d||DR.failed)return;const d=DR.d,st=d.st,now=performance.now();
  if(DR.auto&&(st.phase==="burnout"||st.phase==="staged"||st.phase==="run")){dragTakeOver();return;}
  if(st.phase==="burnout"){DR.downAt=now;d.burn(true);buzz([15]);return;}
  if(st.phase==="staged"){if(!st.rolled)return;if(d.canArm){if(d.arm())buzz([20]);return;}dragGo(now);return;}
  if(st.phase==="shutdown"&&DR.pb){ENGINE_VIS.skipCut();return;}
  if(st.phase==="shutdown"&&DR.night&&DR.night.cheer){ENGINE_VIS.skipCut();return;}
  if(st.phase==="run")d.shift();}
function dragRelease(cancel){if(!DR||!DR.d)return;const d=DR.d,st=d.st,now=performance.now();
  if(st.phase==="burnout"&&DR.downAt!=null){const held=now-DR.downAt;DR.downAt=null;d.burn(false);if(held<300&&!cancel)dragStage();return;}
  if(st.phase==="staged"&&st.launch.armed){if(cancel){d.disarm();return;}dragGo(now);}}
(()=>{const b=$("dragBtn");
  b.addEventListener("pointerdown",e=>{e.preventDefault();DR&&(DR.lastPtr=performance.now());try{b.setPointerCapture(e.pointerId);}catch(x){}dragPress();});
  b.addEventListener("pointerup",e=>{DR&&(DR.lastPtr=performance.now());dragRelease(false);});
  b.addEventListener("pointercancel",e=>{DR&&(DR.lastPtr=performance.now());dragRelease(true);});
  b.addEventListener("contextmenu",e=>e.preventDefault());
  b.addEventListener("click",()=>{if(!DR||!DR.d||performance.now()-(DR.lastPtr||0)<800)return;const st=DR.d.st;
    if(DR.auto&&!DR.failed&&(st.phase==="burnout"||st.phase==="staged"||st.phase==="run")){dragTakeOver();return;}
    if(st.phase==="burnout")dragStage();else if(st.phase==="staged"){if(st.rolled)dragGo(performance.now());}else if(st.phase==="run")DR.d.shift();else if(st.phase==="shutdown"&&DR.pb)ENGINE_VIS.skipCut();});})();
/* ---- nitrous on the strip: bottle pressure (heater or weather), when the shot comes on, and a purge on the line ---- */
const N2O_ACT=[["window","Window switch","at the rpm window"],["mph40","At 40 mph","once it's hooked"],["mph60","At 60 mph","late, safe"],["shift2","After the 1-2","second gear on"]];
const N2OB={cooled:0,t:0};   // a bottle without a heater cools a little every pass and warms back over ~20 min (session only)
function n2oKit(){const k=SIM.OPT.nitrous[S.cfg.nitrous];return k&&k.shotHp?k:null;}
function n2oBottleNow(env){const e=env||stdEnv(),heat=(S.env.n2oHeater||"on")==="on";const cool=N2OB.cooled*Math.exp(-(Date.now()-N2OB.t)/1200000);return SIM.n2oBottle(heat,e.ambientC,heat?0:cool);}
function n2oVeh(env){const b=n2oBottleNow(env);const heat=(S.env.n2oHeater||"on")==="on";
  const psi=heat?b.psi+Math.round((Math.random()-0.5)*16):b.psi+Math.round((Math.random()-0.5)*50);   // a heater's thermostat holds it within a few psi; a bare bottle wanders
  return{act:S.env.n2oAct||"window",psi,line:0.15,purge:1};}
function n2oEnvHtml(){const k=n2oKit(),e=S.env,b=n2oBottleNow(),heat=(e.n2oHeater||"on")==="on",act=e.n2oAct||"window",q=quick&&quick.nitrous;
  return `<div class="lbl" style="margin-top:6px"><span>Nitrous · ${k.name}</span><b style="color:${b.psi<850||b.psi>1000?"var(--warn)":"var(--good)"}">${b.psi.toLocaleString("en-CA")} psi</b></div>
    <p class="hint" style="margin-top:-2px">Bottle at ${b.tempC} °C. ${heat?"The heater blanket holds it near 950 psi, so the shot is the same every pass.":b.psi<850?`Without a heater a ${b.tempC} °C bottle flows about ${Math.round((1-Math.pow(b.psi/950,0.85))*100)}% less shot, and less again every pass as it empties.`:b.psi>1000?"A hot bottle flows more nitrous than the kit was jetted for — that is how a dry kit goes lean.":"Close to where the kit was jetted."}${q&&q.backfire>0.02?` Backfire odds about ${Math.round(q.backfire*100)}% a pass.`:""}${q&&q.leanRisk>0.03?` Lean-spike odds about ${Math.round(q.leanRisk*100)}% a pass.`:""}</p>
    <div class="lbl"><span>Bottle heater</span></div><div class="seg">${[["on","On","holds ~950 psi"],["off","Off","follows the weather"]].map(([v,n,d])=>`<button data-lp="${v}" data-ek="n2oHeater" class="${(heat?"on":"off")===v?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>
    <div class="lbl"><span>Shot comes on</span></div><div class="seg n4">${N2O_ACT.map(([v,n,d])=>`<button data-lp="${v}" data-ek="n2oAct" class="${act===v?"on":""}" style="flex:1 1 40%">${n}<small>${v==="window"&&q?Math.round(q.winRpm).toLocaleString("en-CA")+" rpm":d}</small></button>`).join("")}</div>
    <p class="hint">Purge on the line: hold <b>PURGE</b> (or <kbd>P</kbd>) while staged until it spits white — that fills the line with liquid so the hit is full strength. An unpurged line sends gas first and the shot comes in soft.</p>`;}
function n2oStart(){let b=$("n2oPurge");const on=!!(DR.d&&DR.d.n2o);
  if(!on){if(b)b.style.display="none";DR.n2o=null;return;}
  if(!b){b=document.createElement("button");b.id="n2oPurge";b.className="btn sm";b.style.cssText="width:100%;min-height:44px;margin-top:8px;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none";
    $("dragBtn").insertAdjacentElement("afterend",b);
    const up=()=>n2oPurge(false);b.addEventListener("pointerdown",e=>{e.preventDefault();try{b.setPointerCapture(e.pointerId);}catch(x){}n2oPurge(true);});b.addEventListener("pointerup",up);b.addEventListener("pointercancel",up);b.addEventListener("lostpointercapture",up);b.addEventListener("contextmenu",e=>e.preventDefault());}
  b.style.display="";b.dataset.k="";DR.n2o={hiss:0,cut:false,ended:false,shotWas:0};if(soundReady)ENGINE_SOUND.nitrous(0);}
function n2oPurge(on){if(!DR||!DR.n2o||!DR.d)return;if(DR.d.purge(on)&&on){DR.n2o.hiss=0;buzz([10]);}}
function n2oFrame(st,dt){const z=st.n2oS,N=DR.n2o,b=$("n2oPurge");if(!z)return;
  const pre=st.phase==="burnout"||st.phase==="staged";
  if(z.purging){N.hiss-=dt;if(N.hiss<=0){sfx("purge");N.hiss=0.55;}}
  if(b){b.style.display=pre&&!DR.auto?"":"none";const lp=Math.round(z.psi*(0.55+0.45*z.line)),k=(z.purging?"P":"")+lp;if(b.dataset.k!==k){b.dataset.k=k;b.innerHTML=z.purging?`PURGING · ${lp} psi at the solenoid`:`HOLD TO PURGE · ${lp} psi${z.line<0.5?" · line full of gas":" · line purged"}`;}}
  const live=$("dragLive");
  if(pre)live.insertAdjacentHTML("beforeend",`<div class="peak"><b style="color:${z.line>=0.5?"var(--good)":"var(--warn)"}">${Math.round(z.psi*(0.55+0.45*z.line))}<i>psi</i></b><span>nitrous · ${z.purging?"purging":z.line>=0.5?"purged":"purge the line"} · bottle ${Math.round(z.psi)}</span></div>`);
  else if(st.phase==="run")live.insertAdjacentHTML("beforeend",`<div class="peak"><b style="color:${st.n2o>0.05?"var(--info)":""}">${z.cut?"CUT":st.n2o>0.05?"ON":z.on?"window":"armed"}</b><span>nitrous${z.on&&!z.cut?" · "+Math.round(z.psi)+" psi":""}</span></div>`);
  ENGINE_VIS.stripN2O({purge:z.purging?1:z.puff,n2o:st.n2o,cut:z.cut,phase:st.phase});
  if(soundReady)ENGINE_SOUND.nitrous(st.phase==="run"&&!DR.failed?st.n2o:0);
  if(z.cut&&!N.cut){N.cut=true;sfx("intakeBang");toast("BACKFIRE · burst panel blew, shot's off");buzz([60,30,60]);}
  if(DR.failed&&DR.failKind==="backfire"&&!N.bang){N.bang=true;sfx("intakeBang");}
  if(st.done&&!N.ended){N.ended=true;if((S.env.n2oHeater||"on")!=="on"&&z.on){N2OB.cooled=N2OB.cooled*Math.exp(-(Date.now()-N2OB.t)/1200000)+1.8;N2OB.t=Date.now();}if(soundReady)ENGINE_SOUND.nitrous(null);ENGINE_VIS.stripN2O(null);if(b)b.style.display="none";}}
function n2oSlip(n){const g=["1st","2nd","3rd","4th","5th","6th","7th"][Math.max(0,(n.onGear||1)-1)];
  return `${n.shotHp} shot ${n.cut?"cut by a backfire":n.on?`on ${n.act==="window"?"at the window":"at "+n.onMph+" mph"} in ${g}`:"never came on"} · ${n.psi.toLocaleString("en-CA")} psi${n.purged>0.3?` after a ${n.purged.toFixed(1)} s purge`:" · not purged"}`;}
/* P: purge while staged on the strip (hold); anywhere else with a kit fitted, a puff in the engine bay.
   While the auto driver has the car, P does nothing: the auto driver purges for itself and its PURGE button is hidden too
   (a tap on the big button or Space is how you take over) */
document.addEventListener("keydown",e=>{if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||typingIn(e.target)||e.key.toLowerCase()!=="p"||e.repeat)return;
  if(holdKind()==="drag"&&DR&&DR.n2o){if(!DR.auto)n2oPurge(true);e.preventDefault();return;}
  if(!testing&&n2oKit()&&$("intro").style.display==="none"){ENGINE_VIS.purge(0.8);sfx("purge");e.preventDefault();}});
document.addEventListener("keyup",e=>{if(e.key.toLowerCase()==="p"&&DR&&DR.n2o&&!DR.auto)n2oPurge(false);});
function dragFinish(){
  const {d,res,env,snap}=DR;const r=d.result();if(DR.drv)r.auto=DR.took!=null?{took:DR.took,pre:!!DR.tookPre}:{};const failed=DR.failed;const same=testSame(snap);
  const leave=()=>{if(testing)return;const b=ENGINE_VIS.stripBusy?ENGINE_VIS.stripBusy():0;if(b>0){setTimeout(leave,Math.min(1000,b*1000+60));return;}ENGINE_VIS.setStrip({on:false});$("app").classList.remove("onstrip");};
  setTimeout(leave,2200);
  testing=false;run.on=false;run.fail=false;run.rpm=0;$("rpmbox").style.display="none";$("dragCtl").style.display="none";$("testProg").classList.add("done");setTimeout(()=>{$("testProg").style.width="0";},700);ENGINE_VIS.setAutoRotate(null);if(!failed)sfx("bov");
  if(DR.race){const R=DR.race;const mine=r.et!=null&&!R.foul?r.et+Math.max(0,R.rt0||0):null;const theirs=R.et!=null?R.et+R.rt:null;
    const won=!failed&&mine!=null&&(theirs==null||mine<theirs);r.race={name:R.name,rt:R.rt0,oppRt:+R.rt.toFixed(3),oppEt:R.et,oppMph:R.mph,foul:R.foul,won,margin:mine!=null&&theirs!=null?+(theirs-mine).toFixed(3):null};}
  if(failed&&!r.broke&&(DR.failKind==="turbo"||DR.failKind==="manifold"))r.broke=DR.failKind;
  if(r.race)r.race.om=dhudOppMarks(DR.race);r.at=Date.now();shudStop(2200);   // the slip prints both lanes' splits
  if(DR.night&&same)rnAfterPass(r,failed);
  if(r.heat)HOTLAP[DR.hk]={t:Date.now(),egt:Math.max(600,r.heat.egtLine||0)};
  if(same)pbPass(r,failed);
  if(DR.veh&&DR.veh.dlCap)r.swap=swapTag();
  res.drag=r;res.dragFailed=failed;res.dragFailKind=failed?DR.failKind:null;S.last={hash:snap.h,cfg:snap.cfg,env,res};
  const abuse=r.heat?r.heat.abuse:0;
  if(career()&&same){addWear(1+abuse,DR.hk);const h=DR.hk;C().dragBest=C().dragBest||{};
    if(failed){C().cert=null;C().rep=Math.max(0,C().rep-2);if(DR.failKind==="manifold"||DR.failKind==="turbo")logEvent(`Strip: ${DR.failKind==="turbo"?"cooked the turbo":"cracked the exhaust manifold"} on the line — held the ${r.launch&&r.launch.ctl!=="none"?"two-step":"brake"} ${r.launch?r.launch.held.toFixed(1):"?"} s`,"bad");toast(DR.failKind==="turbo"?"COOKED THE TURBO · pass over":DR.failKind==="manifold"?"CRACKED MANIFOLD · pass over":`BROKE ON THE PASS · ${String(DR.failKind).toUpperCase()}`);}
    else if(r.et!=null&&r.mph>150&&!r.chute){C().rep=Math.max(0,C().rep-1);logEvent(`Strip: ${r.et.toFixed(2)} s @ ${r.mph} mph — BLACK-FLAGGED, no parachute`,"bad");toast("BLACK-FLAGGED · no parachute over 150 mph");}
    else if(DR.night){}   // race night: purse and rep are settled when the night ends (rnFinish)
    else if(r.race&&!r.race.won){C().rep=Math.max(0,C().rep-1);logEvent(`Strip: ${r.et!=null?r.et.toFixed(2)+" s":"DNF"} — ${r.race.foul?"red light":"lost to "+r.race.name+" by "+Math.abs(r.race.margin||0).toFixed(3)+" s"}`,"bad");toast(r.race.foul?"RED LIGHT · entry gone":`LOST by ${Math.abs(r.race.margin||0).toFixed(3)} s`);}
    else if(r.et!=null){const purse=(r.et<7?400:r.et<8?250:r.et<9?150:r.et<10?80:r.et<11?40:r.et<13?20:0)*(r.race?1.5:1);const rep=(r.et<8?3:r.et<10?2:r.et<12?1:0)+(r.race?1:0);C().cash+=purse;C().rep+=rep;logEvent(`Strip: ${r.et.toFixed(2)} s @ ${r.mph} mph — ${r.race?"beat "+r.race.name+", ":""}purse ${fmt$(purse)}`,purse>0?"good":"");if(!C().dragBest[h]||r.et<C().dragBest[h])C().dragBest[h]=r.et;if(r.et<(C().bestEt||99))C().bestEt=r.et;toast(`${r.et.toFixed(2)} s @ ${Math.round(r.mph)} mph · ${fmt$(purse)} purse`);}
    if(!failed)spEvent("drag",{win:!DR.night&&!!(r.race&&r.race.won)});
    hud();checkGoals();}
  else toast(failed?(DR.failKind==="turbo"?"COOKED THE TURBO":DR.failKind==="manifold"?"CRACKED MANIFOLD":"BROKE ON THE PASS"):r.et!=null?`${r.et.toFixed(2)} s @ ${Math.round(r.mph)} mph`:"Did not finish");
  achCheck({type:"drag",r,failed,res,env});if(r.swap)swapAfter(r);
  save();recompute();renderTest();
  revealVerdict();
}
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
/* the other lane's trace: the baseline, cut where the rival broke, then a coast to a stop past the stripe */
function rnOppTrace(N,op){return oppTrace(N.trace,op.broke?op.at*N.et0:Infinity,op.broke?2.5:N.lock.chute?9:6,N.et0+40);}
/* a [t,x] trace cut at time `cut`, then slowing at `dec` m/s² to a stop (both lanes: race nights and the test & tune mirror) */
function oppTrace(tr,cut,dec,tEnd){const out=[];let last=null,prev=null;
  for(const p of tr){if(p[0]>cut)break;out.push(p);prev=last;last=p;}
  if(!last)return[[0.05,0],[1,0]];let v=last[2]!=null?last[2]/2.23694:prev?(last[1]-prev[1])/Math.max(0.01,last[0]-prev[0]):10,x=last[1],t=last[0];   // [2] mph when the trace carries it (dragPass)
  while(v>1&&t<tEnd){t+=0.1;v=Math.max(0,v-dec*0.1);x+=v*0.1;out.push([+t.toFixed(2),+x.toFixed(1)]);}return out;}
/* race-night darkness for a stage, shared by the strip and the pits: Q1 dusk (0) to the final full dark (1); night mode on = dark all night */
function rnNightK(stage){return S.night?1:Math.min(1,(stage||0)/4);}
function rnStageName(N,s){return N.fmt==="bracket"&&s<2?RN_TT[s]:RN_STAGE[s];}
function rnOppIdx(N){if(N.stage<2)return N.qopp[N.stage];const m=N.rounds[N.stage-2].find(x=>x.a===0||x.b===0);return m?(m.a===0?m.b:m.a):1;}
function rnSuggest(N){const p=(N.passes||[]).filter(x=>x.et!=null&&!x.dq).slice(-1)[0];const et=p?p.et:N.et0;return Math.floor((et-0.01)*100)/100;}
function rnEnter(){const fmt=S.env.dragFmt;if(!RN_FMT[fmt])return;
  if(career()){if(!(C().cert&&C().cert.ok&&C().cert.hash===cfgHash(S.cfg))){toast("Certify this engine on the dyno first");return;}if(!has("race")){toast(`Needs the ${(UPGRADES.find(u=>u.id==="race")||{}).name} upgrade`);return;}}
  const veh=rnVeh(dragVeh()),b=rnBaseline(veh),body=veh.body||"street";
  if(career()&&b.mph>150&&!veh.chute){toast("Tech won't take it — over 150 mph needs a parachute");return;}
  const rnKey=fmt+":"+body;if(career()&&(C().rnDone||{})[rnKey]===C().week){toast(`One ${RN_FMT[fmt].toLowerCase()} night a week for the ${SIM.AERO[body].n} class — back next week`);return;}
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
  if(career()){(C().rnDone=C().rnDone||{})[rnKey]=C().week;C().cash-=entry;logEvent(`Race night: entered ${RN_FMT[fmt].toLowerCase()} (${SIM.AERO[body].n}) — ${fmt$(entry)} entry`);hud();}
  rnSetN(N);save();renderTest();toast(`${RN_FMT[fmt].toUpperCase()} · ${SIM.AERO[body].n.toUpperCase()} · 8 CARS`);buzz([20,30,20]);}
/* runTest on the drag tab: true when the race night took the click */
function rnGate(){const N=rnCur();
  if(!N){if(RN_FMT[S.env.dragFmt]){rnEnter();return true;}return false;}
  if(N.done){rnSetN(null);save();renderTest();return true;}
  if(cfgHash(S.cfg)!==N.hash){toast("That's not the engine you entered with — put it back, or leave the night");return true;}
  return false;}
/* dragStart, before the runner is built: tuning on the car; on a night the class lock, and the air (cooler air through the
   night is a few tenths of a percent more power — boost hides most of it) */
function rnPrep(veh,res,env){rnVeh(veh);const N=rnLive();if(!N)return;env.race="night";const a=1-(N.air[N.stage]||0)*(res.aspKind==="turbo"?0.4:1);
  if(a!==1){res.torque=res.torque.map(t=>t/a);if(res.naTorque)res.naTorque=res.naTorque.map(t=>t/a);res.peakTq/=a;}}
/* set up the pass against the rival in the other lane (called from dragStart instead of the mirror opponent) */
function rnRace(){const N=rnLive();if(!N)return;const i=rnOppIdx(N),rv=N.field[i-1],op=rnRivalAt(N,N.stage,i),br=N.fmt==="bracket"&&N.stage>=2;
  const k=op.et!=null?op.et/N.et0:rv.mean/N.et0;
  DR.race={trace:rnOppTrace(N,op),k,rt:op.rt,et:op.et,mph:op.mph,foul:false,rt0:null,tree0:null,green:null,name:rv.name,ofoul:op.rt<0};
  DR.night={stage:N.stage,label:rnStageName(N,N.stage),opp:i,op,dialP:br?N.dial:null,dialO:br?op.dial:null,verdict:null};
  DR.race.look=rivalLook(rv.name,rv.car,N.body,null);DR.race.fx=rnOppFx(N,rv,op);
  if(br){const h=rnTreeOffsets(N.dial,op.dial);DR.race.hcP=h.p;DR.race.hcO=h.o;}}
/* every frame: the other lane's tree, lights and numbers on the boards, and the round's verdict once you're past the stripe */
function rnFrame(now,st,dtT){const R=DR.race,n=DR.night;if(!R||!n)return;
  if(R.hcP!=null&&R.tree0!=null&&R.otree0==null){R.otree0=R.tree0+R.hcO*1000;R.tree0+=R.hcP*1000;R.ogreen=R.otree0+1500;}
  else if(R.hcP==null&&R.tree0!=null&&R.ogreen==null)R.ogreen=R.tree0+1500;   // heads-up: one tree; a rival who red-lights leaves before it goes green
  const g0=R.ogreen!=null?R.ogreen:R.green,dO=R.otree0!=null?(now-R.otree0)/1000:dtT,ox=oppX(now),left=g0!=null&&(now-g0)/1000>=R.rt||(R.ofoul&&ox>0.3);
  if(n.verdict==null&&(st.phase==="shutdown"||st.phase==="done")&&st.t>0){n.verdict=rnJudgePass(n,st);
    if(n.stage>=2&&n.verdict.win&&n.stage===4){n.cheer=true;ENGINE_VIS.stripWin&&ENGINE_VIS.stripWin();buzz([30,40,30,40,90]);}}
  ENGINE_VIS.stripRace&&ENGINE_VIS.stripRace({round:n.label,nightK:rnNightK(n.stage),pdial:n.dialP,odial:n.dialO,otree:R.otree0!=null?{a1:dO>=0,a2:dO>=0.5,a3:dO>=1.0,green:dO>=1.5}:undefined,
    ort:left?R.rt:undefined,ofoul:!!(R.ofoul&&left),oet:R.et!=null&&ox>=402.336?R.et:undefined,omph:R.et!=null&&ox>=402.336?R.mph:undefined,win:n.verdict&&n.stage>=2?!!n.verdict.win:undefined});}
function rnJudgePass(n,st){const R=DR.race,q=st.marks.find(m=>m.n==="1/4 mi"),bars=(SIM.AERO[DR.veh.body]||{}).bars;
  const rr=rnRng(rnHash(n.label+":"+(R.rt0||0)+":"+Math.round(st.x)));const pq=Math.min(0.8,(bars?0:Math.max(0,(st.wheelieT-0.35)*1.2))+Math.max(0,((st.shakeT||0)-0.25)*1.0));
  const dq=!DR.failed&&!R.foul&&pq>0&&rr()<pq;   // pedalling a wheelie or riding out tyre shake can put it over the centreline
  const a={rt:R.rt0,et:DR.failed||!q?null:q.t,dial:n.dialP,dq,x:st.x},b={rt:R.rt,et:R.et,dial:n.dialO,dq:false,x:n.op.broke?402*n.op.at:402};
  const j=rnJudge(a,b,n.dialP!=null);return{win:j.w===0,why:j.why,margin:j.margin,holeshot:!!j.holeshot&&j.w===0,dq,a,b};}
function rnLabelWhy(v,name,br){const A=v.a,B=v.b,m=v.margin!=null?v.margin.toFixed(3):"";
  switch(v.why){
    case "red":return v.win?`${name} red-lit (${B.rt.toFixed(3)}) — the round is yours`:A.rt!=null&&B.rt!=null&&B.rt<0?`Both red — you went first (${A.rt.toFixed(3)})`:`Red light (${A.rt!=null?A.rt.toFixed(3):"early"}) — you left before the green`;
    case "line":return v.win?`${name} crossed the centreline`:`Crossed the centreline — ${v.dq?"pedalling it":"disqualified"}; the round goes the other way`;
    case "dnf":return v.win?`${name} broke — a single, and you made a clean pass`:`Didn't make it to the stripe — ${name} takes the round`;
    case "dnf2":return v.win?"Neither car finished — you got further":"Neither car finished — they got further";
    case "bo":return v.win?`${name} broke out by ${m} (ran ${B.et.toFixed(3)} on a ${B.dial.toFixed(2)})`:`Broke out by ${m} — ran ${A.et.toFixed(3)} on a ${A.dial.toFixed(2)} dial`;
    case "bo2":return v.win?`Both broke out — yours was smaller by ${m}`:`Both broke out — theirs was smaller by ${m}`;
    default:return br?`${v.win?"Won":"Lost"} on the package by ${m} — RT ${A.rt.toFixed(3)}, ${(A.et-A.dial>=0?"+":"")+(A.et-A.dial).toFixed(3)} on the dial vs ${B.rt.toFixed(3)}, ${(B.et-B.dial>=0?"+":"")+(B.et-B.dial).toFixed(3)}`
      :v.win?(v.holeshot?`Holeshot win by ${m} — they ran ${B.et.toFixed(3)}, quicker than your ${A.et.toFixed(3)}, but your ${A.rt.toFixed(3)} light beat their ${B.rt.toFixed(3)}`:`Won by ${m} to the stripe`)
      :(B.et>A.et?`Holeshot by ${name} — you were quicker on the clock but their ${B.rt.toFixed(3)} light beat your ${A.rt.toFixed(3)}; lost by ${m}`:`Lost by ${m} to the stripe`);}}
/* after the pass: record it, settle the round, play the AI matches, move the night on */
function rnAfterPass(r,failed){const N=rnLive(),n=DR.night;if(!N||!n||n.stage!==N.stage)return;const st=DR.d.st,R=DR.race,rv=N.field[n.opp-1];
  if(n.verdict==null)n.verdict=rnJudgePass(n,st);const v=n.verdict,bf=career()&&r.et!=null&&r.mph>150&&!r.chute;
  const p={stage:N.stage,rt:R.rt0,et:failed?null:r.et,mph:failed?null:r.mph,sixty:r.sixty?r.sixty.t:null,spin:r.spinTime,shake:+(st.shakeT||0).toFixed(2),foul:!!R.foul,dq:v.dq,dial:n.dialP,
    tune:{launch:DR.veh.launchRpm,first:DR.veh.first,final:DR.veh.final,psi:DR.veh.tyrePsi||null,shocks:DR.veh.shocks||"medium"}};
  N.passes.push(p);N.last=p;const br=N.fmt==="bracket",opName=rv.name;let text,win=null,out=failed||bf;
  if(N.stage<2){N.q[N.stage][0]=p;for(let i=1;i<8;i++)N.q[N.stage][i]=rnRivalAt(N,N.stage,i);
    text=failed?"Broke on the qualifying pass — out of the night":bf?"Black-flagged at tech — no parachute over 150 mph":`${p.et!=null?p.et.toFixed(3)+" @ "+Math.round(p.mph):"no time"}${br?"":" — "+(p.et!=null?"it counts toward your seed":"keep the other run")}`;
    N.hist.push({stage:N.stage,label:n.label,opp:n.opp,p,o:n.op,text});
    if(out){rnFinish(N,9);}
    else if(++N.stage===2){N.seeds=rnSeeds(N);if(br)N.dial=rnSuggest(N);N.rounds=[rnPairs(N.seeds).map(([a,b])=>({a,b,win:null}))];rnResolve(N,0);}}
  else{const ri=N.stage-2,m=N.rounds[ri].find(x=>x.a===0||x.b===0);win=!out&&v.win;if(out&&!v.win)win=false;
    text=failed?`Broke — ${opName} takes the round`:bf?"Black-flagged at tech — no parachute over 150 mph":rnLabelWhy(v,opName,br);
    const pp=m.a===0?"pa":"pb",po=m.a===0?"pb":"pa";m[pp]=p;m[po]=n.op;m.win=win?0:n.opp;m.why=v.why;m.margin=v.margin;m.text=text;
    N.hist.push({stage:N.stage,label:n.label,opp:n.opp,p,o:n.op,win,text});
    if(win)N.won++;
    if(!win||out){for(let k=ri;k<3;k++){rnResolve(N,k);if(k<2&&!N.rounds[k+1])N.rounds[k+1]=rnNextPairs(N.rounds[k]);}rnFinish(N,ri===0?5:ri===1?3:2);}
    else if(ri===2)rnFinish(N,1);
    else{N.stage++;N.rounds[ri+1]=rnNextPairs(N.rounds[ri]);rnResolve(N,ri+1);if(br)N.dial=N.dial||rnSuggest(N);}}
  r.night={fmt:N.fmt,stage:p.stage,label:n.label,opp:opName,car:rv.car,win,text,dialP:n.dialP,dialO:n.dialO,oppRt:n.op.rt,oppEt:n.op.et,oppMph:n.op.mph,oppBroke:!!n.op.broke,place:N.done?N.place:null};
  if(r.race){r.race.won=win===true;if(v.margin!=null)r.race.margin=win?v.margin:-v.margin;}
  rnSetN(N);const msg=N.done?`${RN_PLACE[N.place].toUpperCase()}${N.paid?" · "+fmt$(N.paid):""}`:p.stage<2?`${n.label} · ${p.et!=null?p.et.toFixed(3):"NO TIME"}`:`${win?"WON":"OUT"} · ${n.label}`;
  setTimeout(()=>{if(r.pb)setTimeout(()=>toast(msg),2800);else toast(msg);},0);}   // after the pass's own toast (and a PB's)
function rnFinish(N,place){if(N.done)return;N.done=true;N.place=place;N.out=place!==1;
  const rep=N.won+(place===1?2:0)+(N.fmt==="elim"&&N.seeds&&N.seeds[0]===0?1:0),paid=Math.round(N.purse*RN_PAY[place]/50)*50;N.paid=paid;N.rep=rep;
  const best=(N.passes||[]).filter(p=>p.et!=null).reduce((a,p)=>a&&a.et<=p.et?a:p,null);N.best=best?{et:best.et,mph:best.mph}:null;
  const R=recs();R.nightsRun=(R.nightsRun||0)+1;if(place===1)R.nightsWon=(R.nightsWon||0)+1;if(!(R.bestFinish<=place))R.bestFinish=place;
  const cls=SIM.AERO[N.body].n,last=N.hist[N.hist.length-1];
  if(career()){C().cash+=paid;C().rep+=rep;logEvent(`Race night · ${cls} ${N.fmt==="bracket"?"bracket":"heads-up"}: ${place===1?"WON — beat "+(rnPart(N,last.opp).name)+" in the final":(N.left?"left the night":RN_PLACE[place].toLowerCase()+(last&&last.text?", "+last.text.split(" — ")[0].toLowerCase():""))}${best?", best "+best.et.toFixed(2):""} — purse ${fmt$(paid)}${rep?", +"+rep+" rep":""}`,place<=2?"good":paid>0?"":"bad");spEvent("night",{win:place===1,finish:place>1&&place<=3,noCount:!!N.left&&place===9});hud();checkGoals();}}
function rnLeave(){const N=rnLive();if(!N||testing)return;if(!confirm(N.stage<2?"Leave the night? Your entry is gone and you go home without a seed.":"Leave the night? You forfeit this round and take the purse for going out here."))return;
  if(N.stage>=2){const ri=N.stage-2,m=N.rounds[ri].find(x=>x.a===0||x.b===0);m.win=m.a===0?m.b:m.a;m.why="left";m.text="Didn't come to the line";N.hist.push({stage:N.stage,label:rnStageName(N,N.stage),opp:m.win,win:false,text:"Left the night — forfeit"});
    N.left=true;for(let k=ri;k<3;k++){rnResolve(N,k);if(k<2&&!N.rounds[k+1])N.rounds[k+1]=rnNextPairs(N.rounds[k]);}rnFinish(N,ri===0?5:ri===1?3:2);}
  else{N.left=true;N.hist.push({stage:N.stage,label:rnStageName(N,N.stage),text:"Left the night"});rnFinish(N,9);}
  rnSetN(N);save();renderTest();toast("Loaded up and went home");}
/* ---- race-night panel (replaces the drag set-up on the Test tab while a night is on) ---- */
const rnEsc=v=>String(v==null?"":v).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
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
        chips+=`<button class="${cls}" style="${row}" data-rnlg="${i}" aria-label="${rnEsc(P.name)}${i?" · "+rnEsc(P.car):""}">${rnSil(N.body,rnPaint(N,i))}<em${done&&p&&br&&p.dial!=null&&p.et!=null&&p.et<p.dial?' class="bo" title="broke out"':""}>${done&&p?rnPT(p,false):seedOf(i)?"#"+seedOf(i):""}</em><span>${i===0?"YOU":rnEsc(shSur(P.name))}</span></button>`;});
      // the bracket lines into the next round, the winner's path drawn over in green (orange when it's you)
      const ya=yc(ri,mi*2),yb=yc(ri,mi*2+1),ym=ri<2?yc(ri+1,mi):50,xm=(xr[ri]+xl[ri])/2;
      lines+=`<path d="M${xr[ri]} ${ya}H${xm}V${yb}H${xr[ri]}M${xm} ${(ya+yb)/2}V${ym}H${xl[ri]}"/>`;
      if(m.win!=null){const yw=m.win===m.a?ya:yb;lit+=`<path class="${m.win===0?"y":"w"}" d="M${xr[ri]} ${yw}H${xm}V${ym}H${xl[ri]}"/>`;}});}
  RNLG.seen=seen;
  const fm=N.rounds[2]&&N.rounds[2][0],champ=fm&&fm.win!=null?fm.win:null;
  const tro=`<div class="rntro${champ!=null?" on":""}${champ===0?" you":""}"><svg viewBox="0 0 36 40" aria-hidden="true"><path d="M9 3h18v8c0 6-4 10.5-9 10.5S9 17 9 11zM9 6H3.5c0 5 2.5 8 6.5 8.5M27 6h5.5c0 5-2.5 8-6.5 8.5M15.5 21.5h5v6h-5zM11 27.5h14l1.5 6h-17z"/></svg><small>${champ!=null?(champ===0?"YOU":rnEsc(shSur(rnPart(N,champ).name))):N.purse>=1000?"$"+Math.round(N.purse/1000)+"k":fmt$(N.purse)}</small></div>`;
  const sel=RNLG.sel!=null&&(RNLG.sel===0||N.field[RNLG.sel-1])?rnLgDetail(N,RNLG.sel):"";
  return`<div class="rnlg"><div class="rnlgh"><i>Quarter</i><i>Semi</i><i>Final</i><i>Cup</i></div><div class="rnlgb"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}${lit}</svg>${chips}${tro}</div><div class="rnlgx"${sel?"":" hidden"}>${sel}</div></div>`;}
function rnLgDetail(N,i){const P=rnPart(N,i),br=N.fmt==="bracket",q=rnQualBest(N,i),rv=i?N.field[i-1]:null,seed=N.seeds?N.seeds.indexOf(i)+1:null;let h=`<b>${rnEsc(i===0?"You · "+P.car:P.name)}</b><span>${i===0?(SIM.AERO[N.body]||{}).n||"":rnEsc(P.car)}${seed?" · seed #"+seed:""}${br&&rv?" · dial "+rv.dial.toFixed(2):""}${q?` · qualified ${q.et.toFixed(3)}`:""}</span>`;
  (N.rounds||[]).forEach((ms,ri)=>{const m=ms.find(x=>x.a===i||x.b===i);if(!m)return;const o=m.a===i?m.b:m.a,p=m.a===i?m.pa:m.pb;if(o==null)return;
    h+=`<div><span>${["QF","SF","Final"][ri]} vs ${o===0?"you":rnEsc(rnPart(N,o).name)}</span><span>${p?rnPT(p,br):""}${m.win==null?" · to run":m.win===i?' · <span style="color:var(--good)">won</span>':" · out"}</span></div>`;});
  return h;}
$("envBox").addEventListener("click",e=>{const b=e.target.closest("[data-rnlg]");if(!b)return;const N=rnCur();if(!N)return;const i=+b.dataset.rnlg,box=b.closest(".rnlg");
  RNLG.sel=RNLG.sel===i?null:i;box.querySelectorAll(".rnk.sel").forEach(x=>x.classList.remove("sel"));box.querySelectorAll(".rnk.adv").forEach(x=>x.classList.remove("adv"));
  if(RNLG.sel!=null)box.querySelectorAll(`[data-rnlg="${i}"]`).forEach(x=>x.classList.add("sel"));const x=box.querySelector(".rnlgx");x.innerHTML=RNLG.sel!=null?rnLgDetail(N,i):"";x.hidden=RNLG.sel==null;buzz(3);});
function rnQualHtml(N){const br=N.fmt==="bracket",ids=[0,1,2,3,4,5,6,7],q=N.stage,best=i=>{const b=rnQualBest(N,i);return b?b.et:Infinity;};
  const ord=q>0?ids.slice().sort((a,b)=>best(a)-best(b)||a-b):ids;
  return`<div class="rnq">${ord.map((i,k)=>{const P=rnPart(N,i),rv=i?N.field[i-1]:null,b=rnQualBest(N,i);
    return`<div class="${i===0?"you":""}"><i>${q>0&&!br?k+1:""}</i><span>${rnEsc(P.name)}<small>${rnEsc(P.car)}</small></span><b>${b?b.et.toFixed(3):q>0?"—":br&&rv?"dial "+rv.dial.toFixed(2):""}</b></div>`;}).join("")}</div>`;}
function rnTuneRows(N){const lt=SIM.launchTech(S.cfg),two=lt.launchCtl!=="none",t0=N.t0,psi0=SIM.TYRES[N.lock.tyre].psi||16,psi=S.env.tyrePsi>0?S.env.tyrePsi:psi0,sh=S.env.shocks||"medium";
  const L=two?lt.twoStepRpm:Math.min(S.env.launchRpm,S.cfg.redline);
  const row=(k,lbl,val,sub)=>`<div class="rnt"><span>${lbl}<small>${sub||""}</small></span><button class="nud" data-rn="tune" data-k="${k}" data-d="-1" aria-label="less">−</button><b>${val}</b><button class="nud" data-rn="tune" data-k="${k}" data-d="1" aria-label="more">+</button></div>`;
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
  const wi=wearInfo(quick);if(wi){const c=freshenCost(quick);h+=`<div class="rnt"><span>Wear<small>${wi.passes} of ${wi.budget} passes${wi.w>=1?" · past budget, parts start letting go":""}</small></span><b style="color:${wi.w>=1?"var(--crit)":wi.w>0.6?"var(--warn)":"var(--good)"}">${Math.round(wi.w*100)}%</b>${wi.w>0?`<button class="btn sm" data-rn="freshen">Freshen · ${fmt$(c)}</button>`:""}</div>`;}
  else if(!career())h+=`<p class="hint" style="margin:6px 0 0">Sandbox: no wear on the parts.</p>`;
  return h+`</div>`;}
function rnNextHtml(N){const br=N.fmt==="bracket",i=rnOppIdx(N),rv=N.field[i-1],qb=rnQualBest(N,i),rd=N.stage>=2,ri=N.stage-2;
  const win=rd?Math.round(N.purse*(ri===2?1:ri===1?0.45:0.2)/50)*50:0,lose=rd?Math.round(N.purse*RN_PAY[ri===0?5:ri===1?3:2]/50)*50:0;
  const h=rd&&br?rnTreeOffsets(N.dial,rv.dial):null;
  return`<div class="rnnext"><span>NEXT · ${rnStageName(N,N.stage)}</span><b>${rd&&N.seeds?"#"+(N.seeds.indexOf(i)+1)+" ":""}${rnEsc(rv.name)}</b><small>${rnEsc(rv.car)}${br?` · dial ${rv.dial.toFixed(2)}`:qb&&qb.et!=null?` · qualified ${qb.et.toFixed(3)}`:` · runs about ${rv.mean.toFixed(2)}`}${rd?` · win ${fmt$(win)} / out ${fmt$(lose)}${career()?"":" (sandbox)"}`:""}</small>${h?`<small>${h.p>0?`Their tree starts first — you go ${h.p.toFixed(2)} s after them`:h.o>0?`Your tree starts first — ${h.o.toFixed(2)} s head start`:"Same dial — the trees come down together"}</small>`:""}</div>`;}
function rnSummaryHtml(N){const br=N.fmt==="bracket",b=N.best,rts=(N.passes||[]).filter(p=>p.rt!=null&&p.rt>=0).map(p=>p.rt);
  return`<div class="rnsum ${N.place===1?"won":""}"><div class="big">${N.left&&N.place===9?"LEFT THE NIGHT":RN_PLACE[N.place].toUpperCase()}</div><p>${RN_FMT[N.fmt]} · ${SIM.AERO[N.body].n}${N.week!=null?" · week "+N.week:""}</p>
  <div class="vstats"><div><b>${N.won}</b><span>rounds won</span></div><div><b>${b?b.et.toFixed(3):"—"}</b><span>best ET${b&&b.mph?" · "+Math.round(b.mph):""}</span></div><div><b>${rts.length?Math.min.apply(null,rts).toFixed(3):"—"}</b><span>best light</span></div><div><b>${fmt$(N.paid||0)}</b><span>purse${career()?"":" (sandbox)"}</span></div><div><b>${career()?"+"+(N.rep||0):"—"}</b><span>rep</span></div></div>
  <div class="log" style="margin-top:8px">${N.hist.map(x=>`<div><b>${x.label}</b>${x.opp?"vs "+rnEsc(rnPart(N,x.opp).name)+" · ":""}${rnEsc(x.text||"")}</div>`).join("")}</div>
  <button class="btn pri" data-rn="done" style="width:100%;margin-top:10px">Done — back to the pits</button></div>`;}
function rnPanel(){const N=rnCur();if(!N)return"";const br=N.fmt==="bracket";
  let h=`<div class="rn"><div class="rnhd"><div><b>${RN_FMT[N.fmt].toUpperCase()}</b><span>${SIM.AERO[N.body].n} · 8 cars · winner ${fmt$(N.purse)}${career()?"":" (sandbox)"}</span></div>${N.done?"":`<button class="btn sm ghost" data-rn="leave">Leave the night</button>`}</div>`;
  h+=`<div class="rnsteps">${[0,1,2,3,4].map(s=>`<i class="${s<N.stage||N.done&&s<=N.stage?"d":s===N.stage&&!N.done?"on":""}">${br&&s<2?"TT"+(s+1):["Q1","Q2","QF","SF","F"][s]}</i>`).join("")}</div>`;
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
  ENGINE_VIS.setPits({on:true,body:N.body,color:carPaint(),hw:stripHw(S.cfg),tyreIn:veh.tyreDia,nightK:rnNightK(N.stage),
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
function dragDriveHtml(night){const on=dragAuto();
  return`<div class="lbl"><span>Driver</span></div><div class="seg">${[["you","You drive","burnout, stage, the light, the shifts"],["auto","Auto","a steady hand · watch the pass"]].map(([k,n,d])=>`<button data-lp="${k}" data-ek="dragDrive" class="${(on?"auto":"you")===k?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>`
    +(on?`<p class="hint">The auto driver does the burnout, stages${n2oKit()?", purges the nitrous":""}${(()=>{const lt=SIM.launchTech(S.cfg);return lt.launchCtl!=="none"||lt.transBrake==="trans_brake"||alsOf(S.cfg);})()?", arms the launch on the ambers":""} and leaves on the green with a good, human light — a red is rare. ${S.env.shiftMode==="manual"?"It shifts near the best point for this engine's curve. ":""}Launch rpm${n2oKit()?", the nitrous switch":""} and the chute stay as you set them. Steady, not perfect: a sharp light and good shifts beat it.${night?" It drives every pass of the night.":""} Tap ${document.documentElement.classList.contains("desk")?"the button or Space":"the button"} during a pass to take over.</p>`:"");}
function rnFmtHtml(){const f=RN_FMT[S.env.dragFmt]?S.env.dragFmt:"test";
  let h=`<div class="lbl"><span>Race format</span></div><div class="seg n3">${[["test","Test & tune","single pass"],["elim","Eliminations","8-car ladder"],["bracket","Bracket","dial-in"]].map(([k,n,d])=>`<button data-lp="${k}" data-ek="dragFmt" class="${f===k?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>`;
  if(f!=="test")h+=`<p class="hint" style="margin-top:-4px"><b>${RN_FMT[f]}</b> · ${f==="elim"?"two qualifying passes set your seed, then quarter-final, semi and final against seven cars of your class. First to the stripe wins — a quick light beats a quick car. Red light or crossing the centreline loses.":"dial in the ET you expect. The slower dial leaves first; first to the stripe wins unless they ran under their dial (a breakout). Both under: the smaller breakout wins. Consistency beats horsepower."} ${career()?`Entry about 8% of the winner's purse (from $150), fuel per pass. Same rules as a pass: certified engine, ${(UPGRADES.find(u=>u.id==="race")||{}).name} upgrade.`:"Free in the sandbox."} Set the car up below — body, tyre and weight lock when you enter.</p>`;
  return h;}
function rnTuneEnvHtml(sl){const e=S.env,psi0=(SIM.TYRES[e.tyre]||SIM.TYRES.street).psi||16,sh=e.shocks||"medium";
  return`<div class="envgrid">${sl("tyrePsi","Tyre pressure",+(psi0*0.5).toFixed(1),+(psi0*1.4).toFixed(1),0.5," psi",e.tyrePsi>0?e.tyrePsi:psi0)}</div><div class="lbl"><span>Shocks</span></div><div class="seg n3">${[["soft","Soft","more bite · lifts"],["medium","Medium","as delivered"],["firm","Firm","flat · may spin"]].map(([k,n,d])=>`<button data-lp="${k}" data-ek="shocks" class="${sh===k?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>`;}
function rnRunBtn(){const N=rnCur(),b=$("runTest");if(testing)return;
  if(!N){if(RN_FMT[S.env.dragFmt]){b.textContent=`Enter the night · ${RN_FMT[S.env.dragFmt].toLowerCase()}${career()?" · entry":""}`;$("dynoHint").innerHTML=`<b>Race night</b> · ${career()?"the entry is charged when you go in; ":""}two ${S.env.dragFmt==="bracket"?"time trials":"qualifying passes"}, then up to three rounds. Space or the big button drives every pass, same as a single run.`;}return;}
  if(N.done){b.textContent="Close the night";$("dynoHint").innerHTML="";return;}
  const i=rnOppIdx(N),fb=fuelBill();b.textContent=`Stage · ${rnStageName(N,N.stage).toLowerCase().replace(/^./,c=>c.toUpperCase())} vs ${N.field[i-1].name.split(" ")[0]}${career()&&fb?" · fuel "+fmt$(fb):""}`;
  $("dynoHint").innerHTML=N.fmt==="bracket"?`<b>Bracket</b> · your dial ${N.stage>=2?N.dial.toFixed(2):"— set after the time trials"}. Leave on the green of <i>your</i> tree; a red light loses outright.`:`<b>Heads-up</b> · first to the stripe. Your reaction time counts — a good light is under 0.100.`;}
function rnRecHtml(){const R=recs();if(!R.nightsRun)return"";return`<div class="rec"><span>Race nights</span><b>${R.nightsWon||0}<i>of ${R.nightsRun} won</i></b><small>best finish: ${(RN_PLACE[R.bestFinish]||"—").toLowerCase()}</small></div>`;}
function rnSlipHtml(r){const n=r.night;if(!n)return"";return`<div class="sec"><h2>${n.label}${n.win===true?" · won":n.win===false?" · out":""}</h2><div class="log"><div><b>vs</b>${rnEsc(n.opp)} · ${rnEsc(n.car)} — RT ${n.oppRt!=null?n.oppRt.toFixed(3):"—"}${n.oppBroke?" · broke":n.oppEt!=null?" · "+n.oppEt.toFixed(3)+" @ "+Math.round(n.oppMph):""}${n.dialO!=null?" on a "+n.dialO.toFixed(2):""}</div>${n.dialP!=null?`<div><b>Dial</b>${n.dialP.toFixed(2)}${r.et!=null?" · ran "+(r.et-n.dialP>=0?"+":"")+(r.et-n.dialP).toFixed(3):""}</div>`:""}<div>${rnEsc(n.text)}</div></div></div>`;}
function rnVerdict(r){const n=r.night,R=r.race;const cls=n.win===true?"pass":n.win===false?"fail":r.et==null?"fail":"marg";
  return`<div class="verdict ${cls}"><div style="flex:1"><div class="big">${n.label}${n.win===true?" · WON":n.win===false?" · OUT":""}<br><span style="font-size:.7em;opacity:.85">${r.et!=null?r.et.toFixed(3)+" s @ "+Math.round(r.mph)+" mph":"DID NOT FINISH"}${R&&R.rt!=null?" · RT "+(R.foul?"red":R.rt.toFixed(3)):""}</span></div><p>${rnEsc(n.text)}</p>${r.auto?`<p>${dragAutoWord(r.auto)}</p>`:""}${n.place?`<p><b>${RN_PLACE[n.place]}</b> — the night's summary is up top.</p>`:""}<div class="vstats">${r.marks.map(m=>`<div><b>${m.t.toFixed(2)}</b><span>${m.n}${m.n==="1/8 mi"||m.n==="1/4 mi"?" · "+Math.round(m.mph)+" mph":""}</span></div>`).join("")}</div></div></div>`;}
function rnHud(st){const n=DR.night,R=DR.race;if(!n)return;const L=$("dragLive");let s=`${n.label} · vs ${rnEsc(R.name)}`;
  if(n.dialP!=null)s+=` · dial ${n.dialP.toFixed(2)} vs ${n.dialO.toFixed(2)}`;
  if(st.phase==="staged"&&R.hcP!=null&&R.otree0==null)s+=R.hcP>0?` · you go ${R.hcP.toFixed(2)} s after them`:R.hcO>0?` · ${R.hcO.toFixed(2)} s head start`:"";
  if(n.verdict&&n.stage>=2)s+=` · <b style="color:${n.verdict.win?"var(--good)":"var(--crit)"}">${n.verdict.win?"WIN":"LOSS"}</b>`;
  L.insertAdjacentHTML("afterbegin",`<div class="peak rnhud" style="grid-column:1/-1;padding:6px 10px"><span style="margin:0">${s}</span></div>`);
  if(n.cheer&&st.phase==="shutdown"&&ENGINE_VIS.stripPb().shot==="crowd")dragBtnText("WON THE NIGHT","tap to go back to the car");}
$("envBox").addEventListener("click",e=>{const b=e.target.closest("[data-rn]");if(!b)return;const a=b.dataset.rn,N=rnCur();
  if(a==="done"){rnSetN(null);save();renderTest();return;}
  if(a==="leave"){rnLeave();return;}
  if(!N||N.done||testing)return;
  if(a==="tune"){const k=b.dataset.k,d=+b.dataset.d,lt=SIM.launchTech(S.cfg),t0=N.t0,cl=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
    if(k==="launch"){if(lt.launchCtl!=="none")S.cfg.twoStepRpm=cl(lt.twoStepRpm+100*d,2000,S.cfg.redline);else S.env.launchRpm=cl(Math.min(S.env.launchRpm,S.cfg.redline)+100*d,1500,S.cfg.redline);}
    else if(k==="first")S.env.first=+cl(+S.env.first+0.05*d,Math.min(+S.env.first,t0.first*0.8),Math.max(+S.env.first,t0.first*1.25)).toFixed(2);
    else if(k==="final")S.env.final=+cl(+S.env.final+0.05*d,Math.min(+S.env.final,t0.final*0.85),Math.max(+S.env.final,t0.final*1.2)).toFixed(2);
    else if(k==="psi"){const p0=SIM.TYRES[N.lock.tyre].psi||16;S.env.tyrePsi=+cl((S.env.tyrePsi>0?S.env.tyrePsi:p0)+0.5*d,+(p0*0.5).toFixed(1),+(p0*1.4).toFixed(1)).toFixed(1);}
    buzz(3);}
  else if(a==="shock"){S.env.shocks=b.dataset.k;}
  else if(a==="dial"){N.dial=+(N.dial+0.01*+b.dataset.d).toFixed(2);rnSetN(N);}
  else if(a==="dialsug"){N.dial=rnSuggest(N);rnSetN(N);}
  else if(a==="freshen"){const c=freshenCost(quick);if(!career())return;if(C().cash<c){toast("Not enough cash for a freshen");return;}C().cash-=c;C().wear[hKey(cfgHash(S.cfg))]=0;logEvent(`Freshened ${engineName()} between rounds — ${fmt$(c)}`);hud();toast("Rings, bearings and a hone — like new");}
  save();const sc=$("panel").scrollTop;renderEnv();$("panel").scrollTop=sc;});
$("envBox").addEventListener("click",e=>{if(e.target.closest('[data-ek="tyre"],[data-ek="body"]')&&S.env.tyrePsi!=null){delete S.env.tyrePsi;renderEnv();save();}});
async function shareSlip(l){try{await document.fonts.ready;}catch(e){}const c=slipCanvas(l);
  const blob=await new Promise(r=>c.toBlob(r,"image/png"));
  // published page: the viewer hands the file over (share sheet on iOS, download elsewhere)
  const dl=window.claude&&window.claude.use?await window.claude.use("downloads"):null;
  if(dl){try{await dl.save({filename:"timing-slip.png",data:blob});toast("Slip saved");}catch(e){if(e&&e.code!=="declined")toast("Couldn't save the slip here");}return;}
  const file=new File([blob],"timing-slip.png",{type:"image/png"});
  if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:"Timing slip"});return;}catch(e){}}
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="timing-slip.png";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);}
/* drag button: see dragPress / dragRelease above */

