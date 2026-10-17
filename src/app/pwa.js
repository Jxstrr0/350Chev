/* ===== PWA: service worker registration, "new version ready" bar, Install app (Settings › App) ===== */
(()=>{
  const bar=document.createElement("div");bar.id="pwaBar";bar.setAttribute("role","status");
  bar.innerHTML='<span>New version ready — </span><button type="button" class="btn sm pri" id="pwaReload">Reload</button><button type="button" class="pwalater" id="pwaLater" aria-label="Dismiss until next visit">Later</button>';
  ($("app")||document.body).appendChild(bar);
  let waiting=null,reloading=false,deferred=null;
  const standalone=()=>matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
  const ios=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  /* Settings › App: shown only when there is something to offer */
  function sync(){
    const inst=!!deferred&&!standalone(),tip=ios()&&!standalone();
    $("pwaInstall").hidden=!inst;$("pwaInstallHint").hidden=!inst;$("pwaIos").hidden=!tip;$("set-app").hidden=!(inst||tip);
  }
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferred=e;sync();});
  window.addEventListener("appinstalled",()=>{deferred=null;sync();});
  $("pwaInstall").addEventListener("click",async()=>{
    if(!deferred)return;const p=deferred;deferred=null;sync();
    try{p.prompt();const r=await p.userChoice;if(r&&r.outcome==="accepted")toast("Installed");}catch(_){}
  });
  sync();
  /* update bar: a new worker is installed and waiting; Reload tells it to take over, the page reloads once it has */
  function offer(w){waiting=w;bar.classList.add("on");}
  $("pwaLater").addEventListener("click",()=>bar.classList.remove("on"));
  $("pwaReload").addEventListener("click",()=>{if(waiting)waiting.postMessage({type:"SKIP_WAITING"});else location.reload();});
  /* register on a real host (not localhost, so dev and smoke tests are never cached), or anywhere over http(s) with ?sw=1; never on file:// */
  const host=location.hostname,web=/^https?:$/.test(location.protocol),local=/^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|0\.0\.0\.0)$/.test(host);
  if(!("serviceWorker" in navigator)||!web||(local&&!/[?&]sw=1(&|$)/.test(location.search)))return;
  const sw=navigator.serviceWorker;
  sw.addEventListener("controllerchange",()=>{if(reloading||!waiting)return;reloading=true;location.reload();});
  sw.register("sw.js").then(reg=>{
    const watch=w=>w&&w.addEventListener("statechange",()=>{if(w.state==="installed"&&sw.controller)offer(w);});
    if(reg.waiting&&sw.controller)offer(reg.waiting);
    watch(reg.installing);reg.addEventListener("updatefound",()=>watch(reg.installing));
    /* an installed app can stay open for days: look for a new version when it comes back to the front and every few hours */
    const chk=()=>{try{reg.update().catch(()=>{});}catch(_){}};
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)chk();});setInterval(chk,4*3600*1000);
  }).catch(()=>{});
})();
