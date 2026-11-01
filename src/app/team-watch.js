/* ===================== TEAM: WATCH IT (since 1.76.54) =====================
   The Team tab's race-day result card (p.last, app/team.js) has a "Watch it" button that replays the team's race in the
   event's own 3D scene: the drag series' last pass of the night on the strip (ENGINE_VIS.setStrip and the strip HUD), the
   oval series' last laps of the feature on the oval (ENGINE_VIS.setOval and the run view's HUD band).
   Race day keeps only a few numbers for it, in p.last.watch (out.watch from pcDragDay / pcOvalDay, copied by pcSettle):
     drag  the round, each lane's reaction time, ET and mph (a lane that broke: the pace it was on), the car's hardware and
           the rival's car. The motion is rebuilt from those: x = L·(t/ET)^p, with p set so the speed at the stripe is the trap mph.
     oval  the round's seed, the grid, the rivals' power and luck, your lap times and where it broke. The rivals' races run
           again through the same sim (ovalCarRun is deterministic); your car follows your lap times on a rival's lap shape.
   Watching only reads: no money, rep, wear, records or achievements move, and the real events' nights are left alone.
   A kind with no watch recorded, and any older save, shows no button. Controls: #pcwCtl in the Events tab (html/body.html),
   styles in css/ui-team.css. */
let PCW=null;
const PCW_LAPS=3,PCW_KINDS={drag:1,oval:1},PCW_RV=RV_LIVE.find(x=>x[0]==="pcwCtl");
const pcwOk=L=>!!(L&&L.watch&&PCW_KINDS[L.watch.kind]);
const pcw3=v=>v==null?null:+(+v).toFixed(3),pcw1=v=>v==null?null:+(+v).toFixed(1);
/* ---- race day: what to keep ---- */
/* w: the last pass the team's car made {rd, me, op?, rv?, won?}; a lane that broke keeps the pace it was on (qualifying, or the rival's) */
function pcwDragRec(T,E,cfg,w,q0,field){try{
  const ok=x=>!!(x&&x.et!=null&&!x.broke),me=w.me,op=w.op||null,rv=w.rv||null,mid=field[Math.floor(field.length/2)]||{mean:12,mph:110};
  const hw=stripHw(cfg);hw.style=carShell(E.body,hw.diesel);
  return{kind:"drag",body:E.body,rd:w.rd,car:T.car||"",rl:cfg.redline,hw,rt:pcw3(me.rt),et:ok(me)?pcw3(me.et):null,mph:ok(me)?pcw1(me.mph):null,
    pe:ok(me)?null:ok(q0)?[pcw3(q0.et),pcw1(q0.mph)]:[pcw3((rv||mid).mean),pcw1((rv||mid).mph)],
    on:rv?rv.name:null,oc:rv?rv.car:null,ort:op?pcw3(op.rt):null,oet:ok(op)?pcw3(op.et):null,omph:ok(op)?pcw1(op.mph):null,
    oat:op&&!ok(op)?op.at||0.5:null,ope:op&&!ok(op)?[pcw3(rv.mean),pcw1(rv.mph)]:null,won:w.won==null?null:!!w.won};}catch(e){return null;}}
/* the feature: g the grid (-1 is yours), h each rival's power on the day, d each rival's dnfAt (-1: no DNF; kept mid-lap so the
   replay draws the same lap), laps your lap times, b [time, distance, speed] where it broke, rk rpm per m/s (one gear) */
function pcwOvalRec(T,k,tk,seed,roster,ids,pr){try{
  const tr=pr.trace||[],last=tr[tr.length-1],q=tr.filter(x=>x[2]>8).map(x=>x[3]/x[2]),N=OVAL_FEAT-3;
  return{kind:"oval",cls:k,tk,seed,ts:T.seed>>>0,num:T.num||0,g:ids.map(id=>id==="me"?-1:id),h:roster.map(x=>x.hp),
    d:roster.map(x=>x.dnfF?+((Math.floor(x.dnfAt*N)+0.5)/N).toFixed(4):-1),laps:pr.laps.map(pcw3),
    b:pr.finished?null:last?[last[0],last[1],last[2]]:[0,0,0],rk:q.length?pcw1(q.reduce((a,b)=>a+b,0)/q.length):60};}catch(e){return null;}}
/* ---- the replay ---- */
function pcWatch(){const L=pcS().last;if(!pcwOk(L)||PCW)return;if(testing){toast("Let the run finish first");return;}
  const w=L.watch;PCW_RV[1]=w.kind==="drag"?null:"pcwLive";   // the strip brings its own HUD; the oval's card goes on the view
  testing=true;PCW={kind:w.kind,w,L,t:0,last:performance.now(),speed:w.kind==="oval"?2:1};
  $("app").classList.add("onstrip");$("tab-events").classList.add("pcw");$("pcwSpd").hidden=w.kind!=="oval";$("pcwSpd").textContent="2×";
  $("pcwLive").innerHTML=`<p class="hint">${esc(L.team)} · round ${L.round}: loading the race…</p>`;$("pcwCtl").style.display="";
  ENGINE_VIS.setAutoRotate(false);showTab("events");$("panel").scrollTop=0;
  try{if(w.kind==="drag")pcwDragGo(PCW);else pcwOvalGo(PCW);}catch(e){pcwFail(e);}}
function pcwFail(e){if(e&&window.console)console.warn("Watch it:",e);pcwEnd();toast("Couldn't replay that race");}
function pcwEnd(){const P=PCW;if(!P)return;PCW=null;
  if(P.kind==="drag"){ENGINE_VIS.setStrip({on:false});shudStop(0);}else if(ENGINE_VIS.setOval)ENGINE_VIS.setOval({on:false});
  $("app").classList.remove("onstrip");$("pcwCtl").style.display="none";$("tab-events").classList.remove("pcw");$("pcwLive").innerHTML="";
  testing=false;run.on=false;run.rpm=0;run.load=0;ENGINE_VIS.setAutoRotate(null);renderTest();
  if(curTab==="events"){showTab("market");requestAnimationFrame(()=>{const c=$("pcLast");if(c&&c.scrollIntoView)c.scrollIntoView({block:"start"});});}}
function pcwSkip(){const P=PCW;if(!P||P.tEnd==null)return;
  if(P.kind==="drag"){if(P.sent>=2){if(!ENGINE_VIS.stripSkip())pcwEnd();}else P.t=Math.max(P.t,P.tEnd);}
  else P.t=Math.max(P.t,P.tEnd-4);}
/* ---- the strip: both lanes rebuilt from the slip ---- */
const PCW_GREEN=2.6;   // staged at 0, the ambers from 1.1 s, green 1.5 s later
/* one lane t s after it left: x = L·(t/ET)^p, then the chute or the brakes; brk: the time it broke (then a coast) */
function pcwLane(t,et,mph,brk,chute){const L=402.336,p=Math.min(2.2,Math.max(1.15,mph/2.23694*et/L)),tc=brk!=null?Math.min(brk,et):et;
  const at=u=>({x:L*Math.pow(u/et,p),v:p*L/et*Math.pow(u/et,p-1)});
  if(t<=0)return{x:0,v:0,end:tc+at(tc).v/(brk!=null&&brk<et?2.5:chute?9:6)};
  const a=at(Math.min(t,tc)),dec=brk!=null&&brk<et?2.5:chute?9:6,end=tc+at(tc).v/dec;if(t<=tc)return Object.assign(a,{end});
  const d=Math.min(t-tc,a.v/dec);return{x:a.x+a.v*d-dec*d*d/2,v:Math.max(0,a.v-dec*d),end,broke:brk!=null&&t>=brk};}
/* gear and rpm from the speed: n gears, shifts spaced as a close-ratio box would */
function pcwGear(v,vt,n){const u=Math.min(1.05,v/Math.max(1,vt)),b=g=>Math.pow(g/n,0.75);let g=1;while(g<n&&u>b(g))g++;
  const lo=g>1?b(g-1):0,hi=g<n?b(g):1.02;return{g,k:(g>1?0.66:0.5)+0.32*Math.max(0,Math.min(1,(u-lo)/Math.max(0.01,hi-lo)))};}
function pcwDragGo(P){const w=P.w,car=carVeh({body:w.body}),ch=!!car.chute;
  const me={rt:w.rt||0,et:w.et!=null?w.et:w.pe[0],mph:w.et!=null?w.mph:w.pe[1]};me.brk=w.et==null?me.et*0.45:null;
  const op=w.on?{rt:w.ort||0,et:w.oet!=null?w.oet:w.ope[0],mph:w.oet!=null?w.omph:w.ope[1]}:null;if(op)op.brk=w.oet==null?op.et*(w.oat||0.5):null;
  const stopAt=l=>PCW_GREEN+l.rt+pcwLane(0,l.et,l.mph,l.brk,ch).end;
  Object.assign(P,{car,ch,me,op,gears:car.gears||4,look:op?rivalLook(w.on,w.oc,w.body,null):undefined,color:carPaint(),pv:0,pg:1,pgT:-9,og:1,ogT:-9,sent:0,doneAt:null,
    tEnd:Math.max(stopAt(me),op?Math.min(stopAt(op),PCW_GREEN+op.rt+op.et+0.5):0)+0.3});
  ENGINE_VIS.stripRace&&ENGINE_VIS.stripRace(null);
  $("pcwLive").innerHTML=`<p class="hint"><b>${esc(w.rd)}</b>${w.on?` vs ${esc(w.on)} (${esc(w.oc||"")})`:", a solo pass"}${P.L.txt&&P.L.txt!==w.rd?" · "+esc(P.L.txt):""}. Watching only: nothing on the books changes.</p>`;
  shudStart();run.on=true;requestAnimationFrame(pcwDragStep);}
function pcwDragStep(){const P=PCW;if(!P||P.kind!=="drag")return;const now=performance.now(),dt=Math.min(0.1,(now-P.last)/1000);P.last=now;P.t+=dt;
  const w=P.w,t=P.t,me=P.me,op=P.op,L=402.336,rl=w.rl||7000;
  if(P.sent>=2){   // the strip's own after-the-pass show is on: wait it out, then back to the team
    run.rpm+=(900-run.rpm)*Math.min(1,dt*2);run.load=0;
    if(P.doneAt==null)P.doneAt=now;if(ENGINE_VIS.stripBusy()>0)P.doneAt=now;else if(now-P.doneAt>1200){pcwEnd();return;}
    requestAnimationFrame(pcwDragStep);return;}
  const tl=t-(PCW_GREEN+me.rt),a=pcwLane(tl,me.et,me.mph,me.brk,P.ch),failed=!!a.broke,done=t>=P.tEnd;
  const ph=done?"done":tl<0?"staged":a.x>=L?"shutdown":"run";
  const o=op?pcwLane(t-(PCW_GREEN+op.rt),op.et,op.mph,op.brk,P.ch):null;
  const gm=pcwGear(a.v,me.mph/2.23694,P.gears);if(gm.g!==P.pg){P.pg=gm.g;P.pgT=t;}
  const go=o?pcwGear(o.v,op.mph/2.23694,P.gears):null;if(go&&go.g!==P.og){P.og=go.g;P.ogT=t;}
  const acc=dt>0?(a.v-P.pv)/dt:0;P.pv=a.v;
  const left=tl>=0,oleft=op&&t>=PCW_GREEN+op.rt,past=a.x>=L&&!failed,opast=o&&o.x>=L&&op.brk==null;
  const rpm=ph==="staged"?rl*(0.42+0.03*Math.sin(t*9)):failed||ph!=="run"?Math.max(900,run.rpm-dt*rl*0.8):rl*gm.k;
  run.rpm=rpm;run.load=ph==="run"&&!failed?1:0.1;
  ENGINE_VIS.setStrip({on:true,dt,x:a.x,v:a.v,ox:o?o.x:0,ov:o?o.v:0,acc,spin:false,phase:ph,chute:P.ch&&a.x>L+2&&!failed,race:!!op,foul:left&&me.rt<0,body:w.body,wbar:!!P.car.wbar,tyreIn:P.car.tyreDia,color:P.color,hw:w.hw,opp:P.look,
    tree:{staged:true,a1:t>=1.1,a2:t>=1.6,a3:t>=2.1,green:t>=PCW_GREEN},shifting:ph==="run"&&t-P.pgT<0.18&&P.pg>1,boost:0,boostTarget:0,rpm,redline:rl,gear:gm.g,
    launch:{armed:false,twoStep:false,transBrake:false,held:0,retard:0,pops:0},tyreTemp:0.8,burnout:false,lift:0,onBars:false,brake:ph==="shutdown",failed,failKind:failed?"rod":null,night:!!S.night,
    rt:left?me.rt:null,et:past?w.et:undefined,mph:past?w.mph:undefined,
    ort:oleft?op.rt:undefined,ofoul:!!(oleft&&op.rt<0),oet:opast?w.oet:undefined,omph:opast?w.omph:undefined,win:op&&w.won!=null?w.won:undefined,
    oburn:false,ospin:false,oshifting:!!(go&&oleft&&t-P.ogT<0.18&&P.og>1),olift:0,ochute:!!(op&&P.ch&&o.x>L+2)});
  if(done)P.sent++;
  pcwDragHud(P,ph,a,o,left,past,opast,failed,rpm,rl,gm.g);
  requestAnimationFrame(pcwDragStep);}
const pcwT3=v=>(v<0?"−":"")+Math.abs(v).toFixed(3).replace(/^0(?=\.)/,"");
function pcwDragHud(P,ph,a,o,left,past,opast,failed,rpm,rl,g){if(!SH)return;const w=P.w,t=P.t,me=P.me,op=P.op,c=[];
  const green=t>=PCW_GREEN,foul=left&&me.rt<0;
  c.push(["tree",foul?"RED LIGHT":left?"RT "+me.rt.toFixed(3):"TREE",`<div class="shbulbs"><i class="pz on"></i>${[1.1,1.6,2.1].map(x=>`<i class="a${t>=x&&!green&&!foul?" on":""}"></i>`).join("")}<i class="${foul?"r on":"g"+(green?" on":"")}"></i></div>`,foul?"bad":""]);
  if(op&&left){const mg=past&&opast?(w.oet+Math.max(0,op.rt))-(w.et+Math.max(0,me.rt)):null,gap=(a.x-o.x)*3.281;
    c.push(mg!=null?["gap","Margin",(mg>=0?"+":"−")+pcwT3(Math.abs(mg)).replace("−","")+"<i>s</i>",mg>=0?"good":"bad"]:["gap","vs "+esc(shOpp(w.on)),foul?"RED":(gap>=0?"+":"")+Math.round(gap)+"<i>ft</i>",foul||gap<0?"bad":"good"]);}
  c.push(["et",past?"ET":"Clock",past?w.et.toFixed(3):Math.max(0,t-PCW_GREEN-Math.max(0,me.rt)).toFixed(2)+"<i>s</i>",""]);
  c.push(["mph",past?"Trap mph":"mph",String(Math.round(past?w.mph:a.v*2.23694)),""]);
  shudRow(c);
  let h=failed?`<em class="l">BROKE</em>`:ph==="staged"?(green?`<em class="o">GO</em>`:"staged"):ph==="run"?`gear ${g}`:"";
  if((ph==="shutdown"||ph==="done")&&op&&w.won!=null)h=`<em class="${w.won?"w":"l"}">${w.won?"WIN":"LOSS"}</em>`+(h?" · "+h:"");
  const s=`${esc(w.rd)}${op?" · vs "+esc(shOpp(w.on)):" · solo"} · replay`;
  shudSet("cap",SH.cap,h?s+" · "+h:s);const f=Math.min(1,rpm/rl);
  shudSet("rpm",SH.rpm,`${ph==="run"?"G"+g+" · ":""}${(Math.round(rpm/10)*10).toLocaleString("en-CA")} rpm`);shudSet("bar",SH.bi,`scaleX(${f.toFixed(3)})`,"transform");shudSet("lim",SH.bar,f>0.965?"shr lim":"shr","cls");}
/* ---- the oval: the rivals' races again, your car on your lap times ---- */
function pcwOvalGo(P){const w=P.w,base=ovalRoster(w.cls,w.ts),cars=[];let i=0;
  const next=()=>{if(PCW!==P)return;try{
      while(i<w.g.length){const gi=i++,id=w.g[gi];if(id<0)continue;
        const R=Object.assign({},base[id],{hp:w.h[id],res:null,dnfH:false,dnfF:w.d[id]>=0,dnfAt:Math.max(0,w.d[id])});
        cars.push(Object.assign({},ovalCarRun(R,w.cls,w.seed,"feature",OVAL_FEAT,ovalGridOff(gi),OVAL_HEAT,0.6,w.tk),{cut:null}));setTimeout(next,0);return;}   // one race a beat: no long pause on a phone
      pcwOvalStart(P,cars);}catch(e){pcwFail(e);}};
  setTimeout(next,30);}
/* a car's raw trace at time t (no flag, no DNF) */
function pcwAt(c,t){const T=c.t,Sx=c.s,n=T.length;if(t<=T[0])return{s:Sx[0],v:0};if(t>=T[n-1])return{s:Sx[n-1],v:0};let lo=0,hi=n-1;
  while(hi-lo>1){const m=(lo+hi)>>1;if(T[m]<=t)lo=m;else hi=m;}const d=Math.max(1e-6,T[hi]-T[lo]);return{s:Sx[lo]+(Sx[hi]-Sx[lo])*(t-T[lo])/d,v:(Sx[hi]-Sx[lo])/d};}
function pcwOvalStart(P,cars){const w=P.w,N=OVAL_FEAT,len=SIM.ovalTrack(w.tk).len,gm=w.g.indexOf(-1),mc=[];let acc=0;w.laps.forEach(x=>{acc+=x;mc.push(acc);});
  const b=w.b?w.b.slice():null,n=mc.length,fin=!b&&n>=N?mc[N-1]:null;if(b){b[0]=Math.max(b[0],(n?mc[n-1]:0)+0.05);b[1]=Math.max(b[1],n?n*len:-ovalGridOff(gm));}
  const fins=cars.filter(c=>!c.dnf&&c.fin!=null).map(c=>c.fin);if(fin!=null)fins.push(fin);const Tw=fins.length?Math.min(...fins):Infinity;
  if(isFinite(Tw))cars.forEach(c=>ovalCutAt(c,Tw,N));
  const end=fin!=null?fin:b[0],t0=fin!=null?Math.max(0,mc[N-1-PCW_LAPS]-1.5):n>=2?Math.max(0,mc[n-2]-1.5):0;
  Object.assign(P,{cars,len,mc,b,fin,Tw,off:ovalGridOff(gm),ref:cars.find(c=>!c.dnf&&c.cross.length>=N)||null,t:t0,pre:t0>0?0:2.5,tEnd:end+4,end,doneAt:null,hudT:0,color:carPaint(),
    nm:pcFirst({name:P.L.name}).slice(0,12),idle:850,rl:9000});
  $("pcwLive").innerHTML=`<div class="rdh hlh"><div class="rd-spd"><b id="pcwV">0</b><i>km/h</i></div><div class="rd-g"><b id="pcwP">–</b><i id="pcwPi">place</i></div><div class="rd-lt"><b id="pcwLap">0/${N}</b><i>lap</i></div><div class="rd-lt"><b id="pcwT">0:00.0</b><i>clock</i></div></div><div class="hl-next" id="pcwN"></div>`;
  run.on=true;P.last=performance.now();requestAnimationFrame(pcwOvalStep);}
/* your car at race time t: on lap i it covers the lap in your lap time, along the reference rival's lap shape (the same corners) */
function pcwMe(P,t){const{mc,len,off,ref,b}=P,n=mc.length;if(t<=0)return{s:-off,v:0};let i=0;while(i<n&&mc[i]<=t)i++;
  if(i<n){const a=i?mc[i-1]:0,e=mc[i],sA=i?i*len:-off,sB=(i+1)*len,f=(t-a)/Math.max(0.01,e-a);
    if(ref&&ref.cross.length>i){const ra=i?ref.cross[i-1]:0,rb=ref.cross[i],rA=i?i*len:ref.s[0],q=pcwAt(ref,ra+f*(rb-ra)),k=(sB-sA)/Math.max(1,sB-rA);
      return{s:sA+Math.max(0,Math.min(1,(q.s-rA)/Math.max(1,sB-rA)))*(sB-sA),v:Math.max(0,q.v*(rb-ra)/Math.max(0.01,e-a)*k)};}
    return{s:sA+f*(sB-sA),v:(sB-sA)/Math.max(0.01,e-a)};}
  const a=n?mc[n-1]:0,s0=n?n*len:-off;
  if(b){const[tb,sb,vb]=b;if(t<tb)return{s:s0+(sb-s0)*(t-a)/Math.max(0.01,tb-a),v:(sb-s0)/Math.max(0.01,tb-a)};const d=Math.min(t-tb,vb/8);return{s:sb+vb*d-4*d*d,v:Math.max(0,vb-8*(t-tb)),out:true};}
  return{s:s0+20*(t-a),v:20,fin:true};}
function pcwOvalStep(){const P=PCW;if(!P||P.kind!=="oval")return;const now=performance.now(),dt=Math.min(0.1,(now-P.last)/1000);P.last=now;
  const w=P.w,N=OVAL_FEAT,len=P.len;
  if(P.pre>0)P.pre-=dt;else P.t+=dt*(P.t>=P.end?1:P.speed);
  const t=P.t,pre=P.pre>0,me=pcwMe(P,pre?0:t),done=t>=P.end,after=done?t-P.end:0,lap=Math.max(0,Math.floor(me.s/len));
  if(done&&P.doneAt==null){P.doneAt=now;if(P.b)failFlash(300);else buzz([30,40,30]);}
  const carsV=[{me:true,s:me.s,v:me.v,color:P.color,num:w.num,n:P.nm,groove:1.6,slide:0,thr:me.fin||me.out?0.1:0.85,brk:0,spin:0}];
  const rk=[{me:true,key:me.out?-1e9+(P.mc.length):me.fin?N*len+1e-3*(1-P.end/1e4):me.s}];
  P.cars.forEach(c=>{const a=pre?{s:-ovalGridOff(w.g.indexOf(c.id)),v:0}:ovalAt(c,t);
    carsV.push(a?{s:a.s,v:a.v,color:c.color,num:c.num,n:c.n,groove:c.groove,thr:0.6,brk:0}:{gone:true,s:0,v:0,color:c.color});
    rk.push(a?{c,key:c.cut&&t>=c.cut.t?c.cut.s+1e-3*(1-c.cut.t/1e4):a.s}:{c,out:true,key:-1e9+(c.dnf?c.dnf.lap:0)});});
  rk.sort((x,y)=>y.key-x.key);const pos=rk.findIndex(r=>r.me)+1;
  const top=rk.filter(r=>!r.out&&!(r.me&&me.out)).slice(0,12).map(r=>r.me?{num:w.num,n:"YOU",me:true}:{num:r.c.num,n:r.c.n.split(" ").pop()});
  if(ENGINE_VIS.setOval)ENGINE_VIS.setOval({on:true,track:SIM.ovalTrack(w.tk),cars:carsV,pre,done:done&&after>0.4,flag:done?"checker":pre?"yellow":lap>=N-1?"white":"green",cam:"auto",night:!!S.night,lastLap:lap>=N-1,
    toFlag:(N*len-me.s)/Math.max(10,me.v),order:top,boardHead:"FEATURE",dt:dt*(pre||done?1:P.speed)});
  run.rpm=done?run.rpm+(P.idle-run.rpm)*Math.min(1,dt*3):pre?P.idle+600*Math.max(0,Math.sin(now/200)):Math.max(P.idle,Math.min(P.rl,me.v*w.rk));run.load=done||pre?0.05:0.8;
  if((P.hudT+=dt)>0.1||done){P.hudT=0;const st=me.out?`<div class="hl-ev bad">OUT · lap ${P.mc.length+1}</div>`:done?`<div class="hl-ev good">CHEQUERED · ${ordN(pos)}</div>`:pre?`<div class="hl-ev">GREEN IN ${Math.ceil(P.pre)}…</div>`:`<div class="hl-c">${lap>=N-1?"White flag · last lap":`The last laps of the feature`} · ${esc(P.L.txt)}</div>`;
    $("pcwV").textContent=Math.round(me.v*3.6);$("pcwP").textContent=pos;$("pcwPi").textContent=`of ${P.cars.length+1}`;$("pcwLap").textContent=`${Math.min(N,lap+1)}/${N}`;$("pcwT").textContent=fmtOvRace(Math.max(0,t));
    const nn=$("pcwN");if(nn.dataset.k!==st){nn.dataset.k=st;nn.innerHTML=st;}}
  if(done&&t>=P.tEnd){pcwEnd();return;}
  requestAnimationFrame(pcwOvalStep);}
/* ---- the buttons ---- */
$("mkTeam").addEventListener("click",e=>{if(career()&&e.target.closest("[data-pcwatch]"))pcWatch();});
$("pcwBack").addEventListener("click",()=>pcwEnd());
$("pcwSkip").addEventListener("click",()=>pcwSkip());
$("pcwSpd").addEventListener("click",()=>{const P=PCW;if(!P||P.kind!=="oval")return;P.speed=P.speed>=4?1:P.speed*2;$("pcwSpd").textContent=P.speed+"×";buzz(4);});
