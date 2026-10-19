/* ---- datalog: the pass, channel by channel. Trace rows: [t, m, mph, rpm, gear, spin, bar, wheel mph, EGT C, throttle, n2o] ---- */
const DL={on:{rpm:1,spd:1,whl:1,boost:1,egt:0,n2o:1},mode:"t"},DLM={},DLC={rpm:["rpm","rgba(120,169,221,.95)"],spd:["ground","#d97757"],whl:["wheel","INK"],boost:["boost","#5cbf8a"],egt:["EGT","#c58be0"],n2o:["N₂O","#e8c14a"]};
const dlCache=new WeakMap();
function dlPrep(r,res){if(!r||!r.trace||r.trace.length<4||r.trace[0].length<8)return null;let D=dlCache.get(r.trace);if(D)return D;
  const T=r.trace,n=T.length,col=i=>T.map(p=>p[i]==null?0:p[i]);
  D={n,t:col(0),x:col(1),mph:col(2),rpm:col(3),gear:col(4),spin:col(5),boost:col(6),whl:col(7),egt:col(8),thr:col(9),n2o:col(10)};
  D.tEnd=D.t[n-1];D.hasB=D.boost.some(v=>v>0.05);D.hasN=D.n2o.some(v=>v>0.02);
  D.rpmMax=Math.max(4000,Math.ceil(Math.max(...D.rpm,(r.veh&&r.veh.redline)||0)/1000)*1000);D.mphMax=Math.max(60,Math.ceil(Math.max(...D.mph,...D.whl)/20)*20);
  D.bMax=Math.max(1,Math.ceil(Math.max(...D.boost)*2)/2);D.eMax=Math.max(800,Math.ceil(Math.max(...D.egt)/100)*100);
  const tq=res&&res.peakTqRpm||0,reg=(f,minDur)=>{const o=[];let a=-1;for(let i=0;i<=n;i++){const on=i<n&&f(i);if(on&&a<0)a=i;if(!on&&a>=0){const e=i-1;if(D.t[e]-D.t[a]+0.05>=minDur)o.push({a,e});a=-1;}}return o;};
  D.spinR=reg(i=>D.whl[i]>D.mph[i]*1.09+1.5,0.1).map(g=>{let pk=g.a,gap=0,pc=0;for(let i=g.a;i<=g.e;i++){const d=D.whl[i]-D.mph[i];if(d>gap){gap=d;pk=i;}pc=Math.max(pc,D.mph[i]>=20?D.whl[i]/D.mph[i]-1:0);}return Object.assign(g,{pk,gap,pc,dur:D.t[g.e]-D.t[g.a]+0.05});});
  D.bogR=tq?reg(i=>D.thr[i]>0.5&&D.t[i]>0.1&&D.rpm[i]<0.7*tq,0.15).map(g=>{let m=1e9;for(let i=g.a;i<=g.e;i++)m=Math.min(m,D.rpm[i]);return Object.assign(g,{min:m,tq});}):[];
  D.sh=(r.shifts||[]).map(s=>({t:s.t,x:s.x,g:s.gear}));D.mk=(r.marks||[]).map(m=>({t:m.t,x:m.d,n:m.n}));
  dlCache.set(r.trace,D);return D;}
function dlWhen(D,i){const ts=D.t[i];let s=null;for(const h of D.sh)if(h.t<=ts&&ts-h.t<=1.2)s=h;if(s)return {k:"shift",txt:`${(ts-s.t).toFixed(2)} s after the ${s.g}–${s.g+1} shift`};if(ts<0.7)return {k:"launch",txt:"off the line"};return {k:"run",txt:`${Math.round(D.x[i]*3.28084)} ft down the track`};}
function dlDiag(r,res){const D=dlPrep(r,res);if(!D)return "";const o=[],v=r.veh||{};
  if(D.spinR.length){const g=D.spinR.slice().sort((a,b)=>b.gap*b.dur-a.gap*a.dur)[0],w=dlWhen(D,g.a),tot=D.spinR.reduce((s,q)=>s+q.dur,0),nit=D.hasN&&D.n2o[g.a]>0.3;
    const fix=w.k==="launch"?`${v.tyre&&v.tyre!=="slick"?"a stickier tyre, ":""}less launch rpm or a softer shock`:w.k==="shift"?`${nit?"bring the nitrous in later, ":""}shift a little later so the next gear isn't hit so hard, or a softer shock`:`${nit?"bring the nitrous in later, ":""}ease the power in or add rear weight`;
    o.push(`Spun ${g.dur.toFixed(2)} s ${w.txt}, wheels up to ${Math.round(g.gap)} mph over the car${g.pc>0?` (${Math.round(g.pc*100)}%)`:""}${D.spinR.length>1?` (${D.spinR.length} spins, ${tot.toFixed(2)} s in all)`:""} — try ${fix}.`);}
  if(D.bogR.length){const g=D.bogR[0],w=dlWhen(D,g.a);o.push(w.k==="launch"?`Bogged off the line — rpm fell to ${Math.round(g.min).toLocaleString()} against a ${g.tq.toLocaleString()} rpm torque peak: more launch rpm or a looser converter.`:`Fell to ${Math.round(g.min).toLocaleString()} rpm ${w.txt}, well under the ${g.tq.toLocaleString()} rpm torque peak — closer ratios or shift later.`);}
  return o.length?o.join(" "):`Clean log: wheel speed tracked the car all the way — ${D.tEnd.toFixed(1)} s with nothing lost to spin or bog.`;}
function dlHtml(id,r,res){const D=dlPrep(r,res);if(!D)return `<p class="hint">This pass was logged before the datalog existed — run another.</p>`;
  const sp=D.spinR.slice().sort((a,b)=>b.gap-a.gap)[0];DLM[id]={r,res,cur:sp?sp.pk:null};
  const chips=Object.keys(DLC).filter(k=>k==="boost"?D.hasB:k==="n2o"?D.hasN:true).map(k=>`<button class="chip dlch${DL.on[k]?" on":""}" data-dlch="${k}"><i style="background:${DLC[k][1]==="INK"?"var(--ink)":DLC[k][1]}"></i>${DLC[k][0]}</button>`).join("")+`<button class="chip dlch" data-dlx="1">x: ${DL.mode==="t"?"time":"distance"}</button>`;
  return `<div class="dlbox"><div class="chips dlchips">${chips}</div><canvas class="dlcv" id="${id}Cv"></canvas><div class="dlread" id="${id}Rd"></div><div class="dldiag${D.spinR.length||D.bogR.length?" bad":""}">${dlDiag(r,res)}</div></div>`;}
function dlCard(id,res){return `<div class="sec"><h2>Datalog</h2>${dlHtml(id,res.drag,res)}</div>`;}
function dlDraw(id){const M=DLM[id],cv=$(id+"Cv");if(!M||!cv||!cv.isConnected)return;const D=dlPrep(M.r,M.res);if(!D)return;
  const cs=getComputedStyle(cv),INK=cs.getPropertyValue("--ink").trim()||"#edeae1",soft=INK.startsWith("#1")?"rgba(20,20,19,.5)":"rgba(237,234,225,.5)",crit=cs.getPropertyValue("--crit").trim()||"#ee5a5e",grid=cs.getPropertyValue("--grid").trim()||"rgba(255,255,255,.07)",ff=getComputedStyle(document.body).fontFamily;
  const dpr=Math.min(devicePixelRatio||1,2),W=cv.clientWidth,H=cv.clientHeight;if(!W||!H)return;if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);}
  const x=cv.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);
  const padL=8,padR=8,padT=38,padB=32,cw=W-padL-padR,ch=H-padT-padB,byT=DL.mode==="t",xs=byT?D.t:D.x,xEnd=byT?D.tEnd:402.336,X=v=>padL+cw*Math.min(1,v/xEnd),Y=(v,m)=>padT+ch*(1-Math.max(0,Math.min(1,v/m)));
  const col=k=>DLC[k][1]==="INK"?INK:DLC[k][1];
  x.lineWidth=1;x.strokeStyle=grid;for(let i=0;i<=4;i++){const y=padT+ch*i/4;x.beginPath();x.moveTo(padL,y);x.lineTo(padL+cw,y);x.stroke();}
  x.font="10px "+ff;x.textBaseline="alphabetic";x.textAlign="center";x.fillStyle=soft;
  if(byT){const st=xEnd>14?2:1;for(let t=0;t<=xEnd;t+=st){x.beginPath();x.moveTo(X(t),padT);x.lineTo(X(t),padT+ch);x.stroke();x.fillText(t+"s",X(t),H-3);}}else{for(let f=0;f<=1320;f+=330){x.beginPath();x.moveTo(X(f*0.3048),padT);x.lineTo(X(f*0.3048),padT+ch);x.stroke();x.fillText(f+"'",X(f*0.3048),H-3);}}
  // spin and bog zones, then the gap between wheel and ground speed
  const zone=(g,c)=>{x.fillStyle=c;const a=X(xs[g.a]),b=X(xs[g.e]);x.fillRect(a,padT,Math.max(2,b-a),ch);};
  if(DL.on.whl)D.spinR.forEach(g=>zone(g,"rgba(238,90,94,.10)"));D.bogR.forEach(g=>zone(g,"rgba(232,193,74,.12)"));
  if(DL.on.n2o&&D.hasN){x.fillStyle="rgba(232,193,74,.35)";for(let i=1;i<D.n;i++)if(D.n2o[i]>0.02){const a=X(xs[i-1]),b=X(xs[i]);x.fillRect(a,padT+ch-5,Math.max(1,b-a),5);}}
  if(DL.on.whl&&DL.on.spd){x.fillStyle=crit;x.globalAlpha=.55;const run=[];for(let i=0;i<D.n;i++)run.push(D.whl[i]>D.mph[i]*1.03+0.5);
    for(let i=0;i<D.n;i++){if(!run[i]||(i>0&&run[i-1]))continue;let e=i;while(e+1<D.n&&run[e+1])e++;x.beginPath();for(let j=i;j<=e;j++){const px=X(xs[j]),py=Y(D.whl[j],D.mphMax);j===i?x.moveTo(px,py):x.lineTo(px,py);}for(let j=e;j>=i;j--)x.lineTo(X(xs[j]),Y(D.mph[j],D.mphMax));x.closePath();x.fill();}x.globalAlpha=1;}
  const line=(arr,m,c,w,dash)=>{x.strokeStyle=c;x.lineWidth=w;x.lineJoin="round";x.setLineDash(dash||[]);x.beginPath();for(let i=0;i<D.n;i++){const px=X(xs[i]),py=Y(arr[i],m);i?x.lineTo(px,py):x.moveTo(px,py);}x.stroke();x.setLineDash([]);};
  if(DL.on.egt)line(D.egt,D.eMax,col("egt"),1.3);if(DL.on.boost&&D.hasB)line(D.boost,D.bMax,col("boost"),1.5);if(DL.on.rpm)line(D.rpm,D.rpmMax,col("rpm"),1.4);
  if(DL.on.spd)line(D.mph,D.mphMax,col("spd"),2.2);if(DL.on.whl)line(D.whl,D.mphMax,INK,1.3,[4,3]);
  // markers: shifts on top, distance marks along the bottom (staggered so phones don't pile up)
  x.textAlign="center";x.font="9px "+ff;x.strokeStyle=soft;x.lineWidth=1;x.setLineDash([2,3]);x.fillStyle=soft;
  const mark=(v,lab,row)=>{const px=X(v);x.beginPath();x.moveTo(px,padT);x.lineTo(px,padT+ch);x.stroke();x.textAlign=px<padL+26?"left":px>W-padR-26?"right":"center";x.fillText(lab,px,padT+ch+9+row*10);};
  mark(0,"launch",0);D.mk.forEach((m,i)=>mark(byT?m.t:m.x,{"60 ft":"60'","330 ft":"330'","1/8 mi":"1/8","1000 ft":"1000'","1/4 mi":"finish"}[m.n]||m.n,(i+1)%2));
  x.setLineDash([]);D.sh.forEach(h=>{const px=X(byT?h.t:h.x);x.fillStyle=INK;x.beginPath();x.moveTo(px,padT-1);x.lineTo(px-4,padT-8);x.lineTo(px+4,padT-8);x.closePath();x.fill();x.fillStyle=soft;x.textAlign="center";x.fillText(h.g+"–"+(h.g+1),px,padT-11);});
  // scales
  x.textAlign="left";x.font="10px "+ff;let sx=padL+2;
  [["rpm",DL.on.rpm,D.rpmMax/1000+"k rpm"],["spd",DL.on.spd||DL.on.whl,D.mphMax+" mph"],["boost",DL.on.boost&&D.hasB,(S.psi?bv(D.bMax):D.bMax)+" "+pU()],["egt",DL.on.egt,D.eMax+"°C"]].forEach(([k,on,t])=>{if(!on)return;x.fillStyle=col(k);x.fillText(t,sx,10);sx+=x.measureText(t).width+9;});
  // cursor
  const i=M.cur;if(i!=null&&i>=0&&i<D.n){const px=X(xs[i]);x.strokeStyle=INK;x.lineWidth=1;x.beginPath();x.moveTo(px,padT-12);x.lineTo(px,padT+ch);x.stroke();
    const dot=(arr,m,c)=>{x.fillStyle=c;x.beginPath();x.arc(px,Y(arr[i],m),3.2,0,7);x.fill();};if(DL.on.rpm)dot(D.rpm,D.rpmMax,col("rpm"));if(DL.on.spd)dot(D.mph,D.mphMax,col("spd"));if(DL.on.whl)dot(D.whl,D.mphMax,INK);if(DL.on.boost&&D.hasB)dot(D.boost,D.bMax,col("boost"));if(DL.on.egt)dot(D.egt,D.eMax,col("egt"));}
  const rd=$(id+"Rd");if(rd){if(i==null||i<0||i>=D.n)rd.innerHTML=`<span class="hint">Touch or hover the chart to read every channel at that instant.</span>`;
    else{const sp=D.mph[i]>=20?D.whl[i]/D.mph[i]-1:0,sw=D.whl[i]>D.mph[i]*1.09+1.5;rd.innerHTML=`<b>${D.t[i].toFixed(2)} s</b><b>${Math.round(D.x[i]*3.28084)} ft</b><span style="color:${col("rpm")}">${Math.round(D.rpm[i]).toLocaleString()} rpm</span><span>gear ${D.gear[i]}</span><span style="color:${col("spd")}">${D.mph[i].toFixed(0)} mph</span><span class="${sw?"sw":""}">wheel ${D.whl[i].toFixed(0)} mph${D.mph[i]>=20?` (${sp>=0?"+":""}${Math.round(sp*100)}%)`:""}${sw?" SPIN":""}</span>${D.hasB?`<span style="color:${col("boost")}">${D.boost[i].toFixed(2)} bar</span>`:""}<span style="color:${col("egt")}">${D.egt[i]} °C</span><span>throttle ${Math.round(D.thr[i]*100)}%</span>${D.hasN&&D.n2o[i]>0.02?`<span style="color:${col("n2o")}">N₂O on</span>`:""}`;}}}
function dlAll(){for(const id in DLM)dlDraw(id);}
let dlRaf=0;function dlSched(){if(!dlRaf)dlRaf=requestAnimationFrame(()=>{dlRaf=0;dlAll();});}
document.addEventListener("click",e=>{const b=e.target.closest("[data-dlch],[data-dlx]");if(!b)return;if(b.dataset.dlx){DL.mode=DL.mode==="t"?"x":"t";document.querySelectorAll("[data-dlx]").forEach(q=>q.textContent="x: "+(DL.mode==="t"?"time":"distance"));}else{const k=b.dataset.dlch;DL.on[k]=DL.on[k]?0:1;document.querySelectorAll(`[data-dlch="${k}"]`).forEach(q=>q.classList.toggle("on",!!DL.on[k]));}dlAll();});
function dlScrub(e){const cv=e.target.closest&&e.target.closest(".dlcv");if(!cv||(e.type==="pointermove"&&e.pointerType!=="mouse"&&!(e.buttons&1)))return;const id=cv.id.slice(0,-2),M=DLM[id];if(!M)return;const D=dlPrep(M.r,M.res);if(!D)return;
  const rc=cv.getBoundingClientRect(),f=Math.max(0,Math.min(1,(e.clientX-rc.left-8)/(rc.width-16))),xs=DL.mode==="t"?D.t:D.x,v=f*(DL.mode==="t"?D.tEnd:402.336);let lo=0,hi=D.n-1;while(hi-lo>1){const m=(lo+hi)>>1;if(xs[m]<v)lo=m;else hi=m;}M.cur=Math.abs(xs[lo]-v)<Math.abs(xs[hi]-v)?lo:hi;dlSched();}
document.addEventListener("pointerdown",e=>{if(e.target.closest&&e.target.closest(".dlcv")){try{e.target.setPointerCapture(e.pointerId);}catch(_){}dlScrub(e);}});document.addEventListener("pointermove",dlScrub);
addEventListener("resize",dlSched);new MutationObserver(dlSched).observe(document.documentElement,{attributes:true,attributeFilter:["class","data-theme"]});
function dlMount(){for(const id in DLM)if(!$(id+"Cv"))delete DLM[id];dlAll();}
/* ---- pull datalog: the same scrub cursor on the pull sheet's chart, plus rpm and EGT ---- */
const PL={rpm:1,egt:1,cur:null};
function pullRedraw(){const l=lastForChart();if(S.env.testType==="pull_sled"&&l&&l.pull)drawPullTrace(l.pull);}
function pullDiag(r){const tr=r.trace||[],sw=r.sweet||[0.15,0.3];if(tr.length<3)return "";let best=null,a=-1,low=0,lowA=-1,lowB=0;
  for(let i=0;i<=tr.length;i++){const on=i<tr.length&&tr[i].slip>sw[1]+0.02;if(on&&a<0)a=i;if(!on&&a>=0){const d=tr[i-1].t-tr[a].t+0.1;if(!best||d>best.d)best={a,e:i-1,d};a=-1;}}
  for(let i=0;i<tr.length;i++)if(tr[i].t>1&&tr[i].throttle>0.8&&tr[i].slip<sw[0]-0.03&&tr[i].v>0.5)low+=0.1;
  const pos=f=>f<0.33?"early":f<0.66?"mid-pull":"late in the pull",ft=i=>Math.round(tr[i].x*3.28084);
  if(best&&best.d>=0.4)return `Wheel speed ran above the sweet spot (over ${Math.round(sw[1]*100)}% slip) for ${best.d.toFixed(1)} s ${pos(tr[best.a].x/SIM.PULL_FULL)}, ${ft(best.a)}–${ft(best.e)} ft — feather earlier.`;
  if(r.stopWhy==="bogged")return `Bogged at ${(r.distFt||0).toFixed(0)} ft with the tyres under the band — a lower gear or more rpm at the hook.`;
  if(low>=1)return `Wheels ran under the sweet spot for ${low.toFixed(1)} s with the throttle open — the truck was lugging; a lower gear or a bit more tyre spin would get more out of the dirt.`;
  return `Wheel speed stayed in the sweet band — ${r.sweetT.toFixed(1)} s where the dirt bites best.`;}
function pullLog(r){PL.cur=null;const tr=r.trace||[];if(!tr.length||tr[0].egt==null)return "";
  return `<div class="dlbox" style="margin-top:10px"><div class="chips dlchips"><button class="chip dlch${PL.rpm?" on":""}" data-plch="rpm"><i style="background:#e8c14a"></i>rpm</button><button class="chip dlch${PL.egt?" on":""}" data-plch="egt"><i style="background:#c58be0"></i>EGT</button></div><div class="dlread" id="plRd"><span class="hint">Touch or hover the chart above to read the pull at that instant.</span></div><div class="dldiag${/above|Bogged|lugging/.test(pullDiag(r))?" bad":""}">${pullDiag(r)}</div></div>`;}
function pullCursor(x,r,tr,X,padT,ch,mx,rm,em,INK){const i=PL.cur,p=tr[i];if(i==null||!p)return;const px=X(p.x);x.strokeStyle=INK;x.lineWidth=1;x.beginPath();x.moveTo(px,padT);x.lineTo(px,padT+ch);x.stroke();
  const dot=(f,c)=>{x.fillStyle=c;x.beginPath();x.arc(px,padT+ch*(1-Math.max(0,Math.min(1,f))),3.2,0,7);x.fill();};dot(p.v*2.23694/mx,"#d97757");dot(p.slip,"rgba(120,169,221,.95)");if(PL.rpm)dot(p.rpm/rm,"#e8c14a");if(PL.egt&&p.egt!=null)dot(p.egt/em,"#c58be0");
  const sw=r.sweet||[0.15,0.3],st=p.slip>sw[1]+0.02?"over the band":p.slip<sw[0]?"under the band":"in the band",W=chart.clientWidth,rt=px<W/2,l1=`${p.t.toFixed(1)} s · ${Math.round(p.x*3.28084)} ft · ${(p.v*2.23694).toFixed(1)} mph`,l2=`slip ${Math.round(p.slip*100)}% ${st} · ${p.rpm.toLocaleString()} rpm${p.egt!=null?" · "+p.egt+"°C":""}`;
  x.font="10px "+getComputedStyle(document.body).fontFamily;x.textAlign=rt?"left":"right";x.fillStyle=INK;x.fillText(l1,px+(rt?6:-6),padT+28);x.fillText(l2,px+(rt?6:-6),padT+40);
  const rd=$("plRd");if(rd){rd.innerHTML=`<b>${p.t.toFixed(1)} s</b><b>${Math.round(p.x*3.28084)} ft</b><span style="color:#d97757">${(p.v*2.23694).toFixed(1)} mph</span><span style="color:rgba(120,169,221,.95)">slip ${Math.round(p.slip*100)}% · ${st}</span><span style="color:#e8c14a">${p.rpm.toLocaleString()} rpm</span>${p.egt!=null?`<span style="color:#c58be0">${p.egt} °C</span>`:""}<span>throttle ${Math.round(p.throttle*100)}%</span>`;}}
function pullScrub(e){if(S.env.testType!=="pull_sled"||testing||(e.type==="pointermove"&&e.pointerType!=="mouse"&&!(e.buttons&1)))return;const l=lastForChart(),r=l&&l.pull,tr=r&&r.trace;if(!tr||!tr.length)return;
  const rc=chart.getBoundingClientRect(),d=Math.max(0,Math.min(1,(e.clientX-rc.left-34)/(rc.width-68)))*SIM.PULL_FULL;let b=0;for(let i=1;i<tr.length;i++)if(Math.abs(tr[i].x-d)<Math.abs(tr[b].x-d))b=i;PL.cur=b;pullRedraw();}
chart.style.touchAction="pan-y";chart.addEventListener("pointerdown",e=>{try{chart.setPointerCapture(e.pointerId);}catch(_){}pullScrub(e);});chart.addEventListener("pointermove",pullScrub);
document.addEventListener("click",e=>{const b=e.target.closest("[data-plch]");if(!b)return;const k=b.dataset.plch;PL[k]=PL[k]?0:1;b.classList.toggle("on",!!PL[k]);pullRedraw();});

function showResult(res,env){
  {const h=cfgHash(S.cfg);S.ranH=(S.ranH||[]).filter(x=>x!==h).concat(h).slice(-30);}   // this build has been run: its card may now say BREAKS
  const b=S.base&&S.base.res;
  const life=res.lifeHours>=5000?"5,000+":res.lifeHours.toLocaleString();
  $("peaks").innerHTML=`<div class="peak"><b>${Math.round(res.peakHp)}<i>hp</i></b>${delta(res.peakHp,b&&b.peakHp)}<span>@ ${res.peakHpRpm.toLocaleString()} rpm · SAE ${Math.round(res.correctedHp)}</span></div><div class="peak"><b>${Math.round(res.peakTq)}<i>Nm</i></b>${delta(res.peakTq,b&&b.peakTq)}<span>@ ${res.peakTqRpm.toLocaleString()} rpm</span></div><div class="peak"><b>${res.rel}<i>rel</i></b>${delta(res.rel,b&&b.rel)}<span>${env.testType==="endurance"?(res.endurance&&res.endurance.failedAtHour!=null?`failed at ${res.endurance.failedAtHour} h`:`survived ${env.hours} h`):`life ≈ ${life} h`}</span></div>`;
  const over=career()&&(res.peakHp>dynoCap().hp||S.cfg.redline>dynoCap().rpm);
  let v;
  if(env.testType==="race24"&&res.e24)v=e24Verdict(res);
  else if(env.testType==="road"&&res.road)v=roadVerdict(res);
  else if(env.testType==="hill"&&res.hill)v=hillVerdict(res);
  else if(env.testType==="oval"&&res.oval)v=ovalVerdict(res);
  else if(env.testType==="pull_sled"&&res.pull)v=pullVerdict(res);
  else if(env.testType==="salt"&&res.salt)v=saltVerdict(res);
  else if(env.testType==="bog"&&res.bog)v=bogVerdict(res);
  else if(env.testType==="boat"&&res.boat)v=boatVerdict(res);
  else if(S.bay&&env.testType==="pull"&&!over&&!res.fails.length)v=ddVerdict(res);
  else if(over)v=`<div class="verdict fail"><div><div class="big">DYNO OVERLOADED</div><p>${dynoCap().n} can't hold ${Math.round(res.peakHp)} hp / ${S.cfg.redline} rpm. It cannot be certified here — ${has("dyno5")?"no cell reads higher; pull some power out.":"upgrade the dyno in the Shop."}</p></div></div>`;
  else if(res.fails.length)v=`<div class="verdict fail"><div><div class="big">FAILED</div><p>${res.fails.length===1?"One subsystem":res.fails.length+" subsystems"} went past its limit.</p>${res.fails.map(n=>{const t=res.tests.find(x=>x.name===n)||{};return `<div class="failnote"><b>${n}</b>${t.sub?` <small>${t.sub}</small>`:""} — ${t.physics||""} <i>${t.fix||""}</i></div>`;}).join("")}</div></div>`;
  else if(env.testType==="endurance"&&res.endurance&&res.endurance.failedAtHour!=null)v=`<div class="verdict fail"><div><div class="big">FAILED AT ${res.endurance.failedAtHour} H</div><p>First to go: ${(res.tests.find(t=>t.id===res.firstToFail)||{}).name||res.firstToFail}. It passed the pull but not the hours.</p></div></div>`;
  else if(env.testType==="overrev"&&res.overrev&&!res.overrev.survived)v=`<div class="verdict fail"><div><div class="big">DID NOT SURVIVE</div><p>The missed shift found the weak link.</p></div></div>`;
  else if(env.testType==="drag"&&res.dragFailed)v=`<div class="verdict fail"><div><div class="big">${res.dragFailKind==="turbo"?"COOKED THE TURBO":res.dragFailKind==="manifold"?"CRACKED THE MANIFOLD":"BROKE ON THE PASS"}</div><p>${res.dragFailKind==="turbo"||res.dragFailKind==="manifold"?"Too long on the two-step — the heat that built the boost found the weakest part of the hot side":"The engine let go on the strip"}${career()?" — certification is void and reputation took a hit":""}.</p></div></div>`;
  else if(env.testType==="drag"&&res.drag&&res.drag.night)v=rnVerdict(res.drag);
  else if(env.testType==="drag"&&res.drag){const r=res.drag,R=r.race;v=`<div class="verdict ${R?(R.won?"pass":"fail"):r.et==null?"fail":r.et<10?"pass":"marg"}"><div style="flex:1"><div class="big">${R?(R.foul?"RED LIGHT":R.won?"WON by "+Math.abs(R.margin||0).toFixed(3)+" s":"LOST by "+Math.abs(R.margin||0).toFixed(3)+" s"):""}${R?"<br><span style=\"font-size:.7em;opacity:.85\">":""}${r.et!=null?r.et.toFixed(2)+" s @ "+Math.round(r.mph)+" mph":"DID NOT FINISH"}${R?"</span>":""}</div>
    ${R?`<p>RT ${R.rt!=null?R.rt.toFixed(3):"—"} vs ${R.name} ${R.oppRt.toFixed(3)} · they ran ${R.oppEt!=null?R.oppEt.toFixed(2)+" @ "+Math.round(R.oppMph):"DNF"}${R.foul?(r.auto&&r.auto.took==null?" · the auto driver left before the green":" · you left before the green"):""}</p>`:""}${r.auto?`<p>${dragAutoWord(r.auto)}</p>`:""}
    <div class="vstats">${r.marks.map(m=>`<div><b>${m.t.toFixed(2)}</b><span>${m.n}${m.n==="1/8 mi"||m.n==="1/4 mi"?" · "+Math.round(m.mph)+" mph":""}</span></div>`).join("")}</div></div></div>`;}
  else if(career()&&env.testOnly)v=`<div class="verdict marg"><div style="flex:1"><div class="big">${env.testType==="endurance"?"SURVIVED":"PASSED"} · TEST ONLY</div><p>Run at ${env.ambientC} °C · ${env.altitudeM} m · coolant ${env.coolantC} °C · oil ${env.oilC} °C. ${env.testType==="endurance"?"Off-standard hours don't count toward the 100 h goal":"Contracts certify in the standard cell"} — 20 °C · 500 m · coolant 90 °C · oil 100 °C. Reset the cell and run it again${env.testType==="endurance"?"":" to certify"}.</p></div></div>`;
  else v=`<div class="verdict ${res.rel>=85?"pass":"marg"}"><div style="flex:1"><div class="big">${res.rel>=85?"CERTIFIED":"CERTIFIED · MARGINAL"}</div>
    <div class="vstats"><div><b>${res.rel}</b><span>Reliability</span></div><div><b>${res.raceSpec?res.racePasses:res.econ.toFixed(1)}</b><span>${res.raceSpec?"Passes to freshen":"L/100 km"}</span></div><div><b>${Math.round(res.smooth)}</b><span>Smoothness</span></div><div><b>${Math.round(res.kg)}</b><span>kg</span></div><div><b>${fmt$(res.cost)}</b><span>Unit cost</span></div>${res.diesel?`<div><b>${Math.round(res.smoke||0)}%</b><span>Smoke · ${smokeWord(res,1)}</span></div>`:`<div><b>${res.knock.margin>=0?"+":""}${res.knock.margin.toFixed(1)}</b><span>Knock margin</span></div>`}</div></div></div>`;
  $("verdict").innerHTML=v+swapVerdict(res);tdVerdict(res,env);
  let extra="";
  if(env.testType==="endurance"&&res.endurance){const d=res.endurance.damage||{};const top=Object.entries(d).sort((a,b)=>b[1]-a[1]).slice(0,5);
    extra+=`<div class="sec"><h2>Fatigue damage after ${res.endurance.failedAtHour!=null?res.endurance.failedAtHour:env.hours} h</h2><div class="stress">${top.map(([id,f])=>{const t=res.tests.find(x=>x.id===id)||{name:id};const p=Math.min(1,f);return `<div class="st ${p>=1?"crit":p>.6?"warn":"good"}"><div class="n">${t.name}</div><div class="bar"><i style="width:${Math.min(100,p*80)}%"></i></div><div class="p">${Math.round(p*100)}%</div></div>`;}).join("")}</div>`;
    if(res.endurance.log&&res.endurance.log.length)extra+=`<div class="log" style="margin-top:8px">${res.endurance.log.map(l=>`<div><b>${l.hour} h</b>${l.event}</div>`).join("")}</div>`;extra+=`</div>`;}
  const slipN=env.testType==="drag"&&res.drag&&res.drag.night?rnSlipHtml(res.drag):"";
  if(env.testType==="drag"&&res.drag){const r=res.drag;extra+=`<div class="sec"><h2>Timing slip</h2><div class="tslipw">${dragSlipCard(r,res)}<details class="tsn"${SLIPN?" open":""}><summary>Notes</summary>${slipN}<div class="log">${r.auto?`<div><b>Driver</b>${dragAutoWord(r.auto)}</div>`:""}${slipLine(r)?`<div><b>Slip</b>${slipLine(r)}</div>`:""}${launchSlip(r)?`<div><b>Launch</b>${launchSlip(r)}</div>`:""}${r.race&&r.race.rt!=null&&!r.race.foul&&r.race.rt>0.25?`<div>Reaction time ${r.race.rt.toFixed(3)} — a good light is under 0.100. That is ${(r.race.rt-0.1).toFixed(2)} s given away before the car moved.</div>`:""}${r.reasons.length?r.reasons.map(x=>`<div>${x}</div>`).join(""):"<div>Clean pass. Nothing left on the table that the driveline can fix — the rest is horsepower.</div>"}${r.shifts.length?`<div><b>Shifts</b>${r.shifts.map(x=>x.gear+"→"+(x.gear+1)+" at "+x.rpm.toLocaleString()).join(", ")}</div>`:""}<div><b>Ratios</b>${r.ratios.join(" · ")} × ${r.veh.final} final · ${r.veh.tyreDia}" ${SIM.TYRES[r.veh.tyre].n.toLowerCase()}</div><div><b>Shutdown</b>${(SIM.AERO[r.body]||SIM.AERO.street).n} · ${r.chute?"chute out":"brakes only"} · pulled up in ${r.shutFt.toLocaleString()} ft</div></div></details><div class="tsact"><button class="btn sm info" id="shareSlip">Share timing slip</button></div>${(()=>{const wi=wearInfo(res);if(!wi)return"";const pct=Math.round(wi.w*100);return `<div class="tswear"><b>Wear</b> ${wi.passes} of ${wi.budget} pass${wi.budget===1?"":"es"} · <span style="color:${wi.w>=1?"var(--crit)":wi.w>0.6?"var(--warn)":"var(--good)"}">${pct}%</span>${res.wornBy?" · down "+res.wornBy+"% on power":""}${wi.w>0.3?" · listen for the slap at idle":""}${wi.w>0?` <button class="btn sm" id="freshen">Freshen · ${fmt$(freshenCost(res))}</button>`:""}</div>`;})()}</div></div>`;}
  if(env.testType==="drag"&&res.drag&&res.drag.n2o)extra=extra.replace("<div><b>Ratios</b>",`<div><b>Nitrous</b>${n2oSlip(res.drag.n2o)}</div><div><b>Ratios</b>`);
  if(env.testType==="pull_sled"&&res.pull)extra+=pullSheet(res);
  if(env.testType==="road"&&res.road)extra+=roadSheet(res);
  if(env.testType==="race24"&&res.e24)extra+=e24Sheet(res);
  if(env.testType==="salt"&&res.salt)extra+=saltSheet(res);
  if(env.testType==="bog"&&res.bog)extra+=bogSheet(res);
  if(env.testType==="boat"&&res.boat)extra+=boatSheet(res);
  if(env.testType==="hill"&&res.hill)extra+=hillSheet(res);
  if(env.testType==="oval"&&res.oval)extra+=ovalSheet(res);
  if(env.testType==="drag"&&res.drag)extra+=dlCard("dlR",res);   /* datalog: its own block after the timing slip */
  if(env.testType==="overrev"&&res.overrev)extra+=`<div class="sec"><h2>What the missed shift did</h2><div class="log">${res.overrev.events.map(e=>`<div>${e}</div>`).join("")||"<div>Nothing. It shrugged it off.</div>"}</div></div>`;
  if((env.testType==="drag"&&res.drag)||(env.testType==="pull_sled"&&res.pull)||(env.testType==="salt"&&res.salt)||(env.testType==="bog"&&res.bog)||(env.testType==="boat"&&res.boat)||(env.testType==="road"&&res.road)||(env.testType==="race24"&&res.e24)||(env.testType==="hill"&&res.hill)||(env.testType==="oval"&&res.oval))extra=spSlipHtml()+extra;
  $("testExtra").innerHTML=extra;if(env.testType==="drag"&&res.drag)dlMount();if(env.testType==="pull_sled"&&res.pull)pullRedraw();if(env.testType==="salt"&&res.salt)saltRedraw();if(env.testType==="bog"&&res.bog)bogRedraw();if(env.testType==="boat"&&res.boat)boatRedraw();if(env.testType==="road"&&res.road)roadRedraw();if(env.testType==="hill"&&res.hill)hillRedraw();if(env.testType==="oval"&&res.oval)ovalRedraw();if(env.testType==="race24"&&res.e24)drawE24Trace(res.e24);
  $("stressSec").style.display="";$("stressCnt").textContent=`${res.tests.filter(t=>t.status==="good").length}/${res.tests.length} clear`;
  const order={crit:0,warn:1,good:2};const tests=res.tests.slice().sort((a,b)=>order[a.status]-order[b.status]||b.util-a.util);
  const stRow=t=>`<button class="st ${t.status}" data-st="${t.id}"><div class="n">${t.name}<small>${t.sub}</small></div><div class="bar"><i style="width:${Math.min(100,t.util/1.25*100)}%"></i></div><div class="p">${Math.round(t.util*100)}%</div><div class="stx" hidden><b>Measured:</b> ${t.physics}<br><b>Fix:</b> ${t.fix}</div></button>`;
  /* the three worst lines are the report; the rest fold away behind "Show all" (the choice sticks while you re-run) */
  const STN=3;$("stressList").innerHTML=tests.slice(0,STN).map(stRow).join("")+(tests.length>STN?`<div id="stressRest"${stressAll?"":" hidden"}>${tests.slice(STN).map(stRow).join("")}</div><button class="btn sm ghost" id="stressMore" aria-expanded="${stressAll}">${stressAll?"Show the worst "+STN+" only":"Show all "+tests.length}</button>`:"");
}
let stressAll=false;
function smokeWord(r,short){const s=r.smoke||0,lm=r.fuel&&r.fuel.lamMin,lam=S.cfg.lambda;if(short)return s<8?"clean":s<35?"haze":"black";return s<8?"clean stack":s<35?"light haze":(lm&&lm<lam-0.05?"black under spool":"black at full load");}
$("stressList").addEventListener("click",e=>{const m=e.target.closest("#stressMore");if(m){stressAll=!stressAll;const r=$("stressRest");r.hidden=!stressAll;m.setAttribute("aria-expanded",stressAll);m.textContent=stressAll?"Show the worst 3 only":"Show all "+(r.children.length+3);return;}const b=e.target.closest("[data-st]");if(!b)return;const x=b.querySelector(".stx");x.hidden=!x.hidden;});
$("pinBase").addEventListener("click",()=>{const last=S.last;if(!last)return;S.base={cfg:last.cfg,env:last.env,label:`${cfgLbl(last.cfg).split(" · ").slice(0,2).join(" ")} ${Math.round(last.res.peakHp)} hp`,res:last.res};curves.base=true;$("baseChip").classList.add("on");save();renderTest();toast("Baseline pinned — new runs overlay it");});

function slipLine(r){return [r.race&&r.race.rt!=null?`RT ${r.race.foul?"red":r.race.rt.toFixed(3)}`:null,r.sixty?`60 ft ${r.sixty.t.toFixed(3)}`:null,r.ft330?`330 ${r.ft330.t.toFixed(3)}`:null,r.eighth?`1/8 ${r.eighth.t.toFixed(3)} @ ${Math.round(r.eighth.mph)}`:null,r.ft1000?`1000 ${r.ft1000.t.toFixed(3)}`:null,r.et!=null?`1/4 ${r.et.toFixed(3)} @ ${Math.round(r.mph)}`:null].filter(Boolean).join(" · ");}
function launchSlip(r){const L=r.launch;if(!L)return"";const b=[];
  if(L.boostTarget>0)b.push(`boost ${L.boost.toFixed(1)} of ${L.boostTarget.toFixed(1)} bar${L.boostT!=null&&L.boostT>0.05?` (full at ${L.boostT.toFixed(1)} s)`:""}`);
  b.push(`tyres ${Math.round(L.tyreTemp*100)}%${L.burnT>0?` after ${L.burnT.toFixed(1)} s burnout`:" (no burnout)"}`);
  if(L.ctl!=="none")b.push(`two-step ${L.held.toFixed(1)} s @ ${L.holdRpm.toLocaleString()}${L.retard?` · ${Math.round(L.retard)}° retard`:""}`);else if(L.brake==="trans_brake")b.push(`trans-brake ${L.held.toFixed(1)} s`);
  if(L.brake==="trans_brake")b.push("off the trans-brake");else if(L.brake==="line_lock")b.push("line lock");
  if(r.heat&&r.heat.egtLine>=850)b.push(`${r.heat.egtLine.toLocaleString()} °C on the line`);
  if(r.broke)b.push(`<span style="color:var(--crit)">${r.broke==="turbo"?"turbo cooked":r.broke==="lean"?"lean on the bottle — melted a piston":r.broke==="backfire"?"intake backfire":"manifold cracked"}</span>`);
  else if(r.heat&&r.heat.abuse>=0.05)b.push(`+${r.heat.abuse.toFixed(1)} pass of wear from the heat`);
  if(r.als)b.push(`ALS ${r.als.type==="air"?"(secondary air)":"(ignition)"} ${r.als.fired.toFixed(1)} s${r.als.shiftMin!=null?` · held ${r.als.shiftMin.toFixed(1)} bar through the shifts`:""}`);
  return b.join(" · ");}
/* run animation */
const run={on:false,rpm:0,load:0,fail:false,failKind:null,idle:false};
const FAIL_VISUAL={rod_tension:"rod",rod_buckling:"rod",rod_bolts:"rod",bearing_load:"rod",oil_film:"rod",piston_speed:"rod",crown_pressure:"rod",
  crank_fatigue:"crank",torsional:"crank",
  detonation:"knock",preignition_egt:"knock",crown_temp:"knock",hot_clearance:"knock",ring_gap:"knock",slap_blowby:"knock",bore_distortion:"knock",wall_thickness:"knock",
  head_lift:"steam",gasket_shear:"steam",cooling:"steam",
  valve_float:"valve",valve_piston:"valve",valve_temp:"valve",
  oil_starvation:"seize",compressor_map:"turbo",turbine_temp:"turbo"};
FAIL_VISUAL.vgt_vanes="turbo";FAIL_VISUAL.als_heat="turbo";
FAIL_VISUAL.fuel_delivery="knock";   // a lean cylinder rattles, then the crown lets go and it smokes
FAIL_VISUAL.cold_start="seize";      // a diesel that won't light just winds down on the starter
Object.assign(FAIL_VISUAL,{ts_seize:"seize",port_wear:"knock",crank_seals:"seize",pipe_crack:"steam",plug_foul:"seize",scav_air:"seize"});   // two-stroke: a seizure locks it, a cracked pipe hisses
Object.assign(FAIL_VISUAL,{apex_seal:"knock",housing_chatter:"knock",carbon_seals:"knock",oil_metering:"seize",coolant_seal:"steam",eshaft:"crank"});   // rotary: a broken seal rattles and smokes, a blown O-ring steams
function failKindOf(res,env){
  let id=null;
  if(env.testType==="overrev"&&res.overrev&&!res.overrev.survived){const e=(res.overrev.events||[]).join(" ");id=/Valve float/.test(e)?"valve_piston":/Rod beam/.test(e)?"rod_tension":/Rod bolts/.test(e)?"rod_bolts":/oil pressure/.test(e)?"bearing_load":/Apex seals/.test(e)?"apex_seal":/eccentric shaft/.test(e)?"eshaft":/Rotor bearings/.test(e)?"bearing_load":null;}
  else if(env.testType==="endurance"&&res.endurance&&res.endurance.failedAtHour!=null){const dm=res.endurance.damage||{};for(const t of res.tests){if(dm[t.id]>=1){id=t.id;break;}}}
  if(!id&&res.fails.length){const t=res.tests.find(x=>x.name===res.fails[0]);id=t?t.id:null;}
  return FAIL_VISUAL[id]||"rod";
}
$("runTest").addEventListener("click",()=>{
  if(!testing&&S.env.testType==="drag"&&rnGate())return;   // race night: enter, close, or the wrong engine
  if(S.env.testType==="race24"){if(!testing)e24Click();return;}   // the 24 Hours: its own gate, entry and fuel bill
  if(testing)return;const cost=testCost();if(career()&&C().cash<cost){toast("Not enough cash for dyno time");return;}
  if(S.env.testType==="drag"){if(career()&&!(C().cert&&C().cert.ok&&C().cert.hash===cfgHash(S.cfg))){toast("Certify this engine on the dyno first");return;}if(career()&&!has("race")){toast(`Needs the ${(UPGRADES.find(u=>u.id==="race")||{}).name} upgrade`);return;}}
  if(S.env.testType==="road"&&career()&&!(C().cert&&C().cert.ok&&C().cert.hash===cfgHash(S.cfg))){toast("Certify this engine on the dyno first");return;}
  if(S.env.testType==="pull_sled"){const k=pullEnvFix(),lg=pullLegal(k),l=pullClsLocked(k);if(l){toast(`${SIM.PULL_CLASSES[k].n} needs the ${pullLockTxt(k)}`);return;}if(!lg.ok){toast(`Not legal for ${SIM.PULL_CLASSES[k].n} — ${lg.why}`);return;}if(career()&&!(C().cert&&C().cert.ok&&C().cert.hash===cfgHash(S.cfg))){toast("Certify this engine on the dyno first");return;}if(pullHookedWk(k)){toast(`Already hooked in ${SIM.PULL_CLASSES[k].n} this week — next pull night is week ${C().week+1}`);return;}}
  if(pullGate())return;
  if(S.env.testType==="bog"&&S.bay){toast(`${S.bay.practice?"Practice":"Customer"} engine on the dyno — hand it back or walk away first`);return;}   // dyno day: no mud bog with a customer's engine
  if(S.env.testType==="bog"){const k=bogEnvFix(),l=bogClsLocked(k);if(l){toast(`${SIM.BOG_CLASSES[k].n} opens at ${l} rep`);return;}if(career()&&!(C().cert&&C().cert.ok&&C().cert.hash===cfgHash(S.cfg))){toast("Certify this engine on the dyno first");return;}if(bogHookedWk(k)){toast(`Already ran ${SIM.BOG_CLASSES[k].n} this week — the next mud bog is week ${C().week+1}`);return;}}
  if(S.env.testType==="hill"&&S.bay){toast(`${S.bay.practice?"Practice":"Customer"} engine on the dyno — hand it back or walk away first`);return;}
  if(S.env.testType==="hill"){const k=hillEnvFix(),l=hillClsLocked(k);if(l){toast(`${SIM.HILL_CLASSES[k].n} opens at ${l} rep`);return;}if(career()&&!(C().cert&&C().cert.ok&&C().cert.hash===cfgHash(S.cfg))){toast("Certify this engine on the dyno first");return;}if(hillRanWk(k)){toast(`Already ran ${SIM.HILL_CLASSES[k].n} this week — the next running is week ${C().week+1}`);return;}}
  if(S.env.testType==="oval"&&ovalGate())return;
  if(S.env.testType==="boat"&&S.bay){toast(`${S.bay.practice?"Practice":"Customer"} engine on the dyno — hand it back or walk away first`);return;}
  if(S.env.testType==="boat"){const k=boatEnvFix(),l=boatClsLocked(k),lg=boatLegal(k);if(l){toast(`${SIM.BOAT_CLASSES[k].n} opens at ${l} rep`);return;}if(!lg.ok){toast(`Not legal for ${SIM.BOAT_CLASSES[k].n} — ${lg.why}`);return;}if(career()&&!(C().cert&&C().cert.ok&&C().cert.hash===cfgHash(S.cfg))){toast("Certify this engine on the dyno first");return;}if(!boatLive()&&boatRanWk(k)){toast(`Already ran ${SIM.BOAT_CLASSES[k].n} this week — the next night is week ${C().week+1}`);return;}}
  if(S.env.testType==="salt"){const k=saltEnvFix(),l=saltBodyLocked(k);if(l){toast(`${SIM.LSR_BODIES[k].n} opens at ${l} rep`);return;}if(career()&&!(C().cert&&C().cert.ok&&C().cert.hash===cfgHash(S.cfg))){toast("Certify this engine on the dyno first");return;}}
  if(career()){C().cash-=cost;hud();}
  testing=true;abStop();renderTest();ensureSound();
  if(S.env.testType!=="drag"){ENGINE_VIS.setStrip({on:false});ENGINE_VIS.stripRace&&ENGINE_VIS.stripRace(null);}
  if(S.env.testType!=="pull_sled"&&ENGINE_VIS.setPull)ENGINE_VIS.setPull({on:false});
  if(S.env.testType!=="salt"&&ENGINE_VIS.setSalt)ENGINE_VIS.setSalt({on:false});
  if(S.env.testType!=="bog"&&ENGINE_VIS.setBog)ENGINE_VIS.setBog({on:false});
  if(S.env.testType!=="boat"&&ENGINE_VIS.setBoat)ENGINE_VIS.setBoat({on:false});
  if(S.env.testType!=="hill"&&ENGINE_VIS.setHill)ENGINE_VIS.setHill({on:false});
  if(S.env.testType!=="oval"&&ENGINE_VIS.setOval)ENGINE_VIS.setOval({on:false});
  if(S.env.testType!=="road"&&S.env.testType!=="race24"&&ENGINE_VIS.setRoad)ENGINE_VIS.setRoad({on:false});
  if(S.env.testType!=="drag"&&S.env.testType!=="pull_sled"&&S.env.testType!=="salt"&&S.env.testType!=="road"&&S.env.testType!=="race24"&&S.env.testType!=="bog"&&S.env.testType!=="boat"&&S.env.testType!=="hill")$("app").classList.remove("onstrip");
  if(S.env.testType==="drag"){dragStart();return;}
  if(S.env.testType==="pull_sled"){pullStart();return;}
  if(S.env.testType==="road"){roadStart();return;}
  if(S.env.testType==="salt"){saltStart();return;}
  if(S.env.testType==="bog"){bogStart();return;}
  if(S.env.testType==="hill"){hillStart();return;}
  if(S.env.testType==="oval"){ovalStart();return;}
  if(S.env.testType==="boat"){boatStart();return;}
  const snap=testSnap(),cfg0=snap.cfg;
  const env=simEnv(ddEnvX());const res=SIM.simulate(cfg0,env);const N=res.rpms.length;const t0=performance.now();
  ENGINE_VIS.setAutoRotate(false);$("rpmbox").style.display="block";
  let failed=false,failAt=Infinity,dur,hold,label="";
  const failKind=failKindOf(res,env);const rpmDecay={rod:420,crank:520,valve:360,seize:80,knock:45,steam:30,turbo:70}[failKind]||160;
  const failing=res.fails.length>0||(env.testType==="endurance"&&res.endurance&&res.endurance.failedAtHour!=null)||(env.testType==="overrev"&&res.overrev&&!res.overrev.survived);
  if(env.testType==="pull"){dur=2800;hold=1400;if(res.fails.length)failAt=dur+hold*0.5;}
  else if(env.testType==="endurance"){dur=4200;hold=600;if(failing)failAt=dur*Math.max(0.15,Math.min(0.95,(res.endurance.failedAtHour||env.hours)/env.hours));}
  else{dur=1800;hold=1200;if(failing)failAt=dur+hold*0.45;}
  sfx("start");
  $("testProg").classList.remove("done");
  const step=()=>{const t=performance.now()-t0;let i=N;$("testProg").style.width=Math.min(100,100*t/(dur+hold))+"%";
    if(env.testType==="pull"){if(t<dur){i=Math.floor(N*(t/dur));run.rpm=res.rpms[Math.min(N-1,i)];}else run.rpm=cfg0.redline+Math.sin(t/40)*40;run.load=1;}
    else if(env.testType==="endurance"){const ph=t/dur;const prof={highway:.35,mixed:.6,track:.95}[env.loadProfile];run.rpm=1500+(cfg0.redline-1500)*prof*(0.55+0.45*Math.abs(Math.sin(t/230)));run.load=prof*(0.6+0.4*Math.abs(Math.sin(t/230+1)));i=N;label=`${Math.min(env.hours,Math.round(env.hours*Math.min(1,ph)))} h`;}
    else{if(t<dur*0.5)run.rpm=1000+(cfg0.redline-1000)*(t/(dur*0.5));else if(t<dur)run.rpm=cfg0.redline*(1+0.15*Math.min(1,(t-dur*0.5)/120));else run.rpm=Math.max(1000,cfg0.redline*1.15-(t-dur)*4);run.load=t<dur*0.5?1:0.2;}
    if(t>failAt&&!failed){failed=true;run.fail=true;run.failKind=failKind;$("flash").style.background="rgba(238,90,94,.45)";setTimeout(()=>$("flash").style.background="rgba(238,90,94,0)",250);sfx("fail");buzz([80,40,120]);}
    if(failed){const since=t-failAt;const d=failKind==="seize"?(since>1600?900:rpmDecay):failKind==="knock"?(since>1200?140:rpmDecay):rpmDecay;run.rpm=Math.max(0,run.rpm-d);if(failKind==="knock"||failKind==="steam")run.rpm+=(Math.random()-0.5)*120;}
    run.on=true;$("rpmLbl").textContent=label||Math.round(run.rpm/10)*10;
    if(env.testType==="pull")drawChart(res,Math.min(N,i+1));
    if(t<dur+hold)requestAnimationFrame(step);
    else{testing=false;run.on=false;run.fail=false;run.rpm=0;$("rpmbox").style.display="none";$("testProg").classList.add("done");setTimeout(()=>{$("testProg").style.width="0";},700);ENGINE_VIS.setAutoRotate(null);if(env.testType==="pull")sfx("bov");
      S.last={hash:snap.h,cfg:cfg0,env,res};const same=testSame(snap);
      const offStd=career()&&(!same||!isStdCell(env));if(offStd&&(env.testType==="pull"||env.testType==="endurance"))env.testOnly=true;
      if(same&&!ff&&!career()&&env.testType==="pull"&&!failing&&!S.bay)pbPull(res);
      if(career()&&env.testType==="pull"&&!offStd&&!S.bay){const cap=dynoCap(),lk=presetLocked(cfg0);const overCap=res.peakHp>cap.hp||cfg0.redline>cap.rpm;const bad=!res.fails.length&&!overCap&&!lk&&crewBadRead(),ok=!res.fails.length&&!overCap&&!lk&&!bad;C().cert={hash:snap.h,cfg:cfg0,ok,res,why:bad?"a sensor read wrong (clumsy with sensors) — pull it again":lk?`needs the ${lk} upgrade`:overCap?`${cap.n} only reads to ${cap.hp.toLocaleString()} hp / ${cap.rpm.toLocaleString()} rpm`:res.fails.length?"it broke":""};
        if(ok)tourAdvance(1);
        if(ok)pbPull(res);
        if(ok){C().bestHp=Math.max(C().bestHp||0,res.peakHp);C().bestRel=Math.max(C().bestRel||0,res.rel);if(cfg0.asp!=="na")C().boostedCert=true;}
        else if(bad){logEvent(`Bad reading on the dyno — a sensor knocked loose; pull it again`,"bad");setTimeout(()=>toast("BAD READING · a sensor knocked loose — pull it again"),2700);}
        else if(lk)setTimeout(()=>toast(`NO CERT — needs ${lk}`),2700);else if(overCap)setTimeout(()=>toast(`NO CERT — ${cap.n} caps at ${cap.hp.toLocaleString()} hp / ${cap.rpm.toLocaleString()} rpm`),2700);}
      if(career())crewWork("dyno",{tt:env.testType});
      if(career()&&same&&!S.bay)addWear(env.testType==="pull"?0.15:env.testType==="overrev"?1:env.hours/40,hKey(snap.h));
      if(career()&&env.testType==="endurance"&&env.hours>=100&&!res.fails.length&&!failing&&!offStd)C().enduranceOk=true;
      if(career()&&same)checkGoals();
      if(!S.bay)achCheck({type:"dyno",res,env,failing,offStd});   // a customer's engine earns the shop nothing on the dyno
      save();recompute();renderTest();
      revealVerdict();
      if(ff&&ff.ending);else if(res.fails.length)toast(`FAIL · ${String(res.fails[0]).toUpperCase()}`);else if(failing)toast("FAIL · BROKE BEFORE THE END");else toast(`${Math.round(res.peakHp)} HP · ${env.testOnly?(env.testType==="pull"?"TEST ONLY — NOT CERTIFIED":"TEST ONLY"):"REL "+res.rel}`);}
  };
  requestAnimationFrame(step);
});

/* ===================== ACHIEVEMENTS =====================
   One table, one checker. Every hook is a single achCheck({type,...}) call at the end of an event; the checker turns the event
   into flat facts (hp, et, rt ...), runs every locked badge's check(f) and unlocks the ones that pass. Unlocks live in S.ach
   ({id:{d:ms,w:week|null}}) - shared by sandbox and career. Shop badges read the career state directly. */
const ACH_ICONS={flame:"M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z",bolt:"M13 2 5 14h6l-1 8 8-12h-6z",gauge:"M4 17a8 8 0 1 1 16 0M12 17l4-6",clock:"M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",flag:"M5 21V4M5 4h11l-2 4 2 4H5",shield:"M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z",coin:"M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v10M9 10c0-2 6-2 6 0s-6 2-6 4 6 2 6 0",star:"M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",cloud:"M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.5-1A4.5 4.5 0 0 1 17 18z",snow:"M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7",drop:"M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z",hook:"M12 3v11a3.5 3.5 0 1 1-3.5-3.5",trophy:"M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8",chev:"M6 7l6 5-6 5M12 7l6 5-6 5",wheel:"M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM12 3v6.5M12 14.5V21M3.5 8l6.5 4M14 12l6.5 4",tree:"M12 3.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 16.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",cal:"M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",tick:"M5 12l5 5 9-10",engine:"M4 9h14l2 3v5H4zM8 9V6h6v3",target:"M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",people:"M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3 3-5 6-5s6 2 6 5M17 10a2.5 2.5 0 1 0 0-5M18 15c2 .5 3 2.5 3 5"};
const ACH_TIER={bronze:"Bronze",silver:"Silver",gold:"Gold"};
const ACH_GROUPS=[["dyno","Dyno"],["diesel","Diesel"],["strip","Strip"],["n2o","Nitrous"],["pull","Pulling"],["bog","Mud bog"],["boat","Boat drags"],["hill","Pikes Peak"],["endure","Endurance"],["shop","Shop & career"]];
const ACH=[
  {g:"dyno",id:"firstfire",name:"First fire",desc:"Light an engine for the first time.",ic:"flame",tier:"bronze",check:x=>!!x.firstfire},
  {g:"dyno",id:"certified",name:"Certified",desc:"Pull a clean engine (career: certify one).",ic:"tick",tier:"bronze",check:x=>!!x.ok},
  {g:"dyno",id:"hp100",name:"Triple digits",desc:"A clean 100 hp pull.",ic:"gauge",tier:"bronze",check:x=>x.hp>=100},
  {g:"dyno",id:"hp200",name:"Two hundred",desc:"A clean 200 hp pull.",ic:"gauge",tier:"bronze",check:x=>x.hp>=200},
  {g:"dyno",id:"hp500",name:"Five hundred",desc:"A clean 500 hp pull.",ic:"gauge",tier:"silver",check:x=>x.hp>=500},
  {g:"dyno",id:"hp750",name:"Three-quarter grand",desc:"A clean 750 hp pull.",ic:"gauge",tier:"silver",check:x=>x.hp>=750},
  {g:"dyno",id:"hp1000",name:"Four figures",desc:"A clean 1,000 hp pull.",ic:"gauge",tier:"gold",check:x=>x.hp>=1000},
  {g:"dyno",id:"hp1500",name:"Fifteen hundred",desc:"A clean 1,500 hp pull.",ic:"gauge",tier:"gold",check:x=>x.hp>=1500},
  {g:"dyno",id:"rel90",name:"Dependable",desc:"Reliability 90 or better on a clean pull.",ic:"shield",tier:"bronze",check:x=>x.rel>=90},
  {g:"dyno",id:"rel98",name:"Bulletproof",desc:"Reliability 98 or better on a clean pull.",ic:"shield",tier:"silver",check:x=>x.rel>=98},
  {g:"dyno",id:"endur100",name:"Hundred-hour man",desc:"Finish a 100 h endurance run with nothing broken.",ic:"clock",tier:"silver",check:x=>x.hours>=100},
  {g:"dyno",id:"endur500",name:"Half a thousand",desc:"Finish a 500 h endurance run with nothing broken.",ic:"clock",tier:"gold",check:x=>x.hours>=500},
  {g:"dyno",id:"boost",name:"Under pressure",desc:"A clean pull with forced induction.",ic:"cloud",tier:"bronze",check:x=>!!x.boosted},
  {g:"dyno",id:"screamer",name:"Screamer",desc:"A clean pull with a 9,000 rpm redline or higher.",ic:"gauge",tier:"silver",check:x=>x.redline>=9000},
  {g:"dyno",id:"overrev",name:"Missed shift",desc:"Survive the over-rev test.",ic:"bolt",tier:"silver",check:x=>!!x.overrevOk},
  {g:"diesel",id:"dsl",name:"Compression ignition",desc:"A clean pull on a diesel.",ic:"drop",tier:"bronze",check:x=>!!x.dsl},
  {g:"diesel",id:"coal",name:"Rolling coal",desc:"Hit 100% smoke on a diesel pull.",ic:"cloud",tier:"bronze",check:x=>x.smoke>=99.5},
  {g:"diesel",id:"cleandsl",name:"Clean diesel",desc:"400 hp or more from a diesel with smoke at 5% or less.",ic:"drop",tier:"silver",check:x=>!!x.dsl&&x.hp>=400&&x.smoke<=5},
  {g:"diesel",id:"dsl1000",name:"Thousand-horse diesel",desc:"A clean 1,000 hp diesel pull.",ic:"drop",tier:"gold",check:x=>!!x.dsl&&x.hp>=1000},
  {g:"diesel",id:"cold",name:"Cold-blooded",desc:"A clean diesel pull with the cell at -25 °C.",ic:"snow",tier:"silver",check:x=>!!x.cold},
  {g:"strip",id:"pass",name:"Down the track",desc:"Complete a quarter-mile pass.",ic:"flag",tier:"bronze",check:x=>x.et!=null},
  {g:"strip",id:"et12",name:"Twelve-second car",desc:"A clean pass under 12 s.",ic:"clock",tier:"bronze",check:x=>x.et<12},
  {g:"strip",id:"et10",name:"Ten-second car",desc:"A clean pass under 10 s.",ic:"clock",tier:"silver",check:x=>x.et<10},
  {g:"strip",id:"et9",name:"Nine-second car",desc:"A clean pass under 9 s.",ic:"clock",tier:"silver",check:x=>x.et<9},
  {g:"strip",id:"et8",name:"Eight-second pass",desc:"A clean pass under 8 s.",ic:"clock",tier:"gold",check:x=>x.et<8},
  {g:"strip",id:"et6",name:"Six-second pass",desc:"A clean pass under 6 s.",ic:"bolt",tier:"gold",check:x=>x.et<6},
  {g:"strip",id:"mph200",name:"Double ton",desc:"Cross the stripe at 200 mph or more.",ic:"chev",tier:"gold",check:x=>x.mph>=200},
  {g:"strip",id:"twostep",name:"Two-step",desc:"A clean pass launched on a two-step or line lock.",ic:"flag",tier:"bronze",check:x=>!!x.twostep},
  {g:"strip",id:"sixty",name:"Hooked up",desc:"A 60-foot time of 1.40 s or quicker.",ic:"wheel",tier:"silver",check:x=>x.sixty<=1.4},
  {g:"strip",id:"wheelie",name:"Wheelie",desc:"Lift the front wheels off the track.",ic:"wheel",tier:"bronze",check:x=>!!x.wheelie},
  {g:"strip",id:"win",name:"Won the lane",desc:"Win a heads-up race.",ic:"trophy",tier:"bronze",check:x=>!!x.win},
  {g:"strip",id:"holeshot",name:"Holeshot",desc:"Win heads-up with the slower ET, driving it yourself.",ic:"tree",tier:"silver",check:x=>!!x.holeshot},
  {g:"strip",id:"perfect",name:"Perfect light",desc:"A reaction time of 0.010 s or better, driving it yourself.",ic:"tree",tier:"gold",check:x=>x.rt>=0&&x.rt<=0.010},
  {g:"strip",id:"show",name:"Made the show",desc:"Qualify for a race-night ladder.",ic:"flag",tier:"bronze",check:x=>!!x.qualified},
  {g:"strip",id:"night",name:"Won the night",desc:"Win a race night.",ic:"trophy",tier:"gold",check:x=>x.nightsWon>=1},
  {g:"strip",id:"night3",name:"Regular",desc:"Win three race nights.",ic:"trophy",tier:"gold",check:x=>x.nightsWon>=3},
  {g:"strip",id:"deadon",name:"Dead on",desc:"Bracket round: run within 0.010 s of your dial.",ic:"target",tier:"silver",check:x=>x.deadOn<=0.010},
  {g:"n2o",id:"shot",name:"First shot",desc:"Hit the button on a nitrous pass.",ic:"bolt",tier:"bronze",check:x=>!!x.n2oOn},
  {g:"n2o",id:"purged",name:"Purged",desc:"Hit the shot with the line full of liquid.",ic:"drop",tier:"silver",check:x=>!!x.n2oPurged},
  {g:"n2o",id:"bigshot",name:"Big bottle",desc:"Run a 300 hp shot or more without breaking anything.",ic:"bolt",tier:"gold",check:x=>x.shotHp>=300},
  {g:"pull",id:"hook",name:"On the hook",desc:"Take the sled for a ride.",ic:"hook",tier:"bronze",check:x=>!!x.pullDone},
  {g:"pull",id:"full",name:"Full pull",desc:"Drag the sled the full 300 ft.",ic:"hook",tier:"silver",check:x=>!!x.full},
  {g:"pull",id:"ribbon",name:"Blue ribbon",desc:"Win a pulling class.",ic:"trophy",tier:"silver",check:x=>!!x.pullWin},
  {g:"pull",id:"puller",name:"Pull-off winner",desc:"Win a pull-off against other full pulls.",ic:"trophy",tier:"gold",check:x=>!!x.pullOff},
  {g:"pull",id:"hotfarm",name:"Hot Farm hero",desc:"Win the Hot Farm class.",ic:"flame",tier:"gold",check:x=>!!x.hotfarm},
  {g:"bog",id:"bogthru",name:"Through the pit",desc:"Get a truck all the way through a mud pit.",ic:"wheel",tier:"bronze",check:x=>!!x.bogThru},
  {g:"bog",id:"bogwin",name:"King of the pit",desc:"Win a mud-bog class.",ic:"trophy",tier:"silver",check:x=>!!x.bogWin},
  {g:"hill",id:"hillsum",name:"To the clouds",desc:"Reach the summit of Pikes Peak.",ic:"flag",tier:"bronze",check:x=>!!x.hillFin},
  {g:"hill",id:"hillwin",name:"King of the Mountain",desc:"Win a Pikes Peak class.",ic:"trophy",tier:"silver",check:x=>!!x.hillWin},
  {g:"hill",id:"hill10",name:"Under ten",desc:"Reach the summit in under 10 minutes.",ic:"clock",tier:"gold",check:x=>x.hillT>0&&x.hillT<600},
  {g:"boat",id:"boatpass",name:"On plane",desc:"Make a clean 1,000 ft pass on the river.",ic:"flag",tier:"bronze",check:x=>!!x.boatPass},
  {g:"boat",id:"boatwin",name:"River king",desc:"Win a boat-drag night.",ic:"trophy",tier:"silver",check:x=>!!x.boatWin},
  {g:"boat",id:"boat200",name:"Rooster tail",desc:"Cross the far buoys at 200 mph or more.",ic:"bolt",tier:"gold",check:x=>x.boatMph>=200},
  {g:"bog",id:"bogfast",name:"Skimmer",desc:"Clear the pit averaging 30 mph or more.",ic:"bolt",tier:"gold",check:x=>x.bogAvg>=30},
  {g:"endure",id:"e24fin",name:"Saw the flag",desc:"Be classified at the end of the 24 Hours of Prairie Sky.",ic:"clock",tier:"bronze",check:x=>!!x.e24Fin},
  {g:"endure",id:"e24pod",name:"Sunday morning podium",desc:"Finish the 24 Hours on the class podium.",ic:"flag",tier:"silver",check:x=>!!x.e24Pod},
  {g:"endure",id:"e24win",name:"Prairie Sky winner",desc:"Win your class at the 24 Hours.",ic:"trophy",tier:"gold",check:x=>!!x.e24Win},
  {g:"shop",id:"sale",name:"First sale",desc:"Deliver a contract or sell on the open market.",ic:"coin",tier:"bronze",check:()=>career()&&C().sold>0},
  {g:"shop",id:"repeat",name:"Repeat customer",desc:"Deliver a repeat order from a happy client.",ic:"people",tier:"silver",check:()=>career()&&C().repeats>0},
  {g:"shop",id:"sold50",name:"Fifty out the door",desc:"Sell 50 engines.",ic:"engine",tier:"silver",check:()=>career()&&C().sold>=50},
  {g:"shop",id:"sold200",name:"Production line",desc:"Sell 200 engines.",ic:"engine",tier:"gold",check:()=>career()&&C().sold>=200},
  {g:"shop",id:"legend",name:"Legend",desc:"Reach the Legend reputation tier.",ic:"star",tier:"gold",check:()=>career()&&repTierIdx()>=REP_TIERS.length-1},
  {g:"shop",id:"zero",name:"Zero defects",desc:"Ten straight weeks in the field with no warranty claim.",ic:"shield",tier:"silver",check:()=>career()&&C().cleanWeeks>=10},
  {g:"shop",id:"debtfree",name:"Debt-free",desc:"Take a loan, then pay the bank back in full.",ic:"coin",tier:"bronze",check:()=>career()&&!!(S.achN||{}).loan&&C().loan<=0},
  {g:"shop",id:"cash100",name:"Six figures",desc:"Hold $100,000 in cash.",ic:"coin",tier:"silver",check:()=>career()&&C().cash>=1e5},
  {g:"shop",id:"year",name:"A full year",desc:"Survive to week 52.",ic:"cal",tier:"silver",check:()=>career()&&C().week>=52},
  {g:"shop",id:"spon1",name:"Sponsored",desc:"Sign your first sponsor.",ic:"star",tier:"bronze",check:()=>career()&&spS().hist.signed>0},
  {g:"shop",id:"spondone",name:"Good for the brand",desc:"Finish a sponsorship with every obligation met.",ic:"tick",tier:"silver",check:()=>career()&&spS().hist.done>0},
  {g:"shop",id:"sponfull",name:"Full livery",desc:"Carry three sponsors at once.",ic:"trophy",tier:"gold",check:()=>career()&&spS().hist.max>=3},
  {g:"shop",id:"ddfirst",name:"Diagnosed",desc:"Find and fix a sick engine on Dyno day (practice counts).",ic:"tick",tier:"bronze",check:x=>!!x.ddPass},
  {g:"shop",id:"ddclean",name:"No hints needed",desc:"Fix a Dyno day job with no hints, on budget.",ic:"bolt",tier:"silver",check:x=>!!x.ddClean},
  {g:"shop",id:"dd10",name:"House calls",desc:"Fix ten customers' engines in one career.",ic:"shield",tier:"gold",check:()=>career()&&!!C().dd&&C().dd.passed>=10}
];
let achQ=[],achBusy=false,achAll=false;   // achAll: the list shows every row, not the first ACH_CAP (this visit only)
const achN=()=>ACH.filter(a=>S.ach&&S.ach[a.id]).length;
function achFacts(x){
  const f={};const R=recs();
  if(x.type==="dyno"){const res=x.res,env=x.env,pull=env.testType==="pull";
    if(x.ok){f.ok=true;f.rel=res.rel;f.boosted=S.cfg.asp!=="na";f.redline=S.cfg.redline;if(pull)f.hp=res.peakHp;if(env.testType==="endurance")f.hours=env.hours;
      if(res.diesel){f.dsl=true;if(pull){const t=(res.tests||[]).find(q=>q.id==="cold_start");if(env.ambientC<=-25&&t&&t.util<=1)f.cold=true;}}}
    if(res.diesel&&pull)f.smoke=res.smoke;
    if(env.testType==="overrev"&&res.overrev&&res.overrev.survived&&!res.fails.length)f.overrevOk=true;}
  // the light (reaction time, holeshot) counts only if you drove it: "You drive", or you took over from Auto before the tree lit (r.auto.pre). ET and mph count either way
  else if(x.type==="drag"){const r=x.r,ra=r.race,nt=r.night,you=!r.auto||!!r.auto.pre,ok=!x.failed&&r.et!=null&&!(ra&&ra.foul)&&!(career()&&r.mph>150&&!r.chute);
    if(ok){f.et=r.et;f.mph=r.mph;if(r.sixty)f.sixty=r.sixty.t;if(r.launch&&r.launch.ctl&&r.launch.ctl!=="none")f.twostep=true;if(r.wheelieT>=0.2||r.liftMax>=0.6)f.wheelie=true;
      if(ra&&ra.rt!=null&&you)f.rt=ra.rt;if(nt&&nt.fmt==="bracket"&&nt.dialP!=null&&nt.stage>=2)f.deadOn=Math.abs(r.et-nt.dialP);
      if(r.n2o&&r.n2o.on){f.n2oOn=true;if(r.n2o.lineAtOn>=0.95)f.n2oPurged=true;f.shotHp=r.n2o.shotHp;}}
    else if(!x.failed&&r.n2o&&r.n2o.on){f.n2oOn=true;if(r.n2o.lineAtOn>=0.95)f.n2oPurged=true;}
    if(ra&&ra.won&&!ra.foul){f.win=true;if(you&&r.et!=null&&ra.oppEt!=null&&r.et>ra.oppEt)f.holeshot=true;}
    if(nt&&nt.stage>=2)f.qualified=true;}
  else if(x.type==="bog"){const r=x.r;if(!x.failed){if(r.cleared){f.bogThru=true;f.bogAvg=r.avgMph||0;}if(r.place===1)f.bogWin=true;}}
  else if(x.type==="hill"){const r=x.r;if(!r.dnf&&r.time>0){f.hillFin=true;f.hillT=r.time;if(r.place===1)f.hillWin=true;}}
  else if(x.type==="boat"){const r=x.r;if(!x.failed&&r.et!=null&&!(r.match&&r.match.foul)){f.boatPass=true;f.boatMph=r.mph||0;}if(x.place===1)f.boatWin=true;}
  else if(x.type==="e24"){const r=x.r;if(r.classified){f.e24Fin=true;if(r.posCls<=3)f.e24Pod=true;if(r.posCls===1)f.e24Win=true;}}
  else if(x.type==="pull"){const r=x.r;if(!x.failed){f.pullDone=true;if(r.full)f.full=true;if(r.place===1){f.pullWin=true;if(r.cls==="hotfarm")f.hotfarm=true;if(r.full&&r.pullOff!=null)f.pullOff=true;}}}
  else if(x.type==="retro"){const hp=R.hp?R.hp.v:career()&&C().bestHp>0?C().bestHp:0,rel=R.rel?R.rel.v:career()&&C().bestRel>0?C().bestRel:0,et=allBest(),P=R.pull&&typeof R.pull==="object"?Object.values(R.pull):[];
    if(hp>0){f.ok=true;f.hp=hp;}if(rel>0)f.rel=rel;if(et<Infinity)f.et=et;if(R.top&&R.top[0])f.mph=Math.max.apply(null,R.top.map(e=>e.mph||0));
    if(career()&&C().enduranceOk)f.hours=100;if(career()&&C().boostedCert)f.boosted=true;
    if(P.length){f.pullDone=true;if(P.some(e=>e.full))f.full=true;}if(R.bog&&typeof R.bog==="object"&&Object.values(R.bog).some(e=>e&&e.c))f.bogThru=true;if(R.bestFinish<=5)f.qualified=true;
    if(S.firstFireDone)f.firstfire=true;if(R.e24Best){f.e24Fin=true;if(R.e24Best<=3)f.e24Pod=true;if(R.e24Best===1)f.e24Win=true;}}
  else if(x.type==="dd"){f.ddPass=!!x.pass;f.ddClean=!!x.clean;}
  else if(x.type==="ff")f.firstfire=true;
  else if(x.type==="swap")Object.assign(f,x.f||{});
  f.nightsWon=R.nightsWon||0;
  return f;}
function achCheck(x){
  if(!S||ff||!S.mode)return;
  try{tropHook(x);}catch(e){}   // the trophy room's dated log of wins (app/trophy.js)
  try{
    if(x.type==="dyno"){const res=x.res,env=x.env;x.ok=!x.failing&&!res.fails.length&&!x.offStd&&!(career()&&env.testType==="pull"&&!(C().cert&&C().cert.ok));}
    if(career()&&C().loan>0)(S.achN=S.achN||{}).loan=1;
    const f=achFacts(x);if(!S.ach||typeof S.ach!=="object")S.ach={};const got=[];
    for(const a of ACH){if(S.ach[a.id])continue;let ok=false;try{ok=!!a.check(f);}catch(e){}
      if(ok){S.ach[a.id]={d:Date.now(),w:career()?C().week:null};got.push(a);}}
    if(got.length){if(x.type==="retro")achQ.push({sum:got.length});else got.forEach(a=>achQ.push(a));achShow();}
    achRefresh();
  }catch(e){if(window.ACHDBG)throw e;}}
function achShow(){if(achBusy||!achQ.length)return;const a=achQ.shift(),el=$("achToast");if(!el)return;achBusy=true;
  el.innerHTML=a.sum?`<div class="ai t-gold"><svg viewBox="0 0 24 24"><path d="${ACH_ICONS.star}"/></svg></div><div class="at"><small>Achievements</small><b>${a.sum} unlocked from your records</b></div>`
    :`<div class="ai t-${a.tier}"><svg viewBox="0 0 24 24"><path d="${ACH_ICONS[a.ic]}"/></svg></div><div class="at"><small>Achievement · ${ACH_TIER[a.tier]}</small><b>${a.name}</b><span>${a.desc}</span></div>`;
  el.classList.add("on");toastPlace();
  setTimeout(()=>{el.classList.remove("on");setTimeout(()=>{achBusy=false;achShow();},350);},achQ.length?2200:3400);}
function achRefresh(){const s=$("achSet");if(s)s.textContent=achN()+" / "+ACH.length;const c=$("achCnt");if(c)c.textContent=achN()+" / "+ACH.length;}
function achWhen(e){return e.w!=null?"week "+e.w:new Date(e.d).toLocaleDateString("en-CA",{month:"short",day:"numeric"});}
/* Achievements list: a closed fold headed "Achievements n / 83"; inside, a status row (Not yet | Done | All), a scrolling group row and short rows
   (icon, name with the description behind an (i), a tick and the date or the tier). Eight rows, then "Show all". S.achOpen = fold open, S.achF = status,
   S.achG = group; old saves have none (closed, Not yet, every group). */
const ACH_CAP=8;
function renderAch(){const box=$("achBox");if(!box)return;const have=S.ach||{},fold=$("achFold");
  const nDone=ACH.filter(a=>have[a.id]).length,nTodo=ACH.length-nDone;
  let f=S.achF==="all"||S.achF==="done"||S.achF==="todo"?S.achF:(nTodo?"todo":"done");if(f==="todo"&&!nTodo)f="done";if(f==="done"&&!nDone)f=nTodo?"todo":"all";
  const inF=a=>f==="all"||(f==="done")===!!have[a.id];
  const gs=ACH_GROUPS.map(([g,n])=>({g,n,k:ACH.filter(a=>a.g===g&&inF(a)).length})).filter(x=>x.k);
  let g=S.achG&&gs.some(x=>x.g===S.achG)?S.achG:"";
  const L=ACH.filter(a=>inF(a)&&(!g||a.g===g));if(f==="done")L.sort((x,y)=>have[y.id].d-have[x.id].d);
  const vis=achAll?L:L.slice(0,ACH_CAP);
  const row=a=>{const e=have[a.id];return `<div class="ach ${e?"on":"off"}"><div class="ai t-${a.tier}"><svg viewBox="0 0 24 24"><path d="${ACH_ICONS[a.ic]}"/></svg></div><div class="at"><b>${a.name}${moreI(a.desc)}</b></div><small>${e?"&#10003; "+achWhen(e):ACH_TIER[a.tier]}</small></div>`;};
  const st=(k,t,n)=>`<button data-achf="${k}" class="${f===k?"on":""}" aria-pressed="${f===k}">${t} <b>${n}</b></button>`;
  const gc=(k,t,n)=>`<button data-achg="${k}" class="${g===k?"on":""}" aria-pressed="${g===k}">${t} <b>${n}</b></button>`;
  box.innerHTML=`<p class="achsum">${["gold","silver","bronze"].map(t=>`<em class="t-${t}">${ACH.filter(a=>a.tier===t&&have[a.id]).length}/${ACH.filter(a=>a.tier===t).length} ${t}</em>`).join("")}</p>`
    +`<div class="seg achst">${st("todo","Not yet",nTodo)}${st("done","Done",nDone)}${st("all","All",ACH.length)}</div>`
    +(gs.length>1?`<div class="seg achgr" role="group" aria-label="Achievement groups">${gc("","All groups",gs.reduce((q,x)=>q+x.k,0))}${gs.map(x=>gc(x.g,x.n,x.k)).join("")}</div>`:"")
    +`<div class="achl">${vis.map(row).join("")||`<p class="hint">${f==="todo"?"Every achievement is earned.":"Nothing here yet."}</p>`}</div>`
    +(L.length>ACH_CAP?`<button class="btn sm ghost achmore" data-achall="1">${achAll?"Show fewer":"Show all "+L.length}</button>`:"");
  if(fold&&fold.open!==!!S.achOpen)fold.open=!!S.achOpen;
  achRefresh();}
document.addEventListener("click",e=>{const b=e.target.closest("[data-achf],[data-achg],[data-achall]");if(!b||!b.closest("#achBox"))return;
  if(b.dataset.achf){S.achF=b.dataset.achf;S.achG="";achAll=false;save();}else if(b.dataset.achg!=null){S.achG=b.dataset.achg;achAll=false;save();}else achAll=!achAll;
  renderAch();buzz(4);});
document.addEventListener("toggle",e=>{const d=e.target;if(!d||!d.id)return;if(d.id==="achFold"){const o=d.open;if(!!S.achOpen!==o){S.achOpen=o;save();}}
  else if(d.id==="teleFold"&&!teleSilent){const o=d.open;if(S.anaTele!==o){S.anaTele=o;save();}}},true);
/* Analysis folds: Telemetry (closed unless opened once, then remembered) and the combo rows (title only, tap for the text).
   anaReveal(el) opens the fold around a tour/lesson target, without remembering it. */
let teleSilent=false;const comboOpen=new Set();
function anaReveal(el){const d=el&&el.closest&&el.closest("#teleFold");if(d&&!d.open){teleSilent=true;d.open=true;setTimeout(()=>{teleSilent=false;},60);}}
document.addEventListener("toggle",e=>{const d=e.target;if(d&&d.classList&&d.classList.contains("combo")&&d.dataset.t){if(d.open)comboOpen.add(d.dataset.t);else comboOpen.delete(d.dataset.t);}},true);
/* ===================== TEARDOWN (exploded view of what broke) ===================== */
const TD_SPECIAL={lean:1,backfire:1,panel:1,turbo:1,manifold:1,piston:1,worn:1};
function tdFail(L){   // {id, test} for a run that broke, else null
  if(!L||!L.res)return null;const res=L.res,env=L.env||{},tt=env.testType;let id=null;
  const fromTests=()=>{let i=null;
    if(tt==="overrev"&&res.overrev&&!res.overrev.survived){const e=(res.overrev.events||[]).join(" ");i=/Valve float/.test(e)?"valve_piston":/Rod beam/.test(e)?"rod_tension":/Rod bolts/.test(e)?"rod_bolts":/oil pressure/.test(e)?"bearing_load":null;}
    else if(tt==="endurance"&&res.endurance&&res.endurance.failedAtHour!=null){const dm=res.endurance.damage||{};for(const t of res.tests)if(dm[t.id]>=1){i=t.id;break;}}
    if(!i&&res.fails&&res.fails.length){const t=res.tests.find(x=>x.name===res.fails[0]);i=t?t.id:null;}return i;};
  if(tt==="drag"){if(!res.dragFailed)return null;const k=res.dragFailKind;id=TD_SPECIAL[k]?k:(fromTests()||k||"rod");}
  else if(tt==="race24"){const d=res.e24&&res.e24.dnf;if(!d||!d.id)return null;id=d.id;}
  else if(tt==="boat"){if(!res.boatFailed)return null;const k=res.boatFailKind;id=k&&(TD_SPECIAL[k]||res.tests.some(t=>t.id===k))?k:(fromTests()||"valve_float");}
  else if(tt==="bog"){if(!res.bogFailed)return null;const k=res.bogFailKind;id=k&&(TD_SPECIAL[k]||res.tests.some(t=>t.id===k))?k:(fromTests()||k||"rod");}
  else if(tt==="pull_sled"){if(!res.pullFailed)return null;const k=res.pullFailKind;id=k&&(TD_SPECIAL[k]||res.tests.some(t=>t.id===k))?k:(fromTests()||k||"rod");}
  else{const broke=(res.fails&&res.fails.length)||(tt==="endurance"&&res.endurance&&res.endurance.failedAtHour!=null)||(tt==="overrev"&&res.overrev&&!res.overrev.survived);if(!broke)return null;id=fromTests()||"rod_tension";}
  return {id,test:res.tests.find(t=>t.id===id)||null};
}
function tdRunName(L){const tt=L.env&&L.env.testType;return tt==="bog"?"mud bog run":tt==="boat"?"boat pass":tt==="race24"?"24-hour race":tt==="drag"?"strip pass":tt==="pull_sled"?"sled pull":tt==="endurance"?"endurance run":tt==="overrev"?"over-rev test":"dyno pull";}
function tdVerdict(res,env){const f=tdFail({res,env});const v=$("verdict").firstElementChild;if(!f||!v)return;const box=v.firstElementChild||v;
  box.insertAdjacentHTML("beforeend",`<div class="tdgo"><button class="btn sm danger" data-td="1">Teardown — see what broke</button></div>`);}
let tdIsOpen=false;
function tdShort(x,n){x=String(x||"").replace(/<[^>]*>/g,"");const m=x.match(/^.*?[.!?](\s|$)/);x=(m?m[0]:x).trim();return x.length>n?x.slice(0,n-1).trim()+"…":x;}
function tdOpen(){const L=S.last,f=tdFail(L);if(!f||testing||!ENGINE_VIS.teardown)return;
  const c=L.cfg||S.cfg,lay=LAYOUTS[c.layout]||{banks:1,angle:0,n:4};
  const isD=SIM.isDiesel?SIM.isDiesel(c):!!(SIM.OPT.fuel[c.fuel]||{}).ci;
  const tx=ENGINE_VIS.teardown({failId:f.id,layout:{banks:lay.banks,angle:lay.angle,n:lay.n},bore:c.bore,stroke:c.stroke,rodRatio:c.rodRatio,diesel:isD,cyl:lay.n,asp:c.asp,blockMat:c.blockMat,headMat:c.headMat});
  if(!tx)return;tdIsOpen=true;$("app").classList.remove("onstrip");$("app").classList.add("td");
  const t=f.test,r=L.res;let meas=t?`${t.name}: ${t.sub}`:"";
  if(!t){const why=((r.drag&&r.drag.reasons)||(r.pull&&r.pull.reasons)||[]).find(x=>/lean|backfire|turbine|manifold|crown|sled|let go|tired/i.test(x));meas=why?tdShort(why,150):"";}
  $("tdRun").textContent=tdRunName(L);$("tdPart").textContent=tx.part;$("tdWhat").textContent=tx.what+".";
  $("tdMeas").textContent=meas;$("tdMeas").hidden=!meas;
  $("tdFix").innerHTML=`<i>Fix:</i> `+(t&&t.fix?t.fix:tx.fix).replace(/</g,"&lt;");
  $("tdSpin").classList.remove("on");$("tdSpin").setAttribute("aria-pressed","false");
  $("tdCap").hidden=false;tdPadSync();setTimeout(()=>{tdPadSync();$("tdBack").focus({preventScroll:true});},350);}
function tdPadSync(){if(!tdIsOpen)return;const v=$("view").getBoundingClientRect(),c=$("tdCap").getBoundingClientRect();const h=document.querySelector("#hud .hudbtns"),hb=h?h.getBoundingClientRect().bottom:v.top;
  if(v.height>0)ENGINE_VIS.teardownPad(deskOn()?0.1:Math.max(0,(v.bottom-c.top)/v.height),Math.max(0,(hb-v.top)/v.height));}
function tdClose(){if(!tdIsOpen)return;tdIsOpen=false;$("tdCap").hidden=true;$("app").classList.remove("td");ENGINE_VIS.teardown(null);}
document.addEventListener("click",e=>{const b=e.target.closest("[data-td]");if(b){e.preventDefault();tdOpen();}});
$("tdBack").addEventListener("click",tdClose);
$("tdSpin").addEventListener("click",()=>{const on=!$("tdSpin").classList.contains("on");ENGINE_VIS.teardownSpin(on);$("tdSpin").classList.toggle("on",on);$("tdSpin").setAttribute("aria-pressed",String(on));});
document.addEventListener("keydown",e=>{if(tdIsOpen&&e.key==="Escape"){e.preventDefault();e.stopPropagation();tdClose();}},true);
$("runTest").addEventListener("click",tdClose,true);   // a new run always starts from the assembled engine

/* ===================== ANALYSIS ===================== */
function renderAnalysis(){
  $("comboCnt").textContent=combosNow.length+" found";
  const order={bad:0,warn:1,good:2,info:3};
  $("combos").innerHTML=combosNow.slice().sort((a,b)=>order[a.severity]-order[b.severity]).map(c=>`<details class="combo ${c.severity}" data-t="${c.title.replace(/"/g,"&quot;")}"${comboOpen.has(c.title)?" open":""}><summary><h3>${c.title}</h3></summary><p>${c.text}</p></details>`).join("")||`<p class="hint">Nothing notable — a conventional combination.</p>`;
  const r=(S.last&&S.last.hash===cfgHash(S.cfg))?S.last.res:quick;const T=r.thermals,L=r.loads,Cl=r.clearances,K=r.knock;
  const rows=[["Peak cylinder pressure",`${(L.pmaxMPa*10).toFixed(0)} bar`],K.onRequired==null?["Fuel cetane",`${K.cetane}`]:["Octane required",`${K.onRequired.toFixed(1)} (margin ${K.margin>=0?"+":""}${K.margin.toFixed(1)})`],...(r.diesel?[["Smoke (peak)",`${Math.round(r.smoke||0)}% · ${smokeWord(r)}`],["Clatter",`${Math.round((r.clatter||0)*100)}% · ${r.clatter>0.66?"loud":r.clatter>0.4?"audible":"quiet"}`],["Full-load λ (leanest / spool)",r.fuel?`${(+(r.fuel.lamTop||S.cfg.lambda)).toFixed(2)} / ${(r.fuel.lamMin||0).toFixed(2)}`:"—"],["Injection used",r.fuel?`${Math.round(r.fuel.injUtil*100)}%`:"—"]]:[["Knock retard",`${K.retardDeg.toFixed(1)}°`]]),["Piston crown",`${Math.round(T.crownC)} °C`],["Peak EGT",`${Math.round(T.egtPeakC)} °C`],["Charge temp",`${Math.round(T.chargeC)} °C`],["Heat to coolant",`${Math.round(T.coolantLoadKw)} kW`],["Mean piston speed",`${L.pistonSpeedMs.toFixed(1)} m/s`],["Piston accel",`${Math.round(L.pistonAccelG).toLocaleString()} g`],["Rod tension / comp",`${L.rodTensionKn.toFixed(0)} / ${L.rodCompKn.toFixed(0)} kN`],["Bearing load",`${L.bearingMPa.toFixed(0)} MPa`],["Oil film",`${L.filmUm.toFixed(2)} µm`],["Rod bolt stretch",`${L.boltStretchPct.toFixed(1)}%`],["Torsional margin",`${L.torsionalMarginPct.toFixed(0)}%`],["Cylinder wall",`${L.wallThicknessMm.toFixed(1)} mm`],["Piston clearance cold/hot",`${(Cl.coldMm*1000).toFixed(0)} / ${(Cl.hotMm*1000).toFixed(0)} µm`],["Ring gap set / needed",`${Cl.ringGapMm.toFixed(2)} / ${Cl.ringGapNeededMm.toFixed(2)} mm`],["Valve-to-piston",`${Cl.valvePistonMm.toFixed(1)} mm`],["Dry weight",`${Math.round(r.kg)} kg`],["Unit cost",fmt$(r.cost)]];
  if(r.rotary){const R=r.rotary;rows.splice(0,rows.length,   // a rotary: the eccentric shaft, the seals and the hot lobe instead of pistons and rods
    ["Eccentric shaft / rotors",`${R.eshaftRpm.toLocaleString()} / ${R.rotorRpm.toLocaleString()} rpm`],["Firing rate",`${Math.round(R.firingHz)}/s · ${R.rotors} rotor${R.rotors>1?"s":""}`],
    ["Chamber",`${Math.round(R.chamberCc)} cc × ${R.rotors} ≈ ${R.VdEqL.toFixed(1)} L eq.`],["Peak chamber pressure",`${(L.pmaxMPa*10).toFixed(0)} bar`],
    ["Octane required",`${K.onRequired.toFixed(1)} (margin ${K.margin>=0?"+":""}${K.margin.toFixed(1)})`],["Knock retard",`${K.retardDeg.toFixed(1)}°`],
    ["Apex seal load",`${R.sealMPa.toFixed(0)} / ${Math.round(R.sealMPa/Math.max(1e-6,R.sealUtil))} MPa`],["Apex seal speed",`${R.apexMs.toFixed(1)} m/s · ${Math.round(R.apexG).toLocaleString()} g`],
    ["Hot lobe (housing)",`${Math.round(R.housingC)} °C`],["Peak EGT",`${Math.round(T.egtPeakC)} °C`],["Charge temp",`${Math.round(T.chargeC)} °C`],["Heat to coolant",`${Math.round(T.coolantLoadKw)} kW`],
    ["E-shaft bow",`${R.eshaftUm.toFixed(0)} µm · ${R.supports} mains`],["Rotor orbit pull",`${R.centKn.toFixed(0)} kN a rotor`],["Rotor bearing",`${R.brgMPa.toFixed(0)} MPa`],["Oil film",`${L.filmUm.toFixed(2)} µm`],
    ["Seal oiling",`${Math.round(R.oilUtil*100)}% of supply`],["Oil burnt",`${R.oilL.toFixed(1)} L/1000 km`],["Carbon build-up",`${Math.round(R.carbon*100)}%`],["Idles at",`${R.idleRpm.toLocaleString()} rpm`],
    ["Dry weight",`${Math.round(r.kg)} kg`],["Unit cost",fmt$(r.cost)]);}
  if(r.twoStroke){const R=r.twoStroke;rows.splice(0,rows.length,   // a two-stroke: delivery and trapping, the pipe and the oil instead of valvetrain numbers
    ["Firing rate",`${Math.round(R.firingHz).toLocaleString()}/s · every turn`],["Swept / eq.",`${R.swept<1?fmtDisp(R.swept):R.swept.toFixed(2)+" L"} · ${R.eq<1?fmtDisp(R.eq):R.eq.toFixed(R.eq<2?2:1)+" L"} 4T`],
    ["Delivery ratio",`${R.drPk.toFixed(2)} at peak`],["Trapping",`${Math.round(R.tePk*100)}% · ${R.scChargePct}% lost`],
    ...(isCI(S.cfg.fuel)?[["Fuel cetane",`${K.cetane}`],["Smoke (peak)",`${Math.round(r.smoke||0)}%`]]:[["Octane required",`${K.onRequired.toFixed(1)} (margin ${K.margin>=0?"+":""}${K.margin.toFixed(1)})`],["Fuel out the pipe",`${R.scFuelPct}% at peak`]]),
    ["Ports timed for",`${(Math.round(R.rpmP/100)*100).toLocaleString()} rpm · ${Math.round(R.ep)}°/${Math.round(R.tp)}°`],
    ...(R.pipeRpm?[["Pipe tuned / hot",`${R.pipeRpm.toLocaleString()} / ${R.pipeTune.toLocaleString()} rpm`],["On the pipe",`${R.onPipe.toLocaleString()} rpm`]]:[]),
    ["Power band",`${R.band[0].toLocaleString()}–${R.band[1].toLocaleString()} rpm`],["Peak cylinder pressure",`${(L.pmaxMPa*10).toFixed(0)} bar`],
    ["Piston crown",`${Math.round(T.crownC)} °C`],["Peak EGT",`${Math.round(T.egtPeakC)} °C`],
    ...(R.ccr?[["Crankcase",`${R.ccr.toFixed(2)}:1 · seals ${R.sealMs.toFixed(1)} m/s`]]:[]),
    ...(R.blower?[["Air box",`${R.boxBar.toFixed(2)} bar`]]:[]),
    [R.lube==="sump"?"Oiling":"Oil burnt",R.lube==="sump"?"pressure-fed sump":R.lube==="inject"?`pump · ${R.oilLph.toFixed(2)} L/h`:`${Math.round(R.lubR)}:1 · ${R.oilLph.toFixed(2)} L/h`],
    ["Seizure margin",`${Math.round(R.seize*100)}% of the edge`],["Idles at",`${R.idleRpm.toLocaleString()} rpm`],
    ["Dry weight",`${Math.round(r.kg)} kg`],["Unit cost",fmt$(r.cost)]);}
  if(r.alt&&r.alt.gas)rows.push(["Gas system load",`${Math.round(r.fuel.load*100)}% · ${Math.round(r.alt.capKgh)} kg/h`],["Air displaced",`${r.alt.displacePct}%`],[r.alt.unit==="kg"?"CNG use":"Propane use",`${r.alt.econNative} ${r.alt.unit==="kg"?"kg":"L"}/100km`]);
  if(r.alt&&r.alt.flex&&r.alt.winter){const w=r.alt.winter;rows.push(["Winter E"+w.pct+" margin",`${w.margin>=0?"+":"−"}${Math.abs(w.margin).toFixed(1)}`]);}
  if(launchLine(S.cfg))rows.push(["Launch (strip only)",launchLine(S.cfg)]);
  {const nz=r.noiseDb!=null?{db:r.noiseDb,dbOpen:r.noiseDbOpen}:SIM.exhaustNoise(S.cfg),nw=v=>v<=74?"quiet":v<=80?"road legal":v<=86?"loud":"track only";
    rows.push(["Drive-by noise",`${Math.round(nz.db)} dB · ${nw(nz.db)}`]);if(nz.dbOpen>nz.db+0.5)rows.push(["Cutout open",`${Math.round(nz.dbOpen)} dB`]);   // short values: .tele b never wraps
    if(r.exhaustSys)rows.push(["Exhaust backpressure",r.exhaustSys.open?"none · open":`${r.exhaustSys.dpBar.toFixed(2)} bar`]);}
  {const tf=$("teleFold");if(tf&&tf.open!==!!S.anaTele){teleSilent=true;tf.open=!!S.anaTele;setTimeout(()=>{teleSilent=false;},60);}}
  $("tele").classList.toggle("rot",!!(r.rotary||r.twoStroke));$("tele").innerHTML=rows.map(([a,b])=>`<div><span>${a}</span><b>${b}</b></div>`).join("");
  $("notes").innerHTML=r.notes.length?r.notes.map(n=>`<div>${n}</div>`).join(""):"<div>No notes — nothing is being wasted or hidden in this build.</div>";
  renderRecords();renderAch();
}
function renderRecords(){const box=$("recBox");if(!box)return;const R=recs(),cr=career(),esc=v=>String(v==null?"":v).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
  const when=(e,sh)=>e.w!=null?(sh?"wk ":"week ")+e.w:e.d?new Date(e.d).toLocaleDateString("en-CA",{month:"short",day:"numeric"}):"";
  const sub=e=>e.n?`<small>${esc(e.n)}${when(e)?" · "+when(e):""}</small>`:"<small>set earlier</small>";
  const top=R.top,be=cr&&C().bestEt||Infinity,best=top[0]&&top[0].et<=be?top[0]:(be<Infinity?{et:be}:null),hp=R.hp||(cr&&C().bestHp>0?{v:Math.round(C().bestHp)}:null),rel=R.rel||(cr&&C().bestRel>0?{v:C().bestRel}:null);
  $("recCnt").textContent=cr?"career":"sandbox";
  const pr=pullRecHtml()+bogRecHtml()+boatRecHtml()+saltRecHtml()+roadRecHtml()+hillRecHtml()+ovalRecHtml()+e24RecHtml();
  if(!best&&!hp&&!rel&&!pr){box.innerHTML=`<p class="hint">No records yet. ${cr?"Certify an engine on the dyno or take it down the strip":"Pull an engine on the dyno or make a pass on the strip"} — the best numbers you set land here.</p>`;return;}
  box.innerHTML=`<div class="recs"><div class="rec big"><span>Quickest ET</span>${best?`<b>${best.et.toFixed(3)}<i>s${best.mph?" @ "+Math.round(best.mph)+" mph":""}</i></b>${sub(best)}`:`<b>—</b><small>no clean pass yet</small>`}</div>`
    +`<div class="rec"><span>${cr?"Top certified":"Top pulled"}</span>${hp?`<b>${hp.v.toLocaleString("en-CA")}<i>hp</i></b>${sub(hp)}`:`<b>—</b><small>${cr?"nothing certified":"no clean pull"} yet</small>`}</div>`
    +`<div class="rec"><span>${cr?"Best certified rel":"Best reliability"}</span>${rel?`<b>${rel.v}<i>${rel.hp?"@ "+rel.hp+" hp":"rel"}</i></b>${sub(rel)}`:`<b>—</b><small>${cr?"nothing certified":"no clean pull"} yet</small>`}</div>`
    +(top.length?`<div class="rtop"><span>Top ${top.length===1?"pass":top.length+" passes"}</span>${top.map((e,i)=>`<div><b>${i+1}</b><span class="et">${e.et.toFixed(3)}</span><span>${Math.round(e.mph)} mph</span><span class="nm">${esc(e.n)}</span><span>${when(e,1)}</span></div>`).join("")}</div>`:"")+pr+rnRecHtml()+`</div>`;}

