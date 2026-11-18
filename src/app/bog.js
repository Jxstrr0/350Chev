/* ===================== MUD BOG: the engine in a truck, a pit of mud ===================== */
/* the run itself is in app/bog-run.js, which goes into app-late.js (since 1.76.141.0) */
/* run up on the dirt, hit the mud with whatever speed you've got and keep the wheels turning: stuck scores the distance, through scores the time */
let BR=null;
const BOG_PURSE=[2500,1200,700,400,200],BOG_PAY={1:1,2:1.8,3:3},BOG_REP=[3,2,1],BOG_SB={};
const BOG_NAMES=["Swamp Thing","Mud Butter","Gumbo","Sloppy Joe","Bog Hog","Muddy Waters","Dirty Bird","Low Ground","Sink Hole","Gator Bait","Brown Out","Clay Pigeon","Backwater","Slough Monster","Rooster Tail","Wet Willy","Gravy Train","Stuck Up"];
const BOG_COLORS={street:0x1d4787,modified:0xb7261d,super:0x2c6b3a};
/* the truck setup lives on S.env beside the sled's and the salt's; anything a class doesn't run is pulled back in */
function bogEnvFix(){const e=S.env,B=SIM.BOG_CLASSES;if(!B[e.bogCls])e.bogCls="street";const k=e.bogCls,V=B[k].veh,G=B[k].gears;
  if(!V.tyres.includes(e.bogTyre))e.bogTyre=V.tyres[V.tyres.length-1];
  e.bogGear=Math.max(0,Math.min(G.length-1,Math.round(isFinite(+e.bogGear)&&e.bogGear!==""&&e.bogGear!=null?+e.bogGear:1)));
  if(e.bogDrive!=="auto")e.bogDrive="you";return k;}
function bogVeh(k){const e=S.env;return{cls:k,gear:+e.bogGear,tyre:e.bogTyre,redline:S.cfg.redline,idle:SIM.isDiesel(S.cfg)?720:Math.max(750,S.cfg.cam>70?1100:850)};}
/* the night: one pit per class per week in career (the same mud all week), a fresh one every run in the sandbox */
function bogSeed(k){const ix=Object.keys(SIM.BOG_CLASSES).indexOf(k)+1;if(!career())return BOG_SB[ix]||(BOG_SB[ix]=Math.floor(Math.random()*1e9)+1);if(!C().bogSeed)C().bogSeed=Math.floor(Math.random()*1e9)+1;return(C().bogSeed^(C().week*7919)^(ix*104729))>>>0;}
/* career: one mud bog run a week, in one class. The class run this week, or null */
function bogHookedWk(k){return !!wkCls("bogWk");}
/* entry: about 15% of the class's winning purse */
function bogFee(k){return evFee(BOG_PURSE[0],BOG_PAY,(SIM.BOG_CLASSES[k]||SIM.BOG_CLASSES.street).tier);}
const bogNightCache=new Map(),bogFieldCache=new Map();
function bogNight(seed){let n=bogNightCache.get(seed);if(!n){if(bogNightCache.size>12)bogNightCache.clear();n=SIM.bogNight(seed);bogNightCache.set(seed,n);}return n;}
/* the rest of the class: 5–7 trucks, each its own engine and driver run through the same sim and the same mud */
function bogField(k,seed){const key=k+"|"+seed;if(bogFieldCache.has(key))return bogFieldCache.get(key);
  const C0=SIM.BOG_CLASSES[k],F=C0.field,r=pullRand((seed^0x2F6B1D)>>>0),night=bogNight(seed),names=BOG_NAMES.slice(),n=5+Math.floor(r()*3),out=[];
  for(let i=0;i<n;i++){const nm=names.splice(Math.floor(r()*names.length),1)[0],gs=Math.sqrt(-2*Math.log(Math.max(1e-6,r())))*Math.cos(2*Math.PI*r());
    const hp=Math.round(Math.max(140,F.hp+gs*F.sd)),dsl=r()<F.dsl,skill=+(0.45+0.55*r()).toFixed(2),gear=Math.min(C0.gears.length-1,Math.max(0,1+(r()<0.25?-1:r()<0.3?1:0))),tyre=C0.veh.tyres[r()<0.8?C0.veh.tyres.length-1:0];
    const res=SIM.bogAiRes(hp,dsl,(seed+i*977)>>>0);let q;try{q=SIM.bogPass(res,{cls:k,gear,tyre,redline:res.redline,idle:dsl?720:850,seed:(seed^(i+1)*2654435761)>>>0,night,noFail:true},skill);}catch(e){q={cleared:false,distM:20,pitT:null};}
    const row={n:nm,hp,dsl,cleared:!!q.cleared,t:q.cleared?q.pitT:null,m:q.cleared?night.len:q.distM};
    if(r()<0.06){row.broke=true;row.cleared=false;row.t=null;row.m=+(row.m*(0.25+0.6*r())).toFixed(2);}
    out.push(row);}
  if(bogFieldCache.size>12)bogFieldCache.clear();bogFieldCache.set(key,out);return out;}
/* mud-bog order: through the pit beats stuck in it; through, the quicker time; stuck, the farther */
const bogCmp=(a,b)=>(a.dq?1:0)-(b.dq?1:0)||(b.cleared?1:0)-(a.cleared?1:0)||(a.cleared?a.t-b.t:b.m-a.m)||(a.me?-1:b.me?1:0);
const bogScore=f=>f.dq?"DQ":f.cleared?f.t.toFixed(2)+" s":f.m.toFixed(1)+" m";
function bogRecHtml(){const R=recs(),P=R.bog;if(!P||typeof P!=="object")return "";const ks=Object.keys(SIM.BOG_CLASSES).filter(k=>P[k]);if(!ks.length)return "";
  return `<div class="rtop"><span>Mud bog · best per class</span>${ks.map(k=>{const e=P[k];return `<div><b>${e.c?"✓":"·"}</b><span class="et">${e.c?e.t.toFixed(2):e.m.toFixed(1)}</span><span>${e.c?"s":"m"}</span><span class="nm" title="${esc(e.n)}">${esc(SIM.BOG_CLASSES[k].n)}</span><span>${e.w!=null?"wk "+e.w:e.d?new Date(e.d).toLocaleDateString("en-CA",{month:"short",day:"numeric"}):""}</span></div>`;}).join("")}</div>`;}
function bogHint(){const c=SIM.BOG_CLASSES;return career()?`<b>Mud bog</b> · ${fmt$(bogFee("street"))}–${fmt$(bogFee("super"))} entry, one run a week in one class. Needs a certified engine. ${c.street.n} is open to anyone; ${c.modified.n} at ${c.modified.rep} rep, ${c.super.n} at ${c.super.rep}. Through the pit beats stuck in it — quickest time wins, then farthest. Purse by placing, up to ${fmt$(BOG_PURSE[0]*BOG_PAY[3])} in Super. Every run is wear, the mud packs the radiator, and each truck's radiator is sized for its class: a big swap runs hot.`
  :`<b>Mud bog</b> · hold the button for throttle, let go to feather. Carry speed off the run-up, then keep the wheels turning in the mud: a little wheelspin cleans the lugs, too much digs a hole. Stuck scores the distance; through scores the time.`;}
/* a quick look at the night's pit before you run it: length, mud, the depth along it, where the field got to */
function bogPitSvg(night,pitK,field){const L=night.len,W=300,H=40,pts=[];for(let x=0;x<=L;x+=1)pts.push([x/L*W,4+Math.min(1.6,SIM.bogDepth(night,x)*pitK)/1.6*(H-8)]);
  const path="M0,4 "+pts.map(p=>"L"+p[0].toFixed(1)+","+p[1].toFixed(1)).join(" ")+` L${W},4 Z`;
  const mk=(field||[]).map(f=>`<line x1="${((f.cleared?L:f.m)/L*W).toFixed(1)}" x2="${((f.cleared?L:f.m)/L*W).toFixed(1)}" y1="0" y2="${H}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="2 2"/>`).join("");
  const hz=night.hz.map(h=>`<text x="${(h.x/L*W).toFixed(1)}" y="${H-1}" font-size="8" text-anchor="middle" fill="var(--dim)">${h.kind==="rut"?"▾":"▴"}</text>`).join("");
  return `<svg class="bogpit" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Depth along the pit"><path d="${path}" fill="rgba(122,86,52,.55)" stroke="rgba(160,120,80,.9)" stroke-width="1"/>${mk}${hz}</svg>`;}
function bogEnvHtml(sl){const e=S.env,k=bogEnvFix(),C0=SIM.BOG_CLASSES[k],V=C0.veh,G=C0.gears,lk=clsLocked(SIM.BOG_CLASSES,k),seed=bogSeed(k),night=bogNight(seed),field=bogField(k,seed),R=recs().bog||{},pb=R[k];
  const thru=field.filter(f=>f.cleared).length,lead=field.slice().sort(bogCmp)[0];
  let h=`<div class="saltcls"><div><span>Tonight's pit</span><b>${night.len} m</b><small>${esc(night.name)} · ${Math.round(night.d0*(V.pitK||1)*100)} cm deep</small></div><div><span>To beat</span><b>${lead?bogScore(lead):"—"}</b><small>${thru} of ${field.length} got through</small></div><div><span>Your best</span><b>${pb?(pb.c?pb.t.toFixed(2)+" s":pb.m.toFixed(1)+" m"):"—"}</b><small>${pb?(pb.c?"through the pit":"farthest"):"no run yet"}</small></div></div>${bogPitSvg(night,V.pitK||1,field)}`;
  h+=`<div class="lbl"><span>Class</span></div><div class="seg wide">${Object.entries(SIM.BOG_CLASSES).map(([id,c])=>{const l=clsLocked(SIM.BOG_CLASSES,id);return `<button data-bk="bogCls" data-bv="${id}" class="${k===id?"on":""}${l?" lock":""}">${c.n}<small>${l?l+" rep":c.d}</small></button>`;}).join("")}</div>`;
  h+=driverToggle(id=>`data-bk="bogDrive" data-bv="${id}"`,e.bogDrive,"hold for throttle, feather the spin","a sharp foot · watch the run");
  h+=`<div class="lbl"><span>Gear</span></div><div class="seg">${G.map(([n,mph],i)=>`<button data-bk="bogGear" data-bv="${i}" class="${+e.bogGear===i?"on":""}">${n}<small>${mph} mph at redline</small></button>`).join("")}</div>`;
  h+=`<div class="lbl"><span>Tyres</span></div><div class="seg">${V.tyres.map(id=>{const t=SIM.BOG_TYRES[id];return `<button data-bk="bogTyre" data-bv="${id}" class="${e.bogTyre===id?"on":""}">${t.n}<small>${t.d}</small></button>`;}).join("")}</div>`;
  h+=`<p class="hint">${C0.n}: ${V.mass.toLocaleString("en-CA")} kg truck, ${V.tyreDia}" tyres, ${V.driveN}, ${V.trans==="clutch"?"clutch — it can stall":"automatic"}, ${Math.round(V.clear*100)} cm under the frame. ${V.runup} m run-up. A tall gear carries more speed into the mud but bogs sooner in the deep end; a short one keeps the engine up in its band and spins easier. ${night.cons>0.6?"Sticky clay grabs the tyres and packs slow lugs solid":"Soupy mud lets the tyres sink to the floor but lets go of them"}.${lk?` <b>Opens at ${lk} rep.</b>`:""}${bogHookedWk(k)?` <b>Run this week — the next mud bog is week ${C().week+1}.</b>`:""}</p>`;
  return h;}
$("envBox").addEventListener("click",e=>{const b=e.target.closest("[data-bk]");if(!b)return;const k=b.dataset.bk,v=b.dataset.bv;
  if(k==="bogCls"){const l=clsLocked(SIM.BOG_CLASSES,v);if(l){toast(`${SIM.BOG_CLASSES[v].n} opens at ${l} rep`);return;}if(v!==S.env.bogCls){S.env.bogGear=null;S.env.bogTyre=null;}}
  S.env[k]=k==="bogGear"?+v:v;bogEnvFix();renderEnv();save();buzz(6);});
/* the run sheet's trace: speed and wheelspin against distance, the mud's depth shaded under them */
function drawBogTrace(r){const css=getComputedStyle(document.documentElement),INK=css.getPropertyValue("--ink").trim()||"#edeae1";const soft=INK.startsWith("#1")?"rgba(20,20,19,.45)":"rgba(237,234,225,.45)";
  const dpr=Math.min(devicePixelRatio,2),W=chart.clientWidth,H=chart.clientHeight;if(chart.width!==W*dpr){chart.width=W*dpr;chart.height=H*dpr;}
  const x=chart.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);const tr=(r.trace||[]).filter(p=>p.x>-15);if(!tr.length)return;
  const L=r.len||70,padL=34,padR=34,padT=12,padB=22,cw=W-padL-padR,ch=H-padT-padB,X0=-15,X=d=>padL+cw*Math.max(0,Math.min(1,(d-X0)/(L+5-X0))),mx=Math.max(10,Math.ceil((r.maxMph||10)/5)*5);
  x.strokeStyle=css.getPropertyValue("--grid").trim()||"rgba(255,255,255,.07)";x.lineWidth=1;x.font="10px "+getComputedStyle(document.body).fontFamily;x.textAlign="center";
  for(let f=0;f<=L;f+=10){const px=X(f);x.beginPath();x.moveTo(px,padT);x.lineTo(px,padT+ch);x.stroke();x.fillStyle=soft;x.fillText(f+" m",px,H-6);}
  // the mud: depth hangs down from the top of the plot
  x.fillStyle="rgba(122,86,52,.28)";x.beginPath();x.moveTo(X(0),padT);tr.forEach(p=>{if(p.x>=0)x.lineTo(X(p.x),padT+ch*Math.min(1,p.d/1.6));});x.lineTo(X(Math.min(L,tr[tr.length-1].x)),padT);x.closePath();x.fill();
  const sw=r.sweet||[0.1,0.26];x.fillStyle="rgba(92,191,138,.10)";x.fillRect(X(0),padT+ch*(1-sw[1]),X(L)-X(0),ch*(sw[1]-sw[0]));
  const line=(f,col,w,dash)=>{x.strokeStyle=col;x.lineWidth=w;x.setLineDash(dash||[]);x.beginPath();tr.forEach((p,i)=>{const px=X(p.x),py=padT+ch*(1-Math.max(0,Math.min(1,f(p))));i?x.lineTo(px,py):x.moveTo(px,py);});x.stroke();x.setLineDash([]);};
  const rm=Math.max(3000,Math.ceil(Math.max(...tr.map(p=>p.rpm))/1000)*1000);
  line(p=>p.slip,"rgba(120,169,221,.9)",1.5);line(p=>p.rpm/rm,"#e8c14a",1.2,[2,3]);line(p=>p.v*2.23694/mx,"#d97757",2.2);
  x.strokeStyle=INK;x.lineWidth=1;x.setLineDash([3,3]);x.beginPath();x.moveTo(X(L),padT);x.lineTo(X(L),padT+ch);x.stroke();x.setLineDash([]);
  const ly=padT+ch-6;x.textAlign="left";x.font="11px "+getComputedStyle(document.body).fontFamily;x.fillStyle="#d97757";x.fillText("mph",padL+4,ly);x.fillStyle="rgba(120,169,221,.9)";x.fillText("spin",padL+34,ly);x.fillStyle="#e8c14a";x.fillText("rpm",padL+62,ly);x.fillStyle="rgba(160,120,80,.95)";x.fillText("depth",padL+88,ly);
  x.fillStyle=soft;x.textAlign="right";x.fillText(mx+" mph",W-padR,ly);}
function bogVerdict(res){const r=res.bog;
  if(res.bogFailed)return `<div class="verdict fail"><div><div class="big">${r.broke==="head_lift"?"COOKED IT IN THE MUD":r.broke==="turbo"?"TURBO LET GO":r.broke==="piston"||r.broke==="crown_temp"?"MELTED A PISTON":"GRENADED IN THE PIT"}</div><p>${r.distM.toFixed(1)} m into the pit before it let go · scored ${ordN(r.place)} of ${r.of} on distance${career()?" — certification is void and reputation took a hit":""}.</p></div></div>`;
  const cls=r.place===1?"pass":r.place<=BOG_PURSE.length?"marg":"fail";
  return `<div class="verdict ${cls}"><div style="flex:1"><div class="big">${r.cleared?"THROUGH · "+r.pitT.toFixed(2)+" s":r.distM.toFixed(1)+" m"} · ${ordN(r.place)}</div><p>${r.clsName} · ${ordN(r.place)} of ${r.of} · ${r.len} m of ${esc(r.mud)} mud${r.auto?" · auto driver":""}${career()&&r.purse?` · purse ${fmt$(r.purse)}`:""}${r.pb?` · class best (was ${r.pb.was})`:""}</p>
    <div class="vstats"><div><b>${r.cleared?r.pitT.toFixed(2):r.distM.toFixed(1)}</b><span>${r.cleared?"seconds":"metres"}</span></div><div><b>${Math.round(r.entryMph)}</b><span>mph in</span></div><div><b>${r.avgMph!=null?Math.round(r.avgMph):Math.round(r.maxMph)}</b><span>${r.avgMph!=null?"avg mph":"top mph"}</span></div><div><b>${r.sweetT.toFixed(1)}</b><span>s in the band</span></div><div><b>${r.coolPeak}</b><span>water °C</span></div><div><b>${r.peakEgt}</b><span>EGT °C</span></div></div></div></div>`;}
function bogSheet(res){const r=res.bog;const why={cleared:"through",bogged:"bogged down",stalled:"stalled",highcentre:"high-centred",dug:"dug in",packed:"lugs packed",lifted:"lifted",stuck:"stuck",broke:"broke",time:"flagged"}[r.stopWhy]||"stopped";
  const wi=wearInfo(res);const wear=wi?`<div><b>Wear</b>${wi.passes} of ${wi.budget} pass${wi.budget===1?"":"es"} · <span style="color:${wi.w>=1?"var(--crit)":wi.w>0.6?"var(--warn)":"var(--good)"}">${Math.round(wi.w*100)}%</span>${res.wornBy?" · down "+res.wornBy+"% on power":""}${wi.w>0?` <button class="btn sm" id="freshen" style="margin-left:8px">Freshen · ${fmt$(freshenCost(res))}</button>`:""}</div>`:"";
  return `<div class="sec"><h2>Mud bog sheet</h2><div class="log"><div><b>Run</b>${r.cleared?"through in "+r.pitT.toFixed(2)+" s":r.distM.toFixed(1)+" m of "+r.len+" · "+why} · in at ${r.entryMph} mph · ${r.maxMph} mph top</div>
    <div><b>Setup</b>${r.clsName} · ${r.gearName} (${r.mphGear} mph) · ${r.tyre.toLowerCase()} · ${r.ratio}:1 overall</div>
    <div><b>Tyres</b>peak spin ${Math.round(r.peakSlip*100)}% · ${r.sweetT.toFixed(1)} s in the ${Math.round(r.sweet[0]*100)}–${Math.round(r.sweet[1]*100)}% band · ${r.spinT.toFixed(1)} s past the dig point · lugs ${Math.round(r.pack*100)}% packed · ${r.mudKg} kg of mud on it</div>
    <div><b>Heat</b>water ${r.coolPeak} °C peak · radiator ${Math.round(r.radPack*100)}% packed · EGT ${r.peakEgt} °C${r.bogT>0.3?" · "+r.bogT.toFixed(1)+" s lugging under "+r.bogBand[1].toLocaleString()+" rpm":""}</div>
    ${r.reasons.map(x=>`<div>${x}</div>`).join("")}${wear}</div>
    <div class="pfield" style="margin-top:10px">${r.field.map((f,i)=>`<b>${i+1}</b><span class="nm${f.me?" me":""}">${f.me?"▶ ":""}${esc(f.n)}${f.me?"":` <small style="opacity:.6">${f.hp} hp${f.dsl?" diesel":""}</small>`}</span><span class="${f.me?"me":""}">${f.broke&&!f.cleared?"broke · ":""}${bogScore(f)}</span>`).join("")}</div></div>`;}

