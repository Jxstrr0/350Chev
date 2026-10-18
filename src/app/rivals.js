/* ===================== RIVAL SHOPS (career) =====================
   Three made-up shops share the reputation board with you. Their rep grows week by week (a little noisy, and pulled toward
   yours so the table stays a race), the Market tab shows the standings, and now and then one of them throws down a
   head-to-head: a real result in a real event (the strip, the truck pull, Pikes Peak, the mud bog, the boat drags, the 24 Hours).
   Nothing here touches S.cfg or the dyno. State lives on C().riv; rivS() fills its defaults, so old saves load clean. */
const RIV_EV={drag:"drag",pull:"pull_sled",hill:"hill",bog:"bog",boat:"boat",endurance:"race24"};   // spEvent kind -> Events tab key
const RIV_EV_TXT={drag:"a heads-up pass at the strip",pull:"the truck pull",hill:"Pikes Peak",bog:"the mud bog",boat:"the boat drags",endurance:"the 24 Hours"};
const RIV_EV_BTN={drag:"Take it to the strip",pull:"Go to the truck pull",hill:"Go to Pikes Peak",bog:"Go to the mud bog",boat:"Go to the boat drags",endurance:"Go to the 24 Hours"};
const RIVALS=[
  {id:"hollis",name:"Hollis Hot Rods",town:"Tulsa",base:22,share:0.6,pace:1.1,evs:["drag"],
    tag:"Strip-first, mouth-first. The number is on the door before the dyno sheet is printed.",
    up:["Hollis Hot Rods moved past you on the board. \"Figured it was my turn.\"","Hollis Hot Rods is ahead of you again. Somebody at the shop wrote it on the door in chalk."],
    down:["You passed Hollis Hot Rods. Dale Hollis is calling it a rebuilding year.","You are ahead of Hollis Hot Rods now. They say the chart is wrong."],
    chal:["\"Think you're quick? Meet me at the strip.\"","\"One pass. Loser buys the tyres.\""],
    won:["Hollis took the pass and had the win painted on the trailer before you cleared the lights.","Hollis Hot Rods beat you off the line and made sure the whole pit heard."],
    lost:["Hollis lost to you and blamed the tyres. He wants a rematch anyway.","You beat Hollis Hot Rods. The tailgate was quiet for almost a minute."]},
  {id:"marlow",name:"Marlow & Daughters",town:"Duluth",base:38,share:0.85,pace:0.95,evs:["hill","endurance"],
    tag:"Three generations, one dyno, no excuses. They publish their numbers and expect you to publish yours.",
    up:["Marlow & Daughters edged past you. A note arrived: \"Good effort. See attached curves.\"","Marlow & Daughters are ahead of you on the board, as the spreadsheet predicted."],
    down:["You pulled ahead of Marlow & Daughters. Their reply: a spreadsheet, politely marked \"for your records\".","You are ahead of Marlow & Daughters. They have requested your test conditions."],
    chal:["\"Put your engine where the air is thin. We will compare notes after.\"","\"Twenty-four hours is the only honest test. Shall we?\""],
    won:["Marlow & Daughters beat you and sent the timing sheet, annotated.","Marlow & Daughters took it. The cover letter was three paragraphs, all of them kind."],
    lost:["You beat Marlow & Daughters. They sent a very polite, very short congratulation.","Marlow & Daughters lost to you and asked for your log. They did not say why."]},
  {id:"tidewater",name:"Tidewater Diesel & Marine",town:"Galveston",base:14,share:0.5,pace:1.2,evs:["pull","bog","boat"],
    tag:"Diesel and bilge. Farm tractors in spring, crab boats in winter, and a grudge about both.",
    up:["Tidewater Diesel & Marine is ahead of you now. The crew painted a boast on the shop truck.","Tidewater Diesel & Marine passed you on the board. Torque, they say, doesn't lie."],
    down:["You passed Tidewater Diesel & Marine. Somebody over there is blaming the fuel.","You are ahead of Tidewater Diesel & Marine. They are not taking it well, or badly. They are not taking it."],
    chal:["\"Torque doesn't lie. Come get muddy.\"","\"Meet us where it's wet. Bring a spare.\""],
    won:["Tidewater took the win and left a mud-caked trophy on your doorstep.","Tidewater Diesel & Marine beat you and towed the trophy home behind a boat."],
    lost:["Tidewater lost to you and sent a case of coolant as a \"gift\".","You beat Tidewater Diesel & Marine. The foreman asked what you were running. You did not say."]}];
/* tuning (round 6): a rival used to stop at 1800 while your rep has no ceiling, so the board was dead by about week 100 (a good shop is #1 by week 5 and 4x the field by week 80).
   Now a rival's weekly gain is (RIV_GAIN[0] + rep * RIV_GAIN[1]) * pace * noise; behind you it multiplies by 1 + min(RIV_CATCH[1], gap * RIV_CATCH[0]), ahead of you it eases off to RIV_EASE at the least,
   so the three shops hold roughly 60-100% of a good player's rep all career instead of falling away. The ceiling only stops a runaway. */
const RIV_MAX=40000,RIV_GAIN=[2,0.005],RIV_CATCH=[2,6],RIV_EASE=0.25;
const RIV_WIN_TIER=5,RIV_LOSE_PCT=0.3,RIV_PURSE_CAP=40000,RIV_FLIP=0.03;   // stakes grow with tier and rep (they were a flat +3..13 rep, -2 rep and $2,500 at any size of shop); a rival passes you only by a 3% margin so the log doesn't chatter
const rivTier=r=>{let i=0;for(let j=0;j<REP_TIERS.length;j++)if(r>=REP_TIERS[j][0])i=j;return i;};
function rivS(){const c=C();const s=c.riv&&typeof c.riv==="object"?c.riv:(c.riv={});
  if(!s.r||typeof s.r!=="object")s.r={};if(!s.pos||typeof s.pos!=="object")s.pos={};if(!s.tier||typeof s.tier!=="object")s.tier={};
  if(!s.hist||typeof s.hist!=="object")s.hist={};for(const k of ["won","lost","declined","forfeit"])s.hist[k]=+s.hist[k]||0;
  if(!s.seed)s.seed=((c.seed||1)^0x2c9277b5)>>>0||11;if(!(s.cool>=0))s.cool=0;
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
    else if(p===-1&&pl>=r+mg){s.pos[v.id]=1;logEvent(rivPick(v.down),"good");toastAfter(`You passed ${v.name}`);}}}
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
      logEvent(`You never showed for ${v.name}'s challenge — −${ch.lose} rep. ${rivPick(v.won)}`,"bad");toastAfter(`Challenge forfeited · −${ch.lose} rep`);s.ch=null;s.cool=3;}}
  else if(s.cool>0)s.cool--;
  else if(c.rep>=30&&rivRng()<0.45)rivIssue();
  rivalsPos();}
function rivEvOpen(ev){try{return evStatus(RIV_EV[ev]).k!=="lock";}catch(e){return false;}}
function rivIssue(){const s=rivS(),c=C(),pl=c.rep;
  const cand=RIVALS.map(v=>({v,evs:v.evs.filter(rivEvOpen)})).filter(x=>x.evs.length);if(!cand.length)return;
  // lean toward a rival who is close to you in the table
  const w=cand.map(x=>1/(0.4+Math.abs(Math.log((s.r[x.v.id]+10)/(pl+10)))));let t=w.reduce((a,b)=>a+b,0)*rivRng(),i=0;while(i<w.length-1&&t>w[i]){t-=w[i];i++;}
  const v=cand[i].v,ev=rivPick(cand[i].evs),tier=repTierIdx(),ahead=s.r[v.id]>pl;
  const need=ev==="drag"||ahead?"win":"podium";
  const win=Math.round((3+tier*RIV_WIN_TIER)*(need==="win"?1.3:1)),purse=Math.min(RIV_PURSE_CAP,Math.round((150+pl*7)/50)*50);
  s.ch={id:Math.floor(rivRng()*1e9),rv:v.id,ev,need,st:"offer",wk:c.week,exp:c.week+2,win,lose:Math.max(2,Math.round(win*RIV_LOSE_PCT)),purse};
  logEvent(`${v.name} challenges you at ${RIV_EV_TXT[ev]} — see Market`,"");toastAfter(`${v.name} wants a head-to-head`);}
/* a result in the field: the open challenge, if it is on and about this event */
function rivalsEvent(kind,o){const s=rivS(),ch=s.ch;if(!ch||ch.st!=="on"||ch.ev!==kind)return;
  if(kind==="drag"){const d=S.last&&S.last.res&&S.last.res.drag;if(!(d&&d.race)||(typeof DR!=="undefined"&&DR&&DR.night))return;}   // a heads-up pass only: not a solo pass, not race night
  const v=RIVALS.find(x=>x.id===ch.rv),c=C();const won=ch.need==="win"?!!o.win:!!(o.win||o.finish);s.ch=null;s.cool=3;
  if(won){s.hist.won++;if(!s.hist.beat||typeof s.hist.beat!=="object")s.hist.beat={};s.hist.beat[v.id]=(s.hist.beat[v.id]||0)+1;c.rep+=ch.win;c.cash+=ch.purse;s.r[v.id]=Math.max(0,s.r[v.id]-Math.max(3,s.r[v.id]*0.04));
    logEvent(`Head-to-head beat ${v.name} at ${RIV_EV_TXT[ch.ev]} — ${fmt$(ch.purse)} side bet, +${ch.win} rep. ${rivPick(v.lost)}`,"good");toastAfter(`BEAT ${v.name.toUpperCase()} · +${ch.win} REP · ${fmt$(ch.purse)}`);}
  else{s.hist.lost++;c.rep=Math.max(0,c.rep-ch.lose);s.r[v.id]=Math.min(RIV_MAX,s.r[v.id]+Math.max(2,s.r[v.id]*0.02));
    logEvent(`Head-to-head lost to ${v.name} at ${RIV_EV_TXT[ch.ev]} — −${ch.lose} rep. ${rivPick(v.won)}`,"bad");toastAfter(`${v.name} won the head-to-head · −${ch.lose} rep`);}
  rivalsPos();}
function rivalsRender(){let sec=$("rivSec");
  if(!career()){if(sec)sec.hidden=true;return;}
  if(!sec){const anchor=document.querySelector("#marketBox details.sfold");if(!anchor)return;
    sec=document.createElement("div");sec.className="sec";sec.id="rivSec";sec.innerHTML=`<h2>Rival shops <span class="cnt" id="rivCnt"></span></h2><div id="rivBox"></div>`;anchor.parentNode.insertBefore(sec,anchor);
    sec.addEventListener("click",rivClick);}
  const s=rivS(),pl=C().rep;sec.hidden=pl<10&&!s.ch;if(sec.hidden)return;
  const rows=RIVALS.map(v=>({v,r:Math.round(s.r[v.id])})).concat([{v:null,r:pl}]).sort((a,b)=>b.r-a.r||(a.v?1:-1));
  const me=rows.findIndex(x=>!x.v)+1;$("rivCnt").textContent=`you are #${me} of ${rows.length}`;
  const h=s.hist;const board=rows.map((x,i)=>x.v
    ?`<div class="rvrow"><b class="rvn">${i+1}</b><span class="rvnm"><b>${x.v.name}</b><i>${REP_TIERS[rivTier(x.r)][1]} · ${x.v.town}</i></span><span class="rvp">${x.r}</span></div>`
    :`<div class="rvrow you"><b class="rvn">${i+1}</b><span class="rvnm"><b>Your shop</b><i>${repTier()[1]}</i></span><span class="rvp">${x.r}</span></div>`).join("");
  const near=RIVALS.slice().sort((a,b)=>Math.abs(s.r[a.id]-pl)-Math.abs(s.r[b.id]-pl))[0];
  const ch=s.ch;let card="";
  if(ch){const v=RIVALS.find(x=>x.id===ch.rv),on=ch.st==="on";
    card=`<div class="card rvch"><div class="client">${on?"Challenge accepted":"Challenge"} · ${v.name}<em class="ctag">Head-to-head</em></div><h3>${ch.ev==="drag"?"Heads-up pass at the strip":"Beat them at "+RIV_EV_TXT[ch.ev]}<span>${on?"run it by wk "+ch.exp:"answer by wk "+ch.exp}</span></h3>
      <p class="cnote">${on?v.tag:rivPick(v.chal)}</p>
      <div class="money"><div><b class="pos">+${ch.win}</b><span>rep if you win</span></div><div><b class="pos">${fmt$(ch.purse)}</b><span>side bet</span></div><div><b class="neg">−${ch.lose}</b><span>rep if you lose</span></div></div>
      <div class="cstat off">${ch.need==="win"?"Win it outright":"Finish on the podium (top three)"}${ch.ev==="drag"?" in a heads-up pass (Events · Drag strip · race the other lane)":""}. Solo runs and race nights don't count.</div>
      ${on?`<button class="btn pri" data-rvgo="${ch.ev}">${RIV_EV_BTN[ch.ev]} ›</button>`:`<div class="rvbtns"><button class="btn pri" data-rvacc="1">Accept</button><button class="btn ghost" data-rvno="1">Turn it down</button></div>`}</div>`;}
  $("rivBox").innerHTML=`<div class="rvboard">${board}</div><p class="hint rvhint">${near.name}: ${near.tag}</p>${card}<p class="hint rvhint">Head-to-heads: ${h.won} won · ${h.lost} lost${h.declined?" · "+h.declined+" turned down":""}. A rival throws down every few weeks once you are past 30 rep.</p>`;}
function rivClick(e){const s=rivS(),ch=s.ch;
  const go=e.target.closest("[data-rvgo]");if(go){if(!ch||ch.st!=="on")return;evGo(RIV_EV[ch.ev],ch.ev==="drag"?{race:"heads"}:{});return;}
  if(!ch)return;const v=RIVALS.find(x=>x.id===ch.rv);
  if(e.target.closest("[data-rvacc]")){ch.st="on";ch.exp=C().week+3;logEvent(`Accepted ${v.name}'s challenge at ${RIV_EV_TXT[ch.ev]} — run it by week ${ch.exp}`,"");save();renderShop();toast(`CHALLENGE ON · ${v.name.toUpperCase()}`);buzz(20);return;}
  if(e.target.closest("[data-rvno]")){s.hist.declined++;s.ch=null;s.cool=3;logEvent(`Turned down ${v.name}. They'll tell people.`,"");save();renderShop();}}
