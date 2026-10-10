/* =====================================================================
 * Time Rich portal - shared helpers for the live-data pages.
 *
 * Every portal page that renders portal_get listens for the
 * `trportal:data` event that portal-access.js fires, and builds its DOM
 * through the helpers here.
 *
 * Two rules, both deliberate:
 *   - nothing from the API ever reaches innerHTML. Elements are made with
 *     createElement and filled with textContent.
 *   - a link is only ever an absolute https URL, checked by safeUrl.
 *
 * Times are always shown in Eastern Time, because that is the time the
 * sessions are announced in, whatever time zone the member is reading in.
 * ===================================================================== */
(function (window, document) {
  'use strict';

  var TZ = 'America/New_York';
  var SESSION_MINUTES = 75;

  /* ---- DOM ------------------------------------------------------------ */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null && text !== '') node.textContent = String(text);
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function show(node, visible) {
    if (!node) return;
    if (visible) node.removeAttribute('hidden');
    else node.setAttribute('hidden', '');
  }

  function str(value) {
    return String(value == null ? '' : value).trim();
  }

  /* ---- links ---------------------------------------------------------- */

  // Absolute https only, the same rule portal-access.js applies. Anything
  // else returns null and the caller leaves the link out entirely.
  function safeUrl(raw) {
    var value = str(raw);
    if (!value) return null;
    var parsed;
    try { parsed = new URL(value); } catch (e) { return null; }
    return parsed.protocol === 'https:' ? parsed : null;
  }

  function linkTo(href, text, className) {
    var url = safeUrl(href);
    if (!url) return null;
    var a = el('a', className, text);
    a.href = url.href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  }

  /* ---- time ----------------------------------------------------------- */

  function toDate(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  // "Mon 26 Oct · 12pm ET"
  function etDateTime(iso) {
    var d = toDate(iso);
    if (!d) return '';
    return etDate(iso) + ' · ' + etTime(iso) + ' ET';
  }

  // "Mon 26 Oct"
  function etDate(iso) {
    var d = toDate(iso);
    if (!d) return '';
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short'
      }).format(d).replace(/,/g, '');
    } catch (e) {
      return d.toDateString();
    }
  }

  // "12pm" / "12:30pm"
  function etTime(iso) {
    var d = toDate(iso);
    if (!d) return '';
    try {
      var raw = new Intl.DateTimeFormat('en-US', {
        timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true
      }).format(d);
      return raw.replace(':00', '').replace(/\s*([AP])M/i, function (m, p) {
        return p.toLowerCase() + 'm';
      });
    } catch (e) {
      return '';
    }
  }


  /* ---- add to calendar ------------------------------------------------
   *
   * One link per session, to the Add Event page held in
   * portal_sessions.addevent_url. The portal used to build an .ics in the
   * browser and offer a Google/Outlook/Apple menu; that is all gone. When a
   * session has no addevent_url there is nothing to add, so the caller
   * leaves the button out rather than showing a dead one.
   */
  function addEventUrl(session) {
    var url = safeUrl(session && session.addevent_url);
    return url ? url.href : '';
  }

  // Returns an <a> to the Add Event page, or null when the session has none.
  function calendarLink(session, text, className) {
    var href = addEventUrl(session);
    if (!href) return null;
    var a = el('a', className, text || 'Add to calendar');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', 'Add ' + (str(session.title) || 'this session') + ' to your calendar');
    return a;
  }


  /* ---- payload -------------------------------------------------------- */

  function weeks(data) {
    var list = (data && Array.isArray(data.weeks)) ? data.weeks.slice() : [];
    list.sort(function (a, b) { return num(a && a.id) - num(b && b.id); });
    return list;
  }

  function sessions(data) {
    var list = (data && Array.isArray(data.sessions)) ? data.sessions.slice() : [];
    list.sort(function (a, b) {
      return (toDate(a && a.starts_at) || 0) - (toDate(b && b.starts_at) || 0);
    });
    return list;
  }

  function num(value) {
    var n = Number(value);
    return isFinite(n) ? n : 0;
  }

  function items(week) {
    var list = (week && Array.isArray(week.items)) ? week.items.slice() : [];
    list.sort(function (a, b) {
      return num(a && a.sort) - num(b && b.sort) || num(a && a.id) - num(b && b.id);
    });
    return list;
  }

  // The newest week the member can actually open.
  function latestUnlockedWeek(data) {
    var open = weeks(data).filter(function (w) { return w && w.unlocked === true; });
    return open.length ? open[open.length - 1] : null;
  }

  function nextSession(data, now) {
    var at = now || new Date();
    var list = sessions(data);
    for (var i = 0; i < list.length; i++) {
      var d = toDate(list[i] && list[i].starts_at);
      if (d && d.getTime() > at.getTime()) return list[i];
    }
    return null;
  }

  // YYYY-MM-DD in a given IANA zone (or the browser's local zone when omitted).
  // Used to decide "has this session's calendar day started for this member?".
  function dateKey(isoOrDate, timeZone) {
    var d = isoOrDate instanceof Date ? isoOrDate : toDate(isoOrDate);
    if (!d) return '';
    try {
      var opts = { year: 'numeric', month: '2-digit', day: '2-digit' };
      if (timeZone) opts.timeZone = timeZone;
      var parts = new Intl.DateTimeFormat('en-CA', opts).formatToParts(d);
      var y = '', m = '', day = '';
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === 'year') y = parts[i].value;
        else if (parts[i].type === 'month') m = parts[i].value;
        else if (parts[i].type === 'day') day = parts[i].value;
      }
      return y && m && day ? y + '-' + m + '-' + day : '';
    } catch (e) {
      return '';
    }
  }

  // A session unlocks once the Eastern calendar day of starts_at has begun.
  // The cohort is scheduled in ET, so every member unlocks at the same
  // absolute moment (midnight America/New_York), not at their local midnight.
  // starts_at is timestamptz; dateKey in TZ avoids UTC-day drift.
  function isSessionUnlocked(session, now) {
    var at = now || new Date();
    var start = toDate(session && session.starts_at);
    if (!start) return false;
    var todayEt = dateKey(at, TZ);
    var dayEt = dateKey(start, TZ);
    return Boolean(todayEt && dayEt && todayEt >= dayEt);
  }

  function isSessionPast(session, now) {
    var at = now || new Date();
    var start = toDate(session && session.starts_at);
    if (!start) return false;
    return start.getTime() + SESSION_MINUTES * 60000 <= at.getTime();
  }

  // Cohort schedule progress from portal_get: unlocked weeks + sessions that
  // have already run, over the totals. Same for every member on the schedule.
  function scheduleProgress(data, now) {
    var at = now || new Date();
    var weekList = weeks(data);
    var sessionList = sessions(data);
    var weeksDone = 0;
    var sessionsDone = 0;
    var i;

    for (i = 0; i < weekList.length; i++) {
      if (weekList[i] && weekList[i].unlocked === true) weeksDone += 1;
    }
    for (i = 0; i < sessionList.length; i++) {
      if (isSessionPast(sessionList[i], at)) sessionsDone += 1;
    }

    var weeksTotal = weekList.length;
    var sessionsTotal = sessionList.length;
    var total = weeksTotal + sessionsTotal;
    var done = weeksDone + sessionsDone;
    var percent = total ? Math.round((done / total) * 100) : 0;

    return {
      percent: percent,
      weeksDone: weeksDone,
      weeksTotal: weeksTotal,
      sessionsDone: sessionsDone,
      sessionsTotal: sessionsTotal
    };
  }

  /* ---- personal checklist (this browser, per passcode) ---------------- */

  var CODE_KEY = 'tr_portal_code';
  var PROGRESS_KEY = 'tr_portal_user_progress';

  function readPasscode() {
    try { return window.localStorage.getItem(CODE_KEY) || ''; }
    catch (e) { return ''; }
  }

  // The passcode must never be a storage key: anything that can read
  // localStorage could otherwise lift it straight out of the key names.
  // cyrb53 is a small, fast, non-reversible 53-bit hash. It is not a password
  // hash and is not meant to be: it only has to stop the code appearing in
  // the clear, while staying synchronous so a click can read progress without
  // waiting on crypto.subtle.
  function cyrb53(text, seed) {
    var h1 = 0xdeadbeef ^ (seed || 0);
    var h2 = 0x41c6ce57 ^ (seed || 0);
    for (var i = 0, ch; i < text.length; i++) {
      ch = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }

  // "p_" + hex, so a stored key is obviously a handle and never a passcode.
  function progressKeyFor(code) {
    return 'p_' + cyrb53(String(code), 0).toString(16);
  }

  function readProgressStore() {
    try {
      var raw = window.localStorage.getItem(PROGRESS_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function writeProgressStore(store) {
    try { window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(store)); }
    catch (e) { /* private mode: the toggle still flips in memory for this click */ }
  }

  function progressEntry() {
    var code = readPasscode();
    if (!code) return null;
    var store = readProgressStore();
    var key = progressKeyFor(code);

    // One-time migration off the old raw-passcode key. The entry moves to the
    // hashed key, the raw key goes, and the result is saved straight away so
    // the passcode is gone from storage even if nothing else is touched.
    if (Object.prototype.hasOwnProperty.call(store, code)) {
      if (!Object.prototype.hasOwnProperty.call(store, key)) store[key] = store[code];
      delete store[code];
      writeProgressStore(store);
    }

    var entry = store[key];
    if (!entry || typeof entry !== 'object') entry = { items: {}, sessions: {} };
    if (!entry.items || typeof entry.items !== 'object') entry.items = {};
    if (!entry.sessions || typeof entry.sessions !== 'object') entry.sessions = {};
    store[key] = entry;
    return { store: store, entry: entry };
  }

  function itemKey(item) {
    if (!item || item.id == null || item.id === '') return '';
    return String(item.id);
  }

  function sessionKey(session) {
    var when = str(session && session.starts_at);
    var title = str(session && session.title);
    if (!when && !title) return '';
    return when + '\n' + title;
  }

  function isItemDone(item) {
    var key = itemKey(item);
    var bag = progressEntry();
    return Boolean(key && bag && bag.entry.items[key]);
  }

  function isSessionMarked(session) {
    var key = sessionKey(session);
    var bag = progressEntry();
    return Boolean(key && bag && bag.entry.sessions[key]);
  }

  function setMark(mapName, key, value) {
    if (!key) return false;
    var bag = progressEntry();
    if (!bag) return false;
    if (value) bag.entry[mapName][key] = true;
    else delete bag.entry[mapName][key];
    writeProgressStore(bag.store);
    return Boolean(value);
  }

  function toggleItem(item) {
    var key = itemKey(item);
    return setMark('items', key, !isItemDone(item));
  }

  function toggleSession(session) {
    var key = sessionKey(session);
    return setMark('sessions', key, !isSessionMarked(session));
  }

  function markSession(session) {
    return setMark('sessions', sessionKey(session), true);
  }

  function trackableItems(data) {
    var out = [];
    weeks(data).forEach(function (week) {
      if (!week || week.unlocked !== true) return;
      items(week).forEach(function (item) {
        if (itemKey(item)) out.push(item);
      });
    });
    return out;
  }

  // Personal progress: marked items on unlocked weeks, plus marked sessions,
  // over everything the member can currently mark.
  function userProgress(data) {
    var itemList = trackableItems(data);
    var sessionList = sessions(data).filter(function (s) { return sessionKey(s); });
    var done = 0;
    var i;
    for (i = 0; i < itemList.length; i++) {
      if (isItemDone(itemList[i])) done += 1;
    }
    for (i = 0; i < sessionList.length; i++) {
      if (isSessionMarked(sessionList[i])) done += 1;
    }
    var total = itemList.length + sessionList.length;
    return {
      percent: total ? Math.round((done / total) * 100) : 0,
      done: done,
      total: total
    };
  }

  // Compact and fixed width, so a long item title wraps and the button never
  // does. shrink-0 keeps it off the wrap line in a flex row.
  var DONE_BASE = 'inline-flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap ' +
                  'min-w-[6.5rem] px-3 py-1.5 rounded-full text-[11px] transition-colors';
  var DONE_ON = DONE_BASE + ' font-bold bg-brand-deep text-brand-bg hover:bg-brand-green';
  var DONE_OFF = DONE_BASE + ' font-semibold bg-brand-sagelt/60 text-brand-deep hover:bg-brand-sagelt';

  // A small tick, drawn as nodes so nothing is parsed as markup.
  function tickIcon() {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'w-3 h-3 shrink-0');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '3');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('d', 'M5 13l4 4L19 7');
    svg.appendChild(path);
    return svg;
  }

  // A button whose label follows isDone(). apply() writes the checklist.
  // btn.refresh() repaints after something else marks the same row.
  function doneToggle(isDone, apply) {
    var btn = el('button', DONE_OFF);
    btn.type = 'button';
    var label = el('span', '', 'Mark done');
    btn.appendChild(tickIcon());
    btn.appendChild(label);
    function paint() {
      var on = Boolean(isDone());
      label.textContent = on ? 'Done' : 'Mark done';
      btn.className = on ? DONE_ON : DONE_OFF;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    btn.addEventListener('click', function () {
      apply();
      paint();
    });
    btn.refresh = paint;
    paint();
    return btn;
  }

  // The most recent past session that actually has a recording.
  function latestRecording(data, now) {
    var at = now || new Date();
    var list = sessions(data).filter(function (s) {
      var d = toDate(s && s.starts_at);
      return d && d.getTime() <= at.getTime() && safeUrl(s && s.recording_url);
    });
    return list.length ? list[list.length - 1] : null;
  }

  function sessionsForWeek(data, weekId) {
    return sessions(data).filter(function (s) { return num(s && s.week_id) === num(weekId); });
  }

  // Finds a link item in a week by a loose title match, so "WhatsApp group"
  // and "Join the WhatsApp" both answer to "whatsapp". Returns null when
  // there is no such item, and the caller hides its link.
  function findLinkItem(data, weekId, needle) {
    var want = str(needle).toLowerCase();
    if (!want) return null;
    var list = weeks(data).filter(function (w) { return num(w && w.id) === num(weekId); });
    for (var i = 0; i < list.length; i++) {
      var found = items(list[i]).filter(function (item) {
        return item && item.kind === 'link' &&
               str(item.title).toLowerCase().indexOf(want) !== -1 &&
               safeUrl(item.url);
      });
      if (found.length) return found[0];
    }
    return null;
  }

  window.TRLive = {
    el: el,
    clear: clear,
    show: show,
    str: str,
    num: num,
    safeUrl: safeUrl,
    linkTo: linkTo,
    toDate: toDate,
    etDate: etDate,
    etTime: etTime,
    etDateTime: etDateTime,
    addEventUrl: addEventUrl,
    calendarLink: calendarLink,
    weeks: weeks,
    sessions: sessions,
    items: items,
    latestUnlockedWeek: latestUnlockedWeek,
    nextSession: nextSession,
    dateKey: dateKey,
    isSessionUnlocked: isSessionUnlocked,
    isSessionPast: isSessionPast,
    scheduleProgress: scheduleProgress,
    itemKey: itemKey,
    sessionKey: sessionKey,
    isItemDone: isItemDone,
    isSessionMarked: isSessionMarked,
    toggleItem: toggleItem,
    toggleSession: toggleSession,
    markSession: markSession,
    userProgress: userProgress,
    doneToggle: doneToggle,
    latestRecording: latestRecording,
    sessionsForWeek: sessionsForWeek,
    findLinkItem: findLinkItem,
    SESSION_MINUTES: SESSION_MINUTES
  };

})(window, document);
