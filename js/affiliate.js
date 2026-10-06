/* Affiliate passthrough — Time Rich
   Loaded from every page via <script src="/js/affiliate.js"><\/script> in the head.
   (That closing tag is escaped so the file stays safe to inline as well as link.)

   ThriveCart affiliate links land on timerich.ai/accelerator/?affiliate=<id>,
   and every route to checkout deliberately drops the query string, so the tag
   had nowhere to travel and the affiliate went uncredited. This remembers the
   id on arrival and puts it back on the checkout URL, and on nothing else.

   Note: the redirects strip the query string because ThriveCart's checkout has
   failed on query strings before. "affiliate" is ThriveCart's own parameter, so
   it is the one that should survive, but a live checkout is the only thing that
   proves it.

   window.TR_AFFILIATE.get()    - the stored id, or "" when absent or stale
   window.TR_AFFILIATE.tag(url) - url, plus ?affiliate=<id> when there is one

   Static links opt in by carrying a data-checkout attribute; this tags them on
   DOMContentLoaded so a page only has to mark the anchor. */
(function () {

  var KEY = "tr_affiliate";
  var VALID = /^[A-Za-z0-9_-]{1,64}$/;
  var MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;   // 60 days

  // localStorage throws in private mode and wherever site data is blocked, and
  // nothing here is worth breaking a page over, so every access is wrapped.
  function read() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      var saved = JSON.parse(raw);
      if (!saved || typeof saved !== "object") return null;
      if (!VALID.test(String(saved.id || ""))) return null;
      if (typeof saved.ts !== "number" || !isFinite(saved.ts)) return null;
      return saved;
    } catch (err) {
      return null;
    }
  }

  // Only an id that matches the pattern is ever stored, so nothing arbitrary
  // from the query string can be kept and later put back on a URL.
  function remember() {
    var id = "";
    try {
      id = new URLSearchParams(window.location.search).get("affiliate") || "";
    } catch (err) {
      return;
    }
    id = id.trim();
    if (!VALID.test(id)) return;

    try {
      window.localStorage.setItem(KEY, JSON.stringify({ id: id, ts: Date.now() }));
    } catch (err) {
      // Private mode or a full quota. The visit still works, the tag just does
      // not outlive this page.
    }
  }

  function get() {
    var saved = read();
    if (!saved) return "";
    if (Date.now() - saved.ts > MAX_AGE_MS) return "";
    return saved.id;
  }

  // Appends the tag and nothing else: the caller hands over a bare checkout
  // URL, which is how every other parameter stays stripped.
  function tag(url) {
    var id = get();
    if (!id) return url;
    return url + (url.indexOf("?") === -1 ? "?" : "&") + "affiliate=" + encodeURIComponent(id);
  }

  function tagLinks() {
    var links = document.querySelectorAll("a[data-checkout]");
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute("href");
      if (!href || /[?&]affiliate=/.test(href)) continue;   // idempotent
      links[i].setAttribute("href", tag(href));
    }
  }

  remember();

  window.TR_AFFILIATE = { get: get, tag: tag, tagLinks: tagLinks };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tagLinks);
  } else {
    tagLinks();
  }

})();
