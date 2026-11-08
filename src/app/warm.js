/* ===================== EVENT WARM-UP: no stall on Go ===================== */
/* The first run of each event used to freeze for a moment before the car appeared: the graphics card was compiling that event's shaders
   (the small programs that draw each surface), once per page load. While an event's setup screen is up and nothing is running, this hands
   the 3D view a still frame shaped like the run's first one (ENGINE_VIS.warm), so the track and the car are built and their shaders compiled
   ahead of time. renderEnv calls evWarmSoon; it waits for the screen to settle, and the 3D side skips a scene it has already warmed. */
let evWarmT=0;
function evWarmSoon(){clearTimeout(evWarmT);evWarmT=setTimeout(evWarmNow,900);}
/* the still frame for the event on the setup screen: [scene, frame], or null for the dyno tests */
function evWarmFrame(t){const night=!!S.night,color=carPaint();
  if(t==="drag"){const v=dragVeh();return["strip",{phase:"burnout",x:0,v:0,ox:0,ov:0,acc:0,body:v.body,wbar:!!v.wbar,tyreIn:v.tyreDia,color,hw:stripHw(S.cfg),tree:{},launch:{},rpm:900,redline:v.redline||S.cfg.redline,gear:1,noPost:true}];}
  if(t==="pull_sled"){const k=pullEnvFix(),v=pullVeh(k);return["pull",{phase:"stage",x:0,v:0,boxFrac:0,slip:0,vehicle:SIM.PULL_CLASSES[k].veh.kind,cls:k,night,hitch:v.hitch,ballast:v.ballast,tyre:v.tyre,throttle:0,rpm:800,distFt:0}];}
  if(t==="bog"){const k=bogEnvFix(),v=bogVeh(k),n=bogNight(bogSeed(k));return["bog",{phase:"stage",x:0,v:0,cls:k,tyre:v.tyre,color,night,len:n.len,cons:n.cons,pit:{seed:n.seed,len:n.len,cons:n.cons,depth:n.depth,hz:n.hz},throttle:0,rpm:800}];}
  if(t==="boat"){const k=boatEnvFix(),C0=SIM.BOAT_CLASSES[k];return["boat",{phase:"tree",cls:k,hull:C0.hull,drive:C0.drive,night,water:{wind:0,chop:0},tree:{},me:{x:0,v:0,color},opp:{x:0,v:0,color:0x2a6db5}}];}
  if(t==="salt"){const k=saltEnvFix(),v=saltVeh(k);return["salt",{phase:"stage",x:0,v:0,body:k,aero:v.aero,color,night,throttle:0,rpm:800}];}
  if(t==="road")return["road",{track:SIM.roadTrack(S.env.roadTrk),s:0,v:0,ch:roadOpt().ch,night,cam:S.env.roadCam||"auto",pre:true}];
  if(t==="race24")return["road",{track:SIM.roadTrack(e24EnvFix().e24Trk),s:0,v:0,ch:roadOpt().ch,night:false,cam:"auto",pre:true}];
  if(t==="hill"){const o=hillOpt();return["hill",{course:SIM.hillCourse(),s:0,v:0,ch:o.ch,aero:o.aero,color,cam:S.env.hillCam||"auto",pre:true}];}
  if(t==="oval")return["oval",{track:SIM.ovalTrack(ovalTk()),cars:[{s:0,v:0,color,me:true,num:1}],pre:true,cam:"auto",night}];
  return null;}
function evWarmNow(){
  if(testing||curTab!=="events"||document.hidden||typeof ENGINE_VIS==="undefined"||!ENGINE_VIS.warm)return;
  let w=null;try{w=evWarmFrame(S.env.testType);}catch(e){return;}
  if(w)try{ENGINE_VIS.warm(w[0],w[1]);}catch(e){}}
