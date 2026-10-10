  /* =====================================================================
     MUD BOG: the engine in a truck, a run-up on firm dirt, then a pit of mud 60–90 m long.
     Stuck in the pit scores the distance; through it scores the time from the near edge to the far one.
     Mud: depth varies along the pit, consistency per night (0 soupy … 1 sticky clay), hidden ruts and hard ridges.
     The tyre: bite against slip like the sled's dirt, plus a paddle's push from wheel speed over ground speed;
     slow wheels pack their lugs with mud (bite goes), fast ones throw it out (clean), too much spin digs a hole.
     Drag: rolling resistance grows with how far the tyres are under, a bow wave of mud, and the belly once it
     touches. The engine bogs below a band (torque falls away), a clutch truck can stall, and the radiator packs up.
     ===================================================================== */
  const BOG_TYRES = {
    mt: { n: "Mud-terrain", d: "street lugs · bite, then pack up", mu: 0.56, sp: 0.16, fall: 0.40, clean: 0.15, dig: 1.0, paddle: 0.15 },
    swamp: { n: "Swampers", d: "tall bias-ply · deep lugs", mu: 0.62, sp: 0.24, fall: 0.32, clean: 0.45, dig: 0.8, paddle: 0.45 },
    paddle: { n: "Paddle tyres", d: "cupped paddles · need wheel speed", mu: 0.46, sp: 0.42, fall: 0.15, clean: 0.85, dig: 0.6, paddle: 1 }
  };
  const BOG_CLASSES = {
    street: { n: "Street 4×4", d: "plated pickup · mud-terrains · part-time 4×4", tier: 1, rep: 0,
      veh: { mass: 2500, tyreDia: 35, width: 1.9, clear: 0.30, front: 0.55, drive: 0.85, driveN: "part-time 4×4", trans: "conv", tyres: ["mt"], runup: 30, pitK: 1 },
      gears: [["1st", 24], ["2nd", 36], ["3rd", 50]], field: { hp: 290, sd: 60, dsl: 0.4 } },
    modified: { n: "Modified", d: "lifted · swampers · lockers both ends", tier: 2, rep: 40,
      veh: { mass: 2150, tyreDia: 44, width: 2.1, clear: 0.45, front: 0.52, drive: 1.0, driveN: "locked 4×4", trans: "conv", tyres: ["mt", "swamp"], runup: 35, pitK: 1.4 },
      gears: [["1st", 28], ["2nd", 42], ["3rd", 58]], field: { hp: 480, sd: 90, dsl: 0.3 } },
    super: { n: "Open · Super", d: "tube chassis · paddles · spooled, clutch", tier: 3, rep: 150,
      veh: { mass: 1650, tyreDia: 54, width: 2.4, clear: 0.62, front: 0.48, drive: 1.0, driveN: "spooled 4×4", trans: "clutch", tyres: ["swamp", "paddle"], runup: 40, pitK: 1.75 },
      gears: [["2nd", 40], ["3rd", 56], ["4th", 74]], field: { hp: 850, sd: 150, dsl: 0.15 } }
  };
  for (const k in BOG_CLASSES) BOG_CLASSES[k].id = k;
  function bogGears(cls) { return (BOG_CLASSES[cls] || BOG_CLASSES.street).gears; }
  function bogMudName(c) { return c < 0.22 ? "soupy" : c < 0.45 ? "sloppy" : c < 0.7 ? "peanut butter" : "sticky clay"; }
  /* the night's pit: length, mud, a depth profile every half metre, hidden ruts and hard ridges. Same seed, same pit. */
  function bogNight(seed) {
    const r = pullRng(((seed >>> 0) ^ 0x6B0C1D) >>> 0);
    const len = 60 + Math.floor(r() * 31), cons = +(0.05 + r() * 0.9).toFixed(2), d0 = 0.42 + r() * 0.26;
    const l1 = 9 + r() * 9, l2 = 3 + r() * 3, p1 = r() * 6.28, p2 = r() * 6.28, n = Math.ceil(len * 2) + 1, depth = new Array(n);
    for (let i = 0; i < n; i++) { const x = i / 2;
      let d = d0 * (0.82 + 0.22 * Math.sin(2 * Math.PI * x / l1 + p1) + 0.1 * Math.sin(2 * Math.PI * x / l2 + p2)) * (0.86 + 0.28 * Math.sin(Math.PI * x / len));
      d *= clamp(x / 5, 0.25, 1) * clamp((len - x) / 6, 0.35, 1); depth[i] = +d.toFixed(3); }
    const hz = [], nh = 3 + Math.floor(r() * 3);
    for (let i = 0; i < nh; i++) { const kind = r() < 0.55 ? "rut" : "bump", x = 10 + r() * (len - 20);
      if (hz.some(h => Math.abs(h.x - x) < 5)) continue;
      hz.push({ x: +x.toFixed(1), kind, h: +(kind === "rut" ? 0.2 + r() * 0.2 : 0.14 + r() * 0.18).toFixed(2), w: +(kind === "rut" ? 1.6 + r() * 1.2 : 0.8 + r() * 0.6).toFixed(1) }); }
    hz.sort((a, b) => a.x - b.x);
    return { seed: seed >>> 0, len, cons, name: bogMudName(cons), d0: +d0.toFixed(2), depth, hz };
  }
  function bogDepth(N, x) { if (x < 0 || x > N.len) return 0; const f = x * 2, i = Math.floor(f), a = N.depth[i] || 0, b = N.depth[Math.min(N.depth.length - 1, i + 1)] || 0; return a + (b - a) * (f - i); }

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
    const kW = Math.max(60, (res.peakHp || 250) * 0.7457), Cth = (7 + 2.6 * VdL) * 1000, UA = kW * 1000 * 0.5 / 62;   // a radiator sized to hold full power at full airflow
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
      if (st.t - lastTrace >= 0.1) { lastTrace = st.t; st.trace.push({ t: +st.t.toFixed(1), x: +st.x.toFixed(2), v: +st.v.toFixed(2), rpm: Math.round(st.rpm), slip: +st.slip.toFixed(3), throttle: +thr.toFixed(2), d: +st.depth.toFixed(2), cool: Math.round(st.cool), egt: Math.round(st.egt), pack: +st.pack.toFixed(2), dig: +st.dig.toFixed(2) }); }
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
       out of the bog band — on with it when the rpm sags, off when the slip runs past the dig point. skill 0..1 blurs it. */
    function auto(skill) {
      const k = skill == null ? 1 : skill;
      if (st.phase === "stage") return 1;
      if (st.phase === "runup") { st.ai = st.slip > 0.22 ? Math.max(0.5, st.ai - 0.04) : Math.min(1, st.ai + 0.05); return st.ai; }
      const tgt = sw[1] + 0.04 + 0.12 * (1 - k), rpmLow = st.rpm < bogHi * (1.08 + 0.1 * k);
      if (st.slip > digS - 0.04 * k && !rpmLow) st.ai = Math.max(0.35, st.ai - 0.05 * (0.5 + k));
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

