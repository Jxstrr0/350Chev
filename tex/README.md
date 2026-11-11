# Baked art

Pictures rendered in Blender for the game, all our own work (Longlight Interactive, CC0). Nothing here is drawn by
hand or downloaded: each file comes out of a script in `tools/blender/`, so a change is an edit to the script and a
re-run. Keep this list in step with the folder.

| File | What | Made by | Used in |
|---|---|---|---|
| `env-workshop.jpg` | The career workshop seen from the engine stand, all the way round: what chrome and paint mirror | `tools/blender/workshop-env.py` | `envPanoUse` in `src/vis/core.js` |
| `env-testcell.jpg` | The same for the test cell | `tools/blender/workshop-env.py` | `envPanoUse` in `src/vis/core.js` |
| `fx-smoke.jpg` | One smoke puff over its life, 16 frames in a 4 x 4 grid: red = density, green = baked light (square root) | `tools/blender/smoke-flipbook.py` | `stripFlipUse` in `src/vis/strip-run.js`, Full / Ultra: the particle smoke at salt, road, ovals, pull, hill, pits, boat |
| `gr-asphalt.jpg` | Road asphalt from straight above, one seamless 1.9 m tile: about 60,000 crushed stones in black binder, worn flat on top | `tools/blender/ground-bake.py` | `bkAsph` in `src/vis/strip.js` (every tier): the drag strip, the road course, the hill road, the pits floor and the paved oval |
| `gr-asphalt-n.jpg` | The slope of that same patch (a normal map), so each stone catches the sun | `tools/blender/ground-bake.py` | `bkAsph`, Full / Ultra only |
| `gr-concrete.jpg` | Ground-smooth concrete, one seamless 2.3 m tile: sand and stone speckle in pale cement, air-bubble pits | `tools/blender/ground-bake.py` | `bkConc` in `src/vis/strip.js` (every tier) |
| `gr-dirt.jpg` | Packed track clay, one seamless 1.4 m tile: a lumpy bed with crumbs, loose clods and the odd pebble | `tools/blender/ground-bake.py` | `bkDirt` in `src/vis/strip.js` (every tier): the pull track and its worn infield, the dirt oval, the mud bog's dirt |
| `gr-dirt-n.jpg` | The slope of that same patch, so each clod catches the sun | `tools/blender/ground-bake.py` | `bkDirt`, Full / Ultra only |
| `gr-salt.jpg` | Salt-flat crust, one seamless 1.6 m tile: plates a hand or two across, low white ridges where they meet, loose crystals | `tools/blender/ground-bake.py` | `bkSalt` in `src/vis/strip.js` (every tier): the salt flats |
| `gr-salt-n.jpg` | The slope of that same patch, so the ridges catch the sun | `tools/blender/ground-bake.py` | `bkSalt`, Full / Ultra only |
| `gr-grass.jpg` | Mown grass from above, one seamless 1 m tile: a dense lawn of blades with soil and thatch in the gaps, grey only | `tools/blender/ground-bake.py` | `bkGrass` in `src/vis/strip.js` (every tier): the grass at the strip, road course, ovals, pull, bog and boat ramp |
| `gr-shop.jpg` | Power-trowelled workshop concrete, one seamless 2 m tile: sand speckle, trowel mottle, the odd pore | `tools/blender/ground-bake.py` | `MAT.concrete` (the career workshop floor) via `aaPatch` in `src/vis/core.js` (every tier) |
| `hz-prairie.jpg` | The far prairie all the way round from eye height, three degrees tall: shelterbelts, farmsteads, elevator towns, a low ridge; colour on top, coverage and distance haze below | `tools/blender/horizon.py` | `stripSkyMat` in `src/vis/strip.js` (every tier): behind every outdoor venue and in their reflections |
| `sf-castiron.jpg` | The skin a sand mould leaves on cast iron, one seamless 60 mm tile: lumps a millimetre or two across, a gritty tooth, fused sand grains, gas pits; grey only | `tools/blender/ground-bake.py` | `heatPatchHi` in `src/vis/core.js` (Full / Ultra): iron and CGI blocks and heads, cast exhaust manifolds |
| `sf-castiron-n.jpg` | The slope of that same patch, so each lump catches the light | `tools/blender/ground-bake.py` | `heatPatchHi`, Full / Ultra |
| `sf-castalu.jpg` | The finer skin a metal mould leaves on cast aluminium, one seamless 60 mm tile: soft lumps, a satin tooth, the odd pore; grey only | `tools/blender/ground-bake.py` | `heatPatchHi` (Full / Ultra): cast aluminium blocks, heads and covers |
| `sf-castalu-n.jpg` | The slope of that same patch | `tools/blender/ground-bake.py` | `heatPatchHi`, Full / Ultra |
| `sf-machined.jpg` | Machined aluminium, one seamless 60 mm tile: straight tool marks just under a millimetre apart, a little chatter, a few handling scratches; goes on pulleys, brackets and other machined parts | `tools/blender/ground-bake.py` | `heatPatchHi`, Full / Ultra |
| `sf-machined-n.jpg` | The slope of that same patch | `tools/blender/ground-bake.py` | `heatPatchHi`, Full / Ultra |
| `sf-paint.jpg` | Sprayed enamel, one seamless 60 mm tile: orange peel and the odd dust nib; goes on painted parts and gloss or satin cam covers | `tools/blender/ground-bake.py` | `heatPatchHi`, Full / Ultra |
| `sf-paint-n.jpg` | The slope of that same patch | `tools/blender/ground-bake.py` | `heatPatchHi`, Full / Ultra |
| `sh-contact.jpg` | Soft contact shadows, three cells: a box standing on the floor, a top on four legs, a drum; white = open floor | `tools/blender/contact-shadow.py` | `contactShadow` in `src/vis/core.js` (every tier): workshop furniture, the dyno bed, trophy plinths, the pits' cart and cooler |

To re-render: `python3.11 -m pip install bpy pillow numpy`, then `python3.11 tools/blender/workshop-env.py` (about
five minutes on four cores) or `python3.11 tools/blender/ground-bake.py` (under a minute a surface; `--only asphalt`
does one), `contact-shadow.py`, `horizon.py` or `smoke-flipbook.py` (a few minutes; `--preview DIR` writes a normal-looking copy), then `node build.js` so the service worker's media cache name picks up the new files.

The two `env-*` pictures look washed out when opened directly: they store bright lights on a log curve that the game
undoes (see the top of the script). Add `--preview` to get a normal-looking PNG beside each one.

The `gr-*` ground pictures are mid grey on average on purpose. The game multiplies a venue's own ground colour by
`pixel * 2`, so grey means "no change" and the picture only adds the grain: lighter stones, darker gaps. That keeps
every venue's colour where it was and lets one asphalt picture serve the strip, the road course and the pits. Add
`--preview DIR` to get a 2x2 tiled copy of each (to check the seams) and a `-look.png` showing it on a road grey.
Concrete ships colour only: ground-smooth concrete has too little slope to survive JPEG without showing its
8-pixel blocks as facets. A new surface is a new builder in the script, a line in its `SURFACES` table and a line in `STRIP_BAKES` in
`src/vis/strip.js`.
