#!/usr/bin/env node
/* Prairie Engine Works: render the PWA icons into icons/ (192, 512, 512 maskable, 180 apple-touch).
 * Needs Playwright (npm i -g playwright; NODE_PATH=$(npm root -g) node tools/make-icons.js). Output is committed; re-run only to change the mark.
 * The mark: a clay flywheel ring with bolt holes and a piston crown on a slate field (Longlight clay #d97757 on #141413). */
"use strict";
const { chromium } = require("playwright"), fs = require("fs"), path = require("path");
const OUT = path.join(__dirname, "..", "icons");
/* 100x100 artboard. s = mark scale about the centre (the maskable icon keeps the mark inside the inner 80% safe zone) */
function svg(s) {
  const bolts = [...Array(8)].map((_, i) => { const a = i * Math.PI / 4 + Math.PI / 8; return `<circle cx="${(50 + 31 * Math.cos(a)).toFixed(2)}" cy="${(50 + 31 * Math.sin(a)).toFixed(2)}" r="2.3" fill="#141413"/>`; }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%"><rect width="100" height="100" fill="#141413"/>
<g transform="translate(50 50) scale(${s}) translate(-50 -50)">
<circle cx="50" cy="50" r="43" fill="#d97757"/>${bolts}
<circle cx="50" cy="50" r="23" fill="#141413"/>
<rect x="39" y="33" width="22" height="34" rx="3.5" fill="#e8956f"/>
<rect x="39" y="40" width="22" height="2.6" fill="#141413"/><rect x="39" y="46" width="22" height="2.6" fill="#141413"/>
<circle cx="50" cy="58" r="4" fill="#141413"/></g></svg>`;
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(), jobs = [["icon-192.png", 192, 1], ["icon-512.png", 512, 1], ["icon-512-maskable.png", 512, 0.74], ["apple-touch-icon.png", 180, 0.92]];
  for (const [f, n, s] of jobs) {
    const p = await b.newPage({ viewport: { width: n, height: n }, deviceScaleFactor: 1 });
    await p.setContent(`<body style="margin:0;background:#141413">${svg(s)}</body>`);
    await p.screenshot({ path: path.join(OUT, f), clip: { x: 0, y: 0, width: n, height: n } }); await p.close(); console.log("wrote icons/" + f);
  }
  await b.close();
})();
