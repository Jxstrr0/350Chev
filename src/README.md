# src/: the source of index.html

**Edit `src/`, run `node build.js`, commit both `src/` and `index.html`. Never hand-edit `index.html`.**

`index.html` is still the shipped artifact: one self-contained page, served by GitHub Pages from `main` and saved for offline use. `build.js` (repo root, node, no dependencies) concatenates the files listed in `src/manifest.txt`, in that order, byte for byte. It adds no wrappers and does no reformatting.

```
node build.js            # write index.html from src/
node build.js --check    # exit 1 if index.html != what src/ builds; names the first differing src file and line
node build.js --absorb <edited.html> <base.html>   # port a pre-split branch (see below)
```

## How the files fit together

- The files are **slices of one page**, cut at section headers. A `.js` file may open or close in the middle of an IIFE or an object literal, so `node --check` on a single file is meaningless. Test the built `index.html` instead.
- The first file of each `<script>` block starts with its `<script>` line, and the last file of the block ends with `</script>`. These are `sim/opt.js` … `sim/tunemap.js`, `sound/profile.js` … `sound/synth.js`, `sound/samples.js` on its own, `vis/core.js` … `vis/teardown.js` and `app/state.js` … `app/boot.js`.
- Every file except the last ends with a newline. `build.js` refuses to build if one doesn't, because a file that loses its final newline would join its last line onto the next file's first line. `html/end.html` holds the page's last line, which has no trailing newline.
- A new file must be added to `manifest.txt` at the right position. `build.js` refuses to build if any file in `src/` is missing from the manifest, and it also refuses on leftover merge-conflict markers.
- Scope is shared within each script block. `ENGINE_SIM` is one IIFE spread over the sim files, `ENGINE_VIS` is one IIFE spread over the vis files, and the app script is one top-level script spread over the app files. Moving code between files of the same block changes nothing, as long as the order still works.

## VERSION (bumped by the ship script)

- `src/html/head.html` line 3: `<!-- VERSION x.y.z.w — major.minor.feature.hotfix -->`
- `src/app/state.js`: `const VERSION="x.y.z.w";`

## File map (build order)

| file | what is in it |
|---|---|
| `html/head.html` | doctype, inline critical style, `<title>`, **VERSION comment**, fonts, the `<style>` line |
| `css/style.css` | all of the page CSS: theme vars, layout, desktop `html.desk`, HUDs, timing slip, race-night ladder |
| `html/body.html` | `</style>`, all of the markup (`#app`, `#view`, tabs, panels, sheets), three.js r128 CDN script tags |
| **ENGINE_SIM** (physics) | |
| `sim/opt.js` | `<script>`, header, helpers, 1. LAYOUTS, 2. OPT part tables, 3. FORM (UI description), 4. DEFAULT_CFG / DEFAULT_ENV |
| `sim/simulate.js` | 5–9: atmosphere, geometry, VE, boost model, calibration, 9r rotary cycle, 9t two-stroke cycle; 10: exhaust system (exhParts/exhSysOf), `simulate()` up to 11. component loads |
| `sim/tests.js` | the rest of `simulate()`: 12. tests `T(...)`, 13. reliability/life/endurance/over-rev, 14. mass/cost/economy, the output object |
| `sim/combos.js` | 15. `combos()` (+ twoStrokeCombos, rotaryCombos), 15b `fitFuel()`, 16. `cfgLabel()` |
| `sim/presets.js` | 17. PRESETS, PRESET_FUEL |
| `sim/drag.js` | drag strip: TYRES, AERO, TURBO_MM, MANIFOLD_HEAT, `dragPrep`, `n2oBottle`, `launchTech`, `dragRun`, `dragPass` |
| `sim/pull.js` | truck & tractor pull: PULL_CLASSES/TYRES, `pullRun`, `pullPass`, `pullDriver`, `pullRunaway` |
| `sim/bog.js` | mud bog: BOG_CLASSES/TYRES, `bogNight`, `bogRun`, `bogPass`, `bogAiRes` |
| `sim/road.js` | road test: CHASSIS, ROAD_TRACKS, `roadTrack`, `roadRun`, `lapSim`, `roadTest` |
| `sim/e24.js` | 24 Hours of Prairie Sky: `enduroPrep`, `enduroNew`, `enduroStep`, `e24*` |
| `sim/salt.js` | Bonneville/LSR: LSR_BODIES/COURSES/CHUTES, `lsrClass`, `lsrRun`, `lsrPass`, `lsrRecord` |
| `sim/tunemap.js` | tune map tools (`mapAxis`, `mapGrid`, `mapAutoTune` …) and **the ENGINE_SIM export object**. Add new exports here |
| **ENGINE_SOUND** | |
| `sound/profile.js` | `<script>`, firing-order table, exhaust voicing, profiles, `deriveProfile`, wave construction, static buffers |
| `sound/synth.js` | module state, `init`, voice graph `buildGraph`, `applyProfile`, start/stop, `set()` hot path, `event()` transients, public API |
| `sound/samples.js` | the ENGINE_SAMPLES module between `<!-- ENGINE_SAMPLES:BEGIN/END -->` (the whole `<script>` block) |
| **ENGINE_VIS** (three.js) | |
| `vis/core.js` | `<script>`, 0–6: math/noise, canvas textures, procedural materials (MAT), geometry helpers + merge, environment, module state, cfg helpers |
| `vis/engine.js` | 7. engine builder (`buildEngineMesh`), 7r Wankel rotary, 7t two-stroke barrels |
| `vis/bank.js` | 7a-d diesel fuel hardware (injectors, glow plugs, pump), 7a one cylinder bank (`buildBank`) |
| `vis/exhaust.js` | 7b exhaust manifolds/headers, 7b' exhaust system (pipes, cutout, muffler) |
| `vis/intake.js` | 7c intake, 7d aspiration (turbos, blowers, intercooler, blower belt) |
| `vis/accessories.js` | 7e front accessory drive (`buildFAD`), 7f fidelity detail (lettering, tags, wiring, PCV) |
| `vis/garage.js` | 8. the garage room |
| `vis/particles.js` | 9. particles (haze, smoke, sparks, `emit`/PKIND), 9b failure FX |
| `vis/loop.js` | 10. orbit controls, 11. frame loop, 12. framing |
| `vis/strip.js` | drag strip scene: STRIP state, track/ground shaders, sky, prairie and the plant, per-frame scenery |
| `vis/strip-cars.js` | drag cars: materials, sponsor livery, body loft, wheels, chute, body packs |
| `vis/strip-run.js` | strip particles, rubber, scoreboards, day/night, effects, tree lights, crowd, camera cuts, post, after-the-pass show |
| `vis/pits.js` | race-night pits vignette |
| `vis/pull.js` | pull track scene (fairground, sled, chain, camera) |
| `vis/bog.js` | mud bog scene |
| `vis/road.js` | road course scene |
| `vis/salt.js` | salt flats scene |
| `vis/api.js` | **the `ENGINE_VIS` public object** (`setStrip`, `setPull`, `setSalt` …, and `_state`/`_root` debug hooks) |
| `vis/teardown.js` | teardown/exploded view after a failure, `window.ENGINE_VIS=`, IIFE close, `</script>` |
| **app** | |
| `app/state.js` | `<script>`, SIM aliases, `$`, career tables (UPGRADES, STAFF, RND, PRESTIGE, GOALS, CATS, SEGMENTS, SITES, loans), `S` state, **VERSION**, psi display, `save`/`hydrate`/`fuelMigrate`/save slots, `C()`/`career()`, env helpers, `cfgHash` (+HASH_SKIP), live compute (`recompute`, `hud`), engine card |
| `app/build.js` | Build tab: `renderBuild`, segRow/sliderRow, SPECS, sheets, blueprints |
| `app/test.js` | Test and Events tabs: env panel, car bodies/paint/rival looks, test/event picker (`evPickRender`, EV_T), Advanced folds, charts, `renderTest`, dyno tune map editor (MV, `renderMap`) |
| `app/drag.js` | drag pass driver (DR, `dragStart`/`dragFinish`), strip HUD, timing slip, nitrous, race nights `rn*` |
| `app/pull.js` | truck pull driver (PR), pull nights, points series |
| `app/bog.js` | mud bog UI (BR) |
| `app/road.js` | road test UI (RT) |
| `app/e24.js` | 24 Hours UI (ER): live race, flag, records |
| `app/salt.js` | Bonneville UI: meets, records, `lsrWarm` |
| `app/results.js` | datalog `dl*`, `showResult`, achievements, teardown panel, `renderAnalysis`, `renderRecords` |
| `app/market.js` | Shop contracts, briefs (`fits`, `deal`, `buyers`, `oneChange`), weekly passes (rnd, warranty, goals), rebuilds & cores |
| `app/career.js` | dyno day, `advanceWeek`, sponsors, `renderShop`, volume |
| `app/help.js` | onboarding tour, First Fire, glossary/tap-to-explain, guided lessons |
| `app/boot.js` | sound & idle, sound bench (AB), `tick`, tabs `showTab`, desktop layout, tooltips, keyboard, `boot`/`start`, `</script>` |
| `html/end.html` | `</body></html>` (no trailing newline) |

To find code, grep `src/`: `grep -rn "function pullRun" src/`.

## Merge conflicts

- **Conflict in `index.html` only, `src/` clean:** take either side and rebuild. Never hand-merge `index.html`.
  `git checkout --theirs index.html && node build.js && git add index.html` (the build overwrites it either way).
- **Conflict in `src/`:** resolve it there like normal code, then `node build.js`, `node build.js --check`, and `git add src index.html`. `build.js` refuses to run while conflict markers remain in `src/`.

## Porting a pre-split branch (`--absorb`)

A branch that started before the split edits the old single-file `index.html`. To port it:

```
git show <branch>:index.html > /tmp/edited.html
git show <branch's merge-base with main>:index.html > /tmp/base.html
node build.js --absorb /tmp/edited.html /tmp/base.html
node build.js --check && git diff --stat     # the edits now live in src/
```

- `--absorb` diffs base → edited (`git diff --no-index -U0`). It maps each hunk to the src file that holds those lines and writes the changes into `src/`. It then rebuilds `index.html` and verifies the result byte for byte. Nothing in `src/` is written unless that check passes.
- If `src/` has moved on since the base (for example a version bump), absorb first three-way merges base → edited onto the current build (`git merge-file`), then absorbs the merged page. Overlapping edits stop with a conflict, and `src/` is left untouched.
- A hunk that straddles one file boundary goes to the earlier file, and the later file only loses the lines it covered. An insertion exactly at a boundary is appended to the earlier file. Both cases print a `note:`, so you can move the code if it belongs in the next file. A hunk that spans three or more files, or that would empty a file, stops with an error: port that hunk by hand.
