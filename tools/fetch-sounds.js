/* Prairie Engine Works — sound fetcher (run by .github/workflows/fetch-sounds.yml on GitHub's servers).
   Reads tools/sound-fetch.json and downloads each raw recording into raw/, plus raw/manifest.json with the
   license, author and source page read at download time (what sounds/CREDITS.md needs).
     {"fs": 123}               Freesound sound id: its public HQ preview MP3 (no login needed)
     {"commons": "File:..."}   Wikimedia Commons file: the original upload
     {"commonsMatch": "^File:..."}  every file in Category:Sounds of automobiles whose title matches
   Never run this on player data. Node 18+ (built-in fetch). */
"use strict";
const fs = require("fs");
const path = require("path");
const UA = "PrairieEngineWorks-SoundFetch/1.0 (https://github.com/Jxstrr0/350Chev)";
const OUT = "raw";
const list = JSON.parse(fs.readFileSync(path.join(__dirname, "sound-fetch.json"), "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, asJson) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
    if (r.ok) return asJson ? r.json() : r;
    if (r.status !== 429 && r.status < 500) throw new Error(r.status + " " + url);
    await sleep(2000 * 2 ** i);
  }
  throw new Error("gave up " + url);
}
async function save(url, file) {
  const r = await get(url);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(path.join(OUT, file), buf);
  return buf.length;
}

async function freesound(e) {
  const page = await (await get("https://freesound.org/s/" + e.fs + "/")).text();
  const prev = page.match(/https:\/\/cdn\.freesound\.org\/previews\/[^"' ]+-hq\.mp3/);
  if (!prev) throw new Error("no preview on page for " + e.fs);
  const lic = page.match(/https?:\/\/creativecommons\.org\/(?:publicdomain\/zero|licenses)\/[^"' ]+/);
  const title = (page.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  const user = (page.match(/\/people\/([^/"]+)\/sounds\/\d+/) || [])[1] || "";
  const file = e.key + ".mp3";
  const bytes = await save(prev[0], file);
  return [{ key: e.key, file, bytes, for: e.for, source: "https://freesound.org/people/" + user + "/sounds/" + e.fs + "/",
    title: title.trim(), author: user, license: lic ? lic[0] : "NOT FOUND — check by hand", via: prev[0] }];
}

let catCache = null;
async function category() {
  if (catCache) return catCache;
  catCache = [];
  let cont = "";
  do {
    const j = await get("https://commons.wikimedia.org/w/api.php?action=query&list=categorymembers&cmtype=file&cmlimit=500&format=json" +
      "&cmtitle=" + encodeURIComponent("Category:Sounds of automobiles") + cont, true);
    j.query.categorymembers.forEach((m) => catCache.push(m.title));
    cont = j.continue ? "&cmcontinue=" + encodeURIComponent(j.continue.cmcontinue) : "";
  } while (cont);
  return catCache;
}
async function commonsOne(key, title, why) {
  const j = await get("https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url|extmetadata&format=json&titles=" +
    encodeURIComponent(title), true);
  const p = Object.values(j.query.pages)[0];
  if (!p.imageinfo) throw new Error("not on Commons: " + title);
  const ii = p.imageinfo[0], md = ii.extmetadata || {};
  const strip = (v) => (v && v.value ? String(v.value).replace(/<[^>]+>/g, "").trim() : "");
  const file = key + path.extname(ii.url).toLowerCase();
  const bytes = await save(ii.url, file);
  await sleep(1500);
  return { key, file, bytes, for: why, source: ii.descriptionurl, title: title.replace(/^File:/, ""),
    author: strip(md.Artist), license: strip(md.LicenseShortName) + " " + strip(md.LicenseUrl), via: ii.url };
}
async function commons(e) {
  if (e.commons) return [await commonsOne(e.key, e.commons, e.for)];
  const re = new RegExp(e.commonsMatch);
  const hits = (await category()).filter((t) => re.test(t));
  if (!hits.length) throw new Error("no match for " + e.commonsMatch);
  const out = [];
  for (let i = 0; i < hits.length; i++) out.push(await commonsOne(e.key + (hits.length > 1 ? "_" + (i + 1) : ""), hits[i], e.for));
  return out;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const manifest = [], failed = [];
  for (const e of list) {
    try {
      const got = e.fs ? await freesound(e) : await commons(e);
      got.forEach((g) => { manifest.push(g); console.log("ok  ", g.file, g.bytes, g.license); });
    } catch (err) {
      failed.push({ key: e.key, error: String(err.message || err) });
      console.log("FAIL", e.key, err.message || err);
    }
  }
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ fetched: new Date().toISOString(), manifest, failed }, null, 1));
  console.log(manifest.length + " files, " + failed.length + " failed");
})();
