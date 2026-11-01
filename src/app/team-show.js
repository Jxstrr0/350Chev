/* ===================== TEAM TAB: THE CAR SHOW AND SOUND-OFF (since 1.76.52) =====================
   Off weeks (no team round due this week, or no team at all) have a show the shop can take the engine on the bench to,
   once a week. Weeks alternate between a show & shine, where judges walk round with clipboards, and a sound-off, where the
   crowd votes with its ears. Both judge four things out of 25: finish (the cam cover and the hardware you can see), smoothness
   (the layout's balance and the damper), idle (steady for the judges, lumpy for the crowd) and sound (a rich note for the
   judges, as loud as it gets for the crowd), weighted by the kind of show (PC_SHOW_KINDS). Seven other entrants score around
   the show's level (lvl, by the shop's rep tier; a sound-off's scores run lower). The top three take the purse and a little rep. The engine must be
   certified; showing it costs only the entry fee, with no wear and no budget spent. */
const PC_SHOW_KINDS={
  shine:{n:"Show & shine",lvl:[62,66,70,74,78,81],w:{fin:1.3,smo:1.1,idl:1.0,snd:0.6},tip:"Judges with clipboards: a clean finish, a smooth engine, a steady idle and a rich, not deafening, note.",
    names:["County fair show & shine","Main Street cruise night","Regional Autorama","Prairie Nationals concours","Grand Concours","Legends Invitational"]},
  sound:{n:"Sound-off",lvl:[40,45,50,55,60,64],w:{snd:1.6,idl:1.2,fin:0.6,smo:0.6},tip:"The crowd votes by ear: as loud as it gets, and a big lumpy idle. Looks still count a little.",
    names:["Fairgrounds sound-off","Drive-in rev-off","Regional sound-off","Nationals sound-off","Thunder Bowl sound-off","Legends sound-off"]}};
const PC_SHOW_SD=9,PC_SHOW_N=7,PC_SHOW_TOP=5;   // the field's spread (its mean by tier is the kind's lvl: a sound-off scores lower), how many others enter, the top show tier
const PC_SHOW_PURSE=[2000,4500,9000,18000,36000,72000],PC_SHOW_SPLIT=[1,0.5,0.25],PC_SHOW_FEE=0.05,PC_SHOW_REP=[2,1,0],PC_SHOW_REPK=[1,1,1.5,2,3,4];
const PC_SHOW_COVER={silver:8,black:11,blue:12,red:14,orange:14,gold:18};
const PC_SHOW_ASP={roots:5,screw:5,twin_turbo:3,compound:3,turbo:2,centrifugal:2};
const PC_SHOW_INTAKE={itb:4,carb:2};
const PC_SHOW_WHO=["Dale","Marta","Hank","Bev","Lyle","June","Arlo","Tess","Wade","Nell","Cal","Rosa","Gus","Ida","Rex","Fern"];
const PC_SHOW_CAR=["black coupe","candy-red roadster","farm truck","lowered wagon","primer-grey sedan","pearl-white convertible","flatbed hauler","orange fastback"];

const pcShowCl=v=>Math.max(0,Math.min(25,v));
/* the week's show: which kind (weeks alternate) and which tier (the shop's rep, up to the top show) */
function pcShowNow(){const w=C().week,k=w%2?"sound":"shine",ti=Math.min(PC_SHOW_TOP,repTierIdx()),K=PC_SHOW_KINDS[k];
  return{w,k,ti,K,name:K.names[ti],purse:PC_SHOW_PURSE[ti],fee:Math.round(PC_SHOW_PURSE[ti]*PC_SHOW_FEE/50)*50};}
/* an off week: no team round due this week */
function pcShowOff(){return !pcDueNow().length;}
/* the four scores for an engine (its config and its dyno result) at a kind of show */
function pcShowScore(cfg,res,k){const L=SIM.LAYOUTS[cfg.layout]||{n:4},D=SIM.OPT.damper[cfg.damper]||{damping:0.5},n=Math.min(12,L.n||4);
  const lope=Math.max(0,Math.min(1,((+cfg.cam||45)/100-0.5)*2)),clat=res.clatter||0,smoke=res.smoke||0;
  const fin=pcShowCl((PC_SHOW_COVER[cfg.cover]||10)+(PC_SHOW_ASP[cfg.asp]||0)+(PC_SHOW_INTAKE[cfg.intake]||0)+(cfg.head==="billet_hemi"?3:0)-smoke*0.08);
  const smo=pcShowCl((res.smooth||50)*0.22+D.damping*4-clat*6);
  let idl,snd;
  if(k==="sound"){const db=res.noiseDbOpen||res.noiseDb||70;idl=pcShowCl(9+lope*16);snd=pcShowCl((db-60)*0.65+n*0.4);}
  else{const db=res.noiseDb||70;idl=pcShowCl(25-lope*14-clat*8);snd=pcShowCl(13+n*0.6-Math.max(0,Math.abs(db-74)-4)*0.8);}
  const s={fin,smo,idl,snd},W=PC_SHOW_KINDS[k].w;let tot=0;for(const x in s){s[x]=Math.round(s[x]);tot+=s[x]*W[x];}
  s.tot=Math.round(tot);s.lope=lope;return s;}
const PC_SHOW_LBL={fin:"Finish",smo:"Smoothness",idl:"Idle",snd:"Sound"};
/* what the judges (or the crowd) said: the best and worst of the four */
function pcShowSays(s,k,cfg){const ord=["fin","smo","idl","snd"].sort((a,b)=>s[b]-s[a]),hi=ord[0],lo=ord[3],o=[];
  const good={fin:`the ${(SIM.OPT.cover[cfg.cover]||{name:"cam cover"}).name.toLowerCase()} cover${PC_SHOW_ASP[cfg.asp]>=5?" and the blower on top":PC_SHOW_INTAKE[cfg.intake]===4?" and the row of trumpets":""}`,
    smo:"how smooth it sat",idl:k==="sound"?"that lumpy cam":"its steady idle",snd:k==="sound"?"how loud it was":"the note it made"};
  const bad={fin:"the plain finish",smo:"the shake at idle",idl:k==="sound"?"an idle too tame for the crowd":s.lope>0.4?"the hunting idle":"a rough idle",snd:k==="sound"?"not enough noise":"a note that didn't sing"};
  o.push(`${k==="sound"?"The crowd":"The judges"} liked ${good[hi]} (${s[hi]}/25).`);if(s[lo]<s[hi]-4)o.push(`It lost points for ${bad[lo]} (${s[lo]}/25).`);return o;}
/* enter this week's show with the certified engine on the bench */
function pcShowEnter(){const c=C(),p=pcS(),sh=pcShowNow(),cert=c.cert,h=cfgHash(S.cfg);
  if(!pcShowOff()){toast("Race week: the shows are on off weeks");return;}
  if(p.show&&p.show.w===sh.w){toast("You've been to this week's show");return;}
  if(!(cert&&cert.ok&&cert.hash===h&&cert.res)){toast("Certify this build on the dyno first");return;}
  if(c.cash<sh.fee){toast(`The entry fee is ${fmt$(sh.fee)}`);return;}
  const me=pcShowScore(S.cfg,cert.res,sh.k),r=rnRng(((c.week*7919+(p.season||1)*131+sh.ti)^0x5A0E)>>>0),g=()=>{let u=0;for(let i=0;i<4;i++)u+=r();return (u-2)*1.73;};
  const field=[];for(let i=0;i<PC_SHOW_N;i++)field.push({n:`${PC_SHOW_WHO[Math.floor(r()*PC_SHOW_WHO.length)]}'s ${PC_SHOW_CAR[Math.floor(r()*PC_SHOW_CAR.length)]}`,s:Math.max(20,Math.min(97,Math.round(sh.K.lvl[sh.ti]+g()*PC_SHOW_SD)))});
  const rows=field.concat([{n:engineName(),s:me.tot,me:true}]).sort((a,b)=>b.s-a.s||(a.me?-1:b.me?1:0)),pl=rows.findIndex(x=>x.me)+1;
  const prize=pl<=3?Math.round(sh.purse*PC_SHOW_SPLIT[pl-1]/50)*50:0,rep=pl<=3?Math.round(PC_SHOW_REP[pl-1]*PC_SHOW_REPK[sh.ti]):0;
  c.cash+=prize-sh.fee;c.rep+=rep;
  p.show={w:sh.w,k:sh.k,name:sh.name,place:pl,of:rows.length,score:me,prize,fee:sh.fee,rep,top:rows.slice(0,3).map(x=>({n:x.n,s:x.s,me:!!x.me})),says:pcShowSays(me,sh.k,S.cfg)};
  p.shows=(p.shows||0)+1;if(pl===1)p.showWins=(p.showWins||0)+1;
  logEvent(`${sh.name}: ${pl===1?"best in show":"P"+pl+" of "+rows.length} with ${me.tot} points — ${fmt$(prize-sh.fee)}${rep?`, +${rep} rep`:""}`,pl===1?"good":"");
  achCheck({type:"team"});  save();hud();renderShop();pcRender();toast(pl===1?`BEST IN SHOW · ${fmt$(prize)}`:`${sh.K.n.toUpperCase()} · P${pl} OF ${rows.length}`);buzz(pl===1?[30,40,30]:20);}
function pcShowBars(s){return `<div class="pcshowb">${["fin","smo","idl","snd"].map(x=>`<div><span>${PC_SHOW_LBL[x]}</span><i style="width:${s[x]*4}%"></i><b>${s[x]}</b></div>`).join("")}</div>`;}
function pcShowRender(){const el=$("pcShow");if(!el)return;const p=pcS(),sh=pcShowNow(),cert=C().cert,h=cfgHash(S.cfg),certOk=!!(cert&&cert.ok&&cert.hash===h&&cert.res),S0=p.show;
  const nx=PC_SHOW_KINDS[sh.k==="sound"?"shine":"sound"].n.toLowerCase();let b;
  if(S0&&S0.w===sh.w){b=`<h3>${esc(S0.name)}<span>${S0.place===1?"best in show":`P${S0.place} of ${S0.of}`}</span></h3>${pcShowBars(S0.score)}
    <div class="pcl">${S0.says.map(x=>`<div>${esc(x)}</div>`).join("")}<div>Top three: ${S0.top.map((x,i)=>`${i+1}. ${x.me?"<b>yours</b>":esc(x.n)} (${x.s})`).join(" · ")}</div></div>
    <p class="mkline"><span>Score <b>${S0.score.tot}</b>/100</span><span>Prize <b>${fmt$(S0.prize)}</b></span><span>Entry <b>${fmt$(S0.fee)}</b></span>${S0.rep?`<span>Rep <b>+${S0.rep}</b></span>`:""}</p><p class="hint">Next week is a ${nx}.</p>`;}
  else if(!pcShowOff()){b=`<h3>No show this week<span>race week</span></h3><p class="hint">The shows run in the off weeks between rounds. Next one is a ${PC_SHOW_KINDS[(sh.w+1)%2?"sound":"shine"].n.toLowerCase()}.</p>`;}
  else{const pv=quick?pcShowScore(S.cfg,certOk?cert.res:quick,sh.k):null;
    b=`<h3>${esc(sh.name)}<span>${sh.K.n} · this week</span></h3><p class="hint">${sh.K.tip} The field scores about ${sh.K.lvl[sh.ti]}. Best in show takes ${fmt$(sh.purse)}, 2nd and 3rd ${fmt$(sh.purse*PC_SHOW_SPLIT[1])} and ${fmt$(sh.purse*PC_SHOW_SPLIT[2])}.</p>
    ${pv?pcShowBars(pv)+`<p class="mkline"><span>The bench engine would score about <b>${pv.tot}</b>/100</span></p>`:""}
    <button class="btn sm" data-pcshow ${certOk?"":"disabled"}>Enter · ${fmt$(sh.fee)}</button>${certOk?"":`<p class="hint">Certify this build on the dyno to show it.</p>`}`;}
  el.innerHTML=`<div class="sec"><h2>Car show</h2><div class="card pcshow">${b}</div></div>`;}
$("mkTeam").addEventListener("click",e=>{if(career()&&e.target.closest("[data-pcshow]"))pcShowEnter();});
