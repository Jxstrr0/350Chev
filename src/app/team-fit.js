/* ===================== OFFERS BUILT AROUND YOUR ENGINE (Team tab, since 1.76.69) =====================
   Build any engine you like: once it holds a clean, certified pull, a team in a series it suits makes an offer for it, so
   an odd build still has a season to race. A series suits the engine when it passes the class rules, its reliability is
   at least what that kind of racing wants (PC_FIT_REL), it would run mid-pack or better on power (pcRead's words), and its
   parts fit what a team in that series spends. The series can be up to PC_FIT_UP tiers past the ones the shop's rep has
   opened (the dyno already had to read the engine). The best fit is offered (the highest tier, then the closest to the
   field), plus the best in up to two other kinds of racing. The pay is a normal offer's in that series; the field's power is set
   around the engine where the series allows it; the budget covers the build with room for upkeep; the driver's style and
   any team rule are ones the engine already meets.
   Nothing is saved: the offers are drawn from the certified engine and the season, so certifying the same build again
   draws the same teams, and a different engine draws different ones. Signing goes through pcSign like any offer. */
const PC_FIT_REL={drag:80,boat:80,pull:80,bog:85,oval:90,hill:90},PC_FIT_UP=1,PC_FIT_ROOM=1.3,PC_FIT_N=3;
/* a number from the build's hash string, for the seed */
function pcFitSeed(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
/* the highest tier the shop's rep has opened, plus PC_FIT_UP */
const pcFitTop=()=>Math.max(0,...Object.values(PC_EVENTS).filter(E=>C().rep>=E.rep).map(E=>E.tier))+PC_FIT_UP;
/* the most a team in this series ever spends on parts in a season */
const pcFitCap=E=>Math.round(E.budget[1]*PC_RAISE*PC_SEASON*PC_PURSE.rich.bud/500)*500;
/* does the series suit the engine? {ok, why, T (the probe with the field set), d (how far from the middle of the field)} */
function pcFitTry(k,res,cfg){const E=PC_EVENTS[k],K=PC_KIND[E.ev],hp=res.peakHp,rel=Math.round(res.rel),cost=Math.round(res.cost),want=PC_FIT_REL[E.ev]||85;
  const T={ev:k,seed:1,name:""},pick=a=>a[0];
  K.make(T,E,E.budget[0],()=>0,pick);
  if(T.fieldHp!=null){const lo=T.fieldHp;K.make(T,E,E.budget[1],()=>0.999,pick);const hi=T.fieldHp;
    const R=K.range(Object.assign({},T,{fieldHp:1000}),E),mid=(R.lo+R.hi)/2/1000;T.fieldHp=Math.round(Math.max(lo,Math.min(hi,hp/mid)));}   // the engine in the middle of the field, where the series allows
  if(K.needHp(E)>dynoCap().hp*0.9)return{ok:false,why:`the ${E.n.toLowerCase()} field makes more power than your dyno reads`};   // the same dyno gate as the regular offers
  if(E.na&&!pcIsNA(cfg))return{ok:false,why:`${E.n} is naturally aspirated`};
  const bad=K.rules(T,E,res).find(x=>!x.ok);if(bad)return{ok:false,why:`${E.n}: ${bad.t}`};
  if(rel<want)return{ok:false,why:`${E.n} wants ${want}% reliability (it has ${rel}%)`};
  const R=K.range(T,E),m=(R.lo+R.hi)/2;if(hp<m*0.97)return{ok:false,back:true,why:`${Math.round(hp).toLocaleString()} hp would run near the back in ${E.n.toLowerCase()}`};
  if(cost*1.15>pcFitCap(E))return{ok:false,why:`its ${fmt$(cost)} of parts is more than a ${E.n.toLowerCase()} team spends`};
  return{ok:true,T,d:Math.abs(hp/m-1)};}
/* the offer itself, drawn on the engine's own stream: a normal offer's pay, a budget that covers the build */
function pcFitMake(k,fit,res,cfg,r,i){const E=PC_EVENTS[k],pick=a=>a[Math.floor(r()*a.length)],rel=Math.round(res.rel),cost=Math.round(res.cost);
  const sks=Object.keys(PC_STYLES).filter(s=>!PC_STYLES[s].rel||rel>=PC_STYLES[s].rel),sk=pick(sks),st=PC_STYLES[sk];
  const p=pcS(),taken=new Set(p.offers.map(o=>o.name).concat(Object.keys(p.drv),pcTeams().map(o=>o.name)));let name,n=0;
  do{name=pick(PC_FIRST)+" "+pick(PC_LAST);}while(taken.has(name)&&n++<40);
  let ak=null,aN;const asks=Object.keys(PC_RULES).filter(a=>PC_RULES[a].when(E,{style:sk}));
  if(asks.length&&r()<PC_RULE_P){const a=pick(asks),A=PC_RULES[a],nn=A.ns?pick(A.ns):undefined;if(A.ok(cfg,res,nn)){ak=a;aN=nn;}}   // only a rule the engine already meets
  const f=r(),base=E.budget[0]+(E.budget[1]-E.budget[0])*f,draw=Math.round(base*PC_RAISE*PC_SEASON/500)*500;
  const budget=Math.min(pcFitCap(E),Math.max(draw,Math.ceil(cost*PC_FIT_ROOM/500)*500));
  const pay=Math.round((E.pay[0]+(E.pay[1]-E.pay[0])*(0.6*f+0.4*r()))*(st.payK||1)*(ak?PC_RULES[ak].payK:1)/1000)*1000;
  const T=Object.assign({},fit.T,{id:"fit"+i,team:pick(PC_LAST)+" "+pick(PC_TEAM),name,style:sk,ev:k,budget,pay,skill:+(st.skill[0]+(st.skill[1]-st.skill[0])*r()).toFixed(2),seed:Math.floor(r()*1e9)+1,back:false,fit:true,exp:C().week+PC_OPEN});
  if(ak){T.rule=ak;if(aN!=null)T.ruleN=aN;}
  const fh=T.fieldHp;PC_KIND[E.ev].make(T,E,base,r,pick);if(fh!=null)T.fieldHp=fh;   // the car, track or boat, keeping the field set around the engine
  return T;}
/* the offers for the certified bench engine: {list, why}. Kept until the engine, the season, the rep tier or the teams change */
let pcFitMemo=null;
function pcFitList(){const cert=C().cert,h=cfgHash(S.cfg);
  if(!cert||!cert.ok||cert.hash!==h||!cert.res)return{list:[],why:"cert"};
  const p=pcS(),top=pcFitTop(),TT=pcTeams(),key=[h,p.season,top,TT.map(T=>T.ev+T.team).join(),C().week].join("|");
  if(pcFitMemo&&pcFitMemo.key===key)return pcFitMemo.v;
  const res=cert.res,ks=Object.keys(PC_EVENTS).filter(k=>PC_EVENTS[k].tier<=top&&!TT.some(T=>T.ev===k)),tries=ks.map(k=>({k,f:pcFitTry(k,res,S.cfg)}));
  const ok=tries.filter(x=>x.f.ok).sort((a,b)=>PC_EVENTS[b.k].tier-PC_EVENTS[a.k].tier||a.f.d-b.f.d),pickd=[];
  for(const x of ok){if(pickd.length>=PC_FIT_N)break;if(!pickd.some(y=>PC_EVENTS[y.k].ev===PC_EVENTS[x.k].ev))pickd.push(x);}
  const r=rnRng((pcFitSeed(h)^Math.imul(p.season,7919))>>>0),list=pickd.map((x,i)=>pcFitMake(x.k,x.f,res,S.cfg,r,i));
  /* why nothing suits: what keeps it out of the easiest series it misses */
  let why="";if(!list.length){const m=tries.filter(x=>!x.f.ok).sort((a,b)=>PC_EVENTS[a.k].tier-PC_EVENTS[b.k].tier||!!b.f.back-!!a.f.back);
    why=m.length?m[0].f.why:"every series it suits is already on your books";}
  pcFitMemo={key,v:{list,why}};return pcFitMemo.v;}
const pcFitFind=id=>pcFull()?null:pcFitList().list.find(T=>T.id===id)||null;
function pcFitRender(){const sec=$("pcFitSec");if(!sec)return;if(pcFull()){sec.style.display="none";return;}sec.style.display="";
  const F=pcFitList(),res=C().cert&&C().cert.res;
  if(F.why==="cert"){$("pcFitTxt").textContent=`Build any engine you like and certify it on the dyno (Test tab): a team in a series it suits will offer a season for it, up to one tier past the series your rep has opened.`;$("pcFit").innerHTML="";return;}
  const eng=`${Math.round(res.peakHp).toLocaleString()} hp, ${Math.round(res.rel)}% reliable`;
  $("pcFitTxt").textContent=F.list.length?`Teams that want your certified ${engineName()} (${eng}) as it is. The pay is the series' usual; the budget covers this build. The offer stays while this engine is the certified one.`
    :`Nothing suits your certified ${engineName()} (${eng}) yet: ${F.why}. Teams want ${PC_FIT_REL.drag}% reliability on the strip, the water and the pull, ${PC_FIT_REL.bog}% in the bog, ${PC_FIT_REL.oval}% on the oval and the hill.`;
  $("pcFit").innerHTML=F.list.map(T=>pcOffer(T)).join("");}
