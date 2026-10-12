  /* =====================================================================
     Tune map tools (the dyno's map editor). A map lives on cfg.map:
       { rpm:[8-12 breakpoints], load:[% of full-load manifold pressure], ign:[[...]], lam:[[...]], boost:[...] }
     ign / lam are rows by load, columns by rpm. simulate() reads the 100% row for the WOT sweep and the
     cruise cell for economy; mapGrid() probes every row so the editor can colour the cells.
     ===================================================================== */
  const MAP_LOADS = [20, 30, 40, 50, 60, 70, 85, 100];
  function mapAxis(cfg) {
    const red = Math.floor(clamp(cfg.redline, isDiesel(cfg) ? (isTwoStroke(cfg) ? 1200 : 1800) : 4000, 12500) / 100) * 100;
    const n = clamp(Math.round((red - 1000) / 700) + 1, 8, 12);
    const out = [];
    for (let i = 0; i < n; i++) { const v = Math.round((1000 + (red - 1000) * i / (n - 1)) / 100) * 100; if (!out.length || v > out[out.length - 1]) out.push(v); }
    return out;
  }
  const mR1 = v => Math.round(v * 10) / 10, mR2 = v => Math.round(v * 100) / 100;
  /* the map that runs exactly like today's sliders: WOT row = the sliders; petrol part load = what the stock
     ECU does there anyway (closed-loop lambda, MBT timing); a diesel's sliders apply everywhere */
  function mapFromSliders(cfg) {
    cfg = Object.assign({}, DEFAULT_CFG, cfg || {});
    const dsl = isDiesel(cfg), rpm = mapAxis(cfg), load = MAP_LOADS.slice();
    const lamCr = clamp(cfg.lambda + 0.07, 0.92, 1.05);
    const ign = load.map(l => rpm.map(() => dsl || l >= 100 ? cfg.timing : 0));
    const lam = load.map(l => rpm.map(() => dsl || l >= 100 ? cfg.lambda : mR2(lamCr)));
    const m = { rpm: rpm, load: load, ign: ign, lam: lam };
    if (cfg.asp !== "na") m.boost = rpm.map(() => cfg.boost);
    return m;
  }
  /* re-space a map onto a new rpm axis (redline changed) by interpolating its own cells */
  function mapRespace(m, rpm) {
    const col = arr => rpm.map(r => mR2(mapRow(m, arr, r)));
    const o = { rpm: rpm.slice(), load: m.load.slice(), ign: m.ign.map(row => col(row).map(mR1)), lam: m.lam.map(col) };
    if (Array.isArray(m.boost)) o.boost = col(m.boost);
    return o;
  }
  /* one row of the map as the dyno would see it: a sweep at that row's load */
  function mapRowEval(cfg, env, j) {
    const m = cfg.map, dsl = isDiesel(cfg);
    const r = simulate(cfg, Object.assign({}, env || DEFAULT_ENV, { testType: "pull", mapLoad: m.load[j] / 100 }));
    return m.rpm.map((rpm, i) => {
      const k = clamp(Math.round((rpm - 1000) / 100), 0, r.rpms.length - 1);
      return { rpm: rpm, load: m.load[j], ign: m.ign[j][i], cmd: m.lam[j][i], tq: r.torque[k], hp: r.power[k], egt: r.egtCurve[k], lam: r.lamCurve[k],
        margin: dsl ? null : r.knockCurve[k], retard: dsl ? 0 : r.retardCurve[k], smoke: dsl ? r.smokeCurve[k] : 0, boost: r.boostCurve[k] };
    });
  }
  function mapGrid(cfg, env) {
    cfg = Object.assign({}, DEFAULT_CFG, cfg || {});
    if (!mapOk(cfg.map)) return null;
    return cfg.map.load.map((l, j) => mapRowEval(cfg, env, j));
  }
  function mapCell(cfg, env, ri, li) {
    cfg = Object.assign({}, DEFAULT_CFG, cfg || {});
    if (!mapOk(cfg.map)) return null;
    return mapRowEval(cfg, env, li)[ri];
  }
  /* Auto-tune for safety: for every column of the WOT row search timing x lambda for the most torque that keeps
     the knock margin, EGT and (diesel) smoke inside the targets; part-load rows get their timing the same way.
     opt: { margin: ON of knock margin to keep, ignStep, lamStep, egtMax, smokeMax }. Then a full pull checks that
     no test fails that did not fail before, and backs the whole WOT row off until none does. */
  function mapAutoTune(cfg, env, opt) {
    cfg = Object.assign({}, DEFAULT_CFG, cfg || {});
    env = Object.assign({}, DEFAULT_ENV, env || {}, { testType: "pull" });
    opt = Object.assign({ margin: 1.0, ignStep: 1, lamStep: 0.02, smokeMax: 0.15 }, opt || {});
    const dsl = isDiesel(cfg), boosted = cfg.asp !== "na";
    const tm = OPT.turbineMat[cfg.turbineMat];
    const egtMax = opt.egtMax || (dsl ? 720 : Math.min(950, boosted && tm && tm.maxEgtC ? tm.maxEgtC - 40 : 950));
    const m = JSON.parse(JSON.stringify(mapOk(cfg.map) ? cfg.map : mapFromSliders(cfg)));
    const nR = m.rpm.length, top = m.load.length - 1;
    const steps = (a, b, st) => { const o = []; for (let v = a; v <= b + 1e-9; v += st) o.push(Math.round(v * 100) / 100); return o; };
    const ignC = steps(dsl ? -8 : -12, dsl ? 6 : 8, 2);
    const lamC = dsl ? steps(1.15, 2.4, Math.max(0.05, opt.lamStep * 2.5)) : steps(cfg.fuel === "methanol" ? 0.70 : 0.76, 0.98, Math.max(0.02, opt.lamStep));
    let sims = 0;
    const run = (j, ignRow, lamRow) => { const t = JSON.parse(JSON.stringify(m)); t.ign[j] = ignRow; if (lamRow) t.lam[j] = lamRow; sims++; return mapRowEval(Object.assign({}, cfg, { map: t }), env, j); };
    const viol = c => Math.max(0, opt.margin - (dsl ? 99 : c.margin)) * 40 + Math.max(0, c.egt - egtMax) + Math.max(0, c.smoke - opt.smokeMax) * 400;
    // feasible beats infeasible; then torque; a near tie (0.05%) goes to the smaller change from the cell as it was
    const moved = (c, j, i) => Math.abs(c.cmd - m.lam[j][i]) * (dsl ? 2 : 10) + Math.abs(c.ign - m.ign[j][i]) * 0.1;
    const better = (c, b, j, i) => { if (!b) return true; const vc = viol(c), vb = viol(b); if (vc > 0 || vb > 0) return vc < vb - 1e-9 || (vc <= vb + 1e-9 && c.tq > b.tq);
      return c.tq > b.tq * 1.0005 || (c.tq > b.tq * 0.9995 && moved(c, j, i) < moved(b, j, i)); };
    const fill = v => Array(nR).fill(v);
    const snap = v => Math.floor(v / opt.ignStep + 1e-6) * opt.ignStep;
    for (let j = top; j >= 0; j--) {
      const wot = j === top;
      if (!wot && dsl) continue;                              // a diesel's part load has no knock to trade against
      // 1. best timing per column as the dyno sees it (MBT, or where the knock control starts taking it away),
      //    swept at the cell's own lambda, then refined
      const mbt = fill(ignC[0]), mbtTq = fill(-1);
      const take = (row, ig) => row.forEach((c, i) => { if (c.tq > mbtTq[i] * 1.0001) { mbtTq[i] = c.tq; mbt[i] = ig[i]; } });
      for (const iv of ignC) take(run(j, fill(iv), null), fill(iv));
      for (const d of [-1, 1, -0.5, 0.5]) { if (Math.abs(d) < opt.ignStep - 1e-9) continue; const ig = mbt.map(v => v + d); take(run(j, ig, null), ig); }
      // 2. for each lambda: measure the knock line (margin falls linearly with advance) and take the lesser of
      //    MBT and the timing that keeps the target margin; check it on the dyno and step back where it missed
      const best = fill(null);
      for (const lv of wot ? lamC : [null]) {
        const lr = lv == null ? null : fill(lv);
        let ig = mbt.slice();
        if (!dsl) {
          const A = run(j, fill(0), lr), B = run(j, fill(-6), lr);
          ig = A.map((c, i) => { const slope = Math.max(0.2, (B[i].margin - c.margin) / 6); return clamp(snap(Math.min(mbt[i], (c.margin - opt.margin) / slope)), -16, 12); });
        }
        let row = run(j, ig, lr);
        for (let k = 0; k < 3 && !dsl; k++) {
          const miss = row.map(c => c.margin < opt.margin - 1e-6);
          if (!miss.some(x => x)) break;
          ig = ig.map((v, i) => miss[i] ? Math.max(-16, v - opt.ignStep) : v); row = run(j, ig, lr);
        }
        row.forEach((c, i) => { const k = Object.assign({}, c, { ign: ig[i], cmd: lv == null ? m.lam[j][i] : lv }); if (better(k, best[i], j, i)) best[i] = k; });
      }
      m.ign[j] = best.map(c => mR1(c.ign));
      if (wot) m.lam[j] = best.map(c => mR2(c.cmd));
    }
    // a whole pull: anything the tune newly breaks gets the WOT row backed off
    const before = simulate(cfg, env), failsBefore = before.fails.slice();
    let after = simulate(Object.assign({}, cfg, { map: m }), env), backed = 0;
    while (after.fails.some(f => failsBefore.indexOf(f) < 0) && backed < 8) {
      m.ign[top] = m.ign[top].map(v => mR1(v - 1)); if (!dsl) m.lam[top] = m.lam[top].map(v => mR2(Math.max(0.70, v - 0.02))); else m.lam[top] = m.lam[top].map(v => mR2(v + 0.05));
      after = simulate(Object.assign({}, cfg, { map: m }), env); backed++;
    }
    return { map: m, before: before, after: after, sims: sims, backedOff: backed, egtMax: egtMax };
  }

  return {
    LAYOUTS: LAYOUTS, OPT: OPT, FORM: FORM,
    mapFromSliders: mapFromSliders, mapGrid: mapGrid, mapCell: mapCell, mapAutoTune: mapAutoTune, mapRespace: mapRespace, mapAxis: mapAxis, mapOk: mapOk, mapLook: mapLook, MAP_LOADS: MAP_LOADS,
    DEFAULT_CFG: DEFAULT_CFG, DEFAULT_ENV: DEFAULT_ENV, PRESETS: PRESETS, dragRun: dragRun, dragPass: dragPass, dragDriver: dragDriver, DRAG_TICK: DRAG_TICK, TYRES: TYRES, AERO: AERO, DRIVETRAIN: DRIVETRAIN, drivetrain: drivetrain, dtCapOf: dtCapOf, dtPart: dtPart,
    dragPrep: dragPrep, launchTech: launchTech, TURBO_MM: TURBO_MM, MANIFOLD_HEAT: MANIFOLD_HEAT,
    fitFuel: fitFuel,
    isGas: isGas, fuelOf: fuelOf, flexBlend: flexBlend, flexWinterPct: flexWinterPct, propaneBar: propaneBar,
    isDiesel: isDiesel,
    isRotary: isRotary, isTwoStroke: isTwoStroke,
    n2oBottle: n2oBottle,
    pullRun: pullRun, pullPass: pullPass, pullDriver: pullDriver, pullGears: pullGears, PULL_CLASSES: PULL_CLASSES, PULL_TYRES: PULL_TYRES, PULL_FULL: PULL_FULL,
    pullTrackK: pullTrackK, pullTrackName: pullTrackName, pullRunaway: pullRunaway,
    bogPrep: bogPrep, bogRun: bogRun, bogPass: bogPass, bogNight: bogNight, bogDepth: bogDepth, bogGears: bogGears, bogAiRes: bogAiRes, bogMudName: bogMudName, BOG_CLASSES: BOG_CLASSES, BOG_TYRES: BOG_TYRES,
    boatPrep: boatPrep, boatRun: boatRun, boatPass: boatPass, boatTune: boatTune, boatGuess: boatGuess, boatWater: boatWater, boatTrimRange: boatTrimRange, BOAT_CLASSES: BOAT_CLASSES, BOAT_HULLS: BOAT_HULLS, BOAT_IMP: BOAT_IMP, BOAT_FT: BOAT_FT,
    roadRun: roadRun, lapSim: lapSim, roadTest: roadTest, roadPrep: roadPrep, roadTrack: roadTrack, roadCar: roadCar, setupVis: setupVis, setupNorm: setupNorm, CHASSIS: CHASSIS, ROAD_TYRES: ROAD_TYRES, ROAD_TRACKS: ROAD_TRACKS,
    enduroPrep: enduroPrep, e24AiPrep: e24Ai, enduroNew: enduroNew, enduroStep: enduroStep, enduroWhere: enduroWhere, enduroResult: enduroResult, enduroClasses: enduroClasses, enduroClassOf: enduroClassOf,
    e24Rates: e24Rates, e24Sky: e24Sky, e24Amb: e24Amb, e24Hour: e24Hour, e24Pos: e24Pos, e24Order: e24Order, e24Need: e24Need, e24Clock: e24Clock, e24Lap: e24Lap,
    E24_MODES: E24_MODES, E24_TYRES: E24_TYRES, E24_CLASSES: E24_CLASSES, E24_CLS_ORDER: E24_CLS_ORDER, E24_FIX: E24_FIX, E24_K: E24_K, E24_TANK: E24_TANK, E24_DUR: E24_DUR,
    lsrRun: lsrRun, lsrChuteMax: lsrChuteMax, lsrPass: lsrPass, lsrPrep: lsrPrep, lsrGearing: lsrGearing, lsrClass: lsrClass, lsrRecord: lsrRecord, LSR_BODIES: LSR_BODIES, LSR_COURSES: LSR_COURSES, LSR_CHUTES: LSR_CHUTES, LSR_DISP: LSR_DISP, LSR_MILE: LSR_MILE, SALT_ENV: SALT_ENV,
    VEHICLES: VEHICLES, VEH_GROUPS: VEH_GROUPS, SWAP_FIX: SWAP_FIX, engineDims: engineDims, swapFit: swapFit, swapFixSet: swapFixSet, swapDragVeh: swapDragVeh, swapLsrBody: swapLsrBody,
    hillCourse: hillCourse, hillPrep: hillPrep, hillCar: hillCar, hillNew: hillNew, hillPass: hillPass, hillCalls: hillCalls, hillPlan: hillPlan, hillAiPrep: hillAiPrep, hillZ: hillZ,
    HILL_CLASSES: HILL_CLASSES, HILL_TYRES: HILL_TYRES, HILL_AERO: HILL_AERO, HILL_SECTIONS: HILL_SECTIONS, HILL_ALTS: HILL_ALTS, HILL_TREE: HILL_TREE, HILL_ALT0: HILL_ALT0, HILL_ALT1: HILL_ALT1,
    simulate: simulate, combos: combos, cfgLabel: cfgLabel,
    exhaustNoise: exhaustNoise, exhaustInfo: exhaustInfo, exhSysOf: exhSysOf, exhParts: exhParts
  };
})();

if (typeof module !== "undefined") module.exports = ENGINE_SIM;
if (typeof window !== "undefined") window.ENGINE_SIM = ENGINE_SIM;

</script>
