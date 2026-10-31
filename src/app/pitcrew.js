/* ===================== PIT CREW (v1.76.32): the third mode, alongside the Test cell and the Career =====================
   You are the engine supplier for one team through an 8-round season. Each season three teams offer a contract: a driver
   with a racing style, one series for the whole season (the drags: street, gasser, outlaw radial, pro stock, pro mod; or the
   oval: Street Stock, Late Model, Open on clay or paved) and one parts budget for the season. The first build comes out of
   that budget; after it, every engine change (a teardown charge plus any parts that cost more), every freshen-up and every
   rebuild after a breakage comes out of what is left. Each round wears the engine (reliability drops, more for a hot shoe)
   until you freshen it. Race day is auto-simulated through the event physics: SIM.dragPass in the team's car against the
   series' seven rival teams on a heads-up ladder, or SIM.ovalPass in a 25-lap feature against the eleven oval regulars.
   Every car scores points by its finish; the championship after round 8 decides the bonus, the rep, and which teams call
   next season (a top-two finish brings the same team back with more money). The field finds a little more every round.
   Pit Crew plays by test-cell rules (career() is false: every part is open, the events are free to run). Its own state is
   S.pit (v:2), saved with the rest of S; a save from the one-race version (1.76.31) keeps its cash, rep and log.
   Markup: #pitBox in the Market tab (html/body.html); styles in css/ui-pitcrew.css. Called from renderShop() and hud()
   (app/career.js, app/state.js). */
const PC_TIER_REP=[0,15,50,120],PC_TIER_N=["Backyard","Known at the track","Paddock regular","Hired by winners"];
/* the series: budget is the engine-size range before the 15% raise (the field's power is set from it); tier opens with rep */
const PC_EVENTS={
  street:{ev:"drag",body:"street",n:"Street drags",tier:0,budget:[2500,6000],tip:"Street tyres: much past 550 hp only spins them."},
  ostreet:{ev:"oval",cls:"street",n:"Street Stock oval",tier:0,budget:[3000,6000]},
  gasser:{ev:"drag",body:"gasser",n:"Gasser drags",tier:1,budget:[4000,9000],tip:"Short and nose-high on slicks; hooks up to about 1,000 hp."},
  olate:{ev:"oval",cls:"late",n:"Late Model oval",tier:1,budget:[6000,10000]},
  outlaw:{ev:"drag",body:"outlaw",n:"Outlaw radial",tier:2,budget:[7000,15000],tip:"Radials and a chute; takes 1,500 hp and more."},
  prostock:{ev:"drag",body:"prostock",n:"Pro stock",tier:2,budget:[10000,18000],na:true,hpPer:18,tip:"No boost, no nitrous: the class is naturally aspirated."},
  oopen:{ev:"oval",cls:"open",n:"Open oval",tier:2,budget:[9000,16000]},
  promod:{ev:"drag",body:"promod",n:"Pro mod",tier:3,budget:[16000,36000],tip:"Big slicks and anything goes: it takes 2,000 hp to win."}};
const PC_STYLES={
  steady:{n:"Steady hand",d:"Smooth and consistent. Wants an engine that lasts.",rel:85,skill:[0.68,0.84],wear:0.8},
  hotshoe:{n:"Hot shoe",d:"Quick on the tree and flat out in the turns, and hard on parts.",skill:[0.76,0.95],wear:1.7},
  rookie:{n:"Rookie",d:"Still learning, so a mistake shouldn't cost an engine.",rel:80,skill:[0.4,0.6],wear:1.1},
  veteran:{n:"Veteran",d:"Has seen it all, and pays a bigger bonus for a win.",skill:[0.8,0.95],wear:1,winK:1.5}};
const PC_FIRST=["Dale","Marie","Tyler","Wes","Kim","Rhett","Jo","Sam","Lena","Cody","Ana","Reggie","Bo","Nora","Gus","Priya","Hank","Della","Arlo","June","Merle","Tess","Colt","Faye"];
const PC_LAST=["Kowalchuk","Lavoie","Sorensen","Bouchard","Nakamura","Dyck","Fehr","Okafor","Penner","Gauthier","Petrova","Thiessen","Lindqvist","Wiebe","Halvorsen","Sandhu","Friesen","Boychuk","Morin","Klassen","Yellowhorn","Strand","Ostrowski","Dubois"];
const PC_TEAM=["Racing","Motorsports","Speed Shop","Race Team","Performance","Garage","Competition"];
/* the season: 8 rounds and 3 offers. A team's budget is the engine-size money (the event's range, raised 15% in 1.76.32)
   times PC_SEASON, so about a third is left for upkeep after a build of that size. The field's power is set from the range
   before the raise. An engine change costs PC_TEAR of the new build plus any parts that cost more; a freshen-up PC_FRESH of
   the engine and a rebuild after a breakage PC_FIX. Each round takes PC_WEAR reliability points times the style's wear. */
const PC_ROUNDS=8,PC_OFFERS=3,PC_RAISE=1.15,PC_SEASON=1.5,PC_TEAR=0.15,PC_FRESH=0.15,PC_FIX=0.3,PC_WEAR=4,PC_FIELD_UP=0.015;
const PC_PTS_DRAG={1:20,2:14,3:9,5:4,9:0},PC_PTS_OVAL=[20,16,13,11,9,8,7,6,5,4,3,2];
/* pay: a retainer each round you race, a bonus for a top-three round, a bigger one for the championship (all shares of the season budget) */
const PC_RETAIN=0.06,PC_RBONUS=[0.06,0.03,0.015],PC_CBONUS=[0.3,0.15,0.08],PC_CREP=[15,9,5];
function pcFresh(){return{v:2,cash:0,rep:0,season:1,seed:Math.floor(Math.random()*1e9)+1,nid:1,offers:[],team:null,last:null,log:[],raced:0,wins:0,titles:0};}
const pcOkT=T=>!!T&&typeof T==="object"&&!!PC_EVENTS[T.ev]&&!!PC_STYLES[T.style]&&T.budget>0;
/* S.pit, made whole: a save from before Pit Crew, from the one-race version (no v), or a damaged one gets the missing pieces */
function pcS(){if(!S.pit||typeof S.pit!=="object")S.pit=pcFresh();let p=S.pit;const f=pcFresh();
  if(p.v!==2){S.pit=f;for(const k of ["cash","rep","seed","nid","raced","wins"])if(typeof p[k]==="number"&&isFinite(p[k]))f[k]=p[k];if(Array.isArray(p.log))f.log=p.log;p=f;}
  for(const k of ["cash","rep","season","seed","nid","raced","wins","titles"])if(typeof p[k]!=="number"||!isFinite(p[k]))p[k]=f[k];
  if(!Array.isArray(p.offers))p.offers=[];if(!p.offers.every(pcOkT))p.offers=p.offers.filter(pcOkT);
  if(!Array.isArray(p.log))p.log=[];
  if(p.team!=null){const T=p.team;if(!pcOkT(T)||!Array.isArray(T.rivals)||typeof T.round!=="number")p.team=null;
    else{for(const k of ["spent","pts","wear","cost"])if(typeof T[k]!=="number"||!isFinite(T[k]))T[k]=0;if(!Array.isArray(T.hist))T.hist=[];}}
  return p;}
function pcMode(){return !!S&&S.mode==="pit";}
function pcRand(){const p=pcS();p.seed=(p.seed*1664525+1013904223)>>>0;return p.seed/4294967296;}
function pcTierIdx(){const rep=pcS().rep;let t=0;PC_TIER_REP.forEach((v,i)=>{if(rep>=v)t=i;});return t;}
function pcTeam(){return pcS().team||null;}
const pcFirst=T=>T.name.split(" ")[0];
const pcLeft=T=>Math.max(0,T.budget-T.spent);
const pcRoundSeed=T=>(T.seed+(T.round+1)*104729)>>>0;
/* a contract offer: the series leans to the top tier the shop's rep has opened */
function pcMake(){const p=pcS(),r=pcRand,ti=pcTierIdx(),pick=a=>a[Math.floor(r()*a.length)];
  const keys=Object.keys(PC_EVENTS).filter(k=>PC_EVENTS[k].tier<=ti),top=keys.filter(k=>PC_EVENTS[k].tier>=ti-1),ek=pick(r()<0.65?top:keys),E=PC_EVENTS[ek];
  const sk=pick(Object.keys(PC_STYLES)),st=PC_STYLES[sk],taken=new Set(p.offers.map(T=>T.name));let name,n=0;
  do{name=pick(PC_FIRST)+" "+pick(PC_LAST);}while(taken.has(name)&&n++<40);
  const base=E.budget[0]+(E.budget[1]-E.budget[0])*r(),budget=Math.round(base*PC_RAISE*PC_SEASON/500)*500;
  const T={id:p.nid++,team:pick(PC_LAST)+" "+pick(PC_TEAM),name,style:sk,ev:ek,budget,skill:+(st.skill[0]+(st.skill[1]-st.skill[0])*r()).toFixed(2),seed:Math.floor(r()*1e9)+1,back:false};
  if(E.ev==="drag"){T.fieldHp=Math.round(base/(E.hpPer||12)*(0.9+0.2*r()));T.car=pick(RN_CARS[E.body]||RN_CARS.street);}
  else{T.track=r()<0.35?"paved":"clay";T.num=1+Math.floor(r()*98);}
  return T;}
function pcRefill(){const p=pcS();if(p.team)return;while(p.offers.length<PC_OFFERS){const T=pcMake();p.offers.push(T);}}
/* sign a contract: the season's rivals are fixed now, so the points table means something */
function pcSign(T){const p=pcS(),E=PC_EVENTS[T.ev],r=rnRng((T.seed^0x7EA)>>>0);
  const t=Object.assign({},T,{round:0,spent:0,pts:0,wear:0,cost:0,hash:null,cfg:null,broken:false,hist:[]});
  if(E.ev==="drag"){const drv=RN_DRV.filter(n=>n!==T.name),cars=(RN_CARS[E.body]||RN_CARS.street).slice(),ks=[0.86,0.93,0.97,1.0,1.03,1.08,1.15],take=a=>a.splice(Math.floor(r()*a.length),1)[0];
    t.rivals=ks.map(k=>({n:take(drv),car:take(cars)||E.body,k,sk:+(0.45+0.5*r()).toFixed(2),pts:0}));}
  else t.rivals=ovalRoster(E.cls,T.seed>>>0).map(x=>({n:x.n,i:x.i,pts:0}));
  p.team=t;p.offers=[];return t;}
function pcIsNA(c){return c.asp==="na"&&(c.nitrous||"none")==="none";}
/* what this build costs the season: the first build in full; a different build a teardown plus any parts that cost more;
   the season engine again costs nothing, or a rebuild if it broke */
function pcNeed(T,cost){const same=T.hash!=null&&T.hash===cfgHash(S.cfg);
  if(same)return T.broken?{kind:"fix",need:Math.round(T.cost*PC_FIX)}:{kind:"none",need:0};
  if(T.hash==null)return{kind:"build",need:cost};
  return{kind:"change",need:Math.round(cost*PC_TEAR+Math.max(0,cost-T.cost))};}
/* what stands between this build and race day: a clean pull of a new build, the money left, the class rules, what the style asks for */
function pcChecks(T){const E=PC_EVENTS[T.ev],st=PC_STYLES[T.style],L=S.last,h=cfgHash(S.cfg),same=T.hash!=null&&T.hash===h;
  const fresh=!!(L&&L.res&&L.hash===h&&L.env&&L.env.testType==="pull"),res=fresh?L.res:quick,o=[];
  if(!res)return{ok:false,o:[{ok:false,t:"Pull this exact build on the dyno (Test tab)"}],res:null,cost:0,need:0,kind:"build"};
  const cost=Math.round(res.cost),nd=pcNeed(T,cost),left=pcLeft(T);
  if(!same){const broke=fresh&&res.fails&&res.fails.length>0;o.push({ok:fresh&&!broke,t:!fresh?"Pull this exact build on the dyno (Test tab)":broke?"It broke on the dyno: fix it and pull it again":"Dyno pull of this exact build"});}
  if(nd.kind==="build")o.push({ok:nd.need<=left,t:`The build: parts ${fmt$(cost)} of ${fmt$(left)}${cost>left?` (${fmt$(cost-left)} over)`:""}`});
  else if(nd.kind==="change")o.push({ok:nd.need<=left,t:`Engine change: ${fmt$(nd.need)} of ${fmt$(left)} left${nd.need>left?` (${fmt$(nd.need-left)} short)`:""}`});
  else if(nd.kind==="fix")o.push({ok:nd.need<=left,t:`Rebuild after the breakage: ${fmt$(nd.need)} of ${fmt$(left)} left`});
  else o.push({ok:true,t:`The season engine${T.wear>0?`, worn: reliability −${Math.round(T.wear)}%`:", fresh"}`});
  if(E.ev==="oval"){const C0=SIM.OVAL_CLASSES[E.cls],ci=Math.round(SIM.ovalCi(res));if(C0.ci<9999)o.push({ok:ci<=C0.ci,t:`${ci} of ${C0.ci} ci`});}
  if(E.na)o.push({ok:pcIsNA(S.cfg),t:"Naturally aspirated, no nitrous"});
  if(st.rel)o.push({ok:res.rel>=st.rel,t:`Reliability ${Math.round(res.rel)}% (wants ${st.rel}%)`});
  return{ok:o.every(x=>x.ok),o,res,cost,need:nd.need,kind:nd.kind};}
/* race day on the strip: the team's car with your engine against the series' seven rivals (their power grows a little each
   round), then qualifying and an 8-car heads-up ladder (rnJudge, rnPairs: the race-night rules), run to the end so every car
   scores. Your car's pass is the real SIM.dragPass each round, so a launch, a manifold or a turbo can let go; on top of that
   the engine's reliability (less its wear) and the driver's style make a chance it breaks on any pass. sat: sitting it out. */
function pcDragDay(T,sat){const E=PC_EVENTS[T.ev],st=PC_STYLES[T.style],rs=pcRoundSeed(T),r=rnRng((rs^0x5EED)>>>0),env=Object.assign({},S.env,stdCell()),up=1+PC_FIELD_UP*T.round;
  const res=SIM.dragPrep(S.cfg,env),rel=Math.max(0,res.rel-T.wear),car=Object.assign(carVeh({body:E.body}),{redline:S.cfg.redline,auto:true,holdTime:1.0});car.mass=SIM.dragMass(car.mass,res.kg);car.tyreTemp=car.tyre==="street"?0.3:0.8;
  const field=T.rivals.map((rv,i)=>{const hp=Math.round(T.fieldHp*rv.k*up*(0.97+0.06*r())),ai=SIM.ovalAiRes(hp,(rs+i*7919)>>>0);
    const v=Object.assign(carVeh({body:E.body}),{redline:ai.redline,auto:true,noFail:true,holdTime:1.0});v.mass=SIM.dragMass(v.mass,ai.kg);v.tyreTemp=v.tyre==="street"?0.3:0.8;
    let q=null;try{q=SIM.dragPass(ai,v);}catch(e){}
    const lb=v.mass*2.2046,et=q&&q.et?q.et:+Math.min(39,5.825*Math.cbrt(lb/hp)).toFixed(3),mph=q&&q.mph?q.mph:+(234*Math.cbrt(hp/lb)).toFixed(1),sk=rv.sk;
    return{name:rv.n,car:rv.car,hp,mean:et,mph,sd:+(et*(0.003+0.006*(1-sk))).toFixed(3),rt:+(0.035+0.07*(1-sk*0.6-r()*0.4)).toFixed(3),rtSd:+(0.012+0.02*(1-sk)).toFixed(3),brk:+(0.012+0.04*r()).toFixed(3),red:+(0.01+0.035*r()).toFixed(3),dial:null};});
  const haz=(100-rel)/100*0.12*st.wear,rtM=0.035+0.07*(1-T.skill)-(T.style==="hotshoe"?0.012:0),rtSd=0.01+0.02*(1-T.skill),redK=0.008+0.03*(1-T.skill)+(T.style==="hotshoe"?0.012:0);
  const mine=()=>{if(sat)return{rt:0.5,et:null,broke:true,why:"Sat out."};let q=null;try{q=SIM.dragPass(res,Object.assign({},car));}catch(e){}
    const rt=r()<redK?-+(0.002+0.03*r()).toFixed(3):+Math.max(0.005,rtM+rnGauss(r)*rtSd).toFixed(3);
    if(!q||q.et==null||q.broke)return{rt,et:null,broke:true,why:q&&q.reasons&&q.reasons[0]?q.reasons[0]:"It didn't make it down the track."};
    if(r()<haz)return{rt,et:null,broke:true,why:`The engine let go${T.wear>8?" (it was due a freshen-up)":res.firstToFail?` (${res.firstToFail.toLowerCase()} was the weak link on the dyno)`:""}.`};
    return{rt,et:+(q.et*(1+rnGauss(r)*(0.002+0.006*(1-T.skill)))).toFixed(3),mph:q.mph,broke:false};};
  const f3=v=>v==null?"—":v.toFixed(3),rtTxt=v=>v<0?"red light":f3(v).replace(/^0/,"");
  const lines=[],q0=mine(),Q=[q0].concat(field.map(f=>rnRivalPass(f,r,0))),places=new Array(8).fill(null);
  let out=q0.broke,broke=q0.broke&&!sat,why=sat?"":q0.why,best=q0.et;
  const seeds=[0,1,2,3,4,5,6,7].sort((a,b)=>(Q[a].et==null?99:Q[a].et)-(Q[b].et==null?99:Q[b].et)||a-b);
  const fq=`The field ran ${f3(Math.min(...Q.slice(1).map(x=>x.et||99)))} to ${f3(Math.max(...Q.slice(1).map(x=>x.et||0)))}.`;
  if(sat)lines.push(`Sat this round out. ${fq}`);else if(q0.broke)lines.push(`Qualifying: broke. ${q0.why}`);
  else lines.push(`Qualifying: ${f3(q0.et)} @ ${Math.round(q0.mph)} mph, seeded #${seeds.indexOf(0)+1} of 8. ${fq}`);
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
  return{place:places[0],of:8,broke,why,lines,best,order:places,sat:!!sat};}
/* race day on the oval: the team's driver in the 25-lap feature from a drawn grid spot, against the series' eleven regulars
   (ovalRoster for the season, ovalCarRun for the night, the same cars and sim the oval night uses; their power grows a little
   each round and their luck is drawn fresh). The sim's own failures are on; wear and a hard driver add a worn-out failure. */
function pcOvalDay(T,sat){const E=PC_EVENTS[T.ev],k=E.cls,tk=T.track,st=PC_STYLES[T.style],seed=pcRoundSeed(T),r=rnRng((seed^0x0A1)>>>0),env=Object.assign({},S.env,stdCell()),up=1+PC_FIELD_UP*T.round;
  const res=SIM.ovalPrep(S.cfg,env),rel=Math.max(0,res.rel-T.wear);
  const roster=ovalRoster(k,T.seed>>>0).map(x=>Object.assign({},x,{hp:Math.round(x.hp*up),res:null,dnfH:false,dnfF:r()<0.08,dnfAt:r()}));
  const ids=roster.map(x=>x.i);if(!sat)ids.push("me");
  for(let i=ids.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
  const gm=ids.indexOf("me"),cars=[];ids.forEach((id,g)=>{if(id!=="me")cars.push(ovalCarRun(roster[id],k,seed,"feature",OVAL_FEAT,ovalGridOff(g),OVAL_HEAT,0.6,tk));});cars.forEach(c=>{c.cut=null;});
  const rows=cars.map(c=>c.dnf?{n:c.n,i:c.id,dnf:true,laps:c.cross.filter(x=>x<c.dnf.t).length}:{n:c.n,i:c.id,laps:OVAL_FEAT,time:c.fin});
  let pr=null;
  if(!sat){const L=SIM.ovalTrack(tk).len,veh={cls:k,track:tk,tyre:"med",grille:"mid",finalK:1,redline:S.cfg.redline,idle:SIM.isDiesel&&SIM.isDiesel(S.cfg)?720:Math.max(750,S.cfg.cam>70?1100:850),
      seed:(seed^0xBEEF)>>>0,laps:OVAL_FEAT,off:ovalGridOff(gm),night:SIM.ovalNight(seed,tk),moist:0.6,lap0:OVAL_HEAT};
    veh.gap=(s,t)=>{let g=Infinity;for(const c of cars){const a=ovalAt(c,t);if(!a)continue;const d=(((a.s-s)%L)+L)%L;if(d<g&&d>1.2)g=d;}return g;};
    if(r()<(100-rel)/100*0.3*st.wear)veh.wornAt=Math.max(3,Math.round(OVAL_FEAT*(0.3+0.6*r())));
    pr=SIM.ovalPass(res,veh,T.skill,0.05).result();const meT=pr.laps.reduce((a,b)=>a+b,0);
    rows.push(pr.finished?{n:pcFirst(T)+" (yours)",me:true,laps:OVAL_FEAT,time:meT}:{n:pcFirst(T)+" (yours)",me:true,dnf:true,laps:pr.lapN||0});}
  rows.sort((a,b)=>(a.dnf?1:0)-(b.dnf?1:0)||b.laps-a.laps||(a.dnf?0:a.time-b.time));
  const order={};rows.forEach((x,i)=>{if(!x.me)order[x.i]=i+1;});
  const lines=[],top5="Top five: "+rows.slice(0,5).map((x,i)=>`${i+1}. ${x.n}`).join(" · ");
  if(sat){lines.push(`${SIM.ovalTrack(tk).n}, 25-lap feature. Sat this round out.`);lines.push(top5);return{place:99,of:rows.length+1,broke:false,why:"",lines,best:null,order,sat:true};}
  const place=rows.findIndex(x=>x.me)+1,broke=!pr.finished,why=broke?(pr.reasons&&pr.reasons[0])||"The engine let go.":"";
  lines.push(`${SIM.ovalTrack(tk).n}, 25-lap feature. Started P${gm+1} of ${rows.length}${broke?`, out on lap ${(pr.lapN||0)+1}.`:`, finished P${place}.`}`);
  if(pr.best)lines.push(`Best lap ${pr.best.toFixed(2)} s · top ${Math.round(pr.maxKmh/1.609)} mph · ${pr.coolPeak} °C peak coolant.`);
  if(broke)lines.push(why);else if(pr.reasons&&pr.reasons.length)lines.push(pr.reasons[0]);
  lines.push(top5);
  return{place,of:rows.length,broke,why,lines,best:pr.best||null,order,sat:false};}
const pcPlaceTxt=(o,ev)=>o.sat?"Sat out":ev==="drag"?(RN_PLACE[o.place]||"Out early"):o.broke?`DNF (P${o.place} of ${o.of})`:o.place===1?"Won the feature":`P${o.place} of ${o.of}`;
const pcPts=(ev,place)=>ev==="drag"?(PC_PTS_DRAG[place]||0):(PC_PTS_OVAL[place-1]||0);
/* the series table: you and the rivals, by points (ties: you first, then the order they signed in) */
function pcTable(T){return[{n:pcFirst(T)+" (yours)",pts:T.pts,me:true}].concat(T.rivals.map(x=>({n:x.n,pts:x.pts}))).sort((a,b)=>b.pts-a.pts);}
/* pay day: the retainer and a top-three bonus; points for every car; rep by the finish (more at the bigger classes), less for a broken engine */
function pcSettle(T,chk,out){const p=pcS(),E=PC_EVENTS[T.ev],st=PC_STYLES[T.style],mult=[1,1.5,2,3][E.tier],drag=E.ev==="drag";
  const pl=out.sat?99:drag?out.place:out.broke?99:out.place,podium=pl<=3?(drag?{1:0,2:1,3:2}[pl]:pl-1):null;
  const pts=out.sat?0:pcPts(E.ev,out.place);T.pts+=pts;
  T.rivals.forEach((x,i)=>{const pos=drag?out.order[i+1]:out.order[x.i];x.pts+=pos?pcPts(E.ev,pos):0;});
  const fee=out.sat?0:Math.round(T.budget*PC_RETAIN/50)*50,bonus=podium!=null?Math.round(T.budget*PC_RBONUS[podium]*(pl===1?(st.winK||1):1)/50)*50:0;
  const base=out.sat?0:drag?({1:4,2:3,3:2}[pl]||0):pl===1?4:pl===2?3:pl===3?2:pl<=6?1:0,rep=out.broke&&pl!==1?-Math.round(2*mult):Math.round(base*mult);
  p.cash+=fee+bonus;p.rep=Math.max(0,p.rep+rep);if(!out.sat){p.raced++;if(pl===1)p.wins++;T.wear+=PC_WEAR*st.wear;}
  if(out.broke)T.broken=true;
  const txt=pcPlaceTxt(out,E.ev),rd=T.round+1;T.hist.push({r:rd,t:txt,pts,k:pl===1?"good":out.broke?"bad":""});
  p.last={team:T.team,name:T.name,ev:T.ev,eng:engineName(),round:rd,season:p.season,txt,lines:out.lines,broke:out.broke,spent:chk?chk.need:0,fee,bonus,rep,pts,win:pl===1};
  p.log.unshift({w:p.season,r:rd,t:`${T.team}, ${E.n}: ${txt}. ${pts} pts, ${fmt$(fee+bonus)}, rep ${rep>=0?"+":""}${rep}`,k:pl===1?"good":out.broke?"bad":""});p.log=p.log.slice(0,40);
  T.round++;if(T.round>=PC_ROUNDS)pcSeasonEnd(T);}
/* the end of round 8: the championship bonus and rep, then next season's offers (a top-two team asks you back with more money) */
function pcSeasonEnd(T){const p=pcS(),E=PC_EVENTS[T.ev],st=PC_STYLES[T.style],mult=[1,1.5,2,3][E.tier],tab=pcTable(T),pos=tab.findIndex(x=>x.me)+1;
  const bonus=pos<=3?Math.round(T.budget*PC_CBONUS[pos-1]*(pos===1?(st.winK||1):1)/50)*50:0,rep=Math.round((pos<=3?PC_CREP[pos-1]:pos<=tab.length/2?2:0)*mult);
  p.cash+=bonus;p.rep+=rep;if(pos===1)p.titles++;
  p.last.end={pos,of:tab.length,bonus,rep,pts:T.pts,top:tab.slice(0,5),spent:T.spent,budget:T.budget,back:pos<=2};
  p.log.unshift({w:p.season,r:PC_ROUNDS,t:`Season ${p.season} with ${T.team}: ${pos===1?"champions":"P"+pos+" of "+tab.length} on ${T.pts} pts. ${fmt$(bonus)}, rep ${rep>=0?"+":""}${rep}`,k:pos===1?"good":""});
  p.team=null;p.season++;p.offers=[];
  if(pos<=2){const n={id:p.nid++,team:T.team,name:T.name,style:T.style,ev:T.ev,budget:Math.round(T.budget*1.2/500)*500,skill:T.skill,seed:Math.floor(pcRand()*1e9)+1,back:true};
    if(T.fieldHp){n.fieldHp=Math.round(T.fieldHp*1.12);n.car=T.car;}else{n.track=T.track;n.num=T.num;}p.offers.push(n);}
  pcRefill();}
/* race day: pay for the build (or the change, or the rebuild), then run it; sat: sit the round out with no points */
function pcRace(sat){const T=pcTeam();if(!T||testing)return;const chk=sat?null:pcChecks(T);if(chk&&!chk.ok){toast("Not ready: "+(chk.o.find(x=>!x.ok)||{}).t);return;}
  const b=$("pcGo");if(b){b.disabled=true;b.textContent="Race day…";}
  setTimeout(()=>{if(chk&&chk.kind!=="none"){T.spent+=chk.need;T.wear=0;T.broken=false;if(chk.kind!=="fix"){T.hash=cfgHash(S.cfg);T.cost=chk.cost;T.cfg=Object.assign({},S.cfg);}}
    let out;try{out=PC_EVENTS[T.ev].ev==="drag"?pcDragDay(T,sat):pcOvalDay(T,sat);}catch(e){console.error(e);if(chk&&chk.kind!=="none")T.spent-=chk.need;toast("Race day was rained out: try again");pcRender();return;}
    pcSettle(T,chk,out);save();hud();pcRender();const L=pcS().last;toast(L.end?`SEASON OVER · ${L.end.pos===1?"CHAMPIONS":"P"+L.end.pos}`:`ROUND ${L.round} · ${L.txt.toUpperCase()}`);buzz(L.win||(L.end&&L.end.pos===1)?[30,40,30]:20);
    const c=$("pcLast");if(c&&c.scrollIntoView)c.scrollIntoView({block:"start",behavior:"smooth"});},40);}
function pcFieldTxt(T){const E=PC_EVENTS[T.ev];if(E.ev==="drag")return`The field makes about ${Math.round(T.fieldHp*0.88/10)*10}–${Math.round(T.fieldHp*1.15/10)*10} hp, and finds a little more every round.`;
  const C0=SIM.OVAL_CLASSES[E.cls],d=C0.d.replace(/ · /g,", ");return`The field makes about ${C0.field.hp} hp. ${d.charAt(0).toUpperCase()+d.slice(1)}.`;}
const pcWhere=T=>PC_EVENTS[T.ev].ev==="oval"?`${SIM.ovalTrack(T.track).n} · car #${T.num}`:esc(T.car);
function pcOffer(T){const E=PC_EVENTS[T.ev],st=PC_STYLES[T.style];
  return`<div class="card pcr"><h3>${esc(T.team)}<span>${fmt$(T.budget)} season</span></h3><div class="client">${esc(T.name)} · ${E.n} · ${pcWhere(T)}${T.back?" · asking you back":""}</div>
    <p class="pcst"><b>${st.n}.</b> ${st.d}${st.rel?` Asks for ${st.rel}% reliability.`:""}</p><p class="hint">${pcFieldTxt(T)}${E.tip?" "+E.tip:""}</p>
    <p class="hint">${PC_ROUNDS} rounds. ${fmt$(Math.round(T.budget*PC_RETAIN/50)*50)} a round you race, a bonus for a podium, and ${fmt$(Math.round(T.budget*PC_CBONUS[0]*(st.winK||1)/50)*50)} for the title.</p>
    <div class="row"><button class="btn sm" data-pcsign="${T.id}">Sign with ${esc(T.team)}</button><button class="btn sm ghost" data-pcpass="${T.id}">Pass</button></div></div>`;}
function pcTeamCard(T){const E=PC_EVENTS[T.ev],st=PC_STYLES[T.style],c=pcChecks(T),rd=T.round+1,left=pcLeft(T),h=cfgHash(S.cfg),same=T.hash!=null&&T.hash===h;
  const fresh=Math.round(T.cost*PC_FRESH),tab=pcTable(T),pos=tab.findIndex(x=>x.me)+1;
  let s=`<div class="card pcr job"><h3>${esc(T.team)}<span>Round ${rd} of ${PC_ROUNDS}</span></h3><div class="client">${esc(T.name)} · ${E.n} · ${pcWhere(T)}</div>
    <p class="pcst"><b>${st.n}.</b> ${st.d}${st.rel?` Asks for ${st.rel}% reliability.`:""}</p><p class="hint">${pcFieldTxt(T)}${E.tip?" "+E.tip:""}</p>
    <div class="pcbud"><div class="pcbar"><i style="width:${Math.min(100,T.spent/T.budget*100).toFixed(1)}%"></i></div><p class="mkline"><span>Budget <b>${fmt$(T.budget)}</b></span><span>Spent <b>${fmt$(T.spent)}</b></span><span>Left <b>${fmt$(left)}</b></span></p></div>`;
  if(T.hash!=null)s+=`<p class="hint">Season engine: ${fmt$(T.cost)} of parts${T.broken?`. <b class="pcbad">Broken in the last round: it needs a ${fmt$(Math.round(T.cost*PC_FIX))} rebuild.</b>`:T.wear>0?`, reliability down ${Math.round(T.wear)}% from wear. A freshen-up costs ${fmt$(fresh)}.`:", fresh."}${same?"":" The bench has a different build: racing it counts as an engine change."}</p>`;
  else s+=`<p class="hint">Build the engine for the season. Whatever is left of the budget pays for freshen-ups, rebuilds and changes later.</p>`;
  s+=`<div class="pcchk">${c.o.map(x=>`<div class="${x.ok?"ok":"no"}">${x.ok?"✓":"✗"} ${esc(x.t)}</div>`).join("")}</div>
    <div class="row"><button class="btn${c.ok?"":" ghost"}" id="pcGo" ${c.ok?"":"disabled"}>Race round ${rd}</button>`;
  if(same&&!T.broken&&T.wear>0)s+=`<button class="btn sm" data-pcfresh ${fresh>left?"disabled":""}>Freshen up · ${fmt$(fresh)}</button>`;
  if(T.hash!=null&&!same)s+=`<button class="btn sm ghost" data-pcback>Put the season engine back</button>`;
  if(!c.ok)s+=`<button class="btn sm ghost" data-pcsit>Sit out round ${rd}</button>`;
  s+=`<button class="btn sm ghost" data-pcdrop>Walk away</button></div>
    <div class="sec"><h2>Standings <span class="cnt">P${pos} · ${T.pts} pts</span></h2><div class="pctab">${tab.map((x,i)=>`<div class="${x.me?"me":""}"><span>${i+1}</span><span>${esc(x.n)}</span><b>${x.pts}</b></div>`).join("")}</div>
    ${T.hist.length?`<div class="pcl">${T.hist.map(x=>`<div class="${x.k}">R${x.r}: ${esc(x.t)} · ${x.pts} pts</div>`).join("")}</div>`:""}</div>`;
  return s+`</div>`;}
/* the engine tag over the garage reads the season state ("READY FOR ROUND n"), so a race day, a signing or a walk-out redraws it */
function pcTag(){const t=$("tag");if(t&&quick&&!(document.activeElement&&document.activeElement.id==="nameIn"))t.innerHTML=engineCard(S.cfg,quick,{editable:true});}
function pcRender(){const box=$("pitBox");if(!box||!pcMode())return;const p=pcS();pcRefill();const T=p.team,ti=pcTierIdx();pcTag();
  $("pcStats").innerHTML=`<span>Season <b>${p.season}</b></span><span><b>${p.raced}</b> raced</span><span><b>${p.wins}</b> won</span><span><b>${p.titles}</b> title${p.titles===1?"":"s"}</span><span>${PC_TIER_N[ti]}</span>`;
  $("pcJob").innerHTML=T?`<div class="sec"><h2>Your team</h2>${pcTeamCard(T)}</div>`:"";
  const L=p.last;let lh="";
  if(L){lh=`<div class="card pcres${L.win?" win":L.broke?" bad":""}"><h3>${esc(L.txt)}<span>season ${L.season} · round ${L.round}</span></h3><div class="client">${esc(L.team)} · ${esc(L.name)} · ${PC_EVENTS[L.ev].n} · ${esc(L.eng)}</div>
    <div class="pcl">${L.lines.map(x=>`<div>${esc(x)}</div>`).join("")}</div>
    <p class="mkline"><span>Points <b>${L.pts}</b></span>${L.spent?`<span>Engine work <b>${fmt$(L.spent)}</b></span>`:""}<span>Pay <b>${fmt$(L.fee+L.bonus)}</b></span><span>Rep <b>${L.rep>=0?"+":""}${L.rep}</b></span></p>`;
    const X=L.end;if(X)lh+=`<div class="pcend${X.pos===1?" win":""}"><h3>${X.pos===1?"Champions!":`Season over: P${X.pos} of ${X.of}`}</h3>
      <div class="pctab">${X.top.map((x,i)=>`<div class="${x.me?"me":""}"><span>${i+1}</span><span>${esc(x.n)}</span><b>${x.pts}</b></div>`).join("")}</div>
      <p class="mkline"><span>Title bonus <b>${fmt$(X.bonus)}</b></span><span>Rep <b>+${X.rep}</b></span><span>Spent <b>${fmt$(X.spent)}</b> of ${fmt$(X.budget)}</span></p>
      ${X.back?`<p class="hint">${esc(L.team)} wants you back next season, with more money.</p>`:""}</div>`;
    lh+=`<button class="btn sm ghost" data-pcok>OK</button></div>`;}
  $("pcLast").innerHTML=lh;
  $("pcOfSec").style.display=T?"none":"";$("pcCnt").textContent=p.offers.length;
  const nt=PC_TIER_REP[ti+1];$("pcNext").textContent=`Season ${p.season}: pick a team to supply for ${PC_ROUNDS} rounds. `+(nt!=null?`More rep brings bigger classes: ${Object.values(PC_EVENTS).filter(e=>e.tier===ti+1).map(e=>e.n).join(", ")} at ${nt} rep.`:"Every class is calling.");
  $("pcRoster").innerHTML=T?"":p.offers.map(pcOffer).join("");
  $("pcLog").innerHTML=p.log.length?p.log.map(e=>`<div class="${e.k||""}">${e.r!=null?`S${e.w} R${e.r}`:`W${e.w}`}: ${esc(e.t)}</div>`).join(""):"<div>No race days yet.</div>";}
function pcHud(){const p=pcS(),T=pcTeam();$("cashLbl").textContent=fmt$(p.cash);$("cashLbl").style.color="";$("repLbl").textContent=`Rep ${p.rep} · ${PC_TIER_N[pcTierIdx()]}`;
  let over=false;if(T){const nd=pcNeed(T,quick?Math.round(quick.cost):0),left=pcLeft(T);over=nd.need>left;
    $("weekLbl").textContent=`PIT CREW · R${T.round+1}/${PC_ROUNDS} · ${nd.kind==="none"?"SEASON ENGINE":`${fmt$(nd.need)} / ${fmt$(left)}`}`;}
  else $("weekLbl").textContent=`PIT CREW · SEASON ${p.season}`;
  const sc=$("sCost");if(sc)sc.classList.toggle("critc",over);}
$("pitBox").addEventListener("click",e=>{if(!pcMode())return;const p=pcS(),T=p.team;
  if(e.target.closest("#pcGo")){pcRace(false);return;}
  const g=e.target.closest("[data-pcsign]");if(g){if(T)return;const o=p.offers.find(x=>x.id==g.dataset.pcsign);if(!o)return;const t=pcSign(o);save();hud();pcRender();showTab("build");toast(`Signed with ${t.team} · ${fmt$(t.budget)} for the season`);return;}
  const ps=e.target.closest("[data-pcpass]");if(ps){p.offers=p.offers.filter(x=>x.id!=ps.dataset.pcpass);pcRefill();save();pcRender();return;}
  if(!T){if(e.target.closest("[data-pcok]")){p.last=null;save();pcRender();}return;}
  if(e.target.closest("[data-pcfresh]")){const f=Math.round(T.cost*PC_FRESH);if(f>pcLeft(T)||T.hash!==cfgHash(S.cfg))return;T.spent+=f;T.wear=0;save();hud();pcRender();toast(`Freshened up · ${fmt$(f)}`);return;}
  if(e.target.closest("[data-pcback]")){if(testing||!T.cfg){toast("Let the run finish first");return;}S.cfg=Object.assign({},SIM.DEFAULT_CFG,T.cfg);S.profileId=null;afterCfgChange(true);pcRender();toast("The season engine is back on the bench");return;}
  if(e.target.closest("[data-pcsit]")){if(!confirm(`Sit out round ${T.round+1}? No points and no retainer for it.`))return;pcRace(true);return;}
  if(e.target.closest("[data-pcdrop]")){if(!confirm(`Walk away from ${T.team}? The season ends here with no title bonus, and it costs 3 rep.`))return;p.team=null;p.rep=Math.max(0,p.rep-3);p.season++;p.offers=[];pcRefill();save();hud();pcRender();return;}
  if(e.target.closest("[data-pcok]")){p.last=null;save();pcRender();}});
