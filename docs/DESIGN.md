# Prairie Engine Works: the game as built

Written from the code at version 1.76.28.1 (October 2026). Every number here was counted in the source. Where a count comes from one table, the table is named so it can be re-checked.

## What it is

A physics-based engine builder with a career mode, by Longlight Interactive. The player designs an engine part by part, runs it on a dyno, finds out what breaks, then takes it racing or sells it. It is one web page that runs on phones and desktops and installs as an app that works offline.

## The loop

1. **Build.** Pick a layout and set 73 settings (`DEFAULT_CFG`): bore and stroke, materials, pistons, rods, crank, valvetrain, induction, boost, exhaust, fuel, launch control, oiling, cooling, sealing and finish. A 3D engine on a stand follows every choice.
2. **Test.** Run a dyno pull, an endurance run to failure or an over-rev test (`DYNO_T`). Read power and torque curves, the verdict, the failure that stopped it, and the engineer's notes.
3. **Race.** Take the engine to an event. Each one has its own time-stepped sim, classes, rivals, a 3D scene and a live HUD.
4. **Career.** Certify engines on the dyno, take contracts, sell to market segments, pay crew, buy upgrades, chase reputation. Or skip the money in the Test cell (sandbox) and build anything.

The results rail (`app/rail.js`) keeps build, dyno and verdict in sight so the build-dyno-build loop never leaves the tab: a third column on desktop, a peek sheet over the tab bar on a phone.

## Starting out

The intro screen (`html/body.html`) asks for a layout, Phone or Desktop, then a mode:

- **Test cell**: everything unlocked, no money, for testing theories.
- **Career**: $20,000, a chassis dyno and five stock starter engines. Sell certified engines, survive warranty claims, grow.

An onboarding tour and "First Fire" walk a new player through the first engine (`app/help.js`). The help file also holds a tap-to-explain glossary and 17 guided lessons (`LESSONS`).

## Screens

Six tabs (`#tab-*` in `html/body.html`): **Build**, **Test**, **Events**, **Analysis**, **Market**, **Shop**.

- **Build**: 14 accordion groups (`FORM`): Engine layout, Bore & stroke, Rotors & housings, Block & head materials, Pistons & rings, Rods & crank, Valvetrain, Induction & boost, Exhaust system, Fuel & tune, Launch control, Lubrication & cooling, Sealing, Finish. Base-engine list (presets), blueprints, and Build > Swap for putting the engine in a car.
- **Test**: the dyno. Environment panel (ambient, altitude), the three tests, charts, the dyno tune map editor.
- **Events**: a chip picker for the ten events, then Setup, Advanced and Results panes. Running an event turns the page into the run view (`app/runview.js`): the 3D scene fills the screen with a live HUD.
- **Analysis**: combo interactions (part pairings that help or hurt), telemetry, achievements, records, the teardown panel after a failure.
- **Market** (career): jobs (contracts), sponsors and rivals, the shop's reputation board, Close week.
- **Shop**: in career, upgrades, staff, R&D, prestige items, build bays, Dyno day, Saves. In the Test cell it is a bench (current build next to every blueprint) and a parts catalogue (`app/shopsb.js`).

Also: a Settings pane (sound, display, graphics tier, theme, haptics, save slots, install), **photo mode** (free camera, light and backdrop presets, a still frame out, with a build sheet card), and the **trophy room** (a 3D mezzanine of what the shop has won).

## Systems

### The engine sim (`src/sim/`, `ENGINE_SIM`)

Plain JavaScript with no DOM and no three.js; it runs in node. `simulate(cfg, env)` goes atmosphere, geometry, volumetric efficiency, boost model, calibration (fuel and ignition), then the cycle (four-stroke, the rotary cycle or the two-stroke cycle), the exhaust system, component loads, the tests, reliability, life and over-rev, and mass, cost and economy. It returns power and torque curves plus everything the UI reads (verdict, failure, loads, notes). The export object has 167 members.

Content in the sim:

| Table | Count | What |
|---|---|---|
| `LAYOUTS` | 19 | single, parallel twin, inline 3 to 6, V4, V6, V8 crossplane, V8 flat-plane, V10, V12, flat 4, flat 6, 1- to 4-rotor Wankels, the Deltic triangle (two-stroke only) |
| `OPT` | 56 tables, 266 options | every part choice: block and head materials, pistons, rings, rods, cranks, bearings, valves, springs, intakes, 7 aspiration types, 7 turbo sizes, 15 fuels, injectors, pumps, diesel hardware, rotary ports and seals, two-stroke scavenging and pipes, oil, cooling, exhaust, mufflers, launch control, 6 finishes |
| `PRESETS` | 96 | base engines modelled on real ones, with their fuel |
| `combos()` | n/a | the material and part interactions shown in Analysis, with two-stroke and rotary variants |
| tune map | n/a | `mapAxis`, `mapGrid`, `mapAutoTune` and friends: a dyno tune map by rpm and load |

Fuels cover pump grades, race grades, oxygenated fuels, E85 and flex blends, methanol, propane and diesel (`FUEL_RANK`, `fitFuel`).

### Events (`src/sim/<event>.js` with `src/app/<event>.js` and `src/vis/<event>.js`)

`EV_T` lists ten: `drag`, `bracket`, `pull_sled`, `salt`, `bog`, `boat`, `road`, `hill`, `oval`, `race24`.

| Event | Sim | Classes and content |
|---|---|---|
| Drag strip (heads-up) and bracket racing | `drag.js`: tyres, aero, turbo heat soak, nitrous bottle, launch tech, an auto driver, drivetrain tiers, engine weight counted | 3 tyre types, 7 aero bodies, 4 drivetrain tiers; race nights with a ladder; top-five passes per body class |
| Truck and tractor pull | `pull.js` | 6 classes, 5 tyres, pull nights and a points series, runaway sled |
| Mud bog | `bog.js` | 3 classes with sized radiators, 3 tyres, bog nights, AI results |
| Boat drags | `boat.js`: prop or jet pump, hump then plane, wind and chop | 4 classes, 3 hulls, eight-boat ladder nights |
| Road test and track day | `road.js` | 7 chassis, 3 tracks, 4 tyres; track day is the career event (entry fee, needs a certified engine) |
| Salt flats (Bonneville) | `salt.js` | 4 bodies, 2 courses, 3 chutes, meets and records |
| Pikes Peak hill climb | `hill.js`: 156 corners in 8 sections, power at five altitudes, cooling, offs | 4 classes, 4 tyres, 4 aero |
| Dirt oval | `oval.js`: banked-turn limit, friction circle, heat, wear | 3 classes by cubic inches, 2 tracks (clay and paved half-mile), heat then feature |
| 24 Hours of Prairie Sky | `e24.js`: time-stepped endurance with weather, fuel and fixes | 3 classes, 3 modes, a live race with a flag and records |

Engine swaps (`swap.js`): 20 vehicles in 5 groups and 15 fixes; one fit check shared by the road test, the strip, the salt and the 24 Hours. Pull and bog keep their class trucks.

### Career (`src/app/state.js`, `career.js`, `market.js` and the files named below)

- **Reputation** tiers (`REP_TIERS`): Backyard 0, Local shop 40, Known builder 120, Regional supplier 300, OEM partner 700, Legend 1500, Dynasty 3000.
- **Contracts**: 7 categories (`CATS`) over 44 market segments (`SEGMENTS`), each with a hp window, economy, fuel, reliability, weight and noise requirement. At most 2 active (`MAX_ACTIVE`), a 10% deposit, contracts expire after 8 weeks. The weekly pool draws from segments whose tier is at or below the shop's reputation tier and no more than two tiers back; the outlaw and top-tier segments (tier 5 and 6) also need the race shop upgrade (`market.js`).
- **Certification**: a dyno pass that makes an engine sellable. The dyno ladder is the starter chassis dyno (400 hp), then the Engine dyno (1,000 hp), Pro dyno cell (2,000 hp, climate control), Outlaw dyno cell (3,500 hp) and Monster dyno cell (15,000 hp / 14,000 rpm), bought as upgrades `dyno2` to `dyno5`. 47 certification sites in 15 groups (`SITES`), each with its own climate and altitude, grouped by what the engine is for (sedan, taxi, van, pump, truck, genset, tractor, rally, endurance, pickup, medium truck, workboat and more).
- **Shop**: 17 upgrades (`UPGRADES`), 4 staff roles (`STAFF`) that become named crew with levels 1 to 5, traits and morale (`crew.js`), 12 R&D projects (`RND`), 3 prestige items (`PRESTIGE`), 13 goals (`GOALS`), a loan, warranty claims, rebuilds and cores, Dyno day.
- **Build bays** (`bays.js`): 2 late-game bays, each with a lead who builds a contract in the background over several weeks.
- **Sponsors** (`career.js`): never ask for an event the shop cannot enter; track day counts as an event.
- **Rival shops** (`rivals.js`): three made-up shops on the reputation board that throw down head-to-head challenges at the strip, the pull, Pikes Peak, the bog, the boats, the oval, track day, the salt and the 24 Hours.
- **Legacy** (`legacy.js`): at Legend rep the owner can sell the shop. The sale value becomes Legacy points under their own storage key; points buy permanent perks for the next career.
- **Achievements**: 85 (`ACH`) in 13 groups, bronze, silver and gold. **Trophy room** (`trophy.js`): a dated log of wins per mode.

### Graphics (`src/vis/`, `ENGINE_VIS`)

three.js r128. The engine mesh is built from the config: banks, heads, intake, turbos and blowers, exhaust, accessory drive, belts that move with the pulleys, lettering and wiring at higher detail. Scenes: the garage and workshop, the strip (venue, crowd, cars per class, nitro classes), pits, pull track, bog (trucks per class, mud FX, heightfield pit), boats, road course, salt flats (Speed Week pit town), Pikes Peak (heightfield mountain with LOD), the oval, the trophy room, photo mode, and a teardown view after a failure.

Three tiers, `lite`, `full`, `ultra` (`app/perf.js`). Lite is the phone default. Auto-adjust watches the frame rate and steps one tier down if it stays under about 27 fps for about 8 s; it never steps up. Bloom and SSAO addons load only for Full and Ultra.

### Sound (`src/sound/`)

A Web Audio synth derives a voice from the build (firing order, exhaust, intake, mechanical noise). Settings offer **Synth** (your build), **Real** (recordings) or **Blend**, and Lite or Full sound. 51 openly licensed recordings in `sounds/`, looped at a measured rpm and pitch-shifted live; every one is credited in `sounds/CREDITS.md`.

### Save system

- Everything lives in the browser's localStorage under five keys: `pew2-save` (the current game, settings included), `pew2-slot1` to `pew2-slot3` (three save slots, `SLOTS`), `pew2-legacy` (Legacy points). All access is wrapped in try/catch.
- **Back up** turns all five into one text code: `PEW1:` + LZW-packed JSON in base64url + a 6-character checksum. **Restore** checks the whole code first and writes nothing if it is damaged, cut off, from another game (`GG1:`, `RS2:`) or from a newer version (`PEW3:` and up). Older one-game `PEW2:` codes still load. A restore that fails half-way puts every key back.
- `check-savecode.js` runs these paths in node with a pretend localStorage (15 checks).

### Offline and install

`sw.js` (generated by `build.js`) precaches the page, manifest and icons under a cache named `pew-shell-v<VERSION>-<hash>`, keeps three.js and fonts in a long-lived library cache, and caches sounds as they are fetched. A new version installs in the background and the page shows "New version ready". Settings > App offers Install (or the iOS Add to Home Screen tip).

## Content scale (counted)

| What | Count | Source |
|---|---|---|
| Engine layouts | 19 | `LAYOUTS` |
| Part tables / options | 56 / 266 | `OPT` |
| Config settings on a build | 73 | `DEFAULT_CFG` |
| Build form groups | 14 | `FORM` |
| Base engines | 96 | `PRESETS` |
| Fuels | 15 | `OPT.fuel` |
| Event types | 10 | `EV_T` |
| Dyno tests | 3 | `DYNO_T` |
| Swap vehicles | 20 in 5 groups | `VEHICLES`, `VEH_GROUPS` |
| Market segments / categories | 44 / 7 | `SEGMENTS`, `CATS` |
| Certification sites | 47 in 15 groups | `SITES` |
| Shop upgrades / staff roles / R&D / prestige / goals | 17 / 4 / 12 / 3 / 13 | `state.js` tables |
| Reputation tiers | 7 | `REP_TIERS` |
| Achievements | 85 in 13 groups | `ACH`, `ACH_GROUPS` |
| Guided lessons | 17 | `LESSONS` |
| Engine recordings | 51 | `sounds/` |
| Source files in the build | 111 | `src/manifest.txt` |
| Built page | 3.66 MB (1.19 MB gzipped) | `node build.js` |

## Loose ends found in the code (as of 1.76.28.1)

Only things the code or docs themselves flag:

- `docs/fastest-drag-car.md` says it is stale: its build sheets were run on 1.76.21.0 before drivetrain tiers, the rev limiter and the strip's engine-weight rule.
- The intro copy says "sixty-five base engines" while `PRESETS` holds 96; a comment in `app/results.js` says "Achievements n / 83" while `ACH` holds 85. Copy and comments to tidy, not bugs.
- `app/salt.js` shows a placeholder line in Analysis while a salt record it has not computed yet is being worked out.

Nothing else is stubbed or marked unfinished in `src/`.
