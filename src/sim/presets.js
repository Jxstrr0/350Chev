  /* =====================================================================
     17.  PRESETS — archetypes modelled on real engines, with the real
          bore/stroke/CR/redline/head/aspiration and the published output.
     ===================================================================== */
  function P(o) { return o; }
  const PRESETS = [
    /* ---- starter archetypes: every part is base-shop stock, so they certify on day one ---- */
    P({
      id: "g10", name: "One-litre triple", basedOn: "Suzuki G10", starter: true,
      blurb: "993 cc three-cylinder, 74×77, single cam and a carburettor. Fifty-odd horsepower and it sips fuel — the city-hatchback engine.",
      soundProfile: null, realHp: 55, realRpm: 5700, realNm: 88,
      cfg: {
        layout: "I3", bore: 74, stroke: 77, rodRatio: 1.7, cr: 9.5,
        blockMat: "grey_iron", deck: "open", headMat: "alu", head: "sohc2v",
        valveMat: "steel", springs: "single", cam: 30, lift: 55, redline: 6000,
        piston: "cast_alu", pistonClearance: "standard", rings: "moly",
        rod: "cast_steel", rodBolts: "oem", crank: "cast_nodular", damper: "none",
        bearings: "bimetal", gasket: "composite", studs: "bolts_tty",
        intake: "carb", asp: "na", turboSize: "small", turbineMat: "cast_iron",
        ic: "none", boost: 0.6, fuel: "r87", timing: 0, lambda: 0.95,
        oilGrade: "w5_30", oilSystem: "wet", oilSquirters: "none",
        cooling: "std", exhaust: "cast_log", cover: "silver"
      }
    }),
    P({
      id: "4ac", name: "Sixteen-hundred SOHC", basedOn: "Toyota 4A-C", starter: true,
      blurb: "1.6 L iron-block four with an aluminium eight-valve head, 81×77. Ninety-odd horsepower that ran 300,000 km in a million Corollas.",
      soundProfile: null, realHp: 90, realRpm: 5600, realNm: 130,
      cfg: {
        layout: "I4", bore: 81, stroke: 77, rodRatio: 1.6, cr: 9.3,
        blockMat: "grey_iron", deck: "open", headMat: "alu", head: "sohc2v",
        valveMat: "steel", springs: "single", cam: 35, lift: 55, redline: 6200,
        piston: "cast_alu", pistonClearance: "standard", rings: "moly",
        rod: "cast_steel", rodBolts: "oem", crank: "cast_nodular", damper: "rubber",
        bearings: "bimetal", gasket: "composite", studs: "bolts_tty",
        intake: "single_tb", asp: "na", turboSize: "small", turbineMat: "cast_iron",
        ic: "none", boost: 0.6, fuel: "r87", timing: 0, lambda: 0.95,
        oilGrade: "w5_30", oilSystem: "wet", oilSquirters: "none",
        cooling: "std", exhaust: "cast_tubular", cover: "black"
      }
    }),
    P({
      id: "22re", name: "Two-four truck four", basedOn: "Toyota 22R-E", starter: true,
      blurb: "2.4 L, 92×89 undersquare, 9:1 and a lazy cam. Not fast, but 200 Nm at 3,300 rpm and a reputation for never dying — the van and pump engine.",
      soundProfile: null, realHp: 116, realRpm: 4800, realNm: 190,
      cfg: {
        layout: "I4", bore: 92, stroke: 89, rodRatio: 1.6, cr: 9.0,
        blockMat: "grey_iron", deck: "open", headMat: "alu", head: "sohc2v",
        valveMat: "steel", springs: "single", cam: 30, lift: 50, redline: 5500,
        piston: "cast_alu", pistonClearance: "standard", rings: "moly",
        rod: "cast_steel", rodBolts: "oem", crank: "cast_nodular", damper: "rubber",
        bearings: "bimetal", gasket: "composite", studs: "bolts_tty",
        intake: "single_tb", asp: "na", turboSize: "small", turbineMat: "cast_iron",
        ic: "none", boost: 0.6, fuel: "r87", timing: 0, lambda: 0.93,
        oilGrade: "w10_40", oilSystem: "wet", oilSquirters: "none",
        cooling: "std", exhaust: "cast_log", cover: "blue"
      }
    }),
    P({
      id: "ea82", name: "Flat-four 1.8 SOHC", basedOn: "Subaru EA82", starter: true,
      blurb: "Oversquare 92×67 boxer, 1.8 L, single cam per bank. Only 90 horsepower, but the opposed layout makes it the smoothest thing in the starter bay.",
      soundProfile: "f4_rumble", realHp: 90, realRpm: 5600, realNm: 137,
      cfg: {
        layout: "F4", bore: 92, stroke: 67, rodRatio: 1.9, cr: 9.0,
        blockMat: "grey_iron", deck: "open", headMat: "alu", head: "sohc2v",
        valveMat: "steel", springs: "single", cam: 22, lift: 40, redline: 5500,
        piston: "cast_alu", pistonClearance: "standard", rings: "moly",
        rod: "cast_steel", rodBolts: "oem", crank: "cast_nodular", damper: "rubber",
        bearings: "bimetal", gasket: "composite", studs: "bolts_tty",
        intake: "carb", asp: "na", turboSize: "small", turbineMat: "cast_iron",
        ic: "none", boost: 0.6, fuel: "r87", timing: 0, lambda: 0.95,
        oilGrade: "w5_30", oilSystem: "wet", oilSquirters: "none",
        cooling: "std", exhaust: "cast_log", cover: "silver"
      }
    }),
    P({
      id: "l36", name: "Three-eight pushrod V6", basedOn: "GM 3800 Series II", starter: true,
      blurb: "3.8 L 90° pushrod six, 96.5×86.4, iron top to bottom. Lazy cam, big torque low down, and it will run forever — the biggest engine the starter bay can build.",
      soundProfile: null, realHp: 205, realRpm: 5200, realNm: 312,
      cfg: {
        layout: "V6", bore: 96.5, stroke: 86.4, rodRatio: 1.7, cr: 9.0,
        blockMat: "grey_iron", deck: "open", headMat: "iron", head: "pushrod2v",
        valveMat: "steel", springs: "single", cam: 22, lift: 40, redline: 5400,
        piston: "cast_alu", pistonClearance: "standard", rings: "moly",
        rod: "pm_forged", rodBolts: "oem", crank: "cast_nodular", damper: "rubber",
        bearings: "bimetal", gasket: "composite", studs: "bolts_tty",
        intake: "plenum_long", asp: "na", turboSize: "medium", turbineMat: "cast_iron",
        ic: "none", boost: 0.6, fuel: "r87", timing: 0, lambda: 0.93,
        oilGrade: "w5_30", oilSystem: "wet", oilSquirters: "none",
        cooling: "std", exhaust: "cast_log", cover: "red"
      }
    }),
    P({
      id: "k20a", name: "Screamer 2.0 VTEC", basedOn: "Honda K20A",
      blurb: "Square 86×86 two-litre, 11.5:1, two-stage lift and a 8,400 rpm ceiling. 110 hp per litre with no boost anywhere.",
      soundProfile: "i4_vtec", realHp: 220, realRpm: 8000, realNm: 206,
      cfg: {
        layout: "I4", bore: 86, stroke: 86, rodRatio: 1.616, cr: 11.5,
        blockMat: "alu_liners", deck: "open", headMat: "alu", head: "dohc4v_vvl",
        valveMat: "steel", springs: "dual", cam: 86, lift: 55, redline: 8400,
        piston: "forged_4032", pistonClearance: "standard", rings: "moly",
        rod: "forged_4340", rodBolts: "arp2000", crank: "forged_4340", damper: "rubber",
        bearings: "trimetal", gasket: "mls", studs: "bolts_tty",
        intake: "plenum_short", asp: "na", turboSize: "medium", turbineMat: "cast_iron",
        ic: "none", boost: 0.6, fuel: "r94", timing: 0, lambda: 0.88,
        oilGrade: "w5_30", oilSystem: "wet", oilSquirters: "none",
        cooling: "std", exhaust: "headers_merge", cover: "red"
      }
    }),
    P({
      id: "2jzgte", name: "Ironclad 3.0 Twin", basedOn: "Toyota 2JZ-GTE",
      blurb: "Iron-block square three-litre six on sequential twins at 0.8 bar. Closed deck, seven mains, and the reason tuners still pay for them.",
      soundProfile: "i6_turbo", realHp: 320, realRpm: 5600, realNm: 441,
      cfg: {
        layout: "I6", bore: 86, stroke: 86, rodRatio: 1.607, cr: 8.5,
        blockMat: "grey_iron", deck: "closed", headMat: "alu", head: "dohc4v_vvt",
        valveMat: "sodium", springs: "dual", cam: 38, lift: 86, redline: 7000,
        piston: "forged_4032", pistonClearance: "standard", rings: "moly",
        rod: "forged_4340", rodBolts: "arp2000", crank: "forged_4340", damper: "viscous",
        bearings: "trimetal", gasket: "mls", studs: "arp_studs",
        intake: "plenum_long", asp: "twin_turbo", turboSize: "small", turbineMat: "cast_iron",
        ic: "air_air", boost: 0.90, fuel: "r94", timing: 0, lambda: 0.86,
        oilGrade: "w10_40", oilSystem: "wet", oilSquirters: "fitted",
        cooling: "uprated", exhaust: "cast_log", cover: "black"
      }
    }),
    P({
      id: "rb26", name: "Godzilla 2.6 ITB", basedOn: "Nissan RB26DETT",
      blurb: "Iron block, six individual throttles and parallel twins. 276 hp on the official paperwork; nearer 320 on a real dyno.",
      soundProfile: "i6_turbo", realHp: 320, realRpm: 6800, realNm: 368,
      cfg: {
        layout: "I6", bore: 86, stroke: 73.7, rodRatio: 1.79, cr: 8.5,
        blockMat: "grey_iron", deck: "closed", headMat: "alu", head: "dohc4v",
        valveMat: "sodium", springs: "dual", cam: 63, lift: 54, redline: 8000,
        piston: "forged_4032", pistonClearance: "standard", rings: "moly",
        rod: "forged_4340", rodBolts: "arp2000", crank: "forged_4340", damper: "viscous",
        bearings: "trimetal", gasket: "mls", studs: "arp_studs",
        intake: "itb", asp: "twin_turbo", turboSize: "small", turbineMat: "cast_iron",
        ic: "air_air", boost: 0.80, fuel: "r94", timing: 0, lambda: 0.86,
        oilGrade: "w10_40", oilSystem: "baffled", oilSquirters: "fitted",
        cooling: "uprated", exhaust: "cast_tubular", cover: "red"
      }
    }),
    P({
      id: "ls3", name: "Pushrod 6.2", basedOn: "GM LS3",
      blurb: "Big bore, cam in the block, two valves per cylinder and 6.2 litres. Compact, 190 kg, and 430 hp on pump fuel.",
      soundProfile: "pushrod_v8", realHp: 430, realRpm: 5900, realNm: 575,
      cfg: {
        layout: "V8", bore: 103.25, stroke: 92, rodRatio: 1.682, cr: 10.7,
        blockMat: "alu_liners", deck: "semi_closed", headMat: "alu", head: "pushrod2v",
        valveMat: "steel", springs: "beehive", cam: 52, lift: 51, redline: 6600,
        piston: "hyper", pistonClearance: "standard", rings: "moly",
        rod: "pm_forged", rodBolts: "oem", crank: "cast_nodular", damper: "rubber",
        bearings: "trimetal", gasket: "mls", studs: "bolts_tty",
        intake: "plenum_short", asp: "na", turboSize: "medium", turbineMat: "cast_iron",
        ic: "none", boost: 0.6, fuel: "r91", timing: 0, lambda: 0.88,
        oilGrade: "w5_30", oilSystem: "wet", oilSquirters: "none",
        cooling: "std", exhaust: "cast_tubular", cover: "orange"
      }
    }),
    P({
      id: "coyote", name: "Quad-cam 5.0", basedOn: "Ford Coyote 5.0",
      blurb: "Five litres, four cams, twin independent variable timing and 12:1 compression. A modern pushrod-killer that revs to 7,500.",
      soundProfile: "v8_crossplane", realHp: 460, realRpm: 7000, realNm: 569,
      cfg: {
        layout: "V8", bore: 92.2, stroke: 92.7, rodRatio: 1.657, cr: 12.0,
        blockMat: "alu_liners", deck: "semi_closed", headMat: "alu", head: "dohc4v_vvt",
        valveMat: "steel", springs: "beehive", cam: 45, lift: 54, redline: 7500,
        piston: "hyper", pistonClearance: "standard", rings: "moly",
        rod: "forged_4340", rodBolts: "arp2000", crank: "forged_4340", damper: "rubber",
        bearings: "trimetal", gasket: "mls", studs: "bolts_tty",
        intake: "plenum_short", asp: "na", turboSize: "medium", turbineMat: "cast_iron",
        ic: "none", boost: 0.6, fuel: "r94", timing: 0, lambda: 0.92,
        oilGrade: "w5_30", oilSystem: "wet", oilSquirters: "fitted",
        cooling: "uprated", exhaust: "cast_tubular", cover: "blue"
      }
    }),
    P({
      id: "ej257", name: "Boxer 2.5 Turbo", basedOn: "Subaru EJ257",
      blurb: "Semi-closed-deck aluminium boxer, 8.2:1 and about a bar of boost. Hypereutectic pistons and a famously narrow ringland margin.",
      soundProfile: "f4_rumble", realHp: 300, realRpm: 6000, realNm: 393,
      cfg: {
        layout: "F4", bore: 99.5, stroke: 79, rodRatio: 1.65, cr: 8.2,
        blockMat: "alu_liners", deck: "semi_closed", headMat: "alu", head: "dohc4v_vvt",
        valveMat: "sodium", springs: "dual", cam: 28, lift: 57, redline: 6700,
        piston: "hyper", pistonClearance: "standard", rings: "moly",
        rod: "forged_4340", rodBolts: "arp2000", crank: "forged_4340", damper: "rubber",
        bearings: "trimetal", gasket: "mls", studs: "arp_studs",
        intake: "plenum_long", asp: "turbo", turboSize: "medium", turbineMat: "cast_iron",
        ic: "air_air", boost: 1.00, fuel: "r94", timing: 0, lambda: 0.82,
        oilGrade: "w10_40", oilSystem: "baffled", oilSquirters: "fitted",
        cooling: "uprated", exhaust: "cast_log", cover: "gold"
      }
    }),
    P({
      id: "f6_38", name: "Flat-six 3.8", basedOn: "Porsche 9A1 3.8 NA",
      blurb: "Nikasil-bored aluminium flat six, 12.5:1, variable lift and 400 hp at 7,400. Short crank, so torsionals are somebody else's problem.",
      soundProfile: "f6", realHp: 400, realRpm: 7400, realNm: 440,
      cfg: {
        layout: "F6", bore: 102, stroke: 77.5, rodRatio: 1.72, cr: 12.5,
        blockMat: "alu_nikasil", deck: "closed", headMat: "alu", head: "dohc4v_vvl",
        valveMat: "ti", springs: "beehive", cam: 54, lift: 56, redline: 7800,
        piston: "forged_4032", pistonClearance: "tight", rings: "steel",
        rod: "forged_4340", rodBolts: "arp2000", crank: "forged_4340", damper: "rubber",
        bearings: "trimetal", gasket: "mls", studs: "arp_studs",
        intake: "plenum_long", asp: "na", turboSize: "medium", turbineMat: "cast_iron",
        ic: "none", boost: 0.6, fuel: "r94", timing: 0, lambda: 0.92,
        oilGrade: "w5_30", oilSystem: "dry", oilSquirters: "fitted",
        cooling: "uprated", exhaust: "cast_tubular", cover: "silver"
      }
    }),
    P({
      id: "s54", name: "Six-throttle 3.2", basedOn: "BMW S54B32",
      blurb: "Cast-iron block, aluminium head, six individual throttles and 104 hp per litre without a turbo. 8,000 rpm on a long 91 mm stroke.",
      soundProfile: "i6_itb", realHp: 333, realRpm: 7900, realNm: 365,
      cfg: {
        layout: "I6", bore: 87, stroke: 91, rodRatio: 1.51, cr: 11.5,
        blockMat: "grey_iron", deck: "closed", headMat: "alu", head: "dohc4v_vvt",
        valveMat: "steel", springs: "dual", cam: 82, lift: 54, redline: 8000,
        piston: "forged_4032", pistonClearance: "standard", rings: "moly",
        rod: "forged_4340", rodBolts: "arp2000", crank: "forged_4340", damper: "viscous",
        bearings: "trimetal", gasket: "mls", studs: "arp_studs",
        intake: "itb", asp: "na", turboSize: "medium", turbineMat: "cast_iron",
        ic: "none", boost: 0.6, fuel: "r94", timing: 0, lambda: 0.92,
        oilGrade: "w10_40", oilSystem: "baffled", oilSquirters: "none",
        cooling: "uprated", exhaust: "headers_equal", cover: "silver"
      }
    }),
    P({
      id: "v8fp45", name: "Flat-plane 4.5", basedOn: "Ferrari F136 4.5 V8",
      blurb: "180° crank, 12.5:1, 9,000 rpm and titanium everywhere it matters. Two inline-fours that agreed to share a crankcase.",
      soundProfile: "v8_flatplane", realHp: 562, realRpm: 9000, realNm: 540,
      cfg: {
        layout: "V8F", bore: 92, stroke: 81, rodRatio: 1.72, cr: 12.5,
        blockMat: "alu_nikasil", deck: "closed", headMat: "alu", head: "dohc4v_vvl",
        valveMat: "ti", springs: "ti_retainers", cam: 88, lift: 72, redline: 9200,
        piston: "forged_2618", pistonClearance: "tight", rings: "steel",
        rod: "titanium", rodBolts: "age625", crank: "forged_nitrided", damper: "rubber",
        bearings: "coated", gasket: "mls", studs: "arp_studs",
        intake: "plenum_short", asp: "na", turboSize: "medium", turbineMat: "cast_iron",
        ic: "none", boost: 0.6, fuel: "race100", timing: 0, lambda: 0.88,
        oilGrade: "w5_30", oilSystem: "dry", oilSquirters: "fitted",
        cooling: "race", exhaust: "headers_merge", cover: "red"
      }
    }),
    P({
      id: "v12_65", name: "Sixty-five hundred V12", basedOn: "Ferrari F140-style 6.5 V12",
      blurb: "Twelve cylinders, 13.5:1, 8,900 rpm and a crank long enough to need a damper you can feel the weight of.",
      soundProfile: "v12", realHp: 790, realRpm: 8500, realNm: 719,
      cfg: {
        layout: "V12", bore: 94, stroke: 78, rodRatio: 1.78, cr: 13.5,
        blockMat: "alu_nikasil", deck: "closed", headMat: "alu", head: "dohc4v_vvl",
        valveMat: "ti", springs: "ti_retainers", cam: 90, lift: 54, redline: 8900,
        piston: "forged_2618", pistonClearance: "tight", rings: "steel",
        rod: "titanium", rodBolts: "age625", crank: "billet_300m", damper: "viscous",
        bearings: "coated", gasket: "mls", studs: "arp_studs",
        intake: "plenum_short", asp: "na", turboSize: "medium", turbineMat: "cast_iron",
        ic: "none", boost: 0.6, fuel: "race100", timing: 0, lambda: 0.90,
        oilGrade: "w5_30", oilSystem: "dry", oilSquirters: "fitted",
        cooling: "race", exhaust: "headers_equal", cover: "red"
      }
    }),
    P({
      id: "v10_52", name: "Five-two V10", basedOn: "Audi/Lamborghini 5.2 FSI V10",
      blurb: "90° ten with 18° offset pins for even fire, 12.5:1 and 602 hp at 8,250. Nothing else sounds like it.",
      soundProfile: "v10", realHp: 602, realRpm: 8250, realNm: 560,
      cfg: {
        layout: "V10", bore: 84.5, stroke: 92.8, rodRatio: 1.60, cr: 12.5,
        blockMat: "alu_nikasil", deck: "closed", headMat: "alu", head: "dohc4v_vvt",
        valveMat: "ti", springs: "ti_retainers", cam: 85, lift: 70, redline: 8500,
        piston: "forged_2618", pistonClearance: "tight", rings: "steel",
        rod: "forged_300m", rodBolts: "age625", crank: "forged_nitrided", damper: "viscous",
        bearings: "coated", gasket: "mls", studs: "arp_studs",
        intake: "plenum_short", asp: "na", turboSize: "medium", turbineMat: "cast_iron",
        ic: "none", boost: 0.6, fuel: "race100", timing: 0, lambda: 0.88,
        oilGrade: "w5_30", oilSystem: "dry", oilSquirters: "fitted",
        cooling: "race", exhaust: "headers_merge", cover: "black"
      }
    }),
    P({
      id: "i3_1000", name: "Litre triple turbo", basedOn: "Ford 1.0 EcoBoost",
      blurb: "One litre, three cylinders, a tiny turbo and 123 hp. The rocking couple is dealt with by an offset flywheel rather than a balance shaft.",
      soundProfile: "i3_turbo", realHp: 123, realRpm: 6000, realNm: 170,
      cfg: {
        layout: "I3", bore: 71.9, stroke: 82, rodRatio: 1.70, cr: 10.0,
        blockMat: "grey_iron", deck: "closed", headMat: "alu", head: "dohc4v_vvt",
        valveMat: "sodium", springs: "single", cam: 26, lift: 80, redline: 6300,
        piston: "hyper", pistonClearance: "standard", rings: "steel",
        rod: "pm_forged", rodBolts: "oem", crank: "forged_4340", damper: "rubber",
        bearings: "trimetal", gasket: "mls", studs: "bolts_tty",
        intake: "single_tb", asp: "turbo", turboSize: "small", turbineMat: "cast_iron",
        ic: "air_air", boost: 1.00, fuel: "r91", timing: 0, lambda: 0.90,
        oilGrade: "w5_30", oilSystem: "wet", oilSquirters: "fitted",
        cooling: "std", exhaust: "cast_log", cover: "black"
      }
    }),
    P({
      id: "ea888", name: "Two-litre DI turbo", basedOn: "VW EA888 Gen3 2.0 TSI",
      blurb: "Long-stroke 2.0, 9.6:1, single twin-scroll turbo and a broad 380 Nm plateau. The default fast family car engine.",
      soundProfile: "i4_turbo", realHp: 292, realRpm: 5800, realNm: 380,
      cfg: {
        layout: "I4", bore: 82.5, stroke: 92.8, rodRatio: 1.62, cr: 9.6,
        blockMat: "grey_iron", deck: "closed", headMat: "alu", head: "dohc4v_vvt",
        valveMat: "sodium", springs: "dual", cam: 52, lift: 54, redline: 6800,
        piston: "forged_4032", pistonClearance: "standard", rings: "steel",
        rod: "pm_forged", rodBolts: "arp2000", crank: "forged_4340", damper: "rubber",
        bearings: "trimetal", gasket: "mls", studs: "arp_studs",
        intake: "single_tb", asp: "turbo", turboSize: "medium", turbineMat: "cast_iron",
        ic: "air_air", boost: 1.20, fuel: "r94", timing: 0, lambda: 0.90,
        oilGrade: "w5_30", oilSystem: "wet", oilSquirters: "fitted",
        cooling: "uprated", exhaust: "cast_tubular", cover: "black"
      }
    }),
    P({
      id: "m133", name: "Hand-built 2.0 hot four", basedOn: "Mercedes-AMG M133",
      blurb: "1.8 bar through a two-litre four on 8.6:1 compression — for years the most powerful production four-cylinder made.",
      soundProfile: "i4_turbo", realHp: 375, realRpm: 6000, realNm: 475,
      cfg: {
        layout: "I4", bore: 83, stroke: 92, rodRatio: 1.63, cr: 8.6,
        blockMat: "alu_liners", deck: "closed", headMat: "alu", head: "dohc4v_vvt",
        valveMat: "sodium", springs: "dual", cam: 56, lift: 55, redline: 6700,
        piston: "forged_2618", pistonClearance: "loose", rings: "steel",
        rod: "forged_4340", rodBolts: "arp2000", crank: "forged_4340", damper: "rubber",
        bearings: "trimetal", gasket: "mls", studs: "arp_studs",
        intake: "single_tb", asp: "turbo", turboSize: "large", turbineMat: "inconel",
        ic: "water_air", boost: 1.80, fuel: "r94", timing: 0, lambda: 0.84,
        oilGrade: "w10_40", oilSystem: "wet", oilSquirters: "fitted",
        cooling: "uprated", exhaust: "cast_tubular", cover: "silver"
      }
    }),
    P({
      id: "hemi64", name: "Six-four wedge", basedOn: "Chrysler 6.4 HEMI",
      blurb: "6.4 litres, pushrods, 10.9:1 and 485 hp. Enormous bore, hemispherical-ish chambers and a torque curve like a table.",
      soundProfile: "pushrod_v8", realHp: 485, realRpm: 6000, realNm: 644,
      cfg: {
        layout: "V8", bore: 103.9, stroke: 94.6, rodRatio: 1.67, cr: 10.9,
        blockMat: "grey_iron", deck: "closed", headMat: "alu", head: "pushrod2v",
        valveMat: "steel", springs: "beehive", cam: 49, lift: 71, redline: 6400,
        piston: "hyper", pistonClearance: "standard", rings: "moly",
        rod: "pm_forged", rodBolts: "arp2000", crank: "forged_4340", damper: "rubber",
        bearings: "trimetal", gasket: "mls", studs: "bolts_tty",
        intake: "plenum_short", asp: "na", turboSize: "medium", turbineMat: "cast_iron",
        ic: "none", boost: 0.6, fuel: "r94", timing: 0, lambda: 0.88,
        oilGrade: "w5_30", oilSystem: "baffled", oilSquirters: "none",
        cooling: "uprated", exhaust: "headers_merge", cover: "orange"
      }
    }),
    P({
      id: "i5_25t", name: "Warbling 2.5 five", basedOn: "Audi 2.5 TFSI (DAZA)",
      blurb: "Aluminium five-cylinder, 1-2-4-5-3, a single big turbo and 394 hp. The odd firing order is the whole point.",
      soundProfile: "i5_turbo", realHp: 394, realRpm: 5850, realNm: 480,
      cfg: {
        layout: "I5", bore: 82.5, stroke: 92.8, rodRatio: 1.62, cr: 10.0,
        blockMat: "alu_liners", deck: "closed", headMat: "alu", head: "dohc4v_vvt",
        valveMat: "sodium", springs: "dual", cam: 42, lift: 61, redline: 7000,
        piston: "forged_4032", pistonClearance: "standard", rings: "steel",
        rod: "forged_4340", rodBolts: "arp2000", crank: "forged_4340", damper: "viscous",
        bearings: "trimetal", gasket: "mls", studs: "arp_studs",
        intake: "single_tb", asp: "turbo", turboSize: "medium", turbineMat: "inconel",
        ic: "air_air", boost: 1.35, fuel: "r94", timing: 0, lambda: 0.86,
        oilGrade: "w5_30", oilSystem: "wet", oilSquirters: "fitted",
        cooling: "uprated", exhaust: "cast_tubular", cover: "gold"
      }
    }),
    P({
      id: "outlaw_radial", name: "Radial outlaw 615", basedOn: "billet big-block, twin 88s",
      blurb: "Ten litres of billet on a pair of 88 mm turbos and methanol, jetted for the tyre rather than the dyno. Around two thousand horsepower, and a fresh set of bearings every thirty passes.",
      soundProfile: "pushrod_v8", realHp: 2000, realRpm: 7400, realNm: 2700, outlaw: true,
      cfg: {
        layout: "V8", bore: 118, stroke: 114, rodRatio: 1.78, cr: 9.2,
        blockMat: "billet_alu", deck: "closed", headMat: "alu", head: "billet_hemi",
        valveMat: "inconel", springs: "ti_retainers", cam: 74, lift: 84, redline: 7600,
        piston: "billet_tbc", pistonClearance: "loose", rings: "steel_drag",
        rod: "alu_billet", rodBolts: "age625", crank: "billet_300m", damper: "viscous",
        bearings: "coated", gasket: "copper_oring", studs: "studs_916",
        intake: "plenum_short", asp: "twin_turbo", turboSize: "f88", turbineMat: "inconel",
        ic: "ice_tank", boost: 1.20, nitrous: "none", fuel: "methanol", timing: 0, lambda: 0.82,
        oilGrade: "w15_50", oilSystem: "dry", oilSquirters: "fitted",
        cooling: "race", exhaust: "headers_merge", cover: "red"
      }
    }),
    P({
      id: "outlaw_promod", name: "Screw-blown 655", basedOn: "billet hemi, twin-screw",
      blurb: "A twin-screw blower and a progressive four-hundred shot on top of eleven litres of billet. Makes its peak before eight thousand and needs freshening after twenty passes.",
      soundProfile: "pushrod_v8", realHp: 2900, realRpm: 7600, realNm: 3900, outlaw: true,
      cfg: {
        layout: "V8", bore: 122, stroke: 114, rodRatio: 1.75, cr: 9.5,
        blockMat: "billet_alu", deck: "closed", headMat: "alu", head: "billet_hemi",
        valveMat: "inconel", springs: "ti_retainers", cam: 78, lift: 85, redline: 8000,
        piston: "billet_tbc", pistonClearance: "loose", rings: "steel_drag",
        rod: "alu_billet", rodBolts: "age625", crank: "billet_300m", damper: "viscous",
        bearings: "coated", gasket: "copper_oring", studs: "studs_916",
        intake: "plenum_short", asp: "screw", turboSize: "f88", turbineMat: "inconel",
        ic: "ice_tank", boost: 1.80, nitrous: "prog400", fuel: "methanol", timing: 0, lambda: 0.82,
        oilGrade: "w15_50", oilSystem: "dry", oilSquirters: "fitted",
        cooling: "race", exhaust: "headers_merge", cover: "black"
      }
    }),
    /* ---- expansion set (v1.4): economy, truck, classic, performance, motorsport, outlaw ---- */
    P({
      id: "d15b", name: "Fifteen-hundred lean-burn", basedOn: "Honda D15B (SOHC 16v)", cls: "economy",
      blurb: "1.5 SOHC four, 75×84.5, long rods and a small carb-sized throttle. Ninety-odd horsepower that will do 300,000 km.",
      soundProfile: null, realHp: 88, realRpm: 5900, realNm: 135,
      cfg: {
        layout: "I4", bore: 75, stroke: 84.5, rodRatio: 1.63, cr: 10, blockMat: "grey_iron",
        deck: "open", headMat: "alu", head: "sohc2v", valveMat: "steel", springs: "single", cam: 52,
        lift: 60, redline: 6500, piston: "cast_alu", pistonClearance: "standard", rings: "moly", rod: "pm_forged",
        rodBolts: "oem", crank: "cast_nodular", damper: "rubber", bearings: "bimetal", gasket: "composite", studs: "bolts_tty",
        intake: "single_tb", asp: "na", turboSize: "medium", turbineMat: "cast_iron", ic: "none", boost: 0.6,
        nitrous: "none", fuel: "r87", timing: 0, lambda: 0.95, oilGrade: "w5_30", oilSystem: "wet",
        oilSquirters: "none", cooling: "std", exhaust: "cast_log", cover: "black"
      }
    }),
    P({
      id: "ea211", name: "One-litre TSI triple", basedOn: "VW EA211 1.0 TSI", cls: "economy",
      blurb: "999 cc turbo triple, 74.5×76.4, tiny single-scroll turbo on a cast-in manifold. Family hatch power from a lunchbox.",
      soundProfile: "i3_turbo", realHp: 115, realRpm: 5500, realNm: 200,
      cfg: {
        layout: "I3", bore: 74.5, stroke: 76.4, rodRatio: 1.7, cr: 10.5, blockMat: "grey_iron",
        deck: "open", headMat: "alu", head: "dohc4v_vvt", valveMat: "sodium", springs: "dual", cam: 34,
        lift: 50, redline: 6300, piston: "forged_4032", pistonClearance: "standard", rings: "steel", rod: "forged_4340",
        rodBolts: "oem", crank: "forged_4340", damper: "rubber", bearings: "coated", gasket: "mls", studs: "bolts_tty",
        intake: "single_tb", asp: "turbo", turboSize: "small", turbineMat: "cast_iron", ic: "air_air", boost: 0.65,
        nitrous: "none", fuel: "r91", timing: 0, lambda: 0.88, oilGrade: "w5_30", oilSystem: "wet",
        oilSquirters: "none", cooling: "uprated", exhaust: "cast_log", cover: "black"
      }
    }),
    P({
      id: "2zr", name: "Eighteen-hundred dual VVT", basedOn: "Toyota 2ZR-FE", cls: "economy",
      blurb: "1.8 DOHC with phasers on both cams, 80.5×88.3, 10:1. The world's default sedan engine.",
      soundProfile: null, realHp: 132, realRpm: 6000, realNm: 174,
      cfg: {
        layout: "I4", bore: 80.5, stroke: 88.3, rodRatio: 1.65, cr: 10, blockMat: "alu_liners",
        deck: "open", headMat: "alu", head: "dohc4v_vvt", valveMat: "steel", springs: "single", cam: 38,
        lift: 52, redline: 6400, piston: "cast_alu", pistonClearance: "standard", rings: "moly", rod: "pm_forged",
        rodBolts: "oem", crank: "cast_nodular", damper: "rubber", bearings: "bimetal", gasket: "mls", studs: "bolts_tty",
        intake: "single_tb", asp: "na", turboSize: "medium", turbineMat: "cast_iron", ic: "none", boost: 0.6,
        nitrous: "none", fuel: "r87", timing: 0, lambda: 0.99, oilGrade: "w5_30", oilSystem: "wet",
        oilSquirters: "none", cooling: "std", exhaust: "cast_log", cover: "silver"
      }
    }),
    P({
      id: "skyg25", name: "Two-five high-compression", basedOn: "Mazda Skyactiv-G 2.5", cls: "economy",
      blurb: "89×100 long-stroke four at 13:1 on pump gas, 4-2-1 header cast into the manifold. Efficiency engineering.",
      soundProfile: null, realHp: 187, realRpm: 6000, realNm: 252,
      cfg: {
        layout: "I4", bore: 89, stroke: 100, rodRatio: 1.6, cr: 13, blockMat: "alu_liners",
        deck: "open", headMat: "alu", head: "dohc4v_vvt", valveMat: "sodium", springs: "single", cam: 28,
        lift: 56, redline: 6300, piston: "hyper", pistonClearance: "standard", rings: "steel", rod: "pm_forged",
        rodBolts: "oem", crank: "cast_nodular", damper: "rubber", bearings: "bimetal", gasket: "mls", studs: "bolts_tty",
        intake: "single_tb", asp: "na", turboSize: "medium", turbineMat: "cast_iron", ic: "none", boost: 0.6,
        nitrous: "none", fuel: "r91", timing: 0, lambda: 0.99, oilGrade: "w5_30", oilSystem: "wet",
        oilSquirters: "none", cooling: "std", exhaust: "cast_tubular", cover: "black"
      }
    }),
    P({
      id: "kent", name: "Crossflow sixteen-hundred", basedOn: "Ford Kent 1600 Crossflow", cls: "classic",
      blurb: "81×77.6 pushrod four with a downdraught carb, iron head and bowl-in-piston chambers. The Formula Ford engine in its street clothes.",
      soundProfile: null, realHp: 84, realRpm: 5500, realNm: 125,
      cfg: {
        layout: "I4", bore: 81, stroke: 77.6, rodRatio: 1.66, cr: 9, blockMat: "grey_iron",
        deck: "open", headMat: "iron", head: "pushrod2v", valveMat: "steel", springs: "single", cam: 30,
        lift: 46, redline: 6000, piston: "cast_alu", pistonClearance: "standard", rings: "moly", rod: "cast_steel",
        rodBolts: "oem", crank: "cast_nodular", damper: "none", bearings: "bimetal", gasket: "composite", studs: "bolts_tty",
        intake: "carb", asp: "na", turboSize: "medium", turbineMat: "cast_iron", ic: "none", boost: 0.6,
        nitrous: "none", fuel: "r87", timing: 0, lambda: 0.92, oilGrade: "w5_30", oilSystem: "wet",
        oilSquirters: "none", cooling: "std", exhaust: "cast_log", cover: "blue"
      }
    }),
    P({
      id: "lima23", name: "Two-three Lima", basedOn: "Ford 2.3 Lima (OHC)", cls: "truck",
      blurb: "96×79.4 iron-block SOHC four, belt-driven cam. Rangers, Mustang IIs and a thousand industrial carts.",
      soundProfile: null, realHp: 88, realRpm: 4600, realNm: 170,
      cfg: {
        layout: "I4", bore: 96, stroke: 79.4, rodRatio: 1.6, cr: 8.4, blockMat: "grey_iron",
        deck: "open", headMat: "iron", head: "sohc2v", valveMat: "steel", springs: "single", cam: 10,
        lift: 30, redline: 4600, piston: "cast_alu", pistonClearance: "standard", rings: "moly", rod: "cast_steel",
        rodBolts: "oem", crank: "cast_nodular", damper: "rubber", bearings: "bimetal", gasket: "composite", studs: "bolts_tty",
        intake: "single_tb", asp: "na", turboSize: "medium", turbineMat: "cast_iron", ic: "none", boost: 0.6,
        nitrous: "none", fuel: "r87", timing: -8, lambda: 0.94, oilGrade: "w5_30", oilSystem: "wet",
        oilSquirters: "none", cooling: "std", exhaust: "cast_log", cover: "blue"
      }
    }),
    P({
      id: "ford300", name: "Three-hundred straight six", basedOn: "Ford 300 (4.9) I6", cls: "truck",
      blurb: "98×104 pushrod six (4.7 L), 8.8:1, seven main bearings and a torque curve like a table. Fifteen hundred foot-pounds of reputation.",
      soundProfile: null, realHp: 150, realRpm: 3400, realNm: 352,
      cfg: {
        layout: "I6", bore: 98, stroke: 104, rodRatio: 1.63, cr: 8.2, blockMat: "grey_iron",
        deck: "open", headMat: "iron", head: "pushrod2v", valveMat: "steel", springs: "single", cam: 4,
        lift: 26, redline: 4000, piston: "cast_alu", pistonClearance: "standard", rings: "moly", rod: "cast_steel",
        rodBolts: "oem", crank: "cast_nodular", damper: "rubber", bearings: "bimetal", gasket: "composite", studs: "bolts_tty",
        intake: "single_tb", asp: "na", turboSize: "medium", turbineMat: "cast_iron", ic: "none", boost: 0.6,
        nitrous: "none", fuel: "r87", timing: -10, lambda: 0.94, oilGrade: "w5_30", oilSystem: "wet",
        oilSquirters: "none", cooling: "std", exhaust: "cast_log", cover: "blue"
      }
    }),
    P({
      id: "vortec43", name: "Vortec four-three", basedOn: "GM 4.3 Vortec V6", cls: "truck",
      blurb: "A small-block with two cylinders missing: 101.6×88.4, 9.2:1, central port injection. Half-ton and van duty.",
      soundProfile: null, realHp: 200, realRpm: 4600, realNm: 352,
      cfg: {
        layout: "V6", bore: 101.6, stroke: 88.4, rodRatio: 1.66, cr: 9.2, blockMat: "grey_iron",
        deck: "open", headMat: "iron", head: "pushrod2v", valveMat: "steel", springs: "single", cam: 14,
        lift: 38, redline: 4800, piston: "cast_alu", pistonClearance: "standard", rings: "moly", rod: "pm_forged",
        rodBolts: "oem", crank: "cast_nodular", damper: "rubber", bearings: "bimetal", gasket: "composite", studs: "bolts_tty",
        intake: "plenum_long", asp: "na", turboSize: "medium", turbineMat: "cast_iron", ic: "none", boost: 0.6,
        nitrous: "none", fuel: "r87", timing: -6, lambda: 0.94, oilGrade: "w5_30", oilSystem: "wet",
        oilSquirters: "none", cooling: "std", exhaust: "cast_log", cover: "black"
      }
    }),
    P({
      id: "1gr", name: "Four-litre truck V6", basedOn: "Toyota 1GR-FE", cls: "truck",
      blurb: "94×95 DOHC 60° V6 with dual VVT, iron liners in an alloy block. Tacomas and Land Cruisers.",
      soundProfile: null, realHp: 236, realRpm: 5200, realNm: 361,
      cfg: {
        layout: "V6", bore: 94, stroke: 95, rodRatio: 1.6, cr: 10.4, blockMat: "alu_liners",
        deck: "open", headMat: "alu", head: "dohc4v_vvt", valveMat: "steel", springs: "single", cam: 12,
        lift: 38, redline: 5600, piston: "cast_alu", pistonClearance: "standard", rings: "moly", rod: "pm_forged",
        rodBolts: "oem", crank: "cast_nodular", damper: "rubber", bearings: "bimetal", gasket: "mls", studs: "bolts_tty",
        intake: "plenum_long", asp: "na", turboSize: "medium", turbineMat: "cast_iron", ic: "none", boost: 0.6,
        nitrous: "none", fuel: "r87", timing: -6, lambda: 0.96, oilGrade: "w5_30", oilSystem: "wet",
        oilSquirters: "none", cooling: "std", exhaust: "cast_log", cover: "black"
      }
    }),
    P({
      id: "godzilla73", name: "Seven-three pushrod truck V8", basedOn: "Ford 7.3 'Godzilla'", cls: "truck",
      blurb: "107.2×101 iron-block pushrod V8 with a forged crank and 10.5:1 — a modern big-block for Super Duty work.",
      soundProfile: "pushrod_v8", realHp: 430, realRpm: 5500, realNm: 644,
      cfg: {
        layout: "V8", bore: 107.2, stroke: 101, rodRatio: 1.62, cr: 10.5, blockMat: "grey_iron",
        deck: "open", headMat: "alu", head: "pushrod2v", valveMat: "sodium", springs: "beehive", cam: 36,
        lift: 54, redline: 5800, piston: "hyper", pistonClearance: "standard", rings: "steel", rod: "pm_forged",
        rodBolts: "oem", crank: "forged_4340", damper: "rubber", bearings: "bimetal", gasket: "mls", studs: "bolts_tty",
        intake: "plenum_long", asp: "na", turboSize: "medium", turbineMat: "cast_iron", ic: "none", boost: 0.6,
        nitrous: "none", fuel: "r87", timing: 0, lambda: 0.94, oilGrade: "w5_30", oilSystem: "wet",
        oilSquirters: "none", cooling: "uprated", exhaust: "cast_log", cover: "blue"
      }
    }),
    P({
      id: "sbc350", name: "Three-fifty small-block", basedOn: "Chevrolet 350 (4-bbl)", cls: "classic",
      blurb: "101.6×88.4 iron pushrod V8 on a four-barrel carb, 8.5:1 and a mild cam. The engine every garage has rebuilt.",
      soundProfile: "pushrod_v8", realHp: 210, realRpm: 4400, realNm: 400,
      cfg: {
        layout: "V8", bore: 101.6, stroke: 88.4, rodRatio: 1.64, cr: 8.2, blockMat: "grey_iron",
        deck: "open", headMat: "iron", head: "pushrod2v", valveMat: "steel", springs: "single", cam: 12,
        lift: 34, redline: 4800, piston: "cast_alu", pistonClearance: "standard", rings: "moly", rod: "cast_steel",
        rodBolts: "oem", crank: "cast_nodular", damper: "rubber", bearings: "bimetal", gasket: "composite", studs: "bolts_tty",
        intake: "carb", asp: "na", turboSize: "medium", turbineMat: "cast_iron", ic: "none", boost: 0.6,
        nitrous: "none", fuel: "r87", timing: -8, lambda: 0.9, oilGrade: "w5_30", oilSystem: "wet",
        oilSquirters: "none", cooling: "std", exhaust: "cast_log", cover: "orange"
      }
    }),
    P({
      id: "f20c", name: "Nine-thousand-rpm two-litre", basedOn: "Honda F20C", cls: "performance",
      blurb: "87×84 DOHC VTEC with 11.7:1, roller rockers and a 9,000 rpm redline. 120 hp per litre without a turbo.",
      soundProfile: "i4_vtec", realHp: 240, realRpm: 8300, realNm: 208,
      cfg: {
        layout: "I4", bore: 87, stroke: 84, rodRatio: 1.82, cr: 13, blockMat: "alu_liners",
        deck: "closed", headMat: "alu", head: "dohc4v_vvl", valveMat: "ti", springs: "ti_retainers", cam: 86,
        lift: 80, redline: 8800, piston: "forged_4032", pistonClearance: "standard", rings: "steel", rod: "forged_4340",
        rodBolts: "arp2000", crank: "forged_4340", damper: "rubber", bearings: "trimetal", gasket: "mls", studs: "arp_studs",
        intake: "single_tb", asp: "na", turboSize: "medium", turbineMat: "cast_iron", ic: "none", boost: 0.6,
        nitrous: "none", fuel: "r94", timing: 0, lambda: 0.9, oilGrade: "w5_30", oilSystem: "baffled",
        oilSquirters: "fitted", cooling: "uprated", exhaust: "headers_equal", cover: "silver"
      }
    }),
    P({
      id: "4age20v", name: "Sixteen-hundred twenty-valve", basedOn: "Toyota 4A-GE 20V (Blacktop)", cls: "performance",
      blurb: "81×77 five-valve four on individual throttles with VVT on the intake cam. Small, loud, 8,000 rpm.",
      soundProfile: "i6_itb", realHp: 165, realRpm: 7800, realNm: 162,
      cfg: {
        layout: "I4", bore: 81, stroke: 77, rodRatio: 1.6, cr: 11, blockMat: "alu_liners",
        deck: "closed", headMat: "alu", head: "dohc4v_vvt", valveMat: "sodium", springs: "dual", cam: 32,
        lift: 46, redline: 8000, piston: "hyper", pistonClearance: "standard", rings: "steel", rod: "forged_4340",
        rodBolts: "arp2000", crank: "forged_4340", damper: "rubber", bearings: "trimetal", gasket: "mls", studs: "arp_studs",
        intake: "itb", asp: "na", turboSize: "medium", turbineMat: "cast_iron", ic: "none", boost: 0.6,
        nitrous: "none", fuel: "r94", timing: 0, lambda: 0.91, oilGrade: "w5_30", oilSystem: "baffled",
        oilSquirters: "fitted", cooling: "uprated", exhaust: "headers_equal", cover: "black"
      }
    }),
    P({
      id: "4g63", name: "Two-litre rally four", basedOn: "Mitsubishi 4G63T (Evo IX)", cls: "performance",
      blurb: "85×88 iron-block DOHC turbo with MIVEC, a twin-scroll turbo and a bulletproof bottom end. Group A's favourite.",
      soundProfile: "i4_turbo", realHp: 286, realRpm: 6500, realNm: 392,
      cfg: {
        layout: "I4", bore: 85, stroke: 88, rodRatio: 1.7, cr: 8.8, blockMat: "grey_iron",
        deck: "closed", headMat: "alu", head: "dohc4v_vvt", valveMat: "sodium", springs: "dual", cam: 50,
        lift: 56, redline: 7200, piston: "forged_4032", pistonClearance: "standard", rings: "steel", rod: "forged_4340",
        rodBolts: "arp2000", crank: "forged_4340", damper: "rubber", bearings: "trimetal", gasket: "mls", studs: "arp_studs",
        intake: "single_tb", asp: "turbo", turboSize: "medium", turbineMat: "cast_iron", ic: "air_air", boost: 1.15,
        nitrous: "none", fuel: "r94", timing: 0, lambda: 0.88, oilGrade: "w5_30", oilSystem: "baffled",
        oilSquirters: "fitted", cooling: "uprated", exhaust: "cast_tubular", cover: "red"
      }
    }),
    P({
      id: "b58", name: "Three-litre single-turbo six", basedOn: "BMW B58B30", cls: "performance",
      blurb: "82×94.6 closed-deck alloy six, twin-scroll turbo, water-to-air charge cooler in the plenum. Smooth, 500 Nm from 1,800.",
      soundProfile: "i6_turbo", realHp: 382, realRpm: 5800, realNm: 500,
      cfg: {
        layout: "I6", bore: 82, stroke: 94.6, rodRatio: 1.6, cr: 11, blockMat: "alu_liners",
        deck: "closed", headMat: "alu", head: "dohc4v_vvl", valveMat: "sodium", springs: "dual", cam: 40,
        lift: 56, redline: 7000, piston: "forged_4032", pistonClearance: "standard", rings: "steel", rod: "forged_4340",
        rodBolts: "arp2000", crank: "forged_4340", damper: "rubber", bearings: "trimetal", gasket: "mls", studs: "arp_studs",
        intake: "single_tb", asp: "turbo", turboSize: "large", turbineMat: "cast_iron", ic: "water_air", boost: 0.75,
        nitrous: "none", fuel: "r94", timing: 0, lambda: 0.9, oilGrade: "w5_30", oilSystem: "baffled",
        oilSquirters: "fitted", cooling: "uprated", exhaust: "cast_tubular", cover: "black"
      }
    }),
    P({
      id: "vr38", name: "Three-eight twin-turbo V6", basedOn: "Nissan VR38DETT", cls: "performance",
      blurb: "95.5×88.4 plasma-sprayed bores, closed deck, two IHI turbos. Hand-built and signed.",
      soundProfile: null, realHp: 565, realRpm: 6800, realNm: 637,
      cfg: {
        layout: "V6", bore: 95.5, stroke: 88.4, rodRatio: 1.7, cr: 9, blockMat: "alu_nikasil",
        deck: "closed", headMat: "alu", head: "dohc4v_vvt", valveMat: "sodium", springs: "dual", cam: 50,
        lift: 58, redline: 7100, piston: "forged_4032", pistonClearance: "standard", rings: "steel", rod: "forged_4340",
        rodBolts: "arp2000", crank: "forged_4340", damper: "rubber", bearings: "trimetal", gasket: "mls", studs: "arp_studs",
        intake: "single_tb", asp: "twin_turbo", turboSize: "medium", turbineMat: "cast_iron", ic: "air_air", boost: 1.15,
        nitrous: "none", fuel: "r94", timing: 0, lambda: 0.86, oilGrade: "w5_30", oilSystem: "baffled",
        oilSquirters: "fitted", cooling: "uprated", exhaust: "cast_tubular", cover: "red"
      }
    }),
    P({
      id: "9a2tt", name: "Three-litre twin-turbo flat-six", basedOn: "Porsche 9A2 3.0 (991.2)", cls: "performance",
      blurb: "91×76.4 boxer six with two variable-geometry-free turbos and a 7,500 rpm redline. Rear-engined manners.",
      soundProfile: "f6", realHp: 443, realRpm: 6500, realNm: 530,
      cfg: {
        layout: "F6", bore: 91, stroke: 76.4, rodRatio: 1.7, cr: 10, blockMat: "alu_liners",
        deck: "closed", headMat: "alu", head: "dohc4v_vvl", valveMat: "sodium", springs: "dual", cam: 52,
        lift: 58, redline: 7500, piston: "forged_4032", pistonClearance: "standard", rings: "steel", rod: "forged_4340",
        rodBolts: "arp2000", crank: "forged_4340", damper: "rubber", bearings: "trimetal", gasket: "mls", studs: "arp_studs",
        intake: "single_tb", asp: "twin_turbo", turboSize: "medium", turbineMat: "cast_iron", ic: "air_air", boost: 0.95,
        nitrous: "none", fuel: "r94", timing: 0, lambda: 0.88, oilGrade: "w5_30", oilSystem: "dry",
        oilSquirters: "fitted", cooling: "uprated", exhaust: "cast_tubular", cover: "black"
      }
    }),
    P({
      id: "p997t", name: "Three-six VGT flat-six", basedOn: "Porsche 997 Turbo 3.6 (Mezger)", cls: "performance",
      blurb: "100×76.4 dry-sump boxer six, the first petrol engine sold with variable-geometry turbos. Superalloy vanes take 1,000 °C, and it still runs rich to keep them there.",
      soundProfile: "f6", realHp: 480, realRpm: 6000, realNm: 620,
      cfg: {
        layout: "F6", bore: 100, stroke: 76.4, rodRatio: 1.66, cr: 9, blockMat: "alu_nikasil",
        deck: "closed", headMat: "alu", head: "dohc4v_vvl", valveMat: "sodium", springs: "dual", cam: 50,
        lift: 58, redline: 6750, piston: "forged_4032", pistonClearance: "standard", rings: "steel", rod: "forged_4340",
        rodBolts: "arp2000", crank: "forged_4340", damper: "rubber", bearings: "trimetal", gasket: "mls", studs: "arp_studs",
        intake: "single_tb", asp: "twin_turbo", turboSize: "medium", turbineMat: "inconel", turbine: "vgt", ic: "air_air", boost: 0.85,
        nitrous: "none", fuel: "r94", timing: 0, lambda: 0.8, injectors: "i650", fuelPump: "p340", oilGrade: "w5_30", oilSystem: "dry",
        oilSquirters: "fitted", cooling: "uprated", exhaust: "cast_tubular", cover: "black"
      }
    }),
    P({
      id: "m156", name: "Six-two hand-built V8", basedOn: "Mercedes-AMG M156", cls: "performance",
      blurb: "102.2×94.6 DOHC alloy V8, 11.3:1, bucket tappets and a 7,200 rpm cut. The last big naturally aspirated AMG.",
      soundProfile: "v8_crossplane", realHp: 451, realRpm: 6800, realNm: 600,
      cfg: {
        layout: "V8", bore: 102.2, stroke: 94.6, rodRatio: 1.6, cr: 11.3, blockMat: "alu_liners",
        deck: "closed", headMat: "alu", head: "dohc4v_vvt", valveMat: "sodium", springs: "dual", cam: 18,
        lift: 42, redline: 6600, piston: "forged_4032", pistonClearance: "standard", rings: "steel", rod: "forged_4340",
        rodBolts: "arp2000", crank: "forged_4340", damper: "rubber", bearings: "trimetal", gasket: "mls", studs: "arp_studs",
        intake: "plenum_long", asp: "na", turboSize: "medium", turbineMat: "cast_iron", ic: "none", boost: 0.6,
        nitrous: "none", fuel: "r94", timing: -4, lambda: 0.9, oilGrade: "w5_30", oilSystem: "baffled",
        oilSquirters: "fitted", cooling: "uprated", exhaust: "headers_equal", cover: "silver"
      }
    }),
    P({
      id: "voodoo", name: "Five-two flat-plane V8", basedOn: "Ford 5.2 'Voodoo'", cls: "performance",
      blurb: "94×93 flat-plane crank, 12:1, 8,250 rpm. A Coyote that screams instead of rumbles.",
      soundProfile: "v8_flatplane", realHp: 526, realRpm: 7500, realNm: 582,
      cfg: {
        layout: "V8F", bore: 94, stroke: 93, rodRatio: 1.6, cr: 12, blockMat: "alu_liners",
        deck: "closed", headMat: "alu", head: "dohc4v_vvt", valveMat: "sodium", springs: "beehive", cam: 54,
        lift: 62, redline: 8000, piston: "forged_4032", pistonClearance: "standard", rings: "steel", rod: "forged_4340",
        rodBolts: "arp2000", crank: "forged_4340", damper: "rubber", bearings: "trimetal", gasket: "mls", studs: "arp_studs",
        intake: "plenum_short", asp: "na", turboSize: "medium", turbineMat: "cast_iron", ic: "none", boost: 0.6,
        nitrous: "none", fuel: "r94", timing: 0, lambda: 0.9, oilGrade: "w5_30", oilSystem: "baffled",
        oilSquirters: "fitted", cooling: "uprated", exhaust: "headers_equal", cover: "blue"
      }
    }),
    P({
      id: "hellcat", name: "Supercharged six-two", basedOn: "Chrysler 6.2 Hellcat", cls: "performance",
      blurb: "103.9×90.9 pushrod V8 under a 2.4 L twin-screw blower at 11.6 psi, forged everything. Seven hundred horsepower on 91.",
      soundProfile: "pushrod_v8", realHp: 707, realRpm: 6000, realNm: 881,
      cfg: {
        layout: "V8", bore: 103.9, stroke: 90.9, rodRatio: 1.6, cr: 9.5, blockMat: "grey_iron",
        deck: "closed", headMat: "alu", head: "pushrod2v", valveMat: "sodium", springs: "beehive", cam: 48,
        lift: 58, redline: 6200, piston: "forged_4032", pistonClearance: "standard", rings: "steel", rod: "forged_4340",
        rodBolts: "arp2000", crank: "forged_4340", damper: "rubber", bearings: "trimetal", gasket: "mls", studs: "arp_studs",
        intake: "plenum_short", asp: "screw", turboSize: "medium", turbineMat: "cast_iron", ic: "water_air", boost: 0.95,
        nitrous: "none", fuel: "r94", timing: 0, lambda: 0.86, oilGrade: "w5_30", oilSystem: "baffled",
        oilSquirters: "fitted", cooling: "uprated", exhaust: "cast_tubular", cover: "red"
      }
    }),
    P({
      id: "lt4", name: "Supercharged small-block", basedOn: "GM LT4 6.2", cls: "performance",
      blurb: "103.25×92 direct-injected pushrod V8 with a 1.7 L Roots blower and intercooler bricks in the lid. Corvette Z06 / CTS-V.",
      soundProfile: "pushrod_v8", realHp: 650, realRpm: 6400, realNm: 881,
      cfg: {
        layout: "V8", bore: 103.25, stroke: 92, rodRatio: 1.66, cr: 10, blockMat: "alu_liners",
        deck: "closed", headMat: "alu", head: "pushrod2v", valveMat: "ti", springs: "beehive", cam: 50,
        lift: 60, redline: 6600, piston: "forged_4032", pistonClearance: "standard", rings: "steel", rod: "forged_4340",
        rodBolts: "arp2000", crank: "forged_4340", damper: "rubber", bearings: "trimetal", gasket: "mls", studs: "arp_studs",
        intake: "plenum_short", asp: "roots", turboSize: "medium", turbineMat: "cast_iron", ic: "water_air", boost: 0.8,
        nitrous: "none", fuel: "r94", timing: 0, lambda: 0.87, oilGrade: "w5_30", oilSystem: "baffled",
        oilSquirters: "fitted", cooling: "uprated", exhaust: "cast_tubular", cover: "black"
      }
    }),
    P({
      id: "s85", name: "Five-litre V10, ten throttles", basedOn: "BMW S85B50", cls: "performance",
      blurb: "92×75.2 90° V10, 12:1, individual throttles and an 8,250 rpm redline. The E60 M5's F1 souvenir.",
      soundProfile: "v10", realHp: 500, realRpm: 7750, realNm: 520,
      cfg: {
        layout: "V10", bore: 92, stroke: 75.2, rodRatio: 1.9, cr: 12, blockMat: "alu_liners",
        deck: "closed", headMat: "alu", head: "dohc4v_vvt", valveMat: "sodium", springs: "beehive", cam: 24,
        lift: 46, redline: 8250, piston: "forged_4032", pistonClearance: "standard", rings: "steel", rod: "forged_4340",
        rodBolts: "arp2000", crank: "forged_4340", damper: "rubber", bearings: "trimetal", gasket: "mls", studs: "arp_studs",
        intake: "itb", asp: "na", turboSize: "medium", turbineMat: "cast_iron", ic: "none", boost: 0.6,
        nitrous: "none", fuel: "r94", timing: -3, lambda: 0.9, oilGrade: "w5_30", oilSystem: "baffled",
        oilSquirters: "fitted", cooling: "uprated", exhaust: "headers_equal", cover: "black"
      }
    }),
    P({
      id: "1lr", name: "Four-eight titanium V10", basedOn: "Lexus 1LR-GUE", cls: "performance",
      blurb: "88×79 72° V10 with titanium rods and valves, dry sump, 9,000 rpm. Built by Yamaha for the LFA.",
      soundProfile: "v10", realHp: 553, realRpm: 8700, realNm: 480,
      cfg: {
        layout: "V10", bore: 88, stroke: 79, rodRatio: 1.8, cr: 12, blockMat: "alu_liners",
        deck: "closed", headMat: "alu", head: "dohc4v_vvt", valveMat: "ti", springs: "ti_retainers", cam: 48,
        lift: 64, redline: 9000, piston: "forged_2618", pistonClearance: "loose", rings: "steel", rod: "titanium",
        rodBolts: "age625", crank: "forged_nitrided", damper: "viscous", bearings: "coated", gasket: "mls", studs: "l19",
        intake: "itb", asp: "na", turboSize: "medium", turbineMat: "cast_iron", ic: "none", boost: 0.6,
        nitrous: "none", fuel: "r94", timing: 0, lambda: 0.9, oilGrade: "w10_40", oilSystem: "dry",
        oilSquirters: "fitted", cooling: "race", exhaust: "headers_equal", cover: "silver"
      }
    }),
    P({
      id: "dfv", name: "Three-litre Grand Prix V8", basedOn: "Cosworth DFV", cls: "motorsport",
      blurb: "85.7×64.8 flat-plane 90° V8 on slide throttles, gear-driven cams, 10,500 rpm. A hundred and fifty-five wins.",
      soundProfile: "v8_flatplane", realHp: 410, realRpm: 9000, realNm: 340,
      cfg: {
        layout: "V8F", bore: 85.7, stroke: 64.8, rodRatio: 2, cr: 11, blockMat: "alu_liners",
        deck: "closed", headMat: "alu", head: "dohc4v", valveMat: "ti", springs: "ti_retainers", cam: 80,
        lift: 74, redline: 10500, piston: "forged_2618", pistonClearance: "loose", rings: "steel", rod: "forged_300m",
        rodBolts: "age625", crank: "forged_nitrided", damper: "viscous", bearings: "coated", gasket: "mls", studs: "l19",
        intake: "itb", asp: "na", turboSize: "medium", turbineMat: "cast_iron", ic: "none", boost: 0.6,
        nitrous: "none", fuel: "race100", timing: 0, lambda: 0.88, oilGrade: "w10_40", oilSystem: "dry",
        oilSquirters: "fitted", cooling: "race", exhaust: "headers_equal", cover: "black"
      }
    }),
    P({
      id: "wrc16", name: "Sixteen-hundred restricted turbo", basedOn: "WRC 1.6 T (Rally1-style)", cls: "motorsport",
      blurb: "84×72 DI four with a 36 mm inlet restrictor and anti-lag: 380 hp is the ceiling, 500 Nm from 3,000 is the point.",
      soundProfile: "i4_turbo", realHp: 380, realRpm: 6500, realNm: 450,
      cfg: {
        layout: "I4", bore: 84, stroke: 72, rodRatio: 1.9, cr: 9.5, blockMat: "alu_liners",
        deck: "closed", headMat: "alu", head: "dohc4v", valveMat: "ti", springs: "beehive", cam: 54,
        lift: 58, redline: 8000, piston: "forged_2618", pistonClearance: "loose", rings: "steel", rod: "forged_300m",
        rodBolts: "age625", crank: "forged_nitrided", damper: "viscous", bearings: "coated", gasket: "mls", studs: "l19",
        intake: "single_tb", asp: "turbo", turboSize: "medium", turbineMat: "inconel", ic: "air_air", boost: 1.75,
        nitrous: "none", fuel: "race100", timing: 0, lambda: 0.84, oilGrade: "w10_40", oilSystem: "dry",
        oilSquirters: "fitted", cooling: "race", exhaust: "headers_merge", cover: "red"
      }
    }),
    P({
      id: "gt3r", name: "Four-litre cup flat-six", basedOn: "Porsche 4.0 GT3 R", cls: "motorsport",
      blurb: "102×81.5 boxer six, 13:1, throttle bodies, dry sump and a 9,000 rpm limit. The customer endurance engine.",
      soundProfile: "f6", realHp: 520, realRpm: 8400, realNm: 465,
      cfg: {
        layout: "F6", bore: 102, stroke: 81.5, rodRatio: 1.8, cr: 13, blockMat: "alu_liners",
        deck: "closed", headMat: "alu", head: "dohc4v_vvt", valveMat: "ti", springs: "ti_retainers", cam: 66,
        lift: 66, redline: 9000, piston: "forged_2618", pistonClearance: "loose", rings: "steel", rod: "forged_300m",
        rodBolts: "age625", crank: "forged_nitrided", damper: "viscous", bearings: "coated", gasket: "mls", studs: "l19",
        intake: "itb", asp: "na", turboSize: "medium", turbineMat: "cast_iron", ic: "none", boost: 0.6,
        nitrous: "none", fuel: "race100", timing: 0, lambda: 0.89, oilGrade: "w10_40", oilSystem: "dry",
        oilSquirters: "fitted", cooling: "race", exhaust: "headers_equal", cover: "black"
      }
    }),
    P({
      id: "valkyrie", name: "Six-five eleven-thousand V12", basedOn: "Cosworth Valkyrie V12", cls: "motorsport",
      blurb: "92×81.8 65° V12 on titanium rods and gear-driven cams, a thousand horsepower at 11,100 in its real form — this one is capped at 9,800 and nine hundred.",
      soundProfile: "v12", realHp: 900, realRpm: 9800, realNm: 740,
      cfg: {
        layout: "V12", bore: 92, stroke: 81.8, rodRatio: 2, cr: 13, blockMat: "alu_nikasil",
        deck: "closed", headMat: "alu", head: "dohc4v_vvl", valveMat: "ti", springs: "ti_retainers", cam: 88,
        lift: 62, redline: 10000, piston: "forged_2618", pistonClearance: "loose", rings: "steel", rod: "titanium",
        rodBolts: "age625", crank: "billet_300m", damper: "viscous", bearings: "coated", gasket: "mls", studs: "l19",
        intake: "itb", asp: "na", turboSize: "medium", turbineMat: "cast_iron", ic: "none", boost: 0.6,
        nitrous: "none", fuel: "race100", timing: 0, lambda: 0.89, oilGrade: "w10_40", oilSystem: "dry",
        oilSquirters: "fitted", cooling: "race", exhaust: "headers_equal", cover: "silver"
      }
    }),
    P({
      id: "k24_1000", name: "K-series eight-hundred", basedOn: "Honda K24 drag build", cls: "outlaw",
      blurb: "92×88 sleeved four on aluminium rods with a 76 mm turbo, methanol and 41 psi. Eight hundred horsepower from a minivan block.",
      soundProfile: "i4_turbo", realHp: 800, realRpm: 9000, realNm: 820,
      cfg: {
        layout: "I4", bore: 92, stroke: 88, rodRatio: 1.55, cr: 8.5, blockMat: "billet_alu",
        deck: "closed", headMat: "alu", head: "dohc4v_vvl", valveMat: "inconel", springs: "beehive", cam: 70,
        lift: 70, redline: 8600, piston: "billet_tbc", pistonClearance: "loose", rings: "steel_drag", rod: "alu_billet",
        rodBolts: "age625", crank: "billet_300m", damper: "viscous", bearings: "coated", gasket: "copper_oring", studs: "l19",
        intake: "single_tb", asp: "turbo", turboSize: "huge", turbineMat: "inconel", ic: "air_air", boost: 2.8,
        nitrous: "none", fuel: "methanol", timing: 0, lambda: 0.82, oilGrade: "w10_40", oilSystem: "dry",
        oilSquirters: "fitted", cooling: "race", exhaust: "headers_merge", cover: "gold"
      }
    }),
    P({
      id: "jz_1500", name: "Stroker JZ, single eighty-eight", basedOn: "2JZ 3.4 stroker, 94 mm turbo", cls: "outlaw",
      blurb: "87×94 iron six, billet crank, one 88 mm turbo at 33 psi on methanol. The import drag-radial staple.",
      soundProfile: "i6_turbo", realHp: 950, realRpm: 8800, realNm: 1330,
      cfg: {
        layout: "I6", bore: 87, stroke: 94, rodRatio: 1.6, cr: 8.5, blockMat: "grey_iron",
        deck: "closed", headMat: "alu", head: "dohc4v", valveMat: "inconel", springs: "beehive", cam: 72,
        lift: 72, redline: 8300, piston: "billet_tbc", pistonClearance: "loose", rings: "steel_drag", rod: "forged_300m",
        rodBolts: "age625", crank: "billet_300m", damper: "viscous", bearings: "coated", gasket: "mls", studs: "l19",
        intake: "single_tb", asp: "turbo", turboSize: "f88", turbineMat: "inconel", ic: "ice_tank", boost: 2.3,
        nitrous: "none", fuel: "methanol", timing: 0, lambda: 0.82, oilGrade: "w10_40", oilSystem: "dry",
        oilSquirters: "fitted", cooling: "race", exhaust: "headers_merge", cover: "black"
      }
    }),
    P({
      id: "n2o632", name: "Six-thirty-two on the bottle", basedOn: "632 ci nitrous big-block", cls: "outlaw",
      blurb: "120.6×117.5 all-aluminium big-block at 15:1 on race gas, 1,100 on the motor and a two-stage 700 shot. Radial-vs-the-world.",
      soundProfile: "pushrod_v8", realHp: 1550, realRpm: 7800, realNm: 1900,
      cfg: {
        layout: "V8", bore: 120.6, stroke: 117.5, rodRatio: 1.7, cr: 15, blockMat: "billet_alu",
        deck: "closed", headMat: "alu", head: "billet_hemi", valveMat: "inconel", springs: "ti_retainers", cam: 74,
        lift: 72, redline: 7000, piston: "forged_2618", pistonClearance: "loose", rings: "steel", rod: "alu_billet",
        rodBolts: "age625", crank: "billet_300m", damper: "viscous", bearings: "coated", gasket: "copper_oring", studs: "studs_916",
        intake: "carb", asp: "na", turboSize: "medium", turbineMat: "cast_iron", ic: "none", boost: 0.6,
        nitrous: "prog700", fuel: "race100", timing: 0, lambda: 0.88, oilGrade: "w10_40", oilSystem: "dry",
        oilSquirters: "fitted", cooling: "race", exhaust: "headers_merge", cover: "red"
      }
    }),
    P({
      id: "pro540", name: "Centrifugal five-forty", basedOn: "540 ci ProCharger F-3 build", cls: "outlaw",
      blurb: "114.3×107.9 big-block with an F-3 centrifugal at 20 psi on methanol. Belt-driven boost that builds with the revs.",
      soundProfile: "pushrod_v8", realHp: 2000, realRpm: 8000, realNm: 2000,
      cfg: {
        layout: "V8", bore: 114.3, stroke: 107.9, rodRatio: 1.75, cr: 10, blockMat: "billet_alu",
        deck: "closed", headMat: "alu", head: "billet_hemi", valveMat: "inconel", springs: "ti_retainers", cam: 76,
        lift: 82, redline: 8200, piston: "billet_tbc", pistonClearance: "loose", rings: "steel", rod: "alu_billet",
        rodBolts: "age625", crank: "billet_300m", damper: "viscous", bearings: "coated", gasket: "copper_oring", studs: "studs_916",
        intake: "plenum_short", asp: "centrifugal", turboSize: "f98", turbineMat: "cast_iron", ic: "ice_tank", boost: 1.4,
        nitrous: "none", fuel: "methanol", timing: 0, lambda: 0.82, oilGrade: "w10_40", oilSystem: "dry",
        oilSquirters: "fitted", cooling: "race", exhaust: "headers_merge", cover: "blue"
      }
    }),
    P({
      id: "compound402", name: "Compound-charged four-oh-two", basedOn: "402 ci compound-turbo small-block", cls: "outlaw",
      blurb: "104.8×95.3 small-block on a compound pair — a 76 feeding a 98 — at 34 psi on methanol. Two turbos, one lag-free hit.",
      soundProfile: "pushrod_v8", realHp: 2200, realRpm: 8000, realNm: 2200,
      cfg: {
        layout: "V8", bore: 104.8, stroke: 95.3, rodRatio: 1.7, cr: 8.5, blockMat: "billet_alu",
        deck: "closed", headMat: "alu", head: "billet_hemi", valveMat: "inconel", springs: "ti_retainers", cam: 74,
        lift: 80, redline: 8400, piston: "billet_tbc", pistonClearance: "loose", rings: "steel_drag", rod: "alu_billet",
        rodBolts: "age625", crank: "billet_300m", damper: "viscous", bearings: "coated", gasket: "copper_oring", studs: "studs_916",
        intake: "plenum_short", asp: "compound", turboSize: "f98", turbineMat: "inconel", ic: "ice_tank", boost: 2.3,
        nitrous: "none", fuel: "methanol", timing: 0, lambda: 0.8, oilGrade: "w10_40", oilSystem: "dry",
        oilSquirters: "fitted", cooling: "race", exhaust: "headers_merge", cover: "black"
      }
    }),
    /* ---- diesels: compression ignition, so no plugs and no octane. Truck engines are fuelled lean (λ 1.6–2.1)
       for a clean stack; the pullers run λ 1.2 and live with the smoke. ---- */
    P({
      id: "p4236", name: "Three-nine farm four", basedOn: "Perkins 4.236", starter: true, cls: "diesel",
      blurb: "98.4×127 iron pushrod four with a rotary pump and no turbo. Seventy-odd horsepower at a lazy 2,500 rpm, torque from just off idle, and it runs on whatever the farm tank holds.",
      soundProfile: null, realHp: 72, realRpm: 2500, realNm: 260,
      cfg: {
        layout: "I4", bore: 98.4, stroke: 127, rodRatio: 1.6, cr: 20, blockMat: "grey_iron",
        deck: "open", headMat: "iron", head: "pushrod2v", valveMat: "steel", springs: "single", cam: 5,
        lift: 40, redline: 2500, piston: "hyper", pistonClearance: "standard", rings: "moly", rod: "pm_forged",
        rodBolts: "oem", crank: "cast_nodular", damper: "rubber", bearings: "bimetal", gasket: "composite", studs: "bolts_tty",
        intake: "single_tb", asp: "na", turboSize: "small", turbineMat: "cast_iron", ic: "none", boost: 0.6,
        nitrous: "none", fuel: "diesel", dInj: "rotary_ve", dNoz: "stock", injectors: "i240", fuelPump: "p190", timing: 0, lambda: 1.6,
        oilGrade: "w10_40", oilSystem: "wet", oilSquirters: "none", cooling: "std", exhaust: "cast_log", cover: "blue"
      }
    }),
    P({
      id: "c59_12v", name: "Five-nine twelve-valve", basedOn: "Cummins 6BT 5.9 12v", cls: "diesel",
      blurb: "102×120 iron six with two valves a cylinder and a Bosch P7100 the size of a toolbox on the side. Gear-driven everything, and the bottom end will take three times the fuel it left the factory with.",
      soundProfile: null, realHp: 215, realRpm: 2500, realNm: 597,
      cfg: {
        layout: "I6", bore: 102, stroke: 120, rodRatio: 1.6, cr: 17.5, blockMat: "grey_iron",
        deck: "open", headMat: "iron", head: "pushrod2v", valveMat: "steel", springs: "single", cam: 5,
        lift: 45, redline: 2800, piston: "cast_alu", pistonClearance: "standard", rings: "steel", rod: "forged_4340",
        rodBolts: "oem", crank: "forged_4340", damper: "viscous", bearings: "trimetal", gasket: "mls", studs: "bolts_tty",
        intake: "single_tb", asp: "turbo", turboSize: "large", turbineMat: "cast_iron", ic: "air_air", boost: 1.35,
        nitrous: "none", fuel: "diesel", dInj: "inline_mech", dNoz: "stock", injectors: "i240", fuelPump: "p190", timing: 0, lambda: 2.1,
        oilGrade: "w15_50", oilSystem: "wet", oilSquirters: "fitted", cooling: "std", exhaust: "cast_log", cover: "red"
      }
    }),
    P({
      id: "lb7", name: "Six-six common rail V8", basedOn: "Duramax LB7 6.6", cls: "diesel",
      blurb: "103×99 iron V8 with aluminium four-valve heads and a 1,350-bar common rail. The pilot shot takes the rattle out, and the ECU only adds fuel as fast as the turbo brings air.",
      soundProfile: null, realHp: 300, realRpm: 3100, realNm: 705,
      cfg: {
        layout: "V8", bore: 103, stroke: 99, rodRatio: 1.65, cr: 17.5, blockMat: "grey_iron",
        deck: "open", headMat: "alu", head: "dohc4v", valveMat: "steel", springs: "single", cam: 10,
        lift: 45, redline: 3250, piston: "cast_alu", pistonClearance: "standard", rings: "moly", rod: "forged_4340",
        rodBolts: "oem", crank: "forged_4340", damper: "viscous", bearings: "trimetal", gasket: "mls", studs: "bolts_tty",
        intake: "single_tb", asp: "turbo", turboSize: "large", turbineMat: "cast_iron", ic: "air_air", boost: 1.2,
        nitrous: "none", fuel: "diesel", dInj: "cr_gen1", dNoz: "stock", injectors: "i240", fuelPump: "p190", timing: 0, lambda: 2,
        oilGrade: "w10_40", oilSystem: "wet", oilSquirters: "fitted", cooling: "std", exhaust: "cast_log", cover: "orange"
      }
    }),
    P({
      id: "psd73", name: "Seven-three HEUI V8", basedOn: "Ford/Navistar 7.3 Power Stroke", cls: "diesel",
      blurb: "104.4×106 iron pushrod V8 whose injectors are fired by engine oil at 200 bar. Slow-revving, loud at idle and famously hard to kill.",
      soundProfile: null, realHp: 275, realRpm: 2800, realNm: 705,
      cfg: {
        layout: "V8", bore: 104.4, stroke: 106, rodRatio: 1.65, cr: 17.5, blockMat: "grey_iron",
        deck: "open", headMat: "iron", head: "pushrod2v", valveMat: "steel", springs: "single", cam: 5,
        lift: 45, redline: 3300, piston: "cast_alu", pistonClearance: "standard", rings: "moly", rod: "forged_4340",
        rodBolts: "oem", crank: "forged_4340", damper: "viscous", bearings: "trimetal", gasket: "mls", studs: "bolts_tty",
        intake: "single_tb", asp: "turbo", turboSize: "large", turbineMat: "cast_iron", ic: "air_air", boost: 1.1,
        nitrous: "none", fuel: "diesel", dInj: "heui", dNoz: "stock", injectors: "i240", fuelPump: "p190", timing: 0, lambda: 2,
        oilGrade: "w10_40", oilSystem: "wet", oilSquirters: "fitted", cooling: "std", exhaust: "cast_log", cover: "blue"
      }
    }),
    P({
      id: "psd67", name: "Six-seven VGT V8", basedOn: "Ford 6.7 Power Stroke (Scorpion)", cls: "diesel",
      blurb: "99×108 compacted-graphite V8 with the exhaust in the valley, 2,000-bar piezo injection and one big variable-geometry turbo. The vanes shut make it pull from just off idle; open, it breathes like a much bigger turbine.",
      soundProfile: null, realHp: 400, realRpm: 2800, realNm: 1085,
      cfg: {
        layout: "V8", bore: 99, stroke: 108, rodRatio: 1.62, cr: 16.2, blockMat: "cgi",
        deck: "closed", headMat: "alu", head: "dohc4v", valveMat: "steel", springs: "single", cam: 8,
        lift: 45, redline: 3500, piston: "cast_alu", pistonClearance: "standard", rings: "moly", rod: "forged_4340",
        rodBolts: "oem", crank: "forged_4340", damper: "viscous", bearings: "trimetal", gasket: "mls", studs: "bolts_tty",
        intake: "single_tb", asp: "turbo", turboSize: "huge", turbineMat: "cast_iron", turbine: "vgt", ic: "water_air", boost: 1.7,
        nitrous: "none", fuel: "diesel", dInj: "cr_piezo", dNoz: "stock", injectors: "i240", fuelPump: "p190", timing: 0, lambda: 1.85,
        oilGrade: "w10_40", oilSystem: "wet", oilSquirters: "fitted", cooling: "uprated", exhaust: "cast_log", cover: "blue"
      }
    }),
    P({
      id: "alh", name: "One-nine TDI", basedOn: "VW 1.9 TDI ALH", cls: "diesel",
      blurb: "79.5×95.5 iron four with a direct-injection bowl in the piston, a VE pump and a small turbo. Half the fuel of the petrol car it replaced and enough torque to tow it.",
      soundProfile: null, realHp: 90, realRpm: 3750, realNm: 210,
      cfg: {
        layout: "I4", bore: 79.5, stroke: 95.5, rodRatio: 1.52, cr: 19.5, blockMat: "grey_iron",
        deck: "open", headMat: "alu", head: "sohc2v", valveMat: "steel", springs: "single", cam: 15,
        lift: 45, redline: 4500, piston: "cast_alu", pistonClearance: "standard", rings: "moly", rod: "pm_forged",
        rodBolts: "oem", crank: "forged_4340", damper: "rubber", bearings: "bimetal", gasket: "mls", studs: "bolts_tty",
        intake: "single_tb", asp: "turbo", turboSize: "small", turbineMat: "cast_iron", ic: "air_air", boost: 1,
        nitrous: "none", fuel: "diesel", dInj: "rotary_ve", dNoz: "stock", injectors: "i240", fuelPump: "p190", timing: 0, lambda: 1.45,
        oilGrade: "w5_30", oilSystem: "wet", oilSquirters: "fitted", cooling: "std", exhaust: "cast_log", cover: "black"
      }
    }),
    P({
      id: "om606", name: "Three-litre inline-six diesel", basedOn: "Mercedes-Benz OM606 3.0", cls: "diesel",
      blurb: "87×84 iron six, four valves a cylinder, a prechamber and an inline pump. Revs like a petrol engine for a diesel and runs a million kilometres in a taxi rank.",
      soundProfile: null, realHp: 134, realRpm: 5000, realNm: 210,
      cfg: {
        layout: "I6", bore: 87, stroke: 84, rodRatio: 1.7, cr: 22, blockMat: "grey_iron",
        deck: "open", headMat: "alu", head: "dohc4v", valveMat: "steel", springs: "single", cam: 60,
        lift: 55, redline: 5200, piston: "cast_alu", pistonClearance: "standard", rings: "moly", rod: "pm_forged",
        rodBolts: "oem", crank: "forged_4340", damper: "viscous", bearings: "bimetal", gasket: "mls", studs: "bolts_tty",
        intake: "single_tb", asp: "na", turboSize: "small", turbineMat: "cast_iron", ic: "none", boost: 0.6,
        nitrous: "none", fuel: "diesel", dInj: "inline_mech", dNoz: "stock", injectors: "i240", fuelPump: "p190", timing: 0, lambda: 1.45,
        oilGrade: "w5_30", oilSystem: "wet", oilSquirters: "fitted", cooling: "std", exhaust: "cast_log", cover: "silver"
      }
    }),
    P({
      id: "s60", name: "Twelve-seven big-rig six", basedOn: "Detroit Diesel Series 60 12.7", cls: "diesel",
      blurb: "A 12.7 L iron six with an overhead cam working electronic unit injectors. Built to pull eighty thousand pounds for a million miles at eighteen hundred rpm.",
      soundProfile: null, realHp: 470, realRpm: 1800, realNm: 2200,
      cfg: {
        layout: "I6", bore: 125, stroke: 172, rodRatio: 1.7, cr: 16.5, blockMat: "cgi",
        deck: "open", headMat: "iron", head: "sohc2v", valveMat: "steel", springs: "single", cam: 5,
        lift: 40, redline: 1800, piston: "forged_2618", pistonClearance: "standard", rings: "steel", rod: "forged_4340",
        rodBolts: "oem", crank: "forged_4340", damper: "viscous", bearings: "trimetal", gasket: "copper_oring", studs: "l19",
        intake: "single_tb", asp: "twin_turbo", turboSize: "medium", turbineMat: "cast_iron", ic: "air_air", boost: 2.1,
        nitrous: "none", fuel: "diesel", dInj: "heui", dNoz: "n30", injectors: "i240", fuelPump: "p340", timing: 0, lambda: 1.6,
        oilGrade: "w15_50", oilSystem: "wet", oilSquirters: "fitted", cooling: "uprated", exhaust: "cast_log", cover: "gold"
      }
    }),
    P({
      id: "1kd", name: "Twin-cam three-litre common rail", basedOn: "Toyota 1KD-FTV 3.0 D-4D", cls: "diesel",
      blurb: "96×103.6 iron four with a twin-cam sixteen-valve head, a variable-vane turbo and a piezo rail. The engine under every Hilux and Land Cruiser from Perth to the Sahel.",
      soundProfile: null, realHp: 170, realRpm: 3400, realNm: 410,
      cfg: {
        layout: "I4", bore: 96, stroke: 103.6, rodRatio: 1.6, cr: 17.9, blockMat: "grey_iron",
        deck: "open", headMat: "alu", head: "dohc4v", valveMat: "steel", springs: "single", cam: 10,
        lift: 45, redline: 4000, piston: "cast_alu", pistonClearance: "standard", rings: "steel", rod: "forged_4340",
        rodBolts: "oem", crank: "forged_4340", damper: "rubber", bearings: "trimetal", gasket: "mls", studs: "arp_studs",
        intake: "single_tb", asp: "turbo", turboSize: "medium", turbineMat: "cast_iron", ic: "air_air", boost: 1.5,
        nitrous: "none", fuel: "diesel", dInj: "cr_piezo", dNoz: "stock", injectors: "i240", fuelPump: "p190", timing: 0, lambda: 1.8,
        oilGrade: "w10_40", oilSystem: "wet", oilSquirters: "fitted", cooling: "std", exhaust: "cast_log", cover: "black"
      }
    }),
    P({
      id: "smoker26", name: "Smoker 2.6 Cummins", basedOn: "2.6 smoker-class 5.9 Cummins", cls: "pulling",
      blurb: "A 5.9 on a single turbo with a 2.6-inch inducer, a cranked P-pump and 150 hp sticks. Sixty-five psi from a map-width wheel, black smoke from the line to the stop and about four times the factory fuel.",
      soundProfile: null, realHp: 850, realRpm: 4000, realNm: 1650,
      cfg: {
        layout: "I6", bore: 102, stroke: 120, rodRatio: 1.6, cr: 16, blockMat: "cgi",
        deck: "closed", headMat: "iron", head: "pushrod2v", valveMat: "inconel", springs: "dual", cam: 25,
        lift: 70, redline: 4000, piston: "billet_tbc", pistonClearance: "loose", rings: "steel_drag", rod: "forged_300m",
        rodBolts: "arp2000", crank: "billet_300m", damper: "viscous", bearings: "coated", gasket: "copper_oring", studs: "studs_916",
        intake: "single_tb", asp: "turbo", turboSize: "s66", turbineMat: "inconel", ic: "air_air", boost: 4.5,
        nitrous: "none", fuel: "diesel", dInj: "inline_mech", dNoz: "n150", injectors: "i240", fuelPump: "twin450", timing: -2, lambda: 1.2,
        oilGrade: "w15_50", oilSystem: "wet", oilSquirters: "fitted", cooling: "race", exhaust: "cast_log", cover: "red"
      }
    }),
    P({
      id: "ss_triple", name: "Super Stock triple-turbo", basedOn: "Super Stock diesel pulling truck", cls: "pulling",
      blurb: "A billet-everything 5.9 under three turbos at a hundred psi, 14:1 and pulling sticks. Fifteen hundred horsepower for three hundred feet, then a full teardown.",
      soundProfile: null, realHp: 1500, realRpm: 4800, realNm: 2500,
      cfg: {
        layout: "I6", bore: 102, stroke: 120, rodRatio: 1.6, cr: 14, blockMat: "cgi",
        deck: "closed", headMat: "iron", head: "pushrod2v", valveMat: "inconel", springs: "dual", cam: 60,
        lift: 85, redline: 4800, piston: "billet_tbc", pistonClearance: "loose", rings: "steel_drag", rod: "forged_300m",
        rodBolts: "arp2000", crank: "billet_300m", damper: "viscous", bearings: "coated", gasket: "copper_oring", studs: "studs_916",
        intake: "single_tb", asp: "compound", turboSize: "huge", turbineMat: "inconel", ic: "air_air", boost: 7,
        nitrous: "none", fuel: "diesel", dInj: "inline_mech", dNoz: "n250", injectors: "i240", fuelPump: "twin450", timing: -5, lambda: 1.22,
        oilGrade: "w15_50", oilSystem: "wet", oilSquirters: "fitted", cooling: "race", exhaust: "cast_log", cover: "black"
      }
    }),
    /* ---- Wankel rotaries: rotor width (bore), generating radius (stroke) and eccentricity in place of
       bore and stroke; displacement quoted Mazda's way (one chamber a rotor) ---- */
    P({
      id: "12a_sa", name: "Twelve-A carburettor rotary", basedOn: "Mazda 12A (RX-7 SA)", starter: true, cls: "rotary",
      blurb: "Two 573 cc rotors (R 105, e 15, 70 mm wide) fed by a four-barrel carburettor. A hundred horsepower out of 1.1 litres, a buzz like an angry sewing machine and nothing at all to shake.",
      soundProfile: null, realHp: 100, realRpm: 6000, realNm: 142,
      cfg: {
        layout: "R2", bore: 70, stroke: 105, ecc: 15, cr: 9.4, rotPort: "side", apexSeal: "oem3", rotHousing: "chrome",
        sidePlate: "iron", eshaft: "stock", oilMeter: "omp", bearings: "bimetal", redline: 7000,
        intake: "carb", asp: "na", turboSize: "small", turbineMat: "cast_iron", ic: "none", boost: 0.6, nitrous: "none",
        fuel: "r87", timing: 0, lambda: 0.92, oilGrade: "w10_40", oilSystem: "wet", cooling: "std", exhaust: "cast_log", cover: "silver"
      }
    }),
    P({
      id: "13b_fc", name: "Thirteen-B six-port", basedOn: "Mazda 13B (FC RX-7 NA)", cls: "rotary",
      blurb: "Two 654 cc rotors, side ports and the six-port induction that opens extra runners above 5,000 rpm. 146 hp, a torque peak a piston engine of its size would envy, and the economy of a V8.",
      soundProfile: null, realHp: 146, realRpm: 6500, realNm: 187,
      cfg: {
        layout: "R2", bore: 80, stroke: 105, ecc: 15, cr: 9.4, rotPort: "side", apexSeal: "oem3", rotHousing: "chrome",
        sidePlate: "iron", eshaft: "stock", oilMeter: "omp", bearings: "bimetal", redline: 7000,
        intake: "plenum_long", asp: "na", turboSize: "small", turbineMat: "cast_iron", ic: "none", boost: 0.6, nitrous: "none",
        fuel: "r91", timing: 0, lambda: 0.90, oilGrade: "w10_40", oilSystem: "wet", cooling: "std", exhaust: "cast_tubular", cover: "black"
      }
    }),
    P({
      id: "13b_rew", name: "Sequential-twin Thirteen-B", basedOn: "Mazda 13B-REW (FD RX-7)", cls: "rotary",
      blurb: "The 13B with two turbos in sequence: the first lights at 1,800 rpm, the second takes over at 4,500. 255 hp at 0.8 bar from 1.3 litres \u2014 hot, thirsty, and one knock event away from a rebuild.",
      soundProfile: null, realHp: 255, realRpm: 6500, realNm: 294,
      cfg: {
        layout: "R2", bore: 80, stroke: 105, ecc: 15, cr: 9.0, rotPort: "side", apexSeal: "oem3", rotHousing: "chrome",
        sidePlate: "iron", eshaft: "stock", oilMeter: "omp", bearings: "bimetal", redline: 8000,
        intake: "plenum_short", asp: "twin_turbo", turboSize: "medium", turbineMat: "cast_iron", ic: "air_air", boost: 0.8, nitrous: "none",
        fuel: "r94", timing: 0, lambda: 0.80, oilGrade: "w10_40", oilSystem: "wet", cooling: "uprated", exhaust: "cast_tubular", cover: "red"
      }
    }),
    P({
      id: "renesis", name: "Nine-thousand Renesis", basedOn: "Mazda 13B-MSP Renesis (RX-8)", cls: "rotary",
      blurb: "Side exhaust ports, three intake ports a rotor, 2 mm apex seals and 10:1. No overlap, so it idles like a piano and pulls cleanly to 9,000 \u2014 232 hp from 1.3 litres with no turbo at all.",
      soundProfile: null, realHp: 232, realRpm: 8500, realNm: 216,
      cfg: {
        layout: "R2", bore: 80, stroke: 105, ecc: 15, cr: 10.0, rotPort: "sidex", apexSeal: "oem2", rotHousing: "chrome",
        sidePlate: "iron", eshaft: "stock", oilMeter: "emop", bearings: "bimetal", redline: 9000,
        intake: "plenum_short", asp: "na", turboSize: "small", turbineMat: "cast_iron", ic: "none", boost: 0.6, nitrous: "none",
        fuel: "r94", timing: 0, lambda: 0.88, oilGrade: "w5_30", oilSystem: "wet", cooling: "std", exhaust: "headers_equal", cover: "silver"
      }
    }),
    P({
      id: "20b_rew", name: "Three-rotor twin-turbo", basedOn: "Mazda 20B-REW (Eunos Cosmo)", cls: "rotary",
      blurb: "Three 654 cc rotors on a one-piece eccentric shaft, sequential twins and the smoothness of a V12 from two litres. The only production three-rotor ever sold.",
      soundProfile: null, realHp: 296, realRpm: 6500, realNm: 402,
      cfg: {
        layout: "R3", bore: 80, stroke: 105, ecc: 15, cr: 9.0, rotPort: "side", apexSeal: "oem3", rotHousing: "chrome",
        sidePlate: "iron", eshaft: "stock", oilMeter: "omp", bearings: "bimetal", redline: 7000,
        intake: "plenum_long", asp: "twin_turbo", turboSize: "medium", turbineMat: "cast_iron", ic: "air_air", boost: 0.6, nitrous: "none",
        fuel: "r94", timing: 0, lambda: 0.80, oilGrade: "w10_40", oilSystem: "wet", cooling: "uprated", exhaust: "cast_tubular", cover: "blue"
      }
    }),
    P({
      id: "13b_bp", name: "Bridge-port club racer", basedOn: "13B bridge-port race build", cls: "rotary",
      blurb: "A 13B with bridged side ports, billet apex seals in Nikasil housings, individual throttles and premix in the tank. Three hundred horsepower at 9,000, an idle like a cement mixer, and a rebuild every season.",
      soundProfile: null, realHp: 300, realRpm: 9000, realNm: 250,
      cfg: {
        layout: "R2", bore: 80, stroke: 105, ecc: 15, cr: 10.0, rotPort: "bridge", apexSeal: "billet", rotHousing: "nikasil",
        sidePlate: "hardened", eshaft: "stock", oilMeter: "premix", bearings: "trimetal", redline: 9600,
        intake: "itb", asp: "na", turboSize: "small", turbineMat: "cast_iron", ic: "none", boost: 0.6, nitrous: "none",
        fuel: "race100", timing: 0, lambda: 0.88, oilGrade: "w15_50", oilSystem: "dry", cooling: "race", exhaust: "headers_merge", cover: "orange"
      }
    }),
    P({
      id: "r26b", name: "Four-rotor Le Mans screamer", basedOn: "Mazda R26B (787B)", cls: "rotary",
      blurb: "Four rotors, peripheral intake ports, ceramic seals in ceramic-coated housings and a split eccentric shaft with a centre main bearing. Seven hundred horsepower at 9,000 and the most famous noise in motor racing.",
      soundProfile: null, realHp: 690, realRpm: 9000, realNm: 608,
      cfg: {
        layout: "R4", bore: 80, stroke: 105, ecc: 15, cr: 10.5, rotPort: "peri", apexSeal: "ceramic", rotHousing: "ceramic",
        sidePlate: "alu", eshaft: "split", oilMeter: "premix", bearings: "trimetal", redline: 9500,
        intake: "itb", asp: "na", turboSize: "small", turbineMat: "cast_iron", ic: "none", boost: 0.6, nitrous: "none",
        fuel: "race100", timing: 0, lambda: 0.88, oilGrade: "w15_50", oilSystem: "dry", cooling: "race", exhaust: "headers_merge", cover: "orange"
      }
    }),
    /* ---- two-strokes: every cylinder fires every turn. Port durations in crank degrees, compression quoted trapped
       (from exhaust-port closing), the pipe's tuned rpm at about 560 C of pipe gas. ---- */
    P({
      id: "ktm250sx", name: "Two-fifty motocross single", basedOn: "KTM 250 SX", cls: "motorsport",
      blurb: "66.4\u00d772 on a reed valve, a power valve and a Nikasil barrel, with a big expansion chamber cut for 8,400 rpm. Flat and docile until about seven thousand, then it comes on the pipe like a light switch.",
      soundProfile: null, realHp: 47, realRpm: 8500, realNm: 41,
      cfg: {
        cycle: "two", layout: "I1", bore: 66.4, stroke: 72, rodRatio: 1.75, cr: 8.8, ccr: 1.40, blockMat: "alu_nikasil", deck: "open", headMat: "alu",
        piston: "forged_4032", pistonClearance: "standard", rings: "moly", rod: "forged_4340", rodBolts: "oem", crank: "forged_4340", damper: "none", bearings: "trimetal",
        gasket: "copper_oring", studs: "arp_studs", scav: "loop", ePort: 190, tPort: 128, pv: "fitted", redline: 9800, induct: "reed", tsFuel: "carb",
        asp: "na", turboSize: "small", turbineMat: "cast_iron", ic: "none", boost: 0.6, nitrous: "none", xpipe: "chamber", pipeRpm: 8400,
        fuel: "r94", injectors: "i240", fuelPump: "p190", timing: 0, lambda: 0.86, lube: "premix", premix: 60, cooling: "std", cover: "orange",
        head: "sohc2v", valveMat: "steel", springs: "single", cam: 40, lift: 60, intake: "carb", exhaust: "cast_tubular", oilGrade: "w10_40", oilSystem: "wet", oilSquirters: "none" }
    }),
    P({
      id: "yz125", name: "One-twenty-five screamer", basedOn: "Yamaha YZ125", cls: "motorsport",
      blurb: "54\u00d754.5, 196 degrees of exhaust port and YPVS: nothing much happens below nine thousand, and then it screams to twelve. Rebuild the top end every few race weekends and never let it fall off the pipe.",
      soundProfile: null, realHp: 36, realRpm: 11000, realNm: 24,
      cfg: {
        cycle: "two", layout: "I1", bore: 54, stroke: 54.5, rodRatio: 1.83, cr: 9.6, ccr: 1.38, blockMat: "alu_nikasil", deck: "open", headMat: "alu",
        piston: "forged_4032", pistonClearance: "standard", rings: "moly", rod: "forged_4340", rodBolts: "oem", crank: "forged_4340", damper: "none", bearings: "trimetal",
        gasket: "copper_oring", studs: "arp_studs", scav: "loop", ePort: 196, tPort: 131, pv: "fitted", redline: 12000, induct: "reed", tsFuel: "carb",
        asp: "na", turboSize: "small", turbineMat: "cast_iron", ic: "none", boost: 0.6, nitrous: "none", xpipe: "chamber", pipeRpm: 10800,
        fuel: "r94", injectors: "i240", fuelPump: "p190", timing: 0, lambda: 0.85, lube: "premix", premix: 40, cooling: "std", cover: "blue",
        head: "sohc2v", valveMat: "steel", springs: "single", cam: 40, lift: 60, intake: "carb", exhaust: "cast_tubular", oilGrade: "w10_40", oilSystem: "wet", oilSquirters: "none" }
    }),
    P({
      id: "rotax800", name: "Eight-hundred sled twin", basedOn: "Rotax 800R E-TEC (Ski-Doo)", cls: "performance",
      blurb: "An 800 cc parallel twin with direct injection, RAVE power valves and an oil pump: the charge that short-circuits is only air, so it sips where a carburetted sled drinks. Pinned at eight thousand across a frozen lake.",
      soundProfile: null, realHp: 164, realRpm: 8100, realNm: 145,
      cfg: {
        cycle: "two", layout: "I2", bore: 82, stroke: 75.7, rodRatio: 1.72, cr: 8.8, ccr: 1.40, blockMat: "alu_nikasil", deck: "open", headMat: "alu",
        piston: "forged_4032", pistonClearance: "standard", rings: "moly", rod: "forged_4340", rodBolts: "oem", crank: "forged_4340", damper: "none", bearings: "trimetal",
        gasket: "copper_oring", studs: "arp_studs", scav: "loop", ePort: 190, tPort: 128, pv: "fitted", redline: 8300, induct: "reed", tsFuel: "di",
        asp: "na", turboSize: "small", turbineMat: "cast_iron", ic: "none", boost: 0.6, nitrous: "none", xpipe: "chamber", pipeRpm: 7600,
        fuel: "r91", injectors: "i650", fuelPump: "p255", timing: 0, lambda: 0.86, lube: "inject", premix: 50, cooling: "uprated", cover: "black",
        head: "sohc2v", valveMat: "steel", springs: "single", cam: 40, lift: 60, intake: "single_tb", exhaust: "cast_tubular", oilGrade: "w10_40", oilSystem: "wet", oilSquirters: "none" }
    }),
    P({
      id: "merc25", name: "Two-and-a-half litre outboard V6", basedOn: "Mercury 2.5 L V6 EFI 200", cls: "performance",
      blurb: "A 60-degree V6 powerhead, reed-fed with transfer-port injection and an oil pump, exhausting through the prop hub. Mild ports and a quiet exhaust: torque from the hole and two hundred horsepower at wide-open throttle all day.",
      soundProfile: null, realHp: 200, realRpm: 5500, realNm: 285,
      cfg: {
        cycle: "two", layout: "V6", bore: 88.9, stroke: 67.3, rodRatio: 1.75, cr: 6.6, ccr: 1.36, blockMat: "alu_liners", deck: "open", headMat: "alu",
        piston: "forged_4032", pistonClearance: "standard", rings: "cast", rod: "forged_4340", rodBolts: "oem", crank: "forged_4340", damper: "rubber", bearings: "trimetal",
        gasket: "copper_oring", studs: "arp_studs", scav: "loop", ePort: 160, tPort: 120, pv: "none", redline: 5800, induct: "reed", tsFuel: "efi",
        asp: "na", turboSize: "small", turbineMat: "cast_iron", ic: "none", boost: 0.6, nitrous: "none", xpipe: "muffled", pipeRpm: 5500,
        fuel: "r91", injectors: "i440", fuelPump: "p255", timing: 0, lambda: 0.86, lube: "inject", premix: 50, cooling: "uprated", cover: "black",
        head: "sohc2v", valveMat: "steel", springs: "single", cam: 40, lift: 60, intake: "single_tb", exhaust: "cast_tubular", oilGrade: "w10_40", oilSystem: "wet", oilSquirters: "none" }
    }),
    P({
      id: "saab96", name: "Three-cylinder Swedish two-stroke", basedOn: "Saab 96 841 cc", cls: "classic",
      blurb: "Three loop-scavenged cylinders on a piston-port crankcase, one Solex carburettor and 33:1 in the tank. It rallied, it smoked, and it goes 'ring-ding-ding' at idle like nothing else on four wheels.",
      soundProfile: null, realHp: 38, realRpm: 5000, realNm: 79,
      cfg: {
        cycle: "two", layout: "I3", bore: 70, stroke: 72.9, rodRatio: 1.85, cr: 5.8, ccr: 1.25, blockMat: "grey_iron", deck: "open", headMat: "alu",
        piston: "cast_alu", pistonClearance: "standard", rings: "cast", rod: "cast_steel", rodBolts: "oem", crank: "forged_4340", damper: "rubber", bearings: "bimetal",
        gasket: "composite", studs: "bolts_tty", scav: "loop", ePort: 126, tPort: 112, pv: "none", redline: 5500, induct: "piston", tsFuel: "carb",
        asp: "na", turboSize: "small", turbineMat: "cast_iron", ic: "none", boost: 0.6, nitrous: "none", xpipe: "muffled", pipeRpm: 5000,
        fuel: "r87", injectors: "i240", fuelPump: "p190", timing: 0, lambda: 0.90, lube: "premix", premix: 33, cooling: "std", cover: "silver",
        head: "sohc2v", valveMat: "steel", springs: "single", cam: 40, lift: 60, intake: "carb", exhaust: "cast_tubular", oilGrade: "w10_40", oilSystem: "wet", oilSquirters: "none" }
    }),
    P({
      id: "trabant601", name: "People's car twin", basedOn: "Trabant 601", cls: "economy",
      blurb: "594 cc, two air-cooled cylinders, a piston-port crankcase and a single carburettor, built for thirty years with hardly a change. Twenty-six horsepower, a cloud of blue and a sound like a two-stroke lawnmower with ambition.",
      soundProfile: null, realHp: 26, realRpm: 4200, realNm: 54,
      cfg: {
        cycle: "two", layout: "I2", bore: 72, stroke: 73, rodRatio: 1.85, cr: 5.8, ccr: 1.25, blockMat: "grey_iron", deck: "open", headMat: "alu",
        piston: "cast_alu", pistonClearance: "standard", rings: "cast", rod: "cast_steel", rodBolts: "oem", crank: "cast_nodular", damper: "rubber", bearings: "bimetal",
        gasket: "composite", studs: "bolts_tty", scav: "loop", ePort: 118, tPort: 108, pv: "none", redline: 4500, induct: "piston", tsFuel: "carb",
        asp: "na", turboSize: "small", turbineMat: "cast_iron", ic: "none", boost: 0.6, nitrous: "none", xpipe: "muffled", pipeRpm: 4200,
        fuel: "r87", injectors: "i240", fuelPump: "p190", timing: 0, lambda: 0.92, lube: "premix", premix: 33, cooling: "std", cover: "blue",
        head: "sohc2v", valveMat: "steel", springs: "single", cam: 40, lift: 60, intake: "carb", exhaust: "cast_tubular", oilGrade: "w10_40", oilSystem: "wet", oilSquirters: "none" }
    }),
    P({
      id: "dd671", name: "Six-seventy-one Jimmy", basedOn: "Detroit Diesel 6-71N", cls: "truck",
      blurb: "Seventy-one cubic inches a cylinder, six in a row, a Roots blower bolted to the side filling the air box and four exhaust valves in every head. Uniflow-scavenged, governed at 2,100 and it screams like a jet at every shift.",
      soundProfile: null, realHp: 238, realRpm: 2100, realNm: 834,
      cfg: {
        cycle: "two", layout: "I6", bore: 108, stroke: 127, rodRatio: 2.0, cr: 18.7, blockMat: "grey_iron", deck: "open", headMat: "iron",
        piston: "forged_4032", pistonClearance: "standard", rings: "moly", rod: "forged_4340", rodBolts: "oem", crank: "forged_4340", damper: "viscous", bearings: "trimetal",
        gasket: "composite", studs: "studs_916", valveMat: "steel", springs: "single", scav: "uniflow", ePort: 140, tPort: 100, pv: "none", redline: 2100, induct: "blower",
        asp: "na", turboSize: "medium", turbineMat: "cast_iron", ic: "none", boost: 0.6, nitrous: "none", xpipe: "muffled", pipeRpm: 2100,
        fuel: "diesel", dInj: "unit_dd", dNoz: "stock", injectors: "i240", fuelPump: "mech", timing: 0, lambda: 1.95, lube: "premix", premix: 50, ccr: 1.40,
        oilGrade: "w15_50", oilSystem: "wet", oilSquirters: "fitted", cooling: "uprated", cover: "black",
        head: "sohc2v", cam: 20, lift: 40, intake: "single_tb", exhaust: "cast_log" }
    }),
    P({
      id: "dd8v92", name: "Eight-V-ninety-two TA", basedOn: "Detroit Diesel 8V-92TA", cls: "diesel",
      blurb: "Twelve litres of 90-degree V8 two-stroke with the blower in the valley and a turbo feeding it, electronic unit injectors and torque that climbs as the revs fall. The highway tractor and the tractor puller's favourite noise.",
      soundProfile: null, realHp: 445, realRpm: 2100, realNm: 1830,
      cfg: {
        cycle: "two", layout: "V8", bore: 123, stroke: 127, rodRatio: 2.0, cr: 17.0, blockMat: "grey_iron", deck: "open", headMat: "iron",
        piston: "forged_4032", pistonClearance: "standard", rings: "moly", rod: "forged_4340", rodBolts: "oem", crank: "forged_4340", damper: "viscous", bearings: "trimetal",
        gasket: "composite", studs: "studs_916", valveMat: "steel", springs: "single", scav: "uniflow", ePort: 140, tPort: 100, pv: "none", redline: 2100, induct: "blower",
        asp: "turbo", turboSize: "f98", turbineMat: "cast_iron", ic: "water_air", boost: 0.3, nitrous: "none", xpipe: "muffled", pipeRpm: 2100,
        fuel: "diesel", dInj: "unit_dd", dNoz: "stock", injectors: "i240", fuelPump: "twin450", timing: 0, lambda: 2.1, lube: "premix", premix: 50, ccr: 1.40,
        oilGrade: "w15_50", oilSystem: "wet", oilSquirters: "fitted", cooling: "uprated", cover: "silver",
        head: "sohc2v", cam: 20, lift: 40, intake: "single_tb", exhaust: "cast_log" }
    }),
    P({
      id: "deltic", name: "Deltic triangle", basedOn: "Napier Deltic D18-25", cls: "diesel",
      blurb: "Eighteen cylinders in three banks arranged as a triangle, two pistons meeting in each and a crankshaft at every corner: 88 litres, no valves, a gear-driven scavenge blower and 1,650 horsepower at 1,500 rpm. Twice over in every Deltic locomotive.",
      soundProfile: null, realHp: 1650, realRpm: 1500, realNm: 7830,
      cfg: {
        cycle: "two", layout: "D18", bore: 130.2, stroke: 184.2, rodRatio: 2.2, cr: 17.9, blockMat: "alu_liners", deck: "open", headMat: "iron",
        piston: "forged_4032", pistonClearance: "tight", rings: "moly", rod: "forged_4340", rodBolts: "oem", crank: "forged_4340", damper: "viscous", bearings: "trimetal",
        gasket: "composite", studs: "studs_916", valveMat: "steel", springs: "single", scav: "uniflow", ePort: 140, tPort: 100, pv: "none", redline: 1500, induct: "blower",
        asp: "na", turboSize: "medium", turbineMat: "cast_iron", ic: "none", boost: 0.6, nitrous: "none", xpipe: "muffled", pipeRpm: 1500,
        fuel: "diesel", dInj: "inline_mech", dNoz: "n100", injectors: "i240", fuelPump: "mech", timing: 0, lambda: 2.25, lube: "premix", premix: 50, ccr: 1.40,
        oilGrade: "w15_50", oilSystem: "wet", oilSquirters: "fitted", cooling: "uprated", cover: "black",
        head: "sohc2v", cam: 20, lift: 40, intake: "single_tb", exhaust: "cast_log" }
    })
  ];

  /* ---- fuel hardware for the presets: [injectors, pump]. The smallest set that feeds each one with
     margin (duty under ~72%, pump under ~76%), which lands on the real part where it is well known:
     RB26 444s and early 2JZ 440s, 565 cc on the EJ257 and 560s on the Evo (650 here), the Hellcat's
     twin pumps, and belt pumps on the alcohol and nitrous drag engines. A preset that carries its
     own fuel parts keeps them; one missing from this list is sized by fitFuel() as it loads. ---- */
  const PRESET_FUEL = {
    g10: ["i240", "p190"], "4ac": ["i240", "p190"], "22re": ["i240", "p190"], ea82: ["i240", "p190"],
    l36: ["i440", "p190"], k20a: ["i440", "p190"], "2jzgte": ["i440", "p190"], rb26: ["i440", "p190"],
    ls3: ["i440", "p255"], coyote: ["i440", "p190"], ej257: ["i650", "p190"], f6_38: ["i650", "p190"],
    s54: ["i440", "p190"], v8fp45: ["i650", "p255"], v12_65: ["i650", "p340"], v10_52: ["i440", "p255"],
    i3_1000: ["i440", "p190"], ea888: ["i650", "p190"], m133: ["i1000", "p255"], hemi64: ["i650", "p255"],
    i5_25t: ["i650", "p255"], outlaw_radial: ["i2200x2", "mech"], outlaw_promod: ["i2200x4", "mech"], d15b: ["i240", "p190"],
    ea211: ["i440", "p190"], "2zr": ["i240", "p190"], skyg25: ["i440", "p190"], kent: ["i240", "p190"],
    lima23: ["i240", "p190"], ford300: ["i440", "p190"], vortec43: ["i440", "p190"], "1gr": ["i440", "p190"],
    godzilla73: ["i440", "p190"], sbc350: ["i240", "p190"], f20c: ["i440", "p190"], "4age20v": ["i440", "p190"],
    "4g63": ["i650", "p190"], b58: ["i650", "p190"], vr38: ["i1000", "p340"], "9a2tt": ["i650", "p255"],
    m156: ["i440", "p190"], voodoo: ["i650", "p255"], hellcat: ["i1000", "twin450"], lt4: ["i650", "p340"],
    s85: ["i440", "p255"], "1lr": ["i440", "p255"], dfv: ["i440", "p190"], wrc16: ["i1000", "p255"],
    gt3r: ["i650", "p255"], valkyrie: ["i650", "p340"], k24_1000: ["i2200x2", "mech"], jz_1500: ["i2200x2", "mech"],
    n2o632: ["i240", "mech"], pro540: ["i2200x2", "mech"], compound402: ["i2200x4", "mech"]
  };
  for (const p of PRESETS) {
    const f = PRESET_FUEL[p.id];
    if (!p.cfg.injectors || !p.cfg.fuelPump) Object.assign(p.cfg, f ? { injectors: f[0], fuelPump: f[1] } : fitFuel(p.cfg));
  }

