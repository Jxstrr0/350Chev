  /* =====================================================================
     24 HOURS OF PRAIRIE SKY — the endurance race.
     The car is the road-test car on race slicks. Its pace comes from lapSim in three engine
     modes (torque × 1 / 0.965 / 0.92 at the same gearing), its grip sensitivity from a second
     lap on a harder tyre, its thirst from the lap trace (throttle × the full-load fuel flow at
     that rpm). Reliability is the dyno endurance model run hot (31 °C) and cool (11 °C) on the
     track profile: each subsystem's Miner damage rate, scaled by mode and the hour's ambient,
     is its wear and — × E24_K — its hazard of letting go this hour.
     The race is a discrete-event sim: every car is its next line-crossing time; enduroStep
     takes crossings (and the timed events: safety cars, the sky) in time order up to a target
     clock, so the app can run 24 h in slices without freezing the page.
     ===================================================================== */
  const E24_MODES = {
    push: { n: "Push", tq: 1.0, fuel: 1.05, mech: 1.05, therm: 1.06, tyre: 1.25, err: 1.7, d: "everything it has" },
    race: { n: "Race", tq: 0.965, fuel: 0.97, mech: 1.0, therm: 1.0, tyre: 1.0, err: 1.0, d: "short-shift, 96% torque" },
    save: { n: "Conserve", tq: 0.92, fuel: 0.88, mech: 0.95, therm: 0.93, tyre: 0.8, err: 0.7, d: "lean cruise, 92% torque" } };
  // race compounds as μ on the semi-slick; km = life before the cliff at 20 °C
  const E24_TYRES = { soft: { n: "Soft", mu: 1.035, km: 170 }, medium: { n: "Medium", mu: 1.0, km: 270 }, hard: { n: "Hard", mu: 0.965, km: 420 } };
  // subsystems that run on heat (ambient and mode bite harder) — the rest are mechanical (rpm, load)
  const E24_THERM = { cooling: 1, crown_temp: 1, valve_temp: 1, turbine_temp: 1, preignition_egt: 1, detonation: 1, compressor_map: 1, als_heat: 1, coolant_seal: 1, head_lift: 1, gasket_shear: 1, oil_starvation: 1, hot_clearance: 1, vgt_vanes: 1, carbon_seals: 1 };
  // what a failure of that subsystem is in the pit lane: [chance it can be fixed, minutes, the fix]; anything else is terminal
  const E24_FIX = { cooling: [0.85, 7, "split radiator hose replaced"], fuel_delivery: [0.9, 9, "fuel pump changed"], turbine_temp: [0.6, 24, "turbo changed"],
    compressor_map: [0.7, 24, "turbo changed"], vgt_vanes: [0.7, 20, "turbo vane ring freed"], als_heat: [0.7, 22, "cooked turbo changed"],
    oil_starvation: [0.45, 6, "oil surge — topped up, pickup checked"], detonation: [0.35, 5, "burnt plug changed, map pulled back"], preignition_egt: [0.35, 6, "plugs changed, map richened"],
    valve_temp: [0.3, 8, "misfire — plugs and leads"], head_lift: [0.25, 18, "head bolts re-torqued"], gasket_shear: [0.25, 18, "weeping head gasket — coolant topped up"],
    cold_start: [1, 3, "starter changed"], flex_blend: [1, 4, "fuel filter changed"], slap_blowby: [0.8, 4, "blow-by — oil topped up"], ring_gap: [0.6, 4, "oil consumption — topped up"],
    hot_clearance: [0.4, 6, "scuffed piston — oil topped up"], coolant_seal: [0.4, 12, "O-ring weep — coolant topped up"], carbon_seals: [0.7, 5, "carbon cleared with a hot lap"], oil_metering: [0.8, 5, "oil metering pump changed"] };
  /* a wet sump in the 24 h: the oil-surge rate is multiplied by k and never below floor per hour (race mode) */
  const E24_WET = { k: 3, floor: 0.04 };
  const E24_K = 2.5, E24_DUR = 86400, E24_START = 14, E24_TANK = 100, E24_SC_RATE = 0.16;
  const E24_CLASSES = {
    proto: { n: "Proto", ch: "super", k: 0.96, pool: ["v12_65", "valkyrie", "r26b", "dfv", "v10_52", "1lr", "s85", "hellcat"], prize: [30000, 18000, 10000, 5000, 3000], rep: [34, 22, 15] },
    gt: { n: "GT", ch: "super", k: 1, pool: ["gt3r", "m156", "p997t", "9a2tt", "vr38", "coyote", "f6_38", "voodoo", "ls3", "godzilla73", "b58", "hemi64"], prize: [20000, 12000, 7000, 4000, 2500], rep: [26, 17, 11] },
    stock: { n: "Stock", ch: "coupe", k: 1, pool: ["k20a", "2jzgte", "rb26", "ej257", "4g63", "1gr", "s54", "l36", "13b_rew", "f20c", "ea888", "20b_rew"], prize: [12000, 7000, 4000, 2500, 1500], rep: [18, 12, 8] } };
  const E24_CLS_ORDER = ["proto", "gt", "stock"], E24_FIELD = { proto: 5, gt: 8, stock: 7 };
  const E24_TEAMS = ["Coulee Racing", "Big Sky Motorsport", "Red Deer Autosport", "Moose Jaw Speed", "Brandon Garage", "Medicine Hat Racing", "Swift Current GT", "Yorkton Engineering",
    "Lethbridge Lightning", "Prince Albert Racing", "Estevan Oilpatch", "Grain Belt Motorsport", "Chinook Racing", "Badlands Competition", "Canola Speedworks", "Saskatoon Sports Cars",
    "Regina Rapid", "Drumheller Racing", "Wheatland Works", "Qu'Appelle Valley", "Cypress Hills GT", "Battleford Bros", "Kindersley Kustom", "Weyburn Wheels"];
  const E24_DRIVERS = ["A. Lindqvist", "J. Kowalchuk", "M. Bélanger", "R. Okafor", "T. Nakamura", "C. Running Rabbit", "E. Petrenko", "S. MacLeod", "L. Dubois", "K. Singh", "B. Halvorsen", "N. Wiebe"];
  const e24Rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const e24Gauss = r => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307 * r()); };
  const e24Sm = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  /* the clock: the green flag drops at 2 pm; 30 °C at 4 pm, 12 °C at 4 am; dark from about 22:15 to 04:45 */
  function e24Hour(t) { return (E24_START + t / 3600) % 24; }
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
  const e24Clock = t => { const h = e24Hour(t), hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm; };
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
    // pits
    let box = !!c.pend;
    const lf = P.modes[c.mode].fuel, left = R.dur - t, lapNow = P.modes[c.mode].lap * c.pace;
    const canFinish = c.fuel >= (left / lapNow + 1) * lf;
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

