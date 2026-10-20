# Prairie Engine Works

Design, tune and race engines in the browser. Prairie Engine Works is a physics-based engine builder with a career mode: pick a layout, choose the parts, put it on the dyno, then take it to the strip, the sled, the salt or the track.

**Play it: <https://jxstrr0.github.io/350Chev/>**

It runs on phones and desktops. Install it from the browser ("Add to Home Screen" or the install button) and it works offline.

## What's in it

- **Build:** layout, bore and stroke, heads, cams, induction, boost, fuel, exhaust and materials, with a 3D engine that follows your choices.
- **Test:** dyno pulls, endurance runs to failure and over-rev tests.
- **Events:** the drag strip, truck and tractor pulls, mud bogs, boat drags, the salt flats, a road test, the Pikes Peak hill climb, a dirt oval, the 24 Hours of Prairie Sky endurance race, and swap jobs that put your engine in someone else's car.
- **Analysis:** material and combo interactions, telemetry and the engineer's notes.
- **Career:** run the shop. Certify engines, sell them on the market, hire crew and buy upgrades.
- **Sound:** a live engine synth, optionally blended with real recordings (credits in [`sounds/CREDITS.md`](sounds/CREDITS.md)).
- **Saves:** back up and restore with a `PEW1:` / `PEW2:` save code.

## Working on it

There are no dependencies and no package.json, only node (14 or newer).

- `index.html` and `sw.js` are generated. Edit the files in `src/`, then rebuild:

  ```
  node build.js            # rebuild index.html and sw.js from src/
  node build.js --check    # fails if index.html or sw.js is out of date
  node check-savecode.js   # save-code round-trip checks
  ```

- [`src/README.md`](src/README.md) has the file map and the build details.
- [`CLAUDE.md`](CLAUDE.md) has the project rules: versions, commits, and how to run the physics in node.
- To play a local copy, serve the folder with any static file server (for example `python3 -m http.server`) and open it in a browser.

GitHub Pages serves `index.html` from `main`.
