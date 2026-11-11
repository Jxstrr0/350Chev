# Model credits

3D models used by the workshop (`src/vis/models.js`), the pull track (`PULL_PROPS` in `src/vis/pull.js`), the drag pits (`PITS_MODELS` in `src/vis/pits.js`) and Pikes Peak (`hillModels` in `src/vis/hill.js`) on Full and Ultra graphics. Lite never loads them.
Each downloaded one is packed for the game with `tools/pack-model.py`: textures cut to 256 px (normal maps 128 px) and vertex data quantized. The `hill-*` files are our own, modelled in Blender by `tools/blender/hill-props.py` (flat colours, no textures); edit that script and re-run it to change them.
Keep this file in step with the folder: every model listed with its source, author and licence.

| File | Model | Author | Source | Licence |
|---|---|---|---|---|
| `welding-cart.glb` | Portable Welding Cart | Georgii Gorbunov | [Poly Haven](https://polyhaven.com/a/portable_welding_cart) | CC0 |
| `jerrycan.glb` | Metal Jerrycan Green | Ulan Cabanilla | [Poly Haven](https://polyhaven.com/a/metal_jerrycan_green) | CC0 |
| `propane-tank.glb` | Propane Tank | Slinc | [Poly Haven](https://polyhaven.com/a/propane_tank) | CC0 |
| `extinguisher.glb` | Korean Fire Extinguisher 01 | UM JOORIN | [Poly Haven](https://polyhaven.com/a/korean_fire_extinguisher_01) | CC0 |
| `spray-paint.glb` | Spray Paint Bottles | James Ray Cock | [Poly Haven](https://polyhaven.com/a/spray_paint_bottles) | CC0 |
| `lube-spray.glb` | Lubricant Spray | James Ray Cock | [Poly Haven](https://polyhaven.com/a/lubricant_spray) | CC0 |
| `generator.glb` | Portable Generator | James Ray Cock | [Poly Haven](https://polyhaven.com/a/portable_generator) | CC0 |
| `plastic-crate.glb` | Plastic Crate 01 | PierreB3D | [Poly Haven](https://polyhaven.com/a/plastic_crate_01) | CC0 |
| `barrel.glb` | Barrel 03 | Serhii Khromov | [Poly Haven](https://polyhaven.com/a/barrel_03) | CC0 |
| `toolbox.glb` | Metal Toolbox | Mateusz Sadek | [Poly Haven](https://polyhaven.com/a/metal_toolbox) | CC0 |
| `hand-truck.glb` | Hand Truck | Mutanzom3D | [Poly Haven](https://polyhaven.com/a/hand_truck) | CC0 |
| `plastic-jerrycan.glb` | Plastic Jerrycan | Ulan Cabanilla | [Poly Haven](https://polyhaven.com/a/plastic_jerrycan) | CC0 |
| `old-tyre.glb` | Old Tyre | MP | [Poly Haven](https://polyhaven.com/a/old_tyre) | CC0 |
| `hill-summit.glb` | Summit visitor centre | Longlight Interactive | `tools/blender/hill-props.py` | CC0 |
| `hill-start.glb` | Start gantry and timing hut | Longlight Interactive | `tools/blender/hill-props.py` | CC0 |
| `hill-marshal.glb` | Corner marshal post | Longlight Interactive | `tools/blender/hill-props.py` | CC0 |
| `hill-rock.glb` | Granite boulder | Longlight Interactive | `tools/blender/hill-props.py` | CC0 |
| `hill-fir.glb` | Fir, two levels of detail | Longlight Interactive | `tools/blender/hill-props.py` | CC0 |
| `eng-parts.glb` | The engine's small parts: flange bolt, stud and nut, pulley bolt, rivet, AN nut, hose clamp, two ignition coils, plug boot, wiring plug (geometry only) | Longlight Interactive | `tools/blender/engine-parts.py` | CC0 |

CC0 needs no credit, but we give it anyway. A CC-BY model must be listed here with its author and a link, and the same line goes in the game's credits.
