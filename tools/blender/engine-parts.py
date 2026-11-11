#!/usr/bin/env python3
"""Model the engine's small parts in Blender and export them as one file, models/eng-parts.glb.

  python3.11 -m pip install bpy        # Blender as a Python module (it needs Python 3.11)
  python3.11 tools/blender/engine-parts.py [OUT_DIR]        # default OUT_DIR: models/

The engine itself is built in code (src/vis/). These are the parts that code draws as a plain box or cylinder and that
are looked at up close on Full and Ultra: the fasteners, the hose clamp, the ignition coils, the plug boot, the
wiring plug, the oil filter, the fuel injectors, the alternator, the starter motor and the water pump. Each is modelled here in code, so a change is an edit to this file and a re-run, not a .blend to keep.
No textures: the game puts its own materials on the shapes. The file is geometry only, a few hundred KB.

Every object is named  <part>__<material key>  (the game's material table: zinc, steel, blackPlast, connGrey ...).
A part made of two materials is two objects. src/vis/engparts.js loads the file and hands the shapes to the engine
builder, which places them where the plain boxes were.

Sizes follow the plain shapes they replace, so a part drops in at the same place and scale:

  hex     flange-head bolt. Axis +Y, sits on y = 0. Unit = the head across its corners.
  stud    stud, washer and nut. Axis +Y, sits on y = 0. Unit = the nut across its corners.
  pbolt   pulley / damper bolt head. Axis +X, sits on x = 0. Unit = the head across its corners.
  rivet   dome-head rivet. Axis +Y, sits on y = 0. Unit = the dome's width.
  nutA    AN hose-end nut and its collar, round +Z. Unit = the line's radius.
  clamp   worm-drive hose clamp round +Z, the screw housing on top (+Y). Unit = the hose's radius.
  coilCop coil-on-plug top, in a box one unit each way about the origin (the builder stretches it to fit the cover):
          the mounting ear and its bush stick out to +X, the socket for the wiring plug is on the -Z half of the top.
  coilNear coil-near-plug (one per cylinder on a bracket), same unit box: fins and the plug's socket on top, the
          lead's tower to +Z.
  plug    wiring plug, same unit box: the wires leave toward -Z, the latch is on top.
  boot    spark-plug boot. Axis +Y from y = -0.5 to 0.5, radius 1 at its widest (the builder stretches it).

  oilFilter spin-on oil filter. Axis +Y from y = -0.5 (the base, against the block) to 0.5 (the domed end with its
          wrench flutes), radius 1 at the seam (the builder stretches it).
  injector port fuel injector. Axis +Y from y = -0.5 (the nozzle) to 0.5 (the end in the rail), radius 1 at the coil body.
  alternator Axis +Y from y = -0.5 (the plastic rear cover) to 0.5 (the front bearing hub, behind the pulley), radius 1 at
          the end frames; the pivot lug is on +X. Vented frames with the copper windings showing through.
  starter starter motor, in the builder's own axes, unit = the bore: flange face at x = 0, motor to +X, solenoid on top.
  waterPump belt-driven water pump body. Axis +X from x = 0 (flange) to 1 (bearing nose); across it the unit is the bore.

Shapes are written in the game's axes (three.js: Y up) and turned into Blender's (Z up) as they are made, so the
numbers here read the same as the builder's.
"""
import math, os, sys
import bpy, bmesh
from mathutils import Matrix, Vector

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "models")
TAU = math.pi * 2
PARTS = {}      # "part__mat" -> bmesh (game axes)


def bm_of(part, mat):
    key = part + "__" + mat
    if key not in PARTS:
        PARTS[key] = bmesh.new()
    return PARTS[key]


def add(bm, verts, faces, m=None):
    """verts: [(x,y,z)], faces: [[i,...]] wound counter-clockwise seen from outside."""
    vs = []
    for v in verts:
        p = Vector(v)
        if m is not None:
            p = m @ p
        vs.append(bm.verts.new(p))
    for f in faces:
        try:
            bm.faces.new([vs[i] for i in f])
        except ValueError:
            pass


def T(x=0, y=0, z=0, rx=0, ry=0, rz=0, sx=1, sy=1, sz=1):
    return (Matrix.Translation((x, y, z)) @ Matrix.Rotation(rx, 4, "X") @ Matrix.Rotation(ry, 4, "Y") @ Matrix.Rotation(rz, 4, "Z")
            @ Matrix.Diagonal((sx, sy, sz, 1)))


def lathe(bm, prof, n, m=None, phase=0.0, sides=None, cap=True):
    """Spin a profile [(r, y)] (bottom to top) round +Y. sides: a function angle index -> radius scale (a hex).
    Open ends are capped where r > 0, unless cap is False (a band)."""
    verts, faces = [], []
    for (r, y) in prof:
        for i in range(n):
            a = phase + i / n * TAU
            k = sides(i) if sides else 1.0
            verts.append((math.cos(a) * r * k, y, -math.sin(a) * r * k))
    for j in range(len(prof) - 1):
        for i in range(n):
            a0, a1 = j * n + i, j * n + (i + 1) % n
            faces.append([a0, a1, a1 + n, a0 + n])
    if cap and prof[0][0] > 1e-6:
        faces.append([i for i in range(n)][::-1])
    if cap and prof[-1][0] > 1e-6:
        faces.append([(len(prof) - 1) * n + i for i in range(n)])
    add(bm, verts, faces, m)


def hexprof(bm, prof, m=None):
    """A hex section: profile [(r across corners / 2, y, round)] where round 0..1 blends the hex toward a circle of the
    hex's across-flats radius (the chamfer a turned bolt head has)."""
    n = 12                                      # the six corners and the middle of each flat
    verts, faces = [], []
    for (r, y, rnd) in prof:
        for i in range(n):
            a = i / n * TAU
            # distance to a hexagon's edge in direction a, corners at a = 0, 60 ...
            s = (a % (TAU / 6)) - TAU / 12
            hexr = r * math.cos(TAU / 12) / math.cos(s)
            rr = hexr * (1 - rnd) + min(hexr, r * math.cos(TAU / 12)) * rnd
            verts.append((math.cos(a) * rr, y, -math.sin(a) * rr))
    for j in range(len(prof) - 1):
        for i in range(n):
            a0, a1 = j * n + i, j * n + (i + 1) % n
            faces.append([a0, a1, a1 + n, a0 + n])
    faces.append([i for i in range(n)][::-1])
    faces.append([(len(prof) - 1) * n + i for i in range(n)])
    add(bm, verts, faces, m)


def rbox(bm, sx, sy, sz, bev, m=None):
    """A box with its edges chamfered by bev (in the box's own units, before m)."""
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    b = min(bev, hx * 0.9, hy * 0.9, hz * 0.9)
    tmp = bmesh.new()
    vs = [tmp.verts.new((x, y, z)) for x in (-hx, hx) for y in (-hy, hy) for z in (-hz, hz)]
    for f in ([0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]):
        tmp.faces.new([vs[i] for i in f])
    bmesh.ops.recalc_face_normals(tmp, faces=tmp.faces)
    if b > 1e-5:
        bmesh.ops.bevel(tmp, geom=list(tmp.edges), offset=b, segments=1, affect="EDGES", profile=0.5)
    tmp.verts.index_update()
    add(bm, [tuple(v.co) for v in tmp.verts], [[v.index for v in f.verts] for f in tmp.faces], m)
    tmp.free()


# ---------------------------------------------------------------------------------------------- fasteners
def hex_bolt():
    bm = bm_of("hex", "zinc")
    # washer flange, a small fillet, then the head
    lathe(bm, [(0.60, 0.0), (0.665, 0.012), (0.665, 0.05), (0.60, 0.082), (0.47, 0.095)], 14)
    hexprof(bm, [(0.50, 0.085, 0.0), (0.50, 0.355, 0.0), (0.50, 0.385, 0.45), (0.47, 0.41, 1.0)])
    # the dished top with a raised rim, as a forged head has
    lathe(bm, [(0.34, 0.411), (0.30, 0.395), (0.0, 0.395)], 10)


def stud_nut():
    bm = bm_of("stud", "steel")
    lathe(bm, [(0.60, 0.0), (0.62, 0.012), (0.62, 0.068), (0.60, 0.08)], 14)                      # washer
    hexprof(bm, [(0.47, 0.08, 1.0), (0.50, 0.105, 0.45), (0.50, 0.44, 0.45), (0.47, 0.48, 1.0)])     # nut, chamfered both ends
    prof = [(0.25, 0.47)]
    for i in range(3):                                                                             # the thread showing above the nut
        y = 0.50 + i * 0.08
        prof += [(0.25, y), (0.215, y + 0.04)]
    prof += [(0.25, 0.75), (0.19, 0.785), (0.0, 0.785)]
    lathe(bm, prof, 8)


def pulley_bolt():
    bm = bm_of("pbolt", "steel")
    m = T(rz=-math.pi / 2)                                                                         # +Y -> +X
    lathe(bm, [(0.58, 0.0), (0.60, 0.012), (0.60, 0.05), (0.52, 0.065)], 14, m)
    hexprof(bm, [(0.50, 0.06, 0.0), (0.50, 0.25, 0.0), (0.50, 0.275, 0.45), (0.47, 0.30, 1.0)], m)
    lathe(bm, [(0.33, 0.301), (0.29, 0.288), (0.0, 0.288)], 10, m)


def rivet():
    bm = bm_of("rivet", "palu")
    prof = [(0.50, 0.0)]
    for i in range(1, 6):
        a = i / 5 * math.pi / 2
        prof.append((0.50 * math.cos(a), 0.30 * math.sin(a) + 0.02))
    lathe(bm, prof, 10)


def an_nut():
    bm = bm_of("nutA", "zinc")
    m = T(rx=math.pi / 2)                                                                          # +Y -> +Z
    hexprof(bm, [(1.78, -0.80, 1.0), (1.90, -0.66, 0.4), (1.90, 0.66, 0.4), (1.78, 0.80, 1.0)], m)
    lathe(bm, [(1.50, 0.78), (1.50, 1.02), (1.36, 1.08), (1.36, 1.20), (1.50, 1.26), (1.50, 1.44), (1.38, 1.50)], 12, m)


def hose_clamp():
    bm = bm_of("clamp", "chrome")
    # the band: a flat strip round +Z, a hair proud of the hose, with a rolled edge each side
    R, w, t = 1.035, 0.36, 0.035
    lathe(bm, [(R + t, -w / 2), (R + t * 1.6, -w / 2 + 0.03), (R + t, -w / 2 + 0.06), (R + t, w / 2 - 0.06), (R + t * 1.6, w / 2 - 0.03), (R + t, w / 2)], 28, T(rx=math.pi / 2), cap=False)
    # the band's free tail lying over the top toward -X
    rbox(bm, 0.75, 0.03, w * 0.92, 0.006, T(-0.42, R + 0.11, 0, rz=0.30))
    # screw housing: a saddle with a raised bridge
    rbox(bm, 0.46, 0.22, 0.40, 0.03, T(0, R + 0.13, 0))
    rbox(bm, 0.30, 0.10, 0.44, 0.02, T(0.02, R + 0.27, 0))
    # the worm screw along X: shank, slotted hex head
    lathe(bm, [(0.085, -0.30), (0.085, 0.30)], 10, T(0.02, R + 0.19, 0, rz=-math.pi / 2))
    hexprof(bm, [(0.15, 0.0, 0.3), (0.15, 0.13, 0.3), (0.13, 0.155, 1.0)], T(0.30, R + 0.19, 0, rz=-math.pi / 2))
    rbox(bm, 0.03, 0.035, 0.27, 0.0, T(0.462, R + 0.19, 0))                                         # the screwdriver slot (a dark bar)


# ---------------------------------------------------------------------------------------------- ignition and wiring
def coil_on_plug():
    b = bm_of("coilCop", "blackPlast")
    # flange that sits on the cover, the potted body, three cooling ribs on the outboard half of the top
    rbox(b, 0.96, 0.20, 0.92, 0.05, T(0, -0.40, 0))
    rbox(b, 0.70, 0.62, 0.80, 0.07, T(-0.04, -0.02, 0))
    for i in range(3):
        rbox(b, 0.10, 0.10, 0.34, 0.02, T(-0.22 + i * 0.18, 0.33, 0.20))
    # the socket the wiring plug sits in: a low shroud on the inboard half of the top
    rbox(b, 0.50, 0.12, 0.46, 0.03, T(-0.09, 0.33, -0.25))
    # mounting ear to +X with a steel bush for the bolt
    rbox(b, 0.30, 0.16, 0.42, 0.04, T(0.52, -0.32, 0.21))
    lathe(bm_of("coilCop", "zinc"), [(0.16, 0.0), (0.16, 0.10), (0.10, 0.10), (0.10, 0.0)], 14, T(0.56, -0.26, 0.21))
    # part-number label: a thin raised pad on the body's outboard wall
    rbox(bm_of("coilCop", "connGrey"), 0.44, 0.26, 0.02, 0.0, T(-0.04, -0.04, 0.405))


def coil_near_plug():
    b = bm_of("coilNear", "blackPlast")
    rbox(b, 0.92, 0.74, 0.86, 0.06, T(0, -0.13, 0))                                                 # potted body
    for i in range(3):                                                                              # cooling fins on one half of the top
        rbox(b, 0.07, 0.24, 0.74, 0.012, T(0.12 + i * 0.13, 0.34, 0))
    rbox(b, 0.44, 0.14, 0.52, 0.03, T(-0.17, 0.30, -0.16))                                          # the socket the wiring plug sits in
    # the lead's tower to +Z: a stepped barrel
    lathe(b, [(0.26, 0.0), (0.26, 0.20), (0.21, 0.24), (0.21, 0.52), (0.24, 0.56), (0.24, 0.66), (0.15, 0.68)], 16, T(0, 0.0, 0.40, rx=math.pi / 2))
    # two mounting lugs with steel bushes, front and rear
    z = bm_of("coilNear", "zinc")
    for sx in (-1, 1):
        rbox(b, 0.16, 0.30, 0.34, 0.03, T(sx * 0.53, -0.32, 0.10))
        lathe(z, [(0.10, 0.0), (0.10, 0.34), (0.06, 0.34), (0.06, 0.0)], 12, T(sx * 0.55, -0.49, 0.10))
    # the iron core's laminations: a steel bar showing along the inboard wall
    rbox(bm_of("coilNear", "steel"), 0.60, 0.30, 0.03, 0.0, T(0, -0.14, -0.435))


def wiring_plug():
    b = bm_of("plug", "connGrey")
    rbox(b, 0.92, 0.72, 0.66, 0.06, T(0, -0.10, 0.14))                                              # housing
    rbox(b, 0.78, 0.56, 0.36, 0.04, T(0, -0.12, -0.30))                                             # the wire-seal end, a step smaller
    rbox(b, 0.34, 0.14, 0.50, 0.03, T(0, 0.31, 0.10))                                               # latch arm
    rbox(b, 0.40, 0.10, 0.12, 0.02, T(0, 0.40, 0.30))                                               # latch thumb pad
    for sx in (-1, 1):                                                                              # grip ribs each side
        for i in range(3):
            rbox(b, 0.05, 0.50, 0.07, 0.01, T(sx * 0.475, -0.10, -0.02 + i * 0.14))
    # the seal: a coloured grommet where the wires leave
    rbox(bm_of("plug", "rubberFlat"), 0.62, 0.40, 0.08, 0.02, T(0, -0.12, -0.50))


def plug_boot():
    b = bm_of("boot", "rubberFlat")
    # from the plug end (y -0.5) to the lead end (+0.5): a flared skirt, three sealing ribs, a neck onto the lead
    prof = [(0.78, -0.50), (0.96, -0.46), (1.00, -0.36), (0.86, -0.30)]
    for i in range(3):
        y = -0.24 + i * 0.13
        prof += [(0.84, y), (0.96, y + 0.04), (0.84, y + 0.09)]
    prof += [(0.80, 0.16), (0.66, 0.28), (0.60, 0.44), (0.52, 0.50), (0.0, 0.50)]
    lathe(b, prof, 16)


# ---------------------------------------------------------------------------------------------- oil and fuel
def oil_filter():
    b = bm_of("oilFilter", "paintBlue")
    lathe(b, [(0.0, -0.50), (0.90, -0.50)], 28, cap=False)                                          # base plate end
    # the rolled seam where the can is crimped to its base, then the plain wall
    lathe(b, [(0.90, -0.50), (1.00, -0.47), (1.00, -0.43), (0.955, -0.40), (0.955, 0.26)], 28, cap=False)
    # wrench flutes round the outer end: every other station pulled in
    lathe(b, [(0.955, 0.26), (0.955, 0.44)], 28, cap=False, sides=lambda i: 1.0 - 0.055 * (i % 2))
    lathe(b, [(0.955, 0.44), (0.89, 0.44)], 28, cap=False)
    lathe(b, [(0.89, 0.44), (0.80, 0.475), (0.50, 0.50), (0.0, 0.50)], 28, cap=False)                # the domed end


def injector():
    # nozzle end (-Y): the spray tip, the lower O-ring land and the steel body that sits in the port
    lathe(bm_of("injector", "steel"), [(0.34, -0.50), (0.46, -0.47), (0.46, -0.38), (0.66, -0.36), (0.66, -0.29), (0.52, -0.27),
                                       (0.52, -0.12)], 12)
    # the moulded coil body, a waist, and the upper O-ring land that pushes into the rail
    lathe(bm_of("injector", "blackPlast"), [(0.52, -0.12), (0.92, -0.08), (0.92, 0.20), (0.62, 0.24), (0.62, 0.34), (0.74, 0.36),
                                            (0.74, 0.45), (0.54, 0.50), (0.0, 0.50)], 12, cap=False)
    lathe(bm_of("injector", "rubberFlat"), [(0.70, -0.345), (0.76, -0.325), (0.70, -0.305)], 12, cap=False)   # lower O-ring


def spokes(bm, n, r0, y0, r1, y1, w, t, phase=0.0):
    """n flat spokes round +Y, each from (r0, y0) to (r1, y1): the windows of a vented end frame are the gaps."""
    ln = math.hypot(r1 - r0, y1 - y0)
    for i in range(n):
        rbox(bm, ln, t, w, t * 0.25, T(ry=phase + i / n * TAU) @ T((r0 + r1) / 2, (y0 + y1) / 2, 0, rz=math.atan2(y1 - y0, r1 - r0)))


def alternator():
    c, cu = bm_of("alternator", "calu"), bm_of("alternator", "copper")
    # the laminated stator, clamped between the two cast end frames
    lathe(bm_of("alternator", "steel"), [(0.0, -0.13), (0.955, -0.13), (0.955, 0.13), (0.0, 0.13)], 24)
    for s in (1, -1):
        ring = [(0.90, 0.12), (1.0, 0.12), (1.0, 0.21), (0.97, 0.25), (0.90, 0.25), (0.90, 0.12)]
        lathe(c, [(r, y * s) for (r, y) in ring], 24, cap=False)
    # front frame: spokes over the windings to the bearing hub
    spokes(c, 8, 0.97, 0.21, 0.38, 0.45, 0.20, 0.07)
    lathe(c, [(0.0, 0.36), (0.42, 0.36), (0.42, 0.44), (0.34, 0.50), (0.0, 0.50)], 20)
    lathe(cu, [(0.0, 0.10), (0.86, 0.10), (0.90, 0.22), (0.80, 0.32), (0.50, 0.35), (0.0, 0.35)], 24)
    # rear frame: shorter ribs down to the plastic cover over the rectifier and regulator
    spokes(c, 8, 0.97, -0.21, 0.72, -0.40, 0.20, 0.07, TAU / 16)
    lathe(cu, [(0.0, -0.34), (0.80, -0.34), (0.90, -0.24), (0.86, -0.10), (0.0, -0.10)], 24)
    lathe(bm_of("alternator", "blackPlast"), [(0.0, -0.50), (0.66, -0.50), (0.74, -0.46), (0.74, -0.30), (0.0, -0.30)], 20)
    # the four through-bolts that hold the frames together, in bosses on the rim
    for i in range(4):
        a = TAU / 8 + i * TAU / 4
        m = T(math.cos(a) * 0.99, 0, -math.sin(a) * 0.99)
        lathe(c, [(0.085, -0.25), (0.085, 0.25)], 8, m)
        hexprof(bm_of("alternator", "zinc"), [(0.075, 0.25, 0.0), (0.075, 0.29, 0.5)], m)
    # pivot lug (+X, toward the bracket) and the adjuster lug opposite
    for (sx, r) in ((1, 0.17), (-1, 0.13)):
        lathe(c, [(r, 0.10), (r, 0.36)], 12, T(sx * 1.17, 0, 0))
        rbox(c, 0.30, 0.22, r * 1.5, 0.02, T(sx * 1.02, 0.23, 0))


def starter():
    """Game axes, unit = the bore: the flange face is x = 0, the motor runs to +X, the solenoid rides on top."""
    ax = lambda x=0, y=0, z=0: T(x, y, z, rz=-math.pi / 2)
    c = bm_of("starter", "calu")
    lathe(bm_of("starter", "dark"), [(0.0, 0.04), (0.25, 0.04), (0.25, 0.62), (0.0, 0.62)], 20, ax())          # field case
    lathe(c, [(0.0, 0.62), (0.256, 0.62), (0.256, 0.68), (0.22, 0.72), (0.10, 0.735), (0.0, 0.735)], 20, ax())   # brush end cap
    lathe(c, [(0.0, -0.17), (0.07, -0.17), (0.14, -0.15), (0.18, -0.10), (0.21, -0.02), (0.27, 0.0), (0.27, 0.05), (0.0, 0.05)], 20, ax())   # drive-end housing, the nose through the flange
    for sz in (1, -1):
        hexprof(bm_of("starter", "zinc"), [(0.032, 0.72, 0.0), (0.032, 0.755, 0.5)], ax(0, 0, sz * 0.17))       # through-bolt heads
    # solenoid, its saddle on the drive housing, the terminal cap with two studs and the strap down to the field case
    lathe(bm_of("starter", "steel"), [(0.0, 0.08), (0.13, 0.08), (0.13, 0.46), (0.115, 0.48), (0.0, 0.48)], 16, ax(0, 0.33))
    lathe(c, [(0.0, -0.05), (0.08, -0.05), (0.135, -0.025), (0.145, 0.01), (0.145, 0.09), (0.0, 0.09)], 16, ax(0, 0.33))
    rbox(c, 0.11, 0.26, 0.24, 0.02, T(0.035, 0.20, 0))
    lathe(bm_of("starter", "blackPlast"), [(0.0, 0.48), (0.118, 0.48), (0.118, 0.54), (0.09, 0.56), (0.0, 0.56)], 16, ax(0, 0.33))
    for sy in (1, -1):
        lathe(bm_of("starter", "brass"), [(0.02, 0.55), (0.02, 0.63)], 8, ax(0, 0.33 + sy * 0.058))
        hexprof(bm_of("starter", "zinc"), [(0.036, 0.565, 0.3), (0.036, 0.595, 0.3)], ax(0, 0.33 + sy * 0.058))
    rbox(bm_of("starter", "copper"), 0.012, 0.12, 0.05, 0.0, T(0.585, 0.262, 0))


def water_pump():
    """Axis +X from x = 0 (the flange on the front cover) to x = 1 (the bearing nose behind the pulley); across it the
    unit is the bore. The builder stretches x to the gap it has, and puts the flange bolts in itself."""
    c = bm_of("waterPump", "calu")
    ax = lambda x=0, y=0, z=0: T(x, y, z, rz=-math.pi / 2)
    lathe(c, [(0.0, 0.0), (0.36, 0.0), (0.36, 0.10), (0.325, 0.15), (0.34, 0.24), (0.34, 0.44), (0.30, 0.55), (0.20, 0.64),
              (0.17, 0.70), (0.17, 0.95), (0.145, 1.0), (0.0, 1.0)], 24, ax())
    for i in range(5):                                                                              # bolt bosses round the flange
        a = TAU / 10 + i * TAU / 5
        lathe(c, [(0.062, 0.0), (0.062, 0.13)], 10, ax(0, math.cos(a) * 0.375, math.sin(a) * 0.375))
    for i in range(4):                                                                              # gussets from the volute up the bearing snout
        a = TAU / 8 + i * TAU / 4
        rbox(c, 0.42, 0.20, 0.035, 0.008, T(rx=a) @ T(0.66, 0.20, 0, rz=-0.52))


# ---------------------------------------------------------------------------------------------- write
def write():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    to_bl = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))                        # game (x,y,z) -> Blender (x,-z,y)
    tris = 0
    for key in sorted(PARTS):
        bm = PARTS[key]
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bmesh.ops.transform(bm, matrix=to_bl, verts=bm.verts)
        bmesh.ops.triangulate(bm, faces=bm.faces)
        # box-mapped texture coordinates, one unit of the part = one repeat (the game's painted metals tile)
        uv = bm.loops.layers.uv.new("UVMap")
        for f in bm.faces:
            n = f.normal
            ax = max(range(3), key=lambda i: abs(n[i]))
            for lp in f.loops:
                c = lp.vert.co
                lp[uv].uv = (c[(ax + 1) % 3], c[(ax + 2) % 3])
        me = bpy.data.meshes.new(key)
        bm.to_mesh(me)
        tris += len(me.polygons)
        bm.free()
        for p in me.polygons:
            p.use_smooth = True
        me.set_sharp_from_angle(angle=math.radians(38))
        o = bpy.data.objects.new(key, me)
        bpy.context.collection.objects.link(o)
    path = os.path.abspath(os.path.join(OUT, "eng-parts.glb"))
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True, export_apply=True,
                              export_texcoords=True, export_normals=True, export_materials="NONE",
                              export_cameras=False, export_lights=False, export_animations=False)
    print("wrote", path, os.path.getsize(path), "bytes,", len(PARTS), "objects,", tris, "triangles")


if __name__ == "__main__":
    hex_bolt(); stud_nut(); pulley_bolt(); rivet(); an_nut(); hose_clamp()
    coil_on_plug(); coil_near_plug(); wiring_plug(); plug_boot()
    oil_filter(); injector()
    alternator(); starter(); water_pump()
    write()
