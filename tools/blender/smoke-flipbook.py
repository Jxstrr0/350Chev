"""Smoke flipbook, baked in Blender: one puff of smoke rendered as a real volume over its life, 16 frames, for the
particle smoke at the salt flats, road course, ovals, pull, hill, pits and boat ramp on Full and Ultra (StripFx with
{flip:1} in src/vis/strip-run.js). Lite keeps the drawn puff.

Writes tex/fx-smoke.jpg, 512 x 512, a 4 x 4 grid of 128-pixel frames, read left to right, top row first:
  frame 0   a young puff: dense, round, billowing lumps
  frame 15  the same puff old: wider, thin, torn into wisps
  red   = how much smoke the pixel looks through (the particle's alpha)
  green = how lit that smoke is, as a square root (linear light / 1.4, the game squares it back) (sun from above and to one side, soft sky round it), so the top of each puff is
          bright and its belly darker. The game tints both with the particle's own colour.
JPEG has no alpha channel, so density rides in red; blue is unused.

Run from the repo root:   python3.11 tools/blender/smoke-flipbook.py [OUT_DIR]
Needs:  python3.11 -m pip install bpy pillow numpy      (a couple of minutes on the CPU)
"""
import bpy, sys, os
import numpy as np
from PIL import Image

OUT = ([a for a in sys.argv[1:] if not a.startswith("--")] or ["tex"])[0]
FRAMES, GRID, CELL, R = 16, 4, 128, 256          # render at R pixels, store at CELL


def node(nt, kind, **kw):
    n = nt.nodes.new(kind)
    for k, v in kw.items():
        if k.startswith("in_"):
            n.inputs[int(k[3:])].default_value = v
        else:
            setattr(n, k, v)
    return n


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 64; sc.cycles.use_denoising = False
    sc.cycles.volume_bounces = 4; sc.cycles.volume_step_rate = 0.5
    sc.render.resolution_x = sc.render.resolution_y = R
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"; sc.render.image_settings.color_depth = "16"
    sc.view_settings.view_transform = "Standard"
    cam = bpy.data.cameras.new("cam"); cam.type = "ORTHO"; cam.ortho_scale = 2.0
    co = bpy.data.objects.new("cam", cam); co.location = (0, -5, 0); co.rotation_euler = (1.5708, 0, 0)
    sc.collection.objects.link(co); sc.camera = co
    w = bpy.data.worlds.new("sky"); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[1].default_value = 0.8
    sc.world = w
    sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 4.5; sun.angle = 0.2
    so = bpy.data.objects.new("sun", sun); so.rotation_euler = (-0.75, 0.5, 0); sc.collection.objects.link(so)
    bpy.ops.mesh.primitive_cube_add(size=2.0); box = bpy.context.active_object
    m = bpy.data.materials.new("smoke"); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = node(nt, "ShaderNodeOutputMaterial")
    vol = node(nt, "ShaderNodeVolumePrincipled"); vol.inputs["Color"].default_value = (1, 1, 1, 1); vol.inputs["Anisotropy"].default_value = 0.3
    vol.inputs["Absorption Color"].default_value = (0.9, 0.9, 0.9, 1)   # smoke scatters; black here (the default) soaks up the light
    tc = node(nt, "ShaderNodeTexCoord")
    # radius from the centre, squashed a touch so the puff sits wider than tall
    sq = node(nt, "ShaderNodeVectorMath", operation="MULTIPLY"); sq.inputs[1].default_value = (1.0, 1.0, 1.12)
    ln = node(nt, "ShaderNodeVectorMath", operation="LENGTH")
    noise = node(nt, "ShaderNodeTexNoise", noise_dimensions="4D")
    noise.inputs["Scale"].default_value = 1.7; noise.inputs["Detail"].default_value = 4; noise.inputs["Roughness"].default_value = 0.58
    rad = node(nt, "ShaderNodeMath", operation="DIVIDE")            # r / R(t)
    inv = node(nt, "ShaderNodeMath", operation="SUBTRACT", in_0=1.0)  # 1 - r/R
    nc = node(nt, "ShaderNodeMath", operation="SUBTRACT", in_1=0.5)   # noise - 0.5
    amp = node(nt, "ShaderNodeMath", operation="MULTIPLY")           # * amp(t)
    base = node(nt, "ShaderNodeMath", operation="MULTIPLY", in_1=1.5)
    add = node(nt, "ShaderNodeMath", operation="ADD")
    mx = node(nt, "ShaderNodeMath", operation="MULTIPLY", in_1=3.5, use_clamp=True)   # a sharp edge where lumps meet air
    dens = node(nt, "ShaderNodeMath", operation="MULTIPLY")          # * density(t)
    L = nt.links.new
    L(tc.outputs["Object"], sq.inputs[0]); L(sq.outputs[0], ln.inputs[0]); L(tc.outputs["Object"], noise.inputs["Vector"])
    L(ln.outputs["Value"], rad.inputs[0]); L(rad.outputs[0], inv.inputs[1]); L(inv.outputs[0], base.inputs[0])
    L(noise.outputs["Fac"], nc.inputs[0]); L(nc.outputs[0], amp.inputs[0])
    L(base.outputs[0], add.inputs[0]); L(amp.outputs[0], add.inputs[1]); L(add.outputs[0], mx.inputs[0]); L(mx.outputs[0], dens.inputs[0])
    L(dens.outputs[0], vol.inputs["Density"]); L(vol.outputs[0], out.inputs["Volume"])
    box.data.materials.append(m)
    return sc, noise, rad, amp, dens


sc, noise, rad, amp, dens = build()
tmp = os.path.join(bpy.app.tempdir, "fx.png"); sc.render.filepath = tmp
sheet_d = np.zeros((GRID * CELL, GRID * CELL), np.float32); sheet_l = np.zeros_like(sheet_d)
buf = np.empty(R * R * 4, np.float32)
for f in range(FRAMES):
    t = f / (FRAMES - 1)
    noise.inputs["W"].default_value = 0.35 * t * 4
    rad.inputs[1].default_value = 0.55 + 0.37 * t ** 0.7     # grows to fill the frame
    amp.inputs[1].default_value = 1.1 + 1.9 * t              # lumpy when young, torn when old
    dens.inputs[1].default_value = 7.0 * (1 - t) ** 1.6 + 1.6
    bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(tmp); im.pixels.foreach_get(buf); bpy.data.images.remove(im)
    a = buf.reshape(R, R, 4)[::-1]
    alpha = a[:, :, 3]; lum = a[:, :, :3].mean(2) / np.maximum(alpha, 1e-3)
    lum = np.where(alpha > 0.01, lum, 0.75)                  # light under empty pixels: a neutral grey so mips blend cleanly
    # store at CELL: average 2x2
    k = R // CELL
    al = alpha.reshape(CELL, k, CELL, k).mean((1, 3)); lu = (lum * alpha).reshape(CELL, k, CELL, k).mean((1, 3)) / np.maximum(al, 1e-3)
    lu = np.where(al > 0.01, lu, 0.75)
    rim = np.clip((np.hypot(*np.mgrid[-1:1:CELL * 1j, -1:1:CELL * 1j]) - 0.9) / 0.1, 0, 1)   # a hard zero at the cell edge
    al *= 1 - rim
    y, x = divmod(f, GRID)
    sheet_d[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL] = al
    sheet_l[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL] = (np.clip(lu, 0, 1.4) / 1.4) ** 0.5   # stored as its square root (the game squares it back): finer steps in the shadows
    print("[smoke-flipbook] frame %d: coverage %.2f, peak %.2f" % (f, al.mean(), al.max()))
os.makedirs(OUT, exist_ok=True)
img = np.stack([sheet_d, sheet_l, np.zeros_like(sheet_d)], 2)
Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8), "RGB").save(os.path.join(OUT, "fx-smoke.jpg"), quality=90, optimize=True)
print("[smoke-flipbook] wrote fx-smoke.jpg")
