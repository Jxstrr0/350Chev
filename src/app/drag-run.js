/* ===== DRAG RUN: the pass itself (app-late.js, since 1.76.140.0) =====
   Moved out of app/drag.js so a first visit downloads less: the pass (dragStart, the burnout › stage › launch button, the tree, the
   auto driver, nitrous, the finish), the race and bracket nights as they are run (rnRace, rnAfterPass, rnLeave…), the strip HUD and
   the time slip picture (slipCanvas, shareSlip). It comes in app-late.js, fetched once the garage is up (app/late.js), and runs as a
   classic script, so it shares the page's names. The drag setup screen waits for it as well as for the physics (simNeeds,
   app/simlate.js: "Loading the track…"); the page calls into it only through the LATE_FNS stand-ins in app/late.js.
   What the setup screen, the results, the records and the career read stays in app/drag.js. */
/* back-to-back launches: the turbine and manifold are still hot from the last hold (kept for the session, not saved) */
const HOTLAP={};
function soakFor(h){const x=HOTLAP[h];if(!x)return 0;return Math.max(0,(x.egt-420)*0.6*Math.exp(-(Date.now()-x.t)/90000));}
function oppX(now){const R=DR&&DR.race,g0=R&&(R.ogreen!=null?R.ogreen:R.green);if(!R||g0==null)return 0;const tt=((now-g0)/1000-R.rt)/R.k;const tr=R.trace;if(tt<=0||!tr.length)return 0;let i=1;while(i<tr.length&&tr[i][0]<tt)i++;const a=tr[Math.max(0,i-1)],b=tr[Math.min(tr.length-1,i)];const f=b[0]>a[0]?(tt-a[0])/(b[0]-a[0]):0;return a[1]+(b[1]-a[1])*Math.max(0,Math.min(1,f));}
/* the three steps before a pass (burnout, stage, launch): the strip over the big button lights the one you're on */
function dragStepsShow(){const el=$("dragSteps");if(!el)return;const st=DR&&DR.d&&!DR.failed?DR.d.st:null,ph=st&&st.phase;
  const k=!st?0:ph==="burnout"?(st.burning||!(st.burnT>0)?1:2):ph==="staged"?(st.rolled?3:2):0;
  if(el.dataset.k===String(k))return;el.dataset.k=k;el.hidden=!k;el.querySelectorAll("i").forEach((x,j)=>{x.className=j+1<k?"done":j+1===k?"on":"";});}
function dragBtnText(t,sub){dragStepsShow();const b=$("dragBtn");if(DR&&DR.auto&&!DR.failed&&DR.d&&/^(burnout|staged|run)$/.test(DR.d.st.phase)){t="AUTO";sub="auto driver on it — tap to take over";}const k=t+"|"+(sub||"");if(b.dataset.k===k)return;b.dataset.k=k;b.innerHTML=t+(sub?`<small style="display:block;font-size:12px;letter-spacing:.5px;opacity:.75;margin-top:2px">${sub}</small>`:"");}
/* the strip's per-body book: top five passes in each body class (R.topBy[body]); R.top stays the all-bodies top five that older saves carry */
function dragTopBy(b){const R=recs();if(!Array.isArray(R.topBy[b]))R.topBy[b]=[];return R.topBy[b];}
function engBest(h){return career()?(C().dragBest||{})[h]:recs().eng[h];}
/* a pass counts when nothing broke, no red light, and (career) it wasn't black-flagged at tech */
function dragPbCheck(q){if(ff||!q||DR.failed||(DR.race&&DR.race.foul)||(career()&&q.mph>150&&!DR.veh.chute))return null;const all=allBest(),eb=engBest(DR.hk);
  if(all<Infinity&&q.t<all)return{kind:2,was:all};if(eb!=null&&q.t<eb)return{kind:1,was:eb};return null;}
function pbPass(r,failed){if(ff||failed||r.et==null||(r.race&&r.race.foul)||(career()&&r.mph>150&&!r.chute))return;const R=recs(),h=DR.hk;
  const body=(DR.veh&&DR.veh.body)||"street",e=Object.assign({et:r.et,mph:r.mph,body},recTag());
  R.top.push(e);R.top.sort((a,b)=>a.et-b.et);if(R.top.length>5)R.top.length=5;
  const B=dragTopBy(body);B.push(e);B.sort((a,b)=>a.et-b.et);if(B.length>5)B.length=5;
  if(career()){const m=C().dragBest=C().dragBest||{};if(!(m[h]<=r.et))m[h]=r.et;if(!(C().bestEt<=r.et))C().bestEt=r.et;}
  else{const m=R.eng;if(!(m[h]<=r.et)){delete m[h];m[h]=r.et;const k=Object.keys(m);if(k.length>24)delete m[k[0]];}}
  const pb=DR.pb;if(!pb)return;r.pb={was:pb.was,all:pb.kind>1};const f=etFix(r.et,pb.was);
  // after the pass's own toast: the PB first, then the purse line again in career
  setTimeout(()=>{const prev=career()?$("toast").textContent:"";toast(`${pb.kind>1?"PERSONAL BEST":"ENGINE PB"} · ${r.et.toFixed(f)} s (was ${pb.was.toFixed(f)})`);buzz([20,40,20,40,60]);if(prev)setTimeout(()=>toast(prev),2700);},0);}
function dragBreak(){if(DR&&DR.failKind==="driveline"){if(!DR.dl){DR.dl=true;sfx("fail");buzz([80,40,120]);toast(DR.d&&DR.d.st&&DR.d.st.dtMsg?DR.d.st.dtMsg.toUpperCase()+" · the engine is fine":"DRIVELINE LET GO · the engine is fine");}return;}   // a swap car's gearbox or axle: not an engine failure
  DR.failed=true;run.fail=true;run.failKind=DR.failKind;failFlash();}
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
      c.push(mg!=null?["gap","Margin",(mg>=0?"+":"−")+Math.abs(mg).toFixed(3).replace(/^0(?=\.)/,"")+"<i>s</i>",mg>=0?"good":"bad"]:["gap","vs "+esc(shOpp(R.name)),foul?"RED":m4&&gap<0?"—":(gap>=0?"+":"")+Math.round(gap)+"<i>ft</i>",foul||gap<0?"bad":"good"]);}
    c.push(["et",m4?"ET":"Clock",m4?m4.t.toFixed(3):st.t.toFixed(2)+"<i>s</i>",st.spin&&!m4?"bad":""]);
    c.push(["mph",m4?"Trap mph":"mph",String(Math.round(m4?m4.mph:st.v*2.237)),""]);
    if(st.boostTarget>0)c.push(["boost","Boost",`${bv(st.boost)}<i>${pU()}</i>`,st.als>0.2?"hot":""]);}
  const z=st.n2oS;if(z){if(pre){const lp=Math.round(z.psi*(0.55+0.45*z.line));c.push(["n2o",z.purging?"Purging":z.line>=0.5?"N2O purged":"N2O · purge",`${lp}<i>psi</i><u><s style="transform:scaleX(${Math.min(1,z.psi/1100).toFixed(2)})"></s></u>`,z.purging?"info":z.line>=0.5?"good":"warn"]);}
    else c.push(["n2o","Nitrous",z.cut?"CUT":ph==="run"?(st.n2o>0.05?"ON":z.on?"WINDOW":"ARMED"):"OFF",z.cut?"bad":ph==="run"&&st.n2o>0.05?"info":ph==="run"?"":"dim"]);}
  if(DR.res.als&&DR.res.als!=="off"){const on=st.als>0.2;c.push(["als","Anti-lag",on?"ON":(ph==="staged"||ph==="run")&&(st.launch.armed||ph==="run")?"ARMED":"OFF",on?"hot":"dim"]);}
  shudRow(c);
  // caption: the round and who's in the other lane, then what to do now
  let s="";if(n){s=`${n.label} · vs ${esc(R.name)}`;if(n.dialP!=null)s+=` · dial ${n.dialP.toFixed(2)} vs ${n.dialO.toFixed(2)}`;
    if(ph==="staged"&&R.hcP!=null&&R.otree0==null)s+=R.hcP>0?` · you go ${R.hcP.toFixed(2)} s after them`:R.hcO>0?` · ${R.hcO.toFixed(2)} s head start`:"";}
  else if(R)s=`Heads-up · vs ${esc(R.name)}`;
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
/* the other lane's splits from its trace (the trace runs in its own time; R.k stretches it to the pass it made) */
function dhudOppMarks(R){if(!R||!R.trace||!R.trace.length)return null;const tr=R.trace,k=R.k||1;
  const at=x=>{for(let i=1;i<tr.length;i++)if(tr[i][1]>=x){const a=tr[i-1],b=tr[i],dt=Math.max(1e-3,(b[0]-a[0])*k),f=b[1]>a[1]?(x-a[1])/(b[1]-a[1]):0;return{t:+((a[0]+(b[0]-a[0])*f)*k).toFixed(3),mph:+((b[1]-a[1])/dt*2.23694).toFixed(1)};}return null;};
  return{sixty:at(18.288),ft330:at(100.584),eighth:at(201.168),ft1000:at(304.8),et:R.et!=null?R.et:null,mph:R.et!=null?R.mph:null};}
let DPREV;function dragPrev(){if(DPREV===undefined){const l=S.last;DPREV=l&&l.env&&l.env.testType==="drag"&&l.res&&l.res.drag&&!l.res.dragFailed&&l.res.drag.et!=null?{m:dragMarks(l.res.drag),mode:S.mode,car:S.career}:null;}
  return DPREV&&DPREV.mode===S.mode&&DPREV.car===S.career?DPREV.m:null;}   // another save slot or mode starts fresh
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
  x.textAlign="center";x.fillStyle=ink;{let fs=58;x.font=F(fs,700);while(fs>34&&x.measureText("SECTION LINE DRAGWAY").width>Rt-L-80){fs-=2;x.font=F(fs,700);}}x.fillText("SECTION LINE DRAGWAY",W/2,150);
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
  {const vw=x.measureText(D.verdict).width;x.font=M(26);x.fillStyle=ink2;   // a long verdict pushes the line underneath
    if(L+50+vw+30+x.measureText(D.margin).width>Rt-50){x.textAlign="left";x.fillText(fit(D.margin,M(26),Rt-L-100),L+50,y+40);}else{x.textAlign="right";x.fillText(D.margin,Rt-50,y);}}
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
    const opp=SIM.dragPass(res,Object.assign({},veh,{auto:true,mass:veh.mass*(0.97+Math.random()*0.06),holdTime:0.9+Math.random()*0.5,noFail:true,dtCap:0,soakC:0,tyreTemp:veh.transBrake==="line_lock"?0.85:0.36}));const k=0.965+Math.random()*0.075;
    DR.race={trace:oppTrace(opp.trace,Infinity,veh.chute?9:6,(opp.et||30)+40),k,rt:0.03+Math.random()*0.16,et:opp.et!=null?+(opp.et*k).toFixed(3):null,mph:opp.mph,foul:false,rt0:null,tree0:null,green:null,name:["Lane 2","Northwind","Halcyon GT","Coulee","Prairie Fire"][Math.floor(Math.random()*5)]};
    DR.race.look=rivalLook(DR.race.name,"",veh.body,DR.hw);DR.race.fx=oppFx(opp.trace,veh,rnHash(DR.race.name+":"+DR.race.k));}
  n2oStart();
  ENGINE_VIS.stripRace&&ENGINE_VIS.stripRace(null);
  if(env.race==="night")rnRace();   // race night: the rival in the other lane
  annPass();   // the announcer: the night and the round, then the matchup (src/app/announcer.js)
  // phone: bring the button and the live numbers up to the top of the panel, clear of the tab bar, with room for the HUD to grow
  if(!document.documentElement.classList.contains("desk"))setTimeout(()=>{try{$("dragCtl").scrollIntoView({block:"start",behavior:"smooth"});}catch(e){}},60);
  ENGINE_VIS.setAutoRotate(false);$("rpmbox").style.display="block";$("dragCtl").style.display="";$("dragBtn").dataset.k="";dragBtnText("HOLD TO BURN OUT","tap to skip straight to the line");$("dragBtn").disabled=false;$("dragLive").innerHTML="";shudStart();
  $("testProg").classList.remove("done");sfx("start");
  // fresh-engine budget: passes beyond what the build can take start to break parts
  DR.breakAt=(wi&&wi.w>=1)?(2+Math.random()*4):Infinity;
  DR.failKind=failKindOf(res,env)||"rod";
  DR.lv=0;DR.lox=0;
  const step=()=>{const now=performance.now();const dt=(now-DR.last)/1000;DR.last=now;const st=DR.auto?dragAutoStep(now):d.step(dt);const R=DR.race;
    {const dn=!!st.done,fl=!!DR.failed;DR.hudOn=dn!==DR.hudD||st.phase!==DR.hudPh||fl!==DR.hudF||now-(DR.hudT||0)>=100;if(DR.hudOn){DR.hudT=now;DR.hudD=dn;DR.hudPh=st.phase;DR.hudF=fl;}}   // phones: the live HUD redraws at ~10 Hz; a phase change, a failure and the finish go through at once
    if(R&&st.phase==="staged"&&st.rolled&&R.tree0==null)R.tree0=now+1200+Math.random()*1800;
    if(st.phase==="staged"&&st.rolled)annStaged();else if(st.phase==="run")annSpin(st);
    const dtT=R&&R.tree0!=null?(now-R.tree0)/1000:-1;if(R&&dtT>=1.5&&R.green==null)R.green=R.tree0+1500;
    if(st.broke&&!DR.failed){DR.failKind=st.broke;dragBreak();}
    if(st.chuteOut&&!DR.chuteFx){DR.chuteFx=true;if(typeof foley==="function")foley("chute");}
    if(st.phase==="run"&&!DR.failed&&(st.t>DR.breakAt||(st.overrev>1.12&&res.overrev&&!res.overrev.survived))){dragBreak();st.done=true;st.phase="done";}
    if(DR.pb===undefined&&(st.phase==="shutdown"||st.phase==="done")){DR.pb=dragPbCheck(st.marks.find(m=>m.n==="1/4 mi"));if(DR.pb)ENGINE_VIS.stripPb(DR.pb.kind);}
    if(DR.night)rnFrame(now,st,dtT);
    if(DR.failed||st.phase==="shutdown"||st.phase==="done")annResult(st);   // after rnFrame: the night's verdict is in
    {const pre=st.phase==="burnout"||(st.phase==="staged"&&!st.rolled);const ox=R?(pre?st.x:oppX(now)):0;const ov=dt>0?Math.max(0,(ox-DR.lox)/dt):0;const acc=dt>0?(st.v-DR.lv)/dt:0;DR.lv=st.v;DR.lox=ox;
      const m4=st.phase==="shutdown"||st.phase==="done"?st.marks.find(m=>m.n==="1/4 mi"):null;
      // test & tune heads-up: the other lane's RT once it leaves, its ET/MPH once it's through the traps, and the same verdict as the slip
      let hx=null;if(R&&!DR.night){const fin=R.et!=null&&ox>=402.336;hx={ort:R.green!=null&&(now-R.green)/1000>=R.rt?R.rt:undefined,oet:fin?R.et:undefined,omph:fin?R.mph:undefined,
        win:st.phase==="shutdown"||st.phase==="done"?!DR.failed&&!R.foul&&!!m4&&(R.et==null||m4.t+Math.max(0,R.rt0||0)<R.et+R.rt):undefined};}
      ENGINE_VIS.setStrip(Object.assign({on:true,et:m4?m4.t:undefined,mph:m4?m4.mph:undefined,dt,x:st.x,v:st.v,ox,ov,acc,spin:st.spin,phase:st.phase,chute:st.chuteOut,race:!!R,foul:!!(R&&R.foul),body:veh.body,wbar:!!veh.wbar,tyreIn:veh.tyreDia,color:carPaint(),hw:DR.hw,opp:R?R.look:undefined,
        tree:{staged:!!st.rolled&&st.phase!=="burnout",a1:dtT>=0,a2:dtT>=0.5,a3:dtT>=1.0,green:!!(R&&R.green!=null)},
        shifting:st.shiftT>0,boost:st.boost,boostTarget:st.boostTarget,rpm:st.rpm,redline:veh.redline,gear:st.gear,
        launch:{armed:!!st.launch.armed,twoStep:st.launch.twoStep,transBrake:st.launch.transBrake,held:st.launch.held,retard:st.launch.retard,pops:st.launch.pops},
        tyreTemp:st.tyreTemp,burnout:st.phase==="burnout",lift:st.lift,onBars:!!st.onBars,brake:st.phase==="shutdown",failed:!!DR.failed,failKind:DR.failed?DR.failKind:null,night:!!(S.night||DR.night),rt:R?R.rt0:null},R?oppDyn(now,ox,st):null,hx));}
    if(st.phase==="burnout"){const ll=veh.transBrake==="line_lock";
      if(DR.hudOn)$("dragLive").innerHTML=`<div class="peak" style="grid-column:1/-1"><b>${Math.round(st.tyreTemp*100)}<i>% tyre heat</i></b><span>${st.burning?"burning · "+st.burnT.toFixed(1)+" s"+(st.burnT>4?" · too long, it's going greasy":st.burnT>2.5?" · that's about right":""):st.burnT>0?"tap to roll into the beams":"in the water box"}${ll?" · line lock on":" · no line lock — it will creep"}</span></div>`;
      if(st.burning)dragBtnText("BURNING…","let go when the smoke rolls");else if(st.burnT>0)dragBtnText("TAP TO STAGE","or hold to burn some more");else dragBtnText("HOLD TO BURN OUT","tap to skip straight to the line");}
    else if(st.phase==="staged"){const bT=st.boostTarget;let h="";
      if(R){const bulbs=[dtT>=0,dtT>=0.5,dtT>=1.0,dtT>=1.5];h+=`<div class="peak" style="grid-column:1/-1"><b style="letter-spacing:6px">${bulbs.slice(0,3).map(b=>b?"🟠":"⚫").join("")}${bulbs[3]?"🟢":"⚫"}</b><span>${!st.rolled?"rolling into the beams":dtT<0?"staged — wait for the ambers":dtT<1.5?"…":"GO"}</span></div>`;}
      else h+=`<div class="peak" style="grid-column:1/-1"><b>${st.rolled?"STAGED":"…"}</b><span>${st.rolled?"time trial — leave when you like":"rolling into the beams"}</span></div>`;
      if(d.canArm)h+=`<div class="peak"><b>${bT>0?bv(st.boost):"—"}<i>${bT>0?pU():""}</i></b><span>${bT>0?"of "+bv(bT)+" on the line":"no boost to build"}</span></div><div class="peak"><b>${st.launch.held.toFixed(1)}<i>s</i></b><span>${st.launch.armed?(st.launch.twoStep?"on the two-step":st.launch.transBrake?"on the trans-brake":"ALS armed — foot on the throttle"):"not armed"}</span></div><div class="peak"><b style="color:${st.egt>950?"var(--crit)":st.egt>850?"var(--warn)":""}">${Math.round(st.egt)}<i>°C</i></b><span>turbine inlet</span></div>`;
      if(DR.hudOn)$("dragLive").innerHTML=h;
      if(!st.rolled)dragBtnText("ROLLING IN…");else if(d.canArm)dragBtnText(st.launch.armed?"RELEASE ON GREEN":"HOLD · RELEASE ON GREEN",st.launch.armed?(st.launch.twoStep?`two-step ${d.holdRpm.toLocaleString()} rpm`:st.launch.transBrake?"on the brake":`ALS armed · ${d.holdRpm.toLocaleString()} rpm`):"arm it on the ambers — every second holding is heat");else dragBtnText("LAUNCH",R?"tap on the green":"tap to go");}
    run.on=true;run.rpm=DR.failed?Math.max(0,run.rpm-380):st.rpm;run.load=DR.failed?0:st.load;
    $("rpmLbl").textContent=Math.round(run.rpm/10)*10;
    if(st.phase==="run"||st.phase==="shutdown"||st.phase==="done"){$("testProg").style.width=Math.min(100,100*st.x/402.336)+"%";
      const m=st.marks.slice(-1)[0];let lane="";if(R){const ox=oppX(now);
        const gap=(st.x-ox)*3.281;lane=`<div class="peak" style="grid-column:1/-1"><b style="color:${R.foul?"var(--crit)":gap>=0?"var(--good)":"var(--crit)"}">${R.foul?"RED LIGHT":(gap>=0?"+":"")+Math.round(gap)+"<i>ft</i>"}</b><span>${R.name} · RT ${R.rt0!=null?R.rt0.toFixed(3):"—"}</span></div>`;}
      if(DR.hudOn)$("dragLive").innerHTML=lane+`<div class="peak"><b>${st.t.toFixed(2)}<i>s</i></b><span>${Math.round(st.x*3.281)} ft · gear ${st.gear}${st.spin?" · <span style=\"color:var(--crit)\">SPIN</span>":""}</span></div><div class="peak"><b>${Math.round(st.v*2.237)}<i>mph</i></b><span>${st.phase==="shutdown"?(st.chuteOut?"chute out · "+Math.round(st.shutFt)+" ft":"on the brakes · "+Math.round(st.shutFt)+" ft"):m?m.n+" "+m.t.toFixed(2)+" s":"—"}</span></div>${st.boostTarget>0?`<div class="peak"><b>${st.boost.toFixed(1)}<i>bar</i></b><span>boost${st.als>0.2?' · <span style="color:var(--orange)">ALS</span>':""}${st.onBars?" · on the bars":""}</span></div>`:""}${DR.res.als&&DR.res.als!=="off"&&st.phase==="run"?`<div class="peak" style="grid-column:1/-1"><b style="font-size:15px;color:var(--orange)">ALS armed</b><span>boost held through shifts · ${Math.round(st.egt)} °C at the turbine</span></div>`:""}`;
      if(DR.failed)dragBtnText(DR.failKind==="manifold"?"MANIFOLD CRACKED":DR.failKind==="turbo"?"TURBO GONE":DR.failKind==="backfire"?"INTAKE BACKFIRE":DR.failKind==="lean"?"MELTED A PISTON":"BROKE");
      else if(st.phase==="shutdown"){if(DR.pb&&ENGINE_VIS.stripPb().shot==="crowd")dragBtnText(DR.pb.kind>1?"PERSONAL BEST":"ENGINE PB","tap to go back to the car");else dragBtnText(st.chuteOut?"CHUTE OUT":"SHUT DOWN");}
      else if(!veh.auto)dragBtnText(st.gear<veh.gears?"SHIFT ▲":"FLAT OUT");else dragBtnText("RUNNING");}
    if(DR.n2o)n2oFrame(st,dt);
    if(DR.night)rnHud(st);
    if(DR.hudOn&&DR.auto&&!DR.failed&&st.phase!=="done"){const w=DR.drv.say(d,dragTree(now));if(w)$("dragLive").insertAdjacentHTML("afterbegin",`<div class="peak dauto" style="grid-column:1/-1;padding:6px 10px"><span style="margin:0">Auto · <b>${w}</b> — tap to take over</span></div>`);}
    shudFrame(st,now,dtT);
    if(!st.done||(DR.failed&&run.rpm>0))requestAnimationFrame(step);else dragFinish();};
  requestAnimationFrame(step);
}
/* the driver's inputs. Pointer events so a held thumb on an iPhone works (burnout, two-step, trans-brake);
   a plain click (keyboard, harness) is treated as a tap. */
function dragStage(){const d=DR.d;d.stage();buzz([12]);}
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
function dragGo(now){const d=DR.d;if(d.st.phase!=="staged")return;const R=DR.race;
  if(R&&R.green==null&&R.tree0!=null&&now>=R.tree0+1500)R.green=R.tree0+1500;   // the green lit between frames: not a red light
  if(R){if(R.green==null){R.foul=true;R.rt0=R.tree0!=null?+((now-(R.tree0+1500))/1000).toFixed(3):-9.999;}
    else{let rt=(now-R.green)/1000;if(DR.veh.transBrake==="trans_brake")rt=Math.max(0.001,rt-0.020);   // a trans-brake lets go quicker and the same every time
      R.rt0=+rt.toFixed(3);}}
  annLight(R);
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
  holdBtn(b,()=>DR,dragPress,dragRelease,()=>{if(!DR.d)return;const st=DR.d.st;
    if(DR.auto&&!DR.failed&&(st.phase==="burnout"||st.phase==="staged"||st.phase==="run")){dragTakeOver();return;}
    if(st.phase==="burnout")dragStage();else if(st.phase==="staged"){if(st.rolled)dragGo(performance.now());}else if(st.phase==="run")DR.d.shift();else if(st.phase==="shutdown"&&DR.pb)ENGINE_VIS.skipCut();});})();
function n2oVeh(env){const b=n2oBottleNow(env);const heat=(S.env.n2oHeater||"on")==="on";
  const psi=heat?b.psi+Math.round((Math.random()-0.5)*16):b.psi+Math.round((Math.random()-0.5)*50);   // a heater's thermostat holds it within a few psi; a bare bottle wanders
  return{act:S.env.n2oAct||"window",psi,line:0.15,purge:1};}
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
  if(DR.night&&same){rnAfterPass(r,failed);annNight(DR.night.stage);}
  if(r.heat)HOTLAP[DR.hk]={t:Date.now(),egt:Math.max(600,r.heat.egtLine||0)};
  if(same)pbPass(r,failed);
  if(typeof crowdAfter==="function")crowdAfter("drag",{broke:failed,won:r.race?r.race.won:undefined,close:!!(r.race&&r.race.margin!=null&&Math.abs(r.race.margin)<0.05),pb:!!r.pb});   // app/ambience.js
  if(DR.veh&&DR.veh.dlCap)r.swap=swapTag();
  {const pv=dragPrev();if(!failed&&r.et!=null){if(pv)r.prev=pv;DPREV={m:dragMarks(r),mode:S.mode,car:S.career};}}   // the slip prints the change from the last clean pass
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
  else if(r.broke!=="driveline")toast(failed?(DR.failKind==="turbo"?"COOKED THE TURBO":DR.failKind==="manifold"?"CRACKED MANIFOLD":"BROKE ON THE PASS"):r.et!=null?`${r.et.toFixed(2)} s @ ${Math.round(r.mph)} mph`:"Did not finish");
  achCheck({type:"drag",r,failed,res,env});if(r.swap)swapAfter(r);
  save();recompute();renderTest();
  revealVerdict();
}
/* the other lane's trace: the baseline, cut where the rival broke, then a coast to a stop past the stripe */
function rnOppTrace(N,op){return oppTrace(N.trace,op.broke?op.at*N.et0:Infinity,op.broke?2.5:N.lock.chute?9:6,N.et0+40);}
/* a [t,x] trace cut at time `cut`, then slowing at `dec` m/s² to a stop (both lanes: race nights and the test & tune mirror) */
function oppTrace(tr,cut,dec,tEnd){const out=[];let last=null,prev=null;
  for(const p of tr){if(p[0]>cut)break;out.push(p);prev=last;last=p;}
  if(!last)return[[0.05,0],[1,0]];let v=last[2]!=null?last[2]/2.23694:prev?(last[1]-prev[1])/Math.max(0.01,last[0]-prev[0]):10,x=last[1],t=last[0];   // [2] mph when the trace carries it (dragPass)
  while(v>1&&t<tEnd){t+=0.1;v=Math.max(0,v-dec*0.1);x+=v*0.1;out.push([+t.toFixed(2),+x.toFixed(1)]);}return out;}
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
function rnJudgePass(n,st){const R=DR.race,q=st.marks.find(m=>m.n==="1/4 mi"),bars=(SIM.AERO[DR.veh.body]||{}).bars||DR.veh.wbar;
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
    if(!out&&!br&&p.et!=null)n.seed=rnSeeds(N).indexOf(0)+1;   // where the best time so far sits among the eight
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
  r.night={fmt:N.fmt,stage:p.stage,seed:n.seed||null,label:n.label,opp:opName,car:rv.car,win,text,dialP:n.dialP,dialO:n.dialO,oppRt:n.op.rt,oppEt:n.op.et,oppMph:n.op.mph,oppBroke:!!n.op.broke,place:N.done?N.place:null};
  if(r.race){r.race.won=win===true;if(v.margin!=null)r.race.margin=win?v.margin:-v.margin;}
  rnSetN(N);const msg=N.done?`${RN_PLACE[N.place].toUpperCase()}${N.paid?" · "+fmt$(N.paid):""}`:p.stage<2?`${n.label} · ${p.et!=null?p.et.toFixed(3):"NO TIME"}`:`${win?"WON":"OUT"} · ${n.label}`;
  setTimeout(()=>{if(r.pb)setTimeout(()=>toast(msg),2800);else toast(msg);},0);}   // after the pass's own toast (and a PB's)
function rnFinish(N,place){if(N.done)return;N.done=true;N.place=place;N.out=place!==1;
  const rep=N.won+(place===1?2:0)+(N.fmt==="elim"&&N.seeds&&N.seeds[0]===0?1:0),paid=Math.round(N.purse*RN_PAY[place]/50)*50;N.paid=paid;N.rep=rep;
  const best=(N.passes||[]).filter(p=>p.et!=null).reduce((a,p)=>a&&a.et<=p.et?a:p,null);N.best=best?{et:best.et,mph:best.mph}:null;
  const R=recs();R.nightsRun=(R.nightsRun||0)+1;if(place===1)R.nightsWon=(R.nightsWon||0)+1;if(N.quick){R.brRun=(R.brRun||0)+1;if(place===1)R.brWon=(R.brWon||0)+1;}if(!(R.bestFinish<=place))R.bestFinish=place;
  const cls=SIM.AERO[N.body].n,last=N.hist[N.hist.length-1];
  if(career()){C().cash+=paid;C().rep+=rep;logEvent(`Race night · ${cls} ${N.fmt==="bracket"?"bracket":"heads-up"}: ${place===1?"WON — beat "+(rnPart(N,last.opp).name)+" in the final":(N.left?"left the night":RN_PLACE[place].toLowerCase()+(last&&last.text?", "+last.text.split(" — ")[0].toLowerCase():""))}${best?", best "+best.et.toFixed(2):""} — purse ${fmt$(paid)}${rep?", +"+rep+" rep":""}`,place<=2?"good":paid>0?"":"bad");spEvent("night",{win:place===1,finish:place>1&&place<=3,noCount:!!N.left&&place===9});hud();checkGoals();}}
function rnLeave(){const N=rnLive();if(!N||testing)return;if(!confirm(N.stage<2?"Leave the night? Your entry is gone and you go home without a seed.":"Leave the night? You forfeit this round and take the purse for going out here."))return;
  if(N.stage>=2){const ri=N.stage-2,m=N.rounds[ri].find(x=>x.a===0||x.b===0);m.win=m.a===0?m.b:m.a;m.why="left";m.text="Didn't come to the line";N.hist.push({stage:N.stage,label:rnStageName(N,N.stage),opp:m.win,win:false,text:"Left the night — forfeit"});
    N.left=true;for(let k=ri;k<3;k++){rnResolve(N,k);if(k<2&&!N.rounds[k+1])N.rounds[k+1]=rnNextPairs(N.rounds[k]);}rnFinish(N,ri===0?5:ri===1?3:2);}
  else{N.left=true;N.hist.push({stage:N.stage,label:rnStageName(N,N.stage),text:"Left the night"});rnFinish(N,9);}
  rnSetN(N);save();renderTest();toast("Loaded up and went home");}
function rnRunBtn(){const N=rnCur(),b=$("runTest");if(testing)return;
  if(!N){if(RN_FMT[S.env.dragFmt]){b.textContent=S.env.dragQuick?`Enter bracket night${career()?" · entry":""}`:`Enter the night · ${RN_FMT[S.env.dragFmt].toLowerCase()}${career()?" · entry":""}`;$("dynoHint").innerHTML=`<b>${S.env.dragQuick?"Bracket night":"Race night"}</b> · ${career()?"the entry is charged when you go in; ":""}${S.env.dragQuick?"straight to round one, no time trials; up to three rounds.":`two ${S.env.dragFmt==="bracket"?"time trials":"qualifying passes"}, then up to three rounds.`} Space or the big button drives every pass, same as a single run.`;}return;}
  if(N.done){b.textContent="Close the night";$("dynoHint").innerHTML="";return;}
  const i=rnOppIdx(N),fb=fuelBill();b.textContent=`Stage · ${rnStageName(N,N.stage).toLowerCase().replace(/^./,c=>c.toUpperCase())} vs ${N.field[i-1].name.split(" ")[0]}${career()&&fb?" · fuel "+fmt$(fb):""}`;
  $("dynoHint").innerHTML=N.fmt==="bracket"?`<b>Bracket</b> · your dial ${N.stage>=2?N.dial.toFixed(2):"— set after the time trials"}. Leave on the green of <i>your</i> tree; a red light loses outright.`:`<b>Heads-up</b> · first to the stripe. Your reaction time counts — a good light is under 0.100.`;}
function rnHud(st){const n=DR.night,R=DR.race;if(!n)return;const L=$("dragLive");let s=`${n.label} · vs ${esc(R.name)}`;
  if(n.dialP!=null)s+=` · dial ${n.dialP.toFixed(2)} vs ${n.dialO.toFixed(2)}`;
  if(st.phase==="staged"&&R.hcP!=null&&R.otree0==null)s+=R.hcP>0?` · you go ${R.hcP.toFixed(2)} s after them`:R.hcO>0?` · ${R.hcO.toFixed(2)} s head start`:"";
  if(n.verdict&&n.stage>=2)s+=` · <b style="color:${n.verdict.win?"var(--good)":"var(--crit)"}">${n.verdict.win?"WIN":"LOSS"}</b>`;
  if(DR.hudOn)L.insertAdjacentHTML("afterbegin",`<div class="peak rnhud" style="grid-column:1/-1;padding:6px 10px"><span style="margin:0">${s}</span></div>`);
  if(n.cheer&&st.phase==="shutdown"&&ENGINE_VIS.stripPb().shot==="crowd")dragBtnText("WON THE NIGHT","tap to go back to the car");}
function rnTuneSet(k,v,m){v=Math.min(m.hi,Math.max(m.lo,v));
  if(k==="launch"){v=Math.round(v/100)*100;if(SIM.launchTech(S.cfg).launchCtl!=="none")S.cfg.twoStepRpm=v;else S.env.launchRpm=v;}
  else if(k==="psi")S.env.tyrePsi=+v.toFixed(1);else S.env[k]=+v.toFixed(2);}
$("envBox").addEventListener("input",e=>{const r=e.target,k=r.dataset&&r.dataset.rnr,N=rnCur();if(!k||!N||N.done||testing)return;
  rnTuneSet(k,parseFloat(r.value),rnTuneLim(N,k));const m=rnTuneLim(N,k),o=$("rnv-"+k);
  if(o)o.textContent=k==="launch"?m.v.toLocaleString():k==="psi"?m.v.toFixed(1)+" psi":m.v.toFixed(2)+":1";});
$("envBox").addEventListener("click",e=>{const b=e.target.closest("[data-rn]");if(!b)return;const a=b.dataset.rn,N=rnCur();
  if(a==="done"){rnSetN(null);save();renderTest();return;}
  if(a==="leave"){rnLeave();return;}
  if(!N||N.done||testing)return;
  if(a==="tune"){const k=b.dataset.k,m=rnTuneLim(N,k);rnTuneSet(k,m.v+m.step*+b.dataset.d,m);
    buzz(3);}
  else if(a==="shock"){S.env.shocks=b.dataset.k;}
  else if(a==="dial"){N.dial=+(N.dial+0.01*+b.dataset.d).toFixed(2);rnSetN(N);}
  else if(a==="dialsug"){N.dial=rnSuggest(N);rnSetN(N);}
  else if(a==="freshen"){const c=rnFreshCost(quick);if(!career())return;if(C().cash<c){toast("Not enough cash for a freshen");return;}C().cash-=c;C().wear[hKey(cfgHash(S.cfg))]=0;logEvent(`Freshened ${engineName()} between rounds — ${fmt$(c)}`);hud();toast("Rings, bearings and a hone — like new");}
  save();const sc=$("panel").scrollTop;renderEnv();$("panel").scrollTop=sc;});
async function shareSlip(l){try{await document.fonts.ready;}catch(e){}const c=slipCanvas(l);
  const blob=await new Promise(r=>c.toBlob(r,"image/png"));
  // published page: the viewer hands the file over (share sheet on iOS, download elsewhere)
  const dl=window.claude&&window.claude.use?await window.claude.use("downloads"):null;
  if(dl){try{await dl.save({filename:"timing-slip.png",data:blob});toast("Slip saved");}catch(e){if(e&&e.code!=="declined")toast("Couldn't save the slip here");}return;}
  const file=new File([blob],"timing-slip.png",{type:"image/png"});
  if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:"Timing slip"});return;}catch(e){}}
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="timing-slip.png";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);}
/* drag button: see dragPress / dragRelease above */

