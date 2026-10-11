/* ===================== DYNO DAY (career customer jobs) — core =====================
   A customer books dyno time for their own engine: a preset with one deliberate fault injected. Every fault is built by
   search (step the part or the number until the dyno shows the fault) and is only offered when a reference fix, using parts the
   shop can fit, clears it. ddCheck() judges a hand-back against the job's targets. Pure: SIM in, data out (tested in node). */
const DD_FREE={cover:1,twoStepRpm:1,launchRetard:1,launchCtl:1,transBrake:1};   // cosmetic / launch keys: never a customer's business
const DD_PUMP=["r87","r91","r94"];
const ddCl=o=>JSON.parse(JSON.stringify(o));
const ddT=(r,id)=>(r.tests||[]).find(t=>t.id===id);
const ddCrit=(r,id)=>{const t=ddT(r,id);return !!t&&t.status==="crit";};
const ddSpark=c=>!SIM.isDiesel(c)&&!(SIM.OPT.fuel[c.fuel]||{}).gas;
const ddTurbo=c=>/turbo|compound/.test(c.asp);
const ddBoosted=c=>c.asp!=="na";
const ddFuelOk=f=>{const o=SIM.OPT.fuel[f];return !!o&&!o.ci&&!o.gas&&f!=="flex";};
function ddOrder(key,by){const t=SIM.OPT[key];const ks=Object.keys(t);return by?ks.slice().sort((a,b)=>by(t[a])-by(t[b])):ks;}
function ddBelow(key,cur,by){const o=ddOrder(key,by),i=o.indexOf(cur);return i>0?o.slice(0,i).reverse():[];}   // weaker parts, nearest first
const DD_FAULTS=[
 {id:"lean",tag:"lean at the top end",name:"Fuel delivery",hrs:2.5,allowed:["injectors","fuelPump","lambda","timing"],k:0.97,
  says:["Pulls hard to {r} and then falls on its face.","Feels great down low, goes flat above {r} — like it's starving.","Lays down at the top of every gear, right around {r}."],
  hints:["It's a fuel problem, not a spark one. Run a pull and read Fuel delivery in the stress report.","The injectors (or the pump) can't keep up: past about 85% duty the top of the pull goes lean.","Fit bigger injectors or a bigger fuel pump — what a healthy one of these runs."],
  gen(c0,r0,X){if(!ddSpark(c0))return null;
    for(const k of ["injectors","fuelPump"])for(const v of ddBelow(k,c0[k]).slice(0,3)){const c=Object.assign({},c0,{[k]:v});const r=X.sim(c);if(ddCrit(r,"fuel_delivery")&&r.peakHp>=0.7*r0.peakHp&&r.fails.length<=3)return{cfg:c,fix:[[k,c0[k]]],sig:"fuel_delivery"};}
    return null;}},
 {id:"knock_tim",tag:"pings under load",name:"Ignition timing",hrs:2,allowed:["timing","lambda","fuel"],k:0.95,pump:true,
  says:["A buddy 'tuned' it. Now it pings when I lean on it.","Rattles like marbles in a can when I floor it uphill.","Pings on the highway, worst in top gear climbing hills."],
  hints:["That rattle is knock. Read Detonation margin in the stress report.","Someone put too much timing in it for the fuel it runs: the margin is below zero.","Pull the ignition timing back toward where it should be — don't fix it with race gas."],
  gen(c0,r0,X){if(!ddSpark(c0))return null;
    for(let d=2;d<=14;d+=2){const c=Object.assign({},c0,{timing:c0.timing+d});if(c.timing>15)break;const r=X.sim(c);if(ddCrit(r,"detonation")&&r.fails.length<=2)return{cfg:c,fix:[["timing",c0.timing]],sig:"detonation"};}
    return null;}},
 {id:"knock_fuel",tag:"pings on regular",name:"Fuel vs timing",hrs:3,allowed:["timing","lambda","boost"],k:0.9,
  says:["Pings on the highway since I started filling it with regular.","Knocks going up hills. The guy at the counter said 87 is fine. I'm not paying for premium.","Sounds like gravel in the motor when I pass — and I only buy regular."],
  hints:["Listen for knock: read Detonation margin on a pull.","It was built for premium and it's running 87 regular. The customer won't change fuel.","Take timing out (and boost, if it has any) until the margin is positive — keep the power loss small."],
  gen(c0,r0,X){if(!ddSpark(c0)||DD_PUMP.indexOf(c0.fuel)<1)return null;const c=Object.assign({},c0,{fuel:"r87"});const r=X.sim(c);
    if(!ddCrit(r,"detonation")||r.fails.length>2)return null;
    for(let d=1;d<=14;d++){const f=Object.assign({},c,{timing:c.timing-d});if(f.timing<-15)break;const rf=X.sim(f);if(!rf.fails.length&&rf.peakHp>=0.85*r0.peakHp)return{cfg:c,fix:[["timing",f.timing]],sig:"detonation",fuels:["r87"],refHp:rf.peakHp};}
    return null;}},
 {id:"knock_cr",tag:"knocks since the rebuild",name:"Compression vs fuel",hrs:3,allowed:["timing","lambda","fuel"],k:0.93,internal:true,
  says:["Fresh rebuild — the machinist milled the head. Since then it knocks under load.","Had the head skimmed, now it pings and the pistons sound like they're rattling.","It's been knocking ever since the head came back from the shop."],
  hints:["That's knock. The Detonation margin on a pull shows it.","Milling the head raised the compression ratio — more octane needed than the tune allows for. The head stays on: no internal work.","Retard the timing, or put it on a higher-octane fuel. Don't touch the compression."],
  gen(c0,r0,X){if(!ddSpark(c0))return null;
    for(let d=0.5;d<=2.5;d+=0.5){const c=Object.assign({},c0,{cr:+(c0.cr+d).toFixed(2)});if(c.cr>15)break;const r=X.sim(c);if(ddCrit(r,"detonation")&&r.fails.length<=2){
      for(let t=1;t<=14;t++){const f=Object.assign({},c,{timing:c.timing-t});if(f.timing<-15)break;const rf=X.sim(f);if(!rf.fails.length)return{cfg:c,fix:[["timing",f.timing]],sig:"detonation",refHp:rf.peakHp};}
      return null;}}
    return null;}},
 {id:"vfloat",tag:"misses at the limiter",name:"Valve float",hrs:3,allowed:["springs","redline","valveMat"],k:0.97,internal:false,
  says:["Stumbles and misses right before the limiter at {rl}.","Above {r} it breaks up like it's hitting a rev limiter early.","Had the limiter raised to {rl}. Now it pops and misses near the top."],
  hints:["A miss only at the very top is the valvetrain. Read Valve float in the stress report.","The springs can't close the valves at that rpm — the customer wants the redline kept where it is.","Fit stiffer or lighter valve springs (dual, beehive, titanium retainers). Leave the redline."],
  gen(c0,r0,X){if(SIM.isRotary(c0))return null;const tryF=c=>{const r=X.sim(c);return ddCrit(r,"valve_float")&&r.fails.length===1?r:null;};
    for(const v of ddBelow("springs",c0.springs)){const c=Object.assign({},c0,{springs:v});if(tryF(c))return{cfg:c,fix:[["springs",c0.springs]],sig:"valve_float",redlineMin:c.redline};}
    for(let d=200;d<=1600;d+=200){const c=Object.assign({},c0,{redline:c0.redline+d});if(c.redline>12500)break;if(tryF(c)){
      for(const v of ddOrder("springs"))if(v!==c.springs&&X.ok("springs",v)){const f=Object.assign({},c,{springs:v});const rf=X.sim(f);if(!rf.fails.length)return{cfg:c,fix:[["springs",v]],sig:"valve_float",redlineMin:c.redline};}
      return null;}}
    return null;}},
 {id:"oil",tag:"oil light in long corners",name:"Oil starvation",hrs:3.5,w:0.4,allowed:["oilSystem","oilGrade","redline"],k:0.95,
  says:["Track car. The oil light flickers in long sweepers.","Oil pressure drops out in the long right-hander at the club track.","Spun a bearing last year. Now the oil light blinks in fast corners again."],
  hints:["Run a pull: the customer's duty — sustained cornering — is set on this job. Read Oil pickup / aeration.","A plain wet sump uncovers the pickup under sustained g; the oil sloshes away from it.","Fit a baffled or dry sump."],
  gen(c0,r0,X){if(c0.oilSystem==="dry"&&!X.ok("oilSystem","baffled"))return null;const g=+(1.1+0.2*X.rnd()).toFixed(2),env={gLat:g};
    const c=Object.assign({},c0,{oilSystem:"wet"});const r=X.sim(c,env);if(!ddCrit(r,"oil_starvation")||r.fails.length>1)return null;
    return{cfg:c,env,fix:[["oilSystem",c0.oilSystem==="wet"?"baffled":c0.oilSystem]],alt:[["oilSystem","baffled"],["oilSystem","dry"]],sig:"oil_starvation"};}},
 {id:"hot_turbo",tag:"cooks the turbo",name:"Lean on boost",hrs:2.5,allowed:["lambda","turbineMat","timing","boost"],k:0.95,
  says:["The exhaust manifold glows on a long pull and the turbo smells hot.","Went through a turbo last summer. This one's already smoking after long highway pulls.","Hot-side glows cherry red after a couple of hard runs."],
  hints:["Read Turbine inlet temp in the stress report (and EGT on the chart).","The tune runs it too lean on boost: lean burns hot, and the turbine takes the heat.","Richen the full-load λ back to where a boosted engine wants it (or fit an Inconel hot side)."],
  gen(c0,r0,X){if(!ddSpark(c0)||!ddTurbo(c0))return null;
    for(let d=0.03;d<=0.16;d+=0.03){const c=Object.assign({},c0,{lambda:+(c0.lambda+d).toFixed(2)});const r=X.sim(c);if(ddCrit(r,"turbine_temp")&&r.fails.length<=3)return{cfg:c,fix:[["lambda",c0.lambda]],sig:"turbine_temp"};}
    return null;}},
 {id:"creep",tag:"boost creep up top",name:"Boost creep",hrs:3.5,allowed:["map","boost"],k:0.96,map:true,
  says:["Boost won't hold — it keeps climbing past {b} bar up top, then it pings.","Gauge creeps way over target near the redline. The wastegate can't hold it.","Boost spikes at the top of third and it knocks or cuts out."],
  hints:["Boost creep: look at the Boost row of the tune map and the boost trace on a pull.","The boost target climbs in the top rpm columns — more than the turbo and the fuel can live with.","Pull the high-rpm boost cells back down to the rest of the row (select them, Interpolate or nudge)."],
  gen(c0,r0,X){if(!ddSpark(c0)||!ddTurbo(c0)||c0.turbine==="vgt")return null;const m0=SIM.mapFromSliders(c0);if(!m0.boost)return null;const n=m0.rpm.length,k0=n-Math.max(2,Math.round(n/3));
    for(let d=0.2;d<=1.2;d+=0.2){const m=ddCl(m0);for(let i=k0;i<n;i++)m.boost[i]=+(m0.boost[i]+d*(i-k0+1)/(n-k0)).toFixed(2);
      const c=Object.assign({},c0,{map:m,boost:Math.max(...m.boost)});const r=X.sim(c);if(r.fails.length&&r.fails.length<=3)return{cfg:c,fix:[["map",m0]],sig:null,b:c0.boost};}
    return null;}},
 {id:"cell",tag:"stumble in one spot",name:"Wrong map cell",hrs:3,allowed:["map","boost"],k:0.97,map:true,
  says:["Bought it with an aftermarket ECU. Around {r} it knocks, then it's fine again.","There's one spot near {r} where it rattles under full throttle.","Flat spot and a ping right about {r}. Clean either side of it."],
  hints:["It's only one band of rpm: read the tune map with the Knock and EGT overlays.","One or two full-load (100%) cells near {r} are way off the rest of the row.","Bring those cells back in line with their neighbours (select them and Interpolate, or nudge)."],
  gen(c0,r0,X){if(!ddSpark(c0))return null;const m0=SIM.mapFromSliders(c0),n=m0.rpm.length,W=m0.load.length-1;
    let i0=m0.rpm.reduce((bi,x,i)=>Math.abs(x-r0.peakTqRpm)<Math.abs(m0.rpm[bi]-r0.peakTqRpm)?i:bi,0);i0=Math.max(1,Math.min(n-3,i0));
    for(let d=4;d<=18;d+=2){const m=ddCl(m0);m.ign[W][i0]+=d;m.ign[W][i0+1]+=d;const c=Object.assign({},c0,{map:m});const r=X.sim(c);if(r.fails.length&&r.fails.length<=3)return{cfg:c,fix:[["map",m0]],sig:null,r:m0.rpm[i0]};}
    for(let d=0.06;d<=0.3;d+=0.04){const m=ddCl(m0);m.lam[W][i0]=+(m.lam[W][i0]+d).toFixed(2);m.lam[W][i0+1]=+(m.lam[W][i0+1]+d).toFixed(2);const c=Object.assign({},c0,{map:m});const r=X.sim(c);if(r.fails.length&&r.fails.length<=3)return{cfg:c,fix:[["map",m0]],sig:null,r:m0.rpm[i0]};}
    return null;}},
 {id:"smoke",tag:"rolling coal",name:"Over-fuelled diesel",hrs:2.5,allowed:["lambda","turboSize","dNoz","timing","ic"],k:0.95,
  says:["Smokes like a chimney. I'm getting looks — the inspection's next week.","Black smoke every time I touch the throttle. Smells like a cookstove.","Someone turned up the fuel. It rolls coal and the EGTs scare me."],
  hints:["Read Smoke on the verdict, and λ on the chart or the datalog: it's a diesel fuelling problem.","The fuel limiter lets in more fuel than the air can burn. The customer still wants it to pull.","Raise the full-load λ (fuel limiter) back toward stock, or give it more air with a bigger turbo."],
  gen(c0,r0,X){if(!SIM.isDiesel(c0))return null;
    for(let d=0.05;d<=0.9;d+=0.05){const c=Object.assign({},c0,{lambda:+(c0.lambda-d).toFixed(2)});if(c.lambda<1.05)break;const r=X.sim(c);if(r.fails.length)return null;if((r.smoke||0)>=35)return{cfg:c,fix:[["lambda",c0.lambda]],sig:"smoke",smokeMax:Math.max(12,Math.round((r0.smoke||0)+8))};}
    return null;}},
 {id:"small_turbo",tag:"runs out of breath",name:"Turbo too small",hrs:3,allowed:["turboSize","boost","ic"],k:0.97,
  says:["Pulls hard low, then it's like it hits a wall up top. Turbo screams.","Lost power after the turbo was replaced — it whistles and goes flat.","Spools instantly but it's done by {r}. The turbo sounds like a dentist's drill."],
  hints:["Read Compressor flow in the stress report.","The compressor is past its choke line: it only heats the air up top. Someone swapped in a smaller turbo.","Fit a turbo that flows what this engine needs — about what it came with."],
  gen(c0,r0,X){if(!ddTurbo(c0))return null;
    for(const v of ddBelow("turboSize",c0.turboSize,o=>o.maxFlow||0)){const c=Object.assign({},c0,{turboSize:v});const r=X.sim(c);if(ddCrit(r,"compressor_map")&&r.fails.length<=2)return{cfg:c,fix:[["turboSize",c0.turboSize]],sig:"compressor_map"};}
    return null;}},
 {id:"gasket",tag:"pushing coolant",name:"Head gasket",hrs:4,allowed:["gasket","studs","boost"],k:0.97,
  says:["Pushes coolant out of the overflow under boost. No milkshake in the oil — yet.","Bubbles in the radiator after a hard run, and the overflow's always full.","Lost coolant every hard pull since I turned the boost up."],
  hints:["Coolant pushed out under load means combustion gas getting past the head joint: read Head gasket and Head clamp margin.","The gasket can't seal the cylinder pressure this engine makes now.","Fit an MLS or copper O-ring gasket (and studs if the clamp is short). Keep the boost."],
  gen(c0,r0,X){if(!ddBoosted(c0)&&!SIM.isDiesel(c0))return null;
    for(const v of ddBelow("gasket",c0.gasket)){const c=Object.assign({},c0,{gasket:v});const r=X.sim(c);if((ddCrit(r,"gasket_shear")||ddCrit(r,"head_lift"))&&r.fails.length<=2)return{cfg:c,fix:[["gasket",c0.gasket]],sig:"gasket_shear"};}
    return null;}},
 {id:"thin_oil",tag:"bottom-end knock when hot",name:"Oil too thin",hrs:1.5,allowed:["oilGrade","oilSystem"],k:0.97,
  says:["Oil pressure falls off when it's hot and there's a knock from the bottom end.","Quick lube put 'the good thin stuff' in. Now the bottom end rattles when it's warm.","Low oil pressure light at hot idle, and a deep knock under load."],
  hints:["A hot-oil knock lives in the bearings: read Hydrodynamic film and Bearing specific load.","The oil is too thin for the bearing load: the film breaks down when it's hot.","Change to the oil grade this engine should run — thicker."],
  gen(c0,r0,X){if(SIM.isRotary(c0))return null;
    for(const v of ddBelow("oilGrade",c0.oilGrade,o=>o.kv100)){const c=Object.assign({},c0,{oilGrade:v});const r=X.sim(c);if((ddCrit(r,"oil_film")||ddCrit(r,"bearing_load"))&&r.fails.length<=2)return{cfg:c,fix:[["oilGrade",c0.oilGrade]],sig:"oil_film"};}
    return null;}},
 {id:"overheat",tag:"runs hot",name:"Cooling",hrs:3,allowed:["cooling","oilSquirters"],k:0.97,
  says:["Temperature gauge climbs on every long pull. Had to back out of it last weekend.","Boils over after two hard runs.","Runs hot under load — fine cruising, overheats when I lean on it."],
  hints:["Read Heat rejection in the stress report.","The radiator can't shed the heat this power level makes: someone fitted a cheaper core.","Fit a bigger cooling package."],
  gen(c0,r0,X){
    for(const v of ddBelow("cooling",c0.cooling)){const c=Object.assign({},c0,{cooling:v});const r=X.sim(c);if(ddCrit(r,"cooling")&&r.fails.length<=2)return{cfg:c,fix:[["cooling",c0.cooling]],sig:"cooling"};}
    return null;}}
];
/* parts the customer buys: list price of every part swapped in (tune numbers and map cells are labour) */
function ddPartsOf(a,b){let s=0;for(const k in b){const t=SIM.OPT[k];if(!t||typeof b[k]!=="string"||b[k]===a[k]||!t[b[k]])continue;s+=+t[b[k]].cost||0;}return Math.round(s);}
/* hand-back judge: {ok, issues:[...], newFails:[...], fixed} — cfg is the customer's engine as it is now, res a pull of it in the job's env */
function ddCheck(job,cfg,res){const iss=[],o=job.cfg,A=new Set(job.allowed);
  const nf=res.fails.filter(n=>job.f0.indexOf(n)<0),still=res.fails.filter(n=>job.f0.indexOf(n)>=0);
  if(still.length)iss.push("Still failing: "+still.join(", "));
  if(nf.length)iss.push("New failure: "+nf.join(", "));
  if(job.smokeMax!=null&&(res.smoke||0)>job.smokeMax)iss.push(`Smoke ${Math.round(res.smoke||0)}% — the customer wants ${job.smokeMax}% or less`);
  if(job.hpMin&&res.peakHp<job.hpMin)iss.push(`${Math.round(res.peakHp)} hp — the customer wants at least ${job.hpMin} hp`);
  if(job.fuels&&job.fuels.indexOf(cfg.fuel)<0)iss.push(`Fuel: the customer will only run ${job.fuels.map(f=>(SIM.OPT.fuel[f]||{}).name||f).join(" / ")}`);
  if(job.redlineMin&&cfg.redline<job.redlineMin)iss.push(`Redline ${cfg.redline} — the customer wants it kept at ${job.redlineMin}`);
  const bad=Object.keys(Object.assign({},o,cfg)).filter(k=>!A.has(k)&&!DD_FREE[k]&&JSON.stringify(cfg[k])!==JSON.stringify(o[k]));
  if(bad.length)iss.push("Work the customer didn't OK: "+bad.join(", "));
  return {ok:!iss.length,issues:iss,newFails:nf,botched:nf.length>0||bad.length>0,fixed:!still.length&&!(job.smokeMax!=null&&(res.smoke||0)>job.smokeMax)};}
/* make one job: X = {sim(cfg,envExtra), rnd(), ok(key,val), pool:[preset], f:[fault ids] (optional)} — null if nothing fits */
function ddMake(X){const tries=24;
  for(let n=0;n<tries;n++){const p=X.pool[Math.floor(X.rnd()*X.pool.length)];if(!p)return null;
    const fl=DD_FAULTS.filter(f=>!X.f||X.f.indexOf(f.id)>=0);let u=X.rnd()*fl.reduce((a,f)=>a+(f.w||1),0),F=fl[fl.length-1];for(const f of fl){u-=f.w||1;if(u<0){F=f;break;}}
    const c0=Object.assign({},SIM.DEFAULT_CFG,ddCl(p.cfg));const r0=X.sim(c0);if(r0.fails.length)continue;
    let g=null;try{g=F.gen(c0,r0,X);}catch(e){g=null;}if(!g)continue;
    const env=g.env||{},rf0=X.sim(g.cfg,env);
    const job={v:1,id:Math.floor(X.rnd()*1e9),preset:p.id,fault:F.id,cfg:g.cfg,env,allowed:F.allowed.slice(),f0:rf0.fails.slice(),hp0:Math.round(r0.peakHp),hpF:Math.round(rf0.peakHp),cost0:rf0.cost,
      smokeMax:g.smokeMax!=null?g.smokeMax:null,fuels:g.fuels||(F.pump&&DD_PUMP.indexOf(c0.fuel)>=0?DD_PUMP.slice():null),redlineMin:g.redlineMin||null,sig:g.sig,r:g.r||Math.round(c0.redline*0.72/100)*100,b:g.b||c0.boost,rl:g.cfg.redline};
    /* the reference fix must use parts the shop can fit, pass every target, and set the hp floor */
    const cands=[g.fix].concat((g.alt||[]).map(a=>[a]));let ref=null;
    for(const fx of cands){if(fx.some(([k,v])=>typeof v==="string"&&SIM.OPT[k]&&!X.ok(k,v)))continue;const fc=Object.assign({},g.cfg);fx.forEach(([k,v])=>fc[k]=typeof v==="object"?ddCl(v):v);
      if(fc.map&&fc.map.boost&&g.cfg.map)fc.boost=Math.max(...fc.map.boost);const rr=X.sim(fc,env);if(!rr.fails.length&&(job.smokeMax==null||(rr.smoke||0)<=job.smokeMax)){ref={fx,cfg:fc,res:rr};break;}}
    if(!ref)continue;
    job.hpMin=Math.floor(Math.min(F.k*r0.peakHp,0.985*ref.res.peakHp));
    if(!ddCheck(job,ref.cfg,ref.res).ok)continue;
    if(!(rf0.fails.length||(job.smokeMax!=null&&(rf0.smoke||0)>job.smokeMax)))continue;   // the fault must show on the dyno
    job.fix=ref.fx.map(([k,v])=>[k,typeof v==="object"?"(map)":v]);job.partsRef=ddPartsOf(g.cfg,ref.cfg);
    return job;}
  return null;}
/* ---- DYNO DAY core end ---- */
/* ---- DYNO DAY in the shop: the week's customers (C().dd), the customer bay (S.bay) and the hand-back.
   S.bay holds the player's own build while a customer's engine sits on the dyno: save()/snapshot() write the player's build
   (the customer engine rides along in o.bay.cur), the dyno never certifies, wears or records a customer engine, and recompute()
   puts back any part the customer didn't OK. Sandbox: "Practice diagnosis" — the same bay, no money. ---- */
const DD_WHO=["Dale","Marie","Kev","Priya","Earl","Tanya","Lou","Gus","Rosa","Wes","Darlene","Hank","Mo","Jules","Shane","Bev","Corey","Nadia","Ray","Fern","Lyle","Joanne","Arjun","Cass"];
const DD_VEH={g10:"'99 city hatch","4ac":"'87 hatchback","22re":"'89 compact pickup",ea82:"'88 wagon",l36:"'04 sedan",k20a:"'03 hot hatch","2jzgte":"'97 GT coupe",rb26:"'99 AWD coupe",ls3:"'10 muscle car",
  coyote:"'16 pony car",ej257:"'08 rally sedan",f6_38:"'09 rear-engined coupe",s54:"'04 sport coupe",v8fp45:"track-day exotic",v12_65:"'12 grand tourer",v10_52:"'10 supercar",i3_1000:"'17 city car",ea888:"'15 hot hatch",
  m133:"'14 AWD hatch",hemi64:"'70 muscle car",i5_25t:"'18 five-pot hatch",outlaw_radial:"radial drag car",outlaw_promod:"Pro Mod",d15b:"'95 commuter",ea211:"'19 compact",["2zr"]:"'12 compact",skyg25:"'16 crossover",
  kent:"'71 club racer",lima23:"'84 pony car",ford300:"'86 farm truck",vortec43:"'05 Silverado",["1gr"]:"'08 4x4",godzilla73:"'21 three-quarter-ton",sbc350:"'79 street rod",f20c:"'02 roadster",["4age20v"]:"'85 sprint coupe",
  ["4g63"]:"'98 rally sedan",b58:"'20 sport sedan",vr38:"'12 AWD supercar",["9a2tt"]:"'18 sports car",p997t:"'11 turbo coupe",m156:"'09 super-sedan",voodoo:"'16 track pony car",hellcat:"'19 blown coupe",lt4:"'17 blown coupe",
  s85:"'07 super-sedan",["1lr"]:"V10 exotic",dfv:"historic Grand Prix car",wrc16:"rally car",gt3r:"cup car",valkyrie:"hypercar",k24_1000:"drag hatch",jz_1500:"drag coupe",n2o632:"nitrous dragster",pro540:"blown drag car",
  compound402:"outlaw truck",p4236:"'78 tractor",c59_12v:"'95 three-quarter-ton",lb7:"'03 heavy-duty pickup",psd73:"'99 super-duty",psd67:"'19 super-duty",alh:"'02 diesel wagon",om606:"'97 diesel sedan",s60:"'05 highway tractor",
  ["1kd"]:"'10 diesel 4x4",smoker26:"pulling truck",ss_triple:"super stock puller",["12a_sa"]:"'79 rotary coupe",["13b_fc"]:"'88 rotary coupe",["13b_rew"]:"'94 twin-turbo rotary",renesis:"'05 rotary coupe",["20b_rew"]:"'96 three-rotor",
  ["13b_bp"]:"rotary club racer",r26b:"four-rotor prototype"};
const DD_COST=[3000,4500,6500,9500,16000,1e9];   // dearest customer engine by rep tier: a backyard shop sees commuters
function DD(){const c=C();if(!c.dd||typeof c.dd!=="object")c.dd={};const d=c.dd;if(!Array.isArray(d.jobs))d.jobs=[];
  for(const k of ["week","passed","failed","earned","streak"])if(typeof d[k]!=="number")d[k]=0;if(!d.seed)d.seed=1+Math.floor(Math.random()*1e9);return d;}
function ddRnd(o){return()=>{o.seed=(o.seed*1664525+1013904223)>>>0;return o.seed/4294967296;};}
const ddFault=id=>DD_FAULTS.find(f=>f.id===id)||DD_FAULTS[0];
const ddFill=(s,j)=>String(s).replace(/\{r\}/g,(+j.r||0).toLocaleString("en-CA")).replace(/\{rl\}/g,(+j.rl||0).toLocaleString("en-CA")).replace(/\{b\}/g,(+j.b||0).toFixed(1));
const ddEsc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function ddKeyLbl(k){if(k==="map")return "Tune map";const f=FORM.flatMap(x=>x.fields).find(x=>x.key===k);return f?fLabel(f):k;}
const ddLabel=j=>`${j.who}'s ${j.veh}`;
const ddEnvX=()=>S&&S.bay&&S.bay.job.env?S.bay.job.env:null;
let ddPresetHp=null;
function ddPool(){const dc=career()?dynoCap():{hp:1e9,rpm:1e9},ti=career()?repTierIdx():5,e=simEnv({testType:"pull"}),k=envHash();
  if(!ddPresetHp||ddPresetHp.k!==k){ddPresetHp={k,m:{}};}
  return PRESETS.filter(p=>{if(!p||!p.cfg||!p.id)return false;if(career()&&(locked(OPT.layout[p.cfg.layout])||(p.cfg.redline||0)>dc.rpm))return false;
    let m=ddPresetHp.m[p.id];if(!m){try{const r=SIM.simulate(Object.assign({},SIM.DEFAULT_CFG,p.cfg),e);m={hp:r.peakHp,cost:r.cost};}catch(x){m={hp:1e9,cost:1e9};}ddPresetHp.m[p.id]=m;}
    return m.hp<=dc.hp*0.9&&(!career()||m.cost<=DD_COST[ti]);});}
function ddMakeJob(rnd,practice,only){const pool=ddPool();if(!pool.length)return null;
  const X={sim:(cfg,ex)=>SIM.simulate(cfg,simEnv(Object.assign({testType:"pull"},ex||{}))),rnd,ok:(k,v)=>!(career()&&OPT[k]&&OPT[k][v]&&locked(OPT[k][v])),pool,f:only};
  const j=ddMake(X);if(!j)return null;const F=ddFault(j.fault),p=PRESETS.find(q=>q.id===j.preset)||{};
  j.who=DD_WHO[Math.floor(rnd()*DD_WHO.length)];j.veh=DD_VEH[j.preset]||("'"+String(90+Math.floor(rnd()*30)).slice(-2)+" "+(presetCls(p)==="truck"?"pickup":"car"));j.eng=p.name||j.preset;
  j.says=ddFill(F.says[Math.floor(rnd()*F.says.length)],j);j.tag=F.tag;j.hints=0;j.paid=0;
  const ti=career()?repTierIdx():0;j.labour=practice?0:Math.max(250,Math.round(F.hrs*(110+j.cost0*0.034)*(1+0.2*ti)/10)*10);   // shop rate: $110/h plus the engine's worth
  j.budget=Math.max(100,Math.round((j.partsRef*1.25+60)/50)*50);return j;}
/* the week's walk-ins: 0-3 by rep and dyno, more with a dyno technician */
function ddWeek(){if(!career())return;const d=DD();if(d.week===C().week)return;
  if(S.bay&&!S.bay.practice&&!testing){const j=S.bay.job;ddExit();C().rep=Math.max(0,C().rep-1);d.failed++;d.streak=0;logEvent(`Dyno day: ${ddLabel(j)} came back for it unfinished — −1 rep`,"bad");}
  const left=d.jobs.filter(j=>j.st==="open").length;d.jobs=d.jobs.filter(j=>j.st==="bay"&&S.bay&&S.bay.job.id===j.id);d.week=C().week;
  const rnd=ddRnd(d),lam=0.55+0.32*repTierIdx()+(staffed("dynotech")?0.45:0)+(has("dyno2")?0.15:0);let n=Math.max(0,Math.min(3,Math.round(lam+(rnd()-0.5)*1.4)));
  for(let i=0;i<n;i++){const j=ddMakeJob(rnd,false);if(j){j.st="open";d.jobs.push(j);}}
  if(left&&d.week>1)logEvent(`Dyno day: ${left} customer${left>1?"s":""} took ${left>1?"their cars":"the car"} elsewhere`,"");
  const nn=d.jobs.filter(j=>j.st==="open").length;if(nn&&d.week>1)setTimeout(()=>toast(`DYNO DAY · ${nn} customer${nn>1?"s":""} booked in`),2700);}
function ddEnter(j,practice){if(testing){toast("Let the run finish first");return false;}if(S.bay)return false;if(rnLive()||PO||ER){toast("Finish the event first");return false;}
  S.bay={job:j,practice:!!practice,own:{cfg:S.cfg,last:S.last,base:S.base,testType:S.env.testType,profileId:S.profileId,name:S.name}};
  S.cfg=Object.assign({},SIM.DEFAULT_CFG,ddCl(j.cfg));S.last=null;S.base=null;S.env.testType="pull";S.profileId=(PRESETS.find(p=>p.id===j.preset)||{}).soundProfile||null;S.name=ddLabel(j);
  resetBase();afterCfgChange(true);ddBar();save();return true;}
function ddExit(){const B=S.bay;if(!B)return;const o=B.own;S.bay=null;S.cfg=o.cfg;S.last=o.last;S.base=o.base;S.env.testType=o.testType||"pull";S.profileId=o.profileId;S.name=o.name;
  resetBase();afterCfgChange(true);ddBar();if(curTab==="test")renderTest();save();}
/* the customer only pays for what they OK'd: anything else goes back as it came (fuel stays a liquid spark fuel) */
let ddGuardT=0;
function ddGuard(){const B=S.bay;if(!B)return;const o=B.job.cfg,A=new Set(B.job.allowed),back=[];
  for(const k of Object.keys(Object.assign({},o,S.cfg))){if(A.has(k)&&!(k==="fuel"&&!ddFuelOk(S.cfg.fuel))||DD_FREE[k])continue;
    if(JSON.stringify(S.cfg[k])===JSON.stringify(o[k]))continue;if(o[k]===undefined)delete S.cfg[k];else S.cfg[k]=ddCl(o[k]);back.push(k);}
  if(back.length&&!ddGuardT){ddGuardT=setTimeout(()=>{ddGuardT=0;renderBuild();ENGINE_VIS.buildEngine(S.cfg,LAYOUTS[S.cfg.layout]);},0);toast(`${B.job.who} didn't OK that — ${back.map(ddKeyLbl).join(", ")} put back`);}}
function ddMarkBuild(){if(!S.bay)return;const A=new Set(S.bay.job.allowed);
  document.querySelectorAll("#buildForm [data-k],#buildForm [data-nk],#buildForm [data-num]").forEach(el=>{const k=el.dataset.k||el.dataset.nk||el.dataset.num;if(A.has(k)||DD_FREE[k])return;el.classList.add("ddno");if(el.tagName==="INPUT")el.disabled=true;});}
function ddParts(){const B=S.bay;return B?ddPartsOf(B.job.cfg,S.cfg):0;}
function ddHintCost(j){if(S.bay&&S.bay.practice||!career())return 0;return (j.hints===0&&staffed("tuner"))?0:Math.max(20,Math.round(j.labour*0.12/10)*10);}
function ddHint(){const B=S.bay;if(!B)return;const j=B.job;if(j.hints>=3)return;const c=ddHintCost(j);j.hints++;if(c)j.paid+=c;save();ddRender();
  toast(c?`Hint · ${fmt$(c)} off the labour`:j.hints===1&&staffed("tuner")&&career()?"Your calibration engineer has a look — free":"Hint");}
function ddVerdict(res){const B=S.bay,j=B.job,ck=ddCheck(j,S.cfg,res);
  return `<div class="verdict ${ck.ok?"pass":"marg"}"><div style="flex:1"><div class="big">${ck.ok?"READY TO HAND BACK":"CUSTOMER ENGINE"}</div><p>${ck.ok?`It's clean and it meets what ${ddEsc(j.who)} asked for. Hand it back from the Dyno day card.`:ck.issues.map(ddEsc).join(" · ")}</p>
    <div class="vstats"><div><b>${Math.round(res.peakHp)}</b><span>hp · wants ${j.hpMin}+</span></div>${res.diesel?`<div><b>${Math.round(res.smoke||0)}%</b><span>Smoke${j.smokeMax!=null?" · max "+j.smokeMax+"%":""}</span></div>`:`<div><b>${res.knock.margin>=0?"+":""}${res.knock.margin.toFixed(1)}</b><span>Knock margin</span></div>`}<div><b>${res.rel}</b><span>Reliability</span></div><div><b>${fmt$(ddParts())}<i style="font-style:normal;font-size:.75em;color:var(--muted)"> / ${fmt$(j.budget)}</i></b><span>Parts / budget</span></div></div></div></div>`;}
function ddHand(){const B=S.bay;if(!B||testing)return;const j=B.job;const last=S.last&&S.last.hash===cfgHash(S.cfg)?S.last:null;
  if(!last){toast("Pull it as it sits first — the customer wants the dyno sheet");return;}
  const ck=ddCheck(j,S.cfg,last.res);if(!ck.ok&&!B.confirm){B.confirm=true;B.issues=ck.issues;ddRender();toast("Not right yet — see the job card");return;}
  const parts=ddParts(),under=parts<=j.budget,clean=ck.ok&&!j.hints&&under,F=ddFault(j.fault);
  if(B.practice){S.achN=S.achN||{};if(ck.ok)S.achN.ddp=(S.achN.ddp||0)+1;ddExit();toast(ck.ok?`FIXED · ${F.name} — ${j.fix.map(x=>ddKeyLbl(x[0])).join(", ")}`:`NOT FIXED · it was ${F.name.toLowerCase()} — ${j.fix.map(x=>ddKeyLbl(x[0])).join(", ")}`);
    if(ck.ok)achCheck({type:"dd",pass:true,clean});return;}
  const d=DD(),dj=d.jobs.find(x=>x.id===j.id);j.st=ck.ok?"done":"failed";if(dj)dj.st=j.st;
  if(ck.ok){const lab=Math.max(0,j.labour-j.paid),bonus=under?Math.round(j.labour*0.15/10)*10:0,bill=lab+Math.round(Math.min(parts,j.budget)*1.3)+bonus,net=bill-parts;
    C().cash+=net;C().rep+=clean?2:1;d.passed++;d.earned+=net;d.streak++;j.net=net;
    logEvent(`Dyno day: ${ddLabel(j)} fixed (${F.name.toLowerCase()}) — billed ${fmt$(bill)}${bonus?", under budget":""}, net ${fmt$(net)}`,"good");toast(`FIXED · ${fmt$(net)} net${bonus?" · under budget":""}`);}
  else{const hit=ck.botched?3:2;C().cash-=parts;C().rep=Math.max(0,C().rep-hit);d.failed++;d.streak=0;
    logEvent(`Dyno day: ${ddLabel(j)} handed back ${ck.botched?"worse than it came in":"unfixed"} (${F.name.toLowerCase()}) — −${hit} rep${parts?", "+fmt$(parts)+" in parts on you":""}`,"bad");toast(`${ck.botched?"BOTCHED":"NOT FIXED"} · −${hit} rep`);}
  ddExit();hud();if(ck.ok)achCheck({type:"dd",pass:true,clean});checkGoals();save();}
function ddWalk(){const B=S.bay;if(!B||testing)return;const j=B.job;
  if(!B.practice){const d=DD(),dj=d.jobs.find(x=>x.id===j.id);j.st="failed";if(dj)dj.st="failed";d.failed++;d.streak=0;C().rep=Math.max(0,C().rep-1);logEvent(`Dyno day: sent ${ddLabel(j)} away unfixed — −1 rep`,"");}
  ddExit();hud();toast(B.practice?"Practice engine off the dyno":"Customer sent away — −1 rep");}
function ddPractice(){const o={seed:1+Math.floor(Math.random()*1e9)};const j=ddMakeJob(ddRnd(o),true);if(!j){toast("Couldn't find a sick engine — try again");return;}j.st="bay";if(ddEnter(j,true)){renderTest();toast(`Practice: ${ddLabel(j)} — "${j.tag}"`);}}
function ddBar(){const b=$("ddBar");if(!b)return;const B=S&&S.bay;$("panel").classList.toggle("ddon",!!B);if(!B){b.hidden=true;b.innerHTML="";return;}
  b.hidden=false;b.innerHTML=`<div class="ddbt"><small>${B.practice?"Practice bay":"Customer bay"}</small><b>${B.practice?"Practice":"Customer"}: ${ddEsc(ddLabel(B.job))} — ‘${ddEsc(B.job.tag)}’</b></div><button class="btn sm" data-dd="goto">Job ›</button>`;
  requestAnimationFrame(()=>$("panel").style.setProperty("--ddh",b.offsetHeight+"px"));}
function ddReqHtml(j){const F=ddFault(j.fault),t=[`No failures on the dyno`,`At least ${j.hpMin.toLocaleString("en-CA")} hp`];
  if(j.smokeMax!=null)t.push(`Smoke ${j.smokeMax}% or less`);if(j.fuels)t.push(`Fuel: ${j.fuels.map(f=>(OPT.fuel[f]||{}).name||f).join(" / ")} only`);if(j.redlineMin)t.push(`Redline stays at ${j.redlineMin.toLocaleString("en-CA")} rpm`);
  if(F.internal)t.push("No internal work — the head stays on");if(j.env&&j.env.gLat)t.push(`Duty: ${j.env.gLat.toFixed(2)} g sustained cornering (set on this job's pulls)`);
  return `<ul class="ddreq">${t.map(x=>`<li>${ddEsc(x)}</li>`).join("")}</ul>`;}
function ddRender(){const sec=$("ddSec");if(!sec)return;const B=S.bay,show=!!B||S.env.testType==="pull";sec.hidden=!show;if(!show)return;const box=$("ddBox");
  if(B){const j=B.job,F=ddFault(j.fault),parts=ddParts(),hc=ddHintCost(j);$("ddCnt").textContent=B.practice?"practice":"on the dyno";
    box.innerHTML=`<div class="card ddjob on"><div class="ddh"><b>${ddEsc(ddLabel(j))}</b><span>${ddEsc(j.eng)}${B.practice?"":" · labour "+fmt$(j.labour)}</span></div>
      <p class="ddsay">“${ddEsc(j.says)}”</p>
      <div class="ddk"><span>They'll pay for</span><b>${j.allowed.map(ddKeyLbl).map(ddEsc).join(" · ")}</b></div>
      ${ddReqHtml(j)}
      ${B.practice?"":`<div class="ddk"><span>Parts so far</span><b class="${parts>j.budget?"crit":""}">${fmt$(parts)} of ${fmt$(j.budget)} budget</b></div>`}
      ${j.hints?`<ol class="ddhints">${F.hints.slice(0,j.hints).map(h=>`<li>${ddEsc(ddFill(h,j))}</li>`).join("")}</ol>`:""}
      ${B.confirm&&B.issues?`<div class="ddiss">${B.issues.map(x=>`<div>${ddEsc(x)}</div>`).join("")}</div>`:""}
      <div class="row ddbtns"><button class="btn pri" data-dd="hand"${testing?" disabled":""}>${B.confirm?(B.practice?"Hand it back as is":"Hand back unfixed · rep hit"):"Hand back"}</button>${j.hints<3?`<button class="btn sm" data-dd="hint">Hint${hc?" · "+fmt$(hc):B.practice||!career()?"":" · free"}</button>`:""}<button class="btn sm ghost" data-dd="walk"${testing?" disabled":""}>${B.practice?"Done":"Walk away"}</button></div>
      <p class="hint">Run pulls, read the stress report, the chart and Analysis, change only what they'll pay for, then pull it again before you hand it back.</p></div>`;return;}
  if(!career()){$("ddCnt").textContent="practice";box.innerHTML=`<p class="hint" style="margin-top:-4px">In career, customers book dyno time for their own sick engines. Practise here: a random engine comes in with one fault and a complaint. Find it, fix it with the parts they'll pay for, and hand it back. Your own build waits in the corner.</p><button class="btn" data-dd="practice" style="width:100%">Practice diagnosis</button>`;return;}
  ddWeek();const d=DD(),open=d.jobs.filter(j=>j.st==="open");$("ddCnt").textContent=open.length?`${open.length} booked`:"none this week";
  box.innerHTML=`<p class="hint" style="margin-top:-4px">Customers book the dyno for their own engines. Take a job: their engine goes on the dyno in place of yours (yours waits). Find the fault, fix it with the parts they'll pay for, hand it back. Pay = labour + 30% on parts; under budget earns a bonus. A botched job costs rep.${d.passed?` · ${d.passed} fixed so far, ${fmt$(d.earned)} net`:""}</p>`
    +(open.length?open.map(j=>`<div class="card ddjob"><div class="ddh"><b>${ddEsc(ddLabel(j))}</b><span>${ddEsc(j.eng)} · labour ${fmt$(j.labour)}</span></div><p class="ddsay">“${ddEsc(j.says)}”</p><button class="btn sm pri" data-dd="take" data-id="${j.id}" style="width:100%"${testing?" disabled":""}>Take the job</button></div>`).join(""):`<p class="hint">No customers booked this week. More come in as the shop's reputation grows — a dyno technician brings in more.</p>`);}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-dd]");if(!b)return;const a=b.dataset.dd;
  if(a==="goto"){showTab("test");requestAnimationFrame(()=>{const s=$("ddSec");if(s)s.scrollIntoView({block:"start",behavior:calmScroll()});});return;}
  if(a==="practice"){ddPractice();return;}if(a==="hint"){ddHint();return;}if(a==="hand"){ddHand();return;}if(a==="walk"){ddWalk();return;}
  if(a==="take"){const j=DD().jobs.find(x=>String(x.id)===b.dataset.id&&x.st==="open");if(!j)return;if(ddEnter(j,false)){j.st="bay";renderTest();toast(`${j.who}'s engine is on the dyno — "${j.tag}"`);}}});
/* while a customer engine is on the dyno, nothing swaps the whole engine or the game out from under it */
document.addEventListener("click",e=>{if(!S||!S.bay||!e.target.closest)return;const no=e.target.closest("#buildForm .ddno");if(no){e.stopPropagation();e.preventDefault();toast(`${S.bay.job.who} isn't paying for that — ${ddKeyLbl(no.dataset.k||no.dataset.nk||no.dataset.num)}`);return;}const b=e.target.closest("#presets [data-p],#bpList [data-load],[data-abload],#modeBox button,#testType button,#evPick button,[data-evgo],#slots [data-load],#importSave,#replayFF");if(!b)return;
  if(b.matches("#testType button")&&b.dataset.t==="pull")return;e.stopPropagation();e.preventDefault();toast(`${S.bay.practice?"Practice":"Customer"} engine on the dyno — hand it back or walk away first`);},true);
function advanceWeek(){C().week++;C().shipped=0;ENGINE_VIS.setMood(C().week);const oh=overhead();C().cash-=oh;let t=`Overhead ${fmt$(oh)}`;
  t+=loanWeek();
  if(wages())t+=` (wages ${fmt$(wages())})`;
  logEvent(t,"");warrantyPass();repeatPass();servicePass();rndPass();prestigePass();refillContracts();spWeek();checkGoals();achCheck({type:"week"});ddWeek();
  if(C().cash<FORECLOSE_AT)logEvent("The bank has called the loan. The shop is in receivership.","bad");
  else if(C().cash<-5000)toast("The bank is calling. Sell something.");}
/* ===================== SPONSORS (career) =====================
   Made-up brands approach the shop on reputation and results: race nights, pulls, the salt, delivered orders. An offer pays a
   weekly retainer and/or bonuses per win, record or top-3 class finish, for a set number of weeks, and comes with obligations.
   Break one and the deal ends with a cash penalty and a rep hit. Slots open with rep (SP_SLOT_REP). State lives on C().spons;
   spS() fills its defaults, so old saves load clean. The primary sponsor goes on the hood and the rest on the sides
   (ENGINE_VIS.setLivery). Nothing here touches S.cfg, so cfgHash and the dyno are unchanged. */
const SP_BRANDS=[
  {id:"heron",name:"Blue Heron",tag:"Motor oil",type:"oil",shape:"drop",c1:"#16325c",c2:"#f2b630",c3:"#f4f1e8"},
  {id:"coldwater",name:"Coldwater",tag:"Lubricants",type:"oil",shape:"ring",c1:"#0d5c63",c2:"#9fe3e0",c3:"#ffffff"},
  {id:"ironhorn",name:"Ironhorn",tag:"Performance parts",type:"parts",shape:"gear",c1:"#26282c",c2:"#e8462b",c3:"#f4f1e8"},
  {id:"corvid",name:"Corvid",tag:"Pistons & rods",type:"parts",shape:"diamond",c1:"#3b1f5c",c2:"#c9b3f2",c3:"#ffffff"},
  {id:"gopher",name:"Gopher Valley",tag:"Feed & seed",type:"feed",shape:"leaf",c1:"#2f6b2a",c2:"#f2d04a",c3:"#fffbe8"},
  {id:"coulee",name:"Red Butte",tag:"Farmers' co-op",type:"feed",shape:"shield",c1:"#8c1d18",c2:"#f4f1e8",c3:"#ffffff"},
  {id:"gripline",name:"Gripline",tag:"Race tyres",type:"tyre",shape:"ring",c1:"#111214",c2:"#f2c230",c3:"#ffffff"},
  {id:"hollow",name:"Hollow Ridge",tag:"Rubber co.",type:"tyre",shape:"wing",c1:"#f2efe6",c2:"#1e4fa3",c3:"#16181c"},
  {id:"moose",name:"Static Moose",tag:"Energy drink",type:"energy",shape:"bolt",c1:"#1a1a1a",c2:"#7cf03a",c3:"#ffffff"},
  {id:"wildoat",name:"Wild Oat",tag:"Energy soda",type:"energy",shape:"star",c1:"#e2541c",c2:"#fff3b0",c3:"#ffffff"},
  {id:"northlight",name:"Northlight",tag:"Race fuels",type:"fuel",shape:"star",c1:"#0e1f3d",c2:"#ff7a1a",c3:"#f4f1e8"}];
const SP_TYPES={oil:"Oil company",parts:"Parts maker",feed:"Local feed store",tyre:"Tyre brand",energy:"Energy drink",fuel:"Fuel supplier"};
const SP_LIKES={oil:["night","pull","salt","endurance","boat"],parts:["sale","night","salt"],feed:["pull","bog"],tyre:["night","drag","endurance","bog","hill"],energy:["night","drag","salt","hill"],fuel:["salt","night","endurance","boat","hill"]};
const SP_OBL={oil:["nights","pulls"],parts:["deliver"],feed:["pulls"],tyre:["nights"],energy:["nights","nodiesel"],fuel:["salt","nodiesel"]};
const SP_OBL_TXT={nights:n=>`Run at least ${n} race night${n>1?"s":""}`,pulls:n=>`Enter at least ${n} truck pull${n>1?"s":""}`,salt:n=>`Make at least ${n} run${n>1?"s":""} on the salt`,
  deliver:n=>`Ship at least ${n} engine order${n>1?"s":""}`,nodiesel:()=>"No diesel builds at the track",rep:n=>`Keep reputation at ${n} or better`};
const SP_SLOT_REP=[0,120,300];
const SP_EVT={hill:"Pikes Peak",boat:"the boat drags",bog:"the mud bog",endurance:"the 24 Hours",night:"a race night",pull:"the pull",salt:"the salt",drag:"the strip",sale:"your engines"};
function spS(){const c=C();const s=c.spons&&typeof c.spons==="object"?c.spons:(c.spons={});
  if(!Array.isArray(s.active))s.active=[];if(!Array.isArray(s.offers))s.offers=[];if(!s.form||typeof s.form!=="object")s.form={};
  if(!s.hist||typeof s.hist!=="object")s.hist={};for(const k of ["signed","done","broken","earned","max"])s.hist[k]=+s.hist[k]||0;
  if(!s.seed)s.seed=((c.seed||1)^0x5f3759df)>>>0||7;return s;}
function spRng(){const s=spS();s.seed=(s.seed*1664525+1013904223)>>>0;return s.seed/4294967296;}
function spBrand(id){return SP_BRANDS.find(b=>b.id===id)||SP_BRANDS[0];}
function spSlots(){return SP_SLOT_REP.filter(r=>C().rep>=r).length;}
function spDiesel(){return isCI(S.cfg.fuel);}
function spPrimary(){const s=spS();return s.active.some(a=>a.b===s.primary)?s.primary:(s.active[0]?s.active[0].b:null);}
const spR10=v=>Math.round(v/10)*10,spR50=v=>Math.round(v/50)*50;
/* a new offer: the brand leans toward whatever the shop has been doing lately (form), the money toward its reputation */
function spGen(kind){const s=spS();const tier=repTierIdx();const taken=new Set(s.active.map(a=>a.b).concat(s.offers.map(o=>o.b)));
  const pool=SP_BRANDS.filter(b=>!taken.has(b.id));if(!pool.length)return null;
  const w=pool.map(b=>0.4+SP_LIKES[b.type].reduce((a,k)=>a+(s.form[k]||0),0)+(kind&&SP_LIKES[b.type].includes(kind)?3:0));
  let r=spRng()*w.reduce((a,v)=>a+v,0),i=0;while(i<pool.length-1&&(r-=w[i])>0)i++;const b=pool[i],likes=SP_LIKES[b.type];
  const weeks=4+Math.floor(spRng()*5)+(tier>=3?2:0),scale=1+tier*0.5+Math.min(1,C().rep/500),style=spRng();
  const ret=style<0.25?0:spR10((100+spRng()*100)*scale*(style>0.75?1.5:1)),bm=style<0.25?2:style>0.75?0.5:1;
  const bon={win:spR50(250*scale*bm),finish:likes.some(k=>k==="night"||k==="pull"||k==="bog"||k==="boat"||k==="hill")?spR50(80*scale*bm):0,record:likes.includes("salt")?spR50(800*scale*bm):0};
  const pick=SP_OBL[b.type][Math.floor(spRng()*SP_OBL[b.type].length)];
  const n={nights:Math.max(1,Math.round(weeks/4)),pulls:Math.max(1,Math.round(weeks/4)),salt:1+(weeks>=7?1:0),deliver:Math.max(1,Math.round(weeks/3))}[pick];
  const obl=[{k:pick,n:n||0}];if(C().rep>=10&&spRng()<0.5)obl.push({k:"rep",n:Math.max(5,Math.floor(C().rep*0.85))});
  const o={id:Math.floor(spRng()*1e9),b:b.id,weeks,ret,bon,obl,pen:spR50(Math.max(500,ret*2+bon.win*0.5)),penRep:4+tier*2,exp:C().week+2,
    why:kind&&SP_EVT[kind]?`Saw what you did at ${SP_EVT[kind]}.`:""};
  s.offers.push(o);return o;}
function spLivery(){let L=null;if(S&&career()){const s=spS(),p=spPrimary();if(p)L={hood:spBrand(p),sides:s.active.filter(a=>a.b!==p).map(a=>spBrand(a.b))};}
  try{ENGINE_VIS.setLivery(L);}catch(e){}}
function spDrop(a){const s=spS();s.active=s.active.filter(x=>x!==a);if(s.primary===a.b)s.primary=spPrimary();}
function spBreak(a,why){const b=spBrand(a.b);C().cash-=a.pen;C().rep=Math.max(0,C().rep-a.penRep);spS().hist.broken++;spDrop(a);
  logEvent(`${b.name} pulled the sponsorship — ${why}. ${fmt$(a.pen)} penalty, −${a.penRep} rep`,"bad");setTimeout(()=>toast(`${b.name.toUpperCase()} · DEAL BROKEN · −${fmt$(a.pen)}`),1600);}
function spEnd(a){const b=spBrand(a.b),s=spS();const miss=a.obl.filter(o=>o.k!=="rep"&&o.k!=="nodiesel"&&(o.have||0)<o.n);
  if(miss.length){C().cash-=a.pen;C().rep=Math.max(0,C().rep-a.penRep);s.hist.broken++;logEvent(`${b.name} deal ended short — ${miss.map(o=>SP_OBL_TXT[o.k](o.n).toLowerCase()+" ("+(o.have||0)+")").join(", ")}. ${fmt$(a.pen)} penalty, −${a.penRep} rep`,"bad");}
  else{const rep=3+repTierIdx();C().rep+=rep;s.hist.done++;logEvent(`${b.name} deal done — every obligation met, ${fmt$(a.earned)} earned, +${rep} rep`,"good");}
  spDrop(a);}
/* weekly: retainers, the rep floor, contracts running out, offers expiring, new approaches */
function spWeek(){if(!career())return;const s=spS();let paid=0;
  for(const a of s.active.slice()){if(a.ret){C().cash+=a.ret;a.earned+=a.ret;s.hist.earned+=a.ret;paid+=a.ret;}
    const ro=a.obl.find(o=>o.k==="rep");if(ro&&C().rep<ro.n){spBreak(a,`reputation fell below ${ro.n}`);continue;}
    if(C().week>=a.end)spEnd(a);}
  if(paid)logEvent(`Sponsors: ${fmt$(paid)} in retainers`,"good");
  for(const k in s.form)s.form[k]=Math.round(s.form[k]*70)/100;
  s.offers=s.offers.filter(o=>o.exp>=C().week);
  const tot=Object.values(s.form).reduce((a,v)=>a+v,0);
  if(s.offers.length<3&&(C().rep>=10||tot>0.5)&&spRng()<0.22+0.08*repTierIdx()+Math.min(0.4,tot*0.08)){const o=spGen(null);if(o)logEvent(`${spBrand(o.b).name} (${SP_TYPES[spBrand(o.b).type].toLowerCase()}) wants to sponsor the shop — see Market`,"good");}
  spLivery();}
/* a result: obligations count, bans bite, bonuses pay, and a good night can bring a brand to the pits */
function spEvent(kind,o){if(!career()||ff)return;const s=spS();o=o||{};s.form[kind]=(s.form[kind]||0)+(o.win||o.record?2:1);
  if(kind!=="sale"&&spDiesel())for(const a of s.active.slice())if(a.obl.some(q=>q.k==="nodiesel"))spBreak(a,"you ran a diesel at the track");
  const cnt={night:"nights",pull:"pulls",salt:"salt",sale:"deliver"}[kind];
  if(cnt&&!o.noCount)for(const a of s.active)for(const q of a.obl)if(q.k===cnt)q.have=(q.have||0)+1;
  const t=o.record?"record":o.win?"win":o.finish?"finish":null,got=[];let sum=0;
  if(t)for(const a of s.active){const v=a.bon&&a.bon[t];if(v){C().cash+=v;a.earned+=v;s.hist.earned+=v;sum+=v;got.push(`${spBrand(a.b).name} ${fmt$(v)}`);}}
  if(got.length){logEvent(`Sponsor bonus (${t==="finish"?"top-3 finish":t}): ${got.join(", ")}`,"good");setTimeout(()=>toast(`SPONSOR BONUS · +${fmt$(sum)}`),3400);}
  if(t&&s.offers.length<3&&spRng()<(t==="record"?0.7:t==="win"?0.45:0.2)){const of=spGen(kind);if(of)logEvent(`${spBrand(of.b).name} saw that and wants to talk — see Market`,"good");}
  spLivery();}
function spSign(id){const s=spS();const o=s.offers.find(x=>x.id==id);if(!o||s.active.length>=spSlots())return false;
  const a=Object.assign({},o,{w0:C().week,end:C().week+o.weeks,earned:0,obl:o.obl.map(q=>({k:q.k,n:q.n,have:0}))});delete a.exp;delete a.why;
  s.active.push(a);s.offers=s.offers.filter(x=>x!==o);s.hist.signed++;s.hist.max=Math.max(s.hist.max,s.active.length);if(!spPrimary()||s.active.length===1)s.primary=a.b;
  logEvent(`Signed with ${spBrand(a.b).name} for ${a.weeks} weeks${a.ret?" — "+fmt$(a.ret)+"/week":""}`,"good");spLivery();achCheck({type:"sponsor"});return true;}
const spLogoUrl=(()=>{const m={};return b=>m[b.id]||(m[b.id]=ENGINE_VIS.logoCanvas(b,512,192).toDataURL());})();
function spCard(o,mode){const b=spBrand(o.b),s=spS(),prim=mode==="active"&&spPrimary()===o.b,live=mode==="active";
  const bo=o.bon||{},cells=[];if(o.ret)cells.push([fmt$(o.ret),"per week"]);if(bo.win)cells.push([fmt$(bo.win),"per win"]);if(bo.record)cells.push([fmt$(bo.record),"per record"]);if(bo.finish)cells.push([fmt$(bo.finish),"top-3 finish"]);
  const obl=o.obl.map(q=>{const c=q.k!=="rep"&&q.k!=="nodiesel",have=q.have||0,ok=c?have>=q.n:q.k==="rep"?C().rep>=q.n:!spDiesel();
    const cls=live?(ok?"ok":c?"run":"no"):(q.k==="nodiesel"&&spDiesel()?"no":"");
    const tail=live&&c?`${have} / ${q.n}`:q.k==="rep"?`now ${C().rep}`:q.k==="nodiesel"&&spDiesel()?"this build is diesel":"";
    return `<div class="${cls}"><span>${SP_OBL_TXT[q.k](q.n)}</span>${tail?`<i>${tail}</i>`:""}</div>`;}).join("");
  const full=s.active.length>=spSlots(),next=SP_SLOT_REP.find(r=>r>C().rep);
  const btns=live?`${!prim?`<button class="btn info" data-spprim="${o.b}">Move to hood</button>`:""}<button class="btn danger" data-spdrop="${o.b}">Walk away</button>`
    :`<button class="btn ${full?"ghost":"pri"}" data-spsign="${o.id}" ${full?"disabled":""}>${full?(next?`Slots full · rep ${next} opens one`:"Slots full"):"Sign the deal"}</button><button class="btn ghost" data-spno="${o.id}">Decline</button>`;
  return `<div class="card spon${prim?" prim":""}"><div class="sphead"><img src="${spLogoUrl(b)}" alt="${b.name} logo" width="512" height="192"><div><div class="client">${SP_TYPES[b.type]}${live?(prim?" · on the hood":" · on the sides"):""}</div>
    <div class="spname"><b>${b.name}</b><span>${live?`week ${Math.min(o.weeks,C().week-o.w0+1)} of ${o.weeks}`:`${o.weeks} weeks · offer open till wk ${o.exp}`}</span></div></div></div>${!live&&o.why?`<p class="spfine">${o.why}</p>`:""}
    <div class="money spm">${cells.map(c=>`<div><b>${c[0]}</b><span>${c[1]}</span></div>`).join("")}</div><div class="spobl">${obl}</div>
    <p class="spfine">Break it: ${fmt$(o.pen)} and ${o.penRep} rep${live?` · earned ${fmt$(o.earned)} so far`:""}</p><div class="spbtns">${btns}</div></div>`;}
function spRender(){const box=$("spons");if(!box||!career())return;const s=spS(),slots=spSlots(),next=SP_SLOT_REP.find(r=>r>C().rep);
  $("sponCnt").textContent=`${s.active.length} / ${slots}`;
  $("sponHint").textContent=`${slots} slot${slots>1?"s":""}${next?` · another opens at ${next} rep`:""}. Brands notice shops that race and win: race nights, pulls, the salt (all on the Events tab) and delivered orders. The primary sponsor goes on the hood, the rest on the sides.`;
  box.innerHTML=(s.active.length?`<div class="cgroup g-now"><h3>Signed<span>${s.active.length}</span></h3>${s.active.map(a=>spCard(a,"active")).join("")}</div>`:"")
    +`<div class="cgroup g-far"><h3>Offers<span>${s.offers.length}</span></h3>${s.offers.length?s.offers.map(o=>spCard(o,"offer")).join(""):`<p class="hint">No one is calling yet. Put the shop's name out there — enter a race night, a pull or a speed trial. <button class="chip" data-gotab="events">Open Events</button></p>`}</div>`;}
function spSlipHtml(){if(!career())return"";const s=spS();if(!s.active.length)return"";const p=spPrimary(),L=[p].concat(s.active.map(a=>a.b).filter(b=>b!==p));
  return `<div class="spslip"><span>Sponsored by</span>${L.map(id=>{const b=spBrand(id);return `<img src="${spLogoUrl(b)}" alt="${b.name}" width="512" height="192">`;}).join("")}</div>`;}
function spSlipDraw(x,W,H){if(!career())return;const s=spS();if(!s.active.length)return;const p=spPrimary(),L=[p].concat(s.active.map(a=>a.b).filter(b=>b!==p));
  let xx=W-100;for(let i=L.length-1;i>=0;i--){xx-=150;x.drawImage(ENGINE_VIS.logoCanvas(spBrand(L[i]),512,192),xx,H-152,150,56.25);xx-=10;}}
$("spons").addEventListener("click",e=>{if(!career())return;const s=spS();
  const sg=e.target.closest("[data-spsign]");if(sg){if(sg.disabled)return;const o=s.offers.find(x=>x.id==sg.dataset.spsign);if(o&&spSign(o.id)){save();hud();renderShop();toast(`SIGNED · ${spBrand(o.b).name.toUpperCase()}`);buzz(20);}return;}
  const no=e.target.closest("[data-spno]");if(no){s.offers=s.offers.filter(x=>x.id!=no.dataset.spno);save();renderShop();return;}
  const pr=e.target.closest("[data-spprim]");if(pr){s.primary=pr.dataset.spprim;spLivery();save();renderShop();toast(`${spBrand(s.primary).name.toUpperCase()} · ON THE HOOD`);return;}
  const dr=e.target.closest("[data-spdrop]");if(dr){const a=s.active.find(x=>x.b===dr.dataset.spdrop);if(!a)return;if(!confirm(`Walk away from ${spBrand(a.b).name}? It costs ${fmt$(a.pen)} and ${a.penRep} rep.`))return;
    spBreak(a,"you walked away");spLivery();save();hud();renderShop();}});
function renderShop(){
  document.querySelectorAll("#modeBox button").forEach(b=>b.classList.toggle("on",b.dataset.mode===S.mode));
  $("careerBox").style.display=career()?"":"none";$("sandboxBox").style.display=career()?"none":"";renderDev();$("marketBox").style.display=career()?"":"none";$("marketSandbox").style.display=career()?"none":"";
  $("volLbl").textContent=S.vol+"%";$("vol").value=S.vol;renderSaves();
  spLivery();if(!career())return;
  refillContracts();spRender();
  $("gStats").innerHTML=`<div><b class="${C().cash<0?"critc":""}">${fmt$(C().cash)}</b><span>cash</span></div><div><b>${C().rep}</b><span>reputation</span></div><div><b>${C().sold}</b><span>engines sold</span></div><div><b>${fmt$(C().profit)}</b><span>lifetime profit</span></div><div><b>${C().week}</b><span>week</span></div><div><b class="${C().warranty>0?"warnc":""}">${fmt$(C().warranty)}</b><span>warranty paid</span></div>`;
  $("foreclose").style.display=C().cash<FORECLOSE_AT?"":"none";
  const dc=dynoCap();$("sStats").innerHTML=`<div><b class="${C().cash<0?"critc":""}">${fmt$(C().cash)}</b><span>cash</span></div><div><b>${dc.hp.toLocaleString()}</b><span>dyno hp cap</span></div><div><b>${C().loan>0?fmt$(C().loan):Object.keys(C().owned).length}</b><span>${C().loan>0?"bank loan":"upgrades owned"}</span></div>`;
  const cert=C().cert&&C().cert.hash===cfgHash(S.cfg)&&C().cert.ok?C().cert:null;const lastCert=C().cert&&C().cert.hash===cfgHash(S.cfg)?C().cert:null;
  $("mktHint").innerHTML=cert?`<div style="margin-bottom:8px">${engineCard(S.cfg,cert.res,{cls:"inline"})}</div>ON OFFER · unit cost ${fmt$(cert.res.cost)}${coreHint(cert)}.`:lastCert&&lastCert.why?`NO CERT — last pull: ${lastCert.why}.`:"NO CERT ON FILE — run a dyno pull in Test; buyers only look at certified engines.";
  const canBorrow=C().loan+LOAN_STEP<=LOAN_MAX;$("borrow").disabled=!canBorrow;$("borrow").textContent=canBorrow?`Draw ${fmt$(LOAN_STEP)}`:"Line maxed";$("repay").disabled=!(C().loan>0&&C().cash>0);$("repay").textContent=C().loan>0?`Repay ${fmt$(Math.min(C().loan,Math.max(0,C().cash)))}`:"Nothing owed";
  $("bankHint").textContent=`Draw up to ${fmt$(LOAN_MAX)} in ${fmt$(LOAN_STEP)} steps. Each week the bank takes ${(LOAN_RATE*100).toFixed(1)}% interest and repays ${(LOAN_PAY*100).toFixed(0)}% of the balance (at least ${fmt$(LOAN_MIN_PAY)}) from cash${C().loan>0?` — ${fmt$(loanInt())} interest + ${fmt$(loanPay())} repayment = ${fmt$(loanInt()+loanPay())} this week`:` — a full ${fmt$(LOAN_MAX)} would cost ${fmt$(Math.round(LOAN_MAX*LOAN_RATE)+Math.round(LOAN_MAX*LOAN_PAY))} the first week`}. Repay early to save interest. Below ${fmt$(FORECLOSE_AT)} cash the bank takes the shop.`;
  $("ledger").innerHTML=C().log.length?C().log.map(e=>`<div class="${e.k}"><b>wk ${e.w}</b>${e.t}</div>`).join(""):`<div>Nothing yet. Certify an engine and take a contract.</div>`;
  const done=GOALS.filter(g=>C().goals[g.id]).length;$("goalCnt").textContent=`${done} / ${GOALS.length}`;
  $("goals").innerHTML=GOALS.map(g=>`<div class="goal ${C().goals[g.id]?"done":""}"><div><h3>${g.name}</h3><p>${g.desc}</p></div><div class="price">${C().goals[g.id]?"✓ wk "+C().goals[g.id]:fmt$(g.cash)}</div></div>`).join("");
  const inField=C().fleet.filter(f=>C().week-f.week<=10&&C().week-f.week>=1);$("fleetHint").textContent=inField.length?`${inField.reduce((a,f)=>a+f.units,0)} engines in the field under warranty · ${fmt$(C().warranty)} paid out to date · ${C().cleanWeeks} clean week${C().cleanWeeks===1?"":"s"}. Reliability and life hours set the claim rate.`:"Engines you deliver stay under warranty for ten weeks. Low reliability comes back to bite.";
  const live=career()&&!isStdCell(simEnv())?SIM.simulate(S.cfg,stdEnv({testType:"pull"})):quick;const liveFit=k=>fits(k,live,S.cfg);
  if(!C().cat||!catOpen(CATS.find(c=>c.id===C().cat)||CATS[0]))C().cat="prod";
  const cardH=(k,mode)=>{const lf=liveFit(k);const failing=lf.o.filter(q=>!q.ok).length;const fix=(!lf.ok&&failing<=3)?oneChange(k):null;
    const f=cert?fits(k,cert.res,cert.cfg):null;const d=deal(k,f||lf);const unit=d.unit;const cost=f?cert.res.cost:live.cost;const cd=mode==="active"&&f&&d.want?coreDeal(k,d.units,cert):null;const profit=(unit-cost)*d.units+(cd?cd.credit:0);
    const rows=lf.o.map(q=>`<div class="req ${q.ok?"ok":"no"}${q.q==="lap"||q.q==="zero100"?" rq-road":""}"><span class="rl"><b>${q.name}</b><i>${q.target}</i></span><span class="rb"><i style="width:${Math.round(Math.min(1,q.prog/1.0)*100)}%"></i></span><span class="rv">${q.val}</span></div>`).join("");
    const status=lf.ok?(cert&&f&&f.ok?`<div class="cstat ok">● CERT OK · MEETS BRIEF</div>`:`<div class="cstat ok">◐ MEETS BRIEF · CERT REQUIRED</div>`):`<div class="cstat off">◐ OFF BRIEF · ${d.want?`they'd take ${d.units} of ${k.units} at ${Math.round(Math.pow(d.m,0.7)*100)}%`:"too far off — they'd walk"} <small>${missTxt(d)}</small>${fix?`<span>Full price with one change: <b>${fix.label}</b></span>`:""}</div>`;
    const dep=Math.round(k.price*k.units*DEPOSIT/10)*10;const sc=siteCard(k,lf);
    const btn=mode==="active"
      ?`<button class="btn ${f&&f.ok?"ok":""}" data-deliver="${k.id}" ${f&&d.want&&C().shipped<MAX_ACTIVE?"":"disabled"}>${C().shipped>=MAX_ACTIVE?"Two shipped this week":f&&!d.want?"Too far off brief":f?"Ship "+d.units+" units"+(f.ok?"":" off brief"):"Cert required"}</button>`
      :`<button class="btn ${lf.ok?"pri":""}" data-accept="${k.id}" data-from="${mode}" ${C().contracts.length>=MAX_ACTIVE?"disabled":""}>${C().contracts.length>=MAX_ACTIVE?"Board is full":"Take the job · "+fmt$(dep)+" deposit"}</button>`;
    const meta=mode==="active"?`${k.units} units · due wk ${k.expires}${k.deposit?" · "+fmt$(k.deposit)+" deposit in":""}`:`${k.units} units · ${mode==="inbox"||k.repeat?`repeat order · open till wk ${k.expires}`:"offer · this week only"}`;
    const rq=k.req||{},evGo=rq.lap!=null||rq.zero100!=null?`<button class="chip evgo" data-evgo="road" data-ch="${(rq.road&&rq.road.ch)||"coupe"}" data-trk="${rq.lap!=null&&rq.road&&rq.road.trk||""}">Road test it in their car ›</button>`:rq.et!=null?`<button class="chip evgo" data-evgo="drag">Take it to the strip ›</button>`:rq.mph!=null&&rq.lsr?`<button class="chip evgo" data-evgo="salt">Run it on the salt ›</button>`:"";
    return `<div class="card brief ${k.repeat?"repeat":""}"><div class="client">${k.client}${k.repeat?" · repeat client · +10%":""}</div><h3>${k.name}<span>${meta}</span></h3>${sc.top}<div class="reqs">${rows}</div>${evGo}${sc.brk}${status}${cd&&(cd.credit||cd.inN)?`<div class="coreln">${coreTxt(cd)}</div>`:""}
      <div class="money"><div><b>${fmt$(unit)}</b><span>per unit${d.ok&&(f?f.bonus:lf.bonus)>0?" · +"+Math.round((f?f.bonus:lf.bonus)*100)+"%":""}</span></div><div><b>${fmt$(cost)}</b><span>your cost</span></div><div><b class="${profit>=0?"pos":"neg"}">${fmt$(profit)}</b><span>profit</span></div></div>${btn}</div>`;};
  const buyersH=()=>{if(!cert)return `<div class="cgroup g-mkt"><h3>Open market</h3><p class="hint">Certify an engine on the dyno and every buyer group you can reach will bid on it — no deposit, no deadline.</p></div>`;
    const all=buyers(cert);const top=all.slice(0,3);if(!top.some(b=>b.k.crate))top.push(all.find(b=>b.k.crate));const rest=all.filter(b=>!top.includes(b));
    const row=b=>{const d=b.d,k=b.k;const cd=coreDeal(k,d.units,cert),pr=b.profit+cd.credit;const fit=Math.round(Math.min(1,d.ok?1:d.m)*100);const full=C().shipped>=MAX_ACTIVE;
      return `<div class="buyer"><div class="bh"><span><b>${k.name}</b><i>${k.cat}${k.recent?" · supplied recently":""}</i></span><span class="bfit ${d.ok?"ok":fit>=60?"mid":"low"}">${k.crate?"any engine":d.ok?"fits brief":fit+"% fit"}</span></div>
        ${d.ok||k.crate?"":`<div class="bmiss">${missTxt(d)}</div>`}${cd.credit||cd.inN?`<div class="coreln">${coreTxt(cd)}</div>`:""}<div class="bdeal"><span>${d.units} × ${fmt$(d.unit)}</span><b class="${pr>=0?"pos":"neg"}">${fmt$(pr)}</b><button class="btn sm ${pr>0&&!full?"pri":""}" data-sell="${k.seg}" ${full?"disabled":""}>${full?"Week full":"Sell "+d.units}</button></div></div>`;};
    return `<div class="cgroup g-mkt"><h3>Open market<span>who wants this engine</span></h3>${top.map(row).join("")}${rest.length?`<details class="moreb"><summary>All buyer groups (${all.length})</summary>${rest.map(row).join("")}</details>`:""}</div>`;};
  const tier=repTierIdx();
  const catSeg=`<div class="seg" id="catSeg">${CATS.map(c=>{const open=catOpen(c);return `<button data-cat="${c.id}" class="${C().cat===c.id?"on":""}" ${open?"":"disabled"}>${c.name}<small>${open?c.sub:c.needs&&!has(c.needs)?"needs the Outlaw shop":"rep "+c.rep+" · "+(REP_TIERS.filter(r=>r[0]<=c.rep).pop()||REP_TIERS[0])[1]}</small></button>`;}).join("")}</div>`;
  const offers=offersFor(C().cat);
  const inbox=(C().inbox||[]).filter(k=>k.expires>=C().week);
  $("contracts").innerHTML=
    `<div class="cgroup g-now"><h3>On the board<span>${C().contracts.length} / ${MAX_ACTIVE}</span></h3>${C().contracts.length?C().contracts.map(k=>cardH(k,"active")).join(""):`<p class="hint">Nothing accepted. Pick a category below and take a job — two at a time, ten percent down, three weeks to ship.</p>`}</div>`+
    buyersH()+
    (inbox.length?`<div class="cgroup g-one"><h3>Repeat orders<span>${inbox.length}</span></h3>${inbox.map(k=>cardH(k,"inbox")).join("")}</div>`:"")+
    svcBayH()+coreStockH(cert)+
    `<div class="cgroup g-far"><h3>Offers this week<span>${CATS.find(c=>c.id===C().cat).name}</span></h3>${catSeg}${offers.length?offers.map(k=>cardH(k,"offer")).join(""):`<p class="hint">Nothing in this category yet at your reputation.</p>`}</div>`;
  $("overheadHint").textContent=`Weekly overhead: ${fmt$(overhead())}${wages()?` (incl. ${fmt$(wages())} wages)`:""}. Shipped ${C().shipped} of ${MAX_ACTIVE} this week. A job you take and don't ship by its week costs the deposit and ${EXPIRE_REP} rep.`;
  $("staffCnt").textContent=wages()?`${fmt$(wages())}/wk`:"";
  $("staff").innerHTML=STAFF.map(st=>{const on=!!C().staff[st.id];return `<div class="up ${on?"owned":""}"><div><h3>${st.name}</h3><p>${st.desc} <b>${fmt$(st.wage)}/week${on?"":", "+fmt$(st.wage*2)+" to hire"}</b></p></div>${on?`<button class="btn sm danger" data-fire="${st.id}">Release</button>`:`<button class="btn sm ${C().cash>=st.wage*2?"pri":""}" data-hire="${st.id}">Hire</button>`}</div>`;}).join("");
  const act=C().rndActive;$("rndCnt").textContent=`${Object.keys(C().rnd).length} / ${RND.length}`;
  $("rndHint").textContent=act?`In progress: ${RND.find(r=>r.id===act.id).name} — week ${Math.min(rndNeed(RND.find(r=>r.id===act.id)),Math.floor(act.done)+1)} of ${rndNeed(RND.find(r=>r.id===act.id))}.`:"Fund one project at a time. It runs while you advance weeks.";
  $("rnd").innerHTML=RND.map(r=>{const done=!!C().rnd[r.id];const running=act&&act.id===r.id;const pct=running?Math.min(100,Math.round(100*act.done/rndNeed(r))):0;
    return `<div class="up ${done?"owned":""}"><div><h3>${r.name}</h3><p>${r.desc} <b>${rndNeed(r)} wk${rndNeed(r)<r.weeks?` (−25%, was ${r.weeks})`:""}</b></p>${running?`<div class="bar" style="margin-top:6px"><i style="width:${pct}%"></i></div>`:""}</div>${done?`<div class="price">Done</div>`:running?`<div class="price" style="color:var(--warn)">${pct}%</div>`:`<button class="btn sm ${C().cash>=r.cost&&!act?"pri":""}" data-rnd="${r.id}" ${act?"disabled":""}>${fmt$(r.cost)}</button>`}</div>`;}).join("");
  $("prestige").innerHTML=PRESTIGE.map(pp=>{const own=!!C().prestige[pp.id];return `<div class="up ${own?"owned":""}"><div><h3>${pp.name}</h3><p>${pp.desc}</p></div>${own?`<div class="price">Owned</div>`:`<button class="btn sm ${C().cash>=pp.price?"pri":""}" data-prestige="${pp.id}">${fmt$(pp.price)}</button>`}</div>`;}).join("");
  $("upgrades").innerHTML=UPGRADES.map(u=>{const own=!!C().owned[u.id];const gated=u.needs&&!C().owned[u.needs];
    return `<div class="up ${own?"owned":""}"><div><h3>${u.name}</h3><p>${u.desc}${gated?` <b>Needs ${UPGRADES.find(x=>x.id===u.needs).name}.</b>`:""}</p></div>${own?`<div class="price">Owned</div>`:`<button class="btn sm ${C().cash>=u.price&&!gated?"pri":""}" data-buy="${u.id}" ${gated?"disabled":""}>${fmt$(u.price)}</button>`}</div>`;}).join("");
}
$("contracts").addEventListener("click",e=>{
  const cb=e.target.closest("[data-cat]");if(cb){if(cb.disabled)return;C().cat=cb.dataset.cat;save();renderShop();return;}
  const sp=e.target.closest("[data-siteprev]");if(sp){const k=C().contracts.concat(C().inbox||[],offersFor(C().cat)).find(x=>x.id==sp.dataset.siteprev);if(k&&k.site)previewSite(k.site);return;}
  const ab=e.target.closest("[data-accept]");if(ab){if(ab.disabled)return;const from=ab.dataset.from;const list=from==="inbox"?(C().inbox||[]):offersFor(C().cat);const k=list.find(x=>x.id==ab.dataset.accept);if(!k)return;if(acceptContract(k,from)){save();hud();renderShop();toast(`${k.name.toUpperCase()} · ${fmt$(k.deposit)} DEPOSIT IN`);buzz(20);}return;}
  const b=e.target.closest("[data-deliver]");if(!b||b.disabled)return;if(C().shipped>=MAX_ACTIVE){toast("Two shipped this week — close the week first");return;}const k=C().contracts.find(x=>x.id==b.dataset.deliver);const cert=C().cert;if(!k||!cert||!cert.ok||cert.hash!==cfgHash(S.cfg))return;const f=fits(k,cert.res,cert.cfg);const d=deal(k,f);if(!d.want)return;const units=d.units;
  const unit=d.unit;const cd=coreDeal(k,units,cert);const profit=Math.round((unit-cert.res.cost)*units)+cd.credit;const cr=applyCores(cd);C().cash+=profit-(k.deposit||0);C().profit+=profit;C().sold+=units;C().shipped=(C().shipped||0)+1;const repGain=repFor(SEGMENTS.find(s=>s.id===k.seg).tier,units,d,f.bonus,k.repeat);C().rep+=repGain;
  const weak=(f.res.tests.slice().sort((a,b)=>b.util-a.util)[0]||{}).name||"wear";
  C().fleet.push({week:C().week,client:k.client,name:k.name,seg:k.seg,req:k.req,units,hash:cfgHash(S.cfg),engine:engineName(),rel:k.site&&f.res.fails.length?Math.min(f.res.rel,55):f.res.rel,life:f.res.lifeHours,unitCost:cert.res.cost,unitPrice:unit,basePrice:k.price,weak,claims:0,repeated:!!k.repeat||!f.ok,...(k.site?{site:k.site}:{})});
  if(C().fleet.length>40)C().fleet.splice(0,C().fleet.length-40);if(k.repeat)C().repeats++;
  logEvent(`Delivered ${units} × ${engineName()} (${k.name}${f.ok?"":", off brief"}) to ${k.client} — ${fmt$(profit)} profit, +${repGain} rep${k.repeat?" (repeat order)":""}${coreLog(cd,cr)}`,f.ok?"good":"");
  if(tourStep>=0)tourEnd();
  C().contracts=C().contracts.filter(x=>x.id!==k.id);spEvent("sale");achCheck({type:"sale"});save();hud();renderShop();recompute();toast(`PAID ${fmt$(unit*units)} · REP +${repGain}${C().shipped>=MAX_ACTIVE?" · WEEK FULL":""}`);buzz(30);if(checkGoals()){save();hud();renderShop();}});
$("contracts").addEventListener("click",e=>{const b=e.target.closest("[data-sell]");if(!b||b.disabled)return;if(C().shipped>=MAX_ACTIVE){toast("Two shipped this week — close the week first");return;}
  const cert=C().cert;if(!cert||!cert.ok||cert.hash!==cfgHash(S.cfg))return;const o=buyers(cert).find(x=>x.k.seg===b.dataset.sell);if(!o)return;const k=o.k,d=o.d,units=d.units,unit=d.unit;
  const cd=coreDeal(k,units,cert);const profit=Math.round((unit-cert.res.cost)*units)+cd.credit;const cr=applyCores(cd);C().cash+=profit;C().profit+=profit;C().sold+=units;C().shipped=(C().shipped||0)+1;const repGain=repFor(k.tier,units,d,o.f.bonus,false);C().rep+=repGain;
  (C().mkt=C().mkt||{})[k.seg]=C().week;const weak=(cert.res.tests.slice().sort((a,b)=>b.util-a.util)[0]||{}).name||"wear";
  C().fleet.push({week:C().week,client:k.name,name:k.name,seg:k.seg,req:k.req,units,hash:cert.hash,engine:engineName(),rel:cert.res.rel,life:cert.res.lifeHours,unitCost:cert.res.cost,unitPrice:unit,weak,claims:0,repeated:true});
  if(C().fleet.length>40)C().fleet.splice(0,C().fleet.length-40);
  logEvent(`Sold ${units} × ${engineName()} on the open market to ${k.name.toLowerCase()} buyers — ${fmt$(profit)} profit, +${repGain} rep${coreLog(cd,cr)}`,profit>=0?"good":"");
  if(tourStep>=0)tourEnd();spEvent("sale");achCheck({type:"sale"});save();hud();renderShop();recompute();toast(`SOLD ${units} · ${fmt$(unit*units)} · REP +${repGain}${C().shipped>=MAX_ACTIVE?" · WEEK FULL":""}`);buzz(30);if(checkGoals()){save();hud();renderShop();}});
$("achBtn").addEventListener("click",()=>{showTab("analysis");setTimeout(()=>{const e=$("achSec");if(e)e.scrollIntoView({block:"start"});},60);});
$("nextWeek").addEventListener("click",()=>{advanceWeek();save();hud();renderShop();toast(`WEEK ${C().week} · OVERHEAD ${fmt$(overhead())}${C().loan>0?" · BANK "+fmt$(loanInt()+loanPay()):""}`);});
$("staff").addEventListener("click",e=>{const h=e.target.closest("[data-hire]"),f=e.target.closest("[data-fire]");
  if(h){const st=STAFF.find(x=>x.id===h.dataset.hire);if(C().cash<st.wage*2){toast(`Need ${fmt$(st.wage*2-C().cash)} more`);return;}C().cash-=st.wage*2;C().staff[st.id]=C().week;syncShop();logEvent(`Hired a ${st.name.toLowerCase()} at ${fmt$(st.wage)}/week`,"");save();hud();renderShop();renderBuild();recompute();toast(`${st.name.toUpperCase()} · ON PAYROLL`);buzz(20);}
  if(f){const st=STAFF.find(x=>x.id===f.dataset.fire);if(!confirm(`Let the ${st.name.toLowerCase()} go?`))return;delete C().staff[st.id];syncShop();
    if(C().cert&&(st.id==="tuner"||st.id==="machinist")){C().cert=null;logEvent(`Cert void — the ${st.name.toLowerCase()} signed it off; pull it again`,"bad");setTimeout(()=>toast("CERT VOID · re-run the dyno"),50);}logEvent(`Let the ${st.name.toLowerCase()} go`,"");save();hud();renderShop();renderBuild();recompute();}});
$("rnd").addEventListener("click",e=>{const b=e.target.closest("[data-rnd]");if(!b||b.disabled)return;const r=RND.find(x=>x.id===b.dataset.rnd);if(C().rndActive||C().rnd[r.id])return;if(C().cash<r.cost){toast(`Need ${fmt$(r.cost-C().cash)} more`);return;}
  C().cash-=r.cost;C().rndActive={id:r.id,done:0};logEvent(`Funded R&D: ${r.name} (${r.weeks} weeks)`,"");save();hud();renderShop();toast(`R&D STARTED · ${r.weeks} WEEKS`);buzz(20);});
$("prestige").addEventListener("click",e=>{const b=e.target.closest("[data-prestige]");if(!b)return;const pp=PRESTIGE.find(x=>x.id===b.dataset.prestige);if(C().cash<pp.price){toast(`Need ${fmt$(pp.price-C().cash)} more`);return;}
  C().cash-=pp.price;C().prestige[pp.id]=C().week;C().rep+=pp.rep*2;logEvent(`Bought the ${pp.name.toLowerCase()}`,"good");save();hud();renderShop();ENGINE_VIS.buildGarage(garageOwned());toast(`${pp.name.toUpperCase()} · INSTALLED`);buzz(30);});
$("borrow").addEventListener("click",()=>{if(C().loan+LOAN_STEP>LOAN_MAX)return;C().loan+=LOAN_STEP;C().cash+=LOAN_STEP;logEvent(`Borrowed ${fmt$(LOAN_STEP)} from the bank`,"");save();hud();renderShop();toast(`${fmt$(LOAN_STEP)} in the account. The bank takes ${fmt$(loanInt()+loanPay())} a week now.`);});
$("repay").addEventListener("click",()=>{const amt=Math.min(C().loan,Math.max(0,C().cash));if(amt<=0)return;C().loan-=amt;C().cash-=amt;logEvent(`Repaid ${fmt$(amt)} to the bank`,"good");achCheck({type:"loan"});save();hud();renderShop();toast(C().loan>0?`${fmt$(C().loan)} still owed`:"Loan cleared");});
function benchUnlock(){if(career()&&presetLocked(S.cfg)){S.cfg=Object.assign({},SIM.DEFAULT_CFG);S.profileId=null;S.name=null;}}   // a fresh career can't keep a locked build on the bench
$("foreclose").addEventListener("click",e=>{if(!e.target.closest("[data-restart]"))return;if(testing){toast("Let the run finish first");return;}if(!confirm("Hand the keys to the bank and start over? Blueprints are kept."))return;S.career=freshCareer();benchUnlock();save();boot();toast("New shop, same dream. $20,000.");});
$("upgrades").addEventListener("click",e=>{const b=e.target.closest("[data-buy]");if(!b||b.disabled)return;const u=UPGRADES.find(x=>x.id===b.dataset.buy);if(C().cash<u.price){toast(`Need ${fmt$(u.price-C().cash)} more`);return;}
  C().cash-=u.price;C().owned[u.id]=true;C().rep+=5;save();hud();renderShop();renderBuild();renderPresets();recompute();ENGINE_VIS.buildGarage(garageOwned());toast(`${u.name.toUpperCase()} · INSTALLED`);buzz(30);});
$("resetGame").addEventListener("click",()=>{if(testing){toast("Let the run finish first");return;}if(confirm("Wipe the career save? Cash, upgrades and contracts reset. Blueprints are kept."))
  {S.career=freshCareer();benchUnlock();save();boot();toast("Fresh start. $20,000 and a dream.");}});
$("slots").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
  if(b.dataset.save){const i=+b.dataset.save;if(readSlot(i)&&!confirm(`Overwrite slot ${i}?`))return;toast(writeSlot(i)?`SLOT ${i} SAVED`:"Couldn't save — storage blocked on this device");renderSaves();}
  else if(b.dataset.load){const i=+b.dataset.load;const o=readSlot(i);if(!o)return;if(!confirm(`Load slot ${i}? Your current game is replaced (it stays in autosave until you make a change).`))return;applyLoaded(o,`Loaded slot ${i}`);}
  else if(b.dataset.clear){const i=+b.dataset.clear;if(!confirm(`Clear slot ${i}?`))return;clearSlot(i);renderSaves();toast(`SLOT ${i} CLEARED`);}});
$("exportSave").addEventListener("click",()=>{const code=encodeSave(snapshot());$("sheetTitle").textContent="Save code";
  $("sheetBody").innerHTML=`<p class="hint" style="margin-top:0">Copy this and paste it into <b>Import save code</b> on another device. It holds your career, blueprints and settings.</p><textarea class="code" id="codeOut" readonly></textarea><div class="row" style="margin-top:10px"><button class="btn pri" id="copyCode" style="flex:1">Copy code</button></div>`;
  $("codeOut").value=code;$("sheet").classList.add("on");$("scrim").classList.add("on");
  $("copyCode").addEventListener("click",async()=>{const ta=$("codeOut");try{await navigator.clipboard.writeText(ta.value);toast("Copied");}catch(e){ta.focus();ta.select();try{document.execCommand("copy");toast("Copied");}catch(_){toast("Select the text and copy it manually");}}});});
$("importSave").addEventListener("click",()=>{$("sheetTitle").textContent="Import save code";
  $("sheetBody").innerHTML=`<p class="hint" style="margin-top:0">Paste a PEW2 save code. Importing replaces your current game — save it to a slot first if you want to keep it.</p><textarea class="code" id="codeIn" placeholder="PEW2:…"></textarea><div class="row" style="margin-top:10px"><button class="btn pri" id="doImport" style="flex:1">Import</button></div>`;
  $("sheet").classList.add("on");$("scrim").classList.add("on");
  $("doImport").addEventListener("click",()=>{let o;try{o=decodeSave($("codeIn").value);}catch(e){toast("That code didn't decode — check you copied all of it");return;}closeSheet();applyLoaded(o,"Save imported");});});
$("vol").addEventListener("input",e=>{S.vol=+e.target.value;$("volLbl").textContent=S.vol+"%";ENGINE_SOUND.setVolume(S.vol/100);});
$("vol").addEventListener("change",save);
function garageOwned(){const o=Object.assign({},C().owned);if(!career())o.sandbox=true;else{for(const k in C().prestige)o["prestige_"+k]=true;o.week=C().week;o.deliveries=C().fleet.length;o.pullCups=(C().pullTitles||[]).length;}return o;}
