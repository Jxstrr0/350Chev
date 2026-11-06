
/* ===================== SAVE CODES: Back up / Restore =====================
   One code holds everything this game keeps in the browser, so a player can move to another phone or browser, or keep
   a copy somewhere safe. All of it lives in localStorage on this device; nothing is ever sent anywhere.
     save    the current game ("pew2-save"), taken live with snapshot(). Settings (sound, theme, units, graphics) ride in it.
     slots   the 3 manual slots ("pew2-slot1" .. "pew2-slot3"), null for an empty one
     legacy  the Legacy record ("pew2-legacy", app/legacy.js), null if this device never had one
   Code = "PEW1:" + body + a 6-character checksum. body = that object as JSON -> UTF-8 bytes -> LZW (9..16-bit codes) ->
   base64url (A-Z a-z 0-9 - _ only), so it survives notes apps, email and chat. Same shape as Garage to Glory's GG1: codes.
   Restore checks everything before it writes anything: checksum, unpack, JSON, the shape of every save and a trial
   hydrate() of each one. Then buWrite() writes all five keys and puts the old values back if any write fails, so a bad
   paste can never leave a half-restored game.
   "PEW2:" already belongs to the older one-game codes (plain base64 JSON, decodeSave in app/state.js). Restore still reads
   those, so the next version of THIS format must be PEW3:, not PEW2:.
   UI: Shop tab -> Saves -> Back up / Restore (buttons #exportSave / #importSave, hooked up in app/career.js), plus the backup
   file buttons and the reminder at the end of this file.
   Tests: `node check-savecode.js` in the repo root. */
const BU_V=1,BU_PREFIX="PEW"+BU_V+":";
const BU_B64="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",BU_MAXCODES=65536;
const BU_MSG={
  empty:"Paste a backup code into the box first.",
  damaged:"That code is damaged or cut off. Copy the whole code again, from PEW1: right to the end, and paste it here.",
  newer:"That code was made by a newer version of the game. Reload the page to update, then try again.",
  other:"That's a save code from a different game. Prairie Engine Works backup codes start with \"PEW1:\".",
  notcode:"That doesn't look like a save code. Backup codes start with \"PEW1:\".",
  bad:"That code opened, but the save inside doesn't look right, so nothing was changed.",
  store:"This browser wouldn't let the game save (storage may be full or blocked), so nothing was changed.",
  busy:"Let the run finish first, then restore."
};
const buFail=k=>{const e=new Error(BU_MSG[k]);e.bu=k;return e;};   // an error with a message that's fine to show the player

/* ---- packing: bytes <-> base64url text ---- */
function buBits(n){let b=1;while(n>=2){n>>>=1;b++;}return b;}   // how many bits it takes to write n
/* LZW over bytes. Bits go MSB-first into 6-bit base64url characters and the tail is zero-padded. A code's width is the
   bit length of the largest code the reader could see next, so both sides always agree on it. */
function buZip(bytes){
  const out=[];let acc=0,nacc=0;
  const put=(v,w)=>{for(let i=w-1;i>=0;i--){acc=acc<<1|(v>>>i&1);if(++nacc===6){out.push(BU_B64[acc]);acc=0;nacc=0;}}};
  if(!bytes.length)return"";
  const dict=new Map();let next=256,cur=bytes[0];
  for(let i=1;i<bytes.length;i++){
    const key=cur*256+bytes[i],hit=dict.get(key);
    if(hit!==undefined){cur=hit;continue;}
    put(cur,buBits(next-1));
    if(next<BU_MAXCODES)dict.set(key,next++);
    cur=bytes[i];}
  put(cur,buBits(next-1));
  if(nacc)out.push(BU_B64[acc<<(6-nacc)]);
  return out.join("");}
function buUnzip(str){
  let pos=0;const total=str.length*6,out=[];
  const read=w=>{let v=0;for(let i=0;i<w;i++,pos++){const d=BU_B64.indexOf(str[pos/6|0]);if(d<0)throw buFail("damaged");v=v*2+(d>>(5-pos%6)&1);}return v;};
  if(total<8)return out;
  const prefix=[],suffix=[],first=[];for(let i=0;i<256;i++){prefix.push(-1);suffix.push(i);first.push(i);}
  let size=256;
  const emit=code=>{const at=out.length;while(code>=0){out.push(suffix[code]);code=prefix[code];}   // the bytes come out backwards
    for(let a=at,b=out.length-1;a<b;a++,b--){const t=out[a];out[a]=out[b];out[b]=t;}};
  let prev=read(8);emit(prev);
  for(;;){
    const w=buBits(Math.min(size,BU_MAXCODES-1));
    if(total-pos<w)break;   // what's left is padding
    const code=read(w);let fb;
    if(code<size)fb=first[code];
    else if(code===size)fb=first[prev];   // the code being defined right now (the classic LZW "KwKwK" case)
    else throw buFail("damaged");
    if(size<BU_MAXCODES){prefix.push(prev);suffix.push(fb);first.push(first[prev]);size++;}
    emit(code);prev=code;}
  return out;}
/* FNV-1a of the body, as 6 base64url characters: a missing, extra or changed character almost surely won't match */
function buSum(body){let h=2166136261;for(let i=0;i<body.length;i++){h^=body.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
  let s="";for(let i=0;i<6;i++){s+=BU_B64[h&63];h=Math.floor(h/64);}return s;}

/* ---- making a code ---- */
function buStored(k){try{const j=localStorage.getItem(k);if(!j)return null;const o=JSON.parse(j);return o&&typeof o==="object"&&!Array.isArray(o)?o:null;}catch(e){return null;}}
function buMake(){const slots=[];for(let i=1;i<=SLOTS;i++)slots.push(buStored(slotKey(i)));
  return{v:BU_V,at:Date.now(),ver:VERSION,save:snapshot(),slots,legacy:buStored(LG_KEY)};}
function buCode(d){const body=buZip(new TextEncoder().encode(JSON.stringify(d||buMake())));return BU_PREFIX+body+buSum(body);}

/* ---- checking a save before anything is written ---- */
const buObj=o=>!!o&&typeof o==="object"&&!Array.isArray(o);
const buNum=v=>typeof v==="number"&&isFinite(v);
function buSaveOk(o){
  if(!buObj(o)||!buObj(o.cfg))return false;
  if("env" in o&&!buObj(o.env))return false;
  if("blueprints" in o&&!Array.isArray(o.blueprints))return false;
  if(o.mode!=null&&o.mode!=="career"&&o.mode!=="sandbox"&&o.mode!=="pit")return false;   // "pit": a Pit Crew game from 1.76.31-32, which loads as a career
  if("pit" in o&&o.pit!=null&&!buObj(o.pit))return false;
  if("career" in o){const c=o.career;if(!buObj(c))return false;
    if("log" in c&&!Array.isArray(c.log))return false;if("pc" in c&&c.pc!=null&&!buObj(c.pc))return false;
    for(const k of ["owned","staff","rnd","unlocks","prestige","goals"])if(k in c&&!buObj(c[k]))return false;
    for(const k of ["cash","rep","week","loan"])if(k in c&&!buNum(c[k]))return false;}
  return buTry(o);}
/* load a copy the way the game would (hydrate), then put the running game back exactly as it was */
function buTry(o){const keepS=S,keepSu=suC;let ok=false;
  try{ok=hydrate(JSON.parse(JSON.stringify(o)))===true;}catch(e){ok=false;}
  finally{S=keepS;suC=keepSu;}
  return ok;}
function buLegacyOk(r){return buObj(r)&&["pts","total","resets"].every(k=>!(k in r)||(buNum(r[k])&&r[k]>=0))
  &&["best","perk","pick"].every(k=>!(k in r)||buObj(r[k]))&&(!("pending" in r)||typeof r.pending==="boolean");}
function buFullOk(d){return buObj(d)&&d.v===BU_V&&buSaveOk(d.save)&&Array.isArray(d.slots)&&d.slots.length<=SLOTS
  &&d.slots.every(o=>o===null||buSaveOk(o))&&(d.legacy==null||buLegacyOk(d.legacy));}

/* ---- reading a code: {kind:"full",data} for a PEW1 backup, {kind:"one",save} for an older PEW2 one-game code.
   Spaces, line breaks and text around the code are fine. Throws buFail(...) with a message for the player. ---- */
function buRead(text){
  const s=String(text==null?"":text).replace(/[\s\u200B-\u200D\u2060\uFEFF]+/g,"");
  if(!s)throw buFail("empty");
  const m=/PEW(\d+):/.exec(s);
  if(!m){
    if(/(^|[^A-Za-z0-9])[A-Za-z]{2,8}\d+:[A-Za-z0-9_-]/.test(s))throw buFail("other");   // e.g. GG1:... from another game
    let o=null;try{o=decodeSave(s);}catch(e){}   // an old one-game code pasted without its "PEW2:"
    if(!o)throw buFail("notcode");
    if(!buSaveOk(o))throw buFail("bad");
    return{kind:"one",save:o};}
  const n=+m[1];
  if(n===2){let o;try{o=decodeSave(s.slice(m.index));}catch(e){throw buFail("damaged");}
    if(!buSaveOk(o))throw buFail("bad");
    return{kind:"one",save:o};}
  if(n!==BU_V)throw buFail(n>BU_V?"newer":"notcode");
  const c=s.slice(m.index+m[0].length).replace(/[^A-Za-z0-9_-].*$/,"");   // drop quotes or punctuation pasted after it
  if(c.length<7)throw buFail("damaged");
  const body=c.slice(0,-6);
  if(buSum(body)!==c.slice(-6))throw buFail("damaged");
  let d;try{d=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(new Uint8Array(buUnzip(body))));}catch(e){throw buFail("damaged");}
  if(!buFullOk(d))throw buFail("bad");
  return{kind:"full",data:d};}

/* ---- writing a checked backup: all five keys, or none of them ---- */
function buWrite(d){
  const keys=[["pew2-save",d.save]];for(let i=1;i<=SLOTS;i++)keys.push([slotKey(i),d.slots[i-1]||null]);keys.push([LG_KEY,d.legacy||null]);
  const old=[];
  try{for(const [k] of keys)old.push([k,localStorage.getItem(k)]);}catch(e){return false;}
  try{for(const [k,v] of keys){if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,JSON.stringify(v));}return true;}
  catch(e){   // put the old values back: clear all five first, so a full storage has room for what fitted before
    try{for(const [k] of old)localStorage.removeItem(k);for(const [k,v] of old)if(v!=null)localStorage.setItem(k,v);}catch(_){}
    return false;}}

/* ---- the two sheets ---- */
function buSheet(title,html){$("sheetTitle").textContent=title;$("sheetBody").innerHTML=html;$("sheet").classList.add("on");$("scrim").classList.add("on");$("sheetBody").scrollTop=0;}
function buSelect(ta){try{ta.select();ta.setSelectionRange(0,ta.value.length);}catch(e){}}
async function buCopy(ta){
  try{await navigator.clipboard.writeText(ta.value);buMarkBackup();toast("Copied. Paste it somewhere safe.");return;}catch(e){}   // no clipboard access: select it instead
  ta.focus();buSelect(ta);let ok=false;try{ok=document.execCommand("copy");}catch(e){}
  if(ok)buMarkBackup();
  toast(ok?"Copied. Paste it somewhere safe.":"Code selected. Long-press it and tap Copy.");}
function buBackupOpen(){let code="";try{code=buCode();}catch(e){}
  if(!code){toast("Couldn't make a backup code on this device");return;}
  buSheet("Back up",`<p class="hint" style="margin-top:0">This code is your whole game: current game, all 3 save slots, Legacy points and settings. Keep it in your notes, then paste it into <b>Restore</b> on any phone or browser.</p>
<textarea class="code" id="codeOut" readonly spellcheck="false" aria-label="Your backup code"></textarea>
<p class="hint bucount">${code.length.toLocaleString("en-CA")} characters, starting with ${BU_PREFIX}</p>
<div class="row"><button class="btn pri" id="copyCode" style="flex:1">Copy code</button></div>`);
  const ta=$("codeOut");ta.value=code;ta.addEventListener("focus",()=>buSelect(ta));
  $("copyCode").addEventListener("click",()=>buCopy(ta));$("copyCode").focus({preventScroll:true});}
function buRestoreOpen(){
  buSheet("Restore",`<p class="hint" style="margin-top:0">Paste a backup code (it starts with ${BU_PREFIX}). Restoring replaces your current game, all 3 save slots and your Legacy points on this device.</p>
<textarea class="code" id="codeIn" placeholder="${BU_PREFIX}…" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off" aria-label="Backup code to restore" aria-describedby="codeErr"></textarea>
<p class="hint buerr" id="codeErr" role="alert"></p>
<div class="row"><button class="btn pri" id="doImport" style="flex:1">Restore</button></div>`);
  const ta=$("codeIn"),err=$("codeErr");
  ta.addEventListener("input",()=>{err.textContent="";});
  ta.addEventListener("keydown",e=>{if(e.key==="Escape"){closeSheet();e.preventDefault();}});
  $("doImport").addEventListener("click",()=>buRestore(ta.value,err));
  if(window.matchMedia&&matchMedia("(hover:hover) and (pointer:fine)").matches)ta.focus({preventScroll:true});}   // no surprise keyboard on phones
function buWhat(o){const c=o.career||{};return o.mode==="career"?`Career, week ${c.week||1}, ${fmt$(c.cash||0)} cash`:"Test cell";}
function buAsk(d){const when=buNum(d.at)?new Date(d.at).toLocaleString("en-CA",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}):"";
  const n=d.slots.filter(Boolean).length,lg=d.legacy&&d.legacy.resets?`, ${d.legacy.pts|0} Legacy point${(d.legacy.pts|0)===1?"":"s"}`:"";
  return `Restore this backup?\n\n${when?"Made "+when+"\n":""}${buWhat(d.save)}${lg}\n${n} of ${SLOTS} save slots used\n\nIt replaces your current game, all ${SLOTS} save slots and your Legacy points on this device.`;}
function buRestore(text,err){
  const say=k=>{err.textContent=BU_MSG[k]||BU_MSG.damaged;err.scrollIntoView&&err.scrollIntoView({block:"nearest"});};
  err.textContent="";
  if(testing){say("busy");return;}
  let r;try{r=buRead(text);}catch(e){say(e&&e.bu||"damaged");return;}
  {const o=r.kind==="one"?r.save:r.data.save,bk=S&&buNum(S.bkAt)?S.bkAt:0;if(bk>(buNum(o.bkAt)?o.bkAt:0))o.bkAt=bk;}   // this device's last-backup time survives a restore
  if(r.kind==="one"){
    if(!confirm("This is an older save code that holds one game, not a full backup.\n\nLoad it as your current game? Your save slots and Legacy points stay as they are."))return;
    closeSheet();applyLoaded(r.save,"Save code loaded");buPersist();return;}
  if(!confirm(buAsk(r.data)))return;
  if(!buWrite(r.data)){say("store");return;}
  LG=null;   // the Legacy record is cached in memory (app/legacy.js): read the restored one next time
  closeSheet();applyLoaded(r.data.save,"Backup restored");buPersist();}

/* ===================== SAVE SAFETY: backup files, keep-my-storage, the backup reminder (1.76.66) =====================
   Every Longlight game lives at jxstrr0.github.io, so they share one browser storage pot. When a phone runs short of
   space the browser may clear all of it at once. Three things guard against that:
     buPersist()   asks the browser to keep this site's storage (navigator.storage.persist). Once per page load, only after a
                   save write with a game going (save() in app/state.js calls it) or after a backup/restore. Firefox may ask
                   the player; Chrome and Safari decide quietly. Missing API: nothing happens.
     buFileSave()  the same PEW1: code as Back up, in a text file. Share sheet with the file where the browser can
                   (iPhone: "Save to Files", also from the Home Screen app), else a normal download.
     buFileLoad()  reads a backup file and runs it through the Restore sheet, so the same checks and the same confirm happen.
   S.bkAt = when the last backup was taken (a code copied or a file saved). It rides in the save (pew2-save), so no new
   localStorage key; a restore keeps whichever time is newer. buRemind() shows a quiet bar (once per session, at a calm
   moment) when there is real progress and no backup in BU_REMIND_DAYS days. UI: Settings › Save (buttons wired in app/career.js). */
const BU_REMIND_DAYS=14,BU_FILE_MAX=4e6;
let buPersistAsked=false,buReminded=false;
function buPersist(){if(buPersistAsked)return;buPersistAsked=true;
  try{const st=typeof navigator!=="undefined"&&navigator.storage;if(!st||!st.persist||!st.persisted)return;
    st.persisted().then(p=>p||st.persist()).then(()=>buStoreLine(),()=>{});}catch(e){}}
/* the one status line in Settings › Save: is the storage kept, and when was the last backup */
function buStoreLine(){const el=typeof document!=="undefined"&&document.getElementById("bkStore");if(!el)return;
  const last=S&&buNum(S.bkAt)?"Last backup "+new Date(S.bkAt).toLocaleDateString("en-CA",{month:"short",day:"numeric"})+".":"No backup yet.";
  let st=null;try{st=navigator.storage;}catch(e){}
  if(!st||!st.persisted){el.textContent=last;el.hidden=false;return;}
  st.persisted().then(p=>{el.textContent=(p?"Storage: kept on this device. ":"Storage: the browser may clear saves if the phone runs low. Keep a backup file. ")+last;el.hidden=false;},
    ()=>{el.textContent=last;el.hidden=false;});}
function buMarkBackup(){if(!S)return;S.bkAt=Date.now();try{save();}catch(e){}buPersist();buStoreLine();buRemindHide();}
function buFileName(){const d=new Date(),p=n=>String(n).padStart(2,"0");return`prairie-engine-works-backup-${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}.txt`;}
async function buFileSave(){let code="";try{code=buCode();}catch(e){}
  if(!code){toast("Couldn't make a backup on this device");return;}
  const name=buFileName(),text=code+"\n";
  let file=null;try{file=new File([text],name,{type:"text/plain"});}catch(e){}
  if(file&&navigator.canShare&&navigator.share){let can=false;try{can=navigator.canShare({files:[file]});}catch(e){}
    if(can){try{await navigator.share({files:[file]});buMarkBackup();toast("Backup file saved");return;}
      catch(e){if(e&&e.name==="AbortError")return;}}}   // cancelled: not saved. Any other refusal falls back to a download
  try{const url=URL.createObjectURL(new Blob([text],{type:"text/plain"})),a=document.createElement("a");
    a.href=url;a.download=name;a.style.display="none";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
    buMarkBackup();toast("Backup file saved: "+name);}
  catch(e){toast("Couldn't save a file here. Use Back up and copy the code.");}}
function buFileLoad(){if(testing){toast("Let the run finish first");return;}const inp=$("bkFileIn");if(inp){inp.value="";inp.click();}}
async function buFileRead(inp){const f=inp.files&&inp.files[0];inp.value="";if(!f)return;
  let text="";
  if(f.size>BU_FILE_MAX)text="\u0000";   // far too big to be a backup: the Restore sheet says it isn't a code
  else{try{text=await f.text();}catch(e){text=await new Promise(res=>{try{const r=new FileReader();r.onload=()=>res(String(r.result||""));r.onerror=()=>res("");r.readAsText(f);}catch(_){res("");}});}}
  text=String(text).trim();
  buRestoreOpen();$("codeIn").value=text;
  buRestore(text||"\u0000",$("codeErr"));}
/* the reminder: real progress (a career past week 3, or a few saved blueprints) and no backup in BU_REMIND_DAYS days.
   Once per session, never over an event, a run, a sheet, Settings, a tour or the intro; it tries again later if busy. */
function buRemindDue(){if(!S||!S.mode)return false;
  const prog=(S.mode==="career"&&S.career&&(+S.career.week||1)>=4)||(Array.isArray(S.blueprints)&&S.blueprints.length>=2);
  return prog&&(!buNum(S.bkAt)||Date.now()-S.bkAt>=BU_REMIND_DAYS*864e5);}
function buBusy(){const h=document.documentElement.classList;
  return testing||h.contains("onevent")||h.contains("photo")||h.contains("troom")||$("sheet").classList.contains("on")||(typeof setOn==="function"&&setOn())
    ||$("intro").style.display!=="none"||(typeof tourStep!=="undefined"&&tourStep>=0)||(typeof ff!=="undefined"&&!!ff)||(typeof LS!=="undefined"&&!!LS)
    ||!!document.querySelector("#pwaBar.on,#rcard:not([hidden]),#troom:not([hidden])");}
function buRemind(tries){if(buReminded||!buRemindDue())return;
  if(buBusy()){if((tries|0)<20)setTimeout(()=>buRemind((tries|0)+1),30000);return;}
  buReminded=true;
  let bar=$("bkBar");
  if(!bar){bar=document.createElement("div");bar.id="bkBar";bar.setAttribute("role","status");
    bar.innerHTML='<span id="bkBarTxt"></span><button type="button" class="btn sm pri" id="bkBarGo">Saves</button><button type="button" class="pwalater" id="bkBarLater" aria-label="Dismiss the backup reminder">Later</button>';
    ($("app")||document.body).appendChild(bar);
    $("bkBarLater").addEventListener("click",buRemindHide);
    $("bkBarGo").addEventListener("click",()=>{buRemindHide();if(buBusy())return;try{renderShop();}catch(e){}setOpen();const f=$("set-save");if(f){f.open=true;setTimeout(()=>f.scrollIntoView({block:"start"}),60);}buStoreLine();});}
  const d=buNum(S.bkAt)?Math.floor((Date.now()-S.bkAt)/864e5):-1;
  $("bkBarTxt").textContent=d<0?"No backup yet. Keep a copy off this phone.":`Last backup ${d} days ago. Time for a fresh one.`;
  requestAnimationFrame(()=>bar.classList.add("on"));
  clearTimeout(buRemind.t);buRemind.t=setTimeout(buRemindHide,20000);}
function buRemindHide(){const b=typeof document!=="undefined"&&document.getElementById("bkBar");if(b)b.classList.remove("on");}
