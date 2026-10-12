       12.  Tests
       ================================================================= */
    const tests = [];
    function T(id, name, sub, util, physics, fix, rotOwn) {
      if (rot && !rotOwn && ROT_SKIP[id]) return;   // a rotary has no pistons, rods, valves or head gasket
      if (ts && !rotOwn && ((TS_SKIP[id] && !(tm.valves && id !== "valve_piston")) || (tsCaseB && TS_SKIP_CASE[id]))) return;   // ports, not valves; premix, not a sump
      util = (isFinite(util) && util > 0) ? util : 0.01;
      const status = util > 1.0 ? "crit" : util > 0.8 ? "warn" : "good";
      tests.push({ id: id, name: name, sub: sub, util: util, status: status, physics: physics, fix: fix });
    }

    /* fuel delivery: injector duty and pump load against what the tune asks for */
    const injUtil = dsl ? qUtilPk : portInj ? dutyPk / INJ_MAX : 0, pumpUtil = pumpPk / PUMP_MAX;
    const leanTop = lamTop > lamAt(leanRpm) + 0.005;
    // diesel: a pump on its stop just makes less power (leaner is cooler); a starved lift pump wrecks the injection pump
    const injTestD = dsl ? (injUtil <= 1 ? 0.78 * injUtil : Math.min(0.95, 0.78 + 0.1 * (injUtil - 1))) : 0;
    if (dsl) T("fuel_delivery", "Fuel delivery", injTestD >= pumpUtil ? Math.round(qDemPk) + " / " + Math.round(qCapPk) + " mm\u00b3" : Math.round(pumpNeedPk) + " / " + Math.round(pumpCapPk) + " L/h",
      Math.max(injTestD, pumpUtil),
      "At " + qRpm + " rpm each cylinder asks the " + dInj.name + " for " + Math.round(qDemPk) + " mm\u00b3 a stroke of " + O.fu.name + "; with " + dNoz.name.toLowerCase() + " it can push about " + Math.round(qCapPk) + " mm\u00b3"
      + (injUtil > 1 ? ", so it sits on its stop and the cylinders burn leaner than the tune asks (\u03bb " + lamTop.toFixed(2) + " at " + leanRpm + " rpm) \u2014 less power, not a melted piston. " : ". ")
      + "The " + fpump.short + " can lift about " + Math.round(pumpCapPk) + " L/h to it at " + pumpRpm + " rpm and has to supply " + Math.round(pumpNeedPk) + " L/h, burn plus the return flow that cools the pump.",
      "Bigger nozzles or a bigger injection pump for more fuel; a bigger lift pump if it is starving \u2014 a dry injection pump is a dead one.");
    else if (gasF) T("fuel_delivery", "Fuel delivery", Math.round(pumpNeedPk * fuelRho) + " / " + Math.round(pumpCapPk * fuelRho) + " kg/h",
      pumpUtil,
      "At " + pumpRpm + " rpm the engine burns about " + Math.round(pumpNeedPk * fuelRho) + " kg/h of " + O.fu.name.split(" (")[0].toLowerCase() + ", and the " + gs.name.toLowerCase() + " can meter about " + Math.round(pumpCapPk * fuelRho) + " kg/h there" + (maxBoost > 0.05 ? " against the boost in the manifold" : "") + "."
      + (leanTop ? " The top of the pull goes lean: \u03bb " + lamTop.toFixed(2) + " at " + leanRpm + " rpm where the tune asked for " + cfg.lambda.toFixed(2) + "." : ""),
      "A vapour-injection system or twin vaporisers meter more gas; a mixer is a forklift part.");
    else T("fuel_delivery", "Fuel delivery", injUtil >= pumpUtil ? Math.round(dutyPk * 100) + "% duty \u00b7 max " + Math.round(INJ_MAX * 100)
        : Math.round(pumpNeedPk) + " / " + Math.round(pumpCapPk) + " L/h",
      Math.max(injUtil, pumpUtil),
      (portInj ? "At " + dutyRpm + " rpm each cylinder wants " + Math.round(ccCylPk) + " cc/min of " + O.fu.name + " at \u03bb " + cfg.lambda.toFixed(2) + "; the " + inj.name.replace(" stock", "") + " injectors " + (dutyPk > 1 ? "would have to be open " + Math.round(dutyPk * 100) + "% of the time, which they cannot" : "are open " + Math.round(dutyPk * 100) + "% of the time") + ", and past about " + Math.round(INJ_MAX * 100) + "% an injector is all but static. "
        : "A carburettor meters through its jets, so only the pump counts here. ")
      + "At " + pumpRpm + " rpm the " + fpump.short + " can supply about " + Math.round(pumpCapPk) + " L/h" + (maxBoost > 0.05 && !fpump.rpmRef ? " against the extra rail pressure that boost adds" : "") + ", and the engine burns " + Math.round(pumpNeedPk) + " L/h there."
      + (leanTop ? " The top of the pull goes lean: \u03bb " + lamTop.toFixed(2) + " at " + leanRpm + " rpm where the tune asked for " + cfg.lambda.toFixed(2) + " \u2014 the exhaust and the piston crowns take the heat." : ""),
      "Fit bigger injectors or a bigger pump. Alcohol needs far more fuel than petrol for the same air, and boost makes an in-tank pump's job harder.");

    const detUtil = (0.95 - knockMargin * 0.062) * (1 + 0.45 * (O.pis.brittle || 0) * clamp(-knockMargin / 4, 0, 1));
    if (!dsl) T("detonation", "Detonation margin", (knockMargin >= 0 ? "+" : "") + knockMargin.toFixed(1) + " ON margin",
      detUtil,
      "Octane requirement " + knockOnReq.toFixed(0) + " from " + (cfg.cr).toFixed(1) + ":1 static (" + (cfg.cr * Math.pow((air.p + maxBoost * 1e5) / 101325, 0.24)).toFixed(1) + ":1 effective at " + maxBoost.toFixed(2) + " bar), " + maxChargeC.toFixed(0) + " °C charge and " + g.b.toFixed(0) + " mm bore; the fuel supplies " + fuelON.toFixed(0) + ".",
      knockMargin < 0 ? "Raise the fuel's octane, drop compression or boost, or cool the charge." : "Margin is adequate — keep charge temperature down.");
    if (flexW) T("flex_blend", "Winter blend", "E" + flexW.pct + " \u00b7 " + (flexW.margin >= 0 ? "+" : "") + flexW.margin.toFixed(1) + " ON",
      0.95 - (flexW.margin + 1) * 0.062,
      "Tuned at E" + flexW.nowPct + ", but the pump's winter blend can be as weak as E" + flexW.pct + ": less ethanol, a little less octane and less evaporative cooling, so the build needs " + flexW.onReq.toFixed(0) + " and gets " + flexW.fuelON.toFixed(0) + ". The sensor moves the timing" + (flexW.retardDeg > 0.5 ? ", pulling about " + flexW.retardDeg.toFixed(1) + "\u00b0 and " + (flexW.lossPct < 1 ? "under 1%" : flexW.lossPct.toFixed(0) + "%") + " of the power" + (flexW.margin < -1.8 ? " \u2014 and past that it runs out of timing to pull" : "") : ", and nothing has to give") + ".",
      "Leave margin at E" + flexW.pct + ": a point less compression or a little less boost, or tune it at the weaker blend.");

    // Pre-ignition is started by the HOTTEST SURFACE in the chamber (crown edge,
    // exhaust valve, plug nose), not by the gas temperature on its own.
    const hotSpotC = 0.42 * maxEgt + 0.58 * crownC + (O.headMat.k < 100 ? 25 : 0);
    const hotSpotLimit = 640 + 4.0 * (fuelON - 91) + (O.sq.crownC > 0 ? 15 : 0);
    if (!dsl) T("preignition_egt", "Pre-ignition / EGT", hotSpotC.toFixed(0) + " / " + hotSpotLimit.toFixed(0) + " °C",
      hotSpotC / hotSpotLimit,
      "Peak EGT is " + maxEgt.toFixed(0) + " °C at λ " + lamTop.toFixed(2) + " with " + maxRetard.toFixed(1) + "° of knock retard; the hottest chamber surface works out at " + hotSpotC.toFixed(0) + " °C against a " + hotSpotLimit.toFixed(0) + " °C surface-ignition threshold for this fuel.",
      "Richen the mixture, remove retard by fixing the knock problem, or fit piston cooling jets.");

    const cold = dsl ? coldStart(cfg, env.ambientC) : null;
    if (dsl) T("cold_start", "Cold start", Math.round(cold.T2C) + " / " + Math.round(cold.needC) + " \u00b0C",
      cold.util,
      "Cranking at " + env.ambientC + " \u00b0C, " + cfg.cr.toFixed(1) + ":1 squeezes the air to about " + Math.round(cold.T2C) + " \u00b0C" + (dInj.pilot > 0.5 ? " (pilot shots help)" : "") + "; " + O.fu.name + " at cetane " + cetane + " needs about " + Math.round(cold.needC) + " \u00b0C to light." + (cold.gel > 0.001 ? " Below its cloud point the fuel is waxing up in the filter as well." : ""),
      "Raise the compression ratio, use a higher-cetane fuel, or a common rail whose pilot shots warm the chamber.");
    /* propane: the tank's own vapour pressure feeds the regulator, and a cold vaporiser wants more of it */
    const lpgBar = gasF && O.fu.vapor ? propaneBar(env.ambientC) : 0;
    if (gasF && O.fu.vapor) T("cold_start", "Cold start", lpgBar.toFixed(1) + " / " + gs.needBar.toFixed(1) + " bar",
      gs.needBar / lpgBar,
      "At " + env.ambientC + " \u00b0C propane in the tank sits at about " + lpgBar.toFixed(1) + " bar absolute, and the " + gs.name.toLowerCase() + " wants about " + gs.needBar.toFixed(1) + " bar to feed the regulator while the vaporiser is still cold. Propane boils at \u221242 \u00b0C, so in deep cold there is hardly any pressure to push it out of the tank.",
      "Keep the tank warm (a blanket or a heated shed), use injection rather than a mixer, or run CNG, which is stored at 200 bar.");

    const mpsLimit = (O.rod.mpsLim || (O.rod.E < 150 ? 27.5 : O.rod.fatigue >= 620 ? 27.0 : O.rod.fatigue >= 430 ? 25.0 : O.rod.fatigue >= 330 ? 21.5 : 19.5)) * (tsCaseB ? 1.08 : 1);   // a two-stroke's short, one-ring piston
    T("piston_speed", "Mean piston speed", mpsRed.toFixed(1) + " / " + mpsLimit.toFixed(1) + " m/s",
      mpsRed / mpsLimit,
      "Mean piston speed is " + mpsRed.toFixed(1) + " m/s (2 × " + g.s.toFixed(0) + " mm × " + redline + " rpm) against " + mpsLimit.toFixed(1) + " m/s for this rod. Ring flutter, skirt wear and rod inertia all scale from this number.",
      "Shorten the stroke, drop the redline, or fit a rod material that tolerates the inertia.");

    T("crown_temp", "Piston crown temp", crownC.toFixed(0) + " / " + O.pis.maxCrownC + " °C",
      crownC / O.pis.maxCrownC,
      "Heat flux scales with BMEP × √rpm; at " + bmepPk.toFixed(1) + " bar and " + peakHpRpm + " rpm the crown sits at " + crownC.toFixed(0) + " °C against a " + O.pis.maxCrownC + " °C alloy limit (" + O.pis.k + " W/mK conductivity).",
      "Fit piston cooling jets, move to a 2618 forging, or run a fuel with more latent heat.");

    const crownStressMPa = maxPmax / 10 * 6.5 * Math.pow(g.b / 86, 0.8) * (O.pis.crownFac || 1) * (dsl ? 0.65 : 1);   // bowl-in-piston crowns are far thicker
    const crownHotMPa = clamp(O.pis.hot250 * (1 - (O.pis.hotSlope || 0.0055) * (crownC - 230)), 25, 400);
    T("crown_pressure", "Crown strength", crownStressMPa.toFixed(0) + " / " + crownHotMPa.toFixed(0) + " MPa",
      crownStressMPa / crownHotMPa,
      "Peak cylinder pressure of " + maxPmax.toFixed(0) + " bar works out at " + crownStressMPa.toFixed(0) + " MPa of bending in the crown; the alloy retains about " + crownHotMPa.toFixed(0) + " MPa at " + crownC.toFixed(0) + " °C.",
      "Use a stronger hot alloy (2618), thicken the crown by lowering boost, or cut peak pressure.");

    T("hot_clearance", "Hot piston clearance", hotMm <= 0.001 ? "seized hot" : (hotMm * 1000).toFixed(0) + " µm · min 20",
      hotMm <= 0.001 ? 20 : Math.min(20, 0.020 / hotMm),
      "Cold clearance " + (coldMm * 1000).toFixed(0) + " µm; the bore grows " + (growBore * 1000).toFixed(0) + " µm (α " + (boreAlpha * 1e6).toFixed(1) + "e-6) and the skirt grows " + (growPis * 1000).toFixed(0) + " µm (α " + (O.pis.alpha * 1e6).toFixed(1) + "e-6 at " + skirtC.toFixed(0) + " °C), leaving " + (hotMm * 1000).toFixed(0) + " µm. Below 20 µm the skirt picks up the bore.",
      "Open the piston-to-wall clearance or move to a lower-expansion alloy.");

    T("slap_blowby", "Cold slap / blow-by", hotMm <= 0 ? "seized hot" : (hotMm * 1000).toFixed(0) + " / 100 µm",
      hotMm <= 0 ? 2.5 : hotMm / (0.100 * Math.max(1, O.pc.fac / 0.00090)),
      "Running clearance of " + (hotMm * 1000).toFixed(0) + " µm. Past about 100 µm the piston rocks in the bore: audible slap cold, ring flutter and blow-by hot.",
      "Tighten the clearance or use an alloy that grows more so it takes up the gap hot.");

    T("ring_gap", "Ring end gap", (ringGapMm * 1000).toFixed(0) + " µm · min " + (ringGapNeededMm * 1000).toFixed(0),
      ringGapNeededMm / ringGapMm,
      "Gap is set at " + (ringGapMm * 1000).toFixed(0) + " µm (" + (O.ring.gapSet * 1000).toFixed(1) + " thou per inch of bore); at " + maxEgt.toFixed(0) + " °C EGT and " + maxBoost.toFixed(2) + " bar the top ring needs " + (ringGapNeededMm * 1000).toFixed(0) + " µm or the ends butt and the ring picks the bore.",
      "Open the top ring gap, or fit a steel top ring that is specified with a larger gap.");

    const rodTenLimit = O.rod.alu ? O.rod.uts * 0.52 : O.rod.fatigue * 0.85;
    T("rod_tension", "Rod tensile stress", sigRodT.toFixed(0) + " / " + rodTenLimit.toFixed(0) + " MPa",
      sigRodT / rodTenLimit,
      (O.rod.alu ? "Aluminium has no endurance limit, so this rod is not judged on infinite life \u2014 it is judged on what it survives for a handful of passes, and then it is a service item. " : "")
      + "At " + redline + " rpm the " + (mRecip * 1000).toFixed(0) + " g reciprocating mass pulls " + (Frec / 1000).toFixed(1) + " kN through the beam at TDC exhaust \u2014 " + sigRodT.toFixed(0) + " MPa against a " + O.rod.fatigue + " MPa endurance limit.",
      "Lighter pistons, a stronger rod alloy, or fewer revs.");

    const bucklWorkKn = 0.45 * Pcr;
    T("rod_buckling", "Rod buckling", (Fcomp / 1000).toFixed(0) + " / " + bucklWorkKn.toFixed(0) + " kN",
      (Fcomp / 1000) / bucklWorkKn,
      "Peak gas load puts " + (Fcomp / 1000).toFixed(0) + " kN of compression into a rod whose Euler critical load is " + Pcr.toFixed(0) + " kN (E = " + O.rod.E + " GPa, " + lRodMm.toFixed(0) + " mm between centres). Real columns are never run to Euler — the working limit is 45% of it, " + bucklWorkKn.toFixed(0) + " kN.",
      "A stiffer rod material or a bigger beam section; titanium's 114 GPa needs extra area.");

    T("rod_bolts", "Rod bolt stress", sigBolt.toFixed(0) + " / " + (0.90 * O.rb.uts).toFixed(0) + " MPa",
      sigBolt / (0.90 * O.rb.uts),
      "Each bolt carries " + (Frec / 2000).toFixed(1) + " kN of inertia load on top of its " + preload.toFixed(0) + " MPa preload; total " + sigBolt.toFixed(0) + " MPa against " + O.rb.uts + " MPa tensile.",
      "Fit a higher-tensile bolt (ARP2000 or Custom Age 625+) or reduce reciprocating mass.");

    const crankLimit = O.crk.fatigue * 0.80;
    T("crank_fatigue", "Crank bending fatigue", sigCrank.toFixed(0) + " / " + crankLimit.toFixed(0) + " MPa",
      sigCrank / crankLimit,
      "Journal overlap is " + overlapMm.toFixed(1) + " mm (0.585 × bore − ½ stroke), so the fillet sees " + sigCrank.toFixed(0) + " MPa of bending against a " + O.crk.fatigue + " MPa fatigue strength.",
      "A forged or nitrided crank, more journal overlap (shorter stroke), or less peak pressure.");

    T("torsional", "Crank torsional", torAmp.toFixed(2) + " / " + torLimit.toFixed(2) + "°",
      torUtil,
      "First torsional mode is about " + f1.toFixed(0) + " Hz; the " + majorOrder + (majorOrder === 1 ? "st" : "th") + "-order firing harmonic crosses it at " + resRpm.toFixed(0) + " rpm" + (inRes ? " — inside the operating range" : " — outside the operating range") + ". Damper absorbs " + (O.dmp.damping * 100).toFixed(0) + "%.",
      "Fit a viscous damper, use a stiffer crank, or keep the resonant order out of the rev range.");

    const brgLimit = Math.round(O.brg.limitMPa * ((O.fu.corrosive > 0.5 && !O.brg.methanolOK) ? 0.80 : 1) * (dsl ? 1.4 : 1) * (tsCaseB ? 1.6 : 1));   // a crankcase two-stroke runs needle rollers   // diesel shells: thicker steel back, harder overlay
    T("bearing_load", "Bearing specific load", bearMPa.toFixed(0) + " / " + brgLimit + " MPa",
      bearMPa / brgLimit,
      "Peak rod load " + (Fcomp / 1000).toFixed(0) + " kN over a " + djPin.toFixed(0) + " × " + wPin.toFixed(0) + " mm projected area is " + bearMPa.toFixed(0) + " MPa; the overlay is rated " + brgLimit + ((O.fu.corrosive > 0.5 && !O.brg.methanolOK) ? " (derated 20% — " + O.fu.name + " corrodes a bimetal overlay)" : "") + " MPa.",
      "Wider or larger-diameter journals, or a trimetal/coated bearing with more load capacity.");

    const filmMin = +(0.55 + 0.45 * (O.brg.galling == null ? 1 : O.brg.galling)).toFixed(2);
    T("oil_film", "Hydrodynamic film", filmUm.toFixed(2) + " µm · min " + filmMin.toFixed(2),
      filmMin / Math.max(0.02, filmUm),
      "At " + env.oilC + " °C the oil is " + kvOil.toFixed(1) + " cSt; against " + bearMPa.toFixed(0) + " MPa of specific load the minimum film works out at " + filmUm.toFixed(2) + " µm. Below " + filmMin.toFixed(2) + " µm the asperities start to touch.",
      "Thicker oil grade, lower oil temperature, or reduce the bearing load.");

    T("head_lift", "Head clamp margin", (Fgas / 1000).toFixed(0) + " / " + clampWorkKn.toFixed(0) + " kN",
      headLiftUtil,
      "Cylinder pressure lifts the head with " + (Fgas / 1000).toFixed(0) + " kN over the bore; " + boltsPerCyl + " fasteners clamp each bore with " + clampKn.toFixed(0) + " kN" + (pullOut > 1.01 ? " (thread pull-out in cast aluminium costs " + Math.round((1 - 1 / pullOut) * 100) + "%)" : "") + ". A head gasket needs roughly twice the gas load in clamp to stay sealed, so the working limit is " + clampWorkKn.toFixed(0) + " kN.",
      "Move to studs (ARP or L19) so the clamp load stays ahead of peak cylinder pressure.");

    T("gasket_shear", "Head gasket", gasketPmaxUtil > gasketShearUtil
        ? maxPmax.toFixed(0) + " / " + gasketPmaxBar.toFixed(0) + " bar"
        : scrubUm.toFixed(0) + " / " + O.gsk.shearUm + " µm",
      Math.max(gasketShearUtil, gasketPmaxUtil),
      "Head and block expand at " + (O.headMat.alpha * 1e6).toFixed(0) + " and " + (O.block.alpha * 1e6).toFixed(0) + "e-6/K, so across a bore pitch the deck faces scrub " + scrubUm.toFixed(0) + " µm; the gasket tolerates " + O.gsk.shearUm + " µm and " + gasketPmaxBar.toFixed(0) + " bar (seeing " + maxPmax.toFixed(0) + ").",
      "Match head and block expansion, or fit an MLS gasket whose coated layers slip instead of fretting.");

    T("valve_float", "Valve float", redline + " / " + floatRpm.toFixed(0) + " rpm",
      floatUtil,
      "Spring rate " + O.spr.rate.toFixed(2) + "× against " + (massEff).toFixed(2) + "× reciprocating valvetrain mass on " + dvMm.toFixed(0) + " mm valves puts loss of control at " + floatRpm.toFixed(0) + " rpm; redline is " + redline + ".",
      "Lighter valves and retainers, a higher spring rate, or a lower redline.");

    T("valve_piston", "Valve-to-piston", valvePistonMm.toFixed(2) + " mm · min 0.90",
      0.90 / Math.max(0.02, valvePistonMm),
      "At 12° after overlap TDC the piston has dropped " + pistonDrop.toFixed(2) + " mm while the valve is still " + liftAtOverlap.toFixed(2) + " mm off its seat, and the " + cfg.cr.toFixed(1) + ":1 dome takes " + domeMm.toFixed(2) + " mm — " + valvePistonMm.toFixed(2) + " mm left.",
      "Cut deeper valve pockets, reduce overlap or lift, or drop the compression ratio.");

    T("valve_temp", "Exhaust valve temp", valveC.toFixed(0) + " / " + O.valve.maxTempC + " °C",
      valveC / O.valve.maxTempC,
      "Exhaust valve head runs near " + valveC.toFixed(0) + " °C with " + maxEgt.toFixed(0) + " °C gas; the material is good to " + O.valve.maxTempC + " °C before it necks and drops.",
      "Sodium-filled or Inconel exhaust valves, or lower the exhaust gas temperature.");

    T("oil_starvation", "Oil pickup / aeration", (redline / pumpLimit) > (gProfile / O.osys.gLimit)
        ? redline + " / " + pumpLimit + " rpm"
        : gProfile.toFixed(2) + " / " + O.osys.gLimit.toFixed(2) + " g",
      starveUtil,
      "The " + cfg.oilSystem + " sump holds prime to " + O.osys.gLimit + " g and the pump keeps up to about " + pumpLimit + " rpm; this test asks for " + gProfile.toFixed(2) + " g at " + redline + " rpm.",
      "Baffle the sump, or go dry sump for both surge immunity and the windage gain.");

    T("cooling", "Heat rejection", Qkw.toFixed(0) + " / " + radKw.toFixed(0) + " kW",
      coolUtil,
      "The engine dumps about " + Qkw.toFixed(0) + " kW into the coolant at this duty cycle; the radiator package can shed " + radKw.toFixed(0) + " kW.",
      "Uprate the radiator and oil cooler, or accept a lower sustained power level.");

    T("compressor_map", "Compressor flow", !boosted ? "no compressor"
        : (bm.kind === "roots" || bm.kind === "screw") ? maxFlowLb.toFixed(0) + " lb/min blower"
        : maxFlowLb.toFixed(0) + " / " + compCap.toFixed(0) + " lb/min",
      compUtil,
      boosted ? ("Peak demand is about " + maxFlowLb.toFixed(0) + " lb/min (power ÷ 10) against " + compCap.toFixed(0) + " lb/min of wheel capacity; past the choke line the compressor just heats the air."
      ) : "Naturally aspirated — no compressor in the system.",
      "Step up a turbo size, or split the flow across two smaller units.");

    T("turbine_temp", "Turbine inlet temp", (bm.kind === "turbo") ? maxEgt.toFixed(0) + " / " + O.tm.maxEgtC + " °C" : "no turbine",
      turbUtil,
      (bm.kind === "turbo") ? ("Turbine inlet sees " + maxEgt.toFixed(0) + " °C; the " + O.tm.name + " is rated to " + O.tm.maxEgtC + " °C before the housing cracks or the wheel creeps."
      ) : "No turbine in the exhaust stream.",
      "Fit an Inconel hot side, richen the mixture, or remove the knock retard that is raising EGT.");

    if (vgtO) {
      // diesel: soot cakes the vane ring and it sticks (usually shut: overboost, then limp mode); petrol: the vanes' own heat limit
      const vLim = dsl ? 0 : (vgtO.vaneEgtC[cfg.turbineMat] || 880);
      T("vgt_vanes", "VGT vane ring", dsl ? "smoke " + Math.round(smokePk * 100) + "%" : maxEgt.toFixed(0) + " / " + vLim + " °C",
        dsl ? 0.30 + 0.95 * smokePk : maxEgt / vLim,
        dsl ? ("Peak smoke is about " + Math.round(smokePk * 100) + "% opacity. Soot builds up on the vanes and their pivots; a smoky tune glues them shut, and a stuck-closed VGT overboosts and then goes into limp mode.")
          : ("The vane ring sees " + maxEgt.toFixed(0) + " °C; with a " + (cfg.turbineMat === "inconel" ? "superalloy" : "cast") + " hot side the vanes are good to about " + vLim + " °C before they warp and bind. Petrol runs several hundred degrees hotter than diesel, which is why petrol VGTs are rare and expensive."),
        dsl ? "Turn the fuel down to the smoke limit, or richen the air: more boost, a bigger turbo, finer injection." : "Inconel hot side, a richer mixture, or less knock retard. Or a fixed-geometry turbine.");
    }
    if (alsO) {
      const alsC = maxEgt + alsO.egtAdd, aLim = vgtO ? Math.min(O.tm.maxEgtC, vgtO.vaneEgtC[cfg.turbineMat] || 880) : O.tm.maxEgtC;
      T("als_heat", "Anti-lag turbine heat", Math.round(alsC) + " / " + aLim + " °C",
        0.88 * alsC / aLim,                                  // in bursts, not continuously
        "With the throttle shut, " + alsO.name.toLowerCase() + " burns fuel in the manifold to keep the turbo spinning: the turbine inlet spikes to about " + Math.round(alsC) + " °C on every lift. It does nothing on a dyno pull, but on the road or the strip the turbine, the manifold and the exhaust valves wear out far faster.",
        "An Inconel hot side, a tubular manifold, or ignition-retard ALS instead of secondary air. Or switch it off away from a stage.");
    }

    T("bore_distortion", "Bore roundness", boreDist.toFixed(0) + " / 60 µm",
      boreDist / 60,
      "At " + maxPmax.toFixed(0) + " bar the bore distorts about " + boreDist.toFixed(0) + " µm with this block stiffness (" + O.block.name + (cfg.blockMat.indexOf("alu") === 0 ? ", " + O.deck.name.toLowerCase() : "") + "). Past ~60 µm the rings cannot follow.",
      "Close the deck, move to CGI or iron, or torque-plate hone to the real clamped shape.");

    T("wall_thickness", "Cylinder wall", wallThicknessMm.toFixed(1) + " mm · min " + wallLimit.toFixed(1),
      wallLimit / Math.max(0.2, wallThicknessMm),
      "Bore pitch works out at " + borePitch.toFixed(0) + " mm for this bore and stroke, leaving " + wallThicknessMm.toFixed(1) + " mm of wall between bores; " + O.block.name + " needs at least " + wallLimit + " mm to stay round and take the heat.",
      "Reduce the bore, or choose a block material that tolerates a thinner wall.");

    /* ---- rotary tests: seals, housings and the eccentric shaft take the place of pistons, rods and valves ---- */
    if (rot) {
      const R = RT, sl = O.apex;
      T("apex_seal", "Apex seal load", R.sealMPa.toFixed(0) + " / " + sl.fatigue + " MPa", R.sealUtil,
        "Peak chamber pressure of " + maxPmax.toFixed(0) + " bar" + (R.knockAmp > 1.01 ? ", hit " + R.knockAmp.toFixed(1) + "\u00d7 harder by knock," : "") + " bends each " + sl.thick + " mm seal across its slot at about " + R.sealMPa.toFixed(0) + " MPa once the combustion shock is counted; the " + sl.name + " lives with about " + sl.fatigue + " MPa. A cracked apex seal drops the compression on that face for good.",
        "Thicker or tougher seals (billet steel takes a knock event), less boost, or more octane so it never knocks.", true);
      T("housing_chatter", "Seal chatter", R.apexMs.toFixed(1) + " / " + R.chatterLim.toFixed(1) + " m/s", R.chatterUtil,
        "At " + redline + " rpm on the eccentric shaft the rotors turn " + R.rotorRpm + " rpm and the apex seals slide along the housing at " + R.apexMs.toFixed(1) + " m/s, flung outward at " + Math.round(R.apexG).toLocaleString("en-US") + " g. A " + sl.name + " on " + O.rh.name.toLowerCase() + " follows the surface to about " + R.chatterLim.toFixed(1) + " m/s; past that it bounces and hammers chatter marks into the housing.",
        "Lighter seals (ceramic or 2 mm), a harder housing surface, or fewer revs.", true);
      T("coolant_seal", "Hot lobe & O-rings", R.housingC.toFixed(0) + " / " + R.oringLim + " \u00b0C", R.housingC / R.oringLim,
        "Combustion always happens on the same stretch of a rotor housing, so that lobe never sees a cool intake charge. At " + R.bmep.toFixed(1) + " bar BMEP and " + peakHpRpm + " rpm it runs near " + R.housingC.toFixed(0) + " \u00b0C; the rubber coolant O-rings between the housings harden and leak past about " + R.oringLim + " \u00b0C \u2014 coolant into the chamber and white smoke out of the pipe.",
        "A bigger radiator and oil cooler, less boost, or ceramic-coated housings that keep the heat in the gas.", true);
      T("eshaft", "Eccentric shaft", R.eshaftUm.toFixed(0) + " \u00b5m \u00b7 max 50", R.eshaftUtil,
        "Each " + R.mRotor.toFixed(1) + " kg rotor orbits " + (g.e * 1000).toFixed(1) + " mm off centre and pulls " + R.centKn.toFixed(0) + " kN at redline, on top of a " + R.gasKn.toFixed(0) + " kN gas push. With " + R.rotors + " rotor" + (R.rotors > 1 ? "s" : "") + " carried on " + R.supports + " main bearings the shaft bows about " + R.eshaftUm.toFixed(0) + " \u00b5m and its journals see " + R.eshaftMPa.toFixed(0) + " MPa against " + O.esh.fatigue + " MPa fatigue strength; past ~50 \u00b5m a rotor face starts touching its side housing.",
        "A split shaft with a centre main bearing on three or four rotors, a billet shaft, or fewer revs.", true);
      T("bearing_load", "Rotor bearing load", R.brgMPa.toFixed(0) + " / " + R.brgLim + " MPa", R.brgMPa / R.brgLim,
        "The gas load on a rotor flank and the rotor's own orbit both go through its bearing: about " + R.brgMPa.toFixed(0) + " MPa over the rotor bearing's projected area, against " + R.brgLim + " MPa for the " + O.brg.name + " shells.",
        "Trimetal or coated bearing shells, or less peak pressure.", true);
      const filmMinR = +(0.55 + 0.45 * (O.brg.galling == null ? 1 : O.brg.galling)).toFixed(2);
      T("oil_film", "Hydrodynamic film", R.filmUm.toFixed(2) + " \u00b5m \u00b7 min " + filmMinR.toFixed(2), filmMinR / Math.max(0.02, R.filmUm),
        "At " + env.oilC + " \u00b0C the oil is " + kvOil.toFixed(1) + " cSt; against " + R.brgMPa.toFixed(0) + " MPa on the rotor bearings the minimum film is " + R.filmUm.toFixed(2) + " \u00b5m. The same oil cools the inside of the rotors, so it runs hot.",
        "Thicker oil grade, a bigger oil cooler, or less bearing load.", true);
      T("oil_metering", "Seal oiling", Math.round(R.oilUtil * 100) + "% of supply", R.oilUtil,
        "The apex and side seals are lubricated only by oil burnt with the charge. At " + redline + " rpm" + (maxBoost > 0.05 ? " and " + maxBoost.toFixed(2) + " bar" : "") + " the seals want about " + Math.round(R.oilUtil * 100) + "% of what the " + O.omp.name.toLowerCase() + " delivers; short of oil they wear their tips and scuff the chrome. It burns about " + R.oilL.toFixed(1) + " L of oil per 1,000 km doing it.",
        "Premix for track days, an electronic pump that meters by load, or fewer revs.", true);
      T("carbon_seals", "Carbon & side seals", Math.round(R.carbon * 100) + "% \u00b7 sticks 100", R.carbon,
        "Burnt oil and rich running leave carbon in the side-seal grooves; an engine that is never revved out never blows it clean, and stuck side seals lose compression across the rotor faces." + (env.testType === "endurance" && env.loadProfile === "highway" ? " A highway duty cycle is the worst for it." : ""),
        "Less oil in the charge, leaner cruise, hardened side housings \u2014 and a redline a day keeps the carbon away.", true);
      T("detonation", "Detonation margin", (knockMargin >= 0 ? "+" : "") + knockMargin.toFixed(1) + " ON margin", R.det,
        "Octane requirement " + knockOnReq.toFixed(0) + " from " + cfg.cr.toFixed(1) + ":1 (" + (cfg.cr * Math.pow((air.p + maxBoost * 1e5) / 101325, 0.24)).toFixed(1) + ":1 effective at " + maxBoost.toFixed(2) + " bar) and " + maxChargeC.toFixed(0) + " \u00b0C charge; the fuel supplies " + fuelON.toFixed(0) + ". A rotary's end gas sits against the hot lobe, and a knock event goes straight into the apex seals.",
        knockMargin < 0 ? "More octane, less boost, a cooler charge \u2014 rotaries hate knock." : "Margin is adequate \u2014 keep the charge cool; boost eats it fast on a rotary.", true);
      T("preignition_egt", "Pre-ignition / EGT", R.hotSpot.toFixed(0) + " / " + R.hotLim.toFixed(0) + " \u00b0C", R.hotSpot / R.hotLim,
        "Peak EGT is " + maxEgt.toFixed(0) + " \u00b0C \u2014 the exhaust port opens while the charge is still burning \u2014 and the trailing plug's boss on the hot lobe works out at " + R.hotSpot.toFixed(0) + " \u00b0C against a " + R.hotLim.toFixed(0) + " \u00b0C surface-ignition threshold for this fuel.",
        "Richen the mixture, cool the housings, or run a fuel with more octane.", true);
    }

    /* ---- two-stroke tests: the ports, the oil in the fuel, the crankcase and the pipe ---- */
    if (ts) {
      const R = TSI;
      T("ts_seize", "Piston seizure", Math.round(R.seize * 100) + "% of the edge", R.seize,
        "The exhaust side of a two-stroke piston never sees a cool charge and fires every turn: the crown runs at " + crownC.toFixed(0) + " \u00b0C against a " + O.pis.maxCrownC + " \u00b0C alloy limit, "
        + (tsCaseB ? (cfg.lube === "inject" ? "oiled by an injection pump" : "oiled only by " + Math.round(tsLubR) + ":1 premix") : "oiled from a pressure-fed sump")
        + (dsl ? "" : ", at \u03bb " + lamTop.toFixed(2)) + " with " + O.pc.name.toLowerCase().replace(/ [0-9.]+ in$/, "") + " clearance. Lean, hot or short of oil, the skirt picks up the bore and it seizes \u2014 usually with the throttle wide open.",
        "Richer jetting, a richer premix (40:1 rather than 80:1), looser piston clearance, more cooling, or a forged piston.", true);
      T("port_wear", "Rings & port bridges", (mpsRed).toFixed(1) + " m/s \u00b7 " + Math.round(R.ep) + "\u00b0", R.portW,
        "The rings sweep across the port windows " + Math.round(redline / 60) + " times a second at " + mpsRed.toFixed(1) + " m/s. A " + Math.round(R.ep) + "\u00b0 exhaust port is tall and wide, and the ring ends flex out into it and wear on its edges and the bridge between its windows. This is the top end a racer replaces every few weekends.",
        "Shorter exhaust duration, a bridged exhaust port, fewer revs or a shorter stroke.", true);
      if (tsCaseB) T("crank_seals", "Crankcase seals", R.sealMs.toFixed(1) + " m/s \u00b7 " + R.ccr.toFixed(2) + ":1", R.seals,
        "The crankcase is the scavenge pump, so its main-bearing seals have to hold " + R.ccr.toFixed(2) + ":1 of pumping pressure with the lips running at " + R.sealMs.toFixed(1) + " m/s. A hardened seal leaks air: the engine idles high, runs lean on that cylinder and seizes.",
        "Less crankcase compression, fewer revs, or PTFE seals at the next rebuild.", true);
      if (tm.chamber) T("pipe_crack", "Expansion chamber", Math.round(R.pipeT) + " \u00b0C \u00b7 shake " + Math.round(Math.min(1, L.firstOrder) * 100) + "%", R.pipeU,
        "The pipe runs at about " + Math.round(R.pipeT) + " \u00b0C and the engine shakes it " + Math.round(redline / 60) + " times a second; the welds at the header and the stinger work-harden and crack, and a cracked pipe loses its tune at once.",
        "Richer jetting to cool it, spring mounts instead of rigid brackets, or a smoother layout.", true);
      if (!dsl) T("plug_foul", "Plug fouling", "\u03bb " + (MAP ? mapLook(MAP, MAP.lam, Math.min(redline, 1500), 20) : cfg.lambda).toFixed(2) + (tsCaseB && cfg.lube !== "inject" ? " \u00b7 " + Math.round(tsLubR) + ":1" : ""), R.foul,
        "At idle a two-stroke four-strokes: it only fires every other turn and the charge sits wet in the crankcase. A rich mixture" + (tsCaseB && cfg.lube !== "inject" ? " and oily premix" : "") + " leave carbon and oil on the plug nose until it shorts out and the engine dies on the starting line.",
        "Leaner low-speed jetting, less oil in the premix, a hotter plug, or direct injection.", true);
      if (dsl || tm.blower) T("scav_air", "Scavenging air", "DR " + R.drLow.toFixed(2) + " at 1,000 rpm", R.scav,
        "A two-stroke has no intake stroke: something has to push the fresh air in and the exhaust out. At 1,000 rpm this " + (tm.blower ? "blower" : dsl && bm.kind === "turbo" ? "turbo alone" : "crankcase") + " delivers a ratio of " + R.drLow.toFixed(2) + " (fresh air per swept volume)" + (R.scav > 1 ? " \u2014 not enough to clear the cylinder, so it will not idle, or even start." : "."),
        "A gear-driven Roots blower: a two-stroke diesel needs one to start, with or without a turbo.", true);
    }

    /* =================================================================
       13.  Reliability, life, endurance, over-rev
       ================================================================= */
    function score(u) {
      if (u <= 0.8) return 1;
      if (u >= 1.0) return 0;         // crit -> zeroes the whole engine anyway
      return 1 - 0.5 * (u - 0.8) / 0.2;
    }
    let minS = 1, sumS = 0, anyCrit = false;
    const fails = [];
    for (let i = 0; i < tests.length; i++) {
      const s = score(tests[i].util);
      if (tests[i].status === "crit") { anyCrit = true; fails.push(tests[i].name); }
      if (s < minS) minS = s;
      sumS += s;
    }
    const meanS = sumS / tests.length;
    const rel = anyCrit ? 0 : clamp(100 * (0.55 * minS + 0.45 * meanS), 0, 100);

    const worstUtil = tests.reduce((a, t) => Math.max(a, t.util), 0);
    const sorted = tests.slice().sort((a, b) => b.util - a.util);
    const firstToFail = sorted[0] ? sorted[0].name : "—";
    let lifeHours = anyCrit ? 0 : clamp(5000 * Math.pow(0.82 / Math.max(0.4, worstUtil), 7), 1, 5000);
    /* A race engine is not measured in hours of driving. Count passes instead:
       ten seconds at full load from a standing start, on fresh parts.       */
    const raceSpec = !!(O.rod.alu || (O.n2o.shotHp || 0) >= 250 || peakHp > 1200);
    const racePasses = anyCrit ? 0 : Math.round(clamp(600 * Math.pow(0.85 / Math.max(0.4, worstUtil), 6)
      * (O.rod.alu ? 0.12 : 1) * (O.n2o.shotHp ? 0.75 : 1), 1, 4000));

    /* --- endurance: Miner's rule on a Basquin S-N proxy, per subsystem --- */
    let endurance = null;
    if (env.testType === "endurance") {
      const lf = env.loadProfile === "track" ? 1.06 : env.loadProfile === "highway" ? 0.86 : 0.96;
      const damage = {}; let failedAtHour = null; const log = [];
      const hours = Math.max(1, env.hours | 0);
      const rate = {};
      for (let i = 0; i < tests.length; i++) {
        const t = tests[i];
        rate[t.id] = clamp(Math.pow(t.util * lf / 0.82, 7) / 5000, 0, 1);
        damage[t.id] = 0;
      }
      const step = Math.max(1, Math.round(hours / 40));
      for (let h = step; h <= hours; h += step) {
        for (const id in rate) {
          const before = damage[id];
          damage[id] = Math.min(1.2, before + rate[id] * step);
          if (before < 0.5 && damage[id] >= 0.5) log.push({ hour: h, event: "50% fatigue life used: " + id });
          if (before < 1 && damage[id] >= 1 && failedAtHour === null) {
            failedAtHour = h;
            log.push({ hour: h, event: "FAILURE — " + id + " reached its fatigue limit" });
          }
        }
        if (failedAtHour !== null) break;
      }
      let worstId = null, worstD = -1;
      for (const id in damage) if (damage[id] > worstD) { worstD = damage[id]; worstId = id; }
      endurance = { damage: damage, failedAtHour: failedAtHour, log: log };
      if (failedAtHour === null && log.length === 0) log.push({ hour: hours, event: "Completed " + hours + " h, worst subsystem " + worstId + " at " + (worstD * 100).toFixed(0) + "% life used" });
      lifeHours = Math.min(lifeHours, worstD > 0 ? clamp(hours / Math.max(1e-6, worstD), 1, 5000) : 5000);
    }

    /* --- over-rev: 1.15x redline for half a second --- */
    let overrev = null;
    if (env.testType === "overrev" && !rot) {
      const orRpm = redline * 1.15;
      const k = sq(orRpm / redline);
      const ev = [];
      let survived = true;
      const fUtil = ts && !tm.valves ? 0 : orRpm / floatRpm;
      if (fUtil > 1.0) { survived = false; ev.push("Valve float at " + orRpm.toFixed(0) + " rpm (control lost at " + floatRpm.toFixed(0) + ") — valves kissed the pistons."); }
      else if (fUtil > 0.93) ev.push("Springs on the edge of surge at " + orRpm.toFixed(0) + " rpm but the valves stayed on the cam.");
      const sigT2 = sigRodT * k, boltU = (preload + 0.35 * (Frec * k / 2) / aBolt) / (0.90 * O.rb.uts);
      if (sigT2 > O.rod.fatigue) { survived = false; ev.push("Rod beam at " + sigT2.toFixed(0) + " MPa, past the " + O.rod.fatigue + " MPa endurance limit — a crack starts here."); }
      else if (sigT2 > O.rod.fatigue * 0.92) ev.push("Rod beam reached " + sigT2.toFixed(0) + " MPa against a " + O.rod.fatigue + " MPa endurance limit — it survived, but that is one cycle off the S-N curve you will not get back.");
      if (boltU > 1.0) { survived = false; ev.push("Rod bolts yielded: " + (preload + 0.35 * (Frec * k / 2) / aBolt).toFixed(0) + " MPa against " + O.rb.uts + " MPa."); }
      else if (boltU > 0.9) ev.push("Rod bolts reached " + (boltU * 100).toFixed(0) + "% of tensile — replace them.");
      if (!tsCaseB && orRpm > pumpLimit) ev.push("Oil pump cavitated above " + pumpLimit + " rpm; pressure dropped for a fraction of a second.");
      if (!tsCaseB && orRpm > pumpLimit * 1.10) { survived = false; ev.push("Sustained loss of oil pressure wiped the rod bearings."); }
      if (ts && TSI && TSI.pipeRpm && orRpm > TSI.pipeRpm * 1.12) ev.push("Way over the pipe at " + orRpm.toFixed(0) + " rpm: the power fell off a cliff, which is what saved it.");
      if (ev.length === 0) ev.push(ts ? "Nothing complained \u2014 the rods, pistons and crank all had margin at " + orRpm.toFixed(0) + " rpm." : "Nothing complained — the valvetrain, rods and oil system all had margin at " + orRpm.toFixed(0) + " rpm.");
      overrev = { survived: survived, events: ev };
    }
    if (env.testType === "overrev" && rot) {
      const orRpm = redline * 1.15, k = sq(1.15), ev = [];
      let survived = true;
      const chat = RT.chatterUtil * 1.15;
      if (chat > 1.05) { survived = false; ev.push("Apex seals lost the housing at " + orRpm.toFixed(0) + " rpm: they chattered across the " + O.rh.name.toLowerCase() + " and one snapped."); }
      else if (chat > 0.95) ev.push("Apex seals were bouncing at " + orRpm.toFixed(0) + " rpm \u2014 expect chatter marks in the housings at the next teardown.");
      const esU = RT.eshaftUtil * (0.35 + 0.65 * k);
      if (esU > 1.0) { survived = false; ev.push("The eccentric shaft bowed at " + orRpm.toFixed(0) + " rpm and a rotor face picked up its side housing."); }
      else if (esU > 0.9) ev.push("The eccentric shaft flexed to " + Math.round(esU * 100) + "% of its clearance \u2014 check the side housings for rub marks.");
      const brU = (RT.brgMPa / RT.brgLim) * Math.max(1, 0.8 * k);
      if (brU > 1.0) { survived = false; ev.push("Rotor bearings overloaded by the rotors' own orbit at " + orRpm.toFixed(0) + " rpm."); }
      if (orRpm > pumpLimit) ev.push("Oil pump cavitated above " + pumpLimit + " rpm; pressure dropped for a fraction of a second.");
      if (orRpm > pumpLimit * 1.10) { survived = false; ev.push("Sustained loss of oil pressure wiped the rotor bearings."); }
      if (ev.length === 0) ev.push("Nothing complained \u2014 apex seals, eccentric shaft and rotor bearings all had margin at " + orRpm.toFixed(0) + " rpm (the rotors themselves at " + Math.round(orRpm / 3) + ").");
      overrev = { survived: survived, events: ev };
    }

    /* =================================================================
       14.  Mass, cost, economy, smoothness
       ================================================================= */
    const refVd = { I3: 1.0, I4: 2.0, I5: 2.5, I6: 3.0, V6: 3.5, V8: 5.0, V8F: 4.5, V10: 5.2, V12: 6.0, F4: 2.0, F6: 3.4 }[cfg.layout] || 2.0;
    let kg = O.lay.massKg * Math.pow((g.Vd * 1000) / refVd, 0.42) * (0.55 + 0.45 * O.block.massFac);
    if (dsl) kg = kg * 1.35 + dInj.massKg;                            // thicker decks, bigger mains, a heavier head for the pressure
    kg += O.headMat.massFac * O.hd.massFac * L.n * 3.4;
    kg += (bm.kind === "turbo" ? bm.units * 9 * (O.ts.maxFlow > 100 ? 1.8 : 1) : bm.kind === "roots" ? 22 : bm.kind === "screw" ? 26 : bm.kind === "centrifugal" ? 11 : 0);
    kg += O.icc.massKg + O.osys.massKg + O.cool.massKg + O.exh.massKg * (L.banks) + 14;
    kg += gasF ? gs.massKg : (fpump.massKg || 0);                    // a belt pump hangs off the engine; in-tank ones live in the car
    const exRuns = exP.pipe.runs || 1, exOpenH = !!exP.pipe.open;
    kg += exP.pipe.massKg + (exOpenH ? 0 : exRuns * (exP.muf.massKg + exP.cat.massKg) + exP.cut.massKg);   // 0 for the stock system
    if (rot) {
      // housings and plates, scaled with the quoted displacement against a 654 cc-a-rotor 13B
      kg = O.lay.massKg * Math.pow(g.VdNom * 1000 / (0.654 * L.n), 0.55) * (0.62 + 0.38 * O.rsp.massFac);
      kg += (bm.kind === "turbo" ? bm.units * 9 * (O.ts.maxFlow > 100 ? 1.8 : 1) : bm.kind === "roots" ? 22 : bm.kind === "screw" ? 26 : bm.kind === "centrifugal" ? 11 : 0);
      kg += O.icc.massKg + O.osys.massKg + O.cool.massKg + O.exh.massKg + 10 + (gasF ? gs.massKg : (fpump.massKg || 0));
      kg += exP.pipe.massKg + (exOpenH ? 0 : exRuns * (exP.muf.massKg + exP.cat.massKg) + exP.cut.massKg);
    }
    if (ts) {   // a crankcase two-stroke is a light thing with no head to speak of; a Detroit is still a diesel
      const VdL = g.VdNom * 1000;
      kg = dsl ? 128 * Math.pow(VdL, 0.86) * (L.opposed ? 0.62 : 1) : (12 + 30 * VdL + 4 * L.n) * (0.70 + 0.30 * O.block.massFac);
      kg += (bm.kind === "turbo" ? bm.units * 9 * (O.ts.maxFlow > 100 ? 1.8 : 1) : bm.kind === "roots" ? 22 : bm.kind === "screw" ? 26 : bm.kind === "centrifugal" ? 11 : 0);
      kg += (tm.blower ? (dsl ? 30 + 5 * VdL : 12) : 0) + O.xp.massKg * (tm.chamber ? L.n : Math.max(1, L.banks)) + O.icc.massKg + O.cool.massKg + (tsCaseB ? 0 : O.osys.massKg);
      kg += (gasF ? gs.massKg : (fpump.massKg || 0)) + (dsl ? dInj.massKg * 0.5 : 0);
      kg += exP.pipe.massKg + (exOpenH ? 0 : exRuns * (exP.muf.massKg + exP.cat.massKg) + exP.cut.massKg);
    }
    kg = Math.round(kg);

    const perCyl = O.pis.cost + O.ring.cost + O.rod.cost + O.rb.cost
      + (O.valve.cost + O.spr.cost) * 0.35 * (O.hd.nIV);
    let rawCost = O.lay.cost + O.block.costPerL * (g.Vd * 1000) + O.hd.cost + O.headMat.cost
      + ((cfg.blockMat.indexOf("alu") === 0) ? O.deck.cost : 0)
      + L.n * perCyl + O.crk.cost + O.dmp.cost + O.brg.cost + O.gsk.cost + O.std.cost
      + O.ink.cost + O.asp.cost + (boosted ? O.ts.cost + O.tm.cost + O.icc.cost : 0)
      + O.oil.cost + O.osys.cost + O.sq.cost + O.cool.cost + O.exh.cost * L.banks + O.cov.cost
      + ((OPT.launchCtl[cfg.launchCtl] || OPT.launchCtl.none).cost + (OPT.transBrake[cfg.transBrake] || OPT.transBrake.none).cost)
      + (vgtO ? (dsl ? vgtO.cost : vgtO.costPetrol) * bm.units : 0) + (alsO ? alsO.cost : 0)
      + (portInj ? L.n * (inj.perCyl || 1) * inj.cost : 0) + (gasF ? gs.cost : fpump.cost)
      + (dsl ? dInj.cost + L.n * dNoz.cost : 0)
      + exP.pipe.cost + (exOpenH ? 0 : exRuns * (exP.muf.cost + exP.cat.cost) + exP.cut.cost);
    if (rot) rawCost = O.lay.cost + L.n * (O.rh.cost + O.apex.cost + 260) + (L.n + 1) * O.rsp.cost + O.esh.cost * (L.n > 2 ? 1.6 : 1)
      + O.port.cost * L.n * 0.5 + O.omp.cost + O.brg.cost
      + O.ink.cost + O.asp.cost + (boosted ? O.ts.cost + O.tm.cost + O.icc.cost : 0)
      + O.oil.cost + O.osys.cost + O.cool.cost + O.exh.cost + O.cov.cost
      + ((OPT.launchCtl[cfg.launchCtl] || OPT.launchCtl.none).cost + (OPT.transBrake[cfg.transBrake] || OPT.transBrake.none).cost)
      + (portInj ? L.n * 2 * (inj.perCyl || 1) * inj.cost : 0) + (gasF ? gs.cost : fpump.cost)   // primary and secondary injectors on every rotor
      + (vgtO ? vgtO.costPetrol * bm.units : 0) + (alsO ? alsO.cost : 0)
      + exP.pipe.cost + (exOpenH ? 0 : exRuns * (exP.muf.cost + exP.cat.cost) + exP.cut.cost);
    if (ts) rawCost = O.lay.cost + O.block.costPerL * (g.VdNom * 1000) * 2 + O.headMat.cost * 0.4 + (tm.valves ? (O.valve.cost + O.spr.cost) * 2 * L.n + 800 : 0)
      + L.n * (L.opposed ? 2 : 1) * (O.pis.cost + O.ring.cost + O.rod.cost + O.rb.cost) + O.crk.cost * (L.opposed ? 3 : 1) + O.dmp.cost + O.brg.cost + O.gsk.cost + O.std.cost
      + O.scv.cost + O.ind2.cost * (tm.blower ? 1 : Math.max(1, L.n / 2)) + (dsl ? 0 : O.tsf.cost) + O.pvO.cost * L.n + (tsCaseB ? O.lubeO.cost : O.oil.cost + O.osys.cost + O.sq.cost)
      + O.asp.cost + (boosted ? O.ts.cost + O.tm.cost + O.icc.cost : 0) + O.cool.cost + O.xp.cost * (tm.chamber ? L.n : 1) + O.cov.cost
      + ((OPT.launchCtl[cfg.launchCtl] || OPT.launchCtl.none).cost + (OPT.transBrake[cfg.transBrake] || OPT.transBrake.none).cost)
      + (vgtO ? (dsl ? vgtO.cost : vgtO.costPetrol) * bm.units : 0) + (alsO ? alsO.cost : 0)
      + (portInj ? L.n * (inj.perCyl || 1) * inj.cost : 0) + (gasF ? gs.cost : fpump.cost) + (dsl ? dInj.cost + L.n * dNoz.cost : 0)
      + exP.pipe.cost + (exOpenH ? 0 : exRuns * (exP.muf.cost + exP.cat.cost) + exP.cut.cost);
    const cost = Math.round((0.155 * rawCost + 120 * L.n + 250) * (shop.costFac || 1));

    /* WOT indicated work at the cruise point, used as the 100%-load reference */
    const nCrRef = clamp(2400 * Math.pow(2.0 / Math.max(0.6, g.Vd * 1000), 0.16), 1400, 3000);
    const TchargeCr = air.T + 18;                                   // manifold warms the charge a little
    const imepWotRef = veAt(nCrRef, cfg, g, vm, O.ink, O.hd, TchargeCr, 0) * air.rho * O.fu.lhv
      * (1 / (O.fu.afr * 1.0)) * etaComb(1.0) * ottoEta(cfg.cr, O.fu.gamma) * K_QUAL;

    /* ---- cruise fuel consumption -------------------------------------
       A real part-load operating point rather than a constant: 18 kW at
       100 km/h, gearing picked so a bigger engine turns slightly slower.
       The engine has to be throttled down to that load, and the throttling
       (pumping work), the friction it is dragging and the residual gas the
       cam leaves behind are what actually decide cruise economy — which is
       why a big-cam race engine drinks fuel doing nothing.               */
    const cruiseW = 18000;                                          // W at the crank
    const nCr = clamp(2400 * Math.pow(2.0 / Math.max(0.6, g.Vd * 1000), 0.16), 1400, 3000);
    const bmepCr = cruiseW * 4 * PI / (g.Vd * (nCr * 2 * PI / 60)); // Pa the engine must make
    const mpsCr = 2 * (g.s / 1000) * nCr / 60;
    let fmepCrBar = FM_C + FM_P * 22 + FM_S * mpsCr + FM_S2 * mpsCr * mpsCr;
    fmepCrBar *= (0.86 + 0.14 * Math.pow(kvOil / 10.5, 0.55)) * O.oil.fricFac * O.ring.fric;
    fmepCrBar *= (1 + 0.025 * (O.spr.rate - 1)) * (L.n > 8 ? 1.03 : 1.0) * (L.n > 5 ? 1.02 : 1.0);
    if (bm.kind === "roots") fmepCrBar += 0.12;                      // a blower still turns at cruise
    if (bm.kind === "screw") fmepCrBar += 0.09;
    if (bm.kind === "centrifugal") fmepCrBar += 0.04;
    const fmepCr = fmepCrBar * 1e5;
    const veCrWot = veAt(nCr, cfg, g, vm, O.ink, O.hd, TchargeCr, 0);  // WOT breathing at that rpm
    const lamCrStock = clamp(cfg.lambda + 0.07, 0.92, 1.05);         // closed loop pulls back to stoich
    let lamCr = lamCrStock, ignCr = 0, loadCr = 0;                    // a map: the cruise cell's own lambda and timing
    const pExhCr = air.p * (1 + (boosted ? 0.06 : 0.03) * O.exh.backP);
    const camNorm = cfg.cam / 100;
    let imepCr = bmepCr + fmepCr + 0.35e5, mapCr = air.p * 0.35, etaCr = 0.30;
    for (let it = 0; it < 3; it++) {
      /* how far open the throttle has to be for this much indicated work */
      const load = clamp(imepCr / Math.max(1e4, imepWotRef), 0.04, 1);
      mapCr = clamp(air.p * load, air.p * 0.06, air.p);
      if (MAP && !dsl) {
        loadCr = load; lamCr = mapLook(MAP, MAP.lam, nCr, 100 * load); ignCr = mapLook(MAP, MAP.ign, nCr, 100 * load);
        mapCr = Math.min(air.p, mapCr * lamCr / lamCrStock);           // leaner: more air for the same fuel, less throttling
      }
      /* residual gas left by valve overlap scales with how deep the vacuum is */
      let resid = 0.05 + 0.55 * camNorm * (1 - mapCr / air.p);
      if (O.hd.vvt) resid *= 0.58;                                   // phasers close the overlap at cruise
      resid = clamp(resid, 0.03, 0.45);
      etaCr = ottoEta(cfg.cr, O.fu.gamma) * K_QUAL
        * (1 + (O.hd.burn - 1) * 0.55)
        * (1 - 1.5 * Math.max(0, resid - 0.12))                      // dilute charge burns badly
        * etaComb(lamCr) * (MAP ? mapCruiseEta(lamCr, lamCrStock, ignCr, O.hd.burn) : 1);
      etaCr = clamp(etaCr, 0.12, 0.45);
      const pmepCr = pExhCr - mapCr;                                 // throttling loss
      imepCr = bmepCr + fmepCr + pmepCr;
    }
    const fuelPow = imepCr * g.Vd * (nCr / 120) / etaCr;             // W of fuel energy
    const fuelKgS = fuelPow / O.fu.lhv;
    const fuelDens = O.fu.afr < 8 ? 792 : O.fu.afr < 12 ? 782 : 745; // methanol / E85 / gasoline
    const litresPerHour = fuelKgS * 3600 / fuelDens * 1000;
    /* rotary cruise: the same throttled operating point, with seal friction, the leakier, quench-heavy
       part-load burn and the port overlap's exhaust reversion in place of a cam                     */
    let lphRot = 0;
    if (rot) {
      let fmR = rotFmepBar(nCr, 22, g, O.apex) * (0.86 + 0.14 * Math.pow(kvOil / 10.5, 0.55)) * O.oil.fricFac;
      if (bm.kind === "roots") fmR += 0.12;
      if (bm.kind === "screw") fmR += 0.09;
      if (bm.kind === "centrifugal") fmR += 0.04;
      const etaR0 = ottoEta(cfg.cr, O.fu.gamma) * K_QUAL * ROT_ETA * (1 + O.port.etaB) * rotLeak(nCr, O.apex, 0);
      const imepRefR = rotVeAt(nCr, rv, O.ink, TchargeCr, 0) * air.rho * O.fu.lhv / O.fu.afr * etaComb(1.0) * etaR0;
      let imepR = bmepCr + fmR * 1e5 + 0.35e5, etaR = 0.25;
      for (let it = 0; it < 3; it++) {
        const mapR = clamp(air.p * clamp(imepR / Math.max(1e4, imepRefR), 0.04, 1), air.p * 0.06, air.p);
        const resid = clamp(0.05 + 0.55 * O.port.overlap * (1 - mapR / air.p), 0.03, 0.50);
        etaR = clamp(etaR0 * ROT_CRUISE * (1 - 1.5 * Math.max(0, resid - 0.12)) * etaComb(lamCr), 0.10, 0.40);
        imepR = bmepCr + fmR * 1e5 + (pExhCr - mapR);
      }
      lphRot = imepR * g.Vd * (nCr / 120) / etaR / O.fu.lhv * 3600 / fuelDens * 1000;
    }
    /* diesel cruise: no throttle, so no pumping loss; the same air every stroke and only as much
       fuel as the work needs, which leaves lambda well past 2 at a cruise                  */
    let lphD = 0, lamCrD = 0;
    if (dsl) {
      let fmD = FM_C + FM_P * 65 + FM_S * mpsCr + FM_S2 * mpsCr * mpsCr;
      fmD *= (0.86 + 0.14 * Math.pow(kvOil / 10.5, 0.55)) * O.oil.fricFac * O.ring.fric;
      fmD *= (1 + 0.025 * (O.spr.rate - 1)) * (L.n > 8 ? 1.03 : 1.0) * (L.n > 5 ? 1.02 : 1.0);
      if (bm.kind === "roots") fmD += 0.12;
      if (bm.kind === "screw") fmD += 0.09;
      if (bm.kind === "centrifugal") fmD += 0.04;
      const imepD = bmepCr + (fmD + 0.10) * 1e5 + air.p * 0.035 * O.exh.backP * (boosted ? 1.4 : 1);
      const rhoCr = (air.p + (bm.kind === "turbo" ? 0.15e5 : 0)) / (R_AIR * TchargeCr);   // a little boost even at a cruise
      const airCr = veCrWot * rhoCr * g.Vd * nCr / 120;               // kg/s, unthrottled
      let etaD = 0.40, fKg = 0;
      lamCrD = 2.5;
      for (let it = 0; it < 4; it++) {
        etaD = ottoEta(cfg.cr, O.fu.gamma) * K_QUAL * K_DSL * clamp(1 - 0.20 / lamCrD, 0.55, 1)
          * (1 + (O.hd.burn - 1) * 0.30) * (1 + 0.0008 * (g.b - 86)) * etaCombD(lamCrD, dInj.etaB)
          / (1 + 0.0018 * sq(MAP ? mapLook(MAP, MAP.ign, nCr, 100 * clamp(bmepCr / Math.max(1e4, peakTq * 4 * PI / g.Vd), 0, 1)) : cfg.timing)) * 0.95;   // light load: proportionally more heat into the walls
        fKg = imepD * g.Vd * (nCr / 120) / etaD / O.fu.lhv;
        lamCrD = clamp(airCr / (fKg * O.fu.afr), 1.3, 8);
      }
      lphD = fKg * 3600 / O.fu.dens;
    }
    /* two-stroke cruise: no valvetrain to drag, but a throttled two-stroke keeps most of its exhaust and misfires, and with
       the fuel in the charge the share that short-circuits goes out unburnt. A diesel's blower still has to be driven.   */
    let lphTs = 0;
    if (ts) {
      const tbC = tsBreathe(nCr, tm, 0, 0.82 * TS_PIPE_T0);
      let fmT = ((tsCaseB ? TS_FC : FM_C) + FM_P * (dsl ? 65 : 22) + FM_S * mpsCr + FM_S2 * mpsCr * mpsCr) * O.ring.fric
        * (tsCaseB ? tsLubeK : (0.86 + 0.14 * Math.pow(kvOil / 10.5, 0.55)) * O.oil.fricFac);
      if (tm.blower) fmT += tsBoxBar(mpsCr, tbC.dr) * tbC.dr / 0.55;
      if (bm.kind === "roots") fmT += 0.12;
      if (bm.kind === "screw") fmT += 0.09;
      if (bm.kind === "centrifugal") fmT += 0.04;
      if (dsl) {
        const imepD = bmepCr + (fmT + 0.10) * 1e5 + air.p * 0.03 * O.xp.backP;
        const rhoCr = (air.p + (bm.kind === "turbo" ? 0.15e5 : 0)) / (R_AIR * TchargeCr);
        const airCr = Math.max(0.05, tbC.ce) * rhoCr * g.Vd * nCr / 120;
        let etaD = 0.40, fKg = 0, lamD = 2.5;
        for (let it = 0; it < 4; it++) {
          etaD = ottoEta(cfg.cr, O.fu.gamma) * K_QUAL * K_DSL * TS_ETA_D * clamp(1 - 0.20 / lamD, 0.55, 1) * (1 + (O.hd.burn - 1) * 0.30)
            * (1 + 0.0008 * (g.b - 86)) * etaCombD(lamD, dInj.etaB) / (1 + 0.0018 * sq(cfg.timing)) * 0.95;
          fKg = imepD * g.Vd * (nCr / 120) / etaD / O.fu.lhv;
          lamD = clamp(airCr / (fKg * O.fu.afr), 1.3, 8);
        }
        lphTs = fKg * 3600 / O.fu.dens; lamCrD = lamD;
      } else {
        const eta0 = ottoEta(cfg.cr, O.fu.gamma) * K_QUAL * tm.etaK * (1 + (TS_HEAD.burn - 1) * 0.55) * (1 - 0.0011 * (g.b - 86));
        const imepRef = Math.max(0.05, tbC.ce) * air.rho * O.fu.lhv / O.fu.afr * etaComb(1.0) * eta0;
        let imepT = bmepCr + fmT * 1e5, etaT = 0.22, load = 0.5;
        for (let it = 0; it < 4; it++) {
          load = clamp(imepT / Math.max(1e4, imepRef), 0.04, 1);
          const resid = clamp(0.12 + 0.45 * (1 - load), 0.10, 0.60);
          etaT = clamp(eta0 * TS_CRUISE * (1 - 1.1 * Math.max(0, resid - 0.18)) * etaComb(lamCr), 0.08, 0.40);
          imepT = bmepCr + fmT * 1e5 + 0.10 * air.p * (1 - load);   // the crankcase throttles more gently than a four-stroke's manifold
        }
        const teCr = clamp(tm.te0 * (1.12 - 0.15 * tbC.dr * load), 0.3, 0.97);
        lphTs = imepT * g.Vd * (nCr / 120) / etaT / O.fu.lhv * (1 + tm.sc * (1 / teCr - 1)) * 3600 / fuelDens * 1000;
      }
    }
    const econ = ts ? Math.round(clamp(lphTs * (alsO ? 1 + alsO.fuel : 1), 2, 60) * 10) / 10 : rot ? Math.round(clamp(lphRot * (alsO ? 1 + alsO.fuel : 1), 2, 60) * 10) / 10 : dsl ? Math.round(clamp(lphD, 2, 60) * 10) / 10 : gasF ? Math.round(clamp(fuelPow * 3600 / (43.4e6 * 0.745), 2, 60) * 10) / 10   // gas: petrol-equivalent litres by energy
      : Math.round(clamp(litresPerHour / 100 * 100 * (alsO ? 1 + alsO.fuel : 1), 2, 60) * 10) / 10;  // anti-lag burns fuel on every lift  // L/100 km at 100 km/h

    let smooth = L.smooth * (1 - 0.10 * L.secondOrder * (g.s / 86))
      - 0.18 * cfg.cam + 9 * O.dmp.damping + (cfg.oilSystem === "dry" || cfg.oilSystem === "dry_hv" ? 2 : 0)
      - (cfg.intake === "itb" ? 3 : 0) + 5;
    if (rot) smooth = L.smooth - 18 * O.port.overlap + (cfg.oilSystem === "dry" ? 2 : 0) - (cfg.intake === "itb" ? 2 : 0) + 4;
    if (ts) smooth = L.smooth + 6 - (tm.chamber ? 14 * tm.amp : 0) + 9 * O.dmp.damping - (cfg.induct === "piston" ? 3 : 0) + (tm.blower ? 2 : 0);   // a power stroke every turn evens the torque out
    const misCr = MAP && !dsl ? Math.max(0, lamCr - mapMisLam(O.hd.burn)) : 0;   // a map leaned past the misfire limit at cruise
    if (misCr > 0) smooth -= 160 * misCr;
    smooth = Math.round(clamp(smooth, 5, 99));

    /* --- notes --------------------------------------------------------- */
    const notes = [];
    if (maxRetard > 0.5) notes.push("ECU is pulling " + maxRetard.toFixed(1) + "° of timing to stay off the knock limit — that is " + ((1 - 1 / (1 + 0.0018 * sq(maxRetard))) * 100).toFixed(1) + "% of indicated work thrown away.");
    if (boosted && compUtil > 0.95) notes.push("The compressor is past its choke line; more boost pressure here just makes hot air.");
    if (!rot && !boosted && vm.rpmCam > redline * 0.95) notes.push("The cam is timed for more rpm than the redline allows — you are paying for duration you never use.");
    if (!rot && inRes) notes.push("A " + majorOrder + "th-order torsional resonance sits at " + resRpm.toFixed(0) + " rpm, inside the rev range.");
    if (!rot && hotMm < 0.030) notes.push("Running clearance is only " + (hotMm * 1000).toFixed(0) + " µm — a cold-start full-throttle pull will scuff it.");
    if (misCr > 0) notes.push("The map's cruise cell asks for \u03bb " + lamCr.toFixed(2) + " at " + Math.round(nCr) + " rpm and " + Math.round(loadCr * 100) + "% load: past about \u03bb " + mapMisLam(O.hd.burn).toFixed(2) + " the charge stops lighting every time. It misfires, surges and runs the exhaust hot.");
    if (dsl && leanTop) notes.push("The injection system runs out at " + leanRpm + " rpm: \u03bb " + lamTop.toFixed(2) + " instead of " + lamAt(leanRpm).toFixed(2) + ". A diesel just makes less power there \u2014 it runs cooler, not hotter.");
    if (dsl && smokePk > 0.35) notes.push("Peak smoke is about " + Math.round(smokePk * 100) + "% opacity: there is more fuel going in than air to burn it" + (lamMin < cfg.lambda - 0.05 ? ", worst while the turbo is still spooling (\u03bb " + lamMin.toFixed(2) + ")" : "") + ".");
    if (!dsl && leanTop) notes.push("The fuel system runs out at " + leanRpm + " rpm: the cylinders get \u03bb " + lamTop.toFixed(2) + " instead of " + lamAt(leanRpm).toFixed(2) + ", and the extra heat goes into the exhaust and the pistons.");
    if (gasF) notes.push(O.fu.name.split(" (")[0] + " arrives as vapour: it fills about " + (O.fu.displace * 100).toFixed(1) + "% of the cylinder" + (gs.veK < 1 ? ", the mixer's venturi takes " + Math.round((1 - gs.veK) * 100) + "% more of the airflow" : "") + ", and there is no evaporative cooling. Economy is quoted in petrol-equivalent litres.");
    if (env.altitudeM > 1500) notes.push("At " + env.altitudeM + " m the air is " + ((1 - air.rho / 1.2) * 100).toFixed(0) + "% thinner than sea level; correctedHp is the SAE-normalised figure.");

    /* nitrous: what the kit does on a pass that a pull does not show — the chance of a lean spike when the shot
       hits (dry kits), and of a backfire through a fuel-laden intake (plates; long runners hold the most mixture) */
    let n2oInfo = null;
    if (n2oOn) {
      const plate = !!O.n2o.plate, leanX = Math.max(0, lamTop - lamAt(leanRpm));
      const runner = cfg.intake === "plenum_long" ? 2.6 : cfg.intake === "carb" ? 1.4 : cfg.intake === "plenum_short" ? 0.8 : cfg.intake === "itb" ? 0.6 : 1;
      const bf = plate ? clamp(0.012 * (O.n2o.stages || 1) * runner * (0.5 + n2oBite) * (boosted ? 1.5 : 1) * (1 + 0.25 * Math.max(0, cfg.timing - 2)) + 0.6 * leanX * runner, 0, 0.5)
        : n2oKind === "direct" ? clamp(0.002 * (0.5 + n2oBite) + 0.1 * leanX, 0, 0.2) : 0;
      const hotU = Math.max(crownC / O.pis.maxCrownC, dsl ? 0 : hotSpotC / hotSpotLimit);
      n2oInfo = { kind: n2oKind || "wet", shotHp: n2oHp, stages: O.n2o.stages || 1, stageHp: n2oSt, plate: plate, prog: !!O.n2o.prog,
        winRpm: Math.round(n2oWin), win2Rpm: n2oSt ? Math.round(n2oWin2) : null, bite: n2oBite, dry: n2oDry, diesel: n2oDsl,
        lean: n2oDry ? +n2oLeanPk.toFixed(3) : 0, backfire: +bf.toFixed(3),
        leanRisk: n2oDry ? +clamp(1.5 * n2oLeanPk + 1.5 * Math.max(0, hotU - 0.92) + 0.8 * Math.max(0, injUtil - 0.85) + 0.01, 0, 0.7).toFixed(3) : 0 };
      if (n2oDry && n2oLeanPk > 0.01) notes.push("When the " + n2oHp + " shot comes in, the fuel system cannot add its fuel: \u03bb goes to " + (cfg.lambda + n2oLeanPk).toFixed(2) + " on the bottle. A lean nitrous mixture is how pistons melt.");
      if (n2oDsl) notes.push("The diesel kit adds oxygen only; the injection pump has to find the fuel" + (qUtilPk > 1 ? ", and it is already on its stop \u2014 part of the shot goes unused." : "."));
    }

    if (rot) {
      notes.push("The dyno reads the eccentric shaft: at " + redline + " rpm the rotors themselves turn " + RT.rotorRpm + " rpm, and each rotor fires once per shaft turn \u2014 " + Math.round(RT.firingHz) + " combustions a second.");
      if (O.port.overlap >= 0.4) notes.push("With this much port overlap it needs about " + O.port.idle + " rpm to idle, and at low load exhaust backs up into the intake and the next charge misfires \u2014 the brap.");
      if (!boosted && rv.rpmC > redline * 1.02) notes.push("The ports are timed for more rpm than the redline allows \u2014 a rotary with these ports wants to rev.");
      if (RT.oilUtil > 0.8) notes.push("The " + O.omp.name.toLowerCase() + " is only just keeping the apex seals wet at this boost and rpm.");
    }

    if (ts) {
      notes.push("Two-stroke: every cylinder fires every turn \u2014 " + Math.round(TSI.firingHz).toLocaleString("en-US") + " power strokes a second at " + redline + " rpm" + (L.opposed ? ", two pistons meeting in every cylinder" : "") + ". It sweeps " + (g.VdNom * 1000).toFixed(g.VdNom < 0.001 ? 3 : 2) + " L and breathes like a " + (g.Vd * 1000).toFixed(g.Vd < 0.002 ? 2 : 1) + " L four-stroke.");
      if (tm.chamber && tm.amp > 0.2) notes.push("Comes on the pipe at about " + TSI.onPipe.toLocaleString("en-US") + " rpm. The chamber is cut for " + TSI.pipeRpm.toLocaleString("en-US") + " rpm; with " + Math.round(TSI.pipeT) + " \u00b0C in it the wave arrives at " + TSI.pipeTune.toLocaleString("en-US") + " rpm (richer runs it cooler and lower, leaner hotter and higher). Usable band " + TSI.band[0].toLocaleString("en-US") + "\u2013" + TSI.band[1].toLocaleString("en-US") + " rpm.");
      if (!dsl && tm.sc > 0.5) notes.push("About " + TSI.scFuelPct + "% of the fuel at peak power leaves with the " + TSI.scChargePct + "% of the charge that short-circuits out of the exhaust \u2014 the blue haze and the thirst.");
      if (tsCaseB && cfg.lube !== "inject") notes.push("Premix at " + Math.round(tsLubR) + ":1 burns about " + TSI.oilLph.toFixed(2) + " L of oil an hour flat out.");
      if (tm.blower) notes.push("The scavenge blower holds about " + tsBoxPk.toFixed(2) + " bar in the air box at redline, and the crank pays to drive it.");
      if (!dsl && tm.rpmP > redline * 1.10) notes.push("The ports are timed for about " + Math.round(tm.rpmP / 100) * 100 + " rpm, past the redline: duration it never gets to use.");
    }
    const correctedHp = peakHp * j1349(air.pd, env.ambientC);
    const exNoise = exhaustNoise(cfg);
    // the stock system's own loss at the same flow (what the manifold's backP already carries)
    const exhStockDp = (m) => { const a = exhRefFlow(cfg, g) / (EXH_RHO * EXH_V0), rho = EXH_RHO * air.p / 101325, x = (EXH_KPIPE + OPT.muffler.stock.K) * m * m / (2 * rho * a * a); return x / (1 + x / EXH_SAT); };

    const out = {
      rpms: rpms, torque: torque, power: power, boostCurve: boostCurve,
      veCurve: veCurve, egtCurve: egtCurve, bmep: bmepArr,
      peakHp: peakHp, peakHpRpm: peakHpRpm, peakTq: peakTq, peakTqRpm: peakTqRpm,
      correctedHp: correctedHp,
      Vd: (rot || ts ? g.VdNom : g.Vd) * 1e6, n: L.n, kg: kg, cost: cost, econ: econ, smooth: smooth,
      thermals: { crownC: crownC, egtPeakC: maxEgt, coolantLoadKw: Qkw, chargeC: chargeCOut, oilC: oilCOut, coolCap: O.cool.cap },
      clearances: { coldMm: coldMm, hotMm: hotMm, ringGapMm: ringGapMm, ringGapNeededMm: ringGapNeededMm, valvePistonMm: valvePistonMm },
      loads: {
        pmaxMPa: maxPmax / 10, rodTensionKn: Frec / 1000, rodCompKn: Fcomp / 1000,
        bearingMPa: bearMPa, filmUm: filmUm, boltStretchPct: boltStretchPct,
        pistonSpeedMs: mpsRed, pistonAccelG: aTdc / 9.81,
        torsionalMarginPct: 100 * (1 - torUtil), wallThicknessMm: wallThicknessMm
      },
      knock: dsl ? { onRequired: null, margin: 99, retardDeg: 0, cetane: cetane } : { onRequired: knockOnReq, margin: knockMargin, retardDeg: maxRetard },
      diesel: dsl, smoke: Math.round(smokePk * 1000) / 10, smokeCurve: smokeCurve, clatter: clatter, lamCurve: lamCurve,
      knockCurve: mgnCurve, retardCurve: rtdCurve, mapCruise: MAP ? { rpm: nCr, load: dsl ? 0 : loadCr, lam: dsl ? lamCrD : lamCr, ign: dsl ? 0 : ignCr, misfire: misCr } : null,
      fuel: { duty: dutyPk, dutyRpm: dutyRpm, ccCyl: ccCylPk, load: pumpPk, loadRpm: pumpRpm, capLph: pumpCapPk, needLph: pumpNeedPk,
        injUtil: injUtil, pumpUtil: pumpUtil, lamTop: lamTop, leanRpm: leanRpm, portInj: portInj, lph: fuelLph,
        qDem: qDemPk, qCap: qCapPk, qRpm: qRpm, lamMin: dsl ? lamMin : lamTop, lamCruise: lamCrD, cruiseLph: ts ? lphTs : dsl ? lphD : rot ? lphRot : litresPerHour },
      nitrous: n2oInfo,
      /* MORE FUELS: gas system load and native consumption (L of propane or kg of CNG per 100 km), flex winter blend */
      alt: gasF ? { gas: true, sys: cfg.gasSys && OPT.gasSys[cfg.gasSys] ? cfg.gasSys : "mixer", displacePct: Math.round((1 - gasVeK) * 1000) / 10, unit: O.fu.unit || "L",
          econNative: Math.round(clamp(fuelKgS * 3600 / O.fu.dens, 0.5, 80) * 10) / 10, kgh: pumpNeedPk * fuelRho, capKgh: pumpCapPk * fuelRho, coldBar: lpgBar || null }
        : O.fu.flex ? { flex: true, ePct: O.fu.ePct, winter: flexW } : null,
      noiseDb: exNoise.db, noiseDbOpen: exNoise.dbOpen,
      exhaustSys: { flowKgS: exFlowPk, dpBar: (exS ? exDpPk : exhStockDp(exFlowPk)) / 1e5,
        stockDpBar: exhStockDp(exFlowPk) / 1e5, deltaBar: exDeltaPk / 1e5, mRef: exhRefFlow(cfg, g), open: !!(exS && exS.open) },
      tests: tests, fails: fails, rel: Math.round(rel * 10) / 10,
      lifeHours: Math.round(lifeHours), firstToFail: firstToFail,
      racePasses: racePasses, raceSpec: raceSpec,
      endurance: endurance, overrev: overrev, notes: notes
    };
    if (rot) {
      out.rotary = RT; out.VdEq = g.Vd * 1e6;
      out.loads.bearingMPa = RT.brgMPa; out.loads.filmUm = RT.filmUm;
      out.thermals.housingC = RT.housingC;
    }
    if (ts) { out.twoStroke = TSI; out.VdEq = g.Vd * 1e6; }
    return out;
  }

