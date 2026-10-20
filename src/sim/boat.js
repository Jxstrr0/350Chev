  /* =====================================================================
     BOAT DRAGS: 1,000 ft of river, two lanes, a tree. The engine turns a prop (pitch, slip, a blowout when the blades
     let go of the water) or a jet pump (an impeller cut, a nozzle). The hull pushes water, climbs a hump, then planes;
     a hydro ends up riding on its prop and the tips of its sponsons. Wind and chop change every run.
     Thrust: prop torque Q = Kq·n²·(0.45 + 0.55·slip), thrust T = Kt·n²·slip (efficiency ≈ 0.56 at 20% slip, 0.7 at 40%);
       the blades hold only so much thrust before they cavitate/ventilate (more at speed, less trimmed out or in the air):
       past it the prop blows out — thrust falls, it unloads, the rpm flares — and it re-hooks only when the load drops.
     Hull: R/W = hump (peaks at the hump speed) + planing (base + v² wetted friction) + air on (v + headwind)².
     Trim: in to get over the hump, out at speed to lift the bow off the water — too far out it porpoises, a vee or a
       flat chine-walks, and a hydro's nose gets light: past its lift limit it blows over. Raw-water cooling stays cool
       unless the pickup sucks up weed.
     ===================================================================== */
  const BOAT_FT = 304.8, BOAT_SPLITS = [[18.29, "60 ft"], [100.58, "330 ft"], [201.17, "660 ft"], [304.8, "1000 ft"]];
  const BOAT_HULLS = {
    vee: { n: "V-bottom", vh: 6.5, H: 0.28, p0: 0.055, cw: 6e-5, cdA: 1.0, Sl: 0.6, opt: 3.5, walk: 25, pr: 0 },
    flat: { n: "Flat bottom", vh: 8.0, H: 0.24, p0: 0.05, cw: 1.6e-5, cdA: 1.1, Sl: 1.6, opt: 2.5, walk: 52, pr: 0 },
    hydro: { n: "Three-point hydro", vh: 9.0, H: 0.2, p0: 0.04, cw: 1.0e-5, cdA: 0.6, Sl: 2.1, opt: 2.0, walk: 0, pr: 45 }
  };
  const BOAT_IMP = [["A", "A-cut", 0.50, "light · revs, holeshot"], ["B", "B-cut", 0.56, "medium"], ["C", "C-cut", 0.62, "heavy"], ["D", "D-cut", 0.68, "racing · top end"]];
  const BOAT_CLASSES = {
    outboard: { n: "Outboard · Stock", d: "V-bottom · outboard · ≤ 3.3 L", tier: 1, rep: 0, hull: "vee", drive: "prop", hullKg: 560, rigKg: 90, maxL: 3.3,
      gear: [1.2, 3.6, 1.85], pitch: [17, 37, 26], Kq0: 0.348, Tc0: 0.62, field: { hp: 185, sd: 22, mph: 64, dsl: 0, red: [5600, 6400] }, fee: 300, purse: 2000 },
    jet: { n: "Jet boat", d: "flat-bottom · pump drive, no prop", tier: 2, rep: 30, hull: "flat", drive: "jet", hullKg: 900, rigKg: 60, maxL: 0, A: 0.0042,
      gear: [0.35, 1.6, 1.0], imp: 1, Tc0: 0.95, field: { hp: 520, sd: 90, mph: 94, dsl: 0.25 }, fee: 600, purse: 4000 },
    pro: { n: "Pro Eliminator", d: "blown flat · V-drive, cleaver prop", tier: 3, rep: 100, hull: "flat", drive: "prop", hullKg: 820, rigKg: 60, maxL: 0,
      gear: [0.6, 1.7, 1.0], pitch: [24, 44, 32], Kq0: 0.219, Tc0: 1.7, field: { hp: 1900, sd: 280, mph: 163, dsl: 0, red: [7200, 8200] }, fee: 1350, purse: 9000 },
    tfh: { n: "Top Fuel Hydro", d: "three-point hydro · rides on its prop", tier: 4, rep: 250, hull: "hydro", drive: "prop", hullKg: 600, rigKg: 60, maxL: 0,
      gear: [0.55, 1.6, 1.0], pitch: [28, 50, 36], Kq0: 0.304, Tc0: 2.2, field: { hp: 2900, sd: 380, mph: 192, dsl: 0, red: [7400, 8400] }, fee: 3000, purse: 20000 }
  };
  for (const k in BOAT_CLASSES) BOAT_CLASSES[k].id = k;
  /* a run's water: headwind (m/s, − is a tailwind) and chop (0 glassy … 1 rough). Same seed, same water. */
  function boatWater(seed) { const r = pullRng(((seed >>> 0) ^ 0xB0A7D2) >>> 0); const w = -3 + r() * 9, c = Math.pow(r(), 1.6) * 0.85;
    return { seed: seed >>> 0, wind: +w.toFixed(1), chop: +c.toFixed(2), name: c < 0.12 ? "glassy" : c < 0.3 ? "light ripple" : c < 0.55 ? "a little chop" : "rough" }; }
  function boatTrimRange() { return [-3, 6]; }
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
      if (st.t - st.lastTr >= 0.05) { st.lastTr = st.t; st.trace.push({ t: +st.t.toFixed(2), x: +st.x.toFixed(2), v: +st.v.toFixed(2), rpm: Math.round(st.rpm), slip: +st.slip.toFixed(3), thr: +thr.toFixed(2), trim: +st.trim.toFixed(2), lr: +st.Lr.toFixed(2), b: st.blown ? 1 : 0 }); }
      if (!st.done && (st.finished || st.dnf || st.broke)) { st.done = true; st.doneT = st.t; }
      if (!st.done && st.t > 25) { st.done = true; st.doneT = st.t; st.dnf = st.dnf || "time"; }
    }
    function step(dt, throttle, trimCmd) { if (throttle != null) st.thr = clamp(+throttle || 0, 0, 1); if (trimCmd != null) st.trimCmd = clamp(+trimCmd || 0, -1, 1); dt = Math.min(0.25, Math.max(0, dt)); while (dt > 1e-9) { const h = Math.min(0.005, dt); dt -= h; sub(h); } return st; }
    /* the auto driver: leaves on its light, feathers to keep the prop hooked through the hump, lifts over a hop,
       trims in for the hump and out with speed — but backs it in when it porpoises, walks or the nose gets light */
    function auto(skill) {
      const k = skill == null ? 1 : skill;
      if (st.done) return { thr: 0, trim: 0 };
      if (st.phase === "line") return { thr: st.t >= (v.rt != null ? v.rt : 0.08) ? 1 : 0, trim: 0 };
      const f = st.v / HU.vh, tOpt = boatLerp(-2, opt, boatSm(0.8, 2.2, f)), aim = tOpt - 0.3 - 0.6 * (1 - k) + (k > 0.9 ? 0.25 * Math.min(1, st.v / 60) : 0);
      let thr = st.foot;
      if (st.blown) thr = Math.max(0.3, thr - 0.08 * (0.6 + k)); else if (st.air) thr = Math.max(0.5, thr - 0.08 * k); else thr = Math.min(1, thr + 0.04 + 0.04 * k);
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
      if (st.broke) reasons.push(st.broke === "valve_float" ? `${st.limT.toFixed(1)} s bouncing off the limiter — every hop let the prop unload and the valves floated. Feather the throttle over the chop.` : st.broke === "head_lift" ? `Water hit ${Math.round(st.coolPeak)} °C with the raw-water pickup choked by weed — it lifted the head.` : st.broke === "worn" ? "Something tired let go — the engine was overdue a freshen." : `It let go ${Math.round(dist * 3.28084)} ft down the course.`);
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
