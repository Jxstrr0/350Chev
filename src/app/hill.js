/* ===================== CLOUDSPLITTER PEAK: the hillclimb ===================== */
/* the run itself is in app/hill-run.js, which goes into app-late.js (since 1.76.141.0) */
/* 19.99 km, 156 turns, 2,862 m to 4,302 m. The engine is run at five altitudes on the way up (SIM.hillPrep); the car is the
   road test's chassis on the class's tyres and aero. Auto drives the corner calls; You drive holds PUSH or LIFT into each corner. */
let HC=null;
const HILL_PURSE=[4000,2000,1200,700,400],HILL_PAY={1:1,2:1.8,3:3,4:5},HILL_REP=[4,3,2,1],HILL_SB={};
const HILL_CAMS=[["auto","Auto","director"],["chase","Chase","behind the car"],["heli","Helicopter","from above"],["onboard","Onboard","driver's eye"]];
const HILL_NAMES=["R. Okafor","D. Lindqvist","M. Tanaka","J. Whitehorse","C. Duval","T. Brennan","A. Kovač","S. Moreau","L. Haugen","P. Rinaldi","K. Mbeki","E. Castellanos","N. Fairweather","B. Ostrowski","H. Nakamura","F. Leclair","G. Running Elk","V. Sørensen"];
const HILL_PAINT=[0x1d4787,0xb7261d,0xe8e6df,0x2c6b3a,0xd9a52b,0x16181b,0x5b2a86,0xd85f14,0x2a6db5];
const fmtHill=t=>t==null||!isFinite(t)?"DNF":`${Math.floor(t/60)}:${(t%60).toFixed(2).padStart(5,"0")}`;
function hillEnvFix(){const e=S.env,H=SIM.HILL_CLASSES;if(!H[e.hillCls])e.hillCls="open";const c=H[e.hillCls];
  if(!SIM.CHASSIS[e.hillCh])e.hillCh="coupe";if(!c.tyres.includes(e.hillTyre))e.hillTyre=c.tyres[c.tyres.length-1];if(!c.aero.includes(e.hillAero))e.hillAero=c.aero[c.aero.length-1];
  if(!(+e.hillFinal>=0.6&&+e.hillFinal<=1.6))e.hillFinal=1;if(![1,2,4,8].includes(+e.hillSpd))e.hillSpd=4;if(!HILL_CAMS.some(q=>q[0]===e.hillCam))e.hillCam="auto";
  if(e.hillDrive!=="you")e.hillDrive="auto";suFix(e);return e.hillCls;}
function hillOpt(){const e=S.env;hillEnvFix();return{cls:e.hillCls,ch:e.hillCh,tyre:e.hillTyre,aero:e.hillAero,finalK:+e.hillFinal,setup:suOpt(),wet:wxWet("hill")};}
/* race day: one running per class per week in career (the same calls all week, the same field); a fresh mountain every run in the sandbox */
function hillSeed(k){const ix=Object.keys(SIM.HILL_CLASSES).indexOf(k)+1;if(!career())return HILL_SB[ix]||(HILL_SB[ix]=Math.floor(Math.random()*1e9)+1);if(!C().hillSeed)C().hillSeed=Math.floor(Math.random()*1e9)+1;return(C().hillSeed^(C().week*7919)^(ix*104729))>>>0;}
/* career: one climb a week, in one class. The class run this week, or null */
function hillRanWk(k){return !!wkCls("hillWk");}
/* entry: about 15% of the class's winning purse */
function hillFee(k){return evFee(HILL_PURSE[0],HILL_PAY,(SIM.HILL_CLASSES[k]||SIM.HILL_CLASSES.open).tier);}
/* the engine at altitude, cached by build: five dyno runs up the mountain */
const hillPrepCache=new Map();
function hillPrepFor(cfg){const wx=wxHillWx(),k=cfgHash(cfg)+(wx?"|"+wx.dT+"|"+wx.h:"");let p=hillPrepCache.get(k);if(!p){if(hillPrepCache.size>6)hillPrepCache.clear();p=SIM.hillPrep(cfg,stdEnv(),undefined,wx);hillPrepCache.set(k,p);}return p;}   // the day's air (app/weather.js)
/* the rest of the class: 7–9 cars, each a made-up engine and driver run up the same mountain on the same calls */
/* each car is a whole run up the mountain, so the field is driven a car at a time between frames (hillField returns null
   until it is done and re-renders the panel); a run that starts before then drives the rest at once */
const hillFieldCache=new Map(),hillFieldJobs=new Map();
function hillField(k,seed,sync){const key=k+"|"+seed;if(hillFieldCache.has(key))return hillFieldCache.get(key);
  let J=hillFieldJobs.get(key);if(!J){J=hillFieldJob(k,seed);hillFieldJobs.set(key,J);}
  if(sync){while(!J.done)J.next();}else if(!J.timer){const tick=()=>{J.timer=null;if(J.done)return;J.next();if(J.done){if(S.env.testType==="hill"&&!testing&&curTab==="events")renderEnv();evPickRender();}else J.timer=setTimeout(tick,30);};J.timer=setTimeout(tick,60);}
  return J.done?hillFieldCache.get(key):null;}
function hillFieldJob(k,seed){const key=k+"|"+seed;
  const C0=SIM.HILL_CLASSES[k],F=C0.field,r=pullRand((seed^0x51CC)>>>0),calls=SIM.hillCalls(seed),names=HILL_NAMES.slice(),n=7+Math.floor(r()*3),out=[],chs=Object.keys(SIM.CHASSIS).filter(c=>c!=="pickup");
  let i=0;const J={done:false,timer:null,next:()=>{if(J.done)return;if(i>=n){J.done=true;if(hillFieldCache.size>8)hillFieldCache.clear();hillFieldCache.set(key,out);hillFieldJobs.delete(key);return;}{const nm=names.splice(Math.floor(r()*names.length),1)[0],gs=Math.sqrt(-2*Math.log(Math.max(1e-6,r())))*Math.cos(2*Math.PI*r());
    const hp=Math.round(Math.max(150,F.hp+gs*F.sd)),turbo=r()<F.turbo,skill=+Math.min(1,Math.max(0.3,F.skill+(r()-0.5)*0.4)).toFixed(2),ch=chs[Math.floor(r()*chs.length)];
    const sd=(seed^(i+1)*2654435761)>>>0,prep=SIM.hillAiPrep(hp,turbo,sd);let q;
    try{q=SIM.hillPass(prep,{cls:k,ch,tyre:C0.tyres[C0.tyres.length-1],aero:C0.aero[C0.aero.length-1],seed:sd,calls,plan:SIM.hillPlan(calls,skill,sd),dt:0.08});}catch(e){q={time:null,dnf:{kind:"mech"},splits:[]};}
    out.push({n:nm,hp,turbo,ch,skill,t:q.time,dnf:q.dnf?q.dnf.kind:null,splits:q.splits,offs:(q.offs||[]).length,paint:HILL_PAINT[(i+Math.floor(r()*9))%HILL_PAINT.length]});}
    i++;if(i>=n)J.next();}};
  return J;}
const hillDnfWord=k=>({edge:"OVER THE EDGE",boil:"BOILED OVER",stall:"COULDN'T CLIMB",time:"FLAGGED OFF"})[k]||"DNF";
const hillCmp=(a,b)=>(a.t==null?1:0)-(b.t==null?1:0)||(a.t!=null?a.t-b.t:0)||(a.me?-1:b.me?1:0);
function hillHint(){const c=SIM.HILL_CLASSES;return career()?`<b>Cloudsplitter Peak</b> · ${fmt$(hillFee("open"))}–${fmt$(hillFee("unl"))} entry, one run a week in one class. Needs a certified engine. ${c.open.n} is open to anyone; ${c.ta.n} at ${c.ta.rep} rep, ${c.ppo.n} at ${c.ppo.rep}, ${c.unl.n} at ${c.unl.rep}. Purse by placing, up to ${fmt$(HILL_PURSE[0]*HILL_PAY[4])} in ${c.unl.n}. Thin air costs an atmospheric engine about a third of its power; a turbo holds on.`
  :`<b>Cloudsplitter Peak</b> · 19.99 km, 156 turns, 2,862 m to 4,302 m. Auto reads the corner calls for you; in <b>You drive</b>, hold <b>PUSH</b> into grippy corners and <b>LIFT</b> into dusty ones. Too fast is a moment, a trip through the gravel, or — where there's a drop and no rail — the end of the run. <b>Space</b> pushes.`;}
/* the mountain in profile: altitude against distance, the sections, the treeline, where you are */
function hillProfileSvg(cls,mark){const T=SIM.hillCourse(),W=320,H=64,a0=2800,a1=4360,X=s=>(s/T.len*W).toFixed(1),Y=z=>(H-4-(z-a0)/(a1-a0)*(H-10)).toFixed(1);
  let p=`M0,${H} `;for(let i=0;i<T.N;i+=40)p+=`L${X(i*T.ds)},${Y(T.z[i])} `;p+=`L${W},${Y(T.z[T.N-1])} L${W},${H} Z`;
  const ty=Y(SIM.HILL_TREE),secs=T.sections.slice(0,-1).map(s=>`<line x1="${X(s.s1)}" x2="${X(s.s1)}" y1="${Y(s.alt1)}" y2="${H}" stroke="var(--dim)" stroke-width="1" stroke-dasharray="2 2"/>`).join("");
  const mk=mark!=null?`<circle cx="${X(mark)}" cy="${Y(SIM.hillZ(T,mark))}" r="3" fill="var(--orange)"/>`:"";
  return `<svg class="${cls||"hlprof"}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Elevation along the course"><path d="${p}" fill="rgba(140,130,118,.35)" stroke="rgba(170,160,145,.9)" stroke-width="1.2"/>`+
    `<line x1="0" x2="${W}" y1="${ty}" y2="${ty}" stroke="rgba(92,191,138,.55)" stroke-width="1" stroke-dasharray="4 3"/>${secs}${mk}</svg>`;}
function hillAltLine(p){const pk=p.pts,top=pk[pk.length-1],dn=Math.round(100*(1-top.hp/p.ref.hp)),d0=Math.round(100*(1-pk[0].hp/p.ref.hp));
  let s=`At the shop (500 m) <b>${Math.round(p.ref.hp)} hp</b>; at the line <b>${Math.round(pk[0].hp)}</b> (−${d0}%), on the summit <b>${Math.round(top.hp)}</b> (−${dn}%).`;
  if(p.kind==="turbo"){const lim=pk.find(q=>q.lim);s+=lim?` The turbo holds the shop's manifold pressure to about ${lim.alt.toLocaleString("en-CA")} m, then the compressor runs out of ${lim.lim==="flow"?"flow":"pressure ratio"} (${bv(top.boost)} ${pU()} on top).`:` The turbo holds the shop's manifold pressure all the way up (${bv(top.boost)} ${pU()} on top).`;}
  else if(p.kind!=="na")s+=" The blower keeps its pressure ratio, so it makes the same ratio of thinner air.";else s+=" Atmospheric: the power follows the air.";
  s+=p.carb?` Carburettor: it meters by air speed, so it runs rich as the air thins (λ ${(+p.ref.lambda).toFixed(2)} → ${(+top.lambda).toFixed(2)} on top).`:" Injection trims the mixture for the altitude.";
  return s;}
function hillEnvHtml(sl){const e=S.env,k=hillEnvFix(),C0=SIM.HILL_CLASSES[k],lk=clsLocked(SIM.HILL_CLASSES,k),seed=hillSeed(k),field=wxField(hillWithRv(k,hillField(k,seed)),k),R=recBucket("hill"),pb=R[k],lead=field?field.slice().sort(hillCmp)[0]:null,q=quick&&quick.rpms?quick:null;
  const fin=field?field.filter(f=>f.t!=null).length:0;
  let h=`<div class="saltcls"><div><span>The mountain</span><b>19.99 km</b><small>156 turns · 2,862 → 4,302 m</small></div><div><span>To beat</span><b>${lead&&lead.t!=null?fmtHill(lead.t):"…"}</b><small>${field?`${lead?esc(lead.n):""} · ${fin} of ${field.length} finished`:"the field is warming up"}</small></div><div><span>Your best</span><b>${pb?fmtHill(pb.t):"—"}</b><small>${pb?"in "+C0.n:"no run yet"}</small></div></div>${hillProfileSvg()}`;
  h+=`<div class="lbl"><span>Class</span></div><div class="seg wide">${Object.entries(SIM.HILL_CLASSES).map(([id,c])=>{const l=clsLocked(SIM.HILL_CLASSES,id);return `<button data-hk="hillCls" data-hv="${id}" class="${k===id?"on":""}${l?" lock":""}">${c.n}<small>${l?l+" rep":c.d}</small></button>`;}).join("")}</div>`;
  h+=driverToggle(id=>`data-hk="hillDrive" data-hv="${id}"`,e.hillDrive,"push or lift into each corner","reads the calls · watch the run");
  h+=`<div class="lbl"><span>Car</span></div><div class="seg wide">${Object.entries(SIM.CHASSIS).map(([id,c])=>`<button data-hk="hillCh" data-hv="${id}" class="${e.hillCh===id?"on":""}">${c.n}<small>${c.d.split(" · ").slice(0,2).reverse().join(" · ")}</small></button>`).join("")}</div>`;
  h+=`<div class="lbl"><span>Tyres</span></div><div class="seg">${C0.tyres.map(id=>{const t=SIM.HILL_TYRES[id];return `<button data-hk="hillTyre" data-hv="${id}" class="${e.hillTyre===id?"on":""}">${t.n}<small>μ ${t.mu}</small></button>`;}).join("")}</div>`;
  h+=`<div class="lbl"><span>Aero</span></div><div class="seg">${C0.aero.map(id=>{const a=SIM.HILL_AERO[id];return `<button data-hk="hillAero" data-hv="${id}" class="${e.hillAero===id?"on":""}">${a.n}<small>${a.d}</small></button>`;}).join("")}</div>`;
  if(q){try{const p=hillPrepFor(S.cfg),car=SIM.hillCar(p,hillOpt());h+=`<p class="hint"><b>Up the mountain</b> · ${hillAltLine(p)} ${SIM.CHASSIS[e.hillCh].n} at ${Math.round(car.m).toLocaleString("en-CA")} kg${C0.massK<1?" (stripped for the class)":""}, final drive ${car.fd.toFixed(2)}:1 — geared for about 200 km/h.</p>`;}catch(err){}}
  h+=`<p class="hint">${C0.n}: ${C0.d}. The air at the summit is 40% thinner than at sea level: less power for an atmospheric engine, less drag, less downforce, and less air through the radiator.${lk?` <b>Opens at ${lk} rep</b> — earn it by shipping orders and placing in events.`:""}${hillRanWk(k)?` <b>Run this week — the next running is week ${C().week+1}.</b>`:""}</p>`;
  h+=`<div class="envgrid">${sl("hillFinal","Final drive",0.6,1.6,0.01," × fitted",(+e.hillFinal).toFixed(2))}</div>`+suEnvHtml(sl,true);
  h+=`<div class="lbl"><span>Camera</span></div><div class="seg n4">${HILL_CAMS.map(([id,n,d])=>`<button data-hk="hillCam" data-hv="${id}" class="${e.hillCam===id?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>`;
  h+=`<div class="lbl"><span>Playback</span></div><div class="seg n4">${[1,2,4,8].map(v=>`<button data-hk="hillSpd" data-hv="${v}" class="${+e.hillSpd===v?"on":""}">${v}×<small>${v===1?"real time":v===2?"double":v===4?"quick":"quicker"}</small></button>`).join("")}</div>`;
  return h;}
$("envBox").addEventListener("click",e=>{const b=e.target.closest("[data-hk]");if(!b)return;const k=b.dataset.hk,v=b.dataset.hv;
  if(k==="hillCls"){const l=clsLocked(SIM.HILL_CLASSES,v);if(l){toast(`${SIM.HILL_CLASSES[v].n} opens at ${l} rep`);return;}if(v!==S.env.hillCls){S.env.hillTyre=null;S.env.hillAero=null;}}
  S.env[k]=k==="hillSpd"?+v:v;hillEnvFix();if(HC&&!HC.finished){if(k==="hillCam")HC.cam=v;if(k==="hillSpd")HC.speed=+v;}renderEnv();save();buzz(6);});
function hillVerdict(res){const r=res.hill;
  if(r.dnf)return `<div class="verdict fail"><div><div class="big">${hillDnfWord(r.dnf.kind)} · DNF</div><p>${r.dnf.kind==="edge"?`Too fast into ${esc(r.dnf.name)} with a drop on the outside and no guardrail`:r.dnf.kind==="boil"?`The water went past boiling in ${esc(r.dnf.name)} — thin air through the radiator`:r.dnf.kind==="stall"?`Not enough torque to pull the car up the grade in ${esc(r.dnf.name)} — a shorter final drive, or more engine`:`Still on the mountain at half an hour, in ${esc(r.dnf.name)}`} · ${(r.dnf.s/1000).toFixed(2)} km up, ${fmtHill(r.dnf.t)} in${career()?" — reputation took a hit":""}.</p></div></div>`;
  const cls=r.place===1?"pass":r.place<=HILL_PURSE.length?"marg":"fail",hp=r.hp,top=hp[hp.length-1];
  return `<div class="verdict ${cls}"><div style="flex:1"><div class="big">${fmtHill(r.time)} · ${ordN(r.place)}</div><p>${esc(r.clsName)} · ${ordN(r.place)} of ${r.of} · ${esc(r.chName.toLowerCase().replace("gt","GT").replace("awd","AWD"))}, ${r.tyreName.toLowerCase()} tyres${r.aero!=="none"?", "+r.aeroName.toLowerCase():""}${r.auto?" · auto driver":r.took!=null?` · you took over at ${(r.took/1000).toFixed(1)} km`:""}${career()&&r.purse?` · purse ${fmt$(r.purse)}`:""}${r.pb&&r.pb.was?` · class record (was ${fmtHill(r.pb.was)})`:""}</p>
    <div class="vstats"><div><b>${r.avgKmh}</b><span>avg km/h</span></div><div><b>${Math.round(r.vmax)}</b><span>top km/h</span></div><div><b>${r.offs.length}</b><span>off${r.offs.length===1?"":"s"} · ${r.moments} moment${r.moments===1?"":"s"}</span></div><div><b>${top.hp}</b><span>hp on top · ${Math.round(100*top.hp/r.refHp)}%</span></div><div><b>${r.coolPeak}</b><span>water °C peak</span></div><div><b>${r.m.toLocaleString("en-CA")}</b><span>kg</span></div></div></div></div>`;}
function hillSheet(res){const r=res.hill,b=recBucket("hill")[r.cls],L=r.lead;let pt=0,lt=0;
  const rows=r.secNames.map((n,i)=>{const t=r.splits[i],sec=t!=null?t-pt:null;const lsec=L&&L.splits&&L.splits[i]!=null?L.splits[i]-lt:null;if(t!=null)pt=t;if(L&&L.splits&&L.splits[i]!=null)lt=L.splits[i];
    const d=sec!=null&&lsec!=null?sec-lsec:null;return `<div><b>${i+1}</b><span class="nm">${esc(n)}</span><span>${sec!=null?sec.toFixed(2):"—"}</span><span class="et">${t!=null?fmtHill(t):"—"}</span><span style="color:${d==null?"":d<=0?"var(--good)":"var(--crit)"}">${d!=null?(d<=0?"−":"+")+Math.abs(d).toFixed(2):""}</span></div>`;}).join("");
  const offs=r.offs.map(o=>`${o.kind==="rail"?"guardrail":o.kind==="bank"?"into the bank":"gravel"} at ${esc(o.name||r.secNames[o.sec])} (+${o.loss} s)`).join(" · ");
  const hp=r.hp.map(p=>`${p.alt.toLocaleString("en-CA")} m <b>${p.hp}</b>${p.boost?" @ "+bv(p.boost)+" "+pU():""}`).join(" · ");
  const wi=wearInfo(res),wear=wi?`<div><b>Wear</b>${wi.passes} of ${wi.budget} pass${wi.budget===1?"":"es"} · <span style="color:${wi.w>=1?"var(--crit)":wi.w>0.6?"var(--warn)":"var(--good)"}">${Math.round(wi.w*100)}%</span></div>`:"";
  return `<div class="sec"><h2>Hillclimb sheet</h2><div class="rtop hlsplit"><span>Splits${L?" · against "+esc(L.n)+", the class's best":""}</span>${rows}</div><div class="log" style="margin-top:8px">
    <div><b>Run</b>${r.dnf?"DNF":fmtHill(r.time)} · ${(r.len/1000).toFixed(2)} km · ${r.avgKmh!=null?r.avgKmh+" km/h average · ":""}${Math.round(r.vmax)} km/h top${b&&!r.dnf?` · class record ${fmtHill(b.t)}`:""}</div>
    <div><b>Power</b>${hp} hp — ${r.refHp} hp at the shop${r.carb?" · carburettor running rich up top":""}</div>
    <div><b>Driving</b>${r.auto?"Auto driver all the way":r.took!=null?`Auto to ${(r.took/1000).toFixed(1)} km, then you`:"You drove"}${r.handed?` to ${(r.handed/1000).toFixed(1)} km, then the auto driver took the rest`:""} · ${r.moments} moment${r.moments===1?"":"s"}${offs?" · "+offs:" · no offs"}</div>
    <div><b>Heat</b>water ${r.coolPeak} °C peak${r.derateT>0?` · ${r.derateT.toFixed(0)} s pulling power to save itself`:""} · on top the air is ${Math.round(100*(1-0.69))}% thinner, so the radiator sheds about ${Math.round(100*(1-Math.pow(0.69,0.8)))}% less heat per degree</div>
    <div><b>Car</b>${esc(r.chName)} · ${r.m.toLocaleString("en-CA")} kg · ${r.tyreName} · ${r.aeroName} · final ${r.fd.toFixed(2)}:1${r.dmg>0?` · bodywork damaged (−${Math.round(r.dmg*100)}% power through the rest)`:""}</div>${wear}${wxLine(r)}${"tip" in r?suTipHtml(r,true):""}</div>
    <div class="pfield" style="margin-top:10px">${r.field.map((f,i)=>`<b>${i+1}</b><span class="nm${f.me?" me":""}">${f.me?"▶ ":""}${esc(f.n)}${f.me?"":` <small style="opacity:.6">${f.hp} hp${f.turbo?" turbo":""}${f.rv?" · rival":""}</small>`}</span><span class="${f.me?"me":""}">${f.t!=null?fmtHill(f.t):f.dnf==="edge"?"DNF · edge":"DNF"}</span>`).join("")}</div></div>`;}
/* the chart: power against altitude — this engine, what an atmospheric engine of the same shop power would make, the shop line */
function drawHillChart(r){const css=getComputedStyle(document.documentElement),INK=css.getPropertyValue("--ink").trim()||"#edeae1",soft=INK.startsWith("#1")?"rgba(20,20,19,.45)":"rgba(237,234,225,.45)";
  const dpr=Math.min(devicePixelRatio,2),W=chart.clientWidth,H=chart.clientHeight;if(chart.width!==W*dpr){chart.width=W*dpr;chart.height=H*dpr;}
  const x=chart.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);const hp=r.hp;if(!hp||!hp.length)return;
  const F=getComputedStyle(document.body).fontFamily,padL=40,padR=14,padT=24,padB=26,cw=W-padL-padR,ch=H-padT-padB,a0=2800,a1=4360,X=a=>padL+cw*(a-a0)/(a1-a0),mx=Math.ceil(r.refHp*1.08/50)*50,Y=v=>padT+ch*(1-v/mx);
  x.strokeStyle=css.getPropertyValue("--grid").trim()||"rgba(255,255,255,.07)";x.lineWidth=1;x.font="10px "+F;
  const stp=mx>600?200:mx>300?100:50;for(let v=0;v<=mx;v+=stp){const py=Y(v);x.beginPath();x.moveTo(padL,py);x.lineTo(W-padR,py);x.stroke();x.fillStyle=soft;x.textAlign="right";x.fillText(v,padL-4,py+3);}
  x.textAlign="center";for(let a=3000;a<=4300;a+=W>480?250:500){x.fillStyle=soft;x.fillText(a.toLocaleString("en-CA")+" m",X(a),H-8);}
  // treeline, sections up top
  x.setLineDash([3,4]);x.strokeStyle="rgba(92,191,138,.5)";x.beginPath();x.moveTo(X(SIM.HILL_TREE),padT);x.lineTo(X(SIM.HILL_TREE),padT+ch);x.stroke();x.setLineDash([]);
  x.fillStyle="rgba(92,191,138,.8)";x.textAlign="left";x.fillText("treeline",X(SIM.HILL_TREE)+4,padT+ch-4);
  // the shop figure, an atmospheric engine of the same shop power (∝ density^1.1), this engine
  x.strokeStyle=soft;x.setLineDash([2,3]);x.beginPath();x.moveTo(padL,Y(r.refHp));x.lineTo(W-padR,Y(r.refHp));x.stroke();x.fillStyle=soft;x.textAlign="right";x.fillText(`${r.refHp} hp at the shop`,W-padR,Y(r.refHp)-4);
  const rho=a=>Math.pow(1-2.25577e-5*a,5.25588)/(273.15+16-6.5*(a-2862)/1000),r500=Math.pow(1-2.25577e-5*500,5.25588)/293.15;
  x.strokeStyle="rgba(120,169,221,.85)";x.setLineDash([5,4]);x.lineWidth=1.6;x.beginPath();for(let a=2862;a<=4302;a+=20){const v=r.refHp*Math.pow(rho(a)/r500,1.1);a===2862?x.moveTo(X(a),Y(v)):x.lineTo(X(a),Y(v));}x.stroke();x.setLineDash([]);
  x.strokeStyle="#d97757";x.lineWidth=2.4;x.beginPath();hp.forEach((p,i)=>{i?x.lineTo(X(p.alt),Y(p.hp)):x.moveTo(X(p.alt),Y(p.hp));});x.stroke();
  x.fillStyle="#d97757";hp.forEach(p=>{x.beginPath();x.arc(X(p.alt),Y(p.hp),3,0,7);x.fill();});
  x.font="10.5px "+F;x.textAlign="center";x.fillStyle=INK;hp.forEach((p,i)=>{if(W>420||i%2===0)x.fillText(p.hp,X(p.alt),Y(p.hp)-8);});
  x.textAlign="left";x.font="11px "+F;x.fillStyle="#d97757";x.fillText(r.kind==="turbo"?"this engine (turbo)":r.kind==="na"?"this engine":"this engine (blown)",padL+4,13);x.fillStyle="rgba(120,169,221,.95)";x.fillText("atmospheric",padL+(r.kind==="turbo"?122:r.kind==="na"?80:118),13);
  x.fillStyle=soft;x.textAlign="right";if(W>420)x.fillText(`hp vs altitude · ${r.dnf?"DNF":fmtHill(r.time)}`,W-padR,13);}
function hillRecHtml(){const P=recBucket("hill"),ks=Object.keys(SIM.HILL_CLASSES).filter(k=>P[k]&&P[k].t);if(!ks.length)return "";
  return `<div class="rtop"><span>Cloudsplitter Peak · best per class</span>${ks.map(k=>{const e=P[k],c=SIM.CHASSIS[e.ch];return `<div><b>▲</b><span class="et">${fmtHill(e.t)}</span><span></span><span class="nm" title="${esc(e.n)}">${esc(SIM.HILL_CLASSES[k].n)}${c?" · "+esc(c.n):""}</span><span>${e.w!=null?"wk "+e.w:e.d?new Date(e.d).toLocaleDateString("en-CA",{month:"short",day:"numeric"}):""}</span></div>`;}).join("")}</div>`;}
