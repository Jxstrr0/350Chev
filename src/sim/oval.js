  /* =====================================================================
     DIRT OVAL: a 3/8-mile (600 m) banked clay oval, left turns only. Two 105 m straights, two 62 m radius
     180° turns banked 22°. The clay is the whole story: μ about 0.7 and moving. It starts the night tacky
     (more grip), dries out and goes slick as the laps pile up, and each tyre wears. The car is a stock-car
     chassis with a rear-drive solid axle, ONE gear and a quick-change rear end (the final drive you pick):
     the engine's rpm is just the speed times the ratio, so what it makes at corner-exit rpm decides how
     hard the car can go, not what it peaks at. A time-stepped point mass runs the whole race:
       - corners: the banked-turn limit v² = R·g·(tanθ + μ)/(1 − μ·tanθ); the driver's pace multiplies it,
         a corner has its own hidden grip (±2%), and a pace past it is a slide: speed scrubbed, a loose exit
       - straights: braking curve into the next turn, full throttle out of it; wheel force against the
         traction the rear tyres have left after cornering (friction circle). Too much torque for the clay
         spins the tyres and gives some of it back; too little for the gearing leaves traction unused
       - throttle response: the foot, the engine's own pickup (weak low-end torque is slow to answer),
         and turbo lag where there is one
       - heat: the radiator sheds by airspeed and clogs with the dust of the car in front; the grille
         trades cooling against drag; past 112 °C the engine pulls power, past 122 it lifts a head
       - the dyno's own failures strike at some point under load, as everywhere else
     The same step drives the AI cars (a made-up engine and a driver's skill) and the player's car.
     The PAVED half-mile (v1.77) is the same step on another set of numbers (OVAL_TRACKS): 805 m, 70 m radius turns banked 13°, two 183 m
     straights, asphalt at μ about 1.05–1.15 that holds steady all night (the night's temperature moves it a little, and a hot night
     greases the tyres over the race), little rolling drag, no clay dust to clog the radiator, a car geared for the longer straight.
     The clay track's numbers are the originals, untouched.
     ===================================================================== */
  const OVAL_R = 52, OVAL_LEN = 600, OVAL_LS = (OVAL_LEN - 2 * Math.PI * OVAL_R) / 2, OVAL_BANK = 22 * Math.PI / 180, OVAL_W = 18, OVAL_G = 9.81;
  /* the tracks: geometry (R turn radius m, len lap m, ls straight m, bank rad, w width m) and what the surface does
     (crr rolling, scrub cornering scrub, dirtyK pace lost in the car ahead's air, dust radiator clogging, brakeK braking grip, vTopK the speed the rear end is
     sized for, lapRef seconds a lap for the failure clock, wearMu how much worn tyres lose) */
  const OVAL_TRACKS = {
    clay: { id: "clay", n: "Clay 3/8", surf: "clay", dist: "3/8 mile", R: OVAL_R, len: OVAL_LEN, ls: OVAL_LS, bank: OVAL_BANK, bankDeg: 22, w: OVAL_W,
      crr: 0.05, scrub: 0.10, dirtyK: 0.014, dust: 1, brakeK: 1, vTopK: 1, lapRef: 19, wearMu: 0.22 },
    paved: { id: "paved", n: "Paved half-mile", surf: "asphalt", dist: "1/2 mile", R: 70, len: 805, ls: (805 - 2 * Math.PI * 70) / 2, bank: 13 * Math.PI / 180, bankDeg: 13, w: 20,
      crr: 0.022, scrub: 0.07, dirtyK: 0.006, dust: 0.12, brakeK: 1.35, vTopK: 1.1, lapRef: 21, wearMu: 0.2 }
  };
  const ovalTrack = t => typeof t === "object" && t ? t : OVAL_TRACKS[t] || OVAL_TRACKS.clay;
  const OVAL_TYRES = {
    soft: { n: "Soft", d: "bites early · fades late", mu: 1.045, wear: 1.9 },
    med: { n: "Medium", d: "the all-rounder", mu: 1.0, wear: 1.0 },
    hard: { n: "Hard", d: "lasts · less bite", mu: 0.965, wear: 0.5 }
  };
  const OVAL_GRILLES = {
    open: { n: "Open", d: "cools best · drag, clogs", ua: 1.22, cd: 1.05, pk: 1.4 },
    mid: { n: "Half", d: "the usual", ua: 1, cd: 1, pk: 1 },
    tape: { n: "Taped", d: "slippery · runs hot", ua: 0.72, cd: 0.955, pk: 0.55 }
  };
  const OVAL_CLASSES = {
    street: { n: "Street Stock", d: "up to 360 ci · heavy steel-bodied stocks", tier: 1, rep: 10, ci: 360,
      veh: { mass: 1360, rf: 0.52, cdA: 1.12, tyreDia: 27, vTop: 42, mu: 0.66, engRef: 220, brake: 0.5, kw: 200 }, field: { hp: 295, sd: 45, skill: 0.55 } },
    late: { n: "Late Model", d: "up to 430 ci · lighter, more grip", tier: 2, rep: 45, ci: 430,
      veh: { mass: 1090, rf: 0.55, cdA: 1.2, tyreDia: 28, vTop: 47, mu: 0.70, engRef: 250, brake: 0.55, kw: 300 }, field: { hp: 560, sd: 70, skill: 0.68 } },
    open: { n: "Open", d: "any size · the lightest, fastest cars", tier: 3, rep: 110, ci: 9999,
      veh: { mass: 980, rf: 0.57, cdA: 1.26, tyreDia: 29, vTop: 51, mu: 0.72, engRef: 280, brake: 0.6, kw: 380 }, field: { hp: 780, sd: 100, skill: 0.8 } }
  };
  for (const k in OVAL_CLASSES) OVAL_CLASSES[k].id = k;
  const ovalCi = res => (+res.VdEq || +res.Vd || 5000) / 16.387;
  function ovalGaussian(r) { return Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r()); }
  /* the night's clay: base grip, how tacky it starts, its name */
  function ovalNight(seed, track) {
    if (ovalTrack(track).surf === "asphalt") {   // asphalt has no moisture: the night's temperature moves the grip (cool = more) and the cooling (hot air = less); a hot track greases the tyres over a race
      const q = pullRng(((seed >>> 0) ^ 0x0A5F17) >>> 0), t = q(), j = q(), f = q();
      return { seed: seed >>> 0, mu: +(1.13 - 0.09 * t + (j - 0.5) * 0.04).toFixed(3), wet: 0, name: t < 0.34 ? "cool" : t < 0.67 ? "mild" : "hot", fast: 0.5 + f * 0.4, amb: +(14 + 18 * t).toFixed(1), grease: +(0.15 + 0.85 * t).toFixed(2), temp: t };
    }
    const r = pullRng(((seed >>> 0) ^ 0x0D17A1) >>> 0), mu = +(0.64 + r() * 0.1).toFixed(3), wet = +(0.35 + r() * 0.5).toFixed(2);
    return { seed: seed >>> 0, mu: mu, wet: wet, name: wet > 0.7 ? "wet and tacky" : wet > 0.5 ? "tacky" : "medium", fast: 0.55 + r() * 0.4 };
  }
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
    const G = (v.redline * 2 * Math.PI / 60) * rw / (CV.vTop * TR.vTopK) / clamp(+v.finalK || 1, 0.7, 1.4), eta = 0.9, red = v.redline, lim = red * 1.03;
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
    /* the auto driver: a pace from his skill and a bit of lap-to-lap noise; he eases when the water is hot or the tyres are gone */
    function auto(skill) {
      const k = skill == null ? 0.88 : skill, lapNow = Math.max(0, Math.floor(st.s / L));
      const e = (1 - clamp(k, 0.2, 1)) * 0.028;
      let c = 1 - 1.2 * e - 0.006 + lapNoise(lapNow) * e * 0.5;
      if (st.cool > 106) c -= 0.006 + 0.0016 * (st.cool - 106); if (st.wear > 0.8) c -= 0.006;
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
    const G = red * 2 * Math.PI / 60 * rw / (CV.vTop * TR.vTopK) / clamp(+veh.finalK || 1, 0.7, 1.4), N0 = ovalNight(veh.seed || 1, TR), TY = OVAL_TYRES[veh.tyre] || OVAL_TYRES.med;
    const vc = ovalVlim(N0.mu * CV.mu / 0.7 * TY.mu, TR), rpmC = vc * G / rw * 60 / (2 * Math.PI), rpmE = clamp(rpmC * 1.15, 0, red), top = red * 2 * Math.PI / 60 * rw / G;
    const rp = res.rpms, tq = res.torque, at = r => { if (r <= rp[0]) return tq[0]; if (r >= rp[rp.length - 1]) return tq[tq.length - 1]; let i = 1; while (rp[i] < r) i++; return tq[i - 1] + (tq[i] - tq[i - 1]) * (r - rp[i - 1]) / (rp[i] - rp[i - 1]); };
    return { ratio: G, vc: vc, rpmC: rpmC, rpmE: rpmE, tqC: at(rpmC), tqE: at(rpmE), topKmh: top * 3.6, topMs: top, redline: red, vTop: CV.vTop * TR.vTopK };
  }
