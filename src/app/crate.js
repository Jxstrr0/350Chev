/* ===================== CRATE ENGINES (career, since 1.76.85.0) =====================
   Side income: list the certified engine as a crate engine and a few buyers order one each week, built in the
   quiet hours, with no team or round needed. One listing at a time; listing another replaces it. Demand and the
   margin both grow with how good the engine is (power for the shop's level, reliability) and with the shop's rep,
   and the money is pitched at about 10-20% of what a season with a team in the shop's top open series pays
   (a weak build sells less, a strong one more).
     level    the highest tier of team series the shop's rep has opened (PC_EVENTS); its pay sets the money
     power    peak hp against CRATE_HP for that tier (30% of it sells nothing on power, 110% is as good as it gets)
     reliab.  CRATE_REL: 65% reliability sells nothing on it, 95% is as good as it gets
   q = 0.45 power + 0.55 reliability. Sales each week are a Poisson draw on (1.2 + 1.8 q) times a little more as rep
   climbs toward the next tier; each pays a margin of CRATE_K of the season fee / 16 / 4.2 times (0.6 + 0.8 q).
   State: C().crate = {l: the listing or null, n: engines sold, $: money made}. */
const CRATE_HP=[400,800,1300,2100,3000,4200];   // the power a crate buyer wants at each tier
const CRATE_REL=[65,95],CRATE_K=0.22,CRATE_MAX=6;
function crS(){const c=C();const s=c.crate&&typeof c.crate==="object"?c.crate:(c.crate={l:null,n:0,$:0});
  if(s.l&&typeof s.l!=="object")s.l=null;s.n=+s.n||0;s.$=+s.$||0;return s;}
/* the shop's level: the top tier its rep has opened, that tier's season pay (the middle of the range), and how far rep is toward the next */
function crLevel(){const rep=C().rep;let tier=0,pay=0;
  for(const k in PC_EVENTS){const E=PC_EVENTS[k];if(rep>=E.rep&&E.tier>=tier){const p=(E.pay[0]+E.pay[1])/2;if(E.tier>tier)pay=0;tier=E.tier;pay=Math.max(pay,p);}}
  let lo=0,hi=Infinity;for(const k in PC_EVENTS){const E=PC_EVENTS[k];if(E.tier===tier)lo=Math.max(lo,E.rep);if(E.tier===tier+1)hi=Math.min(hi,E.rep);}
  return{tier,pay,up:hi===Infinity?1:Math.max(0,Math.min(1,(rep-lo)/(hi-lo)))};}
const crClamp=v=>Math.max(0,Math.min(1,v));
/* what a build would do as a crate engine at the shop's level today */
function crRate(hp,rel){const L=crLevel(),ps=crClamp((hp/CRATE_HP[Math.min(L.tier,CRATE_HP.length-1)]-0.3)/0.8),rs=crClamp((rel-CRATE_REL[0])/(CRATE_REL[1]-CRATE_REL[0])),q=0.45*ps+0.55*rs;
  const lam=(1.2+1.8*q)*(0.85+0.15*L.up),profit=Math.max(50,Math.round(L.pay*CRATE_K/16/4.2*(0.6+0.8*q)/50)*50);
  return{q,ps,rs,lam,profit,L};}
const crWord=q=>q<0.35?"a hard sell":q<0.65?"a steady seller":"a hot seller";
/* the certified engine, if it can be listed: certified OK and still the build on the bench */
function crCert(){const c=C().cert;return c&&c.ok&&c.res&&c.hash===cfgHash(S.cfg)?c:null;}
function crList(){const c=crCert();if(!c)return false;const s=crS();
  s.l={name:engineName(),hash:c.hash,hp:Math.round(c.res.peakHp),rel:+(c.res.rel||0).toFixed(1),cost:Math.round(c.res.cost||0),wk:C().week,n:0,$:0};
  logEvent(`Crate engines: listed the ${s.l.name} (${s.l.hp} hp, ${s.l.rel}% reliability)`,"");return true;}
function crPoisson(l){let k=0,p=Math.exp(-l),t=Math.random();while(t>p&&k<CRATE_MAX){t-=p;k++;p*=l/k;}return k;}
/* Close week: the week's orders */
function crateWeek(){const s=crS(),l=s.l;if(!l)return;const r=crRate(l.hp,l.rel),n=crPoisson(r.lam);if(!n)return;
  const m=n*r.profit;C().cash+=m;s.n+=n;s.$+=m;l.n+=n;l.$+=m;
  logEvent(`Crate engines: sold ${n} ${l.name}${n>1?"s":""} at ${fmt$(r.profit)} each, ${fmt$(m)}`,"good");}
function crateRender(){let sec=$("crateSec");
  if(!career()){if(sec)sec.hidden=true;return;}
  if(!sec){const anchor=$("mkTeam");if(!anchor)return;sec=document.createElement("div");sec.className="sec";sec.id="crateSec";
    sec.innerHTML=`<h2>Crate engines <span class="cnt" id="crateCnt"></span></h2><p class="hint" id="crateHint"></p><div id="crateBox"></div>`;anchor.appendChild(sec);}
  sec.hidden=false;const s=crS(),l=s.l,c=crCert();
  $("crateCnt").textContent=s.n?`${s.n} sold · ${fmt$(s.$)}`:"";
  $("crateHint").textContent="Side money: list a certified engine and a few buyers order one each week, no team needed. Better power for your level, better reliability and more rep sell more, at a better margin.";
  const card=(name,hp,rel,cost,mine)=>{const r=crRate(hp,rel),lo=Math.max(0,Math.floor(r.lam-1)),hi=Math.ceil(r.lam+0.5);
    return`<p class="mkline"><span><b>${hp.toLocaleString()}</b> hp</span><span><b>${rel}%</b> reliability</span><span>Parts <b>${fmt$(cost)}</b></span><span>Sells for <b>${fmt$(cost+r.profit)}</b></span></p>
      <p class="hint">${mine?"It's":"It would be"} ${crWord(r.q)}: about ${lo===hi?lo:`${lo}–${hi}`} a week at ${fmt$(r.profit)} each to you${r.ps<0.5?`. Buyers at your level want more power (${CRATE_HP[Math.min(r.L.tier,CRATE_HP.length-1)].toLocaleString()} hp is the mark)`:""}${r.rs<0.5?`. Buyers want it to last: ${CRATE_REL[1]}% reliability sells best`:""}.</p>`;};
  let h="";
  if(l)h+=`<div class="card"><h3>${esc(l.name)}<span>listed wk ${l.wk}</span></h3>${card(l.name,l.hp,l.rel,l.cost,true)}
    <p class="hint">${l.n?`${l.n} sold so far, ${fmt$(l.$)}.`:"No orders yet."}</p><button class="btn sm ghost" data-crate="stop">Stop selling it</button></div>`;
  if(c&&(!l||l.hash!==c.hash))h+=`<div class="card"><h3>${esc(engineName())}<span>certified</span></h3>${card(engineName(),Math.round(c.res.peakHp),+(c.res.rel||0).toFixed(1),Math.round(c.res.cost||0),false)}
    <button class="btn sm pri" data-crate="list">${l?"List this one instead":"List it as a crate engine"}</button></div>`;
  else if(!l)h+=`<p class="hint">${C().cert&&C().cert.ok?"The engine on the bench isn't the certified one: certify it on the dyno to list it.":"Certify an engine on the dyno (a clean power pull) to list it."}</p>`;
  $("crateBox").innerHTML=h;}
document.addEventListener("click",e=>{const b=e.target.closest("[data-crate]");if(!b||!career())return;const s=crS();
  if(b.dataset.crate==="list"){if(s.l&&!confirm(`Stop selling the ${s.l.name} and list this one?`))return;if(crList()){toast("LISTED · CRATE ENGINE");buzz(20);}}
  else if(b.dataset.crate==="stop"){if(!s.l||!confirm(`Stop selling the ${s.l.name}?`))return;logEvent(`Crate engines: stopped selling the ${s.l.name}`,"");s.l=null;}
  save();renderShop();});
