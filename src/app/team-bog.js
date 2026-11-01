/* ===================== TEAM SEASONS: THE MUD BOG SERIES (since 1.76.48) =====================
   A third kind of team series, plugged into PC_KIND (see app/team.js): the shop supplies a bog truck for eight rounds. The three
   classes of the mud bog (Street 4x4, Modified, Open Super; BOG_CLASSES in sim/bog.js) are the three series rows below.
   Each round the series visits a different pit and draws its own mud, soupy to sticky clay (cond: the forecast on the team
   card names the mud ahead of race day, like the weather, and a wet, humid week runs soupier). Race day is the real
   SIM.bogPass run in the pit: the team's engine against seven rival trucks, each its own horsepower and driver, placed the
   bog way (through the pit beats stuck in it; through, the quicker time; stuck, the farther). The crew picks the tyre and gear
   in practice. The sim's own failures are on, and wear and a hard driver add a worn-out failure like the other series.
   The engine past the season's allowance runs last, in a pit seven trucks have already churned up (deeper, stickier mud).
   Holds: the three series rows (PC_EVENTS), the pit names, the points table, the bog setup helpers and PC_KIND.bog.
   Loaded after app/team.js and app/bog.js, which it leans on (PC_*, pcWx, pcMapRes, BOG_NAMES, bogCmp, bogScore). */
Object.assign(PC_EVENTS,{
  bstreet:{ev:"bog",cls:"street",n:"Street 4×4 bog",tier:0,rep:0,budget:[3000,6000],pay:[60000,80000],tip:"Plated pickups on mud-terrains: keep the wheels turning."},
  bmod:{ev:"bog",cls:"modified",n:"Modified bog",tier:1,rep:40,budget:[5000,9000],pay:[130000,170000],tip:"Lifted trucks on swampers with lockers at both ends."},
  bsuper:{ev:"bog",cls:"super",n:"Open Super bog",tier:2,rep:120,budget:[10000,17000],pay:[280000,360000],tip:"Tube chassis on paddle tyres: a clutch truck that stalls if it lugs."}});
/* the pits the series visits (a venue and its altitude), one a round; the points for 8 trucks */
const PC_BOG_PITS=[{n:"Gumbo Hollow Bog",alt:240},{n:"Cattail Slough Pit",alt:310},{n:"Sandhill Mud Park",alt:480},{n:"Red Clay Bog Pit",alt:590},{n:"Muskeg Motorsports Park",alt:350},{n:"Coulee Bottom Bog",alt:820}];
const PC_PTS_BOG=[20,16,13,10,8,6,4,2],PC_BOG_RIVALS=7,PC_BOG_RADIATOR=1.4;
/* the pit for the round: its own seed, so the length and the ruts change every round */
const pcBogSeed=T=>(pcRoundSeed(T)^0xB09B09)>>>0;
/* the night the round runs on: the sim's pit with the round's drawn mud; churned (o.back) deeper and stickier after seven trucks */
function pcBogNight(T,W,churn){const n=SIM.bogNight(pcBogSeed(T)),cons=Math.min(0.97,W.mud+(churn?0.08:0));
  return Object.assign({},n,{cons:+cons.toFixed(2),name:SIM.bogMudName(cons),depth:churn?n.depth.map(d=>+(d*1.15).toFixed(3)):n.depth});}
/* practice: every tyre and gear the class allows through the pit with the auto driver (failures off), best result wins. Every
   truck in the field does it too, so the team's crew has no edge over the rivals' crews. q: the winning practice pass. */
function pcBogSetup(res,red,idle,k,night,seed,sk){const C0=SIM.BOG_CLASSES[k];let best=null;
  for(const ty of C0.veh.tyres)for(let g=0;g<C0.gears.length;g++){let q;
    try{q=SIM.bogPass(res,{cls:k,gear:g,tyre:ty,redline:red,idle,seed:(seed^0x9AC7)>>>0,night,noFail:true},sk);}catch(e){continue;}
    const f={cleared:!!q.cleared,t:q.pitT,m:q.distM};
    if(!best||bogCmp(f,best.f)<0)best={f,gear:g,tyre:ty,q};}
  return best||{gear:1,tyre:C0.veh.tyres[C0.veh.tyres.length-1],q:{cleared:false,distM:20,pitT:null}};}
/* race day in the pit: the team's truck and your engine (cfg) against the series' seven rivals, one pass each in the same mud.
   Each rival's power grows a little every round (up) and moves with the air (W.k); the rival's pass is the real sim with failures
   off, and a 6% chance it breaks on its own. o: the morning's call, {M: the map, sk: the driver's skill on it, back: the extra engine} */
function pcBogDay(T,sat,cfg,o){const E=PC_EVENTS[T.ev],k=E.cls,C0=SIM.BOG_CLASSES[k],st=PC_STYLES[T.style],seed=pcRoundSeed(T),r=rnRng((seed^0xB06)>>>0),W=pcWx(T,true),
    env=Object.assign({},S.env,stdCell(),pcWxEnv(W)),up=(1+PC_FIELD_UP*T.round)*W.k,night=pcBogNight(T,W,false),L=night.len;
  const rows=T.rivals.map((rv,i)=>{const hp=Math.round(T.fieldHp*rv.k*up*(0.97+0.06*r())),ai=SIM.bogAiRes(hp,rv.dsl,(seed+i*977)>>>0),q=pcBogSetup(ai,ai.redline,rv.dsl?720:850,k,night,(seed^(i+1)*2654435761)>>>0,rv.sk).q;
    const row={n:rv.n,i,cleared:!!q.cleared,t:q.cleared?q.pitT:null,m:q.cleared?L:q.distM};
    if(r()<0.06){row.broke=true;row.cleared=false;row.t=null;row.m=+(row.m*(0.25+0.6*r())).toFixed(2);}
    return row;});
  const lines=[`Round ${T.round+1}: ${pcWxTxt(W,false,T)}.`],top3=a=>"Top three: "+a.slice().sort(bogCmp).slice(0,3).map((x,i)=>`${i+1}. ${x.n} ${bogScore(x)}`).join(" · ");
  if(sat){const s=rows.slice().sort(bogCmp);lines.push("Sat this round out.");lines.push(top3(rows));
    return{place:99,of:rows.length+1,broke:false,why:"",lines,best:null,rpos:rows.map(x=>s.indexOf(x)+1),sat:true,rel:0};}
  const my=o.back?pcBogNight(T,W,true):night;
  const res=pcMapRes(SIM.bogPrep(cfg,env),o.M),rel=Math.max(0,res.rel-T.wear),idle=SIM.isDiesel(cfg)?720:Math.max(750,cfg.cam>70?1100:850),su=pcBogSetup(res,cfg.redline,idle,k,my,seed,o.sk);
  const veh={cls:k,gear:su.gear,tyre:su.tyre,redline:cfg.redline,idle,seed:(seed^0x51ED)>>>0,night:my};
  if(r()<(100-rel)/100*0.3*st.wear*pcLuckK())veh.wornAt=1.5+4*r();
  let pr;try{pr=SIM.bogPass(res,veh,o.sk);}catch(e){pr=null;}
  const broke=!pr||!!pr.broke,cleared=!!pr&&pr.cleared&&!broke,TY=SIM.BOG_TYRES[su.tyre];
  const me={n:pcFirst(T)+" (yours)",me:true,cleared,t:cleared?pr.pitT:null,m:cleared?L:(pr?pr.distM:0),broke};
  const all=rows.concat([me]).sort(bogCmp),place=all.indexOf(me)+1,why=!broke?"":pr&&pr.reasons&&pr.reasons[0]?pr.reasons[0]:"The engine let go in the pit.";
  lines.push(`Practice: the crew chose ${TY.n.toLowerCase()} in ${C0.gears[su.gear][0]}.`);
  if(o.back)lines.push(`The extra engine runs last, in a pit seven trucks have churned up: ${my.name} mud, 15% deeper.`);
  lines.push(broke?`Out ${pr?pr.distM.toFixed(1):"0"} m into the pit, P${place} of ${all.length}.`:cleared?`Through in ${pr.pitT.toFixed(2)} s, P${place} of ${all.length}.`:`Stuck ${pr.distM.toFixed(1)} m into the pit, P${place} of ${all.length}.`);
  if(pr){const why2=broke?why:pr.reasons[cleared?1:0];if(why2)lines.push(why2);}
  lines.push(top3(all));
  return{place,of:all.length,broke,why,lines,best:cleared?pr.pitT:null,rpos:rows.map(x=>all.indexOf(x)+1),sat:false,rel};}
PC_KIND.bog={needHp:E=>SIM.BOG_CLASSES[E.cls].field.hp,
  make(T,E,base,r,pick){const F=SIM.BOG_CLASSES[E.cls].field,f=(base-E.budget[0])/(E.budget[1]-E.budget[0]);
    T.fieldHp=Math.round(Math.min(F.hp*(0.92+0.16*f),dynoCap().hp*0.9));T.truck=pick(BOG_NAMES);T.num=1+Math.floor(r()*98);},
  rivals(T,E,r){const C0=SIM.BOG_CLASSES[E.cls],F=C0.field,names=BOG_NAMES.filter(n=>n!==T.truck),ks=[0.86,0.93,0.97,1.0,1.03,1.08,1.15],take=a=>a.splice(Math.floor(r()*a.length),1)[0];
    return ks.slice(0,PC_BOG_RIVALS).map(k=>({n:take(names),k,sk:+(0.5+0.5*r()).toFixed(2),dsl:r()<F.dsl,pts:0}));},
  back(n,T){n.fieldHp=Math.round(Math.min(T.fieldHp*1.1,dynoCap().hp*0.95));n.truck=T.truck;n.num=T.num;},
  site:(T,r)=>PC_BOG_PITS[Math.floor(r()*PC_BOG_PITS.length)],
  /* the round's mud, drawn on its own stream: a wetter week runs soupier. Race day lands a touch off the forecast. */
  cond(T,W,r,day){const wet=1-(W.h-12)/80;let m=0.05+0.9*(0.7*r()+0.3*Math.max(0,Math.min(1,wet)));if(day)m+=rnGauss(r)*0.03;
    W.mud=+Math.max(0.05,Math.min(0.95,m)).toFixed(2);W.mudName=SIM.bogMudName(W.mud);W.len=SIM.bogNight(pcBogSeed(T)).len;},
  condTxt:(W,fc)=>`${fc?"Mud ahead":"The mud was"}: ${W.mudName}, ${W.len} m of pit`,
  range:T=>({lo:T.fieldHp*0.88,hi:T.fieldHp*1.15}),
  but(T,E,res,hp){const F=SIM.BOG_CLASSES[E.cls].field;return hp>F.hp*PC_BOG_RADIATOR?`, but the class radiator only copes with about ${Math.round(F.hp*PC_BOG_RADIATOR/10)*10} hp: more runs hot in the mud`:"";},
  rules(T,E,res){const C0=SIM.BOG_CLASSES[E.cls],F=C0.field,o=[{ok:true,t:`${C0.n}: ${C0.veh.tyres.map(t=>SIM.BOG_TYRES[t].n.toLowerCase()).join(" or ")}, ${C0.veh.driveN}`}];
    if(res.peakHp>F.hp*PC_BOG_RADIATOR)o.push({ok:true,wn:true,t:`The radiator copes with about ${Math.round(F.hp*PC_BOG_RADIATOR/10)*10} hp: past that it runs hot in the pit`});return o;},
  day:pcBogDay,
  pts:pl=>PC_PTS_BOG[pl-1]||0,placeTxt:o=>o.sat?"Sat out":o.broke?`DNF (P${o.place} of ${o.of})`:o.place===1?"Won the bog":`P${o.place} of ${o.of}`,eff:o=>o.sat||o.broke?99:o.place,
  fieldTxt:(T,E)=>`The field makes about ${Math.round(T.fieldHp*0.88/10)*10}–${Math.round(T.fieldHp*1.15/10)*10} hp, finds a little more every round, and every round is a new pit: soupy to sticky clay.`,
  where:T=>`${esc(T.truck)} · #${T.num}`};
