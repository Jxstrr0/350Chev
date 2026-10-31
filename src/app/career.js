/* ===================== CAREER: the week, sponsors, the shop and goals =====================
   The career shop builds engines for race teams (app/team.js: one team a season, a round every other week) and races its own
   engines at the events for purses and rep. Close week charges overhead and wages, runs a team round that is due, pays
   sponsors, moves R&D on and checks the goals. Selling engines to buyers, contracts, warranty, cores, build bays and
   Dyno day were removed in 1.76.33: careers from before that start over (app/state.js hydrate). */
const degC=t=>`${t<0?"−"+(-t):t} °C`;
/* weekly overhead: $500, plus 2% of what the plant you own cost (some late plant counts less, u.oh), plus wages */
function overhead(){const plant=UPGRADES.reduce((a,u)=>a+(C().owned[u.id]?u.price*(u.oh||1):0),0);return 500+Math.round(plant*0.02*(typeof lgLeaseK==="function"?lgLeaseK():1)/10)*10+wages();}
function rndNeed(r){return r.mach&&staffed("machinist")?Math.ceil(r.weeks*(0.75-0.025*crewL("machinist"))):r.weeks;}   // machinist: machining projects 25% shorter
function rndPass(){const a=C().rndActive;if(!a)return;const r=RND.find(x=>x.id===a.id);if(!r)return;a.done+=1;
  if(a.done>=rndNeed(r)){C().rnd[r.id]=C().week;C().rndActive=null;crewWork("rnd",{r});if(r.unlock)for(const u of r.unlock)C().unlocks[u]=true;syncShop();C().rep+=8;logEvent(`R&D complete: ${r.name} — ${r.desc.split(".")[1]||r.desc}`,"good");toast(`R&D COMPLETE · ${r.name.toUpperCase()}`);renderBuild();renderPresets();recompute();}}
function prestigePass(){let rp=has("hall")&&career()?5:0;for(const p of PRESTIGE)if(C().prestige[p.id])rp+=p.rep;if(rp){C().rep+=rp;}}
function logEvent(t,kind){C().log.unshift({w:C().week,t,k:kind||""});if(C().log.length>16)C().log.length=16;}
/* Close week: a team round due this week runs first (with the season engine as it stands), then the week turns over */
function advanceWeek(){const rd=pcWeek();C().week++;ENGINE_VIS.setMood(C().week);const oh=overhead();C().cash-=oh;let t=`Overhead ${fmt$(oh)}`;
  t+=loanWeek();
  if(wages())t+=` (wages ${fmt$(wages())})`;
  logEvent(t,"");crewWeek();rndPass();prestigePass();spWeek();rivalsWeek();pcWeekAfter();checkGoals();achCheck({type:"week"});
  {const so=spS().offers.length;const msg=[rd||"",so?`${so} sponsor offer${so>1?"s":""} in Team`:""].filter(Boolean).join(" · ");if(msg)toastAfter(msg);}
  if(C().cash<FORECLOSE_AT)logEvent("The bank has called the loan. The shop is in receivership.","bad");
  else if(C().cash<-5000)toast("The bank is calling. Win something.");}
/* ===================== SPONSORS (career) =====================
   Made-up brands approach the shop on reputation and results: race nights, pulls, the salt, team results. An offer pays a
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
const SP_LIKES={oil:["night","pull","salt","endurance","boat","oval","team"],parts:["team","night","salt","road"],feed:["pull","bog","oval"],tyre:["night","drag","endurance","bog","hill","road","oval"],energy:["night","drag","salt","hill","road"],fuel:["salt","night","endurance","boat","hill","road","team"]};
const SP_OBL={oil:["nights","pulls"],parts:["rounds"],feed:["pulls"],tyre:["nights"],energy:["nights","nodiesel"],fuel:["salt","nodiesel"]};
const SP_OBL_TXT={nights:n=>`Run at least ${n} race night${n>1?"s":""}`,pulls:n=>`Enter at least ${n} truck pull${n>1?"s":""}`,salt:n=>`Make at least ${n} run${n>1?"s":""} on the salt`,
  rounds:n=>`Supply your team for at least ${n} round${n>1?"s":""}`,nodiesel:()=>"No diesel builds at the track",rep:n=>`Keep reputation at ${n} or better`};
const SP_SLOT_REP=[0,120,300];
const SP_EVT={hill:"Pikes Peak",boat:"the boat drags",bog:"the mud bog",endurance:"the 24 Hours",night:"a race night",pull:"the pull",salt:"the salt",drag:"the strip",team:"your team's results",oval:"the oval",road:"the track day"};
/* an obligation the shop can actually meet: a brand never asks for race nights before the Outlaw shop opens the strip, pulls before
   a pull class is open, or salt runs before the salt is open — the same gates the rivals use (rivEvOpen). rounds/nodiesel always fit */
function spOblOpen(k){try{if(k==="nights")return evStatus("drag").k!=="lock";if(k==="pulls")return Object.keys(SIM.PULL_CLASSES).some(c=>!pullClsLocked(c));if(k==="salt")return evStatus("salt").k!=="lock";}catch(e){return false;}return true;}
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
  const weeks=4+Math.floor(spRng()*5)+(tier>=3?2:0),scale=(1+tier*0.5+Math.min(1,C().rep/500))*(typeof lgVal==="function"?1+lgVal("spons"):1),style=spRng();
  const ret=style<0.25?0:spR10((100+spRng()*100)*scale*(style>0.75?1.5:1)),bm=style<0.25?2:style>0.75?0.5:1;
  const bon={win:spR50(250*scale*bm),finish:likes.some(k=>k==="night"||k==="pull"||k==="bog"||k==="boat"||k==="hill"||k==="oval")?spR50(80*scale*bm):0,record:likes.some(k=>k==="salt"||k==="road")?spR50(800*scale*bm):0};
  const able=SP_OBL[b.type].filter(spOblOpen),pick=able.length?able[Math.floor(spRng()*able.length)]:null;
  const n=pick?{nights:Math.max(1,Math.round(weeks/4)),pulls:Math.max(1,Math.round(weeks/4)),salt:1+(weeks>=7?1:0),rounds:Math.max(1,Math.round(weeks/3))}[pick]:0;
  const obl=pick?[{k:pick,n:n||0}]:[];if(!pick||(C().rep>=10&&spRng()<0.5))obl.push({k:"rep",n:Math.max(5,Math.floor(C().rep*0.85))});
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
  if(s.offers.length<3&&(C().rep>=10||tot>0.5)&&spRng()<0.22+0.08*repTierIdx()+Math.min(0.4,tot*0.08)){const o=spGen(null);if(o)logEvent(`${spBrand(o.b).name} (${SP_TYPES[spBrand(o.b).type].toLowerCase()}) wants to sponsor the shop — see Team`,"good");}
  spLivery();}
/* a result: obligations count, bans bite, bonuses pay, and a good night can bring a brand to the pits */
function spEvent(kind,o){if(!career()||ff)return;crewWork(kind,o);const s=spS();o=o||{};rivalsEvent(kind,o);dwinCount(kind,o);s.form[kind]=(s.form[kind]||0)+(o.win||o.record?2:1);
  if(kind!=="team"&&spDiesel())for(const a of s.active.slice())if(a.obl.some(q=>q.k==="nodiesel"))spBreak(a,"you ran a diesel at the track");
  const cnt={night:"nights",pull:"pulls",salt:"salt",team:"rounds"}[kind];
  if(cnt&&!o.noCount)for(const a of s.active)for(const q of a.obl)if(q.k===cnt)q.have=(q.have||0)+1;
  const t=o.record?"record":o.win?"win":o.finish?"finish":null,got=[];let sum=0;
  if(t)for(const a of s.active){const v=a.bon&&a.bon[t];if(v){C().cash+=v;a.earned+=v;s.hist.earned+=v;sum+=v;got.push(`${spBrand(a.b).name} ${fmt$(v)}`);}}
  if(got.length){logEvent(`Sponsor bonus (${t==="finish"?"top-3 finish":t}): ${got.join(", ")}`,"good");setTimeout(()=>toast(`SPONSOR BONUS · +${fmt$(sum)}`),3400);}
  if(t&&s.offers.length<3&&spRng()<(t==="record"?0.7:t==="win"?0.45:0.2)){const of=spGen(kind);if(of)logEvent(`${spBrand(of.b).name} saw that and wants to talk — see Team`,"good");}
  spLivery();}
function spSign(id){const s=spS();const o=s.offers.find(x=>x.id==id);if(!o||s.active.length>=spSlots())return false;
  const a=Object.assign({},o,{w0:C().week,end:C().week+o.weeks,earned:0,obl:o.obl.map(q=>({k:q.k,n:q.n,have:0}))});delete a.exp;delete a.why;
  s.active.push(a);s.offers=s.offers.filter(x=>x!==o);s.hist.signed++;s.hist.max=Math.max(s.hist.max,s.active.length);if(!spPrimary()||s.active.length===1)s.primary=a.b;
  logEvent(`Signed with ${spBrand(a.b).name} for ${a.weeks} weeks${a.ret?" — "+fmt$(a.ret)+"/week":""}`,"good");spLivery();achCheck({type:"sponsor"});return true;}
const spLogoUrl=(()=>{const m={};return b=>m[b.id]||(m[b.id]=ENGINE_VIS.logoCanvas(b,512,192).toDataURL());})();
/* Team tab sections: Team | Sponsors & Rivals | Log. S.mkTab remembers the open one; an old save (jobs, shop) opens Team. */
const MK_TABS=["team","spons","log"];
function mkTabNow(){const t=S.mkTab;return MK_TABS.includes(t)?t:"team";}
function mkTabSet(tab,scroll){if(!MK_TABS.includes(tab))return;if(S.mkTab!==tab){S.mkTab=tab;save();}mkLayout();
  if(scroll){const pn=$("panel"),tb=$("mkTabs");if(pn&&tb){const d=tb.getBoundingClientRect().top-pn.getBoundingClientRect().top;if(d<0)pn.scrollTop=Math.max(0,pn.scrollTop+d-6);}}}
function mkLayout(){const box=$("marketBox"),tabs=$("mkTabs");if(!box||!tabs)return;const t=mkTabNow();box.dataset.mk=t;
  tabs.querySelectorAll("[data-mk]").forEach(b=>{const on=b.dataset.mk===t;b.classList.toggle("on",on);b.setAttribute("aria-selected",String(on));});
  if(!career())return;
  /* a dot on a tab that has something waiting: teams calling or a round due (Team), a sponsor offer or rival challenge */
  const so=spS().offers.filter(o=>o.exp>=C().week).length,rc=(typeof rivS==="function"&&rivS().ch)?1:0,tm=pcWaiting();
  const has={team:!!tm,spons:so+rc>0,log:false},why={team:tm,spons:`${so} sponsor offer${so===1?"":"s"}${rc?" · a rival challenge":""}`,log:""};
  tabs.querySelectorAll("[data-mk]").forEach(b=>{const k=b.dataset.mk;b.classList.toggle("has",has[k]);b.title=has[k]?why[k]:"";});}
$("mkTabs").addEventListener("click",e=>{const b=e.target.closest("[data-mk]");if(!b)return;mkTabSet(b.dataset.mk,true);buzz(4);});
/* a lesson, tour or tip pointing at something in a hidden Team section opens that section first */
function mkReveal(el){const p=el&&el.closest&&el.closest("#mkTeam,#mkSpons,#mkLog");if(!p)return;const t={mkTeam:"team",mkSpons:"spons",mkLog:"log"}[p.id];if(t&&mkTabNow()!==t)mkTabSet(t);}
/* the Team tab's badge: sponsor offers waiting, or a team round due this week */
function tabBadges(){const mk=$("mktDot");if(!mk)return;const on=career()&&!ff;
  const so=on?spS().offers.filter(o=>o.exp>=C().week).length:0,due=on&&pcDue()?1:0,n=so+due;
  if(n>0){mk.classList.add("n","on");mk.textContent=n;mk.title=[due?"A team round is due this week":"",so?`${so} sponsor offer${so===1?"":"s"} waiting`:""].filter(Boolean).join(" · ");}
  else if(mk.classList.contains("n")){mk.classList.remove("n");mk.textContent="";mk.title="";mk.classList.remove("on");}}
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
    <div class="spname"><b>${b.name}</b><span>${live?`week ${Math.min(o.weeks,C().week-o.w0+1)} of ${o.weeks}`:`${o.weeks} weeks · offer open till wk ${o.exp}${o.exp<=C().week?" · expires this week":""}`}</span></div></div></div>${!live&&o.why?`<p class="spfine">${o.why}</p>`:""}
    <div class="money spm">${cells.map(c=>`<div><b>${c[0]}</b><span>${c[1]}</span></div>`).join("")}</div><div class="spobl">${obl}</div>
    <p class="spfine">Break it: ${fmt$(o.pen)} and ${o.penRep} rep${live?` · earned ${fmt$(o.earned)} so far`:""}</p><div class="spbtns">${btns}</div></div>`;}
function spRender(){const box=$("spons");if(!box||!career())return;const s=spS(),slots=spSlots(),next=SP_SLOT_REP.find(r=>r>C().rep);
  $("sponCnt").textContent=`${s.active.length} / ${slots}`;
  $("sponHint").textContent=`${slots} slot${slots>1?"s":""}${next?` · another opens at ${next} rep`:""}`;$("sponHint").title="Brands notice shops that race and win: race nights, pulls, the salt (all on the Events tab) and your team's results. The primary sponsor goes on the hood, the rest on the sides.";
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
/* the Shop and Team tabs. Team: the strip (engine, team status, Close week), then Team | Sponsors & Rivals | Log */
function renderShop(){
  document.querySelectorAll("#modeBox button").forEach(b=>b.classList.toggle("on",b.dataset.mode===S.mode));
  $("careerBox").style.display=career()?"":"none";$("sandboxBox").style.display=career()?"none":"";renderDev();$("marketBox").style.display=career()?"":"none";$("marketSandbox").style.display=career()?"none":"";
  $("volLbl").textContent=S.vol+"%";$("vol").value=S.vol;renderSaves();
  spLivery();if(typeof renderLegacy==="function")renderLegacy();if(!career()){renderSbShop();return;}
  pcRender();spRender();rivalsRender();
  $("foreclose").style.display=C().cash<FORECLOSE_AT?"":"none";
  const dc=dynoCap();$("sStats").innerHTML=`<span>Dyno reads to <b>${dc.hp.toLocaleString()} hp</b></span>${C().loan>0?`<span>Bank loan <b>${fmt$(C().loan)}</b></span>`:""}${C().cash<0?`<span><b class="warnc">${fmt$(C().cash)}</b> in the red</span>`:""}`;   // cash is in the header; the upgrade count sits in the list heading
  {const eng=engineName(),st=pcStrip();$("mkEng").textContent=eng;$("mkEng").title=eng;$("mkCert").className="mkc "+st.cls;$("mkCert").textContent=st.txt;$("mkCert").title=st.tip;$("mkBoard").textContent=st.when;$("mkBoard").title=st.whenTip||"";
    const sk=pcSkip();$("nextWeek").textContent=sk?"To race week":"Close week";$("nextWeek").title=sk?`Closes ${sk} weeks: overhead for each, then round ${pcTeam().round+1} is due`:"";$("oneWeek").hidden=!sk;}
  const canBorrow=C().loan+LOAN_STEP<=LOAN_MAX;$("borrow").disabled=!canBorrow;$("borrow").textContent=canBorrow?`Draw ${fmt$(LOAN_STEP)}`:"Line maxed";$("repay").disabled=!(C().loan>0&&C().cash>0);$("repay").textContent=C().loan>0?`Repay ${fmt$(Math.min(C().loan,Math.max(0,C().cash)))}`:"Nothing owed";
  $("bankHint").textContent=`Draw up to ${fmt$(LOAN_MAX)} in ${fmt$(LOAN_STEP)} steps. Each week the bank takes ${(loanRate()*100).toFixed(1)}% interest and repays ${(LOAN_PAY*100).toFixed(0)}% of the balance (at least ${fmt$(LOAN_MIN_PAY)}) from cash${C().loan>0?` — ${fmt$(loanInt())} interest + ${fmt$(loanPay())} repayment = ${fmt$(loanInt()+loanPay())} this week`:` — a full ${fmt$(LOAN_MAX)} would cost ${fmt$(Math.round(LOAN_MAX*LOAN_RATE)+Math.round(LOAN_MAX*LOAN_PAY))} the first week`}. Repay early to save interest. Below ${fmt$(FORECLOSE_AT)} cash the bank takes the shop.`;
  $("ledger").innerHTML=C().log.length?C().log.map(e=>`<div class="${e.k}"><b>wk ${e.w}</b>${e.t}</div>`).join(""):`<div>Nothing yet. Sign a team, or race an event.</div>`;
  const done=GOALS.filter(g=>C().goals[g.id]).length;$("goalCnt").textContent=`${done} / ${GOALS.length}`;
  $("goals").innerHTML=goalsHtml();
  $("overheadHint").textContent=`Weekly overhead: ${fmt$(overhead())} (${fmt$(500)} base + ${fmt$(overhead()-500-wages())} for the plant you own, 2% of what upgrades cost${wages()?`, + ${fmt$(wages())} wages`:""}). A team round runs every other week: race it from the Team section, or Close week races it with the season engine as it stands. After a round, To race week closes the off week and the race week in one tap; 1 wk closes just one.`;
  mkLayout();
  $("staffCnt").textContent=wages()?`${fmt$(wages())}/wk`:"";
  crewRender();   // people, levels, traits, training: app/crew.js
  const act=C().rndActive;$("rndCnt").textContent=`${Object.keys(C().rnd).length} / ${RND.length}`;
  $("rndHint").textContent=act?`In progress: ${RND.find(r=>r.id===act.id).name} — week ${Math.min(rndNeed(RND.find(r=>r.id===act.id)),Math.floor(act.done)+1)} of ${rndNeed(RND.find(r=>r.id===act.id))}.`:"Fund one project at a time. It runs while you advance weeks.";
  $("rnd").innerHTML=RND.map(r=>{const done=!!C().rnd[r.id];const running=act&&act.id===r.id;const pct=running?Math.min(100,Math.round(100*act.done/rndNeed(r))):0;
    return `<div class="up ${done?"owned":""}"><div><h3>${r.name}</h3><p>${r.desc}</p><p class="uneed"><b>${rndNeed(r)} wk${rndNeed(r)<r.weeks?` (−25%, was ${r.weeks})`:""}</b></p>${running?`<div class="bar" style="margin-top:6px"><i style="width:${pct}%"></i></div>`:""}</div>${done?`<div class="price">Done</div>`:running?`<div class="price" style="color:var(--warn)">${pct}%</div>`:`<button class="btn sm ${C().cash>=r.cost&&!act?"pri":""}" data-rnd="${r.id}" ${act?"disabled":""}>${fmt$(r.cost)}</button>`}</div>`;}).join("");
  $("prestige").innerHTML=shopOrder(PRESTIGE,pp=>!C().prestige[pp.id]&&C().cash>=pp.price).map(pp=>{const own=!!C().prestige[pp.id];return `<div class="up ${own?"owned":""}"><div><h3>${pp.name}</h3><p>${pp.desc}</p></div>${own?`<div class="price">Owned</div>`:`<button class="btn sm ${C().cash>=pp.price?"pri":""}" data-prestige="${pp.id}">${fmt$(pp.price)}</button>`}</div>`;}).join("");
  upRender();
  $("prCnt").textContent=`${Object.keys(C().prestige||{}).length} / ${PRESTIGE.length}`;
}
/* Settings live in their own pane (a button in the Shop), not in the Shop's scroll */
function setOn(){return $("setPane").classList.contains("on");}
function setOpen(){closeSheet();$("setOpen").classList.add("open");$("setPane").classList.add("on");$("scrim").classList.add("on");$("setBody").scrollTop=0;$("setClose").focus({preventScroll:true});}
function setClose(){if(!setOn())return;$("setOpen").classList.remove("open");$("setPane").classList.remove("on");if(!$("sheet").classList.contains("on"))$("scrim").classList.remove("on");}
$("setOpen").addEventListener("click",()=>{if(setOn()){setClose();return;}renderShop();setOpen();});$("setClose").addEventListener("click",setClose);$("scrim").addEventListener("click",setClose);
$("setPane").addEventListener("click",e=>{if(e.target.closest("#glOpen,#lessonsOpen,#kbHelpBtn,#sndCredBtn,#replayTour,#replayFF,#modeBox button"))setClose();});
$("mkOh").addEventListener("click",()=>{const h=$("overheadHint"),on=h.hidden;h.hidden=!on;$("mkOh").setAttribute("aria-expanded",String(on));});
/* Close week, or To race week: the off week after a round has nothing on it for the team, so one tap closes it and
   the race week too (pcSkip). It stops early if the bank calls, a sponsor phones or an R&D project finishes in between.
   "1 wk" (#oneWeek) closes just one, for a shop that wants the off week's event nights. */
function closeWeeks(n){if(testing){toast("Let the run finish first");return;}const due=pcDue();if(due&&!confirm(due))return;
  const w0=C().week;let oh=0;
  for(let i=0;i<n;i++){const so=spS().offers.length,rd=C().rndActive;advanceWeek();oh+=overhead();
    if(C().cash<FORECLOSE_AT||spS().offers.length>so||(rd&&!C().rndActive))break;}
  save();hud();renderShop();const k=C().week-w0;
  toast(`${k>1?`WEEKS ${w0+1}–${C().week}`:`WEEK ${C().week}`} · OVERHEAD ${fmt$(oh)}${C().loan>0?" · BANK "+fmt$(loanInt()+loanPay()):""}`);}
$("nextWeek").addEventListener("click",()=>closeWeeks(pcSkip()||1));
$("oneWeek").addEventListener("click",()=>closeWeeks(1));
$("staff").addEventListener("click",e=>{const h=e.target.closest("[data-hire]"),f=e.target.closest("[data-fire]");
  if(h){const st=STAFF.find(x=>x.id===h.dataset.hire);if(C().cash<st.wage*2){toast(`Need ${fmt$(st.wage*2-C().cash)} more`);return;}C().cash-=st.wage*2;C().staff[st.id]=crewNew(st.id);syncShop();logEvent(`Hired ${C().staff[st.id].nm} as ${st.name.toLowerCase()} at ${fmt$(st.wage)}/week`,"");save();hud();renderShop();renderBuild();recompute();toast(`${st.name.toUpperCase()} · ON PAYROLL`);buzz(20);}
  if(f){const st=STAFF.find(x=>x.id===f.dataset.fire);const who=(crewP(st.id)||{}).nm;if(!confirm(`Let ${who?who+", your "+st.name.toLowerCase()+",":"the "+st.name.toLowerCase()} go?`))return;delete C().staff[st.id];syncShop();
    if(C().cert&&(st.id==="tuner"||st.id==="machinist")){C().cert=null;logEvent(`Cert void — the ${st.name.toLowerCase()} signed it off; pull it again`,"bad");setTimeout(()=>toast("CERT VOID · re-run the dyno"),50);}logEvent(`Let the ${st.name.toLowerCase()} go`,"");save();hud();renderShop();renderBuild();recompute();}});
/* shop: what you can afford now goes first; a big buy (over ~40% of cash) asks first */
function shopOrder(list,ok){return list.filter(ok).concat(list.filter(x=>!ok(x)));}
/* Shop upgrades: what you can still buy as short rows (area chips once the list is long), the ones you own folded into an "Owned" row.
   S.shopCat = the open chip, S.shopOwn = the Owned row open; old saves have neither (Can buy when something is, else All; folded). */
const UP_CATS=[["dyno","Test cell",["dyno2","dyno3","dyno4","dyno5"]],["parts","Parts",["shop1","flow","boost","shop2","race"]],["bays","Bays",["bay1","bay2"]],["plant","Late game",["tool","qlab","acad","hall"]]];
const upCat=u=>(UP_CATS.find(k=>k[2].includes(u.id))||UP_CATS[3])[0];
function upRender(){
  const c=C(),own=UPGRADES.filter(u=>c.owned[u.id]),left=UPGRADES.filter(u=>!c.owned[u.id]);
  const need=u=>u.needs&&!c.owned[u.needs]?UPGRADES.find(x=>x.id===u.needs).name:"";
  const lock=u=>need(u)||u.rep>c.rep,can=u=>!lock(u)&&c.cash>=u.price;
  const nCan=left.filter(can).length,cats=UP_CATS.filter(k=>left.some(u=>upCat(u)===k[0])),chips=left.length>5&&cats.length>1;
  let f=S.shopCat||(nCan?"buy":"all");if(!chips||!(f==="buy"?nCan>0:cats.some(k=>k[0]===f)))f="all";
  const chip=(k,t,n)=>`<button data-upf="${k}" class="${f===k?"on":""}" aria-pressed="${f===k}">${t} <b>${n}</b></button>`;
  const ch=$("upChips");ch.hidden=!chips;ch.innerHTML=chips?chip("all","All",left.length)+(nCan?chip("buy","Can buy",nCan):"")+cats.map(k=>chip(k[0],k[1],left.filter(u=>upCat(u)===k[0]).length)).join(""):"";
  $("upCnt").textContent=left.length?`${nCan?nCan+" to buy now · ":""}${left.length} left`:"all built";
  const row=u=>{const n=need(u),r=u.rep>c.rep,lk=n||r,ok=can(u);
    const tag=lk?`<em class="utag">${[n?"needs "+n:"",r?"rep "+u.rep:""].filter(Boolean).join(" · ")}</em>`:"";
    return `<div class="up ur${lk?" lock":ok?" can":""}"><div><h3>${u.name}${tag}</h3><p>${u.desc}</p></div><button class="btn sm ${ok?"pri":""}" data-buy="${u.id}" ${lk?"disabled":""}>${fmt$(u.price)}</button></div>`;};
  const shown=left.filter(u=>f==="all"||(f==="buy"?can(u):upCat(u)===f));
  $("upgrades").innerHTML=left.length?shopOrder(shown,can).map(row).join(""):`<p class="hint">Every upgrade is installed.</p>`;
  const od=$("upOwn");od.hidden=!own.length;$("upOwnCnt").textContent=`${own.length} / ${UPGRADES.length}`;
  $("upOwned").innerHTML=own.map(u=>`<div class="up uo"><div><h3>${u.name}${moreI(u.desc)}</h3></div></div>`).join("");
  if(od.open!==!!S.shopOwn)od.open=!!S.shopOwn;
}
$("upChips").addEventListener("click",e=>{const b=e.target.closest("[data-upf]");if(!b)return;S.shopCat=b.dataset.upf;save();renderShop();buzz(4);});
$("upOwn").addEventListener("toggle",e=>{const o=e.currentTarget.open;if(!!S.shopOwn!==o){S.shopOwn=o;save();}});
function bigSpend(what,price){return price<=C().cash*0.4||confirm(`${what} costs ${fmt$(price)} — ${Math.round(price/Math.max(1,C().cash)*100)}% of your ${fmt$(C().cash)} cash. Buy it?`);}
$("rnd").addEventListener("click",e=>{const b=e.target.closest("[data-rnd]");if(!b||b.disabled)return;const r=RND.find(x=>x.id===b.dataset.rnd);if(C().rndActive||C().rnd[r.id])return;if(C().cash<r.cost){toast(`Need ${fmt$(r.cost-C().cash)} more`);return;}if(!bigSpend(r.name,r.cost))return;
  C().cash-=r.cost;C().rndActive={id:r.id,done:0};logEvent(`Funded R&D: ${r.name} (${r.weeks} weeks)`,"");save();hud();renderShop();toast(`R&D STARTED · ${r.weeks} WEEKS`);buzz(20);});
$("prestige").addEventListener("click",e=>{const b=e.target.closest("[data-prestige]");if(!b)return;const pp=PRESTIGE.find(x=>x.id===b.dataset.prestige);if(C().cash<pp.price){toast(`Need ${fmt$(pp.price-C().cash)} more`);return;}if(!bigSpend(pp.name,pp.price))return;
  C().cash-=pp.price;C().prestige[pp.id]=C().week;C().rep+=pp.rep*2;logEvent(`Bought the ${pp.name.toLowerCase()}`,"good");save();hud();renderShop();ENGINE_VIS.buildGarage(garageOwned());toast(`${pp.name.toUpperCase()} · INSTALLED`);buzz(30);});
$("borrow").addEventListener("click",()=>{if(C().loan+LOAN_STEP>LOAN_MAX)return;C().loan+=LOAN_STEP;C().cash+=LOAN_STEP;logEvent(`Borrowed ${fmt$(LOAN_STEP)} from the bank`,"");save();hud();renderShop();toast(`${fmt$(LOAN_STEP)} in the account. The bank takes ${fmt$(loanInt()+loanPay())} a week now.`);});
$("repay").addEventListener("click",()=>{const amt=Math.min(C().loan,Math.max(0,C().cash));if(amt<=0)return;C().loan-=amt;C().cash-=amt;logEvent(`Repaid ${fmt$(amt)} to the bank`,"good");achCheck({type:"loan"});save();hud();renderShop();toast(C().loan>0?`${fmt$(C().loan)} still owed`:"Loan cleared");});
function benchUnlock(){if(career()&&presetLocked(S.cfg)){S.cfg=Object.assign({},SIM.DEFAULT_CFG);S.profileId=null;S.name=null;}}   // a fresh career can't keep a locked build on the bench
$("foreclose").addEventListener("click",e=>{if(!e.target.closest("[data-restart]"))return;if(testing){toast("Let the run finish first");return;}if(!confirm("Hand the keys to the bank and start over? Blueprints are kept."))return;S.career=freshCareer();lgApply();benchUnlock();save();boot();toast("New shop, same dream. $20,000.");});
$("upgrades").addEventListener("click",e=>{const b=e.target.closest("[data-buy]");if(!b||b.disabled)return;const u=UPGRADES.find(x=>x.id===b.dataset.buy);if(u.rep>C().rep){toast(`Opens at ${u.rep} rep`);return;}if(C().cash<u.price){toast(`Need ${fmt$(u.price-C().cash)} more`);return;}if(!bigSpend(u.name,u.price))return;
  const oh0=overhead();C().cash-=u.price;C().owned[u.id]=true;C().rep+=5;{const dOh=overhead()-oh0;if(dOh>0)logEvent(`${u.name} raised weekly overhead by ${fmt$(dOh)} (plant is charged a share of its price each week)`,"");}save();hud();renderShop();renderBuild();renderPresets();recompute();ENGINE_VIS.buildGarage(garageOwned());toast(`${u.name.toUpperCase()} · INSTALLED`);buzz(30);});
$("resetGame").addEventListener("click",()=>{if(testing){toast("Let the run finish first");return;}if(confirm("Wipe the career save? Cash, upgrades and the team reset. Blueprints are kept."))
  {S.career=freshCareer();lgApply();benchUnlock();save();boot();toast("Fresh start. $20,000 and a dream.");}});
$("slots").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
  if(b.dataset.save){const i=+b.dataset.save;if(readSlot(i)&&!confirm(`Overwrite slot ${i}?`))return;toast(writeSlot(i)?`SLOT ${i} SAVED`:"Couldn't save — storage blocked on this device");renderSaves();}
  else if(b.dataset.load){const i=+b.dataset.load;const o=readSlot(i);if(!o)return;if(!confirm(`Load slot ${i}? Your current game is replaced (it stays in autosave until you make a change).`))return;applyLoaded(o,`Loaded slot ${i}`);}
  else if(b.dataset.clear){const i=+b.dataset.clear;if(!confirm(`Clear slot ${i}?`))return;clearSlot(i);renderSaves();toast(`SLOT ${i} CLEARED`);}});
$("exportSave").addEventListener("click",buBackupOpen);   // Back up / Restore: save codes, app/savecode.js
$("importSave").addEventListener("click",buRestoreOpen);
$("vol").addEventListener("input",e=>{S.vol=+e.target.value;$("volLbl").textContent=S.vol+"%";ENGINE_SOUND.setVolume(S.vol/100);});
$("vol").addEventListener("change",save);
function garageOwned(){const o=Object.assign({},C().owned);if(!career())o.sandbox=true;else{for(const k in C().prestige)o["prestige_"+k]=true;o.week=C().week;o.deliveries=pcS().raced;o.pullCups=(C().pullTitles||[]).length;}return o;}
/* milestones: the rep ladder from 30 to 200 (cash only, so the ladder doesn't feed itself), then the rival goals */
const pcN=(c,k)=>(c.pc&&+c.pc[k])||0;
GOALS.push(
  {id:"rep30",name:"Word gets around",desc:"Reach 30 reputation.",cash:1500,rep:0,check:c=>c.rep>=30,prog:c=>[Math.min(30,c.rep),30]},
  {id:"rep60",name:"Name on the door",desc:"Reach 60 reputation.",cash:3000,rep:0,check:c=>c.rep>=60,prog:c=>[Math.min(60,c.rep),60]},
  {id:"rep100",name:"Three digits",desc:"Reach 100 reputation.",cash:6000,rep:0,check:c=>c.rep>=100,prog:c=>[Math.min(100,c.rep),100]},
  {id:"rep150",name:"Waiting list",desc:"Reach 150 reputation.",cash:10000,rep:0,check:c=>c.rep>=150,prog:c=>[Math.min(150,c.rep),150]},
  {id:"rep200",name:"Industry name",desc:"Reach 200 reputation.",cash:15000,rep:0,check:c=>c.rep>=200,prog:c=>[Math.min(200,c.rep),200]},
  {id:"h2h1",name:"First blood",desc:"Win a head-to-head challenge against a rival shop.",cash:3000,check:c=>rivH2h(c).won>=1},
  {id:"h2h5",name:"Local legend",desc:"Win five head-to-head challenges.",cash:25000,check:c=>rivH2h(c).won>=5,prog:c=>[Math.min(5,rivH2h(c).won),5]},
  {id:"top",name:"Top of the board",desc:"Hold more reputation than all three rival shops (from 60 rep up).",cash:8000,check:c=>c.rep>=60&&rivTop(c)});
/* late game (round 9): long targets for a rich shop. Wins per discipline are a lazily-filled counter, C().dw (old saves start at zero and fill as they race);
   rivals beaten one by one live in C().riv.hist.beat. Cash is small next to a late team's pay, and the rep rungs pay cash only. */
const DW_KINDS=[["drag","drag or race night"],["pull","truck pull"],["bog","mud bog"],["hill","Pikes Peak"],["oval","dirt oval"],["boat","boat drags"],["endurance","24 Hours"],["salt","Bonneville record"]];
function dwinCount(kind,o){if(!o||!(o.win||(kind==="salt"&&o.record)))return;const k=kind==="night"?"drag":kind;if(!DW_KINDS.some(d=>d[0]===k))return;const c=C();if(!c.dw||typeof c.dw!=="object")c.dw={};c.dw[k]=(c.dw[k]||0)+1;}
const dwN=c=>DW_KINDS.filter(d=>c.dw&&c.dw[d[0]]>0).length;
const rivBeaten=c=>RIVALS.filter(v=>c.riv&&c.riv.hist&&c.riv.hist.beat&&c.riv.hist.beat[v.id]>0).length;
const LATE_UP=["tool","qlab","acad","hall"],lateUp=c=>LATE_UP.filter(k=>c.owned&&c.owned[k]).length;
const lateProg=(v,n)=>c=>[Math.min(n,v(c)),n];
GOALS.push(
  {id:"lateall",late:1,name:"Fully tooled",desc:"Own the Tooling hall, Quality lab, Training academy and Showroom hall.",cash:60000,rep:40,check:c=>lateUp(c)>=4,prog:lateProg(lateUp,4)},
  {id:"rep500",late:1,name:"Regional name",desc:"Reach 500 reputation.",cash:30000,rep:0,check:c=>c.rep>=500,prog:lateProg(c=>c.rep,500)},
  {id:"rep1000",late:1,name:"Household name",desc:"Reach 1,000 reputation.",cash:60000,rep:0,check:c=>c.rep>=1000,prog:lateProg(c=>c.rep,1000)},
  {id:"rep1500",late:1,name:"Legend",desc:"Reach 1,500 reputation, the Legend tier.",cash:100000,rep:0,check:c=>c.rep>=1500,prog:lateProg(c=>c.rep,1500)},
  {id:"rep3000",late:1,name:"Dynasty",desc:"Reach 3,000 reputation, the Dynasty tier, where the alcohol cars and unlimited pullers come knocking.",cash:150000,rep:0,check:c=>c.rep>=3000,prog:lateProg(c=>c.rep,3000)},
  {id:"allround",late:1,name:"Win everywhere",desc:"Win at the strip (or a race night), the truck pull, mud bog, Pikes Peak, dirt oval, boat drags and the 24 Hours, and set a Bonneville record. Counts from this save on.",cash:75000,rep:50,check:c=>dwN(c)>=DW_KINDS.length,prog:lateProg(dwN,DW_KINDS.length)},
  {id:"hp2000",late:1,name:"Two thousand",desc:"Certify a 2,000 hp engine.",cash:80000,rep:30,check:c=>c.bestHp>=2000,prog:lateProg(c=>c.bestHp||0,2000)},
  {id:"titles5",late:1,name:"Dynasty builder",desc:"Win five team championships.",cash:70000,rep:25,check:c=>pcN(c,"titles")>=5,prog:lateProg(c=>pcN(c,"titles"),5)},
  {id:"nitro",late:1,name:"Nitro money",desc:"Supply a funny car or a top dragster team for a season.",cash:40000,rep:15,check:c=>pcN(c,"nitro")>=1},
  {id:"earn5m",late:1,name:"Five million",desc:"Earn $5,000,000 in team pay.",cash:100000,rep:40,check:c=>pcN(c,"earned")>=5e6,prog:lateProg(c=>pcN(c,"earned"),5e6)},
  {id:"sweep",late:1,name:"Clean sweep",desc:"Beat all three rival shops head-to-head at least once each. Counts from this save on.",cash:50000,rep:40,check:c=>rivBeaten(c)>=RIVALS.length,prog:c=>[rivBeaten(c),RIVALS.length]});
/* goals pay their cash and rep (default 10) once; then a look at the rival board */
function checkGoals(){let hit=[];for(const g of GOALS){if(C().goals[g.id])continue;let ok=false;try{ok=g.check(C());}catch(e){}
    if(ok){const rp=g.rep!=null?g.rep:10;C().goals[g.id]=C().week;C().cash+=g.cash;C().rep+=rp;logEvent(`Goal: ${g.name} — ${fmt$(g.cash)} bonus${rp?`, +${rp} rep`:""}`,"good");hit.push(g);}}
  if(hit.length){toastAfter(`Goal: ${hit[0].name} · +${fmt$(hit[0].cash)}`);buzz([30,30,30]);}
  rivalsPos();return hit.length;}
function goalsHtml(){const one=g=>{const w=C().goals[g.id];let pg=null;if(!w&&g.prog){try{pg=g.prog(C());}catch(e){}}
    return `<div class="goal ${w?"done":""}"><div><h3>${g.name}</h3><p>${g.desc}</p>${pg?`<div class="gprog"><i style="width:${Math.round(100*pg[0]/pg[1])}%"></i></div>`:""}</div><div class="price">${w?"✓ wk "+w:pg?`<small>${Math.floor(pg[0])} / ${pg[1]}</small>${fmt$(g.cash)}`:fmt$(g.cash)}</div></div>`;};
  const open=GOALS.filter(g=>!C().goals[g.id]),late=open.filter(g=>g.late);
  return open.filter(g=>!g.late).map(one).join("")+(late.length?`<h3 class="goalsec">Late game<span>${late.length} to go</span></h3>`+late.map(one).join(""):"")+GOALS.filter(g=>C().goals[g.id]).map(one).join("");}
