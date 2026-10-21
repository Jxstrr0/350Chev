/* ============================ LEGACY (career only) ============================
   At Legend rep the owner can sell the shop. The sale value (cash + half the price of every upgrade and prestige item,
   less any loan) becomes Legacy points in a record kept under its own localStorage key, so it outlives every new career
   and every wipe. Points buy permanent perks; the new run starts from a Legacy screen where they are bought and applied.
   Hooks elsewhere: save() -> lgSync, hud() -> lgHud, shopBonus() -> lgCostK, crewPerson() -> lgCrewLv, renderShop() ->
   renderLegacy, boot() -> lgBoot, the two "start over" buttons -> lgApply. Nothing here touches the simulation. */
const LG_KEY="pew2-legacy",LG_PTS_PER=25000,LG_NEED_TIER=5;
const LG_PERKS=[
  {id:"cash",name:"Seed money",desc:"Every new career opens with more cash.",tiers:[[3,"+$5,000"],[6,"+$12,000"],[12,"+$25,000"]],val:[5000,12000,25000]},
  {id:"rep",name:"Name recognition",desc:"Reputation gains from every source run higher.",tiers:[[4,"+10% rep"],[8,"+20% rep"],[14,"+30% rep"]],val:[.1,.2,.3]},
  {id:"parts",name:"Supplier terms",desc:"Cheaper parts: unit cost on every build.",tiers:[[4,"−3% cost"],[8,"−6% cost"],[14,"−10% cost"]],val:[.03,.06,.1]},
  {id:"crew",name:"Seasoned hands",desc:"Every hire walks in at level 2.",tiers:[[6,"hires start at Lv 2"]],val:[2]},
  {id:"upg",name:"Heirloom equipment",desc:"One starter upgrade is already installed in each new shop.",tiers:[[10,"keep one upgrade"]],pick:"upg"},
  {id:"rnd",name:"Old blueprints",desc:"One R&D unlock (parts, blocks, heads) is already researched.",tiers:[[5,"keep one unlock"]],pick:"rnd"},
  {id:"spons",name:"Sponsor pull",desc:"Sponsors come to the table with bigger retainers and bonuses.",tiers:[[4,"+10% sponsor money"],[8,"+20% sponsor money"],[14,"+35% sponsor money"]],val:[.1,.2,.35]},
  {id:"lease",name:"Lease terms",desc:"Cheaper plant: the weekly overhead on every upgrade runs lower.",tiers:[[4,"−5% overhead"],[8,"−10% overhead"],[12,"−15% overhead"]],val:[.05,.1,.15]},
  {id:"bank",name:"Good credit",desc:"The bank charges less interest on the credit line.",tiers:[[3,"1.5% a week"],[6,"1.0% a week"]],val:[.015,.01]}
];
let LG=null;
function lgBlank(){return{v:1,pts:0,total:0,resets:0,best:{cash:0,rep:0,hp:0,sold:0,week:0,value:0},perk:{},pick:{},pending:false};}
function lgRec(){if(LG)return LG;let o=null;try{const j=localStorage.getItem(LG_KEY);if(j)o=JSON.parse(j);}catch(e){}
  LG=Object.assign(lgBlank(),o&&typeof o==="object"?o:{});LG.best=Object.assign(lgBlank().best,LG.best||{});if(!LG.perk||typeof LG.perk!=="object")LG.perk={};if(!LG.pick||typeof LG.pick!=="object")LG.pick={};return LG;}
function lgSave(){try{localStorage.setItem(LG_KEY,JSON.stringify(lgRec()));}catch(e){}}
function lgTier(id){return Math.max(0,Math.min(3,lgRec().perk[id]|0));}
function lgPerk(id){return LG_PERKS.find(p=>p.id===id);}
function lgVal(id){const t=lgTier(id),p=lgPerk(id);return t&&p.val?p.val[t-1]:0;}
function lgCostK(){return 1-lgVal("parts");}
function lgLoanRate(){return lgVal("bank")||LOAN_RATE;}      // state.js loanRate(): the perk's weekly rate, else the bank's
function lgLeaseK(){return 1-lgVal("lease");}                  // market.js overhead(): factor on the plant part of the weekly overhead
function lgCrewLv(){return career()&&lgTier("crew")?2:1;}
function lgUpgOpts(){return UPGRADES.filter(u=>!u.needs);}
function lgRndOpts(){return RND.filter(r=>r.unlock);}
/* rep bonus: whatever rep arrived since the last save is topped up by the perk %, carrying the fraction */
function lgSync(){if(!career())return;const c=C();if(c.lgRep==null){c.lgRep=c.rep;return;}const d=c.rep-c.lgRep,pct=lgVal("rep");
  if(d>0&&pct){const f=(c.lgFrac||0)+d*pct,w=Math.floor(f);c.lgFrac=f-w;c.rep+=w;}c.lgRep=c.rep;}
function lgSaleValue(){const c=C();let up=0,pr=0;for(const u of UPGRADES)if(c.owned[u.id])up+=u.price;for(const p of PRESTIGE)if(c.prestige&&c.prestige[p.id])pr+=p.price;
  const loan=c.loan||0,v=Math.max(0,Math.round(c.cash-loan+up*.5+pr*.5));return{cash:c.cash,loan,up:Math.round(up*.5),pr:Math.round(pr*.5),value:v,pts:Math.max(1,Math.floor(v/LG_PTS_PER))};}
function lgHud(){const b=$("lgBadge");if(!b)return;const n=lgRec().resets;b.hidden=!(career()&&n>0);if(!b.hidden)b.textContent="Legacy "+n;}
function lgApply(){const c=C(),r=lgRec();c.cash+=lgVal("cash");c.lgRep=0;
  if(lgTier("upg")&&r.pick.upg&&lgUpgOpts().some(u=>u.id===r.pick.upg))c.owned[r.pick.upg]=true;
  if(lgTier("rnd")){const x=lgRndOpts().find(q=>q.id===r.pick.rnd);if(x){c.rnd[x.id]=1;for(const u of x.unlock)c.unlocks[u]=true;}}
  if(typeof syncShop==="function")syncShop();}
function lgSell(){if(!career())return;if(typeof testing!=="undefined"&&testing){toast("Let the run finish first");return;}
  const v=lgSaleValue(),r=lgRec();
  if(!confirm(`Sell the shop?\n\nCash ${fmt$(v.cash)}${v.loan?`, loan −${fmt$(v.loan)}`:""}\nUpgrades (half price) ${fmt$(v.up)}\nPrestige (half price) ${fmt$(v.pr)}\nSale value ${fmt$(v.value)}\n\n= ${v.pts} Legacy point${v.pts===1?"":"s"} (you have ${r.pts}).\nYour career restarts at week 1. Blueprints and Legacy perks are kept.`))return;
  const c=C(),b=r.best;r.pts+=v.pts;r.total+=v.pts;r.resets++;b.cash=Math.max(b.cash,c.cash);b.rep=Math.max(b.rep,c.rep);b.hp=Math.max(b.hp,c.bestHp||0);b.sold=Math.max(b.sold,c.sold||0);b.week=Math.max(b.week,c.week||0);b.value=Math.max(b.value,v.value);
  r.pending=true;lgSave();lgOpen();lgHud();}
function lgStart(){const r=lgRec();r.pending=false;lgSave();lgClose();S.career=freshCareer();lgApply();benchUnlock();save();boot();toast(`Legacy ${r.resets}. New shop, new name.`);}
function lgBuy(id){const r=lgRec(),p=lgPerk(id),t=lgTier(id);if(!p||t>=p.tiers.length)return;const cost=p.tiers[t][0];if(r.pts<cost)return;r.pts-=cost;r.perk[id]=t+1;
  if(p.pick==="upg"&&!r.pick.upg)r.pick.upg=lgUpgOpts()[0].id;if(p.pick==="rnd"&&!r.pick.rnd)r.pick.rnd=lgRndOpts()[0].id;lgSave();lgDraw();}
function lgBodyHtml(buy){const r=lgRec(),b=r.best;
  return `<div class="lgstats"><div><b>${r.pts}</b><span>points</span></div><div><b>${r.resets}</b><span>sold</span></div><div><b>${fmt$(b.value)}</b><span>best sale</span></div><div><b>${b.rep}</b><span>best rep</span></div><div><b>${b.hp.toLocaleString()}</b><span>best hp</span></div></div>`
  +LG_PERKS.map(p=>{const t=lgTier(p.id),max=t>=p.tiers.length,nx=max?null:p.tiers[t];
    const sel=p.pick&&t?`<select class="lgsel" data-lgpick="${p.pick}" aria-label="${p.name}">${(p.pick==="upg"?lgUpgOpts():lgRndOpts()).map(o=>`<option value="${o.id}" ${r.pick[p.pick]===o.id?"selected":""}>${o.name}</option>`).join("")}</select>`:"";
    return `<div class="up lgperk ${max?"owned":""}"><div><h3>${p.name} <small>${t?p.tiers[t-1][1]:"not owned"}${p.tiers.length>1?` · ${t}/${p.tiers.length}`:""}</small></h3><p>${p.desc}${nx&&t?` Next: ${nx[1]}.`:""}</p>${sel}</div>${max?`<div class="price">Max</div>`:buy?`<button class="btn sm ${r.pts>=nx[0]?"pri":""}" data-lgbuy="${p.id}" ${r.pts<nx[0]?"disabled":""}>${nx[0]} pt${nx[0]===1?"":"s"}</button>`:`<div class="price">${nx[0]} pts</div>`}</div>`;}).join("");}
function lgDraw(){const o=$("lgOver");if(!o)return;o.querySelector(".lgbody").innerHTML=lgBodyHtml(true);}
function lgOpen(){let o=$("lgOver");if(!o){o=document.createElement("div");o.id="lgOver";o.setAttribute("role","dialog");o.setAttribute("aria-modal","true");o.setAttribute("aria-label","Legacy");
    o.innerHTML=`<div class="lgcard"><h2>Legacy <span id="lgN"></span></h2><p class="hint">The shop is sold. Spend points on permanent perks, then open the doors on a new one.</p><div class="lgbody"></div><button class="btn pri lgstart" id="lgStart">Start new run</button></div>`;
    o.addEventListener("click",e=>{const b=e.target.closest("[data-lgbuy]");if(b)lgBuy(b.dataset.lgbuy);if(e.target.closest("#lgStart"))lgStart();});
    o.addEventListener("change",e=>{const s=e.target.closest("[data-lgpick]");if(!s)return;lgRec().pick[s.dataset.lgpick]=s.value;lgSave();});
    document.body.appendChild(o);}
  $("lgN").textContent=lgRec().resets;lgDraw();o.style.display="flex";o.querySelector(".lgcard").scrollTop=0;}
function lgClose(){const o=$("lgOver");if(o)o.style.display="none";}
function lgBoot(){lgHud();if(lgRec().pending&&career())lgOpen();else lgClose();}
function renderLegacy(){const el=$("legacyBox");if(!el)return;const r=lgRec(),legend=career()&&repTierIdx()>=LG_NEED_TIER;
  el.style.display=career()&&(legend||r.resets>0||r.pts>0)?"":"none";if(el.style.display==="none")return;
  const v=legend?lgSaleValue():null;
  el.innerHTML=`<details class="sfold"><summary>Legacy <span class="cnt">${r.resets?`N${r.resets} · `:""}${r.pts} pts</span></summary><div class="sfb">${lgBodyHtml(false)}
    ${legend?`<p class="hint" style="margin:10px 0">Legend rep reached. Selling the shop now is worth <b>${fmt$(v.value)}</b> = <b>${v.pts}</b> Legacy point${v.pts===1?"":"s"}.</p><button class="btn danger" id="lgSell" style="width:100%">Sell the shop</button>`:`<p class="hint" style="margin:10px 0">Reach Legend rep to sell the shop for more Legacy points.</p>`}</div></details>`;
  const s=$("lgSell");if(s)s.addEventListener("click",lgSell);}
