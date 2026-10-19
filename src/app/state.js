<script>
/* ===================== Prairie Engine Works — app ===================== */
const SIM=ENGINE_SIM,{LAYOUTS,OPT,FORM,PRESETS}=SIM;
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt$=n=>(n<0?"-$":"$")+Math.round(Math.abs(n)).toLocaleString("en-CA");
const UPGRADES=[
  {id:"dyno2",name:"Engine dyno",desc:"Reads to 1,000 hp / 10,000 rpm. The chassis dyno tops out at 400 hp.",price:18000},
  {id:"shop1",name:"Machine shop I",desc:"Forged pistons and rods, forged cranks, better bolts, baffled sump.",price:14000},
  {id:"flow",name:"Flow bench",desc:"Variable valve timing and lift, individual throttles, tuned runners.",price:16000},
  {id:"boost",name:"Boost bench",desc:"Turbochargers, superchargers, intercoolers and the fuels that like them.",price:24000},
  {id:"bay1",name:"Second bay",desc:"Room for inline-5, inline-6, V8 and flat-6 blocks.",price:36000},
  {id:"shop2",name:"Machine shop II",desc:"Billet cranks, titanium, 300M, coated bearings, dry sumps, exotic fuels \u2014 and the pulling parts: billet TBC pistons, drag-gap rings, 9/16 studs, compound turbos and 250 hp sticks.",price:60000,needs:"shop1"},
  {id:"dyno3",name:"Pro dyno cell",desc:"Reads to 2,000 hp / 12,500 rpm, with climate control: test hot, cold or at altitude. Contracts still certify in the standard cell.",price:90000,needs:"dyno2"},
  {id:"bay2",name:"Race bay",desc:"V10 and V12 blocks and the contracts that want them.",price:140000,needs:"bay1"},
  {id:"race",name:"Outlaw shop",desc:"Billet blocks and heads, 88 and 98 mm turbo frames, screw blowers, nitrous and aluminium rods \u2014 and the bore, stroke and boost limits that go with them.",price:280000,needs:"shop2"},
  {id:"bay3",name:"Build bay C",desc:"A third bay that builds market contracts on its own. Hire a bay lead; $5,000 a week to run once staffed.",price:350000,needs:"bay2"},
  {id:"bay4",name:"Build bay D",desc:"A fourth bay for a second contract at a time. Its own bay lead; $8,000 a week to run once staffed.",price:900000,needs:"bay3"},
  {id:"tool",name:"Tooling hall",desc:"Fixtures, jigs and a second mill. Bay jobs of three weeks or more finish a week sooner and QC improves a little. Opens at 300 rep; adds a little to weekly overhead.",price:250000,needs:"race",rep:300,oh:0.4},
  {id:"qlab",name:"Quality lab",desc:"CMM bench and a bore-gauge wall. Bay builds pass QC more often and the pay for them improves. Opens at 700 rep.",price:450000,needs:"tool",rep:700,oh:0.4},
  {id:"acad",name:"Training academy",desc:"A classroom over the shop. Staff and bay-lead courses run a week shorter and teach 25% more. Opens at 700 rep.",price:800000,needs:"race",rep:700,oh:0.4},
  {id:"hall",name:"Showroom hall",desc:"A glass-fronted hall for finished engines. +5 rep a week and a steady trickle of visitors. Opens at the Legend tier (1,500 rep).",price:2500000,needs:"qlab",rep:1500,oh:0.3},
  {id:"dyno4",name:"Outlaw dyno cell",desc:"Reads to 3,500 hp. Nothing below it will hold a car making this kind of power.",price:240000,needs:"dyno3"},
  {id:"dyno5",name:"Monster dyno cell",desc:"Water-brake cell that reads to 10,000 hp. Built for the four-figure-boost builds that overload the Outlaw cell.",price:400000,needs:"dyno4"}
];
const STAFF=[
  {id:"machinist",name:"Machinist",wage:350,desc:"Runs the mill and the hone. Unit cost −8%, machining R&D 25% faster."},
  {id:"tuner",name:"Calibration engineer",wage:420,desc:"Maps timing and fuel properly. +1 octane number of knock margin on every build."},
  {id:"dynotech",name:"Dyno technician",wage:300,desc:"Owns the test cell. Dyno pulls, endurance and over-rev runs are free."},
  {id:"sales",name:"Sales rep",wage:380,desc:"Works the phones. Contracts pay +6% and every category shows a third offer."}
];
const RND=[
  {id:"peen",name:"Shot-peened rods",cost:9000,weeks:4,mach:true,desc:"Compressive surface stress on the beam. Every rod's fatigue limit +12%.",effect:{rodFat:1.12}},
  {id:"nitride",name:"Nitriding line",cost:14000,weeks:6,mach:true,desc:"In-house gas nitriding. Every crank's fatigue limit +15%.",effect:{crkFat:1.15}},
  {id:"forge",name:"Forging supplier deal",cost:8000,weeks:3,desc:"A supply contract for forged 4032 pistons and 4340 rods without the full machine shop.",unlock:["piston:forged_4032","rod:forged_4340"]},
  {id:"plating",name:"Bore plating process",cost:12000,weeks:5,mach:true,desc:"Ni-SiC plating in house. Unlocks the Nikasil aluminium block.",unlock:["blockMat:alu_nikasil"]},
  {id:"vvt",name:"Cam phaser licence",cost:10000,weeks:4,desc:"Licensed phaser hardware. Unlocks DOHC 4v + VVT ahead of the flow bench.",unlock:["head:dohc4v_vvt"]},
  {id:"calib",name:"Calibration suite",cost:7000,weeks:3,desc:"Knock sensing and a proper base map. +0.5 octane number of margin, permanently.",effect:{octane:0.5}}
];
const PRESTIGE=[
  {id:"sign",name:"Illuminated shop sign",price:10000,rep:1,desc:"Your name over the door, lit. +1 rep a week."},
  {id:"trophy",name:"Trophy wall",price:30000,rep:2,desc:"A wall of certified builds and client plaques. +2 rep a week."},
  {id:"display",name:"Show engine plinth",price:60000,rep:4,desc:"A polished display engine in the front window. +4 rep a week and contracts pay +3%."}
];
const REP_TIERS=[[0,"Backyard"],[40,"Local shop"],[120,"Known builder"],[300,"Regional supplier"],[700,"OEM partner"],[1500,"Legend"]];
const GOALS=[
  {id:"first",name:"First sale",desc:"Deliver any contract.",cash:1000,check:c=>c.sold>0},
  {id:"hp200",name:"Two hundred",desc:"Certify a 200 hp engine.",cash:3000,check:c=>c.bestHp>=200},
  {id:"rel95",name:"Bulletproof",desc:"Certify an engine with reliability 95 or better.",cash:5000,check:c=>c.bestRel>=95},
  {id:"sold50",name:"Fifty out the door",desc:"Sell 50 engines.",cash:8000,check:c=>c.sold>=50},
  {id:"endur",name:"Hundred-hour man",desc:"Finish a 100 h endurance run in career with nothing broken.",cash:4000,check:c=>!!c.enduranceOk},
  {id:"boost",name:"Under pressure",desc:"Certify a boosted engine.",cash:6000,check:c=>!!c.boostedCert},
  {id:"repeat",name:"They came back",desc:"Deliver a repeat order from a happy client.",cash:5000,check:c=>c.repeats>0},
  {id:"clean",name:"Zero defects",desc:"Ten straight weeks with engines in the field and no warranty claim.",cash:10000,check:c=>c.cleanWeeks>=10},
  {id:"hp500",name:"Five hundred",desc:"Certify a 500 hp engine.",cash:15000,check:c=>c.bestHp>=500},
  {id:"sold200",name:"Production line",desc:"Sell 200 engines.",cash:30000,check:c=>c.sold>=200},
  {id:"hp1000",name:"Four figures",desc:"Certify a 1,000 hp engine.",cash:40000,check:c=>c.bestHp>=1000},
  {id:"dd5",name:"Dyno day",desc:"Fix five customers' engines on Dyno day.",cash:3000,check:c=>!!c.dd&&c.dd.passed>=5},
  {id:"dd25",name:"Shop doctor",desc:"Fix twenty-five customers' engines on Dyno day.",cash:12000,check:c=>!!c.dd&&c.dd.passed>=25}
];
const LOAN_STEP=10000,LOAN_MAX=50000,LOAN_RATE=0.02,LOAN_PAY=0.04,LOAN_MIN_PAY=250,FORECLOSE_AT=-25000;
/* the bank: every week-close takes the interest and a slice of the balance (LOAN_PAY, at least LOAN_MIN_PAY) out of cash.
   Nothing is added to the balance; a shop that cannot pay goes overdrawn, and below FORECLOSE_AT the bank takes it. */
function loanPay(){const l=C().loan||0;return l>0?Math.min(l,Math.max(LOAN_MIN_PAY,Math.round(l*LOAN_PAY/10)*10)):0;}
function loanInt(){return Math.round((C().loan||0)*LOAN_RATE);}
function loanWeek(){const c=C();if(!(c.loan>0))return "";const i=loanInt(),p=loanPay();c.cash-=i+p;c.loan-=p;c.loanPaid=(c.loanPaid||0)+i+p;
  if(c.loan<=0){c.loan=0;achCheck({type:"loan"});}return ` · loan interest ${fmt$(i)} + repayment ${fmt$(p)}${c.loan>0?"":" — loan cleared"}`;}
const MAX_ACTIVE=2,DEPOSIT=0.10,EXPIRE_REP=8;
const CATS=[
  {id:"prod",name:"Production run",sub:"volume · economy · warranty",segs:["hatch","sedan","taxi","flagship"],rep:0},
  {id:"truck",name:"Truck & industrial",sub:"torque low down · long life",segs:["van","pump","truck","genset","tractor"],rep:0},
  {id:"perf",name:"Performance",sub:"road-going power",segs:["hot","sport","gt","super","hyper"],rep:40},
  {id:"diesel",name:"Diesel & heavy",sub:"torque · long life · smoke limits",segs:["hdpickup","mdtruck","workboat","dtractor","minegen","class8","puller"],rep:40},
  {id:"race",name:"Motorsport",sub:"race fuel · class rules",segs:["club","rally","drift","specgt","endur","attack","hillclimb","lsr"],rep:120},
  {id:"altfuel",name:"Fleet & alt-fuel",sub:"propane · CNG · depot-fuelled fleets",segs:["forklift","cngvan","lpgbus","wellsite"],rep:20},
  {id:"outlaw",name:"Outlaw & drag",sub:"strip cars with a target ET",segs:["stripcar","drag","smallblock","grudge","radial","promod"],rep:700,needs:"race"}
];
const CLIENTS=["Kestrel Automotive","Bison Truck Co.","Aurora Compact","Northwind Racing","Meridian Motors","Tamarack Vans","Saskatoon Speed Shop","Halcyon GT","Coulee Ag Equipment","Prairie Fire Motorsport","Redwater Fleet","Glacier Coachworks"];
const FUEL_RANK={r87:0,r91:1,r94:2,race100:3,e85:4,methanol:5,
  race104u:2.5,race110:3.2,ox112:3.4,ox116:3.6};   // race grades sit between pump premium and alcohol; flex ranks by its blend (fuelRank)
const SEGMENTS=[
  /* tier 0 — Backyard: everything here is reachable with the five starter engines and base-shop parts */
  {id:"hatch",name:"City hatchback",tier:0,units:[3,8],price:2100,req:{hp:[50,75],econ:[6.2,5.6],fuel:"r87",rel:85,kg:140,noise:74}},
  {id:"sedan",name:"Family sedan",tier:0,units:[2,6],price:2500,req:{hp:[90,125],econ:[6.8,6.2],fuel:"r87",rel:82,smooth:45,kg:175,noise:74}},
  {id:"van",name:"Delivery van",tier:0,dsl:true,gas:true,units:[2,5],price:2800,req:{tq:[170,230],tqrpm:4000,fuel:"r87",rel:88,econ:[7.6,7.0],noise:77}},
  {id:"pump",name:"Irrigation pump set",tier:0,dsl:true,gas:true,units:[2,4],price:2600,req:{tq:[120,200],tqrpm:3600,rel:90,life:3000,fuel:"r87"}},
  /* tier 1 — Local shop */
  {id:"truck",name:"Half-ton pickup",tier:1,dsl:true,gas:true,units:[2,5],price:3800,req:{tq:[300,420],tqrpm:4400,fuel:"r87",rel:86,noise:78}},
  {id:"hot",name:"Hot hatch",tier:1,units:[2,4],price:5200,req:{hp:[150,220],kg:165,econ:[7.4,6.6],fuel:"r91",rel:80,noise:76,road:{ch:"hatch"},zero100:[7.4,8.8]}},
  {id:"taxi",name:"Taxi fleet",tier:1,dsl:true,gas:true,units:[3,7],price:3600,req:{hp:[100,140],life:5000,rel:92,econ:[6.5,6.0],fuel:"r87",noise:74}},
  {id:"sport",name:"Sports coupé",tier:1,units:[1,3],price:6200,req:{hp:[220,320],smooth:70,fuel:"r91",rel:78,noise:78,road:{ch:"coupe",trk:"club"},lap:[75.5,78.5]}},
  /* tier 2 — Known builder */
  {id:"club",name:"Club racer · 2.0 L class",tier:2,units:[1,2],price:11000,req:{hp:[240,330],disp:2.0,rel:60,fuel:"race100"}},
  {id:"gt",name:"Grand tourer",tier:2,units:[1,3],price:14000,req:{hp:[400,550],smooth:85,fuel:"r94",rel:80,econ:[11.5,9.5],noise:79}},
  {id:"rally",name:"Rally car · 1.6 T",tier:2,units:[1,2],price:13000,req:{hp:[280,340],tq:[320,400],disp:1.6,rel:70,fuel:"race100"}},
  {id:"drift",name:"Drift car",tier:2,units:[1,2],price:12000,req:{tq:[500,700],smooth:55,rel:65,fuel:"e85"}},
  {id:"genset",name:"Standby generator set",tier:2,dsl:true,gas:true,units:[1,3],price:6800,req:{tq:[380,560],tqrpm:3200,life:5000,rel:92,fuel:"r87"}},
  {id:"tractor",name:"Row-crop tractor",tier:3,dsl:true,gas:true,units:[1,3],price:16500,req:{tq:[700,1000],tqrpm:2600,life:4000,rel:90,fuel:"r87"}},
  /* tier 3 — Regional supplier */
  {id:"super",name:"Supercar",tier:3,units:[1,2],price:22000,req:{hp:[600,850],cyl:8,smooth:85,fuel:"r94",rel:75,noise:80,road:{ch:"super",trk:"gp"},lap:[113.0,117.0]}},
  {id:"endur",name:"Endurance prototype",tier:3,units:[1,2],price:28000,req:{hp:[500,700],rel:92,fuel:"race100",kg:210,life:300}},
  {id:"attack",name:"Time attack",tier:3,units:[1,2],price:30000,req:{hp:[700,900],kg:200,rel:60,fuel:"e85"}},
  {id:"drag",name:"Pro-mod drag",tier:3,units:[1,2],price:34000,req:{hp:[1200,1800],rel:35,fuel:"methanol",life:5}},
  /* tier 4 — OEM partner */
  {id:"hyper",name:"Hypercar",tier:4,units:[1,2],price:48000,req:{hp:[1000,1400],cyl:8,smooth:88,fuel:"r94",rel:70,noise:82,road:{ch:"super",trk:"gp"},lap:[109.5,112.5],zero100:[3.15,3.45]}},
  {id:"flagship",name:"OEM V12 flagship",tier:4,units:[2,4],price:24000,req:{hp:[600,750],cyl:12,smooth:95,rel:88,econ:[11.5,10],fuel:"r94",noise:80}},
  /* tier 5 — Outlaw racing */
  {id:"stripcar",name:"Street/strip coupe",tier:4,units:[1,2],price:20000,req:{hp:[450,650],rel:60,car:{body:"street",mass:1500,tyre:"radial"},et:[11.0,12.2]}},
  {id:"grudge",name:"Grudge car · no time",tier:5,units:[1,2],price:44000,req:{hp:[1500,1900],cyl:8,passes:25,rel:30,car:{body:"street",mass:1500,tyre:"radial"},et:[9.4,10.4]}},
  {id:"radial",name:"Radial outlaw",tier:5,units:[1,2],price:58000,req:{hp:[2000,2400],cyl:8,kg:340,passes:30,rel:35,car:{body:"outlaw",mass:1450,tyre:"radial"},et:[7.9,8.4]}},
  {id:"promod",name:"Pro mod door car",tier:5,units:[1,1],price:60000,req:{hp:[2500,2900],cyl:8,passes:20,fuel:"methanol",car:{body:"promod",mass:1150,tyre:"slick"},et:[6.8,7.3]}},
  {id:"smallblock",name:"Small-tyre outlaw",tier:5,units:[1,2],price:52000,req:{hp:[1600,2100],disp:6.0,passes:25,rel:30}},
  /* Diesel & heavy (rep 40+): diesel only. On-road buyers cap the smoke (opacity at full load, lower is better); off-road and marine don't.
     Road segments also cap drive-by noise (dBA, judged with any cutout shut) */
  {id:"hdpickup",name:"Heavy-duty pickup",tier:1,units:[2,5],price:6800,req:{tq:[650,850],tqrpm:2400,rel:86,smoke:25,fuel:"diesel",noise:80}},
  {id:"mdtruck",name:"Medium-duty delivery truck",tier:1,units:[2,4],price:6200,req:{tq:[450,650],tqrpm:2400,rel:88,life:3000,econ:[9.5,8.5],smoke:30,fuel:"diesel",noise:80}},
  {id:"workboat",name:"Marine workboat",tier:2,units:[1,3],price:9400,req:{tq:[600,900],tqrpm:2600,life:4000,rel:92,fuel:"diesel"}},
  {id:"dtractor",name:"Four-wheel-drive farm tractor",tier:2,units:[1,3],price:11800,req:{tq:[800,1200],tqrpm:1900,life:3000,rel:88,fuel:"diesel"}},
  {id:"minegen",name:"Mine standby genset · prime power",tier:3,units:[1,3],price:21000,req:{tq:[1200,1800],tqrpm:1900,life:4500,rel:92,fuel:"diesel"}},
  {id:"class8",name:"Class-8 highway truck",tier:3,units:[1,3],price:15000,req:{tq:[1900,2300],tqrpm:1600,life:1500,rel:78,econ:[14.5,13],smoke:20,fuel:"diesel",noise:80}},
  /* Fleet & alt-fuel (rep 20+): buyers who fuel at their own depot and want propane or CNG only (fuel "lpg"/"cng" is
     an exact family). gas:true on the truck & industrial segments means a gas engine is welcome there too. */
  {id:"forklift",name:"Warehouse forklift · propane",tier:0,units:[3,7],price:2300,req:{tq:[110,160],tqrpm:3200,life:3000,rel:88,fuel:"lpg"}},
  {id:"cngvan",name:"City fleet van · CNG",tier:1,units:[2,6],price:4200,req:{tq:[220,300],tqrpm:4000,rel:88,econ:[9.0,8.0],fuel:"cng",noise:77}},
  {id:"lpgbus",name:"Propane school bus",tier:2,units:[1,3],price:9800,req:{tq:[450,600],tqrpm:3600,life:3000,rel:90,fuel:"lpg",noise:78}},
  {id:"wellsite",name:"Wellsite compressor drive · CNG",tier:2,units:[1,3],price:12500,req:{tq:[350,500],tqrpm:3000,life:5000,rel:92,fuel:"cng"}},
  /* race gas: a control-fuel series where everyone runs the same drum (spec:true = exactly that fuel), and a hill climb
     that allows anything up to oxygenated 116 */
  {id:"specgt",name:"Spec GT series · control fuel",tier:2,spec:true,units:[1,3],price:15500,req:{hp:[300,380],rel:75,life:400,fuel:"race104u"}},
  {id:"hillclimb",name:"Hill-climb special",tier:3,units:[1,2],price:26000,req:{hp:[450,650],kg:190,rel:65,fuel:"ox116"}},
  {id:"puller",name:"Pulling truck · sled-ready",tier:3,units:[1,2],price:24000,req:{hp:[700,1200],passes:150,rel:55,fuel:"diesel"}},
  /* land speed: their car on the salt, your engine — they want a mile speed in it (estimated with a steady driver, long course) */
  {id:"lsr",name:"Land-speed team · lakester",tier:3,units:[1,2],price:20000,req:{hp:[450,800],rel:55,lsr:{body:"lakester"},mph:[215,250]}}
];
/* site briefs: some clients say where the engine will live and re-run your certified engine in that air before they pay.
   [name, ambient °C, altitude m, premium]. Cold air packs the cylinder (more load, boost overshoots), heat eats knock margin,
   thin air costs an NA engine over a quarter of its torque at 3,000 m. All inside the Pro dyno cell's range so it can be previewed. */
/* rotary buyers: they want a Wankel and nothing else. Classes count a rotary at 1.5x its quoted displacement (the FIA factor). */
SEGMENTS.push(
  {id:"rotsport",name:"Rotary sports coupé",tier:1,units:[1,3],price:6500,req:{hp:[180,260],kg:160,smooth:80,fuel:"r94",rel:76,rot:1}},
  {id:"rotclub",name:"Club racer · rotary class",tier:2,units:[1,2],price:10500,req:{hp:[260,320],rot:1,rel:62,passes:200,fuel:"race100"}});
CATS.find(c=>c.id==="perf").segs.push("rotsport");CATS.find(c=>c.id==="race").segs.push("rotclub");
/* two-stroke buyers: they want an engine that fires every turn (ts:1) and judge it on the usual figures */
SEGMENTS.push(
  {id:"ts_vintage",name:"Vintage rally restorer · two-stroke",tier:0,units:[1,3],price:2000,req:{hp:[34,46],disp:0.9,ts:1,rel:80,fuel:"r87"}},
  {id:"ts_mx",name:"Motocross team · 250 two-stroke",tier:2,units:[2,4],price:4600,req:{hp:[44,54],disp:0.25,kg:32,ts:1,rel:60,fuel:"r94"}},
  {id:"ts_sled",name:"Snowmobile maker · 800 class",tier:2,units:[2,5],price:7200,req:{hp:[140,175],disp:0.85,kg:70,ts:1,rel:80,econ:[9.5,8.0],fuel:"r91"}},
  {id:"ts_outboard",name:"Outboard maker · V6 two-stroke",tier:2,units:[2,4],price:8600,req:{hp:[180,230],life:2500,rel:84,ts:1,fuel:"r91"}},
  {id:"ts_detroit",name:"Detroit rebuild · fleet & marine",tier:1,units:[1,3],price:7400,req:{tq:[820,960],tqrpm:1600,life:3000,rel:88,ts:1,fuel:"diesel"}});
CATS.find(c=>c.id==="prod").segs.push("ts_vintage");CATS.find(c=>c.id==="race").segs.push("ts_mx");
CATS.find(c=>c.id==="perf").segs.push("ts_sled","ts_outboard");CATS.find(c=>c.id==="diesel").segs.push("ts_detroit");
const ROT_DISP=1.5;
const SITE_P=0.3;
const SITES={
  sedan:[["Winnipeg winter commuter",-25,250,.14],["Phoenix commuter car",44,350,.12],["Denver family car",22,1600,.14],["Mexico City family car",18,2250,.18]],
  taxi:[["Yellowknife winter taxi",-25,200,.16],["Las Vegas airport taxi",43,650,.12],["Bogotá city taxi",14,2600,.18],["Quito city taxi",13,2850,.20]],
  van:[["Iqaluit courier van",-25,50,.16],["Mojave parcel van",42,300,.12],["Calgary winter courier",-20,1050,.14],["Mexico City courier van",18,2250,.18]],
  pump:[["Imperial Valley canal pump",45,0,.12],["Andean terrace pump",12,2800,.18],["Altiplano well pump",8,3500,.20]],
  truck:[["Ice-road pickup",-25,300,.16],["Death Valley pickup",45,0,.14],["Rockies mine pickup",5,2400,.18]],
  genset:[["Andean mine genset",8,3200,.20],["Arctic camp genset",-25,100,.16],["Desert telecom genset",45,300,.14]],
  tractor:[["Harvest tractor",42,300,.12],["Ethiopian highland tractor",24,2400,.18],["Andean potato tractor",14,3400,.20]],
  rally:[["Swedish snow stage",-20,200,.16],["Greek gravel stage",38,600,.14],["Kenyan safari stage",32,1900,.16],["Mexican mountain stage",22,2700,.18]],
  endur:[["Desert 24-hour",40,300,.16],["Winter 24-hour",-10,400,.14],["Mexico City 6-hour",24,2250,.18]],
  hdpickup:[["Yukon ice-road pickup",-25,600,.16],["Atacama mine pickup",30,3000,.20],["Texas oilfield pickup",42,800,.12]],
  mdtruck:[["Winnipeg winter route",-25,250,.14],["Phoenix summer route",44,350,.12],["La Paz city route",12,3500,.20]],
  workboat:[["Gulf of Mexico crew boat",35,0,.12],["Bering Sea crabber",-15,0,.16]],
  dtractor:[["Saskatchewan spring seeding",-10,550,.12],["Altiplano quinoa farm",10,3500,.20]],
  minegen:[["Andean copper mine",8,3500,.20],["Arctic diamond mine",-25,450,.18],["Pilbara iron mine",45,400,.14]],
  class8:[["Alaska Highway hauler",-25,700,.16],["Death Valley hauler",45,0,.14],["Rockies grade hauler",5,2400,.18]]
};

/* ===================== state ===================== */
let S=null,quick=null,combosNow=[];
const VERSION="1.76.9.0";
(()=>{const set=()=>{const v=$("verLbl");if(v)v.textContent="v"+VERSION;};set();document.addEventListener("DOMContentLoaded",set);})();
function freshCareer(){return{cash:20000,rep:0,week:1,sold:0,profit:0,owned:{},contracts:[],offers:null,inbox:[],shipped:0,cat:"prod",seed:Math.floor(Math.random()*1e9),cert:null,fleet:[],loan:0,log:[],goals:{},bestHp:0,bestRel:0,repeats:0,cleanWeeks:0,warranty:0,enduranceOk:false,boostedCert:false,staff:{},rnd:{},rndActive:null,unlocks:{},prestige:{}};}
function applySoundQuality(){const q=S.soundQ||(S.layoutMode==="desktop"?"full":null)||(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)?"lite":"full");ENGINE_SOUND.setQuality(q);document.querySelectorAll("#sqSeg button").forEach(b=>b.classList.toggle("on",b.dataset.sq===q));}
/* pressure units: everything is stored and simulated in bar. PSI is a display layer — text nodes that read "N bar"
   (also "A of B bar", "A–B bar", "A / B bar") are rewritten in place and remembered, so switching back restores them. */
const BAR_PSI=14.5038;
const pU=()=>S&&S.psi?"psi":"bar";
const bv=b=>{if(!(S&&S.psi))return b.toFixed(1);const v=b*BAR_PSI;return v.toFixed(v<100?1:0);};
const P_NUM="\\d{1,3}(?:,\\d{3})+(?!\\d)|\\d+(?:\\.\\d+)?";   // "2,000" (thousands separator) or 1.5
const P_RE=new RegExp("((?:(?:"+P_NUM+")\\s?(?:–|-|\\/|of|to)\\s?)*)("+P_NUM+")(?:\\s?|-)bar\\b(?!s)","g");
const toPsiTxt=t=>t.replace(P_RE,m=>{const h=/-bar$/.test(m);return m.replace(/\s?-?bar$/,"").replace(new RegExp(P_NUM,"g"),n=>{const c=n.includes(","),v=+n.replace(/,/g,"")*BAR_PSI;return v<100?v.toFixed(1):c?Math.round(v).toLocaleString("en-CA"):v.toFixed(0);})+(h?"-psi":" psi");});
function psiNode(n){const t=n.nodeValue;if(!t||t.indexOf("bar")<0){return;}if(n.__psi!==undefined&&t===n.__psi)return;const c=toPsiTxt(t);if(c!==t){n.__bar=t;n.nodeValue=c;n.__psi=c;}}
function psiWalk(root,on){if(!root)return;const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>{const p=n.parentNode;return p&&(p.nodeName==="SCRIPT"||p.nodeName==="STYLE"||p.nodeName==="TEXTAREA")?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}});const ns=[];let n;while((n=w.nextNode()))ns.push(n);
  for(const x of ns){if(on)psiNode(x);else if(x.__bar!==undefined){if(x.nodeValue===x.__psi)x.nodeValue=x.__bar;delete x.__bar;delete x.__psi;}}}
let psiBusy=false;
new MutationObserver(ms=>{if(!S||!S.psi||psiBusy)return;psiBusy=true;try{for(const m of ms){if(m.type==="characterData")psiNode(m.target);else for(const a of m.addedNodes){if(a.nodeType===3)psiNode(a);else if(a.nodeType===1)psiWalk(a,true);}}}finally{psiBusy=false;}}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
function applyPU(){psiWalk(document.body,!!(S&&S.psi));applyTheme();}
function applyTheme(){const t=S.theme||"dark";const eff=t==="auto"?(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):t;document.documentElement.setAttribute("data-theme",eff);
  document.querySelectorAll("#themeSeg button").forEach(b=>b.classList.toggle("on",b.dataset.theme===t));document.querySelectorAll("#hapSeg button").forEach(b=>b.classList.toggle("on",(b.dataset.hap==="1")===(S.haptics!==false)));document.querySelectorAll("#puSeg button").forEach(b=>b.classList.toggle("on",(b.dataset.pu==="psi")===!!S.psi));
  if(curTab==="test")drawChart(lastForChart(),null);else if(curTab==="events")chartRedraw();}
function buzz(ms){if(S.haptics===false||!navigator.vibrate)return;try{navigator.vibrate(ms);}catch(e){}}
function freshState(){return{mode:null,career:freshCareer(),cfg:Object.assign({},SIM.DEFAULT_CFG),env:Object.assign({},SIM.DEFAULT_ENV),blueprints:[],last:null,base:null,vol:60,sound:true,seen:false,name:null,heat:false,theme:"dark",haptics:true,viewMini:false,psi:false};}
function save(){try{if(typeof lgSync==="function")lgSync();const o=Object.assign({},S,{last:S.last?slimRes(S.last):null,base:S.base?slimRes(S.base):null});if(S.bay)ddSaveAs(o);localStorage.setItem("pew2-save",JSON.stringify(o));}catch(e){}}
function slimRes(r){return{hash:r.hash,cfg:r.cfg,env:r.env,label:r.label,res:r.res};}
function snapshot(){const o=Object.assign({},S,{last:S.last?slimRes(S.last):null,base:S.base?slimRes(S.base):null});if(S.bay)ddSaveAs(o);return o;}
/* a customer engine on the dyno is never saved as the player's build: the build, its last pull and pin go to storage, the customer rides in o.bay */
function ddSaveAs(o){const B=S.bay,w=B.own;Object.assign(o,{cfg:w.cfg,last:w.last?slimRes(w.last):null,base:w.base?slimRes(w.base):null,env:Object.assign({},S.env,{testType:w.testType||"pull"}),profileId:w.profileId,name:w.name,bay:{job:B.job,practice:!!B.practice,cur:S.cfg}});}
function ddLoad(o){const b=o.bay;S.bay=null;if(!b||!b.job||!b.cur||typeof b.cur!=="object"||!b.job.cfg)return;
  S.bay={job:b.job,practice:!!b.practice,own:{cfg:S.cfg,last:S.last,base:S.base,testType:S.env.testType,profileId:S.profileId,name:S.name}};S.cfg=Object.assign({},SIM.DEFAULT_CFG,b.cur);S.last=null;S.base=null;S.env.testType="pull";S.name=ddLabel(b.job);}
function hydrate(o){if(!o||!o.cfg)return false;S=freshState();suC=null;Object.assign(S,o);S.career=Object.assign(freshCareer(),o.career||{});
  try{fuelMigrate();}catch(e){}
  if(Array.isArray(S.career.log)&&S.career.log.some(e=>typeof e==="string")){
    S.career.log=S.career.log.map((e,i)=>{if(typeof e!=="string")return {e,i};const m=/^W(\d+):\s*([\s\S]*)$/.exec(e);const t=m?m[2]:e;return {e:{w:m?+m[1]:S.career.week,t:"Strip: "+t,k:/BLACK-FLAGGED|lost to|red light|cooked|cracked/.test(t)?"bad":/purse \$[1-9]/.test(t)?"good":""},i,str:true};})
      .filter(x=>x.e&&typeof x.e==="object").sort((a,b)=>((+b.e.w||0)-(+a.e.w||0))||(a.str&&b.str?b.i-a.i:a.i-b.i)).map(x=>x.e).slice(0,16);}if(S.career.contracts.length>MAX_ACTIVE){S.career.contracts.forEach(k=>{if(!k.deposit)k.deposit=0;});S.career.contracts=S.career.contracts.slice(0,MAX_ACTIVE);}for(const f of ["wear","dragBest"]){const m=S.career[f];if(m)for(const k of Object.keys(m))if(k.length>24){m[hKey(k)]=m[k];delete m[k];}}S.cfg=Object.assign({},SIM.DEFAULT_CFG,o.cfg);S.env=Object.assign({},SIM.DEFAULT_ENV,o.env||{});if(S.env.dragDrive!=="auto")S.env.dragDrive="you";S.blueprints=Array.isArray(o.blueprints)?o.blueprints:[];try{ddLoad(o);}catch(e){S.bay=null;}return true;}
/* fuel system: a build saved before injectors and pumps existed gets the smallest set that feeds it (SIM.fitFuel), so a
   600 hp save doesn't suddenly lean out. Certs, strip bests, wear and the fleet are keyed by the cfg hash, so they follow
   it. In career a fitted part the shop hasn't unlocked comes with the build (an R&D-style unlock), so nothing certified
   turns up locked. Runs on the raw save inside hydrate(), before the cfg is merged with the defaults. */
function fuelFit(c){if(!c||typeof c!=="object"||(c.injectors&&c.fuelPump))return null;
  const full=Object.assign({},SIM.DEFAULT_CFG,c);if(!c.injectors)delete full.injectors;if(!c.fuelPump)delete full.fuelPump;const oh=cfgHash(full);
  const fit=SIM.fitFuel(full);if(!c.injectors)c.injectors=fit.injectors;if(!c.fuelPump)c.fuelPump=fit.fuelPump;
  return [oh,cfgHash(Object.assign({},SIM.DEFAULT_CFG,c)),c];}
function fuelMigrate(){const m={},fitted=[];
  for(const c of [S.cfg,S.last&&S.last.cfg,S.base&&S.base.cfg].concat(Array.isArray(S.blueprints)?S.blueprints.map(b=>b&&b.cfg):[])){try{const r=fuelFit(c);if(r){m[r[0]]=r[1];fitted.push(r[2]);}}catch(e){}}
  if(!fitted.length)return;
  if(S.last&&m[S.last.hash])S.last.hash=m[S.last.hash];
  const K=S.career;if(K.cert&&m[K.cert.hash])K.cert.hash=m[K.cert.hash];
  if(Array.isArray(K.fleet))K.fleet.forEach(f=>{if(f&&m[f.hash])f.hash=m[f.hash];});
  for(const fld of ["wear","dragBest"]){const w=K[fld];if(!w||typeof w!=="object")continue;
    for(const o in m)for(const [a,b] of [[o,m[o]],[hKey(o),hKey(m[o])]])if(a in w&&!(b in w)){w[b]=w[a];delete w[a];}}
  if(S.mode==="career")for(const c of fitted)for(const k of ["injectors","fuelPump"]){const o=OPT[k][c[k]];if(locked(o))(K.unlocks=K.unlocks||{})[o._id]=true;}}
function load(){S=freshState();try{const j=localStorage.getItem("pew2-save");if(j)hydrate(JSON.parse(j));}catch(e){}}
/* manual save slots, plus the older one-game "PEW2:" save codes (Restore still reads them; Back up codes are app/savecode.js) */
const SLOTS=3,slotKey=i=>"pew2-slot"+i;
function readSlot(i){try{const j=localStorage.getItem(slotKey(i));return j?JSON.parse(j):null;}catch(e){return null;}}
function writeSlot(i){try{const o=snapshot();o.savedAt=Date.now();localStorage.setItem(slotKey(i),JSON.stringify(o));return true;}catch(e){return false;}}
function clearSlot(i){try{localStorage.removeItem(slotKey(i));}catch(e){}}
function slotSummary(o){if(!o)return"Empty";const d=o.savedAt?new Date(o.savedAt):null;const when=d?d.toLocaleDateString("en-CA",{month:"short",day:"numeric"})+" "+d.toLocaleTimeString("en-CA",{hour:"2-digit",minute:"2-digit"}):"";
  const head=o.mode==="career"?`Career · wk ${o.career?.week??1} · ${fmt$(o.career?.cash??0)}`:"Test cell";return`${head} · ${(o.blueprints||[]).length} bp<br>${cfgLbl(Object.assign({},SIM.DEFAULT_CFG,o.cfg))}${when?"<br>"+when:""}`;}
function decodeSave(t){t=(t||"").trim();if(t.startsWith("PEW2:"))t=t.slice(5);const o=JSON.parse(decodeURIComponent(escape(atob(t.replace(/\s+/g,"")))));if(!o||!o.cfg)throw new Error("bad");return o;}
function renderSaves(){const box=$("slots");if(!box)return;let h="";for(let i=1;i<=SLOTS;i++){const o=readSlot(i);h+=`<div class="slot ${o?"full":""}"><div><h3>Slot ${i}${o?"":"<small>empty</small>"}</h3><p>${slotSummary(o)}</p></div><div class="acts"><button class="pri" data-save="${i}">Save</button><button data-load="${i}" ${o?"":"disabled"}>Load</button><button class="del" data-clear="${i}" ${o?"":"disabled"}>Clear</button></div></div>`;}box.innerHTML=h;}
function applyLoaded(o,msg){if(testing){toast("Let the run finish first");return;}if(!hydrate(o)){toast("That save didn't read right.");return;}save();curTab="shop";boot();toast(msg);}
const C=()=>S.career;
function rng(){C().seed=(C().seed*1664525+1013904223)>>>0;return C().seed/4294967296;}
const career=()=>S.mode==="career";
function dev(){return career()&&!!C().dev;}
function has(id){return !career()||dev()||!!C().owned[id];}
function locked(o){return career()&&!dev()&&o&&o.req&&!C().owned[o.req]&&!(C().unlocks&&o._id&&C().unlocks[o._id]);}
function staffed(id){return career()&&(dev()||!!(C().staff&&C().staff[id]&&crewOn(id)));}   // a person on a course is out of the shop (app/crew.js)
function shopBonus(){if(!career())return{};const b={octane:0,rodFat:1,crkFat:1,costFac:1};if(staffed("tuner"))b.octane+=1+0.15*crewL("tuner");if(staffed("machinist"))b.costFac*=0.92-0.01*crewL("machinist");b.costFac*=crewCostK();if(typeof lgCostK==="function")b.costFac*=lgCostK();
  for(const r of RND){if(C().rnd[r.id]&&r.effect){if(r.effect.octane)b.octane+=r.effect.octane;if(r.effect.rodFat)b.rodFat*=r.effect.rodFat;if(r.effect.crkFat)b.crkFat*=r.effect.crkFat;}}return b;}
function syncShop(){S.env.shop=shopBonus();deltaCache.clear();fixCache.clear();}
function wages(){return career()?STAFF.reduce((a,st)=>a+(C().staff[st.id]?crewWage(st):0),0):0;}
function dynoCap(){if(!career())return{hp:10000,rpm:14000,n:"Test cell dyno"};return has("dyno5")?{hp:10000,rpm:12500,n:"Monster cell"}:has("dyno4")?{hp:3500,rpm:12500,n:"Outlaw cell"}:has("dyno3")?{hp:2000,rpm:12500,n:"Pro cell"}:has("dyno2")?{hp:1000,rpm:10000,n:"Engine dyno"}:{hp:400,rpm:8000,n:"Chassis dyno"};}
function repTier(){let t=REP_TIERS[0];for(const r of REP_TIERS)if(C().rep>=r[0])t=r;return t;}
function repTierIdx(){let i=0;REP_TIERS.forEach((r,k)=>{if(C().rep>=r[0])i=k;});return i;}
/* test-cell climate. Sandbox: whatever S.env says. Career: the standard cell (20 °C, 500 m), unless the Pro dyno
   cell's climate control is installed, in which case the career's own cell settings (C().cell). Only a pull in
   the standard cell certifies for contracts, and the strip runs in standard weather. */
const CELL_KEYS=["ambientC","altitudeM","coolantC","oilC"];
function stdCell(){const d=SIM.DEFAULT_ENV,o={};CELL_KEYS.forEach(k=>o[k]=d[k]);return o;}
function careerCell(){const c=C();if(!c.cell||typeof c.cell!=="object")c.cell=stdCell();return c.cell;}
function climateCtl(){return career()&&has("dyno3");}
function trackEvt(t){return t==="drag"||t==="pull_sled"||t==="salt"||t==="road"||t==="race24"||t==="bog"||t==="boat"||t==="hill"||t==="oval";}   // out on the strip or the dirt: the cell's climate control stays home
function simEnv(extra){return Object.assign({},S.env,career()?(climateCtl()&&!trackEvt(S.env.testType)?careerCell():stdCell()):{},extra||{});}
function stdEnv(extra){return Object.assign({},S.env,career()?stdCell():{},extra||{});}
function isStdCell(e){const d=SIM.DEFAULT_ENV;return CELL_KEYS.every(k=>+e[k]===+d[k]);}
function envStore(k){return career()&&CELL_KEYS.includes(k)?careerCell():S.env;}
function envHash(){const e=simEnv();return [e.ambientC,e.altitudeM,e.coolantC,e.oilC,e.shop?JSON.stringify(e.shop):""].join(",");}
const HASH_SKIP={cover:1,twoStepRpm:1,launchRetard:1};   // colour and the launch tune don't make it a different engine
const ROT_KEYS={ecc:1,rotPort:1,apexSeal:1,rotHousing:1,sidePlate:1,eshaft:1,oilMeter:1};   // Wankel parts: no part of a piston engine (and no change to its hash)
const isRot=c=>!!(c&&SIM.isRotary&&SIM.isRotary(c));
const TS_KEYS={cycle:1,scav:1,induct:1,tsFuel:1,xpipe:1,pipeRpm:1,ePort:1,tPort:1,pv:1,lube:1,premix:1,ccr:1};   // two-stroke parts: none of them part of a four-stroke's hash
const isTs=c=>!!(c&&SIM.isTwoStroke&&SIM.isTwoStroke(c));
const HASH_DEF={pipe:"stock",muffler:"stock",cat:"none",cutout:"none",turbine:"fixed",als:"off"};   // the exhaust system at its defaults is the engine every older hash was made from
function cfgHash(c){const dsl=isCI(c.fuel),rot=isRot(c),ts=isTs(c);return JSON.stringify(Object.keys(c).filter(k=>!HASH_SKIP[k]&&!(!rot&&ROT_KEYS[k])&&!(!ts&&TS_KEYS[k])&&!(HASH_DEF[k]&&(!c[k]||c[k]===HASH_DEF[k]))&&!(k==="map"&&!c[k])&&!((k==="launchCtl"||k==="transBrake")&&(!c[k]||c[k]==="none"))&&!(!dsl&&(k==="dInj"||k==="dNoz"))&&!(k==="ethanolPct"&&c.fuel!=="flex")&&!(k==="gasSys"&&!isGasF(c.fuel))).sort().map(k=>c[k]));}
// fuel families: compression-ignition fuels (diesel, B100) vs everything with a spark plug
function isCI(f){const o=OPT.fuel[f];return !!(o&&o.ci);}
/* displacement for display: cc below a litre ("125 cc"), litres from 1.0 up. sp: the gap before "L" */
function fmtDisp(L,sp){return L<1?Math.round(L*1000)+" cc":L.toFixed(1)+(sp==null?" ":sp)+"L";}
function cfgLbl(cfg){return SIM.cfgLabel(cfg).replace(/(\d+\.\d+) L\b/,(m,v)=>+v<1?fmtDisp(presetDisp({cfg})):m);}   // SIM.cfgLabel prints litres; small engines read in cc
function fuelShort(f){const o=OPT.fuel[f];return !o?String(f):o.ci?(f==="b100"?"B100":"Diesel"):o.short||o.name.split(" ")[0];}
function isGasF(f){const o=OPT.fuel[f];return !!(o&&o.gas);}
const INJ_SHORT={rotary_ve:"VE",inline_mech:"P-pump",heui:"HEUI",cr_gen1:"CR",cr_piezo:"CR",unit_dd:"unit inj"};
function fuelBill(){if(!career()||dev())return 0;const fu=SIM.fuelOf(S.cfg)||SIM.OPT.fuel.r91;const hp=quick&&isFinite(quick.peakHp)?quick.peakHp:300;
  // WOT burn: ~0.32 L/hp/h on gasoline, more on low-energy fuels (per-litre energy vs pump gas)
  const lph=hp*(fu.ci?0.23*(42.8e6/fu.lhv):0.32*(44e6/fu.lhv))*(fu.gas?0.745/fu.dens:1);const t=S.env.testType;   // gas: litres of liquid propane / kg of CNG   // diesel ~0.23 L/hp/h at full load
  // endurance is an accelerated cycle, not real hours: cell burn ≈ 0.6·√hours (50 h → 4 h, 1,000 h → 19 h)
  const hours=t==="endurance"?0.6*Math.sqrt(S.env.hours)*({highway:.2,mixed:.45,track:.9}[S.env.loadProfile]||.45):t==="drag"?0.012:t==="pull_sled"?0.01:t==="bog"?0.012:t==="boat"?0.008:t==="salt"?0.03:t==="road"?0.03:t==="hill"?0.04:t==="oval"?0.03:t==="race24"?0:t==="overrev"?0.008:0.02;   // the 24 Hours bills its fuel by the litre after the flag
  return Math.round(lph*hours*fu.costL);}
function testCost(){if(dev()||(PO&&S.env.testType==="pull_sled"))return 0;if(S.env.testType==="oval")return ovalCost();if(S.env.testType==="salt")return saltFee()+fuelBill();if(S.env.testType==="race24")return career()?E24_FEE:0;if(S.env.testType==="boat")return boatFee()+fuelBill();const tt=S.env.testType,cell=career()&&!(staffed("dynotech")&&(tt==="pull"||tt==="endurance"||tt==="overrev"))?({pull:75,endurance:450,overrev:150,drag:rnLive()?0:250,pull_sled:150,road:ROAD_FEE,bog:BOG_FEE,hill:HILL_FEE}[S.env.testType]||75):0;return cell+fuelBill();}
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("on");toastPlace();clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove("on"),2600);toast.until=Date.now()+2600;}
/* the toast and the achievement banner share the foot of the screen. Phone: the toast sits just above whatever is docked there
   (the tab bar, or the results sheet, measured: it can be taller than its peek line) and the banner stacks above the toast.
   Desktop: the toast sits at the top of the view and the banner drops below it. Neither ever hides the other. */
function toastPlace(){const t=$("toast"),a=$("achToast");if(!t||!a)return;
  if(!toastPlace.raf&&(t.classList.contains("on")||a.classList.contains("on")))toastPlace.raf=requestAnimationFrame(()=>{toastPlace.raf=0;toastPlace();});   // follow the dock while either is showing (the sheet can resize under them)
  if(document.documentElement.classList.contains("desk")){t.style.removeProperty("--tbot");a.style.removeProperty("--abot");
    const th=t.classList.contains("on")?Math.round(t.getBoundingClientRect().height):0;a.style.setProperty("--atop",Math.max(140,84+th+10)+"px");return;}
  const app=$("app"),tabs=$("tabs");if(!app||!tabs)return;const ab=app.getBoundingClientRect().bottom;
  let top=tabs.getBoundingClientRect().top;if(typeof railTop==="function"){const r=railTop();if(r<top)top=r;}
  const tb=Math.max(0,Math.round(ab-top))+14,th=t.classList.contains("on")?Math.round(t.getBoundingClientRect().height):38;
  t.style.setProperty("--tbot",tb+"px");a.style.setProperty("--abot",(tb+th+8)+"px");a.style.removeProperty("--atop");}
window.addEventListener("resize",()=>{try{toastPlace();}catch(e){}});
/* a toast that waits for the one on screen to finish (the goal toast must not hide the sale toast) */
function toastAfter(msg){setTimeout(()=>toast(msg),Math.max(0,(toast.until||0)-Date.now())+250);}

/* ===================== live compute ===================== */
/* stress heat-map: zones on the 3D engine tinted by the worst utilisation of the tests that live there */
const ZONE_OF={rod_tension:1,rod_buckling:1,rod_bolts:1,crank_fatigue:1,bearing_load:1,oil_film:1,
  detonation:2,preignition_egt:2,piston_speed:2,crown_temp:2,crown_pressure:2,hot_clearance:2,slap_blowby:2,ring_gap:2,bore_distortion:2,wall_thickness:2,
  head_lift:3,gasket_shear:3,valve_float:3,valve_piston:3,cooling:3,valve_temp:4,turbine_temp:5,compressor_map:5,oil_starvation:6,torsional:7};
ZONE_OF.fuel_delivery=2;ZONE_OF.cold_start=2;ZONE_OF.vgt_vanes=5;ZONE_OF.als_heat=5;
Object.assign(ZONE_OF,{apex_seal:2,housing_chatter:2,carbon_seals:2,coolant_seal:3,eshaft:1,oil_metering:6});   // rotary tests
Object.assign(ZONE_OF,{ts_seize:2,port_wear:2,crank_seals:1,pipe_crack:4,plug_foul:3,scav_air:5});   // two-stroke tests
const ZONE_NAME_TS={2:"Barrels, pistons & ports",3:"Heads & spark plugs",4:"Expansion chambers",5:"Scavenge air: blower & turbo",6:"Premix & oil pump"};
const ZONE_NAME_ROT={1:"Eccentric shaft & rotor bearings",2:"Rotors, apex seals & housings",3:"Hot lobe, plugs & coolant seals",7:"Front cover, OMP & pulley"};
const ZONE_NAME={1:"Crankcase & rotating assembly",2:"Cylinders & pistons",3:"Head, gasket & valvetrain",4:"Exhaust",5:"Turbocharger",6:"Sump & oiling",7:"Front drive & damper"};
function heatZones(){if(!quick)return null;const worst={};for(const t of quick.tests){const z=ZONE_OF[t.id];if(!z)continue;if(t.id==="turbine_temp"||t.id==="compressor_map"){if(S.cfg.asp==="na")continue;}
    if(!worst[z]||t.util>worst[z])worst[z]=t.util;}
  return Object.keys(worst).map(z=>{const u=worst[z];let c,a,pulse=false;if(u>1){c=[0.95,0.18,0.12];a=0.62;pulse=true;}else if(u>0.8){c=[1,0.66,0.15];a=0.28+0.3*(u-0.8)/0.2;}else{c=[0.25,0.85,0.5];a=0.10+0.18*Math.max(0,(u-0.4)/0.4);}
    return{zone:+z,r:c[0],g:c[1],b:c[2],amount:a,pulse};});}
function applyGfx(){const q=S.gfx||deskGfx()||(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)?"lite":"full");ENGINE_VIS.setQuality(q);document.querySelectorAll("#gfxSeg button").forEach(b=>b.classList.toggle("on",b.dataset.gfx===q));}
(()=>{const cs=$("camSeg");if(cs&&!$("nightSeg"))cs.insertAdjacentHTML("afterend",`<div class="lbl"><span>Night racing</span></div><div class="seg n2" id="nightSeg"><button data-night="0">Day<small>afternoon at the strip</small></button><button data-night="1">Night<small>under the lights</small></button></div>`);})();
function applyNight(){document.querySelectorAll("#nightSeg button").forEach(b=>b.classList.toggle("on",(b.dataset.night==="1")===!!S.night));}
$("nightSeg").addEventListener("click",e=>{const b=e.target.closest("[data-night]");if(!b)return;S.night=b.dataset.night==="1";applyNight();save();toast(S.night?"NIGHT RACING · strip lights on":"DAY RACING");});
function applyCam(){document.querySelectorAll("#camSeg button").forEach(b=>b.classList.toggle("on",(b.dataset.cam==="1")===(S.followCam!==false)));}
$("camSeg").addEventListener("click",e=>{const b=e.target.closest("[data-cam]");if(!b)return;S.followCam=b.dataset.cam==="1";applyCam();save();});
function applyXray(){$("xrayBtn").classList.toggle("on",!!S.xray);ENGINE_VIS.setXray(!!S.xray);}
$("gfxSeg").addEventListener("click",e=>{const b=e.target.closest("[data-gfx]");if(!b)return;S.gfx=b.dataset.gfx;applyGfx();save();toast(S.gfx==="ultra"?"ULTRA · bloom + ambient occlusion":S.gfx==="full"?"FULL GRAPHICS · bloom on":"LITE GRAPHICS");});
$("xrayBtn").addEventListener("click",()=>{S.xray=!S.xray;applyXray();save();toast(S.xray?(isRot(S.cfg)?"X-RAY · rotors and eccentric shaft live":isTs(S.cfg)?"X-RAY · pistons opening the ports live":"X-RAY · crank, rods and pistons live"):"X-RAY OFF");});
function applyHeat(){$("heatBtn").classList.toggle("on",!!S.heat);ENGINE_VIS.setHeat(S.heat?heatZones():null);}
function zoneSheet(z){if(!quick||!ZONE_NAME[z])return;const rows=quick.tests.filter(t=>ZONE_OF[t.id]===z&&!((t.id==="turbine_temp"||t.id==="compressor_map")&&S.cfg.asp==="na")).sort((a,b)=>b.util-a.util);
  $("sheetTitle").textContent=(isRot(S.cfg)&&ZONE_NAME_ROT[z])||(isTs(S.cfg)&&ZONE_NAME_TS[z])||ZONE_NAME[z];
  $("sheetBody").innerHTML=rows.map(t=>`<div class="opt"><b>${t.name}</b><small class="${t.util>1?"critc":t.util>0.8?"warnc":""}">${Math.round(t.util*100)}% of limit</small><div class="bar" style="margin:6px 0"><i style="width:${Math.min(100,t.util*80)}%;background:${t.util>1?"var(--crit)":t.util>0.8?"var(--warn)":"var(--good)"}"></i></div><p>${t.physics||""}</p>${t.fix?`<p style="color:var(--muted)">${t.fix}</p>`:""}</div>`).join("")||"<p class='hint'>Nothing measured here.</p>";
  $("sheet").classList.add("on");$("scrim").classList.add("on");}
$("tag").addEventListener("change",e=>{if(e.target.id==="nameIn"){S.name=e.target.value.trim()||null;save();}});
$("tag").addEventListener("keydown",e=>{if(e.target.id==="nameIn"&&e.key==="Enter")e.target.blur();});
$("soloSeg").addEventListener("click",e=>{const b=e.target.closest("[data-solo]");if(!b)return;if(b.dataset.solo==="rebuild"){ENGINE_SOUND.rebuild();toast("SOUND GRAPH REBUILT");return;}
  ENGINE_SOUND.solo(b.dataset.solo);document.querySelectorAll("#soloSeg button").forEach(x=>x.classList.toggle("on",x.dataset.solo===b.dataset.solo));toast(`SOLO · ${b.textContent.toUpperCase()}`);});
setInterval(()=>{const el=$("sdPeak");if(!el||!setOn())return;const pk=ENGINE_SOUND.peak();el.textContent=pk?`${pk.hz} Hz @ ${pk.db} dB · low ${pk.lo} dB · ${pk.state} ${pk.sr/1000}k`:"—";},400);
/* frame rate: S.showFps puts a readout in the view; S.fpsCap 60 has ENGINE_VIS (and tick) skip the extra vsyncs of a 90/120 Hz screen */
function applyFps(){const cap=S.fpsCap===60?60:0;ENGINE_VIS.setFpsCap(cap);$("fpsHud").classList.toggle("on",!!S.showFps);document.querySelectorAll("#fpsSeg button").forEach(b=>b.classList.toggle("on",(b.dataset.fps==="1")===!!S.showFps));document.querySelectorAll("#capSeg button").forEach(b=>b.classList.toggle("on",+b.dataset.cap===cap));fpsShow();}
function fpsShow(){const f=ENGINE_VIS.fps(),r=Math.round(f.fps);if(S.showFps)$("fpsHud").innerHTML=r?`<b class="${r<30?"crit":r<50?"warn":""}">${r}</b> fps <i>· ${f.ms.toFixed(1)} ms</i>`:"— fps";if(curTab==="shop")$("fpsLbl").textContent=r?`${r} fps · ${f.ms.toFixed(1)} ms`:"—";}
setInterval(fpsShow,500);
$("fpsSeg").addEventListener("click",e=>{const b=e.target.closest("[data-fps]");if(!b)return;S.showFps=b.dataset.fps==="1";applyFps();save();});
$("capSeg").addEventListener("click",e=>{const b=e.target.closest("[data-cap]");if(!b)return;S.fpsCap=+b.dataset.cap===60?60:0;applyFps();save();toast(S.fpsCap?"CAPPED AT 60 FPS":"FRAME RATE · DISPLAY MAX");});
function renderDev(){$("devBox").style.display=career()?"":"none";if(!career())return;document.querySelectorAll("#devSeg button").forEach(b=>b.classList.toggle("on",(b.dataset.dev==="1")===dev()));$("devRow").style.display=dev()?"":"none";}
$("devSeg").addEventListener("click",e=>{const b=e.target.closest("[data-dev]");if(!b||!career())return;C().dev=b.dataset.dev==="1";toast(C().dev?"DEV MODE ON — everything unlocked, tests free":"Dev mode off");renderDev();hud();recompute();save();renderBuild();renderPresets();renderShop();renderTest();});
$("devCash").addEventListener("click",()=>{if(!career())return;C().cash+=1e6;hud();save();toast("+$1,000,000");});
$("devRep").addEventListener("click",()=>{if(!career())return;C().rep+=500;hud();save();toast("+500 rep");});
$("devWeek").addEventListener("click",()=>{if(!career()||typeof advanceWeek!=="function")return;advanceWeek();save();hud();renderShop();recompute();});
$("sqSeg").addEventListener("click",e=>{const b=e.target.closest("[data-sq]");if(!b)return;S.soundQ=b.dataset.sq;applySoundQuality();save();});
/* recorded engine layer: Synth / Real recordings / Blend (default Blend) + the credits sheet */
function applySoundSrc(){const m=S.soundSrc||"blend";if(typeof ENGINE_SAMPLES!=="undefined")ENGINE_SAMPLES.setMode(m);document.querySelectorAll("#srcSeg button").forEach(b=>b.classList.toggle("on",b.dataset.src===m));}
$("srcSeg").addEventListener("click",e=>{const b=e.target.closest("[data-src]");if(!b)return;S.soundSrc=b.dataset.src;applySoundSrc();save();toast(`ENGINE VOICE · ${b.firstChild.textContent.toUpperCase()}`);});
setInterval(()=>{const el=$("srcLbl");if(!el||!setOn()||typeof ENGINE_SAMPLES==="undefined")return;const t=ENGINE_SAMPLES.stats();
  el.textContent=t.mode==="synth"?"synth only":t.set?`${t.setName}${t.set2?" + "+t.set2Name:""} · ${Math.round(t.cover*100)}% recorded`:t.errors&&!t.decoded?"recordings unavailable · synth":t.slow&&t.mode!=="real"?"slow connection · synth":"loads when sound starts";},500);
function sndCredits(){const E=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
  const L=(typeof ENGINE_SAMPLES!=="undefined"&&ENGINE_SAMPLES.credits)||[];$("sheetTitle").textContent="Sound credits";
  $("sheetBody").innerHTML=`<p class="hint">Real engine recordings used by the Real and Blend engine voices. All are openly licensed; files were trimmed, looped, level-matched, converted to mono MP3 and are pitch-shifted live. Full list: <a href="sounds/CREDITS.md" target="_blank" rel="noopener" style="color:var(--orange)">sounds/CREDITS.md</a>.</p>`
    +L.map(c=>`<div class="opt"><div class="oh"><b>${E(c.title)}</b><span class="tag">${E(c.license)}</span></div><p>${E(c.use)} · by ${E(c.author)} · <a href="${E(c.src)}" target="_blank" rel="noopener" style="color:var(--orange)">source</a>${c.licUrl?` · <a href="${E(c.licUrl)}" target="_blank" rel="noopener" style="color:var(--orange)">license</a>`:""}${c.mods?`<br><small>${E(c.mods)}</small>`:""}</p></div>`).join("");
  $("sheet").classList.add("on");$("scrim").classList.add("on");}
$("sndCredBtn").addEventListener("click",sndCredits);
$("themeSeg").addEventListener("click",e=>{const b=e.target.closest("[data-theme]");if(!b)return;S.theme=b.dataset.theme;applyTheme();save();});
$("puSeg").addEventListener("click",e=>{const b=e.target.closest("[data-pu]");if(!b)return;S.psi=b.dataset.pu==="psi";applyPU();save();});
$("hapSeg").addEventListener("click",e=>{const b=e.target.closest("[data-hap]");if(!b)return;S.haptics=b.dataset.hap==="1";applyTheme();save();if(S.haptics)buzz(12);});
if(window.matchMedia)window.matchMedia("(prefers-color-scheme: light)").addEventListener?.("change",()=>{if(S.theme==="auto")applyTheme();});
$("heatBtn").addEventListener("click",()=>{S.heat=!S.heat;applyHeat();save();toast(S.heat?"HEAT-MAP ON · TAP A ZONE":"HEAT-MAP OFF");});
(()=>{let d=null;const gl=$("gl");gl.addEventListener("pointerdown",e=>{d={x:e.clientX,y:e.clientY,t:performance.now()};},{passive:true});
  gl.addEventListener("pointerup",e=>{if(!d||!S.heat||e.button)return;const mv=Math.hypot(e.clientX-d.x,e.clientY-d.y),dt=performance.now()-d.t;d=null;if(mv>9||dt>400)return;const z=ENGINE_VIS.zoneAt(e.clientX,e.clientY);if(z)zoneSheet(z);},{passive:true});})();
/* ---- engine card: name + headline numbers + status, reused everywhere an engine is shown ---- */
const ASP_SYM={na:"NA",turbo:"T",twin_turbo:"TT",roots:"SC",centrifugal:"SC",screw:"SCREW",compound:"CT"};
function engineName(){return S.name||autoName();}
function autoName(){const p=PRESETS.find(x=>x.soundProfile&&x.soundProfile===S.profileId)||null;return p?p.name:`Custom ${isRot(S.cfg)?LAYOUTS[S.cfg.layout].n+"-rotor":isTs(S.cfg)?"two-stroke "+S.cfg.layout:S.cfg.layout} ${quick?fmtDisp(quick.Vd/1000,""):""}`;}
const ROT_PORT_SHORT={side:"side port",sidex:"side exhaust",street:"street port",bridge:"bridge port",peri:"peri port"};
function engineSpecLine(cfg,res){const L=LAYOUTS[cfg.layout];const asp=cfg.asp==="na"?"NA":(ASP_SYM[cfg.asp]||cfg.asp.toUpperCase())+(cfg.asp!=="na"?" "+cfg.boost.toFixed(1)+"bar":"");
  if(isTs(cfg))return `<b>2T ${cfg.layout==="D18"?"Deltic":cfg.layout}</b><i>·</i>${fmtDisp(res.Vd/1000,"")}<i>·</i>${cfg.bore.toFixed(0)}×${cfg.stroke.toFixed(0)}<i>·</i>${{loop:"loop",cross:"cross",uniflow:"uniflow"}[cfg.scav]||"loop"}<i>·</i>${cfg.xpipe==="chamber"&&!isCI(cfg.fuel)?"pipe "+(cfg.pipeRpm/1000).toFixed(1)+"k":cfg.induct==="blower"?"blown":cfg.induct}<i>·</i>${asp}<i>·</i>${fuelShort(cfg.fuel)}${isCI(cfg.fuel)?" "+(INJ_SHORT[cfg.dInj]||"VE"):""}`;
  if(isRot(cfg))return `<b>${L.n}-rotor</b><i>·</i>${fmtDisp(res.Vd/1000,"")}<i>·</i>${ROT_PORT_SHORT[cfg.rotPort]||"side port"}<i>·</i>${cfg.cr.toFixed(1)}:1<i>·</i>${asp}<i>·</i>${fuelShort(cfg.fuel)}`;
  return `<b>${cfg.layout}</b><i>·</i>${fmtDisp(res.Vd/1000,"")}<i>·</i>${cfg.bore.toFixed(0)}×${cfg.stroke.toFixed(0)}<i>·</i>${cfg.cr.toFixed(1)}:1<i>·</i>${asp}<i>·</i>${fuelShort(cfg.fuel)}${isCI(cfg.fuel)?" "+(INJ_SHORT[cfg.dInj]||"VE"):""}`;}
function engineStatus(cfg,res){const h=cfgHash(cfg);
  if(res.fails&&res.fails.length)return (S.ranH||[]).includes(h)?{cls:"bad",txt:"✗ BREAKS"}:{cls:"",txt:"○ NOT RUN YET",nr:true};
  if(career()){const inField=C().fleet.filter(f=>f.hash===h&&C().week-f.week<=10).reduce((a,f)=>a+f.units,0);if(inField)return{cls:"fld",txt:`◆ ${inField} IN FIELD`};
    const c=C().cert;if(c&&c.hash===h&&c.ok)return{cls:"ok",txt:"✓ CERTIFIED"};return{cls:"",txt:"○ UNCERTIFIED"};}
  return{cls:"ok",txt:"● TEST CELL"};}
function engineCard(cfg,res,o){o=o||{};const st=engineStatus(cfg,res);const name=o.name||engineName();
  const nums=`<b>${Math.round(res.peakHp)}</b>hp<i>·</i><b>${Math.round(res.peakTq)}</b>Nm<i>·</i>rel <b>${st.nr?"—":Math.round(res.rel)}</b><i>·</i><b>${fmt$(res.cost)}</b>`;
  return `<div class="ecard ${o.cls||""}"><div class="nm">${o.editable?`<input id="nameIn" value="${name.replace(/"/g,"&quot;")}" maxlength="24" aria-label="Engine name">`:name}</div><span class="badge ${st.cls}">${st.txt}</span><div class="spec">${nums}</div><div class="spec">${engineSpecLine(cfg,res)}</div>${launchLine(cfg)?`<div class="spec"><b>Launch</b><i>·</i>${launchLine(cfg,true)}</div>`:""}</div>`;}
let prevQuick=null;
function stripFlash(id,d,fmt,lowGood){const el=$(id).parentElement;let t=el.querySelector(".d");if(!t){t=document.createElement("span");t.className="d";el.appendChild(t);}
  if(!d){t.classList.remove("show");return;}t.textContent=(d>0?"▲":"▼")+fmt(Math.abs(d));t.classList.toggle("dn",lowGood?d>0:d<0);t.classList.add("show");clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove("show"),1800);}
function recompute(){
  if(S.bay)ddGuard();   // dyno day: only the parts the customer OK'd
  altFuelFill(S.cfg);   // flex needs a blend and a gas fuel a gas system before the engine is run
  prevQuick=quick;
  quick=SIM.simulate(S.cfg,simEnv(Object.assign({testType:"pull"},ddEnvX())));
  if(prevQuick&&prevQuick!==quick){stripFlash("sHp",Math.round(quick.peakHp-prevQuick.peakHp),v=>v);stripFlash("sKg",Math.round(quick.kg-prevQuick.kg),v=>v,true);stripFlash("sCost",Math.round(quick.cost-prevQuick.cost),v=>"$"+v.toLocaleString("en-CA"),true);stripFlash("sDisp",+(quick.Vd/1000-prevQuick.Vd/1000).toFixed(1),v=>v.toFixed(1));}
  combosNow=SIM.combos(S.cfg,simEnv(Object.assign({testType:"pull"},ddEnvX())),quick);
  if(S.heat)applyHeat();
  if(document.activeElement&&document.activeElement.id==="nameIn"){/* don't clobber while typing */}else $("tag").innerHTML=engineCard(S.cfg,quick,{editable:true});
  {const cc=quick.Vd<1000;$("sDisp").textContent=cc?Math.round(quick.Vd):(quick.Vd/1000).toFixed(1);$("sDisp").nextElementSibling.textContent=cc?"cc":"Litres";}$("sHp").textContent=Math.round(quick.peakHp);$("sKg").textContent=Math.round(quick.kg);$("sCost").textContent=fmt$(quick.cost);
  const worst=Math.max(...quick.tests.map(t=>t.util));$("sHp").className=worst>1?"critc":worst>.8?"warnc":"";
  const cert=C().cert;
  $("mktDot").classList.toggle("on",career()&&!!cert&&cert.ok&&cert.hash===cfgHash(S.cfg)&&(C().contracts.some(k=>fits(k,cert.res).ok)||offersFor(C().cat).some(k=>fits(k,cert.res).ok)));if(typeof tabBadges==="function")tabBadges();
  fuelHdr();
  if(typeof swapRender==="function"&&$("swapAcc"))swapRender();   // the swap fit follows the engine
  if(typeof railSched==="function")railSched();   // the results rail follows it too (app/rail.js)
}
function hud(){
  if(typeof tabBadges==="function")tabBadges();
  if(career()){$("cashLbl").textContent=fmt$(C().cash);$("cashLbl").style.color=C().cash<0?"var(--crit)":"";$("repLbl").textContent=`Rep ${C().rep} · ${repTier()[1]}`;$("weekLbl").textContent=`WEEK ${C().week} · ${(has("bay4")?"BAYS A–D":has("bay3")?"BAYS A–C":["BAY A","BAYS A+B","RACE SHOP"][has("bay2")?2:has("bay1")?1:0])}${dev()?" · DEV":""}`;}
  else{$("cashLbl").textContent="Test cell";$("cashLbl").style.color="var(--chalk)";$("repLbl").textContent="all parts unlocked";$("weekLbl").textContent="SANDBOX";}
  if(typeof lgHud==="function")lgHud();
}

