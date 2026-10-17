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
    var weekList = weeks(data).filter(function (week) { return num(week.id) !== 0; });
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

  /* ---- personal checklist (the signed-in member's account) ------------ */

  var progress = { items: {}, sessions: {} };

  function setProgress(data) {
    var saved = data && data.progress;
    progress = { items: {}, sessions: {} };
    ['items', 'sessions'].forEach(function (type) {
      var ids = saved && Array.isArray(saved[type]) ? saved[type] : [];
      ids.forEach(function (id) {
        if (Number.isSafeInteger(Number(id)) && Number(id) > 0) progress[type][String(id)] = true;
      });
    });
  }

  function announceProgress() {
    try { document.dispatchEvent(new CustomEvent('trportal:progress')); }
    catch (e) { /* the next page render still reads the current state */ }
  }

  function itemKey(item) {
    if (!item || item.id == null || item.id === '') return '';
    return String(item.id);
  }

  function sessionKey(session) {
    return itemKey(session);
  }

  function isItemDone(item) {
    var key = itemKey(item);
    return Boolean(key && progress.items[key]);
  }

  function isSessionMarked(session) {
    var key = sessionKey(session);
    return Boolean(key && progress.sessions[key]);
  }

  function setMark(mapName, key, value) {
    if (!key) return Promise.resolve(false);
    var wasDone = Boolean(progress[mapName][key]);
    if (value) progress[mapName][key] = true;
    else delete progress[mapName][key];
    announceProgress();

    var api = window.TRPortal;
    var target = { id: Number(key), kind: mapName === 'items' ? 'item' : 'session' };
    if (!api || typeof api.setProgress !== 'function') {
      if (wasDone) progress[mapName][key] = true;
      else delete progress[mapName][key];
      announceProgress();
      return Promise.resolve(false);
    }

    return api.setProgress(target, value).then(function (saved) {
      if (!saved) {
        if (wasDone) progress[mapName][key] = true;
        else delete progress[mapName][key];
        announceProgress();
      }
      return saved;
    }, function () {
      if (wasDone) progress[mapName][key] = true;
      else delete progress[mapName][key];
      announceProgress();
      return false;
    });
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
    if (isSessionMarked(session)) return Promise.resolve(true);
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

  // Personal progress: completed items on unlocked weeks, plus marked
  // sessions, over everything the member can currently mark.
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

  /* ---- icons ----------------------------------------------------------
   * Drawn as nodes rather than markup, the same rule as everything else
   * here: nothing from this file ever reaches innerHTML.
   */
  function svgPath(d, cls, width) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', cls || '');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', String(width || 2));
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('d', d);
    svg.appendChild(path);
    return svg;
  }

  function checkIcon() { return svgPath('M5 13l4 4L19 7', '', 3); }
  function lockIcon() {
    return svgPath('M16 11V7a4 4 0 00-8 0v4m-1 0h10a1 1 0 011 1v7a1 1 0 01-1 1H7a1 1 0 01-1-1v-7a1 1 0 011-1z',
                   'trp-coming-lock', 1.6);
  }


  /* ---- the checklist card ---------------------------------------------
   *
   * One shape for an open section, used twice: the dashboard draws the
   * section that is open now, and the Curriculum draws every section that
   * has opened. A week goes in; a white card with a count in its header
   * and one row per thing to do comes out.
   *
   * A row is the 22px circle, the label, and -- where the row has one -- a
   * date and an action on the right. The circle is the toggle and is the
   * same control it was before, so a tick still writes to the member's
   * account and still survives a reload.
   *
   * opts.el        'li' when the card is going into a <ul>, else a <div>.
   * opts.sessions  include the week's live sessions as rows. The Curriculum
   *                does; the dashboard does not, because the next session
   *                has a card of its own at the top of that page.
   */
  var BONUS_RE = /^bonus:\s*/i;

  function weekLabel(week) {
    var n = num(week && week.id);
    return n === 0 ? 'Start here' : 'Week ' + (n < 10 ? '0' + n : n);
  }

  // The circle. It paints itself, and refresh() repaints it when something
  // else on the page marks the same row.
  function checkBox(isDone, toggle, label) {
    var btn = el('button', 'trp-check-box');
    btn.type = 'button';
    btn.appendChild(checkIcon());
    function paint() {
      var on = Boolean(isDone());
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', (on ? 'Done: ' : 'Mark done: ') + label);
      var row = btn.closest ? btn.closest('.trp-check-row') : null;
      if (row) row.classList.toggle('is-done', on);
    }
    btn.addEventListener('click', function () {
      Promise.resolve(toggle()).then(paint);
      paint();
    });
    paint();
    btn.refresh = paint;
    return btn;
  }

  function checkItemRow(item) {
    var name = str(item && item.title) || 'Untitled';
    var row = el('li', 'trp-check-row');

    if (itemKey(item)) {
      row.appendChild(checkBox(
        function () { return isItemDone(item); },
        function () { return toggleItem(item); },
        name));
    } else {
      // Nothing to tick, but the row still lines up with the ones that do.
      row.appendChild(el('span', 'trp-check-gap'));
    }

    var label = el('span', 'trp-check-label');
    var link = linkTo(item && item.url, name, 'trp-slink');
    label.appendChild(link || document.createTextNode(name));
    if (item && item.kind === 'skill') label.appendChild(el('span', 'trp-pill', 'Skill'));
    row.appendChild(label);

    return row;
  }

  function checkSessionRow(data, session, now) {
    var name = str(session && session.title) || 'Session';
    var bonus = BONUS_RE.test(name);
    var shown = bonus ? name.replace(BONUS_RE, '') : name;
    var past = isSessionPast(session, now);
    var unlocked = isSessionUnlocked(session, now);

    var row = el('li', 'trp-check-row has-act');

    var box = checkBox(
      function () { return isSessionMarked(session); },
      function () { return toggleSession(session); },
      name);
    row.appendChild(box);

    var label = el('span', 'trp-check-label');
    label.appendChild(document.createTextNode(shown));
    if (bonus) label.appendChild(el('span', 'trp-pill', 'Bonus'));
    var when = etDate(session && session.starts_at);
    var at = etTime(session && session.starts_at);
    if (when) {
      label.appendChild(el('span', 'trp-check-when', at ? when + ' \u00b7 ' + at + ' ET' : when));
    }
    row.appendChild(label);

    /* One action, the same rule as the Live Sessions page: Join on the day,
       the recording afterwards, nothing before. Using either one marks the
       session, which is what it did before. */
    var slot = el('span', 'trp-check-act');
    var act = null;
    if (past) {
      act = linkTo(session.recording_url, 'Watch recording', 'trp-btn trp-btn-outline trp-btn-sm');
      if (act) act.setAttribute('aria-label', 'Watch recording of ' + name);
    } else if (unlocked) {
      act = linkTo(session.join_url, 'Join', 'trp-btn trp-btn-primary trp-btn-sm');
      if (act) act.setAttribute('aria-label', 'Join ' + name);
    }
    if (act) {
      act.addEventListener('click', function () {
        Promise.resolve(markSession(session)).then(function () {
          if (box.refresh) box.refresh();
        });
      });
      slot.appendChild(act);
    }
    row.appendChild(slot);

    return row;
  }

  function checklistCard(data, week, opts) {
    opts = opts || {};
    var card = el(opts.el === 'li' ? 'li' : 'div', 'glass-card is-static trp-check');
    var label = weekLabel(week);
    var title = str(week && week.title) || label;

    var head = el('div', 'trp-check-head');
    var left = el('div', '');
    /* The label goes in only when it says something the heading has not.
       Week 0's label and its title are both "Start here", and printing
       both just says it twice. */
    if (title.toLowerCase() !== label.toLowerCase()) {
      left.appendChild(el('p', 'trp-tag', label));
    }
    left.appendChild(el('h2', 'trp-check-heading', title));
    head.appendChild(left);

    var list = items(week);
    var sessionList = opts.sessions ? sessionsForWeek(data, week && week.id) : [];

    var done = 0, i;
    for (i = 0; i < list.length; i++) { if (isItemDone(list[i])) done += 1; }
    for (i = 0; i < sessionList.length; i++) { if (isSessionMarked(sessionList[i])) done += 1; }
    var total = list.length + sessionList.length;

    if (total) {
      head.appendChild(el('p', 'trp-check-count', done + ' of ' + total + ' done'));
    }
    card.appendChild(head);

    if (str(week && week.summary)) {
      card.appendChild(el('p', 'trp-check-sub', str(week.summary)));
    }

    var ul = el('ul', 'trp-checks');
    var now = new Date();
    list.forEach(function (item) { ul.appendChild(checkItemRow(item)); });
    sessionList.forEach(function (session) { ul.appendChild(checkSessionRow(data, session, now)); });
    if (!ul.childNodes.length) {
      ul.appendChild(el('li', 'trp-check-empty', 'Nothing here yet.'));
    }
    card.appendChild(ul);

    return card;
  }

  // Presentation grouping only: keep source IDs and release flags unchanged.
  // Preparation is accessible before kickoff, inside Week 1, never a fifth week.
  function learningCard(data, week, opts) {
    var prep = weeks(data).filter(function (w) { return num(w.id) === 0 && w.unlocked === true; })[0];
    var first = weeks(data).filter(function (w) { return num(w.id) === 1; })[0];
    if (num(week && week.id) === 0 && first) week = first;
    if (!week || num(week.id) !== 1 || !prep) return checklistCard(data, week, opts);
    var view = Object.assign({}, week, { items: week.unlocked ? items(week) : [] });
    var card = checklistCard(data, view, Object.assign({}, opts, { sessions: !!(opts && opts.sessions && week.unlocked) }));
    var list = card.querySelector('.trp-checks');
    var prepLabel = el('h3', 'trp-prep-label', 'Start here');
    card.insertBefore(prepLabel, list);
    if (str(prep.summary)) card.insertBefore(el('p', 'trp-check-sub', str(prep.summary)), list);
    var prepList = el('ul', 'trp-checks');
    items(prep).forEach(function (item) { prepList.appendChild(checkItemRow(item)); });
    card.insertBefore(prepList, list);
    if (!week.unlocked) {
      list.remove();
      card.appendChild(el('p', 'trp-check-sub', 'Week 1 sessions and materials open ' + (etDate(week.release_at) || 'soon') + '.'));
    } else if (items(week).length) card.insertBefore(el('h3', 'trp-prep-label', week.title), list);
    var count = card.querySelector('.trp-check-count');
    if (count) count.remove();
    return card;
  }


  /* ---- coming up ------------------------------------------------------
   *
   * Every week that has not opened yet, in one card, one row each. These
   * used to be full-size week cards with nothing in them, which read as a
   * column of empty boxes down the Curriculum page. A week leaves this list
   * and gets a checklist card of its own on the morning it opens, straight
   * off the same `unlocked` flag -- there is nothing to switch over by hand.
   */
  function comingCard(data, opts) {
    opts = opts || {};
    var hasPrep = weeks(data).some(function (w) { return num(w.id) === 0 && w.unlocked === true; });
    var shut = weeks(data).filter(function (w) { return w && w.unlocked !== true && !(hasPrep && num(w.id) === 1); });
    if (!shut.length) return null;

    var card = el(opts.el === 'li' ? 'li' : 'div', 'glass-card is-static trp-coming');
    var head = el('div', 'trp-check-head');
    var left = el('div', '');
    left.appendChild(el('h2', 'trp-check-heading', 'Coming up'));
    head.appendChild(left);
    head.appendChild(el('p', 'trp-check-count', shut.length + (shut.length === 1 ? ' week' : ' weeks')));
    card.appendChild(head);

    var ul = el('ul', 'trp-coming-rows');
    shut.forEach(function (week) {
      var n = num(week.id);
      var row = el('li', 'trp-coming-row');
      row.appendChild(el('span', 'trp-coming-n', n === 0 ? 'W00' : 'W' + (n < 10 ? '0' + n : n)));
      row.appendChild(el('span', 'trp-coming-title', str(week.title) || weekLabel(week)));

      var opens = etDate(week.release_at);
      var when = el('span', 'trp-coming-when');
      when.appendChild(document.createTextNode(opens ? 'Opens ' + opens : 'Opens soon'));
      when.appendChild(lockIcon());
      row.appendChild(when);

      ul.appendChild(row);
    });
    card.appendChild(ul);

    return card;
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

  document.addEventListener('trportal:data', function (event) {
    setProgress(event && event.detail);
  });
  if (window.TR_PORTAL_DATA) setProgress(window.TR_PORTAL_DATA);

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
    setProgress: setProgress,
    doneToggle: doneToggle,
    checkBox: checkBox,
    checklistCard: checklistCard,
    learningCard: learningCard,
    comingCard: comingCard,
    weekLabel: weekLabel,
    latestRecording: latestRecording,
    sessionsForWeek: sessionsForWeek,
    findLinkItem: findLinkItem,
    SESSION_MINUTES: SESSION_MINUTES
  };

})(window, document);
