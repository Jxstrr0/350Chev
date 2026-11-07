/* ===================== WEATHER (since 1.76.83.0) =====================
   The road test, the hill climb and the tractor pull each get a day. In the test cell a new day is rolled every
   time you go to one of those events (and with New day); in a career the day holds for the week, so you can't
   shop for a dry one. A day is the air (temperature and humidity, which the engine feels) and:
     road and hill  a chance of rain: wet 0 … 1, which takes grip off the tyres (SIM.roadWetMu: slicks lose most);
                    the hill's rivals slow down in it too
     pull           damp or dry dirt: moisture added to (or taken off) the night's track, which the rivals feel too
   Test cell only: S.env.wxOn false is a standard day every time (20 °C, 40% humidity, dry; the game before weather).
   A career always has weather, so there is no standard-day way round the rain.
   The days live in wxStore().wxDay[event] = {t, h, rain, dirt, wk}. */
const WX_EVT={road:1,hill:1,pull_sled:1};
function wxOn(t){return !!WX_EVT[t||S.env.testType]&&(career()||S.env.wxOn!==false);}   // a career always has weather
function wxStore(){const o=career()?C():S;if(!o.wxDay||typeof o.wxDay!=="object")o.wxDay={};return o.wxDay;}
/* a fresh day: the season's temperature (career: by the week; test cell: any week of the year), then rain or the dirt */
function wxRoll(t){const r=Math.random,g=()=>Math.sqrt(-2*Math.log(Math.max(1e-6,r())))*Math.cos(2*Math.PI*r());
  const woy=career()?pcWoy(C().week):Math.floor(r()*52),c=Math.cos(2*Math.PI*(woy-28.5)/52);
  let tC=Math.max(5,4+17*c)+g()*5,h=45+12*c+g()*15,rain=0,dirt=0;
  if(t==="pull_sled"){const w=r();dirt=w<0.22?0.08+r()*0.1:(tC>=24&&h<50&&w<0.6)?-(0.06+r()*0.09):(r()-0.5)*0.08;}
  else if(r()<0.12+0.18*Math.max(0,Math.min(1,(h-45)/40))){rain=0.35+r()*0.65;tC-=3;h=Math.max(h,78+r()*12);}
  const d={t:Math.round(Math.min(38,Math.max(-2,tC))),h:Math.round(Math.min(95,Math.max(15,h))),rain:+rain.toFixed(2),dirt:+dirt.toFixed(2)};
  if(career())d.wk=C().week;
  wxStore()[t]=d;return d;}
/* going to an event: a new day in the test cell (a career keeps the week's) */
function wxVisit(t){if(WX_EVT[t]&&!career())wxRoll(t);}
function wxDay(t){t=t||S.env.testType;if(!wxOn(t))return null;const d=wxStore()[t];return d&&(!career()||d.wk===C().week)?d:wxRoll(t);}
/* what the run uses: the engine's air, the rain on the tyres, the pull's dirt */
function wxEnv(t){const d=wxDay(t);return d?{ambientC:d.t,humidity:d.h}:{};}
function wxWet(t){const d=wxDay(t);return d?d.rain||0:0;}
function wxHillWx(){const d=wxDay("hill");return d?{dT:d.t-20,h:d.h}:null;}   // the hill's air is a July morning at each altitude; the day moves it
function wxDirt(){const d=wxDay("pull_sled");return d?d.dirt||0:0;}
function wxTrack(tr){const k=wxDirt();if(!k)return tr;const b=tr||{moist:0.5,cut:0};return Object.assign({},b,{moist:+Math.min(0.95,Math.max(0.08,b.moist+k)).toFixed(2)});}
/* the hill's rivals in the rain: fitted to SIM.hillPass on the class tyres (a slick loses far more as it gets wetter) */
function wxHillSlow(w,slick){return 1+(slick?0.09*w+0.2*w*w:0.08*w+0.06*w*w);}
function wxField(f,k){const w=wxWet("hill");if(!w||!f)return f;const C0=SIM.HILL_CLASSES[k],sl=C0&&C0.tyres[C0.tyres.length-1]==="slick",m=wxHillSlow(w,sl);
  return f.map(x=>x.t==null?x:Object.assign({},x,{t:x.t*m,splits:(x.splits||[]).map(s=>s==null?s:s*m),wet:m}));}
const wxRain=w=>w<0.6?"light rain":w<0.85?"steady rain":"heavy rain";
function wxAir(d){const k=pcRho(d.t,d.h,500)/pcRho(20,40,500),p=Math.round((k-1)*100);return Math.abs(p)<2?"":` · the air is ${p>0?"dense":"thin"}, about ${Math.abs(p)}% ${p>0?"more":"less"} power from an atmospheric engine`;}
function wxTxt(t){const d=wxDay(t);if(!d)return"";
  if(t==="pull_sled"){const m=d.dirt>0.05?"damp dirt: it bites harder but drags at the sled":d.dirt<-0.05?"dry, dusty dirt: less bite, more wheel speed":"good dirt";return`${d.t} °C, ${d.h}% humidity · ${m}${wxAir(d)}`;}
  const ty=t==="hill"?S.env.hillTyre:S.env.roadTyre||(SIM.CHASSIS[S.env.roadCh]||{}).tyre,tn=((t==="hill"?SIM.HILL_TYRES:SIM.ROAD_TYRES)||{})[ty],loss=d.rain?Math.round((1-SIM.roadWetMu(ty,d.rain))*100):0;
  return`${d.t} °C, ${d.h}% humidity · ${d.rain?`${wxRain(d.rain)}: about ${loss}% less grip${tn?` on ${tn.n.toLowerCase()} tyres`:""}`:"dry"}${t==="road"?wxAir(d):""}`;}
function wxHtml(t){if(!WX_EVT[t])return"";
  if(!wxOn(t))return`<p class="hint wxday" data-nofold><b>Standard day</b> · 20 °C, 40% humidity, dry. <button class="btn sm ghost" data-wx="on">Real weather</button></p>`;
  const d=wxDay(t);return`<p class="hint wxday${d.rain?" wet":""}" data-nofold><b>${d.rain?"Rain today":career()?"This week's day":"Today"}</b> · ${wxTxt(t)}. ${career()?"":`<button class="btn sm ghost" data-wx="new">New day</button> <button class="btn sm ghost" data-wx="off">Standard day</button>`}</p>`;}
/* the result sheet's line */
function wxLine(r){const w=r&&r.wx;if(!w)return"";return`<p class="hint">${w.rain?`<b>Wet:</b> ${wxRain(w.rain)}, `:""}${w.t} °C, ${w.h}% humidity${w.dirt>0.05?", damp dirt":w.dirt<-0.05?", dry dirt":""}.</p>`;}
const wxSnap=t=>{const d=wxDay(t);return d?{t:d.t,h:d.h,rain:d.rain,dirt:d.dirt}:null;};
document.addEventListener("click",e=>{const b=e.target.closest("[data-wx]");if(!b)return;e.preventDefault();if(testing){toast("Let the run finish first");return;}
  const a=b.dataset.wx,t=S.env.testType;if(career())return;if(a==="off")S.env.wxOn=false;else if(a==="on")S.env.wxOn=true;else if(a==="new"&&!career())wxRoll(t);
  if(t==="hill")hillPrepCache.clear();renderEnv();renderTest();save();});
