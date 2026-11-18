  /* ---- Truck & tractor pulling: a weight-transfer sled on a dirt track ----
     The sled's box starts over its rear wheels, so at first the pan carries little and the truck walks away.
     The box is geared to the sled wheels and slides toward the pan as the sled travels, so the drag keeps rising
     until the truck can no longer turn it into forward motion: it either stops (bogs) or the tyres dig (spins out).
     300 ft with the box still moving is a full pull. */
  /* the run itself is in sim/pull-run.js, which goes into sim-late.js (since 1.76.139.0) */
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
  /* tyre pressure: a pickup pulls at about 18 psi and a tractor's big ag tyres at about 12. The default is neutral; lower lays more
     lug on the dirt (more bite, the tyre floats instead of digging) but the soft sidewall winds up and hops the nose sooner;
     higher is the other way round. min / max are what the slider offers. */
  function pullPsi(kind) { return kind === "tractor" ? { def: 12, min: 6, max: 20 } : { def: 18, min: 8, max: 30 }; }
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

