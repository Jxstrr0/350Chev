#!/usr/bin/env python3
"""Render the reflection panoramas for the garage: what the engine's chrome, polish and paint mirror.

  python3.11 -m pip install bpy pillow      # Blender as a Python module (bpy 5.0.1 was used; it needs Python 3.11)
  python3.11 tools/blender/workshop-env.py [OUT_DIR] [--preview]     # default OUT_DIR: tex/

Two rooms, both built here in code to the same measurements as the game's own room (src/vis/garage.js), seen from
where the engine sits, as a full 360 x 180 degree picture:

  env-workshop.jpg   the career workshop: painted block walls, the clay stripe, tube lights, the bench, the tool
                     chest, drums, and the big front door open to daylight (the wall the game's camera stands in).
  env-testcell.jpg   the test cell: white tile, cool panel lights, the control-room window, the instrument rack.

The game only uses these for reflections and soft fill light (src/vis/core.js, envPano): nobody sees them directly,
so shapes are simple and the lighting is what matters. Units and axes are the game's: x right, y up, z toward the
camera, about 8.4 units per metre; P() and box() turn that into Blender's Z-up.

The picture is 8-bit but holds bright lights: each channel stores log2(1 + 16 * light) / LOG_RANGE, which the game
undoes in its shader (ENV_LOG in core.js must match LOG_RANGE here). --preview also writes a plain PNG to look at.
"""
import math, os, sys
import bpy
import numpy as np
from PIL import Image

ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
OUT = ARGS[0] if ARGS else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "tex")
PREVIEW = "--preview" in sys.argv
LOG_RANGE = 8.0          # log2(1 + 16 * 15.94): lights up to about 16 times paper white survive
W, D, H = 70.0, 70.0, 30.0
EYE = (0.0, 9.5, 0.0)    # the middle of an engine on the stand
SIZE = (1024, 512)
SAMPLES = 96


def P(x, y, z):
    return (x, -z, y)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ---- materials -------------------------------------------------------------------------------------------------
def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    return m, nt, b


def flat(name, rgb, rough=0.7, metal=0.0, emit=0.0, emit_rgb=None):
    m, nt, b = new_mat(name)
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*(emit_rgb or rgb), 1)
        b.inputs["Emission Strength"].default_value = emit
    return m


def world_pos(nt):
    g = nt.nodes.new("ShaderNodeNewGeometry")
    s = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(g.outputs["Position"], s.inputs[0])
    return g, s


def noise(nt, vec, scale, detail=6.0, rough=0.6):
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = detail
    n.inputs["Roughness"].default_value = rough
    nt.links.new(vec, n.inputs["Vector"])
    return n


def ramp(nt, fac, stops):
    r = nt.nodes.new("ShaderNodeValToRGB")
    el = r.color_ramp.elements
    while len(el) < len(stops):
        el.new(0.5)
    for e, (pos, col) in zip(el, stops):
        e.position = pos
        e.color = (*col, 1) if len(col) == 3 else col
    nt.links.new(fac, r.inputs["Fac"])
    return r


def mix(nt, fac, a, b, mode="MIX"):
    m = nt.nodes.new("ShaderNodeMix")
    m.data_type = "RGBA"
    m.blend_type = mode
    for sock, v in ((m.inputs[0], fac), (m.inputs[6], a), (m.inputs[7], b)):
        if hasattr(v, "is_linked"):
            nt.links.new(v, sock)
        elif isinstance(v, (int, float)):
            sock.default_value = v
        else:
            sock.default_value = (*v, 1)
    return m.outputs[2]


def concrete_mat(tile=False):
    """The floor: sealed concrete with worn dull patches and dark oil, or the test cell's pale tile."""
    m, nt, b = new_mat("floor")
    g, s = world_pos(nt)
    big = noise(nt, g.outputs["Position"], 0.07, 5, 0.65)
    fine = noise(nt, g.outputs["Position"], 0.9, 8, 0.7)
    if tile:
        br = nt.nodes.new("ShaderNodeTexBrick")
        br.offset = 0.0
        br.inputs["Scale"].default_value = 1.0
        br.inputs["Brick Width"].default_value = 5.0
        br.inputs["Row Height"].default_value = 5.0
        br.inputs["Mortar Size"].default_value = 0.09
        br.inputs["Color1"].default_value = (0.62, 0.64, 0.65, 1)
        br.inputs["Color2"].default_value = (0.55, 0.57, 0.58, 1)
        br.inputs["Mortar"].default_value = (0.16, 0.17, 0.18, 1)
        nt.links.new(g.outputs["Position"], br.inputs["Vector"])
        col = mix(nt, 0.25, br.outputs["Color"], ramp(nt, big.outputs["Fac"], [(0.3, (0.6, 0.6, 0.6)), (0.7, (1, 1, 1))]).outputs["Color"], "MULTIPLY")
        rough = ramp(nt, fine.outputs["Fac"], [(0.3, (0.12,) * 3), (0.7, (0.3,) * 3)])
    else:
        base = ramp(nt, big.outputs["Fac"], [(0.28, (0.085, 0.085, 0.082)), (0.5, (0.15, 0.148, 0.14)), (0.72, (0.21, 0.205, 0.195))])
        oil = ramp(nt, noise(nt, g.outputs["Position"], 0.16, 3, 0.5).outputs["Fac"], [(0.63, (0, 0, 0)), (0.7, (1, 1, 1))])
        col = mix(nt, oil.outputs["Color"], base.outputs["Color"], (0.018, 0.017, 0.015))
        col = mix(nt, 0.35, col, ramp(nt, fine.outputs["Fac"], [(0.2, (0.55,) * 3), (0.8, (1, 1, 1))]).outputs["Color"], "MULTIPLY")
        dull = ramp(nt, big.outputs["Fac"], [(0.35, (0.22,) * 3), (0.7, (0.62,) * 3)])
        rough = nt.nodes.new("ShaderNodeMix")
        rough.data_type = "RGBA"
        nt.links.new(oil.outputs["Color"], rough.inputs[0])
        nt.links.new(dull.outputs["Color"], rough.inputs[6])
        rough.inputs[7].default_value = (0.08, 0.08, 0.08, 1)
        rough = type("o", (), {"outputs": {"Color": rough.outputs[2]}})
    nt.links.new(col, b.inputs["Base Color"])
    nt.links.new(rough.outputs["Color"], b.inputs["Roughness"])
    return m


def wall_mat(name, along_x, paint, tile=False):
    """A block (or tile) wall. along_x: the wall runs along x (back and front), else along z (the sides).
    Grime climbs the bottom of the wall and streaks down from the top."""
    m, nt, b = new_mat(name)
    g, s = world_pos(nt)
    c = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(s.outputs["X" if along_x else "Y"], c.inputs["X"])
    nt.links.new(s.outputs["Z"], c.inputs["Y"])
    br = nt.nodes.new("ShaderNodeTexBrick")
    br.inputs["Scale"].default_value = 1.0
    if tile:
        br.offset = 0.0
        br.inputs["Brick Width"].default_value = 2.6
        br.inputs["Row Height"].default_value = 2.6
        br.inputs["Mortar Size"].default_value = 0.07
    else:
        br.inputs["Brick Width"].default_value = 3.36
        br.inputs["Row Height"].default_value = 1.68
        br.inputs["Mortar Size"].default_value = 0.11
    br.inputs["Color1"].default_value = (*paint, 1)
    br.inputs["Color2"].default_value = (*[v * 0.86 for v in paint], 1)
    br.inputs["Mortar"].default_value = (*[v * (0.3 if tile else 0.62) for v in paint], 1)
    nt.links.new(c.outputs[0], br.inputs["Vector"])
    blotch = noise(nt, g.outputs["Position"], 0.11, 5, 0.6)
    col = mix(nt, 0.5 if not tile else 0.2, br.outputs["Color"], ramp(nt, blotch.outputs["Fac"], [(0.3, (0.55, 0.53, 0.5)), (0.7, (1, 1, 1))]).outputs["Color"], "MULTIPLY")
    grime = ramp(nt, s.outputs["Z"], [(0.0, (0.28, 0.25, 0.21)), (0.2, (0.8, 0.78, 0.75)), (0.5, (1, 1, 1))])
    mp = nt.nodes.new("ShaderNodeMapRange")          # height 0..H -> 0..1 for the grime ramp
    mp.inputs["From Max"].default_value = H
    nt.links.new(s.outputs["Z"], mp.inputs["Value"])
    nt.links.new(mp.outputs[0], grime.inputs["Fac"])
    col = mix(nt, 1.0 if not tile else 0.45, col, grime.outputs["Color"], "MULTIPLY")
    nt.links.new(col, b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.22 if tile else 0.78
    return m


def banded_mat(name, rgb, rough, metal, period, vertical_bands=False):
    """Corrugated sheet: light and dark bands (a roll-up door, the roof deck)."""
    m, nt, b = new_mat(name)
    g, s = world_pos(nt)
    w = nt.nodes.new("ShaderNodeTexWave")
    w.bands_direction = "X" if vertical_bands else "Z"
    w.inputs["Scale"].default_value = 1.0 / period
    nt.links.new(g.outputs["Position"], w.inputs["Vector"])
    r = ramp(nt, w.outputs["Fac"], [(0.15, [v * 0.45 for v in rgb]), (0.6, rgb)])
    dirt = ramp(nt, noise(nt, g.outputs["Position"], 0.2, 4, 0.6).outputs["Fac"], [(0.3, (0.6, 0.57, 0.52)), (0.7, (1, 1, 1))])
    nt.links.new(mix(nt, 0.7, r.outputs["Color"], dirt.outputs["Color"], "MULTIPLY"), b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return m


# ---- geometry --------------------------------------------------------------------------------------------------
def box(name, size, pos, mat, rot_y=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(*pos))
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0], size[2], size[1])
    o.rotation_euler = (0, 0, rot_y)
    o.data.materials.append(mat)
    return o


def cyl(name, r, h, pos, mat, lying=None):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=28, location=P(*pos))
    o = bpy.context.active_object
    o.name = name
    if lying == "x":
        o.rotation_euler = (0, math.pi / 2, 0)
    elif lying == "z":
        o.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    return o


def torus(name, R, r, pos, mat):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=28, minor_segments=10, location=P(*pos))
    o = bpy.context.active_object
    o.name = name
    bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    return o


def shell(floor, wall_x, wall_z, ceil, steel, front_door):
    """Floor, four walls, roof deck, trusses and columns. front_door: leave the camera-side wall open to daylight."""
    box("floor", (W + 8, 0.4, D + 8), (0, -0.2, 0), floor)
    box("back", (W, H, 1.2), (0, H / 2, -D / 2), wall_x)
    box("left", (1.2, H, D), (-W / 2, H / 2, 0), wall_z)
    box("right", (1.2, H, D), (W / 2, H / 2, 0), wall_z)
    if front_door:
        dw, dh, dx = 34.0, 19.0, -4.0
        box("frontL", (W / 2 + dx - dw / 2, H, 1.2), ((-W / 2 + dx - dw / 2) / 2, H / 2, D / 2), wall_x)
        box("frontR", (W / 2 - dx - dw / 2, H, 1.2), ((W / 2 + dx + dw / 2) / 2, H / 2, D / 2), wall_x)
        box("frontTop", (dw, H - dh, 1.2), (dx, (H + dh) / 2, D / 2), wall_x)
        box("doorRoll", (dw + 1, 2.4, 2.4), (dx, dh + 1.0, D / 2 - 1.6), steel)       # the rolled-up door in its housing
        for sx in (-1, 1):
            box("doorTrack", (0.7, dh, 0.9), (dx + sx * (dw / 2 + 0.2), dh / 2, D / 2 - 0.9), steel)
    else:
        box("front", (W, H, 1.2), (0, H / 2, D / 2), wall_x)
    box("ceil", (W, 1.0, D), (0, H + 0.5, 0), ceil)
    for tr in range(-2, 3):
        box("truss", (W - 2, 0.7, 0.7), (0, H - 1.6, tr * 11), steel)
        box("trussLow", (W - 2, 0.35, 0.5), (0, H - 4.4, tr * 11), steel)
        for k in range(-5, 6):
            box("web", (0.3, 2.6, 0.3), (k * 6.2, H - 3.0, tr * 11), steel)
    for cx in (-W / 2 + 6, W / 2 - 6):
        box("col", (2.2, H, 2.2), (cx, H / 2, -D / 2 + 3.2), steel)


def workshop():
    paint = (0.50, 0.48, 0.41)                       # the game's wall paint (0xbdb9ac), a little dirtier
    clay = flat("clay", (0.38, 0.105, 0.05), 0.5)   # the stripe and the tool chest (Longlight clay, shaded)
    blue = flat("blue", (0.03, 0.10, 0.26), 0.45)
    steel = flat("steel", (0.10, 0.105, 0.11), 0.45, 0.7)
    bright = flat("bright", (0.55, 0.56, 0.58), 0.3, 1.0)
    wood = flat("wood", (0.11, 0.065, 0.035), 0.6)
    black = flat("black", (0.012, 0.012, 0.013), 0.6)
    card = flat("card", (0.30, 0.2, 0.11), 0.85)
    red = flat("red", (0.42, 0.02, 0.015), 0.35)
    yellow = flat("yellow", (0.55, 0.36, 0.02), 0.45)
    shell(concrete_mat(), wall_mat("wallX", True, paint), wall_mat("wallZ", False, paint),
          banded_mat("deck", (0.62, 0.63, 0.61), 0.6, 0.0, 0.5), steel, True)      # white-painted roof deck, gone grey
    # the clay stripe, on all four walls so the reflection has a horizon
    box("dadoB", (W, 1.1, 0.3), (0, 9.5, -D / 2 + 0.7), clay)
    box("dadoL", (0.3, 1.1, D), (-W / 2 + 0.7, 9.5, 0), clay)
    box("dadoR", (0.3, 1.1, D), (W / 2 - 0.7, 9.5, 0), clay)
    # back wall: the closed roll-up door and the shop sign
    dw, dh = 25.2, H * 0.62
    box("door", (dw, dh, 0.7), (W * 0.22, dh / 2, -D / 2 + 0.9), banded_mat("doorM", (0.42, 0.44, 0.45), 0.4, 0.8, 0.22))
    box("doorHead", (dw + 2.2, 1.4, 1.1), (W * 0.22, dh + 0.7, -D / 2 + 0.9), steel)
    box("sign", (24, 6, 0.3), (-W * 0.16, H * 0.70, -D / 2 + 0.75), flat("sign", (0.02, 0.022, 0.025), 0.35))
    box("signBar", (22, 0.7, 0.34), (-W * 0.16, H * 0.70 - 2.0, -D / 2 + 0.76), flat("signBar", (0.5, 0.14, 0.06), 0.4, emit=0.6))
    box("signWord", (17, 1.9, 0.34), (-W * 0.16, H * 0.70 + 0.6, -D / 2 + 0.76), flat("signWord", (0.7, 0.68, 0.6), 0.5))
    # right wall: bench, pegboard, vice, shelving with parts
    bx = W / 2 - 7
    box("benchTop", (4.4, 0.9, 26), (bx, 8.6, -8), wood)
    box("benchBody", (4.0, 7.6, 25), (bx, 4.3, -8), flat("cab", (0.07, 0.075, 0.08), 0.5, 0.3))
    box("peg", (0.3, 13, 22), (W / 2 - 0.8, 16, -8), flat("peg", (0.2, 0.13, 0.07), 0.8))
    for i, (pz, ph, m) in enumerate(((-16, 6, bright), (-13.5, 4, red), (-11, 7, bright), (-8, 3.4, yellow), (-5.5, 6.2, bright), (-2.4, 4.6, blue), (0.4, 5.4, bright))):
        box("tool%d" % i, (0.25, ph, 1.1), (W / 2 - 1.05, 19.5 - ph / 2, pz), m)
    box("vice", (2.4, 2.0, 2.0), (bx - 0.6, 10.2, -16.4), blue)
    box("benchBox", (2.6, 2.2, 4.6), (bx, 10.1, -3.2), red)
    sx = W / 2 - 3.4
    for z in (8, 24):
        box("upright", (0.5, 20, 0.5), (sx, 10, z), steel)
    for sh in range(4):
        box("shelf", (5.0, 0.4, 16.5), (sx, 3.5 + sh * 5.2, 16), steel)
        for k in range(4):
            box("part", (3.6, 2.2 + (k + sh) % 3, 3.0), (sx, 3.7 + sh * 5.2 + (2.2 + (k + sh) % 3) / 2, 10 + k * 4.1), (card, bright, card, blue, yellow)[(k + sh * 2) % 5])
    # left wall: the tool chest, posters, drums, the tyre stack, a compressor
    box("chest", (7.2, 12.0, 5.6), (-W / 2 + 7.5, 6.2, -14), flat("chestM", (0.38, 0.105, 0.05), 0.28, 0.1))
    for dr in range(5):
        box("pull", (6.2, 0.28, 0.35), (-W / 2 + 7.5, 2.4 + dr * 2.1, -11.1), bright)
    box("poster1", (0.2, 9.6, 7), (-W / 2 + 0.75, 16, -6), flat("p1", (0.5, 0.36, 0.1), 0.6))
    box("poster1b", (0.22, 4.0, 5.4), (-W / 2 + 0.76, 17.4, -6), flat("p1b", (0.04, 0.05, 0.09), 0.6))
    box("poster2", (0.2, 6.8, 9), (-W / 2 + 0.75, 16, 8), flat("p2", (0.55, 0.53, 0.47), 0.6))
    box("poster2b", (0.22, 3.2, 7.4), (-W / 2 + 0.76, 16.6, 8), flat("p2b", (0.3, 0.04, 0.03), 0.6))
    for od in range(3):
        cyl("drum", 2.1, 7.4, (-W / 2 + 3.4 + od * 4.6, 3.7, 20), blue if od == 1 else clay)
        for y in (1.4, 6.6):
            torus("hoop", 2.1, 0.2, (-W / 2 + 3.4 + od * 4.6, y, 20), bright)
    for ty in range(4):
        torus("tyre", 2.6, 1.05, (-W / 2 + 6.0, 1.1 + ty * 2.1, -26), black)
    cyl("compTank", 2.6, 11, (-W / 2 + 5.4, 6.2, 29), red)
    box("compPump", (3.6, 2.8, 3.6), (-W / 2 + 5.4, 13.0, 29), black)
    # middle of the floor: the steps, a floor jack, a creeper, an oil tray
    box("step1", (9, 0.5, 5), (-W * 0.30, 1.6, 15), bright)
    box("step2", (9, 0.5, 5), (-W * 0.30, 0.7, 18.6), bright)
    box("jack", (3.0, 1.3, 8.0), (14, 0.8, 16), yellow, 0.5)
    box("creeper", (3.4, 0.5, 8.6), (-9, 0.5, 21), black, -0.3)
    cyl("tray", 3.0, 0.5, (6, 0.3, -9), black)
    # lights: two rows of tubes in dark housings (the game's own fixtures), and a hanging lead lamp near the engine
    tube = flat("tube", (1, 1, 1), 0.5, emit=13.0, emit_rgb=(1.0, 0.90, 0.76))
    for lz in (-12, 10):
        for lx in (-16.1, 16.1):
            box("fixture", (0.5, 0.5, 13), (lx, H - 2.3, lz), steel)       # an open batten: the tubes light the roof too
            for off in (-0.6, 0.6):
                cyl("tubeL", 0.22, 12.4, (lx + off, H - 2.75, lz), tube, "z")
    # three bands of translucent roof sheet running front to back: the long soft highlights on anything that faces up
    sky = flat("rooflight", (1, 1, 1), 0.5, emit=2.6, emit_rgb=(1.0, 0.90, 0.74))       # old fibreglass sheet: yellowed, warm
    for lx, lw in ((0, 12.0), (-25, 7.0)):
        box("rooflight", (lw, 0.3, D - 3), (lx, H - 0.2, 0), sky)
        for k in range(-8, 9):
            box("rooflightBar", (lw + 0.6, 0.4, 0.35), (lx, H - 0.45, k * 4.0), steel)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.55, location=P(9, 19, 7))
    bpy.context.active_object.data.materials.append(flat("bulb", (1, 1, 1), 0.5, emit=60.0, emit_rgb=(1.0, 0.62, 0.3)))
    cyl("lead", 0.06, H - 19.6, (9, (H + 19.6) / 2, 7), black)
    bpy.ops.mesh.primitive_cone_add(radius1=1.5, radius2=0.5, depth=1.3, location=P(9, 19.9, 7))
    bpy.context.active_object.data.materials.append(black)
    # outside the front door: an asphalt apron, a pickup parked across it, a fence line, low sun and a clear sky
    box("apron", (400, 0.4, 300), (0, -0.25, D / 2 + 150), flat("apron", (0.045, 0.045, 0.047), 0.75))
    box("truckBody", (40, 5.4, 15), (22, 6.2, D / 2 + 52), flat("truck", (0.30, 0.03, 0.02), 0.25, 0.3), 0.12)
    box("truckCab", (14, 5.0, 14), (20, 11.3, D / 2 + 52), flat("truckGlass", (0.02, 0.03, 0.04), 0.08, 0.2), 0.12)
    for wx in (9, 34):
        cyl("wheel", 3.0, 2.2, (wx, 3.0, D / 2 + 44.6), black, "z")
    box("fence", (400, 14, 0.6), (0, 7, D / 2 + 150), banded_mat("fenceM", (0.16, 0.12, 0.08), 0.8, 0.0, 1.2, True))
    for k in range(-3, 4):
        cyl("trunk", 1.6, 30, (k * 52 + 14, 15, D / 2 + 170), flat("trunk", (0.05, 0.035, 0.02), 0.9))
        bpy.ops.mesh.primitive_ico_sphere_add(radius=16 + (k % 3) * 3, subdivisions=2, location=P(k * 52 + 14, 36, D / 2 + 170))
        bpy.context.active_object.data.materials.append(flat("leaf%d" % k, (0.03, 0.07, 0.02), 0.9))
    sky_world(sun=(0.42, 0.52, 0.74), sun_strength=5.5, zenith=(0.16, 0.34, 0.85), horizon=(0.85, 0.80, 0.70), strength=1.7)


def testcell():
    white = (0.74, 0.76, 0.76)
    steel = flat("steel", (0.36, 0.37, 0.38), 0.4, 0.6)
    blue = flat("blue", (0.03, 0.10, 0.26), 0.45)
    black = flat("black", (0.012, 0.012, 0.013), 0.5)
    shell(concrete_mat(True), wall_mat("wallX", True, white, True), wall_mat("wallZ", False, white, True),
          flat("ceilW", (0.55, 0.56, 0.56), 0.7), steel, False)
    box("stripeB", (W, 0.8, 0.3), (0, 7.0, -D / 2 + 0.7), blue)
    box("stripeF", (W, 0.8, 0.3), (0, 7.0, D / 2 - 0.7), blue)
    box("stripeL", (0.3, 0.8, D), (-W / 2 + 0.7, 7.0, 0), blue)
    box("stripeR", (0.3, 0.8, D), (W / 2 - 0.7, 7.0, 0), blue)
    for z in (-13, 13):
        box("lane", (W * 0.7, 0.06, 0.5), (0, 0.05, z), blue)
    for x in (-W * 0.35, W * 0.35):
        box("laneS", (0.5, 0.06, 26.5), (x, 0.05, 0), blue)
    # the control-room window: dark glass, a blue-white glow of screens behind it, mullions
    ww, wh, wy = W * 0.46, H * 0.30, H * 0.52
    box("winFrame", (ww + 2.0, wh + 2.0, 0.8), (-W * 0.16, wy, -D / 2 + 0.5), steel)
    box("winGlow", (ww * 0.98, wh * 0.96, 0.2), (-W * 0.16, wy, -D / 2 + 0.75), flat("glow", (0.02, 0.03, 0.05), 0.1, emit=0.9, emit_rgb=(0.25, 0.5, 1.0)))
    for k, (dx, c) in enumerate(((-9, (0.3, 0.8, 1.0)), (-2, (0.9, 0.95, 1.0)), (6, (0.2, 1.0, 0.5)), (11, (1.0, 0.6, 0.2)))):
        box("mon%d" % k, (4.6, 2.9, 0.1), (-W * 0.16 + dx, wy - 1.2, -D / 2 + 0.9), flat("monM%d" % k, c, 0.3, emit=3.2))
    for mul in range(3):
        box("mullion", (0.4, wh, 0.5), (-W * 0.16 - ww * 0.34 + mul * ww * 0.34, wy, -D / 2 + 1.0), steel)
    # instrument rack with lit readouts, the extraction hood and its duct
    rx = W * 0.30
    box("rack", (7.0, 20.0, 6.0), (rx, 10.0, -16), flat("rackM", (0.08, 0.085, 0.09), 0.45, 0.4))
    for u in range(5):
        box("unit", (6.4, 2.4, 0.4), (rx, 4.0 + u * 3.4, -13.1), black)
        box("readout", (3.2, 1.2, 0.2), (rx - 1.0, 4.0 + u * 3.4, -12.85), flat("ro%d" % u, (0, 0, 0), 0.3, emit=4.0, emit_rgb=(0.2, 1.0, 0.35) if u % 2 else (1.0, 0.6, 0.12)))
    bpy.ops.mesh.primitive_cone_add(radius1=4.4, radius2=1.8, depth=4.0, vertices=24, location=P(W * 0.34, H - 6.4, -14))
    bpy.context.active_object.data.materials.append(steel)
    cyl("duct", 1.8, 4.8, (W * 0.34, H - 2.0, -14), steel)
    cyl("ductRun", 1.5, 12, (W * 0.34, H - 4.2, -20), steel, "z")
    # the far side of the cell: a steel door, a fuel cabinet, an extinguisher, a cable reel
    box("cellDoor", (12, 19, 0.6), (-16, 9.5, D / 2 - 0.8), flat("cellDoorM", (0.2, 0.22, 0.24), 0.4, 0.6))
    box("doorSign", (5, 1.6, 0.1), (-16, 21.2, D / 2 - 0.75), flat("exit", (0, 0, 0), 0.3, emit=3.0, emit_rgb=(0.1, 1.0, 0.3)))
    box("fuelCab", (10, 14, 5), (14, 7, D / 2 - 3.4), flat("fuelCabM", (0.6, 0.42, 0.02), 0.35, 0.2))
    cyl("ext", 1.0, 4.6, (-27, 2.3, D / 2 - 2), flat("extM", (0.5, 0.02, 0.015), 0.3))
    # bright, even panel lights
    panel = flat("panelL", (1, 1, 1), 0.5, emit=5.2, emit_rgb=(0.86, 0.93, 1.0))
    for lx in (-1, 0, 1):
        for lz in (-1, 1):
            box("lightBox", (9.0, 0.7, 9.0), (lx * W * 0.28, H - 1.9, lz * 13), steel)
            box("lightFace", (8.4, 0.3, 8.4), (lx * W * 0.28, H - 2.3, lz * 13), panel)
    sky_world(None, 0, (0, 0, 0), (0, 0, 0), 0)


def sky_world(sun, sun_strength, zenith, horizon, strength):
    w = bpy.data.worlds.new("World")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes["Background"]
    if not strength:
        bg.inputs["Color"].default_value = (0, 0, 0, 1)
        return
    tc = nt.nodes.new("ShaderNodeTexCoord")
    s = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Generated"], s.inputs[0])
    r = ramp(nt, s.outputs["Z"], [(0.0, horizon), (0.12, [(a + b) / 2 for a, b in zip(horizon, zenith)]), (0.6, zenith)])
    nt.links.new(r.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = strength
    bpy.ops.object.light_add(type="SUN", location=(0, 0, 60))
    L = bpy.context.active_object
    L.data.energy = sun_strength
    L.data.color = (1.0, 0.93, 0.82)
    L.data.angle = math.radians(1.2)
    d = P(*sun)                                    # the sun sits this way from the room (game axes)
    n = math.sqrt(sum(v * v for v in d))
    L.rotation_euler = (math.acos(d[2] / n), 0, math.atan2(d[0], -d[1]))


# ---- render and pack -------------------------------------------------------------------------------------------
def render(name):
    sc = bpy.context.scene
    bpy.ops.object.camera_add(location=P(*EYE), rotation=(math.pi / 2, 0, 0))     # level, looking along Blender +Y (game -z)
    cam = bpy.context.active_object
    cam.data.type = "PANO"
    cam.data.panorama_type = "EQUIRECTANGULAR"
    cam.data.clip_start = 0.05
    sc.camera = cam
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 6
    sc.cycles.sample_clamp_indirect = 8.0
    sc.render.resolution_x, sc.render.resolution_y = SIZE
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "OPEN_EXR"
    sc.render.image_settings.color_depth = "32"
    tmp = os.path.join(bpy.app.tempdir, name + ".exr")
    sc.render.filepath = tmp
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(tmp)
    a = np.empty(SIZE[0] * SIZE[1] * 4, np.float32)
    img.pixels.foreach_get(a)
    a = a.reshape(SIZE[1], SIZE[0], 4)[::-1, :, :3]            # top row first, linear light
    a = np.clip(np.nan_to_num(a), 0, None)
    os.makedirs(OUT, exist_ok=True)
    enc = np.clip(np.log2(1 + 16 * a) / LOG_RANGE, 0, 1)
    Image.fromarray((enc * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, name + ".jpg"), quality=86, optimize=True, subsampling=0)
    lum = a @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    wt = np.cos(np.linspace(-math.pi / 2, math.pi / 2, SIZE[1]))[:, None]            # a sphere, not a rectangle
    print("%s: mean light %.3f, median %.3f, peak %.1f" % (name, float((lum * wt).sum() / (wt.sum() * SIZE[0])), float(np.median(lum)), float(lum.max())))
    if PREVIEW:
        Image.fromarray((np.clip(a / (1 + a) * 1.6, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8)).save(os.path.join(OUT, name + "-preview.png"))


for room_name, build in (("env-workshop", workshop), ("env-testcell", testcell)):
    reset()
    build()
    render(room_name)
