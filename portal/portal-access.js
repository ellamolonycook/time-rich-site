/* =====================================================================
 * Time Rich accelerator portal - passcode access and content rendering.
 *
 * No dependencies, no build step. Plain fetch and vanilla DOM.
 *
 * Needs portal-config.js loaded first, and portal-content.css for the
 * "trp-" classes it produces.
 *
 * Public API (window.TRPortal)
 *   signIn(code)              -> Promise<{ok:true, data} | {ok:false, reason}>
 *   load()                    -> same, using the stored code
 *   signOut()                 -> void, forgets the stored code
 *   hasCode()                 -> boolean
 *   renderWeeks(el, data)     -> fills el with the week cards
 *   renderSessions(el, data)  -> fills el with the session rows
 *
 * reason is "bad_code" (the code was rejected) or "unavailable"
 * (no config, network failure, or a non-200 from the API).
 *
 * Auto-mount
 *   On DOMContentLoaded the script wires up any of these it finds:
 *     [data-portal-login]    a form; its input value is passed to signIn
 *     [data-portal-signout]  a button; signs out and reloads
 *     [data-portal-name]     gets the member's first name
 *     [data-portal-weeks]    gets the week cards
 *     [data-portal-sessions] gets the session rows
 *   If any of name/weeks/sessions are present it calls load() to fill them.
 *   With no valid code it shows [data-portal-login] if the page has one,
 *   and otherwise sends the browser to index.html.
 *
 * Gating
 *   The script keeps a state on <html>: data-tr-portal="loading" | "in" | "out".
 *   portal-content.css turns that into .trp-when-in / .trp-when-out /
 *   .trp-when-loading, so a page can hide member content until a code
 *   has actually loaded without needing any page-specific JavaScript.
 *
 * Safety notes
 *   - The passcode is sent in a POST body only. It is never put in a URL
 *     and never written to the console.
 *   - Nothing from the API is ever passed to innerHTML. Text goes in with
 *     textContent; elements are built with createElement.
 *   - An embed URL is never taken from the API as-is. The host is matched
 *     against a short allow-list, the id is checked against a strict
 *     pattern, and the src is rebuilt from that id. Anything else falls
 *     back to a plain link.
 *   - Every link URL must parse as absolute and be https:.
 * ===================================================================== */
(function (window, document) {
  'use strict';

  var STORAGE_KEY = 'tr_portal_code';
  var RPC_PATH    = '/rest/v1/rpc/portal_get';
  var STATE_ATTR  = 'data-tr-portal';
  var PLACEHOLDER = 'PASTE_';

  var MSG = {
    bad_code:    "That code didn't work. Check it and try again.",
    unavailable: "The portal is unavailable right now. Please try again in a few minutes."
  };

  /* ---- state on <html>, so CSS can gate the page ------------------- */

  function setState(value) {
    try {
      if (document.documentElement) {
        document.documentElement.setAttribute(STATE_ATTR, value);
      }
    } catch (e) { /* non-fatal */ }
  }

  setState('loading');

  /* ---- storage: every call wrapped, private mode must not throw ---- */

  function readCode() {
    try { return window.localStorage.getItem(STORAGE_KEY) || null; }
    catch (e) { return null; }
  }

  function writeCode(code) {
    try { window.localStorage.setItem(STORAGE_KEY, code); }
    catch (e) { /* the session still works, it just will not persist */ }
  }

  function clearCode() {
    try { window.localStorage.removeItem(STORAGE_KEY); }
    catch (e) { /* non-fatal */ }
  }

  function hasCode() {
    return !!readCode();
  }

  /* ---- the one API call -------------------------------------------- */

  function getConfig() {
    var c = window.TR_PORTAL_CONFIG;
    if (!c) return null;
    if (typeof c.url !== 'string' || typeof c.key !== 'string') return null;
    if (!c.url || !c.key) return null;
    if (c.key.indexOf(PLACEHOLDER) === 0) return null;   // key not pasted yet
    return c;
  }

  function callRpc(code) {
    var cfg = getConfig();
    if (!cfg) return Promise.resolve({ ok: false, reason: 'unavailable' });

    var endpoint = cfg.url.replace(/\/+$/, '') + RPC_PATH;

    return fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': cfg.key,
        'Authorization': 'Bearer ' + cfg.key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_code: code })
    }).then(function (response) {
      if (!response.ok) return { ok: false, reason: 'unavailable' };
      return response.json().then(function (data) {
        if (!data || data.ok !== true) return { ok: false, reason: 'bad_code' };
        return { ok: true, data: data };
      }, function () {
        return { ok: false, reason: 'unavailable' };
      });
    }, function () {
      return { ok: false, reason: 'unavailable' };
    });
  }

  function signIn(code) {
    var trimmed = (typeof code === 'string') ? code.trim() : '';
    if (!trimmed) return Promise.resolve({ ok: false, reason: 'bad_code' });

    return callRpc(trimmed).then(function (result) {
      if (result.ok) writeCode(trimmed);
      return result;
    });
  }

  function load() {
    var stored = readCode();
    if (!stored) return Promise.resolve({ ok: false, reason: 'bad_code' });

    return callRpc(stored).then(function (result) {
      // Only forget the code when it was actually rejected. A network
      // blip should not sign somebody out.
      if (!result.ok && result.reason === 'bad_code') clearCode();
      return result;
    });
  }

  function signOut() {
    clearCode();
  }

  /* ---- small DOM helpers ------------------------------------------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== null && text !== undefined) node.textContent = text;
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function str(value) {
    return (typeof value === 'string') ? value.trim() : '';
  }

  function num(value, fallback) {
    var n = Number(value);
    return isFinite(n) ? n : fallback;
  }

  /* ---- URLs and embeds ---------------------------------------------- */

  // Absolute https: only. Returns a URL object or null.
  function safeUrl(raw) {
    if (typeof raw !== 'string' || !raw) return null;
    var parsed;
    try { parsed = new URL(raw); } catch (e) { return null; }
    if (parsed.protocol !== 'https:') return null;
    return parsed;
  }

  var RE_LOOM  = /^[0-9a-fA-F]{32}$/;        // Loom share ids are 32 hex
  var RE_YT    = /^[A-Za-z0-9_-]{11}$/;      // YouTube ids are 11 chars
  var RE_VIMEO = /^[0-9]{6,12}$/;            // Vimeo ids are numeric

  // Build an embed src from an allowed host. The original URL is never
  // reused: the src is assembled from a pattern-checked id.
  function embedSrc(url) {
    var host  = url.hostname.toLowerCase().replace(/^www\./, '');
    var parts = url.pathname.split('/').filter(Boolean);
    var id;

    if (host === 'loom.com') {
      if (parts.length >= 2 && (parts[0] === 'share' || parts[0] === 'embed')) {
        id = parts[1].split('?')[0];
        if (RE_LOOM.test(id)) return 'https://www.loom.com/embed/' + id;
      }
      return null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      id = url.searchParams.get('v');
      if (!id && parts.length >= 2 && parts[0] === 'embed') id = parts[1];
      if (id && RE_YT.test(id)) return 'https://www.youtube-nocookie.com/embed/' + id;
      return null;
    }

    if (host === 'youtu.be') {
      id = parts[0];
      if (id && RE_YT.test(id)) return 'https://www.youtube-nocookie.com/embed/' + id;
      return null;
    }

    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      id = (parts[0] === 'video') ? parts[1] : parts[0];
      if (id && RE_VIMEO.test(id)) return 'https://player.vimeo.com/video/' + id;
      return null;
    }

    return null;
  }

  function linkButton(url, label) {
    var a = el('a', 'trp-btn', label);
    a.href = url.href;                 // normalised, already checked https:
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  }

  function videoFrame(src, title) {
    var wrap  = el('div', 'trp-video');
    var frame = document.createElement('iframe');
    frame.src = src;
    frame.title = title || 'Video';
    frame.loading = 'lazy';
    frame.allow = 'accelerometer; clipboard-write; encrypted-media; picture-in-picture; fullscreen';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute('frameborder', '0');
    wrap.appendChild(frame);
    return wrap;
  }

  /* ---- dates, in the viewer's own time zone -------------------------- */

  function toDate(value) {
    if (typeof value !== 'string' || !value) return null;
    var d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  // "Monday, 26 October"
  function formatUnlockDate(value) {
    var d = toDate(value);
    if (!d) return null;
    try {
      return new Intl.DateTimeFormat(undefined, {
        weekday: 'long', day: 'numeric', month: 'long'
      }).format(d);
    } catch (e) {
      return d.toDateString();
    }
  }

  // "Mon 26 Oct, 12:00 pm EDT"
  function formatSessionDate(value) {
    var d = toDate(value);
    if (!d) return null;
    try {
      return new Intl.DateTimeFormat(undefined, {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
      }).format(d);
    } catch (e) {
      return d.toString();
    }
  }

  /* ---- items --------------------------------------------------------- */

  function itemCard(item) {
    var card = el('article', 'trp-item');
    var kind = str(item && item.kind);
    var title = str(item && item.title);
    var body  = (item && typeof item.body === 'string') ? item.body : '';
    var url   = safeUrl(item && item.url);

    if (title) card.appendChild(el('h4', 'trp-item-title', title));

    // kind "video" puts the player above the body text.
    if (kind === 'video' && url) {
      var src = embedSrc(url);
      if (src) card.appendChild(videoFrame(src, title));
    }

    if (body) card.appendChild(el('p', 'trp-item-body', body));

    if (kind === 'link' && url) {
      card.appendChild(linkButton(url, 'Open'));
    } else if (kind === 'video' && url && !embedSrc(url)) {
      // A video we cannot safely embed is still reachable as a link.
      card.appendChild(linkButton(url, 'Watch'));
    }

    return card;
  }

  function sortedItems(week) {
    var items = (week && Array.isArray(week.items)) ? week.items.slice() : [];
    items.sort(function (a, b) {
      var d = num(a && a.sort, 0) - num(b && b.sort, 0);
      if (d !== 0) return d;
      return num(a && a.id, 0) - num(b && b.id, 0);
    });
    return items;
  }

  /* ---- weeks ---------------------------------------------------------- */

  function weekCard(week) {
    var card     = el('section', 'trp-week');
    var unlocked = week && week.unlocked === true;
    var title    = str(week && week.title);
    var summary  = str(week && week.summary);

    var head = el('div', 'trp-week-head');
    head.appendChild(el('h3', 'trp-week-title', title || 'Untitled'));

    if (!unlocked) {
      card.className = 'trp-week trp-week-locked';
      head.appendChild(el('span', 'trp-badge', 'Locked'));
    }
    card.appendChild(head);

    if (!unlocked) {
      var when = formatUnlockDate(week && week.release_at);
      card.appendChild(el('p', 'trp-week-meta', when ? ('Unlocks ' + when) : 'Unlocks soon'));
      return card;                       // a locked week shows nothing else
    }

    if (summary) card.appendChild(el('p', 'trp-week-summary', summary));

    var items = sortedItems(week);
    if (!items.length) {
      card.appendChild(el('p', 'trp-empty', 'Content coming soon.'));
      return card;
    }

    var list = el('div', 'trp-items');
    items.forEach(function (item) { list.appendChild(itemCard(item)); });
    card.appendChild(list);

    return card;
  }

  function renderWeeks(target, data) {
    if (!target) return;
    clear(target);

    var weeks = (data && Array.isArray(data.weeks)) ? data.weeks.slice() : [];
    weeks.sort(function (a, b) { return num(a && a.id, 0) - num(b && b.id, 0); });

    if (!weeks.length) {
      target.appendChild(el('p', 'trp-empty', 'Content coming soon.'));
      return;
    }

    weeks.forEach(function (week) { target.appendChild(weekCard(week)); });
  }

  /* ---- sessions -------------------------------------------------------- */

  function sessionRow(session) {
    var row = el('article', 'trp-session');

    row.appendChild(el('h4', 'trp-session-title', str(session && session.title) || 'Untitled'));

    var when = formatSessionDate(session && session.starts_at);
    if (when) row.appendChild(el('p', 'trp-session-meta', when));

    var join = safeUrl(session && session.join_url);
    var rec  = safeUrl(session && session.recording_url);

    if (join || rec) {
      var actions = el('div', 'trp-actions');
      if (join) actions.appendChild(linkButton(join, 'Join'));
      if (rec)  actions.appendChild(linkButton(rec, 'Watch recording'));
      row.appendChild(actions);
    }

    return row;
  }

  function renderSessions(target, data) {
    if (!target) return;
    clear(target);

    var sessions = (data && Array.isArray(data.sessions)) ? data.sessions.slice() : [];
    sessions.sort(function (a, b) {
      var da = toDate(a && a.starts_at);
      var db = toDate(b && b.starts_at);
      return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
    });

    if (!sessions.length) {
      target.appendChild(el('p', 'trp-empty', 'No sessions scheduled yet.'));
      return;
    }

    sessions.forEach(function (session) { target.appendChild(sessionRow(session)); });
  }

  /* ---- auto-mount ------------------------------------------------------- */

  function applyData(data) {
    var first = str(data && data.member && data.member.first_name);
    var names = document.querySelectorAll('[data-portal-name]');
    for (var i = 0; i < names.length; i++) names[i].textContent = first;

    renderWeeks(document.querySelector('[data-portal-weeks]'), data);
    renderSessions(document.querySelector('[data-portal-sessions]'), data);

    setState('in');
  }

  function errorSlot(form) {
    var slot = form.querySelector('[data-portal-error]');
    if (!slot) {
      slot = el('p', 'trp-error');
      slot.setAttribute('data-portal-error', '');
      form.appendChild(slot);
    }
    slot.className = 'trp-error';
    slot.setAttribute('role', 'alert');
    return slot;
  }

  function showMessage(text) {
    var form = document.querySelector('[data-portal-login]');
    if (form) { errorSlot(form).textContent = text; return; }

    // No login form on this page, so put it where the content would be.
    var target = document.querySelector('[data-portal-weeks]') ||
                 document.querySelector('[data-portal-sessions]');
    if (target) { clear(target); target.appendChild(el('p', 'trp-error', text)); }
  }

  function signedOut() {
    if (document.querySelector('[data-portal-login]')) {
      setState('out');
    } else {
      window.location.replace('index.html');
    }
  }

  function wireSignOut() {
    var buttons = document.querySelectorAll('[data-portal-signout]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (event) {
        event.preventDefault();
        signOut();
        window.location.reload();
      });
    }
  }

  function wireLogin() {
    var form = document.querySelector('[data-portal-login]');
    if (!form) return;

    var input  = form.querySelector('input');
    var button = form.querySelector('button[type="submit"]') || form.querySelector('button');

    form.addEventListener('submit', function (event) {
      // Always stop the native submit: it would put the code in the URL.
      event.preventDefault();

      var slot = errorSlot(form);
      slot.textContent = '';

      var code = input ? input.value : '';
      if (button) { button.disabled = true; }
      form.setAttribute('aria-busy', 'true');

      signIn(code).then(function (result) {
        if (button) { button.disabled = false; }
        form.removeAttribute('aria-busy');

        if (result.ok) {
          if (input) input.value = '';
          applyData(result.data);
          return;
        }
        slot.textContent = MSG[result.reason] || MSG.unavailable;
      }, function () {
        if (button) { button.disabled = false; }
        form.removeAttribute('aria-busy');
        slot.textContent = MSG.unavailable;
      });
    });
  }

  function mount() {
    wireSignOut();
    wireLogin();

    var wantsData = document.querySelector('[data-portal-weeks]') ||
                    document.querySelector('[data-portal-sessions]') ||
                    document.querySelector('[data-portal-name]');

    if (!wantsData) {
      // Nothing to fill. A login-only page shows its form; any other
      // page should just be visible.
      setState(document.querySelector('[data-portal-login]') ? 'out' : 'in');
      return;
    }

    if (!hasCode()) { signedOut(); return; }

    setState('loading');
    load().then(function (result) {
      if (result.ok) { applyData(result.data); return; }

      if (result.reason === 'unavailable') {
        // Keep the stored code and say so, rather than bouncing the
        // member to the login page over a temporary failure.
        setState(document.querySelector('[data-portal-login]') ? 'out' : 'in');
        showMessage(MSG.unavailable);
        return;
      }

      signedOut();
    }, function () {
      setState(document.querySelector('[data-portal-login]') ? 'out' : 'in');
      showMessage(MSG.unavailable);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  /* ---- exports ----------------------------------------------------------- */

  window.TRPortal = {
    signIn: signIn,
    load: load,
    signOut: signOut,
    hasCode: hasCode,
    renderWeeks: renderWeeks,
    renderSessions: renderSessions,
    messages: MSG
  };

})(window, document);
