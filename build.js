#!/usr/bin/env node
/* Prairie Engine Works: build index.html from src/.
 *
 *   Edit src/, run `node build.js`, commit both src/ and index.html. Never hand-edit index.html.
 *
 *   node build.js                 concatenate the files listed in src/manifest.txt into index.html
 *   node build.js --check         exit 1 if index.html is not exactly what src/ builds (names the first differing src file)
 *   node build.js --absorb <edited.html> <base.html>
 *                                 port a branch that still edits the old single-file index.html: diff base -> edited,
 *                                 write each hunk into the src file that holds those lines, rebuild, verify byte for byte
 *   node build.js --split <cuts.txt> [--force]
 *                                 one-off helper that sliced index.html into src/ (cuts.txt: "<first line> <src path>" per row)
 *
 * The build is plain byte concatenation: no wrappers, no reformatting, line endings and the (missing) final newline pass
 * through as they are. Files are slices of one page, so a .js file may open or close mid-IIFE and the first/last file of
 * each <script> block carries the <script>/</script> line. File map and workflow: src/README.md.
 *
 * Merge conflict in index.html: resolve the conflict in src/ (never hand-merge index.html), then rebuild. Once src/ has no
 * conflicts, `git checkout --theirs index.html && node build.js` is fine: the build overwrites it either way.
 * Zero dependencies (node >= 14); --absorb also calls `git` for the diff.
 */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");
const ROOT = __dirname, SRC = path.join(ROOT, "src"), OUT = path.join(ROOT, "index.html"), MAN = path.join(SRC, "manifest.txt");
const NL = 10;

function die(msg, code) { console.error("build.js: " + msg); process.exit(code || 1); }

function manifest() {
  if (!fs.existsSync(MAN)) die("missing " + path.relative(ROOT, MAN));
  const list = fs.readFileSync(MAN, "utf8").split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
  const seen = new Set();
  for (const p of list) { if (seen.has(p)) die("manifest lists " + p + " twice"); seen.add(p); }
  return list;
}

/* every source file under src/ must be in the manifest (a new file nobody listed would silently drop out of the build) */
function orphans(list) {
  const want = new Set(list), out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name), r = path.relative(SRC, f).split(path.sep).join("/");
      if (e.isDirectory()) walk(f);
      else if (r !== "manifest.txt" && !/\.md$/i.test(r) && !want.has(r)) out.push(r);
    }
  })(SRC);
  return out;
}

const MARK = /^(<<<<<<<|>>>>>>>) /m;
function parts(list) {
  list = list || manifest();
  const lost = orphans(list);
  if (lost.length) die("src files not in src/manifest.txt (add them or delete them): " + lost.join(", "));
  return list.map((p, i) => {
    const f = path.join(SRC, p);
    if (!fs.existsSync(f)) die("manifest lists src/" + p + " but the file does not exist");
    const b = fs.readFileSync(f);
    if (!b.length) die("src/" + p + " is empty");
    if (i < list.length - 1 && b[b.length - 1] !== NL) die("src/" + p + " must end with a newline (it is not the last file)");
    if (MARK.test(b.toString("latin1"))) die("src/" + p + " has merge-conflict markers; resolve them first");
    return { p, b };
  });
}
function build(ps) { ps = ps || parts(); return Buffer.concat(ps.map(x => x.b)); }

function lineAt(buf, off) { let n = 1; for (let i = 0; i < off && i < buf.length; i++) if (buf[i] === NL) n++; return n; }
/* split a buffer into lines that keep their "\n" (the last one may not have it) */
function lines(buf) {
  const out = []; let s = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] === NL) { out.push(buf.subarray(s, i + 1)); s = i + 1; }
  if (s < buf.length) out.push(buf.subarray(s));
  return out;
}

function firstDiff(a, b) { const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i; return a.length === b.length ? -1 : n; }

function where(ps, off) {
  let at = 0;
  for (const x of ps) { if (off < at + x.b.length) return { p: x.p, line: lineAt(x.b, off - at) }; at += x.b.length; }
  const last = ps[ps.length - 1]; return { p: last.p, line: lineAt(last.b, last.b.length) + 1, end: true };
}

function cmdBuild() {
  const ps = parts(), out = build(ps);
  const old = fs.existsSync(OUT) ? fs.readFileSync(OUT) : null;
  if (old && old.equals(out)) { console.log(`index.html unchanged (${out.length} bytes, ${ps.length} files)`); return; }
  fs.writeFileSync(OUT, out);
  console.log(`index.html written (${out.length} bytes, ${ps.length} files)`);
}

function cmdCheck() {
  const ps = parts(), out = build(ps);
  if (!fs.existsSync(OUT)) die("index.html is missing; run node build.js");
  const cur = fs.readFileSync(OUT), d = firstDiff(out, cur);
  if (d < 0) { console.log(`ok: index.html matches src/ (${out.length} bytes, ${ps.length} files)`); return; }
  const w = where(ps, d);
  console.error(`build.js --check: index.html differs from the src/ build (built ${out.length} bytes, index.html ${cur.length}).`);
  console.error(`  first difference: src/${w.p} line ${w.line}${w.end ? " (past the end of the build)" : ""} = index.html line ${lineAt(cur, d)}`);
  console.error("  If src/ is right: node build.js. If index.html was hand-edited: move the edit into src/ (or use --absorb), then rebuild.");
  process.exit(1);
}

/* ---- --absorb: port an edit made on the old single-file index.html into src/ ---- */
function git(args, opts) { return cp.spawnSync("git", args, Object.assign({ maxBuffer: 1 << 30 }, opts || {})); }
let TMP = null, keepTmp = false;
function tmpWrite(name, buf) {
  if (!TMP) { TMP = fs.mkdtempSync(path.join(os.tmpdir(), "pew-absorb-")); process.on("exit", () => { if (!keepTmp) try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }); }
  const f = path.join(TMP, name); fs.writeFileSync(f, buf); return f;
}

function cmdAbsorb(editedPath, basePath) {
  if (!editedPath || !basePath) die("usage: node build.js --absorb <edited index.html> <base index.html>");
  const edited = fs.readFileSync(editedPath), base = fs.readFileSync(basePath);
  const ps = parts(), cur = build(ps);
  let target = edited;
  if (!cur.equals(base)) {
    /* src/ has moved on since the branch's base (a version bump, other merges): three-way merge the whole page first,
       then absorb current -> merged. Overlapping edits stop here; nothing in src/ is touched. */
    const fo = tmpWrite("current.html", cur), fb = tmpWrite("base.html", base), ft = tmpWrite("edited.html", edited);
    const r = git(["merge-file", "-p", "-L", "src-build", "-L", "base", "-L", "edited", fo, fb, ft]);
    if (r.status !== 0) {
      const keep = tmpWrite("merged-with-conflicts.html", r.stdout || Buffer.alloc(0)); keepTmp = true;
      die(`src/ no longer builds the base, and the three-way merge of base -> edited onto it has ${r.status > 0 ? r.status + " conflict(s)" : "failed: " + String(r.stderr)}.\n` +
          `  Conflicted page: ${keep}\n  Resolve by porting those hunks by hand in src/, or absorb onto the src/ commit whose build equals the base, then git merge.`);
    }
    target = r.stdout;
    console.log("src/ build differs from base: merged base -> edited onto the current src/ build (no conflicts).");
  }
  const curL = lines(cur), tgtL = lines(target);
  /* which file owns each line of the current build */
  const owner = [], startOf = []; // owner[line0] = part index; startOf[k] = first line0 of part k
  ps.forEach((x, k) => { startOf.push(owner.length); const n = lines(x.b).length; for (let i = 0; i < n; i++) owner.push(k); });
  const fc = tmpWrite("a.html", cur), ft = tmpWrite("b.html", target);
  const d = git(["-c", "core.autocrlf=false", "-c", "core.quotepath=off", "diff", "--no-index", "--no-color", "--no-ext-diff", "--text",
                 "--histogram", "-U0", fc, ft]);
  if (d.status !== 0 && d.status !== 1) die("git diff failed: " + String(d.stderr));
  const hunks = [];
  for (const m of String(d.stdout).matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)) {
    const a = +m[1], b = m[2] == null ? 1 : +m[2], c = +m[3], e = m[4] == null ? 1 : +m[4];
    hunks.push({ a0: b ? a - 1 : a, b, c0: e ? c - 1 : c, e }); // 0-based start of the old/new range (insert: before a0)
  }
  if (!hunks.length) { console.log("nothing to absorb: the edited page already equals the src/ build"); return; }
  /* per-file new line arrays, rebuilt from the current lines plus the hunks */
  const edits = ps.map(() => []);   // [{from, to, add:[lines]}] in file-local 0-based lines
  const notes = [];
  for (const h of hunks) {
    const add = tgtL.slice(h.c0, h.c0 + h.e);
    if (h.b === 0) {
      /* pure insertion before current line a0: belongs to the file holding the line above it (earlier file at a boundary) */
      const k = h.a0 === 0 ? 0 : owner[h.a0 - 1];
      const at = h.a0 - startOf[k];
      if (h.a0 > 0 && h.a0 < owner.length && owner[h.a0] !== k) notes.push(`insertion at the boundary ${ps[k].p} | ${ps[owner[h.a0]].p} -> end of ${ps[k].p}`);
      edits[k].push({ from: at, to: at, add });
      continue;
    }
    const k0 = owner[h.a0], k1 = owner[h.a0 + h.b - 1];
    if (k0 === k1) { edits[k0].push({ from: h.a0 - startOf[k0], to: h.a0 + h.b - startOf[k0], add }); continue; }
    /* straddles a boundary: the new text goes to the earlier file, the later file only loses its covered lines */
    if (k1 - k0 > 1) die(`ambiguous hunk at index.html line ${h.a0 + 1} (-${h.b} +${h.e}): it covers ${ps.slice(k0, k1 + 1).map(x => x.p).join(", ")}; ` +
                         "a hunk may straddle at most one file boundary. Port it by hand.");
    const endK0 = startOf[k1], cutK1 = h.a0 + h.b - startOf[k1], lenK1 = lines(ps[k1].b).length;
    if (cutK1 >= lenK1) die(`ambiguous hunk at index.html line ${h.a0 + 1}: it would empty src/${ps[k1].p}. Port it by hand.`);
    edits[k0].push({ from: h.a0 - startOf[k0], to: endK0 - startOf[k0], add });
    edits[k1].push({ from: 0, to: cutK1, add: [] });
    notes.push(`hunk at index.html line ${h.a0 + 1} straddles ${ps[k0].p} | ${ps[k1].p} -> new text in ${ps[k0].p}`);
  }
  const next = ps.map((x, k) => {
    if (!edits[k].length) return x;
    const L = lines(x.b), out = []; let i = 0;
    for (const ed of edits[k].sort((p, q) => p.from - q.from || p.to - q.to)) {
      if (ed.from < i) die("overlapping hunks in src/" + x.p + "; port by hand");
      while (i < ed.from) out.push(L[i++]);
      out.push(...ed.add); i = ed.to;
    }
    while (i < L.length) out.push(L[i++]);
    return { p: x.p, b: Buffer.concat(out), changed: true };
  });
  for (let k = 0; k < next.length - 1; k++) {
    const b = next[k].b;
    if (!b.length) die(`absorbing would empty src/${next[k].p}; port by hand`);
    if (b[b.length - 1] !== NL) die(`absorbing would leave src/${next[k].p} without its final newline (the edit joins it to the next file); port by hand`);
  }
  const out = Buffer.concat(next.map(x => x.b));
  if (!out.equals(target)) die("internal: the absorbed src/ does not rebuild the target page byte for byte; nothing written");
  for (const x of next) if (x.changed) fs.writeFileSync(path.join(SRC, x.p), x.b);
  fs.writeFileSync(OUT, out);
  for (const n of notes) console.log("note: " + n);
  console.log(`absorbed ${hunks.length} hunk(s) into: ${next.filter(x => x.changed).map(x => "src/" + x.p).join(", ")}`);
  console.log(`index.html rebuilt (${out.length} bytes) and equals the ${target === edited ? "edited page" : "merged page"} byte for byte`);
}

/* ---- --split: slice index.html into src/ by a cut table (used once to create src/) ---- */
function cmdSplit(cutsPath, force) {
  if (!cutsPath) die("usage: node build.js --split <cuts.txt> [--force]");
  const page = fs.readFileSync(OUT), L = lines(page);
  const cuts = fs.readFileSync(cutsPath, "utf8").split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"))
    .map(l => { const m = l.match(/^(\d+)\s+(\S+)$/); if (!m) die("bad cut row: " + l); return { line: +m[1], p: m[2] }; });
  if (cuts[0].line !== 1) die("the first cut must start at line 1");
  for (let i = 1; i < cuts.length; i++) if (cuts[i].line <= cuts[i - 1].line || cuts[i].line > L.length) die("cut lines must increase and stay inside the page: " + cuts[i].line);
  if (!force) for (const c of cuts) if (fs.existsSync(path.join(SRC, c.p))) die("src/" + c.p + " exists (pass --force to overwrite)");
  cuts.forEach((c, i) => {
    const end = i + 1 < cuts.length ? cuts[i + 1].line - 1 : L.length;
    const f = path.join(SRC, c.p); fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, Buffer.concat(L.slice(c.line - 1, end)));
  });
  fs.writeFileSync(MAN, "# build order for index.html: one src/ path per line (node build.js concatenates them)\n" + cuts.map(c => c.p).join("\n") + "\n");
  const out = build();
  if (!out.equals(page)) die("split does not rebuild index.html byte for byte");
  console.log(`split index.html into ${cuts.length} files; rebuild is byte-identical`);
}

const a = process.argv.slice(2);
if (!a.length) cmdBuild();
else if (a[0] === "--check") cmdCheck();
else if (a[0] === "--absorb") cmdAbsorb(a[1], a[2]);
else if (a[0] === "--split") cmdSplit(a[1], a.includes("--force"));
else die("unknown option " + a[0] + " (use: no option, --check, --absorb <edited> <base>, --split <cuts>)");
