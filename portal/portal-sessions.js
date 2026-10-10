/* =====================================================================
 * Time Rich portal - Live Sessions page renderer.
 *
 * Listens for `trportal:data` from portal-access.js and fills #trSessionList:
 * one card for the next session, then one card per week holding slim rows,
 * in the same shape as the accelerator page's "The 4 weeks".
 *
 * Rules:
 *   - createElement + textContent only (never innerHTML with API data)
 *   - times stay in Eastern Time (how the cohort is announced)
 *   - unlock uses the ET calendar day of starts_at (see
 *     TRLive.isSessionUnlocked) so every member opens together
 *
 * Only the layout changed in this pass. Data loading, the unlock rule, Add to
 * calendar, the attended toggle, markOnUse, recordings and the time-zone
 * handling are the same calls as before.
 * ===================================================================== */
(function (window, document) {
  'use strict';

  var L = window.TRLive;
  if (!L) return;

  /* The accelerator page's themes, keyed by week. A week with no theme here
     (week 0, "Start here") falls back to its own title from the payload. */
  var THEMES = {
    1: 'Open Business Surgery',
    2: 'Your AI Operating System',
    3: 'Storytelling for GTM',
    4: 'Unfair AI Advantage'
  };

  var ALL_SESSIONS_URL = 'https://cal.ae/z0j4nlqbgt6b';

  var BTN_PRIMARY = 'inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-brand-deep ' +
                    'text-brand-bg text-xs font-semibold transition-colors hover:bg-brand-green';
  // Disabled. The label has to stay readable in both themes, so it is the
  // same ink as the page, muted, on a wash of that ink rather than a solid
  // fill with inverted text.
  var BTN_PRIMARY_OFF = 'inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-brand-ink/15 ' +
                        'text-brand-ink/85 text-xs font-semibold cursor-not-allowed';
  var BTN_SECONDARY = 'inline-flex items-center justify-center px-5 py-2.5 rounded-full border ' +
                      'border-brand-deep/25 text-brand-deep text-xs font-semibold transition-colors ' +
                      'hover:border-brand-deep/60';
  var ACTION = 'trp-saction inline-flex items-center justify-center px-3.5 py-1.5 rounded-full ' +
               'text-[11px] font-semibold transition-colors';
  var ACTION_JOIN = ACTION + ' bg-brand-deep text-brand-bg hover:bg-brand-green';
  var ACTION_SOFT = ACTION + ' border border-brand-deep/25 text-brand-deep hover:border-brand-deep/60';
  var ACTION_DEAD = ACTION + ' text-brand-deep/45 cursor-default';

  /* ---- small pieces ---------------------------------------------------- */

  function svgIcon(d, cls) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', cls || 'w-4 h-4');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.6');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('d', d);
    svg.appendChild(path);
    return svg;
  }

  function calendarIcon() {
    return svgIcon('M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z');
  }
  function tickIcon() {
    return svgIcon('M5 13l4 4L19 7', 'w-3.5 h-3.5');
  }

  /* "Bonus: Multi-LLM & Setting Your Harness" is one session whose name
     carries its own label. The pill says it, so the prefix comes off the
     title and the word is not read twice. */
  var BONUS = /^bonus:\s*/i;

  function isBonus(session) {
    return BONUS.test(L.str(session && session.title));
  }
  function titleOf(session) {
    var t = L.str(session && session.title) || 'Session';
    return isBonus(session) ? t.replace(BONUS, '') : t;
  }
  function bonusPill() {
    return L.el('span', 'trp-pill', 'Bonus');
  }

  /* WED 28 OCT · 12PM ET. The casing is CSS, so the text stays readable to a
     screen reader. */
  function whenText(session) {
    var d = L.etDate(session && session.starts_at);
    var t = L.etTime(session && session.starts_at);
    if (!d) return '';
    return t ? d + ' · ' + t + ' ET' : d;
  }

  /* ---- the attended tick ----------------------------------------------- */

  /* Same store as before (TRLive.isSessionMarked / toggleSession); this is a
     small square tick rather than a pill, and it exposes refresh() so a Join
     or Watch click can tick it. */
  function attendedToggle(session) {
    var btn = L.el('button', 'trp-tick');
    btn.type = 'button';
    btn.appendChild(tickIcon());

    function paint() {
      var on = Boolean(L.isSessionMarked(session));
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label',
        (on ? 'Attended: ' : 'Mark attended: ') + (L.str(session.title) || 'Session'));
      btn.classList.toggle('is-on', on);
    }

    btn.addEventListener('click', function () {
      L.toggleSession(session);
      paint();
    });
    paint();
    btn.refresh = paint;
    return btn;
  }

  /* ---- one row's single action ----------------------------------------- */

  function rowAction(session, unlocked, past, tick) {
    var name = L.str(session.title) || 'Session';

    function markOnUse(link) {
      if (!link) return link;
      link.addEventListener('click', function () {
        L.markSession(session);
        if (tick && typeof tick.refresh === 'function') tick.refresh();
      });
      return link;
    }

    if (past) {
      var rec = markOnUse(L.linkTo(session.recording_url, 'Watch recording', ACTION_SOFT));
      if (rec) {
        rec.setAttribute('aria-label', 'Watch recording of ' + name);
        return rec;
      }
      var soon = L.el('span', ACTION_DEAD, 'Recording soon');
      soon.setAttribute('aria-label', 'Recording of ' + name + ' is not up yet');
      return soon;
    }

    if (unlocked) {
      var join = markOnUse(L.linkTo(session.join_url, 'Join', ACTION_JOIN));
      if (join) {
        join.setAttribute('aria-label', 'Join ' + name);
        return join;
      }
      var off = L.el('button', ACTION_DEAD, 'Join');
      off.type = 'button';
      off.disabled = true;
      off.setAttribute('aria-label', 'Join ' + name + ' is not available');
      return off;
    }

    // Before its day: save the date. One link to the session's Add Event
    // page. No addevent_url means there is nothing to add, so no button.
    var cal = L.calendarLink(session, '', ACTION_SOFT + ' trp-cal');
    if (cal) {
      L.clear(cal);
      cal.appendChild(calendarIcon());
      cal.setAttribute('aria-label', 'Add ' + name + ' to your calendar');
      return cal;
    }
    return null;
  }

  /* ---- a week's row ----------------------------------------------------- */

  function sessionRow(session, now) {
    var past = L.isSessionPast(session, now);
    var unlocked = L.isSessionUnlocked(session, now);

    var row = L.el('li', 'trp-srow' + (past ? ' is-past' : ''));

    var when = L.el('span', 'trp-sdate', whenText(session));
    row.appendChild(when);

    var title = L.el('span', 'trp-stitle');
    title.appendChild(document.createTextNode(titleOf(session)));
    if (isBonus(session)) title.appendChild(bonusPill());
    row.appendChild(title);

    var tick = attendedToggle(session);

    var slot = L.el('span', 'trp-sact');
    var act = rowAction(session, unlocked, past, tick);
    if (act) slot.appendChild(act);
    row.appendChild(slot);

    row.appendChild(tick);
    return row;
  }

  /* ---- a week card ------------------------------------------------------ */

  function weekCard(data, weekId, list) {
    var card = L.el('li', 'glass-card is-static trp-wkcard');

    var head = L.el('div', 'trp-wkcard-head');
    var n = L.num(weekId);
    var label = n === 0 ? 'Start here' : 'Week ' + (n < 10 ? '0' + n : n);
    head.appendChild(L.el('p', 'trp-tag', label));

    var theme = THEMES[n];
    if (!theme) {
      var wk = L.weeks(data).filter(function (w) { return L.num(w && w.id) === n; })[0];
      theme = (wk && L.str(wk.title)) || (n === 0 ? 'Start here' : 'Week ' + n);
    }
    // Week 0's label and its title are both "Start here", so showing both
    // just says it twice.
    if (L.str(theme).toLowerCase() !== label.toLowerCase()) {
      head.appendChild(L.el('h2', 'trp-wkcard-theme', theme));
    }
    card.appendChild(head);

    var ul = L.el('ul', 'trp-srows');
    list.forEach(function (s) { ul.appendChild(sessionRow(s, new Date())); });
    card.appendChild(ul);
    return card;
  }

  /* ---- the next session card -------------------------------------------- */

  function nextCard(data, now) {
    var card = L.el('div', 'glass-card is-static trp-next');
    var next = L.nextSession(data, now);

    if (!next) {
      // Everything has run. Point at the recordings rather than a dead card.
      card.appendChild(L.el('p', 'trp-tag', 'Live sessions'));
      card.appendChild(L.el('h2', 'trp-next-title', 'All live sessions complete'));
      var rec = L.latestRecording(data, now);
      var acts = L.el('div', 'trp-next-acts');
      var link = rec ? L.linkTo(rec.recording_url, 'Watch the recordings', BTN_PRIMARY) : null;
      if (link) {
        link.setAttribute('aria-label', 'Watch the session recordings');
        acts.appendChild(link);
      } else {
        acts.appendChild(L.el('p', 'trp-lede', 'Recordings go up here as they are ready.'));
      }
      card.appendChild(acts);
      return card;
    }

    card.appendChild(L.el('p', 'trp-tag', 'Next session'));
    card.appendChild(L.el('h2', 'trp-next-title', titleOf(next)));

    var meta = L.el('p', 'trp-next-when');
    meta.appendChild(document.createTextNode(whenText(next)));
    if (isBonus(next)) meta.appendChild(bonusPill());
    card.appendChild(meta);

    var name = L.str(next.title) || 'Session';
    var unlocked = L.isSessionUnlocked(next, now);
    var acts2 = L.el('div', 'trp-next-acts');

    var tick = attendedToggle(next);

    function markOnUse(link) {
      if (!link) return link;
      link.addEventListener('click', function () {
        L.markSession(next);
        if (tick && typeof tick.refresh === 'function') tick.refresh();
      });
      return link;
    }

    var join = unlocked ? markOnUse(L.linkTo(next.join_url, 'Join via Zoom', BTN_PRIMARY)) : null;
    if (join) {
      join.setAttribute('aria-label', 'Join ' + name);
      acts2.appendChild(join);
    } else {
      // Same rule as before: the button is there but dead until its ET day.
      var off = L.el('button', BTN_PRIMARY_OFF, 'Join via Zoom');
      off.type = 'button';
      off.disabled = true;
      off.setAttribute('aria-label', 'Join ' + name + ' opens on the day');
      acts2.appendChild(off);
    }

    var cal = L.calendarLink(next, 'Add to calendar', BTN_SECONDARY);
    if (cal) {
      cal.setAttribute('aria-label', 'Add ' + name + ' to your calendar');
      acts2.appendChild(cal);
    }

    acts2.appendChild(tick);
    card.appendChild(acts2);
    return card;
  }

  /* ---- all of it -------------------------------------------------------- */

  /* One link that takes the whole cohort schedule, rather than ten separate
     adds. It used to sit as an underlined line below everything, where it was
     the last thing anyone would see; it is now a button directly under the
     next session, which is where someone is already asking "when are these?". */
  function addAllButton(count) {
    var a = L.el('a', 'trp-addall');
    a.href = ALL_SESSIONS_URL;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', 'Add all ' + count + ' sessions to your calendar');
    a.appendChild(calendarIcon());
    a.appendChild(L.el('span', '', 'Add all ' + count + ' sessions to your calendar'));
    return a;
  }

  function render(listEl, data) {
    var sessions = L.sessions(data);
    if (!listEl || !sessions.length) return;

    var now = new Date();
    L.clear(listEl);

    listEl.appendChild(nextCard(data, now));

    // Grouped by week_id, in the order the weeks first appear.
    var order = [];
    var byWeek = {};
    sessions.forEach(function (s) {
      var id = L.num(s && s.week_id);
      if (!byWeek[id]) { byWeek[id] = []; order.push(id); }
      byWeek[id].push(s);
    });
    order.sort(function (a, b) { return a - b; });

    listEl.appendChild(addAllButton(sessions.length));

    var weeks = L.el('ul', 'trp-wkcards');
    order.forEach(function (id) { weeks.appendChild(weekCard(data, id, byWeek[id])); });
    listEl.appendChild(weeks);
  }

  document.addEventListener('trportal:data', function (event) {
    render(document.getElementById('trSessionList'), event && event.detail);
  });

  // The event may already have fired: this file is deferred, and a fetch that
  // resolves quickly gets there first. portal-access.js leaves the payload
  // behind for exactly this case.
  if (window.TR_PORTAL_DATA) {
    render(document.getElementById('trSessionList'), window.TR_PORTAL_DATA);
  }

})(window, document);
