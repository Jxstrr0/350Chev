  /* =====================================================================
     MUD BOG: the engine in a truck, a run-up on firm dirt, then a pit of mud 60–90 m long.
     Stuck in the pit scores the distance; through it scores the time from the near edge to the far one.
     Mud: depth varies along the pit, consistency per night (0 soupy … 1 sticky clay), hidden ruts and hard ridges.
     The tyre: bite against slip like the sled's dirt, plus a paddle's push from wheel speed over ground speed;
     slow wheels pack their lugs with mud (bite goes), fast ones throw it out (clean), too much spin digs a hole.
     Drag: rolling resistance grows with how far the tyres are under, a bow wave of mud, and the belly once it
     touches. The engine bogs below a band (torque falls away), a clutch truck can stall, and the radiator packs up.
     ===================================================================== */
  /* the run itself is in sim/bog-run.js, which goes into sim-late.js (since 1.76.139.0) */
  const BOG_TYRES = {
    mt: { n: "Mud-terrain", d: "street lugs · bite, then pack up", mu: 0.56, sp: 0.16, fall: 0.40, clean: 0.15, dig: 1.0, paddle: 0.15 },
    swamp: { n: "Swampers", d: "tall bias-ply · deep lugs", mu: 0.62, sp: 0.24, fall: 0.32, clean: 0.45, dig: 0.8, paddle: 0.45 },
    paddle: { n: "Paddle tyres", d: "cupped paddles · need wheel speed", mu: 0.46, sp: 0.42, fall: 0.15, clean: 0.85, dig: 0.6, paddle: 1 }
  };
  const BOG_CLASSES = {
    street: { n: "Street 4×4", d: "plated pickup · mud-terrains · part-time 4×4", tier: 1, rep: 0,
      veh: { mass: 2500, tyreDia: 35, width: 1.9, clear: 0.30, front: 0.55, drive: 0.85, driveN: "part-time 4×4", trans: "conv", tyres: ["mt"], runup: 30, pitK: 1 },
      gears: [["1st", 24], ["2nd", 36], ["3rd", 50]], field: { hp: 290, sd: 60, dsl: 0.4 } },
    modified: { n: "Modified", d: "lifted · swampers · lockers both ends", tier: 2, rep: 40,
      veh: { mass: 2150, tyreDia: 44, width: 2.1, clear: 0.45, front: 0.52, drive: 1.0, driveN: "locked 4×4", trans: "conv", tyres: ["mt", "swamp"], runup: 35, pitK: 1.4 },
      gears: [["1st", 28], ["2nd", 42], ["3rd", 58]], field: { hp: 480, sd: 90, dsl: 0.3 } },
    super: { n: "Open · Super", d: "tube chassis · paddles · spooled, clutch", tier: 3, rep: 150,
      veh: { mass: 1650, tyreDia: 54, width: 2.4, clear: 0.62, front: 0.48, drive: 1.0, driveN: "spooled 4×4", trans: "clutch", tyres: ["swamp", "paddle"], runup: 40, pitK: 1.75 },
      gears: [["2nd", 40], ["3rd", 56], ["4th", 74]], field: { hp: 850, sd: 150, dsl: 0.15 } }
  };
  for (const k in BOG_CLASSES) BOG_CLASSES[k].id = k;
  function bogGears(cls) { return (BOG_CLASSES[cls] || BOG_CLASSES.street).gears; }
  function bogMudName(c) { return c < 0.22 ? "soupy" : c < 0.45 ? "sloppy" : c < 0.7 ? "peanut butter" : "sticky clay"; }
  /* the night's pit: length, mud, a depth profile every half metre, hidden ruts and hard ridges. Same seed, same pit. */
  function bogNight(seed) {
    const r = pullRng(((seed >>> 0) ^ 0x6B0C1D) >>> 0);
    const len = 60 + Math.floor(r() * 31), cons = +(0.05 + r() * 0.9).toFixed(2), d0 = 0.42 + r() * 0.26;
    const l1 = 9 + r() * 9, l2 = 3 + r() * 3, p1 = r() * 6.28, p2 = r() * 6.28, n = Math.ceil(len * 2) + 1, depth = new Array(n);
    for (let i = 0; i < n; i++) { const x = i / 2;
      let d = d0 * (0.82 + 0.22 * Math.sin(2 * Math.PI * x / l1 + p1) + 0.1 * Math.sin(2 * Math.PI * x / l2 + p2)) * (0.86 + 0.28 * Math.sin(Math.PI * x / len));
      d *= clamp(x / 5, 0.25, 1) * clamp((len - x) / 6, 0.35, 1); depth[i] = +d.toFixed(3); }
    const hz = [], nh = 3 + Math.floor(r() * 3);
    for (let i = 0; i < nh; i++) { const kind = r() < 0.55 ? "rut" : "bump", x = 10 + r() * (len - 20);
      if (hz.some(h => Math.abs(h.x - x) < 5)) continue;
      hz.push({ x: +x.toFixed(1), kind, h: +(kind === "rut" ? 0.2 + r() * 0.2 : 0.14 + r() * 0.18).toFixed(2), w: +(kind === "rut" ? 1.6 + r() * 1.2 : 0.8 + r() * 0.6).toFixed(1) }); }
    hz.sort((a, b) => a.x - b.x);
    return { seed: seed >>> 0, len, cons, name: bogMudName(cons), d0: +d0.toFixed(2), depth, hz };
  }
  function bogDepth(N, x) { if (x < 0 || x > N.len) return 0; const f = x * 2, i = Math.floor(f), a = N.depth[i] || 0, b = N.depth[Math.min(N.depth.length - 1, i + 1)] || 0; return a + (b - a) * (f - i); }

