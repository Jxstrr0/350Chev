/* ===== folds: Settings (Sound / Display / Save) and Dyno day rows =====
   Settings folds are <details class="setfold" data-fold> headed by a one-line summary; the open ones are remembered per fold in
   S.folds (lazy: a fresh or older save has none, so every fold starts closed). accReveal() also opens the fold around a target. */
(()=>{
  let busy=false;
  const cap=t=>t?t.charAt(0).toUpperCase()+t.slice(1):"";
  function foldSums(){if(!S)return;
    const set=(id,t)=>{const el=$(id);if(el&&el.textContent!==t)el.textContent=t;};
    set("setSumSound",`${S.sound===false?"off":"on"} · ${S.vol}%`);
    const g=document.querySelector("#gfxSeg button.on");
    set("setSumDisplay",`${cap(S.theme||"dark")}${g&&g.firstChild?" · "+g.firstChild.textContent.trim():""}`);
    let n=0;for(let i=1;i<=SLOTS;i++)if(readSlot(i))n++;
    const au=$("autoLbl");set("setSumSave",`${au?au.textContent:"autosave on"} · ${n} of ${SLOTS} slots`);}
  function foldApply(){if(!S)return;const f=S.folds||{};busy=true;
    document.querySelectorAll("#setBody .setfold").forEach(d=>{d.open=!!f[d.dataset.fold];});
    setTimeout(()=>{busy=false;},0);foldSums();}
  $("setBody").addEventListener("toggle",e=>{const d=e.target;if(busy||!d.classList||!d.classList.contains("setfold")||!S)return;
    S.folds=Object.assign({},S.folds);if(d.open)S.folds[d.dataset.fold]=1;else delete S.folds[d.dataset.fold];save();},true);
  $("setOpen").addEventListener("click",()=>setTimeout(foldApply,0));
  for(const ev of ["click","input"])$("setBody").addEventListener(ev,()=>setTimeout(foldSums,30));
  if(typeof accReveal==="function"){const ar=accReveal;accReveal=function(el){const f=el&&el.closest&&el.closest(".setfold");if(f&&!f.open)f.open=true;return ar.apply(this,arguments);};}
  /* Dyno day: the job's details sit behind its (i) */
  document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-ddx]");if(!b)return;
    const x=b.closest(".ddrow").querySelector(".ddx"),o=x.hidden;x.hidden=!o;b.setAttribute("aria-expanded",o);});
})();
