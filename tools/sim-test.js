#!/usr/bin/env node
/* Prairie Engine Works: the sim regression check.
 *
 *   node tools/sim-test.js             run ten fixed engines through the dyno and every event, compare with tools/sim-baseline.json;
 *                                      lists every number that moved (before -> after, %) and exits 1 if any did
 *   node tools/sim-test.js --update    accept the current numbers as the new baseline (do this in the commit that means to move them,
 *                                      and paste the list of what moved into the commit message)
 *   node tools/sim-test.js --only drag only the cases whose name contains "drag" (an event, an engine id, or "sbc350/drag")
 *   node tools/sim-test.js --tol 0.5   tolerance in percent (default 0.05: enough to ignore last-digit float noise between node versions)
 *
 * What it is for: a change meant for one event (a drag tyre, the pull sled) can quietly move another, because the events share the
 * engine model, the drivetrain and the auto drivers. This runs them all and shows exactly what moved. It reads the physics out of the
 * built index.html, so run `node build.js` first. Every run is seeded: Math.random is replaced with a fixed generator, restarted
 * before each case, so two runs of the same code give the same numbers.
 * Not part of `node build.js --check`: a deliberate physics change is supposed to fail it until the baseline is updated.
 * Zero dependencies. */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, ".."), BASE = path.join(__dirname, "sim-baseline.json");
const arg = process.argv.slice(2), has = f => arg.includes(f), val = f => { const i = arg.indexOf(f); return i >= 0 ? arg[i + 1] : null; };
const ONLY = val("--only"), TOL = (val("--tol") != null ? +val("--tol") : 0.05) / 100;

/* the physics block of the built page (it ends with module.exports = ENGINE_SIM) */
function loadSim() {
  const h = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), i = h.indexOf("Prairie Engine Works v2 — physics core");
  if (i < 0) throw new Error("index.html has no physics block; run node build.js");
  const m = { exports: {} };
  vm.runInThisContext("(function(module,exports){" + h.slice(h.lastIndexOf("<script>", i) + 8, h.indexOf("</script>", i)) + "\n})", { filename: "sim (index.html)" })(m, m.exports);
  return m.exports;
}
const SIM = loadSim();
/* seeded randomness: mulberry32, restarted for each case */
let rs = 1;
const reseed = n => { rs = (n >>> 0) || 1; };
Math.random = () => { rs = (rs + 0x6D2B79F5) | 0; let t = Math.imul(rs ^ (rs >>> 15), 1 | rs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/* ten engines that between them cover the engine model: small and big, every kind of induction, petrol, methanol and diesel,
   a rotary, a two-stroke and the opposed-piston Deltic */
const ENGINES = ["sbc350", "k20a", "2jzgte", "hellcat", "v12_65", "outlaw_radial", "c59_12v", "13b_rew", "yz125", "deltic"];
const idleOf = cfg => SIM.isDiesel(cfg) ? 720 : Math.max(750, cfg.cam > 70 ? 1100 : 850);
const r3 = v => v == null || !isFinite(v) ? null : +(+v).toPrecision(6);

/* each case: name -> function(cfg, env, res) returning {metric: number}. res is the dyno result the event preps start from.
   The cars are plain class defaults, so the numbers move only when the physics does. */
const CASES = {
  dyno(cfg, env, res) { return { hp: res.peakHp, tq: res.peakTq, hpRpm: res.peakHpRpm, tqRpm: res.peakTqRpm }; },
  drag(cfg, env) {
    const R = SIM.dragPrep(cfg, env), veh = { mass: 1500, rearBias: 0.52, tyre: "drag_radial", tyreDia: 28, gears: 4, first: 2.9, top: 1, final: 3.7, launchRpm: Math.min(3500, cfg.redline * 0.6), auto: true, redline: cfg.redline, noFail: true };
    const a = SIM.dragPass(R, veh), b = SIM.dragPass(R, Object.assign({}, veh, { drive: "auto", seed: 7 }));
    return { et: a.et, mph: a.mph, sixty: a.sixty && a.sixty.t, spin: a.spinTime, autoEt: b.et, autoMph: b.mph, autoSixty: b.sixty && b.sixty.t };
  },
  pull(cfg, env) {
    const k = SIM.isDiesel(cfg) ? "smoker26" : "gas", C = SIM.PULL_CLASSES[k], R = SIM.dragPrep(cfg, env);
    const veh = { cls: k, gear: 2, tyre: Object.keys(SIM.PULL_TYRES)[0], hitch: 0.5, ballast: 0.5, psi: 14, thrMax: 1, ballPos: 0.5, redline: cfg.redline, idle: idleOf(cfg), seed: 7 };
    const a = SIM.pullPass(R, veh, "auto"), b = SIM.pullPass(R, veh, "feather");
    return { autoFt: a.distFt, featherFt: b.distFt, autoFull: a.full ? 1 : 0, cls: Object.keys(SIM.PULL_CLASSES).indexOf(k) };
  },
  bog(cfg, env) {
    const R = SIM.bogPrep(cfg, env), n = SIM.bogNight(7), out = {};
    for (const k of ["street", "super"]) { const r = SIM.bogPass(R, { cls: k, gear: 2, tyre: Object.keys(SIM.BOG_TYRES)[0], redline: cfg.redline, idle: idleOf(cfg), pit: n, len: n.len, cons: n.cons, depth: n.depth, seed: 7 }, 1); out[k + "Ft"] = r.distFt != null ? r.distFt : r.dist; out[k + "T"] = r.t != null ? r.t : r.time; out[k + "Clear"] = r.cleared ? 1 : 0; }
    return out;
  },
  boat(cfg, env) {
    const R = SIM.boatPrep(cfg, env), out = {};
    for (const k of ["outboard", "pro"]) { const g = SIM.boatGuess ? SIM.boatGuess(R, k) : {}; const r = SIM.boatPass(R, Object.assign({ cls: k, redline: cfg.redline, idle: idleOf(cfg) }, g), 1); out[k + "Et"] = r.et; out[k + "Mph"] = r.mph; out[k + "Ft"] = r.distFt; out[k + "Broke"] = r.broke ? 1 : 0; }
    return out;
  },
  salt(cfg, env) {
    const R = SIM.lsrPrep(cfg, env), out = {};
    for (const k of ["roadster", "streamliner"]) {
      const v = { body: k, course: "long", redline: cfg.redline, aero: true, ballast: 0, cooling: k === "streamliner" ? "ice" : "radiator", chute: "dual", idle: idleOf(cfg) }; v.topMph = SIM.lsrGearing(R, v);
      const r = SIM.lsrPass(R, v); out[k + "Mile"] = r.mileMph; out[k + "Peak"] = r.peakMph; out[k + "Broke"] = r.broke ? 1 : 0;
    }
    return out;
  },
  road(cfg, env, res) {
    const R = SIM.roadPrep(cfg, res), out = {};
    for (const [ch, tk] of [["coupe", "club"], ["super", "gp"]]) { const L = SIM.lapSim(R, { ch, tyre: SIM.CHASSIS[ch].tyre, finalK: 1 }, tk); out[ch + "Lap"] = L.time != null ? L.time : L.lap; out[ch + "Vmax"] = L.vmax; }
    return out;
  },
  hill(cfg, env) {
    const P = SIM.hillPrep(cfg, env), r = SIM.hillPass(P, { cls: "open", ch: "rally", tyre: Object.keys(SIM.HILL_TYRES)[0], aero: Object.keys(SIM.HILL_AERO)[0], finalK: 1, seed: 7 });
    return { time: r.time != null ? r.time : r.t, dnf: r.dnf ? 1 : 0, vmax: r.vmax };
  },
  oval(cfg, env) {
    const R = SIM.ovalPrep(cfg, env), tk = SIM.ovalTrack("clay"), p = SIM.ovalPass(R, { cls: "street", track: tk, laps: 4, seed: 7, redline: cfg.redline }, 1), r = p.result ? p.result() : p.st;
    return { time: r.time != null ? r.time : r.t, best: r.best, laps: Array.isArray(r.laps) ? r.laps.length : r.laps };
  },
  e24(cfg, env) {
    const me = SIM.enduroPrep(cfg, env, { ch: "coupe", tyre: SIM.CHASSIS.coupe.tyre, finalK: 1 }, "club", true), R = SIM.enduroNew({ seed: 7, track: "club", me });
    SIM.enduroStep(R, 2 * 3600); const mine = R.cars.find(c => c.me), res = SIM.enduroResult(R);
    const Rc = SIM.enduroNew({ seed: 7, track: "club", me, plan: { auto: true } }); SIM.enduroStep(Rc, 2 * 3600); const mc = Rc.cars.find(c => c.me);   // the same two hours with the crew chief on the pit wall
    return { laps2h: mine.laps, best: mine.best, pos2h: (Array.isArray(res) ? res : res.res || []).findIndex(x => x.me) + 1, chiefLaps2h: mc.laps, chiefTyre: mc.tyre.c };
  },
};

function run() {
  const out = {}, errs = [], P = SIM.PRESETS;
  for (const id of ENGINES) {
    const pre = (Array.isArray(P) ? P : Object.values(P)).find(p => p.id === id);
    if (!pre) { errs.push(id + ": no such base engine"); continue; }
    const cfg = Object.assign({}, SIM.DEFAULT_CFG, pre.cfg), env = Object.assign({}, SIM.DEFAULT_ENV);
    reseed(1); const res = SIM.simulate(cfg, Object.assign({}, env, { testType: "pull" }));
    for (const c of Object.keys(CASES)) {
      if (ONLY && !(id + "/" + c).includes(ONLY)) continue;
      reseed(7);
      try { const r = CASES[c](cfg, env, res); for (const k in r) out[id + "/" + c + "." + k] = typeof r[k] === "number" ? r3(r[k]) : r[k] == null ? null : r[k]; }
      catch (e) { errs.push(id + "/" + c + ": " + (e && e.message || e)); out[id + "/" + c + ".error"] = 1; }
    }
  }
  return { out, errs };
}

const t0 = Date.now(), { out, errs } = run(), n = Object.keys(out).length;
for (const e of errs) console.error("error: " + e);
if (has("--print")) { for (const k in out) console.log(k.padEnd(34) + out[k]); process.exit(0); }
if (has("--update")) {
  if (ONLY) { console.error("--update needs the full run (drop --only)"); process.exit(1); }
  const old = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, "utf8")) : null;
  fs.writeFileSync(BASE, JSON.stringify(out, null, 1) + "\n");
  console.log("baseline written: " + n + " numbers (" + path.relative(ROOT, BASE) + ")");
  if (old) report(old, out, true);
  process.exit(errs.length ? 1 : 0);
}
if (!fs.existsSync(BASE)) { console.error("no baseline yet: node tools/sim-test.js --update"); process.exit(1); }
const moved = report(JSON.parse(fs.readFileSync(BASE, "utf8")), out, false);
console.log((moved ? moved + " of " : "all ") + n + " sim numbers " + (moved ? "moved" : "match the baseline") + " (" + ((Date.now() - t0) / 1000).toFixed(1) + " s)");
if (moved) console.log("If that was meant: node tools/sim-test.js --update, and put the list above in the commit message.");
process.exit(moved || errs.length ? 1 : 0);

function report(a, b, quiet) {
  let m = 0;
  for (const k of Object.keys(b)) {
    if (!(k in a)) { console.log("new    " + k.padEnd(34) + b[k]); m++; continue; }
    const x = a[k], y = b[k];
    if (x === y) continue;
    if (typeof x === "number" && typeof y === "number" && Math.abs(y - x) <= TOL * Math.max(Math.abs(x), Math.abs(y), 1e-9)) continue;
    const pc = typeof x === "number" && typeof y === "number" && x ? " (" + ((y - x) / Math.abs(x) * 100 >= 0 ? "+" : "") + ((y - x) / Math.abs(x) * 100).toFixed(2) + "%)" : "";
    console.log("moved  " + k.padEnd(34) + x + " -> " + y + pc); m++;
  }
  if (!ONLY) for (const k of Object.keys(a)) if (!(k in b)) { console.log("gone   " + k); m++; }
  return m;
}
