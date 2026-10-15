#!/usr/bin/env node
/* Prairie Engine Works: checks for the Back up / Restore save codes (src/app/savecode.js).
 *
 *   node check-savecode.js        run every check, print one line each, exit 1 if any fail
 *
 * It loads src/app/savecode.js on its own with a pretend localStorage and small stand-ins for the game functions it
 * calls (snapshot, hydrate, ...), so it runs in plain node with no browser. decodeSave (the older PEW2 codes) is the real
 * one, copied out of src/app/state.js. It also makes sure index.html was rebuilt with the current savecode.js.
 * Zero dependencies (node >= 16).
 */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert");
const ROOT = __dirname, SRC = path.join(ROOT, "src", "app", "savecode.js"), STATE = path.join(ROOT, "src", "app", "state.js");

/* ---- a pretend browser: localStorage in a Map, plus the game bits savecode.js calls ---- */
function fakeStorage() {
  const m = new Map();
  return {
    quota: Infinity,   // like a real browser's storage limit: a setItem that would go over it throws
    used: () => [...m].reduce((n, [k, v]) => n + k.length + v.length, 0),
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem(k, v) { v = String(v); const was = m.has(k) ? k.length + m.get(k).length : 0;
      if (this.used() - was + k.length + v.length > this.quota) throw new Error("QuotaExceededError"); m.set(k, v); },
    removeItem: k => { m.delete(k); },
    clear: () => m.clear(),
    dump: () => Object.fromEntries([...m].sort())
  };
}
function load() {
  const code = fs.readFileSync(SRC, "utf8");
  const dec = /^function decodeSave\(.*$/m.exec(fs.readFileSync(STATE, "utf8"));
  if (!dec) throw new Error("decodeSave not found in src/app/state.js");
  const ctx = {
    localStorage: fakeStorage(), TextEncoder, TextDecoder, Uint8Array, atob, btoa, escape, unescape,
    SLOTS: 3, slotKey: i => "pew2-slot" + i, LG_KEY: "pew2-legacy", VERSION: "test",
    S: null, suC: null, LG: null, live: null,
    snapshot() { return JSON.parse(JSON.stringify(ctx.live)); },
    /* like the real hydrate: false without a cfg, and it trips over a career whose contracts aren't a list */
    hydrate(o) { if (!o || !o.cfg) return false; ctx.S = Object.assign({}, o); const c = Object.assign({ contracts: [] }, o.career || {}); if (c.contracts.length > 99) c.contracts = []; return true; },
    fmt$: n => "$" + Math.round(n)
  };
  vm.createContext(ctx);
  vm.runInContext(dec[0] + "\n" + code, ctx, { filename: "savecode.js" });
  return ctx;
}

/* ---- realistic saves ---- */
function game(over) {
  return Object.assign({
    mode: "career", name: "Prairie 383 · Bogotá taxi 🚕", seen: true, theme: "light", vol: 35, psi: true, haptics: false, sound: true,
    cfg: { layout: "V8", bore: 101.6, stroke: 88.4, heads: "alu", injectors: "inj42", fuelPump: "p255" },
    env: { testType: "drag", ambientC: 20, altitudeM: 500 },
    blueprints: [{ name: "Torque monster", cfg: { layout: "I6", bore: 95 } }],
    career: { cash: 48250, rep: 312, week: 27, loan: 0, owned: { dyno2: true, flow: true }, contracts: [{ id: "c1", deposit: 0 }],
      log: [{ w: 26, t: "Strip: 11.92 @ 114", k: "good" }], fleet: [], inbox: [], goals: {}, staff: {}, rnd: {}, unlocks: {}, prestige: {} },
    last: { hash: "abc123", cfg: { layout: "V8" }, label: "383 stroker", res: { hp: 612.4, tq: 588.1, curve: Array.from({ length: 60 }, (_, i) => [1000 + i * 100, 300 + i * 4.25]) } }
  }, over || {});
}
const seed = st => {
  st.clear();
  st.setItem("pew2-save", JSON.stringify(game()));
  st.setItem("pew2-slot1", JSON.stringify(Object.assign(game({ mode: "sandbox" }), { savedAt: 1760000000000 })));
  st.setItem("pew2-slot3", JSON.stringify(Object.assign(game({ career: Object.assign(game().career, { week: 3, cash: 9000 }) }), { savedAt: 1760100000000 })));
  st.setItem("pew2-legacy", JSON.stringify({ v: 1, pts: 7, total: 9, resets: 2, best: { cash: 1e6, rep: 900, hp: 1500, sold: 40, week: 80, value: 2e6 }, perk: { cash: 1 }, pick: {}, pending: false }));
};
const plain = o => JSON.parse(JSON.stringify(o));   // objects made inside the vm have their own Object/Array, so copy them out before comparing
const msg = (ctx, text) => { try { ctx.buRead(text); } catch (e) { return e.bu || "crash:" + e.message; } return "ok"; };
const KEYS = ["pew2-save", "pew2-slot1", "pew2-slot2", "pew2-slot3", "pew2-legacy"];

/* ---- the checks ---- */
const checks = [];
const check = (name, fn) => checks.push([name, fn]);

check("index.html carries the current savecode.js (run `node build.js` if not)", () => {
  assert(fs.readFileSync(path.join(ROOT, "index.html"), "utf8").includes(fs.readFileSync(SRC, "utf8")));
});
check("round trip: everything comes back on a fresh browser", () => {
  const a = load(); seed(a.localStorage); a.live = game();
  const code = a.buCode(), before = a.localStorage.dump();
  assert(code.startsWith("PEW1:") && /^PEW1:[A-Za-z0-9_-]+$/.test(code), "only base64url characters after PEW1:");
  const b = load();   // another phone: nothing saved yet
  const r = b.buRead(code);
  assert.strictEqual(r.kind, "full");
  assert.deepStrictEqual(plain(r.data.save), game());
  assert.strictEqual(r.data.slots.length, 3);
  assert.strictEqual(r.data.slots[1], null, "empty slot 2 stays empty");
  assert(b.buWrite(r.data));
  assert.deepStrictEqual(Object.keys(b.localStorage.dump()).sort(), KEYS.filter(k => k !== "pew2-slot2").sort());
  for (const k of ["pew2-slot1", "pew2-slot3", "pew2-legacy"]) assert.deepStrictEqual(JSON.parse(b.localStorage.getItem(k)), JSON.parse(before[k]), k);
  assert.deepStrictEqual(JSON.parse(b.localStorage.getItem("pew2-save")), game());
});
check("code is much shorter than the save it holds", () => {
  const a = load(); seed(a.localStorage); a.live = game();
  const raw = JSON.stringify(a.buMake()).length, code = a.buCode().length;
  assert(code < raw * 0.75, `code ${code} vs JSON ${raw}`);
});
check("spaces, line breaks and text around the code are fine", () => {
  const a = load(); seed(a.localStorage); a.live = game();
  const code = a.buCode(), mid = code.length >> 1;
  const messy = "here's my save:\n  " + code.slice(0, mid) + "\n \u200B" + code.slice(mid, mid + 40) + "  " + code.slice(mid + 40) + '" thanks!';
  assert.strictEqual(a.buRead(messy).kind, "full");
});
check("a damaged code is rejected (one character changed)", () => {
  const a = load(); seed(a.localStorage); a.live = game();
  const code = a.buCode();
  for (const at of [6, code.length >> 1, code.length - 3]) {
    const c = code[at] === "A" ? "B" : "A";
    assert.strictEqual(msg(a, code.slice(0, at) + c + code.slice(at + 1)), "damaged", "changed at " + at);
  }
});
check("a cut-off code is rejected", () => {
  const a = load(); seed(a.localStorage); a.live = game();
  const code = a.buCode();
  for (const n of [1, 6, 7, 50, code.length >> 1, code.length - 6]) assert.strictEqual(msg(a, code.slice(0, code.length - n)), "damaged", "cut " + n);
  assert.strictEqual(msg(a, code.slice(0, 200) + code.slice(260)), "damaged", "chunk missing from the middle");
  assert.strictEqual(msg(a, "PEW1:"), "damaged");
});
check("a code from another game is rejected", () => {
  const a = load();
  assert.strictEqual(msg(a, "GG1:CYQwLiBcIAQBYA6s9ccc5z"), "other");
  assert.strictEqual(msg(a, "RS2:abcdef123456"), "other");
});
check("a code from a newer version gets its own message", () => {
  const a = load(); a.live = game();
  const body = a.buCode().slice(5);
  assert.strictEqual(msg(a, "PEW3:" + body), "newer");
  assert.strictEqual(msg(a, "PEW12:" + body), "newer");
});
check("empty and junk pastes get a friendly message, never a crash", () => {
  const a = load();
  assert.strictEqual(msg(a, ""), "empty");
  assert.strictEqual(msg(a, "   \n "), "empty");
  assert.strictEqual(msg(a, null), "empty");
  assert.strictEqual(msg(a, "hello there"), "notcode");
  assert.strictEqual(msg(a, "PEW1:!!!!!!!!!!!!"), "damaged");
  assert.strictEqual(msg(a, "PEW0:" + "A".repeat(20)), "notcode");
});
check("an empty save (brand-new player) round trips, and restoring it clears slots and Legacy", () => {
  const a = load(); a.live = { mode: null, cfg: { layout: "V8" }, env: {}, blueprints: [], career: { cash: 20000, rep: 0, week: 1 } };
  const code = a.buCode(), r = a.buRead(code).data;
  assert.deepStrictEqual(plain(r.slots), [null, null, null]);
  assert.strictEqual(r.legacy, null);
  const b = load(); seed(b.localStorage);
  assert(b.buWrite(r));
  assert.deepStrictEqual(Object.keys(b.localStorage.dump()), ["pew2-save"]);
});
const pack = (a, d) => { const body = a.buZip(new TextEncoder().encode(JSON.stringify(d))); return "PEW1:" + body + a.buSum(body); };
check("a well-formed code with a broken save inside is refused and nothing is written", () => {
  const a = load(); seed(a.localStorage); const before = a.localStorage.dump();
  const bad = [
    { v: 1, save: { career: {} }, slots: [], legacy: null },                                   // no cfg
    { v: 1, save: game(), slots: [null, null, null, null], legacy: null },                      // too many slots
    { v: 1, save: game(), slots: [{ cfg: "V8" }], legacy: null },                               // slot cfg not an object
    { v: 1, save: game({ career: { cash: "lots" } }), slots: [], legacy: null },                // cash not a number
    { v: 1, save: game({ career: { contracts: { 0: 1 } } }), slots: [], legacy: null },          // contracts not a list
    { v: 1, save: game({ blueprints: "none" }), slots: [], legacy: null },
    { v: 1, save: game(), slots: [], legacy: { pts: -5 } },
    { v: 1, save: game(), slots: [], legacy: [1, 2] },
    { v: 2, save: game(), slots: [], legacy: null },
    [game()], "just a string", 42, null
  ];
  for (const d of bad) assert.strictEqual(msg(a, pack(a, d)), "bad", JSON.stringify(d).slice(0, 80));
  assert.strictEqual(msg(a, pack(a, { v: 1, save: game(), slots: [], legacy: null })), "ok", "and the same thing done right passes");
  assert.deepStrictEqual(a.localStorage.dump(), before);
});
check("older PEW2 one-game codes still load as the current game", () => {
  const a = load();
  const old = "PEW2:" + Buffer.from(JSON.stringify(game())).toString("base64");
  const r = a.buRead(old);
  assert.strictEqual(r.kind, "one");
  assert.deepStrictEqual(plain(r.save), game());
  assert.strictEqual(a.buRead(old.slice(5)).kind, "one", "pasted without its PEW2:");
  assert.strictEqual(msg(a, old.slice(0, old.length - 30)), "damaged");
  assert.strictEqual(msg(a, "PEW2:" + Buffer.from('{"cfg":{},"career":{"cash":"x"}}').toString("base64")), "bad");
});
check("a write that fails half way (storage full) puts every key back the way it was", () => {
  const a = load(); seed(a.localStorage); a.localStorage.setItem("pew2-slot2", '{"cfg":{"layout":"I4"}}');
  const before = a.localStorage.dump();
  const huge = game({ blueprints: Array.from({ length: 400 }, (_, i) => ({ name: "bp" + i, cfg: { bore: i } })) });
  const r = { v: 1, save: game({ vol: 99 }), slots: [game(), null, huge], legacy: null };   // slot 3 won't fit
  a.localStorage.quota = a.localStorage.used() + 2000;
  assert.strictEqual(a.buWrite(r), false);
  assert.deepStrictEqual(a.localStorage.dump(), before);
  a.localStorage.quota = Infinity;
  assert.strictEqual(a.buWrite(r), true);
  assert.deepStrictEqual(JSON.parse(a.localStorage.getItem("pew2-slot3")), huge);
});
check("trial load never changes the running game", () => {
  const a = load(); a.live = game(); const running = { mode: "career", cfg: { layout: "flat4" } };
  a.S = running; a.suC = running.cfg;
  a.buRead(a.buCode());
  assert.strictEqual(a.S, running); assert.strictEqual(a.suC, running.cfg);
});
check("packing survives big, varied saves (LZW dictionary fills up)", () => {
  const a = load();
  let x = 12345; const rnd = () => (x = (x * 1103515245 + 12345) >>> 0) / 4294967296;
  const big = game({ blueprints: Array.from({ length: 4000 }, (_, i) => ({ name: "bp" + i + "_" + rnd().toString(36), cfg: { bore: rnd() * 200, stroke: rnd() * 150, note: "é ü 🚗 " + i } })) });
  a.live = big;
  const code = a.buCode();
  assert.deepStrictEqual(plain(a.buRead(code).data.save), big);
  const bytes = new TextEncoder().encode("abababababababababab");
  assert.deepStrictEqual(Array.from(a.buUnzip(a.buZip(bytes))), Array.from(bytes), "KwKwK case");
  assert.deepStrictEqual(plain(a.buUnzip(a.buZip(new Uint8Array(0)))), []);
});

let bad = 0;
for (const [name, fn] of checks) {
  try { fn(); console.log("ok   " + name); }
  catch (e) { bad++; console.log("FAIL " + name + "\n     " + String(e && e.message || e).split("\n").join("\n     ")); }
}
console.log(bad ? `\n${bad} of ${checks.length} checks failed` : `\nall ${checks.length} save code checks passed`);
process.exit(bad ? 1 : 0);
