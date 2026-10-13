/* ===================== BUILD BAYS (career) =====================
   Late-game money sink. Bay C and Bay D are Shop items (UPGRADES bay3 / bay4); each takes a "bay lead" (a named hand with a level
   and traits) and, once staffed, builds a market contract in the background: the player picks the contract and a budget tier,
   the bay takes N weeks (set by the contract's difficulty) and delivers when the week advances. Quality comes from the lead's
   level and traits, the shop's upgrades and the budget; it sets the pay and the small chance of a failed QC (rework or penalty).
   A staffed bay costs its running cost + the lead's wage every week, busy or idle. State: C().bays, filled by bayS() so a save
   from before bays loads clean. Own seeded generator (C().bays.seed): never draws from C().seed. Nothing here touches S.cfg,
   the dyno or cfgHash. */
const BAYS=[{id:"bay3",nm:"Bay C",run:5000,wage:900},{id:"bay4",nm:"Bay D",run:8000,wage:1200}];
const BAY_BUD=[{id:"eco",n:"Economy",cost:0.5,q:-12},{id:"std",n:"Standard",cost:0.62,q:0},{id:"prem",n:"Premium",cost:0.74,q:14}];
const BAY_TR=[
  {id:"perfect",n:"Perfectionist",pos:1,d:"QC failures half as likely."},
  {id:"speedy",n:"Fast hands",pos:1,d:"Jobs of 3 weeks or more finish a week sooner."},
  {id:"thrifty",n:"Thrifty",pos:1,d:"Haggles for parts: build cost −6%."},
  {id:"closer",n:"Smooth talker",pos:1,d:"Clients pay +3%."},
  {id:"sloppy",n:"Sloppy",pos:0,d:"Quality −10."},
  {id:"pricey",n:"Pricey",pos:0,d:"Wage +20%."}];
const BAY_UPQ={shop1:3,shop2:4,race:4,dyno3:2,dyno4:2,flow:2,boost:2};
function bayS(){const c=C();if(!c.bays||typeof c.bays!=="object")c.bays={};const k=c.bays;if(!k.seed)k.seed=((c.seed>>>0)^0x2f6e2b1)>>>0||11;
  if(!k.b||typeof k.b!=="object")k.b={};if(!k.cand||typeof k.cand!=="object")k.cand={};if(!k.hist||typeof k.hist!=="object")k.hist={jobs:0,fail:0,profit:0};
  for(const b of BAYS)if(!k.b[b.id]||typeof k.b[b.id]!=="object")k.b[b.id]={lead:null,job:null};return k;}
function bayRnd(){const k=bayS();k.seed=(k.seed*1664525+1013904223)>>>0;return k.seed/4294967296;}
const bayTr=id=>BAY_TR.find(t=>t.id===id);
const bayHas=(L,id)=>!!L&&(L.tr||[]).includes(id);
function bayNew(id){const k=bayS();if(k.cand[id])return k.cand[id];
  const f=CREW_FIRST[Math.floor(bayRnd()*CREW_FIRST.length)],l=CREW_LAST[Math.floor(bayRnd()*CREW_LAST.length)];const x=bayRnd(),n=x<0.25?0:x<0.8?1:2,tr=[];
  for(let i=0;i<n;i++){const pos=bayRnd()<0.7,pool=BAY_TR.filter(t=>!!t.pos===pos&&!tr.includes(t.id));if(pool.length)tr.push(pool[Math.floor(bayRnd()*pool.length)].id);}
  return (k.cand[id]={nm:f+" "+l,lvl:1,xp:0,tr});}
function bayWage(b,L){return Math.round(b.wage*(1+0.12*((L.lvl|0)-1))*(bayHas(L,"pricey")?1.2:1)/10)*10;}
function bayQ(L,bud){let u=0;for(const id in BAY_UPQ)if(has(id))u+=BAY_UPQ[id];return Math.max(0,Math.min(100,40+7*(L.lvl|0)+(bayHas(L,"sloppy")?-10:0)+u+bud.q));}
const bayFail=(q,L)=>Math.max(0.02,Math.min(0.3,0.34-q*0.0034))*(bayHas(L,"perfect")?0.5:1);
const bayPayK=(q,L)=>0.95+q*0.0015+(bayHas(L,"closer")?0.03:0);
function bayPlan(k,b,bud){const L=bayS().b[b.id].lead,seg=SEGMENTS.find(s=>s.id===k.seg)||{tier:0},tier=seg.tier;
  let w=Math.max(1,Math.min(6,Math.round(1+(tier+0.5*k.units)*0.7)));if(L.lvl>=4)w=Math.max(1,w-1);if(bayHas(L,"speedy")&&w>=3)w--;
  const q=bayQ(L,bud),cost=Math.round(k.price*k.units*bud.cost*(bayHas(L,"thrifty")?0.94:1)/10)*10,pay=Math.round(k.price*k.units*priceBoost()*bayPayK(q,L)/10)*10,run=w*(b.run+bayWage(b,L));
  return{tier,w,q,cost,pay,run,net:pay-cost-run,fail:bayFail(q,L)};}
function bayTake(k){C().inbox=(C().inbox||[]).filter(x=>x.id!==k.id);if(C().offers&&C().offers.byCat)for(const c in C().offers.byCat)C().offers.byCat[c]=C().offers.byCat[c].filter(x=>x.id!==k.id);}
function bayStart(b,k,bud){const B=bayS().b[b.id],L=B.lead;if(!L||B.job)return false;const p=bayPlan(k,b,bud);
  if(C().cash<p.cost){toast(`Need ${fmt$(p.cost-C().cash)} more for the parts`);return false;}
  C().cash-=p.cost;bayTake(k);B.job={id:k.id,name:k.name,client:k.client,seg:k.seg,tier:p.tier,units:k.units,bud:bud.id,weeks:p.w,left:p.w,cost:p.cost,pay:p.pay,q:p.q,start:C().week,rw:0,rep:!!k.repeat};
  logEvent(`${b.nm}: ${L.nm} started ${k.units} × ${k.name} for ${k.client} — ${bud.n.toLowerCase()} budget, ${fmt$(p.cost)} in parts, ${p.w} week${p.w>1?"s":""}`,"");return true;}
function bayDeliver(b,B,pen){const j=B.job,L=B.lead;let pay=j.pay;if(pen)pay=Math.round(pay*0.55/10)*10;
  const gain=Math.max(1,Math.round(repFor(j.tier,j.units,{ok:true,m:1},0,j.rep)*0.8))-(pen?3:0),net=pay-j.cost-(j.extra||0);
  C().cash+=pay;C().profit+=net;C().sold+=j.units;C().rep=Math.max(0,C().rep+gain);const h=bayS().hist;h.jobs++;h.profit+=net;if(pen)h.fail++;
  if(L){L.xp=(L.xp||0)+25+12*j.tier;while(L.lvl<5&&L.xp>=CREW_XP[L.lvl]){L.lvl++;logEvent(`${L.nm} (${b.nm} lead) made level ${L.lvl}`,"good");}}
  logEvent(`${b.nm} delivered ${j.units} × ${j.name} to ${j.client} — ${pen?"QC penalty, paid 55%: ":""}${fmt$(pay)} in, ${fmt$(net)} after parts, ${gain>=0?"+":""}${gain} rep`,pen?"bad":"good");B.job=null;}
function bayWeek(){if(!career())return;const own=BAYS.filter(b=>has(b.id));if(!own.length)return;let run=0;
  for(const b of own){const B=bayS().b[b.id],L=B.lead;if(!L)continue;run+=b.run+bayWage(b,L);
    const j=B.job;if(!j)continue;if(--j.left>0)continue;
    if(!j.rw&&bayRnd()<bayFail(j.q,L)){
      if(bayRnd()<0.65){j.rw=1;j.left=Math.max(1,Math.ceil(j.weeks/3));const x=Math.round(j.cost*0.15/10)*10;j.extra=x;C().cash-=x;bayS().hist.fail++;
        logEvent(`${b.nm}: ${j.name} failed QC — rework ${j.left} more week${j.left>1?"s":""}, ${fmt$(x)} in parts`,"bad");}
      else bayDeliver(b,B,true);}
    else bayDeliver(b,B,false);}
  if(run){C().cash-=run;logEvent(`Bays: running costs and lead wages ${fmt$(run)}`,"");}}
function bayCost(){let t=0;for(const b of BAYS)if(has(b.id)){const L=bayS().b[b.id].lead;if(L)t+=b.run+bayWage(b,L);}return t;}
let bayPick=null;
function bayOffers(){const l=(C().inbox||[]).filter(k=>k.expires>=C().week).slice();for(const c of CATS)if(catOpen(c))for(const k of offersFor(c.id))l.push(k);return l;}
const bayIni=n=>String(n).split(" ").map(w=>w[0]||"").join("").slice(0,2).toUpperCase();
function bayRender(){const box=$("bayBox"),sec=$("baySec");if(!box||!sec)return;const own=career()?BAYS.filter(b=>has(b.id)):[];
  sec.hidden=!career()||(!own.length&&C().rep<300);if(sec.hidden)return;const S_=bayS();
  if(!own.length){box.innerHTML=`<p class="hint">Extra build bays (Bay C, Bay D) are in the Shop. Staff one with a bay lead and it builds market contracts in the background while you work.</p>`;$("bayCnt").textContent="";return;}
  const run=bayCost(),busy=own.filter(b=>S_.b[b.id].job).length;$("bayCnt").textContent=run?`${fmt$(run)}/wk`:"";
  const card=b=>{const B=S_.b[b.id],L=B.lead,j=B.job;let h=`<div class="up bayc crew"><div class="bayh"><h3>${b.nm}</h3><span class="bst ${j?"busy":L?"idle":"empty"}">${j?"BUSY":L?"IDLE":"NO LEAD"}</span></div>`;
    if(!L){const a=bayNew(b.id);h+=`<div class="cwho"><i class="cav off" style="--cc:var(--info)">${bayIni(a.nm)}</i><div><p class="csub">Applicant: <b>${ddEsc(a.nm)}</b> · bay lead, level 1</p><p class="csub">${a.tr.length?a.tr.map(t=>bayTr(t).n).join(" · "):"No standout traits"}</p></div></div>
      <button class="btn sm pri" data-bayhire="${b.id}">Hire bay lead · ${fmt$(bayWage(b,a))}/wk</button><p class="hint">Running cost ${fmt$(b.run)}/wk once staffed.</p>`;}
    else{const nx=L.lvl<5?CREW_XP[L.lvl]:null,pv=CREW_XP[L.lvl-1],pct=nx?Math.max(0,Math.min(100,Math.round(100*(L.xp-pv)/(nx-pv)))):100;
      h+=`<div class="cwho"><i class="cav" style="--cc:var(--info)">${bayIni(L.nm)}</i><div><p class="csub"><b>${ddEsc(L.nm)}</b> · bay lead · <span class="clv">LV ${L.lvl}</span></p>
        <div class="cbar" title="${Math.floor(L.xp)} XP"><i style="width:${pct}%"></i></div>${L.tr.length?`<div class="ctrs">${L.tr.map(t=>{const T=bayTr(t);return `<span class="ctr ${T.pos?"pos":"neg"}" title="${T.d}">${T.n}</span>`;}).join("")}</div>`:""}</div></div>
        <p class="csub">${fmt$(b.run)} running + ${fmt$(bayWage(b,L))} wage a week</p>`;
      if(j){const done=j.weeks+(j.rw?Math.max(1,Math.ceil(j.weeks/3)):0),pc=Math.round(100*(done-j.left)/done);
        h+=`<div class="bayj"><b>${j.units} × ${ddEsc(j.name)}</b><span>${ddEsc(j.client)} · ${(BAY_BUD.find(x=>x.id===j.bud)||{}).n} budget${j.rw?" · <em>rework</em>":""}</span>
          <div class="bar"><i style="width:${pc}%"></i></div><span>${done-j.left} / ${done} wk · delivers week ${C().week+j.left} · pays ${fmt$(j.pay)} · quality ${j.q}</span></div>`;}
      else h+=`<div class="bayb2"><button class="btn sm ${bayPick===b.id?"":"pri"}" data-baypick="${b.id}">${bayPick===b.id?"Close contract list":"Assign a contract"}</button><button class="btn sm danger" data-bayfire="${b.id}">Release lead</button></div>`;
      if(bayPick===b.id&&!j){const offs=bayOffers().sort((x,y)=>bayPlan(y,b,BAY_BUD[1]).net-bayPlan(x,b,BAY_BUD[1]).net);h+=`<div class="baypk">${offs.length?offs.map(k=>{const bp=BAY_BUD.map(u=>[u,bayPlan(k,b,u)]);
          return `<div class="bayo"><b>${ddEsc(k.name)}</b><span>${ddEsc(k.client)} · ${k.units} × ${fmt$(k.price)} · ${bp[1][1].w} wk</span><div class="bayb">${bp.map(([u,p])=>`<button class="btn sm ${u.id==="std"&&p.net>0?"pri":""}" data-bayjob="${k.id}" data-bay="${b.id}" data-bud="${u.id}"${C().cash<p.cost?" disabled":""}>${u.n}<small>parts ${fmt$(p.cost)} · net ${p.net<0?"−":""}${fmt$(Math.abs(p.net))} · QC fail ${Math.round(p.fail*100)}%</small></button>`).join("")}</div></div>`;}).join(""):`<p class="hint">No offers on the board. Come back next week.</p>`}</div>`;}}
    return h+`</div>`;};
  box.innerHTML=`<p class="hint">${busy} of ${own.length} bay${own.length>1?"s":""} building · lifetime ${S_.hist.jobs} job${S_.hist.jobs===1?"":"s"}, ${fmt$(S_.hist.profit)} after parts, ${S_.hist.fail} QC problem${S_.hist.fail===1?"":"s"}. Net = pay − parts − the bay's running cost over the job. Quality (lead level, traits, shop upgrades, budget) sets the pay and the QC risk.</p>`+own.map(card).join("");}
$("bayBox").addEventListener("click",e=>{if(!career())return;const t=e.target.closest("button");if(!t||t.disabled)return;const d=t.dataset;
  if(d.bayhire){const b=BAYS.find(x=>x.id===d.bayhire),B=bayS().b[b.id];if(!b||B.lead)return;const a=bayNew(b.id);B.lead=a;delete bayS().cand[b.id];logEvent(`${a.nm} is the new ${b.nm} lead — ${fmt$(bayWage(b,a))}/week`,"");}
  else if(d.bayfire){const B=bayS().b[d.bayfire];if(!B||B.job)return;B.lead=null;if(bayPick===d.bayfire)bayPick=null;}
  else if(d.baypick){bayPick=bayPick===d.baypick?null:d.baypick;}
  else if(d.bayjob){const b=BAYS.find(x=>x.id===d.bay),u=BAY_BUD.find(x=>x.id===d.bud),k=bayOffers().find(x=>x.id==d.bayjob);if(!b||!u||!k||!bayStart(b,k,u))return;bayPick=null;toast(`${b.nm.toUpperCase()} · JOB STARTED`);buzz(20);}
  else return;save();hud();renderShop();});
