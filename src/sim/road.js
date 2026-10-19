  /* =====================================================================
     Road test: the engine bolted into a car. Straight-line figures come from a
     time-stepped run (clutch launch, traction limit with weight transfer, the
     torque curve through the gearbox, shift times, turbo lag); the lap is a
     quasi-steady point-mass simulation over a track built from straights and
     constant-radius corners: a grip ceiling from μ·(g + downforce), a backward
     pass for braking, a forward pass that carries gear, shift and boost state.
     ===================================================================== */
  // μ by tyre class (peak, dry, warm). Lateral and longitudinal share one friction circle.
  const ROAD_TYRES = { eco: { n: "Eco", mu: 0.86, d: "hard, low rolling drag" }, street: { n: "Street", mu: 1.0, d: "all-round summer tyre" },
    sport: { n: "Sport", mu: 1.1, d: "soft, warm-up quick" }, semi: { n: "Semi-slick", mu: 1.26, d: "track tyre, road legal" } };
  /* generic chassis archetypes. mass includes a baseline engine of `eng` kg sitting at xE (fraction of the wheelbase
     forward of the rear axle: ~1 = over the front axle, ~0.25 = behind the seats). front = static front weight share.
     cdA m², clA = downforce coefficient × area (m², + is down), brake = what the brakes can hold in g, ratios = gearbox. */
  const CHASSIS = {
    roadster: { n: "Light roadster", d: "1,000 kg · RWD · 50/50", mass: 1000, eng: 120, drive: "rwd", front: 0.50, xE: 0.92, cgH: 0.45, wb: 2.31, tyre: "sport", cdA: 0.83, clA: 0.06, brake: 1.05, tyreDia: 24.4, ratios: [3.76, 2.27, 1.65, 1.26, 1.0, 0.84], shift: 0.22, rr: 0.011 },
    hatch: { n: "Hot hatch", d: "1,200 kg · FWD · 62% front", mass: 1200, eng: 135, drive: "fwd", front: 0.62, xE: 1.06, cgH: 0.53, wb: 2.6, tyre: "street", cdA: 0.88, clA: 0.02, brake: 1.0, tyreDia: 25.2, ratios: [3.31, 2.13, 1.48, 1.12, 0.92, 0.77], shift: 0.25, rr: 0.011 },
    coupe: { n: "Sports coupé", d: "1,350 kg · RWD · 53% front", mass: 1350, eng: 165, drive: "rwd", front: 0.53, xE: 0.9, cgH: 0.48, wb: 2.57, tyre: "sport", cdA: 0.8, clA: 0.12, brake: 1.08, tyreDia: 25.7, ratios: [3.62, 2.19, 1.54, 1.21, 1.0, 0.79], shift: 0.2, rr: 0.011 },
    muscle: { n: "Muscle car", d: "1,650 kg · RWD · 56% front", mass: 1650, eng: 230, drive: "rwd", front: 0.56, xE: 0.95, cgH: 0.52, wb: 2.72, tyre: "street", cdA: 0.98, clA: 0, brake: 0.98, tyreDia: 26.5, ratios: [2.97, 2.07, 1.43, 1.0, 0.84, 0.56], shift: 0.3, rr: 0.012 },
    rally: { n: "AWD rally sedan", d: "1,450 kg · AWD · 58% front", mass: 1450, eng: 150, drive: "awd", front: 0.58, xE: 1.0, cgH: 0.5, wb: 2.63, tyre: "sport", cdA: 0.93, clA: 0.18, brake: 1.05, tyreDia: 25.2, ratios: [3.64, 2.38, 1.76, 1.35, 1.06, 0.84], shift: 0.2, rr: 0.012 },
    pickup: { n: "Pickup truck", d: "2,100 kg · RWD · tall and soft", mass: 2100, eng: 260, drive: "rwd", front: 0.57, xE: 1.0, cgH: 0.72, wb: 3.4, tyre: "eco", cdA: 1.4, clA: -0.05, brake: 0.85, tyreDia: 31, ratios: [4.17, 2.34, 1.52, 1.14, 0.85, 0.67], shift: 0.4, rr: 0.014 },
    super: { n: "Mid-engine GT", d: "1,450 kg · RWD · 42% front · wing", mass: 1450, eng: 200, drive: "rwd", front: 0.42, xE: 0.25, cgH: 0.42, wb: 2.65, tyre: "semi", cdA: 0.93, clA: 1.0, brake: 1.2, tyreDia: 27, ratios: [3.13, 2.1, 1.62, 1.3, 1.07, 0.88, 0.7], shift: 0.12, rr: 0.011 }
  };
  /* tracks: a closed polygon of [x, y, corner radius, name] (metres, driven clockwise); each vertex is filleted with
     its radius, the straights run tangent to tangent. start = metres into the main straight (vertex 0 → 1);
     sec = sector lines as lap fractions; scale stretches the whole map. */
  const ROAD_TRACKS = {
    club: { n: "Coulee Park", d: "club circuit · 7 turns", start: 250, sec: [0.36, 0.7], scale: 1, pts: [
      [-350, 215, 60, "Pit bend"], [330, 215, 30, "Elevator"], [410, -60, 80, "Section Line"], [330, -280, 19, "Gopher hairpin"], [130, -90, 50, "Coulee"],
      [-120, -230, 38, "Slough"], [-390, -130, 110, "Canola sweep"]] },
    gp: { n: "Prairie Sky Raceway", d: "GP circuit · 12 turns", start: 380, sec: [0.33, 0.67], scale: 1, pts: [
      [-760, 330, 90, "Coulee"], [560, 330, 26, "Elevator"], [640, 60, 150, "Chinook kink"], [560, -170, 60, "Badlands"], [330, -170, 42, "Canola esses"],
      [190, -330, 42, ""], [-420, -380, 21, "Grain Bin hairpin"], [-140, -200, 160, "Big Sky sweeper"], [-80, 30, 52, "Gopher"], [-420, 60, 36, "Slough"], [-600, -120, 70, "Badger"], [-860, -60, 120, ""]] },
    street: { n: "Grain Exchange Street Circuit", d: "street circuit · 13 turns", no24: true, start: 150, sec: [0.33, 0.67], scale: 1, pts: [
      [-230, 190, 26, "Depot Street"], [220, 190, 24, "Grain Exchange"], [220, 120, 20, ""], [300, 120, 20, "Stockyard"], [300, -180, 28, "Elevator Row"],
      [120, -180, 20, "Bank Street"], [120, -60, 20, "Courthouse"], [-110, -60, 14, "Mill hairpin"], [-30, -120, 18, ""], [-30, -240, 22, "Rail Crossing"],
      [-280, -240, 26, "Depot Yard"], [-280, -60, 18, "Weigh Station"], [-230, -60, 18, ""]] }
  };
  const ROAD_DS = 2.5, ROAD_G = 9.81, ROAD_RHO = 1.2;
  const TRACK_CACHE = {};
  function roadTrack(id) {
    if (TRACK_CACHE[id]) return TRACK_CACHE[id];
    const T = ROAD_TRACKS[id] || ROAD_TRACKS.club;
    // fillet each vertex: turn angle, tangent length; emit [straight, corner] pairs starting on the main straight
    const P = T.pts.map(q => [q[0] * T.scale, q[1] * T.scale, q[2], q[3]]), nv = P.length, ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
    const turn = [], tl = [];
    for (let i = 0; i < nv; i++) { const a = P[(i - 1 + nv) % nv], v = P[i], b = P[(i + 1) % nv]; let d = ang(v, b) - ang(a, v); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; turn.push(d); tl.push(v[2] * Math.tan(Math.abs(d) / 2)); }
    const segs = [];
    for (let i = 0; i < nv; i++) { const j = (i + 1) % nv, L = Math.hypot(P[j][0] - P[i][0], P[j][1] - P[i][1]) - tl[i] - tl[j]; segs.push(["s", Math.max(1, L)]); segs.push(["c", P[j][2], turn[j] * 180 / Math.PI, P[j][3]]); }
    const h0 = ang(P[0], P[1]);
    // sample at ROAD_DS: position, heading, curvature (+ left)
    const X = [], Y = [], H = [], K = [], seg = [];
    let x = P[0][0] + Math.cos(h0) * tl[0], y = P[0][1] + Math.sin(h0) * tl[0], h = h0, carry = 0;
    const corners = [];
    let s0 = 0;
    segs.forEach((s, si) => {
      const L = s[0] === "s" ? s[1] : s[1] * Math.abs(s[2]) * Math.PI / 180, k = s[0] === "s" ? 0 : Math.sign(s[2]) / s[1];
      if (s[0] === "c") corners.push({ s0: s0, s1: s0 + L, R: s[1], deg: s[2], name: s[3] || "", i: si });
      let u = carry;
      while (u < L - 1e-9) {
        let px, py, ph;
        if (k === 0) { px = x + Math.cos(h) * u; py = y + Math.sin(h) * u; ph = h; }
        else { const R = 1 / Math.abs(k), sg2 = Math.sign(k), cx = x - Math.sin(h) * R * sg2, cy = y + Math.cos(h) * R * sg2; ph = h + u * k; px = cx + Math.sin(ph) * R * sg2; py = cy - Math.cos(ph) * R * sg2; }
        X.push(px); Y.push(py); H.push(ph); K.push(k); seg.push(si); u += ROAD_DS;
      }
      carry = u - L;
      if (k === 0) { x += Math.cos(h) * L; y += Math.sin(h) * L; } else { const R = 1 / Math.abs(k), sg2 = Math.sign(k), cx = x - Math.sin(h) * R * sg2, cy = y + Math.cos(h) * R * sg2; h += L * k; x = cx + Math.sin(h) * R * sg2; y = cy - Math.cos(h) * R * sg2; }
      s0 += L;
    });
    // rotate so sample 0 is the start/finish line; recentre the map on the origin
    const n = X.length, i0 = Math.round(T.start / ROAD_DS) % n, rot = a2 => a2.slice(i0).concat(a2.slice(0, i0));
    const Xr = rot(X), Yr = rot(Y), Hr = rot(H), Kr = rot(K), Sr = rot(seg);
    let mx = Infinity, Mx = -Infinity, my = Infinity, My = -Infinity; for (let i = 0; i < n; i++) { mx = Math.min(mx, Xr[i]); Mx = Math.max(Mx, Xr[i]); my = Math.min(my, Yr[i]); My = Math.max(My, Yr[i]); }
    const ox = (mx + Mx) / 2, oy = (my + My) / 2; for (let i = 0; i < n; i++) { Xr[i] -= ox; Yr[i] -= oy; }
    const len = n * ROAD_DS, sh = i0 * ROAD_DS;
    corners.forEach(c => { c.s0 = ((c.s0 - sh) % len + len) % len; c.s1 = ((c.s1 - sh) % len + len) % len; });
    corners.sort((p, q) => p.s0 - q.s0);
    const out = { id: T === ROAD_TRACKS[id] ? id : "club", n: T.n, d: T.d, len: len, ds: ROAD_DS, N: n, x: Xr, y: Yr, h: Hr, k: Kr, seg: Sr, corners: corners, sec: T.sec.slice(), size: [Mx - mx, My - my] };
    TRACK_CACHE[id] = out; return out;
  }

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
    const fdAuto = fd; fd = clamp(fd * clamp(+opt.finalK || 1, 0.7, 1.4), 0.7, 8);
    const RC = { sw: !!sw, ch: opt.ch in CHASSIS ? opt.ch : "coupe", C: C0, tyre: opt.tyre in ROAD_TYRES ? opt.tyre : C0.tyre, mu: ty.mu, m: m, front: front, dFront: dF, kBal: kBal, kLoad: kLoad,
      muLat: ty.mu * kBal * kLoad * 0.97, muLong: ty.mu * kLoad * 1.12, rw: rw, eta: eta, gears: gears, fd: fd, fdAuto: fdAuto, redline: redline, idle: res.idle || 850,
      cdA: C0.cdA, clA: C0.clA, crr: crr, h: C0.cgH, wb: C0.wb, drive: C0.drive, brake: C0.brake, shift: C0.shift * (sw ? 0.6 : 1), engKg: ekg, vPow: vPow,
      bal: dF > 0.025 ? "under" : dF < -0.025 ? "over" : "neutral" };
    if (+opt.dtCap > 0) RC.dtCap = +opt.dtCap;   // a drivetrain tier (sim/drag.js); absent = no limit
    return roadSetup(RC, opt.setup);
  }

  /* the setup sheet: roll stiffness (soft..stiff, springs + bars together, 0..100, 50 stock), the front/rear split of it
     (-100 stiffer rear .. +100 stiffer front, 0 stock) and the wing angle (-100 flat .. +100 steep, 0 stock). Lateral grip is
     the weaker axle's: the stiffer end of the car sheds more grip to load transfer, so a front-stiff car pushes (under) and a
     rear-stiff one comes round (over). The chassis' own nose-weight bias (`bias`, + = pushes) is already in the stock numbers,
     so the stock setup is the reference and leaves the car exactly as it was; moving toward neutral gains a little, past it
     loses. The wing trades downforce (clA) for drag (cdA) and loads the tail. Absent / stock = no change at all. */
  // wing: +100 adds a (+ b per m² the chassis already makes) of downforce at d drag per unit of it (L/D 2.5): it pays in the corners
  // (a little at club speeds, more on the hill's fast sweepers) and costs top speed on the straights
  const WK = { bal: 0.05, a: 2.6, b: 0.3, d: 0.4 };
  const SETUP_STOCK = { st: 50, sp: 0, wg: 0 };
  function setupNorm(su) {
    if (!su) return null;
    const st = clamp(Math.round(+su.st), 0, 100), sp = clamp(Math.round(+su.sp), -100, 100), wg = clamp(Math.round(+su.wg), -100, 100);
    const o = { st: isFinite(st) ? st : 50, sp: isFinite(sp) ? sp : 0, wg: isFinite(wg) ? wg : 0 };
    return o.st === 50 && o.sp === 0 && o.wg === 0 ? null : o;
  }
  function roadSetup(car, setup) {
    const bias = clamp(car.dFront * 8, -0.6, 0.6);
    car.bias = bias; car.su = null; car.bi = bias;
    const su = setupNorm(setup); if (!su) return car;
    const amp = 0.6 + 0.8 * su.st / 100, r = su.sp / 100 * amp + WK.bal * su.wg / 100, g = r + bias;
    const kSt = 1 - 1.25e-5 * (Math.pow(su.st - 65, 2) - 225);   // best near 65 (a touch firmer than stock): soft rolls onto its camber, very stiff skips over bumps
    car.muLat *= kSt * (1 - 0.10 * (Math.abs(g) - Math.abs(bias)));
    const dCl = su.wg / 100 * (WK.a + WK.b * Math.min(2, Math.max(0, car.clA)));
    const cl1 = Math.max(car.clA + dCl, Math.min(car.clA, -0.1));   // a flat wing sheds the downforce, it does not turn into lift
    car.cdA = Math.max(0.3, car.cdA + WK.d * (cl1 - car.clA)); car.clA = cl1;
    if (r < 0 && car.drive !== "fwd") car.tK = 0.10 * Math.min(1, -r);   // tail-happy: the rear lets go on the throttle out of a corner
    else if (r > 0 && car.drive === "fwd") car.tK = 0.08 * Math.min(1, r);   // front-drive and front-stiff: it pushes wide on the power
    car.su = su; car.bi = clamp(g, -1, 1);
    return car;
  }
  /* what the 3D car shows: roll gain on the stock lean, brake-dive gain, and how much each axle's inside wheel can lift */
  function setupVis(setup) {
    const su = setupNorm(setup) || SETUP_STOCK, t = su.st / 100, sp = su.sp / 100;
    const gain = t <= 0.5 ? 1 + (0.5 - t) * 2.8 : 1 - (t - 0.5) * 1.6;   // soft 2.4x the stock lean, stiff 0.2x
    return { rk: +gain.toFixed(3), dive: +gain.toFixed(3),
      lf: +clamp((t - 0.55) * 2.2 + 0.6 * sp, 0, 1).toFixed(3), lr: +clamp((t - 0.55) * 2.2 - 0.6 * sp, 0, 1).toFixed(3) };
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
    const DF = 0.5 * ROAD_RHO * car.clA * v * v, mg = car.m * ROAD_G, mu = car.muLong * Math.sqrt(Math.max(0, 1 - latF * latF)) * (car.tK ? 1 - car.tK * latF : 1), hw = car.h / car.wb;
    if (car.drive === "awd") return mu * (mg + DF) * 0.98;
    if (car.drive === "fwd") return mu * (mg * car.front + DF * 0.45) / (1 + mu * hw);
    return mu * (mg * (1 - car.front) + DF * 0.55) / Math.max(0.3, 1 - mu * hw);
  }
  function brakeF(car, v, latF) {
    const DF = 0.5 * ROAD_RHO * car.clA * v * v, mg = car.m * ROAD_G;
    return Math.min(car.brake * mg, car.muLong * (mg + Math.max(0, DF))) * Math.sqrt(Math.max(0, 1 - latF * latF));
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
    const T = roadTrack(trackId), N = T.N, ds = T.ds, car = roadCar(res, opt), E = roadEngine(res, car), m = car.m;
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

