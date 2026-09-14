/* Real Zero — QR-scan beacon (web → in-store session-stitch bridge).
 *
 * Fires once per fresh page visit when a member lands on a station/educational
 * QR page. Sends {id, stationId, clientId, page, scannedAt} to the realOS cloud
 * so the GS805 identity resolver can correlate this web session to a machine
 * purchase at the same station within a short window — the "web" leg of the
 * customer journey.
 *
 * Cross-origin, fire-and-forget, no CORS preflight: uses navigator.sendBeacon
 * with a text/plain Blob (a CORS "simple" content type), so no OPTIONS
 * round-trip and no response handling. The realOS endpoint JSON.parses the
 * string body.
 *
 * Privacy: this script reads and writes nothing on the visitor's device. No
 * cookies, no localStorage, no sessionStorage — so it raises no ePrivacy
 * art. 5(3) / LSSI art. 22.2 consent question, and needs no banner. Repeat
 * fires are suppressed by inspecting the navigation type of the current page
 * load (see isFreshVisit), which is runtime state, not stored information.
 * The only identifier ever sent is the GA4 client_id, and on the QR pages GA4
 * is not loaded at all, so clientId is null there. No IP is sent (the server
 * keeps only CF-IPCountry).
 *
 * Config (both on <body>):
 *   data-rz-station  the station id            (default RZ-VELAZQUEZ-01)
 *   data-rz-beacon   the receiver endpoint URL (default the GS805 webhook)
 *
 * The default sink is the GS805 fulfilment webhook (`/scan/beacon`), which
 * works on the light version with no realOS cloud. On the full realOS-kiosk
 * version, point data-rz-beacon at https://cloud.realzero.es/api/scan/beacon
 * instead — both write to the same web_scans table the resolver reads.
 */
(function () {
  "use strict";

  var GA4_ID = "G-ZR3F9FQWZT";
  var ENDPOINT =
    (document.body && document.body.getAttribute("data-rz-beacon")) ||
    "https://gs805-webhook.onrender.com/scan/beacon";
  var station =
    (document.body && document.body.getAttribute("data-rz-station")) ||
    "RZ-VELAZQUEZ-01";
  // Normalise to one spelling per page. Vercel serves /velazquez with
  // cleanUrls and trailingSlash: false, but a directory-style /velazquez/ or
  // an explicit /velazquez/index.html both reach the same page, and reporting
  // three spellings would split the same station in web_scans. Strip
  // /index.html first, then any trailing slash, keeping "/" for the root.
  var page =
    location.pathname.replace(/\/index\.html$/, "").replace(/\/+$/, "") || "/";

  /* Count only a genuine fresh visit.
   *
   * Scanning the vinyl QR always produces a "navigate". A refresh is
   * "reload" and a history traversal is "back_forward", and neither is a
   * new scan. Gating on this replaces the old sessionStorage dedupe key and
   * needs no access to terminal storage.
   *
   * "prerender" counts as fireable because we only reach this point after
   * activation (see the prerendering guard at the bottom) — the entry keeps
   * its prerender type once activated, so treating it as non-fireable would
   * silently drop the scan.
   *
   * Trade-off vs. the old key: a member who scans the same code twice in one
   * tab session is now counted twice, where the key suppressed the second.
   * That is the more accurate reading of "scans" anyway, and recovering the
   * old behaviour would require either device storage or a stable id, which
   * this beacon deliberately no longer has.
   */
  function isFreshVisit() {
    try {
      var entries = performance.getEntriesByType("navigation");
      if (entries && entries.length) {
        var type = entries[0].type;
        return type === "navigate" || type === "prerender";
      }
      // Navigation Timing Level 1 fallback. 0 === TYPE_NAVIGATE.
      if (performance.navigation) return performance.navigation.type === 0;
    } catch (e) {
      /* fall through */
    }
    // Unknown: fail open. A missed scan costs more than a duplicate.
    return true;
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    // RFC4122-ish fallback
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function fire(clientId) {
    var body = JSON.stringify({
      id: uuid(),
      stationId: station,
      clientId: clientId || null,
      page: page,
      scannedAt: new Date().toISOString(),
    });
    try {
      var blob = new Blob([body], { type: "text/plain" });
      var ok = navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, blob);
      if (!ok) {
        // sendBeacon unavailable/refused — fall back to keepalive fetch.
        fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: body,
          keepalive: true,
          mode: "no-cors",
        }).catch(function () {});
      }
    } catch (e) {
      /* never let the beacon break the page */
    }
  }

  var fired = false;
  function once(clientId) {
    if (fired) return;
    fired = true;
    fire(clientId);
  }

  function start() {
    if (!isFreshVisit()) return;

    // Ask GA4 for the client_id (async). If gtag isn't ready or consent is
    // denied, resolve to null after a short timeout and fire anyway — the
    // scan itself is still useful attribution even without the web id.
    if (typeof window.gtag === "function") {
      try {
        window.gtag("get", GA4_ID, "client_id", function (cid) {
          once(cid);
        });
      } catch (e) {
        once(null);
      }
      // Safety timeout — if gtag's callback never comes, fire without the id.
      setTimeout(function () {
        once(null);
      }, 1500);
    } else {
      once(null);
    }
  }

  // A prerendered page has not been seen by anyone yet, so don't report a
  // scan until (and unless) it is actually activated.
  if (document.prerendering) {
    document.addEventListener("prerenderingchange", start, { once: true });
  } else {
    start();
  }
})();
