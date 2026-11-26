/* ==========================================================================
   Longlight Passport kit: passport-stamp.js (classic JavaScript)
   --------------------------------------------------------------------------
   Copy this file into a Longlight game, unchanged. It lets the game:

     1. make a stamp:   var stamp = LonglightPassport.make({ game, ver, headline, stats, flags });
     2. keep it:        LonglightPassport.save("<the game's stamp key>", stamp);
     3. send it:        LonglightPassport.open(stamp);   // on a button tap

   make() checks the stamp against the Passport's rules and returns null
   (with a warning in the console) if something is wrong, so a bad stamp is
   caught in the game instead of being refused on the site. save() keeps it
   in this game's own localStorage, where the bridge page
   (passport-stamp.html) can read it. open() opens the Passport in a new tab
   with the stamp in the link.

   What goes in a stamp: headline numbers only. Never save data, a name the
   player typed, a seed or anything personal. A stamp is not a save code.

   The link: https://longlight.games/passport#stamp=LLP1.<payload>.<checksum>
   The part after # never reaches any server. The code is the stamp's JSON,
   squeezed with the browser's own deflate, in base64url, with a 7-character
   FNV-1a checksum (the same as passport/js/codec.js on the studio site).

   No dependencies, no network calls, and it never touches any storage key
   but the one the game hands it. Works as a plain <script> (it sets
   window.LonglightPassport) and with require() in Node.

   Adapted from Kelbo.Website passport/js/codec.js and passport/js/validate.js (2026-11-25)
   Spec: https://github.com/Jxstrr0/Kelbo.Website/blob/main/.github/PASSPORT.md
   ========================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LonglightPassport = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var PASSPORT_URL = "https://longlight.games/passport";
  var PREFIX = "LLP1.";

  // The Passport's limits (the studio site refuses anything past them).
  var LIMITS = { jsonBytes: 2048, headline: 60, stats: 6, label: 32, unit: 8, textValue: 24, flags: 8 };
  var ID = /^[a-z0-9_]{1,32}$/;
  var VERSION = /^\d{1,6}(\.\d{1,6}){0,4}$/;
  var DATE = /^\d{4}-\d{2}-\d{2}$/;
  var BAD_CHARS = /[\u0000-\u001f\u007f-\u009f؜‎‏‪-‮⁦-⁩]/;

  function warn(problem) {
    if (typeof console !== "undefined" && console.warn) console.warn("Longlight Passport: " + problem + " The stamp was not made.");
    return null;
  }

  function okText(value, max) {
    return typeof value === "string" && value.trim() !== "" && value.trim().length <= max && !BAD_CHARS.test(value);
  }

  // Today on this phone, as YYYY-MM-DD.
  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }

  function byteLength(text) {
    return new TextEncoder().encode(text).length;
  }

  // make({ game, ver, headline, stats, flags, updated }) → a stamp, or null.
  //   game:     the game's Passport id ("pew", "scrapline", ...)
  //   ver:      the game's version, numbers and dots ("1.76.142.2")
  //   headline: optional, up to 60 characters ("Career, season 4")
  //   stats:    1 to 6 of { id, label, value, unit }; value is a number or
  //             up to 24 characters of text; unit (optional) up to 8
  //   flags:    optional, up to 8 ids ("career_complete")
  //   updated:  optional; today's date is used if it's left out
  function make(input) {
    var i = input || {};
    if (!ID.test(String(i.game))) return warn("game must be the game's Passport id.");
    var ver = String(i.ver == null ? "" : i.ver).trim();
    if (!VERSION.test(ver)) return warn("ver must be numbers and dots, like 1.2.0.0.");
    var updated = i.updated == null ? today() : String(i.updated);
    if (!DATE.test(updated)) return warn("updated must be a date, YYYY-MM-DD.");

    var stamp = { v: 1, game: i.game, ver: ver, updated: updated };
    if (i.headline != null && i.headline !== "") {
      if (!okText(i.headline, LIMITS.headline)) return warn("headline must be plain text, at most 60 characters.");
      stamp.headline = i.headline.trim();
    }

    if (!Array.isArray(i.stats) || i.stats.length < 1 || i.stats.length > LIMITS.stats) return warn("stats must have 1 to 6 items.");
    var seen = {};
    stamp.stats = [];
    for (var n = 0; n < i.stats.length; n++) {
      var s = i.stats[n] || {};
      if (!ID.test(String(s.id)) || seen[s.id]) return warn("each stat needs its own id (a-z, 0-9, _).");
      seen[s.id] = true;
      if (!okText(s.label, LIMITS.label)) return warn("stat " + s.id + " needs a label of at most 32 characters.");
      var value = s.value;
      if (typeof value === "number") {
        if (!isFinite(value)) return warn("stat " + s.id + " has a value that isn't a real number.");
      } else if (okText(value, LIMITS.textValue)) {
        value = value.trim();
      } else {
        return warn("stat " + s.id + " needs a number, or text of at most 24 characters.");
      }
      var stat = { id: s.id, label: s.label.trim(), value: value };
      if (s.unit != null && s.unit !== "") {
        if (!okText(s.unit, LIMITS.unit)) return warn("stat " + s.id + " has a unit longer than 8 characters.");
        stat.unit = s.unit.trim();
      }
      stamp.stats.push(stat);
    }

    if (i.flags != null) {
      if (!Array.isArray(i.flags) || i.flags.length > LIMITS.flags) return warn("flags must be a list of at most 8 ids.");
      var flags = [];
      for (var f = 0; f < i.flags.length; f++) {
        if (!ID.test(String(i.flags[f]))) return warn("each flag must be an id (a-z, 0-9, _).");
        if (flags.indexOf(i.flags[f]) < 0) flags.push(i.flags[f]);
      }
      if (flags.length) stamp.flags = flags;
    }

    if (byteLength(JSON.stringify(stamp)) > LIMITS.jsonBytes) return warn("the stamp is over 2 KB.");
    return stamp;
  }

  // Keep the stamp in this game's own storage, for the bridge page.
  // Returns true if it was saved. Safe to call on every game save.
  function save(key, stamp) {
    if (!stamp || typeof key !== "string" || !key) return false;
    try {
      localStorage.setItem(key, JSON.stringify(stamp));
      return true;
    } catch (e) {
      return false; // private mode or storage full: the link still works
    }
  }

  // ---- the stamp code (the same as the studio site's codec) -----------------

  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

  function toBase64Url(bytes) {
    var out = "";
    for (var i = 0; i < bytes.length; i += 3) {
      var n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
      out += B64.charAt((n >> 18) & 63) + B64.charAt((n >> 12) & 63);
      if (i + 1 < bytes.length) out += B64.charAt((n >> 6) & 63);
      if (i + 2 < bytes.length) out += B64.charAt(n & 63);
    }
    return out;
  }

  function checksum(text) {
    var h = 0x811c9dc5;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    var s = h.toString(36);
    while (s.length < 7) s = "0" + s;
    return s;
  }

  // Can this browser make stamp links? (Every current phone browser can.)
  function supported() {
    return typeof CompressionStream === "function" && typeof TextEncoder === "function";
  }

  // A stamp → its LLP1. code.
  function encode(stamp) {
    if (!supported()) return Promise.reject(new Error("This browser is too old to make Passport links."));
    var bytes = new TextEncoder().encode(JSON.stringify(stamp));
    if (bytes.length > LIMITS.jsonBytes) return Promise.reject(new Error("The stamp is over 2 KB."));
    var stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    return new Response(stream).arrayBuffer().then(function (buffer) {
      var payload = toBase64Url(new Uint8Array(buffer));
      return PREFIX + payload + "." + checksum(PREFIX + payload);
    });
  }

  // A stamp → the full Passport link.
  function link(stamp) {
    if (!stamp) return Promise.reject(new Error("There's no stamp to send."));
    return encode(stamp).then(function (code) { return PASSPORT_URL + "#stamp=" + code; });
  }

  // Open the Passport with this stamp, in a new tab. Call it straight from a
  // tap: the tab is opened at once (so the browser allows it) and pointed at
  // the link a moment later. If the browser blocks new tabs, this page goes
  // to the Passport instead (the game has saved, so nothing is lost).
  function open(stamp) {
    var tab = null;
    try { tab = window.open("", "_blank"); } catch (e) { tab = null; }
    if (tab) {
      try { tab.opener = null; } catch (e) {}
    }
    return link(stamp).then(function (url) {
      if (tab && !tab.closed) tab.location.replace(url);
      else window.location.href = url;
      return url;
    }, function (err) {
      if (tab) {
        try { tab.close(); } catch (e) {}
      }
      throw err;
    });
  }

  return {
    LIMITS: LIMITS,
    make: make,
    save: save,
    supported: supported,
    encode: encode,
    link: link,
    open: open,
  };
});
