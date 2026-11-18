/* ===================== BOAT DRAGS: 1,000 ft of river, heads-up eliminations ===================== */
/* the run itself is in app/boat-run.js, which goes into app-late.js (since 1.76.141.0) */
/* a night is eight boats on a ladder: round 1, the semi, the final. Each round is one pass against the boat in the other lane:
   reaction time plus elapsed time, first to the far buoys wins. Lose (or break, or go red) and the night is over. */
let BT=null;
const BOAT_PAY={1:1,2:0.45,3:0.2,5:0.08},BOAT_REPS={1:4,2:2,3:1,5:0},BOAT_RND=["ROUND 1","SEMI-FINAL","FINAL"],BOAT_PLACE={1:"Won the night",2:"Runner-up",3:"Out in the semi",5:"Out in round 1"};
const BOAT_DRV=["Darlene Hutt","Gus Ferrier","Rae Lindgren","Buck Toews","Marty Oyelaran","Jen Kowalski","Cal Dueck","Tammy Rousseau","Hank Sato","Lou Brandt","Vic Petrenko","Shay Mulligan","Dot Fiorentino","Wade Hiebert","Pam Okonkwo","Ike Lachance"];
const BOAT_HN={outboard:["Bass Assassin","Reel Deal","Hook Shot","Lake Effect","Two-Stroke Joke","Mercury Rising","Crappie Days","Wake Up Call","Gill Thrill"],
  jet:["Jet Set","Pump Action","Thunder Pump","Rooster Booster","Hydro Thunder","Sandbar Special","Jet Lag","River Rat"],
  pro:["Blown Away","Flat Out","Liquid Asset","Wet Dream","Prairie Fire","Hole Shot","Spray Day","Cleaver Fever"],
  tfh:["Nitro Fish","Sky Pilot","Air Time","Big Water","Final Approach","Prop Rider","Tail Dragger","Kingfisher"]};
function boatLitres(){const q=quick;return q?(q.Vd||q.VdEq||0)/1000:0;}
function boatLegal(k){const c=SIM.BOAT_CLASSES[k];if(c&&c.maxL&&boatLitres()>c.maxL+0.005)return{ok:false,why:`${boatLitres().toFixed(1)} L — the class is ${c.maxL} L and under`};return{ok:true};}
/* the boat's setup lives on S.env (never cfg): class, driver, prop pitch or impeller, gear, trim at the start */
function boatEnvFix(){const e=S.env,B=SIM.BOAT_CLASSES;if(!B[e.boatCls])e.boatCls="outboard";const C0=B[e.boatCls],num=(v,d)=>v!=null&&v!==""&&isFinite(+v)?+v:d;
  if(C0.pitch)e.boatPitch=Math.max(C0.pitch[0],Math.min(C0.pitch[1],Math.round(num(e.boatPitch,C0.pitch[2]))));
  e.boatGear=+Math.max(C0.gear[0],Math.min(C0.gear[1],num(e.boatGear,C0.gear[2]))).toFixed(2);
  e.boatImp=Math.max(0,Math.min(3,Math.round(num(e.boatImp,1))));
  const tr=SIM.boatTrimRange();e.boatTrim=+Math.max(tr[0],Math.min(tr[1],num(e.boatTrim,0))).toFixed(1);
  if(e.boatDrive!=="auto")e.boatDrive="you";return e.boatCls;}
/* the night: one per class a week in career; the sandbox keeps one going until it is over */
function boatCur(){const n=career()?C().boatN:S.boatSb;return n&&n.v===1&&SIM.BOAT_CLASSES[n.cls]?n:null;}
function boatLive(){const n=boatCur();return n&&!n.done?n:null;}
/* career: one boat night a week, in one class. The class run this week, or null */
function boatRanWk(k){return !!wkCls("boatWk");}
function boatFee(){if(!career()||dev()||boatLive())return 0;return (SIM.BOAT_CLASSES[S.env.boatCls]||SIM.BOAT_CLASSES.outboard).fee;}
function boatWaterAt(N,stage){return SIM.boatWater((N.seed^((stage+1)*0x9E3779B1))>>>0);}
function boatMyMatch(N){const r=N.rounds[N.stage];return r?r.find(m=>m.a===0||m.b===0):null;}
function boatRecHtml(){const R=recs(),P=R.boat;if(!P||typeof P!=="object")return "";const ks=Object.keys(SIM.BOAT_CLASSES).filter(k=>P[k]&&P[k].et);if(!ks.length)return "";
  return `<div class="rtop"><span>Boat drags · best per class</span>${ks.map(k=>{const e=P[k];return `<div><b>⚓</b><span class="et">${e.et.toFixed(3)}</span><span>${Math.round(e.mph)} mph</span><span class="nm" title="${esc(e.n)}">${esc(SIM.BOAT_CLASSES[k].n)}</span><span>${e.w!=null?"wk "+e.w:e.d?new Date(e.d).toLocaleDateString("en-CA",{month:"short",day:"numeric"}):""}</span></div>`;}).join("")}</div>`;}
function boatHint(){const c=SIM.BOAT_CLASSES;return career()?`<b>Boat drags</b> · one night a week in one class, entry ${fmt$(c.outboard.fee)}–${fmt$(c.tfh.fee)}. Needs a certified engine. Eight boats, heads-up: lose once and you're out. ${c.jet.n} opens at ${c.jet.rep} rep, ${c.pro.n} at ${c.pro.rep}, ${c.tfh.n} at ${c.tfh.rep}. The winner takes up to ${fmt$(c.tfh.purse)}.`
  :`<b>Boat drags</b> · 1,000 ft of river, heads-up. Wait for the green, then hold for throttle. Feather it if the prop blows out off the line, trim in for the hump and out once it's on plane — too far out and it porpoises, walks, or blows over.`;}
/* the prop shop: the quickest pitch and gear (or impeller and drive ratio) for this engine on glassy water */
const boatShopC=new Map();
function boatShopTxt(b,C0){return b?(C0.drive==="jet"?`${SIM.BOAT_IMP[b.imp][1]} impeller · ${b.gear.toFixed(2)}:1`:`${b.pitch}" pitch · ${b.gear.toFixed(2)}:1`)+(b.et?` → ${b.et.toFixed(2)} s on glassy water`:""):"";}
function boatLadderHtml(N){const nm=i=>i==null?"—":i===0?"<b>You</b>":esc(N.field[i-1].name.split(" ").pop());
  const pt=p=>!p?"":p.rt!=null&&p.rt<0?"RED":p.et==null?(p.dnf==="broke"?"BROKE":"DNF"):p.et.toFixed(2);
  return `<div class="bladder">${N.rounds.map((R,ri)=>`<div class="blr"><span class="blh">${BOAT_RND[ri]}</span>${R.map(m=>`<div class="blm${m.a===0||m.b===0?" me":""}"><span class="${m.win===m.a?"w":m.win!=null?"l":""}">${nm(m.a)} <i>${pt(m.pa)}</i></span><span class="${m.win===m.b?"w":m.win!=null?"l":""}">${nm(m.b)} <i>${pt(m.pb)}</i></span></div>`).join("")}</div>`).join("")}</div>`;}
function boatEnvHtml(sl){const e=S.env,k=boatEnvFix(),C0=SIM.BOAT_CLASSES[k],HU=SIM.BOAT_HULLS[C0.hull],lk=clsLocked(SIM.BOAT_CLASSES,k),N=boatCur(),live=boatLive(),R=recs().boat||{},pb=R[k];let h="";
  if(N&&N.cls===k){const st=live?N.stage:null,m=live?boatMyMatch(N):null,oi=m?(m.a===0?m.b:m.a):null,of=oi?N.field[oi-1]:null,w=live?boatWaterAt(N,st):null;
    h+=`<div class="saltcls"><div><span>${live?BOAT_RND[st]:"Last night"}</span><b>${live?(of?esc(of.name.split(" ").pop()):"—"):({1:"Won",2:"Runner-up",3:"Semi",5:"Round 1"}[N.place]||"—")}</b><small>${live?(of?`${esc(of.boat)} · ${of.hp.toLocaleString()} hp`:""):N.purse?"purse "+fmt$(N.purse):"no purse"}</small></div>${w?`<div><span>Water</span><b>${(w.wind>=0?"+":"")+w.wind.toFixed(1)}<i style="font-size:12px;font-style:normal"> m/s</i></b><small>${esc(w.name)} · ${w.wind>=0?"headwind":"tailwind"}</small></div>`:`<div><span>Field</span><b>${C0.field.hp.toLocaleString()}</b><small>hp, give or take ${C0.field.sd}</small></div>`}<div><span>Your best</span><b>${pb?pb.et.toFixed(2):"—"}</b><small>${pb?Math.round(pb.mph)+" mph":"no pass yet"}</small></div></div>`;
    h+=boatLadderHtml(N);
    if(live)h+=`<p class="hint">${of?`Next: <b>${esc(of.name)}</b> in ${esc(of.boat)}. `:""}Tune between rounds — the setup below goes on the boat for the next pass. <button class="chip" data-boatleave>Leave the night</button></p>`;
    else h+=`<p class="hint">${BOAT_PLACE[N.place]||"Night over"}${N.purse?" · "+fmt$(N.purse):""}. ${career()&&boatRanWk(k)?`The next ${C0.n} night is week ${C().week+1}.`:"Run again to start a new night."}</p>`;}
  else h+=`<div class="saltcls"><div><span>Course</span><b>1,000 ft</b><small>river · two lanes · a tree</small></div><div><span>Field</span><b>${C0.field.hp.toLocaleString()}</b><small>hp, give or take ${C0.field.sd}</small></div><div><span>Your best</span><b>${pb?pb.et.toFixed(2):"—"}</b><small>${pb?Math.round(pb.mph)+" mph":"no pass yet"}</small></div></div>`;
  h+=`<div class="lbl"><span>Class</span></div><div class="seg wide">${Object.entries(SIM.BOAT_CLASSES).map(([id,c])=>{const l=clsLocked(SIM.BOAT_CLASSES,id);return `<button data-tk="boatCls" data-tv="${id}" class="${k===id?"on":""}${l?" lock":""}"${live&&live.cls!==id?" disabled":""}>${c.n}<small>${l?l+" rep":c.d}</small></button>`;}).join("")}</div>`;
  h+=driverToggle(id=>`data-tk="boatDrive" data-tv="${id}"`,e.boatDrive,"throttle, trim · feather the hump","a sharp hand · tap to take over");
  if(C0.drive==="jet")h+=`<div class="lbl"><span>Impeller</span></div><div class="seg">${SIM.BOAT_IMP.map(([c,n,cj,d],i)=>`<button data-tk="boatImp" data-tv="${i}" class="${e.boatImp===i?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>`;
  else h+=`<div class="envgrid">${sl("boatPitch","Prop pitch",C0.pitch[0],C0.pitch[1],1,'"',e.boatPitch)}</div>`;
  h+=`<div class="envgrid">${sl("boatGear",C0.drive==="jet"?"Drive ratio":C0.id==="outboard"?"Lower-unit gear":"V-drive box",C0.gear[0],C0.gear[1],0.05,":1",e.boatGear)}${sl("boatTrim","Trim at the start",SIM.boatTrimRange()[0],SIM.boatTrimRange()[1],0.5,"°",e.boatTrim)}</div>`;
  const sh=boatShopC.get(k+"|"+cfgHash(S.cfg));
  h+=`<p class="hint">Boat drags: ${C0.n} · ${HU.n.toLowerCase()} · ${(C0.hullKg+C0.rigKg+90).toLocaleString("en-CA")} kg plus the engine. ${C0.drive==="jet"?"The pump's impeller cut sets how hard it loads the engine: a light cut revs and leaves hard, a heavy one pulls at the top end. The drive ratio steps the impeller up or down.":"Pitch is how far one turn of the prop would move the boat with no slip: more pitch, more top speed — and more load, so the engine revs lower and the prop slips more off the line."} Trim in (negative) for the hump, out once it's planing — this hull likes about ${HU.opt>0?"+":""}${HU.opt}°.${C0.maxL?` ${C0.maxL} L and under.`:""}${lk?` <b>Opens at ${lk} rep.</b>`:""}${!live&&boatRanWk(k)?` <b>Run this week — the next night is week ${C().week+1}.</b>`:""}
    <button class="chip" data-boatshop>${sh?"Prop shop: "+boatShopTxt(sh,C0)+" · fit it":"Ask the prop shop"}</button></p>`;
  return h;}
/* the run sheet's trace: speed and prop slip against distance, the trim under them */
function drawBoatTrace(r){const css=getComputedStyle(document.documentElement),INK=css.getPropertyValue("--ink").trim()||"#edeae1";const soft=INK.startsWith("#1")?"rgba(20,20,19,.45)":"rgba(237,234,225,.45)";
  const dpr=Math.min(devicePixelRatio,2),W=chart.clientWidth,H=chart.clientHeight;if(chart.width!==W*dpr){chart.width=W*dpr;chart.height=H*dpr;}
  const x=chart.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);const tr=(r.trace||[]).filter(p=>p.x<=SIM.BOAT_FT+30);if(!tr.length)return;
  const L=SIM.BOAT_FT,padL=34,padR=34,padT=12,padB=22,cw=W-padL-padR,ch=H-padT-padB,X=d=>padL+cw*Math.max(0,Math.min(1,d/(L+20))),mx=Math.max(20,Math.ceil(Math.max(...tr.map(p=>p.v))*2.23694/20)*20);
  x.strokeStyle=css.getPropertyValue("--grid").trim()||"rgba(255,255,255,.07)";x.lineWidth=1;x.font="10px "+getComputedStyle(document.body).fontFamily;x.textAlign="center";
  for(let f=0;f<=1000;f+=200){const px=X(f/3.28084);x.beginPath();x.moveTo(px,padT);x.lineTo(px,padT+ch);x.stroke();x.fillStyle=soft;x.fillText(f+" ft",px,H-6);}
  x.fillStyle="rgba(238,90,94,.14)";tr.forEach((p,i)=>{if(p.b&&i)x.fillRect(X(tr[i-1].x),padT,Math.max(1,X(p.x)-X(tr[i-1].x)),ch);});
  const line=(f,col,w,dash)=>{x.strokeStyle=col;x.lineWidth=w;x.setLineDash(dash||[]);x.beginPath();tr.forEach((p,i)=>{const px=X(p.x),py=padT+ch*(1-Math.max(0,Math.min(1,f(p))));i?x.lineTo(px,py):x.moveTo(px,py);});x.stroke();x.setLineDash([]);};
  const tR=SIM.boatTrimRange();line(p=>(p.trim-tR[0])/(tR[1]-tR[0]),"rgba(92,191,138,.85)",1.2,[2,3]);line(p=>Math.max(0,p.slip),"rgba(120,169,221,.9)",1.5);line(p=>p.v*2.23694/mx,"#d97757",2.2);
  x.strokeStyle=INK;x.lineWidth=1;x.setLineDash([3,3]);x.beginPath();x.moveTo(X(L),padT);x.lineTo(X(L),padT+ch);x.stroke();x.setLineDash([]);
  const ly=padT+ch-6;x.textAlign="left";x.font="11px "+getComputedStyle(document.body).fontFamily;x.fillStyle="#d97757";x.fillText("mph",padL+4,ly);x.fillStyle="rgba(120,169,221,.9)";x.fillText("slip",padL+34,ly);x.fillStyle="rgba(92,191,138,.95)";x.fillText("trim",padL+60,ly);x.fillStyle="rgba(238,90,94,.8)";x.fillText("blown",padL+88,ly);
  x.fillStyle=soft;x.textAlign="right";x.fillText(mx+" mph",W-padR,ly);}
function boatSlipCard(r,res){const M=r.match||{},f3=v=>v==null?"—":(+v).toFixed(3),rt=v=>v==null?"—":v<0?"RED":(+v).toFixed(3),mk=n=>(r.marks||[]).find(q=>q.n===n),failed=!!res.boatFailed;
  const rows=[["R/T",M.foul?"RED":rt(r.rt),rt(M.oppRt)],["60'",f3(mk("60 ft")&&mk("60 ft").t),""],["330'",f3(mk("330 ft")&&mk("330 ft").t),""],["660'",f3(mk("660 ft")&&mk("660 ft").t),""],["MPH",mk("660 ft")?mk("660 ft").mph.toFixed(2):"—","","mph"],
    ["1000'",failed?"BROKE":r.et!=null?f3(r.et):({blowover:"BLEW OVER",hooked:"HOOKED",stuffed:"STUFFED"}[r.dnf]||"DNF"),M.oppDnf?(M.oppDnf==="broke"?"BROKE":"DNF"):f3(M.oppEt),"et"],["MPH",r.mph!=null&&!failed?r.mph.toFixed(2):"—",M.oppMph!=null&&!M.oppDnf?M.oppMph.toFixed(2):"—","mph"]];
  const verdict=failed?"BROKE":M.foul?"RED LIGHT":M.won?"WIN":"LOSS",when=new Date(r.at||Date.now()),lamp=w=>`<i class="lamp${w?" on":""}"></i>`;
  const pb=r.pb&&r.et!=null?`<div class="stamp">CLASS BEST<br><s>${r.pb.was}</s> ${r.et.toFixed(3)}</div>`:"";
  return`<div class="tslip${M.won?" won":""}" role="group" aria-label="Timing slip"><div class="tsh"><b>PRAIRIE RIVER DRAGS</b><small>1,000 ft · ${esc(r.clsName)} · ${esc(M.label||"")}</small><small>${when.toLocaleDateString("en-CA")} ${String(when.getHours()).padStart(2,"0")}:${String(when.getMinutes()).padStart(2,"0")}</small></div>
    <div class="tsc"><strong>${esc((S.name||engineName()||"").slice(0,40))}</strong>${Math.round(res.peakHp)} hp · ${esc(SIM.BOAT_HULLS[r.hull].n)} · ${r.drive==="jet"?r.imp+"-cut pump":r.pitch+'" prop'} · ${r.gear}:1 · ${r.mass.toLocaleString("en-CA")} kg${r.auto?r.auto.took!=null?" · you took over":" · auto driver":""}</div>
    <table><thead><tr><th></th><th class="you"><small>Right lane</small>${lamp(M.won)}You</th><th><small>Left lane</small>${lamp(!M.won)}${esc(String(M.opp||"").split(" ").pop())}</th></tr></thead>
    <tbody>${rows.map(x=>`<tr class="${x[3]||""}"><td>${x[0]}</td><td>${x[1]}</td><td>${x[2]===""?"":x[2]}</td></tr>`).join("")}</tbody></table>
    <div class="tsw"><b class="${M.won?"w":"l"}">${verdict}</b><span>${M.margin!=null?"by "+Math.abs(M.margin).toFixed(3)+" s":""}</span></div>${pb}<div class="tsf">Wind ${r.water.wind>=0?"+":""}${r.water.wind} m/s · ${esc(r.water.name)}</div></div>`;}
function boatVerdict(res){const r=res.boat,M=r.match||{},nt=r.night||{};
  const head=res.boatFailed?(r.broke==="valve_float"?"FLOATED THE VALVES":r.broke==="head_lift"?"COOKED IT":"BROKE ON THE RIVER"):M.foul?"RED LIGHT":r.dnf==="blowover"?"BLEW OVER":r.dnf==="hooked"?"HOOKED IT":r.dnf==="stuffed"?"STUFFED IT":M.won?`WON ${esc(M.label)}`:`LOST ${esc(M.label)}`;
  const cls=res.boatFailed||r.dnf||M.foul?"fail":M.won?"pass":"marg";
  const sub=nt.done?`${BOAT_PLACE[nt.place]||""}${r.purse?` · purse ${fmt$(r.purse)}`:""}`:`On to the ${BOAT_RND[nt.stage+1]?BOAT_RND[nt.stage+1].toLowerCase():"next round"}`;
  return `<div class="verdict ${cls}"><div style="flex:1"><div class="big">${head}${r.et!=null&&!res.boatFailed?`<br><span style="font-size:.7em;opacity:.85">${r.et.toFixed(3)} s @ ${r.mph.toFixed(1)} mph</span>`:""}</div><p>${esc(r.clsName)} · vs ${esc(M.opp)} (${M.oppDnf?M.oppDnf==="broke"?"broke":"DNF":M.oppEt!=null?M.oppEt.toFixed(3)+" @ "+Math.round(M.oppMph):"—"}) · ${sub}${r.auto?r.auto.took!=null?" · you took over":" · auto driver":""}${r.pb?` · class best (was ${r.pb.was})`:""}${res.boatFailed&&career()?" — certification is void and reputation took a hit":""}</p>
    <div class="vstats"><div><b>${r.rt!=null&&!M.foul?r.rt.toFixed(3):"RED"}</b><span>reaction</span></div><div><b>${r.humpT!=null?r.humpT.toFixed(2):"—"}</b><span>s to the hump</span></div><div><b>${r.blowN}</b><span>blowouts</span></div><div><b>${r.maxMph.toFixed(0)}</b><span>top mph</span></div></div></div></div>`;}
function boatSheet(res){const r=res.boat,N=boatCur();
  const wi=wearInfo(res);const wear=wi?`<div><b>Wear</b>${wi.passes} of ${wi.budget} pass${wi.budget===1?"":"es"} · <span style="color:${wi.w>=1?"var(--crit)":wi.w>0.6?"var(--warn)":"var(--good)"}">${Math.round(wi.w*100)}%</span>${res.wornBy?" · down "+res.wornBy+"% on power":""}${wi.w>0?` <button class="btn sm" id="freshen" style="margin-left:8px">Freshen · ${fmt$(freshenCost(res))}</button>`:""}</div>`:"";
  return `<div class="sec"><h2>Timing slip</h2><div class="tslipw">${boatSlipCard(r,res)}</div>
    <div class="log" style="margin-top:12px"><div><b>Setup</b>${r.drive==="jet"?r.imp+"-cut impeller":r.pitch+'" pitch'} · ${r.gear}:1 · trim ${r.trim0>=0?"+":""}${r.trim0}° at the start · ${r.mass.toLocaleString("en-CA")} kg</div>
    <div><b>Water</b>${esc(r.water.name)} (chop ${Math.round(r.water.chop*100)}%) · ${Math.abs(r.water.wind)} m/s ${r.water.wind>=0?"headwind":"tailwind"}</div>
    <div><b>Engine</b>${r.peakRpm.toLocaleString()} rpm peak · ${r.limT>0.05?r.limT.toFixed(1)+" s on the limiter · ":""}raw water ${r.coolPeak} °C${r.slipEnd!=null?` · ${Math.round(r.slipEnd*100)}% slip at the line`:""}</div>
    ${r.reasons.map(x=>`<div>${x}</div>`).join("")}${wear}</div>
    ${N&&N.cls===r.cls?`<h2 style="margin-top:12px">The ladder</h2>${boatLadderHtml(N)}`:""}</div>`;}
