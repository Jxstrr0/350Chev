/* ===================== BOAT DRAGS: 1,000 ft of river, heads-up eliminations ===================== */
/* a night is eight boats on a ladder: round 1, the semi, the final. Each round is one pass against the boat in the other lane:
   reaction time plus elapsed time, first to the far buoys wins. Lose (or break, or go red) and the night is over. */
let BT=null;
const BOAT_PAY={1:1,2:0.45,3:0.2,5:0.08},BOAT_REPS={1:4,2:2,3:1,5:0},BOAT_RND=["ROUND 1","SEMI-FINAL","FINAL"],BOAT_PLACE={1:"Won the night",2:"Runner-up",3:"Out in the semi",5:"Out in round 1"};
const BOAT_DRV=["Darlene Hutt","Gus Ferrier","Rae Lindgren","Buck Toews","Marty Oyelaran","Jen Kowalski","Cal Dueck","Tammy Rousseau","Hank Sato","Lou Brandt","Vic Petrenko","Shay Mulligan","Dot Fiorentino","Wade Hiebert","Pam Okonkwo","Ike Lachance"];
const BOAT_HN={outboard:["Bass Assassin","Reel Deal","Hook Shot","Lake Effect","Two-Stroke Joke","Mercury Rising","Crappie Days","Wake Up Call","Gill Thrill"],
  jet:["Jet Set","Pump Action","Thunder Pump","Rooster Booster","Hydro Thunder","Sandbar Special","Jet Lag","River Rat"],
  pro:["Blown Away","Flat Out","Liquid Asset","Wet Dream","Prairie Fire","Hole Shot","Spray Day","Cleaver Fever"],
  tfh:["Nitro Fish","Sky Pilot","Air Time","Big Water","Final Approach","Prop Rider","Tail Dragger","Kingfisher"]};
const BOAT_COLORS=[0x1d4787,0xb7261d,0x2c6b3a,0xe8c14a,0x6b3d8f,0x0e8a8a,0xd94e8f,0x8e8e8e];
const boatEsc=v=>String(v==null?"":v).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
const boatIsD=c=>SIM.isDiesel?SIM.isDiesel(c):!!(SIM.OPT.fuel[c.fuel]||{}).ci;
function boatClsLocked(k){const c=SIM.BOAT_CLASSES[k];return c&&career()&&!dev()&&C().rep<c.rep?c.rep:0;}
function boatLitres(){const q=quick;return q?(q.Vd||q.VdEq||0)/1000:0;}
function boatLegal(k){const c=SIM.BOAT_CLASSES[k];if(c&&c.maxL&&boatLitres()>c.maxL+0.005)return{ok:false,why:`${boatLitres().toFixed(1)} L — the class is ${c.maxL} L and under`};return{ok:true};}
/* the boat's setup lives on S.env (never cfg): class, driver, prop pitch or impeller, gear, trim at the start */
function boatEnvFix(){const e=S.env,B=SIM.BOAT_CLASSES;if(!B[e.boatCls])e.boatCls="outboard";const C0=B[e.boatCls],num=(v,d)=>v!=null&&v!==""&&isFinite(+v)?+v:d;
  if(C0.pitch)e.boatPitch=Math.max(C0.pitch[0],Math.min(C0.pitch[1],Math.round(num(e.boatPitch,C0.pitch[2]))));
  e.boatGear=+Math.max(C0.gear[0],Math.min(C0.gear[1],num(e.boatGear,C0.gear[2]))).toFixed(2);
  e.boatImp=Math.max(0,Math.min(3,Math.round(num(e.boatImp,1))));
  const tr=SIM.boatTrimRange();e.boatTrim=+Math.max(tr[0],Math.min(tr[1],num(e.boatTrim,0))).toFixed(1);
  if(e.boatDrive!=="auto")e.boatDrive="you";return e.boatCls;}
function boatIdle(){return boatIsD(S.cfg)?650:Math.max(750,S.cfg.cam>70?1100:850);}
function boatVeh(k){const e=S.env;return{cls:k,pitch:e.boatPitch,imp:e.boatImp,gear:e.boatGear,trim:e.boatTrim,redline:S.cfg.redline,idle:boatIdle()};}
/* the night: one per class a week in career; the sandbox keeps one going until it is over */
function boatCur(){const n=career()?C().boatN:S.boatSb;return n&&n.v===1&&SIM.BOAT_CLASSES[n.cls]?n:null;}
function boatSetN(n){if(career())C().boatN=n;else S.boatSb=n;}
function boatLive(){const n=boatCur();return n&&!n.done?n:null;}
function boatRanWk(k){return career()&&(C().boatWk||{})[k]===C().week;}
function boatFee(){if(!career()||dev()||boatLive())return 0;return (SIM.BOAT_CLASSES[S.env.boatCls]||SIM.BOAT_CLASSES.outboard).fee;}
function boatGauss(r){let u=0;while(!u)u=r();return Math.sqrt(-2*Math.log(u))*Math.cos(6.283185307*r());}
function boatNew(k){const ix=Object.keys(SIM.BOAT_CLASSES).indexOf(k)+1;
  const seed=career()?(((C().boatSeed||(C().boatSeed=Math.floor(Math.random()*1e9)+1))^(C().week*7919)^(ix*104729))>>>0):(Math.floor(Math.random()*1e9)+1)>>>0;
  const C0=SIM.BOAT_CLASSES[k],F=C0.field,r=pullRand((seed^0x51AB0A7)>>>0),names=BOAT_DRV.slice(),hulls=(BOAT_HN[k]||BOAT_HN.outboard).slice(),pick=a=>a.splice(Math.floor(r()*a.length),1)[0],field=[];
  for(let i=0;i<7;i++){const skill=+(0.55+0.45*r()).toFixed(2);field.push({name:pick(names),boat:pick(hulls),hp:Math.round(Math.max(F.hp*0.6,F.hp+boatGauss(r)*F.sd)),dsl:r()<F.dsl,skill,
    rs:(seed+(i+1)*977)>>>0,rt:+(0.035+0.12*(1-skill)+0.05*r()).toFixed(3),red:r()<0.025,col:BOAT_COLORS[i%BOAT_COLORS.length]});}
  const d=[0,1,2,3,4,5,6,7];for(let i=7;i>0;i--){const j=Math.floor(r()*(i+1));[d[i],d[j]]=[d[j],d[i]];}
  const rounds=[[0,1,2,3].map(m=>({a:d[m*2],b:d[m*2+1],win:null}))];
  return{v:1,cls:k,seed,stage:0,field,rounds,rp:{},passes:[],done:false,place:null,wk:career()?C().week:null};}
/* a rival's engine and its prop-shop setup (cached for the session; the night only keeps the numbers) */
const boatRivC=new Map();
function boatRival(N,i){const key=N.seed+":"+i;let R=boatRivC.get(key);if(R)return R;const f=N.field[i-1],C0=SIM.BOAT_CLASSES[N.cls];
  const res=SIM.bogAiRes(f.hp,f.dsl,f.rs);res.kg=Math.round((f.dsl?420:130)+f.hp*(f.dsl?0.9:0.07));
  if(C0.field.red){const rr=pullRand(f.rs^0x77);res.redline=C0.field.red[0]+Math.round(rr()*(C0.field.red[1]-C0.field.red[0])/100)*100;}
  const base={redline:res.redline,idle:f.dsl?650:850};let set=f.set;
  if(!set){const b=SIM.boatGuess(res,N.cls);set=f.set={gear:b.gear,trim:+(0.4*(f.skill-0.7)).toFixed(1)};if(b.pitch!=null)set.pitch=b.pitch;if(b.imp!=null)set.imp=b.imp;}
  R={res,veh:Object.assign({cls:N.cls},base,set)};if(boatRivC.size>40)boatRivC.clear();boatRivC.set(key,R);return R;}
function boatWaterAt(N,stage){return SIM.boatWater((N.seed^((stage+1)*0x9E3779B1))>>>0);}
/* a rival's pass in a round: fixed by the night's seed, the round's water and the driver */
function boatRivalPass(N,stage,i,keepTrace){const k=stage+":"+i,f=N.field[i-1];if(N.rp[k]&&!keepTrace)return N.rp[k];
  const R=boatRival(N,i),q=SIM.boatPass(R.res,Object.assign({},R.veh,{seed:(N.seed^(stage*131+i*7))>>>0,water:boatWaterAt(N,stage),rt:f.red&&stage===0?0:f.rt,noFail:true}),f.skill);
  const red=f.red&&stage===0,out={rt:red?-0.02:q.rt,et:q.et,mph:q.mph,dnf:q.dnf||null};
  if(!q.dnf&&q.et!=null&&pullRand((N.seed^(stage*977+i))>>>0)()<0.04)out.dnf="broke",out.et=null;   // now and then a rival lets go
  N.rp[k]=out;return keepTrace?Object.assign({trace:q.trace,cut:out.dnf==="broke"?0.3+0.5*pullRand(N.seed^i)():null},out):out;}
function boatTot(p){return p.rt!=null&&p.rt<0?Infinity:p.et==null?1e6+(p.dist?-p.dist:0):p.rt+p.et;}
/* who won: a red light loses (both red: the earlier one), then a boat that finished beats one that didn't, then rt + et */
function boatJudge(a,b){const ra=a.rt!=null&&a.rt<0,rb=b.rt!=null&&b.rt<0;if(ra&&rb)return a.rt<b.rt?"b":"a";if(ra)return "b";if(rb)return "a";
  const ta=boatTot(a),tb=boatTot(b);return ta<=tb?"a":"b";}
function boatResolve(N,ri){for(const m of N.rounds[ri]){if(m.win!=null||m.a===0||m.b===0)continue;const pa=boatRivalPass(N,ri,m.a),pb=boatRivalPass(N,ri,m.b);m.pa=pa;m.pb=pb;m.win=boatJudge(pa,pb)==="a"?m.a:m.b;}}
function boatNext(N){const prev=N.rounds[N.stage],w=prev.map(m=>m.win),out=[];for(let i=0;i<w.length;i+=2)out.push({a:w[i],b:w[i+1],win:null});return out;}
function boatMyMatch(N){const r=N.rounds[N.stage];return r?r.find(m=>m.a===0||m.b===0):null;}
function boatPart(N,i){return i===0?{name:"You",boat:engineName().slice(0,22),you:true}:N.field[i-1];}
function boatBtnText(t,sub){const b=$("boatBtn");const k=t+"|"+(sub||"");if(b.dataset.k===k)return;b.dataset.k=k;b.innerHTML=t+(sub?`<small>${sub}</small>`:"");}
function boatBreak(kind){BT.failed=true;BT.failKind=kind;run.fail=true;run.failKind=FAIL_VISUAL[kind]||"rod";$("flash").style.background="rgba(238,90,94,.45)";setTimeout(()=>$("flash").style.background="rgba(238,90,94,0)",250);sfx("fail");buzz([80,40,120]);}
function boatStart(){
  $("app").classList.add("onstrip");
  const k=boatEnvFix();let N=boatLive();
  if(!N||N.cls!==k){N=boatNew(k);boatSetN(N);if(career())(C().boatWk=C().boatWk||{})[k]=C().week;}
  const env=stdEnv(),res=SIM.boatPrep(S.cfg,env);
  const wi=wearInfo(res);if(wi&&wi.w>0){const f=1-0.05*Math.min(1,wi.w);res.torque=res.torque.map(t=>t*f);if(res.naTorque)res.naTorque=res.naTorque.map(t=>t*f);res.power=res.power.map(t=>t*f);res.peakTq*=f;res.peakHp*=f;res.wornBy=Math.round((1-f)*100);}
  boatResolve(N,N.stage);
  const m=boatMyMatch(N),oi=m.a===0?m.b:m.a,stage=N.stage,water=boatWaterAt(N,stage),opp=boatRivalPass(N,stage,oi,true),of=N.field[oi-1];
  const snap=testSnap(),hk=hKey(snap.h),veh=boatVeh(k);veh.water=water;veh.seed=career()?(N.seed^(stage*7919+(C().boatRuns=(C().boatRuns||0)+1)))>>>0:Math.floor(Math.random()*1e9);if(wi&&wi.w>=1)veh.wornAt=0.6+Math.random()*3;
  const p=SIM.boatRun(res,veh),C0=SIM.BOAT_CLASSES[k];
  BT={p,res,env,veh,k,hk,snap,N,stage,water,oi,opp,of,auto:S.env.boatDrive==="auto",took:null,t0:performance.now(),green:null,last:performance.now(),down:false,tc:0,foul:false,failed:false,failKind:null,doneAt:null,lastPtr:0,hops:0,blown:false,color:0xff7a1a,
    label:BOAT_RND[stage],ox:0,ov:0,oDone:false};
  BT.green=BT.t0+3000;
  ENGINE_VIS.setAutoRotate(false);$("rpmbox").style.display="block";$("boatCtl").style.display="";$("boatBtn").dataset.k="";$("boatBtn").disabled=false;
  $("testProg").classList.remove("done");sfx("start");boatHud();
  requestAnimationFrame(()=>{const pn=$("panel"),r=$("boatCtl").getBoundingClientRect(),pr=pn.getBoundingClientRect(),bot=Math.min(pr.bottom,tabsTop())-8;if(r.bottom>bot||r.top<pr.top)pn.scrollTo({top:pn.scrollTop+(r.height>bot-pr.top?r.top-pr.top-4:r.bottom-bot),behavior:calmScroll()});});
  const step=()=>{if(!BT||BT.finished)return;const now=performance.now();const dt=Math.min(0.25,(now-BT.last)/1000);BT.last=now;const st=p.st;
    if(now>=BT.green){let left=Math.min(dt,(now-BT.green)/1000);while(left>1e-6&&st.t<60){const d=Math.min(0.02,left);left-=d;const c=boatCtl(st);p.step(d,c.thr,c.trim);}}
    else if(BT.down&&!BT.foul&&!BT.auto){BT.foul=true;buzz([60,30,60]);}
    if(st.broke&&!BT.failed)boatBreak(st.broke);
    if(st.hops>BT.hops){BT.hops=st.hops;sfx("mudslap");}
    if(st.blown&&!BT.blown)buzz([12]);BT.blown=st.blown;
    const og=now<BT.green?0:st.t,o=boatOppAt(og);BT.ox=o.x;BT.ov=o.v;BT.oDone=o.done;
    if(st.done&&BT.doneAt==null&&(BT.oDone||st.t-st.doneT>1.2)){BT.doneAt=now;const w=boatWinNow();if(w===true){$("flash").style.background="rgba(92,191,138,.35)";setTimeout(()=>$("flash").style.background="rgba(238,90,94,0)",400);buzz([30,40,30,40,90]);}else buzz([40]);}
    if(ENGINE_VIS.setBoat)ENGINE_VIS.setBoat(boatVisFrame(now,dt));
    boatHud();
    run.on=true;
    if(BT.failed)run.rpm=Math.max(0,run.rpm-380);else run.rpm=st.rpm;
    run.load=BT.failed||st.done?0:st.foot;
    $("rpmLbl").textContent=Math.round(run.rpm/10)*10;
    $("testProg").style.width=Math.min(100,100*st.x/SIM.BOAT_FT)+"%";
    if(BT.doneAt==null||(now-BT.doneAt<2600&&!BT.skip))requestAnimationFrame(step);else boatFinish();};
  requestAnimationFrame(step);
}
/* the inputs this moment: the auto driver's, or the button and the trim switches */
function boatCtl(st){if(BT.failed)return{thr:0,trim:0};if(BT.auto){const a=BT.p.auto(0.95);return a;}return{thr:BT.down?1:0,trim:BT.tc};}
/* the other lane, from its trace (time from the green); a boat that broke coasts off the plane */
function boatOppAt(t){const tr=BT.opp.trace||[];if(t<=0||!tr.length)return{x:0,v:0,done:false,bow:0,pl:0};
  const cut=BT.opp.dnf&&BT.opp.cut!=null?tr[Math.min(tr.length-1,Math.floor(tr.length*BT.opp.cut))].t:Infinity;
  let i=1;const tt=Math.min(t,cut);while(i<tr.length&&tr[i].t<tt)i++;const a=tr[i-1],b=tr[Math.min(i,tr.length-1)],f=b.t>a.t?Math.max(0,Math.min(1,(tt-a.t)/(b.t-a.t))):0;
  let x=a.x+(b.x-a.x)*f,v=a.v+(b.v-a.v)*f;const end=tr[tr.length-1];
  if(t>cut){const dt=t-cut,v1=Math.max(0,v-dt*9);x+=(v+v1)/2*Math.min(dt,v/9);v=v1;}
  else if(t>end.t){const dt=t-end.t,v1=Math.max(0,end.v-dt*12);x=end.x+(end.v+v1)/2*Math.min(dt,end.v/12);v=v1;}
  return{x,v,done:t>=Math.min(cut,end.t)};}
function boatWinNow(){const st=BT.p.st;const me={rt:BT.foul?-0.01:st.rt,et:BT.failed||st.dnf?null:st.et,dist:st.x};return boatJudge(me,BT.opp)==="a";}
/* what the river scene gets every frame */
function boatVisFrame(now,dt){const st=BT.p.st,o=BT.opp,og=now<BT.green?0:st.t,tl=(now-BT.t0)/1000,pre=now<BT.green;
  const tree={pre:tl>0.6,stage:tl>1.0,amb:pre?Math.max(0,Math.min(3,Math.floor((tl-1.5)/0.5)+1)):0,green:!pre,redMe:BT.foul,redOpp:!!(o.rt!=null&&o.rt<0)};
  const oo=boatOppAt(og),C0=SIM.BOAT_CLASSES[BT.k];
  return{on:true,phase:pre?"tree":st.done?"done":"run",cls:BT.k,hull:C0.hull,drive:C0.drive,dt,night:!!S.night,water:BT.water,tree,
    me:{x:st.x,v:st.v,rpm:BT.failed?run.rpm:st.rpm,thr:st.foot,trim:st.trim,bow:st.bow,pl:st.pl,slip:st.slip,blown:st.blown,air:st.air,porp:st.porp,walk:st.walk,lr:st.Lr,hop:st.hopV,flip:st.dnf==="blowover",hook:st.dnf==="hooked",stuff:st.dnf==="stuffed",failed:BT.failed,color:BT.color,smoke:BT.res.diesel?0.5:0.08},
    opp:{x:oo.x,v:oo.v,bow:oo.v>1?Math.max(0,6.5*Math.exp(-Math.pow((oo.v/9-1)/0.8,2)))+2:0,pl:Math.min(1,Math.max(0,(oo.v/9-0.6))),thr:oo.done?0:og>(o.rt||0)?1:0,color:BT.of.col,name:BT.of.name,flip:o.dnf==="blowover"&&oo.done},
    finish:st.finished,meEt:st.et,meMph:st.mph,oppEt:oo.done?o.et:null,oppMph:oo.done?o.mph:null,won:BT.doneAt!=null?boatWinNow():null,skip:!!BT.skip};}
/* the live card: the clock (or the far buoys), both lanes on the course, the prop's load against blowout, trim against the hull's sweet spot */
function boatHud(){if(!BT)return;const st=BT.p.st,now=performance.now(),pre=now<BT.green,L=SIM.BOAT_FT,pc=v=>Math.min(100,100*Math.max(0,v)/L);
  const t=pre?0:Math.max(0,st.t-(st.rt||st.t)),stat=BT.failed||st.dnf||BT.foul?"broke":st.finished?"full":"";
  const say=BT.failed?"BROKE":BT.foul?"RED LIGHT":st.dnf?({blowover:"blew over",hooked:"hooked",stuffed:"stuffed it",time:"stuck on the hump"}[st.dnf]||"DNF"):st.finished?`${st.mph.toFixed(1)} mph`:pre?(now>BT.t0+1500?"ambers…":"staged"):st.phase==="line"?"GREEN!":Math.round(st.v*2.237)+" mph";
  const big=st.finished?`${st.et.toFixed(3)}<i>s</i>`:`${Math.round(st.x*3.28084)}<i>ft</i>`;
  const ratio=st.T/Math.max(1,BT.p.Tc0*(1+Math.pow(st.v/12,2))),lp=Math.min(100,Math.round(ratio/1.4*100)),tr=SIM.boatTrimRange(),tp=v=>Math.round(100*(v-tr[0])/(tr[1]-tr[0]));
  const f=st.v/(SIM.BOAT_HULLS[BT.p.hull].vh),opt=f<0.8?-2:f>2.2?BT.p.opt:-2+(BT.p.opt+2)*Math.min(1,Math.max(0,(f-0.8)/1.4));
  const warn=st.dnf?"":st.Lr>0.75?`<b style="color:var(--crit)">NOSE LIGHT</b>`:st.walk>0.4?`<b style="color:var(--crit)">CHINE WALK</b>`:st.porp>0.3?`<b style="color:var(--warn)">PORPOISING</b>`:st.blown?`<b style="color:var(--crit)">BLOWN OUT</b>`:st.air?`<b style="color:var(--info)">AIRBORNE</b>`:st.debris?`<b style="color:var(--warn)">${st.debris.kind==="grate"?"STICK IN THE GRATE":"WEED"}</b>`:`blowout past 100%`;
  $("boatLive").innerHTML=`<div class="ph"><div class="ph-top ${stat}"><b>${big}</b><span>${BT.label} · vs ${boatEsc(BT.of.name)}<br>${say}</span></div>
    <div class="ph-bar"><i class="fill" style="width:${pc(st.x)}%"></i><i class="mk lead" style="left:${pc(BT.ox)}%"></i></div><div class="ph-lbl"><span>0</span><span>${boatEsc(BT.of.boat)} <b>${Math.round(BT.ox*3.28084)} ft</b></span><span>1,000 ft</span></div>
    <div class="ph-lbl"><span>Water <b>${boatEsc(BT.water.name)}</b></span><span>${BT.water.wind>=0?"head":"tail"}wind <b>${Math.abs(BT.water.wind).toFixed(1)} m/s</b></span></div></div>
    <div class="ph"><div class="ph-lbl" style="margin-top:0"><span>${BT.p.jet?"Pump":"Prop"} load <b>${Math.round(ratio*100)}%</b></span><span>${warn}</span></div>
    <div class="ph-bar"><i class="zone" style="left:${Math.round(100/1.4)}%;width:${100-Math.round(100/1.4)}%"></i><i class="fill${st.blown?" ra":""}" style="width:${lp}%"></i></div>
    <div class="ph-lbl"><span>Trim <b>${st.trim>=0?"+":""}${st.trim.toFixed(1)}°</b></span><span>${f<1?"in for the hump":"out with speed"}</span></div>
    <div class="ph-bar"><i class="sw" style="left:${Math.max(0,tp(opt-0.6))}%;width:${tp(opt+0.6)-tp(opt-0.6)}%"></i><i class="nd ${st.porp>0.3||st.walk>0.3||st.Lr>0.7?"hot":Math.abs(st.trim-opt)<0.7?"ok":""}" style="left:${Math.min(99,Math.max(1,tp(st.trim)))}%"></i></div></div>
    <div class="ph-row"><div class="peak"><b>${Math.round(st.v*2.237)}</b><span>mph</span></div><div class="peak"><b>${Math.round(st.slip*100)}<i>%</i></b><span>slip</span></div><div class="peak"><b style="color:${st.cool>100?"var(--crit)":st.cool>80?"var(--warn)":""}">${Math.round(st.cool)}<i>°C</i></b><span>water</span></div></div>`;
  const tIn=$("boatTrimIn"),tOut=$("boatTrimOut");if(tIn){tIn.classList.toggle("on",BT.tc<0);tOut.classList.toggle("on",BT.tc>0);}
  if(BT.failed)boatBtnText("BROKE","tap to skip");
  else if(BT.doneAt!=null||st.done){const w=BT.doneAt!=null?boatWinNow():null;boatBtnText(w===true?"WIN":w===false?"LOSS":st.finished?`${st.et.toFixed(3)} S`:"DNF","tap to skip");}
  else if(BT.auto)boatBtnText(pre?"AUTO DRIVER":"AUTO",pre?"it leaves on the green":"tap throttle or trim to take over");
  else if(pre)boatBtnText(BT.foul?"RED LIGHT":"WAIT FOR THE GREEN",BT.foul?"you left early — run it out":"then hold for throttle");
  else if(BT.down)boatBtnText(st.blown?"BLOWN OUT — FEATHER":st.air?"AIRBORNE — LIFT":f<1.1?"THROUGH THE HUMP":"ON PLANE",st.blown?"ease off until it hooks up":"trim out with speed");
  else boatBtnText(st.phase==="line"?"GO!":"FEATHERED","hold for throttle");}
function boatTakeOver(){if(!BT||!BT.auto)return;const st=BT.p.st;BT.auto=false;BT.took=st.phase==="line"?0:Math.round(st.x*3.28084);BT.down=st.foot>0.5;toast("You have it");}
function boatPress(){if(!BT||BT.finished)return;const st=BT.p.st,now=performance.now();if(st.done||BT.failed||BT.doneAt!=null){boatSkip();return;}
  if(BT.auto){if(now<BT.green){toast("The auto driver has the light");return;}boatTakeOver();}
  BT.down=true;if(now<BT.green&&!BT.foul){BT.foul=true;buzz([60,30,60]);}}
function boatRelease(){if(!BT)return;BT.down=false;}
function boatTrim(d){if(!BT||BT.finished)return;if(BT.auto){if(performance.now()<BT.green)return;boatTakeOver();}BT.tc=d;}
/* skip: run out the rest of the pass at once (the auto driver's inputs, or yours held where they were) */
function boatSkip(){if(!BT||BT.finished)return;const p=BT.p,st=p.st;
  if(!st.done){if(performance.now()<BT.green)BT.green=performance.now();let n=0;while(!st.done&&n++<3000){const c=BT.auto?p.auto(0.95):{thr:BT.down?1:p.auto(0.95).thr,trim:BT.tc};p.step(0.02,c.thr,c.trim);}if(st.broke&&!BT.failed)boatBreak(st.broke);}
  if(ENGINE_VIS.boatSkip)ENGINE_VIS.boatSkip();BT.skip=true;if(BT.doneAt==null)BT.doneAt=performance.now()-2600;}
(()=>{const b=$("boatBtn"),tI=$("boatTrimIn"),tO=$("boatTrimOut"),mark=()=>{BT&&(BT.lastPtr=performance.now());};
  b.addEventListener("pointerdown",e=>{e.preventDefault();mark();try{b.setPointerCapture(e.pointerId);}catch(x){}boatPress();});
  b.addEventListener("pointerup",()=>{mark();boatRelease();});b.addEventListener("pointercancel",()=>{mark();boatRelease();});
  b.addEventListener("contextmenu",e=>e.preventDefault());
  b.addEventListener("keydown",e=>{if((e.key===" "||e.key==="Enter")&&!e.repeat){e.preventDefault();boatPress();}});
  b.addEventListener("keyup",e=>{if(e.key===" "||e.key==="Enter"){e.preventDefault();boatRelease();}});
  b.addEventListener("click",()=>{if(!BT||!BT.p||performance.now()-(BT.lastPtr||0)<800)return;boatPress();setTimeout(boatRelease,60);});
  [[tI,-1],[tO,1]].forEach(([el,d])=>{el.addEventListener("pointerdown",e=>{e.preventDefault();try{el.setPointerCapture(e.pointerId);}catch(x){}boatTrim(d);});
    ["pointerup","pointercancel"].forEach(ev=>el.addEventListener(ev,()=>{if(BT&&BT.tc===d)BT.tc=0;}));el.addEventListener("contextmenu",e=>e.preventDefault());});
  /* arrow keys trim while a boat is on the course: up = out (bow up), down = in */
  document.addEventListener("keydown",e=>{if(!BT||BT.finished||$("boatCtl").style.display==="none"||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==="ArrowUp"||e.key==="ArrowDown"){e.preventDefault();if(!e.repeat)boatTrim(e.key==="ArrowUp"?1:-1);}});
  document.addEventListener("keyup",e=>{if(!BT)return;if(e.key==="ArrowUp"||e.key==="ArrowDown"){if(BT.tc===(e.key==="ArrowUp"?1:-1))BT.tc=0;}});})();
function boatFinish(){
  if(!BT||BT.finished)return;BT.finished=true;const {p,res,env,k,snap,hk,N,stage,oi}=BT;const r=p.result(),failed=BT.failed,C0=SIM.BOAT_CLASSES[k],same=testSame(snap);
  setTimeout(()=>{if(!testing){if(ENGINE_VIS.setBoat)ENGINE_VIS.setBoat({on:false});$("app").classList.remove("onstrip");}},2200);
  testing=false;run.on=false;run.fail=false;run.rpm=0;$("rpmbox").style.display="none";$("boatCtl").style.display="none";$("testProg").classList.add("done");setTimeout(()=>{$("testProg").style.width="0";},700);ENGINE_VIS.setAutoRotate(null);
  const me={rt:BT.foul?-0.01:r.rt,et:failed||r.dnf?null:r.et,mph:r.mph,dist:r.dist,dnf:failed?"broke":r.dnf};
  const op=BT.opp,won=boatJudge(me,op)==="a";
  const mm=boatMyMatch(N);if(mm){mm.win=won?0:oi;mm.pa=mm.a===0?me:op;mm.pb=mm.a===0?op:me;}
  r.match={label:BT.label,stage,opp:BT.of.name,boat:BT.of.boat,hp:BT.of.hp,oppRt:op.rt,oppEt:op.et,oppMph:op.mph,oppDnf:op.dnf,won,foul:BT.foul,margin:me.et!=null&&op.et!=null&&!BT.foul&&!(op.rt<0)?+(boatTot(me)-boatTot(op)).toFixed(3):null};
  r.clsName=C0.n;r.tier=C0.tier;r.auto=BT.auto||BT.took!=null?{took:BT.took}:null;r.at=Date.now();
  if(failed){r.broke=r.broke||BT.failKind;r.failKind=r.failKind||BT.failKind;}
  N.passes.push({stage,et:me.et,mph:me.mph,rt:me.rt,dnf:me.dnf||null,won});
  let place=null;if(!won||failed)place=stage===2?2:stage===1?3:5;else if(stage===2)place=1;
  if(place){N.done=true;N.place=place;}else{const nx=boatNext(N);N.stage++;N.rounds[N.stage]=nx;}
  if(N.stage<3&&!N.done)boatResolve(N,N.stage);
  r.night={place,stage,label:BT.label,cls:k,done:N.done};
  if(same)boatPb(r,failed||BT.foul);
  res.boat=r;res.boatFailed=failed;res.boatFailKind=failed?BT.failKind:null;S.last={hash:snap.h,cfg:snap.cfg,env,res};
  const sc=me.et!=null?`${me.et.toFixed(3)} @ ${Math.round(me.mph)}`:failed?"broke":"DNF";
  if(career()&&same){addWear(0.45+0.15*C0.tier,hk);
    if(failed){C().cert=null;C().rep=Math.max(0,C().rep-2);logEvent(`Boat drags: ${C0.n} — ${r.broke==="valve_float"?"floated the valves":"let go"} ${r.distFt} ft down the river`,"bad");toast(`BROKE ON THE RIVER · ${r.distFt} ft`);}
    else toast(`${BT.label} · ${won?"WIN":"LOSS"} · ${sc}`);
    if(place){const purse=Math.round(C0.purse*(BOAT_PAY[place]||0)/10)*10,rep=BOAT_REPS[place]||0;N.purse=purse;r.purse=purse;r.rep=rep;C().cash+=purse;C().rep+=rep;
      logEvent(`Boat drags: ${C0.n} — ${BOAT_PLACE[place].toLowerCase()}${purse?", purse "+fmt$(purse):""}`,place<=2?"good":"");if(purse)setTimeout(()=>toast(`${BOAT_PLACE[place]} · ${fmt$(purse)}`),2700);
      spEvent("boat",{win:place===1,finish:place===2||place===3});}
    hud();checkGoals();}
  else toast(failed?`BROKE ON THE RIVER · ${r.distFt} ft`:`${BT.label} · ${won?"WIN":"LOSS"} · ${sc}`);
  achCheck({type:"boat",r,failed,place});
  BT.p=null;save();recompute();renderTest();
  revealVerdict();
}
/* records: per class, the quickest clean pass and the top speed anyone saw */
function boatPb(r,bad){if(ff||bad||r.et==null)return;const R=recs();if(!R.boat||typeof R.boat!=="object")R.boat={};const was=R.boat[r.cls];
  if(was&&!(r.et<was.et)){if(r.mph>(was.top||0))was.top=r.mph;return;}
  R.boat[r.cls]=Object.assign({et:r.et,mph:r.mph,top:Math.max(r.mph,was&&was.top||0)},recTag());
  if(was){r.pb={was:was.et.toFixed(3)};setTimeout(()=>toast(`CLASS BEST · ${r.et.toFixed(3)} s (was ${r.pb.was})`),3200);}}
function boatRecHtml(){const R=recs(),P=R.boat;if(!P||typeof P!=="object")return "";const ks=Object.keys(SIM.BOAT_CLASSES).filter(k=>P[k]&&P[k].et);if(!ks.length)return "";
  return `<div class="rtop"><span>Boat drags · best per class</span>${ks.map(k=>{const e=P[k];return `<div><b>⚓</b><span class="et">${e.et.toFixed(3)}</span><span>${Math.round(e.mph)} mph</span><span class="nm" title="${boatEsc(e.n)}">${boatEsc(SIM.BOAT_CLASSES[k].n)}</span><span>${e.w!=null?"wk "+e.w:e.d?new Date(e.d).toLocaleDateString("en-CA",{month:"short",day:"numeric"}):""}</span></div>`;}).join("")}</div>`;}
function boatHint(){const c=SIM.BOAT_CLASSES;return career()?`<b>Boat drags</b> · one night per class a week, entry ${fmt$(c.outboard.fee)}–${fmt$(c.tfh.fee)}. Needs a certified engine. Eight boats, heads-up: lose once and you're out. ${c.jet.n} opens at ${c.jet.rep} rep, ${c.pro.n} at ${c.pro.rep}, ${c.tfh.n} at ${c.tfh.rep}. The winner takes up to ${fmt$(c.tfh.purse)}.`
  :`<b>Boat drags</b> · 1,000 ft of river, heads-up. Wait for the green, then hold for throttle. Feather it if the prop blows out off the line, trim in for the hump and out once it's on plane — too far out and it porpoises, walks, or blows over.`;}
/* the prop shop: the quickest pitch and gear (or impeller and drive ratio) for this engine on glassy water */
const boatShopC=new Map();
function boatShop(){const k=boatEnvFix(),key=k+"|"+cfgHash(S.cfg);if(boatShopC.has(key))return boatShopC.get(key);const res=SIM.boatPrep(S.cfg,stdEnv());
  const b=SIM.boatTune(res,k,{redline:S.cfg.redline,idle:boatIdle(),trim:S.env.boatTrim});if(boatShopC.size>20)boatShopC.clear();boatShopC.set(key,b);return b;}
function boatShopTxt(b,C0){return b?(C0.drive==="jet"?`${SIM.BOAT_IMP[b.imp][1]} impeller · ${b.gear.toFixed(2)}:1`:`${b.pitch}" pitch · ${b.gear.toFixed(2)}:1`)+(b.et?` → ${b.et.toFixed(2)} s on glassy water`:""):"";}
function boatLadderHtml(N){const nm=i=>i==null?"—":i===0?"<b>You</b>":boatEsc(N.field[i-1].name.split(" ").pop());
  const pt=p=>!p?"":p.rt!=null&&p.rt<0?"RED":p.et==null?(p.dnf==="broke"?"BROKE":"DNF"):p.et.toFixed(2);
  return `<div class="bladder">${N.rounds.map((R,ri)=>`<div class="blr"><span class="blh">${BOAT_RND[ri]}</span>${R.map(m=>`<div class="blm${m.a===0||m.b===0?" me":""}"><span class="${m.win===m.a?"w":m.win!=null?"l":""}">${nm(m.a)} <i>${pt(m.pa)}</i></span><span class="${m.win===m.b?"w":m.win!=null?"l":""}">${nm(m.b)} <i>${pt(m.pb)}</i></span></div>`).join("")}</div>`).join("")}</div>`;}
function boatEnvHtml(sl){const e=S.env,k=boatEnvFix(),C0=SIM.BOAT_CLASSES[k],HU=SIM.BOAT_HULLS[C0.hull],lk=boatClsLocked(k),N=boatCur(),live=boatLive(),R=recs().boat||{},pb=R[k];let h="";
  if(N&&N.cls===k){const st=live?N.stage:null,m=live?boatMyMatch(N):null,oi=m?(m.a===0?m.b:m.a):null,of=oi?N.field[oi-1]:null,w=live?boatWaterAt(N,st):null;
    h+=`<div class="saltcls"><div><span>${live?BOAT_RND[st]:"Last night"}</span><b>${live?(of?boatEsc(of.name.split(" ").pop()):"—"):({1:"Won",2:"Runner-up",3:"Semi",5:"Round 1"}[N.place]||"—")}</b><small>${live?(of?`${boatEsc(of.boat)} · ${of.hp.toLocaleString()} hp`:""):N.purse?"purse "+fmt$(N.purse):"no purse"}</small></div>${w?`<div><span>Water</span><b>${(w.wind>=0?"+":"")+w.wind.toFixed(1)}<i style="font-size:12px;font-style:normal"> m/s</i></b><small>${boatEsc(w.name)} · ${w.wind>=0?"headwind":"tailwind"}</small></div>`:`<div><span>Field</span><b>${C0.field.hp.toLocaleString()}</b><small>hp, give or take ${C0.field.sd}</small></div>`}<div><span>Your best</span><b>${pb?pb.et.toFixed(2):"—"}</b><small>${pb?Math.round(pb.mph)+" mph":"no pass yet"}</small></div></div>`;
    h+=boatLadderHtml(N);
    if(live)h+=`<p class="hint">${of?`Next: <b>${boatEsc(of.name)}</b> in ${boatEsc(of.boat)}. `:""}Tune between rounds — the setup below goes on the boat for the next pass. <button class="chip" data-boatleave>Leave the night</button></p>`;
    else h+=`<p class="hint">${BOAT_PLACE[N.place]||"Night over"}${N.purse?" · "+fmt$(N.purse):""}. ${career()&&boatRanWk(k)?`The next ${C0.n} night is week ${C().week+1}.`:"Run again to start a new night."}</p>`;}
  else h+=`<div class="saltcls"><div><span>Course</span><b>1,000 ft</b><small>river · two lanes · a tree</small></div><div><span>Field</span><b>${C0.field.hp.toLocaleString()}</b><small>hp, give or take ${C0.field.sd}</small></div><div><span>Your best</span><b>${pb?pb.et.toFixed(2):"—"}</b><small>${pb?Math.round(pb.mph)+" mph":"no pass yet"}</small></div></div>`;
  h+=`<div class="lbl"><span>Class</span></div><div class="seg wide">${Object.entries(SIM.BOAT_CLASSES).map(([id,c])=>{const l=boatClsLocked(id);return `<button data-tk="boatCls" data-tv="${id}" class="${k===id?"on":""}${l?" lock":""}"${live&&live.cls!==id?" disabled":""}>${c.n}<small>${l?l+" rep":c.d}</small></button>`;}).join("")}</div>`;
  h+=`<div class="lbl"><span>Driver</span></div><div class="seg">${[["you","You drive","throttle, trim · feather the hump"],["auto","Auto","a steady hand · tap to take over"]].map(([id,n,d])=>`<button data-tk="boatDrive" data-tv="${id}" class="${e.boatDrive===id?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>`;
  if(C0.drive==="jet")h+=`<div class="lbl"><span>Impeller</span></div><div class="seg">${SIM.BOAT_IMP.map(([c,n,cj,d],i)=>`<button data-tk="boatImp" data-tv="${i}" class="${e.boatImp===i?"on":""}">${n}<small>${d}</small></button>`).join("")}</div>`;
  else h+=`<div class="envgrid">${sl("boatPitch","Prop pitch",C0.pitch[0],C0.pitch[1],1,'"',e.boatPitch)}</div>`;
  h+=`<div class="envgrid">${sl("boatGear",C0.drive==="jet"?"Drive ratio":C0.id==="outboard"?"Lower-unit gear":"V-drive box",C0.gear[0],C0.gear[1],0.05,":1",e.boatGear)}${sl("boatTrim","Trim at the start",SIM.boatTrimRange()[0],SIM.boatTrimRange()[1],0.5,"°",e.boatTrim)}</div>`;
  const sh=boatShopC.get(k+"|"+cfgHash(S.cfg));
  h+=`<p class="hint">Boat drags: ${C0.n} · ${HU.n.toLowerCase()} · ${(C0.hullKg+C0.rigKg+90).toLocaleString("en-CA")} kg plus the engine. ${C0.drive==="jet"?"The pump's impeller cut sets how hard it loads the engine: a light cut revs and leaves hard, a heavy one pulls at the top end. The drive ratio steps the impeller up or down.":"Pitch is how far one turn of the prop would move the boat with no slip: more pitch, more top speed — and more load, so the engine revs lower and the prop slips more off the line."} Trim in (negative) for the hump, out once it's planing — this hull likes about ${HU.opt>0?"+":""}${HU.opt}°.${C0.maxL?` ${C0.maxL} L and under.`:""}${lk?` <b>Opens at ${lk} rep.</b>`:""}${!live&&boatRanWk(k)?` <b>Run this week — the next night is week ${C().week+1}.</b>`:""}
    <button class="chip" data-boatshop>${sh?"Prop shop: "+boatShopTxt(sh,C0)+" · fit it":"Ask the prop shop"}</button></p>`;
  return h;}
$("envBox").addEventListener("click",e=>{
  if(e.target.closest("[data-boatleave]")){const N=boatLive();if(!N||testing)return;if(!confirm("Leave the night? You forfeit this round."))return;N.done=true;N.place=[5,3,2][N.stage]||5;N.purse=0;save();renderTest();return;}
  if(e.target.closest("[data-boatshop]")){const k=boatEnvFix(),key=k+"|"+cfgHash(S.cfg),C0=SIM.BOAT_CLASSES[k];
    if(!boatShopC.has(key)){const b=e.target.closest("[data-boatshop]");b.textContent="Prop shop is running the numbers…";b.disabled=true;setTimeout(()=>{boatShop();renderEnv();},30);return;}
    const s=boatShopC.get(key);if(s){if(C0.drive==="jet")S.env.boatImp=s.imp;else S.env.boatPitch=s.pitch;S.env.boatGear=s.gear;boatEnvFix();renderEnv();save();toast("Fitted · "+boatShopTxt(s,C0).split(" → ")[0]);}return;}
  const b=e.target.closest("[data-tk]");if(!b)return;const k=b.dataset.tk,v=b.dataset.tv;
  if(k==="boatCls"){const l=boatClsLocked(v);if(l){toast(`${SIM.BOAT_CLASSES[v].n} opens at ${l} rep`);return;}if(v!==S.env.boatCls){S.env.boatPitch=null;S.env.boatGear=null;S.env.boatImp=null;}}
  S.env[k]=k==="boatImp"?+v:v;boatEnvFix();renderEnv();save();buzz(6);evPickRender();});
function boatRunBtn(){const N=boatLive(),b=$("runTest");if(testing)return;const k=S.env.boatCls;
  if(N&&N.cls===k){const m=boatMyMatch(N),oi=m?(m.a===0?m.b:m.a):null;b.textContent=`To the line · ${BOAT_RND[N.stage].toLowerCase()}${oi?" vs "+N.field[oi-1].name.split(" ").pop():""}`;}
  else{const c=testCost();b.textContent=`Enter the boat drags${c?" · "+fmt$(c):""}`;}}
/* the run sheet's trace: speed and prop slip against distance, the trim under them */
function drawBoatTrace(r){const css=getComputedStyle(document.documentElement),INK=css.getPropertyValue("--ink").trim()||"#edeae1";const soft=INK.startsWith("#1")?"rgba(20,20,19,.45)":"rgba(237,234,225,.45)";
  const dpr=Math.min(devicePixelRatio,2),W=chart.clientWidth,H=chart.clientHeight;if(chart.width!==W*dpr){chart.width=W*dpr;chart.height=H*dpr;}
  const x=chart.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);const tr=(r.trace||[]).filter(p=>p.x<=SIM.BOAT_FT+30);if(!tr.length)return;
  const L=SIM.BOAT_FT,padL=34,padR=34,padT=12,padB=22,cw=W-padL-padR,ch=H-padT-padB,X=d=>padL+cw*Math.max(0,Math.min(1,d/(L+20))),mx=Math.max(20,Math.ceil(Math.max(...tr.map(p=>p.v))*2.23694/20)*20);
  x.strokeStyle=css.getPropertyValue("--grid").trim()||"rgba(255,255,255,.07)";x.lineWidth=1;x.font="10px "+getComputedStyle(document.body).fontFamily;x.textAlign="center";
  for(let f=0;f<=1000;f+=200){const px=X(f/3.28084);x.beginPath();x.moveTo(px,padT);x.lineTo(px,padT+ch);x.stroke();x.fillStyle=soft;x.fillText(f+" ft",px,H-6);}
  x.fillStyle="rgba(238,90,94,.14)";tr.forEach((p,i)=>{if(p.b&&i)x.fillRect(X(tr[i-1].x),padT,Math.max(1,X(p.x)-X(tr[i-1].x)),ch);});
  const line=(f,col,w,dash)=>{x.strokeStyle=col;x.lineWidth=w;x.setLineDash(dash||[]);x.beginPath();tr.forEach((p,i)=>{const px=X(p.x),py=padT+ch*(1-Math.max(0,Math.min(1,f(p))));i?x.lineTo(px,py):x.moveTo(px,py);});x.stroke();x.setLineDash([]);};
  const tR=SIM.boatTrimRange();line(p=>(p.trim-tR[0])/(tR[1]-tR[0]),"rgba(92,191,138,.85)",1.2,[2,3]);line(p=>Math.max(0,p.slip),"rgba(120,169,221,.9)",1.5);line(p=>p.v*2.23694/mx,"#d97757",2.2);
  x.strokeStyle=INK;x.lineWidth=1;x.setLineDash([3,3]);x.beginPath();x.moveTo(X(L),padT);x.lineTo(X(L),padT+ch);x.stroke();x.setLineDash([]);
  const ly=padT+ch-6;x.textAlign="left";x.font="11px "+getComputedStyle(document.body).fontFamily;x.fillStyle="#d97757";x.fillText("mph",padL+4,ly);x.fillStyle="rgba(120,169,221,.9)";x.fillText("slip",padL+34,ly);x.fillStyle="rgba(92,191,138,.95)";x.fillText("trim",padL+60,ly);x.fillStyle="rgba(238,90,94,.8)";x.fillText("blown",padL+88,ly);
  x.fillStyle=soft;x.textAlign="right";x.fillText(mx+" mph",W-padR,ly);}
function boatRedraw(){const l=lastForChart();if(S.env.testType==="boat"&&l&&l.boat)drawBoatTrace(l.boat);}
function boatSlipCard(r,res){const M=r.match||{},f3=v=>v==null?"—":(+v).toFixed(3),rt=v=>v==null?"—":v<0?"RED":(+v).toFixed(3),mk=n=>(r.marks||[]).find(q=>q.n===n),failed=!!res.boatFailed;
  const rows=[["R/T",M.foul?"RED":rt(r.rt),rt(M.oppRt)],["60'",f3(mk("60 ft")&&mk("60 ft").t),""],["330'",f3(mk("330 ft")&&mk("330 ft").t),""],["660'",f3(mk("660 ft")&&mk("660 ft").t),""],["MPH",mk("660 ft")?mk("660 ft").mph.toFixed(2):"—","","mph"],
    ["1000'",failed?"BROKE":r.et!=null?f3(r.et):({blowover:"BLEW OVER",hooked:"HOOKED",stuffed:"STUFFED"}[r.dnf]||"DNF"),M.oppDnf?(M.oppDnf==="broke"?"BROKE":"DNF"):f3(M.oppEt),"et"],["MPH",r.mph!=null&&!failed?r.mph.toFixed(2):"—",M.oppMph!=null&&!M.oppDnf?M.oppMph.toFixed(2):"—","mph"]];
  const verdict=failed?"BROKE":M.foul?"RED LIGHT":M.won?"WIN":"LOSS",when=new Date(r.at||Date.now()),lamp=w=>`<i class="lamp${w?" on":""}"></i>`;
  const pb=r.pb&&r.et!=null?`<div class="stamp">CLASS BEST<br><s>${r.pb.was}</s> ${r.et.toFixed(3)}</div>`:"";
  return`<div class="tslip${M.won?" won":""}" role="group" aria-label="Timing slip"><div class="tsh"><b>PRAIRIE RIVER DRAGS</b><small>1,000 ft · ${boatEsc(r.clsName)} · ${boatEsc(M.label||"")}</small><small>${when.toLocaleDateString("en-CA")} ${String(when.getHours()).padStart(2,"0")}:${String(when.getMinutes()).padStart(2,"0")}</small></div>
    <div class="tsc"><strong>${boatEsc((S.name||engineName()||"").slice(0,40))}</strong>${Math.round(res.peakHp)} hp · ${boatEsc(SIM.BOAT_HULLS[r.hull].n)} · ${r.drive==="jet"?r.imp+"-cut pump":r.pitch+'" prop'} · ${r.gear}:1 · ${r.mass.toLocaleString("en-CA")} kg${r.auto?r.auto.took!=null?" · you took over":" · auto driver":""}</div>
    <table><thead><tr><th></th><th class="you"><small>Right lane</small>${lamp(M.won)}You</th><th><small>Left lane</small>${lamp(!M.won)}${boatEsc(String(M.opp||"").split(" ").pop())}</th></tr></thead>
    <tbody>${rows.map(x=>`<tr class="${x[3]||""}"><td>${x[0]}</td><td>${x[1]}</td><td>${x[2]===""?"":x[2]}</td></tr>`).join("")}</tbody></table>
    <div class="tsw"><b class="${M.won?"w":"l"}">${verdict}</b><span>${M.margin!=null?"by "+Math.abs(M.margin).toFixed(3)+" s":""}</span></div>${pb}<div class="tsf">Wind ${r.water.wind>=0?"+":""}${r.water.wind} m/s · ${boatEsc(r.water.name)}</div></div>`;}
function boatVerdict(res){const r=res.boat,M=r.match||{},nt=r.night||{};
  const head=res.boatFailed?(r.broke==="valve_float"?"FLOATED THE VALVES":r.broke==="head_lift"?"COOKED IT":"BROKE ON THE RIVER"):M.foul?"RED LIGHT":r.dnf==="blowover"?"BLEW OVER":r.dnf==="hooked"?"HOOKED IT":r.dnf==="stuffed"?"STUFFED IT":M.won?`WON ${boatEsc(M.label)}`:`LOST ${boatEsc(M.label)}`;
  const cls=res.boatFailed||r.dnf||M.foul?"fail":M.won?"pass":"marg";
  const sub=nt.done?`${BOAT_PLACE[nt.place]||""}${r.purse?` · purse ${fmt$(r.purse)}`:""}`:`On to the ${BOAT_RND[nt.stage+1]?BOAT_RND[nt.stage+1].toLowerCase():"next round"}`;
  return `<div class="verdict ${cls}"><div style="flex:1"><div class="big">${head}${r.et!=null&&!res.boatFailed?`<br><span style="font-size:.7em;opacity:.85">${r.et.toFixed(3)} s @ ${r.mph.toFixed(1)} mph</span>`:""}</div><p>${boatEsc(r.clsName)} · vs ${boatEsc(M.opp)} (${M.oppDnf?M.oppDnf==="broke"?"broke":"DNF":M.oppEt!=null?M.oppEt.toFixed(3)+" @ "+Math.round(M.oppMph):"—"}) · ${sub}${r.auto?r.auto.took!=null?" · you took over":" · auto driver":""}${r.pb?` · class best (was ${r.pb.was})`:""}${res.boatFailed&&career()?" — certification is void and reputation took a hit":""}</p>
    <div class="vstats"><div><b>${r.rt!=null&&!M.foul?r.rt.toFixed(3):"RED"}</b><span>reaction</span></div><div><b>${r.humpT!=null?r.humpT.toFixed(2):"—"}</b><span>s to the hump</span></div><div><b>${r.blowN}</b><span>blowouts</span></div><div><b>${r.maxMph.toFixed(0)}</b><span>top mph</span></div></div></div></div>`;}
function boatSheet(res){const r=res.boat,N=boatCur();
  const wi=wearInfo(res);const wear=wi?`<div><b>Wear</b>${wi.passes} of ${wi.budget} pass${wi.budget===1?"":"es"} · <span style="color:${wi.w>=1?"var(--crit)":wi.w>0.6?"var(--warn)":"var(--good)"}">${Math.round(wi.w*100)}%</span>${res.wornBy?" · down "+res.wornBy+"% on power":""}${wi.w>0?` <button class="btn sm" id="freshen" style="margin-left:8px">Freshen · ${fmt$(freshenCost(res))}</button>`:""}</div>`:"";
  return `<div class="sec"><h2>Timing slip</h2><div class="tslipw">${boatSlipCard(r,res)}</div>
    <div class="log" style="margin-top:12px"><div><b>Setup</b>${r.drive==="jet"?r.imp+"-cut impeller":r.pitch+'" pitch'} · ${r.gear}:1 · trim ${r.trim0>=0?"+":""}${r.trim0}° at the start · ${r.mass.toLocaleString("en-CA")} kg</div>
    <div><b>Water</b>${boatEsc(r.water.name)} (chop ${Math.round(r.water.chop*100)}%) · ${Math.abs(r.water.wind)} m/s ${r.water.wind>=0?"headwind":"tailwind"}</div>
    <div><b>Engine</b>${r.peakRpm.toLocaleString()} rpm peak · ${r.limT>0.05?r.limT.toFixed(1)+" s on the limiter · ":""}raw water ${r.coolPeak} °C${r.slipEnd!=null?` · ${Math.round(r.slipEnd*100)}% slip at the line`:""}</div>
    ${r.reasons.map(x=>`<div>${x}</div>`).join("")}${wear}</div>
    ${N&&N.cls===r.cls?`<h2 style="margin-top:12px">The ladder</h2>${boatLadderHtml(N)}`:""}</div>`;}
