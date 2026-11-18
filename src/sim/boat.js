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
  /* the run itself is in sim/boat-run.js, which goes into sim-late.js (since 1.76.139.0) */
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
