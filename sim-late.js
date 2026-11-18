/*pew-simlate 1.76.138.0*/
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
;({e24Amb:e24Amb,e24Sky:e24Sky,enduroPrep:enduroPrep,e24Rates:e24Rates,e24AiPrep:e24Ai,enduroClasses:enduroClasses,enduroClassOf:enduroClassOf,enduroNew:enduroNew,e24Need:e24Need,e24Lap:e24Lap,e24Order:e24Order,e24Pos:e24Pos,enduroStep:enduroStep,enduroWhere:enduroWhere,enduroResult:enduroResult,hillCourse:hillCourse,hillPrep:hillPrep,hillCar:hillCar,hillCalls:hillCalls,hillPlan:hillPlan,hillNew:hillNew,hillPass:hillPass,hillAiPrep:hillAiPrep})
//# sourceURL=sim-late.js
