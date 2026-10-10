<script>
/* ============================================================================
   Prairie Engine Works v2 — ENGINE_SOUND
   Pure Web Audio engine synthesis. No audio files, no network (the optional
   recorded layer lives in ENGINE_SAMPLES below and only hooks setSynthMix/sampleHost).
   Contract: see SCHEMA.md  §ENGINE_SOUND
   ----------------------------------------------------------------------------
   Model
   -----
   The exhaust note is generated from an actual firing-pulse train laid out over
   one 720-degree four-stroke cycle using the layout's firing order, per-bank
   amplitude and per-bank runner phase. That train is DFT'd into a PeriodicWave
   (rebuilt only when the profile/layout changes) and played by ONE oscillator
   whose frequency is the *cycle* frequency rpm/120 Hz. Harmonic k of that wave
   is therefore engine order k/2 — so half-orders (crossplane burble, I3 1.5,
   I5 2.5) fall out of the physics instead of being faked.

   Layers: exhaust pulse -> waveshaper -> 3 pipe formants;  sub thump;
           intake (ITB honk / plenum whoosh, VTEC step);
           mechanical (valvetrain tick + gear whine);
           forced induction (turbo whine / roots lobe whine / centrifugal);
           short synthesized garage convolution reverb; soft limiter.
   ========================================================================== */
const ENGINE_SOUND = (function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * 1. Layout / firing-order table (mirrors SCHEMA LAYOUTS keys)
   * ------------------------------------------------------------------ */
  var LAY = {
    I3:  { n:3,  banks:1, angle:0,   smooth:40, firingOrder:[1,2,3],             bankOf:[0,0,0] },
    I4:  { n:4,  banks:1, angle:0,   smooth:66, firingOrder:[1,3,4,2],           bankOf:[0,0,0,0] },
    I5:  { n:5,  banks:1, angle:0,   smooth:72, firingOrder:[1,2,4,5,3],         bankOf:[0,0,0,0,0] },
    I6:  { n:6,  banks:1, angle:0,   smooth:94, firingOrder:[1,5,3,6,2,4],       bankOf:[0,0,0,0,0,0] },
    V6:  { n:6,  banks:2, angle:60,  smooth:78, firingOrder:[1,4,2,5,3,6],       bankOf:[0,0,0,1,1,1] },
    V8:  { n:8,  banks:2, angle:90,  smooth:88, crossplane:true,
           firingOrder:[1,8,4,3,6,5,7,2],  bankOf:[0,1,0,1,0,1,0,1] },
    V8F: { n:8,  banks:2, angle:90,  smooth:84,
           firingOrder:[1,5,3,7,4,8,2,6],  bankOf:[0,0,0,0,1,1,1,1] },
    V10: { n:10, banks:2, angle:90,  smooth:92,
           firingOrder:[1,6,5,10,2,7,3,8,4,9], bankOf:[0,0,0,0,0,1,1,1,1,1] },
    V12: { n:12, banks:2, angle:60,  smooth:99,
           firingOrder:[1,12,5,8,3,10,6,7,2,11,4,9], bankOf:[0,0,0,0,0,0,1,1,1,1,1,1] },
    F4:  { n:4,  banks:2, angle:180, smooth:60, firingOrder:[1,3,2,4],           bankOf:[0,1,0,1] },
    F6:  { n:6,  banks:2, angle:180, smooth:96, firingOrder:[1,6,2,4,3,5],       bankOf:[0,0,0,1,1,1] },
    /* Wankel: every rotor fires once per e-shaft turn, so over the 720-degree table a rotary has two
       events per rotor, evenly spaced. Each event gets its own "bank" so the profile can make
       individual combustions uneven (the overlap misfire that becomes the brap). */
    R1:  { n:2,  banks:1, angle:0, smooth:62, rotors:1, firingOrder:[1,2],             bankOf:[0,1] },
    R2:  { n:4,  banks:1, angle:0, smooth:88, rotors:2, firingOrder:[1,2,3,4],         bankOf:[0,1,2,3] },
    R3:  { n:6,  banks:1, angle:0, smooth:94, rotors:3, firingOrder:[1,2,3,4,5,6],     bankOf:[0,1,2,3,4,5] },
    R4:  { n:8,  banks:1, angle:0, smooth:97, rotors:4, firingOrder:[1,2,3,4,5,6,7,8], bankOf:[0,1,2,3,4,5,6,7] }
  };
  var ROT_OVERLAP = { side: 0.05, sidex: 0.0, street: 0.14, bridge: 0.48, peri: 0.72 };   // mirrors OPT.rotPort
  /* two-stroke: every cylinder fires every turn, so over the 720-degree table it has two events per cylinder (the
     Deltic one per cylinder per turn too, two pistons meeting in it). Each event is its own "bank" so the profile can
     make single combustions weak or missing: a two-stroke idling four-strokes, the ring-ding. Made on demand. */
  function tsLayKey(cfg, lk) {
    var n = (LAY[lk] && !LAY[lk].rotors && !LAY[lk].ts) ? LAY[lk].n : ({ I1: 1, I2: 2, V4: 4, D18: 18 })[cfg.layout] || 2;
    var k = "TS" + n;
    if (!LAY[k]) {
      var ev = 2 * n, fo = [], bo = [];
      for (var i = 0; i < ev; i++) { fo.push(i + 1); bo.push(i); }
      LAY[k] = { n: ev, banks: 1, angle: 0, smooth: clamp(20 + 10 * n, 18, 98), ts: n, firingOrder: fo, bankOf: bo };
    }
    return k;
  }
  function isTwoCfg(cfg) { return !!(cfg && cfg.cycle === "two" && !/^R[1-4]$/.test(cfg.layout || "")); }

  /* ------------------------------------------------------------------ *
   * 2. Exhaust-system voicing tables
   * ------------------------------------------------------------------ */
  // formants: [freqHz, Q, gainDb] triples for the "pipe" peaking filters
  var EXH = {
    cast_log:      { tilt:0.42, drive:0.55, rasp:0.10, level:0.86,
                     form:[[130,1.1,7],[330,1.3,3],[900,0.8,-9]] },
    cast_tubular:  { tilt:0.58, drive:0.75, rasp:0.20, level:0.94,
                     form:[[150,1.2,7],[480,1.6,4],[1400,0.9,-4]] },
    headers_equal: { tilt:0.78, drive:0.95, rasp:0.30, level:1.00,
                     form:[[175,1.3,6],[640,2.0,6],[1900,1.1,1]] },
    headers_merge: { tilt:0.92, drive:1.25, rasp:0.55, level:1.04,
                     form:[[195,1.4,5],[820,2.8,8],[2450,1.6,3]] }
  };

  /* the system after the manifold, layered on the manifold's voicing: lvl = loudness, drive = bark/distortion,
     bright = how much top end gets out (low-pass), fq = pipe resonance pitch (big duals sit lower), rasp = gain on the
     top formant (dB), body = gain on the bottom one. Stock pipe + OEM muffler + no cat is exactly 1/1/1/1/0/0. */
  var SYS = {
    pipe:    { stock:{}, s225:{ fq:1.12, bright:0.95, body:-1 }, s250:{ fq:1.05 }, d250:{ fq:0.90, lvl:1.06, body:1.5 },
               d300:{ fq:0.80, lvl:1.10, body:3 }, t400:{ fq:0.84, lvl:1.06, body:2 } },
    muffler: { stock:{}, chambered:{ lvl:1.32, drive:1.18, bright:1.12, rasp:2, body:1.5 }, glasspack:{ lvl:1.50, drive:1.32, bright:1.30, rasp:4.5 },
               turbo:{ lvl:1.10, bright:0.90, rasp:-1.5, body:1 }, straight:{ lvl:1.85, drive:1.55, bright:1.50, rasp:6, body:1 } },
    cat:     { none:{}, oem:{ lvl:0.82, drive:0.85, bright:0.78, rasp:-2.5 }, hiflow:{ lvl:0.90, drive:0.92, bright:0.88, rasp:-1.2 },
               dpf:{ lvl:0.76, drive:0.82, bright:0.70, rasp:-3.5 }, "delete":{ lvl:1.03, bright:1.04 } },
    open:    { lvl:2.05, drive:1.70, bright:1.65, rasp:7, fq:1.22, body:-1 }
  };
  function sysVoice(cfg) {
    var v = { lvl:1, drive:1, bright:1, fq:1, rasp:0, body:0 }, parts;
    var open = cfg.pipe === "open" || cfg.cutout === "open";
    if (open) parts = [SYS.open];
    else parts = [SYS.pipe[cfg.pipe] || {}, SYS.muffler[cfg.muffler] || {}, SYS.cat[cfg.cat] || {}];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.lvl) v.lvl *= p.lvl; if (p.drive) v.drive *= p.drive; if (p.bright) v.bright *= p.bright; if (p.fq) v.fq *= p.fq;
      if (p.rasp) v.rasp += p.rasp; if (p.body) v.body += p.body;
    }
    return v;
  }

  // shot size in crank hp, mirroring OPT.nitrous in the sim
  var OPTN2O = { none: 0, wet150: 150, direct250: 250, prog400: 400, prog700: 700, dry75: 75, dry125: 125, wet2stage: 250, diesel100: 100 };

  var TURBO_SIZE = { small:{ base:5200, spool:0.85, wg:0.8 }, medium:{ base:4200, spool:0.70, wg:1.0 },
                     large:{ base:3300, spool:0.55, wg:1.3 }, s66:{ base:2850, spool:0.46, wg:1.5 }, huge:{ base:2500, spool:0.42, wg:1.7 },
                     f88:{ base:1950, spool:0.32, wg:2.3 },  f98:{ base:1650, spool:0.26, wg:2.8 } };

  /* ------------------------------------------------------------------ *
   * 3. Profile parameter sets
   * ------------------------------------------------------------------ *
   * pulseSpread  pulse width as a multiple of the firing interval (rasp/blur)
   * pulseDecay   exponential decay rate inside a pulse (bark vs. bloom)
   * bankGain[]   per-bank exhaust amplitude  (asymmetry -> half-order content)
   * bankPhase[]  per-bank runner phase in crank degrees (unequal headers)
   * cylJitter[]  per-firing-event angle jitter, degrees (lope / cheap crank)
   * tilt         spectral brightness of the pulse train (0 dull .. 1 bright)
   * intake       {type:'itb'|'plenum'|'carb', lo, hi, q, g}
   * vvl          {rpm, gain, bright}  VTEC/VVL crossover, or null
   * mech         {tick, whine}
   * ind          {type:'na'|'turbo'|'twin'|'roots'|'centri', size, pulley}
   */
  function P(o) {
    var d = {
      layout: "I4", name: "", pulseSpread: 1.35, pulseDecay: 6.0,
      bankGain: [1, 1], bankPhase: [0, 0], cylJitter: null,
      tilt: 0.7, exh: "headers_equal", sub: 0.55, level: 1.0,
      intake: { type: "plenum", lo: 220, hi: 520, q: 1.1, g: 0.35 },
      vvl: null, mech: { tick: 0.20, whine: 0.10 },
      ind: { type: "na", size: "medium", pulley: 2.4 },
      wet: 0.18, redline: 7000
    };
    for (var k in o) d[k] = o[k];
    return d;
  }

  var profiles = {
    /* --- naturally aspirated four --------------------------------------- */
    i4_vtec: P({
      layout: "I4", name: "High-cam I4 (VTEC)", exh: "headers_equal",
      pulseSpread: 1.15, pulseDecay: 7.5, tilt: 0.80, sub: 0.42, level: 1.00,
      intake: { type: "itb", lo: 260, hi: 780, q: 4.5, g: 0.34 },
      vvl: { rpm: 5800, gain: 2.15, bright: 1.35 },
      mech: { tick: 0.30, whine: 0.16 }, redline: 8600
    }),

    /* --- straight sixes -------------------------------------------------- */
    i6_turbo: P({
      layout: "I6", name: "Turbo straight-six", exh: "cast_tubular",
      pulseSpread: 1.45, pulseDecay: 5.0, tilt: 0.58, sub: 0.68, level: 0.98,
      intake: { type: "plenum", lo: 170, hi: 430, q: 0.9, g: 0.46 },
      mech: { tick: 0.14, whine: 0.12 },
      ind: { type: "turbo", size: "large", pulley: 0 }, wet: 0.20, redline: 7200
    }),
    i6_itb: P({
      layout: "I6", name: "ITB straight-six", exh: "headers_merge",
      pulseSpread: 1.10, pulseDecay: 7.0, tilt: 0.86, sub: 0.48, level: 1.00,
      intake: { type: "itb", lo: 300, hi: 900, q: 5.5, g: 0.42 },
      mech: { tick: 0.26, whine: 0.18 }, redline: 8200
    }),

    /* --- V8s ------------------------------------------------------------- */
    v8_crossplane: P({
      layout: "V8", name: "Crossplane V8", exh: "headers_equal",
      pulseSpread: 1.30, pulseDecay: 5.2, tilt: 0.66, sub: 0.90, level: 0.92,
      // two separate pipes that never merge cleanly -> the burble
      bankGain: [1.0, 0.74], bankPhase: [0, 11],
      intake: { type: "plenum", lo: 150, hi: 380, q: 1.0, g: 0.40 },
      mech: { tick: 0.16, whine: 0.06 }, wet: 0.22, redline: 6800
    }),
    v8_flatplane: P({
      layout: "V8F", name: "Flat-plane V8", exh: "headers_merge",
      pulseSpread: 1.00, pulseDecay: 8.5, tilt: 0.95, sub: 0.40, level: 0.96,
      bankGain: [1.0, 0.96], bankPhase: [0, 2],
      intake: { type: "itb", lo: 340, hi: 1100, q: 5.0, g: 0.40 },
      mech: { tick: 0.30, whine: 0.22 }, wet: 0.16, redline: 9000
    }),
    pushrod_v8: P({
      layout: "V8", name: "Pushrod V8", exh: "cast_log",
      pulseSpread: 1.55, pulseDecay: 3.6, tilt: 0.40, sub: 1.05, level: 0.90,
      bankGain: [1.0, 0.80], bankPhase: [0, 16],
      cylJitter: [0, 3.5, -2.5, 4.5, -1.5, 3.0, -3.5, 1.5],   // lopey big cam
      intake: { type: "carb", lo: 120, hi: 300, q: 1.4, g: 0.44 },
      mech: { tick: 0.34, whine: 0.04 }, wet: 0.24, redline: 6200
    }),

    /* --- exotics --------------------------------------------------------- */
    v10: P({
      layout: "V10", name: "V10", exh: "headers_merge",
      pulseSpread: 0.95, pulseDecay: 9.0, tilt: 0.97, sub: 0.46, level: 0.90,
      bankGain: [1.0, 0.90], bankPhase: [0, 4],
      intake: { type: "itb", lo: 380, hi: 1250, q: 5.5, g: 0.44 },
      mech: { tick: 0.28, whine: 0.26 }, wet: 0.15, redline: 9500
    }),
    v12: P({
      layout: "V12", name: "V12", exh: "headers_merge",
      pulseSpread: 1.05, pulseDecay: 9.5, tilt: 0.93, sub: 0.42, level: 0.88,
      bankGain: [1.0, 0.97], bankPhase: [0, 1.5],
      intake: { type: "itb", lo: 360, hi: 1150, q: 4.0, g: 0.38 },
      mech: { tick: 0.20, whine: 0.30 }, wet: 0.17, redline: 8800
    }),

    /* --- boxers ---------------------------------------------------------- */
    f4_rumble: P({
      layout: "F4", name: "Boxer 4 (unequal headers)", exh: "cast_tubular",
      pulseSpread: 1.50, pulseDecay: 4.2, tilt: 0.52, sub: 0.86, level: 0.94,
      // the Subaru trick: one bank's runners are much longer and quieter
      bankGain: [1.0, 0.58], bankPhase: [0, 34],
      intake: { type: "plenum", lo: 160, hi: 400, q: 1.0, g: 0.42 },
      mech: { tick: 0.18, whine: 0.08 },
      ind: { type: "turbo", size: "medium", pulley: 0 }, wet: 0.22, redline: 7000
    }),
    f6: P({
      layout: "F6", name: "Flat six", exh: "headers_equal",
      pulseSpread: 1.15, pulseDecay: 7.8, tilt: 0.84, sub: 0.50, level: 0.94,
      bankGain: [1.0, 0.93], bankPhase: [0, 5],
      intake: { type: "itb", lo: 320, hi: 980, q: 3.6, g: 0.44 },
      mech: { tick: 0.24, whine: 0.30 }, wet: 0.18, redline: 8000
    }),

    /* --- small forced-induction ------------------------------------------ */
    i3_turbo: P({
      layout: "I3", name: "Turbo triple", exh: "cast_log",
      pulseSpread: 1.60, pulseDecay: 4.0, tilt: 0.50, sub: 0.80, level: 1.02,
      cylJitter: [0, 2.5, -2.0],
      intake: { type: "plenum", lo: 190, hi: 460, q: 1.0, g: 0.50 },
      mech: { tick: 0.22, whine: 0.10 },
      ind: { type: "turbo", size: "small", pulley: 0 }, wet: 0.20, redline: 6800
    }),
    i4_turbo: P({
      layout: "I4", name: "Turbo four", exh: "cast_tubular",
      pulseSpread: 1.30, pulseDecay: 5.5, tilt: 0.62, sub: 0.66, level: 1.00,
      intake: { type: "plenum", lo: 200, hi: 480, q: 1.0, g: 0.48 },
      mech: { tick: 0.20, whine: 0.12 },
      ind: { type: "turbo", size: "medium", pulley: 0 }, wet: 0.19, redline: 7400
    }),
    i5_turbo: P({
      layout: "I5", name: "Turbo five", exh: "cast_tubular",
      pulseSpread: 1.35, pulseDecay: 5.2, tilt: 0.66, sub: 0.72, level: 0.98,
      bankGain: [1, 1], cylJitter: [0, 1.5, -1.0, 2.0, -1.5],
      intake: { type: "plenum", lo: 190, hi: 470, q: 1.1, g: 0.46 },
      mech: { tick: 0.20, whine: 0.14 },
      ind: { type: "turbo", size: "medium", pulley: 0 }, wet: 0.21, redline: 7200
    })
  };

  /* ------------------------------------------------------------------ *
   * 4. Derive a profile from an arbitrary cfg (custom engines)
   * ------------------------------------------------------------------ */
  var DERIVE_CACHE = { key: "", prof: null };

  function deriveProfile(cfg, layoutKey, diesel) {
    cfg = cfg || {};
    var lk = layoutKey || cfg.layout || "I4";
    var two = isTwoCfg(cfg); if (two) lk = tsLayKey(cfg, lk);
    var L = LAY[lk] || LAY.I4;
    var key = [lk, cfg.intake, cfg.asp, cfg.turboSize, cfg.exhaust, cfg.head,
               cfg.cam, cfg.lift, cfg.redline, cfg.crank, cfg.nitrous,
               Math.round(num(cfg.bore, 86) / 4), Math.round(num(cfg.stroke, 86) / 4),
               cfg.pipe, cfg.muffler, cfg.cat, cfg.cutout].join("|");
    var dz = !!diesel; if (dz) key += "|dz";
    var rot = !!L.rotors; if (rot) key += "|rotary|" + cfg.rotPort + "|" + num(cfg.ecc, 15);
    if (two) key += "|2t|" + [cfg.xpipe, cfg.pipeRpm, cfg.induct, cfg.scav, cfg.ePort, cfg.tsFuel, cfg.layout].join("|");
    if (DERIVE_CACHE.key === key && DERIVE_CACHE.prof) return DERIVE_CACHE.prof;

    var exh = EXH[cfg.exhaust] ? cfg.exhaust : "cast_tubular";
    var cam = num(cfg.cam, 45) / 100, lift = num(cfg.lift, 45) / 100;
    var n = L.n;
    // a cylinder's own size sets how heavy and how slow its blowdown is
    var bore = num(cfg.bore, 86), stroke = num(cfg.stroke, 86);
    var cc = Math.PI / 4 * bore * bore * stroke / 1000;      // cc per cylinder
    var big = clamp(cc / 500, 0.22, 3.2);                    // 1.0 = a 2.0-litre four
    var hemi = (cfg.head === "billet_hemi") ? 1 : 0;

    // brightness rises with cam/lift and with a freer exhaust, and falls with
    // cylinder size — a big slow cylinder is a duller thump
    var tilt = clamp(0.20 + EXH[exh].tilt * 0.62 + (cam - 0.45) * 0.44 + (lift - 0.45) * 0.16
                     - (big - 1) * 0.09 + hemi * 0.07, 0.22, 0.99);
    // more cylinders / more cam -> tighter, snappier pulses; a long stroke
    // lengthens the blowdown, so the pulse spreads
    var spread = clamp(1.70 - (cam - 0.45) * 0.55 - (n - 3) * 0.045
                       + (stroke / 86 - 1) * 0.30, 0.92, 1.85);
    var decay = clamp(3.0 + (cam - 0.45) * 7.0 + (n - 3) * 0.30 - (big - 1) * 0.9, 3.0, 10.0);
    // compression ignition: pressure rises almost instantly (hard edge), and the pipe is a duller,
    // heavier, lower note (big slow cylinders, a muffler and often a turbine in the way)
    if (dz) { tilt = clamp(tilt * 0.62, 0.18, 0.55); spread = clamp(spread * 1.08, 0.92, 1.9); decay = clamp(decay * 0.82, 2.6, 8.0); }

    // bank asymmetry: only V/F engines have two pipes at all
    var bg = [1, 1], bp = [0, 0], bdel = 0;
    if (L.banks === 2) {
      var merged = (exh === "headers_merge") ? 0.35 : (exh === "headers_equal" ? 0.6 : 1.0);
      // bdel is the extra pipe one bank runs, in milliseconds of gas travel
      if (lk === "F4")      { bg = [1, 0.58 + 0.20 * (1 - merged)]; bdel = 0.98 * merged; }
      else if (lk === "F6") { bg = [1, 0.93]; bdel = 0.20 * merged; }
      else if (L.crossplane){ bg = [1, 0.74 + 0.14 * (1 - merged)]; bdel = 0.34 * merged; }
      else                  { bg = [1, 0.94]; bdel = 0.10 * merged; }
    }

    // A big cam dilutes the charge at idle and the engine loses combustion
    // consistency cycle to cycle. That is a wandering amplitude, not a fixed
    // firing-angle error, so it is applied live in set() rather than baked into
    // the wavetable. Only genuinely uneven geometry belongs in cylJitter.
    var jit = null;
    var lope = clamp(Math.max(0, cam - 0.5) * 2.0, 0, 1);

    // intake voice
    var it = cfg.intake || "single_tb", iv;
    if (it === "itb")            iv = { type: "itb",    lo: 290, hi: 900, q: 4.8, g: 0.40 };
    else if (it === "carb")      iv = { type: "carb",   lo: 130, hi: 330, q: 1.4, g: 0.44 };
    else if (it === "plenum_short") iv = { type: "plenum", lo: 240, hi: 620, q: 1.4, g: 0.42 };
    else if (it === "plenum_long")  iv = { type: "plenum", lo: 150, hi: 380, q: 1.2, g: 0.44 };
    else                         iv = { type: "plenum", lo: 200, hi: 500, q: 1.0, g: 0.40 };

    // valvetrain / cam-lobe switching heads
    var vvl = (cfg.head === "dohc4v_vvl") ? { rpm: 5800, gain: 2.1, bright: 1.35 } : null;
    var tick = (cfg.head === "pushrod2v") ? 0.34 : (cfg.head === "sohc2v" ? 0.24
             : (cfg.head === "billet_hemi") ? 0.31 : (cfg.head === "dohc4v_vvt") ? 0.24 : 0.22);
    // loose race clearances rattle; a dry sump adds a scavenge pump
    if (cfg.pistonClearance === "loose") tick += 0.10;
    else if (cfg.pistonClearance === "tight") tick -= 0.03;
    var whine = (cfg.head === "pushrod2v") ? 0.04 : 0.10 + (n >= 10 ? 0.16 : 0)
              + (cfg.head === "billet_hemi" ? 0.12 : 0) + (cfg.oilSystem === "dry" ? 0.10 : 0)
              + (cfg.damper === "none" ? 0.06 : 0);

    // forced induction: decided by the hardware, in one place
    var ind = indFor(cfg);

    var prof = P({
      layout: lk, name: "Custom " + lk, exh: exh, tilt: tilt,
      pulseSpread: spread, pulseDecay: decay, bankGain: bg, bankPhase: bp, bankDelayMs: bdel,
      cylJitter: jit, lope: lope, intake: iv, vvl: vvl, ind: ind,
      mech: { tick: tick, whine: whine },
      n2o: num((OPTN2O[cfg.nitrous] || 0), 0), n2oProg: (cfg.nitrous === "prog400" || cfg.nitrous === "prog700") ? 1 : 0,
      cyl: cc, dz: dz, attack: dz ? 75 : 0, sys: sysVoice(cfg),
      sub: clamp(0.34 + 0.62 * Math.min(1.35, big) - cam * 0.42 + (dz ? 0.16 : 0), 0.30, 1.25),
      level: clamp(1.06 - n * 0.017 + (big - 1) * 0.07, 0.84, 1.14),
      wet: 0.19, redline: num(cfg.redline, 7000)
    });
    if (rot) {
      /* Wankel: a peripheral exhaust port is uncovered all at once by the passing apex, so each pulse has
         a hard edge and a short, bright, buzzing body; small chambers firing twice as often as a piston
         engine of the same "litres" push the whole note up. Port overlap makes some combustions weak or
         missing at idle: baked lightly into the cycle here, and as a live chop in set() (the brap). */
      var ov = ROT_OVERLAP[cfg.rotPort]; if (ov == null) ov = 0.05;
      var chamber = 3 * Math.sqrt(3) * num(cfg.stroke, 105) * num(cfg.ecc, 15) * num(cfg.bore, 80) / 1000;
      var rbig = clamp(chamber / 500, 0.4, 2.2), k = 0.04 + 0.30 * ov, rg = [], rj = [];
      for (var ev = 0; ev < n; ev++) { rg.push(1 - k * (((ev * 7) % 5) / 4)); rj.push([0, 6, -4, 3, -5, 2, -3, 5][ev % 8] * ov); }
      prof.rotary = 1; prof.rot = ov; prof.name = "Custom " + lk + " rotary"; prof.cyl = chamber;
      prof.tilt = clamp(0.80 + EXH[exh].tilt * 0.18 + ov * 0.10 - (cfg.rotPort === "sidex" ? 0.10 : 0), 0.6, 0.99);
      prof.pulseSpread = clamp(0.95 - ov * 0.15, 0.75, 1.0);
      prof.pulseDecay = clamp(7.5 + ov * 3, 6, 11);
      prof.attack = 60; prof.bankGain = rg; prof.bankPhase = [0, 0]; prof.bankDelayMs = 0; prof.cylJitter = ov > 0.1 ? rj : null;
      prof.lope = clamp(ov * 1.3, 0, 1);
      if (ov >= 0.4) prof.intake = { type: "itb", lo: 330, hi: 1150, q: 3.2, g: 0.46 };   // a bridge / peri port howls through its intake
      prof.mech = { tick: 0.05, whine: 0.16 + (cfg.oilSystem === "dry" ? 0.08 : 0) };      // no valvetrain: gears and the oil pump
      prof.sub = clamp(0.28 + 0.22 * rbig, 0.28, 0.70);
      prof.level = clamp(1.10 + 0.03 * (n / 2 - 2) + 0.06 * ov, 1.0, 1.22);               // loud
    }
    if (two) {
      /* two-stroke: the exhaust port is uncovered all at once by the piston crown, so each pulse has a hard edge and a
         short, buzzing body, twice as many of them as a four-stroke of the same cylinders. No valvetrain to tick; a
         piston that rattles in its bore instead. The expansion chamber is a resonator the firing harmonics sweep
         through as the revs rise (set() moves a formant with it), and at idle it four-strokes: whole combustions go
         missing (the ring-ding). A uniflow Detroit screams through its blower and its valves instead. */
      var ncyl = L.ts, chamber = cfg.xpipe === "chamber", blower = cfg.induct === "blower", unif = cfg.scav === "uniflow";
      var rg2 = [], ksk = dz ? 0.03 : 0.10;
      for (var e2 = 0; e2 < n; e2++) rg2.push(1 - ksk * (((e2 * 5) % 3) / 2));
      prof.ts = ncyl; prof.name = "Custom two-stroke " + (cfg.layout || lk); prof.tsBlower = blower ? 1 : 0;
      prof.tilt = clamp((dz ? 0.50 : 0.84) + (chamber ? 0.08 : cfg.xpipe === "straight" ? 0.10 : -0.10) + (num(cfg.ePort, 185) - 170) * 0.002, 0.45, 0.99);
      prof.pulseSpread = clamp((dz ? 1.05 : 0.82) - (chamber ? 0.06 : 0), 0.7, 1.2);
      prof.pulseDecay = clamp((dz ? 6.5 : 8.5) + (chamber ? 1.5 : 0), 5, 11);
      prof.attack = dz ? 70 : 80; prof.bankGain = rg2; prof.bankPhase = [0, 0]; prof.bankDelayMs = 0; prof.cylJitter = null;
      prof.lope = dz ? 0 : clamp(0.35 + (chamber ? 0.25 : 0), 0, 0.8);
      prof.ringding = dz ? 0 : clamp(0.45 + (cfg.induct === "piston" ? 0.15 : 0) + (chamber ? 0.15 : 0) - (cfg.tsFuel === "di" ? 0.25 : 0), 0.15, 0.85);
      prof.pipe = chamber && !dz ? { rpm: num(cfg.pipeRpm, 8000), amp: 1 } : cfg.xpipe === "straight" && !dz ? { rpm: num(cfg.pipeRpm, 8000), amp: 0.3 } : null;
      if (!dz && cfg.induct !== "blower") prof.intake = { type: "carb", lo: 260, hi: 900, q: 2.2, g: cfg.induct === "piston" ? 0.50 : 0.42 };   // the carburettor bellmouth rasps
      prof.mech = { tick: dz && unif ? 0.20 : 0.07, whine: blower ? 0.30 : 0.05 };     // no cams on a ported engine; a uniflow Detroit has its rockers
      prof.sub = clamp(0.20 + 0.40 * Math.min(1.3, big) + (dz ? 0.20 : 0), 0.20, 1.0);
      prof.level = clamp((dz ? 1.08 : 1.12) + (cfg.xpipe === "straight" ? 0.06 : cfg.xpipe === "muffled" ? -0.08 : 0), 0.95, 1.22);
      prof.redline = num(cfg.redline, 7000);
    }
    DERIVE_CACHE.key = key; DERIVE_CACHE.prof = prof;
    return prof;
  }

  /* ------------------------------------------------------------------ *
   * 5. Small helpers
   * ------------------------------------------------------------------ */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function num(v, d) { return (typeof v === "number" && isFinite(v)) ? v : d; }

  /* ------------------------------------------------------------------ *
   * 6. PeriodicWave construction from the firing pulse train
   * ------------------------------------------------------------------ */
  var IS_MOBILE = (typeof navigator !== "undefined") && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || "");
  var NSAMP = 1024, NHARM = IS_MOBILE ? 96 : 160;
  var waveCache = Object.create(null);

  var q = function (v, step) { return Math.round(v / step); };
  function waveKey(p, L) {
    // quantised: a listener cannot hear a 1% change in pulse shape, and rebuilding
    // the table costs ~50 ms on desktop and ~250 ms on a phone
    return [p.layout, q(p.pulseSpread, 0.04), q(p.pulseDecay, 0.25),
            p.bankGain.map(function (x) { return q(x, 0.03); }).join(","),
            p.bankPhase.map(function (x) { return q(x, 1.5); }).join(","),
            p.cylJitter ? p.cylJitter.join(",") : "-", q(p.tilt, 0.03)].join("|") + (p.attack ? "|a" + p.attack : "");
  }

  // Returns {real:Float32Array, imag:Float32Array} for createPeriodicWave
  // convert a bank's pipe-length asymmetry into the crank angle it occupies at
  // this engine speed, quantised so we build a handful of tables, not hundreds
  function bankPhaseAt(p, rpm) {
    if (!p.bankDelayMs) return p.bankPhase;
    var band = clamp(Math.round(rpm / 700) * 700, 700, 12600);
    var deg = p.bankDelayMs / 1000 * (band / 60) * 360;
    return [0, clamp(deg, 0, 120)];
  }

  function buildFiringWave(ctx, p, L) {
    var key = waveKey(p, L);
    if (waveCache[key]) return waveCache[key];

    var n = L.n, fo = L.firingOrder, bankOf = L.bankOf;
    var s = new Float32Array(NSAMP);
    var step = 720 / n;
    var wDeg = Math.min(300, step * p.pulseSpread);      // pulse length in crank degrees
    var wN = Math.max(6, Math.round(wDeg / 720 * NSAMP));

    for (var i = 0; i < n; i++) {
      var cyl = fo[i] - 1;
      var b = bankOf[cyl] | 0;
      var amp = (p.bankGain[b] != null ? p.bankGain[b] : 1);
      var ang = i * step + (p.bankPhase[b] || 0) + (p.cylJitter ? (p.cylJitter[i] || 0) : 0);
      var start = Math.round(((ang % 720) + 720) % 720 / 720 * NSAMP);
      for (var j = 0; j < wN; j++) {
        var x = j / wN;
        // fast blowdown edge, exponential tail
        var env = (1 - Math.exp(-x * (p.attack || 26))) * Math.exp(-x * p.pulseDecay);
        s[(start + j) % NSAMP] += amp * env;
      }
    }

    // remove DC
    var dc = 0, k, t;
    for (k = 0; k < NSAMP; k++) dc += s[k];
    dc /= NSAMP;
    for (k = 0; k < NSAMP; k++) s[k] -= dc;

    // DFT -> harmonic coefficients (harmonic k == engine order k/2)
    var real = new Float32Array(NHARM + 1), imag = new Float32Array(NHARM + 1);
    var TW = 2 * Math.PI / NSAMP;
    for (k = 1; k <= NHARM; k++) {
      var re = 0, im = 0, w = TW * k;
      for (t = 0; t < NSAMP; t++) {
        var a = w * t;
        re += s[t] * Math.cos(a);
        im += s[t] * Math.sin(a);
      }
      // spectral tilt: brighter profiles keep more high orders
      var kn = k / (10 + 90 * p.tilt);
      var roll = 1 / (1 + kn * kn * (1.6 - p.tilt));
      real[k] = (2 / NSAMP) * re * roll;
      imag[k] = (2 / NSAMP) * im * roll;
    }

    // normalise to constant RMS so every layout sits at the same loudness
    var rms = 0;
    for (k = 1; k <= NHARM; k++) rms += real[k] * real[k] + imag[k] * imag[k];
    rms = Math.sqrt(rms / 2) || 1;
    var g = 0.26 / rms;
    for (k = 1; k <= NHARM; k++) { real[k] *= g; imag[k] *= g; }

    var wave = ctx.createPeriodicWave(real, imag, { disableNormalization: true });
    wave._coef = { real: real, imag: imag };
    waveCache[key] = wave;
    return wave;
  }

  /* --- wavetable oscillator: a looping single-cycle AudioBuffer driven by playbackRate.
         Used on phones instead of OscillatorNode+PeriodicWave, which WebKit can leave stuck
         on a constant tone. Presents the same surface set()/applyProfile use. --- */
  var WT_LEN = 8192;
  function BufferOsc(ctx) {
    var self = this;
    this.ctx = ctx; this.src = null; this.dest = []; this.started = null; this.buffer = null; this._hz = 20;
    this.frequency = {
      setTargetAtTime: function (v, t, tc) { self._hz = v; if (self.src) self.src.playbackRate.setTargetAtTime(v * WT_LEN / ctx.sampleRate, t, tc); },
      setValueAtTime: function (v, t) { self._hz = v; if (self.src) self.src.playbackRate.setValueAtTime(v * WT_LEN / ctx.sampleRate, t); },
      cancelScheduledValues: function (t) { if (self.src) self.src.playbackRate.cancelScheduledValues(t); },
      get value() { return self._hz; },
      set value(v) { self._hz = v; if (self.src) self.src.playbackRate.value = v * WT_LEN / ctx.sampleRate; }
    };
  }
  BufferOsc.prototype.connect = function (d) { this.dest.push(d); if (this.src) this.src.connect(d); return d; };
  BufferOsc.prototype.disconnect = function () { if (this.src) { try { this.src.disconnect(); } catch (e) {} } };
  BufferOsc.prototype.setPeriodicWave = function (wave) {
    var c = wave && wave._coef; if (!c) return;
    if (wave._pcm && wave._pcmRate === this.ctx.sampleRate) {   // already rendered
      this.buffer = wave._pcm;
      if (this.started !== null) this._swap();
      return;
    }
    var buf = this.ctx.createBuffer(1, WT_LEN, this.ctx.sampleRate), d = buf.getChannelData(0);
    var K = c.real.length - 1, k, i, TW = 2 * Math.PI / WT_LEN;
    for (i = 0; i < WT_LEN; i++) d[i] = 0;
    for (k = 1; k <= K; k++) {
      var a = c.real[k], b = c.imag[k]; if (!a && !b) continue;
      // rotate a unit phasor per sample instead of calling cos/sin 8192 times
      var dc = Math.cos(TW * k), ds = Math.sin(TW * k), cr = 1, ci = 0, tmp;
      for (i = 0; i < WT_LEN; i++) {
        d[i] += a * cr + b * ci;
        tmp = cr * dc - ci * ds; ci = cr * ds + ci * dc; cr = tmp;
      }
    }
    wave._pcm = buf; wave._pcmRate = this.ctx.sampleRate;
    this.buffer = buf;
    if (this.started !== null) this._swap();
  };
  BufferOsc.prototype._swap = function () {
    /* start a fresh source on the new table and fade the old one out over a few ms */
    var old = this.src, t = this.ctx.currentTime;
    this.src = this.ctx.createBufferSource(); this.src.buffer = this.buffer; this.src.loop = true;
    this.src.playbackRate.value = this._hz * WT_LEN / this.ctx.sampleRate;
    for (var i = 0; i < this.dest.length; i++) this.src.connect(this.dest[i]);
    this.src.start(t);
    if (old) { try { old.stop(t + 0.03); } catch (e) {} setTimeout(function () { try { old.disconnect(); } catch (e) {} }, 100); }
  };
  BufferOsc.prototype.start = function (t) { this.started = t || this.ctx.currentTime; if (this.buffer) this._swap(); };
  BufferOsc.prototype.stop = function (t) { var src = this.src; this.src = null; this.started = null; if (src) { try { src.stop(t || this.ctx.currentTime); } catch (e) {} } };

  // rotary chop: eight firing slots, some strong, some weak, some missing — zero-mean, minimum -1, used to gate the exhaust gain
  var brapWave = null;
  function buildBrapWave(ctx) {
    if (brapWave) return brapWave;
    var M = 512, K = 48, slot = [1, -1, 0.55, 0.9, -1, 0.25, 1, -0.6], s = new Float32Array(M), i, k, t, mean = 0, mn = 1e9;
    for (i = 0; i < M; i++) { var x = i / M * 8, si = Math.floor(x), fr = x - si; s[i] = slot[si] * Math.sin(Math.PI * Math.min(1, fr * 1.25)); mean += s[i] / M; }
    for (i = 0; i < M; i++) { s[i] -= mean; if (s[i] < mn) mn = s[i]; }
    var r = new Float32Array(K + 1), im = new Float32Array(K + 1), sc = 1 / Math.max(0.2, -mn);
    for (k = 1; k <= K; k++) { var a = 0, b = 0, w = 2 * Math.PI * k / M;
      for (t = 0; t < M; t++) { a += s[t] * Math.cos(w * t); b += s[t] * Math.sin(w * t); }
      r[k] = 2 / M * a * sc; im[k] = 2 / M * b * sc; }
    brapWave = ctx.createPeriodicWave(r, im, { disableNormalization: true });
    return brapWave;
  }
  // spiky impulse-ish wave for the valvetrain voice
  var mechWave = null;
  function buildMechWave(ctx) {
    if (mechWave) return mechWave;
    var K = 24, r = new Float32Array(K + 1), im = new Float32Array(K + 1);
    for (var k = 1; k <= K; k++) { r[k] = Math.pow(k, -0.85) * 0.1; im[k] = 0; }
    mechWave = ctx.createPeriodicWave(r, im, { disableNormalization: false });
    return mechWave;
  }

  // diesel clack: one sharp spike per combustion (instant rise, fast decay), peak 1.
  // Its DC term is dropped by the periodic wave, so buildGraph/set() add it back as a gain offset
  var clatWave = null, CLAT_MEAN = 0;
  function buildClatterWave(ctx) {
    if (clatWave) return clatWave;
    var M = 512, K = 64, s = new Float32Array(M), r = new Float32Array(K + 1), im = new Float32Array(K + 1), i, k, t;
    for (i = 0; i < M; i++) { s[i] = Math.exp(-i / M * 26); CLAT_MEAN += s[i] / M; }
    for (k = 1; k <= K; k++) { var a = 0, b = 0, w = 2 * Math.PI * k / M;
      for (t = 0; t < M; t++) { a += s[t] * Math.cos(w * t); b += s[t] * Math.sin(w * t); }
      r[k] = 2 / M * a; im[k] = 2 / M * b; }
    clatWave = ctx.createPeriodicWave(r, im, { disableNormalization: true });
    return clatWave;
  }

  // roots blower: strong lobe fundamental + harmonics
  var rootsWave = null;
  function buildRootsWave(ctx) {
    if (rootsWave) return rootsWave;
    var a = [0, 1, 0.55, 0.32, 0.18, 0.10, 0.06];
    rootsWave = ctx.createPeriodicWave(new Float32Array(a), new Float32Array(a.length),
      { disableNormalization: false });
    return rootsWave;
  }

  /* ------------------------------------------------------------------ *
   * 7. Static buffers (noise, garage impulse) + waveshaper curve
   * ------------------------------------------------------------------ */
  var noiseBuf = null, irBuf = null, shapeCurve = null;

  function makeNoise(ctx) {
    if (noiseBuf) return noiseBuf;
    var len = Math.floor(ctx.sampleRate * 2);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;       // gently pinked
      d[i] = w * 0.7 + last * 3.2;
    }
    return noiseBuf;
  }

  function makeIR(ctx) {
    if (irBuf) return irBuf;
    var dur = 0.4, len = Math.floor(ctx.sampleRate * dur);
    irBuf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = irBuf.getChannelData(c);
      for (var i = 0; i < len; i++) {
        var t = i / len;
        // concrete shop: a couple of early slaps then a fast decay
        var e = Math.pow(1 - t, 2.6);
        var slap = (Math.abs(i - len * 0.11) < 90 || Math.abs(i - len * 0.23) < 90) ? 2.2 : 1;
        d[i] = (Math.random() * 2 - 1) * e * slap * 0.5;
      }
    }
    return irBuf;
  }

  function makeCurve() {
    if (shapeCurve) return shapeCurve;
    var N = 2048;
    shapeCurve = new Float32Array(N);
    for (var i = 0; i < N; i++) {
      var x = (i / (N - 1)) * 2 - 1;
      // asymmetric soft clip -> even harmonics, exhaust "rasp"
      var y = Math.tanh(2.2 * x + 0.35 * x * x);
      shapeCurve[i] = y / Math.tanh(2.55);
    }
    return shapeCurve;
  }

