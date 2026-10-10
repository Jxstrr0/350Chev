  /* ------------------------------------------------------------------ *
   * 8. Module state
   * ------------------------------------------------------------------ */
  var ctx = null, running = false, dead = false, inited = false, toneIn = null;
  var LITE = IS_MOBILE;
  var SOLO = "all";   /* diagnostics: all | exhaust | intake | sub | mech | raw | nolimiter */
  function solo(name) {
    SOLO = name || "all";
    if (master && limiter && ctx) {
      try { master.disconnect(); } catch (e) {}
      if (SOLO === "nolimiter") master.connect(ctx.destination); else master.connect(toneIn);
      if (watchAn) master.connect(watchAn);
    }
    if (N && N.rawG) ap(N.rawG.gain, SOLO === "raw" ? 0.35 : 0, 0.05);
  }
  function soloGain(layer) { if (SOLO === "all" || SOLO === "nolimiter") return SYNTH_MIX; if (SOLO === "raw") return 0; return SOLO === layer ? 1 : 0; }
  /* ENGINE_SAMPLES (recorded layer) ducks the synth's core voice (exhaust, sub, intake, mech) by this; 1 = synth alone */
  var SYNTH_MIX = 1;
  function peak() {
    if (!ctx || !watchAn || !watchBuf) return null;
    try { watchAn.getFloatFrequencyData(watchBuf); } catch (e) { return null; }
    var binHz = ctx.sampleRate / watchAn.fftSize, best = -200, bi = 0, lo = -200, i;
    for (i = 1; i < watchBuf.length; i++) { if (watchBuf[i] > best) { best = watchBuf[i]; bi = i; } if (i * binHz < 420 && watchBuf[i] > lo) lo = watchBuf[i]; }
    var amp = 0; try { if (!peak.td) peak.td = new Float32Array(watchAn.fftSize); watchAn.getFloatTimeDomainData(peak.td); for (i = 0; i < peak.td.length; i++) amp = Math.max(amp, Math.abs(peak.td[i])); } catch (e) {}
    return { hz: Math.round(bi * binHz), db: Math.round(best), lo: Math.round(lo), amp: +amp.toFixed(3), state: ctx.state, sr: ctx.sampleRate };   // amp: sample peak over the last ~43 ms (catches a bang)
  }   /* lite: no reverb, no valvetrain/gear layer — cheaper and never shrill on a phone speaker */
  function setQuality(q) { LITE = (q === "lite"); if (wetG && dryG) { ap(wetG.gain, LITE ? 0 : (curProf ? curProf.wet : 0.18), 0.1); ap(dryG.gain, LITE ? 1 : (1 - (curProf ? curProf.wet : 0.18) * 0.6), 0.1); } }
  var master = null, limiter = null, bus = null, conv = null, wetG = null, dryG = null;
  var N = null;                    // persistent node bag
  var curProf = null, curLayoutKey = null, curWaveKey = "";
  var volume = 0.85;
  var st = {                       // last values pushed through set()
    rpm: 900, load: 0, boost: 0, vvlOn: false, crackleT: 0, lastT: 0,
    lambda: 0.98, exhaust: "cast_tubular", profId: null
  };
  var tmp = [];                    // transient event nodes

  function nowT() { return ctx ? ctx.currentTime : 0; }

  // cheap guarded AudioParam automation (avoids 900 calls/s of no-ops)
  /* Parameter control without AudioParam automation.
     A test iPhone ignored every setTargetAtTime() — the exhaust sat at the oscillator's default
     440 Hz (1,760 / 3,520 Hz = the 4th and 8th orders of an inline-four wave) and gains never
     followed load. Direct .value writes did work, so all per-frame control is now a JS smoother
     that writes .value toward a target with the requested time constant. */
  var SMOOTH = [], smoothT = null, smoothLast = 0, graphGen = 0;
  function ap(param, v, tc) {
    if (!param || !isFinite(v)) return;
    param._tgt = v; param._tc = tc || 0.03;
    if (param._gen !== graphGen) { param._gen = graphGen; SMOOTH.push(param); }
    if (param._cur === undefined) { param._cur = (typeof param.value === "number" && isFinite(param.value)) ? param.value : v; }
  }
  function smoothTick() {
    var now = (typeof performance !== "undefined") ? performance.now() : Date.now();
    var dt = smoothLast ? Math.min(0.06, (now - smoothLast) / 1000) : 0.016; smoothLast = now;
    var keep = [];
    for (var i = 0; i < SMOOTH.length; i++) {
      var p = SMOOTH[i];
      if (p._gen !== graphGen && p._gen !== -1) continue;       /* param of a torn-down graph */
      keep.push(p);
      if (p._tgt === undefined) continue;
      var cur = p._cur, tgt = p._tgt;
      if (!isFinite(cur)) cur = tgt;
      var a = 1 - Math.exp(-dt / Math.max(0.004, p._tc));
      var nv = cur + (tgt - cur) * a;
      if (Math.abs(nv - tgt) <= Math.abs(tgt) * 2e-4 + 1e-6) nv = tgt;
      if (nv !== cur) { try { p.value = nv; } catch (e) {} }
      p._cur = nv;
    }
    SMOOTH = keep;
  }
  function startSmoother() { if (!smoothT) smoothT = setInterval(smoothTick, 16); }
  function apNow(param, v) {
    if (!param || !isFinite(v)) return;
    try { param.cancelScheduledValues(ctx.currentTime); } catch (e) {}
    param._tgt = v; param._cur = v; try { param.value = v; } catch (e) {}
    param.setValueAtTime(v, ctx.currentTime);
    param._ew = v;
  }

  /* ------------------------------------------------------------------ *
   * 9. init()
   * ------------------------------------------------------------------ */
  function ensureCtx() {
    if (ctx) return ctx;
    var AC = (typeof window !== "undefined") && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    try { ctx = new AC({ latencyHint: "interactive" }); }
    catch (e) { try { ctx = new AC(); } catch (e2) { return null; } }
    return ctx;
  }

  function resume() {
    if (ctx && ctx.state === "suspended" && ctx.resume) { try { ctx.resume(); } catch (e) {} }
  }

  function init() {
    if (!ensureCtx()) return false;
    resume();
    if (inited) return true;
    inited = true;

    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8; limiter.knee.value = 6;
    limiter.ratio.value = 12; limiter.attack.value = 0.004; limiter.release.value = 0.16;

    master = ctx.createGain();
    master.gain.value = 0;                 // silent until start()
    /* tone: phone speakers have no bass, so everything you hear is the top end — keep it civil */
    var shelf = ctx.createBiquadFilter(); shelf.type = "highshelf"; shelf.frequency.value = 2800; shelf.gain.value = -7;
    var top = ctx.createBiquadFilter(); top.type = "lowpass"; top.frequency.value = 8500; top.Q.value = 0.6;
    var body = ctx.createBiquadFilter(); body.type = "peaking"; body.frequency.value = 320; body.Q.value = 0.9; body.gain.value = 3.5;
    toneIn = shelf; master.connect(shelf); shelf.connect(top); top.connect(body); body.connect(limiter);
    limiter.connect(ctx.destination);

    bus = ctx.createGain(); bus.gain.value = 1;
    dryG = ctx.createGain(); dryG.gain.value = 0.82;
    wetG = ctx.createGain(); wetG.gain.value = 0.18;
    master.gain._gen = -1; dryG.gain._gen = -1; wetG.gain._gen = -1; SMOOTH.push(master.gain, dryG.gain, wetG.gain);
    startSmoother();
    conv = ctx.createConvolver(); conv.buffer = makeIR(ctx); conv.normalize = true;
    bus.connect(dryG); dryG.connect(master);
    bus.connect(conv); conv.connect(wetG); wetG.connect(master);

    if (typeof document !== "undefined" && !init._hooked) {
      init._hooked = true;
      var wake = function () { resume(); };
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) resume();
        else if (ctx && ctx.state === "running" && ctx.suspend) { try { ctx.suspend(); } catch (e) {} }   /* perf: a hidden tab stops the audio thread (and the battery drain) */
      }, false);
      ["touchstart", "touchend", "pointerdown", "mousedown", "keydown"]
        .forEach(function (ev) { document.addEventListener(ev, wake, { passive: true }); });
    }
    return true;
  }

  /* ------------------------------------------------------------------ *
   * 10. Voice graph construction (once per start())
   * ------------------------------------------------------------------ */
  function buildGraph() {
    if (N) return;
    graphGen++;
    var g = {};

    /* --- exhaust ------------------------------------------------------ */
    g.exhOsc = IS_MOBILE ? new BufferOsc(ctx) : ctx.createOscillator();
    g.pre = ctx.createGain(); g.pre.gain.value = 1.4;
    g.shaper = ctx.createWaveShaper(); g.shaper.curve = makeCurve(); g.shaper.oversample = IS_MOBILE ? "none" : "2x";
    g.post = ctx.createGain(); g.post.gain.value = 0.7;
    g.f1 = ctx.createBiquadFilter(); g.f1.type = "peaking";
    g.f2 = ctx.createBiquadFilter(); g.f2.type = "peaking";
    g.f3 = ctx.createBiquadFilter(); g.f3.type = "peaking";
    g.lp = ctx.createBiquadFilter(); g.lp.type = "lowpass"; g.lp.frequency.value = 4000; g.lp.Q.value = 0.7;
    g.hp = ctx.createBiquadFilter(); g.hp.type = "highpass"; g.hp.frequency.value = 45; g.hp.Q.value = 0.6;
    g.exhG = ctx.createGain(); g.exhG.gain.value = 0.0;
    g.exhOsc.connect(g.pre); g.pre.connect(g.shaper); g.shaper.connect(g.post);
    g.rawG = ctx.createGain(); g.rawG.gain.value = 0; g.exhOsc.connect(g.rawG); g.rawG.connect(master);
    g.post.connect(g.f1); g.f1.connect(g.f2); g.f2.connect(g.f3);
    g.pf = ctx.createBiquadFilter(); g.pf.type = "peaking"; g.pf.frequency.value = 900; g.pf.Q.value = 2.4; g.pf.gain.value = 0;   // two-stroke pipe resonance (0 dB = not there)
    g.f3.connect(g.pf); g.pf.connect(g.lp); g.lp.connect(g.hp); g.hp.connect(g.exhG); g.exhG.connect(bus);

    /* --- sub thump ---------------------------------------------------- */
    g.subOsc = ctx.createOscillator(); g.subOsc.type = "sine";
    g.subG = ctx.createGain(); g.subG.gain.value = 0;
    g.subOsc.connect(g.subG); g.subG.connect(bus);

    /* --- shared noise source ------------------------------------------ */
    g.noise = ctx.createBufferSource();
    g.noise.buffer = makeNoise(ctx); g.noise.loop = true;

    /* --- intake -------------------------------------------------------- */
    g.inNoiseG = ctx.createGain(); g.inNoiseG.gain.value = 0.9;
    g.inToneG = ctx.createGain(); g.inToneG.gain.value = 0.0;
    g.inBP = ctx.createBiquadFilter(); g.inBP.type = "bandpass";
    g.inBP.frequency.value = 300; g.inBP.Q.value = 1.2;
    g.inG = ctx.createGain(); g.inG.gain.value = 0;
    g.noise.connect(g.inNoiseG); g.inNoiseG.connect(g.inBP);
    g.exhOsc.connect(g.inToneG); g.inToneG.connect(g.inBP);
    g.inBP.connect(g.inG); g.inG.connect(bus);

    /* --- mechanical: valvetrain tick + gear whine ---------------------- */
    g.mechOsc = ctx.createOscillator(); g.mechOsc.setPeriodicWave(buildMechWave(ctx));
    g.mechHP = ctx.createBiquadFilter(); g.mechHP.type = "highpass";
    g.mechHP.frequency.value = 2200; g.mechHP.Q.value = 0.8;
    g.mechG = ctx.createGain(); g.mechG.gain.value = 0;
    g.mechOsc.connect(g.mechHP); g.mechHP.connect(g.mechG); g.mechG.connect(bus);

    g.gearOsc = ctx.createOscillator(); g.gearOsc.type = "sine"; g.gearOsc.frequency.value = 120;
    g.gearG = ctx.createGain(); g.gearG.gain.value = 0;
    g.gearOsc.connect(g.gearG); g.gearG.connect(bus);

    /* --- diesel clatter: noise burst gated by a spike train at the firing rate (silent unless diesel) --- */
    g.clOsc = ctx.createOscillator(); g.clOsc.setPeriodicWave(buildClatterWave(ctx));
    g.clNoise = ctx.createBufferSource(); g.clNoise.buffer = makeNoise(ctx); g.clNoise.loop = true;
    g.clNoise.playbackRate.value = 1.3;
    g.clHP = ctx.createBiquadFilter(); g.clHP.type = "highpass"; g.clHP.frequency.value = 900; g.clHP.Q.value = 0.7;
    g.clBP = ctx.createBiquadFilter(); g.clBP.type = "bandpass"; g.clBP.frequency.value = 2300; g.clBP.Q.value = 1.1;
    g.clAm = ctx.createGain(); g.clAm.gain.value = 0;        // base = spike-train mean, spikes add on top
    g.clD = ctx.createGain(); g.clD.gain.value = 0;          // spike depth
    g.clG = ctx.createGain(); g.clG.gain.value = 0;
    g.clNoise.connect(g.clHP); g.clHP.connect(g.clBP); g.clBP.connect(g.clAm); g.clAm.connect(g.clG); g.clG.connect(bus);
    g.clOsc.connect(g.clD); g.clD.connect(g.clAm.gain);
    /* --- rotary brap: an irregular gate on the exhaust gain (silent unless a rotary at idle) --- */
    g.brOsc = ctx.createOscillator(); g.brOsc.setPeriodicWave(buildBrapWave(ctx)); g.brOsc.frequency.value = 5;
    g.brD = ctx.createGain(); g.brD.gain.value = 0;
    g.brOsc.connect(g.brD); g.brD.connect(g.exhG.gain);

    /* --- forced induction ---------------------------------------------- */
    g.blowA = ctx.createOscillator(); g.blowA.type = "sine"; g.blowA.frequency.value = 700;
    g.blowB = ctx.createOscillator(); g.blowB.type = "sine"; g.blowB.frequency.value = 705;
    g.blowBP = ctx.createBiquadFilter(); g.blowBP.type = "bandpass";
    g.blowBP.frequency.value = 4000; g.blowBP.Q.value = 1.1;
    g.blowG = ctx.createGain(); g.blowG.gain.value = 0;
    g.blowA.connect(g.blowBP); g.blowB.connect(g.blowBP);
    g.blowBP.connect(g.blowG); g.blowG.connect(bus);

    /* --- wastegate flutter / boost hiss --------------------------------- */
    g.wgHP = ctx.createBiquadFilter(); g.wgHP.type = "bandpass";
    g.wgHP.frequency.value = 2600; g.wgHP.Q.value = 0.9;
    g.wgG = ctx.createGain(); g.wgG.gain.value = 0;
    g.noise.connect(g.wgHP); g.wgHP.connect(g.wgG); g.wgG.connect(bus);
    g.lfo = ctx.createOscillator(); g.lfo.type = "square"; g.lfo.frequency.value = 22;
    g.lfoG = ctx.createGain(); g.lfoG.gain.value = 0;
    g.lfo.connect(g.lfoG); g.lfoG.connect(g.wgG.gain);

    /* --- tyre scream (burnout / wheelspin): two resonant bands of the shared noise -- */
    g.tyreA = ctx.createBiquadFilter(); g.tyreA.type = "bandpass"; g.tyreA.frequency.value = 1650; g.tyreA.Q.value = 5;
    g.tyreB = ctx.createBiquadFilter(); g.tyreB.type = "bandpass"; g.tyreB.frequency.value = 2900; g.tyreB.Q.value = 7;
    g.tyreG = ctx.createGain(); g.tyreG.gain.value = 0;
    g.noise.connect(g.tyreA); g.noise.connect(g.tyreB); g.tyreA.connect(g.tyreG); g.tyreB.connect(g.tyreG); g.tyreG.connect(bus);

    var t = nowT();
    g.exhOsc.start(t); g.subOsc.start(t); g.noise.start(t);
    g.mechOsc.start(t); g.gearOsc.start(t); g.clOsc.start(t); g.clNoise.start(t); g.brOsc.start(t);
    g.blowA.start(t); g.blowB.start(t); g.lfo.start(t);

    N = g;
    curWaveKey = "";
    applyProfile(curProf || profiles.i4_turbo, true);
  }

  function killGraph() {
    if (!N) return;
    var g = N; N = null;
    var t = nowT();
    ["exhOsc", "subOsc", "noise", "mechOsc", "gearOsc", "clOsc", "clNoise", "blowA", "blowB", "lfo", "brOsc"]
      .forEach(function (k) { try { g[k].stop(t + 0.02); } catch (e) {} });
    setTimeout(function () {
      for (var k in g) { try { g[k].disconnect(); } catch (e) {} }
    }, 120);
  }

  /* ------------------------------------------------------------------ *
   * 11. Apply a profile (rebuild wavetable + static filter voicing)
   * ------------------------------------------------------------------ */
  // an unequal-length header is a fixed distance of pipe: rebuild the table when
  // the crank angle that distance occupies moves into a new band
  function phaseBandApply(rpm) {
    if (!curProf || !curProf.bankDelayMs || !N || !N.exhOsc) return;
    var want = bankPhaseAt(curProf, rpm);
    if (want[1] === curProf.bankPhase[1]) return;
    curProf.bankPhase = want;
    var w = buildFiringWave(ctx, curProf, LAY[curProf.layout] || LAY.I4);
    if (w) N.exhOsc.setPeriodicWave(w);
  }

  function applyProfile(p, force) {
    if (!N || !p) return;
    var L = LAY[p.layout] || LAY.I4;
    var wk = waveKey(p, L);
    if (force || wk !== curWaveKey) {
      N.exhOsc.setPeriodicWave(buildFiringWave(ctx, p, L));
      curWaveKey = wk;
    }
    var ex = EXH[p.exh] || EXH.cast_tubular;
    var f = ex.form, sv = p.sys || null, fq = sv ? sv.fq : 1;
    apNow(N.f1.frequency, f[0][0] * fq); N.f1.Q.value = f[0][1]; apNow(N.f1.gain, f[0][2] + (sv ? sv.body : 0));
    apNow(N.f2.frequency, f[1][0] * fq); N.f2.Q.value = f[1][1]; apNow(N.f2.gain, f[1][2] + (sv ? sv.rasp * 0.4 : 0));
    apNow(N.f3.frequency, f[2][0] * fq); N.f3.Q.value = f[2][1]; apNow(N.f3.gain, f[2][2] + (sv ? sv.rasp : 0));
    N.inBP.Q.value = p.intake.q;
    ap(wetG.gain, LITE ? 0 : p.wet, 0.08);
    ap(dryG.gain, LITE ? 1 : 1 - p.wet * 0.6, 0.08);
    curProf = p;
    curLayoutKey = p.layout;
  }

  /* ------------------------------------------------------------------ *
   * 12. start / stop
   * ------------------------------------------------------------------ */
  /* --- self-healing: iOS interrupts (calls, screen recording, route changes) can leave the graph
         with a dead exhaust and a stuck oscillator tone. Rebuild fresh nodes when that happens. --- */
  var watchAn = null, watchT = null, lastRebuild = 0, watchBuf = null;
  function rebuildGraph(why) {
    if (!ctx || !running) return;
    var now = (typeof performance !== "undefined") ? performance.now() : Date.now();
    if (now - lastRebuild < 1500) return;
    lastRebuild = now;
    var prof = curProf;
    killGraph();
    curProf = null;
    buildGraph();
    if (prof) applyProfile(prof, true);
    solo(SOLO);
    if (typeof console !== "undefined" && console.debug) console.debug("[sound] graph rebuilt:", why);
  }
  function watchdog() {
    if (!ctx || !running || !N || !master) return;
    try {
      if (!watchAn) { watchAn = ctx.createAnalyser(); watchAn.fftSize = 2048; watchAn.smoothingTimeConstant = 0.5; master.connect(watchAn); }
      if (!watchBuf) watchBuf = new Float32Array(watchAn.frequencyBinCount);
      watchAn.getFloatFrequencyData(watchBuf);
      var binHz = ctx.sampleRate / watchAn.fftSize, lo = -200, hi = -200, i;
      for (i = 1; i < watchBuf.length; i++) { var f = i * binHz; if (f < 420) { if (watchBuf[i] > lo) lo = watchBuf[i]; } else if (f > 1000 && f < 6000) { if (watchBuf[i] > hi) hi = watchBuf[i]; } }
      /* engine should be audible but the low end is gone while a strong narrow tone sits up top */
      if (SOLO === "all" && !dead && st.rpm > 700 && lo < -70 && hi > -40) rebuildGraph("stuck tone " + Math.round(hi) + " dB, low " + Math.round(lo) + " dB");
    } catch (e) {}
  }
  function armWatch() {
    if (watchT) return;
    watchT = setInterval(function () { if (running && !(typeof document !== "undefined" && document.hidden)) watchdog(); }, 450);   /* perf: no FFT polling in a hidden tab (the context is suspended) */
    if (ctx && !ctx._pewState) {
      ctx._pewState = true;
      var prev = ctx.state;
      ctx.addEventListener("statechange", function () {
        var st2 = ctx.state;
        if (st2 === "running" && running) setTimeout(function () { rebuildGraph("context resumed (was " + prev + ")"); }, 60);
        prev = st2;
      });
    }
  }
  function start() {
    if (!init()) return;
    dead = false;
    buildGraph();
    running = true;
    armWatch(); watchdog(); solo(SOLO);
    try { master.gain.cancelScheduledValues(nowT()); } catch (e) {}
    ap(master.gain, volume, 0.06);
  }

  function stop() {
    if (!ctx || !running) { running = false; return; }
    running = false;
    var t = nowT();
    try { master.gain.cancelScheduledValues(t); } catch (e) {}
    ap(master.gain, 0.0001, 0.06);
    setTimeout(function () { if (!running) killGraph(); }, 260);
  }

  function setVolume(v) {
    volume = clamp(num(v, 0.85), 0, 1);
    if (master && running) ap(master.gain, volume, 0.05);
  }

  /* ------------------------------------------------------------------ *
   * 13. set() — the hot path, ~60 Hz, no allocation, no node creation
   * ------------------------------------------------------------------ */
  function set(o) {
    if (!ctx || !N || !running) return;
    o = o || {};
    // a failure silences the engine; spinning back up brings it back, so a failed
    // pull does not leave the idle mute until the player toggles the sound
    if (dead) { if (num(o.rpm, 0) > 400) dead = false; else return; }

    var cfg = o.cfg || null;
    var dz = !!o.diesel; st.diesel = dz;                 // compression ignition: clatter, no blow-off, no pops
    var lk = (o.layout && o.layout.name && o.layout.n)
      ? (keyForLayoutObj(o.layout, cfg && cfg.layout) || (cfg && cfg.layout) || curLayoutKey)
      : ((cfg && cfg.layout) || curLayoutKey || "I4");

    // --- profile selection (cheap: only re-applies when it actually changes)
    var want = null;
    if (o.profileId && profiles[o.profileId]) want = profiles[o.profileId];
    else if (cfg) want = deriveProfile(cfg, lk, !!o.diesel);
    else if (!curProf) want = profiles.i4_turbo;
    if (want && want !== curProf) applyProfile(want);
    var p = curProf; if (!p) return;
    var L = LAY[p.layout] || LAY.I4, n = L.n;

    var rpmIn = num(o.rpm, st.rpm);
    var live = rpmIn > 120 ? 1 : 0;                    // nothing sounds when nothing is turning
    var rpm = clamp(rpmIn, 250, 14000);
    var load = clamp(num(o.load, st.load), 0, 1);
    var boost = clamp(num(o.boostBar, 0), 0, 4);
    // blow-off on a genuine lift: the throttle shuts while the compressor is
    // still pumping. Latched so it fires once per lift, not once per frame.
    if (boost > 0.25) { st.boostPeak = Math.max(st.boostPeak || 0, boost); st.bovArmed = 1; }
    else if (st.bovArmed && (st.boostPeak || 0) > 0.30 && num(o.load, 1) < 0.18) {
      st.bovArmed = 0; st.boostPeak = 0; if (!dz) event("bov");
    }
    if (cfg) { st.lambda = num(cfg.lambda, 0.98); st.exhaust = cfg.exhaust || p.exh; }
    // o.knock is the WOT retard the sim asked for. Detonation needs cylinder pressure, so it is
    // inaudible at idle and off-throttle: gate it by load and by rpm climbing toward peak torque.
    var knock = clamp(num(o.knock, 0) / 14, 0, 1) * Math.pow(clamp(load, 0, 1), 1.6) * clamp((rpm - 1400) / 1800, 0, 1);
    var wear = clamp(num(o.wear, 0), 0, 1.5); st.wear = wear;
    st.rpm = rpm; st.load = load; st.boost = boost;
    // short memory of recent boost so a lift-off BOV still fires after it collapses.
    // Decayed in real time, so a 30 fps phone and a 60 fps tablet behave the same.
    var nowS = ctx.currentTime;
    var dtSec = clamp(nowS - (st.setT || nowS - 0.016), 0.004, 0.25); st.setT = nowS;
    st.boostPeak = Math.max(boost, (st.boostPeak || 0) * Math.pow(0.30, dtSec));

    phaseBandApply(rpm);
    var cyc = rpm / 120;                     // engine-cycle fundamental (Hz)
    var fire = cyc * n;                      // firing frequency (Hz)
    var rn = clamp(rpm / (p.redline || 7000), 0, 1.4);

    /* --- VVL / VTEC crossover ---------------------------------------- */
    var vvlOn = !!(p.vvl && rpm >= p.vvl.rpm);
    if (p.vvl) {
      // small hysteresis so it doesn't chatter on the threshold
      if (st.vvlOn && rpm > p.vvl.rpm - 180) vvlOn = true;
      st.vvlOn = vvlOn;
    } else st.vvlOn = false;
    var vGain = vvlOn ? p.vvl.gain : 1;
    var vBright = vvlOn ? p.vvl.bright : 1;

    var ind0 = (cfg && cfg.asp) ? indFor(cfg) : p.ind, bt0 = ind0.type;

    /* --- exhaust ------------------------------------------------------ */
    ap(N.exhOsc.frequency, cyc, 0.012);
    var ex = EXH[p.exh] || EXH.cast_tubular;

    // drive/distortion grows with load and rpm. Boost mutes the pulse: a turbine
    // takes the blowdown energy the pipe would otherwise bark out.
    var turbined = (bt0 === "turbo" || bt0 === "twin" || bt0 === "comp") ? 1 : 0.35;
    var muff = 1 - clamp(boost, 0, 4) * 0.115 * turbined;
    // retarded timing dumps burning charge into the pipe: hotter, flatter, harsher
    var sv = p.sys || null;                  // pipe, muffler, cat, cutout (derived profiles only)
    var drive = ex.drive * (0.55 + load * 1.9 + rn * 0.35) * (vvlOn ? 1.12 : 1)
                * clamp(muff, 0.45, 1) * (1 + knock * 0.45) * (dz ? 0.55 : 1) * (sv ? sv.drive : 1);
    ap(N.pre.gain, 0.8 + drive * 2.4, 0.05);
    ap(N.post.gain, 0.62 / (1 + drive * 0.55), 0.05);

    // brightness: low load = closed throttle = muffled
    var lpf = clamp((900 + fire * 9 * (0.35 + 0.85 * load) * (0.35 + 1.1 * ex.tilt)) * vBright
                    * clamp(muff + 0.10, 0.5, 1.1) * (dz ? 0.62 : 1) * (sv ? sv.bright : 1) * (p.rotary ? 1.30 : 1), dz ? 520 : 700, 7500);
    ap(N.lp.frequency, lpf, 0.04);
    ap(N.hp.frequency, clamp(38 + rn * 30, 35, 90), 0.08);

    /* --- nitrous ------------------------------------------------------ */
    // a shot is armed by a window switch, then fed through the same jets every
    // cycle: a harder, flatter crack rather than a different pitch
    var n2oHp = p.n2o || 0;
    var n2oWin = n2oHp ? (p.n2oProg ? 0.42 : 0.55) * (p.redline || 7000) : 0;
    var n2oOn = (n2oHp > 0 && live && rpm >= n2oWin && load > 0.55) ? 1 : 0;
    if (st.n2oGate != null) n2oOn = (n2oHp > 0 && live && st.n2oGate > 0.05 && load > 0.55) ? 1 : 0;   // the strip says when the shot is actually in
    var n2oBite = n2oOn ? clamp(n2oHp / Math.max(600, (p.cyl || 500) * n * 1.2), 0, 1.3)
                        * (p.n2oProg ? clamp((rpm - n2oWin) / (0.28 * (p.redline || 7000)), 0.25, 1) : 1) : 0;
    if (n2oOn && !st.n2oWas) { solenoid(); }
    st.n2oWas = n2oOn;
    if (st.n2oGate != null && n2oBite > 0) n2oBite *= clamp(st.n2oGate, 0.3, 1.1) * 1.15;   // a fatter bark while the shot is in
    if (n2oBite > 0) {
      ap(N.pre.gain, (0.8 + drive * 2.4) * (1 + 0.55 * n2oBite), 0.05);
      ap(N.lp.frequency, clamp(lpf * (1 + 0.30 * n2oBite), 700, 9000), 0.04);
    }

    // level: idle audible, full load loud, normalised across layouts
    var exhLvl = p.level * ex.level * (0.30 + 0.70 * load) * (0.62 + 0.45 * Math.min(1, rpm / 5200))
                 * (sv ? Math.pow(sv.lvl, 0.5 + 0.5 * load) : 1);   // a free system is loudest on the throttle
    /* rotary brap: with port overlap, exhaust backs into the intake at idle and light load and whole
       combustions go missing. A gate with eight uneven slots per period, its rate wandering around an
       eighth of the firing rate, chops the note; it fades as the revs and the throttle come up. */
    var brap = (p.rotary && live) ? clamp(0.12 + p.rot * 1.5, 0, 0.95) * clamp(1 - (rpm - 1000) / 2800, 0, 1) * clamp(1 - load * 1.7, 0, 1) : 0;
    /* two-stroke ring-ding: off the pipe and off the throttle it fires only now and then (four-stroking) */
    if (p.ts && live && p.ringding) brap = clamp(p.ringding * clamp(1 - (rpm - 1200) / 3200, 0, 1) * clamp(1 - load * 2.2, 0, 1), 0, 0.9);
    st.brap = brap;
    if (p.rotary || (p.ts && p.ringding)) ap(N.brOsc.frequency, clamp(fire / 8 * (0.82 + 0.36 * Math.random()), 1, 40), 0.06);
    /* the expansion chamber: a resonance fixed by the pipe, which the firing harmonics sweep through. On the pipe it
       sings and the whole note gets louder and harder: the hit you hear as it comes on the pipe. */
    var onPipe = 0;
    if (p.pipe && N.pf) {
      var pr = p.pipe.rpm;
      onPipe = p.pipe.amp * Math.exp(-0.5 * Math.pow((rpm - pr) / (0.13 * pr), 2)) * (0.35 + 0.65 * load);
      ap(N.pf.frequency, clamp(pr / 60 * 3.1 * (1 + 0.08 * (rpm / pr - 1)), 120, 6000), 0.05);
      ap(N.pf.gain, 2 + 10 * onPipe, 0.06);
      exhLvl *= 1 + 0.45 * onPipe;
    } else if (N.pf && N.pf.gain.value !== 0) ap(N.pf.gain, 0, 0.1);
    st.onPipe = onPipe;
    // lope: a big cam breathes unevenly at low load and smooths out as it comes
    // on the cam, so the wander dies away with rpm and with throttle
    var lopeAmt = ((p.lope || 0) + 0.25 * wear) * clamp(1 - rpm / 2600, 0, 1) * clamp(1 - load * 1.3, 0, 1);
    if (lopeAmt > 0.01) {
      st.lopePh = (st.lopePh || 0) + 0.0135 + Math.random() * 0.018;
      exhLvl *= 1 + lopeAmt * 0.42 * Math.sin(st.lopePh) * (0.6 + 0.4 * Math.sin(st.lopePh * 2.7));
    }
    if (!(st.flareUntil && ctx.currentTime < st.flareUntil))
      ap(N.exhG.gain, live * exhLvl * (1 + 0.30 * n2oBite) * 0.55 * soloGain("exhaust"), 0.03);
    ap(N.brD.gain, brap > 0.005 ? live * exhLvl * 0.55 * 0.9 * brap * soloGain("exhaust") : 0, 0.04);
    /* two-step: the limiter cuts spark on random cycles, so the note stutters; retard makes the
       unburnt charge light off in the pipe as pops (fired from the sim's own bang envelope) */
    var ts2 = (o.twoStep && o.twoStep.on && live && !dz) ? o.twoStep : null;
    if (ts2) {
      var cut = Math.random() < 0.42;
      ap(N.exhG.gain, exhLvl * 0.55 * soloGain("exhaust") * (cut ? 0.2 : 1.12), 0.006);
    }
    var popV = clamp(num(o.pops, 0), 0, 1), tNow = ctx.currentTime;
    if (live && !dz && popV > (st.popV || 0) + 0.12 && tNow - (st.popT || -9) > (LITE ? 0.2 : 0.12)) { st.popT = tNow; pop(0.22 + 0.55 * popV); }
    st.popV = popV;
    /* anti-lag: fuel lit in the manifold with the throttle shut. Loud, irregular detonations, never a steady
       rhythm: a bang every 35-250 ms while it fires (o.als 0..1 = how hard; secondary air is the harder one) */
    var alsV = (live && !dz) ? clamp(num(o.als, 0), 0, 1) : 0;
    if (alsV > 0.05) {
      if (tNow >= (st.alsT || 0)) {
        st.alsT = tNow + (0.035 + 0.22 * Math.random() * Math.random()) / (0.5 + 0.5 * alsV) * (LITE ? 1.4 : 1);
        alsBang(alsV * (0.7 + 0.3 * Math.random()));
      }
    } else st.alsT = tNow + 0.04;
    /* tyre scream: a burnout is loud, wheelspin on the run less so */
    var tyre = live ? clamp(num(o.tyre, 0), 0, 1) : 0;
    if (tyre > 0.01) { st.tyreWob = (st.tyreWob || 0) + 0.07 + Math.random() * 0.05;
      ap(N.tyreA.frequency, 1500 + 260 * Math.sin(st.tyreWob) + rn * 300, 0.05); ap(N.tyreB.frequency, 2750 + 340 * Math.sin(st.tyreWob * 1.7), 0.05); }
    ap(N.tyreG.gain, tyre > 0.01 ? tyre * (LITE ? 0.05 : 0.07) * (0.8 + 0.2 * Math.random()) : 0.0001, tyre > 0.01 ? 0.04 : 0.25);

    // sub thump at the firing frequency. It is a low-frequency phenomenon: let it
    // track properly and fade it out once the wavetable's own harmonic carries it.
    ap(N.subOsc.frequency, clamp(fire, 20, 2400), 0.02);
    var subFade = clamp(1 - (fire - 150) / 220, 0, 1);
    ap(N.subG.gain, live * p.sub * subFade * (0.18 + 0.42 * load) * clamp(1.25 - rn * 0.9, 0.08, 1) * 0.28 * soloGain("sub"), 0.05);

    /* --- intake ------------------------------------------------------- */
    var iv = p.intake;
    if (iv.type === "itb") {
      // honk tracks rpm and opens up hard on throttle
      ap(N.inBP.frequency, clamp((iv.lo + (iv.hi - iv.lo) * clamp(rpm / 7000, 0, 1.3)) * vBright,
                                 120, 3000), 0.03);
      ap(N.inToneG.gain, 0.34 * (0.25 + 0.75 * load) * vGain, 0.04);
      ap(N.inNoiseG.gain, 0.5 + 0.9 * load, 0.05);
      ap(N.inG.gain, live * iv.g * (0.16 + 0.84 * load) * (0.4 + 0.6 * rn) * vGain * 0.9 * soloGain("intake"), 0.04);
    } else {
      // plenum / carb: broadband whoosh proportional to airflow
      ap(N.inBP.frequency, clamp(iv.lo + (iv.hi - iv.lo) * clamp(rpm / 6500, 0, 1.2), 90, 1800), 0.05);
      ap(N.inToneG.gain, 0.10 * load, 0.06);
      ap(N.inNoiseG.gain, 1.1, 0.1);
      var flow = load * clamp(rpm / 6000, 0.12, 1.25) * (1 + boost * 0.55);
      ap(N.inG.gain, live * iv.g * flow * 0.55 * soloGain("intake"), 0.05);
    }

    /* --- mechanical --------------------------------------------------- */
    // two valve events per cylinder per 720 degrees: intake and exhaust
    ap(N.mechOsc.frequency, clamp(fire * 2, 8, 1800), 0.02);
    // detonation is audible as a hard metallic rattle off the valvetrain layer
    ap(N.mechG.gain, live * (LITE ? 0.0001 : p.mech.tick * (1 + knock * 2.2) * (1 + 0.7 * wear) * (0.30 + 0.35 * load) * clamp(rpm / 4000, 0.25, 1.1) * 0.028) * soloGain("mech"), 0.05);
    ap(N.mechHP.frequency, clamp(1400 + rn * 1400, 1200, 3200), 0.08);
    ap(N.gearOsc.frequency, clamp(rpm / 60 * 12, 60, 3600), 0.03);
    ap(N.gearG.gain, live * (LITE ? 0.0001 : p.mech.whine * clamp(rpm / 7000, 0.1, 1.0) * 0.016) * soloGain("mech"), 0.06);
    // diesel clack: loudest at idle and light load, gone by ~2,700 rpm and as load (and boost) rises.
    // A continuous spike train at the firing rate, so it costs no per-combustion voices at any rpm.
    var clat = (dz && live) ? clamp(num(o.clatter, 0.5), 0, 1) * clamp(1.12 - load * 0.85, 0.22, 1) * clamp((2700 - rpm) / 900, 0, 1) * (1 + 0.5 * wear) : 0;
    st.clat = clat;
    var clDepth = clat * 1.8 * (0.82 + 0.36 * Math.random()) * soloGain("mech");     // cycle-to-cycle ragged
    ap(N.clOsc.frequency, clamp(fire, 6, 400), 0.02);
    ap(N.clD.gain, clDepth, 0.04);
    ap(N.clAm.gain, clDepth * CLAT_MEAN, 0.04);
    ap(N.clBP.frequency, clamp(2100 + 500 * rn + 350 * Math.random(), 1800, 3400), 0.05);
    ap(N.clG.gain, clat > 0.002 ? 1 : 0.0001, 0.05);

    /* --- forced induction --------------------------------------------- */
    // the profile supplies the exhaust and intake voicing; what is actually
    // bolted to the engine decides the induction layer
    var ind = ind0, bt = bt0;
    if (bt === "na" || rpm < 400 || !live) {
      ap(N.blowG.gain, 0.0001, 0.08);
      // an armed bottle hisses through the jets even with no blower fitted
      ap(N.wgHP.frequency, 3400, 0.1);
      ap(N.wgG.gain, n2oBite > 0 ? 0.004 + 0.022 * n2oBite : 0.0001, 0.08);
      ap(N.lfoG.gain, 0, 0.08);
    } else if (bt === "roots" || bt === "screw") {
      // a Roots pushes air in lobes; a screw compresses it between the rotors, so
      // it sits an octave higher and is a far purer tone
      var screw = (bt === "screw");
      var lobe = clamp(rpm / 60 * ind.pulley * (screw ? 5 : 3), 40, 7000);
      if (N.blowA.type !== "custom") { N.blowA.setPeriodicWave(buildRootsWave(ctx)); }
      ap(N.blowA.frequency, lobe, 0.02);
      ap(N.blowB.frequency, lobe * (screw ? 1.0015 : 1.004), 0.02);
      ap(N.blowBP.frequency, clamp(lobe * (screw ? 1.6 : 2.2) * (1 + boost * 0.10), 200, 11000), 0.04);
      if (N.blowBP.Q.value !== (screw ? 5.5 : 0.8)) N.blowBP.Q.value = screw ? 5.5 : 0.8;
      var pd = clamp(0.45 + boost * 0.40, 0.45, 1.9);   // it screams harder with boost
      var dd = p.tsBlower ? 1 : 0;                         // a Detroit's scavenge blower: geared high, always working, the scream
      ap(N.blowG.gain, (0.10 + 0.22 * load) * clamp(rpm / (dd ? 2300 : 5000), 0.25, 1.1) * (screw ? 0.72 : 0.5) * pd * (dd ? 2.4 : 1), 0.05);
      // a blower has a relief valve, not a wastegate, but it does bark on a lift
      ap(N.wgG.gain, screw ? 0.004 + 0.012 * clamp(boost / 2, 0, 1) * (1 - load) : 0.0001, 0.1);
      ap(N.lfoG.gain, 0, 0.1);
    } else if (bt === "centri") {
      var cf = clamp(700 + (rpm * rpm) / 9000 * ind.pulley * 0.55, 700, 11000);
      ap(N.blowA.frequency, cf, 0.03);
      ap(N.blowB.frequency, cf * 1.008, 0.03);
      ap(N.blowBP.frequency, cf, 0.04); if (N.blowBP.Q.value !== 2.2) N.blowBP.Q.value = 2.2;
      ap(N.blowG.gain, (0.05 + 0.20 * load) * clamp(rpm / 6000, 0.1, 1.1) * 0.4
                        * clamp(0.5 + boost * 0.45, 0.5, 1.8), 0.05);
      ap(N.wgG.gain, 0.0001, 0.1); ap(N.lfoG.gain, 0, 0.1);
    } else {
      // turbo / twin / compound — whine tracks a turbo-speed proxy
      var ts = TURBO_SIZE[ind.size] || TURBO_SIZE.medium;
      var proxy = clamp(rpm * (1 + boost * 0.55) / 8000, 0, 1.8);
      var wf = clamp(ts.base * (0.42 + 0.72 * proxy) * (dz ? 0.82 : 1), 900, 9500);
      if (N.blowA.type === "custom") { N.blowA.type = "sine"; }
      ap(N.blowA.frequency, wf, 0.05);
      // a compound pair is two stages in series: the small high-pressure wheel
      // spins far faster than the big one underneath it
      var detune = bt === "comp" ? 0.38 : (bt === "twin" ? 1.03 : 1);
      ap(N.blowB.frequency, clamp(wf * 1.011 * detune, 400, 9500), 0.05);
      ap(N.blowBP.frequency, bt === "comp" ? clamp(wf * 0.62, 500, 9000) : wf, 0.06);
      var wq = bt === "comp" ? 1.6 : (dz ? 1.9 : 3.0); if (N.blowBP.Q.value !== wq) N.blowBP.Q.value = wq;
      var spooled = clamp(boost / (0.5 / Math.max(0.3, ts.spool / 0.7)), 0, 1);
      ap(N.blowG.gain, (0.018 * clamp(boost / 0.15, 0, 1) + 0.075 * spooled + 0.05 * load * spooled)
                        * clamp(rpm / 4000, 0.15, 1.3) * 0.6 * (bt === "comp" ? 1.25 : 1)
                        * (ts2 ? 1 + 0.5 * clamp(boost / 1.5, 0, 1) : 1), 0.06);
      // wastegate: a big frame vents through a far bigger valve
      var wgAmt = clamp((boost - 0.55) / 1.6, 0, 1);
      ap(N.wgHP.frequency, clamp((1800 + boost * 900) / Math.max(0.6, ts.wg), 700, 6000), 0.08);
      ap(N.wgG.gain, (0.006 * clamp(boost / 0.15, 0, 1) + 0.030 * wgAmt * (0.3 + 0.7 * load)) * ts.wg, 0.06);
      ap(N.lfo.frequency, clamp((14 + boost * 16) / Math.max(0.7, ts.wg * 0.8), 8, 60), 0.08);
      ap(N.lfoG.gain, 0.022 * wgAmt * clamp((0.45 - load) / 0.30, 0.25, 1) * ts.wg, 0.08);
    }

    /* --- overrun pops / crackle --------------------------------------- */
    var t = ctx.currentTime;
    st.lastT = t;
    // unburnt fuel lighting off in a hot pipe: a rich mixture does it most, and a
    // free-flowing exhaust is what lets you hear it
    var richness = clamp((0.95 - st.lambda) / 0.15, 0, 1);
    var ex2 = st.exhaust || p.exh;
    var freeExh = (ex2 === "headers_equal" || ex2 === "headers_merge") ? 1
                : (ex2 === "cast_tubular") ? 0.55 : 0.3;
    if (!dz && load < 0.18 && rpm > 2000 && (richness * 0.8 + freeExh * 0.4 + (p.rotary ? 0.35 : 0)) > 0.3) {   // a rotary's open port pops on every lift
      // mean interval between pops, as a rate rather than a switch
      var mean = 0.085 / (clamp(rpm / 6000, 0.35, 1.5) * (0.45 + 1.7 * richness) * freeExh);
      if (t >= st.crackleT) {
        st.crackleT = t + 0.02 + Math.random() * mean * 2;
        pop(0.28 + Math.random() * 0.5);
      }
    } else st.crackleT = t + 0.25;
  }

  /* The induction layer is decided by the hardware, not by the named profile —
     a preset's voice describes its exhaust and intake, not what blows into it. */
  function indFor(cfg) {
    var asp = (cfg && cfg.asp) || "na", sz = (cfg && cfg.turboSize) || "medium";
    if (isTwoCfg(cfg) && cfg.induct === "blower" && (asp === "na" || asp === "roots")) return { type: "roots", size: "medium", pulley: 2.0 };
    if (asp === "turbo")       return { type: "turbo",  size: sz, pulley: 0 };
    if (asp === "twin_turbo")  return { type: "twin",   size: sz, pulley: 0 };
    if (asp === "compound")    return { type: "comp",   size: sz, pulley: 0 };
    if (asp === "screw")       return { type: "screw",  size: "large",  pulley: 3.2 };
    if (asp === "roots")       return { type: "roots",  size: "medium", pulley: 2.6 };
    if (asp === "centrifugal") return { type: "centri", size: "medium", pulley: 3.4 };
    return { type: "na", size: "medium", pulley: 0 };
  }

  function keyForLayoutObj(L, prefer) {
    if (prefer && LAY[prefer] && LAY[prefer].rotors) return prefer;   // a Wankel: n is rotors in the sim, events here
    if (prefer && LAY[prefer]) {                       // the config knows which it is
      var q = LAY[prefer];
      if (q.n === L.n && q.banks === L.banks && q.angle === L.angle) return prefer;
    }
    for (var k in LAY) {
      if (LAY[k].n === L.n && LAY[k].banks === L.banks && LAY[k].angle === L.angle
          && !!LAY[k].crossplane === !!L.crossplane) return k;
    }
    for (var k3 in LAY) {
      if (LAY[k3].n === L.n && LAY[k3].banks === L.banks && LAY[k3].angle === L.angle) return k3;
    }
    for (var k2 in LAY) if (LAY[k2].n === L.n) return k2;
    return null;
  }

  /* ------------------------------------------------------------------ *
   * 14. Transient events
   * ------------------------------------------------------------------ */
  function reap(nodes, at) {
    setTimeout(function () {
      nodes.forEach(function (x) { try { x.disconnect(); } catch (e) {} });
    }, Math.max(50, at * 1000 + 120));
  }

  function noiseVoice(dur, type, freq, q, peak, dest) {
    var src = ctx.createBufferSource();
    src.buffer = makeNoise(ctx); src.loop = true;
    src.playbackRate.value = 0.7 + Math.random() * 0.8;
    var f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    var g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(dest || bus);
    var t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.start(t); src.stop(t + dur + 0.02);
    reap([src, f, g], dur);
    return { g: g, f: f, src: src };
  }

  /* The mechanical clack of nitrous solenoids opening, plus the first bite of
     bottle pressure through the jets. Short, dry and metallic. */
  function solenoid() {
    if (!ctx || !bus) return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator(); o.type = "square";
    o.frequency.setValueAtTime(2200, t);
    o.frequency.exponentialRampToValueAtTime(760, t + 0.035);
    var g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    var bp = ctx.createBiquadFilter(); bp.type = "bandpass";
    bp.frequency.value = 1900; bp.Q.value = 3.2;
    o.connect(bp); bp.connect(g); g.connect(bus);
    o.start(t); o.stop(t + 0.06);
    noiseVoice(0.28, "highpass", 3800, 0.7, 0.085);   // the bottle letting go
    reap([o, bp, g], 0.32);
  }

  function pop(amp) {
    if (!ctx || !bus) return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator(); o.type = "triangle";
    o.frequency.setValueAtTime(180 + Math.random() * 160, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.07);
    var g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.28 * amp, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.10);
    var sh = ctx.createWaveShaper(); sh.curve = makeCurve();
    o.connect(sh); sh.connect(g); g.connect(bus);
    o.start(t); o.stop(t + 0.12);
    noiseVoice(0.08, "bandpass", 900 + Math.random() * 1400, 1.4, 0.16 * amp);
    reap([o, sh, g], 0.13);
  }

  /* one anti-lag detonation: a deep shaped thump, a broadband crack and a boom tail, louder than an overrun pop */
  function alsBang(amp) {
    if (!ctx || !bus) return;
    st.alsN = (st.alsN || 0) + 1;
    var t = ctx.currentTime;
    var o = ctx.createOscillator(); o.type = "triangle";
    o.frequency.setValueAtTime(110 + Math.random() * 90, t);
    o.frequency.exponentialRampToValueAtTime(34, t + 0.11);
    var g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.55 * amp, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    var sh = ctx.createWaveShaper(); sh.curve = makeCurve();
    o.connect(sh); sh.connect(g); g.connect(bus);
    o.start(t); o.stop(t + 0.18);
    noiseVoice(0.05, "bandpass", 1100 + Math.random() * 1600, 0.8, 0.34 * amp);   // the crack
    if (!LITE || Math.random() < 0.5) noiseVoice(0.22, "lowpass", 320 + Math.random() * 160, 0.7, 0.30 * amp);   // the boom off the pipe
    reap([o, sh, g], 0.19);
  }

  function starterCrank(dur) {
    var t = ctx.currentTime;
    // whirring starter gear
    var o = ctx.createOscillator(); o.type = "sawtooth";
    o.frequency.setValueAtTime(95, t);
    o.frequency.linearRampToValueAtTime(135, t + dur);
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1400;
    var g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.10, t + 0.05);
    // compression-stroke chuffing
    var lfo = ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 6.5;
    var lg = ctx.createGain(); lg.gain.value = 0.06;
    lfo.connect(lg); lg.connect(g.gain);
    o.connect(lp); lp.connect(g); g.connect(bus);
    g.gain.setValueAtTime(0.10, t + dur - 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.10);
    o.start(t); o.stop(t + dur + 0.12);
    lfo.start(t); lfo.stop(t + dur + 0.12);
    noiseVoice(dur, "bandpass", 320, 1.0, 0.07);
    reap([o, lp, g, lfo, lg], dur + 0.15);
  }

  function event(name) {
    if (!init()) return;
    if (!ctx) return;
    switch (name) {
      case "start": {
        buildGraph();
        // crank first, engine silent
        if (master) { master.gain.cancelScheduledValues(nowT()); apNow(master.gain, volume); }
        running = true; dead = false;
        if (N) apNow(N.exhG.gain, 0.0001);
        starterCrank(0.6);
        setTimeout(function () {
          if (!N) return;
          // catch: quick flare then settle
          var t = ctx.currentTime;
          N.exhG.gain.cancelScheduledValues(t);
          apNow(N.exhG.gain, 0.55);          // the catch, through the smoother so
          ap(N.exhG.gain, 0.22, 0.35);       // set() cannot stamp straight over it
          st.flareUntil = t + 0.55;
          setTimeout(function () { if (N) { try { N.exhG.gain.cancelScheduledValues(0); } catch (e) {} N.exhG.gain._cur = N.exhG.gain.value; } }, 450);
          pop(0.5);
        }, 600);
        break;
      }
      case "idleStart": {
        if (!N) { start(); }
        var t0 = ctx.currentTime;
        if (N) {
          N.exhG.gain.cancelScheduledValues(t0);
          ap(N.exhG.gain, 0.20, 0.25); st.flareUntil = t0 + 0.45;
          setTimeout(function () { if (N) { try { N.exhG.gain.cancelScheduledValues(0); } catch (e) {} N.exhG.gain._cur = N.exhG.gain.value; } }, 400);
        }
        noiseVoice(0.25, "lowpass", 700, 0.7, 0.05);
        break;
      }
      case "bov": {
        if (st.diesel) return;                      // diesels have no throttle plate to slam: no blow-off
        var bp = Math.max(st.boost, st.boostPeak || 0);
        if (bp <= 0.08) return;                    // only when actually boosted
        if (ctx.currentTime - (st.bovT || -9) < 0.45) return;   // one per lift
        st.bovT = ctx.currentTime;
        var amt = clamp(bp / 1.2, 0.25, 1.3);
        var t1 = ctx.currentTime;
        var o = ctx.createOscillator(); o.type = "sawtooth";
        o.frequency.setValueAtTime(1500 * amt + 600, t1);
        o.frequency.exponentialRampToValueAtTime(380, t1 + 0.28);
        var bp = ctx.createBiquadFilter(); bp.type = "bandpass";
        bp.frequency.setValueAtTime(2600, t1);
        bp.frequency.exponentialRampToValueAtTime(700, t1 + 0.3);
        bp.Q.value = 4;
        var g = ctx.createGain(); g.gain.setValueAtTime(0, t1);
        g.gain.linearRampToValueAtTime(0.16 * amt, t1 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.34);
        o.connect(bp); bp.connect(g); g.connect(bus);
        o.start(t1); o.stop(t1 + 0.36);
        noiseVoice(0.30, "highpass", 2200, 0.8, 0.13 * amt);   // the "tsh"
        reap([o, bp, g], 0.4);
        break;
      }
      case "purge": {
        /* nitrous purge: a hard, wide hiss of liquid flashing to gas at the nozzle, with a little whistle on top */
        noiseVoice(0.75, "highpass", 2600 + Math.random() * 500, 0.5, 0.20);
        noiseVoice(0.65, "bandpass", 6200, 1.6, 0.07);
        var tp = ctx.currentTime, po = ctx.createOscillator(); po.type = "sine";
        po.frequency.setValueAtTime(5200, tp); po.frequency.linearRampToValueAtTime(4700, tp + 0.6);
        var pg = ctx.createGain(); pg.gain.setValueAtTime(0, tp); pg.gain.linearRampToValueAtTime(0.012, tp + 0.04); pg.gain.exponentialRampToValueAtTime(0.0001, tp + 0.65);
        po.connect(pg); pg.connect(bus); po.start(tp); po.stop(tp + 0.7); reap([po, pg], 0.7);
        if (!st.purgeT || tp - st.purgeT > 1.2) solenoid();      // the purge solenoid clacks open
        st.purgeT = tp;
        break;
      }
      case "runaway": {
        /* a diesel running on its own oil: a howl climbing past anything the governor would allow, and a hiss from the stack */
        if (st.raVoice) return;
        var tr = ctx.currentTime, ro = ctx.createOscillator(); ro.type = "sawtooth";
        ro.frequency.setValueAtTime(700, tr); ro.frequency.exponentialRampToValueAtTime(2300, tr + 2.4);
        var rb = ctx.createBiquadFilter(); rb.type = "bandpass"; rb.Q.value = 3; rb.frequency.setValueAtTime(1400, tr); rb.frequency.exponentialRampToValueAtTime(3600, tr + 2.4);
        var rg = ctx.createGain(); rg.gain.setValueAtTime(0, tr); rg.gain.linearRampToValueAtTime(0.09, tr + 0.5); rg.gain.linearRampToValueAtTime(0.14, tr + 2.4);
        ro.connect(rb); rb.connect(rg); rg.connect(bus); ro.start(tr); ro.stop(tr + 3.2);
        var rh = noiseVoice(3.0, "highpass", 1800, 0.6, 0.10);
        st.raVoice = { o: ro, g: rg, h: rh }; reap([ro, rb, rg], 3.3);
        setTimeout(function () { st.raVoice = null; }, 3300);
        break;
      }
      case "mudslap": {
        /* a wet slap: a low thump of mud hitting the body, a smack of spray on top */
        var tm = ctx.currentTime; if (tm - (st.slapT || -9) < 0.07) return; st.slapT = tm;
        noiseVoice(0.16 + Math.random() * 0.08, "lowpass", 300 + Math.random() * 160, 0.9, 0.20);
        noiseVoice(0.09, "bandpass", 1100 + Math.random() * 600, 1.4, 0.05);
        break;
      }
      case "kill": {
        /* the kill switch: air and fuel off at once — sudden silence, a clunk from the flapper, the engine winding down */
        var tk = ctx.currentTime;
        if (st.raVoice) { try { st.raVoice.g.gain.cancelScheduledValues(tk); st.raVoice.g.gain.setValueAtTime(0.0001, tk + 0.03); if (st.raVoice.h && st.raVoice.h.g) { st.raVoice.h.g.gain.cancelScheduledValues(tk); st.raVoice.h.g.gain.setValueAtTime(0.0001, tk + 0.03); } } catch (e) {} st.raVoice = null; }
        var ko = ctx.createOscillator(); ko.type = "square"; ko.frequency.setValueAtTime(95, tk); ko.frequency.exponentialRampToValueAtTime(38, tk + 0.12);
        var kg = ctx.createGain(); kg.gain.setValueAtTime(0.32, tk); kg.gain.exponentialRampToValueAtTime(0.0001, tk + 0.18);
        var kf = ctx.createBiquadFilter(); kf.type = "lowpass"; kf.frequency.value = 420;
        ko.connect(kf); kf.connect(kg); kg.connect(bus); ko.start(tk); ko.stop(tk + 0.2); reap([ko, kf, kg], 0.25);
        noiseVoice(0.12, "lowpass", 600, 0.8, 0.22);
        if (N) { dead = true; ap(N.exhG.gain, 0.0001, 0.04); ap(N.subG.gain, 0.0001, 0.06); ap(N.inG.gain, 0.0001, 0.03); ap(N.blowG.gain, 0.0001, 0.15); ap(N.wgG.gain, 0.0001, 0.15); ap(N.mechG.gain, 0.0001, 0.5); ap(N.gearG.gain, 0.0001, 0.6); ap(N.clG.gain, 0.0001, 0.04); if (N.tyreG) ap(N.tyreG.gain, 0.0001, 0.4); }
        break;
      }
      case "intakeBang": {
        /* a backfire through the intake: one deep thump and the burst panel letting go */
        pop(1.0);
        noiseVoice(0.35, "lowpass", 420, 0.9, 0.30);
        setTimeout(function () { if (ctx) noiseVoice(0.5, "highpass", 1800, 0.6, 0.10); }, 40);
        break;
      }
      case "backfire": {
        if (st.diesel) return;
        pop(0.9);
        setTimeout(function () { if (ctx) pop(0.5); }, 70 + Math.random() * 60);
        setTimeout(function () { if (ctx) pop(0.35); }, 170 + Math.random() * 90);
        break;
      }
      case "fail": {
        if (!N) return;
        var tf = ctx.currentTime;
        // metallic bang
        var b = ctx.createOscillator(); b.type = "square";
        b.frequency.setValueAtTime(260, tf);
        b.frequency.exponentialRampToValueAtTime(48, tf + 0.25);
        var bg = ctx.createGain(); bg.gain.setValueAtTime(0.55, tf);
        bg.gain.exponentialRampToValueAtTime(0.0001, tf + 0.4);
        var br = ctx.createBiquadFilter(); br.type = "bandpass"; br.frequency.value = 1300; br.Q.value = 2.2;
        b.connect(br); br.connect(bg); bg.connect(bus);
        b.start(tf); b.stop(tf + 0.45);
        // steam / oil hiss
        noiseVoice(1.6, "highpass", 3000, 0.7, 0.20);
        // rattle: fast chopped noise
        var r = noiseVoice(1.1, "bandpass", 620, 3.5, 0.18);
        var rl = ctx.createOscillator(); rl.type = "square"; rl.frequency.setValueAtTime(34, tf);
        rl.frequency.linearRampToValueAtTime(9, tf + 1.1);
        var rlg = ctx.createGain(); rlg.gain.value = 0.16;
        rl.connect(rlg); rlg.connect(r.g.gain);
        rl.start(tf); rl.stop(tf + 1.15);
        reap([b, br, bg, rl, rlg], 1.2);
        // engine dies
        dead = true;
        ap(N.exhG.gain, 0.0001, 0.28); ap(N.subG.gain, 0.0001, 0.28); ap(N.inG.gain, 0.0001, 0.22);
        ap(N.blowG.gain, 0.0001, 0.5); ap(N.wgG.gain, 0.0001, 0.5); ap(N.mechG.gain, 0.0001, 0.6); ap(N.gearG.gain, 0.0001, 0.4); ap(N.clG.gain, 0.0001, 0.3);
        if (N.tyreG) ap(N.tyreG.gain, 0.0001, 0.3);
        break;
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * 15. Public surface
   * ------------------------------------------------------------------ */
  return {
    init: init,
    start: start,
    stop: stop,
    set: set,
    event: event,
    nitrous: function (g) { st.n2oGate = (g == null) ? null : +g; },   // strip: null = the rpm window decides, 0..1 = the shot actually in
    setVolume: setVolume,
    setQuality: setQuality,
    rebuild: function () { rebuildGraph("manual"); },
    solo: solo, peak: peak,
    alsBangs: function () { return st.alsN || 0; },   // diagnostics: anti-lag detonations played so far
    profiles: profiles,
    // extras (harmless additions, not part of the contract)
    LAYOUTS: LAY,
    deriveProfile: deriveProfile,
    // recorded-sample layer hooks (ENGINE_SAMPLES): duck the synth core, and read where to plug in
    setSynthMix: function (m) { m = +m; SYNTH_MIX = isFinite(m) ? clamp(m, 0, 1) : 1; },
    sampleHost: function () { return { ctx: ctx, bus: bus, running: running && !!N, dead: dead, solo: SOLO, lite: LITE, diesel: !!st.diesel }; },
    get context() { return ctx; },
    get isRunning() { return running; }
  };
})();

if (typeof module !== "undefined") module.exports = ENGINE_SOUND;
if (typeof window !== "undefined") window.ENGINE_SOUND = ENGINE_SOUND;

</script>
