<!-- ENGINE_SAMPLES:BEGIN -->
<script>
/* ============================================================================
   Prairie Engine Works — ENGINE_SAMPLES  (real recorded engine layer)
   ----------------------------------------------------------------------------
   Openly licensed recordings (CC0 / public domain / CC BY / CC BY-SA — see
   sounds/CREDITS.md and Settings › Sound credits), trimmed to seamless loops,
   time-warped to one steady measured rpm. For the build on the bench the layer
   picks the closest recorded set by layout, displacement band, fuel and
   aspiration, plays its idle loop and its load/rev loop through
   AudioBufferSourceNodes with playbackRate = build firing frequency / clip
   firing frequency, crossfades them by rpm and load, and fades back to the
   synth outside a sane pitch window (0.5–2.5×). On desktop a build that sits
   between two size bands of the same layout hears both sets interpolated
   (≤ 4 sources); phones use the nearest set only (≤ 2 sources).
   It rides ENGINE_SOUND's bus (garage reverb, tone, limiter) and only asks the
   synth to duck its core voice — exhaust options, cam lope, aspiration,
   mechanical noise and most events stay synthesized on top. Blow-off, backfire
   and anti-lag bangs are recorded one-shots (SHOTS) when decoded: the synth asks
   first and skips its own version if one played. Lazy: a set's files are fetched
   the first time that set is needed; any failure leaves the synth exactly as it was.
   ========================================================================== */
const ENGINE_SAMPLES = (function () {
  "use strict";
  var BASE = "sounds/";
  /* clip: f file, rpm measured steady rpm of the loop, cyl cylinders of the recorded
     engine, loop [start,end] s inside the decoded file (cyclic pre/post roll, so
     decoder padding never lands on the seam), gain trim */
  var CLIPS = {"i3_idle":{"f":"i3_idle.mp3","src":"fs_584878","rpm":880,"cyl":3,"loop":[0.3,3.29948]},"i4_rev":{"f":"i4_rev.mp3","src":"fs_522221","rpm":2274,"cyl":4,"loop":[0.3,1.51365]},"i4b_rev":{"f":"i4b_rev.mp3","src":"fs_181460","rpm":2529,"cyl":4,"loop":[0.3,2.29261]},"i3b_idle":{"f":"i3b_idle.mp3","src":"HR12DE_March_K13_oga","rpm":824,"cyl":3,"loop":[0.3,3.36009]},"i4s_idle":{"f":"i4s_idle.mp3","src":"fs_362942","rpm":877,"cyl":4,"loop":[0.3,3.30998]},"i4_idle":{"f":"i4_idle.mp3","src":"fs_405322","rpm":1489,"cyl":4,"loop":[0.3,2.79848]},"i4t_idle":{"f":"i4t_idle.mp3","src":"Saab_900_16V_Turbo_Kaltstart_wav","rpm":1463,"cyl":4,"loop":[0.3,2.76029]},"i4hi_hi":{"f":"i4hi_hi.mp3","src":"2002_Honda_F20C_ogg","rpm":7317,"cyl":4,"loop":[0.3,1.49723]},"i6_idle":{"f":"i6_idle.mp3","src":"fs_173005","rpm":757,"cyl":6,"loop":[0.3,2.36084]},"i6old_rev":{"f":"i6old_rev.mp3","src":"Triumph_I6_engine_ogg","rpm":2285,"cyl":6,"loop":[0.3,1.08769]},"i6t_rev":{"f":"i6t_rev.mp3","src":"fs_496171","rpm":3530,"cyl":6,"loop":[0.3,2.3054]},"i6big_idle":{"f":"i6big_idle.mp3","src":"fs_466715","rpm":1419,"cyl":6,"loop":[0.3,1.48376]},"v6_idle":{"f":"v6_idle.mp3","src":"fs_840317","rpm":651,"cyl":6,"loop":[0.3,3.24741]},"v6_rev":{"f":"v6_rev.mp3","src":"NISSAN_VQ35HR_engine_ogg","rpm":4111,"cyl":6,"loop":[0.3,1.2924]},"v8x54_idle":{"f":"v8x54_idle.mp3","src":"fs_610772","rpm":999,"cyl":8,"loop":[0.3,3.30313]},"v8x57_rev":{"f":"v8x57_rev.mp3","src":"fs_391671","rpm":1444,"cyl":8,"loop":[0.3,2.29406]},"v8x50_mid":{"f":"v8x50_mid.mp3","src":"Lexus_IS_F_dynamometer_2UR_GSE_2008_ogg","rpm":3747,"cyl":8,"loop":[0.3,2.28556]},"v8xsc_hi":{"f":"v8xsc_hi.mp3","src":"fs_177184","rpm":6478,"cyl":8,"loop":[0.3,1.50401]},"v8x57_idle":{"f":"v8x57_idle.mp3","src":"fs_391671","rpm":805,"cyl":8,"loop":[0.3,3.73032]},"v8xbb_rev":{"f":"v8xbb_rev.mp3","src":"fs_127980","rpm":2265,"cyl":8,"loop":[0.3,0.88277]},"v8x62_idle":{"f":"v8x62_idle.mp3","src":"fs_637184","rpm":635,"cyl":8,"loop":[0.3,3.3217]},"v8xcam_idle":{"f":"v8xcam_idle.mp3","src":"fs_570800","rpm":1036,"cyl":8,"loop":[0.3,3.77519]},"v8f_idle":{"f":"v8f_idle.mp3","src":"fs_241083","rpm":1087,"cyl":8,"loop":[0.3,3.27941]},"v8f_rev":{"f":"v8f_rev.mp3","src":"fs_241083","rpm":1657,"cyl":8,"loop":[0.3,1.82059]},"v8f_hi":{"f":"v8f_hi.mp3","src":"fs_241083","rpm":4342,"cyl":8,"loop":[0.3,0.60404]},"v10b_idle":{"f":"v10b_idle.mp3","src":"fs_478597","rpm":1231,"cyl":10,"loop":[0.3,1.76274]},"v10a_rev":{"f":"v10a_rev.mp3","src":"fs_564373","rpm":3735,"cyl":10,"loop":[0.3,0.6534]},"v10a_idle":{"f":"v10a_idle.mp3","src":"fs_564373","rpm":1602,"cyl":10,"loop":[0.3,2.77265]},"v12_idle":{"f":"v12_idle.mp3","src":"M70_ogg","rpm":722,"cyl":12,"loop":[0.3,2.29401]},"f4vw_idle":{"f":"f4vw_idle.mp3","src":"WWS_VolkswagenBeetle8211engine_ogg","rpm":1179,"cyl":4,"loop":[0.3,3.25213]},"f4_rev":{"f":"f4_rev.mp3","src":"fs_183654","rpm":5472,"cyl":4,"loop":[0.3,2.29569]},"f4old_idle":{"f":"f4old_idle.mp3","src":"fs_808983","rpm":918,"cyl":4,"loop":[0.3,3.30617]},"f4t_idle":{"f":"f4t_idle.mp3","src":"fs_273334","rpm":722,"cyl":4,"loop":[0.3,2.7942]},"f4_idle":{"f":"f4_idle.mp3","src":"fs_369797","rpm":833,"cyl":4,"loop":[0.3,2.74812]},"f6_mid":{"f":"f6_mid.mp3","src":"2006_Porsche_Cayman_S_engine_sound_wav","rpm":3706,"cyl":6,"loop":[0.3,2.79299]},"f6_hi":{"f":"f6_hi.mp3","src":"2006_Porsche_Cayman_S_engine_sound_wav","rpm":5193,"cyl":6,"loop":[0.3,1.80213]},"d4p_idle":{"f":"d4p_idle.mp3","src":"Peugeot_204_starten_stationair_doorgassen_en_motor_afzetten_","rpm":765,"cyl":4,"loop":[0.3,3.2795]},"d4s_rev":{"f":"d4s_rev.mp3","src":"fs_448217","rpm":2191,"cyl":4,"loop":[0.3,1.77857]},"d4s_idle":{"f":"d4s_idle.mp3","src":"fs_448217","rpm":887,"cyl":4,"loop":[0.3,2.73624]},"d4m_idle":{"f":"d4m_idle.mp3","src":"fs_264864","rpm":915,"cyl":4,"loop":[0.3,3.31594]},"d4b_idle":{"f":"d4b_idle.mp3","src":"fs_546740","rpm":649,"cyl":4,"loop":[0.3,3.25628]},"d6_idle":{"f":"d6_idle.mp3","src":"fs_610771","rpm":752,"cyl":6,"loop":[0.3,3.33154]},"d6m_mid":{"f":"d6m_mid.mp3","src":"Volvo_Penta_Motorljud_ogg","rpm":1230,"cyl":6,"loop":[0.3,3.32469]},"d6big_idle":{"f":"d6big_idle.mp3","src":"fs_637916","rpm":700,"cyl":6,"loop":[0.3,3.72846]},"d6big_rev":{"f":"d6big_rev.mp3","src":"fs_451935","rpm":1752,"cyl":6,"loop":[0.3,1.80662]},"d8n_idle":{"f":"d8n_idle.mp3","src":"Detroit62_ogg","rpm":602,"cyl":8,"loop":[0.3,2.88943]},"d8_rev":{"f":"d8_rev.mp3","src":"fs_443319","rpm":1727,"cyl":8,"loop":[0.3,0.71683]},"d8_idle":{"f":"d8_idle.mp3","src":"fs_443319","rpm":602,"cyl":8,"loop":[0.3,3.29152]},"crank":{"f":"crank.mp3","src":"fs_637184"},"crank_dsl":{"f":"crank_dsl.mp3","src":"fs_610771"},"v12f_mid":{"f":"v12f_mid.mp3","src":"Ferrari_F50_engine_and_exhaust_sound_YouTube_lXnOouQrUtM","rpm":2062,"cyl":12,"loop":[0.3,2.2783]},"v12f_hi":{"f":"v12f_hi.mp3","src":"Ferrari_F50_engine_and_exhaust_sound_YouTube_lXnOouQrUtM","rpm":4120,"cyl":12,"loop":[0.3,1.78549]},"r2_idle":{"f":"r2_idle.mp3","src":"Mazda_RX_7_engine_and_exhaust_sound_YouTube_4z0y1H2REvE","rpm":877,"cyl":4,"loop":[0.3,2.76295]},"r2_rev":{"f":"r2_rev.mp3","src":"Mazda_RX_8_engine_and_exhaust_sound_YouTube_u_Lc2Nt3OR8","rpm":4986,"cyl":4,"loop":[0.3,1.31077]},"v4_idle":{"f":"v4_idle.mp3","src":"fs_584116","rpm":1973,"cyl":4,"loop":[0.3,2.3071]},"i1_idle":{"f":"i1_idle.mp3","src":"fs_510231","rpm":1692,"cyl":1,"loop":[0.3,2.78227]},"i2_idle":{"f":"i2_idle.mp3","src":"fs_724080","rpm":1373,"cyl":2,"loop":[0.3,2.83544]},"i5_idle":{"f":"i5_idle.mp3","src":"Audi_RS3_engine_and_exhaust_sound_YouTube_uuEytKIzqeY","rpm":998,"cyl":5,"loop":[0.3,2.82506]},"i5_rev":{"f":"i5_rev.mp3","src":"Audi_TT_RS_engine_and_exhaust_sound_YouTube_MH4ek7tBg6I","rpm":2524,"cyl":5,"loop":[0.3,2.10673]},"d5_mid":{"f":"d5_mid.mp3","src":"Volvo_V70_engine_and_exhaust_sound_YouTube_IGWL1Lnlsns","rpm":1861,"cyl":5,"loop":[0.3,2.81431]},"bov1":{"f":"bov1.mp3","src":"Peugeot_406_Turbo_turbocharged_HKS_blow_off_valve_engine_and_exhaust_sound_YouTube_kx0Tvu4_K04"},"bov2":{"f":"bov2.mp3","src":"Peugeot_406_Turbo_turbocharged_HKS_blow_off_valve_engine_and_exhaust_sound_YouTube_kx0Tvu4_K04"},"bov3":{"f":"bov3.mp3","src":"Peugeot_406_Turbo_turbocharged_HKS_blow_off_valve_engine_and_exhaust_sound_YouTube_kx0Tvu4_K04"},"bov4":{"f":"bov4.mp3","src":"Peugeot_406_Turbo_turbocharged_HKS_blow_off_valve_engine_and_exhaust_sound_YouTube_kx0Tvu4_K04"},"bf1":{"f":"bf1.mp3","src":"fs_675723"},"bf2":{"f":"bf2.mp3","src":"fs_675723"},"bf3":{"f":"bf3.mp3","src":"fs_675723"},"bf4":{"f":"bf4.mp3","src":"fs_675723"},"als1":{"f":"als1.mp3","src":"fs_797835"},"als2":{"f":"als2.mp3","src":"fs_797835"},"als3":{"f":"als3.mp3","src":"fs_797835"},"als4":{"f":"als4.mp3","src":"fs_797835"}};
  /* set: lay layouts it is recorded on (exact match), alt layouts it may stand in for,
     L litres, fuel gas|diesel, asp na|turbo|sc, loops = clip ids from idle up to high rpm */
  var SETS = [{"k":"i3_10","name":"I3 1.0","lay":["I3"],"L":1,"fuel":"gas","asp":"na","loops":["i3_idle","i4_rev","i4b_rev"]},{"k":"i3_12","name":"I3 1.2","lay":["I3"],"L":1.2,"fuel":"gas","asp":"na","loops":["i3b_idle","i4_rev","i4b_rev"]},{"k":"i4_14","name":"I4 1.4–1.6 economy","lay":["I4"],"L":1.5,"fuel":"gas","asp":"na","loops":["i4s_idle","i4_rev","i4b_rev"]},{"k":"i4_22","name":"I4 2.2","lay":["I4"],"L":2.2,"fuel":"gas","asp":"na","alt":{"I5":0.4},"loops":["i4_idle","i4b_rev"]},{"k":"i4t_20","name":"I4 2.0 turbo","lay":["I4"],"L":2,"fuel":"gas","asp":"turbo","alt":{"I5":0.45},"loops":["i4t_idle","i4b_rev","i4hi_hi"]},{"k":"i4hi_20","name":"I4 2.0 high-rev","lay":["I4"],"L":2,"fuel":"gas","asp":"na","hi":true,"loops":["i4s_idle","i4b_rev","i4hi_hi"]},{"k":"i6_20","name":"I6 2.0–2.5","lay":["I6"],"L":2.2,"fuel":"gas","asp":"na","alt":{"I5":0.4},"loops":["i6_idle","i6old_rev","i6t_rev"]},{"k":"i6_30t","name":"I6 3.0 turbo","lay":["I6"],"L":3,"fuel":"gas","asp":"turbo","loops":["i6_idle","i6t_rev"]},{"k":"i6_40","name":"I6 4.0","lay":["I6"],"L":4,"fuel":"gas","asp":"na","loops":["i6big_idle","i6t_rev"]},{"k":"v6_30","name":"V6 3.0–3.5","lay":["V6"],"L":3.2,"fuel":"gas","asp":"na","loops":["v6_idle","v6_rev"]},{"k":"v8x_50","name":"V8 crossplane 5.0–5.4","lay":["V8"],"L":5.1,"fuel":"gas","asp":"na","loops":["v8x54_idle","v8x57_rev","v8x50_mid","v8xsc_hi"]},{"k":"v8x_57","name":"V8 crossplane 5.7","lay":["V8"],"L":5.7,"fuel":"gas","asp":"na","loops":["v8x57_idle","v8x57_rev","v8xbb_rev","v8xsc_hi"]},{"k":"v8x_62","name":"V8 crossplane 6.2 (LS)","lay":["V8"],"L":6.2,"fuel":"gas","asp":"na","loops":["v8x62_idle","v8x57_rev","v8x50_mid","v8xsc_hi"]},{"k":"v8x_74","name":"V8 big-block 7.0+ (mild cam)","lay":["V8"],"L":7.4,"fuel":"gas","asp":"na","loops":["v8x54_idle","v8xbb_rev","v8xsc_hi"]},{"k":"v8x_bb","name":"V8 big-cam hot rod / big-block","lay":["V8"],"L":7.5,"fuel":"gas","asp":"na","lope":true,"loops":["v8xcam_idle","v8xbb_rev","v8xsc_hi"]},{"k":"v8f_36","name":"V8 flat-plane 3.6","lay":["V8F"],"L":3.6,"fuel":"gas","asp":"na","loops":["v8f_idle","v8f_rev","v8f_hi"]},{"k":"v10_50","name":"V10 5.0","lay":["V10"],"L":5,"fuel":"gas","asp":"na","loops":["v10b_idle","v10a_rev"]},{"k":"v10_52","name":"V10 5.2","lay":["V10"],"L":5.2,"fuel":"gas","asp":"na","loops":["v10a_idle","v10a_rev"]},{"k":"v12_55","name":"V12 5.0–6.0","lay":["V12"],"L":5.5,"fuel":"gas","asp":"na","loops":["v12_idle","v12f_mid","v12f_hi"]},{"k":"f4_14","name":"Flat-4 air-cooled 1.2–1.6","lay":["F4"],"L":1.4,"fuel":"gas","asp":"na","loops":["f4vw_idle","f4_rev"]},{"k":"f4_16","name":"Flat-4 1.6 vintage","lay":["F4"],"L":1.6,"fuel":"gas","asp":"na","loops":["f4old_idle","f4_rev"]},{"k":"f4_20t","name":"Flat-4 2.0 turbo","lay":["F4"],"L":2,"fuel":"gas","asp":"turbo","loops":["f4t_idle","f4_rev"]},{"k":"f4_25","name":"Flat-4 2.5","lay":["F4"],"L":2.5,"fuel":"gas","asp":"na","loops":["f4_idle","f4_rev"]},{"k":"f6_34","name":"Flat-6 3.4","lay":["F6"],"L":3.4,"fuel":"gas","asp":"na","loops":["f6_mid","f6_hi"]},{"k":"d4_14","name":"Diesel I4 1.4 (NA, old)","lay":["I4"],"L":1.4,"fuel":"diesel","asp":"na","alt":{"I3":0.3,"F4":0.4},"loops":["d4p_idle","d4s_rev"]},{"k":"d4_19","name":"Diesel I4 1.9 TDI","lay":["I4"],"L":1.9,"fuel":"diesel","asp":"turbo","alt":{"I3":0.3,"I5":0.3,"F4":0.4},"loops":["d4s_idle","d4s_rev"]},{"k":"d4_20m","name":"Diesel I4 2.0 marine (NA)","lay":["I4"],"L":2,"fuel":"diesel","asp":"na","alt":{"I3":0.3,"I5":0.3,"F4":0.4},"loops":["d4m_idle","d4s_rev"]},{"k":"d4_52","name":"Diesel I4 5.2 truck","lay":["I4"],"L":5.2,"fuel":"diesel","asp":"turbo","alt":{"I5":0.3},"loops":["d4b_idle","d4s_rev"]},{"k":"d6_59","name":"Diesel I6 5.9","lay":["I6"],"L":5.9,"fuel":"diesel","asp":"turbo","alt":{"V6":0.4,"I5":0.3,"F6":0.4},"loops":["d6_idle","d6m_mid"]},{"k":"d6_14","name":"Diesel I6 big rig 12–15 L","lay":["I6"],"L":14,"fuel":"diesel","asp":"turbo","alt":{"V6":0.4},"loops":["d6big_idle","d6big_rev"]},{"k":"d8_62","name":"Diesel V8 6.2 (NA)","lay":["V8","V8F"],"L":6.2,"fuel":"diesel","asp":"na","alt":{"V6":0.4,"V10":0.4,"V12":0.4},"loops":["d8n_idle","d8_rev"]},{"k":"d8_73","name":"Diesel V8 7.3 turbo","lay":["V8","V8F"],"L":7.3,"fuel":"diesel","asp":"turbo","alt":{"V6":0.4,"V10":0.4,"V12":0.4},"loops":["d8_idle","d8_rev"]},{"k":"r2_13","name":"Rotary 2-rotor","lay":["R2"],"alt":{"R1":0.5,"R3":0.3,"R4":0.4},"L":1.3,"fuel":"gas","asp":"na","loops":["r2_idle","r2_rev"]},{"k":"v4_11","name":"V4 1.1 (bike)","lay":["V4"],"L":1.1,"fuel":"gas","asp":"na","loops":["v4_idle"]},{"k":"i1_03","name":"Single 0.25 (bike)","lay":["I1"],"L":0.25,"fuel":"gas","asp":"na","loops":["i1_idle"]},{"k":"i2_08","name":"Parallel twin 0.8 (bike)","lay":["I2"],"L":0.8,"fuel":"gas","asp":"na","loops":["i2_idle"]},{"k":"i5_25t","name":"I5 2.5 turbo","lay":["I5"],"L":2.5,"fuel":"gas","asp":"turbo","loops":["i5_idle","i5_rev"]},{"k":"d5_24","name":"Diesel I5 2.4","lay":["I5"],"L":2.4,"fuel":"diesel","asp":"turbo","loops":["d4s_idle","d5_mid"]}];
  var CREDITS = [{"title":"Volkswagen 3-cylinder engine start and idle","author":"rodrigocswm","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/rodrigocswm/sounds/584878/","use":"I3 1.0 idle","mods":"trimmed 8.0–38.0 s; steadied, looped, normalised, mono MP3"},{"title":"Peugeot 308 acceleration/idle close to the exhaust (I4)","author":"Nox_Sound","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/Nox_Sound/sounds/522221/","use":"I3 1.0 rev; I3 1.2 rev; I4 1.4–1.6 economy rev","mods":"trimmed 31.8–36.2 s; steadied, looped, normalised, mono MP3"},{"title":"Chevrolet Cobalt LS engine rev (I4, interior)","author":"erik90","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/erik90/sounds/181460/","use":"I3 1.0 high; I3 1.2 high; I4 1.4–1.6 economy high; I4 2.0 high-rev rev; I4 2.0 turbo rev; I4 2.2 rev","mods":"trimmed 19.5–26.5 s; steadied, looped, normalised, mono MP3"},{"title":"Nissan March HR12DE (I3)","author":"Oq10pass","license":"CC0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/deed.en","src":"https://commons.wikimedia.org/wiki/File:HR12DE-March-K13.oga","use":"I3 1.2 idle","mods":"trimmed 1.0–11.0 s; steadied, looped, normalised, mono MP3"},{"title":"Chevrolet Lacetti 1.4 start and idle (I4)","author":"AlexanderChe","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/AlexanderChe/sounds/362942/","use":"I4 1.4–1.6 economy idle; I4 2.0 high-rev idle","mods":"trimmed 15.0–27.0 s; steadied, looped, normalised, mono MP3"},{"title":"2004 Saturn Vue engine start and idle (I4)","author":"tbsounddesigns","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/tbsounddesigns/sounds/405322/","use":"I4 2.2 idle","mods":"trimmed 3.5–10.5 s; steadied, looped, normalised, mono MP3"},{"title":"Saab 900 16V turbo cold start (I4)","author":"KunstKonst","license":"CC BY-SA 4.0","licUrl":"https://creativecommons.org/licenses/by-sa/4.0","src":"https://commons.wikimedia.org/wiki/File:Saab_900_16V_Turbo_Kaltstart.wav","use":"I4 2.0 turbo idle","mods":"trimmed 4.0–15.0 s; steadied, looped, normalised, mono MP3"},{"title":"2002 Honda F20C (S2000) engine-bay recording (I4)","author":"Tyler Riddle","license":"CC BY 3.0","licUrl":"https://creativecommons.org/licenses/by/3.0","src":"https://commons.wikimedia.org/wiki/File:2002-Honda-F20C.ogg","use":"I4 2.0 high-rev high; I4 2.0 turbo high","mods":"trimmed 122.8–126.2 s; steadied, looped, normalised, mono MP3"},{"title":"BMW 320 (1988) engine (I6)","author":"ninebilly","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/ninebilly/sounds/173005/","use":"I6 2.0–2.5 idle; I6 3.0 turbo idle","mods":"trimmed 1.2–5.5 s; steadied, looped, normalised, mono MP3"},{"title":"Triumph six-cylinder engine running","author":"Netlore","license":"CC BY-SA 3.0","licUrl":"https://creativecommons.org/licenses/by-sa/3.0","src":"https://commons.wikimedia.org/wiki/File:Triumph-I6_engine.ogg","use":"I6 2.0–2.5 rev","mods":"trimmed 4.6–6.4 s; steadied, looped, normalised, mono MP3"},{"title":"Toyota Supra on a chassis dyno with turbo (I6)","author":"editboy23","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/editboy23/sounds/496171/","use":"I6 2.0–2.5 high; I6 3.0 turbo rev; I6 4.0 rev","mods":"trimmed 12.5–21.0 s; steadied, looped, normalised, mono MP3"},{"title":"Straight-piped Jeep inline six after start-up","author":"dudebrobrodude","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/dudebrobrodude/sounds/466715/","use":"I6 4.0 idle","mods":"trimmed 0.3–3.0 s; steadied, looped, normalised, mono MP3"},{"title":"2019 Porsche Cayenne idling (V6)","author":"Robo9418","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/Robo9418/sounds/840317/","use":"V6 3.0–3.5 idle","mods":"trimmed 3.0–25.0 s; steadied, looped, normalised, mono MP3"},{"title":"Nissan Fuga 350GT VQ35HR V6","author":"TTTNIS","license":"Public domain","licUrl":"","src":"https://commons.wikimedia.org/wiki/File:NISSAN_VQ35HR_engine.ogg","use":"V6 3.0–3.5 rev","mods":"trimmed 0.6–3.6 s; steadied, looped, normalised, mono MP3"},{"title":"Ford F350 5.4 V8 startup and idle","author":"Therancher01","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/Therancher01/sounds/610772/","use":"V8 big-block 7.0+ (mild cam) idle; V8 crossplane 5.0–5.4 idle","mods":"trimmed 5.0–28.0 s; steadied, looped, normalised, mono MP3"},{"title":"Chevrolet Caprice V8 at different speeds","author":"romanholtwick","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/romanholtwick/sounds/391671/","use":"V8 crossplane 5.0–5.4 rev; V8 crossplane 5.7 idle; V8 crossplane 5.7 rev; V8 crossplane 6.2 (LS) rev","mods":"trimmed 61.2–65.8 s, 18.0–38.0 s; steadied, looped, normalised, mono MP3"},{"title":"Lexus IS F 2UR-GSE V8 on a dynamometer","author":"Altair78","license":"CC BY-SA 4.0","licUrl":"https://creativecommons.org/licenses/by-sa/4.0","src":"https://commons.wikimedia.org/wiki/File:Lexus_IS-F_dynamometer_2UR-GSE_(2008).ogg","use":"V8 crossplane 5.0–5.4 high; V8 crossplane 6.2 (LS) high","mods":"trimmed 10.5–14.5 s; steadied, looped, normalised, mono MP3"},{"title":"Holden V8 supercharged (951 hp) dyno run-up","author":"Ears68","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/Ears68/sounds/177184/","use":"V8 big-block 7.0+ (mild cam) high; V8 big-cam hot rod / big-block high; V8 crossplane 5.0–5.4 high; V8 crossplane 5.7 high; V8 crossplane 6.2 (LS) high","mods":"trimmed 68.6–71.2 s; steadied, looped, normalised, mono MP3"},{"title":"Ford 460 big-block V8 rev","author":"Henaway","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/Henaway/sounds/127980/","use":"V8 big-block 7.0+ (mild cam) rev; V8 big-cam hot rod / big-block rev; V8 crossplane 5.7 high","mods":"trimmed 1.2–2.4 s; steadied, looped, normalised, mono MP3"},{"title":"Chevrolet Corvette (V8): start, idle, revs","author":"kyles","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/kyles/sounds/637184/","use":"V8 crossplane 6.2 (LS) idle; starter crank one-shot","mods":"trimmed 11.0–17.0 s, 0.0–1.75 s; steadied, looped, normalised, mono MP3"},{"title":"'55 Chevy hot rod V8 idle","author":"tubbers","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/tubbers/sounds/570800/","use":"V8 big-cam hot rod / big-block idle","mods":"trimmed 10.0–60.0 s; steadied, looped, normalised, mono MP3"},{"title":"Ferrari 360 Spider engine (flat-plane V8)","author":"PritzProductions","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/PritzProductions/sounds/241083/","use":"V8 flat-plane 3.6 high; V8 flat-plane 3.6 idle; V8 flat-plane 3.6 rev","mods":"trimmed 18.5–24.0 s, 12.3–15.6 s, 8.1–9.0 s; steadied, looped, normalised, mono MP3"},{"title":"BMW M6 start and idle (V10)","author":"Kinoton","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/Kinoton/sounds/478597/","use":"V10 5.0 idle","mods":"trimmed 1.6–5.0 s; steadied, looped, normalised, mono MP3"},{"title":"Lamborghini Huracán EVO start-up and idle (V10)","author":"JaimeLopes","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/JaimeLopes/sounds/564373/","use":"V10 5.0 rev; V10 5.2 idle; V10 5.2 rev","mods":"trimmed 1.3–2.0 s, 6.0–20.0 s; steadied, looped, normalised, mono MP3"},{"title":"BMW M70 V12 idling","author":"Johannes Maximilian","license":"CC BY-SA 4.0","licUrl":"https://creativecommons.org/licenses/by-sa/4.0","src":"https://commons.wikimedia.org/wiki/File:M70.ogg","use":"V12 5.0–6.0 idle","mods":"trimmed 0.2–4.3 s; steadied, looped, normalised, mono MP3"},{"title":"Volkswagen Beetle engine (air-cooled flat-4)","author":"Work With Sounds / Technical Museum of Slovenia","license":"CC BY 4.0","licUrl":"https://creativecommons.org/licenses/by/4.0","src":"https://commons.wikimedia.org/wiki/File:WWS_VolkswagenBeetle8211engine.ogg","use":"Flat-4 air-cooled 1.2–1.6 idle","mods":"trimmed 44.0–53.0 s; steadied, looped, normalised, mono MP3"},{"title":"Scion FR-S on a DynoJet (flat-4)","author":"dezoris","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/dezoris/sounds/183654/","use":"Flat-4 1.6 vintage rev; Flat-4 2.0 turbo rev; Flat-4 2.5 rev; Flat-4 air-cooled 1.2–1.6 rev","mods":"trimmed 14.0–19.5 s; steadied, looped, normalised, mono MP3"},{"title":"Porsche 912 engine after restoration (flat-4)","author":"vukongs","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/vukongs/sounds/808983/","use":"Flat-4 1.6 vintage idle","mods":"trimmed 24.0–56.0 s; steadied, looped, normalised, mono MP3"},{"title":"2003 Subaru Impreza WRX exhaust sounds (flat-4 turbo)","author":"ulose2piranha","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/ulose2piranha/sounds/273334/","use":"Flat-4 2.0 turbo idle","mods":"trimmed 0.5–7.0 s; steadied, looped, normalised, mono MP3"},{"title":"2003 Subaru Impreza start-up and idle (flat-4)","author":"t33kno","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/t33kno/sounds/369797/","use":"Flat-4 2.5 idle","mods":"trimmed 8.0–14.0 s; steadied, looped, normalised, mono MP3"},{"title":"2006 Porsche Cayman S accelerating (flat-6)","author":"John64","license":"CC BY-SA 3.0","licUrl":"https://creativecommons.org/licenses/by-sa/3.0","src":"https://commons.wikimedia.org/wiki/File:2006_Porsche_Cayman_S_engine_sound.wav","use":"Flat-6 3.4 idle; Flat-6 3.4 rev","mods":"trimmed 19.0–32.0 s, 12.0–16.5 s; steadied, looped, normalised, mono MP3"},{"title":"Peugeot 204 diesel: start, idle, revs, stop","author":"Beeld en Geluid","license":"CC BY-SA 3.0","licUrl":"https://creativecommons.org/licenses/by-sa/3.0","src":"https://commons.wikimedia.org/wiki/File:Peugeot_204,_starten,_stationair,_doorgassen_en_motor_afzetten_-_SoundCloud_-_Beeld_en_Geluid.ogg","use":"Diesel I4 1.4 (NA, old) idle","mods":"trimmed 50.0–67.0 s; steadied, looped, normalised, mono MP3"},{"title":"VW New Beetle TDI diesel","author":"Evilmikie","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/Evilmikie/sounds/448217/","use":"Diesel I4 1.4 (NA, old) rev; Diesel I4 1.9 TDI idle; Diesel I4 1.9 TDI rev; Diesel I4 2.0 marine (NA) rev; Diesel I4 5.2 truck rev","mods":"trimmed 83.0–90.0 s, 16.0–24.0 s; steadied, looped, normalised, mono MP3"},{"title":"Volvo Penta MD22 marine diesel (4 cyl)","author":"AugustSandberg","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/AugustSandberg/sounds/264864/","use":"Diesel I4 2.0 marine (NA) idle","mods":"trimmed 5.0–60.0 s; steadied, looped, normalised, mono MP3"},{"title":"Isuzu 4HK1 5.2 L turbo diesel","author":"ithoanglong26","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/ithoanglong26/sounds/546740/","use":"Diesel I4 5.2 truck idle","mods":"trimmed 2.0–16.0 s; steadied, looped, normalised, mono MP3"},{"title":"Ram 3500 5.9 Cummins startup and idle","author":"Therancher01","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/Therancher01/sounds/610771/","use":"Diesel I6 5.9 idle; starter crank one-shot","mods":"trimmed 8.0–30.0 s, 0.0–3.4 s; steadied, looped, normalised, mono MP3"},{"title":"Volvo Penta six-cylinder marine diesel","author":"Ljud: Jonn Leffmann","license":"CC BY 3.0","licUrl":"https://creativecommons.org/licenses/by/3.0","src":"https://commons.wikimedia.org/wiki/File:Volvo_Penta_Motorljud.ogg","use":"Diesel I6 5.9 rev","mods":"trimmed 1.0–15.0 s; steadied, looped, normalised, mono MP3"},{"title":"Semi-trailer truck idle, deep and close","author":"kyles","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/kyles/sounds/637916/","use":"Diesel I6 big rig 12–15 L idle","mods":"trimmed 5.0–45.0 s; steadied, looped, normalised, mono MP3"},{"title":"Mack semi idle and pull-away","author":"kyles","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/kyles/sounds/451935/","use":"Diesel I6 big rig 12–15 L rev","mods":"trimmed 6.8–11.0 s; steadied, looped, normalised, mono MP3"},{"title":"Detroit Diesel 6.2 L V8","author":"Sixthstar (talk)","license":"CC0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/deed.en","src":"https://commons.wikimedia.org/wiki/File:Detroit62.ogg","use":"Diesel V8 6.2 (NA) idle","mods":"trimmed 6.5–9.8 s; steadied, looped, normalised, mono MP3"},{"title":"Ford F350 modified turbo diesel start, idle, revs","author":"DAVESTALKER","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/DAVESTALKER/sounds/443319/","use":"Diesel V8 6.2 (NA) rev; Diesel V8 7.3 turbo idle; Diesel V8 7.3 turbo rev","mods":"trimmed 12.0–12.8 s, 1.5–11.0 s; steadied, looped, normalised, mono MP3"},{"title":"Ferrari F50 V12 revving","author":"randomcarssounds (YouTube)","license":"CC BY 3.0","licUrl":"https://creativecommons.org/licenses/by/3.0","src":"https://commons.wikimedia.org/wiki/File:Ferrari_F50_-_engine_and_exhaust_sound_(YouTube_lXnOouQrUtM).opus","use":"V12 5.0–6.0 mid; V12 5.0–6.0 high","mods":"trimmed 39.5–50.5 s, 20.2–25.5 s; steadied, looped, normalised, mono MP3"},{"title":"Mazda RX-7 twin-rotor start and revs","author":"Taz Ringer (YouTube)","license":"CC BY 3.0","licUrl":"https://creativecommons.org/licenses/by/3.0","src":"https://commons.wikimedia.org/wiki/File:Mazda_RX-7_-_engine_and_exhaust_sound_(YouTube_4z0y1H2REvE).opus","use":"Rotary idle","mods":"trimmed 16.0–26.0 s; held as recorded, looped, normalised, mono MP3"},{"title":"Mazda RX-8 rotary at full throttle","author":"cz125cz125 (YouTube)","license":"CC BY 3.0","licUrl":"https://creativecommons.org/licenses/by/3.0","src":"https://commons.wikimedia.org/wiki/File:Mazda_RX-8_-_engine_and_exhaust_sound_(YouTube_u-Lc2Nt3OR8).opus","use":"Rotary rev","mods":"trimmed 21.0–22.6 s; steadied, looped, normalised, mono MP3"},{"title":"Ducati Panigale V4 exhaust (sample 2)","author":"rsn267","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/rsn267/sounds/584116/","use":"V4 idle","mods":"trimmed 1.5–6.0 s; held as recorded, looped, normalised, mono MP3"},{"title":"Yamaha Ténéré 250 enduro idle (single)","author":"Singular_Estudio","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/Singular_Estudio/sounds/510231/","use":"Single idle","mods":"trimmed 17.0–24.0 s; held as recorded, looped, normalised, mono MP3"},{"title":"BMW F800GS start and idle (parallel twin)","author":"brucehep","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/brucehep/sounds/724080/","use":"Parallel twin idle","mods":"trimmed 3.0–18.0 s; steadied, looped, normalised, mono MP3"},{"title":"Audi RS3 (2.5 TFSI five) engine and exhaust","author":"Jay Chesterman (YouTube)","license":"CC BY 3.0","licUrl":"https://creativecommons.org/licenses/by/3.0","src":"https://commons.wikimedia.org/wiki/File:Audi_RS3_-_engine_and_exhaust_sound_(YouTube_uuEytKIzqeY).opus","use":"I5 2.5 turbo idle","mods":"trimmed 50.0–70.0 s; held as recorded, looped, normalised, mono MP3"},{"title":"Audi TT RS (2.5 TFSI five) on board","author":"Speedster Turbo Berlin (YouTube)","license":"CC BY 3.0","licUrl":"https://creativecommons.org/licenses/by/3.0","src":"https://commons.wikimedia.org/wiki/File:Audi_TT_RS_-_engine_and_exhaust_sound_(YouTube_MH4ek7tBg6I).opus","use":"I5 2.5 turbo rev","mods":"trimmed 121.5–127.5 s; steadied, looped, normalised, mono MP3"},{"title":"Volvo V70 D5244T five-cylinder diesel, cold drive","author":"Euro Buses NO (YouTube)","license":"CC BY 3.0","licUrl":"https://creativecommons.org/licenses/by/3.0","src":"https://commons.wikimedia.org/wiki/File:Volvo_V70_-_engine_and_exhaust_sound_(YouTube_IGWL1Lnlsns).opus","use":"Diesel I5 2.4 cruise","mods":"trimmed 50.0–68.0 s; steadied, looped, normalised, mono MP3"},{"title":"Peugeot 406 Turbo with an HKS blow-off valve","author":"nick7100 (YouTube)","license":"CC BY 3.0","licUrl":"https://creativecommons.org/licenses/by/3.0","src":"https://commons.wikimedia.org/wiki/File:Peugeot_406_Turbo_(turbocharged,_HKS_blow-off_valve)_-_engine_and_exhaust_sound_(YouTube_kx0Tvu4_K04).opus","use":"Blow-off valve (4 variants)","mods":"cut 9.72, 32.17, 41.87, 66.33 s, 0.7 s each; high-passed at 700 Hz, faded, peak-normalised, mono MP3"},{"title":"Car backfires, reverberant","author":"craigsmith","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/craigsmith/sounds/675723/","use":"Backfire and intake backfire (4 variants)","mods":"cut 0.01, 1.80, 3.96, 5.02 s, 0.6–0.8 s each; 1639 Hz hum notched, faded, peak-normalised, mono MP3"},{"title":"Car anti-lag (raw)","author":"modusmogulus","license":"CC0 1.0","licUrl":"http://creativecommons.org/publicdomain/zero/1.0/","src":"https://freesound.org/people/modusmogulus/sounds/797835/","use":"Anti-lag bangs (4 variants)","mods":"cut 1.55, 1.76, 2.17, 5.26 s, 0.2–0.25 s each; high-passed at 60 Hz, faded, peak-normalised, mono MP3"}];
  /* firing-equivalent cylinders per layout: a Wankel rotor fires once per e-shaft turn, as often as two
     four-stroke cylinders, so a 2-rotor counts as 4 (rotary clips store cyl the same way) */
  var NCYL = { I1: 1, I2: 2, I3: 3, I4: 4, I5: 5, I6: 6, V4: 4, V6: 6, V8: 8, V8F: 8, V10: 10, V12: 12, F4: 4, F6: 6, R1: 2, R2: 4, R3: 6, R4: 8 };

  /* recorded one-shots, asked for by the synth (ENGINE_SOUND.setShotHook) once it has decided the event happens:
     kind → variant clip ids, gain (peak relative to the synth's own version), playback-rate spread.
     "intake" (a backfire through the intake) reuses the backfires slowed down. */
  var SHOTS = {
    bov: { ids: ["bov1", "bov2", "bov3", "bov4"], gain: 0.34, rate: [0.9, 1.1] },
    backfire: { ids: ["bf1", "bf2", "bf3", "bf4"], gain: 0.5, rate: [0.9, 1.12] },
    intake: { ids: ["bf1", "bf2", "bf3", "bf4"], gain: 0.55, rate: [0.68, 0.8] },
    als: { ids: ["als1", "als2", "als3", "als4"], gain: 0.72, rate: [0.88, 1.15] }
  };
  var SHOT_IDS = ["bov1", "bov2", "bov3", "bov4", "bf1", "bf2", "bf3", "bf4", "als1", "als2", "als3", "als4"];
  var shotN = 0;

  var MODE = "real";                  // synth | real | blend (Settings default: real)
  var host = null, ctx = null, out = null, lp = null;
  var G = [null, null];               // voice groups: {set, w, vI, vR}
  var cache = {}, loading = {}, failed = {};
  var running = false, lastT = 0, holdUntil = 0, presence = 0, stopT = null, pickKey = "", pick = null;
  var stat = { fetched: 0, bytes: 0, decoded: 0, errors: 0, shots: 0, set: null, set2: null, w2: 0, rateI: 0, rateR: 0, gI: 0, gR: 0, mix: 1, cover: 0, sources: 0 };
  var SLOW = false;
  try { var cn = navigator.connection; SLOW = !!(cn && (cn.saveData || /(^|-)2g$/.test(cn.effectiveType || ""))); } catch (e) {}

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function nowMs() { return (typeof performance !== "undefined") ? performance.now() : Date.now(); }
  function litres(cfg, n) { var b = +(cfg && cfg.bore) || 86, s = +(cfg && cfg.stroke) || 86; return Math.PI / 4 * b * b * s * n / 1e6; }
  function aspOf(cfg) {
    var a = (cfg && cfg.asp) || "na";
    try { var o = (typeof SIM !== "undefined" && SIM.OPT && SIM.OPT.asp && SIM.OPT.asp[a]) || null; if (o) a = o.kind; } catch (e) {}
    return a === "na" ? "na" : (a === "roots" || a === "screw" || a === "centrifugal") ? "sc" : "turbo";
  }

  /* rank the recorded sets for a build: exact layout first, then stand-ins, nearest displacement
     band (log distance), matching aspiration. Returns {a, b, w, fit} — b/w = the neighbouring size
     band to interpolate toward, fit = how much of the voice the recording may carry (stand-ins less). */
  function choose(cfg, lk, diesel) {
    var rot = /^R\d$/.test(lk || "");                                         // rotaries have no bore/stroke: size never enters the score
    var n = NCYL[lk]; if (!n || (!rot && cfg && cfg.cycle === "two")) return null;   // unknown layout (Deltic, future ones) or a two-stroke: synth only
    var L = rot ? 1.3 : litres(cfg, n), asp = aspOf(cfg), fuel = diesel ? "diesel" : "gas";
    var best = null, bs = 1e9, list = [];
    for (var i = 0; i < SETS.length; i++) {
      var s = SETS[i]; if (s.fuel !== fuel) continue;
      var lay = s.lay.indexOf(lk) >= 0 ? 0 : (s.alt && s.alt[lk] != null) ? s.alt[lk] : -1;
      if (lay < 0) continue;
      var sc = lay + 1.1 * Math.abs(Math.log(L / s.L)) + (s.asp === asp ? 0 : 0.12)
               + (s.hi ? ((+(cfg && cfg.redline) || 0) >= 7800 ? -0.35 : 0.6) : 0)     // the high-rev set only for screamers
               + (s.lope ? ((+(cfg && cfg.cam) || 0) >= 60 ? -0.4 : 0.35) : 0);         // the lumpy hot-rod idle only for big cams
      list.push({ s: s, sc: sc, lay: lay });
      if (sc < bs) { bs = sc; best = list[list.length - 1]; }
    }
    if (!best || bs > 2.2) return null;
    var res = { a: best.s, b: null, w: 0, fit: best.lay === 0 ? 1 : clamp(1 - best.lay, 0.35, 0.8) };
    /* neighbour band on the other side of the build's displacement, same layout match level */
    var side = L >= best.s.L ? 1 : -1, nb = null;
    for (var j = 0; j < list.length; j++) {
      var c = list[j]; if (c.s === best.s || c.lay !== best.lay || c.s.asp !== best.s.asp || !c.s.hi !== !best.s.hi || !c.s.lope !== !best.s.lope) continue;
      if ((c.s.L - best.s.L) * side <= 0) continue;
      if (!nb || Math.abs(c.s.L - L) < Math.abs(nb.s.L - L)) nb = c;
    }
    if (nb && L !== best.s.L) {
      var w = Math.log(L / best.s.L) / Math.log(nb.s.L / best.s.L);
      if (w > 0.08) { res.b = nb.s; res.w = clamp(w, 0, 0.5); }
    }
    return res;
  }

  function fetchClip(id) {
    if (cache[id] || loading[id] || failed[id] || !ctx) return;
    var c = CLIPS[id]; if (!c) return;
    loading[id] = true;
    var ac = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var to = setTimeout(function () { if (ac) ac.abort(); }, 15000);
    fetch(BASE + c.f, ac ? { signal: ac.signal } : {}).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.arrayBuffer();
    }).then(function (ab) {
      stat.fetched++; stat.bytes += ab.byteLength;
      return new Promise(function (res, rej) {          // callback form: old Safari has no promise decodeAudioData
        var p = ctx.decodeAudioData(ab, res, rej); if (p && p.catch) p.catch(rej);
      });
    }).then(function (buf) {
      clearTimeout(to); delete loading[id]; cache[id] = buf; stat.decoded++;
    }).catch(function (e) {
      clearTimeout(to); delete loading[id]; failed[id] = true; stat.errors++;
      if (typeof console !== "undefined" && console.debug) console.debug("[sound] sample unavailable, synth only:", c.f, e && e.message);
    });
  }
  function want(s) { if (s) s.loops.forEach(fetchClip); }
  function ready(s) { return !!s && s.loops.every(function (id) { return cache[id]; }); }
  /* phones keep decoded audio small: drop buffers no current set uses once there are more than 6 */
  function trim() {
    var keep = {}, ids = Object.keys(cache); if (ids.length <= 8) return;
    G.forEach(function (g) { if (g) g.set.loops.forEach(function (id) { keep[id] = 1; }); });
    if (pick) [pick.a, pick.b].forEach(function (st) { if (st) st.loops.forEach(function (id) { keep[id] = 1; }); });   // never evict what is still loading
    ["crank", "crank_dsl"].concat(SHOT_IDS).forEach(function (k) { keep[k] = 1; });
    ids.forEach(function (id) { if (!keep[id]) delete cache[id]; });
  }

  function ensureGraph() {
    if (out || !host) return !!out;
    var H = host(); ctx = H.ctx; if (!ctx || !H.bus) return false;
    out = ctx.createGain(); out.gain.value = 0;
    lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 6000; lp.Q.value = 0.5;
    lp.connect(out); out.connect(H.bus);
    return true;
  }
  function mkVoice(id) {
    var c = CLIPS[id], b = cache[id];
    var s = ctx.createBufferSource(); s.buffer = b; s.loop = true;
    s.loopStart = c.loop[0]; s.loopEnd = c.loop[1];
    var g = ctx.createGain(); g.gain.value = 0;
    s.connect(g); g.connect(lp);
    s.start(ctx.currentTime + 0.01, c.loop[0] + Math.random() * (c.loop[1] - c.loop[0]) * 0.9);
    return { id: id, c: c, s: s, g: g, gv: 0, rv: 1 };
  }
  function kill(v) { if (!v) return; try { v.s.stop(); } catch (e) {} try { v.s.disconnect(); v.g.disconnect(); } catch (e) {} }
  function killG(i) { var g = G[i]; if (!g) return; for (var k in g.v) kill(g.v[k]); G[i] = null; }
  function mkGroup(s) { return { set: s, v: {} }; }          // voices are made on demand: only the two loops around the rpm play
  function silence() { killG(0); killG(1); }
  function nSources() { var n = 0; G.forEach(function (g) { if (g) n += Object.keys(g.v).length; }); return n; }

  function rateFor(c, rpm, n) { return (rpm * n) / (c.rpm * c.cyl); }   // put the clip's firing frequency on the build's
  function cover(r) { return sstep(0.42, 0.55, r) * (1 - sstep(2.3, 2.6, r)); }
  function glide(v, field, tgt, tc, dt) { v[field] = (v[field] || 0) + (tgt - (v[field] || 0)) * (1 - Math.exp(-dt / tc)); return v[field]; }

  /* drive one group. The set's loops sit at their own rpm (idle → mid → high); the two loops either
     side of the build's rpm crossfade in log-rpm, throttle leans toward the next loop up (a loaded
     engine sounds like a busier one), and each loop fades out where its pitch shift would exceed
     0.5–2.5×. Loops not in use have no source node at all. */
  function drive(g, wGroup, rpm, load, n, lvl, dt) {
    var L = g.set.loops, m = L.length, w = [], i, r = rpm * (1 + 0.22 * load), at = [];
    for (i = 0; i < m; i++) { at.push(CLIPS[L[i]].rpm * CLIPS[L[i]].cyl / n); w.push(0); }
    if (r <= at[0]) w[0] = 1; else if (r >= at[m - 1]) w[m - 1] = 1;
    else for (i = 0; i < m - 1; i++) if (r >= at[i] && r < at[i + 1]) {
      var t = sstep(0, 1, Math.log(r / at[i]) / Math.log(at[i + 1] / at[i])); w[i] = Math.cos(t * Math.PI / 2); w[i + 1] = Math.sin(t * Math.PI / 2);
    }
    var cov2 = 0, o = { rI: 0, rR: 0, gI: 0, gR: 0 }, k = 0;
    for (i = 0; i < m; i++) {
      var id = L[i], c = CLIPS[id], rate = rateFor(c, rpm, n), wi = w[i] * cover(rate), v = g.v[id];
      if (wi * lvl > 0.001 && !v) v = g.v[id] = mkVoice(id);
      if (!v) continue;
      v.s.playbackRate.value = glide(v, "rv", clamp(rate, 0.3, 3), 0.025, dt);
      v.g.gain.value = glide(v, "gv", wi * wGroup * lvl, 0.06, dt);
      v.tw = wi * lvl;
      if (v.tw <= 0.001 && v.gv < 0.01) { kill(v); delete g.v[id]; continue; }
      cov2 += wi * wi;
      if (k === 0) { o.rI = rate; o.gI = v.gv; } else { o.rR = rate; o.gR = v.gv; } k++;
    }
    /* hard cap: two sources per group — drop the quietest loop that is on its way out */
    var ks = Object.keys(g.v);
    while (ks.length > 2) {
      ks.sort(function (a, b) { return (g.v[a].tw > 0.001) - (g.v[b].tw > 0.001) || g.v[a].gv - g.v[b].gv; });
      kill(g.v[ks[0]]); delete g.v[ks[0]]; ks.shift();
    }
    o.cov = Math.sqrt(cov2); return o;
  }

  /* called by the ENGINE_SOUND.set() wrapper every frame BEFORE the synth runs */
  function update(o) {
    if (!host) return;
    var H = host();
    var now = nowMs();
    var dt = lastT ? clamp((now - lastT) / 1000, 0.001, 0.1) : 0.016; lastT = now;
    if (MODE === "synth" || !H.running) { ENGINE_SOUND.setSynthMix(1); stat.mix = 1; fadeOut(dt); return; }
    var cfg = o.cfg || null, lk = (cfg && cfg.layout) || null, n = NCYL[lk] || 4;
    var key = cfg ? [lk, cfg.cycle, cfg.bore, cfg.stroke, cfg.asp, !!o.diesel, H.lite ? 1 : 0, (+cfg.redline || 0) >= 7800 ? 1 : 0, (+cfg.cam || 0) >= 60 ? 1 : 0].join("|") : pickKey;   // + the redline/cam gates choose() scores on
    if (key !== pickKey) { pickKey = key; pick = cfg ? choose(cfg, lk, !!o.diesel) : null; }
    var A = pick && pick.a, B = pick && !H.lite ? pick.b : null;
    var lazyOk = !SLOW || MODE === "real";
    if (A && lazyOk) { want(A); if (B) want(B); }
    /* (re)build voice groups when the chosen sets are decoded */
    if (ctx && ensureGraph()) {
      if (A && ready(A) && (!G[0] || G[0].set !== A)) { if (G[1] && G[1].set === A) { var t = G[0]; G[0] = G[1]; G[1] = t; } else { killG(0); G[0] = mkGroup(A); } }
      if (!A && G[0]) killG(0);
      if (B && ready(B) && (!G[1] || G[1].set !== B)) { killG(1); G[1] = mkGroup(B); }
      if (!B && G[1]) killG(1);
      trim();
    }
    var rpm = +o.rpm || 0, load = clamp(+o.load || 0, 0, 1);
    var live = rpm > 120 && !H.dead && (H.solo === "all" || H.solo === "nolimiter") && now > holdUntil;
    var lvl = live ? 1 : 0, cov = 0, w2 = (G[1] && G[0]) ? pick.w : 0;
    try {
      if (G[0]) { var d0 = drive(G[0], 1 - w2, rpm, load, n, lvl, dt); cov += d0.cov * (1 - w2); stat.rateI = +d0.rI.toFixed(3); stat.rateR = +d0.rR.toFixed(3); stat.gI = +d0.gI.toFixed(3); stat.gR = +d0.gR.toFixed(3); }
      if (G[1]) { var d1 = drive(G[1], w2, rpm, load, n, lvl, dt); cov += d1.cov * w2; }
      /* closed throttle sounds muffled, on load the pipe opens up */
      if (lp) lp.frequency.value = clamp(1400 + 7000 * Math.pow(load, 0.8) + rpm * 0.35, 900, 9000);
    } catch (e) {}
    if (!live || !G[0]) cov = 0;
    cov = clamp(cov, 0, 1) * (pick ? pick.fit : 0);
    presence += (cov - presence) * (1 - Math.exp(-dt / 0.12));
    stat.cover = +presence.toFixed(3); stat.set = G[0] ? G[0].set.k : null; stat.set2 = G[1] ? G[1].set.k : null;
    stat.setName = G[0] ? G[0].set.name : null; stat.set2Name = G[1] ? G[1].set.name : null; stat.w2 = +w2.toFixed(2); stat.sources = nSources();
    /* the synth keeps the build's character in Blend; in Real it only fills where the recordings cannot reach */
    var mix = MODE === "real" ? 1 - presence * 0.92 : 1 - presence * 0.5;
    stat.mix = +mix.toFixed(3);
    ENGINE_SOUND.setSynthMix(mix);
    if (out) try { out.gain.value = glide(stat, "_og", (MODE === "real" ? 1.0 : 0.8), 0.1, dt); } catch (e) {}
  }
  function fadeOut(dt) {
    presence = 0; stat.cover = 0;
    if (!out) return;
    try { out.gain.value = glide(stat, "_og", 0, 0.08, dt); } catch (e) {}
    if (stat._og < 0.002 && (G[0] || G[1])) silence();
  }

  function start() { running = true; lastT = 0; if (stopT) { clearTimeout(stopT); stopT = null; } }
  function stop() {
    running = false;
    if (stopT) clearTimeout(stopT);
    stopT = setTimeout(function () { if (!running) { silence(); stat._og = 0; if (out) out.gain.value = 0; } }, 400);
  }
  /* recorded one-shot: the starter crank (gasoline / diesel) while the synth also cranks */
  function event(name) {
    if (MODE === "synth" || !host) return;
    if (name === "start") {
      holdUntil = nowMs() + 620;                                   // loops stay silent while it cranks, like the synth
      var H = host(), id = H.diesel ? "crank_dsl" : "crank";
      if (!CLIPS[id]) return;
      if (!cache[id]) { fetchClip(id); return; }
      if (!ensureGraph()) return;
      var s = ctx.createBufferSource(); s.buffer = cache[id];
      var g = ctx.createGain(); g.gain.value = (CLIPS[id].gain || 1) * (MODE === "real" ? 0.9 : 0.6);
      s.connect(g); g.connect(H.bus);
      s.start(ctx.currentTime, 0, Math.min(cache[id].duration, 0.8));
      s.onended = function () { try { s.disconnect(); g.disconnect(); } catch (e) {} };
    } else if (name === "fail") { presence = 0; }
  }

  /* a recorded blow-off / backfire / anti-lag bang. Returns false (the synth plays its own) when the voice is
     Synth or no variant is decoded yet; a miss starts fetching that kind so the next one is recorded. */
  function shot(kind, amt) {
    var S = SHOTS[kind]; if (MODE === "synth" || !host || !S) return false;
    var H = host(); if (!H.ctx || !H.bus || H.dead) return false;
    ctx = H.ctx;
    var have = S.ids.filter(function (id) { return cache[id]; });
    if (!have.length) { if (!SLOW || MODE === "real") S.ids.forEach(fetchClip); return false; }
    if (shotN >= (H.lite ? 4 : 8)) return true;                 // anti-lag can fire every 35 ms: cap the overlap, drop the extra bang
    var id = have[(Math.random() * have.length) | 0];
    var src = ctx.createBufferSource(); src.buffer = cache[id];
    src.playbackRate.value = S.rate[0] + Math.random() * (S.rate[1] - S.rate[0]);
    var g = ctx.createGain(); g.gain.value = S.gain * clamp(+amt || 1, 0.2, 1.3) * (MODE === "real" ? 1 : 0.9);
    src.connect(g); g.connect(H.bus);
    shotN++; stat.shots++;
    src.onended = function () { shotN--; try { src.disconnect(); g.disconnect(); } catch (e) {} };
    src.start(ctx.currentTime);
    return true;
  }

  function prefetch() {
    if (MODE === "synth" || !host) return;
    var H = host(); if (!H.ctx) return; ctx = H.ctx;
    if (SLOW && MODE !== "real") return;
    ["crank", "crank_dsl"].concat(SHOT_IDS).forEach(function (id) { if (CLIPS[id]) fetchClip(id); });
  }
  function attach(ES) {
    if (!ES || ES._samples || !ES.sampleHost) return;
    ES._samples = true;
    host = ES.sampleHost;
    if (ES.setShotHook) ES.setShotHook(shot);
    var _set = ES.set, _start = ES.start, _stop = ES.stop, _event = ES.event;
    ES.set = function (o) { try { update(o || {}); } catch (e) {} return _set.apply(ES, arguments); };
    ES.start = function () { var r = _start.apply(ES, arguments); start(); prefetch(); return r; };
    ES.stop = function () { stop(); return _stop.apply(ES, arguments); };
    ES.event = function (nm) { var r = _event.apply(ES, arguments); try { if (nm === "start") { start(); prefetch(); } event(nm); } catch (e) {} return r; };
  }
  function setMode(m) {
    MODE = (m === "synth" || m === "real") ? m : "blend";
    if (MODE === "synth") ENGINE_SOUND.setSynthMix(1); else prefetch();
  }

  if (typeof ENGINE_SOUND !== "undefined") attach(ENGINE_SOUND);
  return {
    setMode: setMode, get mode() { return MODE; },
    choose: choose, clips: CLIPS, sets: SETS, credits: CREDITS,
    stats: function () { var s = {}; for (var k in stat) if (k[0] !== "_") s[k] = stat[k]; s.cached = Object.keys(cache); s.failed = Object.keys(failed); s.mode = MODE; s.slow = SLOW; return s; }
  };
})();
if (typeof window !== "undefined") window.ENGINE_SAMPLES = ENGINE_SAMPLES;
</script>
<!-- ENGINE_SAMPLES:END -->
