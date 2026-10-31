# Prairie Engine Works: the game as built

Written from the code at version 1.76.28.1 (October 2026). Every number here was counted in the source. Where a count comes from one table, the table is named so it can be re-checked.

## What it is

A physics-based engine builder with a career mode, by Longlight Interactive. The player designs an engine part by part, runs it on a dyno, finds out what breaks, then takes it racing or sells it. It is one web page that runs on phones and desktops and installs as an app that works offline.

## The loop

1. **Build.** Pick a layout and set 73 settings (`DEFAULT_CFG`): bore and stroke, materials, pistons, rods, crank, valvetrain, induction, boost, exhaust, fuel, launch control, oiling, cooling, sealing and finish. A 3D engine on a stand follows every choice.
2. **Test.** Run a dyno pull, an endurance run to failure or an over-rev test (`DYNO_T`). Read power and torque curves, the verdict, the failure that stopped it, and the engineer's notes.
3. **Race.** Take the engine to an event. Each one has its own time-stepped sim, classes, rivals, a 3D scene and a live HUD.
4. **Career.** Supply one race team's engines a season at a time, race your own engines at the events for purses and rep, pay crew, buy upgrades, chase reputation. Or skip the money in the Test cell (sandbox) and build anything.

The results rail (`app/rail.js`) keeps build, dyno and verdict in sight so the build-dyno-build loop never leaves the tab: a third column on desktop, a peek sheet over the tab bar on a phone.

## Starting out

The intro screen (`html/body.html`) asks for a layout, Phone or Desktop, then a mode:

- **Test cell**: everything unlocked, no money, for testing theories.
- **Career**: $20,000, a chassis dyno and five stock starter engines. Build engines for race teams a season at a time, race the events, grow the shop.

Until 1.76.32 there was a third mode, Pit Crew; since 1.76.33.0 its team seasons are the heart of the career (below), and a Pit Crew save opens as a fresh career with its titles in the log. Careers from before 1.76.33.0 (contracts, the buyer market, warranty, build bays, Dyno day) also start fresh.

An onboarding tour and "First Fire" walk a new player through the first engine (`app/help.js`). The help file also holds a tap-to-explain glossary and 17 guided lessons (`LESSONS`).

## Screens

Six tabs (`#tab-*` in `html/body.html`): **Build**, **Test**, **Events**, **Analysis**, **Team**, **Shop**.

- **Build**: 14 accordion groups (`FORM`): Engine layout, Bore & stroke, Rotors & housings, Block & head materials, Pistons & rings, Rods & crank, Valvetrain, Induction & boost, Exhaust system, Fuel & tune, Launch control, Lubrication & cooling, Sealing, Finish. Base-engine list (presets), blueprints, and Build > Swap for putting the engine in a car.
- **Test**: the dyno. Environment panel (ambient, altitude), the three tests, charts, the dyno tune map editor.
- **Events**: a chip picker for the ten events, then Setup, Advanced and Results panes. Running an event turns the page into the run view (`app/runview.js`): the 3D scene fills the screen with a live HUD.
- **Analysis**: combo interactions (part pairings that help or hurt), telemetry, achievements, records, the teardown panel after a failure.
- **Team** (career; `#tab-market` in the markup): a strip with the engine's state for the team, the next round and Close week (after a round it reads To race week and closes the off week too, with 1 wk beside it to close just one), then three sections: Team (the season numbers, offers, the season card, standings, the last race day), Sponsors & Rivals, and Log (ledger and goals).
- **Shop**: in career, upgrades, staff, R&D, prestige items, the bank, Saves. In the Test cell it is a bench (current build next to every blueprint) and a parts catalogue (`app/shopsb.js`).

Also: a Settings pane (sound, display, graphics tier, theme, haptics, save slots, install), **photo mode** (free camera, light and backdrop presets, a still frame out, with a build sheet card), and the **trophy room** (a 3D mezzanine of what the shop has won).

## Systems

### The engine sim (`src/sim/`, `ENGINE_SIM`)

Plain JavaScript with no DOM and no three.js; it runs in node. `simulate(cfg, env)` goes atmosphere, geometry, volumetric efficiency, boost model, calibration (fuel and ignition), then the cycle (four-stroke, the rotary cycle or the two-stroke cycle), the exhaust system, component loads, the tests, reliability, life and over-rev, and mass, cost and economy. It returns power and torque curves plus everything the UI reads (verdict, failure, loads, notes). The export object has 167 members.

Content in the sim:

| Table | Count | What |
|---|---|---|
| `LAYOUTS` | 19 | single, parallel twin, inline 3 to 6, V4, V6, V8 crossplane, V8 flat-plane, V10, V12, flat 4, flat 6, 1- to 4-rotor Wankels, the Deltic triangle (two-stroke only) |
| `OPT` | 56 tables, 268 options | every part choice: block and head materials, pistons, rings, rods, cranks, bearings, valves, springs, intakes, 7 aspiration types, 7 turbo sizes, 15 fuels, injectors, pumps, diesel hardware, rotary ports and seals, two-stroke scavenging and pipes, oil, cooling, exhaust, mufflers, launch control, 6 finishes |
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

### Career (`src/app/state.js`, `career.js`, `team.js` and the files named below)

- **Reputation** tiers (`REP_TIERS`): Backyard 0, Local shop 40, Known builder 120, Regional supplier 300, OEM partner 700, Legend 1500, Dynasty 3000.
- **Team seasons** (`team.js`, since 1.76.33.0): the main job. Each season up to three teams call (four with the Showroom hall; a passed offer's place fills when the week closes), each with a driver style (steady hand, hot shoe, rookie, veteran), one series for 8 rounds, a parts budget and a season fee. Series (`PC_EVENTS`) open with rep and only call once the dyno can read the power their field makes: Street drags and Street Stock oval at 0 rep; Gasser drags and Late Model oval at 40; Outlaw radial, Pro stock (naturally aspirated) and Open oval at 120; Pro mod at 300; Funny car at 700; Top dragster at 1,500. The budget pays for the engine: the first build, then any engine change (15% teardown plus any parts that cost more), freshen-up (15%) or rebuild after a breakage (30%); the Tooling hall takes 25% off changes and rebuilds. A new engine needs a certified pull of that exact build. A round runs every other week: race it from the Team tab once it is due, or Close week races it with the season engine as it stands (a broken or missing engine sits it out). Race day is auto-simulated through the real drag and oval physics against the series' fixed rivals, who find 1.5% more power every round; every car scores points (drag 20/14/9/4, oval 20 down to 2). Each round wears the engine 4 reliability points times the style (the Quality lab takes 30% off). Since 1.76.35.0 each round has its own weather: the calendar sets the mean (career week 1 is early May, July is warmest at about 21 °C, and the mean never drops below 5 °C), each round draws its own day around it, and the drags visit a different strip each round (180 to 1,100 m). The team card shows the forecast and race day lands within a couple of degrees of it. The field's power moves with air density to the 0.8 power, so an atmospheric engine feels thin air a little more than the field and a blown one less. After round 4 a mid-season beat sets up round 5: a showcase (double points and round bonus for everyone), an away round (oval only: the other surface), or the driver's ask (steady hand: 90% reliability; hot shoe: 5% more power than the season engine; rookie: a fresh engine; veteran: a podium), which pays 10% of the season fee and rep if delivered and costs a little rep if not. A rookie gains 0.03 skill every round raced (up to 0.88) and their team pays 15% more. Offers and the season card say where the engine on the bench would run on power against the field.
- **Team pay** (shares of the season fee, `PC_RETAIN`, `PC_RBONUS`, `PC_CBONUS`): 4% for each round raced, a podium bonus of 8/4/2%, a title bonus of 25/12/6% for the top three. Season fees by tier: $60–80k, $130–170k, $280–380k, $600–780k, $1.2–1.6M, $2.4–3.2M. Rep per round and for the title is scaled by the tier (x1, 1.5, 2.5, 4, 6, 9). A top-two finish brings the same team back with 20% more budget and fee.
- **Events** are side income: the purses, records and rep at all ten events are as before, and sponsors and rivals count them.
- **Certification**: a clean dyno pull in the standard cell. It lets an engine race the events and go to a team. The dyno ladder is the starter chassis dyno (400 hp), then the Engine dyno (1,000 hp), Pro dyno cell (2,000 hp, climate control), Outlaw dyno cell (3,500 hp) and Monster dyno cell (15,000 hp / 14,000 rpm), bought as upgrades `dyno2` to `dyno5`.
- **Shop**: 15 upgrades (`UPGRADES`), 3 staff roles (`STAFF`) that become named crew with levels 1 to 5, traits and morale (`crew.js`), 12 R&D projects (`RND`), 3 prestige items (`PRESTIGE`), 32 goals (`GOALS`), a loan.
- **Sponsors** (`career.js`): never ask for an event the shop cannot enter; track day counts as an event.
- **Rival shops** (`rivals.js`): three made-up shops on the reputation board that throw down head-to-head challenges at the strip, the pull, Pikes Peak, the bog, the boats, the oval, track day, the salt and the 24 Hours.
- **Legacy** (`legacy.js`): at Legend rep the owner can sell the shop. The sale value becomes Legacy points under their own storage key; points buy permanent perks for the next career.
- **Achievements**: 95 (`ACH`) in 14 groups, bronze, silver and gold. **Trophy room** (`trophy.js`): a dated log of wins per mode.

### Graphics (`src/vis/`, `ENGINE_VIS`)

three.js r128. The engine mesh is built from the config: banks, heads, intake, turbos and blowers, exhaust, accessory drive, belts that move with the pulleys, lettering and wiring at higher detail. Scenes: the garage and workshop, the strip (venue, crowd, cars per class, nitro classes), pits, pull track, bog (trucks per class, mud FX, heightfield pit), boats, road course, salt flats (Speed Week pit town), Pikes Peak (heightfield mountain with LOD), the oval, the trophy room, photo mode, and a teardown view after a failure.

Three tiers, `lite`, `full`, `ultra` (`app/perf.js`). Lite is the phone default. Since 1.76.36.0 every door car (the strip's street to pro stock shells, and the road, hill, oval, pits and salt cars built on them) has open windows on Full and Ultra: tinted see-through glass with a black border, a cabin behind it (dash, seats, wheel, a helmeted driver, a cage on the race classes), door handles, hood and boot shut lines, front and rear brakes, round tyres with lug nuts; Lite keeps the old dark glass and is drawn exactly as before. Auto-adjust watches the frame rate and steps one tier down if it stays under about 27 fps for about 8 s; it never steps up. Bloom and SSAO addons load only for Full and Ultra.

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
| Part tables / options | 56 / 268 | `OPT` |
| Config settings on a build | 73 | `DEFAULT_CFG` |
| Build form groups | 14 | `FORM` |
| Base engines | 96 | `PRESETS` |
| Fuels | 15 | `OPT.fuel` |
| Event types | 10 | `EV_T` |
| Dyno tests | 3 | `DYNO_T` |
| Swap vehicles | 20 in 5 groups | `VEHICLES`, `VEH_GROUPS` |
| Team series | 10 (7 drag, 3 oval) | `PC_EVENTS` |
| Shop upgrades / staff roles / R&D / prestige / goals | 15 / 3 / 12 / 3 / 32 | `state.js` tables |
| Reputation tiers | 7 | `REP_TIERS` |
| Achievements | 95 in 14 groups | `ACH`, `ACH_GROUPS` |
| Guided lessons | 17 | `LESSONS` |
| Engine recordings | 51 | `sounds/` |
| Source files in the build | 111 | `src/manifest.txt` |
| Built page | 3.57 MB (1.16 MB gzipped) | `node build.js` |

## Loose ends found in the code (as of 1.76.28.1)

Only things the code or docs themselves flag:

- `docs/fastest-drag-car.md` says it is stale: its build sheets were run on 1.76.21.0 before drivetrain tiers, the rev limiter and the strip's engine-weight rule.
- `app/salt.js` shows a placeholder line in Analysis while a salt record it has not computed yet is being worked out.

Nothing else is stubbed or marked unfinished in `src/`.
