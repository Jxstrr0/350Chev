
  /* =====================================================================
     Hillclimbs. Cloudsplitter Peak: 19.99 km, 156 turns, 2,862 m at the line to 4,302 m on the summit. Since the team
     hill climb series, four shorter and lower made-up hills built from the same kit (HILL_HILLS: Badlands Grade,
     Kettle Butte, Ghost Ridge, Thunder Pass). Every call takes a hill id and defaults to Cloudsplitter Peak, so the Cloudsplitter
     event is the same as before. A course is a fixed sequence of straights and constant-radius corners, laid out
     section by section (the corner count, length and climb of each are set; radii, angles and straights come
     from the hill's fixed seed), with an elevation profile per section. The engine is run through
     simulate() at five altitudes on the way up: a naturally aspirated engine loses power with the
     air density, a supercharger keeps its pressure ratio (so it loses some), a turbo holds the
     manifold pressure it makes at the shop until the compressor runs out of pressure ratio or flow,
     and a carburettor runs richer as the air thins while injection trims itself. The car is the
     road test's chassis on the class's tyres and aero; it is driven by a time-stepped point mass
     (grade, drag and downforce at the local air density, braking envelope ahead, gear, shift and
     boost carried) with a coolant temperature that has less air to shed its heat into.
     Driving is commitment: every corner has a known surface call (dusty, clean or grippy) and a
     little hidden variance. Arrive faster than the corner holds and it costs a moment, a trip
     through the gravel, or — over a drop with no guardrail — the run.
     This file keeps only the tables the setup screen reads; the run itself is in sim/hill-run.js,
     which goes into sim-late.js (since 1.76.138.0).
     ===================================================================== */
  const HILL_ALT0 = 2862, HILL_ALT1 = 4302, HILL_TREE = 3560, HILL_DS = 2.5, HILL_SEED = 1916;
  /* sections in order: length (km), altitude at the end (m), corners, the corner mix, the bearing the road climbs on
     (radians, 0 = east, π/2 = north), the share of corners with a drop on the outside, and named corners [index, name] */
  const HILL_SECTIONS = [
    { id: "start", n: "Engineer's", km: 1.6, alt: 2960, cor: 12, mix: "forest", bear: 2.9, drop: 0.12, names: [[6, "Engineer's Corner", 22]] },
    { id: "picnic", n: "Picnic Grounds", km: 2.9, alt: 3135, cor: 22, mix: "forest", bear: 2.3, drop: 0.1, names: [[10, "Picnic Grounds"], [19, "Halfway"]] },
    { id: "glen", n: "Glen Cove", km: 3.9, alt: 3480, cor: 30, mix: "mixed", bear: 1.7, drop: 0.22, names: [[9, "Brown Bush"], [18, "Elk Park"], [29, "Glen Cove", 17]] },
    { id: "ws", n: "The W's", km: 3.1, alt: 3740, cor: 26, mix: "hairpins", bear: 1.25, drop: 0.55, names: [[0, "Ragged Edge"], [6, "The W's"], [24, "Cove Creek"]] },
    { id: "devil", n: "Devil's Playground", km: 2.6, alt: 3965, cor: 16, mix: "fast", bear: 2.6, drop: 0.5, names: [[7, "Devil's Playground", 150]] },
    { id: "pit", n: "Bottomless Pit", km: 2.3, alt: 4120, cor: 18, mix: "edge", bear: 3.5, drop: 0.85, names: [[8, "Bottomless Pit"]] },
    { id: "boulder", n: "Boulder Park", km: 2.0, alt: 4235, cor: 18, mix: "tech", bear: 4.3, drop: 0.45, names: [[9, "Boulder Park"]] },
    { id: "summit", n: "Summit", km: 1.59, alt: 4302, cor: 14, mix: "summit", bear: 5.2, drop: 0.5, names: [[3, "Olympic"], [13, "Summit"]] }
  ];
  /* the hills: Cloudsplitter Peak (the event, and the team series' finale) and four made-up climbs for the team series' rounds 1–7,
     shorter and lower, built from the same section kit. alt0 the start altitude, tree the treeline (dustier calls above it),
     seed the layout's, secs the sections (as HILL_SECTIONS), edge the named corners that are a sure drop with no guardrail */
  const HILL_HILLS = {
    pikes: { n: "Cloudsplitter Peak", d: "the big one: nearly 20 km into thin air", alt0: HILL_ALT0, tree: HILL_TREE, seed: HILL_SEED, secs: HILL_SECTIONS, edge: ["Bottomless Pit"] },
    badlands: { n: "Badlands Grade", d: "up out of a prairie coulee: short, fast and dusty", alt0: 690, tree: 600, seed: 3107, edge: [], secs: [
      { id: "coulee", n: "Coulee Floor", km: 1.5, alt: 735, cor: 8, mix: "fast", bear: 0.3, drop: 0.05, names: [[3, "Dry Creek Bend"]] },
      { id: "hoodoo", n: "The Hoodoos", km: 1.6, alt: 830, cor: 12, mix: "mixed", bear: 1.0, drop: 0.15, names: [[5, "The Hoodoos"]] },
      { id: "breaks", n: "The Breaks", km: 1.3, alt: 930, cor: 9, mix: "hairpins", bear: 1.6, drop: 0.35, names: [[4, "Rattlesnake", 16]] },
      { id: "rim", n: "Rim Rock", km: 1.0, alt: 985, cor: 6, mix: "fast", bear: 0.6, drop: 0.25, names: [[5, "Rim Rock"]] }] },
    kettle: { n: "Kettle Butte", d: "a foothills ranch road through the aspens", alt0: 1320, tree: 2400, seed: 5521, edge: [], secs: [
      { id: "ranch", n: "Ranch Gate", km: 1.8, alt: 1395, cor: 10, mix: "fast", bear: 1.2, drop: 0.05, names: [[2, "Cattle Guard"]] },
      { id: "aspen", n: "Aspen Grove", km: 2.2, alt: 1560, cor: 17, mix: "forest", bear: 1.9, drop: 0.12, names: [[8, "Aspen Grove"]] },
      { id: "kettle", n: "The Kettle", km: 1.9, alt: 1730, cor: 15, mix: "tech", bear: 2.5, drop: 0.3, names: [[7, "The Kettle", 19]] },
      { id: "butte", n: "Butte Top", km: 1.5, alt: 1860, cor: 10, mix: "summit", bear: 1.6, drop: 0.4, names: [[9, "Butte Top"]] }] },
    ghost: { n: "Ghost Ridge", d: "an old mine road: switchbacks, then a shelf over nothing", alt0: 1700, tree: 2300, seed: 8846, edge: ["Widowmaker"], secs: [
      { id: "mill", n: "Stamp Mill", km: 1.8, alt: 1810, cor: 12, mix: "forest", bear: 0.8, drop: 0.1, names: [[5, "Stamp Mill"]] },
      { id: "ladder", n: "The Ladder", km: 2.4, alt: 2040, cor: 22, mix: "hairpins", bear: 1.4, drop: 0.5, names: [[0, "Miner's Turn"], [12, "The Ladder"]] },
      { id: "slide", n: "Rock Slide", km: 2.1, alt: 2230, cor: 14, mix: "fast", bear: 0.6, drop: 0.45, names: [[7, "Rock Slide"]] },
      { id: "shelf", n: "The Shelf", km: 1.9, alt: 2400, cor: 16, mix: "edge", bear: 2.2, drop: 0.85, names: [[9, "Widowmaker"]] },
      { id: "town", n: "Ghost Town", km: 1.4, alt: 2540, cor: 12, mix: "summit", bear: 1.5, drop: 0.5, names: [[11, "Ghost Town"]] }] },
    thunder: { n: "Thunder Pass", d: "a long pass road over the Divide: timber, then scree", alt0: 2040, tree: 2450, seed: 2290, edge: [], secs: [
      { id: "gate", n: "Ranger Gate", km: 2.4, alt: 2200, cor: 14, mix: "fast", bear: 2.0, drop: 0.08, names: [[4, "Ranger Gate"]] },
      { id: "timber", n: "Lodgepole", km: 2.8, alt: 2400, cor: 22, mix: "forest", bear: 2.5, drop: 0.15, names: [[10, "Lodgepole"]] },
      { id: "falls", n: "Thunder Falls", km: 2.2, alt: 2580, cor: 16, mix: "mixed", bear: 1.8, drop: 0.3, names: [[8, "Thunder Falls"]] },
      { id: "scree", n: "Scree Slope", km: 2.5, alt: 2850, cor: 22, mix: "hairpins", bear: 1.2, drop: 0.6, names: [[3, "Scree Slope"], [17, "Eagle's Nest"]] },
      { id: "pass", n: "The Pass", km: 1.9, alt: 3040, cor: 14, mix: "fast", bear: 2.3, drop: 0.5, names: [[13, "The Pass"]] }] }
  };
  const hillId = id => HILL_HILLS[id] ? id : "pikes";
  const hillDef = id => HILL_HILLS[hillId(id)];
  const HILL_TYRES = { street: ROAD_TYRES.street, sport: ROAD_TYRES.sport, semi: ROAD_TYRES.semi, slick: { n: "Hillclimb slick", mu: 1.48, d: "soft race slick" } };
  const HILL_AERO = { none: { n: "None", d: "as the chassis comes", clA: 0, cdA: 0 }, wing: { n: "Wing", d: "rear wing and a lip", clA: 0.55, cdA: 0.07 },
    full: { n: "Splitter + wing", d: "dive planes, big wing", clA: 1.8, cdA: 0.22 }, unl: { n: "Unlimited aero", d: "twin-element wing, floor", clA: 7.2, cdA: 0.65 } };
  /* classes: the tyres and aero each allows, the weight a class's car is stripped to, the field's engines and drivers */
  const HILL_CLASSES = {
    open: { n: "Open", d: "street car · street or sport tyres · no aero", tier: 1, rep: 0, tyres: ["street", "sport"], aero: ["none"], massK: 1, field: { hp: 260, sd: 70, turbo: 0.35, skill: 0.55 } },
    ta: { n: "Time Attack", d: "production car · semi-slicks · a wing", tier: 2, rep: 25, tyres: ["sport", "semi"], aero: ["none", "wing"], massK: 1, field: { hp: 420, sd: 90, turbo: 0.6, skill: 0.65 } },
    ppo: { n: "Cloudsplitter Peak Open", d: "modified · slicks · splitter and wing", tier: 3, rep: 70, tyres: ["semi", "slick"], aero: ["none", "wing", "full"], massK: 0.93, field: { hp: 600, sd: 110, turbo: 0.75, skill: 0.75 } },
    unl: { n: "Unlimited", d: "anything goes · big aero", tier: 4, rep: 160, tyres: ["slick"], aero: ["full", "unl"], massK: 0.78, field: { hp: 880, sd: 160, turbo: 0.85, skill: 0.85 } }
  };
  const HILL_ALTS = [2862, 3222, 3582, 3942, 4302];
  /* the five altitudes a hill's engine is run at, line to finish (Cloudsplitter: HILL_ALTS) */
  const hillAlts = id => { if (hillId(id) === "pikes") return HILL_ALTS; const H = hillDef(id), a1 = H.secs[H.secs.length - 1].alt; return [0, 1, 2, 3, 4].map(i => Math.round(H.alt0 + (a1 - H.alt0) * i / 4)); };
  const HILL_CALL = { dusty: -0.04, clean: 0, grippy: 0.035 };
  const hillAmbC = alt => 16 - 6.5 * (alt - HILL_ALT0) / 1000;   // a July morning: 16 °C at Cloudsplitter's line, about 7 °C on top; one air for every hill (a team round shifts it by its weather: wx.dT)

  const hillZ = (T, s) => { const f = clamp(s / T.ds, 0, T.N - 1.001), i = f | 0; return T.z[i] + (T.z[i + 1] - T.z[i]) * (f - i); };
