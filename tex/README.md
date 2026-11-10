# Baked art

Pictures rendered in Blender for the game, all our own work (Longlight Interactive, CC0). Nothing here is drawn by
hand or downloaded: each file comes out of a script in `tools/blender/`, so a change is an edit to the script and a
re-run. Keep this list in step with the folder.

| File | What | Made by | Used in |
|---|---|---|---|
| `env-workshop.jpg` | The career workshop seen from the engine stand, all the way round: what chrome and paint mirror | `tools/blender/workshop-env.py` | `envPanoUse` in `src/vis/core.js` |
| `env-testcell.jpg` | The same for the test cell | `tools/blender/workshop-env.py` | `envPanoUse` in `src/vis/core.js` |

To re-render: `python3.11 -m pip install bpy pillow`, then `python3.11 tools/blender/workshop-env.py` (about five
minutes on four cores), then `node build.js` so the service worker's media cache name picks up the new files.

The two `env-*` pictures look washed out when opened directly: they store bright lights on a log curve that the game
undoes (see the top of the script). Add `--preview` to get a normal-looking PNG beside each one.
