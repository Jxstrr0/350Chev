/*pew-simlate 1.76.142.1*/
  /* =====================================================================
     DRAG STRIP, THE PASS ITSELF: in sim-late.js, not in the page (since 1.76.139.0).
     Here: the time-stepped pass (dragRun, dragPass), the auto driver (dragDriver, dragAutoPass) and the shift and drivetrain stress helpers.
     build.js writes this file to sim-late.js; the app fetches it once the garage is up and runs it
     inside the ENGINE_SIM closure (simLateRun in sim/tunemap.js), so it sees every physics name as
     if it were still in the page. sim/drag.js keeps the drivetrain tiers, gear ratios, tyres, aero, launch technique, dragPrep and the nitrous bottle.
     ===================================================================== */
  const dtShiftK = id => drivetrain(id).shift / DRIVETRAIN.stock.shift, dtEtaK = id => drivetrain(id).eta / DRIVETRAIN.stock.eta;   // against Stock, for sims with their own base figures
  const dtStress = (st, o, dt) => { if (o <= 1.3) return false; st.dtO = Math.max(st.dtO || 0, o); st.dtS = (st.dtS || 0) + (o - 1.3) * dt; return st.dtS > 0.12; };
  const DRAG_MARKS = [[18.288, "60 ft"], [100.584, "330 ft"], [201.168, "1/8 mi"], [304.8, "1000 ft"], [402.336, "1/4 mi"]];
  const BURN_BOX_X = -8;   // the water box sits behind the starting line

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
    const ratios = gearRatios(v);
    const DT = drivetrain(v.dtId), shiftTime = v.shiftTime > 0 ? +v.shiftTime : DT.shift;   // the tier's box and driveline (veh.dtId); veh.eta / veh.shiftTime override
    const rw = v.tyreDia * 0.0254 / 2 * rollK, g = 9.81, eta = v.eta > 0 ? +v.eta : DT.eta, TY = TYRES[v.tyre] || TYRES.street;
    let mu = TY.mu;
    if (veh && veh.body && !(veh.wheelbase > 0)) v.wheelbase = (AERO[veh.body] || AERO.street).wb;
    if (veh && veh.body && !(veh.cgH > 0) && AERO[veh.body] && AERO[veh.body].cgH) v.cgH = AERO[veh.body].cgH;   // v3 classes only
    /* ride height (veh.rideH, mm off where the body sits as delivered): up raises the centre of gravity (more weight onto
       the rear tyres at the hit, but more lift) and lets more air under the car; down the reverse. 0 or unset: no change. */
    const rideMm = clamp(+v.rideH || 0, -60, 100);
    if (rideMm) v.cgH = clamp(v.cgH + rideMm / 1000, 0.2, 0.9);
    const I = 0.12 + 0.06 * ((res.VdEq || res.Vd) / 1000), peakTq = res.peakTq, clutchCap = peakTq * 1.8;
    const BODY = AERO[v.body] || AERO.street, cdA0 = (v.cdA > 0 ? v.cdA : BODY.cdA) * (1 + 0.002 * rideMm), bite = BODY.bite, crr = 0.014, rho = 1.2, limiter = v.redline * 1.02, shiftAt = v.shiftRpm || v.redline - 200;

    /* ---- launch tech ---- */
    const lc = OPT.launchCtl[v.launchCtl] ? v.launchCtl : "none", tbk = OPT.transBrake[v.transBrake] ? v.transBrake : "none";
    const twoStep = lc !== "none", retardOn = lc === "two_step_retard", transBrake = tbk === "trans_brake", lineLock = tbk === "line_lock";
    const retard = retardOn ? clamp(+v.launchRetard || 0, 0, 35) : 0;
    /* a trans-brake car leaves on the converter, which flashes just past the brake rpm, then couples */
    const holdRpm = twoStep && v.twoStepRpm > 0 ? Math.min(v.redline, v.twoStepRpm) : v.launchRpm, cpl = 0.96;
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
    st.egtPeak = st.egt; st.tMetal = st.egt; st.mMetal = st.egt;   // the turbine wheel and housing: pounds of superalloy and cast steel, they soak up a spike before they reach it
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
      st.tMetal += (st.egt - st.tMetal) * (1 - Math.exp(-dt / (res.turbineMat === "inconel" ? 2.6 : 0.7)));   // a cast Ni-resist wheel runs thinner on margin than an Inconel one
      if (isTurbo && st.tMetal > egtLimit) st.turbDose += dt * (st.tMetal - egtLimit) / 50;   // the hot side dies of soak, not of one bang off the limiter
      st.mMetal += (st.egt - st.mMetal) * (1 - Math.exp(-dt / (MH && MH.cast ? 2.2 : 1.4)));   // thin-wall tube heats through faster than a casting
      if (MH && st.mMetal > MH.crackC) st.manDose += dt * (st.mMetal - MH.crackC) / 60 * (MH.cast ? 1.3 : 1);
      if (st.egt > 850) st.lineHeat += dt * (st.egt - 850) / 100;
    }
    function shift() { if (st.phase !== "run" || st.gear >= v.gears || st.shiftT > 0) return; st.shifts.push({ rpm: Math.round(st.rpm), gear: st.gear, x: st.x, t: st.t, boost: +st.boost.toFixed(2) }); st.gear++; st.shiftT = shiftTime; if (isTurbo) st.launch.pops = Math.max(st.launch.pops, 0.35 * clamp(st.boost / 1.2, 0.3, 1)); }
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
      const driveRpm0 = wheelRpm + st.wSpin;
      /* the rev limiter: a slipping clutch or converter lets the engine bounce on it and still feed the box about 15% on average;
         once the wheels are driving the engine at the limiter (coupled, or the converter all but locked) there is nothing left
         to push with — the cut is total, and the car can go no faster in that gear. The limiter never set the road speed before:
         the 15% of a big engine's torque kept pushing at any speed, so a short-geared car ran past the stripe on the cut alone. */
      if (st.rpm >= limiter) { st.limiterTime += dt; Teng = (st.conv ? driveRpm0 / cpl : !st.slipping ? driveRpm0 : 0) >= limiter ? 0 : Teng * 0.15; }
      let Ttrans;
      if (st.conv) {
        // torque converter off the trans-brake: multiplies torque while it slips
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
      // a drivetrain tier (veh.dtCap, engine-side N·m): the clutch slips past its rating, and a big overload breaks a part (deterministic: stress builds with the overload)
      if (v.dtCap > 0 && !inShift) { if (Ttrans > v.dtCap) Ttrans = v.dtCap; if (!v.noFail && !st.failKind && dtStress(st, Teng / v.dtCap, dt)) { st.failKind = "driveline"; st.failAt = st.t; st.dtMsg = dtPart(st.dtO); } }
      let Fdemand = Ttrans * ratio * eta / rw, F;
      st.spin = false;
      // a swap car (veh.dlCap set): the driver and traction control hold the tyres at the peak while the overshoot is small, and the margin grows
      // with speed; past it they spin and the grip falls from 97% to the usual 85%. Everything else spins the moment it is over the limit, as ever.
      const swTol = v.dlCap > 0 ? 0.12 + 0.035 * st.v : 0, swHold = Fdemand > Fmax && Fdemand <= Fmax * (1 + swTol);
      if (Fdemand > Fmax && !swHold) { st.spin = true; st.spinTime += dt; F = Fmax * (v.dlCap > 0 ? 0.97 - 0.12 * Math.min(1, (Fdemand / Fmax - 1 - swTol) / 0.6) : 0.85); st.wSpin += (Ttrans - F * rw / (ratio * eta)) / (I * 2.2) * dt * 60 / (2 * Math.PI); }
      else { F = swHold ? Fmax : Fdemand; st.wSpin = Math.max(0, st.wSpin - st.wSpin * dt / 0.15); }
      if (psiShake > 0 && st.v > 6 && st.v < 45 && F > 0.5 * Fmax) { st.shakeT = (st.shakeT || 0) + dt * psiShake; F *= 1 - 0.38 * psiShake * (0.5 + 0.5 * Math.sin(st.t * 60)); }   // tyre shake: the soft sidewall winds up and lets go
      // front-end lift: share of the static front-axle load the launch force takes off the nose
      const lift = F * v.cgH / (v.mass * g * v.wheelbase * Math.max(0.05, 1 - v.rearBias)) * tuneLift(st.t);
      st.lift = clamp(lift, 0, 1); st.liftMax = Math.max(st.liftMax, lift); st.onBars = false;
      if (lift >= 1 && st.v < 60) {
        if (BODY.bars || v.wbar) st.onBars = true;   // the bars take the pitch and the car keeps driving
        else { st.wheelieT += dt; F *= 1 - Math.min(0.3, 0.1 + 0.25 * (lift - 1)); }   // no bars: the higher the nose, the more drive the driver has to pedal off to keep it straight
      }
      const Fres = 0.5 * rho * cdA0 * st.v * st.v + crr * v.mass * g;
      acc = (F - Fres) / v.mass;
      st.v = Math.max(0, st.v + acc * dt); st.x += st.v * dt;
      const driveRpm = wheelRpm + st.wSpin;
      /* the converter flashes past the brake rpm, then couples. The flash never reaches the shift point: a brake rpm set close
         to it would otherwise hold the engine above shiftAt off the line, so the box ran up through every gear in the first
         half-second and the pass was made in top gear (or, above the limiter, on 15% of the engine) */
      if (st.conv) { const SRn = clamp(driveRpm / Math.max(1, st.rpm), 0, 1); st.rpm = Math.max(Math.min(holdRpm * (inShift ? 0.85 : 1.06 + 0.18 * SRn), shiftAt * 0.97), driveRpm / cpl); st.slipping = false; }
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
      if (st.wheelieT > 0.15) reasons.push(`The front wheels were off the ground for ${st.wheelieT.toFixed(1)} s — ${v.body === "gasser" ? "a gasser has no wheelie bars" : "a street shell has no wheelie bars"}, so the driver had to pedal it straight. Bolt on wheelie bars in the drag setup (about 10 kg), take some rear weight bias off, or pick a body with bars.`);
      if (st.limiterTime > 0.3) reasons.push(`${st.limiterTime.toFixed(1)} s on the rev limiter. Shift sooner or lengthen the gearing.`);
      if (st.overrev > 1.06) reasons.push(`Over-revved to ${Math.round(st.overrev * v.redline).toLocaleString()} rpm on a shift.`);
      const late = st.shifts.filter(x => x.rpm < res.peakHpRpm * 0.92);
      if (late.length) reasons.push(`${late.length} shift${late.length > 1 ? "s" : ""} well below peak power (${res.peakHpRpm.toLocaleString()} rpm) — hold the gears longer.`);
      if (q && (st.trapGear || st.gear) < v.gears && !late.length) reasons.push(`Crossed the line in ${st.trapGear || st.gear}${(st.trapGear||st.gear) === 1 ? "st" : (st.trapGear||st.gear) === 2 ? "nd" : (st.trapGear||st.gear) === 3 ? "rd" : "th"} of ${v.gears} — top gear never used; a shorter final drive would work the engine harder.`);
      if (q && st.trapRpm && st.trapRpm < res.peakHpRpm * 0.85 && st.trapGear === v.gears) reasons.push(`Ran out of gear — only ${Math.round(st.trapRpm).toLocaleString()} rpm at the stripe. Lower (numerically higher) final drive.`);
      if (!q && !st.broke) reasons.push("Did not reach the 1/4-mile mark.");
      if (st.broke === "driveline" && st.dtMsg) reasons.unshift(`${st.dtMsg} at ${Math.round(st.x)} m — the ${drivetrain(v.dtId).n} drivetrain is rated for ${Math.round(v.dtCap)} N·m and the engine put ${Math.round(st.dtO * v.dtCap)} through it. The engine is fine. Fit a stronger drivetrain, or use less torque off the line.`);
      else if (st.broke === "driveline") reasons.unshift(`The driveline let go at ${Math.round(st.x)} m — it is rated for ${Math.round(v.dlCap)} N·m and the engine put more than that through it. The engine is fine. A stronger gearbox and axle (Build → Swap), or less torque.`);
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
        broke: st.broke, dtMsg: st.dtMsg || undefined, liftMax: +st.liftMax.toFixed(2), wheelieT: +st.wheelieT.toFixed(2),
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
  function dragDriver(seed, res, veh) {
    const r = pullRng(((seed >>> 0) ^ 0x2D5A9E37) >>> 0);
    const gs = () => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307 * r()); };
    const v = Object.assign({ tyre: "street", gears: 4, first: 2.9, top: 1.0, final: 3.7, redline: 7000, auto: true, tyreDia: 27, transBrake: "none" }, veh || {});
    const hot = v.tyre === "radial" || v.tyre === "slick", ll = v.transBrake === "line_lock", red = v.redline;
    const rt = clamp(0.032 + 0.006 * gs(), 0.02, 0.045);
    const plan = { wait: 0.3 + 0.4 * r(), burn: hot ? (ll ? 3.3 : 3.85) + 0.1 * r() : 0.9 + 0.2 * r(), settle: 0.5 + 0.5 * r(), purgeAt: 0.25 + 0.3 * r(), purge: 0.7 + 0.1 * r(),
      beat: 0.6 + 0.6 * r(), hold: 1.0 + 0.4 * r(), rt: +rt.toFixed(4), shift: [], ideal: [] };
    // shift points: find where the next gear's wheel torque (after the drop) matches this one's, then go 40% of the way from
    // there to the top: the shift itself costs drive, so the quickest pass shifts later than the crossover. The top is the
    // redline (since 1.76.103.0; it used to be just short of the limiter, 2% over it): the driver never asks for a shift
    // above the line on the tach. Never crossing: shift at the redline.
    const n = Math.max(1, v.gears | 0), rat = gearRatios(v), top = Math.round(red);
    const rp = res && res.rpms, tq = res && res.torque, N = rp ? rp.length : 0;
    const T = x => { if (!N) return 1; if (x <= rp[0]) return tq[0]; if (x >= rp[N - 1]) return tq[N - 1]; let i = 1; while (rp[i] < x) i++; return tq[i - 1] + (x - rp[i - 1]) / (rp[i] - rp[i - 1]) * (tq[i] - tq[i - 1]); };
    for (let i = 0; i < n - 1; i++) {
      const k = rat[i + 1] / rat[i]; let s = top;
      for (let x = Math.round(0.55 * red); x <= top; x += 25) if (T(x) * rat[i] <= T(x * k) * rat[i + 1]) { s = x; break; }
      const x = Math.round(s + 0.4 * (top - s));
      plan.ideal.push(x); plan.shift.push(x);
    }
    let t = 0, offAt = null, rolledT = null, readyT = null, purged = false, lastRpm = 0;
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
        const tgt = plan.shift[st.gear - 1], rise = Math.max(0, st.rpm - (lastRpm || st.rpm)); lastRpm = st.rpm;
        if (st.rpm + rise < tgt) return null;   // press one tick early, so the change lands on the shift point and not past it
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

  /* =====================================================================
     TRUCK PULLING, THE HOOK ITSELF: in sim-late.js, not in the page (since 1.76.139.0).
     Here: the dirt on the night (pullTrackK), the time-stepped hook (pullRun, pullPass) and the auto driver (pullDriver).
     build.js writes this file to sim-late.js; the app fetches it once the garage is up and runs it
     inside the ENGINE_SIM closure (simLateRun in sim/tunemap.js), so it sees every physics name as
     if it were still in the page. sim/pull.js keeps the classes, tyres, gears, tyre pressure, the track names and the runaway odds.
     ===================================================================== */
  /* the dirt on the night: moisture 0 (dust) … 1 (mud), cut 0 (fresh prep) … 1 (chewed up). A wet track bites harder at
     less slip but drags at the tyres and the pan; a dry one is slick and wants more wheel speed; ruts take the grip away
     at the heavy end, where the box is up on the pan. No track (practice) is neutral: every factor exactly 1 / 0. */
  function pullTrackK(t) {
    if (!t) return { mu: 1, sp: 0, crr: 1, sled: 1, cut: 0, dig: 1 };
    const m = clamp(+t.moist, 0, 1) - 0.5, c = clamp(+t.cut || 0, 0, 1);
    return { mu: 1 + 0.17 * m, sp: -0.09 * m, crr: 1 + 1.2 * m, sled: 1 + 0.10 * m, cut: c, dig: 1 + c };
  }
  /* veh: { cls, mass (kg, without ballast), ballast (kg on the front weight bracket), wb (m), cgH (m), front (static share on
     the front axle), hitch (inches above the dirt), tyre, tyreDia (in), gear (index into the class gear ladder) or mph,
     trans "conv"|"clutch", drive "4x4"|"rwd", redline, idle, sled {base, box, mu, travel}, sledK (heavier sled for a
     pull-off), seed, noFail, track {moist, cut} (none = neutral practice dirt), runaway {p, at?, win?} (diesel only) }.
     kill() is the kill switch: fuel and air off, the truck rolls to a stop on the sled. step(dt, throttle) takes the driver's foot 0..1; the pedal itself moves at a human rate. */
  function pullRun(res, veh) {
    const C0 = PULL_CLASSES[veh && veh.cls] || PULL_CLASSES.street, CV = C0.veh;
    const v = Object.assign({ cls: C0.id, mass: CV.mass, ballast: 0, wb: CV.wb, cgH: CV.cgH, front: CV.front, hitch: CV.hitchMax - 2, tyre: CV.tyres[0], tyreDia: CV.tyreDia, gear: 1, trans: "conv", drive: CV.drive, kind: CV.kind,
      redline: 3200, idle: 750, sled: C0.sled, sledK: 1, seed: 1, noFail: false, flyK: CV.flyK, ballPos: 0, thrMax: 1 }, veh || {});
    const PS = pullPsi(v.kind), psi = v.psi != null && isFinite(+v.psi) ? clamp(+v.psi, PS.min, PS.max) : PS.def, soft = (PS.def - psi) / PS.def;   // >0 aired down
    const thrMax = clamp(+v.thrMax || 1, 0.4, 1);   // the throttle stop: a screw on the pump or the linkage, the pedal can't go past it
    const rpms = res.rpms, tq = res.torque, N = rpms.length, rng = pullRng(v.seed);
    const interp = (arr, r) => { if (r <= rpms[0]) return arr[0]; if (r >= rpms[N - 1]) return arr[N - 1]; let i = 1; while (rpms[i] < r) i++; const f = (r - rpms[i - 1]) / (rpms[i] - rpms[i - 1]); return arr[i - 1] + f * (arr[i] - arr[i - 1]); };
    const torqueAt = r => r <= rpms[0] ? tq[0] * Math.max(0.35, r / rpms[0]) : interp(tq, r);
    const TY = PULL_TYRES[v.tyre] || PULL_TYRES.dot, g = 9.81, rw = v.tyreDia * 0.0254 / 2;
    const TK = pullTrackK(v.track), SP = TY.sp + TK.sp;   // the night's dirt; neutral when there is no track
    const gears = C0.gears || (v.kind === "tractor" ? PULL_TRACTOR_GEARS : PULL_TRUCK_GEARS);
    const mph = v.mph || (gears[clamp(Math.round(v.gear), 0, gears.length - 1)] || gears[1])[1];
    const G = (v.redline * 2 * Math.PI / 60) / (mph * 0.44704 / rw);          // overall ratio, engine : wheel
    const conv = v.trans !== "clutch", etaL = Math.min(0.99, (conv ? 0.91 : 0.95) * dtEtaK(v.dtId));   // the drivetrain tier (sim/drag.js) wastes a little less of the engine
    const VdL = Math.max(0.5, (res.VdEq || res.Vd || 2000) / 1000);
    const Ie = (0.12 + 0.07 * VdL) * (v.flyK || 1), Iw = (v.kind === "tractor" ? 2 * 260 : 4 * 32) * rw * rw * 0.6;   // flywheel + crank; tyres and rims
    // ballast on the front bracket hangs ~0.75 m ahead of the front axle; ballPos slides it back, to over the rear axle at 1
    const m = v.mass + v.ballast, crr = 0.03 * TK.crr, ballX = 0.75 - clamp(+v.ballPos || 0, 0, 1) * (0.75 + v.wb);
    const hh = v.hitch * 0.0254;
    const Nf0 = (v.mass * g * v.front * v.wb + v.ballast * g * (v.wb + ballX)) / v.wb;   // static front-axle load
    const floorFull = conv ? clamp(0.5 * (res.peakTqRpm || v.redline * 0.55) + 0.25 * v.redline, v.idle + 300, v.redline * 0.8) : clamp(0.62 * v.redline, v.idle + 400, v.redline * 0.85);
    const gov = v.redline * 1.04, Tfric = 0.10 * (res.peakTq || 300);
    const SL = Object.assign({}, v.sled), sk = +v.sledK || 1;

    /* boost that has to be built: same split as the strip — atmospheric torque plus what the manifold pressure is worth now */
    const kind = res.aspKind || "na", bT = +res.boostTarget || 0;
    let trans = kind !== "na" && bT > 0 && Array.isArray(res.naTorque) && res.naTorque.length === N && Array.isArray(res.boostCurve) && res.boostCurve.length === N;
    let gpb = null;
    if (trans) {
      gpb = new Array(N); const valid = [];
      for (let i = 0; i < N; i++) { const b = res.boostCurve[i]; if (b > Math.max(0.10, 0.15 * bT)) { gpb[i] = Math.max(0, tq[i] - res.naTorque[i]) / b; valid.push(i); } else gpb[i] = null; }
      if (!valid.length) trans = false;
      else for (let i = 0; i < N; i++) if (gpb[i] == null) { let j = valid[0]; for (const k of valid) if (Math.abs(k - i) < Math.abs(j - i)) j = k; gpb[i] = gpb[j] * Math.max(0, res.naTorque[i]) / Math.max(1, res.naTorque[j]); }
    }
    const isTurbo = trans && kind === "turbo", tqCap = Math.max.apply(null, tq) * 1.06;
    const mm = res.turboMm || 54;
    const tauBase = (0.25 + 1.0 * clamp((mm - 46) / 52, 0, 1.2)) * (res.turboUnits === 2 && !res.compound ? 0.78 : 1) * clamp(Math.pow(2.5 / VdL, 0.3), 0.55, 1.5) * (res.vgt ? 0.72 : 1);   // VGT: shut vanes spin it up faster
    const pkRpm = res.peakHpRpm || v.redline * 0.85;
    const bssAt = r => trans ? Math.max(0, interp(res.boostCurve, r)) : 0;
    function fullTq(r) {
      if (!trans) return torqueAt(r);
      const full = torqueAt(r), d = st.boost - bssAt(r), gb = interp(gpb, r);
      return d >= 0 ? Math.min(full + gb * d, Math.max(tqCap, full)) : Math.max(interp(res.naTorque, r), full + gb * d);
    }
    function boostStep(dt, r, load) {
      if (!trans) { st.boost = 0; return; }
      const tgt = Math.min(bT, bssAt(r) * Math.pow(clamp(load, 0, 1), isTurbo ? 1.5 : 1));
      let tau = 0.05;
      if (isTurbo) { tau = tgt > st.boost ? tauBase / Math.pow(clamp(r * Math.max(0.15, load) / pkRpm, 0.08, 1.3), 0.75) : 0.35; if (res.compound && tgt > st.boost) tau *= st.boost > 0.5 * bT ? 1.35 : 0.7; }
      st.boost = clamp(st.boost + (tgt - st.boost) * (1 - Math.exp(-dt / Math.max(0.03, tau))), 0, bT);
    }
    function engTq(r, thr) {
      let T = thr * fullTq(r) - (1 - thr) * Tfric * clamp(r / v.redline, 0.3, 1);
      if (r > v.redline) T = Math.min(T, thr * fullTq(v.redline) * clamp((gov - r) / (gov - v.redline), 0, 1));   // the governor pulls fuel
      if (st.raOn && !st.killed) T = fullTq(Math.min(r, v.redline)) * (1 + 0.9 * st.ra) * clamp((v.redline * (1.08 + 0.5 * st.ra) - r) / (0.05 * v.redline), 0, 1);   // running on its own oil: no governor, no pedal — it climbs as fast as the oil feeds it
      return T;
    }
    function mu(s) {
      const a = Math.abs(s);
      const base = a < SP ? Math.pow(Math.sin(Math.PI / 2 * a / SP), 0.7) : 1 - TY.fall * Math.pow((a - SP) / (1 - SP), 0.8);
      return TY.mu * TK.mu * (1 + 0.10 * soft) * base * (1 - 0.25 * st.dig * TY.dig) * Math.sign(s || 1) * (TK.cut ? 1 - 0.18 * TK.cut * clamp(st.x / SL.travel, 0, 1) : 1);
    }
    const hasEgt = Array.isArray(res.egtCurve) && res.egtCurve.length === N;
    const hasSmoke = Array.isArray(res.smokeCurve) && res.smokeCurve.length === N;
    const egtLimit = res.egtLimitC || (res.diesel ? 900 : 0);   // a diesel crown, not a turbine, is the limit on an atmospheric oil-burner

    const st = { t: 0, x: 0, v: 0, w: 0, rpm: v.idle, thr: 0, foot: 0, slip: 0, boxFrac: 0, hop: 0, hopAmp: 0, lift: 0, Nf: Nf0, Nr: m * g - Nf0, phase: "stage", full: false, done: false,
      boost: 0, egt: 430, egtPeak: 430, smoke: 0, smokeMax: 0, dig: 0, fSled: 0, fTrac: 0, maxV: 0, peakSlip: 0, stopT: 0, spinT: 0, sweetT: 0, bogT: 0, hopT: 0, frontUpT: 0, slipT: 0, egtDose: 0,
      broke: null, failKind: null, failAt: Infinity, stopWhy: null, trace: [], marks: [], markT: 0, coupled: false, Twheel: 0, sweet: [Math.max(0.05, SP - 0.08), SP + 0.08], dist: 0, distFt: 0,
      raAt: Infinity, raOn: false, ra: 0, raT: 0, raWin: 2, raX: null, killed: false, killT: null, killX: null };
    // the build's own weak point lets go part way down the track, at a seeded moment
    if (!v.noFail && res.fails && res.fails.length) { const t0 = (res.tests || []).find(x => x.name === res.fails[0]); st.failKind = t0 ? t0.id : "rod_tension"; st.failAt = 1.5 + rng() * 5; }
    const egtTrip = 1.2 + rng() * 2.2;
    // runaway draws from its own stream so every other seeded moment of the hook stays where it was
    const RA = v.runaway || null, rra = pullRng(((v.seed >>> 0) ^ 0x2545F491) >>> 0);
    if (RA && !v.noFail && res.diesel) { if (RA.at != null) st.raAt = +RA.at; else if (rra() < (+RA.p || 0)) st.raAt = 2 + rra() * 7; st.raWin = RA.win || clamp(2.4 - 1.2 * (+RA.p || 0), 1.5, 2.4); }
    // a turbo that is going to let go on a diesel goes at the oil seal first: it runs away on its own lube oil
    if (RA && !v.noFail && res.diesel && /^(compressor_map|turbine_temp)$/.test(st.failKind || "")) { st.raAt = Math.min(st.raAt, st.failAt); st.failKind = null; st.failAt = Infinity; }
    let lastTrace = -1, loadT = 0, prevTw = 0;

    function sub(dt) {
      st.foot += (clamp(st.thr, 0, 1) > st.foot ? 1 / 0.45 : -1 / 0.25) * dt;   // the pedal goes down in about half a second, comes up quicker
      st.foot = clamp(st.foot, 0, 1);
      const thr = st.killed ? 0 : st.raOn ? 1 : Math.min(st.foot, thrMax);   // killed: nothing; running away: the pedal no longer matters
      if (st.phase === "stage") {
        st.t = 0; st.rpm += (v.idle + 250 * st.foot - st.rpm) * Math.min(1, dt * 4); boostStep(dt, st.rpm, 0.05);
        if (st.thr > 0.05) st.phase = "pull";
        return;
      }
      st.t += dt;
      // engine and driveline: locked when the wheels turn the engine faster than the converter stall / slipped-clutch speed
      const floor = st.killed ? 0 : v.idle + (floorFull - v.idle) * thr;
      const wRpm = st.w * G * 60 / (2 * Math.PI);
      st.coupled = wRpm >= floor;
      let rpmE = st.coupled ? wRpm : st.rpm + (floor - st.rpm) * Math.min(1, dt / 0.25);
      boostStep(dt, rpmE, thr);
      let Te = engTq(rpmE, thr), Tw;
      if (st.coupled) Tw = Te * G * etaL;
      else { const SR = clamp(wRpm / Math.max(1, rpmE), 0, 1); const TR = conv ? 1 + 1.1 * clamp(1 - SR / 0.85, 0, 1) : 1; Tw = Math.max(0, Te) * TR * G * (conv ? 0.86 : 0.93); }
      if (v.dtCap > 0 && Tw > 0) { const Tc = v.dtCap * G * etaL; if (Tw > Tc) { if (!v.noFail && dtStress(st, Tw / Tc, dt)) st.dtMsg = dtPart(st.dtO); Tw = Tc; } }   // a drivetrain tier: the clutch slips past its rating; a big overload breaks a part
      if (st.killed) { Tw = 0; st.coupled = false; rpmE = st.rpm * Math.max(0, 1 - dt * 2.5); }   // killed: the driver is in neutral and on the brake, the engine winds down on its own
      st.rpm = rpmE;
      // sled: the box rides toward the pan as the sled travels
      st.boxFrac = Math.pow(clamp(st.x / SL.travel, 0, 1), SL.ramp || 1.15);
      const Fs = g * SL.mu * sk * (SL.base + SL.box * st.boxFrac) * (1 + 0.01 * st.v) * TK.sled;
      st.fSled = Fs;
      // axle loads: the chain pulls back at hitch height and lifts the nose; ballast on the front bracket holds it down
      const acc0 = st.acc || 0;
      let Nf = (v.mass * g * v.front * v.wb + v.ballast * g * (v.wb + ballX) - 2.2 * Fs * hh - m * acc0 * v.cgH) / v.wb;   // 2.2: the chain climbs to the sled hook and the axle winds up its springs
      // torque spikes kick the nose: the axle winds up against its springs
      const dTw = (Tw - prevTw) / Math.max(dt, 1e-4); prevTw = Tw;
      st.lift = clamp(1 - Nf / Math.max(1, Nf0), 0, 1.5);
      const hopDrive = clamp((st.lift - 0.55 + 0.25 * soft) / 0.3, 0, 1) + clamp(dTw / (G * (res.peakTq || 500) * 6), 0, 0.6) * (st.lift > 0.5 ? 1 : 0.3);
      st.hopAmp += (Math.min(1, hopDrive) - st.hopAmp) * Math.min(1, dt * (hopDrive > st.hopAmp ? 6 : 1.5));
      st.hop = st.hopAmp * Math.abs(Math.sin(st.t * 2 * Math.PI * (v.kind === "tractor" ? 1.6 : 2.3)));
      Nf = Math.max(0, Nf * (1 - 0.8 * st.hop));
      if (Nf <= 1) st.frontUpT += dt;
      const Nr = m * g - Nf;
      st.Nf = Nf; st.Nr = Nr;
      // the tyres: slip against the dirt
      const vw = st.w * rw, den = Math.max(Math.abs(vw), Math.abs(st.v), 1.2);
      const s = (vw - st.v) / den; st.slip = clamp(s, 0, 1);
      const grip = v.drive === "4x4" ? Nr + 0.75 * Nf : Nr;   // the fronts steer and scrub; they never pull their share
      const Ft = mu(s) * grip * (1 - 0.4 * st.hop);   // a bouncing truck is only on the dirt part of the time
      st.fTrac = Ft;
      // wheels (with the engine on them when locked) and the truck
      const I = Iw + (st.coupled ? Ie * G * G : 0);
      st.w += (Tw - Ft * rw) / I * dt; if (st.w < 0) st.w = 0;
      if (!st.coupled && st.w * G * 60 / (2 * Math.PI) > floor) st.w = Math.min(st.w, floor * 2 * Math.PI / 60 / G * 1.001);
      const Fres = crr * m * g + Fs;
      let acc = (Ft - Fres) / m;
      if (st.v <= 0 && acc < 0) acc = 0;
      st.v = Math.max(0, st.v + acc * dt); st.x += st.v * dt; st.acc = acc;
      st.maxV = Math.max(st.maxV, st.v); st.peakSlip = Math.max(st.peakSlip, st.slip);
      if (st.slip > st.sweet[1] + 0.12) st.spinT += dt; else if (st.slip >= st.sweet[0] && st.slip <= st.sweet[1]) st.sweetT += dt;
      st.slipT += dt;
      // spinning hard digs a hole under the tyre; easing off lets it climb out onto fresh dirt as the truck moves
      if (st.slip > 0.5) st.dig = Math.min(1, st.dig + dt * (st.slip - 0.5) * 0.6 * TK.dig * (1 - 0.6 * soft)); else st.dig = Math.max(0, st.dig - dt * st.v * 0.12);
      if (st.hop > 0.3) st.hopT += dt;
      // heat and smoke
      const egtT = (hasEgt ? interp(res.egtCurve, st.rpm) : 800) * (0.5 + 0.5 * thr) + 40 * thr * clamp(st.t / 12, 0, 1);
      st.egt += (egtT - st.egt) * (1 - Math.exp(-dt / 4.5)); st.egtPeak = Math.max(st.egtPeak, st.egt);
      if (egtLimit && st.egt > egtLimit) st.egtDose += dt * (st.egt - egtLimit) / 60;
      st.smoke = hasSmoke ? clamp(interp(res.smokeCurve, st.rpm) * thr * (trans ? 1 + 0.6 * clamp(1 - st.boost / Math.max(0.1, bT), 0, 1) : 1), 0, 1) : 0;
      st.smokeMax = Math.max(st.smokeMax, st.smoke);
      if (thr > 0.6) loadT += dt;
      if (st.rpm < floorFull * 0.95 && thr > 0.8 && st.v < 0.6 && st.t > 1) st.bogT += dt;
      // runaway: it starts with the pull loaded; from then the driver has a couple of seconds to find the kill switch
      if (!st.raOn && !st.killed && loadT >= st.raAt) { st.raOn = true; st.raX = st.x; }
      if (st.raOn && !st.killed) { st.raT += dt; st.ra = clamp(st.raT / st.raWin, 0, 1); if (st.raT >= st.raWin && !st.broke) { st.broke = "runaway"; st.failKind = "runaway"; st.stopWhy = "broke"; } }
      // something lets go
      if (!v.noFail && !st.broke) {
        if (st.failKind && loadT >= st.failAt) st.broke = st.failKind;
        else if (st.dtMsg) st.broke = "driveline";
        else if (v.wornAt && loadT >= v.wornAt) st.broke = "worn";   // past its pass budget: something tired gives up
        else if (st.egtDose > egtTrip) st.broke = isTurbo && (res.egtLimitC || 0) <= st.egt ? "turbo" : "piston";
        if (st.broke) { st.failKind = st.broke; st.stopWhy = "broke"; }
      }
      if (st.t - lastTrace >= 0.1) { lastTrace = st.t; st.trace.push({ t: +st.t.toFixed(1), x: +st.x.toFixed(2), v: +st.v.toFixed(2), rpm: Math.round(st.rpm), slip: +st.slip.toFixed(3), boxFrac: +st.boxFrac.toFixed(3), throttle: +thr.toFixed(2), egt: Math.round(st.egt), boost: +(st.boost || 0).toFixed(2), hop: +st.hop.toFixed(2) }); if (st.raOn) st.trace[st.trace.length - 1].ra = +st.ra.toFixed(2); }
      st.thrNow = thr;
      if (st.x >= PULL_FULL) { st.x = PULL_FULL; st.full = true; st.stopWhy = "full"; finish(); return; }
      if (st.broke) { finish(); return; }
      if (st.killed && st.v < 0.05 && st.t - st.killT > 0.3) { st.stopWhy = "killed"; finish(); return; }
      // the flagman calls it when forward motion stops: under half a metre in three seconds
      if (st.t - st.markT >= 0.5) { st.marks.push(st.x); st.markT = st.t; if (st.marks.length > 7) st.marks.shift(); }
      if (!(st.raOn && !st.killed) && ((st.v < 0.05 && st.t > 1.5 && (st.stopT += dt) > 1.2) || (st.t > 4 && st.marks.length >= 7 && st.x - st.marks[0] < 0.5))) { st.stopWhy = st.slip > 0.4 ? "spun" : thr < 0.2 ? "lifted" : "bogged"; finish(); return; }   // a runaway is not the flagman's to stop
      if (st.v >= 0.05) st.stopT = 0;
      if (st.t > 90) { st.stopWhy = "time"; finish(); }
    }
    function finish() { st.done = true; st.phase = "done"; st.dist = st.x; st.distFt = st.x * 3.28084; }
    function kill() { if (st.done || st.killed || st.phase === "stage") return false; st.killed = true; st.killT = st.t; st.killX = st.x; st.killRpm = Math.round(st.rpm); return true; }
    function step(dt, throttle) { if (throttle != null) st.thr = clamp(+throttle || 0, 0, 1); dt = Math.min(0.25, Math.max(0, dt)); while (dt > 1e-9 && !st.done) { const h = Math.min(0.001, dt); dt -= h; sub(h); } st.distFt = st.x * 3.28084; return st; }
    function result() {
      const ft = Math.round(st.x * 3.28084 * 10) / 10, reasons = [];
      const sw = st.sweet, tn = TY.n.toLowerCase();
      if (st.broke) reasons.push(st.broke === "runaway" ? `It ran away on its own oil ${Math.round(st.raX * 3.28084)} ft out and nobody pulled the kill switch: ${st.raWin.toFixed(1)} s later it went past ${Math.round(st.rpm).toLocaleString()} rpm and came apart. Disqualified.` : st.broke === "turbo" ? `The turbine inlet sat at ${Math.round(st.egtPeak)} °C — past what the hot side takes for that long. It let go under the sled.` : st.broke === "piston" ? `Exhaust held ${Math.round(st.egtPeak)} °C for seconds on end — a diesel crown can't shed that. A piston melted. Less fuel, more air (bigger turbo, intercooler), or shorter bursts.` : st.broke === "driveline" ? `${st.dtMsg} ${Math.round(ft)} ft down the track — the ${drivetrain(v.dtId).n} drivetrain is rated for ${Math.round(v.dtCap)} N·m and the sled asked for ${Math.round(st.dtO * v.dtCap)}. The engine is fine. Fit a stronger drivetrain, or feather the pedal.` : st.broke === "worn" ? `Something tired let go ${Math.round(ft)} ft down the track — the build was past its pass budget. Freshen it before the next hook.` : `The engine let go under load ${Math.round(ft)} ft down the track — the dyno sheet already said it was past a limit.`);
      if (st.full) reasons.push("Full pull — the box was still moving at 300 ft.");
      if (st.killed && st.raOn) reasons.push(`Ran away ${Math.round(st.raX * 3.28084)} ft out — killed it ${st.raT.toFixed(1)} s later at ${st.killRpm.toLocaleString()} rpm. Good kill: the engine lives. Scored where it stopped.`);
      else if (st.killed) reasons.push(`Killed it at ${Math.round(st.killX * 3.28084)} ft — scored where it stopped.`);
      if (v.track) reasons.push(`Track: ${pullTrackName(v.track)} (moisture ${Math.round(v.track.moist * 100)}%, cut ${Math.round((v.track.cut || 0) * 100)}%).`);
      if (st.spinT > 1.5) reasons.push(`Spun the tyres for ${st.spinT.toFixed(1)} s past ${Math.round(100 * (sw[1] + 0.12))}% slip — ${tn}s dig instead of bite. Feather the pedal to hold ${Math.round(sw[0] * 100)}–${Math.round(sw[1] * 100)}% slip, or a taller gear.`);
      if (st.dig > 0.5) reasons.push("Dug in — the hole under the tyres cost grip for the rest of the pull.");
      if (st.hopT > 1) reasons.push(`Hopped for ${st.hopT.toFixed(1)} s — the ${v.hitch}" hitch lifts the front faster than ${Math.round(v.ballast)} kg of ${v.ballPos > 0.5 ? "ballast set back" : "front weight"} holds it. Lower the hitch${v.ballPos > 0.2 ? ", move the weight forward" : " or hang more weight on the bracket"}${soft > 0.15 ? `, or air the tyres up from ${psi} psi: a soft sidewall winds up and bounces` : ""}.`);
      else if (st.frontUpT > 0.8) reasons.push(`Front wheels off the dirt for ${st.frontUpT.toFixed(1)} s — the chain is lifting the nose. More front ballast.`);
      if (!st.full && !st.broke && st.stopWhy === "bogged") reasons.push(`Bogged to a stop at ${Math.round(st.rpm).toLocaleString()} rpm with the pedal down — the sled outweighed the engine. ${st.slip < 0.1 ? "The tyres still had grip: more torque, a lower gear, or a converter for the multiplication." : ""}`);
      if (!st.full && st.stopWhy === "spun") reasons.push("Stopped with the tyres still turning — out of traction. More weight on the driven tyres, a hitch that plants them harder, or a bitier tyre.");
      if (!st.full && st.stopWhy === "lifted") reasons.push("Lifted with the truck nearly stopped — the sled won. Keep some pedal in to the end.");
      if (st.sweetT > 4 && !st.full) reasons.push(`${st.sweetT.toFixed(1)} s in the slip sweet spot — the tyres were working.`);
      if (isTurbo && trans && st.maxV > 0) { const lag = st.trace.findIndex(p => p.t > 0); if (lag >= 0 && st.boost < 0.6 * bT && !st.broke) reasons.push(`Only ${st.boost.toFixed(1)} of ${bT.toFixed(1)} bar at the stop — the turbo was falling off with the rpm.`); }
      if (thrMax < 1 && st.bogT > 1.5 && !st.full && !st.broke) reasons.push(`The throttle stop held it to ${Math.round(thrMax * 100)}% while it bogged — open the stop up if the tyres had grip to spare.`);
      if (st.smokeMax > 0.7) reasons.push("Black smoke all the way — more fuel than air. It looks the part; it is also heat in the pistons.");
      return { distM: +st.x.toFixed(2), distFt: ft, full: st.full, maxMph: +(st.maxV * 2.23694).toFixed(1), peakSlip: +st.peakSlip.toFixed(3), peakEgt: Math.round(st.egtPeak), broke: st.broke, failKind: st.broke ? st.failKind : null,
        trace: st.trace, smokeMax: +st.smokeMax.toFixed(2), time: +st.t.toFixed(1), stopWhy: st.stopWhy, spinT: +st.spinT.toFixed(1), sweetT: +st.sweetT.toFixed(1), hopT: +st.hopT.toFixed(1), frontUpT: +st.frontUpT.toFixed(1), dig: +st.dig.toFixed(2),
        boxFrac: +st.boxFrac.toFixed(3), psi: psi, thrMax: thrMax, endRpm: Math.round(st.rpm), ratio: +G.toFixed(1), mphGear: mph, sweet: sw, reasons: reasons, cls: v.cls, dtMsg: st.dtMsg || undefined, veh: v, tyre: TY.n, sledK: sk,
        runaway: st.raOn ? { ftAt: Math.round(st.raX * 3.28084 * 10) / 10, killed: st.killed, react: st.killed ? +st.raT.toFixed(2) : null, win: +st.raWin.toFixed(2), grenade: st.broke === "runaway" } : null, killed: st.killed, track: v.track || null };
    }
    return { st: st, step: step, result: result, kill: kill, ratio: G, sweet: st.sweet, full: PULL_FULL };
  }
  /* A pull with nobody's foot on it: the rival field's pull-off and the node harness. foot "flat" stays pinned;
     "feather" lifts whenever the slip runs past the top of the sweet spot, like a good driver. */
  function pullPass(res, veh, foot) {
    const p = pullRun(res, veh); let thr = 1;
    if (foot === "auto") { const d = pullDriver(veh && veh.seed); while (!p.st.done) { if (d.kill(p.st)) p.kill(); p.step(0.02, d.foot(p.st)); } return p.result(); }
    while (!p.st.done) { if (foot === "feather") { const s = p.st.slip, sw = p.st.sweet; thr = s > sw[1] + 0.04 ? Math.max(0, thr - 0.08) : s < sw[1] ? Math.min(1, thr + 0.05) : thr; } p.step(0.02, thr); }
    return p.result();
  }
  /* The auto driver: a steady foot read every 20 ms. It feeds the pedal in off the line, aims the slip into the middle of the
     sweet spot where the grip peaks, backs off hard past the band, eases a hopping nose, and never lifts below about 60%
     (a lift stops the truck). On a runaway it hits the kill switch in 0.6-0.8 s and never fumbles it: safe in any window,
     and late enough to keep the feet the runaway drags out. skill 0..1 (default 1, the player's auto driver) blurs it: at
     0 it is the old human foot, aiming low in the band, correcting lazily, lifting further, 0.6-1.0 s to the switch and now
     and then a fumble that a short window does not forgive (the team-pull crew drives from there). Deterministic for a
     seed, on its own random stream so the hook's other seeded moments stay where they were. foot(st) gives 0..1, kill(st)
     is true once the hand reaches the switch. */
  function pullDriver(seed, skill) {
    const r = pullRng(((seed >>> 0) ^ 0x5BD1E995) >>> 0), k = clamp(skill == null ? 1 : +skill, 0, 1), L = (a, b) => a + (b - a) * k;
    const aim = L(0.10 + 0.12 * r(), 0.45), gain = L(0.9 + 0.2 * r(), 2), q = r(), react = L(0.6 + 0.4 * q, 0.6 + 0.2 * q), fu = r(), fuAdd = 0.5 + 0.9 * r();
    const floor0 = L(0.4, 0.6), floor1 = L(0.3, 0.6);
    let thr = 0, reach = null;
    function foot(st) {
      if (st.done || st.raOn || st.killed) return 0;   // running away the pedal does nothing: the foot comes off while the hand finds the switch
      if (st.phase === "stage") { thr = 0.55; return thr; }
      const s = st.slip, sw = st.sweet, tgt = sw[0] + aim * (sw[1] - sw[0]);
      if (s > sw[1] + 0.03) thr -= (0.05 + 0.5 * (s - sw[1])) * gain;        // spinning: off it, harder the further past
      else if (s > tgt && st.v > 0.4) thr -= 0.012 * gain;                     // in the band, above the aim: a touch less (unless it is bogging: then lean in)
      else thr += (st.t < 1.2 ? 0.035 : 0.025) * gain;                         // grip to spare: lean in
      if (st.hop > 0.3 || st.lift > 0.95) thr -= 0.03;                         // the nose is coming up
      thr = clamp(thr, st.t > 1 ? floor1 : floor0, 1);                         // never all the way off: a lift stops the truck
      return thr;
    }
    function kill(st) {
      if (!st.raOn || st.killed || st.done) return false;
      if (reach == null) reach = react + (fu < (1 - k) * (0.06 + 0.24 * clamp((2.1 - st.raWin) / 0.6, 0, 1)) ? fuAdd : 0);   // a fumble: the hand misses the switch the first time
      return st.raT >= reach;
    }
    return { foot: foot, kill: kill, react: () => reach };
  }


  /* =====================================================================
     MUD BOG, THE RUN ITSELF: in sim-late.js, not in the page (since 1.76.139.0).
     Here: the time-stepped run through the pit (bogRun, bogPass), bogPrep and the AI trucks (bogAiRes).
     build.js writes this file to sim-late.js; the app fetches it once the garage is up and runs it
     inside the ENGINE_SIM closure (simLateRun in sim/tunemap.js), so it sees every physics name as
     if it were still in the page. sim/bog.js keeps the classes, tyres, gears, the night's mud (bogNight, bogDepth, bogMudName).
     ===================================================================== */
  /* veh: { cls, gear (index into the class ladder), tyre, redline, idle, seed, noFail, night (bogNight), wornAt?, skill? (AI driver 0..1) }.
     step(dt, throttle) takes the driver's foot 0..1; auto() is the auto driver's foot for this moment. */
  function bogRun(res, veh) {
    const C0 = BOG_CLASSES[veh && veh.cls] || BOG_CLASSES.street, CV = C0.veh;
    const v = Object.assign({ cls: C0.id, gear: 1, tyre: CV.tyres[CV.tyres.length - 1], redline: 3200, idle: 750, seed: 1, noFail: false, night: null }, veh || {});
    const N0 = v.night || bogNight(v.seed), L = N0.len, cons = N0.cons, pitK = CV.pitK || 1;   // the bigger classes dig their pit deeper
    const rpms = res.rpms, tq = res.torque, NR = rpms.length, rng = pullRng(v.seed);
    const interp = (arr, r) => { if (r <= rpms[0]) return arr[0]; if (r >= rpms[NR - 1]) return arr[NR - 1]; let i = 1; while (rpms[i] < r) i++; const f = (r - rpms[i - 1]) / (rpms[i] - rpms[i - 1]); return arr[i - 1] + f * (arr[i] - arr[i - 1]); };
    const torqueAt = r => r <= rpms[0] ? tq[0] * Math.max(0.3, r / rpms[0]) : interp(tq, r);
    const TY = BOG_TYRES[v.tyre] || BOG_TYRES.mt, g = 9.81, rw = CV.tyreDia * 0.0254 / 2, G0 = C0.gears;
    const gi = clamp(Math.round(+v.gear || 0), 0, G0.length - 1), mph = G0[gi][1];
    const G = (v.redline * 2 * Math.PI / 60) / (mph * 0.44704 / rw);
    const conv = CV.trans !== "clutch", eta = conv ? 0.88 : 0.93;
    const VdL = Math.max(0.5, (res.VdEq || res.Vd || 2000) / 1000);
    const Ie = 0.12 + 0.07 * VdL, Iw = 4 * (18 + 30 * rw) * rw * rw * 0.6;
    const m0 = CV.mass + 230 * Math.min(1.6, VdL / 5);   // the engine's own weight moves the truck a little
    const pkTqR = res.peakTqRpm || v.redline * 0.55;
    const floorFull = conv ? clamp(0.45 * pkTqR + 0.22 * v.redline, v.idle + 350, v.redline * 0.75) : clamp(0.5 * v.redline, v.idle + 500, v.redline * 0.8);
    const bogHi = clamp(Math.max(v.idle + 450, 0.55 * pkTqR), v.idle + 300, v.redline * 0.7), stallR = v.idle * 0.62;
    const lim = v.redline * 1.03, Tfric = 0.10 * (res.peakTq || 300);
    const kind = res.aspKind || "na", bT = +res.boostTarget || 0;
    let trans = kind !== "na" && bT > 0 && Array.isArray(res.naTorque) && res.naTorque.length === NR && Array.isArray(res.boostCurve) && res.boostCurve.length === NR;
    let gpb = null;
    if (trans) { gpb = new Array(NR); const valid = [];
      for (let i = 0; i < NR; i++) { const b = res.boostCurve[i]; if (b > Math.max(0.10, 0.15 * bT)) { gpb[i] = Math.max(0, tq[i] - res.naTorque[i]) / b; valid.push(i); } else gpb[i] = null; }
      if (!valid.length) trans = false;
      else for (let i = 0; i < NR; i++) if (gpb[i] == null) { let j = valid[0]; for (const k of valid) if (Math.abs(k - i) < Math.abs(j - i)) j = k; gpb[i] = gpb[j] * Math.max(0, res.naTorque[i]) / Math.max(1, res.naTorque[j]); } }
    const isTurbo = trans && kind === "turbo", tqCap = Math.max.apply(null, tq) * 1.06, mmT = res.turboMm || 54;
    const tauBase = (0.25 + 1.0 * clamp((mmT - 46) / 52, 0, 1.2)) * (res.turboUnits === 2 && !res.compound ? 0.78 : 1) * clamp(Math.pow(2.5 / VdL, 0.3), 0.55, 1.5) * (res.vgt ? 0.72 : 1);
    const pkRpm = res.peakHpRpm || v.redline * 0.85, bssAt = r => trans ? Math.max(0, interp(res.boostCurve, r)) : 0;
    function fullTq(r) { if (!trans) return torqueAt(r); const full = torqueAt(r), d = st.boost - bssAt(r), gb = interp(gpb, r);
      return d >= 0 ? Math.min(full + gb * d, Math.max(tqCap, full)) : Math.max(interp(res.naTorque, r), full + gb * d); }
    function boostStep(dt, r, load) { if (!trans) { st.boost = 0; return; }
      const tgt = Math.min(bT, bssAt(r) * Math.pow(clamp(load, 0, 1), isTurbo ? 1.5 : 1)); let tau = 0.05;
      if (isTurbo) { tau = tgt > st.boost ? tauBase / Math.pow(clamp(r * Math.max(0.15, load) / pkRpm, 0.08, 1.3), 0.75) : 0.35; if (res.compound && tgt > st.boost) tau *= st.boost > 0.5 * bT ? 1.35 : 0.7; }
      st.boost = clamp(st.boost + (tgt - st.boost) * (1 - Math.exp(-dt / Math.max(0.03, tau))), 0, bT); }
    // lugging: under the band the engine can't hold its torque — it falls away, and keeps falling as the rpm does
    const lug = r => r >= bogHi ? 1 : clamp(0.5 + 0.5 * (r - stallR) / Math.max(1, bogHi - stallR), 0.25, 1);
    function engTq(r, thr) { let T = thr * fullTq(r) * lug(r) - (1 - thr) * Tfric * clamp(r / v.redline, 0.3, 1);
      if (r > v.redline) T = Math.min(T, thr * fullTq(v.redline) * clamp((lim - r) / (lim - v.redline), 0, 1)); return T; }
    function muS(s, mu0, sp, fall) { const a = Math.abs(s); return Math.sign(s || 1) * mu0 * (a < sp ? Math.pow(Math.sin(Math.PI / 2 * a / sp), 0.7) : 1 - fall * Math.pow(clamp((a - sp) / (1 - sp), 0, 1), 0.8)); }
    const hasEgt = Array.isArray(res.egtCurve) && res.egtCurve.length === NR;
    const egtLimit = res.egtLimitC || (res.diesel ? 900 : 960);
    const tU = id => { const t = (res.tests || []).find(x => x.id === id); return t ? t.util : 0; };
    const kW = Math.max(60, Math.min(res.peakHp || 250, C0.field.hp * 1.4) * 0.7457), Cth = (7 + 2.6 * VdL) * 1000, UA = kW * 1000 * 0.5 / 62;   // the truck's radiator holds full power at full airflow, but only as big as the class carries (about 1.4× the field): a big swap runs hot
    const hFrac = res.diesel ? 0.42 : 0.52;
    const sw = [Math.max(0.05, TY.sp - 0.06), TY.sp + 0.1], digS = TY.sp + 0.28 + 0.1 * TY.paddle;
    const st = { t: 0, tPit: null, tOut: null, x: -CV.runup, v: 0, w: 0, rpm: v.idle, thr: 0, foot: 0, slip: 0, phase: "stage", done: false, cleared: false,
      boost: 0, egt: 420, egtPeak: 420, egtDose: 0, cool: 88 + 9 * clamp(tU("cooling"), 0, 1.2), coolPeak: 0, hotT: 0, radPack: 0, pack: 0, dig: 0, sink: 0, depth: 0, mudKg: 0,
      y: 0, vy: 0, air: false, airT: 0, belly: 0, hz: -1, hzHit: [], slaps: 0, slapK: 0, bogT: 0, spinT: 0, sweetT: 0, packT: 0, stuckT: 0, limT: 0, maxV: 0, entryV: null, peakSlip: 0,
      broke: null, failKind: null, failAt: Infinity, stopWhy: null, stalled: false, trace: [], Ft: 0, Fd: 0, ai: 0.6, coupled: false, sweet: sw, bogBand: [Math.round(stallR), Math.round(bogHi)] };
    st.coolPeak = st.cool;
    if (!v.noFail && res.fails && res.fails.length) { const t0 = (res.tests || []).find(x => x.name === res.fails[0]); st.failKind = t0 ? t0.id : "rod_tension"; st.failAt = 1.2 + rng() * 4.5; }
    const egtTrip = 1.0 + rng() * 2.0;
    const kLine = 0.95 + 0.1 * pullRng(((v.seed >>> 0) ^ 0x51F0B3) >>> 0)();   // the line it takes: no two runs find quite the same mud
    let lastTrace = -1, loadT = 0, launchT = 0;
    function hazAt(x) { for (let i = 0; i < N0.hz.length; i++) { const h = N0.hz[i]; if (Math.abs(x - h.x) < h.w / 2) return i; } return -1; }
    function sub(dt) {
      st.foot += (clamp(st.thr, 0, 1) > st.foot ? 1 / 0.3 : -1 / 0.2) * dt; st.foot = clamp(st.foot, 0, 1);
      const thr = st.stalled ? 0 : st.foot;
      if (st.phase === "stage") { st.t = 0; st.rpm += (v.idle + 300 * st.foot - st.rpm) * Math.min(1, dt * 4); boostStep(dt, st.rpm, 0.05); if (st.thr > 0.05) st.phase = "runup"; return; }
      st.t += dt; launchT += dt;
      const inPit = st.x >= 0 && st.x < L;
      if (st.x >= 0 && st.phase === "runup") { st.phase = "pit"; st.tPit = st.t; st.entryV = st.v; st.slapK = 1 + st.v / 6; }
      // the mud under the truck: depth, a hidden rut or a ridge
      const hi = inPit ? hazAt(st.x) : -1, H = hi >= 0 ? N0.hz[hi] : null;
      let D = inPit ? bogDepth(N0, st.x) * pitK : 0; if (H && H.kind === "rut") D += H.h;
      st.depth = D;
      if (hi >= 0 && st.hzHit.indexOf(hi) < 0) { st.hzHit.push(hi); st.hz = hi;
        if (H.kind === "bump") { if (st.v > 2.5) { st.vy = Math.max(st.vy, H.h * st.v * 0.75); st.slapK = Math.max(st.slapK, 0.6); } }
        else { st.vy -= Math.min(1.2, 0.08 * st.v); st.slapK = Math.max(st.slapK, 0.5 + st.v / 10); } }
      // sink: soupy mud lets the tyres down to the floor, sticky holds them up but grabs; a dug hole sinks them further
      const tgtSink = inPit ? D * (0.5 + 0.38 * (1 - cons)) * (1 - 0.3 * clamp(st.v / 16, 0, 1)) + st.dig * 0.32 * rw : 0;   // speed keeps it up on top
      st.sink += (tgtSink - st.sink) * Math.min(1, dt * (tgtSink > st.sink ? 7 : 3));
      const sr = clamp(st.sink / rw, 0, 1.6);
      // up and down: ridges throw it, landings slap
      st.vy -= g * dt; st.y += st.vy * dt;
      if (st.y <= 0) { if (st.vy < -1.4) { st.slapK = Math.max(st.slapK, Math.min(1.5, -st.vy / 3)); st.slaps++; } st.y = 0; st.vy = st.vy < -0.5 ? -st.vy * 0.22 : 0; }
      st.air = st.y > 0.04; if (st.air) st.airT += dt;
      // the belly: the frame sits down on firm ground — the crown between ruts, a ridge at walking pace, the lip of a hole it dug —
      // and carries the truck's weight off the tyres. Deep mud alone only drags at it (the bow wave below).
      const gap = CV.clear - (H && H.kind === "rut" ? H.h * 0.9 : 0) - (H && H.kind === "bump" && st.v < 3 ? H.h * 1.5 : 0) - st.dig * 0.42 * rw;
      st.belly = inPit ? clamp(-gap / 0.12, 0, 0.9) : 0;
      st.wade = inPit ? clamp((st.sink - CV.clear) / 0.3, 0, 1) : 0;
      // engine and driveline: a converter slips up to its stall speed; a clutch truck slips the clutch off the line, then it's locked
      const m = m0 + st.mudKg, W = m * g;
      const wRpm = st.w * G * 60 / (2 * Math.PI);
      if (!conv && !st.locked && wRpm >= Math.max(v.idle + 600, 0.38 * v.redline)) st.locked = true;   // the driver slips the clutch until the wheels catch up, then it's in for the run
      let floor = conv ? v.idle + (floorFull - v.idle) * thr : (!st.locked ? v.idle + (floorFull - v.idle) * Math.max(thr, 0.3) : 0);
      if (st.stalled) floor = 0;
      st.coupled = wRpm >= floor;
      let rpmE = st.coupled ? wRpm : st.rpm + (floor - st.rpm) * Math.min(1, dt / 0.2);
      boostStep(dt, rpmE, thr);
      let Te = st.stalled ? 0 : engTq(rpmE, thr), Tw;
      if (st.coupled) Tw = Te * G * eta;
      else { const SR = clamp(wRpm / Math.max(1, rpmE), 0, 1), TR = conv ? 1 + 1.0 * clamp(1 - SR / 0.85, 0, 1) : 1; Tw = Math.max(0, Te) * TR * G * (conv ? 0.84 : 0.92); }
      st.rpm = rpmE;
      if (!conv && st.coupled && !st.stalled && st.rpm < stallR && st.t > 1) { st.stalled = true; }
      if (st.rpm > v.redline * 1.005) st.limT += dt;
      // the tyres: bite against slip, a paddle's push, lugs packing and cleaning, a hole when it spins too much
      const vw = st.w * rw, den = Math.max(Math.abs(vw), Math.abs(st.v), 1.0), s = (vw - st.v) / den;
      st.slip = clamp(s, 0, 1);
      const Nn = st.air ? 0 : W * (1 - st.belly) * (1 + clamp(-st.vy, 0, 2) * 0.15), grip = Nn * ((1 - CV.front) + CV.front * CV.drive);
      let Ft, Fp = 0;
      if (inPit) {
        const kc = (0.84 + 0.3 * cons) * clamp(1.15 - 0.25 * sr, 0.7, 1.1);
        const muM = muS(s, TY.mu * kc, TY.sp, TY.fall) * (1 - 0.55 * st.pack) * (1 - 0.32 * st.dig * TY.dig);
        const slipV = Math.max(0, vw - st.v);
        Fp = TY.paddle * 170 * (CV.width / 2) * clamp(sr, 0.15, 1.1) * Math.pow(slipV, 1.55) * (st.air ? 0 : 1) * (1 - 0.4 * st.pack);
        Fp = Math.min(Fp, grip * 0.9);
        Ft = (muM * grip + Fp) * kLine;
      } else Ft = muS(s, 0.78, 0.13, 0.3) * grip;
      st.Ft = Ft;
      // churning: mud on the tyre resists it turning, more the deeper and stickier
      const Fch = inPit ? 130 * sr * (0.5 + cons) * Math.min(25, Math.abs(vw)) * (CV.width / 2) : 0;
      const I = Iw + (st.coupled && !st.stalled ? Ie * G * G : 0);
      st.w += (Tw - (Ft + Fch) * rw) / I * dt; if (st.w < 0) st.w = 0;
      if (!st.coupled && st.w * G * 60 / (2 * Math.PI) > floor) st.w = Math.min(st.w, floor * 2 * Math.PI / 60 / G * 1.001);
      if (st.stalled) st.w = Math.min(st.w, st.v / rw);
      // drag: rolling in mud, the bow wave, the belly
      const crr = inPit ? 0.06 + 0.42 * sr * (0.5 + 0.9 * cons) : 0.03;
      const plow = inPit ? 95 * CV.width * (st.sink + 0.5 * st.wade * CV.clear) * st.v * st.v * (0.7 + 0.6 * cons) : 0;   // tyres, then the axles and frame, pushing mud
      const Fd = (st.air ? 0.3 : 1) * crr * W + plow + 0.62 * W * st.belly + 0.6 * st.v * st.v;
      st.Fd = Fd;
      let acc = (Ft - Fd) / m; if (st.v <= 0 && acc < 0) acc = 0;
      st.v = Math.max(0, st.v + acc * dt); st.x += st.v * dt; st.acc = acc;
      st.maxV = Math.max(st.maxV, st.v); if (inPit) st.peakSlip = Math.max(st.peakSlip, st.slip);
      // lugs: slow wheels pack, fast wheels throw it out; a hole when it spins past the dig point
      if (inPit) {
        const aC = vw * vw / rw;
        st.pack += dt * ((1 - st.pack) * cons * 0.9 * (1 - TY.clean * 0.6) * (aC < 120 ? 1 : 0.35) - st.pack * clamp((aC - 60) / 220, 0, 2) * (0.35 + TY.clean) * 1.6);
        st.pack = clamp(st.pack, 0, 1); if (st.pack > 0.45) st.packT += dt;
        if (st.slip > digS) st.dig = Math.min(1, st.dig + dt * (st.slip - digS) * 1.5 * TY.dig * (0.6 + cons)); else st.dig = Math.max(0, st.dig - dt * st.v * 0.09);
        if (st.slip > digS) st.spinT += dt; else if (st.slip >= sw[0] && st.slip <= sw[1] + 0.06) st.sweetT += dt;
        st.mudKg = Math.min(260, st.mudKg + dt * (6 + 14 * cons) * sr * Math.min(2, Math.abs(vw) / 6));
        st.radPack = clamp(st.radPack + dt * (0.015 + 0.1 * clamp(sr, 0, 1.2) * clamp(Math.abs(vw) / 10, 0, 1.6)) * (0.5 + cons), 0, 1);
      }
      // heat: the water, the exhaust
      const Pk = Math.max(0, Te) * st.rpm * 2 * Math.PI / 60;
      const air = 0.28 + 0.72 * clamp(st.v / 14, 0, 1);
      st.cool += dt * (hFrac * Pk - UA * (st.cool - 30) * air * (1 - 0.78 * st.radPack)) / Cth;
      st.coolPeak = Math.max(st.coolPeak, st.cool); if (st.cool > 122) st.hotT += dt; else st.hotT = Math.max(0, st.hotT - dt * 0.5);
      const egtT = (hasEgt ? interp(res.egtCurve, st.rpm) : (res.diesel ? 720 : 800)) * (0.5 + 0.5 * thr) + (st.rpm < bogHi && thr > 0.7 ? 70 : 0);
      st.egt += (egtT - st.egt) * (1 - Math.exp(-dt / 3.5)); st.egtPeak = Math.max(st.egtPeak, st.egt);
      if (st.egt > egtLimit) st.egtDose += dt * (st.egt - egtLimit) / 60;
      if (thr > 0.6) loadT += dt;
      if (inPit && st.rpm < bogHi && thr > 0.7) st.bogT += dt;
      // something lets go
      if (!v.noFail && !st.broke) {
        if (st.failKind && loadT >= st.failAt) st.broke = st.failKind;
        else if (v.wornAt && loadT >= v.wornAt) st.broke = "worn";
        else if (st.hotT > 1.4) st.broke = "head_lift";
        else if (st.egtDose > egtTrip) st.broke = isTurbo && (res.egtLimitC || 0) <= st.egt ? "turbo" : res.diesel ? "piston" : "crown_temp";
        if (st.broke) { st.failKind = st.broke; st.stopWhy = "broke"; }
      }
      if (st.t - lastTrace >= 0.1) { lastTrace = st.t; st.trace.push({ t: +st.t.toFixed(1), x: +st.x.toFixed(2), v: +st.v.toFixed(2), rpm: Math.round(st.rpm), slip: +st.slip.toFixed(3), throttle: +thr.toFixed(2), d: +st.depth.toFixed(2), cool: Math.round(st.cool), egt: Math.round(st.egt), pack: +st.pack.toFixed(2), dig: +st.dig.toFixed(2), sink: +st.sink.toFixed(2), y: +st.y.toFixed(2), w: +st.w.toFixed(1) }); }
      st.thrNow = thr;
      if (st.x >= L) { st.cleared = true; st.tOut = st.t; st.stopWhy = "cleared"; finish(); return; }
      if (st.broke) { finish(); return; }
      if (st.stalled && st.v < 0.1) { st.stopWhy = "stalled"; finish(); return; }
      if (st.phase === "pit" && st.v < 0.12) { if ((st.stuckT += dt) > 1.5) { st.stopWhy = st.belly > 0.45 ? "highcentre" : st.dig > 0.45 ? "dug" : st.rpm < bogHi && thr > 0.6 ? "bogged" : thr < 0.25 ? "lifted" : st.pack > 0.6 ? "packed" : "stuck"; finish(); return; } }
      else st.stuckT = 0;
      if (st.phase === "runup" && st.t > 25) { st.stopWhy = "time"; finish(); return; }
      if (st.t > 60) { st.stopWhy = "time"; finish(); }
    }
    function finish() { st.done = true; st.phase = "done"; st.distM = clamp(st.x, 0, L); }
    function step(dt, throttle) { if (throttle != null) st.thr = clamp(+throttle || 0, 0, 1); dt = Math.min(0.25, Math.max(0, dt)); while (dt > 1e-9 && !st.done) { const h = Math.min(0.002, dt); dt -= h; sub(h); } return st; }
    /* the auto driver: flat on the run-up unless it's spinning; in the mud it holds the slip near the tyre's sweet spot and the rpm
       out of the bog band — on with it when the rpm sags, off when the slip runs past the dig point. skill 0..1 blurs it: at 1
       it lets the tyres spin right up to the dig point and only leans in once the rpm is actually in the bog band; a lesser
       driver lifts a little early and leans in before it needs to. */
    function auto(skill) {
      const k = skill == null ? 1 : skill;
      if (st.phase === "stage") return 1;
      if (st.phase === "runup") { st.ai = st.slip > 0.22 ? Math.max(0.5, st.ai - 0.04) : Math.min(1, st.ai + 0.05); return st.ai; }
      const tgt = sw[1] + 0.04 + 0.12 * (1 - k), rpmLow = st.rpm < bogHi * (1 + 0.18 * (1 - k));
      if (st.slip > digS - 0.04 * (1 - k) && !rpmLow) st.ai = Math.max(0.35, st.ai - 0.05 * (0.5 + k));
      else if (rpmLow || st.slip < tgt) st.ai = Math.min(1, st.ai + 0.06);
      return st.ai;
    }
    function result() {
      const reasons = [], tn = TY.n.toLowerCase(), pitT = st.cleared ? +(st.tOut - st.tPit).toFixed(2) : null;
      const dM = +clamp(st.x, 0, L).toFixed(2);
      if (st.broke) reasons.push(st.broke === "head_lift" ? `The water hit ${Math.round(st.coolPeak)} °C with the radiator ${Math.round(st.radPack * 100)}% packed with mud — it lifted the head. A bigger radiator margin, or less time spinning in the deep end.` : st.broke === "turbo" ? `The turbine inlet sat at ${Math.round(st.egtPeak)} °C, lugging in the mud — the hot side let go.` : st.broke === "piston" || st.broke === "crown_temp" ? `Exhaust held ${Math.round(st.egtPeak)} °C, loaded down in the mud below its band — a piston crown gave up.` : st.broke === "worn" ? `Something tired let go ${Math.round(dM)} m into the pit — the build was past its pass budget.` : `The engine let go under load ${Math.round(dM)} m into the pit — the dyno sheet already said it was past a limit.`);
      if (st.cleared) reasons.push(`Through the pit in ${pitT.toFixed(2)} s — ${L} m of ${N0.name} mud.`);
      if (st.stopWhy === "bogged") reasons.push(`Bogged down at ${Math.round(st.rpm).toLocaleString()} rpm — under the ${st.bogBand[1].toLocaleString()} rpm band the engine can't hold its torque. A shorter gear keeps it up on the cam; more wheel speed in the deep end.`);
      if (st.stopWhy === "stalled") reasons.push(`Stalled — the clutch truck dragged the engine under ${Math.round(stallR)} rpm. Keep the wheels turning: let it spin rather than lug.`);
      if (st.stopWhy === "highcentre") reasons.push(`High-centred — the frame sat down on the mud with ${Math.round(CV.clear * 100)} cm of clearance and the tyres lost their load. Carry speed over the ridges and through the ruts.`);
      if (st.stopWhy === "dug") reasons.push(`Dug in — ${st.spinT.toFixed(1)} s spinning past ${Math.round(digS * 100)}% slip. The ${tn}s dug a hole instead of driving; feather it to keep them on top.`);
      if (st.stopWhy === "packed") reasons.push(`The ${tn}s packed solid with mud — too slow to throw it out. Some wheel speed cleans the lugs.`);
      if (st.stopWhy === "lifted") reasons.push("Lifted in the pit — the mud stopped it dead. In a bog you stay in it.");
      if (st.stopWhy === "stuck" && !st.broke) reasons.push(`Ran out of momentum ${dM.toFixed(1)} m in — the mud's drag beat what the tyres could put down.`);
      if (st.entryV != null) reasons.push(`Hit the mud at ${(st.entryV * 2.23694).toFixed(0)} mph after a ${CV.runup} m run-up${st.entryV < 6 ? " — not much momentum to carry" : ""}.`);
      if (st.packT > 1.5 && st.stopWhy !== "packed") reasons.push(`Lugs packed for ${st.packT.toFixed(1)} s — ${cons > 0.6 ? "sticky clay grabs a slow tyre" : "slow wheels fill up"}.`);
      if (st.radPack > 0.6 && st.broke !== "head_lift") reasons.push(`Radiator ${Math.round(st.radPack * 100)}% packed by the end · water ${Math.round(st.coolPeak)} °C peak.`);
      if (st.airT > 0.3) reasons.push(`Airborne ${st.airT.toFixed(1)} s off the ridges${st.limT > 0.3 ? " — on the limiter while the wheels were in the air" : ""}.`);
      if (st.sweetT > 2 && !st.cleared) reasons.push(`${st.sweetT.toFixed(1)} s with the slip in the ${Math.round(sw[0] * 100)}–${Math.round(sw[1] * 100)}% band.`);
      return { cleared: st.cleared, pitT: pitT, distM: dM, distFt: +(dM * 3.28084).toFixed(1), len: L, mud: N0.name, cons: cons, night: { len: L, cons: cons, name: N0.name, d0: N0.d0, seed: N0.seed, hz: N0.hz },
        entryMph: st.entryV != null ? +(st.entryV * 2.23694).toFixed(1) : 0, maxMph: +(st.maxV * 2.23694).toFixed(1), avgMph: st.cleared ? +(L / pitT * 2.23694).toFixed(1) : null,
        peakSlip: +st.peakSlip.toFixed(3), peakEgt: Math.round(st.egtPeak), coolPeak: Math.round(st.coolPeak), radPack: +st.radPack.toFixed(2), pack: +st.pack.toFixed(2), dig: +st.dig.toFixed(2), mudKg: Math.round(st.mudKg),
        broke: st.broke, failKind: st.broke ? st.failKind : null, stopWhy: st.stopWhy, time: +st.t.toFixed(1), spinT: +st.spinT.toFixed(1), sweetT: +st.sweetT.toFixed(1), bogT: +st.bogT.toFixed(1), airT: +st.airT.toFixed(1), slaps: st.slaps,
        trace: st.trace, sweet: sw, digS: +digS.toFixed(2), bogBand: st.bogBand, ratio: +G.toFixed(1), mphGear: mph, gearName: G0[gi][0], tyre: TY.n, cls: v.cls, reasons: reasons, veh: { cls: v.cls, gear: gi, tyre: v.tyre } };
    }
    return { st: st, step: step, auto: auto, result: result, ratio: G, night: N0, len: L, sweet: sw, digS: digS, bogBand: st.bogBand, runup: CV.runup };
  }
  /* the engine as the truck sees it: the strip's prep (boost split, turbo size, EGT limit) on a simulate() run */
  function bogPrep(cfg, env, res) { return dragPrep(cfg, env, res); }
  /* a run with the auto driver's foot on it, start to finish: the AI field and the node harness */
  function bogPass(res, veh, skill) { const p = bogRun(res, veh); let n = 0; while (!p.st.done && n++ < 20000) p.step(0.02, p.auto(skill)); return p.result(); }
  /* a rival's engine from a horsepower figure: a smooth torque curve, petrol or diesel, enough for the same sim */
  function bogAiRes(hp, diesel, seed) {
    const r = pullRng(seed), red = diesel ? 3000 + Math.round(r() * 6) * 100 : 5600 + Math.round(r() * 14) * 100, pk = red * (diesel ? 0.6 : 0.64) * (0.9 + 0.2 * r());
    const rpms = [], f = [];
    for (let x = 1000; x <= red + 1; x += 250) { rpms.push(x); f.push(Math.max(0.35, 1 - 0.95 * Math.pow((x - pk) / red, 2))); }
    let best = 0, bi = 0; for (let i = 0; i < rpms.length; i++) if (f[i] * rpms[i] > best) { best = f[i] * rpms[i]; bi = i; }
    const Tpk = hp * 7121 / best, torque = f.map(q => q * Tpk);
    return { rpms, torque, peakTq: Tpk, peakTqRpm: Math.round(pk), peakHp: hp, peakHpRpm: rpms[bi], redline: red, diesel: !!diesel, VdEq: diesel ? 6600 : 5700, fails: [], tests: [], aspKind: "na" };
  }


  /* =====================================================================
     ROAD TEST, THE CAR ITSELF: in sim-late.js, not in the page (since 1.76.139.0).
     Here: roadPrep, the car (roadCar), the setup sheet's physics, the straight-line run (roadRun), the lap sim (lapSim) and roadTest.
     build.js writes this file to sim-late.js; the app fetches it once the garage is up and runs it
     inside the ENGINE_SIM closure (simLateRun in sim/tunemap.js), so it sees every physics name as
     if it were still in the page. sim/road.js keeps the chassis, tyres and tracks, roadTrack (the 3D course and the warm-up read it), setupVis and setupNorm.
     ===================================================================== */
  /* what the road car needs from a dyno result. If the build was never run atmospheric (no res.naTorque), the
     atmospheric curve is estimated from manifold pressure — torque scales with the charge the cylinder takes in. */
  function roadPrep(cfg, res) {
    cfg = Object.assign({}, DEFAULT_CFG, cfg || {});
    const r = Object.assign({}, res);
    const asp = OPT.asp[cfg.asp] || OPT.asp.na;
    r.aspKind = asp.kind; r.compound = !!asp.compound; r.turboUnits = asp.kind === "turbo" ? (asp.units || 1) : 0;
    r.turboMm = (asp.kind === "turbo" || asp.kind === "centrifugal") ? (TURBO_MM[cfg.turboSize] || 54) : 0;
    r.boostTarget = asp.kind === "na" ? 0 : cfg.boost;
    if (!Array.isArray(r.naTorque) || r.naTorque.length !== r.rpms.length) r.naTorque = asp.kind === "na" ? r.torque.slice() : r.torque.map((t, i) => t * 1.013 / (1.013 + Math.max(0, (r.boostCurve || [])[i] || 0)));
    r.redline = cfg.redline; r.idle = isDiesel(cfg) ? 700 : cfg.cam > 60 ? 1100 : 850;
    return r;
  }

  /* the car: chassis + this engine's weight, the tyre fitted and the final drive (auto-fitted, × finalK) */
  function roadCar(res, opt) {
    opt = opt || {};
    const sw = opt.car && opt.car.swap ? opt.car : null;   // an engine swap: the vehicle's own chassis (sim/swap.js); null = the archetypes, as before
    const C0 = sw || CHASSIS[opt.ch] || CHASSIS.coupe, ty = ROAD_TYRES[opt.tyre] || ROAD_TYRES[C0.tyre];
    const ekg = clamp(+res.kg || C0.eng, sw ? 5 : 40, sw ? 9000 : 900), dm = ekg - C0.eng;
    const m = C0.mass + dm + 75;   // + the driver
    const front = clamp((C0.front * C0.mass + dm * C0.xE + 75 * 0.45) / m, sw ? 0.1 : 0.3, sw ? 0.9 : 0.75), dF = front - C0.front;
    // balance off the chassis' design point costs cornering grip (nose-heavy pushes, tail-heavy snaps); tyres lose a little μ per kg
    const kBal = clamp(1 - 1.2 * Math.abs(dF), 0.82, 1), kLoad = Math.pow(m / (C0.mass + 75), -0.12);
    // a swap car runs a real manual driveline: a transaxle loses least, a hypoid rear axle a little more, AWD the most
    const rw = C0.tyreDia * 0.0254 / 2, eta = sw ? (C0.drive === "awd" ? 0.9 : C0.drive === "fwd" ? 0.94 : 0.93) : C0.drive === "awd" ? 0.8 : 0.85, gears = C0.ratios.slice();
    const redline = res.redline || 7000;
    // fit the final drive: top gear lands the engine on its power peak at the speed that power can hold against drag
    const Pw = (res.peakHp || 100) * 745.7 * eta, crr = C0.rr * m * ROAD_G;
    let lo = 5, hi = 250; for (let it = 0; it < 50; it++) { const v = (lo + hi) / 2; if (0.5 * ROAD_RHO * C0.cdA * v * v * v + crr * v > Pw) hi = v; else lo = v; }
    const vPow = lo, pkR = Math.min(res.peakHpRpm || redline * 0.85, redline);
    const top = gears[gears.length - 1];
    // a swap car is geared like a road car: top gear runs out of revs just short of the drag-limited speed, so the
    // engine stays up on its power through the gears instead of lugging in a top gear it can barely pull
    let fd = ((sw ? Math.max(pkR, redline * 1.05) : pkR) * 2 * Math.PI / 60) * rw / (vPow * top);
    fd = clamp(fd, 0.9, 6.5);
    const fdAuto = fd; fd = clamp(fd * clamp(+opt.finalK || 1, 0.6, 1.6), 0.7, 8);
    const tyK = opt.tyre in ROAD_TYRES ? opt.tyre : C0.tyre, mu = ty.mu * roadWetMu(tyK, opt.wet);   // opt.wet: rain on the track
    const RC = { sw: !!sw, ch: opt.ch in CHASSIS ? opt.ch : "coupe", C: C0, tyre: tyK, mu: mu, wet: clamp(+opt.wet || 0, 0, 1), m: m, front: front, dFront: dF, kBal: kBal, kLoad: kLoad,
      muLat: mu * kBal * kLoad * 0.97, muLong: mu * kLoad * 1.12, rw: rw, eta: eta, gears: gears, fd: fd, fdAuto: fdAuto, redline: redline, idle: res.idle || 850,
      cdA: C0.cdA, clA: C0.clA, crr: crr, h: C0.cgH, wb: C0.wb, drive: C0.drive, brake: C0.brake, shift: C0.shift * (sw ? 0.6 : 1) * dtShiftK(opt.dtId), engKg: ekg, vPow: vPow,   // a dog box (the drivetrain tier, sim/drag.js) shifts quicker
      bal: dF > 0.025 ? "under" : dF < -0.025 ? "over" : "neutral" };
    if (+opt.dtCap > 0) RC.dtCap = +opt.dtCap;   // a drivetrain tier (sim/drag.js); absent = no limit
    return roadSetup(RC, opt.setup, +opt.bump || 0);
  }

  /* the setup sheet: roll stiffness (soft..stiff, springs + bars together, 0..100, 50 stock), the front/rear split of it
     (-100 stiffer rear .. +100 stiffer front, 0 stock) and the wing angle (-100 flat .. +100 steep, 0 stock). Lateral grip is
     the weaker axle's: the stiffer end of the car sheds more grip to load transfer, so a front-stiff car pushes (under) and a
     rear-stiff one comes round (over). The chassis' own nose-weight bias (`bias`, + = pushes) is already in the stock numbers,
     so the stock setup is the reference and leaves the car exactly as it was; moving toward neutral gains a little, past it
     loses. The wing trades downforce (clA) for drag (cdA) and loads the tail.
     Since 1.76.77.0 four more: brake bias (bb, -100 rear .. +100 front, 0 stock), tyre pressure (ps, 24..40 psi, 32 stock),
     differential lock (df, -100 open .. +100 locked, 0 stock) and ride height (rh, -100 slammed .. +100 raised, 0 stock).
     Absent / stock = no change at all, field by field. */
  // wing: +100 adds a (+ b per m² the chassis already makes) of downforce at d drag per unit of it (L/D 2.5): it pays in the corners
  // (a little at club speeds, more on the hill's fast sweepers) and costs top speed on the straights
  const WK = { bal: 0.05, a: 2.6, b: 0.3, d: 0.4 };
  /* the four newer settings. Brake bias: the stock split is a safe road setting; on track the best sits bbBase back from it,
     a little forward on a nose-heavy car and further back on one with downforce (bbW per unit of front-weight shift, bbCl per m²
     of downforce); off it the brakes lose bbF of their hold per unit², a rear-heavy split bbR more (the rears lock). Pressure: grip peaks a few psi under stock on a light car and at about stock on a heavy one
     (psSo at 1,400 kg, psM per kg), falls psK per unit² either side (8 psi = one unit), and a soft tyre rolls psRr heavier.
     Diff: it moves the balance like the springs do (dfBal at full travel: locked pushes, open lets it turn), so it can cure a car
     that pushes or one that is loose; and exit drive gains dfX × how hard it is cornering (an open diff spins the inside wheel),
     which only counts when the tyres, not the engine, are the limit: a big engine wants it tighter. Ride height: low adds rhCl m² of downforce (more on a car built for it) and lowers the centre of
     gravity by rhH; from rhBot down it hits the bumps (rhBump × the track's roughness at full low); raised rolls rhHi more. */
  const SU_K = { bbBase: -0.25, bbW: 4, bbCl: 0.08, bbF: 0.18, bbR: 0.12, psStock: 32, psSo: 0.45, psM: 2500, psK: 0.05, psRr: 0.2,
    dfBal: 0.2, dfX: { rwd: 0.3, fwd: 0.25, awd: 0.12 }, rhCl: 0.25, rhH: 0.06, rhBot: 0.3, rhBump: 0.10, rhHi: 0.02 };
  function roadSetup(car, setup, bump) {
    const bias = clamp(car.dFront * 8, -0.6, 0.6);
    car.bias = bias; car.su = null; car.bi = bias;
    const su = setupNorm(setup); if (!su) return car;
    const amp = 0.6 + 0.8 * su.st / 100, r = su.sp / 100 * amp + WK.bal * su.wg / 100, g = r + bias + SU_K.dfBal * su.df / 100;
    const kSt = 1 - 1.25e-5 * (Math.pow(su.st - 65, 2) - 225);   // best near 65 (a touch firmer than stock): soft rolls onto its camber, very stiff skips over bumps
    car.muLat *= kSt * (1 - 0.10 * (Math.abs(g) - Math.abs(bias)));
    const dCl = su.wg / 100 * (WK.a + WK.b * Math.min(2, Math.max(0, car.clA)));
    const cl1 = Math.max(car.clA + dCl, Math.min(car.clA, -0.1));   // a flat wing sheds the downforce, it does not turn into lift
    car.cdA = Math.max(0.3, car.cdA + WK.d * (cl1 - car.clA)); car.clA = cl1;
    if (r < 0 && car.drive !== "fwd") car.tK = 0.10 * Math.min(1, -r);   // tail-happy: the rear lets go on the throttle out of a corner
    else if (r > 0 && car.drive === "fwd") car.tK = 0.08 * Math.min(1, r);   // front-drive and front-stiff: it pushes wide on the power
    const K = SU_K;
    if (su.rh) {   // ride height first: the downforce it makes moves the best brake bias
      const h = su.rh / 100, lo = Math.max(0, -h), bot = Math.max(0, lo - K.rhBot) / (1 - K.rhBot);
      car.clA += -h * K.rhCl * (1 + Math.min(2, Math.max(0, car.clA)));
      car.h *= 1 + K.rhH * h;
      car.muLat *= (1 - K.rhBump * clamp(bump || 0, 0, 1) * bot * bot) * (1 - K.rhHi * Math.max(0, h));
    }
    if (su.bb) {
      const bo = clamp(K.bbBase + car.dFront * K.bbW - K.bbCl * clamp(car.clA, 0, 2), -0.6, 0.2), pen = x => K.bbF * x * x + (x < 0 ? K.bbR * x * x : 0);
      car.kB = 1 - (pen(su.bb / 100 - bo) - pen(-bo));
    }
    if (su.ps !== K.psStock) {
      const soft = (K.psStock - su.ps) / 8, so = clamp(K.psSo - (car.m - 1400) / K.psM, -0.2, 0.7), kP = 1 - K.psK * (Math.pow(soft - so, 2) - so * so);
      car.muLat *= kP; car.muLong *= kP; car.crr *= 1 + K.psRr * soft;
    }
    if (su.df) car.kD = (K.dfX[car.drive] || K.dfX.rwd) * su.df / 100;
    car.su = su; car.bi = clamp(g, -1, 1);
    return car;
  }
  /* engine model shared by the straight-line run and the lap: torque at rpm with the boost that has actually been built */
  function roadEngine(res, car) {
    const rpms = res.rpms, tq = res.torque, N = rpms.length;
    const interp = (arr, r) => { if (r <= rpms[0]) return arr[0]; if (r >= rpms[N - 1]) return arr[N - 1]; let a = 0, b = N - 1; while (b - a > 1) { const m = (a + b) >> 1; if (rpms[m] <= r) a = m; else b = m; } const f = (r - rpms[a]) / (rpms[b] - rpms[a]); return arr[a] + f * (arr[b] - arr[a]); };
    const torqueAt0 = r => r <= rpms[0] ? tq[0] * Math.max(0.35, r / rpms[0]) : interp(tq, r);
    // the full-load curve on a 10 rpm grid: the lap asks for it a few hundred thousand times
    const TQS = 10, TQN = Math.ceil(car.redline * 1.02 / TQS) + 2, TQT = new Float64Array(TQN); for (let i = 0; i < TQN; i++) TQT[i] = torqueAt0(i * TQS);
    const torqueAt = r => { const x = r / TQS, i = x | 0; if (i >= TQN - 1) return torqueAt0(r); const f = x - i; return TQT[i] + (TQT[i + 1] - TQT[i]) * f; };
    const kind = res.aspKind || "na", bT = +res.boostTarget || 0;
    let trans = kind !== "na" && bT > 0 && Array.isArray(res.naTorque) && res.naTorque.length === N && Array.isArray(res.boostCurve) && res.boostCurve.length === N;
    let gpb = null;
    if (trans) {
      gpb = new Array(N); const valid = [];
      for (let i = 0; i < N; i++) { const b = res.boostCurve[i]; if (b > Math.max(0.10, 0.15 * bT)) { gpb[i] = Math.max(0, tq[i] - res.naTorque[i]) / b; valid.push(i); } else gpb[i] = null; }
      if (!valid.length) trans = false;
      else for (let i = 0; i < N; i++) if (gpb[i] == null) { let j = valid[0]; for (const k of valid) if (Math.abs(k - i) < Math.abs(j - i)) j = k; gpb[i] = gpb[j] * Math.max(0, res.naTorque[i]) / Math.max(1, res.naTorque[j]); }
    }
    const isTurbo = trans && kind === "turbo", tqCap = Math.max.apply(null, tq) * 1.06, mm = res.turboMm || 54, VdL = Math.max(0.5, (res.Vd || 2000) / 1000);
    const tauBase = (0.25 + 1.0 * clamp((mm - 46) / 52, 0, 1.2)) * (res.turboUnits === 2 && !res.compound ? 0.78 : 1) * clamp(Math.pow(2.5 / VdL, 0.3), 0.55, 1.5);
    const pkRpm = res.peakHpRpm || car.redline * 0.85;
    const gridOf = fn => { const T2 = new Float64Array(TQN); for (let i = 0; i < TQN; i++) T2[i] = fn(i * TQS); return r => { const x = r / TQS, i = x | 0; if (i >= TQN - 1) return fn(r); if (i < 0) return T2[0]; const f = x - i; return T2[i] + (T2[i + 1] - T2[i]) * f; }; };
    const bss = trans ? gridOf(r => Math.max(0, interp(res.boostCurve, r))) : () => 0, gpbAt = trans ? gridOf(r => interp(gpb, r)) : null, naAt = trans ? gridOf(r => interp(res.naTorque, r)) : null;
    const E = {
      trans: trans, bss: bss,
      // full-throttle torque with boost state b (bar); above the redline the limiter cuts it
      tq: (r, b) => {
        if (r > car.redline * 1.005) return 0;
        if (!trans) return torqueAt(r);
        const full = torqueAt(r), d = b - bss(r), gb = gpbAt(r);
        return d >= 0 ? Math.min(full + gb * d, Math.max(tqCap, full)) : Math.max(naAt(r), full + gb * d);
      },
      steadyTq: r => r > car.redline * 1.005 ? 0 : torqueAt(r),
      boost: (b, dt, r, load) => {
        if (!trans) return 0;
        const tgt = Math.min(bT, bss(r) * Math.pow(clamp(load, 0, 1), isTurbo ? 1.5 : 1));
        let tau = 0.05;
        if (isTurbo) { tau = tgt > b ? tauBase / Math.pow(clamp(r * Math.max(0.15, load) / pkRpm, 0.08, 1.3), 0.75) : 0.35; if (res.compound && tgt > b) tau *= b > 0.5 * bT ? 1.35 : 0.7; }
        return clamp(b + (tgt - b) * (1 - Math.exp(-dt / Math.max(0.03, tau))), 0, bT);
      }
    };
    if (car.dtCap > 0) { const t0 = E.tq, s0 = E.steadyTq; E.tq = (r, b) => Math.min(t0(r, b), car.dtCap); E.steadyTq = r => Math.min(s0(r), car.dtCap); }   // a drivetrain tier: the clutch slips past its rating
    return E;
  }
  const rpmOf = (car, v, g) => v / car.rw * car.gears[g] * car.fd * 60 / (2 * Math.PI);
  // the gear that pulls hardest at this speed (steady boost) without going past the redline
  function bestGear(car, E, v, cap) {
    let best = car.gears.length - 1, bf = -1;
    // a swap car's driver knows the tyres: a gear that only has more torque than the tyres can use is no better, so of two gears that both
    // saturate the grip he takes the taller one (less wheelspin, one shift fewer). The archetype chassis keep the plain force race.
    const fcap = car.sw ? tractionF(car, v, 0) * car.rw / (car.fd * car.eta) : 0;
    for (let g = 0; g < car.gears.length; g++) { const r = rpmOf(car, v, g); if (r > car.redline * (cap || 0.995)) continue; let f = E.steadyTq(Math.max(r, car.idle)) * car.gears[g]; if (car.sw && f > fcap) f = fcap; if (car.sw ? f >= bf : f > bf) { bf = f; best = g; } }
    return best;
  }
  const gearPull = (car, E, v, g) => { const r = rpmOf(car, v, g); return r > car.redline ? 0 : E.steadyTq(Math.max(r, car.idle)) * car.gears[g]; };
  // most force the tyres take for drive (a = 0 weight transfer handled implicitly), and for braking, at speed v with lateral use latF (0..1)
  function tractionF(car, v, latF) {
    const DF = 0.5 * ROAD_RHO * car.clA * v * v, mg = car.m * ROAD_G, mu = car.muLong * Math.sqrt(Math.max(0, 1 - latF * latF)) * (car.tK ? 1 - car.tK * latF : 1) * (car.kD ? 1 + car.kD * latF : 1), hw = car.h / car.wb;
    if (car.drive === "awd") return mu * (mg + DF) * 0.98;
    if (car.drive === "fwd") return mu * (mg * car.front + DF * 0.45) / (1 + mu * hw);
    return mu * (mg * (1 - car.front) + DF * 0.55) / Math.max(0.3, 1 - mu * hw);
  }
  function brakeF(car, v, latF) {
    const DF = 0.5 * ROAD_RHO * car.clA * v * v, mg = car.m * ROAD_G;
    return Math.min(car.brake * mg, car.muLong * (mg + Math.max(0, DF))) * Math.sqrt(Math.max(0, 1 - latF * latF)) * (car.kB || 1);
  }
  // flywheel, gears and wheels have to be spun up too: the usual 1.04 + k·N² effective-mass factor on the overall ratio N
  const mEff = (car, g) => { const N = car.gears[g] * car.fd; return 1.04 + (car.sw ? 0.0006 : 0.0008) * N * N; };
  const dragF = (car, v) => 0.5 * ROAD_RHO * car.cdA * v * v + car.crr;

  /* straight line: 0–60 mph, 0–100 km/h, 0–200, the quarter, 80–120 rolling, top speed, 100–0 */
  function roadRun(res, opt) {
    const car = roadCar(res, opt), E = roadEngine(res, car), m = car.m;
    const out = { car: car };
    // standing start: clutch slips at the launch rpm until the wheels catch up; turbo pre-loaded a little against the brake
    const launch = clamp(Math.max(car.idle + 1200, (res.peakTqRpm || 3000) * 0.75), car.idle + 600, car.redline * 0.8);
    let v = 0, x = 0, t = 0, g = 0, shiftLeft = 0, b = E.bss(launch) * 0.35, spin = 0, z60 = null, z100 = null, z200 = null, q = null, e8 = null;
    const dt = 0.01;
    while (t < 60 && (q == null || z200 == null && t < 40)) {
      let F = 0, rpm;
      const vr = rpmOf(car, v, g);
      if (shiftLeft > 0) { shiftLeft -= dt; rpm = vr; if (shiftLeft <= 0) g++; }
      else {
        const bg = bestGear(car, E, v); if (bg > g && v > 1) { shiftLeft = car.shift; }
        rpm = Math.max(vr, g === 0 ? launch : car.idle);
        F = E.tq(rpm, b) * car.gears[g] * car.fd * car.eta / car.rw;
        const Ft = tractionF(car, v, 0);
        if (F > Ft) {
          // a swap car: the driver and the traction control hold the tyres at the peak while the overshoot is small, and the margin widens
          // with speed (the contact patch is rolling, not lighting up); only past it do the wheels spin and the grip falls off a little
          const over = F / Ft - 1, tol = car.sw ? 0.12 + 0.035 * v : 0;
          if (over > tol) { spin += dt; F = car.sw ? Ft * (1 - 0.08 * Math.min(1, (over - tol) / 0.6)) : Ft; } else F = Ft;
        }
      }
      b = E.boost(b, dt, rpm, shiftLeft > 0 ? 0.7 : 1);
      const a = (F - dragF(car, v)) / (m * mEff(car, g));
      v = Math.max(0, v + a * dt); x += v * dt; t += dt;
      if (z60 == null && v >= 26.8224) z60 = t;
      if (z100 == null && v >= 27.7778) z100 = t;
      if (z200 == null && v >= 55.5556) z200 = t;
      if (e8 == null && x >= 201.168) e8 = { t: t, kmh: v * 3.6 };
      if (q == null && x >= 402.336) q = { t: t, kmh: v * 3.6, mph: v * 2.23694 };
    }
    out.zero60 = z60; out.zero100 = z100; out.zero200 = z200; out.quarter = q; out.eighth = e8; out.spinT = +spin.toFixed(2);
    // top speed: the fastest speed where some gear still has force to spare at steady boost
    let vt = 0, gt = car.gears.length - 1, lim = "drag";
    for (let vv = 5; vv < 250; vv += 0.1) {
      let ok = false, gg = -1; for (let k = 0; k < car.gears.length; k++) { const r = rpmOf(car, vv, k); if (r > car.redline) continue; const f = E.steadyTq(Math.max(r, car.idle)) * car.gears[k] * car.fd * car.eta / car.rw; if (f > dragF(car, vv)) { ok = true; gg = k; } }
      if (!ok) break; vt = vv; gt = gg;
    }
    if (rpmOf(car, vt + 0.15, gt) > car.redline && gt === car.gears.length - 1) lim = "redline";
    out.top = { kmh: +(vt * 3.6).toFixed(1), mph: +(vt * 2.23694).toFixed(1), gear: gt + 1, limit: lim };
    // 80–120 km/h: kick down to the best gear, boost starts from cruise
    v = 80 / 3.6; t = 0; g = bestGear(car, E, v); b = E.bss(rpmOf(car, v, g)) * 0.15; shiftLeft = 0;
    while (v < 120 / 3.6 && t < 40) {
      let F = 0; const rpm = rpmOf(car, v, g);
      if (shiftLeft > 0) { shiftLeft -= dt; if (shiftLeft <= 0) g++; }
      else { if (bestGear(car, E, v) > g) shiftLeft = car.shift; F = Math.min(E.tq(rpm, b) * car.gears[g] * car.fd * car.eta / car.rw, tractionF(car, v, 0)); }
      b = E.boost(b, dt, rpm, shiftLeft > 0 ? 0.7 : 1);
      v += (F - dragF(car, v)) / (m * mEff(car, g)) * dt; t += dt;
    }
    out.roll80120 = v >= 120 / 3.6 ? +t.toFixed(2) : null;
    // 100–0 km/h on the brakes
    v = 100 / 3.6; x = 0; while (v > 0) { const a = (brakeF(car, v, 0) + dragF(car, v)) / m; x += v * 0.002; v -= a * 0.002; }
    out.brake100 = +x.toFixed(1);
    return out;
  }

  /* one lap, flying start. Returns the lap time, sectors and a dense trace (one sample per ROAD_DS metres). */
  function lapSim(res, opt, trackId) {
    const T = roadTrack(trackId), N = T.N, ds = T.ds, car = roadCar(res, T.bump ? Object.assign({}, opt, { bump: T.bump }) : opt), E = roadEngine(res, car), m = car.m;
    // grip ceiling: v²|k| = μ (g + ½ρ clA v² / m)
    const vc = new Float64Array(N); let iMin = 0;
    const aero = 0.5 * ROAD_RHO * car.clA / m;
    for (let i = 0; i < N; i++) { const k = Math.abs(T.k[i]); if (k < 1e-6) { vc[i] = 150; continue; } const den = k - car.muLat * aero; vc[i] = den <= 0 ? 150 : Math.min(150, Math.sqrt(car.muLat * ROAD_G / den)); if (vc[i] < vc[iMin]) iMin = i; }
    const ayMax = v => car.muLat * (ROAD_G + aero * v * v);
    const latUse = (i, v) => Math.min(1, v * v * Math.abs(T.k[i]) / ayMax(v));
    // backward pass: how fast it can be going here and still make every corner ahead (two laps round from the slowest point)
    const vb = Float64Array.from(vc);
    for (let it = 0; it < 2 * N; it++) {
      const i = ((iMin - it) % N + N) % N, j = (i + 1) % N;
      const vj = vb[j], lat = latUse(j, vj), dec = (brakeF(car, vj, lat * 0.98) + dragF(car, vj)) / m;
      const lim = Math.sqrt(vj * vj + 2 * dec * ds); if (lim < vb[i]) vb[i] = lim;
    }
    // forward pass: full throttle wherever the envelope allows, gear + shift + boost carried, two laps to settle
    const tr = { v: new Float32Array(N), g: new Uint8Array(N), rpm: new Float32Array(N), thr: new Float32Array(N), brk: new Float32Array(N), bst: new Float32Array(N), t: new Float64Array(N + 1), ax: new Float32Array(N), ay: new Float32Array(N), lim: new Uint8Array(N) };
    let v = vb[iMin], g = bestGear(car, E, v), shiftLeft = 0, b = 0, shifts = 0, lim = 0;
    const dtOf = (v0, v1) => 2 * ds / Math.max(0.5, v0 + v1);
    for (let it = 0; it < 2 * N; it++) {
      const i = (iMin + it) % N, j = (i + 1) % N, rec = it >= N;
      const lat = latUse(i, v), Ft = tractionF(car, v, Math.min(0.995, lat));
      let rpm = Math.max(rpmOf(car, v, g), car.idle), Fe = 0;
      if (shiftLeft <= 0) {
        const bg = bestGear(car, E, v), bd = bestGear(car, E, v, 0.9);   // down a gear only with room under the redline: no hunting at the limiter
        if (bg > g) { shiftLeft = car.shift; if (rec) shifts++; }
        else if (bd < g && gearPull(car, E, v, bd) > 1.12 * gearPull(car, E, v, g)) { g = bd; rpm = Math.max(rpmOf(car, v, g), car.idle); }
      }
      if (shiftLeft <= 0) Fe = E.tq(rpm, b) * car.gears[g] * car.fd * car.eta / car.rw;
      const Fd = dragF(car, v);
      let F = Math.min(Fe, Ft), v1 = Math.sqrt(Math.max(0.25, v * v + 2 * (F - Fd) / (m * mEff(car, g)) * ds)), thr = shiftLeft > 0 ? 0 : 1, brk = 0;
      const tl = F < Fe && F === Ft;
      if (tl && rec) lim += dtOf(v, v1);   // traction-limited time (wheelspin / push on corner exit)
      if (v1 > vb[j]) {
        const Freq = m * mEff(car, g) * (vb[j] * vb[j] - v * v) / (2 * ds) + Fd;
        v1 = vb[j];
        if (Freq >= 0) thr = Fe > 0 ? clamp(Freq / Fe, 0, 1) : 0; else { thr = 0; brk = clamp(-Freq / Math.max(1, brakeF(car, v, 0)), 0, 1); }
      }
      const dt = dtOf(v, v1);
      if (shiftLeft > 0) { shiftLeft -= dt; if (shiftLeft <= 0) g = Math.min(car.gears.length - 1, g + 1); }
      b = E.boost(b, dt, rpm, shiftLeft > 0 ? 0.7 : thr);
      if (rec) { tr.v[i] = v; tr.g[i] = g + 1; tr.rpm[i] = rpm; tr.thr[i] = thr; tr.brk[i] = brk; tr.bst[i] = b; tr.ax[i] = (v1 - v) / dt / ROAD_G; tr.ay[i] = v * v * T.k[i] / ROAD_G; tr.t[i] = dt; tr.lim[i] = tl && v1 <= vb[j] + 1e-9 && thr > 0.5 ? 1 : 0; }
      v = v1;
    }
    // cumulative time from the start line (sample 0)
    let acc = 0; for (let i = 0; i < N; i++) { const d = tr.t[i]; tr.t[i] = acc; acc += d; } tr.t[N] = acc;
    const time = acc;
    const secT = T.sec.map(f => tr.t[Math.round(f * N)]);
    const sectors = [secT[0], secT[1] - secT[0], time - secT[1]];
    let vmax = 0, vmaxAt = 0; for (let i = 0; i < N; i++) if (tr.v[i] > vmax) { vmax = tr.v[i]; vmaxAt = i * ds; }
    // slowest point of each corner (the apex speed)
    const apex = T.corners.filter(c => c.name).map(c => { let mn = 999, at = c.s0; const i0 = Math.floor(c.s0 / ds), i1 = Math.ceil((c.s1 < c.s0 ? c.s1 + T.len : c.s1) / ds); for (let q2 = i0; q2 <= i1; q2++) { const ii = q2 % N; if (tr.v[ii] < mn) { mn = tr.v[ii]; at = ii * ds; } } return { name: c.name, kmh: +(mn * 3.6).toFixed(1), s: at }; });
    let vmin = 999; for (let i = 0; i < N; i++) vmin = Math.min(vmin, tr.v[i]);
    let ayPk = 0, brPk = 0, full = 0; for (let i = 0; i < N; i++) { ayPk = Math.max(ayPk, Math.abs(tr.ay[i])); brPk = Math.min(brPk, tr.ax[i]); if (tr.thr[i] > 0.98) full += tr.t[i + 1] - tr.t[i]; }
    return { track: T.id, trackName: T.n, len: T.len, time: time, sectors: sectors, vmax: vmax * 3.6, vmaxAt: vmaxAt, vmin: vmin * 3.6, apex: apex, shifts: shifts,
      tractionT: +lim.toFixed(2), fullPct: Math.round(100 * full / time), ayPk: +ayPk.toFixed(2), brakePk: +(-brPk).toFixed(2), trace: tr, car: car, N: N, ds: ds };
  }
  /* both, for the app: straight-line figures + a lap */
  function roadTest(res, opt, trackId) { const r = roadRun(res, opt); r.lap = lapSim(res, opt, trackId); return r; }


  /* =====================================================================
     24 HOURS OF PRAIRIE SKY, THE RACE ITSELF: in sim-late.js, not in the page (since 1.76.138.0).
     The player's car through scrutineering (enduroPrep: lap pace per mode, thirst, failure rates),
     the AI field and the classes, the sky, the safety car, the crew chief, the stepper (enduroStep)
     and the result. build.js writes this file to sim-late.js; the app fetches it once the garage is
     up and runs it inside the ENGINE_SIM closure (simLateRun in sim/tunemap.js), so it sees every
     physics name as if it were still in the page. The tables the setup screen and the 3D read before
     it arrives (modes, tyres, classes, the clock) stay in sim/e24.js, which has the full story.
     ===================================================================== */
  // subsystems that run on heat (ambient and mode bite harder) — the rest are mechanical (rpm, load)
  const E24_THERM = { cooling: 1, crown_temp: 1, valve_temp: 1, turbine_temp: 1, preignition_egt: 1, detonation: 1, compressor_map: 1, als_heat: 1, coolant_seal: 1, head_lift: 1, gasket_shear: 1, oil_starvation: 1, hot_clearance: 1, vgt_vanes: 1, carbon_seals: 1 };
  /* a wet sump in the 24 h: the oil-surge rate is multiplied by k and never below floor per hour (race mode) */
  const E24_WET = { k: 3, floor: 0.04 };
  const E24_TEAMS = ["Coulee Racing", "Big Sky Motorsport", "Red Deer Autosport", "Moose Jaw Speed", "Brandon Garage", "Medicine Hat Racing", "Swift Current GT", "Yorkton Engineering",
    "Lethbridge Lightning", "Prince Albert Racing", "Estevan Oilpatch", "Grain Belt Motorsport", "Chinook Racing", "Badlands Competition", "Canola Speedworks", "Saskatoon Sports Cars",
    "Regina Rapid", "Drumheller Racing", "Wheatland Works", "Qu'Appelle Valley", "Cypress Hills GT", "Battleford Bros", "Kindersley Kustom", "Weyburn Wheels"];
  const E24_DRIVERS = ["A. Lindqvist", "J. Kowalchuk", "M. Bélanger", "R. Okafor", "T. Nakamura", "C. Running Rabbit", "E. Petrenko", "S. MacLeod", "L. Dubois", "K. Singh", "B. Halvorsen", "N. Wiebe"];
  const e24Rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const e24Gauss = r => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307 * r()); };
  const e24Sm = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  function e24Amb(t) { return 21 + 9 * Math.cos(2 * Math.PI * (e24Hour(t) - 16) / 24); }
  function e24Sky(t) { const h = e24Hour(t), n = h >= 12 ? e24Sm(21.0, 22.4, h) : 1 - e24Sm(4.4, 5.9, h);
    return { n: n, warm: Math.max(0, 1 - Math.abs(h - 21.4) / 1.1, 1 - Math.abs(h - 5.3) / 1.0), h: h, amb: e24Amb(t) }; }

  /* one car: pace per mode, grip slope, fuel per lap per mode, the subsystems hot and cool */
  const E24_CACHE = {};
  function enduroPrep(cfg, env, opt, trackId, lite) {
    cfg = Object.assign({}, DEFAULT_CFG, cfg || {});
    const base = Object.assign({}, DEFAULT_ENV, env || {});
    const res = simulate(cfg, Object.assign({}, base, { testType: "pull" }));
    const prep = roadPrep(cfg, res), o = { ch: (opt && opt.ch) || "coupe", tyre: "semi", finalK: (opt && opt.finalK) || 1 };
    if (opt && opt.car) o.car = opt.car;   // a swap vehicle (sim/swap.js)
    const scaled = k => k === 1 ? prep : Object.assign({}, prep, { torque: prep.torque.map(t => t * k), naTorque: prep.naTorque.map(t => t * k) });
    const rp = res.rpms, lph = (res.fuel && res.fuel.lph) || rp.map(() => res.peakHp * 0.33), N = rp.length;
    const lphAt = r => { if (r <= rp[0]) return lph[0] * Math.max(0.3, r / rp[0]); if (r >= rp[N - 1]) return lph[N - 1]; let a = 0, b = N - 1; while (b - a > 1) { const m = (a + b) >> 1; if (rp[m] <= r) a = m; else b = m; } return lph[a] + (lph[b] - lph[a]) * (r - rp[a]) / (rp[b] - rp[a]); };
    const lapFuel = (L, k) => { const tr = L.trace; let f = 0; for (let i = 0; i < L.N; i++) { const dt = tr.t[i + 1] - tr.t[i], th = tr.thr[i]; f += (th * k + 0.05 * (1 - th)) * lphAt(tr.rpm[i]) * dt; } return f / 3600; };
    const modes = {}; let Lr = null;
    for (const m of lite ? ["race"] : ["push", "race", "save"]) { const M = E24_MODES[m], L = lapSim(scaled(M.tq), o, trackId); modes[m] = { lap: L.time, fuel: lapFuel(L, M.tq) * M.fuel }; if (m === "race") Lr = L; }
    if (lite) { modes.push = { lap: modes.race.lap * 0.988, fuel: modes.race.fuel * 1.09 }; modes.save = { lap: modes.race.lap * 1.024, fuel: modes.race.fuel * 0.88 }; }
    const Ls = lapSim(scaled(E24_MODES.race.tq), Object.assign({}, o, { tyre: "sport" }), trackId);
    // the endurance model on the track profile, with this car's own sustained cornering load on the oil system
    const gLat = clamp(0.8 * Lr.ayPk, 0.6, 1.35), endu = a => simulate(cfg, Object.assign({}, base, { testType: "endurance", loadProfile: "track", hours: 24, ambientC: a, gLat: gLat }));
    const hot = endu(31), cool = endu(11);
    const slope = Math.min(-1, (Ls.time - modes.race.lap) / (ROAD_TYRES.sport.mu - ROAD_TYRES.semi.mu));   // s of lap per unit of μ
    const tests = hot.tests.map(t => { const c = cool.tests.find(x => x.id === t.id) || t; return { id: t.id, name: t.name, sub: t.sub, uH: t.util, uC: c.util, th: !!E24_THERM[t.id] }; });
    /* a swap: a radiator short of the sustained heat runs the cooling hot for 24 hours; a driveline past its rating is one more part that wears out */
    if (opt && opt.cool > 1) tests.forEach(t => { if (t.id === "cooling") { t.uH = Math.max(t.uH, 1.4 * opt.cool); t.uC = Math.max(t.uC, 1.25 * opt.cool); } });
    if (opt && opt.dl > 0) { const u = opt.dl <= 1 ? 0.75 * opt.dl : 1.5 * opt.dl; tests.push({ id: "swap_driveline", name: "Gearbox & axle", sub: "swap driveline", uH: u, uC: u, th: false }); }
    const out = { cfg: cfg, ch: o.ch, track: trackId, len: Lr.len, modes: modes, slope: slope, tests: tests, fails: res.fails.slice(), crit: hot.fails.length > 0, hp: res.peakHp, kg: res.kg,
      redline: cfg.redline, lifeHours: res.lifeHours, raceSpec: res.raceSpec, racePasses: res.racePasses, rel: res.rel, cost: res.cost,
      wet: !cfg.oilSystem || cfg.oilSystem === "wet", egtH: hot.thermals.egtPeakC, egtC: cool.thermals.egtPeakC, oilH: hot.thermals.oilC, oilC: cool.thermals.oilC, mass: Lr.car.m, vmax: Lr.vmax, gLat: gLat, critN: hot.fails.slice() };
    if (!lite) { out.lap = Lr; out.res = res; }
    return out;
  }
  /* each subsystem's damage rate per hour (Miner, track profile) at this ambient and mode, and the total */
  function e24Rates(P, amb, mode) {
    const M = E24_MODES[mode] || E24_MODES.race, f = clamp((amb - 11) / 20, -0.6, 1.6), r = new Array(P.tests.length); let sum = 0, top = 0, ti = -1;
    for (let i = 0; i < P.tests.length; i++) { const t = P.tests[i], u = Math.max(0, t.uC + (t.uH - t.uC) * f) * (t.th ? M.therm : M.mech);
      r[i] = clamp(Math.pow(u * 1.06 / 0.82, 7) / 5000, 0, 3);
      if (t.id === "oil_starvation" && P.wet) r[i] = Math.max(r[i] * E24_WET.k, E24_WET.floor * (t.th ? M.therm : M.mech));   // 24 hours of kerbs on a standard pan
      sum += r[i]; if (r[i] > top) { top = r[i]; ti = i; } }
    return { r: r, sum: sum, top: ti, haz: E24_K * sum };
  }
  /* the field: AI entries drawn from the presets, each run through the same model (cached per circuit) */
  function e24Ai(id, cls, trackId) {
    const key = id + "|" + cls + "|" + trackId; if (E24_CACHE[key]) return E24_CACHE[key];
    const p = PRESETS.find(q => q.id === id); if (!p) return null;
    const cfg = Object.assign({}, p.cfg); if (!cfg.oilSystem || cfg.oilSystem === "wet") cfg.oilSystem = "baffled";   // the teams race-prep their engines: a baffled sump at least
    const P = enduroPrep(cfg, null, { ch: E24_CLASSES[cls].ch }, trackId, true); P.name = p.name; P.id = id;
    if (P.crit || P.fails.length) return null;
    return (E24_CACHE[key] = P);
  }
  function enduroClasses(trackId) {
    const key = "cls|" + trackId; if (E24_CACHE[key]) return E24_CACHE[key];
    const out = {};
    for (const c of E24_CLS_ORDER) { const laps = E24_CLASSES[c].pool.map(id => e24Ai(id, c, trackId)).filter(Boolean).map(P => P.modes.race.lap).sort((a, b) => a - b);
      const k = E24_CLASSES[c].k; out[c] = { n: E24_CLASSES[c].n, med: (laps[laps.length >> 1] || 120) * k, best: (laps[0] || 110) * k, slow: (laps[laps.length - 1] || 130) * k }; }
    return (E24_CACHE[key] = out);
  }
  // classed by pace at scrutineering: the class whose typical lap is nearest
  function enduroClassOf(P, trackId) { const C0 = enduroClasses(trackId), l = P.modes.race.lap; let best = "stock", bd = 1e9;
    for (const c of E24_CLS_ORDER) { const d = Math.abs(Math.log(l / C0[c].med)); if (d < bd) { bd = d; best = c; } } return best; }

  /* a new race. o: {track, me (enduroPrep of the player's car), plan, seed, sc (safety cars on), name, number} */
  function enduroNew(o) {
    const r = e24Rng(o.seed >>> 0), trackId = o.track, T = roadTrack(trackId), myCls = enduroClassOf(o.me, trackId);
    const R = { v: 1, track: trackId, len: T.len, t: 0, dur: E24_DUR, seed: o.seed >>> 0, r: r, scOn: o.sc !== false, sc: null, scN: 0, cars: [], feed: [], seq: 0, timed: [], done: false,
      lane: trackId === "gp" ? 31 : 25, myCls: myCls, plan: Object.assign({ mode: "race", stint: 0, fuel: "full", tyre: "medium", chg: "every", scPit: true }, o.plan || {}), hourMark: 1, lastSky: "day" };
    const teams = E24_TEAMS.slice(), pick = a => a.splice(Math.floor(r() * a.length), 1)[0], nums = new Set([55]);
    const num = c => { let n; do n = c === "proto" ? 1 + Math.floor(r() * 19) : c === "gt" ? 20 + Math.floor(r() * 59) : 80 + Math.floor(r() * 19); while (nums.has(n)); nums.add(n); return n; };
    const drv = () => { const d = E24_DRIVERS.slice(); return [pick(d), pick(d), pick(d)]; };
    const mk = (P, cls, me, extra) => Object.assign({ i: R.cars.length, P: P, cls: cls, me: !!me, laps: 0, tLast: 0, tNext: 0, lapDur: 0, fuel: E24_TANK, tyre: { c: "medium", km: 0, cold: false, stops: 0 },
      mode: "race", dmg: P.tests.map(() => 0), out: false, fin: false, pits: 0, pitT: 0, fuelUsed: 0, best: null, bestLap: 0, last: null, drv: drv(), drvI: 0, drvT: 0, drvPace: [1, 1.003, 1.006],
      stintT0: 0, stintLaps: 0, stintF: 0, pace: 1, traf: E24_CLS_ORDER.indexOf(cls) === 0 ? 1 : E24_CLS_ORDER.indexOf(cls) === 1 ? 0.6 : 0.3, pend: null, pitIn: null, hist: [] }, extra || {});
    // the player: number 55, the team drivers, the plan
    const me = mk(o.me, myCls, true, { no: o.number || 55, team: o.name || "Prairie Engine Works", mode: R.plan.mode, drvPace: [1, 1.0025, 1.0065], pace: E24_CLASSES[myCls].k });
    me.tyre.c = R.plan.tyre; me.fuel = R.plan.fuel === "full" ? E24_TANK : null; me.stints = []; me.lapLog = []; me.posLog = [];
    R.cars.push(me);
    for (const c of E24_CLS_ORDER) {
      const pool = E24_CLASSES[c].pool.slice(), n = E24_FIELD[c] - (c === myCls ? 1 : 0);
      for (let k = 0; k < n && pool.length; k++) {
        let P = null; while (!P && pool.length) P = e24Ai(pick(pool), c, trackId); if (!P) break;
        const a = mk(P, c, false, { no: num(c), team: pick(teams) || "Privateer", pace: E24_CLASSES[c].k * (1 + clamp(e24Gauss(r) * 0.006, -0.012, 0.014)) });   // a prototype's own aero and slicks: k
        a.aggr = r() < 0.25; a.mode = a.aggr ? "push" : "race"; a.dbl = c === "stock" && r() < 0.5; a.tyre.c = c === "proto" && r() < 0.4 ? "soft" : "medium";
        R.cars.push(a);
      }
    }
    // the grid: by qualifying pace (a lap on fresh softs), player included
    const q = R.cars.map(c => ({ c: c, t: c.P.modes.push.lap * c.pace * (1 + Math.abs(e24Gauss(r)) * 0.004) })).sort((a, b) => a.t - b.t);
    q.forEach((x, k) => { const c = x.c; c.grid = k + 1; c.tLast = -((q.length - k) * 0.9); });   // pole crossed the line first
    if (!me.fuel) me.fuel = Math.min(E24_TANK, e24Need(R, me));
    R.cars.forEach(c => { c.tNext = c.tLast + e24Lap(R, c, 0) * 1.03; c.lapDur = c.tNext - c.tLast; });
    // safety cars: a few at random through the day and night, plus what the incidents call
    if (R.scOn) { let t = 1800 + r() * 3600; while (t < E24_DUR - 1800) { R.timed.push({ t: t, k: "sc" }); t += -Math.log(1 - r() * 0.999) * 3600 / E24_SC_RATE + 900; } }
    for (let h = 1; h < 24; h++) R.timed.push({ t: h * 3600, k: "hour", h: h });
    const skyAt = hh => ((hh - E24_START + 24) % 24) * 3600;
    R.timed.push({ t: skyAt(21.4), k: "sky", s: "sunset" }, { t: skyAt(22.3), k: "sky", s: "night" }, { t: skyAt(4.8), k: "sky", s: "dawn" }, { t: skyAt(5.45), k: "sky", s: "sunrise" });
    R.timed.sort((a, b) => a.t - b.t);
    e24Feed(R, 0, "start", `Green flag — ${R.cars.length} cars, ${me.no} starts P${me.grid} (${E24_CLASSES[myCls].n} P${R.cars.filter(c => c.cls === myCls && c.grid < me.grid).length + 1})`, true, true);
    me.stints.push({ drv: me.drv[0], c: me.tyre.c, t0: 0, laps: 0, fuel: 0, modeT: { push: 0, race: 0, save: 0 } });
    R.prevPos = e24Pos(R, me);
    if (R.plan.auto) { e24Chief(R, me, 0); me.tyre.c = R.plan.tyre; me.stints[0].c = me.tyre.c; }   // the crew chief picks the starting tyres and mode too
    return R;
  }
  function e24Feed(R, t, k, txt, me, stop) { R.feed.push({ t: t, k: k, txt: txt, me: !!me, n: ++R.seq }); if (stop) R.stopN = R.seq; if (R.feed.length > 500) R.feed.splice(0, R.feed.length - 500); }
  /* fuel for the stint the plan asks for, from the lap the car is doing now */
  function e24Need(R, c) { const P = c.P, lf = P.modes[c.mode].fuel, lap = P.modes[c.mode].lap * c.pace, pl = R.plan;
    const left = Math.max(0, R.dur - c.tLast), stintS = pl.stint > 0 ? Math.min(pl.stint * 60, left + lap) : left + lap;
    return Math.min(E24_TANK, (Math.ceil(stintS / lap) + 1.5) * lf); }
  /* the lap this car is about to do: mode, tyres, fuel load, the dark, the driver, traffic */
  function e24Lap(R, c, t) {
    const P = c.P, M = E24_MODES[c.mode], sky = e24Sky(t), Ty = E24_TYRES[c.tyre.c];
    const life = Ty.km * clamp(1 - 0.012 * (sky.amb - 20), 0.7, 1.25) / M.tyre, w = c.tyre.km / life;
    const grip = w <= 1 ? 1 - 0.035 * w : Math.max(0.8, 0.965 - 0.12 * (w - 1));
    let L = P.modes[c.mode].lap + P.slope * (ROAD_TYRES.semi.mu * Ty.mu * grip - ROAD_TYRES.semi.mu);
    L *= (1 + 0.0003 * c.fuel * 0.75) * (1 + 0.008 * sky.n) * c.pace * c.drvPace[c.drvI % 3] * (1 + e24Gauss(R.r) * 0.0022);
    L += L * R.r() * 0.012 * c.traf * (c.me ? 1 : 0.9);
    if (c.tyre.cold) L *= 1.012;
    return L;
  }
  /* order: laps, then who crossed first; retired cars after the runners */
  function e24Order(R, cls) { return R.cars.filter(c => !cls || c.cls === cls).sort((a, b) => (a.out - b.out) || (b.laps - a.laps) || (a.tLast - b.tLast)); }
  function e24Pos(R, c) { const o = e24Order(R), k = e24Order(R, c.cls); return { all: o.indexOf(c) + 1, cls: k.indexOf(c) + 1, ahead: k[k.indexOf(c) - 1] || null, behind: k[k.indexOf(c) + 1] || null }; }
  const e24Name = c => `#${c.no} ${c.team}`;
  /* a car crosses the line at c.tNext */
  function e24Cross(R, c) {
    const t = c.tNext, dt = c.lapDur, P = c.P, me = c.me, wasPit = c.pitIn, wasSc = c.scLap;
    c.laps++; c.tLast = t;
    const green = !wasPit && !wasSc && !c.slow;
    if (green && !c.tyre.cold && (c.best == null || dt < c.best)) { c.best = dt; c.bestLap = c.laps; }
    c.last = dt; c.slow = false; c.wasPit = !!wasPit; c.scLap = false; c.tyre.cold = false; c.pitIn = null;
    // fuel, tyres, damage over the lap just done
    const scK = R.sc ? 0.55 : 1, burn = P.modes[c.mode].fuel * scK;
    c.fuel = Math.max(0, c.fuel - burn); c.fuelUsed += burn; c.tyre.km += R.len / 1000 * (R.sc ? 0.5 : 1);
    const sky = e24Sky(t), rt = e24Rates(P, sky.amb, c.mode), hrs = dt / 3600;
    for (let i = 0; i < rt.r.length; i++) c.dmg[i] += rt.r[i] * hrs * scK;
    c.drvT += dt; c.stintLaps++; if (me) { const st = c.stints[c.stints.length - 1]; st.laps++; st.fuel += burn; st.modeT[c.mode] += dt; c.lapLog.push([Math.round(t), +dt.toFixed(2), wasPit ? 1 : wasSc || R.sc ? 2 : 0]); }
    if (t >= R.dur) { c.fin = true; c.tNext = Infinity; if (me) e24Feed(R, t, "flag", `Chequered flag — ${c.laps} laps`, true, true); e24Check(R, c); return; }
    // engine: does something let go this lap?
    let fail = null;
    for (let i = 0; i < c.dmg.length; i++) if (c.dmg[i] >= 1) { fail = i; break; }
    if (fail == null && R.r() < 1 - Math.exp(-rt.haz * hrs * scK)) { let x = R.r() * rt.sum; fail = 0; while (fail < rt.r.length - 1 && (x -= rt.r[fail]) > 0) fail++; }
    if (fail != null) {
      const tst = P.tests[fail], fx = E24_FIX[tst.id], fixP = fx ? fx[0] * clamp(1 - c.dmg[fail], 0, 1) : 0.04;
      if (R.r() < fixP) { const mins = fx ? fx[1] : 12; c.pend = { why: "fix", id: tst.id, mins: mins * (0.8 + 0.4 * R.r()), what: fx ? fx[2] : "it was found and fixed" }; c.dmg[fail] = 0; c.slow = true;
        e24Feed(R, t, me ? "fail" : "ai", me ? `${tst.name} — limping to the pits (${c.pend.what})` : `${e24Name(c)} (${E24_CLASSES[c.cls].n}) crawls to the pits — ${tst.name.toLowerCase()}`, me, me || c.cls === R.myCls); }
      else { c.out = true; c.tNext = Infinity; c.dnf = { t: t, id: tst.id, name: tst.name, sub: tst.sub, h: t / 3600 };
        e24Feed(R, t, me ? "dnf" : "ai", me ? `RETIRED — ${tst.name.toLowerCase()} let go after ${c.laps} laps` : `${e24Name(c)} (${E24_CLASSES[c.cls].n}) is out — ${tst.name.toLowerCase()}`, me, true);
        if (!me && R.scOn && !R.sc && R.r() < 0.25) e24ScGo(R, t, "oil down at " + (R.r() < 0.5 ? "the hairpin" : "turn " + (2 + Math.floor(R.r() * 6))));
        e24Check(R, c); return; }
    }
    // the rest of racing: a puncture, an off, a knock
    if (!c.pend) {
      const night = sky.n, err = E24_MODES[c.mode].err, w = c.tyre.km / (E24_TYRES[c.tyre.c].km / E24_MODES[c.mode].tyre);
      const pP = 1 - Math.exp(-(0.022 * (w > 1 ? 4 : 1)) * hrs), pO = 1 - Math.exp(-0.02 * err * (1 + night) * hrs), pK = 1 - Math.exp(-0.007 * err * (1 + 0.5 * night) * hrs), x = R.r();
      if (x < pP) { c.pend = { why: "punct", mins: 0 }; c.slow = true; e24Feed(R, t, me ? "inc" : "ai", me ? "Puncture — three-wheeling back to the pits" : `${e24Name(c)} — puncture`, me, me); }
      else if (x < pP + pO) { const lost = 8 + R.r() * 30; c.offT = lost; e24Feed(R, t, me ? "inc" : "ai", me ? `${c.drv[c.drvI % 3]} runs wide${night > 0.5 ? " in the dark" : ""} — ${Math.round(lost)} s in the gravel` : `${e24Name(c)} off at ${R.r() < 0.5 ? "the hairpin" : "the sweeper"}`, me, false);
        if (R.scOn && !R.sc && lost > 30 && R.r() < 0.35) e24ScGo(R, t, "a car beached in the gravel"); }
      else if (x < pP + pO + pK) { c.pend = { why: "fix", mins: 3 + R.r() * 7, what: "bodywork after contact" }; e24Feed(R, t, me ? "inc" : "ai", me ? "Contact in traffic — the nose is hanging off" : `${e24Name(c)} — contact, pitting for a nose`, me, me); }
    }
    if (me && R.plan.auto) e24Chief(R, c, t);
    // pits
    let box = !!c.pend;
    const lf = P.modes[c.mode].fuel, left = R.dur - t, lapNow = P.modes[c.mode].lap * c.pace;
    const canFinish = c.fuel >= (left / lapNow + 1) * lf;
    if (lf > E24_TANK) { c.out = true; c.tNext = Infinity; c.dnf = { t: t, id: null, name: "Out of fuel", sub: "a lap burns more than a full tank", h: t / 3600 };
      e24Feed(R, t, me ? "dnf" : "ai", me ? `RETIRED — it burns more than a ${E24_TANK} L tank in one lap` : `${e24Name(c)} is out — dry tank`, me, true);
      e24Check(R, c); return; }
    if (c.fuel < lf * 1.25) box = true;
    if (me) { const pl = R.plan;
      if (pl.box) box = true;
      if (!canFinish && pl.stint > 0 && t - c.stintT0 >= pl.stint * 60 - lapNow * 0.5) box = true;
      if (!canFinish && R.sc && pl.scPit && c.fuel < E24_TANK * 0.5 && t - c.stintT0 > 900) box = true; }
    else if (!canFinish && R.sc && c.fuel < E24_TANK * 0.45 && t - c.stintT0 > 900) box = true;
    let lap = e24Lap(R, c, t);
    if (c.offT) { lap += c.offT; c.offT = 0; }
    if (box) lap += e24Stop(R, c, t);
    // the next lap: behind the safety car everyone runs its pace and closes up to the car ahead on the road
    if (R.sc && t < R.sc.until) { const ahead = R.cars.reduce((b, o) => o !== c && !o.out && !o.fin && o.tLast <= t && (!b || o.tLast > b.tLast) ? o : b, null), g = ahead ? t - ahead.tLast : 99;
      lap = Math.max(lap, R.sc.lapT - Math.min(R.sc.lapT * 0.6, 0.8 * Math.max(0, g - 1.4))); c.scLap = true; }
    c.lapDur = lap; c.tNext = t + lap;
    if (me) e24Check(R, c);
  }
  /* the crew chief (plan.auto, since 1.76.102.0): calls the player's strategy at each of their line crossings, with the same switches the
     player has. Engine mode: Race, unless (a) the safety car is out, where Conserve costs no time; (b) the engine is running hot enough
     that Conserve buys real reliability, or a part would wear out before the flag; (c) nobody in class is close enough ahead or behind
     for the pace to matter over the hours left, so it nurses the car home; or (d) the engine is safe and a place is in reach, and it
     pushes. Tyres: the compound, and single or double stints, that cost the least time over a tank of fuel, counting the grip lost as
     they wear, the 22 s change and the puncture risk past their life. Stints run to the fuel on a full tank. Tunables in E24_CHIEF. */
  function e24Chief(R, c, t) {
    const P = c.P, pl = R.plan, K = E24_CHIEF, sky = e24Sky(t), left = Math.max(0, R.dur - t), hrs = left / 3600, md = P.modes;
    const rt = { push: e24Rates(P, sky.amb, "push"), race: e24Rates(P, sky.amb, "race"), save: e24Rates(P, sky.amb, "save") };
    const wearOk = m => { for (let i = 0; i < rt[m].r.length; i++) if (c.dmg[i] + rt[m].r[i] * hrs >= K.wear) return false; return true; };
    let mode = "race", why = "race", say = "";
    if (R.sc) { mode = "save"; why = "sc"; say = "conserve behind the safety car"; }
    else {
      const pos = e24Pos(R, c), lapsLeft = left / (md.race.lap * c.pace), gap = (a, b) => (a.laps - b.laps) * md.race.lap * c.pace + (b.tLast - a.tLast);   // a leads b by this many seconds
      const run = o => o && !o.out && !o.fin, gA = run(pos.ahead) ? gap(pos.ahead, c) : Infinity, gB = run(pos.behind) ? gap(c, pos.behind) : Infinity;
      const dS = (md.save.lap - md.race.lap) * c.pace * lapsLeft, dP = (md.race.lap - md.push.lap) * c.pace * lapsLeft;
      const far = (dS * K.cruise + K.margin) * (c.chiefWhy === "cruise" ? 0.6 : 1), near = K.margin * (c.chiefWhy === "push" ? 1.5 : 1);   // a call sticks until the gap has clearly changed
      if (!wearOk("race")) { mode = "save"; why = "wear"; say = "conserve, nursing a worn part to the flag"; }
      else if (rt.race.haz - rt.save.haz > K.dSave) { mode = "save"; why = "hot"; say = "conserve, it is running too close to the edge"; }
      else if (gB > far && gA > far) { mode = "save"; why = "cruise"; say = "conserve, nobody close enough to race"; }
      else if (wearOk("push") && rt.push.haz - rt.race.haz < K.dPush && (gA < dP * K.reach + near || gB < near)) { mode = "push"; why = "push"; say = gB < near && !(gA < gB) ? "push, #" + pos.behind.no + " is right behind" : "push, #" + pos.ahead.no + " is in reach"; }
      else say = "back to race pace";
    }
    if (why !== c.chiefWhy) { if (c.chiefWhy != null && t > 0) e24Feed(R, t, "chief", "Crew chief: " + say, true, false); c.chiefWhy = why; }
    pl.mode = mode; c.mode = mode;
    // tyres for the next stop, per lap: grip lost to wear, the change, punctures past the tyre's life
    const lf = md[mode].fuel, laps = Math.max(1, Math.floor(E24_TANK / lf - 1.25)), km = laps * R.len / 1000, tf = clamp(1 - 0.012 * (sky.amb - 20), 0.7, 1.25) / E24_MODES[mode].tyre;
    const grip = w => w <= 1 ? 1 - 0.0175 * w : (0.9825 + (w - 1) * 0.965 - 0.06 * (w - 1) * (w - 1)) / w;   // the mean of the wear curve in e24Lap from new to w
    let best = null;
    for (const ty in E24_TYRES) for (const chg of ["every", "double"]) { const Ty = E24_TYRES[ty], n = chg === "double" ? 2 : 1, w = km * n / (Ty.km * tf);
      if (chg === "double" && km / Ty.km > 0.8) continue;   // the crew changes a set that worn anyway
      const lapS = md[mode].lap * c.pace, over = Math.max(0, w - 1) / w * laps * n * lapS / 3600;   // hours run past the tyre's life
      const cost = (P.slope * ROAD_TYRES.semi.mu * (Ty.mu * grip(w) - 1) * laps * n + 22 + 0.066 * over * K.punct) / (laps * n);
      if (!best || cost < best.cost) best = { cost: cost, ty: ty, chg: chg }; }
    if (best) { pl.tyre = best.ty; pl.chg = best.chg; }
    pl.stint = 0; pl.fuel = "full"; pl.scPit = true;
  }
  /* a pit stop at the line: what it does and how long it takes (lane + stationary) */
  function e24Stop(R, c, t) {
    const me = c.me, pl = R.plan, why = c.pend, parts = [];
    let fix = 0;
    if (why && why.why === "fix") { fix = why.mins * 60; parts.push(why.what); }
    const tyres = (why && why.why === "punct") || (me ? pl.chg === "every" || c.tyre.stops >= 1 : !c.dbl || c.tyre.stops >= 1) || c.tyre.km / E24_TYRES[c.tyre.c].km > 0.8;
    const newC = me ? pl.tyre : c.tyre.c;
    const need = me ? (pl.fuel === "full" ? E24_TANK : e24Need(R, c)) : E24_TANK;
    const lf = c.P.modes[c.mode].fuel, toEnd = Math.max(0, (R.dur - t) / (c.P.modes[c.mode].lap * c.pace) + 1.5) * lf;
    const add = Math.max(0, Math.min(E24_TANK, need, toEnd + 2) - c.fuel);
    const swap = c.drvT >= 100 * 60 || (me && pl.box && pl.swap);
    const crawl = why && why.why !== "box" ? c.P.modes[c.mode].lap * c.pace * 0.45 : 0;   // limping round to the pit entry
    const stat = (Math.max(add / 2.6, swap ? 14 : 0, fix) + (tyres ? 22 : 0) + 4) * (me && R.pitK ? R.pitK : 1), total = R.lane + stat + crawl;   // pitK: the shop crew (career)
    c.fuel += add; c.pits++; c.pitT += total; c.tyre.stops++;
    if (tyres) { c.tyre = { c: newC, km: 0, cold: true, stops: 0 }; parts.push(`${E24_TYRES[newC].n.toLowerCase()} tyres`); } else parts.push("tyres stay on");
    if (add > 0.5) parts.push(`${Math.round(add)} L`);
    if (swap) { c.drvI++; c.drvT = 0; parts.push(`${c.drv[c.drvI % 3]} in`); }
    c.pitIn = { t: t, stat: stat, total: total, fix: fix > 0 }; c.pend = null;
    if (me) { pl.box = false; pl.swap = false;
      c.stints[c.stints.length - 1].t1 = t;
      c.stints.push({ drv: c.drv[c.drvI % 3], c: c.tyre.c, t0: t + total, laps: 0, fuel: 0, modeT: { push: 0, race: 0, save: 0 } });
      e24Feed(R, t, "pit", `Pit stop ${c.pits} — ${parts.join(", ")} · ${Math.round(stat)} s stationary`, true, true); }
    c.stintT0 = t + total; c.stintLaps = 0;
    return total;
  }
  function e24ScGo(R, t, why) { if (R.sc || t > R.dur - 1200) return; const lead = e24Order(R)[0];
    R.sc = { t0: t, until: t + (360 + R.r() * 540), lapT: (lead ? lead.P.modes.race.lap : 110) * 1.45 }; R.scN++;
    e24Feed(R, t, "sc", `SAFETY CAR — ${why}`, false, true); }
  /* the player's position: overtakes and lost places go in the feed */
  function e24Check(R, c) { if (!c.me) return; const p = e24Pos(R, c), q = R.prevPos;
    if (q && !c.out && p.cls !== q.cls) { const up = p.cls < q.cls, who = up ? p.behind : p.ahead;
      if (!c.wasPit && !(who && (who.pitIn || who.wasPit))) e24Feed(R, c.tLast, "pass", up ? `Up to P${p.cls} in ${E24_CLASSES[c.cls].n}${who ? " — past " + e24Name(who) : ""}` : `Down to P${p.cls} in ${E24_CLASSES[c.cls].n}${who ? " — " + e24Name(who) + " gets by" : ""}`, true, false); }
    c.posLog.push([Math.round(c.tLast), p.all, p.cls]); R.prevPos = p; }
  function e24Timed(R, ev) {
    const t = ev.t;
    if (ev.k === "sc") { if (R.scOn) e24ScGo(R, t, ["debris on the back straight", "a stranded car at the hairpin", "oil at the esses", "a crash in the sweeper", "a deer on the track"][Math.floor(R.r() * 5)]); }
    else if (ev.k === "scEnd") { if (R.sc) { R.sc = null; e24Feed(R, t, "sc", "Green flag — safety car in", false, true); } }
    else if (ev.k === "hour") { const me = R.cars[0], p = e24Pos(R, me);
      e24Feed(R, t, "hour", `Hour ${ev.h} — ${me.out ? "out" : "P" + p.all + " overall, P" + p.cls + " in " + E24_CLASSES[me.cls].n + ", " + me.laps + " laps"}`, false, false); }
    else if (ev.k === "sky") e24Feed(R, t, "sky", { sunset: "Sunset — the sky goes orange over the canola", night: "Night — headlights on, the pits lit up", dawn: "First light in the east", sunrise: "Sunrise — the track rubbers back in" }[ev.s], false, true);
  }
  /* run the race forward to tTarget, at most maxN events; returns the events done. opt.stop: halt after a feed item marked stop */
  function enduroStep(R, tTarget, maxN, stop) {
    let n = 0; const stop0 = R.stopN || 0; tTarget = Math.min(tTarget, R.dur + 4 * 3600);
    while (n < (maxN || 1e9) && !R.done) {
      let c = null; for (const k of R.cars) if (!k.out && !k.fin && (!c || k.tNext < c.tNext)) c = k;
      const sc = R.sc && R.sc.until, ev = R.timed[0], tc = c ? c.tNext : Infinity, te = ev ? ev.t : Infinity, ts = sc || Infinity;
      const tn = Math.min(tc, te, ts);
      if (!isFinite(tn)) { R.done = true; break; }
      if (tn > tTarget) { R.t = Math.max(R.t, tTarget); break; }
      R.t = tn; n++;
      if (ts === tn) e24Timed(R, { t: tn, k: "scEnd" });
      else if (te === tn) e24Timed(R, R.timed.shift());
      else e24Cross(R, c);
      if (!R.cars.some(k => !k.out && !k.fin)) { R.done = true; break; }
      if (stop && (R.stopN || 0) > stop0) break;
    }
    return n;
  }
  /* where every car is right now: lap fraction (0..1) and whether it sits in the pit lane */
  function enduroWhere(R, t) {
    return R.cars.map(c => { if (c.out) return { out: true, i: c.i };
      if (c.fin) return { f: 0, pit: false, i: c.i, fin: true };
      const d = Math.max(1e-3, c.tNext - c.tLast), f = clamp((t - c.tLast) / d, 0, 1);
      if (c.pitIn) { const lane = R.lane, stat = c.pitIn.stat, u = t - c.tLast;
        if (u < stat + lane) return { f: 0, pit: true, inLane: u < stat ? 0 : (u - stat) / lane, i: c.i, fix: c.pitIn.fix };
        return { f: clamp((u - stat - lane) / Math.max(1, d - stat - lane), 0, 1), i: c.i }; }
      return { f: f, i: c.i }; });
  }
  /* the result: classification (classified = took the flag with 70% of the class winner's laps) */
  function enduroResult(R) {
    const all = e24Order(R), res = all.map((c, k) => ({ i: c.i, no: c.no, team: c.team, cls: c.cls, eng: c.me ? "" : (c.P.name || ""), laps: c.laps, km: Math.round(c.laps * R.len / 100) / 10, best: c.best, pits: c.pits,
      out: c.out, dnf: c.dnf ? { h: +c.dnf.h.toFixed(1), name: c.dnf.name } : null, me: c.me, pos: k + 1 }));
    for (const cl of E24_CLS_ORDER) { const L = res.filter(x => x.cls === cl), w = L[0]; let k = 0; for (const x of L) { x.classified = !x.out && w && x.laps >= 0.7 * w.laps; x.posCls = ++k; } }
    return res;
  }
  /* =====================================================================
     SALT, THE AUTO DRIVER: in sim-late.js, not in the page (since 1.76.139.0).
     Here: the auto driver's foot (lsrFoot).
     build.js writes this file to sim-late.js; the app fetches it once the garage is up and runs it
     inside the ENGINE_SIM closure (simLateRun in sim/tunemap.js), so it sees every physics name as
     if it were still in the page. sim/salt.js keeps everything else, the run included: the class records (lsrRecord, read by Records and warmed at boot) are set by timing a salt pass, so lsrRun stays in the page.
     ===================================================================== */
  /* the auto driver's foot (the app's Auto driver, and the rest of a skipped run): flat out, but once the tyres slip it holds
     them on the slip where the salt grips hardest (8%, the peak of mu() above) instead of waiting for 13% and chopping the
     throttle; off a little more for a light nose, off hard when the car is getting loose. f(st, dt) gives 0..1 for the next dt
     seconds (20 ms steps, shorter on a frame). Worth 4-6 mph through the mile on cars with more power than grip (an outlaw
     or pro-mod motor in an altered, a roadster or a lakester); the same on a car that never spins. lsrPass keeps the old
     foot, so the seeded record book and the Top gear helper are where they were. */
  function lsrFoot() {
    let thr = 1;
    return function (st, dt) {
      if (st.phase !== "run") return 1;
      const k = clamp((dt || 0.02) / 0.02, 0, 12.5), sT = 0.08;
      if (st.slip > sT || thr < 1) thr += 0.6 * (sT - st.slip) * k; else thr += 0.05 * k;
      if (st.light < 0.5) thr -= 0.05 * k;
      if (st.loose > 0.3) thr *= Math.pow(st.loose > 0.5 ? 0.75 : 0.88, k);
      thr = clamp(thr, 0.04, 1); return thr;
    };
  }
  /* =====================================================================
     BOAT DRAGS, THE PASS ITSELF: in sim-late.js, not in the page (since 1.76.139.0).
     Here: the time-stepped pass (boatRun, boatPass), boatPrep, the prop shop (boatTune) and the AI boats (boatGuess).
     build.js writes this file to sim-late.js; the app fetches it once the garage is up and runs it
     inside the ENGINE_SIM closure (simLateRun in sim/tunemap.js), so it sees every physics name as
     if it were still in the page. sim/boat.js keeps the classes, hulls, impellers, the trim range and the water (boatWater: the team card's forecast reads it).
     ===================================================================== */
  /* veh: { cls, pitch (in) | imp (0..3), gear (crank:prop), trim (deg at the start), redline, idle, seed, noFail, water, wornAt?, rt? (auto's light), mass? } */
  function boatRun(res, veh) {
    const C0 = BOAT_CLASSES[veh && veh.cls] || BOAT_CLASSES.outboard, HU = BOAT_HULLS[C0.hull], jet = C0.drive === "jet";
    const v = Object.assign({ cls: C0.id, pitch: C0.pitch ? C0.pitch[2] : 0, imp: C0.imp || 1, gear: C0.gear[2], trim: 0, redline: 6000, idle: 800, seed: 1, noFail: false, water: null }, veh || {});
    const W0 = v.water || boatWater(v.seed), rng = pullRng(v.seed), g = 9.81, rho = 1000;
    const rpms = res.rpms, tq = res.torque, NR = rpms.length;
    const interp = (arr, r) => { if (r <= rpms[0]) return arr[0]; if (r >= rpms[NR - 1]) return arr[NR - 1]; let i = 1; while (rpms[i] < r) i++; const f = (r - rpms[i - 1]) / (rpms[i] - rpms[i - 1]); return arr[i - 1] + f * (arr[i] - arr[i - 1]); };
    const torqueAt = r => r <= rpms[0] ? tq[0] * Math.max(0.3, r / rpms[0]) : interp(tq, r);
    const turbo = res.aspKind === "turbo" && Array.isArray(res.naTorque) && res.naTorque.length === NR;
    const pkRpm = res.peakHpRpm || v.redline * 0.85, VdL = Math.max(0.2, (res.VdEq || res.Vd || 2000) / 1000);
    const Gr = clamp(+v.gear || C0.gear[2], 0.3, 4), lim = v.redline * 1.03, Tfric = 0.1 * (res.peakTq || 300);
    const Ie = 0.1 + 0.07 * VdL + 0.03 / (Gr * Gr);
    const engKg = Math.max(20, +res.kg || 200), m = (v.mass || (C0.hullKg + C0.rigKg + 90 + engKg)), Wt = m * g;
    const pitchIn = jet ? 0 : clamp(+v.pitch || C0.pitch[2], C0.pitch[0], C0.pitch[1]), Pm = pitchIn * 0.0254;
    const Kq = jet ? 0 : C0.Kq0 * Math.pow(pitchIn / C0.pitch[2], 2), Kt = jet ? 0 : 1.955 * 2 * Math.PI * Kq / Pm;
    const imp = BOAT_IMP[clamp(Math.round(+v.imp) || 0, 0, 3)], cj = imp[2], A = C0.A || 0.0042;
    const Tc0 = C0.Tc0 * Wt, vc = 12;
    const opt = HU.opt, tr = boatTrimRange();
    const st = { t: 0, x: 0, v: 0, rpm: v.idle, n: 0, thr: 0, foot: 0, trim: clamp(+v.trim || 0, tr[0], tr[1]), trimCmd: 0, phase: "line", done: false, finished: false,
      rt: null, et: null, mph: null, marks: [], slip: 0, blown: false, blowN: 0, blowT: 0, T: 0, R: 0, spool: 0, pl: 0, bow: 0, alpha: 0, Lr: 0, LrMax: 0, porp: 0, porpT: 0, walk: 0, walkT: 0,
      air: 0, airT: 0, hops: 0, kick: 0, hopV: 0, cool: 58, coolPeak: 58, debris: null, dnf: null, broke: null, failKind: null, limT: 0, peakRpm: 0, maxV: 0, trace: [], blowAt: [], humpT: null, planeT: null, vy: 0, lastTr: -1, acc: 0, doneT: null };
    let failAt = Infinity, failKind = null, loadT = 0, nextHop = 0, airLeft = 0, lrT = 0;
    if (!v.noFail && res.fails && res.fails.length) { const t0 = (res.tests || []).find(x => x.name === res.fails[0]); failKind = t0 ? t0.id : "rod_tension"; failAt = 0.5 + rng() * 4.5; }
    // an engine run near its limits can let go at full load: each part past 80% of its limit adds a little risk per second (a rival's 4% a pass, roughly, at the edge)
    const hz = (res.tests || []).map(t => ({ id: t.id, h: Math.max(0, (t.util || 0) - 0.8) * 0.025 })).filter(q => q.h > 0), hzTot = hz.reduce((a, q) => a + q.h, 0);
    const hzR = pullRng(((v.seed >>> 0) ^ 0x7A11ED) >>> 0); let hzAcc = 0; const hzRoll = -Math.log(Math.max(1e-9, hzR()));
    const limTrip = 0.9 + rng() * 0.9;
    const deb = !v.noFail && rng() < 0.035 ? { x: 40 + rng() * 230, kind: jet ? "grate" : "weed" } : null;
    const hopR = pullRng(((v.seed >>> 0) ^ 0x5EA5) >>> 0); nextHop = 0.4 + hopR() * 1.2;
    // the hull's drag as a fraction of the boat's weight at speed u: hump, planing, wetted friction (the hydro's falls away once it props-rides)
    function hullRW(u, deg, lr) {
      const f = u / HU.vh, hump = f < 1 ? HU.H * f * f : HU.H * Math.exp(-Math.pow((f - 1) / 0.75, 2));
      const pl = boatSm(0.6, 1.6, f), ride = HU.pr ? 1 - 0.6 * boatSm(HU.pr * 0.7, HU.pr * 1.25, u) : 1;
      const tOpt = boatLerp(-2, opt, boatSm(0.8, 2.2, f)), off = deg - tOpt;
      const trimK = 1 + (f < 1.4 ? 0.06 * Math.max(0, deg + 2) : 0) + 0.035 * off * off * pl;
      return (hump * (1 + 0.05 * (deg + 2)) + pl * (HU.p0 + HU.cw * u * u * ride) * trimK * (1 - 0.3 * Math.min(1, lr))) * (1 + 0.25 * st.porp + 0.15 * st.walk);
    }
    function sub(dt) {
      st.foot += (st.thr > st.foot ? 1 / 0.12 : -1 / 0.08) * dt; st.foot = clamp(st.foot, 0, 1);
      const live = !st.done && !st.dnf && !st.broke, thr = live ? st.foot : 0;
      st.trim = clamp(st.trim + st.trimCmd * 3.2 * dt, tr[0], tr[1]);
      st.t += dt;
      if (st.phase === "line" && thr > 0.15) { st.phase = "run"; st.rt = st.t; }
      const run = st.phase !== "line";
      // the engine: full-load torque (a turbo spools with load), the limiter, pumping losses off throttle
      let full = torqueAt(st.rpm);
      if (turbo) { st.spool += (thr * clamp(st.rpm / pkRpm, 0.2, 1.1) - st.spool) * Math.min(1, dt / 0.7); const na = interp(res.naTorque, st.rpm); full = na + (full - na) * clamp(st.spool, 0, 1); }
      let Te = thr * full - (1 - thr) * Tfric * clamp(st.rpm / v.redline, 0.3, 1);
      if (st.rpm > v.redline) Te = Math.min(Te, thr * full * clamp((lim - st.rpm) / (lim - v.redline), 0, 1));
      if (st.broke) Te = -Tfric * 3;
      const n = st.rpm / 60 / Gr; st.n = n;
      // chop: the hull hops off a wave now and then — the prop airs out for a moment, the bow gets a kick
      if (run && st.v > 10 && W0.chop > 0.02 && st.t >= nextHop) { const k = W0.chop * (0.3 + 0.7 * hopR()); nextHop = st.t + (0.25 + hopR() * 1.4) / (W0.chop * (0.5 + st.v / 25));
        st.kick = Math.max(st.kick, 2.6 * k); st.hopV = Math.max(st.hopV, k * (0.4 + st.v / 60)); if (k > 0.22) { airLeft = Math.max(airLeft, 0.05 + 0.25 * k); st.hops++; } }
      st.kick *= Math.exp(-dt / 0.25); st.hopV *= Math.exp(-dt / 0.3);
      if (airLeft > 0) { airLeft -= dt; st.airT += dt; } st.air = airLeft > 0 ? 1 : 0;
      const dbr = st.debris && !st.debris.cleared ? (jet ? 0.78 : 0.9) : 1;
      // what the water will hold before the blades let go: more with speed, less trimmed out, almost nothing in the air
      const Tcav = Tc0 * (1 + Math.pow(st.v / vc, 2)) * (1 - 0.05 * Math.max(0, st.trim)) * (st.air ? 0.08 : 1) * (1 - 0.35 * st.porp * (0.5 + 0.5 * Math.sin(st.t * 9))) * (st.debris && jet ? 0.6 : 1);
      let Tp, Qp;
      if (jet) { const Vj = cj * n; Tp = rho * A * Vj * Math.max(0, Vj - st.v); Qp = n > 0.1 ? 0.5 * rho * A * Vj * Math.max(0, Vj * Vj - 0.6 * st.v * st.v) / 0.85 / (2 * Math.PI * n) : 0; st.slip = Vj > 0.5 ? clamp(1 - st.v / Vj, -0.5, 1) : 1; }
      else { const Vth = Pm * n, s = Vth > 0.2 ? clamp(1 - st.v / Vth, -0.3, 1) : 1; st.slip = s; Tp = Kt * n * n * Math.max(0, s); Qp = Kq * n * n * (0.45 + 0.55 * Math.max(0, s)); }
      const ratio = Tp / Math.max(1, Tcav);
      if (!st.blown && ratio > 1.0 && run) { st.blown = true; st.blowN++; if (st.blowAt.length < 12) st.blowAt.push(+st.x.toFixed(1)); }
      else if (st.blown && (ratio < 0.86 || !run)) st.blown = false;
      if (st.blown) { const keep = Tcav * (0.62 - 0.12 * clamp(ratio - 1, 0, 1)) / Math.max(1, Tp); Tp *= keep; Qp *= Math.pow(keep, 0.85); st.blowT += dt; }
      Tp *= dbr; st.T = Tp;
      const Qc = Qp / Gr / 0.95;
      st.rpm += (Te - Qc) / Ie * dt * 60 / (2 * Math.PI);
      if (st.rpm < v.idle * 0.85 && !st.broke) st.rpm = v.idle * 0.85; if (st.rpm < 0) st.rpm = 0;
      if (st.rpm > v.redline * 1.005 && (st.air || st.blown)) st.limT += dt;   // bouncing off the limiter with the prop unloaded floats the valves
      st.peakRpm = Math.max(st.peakRpm, st.rpm);
      // the hull: trim, attitude, aero lift on the bow; porpoising, chine walk, a nose that gets light
      const f = st.v / HU.vh; st.pl = boatSm(0.6, 1.6, f);
      const tOpt = boatLerp(-2, opt, boatSm(0.8, 2.2, f)), vAir = Math.max(0, st.v + W0.wind);
      st.alpha = Math.max(0, (st.trim - opt) + 2.5 + st.kick + 2 * st.porp * Math.sin(st.t * 8));
      st.Lr = st.pl * 0.6 * vAir * vAir * HU.Sl * st.alpha / (6 * Wt); st.LrMax = Math.max(st.LrMax, st.Lr);
      const pT = tOpt + 1.6 - 0.006 * Math.max(0, st.v - 20);
      st.porp = clamp(st.porp + dt * (st.pl > 0.7 ? 1.3 * (st.trim - pT) + 0.6 * st.kick * 0.2 : -2) - dt * 1.1 * st.porp, 0, 1.4); if (st.porp > 0.35) st.porpT += dt;
      if (HU.walk) { const over = st.trim - (tOpt + 0.8), sp = st.v / HU.walk; st.walk = clamp(st.walk + dt * ((sp > 1 ? 0.9 * over * sp + 0.25 * W0.chop * sp : -1.5) - 0.8 * st.walk - 1.2 * (1 - thr) * st.walk), 0, 1.6); if (st.walk > 0.3) st.walkT += dt; }
      const R = Wt * hullRW(st.v, st.trim, st.Lr) + 0.6 * HU.cdA * vAir * Math.abs(vAir) * (1 + 0.1 * st.walk);
      st.R = R + (st.dnf && st.dnf !== "time" ? 2.5 * Wt : 0);   // over, hooked or stuffed: it stops in a hurry
      const acc = run || st.v > 0 ? (Tp - st.R) / (m * 1.05) : 0;
      const xPrev = st.x, vPrev = st.v, tPrev = st.t - dt;
      st.v = Math.max(0, st.v + acc * dt); st.x += st.v * dt; st.acc = acc; st.maxV = Math.max(st.maxV, st.v);
      if (st.humpT == null && f > 1) st.humpT = st.t - (st.rt || 0); if (st.planeT == null && st.pl > 0.95) st.planeT = st.t - (st.rt || 0);
      st.bow = (f < 1 ? 7.5 * Math.pow(f, 1.4) : 7.5 * Math.exp(-Math.pow((f - 1) / 0.8, 2))) * (1 - 0.06 * Math.max(0, -st.trim)) + st.pl * st.alpha * 0.55;
      st.vy = st.hopV;
      // heat: raw water through the block — cool, unless the pickup is choked
      st.cool += dt * ((50 + 22 * thr - st.cool) * (st.debris && !jet ? 0.02 : 0.8) + (st.debris && !jet ? 7 * thr : 0)); st.coolPeak = Math.max(st.coolPeak, st.cool);
      if (thr > 0.6) loadT += dt;
      // the debris: a bag of weed on the prop, or a stick in the grate
      if (deb && !st.debris && st.x >= deb.x) st.debris = { x: +st.x.toFixed(1), kind: deb.kind };
      // splits and the finish line
      if (run && st.marks.length < 4 && st.x >= BOAT_SPLITS[st.marks.length][0]) for (const [d, nm] of BOAT_SPLITS) if (xPrev < d && st.x >= d) { const fr = (d - xPrev) / Math.max(1e-6, st.x - xPrev), tt = tPrev + fr * dt - st.rt, vv = vPrev + fr * (st.v - vPrev); st.marks.push({ n: nm, t: +tt.toFixed(3), mph: +(vv * 2.23694).toFixed(1) }); if (nm === "1000 ft" && !st.dnf && !st.broke) { st.et = +tt.toFixed(3); st.mph = +(vv * 2.23694).toFixed(1); st.finished = true; } }
      // what ends a run
      if (live) {
        if (st.Lr > 1) { if ((lrT += dt) > 0.12) { st.dnf = "blowover"; } } else lrT = Math.max(0, lrT - dt);
        if (st.walk > 1.35) st.dnf = "hooked";
        if (st.v > 25 && st.trim < opt - 4.5 && st.kick > 1.2) st.dnf = "stuffed";
        if (!v.noFail && !st.broke) {
          if (failKind && loadT >= failAt) st.broke = failKind;
          else if (v.wornAt && loadT >= v.wornAt) st.broke = "worn";
          else if (st.limT > limTrip) st.broke = "valve_float";
          else if (st.cool > 124) st.broke = "head_lift";
          else if (hzTot > 0 && thr > 0.6 && (hzAcc += hzTot * dt) > hzRoll) { const pick = hzR() * hzTot; let c = 0; st.broke = hz[0].id; for (const q of hz) { c += q.h; if (pick <= c) { st.broke = q.id; break; } } }
          if (st.broke) st.failKind = st.broke;
        }
      }
      if (st.t - st.lastTr >= 0.05) { st.lastTr = st.t; st.trace.push({ t: +st.t.toFixed(2), x: +st.x.toFixed(2), v: +st.v.toFixed(2), rpm: Math.round(st.rpm), slip: +st.slip.toFixed(3), thr: +thr.toFixed(2), trim: +st.trim.toFixed(2), lr: +st.Lr.toFixed(2), b: st.blown ? 1 : 0, bow: +st.bow.toFixed(1), air: +st.air.toFixed(2) }); }
      if (!st.done && (st.finished || st.dnf || st.broke)) { st.done = true; st.doneT = st.t; }
      if (!st.done && st.t > 25) { st.done = true; st.doneT = st.t; st.dnf = st.dnf || "time"; }
    }
    function step(dt, throttle, trimCmd) { if (throttle != null) st.thr = clamp(+throttle || 0, 0, 1); if (trimCmd != null) st.trimCmd = clamp(+trimCmd || 0, -1, 1); dt = Math.min(0.25, Math.max(0, dt)); while (dt > 1e-9) { const h = Math.min(0.005, dt); dt -= h; sub(h); } return st; }
    /* the auto driver: leaves on its light, feathers to keep the prop hooked through the hump, lifts over a hop,
       trims in for the hump and out with speed — but backs it in when it porpoises, walks or the nose gets light.
       At skill 1 it picks the pedal straight back up after a blowout or a hop and carries its trim a little under the
       hull's best (a hair of trim costs less than a porpoise); a lesser driver is slower back on it and trims out further. */
    function auto(skill) {
      const k = skill == null ? 1 : skill;
      if (st.done) return { thr: 0, trim: 0 };
      if (st.phase === "line") return { thr: st.t >= (v.rt != null ? v.rt : 0.08) ? 1 : 0, trim: 0 };
      const f = st.v / HU.vh, tOpt = boatLerp(-2, opt, boatSm(0.8, 2.2, f)), aim = tOpt - 0.9 + 0.25 * Math.min(1, st.v / 60) + 0.7 * (1 - k);
      let thr = st.foot;
      if (st.blown) thr = Math.max(0.3, thr - 0.08 * (0.6 + k)); else if (st.air) thr = Math.max(0.5, thr - 0.08 * k); else thr = Math.min(1, thr + 0.04 + 0.16 * k * k * k);
      if (st.t - st.rt < 0.05) thr = 1;
      if (st.rpm > v.redline * 1.01) thr = Math.min(thr, 0.85);
      if (st.Lr > 0.82 || st.walk > 0.9) thr = Math.min(thr, 0.7);
      let tc = clamp((aim - st.trim) * 2, -1, 1);
      if (st.porp > 0.25 || st.walk > 0.3 || st.Lr > 0.7 - 0.1 * (1 - k)) tc = -1;
      return { thr, trim: tc };
    }
    function result() {
      const reasons = [], dist = +Math.min(BOAT_FT, st.x).toFixed(1);
      const why = { blowover: "Blew over — the bow got light, air got under it and it went over backwards. Less trim at the top end, or a headwind is the time to back off.", hooked: "Hooked — the chine walk built until the hull caught a chine and spun. Trim in when it starts to rock side to side.", stuffed: "Stuffed it — trimmed all the way in at speed, the bow caught a wave and buried. Trim out once you're on plane.", time: "Never got going — stuck on the hump." };
      if (st.broke) reasons.push(st.broke === "valve_float" ? `${st.limT.toFixed(1)} s bouncing off the limiter — every hop let the prop unload and the valves floated. Feather the throttle over the chop.` : st.broke === "head_lift" ? `Water hit ${Math.round(st.coolPeak)} °C with the raw-water pickup choked by weed — it lifted the head.` : st.broke === "worn" ? "Something tired let go — the engine was overdue a freshen." : `The ${(res.tests || []).find(q => q.id === st.broke) ? (res.tests.find(q => q.id === st.broke).name || "").toLowerCase() || "weakest part" : "weakest part"} let go ${Math.round(dist * 3.28084)} ft down the course: a boat holds full load the whole way, with no coasting. The dyno's reliability list shows the part to strengthen, or run a safer map.`);
      if (st.dnf && why[st.dnf]) reasons.push(why[st.dnf]);
      if (st.et != null) reasons.push(`${st.et.toFixed(3)} s at ${st.mph.toFixed(1)} mph over 1,000 ft.`);
      if (st.blowN) reasons.push(`The prop blew out ${st.blowN}× (${st.blowT.toFixed(1)} s loose)${st.blowAt[0] != null && st.blowAt[0] < 60 ? " off the line — feather it until the hull gets moving" : ""}.`);
      if (st.humpT != null) reasons.push(`Over the hump in ${st.humpT.toFixed(2)} s${st.planeT != null ? `, on plane at ${st.planeT.toFixed(2)} s` : ""}.`);
      if (st.porpT > 0.3) reasons.push(`Porpoised ${st.porpT.toFixed(1)} s — trimmed out past what the hull would carry.`);
      if (st.walkT > 0.3) reasons.push(`Chine-walked ${st.walkT.toFixed(1)} s.`);
      if (st.LrMax > 0.75 && st.dnf !== "blowover") reasons.push(`The nose got light — ${Math.round(st.LrMax * 100)}% of the way to a blowover.`);
      if (st.hops) reasons.push(`${st.hops} hop${st.hops === 1 ? "" : "s"} off the ${W0.name} water${st.limT > 0.2 ? ` · ${st.limT.toFixed(1)} s on the limiter` : ""}.`);
      if (st.debris) reasons.push(st.debris.kind === "grate" ? `Picked up a stick in the intake grate at ${Math.round(st.debris.x * 3.28)} ft — the pump cavitated the rest of the way.` : `Picked up weed at ${Math.round(st.debris.x * 3.28)} ft — it fouled the prop and choked the raw-water pickup (water ${Math.round(st.coolPeak)} °C).`);
      const fin = st.marks.find(q => q.n === "1000 ft");
      return { et: st.et, mph: st.mph, rt: st.rt != null ? +st.rt.toFixed(3) : null, marks: st.marks, dist, distFt: Math.round(dist * 3.28084), dnf: st.dnf, broke: st.broke, failKind: st.broke ? st.failKind : null,
        blowN: st.blowN, blowT: +st.blowT.toFixed(2), blowAt: st.blowAt, humpT: st.humpT != null ? +st.humpT.toFixed(2) : null, planeT: st.planeT != null ? +st.planeT.toFixed(2) : null, porpT: +st.porpT.toFixed(2), walkT: +st.walkT.toFixed(2), LrMax: +st.LrMax.toFixed(2),
        hops: st.hops, airT: +st.airT.toFixed(2), limT: +st.limT.toFixed(2), peakRpm: Math.round(st.peakRpm), coolPeak: Math.round(st.coolPeak), debris: st.debris, water: W0, maxMph: +(st.maxV * 2.23694).toFixed(1), slipEnd: fin ? +st.slip.toFixed(3) : null,
        trace: st.trace, reasons, cls: v.cls, hull: C0.hull, drive: C0.drive, mass: Math.round(m), gear: +Gr.toFixed(2), pitch: pitchIn, imp: jet ? imp[0] : null, trim0: +(+v.trim || 0).toFixed(1), veh: { cls: v.cls, pitch: pitchIn, imp: v.imp, gear: Gr, trim: v.trim } };
    }
    return { st, step, auto, result, water: W0, mass: m, Gr, jet, opt, hull: C0.hull, Tc0 };
  }
  function boatSm(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function boatLerp(a, b, t) { return a + (b - a) * t; }
  /* a quick setup without the prop shop (the AI field): pitch (or drive ratio) to put peak power at the speed a boat
     of this power should reach by the far buoys, with ~15% slip; impeller C */
  function boatGuess(res, cls) {
    const C0 = BOAT_CLASSES[cls] || BOAT_CLASSES.outboard, F = C0.field, vEst = F.mph * 0.44704 * Math.pow(Math.max(50, res.peakHp || F.hp) / F.hp, 1 / 3), pk = res.peakHpRpm || 5000;
    if (C0.drive === "jet") { const cj = BOAT_IMP[2][2]; return { imp: 2, gear: +clamp(pk / 60 * cj / (1.35 * vEst), C0.gear[0], C0.gear[1]).toFixed(2) }; }
    const g = C0.gear[2]; return { pitch: Math.round(clamp(vEst / (pk / 60 / g * 0.85) / 0.0254, C0.pitch[0], C0.pitch[1])), gear: g };
  }
  function boatPrep(cfg, env, res) { return dragPrep(cfg, env, res); }
  /* a pass with the auto driver on it, start to finish (after the line it coasts): the AI field and the node harness */
  function boatPass(res, veh, skill) { const p = boatRun(res, veh); let n = 0; while (!p.st.done && n++ < 5000) { const a = p.auto(skill); p.step(0.02, a.thr, a.trim); } return p.result(); }
  /* the prop shop: the pitch and gear (or impeller and drive ratio) that run the quickest clean pass on glassy water.
     quick: the pitch on a coarse grid at the class's usual gear (the AI field's boats) */
  function boatTune(res, cls, base, quick) {
    const C0 = BOAT_CLASSES[cls] || BOAT_CLASSES.outboard, calm = { seed: 1, wind: 0, chop: 0, name: "glassy" }, b = Object.assign({ cls: C0.id, noFail: true, water: calm, seed: 7 }, base || {});
    let best = null; const tryIt = o => { const q = boatPass(res, Object.assign({}, b, o), 1); const sc = q.et != null ? q.et : 99 + (BOAT_FT - q.dist) / 10; if (!best || sc < best.sc) best = Object.assign({ sc, et: q.et, mph: q.mph }, o); };
    const G = C0.gear, gs = k => +(G[0] + (G[1] - G[0]) * k).toFixed(2);
    if (C0.drive === "jet") { for (let i = 0; i < 4; i++) for (let gx = 0; gx <= (quick ? 3 : 5); gx++) tryIt({ imp: i, gear: gs(gx / (quick ? 3 : 5)) }); }
    else if (quick) { for (let p = C0.pitch[0]; p <= C0.pitch[1]; p += 4) tryIt({ pitch: p, gear: G[2] }); }
    else { for (let gx = 0; gx <= 2; gx++) for (let p = C0.pitch[0]; p <= C0.pitch[1]; p += 4) tryIt({ pitch: p, gear: gs(gx / 2) });
      const b0 = best; for (const d of [-2, 2]) if (b0.pitch + d >= C0.pitch[0] && b0.pitch + d <= C0.pitch[1]) tryIt({ pitch: b0.pitch + d, gear: b0.gear });
      const b1 = best; for (const d of [-0.15, 0.15]) { const gg = +(b1.gear + d).toFixed(2); if (gg >= G[0] && gg <= G[1]) tryIt({ pitch: b1.pitch, gear: gg }); } }
    return best;
  }

  /* =====================================================================
     HILL CLIMBS, THE RUN ITSELF: in sim-late.js, not in the page (since 1.76.138.0).
     The course builder (hillCourse), the engine at five altitudes (hillPrep), the car, the corner
     calls and the driver's plan, the time-stepped run (hillNew, hillPass) and the AI cars.
     build.js writes this file to sim-late.js; the app fetches it once the garage is up and runs it
     inside the ENGINE_SIM closure (simLateRun in sim/tunemap.js), so it sees every physics name as
     if it were still in the page. The tables the setup screen reads before it arrives (classes,
     tyres, aero, the hills and their altitudes) stay in sim/hill.js, which has the full story.
     ===================================================================== */
  // pressure ratio a compressor wheel can make before it runs out of tip speed (a compound pair multiplies two)
  const HILL_PR = { small: 2.7, medium: 3.0, large: 3.3, s66: 4.4, huge: 3.6, f88: 3.9, f98: 4.1 };
  const hillWrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  /* one corner from a section's mix: [radius m, angle deg, hairpin?] */
  function hillMix(mix, r) {
    const U = (a, b) => a + (b - a) * r();
    const hp = () => [U(13, 21), U(150, 178), 1], fst = () => [U(200, 480), U(10, 38), 0], med = () => [U(80, 190), U(22, 70), 0], tight = () => [U(32, 65), U(45, 100), 0];
    const q = r();
    if (mix === "forest") return q < 0.06 ? hp() : q < 0.26 ? tight() : q < 0.75 ? med() : fst();
    if (mix === "mixed") return q < 0.12 ? hp() : q < 0.32 ? tight() : q < 0.75 ? med() : fst();
    if (mix === "hairpins") return q < 0.55 ? hp() : q < 0.7 ? tight() : med();
    if (mix === "fast") return q < 0.5 ? fst() : q < 0.9 ? med() : tight();
    if (mix === "edge") return q < 0.18 ? hp() : q < 0.48 ? tight() : med();
    if (mix === "tech") return q < 0.12 ? hp() : q < 0.57 ? tight() : med();
    return q < 0.3 ? hp() : q < 0.7 ? tight() : med();   // summit
  }
  const HILL_COURSE = {};
  /* a hill's course (id, default Cloudsplitter Peak; built once and kept): samples every 2.5 m with position, heading, curvature (+ left),
     altitude, grade, section and corner */
  function hillCourse(id) {
    id = hillId(id);
    if (HILL_COURSE[id]) return HILL_COURSE[id];
    const HD = HILL_HILLS[id], SECS = HD.secs;
    const r = pullRng(HD.seed), segs = [], corners = [];
    let h = SECS[0].bear, ci = 0;
    SECS.forEach((S, si) => {
      const L = S.km * 1000, items = [], nm = {}, nR = {};
      S.names.forEach(q => { nm[q[0]] = q[1]; if (q[2]) nR[q[0]] = q[2]; });
      for (let k = 0; k < S.cor; k++) {
        let [R, deg, hp] = hillMix(S.mix, r), dev = hillWrap(h - S.bear), d;
        if (hp && Math.abs(dev) > 0.6) {
          // a switchback: swing through the uphill bearing onto the other side of the fall line
          const to = -Math.sign(dev) * (1.15 + 0.5 * r()), s0 = -Math.sign(dev);
          d = s0 * (Math.abs(dev) + Math.abs(to));
        } else {
          if (hp) { R = 18 + 14 * r(); deg = 80 + 40 * r(); }
          let s = Math.abs(dev) > 0.45 && r() < 0.82 ? -Math.sign(dev) : (r() < 0.5 ? 1 : -1);
          d = s * deg * Math.PI / 180;
          if (Math.abs(hillWrap(h + d - S.bear)) > 1.75) { s = -s; d = -d; }
          if (Math.abs(hillWrap(h + d - S.bear)) > 1.75) { const tgt = S.bear + Math.sign(hillWrap(h + d - S.bear)) * (0.6 + 0.6 * r()); d = hillWrap(tgt - h); }
          if (Math.abs(d) < 0.2) d = Math.sign(d || 1) * 0.2;
        }
        h += d; if (nR[k]) R = nR[k];
        items.push({ R: R, d: d, name: nm[k] || "", si: si, hp: Math.abs(d) > 2.4 });
      }
      // straights fill the rest of the section, longest where the road is fast
      const arc = items.reduce((a, c) => a + c.R * Math.abs(c.d), 0), w = items.map(c => (c.hp ? 0.7 : 1) * (0.25 + Math.pow(r(), 1.6) * (S.mix === "fast" ? 2.2 : 1.4)));
      let room = L - arc; if (room < 20 * items.length) { const k2 = (L - 20 * items.length) / arc; items.forEach(c => { c.R *= k2; }); room = 20 * items.length; }
      const ws = w.reduce((a, b) => a + b, 0);
      items.forEach((c, k) => { segs.push(["s", room * w[k] / ws, si]); segs.push(["c", c.R, c.d, si, c, ci++]); });
    });
    // sample the plan at HILL_DS
    const X = [], Y = [], H = [], K = [], SEC = [], COR = [];
    let x = 0, y = 0, hh = SECS[0].bear, carry = 0, s0 = 0;
    const secEnd = [];
    segs.forEach(sg => {
      const isC = sg[0] === "c", Lg = isC ? sg[1] * Math.abs(sg[2]) : sg[1], k = isC ? Math.sign(sg[2]) / sg[1] : 0;
      if (isC) { const c = sg[4]; corners.push({ i: sg[5], s0: s0, s1: s0 + Lg, R: +sg[1].toFixed(1), deg: Math.round(sg[2] * 180 / Math.PI), name: c.name, sec: sg[3], hp: c.hp }); }
      let u = carry;
      while (u < Lg - 1e-9) {
        let px, py, ph;
        if (!isC) { px = x + Math.cos(hh) * u; py = y + Math.sin(hh) * u; ph = hh; }
        else { const R = sg[1], sgn = Math.sign(k), cx = x - Math.sin(hh) * R * sgn, cy = y + Math.cos(hh) * R * sgn; ph = hh + u * k; px = cx + Math.sin(ph) * R * sgn; py = cy - Math.cos(ph) * R * sgn; }
        X.push(px); Y.push(py); H.push(ph); K.push(k); SEC.push(sg[isC ? 3 : 2]); COR.push(isC ? sg[5] : -1); u += HILL_DS;
      }
      carry = u - Lg;
      if (!isC) { x += Math.cos(hh) * Lg; y += Math.sin(hh) * Lg; } else { const R = sg[1], sgn = Math.sign(k), cx = x - Math.sin(hh) * R * sgn, cy = y + Math.cos(hh) * R * sgn; hh += Lg * k; x = cx + Math.sin(hh) * R * sgn; y = cy - Math.cos(hh) * R * sgn; }
      s0 += Lg; secEnd[sg[isC ? 3 : 2]] = s0;
    });
    const N = X.length, len = N * HILL_DS;
    // elevation: each section's climb spread with a slow swell in the grade, pinned to the section's end altitude
    const Z = new Float64Array(N), G = new Float32Array(N);
    let a0 = HD.alt0, i0 = 0;
    SECS.forEach((S, si) => {
      let i1 = i0; while (i1 < N && SEC[i1] === si) i1++;
      const n = Math.max(1, i1 - i0), ph = r() * 6.28, wv = [];
      let tot = 0; for (let i = 0; i < n; i++) { const q = 1 + 0.3 * Math.sin(ph + i * HILL_DS / 420) + 0.12 * Math.sin(ph * 2 + i * HILL_DS / 130); wv.push(q); tot += q; }
      let z = a0; for (let i = 0; i < n; i++) { Z[i0 + i] = z; z += (S.alt - a0) * wv[i] / tot; }
      a0 = S.alt; i0 = i1;
    });
    for (let i = 0; i < N; i++) G[i] = i < N - 1 ? (Z[i + 1] - Z[i]) / HILL_DS : G[i - 1];
    // corners: sample range, the drop on the outside (and whether a guardrail stands on it)
    corners.forEach(c => {
      c.i0 = Math.floor(c.s0 / HILL_DS); c.i1 = Math.min(N - 1, Math.ceil(c.s1 / HILL_DS)); c.iA = Math.min(N - 1, Math.round((c.i0 + c.i1) / 2));
      const S = SECS[c.sec], q = r(), named = !!c.name && HD.edge.indexOf(c.name) >= 0;
      c.drop = named || q < S.drop; c.rail = c.drop && !named && r() < (c.hp ? 0.7 : 0.5); c.alt = Z[c.iA]; c.side = c.deg > 0 ? 1 : -1;
    });
    let mx = Infinity, Mx = -Infinity, my = Infinity, My = -Infinity; for (let i = 0; i < N; i++) { mx = Math.min(mx, X[i]); Mx = Math.max(Mx, X[i]); my = Math.min(my, Y[i]); My = Math.max(My, Y[i]); }
    const sections = SECS.map((S, si) => ({ id: S.id, n: S.n, s0: si ? secEnd[si - 1] : 0, s1: secEnd[si], alt0: si ? SECS[si - 1].alt : HD.alt0, alt1: S.alt, cor: S.cor }));
    HILL_COURSE[id] = { id: id, n: HD.n, len: len, ds: HILL_DS, N: N, x: Float64Array.from(X), y: Float64Array.from(Y), h: Float64Array.from(H), k: Float64Array.from(K), z: Z, grade: G,
      sec: Uint8Array.from(SEC), cor: Int16Array.from(COR), corners: corners, sections: sections, box: [mx, my, Mx, My], tree: HD.tree, alts: hillAlts(id) };
    return HILL_COURSE[id];
  }
  /* the engine on the way up: simulate() at each of the hill's five altitudes (Cloudsplitter: HILL_ALTS) with the boost and mixture that
     altitude gets. id: the hill (default Cloudsplitter Peak). wx (a team round's weather): {dT: °C off the standard morning, h: humidity %} */
  function hillPrep(cfg, env, id, wx) {
    cfg = Object.assign({}, DEFAULT_CFG, cfg || {});
    const dT = wx && +wx.dT || 0, alts = hillAlts(id);
    const asp = OPT.asp[cfg.asp] || OPT.asp.na, kind = asp.kind, base = Object.assign({}, DEFAULT_ENV, env || {}, { testType: "pull", humidity: wx && wx.h != null ? +wx.h : 30 });
    const shopEnv = Object.assign({}, base, { altitudeM: 500, ambientC: 20, humidity: 40 }), shop = ambient(shopEnv);
    const ref = simulate(cfg, shopEnv), comp = (ref.tests || []).find(t => t.id === "compressor_map"), cool = (ref.tests || []).find(t => t.id === "cooling");
    const carb = !isDiesel(cfg) && (isTwoStroke(cfg) ? cfg.tsFuel === "carb" : cfg.intake === "carb");
    const prCap = (HILL_PR[cfg.turboSize] || 3.0) * (asp.compound ? 1.55 : 1), pT = shop.p + (+cfg.boost || 0) * 1e5;
    const pts = alts.map(alt => {
      const envA = Object.assign({}, base, { altitudeM: alt, ambientC: hillAmbC(alt) + dT }), air = ambient(envA), c2 = Object.assign({}, cfg);
      let lim = "";
      if (kind === "turbo") {
        // the boost controller holds the shop's manifold pressure: more pressure ratio, more corrected flow through the wheel
        let pm = pT; const u = (comp ? comp.util : 0.5) * shop.p / air.p;
        if (pm > prCap * air.p) { pm = prCap * air.p; lim = "ratio"; }
        if (u > 1.0 && pm > pT / Math.pow(u, 0.85)) { pm = pT / Math.pow(u, 0.85); lim = "flow"; }
        c2.boost = Math.max(0, (pm - air.p) / 1e5);
      } else if (kind !== "na") c2.boost = (+cfg.boost || 0) * Math.pow(air.p / shop.p, 0.6);   // belt-driven: the same rotor speed moves thinner air, but costs less to drive and heats it less — it loses some, not all
      if (carb) c2.lambda = +(cfg.lambda * Math.sqrt(air.rho / shop.rho)).toFixed(3);   // jets meter by the air's velocity, not its mass: richer as it thins
      const res = simulate(c2, envA);
      return { alt: alt, rho: air.rho, p: air.p, T: air.T, ambC: envA.ambientC, boost: kind === "na" ? 0 : c2.boost, lambda: c2.lambda, hp: res.peakHp, tq: res.peakTq, lim: lim, res: res, prep: roadPrep(c2, res) };
    });
    const Qt = ref.peakHp * 0.7457 * 0.82 * 0.62;
    return { hill: hillId(id), dT: dT, cfg: cfg, kind: kind, carb: carb, efi: !carb, ref: { hp: ref.peakHp, rho: shop.rho, p: shop.p, boost: kind === "na" ? 0 : +cfg.boost || 0, lambda: cfg.lambda },
      pts: pts, refRes: ref, coolQ: Qt / 0.62, radKw: Qt / Math.max(0.05, cool ? cool.util : 0.5), VdL: Math.max(0.3, (ref.Vd || 2000) / 1000), kg: ref.kg, fails: ref.fails || [], redline: cfg.redline };
  }

  /* the gearing target speed: 57 m/s for everything up to about a thousand horsepower (vPow past ~100 m/s), then a slow climb that flattens out around 77 m/s (277 km/h),
     so monster builds keep getting quicker on the straights but the mountain's corners and the downforce drag, not a flat cap, set the end of it */
  const HILL_BUMP = 0.6;   // the mountain road's roughness for a low car (road.js tracks run 0.2 to 1)
  const hillVTop = vPow => vPow <= 100 ? Math.min(vPow, 57) : 57 + 20 * (1 - Math.exp(-(vPow - 100) / 60));
  /* the class car: the road-test chassis with this engine, stripped to the class weight, on its tyres and aero, geared for the mountain */
  function hillCar(prep, opt) {
    opt = opt || {};
    const cls = HILL_CLASSES[opt.cls] || HILL_CLASSES.open, a = HILL_AERO[opt.aero] || HILL_AERO.none, ty = HILL_TYRES[opt.tyre] || HILL_TYRES.sport;
    const r0 = prep.pts[0].prep, car = roadCar(r0, { ch: opt.ch, tyre: opt.tyre in ROAD_TYRES ? opt.tyre : "semi" });
    car.m = (car.m - 75) * cls.massK + 75; car.crr = car.C.rr * car.m * ROAD_G;
    const mu = ty.mu * roadWetMu(opt.tyre in HILL_TYRES ? opt.tyre : "sport", opt.wet);   // opt.wet: rain on the mountain
    car.mu = mu; car.muLat = mu * car.kBal * car.kLoad * 0.97; car.muLong = mu * car.kLoad * 1.12;
    car.clA = car.C.clA + a.clA; car.cdA = car.C.cdA + a.cdA; car.tyre = opt.tyre in HILL_TYRES ? opt.tyre : "sport"; car.aero = opt.aero in HILL_AERO ? opt.aero : "none"; car.cls = opt.cls in HILL_CLASSES ? opt.cls : "open";
    // top gear on the power peak at about the fastest the mountain allows, not the flat-out top speed
    const pkR = Math.min(r0.peakHpRpm || car.redline * 0.85, car.redline), top = car.gears[car.gears.length - 1], vTop = hillVTop(car.vPow);
    car.fdAuto = clamp((pkR * 2 * Math.PI / 60) * car.rw / (vTop * top), 0.9, 7.5); car.fd = clamp(car.fdAuto * clamp(+opt.finalK || 1, 0.6, 1.6), 0.7, 9);
    return roadSetup(car, opt.setup, HILL_BUMP);
  }
  const hDrag = (car, v, rho) => 0.5 * rho * car.cdA * v * v + car.crr;
  function hTrac(car, v, lat, rho) {
    const DF = 0.5 * rho * car.clA * v * v, mg = car.m * ROAD_G, mu = car.muLong * Math.sqrt(Math.max(0, 1 - lat * lat)) * (car.tK ? 1 - car.tK * lat : 1) * (car.kD ? 1 + car.kD * lat : 1), hw = car.h / car.wb;
    if (car.drive === "awd") return mu * (mg + DF) * 0.98;
    if (car.drive === "fwd") return mu * (mg * car.front + DF * 0.45) / (1 + mu * hw);
    return mu * (mg * (1 - car.front) + DF * 0.55) / Math.max(0.3, 1 - mu * hw);
  }
  const hBrake = (car, v, lat, rho) => { const DF = 0.5 * rho * car.clA * v * v, mg = car.m * ROAD_G; return Math.min(car.brake * mg, car.muLong * (mg + Math.max(0, DF))) * Math.sqrt(Math.max(0, 1 - lat * lat)) * (car.kB || 1); };

  /* the corner calls for one running: dusty, clean or grippy (the spotters' notes), and a little nobody can see */
  function hillCalls(seed, id) {
    const T = hillCourse(id), r = pullRng((seed ^ 0x5EED) >>> 0);
    return T.corners.map(c => { const q = r(), hi = c.alt > T.tree; const call = q < (hi ? 0.22 : 0.15) ? "dusty" : q < 0.78 ? "clean" : "grippy";
      const g = Math.sqrt(-2 * Math.log(Math.max(1e-6, r()))) * Math.cos(2 * Math.PI * r());
      return { call: call, gk: 1 + HILL_CALL[call] + 0.008 * clamp(g, -2.4, 2.4) }; });
  }
  /* the auto driver's commitment per corner: reads the calls, a touch more over a guardrail than over nothing. Up to skill 0.8
     a driver reads the calls a little timidly (grippy short, dusty long) with a hand that wanders; from 0.8 to 1 that sharpens
     to the best line found in the node harness: exactly the call's grip plus 1%, a hair less over a drop, no wander. The hidden
     variance tops out at ±1.9%, so at 1 the apex can be at most 3.0% over (a moment, never the gravel or the edge) */
  function hillPlan(calls, skill, seed, id) {
    const T = hillCourse(id), r = pullRng((seed ^ 0xA770) >>> 0), sk = clamp(skill == null ? 0.8 : skill, 0, 1), f = clamp((sk - 0.8) / 0.2, 0, 1);
    return T.corners.map((c, k) => { const cl = calls[k].call; let v = cl === "grippy" ? 1.03 + 0.005 * f : cl === "dusty" ? 0.962 - 0.002 * f : 1.0;
      const wob = sk <= 0.8 ? 1.4 - sk : 0.6 * (1 - f);
      v += (sk - 0.8) * 0.02 + 0.0065 * f - (c.drop && !c.rail ? 0.012 - 0.009 * f : 0) + 0.007 * (r() - 0.5) * 2 * wob; return +v.toFixed(4); });
  }

  /* one run up the hill. opt: {hill?, cls, ch, tyre, aero, finalK, seed, calls?, plan?, ai?}; the hill is opt.hill, else the one
     the prep was run for, else Cloudsplitter Peak. step(dt, ctl): ctl = {c} the commitment for corners not yet turned into (1 = the known
     limit), or null to drive the plan. */
  function hillNew(prep, opt) {
    const hid = hillId(opt.hill || prep.hill), T = hillCourse(hid), N = T.N, ds = T.ds, car = hillCar(prep, opt), m = car.m, P = prep.pts, nP = P.length;
    const E = P.map(p => roadEngine(p.prep, car)), seed = (opt.seed >>> 0) || 1, dT = +prep.dT || 0;
    const calls = opt.calls || hillCalls(seed, hid), plan = opt.plan || hillPlan(calls, 0.8, seed, hid), rnd = pullRng((seed ^ 0x0FF) >>> 0);
    // which two altitude runs bracket this altitude (qi) and how far between them (qf): set in place, no allocation in the hot loop
    let qi = 0, qf = 0;
    const A0 = P[0].alt, A1 = P[nP - 1].alt;
    const pIdx = alt => { const f = clamp((alt - A0) / (A1 - A0) * (nP - 1), 0, nP - 1.0001); qi = f | 0; qf = f - qi; };
    const rhoAt = alt => { pIdx(alt); return P[qi].rho + (P[qi + 1].rho - P[qi].rho) * qf; };
    const rhoS = new Float32Array(N); for (let i = 0; i < N; i++) rhoS[i] = rhoAt(T.z[i]);
    // grip ceiling per sample at the local air density: v²|k| = μ (g + ½ρ clA v² / m)
    const vc = new Float32Array(N);
    for (let i = 0; i < N; i++) { const k = Math.abs(T.k[i]); if (k < 1e-6) { vc[i] = 95; continue; } const den = k - car.muLat * 0.5 * rhoS[i] * car.clA / m; vc[i] = den <= 0 ? 95 : Math.min(95, Math.sqrt(car.muLat * ROAD_G / den)); }
    const cc = plan.slice(), locked = new Uint8Array(T.corners.length);
    const vb = new Float32Array(N); let vbFrom = -1, vbTo = -1, vbKey = "";
    const WIN = 520;
    const envelope = (i0) => {
      const i1 = Math.min(N - 1, i0 + WIN);
      for (let i = i1; i >= i0; i--) {
        const ck = T.cor[i], cap = ck >= 0 ? vc[i] * cc[ck] : vc[i];
        if (i === i1) { vb[i] = cap; continue; }
        const vj = vb[i + 1], kj = Math.abs(T.k[i + 1]), rho = rhoS[i + 1], ay = car.muLat * (ROAD_G + 0.5 * rho * car.clA * vj * vj / m), lat = Math.min(0.98, vj * vj * kj / Math.max(0.1, ay));
        const dec = (hBrake(car, vj, lat, rho) + hDrag(car, vj, rho)) / m + ROAD_G * T.grade[i];
        vb[i] = Math.min(cap, Math.sqrt(vj * vj + 2 * Math.max(0.5, dec) * ds));
      }
      vbFrom = i0; vbTo = i1;
    };
    const st = { t: 0, s: 0, v: 0, g: 0, shiftLeft: 0, b: new Float64Array(nP), cool: 88, coolPeak: 88, derate: 1, derateT: 0, thr: 0, brk: 0, rpm: car.idle, alt: T.z[0], lat: 0, latUse: 0,
      off: null, kChk: 0, d: 0, dTgt: 0, k: 0, sec: 0, splits: [], offs: [], moments: 0, dnf: null, done: false, vmax: 0, hpNow: P[0].hp, pf: 1, dmg: 0, trace: [], nextTr: 0, e: 0, ev: null, launch: 0 };
    const out = { car: car, T: T, calls: calls, plan: cc, st: st, E: E, prep: prep };
    const KC = T.corners;
    const torque = (rpm) => {   // full-throttle torque at this altitude, boost states carried per altitude
      const a = E[qi].tq(rpm, st.b[qi]), b = E[qi + 1].tq(rpm, st.b[qi + 1]);
      return a + (b - a) * qf;
    };
    out.step = function (dt, ctl) {
      if (st.done) return;
      const i = Math.min(N - 2, Math.floor(st.s / ds)), alt = hillZ(T, st.s), rho = rhoAt(alt), E0 = E[qi];
      st.alt = alt;
      // the driver's commitment applies to every corner not yet turned into
      if (ctl && ctl.c != null) { let ch = false; for (let k = st.k; k < KC.length && KC[k].s0 < st.s + WIN * ds; k++) if (!locked[k] && Math.abs(cc[k] - ctl.c) > 1e-4) { cc[k] = ctl.c; ch = true; } if (ch) vbFrom = -1; }
      while (st.k < KC.length && st.s >= KC[st.k].s0 - 2) { locked[st.k] = 1; if (st.s < KC[st.k].s1) break; st.k++; }
      if (vbFrom < 0 || i < vbFrom || i > vbFrom + WIN / 3) envelope(i);
      // off the road: crawl back out of the gravel and rejoin
      if (st.off) {
        const o = st.off; o.t -= dt; st.thr = 0.2; st.brk = 0; st.v = Math.max(o.t > o.T * 0.5 ? 0 : 3, st.v - 9 * dt); st.dTgt = o.side * (o.t > 1 ? 7.5 : 0);
        st.s += st.v * dt * 0.5; st.t += dt; st.d += (st.dTgt - st.d) * Math.min(1, dt * 1.6);
        if (o.t <= 0) { st.off = null; st.dTgt = 0; st.g = 0; }
        return;
      }
      const v = st.v, k = Math.abs(T.k[i]), ay = car.muLat * (ROAD_G + 0.5 * rho * car.clA * v * v / m), lat = Math.min(0.995, v * v * k / Math.max(0.1, ay));
      st.latUse = lat;
      let rpm = Math.max(rpmOf(car, v, st.g), car.idle);
      if (st.shiftLeft <= 0) {
        const bg = bestGear(car, E0, v), bd = bestGear(car, E0, v, 0.9);
        if (bg > st.g && v > 1) st.shiftLeft = car.shift;
        else if (bd < st.g && gearPull(car, E0, v, bd) > 1.12 * gearPull(car, E0, v, st.g)) { st.g = bd; rpm = Math.max(rpmOf(car, v, st.g), car.idle); }
      }
      // off the line the clutch holds the engine up near its torque peak until the wheels catch it
      if (st.g === 0 && v < 8) rpm = Math.max(rpm, Math.min(car.redline * 0.8, Math.max(car.idle + 1500, (P[0].prep.peakTqRpm || 3500) * 0.8)));
      const pf = st.derate * (1 - st.dmg);
      const Fe = st.shiftLeft > 0 ? 0 : torque(rpm) * car.gears[st.g] * car.fd * car.eta / car.rw * pf, Ft = hTrac(car, v, lat, rho), Fd = hDrag(car, v, rho), Fg = m * ROAD_G * T.grade[i];
      const me = m * mEff(car, st.g), sAhead = st.s + Math.max(0.5, v) * dt, ja = Math.min(N - 1, Math.floor(sAhead / ds)), jb = Math.min(N - 1, ja + 1), fa = sAhead / ds - ja;
      const vT = vb[ja] + (vb[jb] - vb[ja]) * clamp(fa, 0, 1);
      let thr = st.shiftLeft > 0 ? 0 : 1, brk = 0, a = (Math.min(Fe, Ft) - Fd - Fg) / me;
      if (v + a * dt > vT) {
        const aNeed = (vT - v) / dt, Fneed = aNeed * me + Fd + Fg;
        if (Fneed >= 0) { thr = Fe > 0 ? clamp(Fneed / Fe, 0, 1) : 0; a = aNeed; }
        else { const aMin = -(hBrake(car, v, lat * 0.98, rho) + Fd + Fg) / m; brk = clamp(-Fneed / Math.max(1, hBrake(car, v, 0, rho)), 0, 1); thr = 0; a = Math.max(aNeed, aMin); }
      }
      const v1 = Math.max(0, v + a * dt);
      st.s += (v + v1) / 2 * dt; st.t += dt; st.v = v1; st.thr = thr; st.brk = brk; st.rpm = rpm; st.vmax = Math.max(st.vmax, v1);
      if (st.shiftLeft > 0) { st.shiftLeft -= dt; if (st.shiftLeft <= 0) st.g = Math.min(car.gears.length - 1, st.g + 1); }
      for (let j = 0; j < nP; j++) st.b[j] = E[j].boost(st.b[j], dt, rpm, st.shiftLeft > 0 ? 0.7 : thr);
      // the engine's power right now, as a share of its shop figure, for the HUD and the heat
      const Pnow = torque(rpm) * rpm * 2 * Math.PI / 60 / 1000 * pf;
      st.hpNow = (P[qi].hp + (P[qi + 1].hp - P[qi].hp) * qf) * pf;
      // cooling: heat in with the power made; out through the radiator in proportion to the air's density and the airflow
      const amb = hillAmbC(alt) + dT, qIn = prep.coolQ * clamp(Pnow * thr / Math.max(1, prep.ref.hp * 0.7457), 0, 1.6);
      const qOut = prep.radKw * Math.max(0, st.cool - amb) / 85 * Math.pow(rho / prep.ref.rho, 0.8) * clamp(0.3 + 0.7 * v / 30, 0.3, 1.2) * (st.cool < 86 ? 0.15 : st.cool < 92 ? 0.15 + 0.85 * (st.cool - 86) / 6 : 1);
      st.cool += (qIn + 0.03 * prep.coolQ - qOut) * dt / (30 + 25 * prep.VdL); st.coolPeak = Math.max(st.coolPeak, st.cool);
      st.derate = st.cool > 110 ? clamp(1 - 0.025 * (st.cool - 110), 0.65, 1) : 1; if (st.derate < 0.999) st.derateT += dt;
      if (st.cool > 127) { st.dnf = { kind: "boil", s: st.s, t: st.t, name: T.sections[T.sec[i]].n }; st.done = true; }
      // not enough to pull itself up the grade, or flagged off after half an hour
      st.stuckT = st.v < 0.5 ? (st.stuckT || 0) + dt : 0;
      if (st.stuckT > 20 || st.t > 1800) { st.dnf = { kind: st.stuckT > 20 ? "stall" : "time", s: st.s, t: st.t, name: T.sections[T.sec[i]].n }; st.done = true; }
      // a corner's apex: did it hold?
      const c = KC[st.kChk];
      if (c && st.s >= c.s0 + (c.s1 - c.s0) * 0.5) {
        st.kChk++; const vTrue = vc[c.iA] * calls[c.i].gk, e = st.v / vTrue - 1; st.e = e; st.ev = null;
        if (e > 0.012 && e <= 0.03) { st.moments++; st.v *= 1 - 2.2 * e; st.ev = { kind: "moment", k: c.i, t: st.t }; }
        else if (e > 0.03) {
          const big = e > 0.065, kind = big ? (c.drop ? (c.rail ? "rail" : "edge") : "bank") : "gravel";
          if (kind === "edge") { st.dnf = { kind: "edge", s: st.s, t: st.t, name: c.name || T.sections[c.sec].n, k: c.i }; st.ev = { kind: kind, k: c.i, t: st.t }; st.done = true; }
          else { const T0 = kind === "gravel" ? 2.2 + 70 * (e - 0.03) : kind === "rail" ? 9 + 6 * rnd() : 7 + 4 * rnd(); st.off = { kind: kind, T: T0, t: T0, side: -c.side, k: c.i, t0: st.t };
            st.offs.push({ kind: kind, k: c.i, name: c.name, sec: c.sec, loss: +T0.toFixed(1), at: Math.round(st.s) }); st.ev = { kind: kind, k: c.i, t: st.t }; if (kind === "rail") st.dmg = Math.min(0.15, st.dmg + 0.04); }
        }
        st.lastK = c.i;
      }
      if (st.sec < T.sections.length && st.s >= T.sections[st.sec].s1 - 1e-6) { st.splits.push(+st.t.toFixed(3)); st.sec++; }
      if (st.s >= st.nextTr) { st.trace.push([Math.round(st.s), +(st.v * 3.6).toFixed(1), Math.round(alt), +st.cool.toFixed(1), +thr.toFixed(2), +brk.toFixed(2), st.g + 1, Math.round(st.hpNow)]); st.nextTr += 50; }
      if (st.s >= T.len - ds) { st.s = T.len; st.done = true; while (st.splits.length < T.sections.length) st.splits.push(+st.t.toFixed(3)); }
    };
    out.result = function () {
      const r = { time: st.dnf ? null : +st.t.toFixed(3), dnf: st.dnf, splits: st.splits.slice(), offs: st.offs.slice(), moments: st.moments, vmax: +(st.vmax * 3.6).toFixed(1),
        avgKmh: st.dnf ? null : +(T.len / st.t * 3.6).toFixed(1), coolPeak: Math.round(st.coolPeak), derateT: +st.derateT.toFixed(1), dmg: st.dmg, trace: st.trace, len: T.len,
        hp: P.map(p => ({ alt: p.alt, hp: Math.round(p.hp), boost: +p.boost.toFixed(2), lambda: p.lambda, lim: p.lim })), refHp: Math.round(prep.ref.hp), kind: prep.kind, carb: prep.carb,
        m: Math.round(car.m), fd: +car.fd.toFixed(2), fdAuto: +car.fdAuto.toFixed(2), cls: car.cls, tyre: car.tyre, aero: car.aero, ch: car.ch, drive: car.drive };
      return r;
    };
    return out;
  }
  /* drive a whole run at once (the auto driver, or a skip) */
  function hillPass(prep, opt) { const p = hillNew(prep, opt); let n = 0; const dt = opt.dt || 0.02; while (!p.st.done && n++ < 120000) p.step(dt, null); return Object.assign(p.result(), { calls: p.calls }); }
  /* a field car: a made-up engine of hp, NA or turbo, its power at each altitude scaled the way the real thing goes.
     id, wx: the hill and a team round's weather, as hillPrep */
  function hillAiPrep(hp, turbo, seed, id, wx) {
    const base = bogAiRes(hp, false, seed), r = pullRng((seed ^ 0x77) >>> 0), refRho = ambient({ altitudeM: 500, ambientC: 20, humidity: 40 }).rho;
    const dT = wx && +wx.dT || 0, hum = wx && wx.h != null ? +wx.h : 30;
    const pts = hillAlts(id).map(alt => { const air = ambient({ altitudeM: alt, ambientC: hillAmbC(alt) + dT, humidity: hum }), dr = air.rho / refRho;
      const k = turbo ? (alt < 3700 ? 0.97 : 0.97 - 0.22 * (alt - 3700) / 600) : Math.pow(dr, 1.12);
      const res = Object.assign({}, base, { torque: base.torque.map(t => t * k), peakHp: base.peakHp * k, peakTq: base.peakTq * k, kg: 160 + hp * 0.12, aspKind: "na" });
      return { alt: alt, rho: air.rho, p: air.p, hp: res.peakHp, boost: 0, lim: "", res: res, prep: roadPrep({ asp: "na", redline: base.redline, cam: 40 }, res) }; });
    return { hill: hillId(id), dT: dT, kind: turbo ? "turbo" : "na", ref: { hp: hp, rho: refRho }, pts: pts, coolQ: hp * 0.7457 * 0.82, radKw: hp * 0.7457 * 0.82 * 0.62 / (0.3 + 0.25 * r()), VdL: 3 + 3 * r(), redline: base.redline };
  }
  /* =====================================================================
     DIRT OVAL, THE RACE ITSELF: in sim-late.js, not in the page (since 1.76.139.0).
     Here: the lap sim (ovalNew, ovalPass), ovalPrep, the setup pick (ovalSetup) and the AI cars (ovalAiRes).
     build.js writes this file to sim-late.js; the app fetches it once the garage is up and runs it
     inside the ENGINE_SIM closure (simLateRun in sim/tunemap.js), so it sees every physics name as
     if it were still in the page. sim/oval.js keeps the classes, tyres, grilles, the tracks and the night's clay (ovalNight).
     ===================================================================== */
  function ovalGaussian(r) { return Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r()); }
  /* the banked-turn grip limit for a given μ */
  function ovalVlim(mu, track) { const TR = ovalTrack(track), tb = Math.tan(TR.bank); return Math.sqrt(TR.R * OVAL_G * (tb + mu) / (1 - mu * tb)); }
  /* the engine as the car sees it: the strip's prep (boost split, turbo size, EGT limit) */
  function ovalPrep(cfg, env, res) { return dragPrep(cfg, env, res); }

  /* v: { cls, tyre, grille, finalK, redline, idle, seed, noFail, laps, off (m behind the line on the grid), night, moist (0..1 how tacky at the flag),
          lap0 (laps the clay has seen before this race), wornAt?, skill? (AI driver 0..1), gap? (fn(sTot,t) -> metres to the car ahead) }
     step(dt, ctl) takes ctl {c} (pace multiplier) or null for the auto driver. */
  function ovalNew(res, veh) {
    const C0 = OVAL_CLASSES[veh && veh.cls] || OVAL_CLASSES.street, CV = C0.veh;
    const v = Object.assign({ cls: C0.id, track: "clay", tyre: "med", grille: "mid", finalK: 1, redline: 6500, idle: 850, seed: 1, noFail: false, laps: 25, off: 0, night: null, moist: 0.5, lap0: 0, skill: 0.88 }, veh || {});
    const TR = ovalTrack(v.track), N0 = v.night || ovalNight(v.seed, TR), L = TR.len, R = TR.R, Ls = TR.ls, PR = Math.PI * R, clayT = TR.surf === "clay", amb = N0.amb != null ? N0.amb : 30;
    const rpms = res.rpms, tq = res.torque, NR = rpms.length, rng = pullRng(v.seed), rngLap = pullRng(((v.seed >>> 0) ^ 0x7A11) >>> 0);
    const interp = (arr, r) => { if (r <= rpms[0]) return arr[0]; if (r >= rpms[NR - 1]) return arr[NR - 1]; let i = 1; while (rpms[i] < r) i++; const f = (r - rpms[i - 1]) / (rpms[i] - rpms[i - 1]); return arr[i - 1] + f * (arr[i] - arr[i - 1]); };
    const TY = OVAL_TYRES[v.tyre] || OVAL_TYRES.med, GR = OVAL_GRILLES[v.grille] || OVAL_GRILLES.mid;
    const VdL = Math.max(0.5, (res.VdEq || res.Vd || 2000) / 1000), kg = +res.kg || CV.engRef;
    const m = CV.mass + 0.35 * (kg - CV.engRef), rf = CV.rf - 0.0002 * (kg - CV.engRef), rw = CV.tyreDia * 0.0254 / 2;
    const G = (v.redline * 2 * Math.PI / 60) * rw / (CV.vTop * TR.vTopK) / clamp(+v.finalK || 1, 0.6, 1.6), eta = 0.9, red = v.redline, lim = red * 1.03;
    const Tfric = 0.10 * (res.peakTq || 300), pkTq = Math.max.apply(null, tq), tqLow = interp(tq, 0.45 * red) / Math.max(1, pkTq);
    const tauEng = 0.05 + 0.3 * Math.pow(clamp(1 - tqLow, 0, 1), 1.5);
    const cdA = CV.cdA * GR.cd, crr = TR.crr, cgwb = 0.2;
    const kind = res.aspKind || "na", bT = +res.boostTarget || 0;
    let trans = kind !== "na" && bT > 0 && Array.isArray(res.naTorque) && res.naTorque.length === NR && Array.isArray(res.boostCurve) && res.boostCurve.length === NR, gpb = null;
    if (trans) { gpb = new Array(NR); const valid = [];
      for (let i = 0; i < NR; i++) { const b = res.boostCurve[i]; if (b > Math.max(0.10, 0.15 * bT)) { gpb[i] = Math.max(0, tq[i] - res.naTorque[i]) / b; valid.push(i); } else gpb[i] = null; }
      if (!valid.length) trans = false;
      else for (let i = 0; i < NR; i++) if (gpb[i] == null) { let j = valid[0]; for (const k of valid) if (Math.abs(k - i) < Math.abs(j - i)) j = k; gpb[i] = gpb[j] * Math.max(0, res.naTorque[i]) / Math.max(1, res.naTorque[j]); } }
    const isTurbo = trans && kind === "turbo", tqCap = pkTq * 1.06, mmT = res.turboMm || 54;
    const tauBase = (0.25 + 1.0 * clamp((mmT - 46) / 52, 0, 1.2)) * (res.turboUnits === 2 && !res.compound ? 0.78 : 1) * clamp(Math.pow(2.5 / VdL, 0.3), 0.55, 1.5) * (res.vgt ? 0.72 : 1);
    const pkRpm = res.peakHpRpm || red * 0.85, bssAt = r => trans ? Math.max(0, interp(res.boostCurve, r)) : 0;
    const torqueAt = r => r <= rpms[0] ? tq[0] * Math.max(0.3, r / rpms[0]) : interp(tq, r);
    function fullTq(r) { if (!trans) return torqueAt(r); const full = torqueAt(r), d = st.boost - bssAt(r), gb = interp(gpb, r);
      return d >= 0 ? Math.min(full + gb * d, Math.max(tqCap, full)) : Math.max(interp(res.naTorque, r), full + gb * d); }
    function boostStep(dt, r, load) { if (!trans) { st.boost = 0; return; }
      const tgt = Math.min(bT, bssAt(r) * Math.pow(clamp(load, 0, 1), isTurbo ? 1.5 : 1)); let tau = 0.05;
      if (isTurbo) { tau = tgt > st.boost ? tauBase / Math.pow(clamp(r * Math.max(0.15, load) / pkRpm, 0.08, 1.3), 0.75) : 0.35; if (res.compound && tgt > st.boost) tau *= st.boost > 0.5 * bT ? 1.35 : 0.7; }
      st.boost = clamp(st.boost + (tgt - st.boost) * (1 - Math.exp(-dt / Math.max(0.03, tau))), 0, bT); }
    const hasEgt = Array.isArray(res.egtCurve) && res.egtCurve.length === NR, egtLimit = res.egtLimitC || (res.diesel ? 900 : 960);
    const tU = id => { const t = (res.tests || []).find(x => x.id === id); return t ? t.util : 0; };
    const Cth = (7 + 2.6 * VdL) * 1000, UA = CV.kw * 1000 * 0.5 / 62 * 0.36 * GR.ua / clamp(0.55 + 1.0 * tU("cooling"), 0.7, 1.6), hFrac = res.diesel ? 0.42 : 0.52;
    // hazard of something letting go under load: the stressed tests, a little each second
    const hz = (res.tests || []).map(t => ({ id: t.id, h: Math.max(0, (t.util || 0) - 0.85) * 0.0012 })).filter(q => q.h > 0), hzTot = hz.reduce((a, q) => a + q.h, 0);
    const st = { t: 0, s: -Math.max(0, +v.off || 0), v: Math.min(CV.vTop * 0.45, 20), rpm: v.idle * 3, thr: 0, tf: 0, foot: 0, boost: 0, c: 0.98, cool: 84 + 6 * clamp(tU("cooling"), 0, 1.2), coolPeak: 0, hotT: 0, radPack: 0, egt: 420, egtPeak: 420, egtDose: 0,
      wear: 0, lap: 0, laps: [], lapT0: 0, cid: 0, xi: 1, aim: 0.98, over: 0, slideK: 0, vlimE: 25, slideT: 0, slides: 0, spinT: 0, wot: 0, loadT: 0, maxV: 0, broke: null, failKind: null, failAt: Infinity, done: false, finish: null,
      mu: 0.7, vlim: 25, vc: 25, dirty: 0, derate: 1, derT: 0, trace: [], bestLap: Infinity, last: 0, spin: 0, lugT: 0, thrN: 0, thrT: 0, stopWhy: null, rpmCorner: 0, rpmExit: 0 };
    st.coolPeak = st.cool;
    if (!v.noFail && res.fails && res.fails.length) { const t0 = (res.tests || []).find(x => x.name === res.fails[0]); st.failKind = t0 ? t0.id : "rod_tension"; st.failAt = (v.laps * TR.lapRef) * (0.12 + 0.55 * rng()); }
    const egtTrip = 25 + rng() * 55;
    let hzRoll = rng() * 1, hzAcc = 0, lastTrace = -1, cornerRho = 0, cornerN = 0, loadT = 0;
    const ab = CV.brake * TR.brakeK * OVAL_G, feel = clamp(v.skill, 0.2, 1);
    function lapNoise(k) { return rngLapAt(k); }
    const noiseCache = {}; function rngLapAt(k) { if (noiseCache[k] == null) noiseCache[k] = ovalGaussian(rngLap); return noiseCache[k]; }
    function sub(dt) {
      st.t += dt;
      // the clay: tacky at the flag, drying with every lap the field has run on it; tyres wear on top
      const laps = (v.lap0 || 0) + Math.max(0, st.s) / L, tack = clamp(v.moist * N0.wet * 1.2, 0, 1) * Math.exp(-laps / (6 + 8 * N0.fast));
      const wearK = 1 - TR.wearMu * Math.pow(clamp(st.wear, 0, 1.3), 1.3);
      st.mu = N0.mu * CV.mu / 0.7 * (1 + 0.10 * tack) * TY.mu * wearK;
      if (!clayT) st.mu *= 1 - 0.05 * N0.grease * (1 - Math.exp(-laps / 12));   // asphalt: no clay to dry out, but the rubber and the heat grease it a little
      st.vlim = ovalVlim(st.mu, TR);
      // the speed a corner can be HELD at: the thrust it takes to keep rolling (air, clay, the scrub of a car that is always slightly sideways) is carried by the same
      // tyres, so it eats into the lateral grip. Solve for the fraction of the pure banked-turn limit that leaves that much traction.
      const muxE = st.mu * (1 + 0.05 * clamp(v.moist * N0.wet * 1.2, 0, 1) * Math.exp(-laps / (6 + 8 * N0.fast))), FtrE = muxE * m * OVAL_G * rf / (1 - muxE * cgwb), Frr0 = crr * m * OVAL_G;
      let rs = 0.96; for (let it = 0; it < 3; it++) { const v1 = rs * st.vlim, F = 0.5 * 1.15 * cdA * v1 * v1 + Frr0 + m * (v1 * v1 / R) * TR.scrub; rs = Math.pow(Math.max(0.02, 1 - Math.pow(Math.min(0.999, F / FtrE), 2)), 0.25); }
      st.vlimE = st.vlim * rs;
      // where on the oval
      const sl = ((st.s % L) + L) % L, sp = (sl + Ls / 2) % L;
      let inC = false, dEnt = 0, cid = 0;
      if (sp >= Ls && sp < Ls + PR) { inC = true; cid = 1; } else if (sp >= 2 * Ls + PR) { inC = true; cid = 2; } else dEnt = sp < Ls ? Ls - sp : 2 * Ls + PR - sp;
      // the driver
      const lapNow = Math.max(0, Math.floor(st.s / L));
      if (st.cid !== cid) { st.cid = cid; if (cid) { st.xi = 1 + 0.02 * ovalGaussian(rng); const aim = st.c * (1 + ((1 - feel) * 0.028 + 0.004 * clamp((st.c - 0.97) / 0.03, 0, 1)) * ovalGaussian(rng)); st.aim = Math.min(aim, 1); st.over = Math.max(0, aim - 1); if (st.over > 0.003) { st.slides++; st.slideT = 0.9; st.slideK = clamp(st.over / 0.012, 0.15, 1); st.slideEv = { t: st.t, lap: lapNow + 1, over: st.over }; } cornerRho = 0; cornerN = 0; } }
      const gap = v.gap ? v.gap(st.s, st.t) : Infinity;
      st.dirty += ((gap < 18 ? clamp(1 - gap / 18, 0, 1) : 0) - st.dirty) * Math.min(1, dt * 2);
      const hold = st.xi * st.aim * (1 - 2.2 * (st.over > 0.003 ? st.over : 0)) * (1 - TR.dirtyK * st.dirty);
      st.vc = st.vlimE * hold;
      const vt = inC ? st.vc : Math.sqrt(st.vc * st.vc + 2 * ab * Math.max(0, dEnt - 4));
      // engine speed, torque, the demand
      const sp0 = Math.max(0, st.v), rpmW = sp0 * G / rw * 60 / (2 * Math.PI);
      st.rpm = Math.max(rpmW, v.idle * 1.4);
      const rpm = st.rpm, cool = st.cool;
      boostStep(dt, rpm, st.tf);
      const derate = cool > 112 ? clamp(1 - 0.04 * (cool - 112), 0.5, 1) : 1; st.derate = derate;
      const Tfull = fullTq(rpm) * derate * (rpm > red ? clamp((lim - rpm) / (lim - red), 0, 1) : 1);
      const Fe_full = Math.max(1, Tfull * G * eta / rw);
      // wheel resistance: air, the clay, a cornering car's scrub
      const aLat = inC ? sp0 * sp0 / R : 0, Fair = 0.5 * 1.15 * cdA * sp0 * sp0, Frr = crr * m * OVAL_G, Fscrub = inC ? m * aLat * (TR.scrub + (st.slideT > 0 ? 0.12 * st.slideK : 0)) : 0;
      const Fres = Fair + Frr + Fscrub;
      // traction: the rear tyres' limit on the clay, what the corner has already used
      const mux = st.mu * (1 + 0.05 * tack), Ftr0 = mux * m * OVAL_G * rf / (1 - mux * cgwb), rho = inC ? clamp(sp0 / st.vlim, 0, 1.2) : 0;
      let Ftr = inC ? Ftr0 * Math.sqrt(Math.max(0, 1 - Math.pow(rho, 4))) : Ftr0;
      if (st.slideT > 0) { Ftr *= 1 - clamp(6 * st.over, 0, 0.5) * Math.min(1, st.slideT / 0.5); st.slideT -= dt; }
      // the foot: what's needed to hold or gain the target, never more than the clay will take (the driver's feel)
      let thrCmd, brake = 0;
      const dv = vt - sp0;
      if (dv < -0.12) { thrCmd = 0; brake = Math.min(ab * m, m * (-dv) / Math.max(dt, 0.15) * 0.9); }
      else thrCmd = clamp((Fres + m * dv / 0.35) / Fe_full, 0, 1);
      const thrTr = (Ftr * (1.01 + (1 - feel) * 0.12)) / Fe_full;
      st.thrN += 1; if (thrCmd > thrTr) st.thrT += dt;
      st.thr = Math.min(thrCmd, thrTr);
      // the pedal and the engine's own pickup: the torque ramps up in tauEng + 0.12 s from nothing to full, and comes off in 0.06
      const up = dt / (tauEng + 0.12), dn = dt / 0.06;
      st.tf = st.thr > st.tf ? Math.min(st.thr, st.tf + up) : Math.max(st.thr, st.tf - dn);
      let Te = st.tf * Tfull - (1 - st.tf) * Tfric * clamp(rpm / red, 0.3, 1);
      if (rpm > red) Te = Math.min(Te, 0);
      const Fe = Te * G * eta / rw;
      let Fd = Fe, spin = 0;
      if (Fe > Ftr) { spin = Fe / Math.max(1, Ftr); Fd = Ftr * (0.86 + 0.14 / spin); st.spinT += dt * clamp(spin - 1, 0, 1); }
      st.spin = spin;
      let acc = (Fd - Fres - brake) / m; if (st.v <= 0 && acc < 0) acc = 0;
      st.v = Math.max(1, st.v + acc * dt); st.s += st.v * dt; st.acc = acc;
      st.maxV = Math.max(st.maxV, st.v);
      if (inC) { cornerRho += rho; cornerN++; if (cornerN > 5) st.rpmCorner = rpm; } else st.rpmExit = Math.max(st.rpmExit, rpm);
      if (rpm < v.idle * 2 && st.tf > 0.6) st.lugT += dt;
      // tyres: lateral load, the slide, wheelspin
      st.wear += dt * TY.wear * 0.45 * (0.0005 + 0.0021 * Math.pow(rho, 4) + (st.slideT > 0 ? 0.004 * st.slideK : 0) + 0.0018 * clamp(spin - 1, 0, 1) + 0.0004 * (1 - tack));
      // heat
      const Pk = Math.max(0, Te) * rpm * 2 * Math.PI / 60, air = 0.28 + 0.72 * clamp(st.v / 16, 0, 1);
      st.radPack = clamp(st.radPack + dt * (st.dirty * 0.0034 * GR.pk * TR.dust + 0.0003 * GR.pk * TR.dust - (gap > 30 ? 0.004 : 0.0006) * (0.4 + st.radPack)), 0, 0.85);
      st.cool += dt * (hFrac * Pk - UA * (st.cool - amb) * air * clamp((st.cool - 78) / 14, 0.15, 1) * (1 - 0.6 * st.radPack)) / Cth;   // the thermostat keeps it warm
      st.coolPeak = Math.max(st.coolPeak, st.cool); if (st.cool > 122) st.hotT += dt; else st.hotT = Math.max(0, st.hotT - dt * 0.5);
      if (st.cool > 112) st.derT += dt;
      const egtT = (hasEgt ? interp(res.egtCurve, rpm) : (res.diesel ? 720 : 800)) * (0.4 + 0.6 * st.tf);
      st.egt += (egtT - st.egt) * (1 - Math.exp(-dt / 6)); st.egtPeak = Math.max(st.egtPeak, st.egt);
      if (st.egt > egtLimit) st.egtDose += dt * (st.egt - egtLimit) / 60;
      if (st.tf > 0.5) loadT += dt;
      st.loadT = loadT;
      // laps
      const lapK = Math.floor(st.s / L);
      if (lapK > st.lap) { const lt = st.t - st.lapT0; st.laps.push(+lt.toFixed(3)); st.lapT0 = st.t; st.lap = lapK; st.last = lt; if (st.lap > 1 || (v.off || 0) === 0) st.bestLap = Math.min(st.bestLap, lt);
        if (st.lap >= v.laps) { st.done = true; st.finish = st.t; st.stopWhy = "flag"; } }
      // something lets go
      if (!v.noFail && !st.broke) {
        hzAcc += hzTot * dt * (st.tf > 0.3 ? 1 : 0.3);
        if (st.failKind && loadT >= st.failAt) st.broke = st.failKind;
        else if (v.wornAt && st.lap >= v.wornAt) st.broke = "worn";
        else if (st.hotT > 2.2) st.broke = "head_lift";
        else if (st.egtDose > egtTrip) st.broke = isTurbo && (res.egtLimitC || 0) <= st.egt ? "turbo" : res.diesel ? "piston" : "crown_temp";
        else if (hzTot > 0 && hzAcc > hzRoll * 1.0 + 0.0) { const pick = rng() * hzTot; let a = 0, id = hz[0].id; for (const q of hz) { a += q.h; if (pick <= a) { id = q.id; break; } } st.broke = id; hzRoll = 9; }
        if (st.broke) { st.failKind = st.broke; st.stopWhy = "broke"; st.done = true; st.finish = null; }
      }
      if (st.t - lastTrace >= 0.25) { lastTrace = st.t; st.trace.push([+st.t.toFixed(2), +st.s.toFixed(1), +st.v.toFixed(1), Math.round(st.rpm), Math.round(st.cool), +st.mu.toFixed(3), +st.wear.toFixed(3)]); }
    }
    function step(dt, ctl) {
      if (ctl && ctl.c != null) st.c = clamp(+ctl.c, 0.8, 1.08);
      else st.c = auto(v.skill);
      dt = Math.min(0.25, Math.max(0, dt)); let n = Math.max(1, Math.ceil(dt / 0.02)); const h = dt / n;
      while (n-- > 0 && !st.done) sub(h);
      return st;
    }
    /* the auto driver: a pace from his skill and a bit of lap-to-lap noise; he eases when the water is hot or the tyres are gone.
       From skill 0.75 to 0.9 he learns the pace the node harness found quickest over a race (0.998 of the limit at skill 1,
       0.995 at 0.9: a slide now and then is cheaper than lifting), and saves the water only once it is near trouble (117 °C,
       then harder) rather than from 106 */
    function auto(skill) {
      const k = skill == null ? 0.88 : skill, lapNow = Math.max(0, Math.floor(st.s / L));
      const e = (1 - clamp(k, 0.2, 1)) * 0.028, f = clamp((k - 0.75) / 0.15, 0, 1), hot = 106 + 11 * f;
      let c = 1 - 1.2 * e - 0.006 + 0.004 * f + lapNoise(lapNow) * e * 0.5;
      if (st.cool > hot) c -= 0.006 * (1 - f) + (0.0016 + 0.0044 * f) * (st.cool - hot); if (st.wear > 0.8) c -= 0.006;
      return clamp(c, 0.9, 1.04);
    }
    function result() {
      const reasons = [], laps = st.laps, best = laps.length ? Math.min.apply(null, laps) : null;
      if (st.broke) reasons.push(st.broke === "head_lift" ? clayT ? `The water hit ${Math.round(st.coolPeak)} °C with the radiator ${Math.round(st.radPack * 100)}% clogged with clay: it lifted the head. A more open grille, or less time in the car ahead's dust.` : `The water hit ${Math.round(st.coolPeak)} °C: a lap of mostly full throttle at these speeds gives it little rest, and it lifted the head. A more open grille, or SAVE on the straights.` : st.broke === "turbo" ? `The turbine inlet sat at ${Math.round(st.egtPeak)} °C: the hot side let go.` : st.broke === "piston" || st.broke === "crown_temp" ? `The exhaust ran at ${Math.round(st.egtPeak)} °C: it burned a piston.` : "A part gave up under load.");
      if (st.derT > 4) reasons.push(`${st.derT.toFixed(0)} s above 112 °C with the engine pulling power to save itself.`);
      if (st.spinT > 3) reasons.push(`${st.spinT.toFixed(1)} s of wheelspin: more torque than the ${clayT ? "clay" : "asphalt"} would take at that gearing.`);
      if (st.lugT > 3) reasons.push(`${st.lugT.toFixed(1)} s lugging under ${Math.round(v.idle * 2).toLocaleString()} rpm. A shorter gear would keep it on the cam.`);
      if (st.slides > 0) reasons.push(`${st.slides} slide${st.slides === 1 ? "" : "s"}: pace past what the corner held.`);
      return { laps: laps, lapN: laps.length, best: best, time: st.finish, finished: st.done && !st.broke, broke: st.broke, failKind: st.broke ? st.failKind : null, coolPeak: Math.round(st.coolPeak), radPack: +st.radPack.toFixed(2), wear: +st.wear.toFixed(2),
        peakEgt: Math.round(st.egtPeak), maxKmh: Math.round(st.maxV * 3.6), slides: st.slides, spinT: +st.spinT.toFixed(1), derT: +st.derT.toFixed(1), lugT: +st.lugT.toFixed(1), mu: +st.mu.toFixed(3), reasons: reasons,
        ratio: +G.toFixed(2), mass: Math.round(m), tyre: TY.n, grille: GR.n, cls: v.cls, track: TR.id, rpmCorner: Math.round(st.rpmCorner), rpmExit: Math.round(st.rpmExit), trace: st.trace };
    }
    return { st: st, step: step, auto: auto, result: result, night: N0, G: G, mass: m, vc0: ovalVlim(N0.mu * CV.mu / 0.7 * TY.mu, TR), track: TR };
  }
  /* a rival's engine: a broad petrol torque curve for the class's power, redline 6.2–7.4k */
  function ovalAiRes(hp, seed) {
    const r = bogAiRes(hp, false, seed); r.VdEq = 5400 + Math.round(pullRng(seed ^ 0x77)() * 2000); r.kg = 190; return r;
  }
  /* a whole race (or a stretch of one) with the auto driver's hands on it: the AI field and the node harness */
  function ovalPass(res, veh, skill, dt) { const p = ovalNew(res, Object.assign({}, veh, { skill: skill == null ? 0.88 : skill })); let n = 0; while (!p.st.done && n++ < 200000) p.step(dt || 0.04, null); return p; }
  /* what this build does in this class with this gearing, at a glance: corner speed and rpm, torque there, the fit */
  function ovalSetup(res, veh) {
    const C0 = OVAL_CLASSES[veh.cls] || OVAL_CLASSES.street, CV = C0.veh, red = veh.redline || 6500, rw = CV.tyreDia * 0.0254 / 2, TR = ovalTrack(veh.track);
    const G = red * 2 * Math.PI / 60 * rw / (CV.vTop * TR.vTopK) / clamp(+veh.finalK || 1, 0.6, 1.6), N0 = ovalNight(veh.seed || 1, TR), TY = OVAL_TYRES[veh.tyre] || OVAL_TYRES.med;
    const vc = ovalVlim(N0.mu * CV.mu / 0.7 * TY.mu, TR), rpmC = vc * G / rw * 60 / (2 * Math.PI), rpmE = clamp(rpmC * 1.15, 0, red), top = red * 2 * Math.PI / 60 * rw / G;
    const rp = res.rpms, tq = res.torque, at = r => { if (r <= rp[0]) return tq[0]; if (r >= rp[rp.length - 1]) return tq[tq.length - 1]; let i = 1; while (rp[i] < r) i++; return tq[i - 1] + (tq[i] - tq[i - 1]) * (r - rp[i - 1]) / (rp[i] - rp[i - 1]); };
    return { ratio: G, vc: vc, rpmC: rpmC, rpmE: rpmE, tqC: at(rpmC), tqE: at(rpmE), topKmh: top * 3.6, topMs: top, redline: red, vTop: CV.vTop * TR.vTopK };
  }

;({e24Amb:e24Amb,e24Sky:e24Sky,enduroPrep:enduroPrep,e24Rates:e24Rates,e24AiPrep:e24Ai,enduroClasses:enduroClasses,enduroClassOf:enduroClassOf,enduroNew:enduroNew,e24Need:e24Need,e24Lap:e24Lap,e24Order:e24Order,e24Pos:e24Pos,enduroStep:enduroStep,enduroWhere:enduroWhere,enduroResult:enduroResult,hillCourse:hillCourse,hillPrep:hillPrep,hillCar:hillCar,hillCalls:hillCalls,hillPlan:hillPlan,hillNew:hillNew,hillPass:hillPass,hillAiPrep:hillAiPrep,dragRun:dragRun,dragPass:dragPass,dragDriver:dragDriver,pullTrackK:pullTrackK,pullRun:pullRun,pullPass:pullPass,pullDriver:pullDriver,bogRun:bogRun,bogPrep:bogPrep,bogPass:bogPass,bogAiRes:bogAiRes,roadPrep:roadPrep,roadCar:roadCar,roadRun:roadRun,lapSim:lapSim,roadTest:roadTest,lsrFoot:lsrFoot,boatRun:boatRun,boatGuess:boatGuess,boatPrep:boatPrep,boatPass:boatPass,boatTune:boatTune,ovalVlim:ovalVlim,ovalPrep:ovalPrep,ovalNew:ovalNew,ovalAiRes:ovalAiRes,ovalPass:ovalPass,ovalSetup:ovalSetup})
//# sourceURL=sim-late.js
