"""The prairie horizon, baked in Blender: a full circle of what lies past every venue's own scenery (straight shelterbelts of
trees, farmsteads with red barns and grain bins, far elevator towns, a low ridge 10 km off) photographed from eye height
with a 360 degree camera, for the sky shader to draw just above the ground line (stripSkyMat in src/vis/strip.js).

Writes tex/hz-prairie.jpg, 4096 x 128, two halves stacked:
  rows   0..63   colour, lit by a soft sky and a weak sun, no haze (the game hazes it toward its own sky colour, so one
                 picture serves day, dusk and night at every venue)
  rows  64..127  red = coverage (0 sky, 1 land), green = haze (0 near, 1 far: 1 - exp(-distance / 7 km))
Columns run once round the horizon (the same mapping as the garage reflection pictures); rows run from +2.4 degrees at
the top of each half down to -0.6 degrees, so the band is three degrees tall and sits on the horizon line.

Run from the repo root:   python3.11 tools/blender/horizon.py [OUT_DIR] [--preview DIR]
Needs:  python3.11 -m pip install bpy pillow numpy      (a few minutes on the CPU)
"""
import bpy, sys, os, math
import numpy as np
from PIL import Image
from mathutils import Vector

ARGS = [a for i, a in enumerate(sys.argv[1:]) if not a.startswith("--") and sys.argv[i] != "--preview"]
OUT = ARGS[0] if ARGS else "tex"
PREVIEW = sys.argv[sys.argv.index("--preview") + 1] if "--preview" in sys.argv else None
W, H = 4096, 64
LAT = (-0.6, 2.4)              # degrees; keep in step with HZ_LAT in src/vis/strip.js
EYE = 2.0
r = np.random.default_rng(1876)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 64; sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 2
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"; sc.render.image_settings.color_depth = "16"
    sc.view_settings.view_transform = "Standard"
    cam = bpy.data.cameras.new("cam"); cam.type = "PANO"; cam.panorama_type = "EQUIRECTANGULAR"
    cam.latitude_min, cam.latitude_max = math.radians(LAT[0]), math.radians(LAT[1])
    cam.longitude_min, cam.longitude_max = -math.pi, math.pi
    cam.clip_start, cam.clip_end = 1, 60000
    ob = bpy.data.objects.new("cam", cam); ob.location = (0, 0, EYE); ob.rotation_euler = (math.pi / 2, 0, 0)   # centre column looks along +Y (the game's -Z)
    sc.collection.objects.link(ob); sc.camera = ob
    w = bpy.data.worlds.new("sky"); w.use_nodes = True
    bg = w.node_tree.nodes["Background"]; bg.inputs[0].default_value = (0.62, 0.70, 0.82, 1); bg.inputs[1].default_value = 0.9
    sc.world = w
    sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 2.2; sun.angle = math.radians(3)
    so = bpy.data.objects.new("sun", sun)
    d = Vector((-0.55, -0.75, 0.36)).normalized()    # the drag strip's sun (STRIP_SUN_DAY), turned into Blender's axes
    so.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    sc.collection.objects.link(so)
    return sc


MATS = {}
def mat(rgb):
    k = tuple(round(c, 3) for c in rgb)
    if k not in MATS:
        m = bpy.data.materials.new("m%d" % len(MATS)); m.use_nodes = True
        p = m.node_tree.nodes["Principled BSDF"]; p.inputs["Base Color"].default_value = (*k, 1); p.inputs["Roughness"].default_value = 0.9
        MATS[k] = m
    return MATS[k]


PARTS = {}                     # colour -> lists of verts, faces
def put(v, f, rgb):
    L = PARTS.setdefault(tuple(round(c, 3) for c in rgb), [[], [], 0])
    L[0].append(v); L[1].append(f + L[2]); L[2] += len(v)


def cube():
    v = np.array([[x, y, z] for z in (0, 1) for y in (-.5, .5) for x in (-.5, .5)], float)
    f = np.array([[0, 2, 3], [0, 3, 1], [4, 5, 7], [4, 7, 6], [0, 1, 5], [0, 5, 4], [2, 6, 7], [2, 7, 3], [0, 4, 6], [0, 6, 2], [1, 3, 7], [1, 7, 5]])
    return v, f


def cyl(n=10, cone=False):
    a = np.linspace(0, 2 * math.pi, n, endpoint=False)
    top = 0.0 if cone else 0.5
    v = np.concatenate([np.stack([np.cos(a) * .5, np.sin(a) * .5, np.zeros(n)], 1), np.stack([np.cos(a) * top, np.sin(a) * top, np.ones(n)], 1)])
    f = []
    for i in range(n):
        j = (i + 1) % n
        f += [[i, j, n + j], [i, n + j, n + i]]
    return v, np.array(f)


def blob():
    import bmesh
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
    v = np.array([p.co[:] for p in bm.verts]); f = np.array([[p.index for p in t.verts] for t in bm.faces]); bm.free()
    return v, f


CUBE, CYL, CONE, BLOB = cube(), cyl(), cyl(cone=True), blob()


def place(shape, pos, size, rgb, rot=0.0):
    v, f = shape
    v = v * np.array(size)
    c, s = math.cos(rot), math.sin(rot)
    v = np.stack([v[:, 0] * c - v[:, 1] * s + pos[0], v[:, 0] * s + v[:, 1] * c + pos[1], v[:, 2] + pos[2]], 1)
    put(v, f, rgb)


def polar(dist, ang):
    return dist * math.sin(ang), dist * math.cos(ang)


def tree(x, y, h, w):
    g = r.uniform(0.75, 1.15)
    place(BLOB, (x, y, h * 0.55), (w, w, h * 0.5), (0.05 * g, 0.075 * g, 0.03 * g))


def belt(x, y, rot, length, h):
    n = int(length / 7)
    for i in range(n):
        t = (i - n / 2) * 7 + r.uniform(-2, 2)
        hh = h * r.uniform(0.75, 1.2)
        tree(x + math.cos(rot) * t, y + math.sin(rot) * t, hh, hh * r.uniform(0.35, 0.55))


def farm(x, y):
    rot = r.uniform(0, math.pi)
    belt(x - 60 * math.sin(rot), y + 60 * math.cos(rot), rot, r.uniform(180, 420), r.uniform(9, 15))       # the windbreak on the north side
    belt(x - 140 * math.cos(rot), y - 140 * math.sin(rot), rot + math.pi / 2, r.uniform(120, 260), r.uniform(8, 13))
    red = (0.36, 0.07, 0.05) if r.uniform() < 0.7 else (0.55, 0.52, 0.47)
    place(CUBE, (x, y, 0), (16, 26, 7), red, rot); place(CONE, (x, y, 7), (20, 30, 5), (0.18, 0.17, 0.16), rot)     # barn and its roof
    place(CUBE, (x + 40, y - 20, 0), (10, 13, 5), (0.7, 0.68, 0.62), rot)                                          # house
    for b in range(r.integers(2, 6)):                                                                              # grain bins
        bx, by = x - 30 + b * 11, y - 45
        place(CYL, (bx, by, 0), (9, 9, 8), (0.55, 0.56, 0.57)); place(CONE, (bx, by, 8), (9.4, 9.4, 3), (0.6, 0.61, 0.62))


def town(x, y):
    for e in range(r.integers(2, 4)):                                                                              # wooden elevators by the rail line
        ex, ey = x + e * 28, y
        col = [(0.42, 0.13, 0.09), (0.62, 0.55, 0.42), (0.5, 0.18, 0.1)][e % 3]
        place(CUBE, (ex, ey, 0), (14, 18, 30 + r.uniform(0, 8)), col); place(CUBE, (ex, ey, 34), (6, 8, 8), col)
    place(CYL, (x - 70, y + 30, 0), (2, 2, 28), (0.5, 0.5, 0.5)); place(CYL, (x - 70, y + 30, 28), (12, 12, 8), (0.62, 0.62, 0.6))   # water tower
    for k in range(40):                                                                                            # houses and trees
        hx, hy = x + r.uniform(-260, 120), y + r.uniform(40, 360)
        if r.uniform() < 0.6:
            tree(hx, hy, r.uniform(9, 16), r.uniform(4, 7))
        else:
            place(CUBE, (hx, hy, 0), (9, 11, 5), (0.6, 0.58, 0.52))


sc = reset()
# farmsteads all round, each with its shelterbelts; a few loose belts along section lines
for k in range(46):
    farm(*polar(r.uniform(900, 5500), r.uniform(0, 2 * math.pi)))
for k in range(30):
    x, y = polar(r.uniform(700, 6000), r.uniform(0, 2 * math.pi))
    belt(x, y, r.choice([0.0, math.pi / 2]), r.uniform(200, 800), r.uniform(8, 14))
# two elevator towns far off (one where the strip's night sky glows, south-west of the line) and one nearer
for d, a in ((7000, math.atan2(-0.7, 0.7)), (9000, 2.2), (4200, 4.4)):
    town(*polar(d, a))
for name, (v, f, _) in PARTS.items():
    me = bpy.data.meshes.new("p"); V = np.concatenate(v); F = np.concatenate(f)
    me.from_pydata(V.tolist(), [], F.tolist()); me.update()
    ob = bpy.data.objects.new("p", me); ob.data.materials.append(mat(name)); sc.collection.objects.link(ob)
# the land: a disc from 600 m out, faint field stripes, rising into a low ridge 9 to 16 km off
nr, na = 90, 720
rad = 600 * (16000 / 600) ** (np.arange(nr) / (nr - 1))
ang = np.arange(na) / na * 2 * math.pi
R, A = np.meshgrid(rad, ang)
ridge = np.clip((R - 9000) / 7000, 0, 1) ** 1.5 * (40 + 50 * np.sin(A * 3 + 1.0) * np.sin(A * 7 + 2.0) + 30 * np.sin(A * 11))
V = np.stack([R.ravel() * np.sin(A.ravel()), R.ravel() * np.cos(A.ravel()), np.maximum(ridge, 0).ravel() - 0.5], 1)
F = []
for i in range(na):
    j = (i + 1) % na
    for k in range(nr - 1):
        a, b, c, d = i * nr + k, j * nr + k, j * nr + k + 1, i * nr + k + 1
        F += [[a, b, c], [a, c, d]]
me = bpy.data.meshes.new("land"); me.from_pydata(V.tolist(), [], F); me.update()
land = bpy.data.objects.new("land", me); land.data.materials.append(mat((0.26, 0.24, 0.13))); sc.collection.objects.link(land)

tmp = os.path.join(bpy.app.tempdir, "hz.png")
sc.render.filepath = tmp
bpy.ops.render.render(write_still=True)
im = bpy.data.images.load(tmp); a = np.empty(W * H * 4, np.float32); im.pixels.foreach_get(a); bpy.data.images.remove(im)
col = a.reshape(H, W, 4)[::-1].copy()
# the haze pass: every surface glows with 1 - exp(-distance / 7 km)
hm = bpy.data.materials.new("haze"); hm.use_nodes = True
nt = hm.node_tree; nt.nodes.clear()
cd = nt.nodes.new("ShaderNodeCameraData"); mth = nt.nodes.new("ShaderNodeMath"); mth.operation = "MULTIPLY"; mth.inputs[1].default_value = -1 / 7000
ex = nt.nodes.new("ShaderNodeMath"); ex.operation = "EXPONENT"
inv = nt.nodes.new("ShaderNodeMath"); inv.operation = "SUBTRACT"; inv.inputs[0].default_value = 1.0
em = nt.nodes.new("ShaderNodeEmission"); out = nt.nodes.new("ShaderNodeOutputMaterial")
nt.links.new(cd.outputs["View Distance"], mth.inputs[0]); nt.links.new(mth.outputs[0], ex.inputs[0]); nt.links.new(ex.outputs[0], inv.inputs[1])
nt.links.new(inv.outputs[0], em.inputs["Color"]); nt.links.new(em.outputs[0], out.inputs["Surface"])
for ob in sc.objects:
    if ob.type == "MESH":
        ob.data.materials.clear(); ob.data.materials.append(hm)
sc.world.node_tree.nodes["Background"].inputs[1].default_value = 0.0
sc.view_settings.view_transform = "Raw"; sc.cycles.samples = 16
bpy.ops.render.render(write_still=True)
im = bpy.data.images.load(tmp); im.colorspace_settings.name = "Non-Color"; im.pixels.foreach_get(a); bpy.data.images.remove(im)
hz = a.reshape(H, W, 4)[::-1]

alpha = col[:, :, 3]
rgb = col[:, :, :3] / np.maximum(alpha[:, :, None], 1e-4)     # un-premultiply the silhouette edges
rgb[alpha < 0.01] = 0
for _ in range(6):                                            # spread colour into the sky so blurred edges never pick up black
    empty = alpha < 0.01
    nb = (np.roll(rgb, 1, 0) + np.roll(rgb, 1, 1) + np.roll(rgb, -1, 1)) / 3
    rgb[empty] = nb[empty]
haze = hz[:, :, 0] / np.maximum(hz[:, :, 3], 1e-4)
low = np.stack([alpha, np.clip(haze, 0, 1), np.zeros_like(alpha)], 2)
img = np.concatenate([np.clip(rgb, 0, 1), low], 0)
os.makedirs(OUT, exist_ok=True)
Image.fromarray((img * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, "hz-prairie.jpg"), quality=86, subsampling=0, optimize=True)
print("[horizon] wrote hz-prairie.jpg: land covers %.0f%% of the band" % (alpha.mean() * 100))
if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True)
    sky = np.array([0.62, 0.68, 0.76])
    look = rgb * (1 - 0.85 * haze[:, :, None]) + sky * 0.85 * haze[:, :, None]
    look = look * alpha[:, :, None] + sky * (1 - alpha[:, :, None])
    Image.fromarray((np.clip(look, 0, 1) * 255).astype(np.uint8)).resize((W, H * 2)).save(os.path.join(PREVIEW, "hz-prairie-look.png"))
