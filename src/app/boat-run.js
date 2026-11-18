/* ---- boat drags: the night as it is run (app-late.js, since 1.76.141.0): rivals, start, the hold button and trim, live card, finish, the boat shop.
   Night tables, the setup screen, records and the verdict are in app/boat.js ---- */
const BOAT_COLORS=[0x1d4787,0xb7261d,0x2c6b3a,0xe8c14a,0x6b3d8f,0x0e8a8a,0xd94e8f,0x8e8e8e];
function boatIdle(){return SIM.isDiesel(S.cfg)?650:Math.max(750,S.cfg.cam>70?1100:850);}
function boatVeh(k){const e=S.env;return{cls:k,pitch:e.boatPitch,imp:e.boatImp,gear:e.boatGear,trim:e.boatTrim,redline:S.cfg.redline,idle:boatIdle()};}
function boatSetN(n){if(career())C().boatN=n;else S.boatSb=n;}
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
function boatBtnText(t,sub){const b=$("boatBtn");const k=t+"|"+(sub||"");if(b.dataset.k===k)return;b.dataset.k=k;b.innerHTML=t+(sub?`<small>${sub}</small>`:"");}
function boatBreak(kind){BT.failed=true;BT.failKind=kind;run.fail=true;run.failKind=FAIL_VISUAL[kind]||"rod";failFlash();}
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
  scrollCtlIntoView("boatCtl");
  const step=()=>{if(!BT||BT.finished)return;const now=performance.now();const dt=Math.min(0.25,(now-BT.last)/1000);BT.last=now;const st=p.st;
    if(now>=BT.green){let left=Math.min(dt,(now-BT.green)/1000);while(left>1e-6&&st.t<60){const d=Math.min(0.02,left);left-=d;const c=boatCtl(st);p.step(d,c.thr,c.trim);}}
    else if(BT.down&&!BT.foul&&!BT.auto){BT.foul=true;buzz([60,30,60]);}
    if(st.broke&&!BT.failed)boatBreak(st.broke);
    if(st.hops>BT.hops){BT.hops=st.hops;sfx("mudslap");}
    if(!BT.rooster&&st.v>1){BT.rooster=true;if(typeof foley==="function")foley("rooster");}
    if(st.blown&&!BT.blown)buzz([12]);BT.blown=st.blown;
    const og=now<BT.green?0:st.t,o=boatOppAt(og);BT.ox=o.x;BT.ov=o.v;BT.oDone=o.done;
    if(st.done&&BT.doneAt==null&&(BT.oDone||st.t-st.doneT>1.2)){BT.doneAt=now;const w=boatWinNow();if(w===true){winFlash();buzz([30,40,30,40,90]);}else buzz([40]);}
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
function boatCtl(st){if(BT.failed)return{thr:0,trim:0};if(BT.auto){const a=BT.p.auto(1);return a;}return{thr:BT.down?1:0,trim:BT.tc};}
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
  $("boatLive").innerHTML=`<div class="ph"><div class="ph-top ${stat}"><b>${big}</b><span>${BT.label} · vs ${esc(BT.of.name)}<br>${say}</span></div>
    <div class="ph-bar"><i class="fill" style="width:${pc(st.x)}%"></i><i class="mk lead" style="left:${pc(BT.ox)}%"></i></div><div class="ph-lbl"><span>0</span><span>${esc(BT.of.boat)} <b>${Math.round(BT.ox*3.28084)} ft</b></span><span>1,000 ft</span></div>
    <div class="ph-lbl"><span>Water <b>${esc(BT.water.name)}</b></span><span>${BT.water.wind>=0?"head":"tail"}wind <b>${Math.abs(BT.water.wind).toFixed(1)} m/s</b></span></div></div>
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
  if(!st.done){if(performance.now()<BT.green)BT.green=performance.now();let n=0;while(!st.done&&n++<3000){const c=BT.auto?p.auto(1):{thr:BT.down?1:p.auto(1).thr,trim:BT.tc};p.step(0.02,c.thr,c.trim);}if(st.broke&&!BT.failed)boatBreak(st.broke);}
  if(ENGINE_VIS.boatSkip)ENGINE_VIS.boatSkip();BT.skip=true;if(BT.doneAt==null)BT.doneAt=performance.now()-2600;}
function boatFinish(){
  if(!BT||BT.finished)return;BT.finished=true;const {p,res,env,k,snap,hk,N,stage,oi}=BT;const r=p.result(),failed=BT.failed,C0=SIM.BOAT_CLASSES[k],same=testSame(snap);
  setTimeout(()=>{if(!testing){if(ENGINE_VIS.setBoat)ENGINE_VIS.setBoat({on:false});$("app").classList.remove("onstrip");}},2200);
  testing=false;run.on=false;run.fail=false;run.rpm=0;$("rpmbox").style.display="none";$("boatCtl").style.display="none";$("testProg").classList.add("done");setTimeout(()=>{$("testProg").style.width="0";},700);ENGINE_VIS.setAutoRotate(null);
  const me={rt:BT.foul?-0.01:r.rt,et:failed||r.dnf?null:r.et,mph:r.mph,dist:r.dist,dnf:failed?"broke":r.dnf};
  const op=BT.opp,won=boatJudge(me,op)==="a";
  if(typeof crowdAfter==="function")crowdAfter("boat",{broke:failed,won:won&&!failed});   // app/ambience.js
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
function boatPb(r,bad){if(ff||bad||r.et==null)return;const P=recBucket("boat"),was=P[r.cls];
  if(was&&!(r.et<was.et)){if(r.mph>(was.top||0))was.top=r.mph;return;}
  P[r.cls]=Object.assign({et:r.et,mph:r.mph,top:Math.max(r.mph,was&&was.top||0)},recTag());
  if(was){r.pb={was:was.et.toFixed(3)};setTimeout(()=>toast(`CLASS BEST · ${r.et.toFixed(3)} s (was ${r.pb.was})`),3200);}}
function boatShop(){const k=boatEnvFix(),key=k+"|"+cfgHash(S.cfg);if(boatShopC.has(key))return boatShopC.get(key);const res=SIM.boatPrep(S.cfg,stdEnv());
  const b=SIM.boatTune(res,k,{redline:S.cfg.redline,idle:boatIdle(),trim:S.env.boatTrim});if(boatShopC.size>20)boatShopC.clear();boatShopC.set(key,b);return b;}
$("envBox").addEventListener("click",e=>{
  if(e.target.closest("[data-boatleave]")){const N=boatLive();if(!N||testing)return;if(!confirm("Leave the night? You forfeit this round."))return;N.done=true;N.place=[5,3,2][N.stage]||5;N.purse=0;save();renderTest();return;}
  if(e.target.closest("[data-boatshop]")){const k=boatEnvFix(),key=k+"|"+cfgHash(S.cfg),C0=SIM.BOAT_CLASSES[k];
    if(!boatShopC.has(key)){const b=e.target.closest("[data-boatshop]");b.textContent="Prop shop is running the numbers…";b.disabled=true;setTimeout(()=>{boatShop();renderEnv();},30);return;}
    const s=boatShopC.get(key);if(s){if(C0.drive==="jet")S.env.boatImp=s.imp;else S.env.boatPitch=s.pitch;S.env.boatGear=s.gear;boatEnvFix();renderEnv();save();toast("Fitted · "+boatShopTxt(s,C0).split(" → ")[0]);}return;}
  const b=e.target.closest("[data-tk]");if(!b)return;const k=b.dataset.tk,v=b.dataset.tv;
  if(k==="boatCls"){const l=clsLocked(SIM.BOAT_CLASSES,v);if(l){toast(`${SIM.BOAT_CLASSES[v].n} opens at ${l} rep`);return;}if(v!==S.env.boatCls){S.env.boatPitch=null;S.env.boatGear=null;S.env.boatImp=null;}}
  S.env[k]=k==="boatImp"?+v:v;boatEnvFix();renderEnv();save();buzz(6);evPickRender();});
function boatRunBtn(){const N=boatLive(),b=$("runTest");if(testing)return;const k=S.env.boatCls;
  if(N&&N.cls===k){const m=boatMyMatch(N),oi=m?(m.a===0?m.b:m.a):null;b.textContent=`To the line · ${BOAT_RND[N.stage].toLowerCase()}${oi?" vs "+N.field[oi-1].name.split(" ").pop():""}`;}
  else{const c=testCost();b.textContent=`Enter the boat drags${c?" · "+fmt$(c):""}`;}}
function boatRedraw(){const l=lastForChart();if(S.env.testType==="boat"&&l&&l.boat)drawBoatTrace(l.boat);}
(()=>{const b=$("boatBtn"),tI=$("boatTrimIn"),tO=$("boatTrimOut");
  holdBtn(b,()=>BT,boatPress,boatRelease,r=>{if(!r.p)return;boatPress();setTimeout(boatRelease,60);});
  [[tI,-1],[tO,1]].forEach(([el,d])=>{el.addEventListener("pointerdown",e=>{e.preventDefault();try{el.setPointerCapture(e.pointerId);}catch(x){}boatTrim(d);});
    ["pointerup","pointercancel"].forEach(ev=>el.addEventListener(ev,()=>{if(BT&&BT.tc===d)BT.tc=0;}));el.addEventListener("contextmenu",e=>e.preventDefault());});
  /* arrow keys trim while a boat is on the course: up = out (bow up), down = in */
  document.addEventListener("keydown",e=>{if(!BT||BT.finished||$("boatCtl").style.display==="none"||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==="ArrowUp"||e.key==="ArrowDown"){e.preventDefault();if(!e.repeat)boatTrim(e.key==="ArrowUp"?1:-1);}});
  document.addEventListener("keyup",e=>{if(!BT)return;if(e.key==="ArrowUp"||e.key==="ArrowDown"){if(BT.tc===(e.key==="ArrowUp"?1:-1))BT.tc=0;}});})();
