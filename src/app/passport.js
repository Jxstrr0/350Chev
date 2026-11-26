/* ============================ LONGLIGHT PASSPORT (studio piece) ============================
   The Longlight Passport (https://longlight.games/passport) collects a small "stamp" from every Longlight game: the
   game's name, version and a few headline numbers. This file builds Prairie Engine Works' stamp from the save and keeps
   it under its own localStorage key, `pew2-passport`, where the bridge page (`passport-stamp.html` at the repo root)
   can read it when the Passport opens that page in a hidden frame. The "Add to Longlight Passport" button in
   Settings > Save sends the same stamp by link instead.
   The stamp is not a save key: it is rebuilt from the save on every save(), so it stays out of buMake / buWrite and the
   backups. It holds numbers only (never a name the player typed, a seed or the save itself).
   `best_hp` must stay: the studio's Thousand Horses badge reads it (in hp). `career_complete` is set once a shop has
   been sold into the Legacy record.
   Uses LonglightPassport from app/passport-stamp.js (the studio kit, copied in unchanged).
   Hooks elsewhere: save() (app/state.js) -> ppSync. */
const PP_KEY="pew2-passport";
let ppLast="";
/* a number from the save, or 0 when it isn't a real, positive one */
function ppNum(v){v=+v;return isFinite(v)&&v>0?v:0;}
/* the fastest quarter-mile pass in a records table (both modes keep their best first in .top) */
function ppEt(R){const t=R&&Array.isArray(R.top)&&R.top[0];return t?ppNum(t.et):0;}
/* the stamp for the game as it stands now, or null before the first dyno pull */
function ppMake(){
  if(typeof LonglightPassport==="undefined"||!S)return null;
  const c=S.career&&typeof S.career==="object"?S.career:{},sb=S.sbRecords&&typeof S.sbRecords==="object"?S.sbRecords:{},cr=c.rec&&typeof c.rec==="object"?c.rec:{};
  const lg=typeof lgRec==="function"?lgRec():{resets:0,best:{}},pc=c.pc&&typeof c.pc==="object"?c.pc:{};
  /* best engine, any mode: the test cell's record, the career's certified best and record, and every shop sold into Legacy */
  const hp=Math.round(Math.max(ppNum(sb.hp&&sb.hp.v),ppNum(c.bestHp),ppNum(cr.hp&&cr.hp.v),ppNum(lg.best&&lg.best.hp)));
  if(!hp)return null;
  const ets=[ppEt(sb),ppEt(cr),ppNum(c.bestEt)].filter(x=>x>0),resets=Math.floor(ppNum(lg.resets)),week=Math.floor(ppNum(c.week))||1;
  const stats=[{id:"best_hp",label:"Best engine",value:hp,unit:"hp"}];
  if(ets.length)stats.push({id:"best_et",label:"Best quarter-mile",value:Math.round(Math.min.apply(null,ets)*1000)/1000,unit:"s"});
  const more=[["seasons","Team seasons supplied",pc.seasons],["titles","Team titles",pc.titles],["rep","Reputation",c.rep],["shops_sold","Shops sold",resets]];
  for(const m of more){const v=Math.floor(ppNum(m[2]));if(v)stats.push({id:m[0],label:m[1],value:v});}
  const headline=resets?`Legacy ${resets}, week ${week}`:week>1?`Career, week ${week}`:"Test cell";
  return LonglightPassport.make({game:"pew",ver:VERSION,headline,stats:stats.slice(0,6),flags:resets?["career_complete"]:[]});
}
/* called by save(): keep the stamp for the bridge page, writing only when it changed */
function ppSync(){try{const s=ppMake();if(!s)return;const j=JSON.stringify(s);if(j===ppLast)return;if(LonglightPassport.save(PP_KEY,s))ppLast=j;}catch(e){}}
/* the button: open the Passport with the stamp, straight from the tap (the browser only allows a new tab from one) */
(()=>{const b=$("ppAdd");if(!b)return;
  if(typeof LonglightPassport==="undefined"||!LonglightPassport.supported()){const w=$("ppBlock");if(w)w.hidden=true;return;}
  b.onclick=()=>{const s=ppMake();if(!s){toast("Pull an engine on the dyno first");return;}ppSync();
    LonglightPassport.open(s).catch(()=>toast("Couldn't open the Passport"));};})();
