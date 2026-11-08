/* ---- drag announcer: Ed, the voice of the strip ----
   143 voice lines generated with ElevenLabs (voice "Ed, the Late Night Announcer"; credits in sounds/CREDITS.md), mono MP3 in
   sounds/announcer/: 73 race calls (night opens, rounds, staging, the light, wheelspin, red light, win and loss by margin,
   breakage, break-out, centreline, black flag, PB, qualifying and how the night ended) and 70 matchup parts that are stitched
   into "Here's your matchup! twin turbo two point oh litre inline four, versus Roots blown eight point two litre Hemi methanol V8".
   Nothing loads until a drag pass starts with sound and the announcer on; then only the lines picked for that pass are fetched
   (the service worker caches the files) and decoded, and a small cache keeps the last few dozen decoded clips.
   Ed plays through the engine's audio context straight to the speakers, past the engine EQ, with the engine ducked while he talks.
   Settings › Sound › Drag announcer: On / Off (S.ann; on unless set false). Hooks: annPass / annStaged / annLight / annSpin /
   annResult / annNight, called from src/app/drag.js. */
const ANN_POOLS={openHeads:[1,2,3,48],openBr:[4,5,48],q1:[6,49],q2:[7,50],tt:[8],qf:[9,51],sf:[10,52],fin:[11,53],
  stage:[12,13,14,54,55,56],ttStage:[15],rtGreat:[16,17],rtPerfect:[57],rtLate:[18,58],spin:[59],red:[19,20,21,60],
  win:[22,23,61,62,63],winClose:[24,25],winBig:[26],loss:[27,29,30,64,65],lossClose:[28],oppBroke:[31],broke:[32,33,66],driveline:[34,67],
  breakout:[35,36],line:[37],black:[38],pb:[39,40,68,69],ttClean:[41],qual:[42,70],dnq:[43],nightWon:[44,45,71],night2nd:[46,72],nightOut:[47,73]};
/* matchup parts: PEW-CALL-00NN */
const ANN_CALL=(()=>{const m={},put=(keys,from)=>keys.forEach((k,i)=>{m[k]=from+i;});
  put(["i1","i2","i3","i4","vs1","vs2","vs3","o1","o2","o3","o4"],1);
  put(["na","turbo","twin_turbo","roots","centrifugal","screw","compound"],12);
  put(["diesel","b100","methanol","e85","lpg","cng","hemi","2t","n2o"],19);
  put(["I1","I2","I3","I4","I5","I6","V4","V6","V8","V8F","V10","V12","F4","F6","R1","R2","R3","R4","D18"],28);
  for(let i=1;i<=14;i++)m["n"+i]=46+i;for(let i=0;i<=9;i++)m["p"+i]=61+i;return m;})();
/* the other lane's engine for the call: "litres layout aspiration [fuel] [hemi] [n2o]" per rival car (race nights) and per
   test & tune name. Flavour for Ed only: the sim's rival model does not read it. */
const ANN_RIVAL=(()=>{const t={
  "'69 Camaro":"5.7 V8 na","Fox-body Mustang":"5.0 V8 na","'72 Nova":"5.7 V8 na","Civic hatch":"1.6 I4 turbo","'87 Grand National":"3.8 V6 turbo","'71 Duster":"5.6 V8 na",
  "'99 Trans Am":"5.7 V8 na","Duramax crew cab":"6.6 V8 turbo diesel","'66 Chevelle":"6.5 V8 na","Supra Mk IV":"3.0 I6 twin_turbo","'70 Challenger":"7.0 V8 na hemi","'86 Monte Carlo SS":"5.0 V8 na",
  "Outlaw Camaro":"7.0 V8 twin_turbo","Big-tyre Fox":"5.4 V8 centrifugal","Radial Regal":"4.1 V6 turbo e85","Outlaw Cummins":"5.9 I6 compound diesel","'68 Dart":"7.0 V8 roots hemi","Turbo Mustang":"5.0 V8 turbo",
  "Outlaw Corvette":"7.0 V8 screw","'70 Chevelle":"7.4 V8 na n2o","Radial Supra":"3.4 I6 turbo e85","Outlaw Firebird":"6.2 V8 centrifugal","'63 Falcon":"5.8 V8 turbo","Nitrous Duster":"6.6 V8 na n2o",
  "Pro-mod '68 Camaro":"8.2 V8 screw methanol","Pro-mod Corvette":"8.8 V8 twin_turbo methanol","Pro-mod '41 Willys":"8.2 V8 roots methanol hemi","Pro-mod Mustang":"8.2 V8 twin_turbo methanol","Pro-mod GTO":"9.4 V8 na n2o",
  "Pro-mod Camaro":"8.8 V8 na n2o","Pro-mod '53 Corvette":"8.2 V8 screw methanol hemi","Pro-mod Firebird":"8.0 V8 twin_turbo methanol","Pro-mod Dart":"8.2 V8 roots methanol hemi","Pro-mod Cuda":"8.8 V8 na hemi n2o",
  "Front-engine dragster":"8.2 V8 roots methanol hemi","Rear-engine rail":"8.2 V8 roots methanol hemi","Top dragster":"9.4 V8 na n2o","Alcohol dragster":"8.2 V8 roots methanol hemi","Junior-built rail":"5.7 V8 na e85",
  "Swingarm rail":"1.3 I4 turbo methanol","Long-wheelbase rail":"8.0 V8 screw methanol","Nostalgia digger":"6.4 V8 roots methanol hemi","Top sportsman rail":"9.8 V8 na n2o","Turbo rail":"6.0 V8 twin_turbo methanol",
  "'55 Chevy gasser":"6.4 V8 roots methanol","'41 Willys gasser":"7.0 V8 roots methanol hemi","'33 Willys gasser":"6.4 V8 roots methanol hemi","'56 Chevy gasser":"5.4 V8 roots","'57 Bel Air gasser":"5.7 V8 roots",
  "Anglia gasser":"5.4 V8 roots methanol hemi","Austin gasser":"6.4 V8 roots","'40 Willys pickup gasser":"7.0 V8 roots hemi","'55 Chevy 210 gasser":"5.7 V8 na","'37 Chevy gasser":"4.3 I6 roots",
  "Northwind":"2.0 I4 twin_turbo","Halcyon GT":"3.0 I6 na","Coulee":"6.7 I6 compound diesel","Prairie Fire":"6.2 V8 roots hemi"};
  for(const c of ["Nitro Mustang funny car","Nitro Camaro funny car","Nitro Charger funny car","Nitro Challenger funny car"])t[c]="8.2 V8 roots hemi";
  for(const c of ["Alcohol Mustang funny car","Alcohol Camaro funny car","Alcohol Monza funny car"])t[c]="8.2 V8 roots methanol hemi";
  for(const c of ["Nostalgia Charger funny car","Nostalgia Vega funny car","Nostalgia 'Cuda funny car"])t[c]="7.0 V8 roots methanol hemi";
  for(const c of RN_CARS.prostock)t[c]="8.2 V8 na";
  return t;})();
const ANN={last:{},next:{},bytes:{},bufs:new Map(),busy:false,q:[],src:null,said:{},stat:{fetched:0,errors:0}};
function annFile(id){return typeof id==="number"?"sounds/announcer/pew_announcer_pew-ann-"+String(id).padStart(4,"0")+".mp3":"sounds/announcer/pew_announcer_pew-call-"+String(ANN_CALL[id]).padStart(4,"0")+".mp3";}
function annCtx(){if(typeof soundReady==="undefined"||!soundReady||!S||!S.sound||S.ann===false||typeof ENGINE_SOUND==="undefined"||!ENGINE_SOUND.sampleHost)return null;const h=ENGINE_SOUND.sampleHost();return h&&h.ctx||null;}
/* fetch (kept compressed, ~20 kB a line) and decode (kept in a small cache: decoded audio is ~10x the file) */
function annLoad(id){const f=annFile(id),ctx=annCtx();if(!ctx)return Promise.resolve(null);
  if(ANN.bufs.has(f)){const b=ANN.bufs.get(f);ANN.bufs.delete(f);ANN.bufs.set(f,b);return Promise.resolve(b);}
  const got=ANN.bytes[f]||(ANN.bytes[f]=fetch(f).then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.arrayBuffer();}).then(ab=>{ANN.stat.fetched++;return ab;}));
  return got.then(ab=>new Promise((res,rej)=>{const p=ctx.decodeAudioData(ab.slice(0),res,rej);if(p&&p.catch)p.catch(rej);})).then(b=>{ANN.bufs.set(f,b);
    while(ANN.bufs.size>28)ANN.bufs.delete(ANN.bufs.keys().next().value);return b;}).catch(e=>{delete ANN.bytes[f];ANN.stat.errors++;if(console.debug)console.debug("[announcer] line unavailable:",f,e&&e.message);return null;});}
/* pick a line from a pool, never the one it said last time, and have it decoded ahead of the moment it's needed */
function annPick(pool){const a=ANN_POOLS[pool];if(!a)return null;const c=a.length>1?a.filter(x=>x!==ANN.last[pool]):a;return c[Math.floor(Math.random()*c.length)];}
function annPrep(pools){if(!annCtx())return;pools.forEach(p=>{if(ANN.next[p]==null)ANN.next[p]=annPick(p);annLoad(ANN.next[p]);});}
function annTake(pool){const id=ANN.next[pool]!=null?ANN.next[pool]:annPick(pool);ANN.last[pool]=id;ANN.next[pool]=null;return id;}
/* a phrase is a list of clip ids (with "|" for a breath between sections); urgent cuts off what's playing, otherwise a phrase
   that can't start within `wait` seconds is dropped, so Ed never runs late on the action */
function annSay(ids,o){o=o||{};const ctx=annCtx();if(!ctx||!ids||!ids.length)return;const at=performance.now();
  Promise.all(ids.map(i=>i==="|"?Promise.resolve("|"):annLoad(i))).then(bs=>{
    if(!annCtx())return;const late=(performance.now()-at)/1000;if(late>(o.load||2.5))return;
    const job={bs:bs.filter(b=>b),t:performance.now(),wait:o.wait!=null?o.wait:1.2};if(!job.bs.some(b=>b!=="|"))return;
    if(o.urgent){ANN.q.length=0;annStop();}else if(o.drop&&ANN.busy)return;
    ANN.q.push(job);if(!ANN.busy)annNext();});}
function annStop(){if(ANN.src){try{ANN.src.forEach(s=>{s.onended=null;s.stop();});}catch(e){}ANN.src=null;}ANN.busy=false;annDuck(false);}
function annDuck(on){if(typeof ENGINE_SOUND==="undefined"||!soundReady||!S.sound)return;try{ENGINE_SOUND.setVolume(S.vol/100*(on?0.45:1));}catch(e){}}
function annNext(){const ctx=annCtx();let job=ANN.q.shift();while(job&&(performance.now()-job.t)/1000>job.wait)job=ANN.q.shift();
  if(!job||!ctx){ANN.busy=false;annDuck(false);return;}
  ANN.busy=true;annDuck(true);const g=ctx.createGain();g.gain.value=Math.min(1.5,1.15*S.vol/100+0.1);g.connect(ctx.destination);
  let t=ctx.currentTime+0.05,srcs=[];
  job.bs.forEach(b=>{if(b==="|"){t+=0.22;return;}const s=ctx.createBufferSource();s.buffer=b;s.connect(g);s.start(t);t+=b.duration+0.04;srcs.push(s);});
  ANN.src=srcs;const end=srcs[srcs.length-1];end.onended=()=>{if(ANN.src!==srcs)return;ANN.src=null;setTimeout(annNext,120);};}
/* how Ed says an engine: [aspiration] [litres] [Hemi | two-stroke] [fuel] [layout] [on nitrous] */
const ANN_FUEL={diesel:1,b100:1,methanol:1,e85:1,lpg:1,cng:1};
function annLitres(L){const out=[];if(!(L>0)||L>=14.95)return out;const w=Math.floor(L+0.05),p=Math.round((L-w)*10);
  if(w>=1){out.push("n"+w);out.push("p"+Math.max(0,Math.min(9,p)));}else out.push("p"+Math.max(1,Math.min(9,p)));return out;}
function annEngine(e){if(!e)return[];const out=[];if(ANN_CALL[e.asp])out.push(e.asp);out.push(...annLitres(e.L));
  if(e.ts)out.push("2t");else if(e.hemi)out.push("hemi");if(ANN_FUEL[e.fuel])out.push(e.fuel);if(ANN_CALL[e.lay])out.push(e.lay);if(e.n2o)out.push("n2o");return out;}
function annMine(){const c=S.cfg;return{L:quick&&quick.Vd?quick.Vd/1000:0,lay:c.layout,asp:c.asp,fuel:c.fuel,hemi:c.head==="billet_hemi",ts:isTs(c),n2o:!!(c.nitrous&&c.nitrous!=="none")};}
function annRival(name){const s=ANN_RIVAL[name];if(!s)return null;const w=s.split(" "),f=w.slice(3);
  return{L:+w[0],lay:w[1],asp:w[2],fuel:f.find(x=>ANN_FUEL[x]),hemi:f.includes("hemi"),n2o:f.includes("n2o")};}
/* dragStart: who's calling what. A race night's first pass opens the night; every round gets its line; any pass with a car in the
   other lane gets the matchup. Solo passes stay quiet until something happens. */
function annPass(){ANN.said={};if(!annCtx()||!DR)return;const R=DR.race,n=DR.night,N=n&&rnLive();
  annPrep(R?["stage","rtGreat","rtPerfect","rtLate","red","spin","win","winClose","loss","broke"]:["ttStage","spin","broke","pb","ttClean"]);
  const say=[];
  if(N){const br=N.fmt==="bracket",s=n.stage;
    if(s===0||(N.quick&&s===2&&!(N.passes||[]).length))say.push(annTake(br?"openBr":"openHeads"),"|");
    say.push(annTake(s<2?(br?"tt":s===0?"q1":"q2"):s===2?"qf":s===3?"sf":"fin"),"|");}
  if(R){const rv=N?N.field[n.opp-1]:null,them=rv?annRival(rv.car):R.name==="Lane 2"?annMine():annRival(R.name),me=annMine();
    const pick=a=>a[Math.floor(Math.random()*a.length)];
    if(them&&me.L)say.push(N&&n.stage===4?"i4":pick(["i1","i2","i3"]),...annEngine(me),pick(["vs1","vs2","vs3"]),...annEngine(them),"|",pick(["o1","o2","o3","o4"]));}
  if(say.length)annSay(say,{wait:6,load:5});}
/* both cars in the beams (or yours, on a solo pass) */
function annStaged(){if(ANN.said.stage||!annCtx())return;ANN.said.stage=1;annSay([annTake(DR.race?"stage":"ttStage")],{drop:true,wait:0.6});}
/* the light: a red light cuts Ed off; a great or late one gets a word */
function annLight(R){if(!R||!annCtx())return;
  if(R.foul){annSay([annTake("red")],{urgent:true});return;}
  const rt=R.rt0;if(rt==null)return;const p=rt<0.02?"rtPerfect":rt<0.05?"rtGreat":rt>0.25?"rtLate":null;if(p)annSay([annTake(p)],{urgent:true,wait:0.8});}
/* real wheelspin inside the first 60 ft: still spinning a third of a second after it broke loose (a chirp is not worth a word) */
function annSpin(st){if(ANN.said.spin||!annCtx()||st.phase!=="run"||st.x>18.3)return;if(!st.spin){ANN.said.spin0=null;return;}
  if(ANN.said.spin0==null){ANN.said.spin0=st.t;return;}if(st.t-ANN.said.spin0<0.35)return;ANN.said.spin=1;annSay([annTake("spin")],{urgent:true,wait:0.5});}
/* as the car crosses into the shutdown area: broke, black flag, the verdict (night, or the test & tune lane), then a PB */
function annResult(st){if(ANN.said.res||!annCtx()||!DR)return;ANN.said.res=1;const R=DR.race,n=DR.night,q=st.marks.find(m=>m.n==="1/4 mi");const out=[];
  annPrep(["pb","qual","nightWon","night2nd","nightOut","dnq"]);
  if(DR.failed){annSay([annTake(DR.failKind==="driveline"?"driveline":"broke")],{urgent:true,wait:2});return;}
  if(career()&&q&&q.mph>150&&!DR.veh.chute){annSay([annTake("black")],{urgent:true,wait:2});return;}
  if(R&&!R.foul){let win=null,m=null,why="stripe";
    if(n&&n.verdict){win=n.verdict.win;m=n.verdict.margin;why=n.verdict.why;}
    else if(q){const mine=q.t+Math.max(0,R.rt0||0),theirs=R.et!=null?R.et+R.rt:null;win=theirs==null||mine<theirs;m=theirs!=null?Math.abs(theirs-mine):null;}
    if(n&&n.stage<2){}   // qualifying: no win light, the time is what counts
    else if(why==="line"&&!win)out.push("line");
    else if((why==="bo"||why==="bo2")&&!win)out.push("breakout");
    else if(why==="dnf"&&win)out.push("oppBroke");
    else if(win!=null)out.push(win?(m!=null&&m<0.02?"winClose":m!=null&&m>0.5?"winBig":"win"):(m!=null&&m<0.02?"lossClose":"loss"));}
  if(DR.pb)out.push("pb");else if(!R&&q&&Math.random()<0.4)out.push("ttClean");
  if(out.length){const ids=[];out.forEach((p,i)=>{if(i)ids.push("|");ids.push(annTake(p));});annSay(ids,{urgent:!R||!R.foul,wait:2.5});}}
/* after the pass is settled (rnAfterPass), with the stage the pass was run in: qualified for the ladder, or how the night ended */
function annNight(s0){const N=rnCur();if(!N||!annCtx())return;let p=null;
  if(N.done)p=N.place===1?"nightWon":N.place===2?"night2nd":N.place===9?(N.left?null:"dnq"):"nightOut";
  else if(s0===1&&N.stage===2)p="qual";
  if(p)annSay([annTake(p)],{wait:8,load:4});}
/* Settings › Sound › Drag announcer */
function applyAnn(){const on=S.ann!==false;document.querySelectorAll("#annSeg button").forEach(b=>b.classList.toggle("on",(b.dataset.ann==="1")===on));if(!on){ANN.q.length=0;annStop();}}
$("annSeg").addEventListener("click",e=>{const b=e.target.closest("[data-ann]");if(!b)return;S.ann=b.dataset.ann==="1";applyAnn();save();toast(S.ann?"ANNOUNCER ON · Ed calls the strip":"ANNOUNCER OFF");});
