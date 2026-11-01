/* ===================== TEAM SEASONS (career, since 1.76.33; the Pit Crew mode of 1.76.31-32 folded in) =====================
   The career shop is the engine supplier for one race team a season. Each season up to three teams call with an offer: a
   driver with a racing style, one series for the whole season (the drags: street, gasser, outlaw radial, pro stock, pro mod,
   funny car, top dragster; or the oval: Street Stock, Late Model, Open on clay or paved), a parts budget and a season fee.
   A series calls once the shop's rep reaches it and its dyno can read the power the field makes. The team's budget pays for
   the engine: the first build, then every engine change (a teardown charge plus any parts that cost more), freshen-up and
   rebuild after a breakage. The fee is the shop's: a retainer for each round raced, a bonus for a podium, a bigger one for
   the championship. Each round has its own weather (pcWx: the calendar, then the day; the drags visit a different strip),
   and after round 4 a mid-season beat sets up round 5 (pcMidPick). A round runs every other week (T.due): race it from the Team tab once it is due, or Close week races
   it with the season engine as it stands (a broken or missing engine sits it out). Race day is auto-simulated: SIM.dragPass
   in the team's car against the series' seven rival teams on a heads-up ladder, or SIM.ovalPass in a 25-lap feature
   against the eleven oval regulars. Every car scores points; the field finds a little more every round. After round 8 the
   championship pays its bonus and rep, and a top-two finish brings the same team back with 20% more money.
   Career rules: parts the shop hasn't unlocked can't be fitted, and a new engine needs a clean, certified pull (C().cert).
   Race morning (since 1.76.45): the team runs the Safe, Race or Hero map (PC_MAPS, T.map), a few % of power traded for
   reliability and wear. A season allows PC_ENGINES engines (the first build, every change, every rebuild after a breakage;
   a freshen-up is the same engine): the one past that starts the round from the back.
   Each kind of series (drag, oval, and the ones added since) plugs in through PC_KIND: its offer fields, its rivals, its
   venue and conditions, its rules, its race day and its points. A new kind is one entry there plus its PC_EVENTS rows.
   State: C().pc (pcS() fills it). Markup: #mkTeam in the Team tab (html/body.html); styles in css/ui-team.css. */
/* the series. rep: opens at this career rep. budget: the engine-size range (raised 15% and x1.5 for a season's upkeep);
   the drag field's power is budget/hpPer (12 unless set: the entry series is gentler). pay: the season fee range (the shop's money). tier: rep and pay scale */
const PC_EVENTS={
  street:{ev:"drag",body:"street",n:"Street drags",tier:0,rep:0,budget:[2500,4800],pay:[60000,80000],hpPer:16,tip:"Street tyres: much past 550 hp only spins them."},
  ostreet:{ev:"oval",cls:"street",n:"Street Stock oval",tier:0,rep:0,budget:[3000,6000],pay:[60000,80000]},
  gasser:{ev:"drag",body:"gasser",n:"Gasser drags",tier:1,rep:40,budget:[4000,9000],pay:[130000,170000],tip:"Short and nose-high on slicks; hooks up to about 1,000 hp."},
  olate:{ev:"oval",cls:"late",n:"Late Model oval",tier:1,rep:40,budget:[6000,10000],pay:[130000,170000]},
  outlaw:{ev:"drag",body:"outlaw",n:"Outlaw radial",tier:2,rep:120,budget:[7000,15000],pay:[280000,360000],tip:"Radials and a chute; takes 1,500 hp and more."},
  prostock:{ev:"drag",body:"prostock",n:"Pro stock",tier:2,rep:120,budget:[10000,18000],pay:[300000,380000],na:true,hpPer:18,tip:"No boost, no nitrous: the class is naturally aspirated."},
  oopen:{ev:"oval",cls:"open",n:"Open oval",tier:2,rep:120,budget:[9000,16000],pay:[280000,360000]},
  promod:{ev:"drag",body:"promod",n:"Pro mod",tier:3,rep:300,budget:[16000,36000],pay:[600000,780000],tip:"Big slicks and anything goes: it takes 2,000 hp to win."},
  funny:{ev:"drag",body:"funny",n:"Funny car",tier:4,rep:700,budget:[36000,54000],pay:[1200000,1600000],tip:"A short chassis and a flip-up body on huge slicks: blown alcohol makes 3,000 hp and up."},
  rail:{ev:"drag",body:"rail",n:"Top dragster",tier:5,rep:1500,budget:[60000,96000],pay:[2400000,3200000],hpPer:14,tip:"The long rail and the big wing: the most power the strip has ever seen."}};
/* styles: rel the reliability the driver asks for; skill the range drawn at the offer; wear on the engine per round;
   winK on the win and title bonus; learn the skill a rookie gains each round raced (up to cap); payK on the season fee */
const PC_STYLES={
  steady:{n:"Steady hand",d:"Smooth and consistent. Wants an engine that lasts.",rel:85,skill:[0.68,0.84],wear:0.8},
  hotshoe:{n:"Hot shoe",d:"Quick on the tree and flat out in the turns, and hard on parts.",skill:[0.76,0.95],wear:1.7},
  rookie:{n:"Rookie",d:"Still learning, so a mistake shouldn't cost an engine. Quicker every round, and the team pays 15% more for the gamble.",rel:80,skill:[0.4,0.6],wear:1.1,learn:0.03,cap:0.88,payK:1.15},
  veteran:{n:"Veteran",d:"Has seen it all, and pays a bigger bonus for a win.",skill:[0.8,0.95],wear:1,winK:1.5}};
const PC_FIRST=["Dale","Marie","Tyler","Wes","Kim","Rhett","Jo","Sam","Lena","Cody","Ana","Reggie","Bo","Nora","Gus","Priya","Hank","Della","Arlo","June","Merle","Tess","Colt","Faye"];
const PC_LAST=["Kowalchuk","Lavoie","Sorensen","Bouchard","Nakamura","Dyck","Fehr","Okafor","Penner","Gauthier","Petrova","Thiessen","Lindqvist","Wiebe","Halvorsen","Sandhu","Friesen","Boychuk","Morin","Klassen","Yellowhorn","Strand","Ostrowski","Dubois"];
const PC_TEAM=["Racing","Motorsports","Speed Shop","Race Team","Performance","Garage","Competition"];
/* the season: 8 rounds, one every PC_GAP weeks, and up to 3 offers that stay open PC_OPEN weeks. A team's budget is the
   engine-size money (the series' range, raised 15%) times PC_SEASON, so about a third is left for upkeep after a build of
   that size. An engine change costs PC_TEAR of the new build plus any parts that cost more; a freshen-up PC_FRESH of the
   engine and a rebuild after a breakage PC_FIX (the Tooling hall takes 25% off changes and rebuilds). Each round takes
   PC_WEAR reliability points times the style's wear (the Quality lab takes 30% off). */
const PC_ROUNDS=8,PC_GAP=2,PC_OFFERS=3,PC_OPEN=4,PC_RAISE=1.15,PC_SEASON=1.5,PC_TEAR=0.15,PC_FRESH=0.15,PC_FIX=0.3,PC_WEAR=4,PC_FIELD_UP=0.015;
const PC_PTS_DRAG={1:20,2:14,3:9,5:4,9:0},PC_PTS_OVAL=[20,16,13,11,9,8,7,6,5,4,3,2];
/* race morning (since 1.76.45): the map the team runs. k on the engine's torque (so its power), rel added to its reliability
   on the day, wear on the round's wear. like: the style that drives it best, sk the skill it adds there (a style it doesn't
   suit gives the same back: a hot shoe bored on Safe, a steady hand nervous on Hero) */
const PC_MAPS={safe:{n:"Safe",k:0.97,rel:6,wear:0.7,d:"Retarded a touch and rich: 3% down on power, easier on the parts."},
  race:{n:"Race",k:1,rel:0,wear:1,d:"The map it was certified on."},
  hero:{n:"Hero",k:1.04,rel:-8,wear:1.5,d:"Everything turned up: 4% more power, harder on everything."}};
const PC_MAP_LIKE={steady:"safe",hotshoe:"hero",rookie:"safe"},PC_MAP_SK=0.03;
/* the engines a season allows: the first build, a change and a rebuild after a breakage each use one (a freshen-up doesn't);
   the round a fourth goes in, the team starts from the back */
const PC_ENGINES=3;
/* the shop's pay, as shares of the season fee: a retainer each round raced, a bonus for a top-three round, a bigger one for
   the championship. Rep per round and for the title is scaled by the series tier (PC_REPK). */
const PC_RETAIN=0.04,PC_RBONUS=[0.08,0.04,0.02],PC_CBONUS=[0.25,0.12,0.06],PC_CREP=[15,9,5],PC_REPK=[1,1.5,2.5,4,6,9];
function pcFresh(){return{v:3,season:1,seed:Math.floor(Math.random()*1e9)+1,nid:1,offers:[],team:null,last:null,raced:0,wins:0,podiums:0,titles:0,seasons:0,backs:0,clean:0,earned:0,nitro:0};}
const pcOkT=T=>!!T&&typeof T==="object"&&!!PC_EVENTS[T.ev]&&!!PC_STYLES[T.style]&&T.budget>0&&T.pay>0;
/* C().pc, made whole: a new career, or a damaged save, gets the missing pieces */
function pcS(){const c=C();if(!c.pc||typeof c.pc!=="object"||c.pc.v!==3)c.pc=pcFresh();const p=c.pc,f=pcFresh();
  for(const k in f)if(typeof f[k]==="number"&&(typeof p[k]!=="number"||!isFinite(p[k])))p[k]=f[k];
  if(!Array.isArray(p.offers))p.offers=[];if(!p.offers.every(pcOkT))p.offers=p.offers.filter(pcOkT);
  delete p.log;   // the Race log fold went in 1.76.34: the team card's round list and the ledger carry it
  if(p.team!=null){const T=p.team;if(!pcOkT(T)||!Array.isArray(T.rivals)||typeof T.round!=="number")p.team=null;
    else{for(const k of ["spent","pts","wear","cost"])if(typeof T[k]!=="number"||!isFinite(T[k]))T[k]=0;if(!Array.isArray(T.hist))T.hist=[];if(typeof T.due!=="number")T.due=c.week;}}
  return p;}
function pcRand(){const p=pcS();p.seed=(p.seed*1664525+1013904223)>>>0;return p.seed/4294967296;}
function pcTeam(){return career()?pcS().team||null:null;}
const pcFirst=T=>T.name.split(" ")[0];
const pcLeft=T=>Math.max(0,T.budget-T.spent);
const pcRoundSeed=T=>(T.seed+(T.round+1)*104729)>>>0;
const pcRepK=T=>PC_REPK[PC_EVENTS[T.ev].tier]||1;
const pcK=T=>PC_KIND[PC_EVENTS[T.ev].ev];   // the series kind's plug-in (T: a team, an offer, or a PC_EVENTS row's key holder)
/* the power a series' field makes, and whether the shop's dyno can read it: a series only calls once it can */
const pcHpPer=E=>E.hpPer||12;
function pcNeedHp(E){return PC_KIND[E.ev].needHp(E);}
function pcOpen(k){const E=PC_EVENTS[k];return C().rep>=E.rep&&pcNeedHp(E)<=dynoCap().hp*0.9;}
/* what keeps the next series shut: rep, or a dyno that can't read the field */
function pcNextTxt(){const ks=Object.keys(PC_EVENTS).filter(k=>!pcOpen(k));if(!ks.length)return "Every series is calling.";
  const k=ks.sort((a,b)=>PC_EVENTS[a].rep-PC_EVENTS[b].rep)[0],E=PC_EVENTS[k],why=C().rep<E.rep?`${E.rep} rep`:`a dyno that reads ${(Math.ceil(pcNeedHp(E)/0.9/100)*100).toLocaleString()} hp`;
  return `${E.n} calls at ${why}.`;}
/* a contract offer: the series leans to the top of what the shop's rep and dyno have opened */
function pcMake(){const p=pcS(),r=pcRand,pick=a=>a[Math.floor(r()*a.length)];
  const keys=Object.keys(PC_EVENTS).filter(pcOpen);if(!keys.length)keys.push("street");
  const top=Math.max(...keys.map(k=>PC_EVENTS[k].tier)),near=keys.filter(k=>PC_EVENTS[k].tier>=top-1),ek=pick(r()<0.65?near:keys),E=PC_EVENTS[ek];
  const sk=pick(Object.keys(PC_STYLES)),st=PC_STYLES[sk],taken=new Set(p.offers.map(T=>T.name));let name,n=0;
  do{name=pick(PC_FIRST)+" "+pick(PC_LAST);}while(taken.has(name)&&n++<40);
  const f=r(),base=E.budget[0]+(E.budget[1]-E.budget[0])*f,budget=Math.round(base*PC_RAISE*PC_SEASON/500)*500,pay=Math.round((E.pay[0]+(E.pay[1]-E.pay[0])*(0.6*f+0.4*r()))*(st.payK||1)/1000)*1000;
  const T={id:p.nid++,team:pick(PC_LAST)+" "+pick(PC_TEAM),name,style:sk,ev:ek,budget,pay,skill:+(st.skill[0]+(st.skill[1]-st.skill[0])*r()).toFixed(2),seed:Math.floor(r()*1e9)+1,back:false,exp:C().week+PC_OPEN};
  PC_KIND[E.ev].make(T,E,base,r,pick);
  return T;}
/* the Showroom hall brings a fourth team to the table. A passed offer leaves its slot empty until the week closes
   (p.passW, p.passN), so Pass is a choice and not a free reroll. */
function pcRefill(){const p=pcS();if(p.team)return;p.offers=p.offers.filter(T=>!(T.exp<C().week));
  const n=PC_OFFERS+(has("hall")&&!dev()?1:0)-(p.passW===C().week?p.passN:0);while(p.offers.length<n)p.offers.push(pcMake());}
/* sign a contract: the season's rivals are fixed now, so the points table means something. Round 1 is next week. */
function pcSign(T){const p=pcS(),E=PC_EVENTS[T.ev],r=rnRng((T.seed^0x7EA)>>>0);
  const t=Object.assign({},T,{round:0,spent:0,pts:0,wear:0,cost:0,hash:null,cfg:null,broken:false,hist:[],w0:C().week,due:C().week+1,map:"race",engines:0});delete t.exp;
  t.rivals=PC_KIND[E.ev].rivals(t,E,r);
  p.team=t;p.offers=[];if(E.tier>=4)p.nitro++;
  logEvent(`Signed with ${t.team} to supply ${E.n.toLowerCase()} engines: ${fmt$(t.budget)} parts budget, ${fmt$(t.pay)} season fee`,"good");achCheck({type:"team"});return t;}
/* race-day weather (since 1.76.35). The calendar sets the mean: career week 1 is early May, July is warmest (about 21 °C)
   and the mean never drops under 5 °C (the winter rounds run down south). Each round draws its own day around it, and the
   drags visit a different strip each round (PC_STRIPS, by altitude). The team card shows the forecast; race day lands
   within a couple of degrees of it. The field's power moves with the air, as density^PC_AIR_K: an atmospheric engine
   feels the air a little more than that and a blown one less, so the tune matters round to round. */
const PC_STRIPS=[{n:"Lakeshore Dragway",alt:180},{n:"Gopher Valley Dragway",alt:420},{n:"Prairie Sky Motorplex",alt:600},{n:"Red Butte Strip",alt:760},{n:"Coulee Raceway",alt:1050},{n:"Bow River Raceway",alt:1100}];
const PC_MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"],PC_AIR_K=0.8;
const pcWoy=w=>((w-1)+18)%52;
function pcRho(t,h,alt){const T=t+273.15,p=101325*Math.pow(1-2.25577e-5*alt,5.25588),pv=h/100*611.21*Math.exp((18.678-t/234.5)*(t/(257.14+t)));return(p-pv)/(287.05*T)+pv/(461.5*T);}
/* the weather for the team's next (or current) round, on race week T.due. day: race day itself, not the forecast */
function pcWx(T,day){const K=pcK(T),woy=pcWoy(T.due),c=Math.cos(2*Math.PI*(woy-28.5)/52),rs=pcRoundSeed(T),r=rnRng((rs^0x3A7E)>>>0);
  let t=Math.max(5,4+17*c)+rnGauss(r)*5,h=45+12*c+rnGauss(r)*15;const st=K.site?K.site(T,r):null;   // the venue: a strip, a hill; null for a series with one home
  if(day){const d=rnRng((rs^0x0DA7)>>>0);t+=rnGauss(d)*1.5;h+=rnGauss(d)*6;}
  t=Math.round(Math.min(38,Math.max(-2,t)));h=Math.round(Math.min(92,Math.max(12,h)));const alt=st?st.alt:500;
  const W={t,h,alt,strip:st?st.n:"",site:st,mon:PC_MONTHS[Math.floor(woy*12/52)],k:Math.pow(pcRho(t,h,alt)/pcRho(20,40,500),PC_AIR_K)};
  if(K.cond)K.cond(T,W,rnRng((rs^0xC0D)>>>0),day);   // the kind's own conditions for the round (mud, water, track moisture), on their own stream
  return W;}
const pcWxEnv=W=>({ambientC:W.t,humidity:W.h,altitudeM:W.alt});
function pcWxTxt(W,fc,T){const d=Math.round((W.k-1)*100),feel=W.k<0.96?"thin air":W.k>1.04?"cool, dense air":W.t>=30?"a hot one":"",fld=Math.abs(d)>=2?`the field ${fc?"will be":"was"} ${d>0?"up":"down"} about ${Math.abs(d)}% on power`:"";
  const K=T?pcK(T):null,more=K&&K.condTxt?K.condTxt(W,fc):"";
  return`${W.strip?`${W.strip} (${W.alt.toLocaleString()} m), `:""}${W.t} °C, ${W.h}% humidity${feel||fld?": "+[feel,fld].filter(Boolean).join(", "):""}${more?`. ${more}`:""}`;}
/* the mid-season beat (since 1.76.35): after round 4 the season throws in something for round 5. showcase: double points
   and double the round bonus, for everyone. away (oval only): round 5 visits the other surface. ask: the driver wants
   something (by style); deliver it and the team pays PC_ASK of the season fee and rep, ignore it and lose a little rep. */
const PC_MID_RD=4,PC_ASK=0.1;
const PC_ASKS={steady:{t:"wants the engine at 90% reliability or better on race day"},hotshoe:{t:"wants more power: 5% over the season engine"},
  rookie:{t:"wants a fresh engine for the big one: freshen it up or build new"},veteran:{t:"says the team needs a podium this round"}};
function pcMidPick(T){const r=rnRng((T.seed^0x1D5E)>>>0),ks=["showcase","ask","ask"].concat(pcK(T).mids||[]);return ks[Math.floor(r()*ks.length)];}
const pcMidOn=T=>!!T.mid&&T.round===PC_MID_RD;
const pcTk=T=>pcMidOn(T)&&T.mid==="away"?(T.track==="clay"?"paved":"clay"):T.track;
function pcMidTxt(T){const nm=pcFirst(T);if(T.mid==="showcase")return"It's the series' mid-season showcase: double points for every car, and double the round bonus.";
  if(T.mid==="away")return`The series visits ${SIM.ovalTrack(pcTk(T)).n} for one round: a different surface, the same engine.`;
  return`${nm} ${PC_ASKS[T.style].t}. Deliver and the team pays ${fmt$(Math.round(T.pay*PC_ASK/50)*50)}.`;}
/* whether the driver's ask is met: steady and rookie by the engine going in, hot shoe by its power, veteran by the result */
function pcAskMet(T,o){if(T.style==="steady")return o.rel>=90;if(T.style==="hotshoe")return!!T.hp&&o.hp>=T.askHp;if(T.style==="rookie")return o.wear0===0;return o.podium;}
/* the engine's place in the field on power, for an offer or the season card */
function pcRead(T){const E=PC_EVENTS[T.ev],cert=C().cert,ok=!!(cert&&cert.ok&&cert.hash===cfgHash(S.cfg)),res=ok?cert.res:quick;if(!res)return"";
  const hp=Math.round(res.peakHp),{lo,hi}=pcK(T).range(T,E);
  const where=hp<lo*0.9?"well off the pace":hp<(lo+hi)/2*0.97?"near the back":hp<hi?"mid-pack":"up front";let but="";
  if(E.na&&!pcIsNA(S.cfg))but=", but it's blown or on nitrous, and the class is naturally aspirated";
  else but=pcK(T).but(T,E,res,hp)||"";
  return`Your ${ok?"certified":"uncertified"} ${hp.toLocaleString()} hp ${esc(engineName())} would run ${where} on power${but}.`;}
function pcIsNA(c){return c.asp==="na"&&(c.nitrous||"none")==="none";}
const pcToolK=()=>has("tool")&&!dev()?0.75:1;
/* what this build costs the season: the first build in full; a different build a teardown plus any parts that cost more;
   the season engine again costs nothing, or a rebuild if it broke */
function pcNeed(T,cost){const same=T.hash!=null&&T.hash===cfgHash(S.cfg);
  if(same)return T.broken?{kind:"fix",need:Math.round(T.cost*PC_FIX*pcToolK())}:{kind:"none",need:0};
  if(T.hash==null)return{kind:"build",need:cost};
  return{kind:"change",need:Math.round((cost*PC_TEAR+Math.max(0,cost-T.cost))*pcToolK())};}
/* what stands between this build and race day: a certified pull of a new build, the money left, the class rules, what the style asks for */
function pcChecks(T){const E=PC_EVENTS[T.ev],st=PC_STYLES[T.style],h=cfgHash(S.cfg),same=T.hash!=null&&T.hash===h,cert=C().cert,certOk=!!(cert&&cert.ok&&cert.hash===h),o=[];
  const res=certOk?cert.res:quick;
  if(!res)return{ok:false,o:[{ok:false,t:"Certify this exact build on the dyno (Test tab)"}],res:null,cost:0,need:0,kind:"build"};
  const cost=Math.round(res.cost),nd=pcNeed(T,cost),left=pcLeft(T);
  if(!same)o.push({ok:certOk,t:certOk?"Certified on the dyno":cert&&cert.hash===h&&cert.why?`Not certified: ${cert.why}`:"Certify this exact build on the dyno (Test tab)"});
  if(nd.kind==="build")o.push({ok:nd.need<=left,t:`The build: parts ${fmt$(cost)} of ${fmt$(left)}${cost>left?` (${fmt$(cost-left)} over)`:""}`});
  else if(nd.kind==="change")o.push({ok:nd.need<=left,t:`Engine change: ${fmt$(nd.need)} of ${fmt$(left)} left${nd.need>left?` (${fmt$(nd.need-left)} short)`:""}`});
  else if(nd.kind==="fix")o.push({ok:nd.need<=left,t:`Rebuild after the breakage: ${fmt$(nd.need)} of ${fmt$(left)} left`});
  else o.push({ok:true,t:`The season engine${T.wear>0?`, worn: reliability −${Math.round(T.wear)}%`:", fresh"}`});
  if(nd.kind!=="none"){const n=(T.engines||0)+1;o.push({ok:true,wn:n>PC_ENGINES,t:n>PC_ENGINES?`Engine ${n}: the season allows ${PC_ENGINES}, so it starts this round from the back`:`Engine ${n} of the ${PC_ENGINES} the season allows`});}
  for(const x of pcK(T).rules(T,E,res))o.push(x);
  if(E.na)o.push({ok:pcIsNA(S.cfg),t:"Naturally aspirated, no nitrous"});
  if(st.rel)o.push({ok:Math.round(res.rel)>=st.rel,t:`Reliability ${Math.round(res.rel)}% (wants ${st.rel}%)`});
  return{ok:o.every(x=>x.ok),o,res,cost,need:nd.need,kind:nd.kind};}
/* race day on the strip: the team's car with your engine (cfg) against the series' seven rivals (their power grows a little
   each round), then qualifying and an 8-car heads-up ladder (rnJudge, rnPairs: the race-night rules), run to the end so every
   car scores. Your car's pass is the real SIM.dragPass each round, so a launch, a manifold or a turbo can let go; on top of
   that the engine's reliability (less its wear) and the driver's style make a chance it breaks on any pass. sat: sitting out.
   o: the morning's call, {M: the map, sk: the driver's skill on it, back: a fresh engine past the allowance, seeded last} */
const pcMap=T=>PC_MAPS[T.map]||PC_MAPS.race;
function pcMapSk(T){const like=PC_MAP_LIKE[T.style],m=T.map||"race";if(!like||m==="race")return 0;return m===like?PC_MAP_SK:-PC_MAP_SK;}
/* the map on the engine: its torque (so its power) and its reliability for the day */
function pcMapRes(res,M){if(M.k!==1){for(const a of ["torque","naTorque","power","n2oTq"])if(Array.isArray(res[a]))res[a]=res[a].map(v=>v*M.k);res.peakHp*=M.k;res.peakTq*=M.k;}
  res.rel=Math.max(0,Math.min(100,res.rel+M.rel));return res;}
function pcDragDay(T,sat,cfg,o){const E=PC_EVENTS[T.ev],st=PC_STYLES[T.style],rs=pcRoundSeed(T),r=rnRng((rs^0x5EED)>>>0),W=pcWx(T,true),env=Object.assign({},S.env,stdCell(),pcWxEnv(W)),up=(1+PC_FIELD_UP*T.round)*W.k;
  const res=pcMapRes(SIM.dragPrep(cfg,env),o.M),rel=Math.max(0,res.rel-T.wear),sk=o.sk,car=Object.assign(carVeh({body:E.body}),{redline:cfg.redline,auto:true,holdTime:1.0});car.mass=SIM.dragMass(car.mass,res.kg);car.tyreTemp=car.tyre==="street"?0.3:0.8;
  const field=T.rivals.map((rv,i)=>{const hp=Math.round(T.fieldHp*rv.k*up*(0.97+0.06*r())),ai=SIM.ovalAiRes(hp,(rs+i*7919)>>>0);
    const v=Object.assign(carVeh({body:E.body}),{redline:ai.redline,auto:true,noFail:true,holdTime:1.0});v.mass=SIM.dragMass(v.mass,ai.kg);v.tyreTemp=v.tyre==="street"?0.3:0.8;
    let q=null;try{q=SIM.dragPass(ai,v);}catch(e){}
    const lb=v.mass*2.2046,et=q&&q.et?q.et:+Math.min(39,5.825*Math.cbrt(lb/hp)).toFixed(3),mph=q&&q.mph?q.mph:+(234*Math.cbrt(hp/lb)).toFixed(1),sk=rv.sk;
    return{name:rv.n,car:rv.car,hp,mean:et,mph,sd:+(et*(0.003+0.006*(1-sk))).toFixed(3),rt:+(0.035+0.07*(1-sk*0.6-r()*0.4)).toFixed(3),rtSd:+(0.012+0.02*(1-sk)).toFixed(3),brk:+(0.012+0.04*r()).toFixed(3),red:+(0.01+0.035*r()).toFixed(3),dial:null};});
  const haz=(100-rel)/100*0.12*st.wear*pcLuckK(),rtM=0.035+0.07*(1-sk)-(T.style==="hotshoe"?0.012:0),rtSd=0.01+0.02*(1-sk),redK=0.008+0.03*(1-sk)+(T.style==="hotshoe"?0.012:0);
  const mine=()=>{if(sat)return{rt:0.5,et:null,broke:true,why:"Sat out."};let q=null;try{q=SIM.dragPass(res,Object.assign({},car));}catch(e){}
    const rt=r()<redK?-+(0.002+0.03*r()).toFixed(3):+Math.max(0.005,rtM+rnGauss(r)*rtSd).toFixed(3);
    if(!q||q.et==null||q.broke)return{rt,et:null,broke:true,why:q&&q.reasons&&q.reasons[0]?q.reasons[0]:"It didn't make it down the track."};
    if(r()<haz)return{rt,et:null,broke:true,why:`The engine let go${T.wear>8?" (it was due a freshen-up)":res.firstToFail?` (${res.firstToFail.toLowerCase()} was the weak link on the dyno)`:""}.`};
    return{rt,et:+(q.et*(1+rnGauss(r)*(0.002+0.006*(1-sk)))).toFixed(3),mph:q.mph,broke:false};};
  const f3=v=>v==null?"—":v.toFixed(3),rtTxt=v=>v<0?"red light":f3(v).replace(/^0/,"");
  const lines=[`Round ${T.round+1}: ${pcWxTxt(W,false,T)}.`],q0=mine(),Q=[q0].concat(field.map(f=>rnRivalPass(f,r,0))),places=new Array(8).fill(null);
  let out=q0.broke,broke=q0.broke&&!sat,why=sat?"":q0.why,best=q0.et;
  const seeds=[0,1,2,3,4,5,6,7].sort((a,b)=>(Q[a].et==null?99:Q[a].et)-(Q[b].et==null?99:Q[b].et)||a-b);
  if(o.back&&!sat){seeds.splice(seeds.indexOf(0),1);seeds.push(0);}   // the engine past the allowance: seeded last whatever it ran
  const fq=`The field ran ${f3(Math.min(...Q.slice(1).map(x=>x.et||99)))} to ${f3(Math.max(...Q.slice(1).map(x=>x.et||0)))}.`;
  if(sat)lines.push(`Sat this round out. ${fq}`);else if(q0.broke)lines.push(`Qualifying: broke. ${q0.why}`);
  else lines.push(`Qualifying: ${f3(q0.et)} @ ${Math.round(q0.mph)} mph, seeded #${seeds.indexOf(0)+1} of 8${o.back?" (the extra engine starts from the back)":""}. ${fq}`);
  let pairs=rnPairs(seeds).map(([a,b])=>({a,b,win:null}));const RN=["Quarter-final","Semi-final","Final"],LOSE=[5,3,2];
  const solo=rv=>{const pa=rnRivalPass(rv,r,0);return Object.assign({x:pa.broke?402*pa.at:402,dq:false},pa);};
  for(let ri=0;ri<3;ri++){
    for(const m of pairs){
      if(m.a!==0&&m.b!==0){const j=rnJudge(solo(field[m.a-1]),solo(field[m.b-1]),false);m.win=j.w===0?m.a:m.b;}
      else{const oi=m.a===0?m.b:m.a,rv=field[oi-1];
        if(out){m.win=oi;if(!q0.broke)lines.push(`${RN[ri]} vs ${rv.name}: couldn't make the call, the engine was finished.`);}
        else{const me=mine(),op=solo(rv),j=rnJudge(Object.assign({x:me.broke?200:402,dq:false},me),op,false),won=j.w===0;
          if(me.et!=null)best=Math.min(best,me.et);
          const how=j.why==="red"?(me.rt<0?"red light":"they red-lit"):j.why==="dnf"||j.why==="dnf2"?(me.broke?"broke":"they broke"):`${rtTxt(me.rt)} / ${f3(me.et)} against ${rtTxt(op.rt)} / ${f3(op.et)}${j.holeshot?" (holeshot)":""}`;
          lines.push(`${RN[ri]} vs ${rv.name}: ${won?"won":"lost"}, ${how}.`);m.win=won?0:oi;
          if(me.broke){broke=true;out=true;why=me.why;lines.push(me.why);}}}
      places[m.win===m.a?m.b:m.a]=LOSE[ri];}
    if(ri<2)pairs=rnNextPairs(pairs);else places[pairs[0].win]=1;}
  if(q0.broke)places[0]=9;
  return{place:places[0],of:8,broke,why,lines,best,rpos:T.rivals.map((x,i)=>places[i+1]),sat:!!sat,rel};}
/* race day on the oval: the team's driver in the 25-lap feature from a drawn grid spot, against the series' eleven regulars
   (ovalRoster for the season, ovalCarRun for the night, the same cars and sim the oval night uses; their power grows a little
   each round and their luck is drawn fresh). The sim's own failures are on; wear and a hard driver add a worn-out failure. */
function pcOvalDay(T,sat,cfg,o){const E=PC_EVENTS[T.ev],k=E.cls,tk=pcTk(T),st=PC_STYLES[T.style],seed=pcRoundSeed(T),r=rnRng((seed^0x0A1)>>>0),W=pcWx(T,true),env=Object.assign({},S.env,stdCell(),pcWxEnv(W)),up=(1+PC_FIELD_UP*T.round)*W.k;
  const res=pcMapRes(SIM.ovalPrep(cfg,env),o.M),rel=Math.max(0,res.rel-T.wear);
  const roster=ovalRoster(k,T.seed>>>0).map(x=>Object.assign({},x,{hp:Math.round(x.hp*up),res:null,dnfH:false,dnfF:r()<0.08,dnfAt:r()}));
  const ids=roster.map(x=>x.i);if(!sat)ids.push("me");
  for(let i=ids.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
  if(o.back&&!sat){ids.splice(ids.indexOf("me"),1);ids.push("me");}   // the engine past the allowance: last on the grid
  const gm=ids.indexOf("me"),cars=[];ids.forEach((id,g)=>{if(id!=="me")cars.push(ovalCarRun(roster[id],k,seed,"feature",OVAL_FEAT,ovalGridOff(g),OVAL_HEAT,0.6,tk));});cars.forEach(c=>{c.cut=null;});
  const rows=cars.map(c=>c.dnf?{n:c.n,i:c.id,dnf:true,laps:c.cross.filter(x=>x<c.dnf.t).length}:{n:c.n,i:c.id,laps:OVAL_FEAT,time:c.fin});
  let pr=null;
  if(!sat){const L=SIM.ovalTrack(tk).len,veh={cls:k,track:tk,tyre:"med",grille:"mid",finalK:1,redline:cfg.redline,idle:SIM.isDiesel&&SIM.isDiesel(cfg)?720:Math.max(750,cfg.cam>70?1100:850),
      seed:(seed^0xBEEF)>>>0,laps:OVAL_FEAT,off:ovalGridOff(gm),night:SIM.ovalNight(seed,tk),moist:0.6,lap0:OVAL_HEAT};
    veh.gap=(s,t)=>{let g=Infinity;for(const c of cars){const a=ovalAt(c,t);if(!a)continue;const d=(((a.s-s)%L)+L)%L;if(d<g&&d>1.2)g=d;}return g;};
    if(r()<(100-rel)/100*0.3*st.wear*pcLuckK())veh.wornAt=Math.max(3,Math.round(OVAL_FEAT*(0.3+0.6*r())));
    pr=SIM.ovalPass(res,veh,o.sk,0.05).result();const meT=pr.laps.reduce((a,b)=>a+b,0);
    rows.push(pr.finished?{n:pcFirst(T)+" (yours)",me:true,laps:OVAL_FEAT,time:meT}:{n:pcFirst(T)+" (yours)",me:true,dnf:true,laps:pr.lapN||0});}
  rows.sort((a,b)=>(a.dnf?1:0)-(b.dnf?1:0)||b.laps-a.laps||(a.dnf?0:a.time-b.time));
  const order={};rows.forEach((x,i)=>{if(!x.me)order[x.i]=i+1;});
  const lines=[`Round ${T.round+1}: ${pcWxTxt(W,false,T)}.`],top5="Top five: "+rows.slice(0,5).map((x,i)=>`${i+1}. ${x.n}`).join(" · ");
  const rpos=T.rivals.map(x=>order[x.i]);
  if(sat){lines.push(`${SIM.ovalTrack(tk).n}, 25-lap feature. Sat this round out.`);lines.push(top5);return{place:99,of:rows.length+1,broke:false,why:"",lines,best:null,rpos,sat:true,rel};}
  const place=rows.findIndex(x=>x.me)+1,broke=!pr.finished,why=broke?(pr.reasons&&pr.reasons[0])||"The engine let go.":"";
  lines.push(`${SIM.ovalTrack(tk).n}, 25-lap feature. Started P${gm+1} of ${rows.length}${o.back?" (the extra engine starts at the back)":""}${broke?`, out on lap ${(pr.lapN||0)+1}.`:`, finished P${place}.`}`);
  if(pr.best)lines.push(`Best lap ${pr.best.toFixed(2)} s · top ${Math.round(pr.maxKmh/1.609)} mph · ${pr.coolPeak} °C peak coolant.`);
  if(broke)lines.push(why);else if(pr.reasons&&pr.reasons.length)lines.push(pr.reasons[0]);
  lines.push(top5);
  return{place,of:rows.length,broke,why,lines,best:pr.best||null,rpos,sat:false,rel};}
/* the kinds of series. Each entry:
     needHp(E)               the field's power a series needs the shop's dyno to read before it calls
     make(T,E,base,r,pick)   the kind's own fields on a new offer (the drag field's power and car; the oval track and number)
     rivals(T,E,r)           the season's rivals, [{n, pts, ...}], fixed at the signing
     back(n,T)               the kind's fields carried to an asked-back offer
     site(T,r)?              the round's venue {n, alt} (a strip, a hill), drawn on the weather's stream; none: one home
     cond(T,W,r,day)?        the kind's own conditions added to the round's weather W; condTxt(W,fc)? reads them out
     range(T,E)              {lo, hi}: the field's power, for "where the engine would run"
     but(T,E,res,hp)         a class-rule note on that read (", but ..."), or ""
     rules(T,E,res)          the class rules on the race-day checklist, [{ok, t}]
     day(T,sat,cfg,o)        race day: {place, of, broke, why, lines, best, rpos (each rival's place, by index), sat, rel}
     pts(place)              the points for a place; placeTxt(out) the result in a few words
     eff(out)                the place that counts for the podium, bonus and rep (99: nothing)
     fieldTxt(T,E), where(T) the offer card's lines; mids? extra mid-season beats */
const PC_KIND={
  drag:{needHp:E=>E.budget[0]/pcHpPer(E)*0.9,
    make(T,E,base,r,pick){T.fieldHp=Math.round(Math.min(base/pcHpPer(E)*(0.9+0.2*r()),dynoCap().hp*0.9));T.car=pick(RN_CARS[E.body]||RN_CARS.street);},
    rivals(T,E,r){const drv=RN_DRV.filter(n=>n!==T.name),cars=(RN_CARS[E.body]||RN_CARS.street).slice(),ks=[0.86,0.93,0.97,1.0,1.03,1.08,1.15],take=a=>a.splice(Math.floor(r()*a.length),1)[0];
      return ks.map(k=>({n:take(drv),car:take(cars)||E.body,k,sk:+(0.45+0.5*r()).toFixed(2),pts:0}));},
    back(n,T){n.fieldHp=Math.round(Math.min(T.fieldHp*1.12,dynoCap().hp*0.95));n.car=T.car;},
    site:(T,r)=>PC_STRIPS[Math.floor(r()*PC_STRIPS.length)],
    range:T=>({lo:T.fieldHp*0.88,hi:T.fieldHp*1.15}),
    but:(T,E,res,hp)=>E.body==="street"&&hp>600?", though street tyres won't use much of it":"",
    rules:()=>[],
    day:pcDragDay,
    pts:pl=>PC_PTS_DRAG[pl]||0,placeTxt:o=>o.sat?"Sat out":RN_PLACE[o.place]||"Out early",eff:o=>o.sat?99:o.place,
    fieldTxt:T=>`The field makes about ${Math.round(T.fieldHp*0.88/10)*10}–${Math.round(T.fieldHp*1.15/10)*10} hp, and finds a little more every round.`,
    where:T=>esc(T.car)},
  oval:{needHp:E=>SIM.OVAL_CLASSES[E.cls].field.hp*1.1,
    make(T,E,base,r){T.track=r()<0.35?"paved":"clay";T.num=1+Math.floor(r()*98);},
    rivals:(T,E)=>ovalRoster(E.cls,T.seed>>>0).map(x=>({n:x.n,i:x.i,pts:0})),
    back(n,T){n.track=T.track;n.num=T.num;},
    range(T,E){const F=SIM.OVAL_CLASSES[E.cls].field;return{lo:F.hp-F.sd,hi:F.hp+F.sd};},
    but(T,E,res){const C0=SIM.OVAL_CLASSES[E.cls],ci=Math.round(SIM.ovalCi(res));return ci>C0.ci?`, but at ${ci} ci it's over the class's ${C0.ci}`:"";},
    rules(T,E,res){const C0=SIM.OVAL_CLASSES[E.cls],ci=Math.round(SIM.ovalCi(res));return C0.ci<9999?[{ok:ci<=C0.ci,t:`${ci} of ${C0.ci} ci`}]:[];},
    day:pcOvalDay,
    pts:pl=>PC_PTS_OVAL[pl-1]||0,placeTxt:o=>o.sat?"Sat out":o.broke?`DNF (P${o.place} of ${o.of})`:o.place===1?"Won the feature":`P${o.place} of ${o.of}`,eff:o=>o.sat||o.broke?99:o.place,
    fieldTxt(T,E){const C0=SIM.OVAL_CLASSES[E.cls],d=C0.d.replace(/ · /g,", ");return`The field makes about ${C0.field.hp} hp. ${d.charAt(0).toUpperCase()+d.slice(1)}.`;},
    where:T=>`${SIM.ovalTrack(T.track).n} · car #${T.num}`,
    mids:["away"]}};
const pcPlaceTxt=(o,T)=>pcK(T).placeTxt(o);
const pcPts=(T,place)=>pcK(T).pts(place);
/* crew traits on race day (app/crew.js): lucky breaks less often, meticulous wears less, a whisperer's diesel or two-stroke pays more */
const pcLuckK=()=>crewT("lucky")?0.85:1;
const pcWearK=()=>(has("qlab")&&!dev()?0.7:1)*(crewT("meticulous")?0.9:1);
const pcPayK=res=>(career()&&C().prestige&&C().prestige.display?1.03:1)*crewFamK(res);
const pcFreshCost=T=>Math.round(T.cost*PC_FRESH*(crewT("owl")?0.8:1));
/* the series table: you and the rivals, by points (ties: you first, then the order they signed in) */
function pcTable(T){return[{n:pcFirst(T)+" (yours)",pts:T.pts,me:true}].concat(T.rivals.map(x=>({n:x.n,pts:x.pts}))).sort((a,b)=>b.pts-a.pts);}
/* pay day: the retainer and a top-three bonus; points for every car; rep by the finish (more at the bigger series), less for a broken engine */
function pcSettle(T,chk,out,res,auto){const p=pcS(),E=PC_EVENTS[T.ev],st=PC_STYLES[T.style],mult=pcRepK(T),K=pcK(T);
  const pl=K.eff(out),podium=pl<=3?pl-1:null;
  const mid=pcMidOn(T)?T.mid:null,dbl=mid==="showcase"?2:1;
  const pts=out.sat?0:K.pts(out.place)*dbl;T.pts+=pts;
  T.rivals.forEach((x,i)=>{const pos=out.rpos[i];x.pts+=pos?K.pts(pos)*dbl:0;});
  const k=pcPayK(res);let fee=out.sat?0:Math.round(T.pay*PC_RETAIN*k/50)*50;const bonus=podium!=null?Math.round(T.pay*PC_RBONUS[podium]*(pl===1?(st.winK||1):1)*k*dbl/50)*50:0;
  const base=out.sat?0:pl<=3?[4,3,2][pl-1]:pl<=Math.floor(out.of/2)?1:0;let rep=out.broke&&pl!==1?-Math.round(2*mult):Math.round(base*mult);
  if(mid==="ask"){const met=!out.sat&&pcAskMet(T,{rel:out.rel||0,hp:res?res.peakHp:0,wear0:T.wear,podium:podium!=null}),ap=met?Math.round(T.pay*PC_ASK*k/50)*50:0;
    fee+=ap;rep+=met?Math.round(2*mult):-Math.round(mult);out.lines.push(met?`${pcFirst(T)} got what they asked for: ${fmt$(ap)} from the team.`:`${pcFirst(T)} didn't get what they asked for.`);}
  if(!out.sat&&st.learn)T.skill=+Math.min(st.cap||0.9,T.skill+st.learn).toFixed(2);
  C().cash+=fee+bonus;C().rep=Math.max(0,C().rep+rep);p.earned+=fee+bonus;
  if(!out.sat){p.raced++;if(pl===1)p.wins++;if(podium!=null)p.podiums++;T.wear+=PC_WEAR*st.wear*pcMap(T).wear*pcWearK();}
  if(out.broke){T.broken=true;T.breaks=(T.breaks||0)+1;}
  const txt=pcPlaceTxt(out,T),rd=T.round+1;T.hist.push({r:rd,t:txt,pts,k:pl===1?"good":out.broke?"bad":""});
  p.last={team:T.team,name:T.name,ev:T.ev,eng:auto?(T.eng||engineName()):engineName(),round:rd,season:p.season,txt,lines:out.lines,broke:out.broke,spent:chk?chk.need:0,fee,bonus,rep,pts,win:pl===1,auto:!!auto,w:C().week};
  logEvent(`Team round ${rd} (${T.team}, ${E.n.toLowerCase()}): ${txt.toLowerCase()} — ${pts} pts, ${fmt$(fee+bonus)}, ${rep>=0?"+":""}${rep} rep`,pl===1?"good":out.broke?"bad":"");
  if(!out.sat){spEvent("team",{win:pl===1,finish:podium!=null});crewWork("team",{win:pl===1});}
  T.round++;T.due=C().week+PC_GAP;
  if(T.round===PC_MID_RD&&!T.mid){T.mid=pcMidPick(T);if(T.mid==="ask"&&T.style==="hotshoe")T.askHp=Math.round((T.hp||0)*1.05);p.last.mid=pcMidTxt(T);logEvent(`Mid-season, ${T.team}: ${p.last.mid}`,"");}
  if(T.round>=PC_ROUNDS)pcSeasonEnd(T);
  achCheck({type:"team"});checkGoals();}
/* the end of round 8: the championship bonus and rep, then next season's offers (a top-two team asks you back with more money) */
function pcSeasonEnd(T){const p=pcS(),st=PC_STYLES[T.style],mult=pcRepK(T),tab=pcTable(T),pos=tab.findIndex(x=>x.me)+1;
  const bonus=pos<=3?Math.round(T.pay*PC_CBONUS[pos-1]*(pos===1?(st.winK||1):1)*pcPayK(null)/50)*50:0,rep=Math.round((pos<=3?PC_CREP[pos-1]:pos<=tab.length/2?2:0)*mult);
  const clean=!T.breaks&&T.hist.every(h=>h.t!=="Sat out");C().cash+=bonus;C().rep+=rep;p.earned+=bonus;p.seasons++;if(pos===1)p.titles++;if(pos<=2)p.backs++;if(clean)p.clean++;
  if(pos===1)(C().pcTitles=C().pcTitles||[]).push({ev:T.ev,team:T.team,season:p.season,w:C().week});
  p.last.end={pos,of:tab.length,bonus,rep,pts:T.pts,top:tab.slice(0,5),spent:T.spent,budget:T.budget,back:pos<=2,clean};
  logEvent(`Season ${p.season} with ${T.team}: ${pos===1?"CHAMPIONS":"P"+pos+" of "+tab.length} — ${fmt$(bonus)} title bonus, +${rep} rep`,pos===1?"good":"");
  p.team=null;p.season++;p.offers=[];p.passN=0;
  if(pos<=2){const n={id:p.nid++,team:T.team,name:T.name,style:T.style,ev:T.ev,budget:Math.round(T.budget*1.2/500)*500,pay:Math.round(T.pay*1.2/1000)*1000,skill:T.skill,seed:Math.floor(pcRand()*1e9)+1,back:true,exp:C().week+PC_OPEN};
    pcK(T).back(n,T);p.offers.push(n);}
  pcRefill();}
/* race day: pay for the build (or the change, or the rebuild), then run it. sat: sit the round out with no points.
   auto: Close week ran it, with the season engine as it stands (no new build, no freshen-up). */
function pcRun(T,chk,sat,auto){const cfg=auto?Object.assign({},SIM.DEFAULT_CFG,T.cfg):S.cfg,fresh=!!(chk&&chk.kind!=="none"),undo={spent:T.spent,wear:T.wear,broken:T.broken,engines:T.engines||0};
  if(fresh){T.spent+=chk.need;T.wear=0;T.broken=false;T.engines=(T.engines||0)+1;if(chk.kind!=="fix"){T.hash=cfgHash(S.cfg);T.cost=chk.cost;T.cfg=Object.assign({},S.cfg);T.eng=engineName();}}
  const o={M:pcMap(T),sk:Math.max(0.2,Math.min(0.98,T.skill+pcMapSk(T))),back:fresh&&T.engines>PC_ENGINES};
  let res=null,out;try{res=sat?null:SIM.simulate(cfg,stdEnv({testType:"pull"}));out=pcK(T).day(T,sat,cfg,o);}
  catch(e){console.error(e);if(fresh)Object.assign(T,undo);return false;}
  if(!sat&&T.map&&T.map!=="race")out.lines.splice(1,0,`On the ${pcMap(T).n} map${pcMapSk(T)>0?`: ${pcFirst(T)} loves it`:pcMapSk(T)<0?`: ${pcFirst(T)} isn't happy on it`:""}.`);
  if(res&&(T.hp==null||(chk&&(chk.kind==="build"||chk.kind==="change"))))T.hp=Math.round(res.peakHp);   // the season engine's power, for a hot shoe's ask
  pcSettle(T,chk,out,res,auto);return true;}
function pcRace(sat){const T=pcTeam();if(!T||testing)return;if(C().week<T.due){toast(`Round ${T.round+1} is race week ${T.due}`);return;}
  const chk=sat?null:pcChecks(T);if(chk&&!chk.ok){toast("Not ready: "+(chk.o.find(x=>!x.ok)||{}).t);return;}
  const b=$("pcGo");if(b){b.disabled=true;b.textContent="Race day…";}
  setTimeout(()=>{if(!pcRun(T,chk,sat,false)){toast("Race day was rained out: try again");pcRender();return;}
    save();hud();renderShop();const L=pcS().last;toast(L.end?`SEASON OVER · ${L.end.pos===1?"CHAMPIONS":"P"+L.end.pos}`:`ROUND ${L.round} · ${L.txt.toUpperCase()}`);buzz(L.win||(L.end&&L.end.pos===1)?[30,40,30]:20);
    const c=$("pcLast");if(c&&c.scrollIntoView)c.scrollIntoView({block:"start",behavior:"smooth"});},40);}
/* Close week: a round due this week and not yet raced runs now, with the season engine (or sits out without one) */
function pcDue(){const T=pcTeam();if(!T||C().week<T.due)return "";const ok=T.hash!=null&&!T.broken;
  return ok?`Round ${T.round+1} for ${T.team} is this week. Close the week and race it with the season engine as it stands${T.wear>0?` (worn ${Math.round(T.wear)}%)`:""}?`
    :`Round ${T.round+1} for ${T.team} is this week and ${T.hash==null?"there's no engine built for it":"the engine is broken"}. Close the week and sit it out?`;}
function pcWeek(){const T=pcTeam();if(!T||C().week<T.due)return "";const ok=T.hash!=null&&!T.broken&&T.cfg;
  if(!pcRun(T,null,!ok,true))return "";const L=pcS().last;return L.end?`Season over: ${L.end.pos===1?"champions":"P"+L.end.pos}`:`Round ${L.round}: ${L.txt.toLowerCase()}`;}
/* the weeks Close week can skip to race week: two or more until the round, none due now (career.js closeWeeks) */
function pcSkip(){const T=pcTeam();if(!T)return 0;const n=T.due-C().week;return n>=2?n:0;}
function pcWeekAfter(){if(!career())return;pcRefill();}
/* the Team tab's dot: a round due this week, or teams calling */
function pcWaiting(){if(!career())return "";const p=pcS(),T=p.team;if(T)return C().week>=T.due?`Round ${T.round+1} is due this week`:"";return p.offers.length?`${p.offers.length} team${p.offers.length===1?"":"s"} calling`:"";}
/* the strip at the top of the Team tab: the engine's state for the team, and when the next round is */
function pcStrip(){const T=pcTeam(),cert=C().cert,h=cfgHash(S.cfg),certOk=!!(cert&&cert.ok&&cert.hash===h);
  if(!T)return{cls:certOk?"ok":"none",txt:certOk?"CERTIFIED":"NO CERT",tip:certOk?"Certified on the dyno: it can race the events and go to a team.":"Run a dyno pull in Test to certify this build.",when:"No team",whenTip:"Sign a team below"};
  const c=pcChecks(T),due=C().week>=T.due,wk=T.due-C().week;
  return{cls:c.ok?"ok":c.need>pcLeft(T)?"bad":"none",txt:c.ok?"READY":c.need>pcLeft(T)?"OVER BUDGET":"NOT READY",tip:(c.o.find(x=>!x.ok)||{}).t||"Ready for race day",
    when:due?`R${T.round+1} this week`:`R${T.round+1} in ${wk} wk`,whenTip:`Round ${T.round+1} of ${PC_ROUNDS} · race week ${T.due}`};}
const pcFieldTxt=T=>pcK(T).fieldTxt(T,PC_EVENTS[T.ev]);
const pcWhere=T=>pcK(T).where(T);
function pcOffer(T){const E=PC_EVENTS[T.ev],st=PC_STYLES[T.style],k=pcPayK(null);
  return`<div class="card pcr"><h3>${esc(T.team)}<span>${fmt$(T.pay)} fee</span></h3><div class="client">${esc(T.name)} · ${E.n} · ${pcWhere(T)}${T.back?" · asking you back":""}</div>
    <p class="pcst"><b>${st.n}.</b> ${st.d}${st.rel?` Asks for ${st.rel}% reliability.`:""}</p><p class="hint">${pcFieldTxt(T)}${E.tip?" "+E.tip:""}</p>${pcRead(T)?`<p class="hint pcread" data-nofold>${pcRead(T)}</p>`:""}
    <p class="mkline"><span>Parts budget <b>${fmt$(T.budget)}</b></span><span>A round raced <b>${fmt$(Math.round(T.pay*PC_RETAIN*k/50)*50)}</b></span><span>Title <b>${fmt$(Math.round(T.pay*PC_CBONUS[0]*(st.winK||1)*k/50)*50)}</b></span></p>
    <p class="hint">${PC_ROUNDS} rounds, one every ${PC_GAP} weeks. The budget pays for the engine; the fee is yours, with a bonus for every podium. Offer open till week ${T.exp}.</p>
    <div class="row"><button class="btn sm" data-pcsign="${T.id}">Sign with ${esc(T.team)}</button><button class="btn sm ghost" data-pcpass="${T.id}">Pass</button></div></div>`;}
/* where the driver's ask stands with the engine on the bench (the veteran's podium can't be known till race day) */
function pcMidNow(T,c){if(T.mid!=="ask"||!c.res)return"";const same=T.hash!=null&&T.hash===cfgHash(S.cfg),wear=same?T.wear:0,ok=x=>x?"✓ ":"✗ ";
  if(T.style==="steady"){const r=Math.round(c.res.rel-wear);return`<i>${ok(r>=90)}Now ${r}%${same&&T.wear>0?" with the wear":""}.</i>`;}
  if(T.style==="hotshoe"){const hp=Math.round(c.res.peakHp);return`<i>${ok(hp>=T.askHp)}The bench engine makes ${hp.toLocaleString()} hp of the ${T.askHp.toLocaleString()} wanted.</i>`;}
  if(T.style==="rookie")return`<i>${ok(!same||!T.wear)}${same&&T.wear?"The season engine is worn: freshen it up.":"Fresh."}</i>`;return"";}
function pcTeamCard(T){const E=PC_EVENTS[T.ev],st=PC_STYLES[T.style],c=pcChecks(T),rd=T.round+1,left=pcLeft(T),h=cfgHash(S.cfg),same=T.hash!=null&&T.hash===h,due=C().week>=T.due;
  const fresh=pcFreshCost(T),tab=pcTable(T),pos=tab.findIndex(x=>x.me)+1,W=pcWx(T,false);
  let s=`<div class="card pcr job"><h3>${esc(T.team)}<span>Round ${rd} of ${PC_ROUNDS} · ${due?"this week":`week ${T.due}`}</span></h3><div class="client">${esc(T.name)} · ${E.n} · ${pcWhere(T)}</div>
    <p class="pcst"><b>${st.n}.</b> ${st.d}${st.rel?` Asks for ${st.rel}% reliability.`:""}</p><p class="hint">${pcFieldTxt(T)}${E.tip?" "+E.tip:""}</p>${pcRead(T)?`<p class="hint pcread" data-nofold>${pcRead(T)}</p>`:""}
    <p class="hint pcwx" data-nofold>Round ${rd} forecast, ${W.mon}: ${pcWxTxt(W,true,T)}.</p>${pcMidOn(T)?`<p class="pcmid"><b>Mid-season.</b> ${esc(pcMidTxt(T))}${pcMidNow(T,c)}</p>`:""}
    <div class="pcbud"><div class="pcbar"><i style="width:${Math.min(100,T.spent/T.budget*100).toFixed(1)}%"></i></div><p class="mkline"><span>Budget <b>${fmt$(T.budget)}</b></span><span>Spent <b>${fmt$(T.spent)}</b></span><span>Left <b>${fmt$(left)}</b></span></p></div>`;
  if(T.hash!=null)s+=`<p class="hint">Season engine: ${fmt$(T.cost)} of parts${T.broken?`. <b class="pcbad">Broken in the last round: it needs a ${fmt$(Math.round(T.cost*PC_FIX*pcToolK()))} rebuild.</b>`:T.wear>0?`, reliability down ${Math.round(T.wear)}% from wear. A freshen-up costs ${fmt$(fresh)}.`:", fresh."}${same?"":" The bench has a different build: racing it counts as an engine change."}</p>`;
  else s+=`<p class="hint">Build the engine for the season and certify it on the dyno. Whatever is left of the budget pays for freshen-ups, rebuilds and changes later.</p>`;
  s+=`<div class="pcchk">${c.o.map(x=>`<div class="${x.wn?"wn":x.ok?"ok":"no"}">${x.wn?"!":x.ok?"✓":"✗"} ${esc(x.t)}</div>`).join("")}</div>${pcMapHtml(T)}
    ${due?"":`<p class="hint">Race week ${T.due}: ${T.due-C().week>1?"To race week gets you there in one tap (1 wk closes just one, for the event nights)":"close the week to get there"}. Close week on race week races it with the season engine as it stands.</p>`}
    <div class="row"><button class="btn${c.ok&&due?"":" ghost"}" id="pcGo" ${c.ok&&due?"":"disabled"}>${due?`Race round ${rd}`:`Round ${rd} · week ${T.due}`}</button>`;
  if(same&&!T.broken&&T.wear>0)s+=`<button class="btn sm" data-pcfresh ${fresh>left?"disabled":""}>Freshen up · ${fmt$(fresh)}</button>`;
  if(T.hash!=null&&!same)s+=`<button class="btn sm ghost" data-pcback>Put the season engine back</button>`;
  if(due&&!c.ok)s+=`<button class="btn sm ghost" data-pcsit>Sit out round ${rd}</button>`;
  s+=`<button class="btn sm ghost" data-pcdrop>Walk away</button></div>
    <div class="sec"><h2>Standings <span class="cnt">P${pos} · ${T.pts} pts</span></h2><div class="pctab">${tab.map((x,i)=>`<div class="${x.me?"me":""}"><span>${i+1}</span><span>${esc(x.n)}</span><b>${x.pts}</b></div>`).join("")}</div>
    ${T.hist.length?`<div class="pcl">${T.hist.map(x=>`<div class="${x.k}">R${x.r}: ${esc(x.t)} · ${x.pts} pts</div>`).join("")}</div>`:""}</div>`;
  return s+`</div>`;}
/* race morning: the map for the next round, and how this driver gets on with each */
const PC_MAP_TXT={steady:"drives best on Safe and gets nervous on Hero",hotshoe:"loves Hero and gets bored on Safe",rookie:"is steadier on Safe and out of their depth on Hero",veteran:"has seen it all: any map suits"};
function pcMapHtml(T){const m=PC_MAPS[T.map]?T.map:"race";
  return`<div class="pcmap"><div class="lbl"><span>Race-morning map</span></div><div class="seg n3">${Object.entries(PC_MAPS).map(([k,M])=>`<button data-pcmap="${k}" class="${m===k?"on":""}" aria-pressed="${m===k}">${M.n}<small>${M.k===1?"as certified":`${M.k>1?"+":"−"}${Math.round(Math.abs(M.k-1)*100)}% hp · ${M.rel>0?"+":"−"}${Math.abs(M.rel)} rel`}</small></button>`).join("")}</div>
    <p>${PC_MAPS[m].d} ${esc(pcFirst(T))} ${PC_MAP_TXT[T.style]||""}.${m!=="race"?" Close week races on it too.":""}</p></div>`;}
/* the engine tag over the garage reads the team state ("READY FOR ROUND n"), so a race day, a signing or a walk-out redraws it */
function pcTag(){const t=$("tag");if(t&&quick&&!(document.activeElement&&document.activeElement.id==="nameIn"))t.innerHTML=engineCard(S.cfg,quick,{editable:true});}
function pcRender(){if(!$("mkTeam")||!career())return;const p=pcS();pcRefill();const T=p.team;pcTag();
  $("pcStats").innerHTML=`<span>Season <b>${p.season}</b></span><span><b>${p.raced}</b> raced</span><span><b>${p.wins}</b> won</span><span><b>${p.titles}</b> title${p.titles===1?"":"s"}</span><span><b>${fmt$(p.earned)}</b> team pay</span>`;
  $("pcJob").innerHTML=T?`<div class="sec"><h2>Your team</h2>${pcTeamCard(T)}</div>`:"";
  const L=p.last;let lh="";
  if(L){lh=`<div class="card pcres${L.win?" win":L.broke?" bad":""}"><h3>${esc(L.txt)}<span>season ${L.season} · round ${L.round}</span></h3><div class="client">${esc(L.team)} · ${esc(L.name)} · ${PC_EVENTS[L.ev].n} · ${esc(L.eng)}${L.auto?(L.txt==="Sat out"?" · at Close week":" · raced at Close week"):""}</div>
    <div class="pcl">${L.lines.map(x=>`<div>${esc(x)}</div>`).join("")}</div>
    <p class="mkline"><span>Points <b>${L.pts}</b></span>${L.spent?`<span>Engine work <b>${fmt$(L.spent)}</b></span>`:""}<span>Pay <b>${fmt$(L.fee+L.bonus)}</b></span><span>Rep <b>${L.rep>=0?"+":""}${L.rep}</b></span></p>`;
    const X=L.end;if(X)lh+=`<div class="pcend${X.pos===1?" win":""}"><h3>${X.pos===1?"Champions!":`Season over: P${X.pos} of ${X.of}`}</h3>
      <div class="pctab">${X.top.map((x,i)=>`<div class="${x.me?"me":""}"><span>${i+1}</span><span>${esc(x.n)}</span><b>${x.pts}</b></div>`).join("")}</div>
      <p class="mkline"><span>Title bonus <b>${fmt$(X.bonus)}</b></span><span>Rep <b>+${X.rep}</b></span><span>Spent <b>${fmt$(X.spent)}</b> of ${fmt$(X.budget)}</span></p>
      ${X.back?`<p class="hint">${esc(L.team)} wants you back next season, with more money.</p>`:""}</div>`;
    if(L.mid&&!X)lh+=`<p class="pcmid"><b>Mid-season.</b> ${esc(L.mid)}</p>`;
    lh+=`<button class="btn sm ghost" data-pcok>OK</button></div>`;}
  $("pcLast").innerHTML=lh;
  $("pcOfSec").style.display=T?"none":"";$("pcCnt").textContent=p.offers.length;
  $("pcNext").textContent=`Season ${p.season}: pick a team to supply for ${PC_ROUNDS} rounds. ${pcNextTxt()}${p.passW===C().week&&p.passN?` A passed team's place fills when the week closes.`:""}`;
  $("pcRoster").innerHTML=T?"":p.offers.map(pcOffer).join("");
}
/* the header's week line, and the build cost in red when it is more than the team has left */
function pcHud(){if(!career())return;const T=pcTeam();let over=false,t=`WEEK ${C().week}`;
  if(T){const nd=pcNeed(T,quick?Math.round(quick.cost):0),left=pcLeft(T);over=nd.need>left;t+=` · R${T.round+1}/${PC_ROUNDS} ${C().week>=T.due?"THIS WEEK":"WK "+T.due}`;}
  else t+=" · NO TEAM";
  $("weekLbl").textContent=t+(dev()?" · DEV":"");const sc=$("sCost");if(sc)sc.classList.toggle("critc",over);}
$("mkTeam").addEventListener("click",e=>{if(!career())return;const p=pcS(),T=p.team;
  if(e.target.closest("#pcGo")){pcRace(false);return;}
  const g=e.target.closest("[data-pcsign]");if(g){if(T)return;const o=p.offers.find(x=>x.id==g.dataset.pcsign);if(!o)return;const t=pcSign(o);save();hud();renderShop();showTab("build");toast(`Signed with ${t.team} · round 1 is week ${t.due}`);if(tourStep>=0)setTimeout(()=>tourAdvance(0),60);return;}
  const ps=e.target.closest("[data-pcpass]");if(ps){if(T)return;const n0=p.offers.length;p.offers=p.offers.filter(x=>x.id!=ps.dataset.pcpass);if(p.offers.length===n0)return;
    if(p.passW!==C().week){p.passW=C().week;p.passN=0;}p.passN++;save();pcRender();toast("Passed · another team calls when the week closes");return;}
  if(!T){if(e.target.closest("[data-pcok]")){p.last=null;save();pcRender();}return;}
  const mp=e.target.closest("[data-pcmap]");if(mp){if(!PC_MAPS[mp.dataset.pcmap]||T.map===mp.dataset.pcmap)return;T.map=mp.dataset.pcmap;save();pcRender();return;}
  if(e.target.closest("[data-pcfresh]")){const f=pcFreshCost(T);if(f>pcLeft(T)||T.hash!==cfgHash(S.cfg))return;T.spent+=f;T.wear=0;save();hud();pcRender();toast(`Freshened up · ${fmt$(f)}`);return;}
  if(e.target.closest("[data-pcback]")){if(testing||!T.cfg){toast("Let the run finish first");return;}S.cfg=Object.assign({},SIM.DEFAULT_CFG,T.cfg);S.profileId=null;S.name=T.eng||null;afterCfgChange(true);pcRender();toast("The season engine is back on the bench");return;}
  if(e.target.closest("[data-pcsit]")){if(!confirm(`Sit out round ${T.round+1}? No points and no retainer for it.`))return;pcRace(true);return;}
  if(e.target.closest("[data-pcdrop]")){if(!confirm(`Walk away from ${T.team}? The season ends here with no title bonus, and it costs ${Math.round(3*pcRepK(T))} rep.`))return;C().rep=Math.max(0,C().rep-Math.round(3*pcRepK(T)));logEvent(`Walked away from ${T.team} after ${T.round} round${T.round===1?"":"s"}`,"bad");p.team=null;p.season++;p.offers=[];p.passN=0;pcRefill();save();hud();renderShop();return;}
  if(e.target.closest("[data-pcok]")){p.last=null;save();pcRender();}});
