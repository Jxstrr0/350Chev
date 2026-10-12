  /* =====================================================================
     BONNEVILLE — land-speed runs on the salt.
     A push truck rolls the car to ~27 mph, then the driver has a run-up (one mile on the
     short course, two on the long) to the timed mile, then shuts off and pulls the chute.
     The run is straight-line physics at the event's air: the engine curve comes from
     simulate() re-run at 1,290 m and 32 °C (lsrPrep), so an atmospheric engine is down
     about 13% on its cell figure and a blown one much less.
       drive  = engine torque × gear × efficiency ÷ tyre radius, until the tyre lets go:
                salt grips about μ 0.55 against a tyre slipping ~8%, less once it spins,
                so the early gears are traction-limited and the driver feathers them
       drag   = ½ ρ CdA v²  (a streamliner's CdA is a third of a street body's)
       lift   = ½ ρ ClA v², mostly over the front: past half the front's static load the
                car wanders, near none of it the car is flying — the driver has to lift
       roll   = Crr (salt, rising with speed) × weight
     A minute or more at full load is what Bonneville asks of an engine: coolant heat
     builds against a radiator (or soaks into an ice tank), the exhaust heat-soaks, and
     every second near the redline is a small chance for the build's weakest part to let
     go — larger the closer the sim's own tests put that part to its limit.
     ===================================================================== */
  const SALT_ENV = { ambientC: 32, altitudeM: 1290, humidity: 20 };
  const LSR_MILE = 1609.344;
  const LSR_COURSES = {
    short: { n: "Short course", runup: 1, shut: 1.5, d: "1-mile run-up · timed mile 1–2" },
    long: { n: "Long course", runup: 4, shut: 2.5, d: "4-mile run-up · timed mile 4–5" }
  };
  // body classes in the SCTA spirit. mass is the car without its engine; ClA lift (+) per unit dynamic pressure;
  // liftF the share of the lift over the front axle; kRad the radiator's kW per °C at speed
  const LSR_BODIES = {
    altered: { n: "Altered", code: "ALT", d: "street body · big radiator · lifts at speed", mass: 1250, cdA: 0.78, clA: 1.0, liftF: 0.7, rear: 0.50, wb: 2.70, cgH: 0.50, tyreDia: 26.5, kRad: 3.0, radDrag: 0, rep: 0, course: "short",
      aero: { n: "Rear spoiler", cl: -0.55, cd: 0.07 } },
    roadster: { n: "Modified roadster", code: "MR", d: "open roadster · long nose · radiator", mass: 950, cdA: 0.62, clA: 0.7, liftF: 0.60, rear: 0.56, wb: 2.75, cgH: 0.45, tyreDia: 27, kRad: 2.6, radDrag: 0, rep: 0, course: "short",
      aero: { n: "Rear spoiler", cl: -0.40, cd: 0.06 } },
    lakester: { n: "Lakester", code: "L", d: "belly-tank body · open wheels", mass: 760, cdA: 0.36, clA: 0.12, liftF: 0.55, rear: 0.58, wb: 2.90, cgH: 0.38, tyreDia: 26, kRad: 1.3, radDrag: 0.02, rep: 60, course: "long",
      aero: { n: "Nose canards", cl: -0.15, cd: 0.02 } },
    streamliner: { n: "Streamliner", code: "S", d: "wheels enclosed · lowest drag · twitchy", mass: 1150, cdA: 0.26, clA: 0.06, liftF: 0.55, rear: 0.62, wb: 4.60, cgH: 0.34, tyreDia: 27, kRad: 0.6, radDrag: 0.025, rep: 200, course: "long", narrow: true,
      aero: { n: "Trim tabs", cl: -0.30, cd: 0.015 } }
  };
  for (const k in LSR_BODIES) LSR_BODIES[k].id = k;
  // engine classes by displacement, SCTA-style letters (upper bound in litres; AA is unlimited)
  const LSR_DISP = [["J", 0.75], ["I", 1.0], ["H", 1.5], ["G", 2.0], ["F", 3.0], ["E", 4.25], ["D", 5.0], ["C", 6.1], ["B", 7.2], ["A", 8.2], ["AA", Infinity]];
  const LSR_FUELS = { G: "gas", F: "fuel", D: "diesel" };
  // rated: the fastest the canopy survives opening (m/s). The dual pack is a small high-speed drogue plus the main.
  const LSR_CHUTES = { none: { n: "No chute", cdA: 0, rated: 0, kg: 0 }, single: { n: "Single chute", cdA: 1.5, rated: 134, kg: 9 }, dual: { n: "Drogue + main", cdA: 2.0, rated: 134, kg: 18, drogue: { cdA: 0.7, rated: 225 } } };
  function lsrChuteMax(id) { const c = LSR_CHUTES[id] || LSR_CHUTES.none; return c.drogue ? c.drogue.rated : c.rated; }
  const LSR_RATIOS = [2.45, 1.70, 1.30, 1.0];   // four-speed, relative to top gear
  function lsrDispClass(L) { for (const d of LSR_DISP) if (L <= d[1] + 1e-9) return d[0]; return "AA"; }
  /* the class an engine runs in: displacement letter / (B = blown) fuel letter + body code, e.g. "C/BGALT" */
  function lsrClass(cfg, res, body) {
    cfg = Object.assign({}, DEFAULT_CFG, cfg || {});
    const fu = OPT.fuel[cfg.fuel] || {}, asp = OPT.asp[cfg.asp] || OPT.asp.na;
    const L = res && res.Vd ? res.Vd / 1000 : geometry(cfg).Vd * 1000;
    const n2o = cfg.nitrous && cfg.nitrous !== "none";
    const fuel = fu.ci ? "D" : (cfg.fuel === "e85" || cfg.fuel === "methanol" || n2o) ? "F" : "G";
    const blown = asp.kind !== "na";
    const disp = lsrDispClass(L), B = LSR_BODIES[body] || LSR_BODIES.altered;
    return { disp: disp, fuel: fuel, blown: blown, body: B.id, litres: +L.toFixed(2), key: disp + "/" + (blown ? "B" : "") + fuel + B.code, fuelName: LSR_FUELS[fuel], n2o: !!n2o };
  }
  function lsrRng(seed) { let a = (seed >>> 0) || 1; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function lsrHash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  /* the engine curve at the salt: simulate() again in Bonneville's thin, hot air (plus what a pass needs from dragPrep) */
  function lsrPrep(cfg, env) {
    const e = Object.assign({}, DEFAULT_ENV, env || {}, SALT_ENV, { testType: "pull" });
    const res = dragPrep(cfg, e);
    res.saltEnv = { ambientC: e.ambientC, altitudeM: e.altitudeM, rho: ambient(e).rho };
    return res;
  }

  /* veh: { body, course "short"|"long", topMph (road speed at the redline in top gear), redline, shiftRpm, shift "auto"|"manual",
     aero (spoiler/canards/tabs on), ballast kg, cooling "radiator"|"ice", chute "none"|"single"|"dual", seed, noFail, rho, wornAt, h (step s) }.
     step(dt, throttle) takes the driver's foot 0..1; shift() asks for the next gear; chute() pulls the chute after the mile. */
  function lsrRun(res, veh) {
    const B = (veh && veh.bodyObj) || LSR_BODIES[veh && veh.body] || LSR_BODIES.altered;   // bodyObj: a swap vehicle (sim/swap.js)
    const v = Object.assign({ body: B.id, course: B.course, topMph: 200, redline: 7000, shiftRpm: 0, shift: "auto", aero: false, ballast: 0, cooling: B.id === "streamliner" ? "ice" : "radiator", chute: "single",
      seed: 1, noFail: false, rho: res.saltEnv ? res.saltEnv.rho : 1.0, ambientC: res.saltEnv ? res.saltEnv.ambientC : SALT_ENV.ambientC, idle: 900, h: 0.002, autoChute: true }, veh || {});
    const CO = LSR_COURSES[v.course] || LSR_COURSES.short, CH = LSR_CHUTES[v.chute] || LSR_CHUTES.none, rng = lsrRng(v.seed);
    const rpms = res.rpms, tq = res.torque, N = rpms.length, g = 9.81;
    const interp = (arr, r) => { if (r <= rpms[0]) return arr[0]; if (r >= rpms[N - 1]) return arr[N - 1]; let i = 1; while (rpms[i] < r) i++; const f = (r - rpms[i - 1]) / (rpms[i] - rpms[i - 1]); return arr[i - 1] + f * (arr[i] - arr[i - 1]); };
    const torqueAt = r => r <= rpms[0] ? tq[0] * clamp(r / rpms[0], 0.35, 1) : interp(tq, r);
    v.topMph = isFinite(+v.topMph) && +v.topMph > 0 ? clamp(+v.topMph, 40, 650) : 200;
    v.redline = isFinite(+v.redline) && +v.redline > 1000 ? +v.redline : 7000; v.ballast = clamp(+v.ballast || 0, 0, 500);
    const rw = B.tyreDia * 0.0254 / 2, red = v.redline, wRed = red * 2 * Math.PI / 60;
    const topMs = Math.max(20, v.topMph * 0.44704), Gtop = wRed / (topMs / rw);   // overall engine : wheel ratio in top
    const ratios = LSR_RATIOS.map(r => r * Gtop), NG = ratios.length;
    const shiftRpm = v.shiftRpm > 0 ? Math.min(red, v.shiftRpm) : Math.min(red * 0.985, Math.max(res.peakHpRpm || red, red * 0.9));
    const eta = 0.90, engKg = res.kg || 200, m = B.mass + engKg + (+v.ballast || 0) + CH.kg;
    const ice = v.cooling === "ice";
    const cdA = B.cdA + (v.aero ? B.aero.cd : 0) + (ice ? 0 : B.radDrag), clA = B.clA + (v.aero ? B.aero.cl : 0);
    const VdL = Math.max(0.5, (res.Vd || 2000) / 1000), Ie = 0.12 + 0.07 * VdL, Iw = 2 * 1.3;
    const Nf0 = m * g * (1 - B.rear) - (+v.ballast || 0) * g * 0.4;   // ballast rides over the rear axle
    const rearStatic = m * g - Nf0;
    const peakW = Math.max(1, (res.peakHp || 100) * 745.7), coolKw = (res.thermals && res.thermals.coolantLoadKw) || 0.37 * (res.peakHp || 100);
    const capKJ = 0.45 * engKg + 50 + (ice ? 420 : 0), kRad = ice ? 0.12 : B.kRad * (0.75 + 0.25 * ((res.thermals && res.thermals.coolCap) || 1));   // the body radiator is the stock pack; the engine's own cooling choice scales it
    const hasEgt = Array.isArray(res.egtCurve) && res.egtCurve.length === N;
    const isTurbo = (res.aspKind || "na") === "turbo", egtLimit = res.egtLimitC || (res.diesel ? 900 : 0);
    const worst = (res.tests || []).reduce((a, t) => Math.max(a, +t.util || 0), 0);
    const hazK = 0.0003 * Math.exp((clamp(worst, 0.5, 1.2) - 0.85) * 14);
    const muPk = 0.72, sPk = 0.08, muSlide = 0.52;
    function mu(s) { const a = Math.abs(s); return (a < sPk ? muPk * Math.sin(Math.PI / 2 * a / sPk) : muSlide + (muPk - muSlide) * Math.exp(-(a - sPk) / 0.18)) * Math.sign(s || 1); }
    const x0 = CO.runup * LSR_MILE, x1 = x0 + LSR_MILE, k0 = (x0 + x1) / 2 - 500, k1 = k0 + 1000, xEnd = x1 + CO.shut * LSR_MILE;
    const st = { t: 0, x: 0, v: 0, w: 0, rpm: v.idle, gear: 0, thr: 0, foot: 0, phase: "stage", done: false, slip: 0, light: 1, loose: 0, Nf: Nf0, Nr: rearStatic, lift: 0, drag: 0, acc: 0,
      shiftT: 0, shifts: 0, shiftReq: false, limiter: 0, limT: 0, clutch: true, coolC: ice ? 45 : 85, coolMax: 0, egt: 450, egtPeak: 450, egtDose: 0, loadT: 0, fullT: 0,
      chuteOut: false, chuteAt: null, chuteMph: null, chuteBlown: false, chuteK: 0, drogueOut: false, drogueK: 0, drogueMph: null, chuteWait: false, braking: false, broke: null, failKind: null, failAt: Infinity, haz: 0, hazRoll: rng(), stopWhy: null,
      tIn: null, tOut: null, tK0: null, tK1: null, vIn: null, vOut: null, peakV: 0, peakRpm: 0, spinT: 0, wanderT: 0, lightMin: 1, trace: [], pushT: 0, offEnd: false,
      x0: x0, x1: x1, k0: k0, k1: k1, xEnd: xEnd, gears: NG, mileMph: null, kmMph: null, overRev: 0, lifted: 0 };
    if (!v.noFail && res.fails && res.fails.length) { const t0 = (res.tests || []).find(q => q.name === res.fails[0]); st.failKind = t0 ? t0.id : "rod_tension"; st.failAt = 3 + rng() * 16; }
    const egtTrip = 1.5 + rng() * 2.5;
    let lastTrace = -1;
    function engT(r, thr) {
      let T = thr * torqueAt(r) - (1 - thr) * 0.08 * (res.peakTq || 300) * clamp(r / red, 0.3, 1);
      if (r > red) { T = Math.min(T, thr * torqueAt(red) * clamp((red * 1.015 - r) / (red * 0.015), 0, 1)); }
      if (st.coolC > 112) T *= 1 - 0.008 * Math.min(25, st.coolC - 112);   // hot water: the knock sensor pulls timing
      return T;
    }
    function cross(xa, xb, ta, tb, X) { return ta + (tb - ta) * (X - xa) / Math.max(1e-9, xb - xa); }
    function sub(h) {
      st.foot += (clamp(st.thr, 0, 1) > st.foot ? 1 / 0.35 : -1 / 0.2) * h; st.foot = clamp(st.foot, 0, 1);
      // the auto driver lifts early when the chute could not open before the end of the course: coasting from here down to
      // the rating (drag only) plus a stopping margin has to fit in what is left
      if (v.autoLift && st.phase === "run" && CH.cdA > 0 && !st.liftEarly) { const vr = (CH.drogue ? CH.drogue.rated : CH.rated) * 0.98;
        const stop = m / (0.5 * v.rho * (cdA + CH.cdA)) * Math.log(Math.max(1, Math.min(vr, CH.rated) / 70)) + 70 * 70 / (2 * 0.28 * 9.81) + 150;
        if (st.v > vr && st.x + m / (0.5 * v.rho * cdA) * Math.log(st.v / vr) + stop > xEnd) st.liftEarly = true; }
      const thrIn = st.phase === "run" && !st.liftEarly ? st.foot : 0;
      if (st.phase === "stage") { st.rpm += (v.idle + 300 * st.foot - st.rpm) * Math.min(1, h * 4); if (st.thr > 0.05) st.phase = "push"; return; }
      st.t += h;
      const q = 0.5 * v.rho * st.v * st.v;
      const Lf = q * clA;                      // lift (+) / downforce (-)
      const Fd = q * cdA + (st.chuteOut ? q * CH.cdA * st.chuteK : 0) + (st.drogueOut ? q * CH.drogue.cdA * st.drogueK : 0);
      const crr = 0.012 + 3.5e-7 * st.v * st.v;
      let Nr = rearStatic + m * st.acc * B.cgH / B.wb - Lf * (1 - B.liftF);
      let Nf = Nf0 - m * st.acc * B.cgH / B.wb - Lf * B.liftF;
      Nr = Math.max(0, Nr); Nf = Math.max(0, Nf); st.Nr = Nr; st.Nf = Nf; st.lift = Lf; st.drag = Fd;
      st.light = clamp(Nf / Math.max(1, Nf0), 0, 1.5);
      const Froll = crr * Math.max(0, m * g - Lf);
      if (st.phase === "push") {
        // the push truck: about 0.25 g up to 27 mph, engine in neutral warming up, then the driver lets the clutch out
        st.pushT += h; st.v += (2.5 - (Fd + Froll) / m) * h; st.x += st.v * h; st.w = st.v / rw; st.acc = 2.5;
        st.rpm += (v.idle + 500 - st.rpm) * Math.min(1, h * 3);
        if (st.v >= 12) { st.phase = "run"; st.gear = 0; st.clutch = true; }
        return;
      }
      let Tw = 0, I = Iw;
      if (st.phase === "run" && !st.broke) {
        if (st.shiftT > 0) st.shiftT -= h;
        const G = ratios[st.gear];
        const wRpm = st.w * G * 60 / (2 * Math.PI);
        const floor = Math.max(v.idle + 400, 0.32 * red);
        if (st.clutch && wRpm >= floor) st.clutch = false;
        if (st.shiftT > 0) { Tw = 0; st.rpm += (wRpm - st.rpm) * Math.min(1, h * 12); }
        else if (st.clutch) { st.rpm += (floor - st.rpm) * Math.min(1, h * 6); Tw = Math.max(0, engT(st.rpm, thrIn)) * G * eta; }
        else { st.rpm = wRpm; Tw = engT(st.rpm, thrIn) * G * eta; I = Iw + Ie * G * G; }
        if (st.rpm > red * 1.005) { st.limT += h; if (st.rpm > red * 1.03) st.overRev++; }
        // a swap's driveline (veh.dlCap, engine-side N·m): past its rating it lets go; the engine is fine
        if (v.dlCap > 0 && !v.noFail && st.shiftT <= 0 && Tw > v.dlCap * G * eta) { st.dlOver = (st.dlOver || 0) + h; if (st.dlOver > 0.05) { st.broke = st.failKind = "driveline"; st.stopWhy = "broke"; st.brokeX = st.x; } }
        // shifting: the auto box at the shift point; a manual driver asks with shift()
        const want = v.shift === "auto" ? (st.rpm >= shiftRpm && thrIn > 0.5) : st.shiftReq;
        if (want && st.gear < NG - 1 && st.shiftT <= 0 && !st.clutch) { st.gear++; st.shiftT = 0.25; st.shifts++; }
        st.shiftReq = false;
      } else {
        // after the mile (or a broken engine): clutch in, coasting
        st.rpm += ((st.broke ? 0 : v.idle) - st.rpm) * Math.min(1, h * 2.5);
      }
      // tyre on the salt
      const vw = st.w * rw, den = Math.max(Math.abs(st.v), 3);
      const s = (vw - st.v) / den; st.slip = clamp(s, -1, 3);
      let Ft = mu(s) * Nr;
      if (st.phase === "spin") Ft = 0;
      st.w += (Tw - Ft * rw) / I * h; if (st.w < 0) st.w = 0;
      if (st.phase !== "run" || st.broke) { st.w = st.v / rw; Ft = 0; }   // free-rolling
      // brakes come on once the chute has the speed down, or alone if there is no chute
      st.braking = (st.phase === "shutdown" || st.phase === "spin" || (st.broke && st.phase === "run")) && (st.v < 70 || !st.chuteOut);
      const Fb = st.braking ? m * g * (st.phase === "spin" ? 0.45 : st.v < 70 ? 0.28 : 0.08) : 0;
      let acc = (Ft - Fd - Froll - Fb) / m;
      if (st.v <= 0 && acc < 0) acc = 0;
      const xPrev = st.x, tPrev = st.t - h;
      st.v = Math.max(0, st.v + acc * h); st.x += st.v * h; st.acc = acc;
      // timing traps: the clocks start on the mile's first light and stop on its last
      if (st.tIn == null && st.x >= x0) { st.tIn = cross(xPrev, st.x, tPrev, st.t, x0); st.vIn = st.v; }
      if (st.tK0 == null && st.x >= k0) st.tK0 = cross(xPrev, st.x, tPrev, st.t, k0);
      if (st.tK1 == null && st.x >= k1) { st.tK1 = cross(xPrev, st.x, tPrev, st.t, k1); st.kmMph = 1000 / Math.max(1e-6, st.tK1 - st.tK0) * 2.23694; }
      if (st.tOut == null && st.x >= x1) { st.tOut = cross(xPrev, st.x, tPrev, st.t, x1); st.vOut = st.v; st.mileMph = LSR_MILE / Math.max(1e-6, st.tOut - st.tIn) * 2.23694; if (st.phase === "run") st.phase = "shutdown"; }
      st.peakV = Math.max(st.peakV, st.v); st.peakRpm = Math.max(st.peakRpm, st.rpm);
      // stability: wheelspin at speed or a light front end make the car loose; the driver gets one warning
      if (st.phase === "run") {
        const sp = st.v > 25 && s > 0.22 ? (s - 0.22) * 3 * (B.narrow ? 1.6 : 1) * clamp(st.v / 60, 0.4, 1.6) : 0;
        const lt = st.light < 0.45 ? (0.45 - st.light) * 7 : 0;
        if (s > 0.22 && st.v > 25) st.spinT += h;
        if (st.light < 0.5) st.wanderT += h;
        st.lightMin = Math.min(st.lightMin, st.light);
        st.loose = sp + lt > 0 ? st.loose + (sp + lt) * h : Math.max(0, st.loose - 0.6 * h);
        if (st.loose >= 1 && !v.noSpin) { st.phase = "spin"; st.stopWhy = "spun"; st.spinV = st.v; }
      }
      // heat: coolant against the radiator (or soaking into the ice), the exhaust soaking at full load
      const P = Math.max(0, st.phase === "run" && !st.broke ? engT(st.rpm, thrIn) * st.rpm * 2 * Math.PI / 60 : 0);
      const qIn = coolKw * Math.max(0.06, P / peakW), qOut = kRad * (st.coolC - v.ambientC) * clamp(Math.sqrt(st.v / 40), 0.25, 1.4);
      st.coolC += (qIn - qOut) / capKJ * h; st.coolMax = Math.max(st.coolMax, st.coolC);
      const full = st.phase === "run" && thrIn > 0.6;
      if (full) { st.loadT += h; if (st.rpm > 0.8 * red) st.fullT += h; }
      const egtT = (hasEgt ? interp(res.egtCurve, st.rpm) : 820) * (0.45 + 0.55 * thrIn) + 55 * thrIn * clamp(st.loadT / 40, 0, 1);
      st.egt += (egtT - st.egt) * (1 - Math.exp(-h / 4)); st.egtPeak = Math.max(st.egtPeak, st.egt);
      if (egtLimit && st.egt > egtLimit) st.egtDose += h * (st.egt - egtLimit) / 60;
      // pushing it: every second near the redline is a chance for the weakest part to go
      if (full && !v.noFail) st.haz += h * hazK * Math.pow(st.rpm / red, 3) * (1 + 3 * Math.max(0, (st.coolC - 112) / 15)) * (st.limT > 0 ? 1.3 : 1);
      if (!v.noFail && !st.broke && st.phase === "run") {
        const hot = st.coolC > 128;
        if (st.failKind && st.loadT >= st.failAt) st.broke = st.failKind;
        else if (v.wornAt && st.loadT >= v.wornAt) st.broke = "worn";
        else if (hot) st.broke = "steam";
        else if (st.egtDose > egtTrip) st.broke = isTurbo && (res.egtLimitC || 0) <= st.egt ? "turbo" : "piston";
        else if (1 - Math.exp(-st.haz) > st.hazRoll && st.haz > 0) { const t0 = (res.tests || []).slice().sort((a, b) => b.util - a.util)[0]; st.broke = t0 ? t0.id : "rod_tension"; }
        if (st.broke) { st.failKind = st.broke; st.stopWhy = "broke"; st.brokeX = st.x; }
      }
      // the chute: the driver pulls it once the clocks are behind him (or when it all goes wrong past 150 mph)
      // auto: the driver coasts until the speed is inside a canopy's rating — the drogue first if there is one, then the main.
      // A chute pulled by hand goes out when asked; over its rating it tears off.
      const wantChute = CH.cdA > 0 && ((v.autoChute && st.phase === "shutdown" && st.x > x1 + 60) || ((st.broke || st.phase === "spin") && st.v > 45));
      if (CH.drogue && !st.drogueOut && !st.chuteOut && ((wantChute && st.v <= CH.drogue.rated * 0.98) || (st.chuteReq && st.v > CH.rated))) { st.drogueOut = true; st.drogueMph = st.v * 2.23694; if (st.v > CH.drogue.rated) st.chuteBlown = true; if (st.chuteAt == null) st.chuteAt = st.x; }
      else if (!st.chuteOut && CH.cdA > 0 && ((wantChute && st.v <= CH.rated * 0.98) || (st.chuteReq && !(CH.drogue && !st.drogueOut && st.v > CH.rated)))) {
        st.chuteOut = true; if (st.chuteAt == null) st.chuteAt = st.x; st.chuteMph = st.v * 2.23694; if (st.v > CH.rated) st.chuteBlown = true;
      }
      st.chuteWait = wantChute && !st.chuteOut && !st.drogueOut;
      st.chuteReq = false;
      if (st.chuteOut) st.chuteK = st.chuteBlown ? Math.max(0, st.chuteK - h * 3) : Math.min(1, st.chuteK + h / 0.6);
      if (st.drogueOut) st.drogueK = st.chuteBlown && !st.chuteOut ? Math.max(0, st.drogueK - h * 3) : Math.min(1, st.drogueK + h / 0.4);
      if (st.t - lastTrace >= 0.25) { lastTrace = st.t; st.trace.push({ t: +st.t.toFixed(2), x: Math.round(st.x), v: +st.v.toFixed(2), rpm: Math.round(st.rpm), g: st.gear + 1, thr: +thrIn.toFixed(2), slip: +clamp(st.slip, 0, 1).toFixed(3), egt: Math.round(st.egt), tc: Math.round(st.coolC), light: +st.light.toFixed(2) }); }
      if (st.x > xEnd && st.v > 3) st.offEnd = true;
      if ((st.phase === "shutdown" || st.phase === "spin" || st.broke) && st.v < 0.5 && st.t > 2) finish();
      if (st.phase === "run" && !st.broke && st.v < 0.8 && st.t > 6 && st.foot < 0.05) { st.stopWhy = "lifted"; finish(); }
      if (st.phase === "run" && st.t > 240) { st.stopWhy = "time"; finish(); }
    }
    function finish() { st.done = true; if (!st.stopWhy) st.stopWhy = st.mileMph != null ? "done" : "lifted"; st.phase = "done"; }
    function step(dt, throttle) {
      if (throttle != null) st.thr = clamp(+throttle || 0, 0, 1);
      dt = Math.min(0.25, Math.max(0, dt));
      while (dt > 1e-9 && !st.done) { const hh = Math.min(v.h, dt); dt -= hh; sub(hh); }
      return st;
    }
    function shift() { if (st.phase === "run") st.shiftReq = true; }
    function autoShift() { v.shift = "auto"; }
    function chute() { if (st.phase !== "stage" && st.phase !== "push" && (st.tOut != null || st.broke || st.phase === "spin")) st.chuteReq = true; }
    function result() {
      const mph = x => x * 2.23694, reasons = [];
      const lim = st.limT, B2 = B, aeroN = B2.aero.n.toLowerCase();
      if (st.broke === "driveline") reasons.push(`The driveline let go ${(st.x / LSR_MILE).toFixed(2)} miles out — rated for ${Math.round(v.dlCap)} N·m, and the engine made more. The engine is fine; the car needs a stronger gearbox and axle (Build → Swap).`);
      else if (st.broke) reasons.push(st.broke === "steam" ? `Coolant hit ${Math.round(st.coolMax)} °C and blew past the head gasket. ${ice ? "Even the ice tank ran out" : "The radiator can't shed that much heat for that long"} — ${ice ? "less power for the run, or a bigger tank" : "try an ice tank, or a body with more radiator"}.`
        : st.broke === "turbo" ? `The turbine inlet sat at ${Math.round(st.egtPeak)} °C for a minute — past what the hot side takes. The turbo let go on the salt.`
        : st.broke === "piston" ? `Exhaust held ${Math.round(st.egtPeak)} °C for too long and melted a piston. Leaner on fuel, more air, or less boost for the long haul.`
        : st.broke === "worn" ? "Something tired gave up at full load — the build was past its run budget. Freshen it first."
        : `The ${(res.tests || []).find(q => q.id === st.broke) ? (res.tests.find(q => q.id === st.broke).name || "").toLowerCase() : "weakest part"} let go ${(st.x / LSR_MILE).toFixed(2)} miles out, after ${Math.round(st.loadT)} s at full load. A minute near the redline is a lot to ask.`);
      if (st.stopWhy === "spun") reasons.push(st.light < 0.45 || st.wanderT > 1 ? `The front got light (${Math.round(st.lightMin * 100)}% of its weight left) and the car got away from the driver. ${v.aero ? "Even with the " + aeroN + " it lifts" : "Fit the " + aeroN} — or add ballast.` : `Spun on the salt — the tyres broke loose at ${Math.round(mph(st.spinV || st.v))} mph. Feather it in the low gears, or taller gearing.`);
      if (st.mileMph != null && st.vOut != null && st.vIn != null && st.vOut > st.vIn * 1.04) reasons.push(`Still pulling through the mile: ${Math.round(mph(st.vIn))} mph in, ${Math.round(mph(st.vOut))} out. ${v.course === "long" ? "It needs to get there sooner — more grip early (ballast), more power through the gears, or less drag." : "More run-up (the long course) or more power low down would show up on the clocks."}`);
      if (lim > 2) reasons.push(`On the rev limiter for ${lim.toFixed(1)} s — the top gear is too short. Taller gearing would let it pull further.`);
      else if (st.mileMph != null && st.gear === NG - 1 && st.rpm < 0.8 * (res.peakHpRpm || red) && st.vOut != null && Math.abs(st.vOut - st.vIn) < 2) reasons.push(`Top gear too tall: it ran out of power at ${Math.round(st.rpm).toLocaleString()} rpm, well under the ${(res.peakHpRpm || red).toLocaleString()} rpm power peak. Shorter gearing would be faster.`);
      if (st.spinT > 2 && st.stopWhy !== "spun") reasons.push(`${st.spinT.toFixed(1)} s of wheelspin at speed — salt is about μ 0.55. Ballast on the rear, or ease into the low gears.`);
      if (st.liftEarly) reasons.push(`Lifted early at ${(st.x / LSR_MILE).toFixed(2)} mi — at ${Math.round(st.v * 2.23694)} mph the ${CH.n.toLowerCase()} could not open before the end of the course. A drogue + main pack opens far higher.`);
      if (st.wanderT > 1 && st.stopWhy !== "spun") reasons.push(`The front was light for ${st.wanderT.toFixed(1)} s (down to ${Math.round(st.lightMin * 100)}%) — the car wanders when the nose lifts. ${v.aero ? "" : "The " + aeroN + " would hold it down."}`);
      if (st.coolMax > 112 && st.broke !== "steam") reasons.push(`Coolant peaked at ${Math.round(st.coolMax)} °C — hot enough to pull timing and cost power.`);
      if (st.chuteBlown) reasons.push(`The ${st.chuteOut ? "chute" : "drogue"} came out at ${Math.round(st.chuteOut ? st.chuteMph : st.drogueMph)} mph — past its ${Math.round((st.chuteOut ? CH.rated : CH.drogue.rated) * 2.23694)} mph rating — and tore off. Brakes only from there.`);
      if (!st.chuteOut && CH.cdA === 0 && st.peakV * 2.23694 > 175) reasons.push("No parachute over 175 mph — tech will not accept the run. Fit a chute.");
      if (st.offEnd) reasons.push("Ran out of course before it stopped — off the end into the soft salt.");
      return { mileMph: st.mileMph != null ? +st.mileMph.toFixed(3) : null, kmMph: st.kmMph != null ? +st.kmMph.toFixed(3) : null, peakMph: +mph(st.peakV).toFixed(1), inMph: st.vIn != null ? +mph(st.vIn).toFixed(1) : null, outMph: st.vOut != null ? +mph(st.vOut).toFixed(1) : null,
        mileT: st.tOut != null ? +(st.tOut - st.tIn).toFixed(3) : null, kmT: st.tK1 != null ? +(st.tK1 - st.tK0).toFixed(3) : null, time: +st.t.toFixed(1), stopWhy: st.stopWhy, broke: st.broke, failKind: st.broke ? st.failKind : null, brokeX: st.brokeX != null ? Math.round(st.brokeX) : null,
        coolMax: Math.round(st.coolMax), peakEgt: Math.round(st.egtPeak), lightMin: +st.lightMin.toFixed(2), spinT: +st.spinT.toFixed(1), wanderT: +st.wanderT.toFixed(1), limT: +lim.toFixed(1), shifts: st.shifts, peakRpm: Math.round(st.peakRpm),
        chute: { out: st.chuteOut || st.drogueOut, mph: st.chuteMph != null ? Math.round(st.chuteMph) : null, drogueMph: st.drogueMph != null ? Math.round(st.drogueMph) : null, blown: st.chuteBlown }, offEnd: st.offEnd, noChuteFast: CH.cdA === 0 && st.peakV * 2.23694 > 175,
        trace: st.trace, reasons: reasons, body: B.id, course: v.course, topMph: v.topMph, ratios: ratios.map(r => +r.toFixed(2)), mass: Math.round(m), cdA: +cdA.toFixed(3), clA: +clA.toFixed(3), x0: x0, x1: x1, k0: k0, k1: k1, xEnd: xEnd, veh: v };
    }
    return { st: st, step: step, shift: shift, autoShift: autoShift, chute: chute, result: result, ratios: ratios, shiftRpm: shiftRpm, mass: m, x0: x0, x1: x1, k0: k0, k1: k1, xEnd: xEnd };
  }
  /* a run with a sensible driver: flat out, feathering wheelspin and a light front end; the node harness and the record book use it */
  function lsrPass(res, veh) {
    const p = lsrRun(res, Object.assign({ autoLift: true }, veh, { shift: "auto" })); let thr = 1;
    while (!p.st.done) {
      const s = p.st;
      if (s.phase === "run") {
        const bad = s.slip > 0.13 || s.light < 0.5 || s.loose > 0.3;
        thr = bad ? Math.max(0.04, thr * (s.slip > 0.2 || s.loose > 0.5 ? 0.7 : 0.88)) : Math.min(1, thr + 0.03);
      } else thr = 1;
      p.step(0.02, thr);
    }
    return p.result();
  }
  /* the top gear that gets the most out of the timed mile: balance-speed estimate, then a short search */
  function lsrGearing(res, veh) {
    const B = LSR_BODIES[veh && veh.body] || LSR_BODIES.altered, red = (veh && veh.redline) || 7000, rho = res.saltEnv ? res.saltEnv.rho : 1.0;
    const cdA = B.cdA + (veh && veh.aero ? B.aero.cd : 0) + ((veh && veh.cooling) === "ice" ? 0 : B.radDrag), m = B.mass + (res.kg || 200), P = 0.9 * (res.peakHp || 100) * 745.7;
    let vb = 20; for (let i = 0; i < 40; i++) vb = Math.pow(Math.max(1, P - 0.015 * m * 9.81 * vb) / (0.5 * rho * cdA), 1 / 3);
    const base = vb * 2.23694 * red / Math.max(1, res.peakHpRpm || red * 0.85);
    let best = null;
    for (const f of [0.94, 1.0, 1.06, 1.12]) {
      const top = Math.round(base * f / 5) * 5;
      const r = lsrPass(res, Object.assign({}, veh, { topMph: top, noFail: true, noSpin: true, h: 0.004 }));
      const sc = r.mileMph || 0; if (!best || sc > best.mph) best = { topMph: top, mph: sc };
    }
    return best ? best.topMph : Math.round(base / 5) * 5;
  }
  /* the record book: every class has a standing record, seeded from what a well-built entry of that class
     runs on this same physics, discounted by how contested the class is (some are soft, some are stout) */
  const LSR_HOLDERS = ["Wendover Flyers", "Silver Island Speed", "Blue Mist Racing", "Salt Shaker Garage", "Floating Island Team", "Prairie Lakester Co.", "Northwind Racing", "Bitter Lake Hot Rods", "Coulee Fuels Special", "Old Ironsides Racing", "Tamarack Speed Shop", "Glacier Streamliner Group", "Kestrel Salt Racing", "Halcyon GT", "Redwater Rodders", "Mile Seven Motorsport"];
  const lsrRecCache = {};
  function lsrSynth(L, fuel, blown) {
    const hpL = fuel === "D" ? (blown ? 125 : 42) : fuel === "F" ? (blown ? 290 : 135) : (blown ? 190 : 108);
    const hp0 = Math.min(fuel === "D" ? 1500 : fuel === "F" && blown ? 3000 : 2300, hpL * L), salt = blown ? 0.93 : 0.87, hp = hp0 * salt;
    const red = fuel === "D" ? clamp(5200 - 180 * L, 2600, 4800) : clamp(9800 - 420 * L, 6200, 9500), pk = 0.9 * red;
    const rpms = [], torque = []; for (let r = 1000; r <= red + 1e-6; r += 250) { rpms.push(r); const x = (r - pk * 0.75) / (pk * 0.75); torque.push(Math.max(0.3, 1 - 0.28 * x * x)); }
    let best = 0, bi = 0; rpms.forEach((r, i) => { const p = torque[i] * r; if (p > best) { best = p; bi = i; } });
    const k = hp * 745.7 / (best * 2 * Math.PI / 60); for (let i = 0; i < torque.length; i++) torque[i] *= k;
    const kg = (fuel === "D" ? 110 + 60 * L : 60 + 30 * L) * (blown ? 1.15 : 1);
    return { rpms: rpms, torque: torque, peakHp: hp, peakHpRpm: rpms[bi], peakTq: Math.max.apply(null, torque), kg: kg, Vd: L * 1000, thermals: { coolantLoadKw: 0.37 * hp }, tests: [], fails: [], saltEnv: { rho: ambient(Object.assign({}, DEFAULT_ENV, SALT_ENV)).rho, ambientC: SALT_ENV.ambientC }, red: red };
  }
  function lsrRecord(key) {
    if (lsrRecCache[key]) return lsrRecCache[key];
    const mt = /^(AA|[A-J])\/(B?)([GFD])(ALT|MR|L|S)$/.exec(key); if (!mt) return null;
    const di = LSR_DISP.findIndex(d => d[0] === mt[1]), lo = di > 0 ? LSR_DISP[di - 1][1] : 0.5, hi = LSR_DISP[di][1];
    const L = hi === Infinity ? 9.0 : lo + (hi - lo) * 0.9, body = Object.keys(LSR_BODIES).find(k => LSR_BODIES[k].code === mt[4]);
    const res = lsrSynth(L, mt[3], !!mt[2]), veh = { body: body, redline: res.red, aero: true, ballast: body === "streamliner" ? 150 : 60, cooling: body === "streamliner" || body === "lakester" ? "ice" : "radiator", chute: "dual", course: LSR_BODIES[body].course };
    veh.topMph = lsrGearing(res, veh);
    const r = lsrPass(res, Object.assign({}, veh, { noFail: true, noSpin: true, h: 0.004 }));
    const hsh = lsrHash(key), hot = clamp((res.peakHp - 600) / 1200, 0, 1), soft = 0.70 + 0.2 * hot + (0.27 - 0.17 * hot) * ((hsh % 1000) / 1000);   // the big blown classes are contested: their records sit close to the limit
    const mph = Math.round((r.mileMph || r.peakMph) * soft * 1000) / 1000;
    const rec = { key: key, mph: mph, holder: LSR_HOLDERS[(hsh >>> 10) % LSR_HOLDERS.length], year: 1958 + ((hsh >>> 4) % 67), seeded: true };
    lsrRecCache[key] = rec; return rec;
  }


