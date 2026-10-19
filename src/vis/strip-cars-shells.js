/* ---------------------------------------------------------------------------
   DRAG CARS v3 — shells. Every door car picks a shell (hw.style) per class:
     street / outlaw : fox · gbody · nova · coupe (the 90s F-body) · hatch · truck (crew-cab diesel)
     promod          : modern (the v2 shell) · camaro69 · c7 · willys41
     prostock        : one sleek shell with the tall hood scoop
     gasser          : tri55 ('55 Chevy) · willys
   A shell is loft rows (see sc_def) plus where the glass / wheels / hood hardware sit, a drag stance
   (rake: nose up, lift: tail squat, skinny fronts) and hooks that dress it: dress (fascia, bumpers, lamps,
   mirrors), rear (spoiler / wing), exhaust, chassis (things under the body). No hw = the v1.5 car exactly.
   -------------------------------------------------------------------------*/
var SC_BODY_TYRE={street:27, outlaw:30, promod:33, rail:36, funny:36, prostock:33, gasser:30};
var SC_ALIAS={muscle:"nova", fbody:"coupe", camaro:"camaro69", vette:"c7", corvette:"c7"};
/* the shell a class actually uses for a requested style (unknown -> the class default; diesel street -> the truck) */
function sc_styleFor(body, st, diesel){
  if(body==="street"||body==="outlaw"){ st=SC_ALIAS[st]||st; return SC_STYLE[st] && st!=="muscle"?st:(diesel?"truck":"coupe"); }
  if(body==="promod"){ st=SC_ALIAS[st]||(st==="willys"?"willys41":st); return SC_PM[st] && st!=="prostock"?st:"modern"; }
  if(body==="gasser"){ if(st==="willys41") st="willys"; return SC_GAS[st]?st:"tri55"; }
  return "";
}
function sc_shell(body, st){
  if(body==="promod") return SC_PM[st]||null;
  if(body==="prostock") return SC_PM.prostock;
  if(body==="gasser") return SC_GAS[st]||SC_GAS.tri55;
  return SC_STYLE[st]||null;
}

/* --- fascia helpers ------------------------------------------------------- */
/* the body's front (dir -1) or rear (dir +1) surface x at height y on the centre line */
function sc_faceX(D, xEnd, y, dir){ var P={}, x=xEnd; for(var i=0;i<90;i++){ sc_params(D,x,P); if(y>=P.zb && y<=P.yt) return x; x+=dir*0.01; } return x; }
function sc_at(D, x){ var P={}; return sc_params(D, x, P); }
function sc_disc(r, t, seg){ var key="dk"+r3(r)+"_"+r3(t)+"_"+(seg||14); if(SC.geo[key]) return SC.geo[key]; var g=new THREE.CylinderGeometry(r, r, t, seg||14); g.rotateZ(PI/2); return (SC.geo[key]=g); }
function sc_bezel(r, t){ var key="bz"+r3(r)+"_"+r3(t); if(SC.geo[key]) return SC.geo[key]; var g=new THREE.TorusGeometry(r, t, 4, 14); g.rotateY(PI/2); return (SC.geo[key]=g); }
/* round headlamp with a chrome bezel, facing +x (or -x for a tail lamp) */
function sc_roundLamp(C, list, x, y, z, r, bezel){ list.push({g:sc_disc(r, 0.03), m:sc_M(x, y, z)}); if(bezel) C.B.add(bezel, sc_bezel(r+0.006, 0.011), sc_M(x+0.006, y, z)); }
/* flush lamps on the nose slope: a patch of the body skin at the top corners (k 8.2..9.5 right, 10.5..11.8 left) */
function sc_flushLamps(C, x0, x1, kIn){ var ki=kIn||9.5; C.heads.push({g:sc_patch(C.D, x0, x1, 8.15, ki, 0.006), m:new THREE.Matrix4()}); C.heads.push({g:sc_patch(C.D, x0, x1, 20-ki, 11.85, 0.006), m:new THREE.Matrix4()}); }
function sc_liteBins(B){ if(!B) return; [["carbonS","carbon"],["chromeT","chrome"],["caliper","black"]].forEach(function(q){ if(B[q[0]]){ (B[q[1]]||(B[q[1]]=[])).push.apply(B[q[1]], B[q[0]]); delete B[q[0]]; } }); }
/* a straight bumper blade across the car with its ends wrapped back */
function sc_bumper(B, mat, x, y, half, h, d, dir, wrap){
  B.add(mat, sc_rbox(d, h, half*2-0.16, Math.min(0.03, h*0.3)), sc_M(x, y, 0));
  [-1,1].forEach(function(sd){ B.add(mat, sc_rbox(d, h, wrap||0.24, Math.min(0.03, h*0.3)), sc_M(x-dir*0.05, y, sd*(half-0.03), 0, -sd*dir*0.75, 0)); });
}
function sc_grille(B, x, y, w, h, bars, barMat, frame){
  B.add("well", sc_rbox(0.03, h, w, 0.012), sc_M(x-0.012, y, 0));
  if(frame) B.add(frame, sc_rbox(0.022, h+0.03, w+0.03, 0.012), sc_M(x-0.02, y, 0));
  for(var i=0;i<bars;i++) B.add(barMat||"satin", sc_rbox(0.014, 0.011, w*0.96, 0.004), sc_M(x+0.006, y-h/2+(i+1)*h/(bars+1), 0));
}
/* mirrors: aero (body colour), bullet (chrome, one side), square, tow (big, on arms) */
function sc_mirror(C, kind){
  var B=C.B, x=C.cowl-0.05, P=sc_at(C.D, C.cowl-0.04), y=P.ys, sides=kind==="bullet"?[-1]:[-1,1];
  sides.forEach(function(sd){ var z=sd*(P.w+0.1);
    if(kind==="bullet"){ B.add("chrome", new THREE.SphereGeometry(0.05, 10, 6, 0, TAU, 0, PI/2), sc_M(x-0.02, y+0.08, z, 0,0,-PI/2)); B.add("chrome", sc_disc(0.05,0.03,10), sc_M(x-0.035, y+0.08, z)); B.add("chrome", sc_cyl(0.008,6), sc_rodM(new THREE.Vector3(x, y+0.005, sd*(P.w-0.01)), new THREE.Vector3(x-0.01, y+0.06, z))); }
    else if(kind==="square"){ B.add("chrome", sc_rbox(0.05, 0.08, 0.13, 0.012), sc_M(x, y+0.075, z)); B.add("glass", sc_rbox(0.006, 0.06, 0.11, 0.003), sc_M(x-0.028, y+0.075, z)); B.add("chrome", sc_rbox(0.03, 0.05, 0.06, 0.008), sc_M(x+0.01, y+0.025, sd*(P.w+0.04))); }
    else if(kind==="tow"){ var zt=sd*(P.w+0.24); B.add("black", sc_rbox(0.09, 0.32, 0.2, 0.025), sc_M(x, y+0.2, zt)); B.add("glass", sc_rbox(0.006, 0.28, 0.17, 0.004), sc_M(x-0.048, y+0.2, zt));
      B.add("black", sc_cyl(0.014,6), sc_rodM(new THREE.Vector3(x+0.02, y+0.06, sd*(P.w-0.02)), new THREE.Vector3(x, y+0.1, zt))); B.add("black", sc_cyl(0.014,6), sc_rodM(new THREE.Vector3(x+0.02, y+0.3, sd*(P.w-0.04)), new THREE.Vector3(x, y+0.3, zt))); }
    else { B.add("paint", sc_prof([[0.07,0.01],[0.0,-0.01],[-0.06,0.0],[-0.065,0.075],[0.0,0.085],[0.06,0.06]], 0.13, 0.012), sc_M(x, y+0.06, z));
      B.add("glass", sc_rbox(0.008,0.06,0.1,0.003), sc_M(x-0.067, y+0.097, z)); B.add("black", sc_rbox(0.05,0.025,0.1,0.008), sc_M(x+0.02, y+0.045, sd*(P.w+0.04))); }
  });
}
/* chrome trim under the side glass (older cars) */
function sc_beltTrim(C, x0, x1){ C.B.add("chromeT", sc_patch(C.D, x0, x1, 5.22, 5.4, 0.006)); C.B.add("chromeT", sc_patch(C.D, x0, x1, 14.6, 14.78, 0.006, "L")); }
/* a lip spoiler on the deck */
function sc_lip(C, x, h, span){ var P=sc_at(C.D, x); C.B.add(C.mat||"paint", sc_prof([[0.1,0],[0.0,h],[-0.08,h*1.1],[-0.1,0]], span||P.wt*2*0.95, 0.008), sc_M(x, P.yt-0.012, 0)); }
/* brake calipers on the rear rotors (merged into the body pack: they sit on the axle, not the spinning wheel) */
function sc_calipers(B, wh){
  wh.forEach(function(w){ if(!w.rear) return; var sd=w.z<0?-1:1, a=2.2, rc=w.rimR*0.74;
    B.add("caliper", sc_rbox(0.06, 0.15, 0.06, 0.016), sc_M(w.x+Math.cos(a)*rc, w.r+Math.sin(a)*rc, w.z+sd*w.w*0.14, 0,0,a)); });
}
/* rear exhaust pair under the bumper (shared by the shells that keep their pipes out back) */
function sc_rearPipes(C, y, z, r, n){
  (n===1?[1]:[-1,1]).forEach(function(sd){ var p=new THREE.Vector3(C.xR-0.04, y, sd*z);
    C.B.add("chrome", new THREE.CylinderGeometry(r, r, 0.22, 12, 1, true), sc_M(p.x+0.1, p.y, p.z, 0,0,PI/2));
    C.B.add("well", new THREE.CircleGeometry(r*0.9, 12), sc_M(p.x+0.03, p.y, p.z, 0,-PI/2,0));
    C.tips.push(p); C.dirs.push(new THREE.Vector3(-1,0,0)); });
}

/* --- street / outlaw shells ------------------------------------------------- */
/* Fox-body Mustang (notchback): aero nose with flush composite lamps, slot grille, body-colour bumpers, ribbed tails */
SC_STYLE.fox={xr:-1.27, xf:1.28, roofF:0.1, cowl:0.6, roofR:-0.78, deck:-1.42, dG0:-0.42, qG0:-0.95, hx:1.25, door:[-0.38,0.5], hood:[1.55,2.0],
  rake:0.028, lift:0, fw:0.13, fr:0.33, fz:0.06, rimR:"star", rimF:"weld", lettersF:false, rows:[
  [-2.30,.31,.80,.83,.84,.80,.02],[-2.25,.24,.87,.92,.855,.82,.02],[-1.85,.21,.88,.94,.86,.83,.02],[-1.42,.20,.885,.96,.865,.81,.03],
  [-1.10,.19,.885,1.20,.865,.66,.04],[-0.78,.19,.885,1.295,.865,.62,.04],[0.10,.19,.885,1.305,.865,.62,.04],[0.60,.19,.885,1.01,.865,.79,.03],
  [0.95,.19,.88,.945,.86,.82,.02],[1.70,.20,.845,.89,.85,.81,.02],[2.12,.24,.73,.765,.82,.77,.02],[2.27,.31,.60,.625,.76,.70,.02]],
  dress:function(C){ var B=C.B, D=C.D, cF=C.cF, cR=C.cR, y, x, P;
    y=lerp(cF.zb,cF.ys,0.82)+0.02; x=sc_faceX(D, C.xF, y, -1); P=sc_at(D, x-0.06);
    sc_flushLamps(C, C.xF-0.2, C.xF-0.05, 9.3);
    B.add("well", sc_patch(D, C.xF-0.16, C.xF-0.09, 9.6, 10.4, 0.006));
    y=lerp(cF.zb,cF.ys,0.25); x=sc_faceX(D, C.xF, y, -1);
    B.add("black", sc_rbox(0.04, 0.09, cF.w*1.5, 0.02), sc_M(x, y, 0));
    [-1,1].forEach(function(sd){ B.add("glass", sc_disc(0.03, 0.02, 10), sc_M(x+0.004, y, sd*cF.w*0.62)); });
    B.add("black", sc_prof([[0,0],[0.3,0],[0.33,0.03],[0,0.045]], cF.w*2*0.96, 0.006), sc_M(cF.x-0.3, cF.zb-0.03, 0));
    /* tails: wide, horizontally ribbed, the black centre panel between */
    y=lerp(cR.zb,cR.ys,0.7); x=sc_faceX(D, C.xR, y, 1);
    [-1,1].forEach(function(sd){ C.tails.push({g:sc_rbox(0.03, 0.13, 0.5, 0.012), m:sc_M(x-0.004, y, sd*cR.w*0.6)});
      for(var i=0;i<3;i++) B.add("black", sc_rbox(0.012, 0.008, 0.5, 0.002), sc_M(x-0.02, y-0.04+i*0.04, sd*cR.w*0.6)); });
    B.add("black", sc_rbox(0.03, 0.13, cR.w*0.42, 0.012), sc_M(x-0.002, y, 0));
    B.add("black", sc_rbox(0.05, 0.04, cR.w*1.95, 0.015), sc_M(cR.x+0.01, lerp(cR.zb,cR.ys,0.32), 0));
    sc_mirror(C, "square");
  },
  rear:function(C){}
};
/* G-body Monte Carlo SS: long hood, formal roof, aero nose with quad lamps around an egg-crate grille, a deck lip */
SC_STYLE.gbody={xr:-1.37, xf:1.37, roofF:-0.05, cowl:0.5, roofR:-1.12, deck:-1.48, dG0:-0.5, qG0:-1.05, hx:1.35, door:[-0.45,0.4], hood:[1.7,2.2],
  rake:0.028, lift:0, fw:0.13, fr:0.33, fz:0.06, rimR:"star", rimF:"weld", lettersF:false, rows:[
  [-2.56,.32,.82,.86,.86,.82,.02],[-2.50,.25,.88,.935,.885,.85,.02],[-2.0,.22,.895,.96,.895,.86,.02],[-1.48,.21,.90,.985,.90,.85,.03],
  [-1.30,.20,.90,1.25,.90,.66,.04],[-1.12,.20,.90,1.35,.90,.62,.04],[-0.05,.20,.90,1.36,.90,.62,.04],[0.50,.20,.90,1.02,.90,.79,.03],
  [0.90,.20,.895,.975,.90,.84,.02],[1.90,.22,.875,.94,.89,.84,.02],[2.38,.26,.79,.82,.86,.81,.02],[2.56,.32,.66,.68,.80,.74,.02]],
  dress:function(C){ var B=C.B, D=C.D, cF=C.cF, cR=C.cR, y, x, P;
    y=lerp(cF.zb,cF.ys,0.62); x=sc_faceX(D, C.xF, y, -1); P=sc_at(D, x-0.05);
    sc_grille(B, x, y, 0.44, 0.13, 4, "chrome", "chrome");
    [-1,1].forEach(function(sd){ for(var i=0;i<2;i++) C.heads.push({g:sc_rbox(0.03, 0.065, 0.15, 0.01), m:sc_M(x-0.01, y+(i?0.035:-0.035), sd*(0.34+0.0*i))});
      B.add("black", sc_rbox(0.025, 0.16, 0.2, 0.01), sc_M(x-0.02, y, sd*0.34)); });
    y=lerp(cF.zb,cF.ys,0.24); x=sc_faceX(D, C.xF, y, -1);
    B.add("black", sc_rbox(0.04, 0.05, cF.w*1.8, 0.015), sc_M(x, y, 0));
    B.add("black", sc_prof([[0,0],[0.32,0],[0.34,0.035],[0,0.05]], cF.w*2*0.98, 0.006), sc_M(cF.x-0.3, cF.zb-0.035, 0));
    y=lerp(cR.zb,cR.ys,0.72); x=sc_faceX(D, C.xR, y, 1);
    [-1,1].forEach(function(sd){ C.tails.push({g:sc_rbox(0.03, 0.12, 0.56, 0.012), m:sc_M(x-0.004, y, sd*cR.w*0.55)}); });
    B.add("chromeT", sc_rbox(0.02, 0.018, cR.w*1.9, 0.006), sc_M(x-0.006, y+0.08, 0));
    B.add("black", sc_rbox(0.05, 0.05, cR.w*1.95, 0.015), sc_M(cR.x+0.01, lerp(cR.zb,cR.ys,0.3), 0));
    sc_beltTrim(C, C.qG0, C.cowl-0.04);
    sc_mirror(C, "square");
  },
  rear:function(C){ sc_lip(C, C.xR+0.08, 0.045); }
};
/* '68-72 Nova: flat face, full-width grille between round lamps, chrome blade bumpers, chrome trim, one bullet mirror */
SC_STYLE.nova={xr:-1.36, xf:1.43, roofF:0.05, cowl:0.55, roofR:-0.72, deck:-1.55, dG0:-0.4, qG0:-1.0, hx:1.4, door:[-0.4,0.45], hood:[1.75,2.25],
  rake:0.035, lift:0, fw:0.13, fr:0.33, fz:0.06, rimR:"star", rimF:"weld", lettersF:false, rows:[
  [-2.34,.30,.80,.835,.86,.82,.02],[-2.29,.24,.88,.935,.885,.85,.02],[-1.90,.22,.89,.95,.895,.86,.02],[-1.55,.21,.895,.965,.90,.86,.03],
  [-1.20,.20,.90,1.15,.90,.71,.04],[-0.72,.20,.90,1.325,.90,.63,.04],[0.05,.20,.90,1.335,.90,.63,.04],[0.55,.20,.90,1.01,.90,.80,.03],
  [0.85,.20,.895,.97,.90,.855,.02],[1.85,.21,.885,.955,.895,.86,.02],[2.38,.23,.86,.925,.89,.85,.02],[2.50,.30,.81,.845,.86,.82,.02]],
  dress:function(C){ var B=C.B, D=C.D, cF=C.cF, cR=C.cR, y, x;
    y=lerp(cF.zb,cF.ys,0.62); x=sc_faceX(D, C.xF, y, -1);
    sc_grille(B, x, y, cF.w*1.5, 0.17, 3, "chrome", "chrome");
    [-1,1].forEach(function(sd){ sc_roundLamp(C, C.heads, x+0.002, y, sd*cF.w*0.86, 0.075, "chrome"); });
    sc_bumper(B, "chrome", cF.x+0.05, lerp(cF.zb,cF.ys,0.12)+0.02, cF.w+0.03, 0.1, 0.08, 1);
    y=lerp(cR.zb,cR.ys,0.62); x=sc_faceX(D, C.xR, y, 1);
    [-1,1].forEach(function(sd){ C.tails.push({g:sc_rbox(0.03, 0.09, 0.28, 0.012), m:sc_M(x-0.004, y, sd*cR.w*0.62)}); B.add("chromeT", sc_rbox(0.02, 0.11, 0.3, 0.012), sc_M(x+0.004, y, sd*cR.w*0.62)); });
    sc_bumper(B, "chrome", cR.x-0.05, lerp(cR.zb,cR.ys,0.14)+0.02, cR.w+0.03, 0.1, 0.08, -1);
    sc_beltTrim(C, C.qG0, C.cowl-0.04);
    sc_mirror(C, "bullet");
  },
  rear:function(C){}
};
/* the 90s F-body: pointed nose, slim lamps, big lower intake, full-width tail bar, the factory spoiler (default rear) */
Object.assign(SC_STYLE.coupe, {rake:0.022, lift:0, fw:0.13, fr:0.33, fz:0.06, rimR:"star", rimF:"weld", lettersF:false,
  dress:function(C){ var B=C.B, D=C.D, cF=C.cF, cR=C.cR, y, x, P;
    y=lerp(cF.zb,cF.ys,0.82); x=sc_faceX(D, C.xF, y, -1); P=sc_at(D, x-0.1);
    sc_flushLamps(C, C.xF-0.32, C.xF-0.1, 9.0);
    y=lerp(cF.zb,cF.ys,0.36); x=sc_faceX(D, C.xF, y, -1);
    B.add("well", sc_rbox(0.04, 0.11, cF.w*1.2, 0.03), sc_M(x-0.005, y, 0));
    for(var i=0;i<2;i++) B.add("satin", sc_rbox(0.012, 0.01, cF.w*1.15, 0.003), sc_M(x+0.012, y-0.03+i*0.06, 0));
    B.add("black", sc_prof([[0,0],[0.32,0],[0.34,0.035],[0,0.05]], cF.w*2*0.98, 0.006), sc_M(cF.x-0.3, cF.zb-0.035, 0));
    var ty=lerp(cR.zb,cR.ys,0.74); x=sc_faceX(D, C.xR, ty, 1);
    C.tails.push({g:sc_rbox(0.03, 0.11, cR.w*1.85, 0.015), m:sc_M(x-0.004, ty, 0)});
    B.add("black", sc_rbox(0.05, 0.12, cR.w*1.9, 0.025), sc_M(cR.x+0.01, lerp(cR.zb,cR.ys,0.22), 0));
    sc_mirror(C, "aero");
  }});
/* Civic-style hatch: small flush lamps, tall corner tails, a roof spoiler over the hatch glass */
Object.assign(SC_STYLE.hatch, {rake:0.016, lift:0, fw:0.13, fr:0.32, fz:0.06, rimR:"star", rimF:"weld", lettersF:false,
  dress:function(C){ var B=C.B, D=C.D, cF=C.cF, cR=C.cR, y, x, P;
    y=lerp(cF.zb,cF.ys,0.78); x=sc_faceX(D, C.xF, y, -1); P=sc_at(D, x-0.05);
    sc_flushLamps(C, C.xF-0.2, C.xF-0.03, 9.2);
    B.add("well", sc_rbox(0.03, 0.04, 0.36, 0.01), sc_M(x-0.01, y-0.01, 0));
    y=lerp(cF.zb,cF.ys,0.3); x=sc_faceX(D, C.xF, y, -1);
    B.add("well", sc_rbox(0.04, 0.08, cF.w*0.9, 0.025), sc_M(x-0.005, y, 0));
    B.add("black", sc_prof([[0,0],[0.3,0],[0.32,0.03],[0,0.045]], cF.w*2*0.96, 0.006), sc_M(cF.x-0.28, cF.zb-0.03, 0));
    y=lerp(cR.zb,cR.ys,0.8); x=sc_faceX(D, C.xR, y, 1);
    [-1,1].forEach(function(sd){ C.tails.push({g:sc_rbox(0.04, 0.2, 0.16, 0.015), m:sc_M(x+0.01, y, sd*cR.w*0.82)}); });
    B.add("black", sc_rbox(0.05, 0.06, cR.w*1.95, 0.02), sc_M(cR.x+0.01, lerp(cR.zb,cR.ys,0.3), 0));
    sc_mirror(C, "aero");
  },
  rear:function(C){ var x=C.roofR, P=sc_at(C.D, x+0.02);
    C.B.add("paint", sc_foil(0.24, 0.05, P.wt*2*0.98), sc_M(x-0.06, P.yt+0.015, 0, 0,0,-0.12)); }
});
/* crew-cab diesel pickup (Duramax / Cummins class): tall, square, a big chrome grille, steel bumpers, tow mirrors,
   running boards, frame rails, and two stacks out of the bed */
SC_STYLE.truck={xr:-1.95, xf:1.85, roofF:0.55, cowl:1.05, roofR:-0.98, deck:-1.22, dG0:0.0, qG0:-0.92, hx:1.9, bed:true, door:[0.1,0.88], hood:[2.0,2.5],
  rr0:0.40, rake:0.012, lift:0, fw:-1, fr:-1, fz:0.04, gapF:0.06, gapR:0.05, rimR:"star", rimF:"star", rimMat:"chrome", lettersF:true, seams:[-0.98,-1.17], rows:[
  [-3.15,.60,1.17,1.20,.99,.95,.01],[-3.10,.54,1.24,1.26,1.0,.97,.01],[-1.22,.54,1.24,1.26,1.0,.97,.01],[-1.16,.52,1.25,1.30,1.0,.93,.01],
  [-1.08,.52,1.26,1.90,1.0,.82,.03],[-0.98,.52,1.26,1.96,1.0,.82,.04],[0.55,.52,1.26,1.97,1.0,.82,.04],[1.05,.52,1.26,1.40,1.0,.90,.03],
  [1.30,.52,1.26,1.37,1.0,.95,.02],[2.55,.54,1.24,1.33,.99,.95,.02],[2.80,.58,1.21,1.28,.98,.93,.02],[2.86,.66,1.08,1.10,.95,.90,.01]],
  dress:function(C){ var B=C.B, D=C.D, cF=C.cF, cR=C.cR, y=0.95, x=sc_faceX(D, C.xF, y, -1), P=sc_at(D, x-0.05);
    sc_grille(B, x, y, 1.0, 0.36, 4, "chrome", "chrome");
    B.add("chrome", sc_rbox(0.03, 0.05, 1.04, 0.012), sc_M(x+0.01, y, 0));
    [-1,1].forEach(function(sd){ C.heads.push({g:sc_rbox(0.04, 0.2, 0.3, 0.02), m:sc_M(x-0.02, y+0.04, sd*0.71)}); B.add("chrome", sc_rbox(0.03, 0.22, 0.32, 0.012), sc_M(x-0.03, y+0.04, sd*0.71)); });
    sc_bumper(B, "chrome", x+0.06, 0.66, P.w+0.04, 0.2, 0.16, 1, 0.34);
    B.add("black", sc_rbox(0.12, 0.08, P.w*1.6, 0.02), sc_M(x-0.02, 0.52, 0));
    [-1,1].forEach(function(sd){ B.add("caliper", sc_rbox(0.06, 0.05, 0.05, 0.012), sc_M(x+0.12, 0.6, sd*0.45)); });   /* tow hooks */
    /* rear: tall lamps on the bed corners, the tailgate, a step bumper */
    [-1,1].forEach(function(sd){ C.tails.push({g:sc_rbox(0.04, 0.42, 0.11, 0.015), m:sc_M(cR.x-0.0, 1.0, sd*(cR.w-0.07))}); });
    B.add("seam", sc_rbox(0.01, 0.01, cR.w*1.6, 0.002), sc_M(cR.x-0.006, 0.7, 0));
    sc_bumper(B, "chrome", cR.x-0.07, 0.6, cR.w+0.02, 0.17, 0.16, -1, 0.3);
    B.add("black", sc_rbox(0.18, 0.025, 0.5, 0.005), sc_M(cR.x-0.07, 0.69, 0));
    sc_mirror(C, "tow");
  },
  rear:function(C){},
  chassis:function(C){ var B=C.B;   /* frame rails, running boards, a hint of the axles */
    [-1,1].forEach(function(sd){ B.add("black", sc_rbox(C.xf-C.xr+1.6, 0.16, 0.07, 0.01), sc_M((C.xf+C.xr)/2-0.2, 0.47, sd*0.45));
      B.add("black", sc_rbox(C.xf-C.xr-2*C.rr-0.3, 0.05, 0.16, 0.012), sc_M((C.xf+C.xr)/2+0.05, 0.42, sd*0.93));
      B.add("satin", sc_rbox(0.05, 0.12, 0.05, 0.01), sc_M((C.xf+C.xr)/2-0.6, 0.47, sd*0.88)); B.add("satin", sc_rbox(0.05, 0.12, 0.05, 0.01), sc_M((C.xf+C.xr)/2+0.7, 0.47, sd*0.88)); });
    B.add("black", sc_cyl(0.06, 8), sc_rodM(new THREE.Vector3(C.xr, C.rr, -0.7), new THREE.Vector3(C.xr, C.rr, 0.7)));
    B.add("black", sc_rbox(0.3, 0.26, 0.3, 0.04), sc_M(C.xr, C.rr, 0));
  },
  exhaust:function(C){
    if(C.H && C.H.diesel){ [-1,1].forEach(function(sd){ var x0=-1.42, z0=sd*0.78, y0=1.0, y1=2.6;   /* 5" stacks behind the cab */
        C.B.add("chrome", sc_cyl(0.065, 12), sc_rodM(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x0, y1, z0)));
        C.B.add("chrome", new THREE.CylinderGeometry(0.068, 0.068, 0.16, 12, 1, true), sc_M(x0, y1+0.04, z0, 0,0,0.6));   /* mitred tip */
        C.B.add("well", new THREE.CircleGeometry(0.06, 12), sc_M(x0-0.045, y1+0.1, z0, -PI/2,0,0.6));
        C.B.add("satin", sc_rbox(0.06, 0.04, 0.16, 0.01), sc_M(x0, 1.28, z0));
        C.tips.push(new THREE.Vector3(x0-0.04, y1+0.1, z0)); C.dirs.push(new THREE.Vector3(-0.35,1,0).normalize()); }); }
    else sc_rearPipes(C, C.cR.zb-0.05, 0.6, 0.05);
  }
};
SC_STYLE.coupe.rows=undefined;   /* the coupe keeps the v1.5 rows (sc_door's default) */

/* --- pro-mod shells (per car) -------------------------------------------------- */
var SC_PM={
  /* '69 Camaro: square, flat face, round lamps set in the grille, chopped and wide over the tubs */
  camaro69:{xr:-1.36, xf:1.40, roofF:0.0, cowl:0.5, roofR:-0.62, deck:-1.52, dG0:-0.42, qG0:-1.0, hx:1.15, door:[-0.45,0.4], hood:[1.55,2.15], rimMat:"rimBlack", rows:[
    [-2.36,.30,.82,.86,.90,.86,.02],[-2.30,.24,.90,.955,.93,.89,.02],[-1.90,.21,.92,.975,.95,.90,.02],[-1.52,.20,.925,.99,.955,.89,.03],
    [-1.10,.19,.93,1.10,.955,.74,.04],[-0.62,.19,.93,1.205,.955,.66,.05],[0.0,.19,.93,1.215,.955,.66,.05],[0.50,.19,.925,.99,.955,.82,.03],
    [0.80,.18,.92,.965,.955,.88,.02],[1.90,.17,.89,.945,.95,.89,.02],[2.36,.18,.85,.90,.94,.88,.02],[2.46,.24,.79,.82,.90,.84,.02]],
    dress:function(C){ var B=C.B, D=C.D, cF=C.cF, cR=C.cR, y=lerp(cF.zb,cF.ys,0.6), x=sc_faceX(D, C.xF, y, -1);
      sc_grille(B, x, y, cF.w*1.7, 0.16, 2, "satin", "black");
      [-1,1].forEach(function(sd){ sc_roundLamp(C, C.heads, x+0.002, y, sd*cF.w*0.68, 0.065, "chrome"); });
      B.add("carbonS", sc_prof([[0,0],[0.36,0],[0.4,0.03],[0,0.05]], cF.w*2*1.0, 0.006), sc_M(cF.x-0.32, cF.zb-0.04, 0));
      y=lerp(cR.zb,cR.ys,0.66); x=sc_faceX(D, C.xR, y, 1);
      [-1,1].forEach(function(sd){ for(var i=0;i<2;i++) C.tails.push({g:sc_rbox(0.03, 0.08, 0.24, 0.012), m:sc_M(x-0.004, y, sd*(cR.w*0.3+i*0.28))}); });
      B.add("black", sc_rbox(0.03, 0.03, cR.w*1.9, 0.01), sc_M(x+0.004, y-0.08, 0));
      sc_mirror(C, "aero");
    }},
  /* C7 Corvette: low wedge, cab-back, angular lamps, big lower intake, angular tails */
  c7:{xr:-1.32, xf:1.36, roofF:-0.35, cowl:0.15, roofR:-0.95, deck:-1.6, dG0:-0.55, qG0:null, hx:0.95, door:[-0.55,0.15], hood:[1.2,1.85], rimMat:"rimBlack", rows:[
    [-2.30,.36,.92,.96,.90,.84,.02],[-2.24,.28,.98,1.02,.93,.87,.02],[-1.90,.22,.97,1.05,.95,.86,.03],[-1.45,.20,.95,1.10,.96,.78,.04],
    [-0.95,.19,.92,1.19,.96,.64,.05],[-0.35,.19,.89,1.20,.95,.62,.05],[0.15,.18,.86,.98,.95,.80,.04],[0.70,.17,.82,.88,.95,.88,.03],
    [1.50,.16,.74,.79,.94,.88,.02],[2.05,.16,.62,.66,.92,.85,.02],[2.30,.18,.50,.52,.86,.78,.02]],
    dress:function(C){ var B=C.B, D=C.D, cF=C.cF, cR=C.cR, y=lerp(cF.zb,cF.ys,0.92), x=sc_faceX(D, C.xF, y, -1), P=sc_at(D, x-0.15);
      sc_flushLamps(C, C.xF-0.42, C.xF-0.14, 8.9);
      y=lerp(cF.zb,cF.ys,0.4); x=sc_faceX(D, C.xF, y, -1);
      B.add("well", sc_rbox(0.04, 0.12, cF.w*1.3, 0.03), sc_M(x-0.01, y, 0));
      B.add("carbonS", sc_prof([[0,0],[0.4,0],[0.44,0.03],[0,0.05]], cF.w*2*1.04, 0.006), sc_M(cF.x-0.34, cF.zb-0.04, 0));
      y=lerp(cR.zb,cR.ys,0.74); x=sc_faceX(D, C.xR, y, 1);
      [-1,1].forEach(function(sd){ for(var i=0;i<2;i++) C.tails.push({g:sc_rbox(0.03, 0.06, 0.2, 0.01), m:sc_M(x-0.004, y, sd*(cR.w*0.4+i*0.24), 0,0,0)}); });
      B.add("well", sc_rbox(0.04, 0.1, cR.w*0.8, 0.02), sc_M(cR.x+0.0, lerp(cR.zb,cR.ys,0.25), 0));
      sc_mirror(C, "aero");
    }},
  /* '41 Willys: narrow cab, separate fenders (flares), tall waterfall grille, lamp pods on the fenders */
  willys41:{xr:-1.30, xf:1.30, roofF:-0.2, cowl:0.2, roofR:-0.8, deck:-1.32, dG0:-0.35, qG0:-0.75, hx:1.0, door:[-0.48,0.1], hood:[1.3,1.8], rimMat:"rimBlack", noCarbonHood:true,
    flares:[{x:-1.30, span:0.78, amt:0.17, up:0.0},{x:1.30, span:0.62, amt:0.2, up:-0.02}], rows:[
    [-2.10,.34,.78,.82,.78,.72,.03],[-2.00,.26,.86,.95,.80,.74,.04],[-1.70,.22,.88,1.05,.80,.70,.05],[-1.30,.20,.88,1.18,.79,.62,.06],
    [-0.80,.20,.88,1.24,.78,.58,.06],[-0.20,.20,.88,1.25,.78,.58,.06],[0.20,.20,.88,1.06,.78,.66,.05],[0.40,.20,.88,1.01,.76,.64,.05],
    [1.40,.22,.86,.98,.70,.60,.06],[1.95,.26,.82,.93,.62,.54,.07],[2.12,.34,.70,.78,.55,.46,.06]],
    dress:function(C){ sc_willysFace(C, "chrome"); sc_mirror(C, "aero"); }}
};
/* pro stock: long smooth nose, small lip spoiler, side-exit headers, the tall NA hood scoop (sc_hoodX) */
SC_PM.prostock={xr:-1.32, xf:1.35, roofF:-0.25, cowl:0.6, roofR:-0.9, deck:-1.5, dG0:-0.6, qG0:-1.02, hx:0.95, door:[-0.55,0.3], hood:[1.5,2.25], rimMat:"rimBlack", rows:[
  [-2.40,.34,.86,.90,.86,.82,.02],[-2.32,.26,.96,1.00,.93,.88,.02],[-1.95,.21,.97,1.02,.95,.89,.03],[-1.50,.19,.955,1.06,.955,.78,.05],
  [-0.90,.18,.92,1.16,.955,.64,.05],[-0.25,.18,.89,1.17,.95,.62,.05],[0.25,.17,.87,1.03,.95,.74,.05],[0.60,.16,.85,.92,.95,.86,.04],
  [1.20,.15,.80,.86,.94,.88,.03],[1.95,.14,.70,.74,.92,.86,.02],[2.45,.15,.56,.59,.86,.78,.02],[2.60,.18,.44,.46,.76,.68,.02]],
  dress:function(C){ var B=C.B, D=C.D, cF=C.cF, cR=C.cR, y=lerp(cF.zb,cF.ys,0.95), x=sc_faceX(D, C.xF, y, -1), P=sc_at(D, x-0.2);
    sc_flushLamps(C, C.xF-0.5, C.xF-0.2, 8.8);   /* decal lamps */
    y=lerp(cF.zb,cF.ys,0.45); x=sc_faceX(D, C.xF, y, -1);
    B.add("well", sc_rbox(0.03, 0.05, cF.w*0.9, 0.015), sc_M(x-0.01, y, 0));
    B.add("carbonS", sc_prof([[0,0],[0.42,0],[0.46,0.025],[0,0.045]], cF.w*2*1.04, 0.006), sc_M(cF.x-0.36, cF.zb-0.04, 0));
    y=lerp(cR.zb,cR.ys,0.76); x=sc_faceX(D, C.xR, y, 1);
    C.tails.push({g:sc_rbox(0.03, 0.06, cR.w*1.7, 0.012), m:sc_M(x-0.004, y, 0)});
    B.add("carbonS", sc_rbox(0.05, 0.06, cR.w*1.9, 0.015), sc_M(cR.x+0.01, lerp(cR.zb,cR.ys,0.25), 0));
    sc_mirror(C, "aero");
  },
  rear:function(C){ var P=sc_at(C.D, C.xR+0.1); C.B.add("carbonS", sc_prof([[0.14,0],[0.0,0.09],[-0.06,0.1],[-0.08,0]], P.wt*2*0.98, 0.008), sc_M(C.xR+0.1, P.yt-0.012, 0));
    [-1,1].forEach(function(sd){ C.B.add("carbonS", sc_prof([[0.1,0],[0.0,0.1],[-0.08,0.11],[-0.08,0]], 0.012, 0.002), sc_M(C.xR+0.1, P.yt-0.01, sd*P.wt*0.98)); }); }
};
/* the hood hardware these shells add: pro stock scoop, gasser injector stacks; returns the injector hat (for the flame FX) */
function sc_hoodX(B, D, kind, hx, hood, slope, cowl){
  if(kind==="pstock"){
    B.add("paint", sc_prof([[0.5,0],[0.47,0.3],[0.34,0.32],[-0.4,0.2],[-0.62,0.06],[-0.64,0]], 0.5, 0.025), sc_M(hx+0.32, hood-0.02, 0, 0,0,slope*0.5));
    B.add("well", sc_rbox(0.02, 0.2, 0.38, 0.02), sc_M(hx+0.84, hood+0.16, 0, 0,0,slope*0.5));
    return new THREE.Vector3(hx+0.6, hood+0.3, 0);
  }
  /* 8 velocity stacks in two rows through a hole in the hood */
  B.add("well", sc_rbox(0.5, 0.02, 0.36, 0.008), sc_M(hx, hood+0.005, 0));
  B.add("satin", sc_rbox(0.44, 0.06, 0.3, 0.012), sc_M(hx, hood+0.03, 0));
  for(var i=0;i<4;i++) [-1,1].forEach(function(sd){ var x=hx-0.15+i*0.1, z=sd*0.075;
    B.add("chrome", new THREE.CylinderGeometry(0.03, 0.022, 0.2, 10, 1, true), sc_M(x, hood+0.16, z));
    B.add("chrome", sc_bezel(0.03, 0.008), sc_M(x, hood+0.26, z, 0,0,PI/2)); });
  return new THREE.Vector3(hx, hood+0.3, 0);
}
/* the Willys face, shared by the pro-mod and the gasser */
function sc_willysFace(C, trim){
  var B=C.B, D=C.D, cF=C.cF, cR=C.cR, y=lerp(cF.zb,cF.ys,0.6), x=sc_faceX(D, C.xF, y, -1), i;
  B.add("well", sc_rbox(0.03, 0.3, 0.3, 0.06), sc_M(x-0.01, y, 0));
  for(i=0;i<7;i++) B.add(trim, sc_rbox(0.02, 0.28, 0.012, 0.004), sc_M(x+0.005, y, -0.12+i*0.04));
  B.add(trim, sc_rbox(0.02, 0.32, 0.34, 0.03), sc_M(x-0.02, y, 0));
  var P=sc_at(D, C.xf); [-1,1].forEach(function(sd){ var lx=C.xf+0.12, ly=P.ys+0.02, lz=sd*(P.w-0.12);
    B.add("paint", new THREE.SphereGeometry(0.085, 12, 8), sc_M(lx, ly, lz, 0,0,0, 1.5,1,1));
    sc_roundLamp(C, C.heads, lx+0.12, ly, lz, 0.06, trim); });
  y=lerp(cR.zb,cR.ys,0.6); x=sc_faceX(D, C.xR, y, 1);
  [-1,1].forEach(function(sd){ sc_roundLamp(C, C.tails, x-0.01, y, sd*cR.w*0.7, 0.045, null); });
}

/* --- gassers: nose-high on a straight axle, no bars, chrome, headers out the fenders -------------------- */
function sc_gasChassis(C){   /* straight front axle on leaf springs, shocks */
  var B=C.B, y=C.fr, zf=Math.abs(C.zf);
  B.add("chrome", sc_cyl(0.03, 10), sc_rodM(new THREE.Vector3(C.xf, y, -zf+0.04), new THREE.Vector3(C.xf, y, zf-0.04)));
  [-1,1].forEach(function(sd){ var z=sd*(zf-0.2), P=sc_at(C.D, C.xf);
    B.add("black", sc_rbox(0.95, 0.04, 0.06, 0.01), sc_M(C.xf-0.05, y+0.06, z, 0,0,-0.04));
    B.add("chrome", sc_cyl(0.022, 8), sc_rodM(new THREE.Vector3(C.xf+0.08, y+0.03, z), new THREE.Vector3(C.xf+0.12, P.zb+0.05, z)));
    B.add("black", sc_rbox(0.08, Math.max(0.05, P.zb-y-0.02), 0.08, 0.01), sc_M(C.xf+0.4, (P.zb+y)/2+0.04, z)); });
}
function sc_gasExhaust(C){   /* four short pipes per side out of the front fender, up and back */
  var P=sc_at(C.D, C.xf-0.6);
  [-1,1].forEach(function(sd){ for(var i=0;i<4;i++){
    var x0=C.xf-0.42-i*0.11, y=C.dLift||0, a=new THREE.Vector3(x0+0.05, 0.42+y, sd*(P.w-0.12)), b=new THREE.Vector3(x0, 0.45+y, sd*(P.w+0.02)), c=new THREE.Vector3(x0-0.1, 0.6+i*0.01+y, sd*(P.w+0.1));
    C.B.add("chrome", sc_pipe([a,b,c], 0.026)); sc_pipeEnd(C.B, "chrome", b, c, 0.026);
    C.tips.push(c.clone()); C.dirs.push(c.clone().sub(b).normalize()); } });
}
var SC_GAS={
  /* '55 Chevy two-door: flat face, egg-crate grille, lamps in the fender eyebrows, front bumper gone, chrome out back */
  tri55:{xr:-1.46, xf:1.46, roofF:0.1, cowl:0.5, roofR:-0.95, deck:-1.5, dG0:-0.4, qG0:-1.05, hx:1.45, door:[-0.42,0.4], hood:[1.7,2.2],
    rake:0.055, lift:-0.03, fw:0.12, fr:0.3, fz:0.1, gapF:0.04, rimR:"star", rimF:"wire", rimMat:"chrome", lettersF:false, flames:true, rows:[
    [-2.45,.32,.80,.85,.88,.84,.02],[-2.38,.26,.88,.95,.90,.86,.02],[-1.95,.23,.90,.97,.91,.87,.02],[-1.50,.22,.905,.985,.915,.87,.03],
    [-1.25,.21,.91,1.30,.915,.70,.04],[-0.95,.21,.91,1.42,.915,.66,.05],[0.10,.21,.91,1.43,.915,.66,.05],[0.50,.21,.91,1.07,.915,.80,.03],
    [0.80,.21,.905,.99,.915,.86,.02],[2.0,.22,.89,.97,.91,.87,.02],[2.40,.24,.86,.93,.90,.86,.02],[2.50,.30,.84,.88,.88,.84,.02]],
    dress:function(C){ var B=C.B, D=C.D, cF=C.cF, cR=C.cR, y=lerp(cF.zb,cF.ys,0.52), x=sc_faceX(D, C.xF, y, -1), i;
      B.add("well", sc_rbox(0.03, 0.2, cF.w*1.45, 0.02), sc_M(x-0.01, y, 0));
      for(i=0;i<3;i++) B.add("chrome", sc_rbox(0.014, 0.012, cF.w*1.4, 0.004), sc_M(x+0.006, y-0.06+i*0.06, 0));
      for(i=0;i<7;i++) B.add("chrome", sc_rbox(0.014, 0.19, 0.012, 0.004), sc_M(x+0.006, y, -cF.w*0.6+i*cF.w*0.2));
      B.add("chrome", sc_rbox(0.02, 0.23, cF.w*1.5, 0.014), sc_M(x-0.016, y, 0));
      y=lerp(cF.zb,cF.ys,0.82); x=sc_faceX(D, C.xF, y, -1);
      [-1,1].forEach(function(sd){ sc_roundLamp(C, C.heads, x+0.01, y, sd*cF.w*0.82, 0.075, "chrome"); B.add("paint", sc_rbox(0.12, 0.04, 0.2, 0.02), sc_M(x-0.03, y+0.085, sd*cF.w*0.82)); });
      y=lerp(cR.zb,cR.ys,0.66); x=sc_faceX(D, C.xR, y, 1);
      [-1,1].forEach(function(sd){ C.tails.push({g:sc_rbox(0.03, 0.15, 0.08, 0.012), m:sc_M(x-0.004, y, sd*cR.w*0.86)}); B.add("chrome", sc_rbox(0.02, 0.17, 0.1, 0.012), sc_M(x+0.004, y, sd*cR.w*0.86)); });
      sc_bumper(B, "chrome", cR.x-0.06, lerp(cR.zb,cR.ys,0.12)+0.02, cR.w+0.04, 0.11, 0.09, -1);
      sc_beltTrim(C, C.qG0, C.cowl-0.04);
      sc_mirror(C, "bullet");
    },
    rear:function(C){}, chassis:sc_gasChassis, exhaust:sc_gasExhaust},
  /* Willys gasser: the '41 coupe stock height, nose way up */
  willys:{xr:-1.30, xf:1.30, roofF:-0.2, cowl:0.2, roofR:-0.8, deck:-1.32, dG0:-0.35, qG0:-0.75, hx:1.05, door:[-0.48,0.1], hood:[1.3,1.8],
    rake:0.07, lift:-0.03, fw:0.12, fr:0.3, fz:0.16, gapF:0.04, rimR:"star", rimF:"wire", rimMat:"chrome", lettersF:false, flames:true,
    flares:[{x:-1.30, span:0.78, amt:0.17, up:0.0},{x:1.30, span:0.62, amt:0.2, up:-0.02}], rows:[
    [-2.10,.34,.78,.82,.78,.72,.03],[-2.00,.26,.86,.95,.80,.74,.04],[-1.70,.22,.88,1.07,.80,.70,.05],[-1.30,.20,.88,1.22,.79,.62,.06],
    [-0.80,.20,.88,1.34,.78,.58,.06],[-0.20,.20,.88,1.35,.78,.58,.06],[0.20,.20,.88,1.1,.78,.66,.05],[0.40,.20,.88,1.03,.76,.64,.05],
    [1.40,.22,.86,.99,.70,.60,.06],[1.95,.26,.82,.94,.62,.54,.07],[2.12,.34,.70,.78,.55,.46,.06]],
    dress:function(C){ sc_willysFace(C, "chrome"); sc_mirror(C, "bullet"); },
    rear:function(C){}, chassis:sc_gasChassis, exhaust:sc_gasExhaust}
};
