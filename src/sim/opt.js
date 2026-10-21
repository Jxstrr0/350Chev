<script>
/* =====================================================================
   Prairie Engine Works v2 — physics core (sim.js)
   Plain browser JS, no modules.  Exports the global ENGINE_SIM.

   Design goals
   ------------
   * Every number that can be a real material property IS a real material
     property (density, modulus, UTS / fatigue limit at temperature, thermal
     expansion coefficient, conductivity, octane numbers, LHV, HoV, kinematic
     viscosity ...).  Nothing is a magic "quality score".
   * The engine cycle is computed from first principles:
        IMEP = VE * rho_charge * (LHV / (AFR*lambda)) * eta_comb * eta_ind
        FMEP = Chen-Flynn (a + b*Pmax + c*MPS + d*MPS^2) * viscosity term
        BMEP = IMEP - FMEP - PMEP ;  T = BMEP*Vd/(4*pi)
   * Every failure mode is a MEASUREMENT against a MATERIAL LIMIT, so the
     interaction between two parts falls out of the physics instead of being
     hard-coded.  combos() then *explains* the interactions in English.
   * Deterministic and fast: one simulate() call is a few hundred arithmetic
     ops per 100-rpm step, ~1 ms for a 12,500 rpm sweep.
   ===================================================================== */

const ENGINE_SIM = (function () {
  "use strict";

  /* ---------- small helpers ---------- */
  const PI = Math.PI;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sq = (x) => x * x;
  const R_AIR = 287.05;      // J/kg/K dry air
  const R_VAP = 461.495;     // J/kg/K water vapour
  const KW_PER_HP = 0.745699;

  /* =====================================================================
     1.  LAYOUTS  — inherent balance comes from the reciprocating mass
         harmonics of the crank arrangement, not from a fudge factor.
         firstOrder / secondOrder are normalised residual shaking
         (force OR couple) at 1x and 2x crank speed, 0 = perfect.
     ===================================================================== */
  const LAYOUTS = {
    I3: {
      n: 3, banks: 1, angle: 0, smooth: 42, bay: 0, name: "Inline 3",
      firingOrder: [1, 2, 3], evenFire: true, crossplane: false,
      firstOrder: 0.55, secondOrder: 0.15
      // primary+secondary forces cancel but a large 1st-order rocking couple remains
    },
    I4: {
      n: 4, banks: 1, angle: 0, smooth: 48, bay: 0, name: "Inline 4",
      firingOrder: [1, 3, 4, 2], evenFire: true, crossplane: false,
      firstOrder: 0.05, secondOrder: 0.85
      // classic un-cancelled 2nd-order vertical shake (2x rpm), grows with stroke
    },
    I5: {
      n: 5, banks: 1, angle: 0, smooth: 62, bay: 1, name: "Inline 5",
      firingOrder: [1, 2, 4, 5, 3], evenFire: true, crossplane: false,
      firstOrder: 0.30, secondOrder: 0.28
    },
    I6: {
      n: 6, banks: 1, angle: 0, smooth: 95, bay: 1, name: "Inline 6",
      firingOrder: [1, 5, 3, 6, 2, 4], evenFire: true, crossplane: false,
      firstOrder: 0.0, secondOrder: 0.0
      // perfect primary and secondary balance, both forces and couples
    },
    V6: {
      n: 6, banks: 2, angle: 60, smooth: 66, bay: 0, name: "V6 60°",
      firingOrder: [1, 6, 5, 4, 3, 2], evenFire: true, crossplane: false,
      firstOrder: 0.25, secondOrder: 0.20
      // 60 deg with split-pin crank fires evenly; residual rocking couple
    },
    V8: {
      n: 8, banks: 2, angle: 90, smooth: 88, bay: 1, name: "V8 crossplane",
      firingOrder: [1, 8, 4, 3, 6, 5, 7, 2], evenFire: true, crossplane: true,
      firstOrder: 0.04, secondOrder: 0.10
      // 90 deg crossplane crank + counterweights: primary and secondary balanced
    },
    V8F: {
      n: 8, banks: 2, angle: 90, smooth: 58, bay: 1, name: "V8 flat‑plane",
      firingOrder: [1, 5, 3, 7, 4, 8, 2, 6], evenFire: true, crossplane: false,
      firstOrder: 0.05, secondOrder: 0.62
      // behaves like two I4s bolted together: 2nd-order shake, but light crank
    },
    V10: {
      n: 10, banks: 2, angle: 90, smooth: 78, bay: 2, name: "V10 90°",
      firingOrder: [1, 6, 5, 10, 2, 7, 3, 8, 4, 9], evenFire: true, crossplane: false,
      firstOrder: 0.15, secondOrder: 0.18
    },
    V12: {
      n: 12, banks: 2, angle: 60, smooth: 97, bay: 2, name: "V12 60°",
      firingOrder: [1, 7, 5, 11, 3, 9, 6, 12, 2, 8, 4, 10], evenFire: true, crossplane: false,
      firstOrder: 0.0, secondOrder: 0.0
      // two perfectly balanced I6s at 60 deg — the smoothest practical layout
    },
    F4: {
      n: 4, banks: 2, angle: 180, smooth: 70, bay: 0, name: "Flat 4",
      firingOrder: [1, 3, 2, 4], evenFire: true, crossplane: false,
      firstOrder: 0.30, secondOrder: 0.12
      // primary forces cancel; cylinder offset leaves a 1st-order rocking couple
    },
    F6: {
      n: 6, banks: 2, angle: 180, smooth: 92, bay: 1, name: "Flat 6",
      firingOrder: [1, 6, 2, 4, 3, 5], evenFire: true, crossplane: false,
      firstOrder: 0.0, secondOrder: 0.05
    },
    /* Wankel rotaries: n = rotors. A rotor's three faces each fire once per rotor turn and the rotor turns
       once for every three turns of the eccentric shaft, so every rotor fires once per e-shaft revolution:
       a two-rotor fires as often as an inline four. Nothing reciprocates; the rotors' orbit is cancelled by
       the e-shaft counterweights, which is where the turbine-smoothness comes from. */
    R1: { n: 1, banks: 1, angle: 0, smooth: 62, bay: 0, name: "1-rotor Wankel", rotary: 1,
      firingOrder: [1], evenFire: true, crossplane: false, firstOrder: 0.12, secondOrder: 0.0 },
    R2: { n: 2, banks: 1, angle: 0, smooth: 86, bay: 0, name: "2-rotor Wankel", rotary: 1,
      firingOrder: [1, 2], evenFire: true, crossplane: false, firstOrder: 0.02, secondOrder: 0.0 },
    R3: { n: 3, banks: 1, angle: 0, smooth: 93, bay: 1, name: "3-rotor Wankel", rotary: 1,
      firingOrder: [1, 3, 2], evenFire: true, crossplane: false, firstOrder: 0.01, secondOrder: 0.0 },
    R4: { n: 4, banks: 1, angle: 0, smooth: 96, bay: 1, name: "4-rotor Wankel", rotary: 1,
      firingOrder: [1, 3, 2, 4], evenFire: true, crossplane: false, firstOrder: 0.0, secondOrder: 0.0 },
    /* two-stroke-only layouts (two: 1): a single, a 180-degree twin, a 60-degree V4 and the Napier Deltic's
       triangle of three opposed-piston banks (n = cylinders, two pistons each, three crankshafts) */
    I1: { n: 1, banks: 1, angle: 0, smooth: 18, bay: 0, name: "Single", two: 1,
      firingOrder: [1], evenFire: true, crossplane: false, firstOrder: 1.0, secondOrder: 0.30 },
    I2: { n: 2, banks: 1, angle: 0, smooth: 44, bay: 0, name: "Parallel twin", two: 1,
      firingOrder: [1, 2], evenFire: true, crossplane: false, firstOrder: 0.45, secondOrder: 0.05 },
    V4: { n: 4, banks: 2, angle: 60, smooth: 66, bay: 0, name: "V4 60\u00b0", two: 1,
      firingOrder: [1, 3, 2, 4], evenFire: true, crossplane: false, firstOrder: 0.20, secondOrder: 0.20 },
    D18: { n: 18, banks: 3, angle: 120, smooth: 97, bay: 2, name: "Deltic triangle", two: 1, opposed: 1,
      firingOrder: [1, 7, 13, 2, 8, 14, 3, 9, 15, 4, 10, 16, 5, 11, 17, 6, 12, 18], evenFire: true, crossplane: false, firstOrder: 0.0, secondOrder: 0.0 }
  };

  /* =====================================================================
     2.  OPT  — one table per categorical cfg key.
         name  <= 22 chars, sub <= 26 chars (mono caption of headline numbers)
         info  = 1-2 plain sentences naming the real alloy / standard.
         req   = career gate (shop1|shop2|flow|boost|bay1|bay2), omitted = base
     ===================================================================== */
  const OPT = {};
  /* every option gets an id (table:key) after the tables are filled, so career R&D can unlock single parts */

  /* ---- layout (mirrors LAYOUTS, adds shop/bay gating + cost/mass) ---- */
  OPT.layout = {
    I3: { name: "Inline 3", sub: "3 cyl · bal 42 · bay S", info: "Three cylinders at 120°. Compact and cheap to build, but it rocks end to end unless a balance shaft or soft mounts sort it out.", cost: 900, massKg: 95 },
    I4: { name: "Inline 4", sub: "4 cyl · bal 48 · bay S", info: "The world's default engine. A vertical shake nothing can cancel grows with stroke and revs — past about two litres it needs balance shafts.", cost: 1000, massKg: 135 },
    I5: { name: "Inline 5", sub: "5 cyl · bal 62 · bay M", info: "The odd cylinder out gives the famous five-pot warble. Smoother than a four, short of a six, with a mild rocking motion left over.", cost: 1450, massKg: 155, req: "bay1" },
    I6: { name: "Inline 6", sub: "6 cyl · bal 95 · bay M", info: "Perfectly balanced by its own geometry — there is nothing left to cancel. The long crank twists, so torsional vibration sets the redline.", cost: 1700, massKg: 175, req: "bay1" },
    V6: { name: "V6 60°", sub: "6 cyl · bal 66 · bay S", info: "A 60° vee that fires evenly and packages into almost any bay. A rocking couple survives and gets soaked up by the mounts.", cost: 1600, massKg: 165 },
    V8: { name: "V8 cross", sub: "8 cyl · bal 88 · bay M", info: "A 90° vee on a crossplane crank, balanced by heavy counterweights. The banks fire unevenly, which is where the burble comes from.", cost: 2300, massKg: 178, req: "bay1" },
    V8F: { name: "V8 flat", sub: "8 cyl · bal 58 · bay M", info: "A flat-plane crank makes it behave like two inline fours bolted together. Light, free-revving and loud — and it shakes like a four.", cost: 2900, massKg: 168, req: "bay1" },
    V10: { name: "V10 90°", sub: "10 cyl · bal 78 · bay L", info: "A 90° vee with offset crankpins so it still fires evenly. Huge specific output, and a crank long enough to be a problem to keep straight.", cost: 5200, massKg: 232, req: "bay2" },
    V12: { name: "V12 60°", sub: "12 cyl · bal 97 · bay L", info: "Two perfectly balanced sixes sharing a crank — the smoothest thing you can build. Twist in that long crank is what limits the revs.", cost: 12000, massKg: 272, req: "bay2" },
    F4: { name: "Flat 4", sub: "4 cyl · bal 70 · bay S", info: "Opposed pairs cancel each other, including the shake an inline four suffers. Leaves a small rocking couple, and sits very low in the car.", cost: 1400, massKg: 130 },
    F6: { name: "Flat 6", sub: "6 cyl · bal 92 · bay M", info: "An opposed six: balanced, with a crank short enough that twist never becomes an issue. Getting air to the rear cylinders is the hard part.", cost: 3400, massKg: 185, req: "bay1" },
    R1: { name: "1-rotor Wankel", sub: "1 rotor · bal 62 · bay S", info: "One triangular rotor orbiting in a peanut-shaped housing: three combustion chambers, one bang per turn of the eccentric shaft. Tiny and light, and the only rotary that shakes.", cost: 900, massKg: 55 },
    R2: { name: "2-rotor Wankel", sub: "2 rotor · bal 86 · bay S", info: "The 12A and 13B: two rotors phased 180° apart on one eccentric shaft. Fires like a four, revs like nothing else of its size and sits low and far back in the bay.", cost: 1300, massKg: 100 },
    R3: { name: "3-rotor Wankel", sub: "3 rotor · bal 93 · bay M", info: "The 20B: a third rotor housing and a longer eccentric shaft. Six-cylinder smoothness out of two litres, and a shaft long enough that it bends.", cost: 2600, massKg: 140, req: "bay1" },
    R4: { name: "4-rotor Wankel", sub: "4 rotor · bal 96 · bay M", info: "The R26B that won Le Mans: four rotors on a split eccentric shaft with a centre main bearing. A scream you can hear from the next county.", cost: 6800, massKg: 178, req: "bay2" },
    I1: { name: "Single", sub: "1 cyl \u00b7 two-stroke only", info: "One cylinder and one crank throw: the dirt bike, the chainsaw and the outboard on a dinghy. Light and simple, and it shakes like nothing else \u2014 a two-stroke single fires every turn, so there is no rest between beats.", cost: 300, massKg: 14, two: 1 },
    I2: { name: "Parallel twin", sub: "2 cyl \u00b7 two-stroke only", info: "Two cylinders on a 180\u00b0 crank, so a two-stroke twin fires evenly every half turn. The Trabant, the sled engine and the 350 road-racer.", cost: 500, massKg: 24, two: 1 },
    V4: { name: "V4 60\u00b0", sub: "4 cyl \u00b7 two-stroke only", info: "Two twins on one crank in a narrow vee: the 500 cc Grand Prix engine and the mid-size outboard. Compact, smooth and every cylinder gets its own pipe.", cost: 1100, massKg: 45, two: 1 },
    D18: { name: "Deltic triangle", sub: "18 cyl \u00b7 36 pistons \u00b7 bay L", info: "Napier's answer for a light, enormous diesel: three banks of opposed-piston cylinders arranged in a triangle, a crankshaft at each corner, one of them turning backwards. Every cylinder fires every turn with no valves at all.", cost: 30000, massKg: 900, req: "bay2", two: 1 }
  };

  /* ---- block material ---- */
  OPT.blockMat = {
    grey_iron: {
      name: "Grey iron GG25", sub: "250MPa a11 k48 7.2g/cc",
      info: "Ordinary flake-graphite iron. Cheap, dimensionally stable and quiet — and heavy enough that you feel it on the scales.",
      dens: 7200, E: 110, uts: 250, fatigue: 110, alpha: 11.0e-6, boreAlpha: 11.0e-6, k: 48,
      spacing: 1.16, spacingAdj: 1.00, stiff: 1.00, costPerL: 190, massFac: 1.00
    },
    cgi: {
      name: "Compacted iron GJV450", sub: "450MPa a11.5 k37 7.1",
      info: "The graphite grows in worms rather than flakes, which buys a lot of strength for very little weight. It is punishing to machine, so it costs.",
      dens: 7100, E: 145, uts: 450, fatigue: 195, alpha: 11.5e-6, boreAlpha: 11.5e-6, k: 37,
      spacing: 1.13, spacingAdj: 0.98, stiff: 1.26, costPerL: 420, massFac: 0.93, req: "shop1"
    },
    cgi_filled: {
      name: "CGI, girdled + half-fill", sub: "450MPa stiff 1.80 cool 0.93",
      info: "A compacted-iron block with a steel main girdle tying the bulkheads together and the water jacket filled with block filler up to just below the ring travel. The bores cannot walk, so the rings keep sealing at pulling-truck pressures. The filled jacket sheds less heat, and the cooling has to make up for it.",
      dens: 7100, E: 145, uts: 450, fatigue: 195, alpha: 11.5e-6, boreAlpha: 11.5e-6, k: 37,
      spacing: 1.13, spacingAdj: 0.98, stiff: 1.80, cool: 0.93, costPerL: 680, massFac: 0.97, req: "race"
    },
    alu_liners: {
      name: "A356-T6 + Fe liners", sub: "280MPa a21.5 k155 2.7",
      info: "An aluminium casting with iron liners pressed in. Light and cool-running, but it grows twice as much as the steel holding it together.",
      dens: 2680, E: 72, uts: 280, fatigue: 90, alpha: 21.5e-6, boreAlpha: 12.0e-6, k: 155,
      spacing: 1.20, spacingAdj: 1.00, stiff: 0.62, costPerL: 480, massFac: 0.58, req: "shop1"
    },
    billet_alu: {
      name: "Billet 7000 alu", sub: "540MPa a23 k160 2.8g",
      info: "Cut from a solid slab of aerospace aluminium with no cores and no compromises, then plated. Stiff enough to hold the bores round under any boost you can feed it, and it takes weeks of machine time to make.",
      dens: 2810, E: 74, uts: 540, fatigue: 190, alpha: 23.0e-6, boreAlpha: 12.5e-6, k: 160, spacing: 1.28, spacingAdj: 1.0, stiff: 1.95, costPerL: 4200, massFac: 0.72, billet: 1, req: "race"
    },
    alu_nikasil: {
      name: "Nikasil alu (AlSi17)", sub: "300MPa a20 k150 2.7g",
      info: "High-silicon aluminium with a hard nickel-carbide plating sprayed straight onto the bore — no liner, the best heat path and the least friction. Sulphur and methanol attack the plating.",
      dens: 2700, E: 80, uts: 300, fatigue: 105, alpha: 20.0e-6, boreAlpha: 16.0e-6, k: 150,
      spacing: 1.15, spacingAdj: 0.99, stiff: 0.70, costPerL: 900, massFac: 0.60, req: "shop2"
    }
  };

  /* ---- deck (only meaningful on aluminium blocks) ---- */
  OPT.deck = {
    open: { name: "Open deck", sub: "stiff 0.75  cool 1.05", info: "The liner tops are left unsupported, so the bores bell out under pressure. Cheapest to cast, and coolant gets everywhere it needs to.", stiff: 0.75, cool: 1.06, cost: 0 },
    semi_closed: { name: "Semi-closed deck", sub: "stiff 0.92  cool 1.00", info: "Bridges tie each liner to the outer wall at four points. What production turbo blocks use: most of the strength, most of the coolant flow.", stiff: 0.92, cool: 1.00, cost: 260, req: "shop1" },
    closed: { name: "Closed deck", sub: "stiff 1.12  cool 0.92", info: "A full deck plate supports the liners all the way round, so the bores stay honest under serious boost. Coolant has to be drilled through, and the deck runs hotter.", stiff: 1.12, cool: 0.92, cost: 900, req: "shop2" }
  };

  /* ---- head material ---- */
  OPT.headMat = {
    iron: { name: "Cast iron head", sub: "a11 k48  oct +0.0", info: "An iron head on an iron block grows at the same rate, so the gasket never gets scrubbed. It holds heat in the chamber, which means you need better fuel.", alpha: 11.0e-6, k: 48, dens: 7200, octane: 0.0, massFac: 1.0, cost: 260 },
    alu: { name: "Aluminium head", sub: "a22 k165  oct -1.0", info: "Aluminium pulls heat out of the chamber roof, and a cooler chamber knocks less. It grows twice as fast as an iron block underneath it.", alpha: 22.0e-6, k: 165, dens: 2700, octane: 1.0, massFac: 0.55, cost: 520 }
  };

  /* ---- head / valvetrain architecture ---- */
  OPT.head = {
    sohc2v: {
      name: "SOHC 2-valve", sub: "2v kv.44 VE.93 7000", info: "One cam, one valve each way. Cheap, compact and durable; a single big valve can only ever open so much of the bore.",
      nIV: 1, kv: 0.44, veBase: 0.930, floatBase: 7000, camMax: 70, cost: 700, massFac: 1.0, vvt: 0, vvl: 0, burn: 1.00
    },
    dohc4v: {
      name: "DOHC 4-valve", sub: "4v kv.37 VE1.02 9200", info: "Twin cams and four valves: far more valve area, a central plug and a fast burn. The starting point for anything meant to rev.",
      nIV: 2, kv: 0.37, veBase: 1.020, floatBase: 9200, camMax: 100, cost: 1500, massFac: 1.12, vvt: 0, vvl: 0, burn: 1.08, req: "flow"
    },
    dohc4v_vvt: {
      name: "DOHC 4v + VVT", sub: "4v VVT VE1.05 9000rpm", info: "Cam phasers swing the intake timing as the revs rise, so a big cam no longer ruins the idle or the bottom end. Modern standard practice.",
      nIV: 2, kv: 0.37, veBase: 1.050, floatBase: 9000, camMax: 100, cost: 2200, massFac: 1.16, vvt: 1, vvl: 0, burn: 1.08, req: "flow"
    },
    dohc4v_vvl: {
      name: "DOHC 4v + VVL", sub: "4v VVL VE1.07 9800rpm", info: "Two cam profiles — a mild one below the crossover and a race one above it. You get both ends of the power curve instead of choosing.",
      nIV: 2, kv: 0.37, veBase: 1.065, floatBase: 9800, camMax: 100, cost: 3100, massFac: 1.18, vvt: 1, vvl: 1, burn: 1.08, req: "flow"
    },
    billet_hemi: {
      name: "Billet hemi 4v", sub: "4v kv.38 VE1.16 11000", info: "A hemispherical chamber machined out of billet with the valves canted well apart and a shaft rocker over each one. It flows more than anything else you can bolt to a block, and it costs more than most people's cars.",
      nIV: 2, kv: 0.38, veBase: 1.160, floatBase: 11000, camMax: 120, cost: 38000, massFac: 1.26, vvt: 0, vvl: 0, burn: 1.10, billet: 1, req: "race"
    },
    pushrod2v: {
      name: "Pushrod 2-valve", sub: "2v kv.46 VE.99 6720", info: "Cam in the block, pushrods up to the rockers. Wonderfully compact and light for a big vee, but all that moving weight floats the valves early.",
      nIV: 1, kv: 0.46, veBase: 0.990, floatBase: 6720, camMax: 80, cost: 900, massFac: 0.90, vvt: 0, vvl: 0, burn: 0.97
    }
  };

  /* ---- valve material ---- */
  OPT.valveMat = {
    steel: { name: "21-4N steel valve", sub: "780C  mass 1.00", info: "A stainless exhaust valve: the default, and enough for anything unboosted. It simply gets heavy as the valve grows.", maxTempC: 780, dens: 7800, massFac: 1.00, coolC: 0, cost: 190 },
    sodium: { name: "Sodium-filled valve", sub: "850C  stem -80C", info: "The stem is hollow and part-filled with sodium, which melts and sloshes heat out of the valve head into the guide. The answer under boost.", maxTempC: 850, dens: 7700, massFac: 0.96, coolC: 80, cost: 480, req: "flow" },
    ti: { name: "Ti-6Al-4V valve", sub: "720C  mass 0.60", info: "Little over half the weight of steel, so the spring has less to fight and float moves a long way up. Too soft hot to use on the exhaust side.", maxTempC: 720, dens: 4430, massFac: 0.60, coolC: 0, cost: 2200, req: "shop2" },
    inconel: { name: "Inconel 751 valve", sub: "1050C mass 1.08", info: "A nickel superalloy that keeps its strength glowing red. Heavy and expensive, and the only thing that survives a lean, boosted exhaust.", maxTempC: 1050, dens: 8200, massFac: 1.08, coolC: 0, cost: 1400, req: "boost" }
  };

  /* ---- valve springs ---- */
  OPT.springs = {
    single: { name: "Single spring", sub: "rate 1.00 mass 1.00", info: "One coil per valve. Fine to around seven thousand with steel valves; the spring surges before it ever runs out of load.", rate: 1.00, massFac: 1.00, cost: 140 },
    dual: { name: "Dual spring pack", sub: "rate 1.45 mass 1.25", info: "Two springs of different natural frequency, each killing the other's surge. The heavy seat pressure costs a little friction and cam life.", rate: 1.45, massFac: 1.25, cost: 420, req: "flow" },
    beehive: { name: "Beehive spring", sub: "rate 1.25 mass 0.82", info: "A tapered spring with a small light retainer: less weight to accelerate, and a spread of frequencies that damps its own surge.", rate: 1.25, massFac: 0.82, cost: 560, req: "flow" },
    ti_retainers: { name: "Beehive + Ti caps", sub: "rate 1.30 mass 0.70", info: "Beehive springs with titanium retainers and lash caps — the lightest valvetrain money buys. The titanium wears if the seat is not hardened.", rate: 1.30, massFac: 0.70, cost: 1100, req: "shop2" }
  };

  /* ---- pistons (real alloys, strength quoted hot) ---- */
  OPT.piston = {
    cast_alu: {
      name: "Cast A332 piston", sub: "130MPa@250 a20.5 k140", info: "A gravity casting. Cheap, quiet and dimensionally stable, and it starts going soft as soon as the crown gets properly hot.",
      alpha: 20.5e-6, k: 140, hot250: 130, dens: 2700, maxCrownC: 300, massFac: 1.00, cost: 60, brittle: 0.2
    },
    hyper: {
      name: "Hypereutectic 390", sub: "150MPa@250 a18 k130", info: "Silicon crystals through the alloy stop it growing, so it runs tight and quiet. The same crystals make it brittle — one rattle of detonation cracks a ring land.",
      alpha: 18.0e-6, k: 130, hot250: 150, dens: 2730, maxCrownC: 320, massFac: 1.02, cost: 120, brittle: 1.0
    },
    forged_4032: {
      name: "Forged 4032", sub: "200MPa@250 a19.5 k145", info: "A forging with enough silicon to stay dimensionally calm, so it fits tight and stays quiet cold. The sensible street forged piston.",
      alpha: 19.5e-6, k: 145, hot250: 200, dens: 2690, maxCrownC: 340, massFac: 1.04, cost: 340, brittle: 0.35, req: "shop1"
    },
    billet_tbc: {
      name: "Billet 2618 + TBC", sub: "300MPa@250 coated crown", info: "Machined from solid 2618 with a thick crown and a ceramic thermal barrier sprayed on top, so the heat stays in the gas instead of soaking into the piston. The only crown that lives behind a big power adder.",
      alpha: 22.5e-6, k: 155, hot250: 300, dens: 2780, maxCrownC: 470, massFac: 1.14, cost: 2600, brittle: 0.08,
      crownCool: 60, crownFac: 0.58, hotSlope: 0.0038, req: "shop2"
    },
    gallery_2618: {
      name: "2618 + cooling gallery", sub: "300MPa@250 gallery+TBC", info: "The billet 2618 crown with a ring-shaped oil gallery machined under the ring belt and electron-beam welded shut. The jets fill it and the oil sloshes heat out of the crown on every stroke, so the aluminium stays strong behind fifty pounds of boost. Heavier, and twice the machining.",
      alpha: 22.5e-6, k: 155, hot250: 300, dens: 2780, maxCrownC: 480, massFac: 1.20, cost: 4200, brittle: 0.08,
      crownCool: 95, crownFac: 0.54, hotSlope: 0.0038, req: "race"
    },
    forged_2618: {
      name: "Forged 2618-T61", sub: "240MPa@250 a22.5 k160", info: "Almost no silicon, which makes it the toughest crown there is under heat and detonation. It grows a lot, so it runs loose and rattles when cold.",
      alpha: 22.5e-6, k: 160, hot250: 240, dens: 2760, maxCrownC: 390, massFac: 1.08, cost: 520, brittle: 0.10, req: "shop2"
    }
  };

  /* ---- piston-to-wall clearance (fraction of bore) ---- */
  OPT.pistonClearance = {
    tight: { name: "Tight 0.0019 in", sub: "0.00055 x bore", info: "Silent cold, and it seals from the first mile. Only safe with an alloy that barely grows — anything else picks up the bore.", fac: 0.00055, cost: 0 },
    standard: { name: "Standard 0.0030 in", sub: "0.00090 x bore", info: "The normal figure for a street forging: a fair trade between scuff margin and cold slap.", fac: 0.00090, cost: 0 },
    loose: { name: "Loose 0.0047 in", sub: "0.00140 x bore", info: "What a race piston needs so it does not seize when the crown is glowing. Rattles cold and blows past until it is warm.", fac: 0.00140, cost: 0 }
  };

  /* ---- rings ---- */
  OPT.rings = {
    cast: { name: "Cast iron ring", sub: "gap .0040 in/in bore", info: "Plain cast iron. Conforms to the bore nicely and costs nothing, but detonation or sustained heat will break it.", gapSet: 0.0040, fric: 1.00, seal: 0.96, maxTempC: 260, cost: 90 },
    moly: { name: "Moly-faced ring", sub: "gap .0045 in/in bore", info: "A sprayed molybdenum face on a cast-iron carrier. The porous face carries oil, so it seals better and takes more heat.", gapSet: 0.0045, fric: 0.93, seal: 1.00, maxTempC: 330, cost: 180 },
    steel_drag: { name: "Steel, drag gap", sub: "gap .0085 in/in bore", info: "The same nitrided steel ring opened right up, because a top ring that closes its gap behind a power adder butts and welds itself to the bore. It blows past a little cold and does not care.", gapSet: 0.0085, fric: 0.88, seal: 0.97, maxTempC: 520, cost: 620, req: "shop2" },
    steel: { name: "Gas-nitrided steel", sub: "gap .0055 in/in bore", info: "A thin nitrided steel top ring: least friction, highest temperature, and the only sane choice under real boost. It needs the biggest gap.", gapSet: 0.0055, fric: 0.86, seal: 1.02, maxTempC: 450, cost: 380, req: "shop1" }
  };

  /* ---- connecting rods ---- */
  OPT.rod = {
    cast_steel: { name: "Cast steel rod", sub: "620MPa fat250 E200", info: "The cast rod out of an economy engine. Good to about a hundred horsepower a litre, and no further.", E: 200, uts: 620, fatigue: 250, dens: 7850, massFac: 1.00, cost: 55 },
    pm_forged: { name: "PM cracked rod", sub: "900MPa fat330 E205", info: "Powder-forged, with the big end cracked in two so it locates perfectly. Light and accurate for the money; repeated over-rev works that joint loose.", E: 205, uts: 900, fatigue: 330, dens: 7830, massFac: 0.94, cost: 130 },
    forged_4340: { name: "Forged 4340 H-beam", sub: "1080MPa fat430 E205", info: "A chrome-moly forging — the workhorse of every serious build, and the point where the rod stops being the weak link.", E: 205, uts: 1080, fatigue: 430, dens: 7850, massFac: 1.10, cost: 620, req: "shop1" },
    forged_300m: { name: "Forged 300M", sub: "1930MPa fat620 E205", info: "Vacuum-melted aircraft steel, the stuff landing gear is made from. It takes detonation loads that would fold a 4340.", E: 205, uts: 1930, fatigue: 620, dens: 7850, massFac: 1.08, cost: 1600, req: "shop2" },
    alu_billet: { name: "Billet alu rod", sub: "520MPa E72 2.8g/cc", info: "A thick aluminium rod that absorbs detonation instead of passing it into the bearings, and carries a big end wide enough to spread the load. Aluminium has no fatigue limit at all, so it is a service item measured in passes.", E: 72, uts: 520, fatigue: 150, dens: 2800, massFac: 1.70, brgW: 1.21, mpsLim: 30.5, areaFac: 1.70, cost: 3800, alu: 1, req: "race" },
    heavy_4340: { name: "Heavy-beam 4340 rod", sub: "1150MPa fat470 beam x1.4", info: "A forged 4340 rod with a beam about forty percent bigger and a wider big end, the rod competition pulling diesels run. It will not fold under 400 bar of firing pressure, but it is heavy, so leave it out of anything that revs.", E: 205, uts: 1150, fatigue: 470, dens: 7850, massFac: 1.40, areaFac: 1.40, brgW: 1.12, cost: 1900, req: "shop2" },
    titanium: { name: "Ti-6Al-4V rod", sub: "950MPa E114 4.43g/cc", info: "Far lighter than steel, so inertia loads collapse and the whole bottom end relaxes. Much less stiff in buckling, and it galls against ordinary bearing overlays.", E: 114, uts: 950, fatigue: 480, dens: 4430, massFac: 0.58, cost: 5200, req: "shop2" }
  };

  /* ---- rod bolts ---- */
  OPT.rodBolts = {
    oem: { name: "OEM rod bolt", sub: "150 ksi  1035 MPa", info: "A torque-to-yield bolt, stretched once on assembly and then thrown away. First thing to let go on a missed downshift.", uts: 1035, cost: 40 },
    arp2000: { name: "ARP2000 bolt", sub: "220 ksi  1517 MPa", info: "A vacuum-melted alloy bolt fitted to a stretch figure rather than a torque setting. The standard upgrade.", uts: 1517, cost: 190, req: "shop1" },
    age625: { name: "Custom Age 625+", sub: "260 ksi  1793 MPa", info: "Nickel-cobalt superalloy: the highest strength available, superb fatigue life and no embrittlement risk. What professional teams run.", uts: 1793, cost: 640, req: "shop2" }
  };

  /* ---- crankshafts ---- */
  OPT.crank = {
    cast_nodular: { name: "Cast nodular iron", sub: "fat260 stiff1.00", info: "A ductile iron casting. Fine at stock power; the fillets are what give up once you add revs and cylinders.", fatigue: 260, stiffFac: 1.00, dens: 7100, massFac: 1.00, cost: 400 },
    forged_4340: { name: "Forged 4340 crank", sub: "fat480 stiff1.06", info: "Forged, with rolled fillets — roughly double the fatigue strength of a casting, and stiffer in torsion with it.", fatigue: 480, stiffFac: 1.06, dens: 7850, massFac: 1.12, cost: 1600, req: "shop1" },
    forged_nitrided: { name: "Nitrided 4340", sub: "fat620 case 60HRC", info: "A forged crank gas-nitrided to a hard case. The compressed surface pushes fatigue strength up again and the journals stop wearing.", fatigue: 620, stiffFac: 1.08, dens: 7850, massFac: 1.12, cost: 2800, req: "shop2" },
    billet_300m: { name: "Billet 300M crank", sub: "fat780 stiff1.12", info: "Cut from solid aircraft-grade bar, fully counterweighted and knife-edged. The strongest thing you can put in a crankcase, priced accordingly.", fatigue: 780, stiffFac: 1.12, dens: 7850, massFac: 1.05, cost: 13000, req: "shop2" }
  };

  /* ---- torsional damper ---- */
  OPT.damper = {
    none: { name: "Solid hub", sub: "damping 0.00", info: "A plain steel pulley. Lightest option, fine on a short crank, and no help whatsoever to a long six or twelve.", damping: 0.0, massFac: 0.4, cost: 60 },
    rubber: { name: "Elastomer damper", sub: "damping 0.55", info: "The standard bonded-rubber absorber, tuned to the crank's own resonance. The rubber hardens with age and quietly stops working.", damping: 0.55, massFac: 1.0, cost: 220 },
    viscous: { name: "Viscous damper", sub: "damping 0.78", info: "A silicone-filled inertia ring that damps across the whole rev range instead of one frequency. What long cranks want.", damping: 0.78, massFac: 1.35, cost: 850, req: "shop1" }
  };

  /* ---- bearings ---- */
  OPT.bearings = {
    bimetal: { name: "Bimetal Al-Sn", sub: "55 MPa  embed good", info: "Aluminium-tin on a steel back. Cheap, forgiving of dirt, and eaten by the acids methanol leaves behind.", limitMPa: 55, galling: 1.0, methanolOK: 0, cost: 90 },
    trimetal: { name: "Trimetal Cu-Pb", sub: "80 MPa  overlay Pb", info: "Copper-lead under a soft plated overlay that lets grit bury itself instead of scoring the journal. The classic performance bearing.", limitMPa: 80, galling: 0.85, methanolOK: 1, cost: 210, req: "shop1" },
    coated: { name: "Poly-coated tri", sub: "95 MPa  PTFE/MoS2", info: "A trimetal with a dry-film coating over it: survives dry starts, and the only overlay that will not gall against a titanium rod.", limitMPa: 95, galling: 0.35, methanolOK: 1, cost: 900, req: "shop2" },
    race_xl: { name: "Race shell, big journal", sub: "140 MPa  +10% journal", info: "A race shell with a harder, thinner overlay and extra eccentricity, run on a crank ground with oversize journals and a fully grooved upper half. About a tenth more bearing area, and far more load before the overlay fatigues, at the price of less tolerance for dirt.", limitMPa: 140, areaK: 1.10, galling: 0.40, methanolOK: 1, cost: 1800, req: "race" },
    pro_wide: { name: "Pro shell, wide journal", sub: "150 MPa  +20% journal", info: "The bearing a thousand-horsepower four-cylinder lives on: a steel-backed shell with a thin, hard overlay, run on a billet crank whose rod journals are ground both bigger and wider, with narrow-chamfer shells and a rod big end bored to suit. A fifth more bearing area than a stock journal, at a price that hurts and no tolerance at all for dirt.", limitMPa: 150, areaK: 1.20, galling: 0.40, methanolOK: 1, cost: 3400, req: "race" }
  };

  /* ---- head gasket ---- */
  OPT.gasket = {
    composite: { name: "Composite gasket", sub: "90 bar  shear 65um", info: "Graphite and aramid over a steel core. Soft enough to forgive a rough deck and a head that grows faster than its block — until boost or an overheat stretches it past what it can take.", maxPmaxBar: 90, shearUm: 65, cost: 90 },
    mls: { name: "MLS gasket", sub: "160 bar shear 70um", info: "Layered embossed stainless with a rubber coating. It holds serious pressure, but it wants a deck machined properly flat and will not seal a rough one.", maxPmaxBar: 160, shearUm: 70, cost: 260, req: "shop1" },
    copper_oring: { name: "Copper + O-ring", sub: "220 bar shear 55um", info: "Solid copper sealing against a wire ring set into the block. Effectively unburstable, and it will not hold water or oil without sealant.", maxPmaxBar: 220, shearUm: 55, cost: 420, req: "shop2" },
    fire_ring: { name: "Fire ring + receiver", sub: "420 bar shear 150um", info: "A stainless wire ring set in a groove around each bore of the head and pressed into a matching receiver groove in the deck; the gasket body only seals water and oil. The ring itself is the combustion seal, so it holds pulling-diesel cylinder pressure and lets the head slide across a deck that grows at a different rate. Both faces have to be machined for it.", maxPmaxBar: 420, shearUm: 150, fireRing: 1, cost: 1600, req: "race" }
  };

  /* ---- head fasteners ---- */
  OPT.studs = {
    bolts_tty: { name: "TTY head bolts", sub: "1035MPa 45kN each", info: "Stretched past their yield point on assembly for an even clamp. Single use, and they relax as the alloy head heats up.", clampKn: 45, uts: 1035, pullOut: 1.0, cost: 70 },
    arp_studs: { name: "ARP head studs", sub: "1240MPa 62kN each", info: "The nut turns against a washer instead of the thread, so the block never sees any twist. Repeatable, reusable, and a real step up in clamp.", clampKn: 62, uts: 1240, pullOut: 1.0, cost: 320, req: "shop1" },
    studs_916: { name: "9/16 studs, six", sub: "112kN each  6 per bore", oring: 1.35, info: "Half again the thread area, six of them around each bore, and a wire O-ring cut into the deck so the gasket only has to seal water. This is what holds a head down at forty pounds of boost.", clampKn: 112, uts: 1500, pullOut: 1.45, bolts: 6, cost: 3400, req: "shop2" },
    l19: { name: "ARP L19 studs", sub: "1500MPa 75kN each", info: "A vacuum-melt steel giving the highest clamp you can buy. It is prone to hydrogen embrittlement — keep it oiled and out of damp storage.", clampKn: 75, uts: 1500, pullOut: 1.25, cost: 780, req: "shop2" }
  };

  /* ---- intake ---- */
  OPT.intake = {
    carb: { name: "Carburettor", sub: "VE-0.05 tune 3200rpm", info: "One carburettor feeding a shared plenum. Fuel evaporating in the manifold genuinely cools the charge; distribution is uneven and it cannot meter alcohol.", veBonus: -0.05, rTune: 3200, amp: 0.05, loss: 1.35, wet: 1, cost: 260 },
    single_tb: { name: "Single throttle body", sub: "VE 0.00 tune 4200rpm", info: "One throttle into a plenum, injectors at the ports. Simple, cheap, and the plenum smooths the pulses out. The road-car default.", veBonus: 0.0, rTune: 4200, amp: 0.06, loss: 1.0, wet: 0, cost: 380 },
    itb: { name: "Individual throttles", sub: "VE+0.06 tune 6800rpm", info: "A butterfly per cylinder, right at the port. No shared plenum means no cross-talk and an instant throttle; idle and part load get difficult.", veBonus: 0.06, rTune: 6800, amp: 0.10, loss: 0.80, wet: 0, cost: 2200, req: "flow" },
    plenum_long: { name: "Long runner plenum", sub: "VE+0.02 tune 3600rpm", info: "Long, narrow runners tune the resonance low and stuff the cylinder full in the mid-range. They choke off the top end.", veBonus: 0.02, rTune: 3600, amp: 0.11, loss: 1.05, wet: 0, cost: 460 },
    plenum_short: { name: "Short runner plenum", sub: "VE+0.03 tune 6200rpm", info: "Short, fat runners move the resonant peak high up the rev range. Strong above the tuned point, soft below it.", veBonus: 0.03, rTune: 6200, amp: 0.10, loss: 0.92, wet: 0, cost: 520, req: "flow" }
  };

  /* ---- nitrous oxide ----
     Shot size is quoted the way the industry quotes it: crank horsepower at the
     jet. Internally that becomes an N2O mass flow (N2O is 36.4% oxygen by mass
     against air's 23.2%, and roughly 15 hp per lb/min with the fuel to match).  */
  OPT.nitrous = {
    none: { name: "No nitrous", sub: "\u2014", info: "No power adder beyond whatever is feeding the intake.", shotHp: 0, prog: 0, cost: 0 },
    /* kind: dry = nitrous only, the engine's own injectors find the fuel (the ECU or a pressure riser adds it);
       wet = a plate or fogger meters its own fuel off the pump; direct = a nozzle per runner; diesel = oxygen into a diesel intake.
       plate: the fuel and nitrous mix in the intake tract (backfire risk). fam: "si" spark engines only, "ci" diesels only. */
    dry75: { name: "75 shot, dry", sub: "nozzle only", info: "One nitrous nozzle in the intake tube and nothing else: the extra fuel has to come out of the engine's own injectors, so the ECU raises the rail pressure and the injector table while the button is closed. Cheap and tidy, and only as safe as the injectors and the pump behind it.", shotHp: 75, prog: 0, cost: 550, req: "boost", kind: "dry", stages: 1, fam: "si" },
    dry125: { name: "125 shot, dry", sub: "nozzle only", info: "The same single nozzle jetted bigger. A hundred and twenty-five horsepower of oxygen asks the stock fuel system for a third more fuel all at once — if the injectors are already near the end of their duty, the mixture goes lean the instant the shot comes in, and a lean nitrous mixture melts pistons.", shotHp: 125, prog: 0, cost: 750, req: "boost", kind: "dry", stages: 1, fam: "si" },
    wet150: { name: "150 shot, wet", sub: "one stage", info: "A single wet fogger plate under the carb or throttle body, jetted for a hundred and fifty. Simple, cheap, and it arrives all at once the moment the button closes.", shotHp: 150, prog: 0, cost: 1400, req: "boost", kind: "wet", stages: 1, plate: true },
    wet2stage: { name: "100 + 150 plates", sub: "two-stage, wet", info: "Two plates stacked under the throttle: a hundred on the first stage, another hundred and fifty on the second once the car is hooked up. Lots of shot for the money — and a plenum full of fuel and oxygen waiting for a single misfire to light it.", shotHp: 250, prog: 0, cost: 2600, req: "shop1", kind: "wet", stages: 2, stageHp: [100, 150], plate: true },
    direct250: { name: "250 direct port", sub: "one stage", info: "A nozzle and a fuel jet in every runner, so every cylinder gets the same shot instead of whichever one is nearest the plate. Still switched on and off in one hit.", shotHp: 250, prog: 0, cost: 4200, req: "shop2", kind: "direct", stages: 1 },
    prog400: { name: "400 progressive", sub: "ramped on a timer", info: "Direct port fed through a progressive controller that ramps the solenoids in over a second or two, so the tyres get a chance and the rods survive the hit.", shotHp: 400, prog: 1, cost: 9500, req: "race", kind: "direct", stages: 1 },
    prog700: { name: "700 progressive", sub: "two stages, ramped", info: "Two stages of direct port on a progressive controller. This is a second engine's worth of power arriving through the same rods, and it is only survivable because it comes on gradually.", shotHp: 700, prog: 1, cost: 18000, req: "race", kind: "direct", stages: 2 },
    diesel100: { name: "Diesel kit, 100", sub: "dry, into the intake", info: "Nitrous into a diesel's intake with no fuel of its own: the extra oxygen burns fuel that was going out as smoke, and the pump is turned up to use the rest. A moderate shot actually cools the exhaust; a big one sends cylinder pressure through the roof.", shotHp: 100, prog: 0, cost: 900, req: "boost", kind: "diesel", stages: 1, fam: "ci" }
  };

  /* ---- aspiration ---- */
  OPT.asp = {
    na: { name: "Naturally aspirated", sub: "PR 1.00  no charge air", info: "Atmospheric filling only. Perfectly linear response, and output capped by displacement and revs.", kind: "na", cost: 0 },
    turbo: { name: "Single turbo", sub: "exh driven  lag med", info: "One turbocharger driven by exhaust that was leaving anyway. You pay for it in backpressure, and in lag below the spool point.", kind: "turbo", units: 1, cost: 1800, req: "boost" },
    twin_turbo: { name: "Twin turbo", sub: "2 units  spool x0.78", info: "Two smaller turbos, one per bank or staged in sequence. Half the flow each means lighter wheels and noticeably earlier boost.", kind: "turbo", units: 2, cost: 3400, req: "boost" },
    roots: { name: "Roots blower", sub: "boost ~ rpm  parasitic", info: "A blower geared straight to the crank, so boost arrives just off idle and climbs with revs. It eats crank power and heats the charge hard.", kind: "roots", units: 1, cost: 2600, req: "boost" },
    centrifugal: { name: "Centrifugal super", sub: "boost ~ rpm^2  cool", info: "A turbo-style wheel on a belt drive: efficient and cool, with boost that builds with the square of engine speed. Useless below half revs.", kind: "centrifugal", units: 1, cost: 2400, req: "boost" },
    screw: { name: "Twin-screw blower", sub: "PD  intercooled lid", info: "Screw rotors compress the air inside the case instead of just shoving it along, so it makes boost from idle without the heat a Roots blower adds. It still takes a lot of crank power to turn.", kind: "screw", units: 1, cost: 9800, req: "race" },
    compound: { name: "Compound turbos", sub: "2 stages  interstage cool", info: "A big turbo feeding a smaller one, so each stage only has to make part of the pressure ratio. Far cooler air at high boost than one wheel can manage, at the cost of serious backpressure.", kind: "turbo", units: 2, compound: 1, cost: 12500, req: "shop2" }
  };

  /* ---- turbo size (compressor flow in lb/min per unit) ---- */
  OPT.turboSize = {
    small: { name: "Small turbo", sub: "26 lb/min  spool 0.82", info: "A small wheel that lights instantly and fills the mid-range, then runs out of breath and corks the engine up top.", maxFlow: 26, spoolFac: 0.82, chokeFac: 0.85, backP: 2.40, cost: 0 },
    medium: { name: "Medium turbo", sub: "40 lb/min  spool 1.10", info: "The all-rounder. Enough flow for a strong road engine, with boost arriving around three thousand on a two-litre.", maxFlow: 40, spoolFac: 1.10, chokeFac: 1.00, backP: 1.95, cost: 400 },
    large: { name: "Large turbo", sub: "58 lb/min  spool 1.52", info: "A big wheel with the flow for serious power, behind a housing large enough that nothing happens down low on a small engine.", maxFlow: 58, spoolFac: 1.52, chokeFac: 1.15, backP: 1.50, cost: 900 },
    s66: { name: "66 mm smoker wheel", sub: "115 lb/min  spool 2.20", info: "The 2.6-inch pulling turbo: a 66 mm inducer to pass the tech card, a big exducer behind it and a ported map-width cover so it keeps flowing at 60 psi. Lazy off the line on anything but a big diesel.", maxFlow: 115, spoolFac: 2.20, chokeFac: 1.40, backP: 1.30, cost: 3800, req: "boost" },
    huge: { name: "Huge turbo", sub: "84 lb/min  spool 2.05", info: "A competition wheel: enormous top-end flow and almost no backpressure once lit. On the street it is dead weight.", maxFlow: 84, spoolFac: 2.05, chokeFac: 1.30, backP: 1.20, cost: 2600, req: "shop2" },
    f88: { name: "88 mm frame", sub: "125 lb/min", info: "A billet 88 mm wheel in a T6 frame — the size that shows up under the bumper of every fast radial car. Nothing at all happens below four thousand.", maxFlow: 125, spoolFac: 2.75, chokeFac: 1.42, backP: 1.10, cost: 7200, req: "race" },
    f98: { name: "98 mm frame", sub: "165 lb/min", info: "A pair of these is what a three-thousand horsepower door car runs. The wheel takes a moment to come alive and then the tyres are the problem.", maxFlow: 165, spoolFac: 3.45, chokeFac: 1.55, backP: 1.02, cost: 14500, req: "race" }
  };

  /* ---- turbine housing / wheel material ---- */
  OPT.turbineMat = {
    cast_iron: { name: "Ni-resist turbine", sub: "950 C max EGT", info: "Austenitic cast iron housing with a nickel-alloy wheel. Fine as long as you keep exhaust temperature sensible.", maxEgtC: 950, cost: 0 },
    inconel: { name: "Inconel 713C hot end", sub: "1050 C max EGT", info: "A full nickel superalloy hot side. Necessary once you run lean, or pull timing to hold back knock under boost.", maxEgtC: 1050, cost: 1400, req: "shop2" }
  };

  /* ---- turbine housing geometry: fixed nozzle, or a ring of pivoting vanes (VGT / VNT) ----
     Vanes nearly shut at low exhaust flow make a small, fast turbine (early boost, more drive pressure); swung
     open up top they make a big one (less backpressure). Diesel exhaust is cool enough for a steel vane ring;
     on petrol the ring has to be a superalloy and still has a lower ceiling than the housing around it. */
  OPT.turbine = {
    fixed: { name: "Fixed-geometry turbine", sub: "one A/R  wastegated", info: "One housing size, chosen as a compromise: small enough to spool, big enough not to choke the top end. A wastegate bleeds off what it can't use.", cost: 0 },
    vgt: { name: "Variable-geometry (VGT)", sub: "vanes  spool x0.70-0.78", info: "A ring of pivoting vanes in the turbine nozzle. Closed at low revs they act like a tiny housing and light the turbo early; open at high revs they flow like a big one. Standard on modern diesels. On petrol the exhaust is a few hundred degrees hotter, so the vanes must be a superalloy (the Porsche 997 Turbo was first) and they still have a lower limit than the housing. Soot from a smoky tune glues them in place.", cost: 1500, costPetrol: 3600, vaneEgtC: { cast_iron: 880, inconel: 1000 }, req: "shop2" }
  };
  /* ---- anti-lag (ECU + plumbing, petrol turbos): fire fuel in the manifold so the turbine keeps turning with the throttle shut ---- */
  OPT.als = {
    off: { name: "No anti-lag", sub: "turbo coasts down", info: "Lift off and the turbine loses its exhaust: the wheel slows, the blow-off dumps the charge and boost has to build again on the next throttle.", cost: 0 },
    ignition: { name: "Ignition-retard ALS", sub: "bangs  holds ~55%", info: "Off throttle the ECU leaves the throttle cracked, retards the spark 20-40° and richens the mixture, so the charge is still burning as it leaves the port and keeps the turbine spinning. Loud bangs and flames from the pipe. It keeps about half the boost through a shift, at the cost of enormous turbine heat.", cost: 900, hold: 0.55, line: 0.38, energy: 0.85, egtAdd: 130, fuel: 0.06, dose: 0.25, req: "boost" },
    air: { name: "Secondary-air ALS", sub: "rally  holds ~75%", info: "The Group A rally system: a bypass valve feeds fresh air straight into the exhaust manifold, where it meets the rich, late-burning charge and burns ahead of the turbine. More effective than retard alone, and more violent — turbines and manifolds are a consumable at this level.", cost: 2400, hold: 0.75, line: 0.55, energy: 1.15, egtAdd: 190, fuel: 0.12, dose: 0.40, req: "race" }
  };

  /* ---- intercooler ---- */
  OPT.ic = {
    none: { name: "No intercooler", sub: "eff 0%  dP 0.00 bar", info: "Compressor discharge goes straight into the manifold. The charge arrives hot, which costs you density and all of your knock margin.", eff: 0.0, dp: 0.0, soak: 0, massKg: 0, cost: 0 },
    air_air: { name: "Air-to-air core", sub: "eff 70%  dP 0.06 bar", info: "A front-mounted bar-and-plate core. No heat soak while the car is moving, at the price of some pressure drop and a long charge pipe.", eff: 0.70, dp: 0.06, soak: 0.35, massKg: 9, cost: 700 },
    ice_tank: { name: "Ice-tank charge cooler", sub: "97% eff  one pass", info: "A liquid-to-air core fed from a tank of ice water. It drops the charge to near ambient for one pass, then the ice is gone and it is worse than nothing.", eff: 0.97, dp: 0.05, soak: 3.2, massKg: 28, cost: 3200, req: "race" },
    water_air: { name: "Water-to-air core", sub: "eff 85%  dP 0.04 bar", info: "A compact liquid-cooled core right by the throttle: very effective, with almost no pipework. Over a long session the water heats up and it fades.", eff: 0.85, dp: 0.04, soak: 1.0, massKg: 15, cost: 1300, req: "shop1" },
    a2w_race: { name: "Race water-to-air", sub: "eff 92%  dP 0.03 bar", info: "A big bar-and-plate liquid core with its own front heat exchanger and a high-flow pump. It holds the charge close to ambient at serious boost and fades far less than the compact core.", eff: 0.92, dp: 0.03, soak: 0.6, massKg: 21, cost: 2600, req: "shop2" },
    wmi: { name: "Race W2A + water-meth", sub: "eff 95%  +4 octane", info: "The race water-to-air core plus a 50/50 water-methanol mist sprayed after it. The mist boils off in the charge, pulling it below what any core can, adds octane and takes some heat out of the combustion before it reaches the coolant. The tank runs dry, and a blocked nozzle at full boost is an expensive noise.", eff: 0.95, dp: 0.04, soak: 0.6, octane: 4, heatK: 0.94, massKg: 30, cost: 3900, req: "race" }
  };

  /* ---- fuels (RON/MON, stoich AFR, LHV, heat of vaporisation) ---- */
  OPT.fuel = {
    r87: { name: "87 pump regular", sub: "R91/M82  14.7  43.4MJ", info: "Ordinary regular unleaded. The cheapest thing in the pump, and the first thing holding your compression back.", ron: 91, mon: 82.5, afr: 14.7, lhv: 43.4e6, hov: 350e3, gamma: 1.30, corrosive: 0, costL: 1.45 },
    r91: { name: "91 pump premium", sub: "R95/M85  14.7  43.4MJ", info: "Premium pump fuel. The step up from regular is worth roughly a point of compression, or a little more boost.", ron: 95, mon: 85, afr: 14.7, lhv: 43.4e6, hov: 350e3, gamma: 1.30, corrosive: 0, costL: 1.65 },
    r94: { name: "98 RON super", sub: "R98/M88  14.7  43.4MJ", info: "The best pump fuel most places sell. It keeps its knock resistance when the charge gets hot, which is exactly when it matters.", ron: 98, mon: 88, afr: 14.7, lhv: 43.4e6, hov: 350e3, gamma: 1.30, corrosive: 0, costL: 1.95, req: "shop1" },
    race100: { name: "Leaded race 100", sub: "R104/M96 14.5 43.5MJ", info: "Leaded race gasoline that stays stable under sustained boost and heat. It poisons catalysts and oxygen sensors.", lead: true, ron: 104, mon: 96, afr: 14.5, lhv: 43.5e6, hov: 340e3, gamma: 1.30, corrosive: 0, costL: 6.50, req: "shop2" },
    e85: { name: "E85 ethanol blend", sub: "R105/M88 9.8 29.2MJ", info: "Ethanol takes a lot of heat to evaporate, so it cools the charge on the way in and resists knock beautifully. You have to flow about forty percent more of it, so the injectors and the pump have to grow.", ron: 105, mon: 88, afr: 9.8, lhv: 29.2e6, hov: 760e3, gamma: 1.32, corrosive: 0.4, costL: 1.25, req: "shop1" },
    methanol: { name: "Methanol M100", sub: "R109/M89 6.45 19.9MJ", info: "That enormous evaporative cooling is where most of the power comes from. It pulls water out of the air and corrodes aluminium, magnesium and lead overlays.", ron: 109, mon: 89, afr: 6.45, lhv: 19.9e6, hov: 1100e3, gamma: 1.34, corrosive: 1.0, costL: 1.10, req: "shop2" },
    /* compression ignition: no spark and no octane. Cetane is how readily it lights off
       in hot compressed air; cloudC is where the wax starts to come out of it. */
    diesel: { name: "No. 2 diesel", sub: "CN48  14.5  42.8MJ", info: "Ordinary road diesel. Sprayed into air that compression has already made hot enough to light it, so there is nothing to knock \u2014 compression and boost are limited by the head bolts, not the fuel.", ci: true, cetane: 48, afr: 14.5, lhv: 42.8e6, hov: 250e3, gamma: 1.33, dens: 0.835, cloudC: -12, corrosive: 0, costL: 1.60 },
    b100: { name: "B100 biodiesel", sub: "CN55  12.5  37.2MJ", info: "Straight methyl ester from vegetable oil. It lights off more readily and smokes less, carries about 13% less energy, eats the nitrile seals in older pumps and turns to jelly near freezing.", ci: true, cetane: 55, afr: 12.5, lhv: 37.2e6, hov: 300e3, gamma: 1.33, dens: 0.880, cloudC: 2, corrosive: 0.25, costL: 1.75, req: "shop1" },
    /* ---- MORE FUELS. Race gas grades: grade marks a race fuel (no "pump fuel" knock warning), lead poisons
       catalysts and oxygen sensors, oxy is oxygen by mass (%) — an oxygenated fuel carries part of its own
       oxidiser, so it wants a richer jet and puts a few percent more energy into each kilogram of air. */
    race104u: { name: "104 unleaded race", short: "U104", sub: "R104/M92 14.6 43.2MJ", info: "Unleaded race gasoline for classes that run catalysts or ban lead. Octane close to the leaded 100 on the road number, a little softer on the motor number, so it gives up some margin when the charge is hot.", grade: 1, ron: 104, mon: 92, afr: 14.6, lhv: 43.2e6, hov: 350e3, gamma: 1.30, dens: 0.740, oxy: 0, corrosive: 0, costL: 5.40, req: "shop1" },
    race110: { name: "Leaded 110 race", short: "L110", sub: "R113/M107 14.7 43.6MJ", info: "The classic heavy-leaded grade for big compression and boost: its motor octane barely drops when the charge is hot, which is exactly what a blown or high-compression engine needs. The lead coats plugs, kills a catalyst in a tank or two and poisons oxygen sensors.", grade: 1, lead: true, ron: 113, mon: 107, afr: 14.7, lhv: 43.6e6, hov: 330e3, gamma: 1.30, dens: 0.720, oxy: 0, corrosive: 0, costL: 9.20, req: "shop2" },
    ox112: { name: "Oxygenated 112", short: "Ox112", sub: "R115/M109 13.5 40.6MJ", info: "Unleaded, with about 4.5% oxygen carried in the fuel itself. The jets go about 10% richer, and every kilogram of air burns a few percent more energy \u2014 E85's trick in a petrol that still has race-gas octane.", grade: 1, ron: 115, mon: 109, afr: 13.5, lhv: 40.6e6, hov: 390e3, gamma: 1.31, dens: 0.750, oxy: 4.5, corrosive: 0, costL: 11.50, req: "shop2" },
    ox116: { name: "Oxygenated leaded 116", short: "Ox116", sub: "R119/M113 13.0 39.4MJ", info: "The strongest race gasoline there is: leaded for octane and about 8% oxygen for power. It needs about 13% more fuel flow than petrol, it absorbs water once the drum is open and it costs like a fine wine. Catalysts and oxygen sensors do not survive it.", grade: 1, lead: true, ron: 119, mon: 113, afr: 13.0, lhv: 39.4e6, hov: 410e3, gamma: 1.31, dens: 0.760, oxy: 8.0, corrosive: 0.1, costL: 14.50, req: "shop2" },
    /* flex fuel: a sensor in the fuel line reads the ethanol content and the ECU moves fuel and timing to suit.
       The figures here are E85's; simulate() blends pump 91 and E85 at cfg.ethanolPct (fuelOf / flexBlend). */
    flex: { name: "Flex fuel sensor", short: "Flex", sub: "E0\u2013E85 \u00b7 sensor", info: "Anything from pump premium to E85 in the same tank. An ethanol-content sensor in the line tells the ECU what it is burning, and it moves the fuel and the timing to suit. Pump E85 is not always 85%: in winter it can be as low as E70, and the tune has to live with that too.", flex: true, ron: 105, mon: 88, afr: 9.8, lhv: 29.2e6, hov: 760e3, gamma: 1.32, dens: 0.782, corrosive: 0.4, costL: 1.25, req: "shop1" },
    /* gaseous fuels: they arrive as vapour (no evaporative cooling), take up some of the cylinder that air would
       have filled (displace), are metered by a gasSys rather than injectors and a pump, and are counted in
       litres of liquid propane or kilograms of CNG (unit). vapor: propane needs tank pressure to flow. */
    lpg: { name: "Propane (LPG)", short: "LPG", sub: "R106/M96 15.7 46.4MJ gas", info: "Propane: high octane, burns clean, cheap by the litre and kind to the oil. It arrives in the manifold as vapour, so there is no evaporative cooling and it takes up about 4% of the cylinder that air would have filled. Forklifts, irrigation pumps, school buses and fleets run on it. Below about \u221230 \u00b0C the tank barely has the pressure to feed it.", gas: true, vapor: true, ron: 106, mon: 96, afr: 15.7, lhv: 46.4e6, hov: 426e3, gamma: 1.30, dens: 0.51, displace: 0.040, tankKg: 34, tankL: 80, corrosive: 0, costL: 0.85 },
    cng: { name: "CNG methane", short: "CNG", sub: "R120/M118 17.2 50.0MJ gas", info: "Compressed natural gas at 200 bar. Methane is about as knock-proof as a fuel gets and the cleanest-burning, but it fills nearly a tenth of the cylinder and burns slowly, so a petrol engine loses around a tenth of its power. The tank is heavy steel for not much energy: buses, city fleets and well-site engines that refuel at the depot.", gas: true, unit: "kg", ron: 120, mon: 118, afr: 17.2, lhv: 50.0e6, hov: 510e3, gamma: 1.31, dens: 1.0, displace: 0.095, etaK: 0.99, tankKg: 95, tankL: 20, corrosive: 0, costL: 1.25, req: "shop1" }
  };

  /* ---- gaseous fuel systems (MORE FUELS): what meters propane or CNG into the engine. kgh is the fuel mass flow
     it can meter, veK the airflow left by the mixer's venturi, dropBar how much boost costs it. ---- */
  OPT.gasSys = {
    mixer: { name: "Vaporiser + mixer", sub: "45 kg/h \u00b7 venturi", info: "A coolant-heated vaporiser boils the liquid off the tank and a regulator feeds a venturi mixer under the air cleaner: the forklift and irrigation-pump set-up. Cheap and simple; the venturi costs a few percent of airflow and it runs out of flow above a couple of hundred horsepower.", kgh: 45, veK: 0.97, dropBar: 0.15, needBar: 1.6, cost: 650, massKg: 8 },
    vapinj: { name: "Vapour injection", sub: "90 kg/h \u00b7 sequential", info: "A vaporiser and a rail of gas injectors, one at each port, fired by the ECU like petrol injectors. No venturi in the way and proper per-cylinder metering: the modern fleet conversion.", kgh: 90, veK: 1.0, dropBar: 0.06, needBar: 1.4, cost: 1400, massKg: 7, req: "shop1" },
    hdvap: { name: "Twin vaporisers + rail", sub: "180 kg/h \u00b7 high flow", info: "Two big vaporisers in parallel feeding high-flow gas injectors, for big displacement or boost. It needs plenty of coolant flow to keep the vaporisers from icing at full load.", kgh: 180, veK: 1.0, dropBar: 0.04, needBar: 1.5, cost: 2600, massKg: 13, req: "shop2" }
  };

  /* ---- fuel injectors (cc/min at 3 bar across the nozzle, one per port unless noted) ----
     The regulator is boost-referenced, so the pressure across the nozzle and the flow
     hold under boost. cost is per injector.                                          */
  OPT.injectors = {
    i240: { name: "240 cc stock", sub: "240 cc/min", info: "The small high-impedance injectors an economy engine leaves the factory with. Plenty for a hundred-odd horsepower on pump fuel, nowhere near enough for alcohol.", cc: 240, cost: 0 },
    i440: { name: "440 cc", sub: "440 cc/min", info: "The size a factory turbo four or a hot six runs: about fifty-five horsepower a cylinder on petrol with the duty cycle still comfortable.", cc: 440, cost: 55 },
    i650: { name: "650 cc", sub: "650 cc/min", info: "The usual first upgrade: the flow for a boosted four on petrol, or a healthy naturally aspirated engine on E85.", cc: 650, cost: 75 },
    i1000: { name: "1000 cc", sub: "1000 cc/min", info: "The injector half the tuning world runs. It still idles cleanly on a modern driver, and it is where E85 on a boosted engine starts to make sense.", cc: 1000, cost: 110 },
    i1650: { name: "1650 cc", sub: "1650 cc/min", info: "High-flow injectors for serious boost on E85. Idle and cold start take careful calibration, because the shortest pulse is already a lot of fuel.", cc: 1650, cost: 150, req: "boost" },
    i2200: { name: "2200 cc", sub: "2200 cc/min", info: "The largest port injector that still behaves at part load. Four-figure E85 engines and methanol engines live here.", cc: 2200, cost: 190, req: "boost" },
    i2200x2: { name: "2 \u00d7 2200 cc", sub: "2 a port \u00b7 4400 cc", info: "Two 2200s per cylinder, one at the port and one up the runner, staged in as the load builds. This is how an injected methanol engine gets more than twice a petrol engine's fuel into the cylinder.", cc: 2200, perCyl: 2, cost: 190, req: "shop2" },
    i2200x4: { name: "4 \u00d7 2200 cc", sub: "4 a port \u00b7 8800 cc", info: "Two at the port and two more in the hat above the blower or throttle, sixteen or more on a V8. Only a three-thousand horsepower alcohol door car needs this much.", cc: 2200, perCyl: 4, cost: 190, req: "race" }
  };

  /* ---- fuel pump (L/h free flow at 3 bar). An in-tank pump pushes against base
     pressure plus boost and flows less as boost rises (dropBar per bar); the belt
     pump is a gear pump whose flow follows engine speed (rpmRef).             ---- */
  OPT.fuelPump = {
    p190: { name: "Stock pump", sub: "190 L/h in-tank", info: "The factory pump in the tank: enough for the engine it came with and a little more. Under boost the rail pressure rises with the manifold, and it flows less.", lph: 190, dropBar: 0.13, cost: 0, massKg: 0, short: "stock pump" },
    p255: { name: "255 L/h pump", sub: "255 L/h in-tank", info: "The classic in-tank upgrade, good for around five hundred horsepower on petrol. Its flow falls off as boost raises the pressure it has to push against.", lph: 255, dropBar: 0.13, cost: 140, massKg: 0, short: "255 L/h pump" },
    p340: { name: "340 L/h pump", sub: "340 L/h in-tank", info: "A high-flow in-tank pump with a bigger motor. Around six hundred horsepower on petrol, or four and a half on E85 at moderate boost.", lph: 340, dropBar: 0.14, cost: 230, massKg: 0, short: "340 L/h pump" },
    twin450: { name: "Twin 450 pumps", sub: "900 L/h \u00b7 surge tank", info: "Two 450 L/h pumps in a surge tank, the second one switched in under boost. Four-figure power on E85, as long as the wiring can carry the current.", lph: 900, dropBar: 0.14, cost: 950, massKg: 0, req: "shop2", short: "twin 450s" },
    mech: { name: "Belt-drive pump", sub: "4000 L/h at 8000 rpm", info: "A gear pump driven off the crank, the way alcohol drag engines are fed. Its flow rises with engine speed and barely notices rail pressure, so it never runs dry at the top of the pull.", lph: 4000, dropBar: 0.02, rpmRef: 8000, cost: 2600, massKg: 3, req: "shop2", short: "belt pump" },
    mech_xl: { name: "Big belt-drive pump", sub: "6500 L/h at 8000 rpm", info: "The biggest gear pump on the shelf, run with -16 feed lines and twin regulators: what a four-thousand-horsepower methanol engine needs to stay rich at the top of the pull.", lph: 6500, dropBar: 0.02, rpmRef: 8000, cost: 3900, massKg: 4, req: "race", short: "big belt pump" }
  };

  /* ---- diesel injection system (only fitted when the fuel is compression ignition) ----
     bar = injection pressure at the nozzle (atomisation), qL = full-load fuel per stroke
     per litre of cylinder with stock nozzles (mm3), rpmMax = speed the pump or rail keeps
     up to, smokeLim = how well fuelling follows boost (1 = the ECU holds lambda, 0 = full
     fuel whether the turbo is lit or not), pilot = pilot injection (softens the bang),
     etaB = combustion efficiency gained from finer spray. kind: mech | unit | cr.      */
  OPT.dInj = {
    rotary_ve: { name: "Rotary VE pump", sub: "600 bar  mech  aneroid", info: "One plunger spinning inside a distributor head, feeding every cylinder in turn \u2014 the pump on a 1.9 TDI or an early 5.9. Cheap and compact, with a boost aneroid that only roughly follows the turbo.", kind: "mech", bar: 600, qL: 135, rpmMax: 4400, smokeLim: 0.6, pilot: 0, etaB: 0, cost: 650, massKg: 6 },
    inline_mech: { name: "Inline P-pump", sub: "900 bar  huge fuel", info: "A plunger and barrel per cylinder in a cast-iron case the size of a toolbox, the pump on a 12-valve Cummins. Turn the fuel plate and it flows more than the engine can burn \u2014 the boost compensator barely holds it back, so it smokes until the turbo lights.", kind: "mech", bar: 900, qL: 170, rpmMax: 4400, smokeLim: 0.2, pilot: 0, etaB: 0.005, cost: 2400, massKg: 16, req: "shop1" },
    heui: { name: "HEUI unit injectors", sub: "1500 bar  oil driven", info: "Engine oil at up to 200 bar from a high-pressure pump pushes an intensifier piston in each injector, as on the 7.3 Powerstroke. Proper pressure and an electronic smoke map, but the oil pump runs short at high revs.", kind: "unit", bar: 1500, qL: 140, rpmMax: 3600, smokeLim: 0.65, pilot: 0.3, etaB: 0.012, cost: 3200, massKg: 12, req: "shop1" },
    cr_gen1: { name: "Common rail 1,350", sub: "1350 bar  pilot  ECU", info: "A pump holds a rail at pressure and solenoid injectors open when the ECU says, as on the LB7 Duramax. A pilot shot before the main one takes the knock out of the combustion, and the ECU only adds fuel as fast as the boost arrives.", kind: "cr", bar: 1350, qL: 130, rpmMax: 4000, smokeLim: 0.9, pilot: 0.85, etaB: 0.015, cost: 3800, massKg: 9, req: "flow" },
    unit_dd: { name: "Detroit unit injectors", sub: "1400 bar  torque rise", info: "A cam-driven plunger inside every injector body, metered by a rack along the head: Detroit Diesel's design since the 1930s. The helix gives a little more fuel per stroke as the revs fall, so the torque climbs as a truck lugs down a hill.", kind: "unit", bar: 1400, qL: 175, rpmMax: 3000, smokeLim: 0.30, pilot: 0, etaB: 0.008, rise: 0.20, cost: 2800, massKg: 10, req: "shop1" },
    cr_piezo: { name: "Piezo common rail", sub: "2000 bar  multi-shot", info: "Piezo stacks open the needle in a tenth of a millisecond, so one cycle can carry several pilot, main and post shots at 2,000 bar. The finest spray there is: the least smoke, the least noise and the most work per drop.", kind: "cr", bar: 2000, qL: 150, rpmMax: 5000, smokeLim: 1.0, pilot: 1.0, etaB: 0.025, cost: 6500, massKg: 9, req: "shop2" }
  };

  /* ---- diesel nozzles ("sticks"), named the way the trade sells them: by the
     horsepower they add on a stock truck. mult scales the fuel per stroke the
     injection system can push; cost is per nozzle.                         ---- */
  OPT.dNoz = {
    stock: { name: "Stock nozzles", sub: "x1.0 flow", info: "The holes the factory drilled, sized for a clean exhaust and the warranty.", mult: 1.0, cost: 0 },
    n30: { name: "30 hp nozzles", sub: "x1.3 flow", info: "Slightly larger holes. A touch more fuel at the top and barely any extra smoke \u2014 the towing upgrade.", mult: 1.3, cost: 70 },
    n60: { name: "60 hp nozzles", sub: "x1.6 flow", info: "The usual first step on a turned-up truck. It wants a bigger turbo, or the extra fuel comes out of the stack.", mult: 1.6, cost: 95 },
    n100: { name: "100 hp nozzles", sub: "x2.0 flow", info: "Twice the stock flow per stroke. Hot exhaust and a lot of soot unless there is the air to burn it.", mult: 2.0, cost: 140, req: "shop1" },
    n150: { name: "150 hp nozzles", sub: "x2.5 flow", info: "Competition street nozzles. They only make sense with twin turbos, a pyrometer in the manifold and studs in the head.", mult: 2.5, cost: 210, req: "shop2" },
    n250: { name: "250 hp sticks", sub: "x3.5 flow  pulling", info: "Pulling sticks: enough fuel to black out the grandstand. A built bottom end, compound turbos and a fire-ringed head, or it will not see the end of the track.", mult: 3.5, cost: 340, req: "shop2" },
    n400: { name: "400 hp sticks", sub: "x4.5 flow  pro pulling", info: "Pro-class pulling nozzles: bigger holes again, and more of them. Only worth fitting with a rail pump to feed them, compound turbos to burn it, and a fire-ringed head to hold it in.", mult: 4.5, cost: 520, req: "race" }
  };

  /* ---- ROTARY (Wankel) parts: only fitted when the layout is a rotary ----
     Ports: ve = breathing plateau, rpmC = rpm the port timing is centred on, wLo = how gently it falls
     away below that, flow = port area vs a stock side port, overlap = intake/exhaust overlap (idle,
     dilution, the brap), etaB = efficiency from a later exhaust opening, idle = the idle it needs.   */
  OPT.rotPort = {
    side: { name: "Stock side port", sub: "VE.96 ~5600rpm idle 750", info: "The factory intake ports cut in the side housings, timed so the intake and exhaust barely overlap. Clean idle, decent economy, good low-end torque \u2014 and it runs out of breath past about seven thousand.", ve: 0.86, rpmC: 5600, wLo: 1.25, wHi: 1.02, flow: 1.00, overlap: 0.05, etaB: 0, idle: 750, cost: 0 },
    sidex: { name: "6-port side exhaust", sub: "VE1.0 ~6900rpm no overlap", info: "The Renesis layout: three intake ports a rotor and the exhaust moved into the side housings too. There is no overlap at all, so it idles like a piano and opens the exhaust late enough to waste less heat.", ve: 0.92, rpmC: 6900, wLo: 1.08, wHi: 1.16, flow: 1.30, overlap: 0.0, etaB: 0.04, idle: 750, cost: 1600, req: "flow" },
    street: { name: "Street port", sub: "VE1.0 ~6400rpm idle 900", info: "The side ports opened up and the closing edge moved later by hand with a die grinder. A little lumpy at idle, noticeably stronger above five thousand, and still a road engine.", ve: 0.90, rpmC: 6400, wLo: 1.06, wHi: 1.12, flow: 1.14, overlap: 0.14, etaB: 0, idle: 900, cost: 900, req: "shop1" },
    bridge: { name: "Bridge port", sub: "VE1.08 ~7700rpm idle 1150", info: "A second window cut beside each side port, leaving a thin bridge so the apex seal has something to ride over. Huge overlap: it idles like a cement mixer and makes its power from seven thousand to the moon.", ve: 1.04, rpmC: 7700, wLo: 0.74, wHi: 1.25, flow: 1.34, overlap: 0.48, etaB: 0, idle: 1150, cost: 2400, req: "flow" },
    peri: { name: "Peripheral port", sub: "VE1.14 ~8500rpm idle 1400", info: "The intake moved out of the side housings into the rotor housing itself, where the apex seal sweeps straight past it. Nothing breathes better at nine thousand, and nothing idles worse. The race-car port.", ve: 1.12, rpmC: 8500, wLo: 0.62, wHi: 1.35, flow: 1.58, overlap: 0.72, etaB: 0, idle: 1400, cost: 5200, req: "shop2" }
  };
  /* apex seals: thick (mm), fatigue = what the seal survives in bending under combustion shock (MPa),
     dens (kg/m3) for the inertia that makes it chatter, brittle = how badly a knock event hurts it,
     fric/seal/wear vs the OEM part, cost per rotor (three seals and their springs)                    */
  OPT.apexSeal = {
    oem3: { name: "OEM 3 mm cast iron", sub: "3 mm  fat 90  std", info: "Mazda's two-piece cast-iron seal: wears in kindly against the chrome and lasts a long time at stock boost. A knock event cracks it, and then the rotor loses compression on one face.", thick: 3, fatigue: 90, dens: 7200, brittle: 0.60, fric: 1.00, seal: 1.00, wear: 1.00, cost: 45 },
    oem2: { name: "OEM 2 mm (Renesis)", sub: "2 mm  fat 150  light", info: "The thinner seal the Renesis brought in: less mass to bounce and less friction at nine thousand. Thinner means it bends more under pressure, and a boosted 2 mm seal is famous for the wrong reasons.", thick: 2, fatigue: 150, dens: 7300, brittle: 0.75, fric: 0.90, seal: 0.99, wear: 1.05, cost: 55 },
    ceramic: { name: "Ceramic Si3N4", sub: "3 mm  fat 230  0.44 mass", info: "Silicon nitride: less than half the weight of iron, very hard and barely wears. Strong in steady bending, but a ceramic does not bend before it breaks \u2014 knock shatters it.", thick: 3, fatigue: 230, dens: 3200, brittle: 1.40, fric: 0.85, seal: 1.02, wear: 0.60, cost: 380, req: "shop2" },
    billet: { name: "Billet steel seal", sub: "3 mm  fat 260  tough", info: "A one-piece seal machined from tool steel, the way the big-boost street rotary builders (Iannetti and the like) make them. Heavy and hard on a tired housing, but it takes a knock event and keeps sealing.", thick: 3, fatigue: 260, dens: 7800, brittle: 0.12, fric: 1.05, seal: 1.01, wear: 0.90, cost: 520, req: "race" }
  };
  /* rotor housings: chatter = how fast the seal can run before it bounces and marks the surface,
     hotC = hot-lobe temperature offset, egtC = exhaust heat kept in the gas, cost per housing          */
  OPT.rotHousing = {
    chrome: { name: "Hard-chrome lined", sub: "OEM  chatter 1.00", info: "An aluminium housing with a sprayed steel liner plated in hard chrome. Durable at stock revs; push past what the seals can follow and the chrome picks up chatter marks.", chatter: 1.00, hotC: 0, egtC: 0, massFac: 1.0, cost: 450 },
    nikasil: { name: "Nikasil re-plated", sub: "chatter 1.18  -12 C", info: "Stripped and re-plated with nickel-silicon carbide: harder than chrome, holds oil better and carries heat to the coolant faster.", chatter: 1.18, hotC: -12, egtC: 0, massFac: 1.0, cost: 1100, req: "shop1" },
    ceramic: { name: "Plasma ceramic coat", sub: "chatter 1.30  -35 C", info: "A plasma-sprayed ceramic running surface: the hardest there is, and it keeps combustion heat in the gas instead of the housing \u2014 cooler housings, hotter exhaust.", chatter: 1.30, hotC: -35, egtC: 25, massFac: 1.0, cost: 2600, req: "shop2" }
  };
  /* side (end) housings: what the side seals run on, and how stiff the stack is around the e-shaft */
  OPT.sidePlate = {
    iron: { name: "Nitrided cast iron", sub: "OEM  side seal 1.00", info: "The factory end plates: cast iron, nitrided where the side seals run. Heavy, stiff and forgiving.", sideSeal: 1.00, stiff: 1.00, massFac: 1.00, cost: 300 },
    hardened: { name: "Hardened & lapped", sub: "side seal 0.75", info: "Induction-hardened, lapped flat and checked for wear steps. The side seals bed in properly and stop sticking.", sideSeal: 0.75, stiff: 1.00, massFac: 1.00, cost: 700, req: "shop1" },
    alu: { name: "Billet alu, coated", sub: "0.55 mass  stiff 0.85", info: "Machined aluminium end plates with a sprayed hard face, as the endurance racers ran. Takes a quarter of the weight off a rotary \u2014 and gives the eccentric shaft a little less to lean on.", sideSeal: 0.90, stiff: 0.85, massFac: 0.55, cost: 2400, req: "race" }
  };
  /* eccentric shaft: supports = main bearings carrying it (a split shaft adds a centre main) */
  OPT.eshaft = {
    stock: { name: "Forged one-piece", sub: "fat 520  2 mains", info: "The factory forging, carried by a main bearing in each end housing. On two rotors it is massively over-built; on three or four it is a long beam with nothing in the middle.", fatigue: 520, dFac: 1.00, supports: 2, cost: 350 },
    billet: { name: "Billet 4340 shaft", sub: "fat 720  oversize", info: "Machined from chrome-moly bar with slightly bigger journals: stiffer, stronger, and far happier with a lot of power on a long engine.", fatigue: 720, dFac: 1.06, supports: 2, cost: 1400, req: "shop2" },
    split: { name: "Split + centre main", sub: "fat 680  3 mains", info: "A multi-piece shaft joined on tapers so a third main bearing can sit in the middle intermediate housing \u2014 what three- and four-rotor race engines need to stay straight at nine thousand.", fatigue: 680, dFac: 1.04, supports: 3, cost: 3200, req: "bay2" }
  };
  /* oil metering: the apex and side seals are lubricated by oil burnt with the charge. cap = how much
     oil reaches the seals vs the stock pump at the same load, carbon = deposits it leaves, oilL = oil
     burnt per 1,000 km                                                                           */
  OPT.oilMeter = {
    omp: { name: "Mechanical OMP", sub: "cap 1.00  0.5 L/1000km", info: "The factory oil metering pump: a little plunger pump linked to the throttle that squirts engine oil into the housings. Sized for the stock engine at stock boost.", cap: 1.00, carbon: 1.00, oilL: 0.5, cost: 0 },
    emop: { name: "Electronic OMP", sub: "cap 1.30  ECU metered", info: "A stepper-motor pump the ECU meters by load as well as revs, as on the RX-8: more oil under boost, less at a light cruise.", cap: 1.30, carbon: 0.85, oilL: 0.45, cost: 240, req: "shop1" },
    omp_premix: { name: "OMP + premix", sub: "cap 2.00  1:200", info: "The pump left in and two-stroke oil added to the tank at about 1:200. The seals never go short, at the price of a smokier exhaust and a little more carbon.", cap: 2.00, carbon: 1.25, oilL: 0.9, cost: 60 },
    premix: { name: "Premix only", sub: "cap 2.60  1:100", info: "Pump deleted, two-stroke oil in the fuel at 1:100: every drop of fuel carries its oil, so the seals are oiled exactly as hard as the engine is working. The race-car answer, and it smells like one.", cap: 2.60, carbon: 1.55, oilL: 1.4, cost: 30 }
  };

  /* ---- TWO-STROKE parts: only fitted when cfg.cycle is "two" ----
     cycle: the engine type. scav: how the fresh charge pushes the exhaust out (te = trapping efficiency at a
     delivery ratio of 1, flow = port flow vs a loop-scavenged barrel). induct: what lets the charge into the
     crankcase (lowK / topK = delivery below / above the port rpm, back = blow-back at low rpm). tsFuel: where the
     fuel goes in (sc = share of the short-circuited charge that carries fuel). xpipe: the exhaust (amp / w =
     the tuned pipe's resonance height / width as a fraction of its rpm, dip = the flat spot below it).        */
  OPT.cycle = {
    four: { name: "Four-stroke", sub: "fires every 2nd turn", info: "Intake, compression, power, exhaust: one power stroke for every two turns of the crank, with valves to time the gas exchange. Everything in the shop is a four-stroke unless you say otherwise.", cost: 0 },
    two: { name: "Two-stroke", sub: "fires every turn \u00b7 ports", info: "Compression and power on the way up and down, with the piston itself uncovering ports in the cylinder wall to let the exhaust out and the fresh charge in. Twice the power strokes, no valvetrain, and a fresh charge that partly runs straight out of the exhaust.", cost: 0 }
  };
  OPT.scav = {
    loop: { name: "Loop (Schn\u00fcrle)", sub: "TE .74  flat crown", info: "Transfer ports aimed away from the exhaust so the fresh charge loops up the far wall and back down, pushing the exhaust ahead of it. Every modern dirt bike and outboard is loop-scavenged.", te: 0.74, flow: 1.00, crownK: 1.00, cost: 0 },
    cross: { name: "Cross (deflector)", sub: "TE .64  hot deflector", info: "The old way: the transfers face the exhaust across the bore and a hump on the piston crown deflects the charge upward. Cheap, but the deflector runs hot, the chamber is a poor shape and more charge escapes.", te: 0.64, flow: 0.92, crownK: 1.10, on: 2.0, cost: 0 },
    uniflow: { name: "Uniflow", sub: "TE .86  exhaust valves", info: "Air enters through a ring of ports at the bottom of the liner and leaves through exhaust valves in the head (or a second piston), sweeping straight up the bore. The best scavenging there is \u2014 Detroit Diesel and Napier built empires on it \u2014 but it needs a blower to push the air through.", te: 0.86, flow: 1.06, crownK: 0.95, valves: 1, cost: 900, req: "shop1" }
  };
  OPT.induct = {
    piston: { name: "Piston port", sub: "symmetric \u00b7 blows back", info: "The piston skirt opens and closes the intake port, so the timing is the same either side of TDC. Simple, and strong at the rpm it is timed for; below that the crankcase blows fresh charge back out of the carburettor.", lowK: 0.80, topK: 1.00, back: 0.18, cost: 0 },
    reed: { name: "Reed valve", sub: "one-way \u00b7 torque", info: "Fibreglass or carbon petals that only open inward. No blow-back, so the bottom end and the midrange fill in; at the very top the petals start to flutter.", lowK: 1.00, topK: 0.96, back: 0.0, cost: 120 },
    disc: { name: "Rotary disc valve", sub: "asymmetric \u00b7 top end", info: "A slotted disc on the crank opens the intake straight into the crankcase, and the timing can be anything you cut. The 125 GP and Rotax answer: early opening, early closing, power everywhere \u2014 with the carburettor hung off the side.", lowK: 0.95, topK: 1.05, back: 0.04, cost: 450, req: "shop1" },
    blower: { name: "Roots scavenge blower", sub: "gear-driven \u00b7 air box", info: "A gear-driven Roots blower fills an air box around the liner ports, so the crankcase plays no part in it. It is what lets a two-stroke diesel breathe at all, it costs crank power to drive, and it screams.", lowK: 1.15, topK: 1.00, back: 0.0, blower: 1, cost: 2600 }
  };
  OPT.tsFuel = {
    carb: { name: "Carburettor", sub: "fuel in every leak", info: "A carburettor on the crankcase: the fuel arrives with the air, so whatever short-circuits out of the exhaust takes fuel with it. That is where a two-stroke's thirst and its blue haze come from.", sc: 1.00, cost: 0 },
    efi: { name: "Transfer-port EFI", sub: "injected \u00b7 still leaks", info: "Injectors firing into the transfer ports or the crankcase. Better metering than a carburettor, but the fuel still travels with the charge, so most of the short-circuit loss is still there.", sc: 0.85, cost: 500 },
    di: { name: "Direct injection", sub: "E-TEC / Optimax", info: "Fuel sprayed straight into the cylinder after the exhaust port has closed, so the charge that short-circuits is only air. Clean and economical \u2014 the reason the two-stroke outboard and sled survived the emission rules.", sc: 0.10, cost: 1600, req: "shop1" }
  };
  OPT.xpipe = {
    chamber: { name: "Expansion chamber", sub: "tuned \u00b7 hits on the pipe", info: "A header, a long diverging cone, a belly and a converging cone: the reflected waves suck the cylinder empty, then push the escaping charge back in just before the port closes. A big lump of power in a narrow band around the rpm it is tuned to.", amp: 0.42, w: 0.13, dip: 0.10, backP: 0.85, veBonus: 0.0, massKg: 2.6, cost: 260, db: 3 },
    straight: { name: "Straight pipe / stinger", sub: "open \u00b7 untuned", info: "A plain pipe or a short stinger: almost no back-pressure and almost no tuning. Flat, wide, very loud, and nothing like a race engine on a pipe.", amp: 0.06, w: 0.45, dip: 0.0, backP: 0.80, veBonus: 0.0, massKg: 1.0, cost: 60, db: 6 },
    muffled: { name: "Header + muffler", sub: "quiet \u00b7 stock", info: "A manifold or short header into a box muffler, as on the Saab, the Trabant and a road-going outboard. Quiet and durable; the back-pressure costs some charge at the top.", amp: 0.0, w: 0.5, dip: 0.0, backP: 1.10, veBonus: -0.02, massKg: 1.6, cost: 40, db: -4 }
  };
  OPT.pv = {
    none: { name: "No power valve", sub: "fixed exhaust port", info: "The exhaust port is where it was cut: the timing that suits the top end is the same timing the bottom end has to live with.", cost: 0 },
    fitted: { name: "Exhaust power valve", sub: "YPVS / RAVE \u00b7 wider band", info: "A guillotine or drum in the exhaust port that lowers its roof at low rpm and opens it fully on the pipe. Low-down torque from a race port timing \u2014 Yamaha's YPVS, Rotax's RAVE.", wide: 1.35, cost: 380, req: "shop1" }
  };
  OPT.lube = {
    premix: { name: "Premix", sub: "oil in the tank", info: "Two-stroke oil mixed into the fuel at a fixed ratio: the bearings, the rings and the skirt are oiled by whatever the crankcase mist leaves behind. Rich ratios smoke and foul plugs; lean ones seize.", cost: 0 },
    inject: { name: "Oil injection", sub: "pump metered by load", info: "A separate oil tank and a metering pump that feeds oil by throttle and rpm, from about 200:1 at idle to 40:1 flat out. No mixing at the pump, less smoke, and no seizure from a forgotten jerrycan.", cost: 300 }
  };

  /* ---- engine oil (kinematic viscosity at 100 C, viscosity index) ---- */
  OPT.oilGrade = {
    w0_20: { name: "0W-20 full syn", sub: "8.2 cSt@100 VI 165", info: "Thin, so the pump and the bearings waste almost nothing. The film gets marginal under heavy bearing load.", kv100: 8.2, vi: 165, hths: 2.6, fricFac: 0.93, cost: 70 },
    w5_30: { name: "5W-30 full syn", sub: "10.5 cSt@100 VI 160", info: "The modern all-rounder. Enough film for a road engine, and only a small economy penalty.", kv100: 10.5, vi: 160, hths: 3.1, fricFac: 0.96, cost: 80 },
    w10_40: { name: "10W-40 syn blend", sub: "14.0 cSt@100 VI 150", info: "What an air-cooled or hard-worked engine wants. Noticeably more drag until it is warm.", kv100: 14.0, vi: 150, hths: 3.6, fricFac: 1.00, cost: 75 },
    w15_50: { name: "15W-50 racing", sub: "18.5 cSt@100 VI 135", info: "A proper hydrodynamic film under heavy bearing load. You pay two or three percent of peak power to churn it.", kv100: 18.5, vi: 135, hths: 4.5, fricFac: 1.07, cost: 110, req: "shop1" },
    w20_50: { name: "20W-50 mineral", sub: "19.5 cSt@100 VI 125", info: "Classic thick mineral oil: enormous film strength hot, treacle cold, and it wastes real power.", kv100: 19.5, vi: 125, hths: 4.7, fricFac: 1.12, cost: 60 }
  };

  /* ---- oiling system ---- */
  OPT.oilSystem = {
    wet: { name: "Wet sump", sub: "0.9 g  windage 1.00", info: "A standard pan and pickup. Hard cornering uncovers the pickup, and the crank drags through its own oil mist.", gLimit: 0.9, windage: 1.00, cost: 0, massKg: 0 },
    baffled: { name: "Baffled sump", sub: "1.4 g  windage 0.97", info: "Trap doors and a windage tray keep oil over the pickup through corners and stop the crank whipping it back up.", gLimit: 1.4, windage: 0.97, cost: 380, massKg: 2, req: "shop1" },
    dry: { name: "Dry sump", sub: "2.5 g  windage 0.90", info: "Scavenge pumps pull the crankcase down to a partial vacuum: no windage, no surge, and a few percent more power at high revs.", gLimit: 2.5, windage: 0.90, cost: 3800, massKg: 11, req: "shop2" },
    dry_hv: { name: "Dry sump, HV pressure", sub: "2.5 g  film x1.15", info: "A dry sump with an oversized pressure stage and big feeds to the mains. More oil through every bearing carries the heat out of the film before it can thin, which is what an engine holding full load for a whole pull or a whole lap needs.", gLimit: 2.5, windage: 0.91, filmK: 1.15, cost: 5600, massKg: 13, req: "race" }
  };

  /* ---- piston cooling jets ---- */
  OPT.oilSquirters = {
    none: { name: "No oil jets", sub: "crown +0 C", info: "Nothing cools the piston from below, so the crown sheds heat through the rings and skirt alone. Fine at modest output.", crownC: 0, oilHeatKw: 0, cost: 0 },
    fitted: { name: "Piston cooling jets", sub: "crown -40 C  +oil heat", info: "Jets spray oil onto the underside of the crown, worth a serious drop in piston temperature. That heat ends up in the oil.", crownC: 40, oilHeatKw: 1.0, cost: 320, req: "shop1" }
  };

  /* ---- cooling package ---- */
  OPT.cooling = {
    std: { name: "Stock radiator", sub: "cap 1.00  ~55 kW/L", info: "The original crossflow core and a mechanical fan, sized for stock power and not much more.", cap: 1.00, cost: 0, massKg: 0 },
    uprated: { name: "Uprated 2-row", sub: "cap 1.35  + oil cooler", info: "A bigger aluminium core, a better pump and an oil cooler — about what an extra hundred horsepower asks for.", cap: 1.35, cost: 620, massKg: 5, req: "shop1" },
    race: { name: "Race cooling pack", sub: "cap 1.80  + ducting", info: "Full-width core, electric pump, ducted in and out, and a large oil cooler. Enough to run flat out continuously.", cap: 1.80, cost: 2600, massKg: 12, req: "shop2" },
    race_xl: { name: "Big race radiator", sub: "cap 2.40  +90 kW", info: "A double-thick core as big as the nose will take, twin high-flow fans and a remote expansion tank. It is sized for the car, not the engine, so it carries a small, very powerful engine through a long session.", cap: 2.40, addKw: 90, cost: 4800, massKg: 19, req: "race" },
    race_oc: { name: "Big rad + oil cooler", sub: "cap 2.60  +150 kW  oil -18C", info: "The big race radiator with a separate engine-oil cooler on its own fan and thermostat, so the oil sheds its heat to the air instead of into the coolant. The water runs cooler and the oil holds its viscosity under sustained load.", cap: 2.60, addKw: 150, oilCoolC: 18, cost: 7200, massKg: 27, req: "race" }
  };

  /* ---- exhaust ---- */
  OPT.exhaust = {
    cast_log: { name: "Cast log manifold", sub: "VE-0.04  backP 1.00", info: "Cylinders dump into a shared cast gallery and fight each other for room. Compact, quiet, indestructible, and it strangles scavenging.", veBonus: -0.04, backP: 1.00, cost: 120, massKg: 8 },
    cast_tubular: { name: "Cast tubular", sub: "VE+0.01  backP 0.86", info: "Thin-wall tubular branches of roughly equal length. The factory compromise: most of the flow, none of the cracking.", veBonus: 0.01, backP: 0.86, cost: 340, massKg: 7 },
    headers_equal: { name: "Equal-length headers", sub: "VE+0.04  backP 0.72", info: "Equal primary lengths, so every pulse reaches the collector at the same crank angle. Cleaner scavenging and a cleaner note.", veBonus: 0.04, backP: 0.72, cost: 780, massKg: 9, req: "flow" },
    headers_merge: { name: "Merge-collector 4-1", sub: "VE+0.055 backP 0.66", info: "Stepped primaries into a tapered merge: the pulse leaving one cylinder pulls a real vacuum on the next during overlap. Peaky, and worth genuine power.", veBonus: 0.055, backP: 0.66, cost: 1250, massKg: 10, req: "flow" }
  };

  /* ---- exhaust system: everything after the manifold (or the turbine). The stock pipe, the OEM muffler, no cat and no
     cutout is the system every engine here was always tested with, so it adds nothing; every other choice is a separate
     term on top of the manifold's (exhSysOf). K is the pressure loss in velocity heads at the pipe's own gas speed. ---- */
  OPT.pipe = {
    stock: { name: "Stock pipe", sub: "OEM size for the engine", info: "The factory pipe, sized for the engine it came on: about 100 m/s of exhaust at full power. It never chokes the engine you built and never flatters it either.", cost: 0, massKg: 0 },
    s225: { name: "Single 2.25\"", sub: "57 mm · one pipe", info: "The pipe under every economy car. Plenty for a 1.6 at full song; a 500 hp V8 tries to push three times the gas through it and spends its top end fighting the pipe.", dia: 2.25, runs: 1, cost: 220, massKg: 9 },
    s250: { name: "Single 2.5\"", sub: "64 mm · one pipe", info: "The usual cat-back on a sporty four or a mild six. About a quarter more area than 2.25\" for a few dollars more.", dia: 2.5, runs: 1, cost: 280, massKg: 10 },
    d250: { name: "Dual 2.5\"", sub: "2 × 64 mm", info: "One pipe per bank on a vee, or a Y-pipe split on an inline. Twice the area of a single 2.5\" and the classic V8 note.", dia: 2.5, runs: 2, cost: 620, massKg: 19, req: "shop1" },
    d300: { name: "Dual 3\"", sub: "2 × 76 mm", info: "Race-sized duals. Over 700 hp of flow before the pipe matters, and a deeper, heavier note. On a small four it is just weight and drone.", dia: 3.0, runs: 2, cost: 880, massKg: 23, req: "flow" },
    t400: { name: "4\" turbo-back", sub: "102 mm · one pipe", info: "One huge mandrel-bent pipe straight off the turbine. A turbine sees whatever the pipe after it sees, multiplied by its own pressure ratio, so on a boosted engine the downpipe is worth more than any other exhaust part.", dia: 4.0, runs: 1, cost: 760, massKg: 15, req: "boost" },
    open: { name: "Open headers", sub: "zoomies · nothing after", info: "Collector straight to the air, or short zoomie tubes turned out of the bodywork. No pipe, no muffler, no cat: the least restriction there is, the loudest engine in the pits, and no road buyer will touch it.", open: true, cost: 90, massKg: 2 }
  };
  OPT.muffler = {
    stock: { name: "OEM baffled", sub: "reverse flow · quiet", info: "Perforated tubes and reversing chambers that cancel the pulses against each other. Quiet and durable, and it costs real backpressure at full power.", K: 3.0, db: 0, cost: 0, massKg: 0 },
    chambered: { name: "Chambered", sub: "baffles · bark", info: "Angled baffles bounce the pulses into each other instead of through packing. About half the restriction of the OEM can and the hard-edged bark of every muscle car since 1990.", K: 1.5, db: 6, cost: 240, massKg: 7 },
    glasspack: { name: "Glasspack", sub: "straight-through · rasp", info: "A perforated tube wrapped in fibreglass inside a can. Nearly free-flowing, loud, and raspier every year as the packing blows out.", K: 0.45, db: 10, cost: 90, massKg: 3 },
    turbo: { name: "Turbo muffler", sub: "S-flow · deep, quiet", info: "Two or three perforated S-bends through a big oval can. Quieter than a chambered box with less restriction than the OEM one; a turbine upstream has already eaten the sharpest part of the pulse.", K: 1.1, db: 2.5, cost: 180, massKg: 8 },
    straight: { name: "Straight pipe", sub: "no muffler at all", info: "A length of tube where the muffler was. Every pulse leaves at full amplitude: free flow, a crackle on the overrun and a ticket waiting at the end of the street.", K: 0, db: 16, cost: 40, massKg: 0 }
  };
  OPT.cat = {
    none: { name: "No cat", sub: "nothing in the way", info: "No catalyst and no filter: what the engine burns is what leaves the pipe.", K: 0, db: 0, cost: 0, massKg: 0 },
    oem: { name: "OEM cat", sub: "400 cpsi ceramic", info: "A ceramic honeycomb washcoated with platinum, palladium and rhodium. Cleans up the exhaust and takes the edge off the note, at the price of a dense core in the gas path.", K: 2.0, db: -2, cost: 380, massKg: 7, fam: "si" },
    hiflow: { name: "High-flow cat", sub: "200 cpsi metal", info: "A metal-foil core with half the cells. Most of the cleanup and about a third of the restriction; the road-legal compromise on a modified engine.", K: 0.7, db: -1, cost: 520, massKg: 5, fam: "si", req: "flow" },
    dpf: { name: "DOC + DPF", sub: "smoke ≈ 0 · backpressure", info: "An oxidation cat ahead of a wall-flow particulate filter. The filter traps the soot, so the stack runs clean whatever the tune does, and burns it off every few hundred kilometres. It is the most restrictive thing in any exhaust.", K: 3.5, db: -3, smokeK: 0.04, cost: 2400, massKg: 24, fam: "ci" },
    delete: { name: "DPF delete", sub: "straight section + tune", info: "The filter replaced by a straight section and the regeneration tuned out. Flows like no filter at all and puts every bit of soot back out of the stack, which is the first thing an on-road buyer checks.", K: 0, db: 0.5, cost: 450, massKg: 0, fam: "ci", req: "shop1" }
  };
  OPT.cutout = {
    none: { name: "No cutout", sub: "one way out", info: "All the exhaust goes through the system.", cost: 0, massKg: 0 },
    closed: { name: "Cutout closed", sub: "street mode", info: "An electric butterfly valve teed off the downpipe, shut: everything still goes through the cat and muffler. This is how a road buyer will drive it.", cost: 420, massKg: 3, req: "shop1" },
    open: { name: "Cutout open", sub: "dumps at the downpipe", info: "The butterfly open: the exhaust leaves before the cat and muffler, as loud and as free as open headers. The dyno sees the power; a road buyer judges the engine with it shut.", open: true, cost: 420, massKg: 3, req: "shop1" }
  };

  /* ---- launch control (ECU) — strip only: nothing here changes a dyno pull ---- */
  OPT.launchCtl = {
    none: { name: "No launch control", sub: "right foot only", info: "The driver holds the revs with the throttle and drops the clutch. Every launch is a little different, and a turbo sits asleep on the line until the car is already moving.", cost: 0 },
    two_step: { name: "Two-step limiter", sub: "holds a launch rpm", info: "A second rev limiter that only works on the line: it cuts spark to hold the engine on one launch rpm, so every launch leaves from the same place. On its own it makes very little boost.", cost: 650, req: "shop1" },
    two_step_retard: { name: "Two-step + launch retard", sub: "builds boost on the line", info: "The two-step plus a big pull of ignition timing on the limiter. The late burn keeps the exhaust hot enough to spin the turbo up before the green, so the car leaves on boost. That heat goes straight into the turbine and manifold — a second is fine, three is asking for a crack.", cost: 1600, req: "boost" }
  };
  /* ---- brake aids (driveline) ---- */
  OPT.transBrake = {
    none: { name: "No brake aids", sub: "clutch launch", info: "A clutch and the foot brake. Burnouts are messy because the brake cannot hold the car against the rear tyres, and the launch is whatever the clutch pedal gives you.", cost: 0 },
    line_lock: { name: "Line lock", sub: "holds the front brakes", info: "A solenoid that locks the front brakes on a button, so the rear tyres can spin in the water box without the car creeping. A clean burnout puts proper heat in drag rubber.", cost: 350, req: "shop1" },
    trans_brake: { name: "Trans-brake", sub: "launch off the converter", info: "Locks the transmission in first and reverse at once, so the engine can be held at full load on the torque converter and let go with a button. No clutch to bog, the converter multiplies torque off the line, the turbo spools against the load, and the release is more consistent than any clutch foot.", cost: 2400, req: "shop2" }
  };

  /* ---- cam cover colour (cosmetic) ---- */
  OPT.cover = {
    red: { name: "Crackle red", sub: "wrinkle finish", info: "Wrinkle-coat red, the traditional performance cam cover. Purely cosmetic.", hex: "#c0392b", cost: 60 },
    black: { name: "Satin black", sub: "powder coat", info: "Powder-coated satin black. Hides heat staining better than anything else.", hex: "#23262b", cost: 50 },
    orange: { name: "Competition orange", sub: "gloss finish", info: "High-gloss orange. Cosmetic only, though it does make the engine easier to find in the dark.", hex: "#e2761b", cost: 60 },
    blue: { name: "Ford blue", sub: "gloss enamel", info: "Gloss enamel blue, the classic OEM engine colour. Cosmetic only.", hex: "#2b6cb0", cost: 50 },
    silver: { name: "Cast silver", sub: "as-cast look", info: "Bead-blasted natural aluminium. Cosmetic; it does radiate a fraction more heat than paint.", hex: "#adb5bd", cost: 40 },
    gold: { name: "Gold irridite", sub: "thermal barrier", info: "Gold irridite / thermal-barrier wrap look. Cosmetic, with a nod to reflective heat shielding.", hex: "#c9a227", cost: 120 }
  };

  /* =====================================================================
     3.  FORM — the UI description. Every cfg key appears exactly once.
     ===================================================================== */
  const f1 = (v) => v.toFixed(1);
  const f2 = (v) => v.toFixed(2);
  const fq = (v) => { const t = v.toFixed(2); return t.endsWith("0") ? t.slice(0, -1) : t; }; // 83.0 / 83.25 / 83.5
  const isBoosted = (c) => c.asp !== "na";
  const isTurbo = (c) => OPT.asp[c.asp].kind === "turbo";
  /* compression ignition: every diesel branch in the physics hangs off this */
  function isDiesel(c) { const f = c && OPT.fuel[c.fuel]; return !!(f && f.ci); }
  function isRotary(c) { const L = c && LAYOUTS[c.layout]; return !!(L && L.rotary); }
  const notRotary = (c) => !isRotary(c);
  /* two-stroke: the cycle key, never on a Wankel. tsValves: uniflow (exhaust valves in the head); tsCase: the crankcase is the
     scavenge pump (no blower), so it holds no oil and premix or an oil pump lubricates it */
  function isTwoStroke(c) { return !!(c && c.cycle === "two" && !isRotary(c)); }
  const tsValves = (c) => isTwoStroke(c) && c.scav === "uniflow" && !(LAYOUTS[c.layout] || {}).opposed;   // opposed pistons: no valves at all
  const tsCase = (c) => isTwoStroke(c) && c.induct !== "blower";
  const fourPiston = (c) => !isRotary(c) && !isTwoStroke(c);
  const notTwoStroke = (c) => !isTwoStroke(c), notTsCase = (c) => !tsCase(c);
  const pistonValves = (c) => !isRotary(c) && (!isTwoStroke(c) || tsValves(c));
  /* MORE FUELS: gaseous fuels (propane, CNG) and the flex blend. fuelOf() is the fuel the engine actually burns:
     the table entry, or for flex the pump-91 / E85 blend at cfg.ethanolPct (E85 when it is unset). */
  function isGas(c) { const f = c && OPT.fuel[c.fuel]; return !!(f && f.gas); }
  const FLEX_DEF = 85;
  function flexBlend(pct) {
    const a = OPT.fuel.r91, b = OPT.fuel.e85, v = clamp((pct == null || !isFinite(+pct) ? FLEX_DEF : +pct) / 85, 0, 1);
    const m = v * 0.782 / (v * 0.782 + (1 - v) * 0.745);      // mass fraction of the E85 part: AFR, energy and latent heat mix by mass
    const k = 1 - Math.pow(1 - v, 1.5);                        // octane is not linear: the first splash of ethanol buys the most
    const L = (x, y, t) => x + (y - x) * t;
    return Object.assign({}, OPT.fuel.flex, { ePct: Math.round(v * 85), ron: L(a.ron, b.ron, k), mon: L(a.mon, b.mon, k),
      afr: L(a.afr, b.afr, m), lhv: L(a.lhv, b.lhv, m), hov: L(a.hov, b.hov, m), gamma: L(a.gamma, b.gamma, m),
      dens: L(0.745, 0.782, v), corrosive: L(0, b.corrosive, v), costL: Math.round(L(a.costL, b.costL, v) * 100) / 100 });
  }
  function fuelOf(c) { const f = OPT.fuel[c && c.fuel]; return f && f.flex ? flexBlend(c.ethanolPct) : f; }
  /* pump E85 is not always 85%: the winter blend can be fifteen points weaker (E70); a blender-pump mix wanders less */
  function flexWinterPct(pct) { pct = pct == null || !isFinite(+pct) ? FLEX_DEF : +pct; return pct >= 51 ? Math.max(51, pct - 15) : Math.max(0, pct - 5); }
  /* propane vapour pressure, bar absolute: what pushes it out of the tank (8.2 bar at 20 \u00b0C, 1 bar at its -42 \u00b0C boiling point) */
  function propaneBar(tC) { return Math.exp(10.33 - 2410 / (tC + 273.15)); }

  const FORM = [
    {
      title: "Engine layout", fields: [
        { key: "layout", type: "seg", label: "Layout", optTable: "layout" },
        { key: "cycle", type: "seg", label: "Cycle", optTable: "cycle", showIf: notRotary }
      ]
    },
    {
      title: "Bore & stroke", titleIf: c => isRotary(c) ? "Rotor geometry" : null, fields: [
        { key: "bore", type: "slider", label: "Bore", labelIf: c => isRotary(c) ? "Rotor width B" : null, min: 68, max: 110, minIf: c => isRotary(c) ? 50 : isTwoStroke(c) ? 38 : 68, maxIf: c => isRotary(c) ? 100 : OPT.blockMat[c.blockMat].billet ? 122 : (isDiesel(c) && (c.blockMat === "grey_iron" || c.blockMat === "cgi" || c.blockMat === "cgi_filled")) ? 140 : 110, step: 0.25, nudge: 0.25, unit: "mm", fmt: fq },
        { key: "stroke", type: "slider", label: "Stroke", labelIf: c => isRotary(c) ? "Generating radius R" : null, min: 58, max: 120, minIf: c => isRotary(c) ? 85 : isTwoStroke(c) ? 38 : 58, maxIf: c => isRotary(c) ? 125 : isTwoStroke(c) && isDiesel(c) ? 200 : OPT.blockMat[c.blockMat].billet ? 122 : (isDiesel(c) && (c.blockMat === "grey_iron" || c.blockMat === "cgi" || c.blockMat === "cgi_filled")) ? 180 : 120, step: 0.25, nudge: 0.25, unit: "mm", fmt: fq },
        { key: "ecc", type: "slider", label: "Eccentricity e", min: 11, max: 19, step: 0.25, nudge: 0.25, unit: "mm", fmt: fq, showIf: isRotary },
        { key: "rodRatio", type: "slider", label: "Rod ratio L/r", min: 1.45, max: 2.10, step: 0.01, nudge: 0.01, unit: "", fmt: f2, showIf: notRotary },
        { key: "cr", type: "slider", label: "Compression ratio", labelIf: c => isTwoStroke(c) && !isDiesel(c) ? "Trapped compression ratio" : null, min: 7, max: 15, minIf: c => isDiesel(c) ? 14 : isTwoStroke(c) ? 5.5 : 7, maxIf: c => isDiesel(c) ? 24 : isRotary(c) ? 11.5 : isTwoStroke(c) ? 12 : 15, step: 0.25, nudge: 0.25, unit: ":1", fmt: fq },
        { key: "ccr", type: "slider", label: "Crankcase compression", min: 1.15, max: 1.70, step: 0.01, nudge: 0.01, unit: ":1", fmt: f2, showIf: tsCase }
      ]
    },
    {
      title: "Rotors & housings", fields: [
        { key: "rotHousing", type: "seg", label: "Rotor housings", optTable: "rotHousing", showIf: isRotary },
        { key: "sidePlate", type: "seg", label: "Side housings", optTable: "sidePlate", showIf: isRotary },
        { key: "apexSeal", type: "seg", label: "Apex seals", optTable: "apexSeal", showIf: isRotary },
        { key: "eshaft", type: "seg", label: "Eccentric shaft", optTable: "eshaft", showIf: isRotary }
      ]
    },
    {
      title: "Block & head materials", fields: [
        { key: "blockMat", type: "seg", label: "Block material", optTable: "blockMat", showIf: notRotary },
        { key: "deck", type: "seg", label: "Deck construction", optTable: "deck", showIf: (c) => !isRotary(c) && (c.blockMat === "alu_liners" || c.blockMat === "alu_nikasil") },
        { key: "headMat", type: "seg", label: "Head material", optTable: "headMat", showIf: notRotary },
        { key: "head", type: "seg", label: "Valvetrain layout", optTable: "head", showIf: fourPiston }
      ]
    },
    {
      title: "Pistons & rings", fields: [
        { key: "piston", type: "seg", label: "Piston alloy", optTable: "piston", showIf: notRotary },
        { key: "pistonClearance", type: "seg", label: "Piston clearance", optTable: "pistonClearance", showIf: notRotary },
        { key: "rings", type: "seg", label: "Ring pack", optTable: "rings", showIf: notRotary }
      ]
    },
    {
      title: "Rods & crank", titleIf: c => isRotary(c) ? "Bearings" : null, fields: [
        { key: "rod", type: "seg", label: "Connecting rods", optTable: "rod", showIf: notRotary },
        { key: "rodBolts", type: "seg", label: "Rod bolts", optTable: "rodBolts", showIf: notRotary },
        { key: "crank", type: "seg", label: "Crankshaft", optTable: "crank", showIf: notRotary },
        { key: "damper", type: "seg", label: "Torsional damper", optTable: "damper", showIf: notRotary },
        { key: "bearings", type: "seg", label: "Main/rod bearings", labelIf: c => isRotary(c) ? "Rotor & main bearings" : null, optTable: "bearings" }
      ]
    },
    {
      title: "Valvetrain", titleIf: c => isRotary(c) ? "Porting & revs" : isTwoStroke(c) ? (tsValves(c) ? "Ports, exhaust valves & revs" : "Ports & revs") : null, fields: [
        { key: "valveMat", type: "seg", label: "Valve material", labelIf: c => tsValves(c) ? "Exhaust valve material" : null, optTable: "valveMat", showIf: pistonValves },
        { key: "springs", type: "seg", label: "Valve springs", optTable: "springs", showIf: pistonValves },
        { key: "cam", type: "slider", label: "Cam duration / overlap", min: 0, max: 100, maxIf: c => OPT.head[c.head].camMax || 100, step: 1, nudge: 1, unit: "", fmt: (v) => String(Math.round(v)), showIf: fourPiston },
        { key: "lift", type: "slider", label: "Valve lift", min: 0, max: 100, step: 1, nudge: 1, unit: "", fmt: (v) => String(Math.round(v)), showIf: fourPiston },
        { key: "rotPort", type: "seg", label: "Intake porting", optTable: "rotPort", showIf: isRotary },
        { key: "scav", type: "seg", label: "Scavenging", optTable: "scav", showIf: isTwoStroke },
        { key: "ePort", type: "slider", label: "Exhaust port duration", labelIf: c => tsValves(c) ? "Exhaust valve duration" : null, min: 110, max: 210, step: 1, nudge: 1, unit: "\u00b0", fmt: (v) => String(Math.round(v)), showIf: isTwoStroke },
        { key: "tPort", type: "slider", label: "Transfer port duration", labelIf: c => tsValves(c) ? "Intake port duration" : null, min: 90, max: 145, step: 1, nudge: 1, unit: "\u00b0", fmt: (v) => String(Math.round(v)), showIf: isTwoStroke },
        { key: "pv", type: "seg", label: "Power valve", optTable: "pv", showIf: (c) => isTwoStroke(c) && !tsValves(c) },
        { key: "redline", type: "slider", label: "Redline", min: 4000, max: 12500, minIf: c => isDiesel(c) ? (isTwoStroke(c) ? 1200 : 1800) : 4000, step: 100, nudge: 100, unit: "rpm", fmt: (v) => String(Math.round(v)) }
      ]
    },
    {
      title: "Induction & boost", fields: [
        { key: "intake", type: "seg", label: "Intake system", optTable: "intake", showIf: notTwoStroke },
        { key: "induct", type: "seg", label: "Induction", optTable: "induct", showIf: isTwoStroke },
        { key: "tsFuel", type: "seg", label: "Fuel delivery", optTable: "tsFuel", showIf: (c) => isTwoStroke(c) && !isDiesel(c) && !isGas(c) },
        { key: "asp", type: "seg", label: "Aspiration", optTable: "asp" },
        { key: "boost", type: "slider", label: "Boost pressure", min: 0.2, max: 3.5, step: 0.05, nudge: 0.05,
          maxIf: c => isDiesel(c) ? (OPT.asp[c.asp].compound ? 7.5 : 5.5) : (OPT.turboSize[c.turboSize].maxFlow >= 100 || OPT.asp[c.asp].compound || OPT.asp[c.asp].kind === "screw") ? 5.5 : 5.0,
          unit: "bar", fmt: f2, showIf: isBoosted },
        { key: "turboSize", type: "seg", label: "Turbo size", optTable: "turboSize", showIf: (c) => isBoosted(c) && (OPT.asp[c.asp].kind === "turbo" || OPT.asp[c.asp].kind === "centrifugal") },
        { key: "turbineMat", type: "seg", label: "Hot-side material", optTable: "turbineMat", showIf: (c) => isBoosted(c) && OPT.asp[c.asp].kind === "turbo" },
        { key: "turbine", type: "seg", label: "Turbine geometry", optTable: "turbine", showIf: (c) => isBoosted(c) && OPT.asp[c.asp].kind === "turbo" },
        { key: "als", type: "seg", label: "Anti-lag", optTable: "als", showIf: (c) => isBoosted(c) && OPT.asp[c.asp].kind === "turbo" && !isDiesel(c) },
        { key: "ic", type: "seg", label: "Charge cooler", optTable: "ic", showIf: isBoosted },
        { key: "exhaust", type: "seg", label: "Exhaust manifold", optTable: "exhaust", showIf: notTwoStroke }
      ]
    },
    {
      title: "Exhaust system", fields: [
        { key: "xpipe", type: "seg", label: "Two-stroke exhaust", optTable: "xpipe", showIf: isTwoStroke },
        { key: "pipeRpm", type: "slider", label: "Pipe tuned to", min: 1500, max: 13500, minIf: c => isDiesel(c) ? 1200 : 3000, step: 100, nudge: 100, unit: "rpm", fmt: (v) => String(Math.round(v)), showIf: (c) => isTwoStroke(c) && c.xpipe === "chamber" },
        { key: "pipe", type: "seg", label: "Pipe size", optTable: "pipe" },
        { key: "muffler", type: "seg", label: "Muffler", optTable: "muffler", showIf: (c) => c.pipe !== "open" },
        { key: "cat", type: "seg", label: "Catalyst", labelIf: c => isDiesel(c) ? "Diesel aftertreatment" : null, optTable: "cat", showIf: (c) => c.pipe !== "open" },
        { key: "cutout", type: "seg", label: "Electric cutout", optTable: "cutout", showIf: (c) => c.pipe !== "open" }
      ]
    },
    {
      title: "Fuel & tune", fields: [
        { key: "fuel", type: "seg", label: "Fuel", optTable: "fuel" },
        { key: "ethanolPct", type: "slider", label: "Ethanol content (sensor)", min: 0, max: 85, step: 1, nudge: 1, unit: "", fmt: (v) => "E" + Math.round(v == null ? 85 : v), showIf: (c) => c.fuel === "flex" },
        { key: "gasSys", type: "seg", label: "Gas system", optTable: "gasSys", showIf: isGas },
        { key: "dInj", type: "seg", label: "Injection system", optTable: "dInj", showIf: isDiesel },
        { key: "dNoz", type: "seg", label: "Injector nozzles", optTable: "dNoz", showIf: isDiesel },
        { key: "injectors", type: "seg", label: "Injectors", optTable: "injectors", showIf: (c) => (isTwoStroke(c) ? c.tsFuel !== "carb" : c.intake !== "carb") && !isDiesel(c) && !isGas(c) },
        { key: "fuelPump", type: "seg", label: "Fuel pump", optTable: "fuelPump", showIf: (c) => !isGas(c) },
        { key: "nitrous", type: "seg", label: "Nitrous", optTable: "nitrous" },
        { key: "timing", type: "slider", label: "Ignition vs MBT", labelIf: c => isDiesel(c) ? "Injection timing vs optimal" : isTwoStroke(c) ? "CDI timing vs MBT" : null, min: -10, max: 15, step: 0.25, nudge: 0.25, unit: "°", fmt: fq },
        { key: "lambda", type: "slider", label: "Lambda", labelIf: c => isDiesel(c) ? "Full-load \u03bb (smoke limit)" : null, min: 0.75, max: 1.05, minIf: c => isDiesel(c) ? 1.05 : 0.75, maxIf: c => isDiesel(c) ? 2.4 : 1.05, step: 0.01, nudge: 0.01, unit: "λ", fmt: f2 }
      ]
    },
    {
      title: "Launch control", fields: [
        { key: "launchCtl", type: "seg", label: "Launch control", optTable: "launchCtl" },
        { key: "twoStepRpm", type: "slider", label: "Two-step rpm", min: 2000, max: 12500, maxIf: c => Math.max(2000, c.redline), step: 100, nudge: 100, unit: "rpm", fmt: (v) => String(Math.round(v)), showIf: (c) => c.launchCtl && c.launchCtl !== "none" },
        { key: "launchRetard", type: "slider", label: "Launch retard", min: 0, max: 35, step: 1, nudge: 1, unit: "°", fmt: (v) => String(Math.round(v)), showIf: (c) => c.launchCtl === "two_step_retard" },
        { key: "transBrake", type: "seg", label: "Brake aids", optTable: "transBrake" }
      ]
    },
    {
      title: "Lubrication & cooling", fields: [
        { key: "oilGrade", type: "seg", label: "Oil grade", optTable: "oilGrade", showIf: notTsCase },
        { key: "oilSystem", type: "seg", label: "Oil system", optTable: "oilSystem", showIf: notTsCase },
        { key: "oilSquirters", type: "seg", label: "Piston cooling jets", optTable: "oilSquirters", showIf: (c) => notRotary(c) && !tsCase(c) },
        { key: "lube", type: "seg", label: "Two-stroke oiling", optTable: "lube", showIf: tsCase },
        { key: "premix", type: "slider", label: "Premix ratio", min: 16, max: 120, step: 1, nudge: 1, unit: ":1", fmt: (v) => String(Math.round(v)), showIf: (c) => tsCase(c) && c.lube !== "inject" },
        { key: "oilMeter", type: "seg", label: "Seal oiling", optTable: "oilMeter", showIf: isRotary },
        { key: "cooling", type: "seg", label: "Cooling package", optTable: "cooling" }
      ]
    },
    {
      title: "Sealing", fields: [
        { key: "gasket", type: "seg", label: "Head gasket", optTable: "gasket", showIf: notRotary },
        { key: "studs", type: "seg", label: "Head fasteners", optTable: "studs", showIf: notRotary }
      ]
    },
    {
      title: "Finish", fields: [
        { key: "cover", type: "swatch", label: "Cam cover", labelIf: c => isRotary(c) ? "Front cover & intake" : null, optTable: "cover" }
      ]
    }
  ];

  /* =====================================================================
     4.  Defaults
     ===================================================================== */
  for (const tbl in OPT) for (const k in OPT[tbl]) if (OPT[tbl][k] && typeof OPT[tbl][k] === "object") OPT[tbl][k]._id = tbl + ":" + k;

  const DEFAULT_CFG = {
    layout: "I4", bore: 83.0, stroke: 83.1, rodRatio: 1.72, cr: 10.2,
    blockMat: "grey_iron", deck: "open", headMat: "iron", head: "sohc2v",
    valveMat: "steel", springs: "single", cam: 40, lift: 60, redline: 6000,
    piston: "cast_alu", pistonClearance: "standard", rings: "moly",
    rod: "pm_forged", rodBolts: "oem", crank: "cast_nodular", damper: "rubber",
    bearings: "bimetal", gasket: "composite", studs: "bolts_tty",
    intake: "single_tb", asp: "na", turboSize: "medium", turbineMat: "cast_iron",
    ic: "none", boost: 0.6, nitrous: "none", fuel: "r91", timing: 0, lambda: 0.93,
    injectors: "i240", fuelPump: "p190", dInj: "rotary_ve", dNoz: "stock",
    oilGrade: "w5_30", oilSystem: "wet", oilSquirters: "none",
    cooling: "std", exhaust: "cast_tubular", cover: "black",
    launchCtl: "none", twoStepRpm: 4000, launchRetard: 20, transBrake: "none",
    ecc: 15, rotPort: "side", apexSeal: "oem3", rotHousing: "chrome", sidePlate: "iron", eshaft: "stock", oilMeter: "omp",
    pipe: "stock", muffler: "stock", cat: "none", cutout: "none",
    turbine: "fixed", als: "off",
    cycle: "four", scav: "loop", induct: "reed", tsFuel: "carb", xpipe: "chamber", pipeRpm: 8000, ePort: 185, tPort: 125, pv: "none", lube: "premix", premix: 40, ccr: 1.40
  };

  const DEFAULT_ENV = {
    ambientC: 20, altitudeM: 500, humidity: 40, coolantC: 90, oilC: 100,
    testType: "pull", hours: 50, loadProfile: "mixed",
    mass: 1400, rearBias: 0.55, tyre: "street", tyreDia: 27, gears: 4, first: 2.9, top: 1.0, final: 3.7, launchRpm: 3500, shiftRpm: 0, shiftMode: "auto", body: "street", chute: "no", race: "heads"
  };

