/* ===================== TEAM SEASONS: the hill climb series (since 1.76.51; plugs into PC_KIND, app/team.js) =====================
   A hill climb team runs one class of the hillclimb (Open, Time Attack, Pikes Peak Open, Unlimited: SIM.HILL_CLASSES) for
   eight rounds. Rounds 1–7 rotate through four shorter, lower made-up hills (SIM.HILL_HILLS: Badlands Grade, Kettle Butte,
   Ghost Ridge, Thunder Pass), starting at a different one for each team; round 8 is the finale on Pikes Peak. Race day is
   text only: the team's car (its chassis, the class's best legal tyres and aero) makes one timed run with your engine,
   run at the hill's five altitudes in the round's weather (SIM.hillPrep), against nine season regulars (SIM.hillAiPrep cars,
   their power growing a little each round) on the same corner calls, ranked by time. The sim's own DNFs count (over the
   edge, boiled, couldn't climb), plus a worn engine letting go part way up. An extra engine past the season's allowance
   runs first, on the dustiest road. Points as the oval's. */
/* the series rows: the class, and the rep, budget and pay of that tier on the ladder */
Object.assign(PC_EVENTS,{
  hillopen:{ev:"hill",cls:"open",n:"Open hill climb",tier:0,rep:0,budget:[2500,5500],pay:[60000,80000],tip:"Street or sport tyres and no aero: grip and gearing win it, not power."},
  hillta:{ev:"hill",cls:"ta",n:"Time Attack hill climb",tier:1,rep:40,budget:[4500,9500],pay:[130000,170000],tip:"Semi-slicks and a wing. A turbo keeps its breath as the road climbs."},
  hillppo:{ev:"hill",cls:"ppo",n:"Pikes Peak Open hill climb",tier:2,rep:120,budget:[7000,16000],pay:[280000,360000],tip:"Slicks, splitter and wing on a stripped car; the finale tops out at 4,302 m."},
  hillunl:{ev:"hill",cls:"unl",n:"Unlimited hill climb",tier:3,rep:300,budget:[14000,30000],pay:[600000,780000],tip:"Anything goes: big aero and as much power as the thin air leaves you."}});
/* the season's hills: the four rotating ones, then Pikes Peak for the last round. PC_HILL_DT: the field's and your time step */
const PC_HILLS=["badlands","kettle","ghost","thunder"],PC_HILL_FIN="pikes",PC_HILL_DT=0.04;
const PC_HILL_K=[0.84,0.89,0.93,0.97,1.0,1.03,1.06,1.1,1.16];   // the nine regulars' power, against the class's field
/* the cars a series runs (the team's and the regulars'): anything but the pickup; the two fast classes only the cars built to corner */
const PC_HILL_CH={ppo:["roadster","coupe","rally","super"],unl:["roadster","coupe","rally","super"]};
const pcHillCh=E=>(PC_HILL_CH[E.cls]||Object.keys(SIM.CHASSIS).filter(c=>c!=="pickup")).filter(c=>SIM.CHASSIS[c]);
/* the hill for the team's next (or current) round: a different one each round, Pikes Peak for the last */
function pcHillId(T){return T.round>=PC_ROUNDS-1?PC_HILL_FIN:PC_HILLS[((T.seed>>>0)+T.round)%PC_HILLS.length];}
function pcHillTxt(id){const H=SIM.HILL_HILLS[id],s=H.secs,km=s.reduce((a,x)=>a+x.km,0),n=s.reduce((a,x)=>a+x.cor,0);
  return`${km.toFixed(km%1?1:0)} km and ${n} turns up to ${s[s.length-1].alt.toLocaleString("en-CA")} m${id===PC_HILL_FIN?": the finale":""}`;}
/* the race-morning map on a hill prep: the torque curves the run drives at each altitude, the power read at each, and the
   reliability for the day (from the shop pull). Returns that reliability */
function pcHillMap(prep,M){for(const p of prep.pts){pcMapRes(p.prep,M);p.hp*=M.k;p.tq*=M.k;}return pcMapRes(prep.refRes,M).rel;}
/* the extra engine runs first, before the field has swept the road: grippy corners are only clean, two in five clean ones dusty */
function pcHillDusty(calls,r){const C0=SIM.HILL_CALL;let n=0;return calls.map(c=>{const to=c.call==="grippy"?"clean":c.call==="clean"&&r()<0.4?"dusty":c.call;if(to===c.call)return c;n++;
  return{call:to,gk:c.gk+C0[to]-C0[c.call],swept:n};});}
/* race day on the hill: one timed run each, on the same calls, ranked by time (DNFs after, by how far they got) */
function pcHillDay(T,sat,cfg,o){const E=PC_EVENTS[T.ev],k=E.cls,C0=SIM.HILL_CLASSES[k],F=C0.field,st=PC_STYLES[T.style],rs=pcRoundSeed(T),r=rnRng((rs^0x41C1)>>>0),W=pcWx(T,true);
  const hid=W.site&&W.site.id||pcHillId(T),H=SIM.HILL_HILLS[hid],Tc=SIM.hillCourse(hid),up=1+PC_FIELD_UP*T.round,wx={dT:W.t-SIM.hillAmbC(W.alt),h:W.h};
  const ty=C0.tyres[C0.tyres.length-1],ae=C0.aero[C0.aero.length-1],calls=SIM.hillCalls(rs,hid),run={hill:hid,cls:k,tyre:ty,aero:ae,dt:PC_HILL_DT};
  const rows=T.rivals.map((rv,i)=>{const hp=Math.round(F.hp*rv.k*up*(0.97+0.06*r())),sd=(rs^(i+1)*2654435761)>>>0,mech=r()<0.04,at=0.1+0.85*r();let q;
    try{q=SIM.hillPass(SIM.hillAiPrep(hp,rv.turbo,sd,hid,wx),Object.assign({},run,{ch:rv.ch,seed:sd,calls,plan:SIM.hillPlan(calls,rv.sk,sd,hid)}));}catch(e){q={time:null,dnf:{kind:"mech",s:0}};}
    if(mech&&q.time!=null)q={time:null,dnf:{kind:"mech",s:Tc.len*at}};
    return{n:rv.n,i,t:q.time,s:q.dnf?q.dnf.s||0:Tc.len,why:q.dnf?q.dnf.kind:""};});
  const lines=[`Round ${T.round+1}: ${pcWxTxt(W,false,T)}.`],chN=SIM.CHASSIS[T.ch]?SIM.CHASSIS[T.ch].n:"The car";
  let me=null,pr=null,rel=0,broke=false,why="",swept=0;
  if(!sat){const prep=SIM.hillPrep(cfg,Object.assign({},S.env,stdCell()),hid,wx);rel=Math.max(0,pcHillMap(prep,o.M)-T.wear);
    let myCalls=calls;if(o.back){myCalls=pcHillDusty(calls,rnRng((rs^0xD057)>>>0));swept=myCalls.filter(c=>c.swept).length;}
    const bias=T.style==="hotshoe"?0.006:T.style==="steady"?-0.004:0,plan=SIM.hillPlan(myCalls,o.sk,(rs^0x3E)>>>0,hid).map(v=>+(v+bias).toFixed(4));
    const haz=(100-rel)/100*0.25*st.wear*pcLuckK(),wornS=r()<haz?Tc.len*(0.15+0.8*r()):null;
    const altFail=prep.fails.length?{alt:prep.pts[0].alt,why:String(prep.fails[0])}:prep.pts.map(p=>({alt:p.alt,f:p.res&&p.res.fails||[]})).filter(p=>p.f.length).map(p=>({alt:p.alt,why:String(p.f[0])}))[0]||null;
    const failS=altFail?Math.max(0,Tc.z.findIndex(z=>z>=altFail.alt))*Tc.ds:null,stop=Math.min(wornS==null?Infinity:wornS,failS==null?Infinity:failS);
    const p=SIM.hillNew(prep,Object.assign({},run,{ch:T.ch,seed:(rs^0x7EA1)>>>0,calls:myCalls,plan}));let n=0,gone=null;
    while(!p.st.done&&n++<120000){p.step(PC_HILL_DT,null);if(p.st.s>=stop){gone=failS!=null&&failS<=(wornS==null?Infinity:wornS)?"sim":"worn";break;}}
    pr=p.result();const sec=Tc.sections[Math.min(Tc.sections.length-1,Tc.sec[Math.min(Tc.N-1,Math.floor(p.st.s/Tc.ds))])].n,km=(p.st.s/1000).toFixed(1);
    if(gone){pr.time=null;broke=true;why=gone==="sim"?`It let go at ${altFail.alt.toLocaleString("en-CA")} m, ${km} km up in ${sec}: ${altFail.why.charAt(0).toLowerCase()+altFail.why.slice(1)}.`
      :`The engine let go ${km} km up, in ${sec}${T.wear>8?" (it was due a freshen-up)":prep.refRes.firstToFail?` (${prep.refRes.firstToFail.toLowerCase()} was the weak link on the dyno)`:""}.`;}
    else if(pr.dnf){const d=pr.dnf;broke=d.kind==="edge"||d.kind==="boil";
      why=d.kind==="edge"?`Too fast into ${d.name} with a drop and no guardrail: over the edge, ${km} km up.`:d.kind==="boil"?`Boiled over in ${d.name}, ${km} km up: thin air through the radiator.`:d.kind==="stall"?`Couldn't pull up the grade in ${d.name}, ${km} km up.`:`Flagged off in ${d.name} at half an hour.`;}
    me={n:pcFirst(T)+" (yours)",me:true,t:pr.time,s:pr.time!=null?Tc.len:p.st.s};}
  const all=rows.concat(me?[me]:[]).sort((a,b)=>(a.t==null?1:0)-(b.t==null?1:0)||(a.t!=null?a.t-b.t:b.s-a.s)||(a.me?-1:b.me?1:0));
  const rpos=T.rivals.map((x,i)=>all.findIndex(y=>!y.me&&y.i===i)+1),top5="Top five: "+all.slice(0,5).map((x,i)=>`${i+1}. ${x.n} ${fmtHill(x.t)}`).join(" · ");
  if(sat){lines.push(`${H.n}: sat this round out.`);lines.push(top5);return{place:99,of:all.length+1,broke:false,why:"",lines,best:null,rpos,sat:true,rel};}
  const place=all.indexOf(me)+1,dnf=pr.time==null,lead=all[0];
  lines.push(`${H.n}${hid===PC_HILL_FIN?" for the finale":""}: the ${chN.toLowerCase().replace("gt","GT").replace("awd","AWD")}, car #${T.num}, on ${SIM.HILL_TYRES[ty].n.toLowerCase()} tyres${ae!=="none"?", "+SIM.HILL_AERO[ae].n.toLowerCase():""}.`);
  if(o.back)lines.push(`The extra engine runs first, on the dustiest road: ${swept} corner${swept===1?"":"s"} called dustier than the field got them.`);
  lines.push(dnf?`DNF, P${place} of ${all.length}. ${why}`:`Climbed in ${fmtHill(pr.time)} (${pr.avgKmh} km/h), P${place} of ${all.length}${place>1?`, ${(pr.time-lead.t).toFixed(2)} s off ${lead.n}`:all[1]&&all[1].t!=null?`, ${(all[1].t-pr.time).toFixed(2)} s clear`:""}.`);
  const hp=pr.hp,offs=pr.offs.length,mo=pr.moments;
  lines.push(`${Math.round(hp[0].hp).toLocaleString()} hp at the line, ${Math.round(hp[hp.length-1].hp).toLocaleString()} at the top · top ${Math.round(pr.vmax)} km/h · ${pr.coolPeak} °C peak coolant${offs?` · ${offs} off${offs>1?"s":""} (${pr.offs.map(x=>x.name||Tc.sections[x.sec].n).slice(0,2).join(", ")})`:mo?` · ${mo} moment${mo>1?"s":""}`:" · clean"}.`);
  lines.push(top5);
  return{place,of:all.length,broke,dnf,why,lines,best:pr.time,rpos,sat:false,rel};}
PC_KIND.hill={needHp:E=>SIM.HILL_CLASSES[E.cls].field.hp*1.1,
  make(T,E,base,r,pick){T.ch=pick(pcHillCh(E));T.num=1+Math.floor(r()*98);},
  rivals(T,E,r){const C0=SIM.HILL_CLASSES[E.cls],F=C0.field,names=HILL_NAMES.slice(),chs=pcHillCh(E),take=a=>a.splice(Math.floor(r()*a.length),1)[0];
    return PC_HILL_K.map(k=>({n:take(names),k,turbo:r()<F.turbo,ch:chs[Math.floor(r()*chs.length)],sk:+Math.min(0.97,Math.max(0.35,F.skill+(r()-0.5)*0.3)).toFixed(2),pts:0}));},
  back(n,T){n.ch=T.ch;n.num=T.num;},
  site:T=>{const id=pcHillId(T),H=SIM.HILL_HILLS[id];return{n:H.n,alt:H.alt0,id};},
  condTxt:W=>W.site&&W.site.id?pcHillTxt(W.site.id):"",
  range(T,E){const F=SIM.HILL_CLASSES[E.cls].field;return{lo:F.hp-F.sd,hi:F.hp+F.sd};},
  but:(T,E,res,hp)=>E.cls==="open"&&hp>450?", though street rubber and no aero won't use much of it":"",
  rules:()=>[],
  day:pcHillDay,
  pts:pl=>PC_PTS_OVAL[pl-1]||0,placeTxt:o=>o.sat?"Sat out":o.dnf?`DNF (P${o.place} of ${o.of})`:o.place===1?"Won the climb":`P${o.place} of ${o.of}`,eff:o=>o.sat||o.dnf?99:o.place,
  fieldTxt(T,E){const C0=SIM.HILL_CLASSES[E.cls],d=C0.d.replace(/ · /g,", ");return`The field makes about ${C0.field.hp} hp at the shop and loses some of it to the altitude. ${d.charAt(0).toUpperCase()+d.slice(1)}. Rounds 1–7 rotate through four hills; round 8 is Pikes Peak.`;},
  where:T=>`${SIM.CHASSIS[T.ch]?SIM.CHASSIS[T.ch].n:"Hill car"} · car #${T.num}`};
