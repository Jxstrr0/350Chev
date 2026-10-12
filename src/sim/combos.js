  /* =====================================================================
     15.  combos() — rule-based interaction findings.
          These do not change the physics; they EXPLAIN what the physics
          is about to do to you, in the language an engine builder uses.
     ===================================================================== */
  function combos(cfg, env, q) {
    cfg = Object.assign({}, DEFAULT_CFG, cfg || {});
    const L = LAYOUTS[cfg.layout] || LAYOUTS.I4;
    const out = [];
    const add = (severity, title, text) => out.push({ severity: severity, title: title, text: text });
    const alu = cfg.blockMat === "alu_liners" || cfg.blockMat === "alu_nikasil";
    const boosted = cfg.asp !== "na";
    const boost = boosted ? cfg.boost : 0;
    const g = geometry(cfg);
    const fu = fuelOf(cfg);   // flex: the blend at cfg.ethanolPct
    const fuelON = 0.60 * fu.ron + 0.40 * fu.mon;
    const quick = q || simulate(cfg, env || DEFAULT_ENV);   // the app passes its own env (cell, climate, shop) and the run it already has
    const detMargin = quick.knock.margin;
    const dsl = isDiesel(cfg);
    if (isRotary(cfg)) { rotaryCombos(cfg, quick, add, L); return out; }
    if (isTwoStroke(cfg)) { twoStrokeCombos(cfg, quick, add, L); return out; }   // ports, premix and pipes, not cams and valve springs   // none of the piston interactions apply

    /* --- expansion / sealing ------------------------------------------ */
    if (cfg.headMat === "alu" && cfg.blockMat === "grey_iron" && cfg.gasket === "composite") {
      add(boosted ? "bad" : "warn", "Alu head on an iron block, composite gasket",
        "The head grows at 22e-6/K and the block at 11e-6/K, so every heat cycle scrubs the deck faces across each other by tens of microns. A graphite-faced composite gasket frets away at that interface until it leaks — this is the classic blown head gasket.");
    }
    if (cfg.headMat === "alu" && cfg.blockMat === "grey_iron" && cfg.gasket === "mls") {
      add("good", "MLS handles the expansion mismatch",
        "An iron block with an aluminium head has to slip somewhere. MLS layers are coated so they slide against each other instead of fretting, which is exactly why every modern mixed-metal engine uses one.");
    }
    if (cfg.gasket === "mls" && cfg.blockMat === "grey_iron" && cfg.studs === "bolts_tty") {
      add("warn", "MLS wants a ground deck and studs",
        "MLS needs about 0.5 µm Ra on both decks and a very even clamp. On a rough as-cast or worn deck with torque-to-yield bolts it will weep coolant at one corner — surface the deck and fit studs.");
    }
    if (cfg.gasket === "copper_oring" && cfg.blockMat !== "grey_iron" && cfg.blockMat !== "cgi") {
      add("warn", "O-ring groove in aluminium",
        "A copper gasket needs a stainless receiver wire in a machined groove. In an aluminium deck that groove work-hardens and the wire slowly beds in, so clamp load drops between rebuilds.");
    }

    /* --- pistons ------------------------------------------------------- */
    if (cfg.piston === "forged_2618" && cfg.pistonClearance === "tight") {
      add("bad", "2618 at tight clearance will seize",
        "2618 grows at 22.5e-6/K — about 0.0040 in of clearance on an 86 mm bore. Build it at 0.0019 in and the skirt takes up all of it before the crown is even warm, then picks up the bore.");
    }
    if (cfg.piston === "forged_4032" && cfg.pistonClearance === "loose") {
      add("warn", "4032 does not need that much room",
        "4032's 12.5% silicon holds it to 19.5e-6/K. Run it at race clearance and you get cold slap, more blow-by and a ring pack that never quite stabilises — 0.0020-0.0025 in is the spec.");
    }
    if (cfg.piston === "hyper" && (boost > 0.5 || detMargin < 3)) {
      add("bad", "Hypereutectic under boost or near the knock limit",
        "The primary silicon crystals that give A390 its low expansion also make it notch-sensitive with almost no ductility. One detonation event does not dent it — it cracks the top ring land clean off.");
    }
    if (cfg.piston === "hyper" && cfg.pistonClearance === "tight" && !boosted) {
      add("good", "Hypereutectic likes a tight bore",
        "At 18e-6/K it barely grows, so 0.0018-0.0020 in is correct. That is why OEMs use it: quiet cold, low oil consumption, and cheap.");
    }
    if (!dsl && cfg.piston === "cast_alu" && boost > 0.5) {
      add("bad", "Cast pistons and boost do not mix",
        "A gravity-cast A332 crown holds about 130 MPa at 250 °C and it will be well past that under boost. The failure is a hole melted through the crown between the exhaust valves.");
    }
    if (cfg.piston === "forged_2618" && cfg.oilSquirters === "fitted") {
      add("good", "2618 plus cooling jets is the boost recipe",
        "2618 keeps ~240 MPa at 250 °C and its high conductivity moves heat to the skirt; oil jets take another 40 °C out of the crown. This is what every serious turbo engine runs.");
    }

    /* --- rods, bolts, bearings ------------------------------------------ */
    const raceBrg = cfg.bearings === "race_xl" || cfg.bearings === "pro_wide";   // oversize race journals: +10% / +20% bearing area, hard low-galling overlay
    if (cfg.rod === "titanium" && cfg.bearings !== "coated" && !raceBrg) {
      add("bad", "Titanium rods against an uncoated overlay",
        "Titanium galls against copper-lead and aluminium-tin. Without a resin-bonded PTFE/MoS2 coating the big end picks up material on the first dry start and the bearing is scrap.");
    }
    if (cfg.rod === "titanium" && (cfg.bearings === "coated" || raceBrg)) {
      add("good", cfg.bearings === "coated" ? "Coated bearings solve the titanium galling problem" : "Race bearings solve the titanium galling problem",
        cfg.bearings === "coated" ? "The polymer overlay keeps titanium off the copper and survives the dry start. It is the only combination that makes a titanium rod a sensible road part."
          : "The race shell's hard overlay and low-galling surface keep titanium off the copper through a dry start, on a bigger journal (" + (cfg.bearings === "pro_wide" ? "+20%" : "+10%") + " bearing area). A race-only pairing.");
    }
    if (cfg.rod === "titanium" && cfg.redline < 7000) {
      add("info", "Titanium rods below 7,000 rpm",
        "Titanium buys you inertia relief, and inertia goes with rpm squared. Under 7,000 rpm you are paying £3,000 for a rod that is 43% lighter and 44% less stiff in buckling.");
    }
    if (cfg.rodBolts === "oem" && cfg.redline > 7000) {
      add("bad", "OEM rod bolts past 7,000 rpm",
        "Inertia load rises with the square of rpm, and a torque-to-yield bolt is already past its elastic limit by design. This is the single most common cause of a rod exiting the block.");
    }
    if (cfg.bearings === "bimetal" && cfg.fuel === "methanol") {
      add("bad", "Methanol eats aluminium-tin bearings",
        "Unburnt methanol and formic acid get past the rings into the oil. Aluminium-tin overlays corrode and pit; run trimetal or coated bearings and change the oil after every session.");
    }
    if (cfg.bearings === "coated" && (cfg.oilGrade === "w20_50" || cfg.oilGrade === "w15_50")) {
      add("info", "Coated bearings with a 50-weight is belt and braces",
        "The polymer overlay exists so you can survive marginal film. Pairing it with a 4.5 mPa·s HTHS oil is not wrong, it just costs you 2-3% in churn you did not need to spend.");
    }
    if (cfg.oilGrade === "w0_20" && boost > 1.0) {
      add("bad", "0W-20 under serious boost",
        "HTHS of 2.6 mPa·s does not build a hydrodynamic film against 80+ MPa of rod bearing load. The film collapses at the peak-pressure crank angle and you polish the overlay off.");
    }

    /* --- crank, damper, torsionals ------------------------------------- */
    if (cfg.crank === "cast_nodular" && (L.n >= 6) && cfg.redline > 7000) {
      add("bad", "Cast crank in a long engine at high rpm",
        "Nodular iron has about 260 MPa of bending fatigue strength and poor torsional damping. In a six or a twelve the crank is long enough to wind up, and the third-order harmonic will find the fillet.");
    }
    if (cfg.damper === "none" && (cfg.layout === "I6" || cfg.layout === "V12") && cfg.redline > 7500) {
      add("bad", "No damper on a long crank above 7,500 rpm",
        "An inline six or a V12 has the longest crank in the catalogue and its first torsional mode lands inside the rev range. Without a damper the free end oscillates until the front journal cracks.");
    }
    if (cfg.damper === "viscous" && L.n >= 6) {
      add("good", "Viscous damper on a long crank",
        "A silicone-filled inertia ring is broadband rather than tuned to one frequency, so it keeps working as the resonance moves with temperature and wear. Right answer for a six or a twelve.");
    }
    if (g.s / g.b > 1.15 && cfg.redline > 7500) {
      add("warn", "Long stroke chasing a high redline",
        "A stroke/bore ratio of " + (g.s / g.b).toFixed(2) + " at " + cfg.redline + " rpm means very high mean piston speed and journal overlap that is running out. Shorten the stroke or accept the revs you have.");
    }
    if (cfg.rodRatio < 1.58 && g.b > 95) {
      add("warn", "Short rod in a big bore",
        "A rod ratio of " + cfg.rodRatio.toFixed(2) + " swings the rod through a big angle, and on a " + g.b.toFixed(0) + " mm bore the thrust face load goes up sharply. Expect bore wear on the major thrust side and skirt scuffing.");
    }
    if (cfg.rodRatio > 1.90) {
      add("info", "Very long rod",
        "Above about 1.9 the piston dwells longer at TDC, which is kind to the ring pack and slightly better for knock, but the block gets taller and the piston has to be short and light.");
    }

    /* --- block, deck, bores ---------------------------------------------- */
    if (cfg.deck === "open" && alu && boost > 1.2) {
      add("bad", "Open deck aluminium past 1.2 bar",
        "With nothing supporting the liner tops the bores bell outwards under peak pressure. The rings stop following the bore, blow-by climbs, and eventually the liner walks in the block.");
    }
    if (cfg.deck === "closed" && alu && boost > 1.2) {
      add("good", "Closed deck for real boost",
        "Tying the liner tops into the outer wall keeps the bore round at 150+ bar. That is the whole reason a closed-deck block exists.");
    }
    if (cfg.blockMat === "alu_nikasil" && cfg.fuel === "methanol") {
      add("bad", "Methanol will strip Nikasil",
        "Ni-SiC plating is attacked by the acidic products of methanol combustion, and the alcohol also washes oil off the bore. Use an iron-lined block, or budget for replating.");
    }
    if (cfg.blockMat === "alu_nikasil" && cfg.rings === "steel") {
      add("good", "Steel rings on Nikasil",
        "Gas-nitrided steel is the correct counter-face for a Ni-SiC bore: both are hard, so the pairing barely wears and friction is the lowest of any combination.");
    }
    if (cfg.blockMat === "grey_iron" && boost > 1.5) {
      add("good", "Iron block for high boost",
        "Grey iron's stiffness and 11e-6/K stability are why every 1,000 hp four-cylinder starts with an iron block. It is 40 kg heavier and it does not care.");
    }
    if (cfg.blockMat === "cgi" && boost > 1.0) {
      add("good", "CGI: iron stability at less weight",
        "GJV-450's vermicular graphite gives 450 MPa UTS and 75% more fatigue strength than grey iron, so the same block can be 10-15% thinner. Diesel makers went this way for exactly this reason.");
    }
    if (alu && cfg.fuel === "e85") {
      add("good", "E85 in an aluminium block",
        "760 kJ/kg of latent heat pulls roughly 40 °C out of the charge and cuts heat rejection into the coolant. An aluminium block that was on the edge thermally suddenly has margin.");
    }

    /* --- valvetrain -------------------------------------------------------- */
    if (cfg.head === "pushrod2v" && cfg.redline > 7000) {
      add("bad", "Pushrods past 7,000 rpm",
        "Lifter, pushrod, rocker and valve all reciprocate. That mass makes the valvetrain's own natural frequency the limit long before the springs run out of seat load — it floats, then it bends a pushrod.");
    }
    if (cfg.valveMat === "ti" && cfg.redline > 8000) {
      add("good", "Titanium valves for high rpm",
        "At 4.43 g/cc a titanium intake valve is 40% lighter than steel, which moves the float point up close to 900 rpm for the same spring. Intake side only — it has no hot strength.");
    }
    if (cfg.valveMat === "ti" && boost > 0.8 && cfg.turbineMat !== "inconel") {
      add("bad", "Titanium valves in a hot boosted exhaust",
        "Ti-6Al-4V starts to lose strength above about 720 °C and a boosted exhaust valve sees more than that. Use Inconel on the exhaust side and keep titanium for the intakes.");
    }
    if (cfg.valveMat === "sodium" && boosted) {
      add("good", "Sodium valves under boost",
        "The sodium melts at 98 °C and sloshes heat from the head up the stem into the guide, taking about 80 °C off the valve. It is the cheapest thermal insurance a boosted engine can buy.");
    }
    if (cfg.valveMat === "inconel" && !boosted && cfg.cam < 60) {
      add("info", "Inconel on a mild naturally aspirated engine",
        "Inconel 751 is rated to 1,050 °C; a mild NA engine never sees 800 °C at the valve. You are carrying 8% more valve mass and a big bill for margin you cannot use.");
    }
    if (cfg.lift > 78 && cfg.cr > 12.0 && cfg.cam > 70) {
      add("bad", "High lift, high compression, wild cam",
        "All three eat the same piece of space. Big overlap holds the valve off its seat while the piston is still near TDC, and a high-compression dome is filling that space — the valve reliefs run out and the valve kisses the piston.");
    }
    if (cfg.springs === "single" && cfg.redline > 7500) {
      add("warn", "Single springs at high rpm",
        "One coil has one natural frequency, and above about 7,500 rpm a cam harmonic will excite it into surge — the spring stops controlling the valve even though its static load looks fine.");
    }
    if (cfg.springs === "ti_retainers" && cfg.redline < 6500) {
      add("info", "Titanium retainers below 6,500 rpm",
        "Lightweight retainers exist to raise the float point. Under 6,500 rpm nothing is floating, and titanium retainers wear against a soft spring seat over long mileage.");
    }
    if ((cfg.head === "dohc4v_vvl" || cfg.head === "dohc4v_vvt") && cfg.cam > 70) {
      add("good", "Variable timing rescues a big cam",
        "Phasing (or swapping) the lobe lets you keep 250°+ of duration at 8,000 rpm and still have a clean, torquey 2,000 rpm. Without it a cam that big idles like a bag of spanners.");
    }

    /* --- induction, boost, fuel --------------------------------------------- */
    if (cfg.asp === "twin_turbo" && L.n <= 4) {
      add("warn", "Twin turbos on a four-cylinder",
        "Two turbos exist to shorten the exhaust path from each bank or to stage flow. A four has one bank and not much exhaust energy — you have doubled the plumbing, the cost and the heat soak for very little spool gain.");
    }
    if (cfg.asp === "twin_turbo" && L.banks === 2) {
      add("good", "One turbo per bank",
        "Each turbo sees half the mass flow, so the wheels are smaller and lighter and spool comes about 20% earlier. It also halves the manifold length from port to turbine.");
    }
    if (cfg.asp === "centrifugal" && cfg.redline < 6500) {
      add("warn", "Centrifugal blower on a low-revving engine",
        "Impeller pressure rise goes with tip speed squared, so boost goes with rpm squared. With a 6,000 rpm ceiling you get almost nothing until the last 1,500 rpm and the torque curve looks like a ski jump.");
    }
    if (!dsl && cfg.asp === "roots" && cfg.cr > 10.5) {
      add("bad", "Roots blower on high compression",
        "A Roots pump is internally-compression-free, so it dumps hot air into the manifold at low adiabatic efficiency. Stack that on 10.5:1 static and the octane requirement goes through the roof.");
    }
    if (cfg.asp === "roots" && cfg.cr <= 9.0) {
      add("good", "Low compression for the blower",
        "Dropping static compression is how you make room for the pressure ratio. 8.5-9.0:1 with 0.7 bar of Roots boost is a proven, driveable combination.");
    }
    if (!dsl && boosted && cfg.ic === "none" && boost > 0.5) {
      add("bad", "No intercooler above 0.5 bar",
        "At 72% compressor efficiency a 1.5 pressure ratio puts the charge at 90-110 °C. That is straight off your knock margin and straight off your air density — you lose twice.");
    }
    if (cfg.ic === "water_air" && cfg.oilSystem !== "dry") {
      add("info", "Water-to-air is a sprint cooler",
        "85% effectiveness and a very short charge path make it superb for a single pull. On a 20-minute track session the reservoir saturates and effectiveness falls away unless the heat exchanger is properly sized.");
    }
    if (cfg.intake === "carb" && (cfg.fuel === "e85" || cfg.fuel === "methanol")) {
      add("bad", "Carburettor on alcohol",
        "Alcohol needs 40-130% more fuel volume, has huge latent heat and absorbs water out of the air. A fixed-jet carburettor cannot meter that across temperature and it will not survive being left with fuel in the bowl.");
    }
    if (cfg.intake === "itb" && boosted) {
      add("warn", "Individual throttles on a boosted engine",
        "Sealing eight or twelve butterflies against positive pressure is difficult and there is no plenum to damp the surge pulse when you lift. It is done, but a single throttle and a plenum is the easier engine.");
    }
    if (cfg.intake === "itb" && !boosted && cfg.cam > 60) {
      add("good", "ITBs and a big cam",
        "With no shared plenum there is no cross-talk between cylinders during overlap, so a long-duration cam keeps a much cleaner signal and the throttle response is immediate.");
    }
    if (cfg.intake === "plenum_long" && cfg.redline > 7500) {
      add("warn", "Long runners on a high-revving engine",
        "A long runner tunes the Helmholtz resonance to around 3,600 rpm and then chokes. If the engine is meant to make its power at 8,000 you are leaving 10-15% of the top end on the table.");
    }
    if (cfg.rings === "cast" && boost > 0.5) {
      add("bad", "Cast iron top ring under boost",
        "A plain cast ring cannot take the thermal load or the gap growth. It butts, then it micro-welds to the bore and breaks — usually taking the second land with it.");
    }
    if (cfg.rings === "steel" && boost > 0.8) {
      add("good", "Steel top rings for boost",
        "A 1.0-1.2 mm gas-nitrided steel ring tolerates 450 °C and is specified with a bigger end gap, which is exactly what a boosted bore needs as it heats up.");
    }
    if (detMargin < 2 && cfg.fuel !== "e85" && cfg.fuel !== "methanol" && cfg.fuel !== "race100" && !fu.grade && !fu.gas) {
      add("warn", "Almost no detonation margin on pump fuel",
        "The tune needs " + quick.knock.onRequired.toFixed(0) + " octane and the fuel supplies " + fuelON.toFixed(0) + ". A hot day, a hill or a tank of bad fuel and the knock sensor will be pulling timing all the way home.");
    }
    if (cfg.fuel === "e85" && boost > 1.2) {
      add("good", "E85 is a boosted engine's cheat code",
        "105 RON equivalent plus 760 kJ/kg of evaporative cooling means you can run 2 bar on an iron block without retarding a degree. Budget over 40% more fuel flow through the injectors and pump, and ethanol-safe seals.");
    }
    /* --- fuel delivery: injectors and pump against what the tune asks for --- */
    const fq = quick.fuel;
    if (fq && !dsl && !fu.gas) {
      const inj = OPT.injectors[cfg.injectors] || OPT.injectors.i240, pmp = OPT.fuelPump[cfg.fuelPump] || OPT.fuelPump.p190;
      const injWord = "the " + (inj.perCyl > 1 ? inj.perCyl + " \u00d7 " : "") + inj.cc + "s";
      const vol = (14.7 / fu.afr) * (0.745 / fuelDensity(fu));        // fuel volume per unit of air, against petrol
      const alky = vol < 1.2 ? "" : cfg.fuel === "methanol" ? "Methanol needs about " + vol.toFixed(1) + "\u00d7 the fuel of petrol for the same air"
        : fu.name.split(" ")[0] + " needs about " + Math.round((vol - 1) * 100) + "% more fuel than petrol for the same air";
      const short = fq.injUtil > 0.8 || fq.pumpUtil > 0.8;
      const fit = short ? fitFuel(cfg, env) : null;
      const fitWord = fit ? " The smallest set that feeds it with margin: " + (fq.portInj ? OPT.injectors[fit.injectors].name.replace(" stock", "") + " injectors and " : "") + "the " + OPT.fuelPump[fit.fuelPump].short + "." : "";
      if (fq.injUtil > 1) add("bad", "Out of injector",
        (alky ? alky + " \u2014 " : "At " + fq.dutyRpm + " rpm ") + injWord + (fq.duty > 1 ? " would need " : " are at ") + Math.round(fq.duty * 100) + "% duty" + (alky ? " at " + fq.dutyRpm + " rpm" : "") + ". Past about 90% an injector is all but static, so the top of the pull goes lean (\u03bb " + fq.lamTop.toFixed(2) + " where the tune asks for " + cfg.lambda.toFixed(2) + "), and lean under load is how pistons melt." + fitWord);
      else if (fq.injUtil > 0.8) add("warn", "Injectors near their limit",
        (alky ? alky + "; " : "") + injWord + " are at " + Math.round(fq.duty * 100) + "% duty at " + fq.dutyRpm + " rpm. A cold day or a little more boost and they run out \u2014 the next size up costs very little." + fitWord);
      if (fq.pumpUtil > 1) add("bad", "The fuel pump can't keep up",
        (boosted && !pmp.rpmRef ? "With " + boost.toFixed(1) + " bar of boost on top of the base pressure, the " : "The ") + pmp.short + " can only supply about " + Math.round(fq.capLph) + " L/h against the " + Math.round(fq.needLph) + " L/h this engine burns at " + fq.loadRpm + " rpm. The rail pressure sags and every cylinder leans out together." + fitWord);
      else if (fq.pumpUtil > 0.8) add("warn", "Fuel pump near its limit",
        "The " + pmp.short + " is supplying " + Math.round(fq.pumpUtil * 100) + "% of what it can at " + fq.loadRpm + " rpm" + (boosted && !pmp.rpmRef ? ", and every extra bar of boost takes flow away from it" : "") + "." + fitWord);
      if (alky && !short) add("good", "Fuel system sized for alcohol",
        alky + ", and " + (fq.portInj ? injWord + " at " + Math.round(fq.duty * 100) + "% duty with " : "") + "the " + pmp.short + " behind them have room for it.");
      if (fq.portInj && fq.duty < 0.12 && inj.cc * (inj.perCyl || 1) * (isRotary(cfg) ? 2 : 1) >= 1650) add("info", "A lot of injector for this engine",
        "At full load " + injWord + " are open only " + Math.round(fq.duty * 100) + "% of the time, so at idle the pulse is barely longer than the time the injector takes to open. A modern driver copes, but low-speed fuelling gets coarse.");
    }
    /* --- MORE FUELS: race gas grades, the flex blend, propane and CNG --- */
    const leadCat = OPT.cat ? !!(cfg.cat && cfg.cat !== "none" && OPT.cat[cfg.cat]) : false;   // the exhaust builder's catalyst, when there is one
    if (fu.lead && (leadCat || fu.grade)) add(leadCat ? "bad" : "info", "Leaded fuel kills cats",
      leadCat ? "The lead in " + fu.name + " glazes the catalyst's washcoat within a tank or two and poisons the oxygen sensors: the converter clogs, back-pressure climbs and closed-loop fuelling goes blind. Run an unleaded grade, or leave the cat off the race car."
        : fu.name + " gets its octane from tetraethyl lead. That is fine on a race engine with no catalyst, but it glazes a cat within a tank or two, fouls oxygen sensors and leaves grey deposits on the plugs \u2014 use an unleaded grade if the car has to keep either.");
    if (fu.oxy > 0) add("good", "Oxygen in the fuel",
      fu.name + " carries about " + fu.oxy + "% oxygen by weight, so it is jetted about " + Math.round((14.7 / fu.afr - 1) * 100) + "% richer than petrol and each kilogram of air burns roughly " + Math.round((fu.lhv / fu.afr / (43.4e6 / 14.7) - 1) * 100) + "% more energy \u2014 E85's trick without E85's fuel volume. Keep the drum sealed: it takes up water once it is open.");
    if (fu.flex && quick.alt && quick.alt.winter) {
      const w = quick.alt.winter;
      if (w.margin < 0.5) add(w.margin < -1.8 ? "bad" : "warn", "Flex at E" + w.pct + " in winter",
        "Tuned at E" + w.nowPct + " with " + detMargin.toFixed(1) + " of margin, but the pump's winter blend can be as weak as E" + w.pct + ". There the build needs " + w.onReq.toFixed(0) + " and gets " + w.fuelON.toFixed(0) + ": the sensor pulls about " + w.retardDeg.toFixed(1) + "\u00b0 and " + (w.lossPct < 1 ? "under 1%" : "roughly " + w.lossPct.toFixed(0) + "%") + " of the power" + (w.margin < -1.8 ? ", and past that it is out of timing to pull and the engine knocks." : ". Leave a point or two of margin for the weak blend."));
      else add("good", "Flex sensor covers the winter blend",
        "Even at E" + w.pct + " the build keeps " + w.margin.toFixed(1) + " octane of margin. The sensor moves the fuel and the timing with the blend, so whatever the pump had that week just works" + (w.nowPct >= 51 ? "" : " \u2014 and a home blend at E" + w.nowPct + " barely wanders") + ".");
    }
    if (fu.gas && fq) {
      const al = quick.alt || {}, gso = OPT.gasSys[al.sys] || OPT.gasSys.mixer;
      const gf = fq.pumpUtil > 0.8 ? fitFuel(cfg) : null;
      const gasFit = gf && gf.gasSys !== al.sys ? " The smallest system that feeds it with margin: " + OPT.gasSys[gf.gasSys].name.toLowerCase() + "." : "";
      if (cfg.fuel === "lpg") add(cfg.cr < 11 && !boosted ? "info" : "good", "Propane: no charge cooling",
        "Propane arrives in the manifold as vapour, so there is none of the evaporative cooling a liquid fuel gives, and it fills about " + (fu.displace * 100).toFixed(0) + "% of the cylinder" + (gso.veK < 1 ? " (plus " + Math.round((1 - gso.veK) * 100) + "% for the mixer's venturi)" : "") + ": expect 5\u201310% less power at the same compression. What you get back is " + fu.ron + " RON" + (cfg.cr < 11 && !boosted ? ", and at " + cfg.cr.toFixed(1) + ":1 you are not using it \u2014 a dedicated propane engine runs 11\u201312:1." : ", and this build is using it."));
      if (cfg.fuel === "cng") add("warn", "CNG costs top-end power",
        "Methane fills about " + (fu.displace * 100).toFixed(1) + "% of the cylinder and burns slowly, so a petrol engine loses around a tenth of its power on it; the " + fu.ron + " RON is there so you can win it back with 12\u201313:1 compression or boost. And the tank is about " + fu.tankKg + " kg of steel for " + fu.tankL + " kg of gas \u2014 roughly a third of a petrol tank's range.");
      if (fu.vapor) add("info", "Propane in the cold",
        "Propane boils at \u221242 \u00b0C and the tank's own pressure is what feeds the regulator: about 8 bar on a mild day, under 2 bar at \u221225 \u00b0C. Below about \u221230 \u00b0C a cold vaporiser struggles to start the engine, so northern fleets keep their tanks warm or run CNG.");
      if (fq.pumpUtil > 1) add("bad", "The gas system can't keep up",
        "The " + gso.name.toLowerCase() + " meters about " + Math.round(al.capKgh) + " kg/h at " + fq.loadRpm + " rpm and the engine wants " + Math.round(al.kgh) + " kg/h. The mixture leans out at the top of the pull (\u03bb " + fq.lamTop.toFixed(2) + ")." + gasFit);
      else if (fq.pumpUtil > 0.8) add("warn", "Gas system near its limit",
        "The " + gso.name.toLowerCase() + " is metering " + Math.round(fq.load * 100) + "% of what it can at " + fq.loadRpm + " rpm" + (boosted ? ", and boost takes flow away from it" : "") + "." + gasFit);
    }
    if (cfg.fuel === "methanol" && cfg.cr < 12 && !boosted) {
      add("info", "Methanol without the compression to use it",
        "M100's value is its 1,100 kJ/kg latent heat and 109 RON — both are there so you can raise compression or boost. At " + cfg.cr.toFixed(1) + ":1 naturally aspirated you are just buying range problems.");
    }
    if (cfg.lambda < 0.82 && !boosted) {
      add("warn", "Very rich on a naturally aspirated engine",
        "Below about λ 0.85 you are past best power and the extra fuel is only there to cool. On an NA engine that just washes the bores and dilutes the oil.");
    }
    if (!dsl && cfg.lambda > 1.0 && boosted) {
      add("bad", "Lean under boost",
        "Every point of lambda above 1.0 adds roughly 30 °C to exhaust gas temperature and takes octane margin away at the same time. This is how turbine wheels and exhaust valves die.");
    }
    /* --- diesel: smoke, fuel, pressure, noise, cold ---------------------------- */
    if (dsl) {
      const di = OPT.dInj[cfg.dInj] || OPT.dInj.rotary_ve, nz = OPT.dNoz[cfg.dNoz] || OPT.dNoz.stock;
      const pmax = quick.loads.pmaxMPa * 10, egt = quick.thermals.egtPeakC, dfq = quick.fuel;
      const turbo = OPT.asp[cfg.asp].kind === "turbo";
      if (turbo && di.smokeLim < 0.7 && quick.smoke > 30 && dfq.lamMin < cfg.lambda - 0.1)
        add("warn", "Black smoke under spool",
          "The " + di.name + " meters fuel for full boost whether the turbo has lit or not. Below the spool point the cylinders get \u03bb " + dfq.lamMin.toFixed(2) + " and the surplus leaves as soot \u2014 about " + Math.round(quick.smoke) + "% opacity. A smaller turbo, an injection system with a proper boost map, or a leaner fuel setting cleans it up.");
      if (cfg.studs === "bolts_tty" && pmax > 150)
        add(pmax > 190 ? "bad" : "warn", "Head studs for boost",
          "Peak pressure is " + Math.round(pmax) + " bar. Torque-to-yield bolts were stretched past yield when they went in, and at this pressure the head lifts off the fire ring every cycle until the gasket lets go. Studs keep the clamp ahead of the firing load.");
      if (cfg.lambda < 1.2)
        add(egt > 820 ? "bad" : "warn", "Too lean to smoke, too rich to live",
          "\u03bb " + cfg.lambda.toFixed(2) + " at full load is past the smoke limit: there is not enough air to burn the fuel properly, so the extra makes soot and heat instead of torque. Best power is around \u03bb 1.25\u20131.3; richer than that only raises the exhaust temperature.");
      else if (cfg.lambda > 1.9)
        add("info", "Clean, and leaving torque behind",
          "\u03bb " + cfg.lambda.toFixed(2) + " at full load is how a factory truck passes its emissions test. There is air for a good deal more fuel before the stack shows it \u2014 bigger nozzles or more on the fuel setting.");
      else if (quick.smoke < 20)
        add("good", "Fuelled to the smoke limit",
          "\u03bb " + cfg.lambda.toFixed(2) + " at full load uses most of the air without blacking out the road behind you. This is where a diesel makes its torque.");
      if (cfg.piston === "cast_alu" && pmax > 185)
        add("warn", "Cast pistons past factory pressure",
          "A cast diesel piston with a cooling gallery is fine at factory boost, but at " + Math.round(pmax) + " bar the bowl rim starts to crack. A forged piston is the first thing a hot-rodded diesel needs after studs.");
      if (egt > 800)
        add(egt > 870 ? "bad" : "warn", "Overfuelled: EGT",
          "Peak exhaust is " + Math.round(egt) + " \u00b0C. On a diesel the extra fuel cools nothing \u2014 it burns late, down the stroke and into the manifold. Much past 700 \u00b0C held for long, the bowl rim softens and the turbine housing cracks; a puller lives with it for ten seconds, a tow truck cannot.");
      const rwy = pullRunaway(quick, cfg, 0);
      if (rwy.p >= 0.12)
        add("bad", "Runaway risk",
          "Under a sled this build can find oil to burn (" + rwy.why.join(", ") + ") and run on it with the pedal up \u2014 the governor can't stop fuel it isn't metering. On the dirt you'd have a couple of seconds to hit the kill switch. More air or less fuel, and a turbo that isn't working past its map.");
      const cs = coldStart(cfg, -20);
      if (cs.util > 0.85)
        add(cs.util > 1 ? "warn" : "info", "Cold start",
          "At -20 \u00b0C, " + cfg.cr.toFixed(1) + ":1 only gets the air to about " + Math.round(cs.T2C) + " \u00b0C on the starter and the fuel needs " + Math.round(cs.needC) + " \u00b0C. It will crank, puff white smoke and maybe catch. Low compression makes room for boost, but you pay for it on winter mornings.");
      if (cfg.fuel === "b100" && di.kind === "mech")
        add("warn", "B100 on old seals",
          "Biodiesel is a solvent. It softens the nitrile O-rings and diaphragms in a mechanical pump of this era and lifts years of varnish into the filter. Viton seals and a spare filter first \u2014 and it gels just above freezing.");
      else if (cfg.fuel === "b100")
        add("info", "Biodiesel",
          "B100 lights quickly and smokes less, but carries about 13% less energy a kilo, so the same nozzles make a little less power. It turns to jelly near 0 \u00b0C.");
      if (di.kind === "cr")
        add("good", "Common rail quiets the clatter",
          "A pilot shot just ahead of the main one lights a small flame that the main charge burns into, instead of a pile of fuel going off at once. Clatter index " + quick.clatter.toFixed(2) + ", against 0.7\u20130.9 for a mechanical pump.");
      else if (quick.clatter > 0.7)
        add("info", "That diesel clatter",
          "With no pilot injection the fuel that arrives during the ignition delay all lights at once: a sharp pressure rise that rings through the block (clatter index " + quick.clatter.toFixed(2) + "). Higher compression, better cetane or a common rail soften it.");
      if (cfg.redline > di.rpmMax * 1.05)
        add("warn", "Revs past the pump",
          "The " + di.name + " keeps up to about " + di.rpmMax.toLocaleString("en-US") + " rpm; above that every stroke gets less fuel and the burn runs out of time, so the power falls away. The last " + Math.round(cfg.redline - di.rpmMax) + " rpm is mostly noise.");
      if (dfq.injUtil > 1)
        add("info", "Injection pump on its stop",
          "At " + dfq.qRpm + " rpm the tune asks for " + Math.round(dfq.qDem) + " mm\u00b3 a stroke and the " + di.name + " with " + nz.name.toLowerCase() + " can push about " + Math.round(dfq.qCap) + ". On a diesel that just caps the power \u2014 bigger nozzles are how you get past it." + (() => { const ff = fitFuel(cfg); return ff.dInj === cfg.dInj && ff.dNoz === cfg.dNoz ? "" : " The smallest set that feeds it with margin: the " + OPT.dInj[ff.dInj].name + " with " + OPT.dNoz[ff.dNoz].name.toLowerCase() + "."; })());
      if (dfq.pumpUtil > 1)
        add("bad", "The lift pump can't keep up",
          "The " + OPT.fuelPump[cfg.fuelPump].short + " lifts about " + Math.round(dfq.capLph) + " L/h and the injection pump wants " + Math.round(dfq.needLph) + " L/h, burn plus return. A starved injection pump runs dry and scores its plungers." + " The smallest one that feeds it: the " + OPT.fuelPump[fitFuel(cfg).fuelPump].short + ".");
      else if (dfq.pumpUtil > 0.8)
        add("warn", "Lift pump near its limit",
          "The " + OPT.fuelPump[cfg.fuelPump].short + " is supplying " + Math.round(dfq.load * 100) + "% of what it can at " + dfq.loadRpm + " rpm.");
      if (boosted && cfg.ic === "none" && boost > 0.8)
        add("warn", "No intercooler on a diesel",
          "There is no knock to worry about, but hot charge is thin charge: the same fuel meets less air, so it runs smokier and hotter. An intercooler is worth 15\u201320% more air at full boost.");
      if (cfg.intake === "carb")
        add("info", "A carburettor on a diesel",
          "There is no fuel in the intake of a diesel, so a carburettor is just a restriction with a choke flap in it. Any open intake does the same job.");
      if (nz.mult >= 2.5 && !(OPT.asp[cfg.asp].compound) && boost < 3)
        add("warn", "Sticks bigger than the air",
          nz.name + " flow " + nz.mult.toFixed(1) + "\u00d7 stock, and without compound turbos and serious boost there is nowhere near the air to burn it. That fuel comes out as smoke and heat.");
      if (cfg.timing > 4)
        add("warn", "Injection timing well advanced",
          "Advance moves the burn toward TDC: about 3% more peak pressure per degree and a sharper clatter, while the exhaust runs cooler. Past a few degrees the head studs and the gasket pay for it.");
      if (cfg.timing < -4)
        add("info", "Retarded injection",
          "Retard pushes the burn down the stroke: lower peak pressure, about 12 \u00b0C hotter exhaust per degree and more smoke. Pullers retard on purpose to keep the head on at big boost.");
    }

    /* --- lubrication and cooling ---------------------------------------------- */
    if (cfg.oilSystem === "dry" && cfg.redline > 8000) {
      add("good", "Dry sump above 8,000 rpm",
        "Scavenging the crankcase to a partial vacuum removes the oil mist the crank has to plough through. Worth 2-4% of crank power at 8,000+ rpm, before you count the surge immunity.");
    }
    if (cfg.oilSystem === "wet" && cfg.redline > 8000) {
      add("warn", "Wet sump at high rpm",
        "Windage losses climb steeply once the crank is turning faster than about 8,000 rpm, and the pickup is one long corner away from uncovering. At minimum fit a windage tray and baffles.");
    }
    if (cfg.oilSquirters === "none" && boost > 0.8) {
      add("warn", "No piston cooling jets under boost",
        "The crown has nowhere to send its heat except through the rings. Jets are worth about 40 °C of crown temperature, which is the difference between a healthy 2618 and a cracked one.");
    }
    if (cfg.cooling === "std" && boost > 1.2) {
      add("warn", "Stock radiator with serious boost",
        "Heat rejected to coolant tracks roughly with crank power. Double the power and the standard core simply runs out of surface area — it will be fine for one pull and hopeless on lap three.");
    }
    if (cfg.exhaust === "cast_log" && boosted) {
      add("info", "Cast log manifold on a turbo",
        "A log is thermally durable and compact, and with a turbine downstream the scavenging you lose matters less than it would on an NA engine. It does raise turbine inlet temperature.");
    }
    if (cfg.exhaust === "headers_merge" && !boosted && cfg.cam > 55) {
      add("good", "Merge collector with overlap",
        "The departing pulse from the previous cylinder pulls a genuine negative pressure at the port during overlap, which scavenges the chamber and pulls fresh charge in. That is free volumetric efficiency.");
    }
    /* --- exhaust system after the manifold (all quiet for the stock system) ------- */
    {
      const XS = quick.exhaustSys, XP = exhParts(cfg), nzDb = quick.noiseDb;
      const pumpFuel = dsl || cfg.fuel === "r87" || cfg.fuel === "r91" || cfg.fuel === "r94";
      const loud = XP.pipe.open || XP.muf === OPT.muffler.straight;
      if (loud && pumpFuel)
        add(nzDb > 86 ? "bad" : "warn", XP.pipe.open ? "Open headers on a road build" : "Straight pipe on a road build",
          "About " + Math.round(nzDb) + " dB on a drive-by test, against road limits of 74\u201382 dB. A road buyer hears that before they hear the power; a chambered or turbo muffler keeps most of the flow at a fraction of the noise.");
      if (XS.deltaBar > 0.06 && XP.pipe.dia)
        add(XS.deltaBar > 0.2 ? "bad" : "warn", "Pipe too small for the power",
          "At peak power " + XS.flowKgS.toFixed(2) + " kg/s of exhaust goes through " + (XP.pipe.runs === 2 ? "two " : "one ") + XP.pipe.dia + "\" pipe" + (XP.pipe.runs === 2 ? "s" : "") + ": " + XS.dpBar.toFixed(2) + " bar of backpressure"
          + (boosted && OPT.asp[cfg.asp].kind === "turbo" ? ", and the turbine passes it upstream multiplied by its own pressure ratio" : "") + ". Exhaust gas wants under about 100 m/s; " + (cfg.pipe === "d300" ? "dual 3\" is as big as pipes come here, so a cutout or open headers are the only freer ways out." : "go up a size."));
      if (XP.cut.open)
        add("warn", "Cutout open = illegal on the street",
          "The dyno sees the open cutout: about " + Math.round(quick.noiseDbOpen) + " dB and the freest exhaust there is. Road buyers judge it shut, at " + Math.round(nzDb) + " dB, and so does the law.");
      if (dsl && cfg.cat === "delete")
        add(quick.smoke > 30 ? "bad" : "warn", "DPF delete smokes",
          "Peak smoke is " + Math.round(quick.smoke) + "% opacity and there is nothing left to catch it. On-road diesel buyers cap smoke at 20\u201330%; a DOC + DPF takes it to almost nothing for a couple of percent of power.");
      else if (dsl && cfg.cat === "dpf" && quick.smoke < 10)
        add("good", "Filter on the stack",
          "The DPF holds the stack to " + Math.round(quick.smoke) + "% opacity whatever the fuelling does: any on-road buyer's smoke limit is met. It costs " + XS.dpBar.toFixed(2) + " bar of backpressure at peak power.");
    }

    /* --- fasteners, misc ------------------------------------------------------- */
    if (cfg.studs === "l19") {
      add("info", "L19 studs need looking after",
        "L19 is a low-alloy vacuum-melt steel at 1,500 MPa and it is genuinely susceptible to hydrogen embrittlement. Keep it oiled, keep it out of humid storage, and do not leave it torqued for years.");
    }
    if (cfg.studs === "age625" || (cfg.rodBolts === "age625" && (cfg.blockMat === "grey_iron" || cfg.blockMat === "cgi"))) {
      add("warn", "Superalloy fasteners into cast threads",
        "Custom Age 625+ will happily out-pull the thread it is screwed into. In an iron block the female thread is the weak link — use thread inserts or you will pull the deck threads instead of stretching the stud.");
    }
    if (cfg.studs === "arp_studs" && boost > 1.0) {
      add("good", "Studs, not bolts, for boost",
        "A stud is torqued as a nut against a washer, so the block thread only sees axial load. 62 kN a corner keeps the head down at the 140+ bar this engine will make.");
    }
    if (L.secondOrder > 0.5 && g.s > 90 && cfg.damper === "none") {
      add("warn", "Second-order shake with a long stroke and no damper",
        "This layout has an un-cancelled second-order vertical shake that scales with stroke and the square of rpm. At " + g.s.toFixed(0) + " mm of stroke you will feel it through everything bolted to the block.");
    }
    if (cfg.layout === "V8F") {
      add("info", "Flat-plane trade-off",
        "The 180° crank needs no heavy counterweights and gives perfectly alternating bank firing — that is where the light crank and the howl come from. You inherit an inline-four's second-order shake as the price.");
    }
    if (cfg.layout === "I6" || cfg.layout === "V12" || cfg.layout === "F6") {
      add("good", "Inherently balanced layout",
        "Primary and secondary forces and couples all cancel without balance shafts. Nothing you do to the reciprocating mass can unbalance it — only the torsional behaviour of the crank limits you.");
    }
    if (cfg.cr > 13 && cfg.fuel === "r87") {
      add("bad", "Regular fuel at high compression",
        "You are asking for well over 100 octane and buying 86.5 AKI. The knock control will retard everything it can and you will still be detonating at low rpm under load.");
    }
    if (!dsl && cfg.timing > 6) {
      add("warn", "Timing advanced well past MBT",
        "Past minimum-advance-for-best-torque you gain nothing and each extra degree adds roughly one octane number to the requirement. All you buy is peak pressure earlier in the stroke and heat into the piston.");
    }
    if (!dsl && cfg.timing < -6) {
      add("info", "Heavily retarded tune",
        "Retard is the safe direction but it is expensive: work moves out of the cylinder and into the exhaust, so you lose torque and gain 12 °C of EGT per degree.");
    }
    /* --- always-on character notes ------------------------------------------- */
    add("info", "Bore/stroke character",
      "At " + g.b.toFixed(0) + " × " + g.s.toFixed(0) + " mm the stroke/bore ratio is " + (g.s / g.b).toFixed(2) +
      (g.s / g.b < 0.95 ? " — oversquare, so it breathes at high rpm and keeps piston speed down."
        : g.s / g.b > 1.05 ? " — undersquare, which builds low-end torque but caps the redline through piston speed."
          : " — near square, the all-round compromise most modern engines settle on."));
    add("info", "Peak cylinder pressure path",
      "Peak pressure runs about " + (quick.loads.pmaxMPa * 10).toFixed(0) + " bar, which is what the crown, the rod, the bearings, the head studs and the gasket all have to carry. Every part choice in this build is really a choice about that one number.");
    if (dsl) add("info", "Exhaust gas temperature",
      "Peak EGT is " + quick.thermals.egtPeakC.toFixed(0) + " \u00b0C with \u03bb " + cfg.lambda.toFixed(2) + " at full load. A diesel runs cool because of all the spare air it carries; the exhaust heats up as the fuel creeps toward the smoke limit, and by about 12 \u00b0C for every degree of injection retard.");
    else add(quick.thermals.egtPeakC > 980 ? "warn" : "info", "Exhaust gas temperature",
      "Peak EGT is " + quick.thermals.egtPeakC.toFixed(0) + " °C at λ " + cfg.lambda.toFixed(2) + ". Exhaust valves, turbine wheels and the gasket fire ring all live off this number, and every degree of knock retard adds about 13 °C.");
    add(quick.clearances.hotMm < 0.030 ? "warn" : "good", "Running clearance",
      "Cold at " + (quick.clearances.coldMm * 1000).toFixed(0) + " µm, the " + OPT.piston[cfg.piston].name + " ends up at " + (quick.clearances.hotMm * 1000).toFixed(0) + " µm hot once the " + OPT.blockMat[cfg.blockMat].name + " bore and the skirt have both grown. The useful window is roughly 20-100 µm.");
    add("info", "Where the friction goes",
      "At " + quick.peakHpRpm + " rpm the mean piston speed is " + quick.loads.pistonSpeedMs.toFixed(1) + " m/s. Friction mean effective pressure climbs with the square of that, which is why a long stroke costs power twice: once in inertia and once in drag.");
    if (dsl) add("info", "Fuel choice",
      fu.name + ": cetane " + fu.cetane + ", stoichiometric " + fu.afr + ":1, " + (fu.lhv / 1e6).toFixed(1) + " MJ/kg at " + fu.dens.toFixed(3) + " kg/L. There is no octane to worry about: a diesel lights from the heat of compression, so the fuel's job is to light quickly (cetane) and carry energy by the litre.");
    else add("info", "Fuel choice",
      fu.name + (fu.flex ? " at E" + fu.ePct : "") + ": " + +fu.ron.toFixed(1) + " RON / " + +fu.mon.toFixed(1) + " MON, stoichiometric " + +fu.afr.toFixed(2) + ":1, " + (fu.lhv / 1e6).toFixed(1) + " MJ/kg. This build needs " + quick.knock.onRequired.toFixed(0) + " and the fuel offers " + fuelON.toFixed(0) + ".");
    add(L.n >= 8 ? "info" : "info", "Layout character",
      LAYOUTS[cfg.layout].name + ", firing " + LAYOUTS[cfg.layout].firingOrder.join("-") + ". Inherent balance rates " + LAYOUTS[cfg.layout].smooth + "/100 before you add a damper or balance shafts.");
    if (quick.rel === 0 && quick.fails.length) {
      add("bad", "Something in this build fails outright",
        "The physics says " + quick.fails.slice(0, 3).join(", ") + " " + (quick.fails.length > 1 ? "are" : "is") + " past the material limit. Reliability is zero until that is fixed — everything else is academic.");
    }
    /* --- launch hardware (strip only) --------------------------------- */
    if (cfg.launchCtl === "two_step_retard" && cfg.asp === "na")
      add("warn", "Launch retard with nothing to spool", "Retard on the two-step exists to heat the exhaust and light a turbo on the line. With no turbo it just cooks the manifold; a plain two-step holds the rpm just as well.");
    if (cfg.launchCtl === "two_step_retard" && (cfg.exhaust === "cast_log" || cfg.exhaust === "cast_tubular") && cfg.launchRetard >= 20)
      add("warn", "Heavy launch retard on a cast manifold", "At " + Math.round(cfg.launchRetard) + "° the turbine inlet climbs past " + (cfg.exhaust === "cast_log" ? 900 : 930) + " °C within a couple of seconds on the limiter, and cast manifolds crack from exactly that heat cycling. Keep the holds short, or fit tubular headers.");
    if (cfg.launchCtl === "two_step_retard" && OPT.asp[cfg.asp].kind === "turbo" && cfg.turbineMat === "cast_iron" && cfg.launchRetard >= 25)
      add("warn", "Ni-resist turbine behind a hot two-step", "The cast turbine housing is good to about 950 °C. Launch retard this heavy gets there in about two seconds on the line — an Inconel hot side takes another hundred degrees.");
    /* --- turbine geometry and anti-lag ------------------------------------ */
    const turboK = OPT.asp[cfg.asp].kind === "turbo";
    if (turboK && cfg.turbine === "vgt") {
      if (dsl && quick.smoke > 30)
        add(quick.smoke > 55 ? "bad" : "warn", "VGT on a smoky diesel sticks", "At about " + Math.round(quick.smoke) + "% peak smoke the soot cakes onto the vane ring and its pivots. A sticky VGT hangs shut (overboost, then limp mode) or open (no low-end at all). Fuel it to the smoke limit, or give it the air to burn what it gets.");
      else if (dsl) add("good", "Variable geometry on a diesel", "Cool, clean diesel exhaust is what VGTs were made for: the vanes shut to light the turbo just off idle and open up top, so one turbo does the job of a small one and a big one.");
      else if (cfg.turbineMat !== "inconel")
        add("bad", "VGT needs Inconel on petrol", "Petrol exhaust runs 200-300 °C hotter than diesel. A vane ring in a cast hot side warps and binds at about 880 °C; the production petrol VGTs use superalloy vanes good to about 1,000 °C and still run rich to stay under it.");
      else add("info", "Petrol VGT", "Superalloy vanes take about 1,000 °C. Earlier boost and a freer top end, at three times the price of a fixed turbine — keep the mixture rich enough that the vanes never see more.");
    }
    if (turboK && !dsl && cfg.als && cfg.als !== "off" && OPT.als[cfg.als]) {
      const ao = OPT.als[cfg.als];
      add(cfg.als === "air" || cfg.turbineMat !== "inconel" ? "bad" : "warn", "ALS cooks turbos", ao.name + " keeps the turbine spinning by burning fuel in the manifold every time the throttle shuts: the inlet spikes to about " + Math.round(quick.thermals.egtPeakC + ao.egtAdd) + " °C on every lift. Rally teams treat the turbo as a consumable. " + (cfg.turbineMat !== "inconel" ? "On a Ni-resist turbine it is a matter of passes, not seasons." : "Inconel buys time, not immunity."));
      if (cfg.exhaust === "cast_log" || cfg.exhaust === "cast_tubular")
        add("warn", "Anti-lag on a cast manifold", "Every bang is a heat cycle on the manifold. Cast manifolds crack from exactly that; a fabricated tubular manifold flexes instead.");
      if (cfg.launchCtl === "two_step_retard") add("info", "ALS and launch retard together", "On the line the two-step holds the revs and the retard and the anti-lag both heat the turbine — boost comes up fastest, and so does the turbine inlet temperature. Keep the holds short.");
      else if (cfg.launchCtl === "none") add("info", "Anti-lag without a two-step", "ALS will still build some boost on the line while the driver holds the revs, but a two-step holds them steadier and adds its own heat.");
    }
    /* --- nitrous kits (the newer kits: dry, stacked plates, diesel) ------ */
    const nk = OPT.nitrous[cfg.nitrous], nz = quick.nitrous;
    if (nk && nz && (nk.kind === "dry" || nk.kind === "diesel" || nk.stageHp)) {
      if (nz.dry && cfg.intake === "carb")
        add("bad", "Dry shot on a carburettor", "A dry kit leaves the fuel to the engine's injectors and an ECU that adds it while the button is closed. A carburettor has neither: the shot arrives with no fuel at all, and a lean nitrous cylinder melts its piston in a second. Use a wet plate under the carb.");
      else if (nz.dry && (nz.lean > 0.01 || quick.fuel.injUtil > 0.85))
        add("bad", "Dry shot on stock injectors", "With the " + nk.shotHp + " shot on, the injectors have to find about " + Math.round(nk.shotHp / (quick.peakHp || 1) * 100) + "% more fuel at once; they are already at " + Math.round(quick.fuel.duty * 100) + "% duty with the rail pressure raised" + (nz.lean > 0.01 ? ", and the mixture goes to \u03bb " + (cfg.lambda + nz.lean).toFixed(2) + " on the bottle" : "") + ". Bigger injectors and a pump with room to spare, or a wet kit that brings its own fuel.");
      else if (nz.dry && quick.fuel.pumpUtil <= 0.8 && quick.fuel.injUtil <= 0.8)
        add("good", "Dry kit with fuel to spare", "The injectors and pump can carry the " + nk.shotHp + " shot's fuel with margin left over, so the mixture stays where the tune put it when the button closes.");
      if (nk.plate && (cfg.intake === "plenum_long" || boosted))
        add("warn", "Wet plate on a " + (cfg.intake === "plenum_long" ? "long-runner intake" : "boosted intake") + " (backfire)", "A plate fills the " + (cfg.intake === "plenum_long" ? "long runners" : "intake tract") + " with fuel and nitrous; one misfire or a lean cylinder lights the lot and it comes back up the intake. About " + Math.round(nz.backfire * 100) + "% a pass here. Short runners, direct port, or a burst panel and a good ignition system.");
      else if (nk.plate && nz.backfire > 0.03)
        add("warn", "Wet plate backfire risk", "About " + Math.round(nz.backfire * 100) + "% of passes light the intake: the mixture is " + (quick.fuel.lamTop > cfg.lambda + 0.005 ? "going lean on the bottle" : "sitting in the plenum") + ". Purge on the line, keep the timing honest, and fit a burst panel.");
      if ((cfg.piston === "cast_alu" || cfg.piston === "hyper") && !dsl)
        add(nk.shotHp >= 125 ? "bad" : "warn", "Nitrous and " + (cfg.piston === "hyper" ? "hypereutectic" : "cast") + " pistons", "Nitrous burns fast and hot, and a cast or hypereutectic crown cracks rather than bends when the pressure spikes. Seventy-five on a healthy engine is usually fine; past that, forged pistons are the rule.");
      if (nk.stageHp || nk.shotHp >= 125)
        add("info", "Progressive saves the tyres", "This kit hits all at once. A progressive controller (or bringing the shot in after the 1-2 shift on the strip) feeds it in as the tyres take it, instead of spinning them off the line.");
      add("info", "Bottle heater", "Nitrous pressure follows the bottle's temperature: about 735 psi at 20 \u00b0C and 950 at 32 \u00b0C. A heater blanket holds it near 950 so the shot is the same every pass; without one a cool bottle flows less and less as the night goes on. Purge before every pass so the line is full of liquid.");
      if (nz.diesel) add("info", "Nitrous on a diesel", "The kit adds oxygen only. A moderate shot lets the injection pump turn its fuel up without smoke and actually cools the exhaust; a big one sends peak cylinder pressure through the roof \u2014 the head studs and gasket go before anything melts" + (quick.fuel.injUtil > 1 ? ". The injection pump is already on its stop, so part of the shot has nothing to burn." : "."));
      if (dsl && !nz.diesel) add("warn", "A petrol kit on a diesel", "This kit's fuel side is meant for petrol. The diesel kit just sprays nitrous into the intake and lets the injection pump find the fuel.");
      if (!dsl && nk.kind === "diesel") add("bad", "A diesel kit on a petrol engine", "The diesel kit has no fuel of its own and no ECU table behind it: on a spark engine it is a dry shot with nothing to burn it rich.");
    }
    if (cfg.transBrake === "trans_brake" && OPT.asp[cfg.asp].kind === "turbo")
      add("good", "Trans-brake on a turbo engine", "Held on the converter at full load, the engine drives the turbo as if the car were already moving, so it leaves on boost without needing as much retard.");
    return out;
  }

  /* two-stroke interactions: the pipe against the ports, the oil in the fuel, the crankcase and the blower */
  function twoStrokeCombos(cfg, quick, add, L) {
    const R = quick.twoStroke || {}, dsl = isDiesel(cfg), boosted = cfg.asp !== "na", crankcase = cfg.induct !== "blower";
    const red = cfg.redline, pr = +cfg.pipeRpm || 0, ep = +cfg.ePort || 0, rpmP = R.rpmP || 0;
    if (cfg.xpipe === "chamber" && !dsl) {
      if (pr > red * 1.04) add("bad", "The pipe is tuned past the redline", "The chamber is cut for " + Math.round(pr).toLocaleString("en-US") + " rpm and the engine stops at " + red.toLocaleString("en-US") + ": it never reaches the pipe. A longer header or belly brings the tune down to where the engine lives.");
      else if (rpmP && Math.abs(pr - rpmP) > 0.18 * rpmP) add("warn", "Pipe and ports disagree", "The ports breathe best near " + (Math.round(rpmP / 100) * 100).toLocaleString("en-US") + " rpm but the pipe is tuned to " + Math.round(pr).toLocaleString("en-US") + ". Each helps on its own; together they make two small humps instead of one big hit. Match the pipe to the port timing.");
      else add("good", "Pipe matched to the ports", "The chamber's return wave arrives as the ports are working hardest, so the delivery ratio and the trapping both peak together: that is the hit as it comes on the pipe at " + (R.onPipe || 0).toLocaleString("en-US") + " rpm.");
      if (cfg.induct === "piston") add("info", "Piston port on a pipe", "A piston-port intake closes as late as it opens, so below the pipe the crankcase spits charge back out of the carburettor. Strong on the pipe, soggy under it \u2014 a reed or a disc valve fills the bottom in.");
    }
    if (crankcase && cfg.lube !== "inject") {
      const r = +cfg.premix || 40;
      if (r >= 80) add(r >= 100 ? "bad" : "warn", "Lean premix", "At " + Math.round(r) + ":1 there is very little oil reaching the big end and the skirt. It frees up a little power, right up to the moment the piston picks up the bore on a long full-throttle run.");
      else if (r <= 25) add("warn", "Rich premix", "At " + Math.round(r) + ":1 the bearings never go short, but the plugs foul, the exhaust ports carbon up and the pipe drips black oil.");
      else add("good", "Sensible premix", "Around " + Math.round(r) + ":1 the bearings and the skirt get their oil and the plugs stay clean.");
    }
    if (crankcase && cfg.lube === "inject") add("good", "Oil injection", "The pump meters oil by throttle and rpm: rich when it is working, lean at idle, so less smoke and no seizure from a forgotten premix can.");
    if (!dsl && cfg.lambda > 0.92) add("bad", "Lean on a two-stroke", "The fuel is also what cools the piston crown and carries the oil. At \u03bb " + cfg.lambda.toFixed(2) + " the exhaust side of the piston runs hot enough to seize \u2014 two-strokes are jetted rich for a reason.");
    if (!dsl && cfg.tsFuel === "di") add("good", "Direct injection", "The fuel goes in after the exhaust port has closed, so only air short-circuits: most of a two-stroke's thirst, smoke and unburnt fuel disappear.");
    else if (!dsl && (R.scFuelPct || 0) >= 15) add("info", "Fuel out of the exhaust", "About " + R.scFuelPct + "% of the fuel at peak power short-circuits straight into the pipe with the charge. That is the price of fuel in the charge: direct injection is the fix.");
    if (cfg.pv === "fitted" && ep >= 180) add("good", "Power valve", "The valve drops the exhaust port roof at low rpm and opens it on the pipe, so the " + ep + "\u00b0 race timing does not cost the bottom end.");
    else if (cfg.pv !== "fitted" && ep >= 192 && !dsl) add("warn", "Race port, no power valve", "A " + ep + "\u00b0 exhaust port opens early enough to bleed the bottom end dry. Without a power valve it is all or nothing.");
    if (crankcase && (+cfg.ccr || 1.4) > 1.5) add("warn", "A lot of crankcase compression", "At " + (+cfg.ccr).toFixed(2) + ":1 the crankcase pumps hard low down, but it cannot hold enough charge for the top end and the main seals live under more pressure.");
    else if (crankcase && (+cfg.ccr || 1.4) < 1.25) add("info", "Soft crankcase compression", "A big crankcase volume loses low-down pumping but leaves room for the pipe to pull charge through at the top.");
    if (dsl && cfg.induct !== "blower") add("bad", "A two-stroke diesel needs a blower", boosted ? "A turbo alone makes nothing at idle, so there is no air to scavenge the cylinder and it will not start. Detroit and EMD gear a blower in for exactly this." : "The crankcase cannot push air through an 18:1 cylinder. Fit a gear-driven Roots blower.");
    if (cfg.induct === "blower" && boosted && OPT.asp[cfg.asp].kind === "turbo") add("good", "Turbo feeding the blower", "The turbo packs the blower's inlet, so the air box carries boost on top of the scavenge pressure: the Detroit TA recipe.");
    if (cfg.scav === "uniflow" && cfg.induct !== "blower" && !L.opposed) add("warn", "Uniflow without a blower", "Air in at the bottom, out through the valves at the top only works if something pushes it. A crankcase barely manages.");
    if (cfg.scav === "cross") add("info", "Deflector piston", "The deflector hump turns the charge upward, but it is a lump of aluminium in the flame: hot, heavy, and the chamber burns badly.");
    if (crankcase && !dsl && boosted) add("warn", "Boost on a crankcase two-stroke", "A turbine in the exhaust swallows the waves the pipe works with, and the crankcase still has to pump the charge. A blower-scavenged engine takes boost far better.");
    if (cfg.pistonClearance === "tight" && !dsl) add("warn", "Tight piston on a two-stroke", "The exhaust side of the piston grows more than the rest. Two-stroke builders run them loose and accept the rattle.");
    if (cfg.nitrous && cfg.nitrous !== "none") add("warn", "Nitrous on a two-stroke", "The shot lands on a piston that is already the hottest in the shop. Keep it small and rich.");
    if (L.n === 1) add("info", "A single shakes", "One cylinder firing every turn with nothing to cancel it: the frame, the mounts and the pipe hangers all take it.");
    if (cfg.xpipe === "muffled" && !dsl && ep >= 175) add("warn", "Race ports through a muffler", "Ports timed this hot want an expansion chamber to stuff the charge back in; through a box muffler most of it short-circuits and the top end goes nowhere.");
    if ((quick.econ || 0) >= 12 && !dsl) add("info", "Thirsty by design", "About " + (quick.econ || 0).toFixed(1) + " L/100 km at the cruise point: some of every charge goes straight out of the exhaust and a throttled two-stroke burns badly.");
    if (cfg.transBrake === "trans_brake" && OPT.asp[cfg.asp].kind === "turbo") add("good", "Trans-brake on a turbo engine", "Held on the converter at full load, the engine drives the turbo as if the car were already moving, so it leaves on boost.");
  }

  /* rotary interactions: seals, ports, oiling, the long shaft and the heat */
  function rotaryCombos(cfg, quick, add, L) {
    const boosted = cfg.asp !== "na", boost = boosted ? cfg.boost : 0, R = quick.rotary || {};
    const dm = quick.knock.margin, sl = cfg.apexSeal, pt = cfg.rotPort, om = cfg.oilMeter;
    const sealOEM = sl === "oem3" || sl === "oem2";
    if (boosted && sealOEM && (boost > 0.9 || dm < 3))
      add(sl === "oem2" || boost > 1.1 || dm < 1 ? "bad" : "warn", "Apex seals and boost",
        "Factory cast-iron seals live happily at the 0.7\u20130.8 bar Mazda sold them with. Past that, one knock event cracks a seal and the rotor loses compression on that face" + (sl === "oem2" ? " \u2014 and a 2 mm seal bends at half the pressure of a 3 mm one" : "") + ". Knock margin here is " + (dm >= 0 ? "+" : "") + dm.toFixed(1) + " octane. Billet steel seals, more octane or less boost.");
    else if (boosted && sl === "billet")
      add("good", "Billet seals for boost", "A one-piece steel seal bends instead of shattering when the chamber knocks, which is why every big-boost street rotary runs them. It is hard on a tired housing, so fit them with fresh chrome.");
    if (sl === "ceramic" && boosted && dm < 4)
      add("warn", "Ceramic seals and knock", "Silicon nitride is light and almost wear-proof, but it does not bend before it breaks: one detonation event and it is gravel. They belong in race engines on race fuel, not on the edge of the knock limit.");
    if (sl === "oem2" && cfg.redline >= 8500 && !boosted)
      add("good", "2 mm seals for revs", "Less seal mass means less bounce at the tip: the Renesis revs to nine thousand on seals that would chatter in a 3 mm engine.");
    if (pt === "bridge" || pt === "peri")
      add("info", pt === "bridge" ? "Bridge port idles like a cement mixer" : "Peripheral port: no idle to speak of",
        "With " + (pt === "bridge" ? "the bridge open" : "the intake in the rotor housing") + " the intake and exhaust overlap for a long time. At idle and light load the exhaust backs up into the intake, every other charge misfires, and you get the brap brap brap \u2014 about " + OPT.rotPort[pt].idle + " rpm is as low as it will go. It is magnificent from seven thousand up.");
    if (pt === "sidex")
      add("good", "Side exhaust: no overlap at all", "Moving the exhaust into the side housings ends the overlap a peripheral exhaust port forces on you: clean idle, less unburnt fuel, and the expansion runs a little longer before the port opens.");
    if ((om === "omp" || om === "emop") && R.oilUtil > 0.7)
      add(R.oilUtil > 1 ? "bad" : "warn", "Premix for track days", "The apex seals are oiled only by what the metering pump squirts in, and at " + cfg.redline.toLocaleString("en-US") + " rpm" + (boosted ? " and " + boost.toFixed(1) + " bar" : "") + " the " + OPT.oilMeter[om].name.replace(/^M/, "m").replace(/^E/, "e") + " is at " + Math.round(R.oilUtil * 100) + "% of what they want. Two-stroke oil in the tank at 1:200 on track days is cheap insurance.");
    if (om === "premix")
      add("info", "Premix only", "Every tank gets its two-stroke oil, the exhaust smells like a chainsaw and the side seals collect more carbon \u2014 but the seals are oiled exactly as hard as the engine is working.");
    if (L.n >= 3 && cfg.eshaft !== "split" && (R.eshaftUtil || 0) > 0.7)
      add((R.eshaftUtil || 0) > 1 ? "bad" : "warn", "A long eccentric shaft with no centre main", "Three or four rotors on a one-piece shaft leave a long beam between the end bearings. At " + cfg.redline.toLocaleString("en-US") + " rpm each rotor's orbit pulls " + (R.centKn || 0).toFixed(0) + " kN and the shaft bows about " + (R.eshaftUm || 0).toFixed(0) + " \u00b5m. A split shaft with a centre main bearing is how the four-rotor racers stay straight.");
    if (L.n >= 3 && cfg.eshaft === "split")
      add("good", "A centre main for a long shaft", "Splitting the shaft on tapers lets a third main bearing sit in the middle intermediate housing, halving the span the rotors' orbit has to bend.");
    if (cfg.rotHousing === "chrome" && (R.chatterUtil || 0) > 0.8)
      add("warn", "Chrome housings at these revs", "The apex seals are sliding at " + (R.apexMs || 0).toFixed(0) + " m/s. On chrome, a seal that starts to bounce leaves chatter marks that wreck the seal for good. Nikasil or ceramic surfaces, or lighter seals.");
    if (cfg.rotHousing === "ceramic")
      add("info", "Ceramic housings keep the heat in the gas", "A ceramic running surface insulates the housing: the coolant O-rings run cooler, the exhaust and the turbo run hotter.");
    if (boosted && cfg.cooling === "std")
      add((R.housingC || 0) > 170 ? "bad" : "warn", "Rotaries run hot", "Every chamber is wrapped in housing and combustion always happens on the same lobe, so a rotary puts far more heat into its coolant than a piston engine of the same power. The FD left the factory with an uprated radiator for a reason.");
    if (cfg.asp === "twin_turbo")
      add("good", "Sequential twins", "On a rotary the two turbos run in sequence: the primary alone lights early off the hot, sharp exhaust pulses, and the secondary is brought in near the top so the small turbo is never choking. There is a small dip at the changeover.");
    if (boosted && (cfg.fuel === "e85" || cfg.fuel === "methanol"))
      add("good", "Alcohol in a rotary", "Ethanol and methanol cool the charge, add octane exactly where a boosted rotary runs out of it, and burn clean enough to keep the side-seal grooves free of carbon.");
    if (boosted && cfg.cr > 9.6)
      add("bad", "High compression on a boosted rotary", "Mazda dropped the 13B-REW to 9.0:1 for boost. At " + cfg.cr.toFixed(1) + ":1 under " + boost.toFixed(1) + " bar the end gas against the hot lobe knocks long before the turbo runs out.");
    if (cfg.sidePlate === "alu" && L.n >= 3 && cfg.eshaft !== "split")
      add("warn", "Alloy side housings on a long shaft", "Aluminium end plates take weight off but give the main bearings less to stand on, and a long shaft needs all the support it can get.");
    if (cfg.nitrous && cfg.nitrous !== "none")
      add("warn", "Nitrous on a rotary", "A nitrous hit is a knock event waiting to happen and the apex seals are what take it. Keep the shot small, rich and late, and fit tough seals.");
    if ((quick.econ || 0) >= 9.5)
      add("info", "Thirsty by design", "A long, thin, moving chamber with a quench pocket at the trailing apex burns less of its fuel than a piston engine and loses more heat: about " + (quick.econ || 0).toFixed(1) + " L/100 km at a cruise. Economy buyers will not take it.");
    if (cfg.transBrake === "trans_brake" && OPT.asp[cfg.asp].kind === "turbo")
      add("good", "Trans-brake on a turbo engine", "Held on the converter at full load, the engine drives the turbo as if the car were already moving, so it leaves on boost without needing as much retard.");
  }

  /* =====================================================================
     15b. fitFuel() — the smallest injectors and pump that feed a build with
          margin (fuel test at or under 0.8: duty under 72%, pump under 76%).
          Sizes presets that carry no fuel parts, and fits builds saved
          before the fuel system existed so they don't suddenly lean out.
     ===================================================================== */
  function fitFuel(cfg, env) {
    cfg = Object.assign({}, DEFAULT_CFG, cfg || {});
    const ik = Object.keys(OPT.injectors), pk = Object.keys(OPT.fuelPump);
    if (isDiesel(cfg)) {
      // a diesel has no port injectors: size the injection system and nozzles (mm3 a stroke at or under 0.8 of what they push),
      // then the lift pump (burn plus return flow). The build's own injection system is kept if some nozzle size feeds it.
      const dk = Object.keys(OPT.dInj), nk = Object.keys(OPT.dNoz).sort((a, b) => OPT.dNoz[a].mult - OPT.dNoz[b].mult), e0 = env || DEFAULT_ENV;
      const qU = (di, nz) => simulate(Object.assign({}, cfg, { dInj: di, dNoz: nz, fuelPump: pk[pk.length - 1] }), e0).fuel.injUtil;
      const own = OPT.dInj[cfg.dInj] ? cfg.dInj : DEFAULT_CFG.dInj;
      const order = [own].concat(dk.filter(k => k !== own).sort((a, b) => OPT.dInj[a].cost - OPT.dInj[b].cost));
      const ownN = OPT.dNoz[cfg.dNoz] ? cfg.dNoz : DEFAULT_CFG.dNoz;
      let dI = null, dN = null, bestU = Infinity, bestI = own, bestN = nk[nk.length - 1];
      if (qU(own, ownN) <= 0.8) { dI = own; dN = ownN; }   // already feeds it: keep the build's own parts
      else for (const di of order) {
        for (const nz of nk) {
          const u = qU(di, nz);
          if (u <= 0.8) { dI = di; dN = nz; break; }
          if (nz === nk[nk.length - 1] && u < bestU) { bestU = u; bestI = di; bestN = nz; }   // nothing fits: remember the closest
        }
        if (dI) break;
      }
      if (!dI) { dI = bestI; dN = bestN; }
      const rd = simulate(Object.assign({}, cfg, { dInj: dI, dNoz: dN, fuelPump: pk[pk.length - 1] }), e0);
      let lp = pk[pk.length - 1];
      for (const k of pk) {
        let worst = 0;
        for (let i = 0; i < rd.rpms.length; i++) worst = Math.max(worst, rd.fuel.lph[i] * DSL_RETURN / pumpLphAt(OPT.fuelPump[k], rd.rpms[i], 0));
        if (worst / PUMP_MAX <= 0.8) { lp = k; break; }
      }
      return { injectors: cfg.injectors, fuelPump: lp, dInj: dI, dNoz: dN };
    }
    if (isGas(cfg)) {
      // propane / CNG: the injectors and pump are not in the circuit; size the gas system that meters it
      const gk = Object.keys(OPT.gasSys), rho = fuelDensity(fuelOf(cfg));
      const rg = simulate(Object.assign({}, cfg, { gasSys: gk[gk.length - 1] }), env || DEFAULT_ENV);
      let gasSys = gk[gk.length - 1];
      for (const k of gk) {
        const o = OPT.gasSys[k];
        let worst = 0;
        for (let i = 0; i < rg.rpms.length; i++) worst = Math.max(worst, rg.fuel.lph[i] / (o.kgh / rho * clamp(1 - o.dropBar * Math.max(0, rg.boostCurve[i]), 0.3, 1)));
        if (worst / PUMP_MAX <= 0.8) { gasSys = k; break; }
      }
      return { injectors: cfg.injectors, fuelPump: cfg.fuelPump, gasSys: gasSys };
    }
    // what the tune asks for does not depend on the parts, so one run with the biggest set sizes both
    const r = simulate(Object.assign({}, cfg, { injectors: ik[ik.length - 1], fuelPump: pk[pk.length - 1] }), env || DEFAULT_ENV);
    const f = r.fuel, lim = 0.8;
    let injectors = ik[ik.length - 1], fuelPump = pk[pk.length - 1];
    for (const k of ik) {
      const o = OPT.injectors[k];
      if (!f.portInj || f.ccCyl / (o.cc * (o.perCyl || 1) * (isRotary(cfg) ? 2 : 1)) / INJ_MAX <= lim) { injectors = k; break; }
    }
    for (const k of pk) {
      let worst = 0;
      for (let i = 0; i < r.rpms.length; i++) worst = Math.max(worst, f.lph[i] / (pumpLphAt(OPT.fuelPump[k], r.rpms[i], r.boostCurve[i]) * (r.nitrous && r.nitrous.dry && r.rpms[i] >= r.nitrous.winRpm ? 0.92 : 1)));   // a dry shot's raised rail costs the pump flow (as in simulate)
      if (worst / PUMP_MAX <= lim) { fuelPump = k; break; }
    }
    return { injectors: injectors, fuelPump: fuelPump };
  }

  /* =====================================================================
     16.  cfgLabel()
     ===================================================================== */
  const PORT_SHORT = { side: "side port", sidex: "side exhaust", street: "street port", bridge: "bridge port", peri: "peripheral port" };
  function cfgLabel(cfg) {
    cfg = Object.assign({}, DEFAULT_CFG, cfg || {});
    if (isRotary(cfg)) {
      const Lr = LAYOUTS[cfg.layout], g = rotGeometry(cfg, Lr);
      const asp = { na: "NA", turbo: "Turbo", twin_turbo: "Sequential twin-turbo", roots: "Supercharged", centrifugal: "Centrifugal", screw: "Screw-blown", compound: "Compound turbo" }[cfg.asp] || "Boosted";
      return Lr.n + "-rotor · " + (g.VdNom * 1000).toFixed(1) + " L · " + Math.round(cfg.bore) + "×" + Math.round(cfg.stroke) + " e" + (+(cfg.ecc || 15).toFixed(2)) + " · " + (PORT_SHORT[cfg.rotPort] || "side port") + " · " + asp;
    }
    if (isTwoStroke(cfg)) {
      const Lt = LAYOUTS[cfg.layout] || LAYOUTS.I4, gt = geometry(cfg);
      const lay = { V8F: "V8 FP", D18: "Deltic" }[cfg.layout] || cfg.layout;
      const how = { loop: "loop", cross: "cross", uniflow: "uniflow" }[cfg.scav] || "loop";
      const ind = { piston: "piston port", reed: "reed", disc: "disc valve", blower: "blower" }[cfg.induct] || "reed";
      return "2-stroke " + lay + " · " + (gt.VdNom * 1000).toFixed(gt.VdNom < 0.0002 ? 3 : gt.VdNom < 0.001 ? 2 : 1) + " L · " + Math.round(cfg.bore) + "×" + Math.round(cfg.stroke) + " · " + how + " · " + ind
        + (isDiesel(cfg) ? " diesel" + (cfg.asp !== "na" ? " + turbo" : "") : cfg.xpipe === "chamber" ? " · pipe " + (Math.round((+cfg.pipeRpm || 0) / 100) / 10).toFixed(1) + "k" : "") + (Lt.n ? "" : "");
    }
    const L = LAYOUTS[cfg.layout] || LAYOUTS.I4;
    const Vd = PI / 4 * cfg.bore * cfg.bore * cfg.stroke * L.n / 1e6; // litres
    const headName = { sohc2v: "SOHC 2v", dohc4v: "DOHC 4v", dohc4v_vvt: "DOHC 4v VVT", dohc4v_vvl: "DOHC 4v VVL", pushrod2v: "Pushrod 2v", billet_hemi: "Billet hemi" }[cfg.head] || (OPT.head[cfg.head] || {}).name || cfg.head;
    const aspName = { na: "NA", turbo: "Turbo", twin_turbo: "Twin-turbo", roots: "Supercharged", centrifugal: "Centrifugal", screw: "Twin-screw", compound: "Compound turbo" }[cfg.asp] || (OPT.asp[cfg.asp] || {}).name || cfg.asp;
    const lay = { I3: "I3", I4: "I4", I5: "I5", I6: "I6", V6: "V6", V8: "V8", V8F: "V8 FP", V10: "V10", V12: "V12", F4: "F4", F6: "F6" }[cfg.layout];
    return lay + " · " + Vd.toFixed(1) + " L · " + Math.round(cfg.bore) + "×" + Math.round(cfg.stroke)
      + " · " + headName + " · " + (isDiesel(cfg) ? (cfg.asp === "na" ? "NA diesel" : (aspName || "Boosted") + " diesel") : aspName);
  }

