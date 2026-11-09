/* ---- ambience beds and crowd reactions ----
   Ten 18-second ambience loops (sounds/amb/: strip, pull, bog, boat, salt, road, hill, oval, e24 and the shop) and eight crowd
   one-shots (sounds/crowd/: cheer, applause, groan, ooh, fullpull, bog, summit, dynoclap), generated with ElevenLabs sound effects
   for Longlight Interactive (credits in sounds/CREDITS.md). Each loop was cut so its tail crossfades into its head and saved with a
   quarter second of wrap-around either side, so the loop points sit inside clean audio whatever the decoder does with MP3 padding.
   Which bed plays: the Events tab plays the venue of the event that is set up; every other tab plays the shop. Nothing is fetched
   until sound is on and the slider is above zero; then only the bed for where you are is fetched (the service worker caches it)
   and decoded, with a 1.5 s crossfade when you move. Crowd reactions are fetched when the Events tab opens on that event and are
   called from each event's finish (crowdAfter), and from a certified dyno pull in the shop.
   Ambience and crowd play through the engine's audio context straight to the speakers, past the engine EQ, on their own level:
   Settings › Sound › Ambience & crowd (S.ambVol, 0–100, 40 unless set). While a bed plays the engine sound is asked not to
   idle-suspend the audio (ENGINE_SOUND.holdAwake). A hidden tab, sound off or the slider at zero stops the bed. */
const AMB_FOR={drag:"strip",bracket:"strip",pull_sled:"pull",bog:"bog",boat:"boat",salt:"salt",road:"road",hill:"hill",oval:"oval",race24:"e24"};
const AMB_LEN=18,AMB_ROLL=0.25,AMB_GAIN=0.9,CROWD_GAIN=1.1;
const CROWD_FOR={strip:["cheer","applause","groan","ooh"],pull:["fullpull","applause","groan"],bog:["bog","applause","groan"],boat:["cheer","applause","groan"],
  salt:["cheer"],hill:["summit","ooh","groan"],oval:["cheer","applause","groan"],e24:["cheer","applause"],shop:["dynoclap"]};
const AMB={id:null,src:null,g:null,out:null,bufs:new Map(),bytes:{},n:0,stat:{fetched:0,errors:0}};
function ambLvl(){return S.ambVol==null?40:Math.max(0,Math.min(100,+S.ambVol||0));}
function ambCtx(){if(typeof soundReady==="undefined"||!soundReady||!S||!S.sound||typeof ENGINE_SOUND==="undefined"||!ENGINE_SOUND.sampleHost)return null;const h=ENGINE_SOUND.sampleHost();return h&&h.ctx||null;}
function ambOut(ctx){if(!AMB.out||AMB.out.context!==ctx){AMB.out=ctx.createGain();AMB.out.connect(ctx.destination);}AMB.out.gain.value=ambLvl()/100;return AMB.out;}
/* fetch (kept compressed) and decode (a few beds and the crowd clips kept decoded; a bed is ~3 MB decoded) */
function ambLoad(f){const ctx=ambCtx();if(!ctx)return Promise.resolve(null);
  if(AMB.bufs.has(f)){const b=AMB.bufs.get(f);AMB.bufs.delete(f);AMB.bufs.set(f,b);return Promise.resolve(b);}
  const got=AMB.bytes[f]||(AMB.bytes[f]=fetch(f).then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.arrayBuffer();}).then(ab=>{AMB.stat.fetched++;return ab;}));
  return got.then(ab=>new Promise((res,rej)=>{const p=ctx.decodeAudioData(ab.slice(0),res,rej);if(p&&p.catch)p.catch(rej);})).then(b=>{AMB.bufs.set(f,b);
    let beds=[...AMB.bufs.keys()].filter(k=>k.includes("/amb/"));while(beds.length>3){AMB.bufs.delete(beds.shift());}return b;})
    .catch(e=>{delete AMB.bytes[f];AMB.stat.errors++;if(console.debug)console.debug("[ambience] clip unavailable:",f,e&&e.message);return null;});}
function ambFile(id){return "sounds/amb/"+id+".mp3";}
function crowdFile(id){return "sounds/crowd/"+id+".mp3";}
/* where you are decides the bed: the event that is set up in Events, the shop everywhere else */
function ambWant(){if(!ambCtx()||!ambLvl()||document.hidden||!S.mode)return null;
  return curTab==="events"&&!evhubOn()?(AMB_FOR[S.env.testType]||null):"shop";}
function ambFade(g,to,t){const ctx=g.context,now=ctx.currentTime;try{g.gain.cancelScheduledValues(now);g.gain.setValueAtTime(g.gain.value,now);g.gain.linearRampToValueAtTime(to,now+t);}catch(e){g.gain.value=to;}}
function ambStop(t){const s=AMB.src,g=AMB.g;AMB.src=null;AMB.g=null;AMB.id=null;if(!s)return;
  if(g&&t){ambFade(g,0,t);setTimeout(()=>{try{s.stop();s.disconnect();g.disconnect();}catch(e){}},t*1000+80);}else{try{s.stop();s.disconnect();if(g)g.disconnect();}catch(e){}}}
function ambSync(){const want=ambWant();
  if(typeof ENGINE_SOUND!=="undefined"&&ENGINE_SOUND.holdAwake)ENGINE_SOUND.holdAwake(!!want);
  if(want===AMB.id&&(AMB.src||!want)){if(AMB.out)AMB.out.gain.value=ambLvl()/100;return;}
  if(!want){ambStop(0.8);return;}
  const n=++AMB.n;ambStop(1.5);AMB.id=want;
  ambLoad(ambFile(want)).then(b=>{const ctx=ambCtx();if(!b||!ctx||n!==AMB.n||ambWant()!==want)return;
    const s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=b;s.loop=true;
    const a=Math.min(AMB_ROLL,b.duration/4),e=Math.min(b.duration-0.01,a+AMB_LEN);s.loopStart=a;s.loopEnd=e;
    g.gain.value=0;s.connect(g);g.connect(ambOut(ctx));s.start(ctx.currentTime+0.02,a+Math.random()*(e-a)*0.9);ambFade(g,AMB_GAIN,1.5);AMB.src=s;AMB.g=g;});
  if(CROWD_FOR[want])CROWD_FOR[want].forEach(c=>ambLoad(crowdFile(c)));}
/* a crowd one-shot, a beat after the moment; at most two at once */
let crowdN=0;
function crowd(id,delay){const ctx=ambCtx();if(!ctx||!ambLvl()||!id)return;
  ambLoad(crowdFile(id)).then(b=>{const c=ambCtx();if(!b||!c||crowdN>=2)return;crowdN++;
    const s=c.createBufferSource(),g=c.createGain();s.buffer=b;g.gain.value=CROWD_GAIN*(0.9+Math.random()*0.2);s.playbackRate.value=0.96+Math.random()*0.08;
    s.connect(g);g.connect(ambOut(c));s.start(c.currentTime+(delay==null?0.6:delay));s.onended=()=>{crowdN--;try{s.disconnect();g.disconnect();}catch(e){}};});}
/* what the crowd makes of a finished run: each event's finish passes its own outcome */
function crowdAfter(ev,o){o=o||{};if(o.skip)return;let id=null;
  if(o.broke)id=ev==="hill"&&o.edge?"ooh":"groan";
  else if(ev==="drag")id=o.won===true?"cheer":o.won===false?(o.close?"ooh":"applause"):o.pb?"applause":null;
  else if(ev==="pull")id=o.full?"fullpull":"applause";
  else if(ev==="bog")id=o.cleared?"bog":"applause";
  else if(ev==="boat"||ev==="oval")id=o.won?"cheer":"applause";
  else if(ev==="salt")id=o.record?"cheer":null;
  else if(ev==="hill")id="summit";
  else if(ev==="e24")id=o.won?"cheer":o.classified?"applause":null;
  else if(ev==="dyno")id="dynoclap";
  crowd(id,o.delay);}
function ambUi(){const v=ambLvl();$("ambVol").value=v;$("ambLbl").textContent=v+"%";}
$("ambVol").addEventListener("input",e=>{S.ambVol=+e.target.value;$("ambLbl").textContent=S.ambVol+"%";ambSync();});
$("ambVol").addEventListener("change",save);
document.addEventListener("visibilitychange",()=>ambSync());
setInterval(ambSync,1000);
