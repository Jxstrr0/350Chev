  /* =====================================================================
     ENGINE SWAPS — one vehicle catalogue and one fit check, shared by every event that puts the
     engine in a car (road test, drag, salt, 24 h). Nothing here runs unless a swap vehicle is chosen.
       size     the engine's box (length × width × height, mm) from its layout, bore, stroke, rod,
                heads, induction and charger: crank centre to deck = ½ stroke + rod + piston,
                a bank's reach = deck + head; a vee folds its banks by half the bank angle
       bay      the room between radiator and firewall, the shock towers, crossmember to hood.
                A transverse bay (FWD compacts) takes the engine's length across the car.
       driveline gearbox and axle ratings are engine-side torque (N·m at the crank, through 1st):
                over the rating, it breaks the first time it sees full load
       cooling  the radiator's sustained heat rejection (kW) against ~70% of the engine's peak
                coolant load: short of it, a long event cooks it; a quarter mile never notices
       balance  the engine's mass sits at xE (share of it carried on the front axle); the chassis
                handles on the new mass and the new front share, the brakes stay the size they were
     ===================================================================== */
  const SW_R = { car3: [3.3, 1.9, 1.0], car4: [3.0, 1.95, 1.35, 1.0], car5: [3.45, 2.05, 1.38, 1.0, 0.82], fwd4: [3.6, 2.1, 1.4, 1.0], fwd5: [3.25, 1.9, 1.3, 1.03, 0.85],
    truck4: [6.5, 3.6, 1.7, 1.0], truck5: [5.6, 3.1, 1.7, 1.0, 0.78], semi: [12.6, 8.4, 6.0, 4.3, 3.2, 2.4, 1.8, 1.35, 1.0], tractor: [8.0, 5.5, 3.9, 2.8, 2.0, 1.45], mower: [2.6, 1.6, 1.0] };
  /* the catalogue. bay [fore-aft, across, crossmember-to-hood] mm; tv = transverse bay; mass kg with the stock engine of `eng` kg;
     front = static front share; xE = share of the engine's weight on the front axle (1.0 over it, <0 behind the rear axle);
     gbx/axle = rated engine-side N·m; rad = radiator kW sustained; cd × area = drag; look = road-scene body; fam = stock engine (preset id) */
  const VEHICLES = {
    chevelle: { n: "'70 Chevelle SS", g: "muscle", bay: [960, 860, 780], mass: 1590, eng: 243, front: 0.55, xE: 0.95, drive: "rwd", gbx: 620, axle: 950, tyre: 26.5, rad: 125, cd: 0.48, area: 1.95, fam: "sbc350", famN: "350 small-block V8", look: "muscle", wb: 2.84, cgH: 0.53, ratios: "car4", shift: 0.32, brake: 0.92, tc: "street", rr: 0.012, price: 18000, shape: "sedan" },
    mustang: { n: "'67 Mustang fastback", g: "muscle", bay: [880, 790, 740], mass: 1300, eng: 220, front: 0.56, xE: 0.95, drive: "rwd", gbx: 560, axle: 750, tyre: 25.4, rad: 95, cd: 0.45, area: 1.85, fam: "sbc350", famN: "289 small-block V8", look: "muscle", wb: 2.74, cgH: 0.51, ratios: "car4", shift: 0.3, brake: 0.9, tc: "street", rr: 0.012, price: 22000, shape: "fastback" },
    civic: { n: "'92 Civic hatch", g: "compact", bay: [560, 740, 650], tv: 1, mass: 1010, eng: 149, front: 0.62, xE: 1.05, drive: "fwd", gbx: 300, axle: 340, tyre: 23.0, rad: 48, cd: 0.32, area: 1.85, fam: "d15b", famN: "1.5 SOHC four", look: "hatch", wb: 2.57, cgH: 0.5, ratios: "fwd5", shift: 0.24, brake: 1.0, tc: "street", rr: 0.011, price: 3500, shape: "hatch" },
    miata: { n: "'90 Miata", g: "compact", bay: [780, 620, 650], mass: 960, eng: 138, front: 0.52, xE: 0.92, drive: "rwd", gbx: 280, axle: 320, tyre: 22.6, rad: 52, cd: 0.38, area: 1.72, fam: "4age20v", famN: "1.6 DOHC four", look: "roadster", wb: 2.27, cgH: 0.44, ratios: "car5", shift: 0.2, brake: 1.05, tc: "sport", rr: 0.011, price: 6000, shape: "roadster" },
    c10: { n: "'72 C10 pickup", g: "truck", bay: [1000, 880, 880], mass: 1720, eng: 243, front: 0.57, xE: 1.0, drive: "rwd", gbx: 650, axle: 1150, tyre: 28.5, rad: 120, cd: 0.5, area: 2.8, fam: "sbc350", famN: "350 small-block V8", look: "pickup", wb: 2.92, cgH: 0.66, ratios: "truck4", shift: 0.45, brake: 0.85, tc: "eco", rr: 0.013, price: 9000, shape: "pickup" },
    f100: { n: "'56 F-100", g: "truck", bay: [900, 790, 840], mass: 1560, eng: 243, front: 0.58, xE: 1.0, drive: "rwd", gbx: 460, axle: 760, tyre: 28.0, rad: 90, cd: 0.55, area: 2.7, fam: "sbc350", famN: "272 Y-block V8", look: "pickup", wb: 2.80, cgH: 0.68, ratios: "truck4", shift: 0.5, brake: 0.78, tc: "eco", rr: 0.014, price: 12000, shape: "pickup" },
    trabant: { n: "Trabant 601", g: "odd", bay: [430, 620, 520], tv: 1, mass: 615, eng: 39, front: 0.58, xE: 1.05, drive: "fwd", gbx: 80, axle: 95, tyre: 22.1, rad: 12, cd: 0.42, area: 1.52, fam: "trabant601", famN: "594 cc two-stroke twin", look: "hatch", wb: 2.02, cgH: 0.5, ratios: "fwd4", shift: 0.3, brake: 0.85, tc: "eco", rr: 0.012, price: 1500, shape: "trabant" },
    saab96: { n: "Saab 96", g: "odd", bay: [660, 640, 540], mass: 880, eng: 51, front: 0.62, xE: 1.15, drive: "fwd", gbx: 120, axle: 140, tyre: 23.0, rad: 24, cd: 0.35, area: 1.75, fam: "saab96", famN: "841 cc two-stroke triple", look: "hatch", wb: 2.49, cgH: 0.52, ratios: "fwd4", shift: 0.32, brake: 0.88, tc: "eco", rr: 0.012, price: 2500, shape: "saab" },
    beetle: { n: "VW Beetle 1300", g: "odd", bay: [560, 900, 560], mass: 820, eng: 100, front: 0.41, xE: -0.12, drive: "rwd", gbx: 190, axle: 210, tyre: 24.6, rad: 30, cd: 0.48, area: 1.8, fam: "ea82", famN: "air-cooled flat-four", look: "hatch", wb: 2.40, cgH: 0.52, ratios: "car4", shift: 0.32, brake: 0.85, tc: "eco", rr: 0.012, price: 3000, shape: "beetle", rear: 1 },
    jeep: { n: "CJ-5 Jeep", g: "truck", bay: [1000, 720, 780], mass: 1180, eng: 252, front: 0.54, xE: 1.0, drive: "awd", gbx: 420, axle: 700, tyre: 31.0, rad: 75, cd: 0.62, area: 2.6, fam: "ford300", famN: "258 straight six", look: "pickup", wb: 2.12, cgH: 0.68, ratios: "truck4", shift: 0.45, brake: 0.8, tc: "eco", rr: 0.016, price: 7000, shape: "jeep" },
    semi: { n: "Long-nose highway tractor", g: "heavy", bay: [1750, 1060, 1260], mass: 8200, eng: 505, front: 0.45, xE: 0.95, drive: "rwd", gbx: 2700, axle: 3600, tyre: 41.0, rad: 430, cd: 0.7, area: 9.5, fam: "s60", famN: "12.7 L big-rig six", look: "pickup", wb: 5.8, cgH: 1.2, ratios: "semi", shift: 1.0, brake: 0.6, tc: "eco", rr: 0.007, price: 35000, shape: "semi" },
    tractor: { n: "Row-crop farm tractor", g: "heavy", bay: [1250, 720, 900], mass: 4800, eng: 281, front: 0.35, xE: 0.9, drive: "rwd", gbx: 1100, axle: 3800, tyre: 58.0, rad: 70, cd: 0.9, area: 4.5, fam: "p4236", famN: "3.9 L farm four", look: "pickup", wb: 2.6, cgH: 1.0, ratios: "tractor", shift: 0.8, brake: 0.5, tc: "eco", rr: 0.025, price: 14000, shape: "tractor" },
    mini: { n: "Classic Mini", g: "compact", bay: [520, 660, 660], tv: 1, mass: 650, eng: 122, front: 0.62, xE: 1.05, drive: "fwd", gbx: 170, axle: 180, tyre: 19.6, rad: 32, cd: 0.36, area: 1.6, fam: "g10", famN: "1.0 A-series four", look: "hatch", wb: 2.04, cgH: 0.47, ratios: "fwd4", shift: 0.3, brake: 0.9, tc: "street", rr: 0.012, price: 5000, shape: "mini" },
    crownvic: { n: "Crown Vic interceptor", g: "muscle", bay: [920, 880, 760], mass: 1820, eng: 194, front: 0.55, xE: 0.95, drive: "rwd", gbx: 720, axle: 820, tyre: 27.0, rad: 150, cd: 0.34, area: 2.3, fam: "coyote", famN: "4.6 modular V8", look: "muscle", wb: 2.91, cgH: 0.55, ratios: "car4", shift: 0.35, brake: 0.95, tc: "street", rr: 0.011, price: 4000, shape: "sedan" },
    volvo240: { n: "Volvo 240 wagon", g: "compact", bay: [840, 700, 700], mass: 1370, eng: 179, front: 0.53, xE: 0.95, drive: "rwd", gbx: 380, axle: 460, tyre: 25.0, rad: 70, cd: 0.45, area: 2.1, fam: "lima23", famN: "2.3 redblock four", look: "coupe", wb: 2.64, cgH: 0.54, ratios: "car4", shift: 0.32, brake: 0.92, tc: "street", rr: 0.012, price: 2500, shape: "wagon" },
    p911: { n: "Air-cooled 911", g: "muscle", bay: [700, 1060, 580], mass: 1100, eng: 216, front: 0.40, xE: -0.15, drive: "rwd", gbx: 600, axle: 640, tyre: 24.6, rad: 130, cd: 0.38, area: 1.75, fam: "f6_38", famN: "air-cooled flat-six", look: "coupe", wb: 2.27, cgH: 0.46, ratios: "car5", shift: 0.24, brake: 1.02, tc: "sport", rr: 0.011, price: 45000, shape: "p911", rear: 1 },
    seven: { n: "Lotus-style Seven", g: "compact", bay: [700, 560, 640], mass: 560, eng: 157, front: 0.5, xE: 0.92, drive: "rwd", gbx: 260, axle: 300, tyre: 22.0, rad: 40, cd: 0.65, area: 1.3, fam: "kent", famN: "1.6 crossflow four", look: "roadster", wb: 2.24, cgH: 0.38, ratios: "car4", shift: 0.2, brake: 1.05, tc: "sport", rr: 0.012, price: 9000, shape: "seven" },
    hearse: { n: "'59 Cadillac hearse", g: "odd", bay: [1020, 900, 820], mass: 2650, eng: 257, front: 0.55, xE: 0.95, drive: "rwd", gbx: 800, axle: 1000, tyre: 28.0, rad: 130, cd: 0.5, area: 2.6, fam: "godzilla73", famN: "390 V8", look: "muscle", wb: 3.96, cgH: 0.62, ratios: "car3", shift: 0.5, brake: 0.75, tc: "street", rr: 0.013, price: 16000, shape: "hearse" },
    mower: { n: "Ride-on lawn mower", g: "odd", bay: [500, 440, 520], mass: 190, eng: 23, front: 0.4, xE: 0.2, drive: "rwd", gbx: 55, axle: 70, tyre: 18.0, rad: 15, cd: 1.0, area: 1.1, fam: "ktm250sx", famN: "one-lunger", look: "roadster", wb: 1.2, cgH: 0.45, ratios: "mower", shift: 0.4, brake: 0.6, tc: "eco", rr: 0.03, price: 800, shape: "mower", rear: 1 },
    t2bus: { n: "VW T2 bus", g: "odd", bay: [600, 1000, 520], mass: 1200, eng: 100, front: 0.45, xE: -0.1, drive: "rwd", gbx: 200, axle: 220, tyre: 24.6, rad: 30, cd: 0.44, area: 2.9, fam: "ea82", famN: "air-cooled flat-four", look: "pickup", wb: 2.4, cgH: 0.75, ratios: "car4", shift: 0.4, brake: 0.8, tc: "eco", rr: 0.013, price: 9000, shape: "bus", rear: 1 }
  };
  for (const k in VEHICLES) VEHICLES[k].id = k;
  const VEH_GROUPS = [["muscle", "Muscle & V8"], ["compact", "Compact & light"], ["truck", "Trucks"], ["heavy", "Heavy iron"], ["odd", "Oddballs"]];
  /* the fixes. bay: [extra fore-aft, across, height] mm; inf: makes room for anything; cap: driveline rating (N·m) it brings;
     radK: radiator multiplier; dcd / darea: drag; dxE: moves the engine back (share on the front axle); kg added; tier groups replace each other */
  const SWAP_FIX = {
    firewall: { n: "Cut and box the firewall", grp: "len", bay: [180, 0, 0], dxE: -0.04, kg: 6, cost: 1400, d: "the engine sits 180 mm further back" },
    cabin: { n: "Set it back into the cabin", grp: "len", bay: [700, 0, 0], dxE: -0.2, kg: 18, cost: 5200, need: "firewall", d: "the passenger seat goes; the bellhousing is where the dash was" },
    tubs: { n: "Notch the rails and tub the fenders", grp: "wid", bay: [0, 200, 0], kg: 12, cost: 2400, d: "200 mm more between the shock towers" },
    scoop: { n: "Hood scoop", grp: "hgt", bay: [0, 0, 160], dcd: 0.02, kg: 3, cost: 650, d: "160 mm of headroom and a bit of drag" },
    hood: { n: "Through the hood", grp: "hgt", bay: [0, 0, 650], dcd: 0.06, darea: 0.12, kg: 0, cost: 1600, need: "scoop", d: "the hood is cut away; the engine pokes out into the weather" },
    shell: { n: "Shell over the top", grp: "inf", inf: 1, dcd: 0.1, kg: 140, cost: 14000, d: "a tube frame under the engine, and the body bolted on over it like a hat" },
    gbx1: { n: "Heavy-duty gearbox", grp: "gbx", tier: 1, cap: 950, kg: 25, cost: 2400, d: "rated 950 N·m" },
    gbx2: { n: "Race / truck gearbox", grp: "gbx", tier: 2, cap: 2600, kg: 70, cost: 6800, d: "rated 2,600 N·m" },
    gbx3: { n: "Planetary drag box", grp: "gbx", tier: 3, cap: 12000, kg: 160, cost: 18000, d: "rated 12,000 N·m" },
    axle1: { n: "Built 9-inch / heavy CVs", grp: "axle", tier: 1, cap: 1600, kg: 40, cost: 2800, d: "rated 1,600 N·m" },
    axle2: { n: "Full-floating truck axle", grp: "axle", tier: 2, cap: 4200, kg: 120, cost: 6500, d: "rated 4,200 N·m" },
    axle3: { n: "Mining-truck planetary axle", grp: "axle", tier: 3, cap: 16000, kg: 420, cost: 16000, d: "rated 16,000 N·m" },
    rad1: { n: "Big aluminium radiator + fans", grp: "rad", tier: 1, radK: 1.6, kg: 12, cost: 900, d: "1.6× the heat out" },
    rad2: { n: "Race cooling pack + ducting", grp: "rad", tier: 2, radK: 2.6, dcd: 0.01, kg: 30, cost: 3200, d: "2.6× the heat out" },
    rad3: { n: "Roof radiator", grp: "rad", tier: 3, radK: 4.5, dcd: 0.05, darea: 0.15, kg: 45, cost: 2600, d: "4.5× the heat out, and it looks exactly as stupid as it sounds" }
  };
  for (const k in SWAP_FIX) SWAP_FIX[k].id = k;

  /* the engine's box (mm): length along the crank, width across it, height from the bottom of the pan to the top of the intake */
  function engineDims(cfg) {
    cfg = Object.assign({}, DEFAULT_CFG, cfg || {});
    const L = LAYOUTS[cfg.layout] || LAYOUTS.I4, n = L.n, b = +cfg.bore || 86, s = +cfg.stroke || 86, rr = +cfg.rodRatio || 1.7;
    const two = !!L.two || cfg.cycle === "two", asp = OPT.asp[cfg.asp] || OPT.asp.na, kind = asp.kind, dsl = !!(OPT.fuel[cfg.fuel] || {}).ci;
    const headH = two ? 70 : ({ sohc2v: 150, dohc4v: 190, dohc4v_vvt: 195, dohc4v_vvl: 200, billet_hemi: 235, pushrod2v: 120 }[cfg.head] || 160) + (dsl ? 20 : 0);
    const deck = s / 2 + rr * s + 0.42 * b;          // crank centre to the deck
    const below = s / 2 + 0.35 * b + 120;             // crank centre to the bottom of the pan
    const pitch = b * 1.16 + 12;                      // bore spacing
    const ind = two ? 60 : ({ carb: 230, single_tb: 150, itb: 170, plenum_long: 240, plenum_short: 180 }[cfg.intake] || 170);
    let len, wid, hgt, shape;
    if (L.rotary) { shape = "rotary"; len = n * 125 + 260; wid = 560; hgt = 470 + ind; }
    else if (L.opposed && L.banks === 3) {           // Deltic: three banks of opposed-piston cylinders in a triangle, a crankcase at each corner
      shape = "deltic"; const side = 2 * deck + 2 * 0.5 * b; wid = side + 560; hgt = side * 0.866 + 620; len = (n / 3) * pitch + 1200; }
    else if (L.banks === 2 && (L.angle >= 150 || /^F/.test(cfg.layout))) {   // flat
      shape = "flat"; len = (n / 2) * pitch + b * 0.5 + 220; wid = 2 * (deck + headH) + 120; hgt = below + b * 0.7 + 60 + ind * 0.8; }
    else if (L.banks === 2) {                         // vee
      shape = "vee"; const h = (L.angle || 90) * Math.PI / 360, reach = deck + headH;
      len = (n / 2) * pitch + b * 0.35 + 220; wid = 2 * (reach * Math.sin(h) + b * 0.55 * Math.cos(h)) + 160;
      hgt = below + Math.max(reach * Math.cos(h) + 20, deck * Math.cos(h) + 60 + ind); }
    else {                                            // inline
      shape = "inline"; len = n * pitch + 220 + (two ? 120 : 0); wid = b + (two ? 300 : 380); hgt = below + deck + headH + 40 + (cfg.intake === "carb" && !two ? 60 : 0); }
    // what bolts on: a blower stands on top, turbos hang off the sides, a front-mount core needs nose room
    if (kind === "roots" || kind === "screw") { if (shape === "vee" || shape === "flat") hgt += 250; else wid += 200; }
    else if (asp.compound) { wid += 300; hgt += 80; }
    else if (kind === "turbo") wid += (asp.units || 1) > 1 ? 240 : 160;
    else if (kind === "centrifugal") wid += 180;
    if (cfg.ic === "air_air") len += 90; else if (cfg.ic === "water_air") hgt += 40;
    if (dsl) wid += 60;
    return { L: Math.round(len), W: Math.round(wid), H: Math.round(hgt), shape: shape };
  }

  /* fixes owned for a vehicle → one list of ids, tier groups collapsed to the highest */
  function swapFixSet(own) {
    const out = {}; (Array.isArray(own) ? own : []).forEach(id => { const f = SWAP_FIX[id]; if (!f) return; if (f.tier) { const cur = out[f.grp]; if (!cur || SWAP_FIX[cur].tier < f.tier) out[f.grp] = id; } else out[id] = id; });
    return Object.keys(out).map(k => out[k]);
  }
  const swStat = (x, amber) => x <= amber ? "g" : x <= 1 ? "a" : "r";

  /* the fit report: res = the engine's dyno result (kg, peakTq, peakHp, thermals); own = fix ids fitted to this vehicle */
  function swapFit(cfg, res, vid, own) {
    const V = VEHICLES[vid]; if (!V || !res) return null;
    cfg = Object.assign({}, DEFAULT_CFG, cfg || {});
    const fx = swapFixSet(own), F = fx.map(id => SWAP_FIX[id]), dims = engineDims(cfg), has = id => fx.indexOf(id) >= 0;
    const inf = F.some(f => f.inf), add = [0, 1, 2].map(i => F.reduce((a, f) => a + (f.bay ? f.bay[i] : 0), 0));
    // the engine's fore-aft, across and height against the bay (a transverse bay turns the engine 90°)
    const eDim = V.tv ? [dims.W, dims.L, dims.H] : [dims.L, dims.W, dims.H];
    const items = [];
    const dimName = ["Length", "Width", "Height"], grp = ["len", "wid", "hgt"];
    for (let i = 0; i < 3; i++) {
      const room = V.bay[i] + add[i], over = eDim[i] - room;
      const st = inf ? "g" : over > 0 ? "r" : over > -30 ? "a" : "g";
      const fixes = Object.keys(SWAP_FIX).filter(id => SWAP_FIX[id].grp === grp[i] || SWAP_FIX[id].grp === "inf");
      items.push({ k: grp[i], n: dimName[i] + (i === 0 ? " · fore-aft" : i === 1 ? " · across" : " · to the hood"), st: st, have: eDim[i], room: inf ? null : room, stock: V.bay[i], over: Math.round(over), fixes: fixes, unit: "mm" });
    }
    // driveline: the engine's peak torque against the gearbox and the axle (the better of stock and the fix)
    const capOf = (g, base) => F.filter(f => f.grp === g).reduce((a, f) => Math.max(a, f.cap || 0), base);
    const tq = +res.peakTq || 0, gCap = capOf("gbx", V.gbx), aCap = capOf("axle", V.axle);
    items.push({ k: "gbx", n: "Gearbox", st: swStat(tq / gCap, 0.85), have: Math.round(tq), room: gCap, stock: V.gbx, ratio: tq / gCap, fixes: ["gbx1", "gbx2", "gbx3"], unit: "N·m" });
    items.push({ k: "axle", n: V.drive === "fwd" ? "Diff & driveshafts" : "Axle & diff", st: swStat(tq / aCap, 0.85), have: Math.round(tq), room: aCap, stock: V.axle, ratio: tq / aCap, fixes: ["axle1", "axle2", "axle3"], unit: "N·m" });
    // cooling: sustained heat (~70% of the peak coolant load) against the radiator
    const radK = F.reduce((a, f) => Math.max(a, f.radK || 1), 1), radKw = V.rad * radK;
    const need = 0.7 * ((res.thermals && res.thermals.coolantLoadKw) || 0.37 * (+res.peakHp || 100));
    items.push({ k: "rad", n: "Cooling", st: swStat(need / radKw, 0.85), have: Math.round(need), room: Math.round(radKw), stock: V.rad, ratio: need / radKw, fixes: ["rad1", "rad2", "rad3"], unit: "kW" });
    // mass and balance: the chassis with this engine (and the fixes) in it
    const ekg = Math.max(5, +res.kg || V.eng), fkg = F.reduce((a, f) => a + (f.kg || 0), 0), dxE = F.reduce((a, f) => a + (f.dxE || 0), 0);
    const xE = V.xE + dxE, mass0 = V.mass + fkg;
    const front0 = (V.front * V.mass + V.eng * dxE + fkg * 0.5) / mass0;           // the chassis on its stock engine, with the fixes
    const mass = mass0 - V.eng + ekg, front = clamp((front0 * mass0 + (ekg - V.eng) * xE) / mass, 0.05, 0.95), dF = front - V.front;
    const rest = V.mass - V.eng, mostly = ekg > rest;
    const balSt = mostly || Math.abs(dF) > 0.1 || mass > V.mass * 1.6 ? "r" : Math.abs(dF) > 0.04 || mass > V.mass * 1.2 ? "a" : "g";
    items.push({ k: "mass", n: "Mass & balance", st: balSt, have: Math.round(mass), room: null, stock: V.mass, front: front, dF: dF, fixes: [], unit: "kg" });
    // drag: the body plus what the fixes hang out in the air; a shell over a huge engine takes the engine's frontal area
    let cd = V.cd + F.reduce((a, f) => a + (f.dcd || 0), 0), area = V.area * (1 + F.reduce((a, f) => a + (f.darea || 0), 0));
    if (inf) area = Math.max(area, (dims.W / 1000 + 0.25) * (dims.H / 1000 + 0.45));
    const bayRed = items.slice(0, 3).some(x => x.st === "r");
    const cost = F.reduce((a, f) => a + f.cost, 0);
    // the road chassis: CHASSIS-shaped, so roadCar/lapSim take it as they are; the brakes stay the size they were
    const brake = V.brake * clamp(Math.sqrt((V.mass + 75) / (mass + 75)), 0.3, 1.05);
    const car = { n: V.n, d: `${Math.round(mass).toLocaleString("en-CA")} kg · ${V.drive.toUpperCase()} · ${Math.round(front * 100)}% front`, mass: mass0, eng: V.eng, drive: V.drive, front: front0, xE: xE,
      cgH: V.cgH + (has("hood") ? 0.03 : 0) + (inf ? 0.08 : 0), wb: V.wb, tyre: V.tc, cdA: cd * area, clA: V.cd > 0.6 ? -0.05 : 0, brake: brake, tyreDia: V.tyre, ratios: SW_R[V.ratios] || SW_R.car4, shift: V.shift, rr: V.rr, swap: vid };
    const dlCap = Math.min(gCap, aCap);
    return { v: vid, V: V, dims: dims, eDim: eDim, items: items, fx: fx, cost: cost, fits: !bayRed, mass: mass, front: front, dF: dF, ekg: ekg, mostly: mostly, cd: cd, area: area,
      dlCap: dlCap, dlRatio: tq / dlCap, coolRatio: need / radKw, radKw: radKw, car: car, look: V.look, inf: inf, hood: has("hood"), cabin: has("cabin") };
  }
  /* the same car for the strip (total mass with a driver; the drive wheels; the drag of the body) */
  function swapDragVeh(rep) {
    if (!rep) return null; const m = rep.mass + 75, front = (rep.front * rep.mass + 75 * 0.45) / m;
    return { mass: Math.round(m), rearBias: +(1 - front).toFixed(3), tyreDia: rep.V.tyre, wheelbase: rep.V.wb, cgH: rep.car.cgH, cdA: +(rep.cd * rep.area).toFixed(3), drive: rep.V.drive, dlCap: rep.dlCap, body: "street" };
  }
  /* ... and for the salt: an altered-class body built from the car (mass without the engine; the radiator it has) */
  function swapLsrBody(rep) {
    if (!rep) return null; const A = LSR_BODIES.altered;
    return Object.assign({}, A, { n: rep.V.n, mass: Math.round(rep.mass - rep.ekg), cdA: +(rep.cd * rep.area).toFixed(3), clA: rep.V.cd > 0.6 ? 0.5 : A.clA, rear: +(1 - rep.front).toFixed(3), wb: rep.V.wb, cgH: rep.car.cgH, tyreDia: rep.V.tyre, kRad: +(rep.radKw / 45).toFixed(3), swap: rep.v });
  }
