
  /* =====================================================================
     24 HOURS OF PRAIRIE SKY — the endurance race.
     The car is the road-test car on race slicks. Its pace comes from lapSim in three engine
     modes (torque × 1 / 0.965 / 0.92 at the same gearing), its grip sensitivity from a second
     lap on a harder tyre, its thirst from the lap trace (throttle × the full-load fuel flow at
     that rpm). Reliability is the dyno endurance model run hot (31 °C) and cool (11 °C) on the
     track profile: each subsystem's Miner damage rate, scaled by mode and the hour's ambient,
     is its wear and — × E24_K — its hazard of letting go this hour.
     The race is a discrete-event sim: every car is its next line-crossing time; enduroStep
     takes crossings (and the timed events: safety cars, the sky) in time order up to a target
     clock, so the app can run 24 h in slices without freezing the page.
     This file keeps only the tables the setup screen reads; the race itself is in sim/e24-run.js,
     which goes into sim-late.js (since 1.76.138.0).
     ===================================================================== */
  const E24_MODES = {
    push: { n: "Push", tq: 1.0, fuel: 1.05, mech: 1.05, therm: 1.06, tyre: 1.25, err: 1.7, d: "everything it has" },
    race: { n: "Race", tq: 0.965, fuel: 0.97, mech: 1.0, therm: 1.0, tyre: 1.0, err: 1.0, d: "short-shift, 96% torque" },
    save: { n: "Conserve", tq: 0.92, fuel: 0.88, mech: 0.95, therm: 0.93, tyre: 0.8, err: 0.7, d: "lean cruise, 92% torque" } };
  // race compounds as μ on the semi-slick; km = life before the cliff at 20 °C
  const E24_TYRES = { soft: { n: "Soft", mu: 1.035, km: 170 }, medium: { n: "Medium", mu: 1.0, km: 270 }, hard: { n: "Hard", mu: 0.965, km: 420 } };
  // what a failure of that subsystem is in the pit lane: [chance it can be fixed, minutes, the fix]; anything else is terminal
  const E24_FIX = { swap_driveline: [0.55, 35, "gearbox changed in the pits"], cooling: [0.85, 7, "split radiator hose replaced"], fuel_delivery: [0.9, 9, "fuel pump changed"], turbine_temp: [0.6, 24, "turbo changed"],
    compressor_map: [0.7, 24, "turbo changed"], vgt_vanes: [0.7, 20, "turbo vane ring freed"], als_heat: [0.7, 22, "cooked turbo changed"],
    oil_starvation: [0.45, 6, "oil surge — topped up, pickup checked"], detonation: [0.35, 5, "burnt plug changed, map pulled back"], preignition_egt: [0.35, 6, "plugs changed, map richened"],
    valve_temp: [0.3, 8, "misfire — plugs and leads"], head_lift: [0.25, 18, "head bolts re-torqued"], gasket_shear: [0.25, 18, "weeping head gasket — coolant topped up"],
    cold_start: [1, 3, "starter changed"], flex_blend: [1, 4, "fuel filter changed"], slap_blowby: [0.8, 4, "blow-by — oil topped up"], ring_gap: [0.6, 4, "oil consumption — topped up"],
    hot_clearance: [0.4, 6, "scuffed piston — oil topped up"], coolant_seal: [0.4, 12, "O-ring weep — coolant topped up"], carbon_seals: [0.7, 5, "carbon cleared with a hot lap"], oil_metering: [0.8, 5, "oil metering pump changed"] };
  /* the crew chief's judgement: wear = the most any part may be worn by the flag; dSave / dPush = how much failure risk per hour
     Conserve must save, or Push may add, to be worth it; cruise / reach = how far beyond what the pace could win or lose over the
     hours left a gap must be before it stops mattering; margin = seconds, about a pit stop; punct = seconds a puncture costs */
  const E24_CHIEF = { wear: 0.8, dSave: 0.008, dPush: 0.0015, cruise: 1.5, reach: 1.5, margin: 120, punct: 150 };
  const E24_K = 2.5, E24_DUR = 86400, E24_START = 14, E24_TANK = 100, E24_SC_RATE = 0.16;
  const E24_CLASSES = {
    proto: { n: "Proto", ch: "super", k: 0.96, pool: ["v12_65", "valkyrie", "r26b", "dfv", "v10_52", "1lr", "s85", "hellcat"], prize: [30000, 18000, 10000, 5000, 3000], rep: [34, 22, 15] },
    gt: { n: "GT", ch: "super", k: 1, pool: ["gt3r", "m156", "p997t", "9a2tt", "vr38", "coyote", "f6_38", "voodoo", "ls3", "godzilla73", "b58", "hemi64"], prize: [20000, 12000, 7000, 4000, 2500], rep: [26, 17, 11] },
    stock: { n: "Stock", ch: "coupe", k: 1, pool: ["k20a", "2jzgte", "rb26", "ej257", "4g63", "1gr", "s54", "l36", "13b_rew", "f20c", "ea888", "20b_rew"], prize: [12000, 7000, 4000, 2500, 1500], rep: [18, 12, 8] } };
  const E24_CLS_ORDER = ["proto", "gt", "stock"], E24_FIELD = { proto: 5, gt: 8, stock: 7 };
  /* the clock: the green flag drops at 2 pm; 30 °C at 4 pm, 12 °C at 4 am; dark from about 22:15 to 04:45 */
  function e24Hour(t) { return (E24_START + t / 3600) % 24; }
  const e24Clock = t => { const h = e24Hour(t), hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm; };
