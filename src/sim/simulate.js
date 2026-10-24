  /* =====================================================================
     5.  Atmosphere
     ===================================================================== */
  // ISA pressure lapse, then Buck saturation vapour pressure for humidity.
  function ambient(env) {
    const T = (env.ambientC || 0) + 273.15;
    const p = 101325 * Math.pow(1 - 2.25577e-5 * (env.altitudeM || 0), 5.25588);
    // Buck equation, Pa
    const pSat = 611.21 * Math.exp((18.678 - env.ambientC / 234.5) * (env.ambientC / (257.14 + env.ambientC)));
    const pv = clamp((env.humidity || 0) / 100, 0, 1) * pSat;
    const pd = p - pv;
    const rho = pd / (R_AIR * T) + pv / (R_VAP * T);   // humid air is LESS dense
    return { p: p, pd: pd, pv: pv, T: T, rho: rho, Tc: env.ambientC };
  }

  // SAE J1349 correction to 25 C / 99 kPa dry
  function j1349(pd, Tc) {
    const cf = 1.18 * ((99000 / pd) * Math.sqrt((Tc + 273.15) / 298.15)) - 0.18;
    return clamp(cf, 0.80, 1.70);
  }

  /* =====================================================================
     6.  Geometry
     ===================================================================== */
  function geometry(cfg) {
    const L = LAYOUTS[cfg.layout] || LAYOUTS.I4;
    if (L.rotary) return rotGeometry(cfg, L);
    const b = cfg.bore, s = cfg.stroke;
    const Ap = PI / 4 * b * b / 1e6;             // piston area, m^2
    const Vcyl = Ap * (s / 1000);                // m^3 per cylinder
    const Vd = Vcyl * L.n;                       // m^3
    const r = s / 2000;                          // crank radius, m
    const rodLen = r * cfg.rodRatio * 2;         // rod length, m (rodRatio = l/s ... see note)
    // rodRatio here is l/crank-radius convention normalised: l = rodRatio * stroke
    const l = (s / 1000) * cfg.rodRatio;
    if (isTwoStroke(cfg)) {   // every cylinder fires every turn: Vd is the four-stroke equivalent, VdNom the swept volume quoted
      const k = L.opposed ? 2 : 1;   // opposed pistons: two pistons share each cylinder
      return { L: L, b: b, s: s, Ap: Ap, Vcyl: Vcyl * k, Vd: 2 * Vd * k, VdNom: Vd * k, r: r, l: l, lam: r / l, ts: true };
    }
    return { L: L, b: b, s: s, Ap: Ap, Vcyl: Vcyl, Vd: Vd, r: r, l: l, lam: r / l };
  }

  /* =====================================================================
     7.  Volumetric efficiency
         VE = plateau * f_cam(rpm) * f_mach(Z) * f_runner(rpm)
         Z is the inlet Mach index (Taylor):  Z = Ap*MPS / (Cd*Aeff*a)
     ===================================================================== */
  function veModel(cfg, g, hd, ink, exh) {
    const dv = hd.kv * g.b / 1000;                       // intake valve dia, m
    const nIV = hd.nIV;
    const liftRatio = 0.145 + (cfg.lift / 100) * 0.20;   // L/D 0.145 .. 0.345
    // Discharge coefficient of a poppet valve against L/D: rises fast to about
    // L/D 0.25 where the seat stops being the restriction, then flattens as the
    // port takes over.  Aeff is the real effective flow area, Cd included.
    const cf = 0.70 * (1 - Math.exp(-6.2 * liftRatio));
    const Aeff = nIV * (PI / 4 * dv * dv) * cf;
    const plateau = clamp(hd.veBase + ink.veBonus + exh.veBonus, 0.60, 1.22);
    const rpmCam = isDiesel(cfg) ? 0.7 * (2550 + cfg.cam * 64) : 2550 + cfg.cam * 64;   // rpm the cam timing is centred on (a diesel's lives low)
    return { dv: dv, Aeff: Aeff, plateau: plateau, rpmCam: rpmCam, liftRatio: liftRatio };
  }

  const K_VE = 1.0;
  // Boosted engines always carry residual dilution from exhaust backpressure and
  // always run retarded of MBT to hold peak pressure down; the amount grows only
  // weakly with boost because bigger turbines and better charge cooling offset it.
  const K_TRAP0 = 0.120, K_TRAP1 = 0.045;
  const K_PHASE0 = 3.0, K_PHASE1 = 1.6;
  function veAt(rpm, cfg, g, vm, ink, hd, chargeK, bBar) {
    const mps = 2 * (g.s / 1000) * rpm / 60;
    const a = 20.05 * Math.sqrt(chargeK);                // speed of sound in charge, m/s
    const Z = (g.Ap * mps) / (vm.Aeff * a);              // inlet Mach index
    const fMach = 1 / (1 + Math.pow(Z / 0.648, 3.4));
    // cam: asymmetric — a big cam bleeds cylinder charge back at low rpm (overlap)
    const x = rpm / vm.rpmCam;
    const wLo = 1.30 - (cfg.cam / 100) * 0.72;
    const wHi = 1.16;
    const w = x < 1 ? wLo : wHi;
    const fCam = Math.exp(-0.5 * sq((x - 1) / w));
    // runner / plenum Helmholtz resonance
    const ampEff = ink.amp / (1 + 1.2 * (bBar || 0));
    const fRun = 1 + ampEff * Math.exp(-0.5 * sq((rpm - ink.rTune) / (0.30 * ink.rTune)));
    // VVT/VVL widen the useful band by re-phasing (or swapping) the lobe
    let widen = 1;
    if (hd.vvl) widen = 1 + 0.11 * (1 - fCam);
    else if (hd.vvt) widen = 1 + 0.065 * (1 - fCam);
    // a diesel has no throttle, almost no overlap and runs boost above drive pressure, so it keeps no extra residual
    const trap = (bBar > 0.001 && !isDiesel(cfg)) ? 1 / (1 + K_TRAP0 * clamp(bBar / 0.5, 0, 1) + K_TRAP1 * bBar) : 1;
    return clamp(vm.plateau * fCam * fMach * fRun * widen * trap * K_VE, 0.15, 1.30);
  }

  /* =====================================================================
     8.  Boost model
     ===================================================================== */
  function boostModel(cfg, g) {
    const asp = OPT.asp[cfg.asp], ts = OPT.turboSize[cfg.turboSize];
    const VdL = g.Vd * 1000;
    if (asp.kind === "na") return { kind: "na", spool: 0, target: 0, asp: asp, ts: ts, units: 1, compound: 0 };
    const units = asp.units || 1;
    const compound = asp.compound ? 1 : 0;
    // spool point: turbine has to be fed by exhaust mass flow, which scales with Vd*rpm
    let spool = 2150 * ts.spoolFac * Math.pow(2.0 / Math.max(0.5, VdL), 0.48);
    if (isDiesel(cfg)) spool *= 0.75;                     // unthrottled: full exhaust mass flow from just off idle
    if (units === 2) spool *= 0.78;                       // half the flow per unit
    if (isRotary(cfg)) spool *= (units === 2 && !compound) ? 0.86 : 0.92;   // a valveless port dumps a hot, sharp pulse; rotary twins run in sequence
    if (compound) spool *= 0.70;                          // the small stage lights first
    spool *= Math.pow(1 + cfg.boost * 0.30, 0.55);         // more boost = later spool
    if (cfg.turbine === "vgt" && asp.kind === "turbo") {     // vanes shut: a small fast turbine at low flow; open: the big housing's choke point
      const spool0 = clamp(spool, 1200, 7000);
      return { kind: asp.kind, spool: clamp(spool * (isDiesel(cfg) ? 0.70 : 0.78), 900, 7000), spool0: spool0, vgt: 1, target: cfg.boost, asp: asp, ts: ts, units: units, compound: compound, seq: false };
    }
    return { kind: asp.kind, spool: clamp(spool, 1200, 7000), target: cfg.boost, asp: asp, ts: ts, units: units, compound: compound, seq: isRotary(cfg) && units === 2 && !compound };
  }

  function boostAt(rpm, bm, cfg, g) {
    if (bm.kind === "na") return 0;
    const red = cfg.redline;
    if (bm.kind === "roots") {
      // positive displacement: full boost from just off idle, tapers as the rotors
      // run out of adiabatic efficiency at high speed
      const ramp = clamp((rpm - 900) / 900, 0, 1);
      return bm.target * ramp * (1 - 0.13 * clamp((rpm - 0.62 * red) / red, 0, 1));
    }
    if (bm.kind === "screw") {
      // internal compression: the rotors hold their efficiency, so the curve stays flat
      const ramp = clamp((rpm - 800) / 700, 0, 1);
      return bm.target * ramp * (1 - 0.04 * clamp((rpm - 0.75 * red) / red, 0, 1));
    }
    if (bm.kind === "centrifugal") {
      // impeller pressure rise goes with tip speed squared -> rpm^2
      return bm.target * clamp(sq(rpm / red), 0, 1);
    }
    // turbo: first-order lag on turbine energy, then compressor choke roll-off
    let b = bm.target * (1 - Math.exp(-3.0 * Math.pow(rpm / bm.spool, 2.2)));
    const chokeRpm = (bm.vgt ? bm.spool0 * 1.06 : bm.spool) * (2.55 * bm.ts.chokeFac) * (bm.seq ? 1.45 : 1);   // open vanes flow a touch more than the fixed housing; sequential: the second turbo carries the top end
    if (rpm > chokeRpm) b *= clamp(1 - 0.55 * sq((rpm - chokeRpm) / (1.5 * chokeRpm)), 0.30, 1);
    if (bm.seq) b *= 1 - 0.07 * Math.exp(-sq((rpm - 1.9 * bm.spool) / (0.12 * bm.spool)));   // sequential changeover: the second turbo is brought in
    return Math.max(0, b);
  }

  /* =====================================================================
     9.  Global calibration constants (tuned against the preset engines'
         published crank output — see sim_test.js)
     ===================================================================== */
  const K_QUAL   = 0.870;   // indicated efficiency as a fraction of ideal Otto
  const FM_C     = 0.35;    // Chen-Flynn constant term          [bar]
  const FM_P     = 0.005;   // Chen-Flynn peak-pressure term     [bar/bar]
  const FM_S     = 0.090;   // Chen-Flynn mean-piston-speed term [bar/(m/s)]
  const FM_S2    = 0.0009;  // Chen-Flynn MPS^2 term  (S2/S puts the crossover
                            //   at 100 m/s, not 10 - friction must not go as rpm^2)
  const K_PMAX   = 1.40;    // Pmax = K_PMAX * IMEP * sqrt(CR)
  const K_CROWN  = 21.9;    // crown temperature rise coefficient
  const CP_AIR   = 1005;    // J/kg/K
  const K_FUEL   = 1.30;    // fuel flow per unit of modelled air: real WOT BSFC (cylinder spread,
                            //   wall film, transient enrichment) - ~0.5 lb/hp/h NA petrol

  function ottoEta(cr, gamma) { return 1 - Math.pow(cr, 1 - gamma); }

  /* ---- compression ignition ----
     A diesel never throttles the air: load is the amount of fuel, so lambda swings
     from ~1.2 at full load to 3+ at a cruise. It burns well only with spare air
     (droplets need oxygen around them), its heat release stretches with the fuel
     quantity (the cut-off), and it lights after an ignition delay that is fixed in
     milliseconds, so it costs more crank degrees the faster the engine turns.      */
  const K_DSL   = 1.00;    // diesel indicated efficiency vs ideal (heat loss, mixing-controlled burn)
  const K_FUEL_D = 1.04;   // diesel fuel per unit of modelled air (cylinder-to-cylinder spread only)
  const DSL_RETURN = 1.8;  // a diesel lift pump also feeds the pump's return/cooling flow
  const DSL_CLAMP = 1.6;   // diesel heads are drawn down by M14-class bolts, not M11
  const DSL_GASKET = 1.3;  // a diesel gasket of the same type carries a wider steel fire ring
  function etaCombD(lambda, bonus) {
    const short = Math.max(0, 1.5 - lambda);
    // very lean (a light cruise) the flame is cold and wall-quenched: slow, incomplete burn
    return clamp(0.98 - 1.556 * short * short + (bonus || 0), 0.30, 0.995) / (1 + 0.05 * Math.pow(Math.max(0, lambda - 2.0), 1.3));
  }
  /* cranking compression temperature against what the fuel needs to light */
  function coldStart(cfg, ambientC) {
    const fu = OPT.fuel[cfg.fuel], di = OPT.dInj[cfg.dInj] || OPT.dInj.rotary_ve;
    const T2C = (ambientC + 273.15) * Math.pow(cfg.cr, 0.30) - 273.15
      + 30 * di.pilot - (di.kind === "unit" ? 20 : 0);       // pilot shots warm the chamber; HEUI cranks on cold, thick oil
    const needC = 300 - 3 * ((fu.cetane || 48) - 48);
    const gel = 0.012 * Math.max(0, (fu.cloudC != null ? fu.cloudC : -12) - ambientC);
    return { util: Math.max(0.05, 1 + (needC - T2C) / 80 + gel), T2C: T2C, needC: needC, gel: gel };
  }

  /* Fuel evaporative charge cooling (port injection: ~55% evaporates upstream) */
  function evapCoolK(fu, lambda) {
    const fuelPerAir = 1 / (fu.afr * lambda);
    return 0.55 * fu.hov * fuelPerAir / CP_AIR;
  }

  /* Fuel delivery. Fuel density in kg/L (methanol / E85 / petrol). A pump pushes against
     base pressure plus boost, so an in-tank pump flows less as boost rises; a belt pump
     flows with engine speed. Past the knee an injector is all but static (or the rail
     pressure sags) and the extra fuel the tune asks for never arrives.            */
  function fuelDensity(fu) { return fu.dens ? fu.dens : fu.afr < 8 ? 0.792 : fu.afr < 12 ? 0.782 : 0.745; }
  function pumpLphAt(fp, rpm, bBar) {
    return fp.lph * (fp.rpmRef ? clamp(rpm / fp.rpmRef, 0.15, 1.5) : 1) * clamp(1 - fp.dropBar * Math.max(0, bBar), 0.3, 1);
  }
  function deliveredFrac(x, knee) {
    if (x <= knee) return 1;
    return (knee + (1 - knee) * (1 - Math.exp(-(x - knee) / (1 - knee)))) / x;
  }
  const INJ_KNEE = 0.88, PUMP_KNEE = 0.95;     // where delivery starts to fall behind demand
  const INJ_MAX = 0.90, PUMP_MAX = 0.95;       // test limits: duty and pump load

  /* Combustion efficiency vs lambda: best power near 0.87, best economy lean */
  function etaComb(lambda) {
    if (lambda >= 1) return clamp(0.985 - 0.14 * (lambda - 1), 0.90, 0.99);
    return clamp(0.985 - 0.534 * (1 - lambda) - 2.0 * sq(1 - lambda), 0.55, 0.99);
  }

  /* Oil kinematic viscosity at temperature (Walther-style proxy) */
  function kvAt(oil, tempC) {
    const k = 0.030 - oil.vi * 0.00006;
    return oil.kv100 * Math.exp(k * (100 - tempC));
  }

  /* ---- tune map: an rpm x load table (rows = load %, columns = rpm) that replaces the single
     timing / lambda values, plus an optional per-rpm boost target. No map = the sliders. ---- */
  function mapOk(m) {
    return !!(m && Array.isArray(m.rpm) && m.rpm.length > 1 && Array.isArray(m.load) && m.load.length > 1
      && Array.isArray(m.ign) && m.ign.length === m.load.length && Array.isArray(m.lam) && m.lam.length === m.load.length);
  }
  function mapSeg(ax, v) {                       // [i, t] with ax[i] <= v <= ax[i+1]; flat outside the axis
    const n = ax.length;
    if (v <= ax[0]) return [0, 0];
    if (v >= ax[n - 1]) return [n - 2, 1];
    let i = 0;
    while (i < n - 2 && v > ax[i + 1]) i++;
    return [i, (v - ax[i]) / (ax[i + 1] - ax[i])];
  }
  const mapMix = (a, b, t) => t <= 0 || a === b ? a : t >= 1 ? b : a + (b - a) * t;   // exact at the breakpoints
  function mapLook(m, tbl, rpm, load) {
    const r = mapSeg(m.rpm, rpm), l = mapSeg(m.load, load);
    const row = j => mapMix(tbl[j][r[0]], tbl[j][r[0] + 1], r[1]);
    return mapMix(row(l[0]), row(l[0] + 1), l[1]);
  }
  /* part-load (cruise) cell: leaner than the stock closed loop burns a thinner, hotter-gamma charge (and
     throttles less), until the flame stops lighting it; away from MBT costs work like at full load */
  const mapMisLam = burn => 1.10 + 0.25 * (burn - 1);
  function mapCruiseEta(lam, lamStock, ign, burn) {
    const gain = l => 1 + 0.30 * (clamp(l, 1, 1.3) - 1);
    const mis = Math.max(0, lam - mapMisLam(burn));
    return gain(lam) / gain(lamStock) * Math.max(0.4, 1 - 6 * mis * mis - 0.6 * mis) / (1 + 0.0018 * sq(ign));
  }
  function mapRow(m, arr, rpm) { const r = mapSeg(m.rpm, rpm); return mapMix(arr[r[0]], arr[r[0] + 1], r[1]); }

  /* =====================================================================
     9r.  ROTARY (Wankel) cycle. Only a rotary layout ever reaches these.
          The eccentric shaft (e-shaft) is the output shaft: it turns three
          times for every turn of a rotor, and each of the rotor's three faces
          fires once per rotor turn, so every rotor fires once per e-shaft rev.
          Displacement is quoted Mazda's way: 3*sqrt(3)*R*e*B per chamber, one
          chamber per rotor (13B = 2 x 654 cc = 1.3 L). Over 720 deg of e-shaft
          each rotor sweeps two chambers, so the cycle breathes and burns like
          a four-stroke of twice that (the 13B like a 2.6 L): that four-stroke
          equivalent is the volume IMEP/BMEP, torque and air flow use (g.Vd),
          and the quoted figure is g.VdNom (res.Vd).
     ===================================================================== */
  const ROT_ETA = 0.74;      // indicated efficiency vs a piston engine at the same CR: a long thin moving chamber burns slowly,
                             //   leaves a quench pocket at the trailing apex (the unburnt HC) and loses heat to a lot of housing
  const ROT_CRUISE = 0.90;   // part load: proportionally more charge in the quench zone and more leakage time per cycle
  const ROT_PMAX = 0.78;     // the burn spreads along a chamber that is already expanding, so the peak is lower
  const ROT_FC = 0.30, ROT_FS = 0.050, ROT_FS2 = 0.0060;   // seal + e-shaft bearing friction [bar] vs an apex-speed index (krpm x R/105)
  const ROT_EGT = 115;       // degC: the exhaust port opens while the charge is still burning
  const ROT_ON = 0.0, ROT_ON_B = 5.5;   // octane: a cool quenched trailing chamber NA; boosted, the end gas sits on the hot lobe
  const ROT_HEAT = 1.25;     // heat to coolant: a large housing surface wraps every chamber
  const ROT_SHOCK = 4.0;     // apex seal: combustion shock and hammering in its slot over the static pressure load
  const ROT_VLIM = 55;       // m/s an OEM-mass seal follows on chrome before it bounces
  const ROT_HOUSE = 5.5;     // hot-lobe temperature rise vs heat flux
  const ROT_ESH = 2.1e-3;    // e-shaft deflection index -> um
  const ROT_SKIP = { piston_speed: 1, crown_temp: 1, crown_pressure: 1, hot_clearance: 1, slap_blowby: 1, ring_gap: 1, rod_tension: 1,
    rod_buckling: 1, rod_bolts: 1, crank_fatigue: 1, torsional: 1, head_lift: 1, gasket_shear: 1, valve_float: 1, valve_piston: 1,
    valve_temp: 1, bore_distortion: 1, wall_thickness: 1, detonation: 1, preignition_egt: 1, bearing_load: 1, oil_film: 1 };
  function rotGeometry(cfg, L) {
    const B = cfg.bore, R = cfg.stroke, e = cfg.ecc || 15;
    const Vch = 3 * Math.sqrt(3) * R * e * B / 1e9;            // m^3, one chamber
    const VdNom = Vch * L.n, Vd = 2 * VdNom;                    // quoted / four-stroke equivalent
    // the piston-only maths downstream still runs (its tests are skipped): give it a neutral 86 mm "cylinder"
    return { L: L, b: 86, s: 86, Ap: PI / 4 * 0.086 * 0.086, Vcyl: Vd / L.n, Vd: Vd, VdNom: VdNom, Vch: Vch,
      r: 0.043, l: 0.086 * 1.65, lam: 0.043 / (0.086 * 1.65), rot: true, R: R / 1000, e: e / 1000, B: B / 1000 };
  }
  /* breathing: the port timing (rpmC, wLo) and its area against how much chamber it has to fill (Z) */
  function rotVeModel(cfg, g, ink, exh, pt) {
    const plateau = clamp(pt.ve + ink.veBonus + exh.veBonus, 0.60, 1.25);
    const rpmC = pt.rpmC * Math.pow(0.105 / g.R, 0.5) * Math.pow(0.015 / g.e, 0.3);
    const zK = 0.0137 * (g.e / 0.015) * Math.pow(g.R / 0.105, 0.5) / pt.flow;
    return { plateau: plateau, rpmC: rpmC, zK: zK, wLo: pt.wLo, wHi: pt.wHi || 1.16, overlap: pt.overlap,
      dyn: (rpm) => 1 - 0.115 * pt.overlap * clamp(1.6 - rpm / rpmC, 0, 1.1) };
  }
  function rotVeAt(rpm, rv, ink, chargeK, bBar) {
    const a = 20.05 * Math.sqrt(chargeK);
    const Z = rv.zK * rpm / a;
    const fMach = 1 / (1 + Math.pow(Z / 0.648, 3.4));
    const x = rpm / rv.rpmC;
    const fCam = Math.exp(-0.5 * sq((x - 1) / (x < 1 ? rv.wLo : rv.wHi)));
    const ampEff = ink.amp / (1 + 1.2 * (bBar || 0));
    const fRun = 1 + ampEff * Math.exp(-0.5 * sq((rpm - ink.rTune) / (0.30 * ink.rTune)));
    // boost traps exhaust residual through the overlap; a side port barely overlaps, so a rotary keeps more of its charge
    const trap = bBar > 0.001 ? 1 / (1 + (K_TRAP0 * clamp(bBar / 0.5, 0, 1) + K_TRAP1 * bBar) * (0.30 + rv.overlap)) : 1;
    // overlap at low load-and-rpm: exhaust gas backs into the intake and dilutes the next charge
    const rev = 1 - 0.10 * rv.overlap * clamp(1 - rpm / 3500, 0, 1);
    return clamp(rv.plateau * fCam * fMach * fRun * trap * rev, 0.15, 1.30);
  }
  /* compression leaks past the apex seals in proportion to the time it has: worst at low rpm and under boost */
  function rotLeak(rpm, sl, bBar) {
    return 1 - 0.045 * (2 - sl.seal) * Math.pow(3000 / Math.max(600, rpm), 0.7) * (1 + 0.10 * (bBar || 0)) * (sl.thick < 2.5 ? 1.08 : 1);
  }
  function rotFmepBar(rpm, pmaxBar, g, sl) {
    const v = rpm / 1000 * g.R / 0.105;
    return (ROT_FC + FM_P * pmaxBar + ROT_FS * v + ROT_FS2 * v * v) * sl.fric;
  }
  /* octane requirement: no bore and no head; aluminium housings and side seals of iron */
  function rotOnReq(crEff, chargeC, coolantC, timing, lamE, bBar) {
    return 89.6 + 3.0 * (crEff - 10.55) + 0.135 * (chargeC - 35) + 0.10 * (coolantC - 90) + 0.85 * timing
      - 1.4 - 6.0 * clamp(1.0 - lamE, -0.05, 0.22) + ROT_ON + ROT_ON_B * (bBar || 0);
  }

  /* =====================================================================
     9t.  TWO-STROKE cycle. Only cfg.cycle === "two" on a piston layout reaches these.
          Every cylinder fires every turn, so over 720 deg a two-stroke breathes and burns
          like a four-stroke of twice its swept volume: g.Vd is that equivalent (torque, air
          flow, BMEP) and g.VdNom the swept volume quoted (res.Vd). The piston opens the ports,
          so "VE" here is the charging efficiency: the delivery ratio (fresh charge pushed
          through per swept volume) times the trapping efficiency (the share of it still in the
          cylinder when the exhaust port closes). The rest short-circuits straight out of the
          exhaust, taking its fuel with it unless the fuel goes in after the port closes.
     ===================================================================== */
  const TS_ETA = 1.00;       // indicated efficiency vs a four-stroke at the same trapped CR (no pumping loop, a compact squish chamber)
  const TS_ETA_EP = 0.0015;  //   but every degree of exhaust duration over 150 opens the port earlier and leaves less expansion
  const TS_ETA_D = 0.97;     // a uniflow diesel loses little: the valves open late and the air sweeps the bore clean
  const TS_CRUISE = 0.84;    // part load: a throttled two-stroke keeps its exhaust and misfires ("four-stroking")
  const TS_FC = 0.20;        // friction constant [bar]: no valvetrain, rolling-element bearings (crankcase-scavenged)
  const TS_PMAX = 0.95;
  const TS_CROWN = 1.30;     // crown heat: a power stroke every turn, and the exhaust side never sees a cool charge
  const TS_ON = 1.5;         // octane: hot residual left in the cylinder
  const TS_EGT = -30;        // the short-circuited charge cools the pipe a little
  const TS_PIPE_T0 = 560;    // degC: the pipe gas temperature a tuned rpm is quoted at
  const TS_SKIP = { valve_float: 1, valve_piston: 1, valve_temp: 1 };   // a ported engine has no valves (uniflow keeps float and temperature)
  const TS_SKIP_CASE = { oil_starvation: 1, oil_film: 1, rod_bolts: 1 };   // and a pressed-up crank with one-piece rods: no rod bolts            // crankcase-scavenged: no sump, needle-roller bearings fed by the premix
  const TS_HEAD = { name: "Ported head", nIV: 1, kv: 0.40, veBase: 0.93, floatBase: 5600, camMax: 100, cost: 0, massFac: 0.55, vvt: 0, vvl: 0, burn: 1.04 };
  const TS_INK = { name: "Crankcase intake", veBonus: 0, rTune: 5000, amp: 0, loss: 0.35, wet: 0, cost: 0 };
  function tsModel(cfg, g, O, dsl) {
    const sc = O.scv, ind = O.ind2, xp = O.xp;
    const ep = clamp(+cfg.ePort || 185, 100, 220), tp = clamp(+cfg.tPort || 125, 80, 150);
    // the ports breathe best where their time-area matches the piston speed: longer durations, more rpm
    const durEff = 0.65 * ep + 0.35 * (tp + 60);
    const rpmP = 257000 / Math.max(30, g.s) * Math.exp((durEff - 150) / 50) * sc.flow;
    const ccr = clamp(+cfg.ccr || 1.4, 1.1, 1.8);
    const mild = clamp((205 - ep) / 80, 0, 1);   // 1 = a road engine's low, narrow ports; 0 = a race port
    return { ep: ep, tp: tp, rpmP: rpmP, wLo: (0.50 + 0.45 * mild) * (O.pvO.wide || 1), wHi: 0.40 + 0.35 * mild,
      ccr: ccr, caseDR: 0.55 + 0.90 * (ccr - 1), blower: !!ind.blower, valves: !!sc.valves && !g.L.opposed, dsl: dsl,
      amp: xp.amp * (dsl || sc.valves ? 0.30 : 1), w: xp.w, dip: xp.dip, te0: sc.te, chamber: cfg.xpipe === "chamber",
      pipeRpm: clamp(+cfg.pipeRpm || 8000, 800, 16000), lowK: ind.lowK, topK: ind.topK, back: ind.back, sc: dsl ? 0 : O.tsf.sc,
      etaK: dsl ? TS_ETA_D : TS_ETA * (1 - TS_ETA_EP * Math.max(0, ep - 150)) };
  }
  /* scavenge-air pressure in a blower's air box: rises with piston speed (port flow) squared */
  function tsBoxBar(mps, dr) { return clamp(0.30 * sq(mps / 9) * sq(dr / 1.35), 0, 0.8); }
  /* delivery ratio, trapping and charging efficiency at an rpm. pipeT: pipe gas temperature (degC), which moves the tune */
  function tsBreathe(rpm, tm, bBar, pipeT) {
    const x = rpm / tm.rpmP;
    const fPort = Math.exp(-0.5 * sq((x - 1) / (x < 1 ? tm.wLo : tm.wHi)));
    let dr;
    if (tm.blower) dr = 1.35 * (0.80 + 0.20 * fPort) * (x > 1 ? 1 - 0.25 * clamp(x - 1, 0, 1) : 1);   // positive displacement: flat until the ports choke it
    else {
      dr = tm.caseDR * fPort * (x < 1 ? tm.lowK + (1 - tm.lowK) * x : tm.topK) * (1 - tm.back * clamp(1 - x, 0, 1));
      dr *= (1 - 0.6 * Math.max(0, tm.ccr - 1.40) * clamp(x - 0.8, 0, 1.5)) * (1 + 0.5 * Math.max(0, 1.40 - tm.ccr) * clamp(x - 0.8, 0, 1));   // a small crankcase runs out of charge at the top
      if (tm.dsl) dr *= 0.45 + 0.85 * clamp((bBar || 0) / 0.35, 0, 1);   // a crankcase cannot push air through a diesel's cylinder; a turbo alone gives nothing at idle
    }
    let bump = 0, rTune = 0;
    if (tm.amp > 0) {
      rTune = tm.pipeRpm * Math.sqrt((pipeT + 273) / (TS_PIPE_T0 + 273));   // a hotter pipe carries its waves faster: the tune moves up
      const ampEff = tm.amp / (1 + 2.5 * (bBar || 0));                          // a turbine in the pipe swallows the waves
      bump = ampEff * Math.exp(-0.5 * sq((rpm - rTune) / (tm.w * rTune)))
        - tm.dip * (ampEff / Math.max(1e-6, tm.amp)) * clamp((0.82 * rTune - rpm) / (0.30 * rTune), 0, 1) * clamp(rpm / (0.4 * rTune), 0, 1);
    }
    dr *= 1 + 0.75 * bump;                                                      // the diverging cone's suction pulls charge through
    const te = clamp(tm.te0 * (1.12 - 0.15 * dr) * (1 + 0.45 * Math.max(0, bump)), 0.30, 0.97);   // the plug pulse pushes the escaping charge back
    return { dr: dr, te: te, ce: dr * te, rTune: rTune, bump: bump, x: x };
  }

  /* =====================================================================
     10.  simulate()
     ===================================================================== */
  /* ---- exhaust system after the manifold -------------------------------------------------
     Pressure loss through pipe, cat and muffler is K velocity heads: dP = K * mdot^2 / (2 rho A^2), so it
     scales with the square of the exhaust mass flow. A 2.25" single passes a 1.6 at ~90 m/s and chokes a
     500 hp V8 at over 300 m/s. The stock pipe is sized for 100 m/s at this engine's rated flow (mRef), so
     the stock system is the baseline already inside the manifold's backP and every choice is the
     difference from it. Long pipes run sonic well before the sums say so: sat() soft-limits the loss. */
  const EXH_RHO = 0.54, EXH_V0 = 100, EXH_KPIPE = 1.2, EXH_SAT = 0.9e5;
  function exhParts(cfg) {
    const dsl = isDiesel(cfg);
    let cat = OPT.cat[cfg.cat] || OPT.cat.none;
    if (cat.fam && cat.fam !== (dsl ? "ci" : "si")) cat = OPT.cat.none;   // a DPF on a petrol engine (or a cat on a diesel) left over from a fuel swap does nothing
    return { pipe: OPT.pipe[cfg.pipe] || OPT.pipe.stock, muf: OPT.muffler[cfg.muffler] || OPT.muffler.stock,
             cat: cat, cut: OPT.cutout[cfg.cutout] || OPT.cutout.none, dsl: dsl };
  }
  // exhaust mass flow (kg/s) the stock pipe is sized for: rated rpm, full boost
  function exhRefFlow(cfg, g) {
    const boost = cfg.asp !== "na" ? cfg.boost : 0;
    return 1.2 * g.Vd * clamp(cfg.redline, 1800, 12500) / 120 * 0.9 * (1 + 0.85 * boost) * 1.07;
  }
  /* returns null for the system every engine was tested with; otherwise the loss functions (Pa) */
  function exhSysOf(cfg, g, openOverride, always) {
    const X = exhParts(cfg), open = X.pipe.open || (openOverride != null ? openOverride : X.cut.open);
    if (!always && !open && X.pipe === OPT.pipe.stock && X.muf === OPT.muffler.stock && X.cat === OPT.cat.none) return null;
    const mRef = exhRefFlow(cfg, g);
    const aStock = mRef / (EXH_RHO * EXH_V0);
    const id = X.pipe.dia ? (X.pipe.dia * 25.4 - 3.3) / 1000 : 0;          // 16-gauge wall
    const aPipe = X.pipe.dia ? X.pipe.runs * PI / 4 * id * id : aStock;
    const kSys = open ? 0 : (EXH_KPIPE + X.muf.K + X.cat.K);
    const kStock = EXH_KPIPE + OPT.muffler.stock.K;
    const sat = (x) => x / (1 + x / EXH_SAT);
    const dp = (m, pAmb, k, a) => { const rho = EXH_RHO * pAmb / 101325; return sat(k * m * m / (2 * rho * a * a)); };
    return {
      parts: X, mRef: mRef, aPipe: aPipe, aStock: aStock, open: open,
      dp: (m, pAmb) => dp(m, pAmb, kSys, aPipe),                           // this system's own loss
      dpStock: (m, pAmb) => dp(m, pAmb, kStock, aStock),
      delta: (m, pAmb) => dp(m, pAmb, kSys, aPipe) - dp(m, pAmb, kStock, aStock)
    };
  }
  /* the UI's view of a system: its own loss (bar) at an exhaust flow, gas speed (m/s), and the flow (kg/s) it passes at 100 m/s */
  function exhaustInfo(cfg, mKgS) {
    cfg = Object.assign({}, DEFAULT_CFG, cfg || {});
    const S = exhSysOf(cfg, geometry(cfg), null, true), m = mKgS || S.mRef;
    return { dpBar: S.dp(m, 101325) / 1e5, speed: S.open ? 0 : m / (EXH_RHO * S.aPipe), flow100: EXH_RHO * S.aPipe * EXH_V0, mRef: S.mRef, open: S.open, runs: S.parts.pipe.runs || 1 };
  }
  /* drive-by noise estimate, dBA at 7.5 m under a part-throttle pull at three-quarter rated speed (capped at 4,500).
     Bigger cylinders, more of them and more revs are louder; a turbine eats the pulse; the system after the manifold
     adds or takes away on top. db is what a road buyer hears (cutout shut); dbOpen is with the cutout open. */
  function exhaustNoise(cfg) {
    cfg = Object.assign({}, DEFAULT_CFG, cfg || {});
    const L = LAYOUTS[cfg.layout] || LAYOUTS.I4, g = geometry(cfg), X = exhParts(cfg);
    const kind = (OPT.asp[cfg.asp] || OPT.asp.na).kind;
    const rpmT = Math.min(0.75 * clamp(cfg.redline, 1800, 12500), 4500);
    let base = 64 + 10 * Math.log10(Math.max(0.3, g.Vd * 1000)) + 15 * Math.log10(rpmT / 3000) + 1.5 * Math.log2(L.n / 4)
      + 2.0 * (cfg.cam / 100 - 0.4)
      + ({ cast_log: -0.5, cast_tubular: 0, headers_equal: 1.0, headers_merge: 1.5 }[cfg.exhaust] || 0);
    if (X.dsl) base += 3;                                  // combustion knock carries through the block
    if (isTwoStroke(cfg)) base += 10 + ((OPT.xpipe[cfg.xpipe] || {}).db || 0);   // a power pulse every turn, straight off the port: two-strokes are loud
    const turbo = kind === "turbo";
    if (turbo) base -= cfg.asp === "twin_turbo" || cfg.asp === "compound" ? 3.5 : 3;
    else if (kind !== "na") base += 1;                     // blower whine
    const pipeDb = { stock: 0, s225: -0.5, s250: 0, d250: 1.5, d300: 2.5, t400: 2 }[cfg.pipe] || 0;
    const sys = (open) => {
      let d = open ? 19 : pipeDb + X.muf.db + X.cat.db;
      if (turbo && d > 0) d *= 0.8;                        // the turbine has already taken the edge off
      return d;
    };
    const r1 = (v) => Math.round(v * 10) / 10;
    return { db: r1(base + sys(!!X.pipe.open)), dbOpen: r1(base + sys(!!X.pipe.open || !!X.cut.open)) };
  }

  function simulate(cfg, env) {
    cfg = Object.assign({}, DEFAULT_CFG, cfg || {});
    env = Object.assign({}, DEFAULT_ENV, env || {});
    const rot = isRotary(cfg);
    if (rot && (!OPT.fuel[cfg.fuel] || OPT.fuel[cfg.fuel].ci)) cfg.fuel = "r91";   // a Wankel is a spark engine
    const ts = isTwoStroke(cfg), tsCaseB = ts && tsCase(cfg);

    const O = {
      block: OPT.blockMat[cfg.blockMat], deck: OPT.deck[cfg.deck],
      headMat: OPT.headMat[cfg.headMat], hd: OPT.head[cfg.head],
      valve: OPT.valveMat[cfg.valveMat], spr: OPT.springs[cfg.springs],
      pis: OPT.piston[cfg.piston], pc: OPT.pistonClearance[cfg.pistonClearance],
      ring: OPT.rings[cfg.rings], rod: OPT.rod[cfg.rod], rb: OPT.rodBolts[cfg.rodBolts],
      crk: OPT.crank[cfg.crank], dmp: OPT.damper[cfg.damper], brg: OPT.bearings[cfg.bearings],
      gsk: OPT.gasket[cfg.gasket], std: OPT.studs[cfg.studs], ink: OPT.intake[cfg.intake],
      asp: OPT.asp[cfg.asp], ts: OPT.turboSize[cfg.turboSize], tm: OPT.turbineMat[cfg.turbineMat],
      icc: OPT.ic[cfg.ic], n2o: OPT.nitrous[cfg.nitrous] || OPT.nitrous.none,
      fu: fuelOf(cfg), oil: OPT.oilGrade[cfg.oilGrade],
      osys: OPT.oilSystem[cfg.oilSystem], sq: OPT.oilSquirters[cfg.oilSquirters],
      cool: OPT.cooling[cfg.cooling], exh: OPT.exhaust[cfg.exhaust], cov: OPT.cover[cfg.cover],
      lay: OPT.layout[cfg.layout]
    };
    /* shop bonuses (staff, R&D) come in through env.shop so the physics stays the physics */
    const shop = env.shop || {};
    if (shop.rodFat && shop.rodFat !== 1) O.rod = Object.assign({}, O.rod, { fatigue: O.rod.fatigue * shop.rodFat });
    if (shop.crkFat && shop.crkFat !== 1) O.crk = Object.assign({}, O.crk, { fatigue: O.crk.fatigue * shop.crkFat });
    if (rot) Object.assign(O, { port: OPT.rotPort[cfg.rotPort] || OPT.rotPort.side, apex: OPT.apexSeal[cfg.apexSeal] || OPT.apexSeal.oem3,
      rh: OPT.rotHousing[cfg.rotHousing] || OPT.rotHousing.chrome, rsp: OPT.sidePlate[cfg.sidePlate] || OPT.sidePlate.iron,
      esh: OPT.eshaft[cfg.eshaft] || OPT.eshaft.stock, omp: OPT.oilMeter[cfg.oilMeter] || OPT.oilMeter.omp });
    if (ts) Object.assign(O, { scv: OPT.scav[cfg.scav] || OPT.scav.loop, ind2: OPT.induct[cfg.induct] || OPT.induct.reed,
      tsf: OPT.tsFuel[cfg.tsFuel] || OPT.tsFuel.carb, xp: OPT.xpipe[cfg.xpipe] || OPT.xpipe.chamber, pvO: OPT.pv[cfg.pv] || OPT.pv.none,
      lubeO: OPT.lube[cfg.lube] || OPT.lube.premix, hd: TS_HEAD, ink: TS_INK, exh: OPT.xpipe[cfg.xpipe] || OPT.xpipe.chamber });
    const g = geometry(cfg);
    const L = g.L;
    const air = ambient(env);
    const vm = veModel(cfg, g, O.hd, O.ink, O.exh);
    const rv = rot ? rotVeModel(cfg, g, O.ink, O.exh, O.port) : null;
    const tm = ts ? tsModel(cfg, g, O, isDiesel(cfg)) : null;
    const tsLubR = tsCaseB ? (cfg.lube === "inject" ? 50 : clamp(+cfg.premix || 40, 10, 200)) : 0;
    const tsLubeK = !tsCaseB ? 1 : cfg.lube === "inject" ? 0.99 : 0.92 + 0.12 * Math.pow(40 / tsLubR, 0.8);   // oil in the mix is drag; lean premix is less of it
    const tsDr = [], tsTe = [], tsTune = [];
    let tsPipeT = 0.82 * 680, tsBoxPk = 0;
    const bm = boostModel(cfg, g);
    const boosted = bm.kind !== "na";
    const deckStiff = (cfg.blockMat === "alu_liners" || cfg.blockMat === "alu_nikasil") ? O.deck.stiff : 1.0;
    const blockStiff = O.block.stiff * deckStiff * (isDiesel(cfg) ? 1.5 : 1);   // a diesel block is a thicker casting with a deep skirt

    const fuelON = 0.60 * O.fu.ron + 0.40 * O.fu.mon;   // road-weighted anti-knock index
    const dsl = isDiesel(cfg);
    const dInj = dsl ? (OPT.dInj[cfg.dInj] || OPT.dInj.rotary_ve) : null;
    const dNoz = dsl ? (OPT.dNoz[cfg.dNoz] || OPT.dNoz.stock) : null;
    /* MORE FUELS: propane / CNG, and what meters it. The vapour takes up cylinder that air would have filled, and a venturi
       mixer costs a little more on top; a gas arrives already evaporated, so there is no charge cooling from it. */
    const gasF = !dsl && !!O.fu.gas, gs = gasF ? (OPT.gasSys[cfg.gasSys] || OPT.gasSys.mixer) : null;
    const gasVeK = gasF ? (1 - O.fu.displace) * gs.veK : 1;
    const evapK = dsl ? 0 : gasF ? 0 : evapCoolK(O.fu, cfg.lambda);    // a diesel sprays into the cylinder after the air is trapped
    const kvOil = kvAt(O.oil, env.oilC);

    const redline = clamp(cfg.redline, dsl ? (ts ? 1200 : 1800) : 4000, 12500);   // a big two-stroke diesel (the Deltic) is rated slower
    /* ---- tune map: the WOT row (or, for the map editor's part-load probe, env.mapLoad's row) per rpm ---- */
    const MAP = mapOk(cfg.map) ? cfg.map : null;
    const mapLd = MAP && env.mapLoad > 0 && env.mapLoad < 1 ? Math.max(0.1, env.mapLoad) : 1;
    const MAPB = MAP && boosted && Array.isArray(MAP.boost) && MAP.boost.length === MAP.rpm.length;
    const tmgAt = rpm => MAP ? mapLook(MAP, MAP.ign, rpm, 100 * mapLd) : cfg.timing;
    const lamAt = rpm => MAP ? mapLook(MAP, MAP.lam, rpm, 100 * mapLd) : cfg.lambda;
    const mgnCurve = [], rtdCurve = [];
    /* VGT: vane opening 0 (shut, at the spool point) .. 1 (wide open), and the drive pressure that goes with it */
    const vaneOpen = rpm => clamp((rpm - bm.spool) / (1.4 * bm.spool), 0, 1);
    const vaneBack = rpm => { const o = vaneOpen(rpm); return 1 + 0.35 * sq(1 - o) - 0.15 * o; };   // shut: ~1.35x the drive pressure; open: less than the fixed housing
    const vgtO = bm.vgt ? OPT.turbine.vgt : null;
    const alsO = bm.kind === "turbo" && !dsl && OPT.als[cfg.als] && cfg.als !== "off" ? OPT.als[cfg.als] : null;
    /* ---- nitrous ----------------------------------------------------
       The shot is quoted in crank hp. Convert to the extra indicated work
       per cycle it puts in the cylinder, then let every downstream number
       (peak pressure, crown temperature, rod load, knock) see it.        */
    const n2oHp = O.n2o.shotHp || 0;
    const n2oOn = n2oHp > 0;
    const n2oWin = n2oOn ? (O.n2o.prog ? 0.42 : 0.55) * redline : 0;   // window switch
    // how big the shot is relative to what the engine already makes
    const n2oBite = n2oOn ? clamp(n2oHp / (60 * (g.Vd * 1000)), 0, 2.2) : 0;
    /* kit plumbing. A dry kit's fuel comes through the engine's own injectors (rail pressure raised by the
       kit), so a fuel system already near its limit goes lean the moment the shot arrives. A diesel kit is
       oxygen only: the injection pump finds the fuel, and a pump on its stop just makes less of the shot.
       Stacked plates bring their second stage in later in the pull. The original four kits are untouched. */
    const n2oKind = O.n2o.kind || "";
    const n2oDry = n2oOn && !dsl && (n2oKind === "dry" || n2oKind === "diesel");
    const n2oDsl = n2oOn && dsl && (n2oKind === "diesel" || n2oKind === "dry");
    const n2oSt = n2oOn && O.n2o.stageHp ? O.n2o.stageHp : null;
    const n2oWin2 = n2oSt ? n2oWin + 0.15 * redline : 0;
    const N2O_RAIL = 1.18;                  // injector flow with the rail pressure raised ~40% while the shot is on
    let n2oLeanPk = 0;
    const rpms = [], torque = [], power = [], boostCurve = [], veCurve = [], egtCurve = [], bmepArr = [];
    let peakHp = 0, peakHpRpm = 0, peakTq = 0, peakTqRpm = 0;
    let maxPmax = 0, maxPmaxRpm = 0, maxImep = 0, maxEgt = 0, maxRetard = 0;
    let maxChargeC = -273, maxBoost = 0, maxFlowLb = 0, flowAtPeak = 0;
    let fuelUsedProxy = 0, ptsProxy = 0;
    /* ---- fuel system: what reaches the cylinder, not just what the tune asks for ---- */
    const inj = OPT.injectors[cfg.injectors] || OPT.injectors.i240;
    const fpump = OPT.fuelPump[cfg.fuelPump] || OPT.fuelPump.p190;
    const portInj = !dsl && !gasF && (ts ? cfg.tsFuel !== "carb" : cfg.intake !== "carb");          // a carburettor meters through jets (a gas system has its own meter)
    const injCc = inj.cc * (inj.perCyl || 1) * (isRotary(cfg) ? 2 : 1);   // cc/min per cylinder (a rotary stages a primary and a secondary per rotor)
    const fuelRho = fuelDensity(O.fu);
    const lamCurve = [], fuelLph = [];
    let dutyPk = 0, dutyRpm = 0, ccCylPk = 0, pumpPk = 0, pumpRpm = 0, pumpCapPk = 0, pumpNeedPk = 0;
    let lamTop = MAP ? 0 : cfg.lambda, fdTop = 1, leanRpm = 0;
    const kFuel = dsl ? K_FUEL_D : K_FUEL;
    /* diesel: the pump meters fuel per stroke for full-boost air. rhoFull is the charge
       density at full boost; below it the smoke limiter (or the lack of one) decides
       how much of that fuel still arrives while the turbo spools.                   */
    let rhoFull = 0, qUtilPk = 0, qDemPk = 0, qCapPk = 0, qRpm = 0, lamMin = 9, smokePk = 0;
    const smokeCurve = [];
    if (dsl && boosted) {
      const PRf = (air.p + cfg.boost * 1e5) / air.p;
      const etaCf = bm.kind === "roots" ? 0.58 : bm.kind === "screw" ? 0.70 : bm.kind === "centrifugal" ? 0.745 : 0.72;
      let T2f;
      if (bm.compound) {
        const T1 = air.T * (1 + (Math.pow(Math.sqrt(PRf), 0.2857) - 1) / 0.76);
        T2f = (T1 - 0.55 * (T1 - air.T)) * (1 + (Math.pow(Math.sqrt(PRf), 0.2857) - 1) / 0.76);
      } else T2f = air.T * (1 + (Math.pow(PRf, 0.2857) - 1) / etaCf);
      rhoFull = (air.p + cfg.boost * 1e5 - O.icc.dp * 1e5) / (R_AIR * (T2f - O.icc.eff * (T2f - air.T)));
    }
    const atomise = dsl ? clamp(1.15 - dInj.bar / 2600, 0.35, 1) * (1 + 0.06 * (dNoz.mult - 1)) : 1;   // finer spray, less soot; big holes, bigger drops
    /* exhaust system after the manifold: null (no extra term at all) for the stock system */
    const exS = exhSysOf(cfg, g), exP = exhParts(cfg), exSmokeK = exP.cat.smokeK || 1;
    let exFlowPk = 0, exDpPk = 0, exDeltaPk = 0;
    const cetane = dsl ? (O.fu.cetane || 48) : 0;

    for (let rpm = 1000; rpm <= redline + 0.5; rpm += 100) {
      /* ---- charge path ---------------------------------------------- */
      const tmg = MAP ? tmgAt(rpm) : cfg.timing, lamC = !MAP ? cfg.lambda : dsl && mapLd < 1 ? Math.max(lamAt(rpm), mapLook(MAP, MAP.lam, rpm, 100) / mapLd) : lamAt(rpm), evapKr = MAP && !dsl ? evapCoolK(O.fu, lamC) : evapK;
      const bFull = MAPB ? boostAt(rpm, Object.assign({}, bm, { target: mapRow(MAP, MAP.boost, rpm) }), cfg, g) : boostAt(rpm, bm, cfg, g);
      const bBar = mapLd < 1 ? (dsl ? bFull * mapLd : Math.max(0, (air.p + bFull * 1e5) * mapLd - air.p) / 1e5) : bFull;
      const pManAbs0 = air.p + bBar * 1e5;
      const PR = pManAbs0 / air.p;
      let etaC = 0.72;
      if (bm.kind === "roots") etaC = 0.58;
      if (bm.kind === "screw") etaC = 0.70;
      if (bm.kind === "centrifugal") etaC = 0.745;
      let Tc2 = air.T;
      if (bBar > 0.001) {
        if (bm.compound) {
          // two stages, each doing sqrt(PR), with the air cooled between them
          const PRs = Math.sqrt(PR);
          const T1 = air.T * (1 + (Math.pow(PRs, 0.2857) - 1) / 0.76);
          const Tmid = T1 - 0.55 * (T1 - air.T);            // interstage cooler
          Tc2 = Tmid * (1 + (Math.pow(PRs, 0.2857) - 1) / 0.76);
        } else Tc2 = air.T * (1 + (Math.pow(PR, 0.2857) - 1) / etaC);
      }
      // intercooler
      let soakK = 0;
      if (env.testType === "endurance" && O.icc.soak > 0) soakK = O.icc.soak * 22;
      const Tc3 = bBar > 0.001 ? Tc2 - O.icc.eff * (Tc2 - air.T - soakK) : air.T;
      // manifold pressure: charge cooler dP for boost, throttle+runner loss for NA
      let pMan;
      if (boosted) pMan = pManAbs0 - O.icc.dp * 1e5;
      else if (dsl) pMan = air.p * (1 - clamp(0.005 * O.ink.loss * sq(rpm / 4000), 0, 0.05));   // no throttle, only the runners
      else pMan = air.p * (1 - clamp(0.014 * O.ink.loss * sq(rpm / 6000), 0, 0.11));
      if (mapLd < 1 && !dsl) pMan = Math.min(pMan, (air.p + bFull * 1e5) * mapLd);   // map probe: throttled to the row's load
      // fuel evaporation cools the charge (this is where alcohol makes its power)
      const Tcharge = Math.max(air.T - 5, Tc3 - evapKr);
      const rhoCharge = pMan / (R_AIR * Tcharge);

      /* ---- breathing -------------------------------------------------- */
      const tb = ts ? tsBreathe(rpm, tm, bBar, tsPipeT) : null;
      let tsBox = 0;
      if (ts && tm.blower) { tsBox = tsBoxBar(2 * (g.s / 1000) * rpm / 60, tb.dr); if (tsBox > tsBoxPk) tsBoxPk = tsBox; }
      const ve0 = ts ? tb.ce * (tm.blower ? 1 + (tm.valves ? 0.3 : 0.15) * tsBox * 1e5 / air.p : 1)   // a blower traps the charge above atmospheric
        : rot ? rotVeAt(rpm, rv, O.ink, Tcharge, bBar) : veAt(rpm, cfg, g, vm, O.ink, O.hd, Tcharge, bBar);
      if (ts) { tsDr.push(tb.dr); tsTe.push(tb.te); tsTune.push(tb.rTune); }
      /* exhaust system: the extra pressure after the manifold. A turbine passes it upstream multiplied by its own
         expansion ratio; behind the exhaust valve it raises residual gas and, with overlap, pushes exhaust back
         into the intake, so a high-rpm, big-cam engine loses breathing as well as pumping work. */
      const exM = (ts ? tb.dr : ve0) * rhoCharge * g.Vd * rpm / 120 * (1 + 1 / (O.fu.afr * cfg.lambda));
      let exDp = 0;
      if (exS) exDp = exS.delta(exM, air.p) * (bm.kind === "turbo" ? pManAbs0 / air.p : 1);
      const ve = (gasF ? ve0 * gasVeK : ve0) * (exS ? clamp(1 - (0.10 + 0.25 * (ts ? 0.6 : rot ? clamp(rv.overlap / 0.4, 0, 1) : cfg.cam / 100)) * exDp / pMan, 0.75, 1.04) : 1);

      /* ---- fuel delivery ------------------------------------------------
         The tune asks for air x fuel/air at the commanded lambda; nitrous
         fuel comes off the same pump. What the injectors and pump cannot
         deliver leans the mixture: lamE is what the cylinder actually burns. */
      const airKgS = ve * rhoCharge * g.Vd * rpm / 120;
      // diesel: lambda follows the smoke limiter while the boost is not yet there
      const lamSet = (dsl && boosted ? lamC * Math.pow(clamp(rhoCharge / rhoFull, 0.05, 1), 1 - dInj.smokeLim) : lamC) * (dsl && dInj.rise ? 1 - dInj.rise * clamp(1 - rpm / redline, 0, 0.6) : 1);   // unit injectors: more fuel per stroke as the revs fall
      const needLph = kFuel * airKgS * (ts ? 1 + tm.sc * (1 / tb.te - 1) : 1) / (O.fu.afr * lamSet) * 3600 / fuelRho;   // two-stroke: the short-circuited charge carries its fuel out too
      const n2oStK = n2oSt && rpm < n2oWin2 ? n2oSt[0] / n2oHp : 1;   // first stage only, until the second arms
      const n2oLph = (n2oOn && rpm >= n2oWin)
        ? n2oHp * 745.7 * (O.n2o.prog ? clamp((rpm - n2oWin) / (0.28 * redline), 0.25, 1) : 1) / (0.26 * O.fu.lhv) * 3600 / fuelRho * n2oStK : 0;
      const ccCyl = (needLph + (n2oDry ? n2oLph : 0)) * 1000 / 60 / L.n;
      const duty = portInj ? ccCyl / (injCc * (n2oDry && n2oLph > 0 ? N2O_RAIL : 1)) : 0;
      // diesel: mm3 per stroke asked of the injection system against what pump + nozzles can push
      const qDem = dsl ? (needLph + (n2oDsl ? n2oLph : 0)) * 1e6 / (L.n * rpm * 30) / (ts ? 2 : 1) : 0;   // a two-stroke injects every turn
      const qCap = dsl ? dInj.qL * g.Vcyl * 1000 * dNoz.mult * (rpm <= dInj.rpmMax ? 1 : Math.exp(-sq((rpm - dInj.rpmMax) / (0.22 * dInj.rpmMax)))) : 1;
      const qUtil = qDem / qCap;
      const pumpCap = gasF ? gs.kgh / fuelRho * clamp(1 - gs.dropBar * Math.max(0, bBar), 0.3, 1)   // a gas system: kg/h it can meter, as L/h of this fuel
        : pumpLphAt(fpump, ts && fpump.rpmRef ? rpm * clamp(8000 / redline, 1, 4) : rpm, dsl ? 0 : bBar) * (n2oDry && n2oLph > 0 ? 0.92 : 1);   // a diesel lift pump does not push against boost; a dry kit's raised rail costs the pump flow
      const pumpLoad = (needLph * (dsl ? DSL_RETURN : 1) + n2oLph) / pumpCap;
      const fd = Math.min(portInj ? deliveredFrac(duty, INJ_KNEE) : dsl ? Math.min(1, 1 / Math.max(1e-9, qUtil)) : 1, deliveredFrac(pumpLoad, PUMP_KNEE))
        * (n2oDry && !portInj && n2oLph > 0 ? needLph / (needLph + n2oLph) : 1);   // a carburettor has no injector table to add the dry shot's fuel
      const lamE = dsl ? Math.min(6, lamSet / fd) : Math.min(1.5, lamC / fd);
      if (dsl) {
        if (qUtil > qUtilPk) { qUtilPk = qUtil; qDemPk = qDem; qCapPk = qCap; qRpm = rpm; }
        if (lamE < lamMin) lamMin = lamE;
        // black smoke: unburnt carbon once the spray runs short of air
        const sm = clamp(Math.pow(clamp((1.45 - lamE) / 0.40, 0, 1), 1.3) * atomise * (1 + 0.08 * Math.max(0, -tmg)), 0, 1)
          * (n2oDsl && n2oLph > 0 ? clamp(1 - 1.6 * n2oBite, 0.2, 1) : 1)   // the shot's oxygen burns the soot
          * exSmokeK;                                                         // a DPF traps what comes out
        smokeCurve.push(sm);
        if (sm > smokePk) smokePk = sm;
      }
      lamCurve.push(lamE); fuelLph.push(needLph + n2oLph);
      if (ccCyl > ccCylPk) ccCylPk = ccCyl;
      if (duty > dutyPk) { dutyPk = duty; dutyRpm = rpm; }
      if (pumpLoad > pumpPk) { pumpPk = pumpLoad; pumpRpm = rpm; pumpCapPk = pumpCap; pumpNeedPk = needLph + n2oLph; }
      if (lamE > lamTop) { lamTop = lamE; fdTop = fd; leanRpm = rpm; }
      if (n2oDry && n2oLph > 0) n2oLeanPk = Math.max(n2oLeanPk, lamE - lamC);

      /* ---- knock ------------------------------------------------------ */
      // dynamic compression falls with cam overlap (late intake valve closing)
      const dyn = ts ? 1 : rot ? rv.dyn(rpm) : 1 - 0.115 * (cfg.cam / 100) * clamp(1.6 - rpm / vm.rpmCam, 0, 1.1);
      const crEff = cfg.cr * Math.pow(pMan / 101325, 0.24) * dyn;
      const chargeC = (fd < 1 ? Math.max(air.T - 5, Tc3 - evapKr * fd) : Tcharge) - 273.15;   // less fuel, less evaporative cooling
      let onReq = 89.6 + 3.0 * (crEff - 10.55)
        + 0.095 * (g.b - 86)
        + 0.135 * (chargeC - 35)
        + 0.10 * (env.coolantC - 90)
        + 0.85 * tmg
        - O.headMat.octane - (boosted ? O.icc.octane || 0 : 0)
        - 5.5 * (O.hd.burn - 1)
        - 6.0 * clamp(1.0 - lamE, -0.05, 0.22);
      onReq -= O.block.k > 100 ? 0.4 : 0;                 // alu block pulls heat too
      if (rot) onReq = rotOnReq(crEff, chargeC, env.coolantC, cfg.timing, lamE, bBar);
      if (ts) onReq += TS_ON + (O.scv.on || 0);
      if (n2oOn && rpm >= n2oWin) onReq += clamp(9.0 * n2oBite, 2, 15) * (O.n2o.prog ? 0.85 : 1);  // oxygen in the chamber, not just air
      if (n2oDry && n2oLph > 0) onReq += 30 * Math.max(0, lamE - lamC);   // lean on nitrous: the burn runs away
      const margin = fuelON - onReq;
      let retard = 0;
      if (!dsl && margin < 0) retard = clamp(-margin * 1.55, 0, 14);
      const phaseRetard = !dsl && bBar > 0.001 ? K_PHASE0 * clamp(bBar / 0.5, 0, 1) + K_PHASE1 * bBar : 0;
      const effTiming = tmg - retard - phaseRetard;

      /* ---- diesel ignition delay: fixed in ms (shorter with CR, cetane, boost heat and
         spray pressure), so it eats more crank degrees as the revs rise ------------ */
      let lateDeg = 0;
      if (dsl) {
        const tauMs = 0.50 * Math.pow(17.5 / cfg.cr, 1.2) * Math.pow(48 / cetane, 0.7) / (1 + 0.25 * bBar) * (1.15 - dInj.bar / 4000);
        lateDeg = Math.max(0, tauMs * rpm * 0.006 - 6);
      }

      /* ---- indicated work --------------------------------------------- */
      const eta_th = rot ? ottoEta(cfg.cr, O.fu.gamma) * K_QUAL * ROT_ETA * (1 + O.port.etaB) * rotLeak(rpm, O.apex, bBar) / (1 + 0.0018 * sq(effTiming))
        : dsl ? ottoEta(cfg.cr, O.fu.gamma) * K_QUAL * K_DSL
        * clamp(1 - 0.20 / lamE, 0.55, 1)                   // more fuel, longer cut-off, less expansion
        * (1 + (O.hd.burn - 1) * 0.30)
        * (1 + 0.0008 * (g.b - 86))                         // bigger bore, less wall per unit of charge
        / (1 + 0.0018 * sq(tmg - lateDeg)) * (ts ? tm.etaK : 1) : ottoEta(cfg.cr, O.fu.gamma) * K_QUAL
        * (1 + (O.hd.burn - 1) * 0.55)
        * (1 - 0.0011 * (g.b - 86))
        / (1 + 0.0018 * sq(effTiming)) * (ts ? tm.etaK : 1);
      const fuelPerAir = 1 / (O.fu.afr * lamE);
      let imep = ve * rhoCharge * O.fu.lhv * fuelPerAir * (dsl ? etaCombD(lamE, dInj.etaB) : etaComb(lamE)) * eta_th * (rot ? 1 + 0.5 * (O.apex.seal - 1) : 1 + 0.5 * ((O.ring.seal || 1) - 1)); // Pa — ring (apex) seal sets blow-by
      if (O.fu.etaK) imep *= O.fu.etaK;                     // methane burns slowly: a little more of the work is lost to the walls
      /* nitrous: a fixed power addition above the window, so it appears as a
         fixed torque that falls away with rpm exactly as a real shot does   */
      let n2oFrac = 0;
      if (n2oOn && rpm >= n2oWin) {
        const ramp = O.n2o.prog ? clamp((rpm - n2oWin) / (0.28 * redline), 0.25, 1) : 1;
        const n2oW = n2oHp * 745.7 * ramp * n2oStK * (n2oDsl ? Math.min(1, fd) : 1);   // crank watts asked of the bottle
        // a cylinder can only hold so much oxidiser: cap the shot's contribution
        const addPa = Math.min(n2oW / (g.Vd * (rpm / 120)), 1.8 * imep);  // P = imep * Vd * (rpm/120)
        imep += addPa;
        n2oFrac = addPa / Math.max(1e4, imep);
      }

      /* ---- pumping ----------------------------------------------------- */
      let pmep;
      if (boosted && (bm.kind === "turbo")) {
        // turbine backpressure: exhaust manifold pressure ratio vs compressor
        const backFac = O.ts.backP * O.exh.backP * (bm.units === 2 ? 0.82 : 1.0) * (bm.compound ? 1.30 : 1.0) * (dsl ? 0.75 : 1) * (rot ? 0.75 : 1);   // a rotary's port has no valve to choke the blowdown; diesel turbos run near-matched drive pressure
        const pExh = air.p + bBar * 1e5 * backFac * (bm.vgt ? vaneBack(rpm) : 1);
        pmep = (pExh - pMan);
      } else if (boosted) {
        const pExh = air.p * (1 + 0.16 * O.exh.backP * sq(rpm / redline));
        pmep = (pExh - pMan);
      } else {
        const pExh = air.p * (1 + 0.20 * O.exh.backP * sq(rpm / redline));
        pmep = (pExh - pMan);
      }
      if (ts && bm.kind !== "turbo") pmep = air.p * 0.10 * O.xp.backP * sq(rpm / redline) + (tm.blower ? 0 : 0.06e5 * tb.dr);   // no gas-exchange strokes: the pipe's back-pressure and the crankcase pumping
      if (exS) pmep += exDp;                                  // pipe, cat and muffler, on top of the manifold

      /* ---- friction (Chen-Flynn + viscosity) ---------------------------- */
      const mps = 2 * (g.s / 1000) * rpm / 60;
      /* diesel: compression pressure plus the combustion rise; advance puts it nearer TDC. Boost
         heat shortens the delay, so less fuel goes off at once and the rise gets gentler.  */
      const pmaxBar = dsl ? (pMan / 1e5 * Math.pow(cfg.cr, 1.32) + 3.2 * (imep / 1e5) * (1 + 0.03 * tmg) / (1 + 0.08 * bBar)) * (1 + (n2oDsl ? 0.55 : 0.30) * n2oFrac) : (rot ? ROT_PMAX : ts ? TS_PMAX : 1) * K_PMAX * (imep / 1e5) * Math.sqrt(cfg.cr) * (1 - 0.016 * retard)
        * (1 + (O.n2o.prog ? 0.16 : 0.30) * n2oFrac);    // nitrous burns faster and peaks earlier
      let fmepBar = rot ? rotFmepBar(rpm, pmaxBar, g, O.apex) : FM_C + FM_P * pmaxBar + FM_S * mps + FM_S2 * mps * mps;
      fmepBar *= (0.86 + 0.14 * Math.pow(kvOil / 10.5, 0.55)) * O.oil.fricFac;
      fmepBar *= rot ? 1 : O.ring.fric;
      fmepBar *= O.osys.windage + (O.osys.windage < 1 ? 0 : 0);
      if (!rot) fmepBar *= (1 + 0.025 * (O.spr.rate - 1)) * (L.n > 8 ? 1.03 : 1.0);
      let fmep = fmepBar * 1e5;
      if (ts) {   // no valvetrain (uniflow: a light one), rolling bearings and premix on a crankcase engine; a scavenge blower to drive
        fmep = ((tsCaseB ? TS_FC : FM_C) + FM_P * pmaxBar + FM_S * mps + FM_S2 * mps * mps) * O.ring.fric
          * (tsCaseB ? tsLubeK : (0.86 + 0.14 * Math.pow(kvOil / 10.5, 0.55)) * O.oil.fricFac * O.osys.windage) * (tm.valves ? 1 + 0.025 * (O.spr.rate - 1) : 1) * 1e5;
        if (tm.blower) fmep += tsBox * 1e5 * tb.dr / 0.55;
      }
      if (dsl) fmep += 0.10e5;                              // injection pump drive
      // supercharger parasitic drive power appears as extra FMEP
      if (bm.kind === "roots" || bm.kind === "screw" || bm.kind === "centrifugal") {
        // the crank pays the compressor's actual work: mdot*cp*dT over the drive
        fmep += ve * rhoCharge * CP_AIR * Math.max(0, Tc2 - air.T) / 0.96;
      }

      const bmepPa = imep - fmep - pmep;
      const tq = bmepPa * g.Vd / (4 * PI);                 // N.m
      const pw = tq * rpm * 2 * PI / 60;                   // W
      const hp = pw / 745.7;

      /* ---- exhaust gas temperature -------------------------------------- */
      const lamT = clamp((lamE - 0.75) / 0.28, 0, 1.12);
      let egt = 620 + 340 * lamT + 13 * retard + 0.010 * (rpm - 3000)
        + 5.5 * clamp(bmepPa / 1e5 - 11, -6, 22) + 40 * bBar + 8 * (11 - cfg.cr)
        - 0.35 * (evapKr * fd) - 0.10 * (chargeC - 35) + 260 * n2oFrac;
      // diesel: hottest near lambda 1; past that the extra fuel cannot burn and only soaks up heat
      if (dsl) egt = 220 + 650 / Math.pow(Math.max(lamE, 0.95), 1.2) - 250 * Math.max(0, 0.95 - lamE) + 0.03 * (rpm - 2000) - 12 * tmg + 260 * n2oFrac;
      if (n2oDsl) egt += -560 * n2oFrac + 700 * n2oFrac * n2oFrac;   // a moderate shot cools a diesel's exhaust; a big one heats it again
      if (n2oDry) egt += 900 * Math.max(0, lamE - lamC) * Math.min(1, 4 * n2oFrac);   // lean on the bottle
      if (rot) egt += ROT_EGT + O.rh.egtC;
      if (ts) egt += TS_EGT - (dsl ? 0 : 30 * tm.sc * (1 / tb.te - 1));
      if (boosted) egt -= O.icc.egtC || 0;                 // staged water boils off in the burn
      egt = clamp(egt, 380, 1150);
      if (ts) tsPipeT = 0.82 * egt;                         // the pipe runs a little cooler than the port: the next rpm's tune

      rpms.push(rpm);
      mgnCurve.push(dsl ? 99 : margin); rtdCurve.push(retard);
      torque.push(Math.max(0, tq));
      power.push(Math.max(0, hp));
      boostCurve.push(bBar);
      veCurve.push(ve);
      egtCurve.push(egt);
      bmepArr.push(bmepPa / 1e5);

      if (hp > peakHp) { peakHp = hp; peakHpRpm = rpm; flowAtPeak = hp / 10; exFlowPk = exM; exDpPk = exS ? exS.dp(exM, air.p) : 0; exDeltaPk = exDp; }
      if (tq > peakTq) { peakTq = tq; peakTqRpm = rpm; }
      if (pmaxBar > maxPmax) { maxPmax = pmaxBar; maxPmaxRpm = rpm; maxImep = imep / 1e5; }
      if (egt > maxEgt) maxEgt = egt;
      if (retard > maxRetard) maxRetard = retard;
      if (chargeC > maxChargeC) maxChargeC = chargeC;
      if (bBar > maxBoost) maxBoost = bBar;
      const lbmin = dsl ? airKgS * (ts ? 1 / tb.te : 1) * 132.28 : Math.max(0, hp / 10);   // a diesel moves far more air per hp (a two-stroke blows some straight through)
      if (lbmin > maxFlowLb) maxFlowLb = lbmin;
      fuelUsedProxy += (hp > 0 ? hp : 0); ptsProxy++;
    }

    /* recompute the knock state at the peak-pressure point for reporting */
    let knockOnReq = 0, knockMargin = 0, flexW = null;
    if (!dsl) {
      const rpm = maxPmaxRpm || peakTqRpm || 3000;
      const lamK = lamCurve[rpms.indexOf(rpm)] || lamAt(rpm), fdK = lamAt(rpm) / lamK;
      const bBar = MAPB ? boostCurve[rpms.indexOf(rpm)] || 0 : boostAt(rpm, bm, cfg, g);
      const pManAbs0 = air.p + bBar * 1e5;
      const PR = pManAbs0 / air.p;
      let etaC = bm.kind === "roots" ? 0.58 : bm.kind === "screw" ? 0.70 : bm.kind === "centrifugal" ? 0.745 : 0.72;
      const Tc2 = bBar > 0.001 ? air.T * (1 + (Math.pow(PR, 0.2857) - 1) / etaC) : air.T;
      const Tc3 = bBar > 0.001 ? Tc2 - O.icc.eff * (Tc2 - air.T) : air.T;
      const Tcharge = Math.max(air.T - 5, Tc3 - (MAP ? evapCoolK(O.fu, lamAt(rpm)) : evapK) * fdK);
      const pMan = boosted ? pManAbs0 - O.icc.dp * 1e5 : air.p;
      const dyn = ts ? 1 : rot ? rv.dyn(rpm) : 1 - 0.115 * (cfg.cam / 100) * clamp(1.6 - rpm / vm.rpmCam, 0, 1.1);
      const crEff = cfg.cr * Math.pow(pMan / 101325, 0.24) * dyn;
      const chargeC = Tcharge - 273.15;
      knockOnReq = 89.6 + 3.0 * (crEff - 10.55) + 0.095 * (g.b - 86) + 0.135 * (chargeC - 35)
        + 0.10 * (env.coolantC - 90) + 0.85 * tmgAt(rpm) - O.headMat.octane - (boosted ? O.icc.octane || 0 : 0)
        - 5.5 * (O.hd.burn - 1) - 6.0 * clamp(1.0 - lamK, -0.05, 0.22);
      knockOnReq -= O.block.k > 100 ? 0.4 : 0;
      if (rot) knockOnReq = rotOnReq(crEff, chargeC, env.coolantC, cfg.timing, lamK, bBar);
      if (ts) knockOnReq += TS_ON + (O.scv.on || 0);
      knockMargin = fuelON - knockOnReq + (shop.octane || 0) - 0.8 * (O.ink.wet || 0);
      /* flex: the same point on the winter blend. Less ethanol means a little less octane and less evaporative
         cooling; the sensor tells the ECU, which pulls timing for it — power, or knock if it runs out of room. */
      if (O.fu.flex) {
        const fw = flexBlend(flexWinterPct(cfg.ethanolPct)), onW0 = 0.60 * fw.ron + 0.40 * fw.mon;
        const chW = Math.max(air.T - 5, Tc3 - evapCoolK(fw, cfg.lambda) * fdK) - 273.15;
        const onW = knockOnReq + 0.135 * (chW - chargeC);
        const mW = onW0 - onW + (shop.octane || 0) - 0.8 * (O.ink.wet || 0);
        const rNow = clamp(-knockMargin * 1.55, 0, 14), rW = clamp(-mW * 1.55, 0, 14);
        flexW = { pct: fw.ePct, nowPct: O.fu.ePct, onReq: onW, fuelON: onW0, margin: mW, retardDeg: rW,
          lossPct: Math.max(0, 100 * (1 - (1 + 0.0018 * sq(cfg.timing - rNow)) / (1 + 0.0018 * sq(cfg.timing - rW))) + 100 * (chW - chargeC) / (chW + 273.15)) };
      }
    }

    /* diesel combustion noise: the fuel that piles up during the ignition delay all
       goes off at once. High CR, good cetane and a pilot shot soften it. */
    const clatter = dsl ? clamp(0.80 * (17.5 / cfg.cr) * Math.pow(48 / cetane, 0.8) * (1 + 0.05 * tmgAt(peakTqRpm))
      * (1 - 0.68 * dInj.pilot) * (1 + 0.006 * (20 - env.ambientC)), 0, 1) : 0;

    /* =================================================================
       11.  Component loads, temperatures and clearances
       ================================================================= */
    const wRed = redline * 2 * PI / 60;
    const aTdc = g.r * wRed * wRed * (1 + g.lam);        // peak piston accel, m/s^2
    const mpsRed = 2 * (g.s / 1000) * redline / 60;

    // --- reciprocating masses from real densities and sensible sections ---
    const bcm = g.b / 10, scm = g.s / 10, lcm = (g.l * 100);
    const volPis = 0.205 * bcm * bcm * bcm * Math.pow(8.6 / bcm, 0.60);   // cm^3 (b^2.4, not b^3)
    const mPis = O.pis.dens * volPis * 1e-6 * O.pis.massFac;      // kg
    const mPin = 0.30 * mPis, mRings = 0.055 * mPis;
    // steel rods are not sized as b^2: big-bore rods run at lower specific load, so taper the
    // section with bore (a 4.5" big-block rod is ~900 g, not 1.6 kg). Al and Ti keep their tables.
    const volRod = 0.069 * bcm * bcm * lcm * O.rod.massFac * (O.rod.dens > 6000 ? Math.pow(8.6 / bcm, 1.2) : 1);
    const mRod = O.rod.dens * volRod * 1e-6;
    const mRecip = mPis + mPin + mRings + 0.31 * mRod;

    // --- rod ---
    const Frec = mRecip * aTdc * (ts ? (1 - g.lam) / (1 + g.lam) : 1);   // N, TDC exhaust (a two-stroke always compresses at TDC: its worst pull is at BDC)
    const aRod = 0.0125 * g.b * g.b * (O.rod.areaFac || (O.rod.E < 150 ? 1.25 : 1.0)) * (dsl ? 1.25 : 1);  // mm^2 beam area (a diesel rod is sized for firing load)
    const sigRodT = Frec / aRod;                                  // MPa
    const Igyr = aRod * aRod / 2.1;                               // mm^4 (H-beam proxy)
    const lRodMm = g.l * 1000;
    const Pcr = PI * PI * (O.rod.E * 1000) * Igyr / (lRodMm * lRodMm) / 1000;  // kN
    const Fgas = maxPmax * 1e5 * g.Ap;                            // N at peak pressure
    const wPk = (maxPmaxRpm || peakTqRpm) * 2 * PI / 60;
    const Finert = mRecip * g.r * wPk * wPk * (1 + g.lam);
    const Fcomp = Math.max(0, Fgas - Finert);                     // N through the rod

    // --- rod bolts (bolted joint: preload + load factor) ---
    const aBolt = 0.0043 * g.b * g.b;                             // mm^2 stress area, each
    const preload = 0.66 * O.rb.uts;
    const applied = (Frec / 2) / aBolt;                           // MPa per bolt
    let sigBolt = preload + 0.55 * applied;
    if (applied > preload) sigBolt = applied * 1.35;               // joint separates
    // elastic strain of the bolt shank, E = 200 GPa (this is the number you
    // actually measure with a stretch gauge when you tighten a rod bolt)
    const boltStretchPct = 100 * sigBolt / 200000;

    // --- bearings ---
    const djPin = (dsl ? 0.68 : 0.55) * g.b, wPin = (dsl ? 0.30 : 0.21) * g.b * (O.rod.brgW || 1);   // diesel journals are sized for the firing load
    const Aproj = djPin * wPin * (O.brg.areaK || 1);             // mm^2 (oversize race journals)
    const bearMPa = Fcomp / Aproj;
    const filmUm = 0.19 * Math.sqrt(kvOil) * Math.pow(O.oil.hths / 3.6, 0.6)
      * Math.sqrt(peakHpRpm / 1000) * (60 / Math.max(6, bearMPa)) * (O.osys.filmK || 1);

    // --- crank ---
    const overlapMm = 0.585 * g.b - 0.5 * g.s;
    const overlapFac = clamp(1.35 - 0.030 * overlapMm, 0.75, 1.70);
    const Zpin = PI * Math.pow(djPin, 3) / 32;
    const sigCrank = (Fgas * 0.30 * g.b) / Zpin * overlapFac;     // MPa bending at fillet

    // --- torsional ---
    const nEff = L.n / L.banks + 1;
    const f1 = 2600 * O.crk.stiffFac / Math.pow(nEff, 1.15)
      * Math.pow(80 / g.s, 0.35) * Math.pow(86 / g.b, 0.15);
    const majorOrder = ts ? L.n : L.n / 2;   // a two-stroke fires every cylinder every turn
    const resRpm = f1 * 60 / majorOrder;
    const inRes = resRpm > 1200 && resRpm < redline * 1.03;
    const torAmp = 0.30 * (peakTq * 4 * PI / g.Vd / 1e5 / 12) * Math.pow(nEff / 5, 1.6)
      * (1 - O.dmp.damping) * (inRes ? 1.9 : 0.55);
    const torLimit = O.crk.fatigue / 260;        // degrees of allowable twist
    const torUtil = torAmp / torLimit;

    // --- thermals ---
    const bmepPk = peakTq * 4 * PI / g.Vd / 1e5;                  // bar at peak torque
    const heatIdx = Math.pow(bmepPk * Math.sqrt(peakHpRpm / 1000), 0.62);
    // a diesel's extra BMEP comes with extra air, so its bowl rim follows gas temperature (fuelling) more than load
    let crownC = env.coolantC + (dsl ? 100 * Math.pow(bmepPk * Math.sqrt(peakHpRpm / 1000), 0.25) : K_CROWN * heatIdx) * (140 / O.pis.k)
      * Math.pow(g.b / 86, 0.55) - O.sq.crownC * (dsl ? 2 : 1) - (O.pis.crownCool || 0);   // diesel jets feed a cooling gallery
    crownC -= 0.22 * evapK * fdTop;                                // alcohols cool the crown too
    if (dsl) crownC += 0.30 * clamp(maxEgt - 700, -200, 500);     // diesel: overfuelling is what cooks the bowl rim
    else crownC -= 150 * clamp(1 - lamTop, 0, 0.25);               // enrichment is crown cooling (what arrived, at the leanest point)
    if (!dsl) crownC += 200 * clamp(lamTop - lamAt(leanRpm), 0, 0.35); // a starved rail leans the cylinders unevenly; the worst one melts
    if (n2oDry) crownC += 1600 * clamp(n2oLeanPk, 0, 0.3) * clamp(n2oBite, 0.25, 1.5);   // a lean nitrous cylinder: the crown edge goes first
    crownC *= (1 - 0.05 * (O.block.k > 100 ? 1 : 0));
    crownC = env.coolantC + (crownC - env.coolantC) * (O.sq.crownK || 1);   // twin jets: the crown runs 5% less hot over the coolant
    if (ts) crownC = env.coolantC + (crownC - env.coolantC) * TS_CROWN * O.scv.crownK;   // a power stroke every turn
    crownC = clamp(crownC, env.coolantC + 40, 900);
    const skirtC = 0.22 * crownC + 0.78 * (env.coolantC + 15);
    const boreWallC = env.coolantC + 26;
    const chargeCOut = maxChargeC;

    // --- clearances (real thermal expansion) ---
    const coldMm = O.pc.fac * g.b;
    const boreAlpha = O.block.boreAlpha;
    const growBore = g.b * boreAlpha * (boreWallC - 20);
    const growPis = g.b * 0.62 * O.pis.alpha * (skirtC - 20);
    const hotMm = coldMm + growBore - growPis;

    // --- ring gap ---
    const egtApp = 1.0 + (dsl ? 0.12 : 0.18) * maxBoost + clamp((maxEgt - 850) / 500, 0, 0.50)
      + (O.fu.corrosive > 0.5 ? 0.05 : 0);
    const ringGapMm = g.b * O.ring.gapSet;
    const ringGapNeededMm = g.b * 0.0035 * egtApp;

    // --- head clamp / gasket ---
    const boltsPerCyl = O.std.bolts || 4;        // fasteners around each bore
    const castAlu = (cfg.blockMat === "alu_liners" || cfg.blockMat === "alu_nikasil");
    const pullOut = castAlu ? Math.pow(O.std.pullOut || 1, 0.6) : 1;   // thread pull-out in cast aluminium
    const clampKn = boltsPerCyl * O.std.clampKn / pullOut * (dsl ? DSL_CLAMP : 1);
    const clampWorkKn = 0.50 * clampKn;          // sealing practice: clamp >= 2x gas load
    const headLiftUtil = (Fgas / 1000) / clampWorkKn;
    const bayDeck = [520, 700, 790][L.bay] * (dsl ? 1.25 : 1);   // a 2JZ block is ~690 mm; the old 640 pinched every inline-six past a 90 mm bore. Truck and tractor bays take a longer block
    const cylPerBank = L.n / L.banks;
    const pitchWant = Math.max(1.145 * (0.48 * g.b + 0.55 * g.s), g.b * 1.115) * O.block.spacingAdj;
    const borePitch = Math.min(pitchWant, bayDeck / (cylPerBank + 0.65));
    const dAlpha = Math.abs(O.headMat.alpha - O.block.alpha);
    const deckDT = (env.coolantC - 20) + 0.10 * Math.max(0, crownC - 200);
    const scrubUm = dAlpha * deckDT * (0.55 * borePitch) * 1000
      * (1 + 0.004 * ((dsl ? maxPmax / DSL_CLAMP : maxPmax) - 60));
    const gasketShearUtil = scrubUm / O.gsk.shearUm;
    const gasketPmaxBar = O.gsk.maxPmaxBar * (O.gsk.maxPmaxBar >= 200 && !O.gsk.fireRing ? (O.std.oring || 1) : 1) * (dsl ? DSL_GASKET : 1);
    const gasketPmaxUtil = maxPmax / gasketPmaxBar;
    // MLS needs a ground deck; a composite-era rough deck defeats it
    const deckRough = (cfg.blockMat === "grey_iron" && cfg.gasket === "mls") ? 1.0 : 1.0;

    // --- bore distortion ---
    const boreDist = 0.22 * maxPmax / blockStiff * Math.pow(g.b / 86, 1.5)
      * Math.pow(1.18 / O.block.spacing, 0.8);                     // microns
    const wallThicknessMm = (borePitch - g.b) / 2;
    const wallLimit = cfg.blockMat === "grey_iron" ? 3.0 : (cfg.blockMat === "cgi" || cfg.blockMat === "cgi_filled") ? 2.8
      : cfg.blockMat === "alu_nikasil" ? 3.5 : 4.5;

    // --- valvetrain ---
    const massEff = 0.45 * O.valve.massFac + 0.55 * O.spr.massFac;
    const floatRpm = O.hd.floatBase * Math.sqrt(O.spr.rate / massEff)
      * (1 - 0.25 * (cfg.lift / 100 - 0.35)) * Math.pow(86 / g.b, 0.35);
    const floatUtil = redline / floatRpm;
    const dvMm = O.hd.kv * g.b;
    const maxLiftMm = vm.liftRatio * dvMm;
    const liftAtOverlap = maxLiftMm * (0.10 + 0.55 * sq(cfg.cam / 100));
    const domeMm = dsl ? 0 : Math.max(0, (cfg.cr - 10.5) * 0.35 * (86 / g.b));   // a diesel gets its CR from a flat top and a bowl in the piston
    const pistonDrop = g.r * 1000 * (1 - Math.cos(12 * PI / 180))
      + sq(g.r * 1000 * Math.sin(12 * PI / 180)) / (2 * lRodMm);
    const pocketMm = 4.4 + (O.hd.nIV === 2 ? 1.3 : 0);
    const valvePistonMm = pocketMm - domeMm + pistonDrop - liftAtOverlap;
    const valveC = 0.62 * maxEgt + 120 - O.valve.coolC;

    // --- oiling / cooling ---
    const gProfile = env.gLat > 0 ? env.gLat : env.testType === "endurance"   // gLat: a race car's own sustained cornering (the 24 Hours)
      ? (env.loadProfile === "track" ? 1.25 : env.loadProfile === "highway" ? 0.30 : 0.60)
      : 0.35;
    const pumpLimit = (cfg.oilSystem === "dry" || cfg.oilSystem === "dry_hv" ? 13000 : cfg.oilSystem === "baffled" ? 10000 : 9000) + (rot ? 2500 : 0);   // a rotary's pump is geared down off the e-shaft
    const starveUtil = Math.max(gProfile / O.osys.gLimit, redline / pumpLimit);
    const duty = env.testType === "endurance"
      ? (env.loadProfile === "track" ? 1.0 : env.loadProfile === "highway" ? 0.55 : 0.75) : 0.62;
    const Qkw = peakHp * KW_PER_HP * 0.82 * duty * (O.fu.lhv < 35e6 ? 0.94 : 1.0) * (rot ? ROT_HEAT : 1) * (boosted && O.icc.heatK ? O.icc.heatK : 1);   // water-meth boils off some of the combustion heat
    const radKw = (g.Vd * 1000) * 72 * O.cool.cap
      * (cfg.blockMat === "alu_liners" || cfg.blockMat === "alu_nikasil" ? O.deck.cool : 1.0) * (O.block.cool || 1)
      + (O.cool.addKw || 0);   // the biggest packs are sized to the car, not the displacement
    const coolUtil = Qkw / radKw;
    const oilCOut = env.oilC + (O.sq.oilHeatKw > 0 ? 8 : 0) + clamp((coolUtil - 0.7) * 40, 0, 45) - (O.cool.oilCoolC || 0);

    // --- compressor / turbine ---
    const pd = bm.kind === "roots" || bm.kind === "screw";
    const compCap = boosted && !pd ? O.ts.maxFlow * bm.units * (bm.compound ? 1.42 : 1) * (bm.kind === "centrifugal" ? 1.35 : 1) : 999;   // a centrifugal head unit of a given wheel size flows a little more than the same turbo wheel (no turbine back-pressure)
    const compUtil = boosted ? (pd ? 0.55 : maxFlowLb / compCap) : 0.15;
    const turbUtil = (bm.kind === "turbo") ? maxEgt / O.tm.maxEgtC : (boosted ? 0.35 : 0.15);

    /* ---- rotary: apex seals, housings, eccentric shaft, rotor bearings, seal oiling ---- */
    let RT = null;
    if (rot) {
      const sl = O.apex, hs = O.rh, sp = O.rsp, es = O.esh, om = O.omp, pt = O.port;
      const Rm = g.R, em = g.e, Bm = g.B;
      const wR = redline * 2 * PI / 60;
      const vApex = Rm * wR / 3 + em * wR;                         // m/s: seal tip sliding along the housing (rotor spin + orbit)
      const aApex = Rm * sq(wR / 3) + em * wR * wR;                // m/s^2 flinging the seal outward
      // seal bending across its slot under the pressure difference; knock is what actually breaks seals
      const knockAmp = 1 + (0.40 + 1.0 * sl.brittle) * clamp(-knockMargin / 2, 0, 3);
      const sigSeal = ROT_SHOCK * 3 * (maxPmax * knockAmp / 10) * sq(2.6 / sl.thick);   // MPa
      const sealMass = sl.dens * sl.thick / (7200 * 3);
      const chatterLim = ROT_VLIM * hs.chatter / Math.pow(sealMass, 0.25);
      // the hot lobe: combustion always happens on the same stretch of housing, so it never cools
      const bmepR = peakTq * 4 * PI / g.Vd / 1e5;
      const heatR = Math.pow(Math.max(0.5, bmepR) * Math.sqrt(peakHpRpm / 1000), 0.62);
      const housingC = env.coolantC + ROT_HOUSE * heatR * (1 + 0.25 * maxBoost) / Math.pow(O.cool.cap, 0.35) + hs.hotC + 0.10 * clamp(maxEgt - 900, -150, 250);
      // eccentric shaft: rotor orbit (centrifugal) + gas push on each rotor, carried between the main bearings
      const mRotor = 4.6 * (cfg.bore / 80) * sq(cfg.stroke / 105);
      const Fcent = mRotor * em * wR * wR;
      const FgasR = maxPmax * 1e5 * Bm * Rm * Math.sqrt(3) * 0.6;
      const Fe = Fcent + 0.5 * FgasR;
      const sup = Math.max(2, Math.min(es.supports, L.n + 1));
      const span = (L.n * (Bm + 0.035) + 0.05) / (sup - 1), perSpan = L.n / (sup - 1);
      const dSh = 0.043 * (Rm / 0.105) * es.dFac;
      const eshUm = ROT_ESH * Fe * Math.sqrt(perSpan) * span * span / (Math.pow(dSh / 0.043, 4) * Math.sqrt(sp.stiff));
      const eshMPa = (Fe * span / 4) / (PI * Math.pow(dSh * 60 / 43, 3) / 32) / 1e6;
      const eshUtil = Math.max(eshUm / 50, eshMPa / (0.8 * es.fatigue));
      // rotor bearing: the gas push less the orbit it is partly cancelled by, or the orbit alone at redline
      const wPkR = (maxPmaxRpm || peakTqRpm) * 2 * PI / 60;
      const dRB = 0.70 * cfg.stroke, wRB = 0.36 * cfg.bore;
      const FrB = Math.max(FgasR - 0.5 * mRotor * em * wPkR * wPkR, 0.8 * Fcent);
      const brgMPa = FrB / (dRB * wRB);
      const brgLimR = Math.round(O.brg.limitMPa * ((O.fu.corrosive > 0.5 && !O.brg.methanolOK) ? 0.80 : 1));
      const filmR = 0.19 * Math.sqrt(kvOil) * Math.pow(O.oil.hths / 3.6, 0.6) * Math.sqrt(peakHpRpm / 1000) * (60 / Math.max(6, brgMPa));
      // seal oiling: the apex and side seals live on oil burnt with the charge
      const oilDemand = Math.pow(redline / 7000, 1.6) * (1 + 0.35 * maxBoost) * Math.pow(Math.max(20, maxPmax) / 50, 0.4) * sl.wear;
      const oilUtil = 0.45 * oilDemand / om.cap;
      // carbon: rich, oily, never revved - the side seals stick in their grooves
      const profK = env.testType === "endurance" ? (env.loadProfile === "track" ? 0.75 : env.loadProfile === "highway" ? 1.35 : 1.0) : 1.0;
      const fuelK = O.fu.afr < 12 ? 0.70 : O.fu.ron >= 104 ? 1.20 : 1.0;
      const carbon = 0.42 * om.carbon * profK * fuelK * sp.sideSeal * (1 + 1.5 * clamp(0.92 - cfg.lambda, 0, 0.2)) * (1 + 0.35 * pt.overlap);
      const detR = (0.95 - knockMargin * 0.062) * (1 + 0.45 * sl.brittle * clamp(-knockMargin / 4, 0, 1)) * (1 + 0.12 * maxBoost);
      const hotSpotR = housingC + 0.30 * maxEgt + 80, hotLimR = 640 + 4.0 * (fuelON - 91);
      RT = { rotors: L.n, VdNomL: g.VdNom * 1000, VdEqL: g.Vd * 1000, chamberCc: g.Vch * 1e6, eshaftRpm: redline, rotorRpm: Math.round(redline / 3),
        firingHz: L.n * redline / 60, apexMs: vApex, apexG: aApex / 9.81, knockAmp: knockAmp, sealMPa: sigSeal, sealUtil: sigSeal / sl.fatigue,
        chatterLim: chatterLim, chatterUtil: vApex / chatterLim, housingC: housingC, oringLim: 200, bmep: bmepR,
        mRotor: mRotor, centKn: Fcent / 1000, gasKn: FgasR / 1000, eshaftUm: eshUm, eshaftMPa: eshMPa, eshaftUtil: eshUtil, supports: sup,
        brgMPa: brgMPa, brgLim: brgLimR, filmUm: filmR, oilUtil: oilUtil, carbon: carbon, det: detR, hotSpot: hotSpotR, hotLim: hotLimR,
        idleRpm: pt.idle, overlap: pt.overlap, egtC: maxEgt, oilL: om.oilL * (1 + 0.5 * maxBoost) * Math.pow(redline / 7000, 0.5) };
    }

    /* ---- two-stroke: delivery and trapping at peak power, the pipe, and what the ports, the oil and the pipe ask of the parts ---- */
    let TSI = null;
    if (ts) {
      const iP = Math.max(0, rpms.indexOf(peakHpRpm));
      // where it comes on the pipe: the steepest climb in torque below peak power; the band is where it holds 70% of peak power
      let onPipe = rpms[0], climb = -1;
      for (let i = 2; i < torque.length; i++) { const d = torque[i] - torque[i - 2]; if (d > climb && rpms[i] <= peakHpRpm) { climb = d; onPipe = rpms[i - 1]; } }
      const pw70 = rpms.filter((r, i) => power[i] >= 0.7 * peakHp);
      const drP = tsDr[iP] || 0, teP = tsTe[iP] || 0;
      const lubK = !tsCaseB ? 0.70 : cfg.lube === "inject" ? 0.85 : Math.pow(tsLubR / 50, 0.5);
      const leanK = dsl ? 1 : 1 + 4 * Math.max(0, lamTop - 0.88);
      const clrK = Math.pow(0.0009 / O.pc.fac, 0.25);
      const pipeTpk = 0.82 * maxEgt;
      const lamIdle = MAP ? mapLook(MAP, MAP.lam, Math.min(redline, 1500), 20) : cfg.lambda;
      const tbLow = tsBreathe(1000, tm, boostCurve[0] || 0, 0.82 * 600);
      const sealMs = PI * (0.42 * g.b / 1000 + 0.010) * redline / 60;
      TSI = { firingHz: L.n * redline / 60, swept: g.VdNom * 1000, eq: g.Vd * 1000, rpmP: Math.round(tm.rpmP), ep: tm.ep, tp: tm.tp, ccr: tsCaseB ? tm.ccr : null,
        drPk: drP, tePk: teP, cePk: drP * teP, scChargePct: Math.round((1 - teP) * 100),
        scFuelPct: Math.round(tm.sc * (1 - teP) / Math.max(0.05, teP + tm.sc * (1 - teP)) * 100),
        pipe: cfg.xpipe, pipeRpm: tm.chamber ? Math.round(tm.pipeRpm) : 0, pipeTune: Math.round(tsTune[iP] || 0), pipeT: pipeTpk,
        onPipe: onPipe, band: pw70.length ? [pw70[0], pw70[pw70.length - 1]] : [peakHpRpm, peakHpRpm],
        // piston seizure: a hot exhaust side, the oil in the charge and the clearance it has to grow into
        seize: 0.62 * (crownC / O.pis.maxCrownC) * lubK * leanK * clrK / Math.pow(O.cool.cap, 0.15),
        // rings and port bridges: a wide, tall exhaust port and piston speed wear the ring ends that brush its edges
        portW: (mpsRed / 20.5) * sq(tm.ep / 185) * (tm.valves ? 0.6 : 1) * 0.72 * (O.ring.gapSet > 0.005 ? 0.92 : 1),
        // crankcase seals: lip speed on the main journals and the pressure the crankcase pumps to
        sealMs: sealMs, seals: sealMs / 30 * (tsCaseB ? 1 + Math.max(0, tm.ccr - 1.30) : 0.6) * (1 + 0.002 * Math.max(0, maxEgt - 700)),
        // the chamber: heat and the engine's own shake work-harden the welds and the mounts
        pipeU: tm.chamber ? (pipeTpk / 820) * (0.5 + 0.4 * Math.min(1, L.firstOrder)) * Math.sqrt(redline / 9000) : 0,
        // plug fouling: rich at idle, oil in the mix, a carburettor wetting the plug
        foul: dsl ? 0 : clamp(0.35 + 2.2 * Math.max(0, 0.92 - lamIdle) + (tsCaseB && cfg.lube !== "inject" ? 0.25 * (40 / tsLubR - 0.8) : 0)
          + (cfg.tsFuel === "carb" ? 0.05 : cfg.tsFuel === "di" ? -0.08 : 0) - 0.01 * clamp(cfg.timing, -10, 15), 0.05, 3),
        // scavenge air at idle: what is left to push the exhaust out at 1,000 rpm
        drLow: tbLow.dr, scav: 0.55 / Math.max(0.02, tbLow.dr),
        lube: tsCaseB ? cfg.lube : "sump", lubR: tsLubR, oilLph: tsCaseB ? (fuelLph[iP] || 0) / (cfg.lube === "inject" ? 70 : tsLubR) : 0,
        boxBar: tsBoxPk, blower: tm.blower, valves: tm.valves, opposed: !!L.opposed, idleRpm: tm.chamber && tm.ep > 180 ? 1600 : tm.blower ? 600 : 1100 };
    }

    /* =================================================================
