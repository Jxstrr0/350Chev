/* ===================== TEAM SEASONS: THE BOAT DRAGS (since 1.76.49) =====================
   A series kind for the career's team seasons (team.js, PC_KIND): the four boat classes (outboard, jet boat, Pro
   Eliminator, Top Fuel Hydro) run as eight-round series. The shop supplies the engine; the team's hull and driver turn it
   into a boat. Race day is a night of boat drags on a lake or river: one qualifying pass for each of the eight boats, then
   a heads-up ladder (quarter-final, semi-final, final), each round one pass against the boat in the other lane, first to
   the far buoys wins. The team's own passes are the real SIM.boatPass (hull, prop or pump, hop and blowout physics); the
   seven rivals run one real qualifying pass each and their ladder passes are drawn around it, the way the drag day does.
   The headline is the water: every round has its own wind and chop (SIM.boatWater, drawn in cond), and the forecast on
   the team card names it ahead of time. The crew picks the prop for the forecast water (SIM.boatTune, quick grid), so a
   rough forecast gets a prop that doesn't blow out over the hops, a calm one the quickest pitch; race day's water lands
   a little off the forecast. The extra engine past the season allowance is seeded last, so it meets the top seed first. */
Object.assign(PC_EVENTS,{
  boutboard:{ev:"boat",cls:"outboard",n:"Outboard boat drags",tier:0,rep:0,budget:[2500,4800],pay:[60000,80000],tip:"Stock V-bottoms: 3.3 L and under, and a prop to pick for the water."},
  bjet:{ev:"boat",cls:"jet",n:"Jet boat drags",tier:1,rep:40,budget:[4000,9000],pay:[130000,170000],tip:"Flat-bottoms on a pump, no prop to blow out: the impeller cut sets the load."},
  bpro:{ev:"boat",cls:"pro",n:"Pro Eliminator boats",tier:3,rep:300,budget:[16000,36000],pay:[600000,780000],tip:"Blown flat-bottoms on a cleaver prop: it takes 1,900 hp to win, and a hop can unload it."},
  btfh:{ev:"boat",cls:"tfh",n:"Top Fuel Hydro",tier:4,rep:700,budget:[36000,54000],pay:[1200000,1600000],tip:"Three-point hydros that ride on their props: nitro makes 2,900 hp, and a light nose will flip them."}});
/* the lakes and river reaches the series visits: a different one each round (alt: metres above sea level, for the air) */
const PC_LAKES=[{n:"Lakeshore Reach",alt:180},{n:"Gopher River Course",alt:420},{n:"Prairie Sky Reservoir",alt:600},{n:"Red Butte Lake",alt:760},{n:"Coulee Narrows",alt:1050},{n:"Bow River Straight",alt:1100}];
const PC_BOAT_SPREAD=[-1.5,-0.9,-0.4,0,0.4,0.9,1.5];   // the rivals' power, in class standard deviations from the field
const pcBoatCls=E=>SIM.BOAT_CLASSES[E.cls];
const pcBoatWaterName=c=>c<0.12?"glassy":c<0.3?"light ripple":c<0.55?"a little chop":"rough";
const pcBoatIdle=cfg=>SIM.isDiesel(cfg)?650:Math.max(750,cfg.cam>70?1100:850);
const pcBoatLitres=res=>res?(res.Vd||res.VdEq||0)/1000:0;
/* the prop the crew picks, as words */
function pcBoatPropTxt(b,C0){return C0.drive==="jet"?`${SIM.BOAT_IMP[b.imp][1]} impeller at ${b.gear.toFixed(2)}:1`:`${b.pitch}" pitch at ${b.gear.toFixed(2)}:1`;}
/* race day on the water. o: the morning's call, {M: the map, sk: the driver's skill on it, back: the extra engine} */
function pcBoatDay(T,sat,cfg,o){const E=PC_EVENTS[T.ev],C0=pcBoatCls(E),F=C0.field,st=PC_STYLES[T.style],rs=pcRoundSeed(T),r=rnRng((rs^0xB0A7)>>>0),W=pcWx(T,true),Wf=pcWx(T,false),
  env=Object.assign({},S.env,stdCell(),pcWxEnv(W)),up=(1+PC_FIELD_UP*T.round)*W.k,water=W.water,sk=o.sk;
  const res=pcMapRes(SIM.boatPrep(cfg,env),o.M),rel=Math.max(0,res.rel-T.wear),mv={cls:E.cls,redline:cfg.redline,idle:pcBoatIdle(cfg),trim:+(0.4*(sk-0.7)).toFixed(1)};
  let prop=null;
  if(!sat){prop=SIM.boatTune(res,E.cls,Object.assign({},mv,{water:Wf.water}),true);   // the crew's pick for the forecast water, not the day's
    if(prop.pitch!=null)mv.pitch=prop.pitch;if(prop.imp!=null)mv.imp=prop.imp;mv.gear=prop.gear;}
  const field=T.rivals.map((rv,i)=>{const hp=Math.round(Math.max(F.hp*0.6,T.fieldHp*rv.k*up*(0.97+0.06*r()))),ai=SIM.bogAiRes(hp,rv.dsl,rv.rs);
    ai.kg=Math.round((rv.dsl?420:130)+hp*(rv.dsl?0.9:0.07));
    if(F.red){const rr=rnRng((rv.rs^0x77)>>>0);ai.redline=F.red[0]+Math.round(rr()*(F.red[1]-F.red[0])/100)*100;}
    const vEst=F.mph*0.44704*Math.cbrt(hp/F.hp),veh=Object.assign({cls:E.cls,redline:ai.redline,idle:rv.dsl?650:850,trim:+(0.4*(rv.sk-0.7)).toFixed(1),noFail:true,water,seed:(rs+i*7919)>>>0,rt:rv.rt},SIM.boatGuess(ai,E.cls));
    let q=null;try{q=SIM.boatPass(ai,veh,rv.sk);}catch(e){}
    const mean=q&&q.et?q.et:+(SIM.BOAT_FT/(0.6*vEst)).toFixed(3),mph=q&&q.mph?q.mph:+(vEst/0.44704).toFixed(1);
    return{name:rv.n,boat:rv.boat,hp,mean,mph,sd:+(mean*(0.004+0.012*(1-rv.sk)+0.02*water.chop)).toFixed(3),rt:rv.rt,rtSd:+(0.012+0.02*(1-rv.sk)).toFixed(3),brk:+(0.02+0.04*r()).toFixed(3),red:rv.red,dial:null};});
  const haz=(100-rel)/100*0.12*st.wear*pcLuckK(),rtM=0.06+0.12*(1-sk)-(T.style==="hotshoe"?0.012:0),rtSd=0.01+0.02*(1-sk),redK=0.008+0.03*(1-sk)+(T.style==="hotshoe"?0.012:0);let pn=0;
  const mine=()=>{if(sat)return{rt:0.5,et:null,broke:true,why:"Sat out."};
    const rt=r()<redK?-+(0.002+0.03*r()).toFixed(3):+Math.max(0.005,rtM+rnGauss(r)*rtSd).toFixed(3),veh=Object.assign({},mv,{water,seed:(rs^(++pn*104729))>>>0,rt:Math.max(0,rt)});
    if(r()<haz)veh.wornAt=0.6+r()*3;   // worn out: the wear and a hard driver find the weak part
    let q=null;try{q=SIM.boatPass(res,veh,sk);}catch(e){}
    const why=q&&q.reasons&&q.reasons[0]?q.reasons[0]:"It didn't make it down the course.";
    if(!q||q.broke)return{rt,et:null,broke:true,why:q&&q.broke==="worn"&&T.wear>8?why+" (it was due a freshen-up)":why,x:q?q.dist:0};
    if(q.et==null)return{rt,et:null,broke:false,why,x:q.dist};   // blew over, hooked or stuffed it: the boat is fine, the round is lost
    return{rt,et:+(q.et*(1+rnGauss(r)*(0.001+0.003*(1-sk)))).toFixed(3),mph:q.mph,broke:false};};
  const f3=v=>v==null?"—":v.toFixed(3),rtTxt=v=>v<0?"red light":f3(v).replace(/^0/,"");
  const lines=[`Round ${T.round+1}: ${pcWxTxt(W,false,T)}.`];
  if(prop)lines.push(`The crew picked ${pcBoatPropTxt(prop,C0)} for the forecast (${Wf.water.name} water).`);
  const q0=mine(),Q=[q0].concat(field.map(f=>rnRivalPass(f,r,0))),places=new Array(8).fill(null);
  let out=q0.broke,broke=q0.broke&&!sat,why=sat||!q0.broke?"":q0.why,best=q0.et;
  const seeds=[0,1,2,3,4,5,6,7].sort((a,b)=>(Q[a].et==null?99:Q[a].et)-(Q[b].et==null?99:Q[b].et)||a-b);
  if(o.back&&!sat){seeds.splice(seeds.indexOf(0),1);seeds.push(0);}   // the extra engine: seeded last, so it meets the top seed first
  const fq=`The field ran ${f3(Math.min(...Q.slice(1).map(x=>x.et||99)))} to ${f3(Math.max(...Q.slice(1).map(x=>x.et||0)))}.`;
  if(sat)lines.push(`Sat this round out. ${fq}`);
  else if(q0.broke)lines.push(`Qualifying: broke. ${q0.why}`);
  else if(q0.et==null)lines.push(`Qualifying: no time. ${q0.why} Seeded #${seeds.indexOf(0)+1} of 8.`);
  else lines.push(`Qualifying: ${f3(q0.et)} @ ${Math.round(q0.mph)} mph, seeded #${seeds.indexOf(0)+1} of 8${o.back?" (the extra engine starts from the back: it meets the top seed first)":""}. ${fq}`);
  let pairs=rnPairs(seeds).map(([a,b])=>({a,b,win:null}));const RN=["Quarter-final","Semi-final","Final"],LOSE=[5,3,2];
  const solo=rv=>{const pa=rnRivalPass(rv,r,0);return Object.assign({x:pa.broke?SIM.BOAT_FT*pa.at:SIM.BOAT_FT,dq:false},pa);};
  for(let ri=0;ri<3;ri++){
    for(const m of pairs){
      if(m.a!==0&&m.b!==0){const j=rnJudge(solo(field[m.a-1]),solo(field[m.b-1]),false);m.win=j.w===0?m.a:m.b;}
      else{const oi=m.a===0?m.b:m.a,rv=field[oi-1];
        if(out){m.win=oi;if(!q0.broke)lines.push(`${RN[ri]} vs ${rv.name}: out, no boat to race.`);}
        else{const me=mine(),op=solo(rv),j=rnJudge(Object.assign({x:me.x!=null?me.x:SIM.BOAT_FT,dq:false},me),op,false),won=j.w===0;
          if(me.et!=null)best=best==null?me.et:Math.min(best,me.et);
          const how=j.why==="red"?(me.rt<0?"red light":"they red-lit"):j.why==="dnf"||j.why==="dnf2"?(me.et==null?(me.broke?"broke":"didn't finish"):"they broke"):`${rtTxt(me.rt)} / ${f3(me.et)} against ${rtTxt(op.rt)} / ${f3(op.et)}${j.holeshot?" (holeshot)":""}`;
          lines.push(`${RN[ri]} vs ${rv.name}: ${won?"won":"lost"}, ${how}.`);m.win=won?0:oi;
          if(me.et==null){out=true;lines.push(me.why);if(me.broke){broke=true;why=me.why;}}}}
      places[m.win===m.a?m.b:m.a]=LOSE[ri];}
    if(ri<2)pairs=rnNextPairs(pairs);else places[pairs[0].win]=1;}
  if(q0.broke&&!sat)places[0]=9;
  return{place:places[0],of:8,broke,why,lines,best,rpos:T.rivals.map((x,i)=>places[i+1]),sat:!!sat,rel};}
PC_KIND.boat={needHp:E=>pcBoatCls(E).field.hp*0.85,
  make(T,E,base,r,pick){const C0=pcBoatCls(E),f=(base-E.budget[0])/Math.max(1,E.budget[1]-E.budget[0]);
    T.fieldHp=Math.round(Math.min(C0.field.hp*(0.88+0.24*f)*(0.97+0.06*r()),dynoCap().hp*0.9));T.boat=pick(BOAT_HN[E.cls]||BOAT_HN.outboard);},
  rivals(T,E,r){const C0=pcBoatCls(E),F=C0.field,drv=BOAT_DRV.filter(n=>n!==T.name),hulls=(BOAT_HN[E.cls]||BOAT_HN.outboard).filter(n=>n!==T.boat),take=a=>a.splice(Math.floor(r()*a.length),1)[0];
    return PC_BOAT_SPREAD.map(z=>{const sk=+(0.55+0.45*r()).toFixed(2);
      return{n:take(drv),boat:take(hulls)||C0.n,k:+(1+z*F.sd/F.hp).toFixed(3),sk,dsl:r()<F.dsl,rs:Math.floor(r()*1e9)+1,rt:+(0.035+0.12*(1-sk)+0.05*r()).toFixed(3),red:r()<0.12?+(0.01+0.03*r()).toFixed(3):0,pts:0};});},
  back(n,T){n.fieldHp=Math.round(Math.min(T.fieldHp*1.12,dynoCap().hp*0.95));n.boat=T.boat;},
  site:(T,r)=>PC_LAKES[Math.floor(r()*PC_LAKES.length)],
  /* the round's water on its own stream: the forecast's, and on race day a little off it */
  cond(T,W,r,day){const w=SIM.boatWater(Math.floor(r()*4294967296)>>>0);
    if(day){const d=rnRng((pcRoundSeed(T)^0x0DA7E)>>>0);w.wind=+(w.wind+rnGauss(d)*0.7).toFixed(1);w.chop=+Math.min(0.85,Math.max(0,w.chop+rnGauss(d)*0.06)).toFixed(2);w.name=pcBoatWaterName(w.chop);}
    W.water=w;},
  condTxt:(W,fc)=>`Water ${W.water.name}, a ${Math.abs(W.water.wind).toFixed(1)} m/s ${W.water.wind>=0?"head":"tail"}wind${W.water.chop>=0.55?(fc?": the prop will unload over the hops":": the hops unloaded the prop"):""}`,
  range(T,E){const sd=pcBoatCls(E).field.sd;return{lo:T.fieldHp-sd,hi:T.fieldHp+sd};},
  but(T,E,res){const C0=pcBoatCls(E),L=pcBoatLitres(res);return C0.maxL&&L>C0.maxL+0.005?`, but at ${L.toFixed(1)} L it's over the class's ${C0.maxL} L`:"";},
  rules(T,E,res){const C0=pcBoatCls(E),L=pcBoatLitres(res);return C0.maxL?[{ok:L<=C0.maxL+0.005,t:`Displacement ${L.toFixed(1)} L (the class takes ${C0.maxL} L and under)`}]:[];},
  day:pcBoatDay,
  pts:pl=>PC_PTS_DRAG[pl]||0,placeTxt:o=>o.sat?"Sat out":({1:"Won the night",2:"Runner-up",3:"Out in the semi",5:"Out in round 1",9:"Did not qualify"})[o.place]||"Out early",eff:o=>o.sat?99:o.place,
  fieldTxt(T,E){const C0=pcBoatCls(E),sd=C0.field.sd,d=C0.d.replace(/ · /g,", ");return`The field makes about ${Math.round((T.fieldHp-sd)/10)*10}–${Math.round((T.fieldHp+sd)/10)*10} hp, and finds a little more every round. ${d.charAt(0).toUpperCase()+d.slice(1)}.`;},
  where:T=>`${esc(SIM.BOAT_HULLS[SIM.BOAT_CLASSES[PC_EVENTS[T.ev].cls].hull].n)} · ${esc(T.boat)}`};
