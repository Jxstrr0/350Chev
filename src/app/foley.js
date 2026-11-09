/* ---- foley: workshop and vehicle one-shots ----
   Ten short clips in sounds/fx/ generated with ElevenLabs sound effects for Longlight Interactive (credits in sounds/CREDITS.md):
   impact wrench, ratchet, socket click and torque-wrench click when a part changes on the Build tab; the dyno rollers spinning
   up and down around a dyno test; the drag (and salt) parachute; gravel spray when a hill climb car slides wide or goes off;
   the rooster tail when a drag boat leaves; mud thrown at the mud bog's big moments, on top of the synth's mudslap.
   They reuse the ambience fetch/decode cache (ambLoad in app/ambience.js), so nothing is fetched until sound is on, and only
   the clips for the tab or event you are on are fetched ahead. They follow the main Sound volume (S.vol), not the Ambience &
   crowd slider: they belong with the engine. At most two play at once; each clip has a minimum gap so taps and slides don't
   machine-gun (the four workshop tools share one gap), and a small random pitch and level change so repeats don't sound pasted. */
const FOLEY={impact:{g:0.85,gap:250,grp:"shop"},ratchet:{g:0.8,gap:250,grp:"shop"},socket:{g:0.8,gap:250,grp:"shop"},torque:{g:0.85,gap:250,grp:"shop"},
  dynoup:{g:0.5,gap:1000},dynodown:{g:0.5,gap:1000},chute:{g:1,gap:1500},gravel:{g:0.95,gap:900},rooster:{g:0.9,gap:2000},mud:{g:0.7,gap:450}};
const FOLEY_SHOP=["impact","ratchet","socket","torque"],FOLEY_DYNO=["dynoup","dynodown"];
const FOLEY_FOR={drag:["chute"],bracket:["chute"],salt:["chute"],hill:["gravel"],boat:["rooster"],bog:["mud"]};
const FX={out:null,n:0,last:{},live:[],want:""};
function foleyFile(id){return "sounds/fx/"+id+".mp3";}
function foleyLvl(){return S.vol==null?1:Math.max(0,Math.min(100,+S.vol||0))/100;}
function foleyOut(ctx){if(!FX.out||FX.out.context!==ctx){FX.out=ctx.createGain();FX.out.connect(ctx.destination);}FX.out.gain.value=foleyLvl();return FX.out;}
/* play one: opts.delay (s), opts.gain (×), opts.stop (an id whose playing copy fades out first, e.g. the spin-up under the spin-down) */
function foley(id,opts){const ctx=ambCtx(),d=FOLEY[id];if(!ctx||!d||!foleyLvl())return;opts=opts||{};
  const now=performance.now(),gk=d.grp||id;if(now-(FX.last[gk]||0)<d.gap)return;FX.last[gk]=now;
  if(opts.stop)FX.live.filter(v=>v.id===opts.stop).forEach(v=>{try{const t=v.g.context.currentTime;v.g.gain.setValueAtTime(v.g.gain.value,t);v.g.gain.linearRampToValueAtTime(0,t+0.3);v.s.stop(t+0.35);}catch(e){}});
  ambLoad(foleyFile(id)).then(b=>{const c=ambCtx();if(!b||!c||FX.n>=2)return;FX.n++;
    const s=c.createBufferSource(),g=c.createGain(),v={id,s,g};s.buffer=b;g.gain.value=d.g*(opts.gain||1)*(0.88+Math.random()*0.24);s.playbackRate.value=0.95+Math.random()*0.1;
    s.connect(g);g.connect(foleyOut(c));s.start(c.currentTime+(opts.delay||0));FX.live.push(v);
    s.onended=()=>{FX.n--;FX.live=FX.live.filter(x=>x!==v);try{s.disconnect();g.disconnect();}catch(e){}};});}
/* which tool a Build change sounds like: a fastener gets the torque wrench, a big swap the impact gun, a slider the socket,
   machining and everything else the ratchet */
const FOLEY_TORQUE=new Set(["rodBolts","studs","gasket","bearings","damper","sidePlate"]);
const FOLEY_IMPACT=new Set(["layout","cycle","blockMat","head","headMat","crank","asp","turboSize","turbine","intake","induct","fuel","exhaust","pipe","cooling","oilSystem","ic","rotHousing","nitrous"]);
const FOLEY_MACHINE=new Set(["bore","stroke","rodRatio","deck","cr"]);
function foleyPart(k,slider){if(!k||curTab!=="build")return;
  foley(FOLEY_TORQUE.has(k)?"torque":FOLEY_IMPACT.has(k)?"impact":slider&&!FOLEY_MACHINE.has(k)?"socket":"ratchet");}
/* fetch ahead what this tab or event can play (once per change of place) */
function foleySync(){if(!ambCtx()||!foleyLvl()||document.hidden)return;
  const want=curTab==="build"?FOLEY_SHOP:curTab==="test"?FOLEY_DYNO:curTab==="events"?(FOLEY_FOR[S.env&&S.env.testType]||[]):[];
  const key=want.join();if(key===FX.want)return;FX.want=key;want.forEach(id=>ambLoad(foleyFile(id)));}
setInterval(foleySync,1000);
