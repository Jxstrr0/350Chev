# Fastest quarter mile in PEW — with engine weight on the strip

All four cars were run in the real app (Events → Drag strip, Auto driver, three passes each) on v1.76.21.0, branch `claude/drivetrain-tiers-limiter`. ET and trap speed are from the timing slip.

Two rule changes since the last sheet:

- **The strip counts engine weight.** The car-weight slider means the car with a typical 230 kg V8 in it; the engine you actually fit adds or saves the difference. The readout under the slider shows the total ("1,013 kg with this engine"). A 1,228 kg Deltic now drags 998 kg of its own iron down the track.
- **The Monster dyno cell (and the sandbox cell) read to 15,000 hp / 14,000 rpm.** So the 12,674 hp engine is now certifiable in career: there is no longer a separate career-legal build.

| | Fastest overall | Four-stroke, no Deltic, sane weight | Two-stroke, no Deltic |
|---|---|---|---|
| Engine | 12,674 hp · 15,665 N·m · 1,228 kg · Deltic two-stroke, twin-screw + 700 progressive nitrous | **4,371 hp · 4,674 N·m · 443 kg · V12 60° four-stroke, compound turbos on methanol, no nitrous** | 4,511 hp · 4,277 N·m · 443 kg · V12 60° two-stroke, Roots scavenge blower, NA + 700 progressive nitrous |
| Car on the strip | 1,968 kg (slider 970) | 1,013 kg (slider 800) | 1,013 kg (slider 800) |
| In-app passes | 4.268 · 4.404 · 4.268 s @ 358 mph | 4.620 · 4.612 · 4.612 s @ 315 mph | 4.664 · 4.668 · 4.664 s @ 308 mph |
| Passes before a freshen | 175 | 28 | 20 |
| Breaks in 12 sim passes | none | none | none |

The 9,497 hp / 736 kg Deltic (wrc16 seed) ties the big one at 4.268–4.272 s @ 364 mph with a 1,306 kg car, and it is the better car of the two: the 1,228 kg engine only matches it because it has 3,000 hp more to drag itself with. Its sheet is at the end if you want it.

## The four-stroke

Four-strokes top out at about 4,450 hp clean in this sim: the climb tried every setting one and two at a time from three seeds (the compound 402, the Pro 540 and the outlaw pro-mod V10) and the next step up in boost, bore or nitrous always trips Fuel delivery, Detonation margin, Compressor flow or Rod buckling. V12 is the biggest four-stroke layout and 110 mm the biggest bore in the UI. So 4.60 s is where a four-stroke ends up: 0.34 s behind the Deltics, 0.5 s slower than the old no-weight record, and the whole gap is power, not weight (it is already 950 kg lighter on the strip).

Of the four-strokes tried: compound 402 V12 4.61 s · outlaw pro-mod V10 (3,981 hp, 467 kg) 4.69 s · Pro 540 V12 (4,619 hp, 658 kg) 4.99 s · K24-based V12 5.25 s · 632 nitrous V10 5.44 s.

### Car setup — four-stroke (4.61 s)

| Setting | Value |
|---|---|
| Body | Dragster (rail) — pick it, then edit the rest |
| Car weight (slider) | 800 kg |
| Rear weight | 0.85 |
| Tyre | Slick, 36" |
| Gears | 4 |
| 1st gear | 2.25:1 |
| Top gear | 0.95:1 |
| Final drive | 2.75:1 |
| Shifting | Manual box (the Auto driver shifts it at the torque crossover) |
| Clutch, box & axle | Pro (Advanced → Driveline) |
| Tyre pressure | 6 psi (Advanced → Driveline) |
| Shocks | Soft |
| Chute | Yes |
| Nitrous | none on this build |
| Launch | Two-step at 7500 rpm with 35° launch retard (set on the build) · line lock |
| Driver | Auto |

### Build sheet — four-stroke V12 (4,371 hp, 443 kg)

Lines marked _(default)_ are untouched.

**Engine layout**  
- Layout: V12 60°
- Cycle: Four-stroke _(default)_

**Bore & stroke**  
- Bore: 109.75 mm
- Stroke: 116.0 mm
- Rod ratio L/r: 2.10
- Compression ratio: 9.5 :1

**Block & head materials**  
- Block material: Billet 7000 alu
- Head material: Aluminium head
- Valvetrain layout: Billet hemi 4v

**Pistons & rings**  
- Piston alloy: Billet 2618 + TBC
- Piston clearance: Loose 0.0047 in
- Ring pack: Steel, drag gap

**Rods & crank**  
- Connecting rods: Billet alu rod
- Rod bolts: Custom Age 625+
- Crankshaft: Billet 300M crank
- Torsional damper: Viscous damper
- Main/rod bearings: Poly-coated tri

**Valvetrain**  
- Valve material: Inconel 751 valve
- Valve springs: Single spring _(default)_
- Cam duration / overlap: 78
- Valve lift: 100
- Redline: 7800 rpm

**Induction & boost**  
- Intake system: Individual throttles
- Aspiration: Compound turbos
- Boost pressure: 2.50 bar
- Turbo size: 98 mm frame
- Hot-side material: Inconel 713C hot end
- Turbine geometry: Variable-geometry (VGT)
- Anti-lag: Secondary-air ALS
- Charge cooler: No intercooler _(default)_
- Exhaust manifold: Merge-collector 4-1

**Exhaust system**  
- Pipe size: Open headers

**Fuel & tune**  
- Fuel: Methanol M100
- Injectors: 4 × 2200 cc
- Fuel pump: Big belt-drive pump
- Nitrous: No nitrous _(default)_
- Ignition vs MBT: 0.0 ° _(default)_
- Lambda: 0.81 λ

**Launch control**  
- Launch control: Two-step + launch retard
- Two-step rpm: 7500 rpm
- Launch retard: 35 °
- Brake aids: Line lock

**Lubrication & cooling**  
- Oil grade: 0W-20 full syn
- Oil system: Wet sump _(default)_
- Piston cooling jets: Piston cooling jets
- Cooling package: Race cooling pack

**Sealing**  
- Head gasket: Copper + O-ring
- Head fasteners: 9/16 studs, six

## The two-stroke that isn’t a Deltic

A two-stroke on any ordinary layout caps out around 4,500 hp, barely above the four-stroke wall, and for a different reason. Every cylinder fires every turn, so a 12.1 L two-stroke V12 breathes like a 24 L four-stroke, and the next step in boost, revs or port timing trips Crank torsional, Head clamp margin and Heat rejection all at once. The Deltic gets round that because it has no heads to clamp (opposed pistons) and 36 pistons to share the load. This one is a 12,145 cc V12 on methanol with a Roots scavenge blower, no turbo, 700 progressive nitrous and a chamber cut for 7,400 rpm, revving to 8,400. It weighs the same as the four-stroke V12 (443 kg) and makes 140 hp more, but its usable band is only 6,000–8,400 rpm, so it wants a five-speed and still runs 0.05 s behind the four-stroke.

Of the two-stroke builds tried (seeds from the pool plus the three Deltic winners re-laid as V12s and repaired): this NA V12 4.66 s · compound-turbo V12 (4,391 hp, 411 kg) 4.70 s · long-stroke NA V12 (4,540 hp, 463 kg) 4.79 s · twin-screw V12 (4,185 hp) 4.81 s · V10s and V8s 4.95 s and up. Rotaries cannot run the two-stroke cycle, and the single, twin and V4 two-stroke layouts are too small to matter.

### Car setup — two-stroke V12 (4.66 s)

| Setting | Value |
|---|---|
| Body | Dragster (rail) — pick it, then edit the rest |
| Car weight (slider) | 800 kg (1,013 kg with this engine) |
| Rear weight | 0.85 |
| Tyre | Slick, 23.75" |
| Gears | 5 |
| 1st gear | 1.75:1 |
| Top gear | 0.65:1 |
| Final drive | 3.00:1 |
| Shifting | Manual box (the Auto driver shifts it at the torque crossover) |
| Clutch, box & axle | Pro (Advanced → Driveline) |
| Tyre pressure | 6 psi (Advanced → Driveline) |
| Shocks | Soft |
| Chute | Yes |
| Nitrous | 700 progressive, armed in the window |
| Launch | Two-step at 6600 rpm with 20° launch retard (set on the build) · line lock |
| Driver | Auto |

### Build sheet — two-stroke V12 (4,511 hp, 443 kg)

Lines marked _(default)_ are untouched.

**Engine layout**  
- Layout: V12 60°
- Cycle: Two-stroke

**Bore & stroke**  
- Bore: 110.0 mm
- Stroke: 106.5 mm
- Rod ratio L/r: 1.69
- Trapped compression ratio: 12.0 :1

**Block & head materials**  
- Block material: Nikasil alu (AlSi17)
- Deck construction: Closed deck
- Head material: Aluminium head

**Pistons & rings**  
- Piston alloy: Forged 2618-T61
- Piston clearance: Standard 0.0030 in _(default)_
- Ring pack: Gas-nitrided steel

**Rods & crank**  
- Connecting rods: Billet alu rod
- Rod bolts: ARP2000 bolt
- Crankshaft: Forged 4340 crank
- Torsional damper: Solid hub
- Main/rod bearings: Trimetal Cu-Pb

**Ports & revs**  
- Scavenging: Loop (Schnürle) _(default)_
- Exhaust port duration: 183 °
- Transfer port duration: 145 °
- Power valve: No power valve _(default)_
- Redline: 8400 rpm

**Induction & boost**  
- Induction: Roots scavenge blower
- Fuel delivery: Carburettor _(default)_
- Aspiration: Naturally aspirated _(default)_

**Exhaust system**  
- Two-stroke exhaust: Expansion chamber _(default)_
- Pipe tuned to: 7400 rpm
- Pipe size: Open headers

**Fuel & tune**  
- Fuel: Methanol M100
- Fuel pump: Big belt-drive pump
- Nitrous: 700 progressive
- CDI timing vs MBT: 0.0 ° _(default)_
- Lambda: 0.81 λ

**Launch control**  
- Launch control: Two-step limiter
- Two-step rpm: 6600 rpm
- Brake aids: Line lock

**Lubrication & cooling**  
- Oil grade: 0W-20 full syn
- Oil system: Dry sump
- Piston cooling jets: Piston cooling jets
- Cooling package: Stock radiator _(default)_

**Sealing**  
- Head gasket: MLS gasket
- Head fasteners: ARP head studs

## Fastest overall — 12,674 hp Deltic

### Car setup (4.27 s)

| Setting | Value |
|---|---|
| Body | Dragster (rail) — pick it, then edit the rest |
| Car weight (slider) | 970 kg |
| Rear weight | 0.85 |
| Tyre | Slick, 36" |
| Gears | 4 |
| 1st gear | 1.25:1 |
| Top gear | 0.65:1 |
| Final drive | 2.75:1 |
| Shifting | Manual box (the Auto driver shifts it at the torque crossover) |
| Clutch, box & axle | Pro (Advanced → Driveline) |
| Tyre pressure | 6 psi (Advanced → Driveline) |
| Shocks | Soft |
| Chute | Yes |
| Nitrous | Bottle heater on · shot comes on: Window switch |
| Launch | Two-step at 5200 rpm (set on the build) · line lock |
| Driver | Auto |

Note the slider is 970 kg, not the 800 minimum: with 1,228 kg of engine the car is traction-limited the whole way and a little ballast over the tyres was worth more than it cost.

### Build sheet (12,674 hp, 1,228 kg)

Switch **Cycle** to Two-stroke first (the Deltic layout only appears then), then set the rest.

**Engine layout**  
- Layout: Deltic triangle
- Cycle: Two-stroke

**Bore & stroke**  
- Bore: 110.0 mm
- Stroke: 120.0 mm
- Rod ratio L/r: 1.78
- Trapped compression ratio: 12.0 :1

**Block & head materials**  
- Block material: Nikasil alu (AlSi17)
- Deck construction: Closed deck
- Head material: Aluminium head

**Pistons & rings**  
- Piston alloy: Forged 2618-T61
- Piston clearance: Tight 0.0019 in
- Ring pack: Gas-nitrided steel

**Rods & crank**  
- Connecting rods: Ti-6Al-4V rod
- Rod bolts: Custom Age 625+
- Crankshaft: Billet 300M crank
- Torsional damper: Viscous damper
- Main/rod bearings: Poly-coated tri

**Ports & revs**  
- Scavenging: Uniflow
- Exhaust port duration: 195 °
- Transfer port duration: 143 °
- Power valve: Exhaust power valve
- Redline: 5900 rpm

**Induction & boost**  
- Induction: Roots scavenge blower
- Fuel delivery: Carburettor _(default)_
- Aspiration: Twin-screw blower
- Boost pressure: 0.80 bar
- Charge cooler: No intercooler _(default)_

**Exhaust system**  
- Two-stroke exhaust: Straight pipe / stinger
- Pipe size: Open headers

**Fuel & tune**  
- Fuel: Oxygenated 112
- Fuel pump: Big belt-drive pump
- Nitrous: 700 progressive
- CDI timing vs MBT: 7.75 °
- Lambda: 0.87 λ

**Launch control**  
- Launch control: Two-step limiter
- Two-step rpm: 5200 rpm
- Brake aids: Line lock

**Lubrication & cooling**  
- Oil grade: 0W-20 full syn
- Oil system: Dry sump
- Piston cooling jets: Piston cooling jets
- Cooling package: Race cooling pack

**Sealing**  
- Head gasket: Copper + O-ring
- Head fasteners: ARP head studs

## The light Deltic — 9,497 hp, 736 kg (4.27 s)

### Car setup

| Setting | Value |
|---|---|
| Body | Dragster (rail) — pick it, then edit the rest |
| Car weight (slider) | 800 kg |
| Rear weight | 0.85 |
| Tyre | Slick, 35.5" |
| Gears | 5 |
| 1st gear | 1.25:1 |
| Top gear | 0.60:1 |
| Final drive | 3.25:1 |
| Shifting | Manual box (the Auto driver shifts it at the torque crossover) |
| Clutch, box & axle | Pro (Advanced → Driveline) |
| Tyre pressure | 6 psi (Advanced → Driveline) |
| Shocks | Soft |
| Chute | Yes |
| Nitrous | Bottle heater on · shot comes on: Window switch |
| Launch | Two-step at 5300 rpm with 10° launch retard (set on the build) · line lock |
| Driver | Auto |

### Build sheet

**Engine layout**  
- Layout: Deltic triangle
- Cycle: Two-stroke

**Bore & stroke**  
- Bore: 80.25 mm
- Stroke: 113.5 mm
- Rod ratio L/r: 1.90
- Trapped compression ratio: 9.0 :1
- Crankcase compression: 1.70 :1

**Block & head materials**  
- Block material: A356-T6 + Fe liners
- Deck construction: Closed deck
- Head material: Aluminium head

**Pistons & rings**  
- Piston alloy: Forged 2618-T61
- Piston clearance: Loose 0.0047 in
- Ring pack: Gas-nitrided steel

**Rods & crank**  
- Connecting rods: Forged 300M
- Rod bolts: Custom Age 625+
- Crankshaft: Nitrided 4340
- Torsional damper: Elastomer damper _(default)_
- Main/rod bearings: Poly-coated tri

**Ports & revs**  
- Scavenging: Loop (Schnürle) _(default)_
- Exhaust port duration: 204 °
- Transfer port duration: 145 °
- Power valve: Exhaust power valve
- Redline: 6700 rpm

**Induction & boost**  
- Induction: Reed valve _(default)_
- Fuel delivery: Carburettor _(default)_
- Aspiration: Twin-screw blower
- Boost pressure: 2.25 bar
- Charge cooler: Race W2A + water-meth

**Exhaust system**  
- Two-stroke exhaust: Expansion chamber _(default)_
- Pipe tuned to: 6500 rpm
- Pipe size: Open headers

**Fuel & tune**  
- Fuel: Leaded race 100
- Fuel pump: Big belt-drive pump
- Nitrous: 100 + 150 plates
- CDI timing vs MBT: 8.0 °
- Lambda: 0.79 λ

**Launch control**  
- Launch control: Two-step + launch retard
- Two-step rpm: 5300 rpm
- Launch retard: 10 °
- Brake aids: Line lock

**Lubrication & cooling**  
- Two-stroke oiling: Oil injection
- Cooling package: Race cooling pack

**Sealing**  
- Head gasket: MLS gasket
- Head fasteners: ARP head studs
