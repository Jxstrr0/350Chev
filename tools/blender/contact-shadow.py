"""Soft contact shadows baked in Blender: the darkening a piece of furniture leaves on the floor round its feet, under a
room's sky-like light, for the rooms that draw no shadow maps on Lite (and softer than shadow maps on Full / Ultra).

Writes tex/sh-contact.jpg, three square cells side by side, each a 2 x 2 patch of floor round a 1 x 1 footprint
(the footprint fills the middle half of the cell):
  0  box     a solid cabinet or chest standing flat on the floor
  1  legs    a bench or stand: a top on four thin legs, so light gets in underneath
  2  round   a drum, a tyre stack, a barrel
White = open floor (no change), darker = shadow. The game multiplies the floor by it (contactShadow in src/vis/core.js).

Run from the repo root:   python3.11 tools/blender/contact-shadow.py [OUT_DIR]
Needs:  python3.11 -m pip install bpy pillow numpy      (under a minute on the CPU)
"""
import bpy, sys, os
import numpy as np
from PIL import Image

OUT = ([a for a in sys.argv[1:] if not a.startswith("--")] or ["tex"])[0]
CELL = 256


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 384
    sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 2
    sc.render.resolution_x = sc.render.resolution_y = CELL
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_depth = "16"
    sc.view_settings.view_transform = "Raw"
    cam = bpy.data.cameras.new("cam"); cam.type = "ORTHO"; cam.ortho_scale = 2.0
    ob = bpy.data.objects.new("cam", cam); ob.location = (0, 0, 5); sc.collection.objects.link(ob); sc.camera = ob
    w = bpy.data.worlds.new("sky"); w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    sc.world = w
    # the roof lights: one broad soft panel overhead, as in the workshop
    la = bpy.data.lights.new("roof", "AREA"); la.size = 3.0; la.energy = 120
    lo = bpy.data.objects.new("roof", la); lo.location = (0.3, 0.2, 3.5); sc.collection.objects.link(lo)
    bpy.ops.mesh.primitive_plane_add(size=6)
    floor = bpy.context.active_object
    m = bpy.data.materials.new("floor"); m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.8, 0.8, 0.8, 1)
    m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 1.0
    floor.data.materials.append(m)
    return sc


def hide(ob):
    ob.visible_camera = False                    # it blocks light, but the camera sees only the floor


def box():
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.45)); o = bpy.context.active_object; o.scale.z = 0.9; hide(o)


def legs():
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.8)); o = bpy.context.active_object; o.scale = (1, 1, 0.06); hide(o)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.18)); o = bpy.context.active_object; o.scale = (0.94, 0.94, 0.03); hide(o)
    for x in (-0.46, 0.46):
        for y in (-0.46, 0.46):
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, 0.4)); o = bpy.context.active_object; o.scale = (0.06, 0.06, 0.8); hide(o)


def round_():
    bpy.ops.mesh.primitive_cylinder_add(radius=0.5, depth=1.0, location=(0, 0, 0.5), vertices=48); hide(bpy.context.active_object)


def render(build):
    sc = reset()
    tmp = os.path.join(bpy.app.tempdir, "cs.png")
    sc.render.filepath = tmp
    bpy.ops.render.render(write_still=True)        # the open floor first, to divide by
    im = bpy.data.images.load(tmp); a = np.empty(CELL * CELL * 4, np.float32); im.pixels.foreach_get(a); bpy.data.images.remove(im)
    open_ = a.reshape(CELL, CELL, 4)[:, :, :3].mean(2)
    build()
    bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(tmp); im.pixels.foreach_get(a); bpy.data.images.remove(im)
    v = a.reshape(CELL, CELL, 4)[:, :, :3].mean(2) / np.maximum(open_, 1e-4)
    for _ in range(3):                           # a soft blur takes out the render's grain (shadows this soft have no fine detail)
        for ax in (0, 1):
            v = sum(np.roll(v, d, ax) for d in (-2, -1, 0, 1, 2)) / 5
    # fade to exactly white at the cell's rim, so the decal's edge never shows
    yy, xx = np.mgrid[0:CELL, 0:CELL] / (CELL - 1) * 2 - 1
    rim = np.clip((np.maximum(np.abs(xx), np.abs(yy)) - 0.8) / 0.2, 0, 1)
    return np.clip(v + (1 - v) * rim * rim, 0, 1)[::-1]


cells = [render(box), render(legs), render(round_)]
os.makedirs(OUT, exist_ok=True)
img = (np.concatenate(cells, 1) * 255 + 0.5).astype(np.uint8)
Image.fromarray(img, "L").save(os.path.join(OUT, "sh-contact.jpg"), quality=88, optimize=True)
print("[contact-shadow] wrote sh-contact.jpg; darkest at the footprint edge: %s" % ", ".join("%.2f" % c[CELL // 2, CELL // 4] for c in cells))
