/* ===================== TROPHY ROOM =====================
   What the shop has won, set and kept, in one room. The game already keeps records (recs()), achievements (S.ach), goals
   (C().goals), sponsors (spS()) and team seasons (pcS()); what it didn't keep is a dated history of wins, so this adds
   one: an additive log per mode (career C().trophies, sandbox S.sbTrophies = {v, log:[...], retired:[...]}), filled
   from the achCheck() hook at the end of every event and seeded from the records the first time a save meets it.
   Events are data: TROPHY_EV lists each with its achCheck types, its trophy shape and how to read a win; an event with
   no entry still lands on the shelf when its result has place 1 (an obelisk until someone gives it a shape).
   Retired engines are snapshots (cfg, name, peak hp, best results) shown on stands in the room and loadable again. */
const TROPHY_LOG_MAX=240,TROPHY_RET_MAX=24,TR_STANDS=6;   // TR_STANDS matches the vis room's stand count
const trF=(v,d)=>v==null||!isFinite(v)?"—":(+v).toFixed(d);
const trCls=(T,k)=>T&&T[k]&&T[k].n||k||"";
const trHill=k=>trCls(SIM.HILL_CLASSES,k),trCh=e=>e&&SIM.CHASSIS&&SIM.CHASSIS[e.ch]?SIM.CHASSIS[e.ch].n:"";   // Pikes Peak: class name, and the car the record was set in
const TROPHY_EV=[
  {k:"drag",n:"Drag racing",shape:"cup",types:["drag"],win:x=>{const r=x.r,nt=r&&r.night;if(x.failed||!nt||nt.place!==1)return null;const car=(SIM.AERO[r.body]||{}).n||"";
    return{t:"Won the night",what:`${RN_FMT[nt.fmt]||"Race night"} at Prairie Dragway — beat ${nt.opp||"the field"} in the final.`,nums:[["ET",r.et!=null?trF(r.et,3)+" s":"—"],["Trap",r.mph!=null?Math.round(r.mph)+" mph":"—"],["Reaction",r.race&&r.race.rt!=null?trF(r.race.rt,3):"—"],["Class",car]],veh:car,u:"d"+(r.at||Date.now())};}},
  {k:"pull",n:"Truck & tractor pull",shape:"wrench",types:["pull"],win:x=>{const r=x.r;if(x.failed||r.poPending||r.dq||r.place!==1)return null;
    return{t:`${r.clsName||"Pull"} — first`,what:`Longest pull of the night${r.pullOff!=null?", settled in a pull-off":""}${r.of?" against "+(r.of-1)+" others":""}.`,nums:[["Distance",r.full?"FULL · 300 ft":trF(r.distFt,1)+" ft"],["Pull-off",r.pullOff!=null?trF(r.pullOff,1)+" ft":"—"],["Gear",r.gearName||"—"],["Field",r.of||"—"]],veh:r.clsName||""};},
    extra:x=>{const r=x.r,s=r&&r.ser;if(x.failed||!s||!s.done||!s.champMe)return null;return{t:"Series champion",shape:"title",what:`${r.clsName||"Pulling"} series, season ${s.season} — ${s.pts} points over ${s.n} rounds.`,nums:[["Points",(s.stand.find(q=>q.me)||{}).pts||"—"],["Season",s.season],["Rounds",s.n]],veh:r.clsName||"",u:"ps"+s.season+(r.cls||"")};}},
  {k:"salt",n:"Bonneville",shape:"salt",types:["salt"],win:x=>{const r=x.r;if(x.failed||!r||r.outcome!=="record")return null;
    return{t:`Class record · ${r.cls&&r.cls.key||""}`,what:`Two-way average over the mile on the ${r.courseName||"salt"}${r.rec?`, beating ${trF(r.rec.mph,3)} mph`:""}.${r.club?" Into the 200 MPH Club.":""}`,nums:[["Record",trF(r.avg,3)+" mph"],["Runs",r.firstMph!=null?trF(r.firstMph,1)+" / "+trF(r.mileMph,1):"—"],["Peak",r.peakMph!=null?Math.round(r.peakMph)+" mph":"—"],["Body",r.clsName||"—"]],veh:r.clsName||""};}},
  {k:"bog",n:"Mud bog",shape:"boot",types:["bog"],win:x=>{const r=x.r;if(x.failed||r.place!==1)return null;
    return{t:`${r.clsName||"Mud bog"} — first`,what:r.cleared?"Through the pit quickest of the night.":"Farthest into the pit of the night.",nums:[["Result",r.cleared?trF(r.pitT,2)+" s":trF(r.distM,1)+" m"],["Field",r.of||"—"],["Driver",r.auto?"auto":"you"]],veh:r.clsName||""};}},
  {k:"road",n:"Road course",shape:"wheel",types:["road"],win:x=>{const r=x.r;if(x.failed||!r||r.lapT==null||!(r.rivBeat||(r.pb&&r.pb.was)))return null;
    return{t:r.rivBeat?`Head-to-head · ${r.trkName||"the circuit"}`:`Lap record · ${r.trkName||"the circuit"}`,tier:r.rivBeat?"gold":"silver",what:r.rivBeat?`Beat a rival's posted lap at ${r.trkName||"the circuit"} in ${r.chName||"their car"}.`:`A new best around ${r.trkName||"the circuit"} in ${r.chName||"the car"}, ${trF(r.pb.was-r.lapT,2)} s under the old mark.`,nums:[["Lap",fmtLap(r.lapT,2)],["0–100",r.zero100!=null?trF(r.zero100,1)+" s":"—"],["Top",r.top&&r.top.kmh?Math.round(r.top.kmh)+" km/h":"—"],["Tyres",r.tyreName||"—"]],veh:r.chName||""};}},
  {k:"e24",n:"24 Hours of Prairie Sky",shape:"tallcup",types:["e24"],win:x=>{const r=x.r;if(!r||!r.classified||!(r.posCls<=3))return null;
    return{t:r.posCls===1?`Class win · ${r.clsName}`:`${ordN(r.posCls)} in ${r.clsName}`,tier:r.posCls===1?"gold":r.posCls===2?"silver":"bronze",what:`${r.laps} laps of ${r.trkName}, ${ordN(r.pos)} overall of ${r.of}.`,nums:[["Distance",Math.round(r.km||0).toLocaleString("en-CA")+" km"],["Laps",r.laps],["Best lap",fmtLap(r.bestLap!=null?r.bestLap:r.best,2)],["Pits",r.pits!=null?r.pits:"—"]],veh:r.chName||""};}},
  {k:"pikes",n:"Pikes Peak",shape:"peak",types:["pikes","hill","hillclimb","pikes_peak"],win:x=>{const r=x.r;if(!r||r.dnf||r.place!==1)return null;
    return{t:`${r.clsName||"Pikes Peak"} — King of the Mountain`,what:`To the summit in ${fmtHill(r.time)}, quickest of ${r.of}.`,nums:[["Time",fmtHill(r.time)],["Average",r.avgKmh!=null?r.avgKmh+" km/h":"—"],["Field",r.of||"—"],["Driver",r.auto?"auto":"you"]],veh:r.chName||""};}},
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
  const nw=(R.nightsWon||0)-(tropSeed.night?1:0);if(nw>0)add({ev:"drag",t:nw>1?`Won the night ×${nw}`:"Won the night",x:nw,what:`Race nights won at Prairie Dragway${R.nightsRun?` — ${R.nightsWon} of ${R.nightsRun} entered`:""}, before the trophy room kept dates.`,nums:[["Won",nw],["Entered",R.nightsRun||"—"]]},{});
  (Array.isArray(R.pullTitles)?R.pullTitles:[]).forEach(p=>add({ev:"pull",shape:"title",t:"Series champion",what:`${trCls(SIM.PULL_CLASSES,p.k)} series, season ${p.season}.`,nums:[["Points",p.pts],["Season",p.season]],veh:trCls(SIM.PULL_CLASSES,p.k)},p));
  if(R.pull&&typeof R.pull==="object")Object.keys(R.pull).forEach(k=>{const e=R.pull[k];if(e&&e.full)add({ev:"pull",tier:"silver",t:`Full pull · ${trCls(SIM.PULL_CLASSES,k)}`,what:"Dragged the sled the whole 300 ft.",nums:[["Distance","300 ft"]],veh:trCls(SIM.PULL_CLASSES,k)},e);});
  if(R.bog&&typeof R.bog==="object")Object.keys(R.bog).forEach(k=>{const e=R.bog[k];if(e&&e.c)add({ev:"bog",tier:"silver",t:`Through the pit · ${trCls(SIM.BOG_CLASSES,k)}`,what:"Cleared the whole pit.",nums:[["Best",trF(e.t,2)+" s"]],veh:trCls(SIM.BOG_CLASSES,k)},e);});
  if(R.hill&&typeof R.hill==="object")Object.keys(R.hill).forEach(k=>{const e=R.hill[k];if(e&&e.t)add({ev:"pikes",tier:"silver",t:`To the summit · ${trHill(k)}`,what:"Ran Pikes Peak clean, bottom to top.",nums:[["Best",fmtHill(e.t)]],veh:trCh(e)},e);});
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
    if(ent.slot!=="pennant"&&k!=="dd")setTimeout(()=>toast(`TROPHY ROOM · ${ent.t}`),5600);}
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
  if(R.hill&&typeof R.hill==="object")Object.keys(SIM.HILL_CLASSES).forEach(k=>{const e=R.hill[k];if(e&&e.t)slip("h"+k,"Pikes Peak · "+trHill(k),fmtHill(e.t),"","Quickest run to the summit in the class.",e,[["Time",fmtHill(e.t)],["Car",trCh(e)||"—"]],trCh(e));});
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
  if(R.hill)Object.keys(R.hill).forEach(k=>{const e=R.hill[k];if(mine(e)&&e.t)out.push(["Pikes Peak · "+trHill(k),fmtHill(e.t)]);});
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
  box.innerHTML=h;box.hidden=false;}
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
document.addEventListener("click",e=>{const o=e.target.closest("[data-trophy]");if(o){e.preventDefault();tropOpen();return;}
  if(!TR.open)return;const p=e.target.closest("[data-trp]");if(p){tropCard(p.dataset.trp);if(TR.gl&&window.matchMedia&&!deskOn())tropListShow(false);if(TR.gl&&!TR.list)ENGINE_VIS.trophyFocus(p.dataset.trp);return;}
  const a=e.target.closest("[data-tra]");if(!a)return;const k=a.dataset.tra,id=a.dataset.id;
  if(k==="close"){tropPick(null);}else if(k==="load")tropLoad(id);else if(k==="front")tropFront(id);else if(k==="remove")tropRemove(id);else if(k==="retire")tropRetire();
  else if(k==="share"){(async()=>{try{await document.fonts.ready;}catch(err){}const c=tropPlaqueCanvas(id);if(c)tropShareCanvas(c,"trophy-plaque.png","Trophy plaque");})();}});
$("trBack").addEventListener("click",tropClose);
$("trListBtn").addEventListener("click",()=>tropListShow(!TR.list));
$("trPhoto").addEventListener("click",async()=>{try{await document.fonts.ready;}catch(e){}tropShareCanvas(tropPhotoCanvas(),"trophy-room.png","Trophy room");});
document.addEventListener("keydown",e=>{if(!TR.open)return;if(e.key!=="Escape"){e.stopPropagation();return;}e.preventDefault();e.stopPropagation();if(TR.sel)tropPick(null);else tropClose();},true);   // the bench's single-key shortcuts sleep while the room is open
{const f=renderRecords;renderRecords=function(){f();tropCountSync();};const g=renderShop;renderShop=function(){g.apply(this,arguments);tropCountSync();};}
