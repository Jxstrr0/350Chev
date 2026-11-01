/* ===================== TEAM SEASONS: THE TRUCK AND TRACTOR PULL (since 1.76.50) =====================
   A series kind for the career shop's team seasons (team.js): a team that pulls the sled. It plugs in through
   PC_KIND.pull, with six series rows in PC_EVENTS taken from the pull classes (sim/pull.js): Gas 4x4 trucks and Street
   diesel at the start, then the 2.6 Smoker, the Hot Farm tractor, Super Stock and the Unlimited Modified as the shop's rep
   grows. The diesel classes give a diesel build a team to supply. The class's own tech card is the race-day rule (the
   class's legal(): single-turbo size, pump and nozzle limits, diesel only, and so on).
   Race day is the real pull sim: SIM.pullRun on the team's truck, 300 ft of dirt, with the crew picking the tyre and gear
   that pull furthest on the day's dirt and the driver's skill on the pedal (and on the kill switch if a diesel runs away).
   The series' seven other pullers are the pull night's field (a median distance, a spread and a chance of a full pull per
   class); their numbers move with the air and a little more every round. Full pulls tie, and go to a pull-off on a sled set
   15% heavier, as on the pull night. Each round's dirt (cond) is the night's: it starts tacky and dries and chews up with
   every hook, and the draw puts the team somewhere in the running order. The extra engine past the season's allowance pulls
   last, on the driest, most cut-up dirt. Points are the pull night's PULL_PTS by place; a full pull ranks above any short
   one, so its bonus is built in. A hook is scored by distance even if the engine lets go (a runaway that grenades is DQ).
   State: the same C().pc team as the other kinds; its own fields are fieldHp, rig and num. */
/* the series. m: the engine power (hp) that pulls the class's median distance, found by running the presets through the
   pull sim; the field's range is 0.7x to 1.35x of it. rig: which list of trucks or tractors the team runs. */
const PC_PULL={
  gas:{m:195,rig:"gas"},
  street:{m:255,rig:"truck"},
  smoker26:{m:330,rig:"truck"},
  hotfarm:{m:255,rig:"tractor"},
  superstock:{m:1100,rig:"truck"},
  unlimited:{m:1800,rig:"truck"}};
Object.assign(PC_EVENTS,{
  pgas:{ev:"pull",cls:"gas",n:"Gas 4×4 pull",tier:0,rep:0,budget:[2500,5000],pay:[60000,80000],tip:"Petrol or alcohol trucks, open induction, on a 6,500 lb weight limit."},
  pstreet:{ev:"pull",cls:"street",n:"Street diesel pull",tier:0,rep:0,budget:[4000,7500],pay:[60000,80000],tip:"Pump diesels on a single turbo, 2.6\" or smaller, nozzles no more than +60%."},
  psmoker:{ev:"pull",cls:"smoker26",n:"2.6 Smoker pull",tier:1,rep:40,budget:[6000,10000],pay:[130000,170000],tip:"Any pump and nozzles, but one turbo under 66 mm, and geared tall to use the power."},
  photfarm:{ev:"pull",cls:"hotfarm",n:"Hot Farm tractor pull",tier:2,rep:120,budget:[8000,15000],pay:[280000,360000],tip:"Two-wheel-drive tractors on ag tyres, one turbo under 3.0 inches."},
  psuper:{ev:"pull",cls:"superstock",n:"Super Stock pull",tier:3,rep:300,budget:[16000,32000],pay:[600000,780000],tip:"Compound turbos and no limits, on a heavy sled and paddle tyres: it takes a four-figure diesel to win."},
  punl:{ev:"pull",cls:"unlimited",n:"Unlimited Modified pull",tier:5,rep:1500,budget:[60000,96000],pay:[2400000,3200000],tip:"Diesel or alcohol and no limits: the sled was built to beat 5,000 hp."}});
const PC_PULL_SITES=[{n:"County Fairgrounds",alt:180},{n:"Prairie Stampede Grounds",alt:420},{n:"Hay Days Arena",alt:600},{n:"Red Butte Pull Pit",alt:760},{n:"Coulee Tractor Park",alt:1050},{n:"Bow River Fairgrounds",alt:1100}];
const PC_PULL_RIGS={gas:["'79 Ford F-250 4x4","'84 Chevy K20","'76 Dodge Ramcharger","'72 GMC K25","'88 Jeep J20","'81 Bronco 4x4","'86 Chevy K30","'78 Ford F-350"],
  truck:["'98 Dodge Ram 2500","'03 Ford F-250 Power Stroke","'95 Chevy K2500","'01 Duramax crew cab","'88 Dodge W250","'99 Ford F-350","'92 Chevy K3500","'06 Ram 3500 Mega Cab"],
  tractor:["Farmall 1206","John Deere 4430","Case IH 1370","Oliver 1855","Allis-Chalmers 220","Massey Ferguson 1155","International 1066","Minneapolis-Moline G1000"]};
const PC_PULL_SLOTS=8,PC_PULL_PO=1.15,PC_PULL_HAZ=0.25;
/* the hook, with a driver of this skill: the stock auto driver's foot and kill switch, with a sloppy pedal that grows as the
   skill falls and a hand that is slower to the switch */
function pcPullPass(res,veh,sk){const p=SIM.pullRun(res,veh),d=SIM.pullDriver(veh.seed),w=rnRng((veh.seed^0x51AB)>>>0),sl=1-sk;let n=0,nz=0;
  while(!p.st.done){const st=p.st;if(st.phase!=="stage"&&n++%15===0)nz=rnGauss(w)*sl*0.26;
    if(d.kill(st)&&st.raT>=(d.react()||0)+sl*0.35)p.kill();
    const f=d.foot(st);p.step(0.02,st.phase==="stage"||f<=0?f:Math.max(0.3,Math.min(1,f+nz)));}
  return p.result();}
/* the crew's call for the day: the tyre and gear that pull furthest on this dirt (a full pull, the quickest, beats any short one) */
function pcPullSetup(res,base,C0,sk){let best=null;
  for(const ty of C0.veh.tyres)for(let g=0;g<SIM.pullGears(C0.id).length;g++){
    const r=pcPullPass(res,Object.assign({},base,{tyre:ty,gear:g,noFail:true}),sk),sc=r.full?1000-r.time:r.distFt;if(!best||sc>best.sc)best={sc,tyre:ty,gear:g};}
  return best;}
function pcPullDay(T,sat,cfg,o){const E=PC_EVENTS[T.ev],k=E.cls,C0=SIM.PULL_CLASSES[k],V=C0.veh,F=C0.field,st=PC_STYLES[T.style],rs=pcRoundSeed(T),r=rnRng((rs^0x9011)>>>0),rr=rnRng((rs^0x70F1)>>>0),
    W=pcWx(T,true),env=Object.assign({},S.env,stdCell(),pcWxEnv(W)),up=(1+PC_FIELD_UP*T.round)*W.k,N=PC_PULL_SLOTS,night=W.night;
  /* the running order: the team draws a slot (the extra engine pulls last), the rivals take the rest in a drawn order */
  const slot=o.back&&!sat?N-1:Math.floor(r()*N),order=[0,1,2,3,4,5,6];
  for(let i=order.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  const rvSlot=new Array(7);let q=0;for(let s=0;s<N;s++){if(s===slot&&!sat)continue;if(q<7)rvSlot[order[q++]]=s;}
  /* the field: the class's median, moved by the air and the round, each puller's skill, the night's luck, then the dirt in their slot */
  const pace=F.sd*6*(up-1)+F.sd*3*(T.fieldHp/PC_PULL[k].m-1);
  const field=T.rivals.map((rv,i)=>{const g=rnGauss(rr),ft=F.med+pace+F.sd*(0.6*rv.sk+0.8*g),full=ft>=300||rr()<F.full*pClamp(1+0.6*rv.sk,0.3,2),
    f=pullTrkAdj({n:rv.n,i,full,ft:full?300:Math.round(pClamp(ft,110,299.5)*10)/10},night[Math.min(N-1,rvSlot[i])]);
    f.po=f.full?Math.round((232+rr()*58)*10)/10:null;return f;});
  const lines=[`Round ${T.round+1}: ${pcWxTxt(W,false,T)}.`],res=sat?null:pcMapRes(SIM.dragPrep(cfg,env),o.M),rel=res?Math.max(0,res.rel-T.wear):0;
  let me=null,pr=null,broke=false,why="",dq=false,setup=null,poR=null;
  if(!sat){
    const trk=night[slot],dsl=SIM.isDiesel(cfg),sk=o.sk,
      veh={cls:k,gear:2,trans:"conv",tyre:V.tyres[0],hitch:V.hitchMax-4,ballast:Math.round((V.maxMass-V.mass)/20)*10,redline:cfg.redline,idle:dsl?720:Math.max(750,cfg.cam>70?1100:850),seed:(rs^0xB011)>>>0,track:trk};
    setup=pcPullSetup(res,veh,C0,sk);veh.tyre=setup.tyre;veh.gear=setup.gear;
    if(r()<(100-rel)/100*PC_PULL_HAZ*st.wear*pcLuckK())veh.wornAt=1+r()*5;   // a tired engine gives up under load
    const ra=SIM.pullRunaway?SIM.pullRunaway(res,cfg,T.wear/20):{p:0};if(ra.p>0)veh.runaway={p:ra.p};
    pr=pcPullPass(res,veh,sk);broke=!!pr.broke;dq=pr.broke==="runaway"&&!pr.killed;why=broke?(pr.reasons&&pr.reasons[0])||"The engine let go under the sled.":"";
    me={n:pcFirst(T)+" (yours)",me:true,full:pr.full,ft:pr.distFt,po:null,dq};
    /* full pulls tie: the same truck on a heavier sled, and the dirt re-worked, for those who stayed full */
    if(pr.full&&!broke&&field.some(f=>f.full)){const v2=Object.assign({},veh,{sledK:PC_PULL_PO,track:{moist:+Math.min(0.95,trk.moist+0.06).toFixed(2),cut:0.12},seed:(veh.seed+99)>>>0});delete v2.wornAt;delete v2.runaway;
      poR=pcPullPass(res,v2,sk);me.po=poR.distFt;if(poR.broke){broke=true;why=(poR.reasons&&poR.reasons[0])||"The engine let go in the pull-off.";}}}
  const rows=field.concat(me?[me]:[]).sort((a,b)=>(a.dq?1:0)-(b.dq?1:0)||b.ft-a.ft||((b.po||0)-(a.po||0))||(a.me?-1:b.me?1:0));
  const rpos=T.rivals.map((x,i)=>1+rows.findIndex(y=>!y.me&&y.i===i));   // a DQ'd team sits last, so the rivals' places are their rows
  const top3="Top three: "+rows.slice(0,3).map((x,i)=>`${i+1}. ${x.me?pcFirst(T):x.n} ${x.full?"(full)":Math.round(x.ft)+" ft"}`).join(" · ");
  if(sat){lines.push(`${C0.n}, ${N} pullers. Sat this round out.`,top3);return{place:99,of:N,broke:false,why:"",lines,best:null,rpos,sat:true,rel};}
  const place=dq?N+1:rows.indexOf(me)+1,TY=SIM.PULL_TYRES[setup.tyre].n.toLowerCase(),gearName=(SIM.pullGears(k)[setup.gear]||[""])[0];
  lines.push(`${C0.n}: the crew went with ${TY} and ${gearName} gear. Drew ${ordN(slot+1)} of ${N}${o.back?", last: the extra engine pulls on the driest, most cut-up dirt":""} (${pullTrkName(night[slot])}).`);
  lines.push(pr.full?"Full pull, 300 ft.":`${pr.distFt.toFixed(1)} ft${pr.stopWhy&&!broke?`, ${pr.stopWhy==="bogged"?"bogged down":pr.stopWhy==="spun"?"spun out":pr.stopWhy==="lifted"?"lifted":pr.stopWhy==="killed"?"killed":"stopped"}`:""}.`);
  if(poR)lines.push(`Pull-off against ${field.filter(f=>f.full).length} full ${field.filter(f=>f.full).length===1?"pull":"pulls"} on a heavier sled: ${poR.full?"full again":poR.distFt.toFixed(1)+" ft"}.`);
  if(broke)lines.push(dq?`Disqualified: ${why}`:why);else{const rs=(pr.reasons||[]).filter(x=>!/^Track:/.test(x));if(rs.length&&!pr.full)lines.push(rs[0]);}
  lines.push(`Finished P${place>N?N:place} of ${N}${dq?" (disqualified)":""}.`,top3);
  return{place,of:N,broke,why,lines,best:pr.distFt,rpos,sat:false,rel};}
PC_KIND.pull={
  needHp:E=>PC_PULL[E.cls].m*0.7,
  make(T,E,base,r,pick){const P=PC_PULL[E.cls],f=(base-E.budget[0])/Math.max(1,E.budget[1]-E.budget[0]);
    T.fieldHp=Math.round(Math.min(P.m*(0.9+0.2*f),dynoCap().hp*0.9)/5)*5;T.rig=pick(PC_PULL_RIGS[P.rig]);T.num=1+Math.floor(r()*98);},
  rivals(T,E,r){const C0=SIM.PULL_CLASSES[E.cls],names=(C0.names||PULL_NAMES[C0.veh.kind]).slice();
    return[0,1,2,3,4,5,6].map(()=>({n:names.splice(Math.floor(r()*names.length),1)[0],sk:+pClamp(rnGauss(r),-2,2).toFixed(2),pts:0}));},
  back(n,T){n.fieldHp=Math.round(Math.min(T.fieldHp*1.1,dynoCap().hp*0.95)/5)*5;n.rig=T.rig;n.num=T.num;},
  site:(T,r)=>PC_PULL_SITES[Math.floor(r()*PC_PULL_SITES.length)],
  cond(T,W,r){const dm=(W.h-45)/100*0.4+rnGauss(r)*0.06;   // a humid day leaves the dirt damper all night
    W.night=pullNight(PC_EVENTS[T.ev].cls,pcRoundSeed(T),PC_PULL_SLOTS).map(t=>({moist:+pClamp(t.moist+dm,0.08,0.95).toFixed(2),cut:t.cut}));},
  condTxt(W){const a=pullTrkName(W.night[0]),b=pullTrkName(W.night[W.night.length-1]);return`Dirt: ${a} for the first hook${a===b?"":`, ${b} by the last`}`;},
  range:T=>({lo:T.fieldHp*0.7,hi:T.fieldHp*1.35}),
  but(T,E,res){const L=pcPullLegal(E);return L.ok?"":`, but it isn't legal in the class (${L.why})`;},
  rules(T,E){const L=pcPullLegal(E);return[{ok:L.ok,t:`${SIM.PULL_CLASSES[E.cls].n}: ${L.why}`}];},
  day:pcPullDay,
  pts:pl=>pl>PC_PULL_SLOTS?0:PULL_PTS[pl-1]||0,
  placeTxt:o=>o.sat?"Sat out":o.place>o.of?"Disqualified":o.broke?`Broke at ${Math.round(o.best)} ft (P${o.place} of ${o.of})`:`${o.place===1?"Won the hook":`P${o.place} of ${o.of}`} · ${o.best>=299.9?"full pull":Math.round(o.best)+" ft"}`,
  eff:o=>o.sat||o.broke?99:o.place,
  fieldTxt(T,E){const C0=SIM.PULL_CLASSES[E.cls];return`The field makes about ${Math.round(T.fieldHp*0.8/10)*10}–${Math.round(T.fieldHp*1.15/10)*10} hp and pulls about ${C0.field.med} ft, and finds a little more every round. A full pull ties for the win.`;},
  where:T=>esc(T.rig)+" · #"+T.num};
function pcPullLegal(E){try{return SIM.PULL_CLASSES[E.cls].legal(S.cfg);}catch(e){return{ok:false,why:"can't be teched"};}}
