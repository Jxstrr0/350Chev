/* ===================== CREW PROGRESSION (career) =====================
   Every STAFF hire is a named person: C().staff[role] = {nm, role, lvl 1-5, xp, tr:[{id,rv}], mor, away, crs, h:{...}, hired}.
   The role's STAFF effect is the base; each level past 1 adds a little to it (and to the wage). Traits (CREW_TRAITS) roll
   at hire, stay hidden until they show (level 2 / 8 weeks, level 3 / 16 weeks) and only act once revealed. Level 1 with no
   traits is exactly the old flat staff effect, so a save from before people (staff[role] = hire week) reads the same.
   The crew has its own seeded generator (C().crew.seed): it never draws from C().seed, so contracts, claims and the
   week's walk-ins roll as they always did. */
const CREW_XP=[0,80,200,380,640];   // cumulative XP for levels 1..5
const CREW_FIRST=["Dale","Marie","Kev","Priya","Earl","Tanya","Lou","Gus","Rosa","Wes","Darlene","Hank","Mo","Jules","Shane","Bev","Corey","Nadia","Ray","Fern","Lyle","Joanne","Arjun","Cass","Tomasz","Ingrid","Dwayne","Leah","Bao","Colette","Rune","Amrit","Sheila","Travis","Noreen","Elias"];
const CREW_LAST=["Kowalski","Lindqvist","Fontaine","Gill","Thiessen","McAllister","Boychuk","Nakamura","Dumont","Halvorsen","Okafor","Penner","Sandhu","Lavoie","Reimer","Fraser","Hryniuk","Olsen","Cardinal","Mbeki","Wiebe","Larocque","Tkachuk","Ferreira","Bjornson","Desjarlais","Kaur","Doucette","Friesen","Abbott"];
const CREW_ALL=["machinist","tuner","dynotech","sales"];
const CREW_TRAITS=[
  {id:"wizard",v:"is a tuning wizard",n:"Tuning wizard",pos:1,roles:["tuner","dynotech"],d:"Dyno-day hints cost half, and auto-tune lands closer to the edge."},
  {id:"hands",v:"has fast hands",n:"Fast hands",pos:1,roles:CREW_ALL,d:"24 Hours pit stops 15% quicker; race-night freshens cost a quarter less."},
  {id:"owl",v:"is a night owl",n:"Night owl",pos:1,roles:["machinist","dynotech","tuner"],d:"Works late: the rebuild bay takes 2 more units a week."},
  {id:"frugal",v:"is frugal",n:"Frugal",pos:1,roles:CREW_ALL,d:"Haggles with every supplier: unit cost −2%."},
  {id:"diesel",v:"is a diesel whisperer",n:"Diesel whisperer",pos:1,roles:CREW_ALL,d:"Diesel engines sell for 4% more."},
  {id:"twostroke",v:"is a two-stroke nut",n:"Two-stroke nut",pos:1,roles:CREW_ALL,d:"Two-stroke engines sell for 6% more."},
  {id:"lucky",v:"is lucky",n:"Lucky",pos:1,roles:CREW_ALL,d:"Warranty claims come back 15% less often."},
  {id:"meticulous",v:"is meticulous",n:"Meticulous",pos:1,roles:["machinist","dynotech"],d:"Rebuilds last 8% longer."},
  {id:"smooth",v:"is a smooth talker",n:"Smooth talker",pos:1,roles:["sales"],d:"Contracts and buyers pay +2%."},
  {id:"quick",v:"is a quick study",n:"Quick study",pos:1,roles:CREW_ALL,d:"Learns 40% faster."},
  {id:"workhorse",v:"is a workhorse",n:"Workhorse",pos:1,roles:CREW_ALL,d:"Busy weeks don't wear on morale."},
  {id:"clumsy",v:"is clumsy with sensors",n:"Clumsy with sensors",pos:0,roles:["dynotech","tuner"],d:"Knocks a sensor loose now and then: about one cert pull in twelve reads wrong and has to be pulled again."},
  {id:"nervous",v:"gets nervous at the strip",n:"Nervous at the strip",pos:0,roles:CREW_ALL,d:"Fumbles in the pits: race-night freshens cost a quarter more, and track days teach them nothing."},
  {id:"slow",v:"is a slow learner",n:"Slow learner",pos:0,roles:CREW_ALL,d:"Learns 30% slower."},
  {id:"fuse",v:"has a short fuse",n:"Short fuse",pos:0,roles:CREW_ALL,d:"Morale drops twice as fast."},
  {id:"heavy",v:"is heavy-handed",n:"Heavy-handed",pos:0,roles:["machinist","tuner","dynotech"],d:"Goes through parts: unit cost +1.5%."}
];
const crewTr=id=>CREW_TRAITS.find(t=>t.id===id);
const CREW_COL={machinist:"var(--info)",tuner:"var(--orange)",dynotech:"var(--good)",sales:"var(--warn)"};
function crewS(){const c=C();if(!c.crew||typeof c.crew!=="object")c.crew={};const k=c.crew;if(!k.seed)k.seed=((c.seed>>>0)^0x5bd1e995)>>>0||7;if(!k.cand||typeof k.cand!=="object")k.cand={};if(!k.hist||typeof k.hist!=="object")k.hist={lv:0,max:1,crs:0,rv:0,quit:0};return k;}
function crewRnd(){const k=crewS();k.seed=(k.seed*1664525+1013904223)>>>0;return k.seed/4294967296;}
const crewPick=a=>a[Math.floor(crewRnd()*a.length)];
function crewName(){const k=crewS(),used=new Set(Object.values(C().staff||{}).concat(Object.values(k.cand)).map(p=>p&&typeof p==="object"?String(p.nm).split(" ")[0]:""));let f=crewPick(CREW_FIRST);for(let i=0;i<12&&used.has(f);i++)f=crewPick(CREW_FIRST);return f+" "+crewPick(CREW_LAST);}   // no two first names alike in the shop
function crewRollTraits(role){const x=crewRnd(),n=x<0.3?0:x<0.75?1:2,out=[];
  for(let i=0;i<n;i++){const pos=crewRnd()<0.62;const pool=CREW_TRAITS.filter(t=>!!t.pos===pos&&t.roles.includes(role)&&!out.some(o=>o.id===t.id)&&!(t.id==="quick"&&out.some(o=>o.id==="slow"))&&!(t.id==="slow"&&out.some(o=>o.id==="quick")));if(pool.length)out.push({id:crewPick(pool).id,rv:false});}
  return out;}
function crewPerson(role,mig){return{nm:crewName(),role,lvl:1,xp:0,tr:mig?[]:crewRollTraits(role),mor:70,away:0,crs:null,warn:0,wk:0,pulls:0,h:{},hired:C().week};}
/* the next applicant for an open role: fixed once drawn, so the name on the card is the one you hire */
function crewCand(role){const k=crewS();if(!k.cand[role])k.cand[role]=crewPerson(role,false);return k.cand[role];}
function crewNew(role){const k=crewS(),p=crewCand(role);delete k.cand[role];p.hired=C().week;p.mor=70;return p;}
/* a save from before people: staff[role] = hire week → a level-1 hand with no traits */
function crewP(role){if(!career())return null;const st=C().staff;if(!st)return null;const v=st[role];if(!v)return null;
  if(typeof v!=="object"){const p=crewPerson(role,true);p.hired=+v||C().week;st[role]=p;return p;}
  if(!v.h||typeof v.h!=="object")v.h={};if(!Array.isArray(v.tr))v.tr=[];if(!(v.lvl>=1))v.lvl=1;return v;}
function crewOn(role){const p=crewP(role);return !!p&&!(p.away>C().week);}
function crewL(role){if(!career()||dev())return 0;const p=crewP(role);return p?Math.max(0,Math.min(4,(p.lvl|0)-1)):0;}   // levels past the first
function crewT(id){if(!career()||dev()||!C().staff)return 0;let n=0;for(const r of CREW_ALL){const p=crewP(r);if(p&&!(p.away>C().week)&&p.tr.some(t=>t.id===id&&t.rv))n++;}return n;}
function crewWage(st){const p=crewP(st.id);const L=p?Math.max(1,Math.min(5,p.lvl|0)):1;return L===1?st.wage:Math.round(st.wage*(1+0.12*(L-1))/10)*10;}
/* trait effects the rest of the shop reads (all exactly 1 / 0 with no revealed trait) */
function crewCostK(){return (crewT("frugal")?0.98:1)*(crewT("heavy")?1.015:1);}
function crewPriceK(){return crewT("smooth")?1.02:1;}
function crewFamK(res){return res&&res.diesel&&crewT("diesel")?1.04:res&&res.twoStroke&&crewT("twostroke")?1.06:1;}
function crewPitK(){return crewT("hands")?0.85:1;}
function crewRnFreshK(){return (crewT("hands")?0.75:1)*(crewT("nervous")?1.25:1);}
function crewBadRead(){return crewT("clumsy")>0&&crewRnd()<1/12;}
/* the role's effect at its level, in words */
function crewFx(role,L){L=L||1;const k=L-1;
  return role==="machinist"?`Unit cost −${8+k}%, machining R&D ${25+2.5*k}% faster, rebuild bay +${4+k} a week.`
    :role==="tuner"?`+${(1+0.15*k).toFixed(k?2:0)} octane number of knock margin on every build; auto-tune and a free first dyno-day hint.`
    :role==="dynotech"?`Dyno pulls, endurance and over-rev runs are free; +${(0.45+0.08*k).toFixed(2)} dyno-day customers a week on average.`
    :role==="sales"?`Contracts pay +${6+k}% and every category shows a third offer.`:"";}
const CREW_HIST={eng:["built","engine","engines"],cal:["calibrated","engine","engines"],jobs:["fixed","customer engine","customer engines"],rb:["rebuilt","engine","engines"],pulls:["ran","dyno pull","dyno pulls"],ev:["crewed at","event","events"],deals:["closed","deal","deals"],rnd:["saw through","R&D project","R&D projects"]};
function crewHistTxt(p){const o=[];for(const k in CREW_HIST){const n=p.h[k]|0;if(n>0){const w=CREW_HIST[k];o.push(`${w[0]} ${n} ${n===1?w[1]:w[2]}`);}}return o.length?o.join(" · "):"Nothing on the board yet.";}
const crewRole=r=>(STAFF.find(s=>s.id===r)||{name:r}).name;
const crewFirst=p=>String(p.nm).split(" ")[0];
/* XP: work the role does. mult: quick/slow; a person away on a course earns nothing */
function crewXP(role,xp,hk,hn){const p=crewP(role);if(!p||p.away>C().week)return;if(hk)p.h[hk]=(p.h[hk]||0)+(hn||1);
  const has=id=>p.tr.some(t=>t.id===id&&t.rv);xp*=has("quick")?1.4:has("slow")?0.7:1;p.xp=(p.xp||0)+xp;p.wk=(p.wk||0)+xp;crewLevel(p);}
function crewLevel(p){let up=false;while(p.lvl<5&&p.xp>=CREW_XP[p.lvl]){p.lvl++;up=true;const st=STAFF.find(s=>s.id===p.role);const h=crewS().hist;h.lv++;h.max=Math.max(h.max||1,p.lvl);p.mor=Math.min(100,(p.mor||70)+5);
    logEvent(`${p.nm} (${crewRole(p.role).toLowerCase()}) made level ${p.lvl} — wage now ${fmt$(crewWage(st))}/week`,"good");toast(`LEVEL UP · ${p.nm.toUpperCase()} · LV ${p.lvl}`);}
  if(up){crewReveal(p);syncShop();}}
/* traits show themselves: the first at level 2 or 10 weeks on the job, the second at level 3 or 20 weeks */
function crewReveal(p){const wks=C().week-(p.hired||C().week);let any=false;
  p.tr.forEach((t,i)=>{if(t.rv)return;if(p.lvl>=2+i||wks>=10*(i+1)){t.rv=true;any=true;const T=crewTr(t.id);crewS().hist.rv++;
    logEvent(`Turns out ${p.nm} ${T.v}: ${T.d.replace(/\.$/,"").replace(/^./,c=>c.toLowerCase())}`,T.pos?"good":"bad");}});
  if(any)syncShop();return any;}
/* game hooks: one call per kind of work */
function crewWork(kind,o){if(!career()||!C().staff)return;o=o||{};try{
  if(kind==="dyno"||kind==="drag"){const p=crewP("dynotech");if(p&&(p.pulls|0)<6){p.pulls=(p.pulls|0)+1;crewXP("dynotech",o.tt==="endurance"?4:o.tt==="overrev"?3:kind==="drag"?1:2,kind==="drag"?null:"pulls");}}
  else if(kind==="dd"){const tune=(o.job.fix||[]).some(f=>["timing","lambda","map","boost","fuel"].includes(f[0]));const r=tune?"tuner":"machinist";crewXP(r,o.ok?14:4,o.ok?"jobs":null);crewXP("dynotech",o.ok?5:2);}
  else if(kind==="sale"){const f=C().fleet[C().fleet.length-1],u=f?f.units|0:1;crewXP("sales",6,"deals");crewXP("machinist",3,"eng",u);crewXP("tuner",2,"cal",u);crewXP("dynotech",1.5);}
  else if(kind==="rebuild"){crewXP("machinist",0.5*(o.n||1),"rb",o.n||1);}
  else if(kind==="rnd"){crewXP(o.r&&o.r.mach?"machinist":"tuner",20,"rnd");}
  else{const w=!!(o.win||o.record);for(const r of CREW_ALL){const p=crewP(r);if(!p||p.away>C().week||p.tr.some(t=>t.id==="nervous"&&t.rv))continue;p.evn=(p.evn|0)+1;if(p.evn<=4)crewXP(r,r==="dynotech"?(w?6:4):(w?2:1.5),"ev");else p.h.ev=(p.h.ev||0)+1;}}   // track days: the first four a week teach them something
  }catch(e){}}
/* weekly: courses end, traits show, morale moves, the unhappy warn and then walk */
function crewWeek(){if(!career()||!C().staff)return;const k=crewS();let changed=false;const bounced=C().cash<0;
  for(const r of CREW_ALL){const p=crewP(r);if(!p)continue;
    if(p.crs&&p.away&&C().week>=p.away){const c=p.crs;p.crs=null;p.away=0;changed=true;p.mor=Math.min(100,(p.mor||70)+10);
      if(c.k==="xp"){p.xp+=c.xp;p.h.crs=(p.h.crs||0)+1;logEvent(`${p.nm} is back from the ${c.n.toLowerCase()} — +${c.xp} XP`,"good");crewLevel(p);}
      else{const T=crewTr(c.t);const neg=p.tr.findIndex(t=>!crewTr(t.id).pos&&t.rv);if(p.tr.length>=2&&neg>=0)p.tr.splice(neg,1);if(p.tr.length<2)p.tr.push({id:c.t,rv:true});p.h.crs=(p.h.crs||0)+1;logEvent(`${p.nm} is back from the ${c.n.toLowerCase()}: now ${T.n.toLowerCase()}`,"good");}}
    if(p.away>C().week){p.wk=0;p.pulls=0;p.evn=0;continue;}
    if(crewReveal(p))changed=true;
    const has=id=>p.tr.some(t=>t.id===id&&t.rv),fk=has("fuse")?2:1;let d=(p.mor||70)<75?4:0;
    if((p.wk||0)>30&&!has("workhorse"))d=-Math.min(5,Math.ceil(((p.wk||0)-30)/4))*fk;
    if(bounced)d-=12*fk;
    p.mor=Math.max(0,Math.min(100,(p.mor||70)+d));p.wk=0;p.pulls=0;p.evn=0;
    if(p.mor<25){if(!p.warn){p.warn=C().week;logEvent(`${p.nm} (${crewRole(r).toLowerCase()}) is fed up — ${bounced?"pay bounced":"run off their feet"}. Ease off or send them on a course, or they'll walk`,"bad");}
      else if(C().week>p.warn&&crewRnd()<0.4){delete C().staff[r];k.hist.quit++;changed=true;logEvent(`${p.nm} quit — the ${crewRole(r).toLowerCase()} job is open again`,"bad");toast(`${p.nm.toUpperCase()} QUIT`);
        if(C().cert&&(r==="tuner"||r==="machinist"))C().cert=null;}}
    else if(p.mor>=35)p.warn=0;}
  if(changed)syncShop();}
/* training: a course costs money and takes them away for its weeks. Skills = XP; specialist = a chosen good trait */
function crewCourses(p){const L=p.lvl|0;return{xp:{k:"xp",n:"Skills course",wk:2,cost:1500+500*L,xp:Math.round(CREW_XP[Math.min(4,L)]*0.35+30)},
  tr:{k:"tr",n:"Specialist course",wk:4,cost:4500+900*L}};}
function crewTrainable(p){return CREW_TRAITS.filter(t=>t.pos&&t.roles.includes(p.role)&&!p.tr.some(x=>x.id===t.id)&&!(t.id==="quick"&&p.tr.some(x=>x.id==="slow")));}
function crewCanLearn(p){return p.tr.length<2||p.tr.some(t=>!crewTr(t.id).pos&&t.rv);}
function crewTrain(role,kind,tid){const p=crewP(role);if(!p||p.away>C().week)return;const cs=crewCourses(p),c=cs[kind];if(!c)return;
  if(kind==="xp"&&p.lvl>=5)return;if(kind==="tr"&&(!crewCanLearn(p)||!crewTrainable(p).some(t=>t.id===tid)))return;
  if(C().cash<c.cost){toast(`Need ${fmt$(c.cost-C().cash)} more`);return;}
  C().cash-=c.cost;p.away=C().week+c.wk;p.crs=Object.assign({},c,kind==="tr"?{t:tid,n:`${crewTr(tid).n} course`}:{});crewS().hist.crs++;syncShop();
  logEvent(`Sent ${p.nm} on the ${p.crs.n.toLowerCase()} — ${fmt$(c.cost)}, back week ${p.away}`,"");achCheck({type:"crew"});save();hud();renderShop();renderBuild();recompute();toast(`${p.nm.toUpperCase()} · ON COURSE ${c.wk} WEEKS`);buzz(20);}
function crewMaxLv(){let m=0;for(const r of CREW_ALL){const p=crewP(r);if(p)m=Math.max(m,p.lvl|0);}return Math.max(m,career()?crewS().hist.max||0:0);}
/* the Staff section: one card per role, a person or the next applicant */
function crewRender(){const box=$("staff");if(!box||!career())return;let open=null;try{open=box.dataset.open||null;}catch(e){}
  box.innerHTML=`<p class="hint crewi">Staff learn on the job and level up to 5: each level adds a little to what they do, and to their wage. Everyone has a trait or two that shows in time. Overwork or a bounced payroll sours morale, and an unhappy hand warns you once before they quit.</p>`+STAFF.map(st=>{const p=crewP(st.id);
    if(!p){const a=crewCand(st.id);return `<div class="up crew"><div class="cwho"><i class="cav off" style="--cc:${CREW_COL[st.id]}">${crewIni(a.nm)}</i><div><h3>${st.name}</h3><p class="csub">Applicant: <b>${ddEsc(a.nm)}</b> · level 1</p></div></div><p>${st.desc} <b>${fmt$(st.wage)}/week, ${fmt$(st.wage*2)} to hire</b></p><div class="cbtn"><button class="btn sm ${C().cash>=st.wage*2?"pri":""}" data-hire="${st.id}">Hire ${ddEsc(crewFirst(a))}</button></div></div>`;}
    const L=p.lvl|0,nx=L<5?CREW_XP[L]:null,pv=CREW_XP[L-1],pct=nx?Math.max(0,Math.min(100,Math.round(100*(p.xp-pv)/(nx-pv)))):100,away=p.away>C().week,hid=p.tr.filter(t=>!t.rv).length;
    const chips=p.tr.filter(t=>t.rv).map(t=>{const T=crewTr(t.id);return `<span class="ctr ${T.pos?"pos":"neg"}" title="${ddEsc(T.d)}">${T.n}</span>`;}).join("")+(hid?`<span class="ctr hid">${hid===1?"one trait":"two traits"} still to show</span>`:"");
    const mor=Math.round(p.mor||0),mc=mor<25?"crit":mor<45?"warn":"good";const cs=crewCourses(p);
    const train=away?`<p class="caway">On the ${ddEsc(p.crs?p.crs.n.toLowerCase():"course")} · back week ${p.away}. The role's effect is off till then.</p>`
      :`<details class="ctrain" data-role="${st.id}"${open===st.id?" open":""}><summary>Training</summary><p class="hint">A course takes them out of the shop: no ${st.name.toLowerCase()} effect while they're away. Wages still run.</p>
        ${L<5?`<button class="ccrs" data-crs="xp" data-role="${st.id}">${cs.xp.n} · ${cs.xp.wk} wk · ${fmt$(cs.xp.cost)}<small>+${cs.xp.xp} XP</small></button>`:`<p class="hint">Top level — nothing left to teach them.</p>`}
        ${crewCanLearn(p)?crewTrainable(p).map(t=>`<button class="ccrs" data-crs="tr" data-t="${t.id}" data-role="${st.id}">${t.n} · ${cs.tr.wk} wk · ${fmt$(cs.tr.cost)}<small>${t.d}</small></button>`).join(""):`<p class="hint">Already two traits — a specialist course only replaces a known bad habit.</p>`}</details>`;
    return `<div class="up owned crew${away?" away":""}"><div class="cwho"><i class="cav" style="--cc:${CREW_COL[st.id]}">${crewIni(p.nm)}</i><div><h3>${ddEsc(p.nm)}</h3><p class="csub">${st.name} · since week ${p.hired||1}${away?" · on course":""}</p></div><b class="clv">LV ${L}</b></div>
      <div class="cbar" title="${Math.floor(p.xp)} XP"><i style="width:${pct}%"></i></div><p class="cxp">${nx?`${Math.floor(p.xp)} / ${nx} XP to level ${L+1}`:`${Math.floor(p.xp)} XP · top level`}<span class="cmor ${mc}">morale ${mor}</span></p>
      ${chips?`<div class="ctrs">${chips}</div>`:""}
      <p>${crewFx(st.id,L)} <b>${fmt$(crewWage(st))}/week</b></p><p class="chist">${ddEsc(crewHistTxt(p))}</p>
      ${train}<div class="cbtn"><button class="btn sm danger" data-fire="${st.id}">Release</button></div></div>`;}).join("");}
const crewIni=n=>String(n).split(" ").map(w=>w[0]||"").join("").slice(0,2).toUpperCase();
$("staff").addEventListener("click",e=>{const b=e.target.closest("[data-crs]");if(!b)return;crewTrain(b.dataset.role,b.dataset.crs,b.dataset.t);});
$("staff").addEventListener("toggle",e=>{const d=e.target;if(d&&d.classList&&d.classList.contains("ctrain"))$("staff").dataset.open=d.open?d.dataset.role:"";},true);
ACH.push(
  {g:"shop",id:"crew_lv",name:"Moving up",desc:"A member of staff reaches level 2.",ic:"people",tier:"bronze",check:()=>career()&&crewMaxLv()>=2},
  {g:"shop",id:"crew_course",name:"Back to school",desc:"Send someone on a training course.",ic:"people",tier:"bronze",check:()=>career()&&(crewS().hist.crs||0)>0},
  {g:"shop",id:"crew_crew3",name:"Seasoned crew",desc:"All four roles filled at level 3 or better.",ic:"people",tier:"silver",check:()=>career()&&CREW_ALL.every(r=>{const p=crewP(r);return p&&p.lvl>=3;})},
  {g:"shop",id:"crew_lv5",name:"Master hand",desc:"A member of staff reaches level 5.",ic:"star",tier:"gold",check:()=>career()&&crewMaxLv()>=5});
