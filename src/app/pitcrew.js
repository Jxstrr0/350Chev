/* ===================== PIT CREW (v1.76.31): the third mode, alongside the Test cell and the Career =====================
   Build engines to order for a roster of local racers. Each racer has a budget, a racing style and an event: the drags
   (street, gasser, outlaw radial, pro stock, pro mod) or the oval (Street Stock, Late Model, Open; clay or paved).
   Take one job, build and dyno-pull an engine that comes in under their budget and meets what they ask for, then hand
   it over. Race day is auto-simulated through the event physics: SIM.dragPass in the racer's car against seven rivals
   on a heads-up ladder (qualifying, quarter, semi, final), or SIM.ovalPass in a 25-lap feature against the night's
   eleven oval cars. The racer pays for the parts (up to their budget) and a build fee of 12% of the budget; the finish
   decides the bonus on top and the rep. A racer who finishes first or second comes back with a bigger budget.
   Pit Crew plays by test-cell rules (career() is false: every part is open, the events are free to run). Its own
   state is S.pit, saved with the rest of S. Markup: #pitBox in the Market tab (html/body.html); styles in
   css/ui-pitcrew.css. Called from renderShop() and hud() (app/career.js, app/state.js). */
const PC_TIER_REP=[0,15,50,120],PC_TIER_N=["Backyard","Known at the track","Paddock regular","Hired by winners"];
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
const PC_ROSTER=4,PC_STAY=3;
function pcFresh(){return{cash:0,rep:0,week:1,seed:Math.floor(Math.random()*1e9)+1,nid:1,roster:[],job:null,last:null,log:[],raced:0,wins:0};}
/* S.pit, made whole: a save from before Pit Crew, or a damaged one, gets the missing pieces */
function pcS(){if(!S.pit||typeof S.pit!=="object")S.pit=pcFresh();const p=S.pit,f=pcFresh();
  for(const k of ["cash","rep","week","seed","nid","raced","wins"])if(typeof p[k]!=="number"||!isFinite(p[k]))p[k]=f[k];
  if(!Array.isArray(p.roster))p.roster=[];const okR=R=>R&&PC_EVENTS[R.ev]&&PC_STYLES[R.style]&&R.budget>0;if(!p.roster.every(okR))p.roster=p.roster.filter(okR);
  if(!Array.isArray(p.log))p.log=[];if(p.job!=null&&!p.roster.some(R=>R.id===p.job))p.job=null;return p;}
function pcMode(){return !!S&&S.mode==="pit";}
function pcRand(){const p=pcS();p.seed=(p.seed*1664525+1013904223)>>>0;return p.seed/4294967296;}
function pcTierIdx(){const rep=pcS().rep;let t=0;PC_TIER_REP.forEach((v,i)=>{if(rep>=v)t=i;});return t;}
function pcJob(){const p=pcS();return p.job!=null?p.roster.find(R=>R.id===p.job)||null:null;}
const pcFirst=R=>R.name.split(" ")[0];
/* a new racer: the event leans to the top tier the shop's rep has opened */
function pcMake(){const p=pcS(),r=pcRand,ti=pcTierIdx(),pick=a=>a[Math.floor(r()*a.length)];
  const keys=Object.keys(PC_EVENTS).filter(k=>PC_EVENTS[k].tier<=ti),top=keys.filter(k=>PC_EVENTS[k].tier>=ti-1),ek=pick(r()<0.65?top:keys),E=PC_EVENTS[ek];
  const sk=pick(Object.keys(PC_STYLES)),st=PC_STYLES[sk],taken=new Set(p.roster.map(R=>R.name));let name,n=0;
  do{name=pick(PC_FIRST)+" "+pick(PC_LAST);}while(taken.has(name)&&n++<40);
  const budget=Math.round((E.budget[0]+(E.budget[1]-E.budget[0])*r())/100)*100;
  const R={id:p.nid++,name,style:sk,ev:ek,budget,skill:+(st.skill[0]+(st.skill[1]-st.skill[0])*r()).toFixed(2),seed:Math.floor(r()*1e9)+1,left:PC_STAY,back:false};
  if(E.ev==="drag"){R.fieldHp=Math.round(budget/(E.hpPer||12)*(0.9+0.2*r()));R.car=pick(RN_CARS[E.body]||RN_CARS.street);}
  else{R.track=r()<0.35?"paved":"clay";R.num=1+Math.floor(r()*98);}
  return R;}
function pcRefill(){const p=pcS();p.roster=p.roster.filter(R=>R.left>0||R.id===p.job);while(p.roster.length<PC_ROSTER){const R=pcMake();p.roster.push(R);}}
function pcIsNA(c){return c.asp==="na"&&(c.nitrous||"none")==="none";}
/* what stands between this build and the racer: a clean pull of this exact build, the budget, the class rules, what the style asks for */
function pcChecks(R){const E=PC_EVENTS[R.ev],st=PC_STYLES[R.style],L=S.last,fresh=!!(L&&L.res&&L.hash===cfgHash(S.cfg)&&L.env&&L.env.testType==="pull"),res=fresh?L.res:quick,o=[];
  if(!res)return{ok:false,o:[{ok:false,t:"Pull this exact build on the dyno (Test tab)"}],res:null,cost:0};
  const broke=fresh&&res.fails&&res.fails.length>0;
  o.push({ok:fresh&&!broke,t:!fresh?"Pull this exact build on the dyno (Test tab)":broke?"It broke on the dyno: fix it and pull it again":"Dyno pull of this exact build"});
  const cost=Math.round(res.cost);o.push({ok:cost<=R.budget,t:`Parts ${fmt$(cost)} of ${fmt$(R.budget)}${cost>R.budget?` (${fmt$(cost-R.budget)} over)`:""}`});
  if(E.ev==="oval"){const C0=SIM.OVAL_CLASSES[E.cls],ci=Math.round(SIM.ovalCi(res));if(C0.ci<9999)o.push({ok:ci<=C0.ci,t:`${ci} of ${C0.ci} ci`});}
  if(E.na)o.push({ok:pcIsNA(S.cfg),t:"Naturally aspirated, no nitrous"});
  if(st.rel)o.push({ok:res.rel>=st.rel,t:`Reliability ${Math.round(res.rel)}% (wants ${st.rel}%)`});
  return{ok:o.every(x=>x.ok),o,res,cost};}
/* race day on the strip: the racer's car with your engine, seven rivals made from the field's power run through the same
   pass, then qualifying and an 8-car heads-up ladder (rnJudge, rnPairs: the race-night rules). Your car's pass is the real
   SIM.dragPass each round, so a launch, a manifold or a turbo can let go; on top of that the engine's reliability and the
   racer's style make a chance the engine breaks on any pass. */
function pcDragDay(R){const E=PC_EVENTS[R.ev],st=PC_STYLES[R.style],r=rnRng((R.seed^0x5EED)>>>0),env=Object.assign({},S.env,stdCell());
  const res=SIM.dragPrep(S.cfg,env),car=Object.assign(carVeh({body:E.body}),{redline:S.cfg.redline,auto:true,holdTime:1.0});car.mass=SIM.dragMass(car.mass,res.kg);car.tyreTemp=car.tyre==="street"?0.3:0.8;
  const drv=RN_DRV.filter(n=>n!==R.name),cars=(RN_CARS[E.body]||RN_CARS.street).slice(),take=a=>a.splice(Math.floor(r()*a.length),1)[0];
  const field=[0.86,0.93,0.97,1.0,1.03,1.08,1.15].map((k,i)=>{const hp=Math.round(R.fieldHp*k*(0.97+0.06*r())),ai=SIM.ovalAiRes(hp,(R.seed+i*7919)>>>0);
    const v=Object.assign(carVeh({body:E.body}),{redline:ai.redline,auto:true,noFail:true,holdTime:1.0});v.mass=SIM.dragMass(v.mass,ai.kg);v.tyreTemp=v.tyre==="street"?0.3:0.8;
    let q=null;try{q=SIM.dragPass(ai,v);}catch(e){}
    const lb=v.mass*2.2046,et=q&&q.et?q.et:+Math.min(39,5.825*Math.cbrt(lb/hp)).toFixed(3),mph=q&&q.mph?q.mph:+(234*Math.cbrt(hp/lb)).toFixed(1),sk=0.45+0.5*r();
    return{name:take(drv),car:take(cars),hp,mean:et,mph,sd:+(et*(0.003+0.006*(1-sk))).toFixed(3),rt:+(0.035+0.07*(1-sk*0.6-r()*0.4)).toFixed(3),rtSd:+(0.012+0.02*(1-sk)).toFixed(3),brk:+(0.012+0.04*r()).toFixed(3),red:+(0.01+0.035*r()).toFixed(3),dial:null};});
  const haz=Math.max(0,100-res.rel)/100*0.12*st.wear,rtM=0.035+0.07*(1-R.skill)-(R.style==="hotshoe"?0.012:0),rtSd=0.01+0.02*(1-R.skill),redK=0.008+0.03*(1-R.skill)+(R.style==="hotshoe"?0.012:0);
  const mine=()=>{let q=null;try{q=SIM.dragPass(res,Object.assign({},car));}catch(e){}
    const rt=r()<redK?-+(0.002+0.03*r()).toFixed(3):+Math.max(0.005,rtM+rnGauss(r)*rtSd).toFixed(3);
    if(!q||q.et==null||q.broke)return{rt,et:null,broke:true,why:q&&q.reasons&&q.reasons[0]?q.reasons[0]:"It didn't make it down the track."};
    if(r()<haz)return{rt,et:null,broke:true,why:`The engine let go${res.firstToFail?` (${res.firstToFail.toLowerCase()} was the weak link on the dyno)`:""}.`};
    return{rt,et:+(q.et*(1+rnGauss(r)*(0.002+0.006*(1-R.skill)))).toFixed(3),mph:q.mph,broke:false};};
  const f3=v=>v==null?"—":v.toFixed(3),rtTxt=v=>v<0?"red light":f3(v).replace(/^0/,"");
  const lines=[],q0=mine(),Q=[q0].concat(field.map(f=>rnRivalPass(f,r,0)));
  if(q0.broke){lines.push(`Qualifying: broke. ${q0.why}`);return{place:9,of:8,broke:true,why:q0.why,lines,best:null};}
  const seeds=[0,1,2,3,4,5,6,7].sort((a,b)=>(Q[a].et==null?99:Q[a].et)-(Q[b].et==null?99:Q[b].et)||a-b);
  lines.push(`Qualifying: ${f3(q0.et)} @ ${Math.round(q0.mph)} mph, seeded #${seeds.indexOf(0)+1} of 8. The field ran ${f3(Math.min(...Q.slice(1).map(x=>x.et||99)))} to ${f3(Math.max(...Q.slice(1).map(x=>x.et||0)))}.`);
  let pairs=rnPairs(seeds).map(([a,b])=>({a,b,win:null})),place=null,broke=false,why="",best=q0.et;const RN=["Quarter-final","Semi-final","Final"];
  for(let ri=0;ri<3&&place==null;ri++){
    for(const m of pairs){
      if(m.a!==0&&m.b!==0){const pa=rnRivalPass(field[m.a-1],r,0),pb=rnRivalPass(field[m.b-1],r,0),j=rnJudge(Object.assign({x:pa.broke?402*pa.at:402,dq:false},pa),Object.assign({x:pb.broke?402*pb.at:402,dq:false},pb),false);m.win=j.w===0?m.a:m.b;continue;}
      const oi=m.a===0?m.b:m.a,rv=field[oi-1],me=mine(),op=rnRivalPass(rv,r,0),j=rnJudge(Object.assign({x:me.broke?200:402,dq:false},me),Object.assign({x:op.broke?402*op.at:402,dq:false},op),false),won=j.w===0;
      if(me.et!=null)best=Math.min(best,me.et);
      const how=j.why==="red"?(me.rt<0?"red light":"they red-lit"):j.why==="dnf"||j.why==="dnf2"?(me.broke?"broke":"they broke"):`${rtTxt(me.rt)} / ${f3(me.et)} against ${rtTxt(op.rt)} / ${f3(op.et)}${j.holeshot?" (holeshot)":""}`;
      lines.push(`${RN[ri]} vs ${rv.name}: ${won?"won":"lost"}, ${how}.`);m.win=won?0:oi;
      if(me.broke){broke=true;why=me.why;lines.push(me.why);}
      if(!won||(me.broke&&ri<2))place=won?[3,2][ri]:[5,3,2][ri];}
    if(place==null&&ri<2)pairs=rnNextPairs(pairs);}
  if(place==null)place=1;
  return{place,of:8,broke,why,lines,best};}
/* race day on the oval: the racer drives your engine in the 25-lap feature from a drawn grid spot, against the night's eleven
   rivals (ovalRoster / ovalCarRun, the same cars and sim the oval night uses). The sim's own failures are on; a hot shoe adds wear. */
function pcOvalDay(R){const E=PC_EVENTS[R.ev],k=E.cls,tk=R.track,st=PC_STYLES[R.style],seed=R.seed>>>0,r=rnRng((seed^0x0A1)>>>0),env=Object.assign({},S.env,stdCell());
  const res=SIM.ovalPrep(S.cfg,env),roster=ovalRoster(k,seed),ids=roster.map(x=>x.i).concat(["me"]);
  for(let i=ids.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
  const gm=ids.indexOf("me"),cars=[];ids.forEach((id,g)=>{if(id!=="me")cars.push(ovalCarRun(roster[id],k,seed,"feature",OVAL_FEAT,ovalGridOff(g),OVAL_HEAT,0.6,tk));});cars.forEach(c=>{c.cut=null;});
  const L=SIM.ovalTrack(tk).len,veh={cls:k,track:tk,tyre:"med",grille:"mid",finalK:1,redline:S.cfg.redline,idle:SIM.isDiesel&&SIM.isDiesel(S.cfg)?720:Math.max(750,S.cfg.cam>70?1100:850),
    seed:(seed^0xBEEF)>>>0,laps:OVAL_FEAT,off:ovalGridOff(gm),night:SIM.ovalNight(seed,tk),moist:0.6,lap0:OVAL_HEAT};
  veh.gap=(s,t)=>{let g=Infinity;for(const c of cars){const a=ovalAt(c,t);if(!a)continue;const d=(((a.s-s)%L)+L)%L;if(d<g&&d>1.2)g=d;}return g;};
  if(st.wear>1&&r()<Math.max(0,100-res.rel)/100*0.35*(st.wear-1))veh.wornAt=Math.max(3,Math.round(OVAL_FEAT*(0.3+0.6*r())));
  const p=SIM.ovalPass(res,veh,R.skill,0.05),pr=p.result(),meT=pr.laps.reduce((a,b)=>a+b,0)+0;
  const rows=cars.map(c=>c.dnf?{n:c.n,dnf:true,laps:c.cross.filter(x=>x<c.dnf.t).length}:{n:c.n,laps:OVAL_FEAT,time:c.fin});
  rows.push(pr.finished?{n:pcFirst(R)+" (yours)",me:true,laps:OVAL_FEAT,time:meT}:{n:pcFirst(R)+" (yours)",me:true,dnf:true,laps:pr.lapN||0});
  rows.sort((a,b)=>(a.dnf?1:0)-(b.dnf?1:0)||b.laps-a.laps||(a.dnf?0:a.time-b.time));
  const place=rows.findIndex(x=>x.me)+1,broke=!pr.finished,why=broke?(pr.reasons&&pr.reasons[0])||"The engine let go.":"",lines=[];
  lines.push(`${SIM.ovalTrack(tk).n}, 25-lap feature. Started P${gm+1} of ${rows.length}${broke?`, out on lap ${(pr.lapN||0)+1}.`:`, finished P${place}.`}`);
  if(pr.best)lines.push(`Best lap ${pr.best.toFixed(2)} s · top ${Math.round(pr.maxKmh/1.609)} mph · ${pr.coolPeak} °C peak coolant.`);
  if(broke)lines.push(why);else if(pr.reasons&&pr.reasons.length)lines.push(pr.reasons[0]);
  lines.push("Top five: "+rows.slice(0,5).map((x,i)=>`${i+1}. ${x.n}`).join(" · "));
  return{place,of:rows.length,broke,why,lines,best:pr.best||null};}
const pcPlaceTxt=(o,ev)=>ev==="drag"?(RN_PLACE[o.place]||"Out early"):o.broke?`DNF (P${o.place} of ${o.of})`:o.place===1?"Won the feature":`P${o.place} of ${o.of}`;
/* pay day: the parts paid back, the build fee, a bonus for the top three; rep by the finish (more at the bigger classes), less for a broken engine.
   The fee is the same whatever the parts cost, so the budget is a cap to build up to, not money to pocket. */
const PC_FEE=0.12;
const pcFee=R=>Math.round(R.budget*PC_FEE/50)*50;
function pcSettle(R,chk,out){const p=pcS(),E=PC_EVENTS[R.ev],st=PC_STYLES[R.style],mult=[1,1.5,2,3][E.tier],drag=E.ev==="drag";
  const pl=drag?out.place:out.broke?99:out.place,top3=pl<=3;
  const bonusK=pl===1?0.35*(st.winK||1):pl===2?0.15:top3?0.08:0,bonus=Math.round(R.budget*bonusK/50)*50,fee=pcFee(R);
  const base=drag?({1:8,2:5,3:3}[pl]||0):pl===1?8:pl===2?6:pl===3?5:pl<=6?2:0,rep=out.broke&&pl!==1?-Math.round(3*mult):Math.round(base*mult);
  p.cash+=fee+bonus;p.rep=Math.max(0,p.rep+rep);p.raced++;if(pl===1)p.wins++;
  const stays=!out.broke&&pl<=2,txt=pcPlaceTxt(out,E.ev);
  p.last={name:R.name,ev:R.ev,eng:engineName(),place:out.place,txt,lines:out.lines,broke:out.broke,budget:R.budget,cost:chk.cost,fee,bonus,rep,week:p.week,back:stays?Math.round(R.budget*1.2/100)*100:0,win:pl===1};
  p.log.unshift({w:p.week,t:`${R.name}, ${E.n}: ${txt}. ${fmt$(fee+bonus)}, rep ${rep>=0?"+":""}${rep}`,k:pl===1?"good":out.broke?"bad":""});p.log=p.log.slice(0,30);
  p.roster=p.roster.filter(x=>x.id!==R.id);p.job=null;p.week++;p.roster.forEach(x=>{x.left--;x.back=false;});
  if(stays){const n=Object.assign({},R,{id:p.nid++,budget:p.last.back,left:PC_STAY,back:true,seed:Math.floor(pcRand()*1e9)+1});if(n.fieldHp)n.fieldHp=Math.round(n.fieldHp*1.12);p.roster.unshift(n);}
  pcRefill();}
function pcRace(){const R=pcJob();if(!R||testing)return;const chk=pcChecks(R);if(!chk.ok){toast("Not ready: "+(chk.o.find(x=>!x.ok)||{}).t);return;}
  const b=$("pcGo");if(b){b.disabled=true;b.textContent="Race day…";}
  setTimeout(()=>{let out;try{out=PC_EVENTS[R.ev].ev==="drag"?pcDragDay(R):pcOvalDay(R);}catch(e){console.error(e);toast("Race day was rained out: try again");pcRender();return;}
    pcSettle(R,chk,out);save();hud();pcRender();const L=pcS().last;toast(`${L.name.toUpperCase()} · ${L.txt.toUpperCase()}`);buzz(L.win?[30,40,30]:20);
    const c=$("pcLast");if(c&&c.scrollIntoView)c.scrollIntoView({block:"start",behavior:"smooth"});},40);}
function pcFieldTxt(R){const E=PC_EVENTS[R.ev];if(E.ev==="drag")return`The field makes about ${Math.round(R.fieldHp*0.88/10)*10}–${Math.round(R.fieldHp*1.15/10)*10} hp.`;
  const C0=SIM.OVAL_CLASSES[E.cls],d=C0.d.replace(/ · /g,", ");return`The field makes about ${C0.field.hp} hp. ${d.charAt(0).toUpperCase()+d.slice(1)}.`;}
function pcCard(R,job){const E=PC_EVENTS[R.ev],st=PC_STYLES[R.style],p=pcS(),busy=p.job!=null;
  const where=E.ev==="oval"?`${SIM.ovalTrack(R.track).n} · car #${R.num}`:esc(R.car);
  let h=`<div class="card pcr${job?" job":""}"><h3>${esc(R.name)}<span>${fmt$(R.budget)} budget</span></h3><div class="client">${E.n} · ${where}${R.back?" · back for more":""}</div>
    <p class="pcst"><b>${st.n}.</b> ${st.d}${st.rel?` Asks for ${st.rel}% reliability.`:""}</p><p class="hint">${pcFieldTxt(R)}${E.tip?" "+E.tip:""}</p>`;
  if(job){const c=pcChecks(R);h+=`<div class="pcchk">${c.o.map(x=>`<div class="${x.ok?"ok":"no"}">${x.ok?"✓":"✗"} ${esc(x.t)}</div>`).join("")}</div>
    <p class="hint">${esc(pcFirst(R))} pays for the parts and a <b>${fmt$(pcFee(R))}</b> build fee. A top-three finish adds a bonus: ${fmt$(Math.round(R.budget*0.35*(st.winK||1)/50)*50)} for a win.</p>
    <div class="row"><button class="btn${c.ok?"":" ghost"}" id="pcGo" ${c.ok?"":"disabled"}>Race day: hand it over</button><button class="btn sm ghost" data-pcdrop>Hand the job back</button></div>`;}
  else h+=`<div class="row"><button class="btn sm" data-pctake="${R.id}" ${busy?"disabled":""}>${busy?"One job at a time":"Build for "+esc(pcFirst(R))}</button><button class="btn sm ghost" data-pcpass="${R.id}">Pass</button></div>`;
  return h+`</div>`;}
function pcRender(){const box=$("pitBox");if(!box||!pcMode())return;const p=pcS();pcRefill();const R=pcJob(),ti=pcTierIdx();
  $("pcStats").innerHTML=`<span>Week <b>${p.week}</b></span><span><b>${p.raced}</b> raced</span><span><b>${p.wins}</b> won</span><span>${PC_TIER_N[ti]}</span>`;
  $("pcJob").innerHTML=R?`<div class="sec"><h2>On the bench</h2>${pcCard(R,true)}</div>`:"";
  const L=p.last;$("pcLast").innerHTML=L?`<div class="card pcres${L.win?" win":L.broke?" bad":""}"><h3>${esc(L.txt)}<span>week ${L.week}</span></h3><div class="client">${esc(L.name)} · ${PC_EVENTS[L.ev].n} · ${esc(L.eng)}</div>
    <div class="pcl">${L.lines.map(x=>`<div>${esc(x)}</div>`).join("")}</div>
    <p class="mkline"><span>Parts <b>${fmt$(L.cost)}</b> of ${fmt$(L.budget)}</span><span>Fee <b>${fmt$(L.fee||0)}</b></span><span>Bonus <b>${fmt$(L.bonus)}</b></span><span>Rep <b>${L.rep>=0?"+":""}${L.rep}</b></span></p>
    ${L.back?`<p class="hint">${esc(L.name.split(" ")[0])} liked it, and is back on the list with ${fmt$(L.back)} to spend.</p>`:""}<button class="btn sm ghost" data-pcok>OK</button></div>`:"";
  const list=p.roster.filter(x=>x.id!==p.job);$("pcCnt").textContent=list.length;
  const nt=PC_TIER_REP[ti+1];$("pcNext").textContent=nt!=null?`More rep brings bigger classes: ${Object.values(PC_EVENTS).filter(e=>e.tier===ti+1).map(e=>e.n).join(", ")} at ${nt} rep.`:"Every class is calling.";
  $("pcRoster").innerHTML=list.map(x=>pcCard(x,false)).join("");
  $("pcLog").innerHTML=p.log.length?p.log.map(e=>`<div class="${e.k||""}">W${e.w}: ${esc(e.t)}</div>`).join(""):"<div>No race days yet.</div>";}
function pcHud(){const p=pcS(),R=pcJob();$("cashLbl").textContent=fmt$(p.cash);$("cashLbl").style.color="";$("repLbl").textContent=`Rep ${p.rep} · ${PC_TIER_N[pcTierIdx()]}`;
  const cost=quick?Math.round(quick.cost):0;$("weekLbl").textContent=R?`PIT CREW · ${pcFirst(R).toUpperCase()} ${fmt$(cost)} / ${fmt$(R.budget)}`:`PIT CREW · WEEK ${p.week}`;
  const sc=$("sCost");if(sc)sc.classList.toggle("critc",!!R&&cost>R.budget);}
$("pitBox").addEventListener("click",e=>{if(!pcMode())return;const p=pcS();
  if(e.target.closest("#pcGo")){pcRace();return;}
  const t=e.target.closest("[data-pctake]");if(t){if(p.job!=null)return;const R=p.roster.find(x=>x.id==t.dataset.pctake);if(!R)return;p.job=R.id;save();hud();pcRender();showTab("build");toast(`Building for ${R.name} · ${fmt$(R.budget)}`);return;}
  const ps=e.target.closest("[data-pcpass]");if(ps){p.roster=p.roster.filter(x=>x.id!=ps.dataset.pcpass);pcRefill();save();pcRender();return;}
  if(e.target.closest("[data-pcdrop]")){const R=pcJob();if(!R||!confirm(`Hand ${R.name}'s job back? They'll go to another shop, and it costs 1 rep.`))return;p.roster=p.roster.filter(x=>x.id!==R.id);p.job=null;p.rep=Math.max(0,p.rep-1);pcRefill();save();hud();pcRender();return;}
  if(e.target.closest("[data-pcok]")){p.last=null;save();pcRender();}});
