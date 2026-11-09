# Notes for Claude

Prairie Engine Works is a browser engine-builder by Longlight Interactive: pick a layout, choose every part down to the rod bolts, put it on the dyno, then race it at ten kinds of event, or run a career shop that supplies race teams a season at a time. One self-contained page (`index.html`, built from `src/`), live at https://pew.longlight.games/. The game as built is described in `docs/DESIGN.md`.

## Stack

- Plain HTML, CSS and classic (non-module) JavaScript in a few big `<script>` blocks. No package.json, no npm, no bundler, no CI. The two node scripts below are the only checks.
- three.js **r128** from CDN: `three.min.js` from cdnjs, plus the post-processing addons and the GLTFLoader from jsdelivr `three@0.128.0` (the `PEW_LIBS` list in `src/html/body.html`; a Lite phone loads them on demand). Google Fonts (Chakra Petch, Barlow, IBM Plex Mono). Nothing else external.
- Sound: a Web Audio synth plus 72 openly licensed recordings (engine loops, and blow-off, backfire and anti-lag one-shots) in `sounds/`, and 143 ElevenLabs announcer lines in `sounds/announcer/` (credits in `sounds/CREDITS.md`; keep that file in step with the folder).
- 3D models: a few CC0 glTF props in `models/` (the workshop, the pull track and the drag pits) (credits in `models/CREDITS.md`; keep it in step), Full and Ultra only, packed with `tools/pack-model.py` (Python with Pillow and numpy). The Pikes Peak props (`models/hill-*.glb`) are our own, built in Blender by `tools/blender/hill-props.py` (`pip install bpy` on Python 3.11, then run it). The engine, rooms and Lite props stay as code.
- PWA: `manifest.webmanifest`, `icons/`, and the generated `sw.js`. Installed copies work offline.
- Node 16 or newer for the scripts (22 is what was last used). Nothing to install.

## Commands (repo root)

```
node build.js            # rebuild index.html, scenes.js and sw.js from src/
node build.js --check    # exit 1 if either is stale, a script block does not compile, or a function is declared twice
node check-savecode.js   # 15 save-code checks: round trip, damaged and cut-off codes, storage full, old PEW2 codes
node tools/sim-test.js   # 500 sim numbers (ten engines, the dyno and all ten events) against tools/sim-baseline.json
```

Run the first three before every commit. Run `node tools/sim-test.js` whenever `src/sim/` changes: it lists every number that moved. If the move was meant, `node tools/sim-test.js --update` and paste the list into the commit message; if it was not, you just found a bug. To play a local copy: `python3 -m http.server` in the repo root and open it in a browser. The service worker only registers on a real host (or with `?sw=1`), so local testing is never cached.

## Source and build

- **Edit `src/`, never `index.html`, `scenes.js` or `sw.js`.** All three are generated: `node build.js` concatenates the files listed in `src/manifest.txt`, byte for byte, then writes `sw.js`.
- `scenes.js` is the nine event scenes (the manifest lines marked `scenes.js:`). They are not in the page: it fetches the file in the background once the garage is up and runs it inside the `ENGINE_VIS` closure (`src/vis/scn.js`), so a first visit downloads about a quarter less. When the page's 3D code calls a new scene function, add its name to `SCN_NAMES` in `src/vis/scn.js`; the build says so if you forget.
- Commit `src/`, `index.html`, `scenes.js` and `sw.js` together.
- `src/README.md` has the file map (which file holds what) and the merge-conflict and `--absorb` workflows. Read it before moving code or adding a file.
- `src/` files are slices of one page, so a file may open or close mid-IIFE. `node --check` on one file means nothing; test the built page.
- A new `src/` file must go into `src/manifest.txt` at the right position, or the build refuses to run.
- To find code, grep `src/`: `grep -rn "function dragPass" src/`.

## Deploy

GitHub Pages serves the repo root from `main` (`.nojekyll` keeps Jekyll out of it). No deploy workflow: merging into `main` is the deploy. (`.github/workflows/publish-release.yml` only publishes a GitHub Release for each new `VERSION`, which is where the studio site gets this game's version number; free, no keys.) Allow a minute or two, then reload the live site. Installed copies show the "New version ready" bar because the service worker's cache name carries the version and a content hash.

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

When changing physics, run `node tools/sim-test.js` (it covers every event, not just the one you meant to change) and put what moved in the commit message. For a closer look at one event, load the sim as above and compare before and after by hand.

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
- `docs/DESIGN.md`: the game as built.
- `src/vis/models.js` and `models/`: the glTF props for the workshop, the pull track (`PULL_PROPS` in `src/vis/pull.js`) and the drag pits (`PITS_MODELS` in `src/vis/pits.js`), Full / Ultra, and `tools/pack-model.py`, which packs a downloaded model for them.
- `tools/sim-test.js` and `tools/sim-baseline.json`: the sim regression check (see Commands).
- `tools/make-icons.js`: renders `icons/` (needs Playwright; run by hand, output is committed).

## How Kelbo works

- Beginner-plus coder who tests on his phone on the live site. End every task with a plain-language summary of what changed and how to test it on a phone.
- Work on a `claude/...` branch and open a pull request into `main`. Once the three checks pass and the PR shows green, merge it yourself: Kelbo has given standing permission. Never push straight to `main`.
- Commit subject: `Area: what changed` (for example `Strip: converter flash stays under the shift point`). Explain the why in the body.
- Keep pull requests small enough to read on a phone. When a physics number moves, say what moved and by how much.
- Real design decisions get asked, not guessed.
- The site and the game use the name Kelbo only, never a real name. Studio name: Longlight Interactive.

## Current status (1.76.102.0, November 2026)

- Built and live: the whole loop, in two modes (Test cell, Career). 19 layouts, 56 part tables (268 options), 96 base engines, three dyno tests, ten event types with classes and rivals, career built around team seasons (supply a race team for 8 rounds across 27 series in six kinds of racing, two teams at once from 300 rep; five varied offers with shoestring or well-funded budgets and team rules since 1.76.59.0, leaning to the top series opened since 1.76.60.0; offers built around the certified engine since 1.76.69.0; the old Pit Crew mode folded in, selling to buyers removed in 1.76.33.0), season beats, rescue contracts, returning drivers, Watch it replays (drag, oval, and since 1.76.100.0 pull, bog, boat and hill), a crew chief who can call the 24 Hours strategy (since 1.76.102.0), car show and sound-off, a career dev mode in Settings (+$100,000, +100 rep, skip week), certification, crate engine sales, rival feuds, sponsors, crew, R&D, prestige, rival shops, Legacy, achievements, trophy room, photo mode, door cars with open windows and a cabin on Full/Ultra, sound synth with real recordings, a drag announcer (Ed, 143 ElevenLabs lines in `sounds/announcer/`, matchup calls stitched from parts, since 1.76.87.0), offline PWA, save codes with backup files and a backup reminder.
- Known loose ends: none flagged beyond `docs/DESIGN.md`'s list.
- What to test on a phone after any change: the loading bar finishes and the garage renders on Lite; Build, Test (a dyno pull) and one event run with touch; in Career, sign a team, certify, race a round and Close week; the results rail opens as a sheet; Back up and Restore round trip; portrait and landscape; no console errors on desktop.

## Longlight brand (studio pieces only)

This game keeps its own look. Its fonts, colours and art style stay as they
are, and game screens are never restyled to match the studio. The Longlight
brand applies only to studio pieces: the studio logo or splash, the
"Longlight Interactive" credit line, the studio block on a credits or about
screen, and any link back to the studio site.

- **Logo:** the horizon lockup, a half-set clay sun on a long horizon line
  with LONGLIGHT above INTERACTIVE. Use the official files from the studio
  site's press kit (https://longlight.games/press.html; the
  files are `assets/press/longlight-logo-dark` and `longlight-logo-light`,
  SVG plus 2x PNG, in `Jxstrr0/Kelbo.Website`). Copy them into this repo;
  never hotlink, redraw or recolour them, or swap the letters for live text.
- **Colours, inside studio pieces only:** Clay `#D97757`, Purple `#7B3FC4`,
  Slate `#141413`, Ivory `#FAF9F5`, Lilac `#B48CE8`. Nothing else in the
  logo or the studio block.
- **Font, inside studio pieces only:** Space Grotesk 500/700. If a studio
  piece uses it, self-host it; don't add a new font host or outside request.
- **Name:** always "Longlight Interactive" in full. Credit line:
  "© year Kelbo / Longlight Interactive" (the studio isn't a registered
  business yet). Never Kelbo's real name or initials.
- **Studio site:** https://longlight.games/

## Studio catalogue

`LONGLIGHT-STUDIO.md` (repo root) covers every Longlight game: looks, names
already taken, storage and cache prefixes (kept apart from the old shared origin), a reuse map and
improvement ideas. Read it before pitching new ideas, names or looks, and
before building a system another Longlight game may already have. This file
wins where the two disagree. Don't edit the copy here: the master is
`.github/LONGLIGHT-STUDIO.md` in Jxstrr0/Kelbo.Website; it gets recopied.
