# Baked art

Pictures rendered in Blender for the game, all our own work (Longlight Interactive, CC0). Nothing here is drawn by
hand or downloaded: each file comes out of a script in `tools/blender/`, so a change is an edit to the script and a
re-run. Keep this list in step with the folder.

| File | What | Made by | Used in |
|---|---|---|---|
| `env-workshop.jpg` | The career workshop seen from the engine stand, all the way round: what chrome and paint mirror | `tools/blender/workshop-env.py` | `envPanoUse` in `src/vis/core.js` |
| `env-testcell.jpg` | The same for the test cell | `tools/blender/workshop-env.py` | `envPanoUse` in `src/vis/core.js` |
| `gr-asphalt.jpg` | Road asphalt from straight above, one seamless 1.9 m tile: about 60,000 crushed stones in black binder, worn flat on top | `tools/blender/ground-bake.py` | `bkAsph` in `src/vis/strip.js` (every tier) |
| `gr-asphalt-n.jpg` | The slope of that same patch (a normal map), so each stone catches the sun | `tools/blender/ground-bake.py` | `bkAsph`, Full / Ultra only |
| `gr-concrete.jpg` | Ground-smooth concrete, one seamless 2.3 m tile: sand and stone speckle in pale cement, air-bubble pits | `tools/blender/ground-bake.py` | `bkConc` in `src/vis/strip.js` (every tier) |

To re-render: `python3.11 -m pip install bpy pillow numpy`, then `python3.11 tools/blender/workshop-env.py` (about
five minutes on four cores) or `python3.11 tools/blender/ground-bake.py` (under a minute a surface; `--only asphalt`
does one), then `node build.js` so the service worker's media cache name picks up the new files.

The two `env-*` pictures look washed out when opened directly: they store bright lights on a log curve that the game
undoes (see the top of the script). Add `--preview` to get a normal-looking PNG beside each one.

The `gr-*` ground pictures are mid grey on average on purpose. The game multiplies a venue's own ground colour by
`pixel * 2`, so grey means "no change" and the picture only adds the grain: lighter stones, darker gaps. That keeps
every venue's colour where it was and lets one asphalt picture serve the strip, the road course and the pits. Add
`--preview DIR` to get a 2x2 tiled copy of each (to check the seams) and a `-look.png` showing it on a road grey.
Concrete ships colour only: ground-smooth concrete has too little slope to survive JPEG without showing its
8-pixel blocks as facets. A new surface is a new builder in the script, a line in its `SURFACES` table and a line in `STRIP_BAKES` in
`src/vis/strip.js`.
