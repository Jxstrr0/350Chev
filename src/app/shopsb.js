/* ===================== SANDBOX SHOP (v1.68): the Shop tab in the test cell =====================
   Career's Shop sells upgrades; the test cell has everything, so its Shop is a bench instead:
   · Bench: the current build next to every saved blueprint (hp, Nm, reliability, kg; best of each in clay), tap to load
   · Parts: a catalogue of every part the build can take, with stats, the Career upgrade that gates it, and a Fit button
   · Quick starts: back to the stock engine, or a random preset to poke at
   Called from renderShop() when career() is false. Markup lives in #sandboxBox (body.html); styles in css/ui-shop.css. */
const SB={sec:"",q:"",sims:new Map()};
function sbSim(cfg){const k=cfgHash(cfg)+"|"+envHash();let r=SB.sims.get(k);if(r)return r;
  r=SIM.simulate(cfg,simEnv({testType:"pull"}));r={hp:r.peakHp,tq:r.peakTq,rel:r.rel,kg:r.kg,nr:engineStatus(cfg,r).nr};
  if(SB.sims.size>200)SB.sims.clear();SB.sims.set(k,r);return r;}
function sbBench(){
  const rows=[{cur:true,name:"Current build",cfg:S.cfg}].concat(S.blueprints.map((b,i)=>({i,name:b.title||b.name||"Blueprint",cfg:Object.assign({},SIM.DEFAULT_CFG,b.cfg)})));
  for(const r of rows)r.s=sbSim(r.cfg);
  const ok=rows.filter(r=>!r.s.nr),best=(f,hi)=>ok.length>1?ok.reduce((a,r)=>hi?Math.max(a,f(r)):Math.min(a,f(r)),hi?-1e9:1e9):null;
  const bHp=best(r=>Math.round(r.s.hp),1),bTq=best(r=>Math.round(r.s.tq),1),bRel=best(r=>Math.round(r.s.rel),1),bKg=best(r=>Math.round(r.s.kg),0);
  const cell=(l,v,b)=>`<span class="${v!=null&&b!=null&&v===b?"best":""}"><b>${v==null?"—":v.toLocaleString()}</b>${l}</span>`;
  $("sbBench").innerHTML=rows.map(r=>{const s=r.s,ok=!s.nr;
    return `<div class="sbrow${r.cur?" cur":""}"><div class="sbn"><b title="${String(r.name).replace(/"/g,"&quot;")}">${r.name}</b>${r.cur?`<small>${cfgLbl(r.cfg)}</small>`:`<button class="btn sm" data-sbload="${r.i}">Load</button><button class="btn sm ghost" data-sbdel="${r.i}" aria-label="Remove ${String(r.name).replace(/"/g,"&quot;")}">✕</button>`}</div>`
      +`<div class="sbs">${cell("hp",ok?Math.round(s.hp):null,bHp)}${cell("Nm",ok?Math.round(s.tq):null,bTq)}${cell("rel",ok?Math.round(s.rel):null,bRel)}${cell("kg",Math.round(s.kg),bKg)}</div></div>`;}).join("");
  $("sbBenchCnt").textContent=`${S.blueprints.length} / 12`;$("sbSave").disabled=S.blueprints.length>=12;}
/* every seg field the current build shows, grouped by its Build section */
function sbSections(){const out=[];for(const sec of FORM){const fs=sec.fields.filter(f=>f.type==="seg"&&(!f.showIf||f.showIf(S.cfg)));if(fs.length)out.push({t:(sec.titleIf&&sec.titleIf(S.cfg))||sec.title,fs});}return out;}
function sbParts(){
  const secs=sbSections();if(!secs.some(x=>x.t===SB.sec))SB.sec=secs.length?secs[0].t:"";
  const sel=$("sbSec");sel.innerHTML=secs.map(x=>`<option value="${x.t.replace(/"/g,"&quot;")}">${x.t}</option>`).join("");sel.value=SB.sec;
  const q=SB.q.trim().toLowerCase(),c=S.cfg;let n=0,h="";const CAP=40;
  for(const sec of secs){if(!q&&sec.t!==SB.sec)continue;
    for(const f of sec.fs){const tbl=f.optTable||f.key,opts=OPT[tbl],lb=fLabel(f),famOK=famOKf(f,c);let fh="";
      for(const k in opts){const o=opts[k];if(!famOK(o,k))continue;
        if(q&&!(`${lb} ${o.name} ${o.sub||""} ${o.info||""}`.toLowerCase().includes(q)))continue;
        if(n>=CAP){n++;continue;}n++;
        const fit=c[f.key]===k,req=o.req?UPGRADES.find(u=>u.id===o.req):null;
        const chips=chipsFor(tbl,o).map(([l,v])=>`<i><em>${l}</em>${v}</i>`).join("");
        const more=(chips||o.info)?`<details class="more"><summary aria-label="More info">ⓘ</summary><div>${chips?`<div class="chips">${chips}</div>`:""}${o.info?`<p>${o.info}</p>`:""}</div></details>`:"";
        fh+=`<div class="opt sbp${fit?" cur":""}"><div class="oh"><div class="sbt"><b>${o.name}</b>${req?`<span class="tag lk">Career: ${req.name}</span>`:""}<div class="sbl">${specLine(tbl,o)}${more}</div></div>`
          +`<button class="btn sm" data-sbfit="${f.key}" data-v="${k}" ${fit?"disabled":""}>${fit?"Fitted":"Fit"}</button></div></div>`;}
      if(fh)h+=`<h3 class="sbf">${lb}${q?` <small>${sec.t}</small>`:""}</h3>`+fh;}}
  $("sbList").innerHTML=h||`<p class="hint">${q?"No part matches that.":"Nothing to show."}</p>`;
  $("sbMore").textContent=n>CAP?`Showing ${CAP} of ${n}. Narrow the search to see the rest.`:"";$("sbSec").style.display=q?"none":"";}
function renderSbShop(){if(!$("sbBench"))return;sbBench();sbParts();}
(function(){const root=$("sandboxBox");if(!root)return;
  root.addEventListener("click",e=>{
    const ld=e.target.closest("[data-sbload]");if(ld){if(testing){toast("Let the run finish first");return;}const bp=S.blueprints[+ld.dataset.sbload];if(!bp)return;S.cfg=Object.assign({},SIM.DEFAULT_CFG,bp.cfg);S.profileId=null;S.name=bp.title||null;resetBase();afterCfgChange(true);renderSbShop();toast("BLUEPRINT LOADED");return;}
    const dl=e.target.closest("[data-sbdel]");if(dl){S.blueprints.splice(+dl.dataset.sbdel,1);renderBlueprints();save();renderSbShop();return;}
    if(e.target.closest("#sbSave")){$("saveBp").click();renderSbShop();return;}
    const ft=e.target.closest("[data-sbfit]");if(ft){if(ft.disabled)return;applyOpt(ft.dataset.sbfit,ft.dataset.v);renderSbShop();return;}
    if(e.target.closest("#sbStock")){if(testing){toast("Let the run finish first");return;}if(!confirm("Replace the current build with the stock engine? Save it to the bench first to keep it."))return;
      S.cfg=Object.assign({},SIM.DEFAULT_CFG);S.profileId=null;S.name=null;resetBase();afterCfgChange(true);renderSbShop();toast("STOCK ENGINE");return;}
    if(e.target.closest("#sbRand")){if(testing){toast("Let the run finish first");return;}const p=PRESETS[Math.floor(Math.random()*PRESETS.length)];
      S.cfg=Object.assign({},SIM.DEFAULT_CFG,p.cfg);S.profileId=p.soundProfile;S.name=p.name;resetBase();afterCfgChange(true);renderSbShop();toast(`${p.name} loaded — ${p.blurb}`);}});
  $("sbSec").addEventListener("change",e=>{SB.sec=e.target.value;sbParts();});
  $("sbQ").addEventListener("input",e=>{SB.q=e.target.value;sbParts();});})();
