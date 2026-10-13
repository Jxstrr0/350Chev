  /* ---- Truck & tractor pulling: a weight-transfer sled on a dirt track ----
     The sled's box starts over its rear wheels, so at first the pan carries little and the truck walks away.
     The box is geared to the sled wheels and slides toward the pan as the sled travels, so the drag keeps rising
     until the truck can no longer turn it into forward motion: it either stops (bogs) or the tyres dig (spins out).
     300 ft with the box still moving is a full pull. */
  const PULL_FULL = 91.44;
  // dirt grip against wheel slip: it peaks with the tyre turning a little faster than the ground (sp), then falls away
  // as the tyre starts throwing the dirt instead of biting it. A cut tyre bites harder and digs harder.
  const PULL_TYRES = {
    dot: { n: "DOT mud tyre", d: "street-legal lugs", mu: 0.72, sp: 0.16, fall: 0.36, dig: 0.7 },
    ag: { n: "Ag bar tyre", d: "farm lugs · forgiving", mu: 0.80, sp: 0.22, fall: 0.28, dig: 0.6 },
    cut: { n: "Cut pulling tyre", d: "hand-cut lugs · bites, then digs", mu: 0.95, sp: 0.25, fall: 0.42, dig: 1 },
    // wide flotation carcass, every lug cut back to a paddle: enough bite that the engine, not the dirt, sets the speed
    wide: { n: "Wide full-cut tyre", d: "Super Stock · paddles, needs power", mu: 1.20, sp: 0.28, fall: 0.45, dig: 1 },
    // 38-inch triple-ply paddle: the most bite there is, and a deep hole when it lets go
    mega: { n: "Mega paddle tyre", d: "Unlimited · biggest bite, digs deepest", mu: 1.32, sp: 0.30, fall: 0.52, dig: 1.15 }
  };
  const PULL_TRUCK_GEARS = [["2nd", 10], ["3rd", 14], ["4th", 19], ["5th", 25], ["6th", 32]];
  const PULL_TRACTOR_GEARS = [["B2", 6], ["B3", 8], ["C1", 11], ["C2", 14], ["C3", 18]];
  function pullIsD(c) { const f = OPT.fuel[c && c.fuel]; return !!(f && f.ci); }
  function pullTurbo(c) {   // what is bolted to the intake, in the terms a tech card asks about
    const a = OPT.asp[c.asp] || OPT.asp.na;
    return { kind: a.kind, units: a.units || 1, compound: !!a.compound, mm: a.kind === "turbo" || a.kind === "centrifugal" ? (TURBO_MM[c.turboSize] || 54) : 0 };
  }
  function pullSingleMax(mm, inch) {
    return function (c) {
      const t = pullTurbo(c);
      if (t.kind === "na") return { ok: true, why: "naturally aspirated" };
      if (t.kind !== "turbo") return { ok: false, why: "turbo only — no blowers" };
      if (t.compound || t.units > 1) return { ok: false, why: "single turbo only" };
      if (t.mm > mm) return { ok: false, why: t.mm + " mm inducer — limit " + inch + "\" (" + mm + " mm)" };
      return { ok: true, why: "single " + t.mm + " mm turbo" };
    };
  }
  const PULL_CLASSES = {
    street: { n: "Street diesel", d: "pickup · pump diesel · 2.6\" single", tier: 1, rep: 0, diesel: true,
      veh: { kind: "truck", drive: "4x4", mass: 3300, maxMass: 3630, wb: 3.70, cgH: 0.85, front: 0.57, tyreDia: 35, tyres: ["dot"], hitchMax: 26, flyK: 1 },
      sled: { base: 1300, box: 3700, mu: 0.62, travel: 84 }, field: { med: 224, sd: 24, full: 0.08 },
      legal: function (c) {
        if (!pullIsD(c)) return { ok: false, why: "diesel only" };
        const t = pullSingleMax(66, "2.6")(c); if (!t.ok) return t;
        const nz = OPT.dNoz && OPT.dNoz[c.dNoz];
        if (nz && nz.mult > 1.6) return { ok: false, why: "nozzles over +60% — run Smoker" };
        return { ok: true, why: "pump diesel · " + t.why };
      } },
    smoker26: { n: "2.6 Smoker", d: "diesel · 66 mm single · any injection", tier: 2, rep: 40, diesel: true,
      veh: { kind: "truck", drive: "4x4", mass: 3350, maxMass: 3630, wb: 3.70, cgH: 0.82, front: 0.56, tyreDia: 35, tyres: ["dot", "cut"], hitchMax: 26, flyK: 1 },
      sled: { base: 1500, box: 4300, mu: 0.62, travel: 84 }, field: { med: 250, sd: 22, full: 0.18 },
      gears: [["3rd", 14], ["4th", 19], ["5th", 25], ["6th", 32], ["OD", 40]],   // geared to run: the power is only worth having at speed
      legal: function (c) {
        if (!pullIsD(c)) return { ok: false, why: "diesel only" };
        const t = pullSingleMax(66, "2.6")(c); if (!t.ok) return t;
        return { ok: true, why: t.why + " · any pump and nozzles" };
      } },
    superstock: { n: "Super Stock diesel", d: "compounds allowed · no limits", tier: 4, rep: 300, diesel: true,
      veh: { kind: "truck", drive: "4x4", mass: 3500, maxMass: 3900, wb: 3.75, cgH: 0.80, front: 0.56, tyreDia: 35, tyres: ["cut", "wide"], hitchMax: 26, flyK: 1.1 },
      // a heavy sled whose box keeps travelling past the line: on paddle tyres the grip is there, so the horsepower decides
      sled: { base: 2000, box: 9000, mu: 0.62, travel: 110 }, field: { med: 266, sd: 20, full: 0.22 },
      gears: [["4th", 25], ["5th", 32], ["6th", 40], ["OD", 48], ["OD+", 56]],
      legal: function (c) {
        if (!pullIsD(c)) return { ok: false, why: "diesel only" };
        const t = pullTurbo(c);
        if (t.kind !== "na" && t.kind !== "turbo") return { ok: false, why: "turbos only — no blowers" };
        return { ok: true, why: t.kind === "na" ? "open class" : t.compound ? "compound turbos" : t.units > 1 ? "twin turbos" : "single " + t.mm + " mm turbo" };
      } },
    hotfarm: { n: "Hot Farm tractor", d: "2WD tractor · ag tyres · 3.0\" single", tier: 3, rep: 120, diesel: true,
      veh: { kind: "tractor", drive: "rwd", mass: 4000, maxMass: 4540, wb: 2.75, cgH: 1.05, front: 0.36, tyreDia: 64, tyres: ["ag"], hitchMax: 20, flyK: 2.2 },
      sled: { base: 1400, box: 5000, mu: 0.62, travel: 110 }, field: { med: 254, sd: 22, full: 0.15 },
      gears: [["C1", 11], ["C2", 14], ["C3", 18], ["D1", 21], ["D2", 24]],   // road gears only: nobody crawls a hot-farm sled in low range
      legal: function (c) {
        if (!pullIsD(c)) return { ok: false, why: "diesel only" };
        const t = pullSingleMax(76, "3.0")(c); if (!t.ok) return t;
        return { ok: true, why: t.why };
      } },
    unlimited: { n: "Unlimited Modified", d: "2,500–10,000 hp · diesel or alcohol · no limits", tier: 5, rep: 1500, gate: "dyno5", diesel: true,
      veh: { kind: "truck", drive: "4x4", mass: 4400, maxMass: 5400, wb: 3.90, cgH: 0.78, front: 0.55, tyreDia: 38, tyres: ["wide", "mega"], hitchMax: 26, flyK: 1.6 },
      // a sled that was built to beat 5,000 hp: heavy, and its box runs at the pan early so the drag climbs steeply
      sled: { base: 2050, box: 12100, mu: 0.62, travel: 110, ramp: 0.8 }, field: { med: 270, sd: 16, full: 0.22 }, gear0: 3,
      names: ["Hell on Wheels", "Diesel Dynasty", "Shock Therapy", "Thunder Road", "Double Down", "Overkill", "Ground Pounder", "Kingpin", "Iron Fist", "Wrecking Crew", "Fire Sale", "Blown Away"],
      gears: [["3rd", 20], ["4th", 26], ["5th", 33], ["6th", 41], ["OD", 50]],
      legal: function (c) {
        if (pullIsD(c)) return { ok: true, why: "diesel · no limits" };
        if (c.fuel === "methanol" || c.fuel === "e85") return { ok: true, why: "alcohol · no limits" };
        return { ok: false, why: "diesel or alcohol only" };
      } },
    gas: { n: "Gas 4×4 trucks", d: "petrol · 6,500 lb · open induction", tier: 1, rep: 0, diesel: false,
      veh: { kind: "truck", drive: "4x4", mass: 2650, maxMass: 2950, wb: 3.40, cgH: 0.80, front: 0.55, tyreDia: 35, tyres: ["dot", "cut"], hitchMax: 26, flyK: 0.8 },
      sled: { base: 1200, box: 3500, mu: 0.62, travel: 84 }, field: { med: 234, sd: 26, full: 0.10 },
      legal: function (c) { return pullIsD(c) ? { ok: false, why: "petrol and alcohol engines only" } : { ok: true, why: "any gas engine" }; } }
  };
  for (const k in PULL_CLASSES) PULL_CLASSES[k].id = k;
  // the gear ladder a class pulls in: name and road speed at the governor with no slip
  function pullGears(cls) { const c = PULL_CLASSES[cls] || PULL_CLASSES.street; return c.gears || (c.veh.kind === "tractor" ? PULL_TRACTOR_GEARS : PULL_TRUCK_GEARS); }
  /* the dirt on the night: moisture 0 (dust) … 1 (mud), cut 0 (fresh prep) … 1 (chewed up). A wet track bites harder at
     less slip but drags at the tyres and the pan; a dry one is slick and wants more wheel speed; ruts take the grip away
     at the heavy end, where the box is up on the pan. No track (practice) is neutral: every factor exactly 1 / 0. */
  function pullTrackK(t) {
    if (!t) return { mu: 1, sp: 0, crr: 1, sled: 1, cut: 0, dig: 1 };
    const m = clamp(+t.moist, 0, 1) - 0.5, c = clamp(+t.cut || 0, 0, 1);
    return { mu: 1 + 0.17 * m, sp: -0.09 * m, crr: 1 + 1.2 * m, sled: 1 + 0.10 * m, cut: c, dig: 1 + c };
  }
  function pullTrackName(t) {
    if (!t) return "practice · neutral";
    const m = +t.moist, c = +t.cut || 0;
    const a = m > 0.62 ? "tacky" : m < 0.38 ? "dry & slick" : "good bite";
    return c > 0.45 ? (m > 0.62 ? "tacky · cut up" : m < 0.38 ? "dry · cut up" : "cut up") : a;
  }
  /* runaway: a diesel that finds oil to burn — through a turbo seal pushed past its limit, as blow-by mist from tired rings,
     or simply overfuelled into an exhaust hot enough to keep it lit — runs on it, and the governor can't shut that off.
     Rare on a healthy build; p is the chance a given hook sees it. */
  function pullRunaway(res, cfg, wear) {
    const out = { p: 0, lvl: "none", why: [], lam: 0, egt: 0 };
    if (!res || !cfg || !isDiesel(cfg)) return out;
    const lam = +cfg.lambda || 1.5, egt = Array.isArray(res.egtCurve) && res.egtCurve.length ? Math.max.apply(null, res.egtCurve) : 0;
    const tu = id => { const t = (res.tests || []).find(x => x.id === id); return t ? t.util : 0; };
    const turbo = (OPT.asp[cfg.asp] || {}).kind === "turbo", tS = turbo ? Math.max(tu("compressor_map"), tu("turbine_temp")) : 0, gone = turbo && tS >= 1;
    const fL = clamp((1.25 - lam) / 0.2, 0, 1), fE = clamp((egt - 900) / 100, 0, 1), fT = gone ? 1 : clamp((tS - 0.95) / 0.25, 0, 1), fW = clamp(((+wear || 0) - 0.6) / 0.6, 0, 1);
    out.p = +clamp(0.3 * fL * fE + 0.2 * fT + (gone ? 0.35 : 0) + 0.12 * fW, 0, 0.85).toFixed(3); out.lam = lam; out.egt = Math.round(egt);
    if (fT > 0) out.why.push(gone ? "turbo seals gone" : "turbo seals at " + Math.round(tS * 100) + "%");
    if (fL * fE > 0) out.why.push("\u03bb " + lam.toFixed(2), "EGT " + Math.round(egt) + " \u00b0C");
    if (fW > 0) out.why.push("worn rings \u2014 blow-by");
    out.lvl = out.p <= 0 ? "none" : out.p < 0.03 ? "low" : out.p < 0.12 ? "moderate" : "high";
    return out;
  }
  function pullRng(seed) { let a = (seed >>> 0) || 1; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* veh: { cls, mass (kg, without ballast), ballast (kg on the front weight bracket), wb (m), cgH (m), front (static share on
     the front axle), hitch (inches above the dirt), tyre, tyreDia (in), gear (index into the class gear ladder) or mph,
     trans "conv"|"clutch", drive "4x4"|"rwd", redline, idle, sled {base, box, mu, travel}, sledK (heavier sled for a
     pull-off), seed, noFail, track {moist, cut} (none = neutral practice dirt), runaway {p, at?, win?} (diesel only) }.
     kill() is the kill switch: fuel and air off, the truck rolls to a stop on the sled. step(dt, throttle) takes the driver's foot 0..1; the pedal itself moves at a human rate. */
  function pullRun(res, veh) {
    const C0 = PULL_CLASSES[veh && veh.cls] || PULL_CLASSES.street, CV = C0.veh;
    const v = Object.assign({ cls: C0.id, mass: CV.mass, ballast: 0, wb: CV.wb, cgH: CV.cgH, front: CV.front, hitch: CV.hitchMax - 2, tyre: CV.tyres[0], tyreDia: CV.tyreDia, gear: 1, trans: "conv", drive: CV.drive, kind: CV.kind,
      redline: 3200, idle: 750, sled: C0.sled, sledK: 1, seed: 1, noFail: false, flyK: CV.flyK }, veh || {});
    const rpms = res.rpms, tq = res.torque, N = rpms.length, rng = pullRng(v.seed);
    const interp = (arr, r) => { if (r <= rpms[0]) return arr[0]; if (r >= rpms[N - 1]) return arr[N - 1]; let i = 1; while (rpms[i] < r) i++; const f = (r - rpms[i - 1]) / (rpms[i] - rpms[i - 1]); return arr[i - 1] + f * (arr[i] - arr[i - 1]); };
    const torqueAt = r => r <= rpms[0] ? tq[0] * Math.max(0.35, r / rpms[0]) : interp(tq, r);
    const TY = PULL_TYRES[v.tyre] || PULL_TYRES.dot, g = 9.81, rw = v.tyreDia * 0.0254 / 2;
    const TK = pullTrackK(v.track), SP = TY.sp + TK.sp;   // the night's dirt; neutral when there is no track
    const gears = C0.gears || (v.kind === "tractor" ? PULL_TRACTOR_GEARS : PULL_TRUCK_GEARS);
    const mph = v.mph || (gears[clamp(Math.round(v.gear), 0, gears.length - 1)] || gears[1])[1];
    const G = (v.redline * 2 * Math.PI / 60) / (mph * 0.44704 / rw);          // overall ratio, engine : wheel
    const conv = v.trans !== "clutch", etaL = conv ? 0.91 : 0.95;
    const VdL = Math.max(0.5, (res.VdEq || res.Vd || 2000) / 1000);
    const Ie = (0.12 + 0.07 * VdL) * (v.flyK || 1), Iw = (v.kind === "tractor" ? 2 * 260 : 4 * 32) * rw * rw * 0.6;   // flywheel + crank; tyres and rims
    const m = v.mass + v.ballast, crr = 0.03 * TK.crr, ballX = 0.75;               // ballast hangs ~0.75 m ahead of the front axle
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
      return TY.mu * TK.mu * base * (1 - 0.25 * st.dig * TY.dig) * Math.sign(s || 1) * (TK.cut ? 1 - 0.18 * TK.cut * clamp(st.x / SL.travel, 0, 1) : 1);
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
      const thr = st.killed ? 0 : st.raOn ? 1 : st.foot;   // killed: nothing; running away: the pedal no longer matters
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
      const hopDrive = clamp((st.lift - 0.55) / 0.3, 0, 1) + clamp(dTw / (G * (res.peakTq || 500) * 6), 0, 0.6) * (st.lift > 0.5 ? 1 : 0.3);
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
      if (st.slip > 0.5) st.dig = Math.min(1, st.dig + dt * (st.slip - 0.5) * 0.6 * TK.dig); else st.dig = Math.max(0, st.dig - dt * st.v * 0.12);
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
      if (st.t - lastTrace >= 0.1) { lastTrace = st.t; st.trace.push({ t: +st.t.toFixed(1), x: +st.x.toFixed(2), v: +st.v.toFixed(2), rpm: Math.round(st.rpm), slip: +st.slip.toFixed(3), boxFrac: +st.boxFrac.toFixed(3), throttle: +thr.toFixed(2), egt: Math.round(st.egt), boost: +(st.boost || 0).toFixed(2) }); if (st.raOn) st.trace[st.trace.length - 1].ra = +st.ra.toFixed(2); }
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
      if (st.hopT > 1) reasons.push(`Hopped for ${st.hopT.toFixed(1)} s — the ${v.hitch}" hitch lifts the front faster than ${Math.round(v.ballast)} kg of front weight holds it. Lower the hitch or hang more weight on the bracket.`);
      else if (st.frontUpT > 0.8) reasons.push(`Front wheels off the dirt for ${st.frontUpT.toFixed(1)} s — the chain is lifting the nose. More front ballast.`);
      if (!st.full && !st.broke && st.stopWhy === "bogged") reasons.push(`Bogged to a stop at ${Math.round(st.rpm).toLocaleString()} rpm with the pedal down — the sled outweighed the engine. ${st.slip < 0.1 ? "The tyres still had grip: more torque, a lower gear, or a converter for the multiplication." : ""}`);
      if (!st.full && st.stopWhy === "spun") reasons.push("Stopped with the tyres still turning — out of traction. More weight on the driven tyres, a hitch that plants them harder, or a bitier tyre.");
      if (!st.full && st.stopWhy === "lifted") reasons.push("Lifted with the truck nearly stopped — the sled won. Keep some pedal in to the end.");
      if (st.sweetT > 4 && !st.full) reasons.push(`${st.sweetT.toFixed(1)} s in the slip sweet spot — the tyres were working.`);
      if (isTurbo && trans && st.maxV > 0) { const lag = st.trace.findIndex(p => p.t > 0); if (lag >= 0 && st.boost < 0.6 * bT && !st.broke) reasons.push(`Only ${st.boost.toFixed(1)} of ${bT.toFixed(1)} bar at the stop — the turbo was falling off with the rpm.`); }
      if (st.smokeMax > 0.7) reasons.push("Black smoke all the way — more fuel than air. It looks the part; it is also heat in the pistons.");
      return { distM: +st.x.toFixed(2), distFt: ft, full: st.full, maxMph: +(st.maxV * 2.23694).toFixed(1), peakSlip: +st.peakSlip.toFixed(3), peakEgt: Math.round(st.egtPeak), broke: st.broke, failKind: st.broke ? st.failKind : null,
        trace: st.trace, smokeMax: +st.smokeMax.toFixed(2), time: +st.t.toFixed(1), stopWhy: st.stopWhy, spinT: +st.spinT.toFixed(1), sweetT: +st.sweetT.toFixed(1), hopT: +st.hopT.toFixed(1), frontUpT: +st.frontUpT.toFixed(1), dig: +st.dig.toFixed(2),
        boxFrac: +st.boxFrac.toFixed(3), endRpm: Math.round(st.rpm), ratio: +G.toFixed(1), mphGear: mph, sweet: sw, reasons: reasons, cls: v.cls, dtMsg: st.dtMsg || undefined, veh: v, tyre: TY.n, sledK: sk,
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
  /* The auto driver: a steady foot read every 20 ms. It feeds the pedal in off the line, aims the slip low in the sweet
     spot (the grip peaks in the middle: a skilled foot rides closer to it and goes further), backs off hard past the band,
     eases a hopping nose, and keeps some pedal in to the end. On a runaway it goes for the kill switch after a
     human reaction (0.6-1.0 s), now and then a fumble that a short window does not forgive. Deterministic for a seed, on
     its own random stream so the hook's other seeded moments stay where they were. foot(st) gives 0..1, kill(st) is
     true once the hand reaches the switch. */
  function pullDriver(seed) {
    const r = pullRng(((seed >>> 0) ^ 0x5BD1E995) >>> 0);
    const aim = 0.10 + 0.12 * r(), gain = 0.9 + 0.2 * r(), react = 0.6 + 0.4 * r(), fu = r(), fuAdd = 0.5 + 0.9 * r();
    let thr = 0, reach = null;
    function foot(st) {
      if (st.done || st.raOn || st.killed) return 0;   // running away the pedal does nothing: the foot comes off while the hand finds the switch
      if (st.phase === "stage") { thr = 0.55; return thr; }
      const s = st.slip, sw = st.sweet, tgt = sw[0] + aim * (sw[1] - sw[0]);
      if (s > sw[1] + 0.03) thr -= (0.05 + 0.5 * (s - sw[1])) * gain;        // spinning: off it, harder the further past
      else if (s > tgt && st.v > 0.4) thr -= 0.012 * gain;                     // in the band, above the aim: a touch less (unless it is bogging: then lean in)
      else thr += (st.t < 1.2 ? 0.035 : 0.025) * gain;                         // grip to spare: lean in
      if (st.hop > 0.3 || st.lift > 0.95) thr -= 0.03;                         // the nose is coming up
      thr = clamp(thr, st.t > 1 ? 0.3 : 0.4, 1);                               // never all the way off: a lift stops the truck
      return thr;
    }
    function kill(st) {
      if (!st.raOn || st.killed || st.done) return false;
      if (reach == null) reach = react + (fu < 0.06 + 0.24 * clamp((2.1 - st.raWin) / 0.6, 0, 1) ? fuAdd : 0);   // a fumble: the hand misses the switch the first time
      return st.raT >= reach;
    }
    return { foot: foot, kill: kill, react: () => reach };
  }

