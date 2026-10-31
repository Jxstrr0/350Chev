# PEW UI upgrade: Shop Glass + reactive UI

Build brief for Prairie Engine Works (repo `Jxstrr0/350Chev`). Written against **1.76.34.0**. Hand this file to a Claude Code session, e.g.:

> Read `CLAUDE.md`, then `docs/UI-GLASS-PLAN.md`. Do PR 1 only. Stop when it's merged and give me the phone test.

Commit this file as `docs/UI-GLASS-PLAN.md` so every session can find it. Tick off PRs in the checklist at the bottom as they land.

---

## 0. Ground rules (from CLAUDE.md, restated so they aren't skipped)

- Edit `src/` only. Run `node build.js`, `node build.js --check`, `node check-savecode.js` before every commit. Commit `src/`, `index.html`, `sw.js` together.
- One `claude/...` branch + PR per section below. Keep each PR readable on a phone. Bump the **third** VERSION number (`src/app/state.js`) per PR.
- **Lite is the phone default and must keep working.** Every effect here needs a Lite path that is cheaper, not just "off".
- Respect `prefers-reduced-motion` (style.css already kills animations under it) and add `prefers-reduced-transparency` fallbacks.
- Light theme (`:root[data-theme=light]`) must get every change too.
- Real design decisions get asked, not guessed. Open questions are listed in section 9. Ask them before the PR they affect.
- End each PR with a plain-language "what changed / how to test on a phone" summary.

## 1. Direction: "Shop Glass"

Apple-style Liquid Glass, but still PEW: an engine shop at night. It isn't iOS Settings.

- **Glass surfaces**: frosted, translucent, saturated, with a bright 1px rim that's lighter top-left and fades bottom-right. They get large radii (16–22px) and float off the edges.
- **Keep the brand**: orange `--orange`/`--orange2`, Chakra Petch / Barlow / IBM Plex Mono, the dark soot base.
- **Race CTAs keep their chamfer**: `.btn.pri`, `.btn.ok`, `.btn.danger` (Run, Stage the car, etc.) keep the `clip-path` chamfer and glow lines. They get a glossy gel surface (top highlight gradient + inner shadow) instead of the flat fill. Everything else goes rounded glass. *(This is the default. Confirm with Kelbo, see Q1.)*
- **Glass needs something behind it.** Flat `#141413` under frosted panels just reads grey, so PR 1 adds an ambient backdrop and overlaps the panel onto the 3D view.

---

## 2. PR 1: Glass foundation + tab bar + HUD

**New file `src/css/ui-glass.css`**, added to `src/manifest.txt` as the **last CSS file** (just before `html/body.html`). Putting it last means it overrides the scattered base rules without editing them. Start it with the usual "what this file styles" comment.

### 2a. Tokens + one shared class

```css
:root{
  --glass-bg: rgba(28,27,25,.52);
  --glass-bg-strong: rgba(28,27,25,.72);      /* sheets, popups: text-heavy */
  --glass-blur: 20px; --glass-sat: 170%;
  --glass-rim: linear-gradient(135deg, rgba(255,255,255,.28), rgba(255,255,255,.06) 40%, rgba(255,255,255,.02) 70%, rgba(255,255,255,.12));
  --glass-shine: inset 0 1px 0 rgba(255,255,255,.14), inset 0 -1px 0 rgba(0,0,0,.25);
  --glass-shadow: 0 10px 30px rgba(0,0,0,.45);
  --glass-tint: 217,119,87;                   /* r,g,b: PR 3 drives this from the venue */
  --glass-heat: 0;                            /* 0..1: PR 3 drives this from rpm */
  --r-glass: 18px;
}
:root[data-theme=light]{ --glass-bg: rgba(255,255,255,.58); --glass-bg-strong: rgba(255,255,255,.78); --glass-rim: linear-gradient(135deg, rgba(255,255,255,.9), rgba(255,255,255,.3) 50%, rgba(20,20,19,.08)); --glass-shadow: 0 10px 30px rgba(20,20,19,.12); }
```

Apply it through one shared class, `.glass`, plus a selector list for existing elements (so markup changes stay minimal):
`background: var(--glass-bg)`, `backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat))` (+ `-webkit-`), `box-shadow: var(--glass-shine), var(--glass-shadow)`, `border-radius: var(--r-glass)`. Draw the gradient rim with a `::before` mask-border trick (`padding:1px; mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)`), not `border`. Elements that already use `::before`/`::after` (tabs, `.btn`) need a wrapper or `background-clip` approach instead. Check before reusing the pseudo-element.

### 2b. Blur scales by graphics tier

- In `applyGfx()` (`src/app/state.js`), add `document.documentElement.dataset.gfx=q;`.
- `html[data-gfx=lite]{--glass-blur:12px;--glass-sat:150%}`, `[data-gfx=ultra]{--glass-blur:28px}`.
- `@media (prefers-reduced-transparency: reduce)` and a `html.noglass` class: swap `--glass-bg` to the solid `--panel` and drop `backdrop-filter`.
- `perf.js` auto-drop: if it drops to Lite **and** still stutters, also add `html.noglass`. Show the same toast style it already uses. *(See Q2 on whether this should also be a Settings toggle.)*

### 2c. Ambient backdrop + panel overlap

- Behind `#panel`: a fixed, `pointer-events:none` layer with 2–3 large, heavily blurred radial glows (dim orange from `--glass-tint`, steel blue `--info`), slowly drifting (60s+ loop, paused under reduced-motion). Pure CSS, with no canvas.
- `#view` bottom edge: fade into the panel with a gradient (or `mask-image`) so there's no hard line.
- `#panel` gets `margin-top:-22px`, a rounded top (`border-radius:22px 22px 0 0`), and glass. The sheet now visibly sits **on** the 3D scene. Check `rvBand()` in `src/app/runview.js` and `ENGINE_VIS.setBand` still frame the event cameras correctly, and that `#app.mini` / `html.onevent` / `html.desk` layouts still work.

### 2d. Floating tab bar (`#tabs`, base rules ~line 678 and 1372 of style.css)

- Pill inset 10px from the sides and bottom (`bottom: calc(10px + env(safe-area-inset-bottom))`), radius 26px, glass, with a stronger blur than panels.
- Replace the `button.on::before` top bar with a **sliding glass bead**: one absolutely positioned element inside `#tabs`. Move it in `showTab()` (`src/app/boot.js` ~line 132) by setting `--bead-x` from the active button's `offsetLeft`/`offsetWidth`. Animate with spring-ish easing `cubic-bezier(.34,1.56,.64,1)` over ~380ms.
- Keep `#tabs .dot` badges and `#testProg` working and visible.
- Update `--tabh` / `#panel` bottom padding / `#toast` `--tbot` so nothing hides behind the floating bar.

### 2e. HUD buttons (`.hudbtns>button`, `.hudtray`)

- Circles become clear glass: low-alpha bg, rim, shine.
- The "on" state becomes an inner orange glow (`box-shadow: inset 0 0 14px rgba(var(--glass-tint),.55)`) instead of an orange border. Same for the First Fire highlight ring.
- `.hudtray`: glass (strong), radius 18px, scale+fade in from its button.

**Phone test:** loading bar finishes; garage renders on Lite; tabs switch with the bead sliding; badges show; nothing hidden behind the bar in portrait and landscape; light theme looks right; iOS Settings › Accessibility › Reduce Transparency gives solid panels.

---

## 3. PR 2: Panels, controls, popups

All in `ui-glass.css` unless noted.

- **Section rows** (the Build tab's collapsible rows: Engine Layout, Bore & Stroke, …; find their class in `renderBuild()`, `src/app/build.js`) and `.card`: glass, radius 18px, gradient rim, 10px gap between rows.
- **`.seg button`**: unselected = faint glass. **Selected** (`.seg button.on`) = orange-tinted glass: `background: linear-gradient(180deg, rgba(var(--glass-tint),.28), rgba(var(--glass-tint),.10))`, inner glow, no hard orange border. Keep the `.d` delta line colours.
- **Stats/run bar** (the results rail's docked one-liner, `src/app/rail.js`) and the **engine card** `.ecard`: floating glass capsules. `.ecard` already has a 4px blur; bump it to the token. Keep `.ecard.inline` solid.
- **Race CTAs** (`.btn` ~line 241): keep the chamfer + glow lines and add the gel surface: `background-image: linear-gradient(180deg, rgba(255,255,255,.35), rgba(255,255,255,0) 48%), linear-gradient(180deg, var(--hb), var(--hb2))` plus an inner shadow. `.btn.ghost` becomes plain glass.
- **Popups**: `#sheet`, `#setPane`, the First Fire / tour card (`src/app/help.js`, `ui-help.css`), `#toast`, tooltips. Use `--glass-bg-strong` (they hold text), radius 22px, and spring in (`transform: translateY(12px) scale(.98)` → none).
- **Press feel**: `:active{transform:scale(.97)}` on glass buttons, 120ms.
- **Sliders** (launch rpm etc.): glass track, glossy orange thumb. Custom-style only; keep the native `<input type=range>` underneath.
- **Contrast check**: muted text (`--muted`, `--dim`) on the new translucent panels must still pass ~4.5:1 over the brightest likely backdrop (salt flats). Raise alpha or darken the text if not.

**Phone test:** Build tab rows, picking options, the First Fire tutorial, opening a parts sheet, Settings, a toast, the rail sheet drag; text readable in both themes.

---

## 4. PR 3: Reactive UI (pitch items 1–3)

### 4a. Glass cracks on failure (item 1)

- **Hook:** `failFlash(ms)` in `src/app/state.js` (line ~17) is already the one place a failure flashes, plays `sfx("fail")` and calls `buzz()`. It's called from ~10 places. Add `crackGlass(severity)` there.
- **Visual:** a full-screen `pointer-events:none` overlay above the panels. Pick the SVG crack pattern from 3 pre-made variants. Draw it with a `stroke-dashoffset` animation spreading from a point near the 3D view's lower-middle (~250ms). Add a 4px CSS shake on `#app` (~300ms) and a brief white rim flash on glass edges. Fade out over ~1.4s. Never block taps.
- **Severity:** a minor failure gets a small crack; an engine-gone (e.g. `ovalFailWord` "ENGINE GONE", teardown) gets a big one. Use `failKindOf()` in `results.js` if the kind is handy.
- Reduced motion: no shake, crack fades in without spreading. Lite: same SVG (it's cheap). The existing red `#flash` stays.

### 4b. Panels follow the RPM (item 2)

- In `tick()` (`src/app/boot.js` ~line 57), `rpm` is already computed. Throttle to ~15 Hz: set `--glass-heat` on `<html>` to `clamp(0,(rpm-idle)/(redline-idle),1)`, smoothed (lerp ~0.15). Redline is `S.cfg.redline` (tick already passes it to `ENGINE_VIS.setRun`).
- CSS uses it: rim glow `rgba(var(--glass-tint), calc(.08 + var(--glass-heat)*.35))`. Above ~0.9, swap the accent toward `--crit` and add a subtle rim pulse at idle-pulse speed.
- Only write the property when the value changes by >0.02 (avoid style recalcs every frame). Off when sound/idle is off and the engine is stopped.

### 4c. Glass takes on each venue's light (item 3)

- **Lean approach first:** a small `VENUE_TINT` table (r,g,b + glass alpha tweak) keyed by scene: garage, strip day, strip night (race-night `nightK`), pull, bog, salt, road, hill, oval, boat, e24. Tuning values go in a table, per CLAUDE.md conventions.
- Set `--glass-tint` (and optionally `--glass-bg`) when a scene turns on. `src/app/runview.js` already observes scene changes (`rvSync`). Hook there, or where each `ENGINE_VIS.setX({on:true})` starts. Transition the custom properties over ~800ms (register them with `@property` so they animate).
- *Optional upgrade, behind Full/Ultra only:* sample the real frame colour. The renderer is `alpha:false` without `preserveDrawingBuffer` (`src/vis/api.js` ~line 37), so a read must happen right after `render()` in the frame loop. Read a 4×4 downscaled area once a second and blend it with the table value. Don't do this on Lite.

**Phone test:** blow an engine on the dyno (crack + shake + buzz); rev in the garage and watch the rims warm up; run a strip pass at night vs salt flats and see the glass tint change.

---

## 5. PR 4: Results card + morph (pitch items 7 & 8)

### 5a. Full-screen results card (item 7)

- **Hook:** `showResult(res,env)` in `src/app/results.js` (line ~88) and the event finish paths that feed the rail.
- **Content:** a big hero number (peak hp for dyno; ET / mph / place for events) in Chakra Petch at ~96px with tabular numbers. Draw the last build's curve as a faint ghost behind the new one: reuse `drawChart(res, upto, cv)` from `src/app/test.js` (it already accepts a target canvas). Use `S.base` / the previous run of the same test for the ghost. Show verdict chip, delta vs previous, and a "Run it again" / "Back to build" pair.
- **When:** after a dyno pull and after an event's after-run beat. Dismiss by tap outside, swipe down, or Esc. Don't show it mid-career auto-sim (team race days) unless Kelbo wants it (Q3).
- **Trophy cards:** trophies (`src/app/trophy.js`) render as a holographic card: a conic/linear gradient sheen whose angle follows `--tilt-x/--tilt-y`. Drive tilt from `deviceorientation`. iOS needs `DeviceOrientationEvent.requestPermission()` from a tap, so ask the first time a trophy card opens. Fall back to finger-drag tilt. Lite: static sheen.
- **Share:** a "Share" button renders the card to a canvas and hands it to the existing `phoSave(c, fn, title, share)` in `src/app/photo.js`. Don't build a second share path.

### 5b. The engine card morphs into the results card (item 8)

- Use the View Transitions API: `document.startViewTransition(() => openResultsCard())` with matching `view-transition-name` on `.ecard` and the results card shell.
- Feature-detect it and fall back to the normal fade-in where unsupported. Skip it under reduced motion.
- Only one element may hold a given `view-transition-name` at a time. Clear it from the card after the transition.

**Phone test:** a dyno pull ends with the card growing out of the engine card; ghost curve shows after the second pull; a trophy card shimmers when tilting the phone; Share opens the phone's share sheet.

---

## 6. PR 5: Gestures (pitch item 9)

- **Swipe between tabs:** a horizontal swipe on `#panel` (not on the 3D view, sliders, `.seg` rows that scroll sideways, the chart, or the tune map editor) calls `showTab()` for the next or previous tab. Threshold ~60px with a mostly-horizontal angle. Show a light rubber-band on the first/last tab. Ignore it while `testing` or during an event run.
- **Panel sheet detents:** dragging the grabber at the top of the glass panel snaps the panel to three heights: peek / half / tall. Reuse the existing `#app.mini` state as one detent if possible. The rail (`src/app/rail.js`) already has drag-to-open; copy its pointer handling instead of writing a new one.
- **Long-press a part option to compare:** in a parts sheet (`openSheet()`, `src/app/build.js` ~line 378), long-pressing (~450ms) an option shows a glass popover comparing it with the fitted part: the deltas the `.d` line already computes, plus cost and weight. Release closes it. Add a light `buzz(10)` on open.
- **Pointer events only**, `touch-action` set per element, so desktop mouse and trackpad keep working. Keyboard shortcuts (boot.js) stay.

**Phone test:** swipe Build → Test → Events and back; drag the panel through all three heights; long-press a cam option in a sheet; make sure orbiting the engine and dragging sliders don't trigger a tab swipe.

---

## 7. PR 6: Readouts on the garage screens (pitch item 6)

The biggest PR, mostly in `src/vis/`.

- **Where:** `src/vis/garage.js` already places emissive screen boxes (`screenBlue` / `screenGreen` / `screenAmber`, materials in `src/vis/core.js` ~line 1131). They're merged geometry (`B.add`), so add **one separate** plane mesh in front of the main dyno-room screen instead of retexturing the merged one.
- **What:** a 512×256 offscreen canvas → `THREE.CanvasTexture` → `emissiveMap` on a new `MAT.dynoScreen`. During a dyno pull, draw the live curve with `drawChart(res, upto, canvas)` as `upto` advances, plus big digital rpm / hp text. Set `texture.needsUpdate=true` at ≤15 Hz. When idle, show the last result or a PEW logo screensaver.
- **Expose** a small `ENGINE_VIS.setScreen({canvas, dirty})` in `src/vis/api.js`, so the app draws and the 3D side only uploads. That keeps the sim/vis/app separation from CLAUDE.md.
- **Lite:** 256×128 canvas at 8 Hz, or skip the live updates and show only the final frame. Must not cost frame rate on a phone; check with `ENGINE_VIS.fps()`.
- **Camera:** optional short dolly toward the screen during a pull on Full/Ultra. Ask first (Q4).

**Phone test (Lite):** run a dyno pull and see the curve draw on the garage monitor; FPS doesn't drop (auto-adjust doesn't trigger); the monitor still looks right after a layout/engine change.

---

## 8. Performance budget (all PRs)

- No more than **4 blurred layers on screen at once** on Lite (bg panel, tab bar, rail capsule, one popup). Nested glass inside glass gets a translucent fill but **no** extra `backdrop-filter`.
- Custom-property writes from JS: throttled, and only when the value changes.
- Nothing new runs per frame on Lite except what's listed above.
- After each PR, on a phone: watch for the "Graphics lowered" toast from `perf.js` during a dyno pull and a strip pass. If it appears where it didn't before, the PR isn't done.

## 9. Ask Kelbo before the PR they affect

Answered October 2026: 1 hybrid (chamfered race buttons, rounded glass elsewhere); 2 yes, a Glass effects switch in Settings › Display; 3 only runs the player drives; 4 Ultra only.


1. **(PR 1/2)** Shop Glass hybrid (chamfered race buttons + rounded glass elsewhere) or full rounded Liquid Glass everywhere?
2. **(PR 1)** Add a "Glass effects: On / Off" switch in Settings › Graphics, or rely on auto + system Reduce Transparency only?
3. **(PR 4)** Show the full results card after Career team race days and Close week, or only for runs the player drives?
4. **(PR 6)** Camera dolly toward the monitor during dyno pulls: yes, no, or Ultra only?

## 10. Out of scope

Camera-as-navigation between tabs, tapping the 3D engine to pick parts (pitch items 4–5), any sim/physics change, new save keys. If something here needs a new localStorage key, stop and ask: it must be added to `buMake`/`buWrite` in `savecode.js`.

---

## Checklist

- [x] PR 1: Glass foundation, ambient backdrop, floating tab bar, HUD (1.76.36.0). Lite deviation: the panel and the HUD buttons over the live 3D view get a stronger tint, not a blur, to keep frame rate.
- [x] PR 2: Panels, seg controls, CTAs, popups, sliders (1.76.37.0). Note: the race buttons had lost their chamfer in the v1.66 look refresh, so this PR brings it back on .btn.pri/.ok/.danger only. WebKit sliders show no orange fill (Firefox does): a fill would need JS on every slider.
- [x] PR 3: Crack on failure, RPM-reactive glass, venue tint (1.76.38.0). Cracks are generated fresh each time instead of 3 fixed SVGs. The tint eases in JS (an `@property` list transition was unreliable). The optional frame-colour sampling was skipped.
- [ ] PR 4: Results card, holo trophies, share, morph transition
- [ ] PR 5: Tab swipe, sheet detents, long-press compare
- [ ] PR 6: Live dyno readout on garage monitor
