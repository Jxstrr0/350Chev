# Notes for Claude

Prairie Engine Works is a browser engine-builder by Longlight Interactive: pick a layout, choose every part down to the rod bolts, put it on the dyno, then race it at ten kinds of event, or run a career shop that supplies race teams a season at a time. One self-contained page (`index.html`, built from `src/`), live at https://jxstrr0.github.io/350Chev/. The game as built is described in `docs/DESIGN.md`.

## Stack

- Plain HTML, CSS and classic (non-module) JavaScript in a few big `<script>` blocks. No package.json, no npm, no bundler, no CI. The two node scripts below are the only checks.
- three.js **r128** from CDN: `three.min.js` from cdnjs, plus the post-processing addons from jsdelivr `three@0.128.0` (the `PEW_LIBS` list in `src/html/body.html`; a Lite phone loads them on demand). Google Fonts (Chakra Petch, Barlow, IBM Plex Mono). Nothing else external.
- Sound: a Web Audio synth plus 51 openly licensed engine recordings in `sounds/` (credits in `sounds/CREDITS.md`; keep that file in step with the folder).
- PWA: `manifest.webmanifest`, `icons/`, and the generated `sw.js`. Installed copies work offline.
- Node 16 or newer for the scripts (22 is what was last used). Nothing to install.

## Commands (repo root)

```
node build.js            # rebuild index.html and sw.js from src/
node build.js --check    # exit 1 if either is stale, a script block does not compile, or a function is declared twice
node check-savecode.js   # 15 save-code checks: round trip, damaged and cut-off codes, storage full, old PEW2 codes
```

Run all three before every commit. To play a local copy: `python3 -m http.server` in the repo root and open it in a browser. The service worker only registers on a real host (or with `?sw=1`), so local testing is never cached.

## Source and build

- **Edit `src/`, never `index.html` or `sw.js`.** Both are generated: `node build.js` concatenates the files listed in `src/manifest.txt`, byte for byte, then writes `sw.js`.
- Commit `src/`, `index.html` and `sw.js` together.
- `src/README.md` has the file map (which file holds what) and the merge-conflict and `--absorb` workflows. Read it before moving code or adding a file.
- `src/` files are slices of one page, so a file may open or close mid-IIFE. `node --check` on one file means nothing; test the built page.
- A new `src/` file must go into `src/manifest.txt` at the right position, or the build refuses to run.
- To find code, grep `src/`: `grep -rn "function dragPass" src/`.

## Deploy

GitHub Pages serves the repo root from `main` (`.nojekyll` keeps Jekyll out of it). There is no workflow file: merging into `main` is the deploy. Allow a minute or two, then reload the live site. Installed copies show the "New version ready" bar because the service worker's cache name carries the version and a content hash.

## Versions

- Every release bumps `const VERSION="x.y.z.w";` in `src/app/state.js` (major.minor.feature.hotfix). The build folds it into the `sw.js` cache name, which is what shows installed copies the "New version ready" bar.
- A gameplay or feature change bumps the third number; a fix to the last release bumps the fourth.
- The merge commit into `main` is titled `x.y.z.w: summary`.

## Code conventions the code follows

- Tuning numbers live in tables, not inline: engine parts and layouts in `src/sim/opt.js` (`LAYOUTS`, `OPT`, `FORM`, `DEFAULT_CFG`), base engines in `src/sim/presets.js`, each event's classes and tyres at the top of its `src/sim/<event>.js`, career tables (`UPGRADES`, `STAFF`, `RND`, `PRESTIGE`, `GOALS`, `REP_TIERS`) at the top of `src/app/state.js`, team-season tables (`PC_EVENTS`, `PC_STYLES`, pay shares) at the top of `src/app/team.js`.
- The sim (`ENGINE_SIM`) never touches the DOM or three.js, and it runs in plain node (see below). The 3D code (`ENGINE_VIS`) reads the engine config; the app glues them.
- Three graphics tiers, `lite`, `full`, `ultra` (`src/app/perf.js`); Lite is the phone default and Ultra-only code is behind checks, so Lite must keep working after any 3D change.
- All localStorage access is wrapped in try/catch. Five keys: `pew2-save`, `pew2-slot1` to `pew2-slot3`, `pew2-legacy`.
- Comments in plain English at the top of each file say what it holds. Keep that up when adding one.

## Testing the sim in node

The physics (`ENGINE_SIM`) runs in plain node. Cut the bundle out of the built page; it already ends with `module.exports = ENGINE_SIM`, so don't add another export:

```
node -e 'const h=require("fs").readFileSync("index.html","utf8"),i=h.indexOf("Prairie Engine Works v2 — physics core");
require("fs").writeFileSync("/tmp/sim.js",h.slice(h.lastIndexOf("<script>",i)+8,h.indexOf("</script>",i)))'
node -e 'const SIM=require("/tmp/sim.js"); console.log(Object.keys(SIM))'
```

When changing physics, run a before/after comparison on the affected events and put the numbers in the commit message.

## Save codes

- **Back up** / **Restore** (Shop, Saves) in `src/app/savecode.js`. A code is `PEW1:` + the five localStorage keys as JSON, LZW-squeezed, base64url, + a 6-character checksum. Restore checks the whole code before writing anything. Older one-game `PEW2:` codes still load. `PEW2:` is taken, so the next format is `PEW3:`.
- A new localStorage key must be added to `buMake` and `buWrite`, or backups will not carry it. `check-savecode.js` runs `savecode.js` in node with a pretend localStorage.
- Players may paste their codes to debug a car. That is their personal data: decode and run it locally only, never send it to an outside service, and don't commit it.

## Where things live

- `src/manifest.txt`: the build order. `src/README.md`: the full file map.
- `src/sim/`: physics. `opt.js` tables and the build form; `simulate.js` and `tests.js` the dyno model, loads, tests and reliability; `combos.js` part interactions; `presets.js` the 96 base engines; one file per event (`drag`, `pull`, `bog`, `road`, `e24`, `salt`, `boat`, `swap`, `hill`, `oval`); `tunemap.js` the tune map and the export object.
- `src/sound/`: the synth (`profile.js`, `synth.js`) and the recordings module (`samples.js`).
- `src/vis/`: three.js. Engine mesh and garage, one scene per event, photo mode, trophy room, the Ultra extras.
- `src/app/`: the UI and game. `state.js` (career tables, state, save, VERSION), one file per tab and event, `savecode.js`, `help.js` (tour and 17 lessons), `pwa.js`, `perf.js`, `boot.js`.
- `src/css/`: `style.css` plus one `ui-*.css` per feature lane.
- `docs/DESIGN.md`: the game as built. `docs/fastest-drag-car.md`: build sheets from 1.76.21.0, marked stale.
- `tools/make-icons.js`: renders `icons/` (needs Playwright; run by hand, output is committed).

## How Kelbo works

- Beginner-plus coder who tests on his phone on the live site. End every task with a plain-language summary of what changed and how to test it on a phone.
- Work on a `claude/...` branch and open a pull request into `main`. Once the three checks pass and the PR shows green, merge it yourself: Kelbo has given standing permission. Never push straight to `main`.
- Commit subject: `Area: what changed` (for example `Strip: converter flash stays under the shift point`). Explain the why in the body.
- Keep pull requests small enough to read on a phone. When a physics number moves, say what moved and by how much.
- Real design decisions get asked, not guessed.
- The site and the game use the name Kelbo only, never a real name. Studio name: Longlight Interactive.

## Current status (1.76.42.0, October 2026)

- Built and live: the whole loop, in two modes (Test cell, Career). 19 layouts, 56 part tables (268 options), 96 base engines, three dyno tests, ten event types with classes and rivals, career built around team seasons (supply one race team for 8 rounds; the old Pit Crew mode folded in, selling to buyers removed in 1.76.33.0), certification, sponsors, crew, R&D, prestige, rival shops, Legacy, achievements, trophy room, photo mode, door cars with open windows and a cabin on Full/Ultra, sound synth with real recordings, offline PWA, save codes.
- Known loose ends: `docs/fastest-drag-car.md` is stale (it says so).
- What to test on a phone after any change: the loading bar finishes and the garage renders on Lite; Build, Test (a dyno pull) and one event run with touch; in Career, sign a team, certify, race a round and Close week; the results rail opens as a sheet; Back up and Restore round trip; portrait and landscape; no console errors on desktop.
