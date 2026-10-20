# Notes for Claude

Prairie Engine Works is a single-page browser game: an engine builder with physics, sound, three.js scenes and a career mode. GitHub Pages serves `index.html` from `main`. There are no dependencies, no package.json and no CI, so the checks below are the only gate.

## Source and build

- **Edit `src/`, never `index.html` or `sw.js`.** Both are generated: `node build.js` concatenates the files listed in `src/manifest.txt`, byte for byte, then writes `sw.js`.
- Commit `src/`, `index.html` and `sw.js` together.
- `src/README.md` has the file map (which file holds what) and the merge-conflict and `--absorb` workflows. Read it before moving code or adding a file.
- `src/` files are slices of one page, so a file may open or close mid-IIFE. `node --check` on one file means nothing; test the built page.
- A new `src/` file must go into `src/manifest.txt` at the right position, or the build refuses to run.
- To find code, grep `src/`: `grep -rn "function dragPass" src/`.

## Before every commit

```
node build.js            # rebuild index.html and sw.js
node build.js --check    # must pass
node check-savecode.js   # must pass (save code round trips)
```

## Versions

- Every release bumps `const VERSION="x.y.z.w";` in `src/app/state.js` (major.minor.feature.hotfix). The build folds it into the `sw.js` cache name, which is what shows installed copies the "New version ready" bar.
- A gameplay or feature change bumps the third number; a fix to the last release bumps the fourth.
- The `<!-- VERSION -->` comment in `src/html/head.html` is stale and nothing reads it.

## Testing the sim in node

The physics (`ENGINE_SIM`) runs in plain node. Cut the bundle out of the built page; it already ends with `module.exports = ENGINE_SIM`, so don't add another export:

```
node -e 'const h=require("fs").readFileSync("index.html","utf8"),i=h.indexOf("Prairie Engine Works v2 — physics core");
require("fs").writeFileSync("/tmp/sim.js",h.slice(h.lastIndexOf("<script>",i)+8,h.indexOf("</script>",i)))'
node -e 'const SIM=require("/tmp/sim.js"); console.log(Object.keys(SIM))'
```

When changing physics, run a before/after comparison on the affected events and put the numbers in the commit message.

## Players' save codes

Players may paste their `PEW1:` / `PEW2:` backup codes to debug a car. That is their personal data: decode and run it locally only, never send it to an outside service, and don't commit it.

## Commits and pull requests

- Commit subject: `Area: what changed` (for example `Strip: converter flash stays under the shift point`). Explain the why in the body.
- Work on a `claude/...` branch and open PRs as drafts. Merge with a merge commit titled `x.y.z.w: summary`.
