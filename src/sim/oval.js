  /* =====================================================================
     DIRT OVAL: a 3/8-mile (600 m) banked clay oval, left turns only. Two 105 m straights, two 62 m radius
     180° turns banked 22°. The clay is the whole story: μ about 0.7 and moving. It starts the night tacky
     (more grip), dries out and goes slick as the laps pile up, and each tyre wears. The car is a stock-car
     chassis with a rear-drive solid axle, ONE gear and a quick-change rear end (the final drive you pick):
     the engine's rpm is just the speed times the ratio, so what it makes at corner-exit rpm decides how
     hard the car can go, not what it peaks at. A time-stepped point mass runs the whole race:
       - corners: the banked-turn limit v² = R·g·(tanθ + μ)/(1 − μ·tanθ); the driver's pace multiplies it,
         a corner has its own hidden grip (±2%), and a pace past it is a slide: speed scrubbed, a loose exit
       - straights: braking curve into the next turn, full throttle out of it; wheel force against the
         traction the rear tyres have left after cornering (friction circle). Too much torque for the clay
         spins the tyres and gives some of it back; too little for the gearing leaves traction unused
       - throttle response: the foot, the engine's own pickup (weak low-end torque is slow to answer),
         and turbo lag where there is one
       - heat: the radiator sheds by airspeed and clogs with the dust of the car in front; the grille
         trades cooling against drag; past 112 °C the engine pulls power, past 122 it lifts a head
       - the dyno's own failures strike at some point under load, as everywhere else
     The same step drives the AI cars (a made-up engine and a driver's skill) and the player's car.
     The PAVED half-mile (v1.77) is the same step on another set of numbers (OVAL_TRACKS): 805 m, 70 m radius turns banked 13°, two 183 m
     straights, asphalt at μ about 1.05–1.15 that holds steady all night (the night's temperature moves it a little, and a hot night
     greases the tyres over the race), little rolling drag, no clay dust to clog the radiator, a car geared for the longer straight.
     The clay track's numbers are the originals, untouched.
     ===================================================================== */
  /* the run itself is in sim/oval-run.js, which goes into sim-late.js (since 1.76.139.0) */
  const OVAL_R = 52, OVAL_LEN = 600, OVAL_LS = (OVAL_LEN - 2 * Math.PI * OVAL_R) / 2, OVAL_BANK = 22 * Math.PI / 180, OVAL_W = 18, OVAL_G = 9.81;
  /* the tracks: n what it is, v the venue's name (since 1.76.106.0), geometry (R turn radius m, len lap m, ls straight m, bank rad, w width m) and what the surface does
     (crr rolling, scrub cornering scrub, dirtyK pace lost in the car ahead's air, dust radiator clogging, brakeK braking grip, vTopK the speed the rear end is
     sized for, lapRef seconds a lap for the failure clock, wearMu how much worn tyres lose) */
  const OVAL_TRACKS = {
    clay: { id: "clay", n: "Clay 3/8", v: "Grid Road Speedway", surf: "clay", dist: "3/8 mile", R: OVAL_R, len: OVAL_LEN, ls: OVAL_LS, bank: OVAL_BANK, bankDeg: 22, w: OVAL_W,
      crr: 0.05, scrub: 0.10, dirtyK: 0.014, dust: 1, brakeK: 1, vTopK: 1, lapRef: 19, wearMu: 0.22 },
    paved: { id: "paved", n: "Paved half-mile", v: "Sundog Speedway", surf: "asphalt", dist: "1/2 mile", R: 70, len: 805, ls: (805 - 2 * Math.PI * 70) / 2, bank: 13 * Math.PI / 180, bankDeg: 13, w: 20,
      crr: 0.022, scrub: 0.07, dirtyK: 0.006, dust: 0.12, brakeK: 1.35, vTopK: 1.1, lapRef: 21, wearMu: 0.2 }
  };
  const ovalTrack = t => typeof t === "object" && t ? t : OVAL_TRACKS[t] || OVAL_TRACKS.clay;
  const OVAL_TYRES = {
    soft: { n: "Soft", d: "bites early · fades late", mu: 1.045, wear: 1.9 },
    med: { n: "Medium", d: "the all-rounder", mu: 1.0, wear: 1.0 },
    hard: { n: "Hard", d: "lasts · less bite", mu: 0.965, wear: 0.5 }
  };
  const OVAL_GRILLES = {
    open: { n: "Open", d: "cools best · drag, clogs", ua: 1.22, cd: 1.05, pk: 1.4 },
    mid: { n: "Half", d: "the usual", ua: 1, cd: 1, pk: 1 },
    tape: { n: "Taped", d: "slippery · runs hot", ua: 0.72, cd: 0.955, pk: 0.55 }
  };
  const OVAL_CLASSES = {
    street: { n: "Street Stock", d: "up to 360 ci · heavy steel-bodied stocks", tier: 1, rep: 10, ci: 360,
      veh: { mass: 1360, rf: 0.52, cdA: 1.12, tyreDia: 27, vTop: 42, mu: 0.66, engRef: 220, brake: 0.5, kw: 200 }, field: { hp: 295, sd: 45, skill: 0.55 } },
    late: { n: "Late Model", d: "up to 430 ci · lighter, more grip", tier: 2, rep: 45, ci: 430,
      veh: { mass: 1090, rf: 0.55, cdA: 1.2, tyreDia: 28, vTop: 47, mu: 0.70, engRef: 250, brake: 0.55, kw: 300 }, field: { hp: 560, sd: 70, skill: 0.68 } },
    open: { n: "Open", d: "any size · the lightest, fastest cars", tier: 3, rep: 110, ci: 9999,
      veh: { mass: 980, rf: 0.57, cdA: 1.26, tyreDia: 29, vTop: 51, mu: 0.72, engRef: 280, brake: 0.6, kw: 380 }, field: { hp: 780, sd: 100, skill: 0.8 } }
  };
  for (const k in OVAL_CLASSES) OVAL_CLASSES[k].id = k;
  const ovalCi = res => (+res.VdEq || +res.Vd || 5000) / 16.387;
  /* the night's clay: base grip, how tacky it starts, its name */
  function ovalNight(seed, track) {
    if (ovalTrack(track).surf === "asphalt") {   // asphalt has no moisture: the night's temperature moves the grip (cool = more) and the cooling (hot air = less); a hot track greases the tyres over a race
      const q = pullRng(((seed >>> 0) ^ 0x0A5F17) >>> 0), t = q(), j = q(), f = q();
      return { seed: seed >>> 0, mu: +(1.13 - 0.09 * t + (j - 0.5) * 0.04).toFixed(3), wet: 0, name: t < 0.34 ? "cool" : t < 0.67 ? "mild" : "hot", fast: 0.5 + f * 0.4, amb: +(14 + 18 * t).toFixed(1), grease: +(0.15 + 0.85 * t).toFixed(2), temp: t };
    }
    const r = pullRng(((seed >>> 0) ^ 0x0D17A1) >>> 0), mu = +(0.64 + r() * 0.1).toFixed(3), wet = +(0.35 + r() * 0.5).toFixed(2);
    return { seed: seed >>> 0, mu: mu, wet: wet, name: wet > 0.7 ? "wet and tacky" : wet > 0.5 ? "tacky" : "medium", fast: 0.55 + r() * 0.4 };
  }
