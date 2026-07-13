/* Real Zero — QR-scan beacon (web → in-store session-stitch bridge).
 *
 * Fires once per session when a member lands on a station/educational QR page.
 * Sends {id, stationId, clientId, page, scannedAt} to the realOS cloud so the
 * GS805 identity resolver can correlate this web session to a machine purchase
 * at the same station within a short window — the "web" leg of the customer
 * journey.
 *
 * Cross-origin, fire-and-forget, no CORS preflight: uses navigator.sendBeacon
 * with a text/plain Blob (a CORS "simple" content type), so no OPTIONS
 * round-trip and no response handling. The realOS endpoint JSON.parses the
 * string body.
 *
 * Privacy: the only identifier sent is the GA4 client_id, which under Consent
 * Mode default-denied (EEA) is a transient, cookieless value or absent — the
 * server stores null in that case. No personal data, no IP (server keeps only
 * CF-IPCountry). Deduped per session so a refresh doesn't re-fire.
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
  var page = location.pathname.replace(/\/index\.html$/, "") || "/";

  // Fire at most once per browser session per (station, page).
  var dedupeKey = "rz-beacon:" + station + ":" + page;
  try {
    if (sessionStorage.getItem(dedupeKey)) return;
  } catch (e) {
    /* private mode — proceed without dedupe */
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
      try {
        sessionStorage.setItem(dedupeKey, "1");
      } catch (e) {}
    } catch (e) {
      /* never let the beacon break the page */
    }
  }

  // Ask GA4 for the client_id (async). If gtag isn't ready or consent is
  // denied, resolve to null after a short timeout and fire anyway — the
  // scan itself is still useful attribution even without the web id.
  var fired = false;
  function once(clientId) {
    if (fired) return;
    fired = true;
    fire(clientId);
  }

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
})();
