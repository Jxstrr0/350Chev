/* ===================== RIVAL SHOPS (career) =====================
   Three made-up shops share the reputation board with you. Their rep grows week by week (a little noisy, and pulled toward
   yours so the table stays a race), the Team tab shows the standings, and now and then one of them throws down a
   head-to-head: a real result in a real event (the strip, the truck pull, Cloudsplitter Peak, the mud bog, the boat drags, the 24 Hours,
   the oval). The track day, the salt and Cloudsplitter Peak are run against the clock, so there the rival posts a number a little past
   your own best and your next lap (that car, that circuit) or run (that class) has to beat it; on the mountain their car runs
   in the field with that time. At the 24 Hours they enter a car in your class and you have to finish ahead of it.
   Nothing here touches S.cfg or the dyno. State lives on C().riv; rivS() fills its defaults, so old saves load clean.
   Feuds (since 1.76.84.0): beat or pass a shop and it may start one (RIV_FEUD_P). While it runs that shop talks about you in
   the week's log, throws down more often, and a season after it started (RIV_FEUD_COPY weeks) it rolls out a copy of the
   engine you had certified. It never touches your offers. Beat it in RIV_FEUD_WINS head-to-heads and it ends with a rep bonus;
   left alone it fizzles out after RIV_FEUD_MAX weeks with nothing. State: C().riv.feud {rv, wk, wins, cert, copied}. */
const RIV_EV={drag:"drag",pull:"pull_sled",hill:"hill",bog:"bog",boat:"boat",endurance:"race24",oval:"oval",road:"road",salt:"salt"};   // spEvent kind -> Events tab key
const RIV_EV_TXT={drag:"a heads-up pass at the strip",pull:"the truck pull",hill:"Cloudsplitter Peak",bog:"the mud bog",boat:"the boat drags",endurance:"the 24 Hours",oval:"the oval",road:"the track day",salt:"the salt flats"};
const RIV_EV_BTN={drag:"Take it to the strip",pull:"Go to the truck pull",hill:"Go to Cloudsplitter Peak",bog:"Go to the mud bog",boat:"Go to the boat drags",endurance:"Go to the 24 Hours",oval:"Go to the oval",road:"Go to the track day",salt:"Go to the salt"};
const RIV_EV_SHORT={drag:"the strip",pull:"the truck pull",hill:"Cloudsplitter Peak",bog:"the mud bog",boat:"the boat drags",endurance:"the 24 Hours",oval:"the oval",road:"the track day",salt:"the salt"};   // the board's last-head-to-head line
const RIV_BEAT=["road","salt","hill"];   // posted-number challenges: beat the time or the speed, not a field
const RIV_TOP_WEEKS=40;   // weeks at #1 over all three before each shop says its piece (once)
const RIVALS=[
  {id:"hollis",name:"Hollis Hot Rods",town:"Tulsa",base:22,share:0.6,pace:1.1,evs:["drag","oval","salt"],
    tag:"Strip-first, mouth-first. The number is on the door before the dyno sheet is printed.",
    up:["Hollis Hot Rods moved past you on the board. \"Figured it was my turn.\"","Hollis Hot Rods is ahead of you again. Somebody at the shop wrote it on the door in chalk."],
    down:["You passed Hollis Hot Rods. Dale Hollis is calling it a rebuilding year.","You are ahead of Hollis Hot Rods now. They say the chart is wrong."],
    chal:["\"Think you're quick? Meet me at the strip.\"","\"One pass. Loser buys the tyres.\""],
    chalEv:{oval:"\"Short track, short temper. Feature race, and I'm not lifting.\"",salt:"\"Anybody's quick for a quarter. Let's see you hold it for a mile.\""},
    top:["Dale Hollis scrubbed the chalk off the shop door himself. \"Forty weeks. All right, you're quick.\"","He still wants a rematch at the strip, but he asked for it quietly."],
    won:["Hollis took the pass and had the win painted on the trailer before you cleared the lights.","Hollis Hot Rods beat you off the line and made sure the whole pit heard."],
    lost:["Hollis lost to you and blamed the tyres. He wants a rematch anyway.","You beat Hollis Hot Rods. The tailgate was quiet for almost a minute."]},
  {id:"marlow",name:"Marlow & Daughters",town:"Duluth",base:38,share:0.85,pace:0.95,evs:["hill","endurance","road"],
    tag:"Three generations, one dyno, no excuses. They publish their numbers and expect you to publish yours.",
    up:["Marlow & Daughters edged past you. A note arrived: \"Good effort. See attached curves.\"","Marlow & Daughters are ahead of you on the board, as the spreadsheet predicted."],
    down:["You pulled ahead of Marlow & Daughters. Their reply: a spreadsheet, politely marked \"for your records\".","You are ahead of Marlow & Daughters. They have requested your test conditions."],
    chal:["\"Put your engine where the air is thin. We will compare notes after.\"","\"Twenty-four hours is the only honest test. Shall we?\""],
    chalEv:{road:"\"A lap time is a measurement. We have taken ours. Your turn.\"",hill:"\"We have been up the mountain. The time is attached. Our car will be in the field.\"",endurance:"\"We have entered a car in your class. Twenty-four hours, and we will see who is still running.\""},
    top:["Marlow & Daughters mailed a card: \"Forty weeks ahead of us, by our own spreadsheet. Well measured.\"","The youngest Marlow added a line in pencil: \"We have not stopped measuring.\""],
    won:["Marlow & Daughters beat you and sent the timing sheet, annotated.","Marlow & Daughters took it. The cover letter was three paragraphs, all of them kind."],
    lost:["You beat Marlow & Daughters. They sent a very polite, very short congratulation.","Marlow & Daughters lost to you and asked for your log. They did not say why."]},
  {id:"tidewater",name:"Tidewater Diesel & Marine",town:"Galveston",base:14,share:0.5,pace:1.2,evs:["pull","bog","boat"],
    tag:"Diesel and bilge. Farm tractors in spring, crab boats in winter, and a grudge about both.",
    up:["Tidewater Diesel & Marine is ahead of you now. The crew painted a boast on the shop truck.","Tidewater Diesel & Marine passed you on the board. Torque, they say, doesn't lie."],
    down:["You passed Tidewater Diesel & Marine. Somebody over there is blaming the fuel.","You are ahead of Tidewater Diesel & Marine. They are not taking it well, or badly. They are not taking it."],
    chal:["\"Torque doesn't lie. Come get muddy.\"","\"Meet us where it's wet. Bring a spare.\""],
    top:["The Tidewater foreman sent a thermos of coffee across the county line. \"Forty weeks on top. Torque still doesn't lie.\"","The crab boat crew hung a flag half-mast on the shop truck, as a joke. Mostly a joke."],
    won:["Tidewater took the win and left a mud-caked trophy on your doorstep.","Tidewater Diesel & Marine beat you and towed the trophy home behind a boat."],
    lost:["Tidewater lost to you and sent a case of coolant as a \"gift\".","You beat Tidewater Diesel & Marine. The foreman asked what you were running. You did not say."]}];
/* tuning (round 6): a rival used to stop at 1800 while your rep has no ceiling, so the board was dead by about week 100 (a good shop is #1 by week 5 and 4x the field by week 80).
   Now a rival's weekly gain is (RIV_GAIN[0] + rep * RIV_GAIN[1]) * pace * noise; behind you it multiplies by 1 + min(RIV_CATCH[1], gap * RIV_CATCH[0]), ahead of you it eases off to RIV_EASE at the least,
   so the three shops hold roughly 60-100% of a good player's rep all career instead of falling away. The ceiling only stops a runaway. */
/* each shop's feud voice: start, talk (weekly), copy ({n} the engine, {hp} its power), gloat (they beat you), end */
const RIV_FEUD={
  hollis:{start:["Dale Hollis has decided you are the problem. He told three people at the gas station.","Hollis Hot Rods is taking it personally. Somebody painted your shop's name on their dartboard."],
    talk:["Hollis on the local radio: \"Their stuff looks good on a dyno sheet. So does a lawn mower.\"","Dale Hollis posted a photo of your cert sheet with a big red question mark on it.","Hollis Hot Rods: \"We're not worried. We've seen their tyres.\"","Word from the strip: Hollis has been telling people you buy your horsepower by the pound.","Hollis taped your shop's logo to the bottom of their creeper. \"So I can look at it all day.\""],
    copy:["Hollis Hot Rods rolled out \"their own\" engine. It is your {n}, {hp} hp, with a Hollis sticker on the valve cover.","Dale Hollis is running a copy of your {n} and calling it a Hollis original. The dyno sheet says {hp} hp."],
    gloat:["Hollis had the result printed on T-shirts by morning.","Dale Hollis did a lap of the pits with the timeslip held over his head."],
    end:["Dale Hollis shook your hand in front of everybody. \"All right. All right. You're quick.\" The feud is over.","Hollis Hot Rods scraped your name off the dartboard. The feud is done, and he bought the tyres."]},
  marlow:{start:["Marlow & Daughters opened a file on your shop. It already has tabs.","The Marlows sent a letter: they will be \"following your results with interest\". It is not a friendly letter."],
    talk:["Marlow & Daughters published a technical note on why your intake is wrong. It has footnotes.","A Marlow newsletter went out with your dyno curve in it, annotated in red.","The middle Marlow daughter told a magazine your numbers are \"optimistic, at best\".","Marlow & Daughters asked the series for your test conditions. Again.","\"We do not have rivals,\" said a Marlow. \"We have reference points.\" They meant you."],
    copy:["Marlow & Daughters built a copy of your {n} \"for comparison\". Theirs makes {hp} hp and came with a 12-page report.","The Marlows are running your {n} now, measured to the tenth: {hp} hp. The report says it can be improved."],
    gloat:["The Marlows mailed you the timing sheet with the gap highlighted.","Marlow & Daughters sent a short note: \"As predicted.\""],
    end:["Marlow & Daughters closed your file and sent a card: \"Measured fairly, beaten fairly.\" The feud is over.","The Marlows asked for a photo with your crew, for the wall. The feud is done."]},
  tidewater:{start:["Tidewater Diesel & Marine has a new favourite topic: you. The whole dock knows your name now.","The Tidewater foreman spat in the bilge and said your shop's name. Feud on."],
    talk:["Tidewater painted \"TORQUE DOESN'T LIE\" on a billboard facing your road.","The Tidewater crew says your engines couldn't pull a crab pot out of a bathtub.","A Tidewater truck rolled past your shop at walking pace, black smoke and all, just to make a point.","Tidewater's foreman told the feed store you run your tractors on hairspray.","Tidewater left a dead outboard on your doorstep with a note: \"Your next build?\""],
    copy:["Tidewater rolled out a copy of your {n}. They added a snorkel and some rust. {hp} hp, they say.","The Tidewater crew is running your {n} in a work boat now, {hp} hp, and telling everyone they did it first."],
    gloat:["Tidewater towed the trophy past your shop twice.","The Tidewater crew honked the boat horn for a full minute."],
    end:["The Tidewater foreman showed up with a thermos and two mugs. \"Fair's fair.\" The feud is over.","Tidewater painted over the billboard. It just says \"Good engines\" now. The feud is done."]}};
const RIV_FEUD_P=0.5,RIV_FEUD_PASS_P=0.2,RIV_FEUD_REP=60,RIV_FEUD_WINS=2,RIV_FEUD_COPY=16,RIV_FEUD_MAX=40,RIV_FEUD_COOL=12,RIV_FEUD_TALK=0.45;
const RIV_MAX=40000,RIV_GAIN=[2,0.005],RIV_CATCH=[2,6],RIV_EASE=0.25;
const RIV_WIN_TIER=5,RIV_LOSE_PCT=0.3,RIV_PURSE_CAP=40000,RIV_FLIP=0.03;   // stakes grow with tier and rep (they were a flat +3..13 rep, -2 rep and $2,500 at any size of shop); a rival passes you only by a 3% margin so the log doesn't chatter
const rivTier=r=>{let i=0;for(let j=0;j<REP_TIERS.length;j++)if(r>=REP_TIERS[j][0])i=j;return i;};
function rivS(){const c=C();const s=c.riv&&typeof c.riv==="object"?c.riv:(c.riv={});
  if(!s.r||typeof s.r!=="object")s.r={};if(!s.pos||typeof s.pos!=="object")s.pos={};if(!s.tier||typeof s.tier!=="object")s.tier={};
  if(!s.hist||typeof s.hist!=="object")s.hist={};for(const k of ["won","lost","declined","forfeit"])s.hist[k]=+s.hist[k]||0;
  if(!Array.isArray(s.rh))s.rh=[];if(!s.last||typeof s.last!=="object")s.last={};if(!s.ack||typeof s.ack!=="object")s.ack={};s.top=+s.top||0;   // r13: 4-week rep ring, last head-to-head per rival, #1 streak and the one-time late-game words
  if(!s.seed)s.seed=((c.seed||1)^0x2c9277b5)>>>0||11;if(!(s.cool>=0))s.cool=0;if(!(s.fcool>=0))s.fcool=0;if(s.feud&&(typeof s.feud!=="object"||!RIV_FEUD[s.feud.rv]))s.feud=null;s.hist.feuds=+s.hist.feuds||0;
  for(const v of RIVALS)if(!(s.r[v.id]>=0))s.r[v.id]=Math.round(Math.max(v.base,(c.rep||0)*v.share));
  return s;}
function rivRng(){const s=rivS();s.seed=(s.seed*1664525+1013904223)>>>0;return s.seed/4294967296;}
const rivPick=a=>a[Math.floor(rivRng()*a.length)];
function rivH2h(c){const h=(c.riv&&c.riv.hist)||{};return{won:+h.won||0,lost:+h.lost||0};}
function rivTop(c){const r=(c.riv&&c.riv.r)||{};return RIVALS.every(v=>(+r[v.id]||0)<(c.rep||0));}
/* the board: who is ahead of whom. A two-point margin to change sides, so a tie doesn't chatter. */
function rivalsPos(){if(!career())return;const s=rivS(),pl=C().rep;
  for(const v of RIVALS){const r=s.r[v.id];let p=s.pos[v.id];
    if(p==null){s.pos[v.id]=pl>=r?1:-1;continue;}
    const mg=Math.max(2,pl*RIV_FLIP);if(p===1&&r>=pl+mg){s.pos[v.id]=-1;logEvent(rivPick(v.up),"bad");}
    else if(p===-1&&pl>=r+mg){s.pos[v.id]=1;logEvent(rivPick(v.down),"good");toastAfter(`You passed ${v.name}`);rivFeudMaybe(v,RIV_FEUD_PASS_P);}}}
function rivalsWeek(){if(!career())return;const s=rivS(),c=C(),pl=c.rep;
  for(const v of RIVALS){let r=s.r[v.id];
    let g=(RIV_GAIN[0]+r*RIV_GAIN[1])*v.pace*(0.4+rivRng()*1.2);
    const gap=(pl-r)/Math.max(40,r);g*=gap>0?1+Math.min(RIV_CATCH[1],gap*RIV_CATCH[0]):Math.max(RIV_EASE,1+gap*0.5);   // the board stays a race: they chase a runaway and ease off a laggard
    s.r[v.id]=r=Math.min(RIV_MAX,r+g);
    const ti=rivTier(r);if(s.tier[v.id]==null)s.tier[v.id]=ti;else if(ti>s.tier[v.id]){s.tier[v.id]=ti;if(c.rep>=10)logEvent(`${v.name} has made ${REP_TIERS[ti][1]} — ${REP_TIERS[ti][0]} rep on the board`,"");}}
  const ch=s.ch;
  if(ch){const v=RIVALS.find(x=>x.id===ch.rv);
    if(ch.st==="offer"&&c.week>ch.exp){logEvent(`${v.name} withdrew the challenge`,"");s.ch=null;s.cool=2;}
    else if(ch.st==="on"&&c.week>ch.exp){s.hist.forfeit++;s.hist.lost++;c.rep=Math.max(0,c.rep-ch.lose);s.r[v.id]=Math.min(RIV_MAX,s.r[v.id]+Math.max(2,s.r[v.id]*0.02));
      s.last[v.id]={w:c.week,pw:0,ev:ch.ev,ns:1};logEvent(`You never showed for ${v.name}'s challenge — −${ch.lose} rep. ${rivPick(v.won)}`,"bad");toastAfter(`Challenge forfeited · −${ch.lose} rep`);s.ch=null;s.cool=3;}}
  else if(s.cool>0)s.cool--;
  else if(c.rep>=30&&rivRng()<0.45)rivIssue();
  rivalsPos();rivRing();rivTopWeek();rivFeudWeek();}
/* r13: a short ring of the board (the last 8 weeks, rounded) so the table can show a 4-week trend; the #1 streak and the once-only late-game words */
function rivRing(){const s=rivS(),c=C(),e={w:c.week,p:Math.round(c.rep),r:{}};for(const v of RIVALS)e.r[v.id]=Math.round(s.r[v.id]);
  if(s.rh.length&&s.rh[s.rh.length-1].w===c.week)s.rh.pop();s.rh.push(e);if(s.rh.length>8)s.rh.splice(0,s.rh.length-8);}
function rivTrend(id){const s=rivS(),c=C(),now=id?s.r[id]:c.rep;let ref=null;
  for(const e of s.rh)if(e.w<=c.week-4)ref=e;if(!ref&&s.rh.length&&s.rh[0].w<c.week-1)ref=s.rh[0];   // a young ring uses what it has (2+ weeks)
  const v=ref?(id?ref.r[id]:ref.p):null;if(v==null||!isFinite(v))return{k:"fl",d:0,n:0};
  const d=Math.round(now-v),pc=(now-v)/Math.max(10,v);return{k:pc>=0.025?"up":pc<=-0.01?"dn":"fl",d,n:c.week-ref.w};}
function rivTopWeek(){const s=rivS(),c=C();s.top=rivTop(c)&&RIVALS.every(v=>s.pos[v.id]===1)?s.top+1:0;
  if(s.top>=RIV_TOP_WEEKS){const v=RIVALS.find(x=>!s.ack[x.id]);if(v){s.ack[v.id]=1;logEvent(v.top.join(" "),"good");}}}   // one shop a week, so the log doesn't dump three at once
function rivEvOpen(ev){try{return evStatus(RIV_EV[ev]).k!=="lock"&&(!RIV_BEAT.includes(ev)||rivBests(ev).length>0)&&(ev!=="endurance"||e24C().next<=C().week+2);}catch(e){return false;}}   // the 24 Hours: only when a running falls inside the challenge
/* the bests a posted-number challenge can be set against: plain-chassis laps (no swap cars) and salt class bests */
function rivBests(ev){
  if(ev==="road")return Object.values(recBucket("road")).filter(x=>x&&x.t>0&&!x.sw&&SIM.CHASSIS[x.ch]&&SIM.ROAD_TRACKS[x.trk]).map(x=>({car:x.ch,trk:x.trk,b:x.t}));
  if(ev==="salt"){const pb=saltBook().pb||{};return Object.keys(pb).filter(k=>pb[k]&&pb[k].mph>0).map(k=>({k,b:pb[k].mph}));}
  if(ev==="hill"){const R=recBucket("hill");return Object.keys(R).filter(k=>R[k]&&R[k].t>0&&SIM.HILL_CLASSES[k]&&!clsLocked(SIM.HILL_CLASSES,k)).map(k=>({k,b:R[k].t}));}
  return[];}
/* a rival ahead of you posts a number 1.2-2.2% past your best, one behind 0.4-1.2% */
function rivPost(ev,ahead){const x=rivPick(rivBests(ev)),m=ahead?0.012+rivRng()*0.01:0.004+rivRng()*0.008;
  return ev==="road"?{car:x.car,trk:x.trk,tgt:Math.floor(x.b*(1-m)*10)/10}:ev==="hill"?{k:x.k,tgt:Math.floor(x.b*(1-m)*10)/10}:{k:x.k,tgt:Math.ceil(x.b*(1+m)*10)/10};}
const rivTgtTxt=ch=>ch.ev==="road"?fmtLap(ch.tgt,1):ch.ev==="hill"?fmtHill(ch.tgt):ch.tgt.toFixed(1)+" mph";
const rivWhere=ch=>ch.ev==="road"?`${(SIM.ROAD_TRACKS[ch.trk]||{}).n||"the circuit"} in ${roadCarTxt({ch:ch.car})}`:ch.ev==="hill"?`${(SIM.HILL_CLASSES[ch.k]||{}).n||"the class"} at Cloudsplitter Peak`:`class ${ch.k} on the salt`;
/* Cloudsplitter Peak: the rival's car in the field, on the posted time (splits paced off your own record in that class) */
function rivHillRow(k){if(!career())return null;const ch=rivS().ch;if(!ch||ch.st!=="on"||ch.ev!=="hill"||ch.k!==k)return null;
  const v=RIVALS.find(x=>x.id===ch.rv),pb=recBucket("hill")[k],F=SIM.HILL_CLASSES[k].field,sp=pb&&pb.t>0&&pb.splits?pb.splits.map(x=>+(x*ch.tgt/pb.t).toFixed(3)):[];
  return{n:v.name,rv:true,hp:Math.round(F.hp*1.05),turbo:F.turbo>=0.5,ch:pb&&pb.ch||"coupe",skill:0.9,t:ch.tgt,dnf:null,splits:sp,offs:0,paint:HILL_PAINT[2]};}
function hillWithRv(k,f){const x=f&&rivHillRow(k);return x?f.concat([x]):f;}
/* the 24 Hours: one car in your class runs under the rival's name — a touch quicker than yours if they are ahead on the board */
function rivE24Car(R){if(!career())return null;const ch=rivS().ch;if(!ch||ch.st!=="on"||ch.need!=="ahead")return null;
  const me=R.cars[0],v=RIVALS.find(x=>x.id===ch.rv),L=c=>c.P.modes.race.lap*c.pace,want=L(me)*(ch.ah?0.995:1.005),pool=R.cars.filter(c=>!c.me&&c.cls===me.cls);if(!pool.length)return null;
  pool.sort((a,b)=>Math.abs(L(a)-want)-Math.abs(L(b)-want));const c=pool[0];c.team=v.name;return{i:c.i,n:v.name.split(" ")[0]};}
function rivIssue(){const s=rivS(),c=C(),pl=c.rep;
  const cand=RIVALS.map(v=>({v,evs:v.evs.filter(rivEvOpen)})).filter(x=>x.evs.length);if(!cand.length)return;
  // lean toward a rival who is close to you in the table
  const w=cand.map(x=>(s.feud&&s.feud.rv===x.v.id?4:1)/(0.4+Math.abs(Math.log((s.r[x.v.id]+10)/(pl+10)))));   // a shop in a feud with you throws down more
  let t=w.reduce((a,b)=>a+b,0)*rivRng(),i=0;while(i<w.length-1&&t>w[i]){t-=w[i];i++;}
  const v=cand[i].v,ev=rivPick(cand[i].evs),tier=repTierIdx(),ahead=s.r[v.id]>pl;
  const beat=RIV_BEAT.includes(ev),need=beat?"beat":ev==="endurance"?"ahead":ev==="drag"||ahead?"win":"podium";
  const win=Math.round((3+tier*RIV_WIN_TIER)*(need==="win"||(need!=="podium"&&ahead)?1.3:1)),purse=Math.min(RIV_PURSE_CAP,Math.round((150+pl*7)/50)*50);
  s.ch=Object.assign({id:Math.floor(rivRng()*1e9),rv:v.id,ev,need,st:"offer",wk:c.week,exp:c.week+2,win,lose:Math.max(2,Math.round(win*RIV_LOSE_PCT)),purse},beat?rivPost(ev,ahead):need==="ahead"?{ah:ahead?1:0}:{});
  logEvent(beat?`${v.name} posted ${rivTgtTxt(s.ch)} — ${rivWhere(s.ch)} — and dares you to beat it. See Team`:`${v.name} challenges you at ${RIV_EV_TXT[ev]} — see Market`,"");toastAfter(`${v.name} wants a head-to-head`);}
/* a result in the field: the open challenge, if it is on and about this event */
function rivalsEvent(kind,o){const s=rivS(),ch=s.ch;if(!ch||ch.st!=="on"||ch.ev!==kind)return;
  if(kind==="drag"){const d=S.last&&S.last.res&&S.last.res.drag;if(!(d&&d.race)||(typeof DR!=="undefined"&&DR&&DR.night))return;}   // a heads-up pass only: not a solo pass, not race night
  if(kind==="oval"&&o.heat)return;   // the feature decides it
  if(kind==="road"&&(o.sw||o.ch!==ch.car||o.trk!==ch.trk))return;   // only a lap in the posted car on the posted circuit
  if((kind==="salt"||kind==="hill")&&ch.need==="beat"&&o.k!==ch.k)return;   // only a run in the posted class
  const v=RIVALS.find(x=>x.id===ch.rv),c=C();
  const lo=kind!=="salt",val=lo?o.t:o.mph;   // a time to get under, or a speed to get over
  const won=ch.need==="beat"?val!=null&&(lo?val<ch.tgt:val>ch.tgt):ch.need==="ahead"&&o.ahead!=null?!!o.ahead:ch.need==="win"?!!o.win:!!(o.win||o.finish);s.ch=null;s.cool=3;   // no rival car on the grid (an empty class): a podium will do
  const vs=ch.need==="beat"?` (${val!=null?(kind==="road"?fmtLap(val,2):kind==="hill"?fmtHill(val):val.toFixed(2)+" mph"):"no time"} against ${rivTgtTxt(ch)})`:o.rvTxt?` (${o.rvTxt})`:"";
  s.last[v.id]={w:c.week,pw:won?1:0,ev:ch.ev};
  if(won){s.hist.won++;if(!s.hist.beat||typeof s.hist.beat!=="object")s.hist.beat={};s.hist.beat[v.id]=(s.hist.beat[v.id]||0)+1;c.rep+=ch.win;c.cash+=ch.purse;s.r[v.id]=Math.max(0,s.r[v.id]-Math.max(3,s.r[v.id]*0.04));
    logEvent(`Head-to-head beat ${v.name} at ${RIV_EV_TXT[ch.ev]}${vs} — ${fmt$(ch.purse)} side bet, +${ch.win} rep. ${rivPick(v.lost)}`,"good");toastAfter(`BEAT ${v.name.toUpperCase()} · +${ch.win} REP · ${fmt$(ch.purse)}`);
    if(s.feud&&s.feud.rv===v.id)rivFeudWin(v);else rivFeudMaybe(v,RIV_FEUD_P);}
  else{s.hist.lost++;c.rep=Math.max(0,c.rep-ch.lose);s.r[v.id]=Math.min(RIV_MAX,s.r[v.id]+Math.max(2,s.r[v.id]*0.02));
    logEvent(`Head-to-head lost to ${v.name} at ${RIV_EV_TXT[ch.ev]}${vs} — −${ch.lose} rep. ${rivPick(v.won)}`,"bad");toastAfter(`${v.name} won the head-to-head · −${ch.lose} rep`);
    if(s.feud&&s.feud.rv===v.id)logEvent(rivPick(RIV_FEUD[v.id].gloat),"bad");}
  rivalsPos();}
/* ---- feuds ---- */
const rivCertSnap=()=>{const c=C().cert;return c&&c.ok&&c.res?{n:String(engineName()||"engine").slice(0,40),hp:Math.round(c.res.peakHp||0)}:null;};
function rivFeudMaybe(v,p){const s=rivS(),c=C();if(s.feud||s.fcool>0||c.rep<RIV_FEUD_REP||rivRng()>=p)return;
  s.feud={rv:v.id,wk:c.week,wins:0,cert:rivCertSnap(),copied:0};s.hist.feuds++;logEvent(`Feud: ${rivPick(RIV_FEUD[v.id].start)} Beat them in ${RIV_FEUD_WINS} head-to-heads to settle it.`,"bad");toastAfter(`${v.name} has started a feud`);}
function rivFeudWeek(){const s=rivS(),f=s.feud,c=C();if(!f){if(s.fcool>0)s.fcool--;return;}const v=RIVALS.find(x=>x.id===f.rv),T=RIV_FEUD[f.rv];
  if(c.week-f.wk>=RIV_FEUD_MAX){logEvent(`${v.name} has found somebody else to talk about. The feud fizzled out.`,"");s.feud=null;s.fcool=RIV_FEUD_COOL;return;}
  if(!f.cert)f.cert=rivCertSnap();   // nothing certified when it started: they wait for something worth copying
  if(!f.copied&&f.cert&&c.week-f.wk>=RIV_FEUD_COPY){f.copied=c.week;logEvent(rivPick(T.copy).replace("{n}",f.cert.n).replace("{hp}",f.cert.hp.toLocaleString("en-CA")),"bad");return;}
  if(rivRng()<RIV_FEUD_TALK)logEvent(rivPick(T.talk),"");}
function rivFeudWin(v){const s=rivS(),f=s.feud,c=C();f.wins++;
  if(f.wins<RIV_FEUD_WINS){logEvent(`Feud with ${v.name}: ${f.wins} of ${RIV_FEUD_WINS} head-to-heads won. One more settles it.`,"");return;}
  const bonus=rivFeudBonus();c.rep+=bonus;s.feud=null;s.fcool=RIV_FEUD_COOL;if(!s.hist.ended)s.hist.ended=0;s.hist.ended++;
  logEvent(`${rivPick(RIV_FEUD[v.id].end)} +${bonus} rep.`,"good");toastAfter(`FEUD SETTLED · ${v.name.toUpperCase()} · +${bonus} REP`);}
const rivFeudBonus=()=>Math.round((5+repTierIdx()*RIV_WIN_TIER)*1.5);
function rivFeudHtml(){const f=rivS().feud;if(!f)return"";const v=RIVALS.find(x=>x.id===f.rv),left=RIV_FEUD_WINS-f.wins;
  return`<p class="hint rvhint rvfeudtxt"><b>Feud with ${v.name}:</b> beat them in ${left} more head-to-head${left===1?"":"s"} to settle it (+${rivFeudBonus()} rep). Since week ${f.wk} they talk about you in the week's news${f.copied?` and are running a copy of your ${esc(f.cert.n)}`:f.cert?`, and a season in they will copy your ${esc(f.cert.n)}`:""}. They can't touch your teams.</p>`;}
function rivalsRender(){let sec=$("rivSec");
  if(!career()){if(sec)sec.hidden=true;return;}
  if(!sec){const anchor=$("mkSpons");if(!anchor)return;
    sec=document.createElement("div");sec.className="sec";sec.id="rivSec";sec.innerHTML=`<h2>Rival shops <span class="cnt" id="rivCnt"></span></h2><div id="rivBox"></div>`;anchor.appendChild(sec);
    sec.addEventListener("click",rivClick);}
  const s=rivS(),pl=C().rep;sec.hidden=pl<10&&!s.ch;if(sec.hidden)return;
  const rows=RIVALS.map(v=>({v,r:Math.round(s.r[v.id])})).concat([{v:null,r:Math.round(pl)}]).sort((a,b)=>b.r-a.r||(a.v?1:-1));
  const me=rows.findIndex(x=>!x.v)+1;$("rivCnt").textContent=`you are #${me} of ${rows.length}`;
  const h=s.hist,chv=s.ch?s.ch.rv:null;
  const trend=id=>{const t=rivTrend(id),w=t.k==="up"?"up":t.k==="dn"?"down":"flat",a=t.k==="up"?"▲":t.k==="dn"?"▼":"—";   // rep vs 4 weeks ago (2+ on a young ring)
    return`<em class="rvt ${t.k}" role="img" aria-label="${t.n?`${w}, ${t.d>0?"+":""}${t.d} rep over ${t.n} weeks`:"no trend yet"}" title="${t.n?`${t.d>0?"+":""}${t.d} rep in ${t.n} wk`:"no trend yet"}">${a}</em>`;};
  const last=v=>{const L=s.last[v.id];return!L?"No head-to-head yet":L.ns?`You never showed, wk ${L.w}`:`${L.pw?"Lost to you":"Beat you"} at ${RIV_EV_SHORT[L.ev]||"the track"}, wk ${L.w}`;};
  const board=rows.map((x,i)=>x.v
    ?`<div class="rvrow${x.v.id===chv?" pend":""}"><b class="rvn">${i+1}</b><span class="rvnm"><b>${x.v.name}${s.feud&&s.feud.rv===x.v.id?` <span class="mkc rvchip rvfeud">Feud</span>`:""}</b><i>${REP_TIERS[rivTier(x.r)][1]} · ${x.v.town}</i><i class="rvh">${x.v.id===chv?`<span class="mkc rvchip">${s.ch.st==="on"?"Challenge on":"Challenge"}</span>${s.ch.st==="on"?"run it":"answer"} by wk ${s.ch.exp}`:last(x.v)}</i></span><span class="rvp">${x.r}${trend(x.v.id)}</span></div>`
    :`<div class="rvrow you"><b class="rvn">${i+1}</b><span class="rvnm"><b>Your shop</b><i>${repTier()[1]}</i></span><span class="rvp">${x.r}${trend(null)}</span></div>`).join("");
  const near=RIVALS.slice().sort((a,b)=>Math.abs(s.r[a.id]-pl)-Math.abs(s.r[b.id]-pl))[0];
  const ch=s.ch;let card="";
  if(ch){const v=RIVALS.find(x=>x.id===ch.rv),on=ch.st==="on";
    card=`<div class="card rvch"><div class="client">${on?"Challenge accepted":"Challenge"} · ${v.name}<em class="ctag">Head-to-head</em></div><h3>${ch.ev==="drag"?"Heads-up pass at the strip":ch.need==="ahead"?"Finish ahead of their car at the 24 Hours":ch.need==="beat"?`Beat ${rivTgtTxt(ch)} · ${rivWhere(ch)}`:"Beat them at "+RIV_EV_TXT[ch.ev]}<span>${on?"run it by wk "+ch.exp:"answer by wk "+ch.exp}</span></h3>
      <p class="cnote">${on?v.tag:(v.chalEv&&v.chalEv[ch.ev])||rivPick(v.chal)}</p>
      <div class="money"><div><b class="pos">+${ch.win}</b><span>rep if you win</span></div><div><b class="pos">${fmt$(ch.purse)}</b><span>side bet</span></div><div><b class="neg">−${ch.lose}</b><span>rep if you lose</span></div></div>
      <div class="cstat off">${ch.need==="ahead"?`${v.name} enter a car in your class at your next 24 Hours. Finish ahead of it in the classification; if your class has no other car, a podium will do.`:ch.need==="beat"?(ch.ev==="road"?`${v.name} lapped ${rivWhere(ch)} in ${rivTgtTxt(ch)}. Your next lap in that car on that circuit decides it; a swap car doesn't count.`:ch.ev==="hill"?`${v.name} climbed ${rivWhere(ch)} in ${rivTgtTxt(ch)}, and their car runs in the field on that time. Your next climb in that class decides it; a DNF loses.`:`${v.name} ran ${rivTgtTxt(ch)} through the mile in ${ch.k}. Your next run in that class decides it; a run that breaks or books no time loses.`)
        :`${ch.need==="win"?"Win it outright":"Finish on the podium (top three)"}${ch.ev==="drag"?" in a heads-up pass (Events · Drag strip · race the other lane)":ch.ev==="oval"?" in the feature (the heat doesn't count)":""}.${ch.ev==="drag"?" Solo runs and race nights don't count.":""}`}</div>
      ${on?`<button class="btn pri" data-rvgo="${ch.ev}">${RIV_EV_BTN[ch.ev]} ›</button>`:`<div class="rvbtns"><button class="btn pri" data-rvacc="1">Accept</button><button class="btn ghost" data-rvno="1">Turn it down</button></div>`}</div>`;}
  $("rivBox").innerHTML=`<div class="rvboard">${board}</div><p class="hint rvhint">${near.name}: ${near.tag}</p>${rivFeudHtml()}${card}<p class="hint rvhint">Head-to-heads: ${h.won} won · ${h.lost} lost${h.declined?" · "+h.declined+" turned down":""}. A rival throws down every few weeks once you are past 30 rep. Arrows: rep against 4 weeks ago.</p>`;}
function rivClick(e){const s=rivS(),ch=s.ch;
  const go=e.target.closest("[data-rvgo]");if(go){if(!ch||ch.st!=="on")return;evGo(RIV_EV[ch.ev],ch.ev==="drag"?{race:"heads"}:ch.ev==="road"?{roadCh:ch.car,roadTrk:ch.trk}:ch.ev==="hill"?{hillCls:ch.k}:{});return;}
  if(!ch)return;const v=RIVALS.find(x=>x.id===ch.rv);
  if(e.target.closest("[data-rvacc]")){ch.st="on";ch.exp=C().week+3;logEvent(`Accepted ${v.name}'s challenge at ${RIV_EV_TXT[ch.ev]} — run it by week ${ch.exp}`,"");save();renderShop();toast(`CHALLENGE ON · ${v.name.toUpperCase()}`);buzz(20);return;}
  if(e.target.closest("[data-rvno]")){s.hist.declined++;s.ch=null;s.cool=3;logEvent(`Turned down ${v.name}. They'll tell people.`,"");save();renderShop();}}
