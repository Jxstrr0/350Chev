  /* =====================================================================
     SALT, THE AUTO DRIVER: in sim-late.js, not in the page (since 1.76.139.0).
     Here: the auto driver's foot (lsrFoot).
     build.js writes this file to sim-late.js; the app fetches it once the garage is up and runs it
     inside the ENGINE_SIM closure (simLateRun in sim/tunemap.js), so it sees every physics name as
     if it were still in the page. sim/salt.js keeps everything else, the run included: the class records (lsrRecord, read by Records and warmed at boot) are set by timing a salt pass, so lsrRun stays in the page.
     ===================================================================== */
  /* the auto driver's foot (the app's Auto driver, and the rest of a skipped run): flat out, but once the tyres slip it holds
     them on the slip where the salt grips hardest (8%, the peak of mu() above) instead of waiting for 13% and chopping the
     throttle; off a little more for a light nose, off hard when the car is getting loose. f(st, dt) gives 0..1 for the next dt
     seconds (20 ms steps, shorter on a frame). Worth 4-6 mph through the mile on cars with more power than grip (an outlaw
     or pro-mod motor in an altered, a roadster or a lakester); the same on a car that never spins. lsrPass keeps the old
     foot, so the seeded record book and the Top gear helper are where they were. */
  function lsrFoot() {
    let thr = 1;
    return function (st, dt) {
      if (st.phase !== "run") return 1;
      const k = clamp((dt || 0.02) / 0.02, 0, 12.5), sT = 0.08;
      if (st.slip > sT || thr < 1) thr += 0.6 * (sT - st.slip) * k; else thr += 0.05 * k;
      if (st.light < 0.5) thr -= 0.05 * k;
      if (st.loose > 0.3) thr *= Math.pow(st.loose > 0.5 ? 0.75 : 0.88, k);
      thr = clamp(thr, 0.04, 1); return thr;
    };
  }
