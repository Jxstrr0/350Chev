/* ===================== TEAM: WATCH IT (since 1.76.54) =====================
   The Team tab's race-day result card (p.last, app/team.js) has a "Watch it" button that replays the team's race in the
   event's own 3D scene: the drag series' last pass of the night on the strip (ENGINE_VIS.setStrip and the strip HUD), the
   oval series' last laps of the feature on the oval (ENGINE_VIS.setOval and the run view's HUD band).
   Race day keeps only a few numbers for it, in p.last.watch (out.watch from each kind's race day, copied by pcSettle):
     drag  the round, each lane's reaction time, ET and mph (a lane that broke: the pace it was on), the car's hardware and
           the rival's car. The motion is rebuilt from those: x = L·(t/ET)^p, with p set so the speed at the stripe is the trap mph.
     oval  the round's seed, the grid, the rivals' power and luck, your lap times and where it broke. The rivals' races run
           again through the same sim (ovalCarRun is deterministic); your car follows your lap times on a rival's lap shape.
     pull, bog, boat, hill  the sim's own trace of the team's run, thinned to whole numbers (pcwPack; the hill's by distance), and
           the few facts the scene needs. The pull replays the hook that settled it (the pull-off if there was one), the boat
           drags the team's last pass of the night with the other lane rebuilt from its slip, the hill the whole climb at 4×.
   Watching only reads: no money, rep, wear, records or achievements move, and the real events' nights are left alone.
   A kind with no watch recorded, and any older save, shows no button. Controls: #pcwCtl in the Events tab (html/body.html),
   styles in css/ui-team.css. */
let PCW=null;
const PCW_OFF={oval:"setOval",pull:"setPull",bog:"setBog",boat:"setBoat",hill:"setHill"},PCW_SPD={oval:4,hill:8};   // each kind's scene; the kinds with a speed button and their top speed
const PCW_LAPS=3,PCW_KINDS={drag:1,oval:1,pull:1,bog:1,boat:1,hill:1},PCW_RV=RV_LIVE.find(x=>x[0]==="pcwCtl");
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
  testing=true;PCW={kind:w.kind,w,L,t:0,last:performance.now(),speed:w.kind==="oval"?2:w.kind==="hill"?4:1};
  $("app").classList.add("onstrip");$("tab-events").classList.add("pcw");$("pcwSpd").hidden=!PCW_SPD[w.kind];$("pcwSpd").textContent=PCW.speed+"×";
  $("pcwLive").innerHTML=`<p class="hint">${esc(L.team)} · round ${L.round}: loading the race…</p>`;$("pcwCtl").style.display="";
  ENGINE_VIS.setAutoRotate(false);showTab("events");$("panel").scrollTop=0;
  try{if(w.kind==="drag")pcwDragGo(PCW);else if(w.kind==="oval")pcwOvalGo(PCW);else if(w.kind==="hill")pcwHillGo(PCW);else pcwRunGo(PCW);}catch(e){pcwFail(e);}}
function pcwFail(e){if(e&&window.console)console.warn("Watch it:",e);pcwEnd();toast("Couldn't replay that race");}
function pcwEnd(){const P=PCW;if(!P)return;PCW=null;
  if(P.kind==="drag"){ENGINE_VIS.setStrip({on:false});shudStop(0);}else{const off=ENGINE_VIS[PCW_OFF[P.kind]];if(off)off({on:false});}
  $("app").classList.remove("onstrip");$("pcwCtl").style.display="none";$("tab-events").classList.remove("pcw");$("pcwLive").innerHTML="";
  testing=false;run.on=false;run.rpm=0;run.load=0;ENGINE_VIS.setAutoRotate(null);renderTest();
  if(curTab==="events"){showTab("market");requestAnimationFrame(()=>{const c=$("pcLast");if(c&&c.scrollIntoView)c.scrollIntoView({block:"start"});});}}
function pcwSkip(){const P=PCW;if(!P||P.tEnd==null)return;
  if(P.kind==="drag"){if(P.sent>=2){if(!ENGINE_VIS.stripSkip())pcwEnd();}else P.t=Math.max(P.t,P.tEnd);}
  else P.t=Math.max(P.t,P.tEnd-4);}
/* ---- the strip: both lanes rebuilt from the slip ---- */
const PCW_GREEN=2.6;   // staged at 0, the ambers from 1.1 s, green 1.5 s later
/* one lane t s after it left: x = L·(t/ET)^p, then the chute or the brakes; brk: the time it broke (then a coast) */
function pcwLane(t,et,mph,brk,chute,len){const L=len||402.336,p=Math.min(2.2,Math.max(1.15,mph/2.23694*et/L)),tc=brk!=null?Math.min(brk,et):et;
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
/* ---- the pull, the bog, the boat drags and the hill climb: the sim's own trace, kept thin ----
   Each of those sims already logs its run (the trace on its result). Race day thins that onto an even clock (pcwPack: whole
   numbers, five a second) and keeps it with the few facts the scene needs; the replay reads it back (pcwAtT) and feeds the
   event's scene every frame, the same fields the live event sends. The hill's trace is by distance (one row every 50 m), so
   its clock is rebuilt from the speeds and squared up to the real time. */
const PCW_DT=0.2,PCW_COLS={
  pull:{x:["x",100],r:["rpm",0.1],s:["slip",100],b:["boxFrac",100],f:["throttle",10],o:["boost",10],h:["hop",100],a:["ra",10]},
  bog:{x:["x",100],r:["rpm",0.1],s:["slip",100],f:["throttle",10],k:["sink",100],y:["y",100],w:["w",10],p:["pack",100],g:["dig",100]},
  boat:{x:["x",100],r:["rpm",0.1],s:["slip",100],f:["thr",10],m:["trim",10],l:["lr",100],b:["b",1],w:["bow",10],a:["air",1]}};
function pcwPack(kind,tr){if(!tr||tr.length<2)return null;const C=PCW_COLS[kind],te=+tr[tr.length-1].t,n=Math.ceil(te/PCW_DT-1e-9),q={};let j=0;
  for(const c in C)q[c]=[];
  for(let i=0;i<=n;i++){const t=Math.min(te,i*PCW_DT);while(j<tr.length-2&&tr[j+1].t<t)j++;
    const a=tr[j],b=tr[j+1],f=b.t>a.t?Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t))):0;
    for(const c in C){const k=C[c][0],va=+a[k]||0,vb=+b[k]||0;q[c].push(Math.round((va+(vb-va)*f)*C[c][1]));}}
  for(const c in q)if(q[c].every(v=>v===0))delete q[c];   // a channel that never moved (no boost, no runaway) is left out
  return{te:+te.toFixed(2),q};}
/* the trace at time t, back in the sim's units and names, with the speed from the distance */
function pcwAtT(w,t){const C=PCW_COLS[w.kind],n=(w.q.x||[]).length,u=Math.max(0,Math.min(w.te,t)),i=Math.max(0,Math.min(n-2,Math.floor(u/PCW_DT))),t0=i*PCW_DT,t1=Math.min(w.te,t0+PCW_DT),
    f=t1>t0?Math.max(0,Math.min(1,(u-t0)/(t1-t0))):1,o={};
  for(const c in C){const a=w.q[c];o[C[c][0]]=a?(a[i]+(a[i+1]-a[i])*f)/C[c][1]:0;}
  o.v=t>=w.te||t<=0||!w.q.x?0:Math.max(0,(w.q.x[i+1]-w.q.x[i])/100/Math.max(0.02,t1-t0));return o;}
const pcwFailK=k=>FAIL_VISUAL[k]||(k==="turbo"?"turbo":k==="piston"?"knock":"rod");
function pcwPullRec(k,veh,pr,po,res){try{const tr=pcwPack("pull",pr.trace);if(!tr)return null;
  return Object.assign(tr,{kind:"pull",cls:k,tyre:veh.tyre,hitch:veh.hitch,ballast:veh.ballast,trk:veh.track||null,hp:Math.round(res.peakHp||0),idle:veh.idle,rl:veh.redline,dsl:res.diesel?1:0,
    po:po?1:0,full:pr.full?1:0,ft:pcw1(pr.distFt),why:pr.stopWhy||null,brk:pr.broke||null,kill:pr.killed?1:0});}catch(e){return null;}}
function pcwBogRec(k,veh,pr,res,seed,churn){try{const tr=pcwPack("bog",pr.trace);if(!tr)return null;
  return Object.assign(tr,{kind:"bog",cls:k,tyre:veh.tyre,ns:seed,cons:veh.night.cons,churn:churn?1:0,idle:veh.idle,rl:veh.redline,dsl:res.diesel?1:0,
    clr:pr.cleared&&!pr.broke?1:0,pt:pcw3(pr.pitT),m:pcw1(pr.distM),why:pr.stopWhy||null,brk:pr.broke||null});}catch(e){return null;}}
/* q: the sim's pass, me: what race day made of it (the light, the ET), rd: the round, op and rv: the other lane's pass and boat */
function pcwBoatRec(E,q,me,rd,op,rv,water,res,won){try{const tr=pcwPack("boat",q.trace);if(!tr)return null;const ok=op&&op.et!=null&&!op.broke;
  return Object.assign(tr,{kind:"boat",cls:E.cls,rd,water:{seed:water.seed,wind:water.wind,chop:water.chop,name:water.name},rl:res.redline||0,dsl:res.diesel?1:0,
    rt:pcw3(me.rt),et:pcw3(me.et),mph:pcw1(me.mph),dnf:q.dnf||null,brk:q.broke||null,fin:q.et!=null?1:0,
    on:rv?rv.name:null,ort:op?pcw3(op.rt):null,oet:ok?pcw3(op.et):null,omph:ok?pcw1(op.mph):null,oat:op&&!ok?op.at||0.5:null,ope:rv?[pcw3(rv.mean),pcw1(rv.mph)]:null,won:won==null?null:!!won});}catch(e){return null;}}
/* the climb: v km/h, p the pedal (throttle 1..10, brake -1..-10) and g the gear at every 50 m; se and T where and when it ended;
   offs [kind, metres, seconds lost]; end: null (the top), the sim's DNF kind, or "mech" (the engine let go) */
function pcwHillRec(T,k,hid,ae,pr,st,gone,rl){try{const tr=pr.trace||[];if(tr.length<2)return null;
  return{kind:"hill",cls:k,hid,ch:T.ch,ae,num:T.num||0,rl:rl||7000,v:tr.map(x=>Math.round(x[1])),p:tr.map(x=>x[5]>0.05?-Math.round(x[5]*10):Math.round(x[4]*10)),g:tr.map(x=>x[6]),
    se:Math.round(st.s),T:+(+st.t).toFixed(2),tm:pcw3(pr.time),offs:(pr.offs||[]).map(o=>[o.kind,o.at,o.loss]),end:gone?"mech":pr.dnf?pr.dnf.kind:null,nm:pr.dnf&&pr.dnf.name||null};}catch(e){return null;}}
/* the card on the view for those four: three numbers and a line under them */
function pcwHudInit(a,b,c){$("pcwLive").innerHTML=`<div class="rdh hlh"><div class="rd-spd"><b id="pcwV">0</b><i>${a}</i></div><div class="rd-g"><b id="pcwP">–</b><i>${b}</i></div><div class="rd-lt"><b id="pcwLap">–</b><i>${c}</i></div><div class="rd-lt"><b id="pcwT">0.0</b><i>clock</i></div></div><div class="hl-next" id="pcwN"></div>`;}
function pcwHud(P,dt,done,a,b,c,t,st){if((P.hudT=(P.hudT||0)+dt)<0.1&&!done)return;P.hudT=0;
  $("pcwV").textContent=a;$("pcwP").textContent=b;$("pcwLap").textContent=c;$("pcwT").textContent=t;const nn=$("pcwN");if(nn.dataset.k!==st){nn.dataset.k=st;nn.innerHTML=st;}}
const pcwEv=(cls,txt)=>`<div class="hl-ev${cls?" "+cls:""}">${txt}</div>`,pcwLine=(P,txt)=>`<div class="hl-c">${txt} · ${esc(P.L.txt||"")}</div>`;
/* one clock for the three trace replays: a beat on the line, the run, then a few seconds on the result */
function pcwRunGo(P){const w=P.w;P.pre=w.kind==="boat"?3:1.4;P.tEnd=w.te+4;P.vs=0;P.doneAt=null;P.failed=false;
  if(w.kind==="bog"){const n=SIM.bogNight(w.ns),C0=SIM.BOG_CLASSES[w.cls],pitK=C0.veh.pitK||1;
    P.night=Object.assign({},n,{cons:w.cons,name:SIM.bogMudName(w.cons),depth:w.churn?n.depth.map(d=>+(d*1.15).toFixed(3)):n.depth});
    P.pit={seed:n.seed,len:n.len,cons:w.cons,depth:P.night.depth,hz:n.hz,pitK};P.pitK=pitK;P.rw=C0.veh.tyreDia*0.0254/2;pcwHudInit("km/h","metres","mud");}
  else if(w.kind==="pull")pcwHudInit("ft","mph","slip");
  else{P.o=w.ort!=null?pcwLane(0,w.oet!=null?w.oet:w.ope[0],w.oet!=null?w.omph:w.ope[1],w.oet!=null?null:w.oat*w.ope[0],false,SIM.BOAT_FT):null;
    if(P.o)P.tEnd=Math.max(P.tEnd,Math.min(w.te+8,Math.max(0,w.ort)+(w.oet!=null?w.oet:w.oat*w.ope[0])+3));pcwHudInit("mph","ft","race");}
  run.on=true;P.last=performance.now();requestAnimationFrame(pcwRunStep);}
function pcwRunStep(){const P=PCW;if(!P||!PCW_COLS[P.kind])return;const now=performance.now(),dt=Math.min(0.1,(now-P.last)/1000);P.last=now;
  try{if(P.pre>0)P.pre-=dt;else P.t+=dt;
    const w=P.w,pre=P.pre>0,t=pre?0:P.t,a=pcwAtT(w,t),done=!pre&&t>=w.te;P.vs+=(a.v-P.vs)*Math.min(1,dt*8);const v=done?0:P.vs;
    if(done&&P.doneAt==null){P.doneAt=now;const good=w.kind==="pull"?w.full&&!w.brk:w.kind==="bog"?!!w.clr:w.won!==false&&w.fin&&!w.brk;if(w.brk){P.failed=true;failFlash(300);}else if(good){winFlash();buzz([30,40,30,40,90]);}else buzz([40]);}
    const failed=P.failed,rpm=failed?Math.max(0,run.rpm-380*dt*60):done?run.rpm+((w.idle||850)-run.rpm)*Math.min(1,dt*3):pre?(w.idle||850)+500*Math.max(0,Math.sin(now/190)):Math.max(300,a.rpm);
    if(w.kind==="pull")pcwPullFrame(P,w,a,v,pre,done,failed,rpm,dt);else if(w.kind==="bog")pcwBogFrame(P,w,a,v,pre,done,failed,rpm,dt,t);else pcwBoatFrame(P,w,a,v,pre,done,failed,rpm,dt,t);
    run.rpm=rpm;run.load=failed||done?0:pre?0.05:Math.max(0.05,a.throttle||a.thr||0);
    if(!pre&&t>=P.tEnd){pcwEnd();return;}}catch(e){pcwFail(e);return;}
  requestAnimationFrame(pcwRunStep);}
function pcwPullFrame(P,w,a,v,pre,done,failed,rpm,dt){const ra=a.ra>0&&!done;
  if(ENGINE_VIS.setPull)ENGINE_VIS.setPull({on:true,phase:pre?"stage":done?"done":"pull",x:a.x,v,boxFrac:a.boxFrac,slip:a.slip,hop:a.hop,smoke:w.dsl?Math.min(1,0.25+0.6*a.throttle):0,rpm,vehicle:SIM.PULL_CLASSES[w.cls].veh.kind,
    full:done&&!!w.full,night:!!S.night,cls:w.cls,distFt:a.x*3.28084,dt,throttle:a.throttle,boost:a.boost,failed,failKind:failed?pcwFailK(w.brk):null,hitch:w.hitch,ballast:w.ballast,tyre:w.tyre,hp:w.hp,track:w.trk||undefined,
    runaway:ra?Math.max(0.2,a.ra):0,killed:done&&!!w.kill});
  const st=done?(w.brk?pcwEv("bad",w.brk==="runaway"&&!w.kill?"RUNAWAY · DQ":"BROKE · "+w.ft.toFixed(1)+" ft"):w.full?pcwEv("good","FULL PULL"):pcwEv("",w.ft.toFixed(1)+" ft"+(w.why?" · "+({bogged:"bogged down",spun:"spun out",lifted:"lifted",killed:"killed"}[w.why]||"stopped"):"")))
    :pre?pcwEv("","HOOKED UP…"):ra?pcwEv("bad","RUNAWAY"):pcwLine(P,w.po?"The pull-off, on the heavier sled":"The hook");
  pcwHud(P,dt,done,done?w.ft.toFixed(1):(a.x*3.28084).toFixed(0),(v*2.237).toFixed(1),Math.round(100*Math.min(1,a.slip))+"%",Math.min(w.te,Math.max(0,P.t)).toFixed(1),st);}
function pcwBogFrame(P,w,a,v,pre,done,failed,rpm,dt,t){const L=P.night.len,x=Math.max(-50,a.x),inPit=!pre&&a.x>=0,now=performance.now();let slap=0;
  if(inPit&&!P.inPit){P.inPit=true;slap=1;}
  if(slap){sfx("mudslap");if(typeof foley==="function")foley("mud",{gain:1});}else if(inPit&&!done&&a.slip>0.2&&now-(P.slapT||0)>Math.max(140,520-600*a.slip)){P.slapT=now;sfx("mudslap");}
  const y0=P.y0||0;P.y0=a.y;
  if(ENGINE_VIS.setBog)ENGINE_VIS.setBog({on:true,phase:pre?"stage":done?"done":inPit?"pit":"runup",x:a.x,v,wspd:done&&!w.clr?a.w*P.rw*0.6:a.w*P.rw,slip:a.slip,sink:a.sink,y:a.y,vy:(a.y-y0)/Math.max(0.01,dt),
    dFront:SIM.bogDepth(P.night,x)*P.pitK,dRear:SIM.bogDepth(P.night,x-3.6)*P.pitK,rpm,throttle:a.throttle,smoke:w.dsl?0.5:0.1,cls:w.cls,tyre:w.tyre,color:BOG_COLORS[w.cls],night:!!S.night,len:L,cons:w.cons,pit:P.pit,
    mudKg:70*a.pack,pack:a.pack,slap,cleared:done&&!!w.clr,failed,belly:0,dig:a.dig,why:done?w.why:null,rw:P.rw,dt});
  const st=done?(w.brk?pcwEv("bad","BROKE · "+w.m.toFixed(1)+" m in"):w.clr?pcwEv("good","THROUGH · "+(w.pt!=null?w.pt.toFixed(2)+" s":"")):pcwEv("warn","STUCK · "+w.m.toFixed(1)+" m in"))
    :pre?pcwEv("","ON THE LINE…"):pcwLine(P,inPit?"In the pit":"The run-up");
  pcwHud(P,dt,done,Math.round(v*3.6),inPit?Math.min(L,Math.max(0,a.x)).toFixed(1):"–",P.night.name,Math.min(w.te,Math.max(0,t)).toFixed(1),st);}
function pcwBoatFrame(P,w,a,v,pre,done,failed,rpm,dt,t){const C0=SIM.BOAT_CLASSES[w.cls],tl=3-Math.max(0,P.pre),L=SIM.BOAT_FT,pl=u=>Math.min(1,Math.max(0,u/9-0.6));
  const tree={pre:tl>0.6,stage:tl>1.0,amb:pre?Math.max(0,Math.min(3,Math.floor((tl-1.5)/0.5)+1)):0,green:!pre,redMe:w.rt!=null&&w.rt<0,redOpp:w.ort!=null&&w.ort<0};
  let o={x:0,v:0},oDone=false;if(P.o&&!pre){const ob=w.oet==null;o=pcwLane(t-Math.max(0,w.ort),w.oet!=null?w.oet:w.ope[0],w.oet!=null?w.omph:w.ope[1],ob?w.oat*w.ope[0]:null,false,L);
    oDone=ob?!!o.broke:o.x>=L-0.5;if(!ob&&o.x>L+60){o.x=L+60;o.v=0;}}
  if(!P.roost&&v>1){P.roost=true;if(typeof foley==="function")foley("rooster");}
  const fin=done&&!!w.fin,air=a.air>0.5;if(air&&!P.air)sfx("mudslap");P.air=air;
  if(ENGINE_VIS.setBoat)ENGINE_VIS.setBoat({on:true,phase:pre?"tree":done?"done":"run",cls:w.cls,hull:C0.hull,drive:C0.drive,dt,night:!!S.night,water:w.water,tree,
    me:{x:a.x,v:done&&fin?P.vs:v,rpm,thr:done?0:a.thr,trim:a.trim,bow:a.bow,pl:pl(P.vs),slip:a.slip,blown:a.b>0.5,air:air?1:0,porp:0,walk:0,lr:a.lr,hop:0,flip:done&&w.dnf==="blowover",hook:done&&w.dnf==="hooked",stuff:done&&w.dnf==="stuffed",failed,color:0xff7a1a,smoke:w.dsl?0.5:0.08},
    opp:{x:o.x,v:o.v,bow:o.v>1?Math.max(0,6.5*Math.exp(-Math.pow((o.v/9-1)/0.8,2)))+2:0,pl:pl(o.v),thr:oDone||pre||!P.o?0:1,color:0x2a6fdb,name:w.on||"",flip:false},
    finish:fin,meEt:fin?w.et:null,meMph:fin?w.mph:null,oppEt:oDone&&w.oet!=null?w.oet:null,oppMph:oDone&&w.oet!=null?w.omph:null,won:done&&w.won!=null&&(oDone||t>w.te+1.2)?w.won:null,skip:false});
  const say=w.brk?"BROKE":w.dnf?({blowover:"BLEW OVER",hooked:"HOOKED",stuffed:"STUFFED IT",time:"STUCK ON THE HUMP"}[w.dnf]||"NO TIME"):w.rt<0?"RED LIGHT":w.et!=null?w.et.toFixed(3)+" s · "+Math.round(w.mph)+" mph":"NO TIME";
  const st=done?pcwEv(w.brk||w.dnf||w.rt<0?"bad":w.won===false?"warn":"good",(w.won==null?"":w.won?"WON · ":"LOST · ")+say):pre?pcwEv("",tl>1.5?"AMBERS…":"STAGED"):pcwLine(P,esc(w.rd)+(w.on?" vs "+esc(w.on):""));
  pcwHud(P,dt,done,Math.round((done&&fin?w.mph/2.237:v)*2.237),Math.round(Math.min(L,a.x)*3.28084),!P.o?"solo":o.x>a.x+1?"behind":"ahead",fin?w.et.toFixed(3):Math.min(w.te,Math.max(0,t)).toFixed(1),st);}
/* ---- the hill: the whole climb from the 50 m rows ---- */
function pcwHillGo(P){const w=P.w,Tc=SIM.hillCourse(w.hid),n=w.v.length,S0=[],V=w.v.map(x=>x/3.6),tt=[0];
  for(let i=0;i<n;i++)S0.push(Math.min(w.se,i*50));if(w.se>S0[n-1]+1){S0.push(w.se);V.push(w.end?0:V[n-1]);}
  const loss=new Array(S0.length).fill(0);let lost=0;w.offs.forEach(o=>{let i=1;while(i<S0.length-1&&S0[i]<o[1])i++;loss[i]+=o[2];lost+=o[2];});
  for(let i=1;i<S0.length;i++)tt.push(tt[i-1]+(S0[i]-S0[i-1])/Math.max(2,(V[i]+V[i-1])/2));
  const k=Math.max(0.2,(w.T-lost))/Math.max(1,tt[tt.length-1]);let acc=0;for(let i=1;i<tt.length;i++){acc+=loss[i];tt[i]=tt[i]*k+acc;}   // squared up to the real time, the offs put back where they happened
  const vg={};w.g.forEach((g,i)=>{vg[g]=Math.max(vg[g]||1,V[i]);});
  Object.assign(P,{Tc,S0,V,tt,vg,su:SIM.setupVis(null),color:carPaint(),pre:2.5,tEnd:w.T+4,doneAt:null,i:0,hudT:0,evAt:-9,evK:null,offI:0,idle:900});
  pcwHudInit("km/h","gear","to go");run.on=true;P.last=performance.now();requestAnimationFrame(pcwHillStep);}
function pcwHillStep(){const P=PCW;if(!P||P.kind!=="hill")return;const now=performance.now(),dt=Math.min(0.1,(now-P.last)/1000);P.last=now;
  try{const w=P.w,{S0,V,tt,Tc}=P,n=tt.length,pre=P.pre>0;if(pre)P.pre-=dt;else P.t+=dt*(P.t>=w.T?1:P.speed);
    const t=pre?0:Math.min(P.t,w.T),done=!pre&&P.t>=w.T;while(P.i<n-2&&tt[P.i+1]<t)P.i++;while(P.i>0&&tt[P.i]>t)P.i--;
    const i=P.i,f=tt[i+1]>tt[i]?Math.max(0,Math.min(1,(t-tt[i])/(tt[i+1]-tt[i]))):1,s=done?w.se:S0[i]+(S0[i+1]-S0[i])*f,gi=Math.min(w.g.length-1,i),g=w.g[gi]||1,ped=(w.p[gi]||0)/10;
    /* an off between two rows: the car sits in it for the seconds it lost, then gets going again */
    let off=null;const o=w.offs.find(x=>x[1]>=S0[i]&&x[1]<S0[i+1]+0.01);if(o&&!done){const span=tt[i+1]-tt[i],mv=Math.max(0.5,span-o[2]),u=t-tt[i];if(u>mv*0.5&&u<mv*0.5+o[2])off=o[0];
      if(off&&P.evK!==o){P.evK=o;P.evAt=now;buzz([60,30,60]);sfx("mudslap");if(o[0]!=="rail"&&typeof foley==="function")foley("gravel");}}
    const v=done||pre?0:off?1.5:V[i]+(V[i+1]-V[i])*f,rpm=done?run.rpm+(P.idle-run.rpm)*Math.min(1,dt*3):pre?P.idle+800*Math.max(0,Math.sin(now/180)):Math.max(P.idle,Math.min(w.rl,w.rl*(0.5+0.47*Math.min(1,v/Math.max(4,P.vg[g]||v)))));
    if(done&&P.doneAt==null){P.doneAt=now;if(w.end)failFlash(300);else{winFlash();buzz([30,40,30,40,90]);}}
    const edge=done&&w.end==="edge";
    if(ENGINE_VIS.setHill)ENGINE_VIS.setHill({on:true,su:P.su,course:Tc,s,v,d:0,g,rpm,thr:off||done?0:Math.max(0,ped),brk:Math.max(0,-ped),lat:0,off,dnf:done&&w.end&&w.end!=="mech"?w.end:null,ev:now-P.evAt<1000&&P.evK?P.evK[0]:edge&&now-P.doneAt<1000?"edge":null,
      ch:w.ch,aero:w.ae,color:P.color,cam:"auto",pre,done,night:false,dt:dt*(pre||done?1:P.speed)});
    run.rpm=rpm;run.load=done?0:pre?0.05:Math.max(0.05,ped);
    const sec=Tc.sections[Math.min(Tc.sections.length-1,Tc.sec[Math.min(Tc.N-1,Math.floor(s/Tc.ds))])].n,km=(w.se/1000).toFixed(1);
    const st=done?(w.end==="mech"?pcwEv("bad","BROKE · "+km+" km up"):w.end==="edge"?pcwEv("bad","OVER THE EDGE"):w.end==="boil"?pcwEv("bad","BOILED OVER"):w.end?pcwEv("warn","DID NOT FINISH"):pcwEv("good","THE TOP · "+fmtHill(w.tm)))
      :pre?pcwEv("","GREEN IN "+Math.ceil(P.pre)+"…"):off?pcwEv("warn",off==="rail"?"INTO THE RAIL":off==="gravel"?"IN THE GRAVEL":"OFF"):pcwLine(P,esc(sec));
    pcwHud(P,dt,done,Math.round(v*3.6),g,((Tc.len-s)/1000).toFixed(1)+" km",fmtHill(t),st);
    if(done&&P.t>=P.tEnd){pcwEnd();return;}}catch(e){pcwFail(e);return;}
  requestAnimationFrame(pcwHillStep);}
/* ---- the buttons ---- */
$("mkTeam").addEventListener("click",e=>{if(career()&&e.target.closest("[data-pcwatch]"))pcWatch();});
$("pcwBack").addEventListener("click",()=>pcwEnd());
$("pcwSkip").addEventListener("click",()=>pcwSkip());
$("pcwSpd").addEventListener("click",()=>{const P=PCW;if(!P||!PCW_SPD[P.kind])return;P.speed=P.speed>=PCW_SPD[P.kind]?1:P.speed*2;$("pcwSpd").textContent=P.speed+"×";buzz(4);});
