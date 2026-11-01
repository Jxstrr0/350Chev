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
- **Team seasons** (`team.js`, since 1.76.33.0): the main job. Each season up to three teams call (four with the Showroom hall; a passed offer's place fills when the week closes), each with a driver style (steady hand, hot shoe, rookie, veteran), one series for 8 rounds, a parts budget and a season fee. Series (`PC_EVENTS`) open with rep and only call once the dyno can read the power their field makes: Street drags and Street Stock oval at 0 rep; Gasser drags and Late Model oval at 40; Outlaw radial, Pro stock (naturally aspirated) and Open oval at 120; Pro mod at 300; Funny car at 700; Top dragster at 1,500. The budget pays for the engine: the first build, then any engine change (15% teardown plus any parts that cost more), freshen-up (15%) or rebuild after a breakage (30%); the Tooling hall takes 25% off changes and rebuilds. A new engine needs a certified pull of that exact build. A round runs every other week: race it from the Team tab once it is due, or Close week races it with the season engine as it stands (a broken or missing engine sits it out). Race day is auto-simulated through the real drag and oval physics against the series' fixed rivals, who find 1.5% more power every round; every car scores points (drag 20/14/9/4, oval 20 down to 2). Each round wears the engine 4 reliability points times the style (the Quality lab takes 30% off). Since 1.76.35.0 each round has its own weather: the calendar sets the mean (career week 1 is early May, July is warmest at about 21 °C, and the mean never drops below 5 °C), each round draws its own day around it, and the drags visit a different strip each round (180 to 1,100 m). The team card shows the forecast and race day lands within a couple of degrees of it. The field's power moves with air density to the 0.8 power, so an atmospheric engine feels thin air a little more than the field and a blown one less. After round 4 a mid-season beat sets up round 5: a showcase (double points and round bonus for everyone), an away round (oval only: the other surface), or the driver's ask (steady hand: 90% reliability; hot shoe: 5% more power than the season engine; rookie: a fresh engine; veteran: a podium), which pays 10% of the season fee and rep if delivered and costs a little rep if not. A rookie gains 0.03 skill every round raced (up to 0.88) and their team pays 15% more. Offers and the season card say where the engine on the bench would run on power against the field. Since 1.76.45.0 the team picks a race-morning map for each round (Safe: 3% less power, +6 reliability, 70% of the wear; Race: as certified; Hero: 4% more power, −8 reliability, 150% of the wear); a steady hand and a rookie drive best on Safe and a hot shoe on Hero (+0.03 skill), and each loses the same on the opposite map; Close week races on the chosen map. A season allows three engines: the first build, every engine change and every rebuild after a breakage use one (a freshen-up doesn't), and the round a fourth or later goes in, the team starts from the back (seeded 8th at the drags, last on the grid at the oval). Each kind of series plugs into `PC_KIND` in `team.js`.
- **Team pay** (shares of the season fee, `PC_RETAIN`, `PC_RBONUS`, `PC_CBONUS`): 4% for each round raced, a podium bonus of 8/4/2%, a title bonus of 25/12/6% for the top three. Season fees by tier: $60–80k, $130–170k, $280–380k, $600–780k, $1.2–1.6M, $2.4–3.2M. Rep per round and for the title is scaled by the tier (x1, 1.5, 2.5, 4, 6, 9). A top-two finish brings the same team back with 20% more budget and fee.
- **Events** are side income: the purses, records and rep at all ten events are as before, and sponsors and rivals count them.
- **Certification**: a clean dyno pull in the standard cell. It lets an engine race the events and go to a team. The dyno ladder is the starter chassis dyno (400 hp), then the Engine dyno (1,000 hp), Pro dyno cell (2,000 hp, climate control), Outlaw dyno cell (3,500 hp) and Monster dyno cell (15,000 hp / 14,000 rpm), bought as upgrades `dyno2` to `dyno5`.
- **Shop**: 15 upgrades (`UPGRADES`), 3 staff roles (`STAFF`) that become named crew with levels 1 to 5, traits and morale (`crew.js`), 12 R&D projects (`RND`), 3 prestige items (`PRESTIGE`), 32 goals (`GOALS`), a loan.
- **Sponsors** (`career.js`): never ask for an event the shop cannot enter; track day counts as an event.
- **Rival shops** (`rivals.js`): three made-up shops on the reputation board that throw down head-to-head challenges at the strip, the pull, Pikes Peak, the bog, the boats, the oval, track day, the salt and the 24 Hours.
- **Legacy** (`legacy.js`): at Legend rep the owner can sell the shop. The sale value becomes Legacy points under their own storage key; points buy permanent perks for the next career.
- **Achievements**: 95 (`ACH`) in 14 groups, bronze, silver and gold. **Trophy room** (`trophy.js`): a dated log of wins per mode.

### Graphics (`src/vis/`, `ENGINE_VIS`)

three.js r128. The engine mesh is built from the config: banks, heads, intake, turbos and blowers, exhaust, accessory drive, belts that move with the pulleys (every pulley carries a paint mark, and the turning is drawn at a speed the screen can show, so nothing strobes), lettering and wiring at higher detail. Scenes: the garage and workshop, the strip (venue, crowd, cars per class, nitro classes), pits, pull track, bog (trucks per class, mud FX, heightfield pit), boats, road course, salt flats (Speed Week pit town), Pikes Peak (heightfield mountain with LOD), the oval, the trophy room, photo mode, and a teardown view after a failure. The engine sits on a welded run stand built to fit it: the cradle's pads meet that engine's sump at its length, width and height. In the shop it is clay-painted on swivel casters; in the test cell it is grey, on levelling feet clamped to a cast-iron T-slot bedplate.

Three tiers, `lite`, `full`, `ultra` (`app/perf.js`). Lite is the phone default. Auto-adjust watches the frame rate and steps one tier down if it stays under about 27 fps for about 8 s; it never steps up. Bloom and SSAO addons load only for Full and Ultra. If it is already on Lite and still stutters, it turns the glass effects off for the session. Since 1.76.38.0 every door car (the strip's street to pro stock shells, and the road, hill, oval, pits and salt cars built on them) has open windows on Full and Ultra: tinted see-through glass with a black border, a cabin behind it (dash, seats, wheel, a helmeted driver, a cage on the race classes), door handles, hood and boot shut lines, front and rear brakes, round tyres with lug nuts; Lite keeps the old dark glass and is drawn exactly as before.

**Shop Glass** (`css/ui-glass.css`, plan in `docs/UI-GLASS-PLAN.md`): frosted, translucent surfaces with a bright rim over a dim ambient glow. On a phone the panel sits on the bottom edge of the 3D view with a rounded glass top, and the tab bar floats as a glass pill with a bead that slides to the active tab. The HUD buttons are clear glass, with an inner glow when on. Blur scales by tier (12 px Lite, 20 Full, 28 Ultra); on Lite the panel and the HUD buttons over the live view get a stronger tint instead of a blur. Inside the panel, build rows, cards and option buttons are a lighter glass fill with a bright rim (never a second blur). The picked option is orange-tinted glass with an inner glow. The orange, green and red race buttons are chamfered with a glossy gel finish and glow lines; every other button is glass. Parts sheets, Settings, the tour and First Fire cards, toasts and tooltips are strong glass that springs in. Sliders have a glass track and a glossy orange thumb, and controls dip slightly when pressed. Settings › Display › Glass effects turns it all solid, and so does the system Reduce Transparency setting. The glass reacts to the game. A failure cracks it: jagged cracks spread from the engine in a quarter second, with a short shake and a white flash on the rims, bigger for an engine that's gone (rod, crank) than for a steam or turbo failure, then fade. The panel's top rim, the tab bar and the rail warm toward the venue colour with the revs and turn pulsing red near redline. And the glass takes on each venue's light (`VENUE_TINT` in `state.js`): orange in the garage, warm at the strip by day and blue at night, pale at the salt flats, blue on the water, and so on. On a phone, three touch gestures sit on top of the existing controls. Swiping the panel sideways moves to the next or previous tab through the tab bar's own click, so it behaves like a tap or the 1 to 6 keys. It needs about 60 px of mostly horizontal travel. The page leans with the finger and bounces back at the first and last tab, and the swipe is ignored over the 3D view, sliders and inputs, charts, the tune map, rows that scroll sideways, open sheets, tours, and while a test or event is running. A grabber on the panel's top lip drags the panel between three heights: tall (the same state as VIEW › Size), the default half, and peek, a tall engine view over a short panel. The height you leave it at comes back on the next visit. The view resizes live while you drag, snaps to the nearest height on release, and a tap steps through the three. Holding a part option for about half a second, in a Build row or in a parts sheet, opens a glass card comparing it with the fitted part (peak power, reliability, build cost, weight and part price), with a light buzz. Releasing closes the card without fitting the part. The gestures use touch and pen only, so the mouse, keyboard and desktop layout work as before. After a run the player drives (a dyno test or an event, never a team race day or Close week), a full-screen glass card shows the headline (`app/rcard.js`): a big hero number (peak hp on the dyno; ET, mile mph, distance, time or place at the events), the verdict chip, the change from the last run of the same test, and on the dyno the curve over a faint dashed ghost of the previous pull, or of the pinned baseline. Run it again, Back to build and Share (a 1080 × 1350 picture through the photo mode's save and share) sit at the bottom. Tap outside, swipe down or Esc closes it. Events wait for the after-run scene to end first, and a verdict with its own buttons (the pull-off) skips the card. Where the browser has View Transitions, the engine card grows into it. A trophy won on the run shows on the card as a holographic plate, and the trophy room's plaque card gets the same sheen: a rainbow glare that follows the phone's tilt (iOS asks permission on the first tap) or a finger, and stays still on Lite and under reduced motion. Settings › Display › Results card turns the card off. A workshop monitor on a low rolling stand sits behind and left of the engine stand, in both the test cell and the career shop, placed so it shows on a phone in portrait (between the top buttons and the engine card) as well as on desktop. During a dyno pull it draws the power and torque curves as they climb, with a big rpm and hp readout. Endurance and over-rev runs show rpm and hours, and the screen turns red with FAIL if the engine breaks. When idle it shows the last result for the current build, or the Prairie Engine Works name if there isn't one. The career dyno console shows the same picture. The app draws the screen (`MON_TIER`, `MON_LAY` in `test.js`) and the 3D side only displays it (`ENGINE_VIS.setScreen`). Lite uses a small screen updated at most 8 times a second; Full and Ultra use a sharper one at up to 15, and nothing redraws while idle. On Ultra a dyno pull also eases the camera toward the monitor and back (`SCREEN_DOLLY` in `garage.js`), unless the device asks for reduced motion.

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
