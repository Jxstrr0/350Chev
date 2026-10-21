/* ===================== OVAL: race night on the clay, or on the paved half-mile ===================== */
/* A heat race (8 laps) against seven rivals sets the feature grid, then the feature (25 laps) against the whole night's field.
   The rivals are made-up engines and drivers run through the same lap sim (SIM.ovalNew) the car runs on; their laps are done
   before the green, the player's car is driven live against them. Career: one night per class a week, rep to enter, a
   certified engine, an entry fee, a purse for each race. Sandbox: always open, a fresh night every time.
   Two tracks (SIM.OVAL_TRACKS): the clay 3/8 mile (the default; every old save and record is this one) and the paved half-mile.
   The pick lives in S.env.ovalTrack; the night book and the records are kept per track (clay keeps its old keys). */
let OV=null;
const OVAL_HEAT=8,OVAL_FEAT=25,OVAL_REP=10,OVAL_FPURSE=[3200,1700,1000,600,350,200],OVAL_HPURSE=[300,180,120,80],OVAL_PAY={1:1,2:1.8,3:3},OVAL_FREP=[4,3,2,1],OVAL_SB={};
const OVAL_CAMS=[["auto","Auto","director"],["chase","Chase","behind the car"],["tv","Trackside","TV tower"],["heli","Blimp","from above"],["onboard","Onboard","driver's eye"]];
const OVAL_PACE={save:0.955,steady:0.985,push:0.998};
const OVAL_NAMES=["D. Halvorsen","B. Kowalchuk","R. Whitehorse","T. Lindgren","M. Boucher","C. Yurchak","J. Dufresne","K. Sorenson","A. Pelletier","L. Bergstrom","W. Maddox","S. Okonkwo","G. Tremblay","H. Nordquist","P. Lavallee","E. Stoll","N. Redcrow","F. Haugen","V. Moreau","Z. Kruger"];
const OVAL_PAINT=[0x1d4787,0xb7261d,0xe8e6df,0x2c6b3a,0xd9a52b,0x16181b,0x5b2a86,0xd85f14,0x2a6db5,0x8e2f23,0x3a8f8a,0xc23a7a];
const fmtOv=t=>t==null||!isFinite(t)?"—":t.toFixed(2);
const fmtOvRace=t=>t==null||!isFinite(t)?"—":`${Math.floor(t/60)}:${(t%60).toFixed(1).padStart(4,"0")}`;
const OVAL_TRK=["clay","paved"];
const ovalTk=()=>{const t=S.env.ovalTrack;return SIM.OVAL_TRACKS&&SIM.OVAL_TRACKS[t]?t:"clay";};
const ovalTT=t=>SIM.ovalTrack(t||ovalTk());
const ovalBK=(k,t)=>{t=t||ovalTk();return t==="clay"?k:k+"@"+t;};   // the night book's key: clay keeps the class key, so old saves read as clay
const ovalLabel=t=>(t||ovalTk())==="clay"?"Dirt oval":"Paved oval";
const ovalRecs=t=>{const R=recs(),f=(t||ovalTk())==="clay"?"oval":"oval_"+(t||ovalTk());if(!R[f]||typeof R[f]!=="object")R[f]={};return R[f];};
function ovalOpen(){return career()&&!dev()&&C().rep<OVAL_REP?OVAL_REP:0;}
function ovalClsLocked(k){const c=SIM.OVAL_CLASSES[k];return c&&career()&&!dev()&&C().rep<c.rep?c.rep:0;}
function ovalCiNow(){return quick&&quick.rpms?SIM.ovalCi(quick):0;}
function ovalFitCls(){const ci=ovalCiNow(),O=SIM.OVAL_CLASSES;return["street","late","open"].find(k=>ci<=O[k].ci)||"open";}
function ovalEnvFix(){const e=S.env,O=SIM.OVAL_CLASSES;
  if(!SIM.OVAL_TRACKS[e.ovalTrack])e.ovalTrack="clay";
  if(!O[e.ovalCls])e.ovalCls=ovalFitCls();
  if(!SIM.OVAL_TYRES[e.ovalTyre])e.ovalTyre="med";if(!SIM.OVAL_GRILLES[e.ovalGrille])e.ovalGrille="mid";
  if(!(+e.ovalFinal>=0.6&&+e.ovalFinal<=1.6))e.ovalFinal=1;if(![1,2,4,8].includes(+e.ovalSpd))e.ovalSpd=4;if(!OVAL_CAMS.some(q=>q[0]===e.ovalCam))e.ovalCam="auto";
  if(e.ovalDrive!=="you")e.ovalDrive="auto";return e.ovalCls;}
function ovalLegal(k){const c=SIM.OVAL_CLASSES[k],ci=ovalCiNow();return ci<=c.ci?{ok:true,ci,why:c.ci>=9999?"no displacement limit":`${Math.round(ci)} of ${c.ci} ci`}:{ok:false,ci,why:`${Math.round(ci)} ci is over the ${c.ci} ci limit`};}
/* ---- the night: per class, kept (career: in the save, one a week; sandbox: in memory, gone when the feature is run) ---- */
function ovalBook(){if(!career())return OVAL_SB;if(!C().ovalN||typeof C().ovalN!=="object")C().ovalN={};return C().ovalN;}
function ovalNight(k,fresh){const B=ovalBook(),t=ovalTk(),bk=ovalBK(k,t);let n=B[bk];
  if(n&&career()&&n.week!==C().week){delete B[bk];n=null;}
  if(!n||fresh){const ix=Object.keys(SIM.OVAL_CLASSES).indexOf(k)+1,ti=OVAL_TRK.indexOf(t);let seed;
    if(career()){if(!C().ovalSeed)C().ovalSeed=Math.floor(Math.random()*1e9)+1;seed=(C().ovalSeed^(C().week*7919)^(ix*104729)^(ti*1299709))>>>0;}else seed=Math.floor(Math.random()*1e9)+1;
    n=B[bk]={seed,week:career()?C().week:0,stage:"heat",heat:null,grid:null,hash:null};}
  return n;}
/* career: one oval night a week, one class, either track. This week's night for the class on any track that is over; or another night (any class, the other track) begun */
function ovalRanWk(k){if(!career())return false;const B=ovalBook();return OVAL_TRK.some(t=>{const n=B[ovalBK(k,t)];return !!(n&&n.week===C().week&&n.stage==="done");});}
function ovalOther(k){if(!career())return null;const B=ovalBook(),me=ovalBK(k,ovalTk());for(const bk in B){const n=B[bk];if(bk!==me&&n&&n.week===C().week&&n.stage!=="heat")return bk;}return null;}
/* entry for the night: about 15% of the class's feature win */
function ovalFee(k){const C0=SIM.OVAL_CLASSES[k]||SIM.OVAL_CLASSES.street;return Math.round(OVAL_FPURSE[0]*(OVAL_PAY[C0.tier]||1)*0.15/5)*5;}
function ovalStageNow(){const k=ovalEnvFix(),n=ovalNight(k);return n.stage==="feature"?"feature":"heat";}
/* ---- the field: eleven rivals a night, each a made-up engine and a driver ---- */
const ovalRosterCache=new Map(),ovalRunCache=new Map();
function ovalRoster(k,seed){const key=k+"|"+seed;let R=ovalRosterCache.get(key);if(R)return R;
  const C0=SIM.OVAL_CLASSES[k],F=C0.field,r=pullRand((seed^0x0DA1)>>>0),names=OVAL_NAMES.slice(),paints=OVAL_PAINT.slice(),nums=[];R=[];
  for(let i=0;i<11;i++){const nm=names.splice(Math.floor(r()*names.length),1)[0],gs=Math.sqrt(-2*Math.log(Math.max(1e-6,r())))*Math.cos(2*Math.PI*r());
    const hp=Math.round(Math.max(110,F.hp+gs*F.sd)),skill=+Math.min(0.97,Math.max(0.35,F.skill+(r()-0.5)*0.42)).toFixed(2);let num;do{num=Math.floor(r()*98)+1;}while(nums.includes(num));nums.push(num);
    R.push({i,n:nm,hp,skill,num,tyre:r()<0.22?"soft":r()<0.3?"hard":"med",fk:+(0.96+0.08*r()).toFixed(3),paint:paints.splice(Math.floor(r()*paints.length),1)[0],groove:+(-4.5+8*r()).toFixed(1),dnfH:r()<0.03,dnfF:r()<0.08,dnfAt:r()});}
  if(ovalRosterCache.size>8)ovalRosterCache.clear();ovalRosterCache.set(key,R);return R;}
function ovalGridOff(g){return Math.floor(g/2)*9+(g%2)*4.5;}
/* a rival's race, run through the sim: trace samples (t, s every 0.25 s), line crossings, a DNF if the dice say so */
function ovalCarRun(R,k,seed,stage,laps,off,lap0,moist,tk){
  tk=tk||ovalTk();const key=[k,seed,stage,R.i,laps,off,lap0,tk].join("|");let c=ovalRunCache.get(key);if(c)return c;
  const night=SIM.ovalNight(seed,tk),res=R.res||(R.res=SIM.ovalAiRes(R.hp,(seed^((R.i+1)*977))>>>0));
  const veh={cls:k,track:tk,tyre:R.tyre,grille:"mid",finalK:R.fk,redline:res.redline,idle:850,seed:(seed^((R.i+1)*2654435761)^(stage==="heat"?1:2))>>>0,noFail:true,laps,off,night,moist,lap0};
  let p;try{p=SIM.ovalPass(res,veh,R.skill,0.05);}catch(e){p=null;}
  const T=[0],Sx=[-off],cross=[];
  if(p){p.st.trace.forEach(q=>{T.push(q[0]);Sx.push(q[1]);});let a=0;p.st.laps.forEach(x=>{a+=x;cross.push(a);});}
  const L=SIM.ovalTrack(tk).len;if(!cross.length){for(let i=1;i<=laps;i++)cross.push(i*26);}
  c={id:R.i,len:L,n:R.n,num:R.num,color:R.paint,groove:R.groove,hp:R.hp,skill:R.skill,t:Float32Array.from(T),s:Float32Array.from(Sx),cross,fin:cross.length>=laps?cross[laps-1]:null,dnf:null,cut:null,best:p?p.st.bestLap:null,laps:p?p.st.laps.slice():[]};
  if((stage==="heat"?R.dnfH:R.dnfF)&&laps>=4){const lap=2+Math.floor(R.dnfAt*(laps-3));c.dnf={lap,t:cross[lap-1]+0.3*(cross[lap]-cross[lap-1])};c.fin=null;}
  if(ovalRunCache.size>80)ovalRunCache.clear();ovalRunCache.set(key,c);return c;}
/* where a rival is at race time t: total distance and speed (null once he is out) */
function ovalAt(c,t){if(c.dnf&&t>=c.dnf.t)return null;const T=c.t,Sx=c.s,n=T.length;let s,v;
  if(c.cut&&t>=c.cut.t){s=c.cut.s+20*(t-c.cut.t);v=20;}
  else if(t>=T[n-1]){const dv=(Sx[n-1]-Sx[n-2])/Math.max(0.01,T[n-1]-T[n-2]);s=Sx[n-1]+dv*(t-T[n-1]);v=dv;}
  else{let lo=0,hi=n-1;while(hi-lo>1){const m=(lo+hi)>>1;if(T[m]<=t)lo=m;else hi=m;}const f=(t-T[lo])/Math.max(1e-6,T[hi]-T[lo]);s=Sx[lo]+(Sx[hi]-Sx[lo])*f;v=(Sx[hi]-Sx[lo])/Math.max(1e-6,T[hi]-T[lo]);}
  return{s,v};}
/* the order the flag comes out in: laps first, then the clock; the ones that broke last */
function ovalSortRows(rows){return rows.sort((a,b)=>(a.dnf?1:0)-(b.dnf?1:0)||b.laps-a.laps||(a.dnf?0:a.time-b.time)||(a.me?-1:b.me?1:0));}
function ovalCutAt(c,Tw,laps){if(c.dnf){c.cut=null;return{laps:c.cross.filter(x=>x<c.dnf.t).length,time:null,dnf:true};}
  let k=0;while(k<c.cross.length-1&&c.cross[k]<Tw-1e-6)k++;k=Math.min(k,laps-1);c.cut={t:c.cross[k],s:(k+1)*c.len};return{laps:k+1,time:c.cross[k],dnf:false};}
/* the feature's field is eleven whole races: run them one at a time in the idle moments after the heat, so the green is not a pause */
function ovalWarm(k,n,tk){if(!n||!n.grid||n.stage!=="feature")return;const R=ovalRoster(k,n.seed),q=n.grid.map((id,g)=>[id,g]).filter(x=>x[0]!=="me");let i=0;
  const nx=()=>{if(i>=q.length||testing||n.stage!=="feature")return;const[id,g]=q[i++];try{ovalCarRun(R[id],k,n.seed,"feature",OVAL_FEAT,ovalGridOff(g),OVAL_HEAT,0.6,tk);}catch(e){}setTimeout(nx,50);};nx();}
/* the other heat: four rivals racing without us, to interleave with ours for the feature grid */
function ovalHeatB(k,seed,tk){const R=ovalRoster(k,seed),ids=ovalSplit(seed).b,g=ids.slice();const cars=g.map((id,gi)=>ovalCarRun(R[id],k,seed,"heatB",OVAL_HEAT,ovalGridOff(gi),0,0.9,tk));
  const win=Math.min(...cars.filter(c=>!c.dnf).map(c=>c.fin));return ovalSortRows(cars.map(c=>Object.assign({id:c.id},ovalCutAt(c,win,OVAL_HEAT)))).map(r=>r.id);}
function ovalSplit(seed){const r=pullRand((seed^0x5E17)>>>0),ids=[0,1,2,3,4,5,6,7,8,9,10];for(let i=ids.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}return{a:ids.slice(0,7),b:ids.slice(7)};}
/* ---- the sheet that sets the race up ---- */
function ovalSetupFor(res){const e=S.env,k=ovalEnvFix();return SIM.ovalSetup(res,{cls:k,track:ovalTk(),tyre:e.ovalTyre,finalK:+e.ovalFinal,redline:S.cfg.redline,seed:ovalNight(k).seed});}
function ovalTrackSvg(){const TT=ovalTT(),pv=TT.surf==="asphalt",O=TT,R=O.R,ls=O.ls,W=ls+2*R+40,H=2*R+30,x0=-W/2,y0=-H/2,fs=Math.max(1,W/330);
  const d=`M${-ls/2},${R} L${ls/2},${R} A${R},${R} 0 0 0 ${ls/2},${-R} L${-ls/2},${-R} A${R},${R} 0 0 0 ${-ls/2},${R} Z`;
  return `<svg class="ovtrk" viewBox="${x0} ${y0} ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="The track: a banked ${pv?"half-mile paved":"three-eighths-mile clay"} oval, driven anticlockwise"><path d="${d}" fill="none" stroke="${pv?"rgba(96,102,110,.8)":"rgba(150,110,70,.55)"}" stroke-width="${O.w+6}" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${pv?"rgba(235,235,230,.75)":"rgba(190,150,100,.8)"}" stroke-width="1.6" stroke-dasharray="${pv?"9 7":"5 6"}"/><line x1="0" x2="0" y1="${R-12}" y2="${R+12}" stroke="var(--chalk)" stroke-width="3"/><text x="0" y="${R+26*fs}" font-size="${14*fs}" text-anchor="middle" fill="var(--muted)">start / finish</text><text x="${ls/2+R*0.1}" y="4" font-size="${11*fs}" text-anchor="middle" fill="var(--muted)">turns 1+2</text><text x="${-ls/2-R*0.1}" y="4" font-size="${11*fs}" text-anchor="middle" fill="var(--muted)">turns 3+4</text><text x="0" y="5" font-size="${13*fs}" text-anchor="middle" fill="var(--dim)">${TT.bankDeg}° banked ${pv?"asphalt":"clay"}</text></svg>`;}
function ovalLadder(n,k){const C0=SIM.OVAL_CLASSES[k],h=n.heat,st=n.stage;
  const step=(on,done,lbl,sub)=>`<div class="ovs${done?" done":on?" on":""}"><b>${lbl}</b><small>${sub}</small></div>`;
  return `<div class="ovn">${step(st==="heat",st!=="heat",`Heat race`,st==="heat"?`${OVAL_HEAT} laps · 8 cars`:h?(h.dnf?"DNF":ordN(h.place)+" of "+h.of):"")}<i></i>${step(st==="feature",st==="done",`Feature`,st==="feature"?`${OVAL_FEAT} laps · starts ${ordN(n.gridMe+1)}`:st==="done"&&n.feat?ordN(n.feat.place)+" of "+n.feat.of:`${OVAL_FEAT} laps · 12 cars`)}</div>`;}
function ovalEnvHtml(sl){const e=S.env,k=ovalEnvFix(),tk=ovalTk(),TT=ovalTT(tk),pv=TT.surf==="asphalt",C0=SIM.OVAL_CLASSES[k],lk=ovalClsLocked(k),lg=ovalLegal(k),R=ovalOpen(),n=ovalNight(k),rec=ovalRecs()[k],q=quick&&quick.rpms?quick:null;
  let h=`<div class="saltcls"><div><span>Tonight's track</span><b>${TT.dist}</b><small>${TT.bankDeg}° bank · ${esc(SIM.ovalNight(n.seed,tk).name)}${TT.surf==="asphalt"?" asphalt":""}</small></div><div><span>The night</span><b>${n.stage==="done"?"over":n.stage==="feature"?"feature":"heat"}</b><small>${n.stage==="feature"?`starts ${ordN(n.gridMe+1)} of 12`:n.stage==="done"?(n.feat?`finished ${ordN(n.feat.place)}`:"—"):`${OVAL_HEAT} laps, then ${OVAL_FEAT}`}</small></div><div><span>Your best</span><b>${rec&&rec.lap?fmtOv(rec.lap)+" s":"—"}</b><small>${rec?(rec.wins?rec.wins+" feature win"+(rec.wins===1?"":"s"):"best finish "+ordN(rec.best)):"no night yet"}</small></div></div>${ovalTrackSvg()}${ovalLadder(n,k)}`;
  h+=`<div class="lbl"><span>Track</span></div><div class="seg n2">${OVAL_TRK.map(id=>{const t=SIM.OVAL_TRACKS[id];return `<button data-ok="ovalTrack" data-ov="${id}" class="${tk===id?"on":""}">${t.n}<small>${t.dist} · ${t.bankDeg}° · ${t.surf}</small></button>`;}).join("")}</div>`;
  h+=`<div class="lbl"><span>Class</span></div><div class="seg wide">${Object.entries(SIM.OVAL_CLASSES).map(([id,c])=>{const l=ovalClsLocked(id),ok=ovalCiNow()<=c.ci;return `<button data-ok="ovalCls" data-ov="${id}" class="${k===id?"on":""}${l||!ok?" lock":""}">${c.n}<small>${l?l+" rep":c.ci>=9999?"no ci limit":"up to "+c.ci+" ci"+(ok?"":" · too big")}</small></button>`;}).join("")}</div>`;
  h+=driverToggle(id=>`data-ok="ovalDrive" data-ov="${id}"`,e.ovalDrive,"hold PUSH or SAVE for the pace","a steady driver · watch the race");
  h+=`<div class="lbl"><span>Tyres</span></div><div class="seg">${Object.entries(SIM.OVAL_TYRES).map(([id,t])=>`<button data-ok="ovalTyre" data-ov="${id}" class="${e.ovalTyre===id?"on":""}">${t.n}<small>${t.d}</small></button>`).join("")}</div>`;
  h+=`<div class="lbl"><span>Grille</span></div><div class="seg">${Object.entries(SIM.OVAL_GRILLES).map(([id,t])=>`<button data-ok="ovalGrille" data-ov="${id}" class="${e.ovalGrille===id?"on":""}">${t.n}<small>${t.d}</small></button>`).join("")}</div>`;
  h+=`<div class="envgrid">${sl("ovalFinal","Rear end ratio",0.6,1.6,0.01," × fitted",(+e.ovalFinal).toFixed(2))}</div>`;
  if(q){try{const res=quick,su=ovalSetupFor(res);h+=`<p class="hint"><b>One gear</b> · the car has no gearbox to speak of: engine speed is road speed times the rear end. At ${su.ratio.toFixed(2)}:1 the corners (${Math.round(su.vc*3.6)} km/h) turn it ${Math.round(su.rpmC).toLocaleString("en-CA")} rpm, where it makes <b>${Math.round(su.tqC)} Nm</b>; the redline is the top of the straight (${Math.round(su.topKmh)} km/h). The corner exit wants torque, not peak power. A taller ratio (below 1.00) trades corner exit for the straight.${pv?" The half-mile has long straights and fast corners: the top end, the gearing and the cooling count for more here.":""}</p>`;}catch(err){}}
  h+=`<p class="hint">${C0.n}: ${C0.d}. ${lg.ok?`Your engine is ${Math.round(lg.ci)} ci.`:`<b style="color:var(--crit)">${lg.why}</b> — pick a bigger class.`}${lk?` <b>Opens at ${lk} rep</b> — earn it by shipping orders and placing in events.`:""} ${pv?"The pavement grips hard and steady and only greases up a little as the rubber and the heat build, with hardly any dust to clog the grille; the long straights make cooling and drag the hard part.":"The clay starts tacky and dries slick as the laps pile up."} Softer tyres bite early and fade late. The heat sets the feature grid; the rivals' lap times are real, from the same sim you drive.${ovalRanWk(k)?` <b>Run this week — the next night is week ${C().week+1}.</b>`:ovalOther(k)?` <b>You've raced an oval night this week — one night a week.</b>`:""}${R?` <b>The oval opens at ${R} rep.</b>`:""}</p>`;
  h+=`<div class="lbl"><span>Camera</span></div><div class="seg n5">${OVAL_CAMS.map(([id,nm,d])=>`<button data-ok="ovalCam" data-ov="${id}" class="${e.ovalCam===id?"on":""}">${nm}<small>${d}</small></button>`).join("")}</div>`;
  h+=`<div class="lbl"><span>Playback</span></div><div class="seg n4">${[1,2,4,8].map(v=>`<button data-ok="ovalSpd" data-ov="${v}" class="${+e.ovalSpd===v?"on":""}">${v}×<small>${v===1?"real time":v===2?"double":v===4?"quick":"quicker"}</small></button>`).join("")}</div>`;
  return h;}
$("envBox").addEventListener("click",e=>{const b=e.target.closest("[data-ok]");if(!b)return;const k=b.dataset.ok,v=b.dataset.ov;
  if(k==="ovalCls"){const l=ovalClsLocked(v);if(l){toast(`${SIM.OVAL_CLASSES[v].n} opens at ${l} rep`);return;}if(ovalCiNow()>SIM.OVAL_CLASSES[v].ci){toast(`${Math.round(ovalCiNow())} ci is over the ${SIM.OVAL_CLASSES[v].ci} ci limit for ${SIM.OVAL_CLASSES[v].n}`);return;}}
  if(k==="ovalTrack"&&OV&&!OV.finished){toast("Finish this race first");return;}
  S.env[k]=(k==="ovalSpd")?+v:v;ovalEnvFix();if(OV&&!OV.finished){if(k==="ovalCam")OV.cam=v;if(k==="ovalSpd")OV.speed=+v;}renderEnv();save();buzz(6);});
function ovalHint(){const pv=ovalTT().surf==="asphalt",lb=ovalLabel();return career()?`<b>${lb}</b> · ${fmt$(ovalFee("street"))}–${fmt$(ovalFee("open"))} entry for the night: a ${OVAL_HEAT}-lap heat, then the ${OVAL_FEAT}-lap feature from the grid the heat sets. Needs a certified engine; one night a week, in one class, on either track. Opens at ${OVAL_REP} rep: ${SIM.OVAL_CLASSES.street.n} ${SIM.OVAL_CLASSES.street.rep}, ${SIM.OVAL_CLASSES.late.n} ${SIM.OVAL_CLASSES.late.rep}, ${SIM.OVAL_CLASSES.open.n} ${SIM.OVAL_CLASSES.open.rep}. Purses by finish, up to ${fmt$(OVAL_FPURSE[0]*OVAL_PAY[3])} in the feature. ${pv?"Heat and the long straights are the hard part: there is little dust, but the engine works flat out.":"Heat and radiator dust are the hard part: running in the car ahead's dirt clogs the grille."}`
  :`<b>${lb}</b> · a heat race, then the feature. It is one gear and a lot of throttle: hold <b>PUSH</b> to attack, <b>SAVE</b> to cool the engine and the tyres. <b>Space</b> pushes. Class by cubic inches.`;}
/* the dock button: the stage that is up, the price */
function ovalRunBtn(){if(S.env.testType!=="oval"||testing)return;const k=ovalEnvFix(),n=ovalNight(k),b=$("runTest");if(b.disabled)return;const cost=testCost();
  if(career()&&(n.stage==="done"||(n.stage==="heat"&&ovalOther(k)))){b.textContent=`Night over · next night wk ${C().week+1}`;$("dynoHint").innerHTML=ovalHint();return;}
  const txt=n.stage==="feature"?`Take the green · feature, from ${ordN(n.gridMe+1)}`:"Take the green · heat race";
  b.textContent=txt+(cost?" · "+fmt$(cost)+(fuelBill()>=50&&fuelBill()<cost?" (fuel "+fmt$(fuelBill())+")":""):"");$("dynoHint").innerHTML=ovalHint();}
function ovalCost(){if(!career())return 0;const k=ovalEnvFix(),n=ovalNight(k);if(n.stage==="done"||(n.stage==="heat"&&ovalOther(k)))return 0;return(n.stage==="heat"?ovalFee(k):0)+fuelBill();}
/* the gate in front of the run: false lets it run (the toast says why not) */
function ovalGate(){if(S.bay){toast(`${S.bay.practice?"Practice":"Customer"} engine on the dyno — hand it back or walk away first`);return true;}
  const k=ovalEnvFix(),o=ovalOpen(),l=ovalClsLocked(k),lg=ovalLegal(k),n=ovalNight(k);
  if(o){toast(`The oval opens at ${o} rep`);return true;}if(l){toast(`${SIM.OVAL_CLASSES[k].n} opens at ${l} rep`);return true;}
  if(!lg.ok){toast(`Not legal for ${SIM.OVAL_CLASSES[k].n} — ${lg.why}`);return true;}
  if(career()){const cert=C().cert&&C().cert.ok&&C().cert.hash===cfgHash(S.cfg);
    if(n.stage==="done"||(n.stage==="heat"&&ovalOther(k))){toast(`Already raced the oval this week — one night a week; the next is week ${C().week+1}`);return true;}
    if(n.stage==="heat"&&!cert){toast("Certify this engine on the dyno first");return true;}
    if(n.stage==="feature"&&!cert&&!(n.hash===hKey(cfgHash(S.cfg))&&!(n.heat&&n.heat.dnf))){toast(n.heat&&n.heat.dnf?"Certify the rebuilt engine to take the feature":"The engine changed since the heat — certify it to take the feature");return true;}}
  return false;}
/* ---- the live card ---- */
function ovalHudInit(){$("ovalLive").innerHTML=`<div class="rdh hlh"><div class="rd-spd"><b id="ovV">0</b><i>km/h</i></div><div class="rd-g"><b id="ovP">–</b><i id="ovPi">place</i></div><div class="rd-lt"><b id="ovLap">0/${OV.laps}</b><i>lap</i></div><div class="rd-lt"><b id="ovT">0:00.0</b><i id="ovTi">clock</i></div></div>
  <div class="ph-bar hl-bar"><i class="fill" id="ovF"></i><i class="mk lead" id="ovL" style="left:0"></i></div>
  <div class="ph-lbl" style="margin-top:4px"><span id="ovA">—</span><span id="ovB"></span></div>
  <div class="hl-next" id="ovN"></div><div class="hl-meters" id="ovM"></div>`;}
function ovalRanks(t){const me=OV.p.st,L=OV.L,out=[{me:true,key:ovalMeProg(),c:null,t:OV.meCut?OV.meCut.t:0}];
  OV.cars.forEach(c=>{const a=ovalAt(c,t);if(!a){out.push({key:-1e9+(c.dnf?c.dnf.lap:0),c,out:true,t:0});return;}out.push({key:c.cut&&t>=c.cut.t?c.cut.s+1e-3*(1-c.cut.t/1e4):a.s,c,s:a.s,v:a.v,t:c.cut?c.cut.t:0});});
  out.sort((x,y)=>y.key-x.key);return out;}
function ovalMeProg(){const st=OV.p.st;return OV.meCut?Math.min(st.s,OV.meCut.s)+1e-3*(1-OV.meCut.t/1e4):st.s;}
function ovalHud(rk){if(!OV||!$("ovV"))return;const st=OV.p.st,t=st.t,pos=rk.findIndex(r=>r.me)+1,N=OV.laps,L=OV.L;
  $("ovV").textContent=Math.round(st.v*3.6);$("ovP").textContent=pos||"–";$("ovPi").textContent=`of ${OV.cars.length+1}`;
  $("ovLap").textContent=`${Math.min(N,st.lap+1)}/${N}`;$("ovT").textContent=fmtOvRace(t);$("ovTi").textContent=OV.pre>0?"on the grid":st.done?(st.broke?"out":"flag"):OV.stageName;
  $("ovF").style.width=(100*Math.min(1,Math.max(0,st.s)/(N*L))).toFixed(2)+"%";
  const leader=rk[0];$("ovL").style.left=(100*Math.min(1,Math.max(0,leader.me?st.s:(leader.s||0))/(N*L))).toFixed(2)+"%";
  const ahead=pos>1?rk[pos-2]:null,behind=pos<rk.length?rk[pos]:null,vv=Math.max(8,st.v),gp=(a,b)=>Math.abs((a.me?st.s:a.s||0)-(b.me?st.s:b.s||0))/vv;
  $("ovA").innerHTML=ahead&&!ahead.out?`<b>#${ahead.c?ahead.c.num:"—"}</b> ${ahead.c?esc(ahead.c.n):""} <b style="color:var(--crit)">+${gp(rk[pos-1],ahead).toFixed(1)}s</b>`:`<b>leading</b>`;
  $("ovB").innerHTML=behind&&!behind.out?`<b>#${behind.c?behind.c.num:"—"}</b> <b style="color:var(--good)">−${gp(rk[pos-1],behind).toFixed(1)}s</b>`:"";
  const fd=OV.feed.slice(-2).map(x=>`<div class="hl-c">${x}</div>`).join("");
  let nx=st.broke?`<div class="hl-ev bad">${ovalFailWord(st.broke)}</div>`:st.done?`<div class="hl-ev good">CHEQUERED · ${ordN(pos)}</div>`:OV.pre>0?`<div class="hl-ev">GREEN IN ${Math.ceil(OV.pre)}…</div>`:fd||`<div class="hl-c dim">Green flag. ${OV.stage==="heat"?"Eight laps":"Twenty-five laps"} to go.</div>`;
  if($("ovN").dataset.k!==nx){$("ovN").dataset.k=nx;$("ovN").innerHTML=nx;}
  const cc=st.cool,wr=Math.round(100*Math.min(1.2,st.wear)),mode=OV.auto?"auto":OV.push?"push":OV.save?"save":"steady";
  $("ovM").innerHTML=`<div class="peak"><b style="color:${cc>112?"var(--crit)":cc>104?"var(--warn)":""}">${Math.round(cc)}<i>°C</i></b><span>water${st.derate<0.999?" · derate":""}${st.radPack>0.35?" · clogged":""}</span></div><div class="peak"><b style="color:${wr>80?"var(--crit)":wr>55?"var(--warn)":""}">${wr}<i>%</i></b><span>tyres worn</span></div><div class="peak"><b class="hl-mode ${mode==="push"?"push":mode==="save"?"lift":mode==="auto"?"auto":""}">${mode.toUpperCase()}</b><span>${OV.auto?"tap to take over":st.slideT>0?"SLIDING":"pace"}</span></div>`;
  ovalBtnText();}
function ovalFailWord(kind){return kind==="head_lift"?"COOKED IT · HEAD LIFTED":kind==="turbo"?"TURBO GONE":kind==="piston"||kind==="crown_temp"?"BURNED A PISTON":"ENGINE GONE";}
function ovalBtnText(){const p=$("ovalPush"),l=$("ovalSave");if(!p||!OV)return;const st=OV.p.st,k=(OV.auto?"a":"m")+(st.done?"d":"")+(OV.push?"p":"")+(OV.save?"s":"");if(p.dataset.k===k)return;p.dataset.k=k;
  if(st.done){p.innerHTML=`${st.broke?"OUT":"FLAG"}<small>tap to skip</small>`;l.innerHTML=`—<small>&nbsp;</small>`;}
  else if(OV.auto){p.innerHTML=`AUTO DRIVER<small>tap to take over</small>`;l.innerHTML=`SAVE<small>take over</small>`;}
  else{p.innerHTML=`PUSH<small>${OV.push?"attacking":"hold to attack the corners"}</small>`;l.innerHTML=`SAVE<small>${OV.save?"easing it":"hold to cool the engine"}</small>`;}
  p.classList.toggle("on",!!OV.push);l.classList.toggle("on",!!OV.save);const s=$("ovalSpdB");if(s)s.textContent=OV.speed+"×";}
function ovalCtl(){if(!OV||OV.auto)return null;return{c:OV.push?OVAL_PACE.push:OV.save?OVAL_PACE.save:OVAL_PACE.steady};}
function ovalTakeOver(){if(!OV||!OV.auto||OV.p.st.done)return;OV.auto=false;OV.took=Math.round(OV.p.st.lap);buzz([20]);toast("You have it — hold PUSH to attack, SAVE to cool it");}
function ovalPress(which){if(!OV||OV.finished)return;const st=OV.p.st;if(st.done){ovalSkip();return;}
  if(OV.auto){ovalTakeOver();if(which==="save")OV.save=true;return;}
  if(which==="save"){OV.save=true;OV.push=false;}else{OV.push=true;OV.save=false;}buzz(6);ovalBtnText();}
function ovalRelease(which){if(!OV)return;if(which==="save")OV.save=false;else OV.push=false;ovalBtnText();}
/* ---- the race ---- */
function ovalStart(){
  const k=ovalEnvFix(),e=S.env,C0=SIM.OVAL_CLASSES[k],n=ovalNight(k),stage=n.stage==="feature"?"feature":"heat",env=stdEnv();
  let res;try{res=SIM.ovalPrep(S.cfg,env);}catch(err){testing=false;renderTest();toast("The engine wouldn't run");return;}
  const wi=wearInfo(res);if(wi&&wi.w>0){const f=1-0.05*Math.min(1,wi.w);res.torque=res.torque.map(t=>t*f);if(res.naTorque)res.naTorque=res.naTorque.map(t=>t*f);res.power=res.power.map(t=>t*f);res.peakTq*=f;res.peakHp*=f;res.wornBy=Math.round((1-f)*100);}
  $("app").classList.add("onstrip");
  const tk=ovalTk(),snap=testSnap(),hk=hKey(snap.h),roster=ovalRoster(k,n.seed),laps=stage==="heat"?OVAL_HEAT:OVAL_FEAT,L=SIM.ovalTrack(tk).len;let cars,gridMe,order;
  if(stage==="heat"){const sp=ovalSplit(n.seed),ids=sp.a.slice(),r=pullRand((n.seed^0x6A1D)>>>0);ids.push("me");for(let i=ids.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
    order=ids;gridMe=ids.indexOf("me");cars=[];ids.forEach((id,g)=>{if(id!=="me")cars.push(ovalCarRun(roster[id],k,n.seed,"heat",laps,ovalGridOff(g),0,0.9,tk));});}
  else{order=n.grid.slice();gridMe=order.indexOf("me");cars=[];order.forEach((id,g)=>{if(id!=="me")cars.push(ovalCarRun(roster[id],k,n.seed,"feature",laps,ovalGridOff(g),OVAL_HEAT,0.6,tk));});}
  cars.forEach(c=>{c.cut=null;});
  if(career()&&stage==="heat"){n.hash=hKey(cfgHash(S.cfg));}
  const winAi=Math.min(...cars.filter(c=>!c.dnf&&c.fin!=null).map(c=>c.fin));
  const veh={cls:k,track:tk,tyre:e.ovalTyre,grille:e.ovalGrille,finalK:+e.ovalFinal,redline:S.cfg.redline,idle:SIM.isDiesel&&SIM.isDiesel(S.cfg)?720:Math.max(750,S.cfg.cam>70?1100:850),seed:career()?(n.seed+7919*(C().ovalRuns=(C().ovalRuns||0)+1))>>>0:Math.floor(Math.random()*1e9),laps,off:ovalGridOff(gridMe),night:SIM.ovalNight(n.seed,tk),
    moist:stage==="heat"?0.9:0.6,lap0:stage==="heat"?0:OVAL_HEAT,skill:0.9};
  if(wi&&wi.w>=1)veh.wornAt=Math.max(2,Math.round(laps*(0.3+0.5*Math.random())));
  veh.gap=(s,t)=>{let g=Infinity;for(let i=0;i<cars.length;i++){const a=ovalAt(cars[i],t);if(!a)continue;const d=(((a.s-s)%L)+L)%L;if(d<g&&d>1.2)g=d;}return g;};
  const p=SIM.ovalNew(res,veh);
  let meNum=(parseInt(hk,36)%97)+2;while(roster.some(q=>q.num===meNum))meNum=meNum%98+1;
  OV={p,res,env,veh,k,tk,L,stage,stageName:stage==="heat"?"heat":"feature",snap,hk,night:n,laps,cars,order,gridMe,winT:winAi,flagged:false,cutDone:false,meCut:null,auto:e.ovalDrive!=="you",took:null,push:false,save:false,speed:+e.ovalSpd||4,cam:e.ovalCam||"auto",pre:3,last:performance.now(),finished:false,skip:false,doneAt:null,acc:0,feed:[],posLaps:[],lapSeen:0,meNum,color:carPaint(),roster};
  ENGINE_VIS.setAutoRotate(false);$("rpmbox").style.display="block";$("ovalCtl").style.display="";ovalHudInit();$("ovalPush").dataset.k="";
  $("testProg").classList.remove("done");sfx("start");
  requestAnimationFrame(()=>{const pn=$("panel"),r=$("ovalCtl").getBoundingClientRect(),pr=pn.getBoundingClientRect(),bot=Math.min(pr.bottom,tabsTop())-8;if(r.bottom>bot||r.top<pr.top)pn.scrollTo({top:pn.scrollTop+(r.height>bot-pr.top?r.top-pr.top-4:r.bottom-bot),behavior:calmScroll()});});
  let hudT=0;
  const step=()=>{if(!OV||OV.finished)return;const now=performance.now(),dt=Math.min(0.1,(now-OV.last)/1000);OV.last=now;const st=OV.p.st;
    if(OV.pre>0)OV.pre-=dt;
    else if(!st.done){OV.acc+=dt*OV.speed;let nn=0;while(OV.acc>=0.02&&!st.done&&nn++<800){OV.p.step(0.02,ovalCtl());OV.acc-=0.02;ovalWatch();}if(nn>=800)OV.acc=0;}
    if(st.done&&OV.doneAt==null){OV.doneAt=now;if(st.broke){$("flash").style.background="rgba(238,90,94,.45)";setTimeout(()=>$("flash").style.background="rgba(238,90,94,0)",300);sfx("fail");buzz([80,40,120]);}else{$("flash").style.background="rgba(92,191,138,.35)";setTimeout(()=>$("flash").style.background="rgba(238,90,94,0)",400);buzz([30,40,30,40,90]);}}
    const t=st.t,rk=ovalRanks(t),L2=OV.L,after=st.done?(now-OV.doneAt)/1000:0;
    const meS=st.done?(OV.meCut?OV.meCut.s+(st.broke?0:20)*after:st.s+(st.broke?0:20*after)):st.s;
    const carsV=[{me:true,s:meS,v:st.done?(st.broke?Math.max(0,st.v-8*after):20):st.v,color:OV.color,num:OV.meNum,n:engineName().slice(0,12),groove:1.6,slide:st.slideT>0?Math.min(1,st.slideT+0.2):0,thr:st.tf,brk:st.thr<0.02&&st.acc<-2?1:0,spin:Math.min(1,Math.max(0,st.spin-1))}];
    OV.cars.forEach(c=>{const a=OV.pre>0?{s:-ovalGridOff(OV.order.indexOf(c.id)),v:0}:ovalAt(c,t);carsV.push(a?{s:a.s,v:a.v,color:c.color,num:c.num,n:c.n,groove:c.groove,thr:0.6,brk:0}:{gone:true,s:0,v:0,color:c.color});});
    if(OV.pre>0){carsV[0].s=-OV.veh.off;carsV[0].v=0;}
    const top=rk.filter(r=>!r.out).slice(0,12).map(r=>r.me?{num:OV.meNum,n:"YOU",me:true}:{num:r.c.num,n:r.c.n.split(" ").pop()});
    if(ENGINE_VIS.setOval)ENGINE_VIS.setOval({on:true,track:SIM.ovalTrack(OV.tk),cars:carsV,pre:OV.pre>0,done:st.done&&after>0.4,flag:st.done?"checker":OV.pre>0?"yellow":st.lap>=OV.laps-1?"white":"green",cam:OV.cam,night:!!S.night,lastLap:st.lap>=OV.laps-1,toFlag:(OV.laps*L2-st.s)/Math.max(10,st.v),order:top,boardHead:OV.stage==="heat"?"HEAT RACE":"FEATURE",dt:dt*(OV.pre>0||st.done?1:OV.speed)});
    if((hudT+=dt)>0.1||st.done){hudT=0;ovalHud(rk);}
    run.on=true;run.rpm=st.done?run.rpm+(OV.veh.idle-run.rpm)*Math.min(1,dt*3):OV.pre>0?OV.veh.idle+900*Math.max(0,Math.sin(now/200)):st.rpm;run.load=st.done?0:Math.max(0.05,st.tf);$("rpmLbl").textContent=Math.round(run.rpm/10)*10;
    $("testProg").style.width=Math.min(100,100*Math.max(0,st.s)/(OV.laps*L2))+"%";
    if(st.done&&(OV.skip||now-OV.doneAt>(st.broke?2600:3400)))ovalFinish();else requestAnimationFrame(step);};
  requestAnimationFrame(step);
}
/* what the flag, the line and the pit board do each step */
function ovalFlag(Tw){OV.cars.forEach(c=>ovalCutAt(c,Tw,OV.laps));OV.winT=Tw;OV.cutDone=true;}
function ovalWatch(){const st=OV.p.st,L=OV.L;
  if(!OV.cutDone&&!st.done&&isFinite(OV.winT)&&st.t>=OV.winT){OV.flagged=true;ovalFlag(OV.winT);}
  if(st.lap>OV.lapSeen){OV.lapSeen=st.lap;const rk=ovalRanks(st.t),pos=rk.findIndex(r=>r.me)+1,prev=OV.posLaps.length?OV.posLaps[OV.posLaps.length-1]:OV.gridMe+1;OV.posLaps.push(pos);
    const lt=st.laps[st.laps.length-1],best=Math.min.apply(null,st.laps),ah=pos>1?rk[pos-2]:null,gp=ah&&!ah.out?Math.abs(st.s-(ah.s||st.s))/Math.max(8,st.v):null;
    OV.feed.push(`<b>L${st.lap}</b> · <b>P${pos}</b>${pos<prev?` <span style="color:var(--good)">▲${prev-pos}</span>`:pos>prev?` <span style="color:var(--crit)">▼${pos-prev}</span>`:""} · ${lt.toFixed(2)}${lt<=best+1e-6?" <b style=\"color:var(--good)\">best</b>":""}${gp!=null?` · +${gp.toFixed(1)} s to P${pos-1}`:""}`);if(OV.feed.length>8)OV.feed.shift();
    if(OV.flagged&&!st.done){st.done=true;st.finish=st.t;st.stopWhy="flag";}}
  if(st.done&&!st.broke&&!OV.meCut)OV.meCut={t:st.t,s:st.lap*L};
  if(st.done&&!OV.cutDone)ovalFlag(st.broke?OV.winT:Math.min(OV.winT,st.t));}
function ovalSkip(){if(!OV||OV.finished)return;const p=OV.p,st=p.st;OV.pre=0;if(!OV.auto&&OV.took==null&&st.lap>0)OV.handed=st.lap;let n=0;while(!st.done&&n++<200000){p.step(0.04,OV.auto?null:ovalCtl());ovalWatch();}OV.skip=true;if(OV.doneAt==null)OV.doneAt=performance.now()-4000;}
(()=>{const bind=(id,w)=>{const b=$(id);
  b.addEventListener("pointerdown",e=>{e.preventDefault();OV&&(OV.lastPtr=performance.now());try{b.setPointerCapture(e.pointerId);}catch(x){}ovalPress(w);});
  b.addEventListener("pointerup",()=>{OV&&(OV.lastPtr=performance.now());ovalRelease(w);});b.addEventListener("pointercancel",()=>ovalRelease(w));b.addEventListener("contextmenu",e=>e.preventDefault());
  b.addEventListener("keydown",e=>{if((e.key===" "||e.key==="Enter")&&!e.repeat){e.preventDefault();ovalPress(w);}});b.addEventListener("keyup",e=>{if(e.key===" "||e.key==="Enter"){e.preventDefault();ovalRelease(w);}});
  b.addEventListener("click",()=>{if(!OV||performance.now()-(OV.lastPtr||0)<800)return;ovalPress(w);setTimeout(()=>ovalRelease(w),400);});};
  bind("ovalPush","push");bind("ovalSave","save");
  $("ovalSkip").addEventListener("click",()=>ovalSkip());
  $("ovalSpdB").addEventListener("click",()=>{if(!OV)return;OV.speed=OV.speed>=8?1:OV.speed*2;S.env.ovalSpd=OV.speed;ovalBtnText();$("ovalSpdB").textContent=OV.speed+"×";save();});
  $("ovalCamB").addEventListener("click",()=>{const ids=OVAL_CAMS.map(c=>c[0]),cur=OV?OV.cam:S.env.ovalCam,nx=ids[(ids.indexOf(cur)+1)%ids.length];S.env.ovalCam=nx;if(OV)OV.cam=nx;$("ovalCamB").textContent="Cam · "+OVAL_CAMS.find(c=>c[0]===nx)[1];save();});
  document.addEventListener("keydown",e=>{if(e.defaultPrevented||!OV||OV.finished||$("ovalCtl").style.display==="none"||typingIn(e.target)||e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.key===" "||e.key==="Spacebar"){e.preventDefault();if(!e.repeat&&!OV.spaceHeld){OV.spaceHeld=true;OV.lastPtr=performance.now();ovalPress("push");}}});
  document.addEventListener("keyup",e=>{if(!OV||!OV.spaceHeld)return;if(e.key===" "||e.key==="Spacebar"){OV.spaceHeld=false;ovalRelease("push");}});})();
/* ---- the flag: classification, money, records ---- */
function ovalFinish(){
  if(!OV||OV.finished)return;OV.finished=true;const {p,res,env,k,tk,stage,snap,hk,night:n,laps:N}=OV,TT=SIM.ovalTrack(tk),C0=SIM.OVAL_CLASSES[k],same=testSame(snap),st=p.st,r=p.result(),failed=!!st.broke;
  setTimeout(()=>{if(!testing){if(ENGINE_VIS.setOval)ENGINE_VIS.setOval({on:false});$("app").classList.remove("onstrip");}},OV.skip?300:1800);
  testing=false;run.on=false;run.rpm=0;$("rpmbox").style.display="none";$("ovalCtl").style.display="none";$("testProg").classList.add("done");setTimeout(()=>{$("testProg").style.width="0";},700);ENGINE_VIS.setAutoRotate(null);
  const meLaps=st.lap,meT=failed?null:st.t;
  const win=Math.min(...OV.cars.filter(c=>!c.dnf&&c.fin!=null).map(c=>c.fin),(!failed&&meLaps>=N)?st.t:Infinity);
  const rows=OV.cars.map(c=>{const q=ovalCutAt(c,win,N);return{n:c.n,num:c.num,hp:c.hp,id:c.id,laps:q.laps,time:q.time,dnf:q.dnf,best:c.best};});
  const me={n:engineName().slice(0,26),num:OV.meNum,me:true,id:"me",laps:meLaps,time:meT,dnf:failed,best:isFinite(st.bestLap)?st.bestLap:null};
  rows.push(me);ovalSortRows(rows);const place=rows.indexOf(me)+1;
  Object.assign(r,{stage,cls:k,clsName:C0.n,tier:C0.tier,place,of:rows.length,field:rows,N,lapsDone:meLaps,auto:OV.auto&&OV.took==null,took:OV.took,gridMe:OV.gridMe+1,posLaps:OV.posLaps.slice(),finished:!failed,tyreName:SIM.OVAL_TYRES[env.ovalTyre]?SIM.OVAL_TYRES[env.ovalTyre].n:"",track:tk,trackName:TT.n,surf:TT.surf,night:SIM.ovalNight(n.seed,tk).name,ci:Math.round(SIM.ovalCi(res)),final:+(OV.veh.finalK||1).toFixed(2),muStart:+(SIM.ovalNight(n.seed,tk).mu).toFixed(2),dnfLap:failed?meLaps+1:null});
  r.time=meT;r.best=me.best;
  const pl=ordN(place)+" of "+rows.length,sc=failed?`DNF · lap ${meLaps+1}`:`${ordN(place)}`;
  // money, rep, wear
  if(same&&career()){addWear((stage==="heat"?0.4:0.9)+(r.coolPeak>112?0.4:0),hk);
    if(failed){C().cert=null;C().rep=Math.max(0,C().rep-(stage==="feature"?2:1));logEvent(`${ovalLabel(tk)} ${stage}: ${C0.n} — ${r.broke==="head_lift"?"cooked it":"engine failed"} on lap ${meLaps+1}`,"bad");toast(`OUT · ${ovalFailWord(r.broke)}`);}
    else{const tab=stage==="heat"?OVAL_HPURSE:OVAL_FPURSE,purse=Math.round((tab[place-1]||0)*(OVAL_PAY[C0.tier]||1)/10)*10,rep=stage==="heat"?(place===1?1:0):((OVAL_FREP[place-1]||0)+1);r.purse=purse;r.rep=rep;C().cash+=purse;C().rep+=rep;
      logEvent(`${ovalLabel(tk)} ${stage}: ${C0.n} — ${ordN(place)} of ${rows.length}${purse?", purse "+fmt$(purse):""}`,place<=3?"good":"");toast(`${stage==="heat"?"Heat":"Feature"} · ${ordN(place)}${purse?" · "+fmt$(purse):""}`);}
    spEvent("oval",{win:!failed&&stage==="feature"&&place===1,finish:!failed&&stage==="feature"&&place>1&&place<=3,heat:stage==="heat"});hud();checkGoals();}
  else toast(failed?`OUT · ${ovalFailWord(r.broke)}`:`${stage==="heat"?"Heat":"Feature"} · ${pl}`);
  // the night moves on
    if(stage==="heat"){n.heat={place,of:rows.length,dnf:failed,time:meT,best:r.best,purse:r.purse||0};
    const bIds=ovalHeatB(k,n.seed,tk),aIds=rows.map(q=>q.id),g=[];
    for(let i=0;i<Math.max(aIds.length,bIds.length);i++){if(i<aIds.length)g.push(aIds[i]);if(i<bIds.length)g.push(bIds[i]);}
    n.grid=g;n.gridMe=g.indexOf("me");n.stage="feature";n.hash=hKey(cfgHash(S.cfg));r.nextGrid=n.gridMe+1;
    if(!failed)setTimeout(()=>toast(`Heat ${ordN(place)} — feature starts ${ordN(n.gridMe+1)}`),2800);
    setTimeout(()=>ovalWarm(k,n,tk),1500);}
  else{n.feat={place,of:rows.length,dnf:failed,time:meT,best:r.best,purse:r.purse||0};n.stage="done";}
  // records: best lap per class, best finish, feature wins
  if(same&&!ff&&!failed){const RR=ovalRecs(tk),was=RR[k]||{};const nw=Object.assign({},was);
    if(r.best&&(!was.lap||r.best<was.lap)){nw.lap=+r.best.toFixed(3);r.pb={lap:was.lap||null};if(was.lap)setTimeout(()=>toast(`CLASS BEST LAP · ${r.best.toFixed(2)} s (was ${was.lap.toFixed(2)})`),2700);}
    if(stage==="feature"){nw.best=Math.min(was.best||99,place);if(place===1)nw.wins=(was.wins||0)+1;nw.feats=(was.feats||0)+1;}
    RR[k]=Object.assign(nw,recTag());}
  res.oval=r;res.ovalFailed=failed;res.ovalFailKind=failed?r.broke:null;S.last={hash:snap.h,cfg:snap.cfg,env,res};
  achCheck({type:"oval",r,failed});
  if(stage==="feature"&&!career())delete OVAL_SB[ovalBK(k,tk)];
  OV.p=null;save();recompute();renderTest();
  revealVerdict();
}
/* ---- the sheet ---- */
function ovalVerdict(res){const r=res.oval,st=r.stage==="heat"?"HEAT":"FEATURE";
  if(res.ovalFailed){const ft=(res.tests||[]).find(x=>x.id===r.broke);return `<div class="verdict fail"><div><div class="big">${ovalFailWord(r.broke)} · ${st}</div><p>Lap ${r.dnfLap} of ${r.N} · classified ${ordN(r.place)} of ${r.of}${ft?" · "+esc(ft.name)+" failed":""}${career()?" — certification is void and reputation took a hit":""}.${r.reasons&&r.reasons[0]&&!ft?" "+esc(r.reasons[0]):""}</p></div></div>`;}
  const cls=r.place===1?"pass":r.place<=(r.stage==="heat"?4:OVAL_FPURSE.length)?"marg":"fail",avg=r.time&&r.N?SIM.ovalTrack(r.track).len*r.N/r.time*3.6:0;
  return `<div class="verdict ${cls}"><div style="flex:1"><div class="big">${ordN(r.place)} · ${st}</div><p>${esc(r.clsName)} · ${ordN(r.place)} of ${r.of} · started ${ordN(r.gridMe)} · ${r.N} laps in ${fmtOvRace(r.time)} on ${esc(r.night)} ${r.surf==="asphalt"?"asphalt":"clay"}${r.auto?" · auto driver":r.took!=null?` · you took over on lap ${r.took}`:""}${career()&&r.purse?` · purse ${fmt$(r.purse)}`:""}${r.stage==="heat"&&r.nextGrid?` · feature from ${ordN(r.nextGrid)}`:""}${r.pb?` · class best lap${r.pb.lap?` (was ${r.pb.lap.toFixed(2)})`:""}`:""}</p>
    <div class="vstats"><div><b>${r.best?r.best.toFixed(2):"—"}</b><span>best lap (s)</span></div><div><b>${Math.round(avg)}</b><span>avg km/h</span></div><div><b>${r.maxKmh}</b><span>top km/h</span></div><div><b>${r.coolPeak}</b><span>water °C peak</span></div><div><b>${Math.round(r.wear*100)}</b><span>% tyres worn</span></div><div><b>${r.slides}</b><span>slide${r.slides===1?"":"s"}</span></div></div></div></div>`;}
function ovalSheet(res){const r=res.oval,laps=r.laps||[],best=laps.length?Math.min.apply(null,laps):0;
  const wi=wearInfo(res),wear=wi?`<div><b>Wear</b>${wi.passes} of ${wi.budget} pass${wi.budget===1?"":"es"} · <span style="color:${wi.w>=1?"var(--crit)":wi.w>0.6?"var(--warn)":"var(--good)"}">${Math.round(wi.w*100)}%</span>${res.wornBy?" · down "+res.wornBy+"% on power":""}${wi.w>0?` <button class="btn sm" id="freshen" style="margin-left:8px">Freshen · ${fmt$(freshenCost(res))}</button>`:""}</div>`:"";
  const lapRows=laps.map((t,i)=>{const pos=r.posLaps[i];return `<div><b>${i+1}</b><span class="nm">${pos?"P"+pos:""}${i>0&&r.posLaps[i-1]&&pos?(pos<r.posLaps[i-1]?" ▲":pos>r.posLaps[i-1]?" ▼":""):""}</span><span class="${Math.abs(t-best)<1e-6?"et":""}">${t.toFixed(2)}</span><span>${(t-best>0.005?"+"+(t-best).toFixed(2):"best")}</span></div>`;}).join("");
  return `<div class="sec"><h2>${r.surf==="asphalt"?"Paved oval":"Dirt oval"} sheet · ${r.stage==="heat"?"heat race":"feature"}</h2><div class="log">
    <div><b>Race</b>${ordN(r.place)} of ${r.of} · ${r.lapsDone}${r.finished?"":" (out)"} of ${r.N} laps · ${r.finished?fmtOvRace(r.time):"DNF"} · started ${ordN(r.gridMe)}</div>
    <div><b>Setup</b>${esc(r.clsName)} · ${r.ci} ci · ${esc(r.tyre)} tyres · ${esc(r.grille.toLowerCase())} grille · ${r.ratio}:1 rear end · ${r.mass.toLocaleString("en-CA")} kg</div>
    ${r.rpmCorner>0?`<div><b>Gearing</b>${r.rpmCorner.toLocaleString("en-CA")} rpm mid-corner · ${r.rpmExit.toLocaleString("en-CA")} rpm at the end of the straight · ${r.maxKmh} km/h top</div>`:""}
    <div><b>Heat</b>water ${r.coolPeak} °C peak · radiator ${Math.round(r.radPack*100)}% clogged${r.derT>0.5?` · ${r.derT.toFixed(0)} s pulling power to save itself`:""} · tyres ${Math.round(r.wear*100)}% worn · grip ${r.muStart} → ${r.mu}</div>
    ${r.reasons.map(x=>`<div>${esc(x)}</div>`).join("")}${wear}</div>
    ${lapRows?`<div class="rtop ovlaps" style="margin-top:8px"><span>Lap by lap</span>${lapRows}</div>`:""}
    <div class="pfield" style="margin-top:10px">${r.field.map((f,i)=>`<b>${i+1}</b><span class="nm${f.me?" me":""}">${f.me?"▶ ":""}#${f.num} ${esc(f.n)}${f.me?"":` <small style="opacity:.6">${f.hp} hp</small>`}</span><span class="${f.me?"me":""}">${f.dnf?"out · lap "+(f.laps+1):f.laps<r.N?"−"+(r.N-f.laps)+" lap"+(r.N-f.laps===1?"":"s"):(i===0?fmtOvRace(f.time):"+"+(f.time-r.field[0].time).toFixed(1)+" s")}</span>`).join("")}</div></div>`;}
/* the chart: lap time by lap with the water and tyres under it */
function drawOvalChart(r){const css=getComputedStyle(document.documentElement),INK=css.getPropertyValue("--ink").trim()||"#edeae1",soft=INK.startsWith("#1")?"rgba(20,20,19,.45)":"rgba(237,234,225,.45)";
  const dpr=Math.min(devicePixelRatio,2),W=chart.clientWidth,H=chart.clientHeight;if(chart.width!==W*dpr){chart.width=W*dpr;chart.height=H*dpr;}
  const x=chart.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);const laps=r.laps||[];if(!laps.length)return;
  const F=getComputedStyle(document.body).fontFamily,padL=40,padR=34,padT=20,padB=24,cw=W-padL-padR,ch=H-padT-padB,n=laps.length,mn=Math.floor(Math.min.apply(null,laps)*2-1)/2,mx=Math.ceil(Math.max.apply(null,laps)*2+1)/2,X=i=>padL+cw*(n>1?i/(n-1):0.5),Y=v=>padT+ch*(1-(v-mn)/Math.max(0.5,mx-mn));
  x.strokeStyle=css.getPropertyValue("--grid").trim()||"rgba(255,255,255,.07)";x.lineWidth=1;x.font="10px "+F;x.textAlign="right";
  for(let v=mn;v<=mx+1e-6;v+=0.5){const py=Y(v);x.beginPath();x.moveTo(padL,py);x.lineTo(W-padR,py);x.stroke();x.fillStyle=soft;x.fillText(v.toFixed(1),padL-4,py+3);}
  x.textAlign="center";const stp=n>16?5:n>8?2:1;for(let i=0;i<n;i+=stp){x.fillStyle=soft;x.fillText(i+1,X(i),H-8);}
  const tr=r.trace||[];if(tr.length>2){const tmax=tr[tr.length-1][0],wk=tr.map((q,i)=>{let a=0,c=0;for(let j=Math.max(0,i-12);j<=Math.min(tr.length-1,i+12);j++){a+=tr[j][4];c++;}return a/c;});x.strokeStyle="rgba(120,169,221,.9)";x.lineWidth=1.5;x.setLineDash([4,3]);x.beginPath();tr.forEach((q,i)=>{const px=padL+cw*q[0]/tmax,py=padT+ch*(1-Math.max(0,Math.min(1,(wk[i]-70)/60)));i?x.lineTo(px,py):x.moveTo(px,py);});x.stroke();x.setLineDash([]);
    x.strokeStyle="rgba(232,193,74,.9)";x.lineWidth=1.2;x.beginPath();tr.forEach((q,i)=>{const px=padL+cw*q[0]/tmax,py=padT+ch*(1-Math.min(1,q[6]));i?x.lineTo(px,py):x.moveTo(px,py);});x.stroke();}
  x.strokeStyle="#d97757";x.lineWidth=2.4;x.beginPath();laps.forEach((v,i)=>{i?x.lineTo(X(i),Y(v)):x.moveTo(X(i),Y(v));});x.stroke();
  x.fillStyle="#d97757";laps.forEach((v,i)=>{x.beginPath();x.arc(X(i),Y(v),n>14?2:3,0,7);x.fill();});
  x.textAlign="left";x.font="11px "+F;x.fillStyle="#d97757";x.fillText("lap s",padL+4,12);x.fillStyle="rgba(120,169,221,.95)";x.fillText("water",padL+44,12);x.fillStyle="#e8c14a";x.fillText("tyres",padL+88,12);x.fillStyle=soft;x.textAlign="right";if(W>420)x.fillText(`lap time by lap · ${r.stage==="heat"?"heat":"feature"}`,W-padR,12);}
function ovalRedraw(){const l=lastForChart();if(S.env.testType==="oval"&&l&&l.oval)drawOvalChart(l.oval);}
function ovalRecHtml(){return OVAL_TRK.map(t=>{const P=ovalRecs(t),ks=Object.keys(SIM.OVAL_CLASSES).filter(k=>P[k]&&P[k].lap);if(!ks.length)return "";
  return `<div class="rtop"><span>${t==="clay"?"Dirt oval":"Paved half-mile"} · best lap per class</span>${ks.map(k=>{const e=P[k];return `<div><b>◐</b><span class="et">${e.lap.toFixed(2)}</span><span>s</span><span class="nm" title="${esc(e.n)}">${esc(SIM.OVAL_CLASSES[k].n)}${e.wins?" · "+e.wins+" win"+(e.wins===1?"":"s"):""}</span><span>${e.w!=null?"wk "+e.w:e.d?new Date(e.d).toLocaleDateString("en-CA",{month:"short",day:"numeric"}):""}</span></div>`;}).join("")}</div>`;}).join("");}
