  /* =====================================================================
     18.  Export
     ===================================================================== */
  /* ---- Drag strip: real-time vehicle pass ---- */
  /* the run itself is in sim/drag-run.js, which goes into sim-late.js (since 1.76.139.0) */
  // heat: how much extra grip a proper burnout is worth on that compound (fraction of μ)
  /* drivetrain: the clutch, gearbox and axle as one tier. Every tier is sized to the engine, so none of them slips or breaks:
     Stock is matched to whatever is bolted to it, and an upgrade is never weaker than that. What an upgrade buys is in the
     parts: a dog box shifts in a fraction of the time (shift, seconds of no drive per gear change) and a race driveline
     wastes less of the engine between the flywheel and the tyre (eta, the share of torque that reaches the wheels).
     veh.dtCap (engine-side N·m) is still honoured by the pass, the sled and the road for a driveline that does have a
     rating — a swap car's, say — but no tier sets one. */
  const DRIVETRAIN = {
    stock: { n: "Stock", shift: 0.18, eta: 0.90, cost: 0, d: "matched to the engine · never the weak link" },
    hd: { n: "HD", shift: 0.15, eta: 0.91, cost: 2800, d: "heavy clutch, built box, 9-inch · a little quicker through the gears" },
    race: { n: "Race", shift: 0.11, eta: 0.92, cost: 9500, d: "multi-disc clutch, dog box, 9-inch / 14-bolt · fast shifts, less loss" },
    pro: { n: "Pro", shift: 0.08, eta: 0.935, cost: 24000, d: "triple-disc, straight-cut dog box, spooled 14-bolt · snap shifts, least loss" } };
  const drivetrain = id => DRIVETRAIN[id] || DRIVETRAIN.stock;
  /* the box's ratios: spaced evenly (geometrically) from 1st to top, unless veh.ratios gives every gear (custom spacing).
     Custom ratios are kept in order: each gear sits between the one before it and top. */
  function gearRatios(v) {
    const n = Math.max(1, v.gears | 0), r = [];
    for (let i = 0; i < n; i++) r.push(n === 1 ? v.first : v.first * Math.pow(v.top / v.first, i / (n - 1)));
    if (n > 2 && Array.isArray(v.ratios) && v.ratios.length === n)
      for (let i = 1; i < n - 1; i++) { const x = +v.ratios[i]; if (x > 0) r[i] = Math.min(r[i - 1], Math.max(r[n - 1], x)); }
    return r;
  }
  const dtCapOf = id => 0;   // a tier never limits (0 = no cap); kept so the call sites read the same as any other rated driveline
  /* the strip car's weight is set with a typical 230 kg V8 in it; the engine actually fitted adds or saves the difference */
  const DRAG_ENG_REF = 230;
  const dragMass = (mass, engKg) => Math.max(400, Math.round(+mass + (+engKg > 0 ? +engKg - DRAG_ENG_REF : 0)));
  const dtPart = o => o >= 1.9 ? "Snapped an axle" : o >= 1.6 ? "Stripped the gearbox" : "Exploded the clutch";   // by how far over it was
  const TYRES = { street: { mu: 1.18, n: "Street radial", heat: 0.02 }, radial: { mu: 1.7, n: "Drag radial", heat: 0.08 }, slick: { mu: 2.4, n: "Slick", heat: 0.08 } };
  TYRES.street.psi = 32; TYRES.radial.psi = 16; TYRES.slick.psi = 8;   // where each tyre is set up to run (psi); veh.tyrePsi moves off it
  const AERO = {
    street: { cdA: 0.82, bite: 1.00, wb: 2.70, n: "Street body", d: "stock shell · no bars" },
    outlaw: { cdA: 1.05, bite: 1.22, wb: 2.80, n: "Outlaw", d: "big tyre, wheelie bar, spoiler", bars: 1 },
    promod: { cdA: 0.62, bite: 1.40, wb: 2.95, n: "Pro-mod", d: "slick body, four-link, bars", bars: 1 },
    rail: { cdA: 0.45, bite: 1.62, wb: 4.20, n: "Dragster", d: "long rail, wing, huge bite", bars: 1 },
    // v3 classes (the four above are unchanged). cgH only where a class sits differently from the 0.5 m default.
    // Funny car: short 125" chassis under a full-width body and a big rear spoiler. More drag than a rail (frontal area
    //   ~1.9 m² vs a rail's ~1 m²) but the body + spoiler press the slicks down nearly as hard: bite just under the rail's,
    //   and the short wheelbase transfers more weight (more lift, so it leans on the bars).
    // Pro stock: wind-tunnel door car, low and narrow, no power adder — the slipperiest door car (below the pro-mod's 0.62),
    //   four-link + 33" slicks but no tubbed 36s: bite between outlaw and pro-mod; low cg.
    // Gasser: upright 50s body jacked up on a straight axle: lots of drag (nose-high, air under the car), short wheelbase,
    //   high cg (0.62 m) for violent weight transfer, slicks on leaf springs: bite a little over a street car; no bars, so
    //   it wheelstands — which is the point.
    funny: { cdA: 0.58, bite: 1.55, wb: 3.18, cgH: 0.46, n: "Funny car", d: "flip-up body, short chassis, blower", bars: 1 },
    prostock: { cdA: 0.56, bite: 1.32, wb: 2.67, cgH: 0.42, n: "Pro stock", d: "sleek door car, big scoop, bars", bars: 1 },
    gasser: { cdA: 0.95, bite: 1.12, wb: 2.79, cgH: 0.62, n: "Gasser", d: "nose-high straight axle, no bars" }
  };
  // compressor inducer size for each turbo option — sets how fast the wheel can be brought up to speed
  const TURBO_MM = { small: 46, medium: 54, large: 62, s66: 66, huge: 76, f88: 88, f98: 98 };
  // what the hot side of each exhaust manifold tolerates before it starts to crack (°C at the turbine inlet / collector)
  const MANIFOLD_HEAT = {
    cast_log: { crackC: 900, cast: 1, n: "cast log manifold", where: "at the collector" },
    cast_tubular: { crackC: 930, cast: 1, n: "cast tubular manifold", where: "across a runner" },
    headers_equal: { crackC: 1000, cast: 0, n: "stainless headers", where: "at a primary weld" },
    headers_merge: { crackC: 1015, cast: 0, n: "merge-collector headers", where: "at the merge" }
  };
  /* Everything a pass needs beyond the dyno curve: the atmospheric torque curve of the same
     engine (so boost can be tracked second by second instead of assumed), and what is bolted
     to the hot side. Launch parts never touch simulate() — they only live here. */
  function dragPrep(cfg, env, res) {
    cfg = Object.assign({}, DEFAULT_CFG, cfg || {});
    res = res || simulate(cfg, env);
    const asp = OPT.asp[cfg.asp] || OPT.asp.na;
    res.aspKind = asp.kind;
    res.compound = !!asp.compound;
    res.turboUnits = asp.kind === "turbo" ? (asp.units || 1) : 0;
    res.turboSize = cfg.turboSize;
    res.turboMm = (asp.kind === "turbo" || asp.kind === "centrifugal") ? (TURBO_MM[cfg.turboSize] || 54) : 0;
    res.boostTarget = asp.kind === "na" ? 0 : cfg.boost;
    res.turbineMat = cfg.turbineMat;
    res.exhaust = cfg.exhaust;
    res.egtLimitC = asp.kind === "turbo" ? (OPT.turbineMat[cfg.turbineMat] || OPT.turbineMat.cast_iron).maxEgtC : 0;
    // anti-lag and variable geometry only ever add to the pass; with neither fitted nothing below changes
    res.als = asp.kind === "turbo" && !isDiesel(cfg) && OPT.als[cfg.als] && cfg.als !== "off" ? cfg.als : "off";
    res.vgt = asp.kind === "turbo" && cfg.turbine === "vgt";
    if (res.vgt && !isDiesel(cfg)) res.egtLimitC = Math.min(res.egtLimitC, OPT.turbine.vgt.vaneEgtC[cfg.turbineMat] || 880);
    if (asp.kind === "na") res.naTorque = res.torque.slice();
    else {
      const na = simulate(Object.assign({}, cfg, { asp: "na" }), env);
      res.naTorque = res.rpms.map(r => { const i = na.rpms.indexOf(r); return i >= 0 ? na.torque[i] : 0; });
    }
    // nitrous: the shot's own share of the curve, so a pass can bring it in late, soft or not at all
    if (res.nitrous && OPT.nitrous[cfg.nitrous] && cfg.nitrous !== "none") { const nn = simulate(Object.assign({}, cfg, { nitrous: "none" }), env); res.n2oTq = res.torque.map((t, i) => Math.max(0, t - (nn.torque[i] || 0))); }
    return res;
  }

  /* nitrous bottle pressure: N2O is a liquid sitting on its own vapour, so the pressure is set by the bottle's
     temperature (about 735 psi at 20 °C, 950 at 32 °C; past 36 °C it is no longer a liquid at all). A heater
     blanket holds it near 950; without one the bottle follows the weather and cools as it empties.          */
  function n2oBottle(heater, ambientC, cooledK) {
    const T = heater ? 31.5 : ambientC - (cooledK || 0);
    const bar = 31.3 * Math.exp(0.0236 * T);
    return { psi: Math.round(Math.min(1100, bar * 14.5038)), tempC: Math.round(T) };
  }

  /* launch tech a car carries, from the build (ECU / driveline parts, not engine parts) */
  function launchTech(cfg, env) {
    cfg = cfg || {};
    const lc = OPT.launchCtl[cfg.launchCtl] ? cfg.launchCtl : "none";
    const tb = OPT.transBrake[cfg.transBrake] ? cfg.transBrake : "none";
    const red = cfg.redline || 7000;
    return { launchCtl: lc, transBrake: tb, twoStepRpm: lc !== "none" ? Math.min(red, Math.max(2000, cfg.twoStepRpm || 4000)) : 0, launchRetard: lc === "two_step_retard" ? clamp(cfg.launchRetard || 0, 0, 35) : 0 };
  }

  /* The auto driver for a drag pass: the player's own buttons, pressed on a fixed 4 ms clock. A burnout of the right
     length for the tyre (about 3.4 s with a line lock, just under 4 s without, before the rubber goes greasy; a quick one
     on street tyres), roll in, purge a nitrous line until it is liquid, arm the two-step / trans-brake / anti-lag on the
     ambers, leave on the green with a sharp light (.020-.045, never red), and on a manual box shift where the pass is
     quickest: past where the next gear's wheel torque catches up, because a shift costs drive, and at the redline when
     it never does (never above it: since 1.76.103.0 the redline caps every shift point. That costs .01-.03 s a pass on
     most builds, and up to .2 s on one that is spinning its tyres at the top of a gear, which now changes up sooner). Launch rpm, the
     nitrous switch and the chute are the car's set-up, not the driver's, so they stay as set; there is no pedal on a
     drag pass, for the player or for it. Deterministic for a seed, on its own random stream.
     tick(d, h, tree) runs before each step of the runner d and returns one press or null: "burn" / "unburn" / "stage" /
     "purge" / "unpurge" / "arm" / "go" / "shift". tree: null on a time trial; on a tree, NaN while it is dark, then seconds
     from the green (negative before it). say(d, tree) is the HUD's word for what it is doing. */
  const DRAG_TICK = 0.004;
