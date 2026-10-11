/* ===================== SHOP: career ===================== */
function catOpen(cat){return C().rep>=cat.rep&&(!cat.needs||has(cat.needs));}
function catPool(cat){const tier=repTierIdx();let pool=cat.segs.map(id=>SEGMENTS.find(s=>s.id===id)).filter(s=>s&&s.tier<=tier&&(s.tier<5||has("race")));
  const cap=dynoCap();const measurable=pool.filter(s=>!s.req.hp||s.req.hp[0]<=cap.hp);if(measurable.length)pool=measurable;
  // lean toward the top of what the shop can do: keep the two highest tiers on offer, plus one easy fallback
  const top=Math.max(...pool.map(s=>s.tier),0);const near=pool.filter(s=>s.tier>=top-1);const easy=pool.filter(s=>s.tier<top-1);
  return near.concat(easy.length?[easy[Math.floor(rng()*easy.length)]]:[]);}
function offersFor(catId){const o=C().offers;if(!o||o.week!==C().week)C().offers={week:C().week,byCat:{}};
  const by=C().offers.byCat;if(by[catId])return by[catId];const cat=CATS.find(c=>c.id===catId);if(!cat||!catOpen(cat))return(by[catId]=[]);
  const pool=catPool(cat);if(!pool.length)return(by[catId]=[]);const n=staffed("sales")?3:2;const picks=[];const bag=pool.slice();
  for(let i=0;i<n;i++){if(!bag.length)bag.push(...pool);const j=Math.floor(rng()*bag.length);picks.push(genContract(bag.splice(j,1)[0]));}
  return(by[catId]=picks);}
function genContract(seg){
  if(!seg){const tier=repTierIdx();let pool=SEGMENTS.filter(s=>s.tier<=tier&&s.tier>=Math.max(0,tier-2)&&(s.tier<5||has("race")));const cap=dynoCap();const m=pool.filter(s=>!s.req.hp||s.req.hp[0]<=cap.hp);if(m.length)pool=m;seg=pool[Math.floor(rng()*pool.length)];}
  const client=CLIENTS[Math.floor(rng()*CLIENTS.length)];const R=seg.req,req={};
  if(R.hp)req.hp=R.hp[0]+Math.round(rng()*(R.hp[1]-R.hp[0])/10)*10;
  if(R.tq)req.tq=R.tq[0]+Math.round(rng()*(R.tq[1]-R.tq[0])/10)*10;
  if(R.econ)req.econ=+(R.econ[0]-rng()*(R.econ[0]-R.econ[1])).toFixed(1);
  for(const k of ["tqrpm","fuel","rel","smooth","kg","disp","cyl","life","passes","car","smoke","lsr","noise","rot","ts","road"])if(R[k]!=null)req[k]=R[k];
  if(R.et)req.et=+(R.et[0]+Math.round(rng()*(R.et[1]-R.et[0])*20)/20).toFixed(2);
  if(R.mph)req.mph=Math.round(R.mph[0]+rng()*(R.mph[1]-R.mph[0]));
  if(R.lap)req.lap=+(R.lap[0]+Math.round(rng()*(R.lap[1]-R.lap[0])*2)/2).toFixed(1);   // their car, their circuit: a lap time to beat
  if(R.zero100)req.zero100=+(R.zero100[0]+Math.round(rng()*(R.zero100[1]-R.zero100[0])*10)/10).toFixed(1);
  const units=seg.units[0]+Math.floor(rng()*(seg.units[1]-seg.units[0]));
  const price=Math.round(seg.price*(0.9+rng()*0.25)*(1+(req.hp?(req.hp-R.hp[0])/(R.hp[1]-R.hp[0])*0.35:0))/10)*10;
  const k={id:Math.floor(rng()*1e9),seg:seg.id,name:seg.name,client,req,units,price,expires:C().week+2+Math.floor(rng()*3)};
  const sites=SITES[seg.id];if(sites&&rng()<SITE_P){const s=sites[Math.floor(rng()*sites.length)];k.site={name:s[0],ambientC:s[1],altitudeM:s[2],prem:s[3]};k.price=Math.round(k.price*(1+s[3])/10)*10;}
  return k;
}
function refillContracts(){
  // accepted work that ran out of time: the client keeps the deposit and word gets around
  const late=C().contracts.filter(k=>k.expires<C().week);for(const k of late){C().cash-=k.deposit||0;C().rep=Math.max(0,C().rep-EXPIRE_REP);logEvent(`${k.client} cancelled the ${k.name} order — deposit ${fmt$(k.deposit||0)} returned, −${EXPIRE_REP} rep`,"bad");}
  C().contracts=C().contracts.filter(k=>k.expires>=C().week);C().inbox=(C().inbox||[]).filter(k=>k.expires>=C().week);}
function acceptContract(k,from){if(C().contracts.length>=MAX_ACTIVE){toast(`Two jobs on the board is the limit — ship or close one first`);return false;}
  k.deposit=Math.round(k.price*k.units*DEPOSIT/10)*10;k.expires=C().week+3;k.accepted=C().week;C().cash+=k.deposit;C().contracts.push(k);
  if(from==="inbox")C().inbox=C().inbox.filter(x=>x.id!==k.id);else if(C().offers&&C().offers.byCat)for(const c in C().offers.byCat)C().offers.byCat[c]=C().offers.byCat[c].filter(x=>x.id!==k.id);
  logEvent(`Took the ${k.name} job from ${k.client} — ${k.units} units by week ${k.expires}, ${fmt$(k.deposit)} deposit in`,"");return true;}
function priceBoost(){let b=1;if(staffed("sales"))b*=1.06+0.0125*crewL("sales");b*=crewPriceK();if(career()&&C().prestige.display)b*=1.03;return b;}
const REQ_LABEL={rot:["Engine",v=>"Wankel rotary"],ts:["Engine",v=>"Two-stroke"],hp:["Power",v=>`≥ ${v} hp`],tq:["Torque",v=>`≥ ${v} Nm`],tqrpm:["Torque peak",v=>`≤ ${(+v).toLocaleString()} rpm`],
  econ:["Economy",v=>`≤ ${v} L/100km`],fuel:["Fuel",(v,x)=>v==="diesel"?"Diesel":x&&x.spec?`${fuelShort(v)} only · control fuel`:isGasF(v)?`${fuelShort(v)} only`:`${fuelShort(v)} or ${x&&x.dsl?"diesel":"lower"}${x&&x.gas?" · LPG/CNG":""}`],rel:["Reliability",v=>`≥ ${v}`],smoke:["Smoke",v=>`≤ ${v}%`],noise:["Noise",v=>`≤ ${v} dB`],
  smooth:["Smoothness",v=>`≥ ${v}`],kg:["Weight",v=>`≤ ${v} kg`],disp:["Displacement",v=>`≤ ${(+v).toFixed(1)} L`],
  cyl:["Cylinders",v=>`≥ ${v}`],life:["Service life",v=>`≥ ${(+v).toLocaleString()} h`],
  passes:["Passes to freshen",v=>`≥ ${v}`],car:["Their car",v=>`${SIM.AERO[v.body].n} · ${v.mass} kg · ${SIM.TYRES[v.tyre].n.toLowerCase()}`],et:["Quarter mile",v=>`≤ ${(+v).toFixed(2)} s`],lsr:["Their car",v=>`${(SIM.LSR_BODIES[v.body]||{}).n||"car"} · long course`],mph:["Timed mile",v=>`≥ ${v} mph`],
  lap:["Lap time",(v,x)=>`≤ ${fmtLap(+v)} · ${(SIM.ROAD_TRACKS[x&&x.road&&x.road.trk]||SIM.ROAD_TRACKS.club).n} in ${roadCarTxt(x&&x.road)}`],zero100:["0–100 km/h",(v,x)=>`≤ ${(+v).toFixed(1)} s in ${roadCarTxt(x&&x.road)}`]};
function describeReq(q,v,x){const m=REQ_LABEL[q];return m?`${m[0]} ${m[1](v,x)}`:q;}
function reqName(q){return (REQ_LABEL[q]||[q])[0];}
function reqTarget(q,v,x){const m=REQ_LABEL[q];return m?m[1](v,x):"";}
/* fuel by family: a petrol brief ("r87") keeps its octane ladder; a diesel only passes one if the buyer takes diesel (seg.dsl);
   "diesel" wants any compression-ignition fuel (No. 2 or B100) */
function fuelOk(have,want,dsl,x,c){x=x||{};if(x.spec)return have===want;   // a control-fuel series: everybody runs the same drum
  if(want==="diesel")return isCI(have);if(isCI(have))return !!dsl;
  if(isGasF(want))return have===want;if(isGasF(have))return !!x.gas;   // a propane or CNG fleet buys only that; a gas engine only goes where gas is welcome
  return fuelRank(have,c)<=FUEL_RANK[want];}
/* flex sells on the blend it was certified on: a pump-gas buyer takes it at E15 or less, otherwise it is an E85 engine */
function fuelRank(f,c){const o=OPT.fuel[f];if(o&&o.flex){const e=c&&c.ethanolPct!=null?+c.ethanolPct:85;return e<=15?FUEL_RANK.r91:FUEL_RANK.e85;}return FUEL_RANK[f];}
const degC=t=>`${t<0?"−"+(-t):t} °C`;
function siteTxt(s){return `${degC(s.ambientC)} · ${(+s.altitudeM).toLocaleString()} m`;}
function siteAt(s){return Math.abs(s.ambientC-20)>=15||s.altitudeM<1500?degC(s.ambientC):`${(+s.altitudeM).toLocaleString()} m`;}   // the condition that bites
function siteEnv(s){return stdEnv(Object.assign(stdCell(),{testType:"pull",ambientC:s.ambientC,altitudeM:s.altitudeM}));}
const siteCache=new Map();
function siteRun(s,c){const e=siteEnv(s);const key=cfgHash(c)+"|"+JSON.stringify(e);let r=siteCache.get(key);if(!r){if(siteCache.size>1200){let n=300;for(const k of siteCache.keys()){siteCache.delete(k);if(!--n)break;}}r=SIM.simulate(c,e);siteCache.set(key,r);}return r;}
function siteCard(k,lf){const s=k.site;if(!s)return{top:"",brk:""};const b=lf.o.find(q=>q.q==="site"&&!q.ok);
  return{top:`<div class="sitebar"><b>Judged at ${siteTxt(s)}</b><span>${s.name} · site premium +${Math.round(s.prem*100)}%</span>${has("dyno3")?`<button class="chip" data-siteprev="${k.id}">Preview it: set the cell to these conditions</button>`:`<small>The Pro dyno cell can preview site conditions.</small>`}</div>`,
    brk:b?`<div class="cstat brk">✗ Breaks at ${siteAt(s)}: ${b.why}</div>`:""};}
function previewSite(s){if(testing){toast("Let the run finish first");return;}C().cell=Object.assign(stdCell(),{ambientC:s.ambientC,altitudeM:s.altitudeM});S.env.testType="pull";save();recompute();showTab("test");toast(`Cell set to ${siteTxt(s)} — a pull here is test only`);}
function fits(k,res,cfg){
  const r=k.req,c=cfg||S.cfg,o=[];let ok=true;
  if(k.site)res=siteRun(k.site,c);   // a site brief ignores the cell figures: the client re-runs the engine in their own air
  const sg=SEGMENTS.find(s=>s.id===k.seg)||{},x={dsl:!!sg.dsl,gas:!!sg.gas,spec:!!sg.spec,road:r.road},dsl=isCI(c.fuel);
  const add=(q,cond,val,prog)=>{o.push({q,name:reqName(q),target:reqTarget(q,r[q],x),label:describeReq(q,r[q],x),val,ok:cond,prog});if(!cond)ok=false;};
  const ge=(v,t)=>clamp(v/Math.max(1e-6,t),0,1.25), le=(v,t)=>clamp(t/Math.max(1e-6,v),0,1.25);
  if(r.hp!=null)add("hp",res.peakHp>=r.hp,Math.round(res.peakHp),ge(res.peakHp,r.hp));
  if(r.tq!=null)add("tq",res.peakTq>=r.tq,Math.round(res.peakTq),ge(res.peakTq,r.tq));
  if(r.tqrpm!=null)add("tqrpm",res.peakTqRpm<=r.tqrpm,res.peakTqRpm.toLocaleString(),le(res.peakTqRpm,r.tqrpm));
  if(r.econ!=null)add("econ",res.econ<=r.econ,res.econ.toFixed(1),le(res.econ,r.econ));
  if(r.fuel!=null){const fo=fuelOk(c.fuel,r.fuel,x.dsl,x,c);add("fuel",fo,fuelShort(c.fuel)+(OPT.fuel[c.fuel]&&OPT.fuel[c.fuel].flex?" E"+Math.round(c.ethanolPct==null?85:c.ethanolPct):""),fo?1:0.3);if(!fo&&(r.fuel==="diesel"||dsl||isGasF(r.fuel)||isGasF(c.fuel)))o[o.length-1].fam=true;}
  if(r.smoke!=null){const sm=dsl?(res.smoke||0):0;add("smoke",sm<=r.smoke,Math.round(sm)+"%",le(Math.max(1,sm),Math.max(1,r.smoke)));}
  /* drive-by noise: a road buyer drives it with the cutout shut; every 2 dB over is a tenth further from a sale */
  if(r.noise!=null){const nz=res.noiseDb!=null?res.noiseDb:SIM.exhaustNoise(c).db;add("noise",nz<=r.noise,Math.round(nz)+" dB",clamp(1-(nz-r.noise)/20,0,1));}
  if(r.rel!=null)add("rel",res.rel>=r.rel,res.rel,ge(res.rel,r.rel));
  if(r.smooth!=null)add("smooth",res.smooth>=r.smooth,Math.round(res.smooth),ge(res.smooth,r.smooth));
  if(r.kg!=null)add("kg",res.kg<=r.kg,Math.round(res.kg),le(res.kg,r.kg));
  if(r.rot!=null){const ro=isRot(c);add("rot",ro,ro?"rotary":"pistons",ro?1:0.1);}
  if(r.ts!=null){const t2=isTs(c);add("ts",t2,t2?"two-stroke":"four-stroke",t2?1:0.1);}
  const dispL=res.Vd/1000*(res.rotary?ROT_DISP:1);   // a rotary runs in a displacement class at 1.5x its quoted size
  if(r.disp!=null)add("disp",dispL<=r.disp+0.005,dispL.toFixed(2)+(res.rotary?" (×1.5)":""),le(dispL,r.disp+0.005));
  if(r.cyl!=null)add("cyl",res.n>=r.cyl,res.n,ge(res.n,r.cyl));
  if(r.life!=null)add("life",res.lifeHours>=r.life,res.lifeHours.toLocaleString(),ge(res.lifeHours,r.life));
  if(r.passes!=null)add("passes",res.racePasses>=r.passes,res.racePasses,ge(res.racePasses,r.passes));
  if(r.car)add("car",true,"",1);
  if(r.lsr)add("lsr",true,"",1);
  if(r.mph!=null&&res.rpms){const m=lsrFitMph(res,c,(r.lsr&&r.lsr.body)||"lakester");add("mph",m>=r.mph,m?m.toFixed(1)+" mph":"no time",ge(m,r.mph));}
  if(r.et!=null&&res.rpms){const veh=Object.assign({redline:c.redline,auto:true},carVeh(r.car));const d=SIM.dragPass(res,veh);add("et",d.et!=null&&d.et<=r.et,d.et!=null?d.et.toFixed(2)+" s":"DNF",d.et!=null?le(d.et,r.et):0);}
  if((r.lap!=null||r.zero100!=null)&&res.rpms){const R0=roadFor(res,c,Object.assign({ch:"coupe"},r.road,r.lap!=null?{}:{trk:null}),k.site?k.site.name:"");   // judged in their car (a site brief: in their air too)
    if(r.zero100!=null)add("zero100",R0.z100!=null&&R0.z100<=r.zero100,R0.z100!=null?R0.z100.toFixed(1)+" s":"—",R0.z100!=null?le(R0.z100,r.zero100):0);
    if(r.lap!=null)add("lap",R0.lap!=null&&R0.lap<=r.lap+1e-6,fmtLap(R0.lap),R0.lap!=null?le(R0.lap,r.lap):0);}
  if(k.site){const br=res.fails[0];o.push({q:"site",name:"At the site",target:siteTxt(k.site),label:`Holds at ${siteTxt(k.site)}`,val:br?"breaks":"holds",ok:!br,prog:br?0:1,why:br});if(br)ok=false;}
  let bonus=0;if(ok){if(r.hp)bonus+=clamp(res.peakHp/r.hp-1,0,0.3)*0.5;if(r.rel)bonus+=clamp((res.rel-r.rel)/100,0,0.15);if(r.tq)bonus+=clamp(res.peakTq/r.tq-1,0,0.3)*0.4;
    if(x.dsl&&dsl)bonus+=0.06;if(x.gas&&isGasF(c.fuel))bonus+=0.08;}   // ...and more for propane or CNG: cheap fuel, clean oil, indoor-safe   // fleet and farm buyers pay a little extra for diesel: low-down torque, fuel bills, a long life
  return{ok,o,bonus,res};
}
/* soft briefs: a buyer still takes an engine that misses the brief, just fewer of them and for less.
   Each shortfall costs in proportion to how far off it is; the wrong fuel or a site break is a flat hit,
   and the wrong fuel family (a diesel for a petrol car, or the reverse) sends them away. */
const MISS_W={hp:1.8,tq:1.8,et:4,mph:4,lap:8,zero100:3,econ:1.6,kg:1.6,tqrpm:1.2,disp:3,cyl:1.5,rel:2.5,smooth:1.6,life:1.2,passes:1.2,smoke:0.5,noise:1.5,rot:1,ts:1};
function deal(k,f){let m=1;const miss=[];for(const q of f.o){if(q.ok)continue;const x=q.q==="fuel"?(q.fam?0.15:0.7):q.q==="site"?0.55:clamp(1-(MISS_W[q.q]||1.5)*(1-clamp(q.prog,0,1)),0.05,1);m*=x;miss.push({name:q.name,cut:1-x});}
  miss.sort((a,b)=>b.cut-a.cut);   // under a fifth of a fit and they walk: that engine was never theirs
  return{m,miss,ok:f.ok,want:f.ok||m>=MKT_MIN,units:f.ok?k.units:Math.max(1,Math.round(k.units*Math.pow(m,0.6))),unit:Math.round(k.price*priceBoost()*crewFamK(f.res)*(f.ok?1+f.bonus:Math.pow(m,0.7))/10)*10};}
const MKT_MIN=0.2;
function missTxt(d){return d.miss.slice(0,3).map(x=>`${x.name.toLowerCase()} −${Math.round(x.cut*100)}%`).join(" · ");}
// same engine, same word of mouth: contract or open market, rep follows units, class and how well it suits the buyer
function repFor(tier,units,d,bonus,repeat){return Math.round((2+units*0.6+tier*4+(d.ok?bonus*20:0)+(repeat?4:0))*0.4*(d.ok?1:d.m));}
/* buyer groups: every segment the shop can reach bids on the certified engine on the spot market — no deposit, no deadline,
   a little under contract money. A crate-engine dealer takes anything that certified, at a thin margin. */
const MKT_COOL=3;
function buyerK(seg,res){const R=seg.req,req={};const mid=(a,f)=>a[0]+(a[1]-a[0])*f;
  if(R.hp)req.hp=Math.round(mid(R.hp,0.3)/10)*10;if(R.tq)req.tq=Math.round(mid(R.tq,0.3)/10)*10;if(R.econ)req.econ=+mid(R.econ,0.3).toFixed(1);if(R.et)req.et=+mid(R.et,0.7).toFixed(2);if(R.mph)req.mph=Math.round(mid(R.mph,0.3));if(R.lap)req.lap=+mid(R.lap,0.7).toFixed(1);if(R.zero100)req.zero100=+mid(R.zero100,0.7).toFixed(1);
  for(const k of ["tqrpm","fuel","rel","smooth","kg","disp","cyl","life","passes","car","smoke","lsr","noise","rot","ts","road"])if(R[k]!=null)req[k]=R[k];
  const recent=C().week-((C().mkt||{})[seg.id]||-99)<MKT_COOL;
  return{id:"m-"+seg.id,seg:seg.id,name:seg.name,tier:seg.tier,req,units:Math.max(1,Math.round((seg.units[0]+seg.units[1])/4*(recent?0.5:1))),price:Math.round(seg.price*0.85*(recent?0.9:1)/10)*10,recent};}
function crateK(res){const recent=C().week-((C().mkt||{}).crate||-99)<MKT_COOL;return{id:"m-crate",seg:"crate",name:"Crate engine dealer",tier:0,req:{},units:recent?1:2,price:Math.round((res.cost*1.06+res.peakHp*1.5)*(recent?0.9:1)/10)*10,recent,crate:true};}
const buyCache=new Map();
function buyers(cert){const key=cert.hash+"|"+C().week+"|"+C().rep+"|"+Object.keys(C().owned).join(",")+"|"+JSON.stringify(C().mkt||{})+"|"+priceBoost();if(buyCache.has(key))return buyCache.get(key);
  const tier=repTierIdx();const segs=[];for(const c of CATS)if(catOpen(c))for(const id of c.segs){const sg=SEGMENTS.find(x=>x.id===id);if(sg&&sg.tier<=tier&&(sg.tier<5||has("race")))segs.push(Object.assign({cat:c.name},sg));}
  const out=segs.map(sg=>{const k=buyerK(sg,cert.res);k.cat=sg.cat;const f=fits(k,cert.res,cert.cfg);const d=deal(k,f);return{k,f,d,profit:(d.unit-cert.res.cost)*d.units};});
  const cr=crateK(cert.res);const cf=fits(cr,cert.res,cert.cfg);out.push({k:Object.assign(cr,{cat:"Trade"}),f:cf,d:deal(cr,cf),profit:0});out[out.length-1].profit=(out[out.length-1].d.unit-cert.res.cost)*out[out.length-1].d.units;
  const keep=out.filter(b=>b.d.want);keep.sort((a,b)=>b.profit-a.profit);out.length=0;out.push(...keep);if(buyCache.size>60)buyCache.clear();buyCache.set(key,out);return out;}
/* "one change away": search single part swaps (and a few slider nudges) that would make the current build fit a contract */
const FIX_KEYS=["fuel","piston","rings","rod","rodBolts","crank","bearings","oilGrade","cooling","head","springs","valveMat","intake","exhaust","gasket","studs","damper","pistonClearance","oilSystem","oilSquirters","ic","asp","blockMat","headMat"];
FIX_KEYS.push("injectors","fuelPump");   // a build that only leans out can be one part away from a contract
FIX_KEYS.push("dInj","dNoz");   // diesel: a common-rail pump or bigger nozzles can be the one change
FIX_KEYS.push("rotPort","apexSeal","rotHousing","sidePlate","eshaft","oilMeter");   // rotary
FIX_KEYS.push("scav","induct","tsFuel","xpipe","pv","lube");   // two-stroke
const FOUR_ONLY_KEYS={head:1,springs:1,valveMat:1,intake:1,exhaust:1};   // a ported two-stroke has none of these (a uniflow keeps its exhaust valves)
const PISTON_ONLY_KEYS={piston:1,rings:1,rod:1,rodBolts:1,crank:1,head:1,springs:1,valveMat:1,gasket:1,studs:1,damper:1,pistonClearance:1,oilSquirters:1,blockMat:1,headMat:1};
FIX_KEYS.push("muffler","cat","pipe");   // a loud or smoky build is often one exhaust part away
const fixCache=new Map();
function oneChange(k){const key=cfgHash(S.cfg)+"|"+k.id+"|"+(career()?Object.keys(C().owned).join(","):"sb");if(fixCache.has(key))return fixCache.get(key);
  const env=stdEnv({testType:"pull"});let best=null;const tryCfg=(cfg,label)=>{const r=SIM.simulate(cfg,env);if(r.fails.length)return;const f=fits(k,r,cfg);if(f.ok){const gain=f.bonus;if(!best||gain>best.gain)best={label,cfg,gain};}};
  const dsl=isCI(S.cfg.fuel);
  const rotB=isRot(S.cfg);
  for(const key2 of FIX_KEYS){const opts=OPT[key2];if(!opts)continue;if(rotB?PISTON_ONLY_KEYS[key2]:ROT_KEYS[key2])continue;if(isTs(S.cfg)?FOUR_ONLY_KEYS[key2]&&!(S.cfg.scav==="uniflow"&&(key2==="springs"||key2==="valveMat")):TS_KEYS[key2])continue;if(!dsl&&(key2==="dInj"||key2==="dNoz"))continue;if(dsl&&key2==="injectors")continue;for(const v in opts){if(v===S.cfg[key2]||locked(opts[v]))continue;if(key2==="fuel"&&isCI(v)!==dsl)continue;if(key2==="layout")continue;tryCfg(Object.assign({},S.cfg,{[key2]:v}),`switch to ${opts[v].name}`);}}
  const sl=[["redline",-500,"drop the redline 500 rpm"],["redline",-1000,"drop the redline 1,000 rpm"],["cam",-15,"a milder cam"],["cam",15,"a bigger cam"],["cr",-1,"a point less compression"],["cr",1,"a point more compression"],["timing",-3,"pull 3° of timing"],["boost",-0.3,"0.3 bar less boost"],["lambda",0.05,"lean it out a touch"]];
  if(dsl)sl.push(["lambda",0.1,"lean the full-load λ 0.1"],["lambda",-0.1,"richen the full-load λ 0.1"],["timing",-2,"retard the injection 2°"]);
  for(const [kk,d,label] of sl){if(kk==="boost"&&S.cfg.asp==="na")continue;const f=FORM.flatMap(x=>x.fields).find(x=>x.key===kk);if(f&&f.showIf&&!f.showIf(S.cfg))continue;const v=clamp(S.cfg[kk]+d,f?fMin(f):-1e9,f?fMax(f):1e9);if(v===S.cfg[kk])continue;tryCfg(Object.assign({},S.cfg,{[kk]:v}),label);}
  if(fixCache.size>400)fixCache.clear();fixCache.set(key,best);return best;}
function overhead(){const plant=UPGRADES.reduce((a,u)=>a+(C().owned[u.id]?u.price:0),0);return 500+Math.round(plant*0.02/10)*10+wages();}
function rndNeed(r){return r.mach&&staffed("machinist")?Math.ceil(r.weeks*(0.75-0.025*crewL("machinist"))):r.weeks;}   // machinist: machining projects 25% shorter
function rndPass(){const a=C().rndActive;if(!a)return;const r=RND.find(x=>x.id===a.id);if(!r)return;a.done+=1;
  if(a.done>=rndNeed(r)){C().rnd[r.id]=C().week;C().rndActive=null;crewWork("rnd",{r});if(r.unlock)for(const u of r.unlock)C().unlocks[u]=true;syncShop();C().rep+=8;logEvent(`R&D complete: ${r.name} — ${r.desc.split(".")[1]||r.desc}`,"good");toast(`R&D COMPLETE · ${r.name.toUpperCase()}`);renderBuild();renderPresets();recompute();}}
function prestigePass(){let rp=0;for(const p of PRESTIGE)if(C().prestige[p.id])rp+=p.rep;if(rp){C().rep+=rp;}}
function logEvent(t,kind){C().log.unshift({w:C().week,t,k:kind||""});if(C().log.length>16)C().log.length=16;}
function checkGoals(){let hit=[];for(const g of GOALS){if(C().goals[g.id])continue;let ok=false;try{ok=g.check(C());}catch(e){}if(ok){C().goals[g.id]=C().week;C().cash+=g.cash;C().rep+=10;logEvent(`Goal: ${g.name} — ${fmt$(g.cash)} bonus, +10 rep`,"good");hit.push(g);}}
  if(hit.length){toast(`Goal: ${hit[0].name} · +${fmt$(hit[0].cash)}`);buzz([30,30,30]);}return hit.length;}
function warrantyPass(){let claims=0,cost=0,active=0;
  for(const f of C().fleet){const age=C().week-f.week;if(age<1||age>10)continue;active++;
    const lam=Math.max(0,f.units-(f.inShop||0)-(f.wDone||0)*0.7)*(1-f.rel/100)*0.05*(f.life<2000?1.5:1)*(age<=3?1.4:1)*(crewT("lucky")?0.85:1);let n=Math.floor(lam);if(rng()<lam-n)n++;
    if(n){f.claims=(f.claims||0)+n;const c=n*(Math.round(f.unitCost*0.5)+350);claims+=n;cost+=c;C().cash-=c;C().warranty+=c;C().rep=Math.max(0,C().rep-n);
      logEvent(`${n} × ${f.name} back from ${f.client} — ${f.weak.toLowerCase()} — ${fmt$(c)} warranty`,"bad");}}
  if(active&&!claims)C().cleanWeeks++;else if(claims)C().cleanWeeks=0;
  if(claims)toast(`${claims} warranty claim${claims>1?"s":""} · ${fmt$(cost)}`);
  return claims;}
function repeatPass(){for(const f of C().fleet){if(f.repeated||(f.claims||0)>0||C().week!==f.week+4)continue;f.repeated=true;
    const units=Math.max(1,Math.round(f.units*1.0));const price=Math.round((f.basePrice||f.unitPrice)*1.10/10)*10;   // +10% on the brief's price; deal() adds the fit bonus again
    (C().inbox=C().inbox||[]).push({id:Math.floor(rng()*1e9),seg:f.seg,name:f.name,client:f.client,req:Object.assign({},f.req),units,price,expires:C().week+3,repeat:true,...(f.site?{site:Object.assign({},f.site)}:{})});
    logEvent(`${f.client} is back for ${units} more ${f.name} engines at +10%`,"good");toast(`${f.client} wants a repeat order`);}}
/* ===== rebuilds & cores =====
   Engines in the field wear: a fleet entry runs a segment's duty hours a week against the life rating it was certified
   with. Short-lived builds wear out inside the ten-week warranty and come back as WARRANTY REBUILDS (you pay the parts;
   ignore them and the client bills you claims). Everything else comes back after the warranty as a PAID REBUILD from
   the same client — at most twice per delivery, the second time only for the units you rebuilt yourself.
   Cores: a buyer may trade in old engines. A core of the same layout re-uses its block, crank and rods: up to one core a
   unit, worth 12% of the unit cost (capped at the core's book value). Other cores go to a six-slot core stock, used on
   later builds of that layout or sold to the core buyer for scrap. Cores are never bought, so there's nothing to flip. */
const SVC_DUTY={prod:100,truck:120,diesel:150,perf:70,race:90,outlaw:110};   // in-service hours a week, compressed
const SVC_TIERS=[{id:"top",name:"Top end",worn:"valves, guides and stem seals",parts:0.12,lab:0.11},
  {id:"rb",name:"Rings & bearings",worn:"rings, rod and main bearings",parts:0.20,lab:0.14},
  {id:"full",name:"Full rebuild",worn:"bores, crank, rings, bearings and valves",parts:0.32,lab:0.18}];
const CORE_MAX=6,CORE_FRAC=0.12,CORE_SCRAP=0.4;
const CORE_LAY={hatch:["I3","I4"],sedan:["I4","V6"],van:["I4","V6"],pump:["I3","I4"],truck:["V6","V8"],hot:["I4","I4","F4"],taxi:["I4","V6"],sport:["I6","V6","F6"],
  club:["I4"],gt:["V8","V12","V10"],rally:["I4","F4"],drift:["I6","V8"],genset:["I6","V8"],tractor:["I6","I4"],super:["V8","V10"],endur:["V8","V6"],attack:["I4","V6"],
  drag:["V8"],hyper:["V8","V12"],flagship:["V12"],stripcar:["V8"],grudge:["V8"],radial:["V8"],promod:["V8"],smallblock:["V8"],
  hdpickup:["V8","I6"],mdtruck:["I6","I4"],workboat:["I6"],dtractor:["I6"],minegen:["I6","V8"],class8:["I6"],puller:["I6","V8"]};
function SV(){const c=C();if(!Array.isArray(c.service))c.service=[];if(!Array.isArray(c.cores))c.cores=[];
  for(const k of ["svcUsed","svcIncome","rebuildJobs","rebuiltUnits","coresUsed","coreCredit","coreScrap","fidN"])if(typeof c[k]!=="number")c[k]=0;
  if(!c.coreSalt)c.coreSalt=1+Math.floor(Math.random()*1e9);return c;}
function segCat(seg){const c=CATS.find(x=>x.segs.includes(seg));return c?c.id:"prod";}
function svcCap(){return 6+(staffed("machinist")?4+crewL("machinist"):0)+(has("shop1")?3:0)+(has("shop2")?3:0)+2*crewT("owl");}
function svcQual(){return 1+(staffed("machinist")?0.15+0.025*crewL("machinist"):0)+(has("shop1")?0.1:0)+(has("shop2")?0.1:0)+0.08*crewT("meticulous");}   // a better shop's rebuild lasts longer
function svcRaw(f){return 0.55*Math.max(300,+f.life||2000)/(SVC_DUTY[segCat(f.seg)]||100)*(0.7+0.3*clamp(+f.rel||80,0,100)/100);}   // weeks to a rebuild
function svcClient(f){return f.client===f.name?f.name+" buyers":f.client;}
function fleetBy(fid){return C().fleet.find(f=>f.fid===fid);}
function svcJob(f,units,warranty,cycle){const c=C();
  const score=(100-f.rel)/25+2000/Math.max(300,+f.life||2000)+(rng()-0.5)*0.5+(cycle>1?0.3-(svcQual()-1):0);
  const t=SVC_TIERS[warranty?Math.max(1,score<1.8?1:2):score<1?0:score<1.8?1:2];const parts=Math.max(50,Math.round(f.unitCost*t.parts/10)*10);
  const j={id:Math.floor(rng()*1e9),fid:f.fid,client:svcClient(f),name:f.name,seg:f.seg,engine:f.engine,units,done:0,tier:t.id,parts,
    pay:warranty?0:Math.round((parts*1.1+t.lab*f.unitPrice)/10)*10,due:c.week+(warranty?3:4),warranty:!!warranty,cycle,unitCost:f.unitCost,
    hrs:Math.round((c.week-(cycle>1?f.rbWeek:f.week))*(SVC_DUTY[segCat(f.seg)]||100)),life:Math.round(f.life||0)};
  c.service.push(j);return j;}
function servicePass(){const c=SV();c.svcUsed=0;
  for(const j of c.service.slice()){if(j.due>=c.week)continue;c.service.splice(c.service.indexOf(j),1);const left=j.units-j.done,f=fleetBy(j.fid);
    if(j.warranty){if(f)f.inShop=0;if(left>0){const cost=left*(Math.round(j.unitCost*0.5)+350);c.cash-=cost;c.warranty+=cost;c.rep=Math.max(0,c.rep-left);if(f)f.claims=(f.claims||0)+left;
      logEvent(`${left} × ${j.name} warranty rebuild${left>1?"s":""} left undone — ${j.client} had them fixed elsewhere and billed you ${fmt$(cost)}`,"bad");}}
    else if(left>0){c.rep=Math.max(0,c.rep-1);logEvent(`${j.client} took ${left} rebuild${left>1?"s":""} elsewhere — the service window closed`,"");}}
  let n=0;
  for(const f of c.fleet){if(!f.fid)f.fid=++c.fidN;const age=c.week-f.week,raw=svcRaw(f);
    if(!f.svc){const due=clamp(Math.round(raw),11,26);if(age>due+6){f.svc=-1;continue;}   // an old save's long-gone fleet: no back-dated calls
      if(raw<8&&!f.wjob&&age>=Math.max(4,Math.round(raw))&&age<=9){f.wjob=true;   // worn out inside the warranty: premature wear, your bill
        const base=f.units-(f.claims||0);const share=clamp(0.3+(8-raw)*0.08,0.3,0.7);const u=Math.max(base>0?1:0,Math.round(base*share));
        if(u>0){svcJob(f,u,true,1);f.inShop=u;n++;logEvent(`${svcClient(f)}: ${u} × ${f.name} worn out under warranty — bring them in (parts on you) by wk ${c.week+3}`,"bad");}}
      if(age>=due){f.svc=1;const base=f.units-(f.claims||0)-(f.wDone||0)-(f.inShop||0);const share=clamp(0.3+(100-f.rel)/300+0.15*(1-Math.min(1,(f.life||2000)/4000)),0.3,0.55);
        const x=Math.max(0,base)*share;const u=Math.floor(x)+(rng()<x-Math.floor(x)?1:0);
        if(u>0){const j=svcJob(f,u,false,1);n++;logEvent(`${svcClient(f)}: ${u} × ${f.name} in for a ${SVC_TIERS.find(t=>t.id===j.tier).name.toLowerCase()} — ${fmt$(j.pay)} a unit`,"good");}}}
    else if(f.svc===1&&f.due2&&c.week>=f.due2){f.svc=2;if(c.week>f.due2+6)continue;const x=(f.rebuiltN||0)*0.35;const u=Math.floor(x)+(rng()<x-Math.floor(x)?1:0);
      if(u>0){const j=svcJob(f,u,false,2);n++;logEvent(`${svcClient(f)}: the rebuilt ${f.name} engines are due again — ${u} in for a ${SVC_TIERS.find(t=>t.id===j.tier).name.toLowerCase()}`,"good");}}}
  if(n)toast(`SERVICE BAY · ${n} new rebuild job${n>1?"s":""}`);return n;}
function doRebuild(id){const c=SV();const j=c.service.find(x=>x.id==id);if(!j)return false;const n=Math.min(j.units-j.done,svcCap()-c.svcUsed);
  if(n<=0){toast("Service bay is full this week — close the week");return false;}const f=fleetBy(j.fid);
  c.svcUsed+=n;j.done+=n;const parts=j.parts*n;let msg;
  if(j.warranty){c.cash-=parts;c.warranty+=parts;if(f){f.wDone=(f.wDone||0)+n;f.inShop=Math.max(0,(f.inShop||0)-n);}
    msg=`Warranty-rebuilt ${n} × ${j.engine} for ${j.client} — ${fmt$(parts)} in parts`;}
  else{const net=(j.pay-j.parts)*n;c.cash+=net;c.profit+=net;c.svcIncome+=net;const rep=Math.ceil(n/3);c.rep+=rep;c.rebuiltUnits+=n;
    if(f&&j.cycle===1){f.rebuiltN=(f.rebuiltN||0)+n;if(!f.due2){f.rbWeek=c.week;f.due2=c.week+clamp(Math.round(svcRaw(f)*svcQual()),8,26);}}
    msg=`Rebuilt ${n} × ${j.engine} for ${j.client} (${SVC_TIERS.find(t=>t.id===j.tier).name.toLowerCase()}) — ${fmt$(j.pay*n)} billed, ${fmt$(net)} after parts, +${rep} rep`;}
  if(j.done>=j.units){c.service=c.service.filter(x=>x!==j);c.rebuildJobs++;if(j.warranty&&f)f.wfix=true;}
  logEvent(msg,j.warranty?"":"good");crewWork("rebuild",{n});checkGoals();return {n,j,parts,net:j.warranty?-parts:(j.pay-j.parts)*n};}
/* cores */
function coreBook(l){return Math.round(((OPT.layout[l]||{}).cost||1000)*0.25/10)*10;}
function coreScrapVal(l){return Math.round(coreBook(l)*CORE_SCRAP/10)*10;}
function h01(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0)/4294967296;}
function coreOffer(k,units){if(!k||k.crate)return null;const c=SV();const key=c.coreSalt+"|"+(String(k.id).startsWith("m-")?k.seg+"|"+c.week+(k.recent?"r":""):k.id);
  const cat=segCat(k.seg);const p={prod:0.5,truck:0.5,diesel:0.5,perf:0.35,race:0.2,outlaw:0.15}[cat]||0.3;if(h01(key+"p")>=p)return null;
  const L=CORE_LAY[k.seg]||["I4","V6","V8"];return{n:Math.min(3,1+(units>=8?1:0)+(units>=16?1:0)),lay:L[Math.floor(h01(key+"l")*L.length)]};}
function coreDeal(k,units,cert){const c=SV();const o=coreOffer(k,units),lay=(cert.cfg||S.cfg).layout;const per=Math.min(Math.round(cert.res.cost*CORE_FRAC/10)*10,coreBook(lay));
  let cap=Math.min(units,3);const tUse=o&&o.lay===lay?Math.min(o.n,cap):0;cap-=tUse;const sUse=Math.min(cap,c.cores.filter(x=>x.lay===lay).length);
  return{o,lay,per,tUse,sUse,credit:(tUse+sUse)*per,inN:o?o.n-tUse:0,inLay:o?o.lay:null};}
function coreTxt(cd){const u=cd.tUse+cd.sUse;const src=cd.tUse&&cd.sUse?`${cd.tUse} trade-in, ${cd.sUse} from stock`:cd.tUse?"their trade-in":"from stock";
  return (cd.credit?`core credit −${fmt$(cd.credit)} · ${u} ${cd.lay} core${u>1?"s":""} (${src})`:"")+(cd.inN?`${cd.credit?" · ":""}trades in ${cd.inN} × ${cd.inLay} core${cd.inN>1?"s":""} → stock`:"");}
function applyCores(cd){const c=SV();let left=cd.sUse;c.cores=c.cores.filter(x=>{if(left>0&&x.lay===cd.lay){left--;return false;}return true;});
  c.coresUsed+=cd.tUse+cd.sUse;c.coreCredit+=cd.credit;let scrap=0,kept=0;
  for(let i=0;i<cd.inN;i++){if(c.cores.length<CORE_MAX){c.cores.push({lay:cd.inLay,w:c.week});kept++;}else{const v=coreScrapVal(cd.inLay);c.cash+=v;c.coreScrap+=v;scrap+=v;}}
  return {kept,scrap};}
function sellCore(lay){const c=SV();const i=c.cores.findIndex(x=>x.lay===lay);if(i<0)return 0;c.cores.splice(i,1);const v=coreScrapVal(lay);c.cash+=v;c.coreScrap+=v;
  logEvent(`Sold a ${lay} core to the core buyer — ${fmt$(v)}`,"");return v;}
function svcBayH(){const c=SV();const cap=svcCap(),free=cap-c.svcUsed;const jobs=c.service.slice().sort((a,b)=>a.due-b.due);
  const card=j=>{const t=SVC_TIERS.find(x=>x.id===j.tier)||SVC_TIERS[1];const left=j.units-j.done,n=Math.min(left,free);const net=j.warranty?-j.parts:j.pay-j.parts;
    return `<div class="card svcjob ${j.warranty?"wty":""}"><div class="client">${j.client}${j.warranty?" · under warranty":j.cycle>1?" · second rebuild":" · service order"}</div>
      <h3>${j.engine}<span>${left} of ${j.units} unit${j.units>1?"s":""} · due wk ${j.due}</span></h3>
      <div class="svcworn"><b>${t.name}</b><span>${t.worn}</span><i>${j.name} · ≈ ${j.hrs.toLocaleString()} h on a ${j.life.toLocaleString()} h build</i></div>
      <div class="money"><div><b>${j.warranty?"$0":fmt$(j.pay)}</b><span>${j.warranty?"no pay":"pay / unit"}</span></div><div><b>${fmt$(j.parts)}</b><span>parts / unit</span></div><div><b class="${net>=0?"pos":"neg"}">${fmt$(net*left)}</b><span>${j.warranty?"your bill":"margin"}</span></div></div>
      <button class="btn ${n>0?(j.warranty?"danger":"pri"):""}" data-rebuild="${j.id}" ${n>0?"":"disabled"}>${n>0?`Rebuild ${n} unit${n>1?"s":""}${n<left?" (bay limit)":""}`:"Bay full this week"}</button></div>`;};
  return `<div class="cgroup g-svc"><h3>Service bay<span>${c.svcUsed} / ${cap} this week</span></h3>${jobs.length?jobs.map(card).join(""):`<p class="hint">No engines in for service. Deliveries come back for rebuilds once their warranty runs out — short-lived builds sooner, and on your bill.</p>`}
    <p class="hint svchint">${c.rebuildJobs} job${c.rebuildJobs===1?"":"s"} done · ${c.rebuiltUnits} engines rebuilt · ${fmt$(c.svcIncome)} service margin. Bay: ${cap} rebuilds a week${cap<16?" — a machinist and the machine shops add more":""}.</p></div>`;}
function coreStockH(cert){const c=SV();const by={};for(const x of c.cores)by[x.lay]=(by[x.lay]||0)+1;const lay=S.cfg.layout;
  const rows=Object.keys(by).sort().map(l=>{const ok=l===lay;const per=ok&&cert?Math.min(Math.round(cert.res.cost*CORE_FRAC/10)*10,coreBook(l)):coreBook(l);
    return `<div class="buyer corerow"><div class="bh"><span><b>${by[l]} × ${l} core${by[l]>1?"s":""}</b><i>${(OPT.layout[l]||{}).name||l} · block, crank and rods</i></span><span class="bfit ${ok?"ok":""}">${ok?"fits this build":"other layout"}</span></div>
      <div class="bdeal"><span>${ok&&cert?`−${fmt$(per)} a unit on this build`:`worth up to ${fmt$(coreBook(l))} a unit on ${l} builds`}</span><b>${fmt$(coreScrapVal(l))}</b><button class="btn sm ghost" data-corescrap="${l}">Scrap 1</button></div></div>`;}).join("");
  return `<div class="cgroup g-core"><h3>Core stock<span>${c.cores.length} / ${CORE_MAX}</span></h3>${rows||`<p class="hint">Empty. Buyers sometimes trade in an old engine; a core of your build's layout knocks ${Math.round(CORE_FRAC*100)}% off a unit's cost, the rest wait here.</p>`}
    ${c.coresUsed||c.coreScrap?`<p class="hint">${c.coresUsed} core${c.coresUsed===1?"":"s"} re-used · ${fmt$(c.coreCredit)} saved · ${fmt$(c.coreScrap)} scrap</p>`:""}</div>`;}
GOALS.push({id:"svc5",name:"Back in service",desc:"Complete 5 rebuild jobs in the service bay.",cash:6000,check:c=>(c.rebuildJobs||0)>=5},
  {id:"cores10",name:"Core business",desc:"Re-use 10 trade-in cores in new builds.",cash:4000,check:c=>(c.coresUsed||0)>=10});
function coreHint(cert){const l=(cert.cfg||S.cfg).layout;const n=SV().cores.filter(x=>x.lay===l).length;return n?` · ${n} ${l} core${n>1?"s":""} in stock: −${fmt$(Math.min(Math.round(cert.res.cost*CORE_FRAC/10)*10,coreBook(l)))} a unit on up to ${n}`:"";}
function coreLog(cd,cr){const p=[];if(cd.credit)p.push(`${cd.tUse+cd.sUse} ${cd.lay} core${cd.tUse+cd.sUse>1?"s":""} re-used, −${fmt$(cd.credit)}`);if(cr&&cr.kept)p.push(`${cr.kept} ${cd.inLay} core${cr.kept>1?"s":""} to stock`);if(cr&&cr.scrap)p.push(`stock full, ${fmt$(cr.scrap)} scrap`);return p.length?" · "+p.join(", "):"";}
$("contracts").addEventListener("click",e=>{const rb=e.target.closest("[data-rebuild]");if(rb){if(rb.disabled)return;const r=doRebuild(rb.dataset.rebuild);if(!r)return;save();hud();renderShop();
    toast(r.j.warranty?`WARRANTY REBUILD · ${r.n} DONE · ${fmt$(r.parts)} PARTS`:`REBUILT ${r.n} · +${fmt$(r.net)}${r.j.done>=r.j.units?" · JOB DONE":""}`);buzz(25);return;}
  const cs=e.target.closest("[data-corescrap]");if(cs){const v=sellCore(cs.dataset.corescrap);if(v){save();hud();renderShop();toast(`CORE SOLD · ${fmt$(v)}`);}}});
