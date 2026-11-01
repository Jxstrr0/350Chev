  /* =====================================================================
     Hillclimbs. Pikes Peak: 19.99 km, 156 turns, 2,862 m at the line to 4,302 m on the summit. Since the team
     hill climb series, four shorter and lower made-up hills built from the same kit (HILL_HILLS: Badlands Grade,
     Kettle Butte, Ghost Ridge, Thunder Pass). Every call takes a hill id and defaults to Pikes Peak, so the Pikes
     event is the same as before. A course is a fixed sequence of straights and constant-radius corners, laid out
     section by section (the corner count, length and climb of each are set; radii, angles and straights come
     from the hill's fixed seed), with an elevation profile per section. The engine is run through
     simulate() at five altitudes on the way up: a naturally aspirated engine loses power with the
     air density, a supercharger keeps its pressure ratio (so it loses some), a turbo holds the
     manifold pressure it makes at the shop until the compressor runs out of pressure ratio or flow,
     and a carburettor runs richer as the air thins while injection trims itself. The car is the
     road test's chassis on the class's tyres and aero; it is driven by a time-stepped point mass
     (grade, drag and downforce at the local air density, braking envelope ahead, gear, shift and
     boost carried) with a coolant temperature that has less air to shed its heat into.
     Driving is commitment: every corner has a known surface call (dusty, clean or grippy) and a
     little hidden variance. Arrive faster than the corner holds and it costs a moment, a trip
     through the gravel, or — over a drop with no guardrail — the run.
     ===================================================================== */
  const HILL_ALT0 = 2862, HILL_ALT1 = 4302, HILL_TREE = 3560, HILL_DS = 2.5, HILL_SEED = 1916;
  /* sections in order: length (km), altitude at the end (m), corners, the corner mix, the bearing the road climbs on
     (radians, 0 = east, π/2 = north), the share of corners with a drop on the outside, and named corners [index, name] */
  const HILL_SECTIONS = [
    { id: "start", n: "Engineer's", km: 1.6, alt: 2960, cor: 12, mix: "forest", bear: 2.9, drop: 0.12, names: [[6, "Engineer's Corner", 22]] },
    { id: "picnic", n: "Picnic Grounds", km: 2.9, alt: 3135, cor: 22, mix: "forest", bear: 2.3, drop: 0.1, names: [[10, "Picnic Grounds"], [19, "Halfway"]] },
    { id: "glen", n: "Glen Cove", km: 3.9, alt: 3480, cor: 30, mix: "mixed", bear: 1.7, drop: 0.22, names: [[9, "Brown Bush"], [18, "Elk Park"], [29, "Glen Cove", 17]] },
    { id: "ws", n: "The W's", km: 3.1, alt: 3740, cor: 26, mix: "hairpins", bear: 1.25, drop: 0.55, names: [[0, "Ragged Edge"], [6, "The W's"], [24, "Cove Creek"]] },
    { id: "devil", n: "Devil's Playground", km: 2.6, alt: 3965, cor: 16, mix: "fast", bear: 2.6, drop: 0.5, names: [[7, "Devil's Playground", 150]] },
    { id: "pit", n: "Bottomless Pit", km: 2.3, alt: 4120, cor: 18, mix: "edge", bear: 3.5, drop: 0.85, names: [[8, "Bottomless Pit"]] },
    { id: "boulder", n: "Boulder Park", km: 2.0, alt: 4235, cor: 18, mix: "tech", bear: 4.3, drop: 0.45, names: [[9, "Boulder Park"]] },
    { id: "summit", n: "Summit", km: 1.59, alt: 4302, cor: 14, mix: "summit", bear: 5.2, drop: 0.5, names: [[3, "Olympic"], [13, "Summit"]] }
  ];
  /* the hills: Pikes Peak (the event, and the team series' finale) and four made-up climbs for the team series' rounds 1–7,
     shorter and lower, built from the same section kit. alt0 the start altitude, tree the treeline (dustier calls above it),
     seed the layout's, secs the sections (as HILL_SECTIONS), edge the named corners that are a sure drop with no guardrail */
  const HILL_HILLS = {
    pikes: { n: "Pikes Peak", d: "the big one: nearly 20 km into thin air", alt0: HILL_ALT0, tree: HILL_TREE, seed: HILL_SEED, secs: HILL_SECTIONS, edge: ["Bottomless Pit"] },
    badlands: { n: "Badlands Grade", d: "up out of a prairie coulee: short, fast and dusty", alt0: 690, tree: 600, seed: 3107, edge: [], secs: [
      { id: "coulee", n: "Coulee Floor", km: 1.5, alt: 735, cor: 8, mix: "fast", bear: 0.3, drop: 0.05, names: [[3, "Dry Creek Bend"]] },
      { id: "hoodoo", n: "The Hoodoos", km: 1.6, alt: 830, cor: 12, mix: "mixed", bear: 1.0, drop: 0.15, names: [[5, "The Hoodoos"]] },
      { id: "breaks", n: "The Breaks", km: 1.3, alt: 930, cor: 9, mix: "hairpins", bear: 1.6, drop: 0.35, names: [[4, "Rattlesnake", 16]] },
      { id: "rim", n: "Rim Rock", km: 1.0, alt: 985, cor: 6, mix: "fast", bear: 0.6, drop: 0.25, names: [[5, "Rim Rock"]] }] },
    kettle: { n: "Kettle Butte", d: "a foothills ranch road through the aspens", alt0: 1320, tree: 2400, seed: 5521, edge: [], secs: [
      { id: "ranch", n: "Ranch Gate", km: 1.8, alt: 1395, cor: 10, mix: "fast", bear: 1.2, drop: 0.05, names: [[2, "Cattle Guard"]] },
      { id: "aspen", n: "Aspen Grove", km: 2.2, alt: 1560, cor: 17, mix: "forest", bear: 1.9, drop: 0.12, names: [[8, "Aspen Grove"]] },
      { id: "kettle", n: "The Kettle", km: 1.9, alt: 1730, cor: 15, mix: "tech", bear: 2.5, drop: 0.3, names: [[7, "The Kettle", 19]] },
      { id: "butte", n: "Butte Top", km: 1.5, alt: 1860, cor: 10, mix: "summit", bear: 1.6, drop: 0.4, names: [[9, "Butte Top"]] }] },
    ghost: { n: "Ghost Ridge", d: "an old mine road: switchbacks, then a shelf over nothing", alt0: 1700, tree: 2300, seed: 8846, edge: ["Widowmaker"], secs: [
      { id: "mill", n: "Stamp Mill", km: 1.8, alt: 1810, cor: 12, mix: "forest", bear: 0.8, drop: 0.1, names: [[5, "Stamp Mill"]] },
      { id: "ladder", n: "The Ladder", km: 2.4, alt: 2040, cor: 22, mix: "hairpins", bear: 1.4, drop: 0.5, names: [[0, "Miner's Turn"], [12, "The Ladder"]] },
      { id: "slide", n: "Rock Slide", km: 2.1, alt: 2230, cor: 14, mix: "fast", bear: 0.6, drop: 0.45, names: [[7, "Rock Slide"]] },
      { id: "shelf", n: "The Shelf", km: 1.9, alt: 2400, cor: 16, mix: "edge", bear: 2.2, drop: 0.85, names: [[9, "Widowmaker"]] },
      { id: "town", n: "Ghost Town", km: 1.4, alt: 2540, cor: 12, mix: "summit", bear: 1.5, drop: 0.5, names: [[11, "Ghost Town"]] }] },
    thunder: { n: "Thunder Pass", d: "a long pass road over the Divide: timber, then scree", alt0: 2040, tree: 2450, seed: 2290, edge: [], secs: [
      { id: "gate", n: "Ranger Gate", km: 2.4, alt: 2200, cor: 14, mix: "fast", bear: 2.0, drop: 0.08, names: [[4, "Ranger Gate"]] },
      { id: "timber", n: "Lodgepole", km: 2.8, alt: 2400, cor: 22, mix: "forest", bear: 2.5, drop: 0.15, names: [[10, "Lodgepole"]] },
      { id: "falls", n: "Thunder Falls", km: 2.2, alt: 2580, cor: 16, mix: "mixed", bear: 1.8, drop: 0.3, names: [[8, "Thunder Falls"]] },
      { id: "scree", n: "Scree Slope", km: 2.5, alt: 2850, cor: 22, mix: "hairpins", bear: 1.2, drop: 0.6, names: [[3, "Scree Slope"], [17, "Eagle's Nest"]] },
      { id: "pass", n: "The Pass", km: 1.9, alt: 3040, cor: 14, mix: "fast", bear: 2.3, drop: 0.5, names: [[13, "The Pass"]] }] }
  };
  const hillId = id => HILL_HILLS[id] ? id : "pikes";
  const hillDef = id => HILL_HILLS[hillId(id)];
  const HILL_TYRES = { street: ROAD_TYRES.street, sport: ROAD_TYRES.sport, semi: ROAD_TYRES.semi, slick: { n: "Hillclimb slick", mu: 1.48, d: "soft race slick" } };
  const HILL_AERO = { none: { n: "None", d: "as the chassis comes", clA: 0, cdA: 0 }, wing: { n: "Wing", d: "rear wing and a lip", clA: 0.55, cdA: 0.07 },
    full: { n: "Splitter + wing", d: "dive planes, big wing", clA: 1.8, cdA: 0.22 }, unl: { n: "Unlimited aero", d: "twin-element wing, floor", clA: 7.2, cdA: 0.65 } };
  /* classes: the tyres and aero each allows, the weight a class's car is stripped to, the field's engines and drivers */
  const HILL_CLASSES = {
    open: { n: "Open", d: "street car · street or sport tyres · no aero", tier: 1, rep: 0, tyres: ["street", "sport"], aero: ["none"], massK: 1, field: { hp: 260, sd: 70, turbo: 0.35, skill: 0.55 } },
    ta: { n: "Time Attack", d: "production car · semi-slicks · a wing", tier: 2, rep: 25, tyres: ["sport", "semi"], aero: ["none", "wing"], massK: 1, field: { hp: 420, sd: 90, turbo: 0.6, skill: 0.65 } },
    ppo: { n: "Pikes Peak Open", d: "modified · slicks · splitter and wing", tier: 3, rep: 70, tyres: ["semi", "slick"], aero: ["none", "wing", "full"], massK: 0.93, field: { hp: 600, sd: 110, turbo: 0.75, skill: 0.75 } },
    unl: { n: "Unlimited", d: "anything goes · big aero", tier: 4, rep: 160, tyres: ["slick"], aero: ["full", "unl"], massK: 0.78, field: { hp: 880, sd: 160, turbo: 0.85, skill: 0.85 } }
  };
  // pressure ratio a compressor wheel can make before it runs out of tip speed (a compound pair multiplies two)
  const HILL_PR = { small: 2.7, medium: 3.0, large: 3.3, s66: 4.4, huge: 3.6, f88: 3.9, f98: 4.1 };
  const HILL_ALTS = [2862, 3222, 3582, 3942, 4302];
  /* the five altitudes a hill's engine is run at, line to finish (Pikes: HILL_ALTS) */
  const hillAlts = id => { if (hillId(id) === "pikes") return HILL_ALTS; const H = hillDef(id), a1 = H.secs[H.secs.length - 1].alt; return [0, 1, 2, 3, 4].map(i => Math.round(H.alt0 + (a1 - H.alt0) * i / 4)); };
  const HILL_CALL = { dusty: -0.04, clean: 0, grippy: 0.035 };
  const hillWrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const hillAmbC = alt => 16 - 6.5 * (alt - HILL_ALT0) / 1000;   // a July morning: 16 °C at Pikes' line, about 7 °C on top; one air for every hill (a team round shifts it by its weather: wx.dT)

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
  /* a hill's course (id, default Pikes Peak; built once and kept): samples every 2.5 m with position, heading, curvature (+ left),
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
  const hillZ = (T, s) => { const f = clamp(s / T.ds, 0, T.N - 1.001), i = f | 0; return T.z[i] + (T.z[i + 1] - T.z[i]) * (f - i); };

  /* the engine on the way up: simulate() at each of the hill's five altitudes (Pikes: HILL_ALTS) with the boost and mixture that
     altitude gets. id: the hill (default Pikes Peak). wx (a team round's weather): {dT: °C off the standard morning, h: humidity %} */
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
  const hillVTop = vPow => vPow <= 100 ? Math.min(vPow, 57) : 57 + 20 * (1 - Math.exp(-(vPow - 100) / 60));
  /* the class car: the road-test chassis with this engine, stripped to the class weight, on its tyres and aero, geared for the mountain */
  function hillCar(prep, opt) {
    opt = opt || {};
    const cls = HILL_CLASSES[opt.cls] || HILL_CLASSES.open, a = HILL_AERO[opt.aero] || HILL_AERO.none, ty = HILL_TYRES[opt.tyre] || HILL_TYRES.sport;
    const r0 = prep.pts[0].prep, car = roadCar(r0, { ch: opt.ch, tyre: opt.tyre in ROAD_TYRES ? opt.tyre : "semi" });
    car.m = (car.m - 75) * cls.massK + 75; car.crr = car.C.rr * car.m * ROAD_G;
    car.mu = ty.mu; car.muLat = ty.mu * car.kBal * car.kLoad * 0.97; car.muLong = ty.mu * car.kLoad * 1.12;
    car.clA = car.C.clA + a.clA; car.cdA = car.C.cdA + a.cdA; car.tyre = opt.tyre in HILL_TYRES ? opt.tyre : "sport"; car.aero = opt.aero in HILL_AERO ? opt.aero : "none"; car.cls = opt.cls in HILL_CLASSES ? opt.cls : "open";
    // top gear on the power peak at about the fastest the mountain allows, not the flat-out top speed
    const pkR = Math.min(r0.peakHpRpm || car.redline * 0.85, car.redline), top = car.gears[car.gears.length - 1], vTop = hillVTop(car.vPow);
    car.fdAuto = clamp((pkR * 2 * Math.PI / 60) * car.rw / (vTop * top), 0.9, 7.5); car.fd = clamp(car.fdAuto * clamp(+opt.finalK || 1, 0.6, 1.6), 0.7, 9);
    return roadSetup(car, opt.setup);
  }
  const hDrag = (car, v, rho) => 0.5 * rho * car.cdA * v * v + car.crr;
  function hTrac(car, v, lat, rho) {
    const DF = 0.5 * rho * car.clA * v * v, mg = car.m * ROAD_G, mu = car.muLong * Math.sqrt(Math.max(0, 1 - lat * lat)) * (car.tK ? 1 - car.tK * lat : 1), hw = car.h / car.wb;
    if (car.drive === "awd") return mu * (mg + DF) * 0.98;
    if (car.drive === "fwd") return mu * (mg * car.front + DF * 0.45) / (1 + mu * hw);
    return mu * (mg * (1 - car.front) + DF * 0.55) / Math.max(0.3, 1 - mu * hw);
  }
  const hBrake = (car, v, lat, rho) => { const DF = 0.5 * rho * car.clA * v * v, mg = car.m * ROAD_G; return Math.min(car.brake * mg, car.muLong * (mg + Math.max(0, DF))) * Math.sqrt(Math.max(0, 1 - lat * lat)); };

  /* the corner calls for one running: dusty, clean or grippy (the spotters' notes), and a little nobody can see */
  function hillCalls(seed, id) {
    const T = hillCourse(id), r = pullRng((seed ^ 0x5EED) >>> 0);
    return T.corners.map(c => { const q = r(), hi = c.alt > T.tree; const call = q < (hi ? 0.22 : 0.15) ? "dusty" : q < 0.78 ? "clean" : "grippy";
      const g = Math.sqrt(-2 * Math.log(Math.max(1e-6, r()))) * Math.cos(2 * Math.PI * r());
      return { call: call, gk: 1 + HILL_CALL[call] + 0.008 * clamp(g, -2.4, 2.4) }; });
  }
  /* the auto driver's commitment per corner: reads the calls, a touch more over a guardrail than over nothing */
  function hillPlan(calls, skill, seed, id) {
    const T = hillCourse(id), r = pullRng((seed ^ 0xA770) >>> 0), sk = clamp(skill == null ? 0.8 : skill, 0, 1);
    return T.corners.map((c, k) => { const cl = calls[k].call; let v = cl === "grippy" ? 1.03 : cl === "dusty" ? 0.962 : 1.0;
      v += (sk - 0.8) * 0.02 - (c.drop && !c.rail ? 0.012 : 0) + 0.007 * (r() - 0.5) * 2 * (1.4 - sk); return +v.toFixed(4); });
  }

  /* one run up the hill. opt: {hill?, cls, ch, tyre, aero, finalK, seed, calls?, plan?, ai?}; the hill is opt.hill, else the one
     the prep was run for, else Pikes Peak. step(dt, ctl): ctl = {c} the commitment for corners not yet turned into (1 = the known
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

