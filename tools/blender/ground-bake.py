"""Ground surfaces baked in Blender: a real patch of each surface is built as geometry, lit by a plain white sky and
photographed straight down, so the picture carries real stones, real gaps and the soft shadow in every gap.

Each surface comes out as two seamless square pictures in tex/:
  gr-<name>.jpg     colour detail. Mid grey (128) means "leave the game's own colour alone", lighter and darker push it up
                    and down (the shader multiplies by pixel*2), so the venue keeps its own colour and gets real grain.
  gr-<name>-n.jpg   the surface's slope (a normal map: red = lean along x, green = lean along z), Full / Ultra only,
                    and only for surfaces rough enough to need one (see SURFACES).

The game samples them in world space (src/vis/strip.js, stripPatchSh and the bk* helpers), one tile every TILE metres.

Run from the repo root:   python3.11 tools/blender/ground-bake.py [OUT_DIR] [--only asphalt] [--preview DIR]
Needs:  python3.11 -m pip install bpy pillow numpy      (bpy 5.0 was used; Cycles on the CPU, about a minute a surface)
--preview DIR also writes a 2x2 tiled PNG of each picture there, to check the seams by eye.
"""
import bpy, sys, os, math
import numpy as np
from PIL import Image

ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
OUT = ARGS[0] if ARGS else "tex"
ONLY = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
PREVIEW = sys.argv[sys.argv.index("--preview") + 1] if "--preview" in sys.argv else None
SIZE = 512            # pixels a side
SAMPLES = 160
RNG = np.random.default_rng(350)


# ---------- scene ----------
def reset(tile):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 3
    sc.cycles.pixel_filter_type = "BLACKMAN_HARRIS"
    sc.cycles.filter_width = 1.6
    sc.render.resolution_x = sc.render.resolution_y = SIZE
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_depth = "16"
    sc.render.image_settings.color_mode = "RGB"
    sc.view_settings.view_transform = "Raw"      # the file holds the numbers as rendered
    sc.view_settings.look = "None"
    sc.display_settings.display_device = "sRGB"
    sc.render.threads_mode = "AUTO"
    cam = bpy.data.cameras.new("cam")
    cam.type = "ORTHO"
    cam.ortho_scale = tile
    cam.clip_start, cam.clip_end = 0.01, 10
    ob = bpy.data.objects.new("cam", cam)
    ob.location = (tile / 2, tile / 2, 2.0)       # looks straight down -Z: picture right = +X, picture up = +Y
    sc.collection.objects.link(ob)
    sc.camera = ob
    w = bpy.data.worlds.new("sky")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    sc.world = w
    return sc


def mat_colour():
    """Matte paint taken from the mesh's 'Col' attribute: under a white sky the render is colour times soft shadow."""
    m = bpy.data.materials.new("col")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    a = nt.nodes.new("ShaderNodeAttribute"); a.attribute_name = "Col"
    d = nt.nodes.new("ShaderNodeBsdfDiffuse")
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(a.outputs["Color"], d.inputs["Color"])
    nt.links.new(d.outputs["BSDF"], o.inputs["Surface"])
    return m


def mat_normal():
    """Glows with its own surface direction, packed 0..1, so a render is the normal map."""
    m = bpy.data.materials.new("nrm")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    g = nt.nodes.new("ShaderNodeNewGeometry")
    mul = nt.nodes.new("ShaderNodeVectorMath"); mul.operation = "MULTIPLY_ADD"
    mul.inputs[1].default_value = (0.5, 0.5, 0.5); mul.inputs[2].default_value = (0.5, 0.5, 0.5)
    e = nt.nodes.new("ShaderNodeEmission")
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(g.outputs["Normal"], mul.inputs[0])
    nt.links.new(mul.outputs[0], e.inputs["Color"])
    nt.links.new(e.outputs[0], o.inputs["Surface"])
    return m


def add_mesh(name, verts, faces, cols, smooth=True):
    """One mesh from numpy arrays: verts (n,3), triangle faces (m,3), a colour per vertex (n,3)."""
    me = bpy.data.meshes.new(name)
    n, f = len(verts), len(faces)
    me.vertices.add(n)
    me.vertices.foreach_set("co", verts.astype(np.float32).ravel())
    me.loops.add(f * 3)
    me.loops.foreach_set("vertex_index", faces.astype(np.int32).ravel())
    me.polygons.add(f)
    me.polygons.foreach_set("loop_start", np.arange(0, f * 3, 3, dtype=np.int32))
    me.polygons.foreach_set("use_smooth", np.full(f, smooth))
    me.update()
    me.validate()
    ca = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    ca.data.foreach_set("color", np.concatenate([cols, np.ones((n, 1))], 1).astype(np.float32).ravel())
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def icosphere(sub):
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
    v = np.array([p.co[:] for p in bm.verts])
    f = np.array([[p.index for p in t.verts] for t in bm.faces])
    bm.free()
    return v, f


def wrap_copies(pos, reach, tile):
    """The patch must tile: anything within `reach` of an edge is repeated on the far side. Returns the shifts to draw."""
    out = []
    for dx in (-tile, 0, tile):
        for dy in (-tile, 0, tile):
            x, y = pos[:, 0] + dx, pos[:, 1] + dy
            keep = (x > -reach) & (x < tile + reach) & (y > -reach) & (y < tile + reach)
            out.append((np.nonzero(keep)[0], dx, dy))
    return out


def pnoise(x, y, tile, seed, octaves=3, base=2):
    """Smooth noise that repeats exactly every `tile`: a sum of whole-number sine waves."""
    r = np.random.default_rng(seed)
    s = np.zeros_like(x)
    amp = 1.0
    for o in range(octaves):
        k = base * 2 ** o
        for _ in range(4):
            kx, ky = r.integers(-k, k + 1), r.integers(-k, k + 1)
            if kx == 0 and ky == 0:
                kx = k
            s += amp * np.sin(2 * math.pi * (kx * x + ky * y) / tile + r.uniform(0, 6.28))
        amp *= 0.5
    return s / 4.0


def stones(tile, spacing, rmin, rmax, sub, seed, drop, palette, sink, wear, film):
    """A layer of crushed stone on a jittered honeycomb grid, pressed into the binder and worn flat on top.
    palette: rows of (share, r, g, b, spread). sink: how far (0..1 of its radius) a stone sits below the wear plane.
    wear: the height everything above is ground off at. film: the binder colour that still coats a stone's flanks."""
    r = np.random.default_rng(seed)
    nx = int(round(tile / spacing)); sx = tile / nx
    ny = int(round(tile / (spacing * 0.866) / 2)) * 2; sy = tile / ny
    gx, gy = np.meshgrid(np.arange(nx), np.arange(ny))
    px = (gx + 0.5 * (gy % 2)) * sx + r.uniform(-0.34, 0.34, gx.shape) * sx
    py = gy * sy + r.uniform(-0.34, 0.34, gx.shape) * sy
    pos = np.stack([px.ravel() % tile, py.ravel() % tile], 1)
    n = len(pos)
    rad = r.uniform(rmin, rmax, n) * (1 + 0.25 * pnoise(pos[:, 0], pos[:, 1], tile, seed + 1, 2, 3))
    keep = r.uniform(0, 1, n) > drop * (1 + 1.5 * np.clip(pnoise(pos[:, 0], pos[:, 1], tile, seed + 2, 2, 2), -0.6, 2))
    # colour: pick a stone type per stone, then a little spread
    pal = np.array(palette, float)
    which = r.choice(len(pal), n, p=pal[:, 0] / pal[:, 0].sum())
    col = pal[which, 1:4] * (1 + pal[which, 4:5] * r.uniform(-1, 1, (n, 1)))
    # shape: a few lumpy base stones, each instance squashed, turned and sunk differently
    bv, bf = icosphere(sub)
    nvar = 24
    var = np.stack([bv * (1 + r.uniform(-0.2, 0.2, (len(bv), 1))) for _ in range(nvar)])
    vi = r.integers(0, nvar, n)
    sc = np.stack([rad * r.uniform(0.75, 1.25, n), rad * r.uniform(0.75, 1.25, n), rad * r.uniform(0.55, 1.0, n)], 1)
    ang = r.uniform(0, 6.283, n); ca, sa = np.cos(ang), np.sin(ang)
    cz = wear - sc[:, 2] * (sink[0] + (sink[1] - sink[0]) * r.uniform(0, 1, n))
    top = wear - r.uniform(0, 0.0007, n)          # each stone polished to its own height, within 0.7 mm
    V, F, C = [], [], []
    base = 0
    for idx, dx, dy in wrap_copies(pos, rmax * 2.5, tile):
        idx = idx[keep[idx]]
        if not len(idx):
            continue
        v = var[vi[idx]] * sc[idx][:, None, :]
        x = v[:, :, 0] * ca[idx][:, None] - v[:, :, 1] * sa[idx][:, None] + pos[idx, 0][:, None] + dx
        y = v[:, :, 0] * sa[idx][:, None] + v[:, :, 1] * ca[idx][:, None] + pos[idx, 1][:, None] + dy
        z = np.minimum(v[:, :, 2] + cz[idx][:, None], top[idx][:, None])
        worn = np.clip((z - (top[idx][:, None] - 0.0012)) / 0.0012, 0, 1)      # 1 on the ground-off face, 0 on the coated flank
        c = film[None, None, :] + (col[idx][:, None, :] - film[None, None, :]) * (0.12 + 0.88 * worn[:, :, None])
        m, k = v.shape[0], v.shape[1]
        V.append(np.stack([x, y, z], 2).reshape(-1, 3)); C.append(c.reshape(-1, 3))
        F.append((bf[None, :, :] + (base + np.arange(m) * k)[:, None, None]).reshape(-1, 3))
        base += m * k
    return np.concatenate(V), np.concatenate(F), np.concatenate(C)


def binder(tile, z, colour, grain, seed, n=360, mottle=0.0, pits=0, pit_r=(0.002, 0.004), pit_d=0.0015, pit_dark=0.5):
    """The bed between the stones: a fine grid, a little bigger than the tile, with a sandy ripple. mottle: slow light and
    dark clouds in its colour. pits: how many small round holes (air bubbles, popped stones) to press into it."""
    ext = 0.04
    cells = int(round(n * (tile + 2 * ext) / tile))
    step = tile / n                                   # a whole number of cells per tile, so the ripple repeats too
    u = (np.arange(cells + 1) - round(ext / step)) * step
    x, y = np.meshgrid(u, u)
    r = np.random.default_rng(seed)
    rip = r.uniform(-1, 1, (n, n))
    ix = np.round(x / step).astype(int) % n; iy = np.round(y / step).astype(int) % n
    h = z + grain * rip[iy, ix]
    shade = 1 + 0.12 * rip[(iy + 7) % n, (ix + 3) % n] + mottle * pnoise(x % tile, y % tile, tile, seed + 3, 3, 5)
    if pits:
        px, py = r.uniform(0, tile, pits), r.uniform(0, tile, pits)
        pr = r.uniform(pit_r[0], pit_r[1], pits)
        dent = np.zeros_like(h)
        for cx, cy, rr in zip(px, py, pr):
            dx = (x - cx + tile / 2) % tile - tile / 2; dy = (y - cy + tile / 2) % tile - tile / 2
            dent = np.maximum(dent, np.clip(1 - (dx * dx + dy * dy) / (rr * rr), 0, 1))
        h -= pit_d * dent ** 0.6
        shade *= 1 - pit_dark * dent
    v = np.stack([x.ravel(), y.ravel(), h.ravel()], 1)
    m = cells + 1
    i = np.arange(m * m).reshape(m, m)
    a, b, c, d = i[:-1, :-1].ravel(), i[:-1, 1:].ravel(), i[1:, 1:].ravel(), i[1:, :-1].ravel()
    f = np.concatenate([np.stack([a, b, c], 1), np.stack([a, c, d], 1)])
    col = np.array(colour)[None, :] * shade.ravel()[:, None]
    return v, f, col


# ---------- surfaces ----------
def asphalt(tile):
    """A worn road top: 6 to 13 mm crushed stone in black binder, the high stones ground flat and pale by traffic,
    smaller chips in between, the odd stone plucked out to leave a pit."""
    film = np.array([0.030, 0.029, 0.028])
    pal = [(0.50, 0.30, 0.30, 0.31, 0.22),      # grey granite
           (0.20, 0.21, 0.21, 0.225, 0.2),      # darker grey
           (0.12, 0.38, 0.33, 0.27, 0.2),       # tan
           (0.10, 0.11, 0.11, 0.12, 0.25),      # basalt
           (0.08, 0.52, 0.50, 0.47, 0.15)]      # pale quartz
    add_mesh("big", *stones(tile, 0.0095, 0.0036, 0.0068, 2, 11, 0.035, pal, (0.25, 0.8), 0.0, film))
    add_mesh("chips", *stones(tile, 0.0058, 0.0014, 0.0030, 1, 23, 0.10, pal, (0.9, 1.9), 0.0, film))
    add_mesh("bed", *binder(tile, -0.0030, (0.034, 0.033, 0.032), 0.0004, 5, n=400))


def concrete(tile):
    """A drag strip's launch pad: hard concrete ground smooth, so the sand and small stone in the mix show as speckle in
    pale cement, with clouds of lighter and darker cement, a few air-bubble pits and a faint brushed grain."""
    paste = np.array([0.36, 0.352, 0.335])
    pal = [(0.34, 0.33, 0.325, 0.315, 0.25),    # grey stone
           (0.26, 0.42, 0.37, 0.29, 0.2),       # sand
           (0.14, 0.16, 0.16, 0.165, 0.3),      # dark stone
           (0.14, 0.55, 0.53, 0.50, 0.12),      # white quartz
           (0.12, 0.30, 0.21, 0.15, 0.2)]       # red-brown
    add_mesh("stone", *stones(tile, 0.0125, 0.0024, 0.0066, 2, 31, 0.0, pal, (0.0, 0.75), 0.0, paste))
    add_mesh("sand", *stones(tile, 0.0052, 0.0011, 0.0026, 1, 37, 0.12, pal, (0.0, 0.8), 0.0, paste))
    add_mesh("bed", *binder(tile, -0.00035, paste, 0.00025, 9, n=900, mottle=0.035, pits=900, pit_r=(0.0025, 0.0065), pit_d=0.0024, pit_dark=0.55))


# name: (builder, tile size in metres, slope picture too?). Ground-smooth concrete is so nearly flat that its slope picture
# is mostly JPEG noise (and 190 KB once amplified enough to beat it), so it ships colour only.
# Keep the tile sizes and the slope flags in step with STRIP_BAKES in src/vis/strip.js.
SURFACES = {"asphalt": (asphalt, 1.9, True), "concrete": (concrete, 2.3, False)}


# ---------- render and pack ----------
def render_to(path, material):
    for ob in bpy.context.scene.objects:
        if ob.type == "MESH":
            ob.data.materials.clear(); ob.data.materials.append(material)
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(path)               # Blender reads its own 16-bit file back at full depth (Pillow would drop it to 8)
    im.colorspace_settings.name = "Non-Color"
    a = np.empty(SIZE * SIZE * 4, np.float32)
    im.pixels.foreach_get(a)
    bpy.data.images.remove(im)
    return a.reshape(SIZE, SIZE, 4)[::-1].astype(np.float64)      # rows come bottom-up


def tiled(a):
    return np.concatenate([np.concatenate([a, a], 1)] * 2, 0)


def bake(name):
    build, tile, slope = SURFACES[name]
    sc = reset(tile)
    build(tile)
    tmp = os.path.join(bpy.app.tempdir, "gr_")
    col = render_to(tmp + "c.png", mat_colour())[:, :, :3]
    sc.cycles.samples = 48
    sc.world.node_tree.nodes["Background"].inputs[1].default_value = 0.0
    nrm = render_to(tmp + "n.png", mat_normal())[:, :, :3]
    # colour: divide out the average so the picture only says "lighter / darker than the venue's own colour"
    mult = col / col.mean(axis=(0, 1), keepdims=True)
    lum = mult.mean(axis=2)
    c8 = np.clip(mult * 0.5, 0, 1)
    # slope: re-normalise after the anti-alias blur, keep x and y, drop z (the shader rebuilds it)
    n = nrm * 2 - 1
    n /= np.maximum(np.linalg.norm(n, axis=2, keepdims=True), 1e-6)
    n8 = np.clip(n * 0.5 + 0.5, 0, 1)
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray((c8 * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, "gr-%s.jpg" % name), quality=80, subsampling=2, optimize=True)
    if slope:
        Image.fromarray((n8 * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, "gr-%s-n.jpg" % name), quality=82, subsampling=0, optimize=True)
    print("[ground-bake] %s: tile %.2f m, detail x%.2f..x%.2f (5th..95th), mean slope %.3f" % (
        name, tile, np.percentile(lum, 5), np.percentile(lum, 95), np.abs(n[:, :, :2]).mean()))
    if PREVIEW:
        os.makedirs(PREVIEW, exist_ok=True)
        Image.fromarray((tiled(c8) * 255).astype(np.uint8)).save(os.path.join(PREVIEW, "gr-%s-2x2.png" % name))
        if slope:
            Image.fromarray((tiled(n8) * 255).astype(np.uint8)).save(os.path.join(PREVIEW, "gr-%s-n-2x2.png" % name))
        # and roughly what it does to a road-grey: the colour picture times 0.3, shown brighter
        Image.fromarray((np.clip(tiled(mult) * 0.3, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8)).save(os.path.join(PREVIEW, "gr-%s-look.png" % name))


for nm in SURFACES:
    if ONLY is None or ONLY == nm:
        bake(nm)
