#!/usr/bin/env python3
"""Build the Pikes Peak props in Blender and export them as .glb files for models/.

  python3.11 -m pip install bpy        # Blender as a Python module (bpy 5.0.1 was used; it needs Python 3.11)
  python3.11 tools/blender/hill-props.py [OUT_DIR]        # default OUT_DIR: models/

Everything is modelled here in code, so a change is an edit to this file and a re-run, not a .blend to keep.
No image textures: flat Principled colours only, so each file stays a few tens of KB.
Units are metres. Blender is Z-up; the glTF export turns that into three.js Y-up, with Blender -Y becoming three's +Z.

  hill-summit.glb   the summit visitor centre: a long low granite-and-glass house, a steel roof, a terrace, a mast.
                    Origin at the middle of its floor. Long side on X, the glass front faces Blender -Y (three +Z).
  hill-start.glb    the start line: an aluminium truss gantry over the 8 m road (towers at +-5.4 m, the START banner
                    is a canvas label the game hangs in front of the beam) and the timing hut 5 m back on the right.
                    Origin on the road centre line; the road runs along X, the car drives toward +X.
  hill-marshal.glb  a corner marshal post: a pop-up canopy, straw bales, a flag stand, an extinguisher.
                    Origin at the canopy's middle; the road side faces Blender -Y (three +Z).
  hill-rock.glb     one granite boulder, about 1 m radius (mesh "Rock"), the shape the game instances for every rock.
  hill-fir.glb      a fir in two levels of detail: FirHi + TrunkHi (Ultra, near the camera), FirLo + TrunkLo (Full,
                    and Ultra far away). About 11.5 m tall at scale 1, base of the foliage 2.2 m round. The game uses
                    the geometry only; its own materials and per-tree colours go on top.
"""
import math, os, random, sys
import bpy, bmesh
from mathutils import Vector, noise

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "models")
TAU = math.pi * 2


MATS = {}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def mat(name, rgb, rough=0.8, metal=0.0, emit=None):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*rgb, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if emit:
        p.inputs["Emission Color"].default_value = (*emit, 1)
        p.inputs["Emission Strength"].default_value = 2.0
    MATS[name] = m
    return m


def obj_from_bm(bm, name, m=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    if m:
        me.materials.append(m)
    return o


def box(name, size, loc, m, rz=0.0, ry=0.0, rx=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    o = obj_from_bm(bm, name, m)
    o.location = loc
    o.rotation_euler = (rx, ry, rz)
    return o


def cyl(name, r, h, loc, m, seg=8, r2=None, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    o = obj_from_bm(bm, name, m)
    o.location = loc
    o.rotation_euler = rot
    return o


def rod(name, a, b, r, m, seg=6):
    """a tube from point a to point b"""
    a, b = Vector(a), Vector(b)
    d = b - a
    o = cyl(name, r, d.length, (a + b) / 2, m, seg)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return o


def join(objs, name, smooth_angle=None):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if smooth_angle is not None:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth_angle))
    else:
        bpy.ops.object.shade_flat()
    return o


def export(name):
    path = os.path.abspath(os.path.join(OUT, name))
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True, export_apply=True,
                              export_texcoords=False, export_normals=True, export_materials="EXPORT",
                              export_cameras=False, export_lights=False, export_animations=False)
    print("wrote", path, os.path.getsize(path), "bytes")


# ------------------------------------------------------------------ summit visitor centre
def summit():
    reset()
    granite = mat("granite", (0.36, 0.29, 0.26), 0.9)
    stone = mat("stone", (0.30, 0.25, 0.22), 0.95)
    steel = mat("roof steel", (0.11, 0.095, 0.085), 0.55, 0.6)
    trim = mat("trim", (0.05, 0.05, 0.055), 0.4, 0.7)
    glass = mat("glass", (0.03, 0.05, 0.07), 0.06, 0.5)
    deck = mat("deck", (0.24, 0.18, 0.13), 0.85)
    conc = mat("concrete", (0.42, 0.40, 0.37), 0.95)
    mast = mat("mast", (0.55, 0.56, 0.58), 0.4, 0.8)
    red = mat("beacon", (0.6, 0.02, 0.02), 0.5, 0.0, (1.0, 0.05, 0.02))
    P = []
    L, D, H = 30.0, 14.0, 4.6
    # plinth: rough granite courses stepping in, so it reads as built from the mountain
    P.append(box("plinth", (L + 2.4, D + 1.6, 0.9), (0, 0.6, -0.35), granite))
    P.append(box("plinth2", (L + 1.2, D + 0.6, 0.5), (0, 0.4, 0.3), stone))
    # back wall and the two ends in stone, set in short rough courses
    rnd = random.Random(7)
    for k in range(6):
        z = 0.55 + k * 0.62
        P.append(box("back%d" % k, (L, 0.9, 0.62), (rnd.uniform(-0.06, 0.06), D / 2 - 0.45 + rnd.uniform(-0.05, 0.05), z + 0.31), stone if k % 2 else granite))
        for s in (-1, 1):
            P.append(box("end%d%d" % (k, s), (0.9, D - 2.4, 0.62), (s * (L / 2 - 0.45) + rnd.uniform(-0.05, 0.05), 0.7, z + 0.31), granite if k % 2 else stone))
    # a stone chimney / stair core breaking the roofline
    P.append(box("core", (4.2, 3.6, 6.6), (-8.5, 3.6, 3.3), granite))
    P.append(box("corecap", (4.6, 4.0, 0.3), (-8.5, 3.6, 6.65), trim))
    # glass front: a curtain wall leaning out a few degrees, black mullions every 1.5 m
    lean = math.radians(6)
    gh = H - 0.5
    gy = -D / 2 + 1.2
    g = box("glass", (L - 1.8, 0.06, gh), (0, gy - math.sin(lean) * gh / 2, 0.55 + gh / 2), glass, rx=-lean)
    P.append(g)
    n = 19
    for i in range(n):
        x = -L / 2 + 0.9 + i * (L - 1.8) / (n - 1)
        P.append(box("mul%d" % i, (0.12, 0.16, gh + 0.1), (x, gy - math.sin(lean) * gh / 2 - 0.05, 0.55 + gh / 2), trim, rx=-lean))
    P.append(box("transom", (L - 1.8, 0.16, 0.12), (0, gy - math.sin(lean) * 1.0 - 0.05, 0.55 + 2.4), trim, rx=-lean))
    P.append(box("sill", (L - 1.2, 0.5, 0.2), (0, gy, 0.6), trim))
    # roof: one thin steel slab rising toward the view, a deep overhang over the glass, a dark fascia
    roof_t = math.radians(4)
    P.append(box("roof", (L + 3.0, D + 4.0, 0.35), (0, -0.6, H + 0.5), steel, rx=roof_t))
    P.append(box("fascia", (L + 3.0, 0.12, 0.7), (0, -D / 2 - 2.6, H + 0.5 + math.sin(roof_t) * (D / 2 + 2.0)), trim))
    # roof-top plant: two vent boxes and a rail
    P.append(box("vent1", (3.0, 2.0, 0.9), (6.0, 3.0, H + 1.1), conc))
    P.append(box("vent2", (1.6, 1.6, 0.7), (10.0, 2.5, H + 1.0), conc))
    # terrace in front of the glass: deck, steps, posts and a cable rail
    P.append(box("terrace", (L + 1.0, 4.4, 0.35), (0, -D / 2 - 1.2, 0.38), deck))
    for k in range(3):
        P.append(box("step%d" % k, (6.0, 0.45, 0.18), (9.0, -D / 2 - 3.6 - k * 0.45, 0.30 - k * 0.18), conc))
    for i in range(16):
        x = -L / 2 + 0.6 + i * (L - 1.2) / 15
        if 6.0 < x < 12.0:
            continue
        P.append(box("post%d" % i, (0.08, 0.08, 1.05), (x, -D / 2 - 3.25, 1.05), trim))
    for zz in (0.85, 1.25, 1.55):
        for a, b in ((-L / 2 + 0.6, 5.8), (12.2, L / 2 - 0.6)):
            P.append(rod("rail", (a, -D / 2 - 3.25, zz), (b, -D / 2 - 3.25, zz), 0.025, mast, 4))
    # the radio mast behind the house: a three-leg lattice with a red beacon
    mx, my, mh = 11.0, D / 2 + 3.5, 16.0
    legs = [(mx + 0.6 * math.cos(a), my + 0.6 * math.sin(a)) for a in (0, TAU / 3, 2 * TAU / 3)]
    for j, (x, y) in enumerate(legs):
        P.append(rod("leg%d" % j, (x, y, 0), (mx + (x - mx) * 0.4, my + (y - my) * 0.4, mh), 0.05, mast, 5))
    for k in range(8):
        z0, z1 = k * mh / 8, (k + 1) * mh / 8
        f0, f1 = 1 - 0.6 * z0 / mh, 1 - 0.6 * z1 / mh
        for j in range(3):
            a, b = legs[j], legs[(j + 1) % 3]
            P.append(rod("br", (mx + (a[0] - mx) * f0, my + (a[1] - my) * f0, z0), (mx + (b[0] - mx) * f1, my + (b[1] - my) * f1, z1), 0.02, mast, 4))
    P.append(cyl("beacon", 0.18, 0.35, (mx, my, mh + 0.2), red, 8))
    P.append(box("mastpad", (2.2, 2.2, 0.3), (mx, my, 0.0), conc))
    # a plaque stone by the steps
    P.append(box("plaque", (1.4, 0.6, 1.1), (4.6, -D / 2 - 4.4, 0.45), granite, rz=0.2))
    join(P, "SummitHouse", 50)
    export("hill-summit.glb")


# ------------------------------------------------------------------ start line
def start():
    reset()
    alu = mat("aluminium", (0.72, 0.73, 0.75), 0.32, 0.85)
    black = mat("black", (0.03, 0.03, 0.035), 0.6)
    conc = mat("ballast", (0.48, 0.46, 0.42), 0.95)
    red = mat("red lamp", (0.5, 0.02, 0.02), 0.4, 0.0, (1.0, 0.04, 0.02))
    green = mat("green lamp", (0.02, 0.4, 0.06), 0.4, 0.0, (0.05, 1.0, 0.2))
    wall = mat("hut wall", (0.70, 0.66, 0.57), 0.85)
    roof = mat("hut roof", (0.24, 0.15, 0.10), 0.75, 0.2)
    glass = mat("hut glass", (0.04, 0.06, 0.08), 0.1, 0.4)
    stripe = mat("orange", (0.85, 0.32, 0.05), 0.6)
    P = []
    TW, TH, Y = 0.5, 6.3, 5.4      # tower width, height, offset from the centre line

    def tower(yc):
        c = [(-TW / 2, yc - TW / 2), (TW / 2, yc - TW / 2), (TW / 2, yc + TW / 2), (-TW / 2, yc + TW / 2)]
        for x, y in c:
            P.append(rod("chord", (x, y, 0.3), (x, y, TH), 0.04, alu, 6))
        k, step = 0, 0.5
        z = 0.3
        while z < TH - 0.01:
            z1 = min(TH, z + step)
            for j in range(4):
                a, b = c[j], c[(j + 1) % 4]
                if k % 2:
                    a, b = b, a
                P.append(rod("diag", (a[0], a[1], z), (b[0], b[1], z1), 0.018, alu, 4))
            z, k = z1, k + 1
        P.append(box("ballast", (1.0, 1.0, 0.45), (0, yc, 0.15), conc))
        P.append(box("cap", (0.62, 0.62, 0.08), (0, yc, TH + 0.04), alu))

    tower(-Y)
    tower(Y)
    # the beam: a box truss across the road, banner hung on its front (the game's canvas label)
    z0, z1, d = 4.85, 5.95, 0.25
    for x in (-d, d):
        for z in (z0, z1):
            P.append(rod("bchord", (x, -Y, z), (x, Y, z), 0.045, alu, 6))
    n = 22
    for i in range(n):
        y0, y1 = -Y + i * 2 * Y / n, -Y + (i + 1) * 2 * Y / n
        for x in (-d, d):
            P.append(rod("bd", (x, y0, z0 if i % 2 else z1), (x, y1, z1 if i % 2 else z0), 0.018, alu, 4))
        for z in (z0, z1):
            P.append(rod("bt", (-d, y0, z), (d, y1, z), 0.016, alu, 4))
    # timing lights on the right-hand tower, facing the car
    P.append(box("lampbox", (0.25, 0.5, 1.2), (-0.4, -Y, 3.2), black))
    for k, m in enumerate((red, red, green)):
        P.append(cyl("lamp%d" % k, 0.13, 0.06, (-0.54, -Y, 3.6 - k * 0.38), m, 12, rot=(0, math.pi / 2, 0)))
    # photocell posts on the line
    for s in (-1, 1):
        P.append(rod("eye", (0.0, s * 4.6, 0), (0.0, s * 4.6, 0.75), 0.04, black, 6))
        P.append(box("eyehead", (0.12, 0.12, 0.16), (0.0, s * 4.6, 0.8), stripe))
    # timing hut, 5 m back and 10 m right of the line, window toward the road
    hx, hy = -5.0, -10.0
    P.append(box("hut", (3.2, 2.4, 2.5), (hx, hy, 1.25), wall))
    P.append(box("hutroof", (3.8, 3.1, 0.18), (hx, hy + 0.1, 2.68), roof, rx=-math.radians(7)))
    P.append(box("hutwin", (2.2, 0.06, 0.9), (hx, hy + 1.22, 1.7), glass))
    P.append(box("hutsill", (2.4, 0.3, 0.08), (hx, hy + 1.32, 1.22), wall))
    P.append(box("hutdoor", (0.06, 0.9, 2.0), (hx - 1.62, hy - 0.3, 1.0), roof))
    P.append(box("hutband", (3.22, 2.42, 0.18), (hx, hy, 2.2), stripe))
    P.append(box("hutbase", (3.6, 2.8, 0.25), (hx, hy, 0.0), conc))
    P.append(rod("antenna", (hx + 1.2, hy - 0.8, 2.7), (hx + 1.2, hy - 0.8, 4.4), 0.02, alu, 4))
    join(P, "StartGantry", 50)
    export("hill-start.glb")


# ------------------------------------------------------------------ corner marshal post
def marshal():
    reset()
    frame = mat("canopy frame", (0.65, 0.66, 0.68), 0.35, 0.8)
    cloth = mat("canopy", (0.80, 0.33, 0.06), 0.85)
    white = mat("canopy trim", (0.85, 0.84, 0.80), 0.85)
    straw = mat("straw", (0.66, 0.52, 0.26), 1.0)
    yellow = mat("flag", (0.95, 0.75, 0.05), 0.8)
    red = mat("extinguisher", (0.62, 0.04, 0.03), 0.4, 0.2)
    black = mat("black", (0.04, 0.04, 0.045), 0.6)
    P = []
    s = 1.5
    for x in (-s, s):
        for y in (-s, s):
            P.append(rod("leg", (x, y, -1.0), (x, y, 2.1), 0.03, frame, 5))   # the legs run a metre below so a slope never shows a gap
    # canopy: a low four-sided pyramid with a valance round the edge
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, 2.1)) for x, y in ((-s - 0.1, -s - 0.1), (s + 0.1, -s - 0.1), (s + 0.1, s + 0.1), (-s - 0.1, s + 0.1))]
    top = bm.verts.new((0, 0, 2.75))
    for i in range(4):
        bm.faces.new((vs[i], vs[(i + 1) % 4], top))
    o = obj_from_bm(bm, "roof", cloth)
    P.append(o)
    for i, (a, b) in enumerate((((0, -s - 0.1), (3.2, 0.03)), ((0, s + 0.1), (3.2, 0.03)), ((-s - 0.1, 0), (0.03, 3.2)), ((s + 0.1, 0), (0.03, 3.2)))):
        P.append(box("val%d" % i, (b[0] + 0.03, b[1] + 0.03, 0.25), (a[0], a[1], 1.98), white if i == 0 else cloth))
    # straw bales along the road side
    rnd = random.Random(3)
    for i, x in enumerate((-1.7, -0.6, 0.5, 1.6)):
        P.append(box("bale%d" % i, (1.05, 0.5, 0.45), (x + rnd.uniform(-0.05, 0.05), -s - 0.9, 0.2), straw, rz=rnd.uniform(-0.06, 0.06)))
    P.append(box("bale4", (1.05, 0.5, 0.45), (-1.1, -s - 0.9, 0.62), straw, rz=0.05))
    # a flag stand: post and a furled yellow flag
    P.append(rod("flagpole", (1.3, -s - 0.4, -0.5), (1.3, -s - 0.4, 2.2), 0.02, black, 4))
    P.append(box("flag", (0.04, 0.55, 0.42), (1.3, -s - 0.12, 1.95), yellow))
    # an extinguisher and a chair
    P.append(cyl("ext", 0.09, 0.5, (-1.2, -0.9, 0.25), red, 10))
    P.append(cyl("exttop", 0.03, 0.1, (-1.2, -0.9, 0.55), black, 6))
    P.append(box("seat", (0.45, 0.45, 0.05), (0.4, 0.4, 0.45), black))
    P.append(box("back", (0.45, 0.05, 0.45), (0.4, 0.62, 0.7), black, rx=0.15))
    for x in (0.2, 0.6):
        for y in (0.2, 0.6):
            P.append(rod("cleg", (x, y, -0.2), (x, y, 0.45), 0.015, frame, 4))
    join(P, "MarshalPost", 50)
    export("hill-marshal.glb")


# ------------------------------------------------------------------ boulder
def rock():
    reset()
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    for v in bm.verts:
        p = v.co.copy()
        k = 1.0 + 0.32 * noise.noise(p * 1.3 + Vector((3.1, 1.7, 0.4))) + 0.12 * noise.noise(p * 3.1)
        # a few flat cleavage planes, as granite breaks
        for nrm, off in (((0.7, 0.2, 0.68), 0.72), ((-0.5, 0.8, 0.3), 0.8), ((0.1, -0.9, 0.2), 0.76)):
            nv = Vector(nrm).normalized()
            d = (p * k).dot(nv)
            if d > off:
                k -= (d - off) / max(0.2, p.dot(nv))
        if p.z < -0.35:                       # a flat base to sit on
            p.z = -0.35 - (p.z + 0.35) * 0.15
        v.co = p * k
    o = obj_from_bm(bm, "Rock", mat("rock", (0.5, 0.5, 0.5), 0.92))
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    m = o.modifiers.new("dec", "DECIMATE")
    m.ratio = 0.8
    bpy.ops.object.modifier_apply(modifier="dec")
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(38))
    export("hill-rock.glb")


# ------------------------------------------------------------------ fir
def fir_parts(tag, whorls, seg, tips, z0, z1, r0, droop, seed):
    rnd = random.Random(seed)
    bm = bmesh.new()
    for w in range(whorls):
        f = w / max(1, whorls - 1)
        zb = z0 + (z1 - z0 - 2.6) * f ** 0.92
        r = r0 * (1 - 0.78 * f) * rnd.uniform(0.93, 1.05)
        h = (3.4 if w < whorls - 1 else 3.6) * (1 - 0.35 * f)
        top = bm.verts.new((0, 0, zb + h))
        ring = []
        for i in range(seg):
            a = i / seg * TAU + rnd.uniform(-0.12, 0.12) + w * 0.7
            tip = (i % 2 == 0) if tips else True
            rr = r * (1.0 if tip else 0.62) * rnd.uniform(0.92, 1.08)
            dz = -droop * (1.0 if tip else 0.25) * rnd.uniform(0.8, 1.2)
            ring.append(bm.verts.new((math.cos(a) * rr, math.sin(a) * rr, zb + dz)))
        for i in range(seg):
            bm.faces.new((ring[i], ring[(i + 1) % seg], top))
        inner = bm.verts.new((0, 0, zb + h * 0.18))       # close the underside so it shades from below
        for i in range(seg):
            bm.faces.new((ring[(i + 1) % seg], ring[i], inner))
    o = obj_from_bm(bm, "Fir" + tag, mat("foliage", (0.5, 0.5, 0.5), 0.95))
    return o


def fir():
    reset()
    bark = mat("bark", (0.5, 0.5, 0.5), 1.0)
    hi = fir_parts("Hi", 6, 14, True, 1.9, 11.8, 2.35, 0.55, 11)
    lo = fir_parts("Lo", 3, 8, True, 2.6, 11.5, 2.2, 0.45, 12)
    th = cyl("TrunkHi", 0.3, 4.4, (0, 0, 2.2), bark, 7, 0.16)
    tl = cyl("TrunkLo", 0.28, 3.8, (0, 0, 1.9), bark, 5, 0.18)
    for o in (hi, lo, th, tl):
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        bpy.ops.object.shade_smooth()
    export("hill-fir.glb")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    summit()
    start()
    marshal()
    rock()
    fir()
