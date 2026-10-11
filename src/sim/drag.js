  /* =====================================================================
     18.  Export
     ===================================================================== */
  /* ---- Drag strip: real-time vehicle pass ---- */
  // heat: how much extra grip a proper burnout is worth on that compound (fraction of μ)
  const TYRES = { street: { mu: 1.18, n: "Street radial", heat: 0.02 }, radial: { mu: 1.7, n: "Drag radial", heat: 0.08 }, slick: { mu: 2.4, n: "Slick", heat: 0.08 } };
  TYRES.street.psi = 32; TYRES.radial.psi = 16; TYRES.slick.psi = 8;   // where each tyre is set up to run (psi); veh.tyrePsi moves off it
  const AERO = {
    street: { cdA: 0.82, bite: 1.00, wb: 2.70, n: "Street body", d: "stock shell · no bars" },
    outlaw: { cdA: 1.05, bite: 1.22, wb: 2.80, n: "Outlaw", d: "big tyre, wheelie bar, spoiler", bars: 1 },
    promod: { cdA: 0.62, bite: 1.40, wb: 2.95, n: "Pro-mod", d: "slick body, four-link, bars", bars: 1 },
    rail: { cdA: 0.45, bite: 1.62, wb: 4.20, n: "Dragster", d: "long rail, wing, huge bite", bars: 1 }
  };
  // compressor inducer size for each turbo option — sets how fast the wheel can be brought up to speed
  const TURBO_MM = { small: 46, medium: 54, large: 62, s66: 66, huge: 76, f88: 88, f98: 98 };
  // what the hot side of each exhaust manifold tolerates before it starts to crack (°C at the turbine inlet / collector)
  const MANIFOLD_HEAT = {
    cast_log: { crackC: 900, cast: 1, n: "cast log manifold", where: "at the collector" },
    cast_tubular: { crackC: 930, cast: 1, n: "cast tubular manifold", where: "across a runner" },
    headers_equal: { crackC: 1000, cast: 0, n: "stainless headers", where: "at a primary weld" },
    headers_merge: { crackC: 1015, cast: 0, n: "merge-collector headers", where: "at the merge" }
  };
  const DRAG_MARKS = [[18.288, "60 ft"], [100.584, "330 ft"], [201.168, "1/8 mi"], [304.8, "1000 ft"], [402.336, "1/4 mi"]];
  const BURN_BOX_X = -8;   // the water box sits behind the starting line

  /* Everything a pass needs beyond the dyno curve: the atmospheric torque curve of the same
     engine (so boost can be tracked second by second instead of assumed), and what is bolted
     to the hot side. Launch parts never touch simulate() — they only live here. */
  function dragPrep(cfg, env, res) {
    cfg = Object.assign({}, DEFAULT_CFG, cfg || {});
    res = res || simulate(cfg, env);
    const asp = OPT.asp[cfg.asp] || OPT.asp.na;
    res.aspKind = asp.kind;
    res.compound = !!asp.compound;
    res.turboUnits = asp.kind === "turbo" ? (asp.units || 1) : 0;
    res.turboSize = cfg.turboSize;
    res.turboMm = (asp.kind === "turbo" || asp.kind === "centrifugal") ? (TURBO_MM[cfg.turboSize] || 54) : 0;
    res.boostTarget = asp.kind === "na" ? 0 : cfg.boost;
    res.turbineMat = cfg.turbineMat;
    res.exhaust = cfg.exhaust;
    res.egtLimitC = asp.kind === "turbo" ? (OPT.turbineMat[cfg.turbineMat] || OPT.turbineMat.cast_iron).maxEgtC : 0;
    // anti-lag and variable geometry only ever add to the pass; with neither fitted nothing below changes
    res.als = asp.kind === "turbo" && !isDiesel(cfg) && OPT.als[cfg.als] && cfg.als !== "off" ? cfg.als : "off";
    res.vgt = asp.kind === "turbo" && cfg.turbine === "vgt";
    if (res.vgt && !isDiesel(cfg)) res.egtLimitC = Math.min(res.egtLimitC, OPT.turbine.vgt.vaneEgtC[cfg.turbineMat] || 880);
    if (asp.kind === "na") res.naTorque = res.torque.slice();
    else {
      const na = simulate(Object.assign({}, cfg, { asp: "na" }), env);
      res.naTorque = res.rpms.map(r => { const i = na.rpms.indexOf(r); return i >= 0 ? na.torque[i] : 0; });
    }
    // nitrous: the shot's own share of the curve, so a pass can bring it in late, soft or not at all
    if (res.nitrous && OPT.nitrous[cfg.nitrous] && cfg.nitrous !== "none") { const nn = simulate(Object.assign({}, cfg, { nitrous: "none" }), env); res.n2oTq = res.torque.map((t, i) => Math.max(0, t - (nn.torque[i] || 0))); }
    return res;
  }

  /* nitrous bottle pressure: N2O is a liquid sitting on its own vapour, so the pressure is set by the bottle's
     temperature (about 735 psi at 20 °C, 950 at 32 °C; past 36 °C it is no longer a liquid at all). A heater
     blanket holds it near 950; without one the bottle follows the weather and cools as it empties.          */
  function n2oBottle(heater, ambientC, cooledK) {
    const T = heater ? 31.5 : ambientC - (cooledK || 0);
    const bar = 31.3 * Math.exp(0.0236 * T);
    return { psi: Math.round(Math.min(1100, bar * 14.5038)), tempC: Math.round(T) };
  }

  /* launch tech a car carries, from the build (ECU / driveline parts, not engine parts) */
  function launchTech(cfg, env) {
    cfg = cfg || {};
    const lc = OPT.launchCtl[cfg.launchCtl] ? cfg.launchCtl : "none";
    const tb = OPT.transBrake[cfg.transBrake] ? cfg.transBrake : "none";
    const red = cfg.redline || 7000;
    return { launchCtl: lc, transBrake: tb, twoStepRpm: lc !== "none" ? Math.min(red, Math.max(2000, cfg.twoStepRpm || 4000)) : 0, launchRetard: lc === "two_step_retard" ? clamp(cfg.launchRetard || 0, 0, 35) : 0 };
  }

  function dragRun(res, veh) {
    const v = Object.assign({ mass: 1400, rearBias: 0.55, wheelbase: 2.7, cgH: 0.5, tyre: "street", tyreDia: 27, gears: 4, first: 2.9, top: 1.0, final: 3.7, launchRpm: 3500, shiftRpm: 0, auto: true, redline: 7000, idle: 900, body: "street", chute: false,
      launchCtl: "none", twoStepRpm: 0, launchRetard: 0, transBrake: "none", burnout: false, tyreTemp: 0, soakC: 0, noFail: false }, veh || {});
    /* pits tuning: tyre pressure and rear shock valving. Neutral (no effect at all) unless veh.tyrePsi / veh.shocks are set.
       Less pressure = a longer, softer footprint (more bite) on a tyre that squats a little shorter (rolls out less per turn);
       too little and the sidewall wraps up and shakes. Soft shocks let the body squat and hit the tyre harder (more bite, more lift);
       firm ones hold it flat (less lift, less bite, so it spins). */
    const psiNom = (TYRES[v.tyre] || TYRES.street).psi || 16, psiD = v.tyrePsi > 0 ? clamp((v.tyrePsi - psiNom) / psiNom, -0.6, 0.6) : 0;
    const shockK = v.shocks === "soft" ? 1 : v.shocks === "firm" ? -1 : 0, rollK = 1 + 0.035 * psiD;
    const psiBite = psiD < 0 ? Math.min(0.07, -psiD * 0.25) : -psiD * 0.18, psiShake = clamp((-psiD - 0.25) / 0.25, 0, 1);
    const tuneGrip = t => (1 + psiBite) * (1 + 0.05 * shockK * Math.exp(-t / 0.9)), tuneLift = t => 1 + 0.22 * shockK * Math.exp(-t / 1.2);
    const rpms = res.rpms, tq = res.torque, N = rpms.length;
    const interp = (arr, r) => { if (r <= rpms[0]) return arr[0]; if (r >= rpms[N - 1]) return arr[N - 1]; let i = 1; while (rpms[i] < r) i++; const f = (r - rpms[i - 1]) / (rpms[i] - rpms[i - 1]); return arr[i - 1] + f * (arr[i] - arr[i - 1]); };
    const torqueAt = r => { if (r <= rpms[0]) return tq[0] * Math.max(0.3, r / rpms[0]); if (r >= rpms[N - 1]) return tq[N - 1]; let i = 1; while (rpms[i] < r) i++; const f = (r - rpms[i - 1]) / (rpms[i] - rpms[i - 1]); return tq[i - 1] + f * (tq[i] - tq[i - 1]); };
    const ratios = []; for (let i = 0; i < v.gears; i++) ratios.push(v.gears === 1 ? v.first : v.first * Math.pow(v.top / v.first, i / (v.gears - 1)));
    const rw = v.tyreDia * 0.0254 / 2 * rollK, g = 9.81, eta = 0.90, TY = TYRES[v.tyre] || TYRES.street;
    let mu = TY.mu;
    if (veh && veh.body && !(veh.wheelbase > 0)) v.wheelbase = (AERO[veh.body] || AERO.street).wb;
    const I = 0.12 + 0.06 * ((res.VdEq || res.Vd) / 1000), peakTq = res.peakTq, clutchCap = peakTq * 1.8;
    const BODY = AERO[v.body] || AERO.street, cdA0 = v.cdA > 0 ? v.cdA : BODY.cdA, bite = BODY.bite, crr = 0.014, rho = 1.2, limiter = v.redline * 1.02, shiftAt = v.shiftRpm || v.redline - 200;

    /* ---- launch tech ---- */
    const lc = OPT.launchCtl[v.launchCtl] ? v.launchCtl : "none", tbk = OPT.transBrake[v.transBrake] ? v.transBrake : "none";
    const twoStep = lc !== "none", retardOn = lc === "two_step_retard", transBrake = tbk === "trans_brake", lineLock = tbk === "line_lock";
    const retard = retardOn ? clamp(+v.launchRetard || 0, 0, 35) : 0;
    const holdRpm = twoStep && v.twoStepRpm > 0 ? Math.min(v.redline, v.twoStepRpm) : v.launchRpm;
    /* anti-lag: off throttle (staging, shifts, the lift at the stripe) it keeps burning fuel ahead of the turbine,
       so the wheel keeps its speed. Only a turbo car with it fitted; "off" leaves every line below as it was. */
    const ALS = res.als && res.als !== "off" && OPT.als[res.als] && res.aspKind === "turbo" ? OPT.als[res.als] : null;
    const alsMin = ALS ? Math.max(2200, 0.35 * v.redline) : 0;
    const canArm = twoStep || transBrake || !!ALS;
    /* ---- nitrous: only when the app hands over the bottle (veh.n2o = {act, psi, line}); otherwise the shot is
       whatever the dyno curve says, exactly as before. act: "window" (the rpm window switch), "mph40", "mph60",
       "shift2" (after the 1-2 shift). line 0..1: how much of the feed line is liquid (purging fills it). ---- */
    const NZ = v.n2o && res.nitrous && Array.isArray(res.n2oTq) && res.n2oTq.length === N ? res.nitrous : null;
    const nzAct = NZ ? (v.n2o.act || "window") : "window";
    const nzPsi = NZ ? clamp(+v.n2o.psi || 950, 300, 1100) : 950;
    const nzPsiK = clamp(Math.pow(nzPsi / 950, 0.85), 0.3, 1.1);       // jet flow follows bottle pressure

    /* ---- transient boost: torque = atmospheric curve + what the manifold pressure is worth right now ---- */
    const kind = res.aspKind || "na", bT = +res.boostTarget || 0;
    let trans = kind !== "na" && bT > 0 && Array.isArray(res.naTorque) && res.naTorque.length === N && Array.isArray(res.boostCurve) && res.boostCurve.length === N;
    let gpb = null;
    if (trans) {
      gpb = new Array(N); const valid = [];
      for (let i = 0; i < N; i++) { const b = res.boostCurve[i]; if (b > Math.max(0.10, 0.15 * bT)) { gpb[i] = Math.max(0, tq[i] - res.naTorque[i]) / b; valid.push(i); } else gpb[i] = null; }
      if (!valid.length) trans = false;
      else for (let i = 0; i < N; i++) if (gpb[i] == null) { let j = valid[0]; for (const k of valid) if (Math.abs(k - i) < Math.abs(j - i)) j = k; gpb[i] = gpb[j] * Math.max(0, res.naTorque[i]) / Math.max(1, res.naTorque[j]); }
    }
    const isTurbo = trans && kind === "turbo";
    const tqCap = Math.max.apply(null, tq) * 1.06;
    const bssAt = r => trans ? Math.max(0, interp(res.boostCurve, r)) : 0;
    function engTq(r) {
      if (!trans) return torqueAt(r);
      const full = torqueAt(r), bss = bssAt(r), gb = interp(gpb, r), d = st.boost - bss;
      if (d >= 0) return Math.min(full + gb * d, Math.max(tqCap, full));
      return Math.max(interp(res.naTorque, r), full + gb * d);
    }
    const mm = res.turboMm || 54, VdL = Math.max(0.3, (res.VdEq || res.Vd || 2000) / 1000);
    // time constant of the rotating group at full exhaust energy: ~0.2 s for a 46 mm wheel, ~1.2 s for a 98 mm frame
    const tauBase = (0.2 + 1.0 * clamp((mm - 46) / 52, 0, 1.2)) * (res.turboUnits === 2 && !res.compound ? 0.78 : 1) * clamp(Math.pow(2.5 / VdL, 0.3), 0.55, 1.5) * (res.vgt ? 0.72 : 1);   // shut vanes spin the wheel up faster
    const pkRpm = res.peakHpRpm || v.redline * 0.85;
    const sizeK = clamp(1 - 0.7 * (mm - 46) / 52, 0.25, 1) * (res.turboUnits === 2 && !res.compound ? 1.15 : res.compound ? 1.1 : 1) * (res.vgt ? 1.2 : 1);
    const dispK = clamp(Math.pow(VdL / 2.5, 0.35), 0.75, 1.5);
    const retFrac = Math.pow(retard / 35, 0.85);
    // what the turbo can be brought to on the line: a spark-cut limiter alone makes little heat to drive it,
    // retard makes a lot, and a trans-brake loads the engine at the hold rpm as if it were driving away
    function lineTarget(r) {
      if (!isTurbo) return null;
      const rpmK = clamp(r / 4500, 0.6, 1.25);
      let f = (twoStep ? 0.10 + 0.75 * retFrac : 0) * sizeK * dispK * rpmK;
      if (transBrake) f += bssAt(r) / bT * (1 + 0.2 * retFrac);
      if (ALS) f += ALS.line * sizeK * dispK * rpmK;   // anti-lag on top of whatever the limiter does
      return bT * clamp(f, 0, 1);
    }
    function lineEnergy() { return clamp((twoStep ? 0.35 : 0.2) + 0.8 * retFrac + (transBrake ? 0.5 : 0) + (ALS ? ALS.energy * 0.5 : 0), 0.2, ALS ? 1.6 : 1.3); }
    function boostStep(dt, r, load, line) {
      if (!trans) { st.boost = 0; return; }
      if (!isTurbo) {   // crank-driven: the blower makes its boost whenever the throttle is open, and keeps it through a shift
        const tgt = bssAt(r) * (st.shiftT > 0 ? 1 : clamp(load, 0, 1));
        st.boost += (tgt - st.boost) * (1 - Math.exp(-dt / 0.05)); return;
      }
      let avail = line != null ? line : bssAt(r) * Math.pow(clamp(load, 0, 1), 1.5);
      const alsHold = ALS && line == null && load < 0.5 && r > alsMin && st.phase !== "burnout" ? bT * ALS.hold * clamp(r / (0.7 * pkRpm), 0.4, 1) : 0;
      if (alsHold > avail) avail = alsHold;
      avail = Math.min(avail, bT);
      let tau;
      if (avail > st.boost) {
        const e = line != null ? lineEnergy() : alsHold >= avail && alsHold > 0 ? ALS.energy : clamp(r * Math.max(0.15, load) / pkRpm, 0.08, 1.3);
        tau = tauBase / Math.pow(e, 0.75);
        if (res.compound) tau *= st.boost > 0.5 * bT ? 1.35 : 0.7;   // the small stage lights first, the big one takes over
      } else tau = alsHold > 0 ? 0.9 : 0.35;                        // wastegate and blow-off dump it (anti-lag keeps the wheel turning)
      st.boost += (avail - st.boost) * (1 - Math.exp(-dt / Math.max(0.03, tau)));
      st.boost = clamp(st.boost, 0, bT);
    }

    /* ---- hot side ---- */
    const egtLimit = isTurbo ? (res.egtLimitC || 950) : 0;
    const MH = MANIFOLD_HEAT[res.exhaust] || null;
    const hasEgtCurve = Array.isArray(res.egtCurve) && res.egtCurve.length === N;

    const st = { t: 0, x: v.burnout ? BURN_BOX_X : 0, v: 0, rpm: v.burnout ? 1400 : v.launchRpm, gear: 1, phase: v.burnout ? "burnout" : "staged", spin: false, slipping: true, shiftT: 0, load: v.burnout ? 0.1 : 0.25, done: false, wSpin: 0, bite: 0, marks: [], spinTime: 0, limiterTime: 0, overrev: 0, shifts: [], bog: false, minRpm: v.launchRpm, trace: [], chuteOut: false, shutFt: 0, trap: 0,
      boost: 0, boostTarget: bT, tyreTemp: clamp(+v.tyreTemp || 0, 0, 1), burning: false, burnT: 0, overcook: 0, rolled: !v.burnout, rollIn: 0,
      launch: { armed: false, twoStep: twoStep, transBrake: transBrake, held: 0, retard: retard, pops: 0 },
      armedT: 0, egt: 420 + (+v.soakC || 0), egtPeak: 0, egtLine: 0, turbDose: 0, manDose: 0, lineHeat: 0, launchBoost: 0, launchRpmAct: 0,
      lift: 0, liftMax: 0, onBars: false, wheelieT: 0, conv: false, failKind: null, failAt: Infinity, broke: null, risk: null, gripGain: 0, boost0T: null };
    st.egtPeak = st.egt;
    st.als = 0; st.alsT = 0; st.alsDose = 0; st.alsBangs = 0;   // anti-lag: firing now 0..1, seconds fired, wear from it, bangs
    /* anti-lag firing (off throttle above its rpm floor): bangs and flames out of the pipe, a hotter turbine, wear */
    function alsFire(dt, on, wear) {
      if (!ALS) return false;
      const k = on ? (res.als === "air" ? 1 : 0.8) : 0;
      st.als += (k - st.als) * (1 - Math.exp(-dt / (on ? 0.03 : 0.12)));
      if (!on) return false;
      if (wear) { st.alsT += dt; st.alsDose += dt * ALS.dose * clamp(st.egt / Math.max(700, egtLimit), 0.6, 1.4); }
      // irregular, loud: a bang every 40-140 ms, harder with secondary air
      if (Math.random() < dt * (res.als === "air" ? 14 : 10)) { st.launch.pops = Math.max(st.launch.pops, (res.als === "air" ? 0.75 : 0.6) + 0.25 * Math.random()); st.alsBangs++; }
      return true;
    }
    st.n2oS = NZ ? { line: clamp(v.n2o.line == null ? 0.15 : +v.n2o.line, 0, 1), psi: nzPsi, on: false, onT: null, onMph: 0, onGear: 0, onX: 0, frac: 0, stage2: false, purging: false, purged: 0, puff: 0, event: null, cut: false, lineAtOn: 0, popT: 0 } : null;
    st.n2o = 0;   // the shot's flow right now, 0..1 (the datalog reads it)
    let acc = 0, lastTrace = 0, popT = 0;
    function pops(dt, rate, amp) { st.launch.pops *= Math.exp(-dt / 0.06); popT -= dt; if (rate > 0 && popT <= 0) { popT = (0.4 + Math.random() * 1.2) / rate; st.launch.pops = Math.max(st.launch.pops, amp * (0.6 + Math.random() * 0.4)); } }
    function heat(dt, target, tau) {
      st.egt += (target - st.egt) * (1 - Math.exp(-dt / tau)); st.egtPeak = Math.max(st.egtPeak, st.egt);
      if (st.phase === "run" || st.phase === "shutdown") return;
      st.egtLine = Math.max(st.egtLine, st.egt);
      // only line abuse counts: the dyno already proved the engine can live at full load
      if (isTurbo && st.egt > egtLimit) st.turbDose += dt * (st.egt - egtLimit) / 50;
      if (MH && st.egt > MH.crackC) st.manDose += dt * (st.egt - MH.crackC) / 60 * (MH.cast ? 1.3 : 1);
      if (st.egt > 850) st.lineHeat += dt * (st.egt - 850) / 100;
    }
    function shift() { if (st.phase !== "run" || st.gear >= v.gears || st.shiftT > 0) return; st.shifts.push({ rpm: Math.round(st.rpm), gear: st.gear, x: st.x, t: st.t, boost: +st.boost.toFixed(2) }); st.gear++; st.shiftT = 0.18; if (isTurbo) st.launch.pops = Math.max(st.launch.pops, 0.35 * clamp(st.boost / 1.2, 0.3, 1)); }
    function step(dt) { dt = Math.min(1, dt); while (dt > 0 && !st.done) { const h = Math.min(0.004, dt); dt -= h; sub(h); } return st; }
    function sub(dt) {
      if (st.done) return st;
      if (NZ) n2oStep(dt);
      else if (res.nitrous && Array.isArray(res.n2oTq) && res.n2oTq.length === N) st.n2o = st.phase === "run" && st.shiftT <= 0 && interp(res.n2oTq, st.rpm) > 1 ? 1 : 0;   // no bottle model: the window switch decides
      if (st.phase === "shutdown") {
        st.t += dt;
        const cdAs = st.chuteOut ? cdA0 + 9.2 : cdA0;
        const brake = 0.62 * TY.mu * v.mass * g;
        const Fres = 0.5 * rho * cdAs * st.v * st.v + crr * v.mass * g + brake;
        st.v = Math.max(0, st.v - Fres / v.mass * dt); st.x += st.v * dt;
        st.shutFt = (st.x - 402.336) * 3.28084;
        st.rpm = Math.max(v.idle, st.rpm - 2600 * dt); st.load = 0;
        boostStep(dt, st.rpm, 0, null); heat(dt, 520, 3); pops(dt, 0, 0);
        alsFire(dt, !!ALS && st.rpm > alsMin && st.t - (st.trapT || 0) < 2.5, false);   // the lift at the stripe: a last volley
        if (st.v < 8 || st.t > 40) { st.done = true; st.phase = "done"; }
        return st;
      }
      if (st.phase === "burnout") {
        if (st.burning) {
          st.burnT += dt;
          st.rpm += (0.62 * v.redline + Math.sin(st.burnT * 23) * 160 - st.rpm) * (1 - Math.exp(-dt / 0.15)); st.load = 0.55; st.spin = true;
          st.tyreTemp = Math.min(1, st.tyreTemp + dt / 3 * (lineLock ? 1 : 0.6));
          if (st.burnT > 4) st.overcook = Math.min(0.06, (st.burnT - 4) * 0.03);
          if (!lineLock) { st.v = Math.min(1.2, st.v + dt * 0.8); st.x = Math.min(-3, st.x + st.v * dt); }   // no line lock: the foot brake can't hold it, the car creeps out of the box
          heat(dt, 780, 2);
        } else { st.rpm += (1300 - st.rpm) * (1 - Math.exp(-dt / 0.3)); st.load = 0.1; st.spin = false; st.v = Math.max(0, st.v - dt * 3); st.x += st.v * dt; heat(dt, 560, 3); }
        boostStep(dt, st.rpm, st.load, null); pops(dt, 0, 0);
        st.lift = 0; return st;
      }
      const ratio = ratios[st.gear - 1] * v.final;
      if (st.phase === "staged") {
        st.t += dt; st.spin = false;
        if (st.rollIn > 0) { const k = Math.min(1, dt / st.rollIn); st.rollIn -= dt; st.x += (0 - st.x) * k; st.v = 0; if (st.rollIn <= 0) { st.x = 0; st.rolled = true; } }
        st.tyreTemp = Math.max(0, st.tyreTemp - dt / 120);
        if (st.launch.armed) {
          st.launch.held += dt; st.armedT += dt;
          const wav = twoStep ? (Math.random() - 0.5) * 240 : Math.sin(st.t * 9) * 150;
          st.rpm += (holdRpm + wav - st.rpm) * (1 - Math.exp(-dt / 0.04));
          st.load = transBrake ? 1 : retardOn ? 0.45 : 0.3;
          boostStep(dt, holdRpm, st.load, lineTarget(holdRpm));
          heat(dt, 690 + (retardOn ? 11.5 * retard : twoStep ? 40 : 0) + (transBrake ? 80 : 0) + (ALS ? 1.2 * ALS.egtAdd : 0), transBrake ? 0.9 : 1.1);
          pops(dt, twoStep ? 6 + 12 * retard / 35 : 0, twoStep ? 0.45 + 0.55 * retard / 35 : 0);
          alsFire(dt, true, true);
        } else {
          st.rpm = v.launchRpm + Math.sin(st.t * 60) * 90; st.load = 0.35;
          boostStep(dt, st.rpm, st.load, null); heat(dt, 620, 2.5); pops(dt, 0, 0); alsFire(dt, false);
        }
        return st;
      }
      st.t += dt;
      const wheelRpm = st.v / (2 * Math.PI * rw) * 60 * ratio;
      let inShift = st.shiftT > 0;
      if (inShift) { st.shiftT -= dt; st.load = 0; if (st.shiftT <= 0 && !st.conv) st.slipping = true; }
      else st.load = 1;
      boostStep(dt, st.rpm, st.load, null);
      const alsOn = !!ALS && inShift && st.rpm > alsMin;
      heat(dt, (hasEgtCurve ? interp(res.egtCurve, st.rpm) : 850) + (alsOn ? ALS.egtAdd * 1.6 : 0), alsOn ? 0.5 : 1.5); pops(dt, 0, 0);
      alsFire(dt, alsOn, true);
      if (trans && st.boost0T == null && st.boost >= 0.75 * bT) st.boost0T = st.t;
      if (st.failKind && st.t >= st.failAt) { st.broke = st.failKind; st.phase = "done"; st.done = true; st.load = 0; return st; }
      let Teng = inShift ? 0 : engTq(st.rpm);
      if (NZ && !inShift && st.n2oS.frac < 1) Teng -= (1 - st.n2oS.frac) * interp(res.n2oTq, st.rpm);   // the part of the shot that is not in
      if (st.rpm >= limiter) { Teng = Teng * 0.15; st.limiterTime += dt; }
      let Ttrans;
      const driveRpm0 = wheelRpm + st.wSpin;
      if (st.conv) {
        // torque converter off the trans-brake: multiplies torque while it slips, never lets the engine fall below stall
        const SR = clamp(driveRpm0 / Math.max(1, st.rpm), 0, 1);
        const TR = SR >= 0.85 ? 1 : Math.min(2.1, 1 + 1.1 * (1 - SR / 0.85));
        Ttrans = inShift ? 0 : Teng * TR * 0.97;
      } else {
        // clutch bite ramps in over 0.35 s; a slipping clutch transmits its capacity, so the engine is pulled down toward wheel speed (bog risk)
        st.bite = Math.min(1, (st.bite || 0) + dt / (st.dump ? 0.2 : 0.35));
        if (inShift) Ttrans = 0;
        else if (st.slipping) { Ttrans = st.bite * clutchCap; if (st.dump && st.rpm < 0.85 * holdRpm) Ttrans = Math.min(Ttrans, Teng * 0.98); if (st.rpm <= wheelRpm + st.wSpin + 15) st.slipping = false; }   // off a two-step the clutch slips to keep the engine up near the launch rpm instead of bogging
        if (!st.slipping) Ttrans = Teng;
      }
      const muE = mu * (1 + st.gripGain) * tuneGrip(st.t);
      const Fmax = v.drive === "fwd" ? bite * muE * v.mass * g * (1 - v.rearBias) / (1 + muE * v.cgH / v.wheelbase) : v.drive === "awd" ? bite * muE * v.mass * g * 0.98
        : bite * muE * v.mass * g * v.rearBias / Math.max(0.3, 1 - muE * v.cgH / v.wheelbase);
      // a swap's driveline (veh.dlCap, engine-side N·m): past its rating at full load it lets go — the engine is fine, the pass is over
      if (v.dlCap > 0 && !v.noFail && !st.failKind && !inShift && Teng > v.dlCap) { st.dlOver = (st.dlOver || 0) + dt; if (st.dlOver > 0.05) { st.failKind = "driveline"; st.failAt = st.t; } }
      let Fdemand = Ttrans * ratio * eta / rw, F;
      st.spin = false;
      if (Fdemand > Fmax) { st.spin = true; st.spinTime += dt; F = Fmax * 0.85; st.wSpin += (Ttrans - F * rw / (ratio * eta)) / (I * 2.2) * dt * 60 / (2 * Math.PI); }
      else { F = Fdemand; st.wSpin = Math.max(0, st.wSpin - st.wSpin * dt / 0.15); }
      if (psiShake > 0 && st.v > 6 && st.v < 45 && F > 0.5 * Fmax) { st.shakeT = (st.shakeT || 0) + dt * psiShake; F *= 1 - 0.38 * psiShake * (0.5 + 0.5 * Math.sin(st.t * 60)); }   // tyre shake: the soft sidewall winds up and lets go
      // front-end lift: share of the static front-axle load the launch force takes off the nose
      const lift = F * v.cgH / (v.mass * g * v.wheelbase * Math.max(0.05, 1 - v.rearBias)) * tuneLift(st.t);
      st.lift = clamp(lift, 0, 1); st.liftMax = Math.max(st.liftMax, lift); st.onBars = false;
      if (lift >= 1 && st.v < 60) {
        if (BODY.bars) { st.onBars = true; F *= 1 - Math.min(0.04, (lift - 1) * 0.03); }
        else { st.wheelieT += dt; F *= 0.9; }            // no bars: the driver has to pedal it to keep it straight
      }
      const Fres = 0.5 * rho * cdA0 * st.v * st.v + crr * v.mass * g;
      acc = (F - Fres) / v.mass;
      st.v = Math.max(0, st.v + acc * dt); st.x += st.v * dt;
      const driveRpm = wheelRpm + st.wSpin;
      if (st.conv) { const SRn = clamp(driveRpm / Math.max(1, st.rpm), 0, 1); st.rpm = Math.max(holdRpm * (inShift ? 0.85 : 1.06 + 0.18 * SRn), driveRpm / 0.96); st.slipping = false; }   // the converter flashes past the brake rpm, then couples
      else if (st.slipping) { st.rpm += (Teng - Ttrans) / I * dt * 60 / (2 * Math.PI); if (st.rpm < driveRpm) { st.rpm = driveRpm; st.slipping = false; } }
      else st.rpm = Math.max(v.idle, driveRpm);
      if (st.rpm > limiter + 40) st.rpm = Math.min(st.rpm, limiter + 300);
      if (st.rpm > v.redline * 1.06) st.overrev = Math.max(st.overrev, st.rpm / v.redline);
      if (!inShift && st.rpm < st.minRpm && st.t < 1) { st.minRpm = st.rpm; if (st.rpm < v.launchRpm * 0.55) st.bog = true; }
      if (v.auto && !inShift && st.rpm >= shiftAt && st.gear < v.gears && (!st.slipping || driveRpm >= shiftAt * 0.85)) shift();   // a slipping clutch revs the engine, not the car: no shifting through the box at walking pace
      for (const sh of st.shifts) if (sh.min == null || st.t - sh.t < 0.7) sh.min = Math.min(sh.min == null ? 99 : sh.min, st.boost);
      for (const [d, n] of DRAG_MARKS) if (st.x >= d && !st.marks.find(m => m.n === n)) st.marks.push({ n: n, d: d, t: +st.t.toFixed(3), mph: +(st.v * 2.23694).toFixed(1) });
      if (st.t - lastTrace >= 0.05) { lastTrace = st.t; st.trace.push([+st.t.toFixed(2), Math.round(st.x), +(st.v * 2.23694).toFixed(1), Math.round(st.rpm), st.gear, st.spin ? 1 : 0, +st.boost.toFixed(2), +(driveRpm / ratio * 2 * Math.PI * rw / 60 * 2.23694).toFixed(1), Math.round(st.egt), inShift ? 0 : 1, +(st.n2o || 0).toFixed(2)]); }   // [7] driveshaft speed as mph (above [2] = tyres spinning), [8] EGT C, [9] throttle, [10] nitrous flow 0..1 (datalog)
      if (st.x >= 402.336) { st.trap = st.v * 2.23694; st.trapRpm = st.rpm; st.trapGear = st.gear; st.trapT = st.t; st.phase = "shutdown"; st.chuteOut = !!v.chute; st.load = 0; }
      else if (st.t > 40) { st.done = true; st.phase = "done"; st.load = 0.1; }
      return st;
    }
    /* ---- the driver's controls ---- */
    function burn(on) { if (st.phase !== "burnout") return; st.burning = !!on; if (!on) st.spin = false; }
    function stage() { if (st.phase !== "burnout") return; st.burning = false; st.spin = false; st.phase = "staged"; st.t = 0; st.v = 0; st.rollIn = Math.max(0.3, Math.min(1.4, -st.x * 0.16)); if (st.x >= -0.01) { st.rollIn = 0; st.rolled = true; st.x = 0; } }
    function arm() { if (st.phase !== "staged" || !canArm || st.launch.armed) return false; st.launch.armed = true; return true; }
    function disarm() { if (st.phase !== "staged") return; st.launch.armed = false; }
    /* what can go wrong when the shot hits: a dry kit leans out if the bottle is hotter than the fuel table
       assumes; a wet plate full of mixture lights off a misfire — worse with a line still full of gas */
    function n2oRisk() {
      const lean = NZ.dry ? clamp((NZ.leanRisk || 0) * clamp(1 + 4 * (nzPsiK - 1), 0.3, 1.6) + (nzPsiK > 1.02 ? 0.04 : 0), 0, 0.8) : 0;
      const backfire = clamp((NZ.backfire || 0) * (st.n2oS.line < 0.5 ? 1.4 : 1) * (nzPsiK < 0.9 ? 1.2 : 1), 0, 0.6);
      return { lean: +lean.toFixed(3), backfire: +backfire.toFixed(3) };
    }
    function n2oStep(dt) {
      const z = st.n2oS;
      if (z.purging && (st.phase === "burnout" || st.phase === "staged")) { z.line = Math.min(1, z.line + dt / 0.7); z.purged += dt; z.psi = Math.max(300, z.psi - dt * 3); z.puff = 1; }
      else { z.purging = false; z.puff = Math.max(0, z.puff - dt / 0.3); if (!z.on) z.line = Math.max(0.15, z.line - dt / 45); }   // the line warms and boils back to gas
      if (st.phase !== "run" || z.cut) { z.frac = 0; st.n2o = 0; return; }
      const mph = st.v * 2.23694;
      const arm = nzAct === "mph40" ? mph >= 40 : nzAct === "mph60" ? mph >= 60 : nzAct === "shift2" ? st.gear >= 2 && st.shiftT <= 0 : st.rpm >= (NZ.winRpm || 0);
      if (arm && !z.on) {
        z.on = true; z.onT = st.t; z.onMph = mph; z.onGear = st.gear; z.onX = st.x; z.lineAtOn = z.line; z.shifts0 = st.shifts.length;
        if (z.event === "lean" || z.event === "backfire") { st.failKind = z.event; st.failAt = st.t + (z.event === "lean" ? 0.35 + Math.random() * 0.5 : 0.04 + Math.random() * 0.2); }
        else if (z.event === "panel") z.panelAt = st.t + 0.05 + Math.random() * 0.25;
      }
      if (!z.on) { z.frac = 0; st.n2o = 0; return; }
      if (z.panelAt != null && st.t >= z.panelAt) { z.cut = true; z.frac = 0; st.n2o = 0; z.panelAt = null; st.launch.pops = 1; return; }   // the burst panel blows, the controller kills the shot
      const since = st.t - z.onT;
      z.line = Math.min(1, z.line + dt / 0.5);             // vapour first, then liquid at the jets
      let k = nzPsiK * (0.35 + 0.65 * z.line);
      if (nzAct !== "window" && NZ.prog) k *= clamp(since / 1.0, 0.25, 1);   // the controller ramps from the moment it is switched
      if (NZ.stageHp && nzAct !== "window") { if (!z.stage2 && (st.shifts.length > z.shifts0 || since > 1.2)) z.stage2 = true; if (!z.stage2) k *= NZ.stageHp[0] / NZ.shotHp; }
      z.frac = k;
      st.n2o = +(k * (interp(res.n2oTq, st.rpm) > 1 ? 1 : 0)).toFixed(3);   // in only above the window switch
    }
    function purge(on) { if (!NZ || (st.phase !== "burnout" && st.phase !== "staged")) return false; st.n2oS.purging = !!on; return true; }
    function launch() {
      if (st.phase !== "staged") return;
      if (st.rollIn > 0) { st.rollIn = 0; st.x = 0; st.rolled = true; }
      const wasArmed = st.launch.armed;
      st.launchBoost = st.boost; st.launchRpmAct = Math.round(st.rpm);
      st.gripGain = TY.heat * st.tyreTemp * (lineLock || !v.burnout ? 1 : 0.6) - st.overcook;
      st.phase = "run"; st.slipping = true; st.bite = 0; st.dump = false; st.t = 0; st.launch.armed = false; st.launch.pops = 0;
      if (transBrake) { st.conv = true; st.slipping = false; }   // a converter car leaves on the converter either way
      if (wasArmed && twoStep) { st.rpm = holdRpm; if (!transBrake) { st.dump = true; st.bite = 0.35; } }   // off a two-step the clutch is dumped from the friction point, not fed in
      // what the line did to the hot side decides whether something lets go under load
      const pT = isTurbo ? clamp((st.turbDose - 0.3) / 1.8, 0, 0.9) : 0;
      const pM = MH ? clamp((st.manDose - 0.5) / 2.5, 0, 0.9) : 0;
      st.risk = { turbo: +pT.toFixed(2), manifold: +pM.toFixed(2) };
      if (!v.noFail) { const rnd = typeof v.rng === "function" ? v.rng : Math.random; if (rnd() < pT) st.failKind = "turbo"; else if (rnd() < pM) st.failKind = "manifold"; if (st.failKind) st.failAt = 0.15 + rnd() * 0.6; }
      if (NZ) { const r = n2oRisk(); st.risk.lean = r.lean; st.risk.backfire = r.backfire;
        if (!v.noFail && !st.failKind) { const rnd = typeof v.rng === "function" ? v.rng : Math.random; if (rnd() < r.lean) st.n2oS.event = "lean"; else if (rnd() < r.backfire) st.n2oS.event = rnd() < 0.5 ? "panel" : "backfire"; } }
    }
    function result() {
      const q = st.marks.find(m => m.n === "1/4 mi"), e = st.marks.find(m => m.n === "1/8 mi"), s = st.marks.find(m => m.n === "60 ft");
      const reasons = [];
      const C0 = n => Math.round(n).toLocaleString("en-CA");
      if (st.broke || st.risk && (st.risk.turbo > 0 || st.risk.manifold > 0) || st.lineHeat > 0.8) {
        const held = st.armedT, how = `Held the ${retardOn ? "two-step" : twoStep ? "two-step" : transBrake ? "trans-brake" : "anti-lag"} for ${held.toFixed(1)} s${retardOn ? " at " + Math.round(retard) + "°" : ""}${transBrake && twoStep ? " on the trans-brake" : ""}`;
        const eL = Math.round(Math.max(st.egtLine, 0) / 5) * 5, peak = `turbine inlet hit ${C0(eL)} °C`;
        if (st.broke === "manifold") reasons.push(`${how} — ${MH && isTurbo ? peak : "the exhaust hit " + C0(eL) + " °C"}; the ${MH ? MH.n + " cracked " + MH.where : "manifold cracked"}. About a second on the limiter is plenty — every one after that is heat the ${MH ? MH.n : "manifold"} has to swallow.`);
        else if (st.broke === "turbo") reasons.push(`${how} — ${peak}, past the ${(OPT.turbineMat[res.turbineMat] || OPT.turbineMat.cast_iron).name}'s ${C0(egtLimit)} °C limit. The turbine wheel let go the moment it saw full load. Less retard, a shorter hold, or an Inconel hot side.`);
        else if (st.risk && (st.risk.turbo > 0.02 || st.risk.manifold > 0.02)) reasons.push(`${how} — ${isTurbo ? peak : "exhaust hit " + C0(eL) + " °C"}. It lived — but the odds of ${st.risk.turbo >= st.risk.manifold ? "cooking the turbine" : "cracking the " + (MH ? MH.n : "manifold")} were ${Math.round(100 * Math.max(st.risk.turbo, st.risk.manifold))}%, and the heat is wear either way.`);
        else if (st.lineHeat > 0.8) reasons.push(`${how} — the exhaust ran up to ${C0(eL)} °C on the line. Inside the limits, but that heat is wear.`);
      }
      if (isTurbo && q && !st.broke) {
        const lb = st.launchBoost, t90 = st.boost0T;
        const unit = res.turboUnits === 2 && !res.compound ? (mm >= 88 ? "pair of " + mm + " mm frames" : "twin turbos") : res.compound ? "compound pair" : (mm >= 88 ? mm + " mm frame" : (res.turboSize || "") + " turbo");
        if (lb < 0.35 * bT && (t90 == null || t90 > 0.6)) {
          const tail = t90 != null ? ` and took ${t90.toFixed(1)} s to come on` : " and never came fully on";
          if (!twoStep && !transBrake) reasons.push(`Left the line on ${lb.toFixed(1)} of ${bT.toFixed(1)} bar — the ${unit} was asleep${tail}. A two-step with launch retard, or a trans-brake, builds boost before the green.`);
          else if (twoStep && !retardOn && !transBrake) reasons.push(`Left on ${lb.toFixed(1)} of ${bT.toFixed(1)} bar. A plain two-step holds the rpm but makes very little heat — launch retard is what lights a turbo on the line.`);
          else reasons.push(`Held ${st.armedT.toFixed(1)} s and still left on only ${lb.toFixed(1)} of ${bT.toFixed(1)} bar — the ${unit} is a lot of wheel to spin up at ${C0(holdRpm)} rpm. More retard, a higher hold rpm, or a smaller frame.`);
        }
        const dips = st.shifts.filter(x => x.boost > 0.3 && x.min != null).map(x => x.boost - x.min);
        if (ALS && st.shifts.length) reasons.push(`${ALS.name} kept ${alsShiftMin() != null ? alsShiftMin().toFixed(1) : "—"} of ${bT.toFixed(1)} bar through the shifts and fired for ${st.alsT.toFixed(1)} s — the turbine paid for it with ${st.alsDose.toFixed(1)} pass${st.alsDose >= 1.05 ? "es" : ""} of extra wear.`);
        if (dips.length && dips.reduce((a, b) => a + b, 0) / dips.length > 0.3 * bT) reasons.push(`Each shift dumped about ${(dips.reduce((a, b) => a + b, 0) / dips.length).toFixed(1)} bar and the ${unit} had to build it again — that lag between gears is the price of a big frame.`);
      }
      if (v.burnout && (v.tyre === "radial" || v.tyre === "slick")) {
        if (st.tyreTemp < 0.25 && st.burnT < 0.5) reasons.push(`No burnout — cold ${TY.n.toLowerCase()}s give away about ${Math.round(TY.heat * 100)}% of their grip. Hold the button in the water box for two or three seconds.`);
        else if (st.overcook > 0.01) reasons.push(`Burned out for ${st.burnT.toFixed(1)} s — past about four seconds the rubber goes greasy and loses what the heat gave it.`);
        else if (!lineLock && st.burnT > 1) reasons.push(`Without a line lock the burnout only half-worked — the car crept out of the box and the fronts took some of it.`);
      }
      if (st.spinTime > 0.25) reasons.push(`Wheelspin for ${st.spinTime.toFixed(1)} s — ${TY.n.toLowerCase()}s can only plant about ${Math.round(Fmax0() / 1000)} kN. Softer tyre, taller first gear, more rear weight, or a lower launch rpm.`);
      if ((st.shakeT || 0) > 0.1) reasons.push(`Tyre shake for ${st.shakeT.toFixed(1)} s — ${v.tyrePsi} psi is too soft for ${TY.n.toLowerCase()}s (they're set up around ${psiNom}); the sidewall winds up and lets go. A pound or two more.`);
      if (st.bog) reasons.push(`Bogged off the line — rpm fell to ${Math.round(st.minRpm)}. Launch higher or shorten first gear.`);
      if (st.wheelieT > 0.15) reasons.push(`The front wheels were off the ground for ${st.wheelieT.toFixed(1)} s — a street shell has no wheelie bars, so the driver had to pedal it straight. Less rear weight bias, or a body with bars.`);
      if (st.limiterTime > 0.3) reasons.push(`${st.limiterTime.toFixed(1)} s on the rev limiter. Shift sooner or lengthen the gearing.`);
      if (st.overrev > 1.06) reasons.push(`Over-revved to ${Math.round(st.overrev * v.redline).toLocaleString()} rpm on a shift.`);
      const late = st.shifts.filter(x => x.rpm < res.peakHpRpm * 0.92);
      if (late.length) reasons.push(`${late.length} shift${late.length > 1 ? "s" : ""} well below peak power (${res.peakHpRpm.toLocaleString()} rpm) — hold the gears longer.`);
      if (q && (st.trapGear || st.gear) < v.gears && !late.length) reasons.push(`Crossed the line in ${st.trapGear || st.gear}${(st.trapGear||st.gear) === 1 ? "st" : (st.trapGear||st.gear) === 2 ? "nd" : (st.trapGear||st.gear) === 3 ? "rd" : "th"} of ${v.gears} — top gear never used; a shorter final drive would work the engine harder.`);
      if (q && st.trapRpm && st.trapRpm < res.peakHpRpm * 0.85 && st.trapGear === v.gears) reasons.push(`Ran out of gear — only ${Math.round(st.trapRpm).toLocaleString()} rpm at the stripe. Lower (numerically higher) final drive.`);
      if (!q && !st.broke) reasons.push("Did not reach the 1/4-mile mark.");
      if (st.broke === "driveline") reasons.unshift(`The driveline let go at ${Math.round(st.x)} m — it is rated for ${Math.round(v.dlCap)} N·m and the engine put more than that through it. The engine is fine. A stronger gearbox and axle (Build → Swap), or less torque.`);
      if (q && q.mph > 150 && !v.chute) reasons.push(`Trapped ${Math.round(q.mph)} mph with no parachute. Anything over 150 gets black-flagged at tech, and it took ${Math.round(st.shutFt)} ft of brakes alone to pull up.`);
      else if (st.shutFt > 1800) reasons.push(`Used ${Math.round(st.shutFt)} ft of shutdown — more road than most strips give you.`);
      if (q && v.body === "street" && q.mph > 160) reasons.push("A full street body is its own parachute at this speed — a slicker shell is worth several mph of trap.");
      if (NZ) {
        const z = st.n2oS, shot = NZ.shotHp, C1 = n => Math.round(n).toLocaleString("en-CA");
        if (st.broke === "lean") reasons.unshift(`The ${shot} shot came in lean${nzPsi > 980 ? ` — the bottle was at ${C1(nzPsi)} psi, more nitrous than the fuel table was written for` : ""}. ${NZ.dry ? "A dry kit is only as rich as the injectors and the pump behind it: " : ""}a cylinder went lean on the bottle and melted the crown.`);
        else if (st.broke === "backfire") reasons.unshift(`Intake backfire: the ${NZ.plate ? "plate" : "nozzle"} had the intake full of fuel and nitrous, and a misfire lit it. It split the intake. Plates hate long runners, lean mixtures and a line full of gas.`);
        else if (z.cut) reasons.push(`Intake backfire on the hit — the burst panel blew and the controller killed the shot. The pass was finished on the motor alone.`);
        if (!z.on && !st.broke) reasons.push(nzAct === "window" ? `The nitrous never came on — the window switch arms at ${C1(NZ.winRpm)} rpm.` : `The nitrous never came on — it was set for ${nzAct === "shift2" ? "after the 1-2 shift" : nzAct === "mph40" ? "40 mph" : "60 mph"}.`);
        else if (z.on && z.lineAtOn < 0.5 && !st.broke) reasons.push(`The line was not purged: the first of the shot was gas, not liquid, so the hit came in soft. Hold PURGE on the line until it spits white.`);
        if (nzPsi < 880 && z.on) reasons.push(`Bottle at ${C1(nzPsi)} psi — a cool bottle flows ${Math.round((1 - nzPsiK) * 100)}% less shot, and a different amount every pass. A heater blanket holds it near 950.`);
        if (z.on && nzAct !== "window" && st.spinTime < 0.1 && z.onGear <= 1 && z.onMph < 45) reasons.push(`The shot came on at ${Math.round(z.onMph)} mph and the tyres held it.`);
        if (z.on && st.spinTime > 0.25 && z.onGear === 1 && nzAct === "window") reasons.push(`The shot came on in first gear and spun the tyres — set it to come on after the 1-2 shift, or at 40 mph.`);
      }
      const thousand = st.marks.find(m => m.n === "1000 ft"), three = st.marks.find(m => m.n === "330 ft");
      return { et: q ? q.t : null, mph: q ? q.mph : null, eighth: e || null, sixty: s || null, ft330: three || null, ft1000: thousand || null, marks: st.marks, trace: st.trace, shifts: st.shifts, spinTime: +st.spinTime.toFixed(2), limiterTime: +st.limiterTime.toFixed(2), overrev: +st.overrev.toFixed(3), bog: st.bog, shutFt: Math.round(st.shutFt), chute: !!v.chute, body: v.body, reasons: reasons, veh: v, ratios: ratios.map(r => +r.toFixed(2)),
        launch: { ctl: lc, brake: tbk, holdRpm: twoStep ? holdRpm : 0, retard: retard, held: +st.armedT.toFixed(2), boost: +st.launchBoost.toFixed(2), boostTarget: bT, rpm: st.launchRpmAct, tyreTemp: +st.tyreTemp.toFixed(2), burnT: +st.burnT.toFixed(1), grip: +(st.gripGain * 100).toFixed(1), egtPeak: Math.round(st.egtPeak), egtLine: Math.round(st.egtLine), boostT: st.boost0T != null ? +st.boost0T.toFixed(2) : null },
        heat: { egtPeak: Math.round(st.egtPeak), egtLine: Math.round(st.egtLine), turbDose: +st.turbDose.toFixed(2), manDose: +st.manDose.toFixed(2), risk: st.risk, lineHeat: +st.lineHeat.toFixed(2), abuse: +clamp(st.lineHeat * 0.5 + st.alsDose, 0, 2.5).toFixed(2), limitC: egtLimit || null, manifold: MH ? MH.n : null },
        n2o: NZ ? { kit: NZ.kind, shotHp: NZ.shotHp, act: nzAct, psi: Math.round(st.n2oS.psi), psiK: +nzPsiK.toFixed(3), on: st.n2oS.on, onT: st.n2oS.on ? +st.n2oS.onT.toFixed(2) : null, onMph: Math.round(st.n2oS.onMph), onGear: st.n2oS.onGear, onFt: Math.round(st.n2oS.onX * 3.28084), purged: +st.n2oS.purged.toFixed(1), lineAtOn: +st.n2oS.lineAtOn.toFixed(2), cut: st.n2oS.cut, risk: st.risk ? { lean: st.risk.lean, backfire: st.risk.backfire } : null } : null,
        broke: st.broke, liftMax: +st.liftMax.toFixed(2), wheelieT: +st.wheelieT.toFixed(2),
        als: ALS ? { type: res.als, fired: +st.alsT.toFixed(2), dose: +st.alsDose.toFixed(2), bangs: st.alsBangs, shiftMin: alsShiftMin() } : null };
    }
    // lowest boost in the 0.7 s after each shift, averaged: what the anti-lag kept in the manifold
    function alsShiftMin() { const m = st.shifts.filter(x => x.min != null).map(x => x.min); return m.length ? +(m.reduce((a, b) => a + b, 0) / m.length).toFixed(2) : null; }
    function Fmax0() { const m = mu * (1 + st.gripGain) * tuneGrip(0.3); return bite * m * v.mass * g * v.rearBias / Math.max(0.3, 1 - m * v.cgH / v.wheelbase); }
    return { st: st, step: step, launch: launch, shift: shift, result: result, ratios: ratios, burn: burn, stage: stage, arm: arm, disarm: disarm, canArm: canArm, holdRpm: holdRpm, purge: purge, n2o: NZ };
  }
  /* A whole pass with no human in it: contract ET checks, the rival in the other lane, the node harness.
     veh.holdTime: seconds on the two-step / trans-brake before the release (default 1.2 when fitted). */
  function dragPass(res, veh) {
    if (veh && (veh.driver || veh.drive === "auto")) return dragAutoPass(res, veh);   // the auto driver, the same presses the app makes
    const d = dragRun(res, Object.assign({ auto: true }, veh || {}));
    if (d.st.phase === "burnout") d.stage();
    while (d.st.phase === "staged" && d.st.rollIn > 0) d.step(0.01);
    if (d.canArm) { const ht = veh && veh.holdTime != null ? +veh.holdTime : 1.2; if (ht > 0 && d.arm()) { let t = 0; while (t < ht) { d.step(0.01); t += 0.01; } } }
    if (d.n2o && veh.n2o.purge > 0) { d.purge(true); let t = 0; while (t < veh.n2o.purge) { d.step(0.01); t += 0.01; } d.purge(false); }   // a headless car purges before it leaves
    d.launch(); while (!d.st.done) d.step(0.002); return d.result();
  }
  /* The auto driver for a drag pass: the player's own buttons, pressed on a fixed 4 ms clock. A burnout of the right
     length for the tyre, roll in, purge a nitrous line, arm the two-step / trans-brake / anti-lag on the ambers, leave on
     the green with a human light (most .04-.10, now and then a slow one, a red very rarely), and on a manual box shift
     near where the next gear pulls harder, read off the build's own torque curve, give or take a hand. Launch rpm, the
     nitrous switch and the chute are the car's set-up, not the driver's, so they stay as set; there is no pedal on a
     drag pass, for the player or for it. Deterministic for a seed, on its own random stream.
     tick(d, h, tree) runs before each step of the runner d and returns one press or null: "burn" / "unburn" / "stage" /
     "purge" / "unpurge" / "arm" / "go" / "shift". tree: null on a time trial; on a tree, NaN while it is dark, then seconds
     from the green (negative before it). say(d, tree) is the HUD's word for what it is doing. */
  const DRAG_TICK = 0.004;
  function dragDriver(seed, res, veh) {
    const r = pullRng(((seed >>> 0) ^ 0x2D5A9E37) >>> 0);
    const gs = () => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307 * r()); };
    const v = Object.assign({ tyre: "street", gears: 4, first: 2.9, top: 1.0, final: 3.7, redline: 7000, auto: true, tyreDia: 27, transBrake: "none" }, veh || {});
    const hot = v.tyre === "radial" || v.tyre === "slick", ll = v.transBrake === "line_lock", red = v.redline;
    const jump = r() < 0.0025, slow = r() < 0.05, g0 = gs(), sl = r(), jr = r();
    let rt = 0.072 + 0.022 * g0; if (slow) rt += 0.04 + 0.12 * sl; if (jump) rt = -(0.004 + 0.03 * jr);
    const plan = { wait: 0.3 + 0.4 * r(), burn: hot ? (ll ? 3.0 : 3.4) + 0.5 * r() : 1.0 + 0.6 * r(), settle: 0.5 + 0.5 * r(), purgeAt: 0.25 + 0.3 * r(), purge: 0.9 + 0.5 * r(),
      beat: 0.6 + 0.6 * r(), hold: 1.0 + 0.4 * r(), rt: +rt.toFixed(4), shift: [], ideal: [] };
    // shift points: the rpm where the next gear's wheel torque (after the drop) matches this one's, or the redline if it never does
    const n = Math.max(1, v.gears | 0), rat = [];
    for (let i = 0; i < n; i++) rat.push(n === 1 ? v.first : v.first * Math.pow(v.top / v.first, i / (n - 1)));
    const rp = res && res.rpms, tq = res && res.torque, N = rp ? rp.length : 0;
    const T = x => { if (!N) return 1; if (x <= rp[0]) return tq[0]; if (x >= rp[N - 1]) return tq[N - 1]; let i = 1; while (rp[i] < x) i++; return tq[i - 1] + (x - rp[i - 1]) / (rp[i] - rp[i - 1]) * (tq[i] - tq[i - 1]); };
    for (let i = 0; i < n - 1; i++) {
      const k = rat[i + 1] / rat[i]; let s = red;
      for (let x = Math.round(0.55 * red); x <= red; x += 25) if (T(x) * rat[i] <= T(x * k) * rat[i + 1]) { s = x; break; }
      let x = s + 70 * gs(); if (r() < 0.04) x += 150 + 150 * r();   // now and then a hand that is late on the lever
      plan.ideal.push(s); plan.shift.push(Math.round(clamp(x, 0.6 * red, 1.015 * red)));
    }
    let t = 0, offAt = null, rolledT = null, readyT = null, purged = false;
    function goIn(d, tree) {   // seconds until it means to leave
      if (tree === null) return readyT == null ? Infinity : readyT + plan.beat + (d.canArm ? plan.hold : 0) - t;
      return tree !== tree ? Infinity : plan.rt - tree;
    }
    function tick(d, h, tree) {
      const st = d.st; t += h;
      if (st.phase === "burnout") {
        if (st.burning) { if (st.burnT >= plan.burn) { offAt = t; return "unburn"; } return null; }
        if (st.burnT > 0) return offAt == null || t - offAt >= plan.settle ? "stage" : null;
        return t >= plan.wait ? "burn" : null;
      }
      if (st.phase === "staged") {
        if (!st.rolled) return null;
        if (rolledT == null) rolledT = t;
        const z = st.n2oS;
        if (z && !purged) {   // hold PURGE until the line spits liquid
          if (!z.purging) { if (t - rolledT >= plan.purgeAt) return "purge"; return null; }
          if (z.purged >= plan.purge || goIn(d, tree) <= plan.hold + 0.1) { purged = true; return "unpurge"; }
          return null;
        }
        if (readyT == null) readyT = t;
        const g = goIn(d, tree);
        if (g <= 0) return "go";
        if (d.canArm && !st.launch.armed && g <= plan.hold) return "arm";
        return null;
      }
      if (st.phase === "run") {
        if (v.auto || st.gear >= n || st.shiftT > 0) return null;
        const tgt = plan.shift[st.gear - 1];
        if (st.rpm < tgt) return null;
        if (st.slipping && !st.conv && st.v / (Math.PI * v.tyreDia * 0.0254) * 60 * rat[st.gear - 1] * v.final < 0.85 * tgt) return null;   // a slipping clutch revs the engine, not the car
        return "shift";
      }
      return null;
    }
    function say(d, tree) {
      const st = d.st, z = st.n2oS;
      if (st.phase === "burnout") return st.burning ? "burnout" : st.burnT > 0 ? "staging" : "into the box";
      if (st.phase === "staged") {
        if (!st.rolled) return "staging";
        if (z && z.purging) return "purging";
        if (st.launch.armed) return st.launch.twoStep ? "two-step " + Math.round(d.holdRpm) : st.launch.transBrake ? "on the trans-brake" : "anti-lag armed";
        return tree === null ? "staged" : "waiting on the tree";
      }
      if (st.phase === "run") {
        const sh = st.shifts[st.shifts.length - 1];
        if (sh && st.t - sh.t < 0.6) return "shift " + sh.gear + "→" + (sh.gear + 1);
        if (z && z.on && !z.cut && st.t - z.onT < 0.8) return "nitrous on";
        if (st.t < 0.7) return "launch " + st.launchRpmAct;
        return st.spin ? "wheelspin" : "flat out";
      }
      if (st.phase === "shutdown") return st.chuteOut ? "chute out" : "on the brakes";
      return "";
    }
    return { plan: plan, tick: tick, say: say };
  }
  /* dragPass with the auto driver at the wheel (veh.driver, or veh.drive "auto" with veh.seed): burnout to the stripe.
     veh.tree: a heads-up tree (it lights 1.2-3 s after the car is in the beams); the result carries auto.rt (null on a
     time trial) and auto.foul. */
  function dragAutoPass(res, veh) {
    const d = dragRun(res, Object.assign({ auto: true, burnout: true }, veh)), H = DRAG_TICK;
    const drv = veh.driver || dragDriver(veh.seed, res, veh), tr = pullRng(((veh.seed >>> 0) ^ 0x7EE5) >>> 0);
    let t = 0, green = null, rt = null, foul = false;
    while (!d.st.done && t < 120) {
      const st = d.st;
      if (veh.tree && green == null && st.phase === "staged" && st.rolled) green = t + 1.2 + 1.8 * tr() + 1.5;
      const tree = !veh.tree ? null : green == null || t < green - 1.5 ? NaN : t - green;
      const a = drv.tick(d, H, tree);
      if (a === "burn") d.burn(true); else if (a === "unburn") d.burn(false); else if (a === "stage") d.stage();
      else if (a === "purge") d.purge(true); else if (a === "unpurge") d.purge(false); else if (a === "arm") d.arm(); else if (a === "shift") d.shift();
      else if (a === "go") { if (veh.tree) { rt = t - green; if (rt < 0) foul = true; else if (veh.transBrake === "trans_brake") rt = Math.max(0.001, rt - 0.020); rt = +rt.toFixed(3); } d.launch(); }
      d.step(H); t += H;
    }
    const out = d.result(); out.auto = { rt: rt, foul: foul, plan: drv.plan }; return out;
  }
