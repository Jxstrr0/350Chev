/*pew-late 1.76.140.0*/
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

/* ===================== TROPHY ROOM =====================
   What the shop has won, set and kept, in one room. The game already keeps records (recs()), achievements (S.ach), goals
   (C().goals), sponsors (spS()) and team seasons (pcS()); what it didn't keep is a dated history of wins, so this adds
   one: an additive log per mode (career C().trophies, sandbox S.sbTrophies = {v, log:[...], retired:[...]}), filled
   from the achCheck() hook at the end of every event and seeded from the records the first time a save meets it.
   Events are data: TROPHY_EV lists each with its achCheck types, its trophy shape and how to read a win; an event with
   no entry still lands on the shelf when its result has place 1 (an obelisk until someone gives it a shape).
   Retired engines are snapshots (cfg, name, peak hp, best results) shown on stands in the room and loadable again.
   Not in the page: this file is in app-late.js (app/late.js, since 1.76.137.0). The page reaches it through LATE_FNS: tropHook
   (every call before it lands is kept and made once it does) and tropOpen (the Records button, wired in app/late.js). */
const TROPHY_LOG_MAX=240,TROPHY_RET_MAX=24,TR_STANDS=6;   // TR_STANDS matches the vis room's stand count
const trF=(v,d)=>v==null||!isFinite(v)?"—":(+v).toFixed(d);
const trCls=(T,k)=>T&&T[k]&&T[k].n||k||"";
const trHill=k=>trCls(SIM.HILL_CLASSES,k),trCh=e=>e&&SIM.CHASSIS&&SIM.CHASSIS[e.ch]?SIM.CHASSIS[e.ch].n:"";   // Cloudsplitter Peak: class name, and the car the record was set in
const TROPHY_EV=[
  {k:"drag",n:"Drag racing",shape:"cup",types:["drag"],win:x=>{const r=x.r,nt=r&&r.night;if(x.failed||!nt||nt.place!==1)return null;const car=(SIM.AERO[r.body]||{}).n||"";
    return{t:"Won the night",what:`${RN_FMT[nt.fmt]||"Race night"} at Section Line Dragway — beat ${nt.opp||"the field"} in the final.`,nums:[["ET",r.et!=null?trF(r.et,3)+" s":"—"],["Trap",r.mph!=null?Math.round(r.mph)+" mph":"—"],["Reaction",r.race&&r.race.rt!=null?trF(r.race.rt,3):"—"],["Class",car]],veh:car,u:"d"+(r.at||Date.now())};}},
  {k:"pull",n:"Truck & tractor pull",shape:"wrench",types:["pull"],win:x=>{const r=x.r;if(x.failed||r.poPending||r.dq||r.place!==1)return null;
    return{t:`${r.clsName||"Pull"} — first`,what:`Longest pull of the night${r.pullOff!=null?", settled in a pull-off":""}${r.of?" against "+(r.of-1)+" others":""}.`,nums:[["Distance",r.full?"FULL · 300 ft":trF(r.distFt,1)+" ft"],["Pull-off",r.pullOff!=null?trF(r.pullOff,1)+" ft":"—"],["Gear",r.gearName||"—"],["Field",r.of||"—"]],veh:r.clsName||""};},
    extra:x=>{const r=x.r,s=r&&r.ser;if(x.failed||!s||!s.done||!s.champMe)return null;return{t:"Series champion",shape:"title",what:`${r.clsName||"Pulling"} series, season ${s.season} — ${s.pts} points over ${s.n} rounds.`,nums:[["Points",(s.stand.find(q=>q.me)||{}).pts||"—"],["Season",s.season],["Rounds",s.n]],veh:r.clsName||"",u:"ps"+s.season+(r.cls||"")};}},
  {k:"salt",n:"Bitterwater",shape:"salt",types:["salt"],win:x=>{const r=x.r;if(x.failed||!r||r.outcome!=="record")return null;
    return{t:`Class record · ${r.cls&&r.cls.key||""}`,what:`Two-way average over the mile on the ${r.courseName||"salt"}${r.rec?`, beating ${trF(r.rec.mph,3)} mph`:""}.${r.club?" Into the 200 MPH Club.":""}`,nums:[["Record",trF(r.avg,3)+" mph"],["Runs",r.firstMph!=null?trF(r.firstMph,1)+" / "+trF(r.mileMph,1):"—"],["Peak",r.peakMph!=null?Math.round(r.peakMph)+" mph":"—"],["Body",r.clsName||"—"]],veh:r.clsName||""};}},
  {k:"bog",n:"Mud bog",shape:"boot",types:["bog"],win:x=>{const r=x.r;if(x.failed||r.place!==1)return null;
    return{t:`${r.clsName||"Mud bog"} — first`,what:r.cleared?"Through the pit quickest of the night.":"Farthest into the pit of the night.",nums:[["Result",r.cleared?trF(r.pitT,2)+" s":trF(r.distM,1)+" m"],["Field",r.of||"—"],["Driver",r.auto?"auto":"you"]],veh:r.clsName||""};}},
  {k:"road",n:"Road course",shape:"wheel",types:["road"],win:x=>{const r=x.r;if(x.failed||!r||r.lapT==null||!(r.rivBeat||(r.pb&&r.pb.was)))return null;
    return{t:r.rivBeat?`Head-to-head · ${r.trkName||"the circuit"}`:`Lap record · ${r.trkName||"the circuit"}`,tier:r.rivBeat?"gold":"silver",what:r.rivBeat?`Beat a rival's posted lap at ${r.trkName||"the circuit"} in ${r.chName||"their car"}.`:`A new best around ${r.trkName||"the circuit"} in ${r.chName||"the car"}, ${trF(r.pb.was-r.lapT,2)} s under the old mark.`,nums:[["Lap",fmtLap(r.lapT,2)],["0–100",r.zero100!=null?trF(r.zero100,1)+" s":"—"],["Top",r.top&&r.top.kmh?Math.round(r.top.kmh)+" km/h":"—"],["Tyres",r.tyreName||"—"]],veh:r.chName||""};}},
  {k:"e24",n:"24 Hours of Prairie Sky",shape:"tallcup",types:["e24"],win:x=>{const r=x.r;if(!r||!r.classified||!(r.posCls<=3))return null;
    return{t:r.posCls===1?`Class win · ${r.clsName}`:`${ordN(r.posCls)} in ${r.clsName}`,tier:r.posCls===1?"gold":r.posCls===2?"silver":"bronze",what:`${r.laps} laps of ${r.trkName}, ${ordN(r.pos)} overall of ${r.of}.`,nums:[["Distance",Math.round(r.km||0).toLocaleString("en-CA")+" km"],["Laps",r.laps],["Best lap",fmtLap(r.bestLap!=null?r.bestLap:r.best,2)],["Pits",r.pits!=null?r.pits:"—"]],veh:r.chName||""};}},
  {k:"pikes",n:"Cloudsplitter Peak",shape:"peak",types:["pikes","hill","hillclimb","pikes_peak"],win:x=>{const r=x.r;if(!r||r.dnf||r.place!==1)return null;
    return{t:`${r.clsName||"Cloudsplitter Peak"} — King of the Mountain`,what:`To the summit in ${fmtHill(r.time)}, quickest of ${r.of}.`,nums:[["Time",fmtHill(r.time)],["Average",r.avgKmh!=null?r.avgKmh+" km/h":"—"],["Field",r.of||"—"],["Driver",r.auto?"auto":"you"]],veh:r.chName||""};}},
  {k:"oval",n:"Dirt oval",shape:"cup",types:["oval"],win:x=>{const r=x.r;if(x.failed||!r||r.stage!=="feature"||r.place!==1)return null;
    return{t:`${r.clsName||"Dirt oval"} feature — first`,what:`Won the ${r.N}-lap feature on ${r.night} ${r.surf==="asphalt"?"asphalt":"clay"} from ${ordN(r.gridMe)} on the grid, against ${r.of-1} others.`,nums:[["Time",fmtOvRace(r.time)],["Best lap",fmtOv(r.best)+" s"],["Started",ordN(r.gridMe)],["Field",r.of]],veh:r.clsName||"",u:"ovf"+(r.at||Date.now())};},
    extra:x=>{const r=x.r;if(x.failed||!r||r.stage!=="heat"||r.place!==1)return null;return{t:`${r.clsName||"Dirt oval"} heat — first`,tier:"bronze",what:`Won the ${r.N}-lap heat, which put the car on the front row for the feature.`,nums:[["Time",fmtOvRace(r.time)],["Best lap",fmtOv(r.best)+" s"],["Field",r.of]],veh:r.clsName||"",u:"ovh"+(r.at||Date.now())};}},
  {k:"boat",n:"Boat drags",shape:"prop",types:["boat","boatdrag","boat_drag"]},
  {k:"team",n:"Team championships",shape:"title",types:["team"],win:()=>{if(!career())return null;const L=pcS().last,X=L&&L.end;if(!X||X.pos!==1)return null;const E=PC_EVENTS[L.ev];
    return{t:`${E.n} champions`,what:`Supplied ${L.team} and ${L.name} to the ${E.n.toLowerCase()} title, season ${L.season}.`,nums:[["Points",X.pts],["Title bonus",fmt$(X.bonus)],["Budget used",`${fmt$(X.spent)} of ${fmt$(X.budget)}`]],veh:E.n,u:"tm"+L.season+L.ev};}},
  {k:"spon",n:"Sponsors",shape:"pennant",types:["sponsor"],win:()=>{if(!career())return null;const s=spS(),a=s.active[s.active.length-1];if(!a)return null;const b=spBrand(a.b),T=tropBook();if(T.log.some(e=>e.ev==="spon"&&e.brand===b.id))return null;
    return{t:b.name,brand:b.id,slot:"pennant",what:`${b.tag} — signed for ${a.weeks} weeks${a.ret?", "+fmt$(a.ret)+" a week":""}.`,nums:[["Signed",s.hist.signed],["Completed",s.hist.done],["Earned",fmt$(s.hist.earned||0)]]};}}
];
function tropEv(k){return TROPHY_EV.find(e=>e.k===k)||{k,n:String(k||"Event").replace(/^./,c=>c.toUpperCase()),shape:"obelisk"};}
function tropEvOf(type){return TROPHY_EV.find(e=>e.types&&e.types.includes(type))||null;}
/* a result from an event this file doesn't know (or knows only by name): a place-1 finish is a win */
function tropGeneric(x){const r=x.r;if(!r||x.failed||!(r.place===1||r.won===true||r.win===true))return null;const n=[];
  if(r.et!=null)n.push(["Time",trF(r.et,3)+" s"]);else if(r.time!=null)n.push(["Time",trF(r.time,2)+" s"]);if(r.mph!=null)n.push(["Speed",Math.round(r.mph)+" mph"]);if(r.of)n.push(["Field",r.of]);
  return{t:`${r.clsName||"Event"} — first`,what:"First of the field.",nums:n,veh:r.clsName||r.car||""};}
function tropBook(){if(ff)return{v:1,log:[],retired:[]};const cr=career(),o=cr?C():S,k=cr?"trophies":"sbTrophies";let T=o[k];
  if(!T||typeof T!=="object"||!Array.isArray(T.log)){T=o[k]={v:1,log:[],retired:[]};tropSeed(T);}
  if(!Array.isArray(T.retired))T.retired=[];return T;}
function tropStamp(e,src){const o={d:src&&src.d||Date.now()};if(src&&src.w!=null)o.w=src.w;else if(!src&&career())o.w=C().week;return Object.assign(e,o);}
/* first meeting with a save: the records already say what it won */
function tropSeed(T){if(ff)return;const R=recs(),L=T.log,cut=tropSeed.cut||0;let id=0;const add=(e,src)=>{if(src&&src.d&&cut&&src.d>=cut)return;const o=Object.assign({id:"s"+(++id),seed:true,eng:src&&src.n||""},e);if(src&&src.d)o.d=src.d;if(src&&src.w!=null)o.w=src.w;L.push(o);};
  const nw=(R.nightsWon||0)-(tropSeed.night?1:0);if(nw>0)add({ev:"drag",t:nw>1?`Won the night ×${nw}`:"Won the night",x:nw,what:`Race nights won at Section Line Dragway${R.nightsRun?` — ${R.nightsWon} of ${R.nightsRun} entered`:""}, before the trophy room kept dates.`,nums:[["Won",nw],["Entered",R.nightsRun||"—"]]},{});
  (Array.isArray(R.pullTitles)?R.pullTitles:[]).forEach(p=>add({ev:"pull",shape:"title",t:"Series champion",what:`${trCls(SIM.PULL_CLASSES,p.k)} series, season ${p.season}.`,nums:[["Points",p.pts],["Season",p.season]],veh:trCls(SIM.PULL_CLASSES,p.k)},p));
  if(R.pull&&typeof R.pull==="object")Object.keys(R.pull).forEach(k=>{const e=R.pull[k];if(e&&e.full)add({ev:"pull",tier:"silver",t:`Full pull · ${trCls(SIM.PULL_CLASSES,k)}`,what:"Dragged the sled the whole 300 ft.",nums:[["Distance","300 ft"]],veh:trCls(SIM.PULL_CLASSES,k)},e);});
  if(R.bog&&typeof R.bog==="object")Object.keys(R.bog).forEach(k=>{const e=R.bog[k];if(e&&e.c)add({ev:"bog",tier:"silver",t:`Through the pit · ${trCls(SIM.BOG_CLASSES,k)}`,what:"Cleared the whole pit.",nums:[["Best",trF(e.t,2)+" s"]],veh:trCls(SIM.BOG_CLASSES,k)},e);});
  if(R.hill&&typeof R.hill==="object")Object.keys(R.hill).forEach(k=>{const e=R.hill[k];if(e&&e.t)add({ev:"pikes",tier:"silver",t:`To the summit · ${trHill(k)}`,what:"Ran Cloudsplitter Peak clean, bottom to top.",nums:[["Best",fmtHill(e.t)]],veh:trCh(e)},e);});
  if(R.lsr&&R.lsr.rec)Object.keys(R.lsr.rec).forEach(k=>{const e=R.lsr.rec[k];if(e&&e.mph)add({ev:"salt",t:`Class record · ${k}`,what:`Two-way average over the mile${e.was?`, beating ${trF(e.was,3)} mph`:""}.`,nums:[["Record",trF(e.mph,3)+" mph"],["Runs",Array.isArray(e.runs)?e.runs.map(v=>trF(v,1)).join(" / "):"—"]]},e);});
  if(R.e24Best&&R.e24Best<=3)add({ev:"e24",tier:R.e24Best===1?"gold":R.e24Best===2?"silver":"bronze",t:R.e24Best===1?"Class win":`${ordN(R.e24Best)} in class`,what:"Best class finish at the 24 Hours of Prairie Sky.",nums:[["Best",ordN(R.e24Best)],["Starts",R.e24Runs||"—"]]},{});
  if(career()){const s=spS();s.active.forEach(a=>{const b=spBrand(a.b);add({ev:"spon",slot:"pennant",brand:b.id,t:b.name,what:`${b.tag} — on the car now.`,nums:[["Signed",s.hist.signed],["Earned",fmt$(s.hist.earned||0)]]},{w:a.w0!=null?a.w0:C().week});});
    }
  T.seeded=Date.now();}
/* the hook: achCheck({type, r, ...}) at the end of every event */
function tropHook(x){if(!x||ff||!S||!S.mode)return;
  if(x.type==="retro"){tropBook();return;}
  const ev=tropEvOf(x.type),known=!!ev;let e=null,more=null;
  const cr=career(),o=cr?C():S,fresh=!(o[cr?"trophies":"sbTrophies"]&&Array.isArray(o[cr?"trophies":"sbTrophies"].log));
  if(fresh){tropSeed.cut=Date.now()-15000;tropSeed.night=x.type==="drag"&&x.r&&x.r.night&&x.r.night.place===1;}
  const T=tropBook();tropSeed.cut=0;tropSeed.night=false;
  try{e=ev&&ev.win?ev.win(x):(!known||!ev.win)&&x.r?tropGeneric(x):null;more=ev&&ev.extra?ev.extra(x):null;}catch(err){e=null;}
  const k=ev?ev.k:x.type;let n=0;
  for(const z of [e,more]){if(!z)continue;if(z.u&&T.log.some(q=>q.u===z.u))continue;
    const ent=tropStamp(Object.assign({id:"t"+Date.now().toString(36)+(n++),ev:k,eng:engineName().slice(0,28),h:cfgHash(S.cfg)},z));T.log.push(ent);
    if(T.log.length>TROPHY_LOG_MAX)T.log.splice(T.log.findIndex(q=>q.seed)>=0?T.log.findIndex(q=>q.seed):0,1);
    if(ent.slot!=="pennant"&&k!=="dd"){setTimeout(()=>toast(`TROPHY ROOM · ${ent.t}`),5600);if(typeof rcTrophy==="function")rcTrophy(ent);}}
  if(n){tropCountSync();if(TR.open)tropRefresh();}}
/* ---- the room's contents: one list of items, each with its plaque card ---- */
const TR_TIER_ACH={gold:"gold",silver:"silver",bronze:"bronze"};
function trWhen(e){if(!e)return"";const w=e.w!=null?"Week "+e.w:"",d=e.d?new Date(e.d).toLocaleDateString("en-CA",{year:"numeric",month:"short",day:"numeric"}):"";return [w,d].filter(Boolean).join(" · ")||(e.seed?"before the trophy room":"");}
function tropItems(){const T=tropBook(),R=recs(),cr=career(),items=[];
  const log=T.log.slice().sort((a,b)=>(b.shape==="title")-(a.shape==="title")||(b.d||0)-(a.d||0));
  for(const e of log){const ev=tropEv(e.ev);
    items.push({id:"L"+e.id,slot:e.slot||"shelf",shape:e.shape||ev.shape,tier:e.tier||"gold",col:e.brand?(spBrand(e.brand).c1):null,col2:e.brand?(spBrand(e.brand).c2):null,
      card:{kick:ev.n,title:e.t,what:e.what||"",when:trWhen(e),nums:e.nums||[],veh:e.veh||"",eng:e.eng||"",ic:"trophy",tier:e.tier||"gold"}});}
  /* framed slips: the records */
  const slip=(id,kick,big,unit,sub,e,nums,veh)=>items.push({id:"R"+id,slot:"slip",lines:[kick.toUpperCase(),big,unit,e&&e.n?e.n:"",trWhen(e)],card:{kick:"Record · "+kick,title:big+(unit?" "+unit:""),what:sub,when:trWhen(e),nums:nums||[],veh:veh||"",eng:e&&e.n||"",ic:"flag",tier:"silver",slip:true}});
  const top=R.top&&R.top[0];if(top)slip("et","Quickest ET",trF(top.et,3),"s @ "+Math.round(top.mph)+" mph","The quickest clean quarter mile.",top,[["ET",trF(top.et,3)+" s"],["Trap",Math.round(top.mph)+" mph"],["Top 5",R.top.map(q=>trF(q.et,2)).join(" · ")]]);
  const hp=R.hp||(cr&&C().bestHp>0?{v:Math.round(C().bestHp)}:null);if(hp)slip("hp",cr?"Top certified":"Top pulled",Number(hp.v).toLocaleString("en-CA"),"hp","The most power on a clean dyno pull.",hp,[["Peak",Number(hp.v).toLocaleString("en-CA")+" hp"]]);
  const rel=R.rel||(cr&&C().bestRel>0?{v:C().bestRel}:null);if(rel)slip("rel","Best reliability",String(rel.v),rel.hp?"rel @ "+rel.hp+" hp":"rel","The toughest engine off the dyno.",rel,[["Reliability",rel.v],["At",rel.hp?rel.hp+" hp":"—"]]);
  if(R.pull&&typeof R.pull==="object")Object.keys(R.pull).forEach(k=>{const e=R.pull[k];if(e)slip("p"+k,"Pull · "+trCls(SIM.PULL_CLASSES,k),e.full?"FULL":trF(e.ft,1),e.full?"300 ft":"ft","Longest pull in the class.",e,[["Distance",e.full?"300 ft — full pull":trF(e.ft,1)+" ft"]],trCls(SIM.PULL_CLASSES,k));});
  if(R.bog&&typeof R.bog==="object")Object.keys(R.bog).forEach(k=>{const e=R.bog[k];if(e)slip("b"+k,"Bog · "+trCls(SIM.BOG_CLASSES,k),e.c?trF(e.t,2):trF(e.m,1),e.c?"s through":"m","Best run in the class.",e,[[e.c?"Through":"Got to",e.c?trF(e.t,2)+" s":trF(e.m,1)+" m"]],trCls(SIM.BOG_CLASSES,k));});
  if(R.lsr&&R.lsr.pb)Object.keys(R.lsr.pb).forEach(k=>{const e=R.lsr.pb[k];if(e&&e.mph)slip("s"+k,"Salt · "+k,trF(e.mph,2),"mph","Best timed mile in the class.",e,[["Mile",trF(e.mph,3)+" mph"],["Kilo",e.km!=null?trF(e.km,2)+" mph":"—"],["Peak",e.peak!=null?Math.round(e.peak)+" mph":"—"]]);});
  if(R.road&&typeof R.road==="object")Object.keys(R.road).forEach(k=>{const e=R.road[k],c=e&&SIM.CHASSIS[e.ch],t=e&&SIM.ROAD_TRACKS[e.trk];if(e&&e.t&&c&&t)slip("r"+k,"Lap · "+t.n,fmtLap(e.t,2),"","Best lap for the car on this circuit.",e,[["Lap",fmtLap(e.t,2)],["0–100",e.z!=null?trF(e.z,1)+" s":"—"]],c.n);});
  if(R.hill&&typeof R.hill==="object")Object.keys(SIM.HILL_CLASSES).forEach(k=>{const e=R.hill[k];if(e&&e.t)slip("h"+k,"Cloudsplitter Peak · "+trHill(k),fmtHill(e.t),"","Quickest run to the summit in the class.",e,[["Time",fmtHill(e.t)],["Car",trCh(e)||"—"]],trCh(e));});
  if(R.oval&&typeof R.oval==="object")Object.keys(SIM.OVAL_CLASSES).forEach(k=>{const e=R.oval[k];if(e&&e.lap)slip("o"+k,"Dirt oval · "+trCls(SIM.OVAL_CLASSES,k),trF(e.lap,2),"s lap","Quickest lap in the class.",e,[["Lap",trF(e.lap,2)+" s"],["Feature wins",e.wins||0],["Best finish",e.best?ordN(e.best):"—"]],trCls(SIM.OVAL_CLASSES,k));});
  if(R.e24&&typeof R.e24==="object")Object.keys(R.e24).forEach(k=>{const e=R.e24[k],c=e&&SIM.CHASSIS[e.ch],t=e&&SIM.ROAD_TRACKS[e.trk];if(e&&e.km&&c&&t)slip("e"+k,"24 h · "+t.n,Math.round(e.km).toLocaleString("en-CA"),"km","Longest distance in 24 hours.",e,[["Distance",Math.round(e.km).toLocaleString("en-CA")+" km"],["Laps",e.laps],["Finish",e.pc?ordN(e.pc)+" in class":"DNF"]],c.n);});
  /* medals: achievements (shared by both modes) */
  const A=S.ach||{};for(const a of ACH){const e=A[a.id];if(!e)continue;items.push({id:"A"+a.id,slot:"medal",tier:TR_TIER_ACH[a.tier]||"bronze",card:{kick:"Achievement · "+ACH_TIER[a.tier],title:a.name,what:a.desc,when:achWhen(e),nums:[],ic:a.ic,tier:a.tier}});}
  if(cr){for(const g of GOALS){const w=C().goals[g.id];if(w)items.push({id:"G"+g.id,slot:"cert",card:{kick:"Shop goal",title:g.name,what:g.desc,when:"Week "+w,nums:[["Bonus",fmt$(g.cash)],["Rep","+"+(g.rep!=null?g.rep:10)]],ic:"tick",tier:"silver"}});}}
  return items;}
function tropEngines(){const T=tropBook();return T.retired.map(e=>({id:"E"+e.id,name:String(e.name||"Engine").slice(0,26),sub:`${Math.round(e.hp||0).toLocaleString("en-CA")} hp · ${e.label||""}`.slice(0,34),cfg:Object.assign({},SIM.DEFAULT_CFG,e.cfg),layout:LAYOUTS[e.cfg.layout]||LAYOUTS[SIM.DEFAULT_CFG.layout],src:e}));}
/* ---- retiring a build ---- */
function tropBest(name,h){const R=recs(),out=[],mine=e=>e&&(e.n===name||(h&&e.h===h));
  const t=(R.top||[]).filter(mine)[0];if(t)out.push(["Quickest ET",trF(t.et,3)+" s @ "+Math.round(t.mph)+" mph"]);
  if(R.pull)Object.keys(R.pull).forEach(k=>{const e=R.pull[k];if(mine(e))out.push(["Pull · "+trCls(SIM.PULL_CLASSES,k),e.full?"full pull":trF(e.ft,1)+" ft"]);});
  if(R.bog)Object.keys(R.bog).forEach(k=>{const e=R.bog[k];if(mine(e))out.push(["Bog · "+trCls(SIM.BOG_CLASSES,k),e.c?trF(e.t,2)+" s":trF(e.m,1)+" m"]);});
  if(R.lsr&&R.lsr.pb)Object.keys(R.lsr.pb).forEach(k=>{const e=R.lsr.pb[k];if(mine(e))out.push(["Salt · "+k,trF(e.mph,2)+" mph"]);});
  if(R.road)Object.keys(R.road).forEach(k=>{const e=R.road[k],t2=e&&SIM.ROAD_TRACKS[e.trk];if(mine(e)&&t2)out.push(["Lap · "+t2.n,fmtLap(e.t,2)]);});
  if(R.hill)Object.keys(R.hill).forEach(k=>{const e=R.hill[k];if(mine(e)&&e.t)out.push(["Cloudsplitter Peak · "+trHill(k),fmtHill(e.t)]);});
  const wins=tropBook().log.filter(e=>!e.seed&&e.slot!=="pennant"&&(e.h===h||e.eng===name)).length;if(wins)out.unshift(["Trophies",wins]);
  return out.slice(0,6);}
function tropRetire(){if(testing){toast("Let the run finish first");return;}
  const T=tropBook(),h=cfgHash(S.cfg),name=engineName(),cert=career()&&C().cert&&C().cert.ok&&C().cert.hash===h?C().cert.res:null,q=cert||quick||{};
  const snap={id:Date.now().toString(36),name:name.slice(0,40),cfg:Object.assign({},S.cfg),h,hp:Math.round(q.peakHp||0),tq:Math.round(q.peakTq||0),rel:q.rel,label:cfgLbl(S.cfg),best:tropBest(name,h),cert:!!cert};
  tropStamp(snap);const i=T.retired.findIndex(e=>e.h===h);
  if(i>=0){snap.id=T.retired[i].id;T.retired.splice(i,1);T.retired.unshift(snap);toast("Plaque updated — it was already on a stand");}
  else{if(T.retired.length>=TROPHY_RET_MAX){toast(`The room holds ${TROPHY_RET_MAX} retired engines — take one down first`);return;}T.retired.unshift(snap);toast(`RETIRED · ${snap.name} goes on a stand`);}
  if(career())logEvent(`Retired ${snap.name} to the trophy room — ${snap.hp.toLocaleString("en-CA")} hp`,"good");
  save();tropCountSync();if(TR.open){tropRefresh();setTimeout(()=>tropPick("E"+snap.id),300);}}
function tropLoad(id){const T=tropBook(),e=T.retired.find(x=>x.id===id);if(!e)return;if(testing){toast("Let the run finish first");return;}
  if(career()&&presetLocked(e.cfg)){toast(`Needs the ${presetLocked(e.cfg)} upgrade`);return;}
  S.cfg=Object.assign({},SIM.DEFAULT_CFG,e.cfg);S.profileId=null;S.name=e.name||null;afterCfgChange(true);tropClose();showTab("build");toast(`LOADED · ${e.name}`);}
function tropFront(id){const T=tropBook(),i=T.retired.findIndex(x=>x.id===id);if(i<0)return;const [e]=T.retired.splice(i,1);T.retired.unshift(e);save();tropRefresh();setTimeout(()=>tropPick("E"+id),300);}
function tropRemove(id){const T=tropBook(),i=T.retired.findIndex(x=>x.id===id);if(i<0)return;if(!confirm(`Take ${T.retired[i].name} out of the trophy room? The engine is gone from the room for good (your current build is untouched).`))return;T.retired.splice(i,1);save();tropRefresh();tropCard(null);tropCountSync();}
/* ---- the room UI ---- */
const TR={open:false,sel:null,list:false,map:{},gl:false};
function tropCounts(){const T=tropBook();return{shelf:T.log.filter(e=>(e.slot||"shelf")==="shelf").length,eng:T.retired.length};}
function tropCountSync(){if(!S||!S.mode||ff)return;try{const c=tropCounts(),t=c.shelf?`${c.shelf} on the shelf`:"empty shelf";document.querySelectorAll(".trN").forEach(b=>b.textContent=t);}catch(e){}}
function tropOpen(){if(testing){toast("Let the run finish first");return;}if(typeof tdIsOpen!=="undefined"&&tdIsOpen)tdClose();
  TR.open=true;TR.sel=null;document.documentElement.classList.add("troom");$("troom").hidden=false;tropCard(null);
  TR.gl=!!(typeof visReady!=="undefined"&&visReady&&ENGINE_VIS.setTrophy);
  try{ENGINE_VIS.resize();}catch(e){}
  tropRefresh();if(!TR.gl)tropListShow(true);else tropListShow(TR.list);
  setTimeout(()=>{if(TR.open)try{ENGINE_VIS.resize();}catch(e){}},60);
  $("trBack").focus({preventScroll:true});}
function tropClose(){if(!TR.open)return;TR.open=false;$("troom").hidden=true;document.documentElement.classList.remove("troom");if(TR.gl)ENGINE_VIS.setTrophy({on:false});else try{ENGINE_VIS.resize();}catch(e){}}
function tropRefresh(){const items=tropItems(),eng=tropEngines(),cr=career();TR.map={};items.forEach(i=>TR.map[i.id]=i);eng.forEach(e=>TR.map[e.id]={id:e.id,eng:e});
  const c=tropCounts(),med=items.filter(i=>i.slot==="medal").length,sl=items.filter(i=>i.slot==="slip").length;
  $("trSub").textContent=`${cr?"Career · week "+C().week:"Test cell"} · ${c.shelf} troph${c.shelf===1?"y":"ies"} · ${sl} slip${sl===1?"":"s"} · ${med} medal${med===1?"":"s"}${c.eng?" · "+c.eng+" retired":""}`;
  const note=$("trNote");note.hidden=cr&&c.shelf>0;
  note.innerHTML=!cr?`<b>Test cell shelf.</b> Practice wins, test-cell records and your achievements. Goals, sponsors and team titles hang in the career room.`:`<b>Empty shelf — go win something.</b> Race nights, pull and bog wins, salt records, 24 h podiums and Dyno day milestones land here.`;
  if(TR.gl)TR.gl=ENGINE_VIS.setTrophy({on:true,items,engines:eng,onPick:tropPick})!==false;
  tropListRender(items,eng);if(TR.sel&&TR.map[TR.sel])tropCard(TR.sel);}
function tropPick(id){if(!TR.open)return;if(!id||!TR.map[id]){tropCard(null);if(TR.gl)ENGINE_VIS.trophyFocus(null);return;}tropCard(id);if(TR.gl&&!TR.list)ENGINE_VIS.trophyFocus(id);}
function tropCard(id){const box=$("trCard");TR.sel=id||null;$("troom").classList.toggle("crd",!!(id&&TR.map[id]));if(!id||!TR.map[id]){box.hidden=true;box.innerHTML="";return;}const it=TR.map[id];let h="";
  if(it.eng){const e=it.eng.src,b=e.best||[];
    h=`<div class="trk">Retired engine${e.cert?" · certified":""} · ${esc(trWhen(e))}</div><h3>${esc(e.name)}</h3><p>${esc(e.label||"")}</p><div class="trnums">${[["Peak",Math.round(e.hp||0).toLocaleString("en-CA")+" hp"],["Torque",Math.round(e.tq||0).toLocaleString("en-CA")+" Nm"],["Reliability",e.rel!=null?e.rel:"—"]].concat(b).map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}</div>
      <div class="trbtns"><button class="btn sm pri" data-tra="load" data-id="${esc(e.id)}">Load this build</button>${tropBook().retired.indexOf(e)>=TR_STANDS?`<button class="btn sm ghost" data-tra="front" data-id="${esc(e.id)}">Put on a stand</button>`:""}<button class="btn sm ghost" data-tra="share" data-id="${esc(id)}">Share plaque</button><button class="btn sm ghost" data-tra="remove" data-id="${esc(e.id)}">Take down</button><button class="btn sm ghost" data-tra="close">Close</button></div>`;}
  else{const c=it.card;h=`<div class="trk t-${esc(c.tier||"gold")}">${esc(c.kick)}${c.when?" · "+esc(c.when):""}</div><h3>${esc(c.title)}</h3>${c.what?`<p>${esc(c.what)}</p>`:""}${c.nums&&c.nums.length?`<div class="trnums">${c.nums.map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}</div>`:""}
      ${c.veh||c.eng?`<p class="trveh">${c.veh?`<span>Vehicle</span> ${esc(c.veh)}`:""}${c.veh&&c.eng?" · ":""}${c.eng?`<span>Engine</span> ${esc(c.eng)}`:""}</p>`:""}
      <div class="trbtns"><button class="btn sm pri" data-tra="share" data-id="${esc(id)}">Share plaque</button><button class="btn sm ghost" data-tra="close">Close</button></div>`;}
  box.innerHTML=h+`<i class="hsheen" aria-hidden="true"></i>`;box.classList.add("holo");box.dataset.tier=it.eng?"eng":(it.card&&it.card.tier)||"gold";box.dataset.holo="";box.hidden=false;if(typeof holoWire==="function")holoWire(box);}
function tropListShow(on){TR.list=!!on;$("trList").hidden=!on;$("trListBtn").setAttribute("aria-pressed",String(!!on));$("trListBtn").textContent=on&&TR.gl?"Room":"List";$("trListBtn").hidden=!TR.gl;$("troom").classList.toggle("lst",!!on);}
function tropListRender(items,eng){const sec=(t,L,f,empty)=>`<div class="trsec"><h4>${t}<span>${L.length}</span></h4>${L.length?`<div class="trgrid">${L.map(f).join("")}</div>`:`<p class="hint">${empty}</p>`}</div>`;
  const card=i=>{const c=i.card;return `<button class="trc t-${esc(c.tier||"gold")}" data-trp="${esc(i.id)}"><svg viewBox="0 0 24 24"><path d="${ACH_ICONS[c.ic]||ACH_ICONS.trophy}"/></svg><b>${esc(c.title)}</b><small>${esc(c.kick)}${c.when?" · "+esc(c.when):""}</small></button>`;};
  const by=s=>items.filter(i=>i.slot===s),shelf=items.filter(i=>i.slot==="shelf"||i.slot==="pennant");
  const T=tropBook(),h=cfgHash(S.cfg),on=T.retired.some(e=>e.h===h);
  let o=`<div class="trret"><button class="btn sm info" data-tra="retire">${on?"Update this build's plaque":"Retire this build to the room"}</button><small>${esc(engineName())} — a snapshot of the build, its peak and best results, on an engine stand. Up to ${TR_STANDS} on stands, the rest listed.</small></div>`;
  o+=sec("Trophies",shelf,card,"Empty shelf — go win something: a race night, a pull, a bog, a salt record or a 24 h podium.");
  o+=sec("Record slips",by("slip"),card,"No records yet — a dyno pull or a pass on the strip starts the wall.");
  o+=sec("Engines on stands",eng,e=>`<button class="trc eng" data-trp="${esc(e.id)}"><svg viewBox="0 0 24 24"><path d="${ACH_ICONS.gauge}"/></svg><b>${esc(e.name)}</b><small>${esc(e.sub)}${T.retired.indexOf(e.src)>=TR_STANDS?" · in storage":""}</small></button>`,"No retired engines — retire a build you're proud of.");
  o+=sec("Medals",by("medal"),card,"No achievements yet.");
  if(career())o+=sec("Shop goals",by("cert"),card,"No goals completed yet.");
  $("trList").innerHTML=o;}
/* ---- share images: a plaque, or a photo of the room ---- */
async function tropShareCanvas(c,fn,title){const blob=await new Promise(r=>c.toBlob(r,"image/png"));if(!blob){toast("Couldn't make the picture here");return;}
  const dl=window.claude&&window.claude.use?await window.claude.use("downloads"):null;
  if(dl){try{await dl.save({filename:fn,data:blob});toast("Picture saved");}catch(e){if(e&&e.code!=="declined")toast("Couldn't save the picture here");}return;}
  const file=new File([blob],fn,{type:"image/png"});
  if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title});return;}catch(e){}}
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=fn;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);}
const TR_TIER_COL={gold:"#d9a93a",silver:"#c9ced6",bronze:"#b06a34"};
function tropPlaqueCanvas(id){const it=TR.map[id];if(!it)return null;const W=1080,H=1350,c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d");
  const F=(sz,w)=>`${w||600} ${sz}px "Chakra Petch","Barlow Condensed","Arial Narrow",sans-serif`,M=(sz,w)=>`${w||500} ${sz}px "IBM Plex Mono",Menlo,Consolas,monospace`;
  let k,t,what,when,nums,foot,tier="gold",ic="trophy";
  if(it.eng){const e=it.eng.src;k="RETIRED ENGINE";t=e.name;what=e.label||"";when=trWhen(e);nums=[["Peak",Math.round(e.hp||0).toLocaleString("en-CA")+" hp"],["Torque",Math.round(e.tq||0).toLocaleString("en-CA")+" Nm"],["Reliability",e.rel!=null?String(e.rel):"—"]].concat(e.best||[]);foot="";ic="gauge";}
  else{const cd=it.card;k=cd.kick.toUpperCase();t=cd.title;what=cd.what;when=cd.when;nums=cd.nums||[];foot=[cd.veh,cd.eng].filter(Boolean).join(" · ");tier=cd.tier||"gold";ic=cd.ic||"trophy";}
  {const g=x.createRadialGradient(W/2,H/2,200,W/2,H/2,900);g.addColorStop(0,"#2a2420");g.addColorStop(1,"#120f0c");x.fillStyle=g;x.fillRect(0,0,W,H);}
  const L=120,R=960,T=150,B=1200;x.save();x.shadowColor="rgba(0,0,0,.6)";x.shadowBlur=40;x.shadowOffsetY=16;x.fillStyle="#3b2617";x.fillRect(L-30,T-30,R-L+60,B-T+60);x.restore();
  {const g=x.createLinearGradient(0,T,0,B);g.addColorStop(0,"#e3c27a");g.addColorStop(.5,"#c59a4a");g.addColorStop(1,"#a77b33");x.fillStyle=g;x.fillRect(L,T,R-L,B-T);}
  x.strokeStyle="rgba(59,38,23,.7)";x.lineWidth=4;x.strokeRect(L+22,T+22,R-L-44,B-T-44);
  const fit=(s,font,max)=>{x.font=font;s=String(s==null?"":s);while(s.length>3&&x.measureText(s).width>max)s=s.slice(0,-2)+"…";return s;};
  const ink="#2a1d12",ink2="#4e3a22";x.textAlign="center";
  x.save();x.translate(W/2-60,T+70);x.scale(5,5);x.fillStyle=TR_TIER_COL[tier]||TR_TIER_COL.gold;x.strokeStyle=ink;x.lineWidth=0.9;try{const p=new Path2D(ACH_ICONS[ic]||ACH_ICONS.trophy);x.stroke(p);}catch(e){}x.restore();
  x.fillStyle=ink2;x.fillText(fit(k,M(28,600),R-L-120),W/2,T+250);x.font=M(28,600);
  x.fillStyle=ink;{let fz=72;x.font=F(fz,700);while(fz>44&&x.measureText(String(t)).width>R-L-110){fz-=4;x.font=F(fz,700);}x.fillText(fit(t,F(fz,700),R-L-110),W/2,T+340);}
  x.fillStyle=ink2;const words=String(what||"").split(" ");let line="",y=T+410;x.font=F(32,500);for(const w of words){const tt=line?line+" "+w:w;if(x.measureText(tt).width>R-L-140){x.fillText(line,W/2,y);y+=42;line=w;if(y>T+500)break;}else line=tt;}if(line&&y<=T+500)x.fillText(line,W/2,y);
  y=Math.max(y+70,T+560);x.textAlign="left";
  for(const [a,b] of nums.slice(0,8)){x.fillStyle=ink2;x.font=M(28);x.fillText(fit(String(a).toUpperCase(),M(28),300),L+70,y);x.textAlign="right";x.fillStyle=ink;x.fillText(fit(b,M(34,600),440),R-70,y);x.textAlign="left";
    x.strokeStyle="rgba(59,38,23,.35)";x.setLineDash([8,8]);x.lineWidth=2;x.beginPath();x.moveTo(L+70,y+18);x.lineTo(R-70,y+18);x.stroke();x.setLineDash([]);y+=62;}
  x.textAlign="center";x.fillStyle=ink2;if(foot)x.fillText(fit(foot,F(30,600),R-L-120),W/2,B-130);x.fillText(fit(when||"",M(26),R-L-120),W/2,B-86);
  x.fillStyle="#e8c27a";x.font=F(34,700);x.fillText("PRAIRIE ENGINE WORKS · TROPHY ROOM",W/2,H-50);return c;}
function tropPhotoCanvas(){const W=1080,H=1350,c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d");
  x.fillStyle="#1b1611";x.fillRect(0,0,W,H);x.fillStyle="#f4f1e6";x.fillRect(60,60,W-120,H-120);
  const shot=TR.gl&&ENGINE_VIS.trophyShot?ENGINE_VIS.trophyShot():null,pw=W-180,ph=980;
  if(shot&&shot.width){const s=Math.max(pw/shot.width,ph/shot.height),sw=pw/s,sh=ph/s;x.drawImage(shot,(shot.width-sw)/2,(shot.height-sh)/2,sw,sh,90,90,pw,ph);}
  else{x.fillStyle="#2c3b34";x.fillRect(90,90,pw,ph);x.fillStyle="#e8c27a";x.font='700 64px "Chakra Petch","Arial Narrow",sans-serif';x.textAlign="center";x.fillText("TROPHY ROOM",W/2,560);}
  const T=tropBook(),c2=tropCounts(),med=Object.keys(S.ach||{}).length;x.textAlign="center";x.fillStyle="#2a1d12";x.font='700 46px "Chakra Petch","Barlow Condensed","Arial Narrow",sans-serif';
  x.fillText("PRAIRIE ENGINE WORKS",W/2,1140);x.fillStyle="#6b6772";x.font='500 28px "IBM Plex Mono",Menlo,monospace';
  x.fillText(`${c2.shelf} troph${c2.shelf===1?"y":"ies"} · ${med} medal${med===1?"":"s"} · ${T.retired.length} retired engine${T.retired.length===1?"":"s"}`,W/2,1195);
  x.fillText(career()?"Career · week "+C().week:"Test cell",W/2,1240);return c;}
/* ---- wiring ---- */
document.addEventListener("click",e=>{if(!TR.open)return;   // the [data-trophy] buttons that open the room are wired in app/late.js
  const p=e.target.closest("[data-trp]");if(p){tropCard(p.dataset.trp);if(TR.gl&&window.matchMedia&&!deskOn())tropListShow(false);if(TR.gl&&!TR.list)ENGINE_VIS.trophyFocus(p.dataset.trp);return;}
  const a=e.target.closest("[data-tra]");if(!a)return;const k=a.dataset.tra,id=a.dataset.id;
  if(k==="close"){tropPick(null);}else if(k==="load")tropLoad(id);else if(k==="front")tropFront(id);else if(k==="remove")tropRemove(id);else if(k==="retire")tropRetire();
  else if(k==="share"){(async()=>{try{await document.fonts.ready;}catch(err){}const c=tropPlaqueCanvas(id);if(c)tropShareCanvas(c,"trophy-plaque.png","Trophy plaque");})();}});
$("trBack").addEventListener("click",tropClose);
$("trListBtn").addEventListener("click",()=>tropListShow(!TR.list));
$("trPhoto").addEventListener("click",async()=>{try{await document.fonts.ready;}catch(e){}tropShareCanvas(tropPhotoCanvas(),"trophy-room.png","Trophy room");});
document.addEventListener("keydown",e=>{if(!TR.open)return;if(e.key!=="Escape"){e.stopPropagation();return;}e.preventDefault();e.stopPropagation();if(TR.sel)tropPick(null);else tropClose();},true);   // the bench's single-key shortcuts sleep while the room is open
{const f=renderRecords;renderRecords=function(){f();tropCountSync();};const g=renderShop;renderShop=function(){g.apply(this,arguments);tropCountSync();};}
tropCountSync();   // the shelf count on the Records and Shop buttons, now that this file has landed
/* ===================== PHOTO MODE + BUILD SHEET =====================
   Photo mode (html.photo): the view goes full screen, the panels fold away and the 3D camera is free (vis/photo.js does the camera, lights and
   backdrop; this file is the controls, the gestures, the capture and the share/download). Not in the page: it is in app-late.js
   (app/late.js, since 1.76.137.0), so the camera button appears once that lands. phoSlug, phoFit and phoSave live in app/rcard.js,
   which shares them. A dock holds light presets, backdrops and a few looks
   (vignette, caption, turntable, 2x). Venue scenes (strip, pull, salt, bog, boats, road, hill) take the camera as an offset on their own director;
   light there is an exposure change plus a colour grade laid over the picture. Esc or the X leaves.
   The build sheet is a 1200x1600 spec card: the engine in a studio, peak numbers, the hp / torque curve, key parts, best results. It works from
   the VIEW tray too, with no photo mode needed. Both end in a PNG: saved with a download link, or the phone's share sheet. No sim is touched. */
const PHO={on:false,scene:"",light:"asis",back:"garage",vig:true,cap:false,big:true,spin:false,open:true,busy:false,poll:0,from:null};
const PHO_ICON={cam:'<svg viewBox="0 0 24 24"><path d="M4 8h3l1.6-2.4h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/></svg>',
  doc:'<svg viewBox="0 0 24 24"><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 12h6M10 16h6"/></svg>',x:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>'};
/* venue "light": a colour laid over the frame (CSS blend in the preview, the same canvas blend in the saved picture) */
const PHO_GRADE={golden:{col:"rgba(255,150,60,.42)",op:"soft-light"},night:{col:"rgba(28,52,140,.55)",op:"multiply"}};
const phoCanShare=()=>{try{return !!(navigator.share&&navigator.canShare&&navigator.canShare({files:[new File([new Blob(["x"])],"a.png",{type:"image/png"})]}));}catch(e){return false;}};
function phoBuild(){
  const v=$("view");if(!v||$("phUi"))return;
  const chips=(k,a)=>`<div class="phchips" data-ph="${k}">${a.map(([x,t])=>`<button type="button" data-v="${x}" aria-pressed="false">${t}</button>`).join("")}</div>`;
  const ui=document.createElement("div");ui.id="phUi";ui.hidden=true;
  ui.innerHTML=`<div id="phPad" aria-hidden="true"></div><div id="phGrade"></div><div id="phVig"></div>
    <div class="phtop"><div class="phh">Photo mode<small id="phHint"></small></div><button type="button" class="phx" id="phX" aria-label="Exit photo mode">${PHO_ICON.x}</button></div>
    <div class="phdock" role="group" aria-label="Photo controls"><div class="phbody" id="phBody">
      <div class="phrow"><span class="phl">Light</span>${chips("light",[["asis","As is"],["studio","Studio"],["golden","Golden"],["night","Night"]])}</div>
      <div class="phrow" id="phRowBack"><span class="phl">Backdrop</span>${chips("back",[["garage","Garage"],["grey","Grey"],["white","White"],["black","Black"],["dusk","Dusk"]])}</div>
      <div class="phrow"><span class="phl">Look</span><div class="phchips" data-ph="opt"><button type="button" data-o="vig" aria-pressed="true">Vignette</button><button type="button" data-o="cap" aria-pressed="false">Caption</button><button type="button" data-o="spin" id="phSpin" aria-pressed="false">Spin</button><button type="button" data-o="big" aria-pressed="true">2×</button></div></div>
    </div><div class="phact"><button type="button" class="phpri" id="phShot">Save photo</button><button type="button" id="phShare" hidden>Share</button><button type="button" id="phSheetBtn">Build sheet</button><button type="button" id="phMore" aria-expanded="true" aria-controls="phBody">Look ▾</button></div></div>`;
  v.appendChild(ui);
  const fab=document.createElement("button");fab.type="button";fab.id="phBtn";fab.setAttribute("aria-label","Photo mode");fab.innerHTML=PHO_ICON.cam;v.appendChild(fab);
  const tr=$("viewTray");
  if(tr){const mk=(id,ic,t)=>{const b=document.createElement("button");b.type="button";b.id=id;b.className="act";b.innerHTML=ic+"<span>"+t+"</span>";tr.appendChild(b);};
    mk("phTray",PHO_ICON.cam,"Photo mode");mk("phSheetTray",PHO_ICON.doc,"Build sheet");}
  const sh=document.createElement("div");sh.id="phSheet";sh.hidden=true;sh.setAttribute("role","dialog");sh.setAttribute("aria-modal","true");sh.setAttribute("aria-label","Build sheet");
  sh.innerHTML=`<div id="phSheetBox"><img id="phSheetImg" alt="Build sheet card"><p id="phSheetNote"></p><div class="phsb"><button type="button" class="phpri" id="phSheetSave">Download PNG</button><button type="button" id="phSheetShare" hidden>Share</button><button type="button" id="phSheetClose">Close</button></div></div>`;
  document.body.appendChild(sh);
  phoWire();
}
function phoSync(){
  const st=ENGINE_VIS.photoState?ENGINE_VIS.photoState():{scene:""};PHO.scene=st.scene;const venue=!!st.scene&&st.scene!=="x";
  document.querySelectorAll('#phUi [data-ph="light"] button').forEach(b=>{const on=b.dataset.v===PHO.light;b.classList.toggle("on",on);b.setAttribute("aria-pressed",on);});
  document.querySelectorAll('#phUi [data-ph="back"] button').forEach(b=>{const on=b.dataset.v===PHO.back;b.classList.toggle("on",on);b.setAttribute("aria-pressed",on);});
  const o={vig:PHO.vig,cap:PHO.cap,spin:PHO.spin,big:PHO.big};
  document.querySelectorAll('#phUi [data-o]').forEach(b=>{const on=!!o[b.dataset.o];b.classList.toggle("on",on);b.setAttribute("aria-pressed",on);});
  $("phRowBack").hidden=venue;$("phSpin").hidden=venue;
  $("phHint").textContent=venue?"Drag to look around the action · pinch or scroll to zoom · two fingers slide · double-tap resets":"Drag to orbit · pinch or scroll to zoom · two fingers slide · double-tap resets";
  $("phVig").style.display=PHO.vig?"":"none";
  const g=venue?PHO_GRADE[PHO.light]:null,ge=$("phGrade");ge.style.background=g?g.col:"none";ge.style.mixBlendMode=g?g.op:"normal";
  $("phMore").setAttribute("aria-expanded",PHO.open);$("phMore").textContent=PHO.open?"Look ▾":"Look ▴";$("phBody").hidden=!PHO.open;
  $("phShare").hidden=!phoCanShare();
}
function phoOpen(){
  if(PHO.on||!ENGINE_VIS.photoStart)return;
  if(typeof TR!=="undefined"&&TR.open){toast("Leave the trophy room first");return;}
  const r=ENGINE_VIS.photoStart();if(!r.ok){toast("Photo mode isn't available in this view");return;}
  PHO.on=true;PHO.from=document.activeElement;PHO.light="asis";PHO.back="garage";PHO.spin=false;
  if(!$("viewTray").hidden)viewTray(false);
  document.documentElement.classList.add("photo");$("phUi").hidden=false;$("phUi").classList.remove("hush");
  window.dispatchEvent(new Event("resize"));ENGINE_VIS.resize();
  phoSync();setTimeout(()=>$("phUi").classList.add("hush"),60);
  PHO.poll=setInterval(phoSync,900);
  $("phShot").focus({preventScroll:true});
}
function phoClose(){
  if(!PHO.on)return;
  PHO.on=false;clearInterval(PHO.poll);phoSheetClose();
  document.documentElement.classList.remove("photo");$("phUi").hidden=true;
  ENGINE_VIS.resize();ENGINE_VIS.photoStop();   // the view's size back first, then the camera and lights the way they were
  window.dispatchEvent(new Event("resize"));
  const f=PHO.from;PHO.from=null;try{if(f&&f.isConnected&&f.offsetParent&&f.focus)f.focus({preventScroll:true});else $("viewBtn").focus({preventScroll:true});}catch(e){}
}
function phoGrade(){const g=PHO.scene&&PHO.scene!=="x"?PHO_GRADE[PHO.light]:null;return g;}
/* the saved picture: the frame, the grade, the vignette, the caption */
function phoCompose(cv){
  const w=cv.width,h=cv.height,out=document.createElement("canvas");out.width=w;out.height=h;const x=out.getContext("2d");x.drawImage(cv,0,0);
  const g=phoGrade();if(g){x.save();x.globalCompositeOperation=g.op;x.fillStyle=g.col;x.fillRect(0,0,w,h);x.restore();}
  if(PHO.vig){x.save();x.translate(w/2,h/2);x.scale(w/2*Math.SQRT2,h/2*Math.SQRT2);const gr=x.createRadialGradient(0,0,0,0,0,1);gr.addColorStop(0,"rgba(0,0,0,0)");gr.addColorStop(.52,"rgba(0,0,0,0)");gr.addColorStop(1,"rgba(0,0,0,.55)");x.fillStyle=gr;x.fillRect(-1,-1,2,2);x.restore();}
  if(PHO.cap){const u=Math.max(1,Math.round(Math.min(w,h)/900*10)),pad=u*3.2;x.save();x.textBaseline="alphabetic";x.shadowColor="rgba(0,0,0,.7)";x.shadowBlur=u*1.5;
    x.fillStyle="rgba(255,255,255,.92)";x.font=`700 ${u*2.6}px "Chakra Petch","Barlow Condensed","Arial Narrow",sans-serif`;x.fillText(phoFit(x,engineName().toUpperCase(),w-pad*2),pad,h-pad-u*2.4);
    x.fillStyle="rgba(255,255,255,.7)";x.font=`500 ${u*1.7}px "IBM Plex Mono",Menlo,Consolas,monospace`;x.fillText("PRAIRIE ENGINE WORKS",pad,h-pad);x.restore();}
  return out;
}
async function phoShot(share){
  if(PHO.busy||!PHO.on)return;PHO.busy=true;const b=$(share?"phShare":"phShot");b.disabled=true;
  try{await new Promise(r=>requestAnimationFrame(r));
    const cv=ENGINE_VIS.photoGrab(PHO.big?2:1);if(!cv){toast("Nothing to photograph in this view");return;}
    const out=phoCompose(cv),st=new Date().toISOString().slice(0,16).replace(/[-:T]/g,"");
    await phoSave(out,`prairie-${phoSlug(engineName())}-${PHO.scene&&PHO.scene!=="x"?PHO.scene:"engine"}-${st}.png`,engineName(),share);}
  catch(e){toast("Couldn't take the picture here");}
  finally{PHO.busy=false;b.disabled=false;}
}
/* ---- gestures on the view ---- */
function phoWire(){
  const pad=$("phPad"),G={p:new Map(),dist:0,cx:0,cy:0,pan:false,tap:null,lt:0,lx:0,ly:0};
  const two=()=>{const [a,b]=[...G.p.values()];return{d:Math.hypot(a.x-b.x,a.y-b.y),cx:(a.x+b.x)/2,cy:(a.y+b.y)/2};};
  pad.addEventListener("pointerdown",e=>{if(e.pointerType==="mouse"&&e.button>2)return;try{pad.setPointerCapture(e.pointerId);}catch(_){}
    G.p.set(e.pointerId,{x:e.clientX,y:e.clientY,x0:e.clientX,y0:e.clientY,t0:performance.now()});G.pan=e.pointerType==="mouse"&&(e.button===1||e.button===2||e.shiftKey);
    if(G.p.size===2){const t=two();G.dist=t.d;G.cx=t.cx;G.cy=t.cy;}e.preventDefault();});
  pad.addEventListener("pointermove",e=>{const o=G.p.get(e.pointerId);if(!o)return;const dx=e.clientX-o.x,dy=e.clientY-o.y;o.x=e.clientX;o.y=e.clientY;
    if(G.p.size===1)ENGINE_VIS.photoView(G.pan?{pan:[dx,dy]}:{orbit:[dx,dy]});
    else if(G.p.size===2){const t=two();ENGINE_VIS.photoView({zoom:G.dist>0&&t.d>0?G.dist/t.d:1,pan:[t.cx-G.cx,t.cy-G.cy]});G.dist=t.d;G.cx=t.cx;G.cy=t.cy;}});
  const up=e=>{const o=G.p.get(e.pointerId);if(!o)return;G.p.delete(e.pointerId);if(G.p.size<2)G.dist=0;
    /* touch has no dblclick: two quick still taps reset the shot */
    if(e.type==="pointerup"&&e.pointerType!=="mouse"&&Math.hypot(e.clientX-o.x0,e.clientY-o.y0)<10&&performance.now()-o.t0<300){const n=performance.now();
      if(n-G.lt<380&&Math.hypot(e.clientX-G.lx,e.clientY-G.ly)<40){ENGINE_VIS.photoView({reset:true});G.lt=0;}else{G.lt=n;G.lx=e.clientX;G.ly=e.clientY;}}};
  pad.addEventListener("pointerup",up);pad.addEventListener("pointercancel",up);
  pad.addEventListener("wheel",e=>{e.preventDefault();ENGINE_VIS.photoView({zoom:Math.max(.5,Math.min(2,1+e.deltaY*(e.ctrlKey?0.01:0.0012)))});},{passive:false});
  pad.addEventListener("dblclick",()=>ENGINE_VIS.photoView({reset:true}));
  pad.addEventListener("contextmenu",e=>e.preventDefault());
  $("phX").addEventListener("click",phoClose);
  $("phShot").addEventListener("click",()=>phoShot(false));$("phShare").addEventListener("click",()=>phoShot(true));
  $("phSheetBtn").addEventListener("click",()=>phoSheet());
  $("phMore").addEventListener("click",()=>{PHO.open=!PHO.open;phoSync();});
  $("phUi").addEventListener("click",e=>{const b=e.target.closest("[data-ph] button");if(!b||!PHO.on)return;const k=b.parentElement.dataset.ph;
    if(k==="light"){PHO.light=b.dataset.v;ENGINE_VIS.photoLight(PHO.light);}
    else if(k==="back"){PHO.back=b.dataset.v;ENGINE_VIS.photoBack(PHO.back);}
    else{const o=b.dataset.o;PHO[o]=!PHO[o];if(o==="spin")ENGINE_VIS.photoSpin(PHO.spin);}
    phoSync();});
  $("phBtn").addEventListener("click",phoOpen);$("phTray").addEventListener("click",phoOpen);
  $("phSheetTray").addEventListener("click",()=>{if(!$("viewTray").hidden)viewTray(false);phoSheet();});
  $("phSheetClose").addEventListener("click",phoSheetClose);$("phSheetSave").addEventListener("click",()=>phoSheetSave(false));$("phSheetShare").addEventListener("click",()=>phoSheetSave(true));
  $("phSheet").addEventListener("pointerdown",e=>{if(e.target===$("phSheet"))phoSheetClose();});
  /* keys while photo mode is up belong to it: Esc closes the sheet then the mode, arrows orbit, + / - zoom, 0 resets */
  window.addEventListener("keydown",e=>{
    if(!$("phSheet").hidden){e.stopPropagation();if(e.key==="Escape"){e.preventDefault();phoSheetClose();}
      else if(e.key==="Tab"){const f=[...$("phSheet").querySelectorAll("button:not([hidden]):not(:disabled)")];if(!f.length)return;const i=f.indexOf(document.activeElement),n=e.shiftKey?(i<=0?f.length-1:i-1):(i<0||i===f.length-1?0:i+1);e.preventDefault();f[n].focus();}return;}
    if(!PHO.on)return;e.stopPropagation();
    if(e.key==="Escape"){e.preventDefault();phoClose();return;}
    if(e.target&&/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))return;
    const k=e.key,s=e.shiftKey?60:24;
    if(k==="ArrowLeft"){ENGINE_VIS.photoView({orbit:[-s,0]});e.preventDefault();}else if(k==="ArrowRight"){ENGINE_VIS.photoView({orbit:[s,0]});e.preventDefault();}
    else if(k==="ArrowUp"){ENGINE_VIS.photoView({orbit:[0,-s]});e.preventDefault();}else if(k==="ArrowDown"){ENGINE_VIS.photoView({orbit:[0,s]});e.preventDefault();}
    else if(k==="+"||k==="="){ENGINE_VIS.photoView({zoom:.88});}else if(k==="-"||k==="_"){ENGINE_VIS.photoView({zoom:1.14});}else if(k==="0"){ENGINE_VIS.photoView({reset:true});}
    else if(k==="Tab"){const f=[...$("phUi").querySelectorAll("button:not([hidden]):not(:disabled)")];if(!f.length)return;const i=f.indexOf(document.activeElement),n=e.shiftKey?(i<=0?f.length-1:i-1):(i<0||i===f.length-1?0:i+1);e.preventDefault();f[n].focus();}
  },true);
}
/* ---- build sheet ---- */
const PHS={url:"",canvas:null,from:null};
const phoN=v=>Math.round(v).toLocaleString("en-CA");
function phoParts(cfg){
  const want=["layout","asp","rotHousing","apexSeal","head","blockMat","piston","rod","crank","ic","nitrous","intake","exhaust","cooling"],rows=[];
  const F={};for(const sec of FORM)for(const f of sec.fields)if(f.type==="seg"||f.type==="swatch")F[f.key]=f;
  for(const k of want){const f=F[k];if(!f||(f.showIf&&!f.showIf(cfg)))continue;const t=OPT[f.optTable||f.key],o=t&&t[cfg[k]];if(!o)continue;const nm=o.name||String(cfg[k]);if(/^(none|no |off)/i.test(nm)&&(k==="ic"||k==="nitrous"))continue;
    let v=nm;if(k==="asp"&&cfg.asp!=="na")v=nm+" · "+bv(cfg.boost)+" "+pU();rows.push([(f.labelIf&&f.labelIf(cfg))||f.label,v]);}
  return rows;
}
async function phoSheetCanvas(){
  const W=1200,H=1600,c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d");
  try{await Promise.race([Promise.all(['700 40px "Chakra Petch"','600 30px "Chakra Petch"','500 24px "IBM Plex Mono"'].map(f=>document.fonts.load(f))),new Promise(r=>setTimeout(r,1500))]);}catch(e){}
  const F=(sz,w)=>`${w||600} ${sz}px "Chakra Petch","Barlow Condensed","Arial Narrow",sans-serif`,M=(sz,w)=>`${w||500} ${sz}px "IBM Plex Mono",Menlo,Consolas,monospace`;
  const INK="#faf9f5",MUTE="#a8a295",ORG="#d97757",ORG2="#e8956f",LINE="#2e2d2b",PNL="#1c1b19",L=60,R=W-60;
  const q=quick,cfg=S.cfg,name=engineName(),h=cfgHash(cfg);
  x.fillStyle="#141413";x.fillRect(0,0,W,H);
  {const g=x.createLinearGradient(0,0,0,300);g.addColorStop(0,"rgba(217,119,87,.16)");g.addColorStop(1,"rgba(217,119,87,0)");x.fillStyle=g;x.fillRect(0,0,W,300);}
  x.fillStyle=ORG;x.fillRect(L,44,6,92);
  x.textAlign="left";x.textBaseline="alphabetic";x.fillStyle=ORG2;x.font=M(24,600);x.fillText("PRAIRIE ENGINE WORKS · BUILD SHEET",L+24,70);
  x.fillStyle=INK;{let fz=64;x.font=F(fz,700);while(fz>36&&x.measureText(name).width>R-L-24){fz-=4;x.font=F(fz,700);}x.fillText(phoFit(x,name,R-L-24),L+24,126);}
  x.fillStyle=MUTE;x.font=M(24);x.fillText(phoFit(x,cfgLbl(cfg),R-L),L,170);
  /* the engine in a studio */
  const PX=L,PY=192,PW=R-L,PH2=480;let shot=null;try{shot=ENGINE_VIS.photoShot?ENGINE_VIS.photoShot(1620,Math.round(1620*PH2/PW)):null;}catch(e){shot=null;}
  x.save();x.beginPath();x.roundRect?x.roundRect(PX,PY,PW,PH2,10):x.rect(PX,PY,PW,PH2);x.clip();
  if(shot&&shot.width){x.drawImage(shot,0,0,shot.width,shot.height,PX,PY,PW,PH2);}else{x.fillStyle=PNL;x.fillRect(PX,PY,PW,PH2);x.fillStyle=MUTE;x.font=F(34,600);x.textAlign="center";x.fillText("No 3D view on this device",W/2,PY+PH2/2);x.textAlign="left";}
  x.restore();x.strokeStyle=LINE;x.lineWidth=2;x.strokeRect(PX,PY,PW,PH2);
  /* the numbers */
  const asp=OPT.asp[cfg.asp],fu=OPT.fuel[cfg.fuel];
  const st=[["PEAK POWER",phoN(q.peakHp)+" hp","@ "+phoN(q.peakHpRpm)+" rpm",1],["PEAK TORQUE",phoN(q.peakTq)+" Nm","@ "+phoN(q.peakTqRpm)+" rpm",0],["DISPLACEMENT",q.Vd<1000?Math.round(q.Vd)+" cc":(q.Vd/1000).toFixed(1)+" L",phoN(q.Vd*0.0610237)+" cu in",0],["REDLINE",phoN(cfg.redline||0)+" rpm","",0],
    ["ASPIRATION",cfg.asp==="na"?"NA":(asp&&asp.name?asp.name:(ASP_SYM[cfg.asp]||cfg.asp.toUpperCase())),cfg.asp==="na"?"Naturally aspirated":bv(cfg.boost)+" "+pU()+" boost",0],["FUEL",fuelShort(cfg.fuel),fu&&fu.name?fu.name:"",0],["WEIGHT",phoN(q.kg)+" kg","",0],["RELIABILITY",isFinite(q.rel)?String(Math.round(q.rel)):"—","of 100",0]];
  const cw=(R-L)/4,SY=692;
  st.forEach((s,i)=>{const cx=L+(i%4)*cw,cy=SY+Math.floor(i/4)*122;x.fillStyle=PNL;x.fillRect(cx+(i%4?6:0),cy,cw-(i%4?6:0),112);
    const tx=cx+(i%4?6:0)+16;x.fillStyle=MUTE;x.font=M(18,600);x.fillText(s[0],tx,cy+30);x.fillStyle=s[3]?ORG2:INK;{let fz=44;x.font=F(fz,700);while(fz>26&&x.measureText(s[1]).width>cw-44){fz-=2;x.font=F(fz,700);}x.fillText(phoFit(x,s[1],cw-40),tx,cy+72);}x.fillStyle=MUTE;x.font=M(18);x.fillText(phoFit(x,s[2],cw-40),tx,cy+100);});
  /* the curve */
  const CY=946,CH=270,padL=70,padR=70,padT=34,padB=34,cx0=L+padL,cx1=R-padR,cy0=CY+padT,cy1=CY+CH-padB;
  x.fillStyle=PNL;x.fillRect(L,CY,R-L,CH);
  {const rp=q.rpms,n=rp.length,r0=Math.floor(rp[0]/1000)*1000,r1=Math.ceil(rp[n-1]/1000)*1000,tmax=Math.max(50,Math.ceil(Math.max(...q.torque)*1.1/50)*50),pmax=Math.max(50,Math.ceil(Math.max(...q.power)*1.1/50)*50);
    const X=r=>cx0+(r-r0)/Math.max(1,r1-r0)*(cx1-cx0),YT=v=>cy1-v/tmax*(cy1-cy0),YP=v=>cy1-v/pmax*(cy1-cy0);
    x.lineWidth=1;x.font=M(16);for(let i=0;i<=4;i++){const y=cy1-i*(cy1-cy0)/4;x.strokeStyle="rgba(255,255,255,.08)";x.beginPath();x.moveTo(cx0,y);x.lineTo(cx1,y);x.stroke();
      x.textAlign="right";x.fillStyle=ORG;x.fillText(phoN(tmax*i/4),cx0-8,y+5);x.textAlign="left";x.fillStyle=INK;x.fillText(phoN(pmax*i/4),cx1+8,y+5);}
    const st2=Math.max(1000,Math.ceil((r1-r0)/6/1000)*1000);x.textAlign="center";x.fillStyle=MUTE;for(let r=r0;r<=r1;r+=st2){x.strokeStyle="rgba(255,255,255,.05)";x.beginPath();x.moveTo(X(r),cy0);x.lineTo(X(r),cy1);x.stroke();x.fillText((r/1000)+"k",X(r),cy1+22);}
    const line=(arr,Y,col)=>{x.strokeStyle=col;x.lineWidth=4;x.lineJoin="round";x.beginPath();for(let i=0;i<n;i++){const px=X(rp[i]),py=Y(arr[i]);i?x.lineTo(px,py):x.moveTo(px,py);}x.stroke();};
    x.fillStyle="rgba(217,119,87,.12)";x.beginPath();x.moveTo(X(rp[0]),cy1);for(let i=0;i<n;i++)x.lineTo(X(rp[i]),YT(q.torque[i]));x.lineTo(X(rp[n-1]),cy1);x.closePath();x.fill();
    line(q.torque,YT,ORG);line(q.power,YP,INK);
    const dot=(r,v,Y,col)=>{x.fillStyle="#141413";x.strokeStyle=col;x.lineWidth=4;x.beginPath();x.arc(X(r),Y(v),9,0,Math.PI*2);x.fill();x.stroke();};
    dot(q.peakHpRpm,q.peakHp,YP,INK);dot(q.peakTqRpm,q.peakTq,YT,ORG);
    x.textAlign="left";x.font=M(18,600);x.fillStyle=ORG;x.fillText("TORQUE  Nm",cx0+8,CY+24);x.fillStyle=INK;x.fillText("POWER  hp",cx0+190,CY+24);x.textAlign="right";x.fillStyle=MUTE;x.fillText("RPM",cx1,CY+24);}
  /* key parts and results */
  const BY=1262,half=(R-L-40)/2,rx=L+half+40;
  x.textAlign="left";x.fillStyle=ORG2;x.font=M(20,600);x.fillText("KEY PARTS",L,BY);x.fillText("RESULTS",rx,BY);x.fillStyle=LINE;x.fillRect(L,BY+10,half,2);x.fillRect(rx,BY+10,half,2);
  const row=(cx,y,k,v,w)=>{x.textAlign="left";x.fillStyle=MUTE;x.font=M(19);x.fillText(phoFit(x,k.toUpperCase(),w*0.42),cx,y);x.textAlign="right";x.fillStyle=INK;x.font=F(25,600);x.fillText(phoFit(x,v,w*0.56),cx+w,y);};
  phoParts(cfg).slice(0,7).forEach((r,i)=>row(L,BY+46+i*32,r[0],r[1],half));
  let res=[];try{res=tropBest(name,h);}catch(e){res=[];}
  let wins=0;try{wins=tropBook().log.filter(e=>!e.seed&&e.slot!=="pennant"&&(e.h===h||e.eng===name)).length;}catch(e){}
  if(!res.length){x.textAlign="left";x.fillStyle=MUTE;x.font=F(25,500);x.fillText("No event results for this build yet.",rx,BY+46);x.font=F(22,500);x.fillText("Take it to the strip, the pull or the salt.",rx,BY+80);}
  else res.slice(0,6).forEach((r,i)=>row(rx,BY+46+i*32,r[0],String(r[1]),half));
  if(wins)row(rx,BY+46+Math.min(res.length,6)*32,"Trophies",String(wins),half);
  /* footer */
  x.fillStyle=LINE;x.fillRect(L,H-62,R-L,2);x.textAlign="left";x.fillStyle=MUTE;x.font=M(18);x.fillText((career()?"Career · week "+C().week:"Test cell")+" · "+new Date().toLocaleDateString("en-CA"),L,H-28);
  x.textAlign="right";x.fillStyle=ORG2;x.font=F(22,700);x.fillText("PRAIRIE ENGINE WORKS",R,H-28);
  return c;
}
async function phoSheet(){
  if(PHS.busy)return;PHS.busy=true;
  try{if(!quick){toast("Nothing to sheet yet");return;}
    toast("Building the sheet…");await new Promise(r=>requestAnimationFrame(r));
    const c=await phoSheetCanvas();PHS.canvas=c;
    const blob=await new Promise(r=>c.toBlob(r,"image/png"));if(!blob){toast("Couldn't make the sheet here");return;}
    if(PHS.url)URL.revokeObjectURL(PHS.url);PHS.url=URL.createObjectURL(blob);
    $("phSheetImg").src=PHS.url;$("phSheetNote").textContent="1200 × 1600 PNG";$("phSheetShare").hidden=!phoCanShare();
    PHS.from=document.activeElement;$("phSheet").hidden=false;$("phSheetSave").focus({preventScroll:true});}
  catch(e){toast("Couldn't make the sheet here");}
  finally{PHS.busy=false;}
}
function phoSheetClose(){if($("phSheet").hidden)return;$("phSheet").hidden=true;$("phSheetImg").removeAttribute("src");if(PHS.url){URL.revokeObjectURL(PHS.url);PHS.url="";}PHS.canvas=null;
  const f=PHS.from;PHS.from=null;try{if(f&&f.isConnected&&f.focus)f.focus({preventScroll:true});}catch(e){}}
async function phoSheetSave(share){if(!PHS.canvas)return;await phoSave(PHS.canvas,`prairie-${phoSlug(engineName())}-build-sheet.png`,engineName()+" · build sheet",share);}
phoBuild();
/* ===================== GLOSSARY, TAP-TO-EXPLAIN AND LESSONS ===================== */
/* Not in the page: build.js writes this file into app-late.js, which the page fetches in the background once the garage is up
   (app/late.js, since 1.76.136.0), so a first visit downloads less before the workshop shows. It runs as a classic script, so it
   sees every top-level name of the app exactly as it did when it sat in help.js, and its functions become page globals.
   Rules (build.js checks them): no top-level name here may also be declared by the page, and the page may only call the functions
   listed in LATE_FNS (app/late.js), which stand in until this file has run; anything else it touches needs a typeof guard.
   The three buttons that open this code (Glossary, Lessons, the glossary On/Off switch) are wired in app/late.js. */
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
["smoke","Smoke limit","smoke limit|smoke|black smoke|=Smoke","The smoke limit is the least air a diesel can burn its fuel in without soot. Past it, fuel burns badly and the exhaust goes black, so the fuelling is held at a minimum lambda.","It is the real power limit of a diesel. More air (boost) lets you burn more fuel inside the limit.","lambda,egt,boost"],
["injtiming","Injection timing","injection timing|injection advance|pump timing","When in the compression stroke the diesel fuel is injected, in degrees before top dead centre. Earlier means a higher peak pressure and a hotter, noisier burn; later gives less pressure but more smoke and heat.","It is the diesel's equivalent of the ignition slider: more advance trades torque and cold-start ability against peak pressure.","mbt,pmax,cetane"],
["commonrail","Common rail","common rail|common-rail","A common-rail diesel keeps fuel at very high pressure in a shared rail, and electronic injectors open when told to. The pressure is independent of rpm, and the fuel can be split into several injections.","It makes the quiet, clean, strong diesels of the last twenty years, and good low-rpm torque.","heui,ppump,vepump"],
["heui","HEUI","=HEUI|hydraulic electronic unit injector","Hydraulic electronic unit injectors are electronically controlled injectors boosted by high-pressure engine oil. Each one multiplies the oil pressure into fuel pressure at the nozzle.","They give common-rail-style control from an older design, as on the 7.3 Power Stroke.","commonrail"],
["ppump","P-pump","P-pump|P pump|=P7100|inline pump|inline mechanical","An inline injection pump with one plunger per cylinder, driven by the engine and set by a mechanical governor. It is rugged and easy to tune for large fuel flow.","The classic pulling and high-power pump: a simple mechanism with lots of fuelling headroom.","vepump,commonrail"],
["vepump","VE pump","VE pump|rotary pump|rotary injection pump|distributor pump","A rotary distributor-type diesel injection pump: one plunger pumps for all the cylinders and a rotor spins to deal the fuel out in turn. Compact, cheap and lower in pressure.","Fine for small diesels and light duty; it caps how much fuel a build can use.","ppump"],
["nozzles","Injector nozzles and sticks","nozzles|nozzle|sticks|injector sticks|injector nozzles","The nozzle is the tip of a diesel injector, with tiny holes that atomise fuel into the cylinder. Bigger holes (pullers call a set of injectors 'sticks' by size) flow more fuel for more power and more smoke.","Nozzle size caps how much fuel can go in during the available time, and with it the power.","commonrail,smoke"],
["glow","Glow plugs","glow plugs|glow plug|intake heater|grid heater","Glow plugs are small electric heaters in each diesel cylinder that warm the chamber for starting, since cold air at the end of compression may not be hot enough to light the fuel.","They matter for the cold-start test and for racing in the cold.","coldstart,cetane"],
["coldstart","Cold start","cold start|cold-start|cold starting","Starting at low temperature is hard for any engine: fuel will not vaporise, oil is thick and the battery weak. A diesel must also get its cylinder air hot enough to ignite the fuel by compression alone.","The cold-start test checks this. Compression, glow plugs, cetane and oil grade help.","glow,cetane,cloud"],
["cloud","Cloud point","cloud point|gel point|waxing","The cloud point is the temperature at which wax first appears in diesel fuel. It plugs filters well before the fuel is solid, and biodiesel clouds at a higher temperature than mineral diesel.","It is a fuel limit in the cold; B100 is the worst case.","b100,coldstart"],
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
["et","Elapsed time (ET)","=ET|elapsed time|quarter mile","Elapsed time is how long a pass takes from the car leaving the line to crossing the finish, measured at 1/8 or 1/4 mile.","It is the number the strip is judged on, and the one a drag team lives by.","trap,sixty,breakout"],
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
["sae","SAE J1349 correction","SAE J1349|SAE|correction factor|corrected hp|corrected power","SAE J1349 is a standard formula for correcting a power reading to a reference temperature and pressure (25 °C and 99 kPa dry air), so a dyno run on a hot day can be compared with a cold one.","The dyno reports raw and SAE-corrected power. Certification uses the corrected number.","densalt"],
["densalt","Density altitude","density altitude|air density","Density altitude is the height at which standard air has the same density as today's air. Heat, humidity and elevation all thin the air and raise it.","Thin air means less oxygen and less power for an engine without boost, which is why altitude, on the hill climb or a high dyno cell, punishes naturally aspirated engines.","sae,boost"],
["reliability","Reliability score","reliability","The shop's score for how much margin an engine has: how far every stress limit sits from what the engine actually does. It sets whether a build certifies and how likely it is to let go on race day.","Some team drivers ask for a minimum score, and a team engine's wear comes straight off it.","freshen,smoothness"],
["smoothness","Smoothness","smoothness","Smoothness is the score for how little the engine shakes and how even its torque is. It depends on cylinder count, layout, firing order and balance.","It shapes the sound and the vibration through the car; a race engine gives some of it up for power.","firing,crossplane"],
["freshen","Passes to freshen","passes to freshen|freshen-up|freshen up","Racing engines wear with every pass. 'Passes to freshen' is how many hard passes an engine can make before the teardown that replaces its parts.","A team engine wears every round and needs a freshen-up from the team's budget, which is a trade against power.","reliability,et"],
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
const GL={on:true,re:null,ci:new Map(),cs:new Map(),cache:new Map(),mo:null,pop:null,pin:false,timer:0,roots:["tab-analysis","tab-market","testExtra","verdict","stressList","sheetBody","dynoHint"]};
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

/* ---- guided lessons: the tour's spotlight, a sandbox rig, and the player's own build put back afterwards ---- */
const LESSONS=[
 {id:"diesel",name:"Diesel 101",sub:"compression, smoke limit, fuel system",preset:"c59_12v",env:{testType:"pull"},steps:[
  {tab:"build",sel:".strip",title:"No spark, just heat",text:"This is a 5.9 litre inline-six diesel. It has no spark plugs: it squeezes air until it is hot enough to light the fuel the instant it is sprayed in. Everything on these steps follows from that."},
  {tab:"build",sel:"#r-cr",up:1,lbl:1,title:"Compression ratio",text:"A diesel runs 14 to 24:1. Higher compression lights the fuel more easily and extracts more work, but it raises cylinder pressure and stress on the block."},
  {tab:"build",sel:"#r-lambda",up:1,lbl:1,title:"The smoke limit",text:"A diesel always runs with spare air. Lambda here is the full-load mixture: push it lower for more fuel and power, and the exhaust turns black."},
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
  {tab:"events",sel:'#evHead',title:"Take it to the strip",text:"Events holds the strip, the sled, the salt, the road and the 24 Hours. Drag strip is the 1/4 mile. Your nitrous kit only arrives when the throttle is wide open, and it comes on at the point you choose below."},
  {tab:"events",sel:'#envBox [data-ek="n2oHeater"]',up:1,lbl:1,title:"Bottle pressure and purge",text:"The shot is jetted for about 950 psi, so a heater keeps passes the same. On the line, hold PURGE (or press P) until it spits white so the first spray is liquid."},
  {tab:"events",sel:"#runTest",title:"Stage and launch",text:"Stage the car and launch on the green. A strong launch counts for more than top-end power, and a shot that comes on too early only spins the tyres."},
  {tab:"events",sel:"#dynoHint",title:"Read the timing slip",text:"After a pass, the slip lists reaction time, 60 ft, the eighth and quarter mile ET with trap speed. If the 60 ft is slow but the trap speed is high, the power is there and the launch is the problem."}]},
 {id:"pulling",name:"Pulling 101",sub:"the sled, hitch, tyres and throttle",preset:"smoker26",env:{testType:"pull_sled"},steps:[
  {tab:"events",sel:'#evHead',title:"The sled pull",text:"Truck pull lives on the Events tab. A truck drags a sled down 300 feet of dirt. A heavy box slides forward as it goes, pressing the sled's pan into the track, so the load grows every foot. Farthest wins; a full pull gets a pull-off."},
  {tab:"events",sel:'#envBox [data-pk="pullCls"]',up:1,lbl:1,title:"Pick a class",text:"Each class has its own weight limit, tyres and rules. Your build has to be legal for the class, and the legal line is shown under each button."},
  {tab:"events",sel:'#envBox [data-pk="pullGear"]',up:1,lbl:1,title:"Choose a gear",text:"A tall gear carries speed into the heavy end of the track; a short one gives more pull but digs the tyres if you stay flat on it."},
  {tab:"events",sel:'#envBox [data-pk="pullTyre"]',up:1,lbl:1,title:"Tyres and slip",text:"Some slip is good: there is a sweet spot where the tyres pull hardest. Too little and the engine bogs, too much and the tyres dig a hole. The pull sheet reports the time you spent in that band."},
  {tab:"events",sel:"#er-pullHitch",up:0,wrap:".envgrid",title:"Hitch height and ballast",text:"Under Advanced. A higher hitch plants the rear tyres but lifts the nose. Past a point the front hops and grip goes with it. Weight on the front bracket holds the nose down; set back, it plants the rear instead. Tyre pressure trades bite for hop, and a throttle stop keeps a big engine from digging."},
  {tab:"build",sel:'[data-k="dNoz"]',up:1,lbl:1,title:"Fuel and sticks",text:"Pulling diesels live on large injector nozzles and compound turbos. The smoke limit is not a rule here; the limits are cylinder pressure, the head gasket and the pump."},
  {tab:"events",sel:"#runTest",title:"Hold the throttle",text:"Start the pull and hold the button (or Space) for throttle. Ease off when the tyres spin to stay in the sweet spot; the engine must keep pulling as the sled gets heavier."},
  {tab:"events",sel:"#dynoHint",title:"Read the pull sheet",text:"The sheet lists distance, setup, tyre slip and the reasons the pull ended. If the truck stopped bogged, you need torque or gear; if it spun, you need grip or less throttle."}]},
 /* the Events lessons below: Setup controls show by default; Advanced ones are revealed by accReveal (tab + section). "#dynoHint,#verdict" = whichever result block is showing */
 {id:"bracket",name:"Bracket night 101",sub:"dial-in, breakouts, tyres, the tree",preset:"sbc350",env:{testType:"drag",dragFmt:"bracket",dragQuick:true},steps:[
  {tab:"events",sel:'#evHead',title:"Consistent beats quick",text:"Bracket racing is not won by the fastest car. Before the round you dial in the ET you expect. The slower dial leaves first, and the first car to the stripe wins, unless it ran quicker than its dial. That is a breakout, and it loses."},
  {tab:"events",sel:'#envBox [data-ek="dragFmt"]',up:1,lbl:1,title:"Three ways to race",text:"Test & tune is one pass. Eliminations is a heads-up ladder where a quick light beats a quick car. Bracket is the dial-in night. The Bracket night tile above skips the time trials and goes straight to round one, up to three rounds."},
  {tab:"events",sel:'#envBox [data-ek="tyre"]',up:1,lbl:1,title:"Grip is repeatability",text:"Street radial, drag radial or slick. A tyre that spins one pass in three gives you a different ET each round, and your dial is worthless. Pick the grip that lets the car do the same thing every time."},
  {tab:"events",sel:"#er-launchRpm",wrap:".env",title:"Launch rpm",text:"Where the clutch lets go. Too high and the tyres spin, too low and the engine bogs. You are chasing a number you can repeat, so find a launch rpm you can hit every pass."},
  {tab:"events",sel:'#envBox [data-ek="dragDrive"]',up:2,title:"You drive, or Auto",text:"Auto stages and leaves on the green with a sharp light, never red, and drives every pass of the night. Drive it yourself and you tap on the green of your own tree, because the slower dial leaves first."},
  {tab:"events",sel:"#er-mass",wrap:".env",title:"Weight",text:"Under Advanced, in Car. Car weight is the car with a typical 230 kg V8 in it; a heavier engine adds the difference and a lighter one saves it. Car weight and the rear weight split both change the ET. For a dial it matters less how light the car is than that it stays the same between rounds."},
  {tab:"events",sel:"#er-tyrePsi",wrap:".env",title:"Pressure and shocks",text:"Under Advanced, in Driveline. Tyre pressure and the shocks are what a tuner changes between rounds: soft shocks bite harder and lift the nose, firm ones keep it flat but may spin."},
  {tab:"events",sel:"#runTest",title:"Enter the night",text:"Tap to enter. Leave on the green of your own tree. A red light loses outright, and running quicker than your dial is a breakout. Entry is free in the sandbox."},
  {tab:"events",sel:"#dynoHint,#verdict",title:"Read the slip",text:"After each round the slip shows your ET against your dial, your rival's ET and dial, and who went through. Ran a hair over your dial is a good round. Ran under it, and you broke out and lost, however quick it was."}]},
 {id:"salt",name:"Salt flats 101",sub:"thin air, gearing, body, chutes",preset:"2jzgte",env:{testType:"salt"},steps:[
  {tab:"events",sel:'#evHead',title:"A mile at full speed",text:"Salt flats is a top-speed run. You roll to the line, push off, and hold the throttle while the clocks time one mile that starts well down the course. Salt grips about half as well as a prepped strip, so the wheels let go early."},
  {tab:"events",sel:"#envBox>p.hint",title:"Thin air costs power",text:"Bitterwater is high and warm, so the engine makes less than it did on the dyno. A boosted engine gets most of it back. A naturally aspirated one does not."},
  {tab:"events",sel:'#envBox [data-sk="saltBody"]',up:1,lbl:1,title:"Pick a body",text:"From the altered, with its street body and big radiator, to the streamliner with its wheels enclosed. Less drag is more top speed, but the streamliner is the twitchy one."},
  {tab:"events",sel:'#envBox [data-sk="saltCourse"]',up:1,lbl:1,title:"Short or long course",text:"The short course has a one-mile run-up and the long one four. A longer run-up gives the car more road to climb to its top speed before the clocks start."},
  {tab:"events",sel:"#er-saltTop",wrap:".env",title:"Top gear",text:"Under Advanced, in Gearing. This is the road speed at redline in top gear. Too short and you hit the limiter early. Too tall and the engine never reaches its power. The Suggest gearing button below it picks one for this engine and body."},
  {tab:"events",sel:'#envBox [data-sk="saltChute"]',up:1,lbl:1,title:"The parachute",text:"Under Advanced, in Body. With no chute the tech inspector caps you at 175 mph. A single chute is rated for 300, and a drogue plus main chute for 503. Fit what the speed you expect needs."},
  {tab:"events",sel:"#runTest",title:"Roll to the line",text:"Hold the button for the push, then keep holding for throttle. Let go to feather it if the wheels spin. The chute comes out after the timed mile."},
  {tab:"events",sel:"#dynoHint,#verdict",title:"Read the run",text:"The result shows your speed through the timed mile and how the run ended. If it topped out on the limiter, gear taller. If it was still climbing at the clocks, try the long course. If it spun, ease the throttle."}]},
 {id:"bog",name:"Mud bog 101",sub:"class, torque, gear, wheelspin",preset:"godzilla73",env:{testType:"bog"},steps:[
  {tab:"events",sel:'#evHead',title:"Through, or stuck",text:"Mud bog is a truck and a pit of mud. If you get through, the stopwatch scores the time. If you stick, the distance you reached is your score. The wheels have to keep turning."},
  {tab:"events",sel:'#envBox [data-bk="bogCls"]',up:1,lbl:1,title:"Pick a class",text:"Street 4×4, Modified or Open. Each is a different truck with its own tyres, drivetrain and weight, and the line under the buttons says what you have."},
  {tab:"build",sel:'[data-k="asp"]',up:1,lbl:1,title:"Torque, not top speed",text:"The pit loads the wheels hard at low speed, so what counts is torque at low revs. Big displacement or boost holds the engine up in its band when the mud grabs the tyres."},
  {tab:"events",sel:'#envBox [data-bk="bogGear"]',up:1,lbl:1,title:"Choose a gear",text:"Under Advanced. A tall gear carries more speed into the mud but bogs sooner in the deep end. A short gear keeps the engine up in its band, and spins the wheels more easily."},
  {tab:"events",sel:'#envBox [data-bk="bogTyre"]',up:1,lbl:1,title:"Tyres",text:"Under Advanced. Lugs bite, then the clay packs into them and they stop biting. Sticky clay grabs a slow tyre and packs it solid, so speed through the pit keeps the lugs clean."},
  {tab:"events",sel:"#runTest",title:"Hold for throttle",text:"Carry speed off the run-up, then keep the wheels turning in the mud. A little wheelspin cleans the lugs, too much digs a hole. Hold the button (or Space) for throttle and let go to feather."},
  {tab:"events",sel:"#dynoHint,#verdict",title:"Read the run",text:"A run that stuck early needs a shorter gear or less wheelspin. A truck that dug a hole needed the throttle feathered. A clean run through is scored on time, so a taller gear is the next thing to try."}]},
 {id:"boat",name:"Boat drags 101",sub:"class, prop pitch, gear, trim",preset:"merc25",env:{testType:"boat"},steps:[
  {tab:"events",sel:'#evHead',title:"1,000 feet of river",text:"Boat drags are heads-up over a thousand feet of water. Wait for the green, then hold for throttle. The engine turns a prop, and a prop slips, so it behaves nothing like a car."},
  {tab:"events",sel:'#envBox [data-tk="boatCls"]',up:1,lbl:1,title:"Pick a class",text:"A stock outboard V-bottom, a jet boat with a pump instead of a prop, a blown Pro Eliminator or a Top Fuel hydro. The class sets the hull, the drive and the limit on the engine."},
  {tab:"events",sel:"#er-boatPitch",wrap:".env",title:"Prop pitch",text:"Under Advanced. Pitch is how far one turn of the prop would push the boat with no slip. More pitch is more top speed and more load, so the engine revs lower and the prop slips more off the line."},
  {tab:"events",sel:"#er-boatGear",wrap:".env",title:"Lower-unit gear",text:"Under Advanced. The gear in the lower unit turns engine revs into prop revs. It works against pitch: between them they decide where the engine sits in its rev range down the course."},
  {tab:"events",sel:"#er-boatTrim",wrap:".env",title:"Trim at the start",text:"Under Advanced. Trim in (negative) to get over the hump, then out once the hull is on the plane. Too far out and the boat porpoises, walks, or blows over."},
  {tab:"events",sel:"#runTest",title:"Wait for the green",text:"Enter the drags, wait for the green, then hold for throttle. If the prop blows out off the line, feather it. Trim in for the hump and out once the boat is planing."},
  {tab:"events",sel:"#dynoHint,#verdict",title:"Read the pass",text:"The result shows your time over the course. A lazy start with a strong finish usually means too much pitch for the launch. A quick start that stops pulling means too little. Change one thing and run again."}]},
 {id:"road",name:"Road test 101",sub:"tyres, circuit, chassis, final drive",preset:"k20a",env:{testType:"road"},steps:[
  {tab:"events",sel:'#evHead',title:"Your engine in a car",text:"The road test puts your engine into the chassis you pick. It measures 0–100, the quarter mile, 80–120 and top speed on a straight, then runs one flying lap of the circuit and plays it back."},
  {tab:"events",sel:'#envBox [data-rk="roadTyre"]',up:1,lbl:1,title:"Tyres",text:"Eco, street, sport and semi-slick. The number is the grip, so more of it means a quicker corner and a better launch. Sport is the stock fitment."},
  {tab:"events",sel:'#envBox [data-rk="roadTrk"]',up:1,lbl:1,title:"Pick a circuit",text:"Coulee Park is short and tight, Prairie Sky Raceway is long with 12 turns, and Grain Exchange is a walled downtown street circuit that rewards torque and brakes. The same car laps differently on each, and each keeps its own best."},
  {tab:"events",sel:'#envBox [data-rk="roadCh"]',up:1,lbl:1,title:"Pick the chassis",text:"Under Advanced, in Chassis. A 1,000 kg roadster, a front-drive hatch, a muscle car, a pickup. The line under it says what the engine adds and how the weight balances front to back."},
  {tab:"events",sel:"#er-suSt",wrap:".su-grid",title:"Setup",text:"Under Advanced, in Suspension. Stiffer at one end and that end loses grip first: a stiff front pushes wide, a stiff rear comes round. A steeper wing adds downforce, and top speed pays for it. The diff, brake bias, tyre pressure and ride height sit below: watch the lap time against stock as you slide them."},
  {tab:"events",sel:"#er-roadFinal",wrap:".env",title:"Final drive",text:"Under Advanced, in Drive & view. A shorter ratio pulls harder out of corners. A taller one runs out the straight. The line under the chassis shows where top gear lands against the power peak."},
  {tab:"events",sel:"#runTest",title:"Roll out",text:"Start the test. The straight-line runs happen first, then the lap. Space skips the lap playback if you only want the numbers."},
  {tab:"events",sel:"#dynoHint,#verdict",title:"Read the lap",text:"The straight-line numbers show whether the engine is strong. The lap shows whether the car can use it. A quick straight with a slow lap points at grip or balance, not power."}]},
 {id:"hill",name:"Cloudsplitter Peak 101",sub:"thin air, class, tyres, final drive",preset:"4g63",env:{testType:"hill"},steps:[
  {tab:"events",sel:'#evHead',title:"Up the mountain",text:"Cloudsplitter Peak is a 19.99 km hill climb with 156 turns. It runs from 2,862 m to 4,302 m, so the air gets steadily thinner as you climb and the engine gets weaker."},
  {tab:"events",sel:"#envBox>p.hint",title:"The power you lose",text:"This line shows what the engine makes at the shop, at the start line and on the summit. An atmospheric engine's power follows the air down. Boost holds more of it."},
  {tab:"events",sel:'#envBox [data-hk="hillCls"]',up:1,lbl:1,title:"Pick a class",text:"Open is a street car on street tyres with no aero. Time Attack adds semi-slicks and a wing. Cloudsplitter Peak Open and Unlimited allow slicks and big aero."},
  {tab:"events",sel:'#envBox [data-hk="hillTyre"]',up:1,lbl:1,title:"Tyres",text:"The tyres on offer depend on the class. Grip decides how hard you can push through the 156 turns. In You drive, dusty corners want a LIFT."},
  {tab:"events",sel:'#envBox [data-hk="hillCh"]',up:1,lbl:1,title:"Pick the car",text:"Under Advanced, in Car. A 1,000 kg roadster up to a 2,100 kg pickup, with rear, front or all-wheel drive. The line at the top of Setup updates with its weight and gearing."},
  {tab:"events",sel:"#er-hillFinal",wrap:".env",title:"Final drive",text:"Under Advanced, in Drive & view. A shorter ratio pulls harder out of the many slow corners. A taller one runs out of revs on the fast sections. The line at the top of Setup shows the speed it is geared for."},
  {tab:"events",sel:"#runTest",title:"To the line",text:"Start the climb. Auto reads the corner calls for you. In You drive, hold PUSH into grippy corners and LIFT into dusty ones. Too fast is a moment, or a trip through the gravel."},
  {tab:"events",sel:"#dynoHint,#verdict",title:"Read the climb",text:"The result shows your time for the climb. If the engine is weak up high, boost or a shorter gear helps. If you lose time in the corners, look at the tyres, the car and the suspension."}]},
 {id:"oval",name:"Dirt oval 101",sub:"class, one gear, tyres, grille",preset:"sbc350",env:{testType:"oval"},steps:[
  {tab:"events",sel:'#evHead',title:"Heat race, then feature",text:"The oval is a heat race and then the feature, on the clay 3/8 mile or the paved half-mile (pick the track first). Clay starts tacky and dries out slick as the laps pile up; pavement grips steadily and rewards gearing, top end and cooling. The rivals' lap times come from the same sim you drive."},
  {tab:"events",sel:'#envBox [data-ok="ovalCls"]',up:1,lbl:1,title:"Class by cubic inches",text:"Street Stock takes up to 360 ci, Late Model up to 430, and Open has no limit. Your engine's size decides which class it can enter."},
  {tab:"events",sel:"#er-ovalFinal",wrap:".env",title:"One gear",text:"Under Advanced, in Rear end. The car has no gearbox to speak of: engine speed is road speed times the rear end. The corner exit wants torque, not peak power. A taller ratio trades exit for the straight."},
  {tab:"events",sel:'#envBox [data-ok="ovalTyre"]',up:1,lbl:1,title:"Tyres and the track",text:"Soft tyres bite early and fade late. Hard ones last and bite less. The track dries out (or greases up) as the laps pile up, so match the tyre to how long the race is."},
  {tab:"events",sel:'#envBox [data-ok="ovalGrille"]',up:1,lbl:1,title:"Grille",text:"Under Advanced. An open grille cools best but adds drag and clogs with dirt. Taping it up is slippery on the straight, and the engine runs hot."},
  {tab:"events",sel:"#runTest",title:"Take the green",text:"Hold PUSH to attack and SAVE to cool the engine and the tyres. Space pushes. If the heat is already safe, save the engine for the feature."},
  {tab:"events",sel:"#dynoHint,#verdict",title:"Read the night",text:"The heat sets the feature grid, so a good heat gets you a good start. Watch the lap times fall off as the tyres fade and the track changes. That is when to SAVE."}]},
 {id:"race24",name:"24 Hours 101",sub:"circuit, engine mode, stints, tyres",preset:"gt3r",env:{testType:"race24",e24Drive:"you"},steps:[
  {tab:"events",sel:'#evHead',title:"A day and a night",text:"The 24 Hours puts your engine in the road-test car against twenty others in three classes. A full day and night runs in accelerated time. Pace matters, and so does making it to the end."},
  {tab:"events",sel:'#envBox [data-e24k="e24Trk"]',up:1,lbl:1,title:"Pick a circuit",text:"Coulee Park is a short-course 24. Prairie Sky Raceway is the 24 Hours itself, on a 4.48 km lap."},
  {tab:"events",sel:'#envBox [data-e24k="e24Mode"]',up:1,lbl:1,title:"Engine mode",text:"Push uses everything the engine has. Race short-shifts at 96% torque. Conserve cruises lean at 92%. Over a whole day, the gentler modes are how an engine lasts."},
  {tab:"events",sel:'#envBox [data-e24k="e24Stint"]',up:1,lbl:1,title:"Stint length",text:"How long a driver stays out between stops: to the fuel, 45, 60 or 90 minutes. Short stints are light, but every stop costs time in the pits."},
  {tab:"events",sel:'#envBox [data-e24k="e24Tyre"]',up:1,lbl:1,title:"Tyres",text:"Soft is 3.5% quicker and lasts 170 km. Medium is the base and lasts 270. Hard is 3.5% slower and lasts 420. The longer the stint, the more a hard tyre is worth."},
  {tab:"events",sel:'#envBox [data-e24k="e24Fuel"]',up:1,lbl:1,title:"Fuel at the stops",text:"Under Advanced. A full tank is 100 L and goes further. Just enough for the stint is lighter, so the car is quicker."},
  {tab:"events",sel:'#envBox [data-e24k="e24Chg"]',up:1,lbl:1,title:"Tyre changes",text:"Under Advanced. Fresh rubber at every stop, or a double stint that skips the change at every other stop and saves 22 seconds. It pays only if the tyre can last."},
  {tab:"events",sel:'#envBox [data-e24k="e24Drive"]',up:1,title:"The pit wall",text:"You call it, or hand the strategy to the crew chief. The chief picks the tyres, conserves behind the safety car and when nobody is close, and pushes only when the engine is safe. Tap any choice during the race to take over."},
  {tab:"events",sel:"#runTest",title:"Take the green",text:"Set the strategy, then start. Watch it at 1× or time-lapse to the next event."},
  {tab:"events",sel:"#dynoHint,#verdict",title:"Read the result",text:"The result ranks the car among the twenty. If it lost places in the night, look at the engine mode and the tyres. If the engine failed, back off the mode."}]},
 {id:"racenight",name:"Race night 101",sub:"heads-up ladder, the tree, launch, tyres",preset:"ls3",env:{testType:"drag",dragFmt:"elim"},steps:[
  {tab:"events",sel:'#evHead',title:"Heads-up is the quick car",text:"A race night on the strip. Heads-up eliminations is the simplest form of drag racing: both cars leave on the same green, and the first one to the stripe wins. No dial-in, no breakout. Quick helps, but a slow light throws it away."},
  {tab:"events",sel:'#envBox [data-ek="dragFmt"]',up:1,lbl:1,title:"Eliminations",text:"Two qualifying passes seed an eight-car ladder: quarter-final, semi, final. The rivals come from your own body class. One of them is the car to beat, and the rest are spread either side of what you run, so the ladder is only as hard as your qualifying number."},
  {tab:"events",sel:'#envBox [data-ek="tyre"]',up:1,lbl:1,title:"Grip first",text:"Street radial, drag radial or slick. A heads-up round is won in the first sixty feet: a tyre that spins on the launch gives the lane next to you a car length you will not get back."},
  {tab:"events",sel:"#er-launchRpm",wrap:".env",title:"Launch rpm",text:"Where the clutch lets go. Too high and the tyres spin, too low and the engine bogs off the line. Find the highest rpm the tyre will take and leave there every round."},
  {tab:"build",sel:'[data-k="launchCtl"]',up:1,lbl:1,title:"Two-step and transbrake",text:"In the Build tab, under Launch control. A two-step holds the engine at a set rpm on the line so every launch is the same, and a transbrake loads the driveline against the brake. With either fitted, the launch rpm comes from the two-step setting, which you can tune here or in the drag setup."},
  {tab:"events",sel:'#envBox [data-ek="dragDrive"]',up:2,title:"The tree",text:"Auto stages and leaves on the green with a good, human reaction time, every pass of the night. Drive it yourself and you tap on the green of your own tree. Leave before it and the light is red: an automatic loss, however quick the car is."},
  {tab:"events",sel:"#runTest",title:"Enter the night",text:"Tap to enter. Qualify, then take each round as it comes. A car in the other lane can break on the line or go red, and so can you. Entry is free in the sandbox; a career night costs an entry fee and pays out by the round."},
  {tab:"events",sel:"#dynoHint,#verdict",title:"Read the ladder",text:"The slip shows your reaction time and ET against the rival's, and who went through. Lost on a holeshot: your light was slow, so work on the launch. Lost on ET: the car is slow, so it is back to the Build tab. Wins pay cash and rep, and the brands notice race nights."}]},
 {id:"analysis",name:"Analysis 101",sub:"stress report, telemetry, combos, notes, records",preset:"k20a",env:{testType:"pull"},steps:[
  {tab:"test",sel:"#rlRun",title:"Pull first",text:"Everything in Analysis reads from the last dyno pull, so arm the dyno and pull. Below the curve, the Stress report lists every check the engine passed or failed: compressor flow, fuel delivery, detonation margin, crown strength, bearing load. Tap a line for the physics behind it."},
  {tab:"analysis",sel:"#combos",up:1,title:"Material and combo interactions",text:"Parts do not act alone. A forged piston with loose clearance, an aluminium head on an iron block, a long rod on a short stroke: each pairing has a note here on what it gains and what it costs. The count on the heading is how many are active in this build."},
  {tab:"analysis",sel:"#teleFold",title:"Telemetry",text:"The last pull, line by line: the power band, peak cylinder pressure, piston crown temperature, peak exhaust temperature, crankcase and air box pressure, seizure margin, idle, dry weight and unit cost. When a stress check fails, this is where you see by how much."},
  {tab:"analysis",sel:"#notes",up:1,title:"Engineer's notes",text:"Plain-language advice from the shop's engineer on this build: what is holding the power back, what will break first, and what one change would do the most. Read these before buying parts."},
  {tab:"analysis",sel:"#recBox",up:1,title:"Records",text:"Your best dyno numbers and your best runs at every event, kept per class. The trophy room button opens the full list. A new record here is also what the brands and the local paper notice."},
  {tab:"analysis",sel:"#achFold",title:"Achievements",text:"Milestones across building, racing, team seasons and the career, grouped by area. Each one says what it wants. The ones for the salt, the oval and the road course are the hardest to reach."}]},
 {id:"swap",name:"Engine swap 101",sub:"pick a car, the fit report, fixes, where it runs",preset:"coyote",env:{testType:"road",swapV:"miata"},steps:[
  {tab:"build",sel:"#swapAcc",title:"Put the engine in a car",text:"The Swap section fits your engine into a car of your choosing instead of the event's stock car. A five-litre V8 in a Miata is the classic swap, and this lesson starts there."},
  {tab:"build",sel:"#swapBody",title:"Groups and cars",text:"Cars come in groups: muscle, compact and light, trucks, heavy iron and the oddballs. In the sandbox every car is yours; in the career you buy one, and the car comes with you from engine to engine."},
  {tab:"build",sel:"#swapBody",title:"The fit report",text:"Length, width, height, mass, radiator and driveline rating of the car against the engine. A red line is a problem: too long for the bay, too heavy on the nose, a driveline that will not take the torque. Each one lists the fix and what it costs, from a tunnel notch to a stronger axle. A swap that does not fit still runs, but badly."},
  {tab:"build",sel:"#swapBody",title:"What the swap predicts",text:"Below the report: 0 to 100, the quarter mile, top speed and power to weight for this engine in this car, from the same physics as the events. Compare it with the stock event car before you commit money to fixes."},
  {tab:"events",sel:'#evHead',title:"Where it runs",text:"A swapped car runs the strip and race nights, the salt, the road course, the hill and the 24 Hours. The sled pull and the bog keep their class trucks, and boats stay boats. Pick the road course and run it to see the swap in a result."},
  {tab:"events",sel:"#runTest",title:"Run it",text:"The result is the swapped car's, and the verdict says if the driveline survived. A broken driveline is the fix report telling you what it already told you."}]},
 {id:"boost",name:"Turbos and blowers 101",sub:"aspiration, sizing, boost, cooling, fuel",preset:"2jzgte",env:{testType:"pull"},steps:[
  {tab:"build",sel:'[data-k="asp"]',up:1,lbl:1,title:"Ways to force air in",text:"A single turbo, twin turbos, a Roots blower, a centrifugal, a twin-screw, or a turbo and blower compounded. Turbos run on exhaust energy and spool late; blowers are belt-driven, instant and cost power to turn. This 2JZ runs a pair of parallel turbos."},
  {tab:"build",sel:'[data-k="turboSize"]',up:1,lbl:1,title:"Sizing",text:"A small turbo spools early and runs out of flow up top; a large one makes the big number and does nothing below 4,000 rpm. The stress report's Compressor flow line tells you when the turbo has run out of map."},
  {tab:"build",sel:"#r-boost",up:1,lbl:1,title:"Boost",text:"Pressure above atmospheric, in bar. More boost is more air, more power and more heat and cylinder pressure, all at once. Every half bar wants more fuel, a stronger bottom end and a colder charge."},
  {tab:"build",sel:'[data-k="ic"]',up:1,lbl:1,title:"Cool the charge",text:"Compressed air is hot air. An air-to-air core, a water-to-air core, an ice tank for the strip, a race water-to-air, water-methanol injection, or staged water that also cools the exhaust. A colder charge is denser and further from detonation, so the intercooler decides how much boost the fuel can stand."},
  {tab:"build",sel:'[data-info="fuel"]',up:1,title:"Fuel and octane",text:"Boost raises cylinder pressure, and pressure is what makes the charge knock. Pump fuel runs out of octane around a bar; E85, race fuel and methanol take more boost before they detonate. The Detonation margin line in the stress report is the number to watch."},
  {tab:"build",sel:"#r-lambda",up:1,lbl:1,title:"Mixture under boost",text:"Boosted engines run rich at full load, around 0.80 to 0.85 lambda, because the extra fuel cools the chamber. Lean it out for power and the detonation margin goes first, then the pistons."},
  {tab:"build",sel:'[data-k="injectors"]',up:1,lbl:1,title:"Feed it",text:"Injectors and the pump have to supply the fuel the boost demands. Past about 90% injector duty the engine leans out at the top of the pull, which is where it is hottest. The Fuel delivery line in the stress report says how much is in hand."},
  {tab:"test",sel:"#rlRun",title:"Pull and read the stress report",text:"Arm the dyno and pull. Then read Compressor flow, Fuel delivery and Detonation margin together: a boosted engine is limited by whichever of the three runs out first."}]},
 {id:"rotary",name:"Rotaries 101",sub:"rotor, eccentricity, ports, seals, housings",preset:"13b_fc",env:{testType:"pull"},steps:[
  {tab:"build",sel:".strip",title:"No pistons",text:"This is a 13B, a two-rotor Wankel. A triangular rotor turns inside a figure-eight housing and each face does intake, compression, power and exhaust in turn. Three power pulses per rotor turn, no valves, and it revs like nothing with pistons."},
  {tab:"build",sel:"#r-bore",up:1,lbl:1,title:"Rotor width",text:"Where a piston engine has bore and stroke, a rotary has rotor width B and generating radius R. Width is the depth of the housing: wider rotors are more displacement per face and heavier."},
  {tab:"build",sel:"#r-ecc",up:1,lbl:1,title:"Eccentricity",text:"How far the rotor centre is offset from the shaft. Together with the radius it sets the chamber volume and the shape of the housing. More eccentricity is more displacement and more seal load at the apex."},
  {tab:"build",sel:'[data-k="rotPort"]',up:1,lbl:1,title:"Porting",text:"Side ports idle and make torque; street and bridge ports open earlier and flow more; a peripheral port is a race engine that barely idles. Porting is the rotary's camshaft."},
  {tab:"build",sel:'[data-k="apexSeal"]',up:1,lbl:1,title:"Apex seals",text:"The three seals at the rotor tips are the rotary's weak point. Stock three-piece, two-piece, ceramic or billet: harder seals take boost and rpm and cost more, and a broken one takes the housing with it."},
  {tab:"build",sel:'[data-k="rotHousing"]',up:1,lbl:1,title:"Housing surface",text:"The seals run on the housing's inner surface. Chrome is stock, nikasil is tougher and ceramic is tougher again. Match the housing to the seals and the rpm you plan to use."},
  {tab:"build",sel:'[data-k="oilMeter"]',up:1,lbl:1,title:"Oil for the seals",text:"The apex seals need oil in the chamber. The stock metering pump, an electronic pump, premix in the fuel, or the pump plus premix. More oil is more seal life and more smoke."},
  {tab:"build",sel:"#r-redline",up:1,lbl:1,title:"Redline",text:"No valves to float, so a rotary's limit is seal speed and housing heat. The port timing decides where the power lives; set the redline a little past it."},
  {tab:"test",sel:"#rlRun",title:"Pull it",text:"Arm the dyno and pull. The curve is flat and the number is low for the displacement, which is normal: a rotary makes its power with rpm. Check the seal and housing lines in the stress report."}]},
 {id:"twostroke",name:"Two-strokes 101",sub:"scavenging, ports, power valve, the pipe",preset:"ktm250sx",env:{testType:"pull"},steps:[
  {tab:"build",sel:'[data-k="cycle"]',up:1,lbl:1,title:"Every revolution fires",text:"This is a 250 cc motocross single. A two-stroke fires every turn of the crank, with no valves: the piston uncovers ports in the cylinder wall, and the crankcase pumps the next charge in. Twice the firing of a four-stroke from the same displacement, if the ports and the pipe agree."},
  {tab:"build",sel:'[data-k="scav"]',up:1,lbl:1,title:"Scavenging",text:"How the fresh charge pushes the spent one out. Loop scavenging is the modern norm; cross scavenging is old and simple; uniflow is a diesel's trick with exhaust valves in the head."},
  {tab:"build",sel:"#r-ePort",up:1,lbl:1,title:"Exhaust port",text:"The exhaust port timing in degrees of crank. A higher port opens earlier and flows more up top, and loses the bottom. This is the two-stroke's cam."},
  {tab:"build",sel:"#r-tPort",up:1,lbl:1,title:"Transfer ports",text:"The transfers bring the charge up from the crankcase. They open after the exhaust and must close before it, so the two timings work together: transfers too close to the exhaust and the fresh charge goes straight out the pipe."},
  {tab:"build",sel:'[data-k="pv"]',up:1,lbl:1,title:"Power valve",text:"A valve that lowers the exhaust port at low rpm and raises it at high rpm, so the engine has both a bottom end and a top. Without it, you choose one."},
  {tab:"build",sel:'[data-k="induct"]',up:1,lbl:1,title:"Induction",text:"Piston-port is the simplest; reeds stop the charge blowing back out of the carburettor; a disc valve times the intake exactly; a blower feeds a big uniflow diesel."},
  {tab:"build",sel:'[data-k="xpipe"]',up:1,lbl:1,title:"The expansion chamber",text:"A two-stroke's exhaust is part of the engine. The pipe's diverging cone pulls the charge out, and the reflected wave from the converging cone stuffs the escaping charge back in before the port closes. A straight pipe or a muffler gives that up."},
  {tab:"build",sel:"#r-pipeRpm",up:1,lbl:1,title:"Tune the pipe",text:"The rpm where the pipe's return wave lands on time. Above and below it the pipe works against you, which is why a two-stroke comes on the pipe so suddenly. Tune it near the exhaust port's power peak."},
  {tab:"build",sel:'[data-k="lube"]',up:1,lbl:1,title:"Oil",text:"No sump: the crankcase is the pump. Premix oil in the fuel at a ratio, or an injection pump that meters it. Lean premix wears the bearings; rich premix smokes and fouls plugs."},
  {tab:"build",sel:"#r-cr",up:1,lbl:1,title:"Trapped compression",text:"Compression only starts once the exhaust port closes, so the trapped ratio is what the engine sees. It is lower than a four-stroke's number for the same chamber."},
  {tab:"test",sel:"#rlRun",title:"Pull it",text:"Arm the dyno and pull. Look for the step in the curve where the pipe comes in and how narrow the band above it is. Lowering the exhaust port or retuning the pipe widens it at the cost of the peak."}]}
];
let LS=null;
const LS_WALK=["#modeBox button","#replayTour","#resetGame","#foreclose [data-restart]","#slots button","#importSave","#exportSave","#bkFileSave","#bkFileLoad"].join(",");
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
  if(st.tab==="events"&&trackEvt(S.env.testType))evhubSet(evCur());   // a lesson step on an event page goes inside that event
  if(curTab!==st.tab)showTab(st.tab);
  accReveal(document.querySelector(st.sel));anaReveal(document.querySelector(st.sel));if(st.sel.startsWith("#swap")&&typeof swapRender==="function")swapRender();   // the swap body only fills on its own header click
  const last=i===L.steps.length-1;
  $("lesStep").textContent=`${L.name} · ${i+1} of ${L.steps.length}`;$("lesTitle").textContent=st.title;$("lesText").textContent=st.text;
  $("lesSkip").style.display=last?"none":"";$("lesKeep").style.display=last?"":"none";$("lesNext").textContent=last?"Back to my engine":"Next";
  glScan($("lesText"));
  const t2=lsEl(st)||document.querySelector(st.sel);if(t2&&$("panel").contains(t2)&&st.sel.charAt(0)!=="."){setTimeout(()=>{if(!LS||LS.i!==i)return;const pr=$("panel").getBoundingClientRect(),tr=(lsRect(st)||t2.getBoundingClientRect());$("panel").scrollTop+=(tr.top-pr.top)-pr.height*0.32;lsPlace();setTimeout(lsPlace,380);setTimeout(lsPlace,700);},60);}
  requestAnimationFrame(()=>requestAnimationFrame(lsPlace));}
function lsAsk(id){const L=LESSONS.find(x=>x.id===id);if(!L||LS)return;const car=career();
  $("sheetTitle").textContent=L.name;
  $("sheetBody").innerHTML=`<p class="hint" style="margin-top:0">${L.name} runs in the test cell on a scratch engine${car?", so you will switch out of Career for a few minutes. Your shop, cash and team are not touched":""}. Your current build is saved first and put back when you finish or skip${car?" and you return to Career":""}. You can also keep the lesson's engine at the end.</p><div class="row" style="margin-top:12px"><button class="btn sm ghost" id="lesCancel" style="flex:1">Not now</button><button class="btn pri" id="lesGo" style="flex:2">Start ${L.name}</button></div>`;
  $("sheet").classList.add("on");$("scrim").classList.add("on");
  $("lesCancel").addEventListener("click",closeSheet);$("lesGo").addEventListener("click",()=>{closeSheet();lsStart(id);});}
function lsMenu(){$("sheetTitle").textContent="Lessons";
  $("sheetBody").innerHTML=`<p class="hint" style="margin-top:0">Short guided tours of the real controls. Each runs on a scratch engine and puts your own build back when it ends. Skip any time.</p>`+LESSONS.map(L=>`<div class="opt les"><div class="lsx"><div class="oh"><b>${L.name}</b><span class="tag">${L.steps.length} steps</span></div><p>${L.sub}</p></div><button class="btn sm pri" data-les="${L.id}">${S.lessonsDone&&S.lessonsDone[L.id]?"Replay":"Start"}</button></div>`).join("");
  $("sheet").classList.add("on");$("scrim").classList.add("on");}
function lsStart(id){if(LS||(typeof ff!=="undefined"&&ff))return;if(testing){toast("Let the dyno finish first");return;}
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
$("sheetBody").addEventListener("click",e=>{const b=e.target.closest("[data-les]");if(b)lsAsk(b.dataset.les);});
[$("panel"),$("setPane")].forEach(el=>el.addEventListener("click",e=>{if(!LS)return;const b=e.target.closest(LS_WALK);if(!b)return;if(testing){e.stopPropagation();toast("Let the dyno finish first");return;}lsEnd(false);},true));
document.addEventListener("visibilitychange",()=>{if(document.hidden)lsSafeSave();});window.addEventListener("pagehide",lsSafeSave);
window.addEventListener("resize",()=>{if(LS)lsPlace();});$("panel").addEventListener("scroll",()=>{if(LS)lsPlace();},{passive:true});
;window.__pewLate=1;
//# sourceURL=app-late.js
