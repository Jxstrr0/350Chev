  /* =====================================================================
     Road test: the engine bolted into a car. Straight-line figures come from a
     time-stepped run (clutch launch, traction limit with weight transfer, the
     torque curve through the gearbox, shift times, turbo lag); the lap is a
     quasi-steady point-mass simulation over a track built from straights and
     constant-radius corners: a grip ceiling from μ·(g + downforce), a backward
     pass for braking, a forward pass that carries gear, shift and boost state.
     ===================================================================== */
  /* the run itself is in sim/road-run.js, which goes into sim-late.js (since 1.76.139.0) */
  // μ by tyre class (peak, dry, warm). Lateral and longitudinal share one friction circle.
  const ROAD_TYRES = { eco: { n: "Eco", mu: 0.86, d: "hard, low rolling drag" }, street: { n: "Street", mu: 1.0, d: "all-round summer tyre" },
    sport: { n: "Sport", mu: 1.1, d: "soft, warm-up quick" }, semi: { n: "Semi-slick", mu: 1.26, d: "track tyre, road legal" } };
  /* rain (since 1.76.83.0): wet 0 (dry) … 1 (a downpour) takes this share of a tyre's grip at full wet. Treaded tyres clear
     the water; the stickier and balder the tyre, the more it loses (a slick on a wet road is close to a street tyre) */
  const ROAD_WET_K = { eco: 0.2, street: 0.22, sport: 0.27, semi: 0.36, slick: 0.48 };
  const roadWetMu = (tyre, wet) => 1 - clamp(+wet || 0, 0, 1) * (ROAD_WET_K[tyre] != null ? ROAD_WET_K[tyre] : 0.3);
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
     sec = sector lines as lap fractions; scale stretches the whole map; bump = how rough the surface is for a low car (0 smooth .. 1 street). */
  const ROAD_TRACKS = {
    club: { n: "Coulee Park", d: "club circuit · 7 turns", bump: 0.35, start: 250, sec: [0.36, 0.7], scale: 1, pts: [
      [-350, 215, 60, "Pit bend"], [330, 215, 30, "Elevator"], [410, -60, 80, "Section Line"], [330, -280, 19, "Gopher hairpin"], [130, -90, 50, "Coulee"],
      [-120, -230, 38, "Slough"], [-390, -130, 110, "Canola sweep"]] },
    gp: { n: "Prairie Sky Raceway", d: "GP circuit · 12 turns", bump: 0.2, start: 380, sec: [0.33, 0.67], scale: 1, pts: [
      [-760, 330, 90, "Coulee"], [560, 330, 26, "Elevator"], [640, 60, 150, "Chinook kink"], [560, -170, 60, "Badlands"], [330, -170, 42, "Canola esses"],
      [190, -330, 42, ""], [-420, -380, 21, "Grain Bin hairpin"], [-140, -200, 160, "Big Sky sweeper"], [-80, 30, 52, "Gopher"], [-420, 60, 36, "Slough"], [-600, -120, 70, "Badger"], [-860, -60, 120, ""]] },
    street: { n: "Grain Exchange Street Circuit", d: "street circuit · 13 turns", no24: true, bump: 1, start: 150, sec: [0.33, 0.67], scale: 1, pts: [
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
    const out = { id: T === ROAD_TRACKS[id] ? id : "club", n: T.n, d: T.d, bump: T.bump || 0, len: len, ds: ROAD_DS, N: n, x: Xr, y: Yr, h: Hr, k: Kr, seg: Sr, corners: corners, sec: T.sec.slice(), size: [Mx - mx, My - my] };
    TRACK_CACHE[id] = out; return out;
  }

  const SETUP_STOCK = { st: 50, sp: 0, wg: 0, bb: 0, ps: 32, df: 0, rh: 0 };
  function setupNorm(su) {
    if (!su) return null;
    const f = (k, a, b) => { const v = clamp(Math.round(+su[k]), a, b); return isFinite(v) ? v : SETUP_STOCK[k]; };
    const o = { st: f("st", 0, 100), sp: f("sp", -100, 100), wg: f("wg", -100, 100), bb: f("bb", -100, 100), ps: f("ps", 24, 40), df: f("df", -100, 100), rh: f("rh", -100, 100) };
    return Object.keys(SETUP_STOCK).every(k => o[k] === SETUP_STOCK[k]) ? null : o;
  }
  /* what the 3D car shows: roll gain on the stock lean, brake-dive gain, and how much each axle's inside wheel can lift */
  function setupVis(setup) {
    const su = setupNorm(setup) || SETUP_STOCK, t = su.st / 100, sp = su.sp / 100;
    const gain = t <= 0.5 ? 1 + (0.5 - t) * 2.8 : 1 - (t - 0.5) * 1.6;   // soft 2.4x the stock lean, stiff 0.2x
    return { rk: +gain.toFixed(3), dive: +gain.toFixed(3),
      lf: +clamp((t - 0.55) * 2.2 + 0.6 * sp, 0, 1).toFixed(3), lr: +clamp((t - 0.55) * 2.2 - 0.6 * sp, 0, 1).toFixed(3) };
  }

