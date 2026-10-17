/* ===================== PHOTO MODE + BUILD SHEET =====================
   Photo mode (html.photo): the view goes full screen, the panels fold away and the 3D camera is free (vis/photo.js does the camera, lights and
   backdrop; this file is the controls, the gestures, the capture and the share/download). A dock holds light presets, backdrops and a few looks
   (vignette, caption, turntable, 2x). Venue scenes (strip, pull, salt, bog, boats, road, hill) take the camera as an offset on their own director;
   light there is an exposure change plus a colour grade laid over the picture. Esc or the X leaves.
   The build sheet is a 1200x1600 spec card: the engine in a studio, peak numbers, the hp / torque curve, key parts, best results. It works from
   the VIEW tray too, with no photo mode needed. Both end in a PNG: saved with a download link, or the phone's share sheet. No sim is touched. */
const PHO={on:false,scene:"",light:"asis",back:"garage",vig:true,cap:false,big:true,spin:false,open:true,busy:false,poll:0,from:null};
const PHO_ICON={cam:'<svg viewBox="0 0 24 24"><path d="M4 8h3l1.6-2.4h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/></svg>',
  doc:'<svg viewBox="0 0 24 24"><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 12h6M10 16h6"/></svg>',x:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>'};
/* venue "light": a colour laid over the frame (CSS blend in the preview, the same canvas blend in the saved picture) */
const PHO_GRADE={golden:{col:"rgba(255,150,60,.42)",op:"soft-light"},night:{col:"rgba(28,52,140,.55)",op:"multiply"}};
const phoSlug=s=>String(s||"engine").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,32)||"engine";
const phoCanShare=()=>{try{return !!(navigator.share&&navigator.canShare&&navigator.canShare({files:[new File([new Blob(["x"])],"a.png",{type:"image/png"})]}));}catch(e){return false;}};
function phoBuild(){
  const v=$("view");if(!v||$("phUi"))return;
  const chips=(k,a)=>`<div class="phchips" data-ph="${k}">${a.map(([x,t])=>`<button type="button" data-v="${x}" aria-pressed="false">${t}</button>`).join("")}</div>`;
  const ui=document.createElement("div");ui.id="phUi";ui.hidden=true;
  ui.innerHTML=`<div id="phPad" aria-hidden="true"></div><div id="phGrade"></div><div id="phVig"></div>
    <div class="phtop"><div class="phh">Photo mode<small id="phHint"></small></div><button type="button" class="phx" id="phX" aria-label="Exit photo mode">${PHO_ICON.x}</button></div>
    <div class="phdock" role="group" aria-label="Photo controls"><div class="phbody" id="phBody">
      <div class="phrow"><span class="phl">Light</span>${chips("light",[["asis","As is"],["studio","Studio"],["golden","Golden"],["night","Night"]])}</div>
      <div class="phrow" id="phRowBack"><span class="phl">Backdrop</span>${chips("back",[["garage","Garage"],["grey","Grey"],["white","White"],["black","Black"],["dusk","Dusk"]])}</div>
      <div class="phrow"><span class="phl">Look</span><div class="phchips" data-ph="opt"><button type="button" data-o="vig" aria-pressed="true">Vignette</button><button type="button" data-o="cap" aria-pressed="false">Caption</button><button type="button" data-o="spin" id="phSpin" aria-pressed="false">Spin</button><button type="button" data-o="big" aria-pressed="true">2×</button></div></div>
    </div><div class="phact"><button type="button" class="phpri" id="phShot">Save photo</button><button type="button" id="phShare" hidden>Share</button><button type="button" id="phSheetBtn">Build sheet</button><button type="button" id="phMore" aria-expanded="true" aria-controls="phBody">Look ▾</button></div></div>`;
  v.appendChild(ui);
  const fab=document.createElement("button");fab.type="button";fab.id="phBtn";fab.setAttribute("aria-label","Photo mode");fab.innerHTML=PHO_ICON.cam;v.appendChild(fab);
  const tr=$("viewTray");
  if(tr){const mk=(id,ic,t)=>{const b=document.createElement("button");b.type="button";b.id=id;b.className="act";b.innerHTML=ic+"<span>"+t+"</span>";tr.appendChild(b);};
    mk("phTray",PHO_ICON.cam,"Photo mode");mk("phSheetTray",PHO_ICON.doc,"Build sheet");}
  const sh=document.createElement("div");sh.id="phSheet";sh.hidden=true;sh.setAttribute("role","dialog");sh.setAttribute("aria-modal","true");sh.setAttribute("aria-label","Build sheet");
  sh.innerHTML=`<div id="phSheetBox"><img id="phSheetImg" alt="Build sheet card"><p id="phSheetNote"></p><div class="phsb"><button type="button" class="phpri" id="phSheetSave">Download PNG</button><button type="button" id="phSheetShare" hidden>Share</button><button type="button" id="phSheetClose">Close</button></div></div>`;
  document.body.appendChild(sh);
  phoWire();
}
function phoSync(){
  const st=ENGINE_VIS.photoState?ENGINE_VIS.photoState():{scene:""};PHO.scene=st.scene;const venue=!!st.scene&&st.scene!=="x";
  document.querySelectorAll('#phUi [data-ph="light"] button').forEach(b=>{const on=b.dataset.v===PHO.light;b.classList.toggle("on",on);b.setAttribute("aria-pressed",on);});
  document.querySelectorAll('#phUi [data-ph="back"] button').forEach(b=>{const on=b.dataset.v===PHO.back;b.classList.toggle("on",on);b.setAttribute("aria-pressed",on);});
  const o={vig:PHO.vig,cap:PHO.cap,spin:PHO.spin,big:PHO.big};
  document.querySelectorAll('#phUi [data-o]').forEach(b=>{const on=!!o[b.dataset.o];b.classList.toggle("on",on);b.setAttribute("aria-pressed",on);});
  $("phRowBack").hidden=venue;$("phSpin").hidden=venue;
  $("phHint").textContent=venue?"Drag to look around the action · pinch or scroll to zoom · two fingers slide · double-tap resets":"Drag to orbit · pinch or scroll to zoom · two fingers slide · double-tap resets";
  $("phVig").style.display=PHO.vig?"":"none";
  const g=venue?PHO_GRADE[PHO.light]:null,ge=$("phGrade");ge.style.background=g?g.col:"none";ge.style.mixBlendMode=g?g.op:"normal";
  $("phMore").setAttribute("aria-expanded",PHO.open);$("phMore").textContent=PHO.open?"Look ▾":"Look ▴";$("phBody").hidden=!PHO.open;
  $("phShare").hidden=!phoCanShare();
}
function phoOpen(){
  if(PHO.on||!ENGINE_VIS.photoStart)return;
  if(typeof TR!=="undefined"&&TR.open){toast("Leave the trophy room first");return;}
  const r=ENGINE_VIS.photoStart();if(!r.ok){toast("Photo mode isn't available in this view");return;}
  PHO.on=true;PHO.from=document.activeElement;PHO.light="asis";PHO.back="garage";PHO.spin=false;
  if(!$("viewTray").hidden)viewTray(false);
  document.documentElement.classList.add("photo");$("phUi").hidden=false;$("phUi").classList.remove("hush");
  window.dispatchEvent(new Event("resize"));ENGINE_VIS.resize();
  phoSync();setTimeout(()=>$("phUi").classList.add("hush"),60);
  PHO.poll=setInterval(phoSync,900);
  $("phShot").focus({preventScroll:true});
}
function phoClose(){
  if(!PHO.on)return;
  PHO.on=false;clearInterval(PHO.poll);phoSheetClose();
  document.documentElement.classList.remove("photo");$("phUi").hidden=true;
  ENGINE_VIS.resize();ENGINE_VIS.photoStop();   // the view's size back first, then the camera and lights the way they were
  window.dispatchEvent(new Event("resize"));
  const f=PHO.from;PHO.from=null;try{if(f&&f.isConnected&&f.offsetParent&&f.focus)f.focus({preventScroll:true});else $("viewBtn").focus({preventScroll:true});}catch(e){}
}
function phoGrade(){const g=PHO.scene&&PHO.scene!=="x"?PHO_GRADE[PHO.light]:null;return g;}
/* the saved picture: the frame, the grade, the vignette, the caption */
function phoCompose(cv){
  const w=cv.width,h=cv.height,out=document.createElement("canvas");out.width=w;out.height=h;const x=out.getContext("2d");x.drawImage(cv,0,0);
  const g=phoGrade();if(g){x.save();x.globalCompositeOperation=g.op;x.fillStyle=g.col;x.fillRect(0,0,w,h);x.restore();}
  if(PHO.vig){x.save();x.translate(w/2,h/2);x.scale(w/2*Math.SQRT2,h/2*Math.SQRT2);const gr=x.createRadialGradient(0,0,0,0,0,1);gr.addColorStop(0,"rgba(0,0,0,0)");gr.addColorStop(.52,"rgba(0,0,0,0)");gr.addColorStop(1,"rgba(0,0,0,.55)");x.fillStyle=gr;x.fillRect(-1,-1,2,2);x.restore();}
  if(PHO.cap){const u=Math.max(1,Math.round(Math.min(w,h)/900*10)),pad=u*3.2;x.save();x.textBaseline="alphabetic";x.shadowColor="rgba(0,0,0,.7)";x.shadowBlur=u*1.5;
    x.fillStyle="rgba(255,255,255,.92)";x.font=`700 ${u*2.6}px "Chakra Petch","Barlow Condensed","Arial Narrow",sans-serif`;x.fillText(phoFit(x,engineName().toUpperCase(),w-pad*2),pad,h-pad-u*2.4);
    x.fillStyle="rgba(255,255,255,.7)";x.font=`500 ${u*1.7}px "IBM Plex Mono",Menlo,Consolas,monospace`;x.fillText("PRAIRIE ENGINE WORKS",pad,h-pad);x.restore();}
  return out;
}
function phoFit(x,s,max){s=String(s==null?"":s);while(s.length>3&&x.measureText(s).width>max)s=s.slice(0,-2)+"…";return s;}
/* a canvas to a file: the host's download service, the phone's share sheet when asked, or a download link */
async function phoSave(c,fn,title,share){
  const blob=await new Promise(r=>c.toBlob(r,"image/png"));if(!blob){toast("Couldn't make the picture here");return false;}
  const dl=window.claude&&window.claude.use?await window.claude.use("downloads"):null;
  if(dl){try{await dl.save({filename:fn,data:blob});toast("Picture saved");return true;}catch(e){if(e&&e.code!=="declined")toast("Couldn't save the picture here");return false;}}
  if(share){const file=new File([blob],fn,{type:"image/png"});
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title});return true;}catch(e){if(e&&e.name==="AbortError")return false;}}}
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=fn;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),8000);toast("Picture saved");return true;
}
async function phoShot(share){
  if(PHO.busy||!PHO.on)return;PHO.busy=true;const b=$(share?"phShare":"phShot");b.disabled=true;
  try{await new Promise(r=>requestAnimationFrame(r));
    const cv=ENGINE_VIS.photoGrab(PHO.big?2:1);if(!cv){toast("Nothing to photograph in this view");return;}
    const out=phoCompose(cv),st=new Date().toISOString().slice(0,16).replace(/[-:T]/g,"");
    await phoSave(out,`prairie-${phoSlug(engineName())}-${PHO.scene&&PHO.scene!=="x"?PHO.scene:"engine"}-${st}.png`,engineName(),share);}
  catch(e){toast("Couldn't take the picture here");}
  finally{PHO.busy=false;b.disabled=false;}
}
/* ---- gestures on the view ---- */
function phoWire(){
  const pad=$("phPad"),G={p:new Map(),dist:0,cx:0,cy:0,pan:false,tap:null,lt:0,lx:0,ly:0};
  const two=()=>{const [a,b]=[...G.p.values()];return{d:Math.hypot(a.x-b.x,a.y-b.y),cx:(a.x+b.x)/2,cy:(a.y+b.y)/2};};
  pad.addEventListener("pointerdown",e=>{if(e.pointerType==="mouse"&&e.button>2)return;try{pad.setPointerCapture(e.pointerId);}catch(_){}
    G.p.set(e.pointerId,{x:e.clientX,y:e.clientY,x0:e.clientX,y0:e.clientY,t0:performance.now()});G.pan=e.pointerType==="mouse"&&(e.button===1||e.button===2||e.shiftKey);
    if(G.p.size===2){const t=two();G.dist=t.d;G.cx=t.cx;G.cy=t.cy;}e.preventDefault();});
  pad.addEventListener("pointermove",e=>{const o=G.p.get(e.pointerId);if(!o)return;const dx=e.clientX-o.x,dy=e.clientY-o.y;o.x=e.clientX;o.y=e.clientY;
    if(G.p.size===1)ENGINE_VIS.photoView(G.pan?{pan:[dx,dy]}:{orbit:[dx,dy]});
    else if(G.p.size===2){const t=two();ENGINE_VIS.photoView({zoom:G.dist>0&&t.d>0?G.dist/t.d:1,pan:[t.cx-G.cx,t.cy-G.cy]});G.dist=t.d;G.cx=t.cx;G.cy=t.cy;}});
  const up=e=>{const o=G.p.get(e.pointerId);if(!o)return;G.p.delete(e.pointerId);if(G.p.size<2)G.dist=0;
    /* touch has no dblclick: two quick still taps reset the shot */
    if(e.type==="pointerup"&&e.pointerType!=="mouse"&&Math.hypot(e.clientX-o.x0,e.clientY-o.y0)<10&&performance.now()-o.t0<300){const n=performance.now();
      if(n-G.lt<380&&Math.hypot(e.clientX-G.lx,e.clientY-G.ly)<40){ENGINE_VIS.photoView({reset:true});G.lt=0;}else{G.lt=n;G.lx=e.clientX;G.ly=e.clientY;}}};
  pad.addEventListener("pointerup",up);pad.addEventListener("pointercancel",up);
  pad.addEventListener("wheel",e=>{e.preventDefault();ENGINE_VIS.photoView({zoom:Math.max(.5,Math.min(2,1+e.deltaY*(e.ctrlKey?0.01:0.0012)))});},{passive:false});
  pad.addEventListener("dblclick",()=>ENGINE_VIS.photoView({reset:true}));
  pad.addEventListener("contextmenu",e=>e.preventDefault());
  $("phX").addEventListener("click",phoClose);
  $("phShot").addEventListener("click",()=>phoShot(false));$("phShare").addEventListener("click",()=>phoShot(true));
  $("phSheetBtn").addEventListener("click",()=>phoSheet());
  $("phMore").addEventListener("click",()=>{PHO.open=!PHO.open;phoSync();});
  $("phUi").addEventListener("click",e=>{const b=e.target.closest("[data-ph] button");if(!b||!PHO.on)return;const k=b.parentElement.dataset.ph;
    if(k==="light"){PHO.light=b.dataset.v;ENGINE_VIS.photoLight(PHO.light);}
    else if(k==="back"){PHO.back=b.dataset.v;ENGINE_VIS.photoBack(PHO.back);}
    else{const o=b.dataset.o;PHO[o]=!PHO[o];if(o==="spin")ENGINE_VIS.photoSpin(PHO.spin);}
    phoSync();});
  $("phBtn").addEventListener("click",phoOpen);$("phTray").addEventListener("click",phoOpen);
  $("phSheetTray").addEventListener("click",()=>{if(!$("viewTray").hidden)viewTray(false);phoSheet();});
  $("phSheetClose").addEventListener("click",phoSheetClose);$("phSheetSave").addEventListener("click",()=>phoSheetSave(false));$("phSheetShare").addEventListener("click",()=>phoSheetSave(true));
  $("phSheet").addEventListener("pointerdown",e=>{if(e.target===$("phSheet"))phoSheetClose();});
  /* keys while photo mode is up belong to it: Esc closes the sheet then the mode, arrows orbit, + / - zoom, 0 resets */
  window.addEventListener("keydown",e=>{
    if(!$("phSheet").hidden){e.stopPropagation();if(e.key==="Escape"){e.preventDefault();phoSheetClose();}
      else if(e.key==="Tab"){const f=[...$("phSheet").querySelectorAll("button:not([hidden]):not(:disabled)")];if(!f.length)return;const i=f.indexOf(document.activeElement),n=e.shiftKey?(i<=0?f.length-1:i-1):(i<0||i===f.length-1?0:i+1);e.preventDefault();f[n].focus();}return;}
    if(!PHO.on)return;e.stopPropagation();
    if(e.key==="Escape"){e.preventDefault();phoClose();return;}
    if(e.target&&/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))return;
    const k=e.key,s=e.shiftKey?60:24;
    if(k==="ArrowLeft"){ENGINE_VIS.photoView({orbit:[-s,0]});e.preventDefault();}else if(k==="ArrowRight"){ENGINE_VIS.photoView({orbit:[s,0]});e.preventDefault();}
    else if(k==="ArrowUp"){ENGINE_VIS.photoView({orbit:[0,-s]});e.preventDefault();}else if(k==="ArrowDown"){ENGINE_VIS.photoView({orbit:[0,s]});e.preventDefault();}
    else if(k==="+"||k==="="){ENGINE_VIS.photoView({zoom:.88});}else if(k==="-"||k==="_"){ENGINE_VIS.photoView({zoom:1.14});}else if(k==="0"){ENGINE_VIS.photoView({reset:true});}
    else if(k==="Tab"){const f=[...$("phUi").querySelectorAll("button:not([hidden]):not(:disabled)")];if(!f.length)return;const i=f.indexOf(document.activeElement),n=e.shiftKey?(i<=0?f.length-1:i-1):(i<0||i===f.length-1?0:i+1);e.preventDefault();f[n].focus();}
  },true);
}
/* ---- build sheet ---- */
const PHS={url:"",canvas:null,from:null};
const phoN=v=>Math.round(v).toLocaleString("en-CA");
function phoParts(cfg){
  const want=["layout","asp","rotHousing","apexSeal","head","blockMat","piston","rod","crank","ic","nitrous","intake","exhaust","cooling"],rows=[];
  const F={};for(const sec of FORM)for(const f of sec.fields)if(f.type==="seg"||f.type==="swatch")F[f.key]=f;
  for(const k of want){const f=F[k];if(!f||(f.showIf&&!f.showIf(cfg)))continue;const t=OPT[f.optTable||f.key],o=t&&t[cfg[k]];if(!o)continue;const nm=o.name||String(cfg[k]);if(/^(none|no |off)/i.test(nm)&&(k==="ic"||k==="nitrous"))continue;
    let v=nm;if(k==="asp"&&cfg.asp!=="na")v=nm+" · "+bv(cfg.boost)+" "+pU();rows.push([(f.labelIf&&f.labelIf(cfg))||f.label,v]);}
  return rows;
}
async function phoSheetCanvas(){
  const W=1200,H=1600,c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d");
  try{await Promise.race([Promise.all(['700 40px "Chakra Petch"','600 30px "Chakra Petch"','500 24px "IBM Plex Mono"'].map(f=>document.fonts.load(f))),new Promise(r=>setTimeout(r,1500))]);}catch(e){}
  const F=(sz,w)=>`${w||600} ${sz}px "Chakra Petch","Barlow Condensed","Arial Narrow",sans-serif`,M=(sz,w)=>`${w||500} ${sz}px "IBM Plex Mono",Menlo,Consolas,monospace`;
  const INK="#faf9f5",MUTE="#a8a295",ORG="#d97757",ORG2="#e8956f",LINE="#2e2d2b",PNL="#1c1b19",L=60,R=W-60;
  const q=quick,cfg=S.cfg,name=engineName(),h=cfgHash(cfg);
  x.fillStyle="#141413";x.fillRect(0,0,W,H);
  {const g=x.createLinearGradient(0,0,0,300);g.addColorStop(0,"rgba(217,119,87,.16)");g.addColorStop(1,"rgba(217,119,87,0)");x.fillStyle=g;x.fillRect(0,0,W,300);}
  x.fillStyle=ORG;x.fillRect(L,44,6,92);
  x.textAlign="left";x.textBaseline="alphabetic";x.fillStyle=ORG2;x.font=M(24,600);x.fillText("PRAIRIE ENGINE WORKS · BUILD SHEET",L+24,70);
  x.fillStyle=INK;{let fz=64;x.font=F(fz,700);while(fz>36&&x.measureText(name).width>R-L-24){fz-=4;x.font=F(fz,700);}x.fillText(phoFit(x,name,R-L-24),L+24,126);}
  x.fillStyle=MUTE;x.font=M(24);x.fillText(phoFit(x,cfgLbl(cfg),R-L),L,170);
  /* the engine in a studio */
  const PX=L,PY=192,PW=R-L,PH2=480;let shot=null;try{shot=ENGINE_VIS.photoShot?ENGINE_VIS.photoShot(1620,Math.round(1620*PH2/PW)):null;}catch(e){shot=null;}
  x.save();x.beginPath();x.roundRect?x.roundRect(PX,PY,PW,PH2,10):x.rect(PX,PY,PW,PH2);x.clip();
  if(shot&&shot.width){x.drawImage(shot,0,0,shot.width,shot.height,PX,PY,PW,PH2);}else{x.fillStyle=PNL;x.fillRect(PX,PY,PW,PH2);x.fillStyle=MUTE;x.font=F(34,600);x.textAlign="center";x.fillText("No 3D view on this device",W/2,PY+PH2/2);x.textAlign="left";}
  x.restore();x.strokeStyle=LINE;x.lineWidth=2;x.strokeRect(PX,PY,PW,PH2);
  /* the numbers */
  const asp=OPT.asp[cfg.asp],fu=OPT.fuel[cfg.fuel];
  const st=[["PEAK POWER",phoN(q.peakHp)+" hp","@ "+phoN(q.peakHpRpm)+" rpm",1],["PEAK TORQUE",phoN(q.peakTq)+" Nm","@ "+phoN(q.peakTqRpm)+" rpm",0],["DISPLACEMENT",q.Vd<1000?Math.round(q.Vd)+" cc":(q.Vd/1000).toFixed(1)+" L",phoN(q.Vd*0.0610237)+" cu in",0],["REDLINE",phoN(cfg.redline||0)+" rpm","",0],
    ["ASPIRATION",cfg.asp==="na"?"NA":(asp&&asp.name?asp.name:(ASP_SYM[cfg.asp]||cfg.asp.toUpperCase())),cfg.asp==="na"?"Naturally aspirated":bv(cfg.boost)+" "+pU()+" boost",0],["FUEL",fuelShort(cfg.fuel),fu&&fu.name?fu.name:"",0],["WEIGHT",phoN(q.kg)+" kg","",0],["RELIABILITY",isFinite(q.rel)?String(Math.round(q.rel)):"—","of 100",0]];
  const cw=(R-L)/4,SY=692;
  st.forEach((s,i)=>{const cx=L+(i%4)*cw,cy=SY+Math.floor(i/4)*122;x.fillStyle=PNL;x.fillRect(cx+(i%4?6:0),cy,cw-(i%4?6:0),112);
    const tx=cx+(i%4?6:0)+16;x.fillStyle=MUTE;x.font=M(18,600);x.fillText(s[0],tx,cy+30);x.fillStyle=s[3]?ORG2:INK;{let fz=44;x.font=F(fz,700);while(fz>26&&x.measureText(s[1]).width>cw-44){fz-=2;x.font=F(fz,700);}x.fillText(phoFit(x,s[1],cw-40),tx,cy+72);}x.fillStyle=MUTE;x.font=M(18);x.fillText(phoFit(x,s[2],cw-40),tx,cy+100);});
  /* the curve */
  const CY=946,CH=270,padL=70,padR=70,padT=34,padB=34,cx0=L+padL,cx1=R-padR,cy0=CY+padT,cy1=CY+CH-padB;
  x.fillStyle=PNL;x.fillRect(L,CY,R-L,CH);
  {const rp=q.rpms,n=rp.length,r0=Math.floor(rp[0]/1000)*1000,r1=Math.ceil(rp[n-1]/1000)*1000,tmax=Math.max(50,Math.ceil(Math.max(...q.torque)*1.1/50)*50),pmax=Math.max(50,Math.ceil(Math.max(...q.power)*1.1/50)*50);
    const X=r=>cx0+(r-r0)/Math.max(1,r1-r0)*(cx1-cx0),YT=v=>cy1-v/tmax*(cy1-cy0),YP=v=>cy1-v/pmax*(cy1-cy0);
    x.lineWidth=1;x.font=M(16);for(let i=0;i<=4;i++){const y=cy1-i*(cy1-cy0)/4;x.strokeStyle="rgba(255,255,255,.08)";x.beginPath();x.moveTo(cx0,y);x.lineTo(cx1,y);x.stroke();
      x.textAlign="right";x.fillStyle=ORG;x.fillText(phoN(tmax*i/4),cx0-8,y+5);x.textAlign="left";x.fillStyle=INK;x.fillText(phoN(pmax*i/4),cx1+8,y+5);}
    const st2=Math.max(1000,Math.ceil((r1-r0)/6/1000)*1000);x.textAlign="center";x.fillStyle=MUTE;for(let r=r0;r<=r1;r+=st2){x.strokeStyle="rgba(255,255,255,.05)";x.beginPath();x.moveTo(X(r),cy0);x.lineTo(X(r),cy1);x.stroke();x.fillText((r/1000)+"k",X(r),cy1+22);}
    const line=(arr,Y,col)=>{x.strokeStyle=col;x.lineWidth=4;x.lineJoin="round";x.beginPath();for(let i=0;i<n;i++){const px=X(rp[i]),py=Y(arr[i]);i?x.lineTo(px,py):x.moveTo(px,py);}x.stroke();};
    x.fillStyle="rgba(217,119,87,.12)";x.beginPath();x.moveTo(X(rp[0]),cy1);for(let i=0;i<n;i++)x.lineTo(X(rp[i]),YT(q.torque[i]));x.lineTo(X(rp[n-1]),cy1);x.closePath();x.fill();
    line(q.torque,YT,ORG);line(q.power,YP,INK);
    const dot=(r,v,Y,col)=>{x.fillStyle="#141413";x.strokeStyle=col;x.lineWidth=4;x.beginPath();x.arc(X(r),Y(v),9,0,Math.PI*2);x.fill();x.stroke();};
    dot(q.peakHpRpm,q.peakHp,YP,INK);dot(q.peakTqRpm,q.peakTq,YT,ORG);
    x.textAlign="left";x.font=M(18,600);x.fillStyle=ORG;x.fillText("TORQUE  Nm",cx0+8,CY+24);x.fillStyle=INK;x.fillText("POWER  hp",cx0+190,CY+24);x.textAlign="right";x.fillStyle=MUTE;x.fillText("RPM",cx1,CY+24);}
  /* key parts and results */
  const BY=1262,half=(R-L-40)/2,rx=L+half+40;
  x.textAlign="left";x.fillStyle=ORG2;x.font=M(20,600);x.fillText("KEY PARTS",L,BY);x.fillText("RESULTS",rx,BY);x.fillStyle=LINE;x.fillRect(L,BY+10,half,2);x.fillRect(rx,BY+10,half,2);
  const row=(cx,y,k,v,w)=>{x.textAlign="left";x.fillStyle=MUTE;x.font=M(19);x.fillText(phoFit(x,k.toUpperCase(),w*0.42),cx,y);x.textAlign="right";x.fillStyle=INK;x.font=F(25,600);x.fillText(phoFit(x,v,w*0.56),cx+w,y);};
  phoParts(cfg).slice(0,7).forEach((r,i)=>row(L,BY+46+i*32,r[0],r[1],half));
  let res=[];try{res=tropBest(name,h);}catch(e){res=[];}
  let wins=0;try{wins=tropBook().log.filter(e=>!e.seed&&e.slot!=="pennant"&&(e.h===h||e.eng===name)).length;}catch(e){}
  if(!res.length){x.textAlign="left";x.fillStyle=MUTE;x.font=F(25,500);x.fillText("No event results for this build yet.",rx,BY+46);x.font=F(22,500);x.fillText("Take it to the strip, the pull or the salt.",rx,BY+80);}
  else res.slice(0,6).forEach((r,i)=>row(rx,BY+46+i*32,r[0],String(r[1]),half));
  if(wins)row(rx,BY+46+Math.min(res.length,6)*32,"Trophies",String(wins),half);
  /* footer */
  x.fillStyle=LINE;x.fillRect(L,H-62,R-L,2);x.textAlign="left";x.fillStyle=MUTE;x.font=M(18);x.fillText((career()?"Career · week "+C().week:"Test cell")+" · "+new Date().toLocaleDateString("en-CA"),L,H-28);
  x.textAlign="right";x.fillStyle=ORG2;x.font=F(22,700);x.fillText("PRAIRIE ENGINE WORKS",R,H-28);
  return c;
}
async function phoSheet(){
  if(PHS.busy)return;PHS.busy=true;
  try{if(!quick){toast("Nothing to sheet yet");return;}
    toast("Building the sheet…");await new Promise(r=>requestAnimationFrame(r));
    const c=await phoSheetCanvas();PHS.canvas=c;
    const blob=await new Promise(r=>c.toBlob(r,"image/png"));if(!blob){toast("Couldn't make the sheet here");return;}
    if(PHS.url)URL.revokeObjectURL(PHS.url);PHS.url=URL.createObjectURL(blob);
    $("phSheetImg").src=PHS.url;$("phSheetNote").textContent="1200 × 1600 PNG";$("phSheetShare").hidden=!phoCanShare();
    PHS.from=document.activeElement;$("phSheet").hidden=false;$("phSheetSave").focus({preventScroll:true});}
  catch(e){toast("Couldn't make the sheet here");}
  finally{PHS.busy=false;}
}
function phoSheetClose(){if($("phSheet").hidden)return;$("phSheet").hidden=true;$("phSheetImg").removeAttribute("src");if(PHS.url){URL.revokeObjectURL(PHS.url);PHS.url="";}PHS.canvas=null;
  const f=PHS.from;PHS.from=null;try{if(f&&f.isConnected&&f.focus)f.focus({preventScroll:true});}catch(e){}}
async function phoSheetSave(share){if(!PHS.canvas)return;await phoSave(PHS.canvas,`prairie-${phoSlug(engineName())}-build-sheet.png`,engineName()+" · build sheet",share);}
phoBuild();
